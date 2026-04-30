/**
 * SYNC — bidirectional real-time sync between Zustand store and Firestore.
 *
 * Write path:  every store mutation → syncHook → fsSet / fsDelete on Firestore.
 * Read path:   onSnapshot listeners → hydrateCollection (live, per collection).
 *
 * Personal mode  → listens on  users/{uid}/{col}
 * Space mode     → listens on  spaces/{spaceId}/{col}  (shared with all members)
 *
 * Subscriptions are managed by subscribeToData / unsubscribeFromData and are
 * automatically re-created whenever the user logs in or joins / leaves a space.
 */
import { useStore } from './index';
import {
  FIREBASE_ENABLED,
  fsSet,
  fsDelete,
  fsGetAll,
  fsSubscribe,
  loginWithGoogle,
  handleRedirectResult,
  logoutFirebase,
  onAuthStateChanged,
  getFirebaseAuth,
} from '../lib/firebase';
import type { AppState } from '../types';
import type { Unsubscribe } from 'firebase/firestore';

/* ── Module-level state ──────────────────────────────────────────────────── */

let _uid: string | null = null;
let _activeSubscriptions: Unsubscribe[] = [];

export const getSyncUid = () => _uid;
export const setSyncUid = (uid: string | null) => { _uid = uid; };

/* ── Write hook (fires on every store mutation) ─────────────────────────── */

const syncHook = async (
  op: 'set' | 'delete',
  col: string,
  data: Record<string, unknown>,
) => {
  if (!_uid || !FIREBASE_ENABLED) return;
  const spaceId = useStore.getState().meta.spaceId;
  try {
    if (op === 'set')    await fsSet(col, data, _uid, spaceId);
    if (op === 'delete') await fsDelete(col, data.id as string, _uid, spaceId);
  } catch (err) {
    console.warn('[SUT sync]', op, col, err);
  }
};

/* ── Real-time listeners ─────────────────────────────────────────────────── */

/**
 * Start onSnapshot listeners for all four collections.
 * Any existing listeners are torn down first.
 * Works for both personal (spaceId=null) and space (spaceId set) modes.
 *
 * If any listener fails with permission-denied (e.g. stale spaceId — user
 * was removed from the space), we automatically fall back to personal data.
 */
export const subscribeToData = (uid: string, spaceId: string | null) => {
  unsubscribeFromData(); // tear down previous listeners
  if (!FIREBASE_ENABLED) return;

  _uid = uid;
  const COLS = ['tasks', 'courses', 'tags', 'events'] as const;
  let permissionDeniedHandled = false;

  for (const col of COLS) {
    const unsub = fsSubscribe(col, uid, spaceId, items => {
      useStore.getState().hydrateCollection(col, items as AppState[typeof col]);
    }, (err) => {
      // If access to space is denied (kicked out / rules changed), fall back
      // to personal data. Only handle once across all 4 listeners.
      if (spaceId && !permissionDeniedHandled &&
          (err.code === 'permission-denied' || err.code === 'PERMISSION_DENIED')) {
        permissionDeniedHandled = true;
        console.warn('[SUT] Space access denied — falling back to personal data', err);
        useStore.getState().setSpaceId(null, '');
        subscribeToData(uid, null);
      }
    });
    _activeSubscriptions.push(unsub);
  }
};

/** Tear down all active Firestore listeners. */
export const unsubscribeFromData = () => {
  _activeSubscriptions.forEach(u => u());
  _activeSubscriptions = [];
};

/* ── One-shot helpers ────────────────────────────────────────────────────── */

/** Download all data once and hydrate the store (used as initial load). */
export const hydrateFromFirestore = async (uid: string) => {
  _uid = uid;
  const spaceId = useStore.getState().meta.spaceId;

  const [tasks, courses, tags, events] = await Promise.all([
    fsGetAll('tasks',   uid, spaceId),
    fsGetAll('courses', uid, spaceId),
    fsGetAll('tags',    uid, spaceId),
    fsGetAll('events',  uid, spaceId),
  ]);

  const hasRemoteData = tasks.length || courses.length || tags.length || events.length;

  if (hasRemoteData) {
    useStore.getState().hydrateFromRemote({
      ...useStore.getState(),
      tasks:   tasks   as AppState['tasks'],
      courses: courses as AppState['courses'],
      tags:    tags    as AppState['tags'],
      events:  events  as AppState['events'],
      meta: { ...useStore.getState().meta, uid },
    });
  } else {
    // First login with no remote data — push local data up
    await uploadLocalToFirestore(uid, spaceId);
  }
};

/** Push current local state to Firestore (first login or joining empty space). */
export const uploadLocalToFirestore = async (
  uid: string,
  spaceId: string | null = null,
) => {
  const state = useStore.getState();
  for (const col of ['tasks', 'courses', 'tags', 'events'] as const) {
    for (const docData of state[col]) {
      await fsSet(col, docData as unknown as Record<string, unknown>, uid, spaceId)
        .catch(console.warn);
    }
  }
};

/* ── Initialisation ──────────────────────────────────────────────────────── */

/** Register the write hook in the store (call once at app startup). */
export const initSync = () => {
  useStore.getState().registerSyncHook(syncHook);
};

export const initAuth = (
  onLogin?:  (user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }) => void,
  onLogout?: () => void,
) => {
  if (!FIREBASE_ENABLED) return;

  const auth = getFirebaseAuth();

  // Handle redirect result (mobile/PWA Google login)
  handleRedirectResult().then(user => {
    if (user) {
      setSyncUid(user.uid);
      useStore.setState(s => ({
        meta: { ...s.meta, uid: user.uid, email: user.email, displayName: user.displayName },
      }));
    }
  }).catch(console.warn);

  // Main auth listener
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      setSyncUid(user.uid);
      useStore.setState(s => ({
        meta: { ...s.meta, uid: user.uid, email: user.email, displayName: user.displayName },
      }));

      // 1. One-shot initial load (handles first-login upload)
      await hydrateFromFirestore(user.uid);

      // 2. Start real-time listeners (personal or space, whichever is active)
      const spaceId = useStore.getState().meta.spaceId;
      subscribeToData(user.uid, spaceId);

      onLogin?.({
        uid:         user.uid,
        email:       user.email,
        displayName: user.displayName,
        photoURL:    user.photoURL,
      });
    } else {
      setSyncUid(null);
      unsubscribeFromData();
      onLogout?.();
    }
  });
};

export { loginWithGoogle, logoutFirebase };

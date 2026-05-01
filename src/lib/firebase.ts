import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  onSnapshot,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  type FirebaseStorage,
} from 'firebase/storage';

const firebaseConfig = {
  apiKey:            'AIzaSyAdVgc9pP3zbE-O6FS3gOB9tFCdVxdq9rU',
  authDomain:        'sut1-afd4f.firebaseapp.com',
  projectId:         'sut1-afd4f',
  storageBucket:     'sut1-afd4f.firebasestorage.app',
  messagingSenderId: '564912488525',
  appId:             '1:564912488525:web:90c1d442061c4013071c04',
};

export const FIREBASE_ENABLED = true;

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;

const getApp = (): FirebaseApp => {
  if (!_app) {
    _app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  }
  return _app;
};

export const getDB = (): Firestore => {
  if (!_db) _db = getFirestore(getApp());
  return _db;
};

export const getStorageBucket = (): FirebaseStorage => {
  if (!_storage) _storage = getStorage(getApp());
  return _storage;
};

export const getFirebaseAuth = () => getAuth(getApp());

export const getGoogleProvider = () => {
  const p = new GoogleAuthProvider();
  p.addScope('email');
  p.addScope('profile');
  return p;
};

const isMobileOrStandalone = () => {
  const ua = navigator.userAgent || '';
  const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return mobile || standalone;
};

export const loginWithGoogle = async (): Promise<User | null> => {
  const auth = getFirebaseAuth();
  const provider = getGoogleProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (err: unknown) {
    const firebaseErr = err as { code?: string };
    if (firebaseErr.code === 'auth/popup-blocked' || firebaseErr.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return null;
    }
    if (firebaseErr.code !== 'auth/popup-closed-by-user') throw err;
    return null;
  }
};

export const handleRedirectResult = async (): Promise<User | null> => {
  try {
    const result = await getRedirectResult(getFirebaseAuth());
    return result?.user ?? null;
  } catch {
    return null;
  }
};

export const logoutFirebase = () => signOut(getFirebaseAuth());
export { onAuthStateChanged, getFirebaseAuth as auth };

/* ── Firestore helpers ── */

export const dataPath = (col: string, uid: string, spaceId: string | null) =>
  spaceId ? `spaces/${spaceId}/${col}` : `users/${uid}/${col}`;

export const fsSet = async (col: string, docData: Record<string, unknown>, uid: string, spaceId: string | null) => {
  const db = getDB();
  const path = dataPath(col, uid, spaceId);
  await setDoc(doc(db, path, docData.id as string), docData, { merge: true });
};

export const fsDelete = async (col: string, id: string, uid: string, spaceId: string | null) => {
  const db = getDB();
  await deleteDoc(doc(db, dataPath(col, uid, spaceId), id));
};

export const fsGetAll = async (col: string, uid: string, spaceId: string | null): Promise<unknown[]> => {
  const db = getDB();
  const snap = await getDocs(collection(db, dataPath(col, uid, spaceId)));
  return snap.docs.map(d => d.data());
};

/* ── Firebase Storage helpers ── */

/**
 * Upload an audio blob to Firebase Storage and return the public download URL.
 * Path format: users/{uid}/audio/{id}.webm  |  spaces/{spaceId}/audio/{id}.webm
 */
export const uploadAudio = async (
  blob: Blob,
  uid: string,
  spaceId: string | null,
  audioId: string,
): Promise<string> => {
  const storage = getStorageBucket();
  const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm';
  const path = spaceId
    ? `spaces/${spaceId}/audio/${audioId}.${ext}`
    : `users/${uid}/audio/${audioId}.${ext}`;
  const sRef = storageRef(storage, path);
  await uploadBytes(sRef, blob, { contentType: blob.type || 'audio/webm' });
  return getDownloadURL(sRef);
};

/**
 * Subscribe to a collection in real-time. Returns an unsubscribe function.
 * Fires immediately with current data, then on every remote change.
 * @param onError Optional handler for Firestore errors (e.g. permission-denied).
 *                Receives the FirestoreError. Defaults to a console.warn.
 */
export const fsSubscribe = (
  col: string,
  uid: string,
  spaceId: string | null,
  onData: (items: unknown[]) => void,
  onError?: (err: { code: string; message: string }) => void,
): Unsubscribe => {
  const db = getDB();
  return onSnapshot(
    collection(db, dataPath(col, uid, spaceId)),
    snap => onData(snap.docs.map(d => d.data())),
    err => {
      if (onError) onError(err);
      else console.warn('[SUT fsSubscribe]', col, err.code, err.message);
    },
  );
};

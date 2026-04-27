/**
 * SYNC — capa de sincronización entre localStorage y Firestore.
 * Se engancha al store via `registerSyncHook`.
 * Cuando el usuario inicia sesión, descarga sus datos de Firestore
 * y los hidrata en el store. Cada cambio local se sincroniza en tiempo real.
 */

import { FIREBASE_ENABLED, firebaseConfig } from './firebase-config.js';
import { store } from './store.js';

let _db  = null;
let _uid = null;

export const setSyncUid = (uid) => { _uid = uid; };

/* ── Inicialización lazy ─────────────────────────────────────── */
const initFirestore = async () => {
  if (!FIREBASE_ENABLED || firebaseConfig.apiKey === 'TU_API_KEY') return null;
  if (_db) return _db;
  try {
    const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getFirestore }           = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    _db = getFirestore(app);
    return _db;
  } catch (err) {
    console.warn('[SUT] Firestore no disponible:', err.message);
    return null;
  }
};

/* ── Helpers Firestore ───────────────────────────────────────── */

/**
 * Devuelve la ruta de colección según si hay un espacio activo.
 * Con espacio: spaces/{spaceId}/{col}
 * Sin espacio: users/{uid}/{col}  (fallback personal)
 */
const dataPath = (col) => {
  const sid = store.state.meta?.spaceId;
  return sid ? `spaces/${sid}/${col}` : `users/${_uid}/${col}`;
};

const fsSet = async (col, doc) => {
  if (!_db || !_uid) return;
  const { doc: fsDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  await setDoc(fsDoc(_db, dataPath(col), doc.id), doc, { merge: true });
};

const fsDelete = async (col, id) => {
  if (!_db || !_uid) return;
  const { doc: fsDoc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  await deleteDoc(fsDoc(_db, dataPath(col), id));
};

const fsGetAll = async (col) => {
  if (!_db || !_uid) return [];
  const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const snap = await getDocs(collection(_db, dataPath(col)));
  return snap.docs.map(d => d.data());
};

/* ── Hook de sincronización ──────────────────────────────────── */
const syncHook = async (op, col, data) => {
  if (!_db || !_uid) return;
  if (op === 'set')    await fsSet(col, data);
  if (op === 'delete') await fsDelete(col, data.id);
};

/* ── Descarga datos del usuario desde Firestore ─────────────── */
export const hydrateFromFirestore = async (uid) => {
  _uid = uid;
  const db = await initFirestore();
  if (!db) return;

  const [tasks, courses, tags, events] = await Promise.all([
    fsGetAll('tasks'), fsGetAll('courses'), fsGetAll('tags'), fsGetAll('events'),
  ]);

  if (tasks.length || courses.length || tags.length || events.length) {
    store.hydrateFromRemote({
      ...store.state,
      tasks, courses, tags, events,
      meta: { ...store.state.meta, uid },
    });
  } else {
    // Primera vez con este usuario en Firebase: sube datos locales
    await uploadLocalToFirestore(uid);
  }
};

/* ── Sube datos locales → Firestore (primera vez) ─────────────── */
const uploadLocalToFirestore = async (uid) => {
  _uid = uid;
  if (!_db) return;
  const cols = ['tasks', 'courses', 'tags', 'events'];
  for (const col of cols) {
    for (const doc of (store.state[col] || [])) {
      await fsSet(col, doc).catch(console.warn);
    }
  }
};

/* ── Init ────────────────────────────────────────────────────── */
export const initSync = async () => {
  await initFirestore();
  store.registerSyncHook(syncHook);
};

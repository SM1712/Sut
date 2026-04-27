/**
 * SPACES — espacios compartidos en tiempo real.
 * Un espacio es un workspace de Firestore donde un grupo comparte
 * tareas, cursos, eventos y etiquetas. El código de 6 caracteres
 * permite que otros se unan fácilmente.
 *
 * Flujo:
 *  1. Usuario inicia sesión con Google
 *  2. Se busca si ya tiene un spaceId guardado (Firestore profile)
 *  3. Si no tiene → se muestra el modal (obligatorio, sin X)
 *  4. Si crea o se une → todos los datos se leen/escriben del espacio
 */

import { FIREBASE_ENABLED, firebaseConfig } from './firebase-config.js';
import { store } from './store.js';
import { $, escapeHTML } from './utils.js';
import { toast } from './toasts.js';

/* ─── Estado del módulo ────────────────────────────────────────── */
let _db   = null;
let _user = null;      // objeto Firebase User actual

/* ─── Firebase lazy ────────────────────────────────────────────── */
const getDB = async () => {
  if (_db) return _db;
  if (!FIREBASE_ENABLED || firebaseConfig.apiKey === 'TU_API_KEY') return null;
  try {
    const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getFirestore }           = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    _db = getFirestore(app);
    return _db;
  } catch (err) {
    console.warn('[Spaces] Firestore no disponible:', err.message);
    return null;
  }
};

/* ─── Helpers ──────────────────────────────────────────────────── */

/** Genera un código de espacio de 6 chars (fácil de compartir). */
const genCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin I/O/1/0 para evitar confusión
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

/** Actualiza el contexto del usuario actual (llamado desde app.js al login). */
export const setSpaceUser = (user) => { _user = user; };

/* ─── Perfil de usuario (guarda spaceId en Firestore) ─────────── */

/** Lee el spaceId que el usuario guardó en su perfil de Firestore. */
export const getUserSpaceId = async (uid) => {
  const db = await getDB();
  if (!db) return store.state.meta.spaceId || null;
  try {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const snap = await getDoc(doc(db, 'users', uid, '_profile', 'data'));
    return snap.exists() ? (snap.data().spaceId || null) : null;
  } catch { return store.state.meta.spaceId || null; }
};

/** Persiste el spaceId en el perfil Firestore del usuario. */
const saveUserProfile = async (uid, data) => {
  const db = await getDB();
  if (!db) return;
  const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  await setDoc(doc(db, 'users', uid, '_profile', 'data'), data, { merge: true });
};

/* ─── Crear espacio ────────────────────────────────────────────── */
export const createSpace = async (name) => {
  const db = await getDB();
  if (!db || !_user) throw new Error('Debes iniciar sesión primero.');

  const code = genCode();
  const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  // Documento principal del espacio
  await setDoc(doc(db, 'spaces', code), {
    name,
    code,
    createdBy:     _user.uid,
    createdByName: _user.displayName || _user.email || 'Desconocido',
    createdAt:     new Date().toISOString(),
    memberUids:    [_user.uid],   // array de UIDs para reglas de seguridad
    members: [{
      uid:   _user.uid,
      email: _user.email,
      name:  _user.displayName,
      photo: _user.photoURL,
    }],
  });

  // Sube los datos locales al espacio recién creado
  await _uploadLocalToSpace(code, db);

  // Guarda referencia en el perfil del usuario
  await saveUserProfile(_user.uid, { spaceId: code, spaceName: name });

  // Actualiza el store
  store.setSpaceId(code, name);
  return code;
};

/* ─── Unirse a espacio ─────────────────────────────────────────── */
export const joinSpace = async (rawCode) => {
  const db = await getDB();
  if (!db || !_user) throw new Error('Debes iniciar sesión primero.');

  const code = rawCode.toUpperCase().trim();
  const { doc, getDoc, updateDoc, arrayUnion } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  const snap = await getDoc(doc(db, 'spaces', code));
  if (!snap.exists()) throw new Error('Código de espacio no encontrado. ¿Está escrito correctamente?');

  const spaceData = snap.data();

  // Añade al usuario como miembro (idempotente)
  await updateDoc(doc(db, 'spaces', code), {
    memberUids: arrayUnion(_user.uid),
    members:    arrayUnion({
      uid:   _user.uid,
      email: _user.email,
      name:  _user.displayName,
      photo: _user.photoURL,
    }),
  });

  // Guarda en perfil del usuario
  await saveUserProfile(_user.uid, { spaceId: code, spaceName: spaceData.name });

  // Actualiza store
  store.setSpaceId(code, spaceData.name);
  return spaceData;
};

/* ─── Hidrata el store desde un espacio ────────────────────────── */
export const hydrateFromSpace = async (spaceId) => {
  const db = await getDB();
  if (!db) return;

  const { collection, getDocs, doc, getDoc } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  const getAll = async (col) => {
    try {
      const snap = await getDocs(collection(db, 'spaces', spaceId, col));
      return snap.docs.map(d => d.data());
    } catch { return []; }
  };

  const [tasks, courses, tags, events, infoSnap] = await Promise.all([
    getAll('tasks'), getAll('courses'), getAll('tags'), getAll('events'),
    getDoc(doc(db, 'spaces', spaceId)),
  ]);

  const spaceName = infoSnap.exists() ? infoSnap.data().name : 'Mi Espacio';
  store.setSpaceId(spaceId, spaceName);

  // Si remoto está completamente vacío pero local tiene datos, NO pisamos:
  // el sync hook irá subiendo los cambios locales al espacio. Esto evita que
  // un reload tras crear un espacio borre todo lo local por race de Firestore.
  const remoteEmpty = !tasks.length && !courses.length && !tags.length && !events.length;
  const localHas    = (store.state.tasks.length || store.state.courses.length ||
                       store.state.tags.length  || store.state.events.length);
  if (remoteEmpty && localHas) {
    // Sube lo local al espacio para sembrarlo
    await _uploadLocalToSpace(spaceId, db);
    return;
  }

  store.hydrateFromRemote({
    ...store.state,
    tasks, courses, tags, events,
    meta: { ...store.state.meta, uid: _user?.uid || store.state.meta.uid, spaceId, spaceName },
  });
};

/* ─── Sube datos locales al espacio ───────────────────────────── */
const _uploadLocalToSpace = async (spaceId, db) => {
  const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const cols = ['tasks', 'courses', 'tags', 'events'];
  for (const col of cols) {
    for (const item of (store.state[col] || [])) {
      await setDoc(doc(db, 'spaces', spaceId, col, item.id), item, { merge: true })
        .catch(console.warn);
    }
  }
};

/* ─── Chip del espacio en el sidebar ──────────────────────────── */
export const renderSpaceChip = () => {
  const chip = $('#space-chip');
  if (!chip) return;
  const { spaceId, spaceName } = store.state.meta;
  if (spaceId) {
    chip.hidden = false;
    chip.querySelector('.space-chip__name').textContent = spaceName || 'Mi Espacio';
    chip.querySelector('.space-chip__code').textContent = spaceId;
  } else {
    chip.hidden = true;
  }
};

/* ─── Modal de espacio ─────────────────────────────────────────── */
export const showSpaceModal = () => {
  const modal = $('#space-modal');
  if (!modal) return;
  modal.hidden = false;
  // Asegura que empieza en "Crear"
  _switchTab('create');
};

export const hideSpaceModal = () => {
  const modal = $('#space-modal');
  if (modal) modal.hidden = true;
};

const _switchTab = (tab) => {
  const isCreate = tab === 'create';
  $('#space-tab-create')?.classList.toggle('is-active', isCreate);
  $('#space-tab-join')?.classList.toggle('is-active', !isCreate);
  if ($('#space-panel-create')) $('#space-panel-create').hidden = !isCreate;
  if ($('#space-panel-join'))   $('#space-panel-join').hidden   = isCreate;
};

/* ─── Init (llamado una sola vez en boot) ─────────────────────── */
export const initSpaces = () => {

  // Tabs
  $('#space-tab-create')?.addEventListener('click', () => _switchTab('create'));
  $('#space-tab-join')?.addEventListener('click',   () => _switchTab('join'));

  // Crear espacio
  $('#space-create-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#space-name-input')?.value.trim();
    if (!name) return;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = 'Creando…';
    try {
      const code = await createSpace(name);
      hideSpaceModal();
      renderSpaceChip();
      toast(
        `Espacio creado. Comparte el código: <strong style="font-family:monospace;letter-spacing:.12em">${code}</strong>`,
        { type: 'success', duration: 8000, html: true }
      );
    } catch (err) {
      toast('Error: ' + err.message, { type: 'danger' });
      btn.disabled = false;
      btn.textContent = orig;
    }
  });

  // Unirse a espacio
  $('#space-join-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = $('#space-code-input')?.value.trim();
    if (!code) return;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = 'Uniéndome…';
    try {
      const info = await joinSpace(code);
      await hydrateFromSpace(code.toUpperCase());
      hideSpaceModal();
      renderSpaceChip();
      toast(`¡Te uniste al espacio "${info.name}"! 🎉`, { type: 'success' });
    } catch (err) {
      toast('Error: ' + err.message, { type: 'danger' });
      btn.disabled = false;
      btn.textContent = orig;
    }
  });

  // Chip → copiar código
  $('#space-chip')?.addEventListener('click', () => {
    const code = store.state.meta.spaceId;
    if (!code) return;
    navigator.clipboard?.writeText(code).then(() => {
      toast(`Código "${code}" copiado al portapapeles`, { type: 'success' });
    });
  });

  // Botón Google en onboarding
  $('#ob-google-btn')?.addEventListener('click', async () => {
    const { loginWithGoogle } = await import('./auth.js');
    await loginWithGoogle();
  });

  // Render inicial del chip (si ya hay un espacio guardado en localStorage)
  renderSpaceChip();
};

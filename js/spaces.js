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
import { confirmDialog } from './confirm.js';

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

  // Chip → abrir admin del espacio (incluye copiar código, miembros, salir, etc.)
  $('#space-chip')?.addEventListener('click', () => {
    if (store.state.meta.spaceId) showSpaceAdmin();
  });

  // Botón Google en onboarding
  $('#ob-google-btn')?.addEventListener('click', async () => {
    const { loginWithGoogle } = await import('./auth.js');
    await loginWithGoogle();
  });

  // Render inicial del chip (si ya hay un espacio guardado en localStorage)
  renderSpaceChip();

  // Init del admin modal
  initSpaceAdmin();
};

/* ═══════════════════════════════════════════════════════════════
   ADMIN DE ESPACIOS — ver miembros, renombrar, salir, eliminar
   ═══════════════════════════════════════════════════════════════ */

/** Lee el documento del espacio (incluye members[], createdBy, name). */
const fetchSpaceData = async (spaceId) => {
  const db = await getDB();
  if (!db) return null;
  const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const snap = await getDoc(doc(db, 'spaces', spaceId));
  return snap.exists() ? snap.data() : null;
};

/** Renombra el espacio (solo el creador). */
const updateSpaceName = async (spaceId, newName) => {
  const db = await getDB();
  if (!db) throw new Error('Firebase no disponible');
  const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  await updateDoc(doc(db, 'spaces', spaceId), { name: newName });
  store.setSpaceId(spaceId, newName);
  if (_user) await saveUserProfile(_user.uid, { spaceId, spaceName: newName });
};

/** Salir del espacio: elimina al usuario de members[] y limpia local. */
const leaveSpace = async (spaceId) => {
  const db = await getDB();
  if (!db || !_user) throw new Error('Sesión requerida');
  const { doc, getDoc, updateDoc } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  const ref  = doc(db, 'spaces', spaceId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    const members    = (data.members    || []).filter(m => m.uid !== _user.uid);
    const memberUids = (data.memberUids || []).filter(u => u !== _user.uid);
    await updateDoc(ref, { members, memberUids });
  }
  // Limpia el spaceId del perfil del usuario
  await saveUserProfile(_user.uid, { spaceId: null, spaceName: '' });
  // Limpia local: el usuario sigue logueado pero sin espacio
  store.clearSessionAndSpace();
  // Re-aplica el uid (no hicimos logout de Firebase Auth)
  store.state.meta.uid   = _user.uid;
  store.state.meta.email = _user.email;
};

/** Elimina el espacio entero (solo creador). Borra subcolecciones. */
const deleteSpace = async (spaceId) => {
  const db = await getDB();
  if (!db || !_user) throw new Error('Sesión requerida');
  const { doc, deleteDoc, collection, getDocs, writeBatch } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  // Borra subcolecciones en lote (Firestore no las cascadea)
  for (const col of ['tasks', 'courses', 'tags', 'events']) {
    const snap  = await getDocs(collection(db, 'spaces', spaceId, col));
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    if (snap.size) await batch.commit();
  }
  await deleteDoc(doc(db, 'spaces', spaceId));
  await saveUserProfile(_user.uid, { spaceId: null, spaceName: '' });
  store.clearSessionAndSpace();
  store.state.meta.uid   = _user.uid;
  store.state.meta.email = _user.email;
};

/** Renderiza el contenido del modal admin. */
export const showSpaceAdmin = async () => {
  const modal = $('#space-admin-modal');
  const body  = $('#space-admin-body');
  if (!modal || !body) return;

  const spaceId = store.state.meta.spaceId;
  if (!spaceId) {
    toast('No estás en un espacio compartido', { type: 'info' });
    return;
  }

  modal.hidden = false;
  body.innerHTML = `<p style="text-align:center;color:var(--text-mute);padding:1.5rem">Cargando…</p>`;

  const data = await fetchSpaceData(spaceId);
  if (!data) {
    body.innerHTML = `<p style="text-align:center;color:var(--danger);padding:1rem">No se pudo cargar el espacio (¿borrado o sin conexión?).</p>`;
    return;
  }

  const isOwner = _user && data.createdBy === _user.uid;
  const members = data.members || [];

  body.innerHTML = `
    <section class="admin-section">
      <h3 class="admin-section__title">Información</h3>
      <div class="admin-info-grid">
        <label class="field">
          <span class="field__label">Nombre del espacio</span>
          <input class="input" id="admin-space-name" type="text" value="${escapeHTML(data.name || '')}" maxlength="40" ${isOwner ? '' : 'disabled'} />
        </label>
        <label class="field">
          <span class="field__label">Código (compartir)</span>
          <div class="admin-code">
            <code>${escapeHTML(data.code || spaceId)}</code>
            <button type="button" class="btn btn--ghost btn--sm" id="admin-copy-code">Copiar</button>
          </div>
        </label>
      </div>
      ${isOwner ? `<button type="button" class="btn btn--primary btn--sm" id="admin-save-name" disabled style="margin-top:.5rem">Guardar nombre</button>` : `<p class="field__hint">Solo quien creó el espacio puede renombrarlo.</p>`}
    </section>

    <section class="admin-section">
      <h3 class="admin-section__title">Miembros (${members.length})</h3>
      <ul class="member-list">
        ${members.map(m => `
          <li class="member">
            ${m.photo ? `<img class="member__avatar" src="${escapeHTML(m.photo)}" alt="" />` : `<span class="member__avatar member__avatar--placeholder">${escapeHTML((m.name||m.email||'?').slice(0,1).toUpperCase())}</span>`}
            <div class="member__info">
              <span class="member__name">${escapeHTML(m.name || m.email || 'Anónimo')}</span>
              <span class="member__meta">${escapeHTML(m.email || '')}${m.uid === data.createdBy ? ' · Creador' : ''}${_user && m.uid === _user.uid ? ' · Tú' : ''}</span>
            </div>
          </li>`).join('')}
      </ul>
    </section>

    <section class="admin-section admin-section--danger">
      <h3 class="admin-section__title">Zona peligrosa</h3>
      <div class="admin-actions">
        <button type="button" class="btn btn--ghost" id="admin-leave">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Salir del espacio
        </button>
        ${isOwner ? `<button type="button" class="btn btn--danger" id="admin-delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          Eliminar espacio
        </button>` : ''}
      </div>
      <p class="field__hint">Salir conserva el espacio para los demás miembros. Eliminar borra el espacio y todos sus datos para todos.</p>
    </section>
  `;

  // Wiring de acciones
  $('#admin-copy-code')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(data.code || spaceId)
      .then(() => toast('Código copiado', { type: 'success' }));
  });

  if (isOwner) {
    const nameInput = $('#admin-space-name');
    const saveBtn   = $('#admin-save-name');
    nameInput?.addEventListener('input', () => {
      saveBtn.disabled = !nameInput.value.trim() || nameInput.value.trim() === data.name;
    });
    saveBtn?.addEventListener('click', async () => {
      const newName = nameInput.value.trim();
      if (!newName) return;
      saveBtn.disabled = true; saveBtn.textContent = 'Guardando…';
      try {
        await updateSpaceName(spaceId, newName);
        toast('Nombre actualizado', { type: 'success' });
        renderSpaceChip();
        data.name = newName;
        saveBtn.textContent = 'Guardar nombre';
      } catch (err) {
        toast('Error: ' + err.message, { type: 'danger' });
        saveBtn.disabled = false; saveBtn.textContent = 'Guardar nombre';
      }
    });

    $('#admin-delete')?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: `¿Eliminar "${data.name}"?`,
        text: `Se borrará el espacio y TODOS sus datos (tareas, cursos, etiquetas, eventos) para los ${members.length} miembros. Esta acción es irreversible.`,
        confirmText: 'Eliminar para todos',
        icon: 'warn',
      });
      if (!ok) return;
      try {
        await deleteSpace(spaceId);
        toast('Espacio eliminado', { type: 'warn' });
        modal.hidden = true;
        renderSpaceChip();
        showSpaceModal();  // forzar a elegir/crear otro
      } catch (err) {
        toast('Error: ' + err.message, { type: 'danger' });
      }
    });
  }

  $('#admin-leave')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: '¿Salir del espacio?',
      text: 'Tus datos colaborativos se quedarán en el espacio para los demás. Tu copia local se limpiará y podrás unirte a otro espacio.',
      confirmText: 'Sí, salir',
    });
    if (!ok) return;
    try {
      await leaveSpace(spaceId);
      toast('Saliste del espacio', { type: 'info' });
      modal.hidden = true;
      renderSpaceChip();
      showSpaceModal();
    } catch (err) {
      toast('Error: ' + err.message, { type: 'danger' });
    }
  });
};

const initSpaceAdmin = () => {
  const modal = $('#space-admin-modal');
  modal?.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) modal.hidden = true;
  });
};

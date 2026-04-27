/**
 * AUTH — Login con Google vía Firebase Authentication.
 * Si Firebase no está configurado, opera en modo local silenciosamente.
 */

import { FIREBASE_ENABLED, firebaseConfig } from './firebase-config.js';
import { store } from './store.js';
import { setSyncUid } from './sync.js';
import { $, escapeHTML } from './utils.js';
import { toast } from './toasts.js';

let _auth     = null;
let _provider = null;
let _currentUser = null;

/* ── Inicialización lazy de Firebase ────────────────────────── */
const initFirebase = async () => {
  if (!FIREBASE_ENABLED || firebaseConfig.apiKey === 'TU_API_KEY') return null;
  try {
    const { initializeApp }           = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getAuth, GoogleAuthProvider } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');

    const app   = initializeApp(firebaseConfig);
    _auth       = getAuth(app);
    _provider   = new GoogleAuthProvider();
    _provider.addScope('email');
    _provider.addScope('profile');
    return _auth;
  } catch (err) {
    console.warn('[SUT] Firebase no disponible:', err.message);
    return null;
  }
};

/* ── Helpers UI ─────────────────────────────────────────────── */
export const renderUserBadge = (user) => {
  const badge = $('#user-badge');
  if (!badge) return;
  if (user) {
    badge.innerHTML = `
      <img class="user-avatar" src="${user.photoURL || ''}" alt="${escapeHTML(user.displayName||user.email)}" />
      <span class="user-name">${escapeHTML(user.displayName || user.email)}</span>
    `;
    badge.title = user.email;
    badge.hidden = false;
    $('#login-btn')?.setAttribute('hidden', '');
    $('#logout-btn')?.removeAttribute('hidden');
  } else {
    badge.hidden = true;
    $('#login-btn')?.removeAttribute('hidden');
    $('#logout-btn')?.setAttribute('hidden', '');
  }
};

/* ── Login / Logout ─────────────────────────────────────────── */
export const loginWithGoogle = async () => {
  if (!_auth) { toast('Firebase no configurado. Trabaja en modo local.', { type: 'info' }); return; }
  try {
    const { signInWithPopup } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    const result = await signInWithPopup(_auth, _provider);
    toast(`¡Bienvenido, ${result.user.displayName}! 👋`, { type: 'success' });
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      toast('Error al iniciar sesión: ' + err.message, { type: 'danger' });
    }
  }
};

export const logout = async () => {
  if (!_auth) return;
  try {
    const { signOut } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    await signOut(_auth);
    // Limpia identidad y desconecta del espacio compartido — sin esto, el sync
    // hook seguiría escribiendo a spaces/{id}/... después de cerrar sesión.
    setSyncUid(null);
    store.clearSessionAndSpace();
    renderUserBadge(null);
    toast('Sesión cerrada', { type: 'info' });
  } catch (err) {
    toast('Error al cerrar sesión', { type: 'danger' });
  }
};

export const getCurrentUser = () => _currentUser;

/* ── Init ────────────────────────────────────────────────────── */
export const initAuth = async (onLogin, onLogout) => {
  const auth = await initFirebase();

  $('#login-btn')?.addEventListener('click', loginWithGoogle);
  $('#logout-btn')?.addEventListener('click', logout);

  if (!auth) {
    renderUserBadge(null);
    return;
  }

  const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  onAuthStateChanged(auth, async (user) => {
    _currentUser = user;
    renderUserBadge(user);

    if (user) {
      store.state.meta.uid   = user.uid;
      store.state.meta.email = user.email;
      await onLogin?.(user);
    } else {
      await onLogout?.();
    }
  });
};

/**
 * APP.JS — punto de entrada del SUT.
 * Inicializa módulos, enruta vistas, reacciona al store y gestiona auth.
 */

import { store }          from './store.js';
import { $, $$ }          from './utils.js';
import { initTheme, applyAllSettings, closeSettings } from './theme.js';
import { initOnboarding, showOnboarding }  from './onboarding.js';
import { initTasks, renderDashboardTasks, renderTasksList,
         renderStats, renderGreeting, openTaskModal } from './tasks.js';
import { initCourses, renderCourses, renderCoursePills,
         populateCourseSelects }           from './courses.js';
import { initTags, renderTags, renderTagPicker } from './tags.js';
import { initCalendar, renderCalendar }    from './calendar.js';
import { initEvents }                      from './events.js';
import { initNotifications }               from './notifications.js';
import { initSearch }                      from './search.js';
import { toast }                           from './toasts.js';
import { initAuth }                        from './auth.js';
import { initSync, hydrateFromFirestore }  from './sync.js';
import { initSpaces, setSpaceUser, getUserSpaceId,
         hydrateFromSpace, renderSpaceChip,
         showSpaceModal }                  from './spaces.js';

/* ================================================================
   VISTAS
   ================================================================ */
let currentView = 'dashboard';

const showView = (name) => {
  $$('.view').forEach(v => v.classList.remove('is-active'));
  $$('.nav-item').forEach(n => n.classList.remove('is-active'));

  const view = $(`.view--${name}`);
  const nav  = $(`.nav-item[data-view="${name}"]`);
  if (view) view.classList.add('is-active');
  if (nav)  nav.classList.add('is-active');

  currentView = name;
  renderView(name);

  if (window.innerWidth <= 880) $('#app').classList.remove('is-sidebar-open');
};

const renderView = (name) => {
  if (name === 'dashboard') { renderGreeting(); renderStats(); renderDashboardTasks(); renderCoursePills(); }
  if (name === 'tasks')     { populateCourseSelects(); renderTasksList(); }
  if (name === 'courses')   { renderCourses(); }
  if (name === 'calendar')  { renderCalendar(); }
  if (name === 'tags')      { renderTags(); }
};

/* ================================================================
   NAVEGACIÓN
   ================================================================ */
const initNav = () => {
  $$('.nav-item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });
  $('#sidebar-toggle')?.addEventListener('click', () => {
    $('#app').classList.toggle('is-sidebar-open');
  });
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 880 && !e.target.closest('.sidebar') && !e.target.closest('#sidebar-toggle')) {
      $('#app').classList.remove('is-sidebar-open');
    }
  });
};

/* ================================================================
   REACTIVIDAD
   ================================================================ */
const bindStoreReactions = () => {
  store.on('change', () => {
    renderStats();
    renderView(currentView);
    populateCourseSelects();
    if (!$('#task-modal').hidden) {
      const currentSelected = JSON.parse($('#tag-picker').dataset.selected || '[]');
      renderTagPicker(currentSelected);
    }
  });
};

/* ================================================================
   DATA ACTIONS
   ================================================================ */
const initDataActions = () => {
  $('#export-data')?.addEventListener('click', () => {
    const json = store.exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `sut-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    toast('Datos exportados', { type: 'success' });
  });

  $('#import-data')?.addEventListener('click', () => $('#import-file').click());

  $('#import-file')?.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        store.importData(ev.target.result);
        applyAllSettings();
        renderView(currentView);
        toast('Datos importados correctamente', { type: 'success' });
      } catch { toast('Archivo inválido o corrupto', { type: 'danger' }); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  $('#reset-data')?.addEventListener('click', () => {
    if (confirm('¿Eliminar TODOS tus datos? Esta acción no se puede deshacer.')) {
      store.reset();
      applyAllSettings();
      renderView(currentView);
      toast('Datos restablecidos', { type: 'warn' });
    }
  });

  $('#replay-onboarding')?.addEventListener('click', () => { closeSettings(); setTimeout(showOnboarding, 200); });
  $('#open-help')?.addEventListener('click', showOnboarding);
};

/* ================================================================
   ATAJOS DE TECLADO
   ================================================================ */
const initKeyBindings = () => {
  document.addEventListener('keydown', (e) => {
    const inInput = e.target.matches('input, textarea, select, [contenteditable]');
    if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !inInput) { e.preventDefault(); openTaskModal(); }
    if (e.key === 'Escape') {
      $$('.modal:not([hidden]), .drawer:not([hidden])').forEach(m => {
        m.querySelector('[data-close]')?.click();
      });
    }
    if (!inInput && !e.ctrlKey && !e.metaKey) {
      const map = { '1':'dashboard','2':'tasks','3':'courses','4':'calendar','5':'tags' };
      if (map[e.key]) showView(map[e.key]);
    }
  });
};

/* ================================================================
   AUTH CALLBACKS
   ================================================================ */
const onLogin = async (user) => {
  toast(`Bienvenido, ${user.displayName} 👋`, { type: 'info', duration: 2000 });

  // Establece el usuario en el módulo de espacios
  setSpaceUser(user);

  // ¿Ya tiene un espacio asignado?
  const spaceId = store.state.meta.spaceId || await getUserSpaceId(user.uid);

  if (spaceId) {
    // Carga datos del espacio compartido
    await hydrateFromSpace(spaceId);
    renderSpaceChip();
  } else {
    // Primera vez: sube datos locales a cuenta personal y muestra modal de espacio
    await hydrateFromFirestore(user.uid);
    showSpaceModal();
  }

  renderView(currentView);
  renderStats();
};

const onLogout = async () => {
  renderSpaceChip();
  renderView(currentView);
};

/* ================================================================
   BOOT
   ================================================================ */
const boot = async () => {
  applyAllSettings();

  const app = $('#app');
  app.hidden = false;

  initTheme();
  initTasks();
  initCourses();
  initTags();
  initCalendar();
  initEvents();
  initNotifications();
  initNav();
  initSearch(() => currentView);
  initDataActions();
  initKeyBindings();
  bindStoreReactions();

  $('#new-task-btn-tasks')?.addEventListener('click', () => openTaskModal());

  store.seedSampleIfEmpty();
  populateCourseSelects();

  initOnboarding(() => { store.setOnboarded(true); renderView('dashboard'); });

  // Espacios compartidos (UI — sin usuario todavía)
  initSpaces();

  // Firebase (opera silenciosamente si no está configurado)
  await initSync();
  await initAuth(onLogin, onLogout);

  if (!store.state.meta.onboarded) {
    showOnboarding();
  } else {
    showView('dashboard');
  }

  // Tick de reloj
  setInterval(() => {
    renderStats();
    if (currentView === 'dashboard') renderDashboardTasks();
    if (currentView === 'tasks')     renderTasksList();
  }, 60000);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

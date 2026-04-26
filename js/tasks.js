/**
 * TASKS — render, filtros y modal de creación/edición.
 * Soporta prioridad escalante: la barra de color se ajusta
 * automáticamente según la proximidad de la fecha de vencimiento.
 */

import { store } from './store.js';
import { $, $$, escapeHTML, parseDue, relativeDue, fmtTime,
         computeEffectivePriority, escaladeLabel } from './utils.js';
import { toast } from './toasts.js';
import { renderTagPicker, getPickerSelection } from './tags.js';

const PRIORITY_ORDER  = { urgent: 0, high: 1, medium: 2, low: 3 };
const PRIORITY_LABELS = { urgent: 'Urgente', high: 'Alta', medium: 'Media', low: 'Baja' };
const PRIORITY_ICONS  = { urgent: '⚡', high: '🔴', medium: '🟡', low: '🟢' };

const modal = $('#task-modal');
const form  = $('#task-form');

let editingId = null;
let dashboardFilter = 'all';

/* ── Filtros ─────────────────────────────────────────────────── */
const matchesFilter = (t, filter) => {
  if (filter === 'all') return !t.done;
  const due = parseDue(t.dueDate, t.dueTime);
  const now = new Date();
  if (filter === 'today')   return due && due.toDateString() === now.toDateString() && !t.done;
  if (filter === 'week')    { const w = new Date(now); w.setDate(now.getDate()+7); return due && due>=now && due<=w && !t.done; }
  if (filter === 'overdue') return due && due < now && !t.done;
  return true;
};

const sortTasks = (list, mode) => {
  const arr = [...list];
  if (mode === 'priority') {
    arr.sort((a, b) =>
      PRIORITY_ORDER[computeEffectivePriority(a)] - PRIORITY_ORDER[computeEffectivePriority(b)]);
  } else if (mode === 'created') {
    arr.sort((a, b) => (b.createdAt||'').localeCompare(a.createdAt||''));
  } else if (mode === 'alpha') {
    arr.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    arr.sort((a, b) => {
      const da = parseDue(a.dueDate, a.dueTime), db = parseDue(b.dueDate, b.dueTime);
      if (!da && !db) return 0; if (!da) return 1; if (!db) return -1;
      return da - db;
    });
  }
  return arr;
};

/* ── Card render ─────────────────────────────────────────────── */
const renderTaskCard = (t) => {
  const course  = store.state.courses.find(c => c.id === t.courseId);
  const tags    = (t.tagIds||[]).map(id => store.state.tags.find(x => x.id===id)).filter(Boolean);
  const due     = parseDue(t.dueDate, t.dueTime);
  const rel     = relativeDue(due);

  /* Prioridad efectiva (escalante o fija) */
  const effPrio   = computeEffectivePriority(t);
  const escalLabel = escaladeLabel(t);

  const card = document.createElement('article');
  card.className = 'task-card' + (t.done ? ' is-done' : '');
  card.dataset.id = t.id;
  card.role = 'listitem';

  const courseHTML = course
    ? `<span class="course-pill" style="--c:${course.color}">${escapeHTML(course.name)}</span>` : '';
  const tagsHTML = tags.map(g =>
    `<span class="tag-pill" style="--c:${g.color}">${escapeHTML(g.name)}</span>`).join('');
  const dueClass  = rel.state==='overdue' ? ' is-overdue' : rel.state==='soon' ? ' is-soon' : '';
  const dueHTML   = due
    ? `<span class="task-card__due${dueClass}">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
         ${escapeHTML(rel.text)}</span>` : '';
  const escalHTML = escalLabel
    ? `<span class="task-card__escalade" title="Prioridad base: ${PRIORITY_LABELS[t.priority||'medium']}">${escalLabel}</span>` : '';
  const creatorHTML = t.createdBy
    ? `<span class="task-card__creator" title="Creado por ${t.createdBy}">👤 ${t.createdBy.split('@')[0]}</span>` : '';

  card.innerHTML = `
    <span class="task-card__bar prio-${effPrio}"></span>
    <button class="task-check ${t.done ? 'is-checked' : ''}" aria-label="Marcar como completada">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-9"/></svg>
    </button>
    <div class="task-card__body">
      <div class="task-card__title" title="${escapeHTML(t.title)}">${escapeHTML(t.title)}</div>
      <div class="task-card__meta">
        ${dueHTML}
        ${courseHTML ? '<span class="task-card__meta-sep"></span>'+courseHTML : ''}
        ${tagsHTML  ? '<span class="task-card__meta-sep"></span>'+tagsHTML  : ''}
        ${escalHTML ? '<span class="task-card__meta-sep"></span>'+escalHTML : ''}
        ${creatorHTML ? '<span class="task-card__meta-sep"></span>'+creatorHTML : ''}
      </div>
    </div>
    <div class="task-card__actions">
      <button class="icon-btn icon-btn--ghost" data-action="edit" aria-label="Editar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
      </button>
    </div>
  `;

  card.querySelector('.task-check').addEventListener('click', (e) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    btn.classList.add('pop'); setTimeout(() => btn.classList.remove('pop'), 320);
    store.toggleTask(t.id);
    toast(!t.done ? '¡Tarea completada! 🎉' : 'Tarea reabierta', { type: 'success' });
  });
  card.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
    e.stopPropagation(); openTaskModal(t.id);
  });
  card.querySelector('.task-card__title').addEventListener('click', () => openTaskModal(t.id));

  return card;
};

const renderEmpty = (host, title, text) => {
  const tpl = $('#empty-state-template').content.cloneNode(true);
  if (title) tpl.querySelector('.empty__title').textContent = title;
  if (text)  tpl.querySelector('.empty__text').textContent  = text;
  host.appendChild(tpl);
};

/* ── Listas ──────────────────────────────────────────────────── */
export const renderDashboardTasks = (searchTerm = '') => {
  const host = $('#dashboard-task-list');
  if (!host) return;
  let list = store.state.tasks.filter(t => matchesFilter(t, dashboardFilter));
  if (searchTerm) {
    const q = searchTerm.toLowerCase();
    list = list.filter(t => t.title.toLowerCase().includes(q) || (t.description||'').toLowerCase().includes(q));
  }
  list = sortTasks(list, 'date').slice(0, 8);
  host.innerHTML = '';
  if (!list.length) { renderEmpty(host, 'Nada en este filtro', 'Crea una tarea con "+ Nueva tarea".'); return; }
  list.forEach(t => host.appendChild(renderTaskCard(t)));
};

export const renderTasksList = (searchTerm = '') => {
  const host = $('#tasks-list');
  if (!host) return;
  const courseFilter = $('#filter-course').value;
  const prioFilter   = $('#filter-priority').value;
  const statusFilter = $('#filter-status').value;
  const sortBy       = $('#sort-by').value || 'date';

  let list = [...store.state.tasks];
  if (courseFilter) list = list.filter(t => t.courseId === courseFilter);
  if (prioFilter)   list = list.filter(t => computeEffectivePriority(t) === prioFilter);
  if (statusFilter === 'pending') list = list.filter(t => !t.done);
  if (statusFilter === 'done')    list = list.filter(t => t.done);
  if (searchTerm) { const q = searchTerm.toLowerCase(); list = list.filter(t => t.title.toLowerCase().includes(q)); }
  list = sortTasks(list, sortBy);
  host.innerHTML = '';
  if (!list.length) { renderEmpty(host, 'Sin resultados', 'Prueba otros filtros o crea una tarea.'); return; }
  list.forEach(t => host.appendChild(renderTaskCard(t)));
};

/* ── Stats ───────────────────────────────────────────────────── */
export const renderStats = () => {
  const tasks = store.state.tasks;
  const now   = new Date();

  const dueToday  = tasks.filter(t => { const d = parseDue(t.dueDate,t.dueTime); return d && !t.done && d.toDateString()===now.toDateString(); }).length;
  const overdue   = tasks.filter(t => { const d = parseDue(t.dueDate,t.dueTime); return d && !t.done && d < now; }).length;
  const sevenAgo  = new Date(now); sevenAgo.setDate(now.getDate()-7);
  const doneWeek  = tasks.filter(t => t.done && t.completedAt && new Date(t.completedAt) >= sevenAgo).length;

  $('[data-stat="due-today"]').textContent = dueToday;
  $('[data-stat="overdue"]').textContent   = overdue;
  $('[data-stat="done-week"]').textContent = doneWeek;
  $('[data-stat="courses"]').textContent   = store.state.courses.length;
  $('[data-badge="tasks"]').textContent    = tasks.filter(t => !t.done).length;

  const counts = { low:0, medium:0, high:0, urgent:0 };
  tasks.filter(t => !t.done).forEach(t => { counts[computeEffectivePriority(t)]++; });
  $$('#priority-summary [data-priority]').forEach(el => {
    el.querySelector('.priority-summary__count').textContent = counts[el.dataset.priority] || 0;
  });
};

/* ── Saludo ──────────────────────────────────────────────────── */
export const renderGreeting = () => {
  const h = new Date().getHours();
  const greet = h<6 ? 'Buenas noches' : h<13 ? 'Buen día' : h<19 ? 'Buenas tardes' : 'Buenas noches';
  $('#greeting').textContent = `${greet} ✨`;
  const tasks   = store.state.tasks;
  const pending = tasks.filter(t => !t.done).length;
  const od      = tasks.filter(t => { const d=parseDue(t.dueDate,t.dueTime); return d && !t.done && d < new Date(); }).length;
  let sub = od ? `Tienes ${od} tarea${od>1?'s':''} atrasada${od>1?'s':''}.`
          : pending === 0 ? 'Estás al día. ¡Disfruta el descanso!'
          : `Tienes ${pending} tarea${pending>1?'s':''} pendiente${pending>1?'s':''}.`;
  $('#greeting-sub').textContent = sub;
};

/* ── Modal ───────────────────────────────────────────────────── */
export const openTaskModal = (id = null) => {
  editingId = id;
  form.reset();
  $('#task-modal-title').textContent = id ? 'Editar tarea' : 'Nueva tarea';
  $('#delete-task').hidden = !id;

  /* Callback: cuando una etiqueta sugiere prioridad */
  const onPriorityHint = (prio, tagName) => {
    const current = form.querySelector('input[name="priority"]:checked')?.value || 'low';
    const order = { low:0, medium:1, high:2, urgent:3 };
    if (order[prio] > order[current]) {
      const radio = form.querySelector(`input[name="priority"][value="${prio}"]`);
      if (radio) {
        radio.checked = true;
        toast(`💡 Prioridad sugerida por etiqueta "${tagName}": ${PRIORITY_LABELS[prio]}`, { duration: 3000 });
        // Animar el picker
        radio.closest('.prio-opt')?.classList.add('shake');
        setTimeout(() => radio.closest('.prio-opt')?.classList.remove('shake'), 400);
      }
    }
  };

  if (id) {
    const t = store.state.tasks.find(x => x.id === id);
    form.id.value          = t.id;
    form.title.value       = t.title;
    form.description.value = t.description || '';
    form.courseId.value    = t.courseId || '';
    form.dueDate.value     = t.dueDate  || '';
    form.dueTime.value     = t.dueTime  || '';
    form.reminder.value    = t.reminder || '';
    const pRadio = form.querySelector(`input[name="priority"][value="${t.priority||'medium'}"]`);
    if (pRadio) pRadio.checked = true;
    // Escalante
    const escToggle = form.querySelector('#escalating-toggle');
    if (escToggle) escToggle.checked = !!t.escalating;
    renderTagPicker(t.tagIds || [], onPriorityHint);
  } else {
    const pRadio = form.querySelector('input[name="priority"][value="medium"]');
    if (pRadio) pRadio.checked = true;
    const escToggle = form.querySelector('#escalating-toggle');
    if (escToggle) escToggle.checked = false;
    renderTagPicker([], onPriorityHint);
  }

  modal.hidden = false;
  setTimeout(() => form.title.focus(), 80);
};

const closeModal = () => { modal.hidden = true; editingId = null; };

/* ── Init ────────────────────────────────────────────────────── */
export const initTasks = () => {
  $('#new-task-btn')?.addEventListener('click', () => openTaskModal());

  modal.addEventListener('click', (e) => {
    if (e.target.matches('[data-close]')) closeModal();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data   = Object.fromEntries(new FormData(form));
    if (!data.title?.trim()) return;
    const tagIds = getPickerSelection();
    const escToggle = form.querySelector('#escalating-toggle');
    store.upsertTask({
      id:          data.id || null,
      title:       data.title.trim(),
      description: data.description?.trim() || '',
      courseId:    data.courseId || '',
      tagIds,
      priority:    data.priority || 'medium',
      escalating:  escToggle?.checked ?? false,
      dueDate:     data.dueDate || '',
      dueTime:     data.dueTime || '',
      reminder:    data.reminder || '',
    });
    toast(data.id ? 'Tarea actualizada' : 'Tarea creada', { type: 'success' });
    closeModal();
  });

  $('#delete-task').addEventListener('click', () => {
    if (!editingId) return;
    if (confirm('¿Eliminar esta tarea?')) {
      store.deleteTask(editingId);
      toast('Tarea eliminada', { type: 'warn' });
      closeModal();
    }
  });

  // Filtros del dashboard (chips)
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip[data-filter]');
    if (!chip) return;
    $$('.chip[data-filter]').forEach(c => c.classList.remove('is-active'));
    chip.classList.add('is-active');
    dashboardFilter = chip.dataset.filter;
    renderDashboardTasks();
  });

  // Filtros pestaña tareas
  ['filter-course','filter-priority','filter-status','sort-by'].forEach(id => {
    $('#' + id)?.addEventListener('change', () => renderTasksList());
  });
};

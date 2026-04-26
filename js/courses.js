/**
 * COURSES — render y CRUD de cursos.
 */

import { store } from './store.js';
import { $, $$, escapeHTML } from './utils.js';
import { toast } from './toasts.js';

const COLORS = ['#4F6BFF', '#22C55E', '#EAB308', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#06B6D4', '#0EA5E9', '#10B981', '#F97316', '#0F172A'];

const modal = $('#course-modal');
const form = $('#course-form');
const colorPickerEl = $('#course-color-picker');

let editingId = null;

/* ---- Helpers ---- */
const getById = (id) => store.state.courses.find(c => c.id === id);

const renderColorPicker = (selected) => {
  colorPickerEl.innerHTML = '';
  COLORS.forEach(c => {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'color-swatch' + (c === selected ? ' is-selected' : '');
    sw.style.setProperty('--c', c);
    sw.addEventListener('click', () => {
      $$('#course-color-picker .color-swatch').forEach(s => s.classList.remove('is-selected'));
      sw.classList.add('is-selected');
      form.dataset.color = c;
    });
    colorPickerEl.appendChild(sw);
  });
  form.dataset.color = selected || COLORS[0];
};

/* ---- Modal ---- */
export const openCourseModal = (id = null) => {
  editingId = id;
  form.reset();
  $('#course-modal-title').textContent = id ? 'Editar curso' : 'Nuevo curso';
  $('#delete-course').hidden = !id;
  if (id) {
    const c = getById(id);
    form.id.value = c.id;
    form.name.value = c.name;
    form.code.value = c.code || '';
    form.teacher.value = c.teacher || '';
    renderColorPicker(c.color);
  } else {
    renderColorPicker(COLORS[Math.floor(Math.random() * COLORS.length)]);
  }
  modal.hidden = false;
  setTimeout(() => form.name.focus(), 60);
};

const closeModal = () => { modal.hidden = true; editingId = null; };

/* ---- Render lista ---- */
export const renderCourses = () => {
  const grid = $('#courses-grid');
  if (!grid) return;
  const list = store.state.courses;
  if (!list.length) {
    const tpl = $('#empty-state-template').content.cloneNode(true);
    tpl.querySelector('.empty__title').textContent = 'No tienes cursos aún';
    tpl.querySelector('.empty__text').textContent = 'Crea uno para empezar a organizar tus tareas por curso.';
    grid.innerHTML = '';
    grid.appendChild(tpl);
    return;
  }

  grid.innerHTML = '';
  list.forEach(c => {
    const tasksOfCourse = store.state.tasks.filter(t => t.courseId === c.id);
    const pending = tasksOfCourse.filter(t => !t.done).length;
    const done = tasksOfCourse.filter(t => t.done).length;

    const card = document.createElement('article');
    card.className = 'course-card';
    card.style.setProperty('--c', c.color);
    card.innerHTML = `
      <h3 class="course-card__title">${escapeHTML(c.name)}</h3>
      <p class="course-card__meta">${escapeHTML([c.code, c.teacher].filter(Boolean).join(' · ') || 'Sin código')}</p>
      <div class="course-card__stats">
        <div><strong>${pending}</strong>pendientes</div>
        <div><strong>${done}</strong>completadas</div>
      </div>
    `;
    card.addEventListener('click', () => openCourseModal(c.id));
    grid.appendChild(card);
  });
};

/* ---- Render píldoras (dashboard) ---- */
export const renderCoursePills = () => {
  const wrap = $('#course-pills');
  if (!wrap) return;
  const list = store.state.courses;
  wrap.innerHTML = '';
  if (!list.length) {
    wrap.innerHTML = `<p style="font-size:.85rem;color:var(--text-mute)">Crea tu primer curso desde la pestaña "Cursos".</p>`;
    return;
  }
  list.forEach(c => {
    const count = store.state.tasks.filter(t => t.courseId === c.id && !t.done).length;
    const item = document.createElement('div');
    item.className = 'course-pills__item';
    item.innerHTML = `
      <span class="course-pills__dot" style="background:${c.color}"></span>
      <span class="course-pills__name">${escapeHTML(c.name)}</span>
      <span class="course-pills__count">${count}</span>
    `;
    wrap.appendChild(item);
  });
};

/* ---- Selects ---- */
export const populateCourseSelects = () => {
  const selects = $$('select[name="courseId"], #filter-course');
  selects.forEach(sel => {
    const current = sel.value;
    const isFilter = sel.id === 'filter-course';
    sel.innerHTML = isFilter
      ? '<option value="">Todos los cursos</option>'
      : '<option value="">Sin curso</option>';
    store.state.courses.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.name;
      sel.appendChild(o);
    });
    sel.value = current;
  });
};

/* ---- Init ---- */
export const initCourses = () => {
  $('#new-course-btn')?.addEventListener('click', () => openCourseModal());

  modal.addEventListener('click', (e) => {
    if (e.target.matches('[data-close]')) closeModal();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    data.color = form.dataset.color;
    if (!data.name?.trim()) return;
    store.upsertCourse({
      id: data.id || null,
      name: data.name.trim(),
      code: data.code?.trim() || '',
      teacher: data.teacher?.trim() || '',
      color: data.color,
    });
    toast(data.id ? 'Curso actualizado' : 'Curso creado', { type: 'success' });
    closeModal();
  });

  $('#delete-course').addEventListener('click', () => {
    if (!editingId) return;
    if (confirm('¿Eliminar este curso? Las tareas no se borran, solo quedarán sin curso.')) {
      store.deleteCourse(editingId);
      toast('Curso eliminado', { type: 'warn' });
      closeModal();
    }
  });
};

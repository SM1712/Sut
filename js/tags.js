/**
 * TAGS — render, CRUD y prioridad por defecto.
 * Cuando una etiqueta tiene `defaultPriority`, al asignarla a una
 * tarea se sugiere esa prioridad si es mayor que la actual.
 */

import { store } from './store.js';
import { $, $$, escapeHTML, focusIfDesktop } from './utils.js';
import { toast } from './toasts.js';
import { confirmDialog } from './confirm.js';

const COLORS = ['#4F6BFF','#22C55E','#EAB308','#F59E0B','#EF4444','#EC4899','#8B5CF6','#06B6D4','#0EA5E9','#10B981','#F97316','#0F172A'];

const CATEGORY_LABELS = { general: 'General', cycle: 'Ciclo', type: 'Tipo', status: 'Estado' };

const PRIORITY_OPTIONS = [
  { value: '',       label: '— Sin prioridad por defecto —' },
  { value: 'low',    label: '🟢 Baja' },
  { value: 'medium', label: '🟡 Media' },
  { value: 'high',   label: '🔴 Alta' },
  { value: 'urgent', label: '⚡ Urgente' },
];

const modal       = $('#tag-modal');
const form        = $('#tag-form');
const colorPickerEl = $('#tag-color-picker');

let editingId = null;

const getById = (id) => store.state.tags.find(t => t.id === id);

const renderCatPicker = (selected = 'general') => {
  const wrap = $('#tag-cat-picker');
  if (!wrap) return;
  const hidden = form.querySelector('input[name="category"]');
  $$('.cat-opt', wrap).forEach(opt => {
    opt.classList.toggle('is-selected', opt.dataset.cat === selected);
  });
  if (hidden) hidden.value = selected;
};

const renderColorPicker = (selected) => {
  colorPickerEl.innerHTML = '';
  COLORS.forEach(c => {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'color-swatch' + (c === selected ? ' is-selected' : '');
    sw.style.setProperty('--c', c);
    sw.addEventListener('click', () => {
      $$('#tag-color-picker .color-swatch').forEach(s => s.classList.remove('is-selected'));
      sw.classList.add('is-selected');
      form.dataset.color = c;
    });
    colorPickerEl.appendChild(sw);
  });
  form.dataset.color = selected || COLORS[0];
};

const buildDefaultPrioritySelect = (selected = '') => {
  const sel = form.querySelector('select[name="defaultPriority"]');
  if (!sel) return;
  sel.innerHTML = '';
  PRIORITY_OPTIONS.forEach(({ value, label }) => {
    const o = document.createElement('option');
    o.value = value; o.textContent = label;
    if (value === selected) o.selected = true;
    sel.appendChild(o);
  });
};

export const openTagModal = (id = null) => {
  editingId = id;
  form.reset();
  $('#tag-modal-title').textContent = id ? 'Editar etiqueta' : 'Nueva etiqueta';
  $('#delete-tag').hidden = !id;
  if (id) {
    const t = getById(id);
    form.elements.id.value = t.id;
    form.elements.name.value = t.name;
    renderCatPicker(t.category || 'general');
    buildDefaultPrioritySelect(t.defaultPriority || '');
    renderColorPicker(t.color);
  } else {
    renderCatPicker('general');
    buildDefaultPrioritySelect('');
    renderColorPicker(COLORS[Math.floor(Math.random() * COLORS.length)]);
  }
  modal.hidden = false;
  focusIfDesktop(form.elements.name);
};

const closeModal = () => { modal.hidden = true; editingId = null; };

export const renderTags = () => {
  const grid = $('#tags-grid');
  if (!grid) return;
  const list = store.state.tags;
  if (!list.length) {
    const tpl = $('#empty-state-template').content.cloneNode(true);
    tpl.querySelector('.empty__title').textContent = 'Sin etiquetas todavía';
    tpl.querySelector('.empty__text').textContent = 'Las etiquetas son chips que pegas a las tareas: "Investigación", "Examen", "Ciclo III". Una etiqueta puede sugerir prioridad automáticamente.';
    tpl.querySelector('.empty__art').innerHTML = `
      <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M54 36 36 54a4 4 0 0 1-6 0L8 32V8h24l22 22a4 4 0 0 1 0 6z"/>
        <circle cx="20" cy="20" r="3"/>
      </svg>`;
    const cta = document.createElement('button');
    cta.className = 'btn btn--primary';
    cta.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg> Crear primera etiqueta`;
    cta.addEventListener('click', () => openTagModal());
    tpl.querySelector('.empty__cta').appendChild(cta);
    grid.innerHTML = '';
    grid.appendChild(tpl);
    return;
  }
  grid.innerHTML = '';
  list.forEach(t => {
    const prioLabel = PRIORITY_OPTIONS.find(p => p.value === (t.defaultPriority || ''))?.label || '';
    const card = document.createElement('article');
    card.className = 'tag-card';
    card.style.setProperty('--c', t.color);
    card.innerHTML = `
      <span class="tag-card__color"></span>
      <div style="flex:1;min-width:0">
        <div class="tag-card__name">${escapeHTML(t.name)}</div>
        <div class="tag-card__cat">${CATEGORY_LABELS[t.category] || 'General'}</div>
        ${t.defaultPriority ? `<div class="tag-card__prio">${prioLabel}</div>` : ''}
      </div>
    `;
    card.addEventListener('click', () => openTagModal(t.id));
    grid.appendChild(card);
  });
};

/* ── Picker de etiquetas en el formulario de tareas ── */
export const renderTagPicker = (selectedIds = [], onChangePriority = null) => {
  const wrap = $('#tag-picker');
  wrap.innerHTML = '';
  const list = store.state.tags;
  if (!list.length) {
    wrap.innerHTML = `<span class="tag-picker__empty">Sin etiquetas. Créalas en la pestaña "Etiquetas".</span>`;
    return [];
  }
  const selected = new Set(selectedIds);
  list.forEach(t => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tag-picker__opt' + (selected.has(t.id) ? ' is-on' : '');
    b.style.setProperty('--c', t.color);
    b.dataset.id = t.id;
    b.textContent = t.name;
    b.addEventListener('click', () => {
      const wasSelected = selected.has(t.id);
      if (wasSelected) { selected.delete(t.id); }
      else {
        selected.add(t.id);
        /* Sugerir prioridad si la etiqueta tiene una por defecto */
        if (t.defaultPriority && onChangePriority) {
          onChangePriority(t.defaultPriority, t.name);
        }
      }
      b.classList.toggle('is-on');
      wrap.dataset.selected = JSON.stringify([...selected]);
    });
    wrap.appendChild(b);
  });
  wrap.dataset.selected = JSON.stringify([...selected]);
};

export const getPickerSelection = () => {
  const wrap = $('#tag-picker');
  return JSON.parse(wrap.dataset.selected || '[]');
};

export const initTags = () => {
  $('#new-tag-btn')?.addEventListener('click', () => openTagModal());

  modal.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) closeModal();
  });

  // Category picker (tarjetas con descripción)
  $('#tag-cat-picker')?.addEventListener('click', (e) => {
    const opt = e.target.closest('.cat-opt');
    if (!opt) return;
    renderCatPicker(opt.dataset.cat);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    data.color = form.dataset.color;
    if (!data.name?.trim()) return;
    store.upsertTag({
      id: data.id || null,
      name: data.name.trim(),
      category: data.category || 'general',
      color: data.color,
      defaultPriority: data.defaultPriority || '',
    });
    toast(data.id ? 'Etiqueta actualizada' : 'Etiqueta creada', { type: 'success' });
    closeModal();
  });

  $('#delete-tag').addEventListener('click', async () => {
    if (!editingId) return;
    const tag = getById(editingId);
    const usage = store.state.tasks.filter(t => (t.tagIds || []).includes(editingId)).length;
    const ok = await confirmDialog({
      title: `¿Eliminar "${tag?.name || 'esta etiqueta'}"?`,
      text: usage
        ? `Está asignada a ${usage} tarea${usage > 1 ? 's' : ''}; la quitaremos de ellas pero las tareas no se borran.`
        : 'La etiqueta se eliminará permanentemente.',
      confirmText: 'Sí, eliminar',
    });
    if (!ok) return;
    store.deleteTag(editingId);
    toast('Etiqueta eliminada', { type: 'warn' });
    closeModal();
  });
};

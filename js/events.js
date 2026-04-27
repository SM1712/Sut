/**
 * EVENTS — Eventos de calendario (semana de exámenes, exposiciones, etc.)
 * Soporta rangos multi-día con bandas visuales en el calendario.
 */

import { store } from './store.js';
import { $, $$, escapeHTML } from './utils.js';
import { toast } from './toasts.js';

/* ── Tipos de evento ──────────────────────────────────────────── */
export const EVENT_TYPES = {
  exam:         { label: 'Exámenes',      icon: '📝', color: '#EF4444' },
  presentation: { label: 'Exposiciones',  icon: '🎤', color: '#F59E0B' },
  project:      { label: 'Entrega',       icon: '📦', color: '#8B5CF6' },
  break:        { label: 'Descanso',      icon: '🏖',  color: '#22C55E' },
  holiday:      { label: 'Feriado',       icon: '🎉', color: '#0EA5E9' },
  meeting:      { label: 'Reunión',       icon: '🤝', color: '#EC4899' },
  custom:       { label: 'Personalizado', icon: '⭐', color: '#6E5BFF' },
};

const COLORS = [
  '#EF4444','#F59E0B','#22C55E','#0EA5E9',
  '#8B5CF6','#EC4899','#6E5BFF','#10B981','#F97316',
];

const modal       = $('#event-modal');
const form        = $('#event-form');
const colorPicker = $('#event-color-picker');

let editingId = null;

/* ── Color picker ────────────────────────────────────────────── */
const buildColorPicker = (selected) => {
  colorPicker.innerHTML = '';
  COLORS.forEach(c => {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'color-swatch' + (c === selected ? ' is-selected' : '');
    sw.style.setProperty('--c', c);
    sw.addEventListener('click', () => {
      $$('#event-color-picker .color-swatch').forEach(s => s.classList.remove('is-selected'));
      sw.classList.add('is-selected');
      form.dataset.color = c;
    });
    colorPicker.appendChild(sw);
  });
  form.dataset.color = selected || COLORS[0];
};

/* ── Populate type options ───────────────────────────────────── */
const buildTypeOptions = (selected = 'exam') => {
  const sel = form.querySelector('select[name="type"]');
  sel.innerHTML = '';
  Object.entries(EVENT_TYPES).forEach(([k, v]) => {
    const o = document.createElement('option');
    o.value = k; o.textContent = `${v.icon} ${v.label}`;
    if (k === selected) o.selected = true;
    sel.appendChild(o);
  });
  // Auto-color cuando cambia el tipo
  sel.addEventListener('change', () => {
    const def = EVENT_TYPES[sel.value]?.color;
    if (def) { form.dataset.color = def; buildColorPicker(def); }
  });
};

/* ── Modal ───────────────────────────────────────────────────── */
export const openEventModal = (id = null, prefillDate = null) => {
  editingId = id;
  form.reset();
  $('#event-modal-title').textContent = id ? 'Editar evento' : 'Nuevo evento';
  $('#delete-event').hidden = !id;

  if (id) {
    const ev = store.state.events.find(e => e.id === id);
    form.elements.id.value          = ev.id;
    form.elements.title.value       = ev.title;
    form.elements.description.value = ev.description || '';
    form.elements.startDate.value   = ev.startDate;
    form.elements.endDate.value     = ev.endDate || ev.startDate;
    buildTypeOptions(ev.type);
    buildColorPicker(ev.color);
  } else {
    const today = prefillDate || new Date().toISOString().slice(0, 10);
    form.elements.startDate.value = today;
    form.elements.endDate.value   = today;
    buildTypeOptions('exam');
    buildColorPicker(EVENT_TYPES['exam'].color);
  }

  modal.hidden = false;
  setTimeout(() => form.querySelector('[name="title"]').focus(), 60);
};

const closeModal = () => { modal.hidden = true; editingId = null; };

/* ── Helpers de rango ────────────────────────────────────────── */
/** Devuelve todos los ISO dates entre start y end inclusive */
export const datesInRange = (startISO, endISO) => {
  const result = [];
  const end  = new Date(endISO + 'T00:00:00');
  let   cur  = new Date(startISO + 'T00:00:00');
  while (cur <= end) {
    result.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return result;
};

/** Devuelve todos los eventos que cubren una fecha ISO dada */
export const eventsOnDate = (isoDate) =>
  store.state.events.filter(ev => {
    const s = ev.startDate, e = ev.endDate || ev.startDate;
    return isoDate >= s && isoDate <= e;
  });

/* ── Render strip para celda del calendario ─────────────────── */
export const renderEventStrip = (isoDate, onClick) => {
  const evs = eventsOnDate(isoDate);
  return evs.map(ev => {
    const type = EVENT_TYPES[ev.type] || EVENT_TYPES.custom;
    const isStart = isoDate === ev.startDate;
    const isEnd   = isoDate === (ev.endDate || ev.startDate);
    const strip = document.createElement('div');
    strip.className = [
      'cal-event-strip',
      `cal-event-strip--${ev.type}`,
      isStart ? 'is-start' : '',
      isEnd   ? 'is-end'   : '',
    ].join(' ');
    strip.style.setProperty('--ev-color', ev.color || type.color);
    strip.title = `${type.icon} ${ev.title}`;
    if (isStart) strip.textContent = `${type.icon} ${ev.title}`;
    strip.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick?.(ev.id);
    });
    return strip;
  });
};

/* ── Init ────────────────────────────────────────────────────── */
export const initEvents = () => {
  // Botón en el calendario
  $('#new-event-btn')?.addEventListener('click', () => openEventModal());

  modal?.addEventListener('click', (e) => {
    if (e.target.matches('[data-close]')) closeModal();
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (!data.title?.trim()) return;
    if (data.startDate > (data.endDate || data.startDate)) {
      toast('La fecha de inicio no puede ser mayor que la de fin', { type: 'danger' }); return;
    }
    store.upsertEvent({
      id:          data.id || null,
      title:       data.title.trim(),
      description: data.description?.trim() || '',
      type:        data.type,
      color:       form.dataset.color,
      startDate:   data.startDate,
      endDate:     data.endDate || data.startDate,
      allDay:      true,
    });
    toast(data.id ? 'Evento actualizado' : 'Evento creado 🗓', { type: 'success' });
    closeModal();
  });

  $('#delete-event')?.addEventListener('click', () => {
    if (!editingId) return;
    if (confirm('¿Eliminar este evento?')) {
      store.deleteEvent(editingId);
      toast('Evento eliminado', { type: 'warn' });
      closeModal();
    }
  });
};

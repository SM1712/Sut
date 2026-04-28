/**
 * CALENDAR — vista mensual con tareas y bandas de eventos multi-día.
 */

import { store } from './store.js';
import { $, escapeHTML, parseDue, isSameDay } from './utils.js';
import { openTaskModal } from './tasks.js';
import { openEventModal, renderEventStrip, eventsOnDate, EVENT_TYPES } from './events.js';

let viewDate = new Date();

const DAYS_ES   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export const renderCalendar = () => {
  const root       = $('#calendar');
  const monthLabel = $('#cal-month');
  if (!root) return;

  monthLabel.textContent = `${MONTHS_ES[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

  const year        = viewDate.getFullYear();
  const month       = viewDate.getMonth();
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today       = new Date();

  /* ── Cabecera ── */
  const head = document.createElement('div');
  head.className = 'calendar__head';
  DAYS_ES.forEach(d => {
    const hd = document.createElement('div');
    hd.className = 'calendar__hd';
    hd.textContent = d;
    head.appendChild(hd);
  });

  /* ── Grilla ── */
  const grid = document.createElement('div');
  grid.className = 'calendar__grid';

  /* Días previos (relleno) */
  const prevDays = new Date(year, month, 0).getDate();
  for (let i = firstDay - 1; i >= 0; i--) {
    const cell = document.createElement('div');
    cell.className = 'cal-day is-out';
    cell.innerHTML = `<span class="cal-day__num">${prevDays - i}</span>`;
    grid.appendChild(cell);
  }

  /* Días del mes */
  for (let d = 1; d <= daysInMonth; d++) {
    const dayDate = new Date(year, month, d);
    const isoDate = dayDate.toISOString().slice(0, 10);
    const isToday = isSameDay(dayDate, today);

    const cell = document.createElement('div');
    cell.className = 'cal-day' + (isToday ? ' is-today' : '');
    cell.dataset.date = isoDate;

    /* Número del día */
    const num = document.createElement('span');
    num.className = 'cal-day__num';
    num.textContent = d;
    cell.appendChild(num);

    /* ── Bandas de eventos ── */
    const evStrips = renderEventStrip(isoDate, (evId) => openEventModal(evId));
    evStrips.forEach(s => cell.appendChild(s));

    /* ── Tareas del día ── */
    const dayTasks = store.state.tasks.filter(t => {
      const due = parseDue(t.dueDate, t.dueTime);
      return due && isSameDay(due, dayDate);
    });

    const MAX_TASKS = 2;
    dayTasks.slice(0, MAX_TASKS).forEach(t => {
      const course = store.state.courses.find(c => c.id === t.courseId);
      const color  = course?.color || 'var(--accent)';
      const pill   = document.createElement('div');
      pill.className = 'cal-day__task' + (t.done ? ' is-done' : '');
      pill.style.setProperty('--c', color);
      pill.title = t.title;
      pill.textContent = t.title;
      pill.addEventListener('click', (e) => { e.stopPropagation(); openTaskModal(t.id); });
      cell.appendChild(pill);
    });

    if (dayTasks.length > MAX_TASKS) {
      const more = document.createElement('div');
      more.className = 'cal-day__more';
      more.textContent = `+${dayTasks.length - MAX_TASKS} más`;
      cell.appendChild(more);
    }

    grid.appendChild(cell);
  }

  /* Días siguientes (relleno) */
  const totalCells = firstDay + daysInMonth;
  const remaining  = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remaining; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day is-out';
    cell.innerHTML = `<span class="cal-day__num">${i}</span>`;
    grid.appendChild(cell);
  }

  root.innerHTML = '';
  root.appendChild(head);
  root.appendChild(grid);

  /* ── Drag-to-create: arrastra entre celdas para crear evento multi-día ── */
  enableDragCreate(grid);

  /* ── Leyenda de eventos del mes ── */
  renderCalendarLegend(year, month);
};

/**
 * Habilita drag-to-create en la grilla.
 * - Click simple sobre celda → modal con esa fecha
 * - Drag (pointer down + move sobre otra celda) → modal con startDate/endDate
 * - Resalta celdas en el rango durante el drag para feedback visual.
 */
const enableDragCreate = (grid) => {
  /** @type {HTMLElement|null} */ let startCell = null;
  /** @type {HTMLElement|null} */ let endCell   = null;
  let dragging = false;

  const cellAt = (target) => target?.closest?.('.cal-day:not(.is-out)[data-date]');

  /** Aplica/quita .is-drag-selected a las celdas del rango. */
  const paintRange = () => {
    grid.querySelectorAll('.cal-day.is-drag-selected').forEach(c => c.classList.remove('is-drag-selected'));
    if (!startCell || !endCell) return;
    const a = startCell.dataset.date, b = endCell.dataset.date;
    const [from, to] = a <= b ? [a, b] : [b, a];
    grid.querySelectorAll('.cal-day[data-date]').forEach(c => {
      const d = c.dataset.date;
      if (d >= from && d <= to) c.classList.add('is-drag-selected');
    });
  };

  const reset = () => {
    grid.querySelectorAll('.cal-day.is-drag-selected').forEach(c => c.classList.remove('is-drag-selected'));
    startCell = endCell = null;
    dragging = false;
  };

  grid.addEventListener('pointerdown', (e) => {
    // Ignorar click sobre tareas o eventos existentes
    if (e.target.closest('.cal-day__task, .cal-event-strip')) return;
    const cell = cellAt(e.target);
    if (!cell) return;
    startCell = endCell = cell;
    dragging = true;
    paintRange();
    // Capturamos el pointer para recibir move/up incluso fuera del grid
    grid.setPointerCapture?.(e.pointerId);
  });

  grid.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const cell = cellAt(document.elementFromPoint(e.clientX, e.clientY));
    if (cell && cell !== endCell) {
      endCell = cell;
      paintRange();
    }
  });

  const finish = (e) => {
    if (!dragging || !startCell) { reset(); return; }
    const a = startCell.dataset.date, b = endCell?.dataset.date || a;
    const [from, to] = a <= b ? [a, b] : [b, a];
    const isRange = from !== to;
    reset();
    // Abrir modal con prefill (si es un click simple, solo from; si drag, range)
    openEventModal(null, from, isRange ? to : null);
  };

  grid.addEventListener('pointerup', finish);
  grid.addEventListener('pointercancel', () => reset());
  // Si el pointer sale de la ventana
  grid.addEventListener('pointerleave', (e) => {
    // Solo cancelar si NO estamos arrastrando (mantenemos selección si pointer capture activo)
    if (!grid.hasPointerCapture?.(e.pointerId)) {/* nada */}
  });
};

/* ── Leyenda de tipos de evento visibles en el mes ── */
const renderCalendarLegend = (year, month) => {
  let legend = $('#cal-legend');
  if (!legend) {
    legend = document.createElement('div');
    legend.id = 'cal-legend';
    legend.className = 'cal-legend';
    $('#calendar').after(legend);
  }

  const start = new Date(year, month, 1).toISOString().slice(0, 10);
  const end   = new Date(year, month + 1, 0).toISOString().slice(0, 10);

  const monthEvents = store.state.events.filter(ev => {
    const evStart = ev.startDate, evEnd = ev.endDate || ev.startDate;
    return evStart <= end && evEnd >= start;
  });

  if (!monthEvents.length) { legend.hidden = true; return; }
  legend.hidden = false;

  legend.innerHTML = `<span class="cal-legend__title">Este mes:</span>`;
  monthEvents.forEach(ev => {
    const type = EVENT_TYPES[ev.type] || EVENT_TYPES.custom;
    const chip = document.createElement('span');
    chip.className = 'cal-legend__chip';
    chip.style.setProperty('--ev-color', ev.color || type.color);
    chip.textContent = `${type.icon} ${ev.title}`;
    chip.title = `${ev.startDate} → ${ev.endDate || ev.startDate}`;
    chip.addEventListener('click', () => openEventModal(ev.id));
    legend.appendChild(chip);
  });
};

export const initCalendar = () => {
  $('#cal-prev')?.addEventListener('click', () => {
    viewDate.setMonth(viewDate.getMonth() - 1);
    renderCalendar();
  });
  $('#cal-next')?.addEventListener('click', () => {
    viewDate.setMonth(viewDate.getMonth() + 1);
    renderCalendar();
  });
  $('#cal-today')?.addEventListener('click', () => {
    viewDate = new Date();
    renderCalendar();
  });
};

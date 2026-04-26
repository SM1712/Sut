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

    /* Click en celda vacía → nuevo evento con esa fecha */
    cell.addEventListener('click', () => openEventModal(null, isoDate));

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

  /* ── Leyenda de eventos del mes ── */
  renderCalendarLegend(year, month);
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

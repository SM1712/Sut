/**
 * TOUR — mini onboardings por página.
 * Cuando el usuario entra por primera vez a una vista (después de
 * completar el onboarding inicial), se le muestra un tour corto
 * de 1–3 pasos resaltando los elementos clave.
 *
 * Estado persistido en store.settings.toursSeen = { dashboard: true, ... }
 */

import { store } from './store.js';
import { $ } from './utils.js';

/**
 * Definición de tours. Cada paso:
 *   - selector: CSS del elemento al que apuntar (puede ser null → centrado)
 *   - title:    título corto
 *   - text:     descripción
 *   - placement: 'auto' | 'top' | 'bottom' | 'left' | 'right' (default 'auto')
 */
const VIEW_TOURS = {
  dashboard: [
    {
      selector: '.stats-grid',
      title: 'Tu resumen del día',
      text: 'Aquí ves de un vistazo lo que vence hoy, lo atrasado, lo completado esta semana y cuántos cursos llevas activos.',
      placement: 'bottom',
    },
    {
      selector: '.chip-group',
      title: 'Filtra rápido',
      text: 'Cambia entre Hoy, Esta semana o Atrasadas para enfocarte en lo que importa ahora.',
      placement: 'bottom',
    },
    {
      selector: '#course-pills',
      title: 'Salto a cada curso',
      text: 'Las píldoras de la derecha muestran cuántas tareas pendientes tienes en cada curso. El badge a la derecha es el conteo.',
      placement: 'left',
    },
  ],

  tasks: [
    {
      selector: '.filters-bar',
      title: 'Filtros y orden',
      text: 'Combina curso + prioridad + estado y elige cómo ordenar (fecha, prioridad, alfabético…).',
      placement: 'bottom',
    },
    {
      selector: '#new-task-btn-tasks, #bottom-new-task',
      title: 'Crea con un clic',
      text: 'Una tarea soporta prioridad escalante, etiquetas, alertas y curso. La prioridad escalante sube sola conforme se acerca la fecha.',
      placement: 'auto',
    },
  ],

  courses: [
    {
      selector: '#new-course-btn',
      title: 'Cada curso, su color',
      text: 'Crea cursos con su color identificativo. El color aparecerá en cada tarea y curso para que ubiques todo de un vistazo.',
      placement: 'bottom',
    },
  ],

  calendar: [
    {
      selector: '.toolbar',
      title: 'Navega entre meses',
      text: 'Usa las flechas o "Hoy" para volver al mes actual. Las tareas con fecha y los eventos aparecen automáticamente.',
      placement: 'bottom',
    },
    {
      selector: '#calendar',
      title: 'Arrastra para crear eventos',
      text: '✨ Mantén click sobre un día y arrastra hasta otro: se creará un evento multi-día con esas fechas. Ej: "Semana de parciales".',
      placement: 'top',
    },
    {
      selector: '#new-event-btn',
      title: 'Eventos con tipo',
      text: 'Los eventos pueden ser exámenes, exposiciones, entregas, descansos… Cada tipo tiene su color por defecto.',
      placement: 'bottom',
    },
  ],

  tags: [
    {
      selector: '#new-tag-btn',
      title: 'Etiquetas con superpoderes',
      text: 'Una etiqueta puede sugerir prioridad automáticamente: si etiquetas algo como "Examen" con prioridad Alta, esa prioridad se sugiere al asignarla.',
      placement: 'bottom',
    },
  ],

  // Tour especial cuando el usuario entra a un espacio compartido por primera vez
  space: [
    {
      selector: '#space-chip',
      title: '¡Estás en un espacio compartido!',
      text: 'Todos los miembros ven las mismas tareas en tiempo real. Haz clic aquí para ver los miembros, copiar el código de invitación, salir o (si lo creaste) eliminarlo.',
      placement: 'right',
    },
  ],
};

/* ─── Estado del tour activo ──────────────────────────────────── */
let _active = null;
let _stepIdx = 0;

/* ─── DOM helpers ─────────────────────────────────────────────── */
const ensureDOM = () => {
  let host = $('#tour-host');
  if (host) return host;
  host = document.createElement('div');
  host.id = 'tour-host';
  host.className = 'tour-host';
  host.hidden = true;
  host.innerHTML = `
    <div class="tour__backdrop" data-skip></div>
    <div class="tour__highlight" id="tour-highlight"></div>
    <div class="tour__pop" id="tour-pop" role="dialog" aria-modal="true">
      <div class="tour__step" id="tour-step-counter"></div>
      <h3 class="tour__title" id="tour-title"></h3>
      <p class="tour__text"  id="tour-text"></p>
      <div class="tour__nav">
        <button type="button" class="btn btn--ghost btn--sm" data-skip>Saltar</button>
        <div class="tour__dots" id="tour-dots"></div>
        <button type="button" class="btn btn--primary btn--sm" id="tour-next">Siguiente</button>
      </div>
    </div>
  `;
  document.body.appendChild(host);

  host.addEventListener('click', (e) => {
    if (e.target.closest('[data-skip]')) end(true);
  });
  $('#tour-next', host).addEventListener('click', () => {
    if (!_active) return;
    if (_stepIdx >= _active.length - 1) end(true);
    else { _stepIdx++; renderStep(); }
  });
  return host;
};

/** Posiciona el highlight y el popover sobre el elemento target. */
const renderStep = () => {
  const host = ensureDOM();
  const step = _active[_stepIdx];
  const total = _active.length;

  $('#tour-title').textContent = step.title;
  $('#tour-text').textContent  = step.text;
  $('#tour-step-counter').textContent = `Paso ${_stepIdx + 1} de ${total}`;

  // Dots
  const dotsEl = $('#tour-dots');
  dotsEl.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const d = document.createElement('span');
    if (i === _stepIdx) d.className = 'is-active';
    dotsEl.appendChild(d);
  }

  // Botón final
  $('#tour-next').textContent = _stepIdx === total - 1 ? '¡Entendido!' : 'Siguiente';

  // Posicionar highlight + popover
  const target = step.selector ? document.querySelector(step.selector) : null;
  const highlight = $('#tour-highlight');
  const pop       = $('#tour-pop');

  if (!target) {
    // Sin target → popover centrado y highlight oculto
    highlight.style.display = 'none';
    pop.style.left = '50%';
    pop.style.top  = '50%';
    pop.style.transform = 'translate(-50%, -50%)';
    return;
  }

  highlight.style.display = 'block';
  const rect = target.getBoundingClientRect();
  const pad = 8;
  highlight.style.left   = `${rect.left - pad}px`;
  highlight.style.top    = `${rect.top - pad}px`;
  highlight.style.width  = `${rect.width + pad * 2}px`;
  highlight.style.height = `${rect.height + pad * 2}px`;

  // Scroll al elemento si está fuera de vista
  if (rect.top < 0 || rect.bottom > innerHeight) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Posicionar popover (auto: debajo si hay espacio, sino arriba)
  pop.style.transform = 'none';
  const popW = 320;
  const popH = pop.offsetHeight || 180;
  let placement = step.placement || 'auto';
  if (placement === 'auto') {
    placement = (rect.bottom + popH + 20 < innerHeight) ? 'bottom' : 'top';
  }
  let left, top;
  if (placement === 'bottom') { top = rect.bottom + 14; left = rect.left + rect.width / 2 - popW / 2; }
  else if (placement === 'top') { top = rect.top - popH - 14; left = rect.left + rect.width / 2 - popW / 2; }
  else if (placement === 'right') { left = rect.right + 14; top = rect.top + rect.height / 2 - popH / 2; }
  else if (placement === 'left')  { left = rect.left - popW - 14; top = rect.top + rect.height / 2 - popH / 2; }

  // Clamp dentro de viewport
  left = Math.max(12, Math.min(innerWidth - popW - 12, left));
  top  = Math.max(12, Math.min(innerHeight - popH - 12, top));
  pop.style.left = `${left}px`;
  pop.style.top  = `${top}px`;
  pop.dataset.placement = placement;
};

/** Termina el tour activo. Si markSeen, lo guarda. */
const end = (markSeen = true) => {
  const host = $('#tour-host');
  if (host) host.hidden = true;
  if (markSeen && _activeName) {
    const seen = { ...(store.settings.toursSeen || {}) };
    seen[_activeName] = true;
    store.setSetting('toursSeen', seen);
  }
  _active = null; _activeName = null; _stepIdx = 0;
};

/* ─── API pública ─────────────────────────────────────────────── */
let _activeName = null;

/** Inicia un tour por nombre. Usa `force=true` para mostrarlo aunque ya se haya visto. */
export const startTour = (viewName, { force = false } = {}) => {
  const seen = store.settings.toursSeen || {};
  if (!force && seen[viewName]) return false;
  const def = VIEW_TOURS[viewName];
  if (!def?.length) return false;
  _active = def;
  _activeName = viewName;
  _stepIdx = 0;
  ensureDOM();
  $('#tour-host').hidden = false;
  // Esperar a que el layout esté listo
  requestAnimationFrame(renderStep);
  return true;
};

/** Marca todos los tours como NO vistos (para "volver a ver"). */
export const resetTours = () => {
  store.setSetting('toursSeen', {});
};

/** Re-posiciona el paso actual si la ventana cambia de tamaño. */
window.addEventListener('resize', () => { if (_active) renderStep(); });

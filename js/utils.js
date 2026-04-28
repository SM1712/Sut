/**
 * UTILS — helpers genéricos.
 * Pequeños, sin estado, fácilmente reutilizables.
 */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const debounce = (fn, ms = 200) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

/**
 * Detecta dispositivo táctil (móvil/tablet) para evitar comportamientos
 * intrusivos como auto-focus que disparan el teclado virtual.
 * `(pointer: coarse)` es la consulta más fiable: true en touch sin mouse.
 */
export const isTouchDevice = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(pointer: coarse)').matches ?? false);

/**
 * Hace focus al elemento solo si NO es dispositivo táctil. Evita que abrir
 * un modal en móvil dispare el teclado del sistema.
 */
export const focusIfDesktop = (el, delay = 60) => {
  if (!el || isTouchDevice()) return;
  setTimeout(() => el.focus(), delay);
};

/* ============== Fechas ============== */

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

export const parseDue = (date, time) => {
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  if (time) {
    const [hh, mm] = time.split(':').map(Number);
    return new Date(y, m - 1, d, hh, mm, 0, 0);
  }
  return new Date(y, m - 1, d, 23, 59, 0, 0);
};

export const isSameDay = (a, b) => {
  if (!a || !b) return false;
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate();
};

export const fmtDateLong = (d) => {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
};

export const fmtDateShort = (d) => {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
};

export const fmtTime = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
};

export const relativeDue = (due) => {
  if (!due) return { text: 'Sin fecha', state: 'none' };
  const now = new Date();
  const diff = new Date(due) - now;
  const minutes = Math.round(diff / 60000);
  const hours = Math.round(diff / 3600000);
  const days = Math.round(diff / 86400000);

  if (diff < 0) {
    const absMin = Math.abs(minutes);
    if (absMin < 60) return { text: `hace ${absMin} min`, state: 'overdue' };
    if (Math.abs(hours) < 24) return { text: `hace ${Math.abs(hours)} h`, state: 'overdue' };
    return { text: `hace ${Math.abs(days)} d`, state: 'overdue' };
  }
  if (isSameDay(due, now)) {
    if (hours === 0) return { text: minutes <= 1 ? 'ahora' : `en ${minutes} min`, state: 'soon' };
    return { text: `hoy ${fmtTime(due)}`, state: hours <= 3 ? 'soon' : 'ok' };
  }
  if (days === 1) return { text: `mañana ${fmtTime(due)}`, state: 'ok' };
  if (days < 7) return { text: `en ${days} días`, state: 'ok' };
  return { text: fmtDateShort(due), state: 'ok' };
};

/* ============== DOM ============== */

export const html = (strings, ...values) => {
  const tpl = document.createElement('template');
  tpl.innerHTML = strings.reduce((acc, s, i) => acc + s + (values[i] ?? ''), '').trim();
  return tpl.content.firstChild;
};

export const escapeHTML = (str = '') =>
  String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

/* ============== Storage helpers ============== */

export const safeJSON = (v, fallback = null) => {
  try { return JSON.parse(v); } catch { return fallback; }
};

/* ============== Color helpers ============== */

/* ============== Prioridad escalante ============== */

const PRIO_LEVELS = ['low', 'medium', 'high', 'urgent'];

/**
 * Calcula la prioridad efectiva basada en la fecha de vencimiento.
 * Si `escalating` está desactivado, devuelve la prioridad base.
 *
 * Reglas de escalada:
 *  > 7 días  → sin cambio
 *  3–7 días  → +1 nivel
 *  1–3 días  → +2 niveles
 *  < 24 h    → urgente
 *  vencida   → urgente  (estado especial "overdue")
 */
export const computeEffectivePriority = (task) => {
  if (!task.escalating) return task.priority || 'medium';
  const due = parseDue(task.dueDate, task.dueTime);
  if (!due) return task.priority || 'medium';
  if (task.done) return task.priority || 'medium';

  const diffDays = (due - new Date()) / 86400000;
  const baseIdx  = PRIO_LEVELS.indexOf(task.priority || 'medium');

  if (diffDays < 0)  return 'urgent';          // vencida
  if (diffDays < 1)  return 'urgent';          // < 24 h
  if (diffDays < 3)  return PRIO_LEVELS[Math.min(baseIdx + 2, 3)]; // +2
  if (diffDays < 7)  return PRIO_LEVELS[Math.min(baseIdx + 1, 3)]; // +1
  return task.priority || 'medium';
};

/** Etiqueta descriptiva del nivel de escalada para UI */
export const escaladeLabel = (task) => {
  if (!task.escalating) return null;
  const eff  = computeEffectivePriority(task);
  const base = task.priority || 'medium';
  if (eff === base) return null;
  if (eff === 'urgent' && base !== 'urgent') return '⚡ Escalada a Urgente';
  const map = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' };
  return `⬆ Escalada a ${map[eff]}`;
};

export const hexToHSL = (hex) => {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = ((b - r) / d + 2); break;
      case b: h = ((r - g) / d + 4); break;
    }
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
};

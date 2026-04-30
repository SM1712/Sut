import type { Priority, Task } from '../types';

export const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const debounce = <T extends (...args: unknown[]) => void>(fn: T, ms = 200): T => {
  let t: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  }) as T;
};

export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export const isTouchDevice = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(pointer: coarse)').matches ?? false);

export const safeJSON = <T>(v: string | null, fallback: T | null = null): T | null => {
  try { return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};

/* ── Dates ── */

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const parseDue = (date: string, time?: string): Date | null => {
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  if (time) {
    const [hh, mm] = time.split(':').map(Number);
    return new Date(y, m - 1, d, hh, mm, 0, 0);
  }
  return new Date(y, m - 1, d, 23, 59, 0, 0);
};

export const isSameDay = (a: Date | string, b: Date | string): boolean => {
  if (!a || !b) return false;
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate();
};

export const startOfDay = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const addDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const fmtDateLong = (d: Date | string): string => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
};

export const fmtDateShort = (d: Date | string): string => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
};

export const fmtTime = (d: Date | null): string => {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
};

export const relativeDue = (due: Date | null): { text: string; state: 'none' | 'ok' | 'soon' | 'overdue' } => {
  if (!due) return { text: 'Sin fecha', state: 'none' };
  const now = new Date();
  const diff = due.getTime() - now.getTime();
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

export const datesInRange = (startISO: string, endISO: string): string[] => {
  const result: string[] = [];
  const end = new Date(endISO + 'T00:00:00');
  let cur = new Date(startISO + 'T00:00:00');
  while (cur <= end) {
    result.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return result;
};

/* ── Priority ── */

const PRIO_LEVELS: Priority[] = ['low', 'medium', 'high', 'urgent'];

export const computeEffectivePriority = (task: Task): Priority => {
  if (!task.escalating) return task.priority || 'medium';
  const due = parseDue(task.dueDate, task.dueTime);
  if (!due) return task.priority || 'medium';
  if (task.done) return task.priority || 'medium';
  const diffDays = (due.getTime() - Date.now()) / 86400000;
  const baseIdx = PRIO_LEVELS.indexOf(task.priority || 'medium');
  if (diffDays < 0) return 'urgent';
  if (diffDays < 1) return 'urgent';
  if (diffDays < 3) return PRIO_LEVELS[Math.min(baseIdx + 2, 3)];
  if (diffDays < 7) return PRIO_LEVELS[Math.min(baseIdx + 1, 3)];
  return task.priority || 'medium';
};

export const escaladeLabel = (task: Task): string | null => {
  if (!task.escalating) return null;
  const eff = computeEffectivePriority(task);
  const base = task.priority || 'medium';
  if (eff === base) return null;
  const map: Record<Priority, string> = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' };
  if (eff === 'urgent' && base !== 'urgent') return '⚡ Escalada a Urgente';
  return `⬆ Escalada a ${map[eff]}`;
};

export const hexToHSL = (hex: string): { h: number; s: number; l: number } => {
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

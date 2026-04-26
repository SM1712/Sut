/**
 * STORE — fuente única de la verdad.
 * Persistencia en localStorage con capa de sincronización enchufable (Firebase).
 * Los métodos son idempotentes y reactivos vía EventTarget.
 */

import { safeJSON, uid } from './utils.js';

const STORAGE_KEY  = 'sut.state.v2';
const SETTINGS_KEY = 'sut.settings.v1';

const DEFAULT_STATE = {
  version: 2,
  tasks: [],
  courses: [],
  tags: [],
  events: [],          // ← nuevo: eventos de calendario
  meta: {
    createdAt: new Date().toISOString(),
    onboarded: false,
  },
};

const DEFAULT_SETTINGS = {
  theme: 'light',
  accentColor: '#4F6BFF',
  buttonColor: '#4F6BFF',
  textColor: '',
  fontFamily: 'Inter',
  fontScale: 1,
  radius: 14,
};

class Store extends EventTarget {
  constructor() {
    super();
    this.state    = this._load();
    this.settings = this._loadSettings();
    /** Hook de sincronización externo (Firebase). Firma: async (op, collection, data) */
    this._syncHook = null;
  }

  /* ─── Persistencia local ─────────────────────────────────────── */
  _load() {
    const raw = safeJSON(localStorage.getItem(STORAGE_KEY))
             || safeJSON(localStorage.getItem('sut.state.v1')); // migración
    if (!raw) return structuredClone(DEFAULT_STATE);
    return { ...structuredClone(DEFAULT_STATE), ...raw, events: raw.events || [] };
  }
  _loadSettings() {
    const raw = safeJSON(localStorage.getItem(SETTINGS_KEY));
    return { ...DEFAULT_SETTINGS, ...(raw || {}) };
  }
  _save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    this.dispatchEvent(new CustomEvent('change', { detail: this.state }));
  }
  _saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    this.dispatchEvent(new CustomEvent('settings:change', { detail: this.settings }));
  }

  /** Registra el hook de sincronización externo (Firebase). */
  registerSyncHook(fn) { this._syncHook = fn; }

  /** Notifica al hook externo, sin bloquear. */
  _sync(op, collection, data) {
    if (this._syncHook) this._syncHook(op, collection, data).catch(console.warn);
  }

  on(event, handler) {
    this.addEventListener(event, handler);
    return () => this.removeEventListener(event, handler);
  }

  /* ─── Onboarding ─────────────────────────────────────────────── */
  setOnboarded(done = true) {
    this.state.meta.onboarded = !!done;
    this._save();
  }

  /* ─── Tasks ──────────────────────────────────────────────────── */
  upsertTask(task) {
    const now = new Date().toISOString();
    if (task.id) {
      const i = this.state.tasks.findIndex(t => t.id === task.id);
      if (i >= 0) {
        this.state.tasks[i] = { ...this.state.tasks[i], ...task, updatedAt: now };
        this._sync('set', 'tasks', this.state.tasks[i]);
      }
    } else {
      task.id          = uid('t');
      task.createdAt   = now;
      task.updatedAt   = now;
      task.done        = false;
      task.notified    = {};
      task.createdBy   = this.state.meta.uid || null;
      task.escalating  = task.escalating ?? false;
      this.state.tasks.unshift(task);
      this._sync('set', 'tasks', task);
    }
    this._save();
    return task.id;
  }

  toggleTask(id) {
    const t = this.state.tasks.find(t => t.id === id);
    if (!t) return;
    t.done        = !t.done;
    t.completedAt = t.done ? new Date().toISOString() : null;
    t.updatedAt   = new Date().toISOString();
    this._sync('set', 'tasks', t);
    this._save();
  }

  deleteTask(id) {
    this.state.tasks = this.state.tasks.filter(t => t.id !== id);
    this._sync('delete', 'tasks', { id });
    this._save();
  }

  /* ─── Courses ────────────────────────────────────────────────── */
  upsertCourse(course) {
    const now = new Date().toISOString();
    if (course.id) {
      const i = this.state.courses.findIndex(c => c.id === course.id);
      if (i >= 0) { this.state.courses[i] = { ...this.state.courses[i], ...course, updatedAt: now }; }
    } else {
      course.id        = uid('c');
      course.createdAt = now;
      course.updatedAt = now;
      this.state.courses.push(course);
    }
    this._sync('set', 'courses', course);
    this._save();
    return course.id;
  }

  deleteCourse(id) {
    this.state.courses = this.state.courses.filter(c => c.id !== id);
    this.state.tasks.forEach(t => { if (t.courseId === id) t.courseId = ''; });
    this._sync('delete', 'courses', { id });
    this._save();
  }

  /* ─── Tags ───────────────────────────────────────────────────── */
  upsertTag(tag) {
    const now = new Date().toISOString();
    if (tag.id) {
      const i = this.state.tags.findIndex(t => t.id === tag.id);
      if (i >= 0) { this.state.tags[i] = { ...this.state.tags[i], ...tag, updatedAt: now }; }
    } else {
      tag.id        = uid('tag');
      tag.createdAt = now;
      tag.updatedAt = now;
      this.state.tags.push(tag);
    }
    this._sync('set', 'tags', tag);
    this._save();
    return tag.id;
  }

  deleteTag(id) {
    this.state.tags  = this.state.tags.filter(t => t.id !== id);
    this.state.tasks.forEach(t => { t.tagIds = (t.tagIds || []).filter(x => x !== id); });
    this._sync('delete', 'tags', { id });
    this._save();
  }

  /* ─── Calendar Events ────────────────────────────────────────── */
  upsertEvent(ev) {
    const now = new Date().toISOString();
    if (ev.id) {
      const i = this.state.events.findIndex(e => e.id === ev.id);
      if (i >= 0) { this.state.events[i] = { ...this.state.events[i], ...ev, updatedAt: now }; }
    } else {
      ev.id        = uid('ev');
      ev.createdAt = now;
      ev.updatedAt = now;
      ev.createdBy = this.state.meta.uid || null;
      this.state.events.push(ev);
    }
    this._sync('set', 'events', ev);
    this._save();
    return ev.id;
  }

  deleteEvent(id) {
    this.state.events = this.state.events.filter(e => e.id !== id);
    this._sync('delete', 'events', { id });
    this._save();
  }

  /* ─── Settings ───────────────────────────────────────────────── */
  setSetting(key, value) {
    this.settings[key] = value;
    this._saveSettings();
  }
  applySettings(patch) {
    this.settings = { ...this.settings, ...patch };
    this._saveSettings();
  }

  /* ─── Bulk ───────────────────────────────────────────────────── */
  exportData() {
    return JSON.stringify({ state: this.state, settings: this.settings, exportedAt: new Date().toISOString() }, null, 2);
  }

  importData(json) {
    const data = typeof json === 'string' ? safeJSON(json) : json;
    if (!data) throw new Error('Archivo inválido');
    if (data.state) this.state = { ...DEFAULT_STATE, ...data.state, events: data.state.events || [] };
    if (data.settings) this.settings = { ...DEFAULT_SETTINGS, ...data.settings };
    this._save();
    this._saveSettings();
  }

  reset() {
    this.state    = structuredClone(DEFAULT_STATE);
    this.settings = { ...DEFAULT_SETTINGS };
    this._save();
    this._saveSettings();
  }

  /** Hydrata el store con datos de Firestore (llamado por sync.js al login). */
  hydrateFromRemote(remoteState) {
    this.state = { ...DEFAULT_STATE, ...remoteState, events: remoteState.events || [] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    this.dispatchEvent(new CustomEvent('change', { detail: this.state }));
  }

  /* ─── Seed ───────────────────────────────────────────────────── */
  seedSampleIfEmpty() {
    if (this.state.courses.length || this.state.tags.length || this.state.tasks.length) return;
    const c1 = uid('c'), c2 = uid('c');
    const t1 = uid('tag'), t2 = uid('tag'), t3 = uid('tag'), t4 = uid('tag');
    this.state.courses.push(
      { id: c1, name: 'Cálculo II',       code: 'MAT202', teacher: '', color: '#4F6BFF', createdAt: new Date().toISOString() },
      { id: c2, name: 'Programación Web', code: 'INF210', teacher: '', color: '#22C55E', createdAt: new Date().toISOString() },
    );
    this.state.tags.push(
      { id: t1, name: 'Tarea',         category: 'type',  color: '#4F6BFF', defaultPriority: 'medium' },
      { id: t2, name: 'Investigación', category: 'type',  color: '#6E5BFF', defaultPriority: 'medium' },
      { id: t3, name: 'Examen',        category: 'type',  color: '#EF4444', defaultPriority: 'high' },
      { id: t4, name: 'Ciclo III',     category: 'cycle', color: '#22C55E', defaultPriority: '' },
    );
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const tIso = tomorrow.toISOString().slice(0, 10);
    this.state.tasks.push({
      id: uid('t'), title: 'Crea tu primera tarea con SUT',
      description: 'Haz clic aquí para editar.',
      courseId: c2, tagIds: [t1, t4],
      priority: 'medium', escalating: false,
      dueDate: tIso, dueTime: '23:59', reminder: '60',
      done: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), notified: {},
    });
    // Evento de ejemplo: semana de parciales
    const examStart = new Date(); examStart.setDate(examStart.getDate() + 5);
    const examEnd   = new Date(); examEnd.setDate(examEnd.getDate() + 9);
    this.state.events.push({
      id: uid('ev'), title: 'Semana de Parciales',
      type: 'exam', color: '#EF4444',
      startDate: examStart.toISOString().slice(0, 10),
      endDate:   examEnd.toISOString().slice(0, 10),
      description: 'Parciales de mitad de ciclo', allDay: true,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    this._save();
  }
}

export const store = new Store();

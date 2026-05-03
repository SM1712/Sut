import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Task, Course, Tag, CalendarEvent, Meta, Settings, AppState } from '../types';
import { uid, safeJSON, hexToHSL } from '../lib/utils';
import { STORAGE_KEY, SETTINGS_KEY } from '../lib/constants';

const DEFAULT_META: Meta = {
  createdAt: new Date().toISOString(),
  onboarded: false,
  spaceId: null,
  spaceName: '',
  spaceHistory: [],
  uid: null,
  email: null,
  displayName: null,
};

const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  accentColor: '#8B5CF6',
  buttonColor: '#8B5CF6',
  textColor: '',
  fontFamily: 'Inter',
  fontScale: 1,
  radius: 14,
};

const DEFAULT_STATE: AppState = {
  version: 2,
  tasks: [],
  courses: [],
  tags: [],
  events: [],
  meta: DEFAULT_META,
};

const loadState = (): AppState => {
  const raw = safeJSON<AppState>(localStorage.getItem(STORAGE_KEY))
           || safeJSON<AppState>(localStorage.getItem('sut.state.v1'));
  if (!raw) return structuredClone(DEFAULT_STATE);
  return {
    ...structuredClone(DEFAULT_STATE),
    ...raw,
    events: raw.events || [],
    meta: {
      ...DEFAULT_META,
      ...(raw.meta || {}),
      spaceHistory: (raw.meta as Meta & { spaceHistory?: Meta['spaceHistory'] })?.spaceHistory || [],
    },
  };
};

const loadSettings = (): Settings => {
  const raw = safeJSON<Settings>(localStorage.getItem(SETTINGS_KEY));
  return { ...DEFAULT_SETTINGS, ...(raw || {}) };
};

type SyncOp = 'set' | 'delete';
type SyncHook = (op: SyncOp, collection: string, data: Record<string, unknown>) => Promise<void>;

interface Store extends AppState {
  settings: Settings;
  _syncHook: SyncHook | null;

  /* Sync */
  registerSyncHook: (fn: SyncHook) => void;
  _sync: (op: SyncOp, col: string, data: Record<string, unknown>) => void;

  /* Persistence */
  _save: () => void;
  _saveSettings: () => void;

  /* Space */
  setSpaceId: (spaceId: string | null, spaceName?: string) => void;
  /** Add/update a space in the quick-switch history (max 8 entries). */
  addSpaceToHistory: (code: string, name: string) => void;
  /** Only clears auth fields (uid, email). Keeps space, data, history intact. */
  clearAuth: () => void;
  /** Full reset: clears auth + space + all data. Use only for hard reset. */
  clearSessionAndSpace: () => void;

  /* Onboarding */
  setOnboarded: (done?: boolean) => void;

  /* Tasks */
  upsertTask: (task: Partial<Task>) => string;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;

  /* Courses */
  upsertCourse: (course: Partial<Course>) => string;
  deleteCourse: (id: string) => void;

  /* Tags */
  upsertTag: (tag: Partial<Tag>) => string;
  deleteTag: (id: string) => void;

  /* Events */
  upsertEvent: (ev: Partial<CalendarEvent>) => string;
  deleteEvent: (id: string) => void;

  /* Settings */
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  applySettings: (patch: Partial<Settings>) => void;
  applyTheme: (settings?: Settings) => void;

  /* Bulk */
  exportData: () => string;
  importData: (json: string | object) => void;
  reset: () => void;
  hydrateFromRemote: (remoteState: Partial<AppState>) => void;
  /** Replace a single collection from a Firestore snapshot (real-time sync). */
  hydrateCollection: (col: 'tasks' | 'courses' | 'tags' | 'events', items: unknown[]) => void;
  seedSampleIfEmpty: () => void;
}

export const useStore = create<Store>()(
  subscribeWithSelector((set, get) => ({
    ...loadState(),
    settings: loadSettings(),
    _syncHook: null,

    registerSyncHook: (fn) => set({ _syncHook: fn }),

    _sync: (op, col, data) => {
      const { _syncHook } = get();
      if (_syncHook) _syncHook(op, col, data).catch(console.warn);
    },

    _save: () => {
      const state = get();
      const toSave: AppState = {
        version: state.version,
        tasks: state.tasks,
        courses: state.courses,
        tags: state.tags,
        events: state.events,
        meta: state.meta,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    },

    _saveSettings: () => {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(get().settings));
      get().applyTheme();
    },

    /* ── Space ── */
    setSpaceId: (spaceId, spaceName = '') => {
      const newMeta = { ...get().meta, spaceId: spaceId || null, spaceName: spaceName || '' };
      set({ meta: newMeta });
      get()._save();
    },

    addSpaceToHistory: (code, name) => {
      const prev = get().meta.spaceHistory || [];
      // Remove existing entry for same code, then prepend updated entry, cap at 8
      const filtered = prev.filter(e => e.code !== code);
      const updated: Meta['spaceHistory'] = [
        { code, name, joinedAt: new Date().toISOString() },
        ...filtered,
      ].slice(0, 8);
      set(s => ({ meta: { ...s.meta, spaceHistory: updated } }));
      get()._save();
    },

    clearAuth: () => {
      // Only clears uid/email. Keeps spaceId, spaceHistory, tasks, courses, etc.
      set(s => ({ meta: { ...s.meta, uid: null, email: null } }));
      get()._save();
    },

    clearSessionAndSpace: () => {
      // Full hard reset — preserves only creation date, onboarded flag, and space history
      const prev = get().meta;
      const newState = {
        ...structuredClone(DEFAULT_STATE),
        meta: {
          ...DEFAULT_META,
          createdAt:    prev.createdAt,
          onboarded:    prev.onboarded,
          spaceHistory: prev.spaceHistory || [],
        },
      };
      set(newState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    },

    /* ── Onboarding ── */
    setOnboarded: (done = true) => {
      set(s => ({ meta: { ...s.meta, onboarded: done } }));
      get()._save();
    },

    /* ── Tasks ── */
    upsertTask: (task) => {
      const now = new Date().toISOString();
      const { tasks, _sync, _save } = get();
      let taskId = task.id || '';
      if (task.id) {
        const updated = tasks.map(t => t.id === task.id ? { ...t, ...task, updatedAt: now } : t);
        const found = updated.find(t => t.id === task.id)!;
        set({ tasks: updated });
        _sync('set', 'tasks', found as unknown as Record<string, unknown>);
      } else {
        taskId = uid('t');
        const newTask: Task = {
          id: taskId,
          title: task.title || '',
          description: task.description || '',
          instructions: task.instructions || '',
          courseId: task.courseId || '',
          tagIds: task.tagIds || [],
          priority: task.priority || 'medium',
          escalating: task.escalating ?? false,
          dueDate: task.dueDate || '',
          dueTime: task.dueTime || '',
          reminder: task.reminder || '',
          done: false,
          createdAt: now,
          updatedAt: now,
          notified: {},
          createdBy: get().meta.email || get().meta.uid,
          audioUrl: task.audioUrl || null,
          imageUrls: task.imageUrls || [],
        };
        set({ tasks: [newTask, ...tasks] });
        _sync('set', 'tasks', newTask as unknown as Record<string, unknown>);
      }
      _save();
      return taskId;
    },

    toggleTask: (id) => {
      const { tasks, _sync, _save } = get();
      const updated = tasks.map(t => {
        if (t.id !== id) return t;
        const done = !t.done;
        return { ...t, done, completedAt: done ? new Date().toISOString() : null, updatedAt: new Date().toISOString() };
      });
      const found = updated.find(t => t.id === id)!;
      set({ tasks: updated });
      _sync('set', 'tasks', found as unknown as Record<string, unknown>);
      _save();
    },

    deleteTask: (id) => {
      const { _sync, _save } = get();
      set(s => ({ tasks: s.tasks.filter(t => t.id !== id) }));
      _sync('delete', 'tasks', { id });
      _save();
    },

    /* ── Courses ── */
    upsertCourse: (course) => {
      const now = new Date().toISOString();
      const { courses, _sync, _save } = get();
      let cId = course.id || '';
      let syncData: Record<string, unknown>;
      if (course.id) {
        const updated = courses.map(c => c.id === course.id ? { ...c, ...course, updatedAt: now } : c);
        const found = updated.find(c => c.id === course.id)!;
        set({ courses: updated });
        syncData = found as unknown as Record<string, unknown>;
      } else {
        cId = uid('c');
        const newCourse: Course = { id: cId, name: course.name || '', code: course.code || '', teacher: course.teacher || '', color: course.color || '#4F6BFF', createdAt: now, updatedAt: now };
        set({ courses: [...courses, newCourse] });
        syncData = newCourse as unknown as Record<string, unknown>;
      }
      _sync('set', 'courses', syncData);
      _save();
      return cId;
    },

    deleteCourse: (id) => {
      const { tasks, _sync, _save } = get();
      // Capture tasks that will be modified so we can sync them
      const affectedTasks = tasks
        .filter(t => t.courseId === id)
        .map(t => ({ ...t, courseId: '' }));
      set(s => ({
        courses: s.courses.filter(c => c.id !== id),
        tasks: s.tasks.map(t => t.courseId === id ? { ...t, courseId: '' } : t),
      }));
      _sync('delete', 'courses', { id });
      // Sync each affected task so Firestore reflects the cleared courseId
      affectedTasks.forEach(t => _sync('set', 'tasks', t as unknown as Record<string, unknown>));
      _save();
    },

    /* ── Tags ── */
    upsertTag: (tag) => {
      const now = new Date().toISOString();
      const { tags, _sync, _save } = get();
      let tId = tag.id || '';
      let syncData: Record<string, unknown>;
      if (tag.id) {
        const updated = tags.map(t => t.id === tag.id ? { ...t, ...tag, updatedAt: now } : t);
        const found = updated.find(t => t.id === tag.id)!;
        set({ tags: updated });
        syncData = found as unknown as Record<string, unknown>;
      } else {
        tId = uid('tag');
        const newTag: Tag = { id: tId, name: tag.name || '', category: tag.category || 'type', color: tag.color || '#4F6BFF', defaultPriority: tag.defaultPriority || '', createdAt: now };
        set({ tags: [...tags, newTag] });
        syncData = newTag as unknown as Record<string, unknown>;
      }
      _sync('set', 'tags', syncData);
      _save();
      return tId;
    },

    deleteTag: (id) => {
      const { tasks, _sync, _save } = get();
      // Capture tasks that had this tag so we can sync them
      const affectedTasks = tasks
        .filter(t => (t.tagIds || []).includes(id))
        .map(t => ({ ...t, tagIds: t.tagIds.filter(x => x !== id) }));
      set(s => ({
        tags: s.tags.filter(t => t.id !== id),
        tasks: s.tasks.map(t => ({ ...t, tagIds: (t.tagIds || []).filter(x => x !== id) })),
      }));
      _sync('delete', 'tags', { id });
      // Sync each affected task so Firestore reflects the removed tag
      affectedTasks.forEach(t => _sync('set', 'tasks', t as unknown as Record<string, unknown>));
      _save();
    },

    /* ── Events ── */
    upsertEvent: (ev) => {
      const now = new Date().toISOString();
      const { events, _sync, _save } = get();
      let evId = ev.id || '';
      let syncData: Record<string, unknown>;
      if (ev.id) {
        const updated = events.map(e => e.id === ev.id ? { ...e, ...ev, updatedAt: now } : e);
        const found = updated.find(e => e.id === ev.id)!;
        set({ events: updated });
        syncData = found as unknown as Record<string, unknown>;
      } else {
        evId = uid('ev');
        const newEv: CalendarEvent = {
          id: evId, title: ev.title || '', description: ev.description || '',
          type: ev.type || 'custom', color: ev.color || '#6E5BFF',
          startDate: ev.startDate || '', endDate: ev.endDate || ev.startDate || '',
          allDay: true, createdAt: now, updatedAt: now, createdBy: get().meta.email || get().meta.uid,
        };
        set({ events: [...events, newEv] });
        syncData = newEv as unknown as Record<string, unknown>;
      }
      _sync('set', 'events', syncData);
      _save();
      return evId;
    },

    deleteEvent: (id) => {
      const { _sync, _save } = get();
      set(s => ({ events: s.events.filter(e => e.id !== id) }));
      _sync('delete', 'events', { id });
      _save();
    },

    /* ── Settings ── */
    setSetting: (key, value) => {
      set(s => ({ settings: { ...s.settings, [key]: value } }));
      get()._saveSettings();
    },

    applySettings: (patch) => {
      set(s => ({ settings: { ...s.settings, ...patch } }));
      get()._saveSettings();
    },

    applyTheme: (settings) => {
      const s = settings || get().settings;
      const root = document.documentElement;
      root.setAttribute('data-theme', s.theme);
      const { h, sat, l } = (() => { const hsl = hexToHSL(s.accentColor); return { h: hsl.h, sat: hsl.s, l: hsl.l }; })();
      root.style.setProperty('--accent-h', String(h));
      root.style.setProperty('--accent-s', `${sat}%`);
      root.style.setProperty('--accent-l', `${l}%`);
      const bHsl = hexToHSL(s.buttonColor);
      root.style.setProperty('--button-h', String(bHsl.h));
      root.style.setProperty('--button-s', `${bHsl.s}%`);
      root.style.setProperty('--button-l', `${bHsl.l}%`);
      root.style.setProperty('--font-sans', s.fontFamily === 'system-ui' ? 'system-ui, -apple-system, sans-serif' : `'${s.fontFamily}', system-ui, sans-serif`);
      root.style.setProperty('--font-scale', String(s.fontScale));
      root.style.setProperty('--radius', `${s.radius}px`);
      root.style.setProperty('--radius-sm', `${Math.max(4, s.radius - 4)}px`);
      root.style.setProperty('--radius-lg', `${s.radius + 8}px`);
    },

    /* ── Bulk ── */
    exportData: () => {
      const s = get();
      return JSON.stringify({ state: { version: s.version, tasks: s.tasks, courses: s.courses, tags: s.tags, events: s.events, meta: s.meta }, settings: s.settings, exportedAt: new Date().toISOString() }, null, 2);
    },

    importData: (json) => {
      const data = typeof json === 'string' ? safeJSON<{ state?: Partial<AppState>; settings?: Partial<Settings> }>(json) : json as { state?: Partial<AppState>; settings?: Partial<Settings> };
      if (!data) throw new Error('Archivo inválido');
      if (data.state) set({ ...DEFAULT_STATE, ...data.state, events: data.state.events || [] });
      if (data.settings) set(s => ({ settings: { ...s.settings, ...data.settings } }));
      get()._save();
      get()._saveSettings();
      // Sync all imported items to Firestore (no-op if not logged in)
      const state = get();
      for (const col of ['tasks', 'courses', 'tags', 'events'] as const) {
        for (const item of state[col]) {
          state._sync('set', col, item as unknown as Record<string, unknown>);
        }
      }
    },

    reset: () => {
      set({ ...structuredClone(DEFAULT_STATE), settings: { ...DEFAULT_SETTINGS } });
      get()._save();
      get()._saveSettings();
    },

    hydrateFromRemote: (remoteState) => {
      set({ ...DEFAULT_STATE, ...remoteState, events: remoteState.events || [] });
      get()._save();
    },

    hydrateCollection: (col, items) => {
      set({ [col]: items });
      get()._save();
    },

    seedSampleIfEmpty: () => {
      const { courses, tags, tasks } = get();
      if (courses.length || tags.length || tasks.length) return;
      const c1 = uid('c'), c2 = uid('c');
      const t1 = uid('tag'), t2 = uid('tag'), t3 = uid('tag'), t4 = uid('tag');
      const now = new Date().toISOString();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      const examStart = new Date(); examStart.setDate(examStart.getDate() + 5);
      const examEnd = new Date(); examEnd.setDate(examEnd.getDate() + 9);

      set({
        courses: [
          { id: c1, name: 'Cálculo II', code: 'MAT202', teacher: '', color: '#4F6BFF', createdAt: now },
          { id: c2, name: 'Programación Web', code: 'INF210', teacher: '', color: '#22C55E', createdAt: now },
        ],
        tags: [
          { id: t1, name: 'Tarea', category: 'type', color: '#4F6BFF', defaultPriority: 'medium', createdAt: now },
          { id: t2, name: 'Investigación', category: 'type', color: '#6E5BFF', defaultPriority: 'medium', createdAt: now },
          { id: t3, name: 'Examen', category: 'type', color: '#EF4444', defaultPriority: 'high', createdAt: now },
          { id: t4, name: 'Ciclo III', category: 'cycle', color: '#22C55E', defaultPriority: '', createdAt: now },
        ],
        tasks: [{
          id: uid('t'), title: 'Crea tu primera tarea con SUT',
          description: 'Haz clic aquí para editar.', instructions: '',
          courseId: c2, tagIds: [t1, t4], priority: 'medium', escalating: false,
          dueDate: tomorrow.toISOString().slice(0, 10), dueTime: '23:59', reminder: '60',
          done: false, createdAt: now, updatedAt: now, notified: {}, createdBy: null,
        }],
        events: [{
          id: uid('ev'), title: 'Semana de Parciales',
          description: 'Parciales de mitad de ciclo',
          type: 'exam', color: '#EF4444',
          startDate: examStart.toISOString().slice(0, 10),
          endDate: examEnd.toISOString().slice(0, 10),
          allDay: true, createdAt: now, updatedAt: now, createdBy: null,
        }],
      });
      get()._save();
    },
  }))
);

// Re-export type alias
export type { Store };

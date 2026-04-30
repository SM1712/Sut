import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useStore } from '../store';
import { computeEffectivePriority, parseDue } from '../lib/utils';
import { PRIORITY_ORDER } from '../lib/constants';
import TaskCard from '../components/tasks/TaskCard';
import TaskModal from '../components/tasks/TaskModal';
import type { Priority } from '../types';

export default function TasksView() {
  const tasks = useStore(s => s.tasks);
  const courses = useStore(s => s.courses);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [prioFilter, setPrioFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [sortBy, setSortBy] = useState('date');
  const location = useLocation();

  // Support ?new=1 from PWA shortcut, FAB, and TopBar button via custom event
  useEffect(() => {
    if (new URLSearchParams(location.search).get('new') === '1') {
      setEditId(null); setOpen(true);
    }
  }, [location.search]);

  useEffect(() => {
    const handler = () => { setEditId(null); setOpen(true); };
    window.addEventListener('sut:new-task', handler);
    return () => window.removeEventListener('sut:new-task', handler);
  }, []);

  const filtered = useMemo(() => {
    let list = [...tasks];
    if (courseFilter) list = list.filter(t => t.courseId === courseFilter);
    if (prioFilter)   list = list.filter(t => computeEffectivePriority(t) === prioFilter as Priority);
    if (statusFilter === 'pending') list = list.filter(t => !t.done);
    if (statusFilter === 'done')    list = list.filter(t => t.done);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t => t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
    }
    if (sortBy === 'priority') list.sort((a, b) => PRIORITY_ORDER[computeEffectivePriority(a)] - PRIORITY_ORDER[computeEffectivePriority(b)]);
    else if (sortBy === 'created') list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else if (sortBy === 'alpha') list.sort((a, b) => a.title.localeCompare(b.title));
    else list.sort((a, b) => { const da = parseDue(a.dueDate, a.dueTime), db = parseDue(b.dueDate, b.dueTime); if (!da && !db) return 0; if (!da) return 1; if (!db) return -1; return da.getTime() - db.getTime(); });
    return list;
  }, [tasks, courseFilter, prioFilter, statusFilter, search, sortBy]);

  const openNew  = () => { setEditId(null); setOpen(true); };
  const openEdit = (id: string) => { setEditId(id); setOpen(true); };

  return (
    <div className="page-content">
      {/* Header */}
      <div className="task-list-header">
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Tareas</h1>
        <button className="btn btn--primary" onClick={openNew}>
          <Plus size={16} /> Nueva tarea
        </button>
      </div>

      {/* Search + Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
        <div className="search-bar">
          <Search size={16} className="search-bar__icon" />
          <input
            placeholder="Buscar tareas..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="icon-btn" onClick={() => setSearch('')} style={{ width: 24, height: 24 }}>×</button>
          )}
        </div>

        <div className="filters-bar">
          <SlidersHorizontal size={15} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />

          <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">Todas</option>
            <option value="pending">Pendientes</option>
            <option value="done">Completadas</option>
          </select>

          <select className="filter-select" value={courseFilter} onChange={e => setCourseFilter(e.target.value)}>
            <option value="">Todos los cursos</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select className="filter-select" value={prioFilter} onChange={e => setPrioFilter(e.target.value)}>
            <option value="">Cualquier prioridad</option>
            <option value="urgent">Urgente</option>
            <option value="high">Alta</option>
            <option value="medium">Media</option>
            <option value="low">Baja</option>
          </select>

          <select className="filter-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="date">Por fecha</option>
            <option value="priority">Por prioridad</option>
            <option value="created">Más recientes</option>
            <option value="alpha">A-Z</option>
          </select>
        </div>
      </div>

      {/* Count */}
      <div style={{ fontSize: '0.875rem', color: 'var(--text-mute)', marginBottom: 'var(--sp-3)' }}>
        {filtered.length} tarea{filtered.length !== 1 ? 's' : ''}
        {search && ` para "${search}"`}
      </div>

      {/* List */}
      <AnimatePresence mode="popLayout">
        {filtered.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="empty-state"
          >
            <div className="empty-state__art">
              <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="56" height="56">
                <path d="M22 30l5 5 14-14"/><path d="M52 32v18a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4h22"/>
              </svg>
            </div>
            <div className="empty-state__title">
              {search ? 'Sin resultados' : statusFilter === 'done' ? 'Sin completadas' : '¡Todo listo!'}
            </div>
            <div className="empty-state__text">
              {search ? 'Intenta con otros términos.' : statusFilter === 'done' ? 'Completa algunas tareas primero.' : 'Crea tu primera tarea para empezar.'}
            </div>
            {!search && statusFilter !== 'done' && (
              <button className="btn btn--primary" onClick={openNew} style={{ marginTop: 'var(--sp-3)' }}>
                <Plus size={16} /> Nueva tarea
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div className="tasks-list">
            {filtered.map(t => (
              <TaskCard key={t.id} task={t} onEdit={openEdit} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <TaskModal open={open} editId={editId} onClose={() => setOpen(false)} />
    </div>
  );
}

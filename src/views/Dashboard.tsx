import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Clock, AlertTriangle, BookOpen, Plus, Users, Wifi } from 'lucide-react';
import { useStore } from '../store';
import { parseDue, computeEffectivePriority } from '../lib/utils';
import TaskCard from '../components/tasks/TaskCard';
import TaskModal from '../components/tasks/TaskModal';
import SpacePanel from '../components/spaces/SpacePanel';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.22 } } };

type Filter = 'all' | 'today' | 'week' | 'overdue';

export default function Dashboard() {
  const tasks = useStore(s => s.tasks);
  const courses = useStore(s => s.courses);
  const meta = useStore(s => s.meta);

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [spaceOpen, setSpaceOpen] = useState(false);

  // Listen for FAB / TopBar "new task" event
  useEffect(() => {
    const handler = () => { setEditId(null); setTaskModalOpen(true); };
    window.addEventListener('sut:new-task', handler);
    return () => window.removeEventListener('sut:new-task', handler);
  }, []);

  const now = new Date();
  const sevenAgo = new Date(now); sevenAgo.setDate(now.getDate() - 7);

  const stats = useMemo(() => {
    // Start of today (midnight) — tasks due today but not yet past are NOT overdue
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueToday  = tasks.filter(t => {
      if (t.done || !t.dueDate) return false;
      // Compare only the date part, not the time
      const d = new Date(t.dueDate + 'T00:00:00');
      return d.toDateString() === now.toDateString();
    }).length;
    const overdue   = tasks.filter(t => {
      if (t.done || !t.dueDate) return false;
      // A task is overdue only if its DATE is strictly before today
      // (tasks due today but past their time still show in "due today", not "overdue")
      const d = new Date(t.dueDate + 'T00:00:00');
      return d < startOfToday;
    }).length;
    const doneWeek  = tasks.filter(t => t.done && t.completedAt && new Date(t.completedAt) >= sevenAgo).length;
    const pending   = tasks.filter(t => !t.done).length;
    return { dueToday, overdue, doneWeek, pending };
  }, [tasks]);

  const priorityCounts = useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0, urgent: 0 };
    tasks.filter(t => !t.done).forEach(t => { counts[computeEffectivePriority(t)]++; });
    return counts;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let list = tasks.filter(t => {
      if (filter === 'all') return !t.done;
      const d = parseDue(t.dueDate, t.dueTime);
      if (filter === 'today')   return !t.done && t.dueDate && new Date(t.dueDate + 'T00:00:00').toDateString() === now.toDateString();
      if (filter === 'week')    { const w = new Date(now); w.setDate(now.getDate() + 7); return d && !t.done && d >= startOfToday && d <= w; }
      if (filter === 'overdue') return !t.done && t.dueDate && new Date(t.dueDate + 'T00:00:00') < startOfToday;
      return !t.done;
    });
    return list.sort((a, b) => {
      const da = parseDue(a.dueDate, a.dueTime), db = parseDue(b.dueDate, b.dueTime);
      if (!da && !db) return 0; if (!da) return 1; if (!db) return -1;
      return da.getTime() - db.getTime();
    }).slice(0, 8);
  }, [tasks, filter]);

  const hour = now.getHours();
  const greeting = hour < 6 ? 'Buenas noches' : hour < 13 ? 'Buen día' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const greetingSub = stats.overdue > 0
    ? `Tienes ${stats.overdue} tarea${stats.overdue > 1 ? 's' : ''} atrasada${stats.overdue > 1 ? 's' : ''}.`
    : stats.pending === 0 ? '¡Estás al día! Disfruta el descanso 🎉'
    : `Tienes ${stats.pending} tarea${stats.pending > 1 ? 's' : ''} pendiente${stats.pending > 1 ? 's' : ''}.`;

  const openEdit = (id: string) => { setEditId(id); setTaskModalOpen(true); };
  const openNew  = () => { setEditId(null); setTaskModalOpen(true); };

  const STAT_CARDS = [
    { label: 'Para hoy',     value: stats.dueToday, icon: Clock,         color: 'var(--accent)',  bg: 'var(--accent-soft)' },
    { label: 'Atrasadas',    value: stats.overdue,  icon: AlertTriangle,  color: 'var(--danger)',  bg: 'var(--danger-soft)' },
    { label: 'Completadas',  value: stats.doneWeek, icon: CheckCircle2,   color: 'var(--success)', bg: 'var(--success-soft)', sub: 'esta semana' },
    { label: 'Cursos',       value: courses.length, icon: BookOpen,       color: 'var(--info)',    bg: 'var(--info-soft)' },
  ];

  return (
    <div className="page-content">
      {/* Shared-space banner */}
      <AnimatePresence>
        {meta.spaceId && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.22 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
              padding: 'var(--sp-2) var(--sp-4)',
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 'var(--sp-2)',
              fontSize: '0.8125rem',
              color: 'var(--accent)',
              fontWeight: 500,
            }}
          >
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: 'var(--success)',
              animation: 'pulse-green 1.8s ease-out infinite', flexShrink: 0,
            }} />
            <Wifi size={13} />
            <span style={{ flex: 1 }}>
              Espacio <strong>{meta.spaceName}</strong> — tareas, cursos, etiquetas y calendario compartidos en tiempo real
            </span>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => setSpaceOpen(true)}
              style={{ fontSize: '0.75rem', padding: '2px 8px' }}
            >
              <Users size={12} /> Ver
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Greeting */}
      <motion.div
        className="greeting-header"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--sp-3)' }}>
          <div>
            <h1 className="greeting-text">{greeting} ✨</h1>
            <p className="greeting-sub">{greetingSub}</p>
          </div>
          <button
            className="btn btn--secondary btn--sm"
            onClick={() => setSpaceOpen(true)}
            style={{ flexShrink: 0, marginTop: 4 }}
          >
            <Users size={15} />
            {meta.spaceId ? meta.spaceName || 'Espacio' : 'Colaborar'}
          </button>
        </div>
      </motion.div>

      {/* Stats grid */}
      <motion.div
        className="dashboard-grid"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {STAT_CARDS.map(({ label, value, icon: Icon, color, bg, sub }) => (
          <motion.div key={label} variants={item} className="stat-card">
            <div className="stat-card__icon" style={{ background: bg, color }}>
              <Icon size={18} />
            </div>
            <div className="stat-card__value" style={{ color }}>{value}</div>
            <div className="stat-card__label">{label}</div>
            {sub && <div className="stat-card__sub">{sub}</div>}
          </motion.div>
        ))}
      </motion.div>

      {/* Main content */}
      <div className="dashboard-main">
        {/* Tasks */}
        <div>
          <div className="section-header">
            <h2 className="section-title">Tareas pendientes</h2>
            <button className="btn btn--primary btn--sm" onClick={openNew}>
              <Plus size={15} /> Nueva
            </button>
          </div>

          {/* Filter chips */}
          <div className="filters-bar" style={{ marginBottom: 'var(--sp-4)' }}>
            {(['all', 'today', 'week', 'overdue'] as Filter[]).map(f => {
              const labels = { all: 'Todas', today: 'Hoy', week: 'Esta semana', overdue: 'Atrasadas' };
              return (
                <button key={f} className={`chip${filter === f ? ' is-active' : ''}`} onClick={() => setFilter(f)}>
                  {labels[f]}
                </button>
              );
            })}
          </div>

          <div className="tasks-list">
            {filteredTasks.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--sp-7) 0' }}>
                <CheckCircle2 size={40} style={{ color: 'var(--text-faint)', marginBottom: 'var(--sp-2)' }} />
                <div className="empty-state__title">Nada aquí</div>
                <div className="empty-state__text">Prueba otro filtro o crea una tarea.</div>
              </div>
            ) : (
              filteredTasks.map(t => <TaskCard key={t.id} task={t} onEdit={openEdit} />)
            )}
          </div>
        </div>

        {/* Priority summary */}
        <div>
          <div className="section-header">
            <h2 className="section-title">Por prioridad</h2>
          </div>
          <div className="priority-summary">
            {([
              { key: 'urgent', label: 'Urgente', color: 'var(--prio-urgent)' },
              { key: 'high',   label: 'Alta',    color: 'var(--prio-high)' },
              { key: 'medium', label: 'Media',   color: 'var(--prio-medium)' },
              { key: 'low',    label: 'Baja',    color: 'var(--prio-low)' },
            ] as const).map(({ key, label, color }) => (
              <div key={key} className="priority-row">
                <div className="priority-row__dot" style={{ '--c': color } as React.CSSProperties} />
                <span className="priority-row__label">{label}</span>
                <span className="priority-row__count">{priorityCounts[key]}</span>
              </div>
            ))}
          </div>

          {courses.length > 0 && (
            <>
              <div className="section-header" style={{ marginTop: 'var(--sp-6)' }}>
                <h2 className="section-title">Cursos</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                {courses.map(c => {
                  const count = tasks.filter(t => t.courseId === c.id && !t.done).length;
                  return (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-3) var(--sp-4)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontWeight: 500, fontSize: '0.9375rem' }}>{c.name}</span>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-mute)' }}>{count} tarea{count !== 1 ? 's' : ''}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <TaskModal open={taskModalOpen} editId={editId} onClose={() => setTaskModalOpen(false)} />
      <SpacePanel open={spaceOpen} onClose={() => setSpaceOpen(false)} />
    </div>
  );
}

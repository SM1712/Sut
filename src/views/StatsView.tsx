import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, CheckCircle2, Flame, BookOpen, Target, Award } from 'lucide-react';
import { useStore } from '../store';
import { computeEffectivePriority } from '../lib/utils';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item      = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.24 } } };

/* ── Helpers ── */

/** Returns YYYY-MM-DD in the *local* timezone (not UTC). */
function localDatestamp(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Extract YYYY-MM-DD from an ISO string already stored in UTC (completedAt). */
function datestampFromISO(iso: string): string {
  // Parse as local time to match the user's calendar date
  const d = new Date(iso);
  return localDatestamp(d);
}

function today() { return localDatestamp(new Date()); }

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDatestamp(d);
}

function dayLabel(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es', { weekday: 'short' });
}

/* ── Radial ring component ── */
function RingProgress({ pct, size = 72, stroke = 7, color = 'var(--accent)' }: {
  pct: number; size?: number; stroke?: number; color?: string;
}) {
  const r  = (size - stroke) / 2;
  const cx = size / 2;
  const circum = 2 * Math.PI * r;
  const dash   = circum * Math.min(pct, 100) / 100;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circum}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  );
}

/* ── Bar chart day ── */
function DayBar({ label, count, max, isToday }: { label: string; count: number; max: number; isToday: boolean }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: count > 0 ? 'var(--accent)' : 'var(--text-faint)' }}>
        {count > 0 ? count : ''}
      </span>
      <div style={{ width: '100%', height: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <div style={{
          width: '70%', height: `${Math.max(pct, count > 0 ? 6 : 0)}%`,
          background: isToday ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 45%, transparent)',
          borderRadius: '4px 4px 0 0',
          transition: 'height 0.5s ease',
          minHeight: count > 0 ? 6 : 0,
        }} />
      </div>
      <span style={{ fontSize: '0.6875rem', color: isToday ? 'var(--accent)' : 'var(--text-mute)', fontWeight: isToday ? 600 : 400 }}>
        {label}
      </span>
    </div>
  );
}

export default function StatsView() {
  const tasks   = useStore(s => s.tasks);
  const courses = useStore(s => s.courses);

  /* ── Aggregations ── */
  const stats = useMemo(() => {
    const total    = tasks.length;
    const done     = tasks.filter(t => t.done).length;
    const pending  = total - done;
    const pct      = total > 0 ? Math.round((done / total) * 100) : 0;

    // Weekly activity (last 7 days, including today)
    const weekDays = Array.from({ length: 7 }, (_, i) => daysAgo(6 - i));
    const weekCounts: Record<string, number> = {};
    weekDays.forEach(d => { weekCounts[d] = 0; });
    tasks.forEach(t => {
      if (t.done && t.completedAt) {
        const d = datestampFromISO(t.completedAt);
        if (weekCounts[d] !== undefined) weekCounts[d]++;
      }
    });
    const weekMax = Math.max(...Object.values(weekCounts), 1);

    // Streak: consecutive days (going backwards from today) with ≥1 completed task
    const completedDates = new Set(
      tasks.filter(t => t.done && t.completedAt).map(t => datestampFromISO(t.completedAt!))
    );
    let streak = 0;
    let cur = new Date();
    // If nothing completed today, start from yesterday
    if (!completedDates.has(localDatestamp(cur))) {
      cur.setDate(cur.getDate() - 1);
    }
    while (completedDates.has(localDatestamp(cur))) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    }

    // Best day
    const bestDay = Object.entries(weekCounts).sort((a, b) => b[1] - a[1])[0];

    // By-course
    const byCourse = courses.map(c => {
      const ctasks = tasks.filter(t => t.courseId === c.id);
      const cdone  = ctasks.filter(t => t.done).length;
      return { course: c, total: ctasks.length, done: cdone };
    }).filter(x => x.total > 0).sort((a, b) => b.total - a.total);

    // Tasks without course
    const noCourse = tasks.filter(t => !t.courseId);
    const noCd = noCourse.filter(t => t.done).length;
    if (noCourse.length > 0) {
      byCourse.push({ course: { id: '', name: 'Sin curso', color: 'var(--text-faint)', code: '', teacher: '', createdAt: '' }, total: noCourse.length, done: noCd });
    }

    // Priority distribution (pending only)
    const prioCounts = { low: 0, medium: 0, high: 0, urgent: 0 };
    tasks.filter(t => !t.done).forEach(t => { prioCounts[computeEffectivePriority(t)]++; });

    return { total, done, pending, pct, weekDays, weekCounts, weekMax, streak, bestDay, byCourse, prioCounts };
  }, [tasks, courses]);

  const PRIO_CONFIG = [
    { key: 'urgent' as const, label: 'Urgente', color: 'var(--prio-urgent)' },
    { key: 'high'   as const, label: 'Alta',    color: 'var(--prio-high)' },
    { key: 'medium' as const, label: 'Media',   color: 'var(--prio-medium)' },
    { key: 'low'    as const, label: 'Baja',    color: 'var(--prio-low)' },
  ];
  const maxPrio = Math.max(...Object.values(stats.prioCounts), 1);

  return (
    <div className="page-content">
      <motion.div
        className="greeting-header"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="greeting-text" style={{ fontSize: '1.5rem' }}>Estadísticas 📊</h1>
        <p className="greeting-sub">Tu rendimiento de un vistazo.</p>
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}
      >

        {/* ── Top KPI cards ── */}
        <motion.div variants={item} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--sp-3)' }}>
          {/* Completion rate */}
          <div className="stat-card" style={{ alignItems: 'center', textAlign: 'center' }}>
            <RingProgress pct={stats.pct} color="var(--success)" />
            <div className="stat-card__value" style={{ color: 'var(--success)', fontSize: '1.5rem' }}>{stats.pct}%</div>
            <div className="stat-card__label">Completadas</div>
            <div className="stat-card__sub">{stats.done} de {stats.total}</div>
          </div>

          {/* Pending */}
          <div className="stat-card" style={{ alignItems: 'center', textAlign: 'center' }}>
            <div className="stat-card__icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              <Target size={18} />
            </div>
            <div className="stat-card__value" style={{ color: 'var(--accent)' }}>{stats.pending}</div>
            <div className="stat-card__label">Pendientes</div>
          </div>

          {/* Streak */}
          <div className="stat-card" style={{ alignItems: 'center', textAlign: 'center' }}>
            <div className="stat-card__icon" style={{ background: 'color-mix(in srgb, var(--warn) 15%, transparent)', color: 'var(--warn)' }}>
              <Flame size={18} />
            </div>
            <div className="stat-card__value" style={{ color: 'var(--warn)' }}>{stats.streak}</div>
            <div className="stat-card__label">Racha</div>
            <div className="stat-card__sub">{stats.streak === 1 ? 'día' : 'días'} seguidos</div>
          </div>

          {/* Best day */}
          <div className="stat-card" style={{ alignItems: 'center', textAlign: 'center' }}>
            <div className="stat-card__icon" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
              <Award size={18} />
            </div>
            <div className="stat-card__value" style={{ color: 'var(--success)' }}>{stats.bestDay?.[1] || 0}</div>
            <div className="stat-card__label">Mejor día</div>
            <div className="stat-card__sub">esta semana</div>
          </div>
        </motion.div>

        {/* ── Weekly activity bar chart ── */}
        <motion.div variants={item} className="stat-card" style={{ alignItems: 'stretch' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
            <TrendingUp size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Actividad semanal</span>
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-1)', alignItems: 'flex-end' }}>
            {stats.weekDays.map(d => (
              <DayBar
                key={d}
                label={dayLabel(d)}
                count={stats.weekCounts[d] ?? 0}
                max={stats.weekMax}
                isToday={d === today()}
              />
            ))}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: 'var(--sp-2)', textAlign: 'center' }}>
            Tareas completadas por día (últimos 7 días)
          </p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--sp-5)' }}>

          {/* ── By-course breakdown ── */}
          {stats.byCourse.length > 0 && (
            <motion.div variants={item} className="stat-card" style={{ alignItems: 'stretch' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
                <BookOpen size={16} style={{ color: 'var(--info)' }} />
                <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Por curso</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                {stats.byCourse.map(({ course, total, done }) => {
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  return (
                    <div key={course.id}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 4 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: course.color, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500 }}>{course.name}</span>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-mute)' }}>
                          {done}/{total} ({pct}%)
                        </span>
                      </div>
                      <div style={{ height: 5, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: course.color !== 'var(--text-faint)' ? course.color : 'var(--text-faint)',
                          borderRadius: 99,
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── Priority distribution ── */}
          <motion.div variants={item} className="stat-card" style={{ alignItems: 'stretch' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--accent)' }} />
              <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Prioridad pendiente</span>
            </div>
            {stats.pending === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--sp-5) 0', color: 'var(--text-faint)', fontSize: '0.875rem' }}>
                🎉 Sin tareas pendientes
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                {PRIO_CONFIG.map(({ key, label, color }) => {
                  const count = stats.prioCounts[key];
                  const barPct = Math.round((count / maxPrio) * 100);
                  return (
                    <div key={key}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 4 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: '0.875rem' }}>{label}</span>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-mute)', fontVariantNumeric: 'tabular-nums' }}>
                          {count}
                        </span>
                      </div>
                      <div style={{ height: 5, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${barPct}%`,
                          background: color,
                          borderRadius: 99,
                          transition: 'width 0.5s ease',
                          opacity: count === 0 ? 0 : 1,
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>

        {/* ── Empty state ── */}
        {stats.total === 0 && (
          <motion.div variants={item} style={{ textAlign: 'center', padding: 'var(--sp-10) 0', color: 'var(--text-faint)' }}>
            <TrendingUp size={48} style={{ marginBottom: 'var(--sp-3)', opacity: 0.3 }} />
            <p style={{ fontSize: '1rem' }}>Aún no hay datos para mostrar.</p>
            <p style={{ fontSize: '0.875rem' }}>Crea algunas tareas y completa algunas para ver tus estadísticas.</p>
          </motion.div>
        )}

      </motion.div>
    </div>
  );
}

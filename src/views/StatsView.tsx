import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, CheckCircle2, Flame, BookOpen,
  Target, Award, CalendarCheck, ListTodo, Zap,
} from 'lucide-react';
import { useStore } from '../store';
import { computeEffectivePriority } from '../lib/utils';
import { useIsSmall } from '../hooks/useMediaQuery';

/* ── Animation variants ── */
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, type: 'spring', bounce: 0.25 } },
};
const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.4 } },
};

/* ── Date helpers ── */
function localDatestamp(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function datestampFromISO(iso: string) { return localDatestamp(new Date(iso)); }
function today() { return localDatestamp(new Date()); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return localDatestamp(d); }
function dayLabel(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es', { weekday: 'short' });
}

/* ── Radial ring ── */
function RingProgress({ pct, size = 96, stroke = 9, color = '#fff' }: {
  pct: number; size?: number; stroke?: number; color?: string;
}) {
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const circum = 2 * Math.PI * r;
  const dash = circum * Math.min(pct, 100) / 100;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={stroke} />
      <motion.circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke={color} strokeWidth={stroke} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
        initial={{ strokeDasharray: `0 ${circum}` }}
        animate={{ strokeDasharray: `${dash} ${circum}` }}
        transition={{ duration: 1.4, ease: 'easeOut', delay: 0.3 }}
      />
    </svg>
  );
}

/* ── Bar chart day ── */
function DayBar({ label, count, max, isToday }: { label: string; count: number; max: number; isToday: boolean }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="sv2-daybar">
      <span className="sv2-daybar__count">{count > 0 ? count : ''}</span>
      <div className="sv2-daybar__track">
        <motion.div
          className="sv2-daybar__fill"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          style={{
            height: `${Math.max(pct, count > 0 ? 8 : 0)}%`,
            background: isToday
              ? 'var(--accent)'
              : 'color-mix(in srgb, var(--accent) 35%, transparent)',
          }}
          transition={{ duration: 0.7, type: 'spring', bounce: 0.35, delay: 0.1 }}
        />
      </div>
      <span className={`sv2-daybar__label${isToday ? ' sv2-daybar__label--today' : ''}`}>{label}</span>
    </div>
  );
}

/* ── Mini radial for courses ── */
function MiniRing({ pct, color }: { pct: number; color: string }) {
  const size = 38; const stroke = 4;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const circum = 2 * Math.PI * r;
  const dash = circum * Math.min(pct, 100) / 100;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="color-mix(in srgb, var(--border) 80%, transparent)" strokeWidth={stroke} />
      <motion.circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke={color} strokeWidth={stroke} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
        initial={{ strokeDasharray: `0 ${circum}` }}
        whileInView={{ strokeDasharray: `${dash} ${circum}` }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      />
    </svg>
  );
}

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
export default function StatsView() {
  const tasks   = useStore(s => s.tasks);
  const courses = useStore(s => s.courses);
  const isSmall = useIsSmall();

  const stats = useMemo(() => {
    const total   = tasks.length;
    const done    = tasks.filter(t => t.done).length;
    const pending = total - done;
    const pct     = total > 0 ? Math.round((done / total) * 100) : 0;

    const todayStr       = today();
    const completedToday = tasks.filter(t => t.done && t.completedAt && datestampFromISO(t.completedAt) === todayStr).length;

    const weekDays = Array.from({ length: 7 }, (_, i) => daysAgo(6 - i));
    const weekCounts: Record<string, number> = {};
    weekDays.forEach(d => { weekCounts[d] = 0; });
    tasks.forEach(t => {
      if (t.done && t.completedAt) {
        const d = datestampFromISO(t.completedAt);
        if (weekCounts[d] !== undefined) weekCounts[d]++;
      }
    });
    const weekMax   = Math.max(...Object.values(weekCounts), 1);
    const weekTotal = Object.values(weekCounts).reduce((a, b) => a + b, 0);

    const completedDates = new Set(
      tasks.filter(t => t.done && t.completedAt).map(t => datestampFromISO(t.completedAt!))
    );
    let streak = 0;
    let cur = new Date();
    if (!completedDates.has(localDatestamp(cur))) cur.setDate(cur.getDate() - 1);
    while (completedDates.has(localDatestamp(cur))) { streak++; cur.setDate(cur.getDate() - 1); }

    const byCourse = courses.map(c => {
      const ct = tasks.filter(t => t.courseId === c.id);
      const cd = ct.filter(t => t.done).length;
      return { course: c, total: ct.length, done: cd };
    }).filter(x => x.total > 0).sort((a, b) => b.total - a.total);

    const noCourse = tasks.filter(t => !t.courseId);
    if (noCourse.length > 0) {
      byCourse.push({
        course: { id: '', name: 'Sin curso', color: 'var(--text-mute)', code: '', teacher: '', createdAt: '' },
        total: noCourse.length,
        done: noCourse.filter(t => t.done).length,
      });
    }

    const prioCounts = { low: 0, medium: 0, high: 0, urgent: 0 };
    tasks.filter(t => !t.done).forEach(t => { prioCounts[computeEffectivePriority(t)]++; });

    return { total, done, pending, pct, completedToday, weekDays, weekCounts, weekMax, weekTotal, streak, byCourse, prioCounts };
  }, [tasks, courses]);

  const PRIO_CONFIG = [
    { key: 'urgent' as const, label: 'Urgente', color: 'var(--prio-urgent)', soft: 'var(--prio-urgent-soft)' },
    { key: 'high'   as const, label: 'Alta',    color: 'var(--prio-high)',   soft: 'var(--prio-high-soft)' },
    { key: 'medium' as const, label: 'Media',   color: 'var(--prio-medium)', soft: 'var(--prio-medium-soft)' },
    { key: 'low'    as const, label: 'Baja',    color: 'var(--prio-low)',    soft: 'var(--prio-low-soft)' },
  ];
  const prioTotal = Object.values(stats.prioCounts).reduce((a, b) => a + b, 0);

  /* ── Empty state ── */
  if (stats.total === 0) {
    return (
      <div className="page-content">
        <div className="section-header">
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Estadísticas</h1>
        </div>
        <div className="empty-state" style={{ marginTop: 'var(--sp-8)' }}>
          <div className="empty-state__art"><TrendingUp size={52} /></div>
          <div className="empty-state__title">Sin datos aún</div>
          <div className="empty-state__text">Crea y completa tareas para ver tus estadísticas.</div>
        </div>
      </div>
    );
  }

  const ringSize = isSmall ? 80 : 100;

  return (
    <div className="page-content">
      <div className="section-header" style={{ marginBottom: 'var(--sp-4)' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Estadísticas</h1>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="sv2-layout">

        {/* ══ 1. HERO CARD ══ */}
        <motion.div variants={item} className="sv2-hero">
          {/* decorative blobs */}
          <div className="sv2-hero__blob sv2-hero__blob--1" />
          <div className="sv2-hero__blob sv2-hero__blob--2" />

          <div className="sv2-hero__ring">
            <RingProgress pct={stats.pct} size={ringSize} stroke={isSmall ? 7 : 9} />
            <div className="sv2-hero__pct" style={{ fontSize: isSmall ? '1.1rem' : '1.4rem' }}>
              {stats.pct}%
            </div>
          </div>

          <div className="sv2-hero__body">
            <div className="sv2-hero__eyebrow">Progreso general</div>
            <div className="sv2-hero__headline">
              {stats.done} de {stats.total}{' '}
              <span style={{ opacity: 0.75 }}>tareas completadas</span>
            </div>
            <div className="sv2-hero__chips">
              <span className="sv2-chip sv2-chip--white">
                {stats.pending} pendiente{stats.pending !== 1 ? 's' : ''}
              </span>
              {stats.completedToday > 0 && (
                <span className="sv2-chip sv2-chip--bright">
                  +{stats.completedToday} hoy
                </span>
              )}
              {stats.streak > 0 && (
                <span className="sv2-chip sv2-chip--fire">
                  🔥 {stats.streak} día{stats.streak !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </motion.div>

        {/* ══ 2. KPI STRIP ══ — 4 metrics unified in one horizontal card */}
        <motion.div variants={item} className="sv2-kpi-strip">

          <div className="sv2-kpi-item">
            <div className="sv2-kpi-item__icon" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
              <CalendarCheck size={16} />
            </div>
            <div className="sv2-kpi-item__num" style={{ color: 'var(--success)' }}>{stats.completedToday}</div>
            <div className="sv2-kpi-item__label">Hoy</div>
          </div>

          <div className="sv2-kpi-sep" />

          <div className="sv2-kpi-item">
            <div className="sv2-kpi-item__icon" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}>
              <Flame size={16} />
            </div>
            <div className="sv2-kpi-item__num" style={{ color: 'var(--warn)' }}>{stats.streak}</div>
            <div className="sv2-kpi-item__label">Racha</div>
          </div>

          <div className="sv2-kpi-sep" />

          <div className="sv2-kpi-item">
            <div className="sv2-kpi-item__icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              <Target size={16} />
            </div>
            <div className="sv2-kpi-item__num" style={{ color: 'var(--accent)' }}>{stats.pending}</div>
            <div className="sv2-kpi-item__label">Pendientes</div>
          </div>

          <div className="sv2-kpi-sep" />

          <div className="sv2-kpi-item">
            <div className="sv2-kpi-item__icon" style={{ background: 'var(--info-soft)', color: 'var(--info)' }}>
              <ListTodo size={16} />
            </div>
            <div className="sv2-kpi-item__num" style={{ color: 'var(--info)' }}>{stats.total}</div>
            <div className="sv2-kpi-item__label">Total</div>
          </div>

        </motion.div>

        {/* ══ 3. WEEKLY CHART ══ */}
        <motion.div variants={item} className="sv2-card">
          <div className="sv2-card__header">
            <TrendingUp size={16} style={{ color: 'var(--accent)' }} />
            <span className="sv2-card__title">Actividad semanal</span>
            <span className="sv2-badge">{stats.weekTotal} completadas</span>
          </div>
          <div className="sv2-chart">
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
        </motion.div>

        {/* ══ 4. BOTTOM ROW ══ */}
        <div className="sv2-bottom-row">

          {/* Por curso */}
          {stats.byCourse.length > 0 && (
            <motion.div variants={item} className="sv2-card sv2-card--half">
              <div className="sv2-card__header">
                <BookOpen size={16} style={{ color: 'var(--info)' }} />
                <span className="sv2-card__title">Por curso</span>
              </div>
              <div className="sv2-course-list">
                {stats.byCourse.map(({ course, total, done }) => {
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  const color = course.color !== 'var(--text-mute)' ? course.color : 'var(--text-mute)';
                  return (
                    <div key={course.id} className="sv2-course-row">
                      <MiniRing pct={pct} color={color} />
                      <div className="sv2-course-row__info">
                        <span className="sv2-course-row__name">{course.name}</span>
                        <span className="sv2-course-row__sub">{done}/{total} tareas</span>
                      </div>
                      <span className="sv2-course-row__pct" style={{ color }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Pendientes por prioridad */}
          <motion.div variants={fadeIn} className="sv2-card sv2-card--half">
            <div className="sv2-card__header">
              <Zap size={16} style={{ color: 'var(--prio-urgent)' }} />
              <span className="sv2-card__title">Por prioridad</span>
              {stats.pending > 0 && (
                <span className="sv2-badge" style={{ background: 'var(--prio-urgent-soft)', color: 'var(--prio-urgent)' }}>
                  {stats.pending} activas
                </span>
              )}
            </div>

            {stats.pending === 0 ? (
              <div className="sv2-empty-panel">
                <Award size={32} style={{ opacity: 0.2 }} />
                <span>¡Sin pendientes!</span>
              </div>
            ) : (
              <>
                <div className="sv2-stacked-bar">
                  {PRIO_CONFIG.map(({ key, color }) => {
                    const count = stats.prioCounts[key];
                    if (count === 0) return null;
                    const w = prioTotal > 0 ? (count / prioTotal) * 100 : 0;
                    return (
                      <motion.div
                        key={key}
                        className="sv2-stacked-bar__seg"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${w}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.9, ease: 'easeOut' }}
                        style={{ background: color }}
                        title={`${count} tarea${count !== 1 ? 's' : ''}`}
                      />
                    );
                  })}
                </div>

                <div className="sv2-prio-list">
                  {PRIO_CONFIG.map(({ key, label, color, soft }) => {
                    const count = stats.prioCounts[key];
                    const pct   = prioTotal > 0 ? Math.round((count / prioTotal) * 100) : 0;
                    return (
                      <div key={key} className={`sv2-prio-row ${count === 0 ? 'sv2-prio-row--empty' : ''}`}>
                        <span className="sv2-prio-dot" style={{ background: color }} />
                        <span className="sv2-prio-label">{label}</span>
                        <div className="sv2-prio-bar-track">
                          <motion.div
                            className="sv2-prio-bar-fill"
                            initial={{ width: 0 }}
                            whileInView={{ width: `${pct}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            style={{
                              background: count > 0 ? color : 'var(--border)',
                              boxShadow: count > 0 ? `0 0 8px ${soft}` : 'none',
                            }}
                          />
                        </div>
                        <span className="sv2-prio-count" style={{ color: count > 0 ? color : 'var(--text-faint)' }}>
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>

        </div>

      </motion.div>
    </div>
  );
}

import { useMemo } from 'react';
import { useStore } from '../../store';
import { parseDue, isSameDay, addDays, fmtDateShort } from '../../lib/utils';
import { DAYS_LONG_ES, EVENT_TYPES, MONTHS_ES } from '../../lib/constants';
import { Clock, Calendar } from 'lucide-react';

interface Props {
  baseDate: Date;
  onTaskClick: (id: string) => void;
  onEventClick: (id: string) => void;
  daysAhead?: number;
}

export default function AgendaView({ baseDate, onTaskClick, onEventClick, daysAhead = 30 }: Props) {
  const tasks = useStore(s => s.tasks);
  const events = useStore(s => s.events);
  const courses = useStore(s => s.courses);
  const today = new Date();

  const groups = useMemo(() => {
    const result: Array<{ date: Date; iso: string; tasks: typeof tasks; events: typeof events }> = [];

    for (let i = 0; i <= daysAhead; i++) {
      const d = addDays(baseDate, i);
      const iso = d.toISOString().slice(0, 10);

      const dayTasks = tasks.filter(t => {
        const due = parseDue(t.dueDate, t.dueTime);
        return due && isSameDay(due, d);
      });

      const dayEvents = events.filter(ev => iso >= ev.startDate && iso <= (ev.endDate || ev.startDate));

      if (dayTasks.length || dayEvents.length) {
        result.push({ date: d, iso, tasks: dayTasks, events: dayEvents });
      }
    }

    return result;
  }, [tasks, events, baseDate, daysAhead]);

  if (!groups.length) {
    return (
      <div className="agenda-view">
        <div className="empty-state" style={{ paddingTop: 'var(--sp-8)' }}>
          <Calendar size={48} style={{ color: 'var(--text-faint)', marginBottom: 'var(--sp-3)' }} />
          <div className="empty-state__title">Sin eventos próximos</div>
          <div className="empty-state__text">No hay tareas ni eventos en los próximos {daysAhead} días.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="agenda-view">
      {groups.map(({ date, iso, tasks: dayTasks, events: dayEvents }) => {
        const isToday = isSameDay(date, today);
        const dayName = DAYS_LONG_ES[date.getDay()];
        const monthName = MONTHS_ES[date.getMonth()];

        return (
          <div key={iso} className="agenda-group">
            {/* Date header */}
            <div className="agenda-date-header">
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 48 }}>
                <span className="agenda-date-day">{dayName.slice(0, 3)}</span>
                <span className={`agenda-date-num${isToday ? ' is-today' : ''}`}>{date.getDate()}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 4 }}>
                <span className="agenda-date-month">{monthName} {date.getFullYear()}</span>
                {isToday && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>Hoy</span>
                )}
              </div>
            </div>

            {/* Events */}
            {dayEvents.map(ev => {
              const type = EVENT_TYPES[ev.type];
              return (
                <div
                  key={ev.id}
                  className="agenda-event"
                  style={{ '--ev-color': ev.color || type.color } as React.CSSProperties}
                  onClick={() => onEventClick(ev.id)}
                >
                  <span style={{ fontSize: '1.25rem' }}>{type.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="agenda-event__title truncate">{ev.title}</div>
                    {ev.description && <div className="agenda-event__type truncate">{ev.description}</div>}
                  </div>
                  <span className="agenda-event__type">{type.label}</span>
                </div>
              );
            })}

            {/* Tasks */}
            {dayTasks.map(t => {
              const course = courses.find(c => c.id === t.courseId);
              const color = course?.color || 'var(--accent)';
              return (
                <div
                  key={t.id}
                  className="agenda-event"
                  style={{ '--ev-color': color, opacity: t.done ? 0.5 : 1 } as React.CSSProperties}
                  onClick={() => onTaskClick(t.id)}
                >
                  <Clock size={18} style={{ color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={`agenda-event__title truncate${t.done ? ' task-done' : ''}`}
                      style={t.done ? { textDecoration: 'line-through' } : undefined}>
                      {t.title}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                      {course && (
                        <span className="course-pill" style={{ '--c': color, fontSize: '0.75rem', padding: '2px 6px' } as React.CSSProperties}>
                          {course.name}
                        </span>
                      )}
                      {t.dueTime && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>{t.dueTime}</span>
                      )}
                    </div>
                  </div>
                  {t.done && <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>✓</span>}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

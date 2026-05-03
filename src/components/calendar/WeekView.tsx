import { useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { parseDue, isSameDay, addDays } from '../../lib/utils';
import { DAYS_LONG_ES, EVENT_TYPES } from '../../lib/constants';
import type { Task, CalendarEvent } from '../../types';

interface Props {
  weekStart: Date;
  onTaskClick: (id: string) => void;
  onEventClick: (id: string) => void;
  onSlotClick: (date: string, hour: number) => void;
}

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6am - 11pm

export default function WeekView({ weekStart, onTaskClick, onEventClick, onSlotClick }: Props) {
  const tasks = useStore(s => s.tasks);
  const events = useStore(s => s.events);
  const courses = useStore(s => s.courses);
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = new Date();

  useEffect(() => {
    // Scroll to current hour (or 8am)
    const target = scrollRef.current;
    if (!target) return;
    const currentHour = today.getHours();
    const scrollHour = Math.max(6, Math.min(currentHour - 1, 22));
    target.scrollTop = (scrollHour - 6) * 60;
  }, []);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getTimedTasksForDay = (day: Date): Task[] =>
    tasks.filter(t => {
      if (!t.dueTime) return false;
      const due = parseDue(t.dueDate, t.dueTime);
      return due && isSameDay(due, day);
    });

  const getAllDayTasksForDay = (day: Date): Task[] =>
    tasks.filter(t => {
      if (t.dueTime) return false;
      const due = parseDue(t.dueDate, t.dueTime);
      return due && isSameDay(due, day);
    });

  const getEventsForDay = (day: Date): CalendarEvent[] => {
    const iso = day.toISOString().slice(0, 10);
    return events.filter(ev => iso >= ev.startDate && iso <= (ev.endDate || ev.startDate));
  };

  // Position task block within time grid (60px per hour, starting from 6am)
  const taskTop = (t: Task) => {
    if (!t.dueTime) return null; // no-time tasks go to all-day area
    const due = parseDue(t.dueDate, t.dueTime);
    if (!due) return null;
    const h = due.getHours(), m = due.getMinutes();
    if (h < 6 || h > 23) return null;
    return (h - 6) * 60 + m;
  };

  const nowTop = () => {
    const h = today.getHours(), m = today.getMinutes();
    if (h < 6 || h > 23) return null;
    return (h - 6) * 60 + m;
  };

  return (
    <div className="week-view">
      {/* Header */}
      <div className="week-view__header">
        <div style={{ gridColumn: 1 }} />
        {days.map((d, i) => {
          const isToday = isSameDay(d, today);
          return (
            <div key={i} className="week-view__header-cell">
              <div className="week-day-label">{DAYS_LONG_ES[d.getDay()].slice(0, 3)}</div>
              <div className={`week-day-num${isToday ? ' is-today' : ''}`}>
                {d.getDate()}
              </div>
              {/* All-day events */}
              {getEventsForDay(d).map(ev => {
                const type = EVENT_TYPES[ev.type];
                return (
                  <div
                    key={ev.id}
                    className="cal-event"
                    style={{ '--ev-color': ev.color || type.color } as React.CSSProperties}
                    onClick={() => onEventClick(ev.id)}
                    title={ev.title}
                  >
                    {type.emoji} {ev.title}
                  </div>
                );
              })}
              {/* All-day tasks (no time set) */}
              {getAllDayTasksForDay(d).map(t => {
                const course = courses.find(c => c.id === t.courseId);
                const color = course?.color || 'var(--accent)';
                return (
                  <div
                    key={t.id}
                    className="cal-event"
                    style={{ '--ev-color': color, opacity: t.done ? 0.5 : 1 } as React.CSSProperties}
                    onClick={() => onTaskClick(t.id)}
                    title={t.title}
                  >
                    ✓ {t.title}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Body */}
      <div className="week-view__body" ref={scrollRef}>
        {/* Time labels */}
        <div className="week-view__time-col">
          {HOURS.map(h => (
            <div key={h} className="week-time-label">
              {h.toString().padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* Day columns */}
        <div className="week-view__grid">
          {days.map((d, dayIdx) => {
            const isToday = isSameDay(d, today);
            const dayTasks = getTimedTasksForDay(d);
            const nowPos = isToday ? nowTop() : null;
            const iso = d.toISOString().slice(0, 10);

            return (
              <div key={dayIdx} className={`week-col${isToday ? ' is-today' : ''}`}>
                {/* Hour cells */}
                {HOURS.map((h, hIdx) => (
                  <div
                    key={h}
                    className={`week-cell${hIdx % 1 === 0 ? ' is-hour' : ''}`}
                    onClick={() => onSlotClick(iso, h)}
                  />
                ))}

                {/* Task blocks */}
                {dayTasks.map(t => {
                  const top = taskTop(t);
                  if (top === null) return null;
                  const course = courses.find(c => c.id === t.courseId);
                  const color = course?.color || 'var(--accent)';
                  return (
                    <div
                      key={t.id}
                      className="week-event"
                      style={{
                        top: `${top}px`,
                        height: '52px',
                        '--ev-color': color,
                        opacity: t.done ? 0.45 : 1,
                      } as React.CSSProperties}
                      onClick={() => onTaskClick(t.id)}
                      title={t.title}
                    >
                      <div className="truncate" style={{ fontWeight: 500 }}>{t.title}</div>
                      {t.dueTime && <div style={{ fontSize: '0.6875rem', opacity: 0.8 }}>{t.dueTime}</div>}
                    </div>
                  );
                })}

                {/* Now line */}
                {nowPos !== null && (
                  <div className="now-line" style={{ top: `${nowPos}px` }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store';
import { parseDue, isSameDay } from '../../lib/utils';
import { DAYS_ES, EVENT_TYPES, MONTHS_ES } from '../../lib/constants';
import type { CalendarEvent, Task } from '../../types';

interface Props {
  year: number;
  month: number;
  direction: number;
  onTaskClick: (id: string) => void;
  onEventClick: (id: string) => void;
  onDayClick: (date: string) => void;
  onDragCreate: (start: string, end: string) => void;
}

const MAX_VISIBLE = 3;

export default function MonthGrid({ year, month, direction, onTaskClick, onEventClick, onDayClick, onDragCreate }: Props) {
  const tasks = useStore(s => s.tasks);
  const events = useStore(s => s.events);
  const courses = useStore(s => s.courses);

  const [dragStart, setDragStart] = useState<string | null>(null);
  const [dragEnd, setDragEnd] = useState<string | null>(null);
  const isDragging = useRef(false);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const today = new Date();

  // Build events on a date
  const eventsOnDate = (iso: string) =>
    events.filter(ev => iso >= ev.startDate && iso <= (ev.endDate || ev.startDate));

  // Build tasks on a date
  const tasksOnDate = (iso: string) =>
    tasks.filter(t => {
      const due = parseDue(t.dueDate, t.dueTime);
      return due && isSameDay(due, new Date(iso + 'T12:00:00'));
    });

  // Drag range
  const inDragRange = (iso: string) => {
    if (!dragStart || !dragEnd) return false;
    const [a, b] = dragStart <= dragEnd ? [dragStart, dragEnd] : [dragEnd, dragStart];
    return iso >= a && iso <= b;
  };

  const cells: Array<{ iso: string | null; day: number; isOut: boolean; isToday: boolean; isPast: boolean; isWeekend: boolean }> = [];

  // Prev month fill
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevDays - i;
    const prevDate = new Date(year, month - 1, d);
    cells.push({ iso: null, day: d, isOut: true, isToday: false, isPast: true, isWeekend: prevDate.getDay() === 0 || prevDate.getDay() === 6 });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dayDate = new Date(year, month, d);
    const iso = dayDate.toISOString().slice(0, 10);
    const isToday = isSameDay(dayDate, today);
    const isPast = dayDate < today && !isToday;
    const dow = dayDate.getDay();
    cells.push({ iso, day: d, isOut: false, isToday, isPast, isWeekend: dow === 0 || dow === 6 });
  }
  // Next month fill
  const totalCells = cells.length;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remaining; i++) {
    cells.push({ iso: null, day: i, isOut: true, isToday: false, isPast: false, isWeekend: false });
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={`${year}-${month}`}
        initial={{ opacity: 0, x: direction * 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: direction * -40 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Day headers */}
        <div className="month-grid__head">
          {DAYS_ES.map((d, i) => (
            <div key={d} className={`month-grid__head-cell${i === 0 || i === 6 ? ' is-weekend' : ''}`}>{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="month-grid__body">
          {cells.map((cell, idx) => {
            const cellEvents: CalendarEvent[] = cell.iso ? eventsOnDate(cell.iso) : [];
            const cellTasks: Task[] = cell.iso ? tasksOnDate(cell.iso) : [];
            const isDrag = cell.iso ? inDragRange(cell.iso) : false;

            const classes = [
              'cal-day',
              cell.isOut ? 'is-out' : '',
              cell.isToday ? 'is-today' : '',
              cell.isWeekend && !cell.isOut ? 'is-weekend' : '',
              cell.isPast && !cell.isOut ? 'is-past' : '',
              isDrag ? 'is-drag-selected' : '',
            ].filter(Boolean).join(' ');

            return (
              <div
                key={idx}
                className={classes}
                style={cell.isPast && !cell.isOut ? { opacity: 0.6 } : undefined}
                onClick={() => cell.iso && !isDragging.current && onDayClick(cell.iso)}
                onPointerDown={(e) => {
                  if (cell.isOut || !cell.iso) return;
                  isDragging.current = false;
                  setDragStart(cell.iso);
                  setDragEnd(cell.iso);
                  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (!dragStart || cell.isOut) return;
                  const el = document.elementFromPoint(e.clientX, e.clientY);
                  const dayEl = el?.closest<HTMLElement>('.cal-day:not(.is-out)');
                  const iso = dayEl?.getAttribute('data-date') || null;
                  if (iso && iso !== dragEnd) {
                    isDragging.current = true;
                    setDragEnd(iso);
                  }
                }}
                onPointerUp={() => {
                  if (dragStart && dragEnd && isDragging.current) {
                    const [a, b] = dragStart <= dragEnd ? [dragStart, dragEnd] : [dragEnd, dragStart];
                    onDragCreate(a, b);
                  }
                  setDragStart(null);
                  setDragEnd(null);
                  setTimeout(() => { isDragging.current = false; }, 0);
                }}
                data-date={cell.iso}
              >
                <span className="cal-day__num">{cell.day}</span>

                {/* Event strips */}
                {cellEvents.slice(0, 2).map(ev => {
                  const type = EVENT_TYPES[ev.type];
                  const isStart = cell.iso === ev.startDate;
                  const isEnd = cell.iso === (ev.endDate || ev.startDate);
                  return (
                    <div
                      key={ev.id}
                      className={`cal-event-strip${isStart ? ' is-start' : ''}${isEnd ? ' is-end' : ''}`}
                      style={{ '--ev-color': ev.color || type.color } as React.CSSProperties}
                      onClick={e => { e.stopPropagation(); onEventClick(ev.id); }}
                      title={ev.title}
                    >
                      {isStart && (
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</span>
                      )}
                    </div>
                  );
                })}

                {/* Task pills */}
                {cellTasks.slice(0, MAX_VISIBLE - Math.min(cellEvents.length, 2)).map(t => {
                  const course = courses.find(c => c.id === t.courseId);
                  const color = course?.color || 'var(--accent)';
                  return (
                    <div
                      key={t.id}
                      className={`cal-task-pill${t.done ? ' is-done' : ''}`}
                      style={{ '--c': color } as React.CSSProperties}
                      onClick={e => { e.stopPropagation(); onTaskClick(t.id); }}
                      title={t.title}
                    >
                      {t.title}
                    </div>
                  );
                })}

                {/* "+N more" */}
                {(() => {
                  const totalVisible = Math.min(cellEvents.length, 2) + Math.min(cellTasks.length, MAX_VISIBLE - Math.min(cellEvents.length, 2));
                  const totalItems = cellEvents.length + cellTasks.length;
                  const overflow = totalItems - totalVisible;
                  return overflow > 0 ? (
                    <div className="cal-day__more" onClick={e => { e.stopPropagation(); cell.iso && onDayClick(cell.iso); }}>
                      +{overflow} más
                    </div>
                  ) : null;
                })()}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        {events.some(ev => {
          const s = ev.startDate, e = ev.endDate || ev.startDate;
          const mStart = new Date(year, month, 1).toISOString().slice(0, 10);
          const mEnd = new Date(year, month + 1, 0).toISOString().slice(0, 10);
          return s <= mEnd && e >= mStart;
        }) && (
          <div className="cal-legend">
            <span className="cal-legend__title">Este mes:</span>
            {events
              .filter(ev => {
                const mStart = new Date(year, month, 1).toISOString().slice(0, 10);
                const mEnd = new Date(year, month + 1, 0).toISOString().slice(0, 10);
                return ev.startDate <= mEnd && (ev.endDate || ev.startDate) >= mStart;
              })
              .map(ev => {
                const type = EVENT_TYPES[ev.type];
                return (
                  <span
                    key={ev.id}
                    className="cal-legend__chip"
                    style={{ '--ev-color': ev.color || type.color } as React.CSSProperties}
                    onClick={() => onEventClick(ev.id)}
                    title={`${ev.startDate} → ${ev.endDate}`}
                  >
                    {ev.title}
                  </span>
                );
              })}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

import { useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useIsMobile } from '../hooks/useMediaQuery';
import MonthGrid from '../components/calendar/MonthGrid';
import WeekView from '../components/calendar/WeekView';
import AgendaView from '../components/calendar/AgendaView';
import EventModal from '../components/calendar/EventModal';
import TaskModal from '../components/tasks/TaskModal';
import { MONTHS_ES } from '../lib/constants';
import { addDays } from '../lib/utils';
import type { CalendarView } from '../types';

export default function CalendarPageView() {
  const [viewDate, setViewDate] = useState(new Date());
  const [calView, setCalView] = useState<CalendarView>('month');
  const [direction, setDirection] = useState(0);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [prefillStart, setPrefillStart] = useState<string | undefined>();
  const [prefillEnd, setPrefillEnd] = useState<string | undefined>();
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // Mobile defaults to agenda
  const activeView: CalendarView = isMobile && calView === 'week' ? 'agenda' : calView;

  const prevPeriod = () => {
    setDirection(-1);
    setViewDate(d => {
      if (calView === 'week') {
        const next = new Date(d);
        next.setDate(d.getDate() - 7);
        return next;
      }
      return new Date(d.getFullYear(), d.getMonth() - 1, 1);
    });
  };

  const nextPeriod = () => {
    setDirection(1);
    setViewDate(d => {
      if (calView === 'week') {
        const next = new Date(d);
        next.setDate(d.getDate() + 7);
        return next;
      }
      return new Date(d.getFullYear(), d.getMonth() + 1, 1);
    });
  };

  const goToday = () => { setDirection(0); setViewDate(new Date()); };

  const openEvent = (id: string) => { setEditEventId(id); setPrefillStart(undefined); setPrefillEnd(undefined); setEventModalOpen(true); };
  const openNewEvent = (start?: string, end?: string) => { setEditEventId(null); setPrefillStart(start); setPrefillEnd(end); setEventModalOpen(true); };
  const openTask = (id: string) => { setEditTaskId(id); setTaskModalOpen(true); };
  const openNewTask = () => { setEditTaskId(null); setTaskModalOpen(true); };

  const handleDayClick = (date: string) => openNewEvent(date, date);
  const handleSlotClick = (date: string, _hour?: number) => openNewEvent(date, date);

  const headerLabel = calView === 'week'
    ? (() => {
        const start = viewDate;
        const end = addDays(viewDate, 6);
        return `${start.getDate()} – ${end.getDate()} ${MONTHS_ES[end.getMonth()]} ${end.getFullYear()}`;
      })()
    : `${MONTHS_ES[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

  // Compute week start (Monday)
  const getWeekStart = (d: Date) => {
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    const start = new Date(d);
    start.setDate(d.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    return start;
  };

  return (
    <div className="page-content calendar-page">
      {/* Header */}
      <div className="cal-header">
        <motion.h1
          key={headerLabel}
          className="cal-header__title"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {headerLabel}
        </motion.h1>

        <div className="cal-nav-btns">
          <button className="icon-btn" onClick={prevPeriod} aria-label="Anterior"><ChevronLeft size={20} /></button>
          <button className="btn btn--secondary btn--sm" onClick={goToday}>Hoy</button>
          <button className="icon-btn" onClick={nextPeriod} aria-label="Siguiente"><ChevronRight size={20} /></button>
        </div>

        {/* View switcher */}
        <div className="cal-view-tabs">
          {(['month', 'week', 'agenda'] as CalendarView[]).map(v => {
            if (v === 'week' && isMobile) return null; // Week unsupported on mobile → Agenda
            return (
              <button key={v} className={`cal-view-tab${calView === v || (v === 'agenda' && isMobile && calView === 'week') ? ' is-active' : ''}`} onClick={() => setCalView(v)}>
                {v === 'month' ? 'Mes' : v === 'week' ? 'Semana' : 'Agenda'}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <button className="btn btn--secondary btn--sm" onClick={() => openNewEvent()}>
            <CalendarDays size={15} /> Evento
          </button>
          <button className="btn btn--primary btn--sm" onClick={openNewTask}>
            <Plus size={15} /> Tarea
          </button>
        </div>
      </div>

      {/* Calendar body */}
      {activeView === 'month' && (
        <MonthGrid
          year={viewDate.getFullYear()}
          month={viewDate.getMonth()}
          direction={direction}
          onTaskClick={openTask}
          onEventClick={openEvent}
          onDayClick={handleDayClick}
          onDragCreate={(start, end) => openNewEvent(start, end)}
        />
      )}

      {activeView === 'week' && !isMobile && (
        <WeekView
          weekStart={getWeekStart(viewDate)}
          onTaskClick={openTask}
          onEventClick={openEvent}
          onSlotClick={handleSlotClick}
        />
      )}

      {activeView === 'agenda' && (
        <AgendaView
          baseDate={viewDate}
          onTaskClick={openTask}
          onEventClick={openEvent}
          daysAhead={60}
        />
      )}

      <EventModal
        open={eventModalOpen}
        editId={editEventId}
        prefillStart={prefillStart}
        prefillEnd={prefillEnd}
        onClose={() => setEventModalOpen(false)}
      />
      <TaskModal open={taskModalOpen} editId={editTaskId} onClose={() => setTaskModalOpen(false)} />
    </div>
  );
}

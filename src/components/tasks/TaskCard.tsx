import { motion } from 'framer-motion';
import { Clock, Edit2, Check, Users, Mic, Flame, ArrowUp } from 'lucide-react';
import { useStore } from '../../store';
import { useToast } from '../ui/Toast';
import { computeEffectivePriority, escaladeLabel, parseDue, relativeDue } from '../../lib/utils';
import type { Task } from '../../types';

interface Props {
  task: Task;
  onEdit: (id: string) => void;
}

export default function TaskCard({ task, onEdit }: Props) {
  const toggleTask = useStore(s => s.toggleTask);
  const courses = useStore(s => s.courses);
  const tags = useStore(s => s.tags);
  const { toast } = useToast();

  const meta   = useStore(s => s.meta);
  const course = courses.find(c => c.id === task.courseId);
  const taskTags = (task.tagIds || []).map(id => tags.find(t => t.id === id)).filter(Boolean);

  // Attribution: only show in space mode and only for other members' tasks
  const isInSpace = !!meta.spaceId;
  const isMyTask  = !task.createdBy ||
                    task.createdBy === meta.uid ||
                    task.createdBy === meta.email ||
                    (!!meta.displayName && task.createdBy === meta.displayName);
  const creatorLabel = (() => {
    const cb = task.createdBy;
    if (!cb) return '';
    if (cb.includes('@')) return cb.split('@')[0];           // email → username
    if (cb.length > 16)   return cb.slice(0, 10) + '…';    // raw uid → short prefix
    return cb;                                               // display name or short id
  })();
  const due = parseDue(task.dueDate, task.dueTime);
  const rel = relativeDue(due);
  const effPrio = computeEffectivePriority(task);
  const escalLabel = escaladeLabel(task);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleTask(task.id);
    toast(!task.done ? '¡Tarea completada!' : 'Tarea reabierta', { type: 'success' });
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18 }}
      className={`task-card${task.done ? ' is-done' : ''}`}
      style={{ paddingLeft: 'calc(var(--sp-4) + 4px)' }}
    >
      <span className={`task-card__bar prio-${effPrio}`} />

      <button
        className={`task-check${task.done ? ' is-checked' : ''}`}
        onClick={handleToggle}
        aria-label="Marcar completada"
      >
        <Check size={13} strokeWidth={3} />
      </button>

      <div className="task-card__body">
        <div
          className="task-card__title"
          onClick={() => onEdit(task.id)}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && onEdit(task.id)}
        >
          {task.title}
        </div>

        <div className="task-card__meta">
          {/* Priority badge — only for urgent and high; color-coded + urgent pulses */}
          {effPrio === 'urgent' && (
            <span className="prio-badge urgent">
              <Flame size={9} strokeWidth={2.5} /> Urgente
            </span>
          )}
          {effPrio === 'high' && (
            <span className="prio-badge high">
              <ArrowUp size={9} strokeWidth={2.5} /> Alta
            </span>
          )}
          {due && (
            <span className={`task-card__due${rel.state === 'overdue' ? ' is-overdue' : rel.state === 'soon' ? ' is-soon' : ''}`}>
              <Clock size={12} />
              {rel.text}
            </span>
          )}
          {course && (
            <span className="course-pill" style={{ '--c': course.color } as React.CSSProperties}>
              {course.name}
            </span>
          )}
          {taskTags.map(tag => tag && (
            <span key={tag.id} className="tag-pill" style={{ '--c': tag.color } as React.CSSProperties}>
              {tag.name}
            </span>
          ))}
          {escalLabel && <span className="task-card__escalade">{escalLabel}</span>}
          {task.audioUrl && (
            <span title="Tiene nota de voz" style={{
              display: 'inline-flex', alignItems: 'center', gap: 2,
              fontSize: '0.72rem', color: 'var(--info)',
              background: 'var(--info-soft)',
              padding: '1px 5px', borderRadius: 99,
            }}>
              <Mic size={10} />
            </span>
          )}
          {isInSpace && !isMyTask && creatorLabel && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: '0.72rem', color: 'var(--accent)',
              background: 'var(--accent-soft)',
              padding: '1px 6px', borderRadius: 99,
              fontWeight: 500,
            }}>
              <Users size={10} /> {creatorLabel}
            </span>
          )}
        </div>
      </div>

      <div className="task-card__actions">
        <button
          className="icon-btn"
          onClick={e => { e.stopPropagation(); onEdit(task.id); }}
          aria-label="Editar"
        >
          <Edit2 size={15} />
        </button>
      </div>
    </motion.article>
  );
}

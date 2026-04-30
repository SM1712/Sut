import { useState, useEffect } from 'react';
import { Trash2, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import Modal from '../ui/Modal';
import { useStore } from '../../store';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../ui/Confirm';
import type { Priority, Tag } from '../../types';
import { PRIORITY_LABELS } from '../../lib/constants';
import AudioRecorder from './AudioRecorder';

interface Props {
  open: boolean;
  editId: string | null;
  onClose: () => void;
}

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];

export default function TaskModal({ open, editId, onClose }: Props) {
  const upsertTask = useStore(s => s.upsertTask);
  const deleteTask = useStore(s => s.deleteTask);
  const tasks  = useStore(s => s.tasks);
  const courses = useStore(s => s.courses);
  const tags = useStore(s => s.tags);
  const meta = useStore(s => s.meta);
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [courseId, setCourseId] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [priority, setPriority] = useState<Priority>('medium');
  const [escalating, setEscalating] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [reminder, setReminder] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editId) {
      const t = tasks.find(x => x.id === editId);
      if (t) {
        setTitle(t.title);
        setDescription(t.description || '');
        setInstructions(t.instructions || '');
        setCourseId(t.courseId || '');
        setSelectedTags(t.tagIds || []);
        setPriority(t.priority || 'medium');
        setEscalating(t.escalating || false);
        setDueDate(t.dueDate || '');
        setDueTime(t.dueTime || '');
        setReminder(t.reminder || '');
        setShowInstructions(!!t.instructions);
        setAudioUrl(t.audioUrl ?? null);
      }
    } else {
      setTitle(''); setDescription(''); setInstructions('');
      setCourseId(''); setSelectedTags([]); setPriority('medium');
      setEscalating(false); setDueDate(''); setDueTime(''); setReminder('');
      setShowInstructions(false); setAudioUrl(null);
    }
  }, [open, editId, tasks]);

  const toggleTag = (tagId: string, tag: Tag) => {
    setSelectedTags(prev => {
      const next = prev.includes(tagId) ? prev.filter(x => x !== tagId) : [...prev, tagId];
      // Priority hint from tag
      if (!prev.includes(tagId) && tag.defaultPriority) {
        const order: Record<Priority, number> = { low: 0, medium: 1, high: 2, urgent: 3 };
        if (order[tag.defaultPriority as Priority] > order[priority]) {
          setPriority(tag.defaultPriority as Priority);
          toast(`💡 Prioridad sugerida por "${tag.name}": ${PRIORITY_LABELS[tag.defaultPriority as Priority]}`, { duration: 3000 });
        }
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    upsertTask({ id: editId || undefined, title: title.trim(), description, instructions, courseId, tagIds: selectedTags, priority, escalating, dueDate, dueTime, reminder, audioUrl });
    toast(editId ? 'Tarea actualizada' : 'Tarea creada ✓', { type: 'success' });
    onClose();
  };

  const handleDelete = async () => {
    if (!editId) return;
    const t = tasks.find(x => x.id === editId);
    const ok = await confirm({ title: `¿Eliminar "${t?.title}"?`, text: 'Esta acción no se puede deshacer.', confirmText: 'Eliminar' });
    if (!ok) return;
    deleteTask(editId);
    toast('Tarea eliminada', { type: 'warn' });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editId ? 'Editar tarea' : 'Nueva tarea'}
      footerLeft={editId ? (
        <button className="btn btn--danger btn--sm" onClick={handleDelete} type="button">
          <Trash2 size={15} /> Eliminar
        </button>
      ) : undefined}
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose} type="button">Cancelar</button>
          <button className="btn btn--primary" form="task-form" type="submit">
            {editId ? 'Guardar cambios' : 'Crear tarea'}
          </button>
        </>
      }
    >
      <form id="task-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {/* Title */}
        <div className="form-group">
          <label className="form-label required">Título</label>
          <input
            className="input"
            placeholder="¿Qué hay que hacer?"
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus={!('ontouchstart' in window)}
            required
          />
        </div>

        {/* Description */}
        <div className="form-group">
          <label className="form-label">Descripción</label>
          <textarea
            className="textarea"
            placeholder="Detalles adicionales..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={{ minHeight: 72 }}
          />
        </div>

        {/* Instructions toggle */}
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          style={{ alignSelf: 'flex-start', gap: 6 }}
          onClick={() => setShowInstructions(v => !v)}
        >
          {showInstructions ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          {showInstructions ? 'Ocultar instrucciones' : 'Agregar instrucciones detalladas'}
        </button>

        {showInstructions && (
          <div className="form-group">
            <label className="form-label">Instrucciones</label>
            <textarea
              className="textarea"
              placeholder="Pasos, referencias, links, etc..."
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              style={{ minHeight: 100 }}
            />
          </div>
        )}

        {/* Course + Due date row */}
        <div className="input-row">
          <div className="form-group">
            <label className="form-label">Curso</label>
            <select className="input select" value={courseId} onChange={e => setCourseId(e.target.value)}>
              <option value="">Sin curso</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Fecha límite</label>
            <input className="input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
        </div>

        {/* Time + Reminder row */}
        {dueDate && (
          <div className="input-row">
            <div className="form-group">
              <label className="form-label">Hora</label>
              <input className="input" type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Recordatorio</label>
              <select className="input select" value={reminder} onChange={e => setReminder(e.target.value)}>
                <option value="">Sin recordatorio</option>
                <option value="15">15 min antes</option>
                <option value="30">30 min antes</option>
                <option value="60">1 hora antes</option>
                <option value="1440">1 día antes</option>
              </select>
            </div>
          </div>
        )}

        {/* Priority */}
        <div className="form-group">
          <label className="form-label">Prioridad</label>
          <div className="prio-picker">
            {PRIORITIES.map(p => (
              <div key={p} className="prio-opt" data-prio={p}>
                <input
                  type="radio"
                  id={`prio-${p}`}
                  name="priority"
                  value={p}
                  checked={priority === p}
                  onChange={() => setPriority(p)}
                />
                <label htmlFor={`prio-${p}`}>{PRIORITY_LABELS[p]}</label>
              </div>
            ))}
          </div>
        </div>

        {/* Escalating toggle */}
        <div className="toggle-row">
          <div>
            <div className="toggle-label">
              <Zap size={14} style={{ display: 'inline', marginRight: 4, color: 'var(--warn)' }} />
              Prioridad escalante
            </div>
            <div className="toggle-sub">Se incrementa automáticamente al acercarse la fecha</div>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={escalating} onChange={e => setEscalating(e.target.checked)} />
            <span className="toggle-track"><span className="toggle-thumb" /></span>
          </label>
        </div>

        {/* Audio note */}
        {meta.uid && (
          <div className="form-group">
            <label className="form-label">Nota de voz</label>
            <AudioRecorder
              uid={meta.uid}
              spaceId={meta.spaceId}
              existingUrl={audioUrl}
              onChange={setAudioUrl}
            />
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="form-group">
            <label className="form-label">Etiquetas</label>
            <div className="tag-picker">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  className={`tag-option${selectedTags.includes(tag.id) ? ' is-selected' : ''}`}
                  style={{ '--c': tag.color } as React.CSSProperties}
                  onClick={() => toggleTag(tag.id, tag)}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}

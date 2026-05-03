import { useState, useEffect, useRef } from 'react';
import {
  Trash2, Zap, Edit2, Check, X, Image as ImageIcon,
  Loader2, Calendar, Clock, Tag, BookOpen, CheckCircle2, Circle,
  Mic, ChevronRight,
} from 'lucide-react';
import Modal from '../ui/Modal';
import { useStore } from '../../store';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../ui/Confirm';
import type { Priority, Tag as TagType } from '../../types';
import { PRIORITY_LABELS } from '../../lib/constants';
import AudioRecorder from './AudioRecorder';
import { uploadImage } from '../../lib/firebase';
import { parseDue, relativeDue } from '../../lib/utils';

interface Props {
  open: boolean;
  editId: string | null;
  onClose: () => void;
}

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];

const PRIO_COLOR: Record<Priority, string> = {
  low: 'var(--prio-low)',
  medium: 'var(--prio-medium)',
  high: 'var(--prio-high)',
  urgent: 'var(--prio-urgent)',
};

export default function TaskModal({ open, editId, onClose }: Props) {
  const upsertTask   = useStore(s => s.upsertTask);
  const deleteTask   = useStore(s => s.deleteTask);
  const toggleTask   = useStore(s => s.toggleTask);
  const tasks        = useStore(s => s.tasks);
  const courses      = useStore(s => s.courses);
  const tags         = useStore(s => s.tags);
  const meta         = useStore(s => s.meta);
  const { toast }    = useToast();
  const { confirm }  = useConfirm();

  const [mode, setMode]     = useState<'view' | 'edit'>('edit');
  const [isNew, setIsNew]   = useState(true);

  // Form state
  const [title, setTitle]               = useState('');
  const [notes, setNotes]               = useState(''); // unified description + instructions
  const [courseId, setCourseId]         = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [priority, setPriority]         = useState<Priority>('medium');
  const [escalating, setEscalating]     = useState(false);
  const [dueDate, setDueDate]           = useState('');
  const [dueTime, setDueTime]           = useState('');
  const [reminder, setReminder]         = useState('');
  const [audioUrl, setAudioUrl]         = useState<string | null>(null);
  const [imageUrls, setImageUrls]       = useState<string[]>([]);

  // UI state
  const [uploadingImages, setUploadingImages] = useState(false);
  const [lightboxUrl, setLightboxUrl]         = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (editId) {
      const t = tasks.find(x => x.id === editId);
      if (t) {
        setTitle(t.title);
        setNotes(t.instructions || t.description || '');
        setCourseId(t.courseId || '');
        setSelectedTags(t.tagIds || []);
        setPriority(t.priority || 'medium');
        setEscalating(t.escalating || false);
        setDueDate(t.dueDate || '');
        setDueTime(t.dueTime || '');
        setReminder(t.reminder || '');
        setAudioUrl(t.audioUrl ?? null);
        setImageUrls(t.imageUrls || []);
        setMode('view');
        setIsNew(false);
      }
    } else {
      setTitle(''); setNotes('');
      setCourseId(''); setSelectedTags([]); setPriority('medium');
      setEscalating(false); setDueDate(''); setDueTime(''); setReminder('');
      setAudioUrl(null); setImageUrls([]);
      setMode('edit');
      setIsNew(true);
    }
    setLightboxUrl(null);
  }, [open, editId, tasks]);

  const toggleTag = (tagId: string, tag: TagType) => {
    setSelectedTags(prev => {
      const next = prev.includes(tagId) ? prev.filter(x => x !== tagId) : [...prev, tagId];
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
    upsertTask({
      id: editId || undefined,
      title: title.trim(), description: notes, instructions: notes,
      courseId, tagIds: selectedTags, priority, escalating,
      dueDate, dueTime, reminder, audioUrl, imageUrls,
    });
    toast(isNew ? 'Tarea creada ✓' : 'Tarea actualizada', { type: 'success' });
    if (isNew) {
      onClose();
    } else {
      setMode('view');
    }
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

  const handleToggleDone = () => {
    if (!editId) return;
    const wasNotDone = !task?.done;
    toggleTask(editId);
    if (wasNotDone) {
      window.dispatchEvent(new CustomEvent('sut:task-completed', { detail: { title: task?.title } }));
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !meta.uid) return;
    e.target.value = '';
    setUploadingImages(true);
    try {
      const newUrls = await Promise.all(
        files.map(async file => {
          const imageId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          return await uploadImage(file, meta.uid!, meta.spaceId, imageId);
        })
      );
      setImageUrls(prev => [...prev, ...newUrls]);
    } catch {
      toast('Error al subir la imagen', { type: 'danger' });
    } finally {
      setUploadingImages(false);
    }
  };

  // Live task data for view mode
  const task       = tasks.find(x => x.id === editId);
  const course     = courses.find(c => c.id === courseId);
  const taskTags   = selectedTags.map(id => tags.find(t => t.id === id)).filter(Boolean);
  const due        = parseDue(dueDate, dueTime);
  const rel        = due ? relativeDue(due) : null;

  // ── View mode ──────────────────────────────────────────────────────────────
  const renderView = () => (
    <div className="task-detail">
      {/* Priority accent stripe */}
      <div className="task-detail__stripe" style={{ background: PRIO_COLOR[priority] }} />

      {/* Title row */}
      <div className="task-detail__title-row">
        <h2 className={`task-detail__title${task?.done ? ' is-done' : ''}`}>{title}</h2>
        <div className="task-detail__title-badges">
          {task?.done && (
            <span className="task-detail__done-badge">
              <CheckCircle2 size={13} /> Completada
            </span>
          )}
          <span className={`prio-badge ${priority}`}>{PRIORITY_LABELS[priority]}</span>
        </div>
      </div>

      {/* Meta chips */}
      <div className="task-detail__chips">
        {course && (
          <span className="task-detail__chip" style={{ '--chip-c': course.color } as React.CSSProperties}>
            <BookOpen size={12} /> {course.name}
          </span>
        )}
        {due && rel && (
          <span className={`task-detail__chip${rel.state === 'overdue' ? ' is-overdue' : rel.state === 'soon' ? ' is-soon' : ''}`}>
            <Calendar size={12} />
            {dueDate}{dueTime ? ` · ${dueTime}` : ''}
            {(rel.state === 'overdue' || rel.state === 'soon') && (
              <strong style={{ marginLeft: 4 }}>({rel.text})</strong>
            )}
          </span>
        )}
        {escalating && (
          <span className="task-detail__chip task-detail__chip--warn">
            <Zap size={12} /> Escalante
          </span>
        )}
        {audioUrl && (
          <span className="task-detail__chip task-detail__chip--info">
            <Mic size={12} /> Nota de voz
          </span>
        )}
        {imageUrls.length > 0 && (
          <span className="task-detail__chip">
            <ImageIcon size={12} /> {imageUrls.length} imagen{imageUrls.length !== 1 ? 'es' : ''}
          </span>
        )}
      </div>

      {/* Tags */}
      {taskTags.length > 0 && (
        <div className="task-detail__tags">
          {taskTags.map(tag => tag && (
            <span key={tag.id} className="tag-pill" style={{ '--c': tag.color } as React.CSSProperties}>
              <Tag size={10} /> {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Notes (unified description + instructions) */}
      {notes && (
        <div className="task-detail__section">
          <div className="task-detail__section-label">Descripción</div>
          <pre className="task-detail__instructions">{notes}</pre>
        </div>
      )}

      {/* Images */}
      {imageUrls.length > 0 && (
        <div className="task-detail__section">
          <div className="task-detail__section-label">Imágenes adjuntas</div>
          <div className="task-images-grid">
            {imageUrls.map((url, i) => (
              <button
                key={url}
                className="task-image-thumb"
                onClick={() => setLightboxUrl(url)}
                type="button"
                aria-label={`Ver imagen ${i + 1}`}
              >
                <img src={url} alt={`Adjunto ${i + 1}`} />
                <span className="task-image-thumb__overlay"><ChevronRight size={16} /></span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Audio */}
      {audioUrl && meta.uid && (
        <div className="task-detail__section">
          <div className="task-detail__section-label">Nota de voz</div>
          <AudioRecorder uid={meta.uid} spaceId={meta.spaceId} existingUrl={audioUrl} onChange={() => {}} />
        </div>
      )}

      {/* Footer info */}
      {task && (
        <div className="task-detail__created-info">
          <Clock size={11} />
          Creada {new Date(task.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}
          {task.completedAt && ` · Completada ${new Date(task.completedAt).toLocaleDateString('es', { day: 'numeric', month: 'long' })}`}
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="lightbox-overlay" onClick={() => setLightboxUrl(null)}>
          <button className="lightbox-close" onClick={() => setLightboxUrl(null)} type="button">
            <X size={20} />
          </button>
          <img
            src={lightboxUrl}
            alt="Vista completa"
            className="lightbox-img"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );

  // ── Edit mode ──────────────────────────────────────────────────────────────
  const renderEdit = () => (
    <form id="task-form" onSubmit={handleSubmit} className="task-edit-form">
      {/* Title */}
      <div className="form-group">
        <label className="form-label required">Título</label>
        <input
          className="input task-title-input"
          placeholder="¿Qué hay que hacer?"
          value={title}
          onChange={e => setTitle(e.target.value)}
          autoFocus={!('ontouchstart' in window)}
          required
        />
      </div>

      {/* Notes + Images section */}
      <div className="form-group">
        <label className="form-label">Descripción</label>
        <textarea
          className="textarea"
          placeholder="Descripción, pasos, referencias, links..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
          style={{ minHeight: 100 }}
        />

        {/* Image attachments */}
        <div className="task-images-section">
          {(imageUrls.length > 0 || uploadingImages) && (
            <div className="task-images-grid">
              {imageUrls.map((url, i) => (
                <div key={url} className="task-image-thumb task-image-thumb--editable">
                  <img src={url} alt={`Adjunto ${i + 1}`} onClick={() => setLightboxUrl(url)} />
                  <button
                    type="button"
                    className="task-image-remove"
                    onClick={() => setImageUrls(prev => prev.filter(u => u !== url))}
                    aria-label="Eliminar imagen"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
              {uploadingImages && (
                <div className="task-image-uploading">
                  <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
                </div>
              )}
            </div>
          )}

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
          {meta.uid ? (
            <button
              type="button"
              className="btn btn--ghost btn--sm task-add-image-btn"
              onClick={() => imageInputRef.current?.click()}
              disabled={uploadingImages}
            >
              {uploadingImages
                ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Subiendo...</>
                : <><ImageIcon size={13} /> Adjuntar imágenes</>
              }
            </button>
          ) : (
            <p className="task-images-noauth">Inicia sesión para adjuntar imágenes</p>
          )}
        </div>
      </div>

      {/* Course + Due date */}
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

      {/* Time + Reminder */}
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
              <input type="radio" id={`prio-${p}`} name="priority" value={p} checked={priority === p} onChange={() => setPriority(p)} />
              <label htmlFor={`prio-${p}`}>{PRIORITY_LABELS[p]}</label>
            </div>
          ))}
        </div>
      </div>

      {/* Escalating */}
      <div className="toggle-row">
        <div>
          <div className="toggle-label">
            <Zap size={14} style={{ color: 'var(--warn)', flexShrink: 0 }} />
            Prioridad escalante
          </div>
          <div className="toggle-sub">Se incrementa automáticamente al acercarse la fecha</div>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={escalating} onChange={e => setEscalating(e.target.checked)} />
          <span className="toggle-track"><span className="toggle-thumb" /></span>
        </label>
      </div>

      {/* Audio */}
      {meta.uid && (
        <div className="form-group">
          <label className="form-label">Nota de voz</label>
          <AudioRecorder uid={meta.uid} spaceId={meta.spaceId} existingUrl={audioUrl} onChange={setAudioUrl} />
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

      {/* Lightbox from edit mode */}
      {lightboxUrl && (
        <div className="lightbox-overlay" onClick={() => setLightboxUrl(null)}>
          <button className="lightbox-close" onClick={() => setLightboxUrl(null)} type="button">
            <X size={20} />
          </button>
          <img src={lightboxUrl} alt="Vista completa" className="lightbox-img" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </form>
  );

  // ── Modal shell ────────────────────────────────────────────────────────────
  const modalTitle = mode === 'view'
    ? (task?.title || 'Tarea')
    : (isNew ? 'Nueva tarea' : 'Editar tarea');

  const footerLeft = editId ? (
    <button className="btn btn--danger btn--sm" onClick={handleDelete} type="button">
      <Trash2 size={14} /> Eliminar
    </button>
  ) : undefined;

  const footer = mode === 'view' ? (
    <>
      <button className="btn btn--secondary" onClick={() => setMode('edit')} type="button">
        <Edit2 size={14} /> Editar
      </button>
      <button
        className={`btn ${task?.done ? 'btn--secondary' : 'btn--primary'}`}
        type="button"
        onClick={handleToggleDone}
      >
        {task?.done
          ? <><Circle size={14} /> Reabrir</>
          : <><Check size={14} /> Completar</>
        }
      </button>
    </>
  ) : (
    <>
      <button className="btn btn--secondary" onClick={isNew ? onClose : () => setMode('view')} type="button">
        {isNew ? 'Cancelar' : 'Volver'}
      </button>
      <button className="btn btn--primary" form="task-form" type="submit">
        {isNew ? 'Crear tarea' : 'Guardar cambios'}
      </button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={modalTitle}
      wide
      footerLeft={footerLeft}
      footer={footer}
    >
      {mode === 'view' ? renderView() : renderEdit()}
    </Modal>
  );
}

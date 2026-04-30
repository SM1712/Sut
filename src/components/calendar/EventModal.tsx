import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import Modal from '../ui/Modal';
import ColorPicker from '../ui/ColorPicker';
import { useStore } from '../../store';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../ui/Confirm';
import type { EventType } from '../../types';
import { EVENT_TYPES, EVENT_COLORS } from '../../lib/constants';

interface Props {
  open: boolean;
  editId: string | null;
  prefillStart?: string;
  prefillEnd?: string;
  onClose: () => void;
}

export default function EventModal({ open, editId, prefillStart, prefillEnd, onClose }: Props) {
  const upsertEvent = useStore(s => s.upsertEvent);
  const deleteEvent = useStore(s => s.deleteEvent);
  const events = useStore(s => s.events);
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<EventType>('exam');
  const [color, setColor] = useState(EVENT_TYPES.exam.color);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editId) {
      const ev = events.find(e => e.id === editId);
      if (ev) {
        setTitle(ev.title); setDescription(ev.description || '');
        setType(ev.type); setColor(ev.color);
        setStartDate(ev.startDate); setEndDate(ev.endDate || ev.startDate);
      }
    } else {
      const today = prefillStart || new Date().toISOString().slice(0, 10);
      setTitle(''); setDescription('');
      setType('exam'); setColor(EVENT_TYPES.exam.color);
      setStartDate(today); setEndDate(prefillEnd || today);
    }
  }, [open, editId, events, prefillStart, prefillEnd]);

  const handleTypeChange = (t: EventType) => {
    setType(t);
    setColor(EVENT_TYPES[t].color);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (startDate > endDate) { toast('La fecha de inicio no puede ser mayor al fin', { type: 'danger' }); return; }
    upsertEvent({ id: editId || undefined, title: title.trim(), description, type, color, startDate, endDate, allDay: true });
    toast(editId ? 'Evento actualizado' : 'Evento creado 🗓', { type: 'success' });
    onClose();
  };

  const handleDelete = async () => {
    if (!editId) return;
    const ev = events.find(e => e.id === editId);
    const ok = await confirm({ title: `¿Eliminar "${ev?.title}"?`, text: 'El evento se eliminará del calendario.', confirmText: 'Eliminar' });
    if (!ok) return;
    deleteEvent(editId);
    toast('Evento eliminado', { type: 'warn' });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editId ? 'Editar evento' : 'Nuevo evento'}
      footerLeft={editId ? (
        <button className="btn btn--danger btn--sm" onClick={handleDelete} type="button">
          <Trash2 size={15} /> Eliminar
        </button>
      ) : undefined}
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose} type="button">Cancelar</button>
          <button className="btn btn--primary" form="event-form" type="submit">
            {editId ? 'Guardar' : 'Crear evento'}
          </button>
        </>
      }
    >
      <form id="event-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        <div className="form-group">
          <label className="form-label required">Título</label>
          <input
            className="input"
            placeholder="Nombre del evento"
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus={!('ontouchstart' in window)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Descripción</label>
          <textarea
            className="textarea"
            placeholder="Notas adicionales..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={{ minHeight: 72 }}
          />
        </div>

        {/* Type selector */}
        <div className="form-group">
          <label className="form-label">Tipo</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-2)' }}>
            {(Object.entries(EVENT_TYPES) as [EventType, (typeof EVENT_TYPES)[EventType]][]).map(([k, v]) => (
              <button
                key={k}
                type="button"
                onClick={() => handleTypeChange(k)}
                style={{
                  padding: '8px 4px',
                  border: `2px solid ${type === k ? v.color : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  background: type === k ? `color-mix(in srgb, ${v.color} 12%, transparent)` : 'transparent',
                  color: type === k ? v.color : 'var(--text-mute)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all var(--dur-fast)',
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>{v.emoji}</span>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Color picker */}
        <div className="form-group">
          <label className="form-label">Color</label>
          <ColorPicker colors={EVENT_COLORS} value={color} onChange={setColor} />
        </div>

        {/* Date range */}
        <div className="input-row">
          <div className="form-group">
            <label className="form-label required">Inicio</label>
            <input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Fin</label>
            <input className="input" type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
      </form>
    </Modal>
  );
}

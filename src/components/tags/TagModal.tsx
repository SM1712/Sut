import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import Modal from '../ui/Modal';
import ColorPicker from '../ui/ColorPicker';
import { useStore } from '../../store';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../ui/Confirm';
import { ACCENT_COLORS } from '../../lib/constants';
import type { Priority } from '../../types';

interface Props {
  open: boolean;
  editId: string | null;
  onClose: () => void;
}

const PRIORITIES: { value: Priority | ''; label: string }[] = [
  { value: '', label: 'Sin preferencia' },
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

export default function TagModal({ open, editId, onClose }: Props) {
  const upsertTag = useStore(s => s.upsertTag);
  const deleteTag = useStore(s => s.deleteTag);
  const tags = useStore(s => s.tags);
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('type');
  const [color, setColor] = useState(ACCENT_COLORS[0]);
  const [defaultPriority, setDefaultPriority] = useState<Priority | ''>('');

  useEffect(() => {
    if (!open) return;
    if (editId) {
      const t = tags.find(x => x.id === editId);
      if (t) { setName(t.name); setCategory(t.category); setColor(t.color); setDefaultPriority(t.defaultPriority); }
    } else {
      setName(''); setCategory('type'); setColor(ACCENT_COLORS[0]); setDefaultPriority('');
    }
  }, [open, editId, tags]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    upsertTag({ id: editId || undefined, name: name.trim(), category, color, defaultPriority });
    toast(editId ? 'Etiqueta actualizada' : 'Etiqueta creada', { type: 'success' });
    onClose();
  };

  const handleDelete = async () => {
    if (!editId) return;
    const t = tags.find(x => x.id === editId);
    const ok = await confirm({ title: `¿Eliminar "${t?.name}"?`, text: 'Se eliminará de todas las tareas que la usen.', confirmText: 'Eliminar' });
    if (!ok) return;
    deleteTag(editId);
    toast('Etiqueta eliminada', { type: 'warn' });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editId ? 'Editar etiqueta' : 'Nueva etiqueta'}
      footerLeft={editId ? (
        <button className="btn btn--danger btn--sm" onClick={handleDelete} type="button">
          <Trash2 size={15} /> Eliminar
        </button>
      ) : undefined}
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose} type="button">Cancelar</button>
          <button className="btn btn--primary" form="tag-form" type="submit">
            {editId ? 'Guardar' : 'Crear etiqueta'}
          </button>
        </>
      }
    >
      <form id="tag-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        <div className="form-group">
          <label className="form-label required">Nombre</label>
          <input className="input" placeholder="Ej: Examen, Investigación..." value={name} onChange={e => setName(e.target.value)} autoFocus={!('ontouchstart' in window)} required />
        </div>
        <div className="input-row">
          <div className="form-group">
            <label className="form-label">Categoría</label>
            <select className="input select" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="type">Tipo</option>
              <option value="cycle">Ciclo</option>
              <option value="group">Grupo</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Prioridad sugerida</label>
            <select className="input select" value={defaultPriority} onChange={e => setDefaultPriority(e.target.value as Priority | '')}>
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Color</label>
          <ColorPicker colors={ACCENT_COLORS} value={color} onChange={setColor} />
          <div style={{ marginTop: 8 }}>
            <span className="tag-pill" style={{ '--c': color } as React.CSSProperties}>{name || 'Vista previa'}</span>
          </div>
        </div>
      </form>
    </Modal>
  );
}

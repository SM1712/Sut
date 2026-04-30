import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import Modal from '../ui/Modal';
import ColorPicker from '../ui/ColorPicker';
import { useStore } from '../../store';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../ui/Confirm';
import { ACCENT_COLORS } from '../../lib/constants';

interface Props {
  open: boolean;
  editId: string | null;
  onClose: () => void;
}

export default function CourseModal({ open, editId, onClose }: Props) {
  const upsertCourse = useStore(s => s.upsertCourse);
  const deleteCourse = useStore(s => s.deleteCourse);
  const courses = useStore(s => s.courses);
  const tasks = useStore(s => s.tasks);
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [teacher, setTeacher] = useState('');
  const [color, setColor] = useState(ACCENT_COLORS[0]);

  useEffect(() => {
    if (!open) return;
    if (editId) {
      const c = courses.find(x => x.id === editId);
      if (c) { setName(c.name); setCode(c.code); setTeacher(c.teacher); setColor(c.color); }
    } else {
      setName(''); setCode(''); setTeacher(''); setColor(ACCENT_COLORS[0]);
    }
  }, [open, editId, courses]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    upsertCourse({ id: editId || undefined, name: name.trim(), code, teacher, color });
    toast(editId ? 'Curso actualizado' : 'Curso creado', { type: 'success' });
    onClose();
  };

  const handleDelete = async () => {
    if (!editId) return;
    const c = courses.find(x => x.id === editId);
    const taskCount = tasks.filter(t => t.courseId === editId).length;
    const ok = await confirm({
      title: `¿Eliminar "${c?.name}"?`,
      text: taskCount > 0
        ? `Este curso tiene ${taskCount} tarea(s) asociada(s). Las tareas quedarán sin curso.`
        : 'El curso se eliminará permanentemente.',
      confirmText: 'Eliminar',
    });
    if (!ok) return;
    deleteCourse(editId);
    toast('Curso eliminado', { type: 'warn' });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editId ? 'Editar curso' : 'Nuevo curso'}
      footerLeft={editId ? (
        <button className="btn btn--danger btn--sm" onClick={handleDelete} type="button">
          <Trash2 size={15} /> Eliminar
        </button>
      ) : undefined}
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose} type="button">Cancelar</button>
          <button className="btn btn--primary" form="course-form" type="submit">
            {editId ? 'Guardar' : 'Crear curso'}
          </button>
        </>
      }
    >
      <form id="course-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        <div className="form-group">
          <label className="form-label required">Nombre del curso</label>
          <input className="input" placeholder="Ej: Cálculo II" value={name} onChange={e => setName(e.target.value)} autoFocus={!('ontouchstart' in window)} required />
        </div>
        <div className="input-row">
          <div className="form-group">
            <label className="form-label">Código</label>
            <input className="input" placeholder="MAT202" value={code} onChange={e => setCode(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Profesor/a</label>
            <input className="input" placeholder="Nombre" value={teacher} onChange={e => setTeacher(e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Color</label>
          <ColorPicker colors={ACCENT_COLORS} value={color} onChange={setColor} />
          {/* Preview */}
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <span className="course-pill" style={{ '--c': color } as React.CSSProperties}>{name || 'Vista previa'}</span>
          </div>
        </div>
      </form>
    </Modal>
  );
}

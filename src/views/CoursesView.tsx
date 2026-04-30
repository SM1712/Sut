import { useState } from 'react';
import { Plus, BookOpen, Edit2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useStore } from '../store';
import CourseModal from '../components/courses/CourseModal';

export default function CoursesView() {
  const courses = useStore(s => s.courses);
  const tasks = useStore(s => s.tasks);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const openNew  = () => { setEditId(null); setOpen(true); };
  const openEdit = (id: string) => { setEditId(id); setOpen(true); };

  return (
    <div className="page-content">
      <div className="section-header">
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Cursos</h1>
        <button className="btn btn--primary" onClick={openNew}>
          <Plus size={16} /> Nuevo curso
        </button>
      </div>

      {courses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__art"><BookOpen size={56} /></div>
          <div className="empty-state__title">Sin cursos</div>
          <div className="empty-state__text">Agrega tus materias para organizar tus tareas.</div>
          <button className="btn btn--primary" onClick={openNew} style={{ marginTop: 'var(--sp-3)' }}>
            <Plus size={16} /> Nuevo curso
          </button>
        </div>
      ) : (
        <div className="courses-grid">
          {courses.map((c, i) => {
            const pending = tasks.filter(t => t.courseId === c.id && !t.done).length;
            const done    = tasks.filter(t => t.courseId === c.id && t.done).length;
            return (
              <motion.div
                key={c.id}
                className="course-card"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.22 }}
                onClick={() => openEdit(c.id)}
              >
                <div className="course-card__header" style={{ '--c': c.color } as React.CSSProperties} />
                <div className="course-card__body">
                  <div className="course-card__name">{c.name}</div>
                  {c.code && <div className="course-card__code">{c.code}{c.teacher ? ` · ${c.teacher}` : ''}</div>}
                  <div className="course-card__stats">
                    <div className="course-card__stat"><span>{pending}</span> pendiente{pending !== 1 ? 's' : ''}</div>
                    <div className="course-card__stat"><span>{done}</span> completada{done !== 1 ? 's' : ''}</div>
                  </div>
                </div>
                <div className="course-card__actions" onClick={e => e.stopPropagation()}>
                  <button className="icon-btn" onClick={() => openEdit(c.id)} aria-label="Editar">
                    <Edit2 size={15} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <CourseModal open={open} editId={editId} onClose={() => setOpen(false)} />
    </div>
  );
}

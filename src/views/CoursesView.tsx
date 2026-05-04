import { useState } from 'react';
import { Plus, BookOpen, Edit2, GraduationCap, User, ArrowRight } from 'lucide-react';
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

  const totalPending = tasks.filter(t => !t.done).length;
  const totalDone    = tasks.filter(t => t.done).length;

  return (
    <div className="page-content">
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Cursos</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-mute)', marginTop: 2 }}>
            {courses.length} {courses.length === 1 ? 'materia' : 'materias'}
          </p>
        </div>
        <button className="btn btn--primary" onClick={openNew}>
          <Plus size={16} /> Nuevo curso
        </button>
      </div>

      {courses.length > 0 && (
        <div className="courses-summary">
          <div className="courses-stat-chip">
            <BookOpen size={13} />
            <span><strong>{courses.length}</strong> cursos activos</span>
          </div>
          <div className="courses-stat-chip">
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warn)', display: 'inline-block' }} />
            <span><strong>{totalPending}</strong> tareas pendientes</span>
          </div>
          <div className="courses-stat-chip">
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
            <span><strong>{totalDone}</strong> completadas</span>
          </div>
        </div>
      )}

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
            const pending  = tasks.filter(t => t.courseId === c.id && !t.done).length;
            const done     = tasks.filter(t => t.courseId === c.id && t.done).length;
            const total    = pending + done;
            const progress = total > 0 ? Math.round((done / total) * 100) : 0;

            return (
              <motion.div
                key={c.id}
                className="course-card"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.25, ease: 'easeOut' }}
                style={{ '--c': c.color } as React.CSSProperties}
              >
                {/* Splash header */}
                <div className="course-card__splash">
                  <div className="course-card__splash-icon">
                    <GraduationCap size={18} />
                  </div>
                  <button
                    className="course-card__edit-btn"
                    onClick={() => openEdit(c.id)}
                    aria-label="Editar curso"
                  >
                    <Edit2 size={13} />
                  </button>
                </div>

                {/* Body */}
                <div className="course-card__body">
                  <div className="course-card__name">{c.name}</div>
                  <div className="course-card__meta">
                    {c.code && (
                      <span className="course-card__badge">{c.code}</span>
                    )}
                    {c.teacher && (
                      <span className="course-card__teacher">
                        <User size={11} /> {c.teacher}
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer with progress */}
                <div className="course-card__footer">
                  <div className="course-card__progress-wrap">
                    <div className="course-card__progress-labels">
                      <span><strong>{pending}</strong> pendiente{pending !== 1 ? 's' : ''}</span>
                      <span><strong>{done}</strong> completada{done !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="course-card__progress-bar">
                      <div
                        className="course-card__progress-fill"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  <button
                    className="course-card__tasks-btn"
                    onClick={() => openEdit(c.id)}
                    aria-label="Ver tareas"
                  >
                    {total === 0 ? 'Sin tareas' : `${progress}%`}
                    <ArrowRight size={11} />
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

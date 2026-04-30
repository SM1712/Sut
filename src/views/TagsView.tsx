import { useState } from 'react';
import { Plus, Tag as TagIcon, Edit2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useStore } from '../store';
import TagModal from '../components/tags/TagModal';
import { PRIORITY_LABELS } from '../lib/constants';
import type { Priority } from '../types';

export default function TagsView() {
  const tags = useStore(s => s.tags);
  const tasks = useStore(s => s.tasks);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const openNew  = () => { setEditId(null); setOpen(true); };
  const openEdit = (id: string) => { setEditId(id); setOpen(true); };

  return (
    <div className="page-content">
      <div className="section-header">
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Etiquetas</h1>
        <button className="btn btn--primary" onClick={openNew}>
          <Plus size={16} /> Nueva etiqueta
        </button>
      </div>

      {tags.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__art"><TagIcon size={56} /></div>
          <div className="empty-state__title">Sin etiquetas</div>
          <div className="empty-state__text">Crea etiquetas para clasificar tus tareas.</div>
          <button className="btn btn--primary" onClick={openNew} style={{ marginTop: 'var(--sp-3)' }}>
            <Plus size={16} /> Nueva etiqueta
          </button>
        </div>
      ) : (
        <div className="tags-grid">
          {tags.map((t, i) => {
            const count = tasks.filter(task => task.tagIds?.includes(t.id)).length;
            return (
              <motion.div
                key={t.id}
                className="tag-card"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04, duration: 0.2 }}
                onClick={() => openEdit(t.id)}
              >
                <div className="tag-card__dot" style={{ '--c': t.color } as React.CSSProperties} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tag-card__name truncate">{t.name}</div>
                  <div className="tag-card__prio">
                    {t.defaultPriority ? `Prio. ${PRIORITY_LABELS[t.defaultPriority as Priority]}` : t.category}
                    {' · '}{count} tarea{count !== 1 ? 's' : ''}
                  </div>
                </div>
                <button
                  className="icon-btn"
                  onClick={e => { e.stopPropagation(); openEdit(t.id); }}
                  aria-label="Editar"
                >
                  <Edit2 size={14} />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      <TagModal open={open} editId={editId} onClose={() => setOpen(false)} />
    </div>
  );
}

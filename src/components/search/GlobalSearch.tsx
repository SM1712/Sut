import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, CheckSquare, BookOpen, Calendar, X, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { parseDue, relativeDue } from '../../lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Optionally open edit modal for a task */
  onEditTask?: (id: string) => void;
}

type ResultKind = 'task' | 'course' | 'event';

interface SearchResult {
  kind: ResultKind;
  id: string;
  label: string;
  sub?: string;
  color?: string;
  done?: boolean;
}

function highlight(text: string, query: string): string {
  if (!query) return text;
  return text; // we use CSS to highlight via mark — see below
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

const ICON: Record<ResultKind, typeof Search> = {
  task: CheckSquare,
  course: BookOpen,
  event: Calendar,
};

export default function GlobalSearch({ open, onClose, onEditTask }: Props) {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const tasks   = useStore(s => s.tasks);
  const courses = useStore(s => s.courses);
  const events  = useStore(s => s.events);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Global keyboard shortcut: Cmd/Ctrl+K toggles the search panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (open) {
          onClose();
        } else {
          window.dispatchEvent(new CustomEvent('sut:search-open'));
        }
      }
      // Escape also closes
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: SearchResult[] = [];

    // Tasks
    tasks.forEach(t => {
      if (
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.instructions && t.instructions.toLowerCase().includes(q))
      ) {
        const due = parseDue(t.dueDate, t.dueTime);
        const rel = relativeDue(due);
        out.push({
          kind: 'task',
          id: t.id,
          label: t.title,
          sub: rel.text || (t.done ? 'Completada' : 'Sin fecha'),
          done: t.done,
        });
      }
    });

    // Courses
    courses.forEach(c => {
      if (
        c.name.toLowerCase().includes(q) ||
        (c.code && c.code.toLowerCase().includes(q)) ||
        (c.teacher && c.teacher.toLowerCase().includes(q))
      ) {
        const taskCount = tasks.filter(t => t.courseId === c.id && !t.done).length;
        out.push({
          kind: 'course',
          id: c.id,
          label: c.name,
          sub: c.code ? `${c.code}${taskCount > 0 ? ` · ${taskCount} pendiente${taskCount !== 1 ? 's' : ''}` : ''}` : undefined,
          color: c.color,
        });
      }
    });

    // Events
    events.forEach(ev => {
      if (
        ev.title.toLowerCase().includes(q) ||
        (ev.description && ev.description.toLowerCase().includes(q))
      ) {
        out.push({
          kind: 'event',
          id: ev.id,
          label: ev.title,
          sub: ev.startDate,
          color: ev.color,
        });
      }
    });

    return out.slice(0, 20);
  }, [query, tasks, courses, events]);

  // Reset active index when results change
  useEffect(() => { setActiveIdx(0); }, [results]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const select = useCallback((r: SearchResult) => {
    onClose();
    if (r.kind === 'task') {
      navigate('/tasks');
      setTimeout(() => onEditTask?.(r.id), 150);
    } else if (r.kind === 'course') {
      navigate('/courses');
    } else if (r.kind === 'event') {
      navigate('/calendar');
    }
  }, [navigate, onClose, onEditTask]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[activeIdx]) { e.preventDefault(); select(results[activeIdx]); }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="search-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          paddingTop: 'clamp(48px, 12vh, 120px)',
          paddingLeft: 'var(--sp-4)',
          paddingRight: 'var(--sp-4)',
        }}
      >
        <motion.div
          key="search-panel"
          initial={{ opacity: 0, scale: 0.96, y: -12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -8 }}
          transition={{ duration: 0.18 }}
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 560,
            background: 'var(--surface)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            overflow: 'hidden',
          }}
        >
          {/* Input row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-3) var(--sp-4)', borderBottom: `1px solid var(--border)` }}>
            <Search size={18} style={{ color: 'var(--text-mute)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Buscar tareas, cursos, eventos…"
              style={{
                flex: 1, border: 'none', background: 'transparent',
                fontSize: '1rem', color: 'var(--text)',
                outline: 'none', padding: 0,
              }}
            />
            {query && (
              <button className="icon-btn" onClick={() => setQuery('')} style={{ flexShrink: 0 }}>
                <X size={16} />
              </button>
            )}
          </div>

          {/* Results list */}
          <div
            ref={listRef}
            style={{ maxHeight: 360, overflowY: 'auto' }}
          >
            {query.trim() === '' ? (
              <div style={{ padding: 'var(--sp-5)', textAlign: 'center', color: 'var(--text-faint)', fontSize: '0.875rem' }}>
                Escribe para buscar en tareas, cursos y eventos
              </div>
            ) : results.length === 0 ? (
              <div style={{ padding: 'var(--sp-5)', textAlign: 'center', color: 'var(--text-faint)', fontSize: '0.875rem' }}>
                Sin resultados para <strong>"{query}"</strong>
              </div>
            ) : (
              results.map((r, i) => {
                const Icon = ICON[r.kind];
                const isActive = i === activeIdx;
                return (
                  <div
                    key={`${r.kind}-${r.id}`}
                    data-idx={i}
                    onClick={() => select(r)}
                    onMouseEnter={() => setActiveIdx(i)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
                      padding: 'var(--sp-3) var(--sp-4)',
                      cursor: 'pointer',
                      background: isActive ? 'var(--surface-raised)' : 'transparent',
                      transition: 'background 0.1s',
                    }}
                  >
                    {/* Kind icon */}
                    <div style={{
                      width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                      background: r.color ? `color-mix(in srgb, ${r.color} 15%, transparent)` : 'var(--surface-raised)',
                      color: r.color || 'var(--text-mute)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {r.done
                        ? <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                        : <Icon size={16} />
                      }
                    </div>

                    {/* Text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.9375rem',
                        fontWeight: 500,
                        textDecoration: r.done ? 'line-through' : 'none',
                        color: r.done ? 'var(--text-mute)' : 'var(--text)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        <HighlightText text={r.label} query={query.trim()} />
                      </div>
                      {r.sub && (
                        <div style={{ fontSize: '0.78125rem', color: 'var(--text-faint)' }}>
                          {r.sub}
                        </div>
                      )}
                    </div>

                    {/* Kind badge */}
                    <span style={{
                      fontSize: '0.6875rem', fontWeight: 500,
                      color: 'var(--text-faint)',
                      background: 'var(--surface-raised)',
                      padding: '2px 6px', borderRadius: 99,
                      flexShrink: 0, textTransform: 'capitalize',
                    }}>
                      { r.kind === 'task' ? 'tarea' : r.kind === 'course' ? 'curso' : 'evento' }
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer shortcuts hint */}
          {results.length > 0 && (
            <div style={{
              display: 'flex', gap: 'var(--sp-4)', padding: 'var(--sp-2) var(--sp-4)',
              borderTop: `1px solid var(--border)`,
              fontSize: '0.71875rem', color: 'var(--text-faint)',
            }}>
              <span><kbd style={{ fontFamily: 'inherit', background: 'var(--surface-raised)', padding: '1px 4px', borderRadius: 4 }}>↑↓</kbd> navegar</span>
              <span><kbd style={{ fontFamily: 'inherit', background: 'var(--surface-raised)', padding: '1px 4px', borderRadius: 4 }}>↵</kbd> abrir</span>
              <span><kbd style={{ fontFamily: 'inherit', background: 'var(--surface-raised)', padding: '1px 4px', borderRadius: 4 }}>Esc</kbd> cerrar</span>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

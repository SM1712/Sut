import { NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, CheckSquare, Calendar, BookOpen,
  Tag, TrendingUp, Wrench, Settings, X,
} from 'lucide-react';
import { useStore } from '../../store';

interface Props {
  open: boolean;
  onClose: () => void;
  onSettings: () => void;
  isMobile: boolean;
}

/* ── Navigation structure ─────────────────────────────── */
const PRIMARY_NAV = [
  { to: '/',         icon: LayoutDashboard, label: 'Inicio' },
  { to: '/tasks',    icon: CheckSquare,     label: 'Tareas' },
  { to: '/calendar', icon: Calendar,        label: 'Calendario' },
  { to: '/courses',  icon: BookOpen,        label: 'Cursos' },
];

const SECONDARY_NAV = [
  { to: '/stats',  icon: TrendingUp, label: 'Estadísticas' },
  { to: '/tags',   icon: Tag,        label: 'Etiquetas' },
  { to: '/tools',  icon: Wrench,     label: 'Herramientas' },
];

/* ── Nav item ─────────────────────────────────────────── */
function NavItem({
  to, icon: Icon, label, badge, onClose,
}: {
  to: string; icon: typeof LayoutDashboard; label: string;
  badge?: boolean; onClose: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`}
      onClick={onClose}
    >
      <span className="nav-item__icon-wrap">
        <Icon size={17} className="nav-item__icon" />
      </span>
      <span className="nav-item__label">{label}</span>
      {badge && <span className="nav-item__badge" />}
    </NavLink>
  );
}

/* ── Sidebar content ──────────────────────────────────── */
function SidebarContent({
  onClose, onSettings, isMobile,
}: { onClose: () => void; onSettings: () => void; isMobile: boolean }) {
  const tasks = useStore(s => s.tasks);
  const meta  = useStore(s => s.meta);

  const pending = tasks.filter(t => !t.done).length;

  return (
    <>
      {/* Header: logo + close button on mobile */}
      <div className="sidebar__header">
        <NavLink to="/" className="sidebar__logo" onClick={onClose}>
          <svg width="28" height="28" viewBox="0 0 30 30" fill="none" aria-hidden="true">
            <rect width="30" height="30" rx="8" fill="url(#sut-g2)" />
            <path d="M7 15L12.5 20.5L23 10" stroke="white" strokeWidth="2.8"
              strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="sut-g2" x1="0" y1="0" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                <stop stopColor="#A78BFA" /><stop offset="1" stopColor="#7C3AED" />
              </linearGradient>
            </defs>
          </svg>
          <span className="sidebar__logo-text">S<span>U</span>T</span>
        </NavLink>

        {isMobile && (
          <button className="sidebar__close-btn icon-btn" onClick={onClose} aria-label="Cerrar menú">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar__nav">
        {/* Primary */}
        <span className="nav-section-title">Principal</span>
        {PRIMARY_NAV.map(({ to, icon, label }) => (
          <NavItem key={to} to={to} icon={icon} label={label}
            badge={label === 'Tareas' && pending > 0}
            onClose={onClose} />
        ))}

        {/* Secondary */}
        <span className="nav-section-title">Utilidades</span>
        {SECONDARY_NAV.map(({ to, icon, label }) => (
          <NavItem key={to} to={to} icon={icon} label={label} onClose={onClose} />
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar__footer">
        {/* User chip */}
        {meta.uid && (
          <div className="sidebar__user">
            <div className="sidebar__user-avatar">
              {(meta.email || 'U')[0].toUpperCase()}
            </div>
            <div className="sidebar__user-info">
              <span className="sidebar__user-name">
                {meta.email?.split('@')[0]}
              </span>
              <span className="sidebar__user-email">{meta.email}</span>
            </div>
          </div>
        )}

        {/* Settings */}
        <button
          className="nav-item sidebar__settings-btn"
          onClick={() => { onClose(); onSettings(); }}
        >
          <span className="nav-item__icon-wrap">
            <Settings size={17} className="nav-item__icon" />
          </span>
          <span className="nav-item__label">Configuración</span>
        </button>
      </div>
    </>
  );
}

/* ── Exported component ───────────────────────────────── */
export default function Sidebar({ open, onClose, onSettings, isMobile }: Props) {
  if (!isMobile) {
    return (
      <aside className="sidebar">
        <SidebarContent onClose={() => {}} onSettings={onSettings} isMobile={false} />
      </aside>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="sidebar-overlay"
            style={{ display: 'block' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            className="sidebar is-open"
            initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 340 }}
          >
            <SidebarContent onClose={onClose} onSettings={onSettings} isMobile />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

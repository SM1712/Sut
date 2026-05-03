import { NavLink, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, CheckSquare, Calendar, BookOpen, Tag, TrendingUp,
  Wrench, Settings, LogIn, LogOut, Users, Download, Upload,
} from 'lucide-react';
import { useStore } from '../../store';
import { loginWithGoogle, logoutFirebase } from '../../store/sync';
import { useToast } from '../ui/Toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onSettings: () => void;
  isMobile: boolean;
}

const NAV_ITEMS = [
  { to: '/',         icon: LayoutDashboard, label: 'Inicio' },
  { to: '/tasks',    icon: CheckSquare,     label: 'Tareas' },
  { to: '/calendar', icon: Calendar,        label: 'Calendario' },
  { to: '/courses',  icon: BookOpen,        label: 'Cursos' },
  { to: '/tags',     icon: Tag,             label: 'Etiquetas' },
  { to: '/stats',    icon: TrendingUp,      label: 'Estadísticas' },
  { to: '/tools',    icon: Wrench,          label: 'Herramientas' },
];

function SidebarContent({ onClose, onSettings }: { onClose: () => void; onSettings: () => void }) {
  const tasks   = useStore(s => s.tasks);
  const meta    = useStore(s => s.meta);
  const exportData = useStore(s => s.exportData);
  const importData = useStore(s => s.importData);
  const { toast } = useToast();
  const navigate = useNavigate();

  const pending = tasks.filter(t => !t.done).length;

  const handleLogin = async () => {
    try { await loginWithGoogle(); }
    catch { toast('Error al iniciar sesión', { type: 'danger' }); }
  };

  const handleLogout = async () => {
    await logoutFirebase();
    useStore.getState().clearAuth(); // solo borra uid/email — espacio y datos quedan intactos
    toast('Sesión cerrada', { type: 'info' });
  };

  const handleExport = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `sut-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Datos exportados', { type: 'success' });
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          importData(ev.target?.result as string);
          toast('Datos importados', { type: 'success' });
          navigate('/');
        } catch { toast('Archivo inválido', { type: 'danger' }); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <>
      {/* Logo */}
      <NavLink to="/" className="sidebar__logo" onClick={onClose}>
        <svg className="sidebar__logo-img" width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect width="30" height="30" rx="8" fill="url(#sut-grad)"/>
          <path d="M7 15L12.5 20.5L23 10" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
          <defs>
            <linearGradient id="sut-grad" x1="0" y1="0" x2="30" y2="30" gradientUnits="userSpaceOnUse">
              <stop stopColor="#A78BFA"/>
              <stop offset="1" stopColor="#7C3AED"/>
            </linearGradient>
          </defs>
        </svg>
        <span className="sidebar__logo-text">S<span>U</span>T</span>
      </NavLink>

      {/* Active space badge */}
      {meta.spaceId && (
        <div style={{ padding: '0 12px 8px' }}>
          <div className="space-badge">
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: 'var(--success)',
              animation: 'pulse-green 1.8s ease-out infinite', flexShrink: 0,
            }} />
            <Users size={13} />
            <span style={{ flex: 1, fontSize: '0.8125rem', fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {meta.spaceName || 'Espacio'}
            </span>
            <span className="space-badge__code">{meta.spaceId}</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="sidebar__nav">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`}
            onClick={onClose}
          >
            <Icon className="nav-item__icon" size={20} />
            <span className="nav-item__label">{label}</span>
            {label === 'Tareas' && pending > 0 && (
              <span className="nav-item__badge" />
            )}
          </NavLink>
        ))}

        <span className="nav-section-title" style={{ marginTop: 8 }}>Cuenta</span>
        {meta.uid ? (
          <button className="nav-item" onClick={handleLogout}>
            <LogOut className="nav-item__icon" size={20} />
            <span className="nav-item__label">Cerrar sesión</span>
          </button>
        ) : (
          <button className="nav-item" onClick={handleLogin}>
            <LogIn className="nav-item__icon" size={20} />
            <span className="nav-item__label">Iniciar sesión con Google</span>
          </button>
        )}

        <span className="nav-section-title" style={{ marginTop: 8 }}>Datos</span>
        <button className="nav-item" onClick={handleExport}>
          <Download className="nav-item__icon" size={20} />
          <span className="nav-item__label">Exportar</span>
        </button>
        <button className="nav-item" onClick={handleImport}>
          <Upload className="nav-item__icon" size={20} />
          <span className="nav-item__label">Importar</span>
        </button>
      </nav>

      {/* Footer */}
      <div className="sidebar__footer">
        {meta.uid ? (
          <div className="user-badge">
            <div className="user-avatar-placeholder" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              {meta.email?.[0]?.toUpperCase() || '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-name truncate">{meta.email?.split('@')[0]}</div>
              <div className="user-email">{meta.email}</div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '4px 8px', color: 'var(--text-faint)', fontSize: '0.8125rem' }}>
            Modo local — sin sincronización
          </div>
        )}
        <button className="nav-item" onClick={() => { onClose(); onSettings(); }}>
          <Settings className="nav-item__icon" size={20} />
          <span className="nav-item__label">Apariencia</span>
        </button>
      </div>
    </>
  );
}

export default function Sidebar({ open, onClose, onSettings, isMobile }: Props) {
  if (!isMobile) {
    return (
      <aside className="sidebar">
        <SidebarContent onClose={() => {}} onSettings={onSettings} />
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            className="sidebar is-open"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 340 }}
          >
            <SidebarContent onClose={onClose} onSettings={onSettings} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

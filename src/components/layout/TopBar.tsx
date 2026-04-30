import { useLocation } from 'react-router-dom';
import { Menu, Plus, User, Settings, Search } from 'lucide-react';
import { useStore } from '../../store';

const PAGE_TITLES: Record<string, string> = {
  '/':         'Inicio',
  '/tasks':    'Tareas',
  '/calendar': 'Calendario',
  '/courses':  'Cursos',
  '/tags':     'Etiquetas',
  '/stats':    'Estadísticas',
};

interface Props {
  onMenuToggle: () => void;
  onSettings: () => void;
  onAccount: () => void;
  onSearch: () => void;
  onNewTask?: () => void;
}

export default function TopBar({ onMenuToggle, onSettings, onAccount, onSearch, onNewTask }: Props) {
  const { pathname } = useLocation();
  const meta = useStore(s => s.meta);

  const title = PAGE_TITLES[pathname] || 'SUT';
  const isLoggedIn = !!meta.uid;

  return (
    <header className="topbar">
      <button
        className="topbar__menu-btn icon-btn"
        onClick={onMenuToggle}
        aria-label="Abrir menú"
      >
        <Menu size={22} />
      </button>

      <span className="topbar__title">{title}</span>

      <div className="topbar__actions">
        {(pathname === '/tasks' || pathname === '/') && onNewTask && (
          <button className="btn btn--primary btn--sm" onClick={onNewTask}>
            <Plus size={16} />
            Nueva tarea
          </button>
        )}
        <button
          className="icon-btn"
          onClick={onSearch}
          aria-label="Buscar"
          title="Buscar (Ctrl+K)"
        >
          <Search size={19} />
        </button>
        <button
          className="icon-btn"
          onClick={onSettings}
          aria-label="Apariencia"
          title="Apariencia"
        >
          <Settings size={19} />
        </button>
        <button
          className="icon-btn"
          onClick={onAccount}
          aria-label={isLoggedIn ? 'Cuenta' : 'Iniciar sesión'}
          title={isLoggedIn ? meta.email || 'Cuenta' : 'Iniciar sesión'}
          style={{ position: 'relative' }}
        >
          {isLoggedIn ? (
            <span style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, borderRadius: '50%',
              background: 'var(--accent)', color: '#fff',
              fontSize: '0.75rem', fontWeight: 700,
            }}>
              {(meta.email || 'U')[0].toUpperCase()}
            </span>
          ) : (
            <User size={20} />
          )}
          {/* Sync indicator dot */}
          {isLoggedIn && (
            <span style={{
              position: 'absolute', bottom: 1, right: 1,
              width: 7, height: 7, borderRadius: '50%',
              background: 'var(--success)',
              border: '1.5px solid var(--surface)',
            }} />
          )}
        </button>
      </div>
    </header>
  );
}

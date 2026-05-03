import { useLocation } from 'react-router-dom';
import { Menu, Plus, User, Search } from 'lucide-react';
import { useStore } from '../../store';

const PAGE_TITLES: Record<string, string> = {
  '/':         'Inicio',
  '/tasks':    'Tareas',
  '/calendar': 'Calendario',
  '/courses':  'Cursos',
  '/tags':     'Etiquetas',
  '/stats':    'Estadísticas',
  '/tools':    'Herramientas',
};

interface Props {
  onMenuToggle: () => void;
  onAccount: () => void;
  onSearch: () => void;
  onNewTask?: () => void;
}

export default function TopBar({ onMenuToggle, onAccount, onSearch, onNewTask }: Props) {
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
          <button className="btn btn--primary btn--sm topbar__new-btn" onClick={onNewTask}>
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
          className="icon-btn topbar__account-btn"
          onClick={onAccount}
          aria-label={isLoggedIn ? 'Cuenta' : 'Iniciar sesión'}
          title={isLoggedIn ? meta.email || 'Cuenta' : 'Iniciar sesión'}
        >
          {isLoggedIn ? (
            <span className="topbar__avatar">
              {(meta.email || 'U')[0].toUpperCase()}
              <span className="topbar__sync-dot" />
            </span>
          ) : (
            <User size={20} />
          )}
        </button>
      </div>
    </header>
  );
}

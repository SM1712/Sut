import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, Calendar, BookOpen, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { useStore } from '../../store';

const ITEMS = [
  { to: '/',         icon: LayoutDashboard, label: 'Inicio' },
  { to: '/tasks',    icon: CheckSquare,     label: 'Tareas' },
  { to: '/calendar', icon: Calendar,        label: 'Cal.' },
  { to: '/courses',  icon: BookOpen,        label: 'Cursos' },
  { to: '/stats',    icon: TrendingUp,      label: 'Stats' },
];

export default function MobileNav() {
  const pending = useStore(s => s.tasks.filter(t => !t.done).length);

  return (
    <nav className="mobile-nav" aria-label="Navegación principal">
      <div className="mobile-nav__inner">
        {ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `mobile-nav__item${isActive ? ' is-active' : ''}`}
          >
            {({ isActive }) => (
              <>
                <div className="mobile-nav__icon-wrap">
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className="mobile-nav__pill"
                      transition={{ type: 'spring', damping: 26, stiffness: 380 }}
                    />
                  )}
                  <Icon size={22} className="mobile-nav__icon" />
                  {label === 'Tareas' && pending > 0 && (
                    <span className="mobile-nav__badge">{pending > 9 ? '9+' : pending}</span>
                  )}
                </div>
                <span className="mobile-nav__label">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

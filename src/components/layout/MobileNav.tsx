import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, Calendar, BookOpen, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store';

const ITEMS = [
  { to: '/',         icon: LayoutDashboard, label: 'Inicio' },
  { to: '/tasks',    icon: CheckSquare,     label: 'Tareas' },
  { to: '/calendar', icon: Calendar,        label: 'Agenda' },
  { to: '/courses',  icon: BookOpen,        label: 'Cursos' },
  { to: '/stats',    icon: TrendingUp,      label: 'Stats' },
];

export default function MobileNav() {
  const pending = useStore(s => s.tasks.filter(t => !t.done).length);

  return (
    <nav className="mobile-nav" aria-label="Navegación">
      {ITEMS.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => `mobile-nav__item${isActive ? ' is-active' : ''}`}
        >
          {({ isActive }) => (
            <div className="mobile-nav__slot">
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="nav-bg"
                    className="mobile-nav__bg"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ type: 'spring', damping: 24, stiffness: 400 }}
                  />
                )}
              </AnimatePresence>

              <div className="mobile-nav__icon-wrap">
                <Icon size={21} strokeWidth={isActive ? 2.2 : 1.8} />
                {label === 'Tareas' && pending > 0 && (
                  <span className="mobile-nav__badge">
                    {pending > 9 ? '9+' : pending}
                  </span>
                )}
              </div>

              <motion.span
                className="mobile-nav__label"
                animate={{
                  fontSize: isActive ? '0.625rem' : '0.5625rem',
                  fontWeight: isActive ? 700 : 500,
                  opacity: isActive ? 1 : 0.55,
                }}
                transition={{ duration: 0.18 }}
              >
                {label}
              </motion.span>
            </div>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Timer, FileOutput } from 'lucide-react';

const TOOLS = [
  {
    id: 'pomodoro',
    icon: Timer,
    name: 'Pomodoro',
    desc: 'Trabaja en bloques de concentración y descansa estratégicamente.',
    path: '/tools/pomodoro',
    color: 'var(--accent)',
    bg: 'var(--accent-soft)',
    tag: 'Productividad',
  },
  {
    id: 'pdf-converter',
    icon: FileOutput,
    name: 'Conversor a PDF',
    desc: 'Convierte imágenes y texto a PDF de forma rápida y sin subir nada a servidores.',
    path: '/tools/pdf',
    color: '#ef4444',
    bg: 'hsl(0 91% 60% / 0.10)',
    tag: 'Archivos',
  },
] as const;

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const cardAnim  = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.24 } } };

export default function ToolsView() {
  const navigate = useNavigate();

  return (
    <div className="page-content">
      <motion.div
        className="tools-header"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        <h1 className="tools-title">Herramientas</h1>
        <p className="tools-sub">Utilidades para tu productividad</p>
      </motion.div>

      <motion.div
        className="tool-hub-grid"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {TOOLS.map(({ id, icon: Icon, name, desc, path, color, bg, tag }) => (
          <motion.button
            key={id}
            className="tool-hub-card"
            variants={cardAnim}
            onClick={() => navigate(path)}
            style={{ '--tc': color, '--tb': bg } as React.CSSProperties}
          >
            <div className="tool-hub-card__icon">
              <Icon size={28} />
            </div>
            <div className="tool-hub-card__tag">{tag}</div>
            <div className="tool-hub-card__name">{name}</div>
            <p className="tool-hub-card__desc">{desc}</p>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}

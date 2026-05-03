import { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

interface Props {
  visible: boolean;
  taskTitle?: string;
  onDone: () => void;
}

const COLORS = ['#FF6B6B', '#FFE66D', '#4ECDC4', '#45B7D1', '#96CEB4', '#FF9F43', '#A29BFE', '#FD79A8', '#55EFC4', '#FDCB6E'];
const MESSAGES = ['¡Excelente trabajo!', '¡Increíble!', '¡Lo lograste!', '¡Fantástico!', '¡Así se hace!', '¡Eres imparable!'];

export default function TaskCelebration({ visible, taskTitle, onDone }: Props) {
  const message = useMemo(() => MESSAGES[Math.floor(Math.random() * MESSAGES.length)], [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [visible, onDone]);

  const particles = useMemo(() =>
    Array.from({ length: 80 }, (_, i) => ({
      id: i,
      color: COLORS[i % COLORS.length],
      left: Math.random() * 100,
      delay: Math.random() * 0.7,
      size: 5 + Math.random() * 9,
      rotate: Math.random() * 360,
      xDrift: (Math.random() - 0.5) * 260,
      duration: 1.4 + Math.random() * 1.2,
      shape: i % 3,
    })), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="celebration-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          onClick={onDone}
        >
          {/* Confetti particles */}
          {particles.map(p => (
            <motion.div
              key={p.id}
              style={{
                position: 'fixed',
                left: `${p.left}%`,
                top: -20,
                width: p.shape === 0 ? p.size : p.size * 0.75,
                height: p.shape === 0 ? p.size : p.size * 1.3,
                background: p.color,
                borderRadius: p.shape === 0 ? '50%' : p.shape === 1 ? '2px' : '1px',
                pointerEvents: 'none',
                zIndex: 10001,
              }}
              initial={{ y: 0, x: 0, rotate: p.rotate, opacity: 1 }}
              animate={{
                y: '105vh',
                x: p.xDrift,
                rotate: p.rotate + 540 + Math.random() * 360,
                opacity: [1, 1, 0.9, 0],
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                ease: [0.15, 0.8, 0.3, 1],
              }}
            />
          ))}

          {/* Center panel */}
          <motion.div
            className="celebration-card"
            initial={{ scale: 0.5, y: 50, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 16, stiffness: 220, delay: 0.05 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Ring burst */}
            <motion.div
              className="celebration-ring"
              initial={{ scale: 0.3, opacity: 0.8 }}
              animate={{ scale: 2.2, opacity: 0 }}
              transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
            />

            <motion.div
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 12, stiffness: 260, delay: 0.12 }}
              className="celebration-check"
            >
              <CheckCircle2 size={68} strokeWidth={1.5} />
            </motion.div>

            <motion.p
              className="celebration-msg"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32, duration: 0.3 }}
            >
              {message}
            </motion.p>

            {taskTitle && (
              <motion.p
                className="celebration-task"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
              >
                &ldquo;{taskTitle}&rdquo;
              </motion.p>
            )}

            <motion.p
              className="celebration-sub"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55 }}
            >
              Tarea completada · Toca para cerrar
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  footerLeft?: ReactNode;
}

export default function Modal({ open, onClose, title, children, footer, wide, footerLeft }: Props) {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.classList.remove('modal-open');
    };
  }, [open, onClose]);

  const mobileVariants = {
    hidden: { y: '100%', opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', damping: 28, stiffness: 340 } },
    exit: { y: '100%', opacity: 0, transition: { duration: 0.22 } },
  };

  const desktopVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { type: 'spring', damping: 30, stiffness: 380 } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.18 } },
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            className={`modal${wide ? ' modal--wide' : ''}`}
            variants={isMobile ? mobileVariants : desktopVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            {isMobile && <div className="bottom-sheet__handle" />}
            <div className="modal__header">
              <h2 className="modal__title">{title}</h2>
              <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <div className="modal__body">{children}</div>
            {(footer || footerLeft) && (
              <div className={`modal__footer${footerLeft ? ' modal__footer--split' : ''}`}>
                {footerLeft && <div>{footerLeft}</div>}
                {footer && <div style={{ display: 'flex', gap: 8 }}>{footer}</div>}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

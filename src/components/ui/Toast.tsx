import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import type { ToastType } from '../../types';
import { uid } from '../../lib/utils';

interface ToastItem { id: string; message: string; type: ToastType; }

interface ToastCtx { toast: (msg: string, opts?: { type?: ToastType; duration?: number }) => void; }

const Ctx = createContext<ToastCtx>({ toast: () => {} });

const ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  danger: AlertCircle,
  warn: AlertTriangle,
  info: Info,
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, opts: { type?: ToastType; duration?: number } = {}) => {
    const id = uid('toast');
    const item: ToastItem = { id, message, type: opts.type || 'info' };
    setToasts(prev => [...prev, item]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), opts.duration || 3200);
  }, []);

  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="toast-container">
        <AnimatePresence>
          {toasts.map(t => {
            const Icon = ICONS[t.type];
            return (
              <motion.div
                key={t.id}
                className={`toast ${t.type}`}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <Icon className="toast__icon" size={18} />
                <span style={{ flex: 1 }}>{t.message}</span>
                <button className="icon-btn" onClick={() => dismiss(t.id)} style={{ marginRight: -4 }}>
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
};

export const useToast = () => useContext(Ctx);

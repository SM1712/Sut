import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, LogOut, User, Users, Wifi, WifiOff, X, RefreshCw } from 'lucide-react';
import { useStore } from '../../store';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../ui/Confirm';
import { loginWithGoogle, logoutFirebase } from '../../store/sync';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface Props { open: boolean; onClose: () => void; }

export default function AccountPanel({ open, onClose }: Props) {
  const meta       = useStore(s => s.meta);
  const clearAuth  = useStore(s => s.clearAuth);
  const { toast }  = useToast();
  const { confirm } = useConfirm();
  const isMobile   = useIsMobile();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
      // On desktop a popup resolves immediately; on mobile redirect happens
    } catch {
      toast('Error al iniciar sesión con Google', { type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const ok = await confirm({
      title: '¿Cerrar sesión?',
      text: 'Tus tareas y espacio se conservan. Puedes volver a iniciar sesión cuando quieras.',
      confirmText: 'Cerrar sesión',
    });
    if (!ok) return;
    await logoutFirebase();
    clearAuth(); // solo borra uid/email — el espacio y los datos quedan intactos
    toast('Sesión cerrada', { type: 'info' });
    onClose();
  };

  const panel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>

      {meta.uid ? (
        /* ── Logged in ─────────────────────────────────── */
        <>
          {/* Avatar + info */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--sp-4)',
            padding: 'var(--sp-4)',
            background: 'var(--accent-soft)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--accent)',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'var(--accent)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.25rem', fontWeight: 700, flexShrink: 0,
            }}>
              {(meta.email || 'U')[0].toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--accent)' }}>
                {meta.email?.split('@')[0] || 'Usuario'}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {meta.email}
              </div>
            </div>
          </div>

          {/* Sync status */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
            padding: 'var(--sp-3) var(--sp-4)',
            background: 'var(--success-soft)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--success)',
          }}>
            <Wifi size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--success)' }}>Sincronización activa</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-mute)' }}>
                Tus datos se guardan en la nube automáticamente.
              </div>
            </div>
          </div>

          {/* Active space */}
          {meta.spaceId && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
              padding: 'var(--sp-3) var(--sp-4)',
              background: 'var(--surface-2)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
            }}>
              <Users size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  {meta.spaceName || 'Espacio compartido'}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
                  {meta.spaceId}
                </div>
              </div>
            </div>
          )}

          <button className="btn btn--danger" onClick={handleLogout} style={{ alignSelf: 'flex-start' }}>
            <LogOut size={16} /> Cerrar sesión
          </button>
        </>
      ) : (
        /* ── Not logged in ─────────────────────────────── */
        <>
          {/* Offline notice */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)',
            padding: 'var(--sp-4)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}>
            <WifiOff size={18} style={{ color: 'var(--text-mute)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>Modo sin conexión</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-mute)', lineHeight: 1.5 }}>
                Tus tareas y cursos se guardan solo en este dispositivo.
                Inicia sesión para sincronizar en la nube y colaborar con otros.
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {[
              'Sincroniza entre dispositivos',
              'Accede desde el celular y la computadora',
              'Colabora en espacios compartidos',
              'Recupera tus datos si cambias de dispositivo',
            ].map(b => (
              <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontSize: '0.875rem', color: 'var(--text-soft)' }}>
                <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓</span> {b}
              </div>
            ))}
          </div>

          <button
            className="btn btn--primary"
            onClick={handleLogin}
            disabled={loading}
            style={{ alignSelf: 'stretch', justifyContent: 'center', gap: 10 }}
          >
            {loading
              ? <><RefreshCw size={16} className="anim-spin" /> Iniciando...</>
              : <>
                  {/* Google G icon */}
                  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                    <path fill="#fff" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18"/>
                    <path fill="#fff" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.76-2.7.76-2.07 0-3.83-1.4-4.46-3.29H1.86v2.07A8 8 0 0 0 8.98 17"/>
                    <path fill="#fff" d="M4.52 10.52A4.8 4.8 0 0 1 4.27 9c0-.53.09-1.04.25-1.52V5.41H1.86A8 8 0 0 0 1 9c0 1.3.31 2.52.86 3.59z"/>
                    <path fill="#fff" d="M8.98 3.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.86 5.4L4.52 7.48C5.15 5.59 6.9 3.18 8.98 3.18"/>
                  </svg>
                  <LogIn size={16} /> Iniciar sesión con Google
                </>
            }
          </button>

          <p style={{ fontSize: '0.75rem', color: 'var(--text-faint)', textAlign: 'center', lineHeight: 1.5 }}>
            Al iniciar sesión aceptas que tus datos de tareas se almacenen en Firebase (Google).
          </p>
        </>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, background: 'var(--backdrop)', zIndex: 'calc(var(--z-modal) - 1)' }}
              onClick={onClose}
            />
            <motion.div
              className="bottom-sheet"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            >
              <div className="bottom-sheet__handle" />
              <div className="bottom-sheet__header">
                <span className="bottom-sheet__title">
                  <User size={16} style={{ display: 'inline', marginRight: 6 }} />
                  Cuenta
                </span>
                <button className="icon-btn" onClick={onClose}><X size={18} /></button>
              </div>
              <div className="bottom-sheet__body">{panel}</div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  // Desktop: slide-in panel from top-right
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 'calc(var(--z-modal) - 1)' }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ type: 'spring', damping: 28, stiffness: 360 }}
            style={{
              position: 'fixed', top: 56, right: 16,
              width: 340, maxHeight: 'calc(100vh - 80px)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 'var(--z-modal)',
              overflow: 'auto',
              padding: 'var(--sp-5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
              <span style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <User size={16} /> Cuenta
              </span>
              <button className="icon-btn" onClick={onClose}><X size={16} /></button>
            </div>
            {panel}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

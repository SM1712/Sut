import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X, Sun, Moon, Monitor, Palette,
  Bell, BellOff, Check,
  User, LogIn, LogOut, Wifi,
  Database, Download, Upload, Trash2,
  Settings,
} from 'lucide-react';
import { useStore } from '../../store';
import ColorPicker from '../ui/ColorPicker';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../ui/Confirm';
import { useIsSmall } from '../../hooks/useMediaQuery';
import { loginWithGoogle, logoutFirebase } from '../../store/sync';
import { ACCENT_COLORS, FONT_OPTIONS } from '../../lib/constants';
import type { Theme } from '../../types';

interface Props { open: boolean; onClose: () => void; }

type Section = 'appearance' | 'notifications' | 'account' | 'data';

const SECTIONS: { id: Section; label: string; icon: typeof Palette }[] = [
  { id: 'appearance',    label: 'Apariencia',     icon: Palette },
  { id: 'notifications', label: 'Notificaciones',  icon: Bell },
  { id: 'account',       label: 'Cuenta',          icon: User },
  { id: 'data',          label: 'Datos',            icon: Database },
];

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light',  label: 'Claro',   icon: Sun },
  { value: 'dark',   label: 'Oscuro',  icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

/* ── Section heading ──────────────────────────────────── */
function SectionHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="cfg-heading">
      <h3 className="cfg-heading__title">{title}</h3>
      {sub && <p className="cfg-heading__sub">{sub}</p>}
    </div>
  );
}

/* ── Row wrapper ──────────────────────────────────────── */
function CfgRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="cfg-row">
      <div className="cfg-row__label">
        <span className="cfg-row__name">{label}</span>
        {sub && <span className="cfg-row__sub">{sub}</span>}
      </div>
      <div className="cfg-row__control">{children}</div>
    </div>
  );
}

export default function SettingsDrawer({ open, onClose }: Props) {
  const settings   = useStore(s => s.settings);
  const setSetting = useStore(s => s.setSetting);
  const meta       = useStore(s => s.meta);
  const exportData = useStore(s => s.exportData);
  const importData = useStore(s => s.importData);
  const reset      = useStore(s => s.reset);
  const { toast }  = useToast();
  const { confirm }= useConfirm();
  const isSmall    = useIsSmall();

  const [section, setSection] = useState<Section>('appearance');
  const [notifStatus, setNotifStatus] = useState<NotificationPermission | 'unsupported'>(
    'Notification' in window ? Notification.permission : 'unsupported'
  );

  /* ── Auth ── */
  const handleLogin = async () => {
    try { await loginWithGoogle(); toast('Sesión iniciada ✓', { type: 'success' }); }
    catch { toast('Error al iniciar sesión', { type: 'danger' }); }
  };
  const handleLogout = async () => {
    await logoutFirebase();
    useStore.getState().clearAuth();
    toast('Sesión cerrada', { type: 'info' });
  };

  /* ── Data ── */
  const handleExport = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url,
      download: `sut-backup-${new Date().toISOString().slice(0, 10)}.json`,
    });
    a.click();
    URL.revokeObjectURL(url);
    toast('Backup descargado', { type: 'success' });
  };

  const handleImport = () => {
    const input = Object.assign(document.createElement('input'), {
      type: 'file', accept: '.json,application/json',
    });
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try { importData(await file.text()); toast('Datos restaurados ✓', { type: 'success' }); }
      catch { toast('Archivo inválido', { type: 'danger' }); }
    };
    input.click();
  };

  const handleReset = async () => {
    const ok = await confirm({
      title: '¿Eliminar todos los datos?',
      text: 'Tareas, cursos, etiquetas y eventos. No se puede deshacer.',
      confirmText: 'Eliminar todo',
    });
    if (!ok) return;
    reset(); toast('Datos eliminados', { type: 'warn' }); onClose();
  };

  /* ── Notifications ── */
  const requestNotif = async () => {
    const r = await Notification.requestPermission();
    setNotifStatus(r);
    if (r === 'granted') {
      new Notification('SUT', { body: 'Notificaciones activas.', icon: '/assets/icon.svg' });
      toast('Notificaciones activadas ✓', { type: 'success' });
    } else toast('Bloqueadas en el navegador', { type: 'warn' });
  };

  /* ── Animations ── */
  const variants = isSmall
    ? { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }
    : { initial: { opacity: 0, scale: 0.97, y: 12 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.97, y: 12 } };

  /* ── Section content ── */
  const renderContent = () => {
    switch (section) {

      /* ── APARIENCIA ────────────────────────────────── */
      case 'appearance': return (
        <>
          <SectionHeading title="Tema" sub="Selecciona cómo se ve la interfaz." />
          <div className="theme-selector">
            {THEMES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                className={`theme-card${settings.theme === value ? ' is-active' : ''}`}
                onClick={() => setSetting('theme', value)}
              >
                <Icon size={20} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="cfg-divider" />

          <SectionHeading title="Color de acento" sub="Personaliza el color principal de la interfaz." />
          <ColorPicker
            colors={ACCENT_COLORS}
            value={settings.accentColor}
            onChange={c => { setSetting('accentColor', c); setSetting('buttonColor', c); }}
          />

          <div className="cfg-divider" />

          <SectionHeading title="Tipografía" />
          <div className="font-grid">
            {FONT_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                className={`font-card${settings.fontFamily === value ? ' is-active' : ''}`}
                onClick={() => setSetting('fontFamily', value)}
                style={{ fontFamily: value === 'system-ui' ? 'system-ui' : `'${value}', system-ui` }}
              >
                <span className="font-card__sample">Aa</span>
                <span className="font-card__name">{label}</span>
              </button>
            ))}
          </div>

          <div className="cfg-divider" />

          <SectionHeading title="Ajustes visuales" />
          <div className="cfg-sliders">
            <CfgRow
              label="Tamaño de texto"
              sub="Afecta a toda la interfaz"
            >
              <div className="slider-group">
                <input type="range" className="scale-slider"
                  min={0.85} max={1.3} step={0.05}
                  value={settings.fontScale}
                  onChange={e => setSetting('fontScale', Number(e.target.value))} />
                <span className="slider-badge">{Math.round(settings.fontScale * 100)}%</span>
              </div>
            </CfgRow>

            <CfgRow
              label="Radio de bordes"
              sub="De cuadrado a redondeado"
            >
              <div className="slider-group">
                <input type="range" className="scale-slider"
                  min={4} max={24} step={2}
                  value={settings.radius}
                  onChange={e => setSetting('radius', Number(e.target.value))} />
                <span className="slider-badge">{settings.radius}px</span>
              </div>
            </CfgRow>
          </div>

          <div className="cfg-divider" />

          <SectionHeading title="Vista previa" />
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontWeight: 600 }}>Cálculo II — Parcial</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <span className="course-pill" style={{ '--c': 'var(--accent)' } as React.CSSProperties}>Cálculo II</span>
              <span className="prio-badge high">Alta</span>
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-mute)' }}>Mañana · 14:00</div>
            <button className="btn btn--primary btn--sm" style={{ alignSelf: 'flex-start', marginTop: 4 }}>
              + Nueva tarea
            </button>
          </div>
        </>
      );

      /* ── NOTIFICACIONES ────────────────────────────── */
      case 'notifications': return (
        <>
          <SectionHeading
            title="Recordatorios"
            sub="Recibe avisos antes de que venza una tarea."
          />

          <div className={`notif-card notif-card--${notifStatus === 'granted' ? 'ok' : notifStatus === 'denied' ? 'err' : 'idle'}`}>
            <div className="notif-card__icon">
              {notifStatus === 'granted' ? <Bell size={18} /> : notifStatus === 'denied' ? <BellOff size={18} /> : <Bell size={18} />}
            </div>
            <div className="notif-card__body">
              <strong>
                {notifStatus === 'granted' ? 'Activas' : notifStatus === 'denied' ? 'Bloqueadas' : notifStatus === 'unsupported' ? 'No disponible' : 'Desactivadas'}
              </strong>
              <span>
                {notifStatus === 'granted' ? 'Recibirás avisos puntualmente.'
                  : notifStatus === 'denied' ? 'Ve a Ajustes del sitio → Permisos → Permitir.'
                  : notifStatus === 'unsupported' ? 'Tu navegador no lo soporta.'
                  : 'Actívalas para no perderte nada.'}
              </span>
            </div>
            {notifStatus === 'granted' && <Check size={16} className="notif-card__check" />}
          </div>

          {notifStatus === 'default' && (
            <button className="btn btn--primary btn--sm" style={{ alignSelf: 'flex-start' }} onClick={requestNotif}>
              <Bell size={15} /> Activar notificaciones
            </button>
          )}

          <div className="cfg-divider" />

          <SectionHeading title="Cómo funcionan" />
          <ol className="cfg-steps">
            {['Activa los permisos arriba.',
              'Al crear una tarea, elige cuánto antes quieres el aviso: 15 min, 30 min, 1 h o 1 día.',
              'SUT enviará la notificación automáticamente.',
            ].map((s, i) => (
              <li key={i} className="cfg-step">
                <span className="cfg-step__num">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </>
      );

      /* ── CUENTA ────────────────────────────────────── */
      case 'account': return (
        <>
          {meta.uid ? (
            <>
              <SectionHeading title="Sesión activa" />
              <div className="account-card">
                <div className="account-card__avatar">
                  {(meta.email || 'U')[0].toUpperCase()}
                </div>
                <div className="account-card__info">
                  <strong className="account-card__name">{meta.email?.split('@')[0]}</strong>
                  <span className="account-card__email">{meta.email}</span>
                </div>
                <div className="account-card__badge">
                  <Wifi size={12} />
                  <span>Sync activo</span>
                </div>
              </div>

              {meta.spaceId && (
                <>
                  <div className="cfg-divider" />
                  <SectionHeading title="Espacio compartido" />
                  <div className="space-badge">
                    <span className="space-badge__dot" />
                    <span style={{ flex: 1 }}>{meta.spaceName || 'Espacio'}</span>
                    <code className="space-badge__code">{meta.spaceId}</code>
                  </div>
                </>
              )}

              <div className="cfg-divider" />
              <button className="btn btn--secondary btn--sm" style={{ alignSelf: 'flex-start' }} onClick={handleLogout}>
                <LogOut size={15} /> Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <SectionHeading
                title="Sin cuenta"
                sub="Inicia sesión con Google para sincronizar tus datos entre dispositivos."
              />
              <ul className="cfg-benefits">
                {['Sync en tiempo real entre dispositivos', 'Tus datos seguros en la nube', 'Colabora en espacios compartidos'].map(b => (
                  <li key={b} className="cfg-benefit">
                    <Check size={14} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <button className="btn btn--primary btn--sm" style={{ alignSelf: 'flex-start' }} onClick={handleLogin}>
                <LogIn size={15} /> Iniciar sesión con Google
              </button>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-faint)', lineHeight: 1.5, marginTop: 4 }}>
                Tus datos actuales se conservan en este dispositivo.
              </p>
            </>
          )}
        </>
      );

      /* ── DATOS ─────────────────────────────────────── */
      case 'data': return (
        <>
          <SectionHeading
            title="Exportar"
            sub="Descarga una copia de todos tus datos en formato JSON."
          />
          <button className="btn btn--secondary btn--sm" style={{ alignSelf: 'flex-start' }} onClick={handleExport}>
            <Download size={15} /> Descargar backup
          </button>

          <div className="cfg-divider" />

          <SectionHeading
            title="Importar"
            sub="Restaura un backup previo de SUT. Reemplaza los datos actuales."
          />
          <button className="btn btn--secondary btn--sm" style={{ alignSelf: 'flex-start' }} onClick={handleImport}>
            <Upload size={15} /> Cargar backup
          </button>

          <div className="cfg-divider cfg-divider--danger" />

          <SectionHeading
            title="Zona de peligro"
            sub="Esta acción es irreversible. Todos tus datos locales serán eliminados permanentemente."
          />
          <button className="btn btn--danger btn--sm" style={{ alignSelf: 'flex-start' }} onClick={handleReset}>
            <Trash2 size={15} /> Eliminar todos los datos
          </button>

          <p style={{ fontSize: '0.75rem', color: 'var(--text-faint)', lineHeight: 1.5, marginTop: 4 }}>
            SUT v2.0 · Hecho para estudiantes
          </p>
        </>
      );
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`settings-overlay${isSmall ? ' is-sheet' : ''}`}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
        >
          <motion.aside
            className={`settings-popup${isSmall ? ' is-sheet' : ''}`}
            variants={variants}
            initial="initial" animate="animate" exit="exit"
            transition={{ type: 'spring', damping: 30, stiffness: 370 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Mobile grab handle */}
            {isSmall && (
              <div className="settings-popup__handle-row">
                <span className="settings-popup__handle" />
              </div>
            )}

            {/* Header */}
            <div className="settings-popup__header">
              <span className="settings-popup__title">
                <Settings size={15} />
                Configuración
              </span>
              <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
            </div>

            {/* Body: two-panel on desktop, tabs on mobile */}
            <div className="settings-layout">
              {/* Side nav (desktop) / Horizontal tabs (mobile) */}
              {isSmall ? (
                <div className="settings-tabs">
                  {SECTIONS.map(({ id, label, icon: Icon }) => (
                    <button key={id}
                      className={`settings-tab${section === id ? ' is-active' : ''}`}
                      onClick={() => setSection(id)}>
                      <Icon size={13} /><span>{label}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <nav className="settings-sidenav">
                  {SECTIONS.map(({ id, label, icon: Icon }) => (
                    <button key={id}
                      className={`settings-sidenav-item${section === id ? ' is-active' : ''}`}
                      onClick={() => setSection(id)}>
                      <Icon size={16} />
                      <span>{label}</span>
                    </button>
                  ))}
                </nav>
              )}

              {/* Content */}
              <div className="settings-content">
                {renderContent()}
              </div>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

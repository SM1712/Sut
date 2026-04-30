import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X, Sun, Moon, Monitor, Palette,
  Download, Upload, Trash2, Bell, BellOff, Check,
} from 'lucide-react';
import { useStore } from '../../store';
import ColorPicker from '../ui/ColorPicker';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../ui/Confirm';
import { ACCENT_COLORS, FONT_OPTIONS } from '../../lib/constants';
import type { Theme } from '../../types';

interface Props { open: boolean; onClose: () => void; }

const THEMES: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: 'light',  label: 'Claro',   Icon: Sun },
  { value: 'dark',   label: 'Oscuro',  Icon: Moon },
  { value: 'system', label: 'Sistema', Icon: Monitor },
];

type Section = 'appearance' | 'data' | 'notifications';

export default function SettingsDrawer({ open, onClose }: Props) {
  const settings    = useStore(s => s.settings);
  const setSetting  = useStore(s => s.setSetting);
  const exportData  = useStore(s => s.exportData);
  const importData  = useStore(s => s.importData);
  const reset       = useStore(s => s.reset);
  const { toast }   = useToast();
  const { confirm } = useConfirm();

  const [section, setSection] = useState<Section>('appearance');
  const [notifStatus, setNotifStatus] = useState<NotificationPermission | 'unsupported'>(
    'Notification' in window ? Notification.permission : 'unsupported'
  );

  /* ── Data management ── */
  const handleExport = () => {
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `sut-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Datos exportados correctamente', { type: 'success' });
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        importData(text);
        toast('Datos importados correctamente ✓', { type: 'success' });
      } catch {
        toast('Archivo inválido — usa un backup de SUT', { type: 'danger' });
      }
    };
    input.click();
  };

  const handleReset = async () => {
    const ok = await confirm({
      title: '¿Eliminar todos los datos?',
      text: 'Se borrarán todas las tareas, cursos, etiquetas y eventos. Esta acción no se puede deshacer.',
      confirmText: 'Eliminar todo',
    });
    if (!ok) return;
    reset();
    toast('Datos eliminados', { type: 'warn' });
    onClose();
  };

  /* ── Notifications ── */
  const requestNotifications = async () => {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setNotifStatus(result);
    if (result === 'granted') {
      toast('Notificaciones activadas ✓', { type: 'success' });
      // Send a test notification
      new Notification('SUT — Notificaciones activas', {
        body: 'Recibirás recordatorios de tus tareas.',
        icon: '/assets/icon.svg',
      });
    } else {
      toast('Notificaciones bloqueadas en el navegador', { type: 'warn' });
    }
  };

  const SECTIONS: { id: Section; label: string }[] = [
    { id: 'appearance',    label: '🎨 Apariencia' },
    { id: 'notifications', label: '🔔 Avisos' },
    { id: 'data',          label: '💾 Datos' },
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'var(--backdrop)', zIndex: 'calc(var(--z-drawer) - 1)' }}
            onClick={onClose}
          />
          <motion.aside
            className="settings-drawer"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 340 }}
          >
            <div className="settings-drawer__header">
              <span className="settings-drawer__title">
                <Palette size={16} style={{ display: 'inline', marginRight: 6 }} />
                Ajustes
              </span>
              <button className="icon-btn" onClick={onClose}><X size={18} /></button>
            </div>

            {/* Section tabs */}
            <div style={{
              display: 'flex', gap: 3,
              background: 'var(--bg-soft)', padding: 3,
              borderRadius: 'var(--radius-sm)',
              margin: '0 var(--sp-4) var(--sp-2)',
            }}>
              {SECTIONS.map(s => (
                <button
                  key={s.id}
                  className={`cal-view-tab${section === s.id ? ' is-active' : ''}`}
                  style={{ flex: 1, fontSize: '0.75rem' }}
                  onClick={() => setSection(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="settings-drawer__body">

              {/* ── APPEARANCE ── */}
              {section === 'appearance' && (
                <>
                  <div className="settings-section">
                    <span className="settings-section__title">Tema</span>
                    <div className="theme-tabs">
                      {THEMES.map(({ value, label, Icon }) => (
                        <button
                          key={value}
                          className={`theme-tab${settings.theme === value ? ' is-active' : ''}`}
                          onClick={() => setSetting('theme', value)}
                        >
                          <Icon size={14} style={{ display: 'inline', marginRight: 4 }} />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="settings-section">
                    <span className="settings-section__title">Color de acento</span>
                    <ColorPicker
                      colors={ACCENT_COLORS}
                      value={settings.accentColor}
                      onChange={c => { setSetting('accentColor', c); setSetting('buttonColor', c); }}
                    />
                  </div>

                  <div className="settings-section">
                    <span className="settings-section__title">Tipografía</span>
                    <div className="font-list">
                      {FONT_OPTIONS.map(({ value, label }) => (
                        <button
                          key={value}
                          className={`font-option${settings.fontFamily === value ? ' is-active' : ''}`}
                          onClick={() => setSetting('fontFamily', value)}
                          style={{ fontFamily: value === 'system-ui' ? 'system-ui' : `'${value}', system-ui` }}
                        >
                          <span className="font-option__name">{label}</span>
                          <span className="font-option__sample">Aa</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="settings-section">
                    <span className="settings-section__title">
                      Tamaño de texto — {Math.round(settings.fontScale * 100)}%
                    </span>
                    <input
                      type="range" className="scale-slider"
                      min={0.85} max={1.3} step={0.05}
                      value={settings.fontScale}
                      onChange={e => setSetting('fontScale', Number(e.target.value))}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                      <span>85%</span><span>100%</span><span>130%</span>
                    </div>
                  </div>

                  <div className="settings-section">
                    <span className="settings-section__title">
                      Radio de bordes — {settings.radius}px
                    </span>
                    <input
                      type="range" className="scale-slider"
                      min={4} max={24} step={2}
                      value={settings.radius}
                      onChange={e => setSetting('radius', Number(e.target.value))}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                      <span>Cuadrado</span><span>Redondeado</span>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="settings-section">
                    <span className="settings-section__title">Vista previa</span>
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Cálculo II — Parcial</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span className="course-pill" style={{ '--c': 'var(--accent)' } as React.CSSProperties}>Cálculo II</span>
                        <span className="prio-badge high">Alta</span>
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-mute)' }}>Mañana · 14:00</div>
                    </div>
                  </div>
                </>
              )}

              {/* ── NOTIFICATIONS ── */}
              {section === 'notifications' && (
                <>
                  <div className="settings-section">
                    <span className="settings-section__title">Recordatorios de tareas</span>
                    <div style={{
                      padding: 'var(--sp-4)',
                      background: 'var(--surface-2)',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                      display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                        {notifStatus === 'granted'
                          ? <Bell size={20} style={{ color: 'var(--success)' }} />
                          : notifStatus === 'denied'
                          ? <BellOff size={20} style={{ color: 'var(--danger)' }} />
                          : <Bell size={20} style={{ color: 'var(--text-mute)' }} />
                        }
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                            {notifStatus === 'granted' ? 'Notificaciones activadas' :
                             notifStatus === 'denied' ? 'Notificaciones bloqueadas' :
                             notifStatus === 'unsupported' ? 'No disponible' :
                             'Notificaciones desactivadas'}
                          </div>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-mute)' }}>
                            {notifStatus === 'granted' ? 'Recibirás avisos antes de cada tarea.' :
                             notifStatus === 'denied' ? 'Permiso bloqueado. Actívalo en la configuración del navegador.' :
                             notifStatus === 'unsupported' ? 'Tu navegador no soporta notificaciones.' :
                             'Actívalas para recibir recordatorios.'}
                          </div>
                        </div>
                      </div>
                      {notifStatus === 'granted' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', color: 'var(--success)', fontSize: '0.875rem' }}>
                          <Check size={14} /> Todo listo. Los recordatorios se enviarán según la configuración de cada tarea.
                        </div>
                      )}
                      {(notifStatus === 'default') && (
                        <button className="btn btn--primary btn--sm" onClick={requestNotifications}>
                          <Bell size={15} /> Activar notificaciones
                        </button>
                      )}
                      {notifStatus === 'denied' && (
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-mute)', lineHeight: 1.5 }}>
                          Para activarlas: abre la configuración del sitio en tu navegador → Permisos → Notificaciones → Permitir.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="settings-section">
                    <span className="settings-section__title">Cómo funciona</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                      {[
                        { step: '1', text: 'Activa las notificaciones arriba.' },
                        { step: '2', text: 'Al crear o editar una tarea, selecciona un recordatorio (15 min, 30 min, 1 hora o 1 día antes).' },
                        { step: '3', text: 'SUT te avisará automáticamente cuando se acerque la fecha.' },
                      ].map(({ step, text }) => (
                        <div key={step} style={{ display: 'flex', gap: 'var(--sp-3)', fontSize: '0.875rem', color: 'var(--text-soft)' }}>
                          <span style={{
                            width: 22, height: 22, borderRadius: '50%',
                            background: 'var(--accent)', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                          }}>{step}</span>
                          <span style={{ lineHeight: 1.5 }}>{text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ── DATA ── */}
              {section === 'data' && (
                <>
                  <div className="settings-section">
                    <span className="settings-section__title">Exportar datos</span>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-mute)', marginBottom: 'var(--sp-3)', lineHeight: 1.5 }}>
                      Descarga un archivo JSON con todas tus tareas, cursos, etiquetas y eventos. Úsalo como respaldo o para migrar a otro dispositivo.
                    </p>
                    <button className="btn btn--secondary btn--sm" onClick={handleExport}>
                      <Download size={15} /> Exportar backup
                    </button>
                  </div>

                  <div className="settings-section">
                    <span className="settings-section__title">Importar datos</span>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-mute)', marginBottom: 'var(--sp-3)', lineHeight: 1.5 }}>
                      Restaura un backup previo de SUT. Los datos actuales serán reemplazados.
                    </p>
                    <button className="btn btn--secondary btn--sm" onClick={handleImport}>
                      <Upload size={15} /> Importar backup
                    </button>
                  </div>

                  <div className="settings-section" style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-4)' }}>
                    <span className="settings-section__title" style={{ color: 'var(--danger)' }}>Zona de peligro</span>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-mute)', marginBottom: 'var(--sp-3)', lineHeight: 1.5 }}>
                      Elimina permanentemente todos tus datos locales. Esta acción no se puede deshacer.
                    </p>
                    <button className="btn btn--danger btn--sm" onClick={handleReset}>
                      <Trash2 size={15} /> Eliminar todos los datos
                    </button>
                  </div>

                  <div className="settings-section">
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', lineHeight: 1.6, textAlign: 'center' }}>
                      SUT v2.0 · Hecho con ❤️ para estudiantes
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

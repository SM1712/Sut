import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, RotateCcw, SkipForward,
  Volume2, VolumeX, ChevronLeft, Settings2,
  Coffee, Brain, Zap, Clock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type Mode = 'pomodoro' | 'short' | 'long';

const MODE_LABELS: Record<Mode, string> = { pomodoro: 'Pomodoro', short: 'Descanso corto', long: 'Descanso largo' };
const MODE_COLORS: Record<Mode, string> = { pomodoro: 'var(--accent)', short: 'var(--success)', long: 'var(--warn)' };
const DEFAULT_DURATIONS = { pomodoro: 25, short: 5, long: 15 };
const SESSIONS_PER_CYCLE = 4;
const CIRCUMFERENCE = 2 * Math.PI * 54;

function playBeep(freq = 880, dur = 0.5) {
  try {
    const ctx  = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine'; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch (_) {}
}

export default function PomodoroView() {
  const navigate = useNavigate();

  const [durations, setDurations]       = useState(DEFAULT_DURATIONS);
  const [mode, setMode]                 = useState<Mode>('pomodoro');
  const [timeLeft, setTimeLeft]         = useState(DEFAULT_DURATIONS.pomodoro * 60);
  const [running, setRunning]           = useState(false);
  const [sessionsDone, setSessionsDone] = useState(0);
  const [totalWorkSecs, setTotalWorkSecs] = useState(0);
  const [soundOn, setSoundOn]           = useState(true);
  const [autoAdvance, setAutoAdvance]   = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const justFinished = useRef(false);

  const totalSeconds = durations[mode] * 60;
  const progress     = totalSeconds > 0 ? 1 - timeLeft / totalSeconds : 1;
  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss = String(timeLeft % 60).padStart(2, '0');
  const sessionIndex = sessionsDone % SESSIONS_PER_CYCLE;
  const cyclesDone   = Math.floor(sessionsDone / SESSIONS_PER_CYCLE);
  const totalWorkMin = Math.floor(totalWorkSecs / 60);
  const color        = MODE_COLORS[mode];

  const switchMode = useCallback((m: Mode, dur = durations) => {
    setRunning(false); setMode(m); setTimeLeft(dur[m] * 60); justFinished.current = false;
  }, [durations]);

  const advance = useCallback(() => {
    if (mode === 'pomodoro') {
      const next = sessionsDone + 1;
      setSessionsDone(next);
      switchMode(next % SESSIONS_PER_CYCLE === 0 ? 'long' : 'short');
    } else { switchMode('pomodoro'); }
  }, [mode, sessionsDone, switchMode]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(intervalRef.current!);
            setRunning(false);
            justFinished.current = true;
            return 0;
          }
          if (mode === 'pomodoro') setTotalWorkSecs(s => s + 1);
          return t - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, mode]);

  useEffect(() => {
    if (timeLeft === 0 && justFinished.current) {
      justFinished.current = false;
      if (soundOn) playBeep();
      if (autoAdvance) { const t = setTimeout(advance, 1500); return () => clearTimeout(t); }
    }
  }, [timeLeft, soundOn, autoAdvance, advance]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault(); setRunning(r => !r);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const reset = () => { setRunning(false); setTimeLeft(durations[mode] * 60); };

  const applyDurations = (nd: typeof durations) => {
    setDurations(nd); setRunning(false); setTimeLeft(nd[mode] * 60);
  };

  const TIPS = [
    { icon: Brain,  title: 'Concentración profunda', body: 'Durante cada Pomodoro evita interrupciones. Cierra notificaciones y enfócate en una sola tarea.' },
    { icon: Coffee, title: 'Descansa de verdad',      body: 'En el descanso, aléjate de la pantalla. Estira, respira o toma agua para recuperar energía.' },
    { icon: Zap,    title: 'Ciclos de 4 sesiones',    body: 'Después de 4 Pomodoros tómate un descanso largo de 15-30 minutos para recargar energías.' },
  ];

  return (
    <div className="page-content pomo-page-wrap">
      <button className="pomo-back" onClick={() => navigate('/tools')}>
        <ChevronLeft size={15} /> Herramientas
      </button>

      <div className="pomo-layout">
        {/* ── Left: timer card ── */}
        <motion.div
          className="pomo-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26 }}
        >
          <div className="pomo-mode-bar">
            {(['pomodoro', 'short', 'long'] as Mode[]).map(m => (
              <button
                key={m}
                className={`pomo-mode-btn${mode === m ? ' is-active' : ''}`}
                style={mode === m ? { '--btn-color': MODE_COLORS[m] } as React.CSSProperties : undefined}
                onClick={() => switchMode(m)}
              >{MODE_LABELS[m]}</button>
            ))}
          </div>

          <div className="pomo-ring-wrap">
            <svg className="pomo-ring" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" className="pomo-ring__bg" />
              <circle
                cx="60" cy="60" r="54" className="pomo-ring__fg"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
                style={{ stroke: color, filter: `drop-shadow(0 0 8px ${color}55)` }}
              />
            </svg>
            <div className="pomo-display">
              <AnimatePresence mode="wait">
                <motion.span
                  key={`${mode}-${mm}`}
                  className="pomo-time"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{    opacity: 0, scale: 1.06 }}
                  transition={{ duration: 0.14 }}
                >{mm}:{ss}</motion.span>
              </AnimatePresence>
              <span className="pomo-mode-lbl" style={{ color }}>{MODE_LABELS[mode]}</span>
            </div>
          </div>

          <div className="pomo-track">
            <div className="pomo-dots">
              {Array.from({ length: SESSIONS_PER_CYCLE }, (_, i) => (
                <span key={i}
                  className={`pomo-dot${i < sessionIndex ? ' is-done' : ''}${i === sessionIndex && mode === 'pomodoro' ? ' is-current' : ''}`}
                  style={{ '--dot-color': 'var(--accent)' } as React.CSSProperties}
                />
              ))}
            </div>
            {cyclesDone > 0 && <span className="pomo-cycle-count">{cyclesDone} ciclo{cyclesDone !== 1 ? 's' : ''}</span>}
          </div>

          <div className="pomo-controls">
            <button className="pomo-ctrl pomo-ctrl--ghost" onClick={reset} title="Reiniciar"><RotateCcw size={18} /></button>
            <button className="pomo-ctrl pomo-ctrl--play" onClick={() => setRunning(r => !r)}
              style={{ '--play-color': color } as React.CSSProperties}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={running ? 'p' : 'pl'}
                  initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.13 }} style={{ display: 'flex' }}>
                  {running ? <Pause size={26} /> : <Play size={26} />}
                </motion.span>
              </AnimatePresence>
            </button>
            <button className="pomo-ctrl pomo-ctrl--ghost" onClick={advance} title="Saltar"><SkipForward size={18} /></button>
          </div>

          <div className="pomo-opts">
            <button className={`pomo-opt${soundOn ? ' is-on' : ''}`} onClick={() => setSoundOn(s => !s)}>
              {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />} Sonido
            </button>
            <button className={`pomo-opt${autoAdvance ? ' is-on' : ''}`} onClick={() => setAutoAdvance(a => !a)}>
              Auto‑avanzar
            </button>
            <button className={`pomo-opt${showSettings ? ' is-on' : ''}`} onClick={() => setShowSettings(s => !s)}>
              <Settings2 size={14} /> Tiempos
            </button>
          </div>

          <AnimatePresence>
            {showSettings && (
              <motion.div className="pomo-settings"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}>
                {(['pomodoro', 'short', 'long'] as Mode[]).map(m => (
                  <div key={m} className="pomo-setting-row">
                    <span className="pomo-setting-dot" style={{ background: MODE_COLORS[m] }} />
                    <span className="pomo-setting-lbl">{MODE_LABELS[m]}</span>
                    <div className="pomo-stepper">
                      <button className="pomo-stepper__btn" onClick={() => applyDurations({ ...durations, [m]: Math.max(1, durations[m] - 1) })}>−</button>
                      <span className="pomo-stepper__val">{durations[m]} min</span>
                      <button className="pomo-stepper__btn" onClick={() => applyDurations({ ...durations, [m]: Math.min(90, durations[m] + 1) })}>+</button>
                    </div>
                  </div>
                ))}
                <button className="pomo-reset-defaults" onClick={() => applyDurations(DEFAULT_DURATIONS)}>Restablecer por defecto</button>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="pomo-hint">Atajo: <kbd>Espacio</kbd> para iniciar / pausar</p>
        </motion.div>

        {/* ── Right: stats + tips ── */}
        <motion.div
          className="pomo-sidebar"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.28, delay: 0.1 }}
        >
          {/* Stats */}
          <div className="pomo-stats-card">
            <h3 className="pomo-stats-title">Sesión actual</h3>
            <div className="pomo-stats-grid">
              <div className="pomo-stat">
                <Clock size={16} className="pomo-stat__icon" />
                <span className="pomo-stat__val">{totalWorkMin} min</span>
                <span className="pomo-stat__lbl">Tiempo trabajado</span>
              </div>
              <div className="pomo-stat">
                <Zap size={16} className="pomo-stat__icon" />
                <span className="pomo-stat__val">{sessionsDone}</span>
                <span className="pomo-stat__lbl">Pomodoros</span>
              </div>
              <div className="pomo-stat">
                <Brain size={16} className="pomo-stat__icon" />
                <span className="pomo-stat__val">{cyclesDone}</span>
                <span className="pomo-stat__lbl">Ciclos completos</span>
              </div>
              <div className="pomo-stat">
                <Coffee size={16} className="pomo-stat__icon" />
                <span className="pomo-stat__val">{sessionsDone > 0 ? sessionsDone : '—'}</span>
                <span className="pomo-stat__lbl">Descansos tomados</span>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="pomo-tips">
            <h3 className="pomo-stats-title">Técnica Pomodoro</h3>
            {TIPS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="pomo-tip">
                <div className="pomo-tip__icon"><Icon size={16} /></div>
                <div>
                  <div className="pomo-tip__title">{title}</div>
                  <p className="pomo-tip__body">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

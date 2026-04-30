import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2, RotateCcw, Loader2 } from 'lucide-react';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { uploadAudio } from '../../lib/firebase';

interface Props {
  uid: string;
  spaceId: string | null;
  /** Existing audio URL from a previously saved task */
  existingUrl?: string | null;
  /** Called whenever the committed audio URL changes (null = removed) */
  onChange: (url: string | null) => void;
}

function fmtSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function AudioRecorder({ uid, spaceId, existingUrl, onChange }: Props) {
  const rec = useAudioRecorder();

  // The "committed" URL: either existingUrl or one we just uploaded
  const [committedUrl, setCommittedUrl] = useState<string | null>(existingUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Local playback state for the committed audio player
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);

  // Sync existingUrl changes (when editId changes while modal is open)
  useEffect(() => {
    setCommittedUrl(existingUrl ?? null);
    setPlaying(false);
    setPlayProgress(0);
    rec.discard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingUrl]);

  // After recording stops, auto-upload
  useEffect(() => {
    if (rec.state !== 'stopped' || !rec.blob) return;
    const doUpload = async () => {
      setUploading(true);
      setUploadError(null);
      try {
        const audioId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const url = await uploadAudio(rec.blob!, uid, spaceId, audioId);
        setCommittedUrl(url);
        onChange(url);
      } catch (err) {
        console.error('[SUT] audio upload failed', err);
        setUploadError('No se pudo subir el audio. Verifica las reglas de Firebase Storage.');
        // Keep local blob for in-session playback only — do NOT pass it to onChange
        // because blob:// URLs are device-local and useless when saved to Firestore.
        setCommittedUrl(rec.blobUrl); // local playback still works this session
        // onChange is intentionally NOT called — audio won't be persisted
      } finally {
        setUploading(false);
      }
    };
    doUpload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.state]);

  const handleDelete = () => {
    rec.discard();
    setCommittedUrl(null);
    onChange(null);
    setPlaying(false);
    setPlayProgress(0);
    setUploadError(null);
  };

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else { el.play(); setPlaying(true); }
  };

  const handleAudioEnded = () => { setPlaying(false); setPlayProgress(0); };
  const handleTimeUpdate = () => {
    const el = audioRef.current;
    if (!el || !el.duration) return;
    setPlayProgress((el.currentTime / el.duration) * 100);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  // State: no audio and not recording → show "add audio" button
  if (!committedUrl && rec.state === 'idle') {
    return (
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        style={{ alignSelf: 'flex-start', gap: 6, color: 'var(--text-mute)' }}
        onClick={rec.start}
      >
        <Mic size={15} />
        Agregar nota de voz
      </button>
    );
  }

  // State: requesting mic permission
  if (rec.state === 'requesting') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: 'var(--text-mute)' }}>
        <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
        Solicitando micrófono…
      </div>
    );
  }

  // State: actively recording
  if (rec.state === 'recording') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
        padding: 'var(--sp-3) var(--sp-4)',
        background: 'color-mix(in srgb, var(--danger) 8%, transparent)',
        border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
        borderRadius: 'var(--radius-sm)',
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', flexShrink: 0,
          animation: 'pulse-ring 1.4s ease-out infinite',
        }} />
        <span style={{ fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
          {fmtSeconds(rec.seconds)}
        </span>
        <span style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--text-mute)' }}>Grabando…</span>
        <button
          type="button"
          className="btn btn--danger btn--sm"
          onClick={rec.stop}
          style={{ gap: 4 }}
        >
          <Square size={13} fill="currentColor" />
          Detener
        </button>
      </div>
    );
  }

  // State: uploading after stop
  if (uploading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: 'var(--text-mute)' }}>
        <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
        Subiendo nota de voz…
      </div>
    );
  }

  // State: has committed URL (playback)
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)',
      padding: 'var(--sp-3) var(--sp-4)',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
    }}>
      {/* Hidden native audio element */}
      <audio
        ref={audioRef}
        src={committedUrl!}
        onEnded={handleAudioEnded}
        onTimeUpdate={handleTimeUpdate}
        preload="metadata"
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
        <Mic size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--text-mute)' }}>
          Nota de voz
        </span>

        {/* Play / Pause */}
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={togglePlay}
          style={{ gap: 4, minWidth: 72 }}
        >
          {playing
            ? <><Pause size={13} /> Pausar</>
            : <><Play size={13} /> Escuchar</>
          }
        </button>

        {/* Re-record */}
        <button
          type="button"
          className="icon-btn"
          title="Volver a grabar"
          onClick={() => { rec.discard(); setCommittedUrl(null); onChange(null); setPlaying(false); }}
        >
          <RotateCcw size={14} />
        </button>

        {/* Delete */}
        <button
          type="button"
          className="icon-btn"
          title="Eliminar nota de voz"
          onClick={handleDelete}
          style={{ color: 'var(--danger)' }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Progress bar */}
      {playProgress > 0 && (
        <div style={{ height: 3, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ width: `${playProgress}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.2s linear' }} />
        </div>
      )}

      {/* Upload error notice */}
      {uploadError && (
        <p style={{ fontSize: '0.75rem', color: 'var(--danger)', margin: 0 }}>
          ⚠ {uploadError}
        </p>
      )}
    </div>
  );
}

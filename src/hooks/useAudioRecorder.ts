import { useState, useRef, useCallback, useEffect } from 'react';

export type RecordingState = 'idle' | 'requesting' | 'recording' | 'stopped';

export interface AudioRecorderResult {
  state: RecordingState;
  seconds: number;
  blob: Blob | null;
  blobUrl: string | null;
  start: () => Promise<void>;
  stop: () => void;
  discard: () => void;
}

/** Pick the best supported audio MIME type for MediaRecorder */
function pickMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ];
  return candidates.find(t => {
    try { return MediaRecorder.isTypeSupported(t); } catch { return false; }
  }) || '';
}

export function useAudioRecorder(): AudioRecorderResult {
  const [state, setState]     = useState<RecordingState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob]       = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const mediaRef  = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Cleanup blob URL and timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const start = useCallback(async () => {
    setState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const mr = new MediaRecorder(stream, options);

      chunksRef.current = [];
      mr.ondataavailable = e => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const recorded = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        // Revoke previous
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const url = URL.createObjectURL(recorded);
        blobUrlRef.current = url;
        setBlob(recorded);
        setBlobUrl(url);
        setState('stopped');
      };

      mr.start(200); // collect data every 200ms
      mediaRef.current = mr;
      setSeconds(0);
      setState('recording');

      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch (err) {
      console.warn('[SUT] Microphone access denied or not available', err);
      setState('idle');
    }
  }, []);

  const stop = useCallback(() => {
    if (mediaRef.current && mediaRef.current.state === 'recording') {
      mediaRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const discard = useCallback(() => {
    stop();
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setBlob(null);
    setBlobUrl(null);
    setState('idle');
    setSeconds(0);
  }, [stop]);

  return { state, seconds, blob, blobUrl, start, stop, discard };
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Square, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';

/**
 * Records a voice note with the browser's MediaRecorder. Recording starts as
 * soon as the microphone is granted; Stop hands back a File the composer
 * attaches like any other, and Cancel throws it away. Capped at two minutes
 * so a forgotten recorder cannot produce a forty-megabyte message.
 */
interface VoiceRecorderProps {
  onRecorded: (file: File) => void;
  onCancel: () => void;
}

const MAX_SECONDS = 120;

function pickMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  if (typeof MediaRecorder === 'undefined') return '';
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

export function VoiceRecorder({ onRecorded, onCancel }: VoiceRecorderProps) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const discardRef = useRef(false);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let audioContext: AudioContext | null = null;
    let raf = 0;

    async function start() {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        toast.error('Voice notes are not supported in this browser');
        onCancel();
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const mimeType = pickMimeType();
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recorderRef.current = recorder;
        chunksRef.current = [];
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((track) => track.stop());
          if (discardRef.current) return;
          const type = recorder.mimeType || mimeType || 'audio/webm';
          const blob = new Blob(chunksRef.current, { type });
          if (blob.size === 0) {
            toast.error('Nothing was recorded');
            onCancel();
            return;
          }
          const extension = type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'm4a' : 'webm';
          onRecorded(new File([blob], `voice-note.${extension}`, { type: type.split(';')[0] }));
        };
        recorder.start(250);

        timer = setInterval(() => {
          setSeconds((s) => {
            if (s + 1 >= MAX_SECONDS) {
              recorder.stop();
            }
            return s + 1;
          });
        }, 1000);

        // A simple level meter so the sender can see the microphone is live.
        try {
          audioContext = new AudioContext();
          const source = audioContext.createMediaStreamSource(stream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            analyser.getByteTimeDomainData(data);
            let sum = 0;
            for (const value of data) sum += Math.abs(value - 128);
            setLevel(Math.min(1, sum / data.length / 40));
            raf = requestAnimationFrame(tick);
          };
          tick();
        } catch {
          // No meter is fine; the timer shows it is recording.
        }
      } catch {
        toast.error('Microphone access was refused');
        onCancel();
      }
    }

    void start();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (raf) cancelAnimationFrame(raf);
      audioContext?.close().catch(() => {});
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        discardRef.current = true;
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };

  const cancel = () => {
    discardRef.current = true;
    stop();
    onCancel();
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <div className="flex flex-1 items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 dark:border-rose-900/50 dark:bg-rose-900/20" role="status" aria-live="polite">
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-600" />
      </span>
      <span className="text-sm font-medium tabular-nums text-rose-700 dark:text-rose-200">
        {mm}:{ss}
      </span>
      <div className="flex h-5 flex-1 items-end gap-0.5" aria-hidden>
        {Array.from({ length: 16 }).map((_, i) => (
          <span
            key={i}
            className="w-1 rounded-sm bg-rose-400 transition-[height]"
            style={{ height: `${Math.max(15, Math.min(100, level * 100 * (0.5 + Math.abs(Math.sin(i + seconds)) * 0.8)))}%` }}
          />
        ))}
      </div>
      <Button type="button" variant="outline" size="icon" aria-label="Discard recording" onClick={cancel}>
        <X className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" aria-label="Stop and attach the voice note" onClick={stop}>
        {seconds > 0 ? <Check className="h-4 w-4" /> : <Square className="h-4 w-4" />}
      </Button>
    </div>
  );
}

export default VoiceRecorder;

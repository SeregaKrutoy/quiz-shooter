'use client';

import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { sfx } from '@/game/client/audio';

/** Сканирование QR-кода камерой или из файла-картинки. */
export default function QrScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const doneRef = useRef(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    let alive = true;
    let lastScan = 0;
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Камера недоступна в этом браузере. Загрузите фото QR-кода ниже.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (!alive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setActive(true);
        const loop = (now: number) => {
          if (!alive || doneRef.current) return;
          rafRef.current = requestAnimationFrame(loop);
          if (now - lastScan < 250) return;
          lastScan = now;
          const canvas = canvasRef.current;
          if (!video.videoWidth || !canvas) return;
          const w = Math.min(640, video.videoWidth);
          const h = Math.round((w * video.videoHeight) / video.videoWidth);
          if (canvas.width !== w) canvas.width = w;
          if (canvas.height !== h) canvas.height = h;
          const g = canvas.getContext('2d', { willReadFrequently: true });
          if (!g) return;
          g.drawImage(video, 0, 0, w, h);
          const data = g.getImageData(0, 0, w, h);
          const found = jsQR(data.data, w, h);
          if (found?.data) {
            doneRef.current = true;
            sfx.correct();
            onResultRef.current(found.data);
          }
        };
        rafRef.current = requestAnimationFrame(loop);
      } catch {
        if (alive) setError('Нет доступа к камере. Разрешите доступ или загрузите фото QR-кода ниже.');
      }
    };
    start();
    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const onFile = (f: File | undefined) => {
    if (!f) return;
    sfx.init();
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      const canvas = canvasRef.current ?? document.createElement('canvas');
      const scale = Math.min(1, 800 / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const g = canvas.getContext('2d', { willReadFrequently: true });
      if (!g) {
        setError('Не удалось прочитать картинку');
        return;
      }
      g.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      try {
        const data = g.getImageData(0, 0, canvas.width, canvas.height);
        const found = jsQR(data.data, canvas.width, canvas.height);
        if (found?.data) {
          doneRef.current = true;
          sfx.correct();
          onResult(found.data);
        } else {
          setError('QR-код на картинке не найден. Попробуйте другое фото.');
        }
      } catch {
        setError('Не удалось прочитать картинку');
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError('Не удалось открыть файл');
    };
    img.src = url;
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--line)] bg-black">
        <video ref={videoRef} className="aspect-[4/3] w-full object-cover" playsInline muted />
        {!active && !error && <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white/60">Запуск камеры…</div>}
        {active && <div className="pointer-events-none absolute inset-6 rounded-xl border-2 border-[var(--accent)]/70" />}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      {error && <div className="w-full max-w-sm rounded-lg bg-[var(--danger)]/20 p-2 text-center text-sm font-bold text-[#ffb3c0]">{error}</div>}
      <label className="btn btn-ghost w-full max-w-sm cursor-pointer">
        🖼 Загрузить фото QR-кода
        <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      <button className="btn btn-ghost w-full max-w-sm" onClick={onClose}>Отмена</button>
    </div>
  );
}

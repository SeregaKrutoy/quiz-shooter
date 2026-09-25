'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function QrCode({ text, size = 200 }: { text: string; size?: number }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let alive = true;
    setUrl('');
    QRCode.toDataURL(text, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#141a30', light: '#ffffff' },
    })
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setUrl(''));
    return () => {
      alive = false;
    };
  }, [text, size]);
  if (!url) return <div className="flex items-center justify-center rounded-xl bg-white/10 text-white/50" style={{ width: size, height: size }}>…</div>;
  return <img src={url} width={size} height={size} alt="QR-код для обмена экзаменом" className="rounded-xl border-4 border-white" />;
}

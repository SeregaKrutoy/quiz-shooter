'use client';

import { useEffect, useState } from 'react';
import { dismissPortrait, isPortraitPhone, portraitDismissed, tryLockLandscape } from '@/game/client/storage';
import { sfx } from '@/game/client/audio';

/**
 * Альбомный режим для телефонов: в портрете показываем просьбу повернуть устройство.
 * Игру не блокируем жёстко — можно продолжить и в портрете.
 */
export default function OrientationGate({ touch, inGame }: { touch: boolean; inGame: boolean }) {
  const [portrait, setPortrait] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!touch) return;
    setHidden(portraitDismissed());
    const check = () => setPortrait(isPortraitPhone());
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    const id = window.setInterval(check, 1000);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
      window.clearInterval(id);
    };
  }, [touch]);

  // в игре пробуем зафиксировать альбомную ориентацию
  useEffect(() => {
    if (touch && inGame) tryLockLandscape();
  }, [touch, inGame]);

  if (!touch || !portrait || hidden) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(6,8,18,0.92)] p-5 no-select">
      <div className="pop-in flex max-w-xs flex-col items-center text-center">
        <div className="rotate-hint text-6xl">📱</div>
        <div className="title-font mt-3 text-2xl text-white">Поверните телефон</div>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          Игра рассчитана на <b className="text-[var(--accent)]">альбомный режим</b>: так виднее прицел, кнопки и билеты.
          {inGame ? ' Матч уже идёт — поверните устройство, когда будете готовы.' : ''}
        </p>
        <button
          className="btn btn-primary mt-4 w-full"
          onClick={() => {
            sfx.init();
            sfx.click();
            tryLockLandscape();
          }}
        >
          ⟳ Повернуть автоматически
        </button>
        <button
          className="btn btn-ghost mt-2 w-full"
          onClick={() => {
            sfx.click();
            dismissPortrait();
            setHidden(true);
          }}
        >
          Играть в портрете
        </button>
      </div>
    </div>
  );
}

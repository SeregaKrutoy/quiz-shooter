'use client';

import dynamic from 'next/dynamic';

const GameApp = dynamic(() => import('./GameApp'), {
  ssr: false,
  loading: () => (
    <div className="menu-bg fixed inset-0 flex items-center justify-center">
      <div className="relative z-10 text-center">
        <div className="title-font text-4xl text-white">Билет</div>
        <div className="title-font glow-text text-3xl text-[var(--accent)]">на респаун</div>
        <div className="mt-4 text-sm font-bold text-white/60">Загрузка…</div>
      </div>
    </div>
  ),
});

export default function GameRoot() {
  return <GameApp />;
}

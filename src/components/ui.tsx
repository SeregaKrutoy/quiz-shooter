'use client';

import type { ReactNode } from 'react';
import { sfx } from '@/game/client/audio';

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className="no-select select-none">
      <div className={`title-font leading-[0.9] ${small ? 'text-2xl' : 'text-[clamp(2.4rem,7vw,5rem)]'}`}>
        <span className="block text-white" style={{ textShadow: '0 4px 0 #1f2a55, 0 0 30px rgba(54,214,255,0.35)' }}>
          Билет
        </span>
        <span className="block text-[var(--accent)] glow-text">на респаун</span>
      </div>
      {!small && (
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-black/30 px-3 py-1 text-xs font-bold tracking-widest text-[var(--muted)] uppercase">
          <span className="h-2 w-2 rounded-full bg-[var(--danger)] pulse-soft" />
          Шутер, где смерть — это экзамен
        </div>
      )}
    </div>
  );
}

export interface SegOption<T> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
  title?: string;
}

export function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: SegOption<T>[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className="seg-item"
          data-active={o.value === value}
          disabled={o.disabled}
          title={o.title}
          onClick={() => {
            sfx.init();
            sfx.click();
            onChange(o.value);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Section({ label, children, right }: { label: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="label">{label}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export function ScreenShell({ title, onBack, children, wide = false }: { title: string; onBack: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="menu-bg fixed inset-0 overflow-y-auto">
      <div className={`relative z-10 mx-auto w-full ${wide ? 'max-w-6xl' : 'max-w-4xl'} px-4 py-5 sm:px-6 sm:py-8`}>
        <div className="mb-5 flex items-center gap-3">
          <button
            className="btn btn-ghost !px-3 !py-2"
            onClick={() => {
              sfx.click();
              onBack();
            }}
          >
            ← Назад
          </button>
          <h1 className="title-font text-2xl text-white sm:text-3xl">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Modal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3" onClick={onClose}>
      <div className="max-h-full w-full max-w-5xl overflow-y-auto pop-in" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function Stat({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-black/25 px-3 py-2 text-center">
      <div className="text-xl font-black" style={{ color: color ?? '#fff' }}>
        {value}
      </div>
      <div className="text-[10px] font-bold tracking-widest text-[var(--muted)] uppercase">{label}</div>
    </div>
  );
}

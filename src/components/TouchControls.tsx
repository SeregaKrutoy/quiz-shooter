'use client';

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import type { Input } from '@/game/client/input';
import { TOUCH_BTN_INFO, type TouchBtnId, type TouchLayout } from '@/game/client/storage';
import { sfx } from '@/game/client/audio';

interface Props {
  input: Input;
  sens: number;
  layout: TouchLayout;
  onPause: () => void;
  onBoard: (show: boolean) => void;
}

const LABELS: Record<TouchBtnId, string> = {
  fire: 'ОГОНЬ',
  jump: 'ПРЫЖОК',
  ads: 'ПРИЦЕЛ',
  reload: '↻',
  swap: '⇄',
  pause: '❚❚',
  board: '☰',
};

export default function TouchControls({ input, sens, layout, onPause, onBoard }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const [ads, setAds] = useState(false);
  const [fire, setFire] = useState(false);
  const sensRef = useRef(sens);
  sensRef.current = sens;
  const lefty = layout.leftHanded;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let joyId = -1, joyX = 0, joyY = 0;
    const looks = new Map<number, { x: number; y: number }>();
    const R = 58 * layout.joySize;

    const showJoy = (x: number, y: number, kx: number, ky: number, visible: boolean) => {
      const b = baseRef.current, k = knobRef.current;
      if (!b || !k) return;
      b.style.opacity = visible ? '1' : '0';
      const half = 65 * layout.joySize;
      b.style.transform = `translate(${x - half}px, ${y - half}px)`;
      k.style.transform = `translate(${kx}px, ${ky}px)`;
    };

    const down = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-tbtn]')) return;
      e.preventDefault();
      sfx.init();
      const rect = root.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      const joySide = layout.leftHanded ? x > rect.width * 0.58 : x < rect.width * 0.42;
      if (joySide && joyId < 0) {
        joyId = e.pointerId;
        joyX = x; joyY = y;
        showJoy(x, y, 0, 0, true);
      } else {
        looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      try { root.setPointerCapture(e.pointerId); } catch { /* игнор */ }
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId === joyId) {
        const rect = root.getBoundingClientRect();
        let dx = e.clientX - rect.left - joyX, dy = e.clientY - rect.top - joyY;
        const d = Math.hypot(dx, dy);
        if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
        input.tMoveX = dx / R;
        input.tMoveY = -dy / R;
        input.tSprint = d > R * 0.95 && dy < -R * 0.7;
        showJoy(joyX, joyY, dx, dy, true);
        return;
      }
      const l = looks.get(e.pointerId);
      if (l) {
        input.addLook((e.clientX - l.x) * 1.7 * sensRef.current, (e.clientY - l.y) * 1.7 * sensRef.current);
        l.x = e.clientX; l.y = e.clientY;
      }
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId === joyId) {
        joyId = -1;
        input.tMoveX = 0;
        input.tMoveY = 0;
        input.tSprint = false;
        showJoy(joyX, joyY, 0, 0, false);
      }
      looks.delete(e.pointerId);
    };
    root.addEventListener('pointerdown', down);
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', up);
    return () => {
      root.removeEventListener('pointerdown', down);
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerup', up);
      root.removeEventListener('pointercancel', up);
      input.tMoveX = 0;
      input.tMoveY = 0;
      input.tFire = false;
      input.tSprint = false;
    };
  }, [input, layout.joySize, layout.leftHanded]);

  // кнопка огня: удержание + прицеливание пальцем
  const fireLast = useRef<{ id: number; x: number; y: number } | null>(null);
  const fireProps = {
    onPointerDown: (e: RPointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      sfx.init();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      fireLast.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      input.tFire = true;
      setFire(true);
    },
    onPointerMove: (e: RPointerEvent) => {
      const l = fireLast.current;
      if (!l || l.id !== e.pointerId) return;
      input.addLook((e.clientX - l.x) * 1.5 * sensRef.current, (e.clientY - l.y) * 1.5 * sensRef.current);
      l.x = e.clientX; l.y = e.clientY;
    },
    onPointerUp: () => {
      fireLast.current = null;
      input.tFire = false;
      setFire(false);
    },
    onPointerCancel: () => {
      fireLast.current = null;
      input.tFire = false;
      setFire(false);
    },
  };

  const tap = (fn: () => void) => ({
    onPointerDown: (e: RPointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      sfx.init();
      fn();
    },
  });

  const styleFor = (id: TouchBtnId): CSSProperties => {
    const p = layout.positions[id];
    const x = lefty ? 1 - p.x : p.x;
    const d = Math.round(TOUCH_BTN_INFO[id].base * layout.scale);
    return {
      left: `${x * 100}%`,
      top: `${p.y * 100}%`,
      width: d,
      height: d,
      transform: 'translate(-50%, -50%)',
      opacity: layout.opacity,
      fontSize: d < 52 ? 10 : d < 72 ? 11 : 13,
    };
  };

  const joyD = Math.round(130 * layout.joySize);
  const knobD = Math.round(56 * layout.joySize);

  return (
    <div ref={rootRef} className="absolute inset-0 z-20 touch-none no-select" style={{ touchAction: 'none' }}>
      <div
        ref={baseRef}
        className="pointer-events-none absolute top-0 left-0 rounded-full border-2 border-white/25 bg-white/5 opacity-0 transition-opacity"
        style={{ width: joyD, height: joyD }}
      >
        <div
          ref={knobRef}
          className="absolute rounded-full border-2 border-white/60 bg-white/25"
          style={{ width: knobD, height: knobD, left: (joyD - knobD) / 2, top: (joyD - knobD) / 2 }}
        />
      </div>
      <div
        className="pointer-events-none absolute bottom-6 text-[11px] font-bold tracking-wider text-white/35 uppercase"
        style={lefty ? { right: 24 } : { left: 24 }}
      >
        Движение
      </div>

      <button data-tbtn="1" className="tbtn" style={styleFor('pause')} {...tap(onPause)}>{LABELS.pause}</button>
      <button data-tbtn="1" className="tbtn" style={styleFor('board')} {...tap(() => onBoard(true))} onPointerUp={() => onBoard(false)}>{LABELS.board}</button>

      <button data-tbtn="1" className="tbtn" style={styleFor('fire')} data-on={fire} {...fireProps}>{LABELS.fire}</button>
      <button data-tbtn="1" className="tbtn" style={styleFor('jump')} {...tap(() => input.press('jump'))}>{LABELS.jump}</button>
      <button data-tbtn="1" className="tbtn" style={styleFor('ads')} data-on={ads} {...tap(() => { input.tAds = !input.tAds; setAds(input.tAds); })}>{LABELS.ads}</button>
      <button data-tbtn="1" className="tbtn" style={styleFor('reload')} {...tap(() => input.press('reload'))}>{LABELS.reload}</button>
      <button data-tbtn="1" className="tbtn" style={styleFor('swap')} {...tap(() => input.press('swap'))}>{LABELS.swap}</button>
    </div>
  );
}

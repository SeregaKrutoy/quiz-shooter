'use client';

import { useEffect, useRef, useState } from 'react';
import { ScreenShell, Section, Seg } from './ui';
import { sfx } from '@/game/client/audio';
import {
  defaultKeys, defaultTouchLayout, KEY_ACTION_INFO, KEY_ACTIONS, prettyKey, TOUCH_BTN_INFO, TOUCH_BTNS,
  type KeyAction, type KeyBindings, type TouchBtnId, type TouchLayout,
} from '@/game/client/storage';

interface Props {
  touch: TouchLayout;
  keys: KeyBindings;
  isTouch: boolean;
  onSave: (touch: TouchLayout, keys: KeyBindings) => void;
  onBack: () => void;
}

const LABELS: Record<TouchBtnId, string> = {
  fire: 'ОГОНЬ', jump: 'ПРЫЖОК', ads: 'ПРИЦЕЛ', reload: '↻', swap: '⇄', pause: '❚❚', board: '☰', chat: '💬',
};

function TouchEditor({ value, onChange }: { value: TouchLayout; onChange: (v: TouchLayout) => void }) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<TouchBtnId>('fire');
  const dragRef = useRef<TouchBtnId | null>(null);

  const setPos = (id: TouchBtnId, x: number, y: number) => {
    onChange({ ...value, positions: { ...value.positions, [id]: { x: Math.min(0.97, Math.max(0.03, x)), y: Math.min(0.97, Math.max(0.03, y)) } } });
  };

  const posOf = (clientX: number, clientY: number) => {
    const r = areaRef.current?.getBoundingClientRect();
    if (!r) return null;
    return { x: (clientX - r.left) / r.width, y: (clientY - r.top) / r.height };
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div>
        <div
          ref={areaRef}
          className="relative aspect-video w-full touch-none overflow-hidden rounded-2xl border border-[var(--line)] no-select"
          style={{
            touchAction: 'none',
            background: 'linear-gradient(180deg,#1c2b1a 0%,#1c2b1a 55%,#2e4a2a 55%,#2e4a2a 100%)',
          }}
          onPointerDown={(e) => {
            const t = e.target as HTMLElement;
            if (t.closest('[data-edbtn]')) return;
            // тап по зоне: подвинуть выбранную кнопку сюда
            const p = posOf(e.clientX, e.clientY);
            if (p) {
              const x = value.leftHanded ? 1 - p.x : p.x;
              setPos(sel, x, p.y);
              sfx.click();
            }
          }}
        >
          <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.4) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.4) 1px,transparent 1px)', backgroundSize: '10% 10%' }} />
          <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[11px] font-bold text-white/70">
            Перетаскивайте кнопки · тап — переместить выбранную
          </div>
          {TOUCH_BTNS.map((id) => {
            const p = value.positions[id];
            const x = value.leftHanded ? 1 - p.x : p.x;
            const d = Math.round(TOUCH_BTN_INFO[id].base * value.scale * 0.85);
            const active = sel === id;
            return (
              <div
                key={id}
                data-edbtn="1"
                className="absolute flex cursor-grab items-center justify-center rounded-full font-black text-white active:cursor-grabbing"
                style={{
                  left: `${x * 100}%`,
                  top: `${p.y * 100}%`,
                  width: d,
                  height: d,
                  transform: 'translate(-50%,-50%)',
                  fontSize: d < 46 ? 9 : 10,
                  background: active ? 'rgba(255,197,61,0.55)' : 'rgba(20,26,48,0.6)',
                  border: `2px solid ${active ? '#ffd766' : 'rgba(255,255,255,0.3)'}`,
                  opacity: value.opacity,
                  touchAction: 'none',
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  dragRef.current = id;
                  setSel(id);
                  sfx.init();
                }}
                onPointerMove={(e) => {
                  if (dragRef.current !== id) return;
                  const r = posOf(e.clientX, e.clientY);
                  if (r) {
                    const xx = value.leftHanded ? 1 - r.x : r.x;
                    setPos(id, xx, r.y);
                  }
                }}
                onPointerUp={() => {
                  dragRef.current = null;
                }}
                onPointerCancel={() => {
                  dragRef.current = null;
                }}
              >
                {LABELS[id]}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TOUCH_BTNS.map((id) => (
            <button
              key={id}
              onClick={() => { sfx.click(); setSel(id); }}
              className={`rounded-lg px-2 py-1 text-[11px] font-bold ${sel === id ? 'bg-[var(--accent)] text-black' : 'bg-white/10 text-white/70'}`}
            >
              {TOUCH_BTN_INFO[id].title}
            </button>
          ))}
        </div>
      </div>
      <div className="panel h-fit space-y-4 p-4">
        <Section label={`Размер кнопок: ${value.scale.toFixed(2)}`}>
          <input className="w-full" type="range" min={0.6} max={1.6} step={0.05} value={value.scale} onChange={(e) => onChange({ ...value, scale: Number(e.target.value) })} />
        </Section>
        <Section label={`Прозрачность: ${Math.round(value.opacity * 100)}%`}>
          <input className="w-full" type="range" min={0.25} max={1} step={0.05} value={value.opacity} onChange={(e) => onChange({ ...value, opacity: Number(e.target.value) })} />
        </Section>
        <Section label={`Джойстик: ${value.joySize.toFixed(2)}`}>
          <input className="w-full" type="range" min={0.7} max={1.6} step={0.05} value={value.joySize} onChange={(e) => onChange({ ...value, joySize: Number(e.target.value) })} />
        </Section>
        <Section label="Ведущая рука">
          <Seg value={value.leftHanded ? 'l' : 'r'} onChange={(v) => onChange({ ...value, leftHanded: v === 'l' })} options={[{ value: 'r', label: '👉 Правая' }, { value: 'l', label: '👈 Левая' }]} />
        </Section>
        <button className="btn btn-ghost w-full !py-2 text-xs" onClick={() => { sfx.click(); onChange(defaultTouchLayout()); }}>Сбросить раскладку</button>
      </div>
    </div>
  );
}

function KeysEditor({ value, onChange }: { value: KeyBindings; onChange: (v: KeyBindings) => void }) {
  const [capture, setCapture] = useState<KeyAction | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!capture) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setCapture(null);
        return;
      }
      if (e.code === 'Tab') {
        setHint('Tab зарезервирован для таблицы счёта');
        return;
      }
      // обмен с действием, у которого уже такой код
      const other = (Object.keys(value) as KeyAction[]).find((a) => a !== capture && value[a] === e.code);
      const next = { ...value, [capture]: e.code };
      if (other) next[other] = value[capture];
      onChange(next);
      setCapture(null);
      setHint(null);
      sfx.click();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [capture, value, onChange]);

  return (
    <div className="panel mx-auto max-w-2xl space-y-1 p-4">
      <div className="pb-2 text-sm text-white/60">Нажмите «Изменить», затем клавишу. Esc — отмена. Tab и Esc зарезервированы игрой.</div>
      {hint && <div className="rounded-lg bg-[var(--danger)]/20 p-2 text-sm font-bold text-[#ffb3c0]">{hint}</div>}
      {KEY_ACTIONS.map((a) => (
        <div key={a} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2">
          <span className="font-bold">{KEY_ACTION_INFO[a]}</span>
          <button
            className={`rounded-lg px-4 py-1.5 font-mono font-black ${capture === a ? 'animate-pulse bg-[var(--accent)] text-black' : 'bg-white/10 text-[var(--accent)]'}`}
            onClick={() => { sfx.init(); sfx.click(); setCapture(a); }}
          >
            {capture === a ? '…' : prettyKey(value[a])}
          </button>
        </div>
      ))}
      <button className="btn btn-ghost mt-2 w-full !py-2 text-xs" onClick={() => { sfx.click(); onChange(defaultKeys()); }}>Сбросить клавиши</button>
    </div>
  );
}

export default function ControlsScreen({ touch, keys, isTouch, onSave, onBack }: Props) {
  const [tab, setTab] = useState<'touch' | 'keys'>(isTouch ? 'touch' : 'keys');
  const [t, setT] = useState<TouchLayout>(touch);
  const [k, setK] = useState<KeyBindings>(keys);
  const dirty = JSON.stringify(t) !== JSON.stringify(touch) || JSON.stringify(k) !== JSON.stringify(keys);
  return (
    <ScreenShell title="Управление" onBack={onBack} wide>
      <div className="mb-4 flex max-w-md gap-2">
        <Seg value={tab} onChange={setTab} options={[{ value: 'touch', label: '📱 Сенсорные кнопки' }, { value: 'keys', label: '⌨️ Клавиатура' }]} />
      </div>
      {tab === 'touch' ? <TouchEditor value={t} onChange={setT} /> : <KeysEditor value={k} onChange={setK} />}
      <div className="mt-4 flex max-w-md gap-2">
        <button className="btn btn-primary flex-1" disabled={!dirty} onClick={() => { sfx.click(); onSave(t, k); }}>✓ Сохранить</button>
      </div>
    </ScreenShell>
  );
}

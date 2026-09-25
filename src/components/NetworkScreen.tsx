'use client';

import { useEffect, useState } from 'react';
import type { Profile } from '@/game/client/storage';
import { loadSettings, saveSettings } from '@/game/client/storage';
import { sfx } from '@/game/client/audio';
import { LAYOUT_INFO, MatchSettings, MODE_INFO, RoomSummary, THEME_INFO } from '@/game/shared/types';
import MatchSetup from './MatchSetup';
import { ScreenShell } from './ui';

const STATE_LABEL: Record<string, { t: string; c: string }> = {
  lobby: { t: 'Лобби', c: '#3ddc84' },
  countdown: { t: 'Старт', c: '#ffc53d' },
  playing: { t: 'Идёт матч', c: '#36d6ff' },
  over: { t: 'Итоги', c: '#8f9bc4' },
};

export default function NetworkScreen({ profile, onJoin, onBack }: { profile: Profile; onJoin: (c: { code: string; id: string; secret: string }) => void; onBack: () => void }) {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [addrs, setAddrs] = useState<string[]>([]);
  const [origin, setOrigin] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/rooms', { cache: 'no-store' })
        .then((r) => r.json())
        .then((j: { rooms?: RoomSummary[] }) => {
          if (alive) {
            setRooms(j.rooms ?? []);
            setLoaded(true);
          }
        })
        .catch(() => alive && setLoaded(true));
    load();
    const id = window.setInterval(load, 2000);
    fetch('/api/server-info')
      .then((r) => r.json())
      .then((j: { addresses?: string[]; port?: string }) => alive && setAddrs((j.addresses ?? []).map((a) => `http://${a}:${j.port ?? '3000'}`)))
      .catch(() => {});
    window.setTimeout(() => alive && setOrigin(window.location.origin), 0);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const join = async (c: string) => {
    const cc = c.trim().toUpperCase();
    if (cc.length < 4) {
      setError('Введите код комнаты из 4 символов');
      return;
    }
    sfx.init();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/rooms/${encodeURIComponent(cc)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profile.name, look: profile.look }),
      });
      const j = (await r.json()) as { code?: string; id?: string; secret?: string; error?: string };
      if (!r.ok || !j.code || !j.id || !j.secret) throw new Error(j.error || 'Не удалось войти');
      onJoin({ code: j.code, id: j.id, secret: j.secret });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сети');
      setBusy(false);
    }
  };

  const create = async (s: MatchSettings, extra: { roomName: string; isPublic: boolean }) => {
    setBusy(true);
    setError(null);
    saveSettings(s);
    try {
      const r = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profile.name, look: profile.look, settings: s, roomName: extra.roomName || `Комната ${profile.name}`, isPublic: extra.isPublic }),
      });
      const j = (await r.json()) as { code?: string; id?: string; secret?: string; error?: string };
      if (!r.ok || !j.code || !j.id || !j.secret) throw new Error(j.error || 'Не удалось создать комнату');
      onJoin({ code: j.code, id: j.id, secret: j.secret });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сети');
      setBusy(false);
    }
  };

  if (creating) {
    return (
      <ScreenShell title="Новая комната" onBack={() => setCreating(false)} wide>
        <MatchSetup initial={loadSettings()} variant="create" submitLabel="Создать комнату" busy={busy} error={error} onSubmit={create} onCancel={() => setCreating(false)} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Сетевая игра" onBack={onBack} wide>
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <div className="panel p-5">
            <div className="label">Своя комната</div>
            <p className="mt-1 text-sm text-white/65">Вы станете хостом: выберете режим, карту и темы билетов.</p>
            <button className="btn btn-primary mt-3 w-full !py-4" onClick={() => { sfx.init(); sfx.click(); setError(null); setCreating(true); }}>
              ＋ Создать комнату
            </button>
          </div>
          <div className="panel p-5">
            <div className="label">Войти по коду</div>
            <div className="mt-2 flex gap-2">
              <input
                className="w-full rounded-xl border-2 border-[var(--line)] bg-black/30 px-3 py-2 text-center font-mono text-2xl font-black tracking-[0.3em] text-[var(--accent)] uppercase outline-none focus:border-[var(--accent)]"
                placeholder="ABCD"
                maxLength={4}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && join(code)}
              />
              <button className="btn btn-cyan" disabled={busy} onClick={() => join(code)}>Войти</button>
            </div>
            {error && <div className="mt-3 rounded-lg bg-[var(--danger)]/20 p-2 text-sm font-bold text-[#ffb3c0]">{error}</div>}
          </div>
          <div className="panel p-5 text-sm text-white/70">
            <div className="label">Игра по локальной сети</div>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Один компьютер запускает сервер игры.</li>
              <li>Остальные в той же Wi-Fi/LAN сети открывают в браузере его адрес.</li>
              <li>Хост создаёт комнату, друзья входят по коду или из списка.</li>
            </ol>
            <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-xs">
              {origin && <span className="rounded bg-white/10 px-2 py-1">{origin}</span>}
              {addrs.map((a) => (
                <span key={a} className="rounded bg-white/10 px-2 py-1">{a}</span>
              ))}
            </div>
            <p className="mt-3 text-xs text-white/50">Сервер можно развернуть и в интернете — тогда играть можно откуда угодно по тому же коду.</p>
          </div>
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between">
            <div className="label">Открытые комнаты на этом сервере</div>
            <div className="flex items-center gap-1.5 text-xs text-white/50"><span className="h-2 w-2 rounded-full bg-[var(--ok)] pulse-soft" /> обновляется</div>
          </div>
          {loaded && rooms.length === 0 && (
            <div className="mt-6 rounded-2xl border-2 border-dashed border-[var(--line)] p-8 text-center text-white/55">
              <div className="text-4xl">📭</div>
              <div className="mt-2 font-bold">Пока нет открытых комнат</div>
              <div className="text-sm">Создайте свою — друзья увидят её здесь.</div>
            </div>
          )}
          <div className="mt-3 grid gap-2">
            {rooms.map((r) => {
              const st = STATE_LABEL[r.state];
              const full = r.players >= r.max;
              return (
                <div key={r.code} className="slide-up flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--line)] bg-black/25 p-3">
                  <div className="text-3xl">{MODE_INFO[r.mode].icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-black">{r.name}</div>
                    <div className="text-xs text-white/60">
                      {MODE_INFO[r.mode].title} · {LAYOUT_INFO[r.layout].title} {THEME_INFO[r.theme].icon} · хост: {r.host}
                    </div>
                  </div>
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-black" style={{ background: `${st.c}22`, color: st.c }}>{st.t}</span>
                  <span className="w-12 text-center font-mono font-black">{r.players}/{r.max}</span>
                  <span className="font-mono text-sm font-black tracking-widest text-[var(--accent)]">{r.code}</span>
                  <button className="btn btn-cyan !px-4 !py-2" disabled={busy || full} onClick={() => join(r.code)}>
                    {full ? 'Полна' : 'Войти'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ScreenShell>
  );
}

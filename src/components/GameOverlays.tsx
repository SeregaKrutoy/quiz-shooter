'use client';

import { useEffect, useState } from 'react';
import type { FeedItem, HudData } from '@/game/client/engine';
import type { Prefs } from '@/game/client/storage';
import { sfx } from '@/game/client/audio';
import {
  BOTS, fmtTime, LAYOUT_INFO, MatchNet, MODE_INFO, PlayerNet, SIZE_INFO, THEME_INFO, TOPIC_INFO, WEAPONS, DIFF_INFO,
} from '@/game/shared/types';
import { Stat } from './ui';

export interface Announce { id: number; text: string; kind: string }
export interface Popup { id: number; text: string; color: string }

const WNAME = (w: string) => (w === 'bot' ? 'кулак' : WEAPONS[w as keyof typeof WEAPONS]?.name ?? w);

export function Hud({ hud, feed, announces, popups, touch, showTips }: { hud: HudData | null; feed: FeedItem[]; announces: Announce[]; popups: Popup[]; touch: boolean; showTips: boolean }) {
  if (!hud) return null;
  const hpK = Math.max(0, Math.min(1, hud.hp / 100));
  const hpColor = hpK > 0.55 ? '#3ddc84' : hpK > 0.3 ? '#ffc53d' : '#ff4d6d';
  const wd = WEAPONS[hud.weapon];
  const playing = hud.state === 'playing' || hud.state === 'countdown';
  let objective = '';
  if (hud.mode === 'coop') objective = `Волна ${hud.wave} · Команда: ${hud.teamBotKills} ботов`;
  else if (hud.mode === 'pvp') objective = `Убийств: ${hud.kills}`;
  else objective = `Боты: ${hud.bk} · Игроки: ${hud.kills}`;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 no-select">
      {/* верх */}
      <div className="absolute top-2 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 sm:top-3">
        <div className="flex items-center gap-2">
          <div className={`rounded-xl border border-white/15 bg-black/55 px-3 py-1 text-xl font-black tabular-nums sm:text-2xl ${hud.timeLeft < 15 && hud.state === 'playing' ? 'text-[var(--danger)] pulse-soft' : 'text-white'}`}>
            {fmtTime(hud.timeLeft)}
          </div>
          <div className="rounded-xl border border-[var(--accent)]/40 bg-black/55 px-3 py-1 text-center">
            <div className="text-lg leading-none font-black text-[var(--accent)] tabular-nums sm:text-xl">{hud.score}</div>
            <div className="text-[9px] font-bold tracking-widest text-white/50 uppercase">очки</div>
          </div>
        </div>
        <div className="rounded-lg bg-black/40 px-2 py-0.5 text-[11px] font-bold text-white/80 sm:text-xs">{objective}</div>
        {hud.online && <div className="text-[10px] font-bold text-white/35">пинг {hud.ping} мс</div>}
      </div>

      {/* лента убийств */}
      <div className={`absolute ${touch ? 'top-16 left-3' : 'top-4 left-4'} flex max-w-[46vw] flex-col gap-1`}>
        {feed.map((f) => (
          <div key={f.id} className={`feed-in rounded-lg px-2 py-1 text-[11px] font-bold sm:text-xs ${f.mine ? 'bg-[var(--accent)]/25 ring-1 ring-[var(--accent)]/60' : f.meVictim ? 'bg-[var(--danger)]/30' : 'bg-black/50'}`}>
            {f.kind === 'kill' ? (
              <span>
                <span className="text-white">{f.by}</span>
                <span className="mx-1.5 text-white/50">[{WNAME(f.w)}{f.head ? ' • в голову' : ''}]</span>
                <span className="text-[#ff9a6a]">{f.victim}</span>
              </span>
            ) : (
              <span className={f.ok === undefined ? 'text-white/70' : f.ok ? 'text-[var(--ok)]' : 'text-[#ff8a9a]'}>{f.ok !== undefined ? '📘 ' : ''}{f.text}</span>
            )}
          </div>
        ))}
      </div>

      {/* центр */}
      <div className="absolute top-[26%] left-1/2 flex -translate-x-1/2 flex-col items-center">
        {announces.map((a) => (
          <div
            key={a.id}
            className={`announce title-font text-center text-3xl whitespace-nowrap sm:text-5xl ${a.kind === 'multi' || a.kind === 'kill' ? 'text-[var(--accent)] glow-text' : a.kind === 'wave' || a.kind === 'bad' ? 'text-[var(--danger)]' : 'text-white'}`}
            style={{ textShadow: '0 3px 0 rgba(0,0,0,0.5)' }}
          >
            {a.text}
          </div>
        ))}
      </div>
      <div className="absolute top-[56%] left-1/2 flex -translate-x-1/2 flex-col items-center gap-1">
        {popups.map((p) => (
          <div key={p.id} className="float-up text-base font-black whitespace-nowrap sm:text-lg" style={{ color: p.color, textShadow: '0 2px 0 rgba(0,0,0,0.7)' }}>
            {p.text}
          </div>
        ))}
      </div>

      {hud.state === 'countdown' && hud.countdown > 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div key={Math.ceil(hud.countdown)} className="count-pop title-font text-[9rem] text-white" style={{ textShadow: '0 6px 0 #1f2a55, 0 0 40px rgba(255,197,61,0.6)' }}>
            {Math.ceil(hud.countdown)}
          </div>
        </div>
      )}

      {/* низ */}
      {playing && (
        <div className={`absolute ${touch ? 'top-[8.2rem] right-3 w-36' : 'bottom-5 left-5 w-72'}`}>
          <div className="mb-1 flex items-end justify-between">
            <span className="text-[10px] font-black tracking-widest text-white/60 uppercase">Здоровье {hud.shield && <span className="text-[var(--accent2)]">• щит</span>}</span>
            <span className="text-2xl leading-none font-black tabular-nums" style={{ color: hpColor }}>{Math.max(0, Math.round(hud.hp))}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full border border-white/20 bg-black/60 sm:h-4">
            <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${hpK * 100}%`, background: `linear-gradient(90deg, ${hpColor}, #ffffffaa)` }} />
          </div>
        </div>
      )}
      {playing && (
        <div className={`absolute ${touch ? 'top-[11.3rem] right-3 text-right' : 'right-5 bottom-5 text-right'}`}>
          <div className="text-[10px] font-black tracking-widest text-white/55 uppercase">{wd.kind}</div>
          <div className="text-lg leading-tight font-black text-white sm:text-2xl" style={{ textShadow: `0 0 16px ${wd.color}66` }}>{wd.name}</div>
          <div className="flex items-baseline justify-end gap-1 tabular-nums">
            <span className={`text-3xl font-black sm:text-5xl ${hud.ammo === 0 ? 'text-[var(--danger)]' : 'text-white'}`}>{hud.ammo}</span>
            <span className="text-base font-bold text-white/50">/ {hud.mag}</span>
          </div>
          {hud.reload >= 0 && (
            <div className="mt-1 ml-auto h-1.5 w-28 overflow-hidden rounded bg-black/60">
              <div className="h-full bg-[var(--accent)]" style={{ width: `${hud.reload * 100}%` }} />
            </div>
          )}
          {!touch && hud.primary !== 'pistol' && (
            <div className="mt-1 flex justify-end gap-1 text-[10px] font-bold">
              <span className={`rounded px-1.5 py-0.5 ${hud.weapon === hud.primary ? 'bg-white/20 text-white' : 'bg-black/40 text-white/45'}`}>1 · {WEAPONS[hud.primary].name}</span>
              <span className={`rounded px-1.5 py-0.5 ${hud.weapon === 'pistol' ? 'bg-white/20 text-white' : 'bg-black/40 text-white/45'}`}>2 · ПМ</span>
            </div>
          )}
        </div>
      )}

      {showTips && !touch && playing && (
        <div className="slide-up absolute bottom-24 left-1/2 w-[min(92vw,640px)] -translate-x-1/2 rounded-2xl border border-white/15 bg-black/65 p-3 text-center text-xs text-white/85">
          <b className="text-[var(--accent)]">WASD</b> — движение · <b className="text-[var(--accent)]">Мышь</b> — обзор · <b className="text-[var(--accent)]">ЛКМ</b> — огонь · <b className="text-[var(--accent)]">ПКМ</b> — прицел ·{' '}
          <b className="text-[var(--accent)]">Shift</b> — бег · <b className="text-[var(--accent)]">Пробел</b> — прыжок · <b className="text-[var(--accent)]">R</b> — перезарядка ·{' '}
          <b className="text-[var(--accent)]">Q</b> — смена оружия · <b className="text-[var(--accent)]">Tab</b> — счёт · <b className="text-[var(--accent)]">Esc</b> — пауза
        </div>
      )}
      {showTips && touch && playing && (
        <div className="slide-up absolute top-1/3 left-1/2 w-[min(80vw,420px)] -translate-x-1/2 rounded-2xl border border-white/15 bg-black/65 p-3 text-center text-xs text-white/85">
          Левая половина — джойстик, правая — обзор. Кнопка <b className="text-[var(--accent)]">ОГОНЬ</b> стреляет и поворачивает камеру.
        </div>
      )}
    </div>
  );
}

export function Scoreboard({ match, players, meId }: { match: MatchNet; players: PlayerNet[]; meId: string }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const mode = match.settings.mode;
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-3">
      <div className="panel pop-in w-full max-w-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="title-font text-xl text-white">Таблица матча</div>
          <div className="text-xs font-bold text-white/60">{MODE_INFO[mode].title}{mode === 'coop' ? ` · волна ${match.wave} · ботов: ${match.teamBotKills}` : ''}</div>
        </div>
        <ScoreTable players={sorted} meId={meId} hostId={match.hostId} mode={mode} />
      </div>
    </div>
  );
}

function ScoreTable({ players, meId, hostId, mode }: { players: PlayerNet[]; meId: string; hostId: string; mode: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-[10px] tracking-widest text-white/50 uppercase">
            <th className="py-1 pr-2">#</th>
            <th className="py-1 pr-2">Игрок</th>
            <th className="py-1 pr-2 text-right">Очки</th>
            {mode !== 'coop' && <th className="py-1 pr-2 text-right">Игроки</th>}
            {mode !== 'pvp' && <th className="py-1 pr-2 text-right">Боты</th>}
            <th className="py-1 pr-2 text-right">Смерти</th>
            <th className="py-1 text-right">Билеты</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p, i) => (
            <tr key={p.id} className={`border-t border-white/10 ${p.id === meId ? 'bg-[var(--accent)]/10' : ''}`}>
              <td className="py-1.5 pr-2 font-black text-white/60">{i + 1}</td>
              <td className="py-1.5 pr-2 font-bold">
                <span className="mr-2 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: p.look.body }} />
                {p.name}
                {p.id === hostId && <span className="ml-1" title="Хост">👑</span>}
                {p.id === meId && <span className="ml-1 text-[10px] text-[var(--accent)]">(вы)</span>}
              </td>
              <td className="py-1.5 pr-2 text-right font-black text-[var(--accent)] tabular-nums">{p.score}</td>
              {mode !== 'coop' && <td className="py-1.5 pr-2 text-right tabular-nums">{p.kills}</td>}
              {mode !== 'pvp' && <td className="py-1.5 pr-2 text-right tabular-nums">{p.bk}</td>}
              <td className="py-1.5 pr-2 text-right tabular-nums">{p.deaths}</td>
              <td className="py-1.5 text-right tabular-nums">{p.ok}/{p.qa}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PauseMenu({ online, canRestart, prefs, onPrefs, onResume, onRestart, onExit }: {
  online: boolean; canRestart: boolean; prefs: Prefs; onPrefs: (p: Prefs) => void; onResume: () => void; onRestart: () => void; onExit: () => void;
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-3 no-select">
      <div className="panel pop-in w-full max-w-sm p-5">
        <div className="title-font text-center text-4xl text-white">Пауза</div>
        {online && <div className="mt-1 text-center text-xs font-bold text-white/55">В сетевой игре матч продолжается для остальных</div>}
        <div className="mt-5 flex flex-col gap-2">
          <button className="btn btn-primary" onClick={onResume}>▶ Продолжить</button>
          {canRestart && <button className="btn btn-ghost" onClick={onRestart}>↻ Начать заново</button>}
          <button className="btn btn-ghost" onClick={onExit}>⏏ Выйти в меню</button>
        </div>
        <div className="mt-5 space-y-3 rounded-xl border border-[var(--line)] bg-black/20 p-3">
          <label className="block">
            <div className="flex justify-between text-xs font-bold text-white/70"><span>Чувствительность</span><span>{prefs.sens.toFixed(1)}</span></div>
            <input className="w-full" type="range" min={0.2} max={3} step={0.1} value={prefs.sens} onChange={(e) => onPrefs({ ...prefs, sens: Number(e.target.value) })} />
          </label>
          <label className="block">
            <div className="flex justify-between text-xs font-bold text-white/70"><span>Громкость</span><span>{Math.round(prefs.volume * 100)}%</span></div>
            <input className="w-full" type="range" min={0} max={1} step={0.05} value={prefs.volume} onChange={(e) => onPrefs({ ...prefs, volume: Number(e.target.value) })} />
          </label>
          <label className="flex items-center justify-between text-xs font-bold text-white/70">
            <span>Тряска экрана</span>
            <input type="checkbox" checked={prefs.shake} onChange={(e) => onPrefs({ ...prefs, shake: e.target.checked })} />
          </label>
          <label className="flex items-center justify-between text-xs font-bold text-white/70">
            <span>Инверсия по вертикали</span>
            <input type="checkbox" checked={prefs.invertY} onChange={(e) => onPrefs({ ...prefs, invertY: e.target.checked })} />
          </label>
        </div>
      </div>
    </div>
  );
}

export function GameOverScreen({ match, players, meId, rank, online, isHost, onRestart, onLobby, onExit }: {
  match: MatchNet; players: PlayerNet[]; meId: string; rank: number; online: boolean; isHost: boolean;
  onRestart: () => void; onLobby: () => void; onExit: () => void;
}) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const me = players.find((p) => p.id === meId);
  const mode = match.settings.mode;
  const winner = sorted[0];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyR') onRestart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onRestart]);
  const pct = me && me.qa ? Math.round((me.ok / me.qa) * 100) : 0;
  return (
    <div className="absolute inset-0 z-40 overflow-y-auto bg-[rgba(6,8,18,0.8)] p-3 no-select">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center py-4">
        <div className="slide-up text-center">
          <div className="label">Время вышло</div>
          <div className="title-font text-5xl text-white sm:text-6xl">Матч окончен</div>
          <div className="mt-2 text-sm font-bold text-white/70">
            {mode === 'coop'
              ? `Команда уничтожила ${match.teamBotKills} ботов и дошла до волны ${match.wave}`
              : winner
                ? `Победитель — ${winner.name} (${winner.score} очков)`
                : ''}
          </div>
          {rank > 0 && <div className="pop-in mt-3 inline-block rounded-full bg-[var(--accent)] px-4 py-1 text-sm font-black text-black uppercase">🏆 Новый рекорд! Место #{rank} в таблице</div>}
        </div>

        {sorted.length > 1 && (
          <div className="mt-6 flex items-end justify-center gap-2 sm:gap-4">
            {[1, 0, 2].map((idx) => {
              const p = sorted[idx];
              if (!p) return <div key={idx} className="w-24" />;
              const h = idx === 0 ? 'h-28' : idx === 1 ? 'h-20' : 'h-14';
              return (
                <div key={p.id} className="pop-in flex w-24 flex-col items-center sm:w-32" style={{ animationDelay: `${0.1 + idx * 0.12}s` }}>
                  <div className="mb-1 max-w-full truncate text-sm font-black">{p.name}</div>
                  <div className="text-xs font-bold text-[var(--accent)]">{p.score}</div>
                  <div className={`mt-1 flex w-full ${h} items-start justify-center rounded-t-xl pt-2 text-2xl font-black`} style={{ background: `linear-gradient(180deg, ${p.look.body}, ${p.look.body}55)` }}>
                    {idx + 1}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {me && (
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label="Очки" value={me.score} color="var(--accent)" />
            <Stat label={mode === 'coop' ? 'Смерти' : 'Игроков убито'} value={mode === 'coop' ? me.deaths : me.kills} />
            <Stat label="Ботов убито" value={me.bk} />
            <Stat label="Билетов сдано" value={`${me.ok}/${me.qa}`} color="var(--ok)" />
            <Stat label="Точность ответов" value={`${pct}%`} color="var(--accent2)" />
          </div>
        )}

        <div className="panel mt-4 p-3">
          <ScoreTable players={sorted} meId={meId} hostId={match.hostId} mode={mode} />
        </div>

        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <button className="btn btn-primary" onClick={onRestart}>↻ Играть снова (R)</button>
          {online && isHost && <button className="btn btn-cyan" onClick={onLobby}>⚙ В лобби (сменить настройки)</button>}
          <button className="btn btn-ghost" onClick={onExit}>В главное меню</button>
        </div>
      </div>
    </div>
  );
}

export function LobbyPanel({ match, players, meId, onStart, onSettings, onExit, error }: {
  match: MatchNet; players: PlayerNet[]; meId: string; onStart: () => void; onSettings: () => void; onExit: () => void; error: string | null;
}) {
  const [addr, setAddr] = useState<string[]>([]);
  const [origin, setOrigin] = useState('');
  useEffect(() => {
    setOrigin(window.location.origin);
    fetch('/api/server-info')
      .then((r) => r.json())
      .then((j: { addresses?: string[]; port?: string }) => setAddr((j.addresses ?? []).map((a) => `http://${a}:${j.port ?? '3000'}`)))
      .catch(() => {});
  }, []);
  const isHost = match.hostId === meId;
  const s = match.settings;
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-[rgba(6,8,18,0.55)] p-3 no-select">
      <div className="mx-auto grid max-w-5xl gap-3 py-4 md:grid-cols-[1.2fr_1fr]">
        <div className="panel slide-up p-5">
          <div className="label">Комната</div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="title-font text-3xl text-white">{match.roomName}</div>
            <div className="text-right">
              <div className="label">Код для входа</div>
              <div className="font-mono text-4xl font-black tracking-[0.25em] text-[var(--accent)]">{match.code}</div>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-[var(--line)] bg-black/25 p-3 text-xs text-white/75">
            <div className="font-bold text-white">Как позвать друзей по локальной сети:</div>
            <div className="mt-1">Откройте в браузере на их устройствах адрес этого сервера и введите код <b className="text-[var(--accent)]">{match.code}</b>:</div>
            <div className="mt-1 flex flex-wrap gap-1.5 font-mono">
              {origin && <span className="rounded bg-white/10 px-2 py-0.5">{origin}</span>}
              {addr.map((a) => (
                <span key={a} className="rounded bg-white/10 px-2 py-0.5">{a}</span>
              ))}
            </div>
          </div>
          <div className="mt-4 label">Игроки ({players.length}/8)</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-black/25 px-3 py-2">
                <span className="h-7 w-7 rounded-lg" style={{ background: `linear-gradient(135deg, ${p.look.body}, ${p.look.accent})` }} />
                <span className="font-bold">{p.name}</span>
                {p.id === match.hostId && <span title="Хост">👑</span>}
                {p.id === meId && <span className="text-[10px] font-bold text-[var(--accent)]">(вы)</span>}
              </div>
            ))}
          </div>
        </div>
        <div className="panel slide-up flex flex-col p-5" style={{ animationDelay: '0.08s' }}>
          <div className="label">Настройки матча</div>
          <div className="mt-2 space-y-1.5 text-sm">
            <Row k="Режим" v={`${MODE_INFO[s.mode].icon} ${MODE_INFO[s.mode].title}`} />
            <Row k="Карта" v={`${LAYOUT_INFO[s.map.layout].title} · ${SIZE_INFO[s.map.size].title} · ${THEME_INFO[s.map.theme].icon} ${THEME_INFO[s.map.theme].title}`} />
            <Row k="Темы билетов" v={[...s.topics.map((t) => TOPIC_INFO[t].short), ...(s.packs ?? []).map((p) => `📝 ${p.title} (${p.questions.length})`)].join(', ') || '—'} />
            {MODE_INFO[s.mode].bots && <Row k="Боты" v={`${s.bots} · ${DIFF_INFO[s.difficulty].title}`} />}
            <Row k="Длительность" v={fmtTime(s.duration)} />
          </div>
          <div className="mt-3 rounded-xl bg-black/25 p-3 text-xs text-white/60">{MODE_INFO[s.mode].desc} Боты: {Object.values(BOTS).map((b) => b.name).join(', ')}.</div>
          {error && <div className="mt-3 rounded-lg bg-[var(--danger)]/20 p-2 text-sm font-bold text-[#ffb3c0]">{error}</div>}
          <div className="mt-auto flex flex-col gap-2 pt-5">
            {isHost ? (
              <>
                <button className="btn btn-primary" onClick={() => { sfx.init(); onStart(); }}>▶ Начать матч</button>
                <button className="btn btn-cyan" onClick={onSettings}>⚙ Настроить карту и темы</button>
              </>
            ) : (
              <div className="pulse-soft rounded-xl border border-[var(--line)] p-3 text-center text-sm font-bold text-white/70">Ожидание хоста…</div>
            )}
            <button className="btn btn-ghost" onClick={onExit}>Выйти из комнаты</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-white/5 pb-1">
      <span className="text-white/55">{k}</span>
      <span className="text-right font-bold">{v}</span>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Engine, FeedItem, HudData, Phase, PhaseInfo } from '@/game/client/engine';
import { LocalTransport, OnlineTransport, Transport } from '@/game/client/transport';
import { addScore, markTipsSeen, Prefs, Profile, tipsSeen, type KeyBindings, type TouchLayout } from '@/game/client/storage';
import { sfx } from '@/game/client/audio';
import { QuestionDeck } from '@/game/shared/questions';
import type { ExamPack, MatchNet, MatchSettings, PlayerNet, TopicId, WeaponId } from '@/game/shared/types';
import ExamOverlay from './ExamOverlay';
import TouchControls from './TouchControls';
import OrientationGate from './OrientationGate';
import MatchSetup from './MatchSetup';
import { Announce, GameOverScreen, Hud, LobbyPanel, PauseMenu, Popup, Scoreboard } from './GameOverlays';
import { Modal } from './ui';

export type GameConfig = { kind: 'solo'; settings: MatchSettings } | { kind: 'online'; code: string; id: string; secret: string };

interface Props {
  config: GameConfig;
  profile: Profile;
  prefs: Prefs;
  touch: boolean;
  touchLayout: TouchLayout;
  keys: KeyBindings;
  onPrefs: (p: Prefs) => void;
  onExit: () => void;
}

export default function GameView({ config, profile, prefs, touch, touchLayout, keys, onPrefs, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [phaseInfo, setPhaseInfo] = useState<PhaseInfo>({ killer: null, killerWeapon: null, entrance: false, matchId: 0 });
  const [hud, setHud] = useState<HudData | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [announces, setAnnounces] = useState<Announce[]>([]);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [info, setInfo] = useState<{ m: MatchNet; players: PlayerNet[] } | null>(null);
  const [paused, setPaused] = useState(false);
  const [board, setBoard] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [editing, setEditing] = useState(false);
  const [ctrlError, setCtrlError] = useState<string | null>(null);
  const [rank, setRank] = useState(0);
  const [examKey, setExamKey] = useState(0);
  const [showTips, setShowTips] = useState(false);
  const [fps, setFps] = useState(0);
  const phaseRef = useRef<Phase>('loading');
  const savedMatch = useRef(-1);
  const tipsDone = useRef(false);
  const idRef = useRef(0);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const meId = config.kind === 'solo' ? 'me' : config.id;

  useEffect(() => {
    const canvas = canvasRef.current, overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const transport: Transport =
      config.kind === 'solo' ? new LocalTransport(config.settings, profile) : new OnlineTransport(config.code, config.id, config.secret);
    let eng: Engine;
    try {
      eng = new Engine({
        canvas, overlay, transport, profile, prefs: prefsRef.current, touch, keymap: keys,
        events: {
          phase: (p, pi) => {
            phaseRef.current = p;
            setPhase(p);
            setPhaseInfo(pi);
            if (p === 'exam') setExamKey((k) => k + 1);
            if (p !== 'play' && p !== 'countdown') setBoard(false);
            if (p === 'exam' || p === 'over' || p === 'lobby') setPaused(false);
          },
          hud: (h) => setHud(h),
          feed: (item) => {
            setFeed((f) => [...f.slice(-5), item]);
            window.setTimeout(() => setFeed((f) => f.filter((x) => x.id !== item.id)), 6500);
          },
          announce: (text, kind) => {
            const id = ++idRef.current;
            setAnnounces((a) => [...a.slice(-1), { id, text, kind }]);
            window.setTimeout(() => setAnnounces((a) => a.filter((x) => x.id !== id)), 1900);
          },
          popup: (text, color) => {
            const id = ++idRef.current;
            setPopups((a) => [...a.slice(-3), { id, text, color: color ?? '#ffffff' }]);
            window.setTimeout(() => setPopups((a) => a.filter((x) => x.id !== id)), 1350);
          },
          match: (m, players) => setInfo({ m, players }),
          pauseRequest: (toggle) => {
            const p = phaseRef.current;
            if (p === 'exam' || p === 'over' || p === 'lobby' || p === 'loading') return;
            setPaused((v) => (toggle ? !v : true));
          },
          scoreboard: (show) => setBoard(show),
          lock: (l) => setLocked(l),
          fatal: (msg) => setFatal(msg),
          fps: (f) => setFps(f),
        },
      });
    } catch {
      transport.leave();
      window.setTimeout(() => setFatal('Не удалось запустить 3D-графику (WebGL). Попробуйте другой браузер.'), 0);
      return;
    }
    engineRef.current = eng;
    eng.start();
    window.setTimeout(() => setEngine(eng), 0);
    const onVis = () => {
      if (document.hidden && config.kind === 'solo' && (phaseRef.current === 'play' || phaseRef.current === 'countdown')) setPaused(true);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      eng.dispose();
      transport.leave();
      engineRef.current = null;
    };
    // движок создаётся один раз на сессию
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    engineRef.current?.setPrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    engineRef.current?.setKeymap(keys);
  }, [keys]);

  // подсказки по управлению в первом матче
  useEffect(() => {
    if ((phase === 'countdown' || phase === 'play') && !tipsDone.current) {
      tipsDone.current = true;
      if (!tipsSeen()) {
        markTipsSeen();
        window.setTimeout(() => setShowTips(true), 0);
        window.setTimeout(() => setShowTips(false), 9000);
      }
    }
  }, [phase]);

  // сохранение рекорда
  useEffect(() => {
    if (phase !== 'over' || !info || info.m.state !== 'over') return;
    if (savedMatch.current === info.m.matchId) return;
    savedMatch.current = info.m.matchId;
    const me = info.players.find((p) => p.id === meId);
    if (!me || me.score <= 0) return;
    const entry = {
      name: me.name, score: me.score, kills: me.kills, bk: me.bk, deaths: me.deaths, ok: me.ok, qa: me.qa,
      mode: info.m.settings.mode, layout: info.m.settings.map.layout, online: config.kind === 'online', date: Date.now(),
    };
    const r = addScore(entry);
    window.setTimeout(() => setRank(r), 0);
    fetch('/api/scores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) }).catch(() => {});
  }, [phase, info, meId, config.kind]);

  useEffect(() => {
    if (phase === 'countdown') window.setTimeout(() => setRank(0), 0);
  }, [phase]);

  const topics: TopicId[] = info?.m.settings.topics ?? (config.kind === 'solo' ? config.settings.topics : ['flags', 'history', 'law']);
  const packs: ExamPack[] = info?.m.settings.packs ?? (config.kind === 'solo' ? (config.settings.packs ?? []) : []);
  const deckKey = `${[...topics].sort().join(',')}#${packs.map((q) => `${q.id}:${q.questions.length}`).sort().join('|')}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const deck = useMemo(() => new QuestionDeck(topics, packs), [deckKey]);

  const onExamDone = useCallback((w: WeaponId, correct: boolean, time: number, topic: TopicId) => {
    const e = engineRef.current;
    if (!e) return;
    e.respawn(w, correct, time, topic);
    e.lockPointer();
  }, []);

  const resume = () => {
    setPaused(false);
    engineRef.current?.lockPointer();
  };

  const restart = async () => {
    const e = engineRef.current;
    if (!e) return;
    sfx.init();
    const err = await e.control('restart');
    setCtrlError(err);
    setPaused(false);
    if (!err) e.lockPointer();
  };

  const isHost = !!info && info.m.hostId === meId;
  const inPlay = phase === 'play' || phase === 'countdown';

  return (
    <div className="fixed inset-0 overflow-hidden bg-black no-select" onPointerDown={() => sfx.init()}>
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      {(inPlay || phase === 'dying') && <Hud hud={hud} feed={feed} announces={announces} popups={popups} touch={touch} showTips={showTips} />}

      {phase === 'dying' && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-[radial-gradient(circle,rgba(120,0,25,0.1),rgba(120,0,25,0.55))]">
          <div className="announce title-font text-6xl text-[var(--danger)] sm:text-7xl" style={{ textShadow: '0 4px 0 #3a0010' }}>Вы убиты</div>
          {phaseInfo.killer && <div className="slide-up mt-2 text-lg font-bold text-white/85">Вас победил: {phaseInfo.killer}</div>}
          <div className="slide-up mt-1 text-sm font-bold text-white/60">Готовьтесь к экзамену…</div>
        </div>
      )}

      {touch && engine && inPlay && !paused && (
        <TouchControls input={engine.inputRef} sens={prefs.sens} layout={touchLayout} onPause={() => setPaused(true)} onBoard={setBoard} />
      )}

      {prefs.showFps && (
        <div className="pointer-events-none absolute bottom-2 left-2 z-30 rounded-lg bg-black/60 px-2 py-1 font-mono text-xs font-black text-[var(--ok)]">{fps} FPS</div>
      )}

      <OrientationGate touch={touch} inGame={inPlay && !paused} />

      {!touch && inPlay && !paused && !locked && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[30%] z-20 flex justify-center">
          <div className="pulse-soft rounded-full border border-white/20 bg-black/60 px-5 py-2 text-sm font-bold text-white">🖱 Кликните по экрану, чтобы захватить мышь</div>
        </div>
      )}

      {board && info && !paused && <Scoreboard match={info.m} players={info.players} meId={meId} />}

      {phase === 'exam' && (
        <ExamOverlay key={examKey} deck={deck} entrance={phaseInfo.entrance} killer={phaseInfo.killer} killerWeapon={phaseInfo.killerWeapon} onDone={onExamDone} />
      )}

      {paused && (
        <PauseMenu
          online={config.kind === 'online'}
          canRestart={config.kind === 'solo' || isHost}
          prefs={prefs}
          onPrefs={onPrefs}
          onResume={resume}
          onRestart={restart}
          onExit={onExit}
        />
      )}

      {phase === 'over' && info && (
        <GameOverScreen
          match={info.m}
          players={info.players}
          meId={meId}
          rank={rank}
          online={config.kind === 'online'}
          isHost={isHost}
          onRestart={restart}
          onLobby={async () => {
            const err = await engineRef.current?.control('lobby');
            setCtrlError(err ?? null);
          }}
          onExit={onExit}
        />
      )}

      {phase === 'lobby' && info && (
        <LobbyPanel
          match={info.m}
          players={info.players}
          meId={meId}
          error={ctrlError}
          onStart={async () => {
            const err = await engineRef.current?.control('start');
            setCtrlError(err ?? null);
          }}
          onSettings={() => setEditing(true)}
          onExit={onExit}
        />
      )}

      {editing && info && (
        <Modal onClose={() => setEditing(false)}>
          <MatchSetup
            initial={info.m.settings}
            variant="edit"
            submitLabel="Сохранить настройки"
            onCancel={() => setEditing(false)}
            onSubmit={async (s) => {
              const err = await engineRef.current?.control('settings', s);
              setCtrlError(err ?? null);
              setEditing(false);
            }}
          />
        </Modal>
      )}

      {phase === 'loading' && !fatal && (
        <div className="menu-bg absolute inset-0 z-50 flex flex-col items-center justify-center gap-3">
          <div className="title-font text-3xl text-white">Раздаём билеты…</div>
          <div className="h-2 w-48 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--accent)]" />
          </div>
        </div>
      )}

      {fatal && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
          <div className="panel pop-in max-w-sm p-6 text-center">
            <div className="title-font text-2xl text-[var(--danger)]">Упс!</div>
            <div className="mt-2 text-white/80">{fatal}</div>
            <button className="btn btn-primary mt-5 w-full" onClick={onExit}>В главное меню</button>
          </div>
        </div>
      )}
    </div>
  );
}

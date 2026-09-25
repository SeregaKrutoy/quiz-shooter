'use client';

import { useEffect, useRef, useState } from 'react';
import { buildMap } from '@/game/shared/maps';
import {
  Density, DENSITY_INFO, DIFF_INFO, Difficulty, DURATIONS, fmtTime, GameMode, LAYOUT_INFO, MapLayout, MapSize, MapTheme, MatchSettings,
  MAX_PACKS, MODE_INFO, SIZE_INFO, THEME_INFO, TOPIC_INFO, TopicId,
} from '@/game/shared/types';
import { sfx } from '@/game/client/audio';
import { loadCustomExams, type CustomExam } from '@/game/client/storage';
import ExamsScreen from './ExamsScreen';
import { Modal, Section, Seg } from './ui';

const FLOOR: Record<MapTheme, string> = { day: '#b9b4a8', sunset: '#b59a86', night: '#262c45', snow: '#dfe7ef' };

function MapPreview({ settings }: { settings: MatchSettings }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d');
    if (!g) return;
    const map = buildMap(settings.map);
    const S = c.width;
    const half = map.half;
    const s = S / (half * 2 + 2);
    const tx = (x: number) => (x + half + 1) * s;
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#0d1226';
    g.fillRect(0, 0, S, S);
    g.fillStyle = FLOOR[settings.map.theme];
    g.fillRect(tx(-half), tx(-half), half * 2 * s, half * 2 * s);
    g.strokeStyle = 'rgba(0,0,0,0.08)';
    for (let x = -half; x <= half; x += 4) {
      g.beginPath(); g.moveTo(tx(x), tx(-half)); g.lineTo(tx(x), tx(half)); g.stroke();
      g.beginPath(); g.moveTo(tx(-half), tx(x)); g.lineTo(tx(half), tx(x)); g.stroke();
    }
    for (const b of map.boxes) {
      const shade = b.h > 3 ? '#27304f' : b.h > 1.8 ? '#46527c' : b.h > 1 ? '#6d7aa6' : '#97a3c9';
      g.fillStyle = shade;
      g.fillRect(tx(b.x - b.hw), tx(b.z - b.hd), b.hw * 2 * s, b.hd * 2 * s);
    }
    g.fillStyle = '#36d6ff';
    for (const [x, z] of map.spawns) {
      g.beginPath(); g.arc(tx(x), tx(z), 3, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#3ddc84';
    for (const [x, z] of map.packs) {
      g.fillRect(tx(x) - 5, tx(z) - 1.5, 10, 3);
      g.fillRect(tx(x) - 1.5, tx(z) - 5, 3, 10);
    }
  }, [settings.map]);
  return <canvas ref={ref} width={320} height={320} className="aspect-square w-full max-w-[320px] rounded-2xl border border-[var(--line)] shadow-2xl" />;
}

export default function MatchSetup({
  initial, variant, submitLabel, busy = false, error = null, onSubmit, onCancel,
}: {
  initial: MatchSettings;
  variant: 'solo' | 'create' | 'edit';
  submitLabel: string;
  busy?: boolean;
  error?: string | null;
  onSubmit: (s: MatchSettings, extra: { roomName: string; isPublic: boolean }) => void;
  onCancel: () => void;
}) {
  const [s, setS] = useState<MatchSettings>(() => {
    const init = { ...initial, map: { ...initial.map }, topics: [...initial.topics.filter((t) => t !== 'custom')], packs: [...(initial.packs ?? [])] };
    if (variant === 'solo' && init.mode === 'pvp') init.mode = 'coop';
    return init;
  });
  const [myExams, setMyExams] = useState<CustomExam[]>(() => loadCustomExams());
  const [showExams, setShowExams] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const set = (p: Partial<MatchSettings>) => setS((o) => ({ ...o, ...p }));
  const setMap = (p: Partial<MatchSettings['map']>) => setS((o) => ({ ...o, map: { ...o.map, ...p } }));
  const toggleTopic = (t: TopicId) => {
    sfx.init();
    sfx.click();
    setS((o) => {
      const has = o.topics.includes(t);
      if (has && o.topics.length === 1 && o.packs.length === 0) return o;
      return { ...o, topics: has ? o.topics.filter((x) => x !== t) : [...o.topics, t] };
    });
  };
  const togglePack = (e: CustomExam) => {
    sfx.init();
    sfx.click();
    setS((o) => {
      const has = o.packs.some((p) => p.id === e.id);
      if (has) {
        const packs = o.packs.filter((p) => p.id !== e.id);
        if (o.topics.length === 0 && packs.length === 0) return o;
        return { ...o, packs };
      }
      if (o.packs.length >= MAX_PACKS) return o;
      return { ...o, packs: [...o.packs, { id: e.id, title: e.title, questions: e.questions }] };
    });
  };
  const botsOn = MODE_INFO[s.mode].bots;
  const minBots = variant === 'solo' ? 2 : s.mode === 'coop' ? 1 : 0;
  const totalQ = s.topics.reduce((a, t) => a + (TOPIC_INFO[t]?.count ?? 0), 0) + s.packs.reduce((a, p) => a + p.questions.length, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="panel space-y-5 p-4 sm:p-5">
        {variant === 'create' && (
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Section label="Название комнаты">
              <input
                className="w-full rounded-xl border-2 border-[var(--line)] bg-black/30 px-3 py-2 font-bold text-white outline-none focus:border-[var(--accent)]"
                placeholder="Например: Кабинет 301"
                maxLength={24}
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
              />
            </Section>
            <Section label="Видимость">
              <Seg value={isPublic ? 'y' : 'n'} onChange={(v) => setIsPublic(v === 'y')} options={[{ value: 'y', label: 'В списке' }, { value: 'n', label: 'По коду' }]} />
            </Section>
          </div>
        )}

        <Section label="Режим">
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(MODE_INFO) as GameMode[]).map((m) => {
              const disabled = variant === 'solo' && m === 'pvp';
              const active = s.mode === m;
              return (
                <button
                  key={m}
                  disabled={disabled}
                  onClick={() => {
                    sfx.init();
                    sfx.click();
                    set({ mode: m, bots: m === 'pvp' ? s.bots : Math.max(variant === 'solo' ? 2 : m === 'coop' ? 1 : 0, s.bots) });
                  }}
                  className={`rounded-2xl border-2 p-3 text-left transition-all ${active ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--line)] bg-black/20 hover:border-[#4b5aa0]'} ${disabled ? 'cursor-not-allowed opacity-35' : ''}`}
                >
                  <div className="text-2xl">{MODE_INFO[m].icon}</div>
                  <div className="mt-1 font-black">{MODE_INFO[m].title}</div>
                  <div className="text-xs text-white/60">{disabled ? 'Доступно только в сетевой игре' : MODE_INFO[m].desc}</div>
                </button>
              );
            })}
          </div>
        </Section>

        <Section label="Карта">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(LAYOUT_INFO) as MapLayout[]).map((l) => (
              <button
                key={l}
                onClick={() => { sfx.init(); sfx.click(); setMap({ layout: l }); }}
                className={`rounded-2xl border-2 p-3 text-left transition-all ${s.map.layout === l ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--line)] bg-black/20 hover:border-[#4b5aa0]'}`}
              >
                <div className="text-2xl">{LAYOUT_INFO[l].icon}</div>
                <div className="font-black">{LAYOUT_INFO[l].title}</div>
                <div className="text-[11px] leading-tight text-white/55">{LAYOUT_INFO[l].desc}</div>
              </button>
            ))}
          </div>
        </Section>

        <div className="grid gap-4 sm:grid-cols-2">
          <Section label="Размер">
            <Seg value={s.map.size} onChange={(v: MapSize) => setMap({ size: v })} options={(Object.keys(SIZE_INFO) as MapSize[]).map((k) => ({ value: k, label: SIZE_INFO[k].title }))} />
          </Section>
          <Section label="Укрытия">
            <Seg value={s.map.density} onChange={(v: Density) => setMap({ density: v })} options={(Object.keys(DENSITY_INFO) as Density[]).map((k) => ({ value: k, label: DENSITY_INFO[k].title }))} />
          </Section>
        </div>
        <Section label="Время суток и погода">
          <Seg value={s.map.theme} onChange={(v: MapTheme) => setMap({ theme: v })} options={(Object.keys(THEME_INFO) as MapTheme[]).map((k) => ({ value: k, label: `${THEME_INFO[k].icon} ${THEME_INFO[k].title}` }))} />
        </Section>

        <Section label={`Темы экзаменационных билетов · ${totalQ} вопросов`}>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(TOPIC_INFO) as TopicId[]).filter((t) => t !== 'custom').map((t) => {
              const on = s.topics.includes(t);
              const info = TOPIC_INFO[t];
              return (
                <button
                  key={t}
                  onClick={() => toggleTopic(t)}
                  className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all ${on ? 'bg-white/5' : 'border-[var(--line)] bg-black/20 opacity-60'}`}
                  style={on ? { borderColor: info.color, boxShadow: `0 0 24px ${info.color}22` } : undefined}
                >
                  <span className="text-2xl">{info.icon}</span>
                  <span className="flex-1">
                    <span className="block font-black">{info.title}</span>
                    <span className="block text-xs text-white/55">{info.count} вопросов</span>
                  </span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-md border-2 text-sm font-black" style={{ borderColor: on ? info.color : '#3a4679', background: on ? info.color : 'transparent', color: '#0b0e1a' }}>
                    {on ? '✓' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section
          label={`Свои экзамены · выбрано ${s.packs.length}/${MAX_PACKS}`}
          right={<button className="text-xs font-bold text-[var(--accent2)]" onClick={() => { sfx.init(); sfx.click(); setShowExams(true); }}>✏️ Конструктор и обмен</button>}
        >
          {myExams.length === 0 ? (
            <button onClick={() => { sfx.init(); sfx.click(); setShowExams(true); }} className="w-full rounded-2xl border-2 border-dashed border-[var(--line)] p-4 text-center text-sm text-white/60 hover:border-[#4b5aa0]">
              У вас пока нет своих экзаменов — <b className="text-[var(--accent2)]">создайте первый</b> или получите от друга по QR-коду
            </button>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {myExams.map((e) => {
                const on = s.packs.some((p) => p.id === e.id);
                const disabled = !on && s.packs.length >= MAX_PACKS;
                return (
                  <button
                    key={e.id}
                    disabled={disabled}
                    onClick={() => togglePack(e)}
                    className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all ${on ? 'bg-white/5' : 'border-[var(--line)] bg-black/20 opacity-70'} ${disabled ? 'cursor-not-allowed opacity-35' : ''}`}
                    style={on ? { borderColor: '#7dff5a', boxShadow: '0 0 24px #7dff5a22' } : undefined}
                  >
                    <span className="text-2xl">📝</span>
                    <span className="flex-1">
                      <span className="block truncate font-black">{e.title}</span>
                      <span className="block text-xs text-white/55">{e.questions.length} вопросов{e.author ? ` · ${e.author}` : ''}</span>
                    </span>
                    <span className="flex h-6 w-6 items-center justify-center rounded-md border-2 text-sm font-black" style={{ borderColor: on ? '#7dff5a' : '#3a4679', background: on ? '#7dff5a' : 'transparent', color: '#0b0e1a' }}>
                      {on ? '✓' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {s.packs.length > 0 && variant !== 'solo' && (
            <div className="mt-2 rounded-xl bg-black/25 p-2 text-xs text-white/60">Вопросы встроены в настройки комнаты — друзьям ничего скачивать не нужно, билеты придут всем.</div>
          )}
        </Section>

        {botsOn && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Section label={`Ботов на карте: ${s.bots}${s.mode === 'coop' ? ' (+2 каждую волну)' : ''}`}>
              <input className="w-full" type="range" min={minBots} max={16} value={Math.max(minBots, s.bots)} onChange={(e) => set({ bots: Number(e.target.value) })} />
            </Section>
            <Section label="Сложность ботов">
              <Seg value={s.difficulty} onChange={(v: Difficulty) => set({ difficulty: v })} options={(Object.keys(DIFF_INFO) as Difficulty[]).map((k) => ({ value: k, label: DIFF_INFO[k].title }))} />
            </Section>
          </div>
        )}

        <Section label="Длительность матча">
          <Seg value={s.duration} onChange={(v: number) => set({ duration: v })} options={DURATIONS.map((d) => ({ value: d, label: fmtTime(d) }))} />
        </Section>
      </div>

      <div className="space-y-3">
        <div className="panel flex flex-col items-center gap-3 p-4 lg:sticky lg:top-4">
          <div className="flex w-full items-center justify-between">
            <div className="label">Превью карты</div>
            <div className="font-mono text-xs text-white/50">сид {s.map.seed}</div>
          </div>
          <MapPreview settings={s} />
          <button className="btn btn-ghost w-full" onClick={() => { sfx.init(); sfx.click(); setMap({ seed: Math.floor(Math.random() * 999999) }); }}>
            🎲 Сгенерировать заново
          </button>
          <div className="flex w-full gap-3 text-[11px] text-white/55">
            <span><span className="text-[#36d6ff]">●</span> точки появления</span>
            <span><span className="text-[#3ddc84]">✚</span> аптечки</span>
          </div>
          {error && <div className="w-full rounded-lg bg-[var(--danger)]/20 p-2 text-sm font-bold text-[#ffb3c0]">{error}</div>}
          <button
            className="btn btn-primary w-full !py-4 text-lg"
            disabled={busy}
            onClick={() => {
              sfx.init();
              const out: MatchSettings = { ...s, bots: botsOn ? Math.max(minBots, s.bots) : s.bots };
              onSubmit(out, { roomName: roomName.trim(), isPublic });
            }}
          >
            {busy ? 'Подождите…' : submitLabel}
          </button>
          <button className="btn btn-ghost w-full" onClick={onCancel}>Отмена</button>
        </div>
      </div>
      {showExams && (
        <Modal onClose={() => { setMyExams(loadCustomExams()); setShowExams(false); }}>
          <div className="panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="title-font text-xl text-white">Свои экзамены</div>
              <button className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={() => { setMyExams(loadCustomExams()); setShowExams(false); }}>✓ Готово</button>
            </div>
            <ExamsScreen embedded onBack={() => { setMyExams(loadCustomExams()); setShowExams(false); }} />
          </div>
        </Modal>
      )}
    </div>
  );
}

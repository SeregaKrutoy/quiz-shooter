'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import CharacterPreview from './CharacterPreview';
import FlagSvg from './FlagSvg';
import { Logo, ScreenShell, Section, Seg } from './ui';
import { sfx } from '@/game/client/audio';
import {
  ACCENT_COLORS, BODY_COLORS, clearScores, LocalScore, loadScores, Prefs, Profile, randomLook, randomName, SKIN_COLORS,
} from '@/game/client/storage';
import { BOTS, FaceId, FACES, HatId, HATS, LAYOUT_INFO, MODE_INFO, sanitizeName, WEAPON_ORDER, WEAPONS, GameMode, MapLayout } from '@/game/shared/types';

const HAT_NAMES: Record<HatId, string> = { none: 'Без шапки', cap: 'Кепка', helmet: 'Каска', ushanka: 'Ушанка', crown: 'Корона', horns: 'Рога', mohawk: 'Ирокез', tophat: 'Цилиндр' };
const FACE_NAMES: Record<FaceId, string> = { none: 'Обычное', visor: 'Визор', glasses: 'Очки', mask: 'Маска', mustache: 'Усы' };

// ---------- Главное меню ----------

export function MainMenu({ profile, onQuick, onSolo, onNet, onCustom, onScores, onHelp, onSettings, onControls, onExams }: {
  profile: Profile; onQuick: () => void; onSolo: () => void; onNet: () => void; onCustom: () => void; onScores: () => void; onHelp: () => void; onSettings: () => void; onControls: () => void; onExams: () => void;
}) {
  const [best, setBest] = useState<number | null>(null);
  useEffect(() => {
    const s = loadScores();
    window.setTimeout(() => setBest(s.length ? s[0].score : null), 0);
  }, []);
  const go = (fn: () => void) => () => {
    sfx.init();
    sfx.click();
    fn();
  };
  return (
    <div className="menu-bg fixed inset-0 overflow-y-auto">
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-70">
        {['ru', 'jp', 'br', 'gb', 'ca', 'se'].map((f, i) => (
          <div
            key={f}
            className="float-slow absolute w-16 overflow-hidden rounded shadow-2xl sm:w-24"
            style={{ left: `${[6, 84, 12, 72, 44, 92][i]}%`, top: `${[12, 18, 78, 82, 6, 52][i]}%`, animationDelay: `${i * 0.7}s`, ['--r' as string]: `${[-12, 9, 7, -6, 4, -10][i]}deg`, opacity: 0.35 } as CSSProperties}
          >
            <FlagSvg code={f} className="block h-auto w-full" />
          </div>
        ))}
      </div>
      <div className="menu-hero relative z-10 mx-auto grid min-h-full max-w-6xl items-center gap-6 px-5 py-8 landscape:grid-cols-[1.05fr_1fr] lg:grid-cols-[1.1fr_1fr]">
        <div className="slide-up">
          <Logo />
          <p className="menu-desc mt-4 max-w-lg text-[15px] leading-relaxed text-white/75">
            Шутер от третьего лица по локальной сети. Погиб — тяни экзаменационный билет: флаги мира, история России, гражданское право или свои экзамены.
            Ответишь быстро — выберешь любое оружие. Замешкаешься — останется только пистолет.
          </p>
          <div className="mt-6 flex max-w-md flex-col gap-3">
            <button className="btn btn-primary !py-5 text-xl" onClick={go(onQuick)}>⚡ Быстрый бой</button>
            <div className="grid grid-cols-2 gap-3">
              <button className="btn btn-cyan" onClick={go(onSolo)}>🎯 Одиночная</button>
              <button className="btn btn-cyan" onClick={go(onNet)}>🌐 По сети</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button className="btn btn-ghost !px-2 text-xs sm:text-sm" onClick={go(onCustom)}>🎨 Персонаж</button>
              <button className="btn btn-ghost !px-2 text-xs sm:text-sm" onClick={go(onControls)}>🎮 Управление</button>
              <button className="btn btn-ghost !px-2 text-xs sm:text-sm" onClick={go(onExams)}>📝 Экзамены</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button className="btn btn-ghost !px-2 text-xs sm:text-sm" onClick={go(onScores)}>🏆 Рекорды</button>
              <button className="btn btn-ghost !px-2 text-xs sm:text-sm" onClick={go(onSettings)}>⚙ Опции</button>
              <button className="btn btn-ghost !px-2 text-xs sm:text-sm" onClick={go(onHelp)}>❓ Как играть</button>
            </div>
          </div>
        </div>
        <div className="slide-up relative flex flex-col items-center" style={{ animationDelay: '0.1s' }}>
          <CharacterPreview look={profile.look} className="menu-preview h-[300px] w-full max-w-md sm:h-[440px]" />
          <button onClick={go(onCustom)} className="panel -mt-4 flex items-center gap-3 px-5 py-3 transition-transform hover:-translate-y-0.5">
            <span className="h-8 w-8 rounded-lg" style={{ background: `linear-gradient(135deg, ${profile.look.body}, ${profile.look.accent})` }} />
            <span className="text-left">
              <span className="block text-lg font-black">{profile.name}</span>
              <span className="block text-[11px] font-bold tracking-widest text-[var(--muted)] uppercase">
                {best !== null ? `Рекорд: ${best} очков` : 'Нажмите, чтобы изменить'}
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Персонаж ----------

export function CustomizeScreen({ profile, onSave, onBack }: { profile: Profile; onSave: (p: Profile) => void; onBack: () => void }) {
  const [name, setName] = useState(profile.name);
  const [look, setLook] = useState(profile.look);
  const swatch = (colors: string[], value: string, set: (c: string) => void) => (
    <div className="flex flex-wrap gap-2">
      {colors.map((c) => (
        <button
          key={c}
          onClick={() => { sfx.init(); sfx.click(); set(c); }}
          className={`h-9 w-9 rounded-xl border-2 transition-transform hover:scale-110 ${value === c ? 'scale-110 border-white shadow-[0_0_0_3px_rgba(255,197,61,0.7)]' : 'border-white/20'}`}
          style={{ background: c }}
          aria-label={c}
        />
      ))}
    </div>
  );
  return (
    <ScreenShell title="Персонаж" onBack={onBack} wide>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="panel flex flex-col items-center p-4">
          <CharacterPreview look={look} className="h-[320px] w-full sm:h-[420px]" />
          <div className="mt-2 text-2xl font-black">{sanitizeName(name)}</div>
        </div>
        <div className="panel space-y-5 p-5">
          <Section label="Ник" right={<button className="text-xs font-bold text-[var(--accent2)]" onClick={() => setName(randomName())}>🎲 случайный</button>}>
            <input
              className="w-full rounded-xl border-2 border-[var(--line)] bg-black/30 px-3 py-2 text-lg font-bold text-white outline-none focus:border-[var(--accent)]"
              maxLength={16}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Section>
          <Section label="Форма">{swatch(BODY_COLORS, look.body, (c) => setLook({ ...look, body: c }))}</Section>
          <Section label="Акцент">{swatch(ACCENT_COLORS, look.accent, (c) => setLook({ ...look, accent: c }))}</Section>
          <Section label="Кожа">{swatch(SKIN_COLORS, look.skin, (c) => setLook({ ...look, skin: c }))}</Section>
          <Section label="Головной убор">
            <Seg value={look.hat} onChange={(v: HatId) => setLook({ ...look, hat: v })} options={HATS.map((h) => ({ value: h, label: HAT_NAMES[h] }))} />
          </Section>
          <Section label="Лицо">
            <Seg value={look.face} onChange={(v: FaceId) => setLook({ ...look, face: v })} options={FACES.map((f) => ({ value: f, label: FACE_NAMES[f] }))} />
          </Section>
          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <button className="btn btn-ghost flex-1" onClick={() => { sfx.click(); setLook(randomLook()); }}>🎲 Случайный образ</button>
            <button className="btn btn-primary flex-1" onClick={() => { sfx.click(); onSave({ name: sanitizeName(name), look }); }}>✓ Сохранить</button>
          </div>
        </div>
      </div>
    </ScreenShell>
  );
}

// ---------- Рекорды ----------

interface ServerScore { id: number; name: string; score: number; kills: number; botKills: number; deaths: number; correct: number; answered: number; mode: string; layout: string; online: boolean; createdAt: string }

export function HighScoresScreen({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<'local' | 'server'>('local');
  const [local, setLocal] = useState<LocalScore[]>([]);
  const [server, setServer] = useState<ServerScore[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    window.setTimeout(() => setLocal(loadScores()), 0);
    fetch('/api/scores', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: { scores?: ServerScore[]; error?: string }) => {
        setServer(j.scores ?? []);
        if (j.error) setErr(j.error);
      })
      .catch(() => {
        setServer([]);
        setErr('Сервер недоступен');
      });
  }, []);
  const modeName = (m: string) => MODE_INFO[m as GameMode]?.short ?? m;
  const layoutName = (l: string) => LAYOUT_INFO[l as MapLayout]?.title ?? l;
  const rows = tab === 'local'
    ? local.map((s, i) => ({ key: `${s.date}-${i}`, name: s.name, score: s.score, kills: s.kills, bk: s.bk, ok: s.ok, qa: s.qa, mode: modeName(s.mode), map: layoutName(s.layout), date: new Date(s.date) }))
    : (server ?? []).map((s) => ({ key: String(s.id), name: s.name, score: s.score, kills: s.kills, bk: s.botKills, ok: s.correct, qa: s.answered, mode: modeName(s.mode), map: layoutName(s.layout), date: new Date(s.createdAt) }));
  return (
    <ScreenShell title="Рекорды" onBack={onBack}>
      <div className="mb-4 max-w-md">
        <Seg value={tab} onChange={setTab} options={[{ value: 'local', label: '📱 На этом устройстве' }, { value: 'server', label: '🌐 Зал славы сервера' }]} />
      </div>
      <div className="panel overflow-x-auto p-4">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-white/55">
            <div className="text-4xl">🏆</div>
            <div className="mt-2 font-bold">{tab === 'server' && server === null ? 'Загрузка…' : 'Рекордов пока нет — самое время их поставить!'}</div>
            {tab === 'server' && err && <div className="mt-1 text-xs">{err}</div>}
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[10px] tracking-widest text-white/50 uppercase">
                <th className="py-2 pr-2">#</th><th className="pr-2">Игрок</th><th className="pr-2 text-right">Очки</th><th className="pr-2 text-right">Игроки</th>
                <th className="pr-2 text-right">Боты</th><th className="pr-2 text-right">Билеты</th><th className="pr-2">Режим</th><th className="hidden pr-2 sm:table-cell">Карта</th><th className="hidden sm:table-cell">Дата</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key} className="border-t border-white/10">
                  <td className="py-2 pr-2 font-black">{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td>
                  <td className="pr-2 font-bold">{r.name}</td>
                  <td className="pr-2 text-right font-black text-[var(--accent)] tabular-nums">{r.score}</td>
                  <td className="pr-2 text-right tabular-nums">{r.kills}</td>
                  <td className="pr-2 text-right tabular-nums">{r.bk}</td>
                  <td className="pr-2 text-right tabular-nums">{r.ok}/{r.qa}</td>
                  <td className="pr-2">{r.mode}</td>
                  <td className="hidden pr-2 sm:table-cell">{r.map}</td>
                  <td className="hidden text-white/50 sm:table-cell">{r.date.toLocaleDateString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {tab === 'local' && local.length > 0 && (
        <button className="btn btn-ghost mt-4" onClick={() => { clearScores(); setLocal([]); }}>Очистить локальные рекорды</button>
      )}
    </ScreenShell>
  );
}

// ---------- Как играть ----------

export function HelpScreen({ onBack }: { onBack: () => void }) {
  return (
    <ScreenShell title="Как играть" onBack={onBack}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel p-5">
          <div className="label">Суть</div>
          <p className="mt-2 text-sm leading-relaxed text-white/80">
            Сражайтесь с ботами и друзьями. После смерти выпадает случайный экзаменационный билет — на ответ <b>30 секунд</b>.
            Каждые 5 секунд самое сильное оружие блокируется. Неверный ответ или истёкшее время — остаётся только пистолет.
            Верный ответ приносит от 50 до 100 очков в зависимости от скорости.
          </p>
          <div className="mt-4 label">Очки</div>
          <ul className="mt-2 space-y-1 text-sm text-white/80">
            <li>• {BOTS.grunt.name} — {BOTS.grunt.pts}, {BOTS.runner.name} — {BOTS.runner.pts}, {BOTS.heavy.name} — {BOTS.heavy.pts}</li>
            <li>• Игрок — 150, выстрел в голову — +25</li>
            <li>• Двойное/тройное убийство — бонус +50 за каждое</li>
            <li>• Аптечки на карте восстанавливают 50 ОЗ</li>
          </ul>
        </div>
        <div className="panel p-5">
          <div className="label">Управление: клавиатура и мышь</div>
          <p className="mt-1 text-xs text-white/50">Все клавиши переназначаются в меню «🎮 Управление».</p>
          <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {[['WASD', 'движение'], ['Мышь', 'обзор'], ['ЛКМ', 'огонь'], ['ПКМ', 'прицеливание'], ['Shift', 'бег'], ['Пробел', 'прыжок'], ['R', 'перезарядка'], ['Q / колесо / 1-2', 'смена оружия'], ['Tab', 'таблица'], ['Esc / P', 'пауза'], ['1–4', 'ответ на билет'], ['1–7 / Enter', 'выбор оружия']].map(([k, v]) => (
              <div key={k} className="contents">
                <span className="rounded bg-white/10 px-2 py-0.5 text-center font-mono font-bold text-[var(--accent)]">{k}</span>
                <span className="text-white/80">{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 label">Сенсорный экран</div>
          <p className="mt-2 text-sm text-white/80">Играйте в альбомном режиме. Левая половина — джойстик (дожмите вперёд для бега), правая — обзор. «ОГОНЬ» стреляет и одновременно наводит камеру. Кнопки можно перетаскивать и настраивать в меню «🎮 Управление». Есть лёгкая помощь в прицеливании.</p>
          <div className="mt-4 label">Свои экзамены</div>
          <p className="mt-2 text-sm text-white/80">В меню «📝 Экзамены» создайте свои билеты и поделитесь ими: QR-код + короткий код для игроков на том же сервере, текстовый код для мессенджера или файл.</p>
        </div>
        <div className="panel p-5 md:col-span-2">
          <div className="label">Арсенал (от сильного к слабому)</div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {WEAPON_ORDER.map((w, i) => (
              <div key={w} className="rounded-xl border border-[var(--line)] bg-black/25 p-3" style={{ boxShadow: `inset 0 -3px 0 ${WEAPONS[w].color}` }}>
                <div className="font-black">{WEAPONS[w].name}</div>
                <div className="text-[11px] text-white/55">{WEAPONS[w].kind}</div>
                <div className="mt-1 text-[11px] text-white/70">{WEAPONS[w].desc}</div>
                <div className="mt-2 text-[10px] font-bold text-[var(--accent)]">{i === 6 ? 'Всегда доступен' : `Ответ быстрее ${(i + 1) * 5} с`}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScreenShell>
  );
}

// ---------- Настройки ----------

export function SettingsScreen({ prefs, onChange, onBack }: { prefs: Prefs; onChange: (p: Prefs) => void; onBack: () => void }) {
  return (
    <ScreenShell title="Настройки" onBack={onBack}>
      <div className="panel max-w-xl space-y-5 p-5">
        <Section label={`Чувствительность: ${prefs.sens.toFixed(1)}`}>
          <input className="w-full" type="range" min={0.2} max={3} step={0.1} value={prefs.sens} onChange={(e) => onChange({ ...prefs, sens: Number(e.target.value) })} />
        </Section>
        <Section label={`Громкость: ${Math.round(prefs.volume * 100)}%`}>
          <input className="w-full" type="range" min={0} max={1} step={0.05} value={prefs.volume} onChange={(e) => { onChange({ ...prefs, volume: Number(e.target.value) }); sfx.init(); sfx.setVolume(Number(e.target.value)); sfx.click(); }} />
        </Section>
        <Section label="Качество графики">
          <Seg value={prefs.quality} onChange={(v: 'low' | 'high') => onChange({ ...prefs, quality: v })} options={[{ value: 'low', label: 'Быстрое (мобильные)' }, { value: 'high', label: 'Высокое (тени, сглаживание)' }]} />
          <div className="text-xs text-white/50">Применяется со следующего матча.</div>
        </Section>
        <Section label="Автокачество (держать 60 FPS)">
          <Seg value={prefs.autoQuality ? 'on' : 'off'} onChange={(v) => onChange({ ...prefs, autoQuality: v === 'on' })} options={[{ value: 'on', label: 'Вкл' }, { value: 'off', label: 'Выкл' }]} />
          <div className="text-xs text-white/50">При просадках игра сама снизит чёткость картинки.</div>
        </Section>
        <Section label="Счётчик FPS">
          <Seg value={prefs.showFps ? 'on' : 'off'} onChange={(v) => onChange({ ...prefs, showFps: v === 'on' })} options={[{ value: 'off', label: 'Скрыт' }, { value: 'on', label: 'Показать' }]} />
        </Section>
        <Section label="Тряска экрана">
          <Seg value={prefs.shake ? 'on' : 'off'} onChange={(v) => onChange({ ...prefs, shake: v === 'on' })} options={[{ value: 'on', label: 'Сочная' }, { value: 'off', label: 'Минимальная' }]} />
        </Section>
        <Section label="Инверсия оси Y">
          <Seg value={prefs.invertY ? 'on' : 'off'} onChange={(v) => onChange({ ...prefs, invertY: v === 'on' })} options={[{ value: 'off', label: 'Выкл' }, { value: 'on', label: 'Вкл' }]} />
        </Section>
      </div>
    </ScreenShell>
  );
}

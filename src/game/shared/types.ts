// Общие типы и константы для сервера и клиента («Билет на респаун»)

export type GameMode = 'pvp' | 'coop' | 'ffa';
export type TopicId = 'flags' | 'history' | 'law' | 'custom';
export type MapLayout = 'arena' | 'city' | 'warehouse' | 'ruins';
export type MapTheme = 'day' | 'sunset' | 'night' | 'snow';
export type MapSize = 's' | 'm' | 'l';
export type Density = 'low' | 'mid' | 'high';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type WeaponId = 'rpg' | 'lmg' | 'sniper' | 'rifle' | 'shotgun' | 'smg' | 'pistol';
export type ShotWeapon = WeaponId | 'bot';
export type HatId = 'none' | 'cap' | 'helmet' | 'ushanka' | 'crown' | 'horns' | 'mohawk' | 'tophat';
export type FaceId = 'none' | 'visor' | 'glasses' | 'mask' | 'mustache';
export type BotKind = 'grunt' | 'runner' | 'heavy';
export type Vec3T = [number, number, number];
export type MatchState = 'lobby' | 'countdown' | 'playing' | 'over';

export interface Look {
  body: string;
  accent: string;
  skin: string;
  hat: HatId;
  face: FaceId;
}

export interface MapConfig {
  layout: MapLayout;
  size: MapSize;
  density: Density;
  theme: MapTheme;
  seed: number;
}

/** Один вопрос пользовательского экзамена. Правильный ответ — options[answer]. */
export interface CustomQuestion {
  q: string;
  options: [string, string, string, string];
  answer: number;
  note: string;
}

/** Пользовательский пакет вопросов («свой экзамен»). */
export interface ExamPack {
  id: string;
  title: string;
  questions: CustomQuestion[];
}

export const MAX_PACKS = 4;
export const MAX_PACK_QUESTIONS = 30;

export interface MatchSettings {
  mode: GameMode;
  map: MapConfig;
  topics: TopicId[];
  packs: ExamPack[];
  bots: number;
  difficulty: Difficulty;
  duration: number; // секунды
}

// ---------- Справочники ----------

export const MODE_INFO: Record<GameMode, { title: string; short: string; desc: string; pvp: boolean; bots: boolean; icon: string }> = {
  pvp: { title: 'Друг против друга', short: 'Дуэль', desc: 'Только игроки. Убивайте друг друга — побеждает лучший.', pvp: true, bots: false, icon: '⚔️' },
  coop: { title: 'Все против ботов', short: 'Кооператив', desc: 'Команда против волн ботов. Огонь по своим отключён.', pvp: false, bots: true, icon: '🤝' },
  ffa: { title: 'Все против всех и ботов', short: 'Хаос', desc: 'Боты повсюду, союзников нет. Стреляйте во всех.', pvp: true, bots: true, icon: '💥' },
};

export const LAYOUT_INFO: Record<MapLayout, { title: string; desc: string; icon: string }> = {
  arena: { title: 'Арена', desc: 'Помост в центре, колонны и укрытия', icon: '🏟️' },
  city: { title: 'Кварталы', desc: 'Дома, улицы и брошенные машины', icon: '🏙️' },
  warehouse: { title: 'Склад', desc: 'Контейнеры и узкие проходы', icon: '📦' },
  ruins: { title: 'Руины', desc: 'Лабиринт полуразрушенных стен', icon: '🧱' },
};

export const THEME_INFO: Record<MapTheme, { title: string; icon: string }> = {
  day: { title: 'День', icon: '☀️' },
  sunset: { title: 'Закат', icon: '🌇' },
  night: { title: 'Ночь', icon: '🌙' },
  snow: { title: 'Зима', icon: '❄️' },
};

export const SIZE_INFO: Record<MapSize, { title: string; half: number }> = {
  s: { title: 'Малая', half: 22 },
  m: { title: 'Средняя', half: 30 },
  l: { title: 'Большая', half: 38 },
};

export const DENSITY_INFO: Record<Density, { title: string; k: number }> = {
  low: { title: 'Мало укрытий', k: 0.6 },
  mid: { title: 'Норма', k: 1 },
  high: { title: 'Много укрытий', k: 1.45 },
};

export const DIFF_INFO: Record<Difficulty, { title: string; acc: number; dmg: number; react: number; hp: number }> = {
  easy: { title: 'Лёгкие', acc: 0.65, dmg: 0.6, react: 0.95, hp: 0.85 },
  normal: { title: 'Обычные', acc: 1, dmg: 1, react: 0.6, hp: 1 },
  hard: { title: 'Жёсткие', acc: 1.3, dmg: 1.35, react: 0.35, hp: 1.2 },
};

export const TOPIC_INFO: Record<TopicId, { title: string; short: string; count: number; icon: string; color: string }> = {
  flags: { title: 'Флаги мира', short: 'Флаги', count: 20, icon: '🏳️', color: '#36d6ff' },
  history: { title: 'История России', short: 'История', count: 20, icon: '📜', color: '#ffc53d' },
  law: { title: 'Гражданское право', short: 'Право', count: 30, icon: '⚖️', color: '#ff5c8a' },
  custom: { title: 'Свои экзамены', short: 'Свои', count: 0, icon: '📝', color: '#7dff5a' },
};

export const DURATIONS = [120, 180, 300, 480, 600];

// ---------- Оружие ----------

export interface WeaponDef {
  id: WeaponId;
  name: string;
  kind: string;
  dmg: number;
  pellets: number;
  rate: number; // сек между выстрелами
  mag: number;
  reload: number;
  spread: number;
  adsSpread: number;
  range: number;
  auto: boolean;
  headMul: number;
  recoil: number;
  speedMul: number;
  zoom: number;
  shake: number;
  splash: number;
  color: string;
  desc: string;
  power: number; // 1..5 для интерфейса
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  rpg: { id: 'rpg', name: 'РПГ-7', kind: 'Гранатомёт', dmg: 130, pellets: 1, rate: 1.1, mag: 1, reload: 1.6, spread: 0.01, adsSpread: 0.004, range: 90, auto: false, headMul: 1, recoil: 0.09, speedMul: 0.9, zoom: 1.4, shake: 0.6, splash: 4.8, color: '#ff5a36', desc: 'Ракета с уроном по площади', power: 5 },
  lmg: { id: 'lmg', name: 'ПКМ', kind: 'Пулемёт', dmg: 17, pellets: 1, rate: 0.075, mag: 100, reload: 3.0, spread: 0.036, adsSpread: 0.017, range: 70, auto: true, headMul: 1.8, recoil: 0.012, speedMul: 0.86, zoom: 1.35, shake: 0.16, splash: 0, color: '#ffb020', desc: 'Лента на 100 патронов', power: 5 },
  sniper: { id: 'sniper', name: 'СВД', kind: 'Снайперская винтовка', dmg: 95, pellets: 1, rate: 0.9, mag: 5, reload: 2.1, spread: 0.03, adsSpread: 0.0012, range: 160, auto: false, headMul: 2.2, recoil: 0.07, speedMul: 0.95, zoom: 3.2, shake: 0.36, splash: 0, color: '#36c2ff', desc: 'Выстрел в голову — наповал', power: 4 },
  rifle: { id: 'rifle', name: 'АК-74', kind: 'Автомат', dmg: 21, pellets: 1, rate: 0.1, mag: 30, reload: 1.7, spread: 0.022, adsSpread: 0.007, range: 90, auto: true, headMul: 2, recoil: 0.014, speedMul: 1, zoom: 1.5, shake: 0.14, splash: 0, color: '#7dff5a', desc: 'Надёжный и универсальный', power: 4 },
  shotgun: { id: 'shotgun', name: 'Сайга-12', kind: 'Дробовик', dmg: 13, pellets: 9, rate: 0.62, mag: 8, reload: 1.9, spread: 0.085, adsSpread: 0.06, range: 28, auto: false, headMul: 1.5, recoil: 0.06, speedMul: 1.02, zoom: 1.2, shake: 0.32, splash: 0, color: '#ff7ad9', desc: 'Сокрушительный вблизи', power: 3 },
  smg: { id: 'smg', name: 'ПП-19 «Бизон»', kind: 'Пистолет-пулемёт', dmg: 13, pellets: 1, rate: 0.068, mag: 44, reload: 1.5, spread: 0.034, adsSpread: 0.02, range: 50, auto: true, headMul: 1.7, recoil: 0.009, speedMul: 1.1, zoom: 1.25, shake: 0.1, splash: 0, color: '#b889ff', desc: 'Скорострельный, быстрый бег', power: 2 },
  pistol: { id: 'pistol', name: 'ПМ', kind: 'Пистолет', dmg: 24, pellets: 1, rate: 0.2, mag: 12, reload: 1.1, spread: 0.014, adsSpread: 0.006, range: 60, auto: false, headMul: 2, recoil: 0.03, speedMul: 1.1, zoom: 1.3, shake: 0.12, splash: 0, color: '#d8d8d8', desc: 'Всегда с тобой', power: 1 },
};

/** От самого сильного к самому слабому. Чем дольше ответ — тем больше оружия слева блокируется. */
export const WEAPON_ORDER: WeaponId[] = ['rpg', 'lmg', 'sniper', 'rifle', 'shotgun', 'smg', 'pistol'];
export const EXAM_TIME = 30;

export function unlockedCount(correct: boolean, t: number): number {
  if (!correct) return 1;
  return Math.max(2, WEAPON_ORDER.length - Math.floor(Math.max(0, t) / 5));
}

export function availableWeapons(correct: boolean, t: number): WeaponId[] {
  const n = unlockedCount(correct, t);
  return WEAPON_ORDER.slice(WEAPON_ORDER.length - n);
}

export function answerPoints(correct: boolean, t: number): number {
  if (!correct) return 0;
  const tt = Math.min(EXAM_TIME, Math.max(0, t));
  return 50 + Math.round(50 * (1 - tt / EXAM_TIME));
}

// ---------- Боты ----------

export interface BotDef {
  name: string;
  hp: number;
  speed: number;
  radius: number;
  range: number;
  pref: number;
  rate: number;
  dmg: number;
  acc: number;
  scale: number;
  pts: number;
  look: Look;
}

export const BOTS: Record<BotKind, BotDef> = {
  grunt: { name: 'Двоечник', hp: 60, speed: 3.7, radius: 0.45, range: 32, pref: 11, rate: 0.62, dmg: 8, acc: 0.5, scale: 1, pts: 100, look: { body: '#5d6b4a', accent: '#2f3526', skin: '#c9b79c', hat: 'cap', face: 'none' } },
  runner: { name: 'Прогульщик', hp: 40, speed: 6.2, radius: 0.4, range: 1.9, pref: 1.2, rate: 0.7, dmg: 17, acc: 1, scale: 0.88, pts: 120, look: { body: '#d9480f', accent: '#1f1f1f', skin: '#c9b79c', hat: 'mohawk', face: 'mask' } },
  heavy: { name: 'Завуч', hp: 240, speed: 2.5, radius: 0.6, range: 34, pref: 15, rate: 0.12, dmg: 5, acc: 0.38, scale: 1.3, pts: 250, look: { body: '#3b2f4a', accent: '#8a1c2b', skin: '#b8a58a', hat: 'tophat', face: 'glasses' } },
};

// ---------- Физика/хитбоксы ----------

export const PLAYER_RADIUS = 0.42;
export const STEP_UP = 0.4;
export const MAX_HP = 100;
export const SHIELD_MS = 2200;
export const MAX_PLAYERS = 8;
export const HB = { bodyR: 0.42, bodyH: 1.42, headY: 1.66, headR: 0.27 };

export const MV_MOVE = 1;
export const MV_SPRINT = 2;
export const MV_GROUND = 4;
export const MV_FIRE = 8;
export const MV_ADS = 16;
export const MV_RELOAD = 32;
export const MV_BACK = 64;

// ---------- Сетевые структуры ----------

export interface PlayerNet {
  id: string;
  name: string;
  look: Look;
  x: number;
  y: number;
  z: number;
  ry: number;
  rx: number;
  mv: number;
  hp: number;
  st: 'alive' | 'dead';
  life: number;
  w: WeaponId;
  sh: number;
  score: number;
  kills: number;
  bk: number;
  deaths: number;
  ok: number;
  qa: number;
  streak: number;
}

export interface BotNet {
  id: string;
  k: BotKind;
  x: number;
  y: number;
  z: number;
  ry: number;
  hp: number;
  mhp: number;
  st: 'alive' | 'dead';
  mv: number;
}

export interface PackNet {
  id: number;
  x: number;
  z: number;
  on: boolean;
}

export interface MatchNet {
  state: MatchState;
  settings: MatchSettings;
  startsAt: number;
  endsAt: number;
  hostId: string;
  wave: number;
  teamBotKills: number;
  roomName: string;
  code: string;
  matchId: number;
}

export type SimEventBody =
  | { t: 'shot'; by: string; w: ShotWeapon; f: Vec3T; to: Vec3T }
  | { t: 'hit'; by: string; target: string; dmg: number; head: boolean; x: number; y: number; z: number; sp: number; ax: number; az: number }
  | { t: 'kill'; by: string; victim: string; w: ShotWeapon; head: boolean; byName: string; victimName: string; bot: boolean; pts: number; streak: number }
  | { t: 'boom'; by: string; x: number; y: number; z: number; r: number }
  | { t: 'melee'; by: string; target: string }
  | { t: 'pickup'; id: number; by: string }
  | { t: 'spawn'; id: string; x: number; y: number; z: number }
  | { t: 'msg'; text: string; kind: 'info' | 'join' | 'leave' | 'wave' }
  | { t: 'answer'; by: string; name: string; ok: boolean; pts: number }
  | { t: 'score'; id: string; pts: number; reason: string };

export type SimEvent = SimEventBody & { seq: number };

export interface Snapshot {
  now: number;
  seq: number;
  you: string;
  match: MatchNet;
  players: PlayerNet[];
  bots: BotNet[];
  packs: PackNet[];
  events: SimEvent[];
}

export type ClientAction =
  | { a: 'shot'; w: WeaponId; f: Vec3T; to: Vec3T }
  | { a: 'hit'; target: string; dmg: number; head: boolean; w: WeaponId; x: number; y: number; z: number }
  | { a: 'boom'; w: WeaponId; x: number; y: number; z: number }
  | { a: 'respawn'; w: WeaponId; x: number; y: number; z: number; correct: boolean; time: number; topic: TopicId };

export interface ClientUpdate {
  x: number;
  y: number;
  z: number;
  ry: number;
  rx: number;
  mv: number;
  w: WeaponId;
  actions: ClientAction[];
}

export interface RoomSummary {
  code: string;
  name: string;
  mode: GameMode;
  players: number;
  max: number;
  state: MatchState;
  layout: MapLayout;
  theme: MapTheme;
  host: string;
}

// ---------- Значения по умолчанию и валидация ----------

export const DEFAULT_LOOK: Look = { body: '#3a86ff', accent: '#1d3557', skin: '#f1c27d', hat: 'ushanka', face: 'none' };

export const DEFAULT_SETTINGS: MatchSettings = {
  mode: 'coop',
  map: { layout: 'arena', size: 'm', density: 'mid', theme: 'day', seed: 1337 },
  topics: ['flags', 'history', 'law'],
  packs: [],
  bots: 8,
  difficulty: 'normal',
  duration: 180,
};

const HEX = /^#[0-9a-fA-F]{6}$/;

function pick<T extends string>(v: unknown, allowed: readonly T[], def: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : def;
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

export const HATS: HatId[] = ['none', 'cap', 'helmet', 'ushanka', 'crown', 'horns', 'mohawk', 'tophat'];
export const FACES: FaceId[] = ['none', 'visor', 'glasses', 'mask', 'mustache'];

export function sanitizeLook(v: unknown): Look {
  const o = obj(v);
  const col = (x: unknown, d: string) => (typeof x === 'string' && HEX.test(x) ? x : d);
  return {
    body: col(o.body, DEFAULT_LOOK.body),
    accent: col(o.accent, DEFAULT_LOOK.accent),
    skin: col(o.skin, DEFAULT_LOOK.skin),
    hat: pick(o.hat, HATS, 'none'),
    face: pick(o.face, FACES, 'none'),
  };
}

export function sanitizeName(v: unknown): string {
  const s = typeof v === 'string' ? v : '';
  const clean = Array.from(s)
    .filter((c) => c.charCodeAt(0) >= 32 && c !== '<' && c !== '>')
    .join('')
    .trim()
    .slice(0, 16);
  return clean || 'Игрок';
}

function sanitizeText(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return Array.from(v)
    .filter((c) => c.charCodeAt(0) >= 32 && c !== '<' && c !== '>')
    .join('')
    .trim()
    .slice(0, max);
}

export function sanitizeExamPack(v: unknown): ExamPack | null {
  const o = obj(v);
  const title = sanitizeText(o.title, 60);
  const raw = Array.isArray(o.questions) ? o.questions.slice(0, MAX_PACK_QUESTIONS) : [];
  const questions: CustomQuestion[] = [];
  for (const r of raw) {
    const q = obj(r);
    const text = sanitizeText(q.q, 300);
    const optsRaw = Array.isArray(q.options) ? q.options : [];
    if (!text || optsRaw.length < 4) continue;
    const options = [0, 1, 2, 3].map((i) => sanitizeText(optsRaw[i], 150)) as [string, string, string, string];
    if (options.some((s) => !s)) continue;
    let answer = Math.round(Number(q.answer));
    if (!Number.isFinite(answer)) answer = 0;
    answer = Math.max(0, Math.min(3, answer));
    questions.push({ q: text, options, answer, note: sanitizeText(q.note, 300) });
  }
  if (!title || questions.length < 2) return null;
  const id = sanitizeText(o.id, 24) || `pack${Math.abs(title.length * 31 + questions.length * 7) % 100000}`;
  return { id, title, questions };
}

export function sanitizePacks(v: unknown): ExamPack[] {
  if (!Array.isArray(v)) return [];
  const out: ExamPack[] = [];
  for (const r of v.slice(0, MAX_PACKS)) {
    const p = sanitizeExamPack(r);
    if (p) out.push(p);
  }
  return out;
}

export function sanitizeSettings(v: unknown): MatchSettings {
  const o = obj(v);
  const m = obj(o.map);
  const topicsRaw = Array.isArray(o.topics) ? o.topics : [];
  const topics = (['flags', 'history', 'law'] as TopicId[]).filter((t) => topicsRaw.includes(t));
  const packs = sanitizePacks(o.packs);
  const seedNum = Number(m.seed);
  const botsNum = Math.round(Number(o.bots));
  const durNum = Math.round(Number(o.duration));
  return {
    mode: pick(o.mode, ['pvp', 'coop', 'ffa'] as const, 'coop'),
    map: {
      layout: pick(m.layout, ['arena', 'city', 'warehouse', 'ruins'] as const, 'arena'),
      size: pick(m.size, ['s', 'm', 'l'] as const, 'm'),
      density: pick(m.density, ['low', 'mid', 'high'] as const, 'mid'),
      theme: pick(m.theme, ['day', 'sunset', 'night', 'snow'] as const, 'day'),
      seed: Number.isFinite(seedNum) ? Math.abs(Math.floor(seedNum)) % 1000000 : 1337,
    },
    topics: topics.length || packs.length ? topics : ['flags', 'history', 'law'],
    packs,
    bots: Number.isFinite(botsNum) ? Math.max(0, Math.min(16, botsNum)) : 8,
    difficulty: pick(o.difficulty, ['easy', 'normal', 'hard'] as const, 'normal'),
    duration: Number.isFinite(durNum) ? Math.max(60, Math.min(900, durNum)) : 180,
  };
}

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

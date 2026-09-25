import { DEFAULT_LOOK, DEFAULT_SETTINGS, ExamPack, FACES, GameMode, HATS, Look, MapLayout, MatchSettings, sanitizeExamPack, sanitizeLook, sanitizeName, sanitizeSettings } from '../shared/types';

export interface Profile {
  name: string;
  look: Look;
}

export interface Prefs {
  sens: number;
  volume: number;
  quality: 'low' | 'high';
  invertY: boolean;
  shake: boolean;
  autoQuality: boolean;
  showFps: boolean;
}

export interface LocalScore {
  name: string;
  score: number;
  kills: number;
  bk: number;
  deaths: number;
  ok: number;
  qa: number;
  mode: GameMode;
  layout: MapLayout;
  online: boolean;
  date: number;
}

// ---------- Раскладка сенсорных кнопок ----------

export type TouchBtnId = 'fire' | 'jump' | 'ads' | 'reload' | 'swap' | 'pause' | 'board';

export interface TouchBtnPos {
  /** доля ширины экрана от левого края (0..1) — центр кнопки */
  x: number;
  /** доля высоты экрана от верхнего края (0..1) — центр кнопки */
  y: number;
}

export interface TouchLayout {
  scale: number;
  opacity: number;
  leftHanded: boolean;
  joySize: number;
  positions: Record<TouchBtnId, TouchBtnPos>;
}

export const TOUCH_BTN_INFO: Record<TouchBtnId, { title: string; base: number }> = {
  fire: { title: 'Огонь', base: 96 },
  jump: { title: 'Прыжок', base: 64 },
  ads: { title: 'Прицел', base: 56 },
  reload: { title: 'Перезарядка', base: 48 },
  swap: { title: 'Смена оружия', base: 48 },
  pause: { title: 'Пауза', base: 44 },
  board: { title: 'Счёт', base: 44 },
};

export const TOUCH_BTNS: TouchBtnId[] = ['fire', 'jump', 'ads', 'reload', 'swap', 'pause', 'board'];

export function defaultTouchLayout(): TouchLayout {
  return {
    scale: 1,
    opacity: 1,
    leftHanded: false,
    joySize: 1,
    positions: {
      fire: { x: 0.885, y: 0.74 },
      jump: { x: 0.76, y: 0.85 },
      ads: { x: 0.91, y: 0.42 },
      reload: { x: 0.79, y: 0.6 },
      swap: { x: 0.7, y: 0.6 },
      pause: { x: 0.055, y: 0.09 },
      board: { x: 0.125, y: 0.09 },
    },
  };
}

// ---------- Бинды клавиатуры ----------

export type KeyAction = 'forward' | 'back' | 'left' | 'right' | 'jump' | 'reload' | 'swap' | 'sprint' | 'slot1' | 'slot2';

export type KeyBindings = Record<KeyAction, string>;

export const KEY_ACTION_INFO: Record<KeyAction, string> = {
  forward: 'Вперёд',
  back: 'Назад',
  left: 'Влево',
  right: 'Вправо',
  jump: 'Прыжок',
  reload: 'Перезарядка',
  swap: 'Смена оружия',
  sprint: 'Бег',
  slot1: 'Оружие 1',
  slot2: 'Пистолет',
};

export const KEY_ACTIONS: KeyAction[] = ['forward', 'back', 'left', 'right', 'jump', 'reload', 'swap', 'sprint', 'slot1', 'slot2'];

export function defaultKeys(): KeyBindings {
  return { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', reload: 'KeyR', swap: 'KeyQ', sprint: 'ShiftLeft', slot1: 'Digit1', slot2: 'Digit2' };
}

export function prettyKey(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map: Record<string, string> = {
    Space: 'Пробел', ShiftLeft: 'Л. Shift', ShiftRight: 'П. Shift', ControlLeft: 'Л. Ctrl', ControlRight: 'П. Ctrl',
    AltLeft: 'Л. Alt', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Tab: 'Tab', Escape: 'Esc',
    CapsLock: 'Caps', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'",
    Backquote: '`', Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
  };
  return map[code] ?? code;
}

// ---------- Свои экзамены (локальные) ----------

export interface CustomExam extends ExamPack {
  author: string;
  updatedAt: number;
  origin: 'local' | 'server' | 'code' | 'file';
  code?: string;
}

const K = {
  profile: 'bnr.profile.v1',
  prefs: 'bnr.prefs.v1',
  scores: 'bnr.scores.v1',
  settings: 'bnr.settings.v1',
  tips: 'bnr.tips.v1',
  touch: 'bnr.touch.v2',
  keys: 'bnr.keys.v1',
  exams: 'bnr.exams.v1',
  portrait: 'bnr.portrait.v1',
};

export const BODY_COLORS = ['#e63946', '#f4a261', '#2a9d8f', '#3a86ff', '#8338ec', '#ff006e', '#ffbe0b', '#2b2d42', '#6a994e', '#f1faee'];
export const ACCENT_COLORS = ['#1d3557', '#264653', '#2b2d42', '#6d597a', '#b5838d', '#e9c46a', '#fb8500', '#023047', '#ffffff', '#111111'];
export const SKIN_COLORS = ['#ffdbac', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#a8e6cf', '#b4a7d6'];

const NAMES = ['Отличник', 'Зубрила', 'Шпаргалка', 'Студент', 'Абитуриент', 'Первокурсник', 'Хвостист', 'Аспирант'];

export function randomName(): string {
  return `${NAMES[Math.floor(Math.random() * NAMES.length)]}${Math.floor(10 + Math.random() * 90)}`;
}

export function randomLook(): Look {
  const r = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  return { body: r(BODY_COLORS), accent: r(ACCENT_COLORS), skin: r(SKIN_COLORS), hat: r(HATS), face: r(FACES) };
}

function read(key: string): unknown {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    // хранилище недоступно
  }
}

export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia === 'function') {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const fine = window.matchMedia('(any-pointer: fine)').matches;
    return coarse && !fine ? true : coarse && navigator.maxTouchPoints > 1 && !window.matchMedia('(hover: hover)').matches;
  }
  return 'ontouchstart' in window;
}

export function isPortraitPhone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerHeight > window.innerWidth * 1.05;
}

/** Попробовать зафиксировать альбомную ориентацию (работает в Chrome Android в fullscreen). */
export function tryLockLandscape(): boolean {
  try {
    const o = screen.orientation as unknown as { lock?: (s: string) => Promise<void> };
    if (o?.lock) {
      o.lock('landscape').catch(() => {});
      return true;
    }
  } catch {
    // не поддерживается
  }
  return false;
}

export function unlockOrientation() {
  try {
    (screen.orientation as unknown as { unlock?: () => void }).unlock?.();
  } catch {
    // игнор
  }
}

export function portraitDismissed(): boolean {
  return !!read(K.portrait);
}

export function dismissPortrait() {
  write(K.portrait, true);
}

export function loadProfile(): Profile {
  const v = read(K.profile) as Partial<Profile> | null;
  if (!v) return { name: randomName(), look: { ...DEFAULT_LOOK } };
  return { name: sanitizeName(v.name), look: sanitizeLook(v.look) };
}

export function saveProfile(p: Profile) {
  write(K.profile, p);
}

export function defaultPrefs(): Prefs {
  const touch = isTouchDevice();
  return { sens: 1, volume: 0.7, quality: touch ? 'low' : 'high', invertY: false, shake: true, autoQuality: true, showFps: false };
}

export function loadPrefs(): Prefs {
  const d = defaultPrefs();
  const v = read(K.prefs) as Partial<Prefs> | null;
  if (!v) return d;
  return {
    sens: typeof v.sens === 'number' ? Math.min(3, Math.max(0.2, v.sens)) : d.sens,
    volume: typeof v.volume === 'number' ? Math.min(1, Math.max(0, v.volume)) : d.volume,
    quality: v.quality === 'low' || v.quality === 'high' ? v.quality : d.quality,
    invertY: !!v.invertY,
    shake: v.shake !== false,
    autoQuality: v.autoQuality !== false,
    showFps: !!v.showFps,
  };
}

export function savePrefs(p: Prefs) {
  write(K.prefs, p);
}

export function loadTouchLayout(): TouchLayout {
  const d = defaultTouchLayout();
  const v = read(K.touch) as Partial<TouchLayout> | null;
  if (!v) return d;
  const pos = { ...d.positions };
  const raw = (v.positions ?? {}) as Partial<Record<TouchBtnId, Partial<TouchBtnPos>>>;
  for (const b of TOUCH_BTNS) {
    const r = raw[b];
    if (r && typeof r.x === 'number' && typeof r.y === 'number') {
      pos[b] = { x: Math.min(0.97, Math.max(0.03, r.x)), y: Math.min(0.97, Math.max(0.03, r.y)) };
    }
  }
  return {
    scale: typeof v.scale === 'number' ? Math.min(1.6, Math.max(0.6, v.scale)) : 1,
    opacity: typeof v.opacity === 'number' ? Math.min(1, Math.max(0.25, v.opacity)) : 1,
    leftHanded: !!v.leftHanded,
    joySize: typeof v.joySize === 'number' ? Math.min(1.6, Math.max(0.7, v.joySize)) : 1,
    positions: pos,
  };
}

export function saveTouchLayout(l: TouchLayout) {
  write(K.touch, l);
}

export function loadKeys(): KeyBindings {
  const d = defaultKeys();
  const v = read(K.keys) as Partial<KeyBindings> | null;
  if (!v) return d;
  const out = { ...d };
  for (const a of KEY_ACTIONS) {
    if (typeof v[a] === 'string' && v[a].length >= 2 && v[a].length <= 20) out[a] = v[a] as string;
  }
  return out;
}

export function saveKeys(k: KeyBindings) {
  write(K.keys, k);
}

export function loadSettings(): MatchSettings {
  const v = read(K.settings);
  return v ? sanitizeSettings(v) : { ...DEFAULT_SETTINGS, map: { ...DEFAULT_SETTINGS.map }, packs: [] };
}

export function saveSettings(s: MatchSettings) {
  write(K.settings, s);
}

export function loadScores(): LocalScore[] {
  const v = read(K.scores);
  return Array.isArray(v) ? (v as LocalScore[]).filter((s) => s && typeof s.score === 'number').slice(0, 10) : [];
}

/** Добавить результат; вернуть место (1..10) или 0, если не попал в таблицу. */
export function addScore(s: LocalScore): number {
  const list = loadScores();
  list.push(s);
  list.sort((a, b) => b.score - a.score);
  const top = list.slice(0, 10);
  write(K.scores, top);
  const idx = top.indexOf(s);
  return idx >= 0 ? idx + 1 : 0;
}

export function clearScores() {
  write(K.scores, []);
}

export function tipsSeen(): boolean {
  return !!read(K.tips);
}

export function markTipsSeen() {
  write(K.tips, true);
}

// ---------- Свои экзамены ----------

export function newExamId(): string {
  return `ex${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export function loadCustomExams(): CustomExam[] {
  const v = read(K.exams);
  if (!Array.isArray(v)) return [];
  const out: CustomExam[] = [];
  for (const r of v.slice(0, 30)) {
    if (!r || typeof r !== 'object') continue;
    const p = sanitizeExamPack(r);
    if (!p) continue;
    const o = r as Record<string, unknown>;
    out.push({
      ...p,
      id: p.id,
      author: typeof o.author === 'string' ? o.author.slice(0, 32) : '',
      updatedAt: typeof o.updatedAt === 'number' ? o.updatedAt : Date.now(),
      origin: o.origin === 'server' || o.origin === 'code' || o.origin === 'file' ? o.origin : 'local',
      code: typeof o.code === 'string' ? o.code.slice(0, 8).toUpperCase() : undefined,
    });
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveCustomExam(e: CustomExam) {
  const list = loadCustomExams().filter((x) => x.id !== e.id);
  list.unshift({ ...e, updatedAt: Date.now() });
  write(K.exams, list.slice(0, 30));
}

export function deleteCustomExam(id: string) {
  write(
    K.exams,
    loadCustomExams().filter((x) => x.id !== id),
  );
}

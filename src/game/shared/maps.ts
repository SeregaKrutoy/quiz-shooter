// Детерминированная генерация карт + коллизии, лучи и навигация ботов.
import { DENSITY_INFO, HB, ItemKind, MapConfig, SIZE_INFO } from './types';

export type BoxKind = 'wall' | 'crate' | 'container' | 'pillar' | 'building' | 'barrier' | 'platform' | 'car' | 'rock';

export interface Box {
  x: number;
  z: number;
  hw: number;
  hd: number;
  h: number;
  kind: BoxKind;
  c: number;
}

export interface NavGrid {
  n: number;
  half: number;
  blocked: Uint8Array;
}

export interface ItemSpot {
  x: number;
  z: number;
  k: ItemKind;
}

export interface MapData {
  key: string;
  half: number;
  boxes: Box[];
  spawns: [number, number][];
  items: ItemSpot[];
  nav: NavGrid;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mapKey(cfg: MapConfig): string {
  return `${cfg.layout}|${cfg.size}|${cfg.density}|${cfg.seed}`;
}

class Builder {
  boxes: Box[] = [];
  constructor(public half: number, public rnd: () => number) {}
  r(a: number, b: number) {
    return a + (b - a) * this.rnd();
  }
  ri(a: number, b: number) {
    return Math.min(b, Math.floor(this.r(a, b + 1)));
  }
  snap(v: number) {
    return Math.round(v * 2) / 2;
  }
  overlaps(x: number, z: number, hw: number, hd: number, margin: number, extra: Box[] = []): boolean {
    const test = (b: Box) =>
      Math.abs(x - b.x) < hw + b.hw + margin && Math.abs(z - b.z) < hd + b.hd + margin;
    for (const b of this.boxes) if (test(b)) return true;
    for (const b of extra) if (test(b)) return true;
    return false;
  }
  add(b: Box) {
    this.boxes.push(b);
  }
  /** Добавить с поворотной симметрией 4-го порядка. margin < 0 — без проверки пересечений. */
  addRot(b: Box, margin = -1): boolean {
    const variants: Box[] = [
      { ...b },
      { ...b, x: -b.z, z: b.x, hw: b.hd, hd: b.hw },
      { ...b, x: -b.x, z: -b.z },
      { ...b, x: b.z, z: -b.x, hw: b.hd, hd: b.hw },
    ];
    const uniq: Box[] = [];
    for (const v of variants) {
      if (uniq.some((u) => Math.abs(u.x - v.x) < 0.01 && Math.abs(u.z - v.z) < 0.01 && Math.abs(u.hw - v.hw) < 0.01)) continue;
      uniq.push(v);
    }
    if (margin >= 0) {
      for (let i = 0; i < uniq.length; i++) {
        const v = uniq[i];
        if (Math.abs(v.x) + v.hw > this.half - 0.5 || Math.abs(v.z) + v.hd > this.half - 0.5) return false;
        if (this.overlaps(v.x, v.z, v.hw, v.hd, margin, uniq.slice(0, i))) return false;
      }
    }
    for (const v of uniq) this.boxes.push(v);
    return true;
  }
}

function genArena(B: Builder, k: number) {
  const H = B.half;
  B.add({ x: 0, z: 0, hw: 3, hd: 3, h: 1.2, kind: 'platform', c: 0 });
  B.addRot({ x: 0, z: 4.1, hw: 1.3, hd: 1.1, h: 0.6, kind: 'crate', c: 1 });
  const R = H * 0.5;
  B.addRot({ x: R, z: 0, hw: 0.9, hd: 0.9, h: 4.5, kind: 'pillar', c: 0 });
  B.addRot({ x: B.snap(R * 0.72), z: B.snap(R * 0.72), hw: 0.9, hd: 0.9, h: 4.5, kind: 'pillar', c: 1 });
  const nWalls = Math.round((2 + H / 10) * k);
  for (let i = 0, tries = 0; i < nWalls && tries < 120; tries++) {
    const long = B.snap(B.r(1.5, 3.5));
    const horiz = B.rnd() < 0.5;
    const hw = horiz ? long : 0.35;
    const hd = horiz ? 0.35 : long;
    const x = B.snap(B.r(1, H - 3));
    const z = B.snap(B.r(0, H - 3));
    if (Math.abs(x) < 6.5 && Math.abs(z) < 6.5) continue;
    const h = B.rnd() < 0.55 ? 1.2 : 2.4;
    if (B.addRot({ x, z, hw, hd, h, kind: 'wall', c: B.ri(0, 2) }, 1.8)) i++;
  }
  const nCrates = Math.round((3 + H / 8) * k);
  for (let i = 0, tries = 0; i < nCrates && tries < 120; tries++) {
    const x = B.snap(B.r(1, H - 2.5));
    const z = B.snap(B.r(0, H - 2.5));
    if (Math.abs(x) < 6 && Math.abs(z) < 6) continue;
    const roll = B.rnd();
    const h = roll < 0.6 ? 1.2 : roll < 0.8 ? 2.4 : 0.6;
    if (B.addRot({ x, z, hw: 0.6, hd: 0.6, h, kind: 'crate', c: B.ri(0, 2) }, 1.6)) {
      i++;
      if (B.rnd() < 0.35) B.addRot({ x: x + 1.2, z, hw: 0.6, hd: 0.6, h: 0.6, kind: 'crate', c: 1 }, 0.05);
    }
  }
}

function genCity(B: Builder, k: number) {
  const H = B.half;
  const C = 12;
  const n = Math.max(3, Math.floor((2 * H) / C));
  const off = (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = (i - off) * C;
      const z = (j - off) * C;
      if (Math.abs(x) < 0.01 && Math.abs(z) < 0.01) {
        B.add({ x: 0, z: 0, hw: 2.4, hd: 2.4, h: 0.6, kind: 'platform', c: 0 });
        B.add({ x: 0, z: 0, hw: 0.6, hd: 0.6, h: 2.6, kind: 'pillar', c: 1 });
        continue;
      }
      if (!(x > 0.01 && z >= -0.01)) continue;
      const r = B.rnd();
      if (r < 0.55 * Math.min(1.25, k)) {
        const hw = B.snap(B.r(2.4, 3.6));
        const hd = B.snap(B.r(2.4, 3.6));
        B.addRot({ x, z, hw, hd, h: B.snap(B.r(4, 9.5)), kind: 'building', c: B.ri(0, 2) });
        if (B.rnd() < 0.5) {
          B.addRot({ x: x + hw + 0.9, z: z - hd + 1.2, hw: 0.9, hd: 1.2, h: 2.4, kind: 'building', c: B.ri(0, 2) });
        }
      } else if (r < 0.85) {
        const cnt = B.ri(2, 4);
        for (let q = 0; q < cnt; q++) {
          const cx = x + B.snap(B.r(-3, 3));
          const cz = z + B.snap(B.r(-3, 3));
          B.addRot({ x: cx, z: cz, hw: 0.6, hd: 0.6, h: B.rnd() < 0.7 ? 1.2 : 2.4, kind: 'crate', c: B.ri(0, 2) }, 1.3);
        }
      } else {
        B.addRot({ x: x - 1.5, z, hw: 0.3, hd: 3, h: 1.2, kind: 'barrier', c: 0 });
        B.addRot({ x: x + 1, z: z + 2.7, hw: 2.2, hd: 0.3, h: 1.2, kind: 'barrier', c: 0 });
      }
    }
  }
  const streets: number[] = [];
  for (let i = 0; i < n - 1; i++) streets.push((i - off + 0.5) * C);
  const cars = Math.round(n * 1.6 * k);
  for (let q = 0, tries = 0; q < cars && tries < 80; tries++) {
    const s = streets[B.ri(0, streets.length - 1)];
    if (s === undefined) break;
    const along = B.snap(B.r(-H + 4, H - 4));
    const lane = B.rnd() < 0.5 ? -1.1 : 1.1;
    if (B.addRot({ x: s + lane, z: along, hw: 0.95, hd: 2.1, h: 1.3, kind: 'car', c: B.ri(0, 3) }, 1.2)) q++;
  }
}

function genWarehouse(B: Builder, k: number) {
  const H = B.half;
  B.add({ x: 0, z: 0, hw: 1.2, hd: 1.2, h: 1.2, kind: 'crate', c: 0 });
  B.addRot({ x: 2.4, z: 0, hw: 0.6, hd: 0.6, h: 0.6, kind: 'crate', c: 1 });
  for (let x = 6; x < H - 4; x += 6.5) {
    let z = B.r(1, 4);
    while (z < H - 8) {
      const len = 3;
      if (B.rnd() < 0.75 * Math.min(1.25, k)) {
        const stacked = B.rnd() < 0.35;
        B.addRot({ x, z: B.snap(z + len), hw: 1.25, hd: len, h: stacked ? 5.2 : 2.6, kind: 'container', c: B.ri(0, 3) }, 0.8);
      }
      z += len * 2 + B.r(2.5, 5);
    }
  }
  const nCrates = Math.round((4 + H / 6) * k);
  for (let i = 0, tries = 0; i < nCrates && tries < 120; tries++) {
    const x = B.snap(B.r(1, H - 2.5));
    const z = B.snap(B.r(0, H - 2.5));
    if (Math.abs(x) < 4 && Math.abs(z) < 4) continue;
    const h = B.rnd() < 0.65 ? 1.2 : 0.6;
    if (B.addRot({ x, z, hw: 0.6, hd: 0.6, h, kind: 'crate', c: B.ri(0, 2) }, 1.5)) i++;
  }
}

function genRuins(B: Builder, k: number) {
  const H = B.half;
  const C = 6;
  B.add({ x: 0, z: 0, hw: 1.5, hd: 1.5, h: 3, kind: 'rock', c: 0 });
  const heights = [1.2, 2.2, 3.2];
  for (let gx = 0; gx <= H - 4; gx += C) {
    for (let gz = 0; gz <= H - 4; gz += C) {
      if (gx + C <= H - 2 && B.rnd() < 0.34 * k && !(gz === 0 && gx === 0)) {
        const h = heights[B.ri(0, 2)];
        if (B.rnd() < 0.6) {
          const gap = B.snap(B.r(1.5, 4.5));
          const a0 = gx, a1 = gx + gap - 1, b0 = gx + gap + 1, b1 = gx + C;
          if (a1 - a0 > 0.6) B.addRot({ x: (a0 + a1) / 2, z: gz, hw: (a1 - a0) / 2, hd: 0.35, h, kind: 'wall', c: 1 }, 0.05);
          if (b1 - b0 > 0.6) B.addRot({ x: (b0 + b1) / 2, z: gz, hw: (b1 - b0) / 2, hd: 0.35, h: heights[B.ri(0, 2)], kind: 'wall', c: 1 }, 0.05);
        } else {
          B.addRot({ x: gx + C / 2, z: gz, hw: C / 2 - 0.4, hd: 0.35, h, kind: 'wall', c: 1 }, 0.05);
        }
      }
      if (gz + C <= H - 2 && B.rnd() < 0.3 * k && gx > 0) {
        const h = heights[B.ri(0, 2)];
        B.addRot({ x: gx, z: gz + C / 2, hw: 0.35, hd: C / 2 - 1.2, h, kind: 'wall', c: 2 }, 0.05);
      }
      if (B.rnd() < 0.22 && gx > 0) {
        B.addRot({ x: gx + 3, z: gz + 3, hw: 0.5, hd: 0.5, h: B.snap(B.r(0.6, 3.5)), kind: 'rock', c: 0 }, 1.2);
      }
    }
  }
}

function genFort(B: Builder, k: number) {
  const H = B.half;
  const R = Math.min(9, H * 0.36);
  // цитадель: стены с проходами по центру каждой стороны
  const seg = (R - 1.6) / 2;
  B.addRot({ x: -(1.6 + seg), z: -R, hw: seg, hd: 0.35, h: 3, kind: 'wall', c: 1 });
  B.addRot({ x: 1.6 + seg, z: -R, hw: seg, hd: 0.35, h: 3, kind: 'wall', c: 1 });
  B.addRot({ x: R, z: R, hw: 1.1, hd: 1.1, h: 5.5, kind: 'pillar', c: 0 });
  B.add({ x: 0, z: 0, hw: 2.6, hd: 2.6, h: 1.2, kind: 'platform', c: 0 });
  B.addRot({ x: 0, z: R * 0.55, hw: 1.2, hd: 0.6, h: 0.6, kind: 'crate', c: 1 }, 0.05);
  // внешнее кольцо укрытий с башнями
  const R2 = Math.min(H - 4, R + 9 + (H - 22) * 0.35);
  const len = (R2 - 3.5) / 2;
  if (len > 2.6) {
    // сегменты от 3.5 до R2-4.5: широкие проходы у башен и по центру
    B.addRot({ x: -(3.5 + len) + 2.25, z: -R2, hw: len - 2.25, hd: 0.4, h: 1.2, kind: 'barrier', c: 0 });
    B.addRot({ x: 3.5 + len - 2.25, z: -R2, hw: len - 2.25, hd: 0.4, h: 2.4, kind: 'wall', c: 2 });
  }
  B.addRot({ x: R2, z: R2, hw: 1.6, hd: 1.6, h: 4, kind: 'building', c: B.ri(0, 2) });
  // камни между кольцами и снаружи
  const n = Math.round((4 + H / 6) * k);
  for (let i = 0, tries = 0; i < n && tries < 150; tries++) {
    const x = B.snap(B.r(1, H - 2.5)), z = B.snap(B.r(0, H - 2.5));
    const d = Math.max(Math.abs(x), Math.abs(z));
    if (d < R + 2 || Math.abs(d - R2) < 2.5 || d > H - 3.5) continue;
    const roll = B.rnd();
    if (B.addRot({ x, z, hw: roll < 0.5 ? 0.6 : 1, hd: roll < 0.5 ? 0.6 : 0.8, h: roll < 0.3 ? 0.6 : roll < 0.75 ? 1.2 : 2.6, kind: roll < 0.5 ? 'crate' : 'rock', c: B.ri(0, 2) }, 1.6)) i++;
  }
}

function genSchool(B: Builder, k: number) {
  const H = B.half;
  const W = 9, gap = 3, door = 1.2, t = 0.3;
  const n = Math.max(1, Math.floor((H - 3) / (W + gap)));
  // актовый зал в центре
  B.add({ x: 0, z: 0, hw: 2.2, hd: 1.4, h: 0.6, kind: 'platform', c: 0 });
  B.addRot({ x: 2.6, z: 0, hw: 0.45, hd: 0.45, h: 3.5, kind: 'pillar', c: 0 }, 0.05);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x0 = gap + i * (W + gap), z0 = gap + j * (W + gap);
      const x1 = x0 + W, z1 = z0 + W;
      if (x1 > H - 1 || z1 > H - 1) continue;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const segW = (W / 2 - door) / 2;
      const h = 3;
      const c = B.ri(0, 2);
      // четыре стены с дверью посередине (кроме случайной глухой)
      const solidSide = B.ri(0, 5); // 0..3 — глухая стена, 4-5 — все с дверями
      const wall = (side: number, a: number, b: number, fixed: number, horiz: boolean) => {
        if (solidSide === side) {
          const m = (a + b) / 2, half = (b - a) / 2;
          B.addRot(horiz ? { x: m, z: fixed, hw: half, hd: t, h, kind: 'wall', c } : { x: fixed, z: m, hw: t, hd: half, h, kind: 'wall', c });
          return;
        }
        const mid = (a + b) / 2;
        for (const [p0, p1] of [[a, mid - door], [mid + door, b]]) {
          const m = (p0 + p1) / 2;
          B.addRot(horiz ? { x: m, z: fixed, hw: segW, hd: t, h, kind: 'wall', c } : { x: fixed, z: m, hw: t, hd: segW, h, kind: 'wall', c });
        }
      };
      wall(0, x0, x1, z0, true);
      wall(1, x0, x1, z1, true);
      wall(2, z0, z1, x0, false);
      wall(3, z0, z1, x1, false);
      // парты рядами
      const rows = k > 1.2 ? 3 : 2, cols = k < 0.8 ? 2 : 3;
      for (let r = 0; r < rows; r++) {
        for (let q = 0; q < cols; q++) {
          const dx = cx - (cols - 1) * 1.1 + q * 2.2;
          const dz = cz - 0.6 + r * 1.9;
          B.addRot({ x: dx, z: dz, hw: 0.75, hd: 0.4, h: 0.6, kind: 'crate', c: 1 });
        }
      }
      // учительский стол
      B.addRot({ x: cx, z: z0 + 1.6, hw: 1, hd: 0.45, h: 1.2, kind: 'crate', c: 2 });
    }
  }
  // шкафчики вдоль коридоров
  const lockers = Math.round(2 * k);
  for (let q = 0, tries = 0; q < lockers && tries < 40; tries++) {
    const along = B.snap(B.r(6, H - 4));
    if (B.addRot({ x: 1.3, z: along, hw: 0.35, hd: 1.2, h: 2, kind: 'container', c: B.ri(0, 3) }, 1.5)) q++;
  }
}

function genBunker(B: Builder, k: number) {
  const H = B.half;
  const C = 8, t = 0.5, door = 1.1, h = 3.2;
  const lines: number[] = [];
  for (let v = 4; v < H - 3; v += C) lines.push(v);
  // сегменты стен между узлами решётки (квадрант x>=0, z>=0, потом симметрия)
  for (const zl of lines) {
    for (let xa = 0; xa < H - 3; xa += C) {
      const xb = Math.min(xa + C, H - 1);
      if (xb - xa < 3) continue;
      const roll = B.rnd();
      if (roll < 0.14 * (2 - k)) continue; // проём во всю стену — большой зал
      const c = B.ri(0, 2);
      if (roll < 0.8) {
        const mid = (xa + xb) / 2;
        for (const [p0, p1] of [[xa, mid - door], [mid + door, xb]]) {
          if (p1 - p0 < 0.8) continue;
          B.addRot({ x: (p0 + p1) / 2, z: zl, hw: (p1 - p0) / 2, hd: t, h, kind: 'wall', c });
        }
      } else {
        B.addRot({ x: (xa + xb) / 2, z: zl, hw: (xb - xa) / 2, hd: t, h, kind: 'wall', c });
      }
    }
  }
  // колонны на узлах, ящики в комнатах
  for (const xl of lines) {
    for (const zl of lines) {
      if (B.rnd() < 0.5) B.addRot({ x: xl, z: zl, hw: 0.7, hd: 0.7, h, kind: 'pillar', c: 1 });
    }
  }
  const crates = Math.round((3 + H / 5) * k);
  for (let i = 0, tries = 0; i < crates && tries < 150; tries++) {
    const x = B.snap(B.r(1, H - 2.5)), z = B.snap(B.r(0, H - 2.5));
    if (B.addRot({ x, z, hw: 0.6, hd: 0.6, h: B.rnd() < 0.6 ? 1.2 : 0.6, kind: 'crate', c: B.ri(0, 2) }, 1.2)) i++;
  }
  B.add({ x: 0, z: 0, hw: 1.2, hd: 1.2, h: 0.6, kind: 'platform', c: 0 });
}

function buildNav(half: number, boxes: Box[]): NavGrid {
  const n = Math.ceil(half * 2);
  const blocked = new Uint8Array(n * n);
  const r = 0.45;
  for (const b of boxes) {
    const x0 = Math.max(0, Math.floor(b.x - b.hw - r + half));
    const x1 = Math.min(n - 1, Math.floor(b.x + b.hw + r + half - 1e-6));
    const z0 = Math.max(0, Math.floor(b.z - b.hd - r + half));
    const z1 = Math.min(n - 1, Math.floor(b.z + b.hd + r + half - 1e-6));
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) blocked[z * n + x] = 1;
  }
  // края карты
  for (let i = 0; i < n; i++) {
    blocked[i] = 1;
    blocked[(n - 1) * n + i] = 1;
    blocked[i * n] = 1;
    blocked[i * n + n - 1] = 1;
  }
  return { n, half, blocked };
}

export function cellOf(nav: NavGrid, x: number, z: number): number {
  const n = nav.n;
  const cx = Math.max(0, Math.min(n - 1, Math.floor(x + nav.half)));
  const cz = Math.max(0, Math.min(n - 1, Math.floor(z + nav.half)));
  return cz * n + cx;
}

export function cellCenter(nav: NavGrid, c: number): [number, number] {
  return [(c % nav.n) - nav.half + 0.5, Math.floor(c / nav.n) - nav.half + 0.5];
}

function nearestFree(nav: NavGrid, c: number): number {
  if (!nav.blocked[c]) return c;
  const n = nav.n;
  const cx = c % n, cz = Math.floor(c / n);
  for (let r = 1; r <= 4; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx, z = cz + dz;
        if (x < 0 || z < 0 || x >= n || z >= n) continue;
        const i = z * n + x;
        if (!nav.blocked[i]) return i;
      }
    }
  }
  return c;
}

/** BFS-поле расстояний до точки (x,z). 65535 — недостижимо. */
export function flowField(nav: NavGrid, x: number, z: number): Uint16Array {
  const n = nav.n;
  const N = n * n;
  const dist = new Uint16Array(N).fill(65535);
  const q = new Int32Array(N);
  const start = nearestFree(nav, cellOf(nav, x, z));
  let head = 0, tail = 0;
  dist[start] = 0;
  q[tail++] = start;
  while (head < tail) {
    const c = q[head++];
    const d = dist[c] + 1;
    const cx = c % n;
    if (cx > 0 && !nav.blocked[c - 1] && dist[c - 1] > d) { dist[c - 1] = d; q[tail++] = c - 1; }
    if (cx < n - 1 && !nav.blocked[c + 1] && dist[c + 1] > d) { dist[c + 1] = d; q[tail++] = c + 1; }
    if (c >= n && !nav.blocked[c - n] && dist[c - n] > d) { dist[c - n] = d; q[tail++] = c - n; }
    if (c < N - n && !nav.blocked[c + n] && dist[c + n] > d) { dist[c + n] = d; q[tail++] = c + n; }
  }
  return dist;
}

function bestNeighbor(nav: NavGrid, field: Uint16Array, c: number): number {
  const n = nav.n;
  const cx = c % n, cz = Math.floor(c / n);
  let best = c;
  let bd = field[c];
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const x = cx + dx, z = cz + dz;
      if (x < 0 || z < 0 || x >= n || z >= n) continue;
      const i = z * n + x;
      if (nav.blocked[i]) continue;
      if (dx && dz && (nav.blocked[cz * n + x] || nav.blocked[z * n + cx])) continue;
      const d = field[i] + (dx && dz ? 0.4 : 0);
      if (d < bd) { bd = d; best = i; }
    }
  }
  return best;
}

/** Следующая точка пути по полю (с упреждением на 2 клетки). */
export function nextStep(nav: NavGrid, field: Uint16Array, x: number, z: number): [number, number] | null {
  const c = cellOf(nav, x, z);
  if (field[c] === 0) return null;
  const a = bestNeighbor(nav, field, c);
  if (a === c) return null;
  const b = bestNeighbor(nav, field, a);
  return cellCenter(nav, b);
}

// ---------- Коллизии ----------

export function collideCircle(map: MapData, pos: { x: number; z: number }, y: number, r: number, stepUp: number): boolean {
  let hitAny = false;
  for (let iter = 0; iter < 3; iter++) {
    let any = false;
    for (const b of map.boxes) {
      if (b.h <= y + stepUp) continue;
      const minX = b.x - b.hw, maxX = b.x + b.hw, minZ = b.z - b.hd, maxZ = b.z + b.hd;
      if (pos.x < minX - r || pos.x > maxX + r || pos.z < minZ - r || pos.z > maxZ + r) continue;
      const cx = pos.x < minX ? minX : pos.x > maxX ? maxX : pos.x;
      const cz = pos.z < minZ ? minZ : pos.z > maxZ ? maxZ : pos.z;
      const dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        const p = (r - d) / d;
        pos.x += dx * p;
        pos.z += dz * p;
      } else {
        const pl = pos.x - minX, pr = maxX - pos.x, pb = pos.z - minZ, pf = maxZ - pos.z;
        const m = Math.min(pl, pr, pb, pf);
        if (m === pl) pos.x = minX - r;
        else if (m === pr) pos.x = maxX + r;
        else if (m === pb) pos.z = minZ - r;
        else pos.z = maxZ + r;
      }
      any = true;
      hitAny = true;
    }
    if (!any) break;
  }
  const lim = map.half - r;
  if (pos.x < -lim) pos.x = -lim;
  if (pos.x > lim) pos.x = lim;
  if (pos.z < -lim) pos.z = -lim;
  if (pos.z > lim) pos.z = lim;
  return hitAny;
}

export function groundAt(map: MapData, x: number, z: number, r: number, y: number, stepUp: number): number {
  let g = 0;
  const rr = r * 0.55;
  for (const b of map.boxes) {
    if (b.h > y + stepUp || b.h <= g) continue;
    if (Math.abs(x - b.x) < b.hw + rr && Math.abs(z - b.z) < b.hd + rr) g = b.h;
  }
  return g;
}

// ---------- Лучи ----------

export const hitNormal = { x: 0, y: 1, z: 0 };

/** Пересечение луча (dir — единичный) с коробками и землёй. Возвращает t (<= maxT). */
export function rayBoxes(map: MapData, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxT: number): number {
  let best = maxT;
  hitNormal.x = 0; hitNormal.y = 0; hitNormal.z = 0;
  if (dy < -1e-6) {
    const t = -oy / dy;
    if (t >= 0 && t < best) {
      best = t;
      hitNormal.y = 1;
    }
  }
  for (const b of map.boxes) {
    let tmin = 0;
    let tmax = best;
    let axis = -1;
    let sign = 0;
    // X
    if (Math.abs(dx) < 1e-9) {
      if (ox < b.x - b.hw || ox > b.x + b.hw) continue;
    } else {
      const inv = 1 / dx;
      let t1 = (b.x - b.hw - ox) * inv;
      let t2 = (b.x + b.hw - ox) * inv;
      let s = -1;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s = 1; }
      if (t1 > tmin) { tmin = t1; axis = 0; sign = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) continue;
    }
    // Y
    if (Math.abs(dy) < 1e-9) {
      if (oy < 0 || oy > b.h) continue;
    } else {
      const inv = 1 / dy;
      let t1 = (0 - oy) * inv;
      let t2 = (b.h - oy) * inv;
      let s = -1;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s = 1; }
      if (t1 > tmin) { tmin = t1; axis = 1; sign = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) continue;
    }
    // Z
    if (Math.abs(dz) < 1e-9) {
      if (oz < b.z - b.hd || oz > b.z + b.hd) continue;
    } else {
      const inv = 1 / dz;
      let t1 = (b.z - b.hd - oz) * inv;
      let t2 = (b.z + b.hd - oz) * inv;
      let s = -1;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s = 1; }
      if (t1 > tmin) { tmin = t1; axis = 2; sign = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) continue;
    }
    if (tmin < best) {
      best = tmin;
      hitNormal.x = axis === 0 ? sign : 0;
      hitNormal.y = axis === 1 ? sign : 0;
      hitNormal.z = axis === 2 ? sign : 0;
    }
  }
  return best;
}

export function losClear(map: MapData, ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (d < 0.01) return true;
  const t = rayBoxes(map, ax, ay, az, dx / d, dy / d, dz / d, d);
  return t >= d - 0.05;
}

/** Луч против хитбокса персонажа (цилиндр тела + сфера головы). */
export function rayHitbox(
  ox: number, oy: number, oz: number, dx: number, dy: number, dz: number,
  cx: number, cy: number, cz: number, scale: number, maxT: number,
): { t: number; head: boolean } | null {
  let bestT = maxT;
  let head = false;
  let found = false;
  // голова
  const hy = cy + HB.headY * scale;
  const hr = HB.headR * scale;
  const lx = ox - cx, ly = oy - hy, lz = oz - cz;
  const b = lx * dx + ly * dy + lz * dz;
  const c = lx * lx + ly * ly + lz * lz - hr * hr;
  const disc = b * b - c;
  if (disc >= 0) {
    const t = -b - Math.sqrt(disc);
    if (t > 0 && t < bestT) { bestT = t; head = true; found = true; }
  }
  // тело
  const br = HB.bodyR * scale;
  const top = cy + HB.bodyH * scale;
  const a2 = dx * dx + dz * dz;
  const px = ox - cx, pz = oz - cz;
  if (a2 > 1e-9) {
    const b2 = px * dx + pz * dz;
    const c2 = px * px + pz * pz - br * br;
    const disc2 = b2 * b2 - a2 * c2;
    if (disc2 >= 0) {
      const t = (-b2 - Math.sqrt(disc2)) / a2;
      const y = oy + dy * t;
      if (t > 0 && t < bestT && y >= cy && y <= top) { bestT = t; head = false; found = true; }
    }
  }
  if (dy < -1e-6) {
    const t = (top - oy) / dy;
    if (t > 0 && t < bestT) {
      const qx = px + dx * t, qz = pz + dz * t;
      if (qx * qx + qz * qz <= br * br) { bestT = t; head = false; found = true; }
    }
  }
  return found ? { t: bestT, head } : null;
}

// ---------- Генерация ----------

function clearance(boxes: Box[], x: number, z: number): number {
  let m = Infinity;
  for (const b of boxes) {
    const cx = Math.max(b.x - b.hw, Math.min(x, b.x + b.hw));
    const cz = Math.max(b.z - b.hd, Math.min(z, b.z + b.hd));
    const d = Math.hypot(x - cx, z - cz);
    if (d < m) m = d;
  }
  return m;
}

const cache = new Map<string, MapData>();

export function buildMap(cfg: MapConfig): MapData {
  const key = mapKey(cfg);
  const hit = cache.get(key);
  if (hit) return hit;
  const half = SIZE_INFO[cfg.size].half;
  const k = DENSITY_INFO[cfg.density].k;
  let inner: Box[] = [];
  let boxes: Box[] = [];
  let nav: NavGrid = { n: 1, half, blocked: new Uint8Array(1) };
  let label = new Int32Array(1);
  let bestLabel = -1;
  // если карта распалась на изолированные куски — пробуем следующий внутренний сид (детерминированно)
  for (let attempt = 0; attempt < 6; attempt++) {
    const rnd = mulberry32(cfg.seed * 7919 + cfg.layout.length * 104729 + half + attempt * 65537);
    const B = new Builder(half, rnd);
    if (cfg.layout === 'arena') genArena(B, k);
    else if (cfg.layout === 'city') genCity(B, k);
    else if (cfg.layout === 'warehouse') genWarehouse(B, k);
    else if (cfg.layout === 'fort') genFort(B, k);
    else if (cfg.layout === 'school') genSchool(B, k);
    else if (cfg.layout === 'bunker') genBunker(B, k);
    else genRuins(B, k);
    inner = B.boxes.slice();
    // периметр
    B.addRot({ x: 0, z: -(half + 0.5), hw: half + 1, hd: 0.5, h: 4, kind: 'wall', c: 0 });
    boxes = B.boxes;
    nav = buildNav(half, boxes);

    // самая большая связная область проходимых клеток
    const N = nav.n * nav.n;
    label = new Int32Array(N).fill(-1);
    const queue = new Int32Array(N);
    let bestSize = 0;
    let free = 0;
    let lab = 0;
    bestLabel = -1;
    for (let i = 0; i < N; i++) {
      if (nav.blocked[i]) continue;
      free++;
      if (label[i] >= 0) continue;
      let head = 0, tail = 0, size = 0;
      queue[tail++] = i;
      label[i] = lab;
      while (head < tail) {
        const c = queue[head++];
        size++;
        const cx = c % nav.n;
        const nb = [cx > 0 ? c - 1 : -1, cx < nav.n - 1 ? c + 1 : -1, c - nav.n, c + nav.n];
        for (const q of nb) {
          if (q < 0 || q >= N || nav.blocked[q] || label[q] >= 0) continue;
          label[q] = lab;
          queue[tail++] = q;
        }
      }
      if (size > bestSize) { bestSize = size; bestLabel = lab; }
      lab++;
    }
    if (free > 0 && bestSize / free >= 0.7) break;
  }

  const collect = (minClear: number, step: number) => {
    const out: [number, number][] = [];
    // центры клеток навсетки (x.5) — тогда точка и её зеркало (-x,-z) лежат в зеркальных клетках
    for (let x = -half + 2.5; x <= half - 2.5; x += step) {
      for (let z = -half + 2.5; z <= half - 2.5; z += step) {
        const c = cellOf(nav, x, z);
        if (nav.blocked[c] || label[c] !== bestLabel) continue;
        if (clearance(inner, x, z) < minClear) continue;
        out.push([x, z]);
      }
    }
    return out;
  };
  let cands = collect(1.4, 1);
  if (cands.length < 16) cands = collect(0.9, 1);
  if (!cands.length) cands.push([half - 3, half - 3], [-half + 3, -half + 3], [half - 3, -half + 3], [-half + 3, half - 3]);

  // спавны — выборка самых удалённых точек
  const spawns: [number, number][] = [];
  let first = cands[0];
  let fd = -1;
  for (const c of cands) {
    const d = Math.abs(c[0]) + Math.abs(c[1]);
    if (d > fd) { fd = d; first = c; }
  }
  spawns.push(first);
  const minD = cands.map((c) => Math.hypot(c[0] - first[0], c[1] - first[1]));
  while (spawns.length < Math.min(16, cands.length)) {
    let bi = 0, bd = -1;
    for (let i = 0; i < cands.length; i++) if (minD[i] > bd) { bd = minD[i]; bi = i; }
    const p = cands[bi];
    spawns.push(p);
    for (let i = 0; i < cands.length; i++) {
      const d = Math.hypot(cands[i][0] - p[0], cands[i][1] - p[1]);
      if (d < minD[i]) minD[i] = d;
    }
  }

  // аптечки — симметричная четвёрка
  const target: [number, number] = [half * 0.55, half * 0.2];
  let pk = cands[0];
  let pd = Infinity;
  for (const c of cands) {
    const d = Math.hypot(c[0] - target[0], c[1] - target[1]);
    if (d < pd) { pd = d; pk = c; }
  }
  const candSet = new Set(cands.map((c) => `${c[0]},${c[1]}`));
  const inCands = (x: number, z: number) => candSet.has(`${x},${z}`);
  const items: ItemSpot[] = [];
  const rots: [number, number][] = [[pk[0], pk[1]], [-pk[1], pk[0]], [-pk[0], -pk[1]], [pk[1], -pk[0]]];
  for (const p of rots) if (inCands(p[0], p[1])) items.push({ x: p[0], z: p[1], k: 'health' });
  if (items.length < 2) {
    items.length = 0;
    for (let i = 1; i < spawns.length && items.length < 4; i += 3) items.push({ x: spawns[i][0], z: spawns[i][1], k: 'health' });
  }

  // щит, скорость, бомба — парами, симметрично через центр, подальше от спавнов и друг от друга
  const taken: [number, number][] = [...spawns, ...items.map((i) => [i.x, i.z] as [number, number])];
  const kinds: ItemKind[] = ['shield', 'speed', 'bomb'];
  const pairs = half >= 30 ? 2 : 1;
  for (let round = 0; round < pairs; round++) {
    for (const kind of kinds) {
      const farthest = (preferMirror: boolean): [number, number] | null => {
        let best: [number, number] | null = null;
        let bs = -Infinity;
        for (const c of cands) {
          if (preferMirror && !inCands(-c[0], -c[1])) continue;
          let m = Infinity;
          for (const tk of taken) m = Math.min(m, Math.hypot(c[0] - tk[0], c[1] - tk[1]));
          // предпочитаем середину карты, а не углы
          const score = m - Math.hypot(c[0], c[1]) * 0.25;
          if (score > bs) { bs = score; best = c; }
        }
        return best;
      };
      const a = farthest(true) ?? farthest(false);
      if (!a) break;
      items.push({ x: a[0], z: a[1], k: kind });
      taken.push(a);
      const mirror: [number, number] = [-a[0], -a[1]];
      const b = inCands(mirror[0], mirror[1]) ? mirror : farthest(false);
      if (b && !(b[0] === a[0] && b[1] === a[1])) {
        items.push({ x: b[0], z: b[1], k: kind });
        taken.push(b);
      }
    }
  }

  const data: MapData = { key, half, boxes, spawns, items, nav };
  cache.set(key, data);
  if (cache.size > 24) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  return data;
}

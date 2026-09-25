// Симуляция комнаты: матч, боты, урон, очки. Работает и на сервере (сеть), и в браузере (одиночная игра).
import {
  availableWeapons, answerPoints, BotKind, BotNet, BOTS, ClientAction, ClientUpdate, DIFF_INFO, EXAM_TIME, Look,
  MatchNet, MatchSettings, MatchState, MAX_HP, MAX_PLAYERS, MODE_INFO, MV_GROUND, MV_MOVE, MV_SPRINT, MV_FIRE,
  PlayerNet, RoomSummary, sanitizeSettings, SHIELD_MS, ShotWeapon, SimEvent, SimEventBody, Snapshot, Vec3T,
  WeaponId, WEAPONS,
} from './types';
import { buildMap, cellOf, collideCircle, flowField, losClear, MapData, nextStep, rayBoxes } from './maps';

const DT = 1 / 30;

export interface SimPlayer {
  id: string;
  secret: string;
  name: string;
  look: Look;
  x: number;
  y: number;
  z: number;
  ry: number;
  rx: number;
  mv: number;
  w: WeaponId;
  hp: number;
  alive: boolean;
  life: number;
  shieldUntil: number;
  score: number;
  kills: number;
  bk: number;
  deaths: number;
  ok: number;
  qa: number;
  streak: number;
  lastSeen: number;
  killTimes: number[];
  lockPosUntil: number;
}

interface SimBot {
  id: string;
  k: BotKind;
  x: number;
  y: number;
  z: number;
  ry: number;
  hp: number;
  mhp: number;
  alive: boolean;
  deadT: number;
  target: string | null;
  retarget: number;
  losT: number;
  los: boolean;
  fireCd: number;
  react: number;
  strafeT: number;
  strafe: number;
  burst: number;
  vx: number;
  vz: number;
  stuckT: number;
  lx: number;
  lz: number;
  wx: number;
  wz: number;
  mv: number;
  firingT: number;
  unstickT: number;
  ux: number;
  uz: number;
}

interface SimPack {
  id: number;
  x: number;
  z: number;
  on: boolean;
  t: number;
}

const num = (v: unknown, d = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const vec3 = (v: unknown): Vec3T => {
  const a = Array.isArray(v) ? v : [];
  return [num(a[0]), num(a[1]), num(a[2])];
};
const r2 = (v: number) => Math.round(v * 100) / 100;

export class RoomSim {
  code: string;
  name: string;
  isPublic: boolean;
  settings: MatchSettings;
  map: MapData;
  state: MatchState = 'lobby';
  startsAt = 0;
  endsAt = 0;
  matchId = 0;
  wave = 1;
  teamBotKills = 0;
  hostId = '';
  players = new Map<string, SimPlayer>();
  bots: SimBot[] = [];
  packs: SimPack[] = [];
  events: SimEvent[] = [];
  seq = 0;
  lastStep = 0;
  acc = 0;
  botSeq = 0;
  spawnCd = 0;
  emptySince = 0;
  private fields = new Map<string, { data: Uint16Array; t: number; cell: number }>();

  constructor(code: string, name: string, settings: MatchSettings, isPublic = true) {
    this.code = code;
    this.name = name;
    this.isPublic = isPublic;
    this.settings = sanitizeSettings(settings);
    this.map = buildMap(this.settings.map);
  }

  emit(e: SimEventBody) {
    this.seq++;
    this.events.push({ ...e, seq: this.seq } as SimEvent);
    if (this.events.length > 700) this.events.splice(0, this.events.length - 450);
  }

  summary(): RoomSummary {
    const host = this.players.get(this.hostId);
    return {
      code: this.code,
      name: this.name,
      mode: this.settings.mode,
      players: this.players.size,
      max: MAX_PLAYERS,
      state: this.state,
      layout: this.settings.map.layout,
      theme: this.settings.map.theme,
      host: host?.name ?? '—',
    };
  }

  // ---------- Игроки ----------

  addPlayer(id: string, secret: string, name: string, look: Look, now: number): SimPlayer | null {
    if (this.players.size >= MAX_PLAYERS) return null;
    let nm = name;
    let n = 2;
    const names = new Set([...this.players.values()].map((p) => p.name));
    while (names.has(nm)) nm = `${name} ${n++}`;
    const p: SimPlayer = {
      id, secret, name: nm, look, x: 0, y: 0, z: 0, ry: 0, rx: 0, mv: 0, w: 'rifle', hp: MAX_HP, alive: false, life: 0,
      shieldUntil: 0, score: 0, kills: 0, bk: 0, deaths: 0, ok: 0, qa: 0, streak: 0, lastSeen: now, killTimes: [], lockPosUntil: 0,
    };
    this.players.set(id, p);
    if (!this.hostId || !this.players.has(this.hostId)) this.hostId = id;
    this.emit({ t: 'msg', text: `${p.name} в игре`, kind: 'join' });
    if (this.state === 'countdown') this.spawnPlayer(p, now);
    return p;
  }

  removePlayer(id: string) {
    const p = this.players.get(id);
    if (!p) return;
    this.players.delete(id);
    this.fields.delete(id);
    this.emit({ t: 'msg', text: `${p.name} вышел`, kind: 'leave' });
    if (this.hostId === id) {
      const next = this.players.values().next().value;
      this.hostId = next ? next.id : '';
    }
    for (const b of this.bots) if (b.target === id) b.target = null;
  }

  private pickSpawn(excludeId: string): [number, number] {
    const threats: { x: number; z: number }[] = [];
    for (const p of this.players.values()) if (p.alive && p.id !== excludeId) threats.push(p);
    for (const b of this.bots) if (b.alive) threats.push(b);
    const sp = this.map.spawns;
    if (!threats.length) return sp[Math.floor(Math.random() * sp.length)];
    let best = sp[0];
    let bs = -1;
    for (const s of sp) {
      let m = Infinity;
      for (const t of threats) m = Math.min(m, Math.hypot(t.x - s[0], t.z - s[1]));
      const score = m + Math.random() * 6;
      if (score > bs) { bs = score; best = s; }
    }
    return best;
  }

  private spawnPlayer(p: SimPlayer, now: number, pos?: [number, number], serverInitiated = true) {
    const [x, z] = pos ?? this.pickSpawn(p.id);
    p.lockPosUntil = serverInitiated ? now + 450 : 0;
    p.x = x; p.z = z; p.y = 0;
    p.alive = true;
    p.hp = MAX_HP;
    p.life++;
    p.shieldUntil = now + SHIELD_MS;
    this.emit({ t: 'spawn', id: p.id, x, y: 0, z });
  }

  // ---------- Жизненный цикл матча ----------

  applySettings(s: unknown) {
    if (this.state !== 'lobby' && this.state !== 'over') return;
    this.settings = sanitizeSettings(s);
    this.map = buildMap(this.settings.map);
    this.fields.clear();
    this.bots = [];
    if (this.state === 'over') this.toLobby();
  }

  start(now: number) {
    this.state = 'countdown';
    this.startsAt = now + 3000;
    this.endsAt = this.startsAt + this.settings.duration * 1000;
    this.matchId++;
    this.wave = 1;
    this.teamBotKills = 0;
    this.bots = [];
    this.fields.clear();
    this.spawnCd = 0;
    this.packs = this.map.packs.map((p, i) => ({ id: i, x: p[0], z: p[1], on: true, t: 0 }));
    const sp = [...this.map.spawns].sort(() => Math.random() - 0.5);
    let i = 0;
    for (const p of this.players.values()) {
      p.score = 0; p.kills = 0; p.bk = 0; p.deaths = 0; p.ok = 0; p.qa = 0; p.streak = 0; p.killTimes = [];
      p.w = 'rifle';
      this.spawnPlayer(p, now, sp[i++ % sp.length]);
      p.shieldUntil = this.startsAt + 1500;
    }
    const target = this.targetBots();
    for (let b = 0; b < target; b++) this.spawnBot();
    this.emit({ t: 'msg', text: 'Приготовьтесь!', kind: 'info' });
  }

  toLobby() {
    this.state = 'lobby';
    this.bots = [];
    this.matchId++;
    for (const p of this.players.values()) p.alive = false;
  }

  private targetBots(): number {
    const mode = this.settings.mode;
    if (!MODE_INFO[mode].bots) return 0;
    if (mode === 'coop') return Math.min(24, this.settings.bots + (this.wave - 1) * 2);
    return this.settings.bots;
  }

  // ---------- Входящие обновления ----------

  applyUpdate(id: string, upd: ClientUpdate, now: number) {
    const p = this.players.get(id);
    if (!p || !upd || typeof upd !== 'object') return;
    p.lastSeen = now;
    const lim = this.map.half - 0.3;
    if (p.alive && now >= p.lockPosUntil) {
      p.x = clamp(num(upd.x, p.x), -lim, lim);
      p.y = clamp(num(upd.y, p.y), 0, 20);
      p.z = clamp(num(upd.z, p.z), -lim, lim);
      p.ry = num(upd.ry, p.ry);
      p.rx = clamp(num(upd.rx, p.rx), -1.6, 1.6);
      p.mv = num(upd.mv, 0) | 0;
      if (typeof upd.w === 'string' && upd.w in WEAPONS) p.w = upd.w;
    }
    const acts: ClientAction[] = Array.isArray(upd.actions) ? upd.actions.slice(0, 48) : [];
    const live = this.state === 'playing' || this.state === 'countdown';
    for (const a of acts) {
      if (!a || typeof a !== 'object') continue;
      if (a.a === 'shot') {
        if (p.alive && live && typeof a.w === 'string' && a.w in WEAPONS) {
          this.emit({ t: 'shot', by: id, w: a.w, f: vec3(a.f), to: vec3(a.to) });
        }
      } else if (a.a === 'hit') {
        if (p.alive && this.state === 'playing') this.handleHit(p, a, now);
      } else if (a.a === 'boom') {
        if (p.alive && this.state === 'playing') this.explode(p, num(a.x), num(a.y), num(a.z), now);
      } else if (a.a === 'respawn') {
        this.handleRespawn(p, a, now);
      }
    }
  }

  private handleHit(p: SimPlayer, a: Extract<ClientAction, { a: 'hit' }>, now: number) {
    if (typeof a.w !== 'string' || !(a.w in WEAPONS)) return;
    const wd = WEAPONS[a.w];
    const head = !!a.head;
    const max = wd.dmg * wd.pellets * (head ? wd.headMul : 1) + 1;
    const dmg = clamp(num(a.dmg), 0, max);
    if (dmg <= 0 || typeof a.target !== 'string') return;
    const mode = MODE_INFO[this.settings.mode];
    if (a.target.startsWith('b')) {
      if (!mode.bots) return;
      const b = this.bots.find((q) => q.id === a.target && q.alive);
      if (!b) return;
      this.damageBot(b, dmg, p, a.w, head, now, false, num(a.x, b.x), num(a.y, 1), num(a.z, b.z));
    } else {
      if (!mode.pvp) return;
      const t = this.players.get(a.target);
      if (!t || !t.alive || t.id === p.id || now < t.shieldUntil) return;
      this.damagePlayer(t, dmg, p.id, a.w, head, now, false, p.x, p.z);
    }
  }

  private explode(p: SimPlayer, x: number, y: number, z: number, now: number) {
    const r = WEAPONS.rpg.splash;
    const D = WEAPONS.rpg.dmg;
    this.emit({ t: 'boom', by: p.id, x, y, z, r });
    const mode = MODE_INFO[this.settings.mode];
    if (mode.bots) {
      for (const b of this.bots) {
        if (!b.alive) continue;
        const s = BOTS[b.k].scale;
        const d = Math.hypot(b.x - x, b.y + 0.9 * s - y, b.z - z);
        if (d > r + 0.4 * s) continue;
        if (!losClear(this.map, x, y + 0.1, z, b.x, b.y + 0.9 * s, b.z)) continue;
        const dmg = D * (1 - 0.65 * clamp(d / r, 0, 1));
        this.damageBot(b, dmg, p, 'rpg', false, now, true, b.x, b.y + 1, b.z);
      }
    }
    if (mode.pvp) {
      for (const t of this.players.values()) {
        if (!t.alive || t.id === p.id || now < t.shieldUntil) continue;
        const d = Math.hypot(t.x - x, t.y + 0.9 - y, t.z - z);
        if (d > r + 0.4) continue;
        if (!losClear(this.map, x, y + 0.1, z, t.x, t.y + 0.9, t.z)) continue;
        const dmg = D * (1 - 0.65 * clamp(d / r, 0, 1));
        this.damagePlayer(t, dmg, p.id, 'rpg', false, now, true, x, z);
      }
    }
  }

  private handleRespawn(p: SimPlayer, a: Extract<ClientAction, { a: 'respawn' }>, now: number) {
    if (p.alive || !(this.state === 'playing' || this.state === 'countdown')) return;
    const correct = !!a.correct;
    const time = clamp(num(a.time, EXAM_TIME), 0, EXAM_TIME);
    const allowed = availableWeapons(correct, time);
    const w: WeaponId = typeof a.w === 'string' && allowed.includes(a.w) ? a.w : 'pistol';
    p.qa++;
    const pts = answerPoints(correct, time);
    if (correct) { p.ok++; p.score += pts; }
    this.emit({ t: 'answer', by: p.id, name: p.name, ok: correct, pts });
    p.w = w;
    const lim = this.map.half - 0.5;
    this.spawnPlayer(p, now, [clamp(num(a.x), -lim, lim), clamp(num(a.z), -lim, lim)], false);
    p.y = clamp(num(a.y), 0, 10);
  }

  // ---------- Урон и убийства ----------

  private damageBot(b: SimBot, dmg: number, by: SimPlayer, w: WeaponId, head: boolean, now: number, splash: boolean, x: number, y: number, z: number) {
    b.hp -= dmg;
    this.emit({ t: 'hit', by: by.id, target: b.id, dmg: Math.round(dmg), head, x: r2(x), y: r2(y), z: r2(z), sp: splash ? 1 : 0, ax: r2(by.x), az: r2(by.z) });
    if (b.target !== by.id && Math.random() < 0.7) {
      b.target = by.id;
      b.retarget = 2.5;
      b.losT = 0;
    }
    if (b.hp <= 0) this.killBot(b, by, w, head, now);
  }

  private killBot(b: SimBot, by: SimPlayer, w: WeaponId, head: boolean, now: number) {
    b.alive = false;
    b.deadT = 0;
    b.hp = 0;
    const def = BOTS[b.k];
    const pts = def.pts + (head ? 25 : 0);
    by.bk++;
    by.score += pts;
    by.streak++;
    this.teamBotKills++;
    this.emit({ t: 'kill', by: by.id, victim: b.id, w, head, byName: by.name, victimName: def.name, bot: true, pts, streak: by.streak });
    this.multiKill(by, now);
  }

  private damagePlayer(t: SimPlayer, dmg: number, byId: string, w: ShotWeapon, head: boolean, now: number, splash: boolean, ax: number, az: number) {
    if (!t.alive || now < t.shieldUntil) return;
    t.hp -= dmg;
    this.emit({ t: 'hit', by: byId, target: t.id, dmg: Math.round(dmg), head, x: r2(t.x), y: r2(t.y + 1.2), z: r2(t.z), sp: splash ? 1 : 0, ax: r2(ax), az: r2(az) });
    if (t.hp <= 0) this.killPlayer(t, byId, w, head, now);
  }

  private killPlayer(t: SimPlayer, byId: string, w: ShotWeapon, head: boolean, now: number) {
    t.alive = false;
    t.hp = 0;
    t.deaths++;
    t.streak = 0;
    const killer = this.players.get(byId);
    let byName = 'Неизвестный';
    let pts = 0;
    let streak = 0;
    if (killer) {
      byName = killer.name;
      pts = 150 + (head ? 25 : 0);
      killer.kills++;
      killer.score += pts;
      killer.streak++;
      streak = killer.streak;
    } else {
      const b = this.bots.find((q) => q.id === byId);
      if (b) byName = BOTS[b.k].name;
    }
    this.emit({ t: 'kill', by: byId, victim: t.id, w, head, byName, victimName: t.name, bot: false, pts, streak });
    if (killer) this.multiKill(killer, now);
  }

  private multiKill(p: SimPlayer, now: number) {
    p.killTimes = p.killTimes.filter((t) => now - t < 3500);
    p.killTimes.push(now);
    const n = p.killTimes.length;
    if (n >= 2) {
      const bonus = 50 * (n - 1);
      p.score += bonus;
      const reason = n === 2 ? 'Двойное убийство' : n === 3 ? 'Тройное убийство' : n === 4 ? 'Четверное убийство' : 'Мясорубка';
      this.emit({ t: 'score', id: p.id, pts: bonus, reason });
    }
  }

  // ---------- Шаг симуляции ----------

  advance(now: number) {
    if (!this.lastStep) this.lastStep = now;
    const el = clamp((now - this.lastStep) / 1000, 0, 0.25);
    this.lastStep = now;
    this.acc += el;
    if (this.state === 'countdown' && now >= this.startsAt) {
      this.state = 'playing';
      this.emit({ t: 'msg', text: 'В БОЙ!', kind: 'info' });
    }
    if (this.state === 'playing' && now >= this.endsAt) {
      this.state = 'over';
      for (const b of this.bots) b.mv = 0;
      this.emit({ t: 'msg', text: 'Время вышло!', kind: 'info' });
    }
    let steps = 0;
    while (this.acc >= DT && steps < 8) {
      this.step(DT, now);
      this.acc -= DT;
      steps++;
    }
    if (steps >= 8) this.acc = 0;
  }

  private step(dt: number, now: number) {
    if (this.state !== 'playing' && this.state !== 'countdown') return;
    for (const pk of this.packs) {
      if (!pk.on) {
        pk.t -= dt;
        if (pk.t <= 0) pk.on = true;
        continue;
      }
      for (const p of this.players.values()) {
        if (!p.alive || p.hp >= MAX_HP) continue;
        if (Math.hypot(p.x - pk.x, p.z - pk.z) < 1.3 && p.y < 1.6) {
          p.hp = Math.min(MAX_HP, p.hp + 50);
          pk.on = false;
          pk.t = 15;
          this.emit({ t: 'pickup', id: pk.id, by: p.id });
          break;
        }
      }
    }
    if (this.state !== 'playing') return;
    if (this.settings.mode === 'coop') {
      const w = 1 + Math.floor((now - this.startsAt) / 45000);
      if (w > this.wave) {
        this.wave = w;
        this.emit({ t: 'msg', text: `Волна ${w}! Ботов стало больше`, kind: 'wave' });
      }
    }
    for (let i = this.bots.length - 1; i >= 0; i--) {
      const b = this.bots[i];
      if (!b.alive) {
        b.deadT += dt;
        if (b.deadT > 2.5) this.bots.splice(i, 1);
      }
    }
    this.spawnCd -= dt;
    let alive = 0;
    for (const b of this.bots) if (b.alive) alive++;
    if (alive < this.targetBots() && this.spawnCd <= 0) {
      this.spawnBot();
      this.spawnCd = 0.6;
    }
    for (const b of this.bots) if (b.alive) this.updateBot(b, dt, now);
    // расталкивание
    for (let i = 0; i < this.bots.length; i++) {
      const a = this.bots[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < this.bots.length; j++) {
        const c = this.bots[j];
        if (!c.alive) continue;
        const dx = c.x - a.x, dz = c.z - a.z;
        const min = BOTS[a.k].radius + BOTS[c.k].radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (min - d) / 2 / d;
          a.x -= dx * push; a.z -= dz * push;
          c.x += dx * push; c.z += dz * push;
        }
      }
    }
  }

  private spawnBot() {
    const diff = DIFF_INFO[this.settings.difficulty];
    const r = Math.random();
    const heavyP = Math.min(0.3, 0.08 + 0.03 * this.wave);
    const k: BotKind = r < heavyP ? 'heavy' : r < heavyP + 0.27 ? 'runner' : 'grunt';
    const def = BOTS[k];
    let alivePlayers = 0;
    for (const p of this.players.values()) if (p.alive) alivePlayers++;
    const hpMul = diff.hp * (this.settings.mode === 'coop' ? 1 + 0.15 * Math.max(0, alivePlayers - 1) : 1);
    const sp = this.map.spawns;
    const scored = sp.map((s) => {
      let m = 60;
      for (const p of this.players.values()) if (p.alive) m = Math.min(m, Math.hypot(p.x - s[0], p.z - s[1]));
      return { s, m };
    }).sort((a, b) => b.m - a.m);
    const pick = scored[Math.floor(Math.random() * Math.min(4, scored.length))]?.s ?? [0, 0];
    const b: SimBot = {
      id: `b${++this.botSeq}`, k, x: pick[0] + (Math.random() - 0.5), y: 0, z: pick[1] + (Math.random() - 0.5), ry: Math.random() * 6.28,
      hp: def.hp * hpMul, mhp: def.hp * hpMul, alive: true, deadT: 0, target: null, retarget: 0, losT: 0, los: false,
      fireCd: 0.5 + Math.random(), react: diff.react, strafeT: 0, strafe: 1, burst: 0, vx: 0, vz: 0, stuckT: 0,
      lx: pick[0], lz: pick[1], wx: 0, wz: 0, mv: MV_GROUND, firingT: 0, unstickT: 0, ux: 0, uz: 0,
    };
    this.bots.push(b);
    this.emit({ t: 'spawn', id: b.id, x: r2(b.x), y: 0, z: r2(b.z) });
  }

  private pathDir(b: SimBot, tx: number, tz: number, key: string, now: number): [number, number] | null {
    const nav = this.map.nav;
    const cell = cellOf(nav, tx, tz);
    let f = this.fields.get(key);
    if (!f || (f.cell !== cell && now - f.t > 500) || now - f.t > 3000) {
      f = { data: flowField(nav, tx, tz), t: now, cell };
      this.fields.set(key, f);
    }
    const s = nextStep(nav, f.data, b.x, b.z);
    if (!s) return null;
    const dx = s[0] - b.x, dz = s[1] - b.z;
    const d = Math.hypot(dx, dz) || 1;
    return [dx / d, dz / d];
  }

  private updateBot(b: SimBot, dt: number, now: number) {
    const def = BOTS[b.k];
    const diff = DIFF_INFO[this.settings.difficulty];
    b.retarget -= dt;
    let tgt = b.target ? this.players.get(b.target) : undefined;
    if (!tgt || !tgt.alive || b.retarget <= 0) {
      b.retarget = 1 + Math.random() * 0.6;
      let best: SimPlayer | undefined;
      let bd = Infinity;
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        let d = Math.hypot(p.x - b.x, p.z - b.z);
        if (now < p.shieldUntil) d += 25;
        if (p.id === b.target) d -= 4;
        if (d < bd) { bd = d; best = p; }
      }
      if (best && best.id !== b.target) b.react = diff.react + Math.random() * 0.3;
      b.target = best ? best.id : null;
      tgt = best;
    }
    b.losT -= dt;
    if (tgt && b.losT <= 0) {
      b.losT = 0.2;
      const had = b.los;
      b.los = losClear(this.map, b.x, 1.45 * def.scale, b.z, tgt.x, tgt.y + 1.2, tgt.z);
      if (!b.los && had) b.react = Math.max(b.react, diff.react * 0.6);
    }
    if (!tgt) b.los = false;

    let mx = 0, mz = 0;
    let speed = def.speed * (0.9 + 0.1 * diff.acc);
    b.firingT -= dt;
    b.fireCd -= dt;
    let faceX = 0, faceZ = 0;
    if (tgt) {
      const dx = tgt.x - b.x, dz = tgt.z - b.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      const ux = dx / dist, uz = dz / dist;
      if (b.k === 'runner') {
        if (b.los && dist < 14) { mx = ux; mz = uz; }
        else { const s = this.pathDir(b, tgt.x, tgt.z, tgt.id, now); if (s) { mx = s[0]; mz = s[1]; } else { mx = ux; mz = uz; } }
        if (dist < def.range && Math.abs(tgt.y - b.y) < 1.4 && b.fireCd <= 0 && now >= tgt.shieldUntil) {
          b.fireCd = def.rate;
          b.firingT = 0.3;
          this.emit({ t: 'melee', by: b.id, target: tgt.id });
          this.damagePlayer(tgt, def.dmg * diff.dmg, b.id, 'bot', false, now, false, b.x, b.z);
        }
        if (dist < 1.0) { mx *= 0.2; mz *= 0.2; }
      } else {
        if (b.los && dist < def.pref * 1.25) {
          b.strafeT -= dt;
          if (b.strafeT <= 0) {
            b.strafeT = 0.8 + Math.random() * 1.4;
            b.strafe = Math.random() < 0.5 ? -1 : 1;
            if (Math.random() < 0.2) b.strafe = 0;
          }
          const approach = dist > def.pref ? 0.6 : dist < def.pref * 0.5 ? -0.7 : 0;
          mx = -uz * b.strafe * 0.8 + ux * approach;
          mz = ux * b.strafe * 0.8 + uz * approach;
          speed *= 0.75;
        } else if (b.los && dist < 16) {
          mx = ux; mz = uz;
        } else {
          const s = this.pathDir(b, tgt.x, tgt.z, tgt.id, now);
          if (s) { mx = s[0]; mz = s[1]; } else { mx = ux; mz = uz; }
        }
        if (b.los && dist < def.range && now >= tgt.shieldUntil && tgt.alive) {
          b.react -= dt;
          if (b.react <= 0 && b.fireCd <= 0) {
            if (b.k === 'heavy') {
              b.burst++;
              if (b.burst >= 8) { b.burst = 0; b.fireCd = 1.6; } else b.fireCd = def.rate;
            } else {
              b.fireCd = def.rate * (0.85 + Math.random() * 0.3);
            }
            b.firingT = 0.25;
            this.botShoot(b, tgt, dist, now);
          }
        }
      }
      faceX = b.los ? ux : mx;
      faceZ = b.los ? uz : mz;
    } else {
      if ((!b.wx && !b.wz) || Math.hypot(b.wx - b.x, b.wz - b.z) < 2) {
        const s = this.map.spawns[Math.floor(Math.random() * this.map.spawns.length)];
        b.wx = s[0]; b.wz = s[1];
      }
      const s = this.pathDir(b, b.wx, b.wz, `w${Math.round(b.wx)}_${Math.round(b.wz)}`, now);
      if (s) { mx = s[0] * 0.6; mz = s[1] * 0.6; }
      faceX = mx; faceZ = mz;
    }
    // выход из застревания
    if (b.unstickT > 0) {
      b.unstickT -= dt;
      mx = b.ux; mz = b.uz;
    }
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    const k = Math.min(1, dt * 8);
    b.vx += (mx * speed - b.vx) * k;
    b.vz += (mz * speed - b.vz) * k;
    const pos = { x: b.x + b.vx * dt, z: b.z + b.vz * dt };
    collideCircle(this.map, pos, 0, def.radius, 0);
    b.x = pos.x;
    b.z = pos.z;
    if (faceX || faceZ) {
      const want = Math.atan2(-faceX, -faceZ);
      let dA = want - b.ry;
      while (dA > Math.PI) dA -= Math.PI * 2;
      while (dA < -Math.PI) dA += Math.PI * 2;
      const maxTurn = 9 * dt;
      b.ry += clamp(dA, -maxTurn, maxTurn);
    }
    const spd = Math.hypot(b.vx, b.vz);
    b.mv = (spd > 0.4 ? MV_MOVE : 0) | MV_GROUND | (b.firingT > 0 ? MV_FIRE : 0);
    b.stuckT += dt;
    if (b.stuckT > 1) {
      const moved = Math.hypot(b.x - b.lx, b.z - b.lz);
      if (moved < 0.4 && ml > 0.3 && b.unstickT <= 0) {
        const a = Math.random() * Math.PI * 2;
        b.ux = Math.cos(a); b.uz = Math.sin(a);
        b.unstickT = 0.6;
      }
      b.stuckT = 0;
      b.lx = b.x; b.lz = b.z;
    }
  }

  private botShoot(b: SimBot, tgt: SimPlayer, dist: number, now: number) {
    const def = BOTS[b.k];
    const diff = DIFF_INFO[this.settings.difficulty];
    const moving = (tgt.mv & MV_MOVE) !== 0;
    const sprint = (tgt.mv & MV_SPRINT) !== 0;
    const air = (tgt.mv & MV_GROUND) === 0;
    let p = def.acc * diff.acc * (1 - 0.55 * Math.min(1, dist / def.range));
    if (moving) p *= 0.8;
    if (sprint) p *= 0.8;
    if (air) p *= 0.75;
    if ((tgt.mv & MV_FIRE) !== 0) p *= 1.05;
    const hit = Math.random() < p;
    const s = def.scale;
    const fwdX = -Math.sin(b.ry), fwdZ = -Math.cos(b.ry);
    const fx = b.x + fwdX * 0.7 * s + fwdZ * -0.18 * s;
    const fy = 1.33 * s;
    const fz = b.z + fwdZ * 0.7 * s - fwdX * -0.18 * s;
    let tx = tgt.x, ty = tgt.y + 1.15, tz = tgt.z;
    if (!hit) {
      const off = 0.7 + Math.random() * 1.1;
      const a = Math.random() * Math.PI * 2;
      tx += Math.cos(a) * off;
      ty += (Math.random() - 0.35) * off;
      tz += Math.sin(a) * off;
      const dx = tx - fx, dy = ty - fy, dz = tz - fz;
      const d = Math.hypot(dx, dy, dz) || 1;
      const t = rayBoxes(this.map, fx, fy, fz, dx / d, dy / d, dz / d, 70);
      tx = fx + (dx / d) * t; ty = fy + (dy / d) * t; tz = fz + (dz / d) * t;
    }
    this.emit({ t: 'shot', by: b.id, w: b.k === 'heavy' ? 'lmg' : 'bot', f: [r2(fx), r2(fy), r2(fz)], to: [r2(tx), r2(ty), r2(tz)] });
    if (hit) this.damagePlayer(tgt, def.dmg * diff.dmg, b.id, 'bot', false, now, false, b.x, b.z);
  }

  // ---------- Снимок ----------

  matchNet(): MatchNet {
    return {
      state: this.state, settings: this.settings, startsAt: this.startsAt, endsAt: this.endsAt, hostId: this.hostId,
      wave: this.wave, teamBotKills: this.teamBotKills, roomName: this.name, code: this.code, matchId: this.matchId,
    };
  }

  snapshot(forId: string, since: number, now: number): Snapshot {
    const players: PlayerNet[] = [];
    for (const p of this.players.values()) {
      players.push({
        id: p.id, name: p.name, look: p.look, x: r2(p.x), y: r2(p.y), z: r2(p.z), ry: r2(p.ry), rx: r2(p.rx), mv: p.mv,
        hp: Math.max(0, Math.ceil(p.hp)), st: p.alive ? 'alive' : 'dead', life: p.life, w: p.w,
        sh: p.alive && now < p.shieldUntil ? 1 : 0, score: p.score, kills: p.kills, bk: p.bk, deaths: p.deaths,
        ok: p.ok, qa: p.qa, streak: p.streak,
      });
    }
    const bots: BotNet[] = this.bots.map((b) => ({
      id: b.id, k: b.k, x: r2(b.x), y: r2(b.y), z: r2(b.z), ry: r2(b.ry), hp: Math.max(0, Math.ceil(b.hp)),
      mhp: Math.ceil(b.mhp), st: b.alive ? 'alive' : 'dead', mv: b.alive ? b.mv : 0,
    }));
    let events: SimEvent[] = [];
    if (since < this.seq) {
      let i = this.events.length;
      while (i > 0 && this.events[i - 1].seq > since) i--;
      events = this.events.slice(Math.max(i, this.events.length - 260));
    }
    return {
      now, seq: this.seq, you: forId, match: this.matchNet(), players, bots,
      packs: this.packs.map((p) => ({ id: p.id, x: p.x, z: p.z, on: p.on })), events,
    };
  }
}

export { MV_FIRE };

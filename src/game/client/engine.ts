import * as THREE from 'three';
import {
  BOTS, BotKind, ClientAction, ClientUpdate, GameMode, Look, MatchNet, MatchSettings, MODE_INFO, MV_ADS, MV_BACK, MV_FIRE,
  MV_GROUND, MV_MOVE, MV_RELOAD, MV_SPRINT, PLAYER_RADIUS, PlayerNet, ShotWeapon, SimEvent, Snapshot, STEP_UP, TopicId,
  WeaponId, WEAPONS,
} from '../shared/types';
import { buildMap, collideCircle, groundAt, hitNormal, losClear, MapData, mapKey, rayBoxes, rayHitbox } from '../shared/maps';
import { buildWorld, getGlowTexture, WorldBuild } from './world';
import { CharacterModel } from './characters';
import { Effects } from './effects';
import { Dot, Overlay, Tag } from './overlay';
import { Input } from './input';
import { sfx } from './audio';
import type { ControlAction, Transport } from './transport';
import type { KeyBindings, Prefs, Profile } from './storage';

export type Phase = 'loading' | 'lobby' | 'countdown' | 'play' | 'dying' | 'exam' | 'over';

export interface HudData {
  hp: number;
  shield: boolean;
  weapon: WeaponId;
  primary: WeaponId;
  ammo: number;
  mag: number;
  reload: number;
  score: number;
  kills: number;
  bk: number;
  deaths: number;
  ok: number;
  qa: number;
  timeLeft: number;
  countdown: number;
  state: MatchNet['state'];
  mode: GameMode;
  wave: number;
  teamBotKills: number;
  ping: number;
  online: boolean;
  botsAlive: number;
  streak: number;
}

export interface FeedItem {
  id: number;
  kind: 'kill' | 'info';
  by: string;
  victim: string;
  w: ShotWeapon;
  head: boolean;
  mine: boolean;
  meVictim: boolean;
  text?: string;
  ok?: boolean;
}

export interface PhaseInfo {
  killer: string | null;
  killerWeapon: ShotWeapon | null;
  entrance: boolean;
  matchId: number;
}

export interface EngineEvents {
  phase(p: Phase, info: PhaseInfo): void;
  hud(h: HudData): void;
  feed(item: FeedItem): void;
  announce(text: string, kind: 'kill' | 'multi' | 'info' | 'wave' | 'bad'): void;
  popup(text: string, color?: string): void;
  match(m: MatchNet, players: PlayerNet[]): void;
  pauseRequest(toggle: boolean): void;
  scoreboard(show: boolean): void;
  lock(locked: boolean): void;
  fatal(msg: string): void;
  fps?: (f: number) => void;
}

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  overlay: HTMLCanvasElement;
  transport: Transport;
  profile: Profile;
  prefs: Prefs;
  touch: boolean;
  keymap?: KeyBindings;
  events: EngineEvents;
}

interface View {
  id: string;
  bot: boolean;
  kind: BotKind | null;
  name: string;
  look: Look;
  model: CharacterModel;
  x: number; y: number; z: number; ry: number; rx: number;
  tx: number; ty: number; tz: number; tr: number; trx: number;
  lx: number; lz: number; spd: number;
  hp: number; mhp: number; alive: boolean; mv: number; sh: boolean; hurtT: number; scale: number;
}

interface PackView {
  group: THREE.Group;
  x: number;
  z: number;
  on: boolean;
}

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpM = new THREE.Vector3();
const tmpD = new THREE.Vector3();
const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerpAngle = (a: number, b: number, k: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
};

export class Engine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private world: WorldBuild | null = null;
  private map: MapData | null = null;
  private worldKey = '';
  private effects: Effects;
  private overlay: Overlay;
  private input: Input;
  private views = new Map<string, View>();
  private myModel: CharacterModel;
  private packs: PackView[] = [];
  private packRes: { geo: THREE.BoxGeometry; red: THREE.MeshLambertMaterial; white: THREE.MeshLambertMaterial; glow: THREE.SpriteMaterial };
  private me = {
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: -0.05, grounded: true, coyote: 0, jumpBuf: 0,
    alive: false, life: 0, hp: 100, sh: false, sprint: false, ads: false, moving: false, back: false,
  };
  private wpn = {
    primary: 'rifle' as WeaponId, cur: 'rifle' as WeaponId, ammo: {} as Record<WeaponId, number>,
    reloadT: 0, fireCd: 0, bloom: 0, trigger: false, kick: 0, kickYaw: 0, autoReload: 0,
  };
  private phase: Phase = 'loading';
  private matchId = -1;
  private match: MatchNet | null = null;
  private players: PlayerNet[] = [];
  private myNet: PlayerNet | null = null;
  private myId = '';
  private pending: ClientAction[] = [];
  private rockets: { t: number; x: number; y: number; z: number }[] = [];
  private trauma = 0;
  private camDist = 3.3;
  private camY = 0;
  private fov = 72;
  private baseFov = 72;
  private deathPos = new THREE.Vector3();
  private dyingT = 0;
  private orbitA = 0;
  private lastKiller: { name: string; w: ShotWeapon } | null = null;
  private entrance = false;
  private serverOffset = 0;
  private time = 0;
  private raf = 0;
  private lastT = 0;
  private paused = false;
  private hudT = 0;
  private matchT = 0;
  private lastState = '';
  private disposed = false;
  private vignette = 0;
  private feedId = 0;
  private lastCd = -1;
  private stepAcc = 0;
  private aimO = new THREE.Vector3();
  private aimD = new THREE.Vector3(0, 0, -1);
  private ro: ResizeObserver | null = null;
  private viewH = 600;
  private basePR = 1;
  private curPR = 1;
  private emaFps = 60;
  private fpsEmitT = 0;
  private autoQT = 0;
  private opts: EngineOptions;
  private events: EngineEvents;
  private high: boolean;

  constructor(opts: EngineOptions) {
    this.opts = opts;
    this.events = opts.events;
    this.high = opts.prefs.quality === 'high';
    this.renderer = new THREE.WebGLRenderer({ canvas: opts.canvas, antialias: this.high, powerPreference: 'high-performance', stencil: false });
    this.basePR = Math.min(window.devicePixelRatio || 1, this.high ? 1.5 : 1.15);
    this.curPR = this.basePR;
    this.renderer.setPixelRatio(this.curPR);
    this.renderer.shadowMap.enabled = this.high;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.baseFov = opts.touch ? 78 : 72;
    this.fov = this.baseFov;
    this.camera = new THREE.PerspectiveCamera(this.baseFov, 1, 0.1, 700);
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(0, 30, 40);
    this.effects = new Effects(this.scene, opts.prefs.quality);
    this.overlay = new Overlay(opts.overlay, opts.touch);
    this.input = new Input(opts.canvas, opts.touch, {
      onPause: () => this.events.pauseRequest(true),
      onScoreboard: (s) => this.events.scoreboard(s),
      onLockChange: (locked) => {
        this.events.lock(locked);
        if (!locked && !this.paused && (this.phase === 'play' || this.phase === 'countdown')) this.events.pauseRequest(false);
      },
    }, opts.keymap);
    this.myModel = new CharacterModel(opts.profile.look, { shadows: this.high, weapon: 'rifle' });
    this.myModel.root.visible = false;
    this.scene.add(this.myModel.root);
    this.packRes = {
      geo: new THREE.BoxGeometry(1, 1, 1),
      red: new THREE.MeshLambertMaterial({ color: '#ff2d55', emissive: '#7a0018' }),
      white: new THREE.MeshLambertMaterial({ color: '#ffffff' }),
      glow: new THREE.SpriteMaterial({ map: getGlowTexture(), color: '#3ddc84', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 }),
    };
    this.myId = opts.transport.playerId;
    opts.transport.onFatal = (m) => this.events.fatal(m);
    sfx.setVolume(opts.prefs.volume);
    for (const w of Object.keys(WEAPONS) as WeaponId[]) this.wpn.ammo[w] = WEAPONS[w].mag;
    const parent = opts.canvas.parentElement;
    if (typeof ResizeObserver !== 'undefined' && parent) {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(parent);
    }
    this.resize();
  }

  // ---------- Публичное API ----------

  start() {
    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.input.exitLock();
    this.input.dispose();
    this.effects.dispose();
    if (this.world) this.world.dispose();
    for (const v of this.views.values()) v.model.dispose();
    this.myModel.dispose();
    this.packRes.geo.dispose();
    this.packRes.red.dispose();
    this.packRes.white.dispose();
    this.packRes.glow.dispose();
    this.renderer.dispose();
    try {
      this.renderer.forceContextLoss();
    } catch {
      // игнор
    }
  }

  setPaused(p: boolean) {
    this.paused = p;
    this.opts.transport.setPaused(p);
    this.input.enabled = !p;
    if (p) {
      this.input.exitLock();
      this.input.mouseL = false;
      this.input.mouseR = false;
    }
    this.input.clearEdges();
  }

  lockPointer() {
    if (!this.opts.touch) this.input.requestLock();
    sfx.init();
  }

  get inputRef() {
    return this.input;
  }

  setPrefs(p: Prefs) {
    this.opts.prefs = p;
    sfx.setVolume(p.volume);
  }

  setKeymap(k: KeyBindings) {
    this.input.setKeymap(k);
  }

  control(action: ControlAction, settings?: MatchSettings) {
    return this.opts.transport.control(action, settings);
  }

  get currentSettings(): MatchSettings | null {
    return this.match?.settings ?? null;
  }

  /** Вызывается интерфейсом после экзамена. */
  respawn(weapon: WeaponId, correct: boolean, time: number, topic: TopicId) {
    if (!this.map || this.me.alive) return;
    const [x, z] = this.chooseSpawn();
    const y = groundAt(this.map, x, z, PLAYER_RADIUS, 10, STEP_UP);
    this.teleport(x, y, z);
    this.me.yaw = Math.atan2(x, z);
    this.me.pitch = -0.05;
    this.me.alive = true;
    this.me.life += 1;
    this.me.hp = 100;
    this.wpn.primary = weapon;
    this.wpn.cur = weapon;
    this.wpn.ammo[weapon] = WEAPONS[weapon].mag;
    this.wpn.ammo.pistol = WEAPONS.pistol.mag;
    this.wpn.reloadT = 0;
    this.wpn.fireCd = 0.35;
    this.wpn.trigger = true;
    this.myModel.setWeapon(weapon);
    this.myModel.root.visible = true;
    this.myModel.spawnT = 0;
    this.pending.push({ a: 'respawn', w: weapon, x: r2(x), y: r2(y), z: r2(z), correct, time: r2(time), topic });
    this.effects.spawnFx(x, y, z);
    sfx.spawn();
    this.entrance = false;
    this.setPhase(this.match?.state === 'countdown' ? 'countdown' : 'play');
  }

  // ---------- Внутреннее ----------

  private resize() {
    const p = this.opts.canvas.parentElement;
    if (!p) return;
    const w = p.clientWidth, h = p.clientHeight;
    if (!w || !h) return;
    this.viewH = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.overlay.resize(w, h);
  }

  private addTrauma(v: number) {
    this.trauma = Math.min(1, this.trauma + v);
  }

  private serverNow() {
    return Date.now() + this.serverOffset;
  }

  private setPhase(p: Phase) {
    if (p === this.phase) return;
    this.phase = p;
    if (p === 'exam' || p === 'over' || p === 'lobby') {
      this.input.exitLock();
      this.input.mouseL = false;
      this.input.mouseR = false;
    }
    if (p !== 'play' && p !== 'countdown') this.myModel.setShield(false);
    this.events.phase(p, {
      killer: this.lastKiller?.name ?? null,
      killerWeapon: this.lastKiller?.w ?? null,
      entrance: this.entrance,
      matchId: this.matchId,
    });
  }

  private ensureWorld(s: MatchSettings) {
    const key = mapKey(s.map) + '|' + s.map.theme;
    if (key === this.worldKey) return;
    this.worldKey = key;
    if (this.world) {
      this.scene.remove(this.world.group);
      this.world.dispose();
    }
    this.map = buildMap(s.map);
    this.world = buildWorld(this.map, s.map.theme, this.opts.prefs.quality, s.map.seed);
    this.scene.add(this.world.group);
    this.scene.fog = this.world.fog;
    this.scene.background = this.world.background;
    this.overlay.setMinimap(this.world.minimap, this.map.half);
    for (const p of this.packs) this.scene.remove(p.group);
    this.packs = this.map.packs.map(([x, z]) => {
      const g = new THREE.Group();
      const R = this.packRes;
      const base = new THREE.Mesh(R.geo, R.white);
      base.scale.set(0.62, 0.62, 0.62);
      const c1 = new THREE.Mesh(R.geo, R.red);
      c1.scale.set(0.66, 0.2, 0.66 * 0.3);
      const c2 = new THREE.Mesh(R.geo, R.red);
      c2.scale.set(0.2, 0.66, 0.66 * 0.3);
      const c3 = new THREE.Mesh(R.geo, R.red);
      c3.scale.set(0.66 * 0.3, 0.2, 0.66);
      const c4 = new THREE.Mesh(R.geo, R.red);
      c4.scale.set(0.66 * 0.3, 0.66, 0.2);
      const glow = new THREE.Sprite(R.glow);
      glow.scale.setScalar(2.4);
      g.add(base, c1, c2, c3, c4, glow);
      g.position.set(x, 0.9, z);
      this.scene.add(g);
      return { group: g, x, z, on: true };
    });
  }

  private resetForMatch() {
    this.wpn.primary = 'rifle';
    this.wpn.cur = 'rifle';
    for (const w of Object.keys(WEAPONS) as WeaponId[]) this.wpn.ammo[w] = WEAPONS[w].mag;
    this.wpn.reloadT = 0;
    this.wpn.fireCd = 0;
    this.wpn.kick = 0;
    this.myModel.setWeapon('rifle');
    this.lastKiller = null;
    this.rockets = [];
  }

  private teleport(x: number, y: number, z: number) {
    this.me.x = x; this.me.y = y; this.me.z = z;
    this.me.vx = 0; this.me.vy = 0; this.me.vz = 0;
    this.camY = y;
    this.myModel.root.position.set(x, y, z);
  }

  private isHostile(v: View): boolean {
    const mode = this.match?.settings.mode ?? 'coop';
    return v.bot ? MODE_INFO[mode].bots : MODE_INFO[mode].pvp;
  }

  private chooseSpawn(): [number, number] {
    const map = this.map as MapData;
    const threats: { x: number; z: number }[] = [];
    for (const v of this.views.values()) if (v.alive && this.isHostile(v)) threats.push(v);
    const sp = map.spawns;
    if (!threats.length) return sp[Math.floor(Math.random() * sp.length)];
    let best = sp[0];
    let bs = -Infinity;
    for (const s of sp) {
      let m = Infinity;
      for (const t of threats) m = Math.min(m, Math.hypot(t.x - s[0], t.z - s[1]));
      const score = m + Math.random() * 8;
      if (score > bs) { bs = score; best = s; }
    }
    return best;
  }

  private createView(id: string, bot: boolean, look: Look, name: string, kind: BotKind | null, x: number, y: number, z: number): View {
    const scale = kind ? BOTS[kind].scale : 1;
    const weapon: WeaponId | 'none' = kind === 'runner' ? 'none' : kind === 'heavy' ? 'lmg' : 'rifle';
    const model = new CharacterModel(look, { scale, shadows: this.high, weapon, glowEyes: bot });
    model.root.position.set(x, y, z);
    this.scene.add(model.root);
    const v: View = {
      id, bot, kind, name, look, model, x, y, z, ry: 0, rx: 0, tx: x, ty: y, tz: z, tr: 0, trx: 0, lx: x, lz: z, spd: 0,
      hp: 100, mhp: 100, alive: true, mv: 0, sh: false, hurtT: -10, scale,
    };
    this.views.set(id, v);
    return v;
  }

  private killView(v: View) {
    this.effects.shatter(v.x, v.y, v.z, v.model.colors(), v.scale);
    v.alive = false;
    v.model.root.visible = false;
  }

  private removeView(id: string) {
    const v = this.views.get(id);
    if (!v) return;
    this.scene.remove(v.model.root);
    v.model.dispose();
    this.views.delete(id);
  }

  private buildUpdate = (): ClientUpdate => {
    const me = this.me;
    const w = this.wpn;
    const mv = (me.moving ? MV_MOVE : 0) | (me.sprint ? MV_SPRINT : 0) | (me.grounded ? MV_GROUND : 0) |
      (me.alive && this.input.fire() ? MV_FIRE : 0) | (me.ads ? MV_ADS : 0) | (w.reloadT > 0 ? MV_RELOAD : 0) | (me.back ? MV_BACK : 0);
    const actions = this.pending;
    this.pending = [];
    return { x: r2(me.x), y: r2(me.y), z: r2(me.z), ry: r3(me.yaw), rx: r3(me.pitch + w.kick), mv, w: w.cur, actions };
  };

  // ---------- Снимки ----------

  private applySnapshot(s: Snapshot) {
    this.serverOffset = s.now - Date.now() + (this.opts.transport.online ? this.opts.transport.rtt / 2 : 0);
    this.myId = s.you;
    const m = s.match;
    this.match = m;
    this.ensureWorld(m.settings);
    if (m.matchId !== this.matchId) {
      this.matchId = m.matchId;
      this.resetForMatch();
    }
    this.players = s.players;
    let mine: PlayerNet | null = null;
    const seen = new Set<string>();
    for (const p of s.players) {
      if (p.id === s.you) { mine = p; continue; }
      seen.add(p.id);
      let v = this.views.get(p.id);
      if (!v) v = this.createView(p.id, false, p.look, p.name, null, p.x, p.y, p.z);
      const wasAlive = v.alive;
      if (wasAlive && p.st !== 'alive') this.killView(v);
      v.alive = p.st === 'alive';
      v.tx = p.x; v.ty = p.y; v.tz = p.z; v.tr = p.ry; v.trx = p.rx;
      v.hp = p.hp; v.mhp = 100; v.mv = p.mv; v.sh = p.sh === 1; v.name = p.name;
      v.model.setWeapon(p.w);
      if (v.alive && !wasAlive) {
        v.x = p.x; v.y = p.y; v.z = p.z; v.ry = p.ry;
        v.model.spawnT = 0;
      }
      v.model.root.visible = v.alive;
    }
    for (const b of s.bots) {
      seen.add(b.id);
      let v = this.views.get(b.id);
      if (!v) {
        if (b.st !== 'alive') continue;
        v = this.createView(b.id, true, BOTS[b.k].look, BOTS[b.k].name, b.k, b.x, b.y, b.z);
        v.ry = b.ry;
        v.model.spawnT = 0;
      }
      v.tx = b.x; v.ty = b.y; v.tz = b.z; v.tr = b.ry; v.trx = 0;
      if (v.hp !== b.hp && b.hp < v.hp) v.hurtT = this.time;
      v.hp = b.hp; v.mhp = b.mhp; v.mv = b.mv;
      if (b.st !== 'alive' && v.alive) this.killView(v);
    }
    for (const id of [...this.views.keys()]) if (!seen.has(id)) this.removeView(id);
    for (const pk of s.packs) {
      const pv = this.packs[pk.id];
      if (pv) pv.on = pk.on;
    }
    this.myNet = mine;
    for (const e of s.events) if (e.t === 'kill' && e.victim === s.you) this.lastKiller = { name: e.byName, w: e.w };
    if (mine) this.syncSelf(mine);
    for (const e of s.events) this.handleEvent(e);
    this.updatePhase(m);
    this.matchT -= 1;
    if (m.state !== this.lastState || this.matchT <= 0) {
      this.lastState = m.state;
      this.matchT = this.opts.transport.online ? 5 : 15;
      this.events.match(m, s.players);
    }
  }

  private syncSelf(mine: PlayerNet) {
    this.me.hp = mine.hp;
    this.me.sh = mine.sh === 1;
    if (mine.life > this.me.life) {
      this.me.life = mine.life;
      if (mine.st === 'alive') {
        this.me.alive = true;
        this.teleport(mine.x, mine.y, mine.z);
        this.me.yaw = Math.atan2(mine.x, mine.z);
        this.myModel.root.visible = true;
        this.myModel.spawnT = 0;
        this.effects.spawnFx(mine.x, mine.y, mine.z);
      }
    } else if (mine.life === this.me.life && mine.st === 'dead' && this.me.alive) {
      this.die();
    }
  }

  private updatePhase(m: MatchNet) {
    let ph: Phase = this.phase;
    if (m.state === 'lobby') ph = 'lobby';
    else if (m.state === 'over') ph = 'over';
    else if (this.me.alive) ph = m.state === 'countdown' ? 'countdown' : 'play';
    else if (ph === 'dying' || ph === 'exam') {
      // остаёмся
    } else if (this.myNet) {
      this.entrance = true;
      this.lastKiller = null;
      ph = 'exam';
    }
    if (ph !== this.phase) this.setPhase(ph);
  }

  private die() {
    const me = this.me;
    me.alive = false;
    me.ads = false;
    me.sprint = false;
    this.deathPos.set(me.x, me.y, me.z);
    this.effects.shatter(me.x, me.y, me.z, this.myModel.colors());
    this.myModel.root.visible = false;
    this.addTrauma(0.9);
    this.vignette = 1;
    sfx.death();
    this.dyingT = 1.5;
    this.orbitA = me.yaw + Math.PI;
    this.entrance = false;
    this.setPhase('dying');
  }

  private shooterPos(id: string): THREE.Vector3 | null {
    const v = this.views.get(id);
    if (v) return tmpA.set(v.x, v.y, v.z);
    return null;
  }

  private handleEvent(e: SimEvent) {
    const you = this.myId;
    switch (e.t) {
      case 'shot': {
        if (e.by === you) break;
        const v = this.views.get(e.by);
        const from = tmpA.set(e.f[0], e.f[1], e.f[2]);
        if (v && v.alive) {
          v.model.getMuzzle(from);
          v.model.fireKick();
        }
        const d = Math.hypot(from.x - this.camera.position.x, from.z - this.camera.position.z);
        sfx.shot(e.w, clamp(1 - d / 70, 0, 1) * 0.7);
        if (d > 95) break;
        const hostile = v ? this.isHostile(v) : true;
        const color = v?.bot ? 0xff4a3a : hostile ? 0xff9a3d : 0x7fe9ff;
        if (e.w === 'rpg') this.effects.rocket(from, e.to[0], e.to[1], e.to[2]);
        else {
          this.effects.tracer(from, e.to[0], e.to[1], e.to[2], color, v?.bot ? 0.05 : 0.045);
          this.effects.muzzle(from, color, 0.7);
          this.effects.spark(e.to[0], e.to[1], e.to[2], 0, 1, 0, 0xffd28a, 3);
        }
        break;
      }
      case 'hit': {
        if (e.target === you) {
          this.addTrauma(Math.min(0.5, 0.12 + e.dmg / 110));
          this.vignette = Math.min(1, this.vignette + e.dmg / 35);
          this.overlay.addDamageDir(e.ax, e.az);
          sfx.hurt();
          break;
        }
        const v = this.views.get(e.target);
        if (v) v.hurtT = this.time;
        if (e.by === you) {
          if (e.sp) {
            this.overlay.addDamage(e.x, e.y, e.z, e.dmg, false);
            this.overlay.hitMarker(false, false);
            sfx.hit(false);
            v?.model.flash();
          }
        } else {
          v?.model.flash();
          this.effects.hitPuff(e.x, e.y, e.z, v ? parseInt(v.look.body.slice(1), 16) : 0xffffff, 4);
        }
        break;
      }
      case 'kill': {
        const mine = e.by === you;
        this.events.feed({ id: ++this.feedId, kind: 'kill', by: e.byName, victim: e.victimName, w: e.w, head: e.head, mine, meVictim: e.victim === you });
        const v = this.views.get(e.victim);
        if (v) {
          if (v.alive) this.killView(v);
          const d = Math.hypot(v.x - this.me.x, v.z - this.me.z);
          if (d < 20) this.addTrauma(0.12);
        }
        if (mine && e.victim !== you) {
          this.overlay.hitMarker(true, e.head);
          sfx.kill();
          this.events.popup(`${e.victimName} +${e.pts}`, e.head ? '#ffd23d' : '#ffffff');
          if (e.head) this.events.announce('В ГОЛОВУ!', 'kill');
          if (e.streak === 3) this.events.announce('СЕРИЯ ×3', 'multi');
          else if (e.streak === 5) this.events.announce('НЕУДЕРЖИМЫЙ!', 'multi');
          else if (e.streak === 10) this.events.announce('ЛЕГЕНДА!', 'multi');
          else if (e.streak > 10 && e.streak % 5 === 0) this.events.announce(`СЕРИЯ ×${e.streak}`, 'multi');
          this.addTrauma(0.1);
        }
        if (e.victim === you) this.lastKiller = { name: e.byName, w: e.w };
        break;
      }
      case 'boom': {
        if (e.by === you) break;
        this.explosionFx(e.x, e.y, e.z, e.r);
        break;
      }
      case 'melee': {
        const v = this.views.get(e.by);
        v?.model.melee();
        if (e.target === you) sfx.melee();
        break;
      }
      case 'pickup': {
        const pk = this.packs[e.id];
        if (pk) {
          pk.on = false;
          this.effects.healFx(pk.x, 0, pk.z);
        }
        if (e.by === you) {
          sfx.pickup();
          this.events.popup('+50 ОЗ', '#3ddc84');
        }
        break;
      }
      case 'spawn': {
        if (e.id === you) {
          this.teleport(e.x, e.y, e.z);
          break;
        }
        const v = this.views.get(e.id);
        if (v) {
          v.x = v.tx = e.x; v.y = v.ty = e.y; v.z = v.tz = e.z;
          v.model.spawnT = 0;
        }
        this.effects.spawnFx(e.x, e.y, e.z);
        break;
      }
      case 'msg': {
        if (!this.opts.transport.online && (e.kind === 'join' || e.kind === 'leave')) break;
        if (e.kind === 'join' || e.kind === 'leave') {
          this.events.feed({ id: ++this.feedId, kind: 'info', by: '', victim: '', w: 'pistol', head: false, mine: false, meVictim: false, text: e.text });
        } else {
          this.events.announce(e.text, e.kind === 'wave' ? 'wave' : 'info');
          if (e.kind === 'wave') sfx.wave();
        }
        break;
      }
      case 'answer': {
        if (e.by === you) break;
        this.events.feed({ id: ++this.feedId, kind: 'info', by: e.name, victim: '', w: 'pistol', head: false, mine: false, meVictim: false, ok: e.ok, text: e.ok ? `${e.name} сдал билет (+${e.pts})` : `${e.name} завалил билет` });
        break;
      }
      case 'score': {
        if (e.id === you) {
          this.events.announce(e.reason.toUpperCase(), 'multi');
          this.events.popup(`${e.reason} +${e.pts}`, '#ffc53d');
        }
        break;
      }
    }
  }

  private explosionFx(x: number, y: number, z: number, r: number) {
    this.effects.explosion(x, y, z, r);
    const d = Math.hypot(x - this.me.x, y - this.me.y, z - this.me.z);
    sfx.explosion(clamp(1.2 - d / 50, 0.1, 1));
    this.addTrauma(clamp(1 - d / 22, 0, 1) * 0.85);
  }

  // ---------- Локальный игрок ----------

  private updateLocal(dt: number) {
    const inp = this.input;
    const me = this.me;
    const w = this.wpn;
    const map = this.map;
    const active = !this.paused && !!map && me.alive && (this.phase === 'play' || this.phase === 'countdown');
    const [lx, ly] = inp.takeLook();
    if (!active || !map) {
      inp.takeJump(); inp.takeReload(); inp.takeSwap(); inp.takeSlot();
      me.moving = false;
      me.sprint = false;
      return;
    }
    const wd = WEAPONS[w.cur];
    // обзор
    const zoomMul = me.ads ? 1 / Math.max(1, wd.zoom * 0.85) : 1;
    const sens = 0.0022 * this.opts.prefs.sens * zoomMul;
    me.yaw -= lx * sens;
    me.pitch -= ly * sens * (this.opts.prefs.invertY ? -1 : 1);
    me.pitch = clamp(me.pitch, -1.25, 1.15);

    // движение
    let mx = inp.moveX(), my = inp.moveY();
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    const firing = inp.fire();
    me.ads = inp.ads() && w.reloadT <= 0;
    me.sprint = inp.sprint() && my > 0.3 && !me.ads && !firing;
    const speed = 6.4 * wd.speedMul * (me.sprint ? 1.42 : 1) * (me.ads ? 0.62 : 1);
    const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
    const wx = (-sy * my + cy * mx) * speed;
    const wz = (-cy * my - sy * mx) * speed;
    const accel = me.grounded ? 62 : 16;
    const dvx = wx - me.vx, dvz = wz - me.vz;
    const dl = Math.hypot(dvx, dvz);
    const maxD = accel * dt;
    if (dl > maxD) { me.vx += (dvx / dl) * maxD; me.vz += (dvz / dl) * maxD; }
    else { me.vx = wx; me.vz = wz; }
    me.back = my < -0.1;

    // прыжок (буфер + «койот»)
    if (inp.takeJump()) me.jumpBuf = 0.14;
    else me.jumpBuf -= dt;
    if (me.grounded) me.coyote = 0.1;
    else me.coyote -= dt;
    if (me.jumpBuf > 0 && me.coyote > 0) {
      me.vy = 8.2;
      me.grounded = false;
      me.coyote = 0;
      me.jumpBuf = 0;
      sfx.jump();
      this.effects.dust(me.x, me.y, me.z, 5);
    }
    me.vy = Math.max(-30, me.vy - 24 * dt);

    const hs = Math.hypot(me.vx, me.vz);
    const steps = Math.max(1, Math.ceil((hs * dt) / 0.25));
    const pos = { x: me.x, z: me.z };
    for (let i = 0; i < steps; i++) {
      pos.x += (me.vx * dt) / steps;
      pos.z += (me.vz * dt) / steps;
      collideCircle(map, pos, me.y, PLAYER_RADIUS, STEP_UP);
    }
    const ax = (pos.x - me.x) / dt, az = (pos.z - me.z) / dt;
    if (Math.abs(ax) < Math.abs(me.vx)) me.vx = ax;
    if (Math.abs(az) < Math.abs(me.vz)) me.vz = az;
    me.x = pos.x;
    me.z = pos.z;
    const g = groundAt(map, me.x, me.z, PLAYER_RADIUS, me.y, STEP_UP);
    me.y += me.vy * dt;
    if (me.y <= g) {
      if (!me.grounded && me.vy < -9) {
        sfx.land();
        this.effects.dust(me.x, g, me.z, 8);
        this.addTrauma(Math.min(0.3, -me.vy / 60));
        this.myModel.land();
      }
      me.y = g;
      me.vy = 0;
      me.grounded = true;
    } else {
      me.grounded = false;
    }
    me.moving = hs > 0.5;
    if (me.moving && me.grounded) {
      this.stepAcc += hs * dt;
      if (this.stepAcc > (me.sprint ? 2.6 : 2.1)) {
        this.stepAcc = 0;
        sfx.step();
        if (me.sprint) this.effects.dust(me.x, me.y, me.z, 2);
      }
    }

    // оружие
    const slot = inp.takeSlot();
    if (inp.takeSwap() || (slot === 1 && w.cur !== w.primary) || (slot === 2 && w.cur !== 'pistol')) this.switchWeapon();
    w.fireCd -= dt;
    if (w.reloadT > 0) {
      w.reloadT -= dt;
      if (w.reloadT <= 0) {
        w.ammo[w.cur] = WEAPONS[w.cur].mag;
        sfx.reloadEnd();
      }
    }
    if (w.autoReload > 0) {
      w.autoReload -= dt;
      if (w.autoReload <= 0 && w.ammo[w.cur] <= 0 && w.reloadT <= 0) this.startReload();
    }
    if (inp.takeReload() && w.reloadT <= 0 && w.ammo[w.cur] < WEAPONS[w.cur].mag) this.startReload();
    if (firing && !me.sprint && w.fireCd <= 0 && w.reloadT <= 0) {
      if (w.ammo[w.cur] <= 0) {
        if (!w.trigger) sfx.empty();
        this.startReload();
      } else if (WEAPONS[w.cur].auto || !w.trigger) {
        this.fire();
        w.fireCd = WEAPONS[w.cur].rate;
      }
    }
    w.trigger = firing;
    w.bloom = Math.max(0, w.bloom - dt * 0.12);
    w.kick *= Math.exp(-dt * 9);
    w.kickYaw *= Math.exp(-dt * 9);
  }

  private switchWeapon() {
    const w = this.wpn;
    if (w.primary === 'pistol') return;
    w.cur = w.cur === w.primary ? 'pistol' : w.primary;
    w.reloadT = 0;
    w.fireCd = 0.25;
    this.myModel.setWeapon(w.cur);
    sfx.swap();
  }

  private startReload() {
    const w = this.wpn;
    if (w.reloadT > 0 || w.ammo[w.cur] >= WEAPONS[w.cur].mag) return;
    w.reloadT = WEAPONS[w.cur].reload;
    this.me.ads = false;
    sfx.reload();
  }

  private currentSpread(): number {
    const me = this.me;
    const wd = WEAPONS[this.wpn.cur];
    let s = me.ads ? wd.adsSpread : wd.spread;
    s += (Math.hypot(me.vx, me.vz) / 6.4) * (me.ads ? 0.006 : 0.016);
    if (!me.grounded) s += 0.03;
    return s + this.wpn.bloom;
  }

  private spreadDir(f: THREE.Vector3, s: number, out: THREE.Vector3): THREE.Vector3 {
    let rx = -f.z, rz = f.x;
    const rl = Math.hypot(rx, rz) || 1;
    rx /= rl; rz /= rl;
    // up2 = right × f
    const ux = -rz * f.y, uy = rz * f.x - rx * f.z, uz = rx * f.y;
    const a = Math.random() * Math.PI * 2;
    const r = s * Math.sqrt(Math.random());
    const ca = Math.cos(a) * r, sa = Math.sin(a) * r;
    out.set(f.x + rx * ca + ux * sa, f.y + uy * sa, f.z + rz * ca + uz * sa).normalize();
    return out;
  }

  private raycastShot(o: THREE.Vector3, d: THREE.Vector3, t0: number, range: number) {
    const map = this.map as MapData;
    const ox = o.x + d.x * t0, oy = o.y + d.y * t0, oz = o.z + d.z * t0;
    let best = rayBoxes(map, ox, oy, oz, d.x, d.y, d.z, range);
    const nx = hitNormal.x, ny = hitNormal.y, nz = hitNormal.z;
    let id: string | null = null;
    let head = false;
    for (const v of this.views.values()) {
      if (!v.alive || !this.isHostile(v) || v.sh) continue;
      const h = rayHitbox(ox, oy, oz, d.x, d.y, d.z, v.x, v.y, v.z, v.scale, best);
      if (h) { best = h.t; id = v.id; head = h.head; }
    }
    if (!id && this.opts.touch) {
      // помощь в прицеливании на сенсорных экранах
      let bestAng = 0.055;
      for (const v of this.views.values()) {
        if (!v.alive || !this.isHostile(v) || v.sh) continue;
        const cx = v.x - ox, cyy = v.y + 1.1 * v.scale - oy, cz = v.z - oz;
        const dist = Math.hypot(cx, cyy, cz);
        if (dist > range || dist > best + 1) continue;
        const dot = (cx * d.x + cyy * d.y + cz * d.z) / dist;
        const ang = Math.acos(clamp(dot, -1, 1));
        if (ang < bestAng && losClear(map, ox, oy, oz, v.x, v.y + 1.1 * v.scale, v.z)) {
          bestAng = ang;
          id = v.id;
          head = false;
          best = dist;
        }
      }
    }
    return { t: best + t0, id, head, nx, ny, nz };
  }

  private fire() {
    const w = this.wpn;
    const me = this.me;
    const wd = WEAPONS[w.cur];
    w.ammo[w.cur]--;
    const o = this.aimO, f = this.aimD;
    const t0 = Math.max(0, (me.x - o.x) * f.x + (me.y + 1.3 - o.y) * f.y + (me.z - o.z) * f.z);
    const spread = this.currentSpread();
    const muzzle = this.myModel.getMuzzle(tmpM);
    const hits = new Map<string, { dmg: number; head: boolean; x: number; y: number; z: number }>();
    let first: [number, number, number] | null = null;
    for (let i = 0; i < wd.pellets; i++) {
      const d = this.spreadDir(f, spread, tmpD);
      const r = this.raycastShot(o, d, t0, wd.range);
      const px = o.x + d.x * r.t, py = o.y + d.y * r.t, pz = o.z + d.z * r.t;
      if (!first) first = [r2(px), r2(py), r2(pz)];
      if (w.cur === 'rpg') {
        this.effects.rocket(muzzle, px, py, pz);
        const dist = Math.hypot(px - muzzle.x, py - muzzle.y, pz - muzzle.z);
        this.rockets.push({ t: dist / 55, x: px - d.x * 0.25, y: py - d.y * 0.25, z: pz - d.z * 0.25 });
        continue;
      }
      if (i < 4 || wd.pellets === 1) this.effects.tracer(muzzle, px, py, pz, 0xffe27a, wd.pellets > 1 ? 0.03 : 0.045);
      if (r.id) {
        const fall = 1 - 0.5 * clamp((r.t - t0 - wd.range * 0.5) / (wd.range * 0.5), 0, 1);
        const dmg = wd.dmg * (r.head ? wd.headMul : 1) * fall;
        const h = hits.get(r.id);
        if (h) { h.dmg += dmg; h.head = h.head || r.head; }
        else hits.set(r.id, { dmg, head: r.head, x: r2(px), y: r2(py), z: r2(pz) });
        const v = this.views.get(r.id);
        this.effects.hitPuff(px, py, pz, v ? parseInt(v.look.body.slice(1), 16) : 0xffffff, wd.pellets > 1 ? 2 : 6);
      } else if (r.t < wd.range + t0 - 0.01) {
        this.effects.spark(px, py, pz, r.nx, r.ny, r.nz, 0xffd48a, wd.pellets > 1 ? 2 : 5);
      }
    }
    if (first) this.pending.push({ a: 'shot', w: w.cur, f: [r2(muzzle.x), r2(muzzle.y), r2(muzzle.z)], to: first });
    let anyHead = false;
    for (const [id, h] of hits) {
      this.pending.push({ a: 'hit', target: id, dmg: Math.round(h.dmg * 10) / 10, head: h.head, w: w.cur, x: h.x, y: h.y, z: h.z });
      this.overlay.addDamage(h.x, h.y, h.z, Math.round(h.dmg), h.head);
      const v = this.views.get(id);
      if (v) { v.model.flash(); v.hurtT = this.time; }
      anyHead = anyHead || h.head;
    }
    if (hits.size) {
      this.overlay.hitMarker(false, anyHead);
      sfx.hit(anyHead);
    }
    const adsK = me.ads ? 0.55 : 1;
    w.kick += wd.recoil * adsK;
    w.kickYaw += (Math.random() - 0.5) * wd.recoil * 0.7 * adsK;
    me.pitch += wd.recoil * 0.16 * adsK;
    w.bloom = Math.min(0.06, w.bloom + wd.spread * 0.22);
    this.addTrauma(wd.shake * 0.42 * (me.ads ? 0.6 : 1));
    this.effects.muzzle(muzzle, w.cur === 'rpg' ? 0xffa040 : 0xffd27a, w.cur === 'shotgun' || w.cur === 'rpg' ? 1.4 : 0.9);
    if (w.cur !== 'rpg') this.effects.shell(muzzle, me.yaw);
    sfx.shot(w.cur, 1);
    this.myModel.fireKick();
    if (w.ammo[w.cur] <= 0) w.autoReload = 0.3;
  }

  private updateRockets(dt: number) {
    for (let i = 0; i < this.rockets.length; i++) {
      const r = this.rockets[i];
      r.t -= dt;
      if (r.t <= 0) {
        this.rockets.splice(i, 1);
        i--;
        this.explosionFx(r.x, r.y, r.z, WEAPONS.rpg.splash);
        this.pending.push({ a: 'boom', w: 'rpg', x: r2(r.x), y: r2(r.y), z: r2(r.z) });
      }
    }
  }

  // ---------- Рендер-состояния ----------

  private updateViews(dt: number) {
    const k = 1 - Math.exp(-dt * (this.opts.transport.online ? 13 : 28));
    for (const v of this.views.values()) {
      if (!v.alive) continue;
      const dx = v.tx - v.x, dz = v.tz - v.z;
      if (dx * dx + dz * dz > 36) { v.x = v.tx; v.y = v.ty; v.z = v.tz; }
      else { v.x += dx * k; v.y += (v.ty - v.y) * k; v.z += dz * k; }
      v.ry = lerpAngle(v.ry, v.tr, k);
      v.rx += (v.trx - v.rx) * k;
      const spd = Math.hypot(v.x - v.lx, v.z - v.lz) / Math.max(dt, 0.001);
      v.lx = v.x; v.lz = v.z;
      v.spd += (Math.min(12, spd) - v.spd) * Math.min(1, dt * 10);
      const m = v.model;
      m.root.position.set(v.x, v.y, v.z);
      m.root.rotation.y = v.ry;
      m.animate(dt, {
        speed: (v.mv & MV_MOVE) !== 0 ? Math.max(v.spd, 2) : v.spd * 0.5,
        grounded: (v.mv & MV_GROUND) !== 0,
        back: (v.mv & MV_BACK) !== 0,
        sprint: (v.mv & MV_SPRINT) !== 0,
        pitch: v.rx,
        firing: (v.mv & MV_FIRE) !== 0,
      });
      m.setShield(v.sh);
    }
    const me = this.me;
    if (me.alive && this.phase !== 'lobby' && this.phase !== 'over') {
      const m = this.myModel;
      const scoped = me.ads && WEAPONS[this.wpn.cur].zoom > 2 && this.fov < 40;
      m.root.visible = !scoped;
      m.root.position.set(me.x, me.y, me.z);
      m.root.rotation.y = me.yaw;
      m.animate(dt, { speed: Math.hypot(me.vx, me.vz), grounded: me.grounded, back: me.back, sprint: me.sprint, pitch: me.pitch + this.wpn.kick, firing: this.input.fire() });
      m.setShield(me.sh);
      const g = this.map ? groundAt(this.map, me.x, me.z, PLAYER_RADIUS, me.y, STEP_UP) : 0;
      m.blob.position.y = (g - me.y) / m.scale + 0.03;
    } else if (!me.alive) {
      this.myModel.root.visible = false;
    }
  }

  private updatePacks(dt: number) {
    for (const p of this.packs) {
      p.group.visible = p.on;
      if (!p.on) continue;
      p.group.rotation.y += dt * 1.6;
      p.group.position.y = 0.9 + Math.sin(this.time * 3 + p.x) * 0.15;
    }
  }

  private updateCamera(dt: number) {
    const cam = this.camera;
    const me = this.me;
    let targetFov = this.baseFov;
    const map = this.map;
    if ((this.phase === 'play' || this.phase === 'countdown') && me.alive && map) {
      const wd = WEAPONS[this.wpn.cur];
      if (me.ads) targetFov = this.baseFov / wd.zoom;
      else if (me.sprint) targetFov = this.baseFov + 7;
      const yaw = me.yaw + this.wpn.kickYaw;
      const pitch = me.pitch + this.wpn.kick;
      const cp = Math.cos(pitch), sp = Math.sin(pitch), cyw = Math.cos(yaw), syw = Math.sin(yaw);
      const fx = -syw * cp, fy = sp, fz = -cyw * cp;
      const rx = cyw, rz = -syw;
      this.camY += (me.y - this.camY) * Math.min(1, dt * 16);
      const headY = this.camY + 1.6;
      let shoulder = me.ads ? 0.55 : 0.72;
      const ts = rayBoxes(map, me.x, headY, me.z, rx, 0, rz, shoulder + 0.3);
      shoulder = Math.max(0, Math.min(shoulder, ts - 0.3));
      const px = me.x + rx * shoulder, py = headY + 0.12, pz = me.z + rz * shoulder;
      const want = me.ads ? 1.75 : 3.3;
      const tc = rayBoxes(map, px, py, pz, -fx, -fy, -fz, want + 0.3);
      const dist = Math.max(0.35, Math.min(want, tc - 0.3));
      this.camDist = dist < this.camDist ? dist : this.camDist + (dist - this.camDist) * Math.min(1, dt * 5);
      cam.position.set(px - fx * this.camDist, py - fy * this.camDist, pz - fz * this.camDist);
      if (cam.position.y < 0.25) cam.position.y = 0.25;
      cam.rotation.set(pitch, yaw, 0, 'YXZ');
      this.aimO.copy(cam.position);
      this.aimD.set(fx, fy, fz);
    } else if (this.phase === 'dying' || this.phase === 'exam') {
      this.orbitA += dt * 0.22;
      const r = 7.5;
      const d = this.deathPos;
      cam.position.set(d.x + Math.sin(this.orbitA) * r, d.y + 5.2, d.z + Math.cos(this.orbitA) * r);
      cam.lookAt(d.x, d.y + 0.8, d.z);
    } else {
      this.orbitA += dt * 0.07;
      const H = map?.half ?? 30;
      cam.position.set(Math.sin(this.orbitA) * H * 1.05, H * 0.6, Math.cos(this.orbitA) * H * 1.05);
      cam.lookAt(0, 0, 0);
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const sh = this.trauma * this.trauma * (this.opts.prefs.shake ? 1 : 0.2);
    if (sh > 0.0005) {
      const t = this.time;
      cam.rotation.x += Math.sin(t * 37.3) * Math.sin(t * 13.1 + 1) * 0.045 * sh;
      cam.rotation.y += Math.sin(t * 29.7 + 2) * Math.sin(t * 11.3) * 0.045 * sh;
      cam.rotation.z += Math.sin(t * 23.1 + 4) * 0.05 * sh;
      cam.position.x += Math.sin(t * 41.3) * 0.18 * sh;
      cam.position.y += Math.sin(t * 33.7 + 1) * 0.18 * sh;
    }
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 12);
    if (Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
    }
  }

  private drawOverlay(dt: number) {
    const tags: Tag[] = [];
    const dots: Dot[] = [];
    const cx = this.camera.position.x, cz = this.camera.position.z;
    for (const v of this.views.values()) {
      if (!v.alive) continue;
      const dist = Math.hypot(v.x - cx, v.z - cz);
      const hostile = this.isHostile(v);
      if (!v.bot) {
        if (dist < 60) tags.push({ x: v.x, y: v.y + 2.25, z: v.z, name: v.name, color: hostile ? '#ff9a6a' : '#7fe9ff', hp: v.hp, mhp: v.mhp, showHp: true, dist });
      } else if (this.time - v.hurtT < 3 && dist < 50 && v.kind) {
        tags.push({ x: v.x, y: v.y + 2.15 * v.scale, z: v.z, name: BOTS[v.kind].name, color: '#ff6b6b', hp: v.hp, mhp: v.mhp, showHp: true, dist });
      }
      dots.push({ x: v.x, z: v.z, color: v.bot ? '#ff4d4d' : hostile ? '#ffa24d' : '#4de1ff', r: v.kind === 'heavy' ? 4.5 : 3.2 });
    }
    for (const p of this.packs) if (p.on) dots.push({ x: p.x, z: p.z, color: '#3ddc84', r: 4, pack: true });
    this.vignette = Math.max(0, this.vignette - dt * 1.4);
    const alive = this.me.alive && (this.phase === 'play' || this.phase === 'countdown');
    const wd = WEAPONS[this.wpn.cur];
    const spread = this.currentSpread();
    const spreadPx = (Math.tan(spread) / Math.tan(((this.fov * Math.PI) / 180) / 2)) * (this.viewH / 2);
    const lowHp = alive && this.me.hp < 35 ? (1 - this.me.hp / 35) * (0.6 + Math.sin(this.time * 6) * 0.4) : 0;
    this.overlay.draw(dt, {
      camera: this.camera,
      tags,
      dots,
      me: alive ? { x: this.me.x, z: this.me.z, yaw: this.me.yaw } : null,
      crosshair: {
        show: alive && !this.paused,
        spreadPx,
        scope: alive && this.me.ads && wd.zoom > 2 && this.fov < 40,
        reload: this.wpn.reloadT > 0 ? 1 - this.wpn.reloadT / wd.reload : 0,
      },
      vignette: this.vignette,
      lowHp,
    });
  }

  private emitHud() {
    const m = this.match;
    const n = this.myNet;
    const now = this.serverNow();
    let timeLeft = 0, countdown = 0;
    if (m) {
      if (m.state === 'countdown') {
        timeLeft = (m.endsAt - m.startsAt) / 1000;
        countdown = Math.max(0, (m.startsAt - now) / 1000);
      } else if (m.state === 'playing') timeLeft = Math.max(0, (m.endsAt - now) / 1000);
    }
    let botsAlive = 0;
    for (const v of this.views.values()) if (v.bot && v.alive) botsAlive++;
    const w = this.wpn;
    this.events.hud({
      hp: this.me.hp, shield: this.me.sh, weapon: w.cur, primary: w.primary, ammo: w.ammo[w.cur] ?? 0, mag: WEAPONS[w.cur].mag,
      reload: w.reloadT > 0 ? 1 - w.reloadT / WEAPONS[w.cur].reload : -1,
      score: n?.score ?? 0, kills: n?.kills ?? 0, bk: n?.bk ?? 0, deaths: n?.deaths ?? 0, ok: n?.ok ?? 0, qa: n?.qa ?? 0,
      timeLeft, countdown, state: m?.state ?? 'lobby', mode: m?.settings.mode ?? 'coop', wave: m?.wave ?? 1,
      teamBotKills: m?.teamBotKills ?? 0, ping: Math.round(this.opts.transport.rtt), online: this.opts.transport.online, botsAlive,
      streak: n?.streak ?? 0,
    });
  }

  private countdownSounds() {
    const m = this.match;
    if (!m) return;
    if (m.state === 'countdown') {
      const s = Math.ceil((m.startsAt - this.serverNow()) / 1000);
      if (s !== this.lastCd && s >= 1 && s <= 3) sfx.countdown(false);
      this.lastCd = s;
    } else if (m.state === 'playing' && this.lastCd > 0) {
      this.lastCd = 0;
      sfx.countdown(true);
    }
  }

  private frame = (t: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    let dt = (t - this.lastT) / 1000;
    this.lastT = t;
    if (!(dt > 0)) dt = 0.016;
    if (dt > 0.1) dt = 0.1;
    this.time += dt;
    if (dt > 0) {
      const inst = 1 / dt;
      this.emaFps += (Math.min(120, inst) - this.emaFps) * Math.min(1, dt * 2);
    }
    this.fpsEmitT -= dt;
    if (this.fpsEmitT <= 0) {
      this.fpsEmitT = 0.5;
      this.events.fps?.(Math.round(this.emaFps));
    }
    if (this.opts.prefs.autoQuality) {
      this.autoQT -= dt;
      if (this.autoQT <= 0) {
        this.autoQT = 2;
        if (this.emaFps < 45 && this.curPR > 0.8) {
          this.curPR = Math.max(0.8, this.curPR - 0.2);
          this.renderer.setPixelRatio(this.curPR);
          this.effects.detail = Math.max(0.45, this.curPR / this.basePR);
        } else if (this.emaFps > 57 && this.curPR < this.basePR) {
          this.curPR = Math.min(this.basePR, this.curPR + 0.1);
          this.renderer.setPixelRatio(this.curPR);
          this.effects.detail = Math.max(0.45, this.curPR / this.basePR);
        }
      }
    }
    this.opts.transport.tick(this.buildUpdate);
    const snap = this.opts.transport.take();
    if (snap) this.applySnapshot(snap);
    if (this.phase === 'dying') {
      this.dyingT -= dt;
      if (this.dyingT <= 0) this.setPhase('exam');
    }
    this.updateLocal(dt);
    this.updateRockets(dt);
    this.updateViews(dt);
    this.updatePacks(dt);
    this.effects.update(dt);
    this.updateCamera(dt);
    if (this.world) this.world.update(dt, this.camera.position);
    this.renderer.render(this.scene, this.camera);
    this.drawOverlay(dt);
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 1 / 15;
      this.emitHud();
    }
    this.countdownSounds();
  };
}

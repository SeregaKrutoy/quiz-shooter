import { RoomSim } from '../shared/sim';
import { ClientUpdate, ExamPack, MatchSettings, Snapshot } from '../shared/types';
import type { Profile } from './storage';

export type ControlAction = 'start' | 'restart' | 'lobby' | 'settings';

export interface Transport {
  readonly online: boolean;
  readonly playerId: string;
  rtt: number;
  tick(getUpdate: () => ClientUpdate): void;
  take(): Snapshot | null;
  control(action: ControlAction, settings?: MatchSettings): Promise<string | null>;
  /** Вопросы своих экзаменов комнаты (не входят в снимки из-за размера). */
  getPacks(): Promise<ExamPack[]>;
  setPaused(p: boolean): void;
  leave(): void;
  onFatal: ((msg: string) => void) | null;
}

/** Одиночная игра: вся симуляция прямо в браузере, без задержек. */
export class LocalTransport implements Transport {
  readonly online = false;
  readonly playerId = 'me';
  rtt = 0;
  onFatal: ((msg: string) => void) | null = null;
  private sim: RoomSim;
  private seq = 0;
  private snap: Snapshot | null = null;
  private paused = false;
  private pausedAt = 0;
  private pausedTotal = 0;
  private lastSnapshot = 0;

  constructor(settings: MatchSettings, profile: Profile) {
    this.sim = new RoomSim('SOLO', 'Одиночная игра', settings, false);
    const now = this.vnow();
    this.sim.addPlayer(this.playerId, 'local', profile.name, profile.look, now);
    this.sim.start(now);
  }

  private vnow() {
    return Date.now() - this.pausedTotal;
  }

  tick(getUpdate: () => ClientUpdate) {
    if (this.paused) return;
    const now = this.vnow();
    this.sim.applyUpdate(this.playerId, getUpdate(), now);
    this.sim.advance(now);
    // Симуляция фиксирована на 30 Гц; не создаём массивы снимка 60–120 раз/с.
    if (now - this.lastSnapshot < 33) return;
    this.lastSnapshot = now;
    const s = this.sim.snapshot(this.playerId, this.seq, now);
    this.seq = s.seq;
    if (this.snap) s.events = [...this.snap.events, ...s.events];
    this.snap = s;
  }

  take() {
    const s = this.snap;
    this.snap = null;
    return s;
  }

  async control(action: ControlAction): Promise<string | null> {
    if (action === 'restart' || action === 'start') this.sim.start(this.vnow());
    return null;
  }

  async getPacks(): Promise<ExamPack[]> {
    return this.sim.settings.packs;
  }

  setPaused(p: boolean) {
    if (p === this.paused) return;
    if (p) this.pausedAt = Date.now();
    else {
      this.pausedTotal += Date.now() - this.pausedAt;
      this.sim.lastStep = this.vnow();
    }
    this.paused = p;
  }

  leave() {}
}

/** Сетевая игра: опрос сервера ~25 раз в секунду (локальная сеть или интернет). */
export class OnlineTransport implements Transport {
  readonly online = true;
  rtt = 0;
  onFatal: ((msg: string) => void) | null = null;
  private seq = 0;
  private snap: Snapshot | null = null;
  private inflight = false;
  private lastSend = 0;
  private fails = 0;
  private closed = false;
  private activeMatch = false;
  private paused = false;

  constructor(public readonly code: string, public readonly playerId: string, private readonly secret: string) {
    if (typeof window !== 'undefined') window.addEventListener('pagehide', this.onHide);
  }

  private onHide = () => this.leave();

  private fail(msg: string) {
    if (this.closed) return;
    this.closed = true;
    this.onFatal?.(msg);
  }

  tick(getUpdate: () => ClientUpdate) {
    if (this.closed || this.inflight) return;
    const now = performance.now();
    // 20 Гц достаточно благодаря интерполяции; в лобби и паузе снижаем нагрузку ещё сильнее.
    const gap = document.hidden ? 400 : this.paused ? 100 : this.activeMatch ? 50 : 120;
    if (now - this.lastSend < gap) return;
    this.lastSend = now;
    this.inflight = true;
    const upd = getUpdate();
    fetch(`/api/rooms/${this.code}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: this.playerId, secret: this.secret, since: this.seq, upd }),
      cache: 'no-store',
    })
      .then(async (r) => {
        if (r.status === 404 || r.status === 403) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          this.fail(j.error || 'Соединение с комнатой потеряно');
          return;
        }
        if (!r.ok) throw new Error('bad status');
        const s = (await r.json()) as Snapshot;
        this.activeMatch = s.match.state === 'playing' || s.match.state === 'countdown';
        const dt = performance.now() - now;
        this.rtt = this.rtt ? this.rtt * 0.8 + dt * 0.2 : dt;
        this.fails = 0;
        if (s.seq > this.seq) this.seq = s.seq;
        if (this.snap) s.events = [...this.snap.events, ...s.events];
        this.snap = s;
      })
      .catch(() => {
        this.fails++;
        if (this.fails > 40) this.fail('Нет связи с сервером');
      })
      .finally(() => {
        this.inflight = false;
      });
  }

  take() {
    const s = this.snap;
    this.snap = null;
    return s;
  }

  async control(action: ControlAction, settings?: MatchSettings): Promise<string | null> {
    try {
      const r = await fetch(`/api/rooms/${this.code}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: this.playerId, secret: this.secret, action, settings }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      return r.ok ? null : j.error || 'Ошибка';
    } catch {
      return 'Нет связи с сервером';
    }
  }

  async getPacks(): Promise<ExamPack[]> {
    try {
      const r = await fetch(`/api/rooms/${this.code}/packs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: this.playerId, secret: this.secret }),
        cache: 'no-store',
      });
      if (!r.ok) return [];
      const j = (await r.json()) as { packs?: ExamPack[] };
      return Array.isArray(j.packs) ? j.packs : [];
    } catch {
      return [];
    }
  }

  setPaused(p: boolean) {
    this.paused = p;
  }

  leave() {
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', this.onHide);
    const wasClosed = this.closed;
    this.closed = true;
    if (wasClosed && this.fails === 0 && this.seq === 0) return;
    try {
      const body = JSON.stringify({ id: this.playerId, secret: this.secret });
      if (!navigator.sendBeacon?.(`/api/rooms/${this.code}/leave`, body)) {
        fetch(`/api/rooms/${this.code}/leave`, { method: 'POST', body, keepalive: true }).catch(() => {});
      }
    } catch {
      // игнор
    }
  }
}

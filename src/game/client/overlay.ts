import * as THREE from 'three';

export interface Tag {
  x: number;
  y: number;
  z: number;
  name: string;
  color: string;
  hp: number;
  mhp: number;
  showHp: boolean;
  dist: number;
}

export interface Dot {
  x: number;
  z: number;
  color: string;
  r: number;
  pack?: boolean;
}

export interface OverlayFrame {
  camera: THREE.PerspectiveCamera;
  tags: Tag[];
  dots: Dot[];
  me: { x: number; z: number; yaw: number } | null;
  crosshair: { show: boolean; spreadPx: number; scope: boolean; reload: number };
  vignette: number;
  lowHp: number;
}

interface DmgNum {
  x: number;
  y: number;
  z: number;
  text: string;
  t: number;
  head: boolean;
  ox: number;
}

export class Overlay {
  private ctx: CanvasRenderingContext2D;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private nums: DmgNum[] = [];
  private hitT = 0;
  private hitKill = false;
  private hitHead = false;
  private dirs: { x: number; z: number; t: number }[] = [];
  private minimap: HTMLCanvasElement | null = null;
  private half = 30;
  private v = new THREE.Vector3();

  constructor(private canvas: HTMLCanvasElement, private mobile: boolean) {
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  }

  resize(w: number, h: number) {
    this.dpr = Math.min(window.devicePixelRatio || 1, this.mobile ? 1.2 : 1.5);
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
  }

  setMinimap(c: HTMLCanvasElement, half: number) {
    this.minimap = c;
    this.half = half;
  }

  addDamage(x: number, y: number, z: number, amount: number, head: boolean) {
    if (this.nums.length > 28) this.nums.shift();
    this.nums.push({ x, y, z, text: String(amount), t: 0, head, ox: (Math.random() - 0.5) * 30 });
  }

  hitMarker(kill: boolean, head: boolean) {
    this.hitT = kill ? 0.4 : 0.22;
    this.hitKill = kill;
    this.hitHead = head;
  }

  addDamageDir(x: number, z: number) {
    if (this.dirs.length > 6) this.dirs.shift();
    this.dirs.push({ x, z, t: 1.2 });
  }

  private project(x: number, y: number, z: number, cam: THREE.PerspectiveCamera): [number, number] | null {
    this.v.set(x, y, z).project(cam);
    if (this.v.z > 1 || this.v.z < -1) return null;
    return [(this.v.x * 0.5 + 0.5) * this.w, (-this.v.y * 0.5 + 0.5) * this.h];
  }

  draw(dt: number, f: OverlayFrame) {
    const ctx = this.ctx;
    const w = this.w, h = this.h;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;

    // красная виньетка
    const va = Math.min(0.75, f.vignette * 0.6 + f.lowHp * 0.35);
    if (va > 0.01) {
      const g = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.3, cx, cy, Math.max(w, h) * 0.75);
      g.addColorStop(0, 'rgba(255,20,50,0)');
      g.addColorStop(1, `rgba(255,20,50,${va})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    // метки над головами
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (const t of f.tags) {
      const p = this.project(t.x, t.y, t.z, f.camera);
      if (!p) continue;
      const alpha = Math.max(0, Math.min(1, 1 - (t.dist - 30) / 25));
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      const size = Math.max(10, Math.min(14, 16 - t.dist * 0.08));
      ctx.font = `700 ${size}px system-ui, sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(t.name, p[0], p[1] - 7);
      ctx.fillStyle = t.color;
      ctx.fillText(t.name, p[0], p[1] - 7);
      if (t.showHp) {
        const bw = 46, bh = 5;
        const k = Math.max(0, Math.min(1, t.hp / t.mhp));
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(p[0] - bw / 2 - 1, p[1] - 5, bw + 2, bh + 2);
        ctx.fillStyle = k > 0.5 ? '#3ddc84' : k > 0.25 ? '#ffc53d' : '#ff4d6d';
        ctx.fillRect(p[0] - bw / 2, p[1] - 4, bw * k, bh);
      }
    }
    ctx.globalAlpha = 1;

    // цифры урона
    ctx.textBaseline = 'middle';
    for (let i = 0; i < this.nums.length; i++) {
      const n = this.nums[i];
      n.t += dt;
      if (n.t > 0.9) {
        this.nums.splice(i, 1);
        i--;
        continue;
      }
      const p = this.project(n.x, n.y + n.t * 1.3, n.z, f.camera);
      if (!p) continue;
      const pop = n.t < 0.1 ? 1.5 - n.t * 5 : 1;
      const size = (n.head ? 26 : 19) * pop;
      ctx.globalAlpha = 1 - Math.pow(n.t / 0.9, 2);
      ctx.font = `900 ${size}px system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText(n.text, p[0] + n.ox * n.t, p[1]);
      ctx.fillStyle = n.head ? '#ffd23d' : '#ffffff';
      ctx.fillText(n.text, p[0] + n.ox * n.t, p[1]);
    }
    ctx.globalAlpha = 1;

    // прицел
    const ch = f.crosshair;
    if (ch.show) {
      if (ch.scope) {
        const r = Math.min(w, h) * 0.42;
        ctx.fillStyle = 'rgba(0,0,0,0.92)';
        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
        ctx.fill('evenodd');
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - r, cy); ctx.lineTo(cx - 8, cy);
        ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + r, cy);
        ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy - 8);
        ctx.moveTo(cx, cy + 8); ctx.lineTo(cx, cy + r);
        ctx.stroke();
        ctx.fillStyle = '#ff3b5c';
        ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
      } else {
        const gap = 5 + Math.min(60, ch.spreadPx);
        const len = 8;
        const line = (x1: number, y1: number, x2: number, y2: number) => {
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        };
        for (const [col, lw] of [['rgba(0,0,0,0.6)', 4], ['#ffffff', 2]] as const) {
          ctx.strokeStyle = col;
          ctx.lineWidth = lw;
          line(cx - gap - len, cy, cx - gap, cy);
          line(cx + gap, cy, cx + gap + len, cy);
          line(cx, cy - gap - len, cx, cy - gap);
          line(cx, cy + gap, cx, cy + gap + len);
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 1, cy - 1, 2, 2);
      }
      if (ch.reload > 0) {
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#ffc53d';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, cy, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ch.reload); ctx.stroke();
      }
    }

    // хитмаркер
    if (this.hitT > 0) {
      this.hitT -= dt;
      const k = Math.max(0, this.hitT / (this.hitKill ? 0.4 : 0.22));
      const s = (this.hitKill ? 14 : 9) + (1 - k) * 6;
      const inner = 5;
      ctx.globalAlpha = Math.min(1, k * 1.5);
      ctx.strokeStyle = this.hitKill ? '#ff3b5c' : this.hitHead ? '#ffd23d' : '#ffffff';
      ctx.lineWidth = this.hitKill ? 3.5 : 2.5;
      ctx.beginPath();
      for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        ctx.moveTo(cx + sx * inner, cy + sy * inner);
        ctx.lineTo(cx + sx * s, cy + sy * s);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // направление урона
    if (f.me) {
      const { x: mx, z: mz, yaw } = f.me;
      const cs = Math.cos(yaw), sn = Math.sin(yaw);
      for (let i = 0; i < this.dirs.length; i++) {
        const d = this.dirs[i];
        d.t -= dt;
        if (d.t <= 0) {
          this.dirs.splice(i, 1);
          i--;
          continue;
        }
        const dx = d.x - mx, dz = d.z - mz;
        const lx = dx * cs - dz * sn;
        const lz = -dx * sn - dz * cs;
        const ang = Math.atan2(lx, lz) - Math.PI / 2;
        ctx.strokeStyle = `rgba(255,50,70,${Math.min(0.9, d.t)})`;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.min(w, h) * 0.17, ang - 0.3, ang + 0.3);
        ctx.stroke();
      }
    }

    // мини-карта
    if (this.minimap && f.me) {
      const size = this.mobile ? 108 : 156;
      const x0 = w - size - 14;
      const y0 = this.mobile ? 10 : 14;
      const mcx = x0 + size / 2, mcy = y0 + size / 2;
      const zoom = size / 54;
      ctx.save();
      ctx.beginPath();
      ctx.arc(mcx, mcy, size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = 'rgba(10,14,28,0.85)';
      ctx.fillRect(x0, y0, size, size);
      ctx.translate(mcx, mcy);
      ctx.rotate(f.me.yaw);
      ctx.globalAlpha = 0.95;
      ctx.drawImage(this.minimap, (-this.half - f.me.x) * zoom, (-this.half - f.me.z) * zoom, this.half * 2 * zoom, this.half * 2 * zoom);
      ctx.globalAlpha = 1;
      for (const d of f.dots) {
        const px = (d.x - f.me.x) * zoom, pz = (d.z - f.me.z) * zoom;
        if (d.pack) {
          ctx.fillStyle = d.color;
          ctx.fillRect(px - 4, pz - 1.5, 8, 3);
          ctx.fillRect(px - 1.5, pz - 4, 3, 8);
        } else {
          ctx.fillStyle = d.color;
          ctx.beginPath();
          ctx.arc(px, pz, d.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mcx, mcy, size / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(mcx, mcy - 7);
      ctx.lineTo(mcx + 5, mcy + 5);
      ctx.lineTo(mcx, mcy + 2);
      ctx.lineTo(mcx - 5, mcy + 5);
      ctx.closePath();
      ctx.fill();
    }
  }
}

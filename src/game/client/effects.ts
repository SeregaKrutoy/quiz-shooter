import * as THREE from 'three';
import { getGlowTexture } from './world';

const tmpColor = new THREE.Color();

class ParticlePool {
  mesh: THREE.InstancedMesh;
  private n = 0;
  private px: Float32Array; private py: Float32Array; private pz: Float32Array;
  private vx: Float32Array; private vy: Float32Array; private vz: Float32Array;
  private life: Float32Array; private max: Float32Array; private size: Float32Array;
  private grav: Float32Array; private drag: Float32Array; private rot: Float32Array; private spin: Float32Array;
  private bounce: Uint8Array; private grow: Float32Array;
  private cr: Float32Array; private cg: Float32Array; private cb: Float32Array;
  private colArr: Float32Array;
  constructor(scene: THREE.Scene, private cap: number, private additive: boolean) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: additive,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: !additive,
      fog: !additive,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.colArr = new Float32Array(cap * 3);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(this.colArr, 3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    const f = () => new Float32Array(cap);
    this.px = f(); this.py = f(); this.pz = f(); this.vx = f(); this.vy = f(); this.vz = f();
    this.life = f(); this.max = f(); this.size = f(); this.grav = f(); this.drag = f(); this.rot = f(); this.spin = f();
    this.grow = f(); this.cr = f(); this.cg = f(); this.cb = f();
    this.bounce = new Uint8Array(cap);
    scene.add(this.mesh);
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: number, grav: number, drag: number, bounce = false, grow = 0) {
    let i = this.n;
    if (i >= this.cap) i = Math.floor(Math.random() * this.cap);
    else this.n++;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z;
    this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.life[i] = life; this.max[i] = life; this.size[i] = size;
    this.grav[i] = grav; this.drag[i] = drag; this.bounce[i] = bounce ? 1 : 0; this.grow[i] = grow;
    this.rot[i] = Math.random() * 6; this.spin[i] = (Math.random() - 0.5) * 14;
    tmpColor.setHex(color);
    this.cr[i] = tmpColor.r; this.cg[i] = tmpColor.g; this.cb[i] = tmpColor.b;
  }

  private copy(from: number, to: number) {
    this.px[to] = this.px[from]; this.py[to] = this.py[from]; this.pz[to] = this.pz[from];
    this.vx[to] = this.vx[from]; this.vy[to] = this.vy[from]; this.vz[to] = this.vz[from];
    this.life[to] = this.life[from]; this.max[to] = this.max[from]; this.size[to] = this.size[from];
    this.grav[to] = this.grav[from]; this.drag[to] = this.drag[from]; this.bounce[to] = this.bounce[from];
    this.rot[to] = this.rot[from]; this.spin[to] = this.spin[from]; this.grow[to] = this.grow[from];
    this.cr[to] = this.cr[from]; this.cg[to] = this.cg[from]; this.cb[to] = this.cb[from];
  }

  update(dt: number) {
    const m = this.mesh.instanceMatrix.array as Float32Array;
    const col = this.colArr;
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.n--;
        if (i !== this.n) this.copy(this.n, i);
        i--;
        continue;
      }
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vx[i] *= dr; this.vz[i] *= dr;
      this.vy[i] = this.vy[i] * dr - this.grav[i] * dt;
      this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt; this.pz[i] += this.vz[i] * dt;
      if (this.bounce[i] && this.py[i] < 0.05) {
        this.py[i] = 0.05;
        this.vy[i] = -this.vy[i] * 0.35;
        this.vx[i] *= 0.6; this.vz[i] *= 0.6;
        this.spin[i] *= 0.6;
      }
      this.rot[i] += this.spin[i] * dt;
      const f = this.life[i] / this.max[i];
      const s = this.size[i] * (this.additive ? 0.4 + 0.6 * f : Math.min(1, f * 3)) * (1 + this.grow[i] * (1 - f));
      const a = this.rot[i], b = a * 0.7;
      const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      const o = i * 16;
      m[o] = ca * s; m[o + 1] = 0; m[o + 2] = -sa * s; m[o + 3] = 0;
      m[o + 4] = sa * sb * s; m[o + 5] = cb * s; m[o + 6] = ca * sb * s; m[o + 7] = 0;
      m[o + 8] = sa * cb * s; m[o + 9] = -sb * s; m[o + 10] = ca * cb * s; m[o + 11] = 0;
      m[o + 12] = this.px[i]; m[o + 13] = this.py[i]; m[o + 14] = this.pz[i]; m[o + 15] = 1;
      const k = this.additive ? f : 1;
      col[i * 3] = this.cr[i] * k; col[i * 3 + 1] = this.cg[i] * k; col[i * 3 + 2] = this.cb[i] * k;
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

interface Tracer { fx: number; fy: number; fz: number; dx: number; dy: number; dz: number; len: number; t: number; speed: number; w: number; r: number; g: number; b: number }
interface Rocket { mesh: THREE.Mesh; fx: number; fy: number; fz: number; dx: number; dy: number; dz: number; len: number; t: number; trail: number; active: boolean }
interface Flash { sprite: THREE.Sprite; t: number; max: number; size: number }
interface Ring { mesh: THREE.Mesh; t: number; max: number; r: number }

export class Effects {
  detail = 1;
  private solid: ParticlePool;
  private glow: ParticlePool;
  private tracerMesh: THREE.InstancedMesh;
  private tracers: Tracer[] = [];
  private flashes: Flash[] = [];
  private rings: Ring[] = [];
  private rockets: Rocket[] = [];
  private light: THREE.PointLight | null = null;
  private lightT = 0;
  private scene: THREE.Scene;
  private m4 = new THREE.Matrix4();
  private rocketGeo: THREE.CylinderGeometry;
  private rocketMat: THREE.MeshBasicMaterial;
  private ringGeo: THREE.RingGeometry;

  constructor(scene: THREE.Scene, quality: 'low' | 'high') {
    this.scene = scene;
    this.solid = new ParticlePool(scene, quality === 'high' ? 650 : 320, false);
    this.glow = new ParticlePool(scene, quality === 'high' ? 500 : 260, true);
    const tg = new THREE.BoxGeometry(1, 1, 1);
    tg.translate(0, 0, -0.5);
    const tm = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
    this.tracerMesh = new THREE.InstancedMesh(tg, tm, 64);
    this.tracerMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(64 * 3), 3);
    this.tracerMesh.count = 0;
    this.tracerMesh.frustumCulled = false;
    scene.add(this.tracerMesh);
    const glowTex = getGlowTexture();
    for (let i = 0; i < 12; i++) {
      const sm = new THREE.SpriteMaterial({ map: glowTex, color: '#ffd27a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      const sp = new THREE.Sprite(sm);
      sp.visible = false;
      scene.add(sp);
      this.flashes.push({ sprite: sp, t: 0, max: 1, size: 1 });
    }
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 40);
    this.ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 6; i++) {
      const rm = new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
      const mesh = new THREE.Mesh(this.ringGeo, rm);
      mesh.visible = false;
      scene.add(mesh);
      this.rings.push({ mesh, t: 0, max: 1, r: 1 });
    }
    this.rocketGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.6, 8);
    this.rocketGeo.rotateX(Math.PI / 2);
    this.rocketMat = new THREE.MeshBasicMaterial({ color: '#ffb347' });
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(this.rocketGeo, this.rocketMat);
      mesh.visible = false;
      scene.add(mesh);
      this.rockets.push({ mesh, fx: 0, fy: 0, fz: 0, dx: 0, dy: 0, dz: 1, len: 0, t: 0, trail: 0, active: false });
    }
    if (quality === 'high') {
      this.light = new THREE.PointLight('#ffb060', 0, 22, 1.6);
      scene.add(this.light);
    }
  }

  tracer(from: THREE.Vector3, tx: number, ty: number, tz: number, color: number, width = 0.045) {
    const dx = tx - from.x, dy = ty - from.y, dz = tz - from.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.3) return;
    if (this.tracers.length >= 64) this.tracers.shift();
    tmpColor.setHex(color);
    this.tracers.push({ fx: from.x, fy: from.y, fz: from.z, dx: dx / len, dy: dy / len, dz: dz / len, len, t: 0, speed: 260, w: width, r: tmpColor.r, g: tmpColor.g, b: tmpColor.b });
  }

  muzzle(p: THREE.Vector3, color: number, size = 0.9) {
    const f = this.flashes.find((q) => q.t <= 0) ?? this.flashes[0];
    f.t = f.max = 0.06;
    f.size = size * (0.8 + Math.random() * 0.4);
    f.sprite.position.copy(p);
    (f.sprite.material as THREE.SpriteMaterial).color.setHex(color);
    (f.sprite.material as THREE.SpriteMaterial).rotation = Math.random() * 6;
    f.sprite.visible = true;
    for (let i = 0; i < 3; i++) {
      this.glow.spawn(p.x, p.y, p.z, (Math.random() - 0.5) * 3, (Math.random() - 0.2) * 3, (Math.random() - 0.5) * 3, 0.12, 0.06, color, 0, 2);
    }
  }

  flashAt(x: number, y: number, z: number, color: number, size: number, dur: number) {
    const f = this.flashes.find((q) => q.t <= 0) ?? this.flashes[0];
    f.t = f.max = dur;
    f.size = size;
    f.sprite.position.set(x, y, z);
    (f.sprite.material as THREE.SpriteMaterial).color.setHex(color);
    f.sprite.visible = true;
  }

  spark(x: number, y: number, z: number, nx: number, ny: number, nz: number, color: number, n = 6) {
    n = Math.max(2, Math.round(n * this.detail));
    for (let i = 0; i < n; i++) {
      const s = 3 + Math.random() * 5;
      this.glow.spawn(x, y, z, (nx + (Math.random() - 0.5) * 1.4) * s, (ny + Math.random() * 0.8) * s, (nz + (Math.random() - 0.5) * 1.4) * s, 0.18 + Math.random() * 0.15, 0.05, color, 14, 1);
    }
    this.solid.spawn(x + nx * 0.05, y + ny * 0.05, z + nz * 0.05, nx * 0.6, 0.4 + ny * 0.6, nz * 0.6, 0.5, 0.12, 0x9a9488, 0.5, 3, false, 1.5);
  }

  hitPuff(x: number, y: number, z: number, color: number, n = 6) {
    n = Math.max(2, Math.round(n * this.detail));
    for (let i = 0; i < n; i++) {
      this.solid.spawn(x, y, z, (Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5, 0.35 + Math.random() * 0.3, 0.07 + Math.random() * 0.06, color, 14, 1.5, true);
    }
    this.glow.spawn(x, y, z, 0, 0, 0, 0.08, 0.35, 0xffffff, 0, 0);
  }

  shatter(x: number, y: number, z: number, colors: number[], scale = 1) {
    for (let i = 0; i < 34 * this.detail; i++) {
      const c = colors[i % colors.length];
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 6;
      this.solid.spawn(
        x + (Math.random() - 0.5) * 0.5 * scale, y + (0.2 + Math.random() * 1.6) * scale, z + (Math.random() - 0.5) * 0.5 * scale,
        Math.cos(a) * s, 3 + Math.random() * 6, Math.sin(a) * s,
        1.2 + Math.random() * 0.9, (0.1 + Math.random() * 0.14) * scale, c, 18, 0.6, true,
      );
    }
    for (let i = 0; i < 16 * this.detail; i++) {
      const a = Math.random() * Math.PI * 2;
      this.glow.spawn(x, y + 1 * scale, z, Math.cos(a) * 7, (Math.random() - 0.3) * 6, Math.sin(a) * 7, 0.35, 0.1, 0xfff1c0, 6, 2);
    }
    this.ring(x, y + 0.05, z, 0xffffff, 2.6 * scale, 0.35);
  }

  dust(x: number, y: number, z: number, n: number, color = 0xcfc6b4) {
    n = Math.max(1, Math.round(n * this.detail));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.solid.spawn(x + Math.cos(a) * 0.3, y + 0.08, z + Math.sin(a) * 0.3, Math.cos(a) * 1.8, 0.6 + Math.random(), Math.sin(a) * 1.8, 0.45, 0.14, color, 1, 3, false, 1.8);
    }
  }

  shell(p: THREE.Vector3, yaw: number) {
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    this.solid.spawn(p.x, p.y, p.z, rx * 2.5 + (Math.random() - 0.5), 2.5 + Math.random(), rz * 2.5 + (Math.random() - 0.5), 0.8, 0.045, 0xe0b040, 16, 0.5, true);
  }

  ring(x: number, y: number, z: number, color: number, radius: number, dur: number) {
    const r = this.rings.find((q) => q.t <= 0) ?? this.rings[0];
    r.t = r.max = dur;
    r.r = radius;
    r.mesh.position.set(x, y, z);
    (r.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
    r.mesh.visible = true;
  }

  spawnFx(x: number, y: number, z: number) {
    this.ring(x, y + 0.08, z, 0x5ee7ff, 2.2, 0.5);
    for (let i = 0; i < 26 * this.detail; i++) {
      const a = (i / Math.max(1, Math.round(26 * this.detail))) * Math.PI * 2;
      this.glow.spawn(x + Math.cos(a) * 0.8, y + 0.1, z + Math.sin(a) * 0.8, Math.cos(a) * 0.6, 3 + Math.random() * 4, Math.sin(a) * 0.6, 0.6, 0.09, 0x5ee7ff, -1, 1);
    }
    this.flashAt(x, y + 1, z, 0x5ee7ff, 3.2, 0.25);
  }

  healFx(x: number, y: number, z: number) {
    this.ring(x, y + 0.1, z, 0x3ddc84, 1.8, 0.45);
    for (let i = 0; i < 16; i++) {
      this.glow.spawn(x + (Math.random() - 0.5), y + Math.random(), z + (Math.random() - 0.5), 0, 2 + Math.random() * 2, 0, 0.7, 0.1, 0x3ddc84, -1, 1);
    }
  }

  explosion(x: number, y: number, z: number, r: number) {
    this.flashAt(x, y, z, 0xffc070, r * 2.6, 0.2);
    this.ring(x, Math.max(0.08, y - 0.3), z, 0xffb060, r * 1.3, 0.45);
    for (let i = 0; i < 44 * this.detail; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = (Math.random() - 0.2) * 1.4;
      const s = 4 + Math.random() * 9;
      const c = [0xfff2b0, 0xffb347, 0xff6a2a][i % 3];
      this.glow.spawn(x, y, z, Math.cos(a) * s * Math.cos(e), Math.sin(e) * s + 2, Math.sin(a) * s * Math.cos(e), 0.35 + Math.random() * 0.35, 0.22 + Math.random() * 0.2, c, 2, 3.5);
    }
    for (let i = 0; i < 18 * this.detail; i++) {
      const a = Math.random() * Math.PI * 2;
      this.solid.spawn(x, y + 0.3, z, Math.cos(a) * 2, 1 + Math.random() * 2.5, Math.sin(a) * 2, 1.1 + Math.random() * 0.6, 0.5 + Math.random() * 0.4, 0x3a3a3e, -1.2, 1.4, false, 1.4);
    }
    for (let i = 0; i < 14 * this.detail; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 5 + Math.random() * 7;
      this.solid.spawn(x, y + 0.2, z, Math.cos(a) * s, 4 + Math.random() * 6, Math.sin(a) * s, 1.4, 0.12 + Math.random() * 0.1, 0x2b2622, 20, 0.3, true);
    }
    if (this.light) {
      this.light.position.set(x, y + 1, z);
      this.light.intensity = 60;
      this.lightT = 0.25;
    }
  }

  /** Визуальная ракета от точки до точки. */
  rocket(from: THREE.Vector3, tx: number, ty: number, tz: number) {
    const r = this.rockets.find((q) => !q.active) ?? this.rockets[0];
    const dx = tx - from.x, dy = ty - from.y, dz = tz - from.z;
    const len = Math.hypot(dx, dy, dz) || 0.01;
    r.fx = from.x; r.fy = from.y; r.fz = from.z;
    r.dx = dx / len; r.dy = dy / len; r.dz = dz / len;
    r.len = len; r.t = 0; r.trail = 0; r.active = true;
    r.mesh.visible = true;
    r.mesh.position.copy(from);
    r.mesh.lookAt(tx, ty, tz);
  }

  update(dt: number) {
    this.solid.update(dt);
    this.glow.update(dt);
    // трассеры
    const tm = this.tracerMesh;
    const col = (tm.instanceColor as THREE.InstancedBufferAttribute).array as Float32Array;
    let n = 0;
    for (let i = 0; i < this.tracers.length; i++) {
      const tr = this.tracers[i];
      tr.t += dt;
      const head = Math.min(tr.len, tr.t * tr.speed);
      const tail = Math.max(0, head - 4.5);
      if (tail >= tr.len - 0.01 || tr.t > 1) {
        this.tracers.splice(i, 1);
        i--;
        continue;
      }
      const L = Math.max(0.05, head - tail);
      const hx = tr.fx + tr.dx * head, hy = tr.fy + tr.dy * head, hz = tr.fz + tr.dz * head;
      // базис: z — вдоль трассера (к хвосту)
      const zx = -tr.dx, zy = -tr.dy, zz = -tr.dz;
      let ux = 0, uy = 1, uz = 0;
      if (Math.abs(zy) > 0.95) { ux = 1; uy = 0; }
      let xx = uy * zz - uz * zy, xy = uz * zx - ux * zz, xz = ux * zy - uy * zx;
      const xl = Math.hypot(xx, xy, xz) || 1;
      xx /= xl; xy /= xl; xz /= xl;
      const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      const w = tr.w;
      this.m4.set(
        xx * w, yx * w, -zx * L, hx,
        xy * w, yy * w, -zy * L, hy,
        xz * w, yz * w, -zz * L, hz,
        0, 0, 0, 1,
      );
      tm.setMatrixAt(n, this.m4);
      const fade = 1 - tail / tr.len;
      col[n * 3] = tr.r * fade; col[n * 3 + 1] = tr.g * fade; col[n * 3 + 2] = tr.b * fade;
      n++;
    }
    tm.count = n;
    tm.instanceMatrix.needsUpdate = true;
    (tm.instanceColor as THREE.InstancedBufferAttribute).needsUpdate = true;
    // вспышки
    for (const f of this.flashes) {
      if (f.t <= 0) continue;
      f.t -= dt;
      if (f.t <= 0) { f.sprite.visible = false; continue; }
      const k = f.t / f.max;
      f.sprite.scale.setScalar(f.size * (0.6 + 0.4 * k));
      (f.sprite.material as THREE.SpriteMaterial).opacity = k;
    }
    for (const r of this.rings) {
      if (r.t <= 0) continue;
      r.t -= dt;
      if (r.t <= 0) { r.mesh.visible = false; continue; }
      const k = 1 - r.t / r.max;
      r.mesh.scale.setScalar(0.2 + r.r * k);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.9;
    }
    for (const r of this.rockets) {
      if (!r.active) continue;
      r.t += dt;
      const d = Math.min(r.len, r.t * 55);
      const x = r.fx + r.dx * d, y = r.fy + r.dy * d, z = r.fz + r.dz * d;
      r.mesh.position.set(x, y, z);
      r.trail -= dt;
      if (r.trail <= 0) {
        r.trail = 0.012;
        this.solid.spawn(x, y, z, (Math.random() - 0.5) * 0.6, 0.4 + Math.random() * 0.4, (Math.random() - 0.5) * 0.6, 0.9, 0.2, 0xb8b8b8, -0.5, 1.5, false, 1.6);
        this.glow.spawn(x, y, z, 0, 0, 0, 0.1, 0.22, 0xffa040, 0, 0);
      }
      if (d >= r.len) { r.active = false; r.mesh.visible = false; }
    }
    if (this.light && this.lightT > 0) {
      this.lightT -= dt;
      this.light.intensity = Math.max(0, (this.lightT / 0.25) * 60);
    }
  }

  dispose() {
    this.solid.dispose();
    this.glow.dispose();
    this.tracerMesh.geometry.dispose();
    (this.tracerMesh.material as THREE.Material).dispose();
    for (const f of this.flashes) (f.sprite.material as THREE.Material).dispose();
    for (const r of this.rings) (r.mesh.material as THREE.Material).dispose();
    this.ringGeo.dispose();
    this.rocketGeo.dispose();
    this.rocketMat.dispose();
    if (this.light) this.scene.remove(this.light);
  }
}

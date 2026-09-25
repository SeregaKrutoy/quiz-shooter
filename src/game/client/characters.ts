import * as THREE from 'three';
import type { FaceId, HatId, Look, WeaponId } from '../shared/types';
import { getBlobTexture } from './world';

interface Geos {
  box: THREE.BoxGeometry;
  cyl: THREE.CylinderGeometry;
  cone: THREE.ConeGeometry;
  sphere: THREE.SphereGeometry;
  plane: THREE.PlaneGeometry;
}

let GEO: Geos | null = null;
function geo(): Geos {
  if (!GEO) {
    const plane = new THREE.PlaneGeometry(1, 1);
    plane.rotateX(-Math.PI / 2);
    GEO = {
      box: new THREE.BoxGeometry(1, 1, 1),
      cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
      cone: new THREE.ConeGeometry(0.5, 1, 8),
      sphere: new THREE.SphereGeometry(1, 10, 7),
      plane,
    };
  }
  return GEO;
}

const easeOutBack = (t: number) => {
  const c1 = 1.9, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export interface AnimState {
  speed: number;
  grounded: boolean;
  back: boolean;
  sprint: boolean;
  pitch: number;
  firing: boolean;
}

export class CharacterModel {
  root = new THREE.Group();
  body = new THREE.Group();
  head = new THREE.Group();
  aim = new THREE.Group();
  legL = new THREE.Group();
  legR = new THREE.Group();
  armL = new THREE.Group();
  armR = new THREE.Group();
  gun = new THREE.Group();
  blob: THREE.Mesh;
  scale: number;
  spawnT = 1;
  weapon: WeaponId | 'none' = 'none';
  private mats: THREE.MeshLambertMaterial[] = [];
  private extraMats: THREE.Material[] = [];
  private flashT = 0;
  private phase = 0;
  private kick = 0;
  private meleeT = 0;
  private landT = 0;
  private shield: THREE.Mesh | null = null;
  private muzzle = new THREE.Vector3(0, 0, -0.55);
  private shadows: boolean;
  private t = Math.random() * 10;
  private gunMats: { dark: THREE.MeshLambertMaterial; wood: THREE.MeshLambertMaterial; olive: THREE.MeshLambertMaterial };

  constructor(look: Look, opts: { scale?: number; shadows?: boolean; weapon?: WeaponId | 'none'; glowEyes?: boolean } = {}) {
    this.scale = opts.scale ?? 1;
    this.shadows = !!opts.shadows;
    const G = geo();
    const mat = (c: string) => {
      const m = new THREE.MeshLambertMaterial({ color: c });
      this.mats.push(m);
      return m;
    };
    const bodyM = mat(look.body);
    const accentM = mat(look.accent);
    const skinM = mat(look.skin);
    const darkM = mat('#1e2230');
    this.gunMats = { dark: mat('#2a2d35'), wood: mat('#7a4a24'), olive: mat('#4b5a2e') };

    this.root.add(this.body);
    // ноги
    this.legL.position.set(-0.14, 0.82, 0);
    this.legR.position.set(0.14, 0.82, 0);
    for (const leg of [this.legL, this.legR]) {
      this.part(leg, accentM, 0.24, 0.66, 0.28, 0, -0.33, 0);
      this.part(leg, darkM, 0.27, 0.18, 0.36, 0, -0.73, -0.03);
      this.body.add(leg);
    }
    // торс
    this.part(this.body, bodyM, 0.62, 0.66, 0.38, 0, 1.14, 0);
    this.part(this.body, darkM, 0.64, 0.1, 0.4, 0, 0.86, 0);
    this.part(this.body, accentM, 0.48, 0.34, 0.08, 0, 1.2, -0.2);
    this.part(this.body, accentM, 0.2, 0.12, 0.42, -0.34, 1.44, 0);
    this.part(this.body, accentM, 0.2, 0.12, 0.42, 0.34, 1.44, 0);
    // голова
    this.head.position.set(0, 1.47, 0);
    this.body.add(this.head);
    this.part(this.head, skinM, 0.44, 0.44, 0.44, 0, 0.22, 0);
    const eyeM = opts.glowEyes ? new THREE.MeshBasicMaterial({ color: '#ff2a2a' }) : darkM;
    if (opts.glowEyes) this.extraMats.push(eyeM);
    this.part(this.head, eyeM, 0.08, 0.08, 0.03, -0.1, 0.25, -0.225);
    this.part(this.head, eyeM, 0.08, 0.08, 0.03, 0.1, 0.25, -0.225);
    this.buildFace(look.face, accentM, darkM, !!opts.glowEyes);
    this.buildHat(look.hat, accentM);
    // руки
    this.aim.position.set(0, 1.36, 0);
    this.body.add(this.aim);
    this.armR.position.set(0.36, 0, 0);
    this.armR.rotation.y = 0.12;
    this.armL.position.set(-0.36, 0, 0);
    this.armL.rotation.y = -0.5;
    this.part(this.armR, bodyM, 0.17, 0.17, 0.56, 0, 0, -0.26);
    this.part(this.armR, skinM, 0.15, 0.15, 0.12, 0, 0, -0.58);
    this.part(this.armL, bodyM, 0.17, 0.17, 0.6, 0, 0, -0.28);
    this.part(this.armL, skinM, 0.15, 0.15, 0.12, 0, 0, -0.62);
    this.aim.add(this.armR, this.armL);
    this.gun.position.set(0.16, -0.02, -0.52);
    this.aim.add(this.gun);
    this.setWeapon(opts.weapon ?? 'rifle');

    // тень-пятно
    const blobMat = new THREE.MeshBasicMaterial({ map: getBlobTexture(), transparent: true, depthWrite: false });
    this.extraMats.push(blobMat);
    this.blob = new THREE.Mesh(G.plane, blobMat);
    this.blob.scale.set(1.3, 1, 1.3);
    this.blob.position.y = 0.03;
    this.blob.renderOrder = 1;
    this.root.add(this.blob);
    this.root.scale.setScalar(this.scale);
  }

  private part(parent: THREE.Object3D, m: THREE.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number, g: THREE.BufferGeometry = geo().box) {
    const mesh = new THREE.Mesh(g, m);
    mesh.scale.set(sx, sy, sz);
    mesh.position.set(x, y, z);
    mesh.castShadow = this.shadows;
    parent.add(mesh);
    return mesh;
  }

  private buildHat(hat: HatId, accentM: THREE.MeshLambertMaterial) {
    const G = geo();
    const h = this.head;
    const m = (c: string) => {
      const mm = new THREE.MeshLambertMaterial({ color: c });
      this.mats.push(mm);
      return mm;
    };
    switch (hat) {
      case 'cap':
        this.part(h, accentM, 0.47, 0.14, 0.47, 0, 0.47, 0);
        this.part(h, accentM, 0.42, 0.03, 0.2, 0, 0.41, -0.3);
        break;
      case 'helmet': {
        const o = m('#56613a');
        this.part(h, o, 0.52, 0.22, 0.52, 0, 0.47, 0);
        this.part(h, o, 0.58, 0.05, 0.58, 0, 0.37, 0);
        break;
      }
      case 'ushanka': {
        const fur = m('#5a3d2b');
        const light = m('#7b5a42');
        this.part(h, fur, 0.54, 0.18, 0.54, 0, 0.5, 0);
        this.part(h, fur, 0.08, 0.28, 0.4, -0.29, 0.3, 0.02);
        this.part(h, fur, 0.08, 0.28, 0.4, 0.29, 0.3, 0.02);
        this.part(h, light, 0.52, 0.12, 0.06, 0, 0.47, -0.28);
        this.part(h, m('#d62828'), 0.08, 0.08, 0.03, 0, 0.48, -0.32);
        break;
      }
      case 'crown': {
        const gold = m('#f5c518');
        this.part(h, gold, 0.48, 0.1, 0.48, 0, 0.49, 0);
        for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2], [0, -0.22], [0, 0.22], [-0.22, 0], [0.22, 0]]) {
          this.part(h, gold, 0.08, 0.14, 0.08, x, 0.6, z);
        }
        this.part(h, m('#e63946'), 0.08, 0.08, 0.03, 0, 0.5, -0.25);
        break;
      }
      case 'horns': {
        const bone = m('#efe6d2');
        const l = this.part(h, bone, 0.12, 0.3, 0.12, -0.2, 0.52, 0, G.cone);
        l.rotation.z = 0.5;
        const r = this.part(h, bone, 0.12, 0.3, 0.12, 0.2, 0.52, 0, G.cone);
        r.rotation.z = -0.5;
        break;
      }
      case 'mohawk':
        this.part(h, accentM, 0.09, 0.2, 0.44, 0, 0.53, 0.02);
        break;
      case 'tophat': {
        const black = m('#151515');
        this.part(h, black, 0.44, 0.38, 0.44, 0, 0.64, 0, G.cyl);
        this.part(h, black, 0.66, 0.03, 0.66, 0, 0.45, 0, G.cyl);
        this.part(h, accentM, 0.45, 0.06, 0.45, 0, 0.5, 0, G.cyl);
        break;
      }
      default:
        break;
    }
  }

  private buildFace(face: FaceId, accentM: THREE.MeshLambertMaterial, darkM: THREE.MeshLambertMaterial, glow: boolean) {
    const h = this.head;
    switch (face) {
      case 'visor': {
        const vm = glow ? new THREE.MeshBasicMaterial({ color: '#ff3030' }) : new THREE.MeshLambertMaterial({ color: '#29d4ff', emissive: '#0b5f7a' });
        this.extraMats.push(vm);
        this.part(h, vm, 0.42, 0.1, 0.04, 0, 0.25, -0.225);
        break;
      }
      case 'glasses':
        this.part(h, darkM, 0.14, 0.1, 0.03, -0.1, 0.25, -0.232);
        this.part(h, darkM, 0.14, 0.1, 0.03, 0.1, 0.25, -0.232);
        this.part(h, darkM, 0.08, 0.02, 0.03, 0, 0.27, -0.232);
        break;
      case 'mask':
        this.part(h, accentM, 0.45, 0.19, 0.05, 0, 0.1, -0.21);
        break;
      case 'mustache':
        this.part(h, darkM, 0.24, 0.05, 0.03, 0, 0.14, -0.232);
        break;
      default:
        break;
    }
  }

  setWeapon(w: WeaponId | 'none') {
    if (w === this.weapon) return;
    this.weapon = w;
    while (this.gun.children.length) this.gun.remove(this.gun.children[0]);
    const { dark, wood, olive } = this.gunMats;
    const G = geo();
    const P = (m: THREE.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number, g?: THREE.BufferGeometry) => this.part(this.gun, m, sx, sy, sz, x, y, z, g);
    switch (w) {
      case 'pistol':
        P(dark, 0.07, 0.1, 0.26, 0, 0.02, -0.08);
        P(dark, 0.06, 0.14, 0.07, 0, -0.08, 0.02);
        this.muzzle.set(0, 0.02, -0.24);
        break;
      case 'smg':
        P(dark, 0.08, 0.12, 0.5, 0, 0.02, -0.15);
        P(dark, 0.06, 0.2, 0.08, 0, -0.1, -0.12);
        P(dark, 0.05, 0.08, 0.2, 0, 0, 0.18);
        this.muzzle.set(0, 0.02, -0.42);
        break;
      case 'rifle': {
        P(dark, 0.08, 0.12, 0.62, 0, 0.02, -0.2);
        P(wood, 0.09, 0.1, 0.26, 0, 0.01, -0.36);
        const mag = P(dark, 0.06, 0.2, 0.09, 0, -0.12, -0.14);
        mag.rotation.x = 0.3;
        P(wood, 0.07, 0.12, 0.28, 0, -0.02, 0.22);
        this.muzzle.set(0, 0.03, -0.54);
        break;
      }
      case 'shotgun':
        P(dark, 0.1, 0.12, 0.8, 0, 0.03, -0.28);
        P(wood, 0.11, 0.08, 0.24, 0, -0.04, -0.36);
        P(wood, 0.08, 0.14, 0.28, 0, -0.02, 0.22);
        this.muzzle.set(0, 0.04, -0.7);
        break;
      case 'sniper': {
        P(dark, 0.07, 0.1, 1.0, 0, 0.02, -0.35);
        const sc = P(dark, 0.09, 0.3, 0.09, 0, 0.11, -0.12, G.cyl);
        sc.rotation.x = Math.PI / 2;
        P(wood, 0.07, 0.14, 0.3, 0, -0.02, 0.24);
        this.muzzle.set(0, 0.02, -0.87);
        break;
      }
      case 'lmg':
        P(dark, 0.13, 0.17, 0.8, 0, 0.03, -0.25);
        P(olive, 0.12, 0.14, 0.14, 0, -0.12, -0.1);
        P(dark, 0.05, 0.05, 0.32, 0, 0.05, -0.78);
        this.muzzle.set(0, 0.05, -0.95);
        break;
      case 'rpg': {
        const tube = P(olive, 0.14, 1.1, 0.14, 0, 0.07, -0.2, G.cyl);
        tube.rotation.x = Math.PI / 2;
        const head = P(olive, 0.2, 0.3, 0.2, 0, 0.07, -0.9, G.cone);
        head.rotation.x = -Math.PI / 2;
        P(dark, 0.05, 0.12, 0.06, 0, -0.06, -0.05);
        this.muzzle.set(0, 0.07, -1.05);
        break;
      }
      default:
        this.muzzle.set(0, 0, -0.3);
        break;
    }
  }

  getMuzzle(out: THREE.Vector3): THREE.Vector3 {
    this.root.updateMatrixWorld(true);
    return this.gun.localToWorld(out.copy(this.muzzle));
  }

  flash() {
    this.flashT = 0.1;
  }

  fireKick() {
    this.kick = 1;
  }

  melee() {
    this.meleeT = 0.3;
  }

  land() {
    this.landT = 0.2;
  }

  setShield(on: boolean) {
    if (on && !this.shield) {
      const m = new THREE.MeshBasicMaterial({ color: '#5ee7ff', transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending });
      this.extraMats.push(m);
      this.shield = new THREE.Mesh(geo().sphere, m);
      this.shield.scale.set(0.85, 1.15, 0.85);
      this.shield.position.y = 0.95;
      this.root.add(this.shield);
    }
    if (this.shield) this.shield.visible = on;
  }

  animate(dt: number, s: AnimState) {
    this.t += dt;
    const moveAmt = Math.min(1.4, s.speed / 6);
    const amt = Math.min(1, moveAmt);
    this.phase += dt * (4 + s.speed * 1.5) * (s.back ? -1 : 1);
    const sw = Math.sin(this.phase) * 0.8 * amt;
    if (s.grounded) {
      this.legL.rotation.x = sw;
      this.legR.rotation.x = -sw;
      this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.07 * amt;
    } else {
      this.legL.rotation.x = 0.7;
      this.legR.rotation.x = -0.35;
      this.body.position.y = 0;
    }
    if (this.landT > 0) {
      this.landT -= dt;
      this.body.position.y -= Math.sin((this.landT / 0.2) * Math.PI) * 0.12;
    }
    const lean = s.sprint ? -0.16 : -0.04 * amt;
    this.body.rotation.x += (lean - this.body.rotation.x) * Math.min(1, dt * 10);
    this.head.rotation.x = Math.max(-0.5, Math.min(0.5, s.pitch * 0.5));
    // дыхание
    this.body.scale.y = 1 + Math.sin(this.t * 2.2) * 0.008 * (1 - amt);
    // прицел и отдача
    this.kick = Math.max(0, this.kick - dt * 9);
    const pitch = Math.max(-1.1, Math.min(1.1, s.pitch));
    this.aim.rotation.x = pitch + this.kick * 0.12;
    this.aim.position.z = this.kick * 0.09;
    if (this.weapon === 'none') {
      const swing = Math.sin(this.phase) * 0.9 * amt;
      this.armR.rotation.x = -1.3 + swing;
      this.armL.rotation.x = -1.3 - swing;
    } else {
      this.armR.rotation.x = s.sprint ? -0.5 : 0;
      this.armL.rotation.x = s.sprint ? -0.4 : 0;
      this.gun.rotation.x = s.sprint ? -0.5 : 0;
    }
    if (this.meleeT > 0) {
      this.meleeT -= dt;
      const k = Math.sin((1 - this.meleeT / 0.3) * Math.PI);
      this.armR.rotation.x = -1.8 + k * 2.2;
      this.armL.rotation.x = -1.8 + k * 1.6;
    }
    // вспышка попадания
    if (this.flashT > 0) {
      this.flashT -= dt;
      const f = Math.max(0, this.flashT / 0.1) * 0.9;
      for (const m of this.mats) m.emissive.setRGB(f, f, f);
    } else if (this.flashT > -1) {
      this.flashT = -2;
      for (const m of this.mats) m.emissive.setRGB(0, 0, 0);
    }
    // появление
    if (this.spawnT < 1) {
      this.spawnT = Math.min(1, this.spawnT + dt * 3.2);
      const k = Math.max(0.01, easeOutBack(this.spawnT));
      this.root.scale.set(this.scale * k, this.scale * (0.6 + 0.4 * k) * k, this.scale * k);
    }
    if (this.shield && this.shield.visible) {
      (this.shield.material as THREE.MeshBasicMaterial).opacity = 0.16 + Math.sin(this.t * 10) * 0.08;
    }
  }

  colors(): number[] {
    return this.mats.slice(0, 4).map((m) => m.color.getHex());
  }

  dispose() {
    for (const m of this.mats) m.dispose();
    for (const m of this.extraMats) m.dispose();
  }
}

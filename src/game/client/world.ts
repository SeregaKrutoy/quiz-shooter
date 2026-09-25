import * as THREE from 'three';
import type { MapTheme } from '../shared/types';
import { Box, BoxKind, MapData, mulberry32 } from '../shared/maps';

export interface Palette {
  skyTop: string;
  skyBottom: string;
  fog: string;
  fogNear: number;
  fogFar: number;
  sun: string;
  sunI: number;
  sunPos: [number, number, number];
  hemiSky: string;
  hemiGround: string;
  hemiI: number;
  ground: string;
  floor: string;
  kinds: Record<BoxKind, string[]>;
  snow: boolean;
  night: boolean;
}

const baseKinds = (o: Partial<Record<BoxKind, string[]>>): Record<BoxKind, string[]> => ({
  wall: ['#c9c4b8', '#b8b2a4', '#d6d0c2'],
  crate: ['#c8914a', '#b57d3c', '#d9a35a'],
  container: ['#d9534f', '#3b7dd8', '#f0ad4e', '#4cae4c'],
  pillar: ['#e8e4dc', '#d4cfc4'],
  building: ['#e9dcc6', '#c9d3e0', '#e0c2b0'],
  barrier: ['#f2f2f2'],
  platform: ['#8d99ae'],
  car: ['#e63946', '#457b9d', '#f1faee', '#2a9d8f'],
  rock: ['#9a948a'],
  ...o,
});

export const THEMES: Record<MapTheme, Palette> = {
  day: {
    skyTop: '#3f86e0', skyBottom: '#d9edff', fog: '#cfe4f7', fogNear: 50, fogFar: 180, sun: '#fff4e0', sunI: 2.3, sunPos: [40, 70, 25],
    hemiSky: '#d2e9ff', hemiGround: '#7a8a66', hemiI: 1.7, ground: '#86a263', floor: '#c4bfb2', kinds: baseKinds({}), snow: false, night: false,
  },
  sunset: {
    skyTop: '#33296a', skyBottom: '#ff9a5a', fog: '#e9987a', fogNear: 40, fogFar: 150, sun: '#ffc48a', sunI: 2.5, sunPos: [70, 26, -40],
    hemiSky: '#ffb892', hemiGround: '#553c4a', hemiI: 1.45, ground: '#8a6a52', floor: '#bda392',
    kinds: baseKinds({ wall: ['#d8b9a6', '#c7a894', '#e3c6b0'], building: ['#f0cfae', '#d9b6a8', '#e8c39e'], pillar: ['#f3dcc8', '#e2c6b0'] }), snow: false, night: false,
  },
  night: {
    skyTop: '#03050f', skyBottom: '#1a2150', fog: '#0f1535', fogNear: 30, fogFar: 125, sun: '#a9bcff', sunI: 1.3, sunPos: [-30, 60, 40],
    hemiSky: '#5a6bb0', hemiGround: '#1c2135', hemiI: 1.9, ground: '#1f2539', floor: '#343b58',
    kinds: baseKinds({ wall: ['#6e7596', '#5f6687', '#7a82a3'], crate: ['#9a6e3e', '#8a5f32', '#a77a46'], pillar: ['#8b92b5', '#7d84a6'], building: ['#5b6285', '#4e5577', '#666e93'], barrier: ['#c9ccdf'], platform: ['#4d5a8a'] }),
    snow: false, night: true,
  },
  snow: {
    skyTop: '#8fb0cf', skyBottom: '#eef4fa', fog: '#e3ebf3', fogNear: 28, fogFar: 115, sun: '#ffffff', sunI: 1.9, sunPos: [30, 55, 45],
    hemiSky: '#f2f7ff', hemiGround: '#9aa7b8', hemiI: 1.75, ground: '#eef3f8', floor: '#d9e2ea',
    kinds: baseKinds({ wall: ['#b9c2cc', '#a9b3be', '#c6ced8'], building: ['#c9b8a6', '#b5c0cc', '#c7a99a'] }), snow: true, night: false,
  },
};

// ---------- Текстуры (кешируются на всю страницу) ----------

const texCache = new Map<string, THREE.Texture>();

function canvasTex(key: string, size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, srgb = true): THREE.Texture {
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 2;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

function noise(g: CanvasRenderingContext2D, s: number, n: number, a: number, dark = true) {
  const r = mulberry32(s * 31 + n);
  for (let i = 0; i < n; i++) {
    const v = dark ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${r() * a})`;
    const w = 1 + r() * 3;
    g.fillRect(r() * s, r() * s, w, w);
  }
}

const TEX = {
  crate: () => canvasTex('crate', 128, (g, s) => {
    g.fillStyle = '#f0f0f0'; g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 5; i++) g.fillRect(0, i * (s / 5), s, 2);
    noise(g, s, 400, 0.08);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 10; g.strokeRect(5, 5, s - 10, s - 10);
    g.lineWidth = 9; g.beginPath(); g.moveTo(10, 10); g.lineTo(s - 10, s - 10); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 2; g.strokeRect(11, 11, s - 22, s - 22);
  }),
  concrete: () => canvasTex('concrete', 128, (g, s) => {
    g.fillStyle = '#ececec'; g.fillRect(0, 0, s, s);
    noise(g, s, 900, 0.1);
    noise(g, s, 300, 0.12, false);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 0, s, 2); g.fillRect(0, 0, 2, s);
    g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, s / 2, s, 1);
  }),
  container: () => canvasTex('container', 64, (g, s) => {
    g.fillStyle = '#eeeeee'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(i * 16 + 10, 0, 5, s);
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(i * 16 + 3, 0, 3, s);
    }
    noise(g, s, 120, 0.1);
  }),
  building: () => canvasTex('building', 128, (g, s) => {
    g.fillStyle = '#efefef'; g.fillRect(0, 0, s, s);
    noise(g, s, 500, 0.07);
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, s - 6, s, 6);
    g.fillStyle = '#39465e'; g.fillRect(30, 26, 68, 62);
    g.fillStyle = '#6f86a8'; g.fillRect(34, 30, 28, 26); g.fillRect(66, 30, 28, 26);
    g.fillStyle = '#56698a'; g.fillRect(34, 60, 28, 24); g.fillRect(66, 60, 28, 24);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(26, 88, 76, 5);
  }),
  buildingGlow: () => canvasTex('buildingGlow', 128, (g, s) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#ffcf6b'; g.fillRect(34, 30, 28, 26);
    g.fillStyle = '#8a6a30'; g.fillRect(66, 60, 28, 24);
  }),
  car: () => canvasTex('car', 64, (g, s) => {
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#222a36'; g.fillRect(0, s * 0.18, s, s * 0.26);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, s * 0.86, s, s * 0.14);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, s * 0.5, s, 2);
  }),
  floor: () => canvasTex('floor', 256, (g, s) => {
    g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, s, s);
    noise(g, s, 1500, 0.06);
    g.fillStyle = 'rgba(0,0,0,0.16)';
    g.fillRect(0, 0, s, 3); g.fillRect(0, 0, 3, s);
    g.fillStyle = 'rgba(0,0,0,0.06)';
    g.fillRect(0, s / 2, s, 2); g.fillRect(s / 2, 0, 2, s);
  }),
  floorGlow: () => canvasTex('floorGlow', 256, (g, s) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#2ee6ff'; g.fillRect(0, 0, s, 3); g.fillRect(0, 0, 3, s);
    g.fillStyle = '#12506a'; g.fillRect(0, s / 2, s, 2); g.fillRect(s / 2, 0, 2, s);
  }),
  ground: () => canvasTex('ground', 128, (g, s) => {
    g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, s, s);
    noise(g, s, 1400, 0.14);
    noise(g, s, 500, 0.12, false);
  }),
  blob: () => canvasTex('blob', 64, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)');
    gr.addColorStop(0.6, 'rgba(0,0,0,0.25)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }),
  glow: () => canvasTex('glow', 64, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.25, 'rgba(255,255,255,0.8)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }),
};

export const getBlobTexture = () => TEX.blob();
export const getGlowTexture = () => TEX.glow();

const KIND_TEX: Record<BoxKind, { tex: () => THREE.Texture; scale: number }> = {
  wall: { tex: TEX.concrete, scale: 2 },
  crate: { tex: TEX.crate, scale: 1.2 },
  container: { tex: TEX.container, scale: 1 },
  pillar: { tex: TEX.concrete, scale: 1.5 },
  building: { tex: TEX.building, scale: 3 },
  barrier: { tex: TEX.concrete, scale: 1.2 },
  platform: { tex: TEX.concrete, scale: 2 },
  car: { tex: TEX.car, scale: 1.3 },
  rock: { tex: TEX.concrete, scale: 2.5 },
};

function boxGeometry(boxes: Box[], colors: string[], tex: number, snowTop: boolean): THREE.BufferGeometry {
  const V = boxes.length * 5 * 4;
  const pos = new Float32Array(V * 3);
  const nor = new Float32Array(V * 3);
  const uv = new Float32Array(V * 2);
  const col = new Float32Array(V * 3);
  const idx: number[] = [];
  let v = 0;
  const c = new THREE.Color();
  const cTop = new THREE.Color();
  const white = new THREE.Color('#f6f9ff');
  const face = (p: number[], n: [number, number, number], uvs: number[], shade: boolean, color: THREE.Color) => {
    for (let k = 0; k < 4; k++) {
      pos[v * 3] = p[k * 3];
      pos[v * 3 + 1] = p[k * 3 + 1];
      pos[v * 3 + 2] = p[k * 3 + 2];
      nor[v * 3] = n[0];
      nor[v * 3 + 1] = n[1];
      nor[v * 3 + 2] = n[2];
      uv[v * 2] = uvs[k * 2];
      uv[v * 2 + 1] = uvs[k * 2 + 1];
      const m = shade && k < 2 ? 0.6 : 1;
      col[v * 3] = color.r * m;
      col[v * 3 + 1] = color.g * m;
      col[v * 3 + 2] = color.b * m;
      v++;
    }
    const b = v - 4;
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  const s = 1 / tex;
  for (const bx of boxes) {
    c.set(colors[bx.c % colors.length]);
    const x0 = bx.x - bx.hw, x1 = bx.x + bx.hw, z0 = bx.z - bx.hd, z1 = bx.z + bx.hd, y0 = 0, y1 = bx.h;
    face([x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1], [1, 0, 0], [-z1 * s, y0 * s, -z0 * s, y0 * s, -z0 * s, y1 * s, -z1 * s, y1 * s], true, c);
    face([x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0], [-1, 0, 0], [z0 * s, y0 * s, z1 * s, y0 * s, z1 * s, y1 * s, z0 * s, y1 * s], true, c);
    face([x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], [0, 0, 1], [x0 * s, y0 * s, x1 * s, y0 * s, x1 * s, y1 * s, x0 * s, y1 * s], true, c);
    face([x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0], [0, 0, -1], [-x1 * s, y0 * s, -x0 * s, y0 * s, -x0 * s, y1 * s, -x1 * s, y1 * s], true, c);
    if (snowTop) cTop.copy(white);
    else cTop.copy(c).multiplyScalar(1.1);
    face([x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0], [0, 1, 0], [x0 * s, -z1 * s, x1 * s, -z1 * s, x1 * s, -z0 * s, x0 * s, -z0 * s], false, cTop);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

export interface WorldBuild {
  group: THREE.Group;
  fog: THREE.Fog;
  background: THREE.Color;
  minimap: HTMLCanvasElement;
  palette: Palette;
  update(dt: number, cam: THREE.Vector3): void;
  dispose(): void;
}

export function buildWorld(map: MapData, theme: MapTheme, quality: 'low' | 'high', seed: number): WorldBuild {
  const P = THEMES[theme];
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const shadows = quality === 'high';
  const half = map.half;

  // свет
  const hemi = new THREE.HemisphereLight(P.hemiSky, P.hemiGround, P.hemiI);
  group.add(hemi);
  const sun = new THREE.DirectionalLight(P.sun, P.sunI);
  sun.position.set(P.sunPos[0], P.sunPos[1], P.sunPos[2]);
  sun.target.position.set(0, 0, 0);
  group.add(sun);
  group.add(sun.target);
  if (shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const e = half + 8;
    const cam = sun.shadow.camera;
    cam.left = -e; cam.right = e; cam.top = e; cam.bottom = -e; cam.near = 1; cam.far = 260;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    cam.updateProjectionMatrix();
  }

  // небо
  const skyGeo = new THREE.SphereGeometry(460, 20, 12);
  const top = new THREE.Color(P.skyTop), bottom = new THREE.Color(P.skyBottom);
  const sc = new Float32Array(skyGeo.attributes.position.count * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < skyGeo.attributes.position.count; i++) {
    const y = skyGeo.attributes.position.getY(i) / 460;
    const t = Math.pow(Math.max(0, y), 0.55);
    tmp.copy(bottom).lerp(top, t);
    sc[i * 3] = tmp.r; sc[i * 3 + 1] = tmp.g; sc[i * 3 + 2] = tmp.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.renderOrder = -10;
  group.add(sky);
  disposables.push(skyGeo, skyMat);

  // земля и пол арены
  const groundTex = TEX.ground();
  const groundGeo = new THREE.PlaneGeometry(900, 900);
  groundGeo.rotateX(-Math.PI / 2);
  const guv = groundGeo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < guv.count; i++) guv.setXY(i, guv.getX(i) * 150, guv.getY(i) * 150);
  const groundMat = new THREE.MeshLambertMaterial({ color: P.ground, map: groundTex });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.y = -0.03;
  ground.updateMatrix();
  ground.matrixAutoUpdate = false;
  group.add(ground);
  disposables.push(groundGeo, groundMat);

  const floorGeo = new THREE.PlaneGeometry(half * 2, half * 2);
  floorGeo.rotateX(-Math.PI / 2);
  const fuv = floorGeo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < fuv.count; i++) fuv.setXY(i, (fuv.getX(i) * half * 2) / 4, (fuv.getY(i) * half * 2) / 4);
  const floorMat = new THREE.MeshLambertMaterial({ color: P.floor, map: TEX.floor() });
  if (P.night) {
    floorMat.emissive = new THREE.Color('#ffffff');
    floorMat.emissiveMap = TEX.floorGlow();
    floorMat.emissiveIntensity = 0.85;
  }
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = shadows;
  floor.updateMatrix();
  floor.matrixAutoUpdate = false;
  group.add(floor);
  disposables.push(floorGeo, floorMat);

  // препятствия — по одному мешу на тип
  const byKind = new Map<BoxKind, Box[]>();
  for (const b of map.boxes) {
    const list = byKind.get(b.kind) ?? [];
    list.push(b);
    byKind.set(b.kind, list);
  }
  for (const [kind, boxes] of byKind) {
    const kt = KIND_TEX[kind];
    const geo = boxGeometry(boxes, P.kinds[kind], kt.scale, P.snow && kind !== 'car');
    const mat = new THREE.MeshLambertMaterial({ map: kt.tex(), vertexColors: true });
    if (P.night && kind === 'building') {
      mat.emissive = new THREE.Color('#ffffff');
      mat.emissiveMap = TEX.buildingGlow();
      mat.emissiveIntensity = 0.9;
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    disposables.push(geo, mat);
  }

  // далёкий город вокруг арены
  const rnd = mulberry32(seed * 13 + 7);
  const far: Box[] = [];
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2 + rnd() * 0.05;
    const r = half + 22 + rnd() * 80;
    far.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, hw: 3 + rnd() * 6, hd: 3 + rnd() * 6, h: 8 + rnd() * 34, kind: 'building', c: Math.floor(rnd() * 3) });
  }
  const farGeo = boxGeometry(far, P.kinds.building, 3, P.snow);
  const farMat = new THREE.MeshLambertMaterial({ map: TEX.building(), vertexColors: true });
  if (P.night) {
    farMat.emissive = new THREE.Color('#ffffff');
    farMat.emissiveMap = TEX.buildingGlow();
    farMat.emissiveIntensity = 1;
  }
  const farMesh = new THREE.Mesh(farGeo, farMat);
  farMesh.updateMatrix();
  farMesh.matrixAutoUpdate = false;
  group.add(farMesh);
  disposables.push(farGeo, farMat);

  // звёзды / снег
  let snow: THREE.Points | null = null;
  let snowPos: Float32Array | null = null;
  if (P.night) {
    const n = 450;
    const sp = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = rnd() * Math.PI * 2;
      const v = 0.08 + rnd() * 0.9;
      const r = 420;
      sp[i * 3] = Math.cos(u) * Math.cos(v) * r;
      sp[i * 3 + 1] = Math.sin(v) * r;
      sp[i * 3 + 2] = Math.sin(u) * Math.cos(v) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const m = new THREE.PointsMaterial({ color: '#dfe6ff', size: 1.6, sizeAttenuation: false, fog: false });
    group.add(new THREE.Points(g, m));
    disposables.push(g, m);
  }
  if (P.snow) {
    const n = quality === 'high' ? 1000 : 450;
    snowPos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      snowPos[i * 3] = (rnd() - 0.5) * 70;
      snowPos[i * 3 + 1] = rnd() * 30;
      snowPos[i * 3 + 2] = (rnd() - 0.5) * 70;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
    const m = new THREE.PointsMaterial({ color: '#ffffff', size: 0.13, transparent: true, opacity: 0.9, depthWrite: false });
    snow = new THREE.Points(g, m);
    snow.frustumCulled = false;
    group.add(snow);
    disposables.push(g, m);
  }

  let snowTick = 0;

  // мини-карта
  const minimap = document.createElement('canvas');
  minimap.width = minimap.height = 256;
  const mg = minimap.getContext('2d') as CanvasRenderingContext2D;
  const s = 256 / (half * 2);
  mg.fillStyle = '#121829';
  mg.fillRect(0, 0, 256, 256);
  mg.strokeStyle = 'rgba(120,150,220,0.12)';
  mg.lineWidth = 1;
  for (let x = 0; x <= 256; x += 256 / 8) {
    mg.beginPath(); mg.moveTo(x, 0); mg.lineTo(x, 256); mg.stroke();
    mg.beginPath(); mg.moveTo(0, x); mg.lineTo(256, x); mg.stroke();
  }
  for (const b of map.boxes) {
    if (Math.abs(b.x) > half || Math.abs(b.z) > half) continue;
    mg.fillStyle = b.h > 2.5 ? '#8a97c0' : b.h > 1.3 ? '#5f6b96' : '#434d73';
    mg.fillRect((b.x - b.hw + half) * s, (b.z - b.hd + half) * s, b.hw * 2 * s, b.hd * 2 * s);
  }

  const fog = new THREE.Fog(P.fog, P.fogNear, P.fogFar);
  const background = new THREE.Color(P.skyBottom);

  return {
    group, fog, background, minimap, palette: P,
    update(dt: number, cam: THREE.Vector3) {
      sky.position.copy(cam);
      if (snow && snowPos) {
        snowTick++;
        const n = snowPos.length / 3;
        const start = snowTick % 2;
        for (let i = start; i < n; i += 2) {
          let y = snowPos[i * 3 + 1] - dt * (1.6 + (i % 7) * 0.12);
          let x = snowPos[i * 3] + Math.sin((y + i) * 0.7) * dt * 0.4;
          let z = snowPos[i * 3 + 2];
          if (y < 0) y += 30;
          if (x - cam.x > 35) x -= 70; else if (x - cam.x < -35) x += 70;
          if (z - cam.z > 35) z -= 70; else if (z - cam.z < -35) z += 70;
          snowPos[i * 3] = x; snowPos[i * 3 + 1] = y; snowPos[i * 3 + 2] = z;
        }
        (snow.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      }
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

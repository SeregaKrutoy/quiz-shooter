'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CharacterModel } from '@/game/client/characters';
import type { Look, WeaponId } from '@/game/shared/types';

export default function CharacterPreview({ look, weapon = 'rifle', className }: { look: Look; weapon?: WeaponId; className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{ scene: THREE.Scene; model: CharacterModel | null } | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    host.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, 1.35, 5.2);
    camera.lookAt(0, 0.95, 0);
    scene.add(new THREE.HemisphereLight('#d8e6ff', '#3a2a4a', 2.2));
    const key = new THREE.DirectionalLight('#ffffff', 2.4);
    key.position.set(3, 5, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight('#36d6ff', 2.2);
    rim.position.set(-4, 3, -3);
    scene.add(rim);
    const discGeo = new THREE.CylinderGeometry(1.1, 1.2, 0.12, 24);
    const discMat = new THREE.MeshLambertMaterial({ color: '#1b2347', emissive: '#0d1433' });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.y = -0.06;
    scene.add(disc);
    const ringGeo = new THREE.TorusGeometry(1.15, 0.025, 8, 36);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffc53d' });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);
    stateRef.current = { scene, model: null };

    const resize = () => {
      const w = host.clientWidth || 300, h = host.clientHeight || 300;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    let raf = 0;
    let last = performance.now();
    let t = 0;
    let visible = true;
    const io = new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); }, { threshold: 0.02 });
    io.observe(host);
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible || document.hidden) return;
      t += dt;
      const m = stateRef.current?.model;
      if (m) {
        m.root.rotation.y = Math.PI + Math.sin(t * 0.5) * 0.28;
        m.animate(dt, { speed: 0, grounded: true, back: false, sprint: false, pitch: Math.sin(t * 1.3) * 0.15, firing: false });
        m.blob.visible = false;
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      stateRef.current?.model?.dispose();
      stateRef.current = null;
      discGeo.dispose();
      discMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      renderer.dispose();
      try {
        renderer.forceContextLoss();
      } catch {
        // игнор
      }
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    if (st.model) {
      st.scene.remove(st.model.root);
      st.model.dispose();
    }
    const m = new CharacterModel(look, { weapon });
    m.spawnT = 0.2;
    st.scene.add(m.root);
    st.model = m;
  }, [look, weapon]);

  return <div ref={hostRef} className={className} />;
}

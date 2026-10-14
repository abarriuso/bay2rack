// Animated hero: the showcase homelab is built piece by piece in front of the camera.
// Every piece is rendered by OpenSCAD on its own (preview_item) so it can move on its own.
import * as THREE from 'three';
import { Viewer } from './viewer.js';
import { t } from './i18n.js';
import { renderLegend } from './legend.js';

const ease = (x) => { const k = Math.min(1, Math.max(0, x)); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const V = (a) => new THREE.Vector3(...a);

// camera stops: [time, eye, target]
const SHOTS = [
  [0.0, [-1050, -1650, 820], [200, 150, -110]],
  [1.4, [-300, -700, 330], [0, 0, 55]],
  [7.6, [-230, -560, 250], [0, 0, 70]],
  [9.0, [1250, 1550, 760], [220, 280, -150]],
  [12.4, [1050, -1500, 720], [220, 160, -120]],
  [16.0, [-1050, -1650, 820], [200, 150, -110]],
];

export function startHero({ el, caption, step, replay, legend, onReady, runJob, definesFor, values, mods, filament }) {
  const viewer = new Viewer(el);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  viewer.setFilament(filament);
  viewer.controls.enableZoom = false;
  let plan = null;
  let time = 0;
  let userCam = false;
  el.addEventListener('pointerdown', () => { userCam = true; });
  replay?.addEventListener('click', () => { time = 0; userCam = false; viewer.controls.target.set(0, 0, 0); });

  // captions are looked up every frame, so they follow the language switch
  const setCaption = (cap, n = 0, total = 0) => {
    if (step) step.textContent = total ? `${String(n).padStart(2, '0')}/${String(total).padStart(2, '0')}` : '';
    const text = typeof cap === 'function' ? cap() : t(cap);
    if (caption.textContent !== text) {
      caption.classList.remove('show');
      void caption.offsetWidth;
      caption.textContent = text;
      caption.classList.add('show');
    }
  };

  async function build() {
    setCaption('hero_loading');
    const base = { ...values, part: 'assembly' };
    const jobs = [['adapter', 0], ...mods.map((m, k) => ['module', k]), ['filler', 0], ['hardware', 0], ['clients', 0]];
    const items = [];
    let scene = null;
    for (const [item, k] of jobs) {
      const defs = [...definesFor(base), 'web_scene=true', `preview_item="${item}"`, `preview_index=${k}`];
      const res = await runJob(defs, 'out.3mf');
      if (!res.ok) continue;
      if (item === 'adapter') {
        scene = { cables: [] };
        for (const l of res.logs) {
          const m = l.match(/^ECHO: "SCENE (.*)"$/);
          if (!m) continue;
          try { const d = JSON.parse(m[1]); if (d.cable) scene.cables.push(d.cable); else Object.assign(scene, d); } catch { /* skip */ }
        }
      }
      items.push({ name: item === 'module' ? `module${k}` : item, buffer: res.data.buffer });
    }
    viewer.loadGroups(items, { scene });
    // things to animate
    const leds = [];
    viewer.scene.traverse((o) => {
      for (const m of [].concat(o.material ?? [])) if (m.emissive && m.emissive.getHex() !== 0) leds.push([m, m.emissiveIntensity]);
    });
    const cables = [];
    viewer.extras?.traverse((o) => { if (o.userData.role === 'cables') cables.push(o); });
    const tl = [];
    let at = 1.2;
    tl.push({ g: viewer.groups.adapter, from: [0, -460, 0], at, dur: 1.6, cap: 'hero_adapter' });
    at += 1.8;
    mods.forEach((m, k) => { tl.push({ g: viewer.groups[`module${k}`], from: [0, -340, 0], at, dur: 1.0, cap: () => t('hero_mod', { name: t('mod_' + m.split(':')[0].replace('kvm2', 'kvm')) }) }); at += 1.15; });
    if (viewer.groups.filler) { tl.push({ g: viewer.groups.filler, from: [0, -300, 0], at, dur: 1.0, cap: 'hero_patch' }); at += 1.15; }
    if (viewer.groups.hardware) { tl.push({ g: viewer.groups.hardware, from: [0, -70, 0], at, dur: 0.8, cap: 'hero_screws' }); at += 1.0; }
    plan = { tl, cables, cablesAt: at, cablesDur: 2.4, leds, ledsAt: at + 2.6, end: 16 };
    time = still ? plan.ledsAt + 1 : 0;
    renderLegend(legend, scene);
    onReady?.();
  }

  function camera(tm) {
    if (userCam) return;
    let i = 0;
    while (i < SHOTS.length - 2 && tm > SHOTS[i + 1][0]) i++;
    const [t0, e0, g0] = SHOTS[i];
    const [t1, e1, g1] = SHOTS[i + 1];
    const k = ease((tm - t0) / (t1 - t0));
    viewer.camera.position.copy(V(e0).lerp(V(e1), k));
    viewer.controls.target.copy(V(g0).lerp(V(g1), k));
    const d = viewer.camera.position.distanceTo(viewer.controls.target);
    viewer.camera.near = d / 100;
    viewer.camera.far = d * 30;
    viewer.camera.updateProjectionMatrix();
  }

  viewer.hooks.push((dt) => {
    if (!plan) return;
    if (!still) time += dt;
    if (time > plan.end) time = 0;
    let cap = 'hero_intro';
    let n = 1;
    const total = plan.tl.length + 3;
    plan.tl.forEach((s, i) => {
      if (!s.g) return;
      const k = ease((time - s.at) / s.dur);
      s.g.position.set(s.from[0] * (1 - k), s.from[1] * (1 - k), s.from[2] * (1 - k));
      s.g.visible = time >= s.at - 0.2;
      if (time >= s.at) { cap = s.cap; n = i + 2; }
    });
    const kc = Math.min(1, Math.max(0, (time - plan.cablesAt) / plan.cablesDur));
    for (const c of plan.cables) {
      c.visible = kc > 0;
      c.children.forEach((m, i) => {
        if (i === 0 && m.geometry.index) m.geometry.setDrawRange(0, Math.floor(m.geometry.index.count * kc / 3) * 3);
        else m.visible = kc >= 1;
      });
    }
    if (kc > 0) { cap = 'hero_cables'; n = total - 1; }
    const kl = Math.min(1, Math.max(0, (time - plan.ledsAt) / 0.8));
    for (const [m, base] of plan.leds) m.emissiveIntensity = base * (0.05 + 0.95 * kl);
    if (kl > 0) { cap = 'hero_done'; n = total; }
    setCaption(cap, n, total);
    camera(time);
  });

  build();
  return viewer;
}

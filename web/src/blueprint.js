// The viewer's own tools, in its bar: the blueprint ("plano técnico") and the exploded view ("despiece").
// Blueprint: flat paper (white, or black in the dark theme), every part drawn as its edges over a faint fill (the fill
// hides the edges behind it), no shadows, no light; the sizes of the adapter as dimension lines in the mono font, the
// rack units, the bays and the rows of rack screws. The labels are an SVG over the view, placed again only on the
// frames the view draws (the camera moved): nothing runs while it is still. The two looks cross through the paper
// colour (a fade, via viewer.run(): instant with reduced motion). The choice is remembered.
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { t, lang } from './i18n.js';
import { Explode } from './explode.js';
import { sfx, softly } from './sound.js';
import './css/viewer-extra.css';

const CALM = matchMedia('(prefers-reduced-motion: reduce)');
const NARROW = matchMedia('(max-width: 600px)');
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const EDGE_ANGLE = 28;               // degrees between faces for an edge to be drawn (curved parts stay clean)
const BAY = 43.18;                   // a 5.25in bay, mm
const SVG = 'http://www.w3.org/2000/svg';
const KEY = 'blueprint';

const ICON_BLUEPRINT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">'
  + '<rect x="7" y="4" width="13" height="13"/><path d="M4 4v13M2.5 5.5 4 4l1.5 1.5M2.5 15.5 4 17l1.5-1.5"/>'
  + '<path d="M7 20h13M8.5 18.5 7 20l1.5 1.5M18.5 18.5 20 20l-1.5 1.5"/></svg>';
const ICON_EXPLODE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">'
  + '<rect x="12" y="3" width="9" height="18"/><path d="M3 5.5h6v4H3zM3 14.5h6v4H3z"/><path d="M9.5 7.5h1.5M9.5 16.5h1.5" stroke-dasharray="1 1.4"/></svg>';

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const fmt = (x) => Number(x).toLocaleString(lang, { maximumFractionDigits: 1 });
const el = (tag, cls) => { const e = document.createElementNS(SVG, tag); if (cls) e.setAttribute('class', cls); return e; };

export class ViewTools {
  constructor(viewer, bar) {
    this.v = viewer;
    this.explode = new Explode(viewer);
    this.explode.onChange = () => this.onExplode();
    // a piece of a build putting itself together seats home: its click, from its side of the view
    const panOf = (key) => {
      const g = this.explode.groups.get(key);
      const x = g?.meshes[0]?.geometry.boundingBox ? (g.meshes[0].geometry.boundingBox.min.x + g.meshes[0].geometry.boundingBox.max.x) / 2 : 0;
      return Math.max(-0.6, Math.min(0.6, x / 160));
    };
    this.explode.onSeat = (key, size) => {
      const pan = panOf(key);
      if (key.includes('screw')) sfx.screw(pan, 200, 2); else sfx.snap(pan, size);
    };
    // the explode, by its key or its slider: each part comes out of its seat (unlatched, unscrewed, the side panel off)
    // and goes back in with its click
    this.explode.onMove = (key, out) => softly(0.8, () => {
      const pan = panOf(key);
      if (key.startsWith('side')) (out ? sfx.unthunk : sfx.thunk)(pan);
      else if (key.includes('screw')) (out ? sfx.unscrew : sfx.screw)(pan, 200, 2);
      else (out ? sfx.unsnap : sfx.snap)(pan, 1);
    });
    this.on = false;                  // blueprint wanted
    this.shown = false;               // the scene is in blueprint state now
    this.veil = 0;
    try { this.on = localStorage.getItem(KEY) === '1'; } catch { /* private mode */ }
    const stage = viewer.el.parentElement;
    // the controls: in the viewer's bar, before "Recentre"
    const tools = document.createElement('div');
    tools.className = 'vx-tools';
    this.bpBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'icon-btn vx-btn', innerHTML: ICON_BLUEPRINT });
    this.bpBtn.dataset.i18nTip = 'view_blueprint';
    this.bpBtn.dataset.i18nAria = 'view_blueprint';
    this.bpBtn.onclick = () => this.setBlueprint(!this.on);
    const ex = document.createElement('div');
    ex.className = 'vx-explode';
    this.exBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'icon-btn vx-btn', innerHTML: ICON_EXPLODE });
    this.exBtn.dataset.i18nTip = 'view_explode';
    this.exBtn.dataset.i18nAria = 'view_explode';
    this.exBtn.onclick = () => this.setExplode(this.explode.target > 0 ? 0 : 1);
    this.range = Object.assign(document.createElement('input'), { type: 'range', min: 0, max: 100, step: 1, value: 0, className: 'vx-range' });
    this.range.dataset.i18nAria = 'view_explode_amount';
    this.range.oninput = () => this.setExplode(this.range.value / 100, true);
    ex.append(this.exBtn, this.range);
    tools.append(this.bpBtn, ex);
    this.exGroup = ex;
    const fit = bar.querySelector('#fit');
    bar.insertBefore(tools, fit ?? null);
    // the paper the looks cross through, the labels over the view, the title block
    this.veilEl = document.createElement('div');
    this.veilEl.className = 'vx-veil';
    this.svg = el('svg', 'vx-dims');
    this.svg.setAttribute('aria-hidden', 'true');
    this.title = document.createElement('div');
    this.title.className = 'vx-title';
    this.title.setAttribute('aria-hidden', 'true');
    viewer.el.after(this.veilEl, this.svg, this.title);
    this.stage = stage;
    this.texts();
    // the other language: the labels are written again (the buttons' tips by the page's own applyI18n)
    new MutationObserver(() => { this.texts(); this.build(); this.v.dirty = true; })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    this.mats();
    this.sync();
  }

  texts() {
    for (const [b, k] of [[this.bpBtn, 'view_blueprint'], [this.exBtn, 'view_explode']]) {
      b.dataset.tip = t(k);
      b.setAttribute('aria-label', t(k));
    }
    this.range.setAttribute('aria-label', t('view_explode_amount'));
  }

  // the line and fill materials, in the colours of the theme
  mats() {
    const dark = document.documentElement.dataset.theme === 'dark';
    this.paper = dark ? '#000000' : '#ffffff';
    this.ink = dark ? '#f5f5f5' : '#0a0a0a';
    if (!this.line) {
      this.line = new LineMaterial({ linewidth: 1.1, transparent: true, depthWrite: false });
      this.line2 = new LineMaterial({ linewidth: 0.8, transparent: true, depthWrite: false });
      // the fill: a hair off the paper, set back a little so the edges on it never flicker
      this.fill = new THREE.MeshBasicMaterial({ polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 2 });
    }
    this.line.color.set(this.ink);
    this.line.opacity = dark ? 0.92 : 0.88;
    this.line2.color.set(this.ink);
    this.line2.opacity = dark ? 0.42 : 0.4;
    this.fill.color.set(dark ? '#0c0c0c' : '#f7f7f7');
    this.stage.style.setProperty('--vx-paper', this.paper);
  }

  // (the viewer has just put its own background for the theme: that is the one to go back to)
  theme() {
    this.mats();
    if (this.shown) {
      if (this.saved) this.saved.bg = this.v.scene.background;
      this.v.scene.background = new THREE.Color(this.paper);
    }
    this.build();
  }

  // the buttons say what is on; the explode is there for the whole build only
  sync() {
    this.bpBtn.setAttribute('aria-pressed', String(this.on));
    this.exBtn.setAttribute('aria-pressed', String(this.explode.target > 0));
    this.exGroup.hidden = !this.v.parts?.front;
    this.range.value = Math.round(this.explode.target * 100);
    this.range.style.setProperty('--vx-k', this.explode.target);
  }

  // ------------------------------------------------------------ explode
  setExplode(k, fromRange = false) {
    this.explode.set(k, CALM.matches);
    if (!fromRange) this.range.value = Math.round(k * 100);
    this.sync();
    this.cables();
  }

  // while it is apart the network cables go (their plugs would hang in the air)
  cables() {
    const hide = this.explode.apart;
    if (hide === this.cablesHidden) return;
    this.cablesHidden = hide;
    this.v.extras?.traverse((o) => { if (o.userData.role === 'cables') o.visible = !hide && this.v.show.cables; });
    this.v.dirty = true;
  }

  onExplode() {
    if (!this.explode.apart) this.cables();
  }

  // ------------------------------------------------------------ blueprint
  setBlueprint(on) {
    this.on = on;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* private mode */ }
    this.sync();
    this.fade();
  }

  // through the paper: the veil comes up, the look changes under it, the veil goes (with the labels coming in)
  fade() {
    this.stopFade?.();
    const from = this.veil;
    const swap = this.shown !== this.on;
    const set = (k) => {
      this.veil = k;
      this.veilEl.style.opacity = k;
      const o = this.shown ? 1 - k : 0;
      this.svg.style.opacity = o;
      this.title.style.opacity = o;
      this.svg.style.visibility = this.title.style.visibility = o > 0 ? 'visible' : 'hidden';
      this.stage.classList.toggle('vx-bp', o > 0);
    };
    if (!swap && from === 0) { set(0); return; }
    if (!this.v.model) {               // nothing on screen yet: it is just so
      if (this.shown !== this.on) this.enter(this.on);
      set(0);
      return;
    }
    this.stopFade = this.v.run(swap ? 560 : 260, (x) => {
      if (!swap) { set(from * (1 - easeInOut(x))); return; }
      if (x < 0.5) set(from + (1 - from) * easeInOut(x * 2));
      else {
        if (this.shown !== this.on) this.enter(this.on);
        set(1 - easeInOut((x - 0.5) * 2));
      }
    }, () => { this.stopFade = null; });
  }

  // the scene in one look or the other
  enter(on) {
    const v = this.v;
    this.shown = on;
    v.dirty = true;
    if (on) {
      this.saved ??= { tm: v.renderer.toneMapping, bg: v.scene.background };
      v.scene.background = new THREE.Color(this.paper);
      v.renderer.toneMapping = THREE.NoToneMapping;     // the paper is the paper (no film curve on it)
      v.key.castShadow = false;
      v.floor.visible = false;
      if (v.extras) v.extras.visible = false;
      this.draw();
      this.build();
      this.frame();
    } else {
      if (this.saved) {
        v.renderer.toneMapping = this.saved.tm;
        v.scene.background = this.saved.bg;
        this.saved = null;
      }
      v.key.castShadow = true;
      v.floor.visible = true;
      if (v.extras) v.extras.visible = true;
      this.undraw();
      if (this.framed) v.fit();                         // back to the whole scene
      this.framed = false;
    }
  }

  // the camera on the drawing: the adapter and room round it for the dimensions
  frame() {
    if (!this.box || !this.v.parts) return;
    const b = this.box.clone();
    // (a phone's view is short and its bar takes the foot of it: more room)
    b.expandByVector(b.getSize(new THREE.Vector3()).multiplyScalar(NARROW.matches ? 0.5 : 0.28));
    this.v.fit(b);
    this.framed = true;
  }

  // the model's meshes as edges over the fill (the edges are children: they move with the exploded parts)
  draw() {
    const v = this.v;
    if (!v.model) return;
    this.explode.prepare();
    v.model.traverse((m) => {
      if (!m.isMesh || m.userData.bpLine) return;
      if (!m.userData.bpEdges) {
        const edges = new THREE.EdgesGeometry(m.geometry, EDGE_ANGLE);
        const geo = new LineSegmentsGeometry().fromEdgesGeometry(edges);
        edges.dispose();
        const print = m.material.name?.startsWith('print') || m.userData.bpOrig?.name?.startsWith('print');
        const line = new LineSegments2(geo, print ? this.line : this.line2);
        line.userData.bpLine = true;
        line.renderOrder = 1;
        m.userData.bpEdges = line;
      }
      if (!m.userData.bpOrig) { m.userData.bpOrig = m.material; m.material = this.fill; }
      m.castShadow = false;
      m.add(m.userData.bpEdges);
    });
  }

  undraw() {
    this.v.model?.traverse((m) => {
      if (!m.isMesh || m.userData.bpLine) return;
      if (m.userData.bpOrig) { m.material = m.userData.bpOrig; m.userData.bpOrig = null; m.castShadow = true; }
      if (m.userData.bpEdges) m.remove(m.userData.bpEdges);
    });
  }

  // ------------------------------------------------------------ the viewer's life
  // before a model goes: its materials back (the viewer disposes them), the edges freed (theirs are shared)
  cleared() {
    const old = [];
    this.v.model?.traverse((m) => { if (m.isMesh && !m.userData.bpLine) old.push(m); });
    for (const m of old) {
      if (m.userData.bpOrig) { m.material = m.userData.bpOrig; m.userData.bpOrig = null; }
      const e = m.userData.bpEdges;
      if (e) { m.remove(e); e.geometry.dispose(); m.userData.bpEdges = null; }
    }
    this.explode.reset();
    this.cablesHidden = false;
  }

  // a new model is on screen: it takes the look and the explode the view has. A build comes in apart and puts itself
  // together - its pieces out as the exploded view lays them, then home one after another - unless the view is apart
  // already, in the blueprint, with reduced motion, or `still` (the film lays that one out itself). -> it did
  loaded(keepView, still = false) {
    const v = this.v;
    const burst = !still && !CALM.matches && !this.on && !this.explode.apart && !!v.parts?.front;
    if (this.explode.apart || burst) this.explode.prepare();
    if (burst) this.explode.burst();
    if (this.shown) {
      v.key.castShadow = false;
      v.floor.visible = false;
      if (v.extras) v.extras.visible = false;
      this.draw();
    }
    this.cables();
    this.sync();
    this.build();
    if (this.shown && !keepView) this.frame();
    if (this.on !== this.shown || this.veil > 0) this.fade();
    return burst;
  }

  // ------------------------------------------------------------ the labels
  // the drawing's pieces (3D anchors), from the parts boxes and the model; placed on screen by place()
  build() {
    const v = this.v;
    this.svg.replaceChildren();
    this.dims = [];
    this.title.replaceChildren();
    if (!v.model) return;
    const P = v.parts;
    const box = new THREE.Box3();
    const meshBox = (m) => { m.geometry.computeBoundingBox(); return m.geometry.boundingBox; };     // (as assembled)
    v.model.traverse((m) => {
      if (!m.isMesh || m.userData.bpLine) return;
      const name = (m.userData.bpOrig ?? m.material).name;
      if (!P || name === 'print_0') box.union(meshBox(m));
    });
    if (P?.front) {
      box.union(new THREE.Box3(new THREE.Vector3(...P.front[0]), new THREE.Vector3(...P.front[1])));
      for (const p of P.posts ?? []) box.union(new THREE.Box3(new THREE.Vector3(...p[0]), new THREE.Vector3(...p[1])));
    }
    if (box.isEmpty()) return;
    this.box = box;
    const size = box.getSize(new THREE.Vector3());
    const g = (cls) => { const e = el('g', cls); this.svg.append(e); return e; };
    // a dimension: its line, the two extension lines, the ticks, the number
    const dim = (kind, label) => {
      const e = g('vx-dim');
      const parts = { main: el('line'), e1: el('line', 'vx-ext'), e2: el('line', 'vx-ext'), t1: el('line', 'vx-tick'), t2: el('line', 'vx-tick'), text: el('text') };
      parts.text.textContent = label;
      e.append(...Object.values(parts));
      this.dims.push({ kind, ...parts });
    };
    dim('w', fmt(size.x));
    dim('h', fmt(size.z));
    dim('d', fmt(size.y));
    if (P?.posts?.length === 2) {
      const [a, b] = P.posts;
      const cl = (p) => (p[0][0] + p[1][0]) / 2;
      this.posts = [cl(a), cl(b)];
      for (let i = 0; i < 2; i++) {
        const c = el('line', 'vx-centre');
        g('vx-post').append(c);
        this.dims.push({ kind: 'post', i, main: c });
      }
      dim('pp', t('bp_screws', { d: fmt(Math.abs(this.posts[1] - this.posts[0])) }));
    }
    // the rack units, top first: U1, U2-3 (a 2U module)...
    let u = 1;
    (P?.units ?? []).forEach(([n, b], k) => {
      const e = g('vx-unit');
      const lead = el('polyline'), text = el('text'), dot = el('circle');
      dot.setAttribute('r', 2);
      text.textContent = n > 1 ? `U${u}–${u + n - 1}` : `U${u}`;
      u += n;
      e.append(lead, dot, text);
      this.dims.push({ kind: 'unit', k, box: b, lead, text, dot });
    });
    // the title block: what this is, in a few words
    const units = (P?.units ?? []).reduce((s, [n]) => s + n, 0);
    const bays = P?.front ? Math.max(1, Math.round((P.front[1][2] - P.front[0][2]) / BAY)) : 0;
    const row = (cls, text) => { const d = document.createElement('div'); d.className = cls; d.textContent = text; this.title.append(d); };
    row('vx-title-head', 'BAY2RACK');
    if (bays) row('vx-title-row', [t('spec_bays', { n: bays }), units ? t('spec_units', { n: units }) : null].filter(Boolean).join(' · '));
    row('vx-title-row', `${fmt(size.x)} × ${fmt(size.z)} × ${fmt(size.y)} mm`);
    this.v.dirty = true;
  }

  // on every frame the view draws (and only then): the labels where the model is on screen now
  place() {
    if (!this.shown || !this.dims?.length || !this.box) return;
    const v = this.v, cam = v.camera, box = this.box;
    const W = v.el.clientWidth, H = v.el.clientHeight;
    this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const off = Math.max(size.x, size.y, size.z) * (NARROW.matches ? 0.1 : 0.13);
    // the sides the dimensions go on: the ones the camera sees (front, its left or right, under or over)
    const sx = cam.position.x < c.x ? -1 : 1;
    const sy = cam.position.y < c.y ? -1 : 1;
    const sz = cam.position.z > c.z ? -1 : 1;
    const X = (s) => (s < 0 ? box.min.x : box.max.x), Y = (s) => (s < 0 ? box.min.y : box.max.y), Z = (s) => (s < 0 ? box.min.z : box.max.z);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const scr = (p) => { const q = p.clone().project(cam); return [(q.x + 1) / 2 * W, (1 - q.y) / 2 * H, q.z < 1]; };
    const sc = scr(c);
    const line = (e, a, b) => { e.setAttribute('x1', a[0]); e.setAttribute('y1', a[1]); e.setAttribute('x2', b[0]); e.setAttribute('y2', b[1]); };
    const dimAt = (d, p1, p2, dir) => {
      const A = p1.clone().addScaledVector(dir, off), B = p2.clone().addScaledVector(dir, off);
      const [a, b, p, q] = [scr(A), scr(B), scr(p1.clone().addScaledVector(dir, off * 0.18)), scr(p2.clone().addScaledVector(dir, off * 0.18))];
      const over = (s, e) => [e[0] + (e[0] - s[0]) * 0.12, e[1] + (e[1] - s[1]) * 0.12];
      line(d.main, a, b);
      line(d.e1, p, over(p, a));
      line(d.e2, q, over(q, b));
      // architects' ticks: short slashes at 45 degrees to the line
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 4;
      const tk = [Math.cos(ang) * 4.5, Math.sin(ang) * 4.5];
      line(d.t1, [a[0] - tk[0], a[1] - tk[1]], [a[0] + tk[0], a[1] + tk[1]]);
      line(d.t2, [b[0] - tk[0], b[1] - tk[1]], [b[0] + tk[0], b[1] + tk[1]]);
      // the number beside the middle of the line, away from the model
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      let n = [m[0] - sc[0], m[1] - sc[1]];
      const len = Math.hypot(...n) || 1;
      n = [n[0] / len, n[1] / len];
      const tx = Math.min(W - 6, Math.max(6, m[0] + n[0] * 13)), ty = Math.min(H - 6, Math.max(10, m[1] + n[1] * 11));
      d.text.setAttribute('x', tx);
      d.text.setAttribute('y', ty);
      d.text.setAttribute('text-anchor', Math.abs(n[0]) > 0.6 ? (n[0] > 0 ? 'start' : 'end') : 'middle');
    };
    const o = new THREE.Vector3();
    for (const d of this.dims) {
      if (d.kind === 'w') dimAt(d, V(box.min.x, Y(sy), Z(sz)), V(box.max.x, Y(sy), Z(sz)), V(0, 0, sz));
      else if (d.kind === 'h') dimAt(d, V(X(sx), Y(sy), box.min.z), V(X(sx), Y(sy), box.max.z), V(sx, 0, 0));
      else if (d.kind === 'd') dimAt(d, V(X(sx), box.min.y, Z(sz)), V(X(sx), box.max.y, Z(sz)), V(sx, 0, 0).multiplyScalar(0.7).add(V(0, 0, sz * 0.7)));
      else if (d.kind === 'pp') dimAt(d, V(this.posts[0], Y(sy), Z(-sz)), V(this.posts[1], Y(sy), Z(-sz)), V(0, 0, -sz * 0.75));
      else if (d.kind === 'post') {
        // the row of rack screws: a centre line (dash and dot) down the post
        const x = this.posts[d.i], ext = off * 0.35;
        line(d.main, scr(V(x, Y(sy) + sy * 0.2, box.min.z - ext)), scr(V(x, Y(sy) + sy * 0.2, box.max.z + ext)));
      } else if (d.kind === 'unit') {
        // on the side away from the height: a dot on the module's face, a leader out, the name
        const b = d.box;
        this.explode.offset('unit:' + d.k, o);
        const xs = -sx, yF = sy < 0 ? b[0][1] : b[1][1], zm = (b[0][2] + b[1][2]) / 2;
        const p0 = V(xs < 0 ? b[0][0] : b[1][0], yF, zm).add(o);
        const p1 = p0.clone().add(V(xs * off * 0.55, 0, 0));
        const a = scr(p0), e = scr(p1);
        const dir = Math.sign(e[0] - a[0]) || 1;
        const tail = [e[0] + dir * 10, e[1]];
        d.lead.setAttribute('points', `${a[0]},${a[1]} ${e[0]},${e[1]} ${tail[0]},${tail[1]}`);
        d.dot.setAttribute('cx', a[0]);
        d.dot.setAttribute('cy', a[1]);
        d.text.setAttribute('x', Math.min(W - 4, Math.max(4, tail[0] + dir * 4)));
        d.text.setAttribute('y', tail[1]);
        d.text.setAttribute('text-anchor', dir > 0 ? 'start' : 'end');
      }
    }
  }
}

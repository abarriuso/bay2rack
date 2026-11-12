import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { MAT, boxUV, materialFor } from './materials.js';
import { buildScene } from './scene.js';
import { ViewTools } from './blueprint.js';

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);      // OpenSCAD is Z-up
const FOV = 30;                                 // the view's angle of view (top to bottom), degrees
const VIEW_DIR = new THREE.Vector3(-0.55, -1, 0.6).normalize();   // front-left, from above
// motion: off for those who ask the system for less of it
const CALM = matchMedia('(prefers-reduced-motion: reduce)');
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeBack = (t) => 1 + 2.6 * (t - 1) ** 3 + 1.6 * (t - 1) ** 2;      // past the end and back: it settles
// the outline of the part a step edits: a little off the surfaces (no z-fighting), a thin line, a faint fill
const MARK_PAD = 1.2, MARK_FILL = 0.05, MARK_LINE = 1.6;
const signal = () => getComputedStyle(document.documentElement).getPropertyValue('--signal').trim() || '#d81f12';

function gradient(top, bottom) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Viewer {
  constructor(el) {
    this.el = el;
    const mobile = matchMedia('(max-width: 900px)').matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;   // (PCFSoftShadowMap is gone from three.js)
    el.appendChild(this.renderer.domElement);
    // the keyboard turns it too: arrows orbit, + / - zoom, Home (or 0) frames it again; its label says what it shows
    const canvas = this.renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.addEventListener('keydown', (e) => this.onKey(e));

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.75;
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 1, 50000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.addEventListener('change', () => { this.dirty = true; });
    // a drag takes the camera from a glide; while a finger or the mouse holds it, frames are asked for
    this.controls.addEventListener('start', () => { this.stopFly?.(); this.dragging = true; this.kick?.(); });
    this.controls.addEventListener('end', () => { this.dragging = false; this.kick?.(); });

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8b8f99, 0.6));
    this.key = new THREE.DirectionalLight(0xffffff, 2.2);
    this.key.castShadow = true;
    this.key.shadow.mapSize.setScalar(mobile ? 1024 : 2048);   // (phones: a quarter of the shadow work)
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.6;
    this.scene.add(this.key, this.key.target);
    const rim = new THREE.DirectionalLight(0xdfe8ff, 0.6);
    rim.position.set(1.6, 1.4, 0.8);
    this.scene.add(rim);

    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.22 }));
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);

    this.composer = new EffectComposer(this.renderer,
      new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: mobile ? 0 : 4 }));
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new OutputPass());

    this.model = null;
    this.extras = null;
    this.printMats = [];
    this.filament = [0x26282c, 0x2e3035, 0x36383d];
    this.show = { cables: true, side: true };
    this.parts = null;        // the boxes of the assembly's parts (SCENE parts), what a step can point at
    this.marks = new Set();   // outlines on screen (the one pointed at, and pulses)
    this.mark = null;         // the outline of what the steps point at, and that target
    this.pointKey = '';
    this.pointTarget = null;
    this.setTheme('light');
    new ResizeObserver(() => this.resize()).observe(el);
    this.resize();
    this.camera.position.set(-300, -500, 300);
    this.hooks = [];          // per-frame callbacks (animations)
    this.active = true;       // paused while scrolled out of view
    // the frames: one is asked for only while there is something to draw (dirty, an animation, the camera moving or
    // held); at rest nothing runs at all, not even an empty requestAnimationFrame
    let last = performance.now();
    let frame = 0;
    const loop = (now) => {
      frame = 0;
      const dt = Math.min(0.1, Math.max(0, now - last) / 1000);
      last = now;
      if (!this.active) return;                           // (the IntersectionObserver asks again when it is back)
      // the damping after a drag works per refresh: kept to the same time at 60, 120 or 144 Hz
      this.controls.dampingFactor = 1 - Math.pow(1 - 0.12, Math.max(dt, 1 / 240) * 60);
      for (const f of [...this.hooks]) f(dt);
      // controls.update() is true while the camera moves (dragging, and the damping after it)
      const moved = this.controls.update();
      if (moved || this._dirty || this.hooks.length) {
        this._dirty = false;
        this.depthRange();
        this.composer.render();
        this.tools?.place();                              // the blueprint's labels follow (only when it drew)
      }
      if (moved || this._dirty || this.hooks.length || this.dragging) this.kick();
    };
    this.kick = () => {
      if (frame) return;
      last = Math.max(last, performance.now() - 1000 / 60);   // (after a rest the first step is one frame, not a jump)
      frame = requestAnimationFrame(loop);
    };
    this.kick();
    new IntersectionObserver(([e]) => { this.active = e.isIntersecting; this.dirty = true; }).observe(el);
    // the blueprint and the explode, in the page's viewer only (not in an off-screen one, the GLB export)
    const bar = el.closest('.viewer')?.querySelector('.floatbar');
    this.tools = bar ? new ViewTools(this, bar) : null;
  }

  // something changed on screen: a frame is asked for
  get dirty() { return this._dirty; }
  set dirty(on) { this._dirty = on; if (on) this.kick?.(); }

  // what the view shows, for screen readers (the canvas is an image to them)
  setLabel(text) {
    this.renderer.domElement.setAttribute('aria-label', text);
  }

  onKey(e) {
    this.stopFly?.();
    const step = Math.PI / 18;
    const up = THREE.Object3D.DEFAULT_UP;                  // Z
    const off = this.camera.position.clone().sub(this.controls.target);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') off.applyAxisAngle(up, e.key === 'ArrowLeft' ? -step : step);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const right = new THREE.Vector3().crossVectors(off, up).normalize();
      const tilted = off.clone().applyAxisAngle(right, e.key === 'ArrowUp' ? step : -step);
      const a = tilted.angleTo(up);
      if (a > 0.05 && a < Math.PI - 0.05) off.copy(tilted);
    }
    else if (e.key === '+' || e.key === '=') off.multiplyScalar(0.85);
    else if (e.key === '-' || e.key === '_') off.multiplyScalar(1 / 0.85);
    else if (e.key === 'Home' || e.key === '0') { e.preventDefault(); this.fit(); return; }
    else return;
    e.preventDefault();
    this.camera.position.copy(this.controls.target).add(off);
    this.controls.update();
  }

  setTheme(theme) {
    this.dirty = true;
    this.scene.background = theme === 'dark' ? gradient('#232a2e', '#0f1214') : gradient('#f1f3f2', '#d6dbd8');
    // the outlines take the accent of the theme (the page has switched it already)
    const c = signal();
    for (const m of this.marks) for (const mat of m.userData.mats) mat.color.set(c);
    this.tools?.theme(theme);
  }

  resize() {
    this.dirty = true;
    const w = Math.max(this.el.clientWidth, 1);
    const h = Math.max(this.el.clientHeight, 1);
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  clear() {
    this.dirty = true;
    this.stopArrive?.();
    this.tools?.cleared();
    for (const o of [this.model, this.extras]) {
      if (!o) continue;
      this.scene.remove(o);
      o.traverse((c) => { c.geometry?.dispose(); [].concat(c.material ?? []).forEach((m) => m.dispose()); });
    }
    this.model = this.extras = null;
    this.printMats = [];
    // the outlines belong to this model: they go with it (the one pointed at comes back with the next one)
    for (const m of [...this.marks]) this.dropMark(m);
    this.mark = null;
    this.parts = null;
  }

  // filament colours for [adapter, fillers, modules]
  setFilament(hexes) {
    this.dirty = true;
    this.filament = hexes;
    for (const { mat, i } of this.printMats) mat.color.setHex(hexes[i]);
  }

  // cables / side panel on or off, without re-rendering
  setVisible(what, on) {
    this.dirty = true;
    this.show[what] = on;
    // (the cables stay away while the build is apart)
    const off = what === 'cables' && this.tools?.cablesHidden;
    this.extras?.traverse((o) => { if (o.userData.role === what) o.visible = on && !off; });
  }

  // one STL (a printed part) or a coloured 3MF -> group of meshes with real materials
  parse(buffer, ext) {
    const obj = new THREE.Group();
    const add = (geo, mat) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = m.receiveShadow = true;
      obj.add(m);
      return m;
    };
    if (ext === '3mf') {
      new ThreeMFLoader().parse(buffer).traverse((c) => {
        if (!c.isMesh) return;
        c.updateWorldMatrix(true, false);
        const src = [].concat(c.material)[0];
        const hex = src?.color ? src.color.getHex(THREE.SRGBColorSpace) : 0x808080;
        const { mat, print, slot } = materialFor(hex, this.filament);
        let geo = c.geometry.clone().applyMatrix4(c.matrixWorld);
        if (print) {
          geo = boxUV(geo);
          this.printMats.push({ mat, i: slot });
        } else if (mat.map) geo = boxUV(geo, 40);           // textured parts (PCBs) need UVs too
        geo.computeVertexNormals();
        add(geo, mat);
      });
    } else {
      const geo = boxUV(new STLLoader().parse(buffer));
      geo.computeVertexNormals();
      const mat = MAT.filament(this.filament[0]);
      this.printMats.push({ mat, i: 0 });
      add(geo, mat);
    }
    return obj;
  }

  // buffer: STL (one printed part) or 3MF (coloured assembly). scene: parsed SCENE data
  load(buffer, ext, opts = {}) {
    this.clear();
    const obj = this.parse(buffer, ext);
    this.show3d(obj, opts);
    this.arrive(obj, opts.keepView);
    this.tools?.loaded(opts.keepView);
  }

  // an animation of the view: f(0..1) on every frame for `ms`, then it is gone (the view only draws while
  // something moves). Returns how to stop it.
  run(ms, f, done) {
    if (CALM.matches) { f(1); done?.(); this.dirty = true; return () => {}; }
    let t = 0;
    const stop = () => { const i = this.hooks.indexOf(hook); if (i >= 0) this.hooks.splice(i, 1); this.dirty = true; };
    const hook = (dt) => { t = Math.min(1, t + dt * 1000 / ms); f(t); if (t >= 1) { stop(); done?.(); } };
    this.hooks.push(hook);
    this.dirty = true;                                    // (the frames start)
    return stop;
  }

  // a new result settles into place (a little for an edit, more for another piece): the eye catches the change
  arrive(obj, edit) {
    const from = edit ? 0.985 : 0.93;
    const c = (this.focus ?? this.whole).getCenter(new THREE.Vector3());
    this.stopArrive = this.run(edit ? 240 : 420, (t) => {
      const s = from + (1 - from) * easeBack(t);
      obj.scale.setScalar(s);
      obj.position.copy(c).multiplyScalar(1 - s);          // (about the middle of what is on screen)
    }, () => { this.stopArrive = null; });
  }

  // several named pieces (the animated hero): items = [{ name, buffer, ext }]
  loadGroups(items, opts = {}) {
    this.clear();
    const root = new THREE.Group();
    this.groups = {};
    for (const it of items) {
      const g = this.parse(it.buffer, it.ext ?? '3mf');
      g.name = it.name;
      this.groups[it.name] = g;
      root.add(g);
    }
    this.show3d(root, opts);
  }

  show3d(obj, { keepView = false, focus = null, scene = null } = {}) {
    this.dirty = true;
    this.model = obj;
    this.scene.add(obj);
    if (scene) {
      this.extras = buildScene(scene);
      this.scene.add(this.extras);
      for (const k of Object.keys(this.show)) this.setVisible(k, this.show[k]);
    }

    const box = new THREE.Box3().setFromObject(obj);
    if (this.extras) box.union(new THREE.Box3().setFromObject(this.extras));
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const span = Math.max(size.x, size.y, size.z, 50);
    this.floor.scale.set(span * 6, span * 6, 1);
    this.floor.position.set(center.x, center.y, box.min.z - 0.5);
    this.key.position.copy(center).add(new THREE.Vector3(-0.6, -1.0, 1.6).multiplyScalar(span * 1.5));
    this.key.target.position.copy(center);
    const sc = this.key.shadow.camera;
    sc.left = sc.bottom = -span;
    sc.right = sc.top = span;
    sc.near = span * 0.2;
    sc.far = span * 5;
    sc.updateProjectionMatrix();

    this.focus = focus ? box.clone().intersect(new THREE.Box3(new THREE.Vector3(...focus.min), new THREE.Vector3(...focus.max))) : null;
    if (this.focus?.isEmpty()) this.focus = null;
    this.whole = box;
    // (a waiting entry from a side is the first model's way in, whatever the view)
    if (!keepView || this.entry) this.fit(undefined, this.entry);
    this.entry = null;
    // a step still pointed at: its outline is there at once on the new result (it was on screen already)
    this.parts = scene?.parts ?? null;
    const boxes = this.partBoxes(this.pointTarget);
    if (boxes.length) {
      this.mark = this.makeMark(boxes);
      this.setMark(this.mark, 1);
    }
  }

  fit(box = this.focus ?? this.whole, entry = null) {
    this.dirty = true;
    const pose = this.fitPose(box);
    if (!pose) return;
    this.camera.near = pose.near;
    this.camera.far = pose.far;
    this.camera.updateProjectionMatrix();
    this.flyTo(pose.eye, pose.target, entry);
  }

  // where fit() puts the camera (at the view's own angle of view, FOV, and shape)
  fitPose(box = this.focus ?? this.whole, aspect = this.camera.aspect) {
    if (!box) return null;
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getBoundingSphere(new THREE.Sphere()).radius;
    // the narrower of the two angles of view: a view taller than wide (a portrait window, a zoomed-out page) frames
    // by its width, else the sides of the model are cut
    const vHalf = THREE.MathUtils.degToRad(FOV / 2);
    const half = Math.min(vHalf, Math.atan(Math.tan(vHalf) * (aspect || 1)));
    const dist = radius / Math.sin(half) * (box === this.focus ? 0.85 : 0.8);
    return { eye: center.clone().addScaledVector(VIEW_DIR, dist), target: center, near: dist / 100, far: dist * 30 };
  }

  // the first model comes in from a side: the camera starts out along `dir` (a direction from the target) and glides
  // to the fitted view in `ms` (the film hands over to the configurator with it). Before the model is there it waits.
  enterFrom(dir, ms = 1100) {
    const entry = { dir: (dir?.isVector3 ? dir.clone() : new THREE.Vector3(...dir)).normalize(), ms };
    if (this.whole) this.fit(undefined, entry);
    else this.entry = entry;
  }

  // the camera glides to a view instead of jumping; the first time it comes in from further out, turning.
  // A drag or a key takes over at once.
  flyTo(eye, target, entry = null) {
    this.stopFly?.();
    const first = !this.flown;
    this.flown = true;
    const from = entry ? target.clone().addScaledVector(entry.dir, eye.distanceTo(target) * 1.3)
      : first ? target.clone().add(eye.clone().sub(target).multiplyScalar(1.3).applyAxisAngle(THREE.Object3D.DEFAULT_UP, -0.45))
        : this.camera.position.clone();
    const fromT = first || entry ? target.clone() : this.controls.target.clone();
    this.stopFly = this.run(entry ? entry.ms : first ? 1100 : 480, (t) => {
      const k = easeOut(t);
      this.camera.position.lerpVectors(from, eye, k);
      this.controls.target.lerpVectors(fromT, target, k);
      this.controls.update();
    }, () => { this.stopFly = null; });
  }

  // the near plane as far out as the scene allows (it was a hundredth of the distance: the depth buffer then had too
  // little precision, and a cable inside the case came through its closed front as a dotted line). Only the frames
  // that draw: a box distance, the projection again only when it changes by more than a few per cent.
  depthRange() {
    const box = this.whole;
    if (!box) return;
    const cam = this.camera.position;
    const d = cam.distanceTo(this.controls.target);
    // (room round the scene for what moves out of it: the exploded parts, the outlines)
    const room = box.getSize(this._v ??= new THREE.Vector3()).length() * 0.1 + 180;
    const gap = Math.max(0, box.distanceToPoint(cam) - room);
    const near = Math.max(d / 100, Math.min(gap * 0.8, d / 2));
    if (Math.abs(near - this.camera.near) > this.camera.near * 0.04) {
      this.camera.near = near;
      this.camera.updateProjectionMatrix();
    }
  }

  // camera from eye + target (README captures)
  look(eye, target) {
    this.dirty = true;
    this.camera.position.set(...eye);
    this.controls.target.set(...target);
    const d = this.camera.position.distanceTo(this.controls.target);
    this.camera.near = d / 100;
    this.camera.far = d * 30;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  // ---------------------------------------------------------------- what a step edits
  // target: a list of 'front', 'posts', 'units', 'unit:k', 'zones', 'zone:i' -> boxes [[x0, y0, z0], [x1, y1, z1]]
  // from the SCENE parts of the assembly (none for a single piece)
  partBoxes(target) {
    const p = this.parts;
    if (!p || !target?.length) return [];
    const out = [];
    for (const t of target) {
      const [what, i] = t.split(':');
      if (what === 'front' && p.front) out.push(p.front);
      else if (what === 'posts') out.push(...(p.posts ?? []));
      else if (what === 'units' && p.units?.length) {
        // all of them: one box round the stack (they touch)
        const bs = p.units.map(([, b]) => b);
        out.push([[0, 1, 2].map((a) => Math.min(...bs.map((b) => b[0][a]))), [0, 1, 2].map((a) => Math.max(...bs.map((b) => b[1][a])))]);
      } else if (what === 'unit' && p.units?.[i]) out.push(p.units[i][1]);
      else if (what === 'zones') out.push(...(p.zones ?? []));
      else if (what === 'zone' && p.zones?.[i]) out.push(p.zones[i]);
    }
    return out;
  }

  // a thin outline and a faint fill round each box, in the accent colour, starting invisible
  makeMark(boxes) {
    const c = signal();
    const fill = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false });
    const line = new LineMaterial({ color: c, linewidth: MARK_LINE, transparent: true, opacity: 0, depthWrite: false });
    const g = new THREE.Group();
    for (const [a, b] of boxes) {
      const min = new THREE.Vector3(...a).subScalar(MARK_PAD);
      const max = new THREE.Vector3(...b).addScalar(MARK_PAD);
      const size = max.clone().sub(min);
      const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
      const edges = new THREE.EdgesGeometry(geo);
      const segs = new LineSegmentsGeometry().fromEdgesGeometry(edges);
      edges.dispose();
      for (const o of [new THREE.Mesh(geo, fill), new LineSegments2(segs, line)]) {
        o.position.copy(min).add(max).multiplyScalar(0.5);
        o.renderOrder = 2;                                 // over the model's transparent bits (window, glass)
        g.add(o);
      }
    }
    g.userData.mats = [fill, line];
    g.userData.k = 0;
    this.marks.add(g);
    this.scene.add(g);
    return g;
  }

  // k = 0..1: how much it shows; it grows a hair as it fades in (transform + opacity, nothing else changes)
  setMark(mark, k) {
    const [fill, line] = mark.userData.mats;
    mark.userData.k = k;
    fill.opacity = MARK_FILL * Math.min(k, 1.6);
    line.opacity = Math.min(1, k);
    const s = 1 + 0.012 * (1 - Math.min(k, 1));
    for (const o of mark.children) o.scale.setScalar(s);
    mark.visible = k > 0.001;
    this.dirty = true;
  }

  fadeMark(mark, to, ms, done) {
    mark.userData.stop?.();
    // (out of view the frame hooks wait: no fade to leave pending, it just is so)
    if (!this.active) { this.setMark(mark, to); done?.(); return; }
    const from = mark.userData.k;
    mark.userData.stop = this.run(ms, (t) => this.setMark(mark, from + (to - from) * easeOut(t)),
      () => { mark.userData.stop = null; done?.(); });
  }

  dropMark(mark) {
    mark.userData.stop?.();
    clearTimeout(mark.userData.timer);
    this.marks.delete(mark);
    this.scene.remove(mark);
    for (const o of mark.children) o.geometry.dispose();
    for (const m of mark.userData.mats) m.dispose();
    this.dirty = true;
  }

  // what the steps point at now (null: nothing): the old outline fades out, the new one in
  point(target) {
    const key = target?.join(' ') ?? '';
    if (key === this.pointKey) return;
    this.pointKey = key;
    this.pointTarget = target?.length ? target : null;
    const old = this.mark;
    if (old) this.fadeMark(old, 0, 140, () => this.dropMark(old));
    const boxes = this.partBoxes(this.pointTarget);
    this.mark = boxes.length ? this.makeMark(boxes) : null;
    if (this.mark) this.fadeMark(this.mark, 1, 180);
  }

  // a change landed here: the outline flares once (on its own, or over the one pointed at), so the eye goes there
  pulse(target) {
    const boxes = this.partBoxes(target);
    if (!boxes.length || !this.active) return;           // (nobody would see it)
    if (this.mark && target.join(' ') === this.pointKey) {
      const m = this.mark;
      if (CALM.matches) return;                           // (it is on screen already)
      m.userData.stop?.();
      m.userData.stop = this.run(520, (t) => this.setMark(m, 1 + 0.9 * Math.sin(Math.PI * t)), () => { m.userData.stop = null; });
      return;
    }
    const m = this.makeMark(boxes);
    // without motion it shows for a moment and goes, with no animation (and no frame hook)
    if (CALM.matches) { this.setMark(m, 1); m.userData.timer = setTimeout(() => this.dropMark(m), 900); return; }
    m.userData.stop = this.run(900, (t) => this.setMark(m, t < 0.2 ? easeOut(t / 0.2) * 1.5 : 1.5 * (1 - easeOut((t - 0.2) / 0.8))),
      () => { m.userData.stop = null; this.dropMark(m); });
  }
}

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { MAT, PRINT_HEX, boxUV, materialFor } from './materials.js';
import { buildScene } from './scene.js';

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);      // OpenSCAD is Z-up
const VIEW_DIR = new THREE.Vector3(-0.55, -1, 0.6).normalize();   // front-left, from above

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
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.75;
    this.camera = new THREE.PerspectiveCamera(30, 1, 1, 50000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8b8f99, 0.6));
    this.key = new THREE.DirectionalLight(0xffffff, 2.2);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
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
    this.setTheme('light');
    new ResizeObserver(() => this.resize()).observe(el);
    this.resize();
    this.camera.position.set(-300, -500, 300);
    this.hooks = [];          // per-frame callbacks (animations)
    this.active = true;       // paused while scrolled out of view
    let last = performance.now();
    const loop = (now) => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!this.active) return;
      for (const f of this.hooks) f(dt);
      this.controls.update();
      this.composer.render();
    };
    requestAnimationFrame(loop);
    new IntersectionObserver(([e]) => { this.active = e.isIntersecting; }).observe(el);
  }

  setTheme(theme) {
    this.scene.background = theme === 'dark' ? gradient('#2b3038', '#14161a') : gradient('#f7f8fa', '#dde2e9');
  }

  resize() {
    const w = Math.max(this.el.clientWidth, 1);
    const h = Math.max(this.el.clientHeight, 1);
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  clear() {
    for (const o of [this.model, this.extras]) {
      if (!o) continue;
      this.scene.remove(o);
      o.traverse((c) => { c.geometry?.dispose(); [].concat(c.material ?? []).forEach((m) => m.dispose()); });
    }
    this.model = this.extras = null;
    this.printMats = [];
  }

  // filament colours for [adapter, fillers, modules]
  setFilament(hexes) {
    this.filament = hexes;
    for (const { mat, i } of this.printMats) mat.color.setHex(hexes[i]);
  }

  // cables / side panel on or off, without re-rendering
  setVisible(what, on) {
    this.show[what] = on;
    this.extras?.traverse((o) => { if (o.userData.role === what) o.visible = on; });
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
        const { mat, print } = materialFor(hex, this.filament);
        let geo = c.geometry.clone().applyMatrix4(c.matrixWorld);
        if (print) {
          geo = boxUV(geo);
          const i = PRINT_HEX.findIndex((p) => Math.abs(p - hex) < 0x030303);
          this.printMats.push({ mat, i: i >= 0 ? i : 2 });
        }
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
    this.show3d(this.parse(buffer, ext), opts);
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
    if (!keepView) this.fit();
  }

  fit(box = this.focus ?? this.whole) {
    if (!box) return;
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getBoundingSphere(new THREE.Sphere()).radius;
    const dist = radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2)) * (box === this.focus ? 0.85 : 0.8);
    this.camera.position.copy(center).addScaledVector(VIEW_DIR, dist);
    this.camera.near = dist / 100;
    this.camera.far = dist * 20;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(center);
    this.controls.update();
  }

  // camera from eye + target (README captures)
  look(eye, target) {
    this.camera.position.set(...eye);
    this.controls.target.set(...target);
    const d = this.camera.position.distanceTo(this.controls.target);
    this.camera.near = d / 100;
    this.camera.far = d * 30;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  // PNG of the current view
  snapshot() {
    this.composer.render();
    return this.renderer.domElement.toDataURL('image/png');
  }
}

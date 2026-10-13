import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);      // OpenSCAD is Z-up

const PART_COLOR = 0xe58a3a;
const VIEW_DIR = new THREE.Vector3(-0.55, -1, 0.6).normalize();   // front-left, from above

export class Viewer {
  constructor(el) {
    this.el = el;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 1, 50000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x7d8597, 1.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(-1, -1.6, 2.2);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.7);
    rim.position.set(1.6, 1.2, 0.6);
    this.scene.add(rim);

    this.model = null;
    this.grid = null;
    new ResizeObserver(() => this.resize()).observe(el);
    this.resize();
    this.camera.position.set(-300, -500, 300);
    const loop = () => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    loop();
  }

  resize() {
    const w = Math.max(this.el.clientWidth, 1);
    const h = Math.max(this.el.clientHeight, 1);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  clear() {
    for (const o of [this.model, this.grid]) {
      if (!o) continue;
      this.scene.remove(o);
      o.traverse((c) => { c.geometry?.dispose(); [].concat(c.material ?? []).forEach((m) => m.dispose()); });
    }
    this.model = this.grid = null;
  }

  // buffer: ArrayBuffer of an STL (single colour) or a 3MF (coloured assembly)
  // focus: optional {min, max} region to frame instead of the whole model
  load(buffer, ext, { keepView = false, focus = null } = {}) {
    let obj;
    if (ext === '3mf') {
      obj = new ThreeMFLoader().parse(buffer);
      obj.traverse((c) => {
        if (!c.isMesh) return;
        const src = [].concat(c.material);
        const mats = src.map((m) => new THREE.MeshStandardMaterial({
          color: m.color ?? new THREE.Color(PART_COLOR), vertexColors: !!m.vertexColors,
          roughness: 0.6, metalness: 0.05, flatShading: true,
          transparent: m.opacity < 1 || m.transparent, opacity: m.opacity ?? 1, side: THREE.DoubleSide }));
        src.forEach((m) => m.dispose());
        c.material = Array.isArray(c.material) ? mats : mats[0];
      });
    } else {
      const geo = new STLLoader().parse(buffer);
      obj = new THREE.Group();
      obj.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: PART_COLOR, roughness: 0.55, metalness: 0.05, flatShading: true })));
      obj.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 28),
        new THREE.LineBasicMaterial({ color: 0x3b2410, transparent: true, opacity: 0.35 })));
    }
    this.clear();
    this.model = obj;
    this.scene.add(obj);

    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.y, 1) * 1.6;
    this.grid = new THREE.GridHelper(span, Math.round(span / 10), 0x8a93a6, 0xc4cad6);
    this.grid.rotation.x = Math.PI / 2;
    this.grid.position.set((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, box.min.z - 0.05);
    [].concat(this.grid.material).forEach((m) => { m.transparent = true; m.opacity = 0.45; });
    this.scene.add(this.grid);
    this.focus = focus ? box.clone().intersect(new THREE.Box3(new THREE.Vector3(...focus.min), new THREE.Vector3(...focus.max))) : null;
    if (this.focus?.isEmpty()) this.focus = null;
    if (!keepView) this.fit();
  }

  fit(box = this.focus ?? (this.model && new THREE.Box3().setFromObject(this.model))) {
    if (!box) return;
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getBoundingSphere(new THREE.Sphere()).radius;
    const dist = radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2)) * (box === this.focus ? 0.85 : 1.05);
    this.camera.position.copy(center).addScaledVector(VIEW_DIR, dist);
    this.camera.near = dist / 100;
    this.camera.far = dist * 20;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(center);
    this.controls.update();
  }
}

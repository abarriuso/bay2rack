// Dev only: render a build piece by piece and save it as GLB (+ its scene numbers) into
// docs/blender/ for the Blender hero video (scripts/blender/hero.py).
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { Viewer } from './viewer.js';

function parseScene(logs) {
  const scene = { cables: [] };
  for (const l of logs) {
    const m = l.match(/^ECHO: "SCENE (.*)"$/);
    if (!m) continue;
    try { const d = JSON.parse(m[1]); if (d.cable) scene.cables.push(d.cable); else Object.assign(scene, d); } catch { /* skip */ }
  }
  return scene;
}

const save = (path, body) => fetch('/__save?path=' + encodeURIComponent(path), { method: 'POST', body });

export async function exportBuild({ name, values, mods, runJob, definesFor, filament }) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:-4000px;top:0;width:320px;height:240px';
  document.body.append(el);
  const v = new Viewer(el);
  v.active = false;
  v.setFilament(filament);
  const base = { ...values, part: 'assembly' };
  const jobs = [['adapter', 0], ...mods.map((_, k) => ['module', k]), ['filler', 0], ['hardware', 0],
    ['bezel0', 0], ['bezel1', 0], ['brackets', 0]];
  const items = [];
  let scene = null;
  for (const [item, k] of jobs) {
    const res = await runJob([...definesFor(base), 'web_scene=true', `preview_item="${item}"`, `preview_index=${k}`], 'out.3mf');
    if (!res.ok) { console.warn('export: no geometry for', item, k); continue; }
    if (item === 'adapter') scene = parseScene(res.logs);
    items.push({ name: item === 'module' ? `module${k}` : item, buffer: res.data.buffer });
  }
  v.loadGroups(items, { scene: scene?.case ? scene : null });
  const root = new THREE.Group();
  root.name = name;
  root.rotation.x = -Math.PI / 2;      // OpenSCAD is Z-up, glTF is Y-up
  root.scale.setScalar(0.001);         // mm -> m
  root.add(v.model);
  if (v.extras) root.add(v.extras);
  const glb = await new GLTFExporter().parseAsync(root, { binary: true });
  await save(`blender/${name}.glb`, new Blob([glb]));
  await save(`blender/${name}.json`, JSON.stringify({ name, values, mods, scene }, null, 1));
  v.renderer.dispose();
  el.remove();
  return { name, bytes: glb.byteLength, pieces: items.map((i) => i.name) };
}

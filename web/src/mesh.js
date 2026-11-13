// The 3MF read off the page's thread (mesh-worker.js): a coloured assembly's triangles, grouped by colour, as flat
// arrays ready for the view - or null, and the view reads it itself as before.
let worker = null, next = 1;
const waiting = new Map();
export function meshesOf(data) {
  try {
    if (!worker) {
      worker = new Worker(new URL('./mesh-worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data: m }) => { waiting.get(m.id)?.(m.meshes); waiting.delete(m.id); };
      worker.onerror = () => { for (const ok of waiting.values()) ok(null); waiting.clear(); worker = null; };
    }
    const id = next++;
    return new Promise((ok) => {
      waiting.set(id, ok);
      worker.postMessage({ id, data: data.slice().buffer });   // (a copy: the render keeps its own)
    });
  } catch { return Promise.resolve(null); }
}

// Runs OpenSCAD (WebAssembly) off the main thread.
// The .wasm is compiled once; every render gets a fresh OpenSCAD instance
// (a program's main() can only run once per instance).

const FONTS = ['LiberationSans-Regular.ttf', 'LiberationSans-Bold.ttf'];   // (the model uses no italics: fills.scad)
const FONTS_CONF = '<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n'
                 + '<fontconfig><dir>/fonts</dir></fontconfig>\n';

let ready = null;

async function compileWasm(url) {
  try {
    return await WebAssembly.compileStreaming(fetch(url));
  } catch {
    return WebAssembly.compile(await (await fetch(url)).arrayBuffer());
  }
}

async function loadSources(base) {
  const get = async (p) => {
    const r = await fetch(base + 'scad/' + p);
    if (!r.ok) throw new Error(`cannot load ${p}`);
    return r.text();
  };
  const main = await get('bay2rack.scad');
  const libs = [...main.matchAll(/^\s*include\s*<([^>]+)>/gm)].map((m) => m[1]);
  return [['bay2rack.scad', main], ...(await Promise.all(libs.map(async (l) => [l, await get(l)])))];
}

async function loadFonts(base) {
  return Promise.all(FONTS.map(async (f) => {
    const r = await fetch(base + 'openscad/fonts/' + f);
    if (!r.ok) throw new Error(`cannot load ${f}`);       // (a missing file is the host's 404 page, not a font)
    return [f, new Uint8Array(await r.arrayBuffer())];
  }));
}

// shared: what another engine has already (the kit's engines get the first one's): the compiled WebAssembly - 11 MB
// not fetched and compiled again - the fonts and the model
async function init(base, shared) {
  const t0 = performance.now();
  const [mod, wasm, fonts, sources] = await Promise.all([
    import(/* @vite-ignore */ base + 'openscad/openscad.js'),
    shared?.wasm instanceof WebAssembly.Module ? shared.wasm : compileWasm(base + 'openscad/openscad.wasm'),
    shared?.fonts ?? loadFonts(base),
    shared?.sources ?? loadSources(base),
  ]);
  return { OpenSCAD: mod.default, wasm, fonts, sources, ms: performance.now() - t0 };
}

function mkdirs(FS, path) {
  let cur = '';
  for (const part of path.split('/').slice(1, -1)) {
    cur += '/' + part;
    try { FS.mkdir(cur); } catch { /* exists */ }
  }
}

async function run({ id, defines, out }) {
  const ctx = await ready;
  const logs = [];
  const t0 = performance.now();
  const inst = await ctx.OpenSCAD({
    noInitialRun: true,
    print: (s) => logs.push(s),
    printErr: (s) => logs.push(s),
    instantiateWasm(imports, done) {
      WebAssembly.instantiate(ctx.wasm, imports).then((i) => done(i));
      return {};
    },
  });
  const { FS } = inst;
  for (const [p, text] of ctx.sources) { mkdirs(FS, '/src/' + p); FS.writeFile('/src/' + p, text); }
  mkdirs(FS, '/fonts/x');
  for (const [f, bytes] of ctx.fonts) FS.writeFile('/fonts/' + f, bytes);
  FS.writeFile('/fonts/fonts.conf', FONTS_CONF);
  mkdirs(FS, '/out/x');

  const args = ['/src/bay2rack.scad', '--backend=manifold', '-o', '/out/' + out];
  if (out.endsWith('.stl')) args.push('--export-format', 'binstl');
  for (const d of defines) args.push('-D', d);
  let code;
  try {
    code = inst.callMain(args);
  } catch (e) {
    code = typeof e?.status === 'number' ? e.status : -1;
    if (code !== 0) logs.push(String(e?.message ?? e));
  }
  let data = null;
  try { data = FS.readFile('/out/' + out); } catch { /* no output */ }
  const ok = !!data && data.length > 0;
  self.postMessage({ type: 'result', id, ok, code, logs, ms: performance.now() - t0, data },
                   ok ? [data.buffer] : []);
}

self.onmessage = async ({ data: msg }) => {
  if (msg.type === 'init') {
    ready = init(msg.base, msg.shared);
    ready.then((c) => {
      // (the compiled module goes along for the kit's engines; a browser that cannot send one: they compile their own)
      try { self.postMessage({ type: 'ready', ms: c.ms, shared: { wasm: c.wasm, fonts: c.fonts, sources: c.sources } }); }
      catch { self.postMessage({ type: 'ready', ms: c.ms }); }
    }, (e) => self.postMessage({ type: 'error', message: String(e?.message ?? e) }));
  } else if (msg.type === 'run') {
    try {
      await run(msg);
    } catch (e) {
      self.postMessage({ type: 'result', id: msg.id, ok: false, code: -1, logs: [String(e?.message ?? e)], ms: 0 });
    }
  }
};

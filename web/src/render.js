// Rendering the current settings and showing the result: the 3D view, the bill of materials, the warnings.
import { t } from './i18n.js';
import { bomText, warnText } from './help.js';
import { renderLegend } from './legend.js';
import { UI, $, CALM, h, num, S, atRest } from './state.js';
import { calc, modLabel, usedMods } from './model.js';
import { viewer, engineStarted, runJob, cachedJob, readyMade, definesFor, setStatus, announce } from './engine.js';
import { meshesOf } from './mesh.js';
import { sfx } from './sound.js';
import { renderSteps } from './steps.js';
import { pieceLabel } from './tabs.js';
import { kitList } from './kit.js';

// ---------------------------------------------------------------- render
export let timer = null;
export function schedule(ms = 450) {
  clearTimeout(timer);
  timer = setTimeout(render, ms);
}

// the settings' render: its file and what it is asked with
const jobOf = (values) => {
  const ext = values.part === 'assembly' ? '3mf' : 'stl';
  const defs = definesFor(values);
  if (ext === '3mf') defs.push('web_scene=true');
  return { ext, defs, key: ext + '\n' + defs.join('\n') };
};

export async function render() {
  if (S.kitBusy) { S.wantRender = true; return; }
  if (S.busy) { S.dirty = true; return; }
  // (the build made ahead first, if the view has nothing yet - even with the engine ready: it is there at once)
  if (S.engine !== 'ready' || (viewer && !viewer.model && !S.aheadTried)) { S.wantRender = true; ahead(); return; }
  if (S.aheading) { S.wantRender = true; return; }      // (the build made ahead is on its way: it renders after it)
  const values = { ...S.values };
  const { ext, defs, key } = jobOf(values);
  // (the build made ahead is on screen already: nothing to do)
  if (key === S.aheadKey) { S.aheadKey = null; S.wantRender = false; return; }
  S.aheadKey = null;
  S.busy = true; S.dirty = false; S.wantRender = false;
  setStatus(t('rendering'), 'busy');
  // (the visitor's own render - not the first model: a tick when it takes a moment, a chime when it is there)
  const theirs = !!viewer?.model;
  const working = theirs ? setTimeout(() => sfx.work(), 220) : 0;
  const t0 = performance.now();
  const res = await cachedJob(runJob, defs, 'out.' + ext);
  clearTimeout(working);
  await engineStarted;                                  // (the 3D view loads alongside the engine)
  if (res.ok && ext === '3mf') {
    res.meshes = await meshesOf(res.data);              // (read off the page's thread)
    // the view's first model: the room around it made a piece at a time, in pauses of the scroll
    if (viewer && !viewer.model) { await viewer.prepareScene(sceneOf(res)); await atRest(); }
  }
  S.busy = false;
  try {
    showResult(res, ext, values);
    if (theirs && !res.ok) sfx.fail();
    else if (theirs && !S.dirty && performance.now() - t0 > 220) sfx.done();
  } catch (e) {
    console.error(e);
    setStatus(t('failed'), 'error');
  }
  if (S.dirty || S.wantRender) render();
}

// The engine is not ready yet, the 3D view is: the build made ahead, if these are its settings (engine.js), on screen
// now - once; the engine renders whatever comes after
async function ahead() {
  if (!viewer || S.aheadTried) return;
  S.aheadTried = true;
  const values = { ...S.values };
  const { ext, defs, key } = jobOf(values);
  S.aheading = true;
  const res = await readyMade(defs, 'out.' + ext);
  if (res && ext === '3mf') {
    res.meshes = await meshesOf(res.data);
    await viewer.prepareScene(sceneOf(res));            // (the room around it, made a piece at a time)
  }
  if (res) await atRest();                              // (laying it out holds the page a moment: in a pause)
  S.aheading = false;
  if (res && !S.busy && jobOf(S.values).key === key) {  // (the settings still those it was made for)
    try {
      showResult(res, ext, values);
      S.aheadKey = key;
    } catch (e) { console.error(e); }
  }
  if (S.engine === 'ready' && S.wantRender) render();
}

// the scene around the build (its case, the homelab, the cables), from its SCENE lines
export function sceneOf(res) {
  const scene = { cables: [] };
  for (const l of res.logs) {
    const m = l.match(/^ECHO: "SCENE (.*)"$/);
    if (!m) continue;
    try {
      const d = JSON.parse(m[1]);
      if (d.cable) scene.cables.push(d.cable); else Object.assign(scene, d);
    } catch { /* ignore a malformed line */ }
  }
  if (UI.sleeper && scene.case) scene.case.style = 'sleeper';
  return scene;
}

export function showResult(res, ext, values) {
  const echoes = res.logs.map((l) => l.match(/^ECHO: "(.*)"$/)?.[1]).filter(Boolean);
  const errors = res.logs.filter((l) => /^(ERROR|WARNING):/.test(l));
  $('#log').textContent = res.logs.join('\n');
  showEchoes(echoes, errors);
  if (!res.ok) { setStatus(t('failed'), 'error'); $('#download').disabled = true; return; }
  const key = [values.part, values.bays, values.scene, values.case_view, values.module_type].join('|');
  const homelab = values.part === 'assembly' && values.case_view === 'tower' && values.scene === 'homelab';
  const top = values.bays * 43.18 + 25;
  // the view opens on the rack (in the homelab a little wider: its patch cords, the top of the tower), not on the
  // whole room; the rest is there to turn to
  const focus = values.part !== 'assembly' ? null
    : homelab ? { min: [-112, -45, -32], max: [112, 40, top + 14] } : { min: [-95, -40, -25], max: [95, 40, top] };
  const scene = sceneOf(res);
  viewer?.load(res.data.buffer, ext, { keepView: key === S.lastKey, focus, scene: ext === '3mf' ? scene : null, meshes: res.meshes });
  delete res.meshes;                                    // (the view has them now; the render cache keeps the file only)
  // the edit made in a step has landed: its part flares once (the assembly only; a newer edit waits for its own result)
  if (S.pulse && !S.dirty) {
    if (ext === '3mf') viewer?.pulse(S.pulse);
    S.pulse = null;
  }
  viewer?.setLabel(`${t('aria_view')} ${describeView(values)}`);
  S.lastScene = ext === '3mf' && UI.cables ? scene : null;
  renderLegend($('#legend'), S.lastScene);
  $('#caseName').textContent = ext === '3mf' && scene.case ? (UI.sleeper ? t('sleeperName') : t('case_m_' + scene.case.id)) : '';
  S.lastKey = key;
  if (S.result) URL.revokeObjectURL(S.result.url);
  S.result = { url: URL.createObjectURL(new Blob([res.data])), name: `bay2rack-${values.part}.${ext}` };
  $('#download').disabled = false;
  setStatus(t('rendered', { s: num(res.ms / 1000) }), 'ok');
  S.lastShown = { values, ext, scene, ms: res.ms };
}

// the texts of the result in the language now in use (after a switch: the view's label, the case, the status)
export function relabel() {
  const r = S.lastShown;
  if (!r) return;
  viewer?.setLabel(`${t('aria_view')} ${describeView(r.values)}`);
  $('#caseName').textContent = r.ext === '3mf' && r.scene.case ? (UI.sleeper ? t('sleeperName') : t('case_m_' + r.scene.case.id)) : '';
  if ($('#status').classList.contains('ok') && !S.dirty) setStatus(t('rendered', { s: num(r.ms / 1000) }), 'ok');
}

export function showEchoes(echoes, errors) {
  S.lastEcho = [echoes, errors];
  const bom = echoes.filter((e) => e.startsWith('BOM | ')).map((e) => e.slice(6));
  // the rack opening (it moves with the screws and their fixing) sizes what the steps offer
  const opening = Number(echoes.find((e) => e.startsWith('bay2rack |'))?.match(/opening=([\d.]+)mm/)?.[1]);
  // the note on the thin wall of the rack inserts belongs to the Screws step, not to every build's list
  const insert = echoes.find((e) => /^NOTE: the rack inserts leave/.test(e));
  const notes = { insert: insert ? warnText(insert.slice(6)) : '' };
  if ((opening && Math.abs(opening - S.opening) > 0.01) || notes.insert !== S.notes.insert) {
    if (opening) S.opening = opening;
    S.notes = notes;
    renderSteps();
  }
  const warn = [...echoes.filter((e) => /^(WARNING|NOTE)/.test(e) && !/^NOTE: preview case/.test(e) && e !== insert), ...errors,
    ...(S.leftOut ? ['NOTE: ' + S.leftOut] : [])];
  $('#bom').replaceChildren(...bomGroups(bom));
  $('#warnings').replaceChildren(...(warn.length ? warn : [t('allGood')]).map((w) =>
    h('li', { className: /^(WARNING|ERROR)/.test(w) ? 'warn' : /^NOTE/.test(w) ? 'note' : 'good',
              textContent: warnText(w.replace(/^(WARNING|NOTE): ?/, '')) })));
  // something does not fit: say so on the viewer itself, the list is further down
  const bad = warn.filter((w) => /^(WARNING|ERROR)/.test(w));
  const badge = $('#warnBadge');
  badge.hidden = !bad.length;
  // the count changed: said to a screen reader too (the badge itself is not a live region)
  if (bad.length !== (S.badCount ?? 0)) announce(bad.length ? t(bad.length === 1 ? 'warnOne' : 'warnMany', { n: bad.length }) : t('allGood'));
  // one more thing does not fit than a moment ago: the badge shakes its head
  if (bad.length > (S.badCount ?? 0) && !CALM.matches && badge.animate)
    badge.animate([0, -4, 4, -3, 3, 0].map((x) => ({ transform: `translateX(${x}px)` })), { duration: 420 });
  S.badCount = bad.length;
  // (on a phone only the count, so the viewer's bar stays one row)
  badge.replaceChildren(`⚠ `, h('span', { className: 'badge-n', textContent: bad.length }),
    h('span', { className: 'badge-words', textContent: t(bad.length === 1 ? 'warnOne' : 'warnMany', { n: bad.length }) }));
  badge.setAttribute('aria-label', t(bad.length === 1 ? 'warnOne' : 'warnMany', { n: bad.length }));
  badge.dataset.tip = bad.map((w) => warnText(w.replace(/^(WARNING|ERROR): ?/, ''))).join('\n');
}

// the model's bill of materials sorted for a shopping trip: buy / print / tools / the devices you bring
export const HEX_KEY = {
  button: { M3: 2, M4: 2.5, M5: 3, M6: 4, '6-32': '5/64"', '10-32': '1/8"', '12-24': '5/32"' },
  countersunk: { M3: 2, M4: 2.5, M5: 3, M6: 4, '6-32': '5/64"', '10-32': '1/8"', '12-24': '5/32"' },
  socket: { M3: 2.5, M4: 3, M5: 4, M6: 5, '6-32': '7/64"', '10-32': '5/32"', '12-24': '5/32"' },
};
export function bomGroups(bom) {
  if (!bom.length) return [h('li', { textContent: t(S.values.part === 'assembly' ? 'nothing' : 'nothingPiece') })];
  const line = (b) => {
    const [what, ...rest] = bomText(b).split(': ');
    return h('li', {}, rest.length ? [h('b', { textContent: what }), ' ' + rest.join(': ')] : what);
  };
  const devices = bom.filter((b) => /^(devices|cables and power) /.test(b));
  const printed = bom.filter((b) => !devices.includes(b) && /^(rear slots:|keystones: \d+ x printed)/.test(b));
  const buy = bom.filter((b) => !devices.includes(b) && !printed.includes(b));
  // tools from what the screws and fixings are
  const all = buy.join('\n');
  const inserts = [...new Set([...all.matchAll(/x (M[\d.]+|#?\d+-\d+) heat-set insert/g)].map((m) => m[1]))];
  const keys = new Set();
  for (const m of all.matchAll(/x (M\d|\d+-\d+) x \S+ (button head|socket head|countersunk)/g)) {
    const k = HEX_KEY[m[2].split(' ')[0]]?.[m[1]];
    if (k) keys.add(typeof k === 'number' ? `${num(k)} mm` : k);
  }
  const tools = [
    inserts.length ? t('tool_iron', { s: inserts.join(', ') }) : null,
    keys.size ? t('tool_hex', { s: [...keys].join(', ') }) : null,
    /pan head/.test(all) ? t('tool_phillips') : null,
    /(hex|square) nut|screw \+ nut/.test(all) ? t('tool_spanner') : null,
    /cable tie/.test(all) ? t('tool_cutters') : null,
  ].filter(Boolean);
  // what the kit prints, when the whole build is on screen (it includes the printed covers and brackets of the list)
  const pieces = S.values.part === 'assembly' ? kitList(S.values, false).map((f) => pieceLabel(f, S.values)) : [];
  const group = (key, items) => (items.length ? [h('li', { className: 'bom-group', textContent: t(key) }), ...items] : []);
  return [
    ...group('bom_buy', buy.map(line)),
    ...group('bom_print', pieces.length ? pieces.map((x) => h('li', { textContent: x })) : printed.map(line)),
    ...group('bom_tools', tools.map((x) => h('li', { textContent: x }))),
    ...group('bom_devices', devices.map(line)),
  ];
}

// what the 3D view shows, in words (for screen readers): the build, or the piece
export function describeView(v) {
  if (v.part !== 'assembly') {
    const f = kitList(v, true).find((x) => Object.entries(x.part).every(([k, val]) => v[k] === val));
    return f ? pieceLabel(f, v) : '';
  }
  const c = calc(v);
  const mods = usedMods(v, c.units).filter((m) => m !== 'blank').map(modLabel);
  return [t('spec_bays', { n: v.bays }), c.units ? t('spec_units', { n: c.units }) : null, ...mods,
    ...c.zones.map((z) => t('fill_' + z))].filter(Boolean).join(', ');
}
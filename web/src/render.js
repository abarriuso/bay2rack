// Rendering the current settings and showing the result: the 3D view, the bill of materials, the warnings.
import { t } from './i18n.js';
import { bomText, warnText } from './help.js';
import { renderLegend } from './legend.js';
import { UI, $, h, num, S } from './state.js';
import { calc, modLabel, usedMods } from './model.js';
import { viewer, engineStarted, runJob, cachedJob, definesFor, setStatus } from './engine.js';
import { renderSteps } from './steps.js';
import { pieceLabel } from './tabs.js';
import { kitList } from './kit.js';

// ---------------------------------------------------------------- render
export let timer = null;
export function schedule(ms = 450) {
  clearTimeout(timer);
  timer = setTimeout(render, ms);
}

export async function render() {
  if (S.engine !== 'ready' || S.kitBusy) { S.wantRender = true; return; }
  if (S.busy) { S.dirty = true; return; }
  S.busy = true; S.dirty = false; S.wantRender = false;
  const values = { ...S.values };
  const ext = values.part === 'assembly' ? '3mf' : 'stl';
  setStatus(t('rendering'), 'busy');
  const defs = definesFor(values);
  if (ext === '3mf') defs.push('web_scene=true');
  const res = await cachedJob(runJob, defs, 'out.' + ext);
  await engineStarted;                                  // (the 3D view loads alongside the engine)
  S.busy = false;
  try {
    showResult(res, ext, values);
  } catch (e) {
    console.error(e);
    setStatus(t('failed'), 'error');
  }
  if (S.dirty || S.wantRender) render();
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
  const focus = values.part === 'assembly' && !homelab ? { min: [-95, -40, -25], max: [95, 40, top] } : null;
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
  viewer?.load(res.data.buffer, ext, { keepView: key === S.lastKey, focus, scene: ext === '3mf' ? scene : null });
  viewer?.setLabel(`${t('aria_view')} ${describeView(values)}`);
  S.lastScene = ext === '3mf' && UI.cables ? scene : null;
  renderLegend($('#legend'), S.lastScene);
  $('#caseName').textContent = ext === '3mf' && scene.case ? (UI.sleeper ? t('sleeperName') : scene.case.name) : '';
  S.lastKey = key;
  if (S.result) URL.revokeObjectURL(S.result.url);
  S.result = { url: URL.createObjectURL(new Blob([res.data])), name: `bay2rack-${values.part}.${ext}` };
  $('#download').disabled = false;
  setStatus(t('rendered', { s: num(res.ms / 1000) }), 'ok');
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
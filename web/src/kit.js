// The kit: its pieces, their names, and the .zip download.
import { zipSync, strToU8 } from 'three/addons/libs/fflate.module.js';
import { same } from './customizer.js';
import { t, lang } from './i18n.js';
import { bomText } from './help.js';
import { SITE, TESTS, $, h, S } from './state.js';
import { calc, ksTypes, modKind, modItems, modFile, usedMods, zoneList, zoneBox, moduleBox, ksCapacity, patchSets, portLabels, patchOf, labelOf } from './model.js';
import { runJob, cachedJob, kitEngines, definesFor, setStatus } from './engine.js';
import { hashString } from './hash.js';
import { render } from './render.js';

// ---------------------------------------------------------------- kit download
// patch panels and labels with their own ports / text are numbered in the order they are in the rack (0 = not one)
// "Patch panel · 6 ports" -> "Patch panel 2 · 6 ports"; "Patch panel" -> "Patch panel 2"
export const numbered = (label, n) => (label.includes(' · ') ? label.replace(' · ', ` ${n} · `) : `${label} ${n}`);
// (counting the bare patch / label too, so the names follow the rack: Patch panel 1, Patch panel 2…; 0 when it is the only one)
export function ownIndex(m, v) {
  if (!['patch', 'label'].includes(modKind(m))) return 0;
  const all = [...new Set(usedMods(v, calc(v).units))].filter((x) => modKind(x) === modKind(m));
  return all.length > 1 ? all.indexOf(m) + 1 : 0;
}
export function kitList(v, withTests = $('#withTests').checked) {
  const c = calc(v);
  const files = [{ name: 'adapter.stl', qty: 1, part: { part: 'adapter' } }];
  // a letters piece only where there are letters: some text, port names that fit, a button panel
  const types = ksTypes(v);
  const portsLettered = (box, ty = types, names = undefined) => v.ks_labels && portLabels(v, ty, names).some(Boolean)
    && ksCapacity(box, v, ty) >= ty.length;
  const lettered = (fill, box) => (fill === 'label' && String(v.label_text).trim() !== '') || fill === 'buttons'
    || (fill === 'keystone' && portsLettered(box));
  const zl = zoneList(v, c);
  if (v.filler_mode === 'separate' && zl.length) {
    files.push({ name: 'filler.stl', qty: 1, part: { part: 'filler' } });
    if (v.labels_multicolour && lettered(zl[0][0], zoneBox(v, zl[0][1]))) files.push({ name: 'filler-labels.stl', qty: 1, part: { part: 'filler_labels' } });
    if (zl.length > 1) {
      files.push({ name: 'filler-2.stl', qty: 1, part: { part: 'filler_2' } });
      if (v.labels_multicolour && lettered(zl[1][0], zoneBox(v, zl[1][1]))) files.push({ name: 'filler-2-labels.stl', qty: 1, part: { part: 'filler_2_labels' } });
    }
  }
  const mods = usedMods(v, c.units);
  const fileOf = (m) => (m.includes(':') && ['patch', 'label'].includes(modKind(m)) ? `${modKind(m)}-${ownIndex(m, v) || 1}` : modFile(m));
  for (const m of new Set(mods)) {
    const qty = mods.filter((x) => x === m).length;
    const modLettered = modKind(m) === 'label' ? labelOf(m, v) !== '' : modKind(m) === 'patch'
      ? portsLettered(moduleBox(v), patchOf(m, v).types, patchOf(m, v).names) : lettered(m, moduleBox(v));
    files.push({ name: `module-${fileOf(m)}.stl`, qty, part: { part: 'rack_module', module_type: m } });
    if (v.labels_multicolour && (modLettered
        || (v.ks_labels && modKind(m) === 'nkvm' && (modItems(m)[0] === 'side' ? v.nkvm_cover : modItems(m)[0] === 'ks' || v.nkvm_keystones > 0))))
      files.push({ name: `module-${fileOf(m)}-labels.stl`, qty, part: { part: 'rack_module_labels', module_type: m } });
    if (modKind(m) === 'nkvm') {
      files.push({ name: `module-${modFile(m)}-lid.stl`, qty, part: { part: 'rack_module_lid', module_type: m } });
      if (v.nkvm_split && ['side', 'front'].includes(modItems(m)[0]))
        files.push({ name: `module-${modFile(m)}-${modItems(m)[0] === 'front' ? 'drawer' : v.nkvm_raised ? 'mountain' : 'pocket'}.stl`, qty,
          part: { part: 'rack_module_bay', module_type: m } });
    }
  }
  const btnSets = c.zones.filter((z) => z === 'buttons').length + mods.filter((m) => m === 'buttons').length;
  if (btnSets && v.btn_type === 'retro') {
    for (const cap of ['power', ...(v.btn_count >= 2 ? ['reset'] : []), ...(v.btn_turbo ? ['turbo'] : [])])
      files.push({ name: `button-${cap}.stl`, qty: btnSets, part: { part: 'button_cap', btn_cap: cap } });
    files.push({ name: 'button-carrier.stl', qty: btnSets, part: { part: 'button_carrier' } });
  }
  if (v.rear_slots) for (const k of ['lan', 'power'])
    files.push({ name: `pci-bracket-${k}.stl`, qty: 1, part: { part: 'pci_bracket', pci_kind: k } });
  // covers only for the patch panels whose ports fit (the model leaves the others out), each with its own ports
  const sets = patchSets(v, c).filter(([box, ty]) => ksCapacity(box, v, ty) >= ty.length);
  for (const [kind, file] of [['cover', 'blank'], ['pass', 'pass']]) {
    const q = sets.reduce((n, [, ty]) => n + ty.filter((x) => x === kind).length, 0);
    if (q) files.push({ name: `keystone-${file}.stl`, qty: q, part: { part: 'keystone_cover', cover_type: file } });
  }
  const keystones = c.zones.includes('keystone') || mods.some((m) => modKind(m) === 'patch')
    || mods.some((m) => modKind(m) === 'nkvm' && (modItems(m)[0] === 'ks' || v.nkvm_keystones > 0));
  if (withTests) for (const x of [...TESTS.filter((x) => x !== 'test_keystone' || keystones), ...(btnSets ? ['test_button'] : [])])
    files.push({ name: `tests/${x}.stl`, qty: 1, part: { part: x } });
  return files;
}

export async function downloadKit(testsOnly = false) {
  if (S.engine !== 'ready' || S.kitBusy) return;
  S.kitBusy = true;
  $('#kit').disabled = true;
  $('#kitBar').disabled = true;
  $('#kitTests').disabled = true;
  const v = { ...S.values };
  const listed = testsOnly ? kitList(v, true).filter((f) => f.name.startsWith('tests/')) : kitList(v);
  const files = [];
  const zip = {};
  try {
    // every engine takes the next piece until there are none left
    setStatus(t('kitStep', { i: 0, n: listed.length, name: listed[0]?.name ?? '' }), 'busy');
    const engines = [runJob, ...(await kitEngines())];
    const results = [];
    let next = 0;
    let finished = 0;
    await Promise.all(engines.map(async (run) => {
      while (next < listed.length) {
        const i = next++;
        results[i] = await cachedJob(run, definesFor({ ...v, ...listed[i].part }), 'out.stl');
        setStatus(t('kitStep', { i: ++finished, n: listed.length, name: listed[i].name }), 'busy');
      }
    }));
    for (const [i, f] of listed.entries()) {
      const res = results[i];
      // a letters piece with nothing in it (e.g. every port name blank) is left out, not a failure
      if (!res.ok && f.name.endsWith('-labels.stl') && res.logs.some((l) => /top level object is empty/i.test(l))) continue;
      files.push(f);
      if (!res.ok) { $('#log').textContent = res.logs.join('\n'); setStatus(t('kitFailed', { name: f.name }), 'error'); return; }
      zip['bay2rack/' + f.name] = res.data;
    }
    const bomRes = await cachedJob(runJob, definesFor({ ...v, part: 'assembly' }), 'out.echo');
    const echoText = [...bomRes.logs, ...(bomRes.data ? new TextDecoder().decode(bomRes.data).split(/\r?\n/) : [])];
    const bom = [...new Set(echoText.map((l) => l.match(/^ECHO: "BOM \| (.*)"$/)?.[1]).filter(Boolean))].map(bomText);
    const lines = [
      `${t('readme_title')} - ${new Date().toISOString().slice(0, 10)}`, '',
      t(testsOnly ? 'readme_tests' : 'readme_notes'), '',
      t('readme_printer'), '',
      t('readme_print'), ...files.filter((f) => f.name.startsWith('tests/')).map((f) => `  1. ${f.qty} x ${f.name}  (${t('readme_' + f.part.part)})`),
      ...files.filter((f) => !f.name.startsWith('tests/')).map((f) => `  2. ${f.qty} x ${f.name}`), '',
      t('readme_need'), ...bom.map((b) => `  - ${b}`), '',
      t('readme_guide'), `  https://github.com/abarriuso/bay2rack/blob/main/docs/BUILD${lang === 'es' ? '.es' : ''}.md`, '',
      t('readme_settings'), `  ${SITE}${hashString(v)}`, '',
      'https://github.com/abarriuso/bay2rack · CC BY-NC-SA 4.0', '',
    ];
    zip['bay2rack/README.txt'] = strToU8(lines.join('\n'));
    zip['bay2rack/settings.json'] = strToU8(JSON.stringify(Object.fromEntries(
      Object.entries(v).filter(([k, x]) => !same(x, S.defaults[k]))), null, 2));
    const blob = new Blob([zipSync(zip, { level: 6 })], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    h('a', { href: url, download: testsOnly ? 'bay2rack-tests.zip' : `bay2rack-kit-${v.bays}bay.zip` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    setStatus(t('kitDone', { n: files.length + 2 }), 'ok');
    $('#nextStep').hidden = false;
  } finally {
    S.kitBusy = false;
    $('#kit').disabled = false;
    $('#kitBar').disabled = false;
    $('#kitTests').disabled = false;
    if (S.wantRender) render();
  }
}
// The steps of the configurator, in order, and the ready-made and saved builds.
import { same } from './customizer.js';
import { t, lang } from './i18n.js';
import { ICONS } from './icons.js';
import { EXAMPLES } from './examples.js';
import { EXAMPLE_KEYS, SCREWS, FIXINGS, BAY_FIXINGS, UI, $, NARROW, h, svgEl, num, S } from './state.js';
import { calc, modKind, placeMods, sideWall, fixingFits, zoneList, zoneBox, moduleBox, fanMax } from './model.js';
import { update } from './edit.js';
import { tipOf, choice, chips, segmented, cards, toggle, step, foldStep, TOL_KEYS, rowTitle, sliderRow } from './widgets.js';
import { labelEditor, colourEditor, multicolourEditor, tolerancesEditor, contentsEditor, fillEditor, deviceEntries, devicesEditor, portsEditor, buttonsEditor, previewEditor } from './editors.js';
import { hashString } from './hash.js';
import { describeView } from './render.js';
import { kitList } from './kit.js';

// ---------------------------------------------------------------- simple mode
export function renderSteps() {
  S.leftOut = '';
  const v = S.values;
  const c = calc(v);
  const list = [];
  let n = 0;
  const add = (key, ...body) => list.push(step(++n, key, ...body));
  const fold = (key, summary, ...body) => list.push(foldStep(++n, key, summary, ...body));
  const group = (key) => list.push(h('h4', { className: 'step-group', textContent: t('grp_' + key) }));
  const placed = placeMods(v, c.units);
  const mods = placed.map((p) => p.m);

  // 0. what you want in the bays: a front with a fan or buttons, sockets, or a rack for devices
  group('start');
  add('intent', intentEditor(c));
  // 1. the case: how many bays, which front, how the rack units sit
  group('case');
  add('bays', segmented('bays', [1, 2, 3, 4, 5, 6], String), h('small', { className: 'hint', textContent: t('bays_hint') }));
  add('front', cards('front_style', [
    { value: 'plate', icon: ICONS.plate, label: t('opt_plate'), sub: t('opt_plate_sub') },
    { value: 'bezel', icon: ICONS.bezel, label: t('opt_bezel'), sub: t('opt_bezel_sub') },
  ], (x) => ({ filler_mode: x === 'bezel' ? 'integral' : 'separate' })),
    v.front_style === 'bezel' ? sliderRow('bezel_depth', t('bezel_depth_l')) : h('small', { className: 'hint', textContent: t('front_hint') }));
  add('fit', cards('fit', [
    { value: 'flush', icon: ICONS.flush, label: t('opt_flush'), sub: t(c.flushUnits ? 'inside_v' : 'inside_v0', { u: c.flushUnits, s: num(c.flushSpare) }) },
    { value: 'overhang', icon: ICONS.overhang, label: t('opt_overhang'), sub: `${v.bays}U · ${t('sticksOut')} ${num(c.over)}\u00a0mm` },
    { value: 'panel', icon: ICONS.panel, label: t('opt_panel'), sub: t('opt_panel_sub') },
  ], (x) => (x === 'panel' ? { rear_slots: false, ...(v.spare_fill === 'keystone' ? { spare_fill: 'vent' } : {}) } : {})));
  // 2. what goes in it: the rack units, the devices, the leftover strip and what fills it
  group('contents');
  // the PCI brackets go in the kit whatever is in front: the switch sits in the first step of this group
  const rear = toggle(t('rearSlots'), v.rear_slots, (on) => update({ rear_slots: on }));
  if (c.units > 0) add('contents', contentsEditor(placed), h('small', { className: 'hint', textContent: t('contents_hint') }), rear);
  const devs = deviceEntries(mods);
  if (devs.length) fold('devices', devs.map((e) => e.title).join(', '), devicesEditor(devs));
  if (c.hasSpare) add(c.units > 0 ? 'fill' : 'fill_panel', fillEditor(), c.units > 0 ? null : rear);
  const fills = c.zones;
  if (fills.includes('fan40') || mods.includes('fan40')) {
    // as many fans as the narrowest place with fans takes
    const max = Math.max(1, Math.min(...[...zoneList(v, c).filter(([f]) => f === 'fan40').map(([, hh]) => fanMax(zoneBox(v, hh))),
      ...(mods.includes('fan40') ? [fanMax(moduleBox(v))] : [])]));
    add('fans', rowTitle('fans_count'), h('div', { className: 'seg' }, [1, 2, 3].map((x) => choice('fan40_count', x, `${x} × 40\u00a0mm`,
      { cls: 'seg-btn', disabled: x > max, tip: x > max ? t('fansMax', { n: max }) : undefined }))),
      rowTitle('fans_thick'), segmented('fan40_t', [10, 20], (x) => `${x}\u00a0mm`));
  }
  // the strip's patch panel (and a bare patch module); a patch module with its own ports edits them in its row
  if (fills.includes('keystone') || mods.includes('patch')) add('ports', portsEditor(6));
  if (fills.includes('buttons') || mods.includes('buttons')) add('buttons', buttonsEditor());
  if (fills.includes('label') || mods.some((m) => modKind(m) === 'label')) add('label', labelEditor(fills.includes('label') || mods.includes('label')));
  if (fills.includes('vent') || mods.includes('vent'))
    add('vent', segmented('vent_style', ['slots', 'louvres', 'hex', 'dots'], (x) => t('vent_' + x)), sliderRow('vent_margin', t('vent_margin')));
  // 3. making it: screws, and the fits to tune after printing the test pieces
  group('make');
  // (a panel-only front cut into the frame has no rack screws)
  const rackScrews = c.units > 0 || (v.filler_mode === 'separate' && c.zones.length > 0);
  const noIron = v.rack_fixing !== 'heatset' && v.bay_fixing !== 'heatset';
  fold('screw', rackScrews ? `${v.rack_screw} · ${t('fix_' + v.rack_fixing)}` : `${v.bay_screw} · ${t('fixb_' + v.bay_fixing)}`,
    toggle(t('noIron'), noIron, (on) => update(on
      ? { rack_screw: fixingFits(v, 'square_nut', v.rack_screw) ? v.rack_screw : 'M5', rack_fixing: 'square_nut', bay_fixing: 'nut' }
      : { rack_screw: S.defaults.rack_screw, rack_fixing: 'heatset', bay_fixing: 'heatset' })),
    h('small', { className: 'hint', textContent: t(noIron ? 'noIronOn' : 'screwEasy') }),
    rackScrews ? [h('b', { className: 'row-head', textContent: t('screwRack') }),
      rowTitle('screwSize'), chips('rack_screw', SCREWS, String),
      rowTitle('screwFix'),
      h('div', { className: 'chips small' }, FIXINGS.map((f) => {
        const fits = fixingFits(v, f, v.rack_screw);
        return choice('rack_fixing', f, t('fix_' + f), { disabled: !fits,
          tip: fits ? tipOf('fixing:' + f) : t('fixNoWall', { s: v.rack_screw, w: num(Math.max(0, sideWall(v, f))),
            x: ['M5', 'M4', 'M3'].filter((sz) => fixingFits(v, f, sz)).slice(0, 2).join(lang === 'es' ? ' o ' : ' or ') }) });
      })),
      S.notes.insert && v.rack_fixing === 'heatset' ? h('small', { className: 'hint note' }, S.notes.insert + ' ',
        v.rack_screw === 'M6' ? h('button', { type: 'button', className: 'link', textContent: t('useM5'), onclick: () => update({ rack_screw: 'M5' }) }) : null) : null] : null,
    h('b', { className: 'row-head', textContent: t('screwBay') }),
    rowTitle('screwSize'), chips('bay_screw', ['M3', '6-32'], String),
    rowTitle('screwFix'),
    h('div', { className: 'chips small' }, BAY_FIXINGS.map((f) => choice('bay_fixing', f, t('fixb_' + f), { tip: tipOf('fixb:' + f) }))),
    h('small', { className: 'hint', textContent: t('screwBuy') }));
  const tolChanged = TOL_KEYS.filter((k) => k in S.defaults && !same(v[k], S.defaults[k])).length;
  fold('tol', tolChanged ? t('sum_changed', { n: tolChanged }) : t('sum_default'), tolerancesEditor(mods, fills));
  fold('multi', t(v.labels_multicolour ? 'sum_on' : 'sum_off'), multicolourEditor());
  group('view');
  fold('colour', t('fil_' + UI.filament), colourEditor());
  if (v.part === 'assembly') fold('preview', t('scene_' + v.scene), previewEditor());
  $('#steps').replaceChildren(...list);
  // the kit can be downloaded from the first step on: the bar at the foot of the steps says so
  const pieces = kitList(v).reduce((a, f) => a + f.qty, 0);
  $('#kitBar').textContent = t('kitBar', { n: pieces });
  $('#examplesList').replaceChildren(...examplesEditor());
}

// an example replaces every setting any example touches, the rest (view, screws...) stays
export function applyExample(k) {
  const reset = Object.fromEntries(EXAMPLE_KEYS.filter((x) => x in S.defaults).map((x) => [x, S.defaults[x]]));
  update({ ...reset, ...EXAMPLES[k], part: 'assembly' });
  // on a phone the examples sit above the configurator: bring it into view
  if (matchMedia(NARROW).matches) { $('#examples').open = false; $('.workbench').scrollIntoView({ behavior: 'smooth' }); }
}

// the first question: a front with a fan or buttons (no rack), sockets on the front, or a rack for devices. It keeps
// your bays and front, and sets the fit and what goes in for that
export function intentOf(v) {
  if (v.fit !== 'panel') return 'rack';
  return [v.spare_fill, ...(v.spare_pos === 'split' ? [v.spare_fill_2] : [])].includes('keystone') ? 'ports' : 'simple';
}

export function intentPatch(k, v = S.values) {
  const keep = { filler_mode: v.front_style === 'bezel' ? 'integral' : 'separate' };
  if (k === 'simple') return v.bays >= 3
    ? { fit: 'panel', filler_mode: 'integral', spare_pos: 'split', spare_split: 0.67, spare_fill: 'fan80', spare_fill_2: 'buttons', rear_slots: false }
    : { fit: 'panel', filler_mode: 'integral', spare_pos: 'top', spare_fill: v.bays >= 2 ? 'fan80' : 'vent', rear_slots: false };
  if (k === 'ports') return { fit: 'panel', filler_mode: 'integral', spare_pos: 'top', spare_fill: 'keystone', rear_slots: true };
  return { ...keep, fit: 'flush', spare_pos: 'top', spare_fill: 'keystone', rack_modules: S.defaults.rack_modules, rear_slots: true };
}

export function intentEditor() {
  const cur = intentOf(S.values);
  return [h('div', { className: 'cards' }, ['simple', 'ports', 'rack'].map((k) => h('button', {
    type: 'button', className: `card-btn${cur === k ? ' active' : ''}`, 'aria-pressed': String(cur === k),
    onclick: () => update(intentPatch(k)),
  }, svgEl(ICONS[k === 'simple' ? 'panel' : k === 'ports' ? 'plate' : 'flush']), h('strong', { textContent: t('intent_' + k) }),
  h('small', { textContent: t('intent_' + k + '_sub') })))),
  h('small', { className: 'hint' }, t('intent_hint') + ' ', h('a', { href: '#glossary', textContent: t('gloss_link') }))];
}

export const exampleActive = (k, v = S.values) => Object.entries(EXAMPLES[k]).every(([key, x]) => same(v[key], x));

export function examplesEditor() {
  return [h('div', { className: 'chips' }, Object.keys(EXAMPLES).map((k) => h('button', {
    type: 'button', className: `chip${exampleActive(k) ? ' active' : ''}`, dataset: { tip: t('ex_' + k + '_tip') },
    onclick: () => applyExample(k),
  }, t('ex_' + k)))), savedEditor()];
}

// your builds, kept in this browser: a name, the settings (as in a link) and when
export const loadSaved = () => { try { return JSON.parse(localStorage.getItem('saved') || '[]'); } catch { return []; } };

export const storeSaved = (list) => { try { localStorage.setItem('saved', JSON.stringify(list)); } catch { /* private mode */ } };

export function savedEditor() {
  const list = loadSaved();
  const here = hashString();
  const name = h('input', { type: 'text', className: 'text saved-name', maxLength: 40, placeholder: describeView({ ...S.values, part: 'assembly' }).slice(0, 40),
    'aria-label': t('savedName') });
  const save = () => {
    const entry = { name: name.value.trim() || name.placeholder, hash: here, at: new Date().toISOString().slice(0, 10) };
    storeSaved([entry, ...list.filter((x) => x.hash !== here)].slice(0, 30));
    $('#examplesList').replaceChildren(...examplesEditor());
  };
  return h('div', { className: 'saved' },
    h('small', { className: 'row-title', textContent: t('savedTitle') }),
    list.length ? h('div', { className: 'chips' }, list.map((x) => h('span', { className: `chip saved-chip${x.hash === here ? ' active' : ''}` },
      h('button', { type: 'button', className: 'link', textContent: x.name, dataset: { tip: x.at },
        onclick: () => { location.hash = x.hash; } }),
      h('button', { type: 'button', className: 'link saved-del', textContent: '×', 'aria-label': `${t('savedDelete')}: ${x.name}`,
        onclick: () => { storeSaved(list.filter((y) => y !== x)); $('#examplesList').replaceChildren(...examplesEditor()); } }))))
      : h('small', { className: 'hint', textContent: t('savedNone') }),
    h('div', { className: 'saved-new' }, name, h('button', { type: 'button', className: 'pill', textContent: t('savedSave'), onclick: save })));
}
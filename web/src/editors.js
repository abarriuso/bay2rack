// What each step shows: the rack contents, the leftover gap, the ports, the screws, the fits, the view.
import { same } from './customizer.js';
import { t } from './i18n.js';
import { stepHelp, paramHelp } from './help.js';
import { FILLS, MODULES, TRAYS, KVM_DIMS, DEVICE_DIMS, PORTS, FILAMENTS, UI, saveUI, filamentHexes, $, h, num, S } from './state.js';
import { calc, splitList, ksTypes, modKind, modItems, modU, modLabel, trayFits, zoneBox, moduleBox, ksCapacity, ksPlaces, patchSets, fanMax, portLabels, patchOf, patchSpec, labelOf, labelSpec } from './model.js';
import { viewer, setColour } from './engine.js';
import { update } from './edit.js';
import { tipOf, choice, segmented, cards, select, toggle, rowTitle, sliderRow, withTitle } from './widgets.js';
import { renderSteps } from './steps.js';
import { render } from './render.js';

// the engraved label: what it says, how big, where, and whether it goes into or out of the panel
// (the text here is the strip's; a label module says its own, written in its row)
export function labelEditor(withText = true) {
  const v = S.values;
  const text = h('input', { type: 'text', className: 'text label-text', value: v.label_text, maxLength: 40,
    placeholder: 'HOMELAB', onchange: () => update({ label_text: text.value }) });
  return [
    withText ? h('label', { className: 'param' }, h('span', { className: 'name', textContent: t('lab_text') }), text) : null,
    segmented('label_relief', ['engraved', 'raised'], (x) => t('relief_' + x)),
    segmented('label_align', ['left', 'center', 'right'], (x) => t('align_' + x)),
    sliderRow('label_size', t('lab_size')),
    sliderRow('label_dx', t('lab_dx')),
    sliderRow('label_dz', t('lab_dz')),
    sliderRow('label_depth', t('lab_depth')),
    toggle(t('lab_bold'), v.label_bold, (on) => update({ label_bold: on })),
  ];
}

// the colour of your filament: the presets and a picker for any other one
export function colourEditor() {
  const picker = h('input', { type: 'color', value: UI.custom, 'aria-label': t('fil_custom'),
    oninput: () => { setColour('custom', picker.value); label.classList.add('active'); },
    onchange: () => renderSteps() });
  const label = h('label', { className: `swatch custom${UI.filament === 'custom' ? ' active' : ''}`, title: t('fil_custom'),
    style: `--c:${UI.custom}` }, picker);
  const swatches = h('div', { className: 'swatches', dataset: { tip: t('filamentTip') } },
    Object.entries(FILAMENTS).map(([name, hex]) => h('button', {
      type: 'button', className: `swatch${UI.filament === name ? ' active' : ''}`, title: t('fil_' + name),
      style: `--c:#${hex[0].toString(16).padStart(6, '0')}`,
      onclick: () => { setColour(name); renderSteps(); },
    })), label);
  return swatches;
}

// multicolour: the letters print in a second filament, from their own STL files in the kit
export function multicolourEditor() {
  const multi = S.values.labels_multicolour;
  const lc = h('input', { type: 'color', value: UI.labelColour, 'aria-label': t('labelColour'),
    oninput: () => { UI.labelColour = lc.value; saveUI(); viewer?.setFilament(filamentHexes()); lcs.style.setProperty('--c', lc.value); } });
  const lcs = h('span', { className: 'swatch custom active', style: `--c:${UI.labelColour}` }, lc);
  return [toggle(t('multicolour'), multi, (on) => update({ labels_multicolour: on })),
    multi ? h('label', { className: 'param' }, h('span', { className: 'name', textContent: t('labelColour') }), lcs) : null,
    h('small', { className: 'hint', textContent: t(multi ? 'multicolourHint' : 'multicolourOff') })];
}

// heat-set insert holes of the hardware table (standards.scad), shown when the parameter is 0
export const INSERT_D = { M3: 4.2, M4: 5.6, M5: 6.4, M6: 8, '6-32': 4.4, '10-32': 6.4, '12-24': 7.1 };

// the fits that depend on your printer: print the test pieces first, then move these
export function tolerancesEditor(mods, fills) {
  const v = S.values;
  const keystones = fills.includes('keystone') || mods.some((m) => modKind(m) === 'patch' || modKind(m) === 'nkvm');
  const devices = mods.some((m) => m !== 'blank' && !FILLS.includes(modKind(m)) && modKind(m) !== 'patch');
  const covers = patchSets(v).some(([, types]) => types.some((x) => x === 'cover' || x === 'pass'));
  // [parameter, label, step, the test piece that checks it]
  const rows = [
    ['sleeve_clearance', 'tol_sleeve', 0.05, 'test_bay'],
    ['height_clearance', 'tol_height', 0.05, 'test_bay'],
    ...(v.front_style === 'bezel' ? [['bezel_clearance', 'tol_bezel', 0.05, 'test_bay']] : []),
    ...(keystones ? [['ks_fit', 'tol_ks', 0.05, 'test_keystone']] : []),
    ...(covers ? [['cover_clear', 'tol_cover', 0.05, 'test_keystone']] : []),
    ...(devices ? [['mount_clear', 'tol_mount', 0.1, null]] : []),
    ...(v.rack_fixing === 'heatset' ? [['rack_insert_d', 'tol_insert', 0.05, 'test_rack']] : []),
    ...(v.bay_fixing === 'heatset' ? [['bay_insert_d', 'tol_bay_insert', 0.05, 'test_bay']] : []),
    ...(mods.some((m) => modKind(m) === 'nkvm') ? [['nkvm_insert_d', 'tol_nkvm_insert', 0.05, 'first']] : []),
    ...((fills.includes('buttons') || mods.includes('buttons')) && v.btn_type === 'mx' ? [['mx_cut', 'tol_mx', 0.05, 'test_button']] : []),
  ];
  return h('div', { className: 'tol' },
    h('small', { className: 'hint', textContent: t('tol_hint') }),
    rows.map(([name, label, stepv, test]) => {
      const p = S.params[name];
      // an insert hole at 0 means "the table value": show that value, so lowering it works
      const shown = name.endsWith('_insert_d') && !v[name] ? INSERT_D[name === 'rack_insert_d' ? v.rack_screw : name === 'bay_insert_d' ? v.bay_screw : 'M3'] : v[name];
      const box = h('input', { type: 'number', className: 'num', step: stepv, min: p?.min, max: p?.max, value: shown,
        onchange: (e) => update({ [name]: Number(e.target.value) }) });
      return h('label', { className: 'param', dataset: { tip: paramHelp(p) || undefined } },
        h('span', { className: 'name' }, t(label), h('small', { className: 'tol-test',
          textContent: test === 'first' ? t('tol_first') : test ? t('tol_test', { x: t(test).toLowerCase() }) : t('tol_device') })), box);
    }));
}

export const openPorts = new Set();          // the rack units whose patch panel ports are open

export function contentsEditor(placed) {
  const mods = placed.map((p) => p.m);
  const units = placed.reduce((n, p) => n + p.u, 0);
  const set = (k, val) => { const m = [...mods]; m[k] = val; update({ rack_modules: m.join(',') }); };
  // modules of the list that are not in the rack any more (fewer bays, a 2U one at the bottom)
  const list = splitList(S.values.rack_modules);
  const left = list.filter((m, i) => m !== 'blank' && placed[i]?.m !== m);
  const firstNkvm = placed.findIndex((p) => modKind(p.m) === 'nkvm');
  const rows = placed.map((p, k) => {
    const kind = modKind(p.m);
    const u = p.u > 1 ? `U${p.top + 1}–${p.top + p.u}` : `U${p.top + 1}`;
    const row = h('label', { className: 'row', dataset: { tip: tipOf('mod:' + kind) } },
      h('span', { className: 'u', textContent: p.top === 0 ? `${u}\u00a0·\u00a0${t('top')}` : u }),
      // a 2U module is only offered where two units are left
      select(null, MODULES.map((x) => [x, modU(x) > units - p.top ? `${t('mod_' + x)} ${t('needs2U')}` : t('mod_' + x), modU(x) > units - p.top]),
        kind, (val) => set(k, TRAYS[val] ? `${val}:${TRAYS[val].def}`
          // a new patch panel / label starts as a copy of the strip's, then it is its own
          : val === 'patch' ? patchSpec(ksTypes(S.values), patchOf('patch').names) : val === 'label' ? labelSpec(S.values.label_text) : val)));
    if (kind === 'patch') {
      const own = patchOf(p.m);
      const names = own.names.filter(Boolean);
      const d = h('details', { className: 'tray tray-ports', open: openPorts.has(k) },
        h('summary', { textContent: `${t('nPorts', { n: own.types.length })}${names.length ? ' · ' + names.join(', ') : ''} · ${t('portsEdit')}` }),
        portsEditor(6, { ...own, set: (types, nm) => set(k, patchSpec(types, nm)) }));
      d.addEventListener('toggle', () => { if (d.open) openPorts.add(k); else openPorts.delete(k); });
      return [row, d];
    }
    if (kind === 'label') {
      const text = h('input', { type: 'text', className: 'text label-text', value: labelOf(p.m), maxLength: 40, placeholder: 'HOMELAB',
        'aria-label': `${t('lab_text')} · ${u}`, onchange: () => set(k, labelSpec(text.value)) });
      return [row, h('div', { className: 'tray' }, h('label', { className: 'param' }, h('span', { className: 'name', textContent: t('lab_text') }), text))];
    }
    // the NanoKVM bays share their settings: the first one shows them, the others say so
    return TRAYS[kind] ? [row, trayEditor(kind, modItems(p.m), (items) => set(k, `${kind}:${items.join('+')}`), kind === 'nkvm' && k !== firstNkvm)] : row;
  });
  S.leftOut = left.length ? t('modsLeftOut', { s: left.map(modLabel).join(', '), n: S.values.bays }) : '';
  return [h('div', { className: 'rows' }, rows), S.leftOut ? h('small', { className: 'hint warn', textContent: S.leftOut }) : null];
}

// the boxes of a KVM / Raspberry Pi tray, left to right, plus one empty slot to add another
export function trayEditor(kind, items, onChange, shared = false) {
  const T = TRAYS[kind];
  const slots = [];
  for (let i = 0; i < T.max && i <= items.length; i++) {
    // the empty slot reads "+ add"; in a filled one the same entry removes the box
    const opts = [...(i > 0 ? [['', t(items[i] ? 'box_remove' : 'box_none')]] : []), ...T.items.map((x) => [x, t('box_' + x)])];
    const sel = select(null, opts, items[i] ?? '', (val) => {
      const next = [...items];
      if (val) next[i] = val; else next.splice(i);
      onChange(next.filter(Boolean));
    });
    sel.setAttribute('aria-label', `${t('mod_' + kind)} · ${i + 1}`);
    slots.push(sel);
  }
  // the NanoKVM bay can also take one or two keystones on its plate
  if (kind === 'nkvm' && !shared) {
    // keystones beside it (none standing in front: its plugs take the width; ks always has its own)
    if (items[0] !== 'side')
      slots.push(withTitle(select(null, (items[0] === 'ks' ? [1, 2] : [0, 1, 2]).map((n) => [n, t('nkvm_ks' + n)]),
        String(Math.max(items[0] === 'ks' ? 1 : 0, S.values.nkvm_keystones)), (val) => update({ nkvm_keystones: Number(val) })), 'nkvmKeystones'));
    // standing in front: a frame or a long lid, and the plate printed apart (three pieces)
    // three pieces (plate apart) for the standing one and the drawer
    if (items[0] === 'front') slots.push(withTitle(select(null, [['0', t('nkvm_pieces2')], ['1', t('nkvm_pieces3')]], S.values.nkvm_split ? '1' : '0',
      (val) => update({ nkvm_split: val === '1' })), 'nkvmPieces'));
    if (items[0] === 'side') {
      // out of the case in a little mountain (plug in from outside), or in a pocket of the plate
      slots.push(withTitle(select(null, [['1', t('nkvm_raised1')], ['0', t('nkvm_raised0')]], S.values.nkvm_raised ? '1' : '0',
        (val) => update({ nkvm_raised: val === '1' })), 'nkvmShape'));
      if (!S.values.nkvm_raised) slots.push(withTitle(select(null, [['1', t('nkvm_cover1')], ['0', t('nkvm_cover0')]], S.values.nkvm_cover ? '1' : '0',
        (val) => update({ nkvm_cover: val === '1' })), 'nkvmSides'));
      slots.push(withTitle(select(null, [['0', t('nkvm_pieces2')], ['1', t('nkvm_pieces3')]], S.values.nkvm_split ? '1' : '0',
        (val) => update({ nkvm_split: val === '1' })), 'nkvmPieces'));
    }
  }
  const fits = trayFits(kind, items, S.values);
  // (the NanoKVM bay's choices each get a small title over them)
  const titled = kind === 'nkvm' ? slots.map((sel, i) => h('label', { className: 'slot-titled' },
    h('small', { textContent: t(sel.dataset.title || 'nkvmMode') }), sel)) : slots;
  // the NanoKVM bay: what this version is, and in how many pieces
  const hint = !fits ? t('trayNoFit') : kind !== 'nkvm' ? t('tray_' + kind)
    : !TRAYS.nkvm.items.includes(items[0]) ? t('tray_nkvm_unknown')
    : `${t('nkvm_how_' + items[0])} ${t(items[0] === 'ks' ? 'nkvm_parts_ks' : S.values.nkvm_split ? 'nkvm_parts3' : 'nkvm_parts2')}${shared ? ' ' + t('nkvmShared') : ''}`;
  return h('div', { className: 'tray' }, h('div', { className: 'tray-slots' }, titled),
    h('small', { className: `hint${fits ? '' : ' warn'}`, textContent: hint }));
}

// smallest zone height (mm) each fill needs; the model warns too, the editor just won't offer what can't fit
// the height a fill needs, as the model checks it (a separate filler loses 0.8 mm to its clearance)
export const FILL_MIN = { fan80: 82, fan40: 41 };

export function fillMin(f) {
  const v = S.values;
  const sep = v.filler_mode === 'separate' ? 0.8 : 0;
  if (f === 'buttons') return sep + (v.btn_type === 'retro' ? 30 : v.btn_type === 'metal' ? Number(v.btn_metal_d) + 12 : v.mx_cut + 13);
  if (f === 'keystone') {
    const metal = ksTypes(v).some((x) => x === 'rj45m' || ((x === 'cover' || x === 'pass') && v.ks_style === 'metal'));
    return sep + 2 + (metal ? v.ksm_cav_h + 2 * v.ks_fit + 2 * v.ksm_wall : v.ks_h + 2 * v.ks_fit + 7);
  }
  return sep + (FILL_MIN[f] ?? 6);
}

// The spare zone(s): where they go, how the height is shared, and what fills each one. A fill that does
// not fit at the current share but would fit at another one moves the share for you.
export function fillEditor() {
  const v = S.values;
  const c = calc(v);
  const split = v.spare_pos === 'split';
  const zone = (param, other, height, label, setShare) => h('div', { className: 'zone' },
    h('div', { className: 'zone-head' }, h('b', { textContent: label }), h('span', { className: 'zone-size', dataset: { zone: param }, textContent: `${num(height)} mm` })),
    h('div', { className: 'chips' }, FILLS.map((f) => {
      const need = fillMin(f);
      const share = split ? setShare(need, fillMin(v[other])) : null;
      // the width too: not one keystone across, or not one 40 mm fan
      const box = zoneBox(v, height);
      const wide = f === 'keystone' ? ksCapacity([box[0], 1e3], v) > 0 : f === 'fan40' ? fanMax([box[0], 1e3]) > 0 : true;
      const fits = wide && (height >= need - 0.01 || share != null);
      const misfit = v[param] === f && (height < need - 0.01 || !wide);
      // picking the fans: as many as fit side by side
      const fans = f === 'fan40' ? fanMax([box[0], 1e3]) : 3;
      return choice(param, f, [misfit ? '⚠ ' : '', t('fill_' + f)], {
        disabled: !fits, flag: misfit ? 'misfit' : '',
        tip: height >= need - 0.01 && wide ? tipOf('fill:' + f) : !wide ? t('fillTooNarrow', { w: num(box[0]) })
          : fits ? t('fillMoves', { n: num(need) }) : t('fillTooSmall', { n: num(need), h: num(height) }),
        extra: () => ({ ...(height < need - 0.01 && share != null ? { spare_split: share } : {}),
          ...(f === 'fan40' && v.fan40_count > fans ? { fan40_count: Math.max(1, fans) } : {}) }),
      });
    })));
  // splitting the strip: the fill you had keeps the height it needs (bottom zone), the new top zone gets the rest
  const canSplit = split || (fillMin(v.spare_fill) <= 0.8 * c.spare + 0.01 && c.spare * 0.2 >= fillMin('vent') - 0.01);
  const where = h('div', { className: 'seg' }, ['top', 'bottom', 'split'].map((x) => choice('spare_pos', x, t('pos_' + x), {
    cls: 'seg-btn', disabled: x === 'split' && !canSplit, tip: x === 'split' && !canSplit ? t('splitNoRoom', { f: t('fill_' + v.spare_fill) }) : undefined,
    extra: (val) => {
      if (val !== 'split' || split) return {};
      const sh = Math.min(0.8, Math.max(0.5, fillMin(v.spare_fill) / c.spare + 0.004));
      return { spare_split: Math.round(sh * 100) / 100, ...(c.spare * (1 - sh) < fillMin(v.spare_fill_2) - 0.01 ? { spare_fill_2: 'vent' } : {}) };
    },
  })));
  if (!split) return [where,
    zone('spare_fill', null, c.spare, t(v.spare_pos === 'top' ? 'fillTop' : 'fillBottom'), () => null)];
  // the bottom zone gets spare * split, the top one the rest; a share that gives `need` mm to one zone while
  // the other keeps `keep` mm, or null
  const shareFor = (bottom) => (need, keep) => {
    const sh = bottom ? need / c.spare + 0.004 : 1 - need / c.spare - 0.004;
    const other = bottom ? c.spare * (1 - sh) : c.spare * sh;
    return sh >= 0.2 && sh <= 0.8 && other >= keep - 0.01 ? Math.round(sh * 100) / 100 : null;
  };
  return [
    where,
    zone('spare_fill_2', 'spare_fill', c.spare * (1 - v.spare_split), t('fillTop'), shareFor(false)),
    h('div', { className: 'split' },
      h('input', { type: 'range', min: 0.2, max: 0.8, step: 0.01, value: v.spare_split, 'aria-label': t('fillShare'),
        // the zone heights follow the slider while you drag; the model updates when you let go
        oninput: (e) => {
          const sh = Number(e.target.value);
          for (const [z, x] of [['spare_fill', sh], ['spare_fill_2', 1 - sh]])
            $(`.zone-size[data-zone="${z}"]`).textContent = `${num(c.spare * x)} mm`;
        },
        onchange: (e) => update({ spare_split: Number(e.target.value) }) }),
      h('button', { type: 'button', className: 'pill', textContent: t('fillSwap'), dataset: { tip: t('fillSwapTip') },
        onclick: () => update({ spare_fill: v.spare_fill_2, spare_fill_2: v.spare_fill, spare_split: Math.round((1 - v.spare_split) * 100) / 100 }) })),
    zone('spare_fill', 'spare_fill_2', c.spare * v.spare_split, t('fillBottom'), shareFor(true)),
  ];
}

// the sizes you can edit for the devices in the rack: { name (null = MS105G), title, tip }
export function deviceEntries(mods) {
  const out = new Map();
  for (const m of mods) {
    const k = modKind(m);
    if (k === 'ms105g') out.set('ms', { name: null, title: t('mod_ms105g'), tip: 'mod:ms105g' });
    else if (k === 'kvm') for (const b of modItems(m)) if (KVM_DIMS[b]) out.set(KVM_DIMS[b], { name: KVM_DIMS[b], title: t('box_' + b), tip: 'mod:kvm' });
    else if (DEVICE_DIMS[k]) out.set(k, { name: DEVICE_DIMS[k][0], title: t(k === 'piblade' ? 'dev_bladePitch' : 'mod_' + k), tip: 'mod:' + k });
  }
  return [...out.values()].filter((e) => !e.name || S.params[e.name]);
}

// W x H x D of every device in the rack, editable
export function devicesEditor(entries) {
  const v = S.values;
  const field = (val, set, label) => h('label', { className: 'dim' }, h('small', { textContent: label }),
    h('input', { type: 'number', step: 'any', min: 1, className: 'num', value: val, onchange: (e) => set(Number(e.target.value)) }));
  // (update() keeps every size inside its parameter's range; the box then shows the kept value)
  const MS = ['ms_w', 'ms_h', 'ms_d'];
  const rows = entries.map(({ name, title, tip }) => {
    let inputs;
    if (!name) inputs = MS.map((k, i) => field(v[k], (x) => update({ [k]: x }), t('dim_' + i)));
    else if (S.params[name].type === 'vector')
      // the NanoKVM is given as length, height, width (it lies on its side)
      inputs = v[name].map((x, i) => field(x, (nx) => { const a = [...v[name]]; a[i] = nx; update({ [name]: a }); },
        t(name === 'nkvm_dims' ? ['dim_len', 'dim_1', 'dim_0'][i] : 'dim_' + i)));
    else inputs = [field(v[name], (x) => update({ [name]: x }), t(name === 'pi_blade_pitch' ? 'dim_pitch' : 'dim_2'))];
    const changed = !name ? MS.some((k) => v[k] !== S.defaults[k]) : !same(v[name], S.defaults[name]);
    return h('div', { className: 'dev-row', dataset: { tip: tipOf(tip) } },
      h('div', { className: 'dev-title' }, h('b', { textContent: title }),
        changed ? h('button', { type: 'button', className: 'link', textContent: t('resetDims'),
          onclick: () => update(!name ? Object.fromEntries(MS.map((k) => [k, S.defaults[k]])) : { [name]: S.defaults[name] }) }) : null),
      h('div', { className: 'dims' }, inputs));
  });
  return [h('div', { className: 'devs' }, rows), h('small', { className: 'hint', textContent: t('devHint', { n: num(S.values.mount_clear) }) })];
}

// own = a patch module's own ports { types, names, set(types, names) }; without it, the strip's
export function portsEditor(most, own = null) {
  const v = S.values;
  const types = own ? own.types : ksTypes(v);
  // as many as the smallest patch panel takes (all of them are left out when they do not fit)
  // (none at all: the strip is too small for a patch panel, the Leftover strip step says so)
  const cap = own ? ksCapacity(moduleBox(v), v, types) : Math.min(...ksPlaces(v).map((box) => ksCapacity(box, v)));
  const max = cap < 1 ? most : Math.min(most, cap);
  const setTypes = own ? (list) => own.set(list, own.names) : (list) => update({ ks_ports_list: list.join(','), ks_ports: list.length });
  return [
    h('div', { className: 'ports' },
      types.map((tp, i) => h('label', {
        className: `port port-${tp}`, dataset: { tip: tipOf('port:' + tp), tipTitle: `${i + 1} · ${t('port_' + tp)}` },
      }, h('b', { textContent: i + 1 }), h('span', { textContent: t('port_' + tp) }),
        // an invisible list over the port: tap it and pick the type
        h('select', { className: 'port-pick', 'aria-label': `${t('portType')} ${i + 1}`,
          onchange: (e) => { const list = [...types]; list[i] = e.target.value; setTypes(list); } },
          PORTS.map((x) => h('option', { value: x, textContent: t('port_' + x), selected: x === tp }))))),
      h('span', { className: 'port-ctl' },
        h('button', { type: 'button', className: `mini${types.length >= max ? ' off' : ''}`, textContent: '+', 'aria-disabled': String(types.length >= max),
          dataset: { tip: types.length >= max ? t('portMax', { n: max }) : t('portAdd') },
          onclick: () => { if (types.length < max) setTypes([...types, v.ks_style === 'metal' ? 'rj45m' : 'rj45']); } }),
        h('button', { type: 'button', className: 'mini', textContent: '−', disabled: types.length <= 1,
          dataset: { tip: t('portRemove') }, onclick: () => setTypes(types.slice(0, -1)) }))),
    cap >= 1 && types.length > cap ? h('small', { className: 'hint warn', textContent: t('portsTooMany', { n: types.length, m: cap }) })
      : h('small', { className: 'hint', textContent: t('portHint') }),
    // the RJ45 ports follow the type (metal cells or plastic cut-outs), so do the covers (one setting for all)
    own ? null : [rowTitle('ks_style_t'), h('div', { className: 'seg' }, ['metal', 'standard'].map((x) => choice('ks_style', x, t('ks_' + x), {
      cls: 'seg-btn',
      extra: () => (String(v.ks_ports_list).trim()
        ? { ks_ports_list: types.map((tp) => (tp === 'rj45m' || tp === 'rj45' ? (x === 'metal' ? 'rj45m' : 'rj45') : tp)).join(',') } : {}),
    }))),
    h('small', { className: 'hint', textContent: t('ks_hint') })],
    portNames(types, own),
  ];
}

// what is written over each port: your name, else HDMI / USB... for those jacks, else the number of its place
export function portNames(types, own = null) {
  const v = S.values;
  const names = own ? own.names : String(v.ks_names ?? '').split(',').map((x) => x.trim());
  const auto = portLabels(v, types, []);
  const set = (i, val) => {
    const list = types.map((_, j) => (j === i ? val.replace(/,/g, ' ').trim() : names[j] ?? ''));
    if (own) return own.set(types, list);
    while (list.length && !list[list.length - 1]) list.pop();
    update({ ks_names: list.join(',') });
  };
  return h('div', { className: 'port-names' },
    h('small', { className: 'hint', textContent: t('portNamesHint') }),
    h('div', { className: 'port-name-grid' }, types.map((tp, i) => h('input', {
      type: 'text', className: 'text port-name', maxLength: 12, value: names[i] ?? '', placeholder: auto[i],
      'aria-label': `${t('portName')} ${i + 1}`, onchange: (e) => set(i, e.target.value) }))));
}

export function buttonsEditor() {
  const v = S.values;
  return [
    cards('btn_type', ['mx', 'metal', 'retro'].map((x) => ({ value: x, label: t('btnType_' + x), sub: t('btnType_' + x + '_sub') }))),
    rowTitle('btn_count_t'), segmented('btn_count', [1, 2], (x) => t('btn_' + x)),
    v.btn_type === 'metal' ? [rowTitle('btn_metal_d_t'), segmented('btn_metal_d', [12, 16, 19, 22], (x) => `${x} mm`)] : null,
    v.btn_type === 'retro' ? [toggle(t('btnTurbo'), v.btn_turbo, (on) => update({ btn_turbo: on })),
      v.btn_turbo ? h('small', { className: 'hint', textContent: t('turboHint') }) : null] : null,
    v.btn_type === 'mx'
      ? [rowTitle('led_style_t'), cards('led_style', ['ring', 'halo', 'glow'].map((s) => ({ value: s, label: t('led_' + s), sub: t('led_' + s + '_sub'), tip: tipOf('led:' + s) })))]
      : null,
    rowTitle('led_d_t'), segmented('led_d', [3, 5], (x) => t('led_' + x)),
    h('small', { className: 'hint', textContent: t('btnWiring') }),
  ];
}

export function previewEditor() {
  const v = S.values;
  const caseOpts = [...S.params.case_model.options.map((o) => [o.value,
    o.value === 'auto' ? t('case_auto') : o.label.replace(/ - (\d+) bays$/, ` · $1 × ${num(5.25, 2)}"`)]), ['none', t('case_none')]];
  return [
    segmented('scene', ['homelab', 'single'], (x) => t('scene_' + x), stepHelp('scene')),
    select(null, caseOpts, v.case_view === 'none' ? 'none' : v.case_model,
      (val) => update(val === 'none' ? { case_view: 'none' } : { case_view: 'tower', case_model: val })),
    h('div', { className: 'toggles' },
      toggle(t('cables'), UI.cables, (on) => {
        UI.cables = on; saveUI(); viewer?.setVisible('cables', on);
        $('#legend').hidden = !on || !$('#legend').childElementCount;
      }),
      toggle(t('sidePanel'), UI.side, (on) => { UI.side = on; saveUI(); viewer?.setVisible('side', on); }),
      toggle(t('devices'), v.demo_devices === 'homelab', (on) => update({ demo_devices: on ? 'homelab' : 'generic' })),
      toggle(t('hardware'), v.show_hardware, (on) => update({ show_hardware: on })),
      toggle(t('sleeper'), UI.sleeper, (on) => { UI.sleeper = on; saveUI(); render(); }),
      toggle(t('explode'), v.explode > 0, (on) => update({ explode: on ? 25 : 0 }))),
  ];
}
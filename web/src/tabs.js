// What the 3D view shows (mounted or piece by piece), the "Every parameter" form and the pre-built files.
import { fromPreset, same } from './customizer.js';
import { t } from './i18n.js';
import { paramLabel, paramHelp, optionLabel } from './help.js';
import { BASE, VIEW_ONLY, $, h, num, S } from './state.js';
import { calc, modKind, modItems, DEVICE_MODS, modLabel } from './model.js';
import { update } from './edit.js';
import { tipOf } from './widgets.js';
import { schedule } from './render.js';
import { numbered, ownIndex, kitList } from './kit.js';

// ---------------------------------------------------------------- tabs (what to view / download)
// what only says which piece the piece view shows
export const PIECE_KEYS = ['module_type', 'cover_type', 'btn_cap', 'pci_kind'];
// one row per piece of the kit, with a name that says what it is
export function pieceLabel(f, v) {
  const p = f.part;
  const qty = f.qty > 1 ? ` × ${f.qty}` : '';
  if (p.part === 'adapter') {
    const c = calc(v);
    const w = v.front_style === 'bezel' ? 148 - v.bezel_clearance : 148;
    return `${t('piece_adapter')} · ${t('onBed', { w: num(w, 0), h: num(c.frameH, 0) })}`;
  }
  if (p.part === 'filler' || p.part === 'filler_2') {
    const z = calc(v).zones[p.part === 'filler' ? 0 : 1];
    return `${t(p.part === 'filler' ? 'piece_filler' : 'piece_filler2')} · ${t('fill_' + z)}`;
  }
  // a device's tray reads "Mount for…", so it is clear the device itself is not printed
  if (p.part === 'rack_module') return (DEVICE_MODS.includes(modKind(p.module_type)) ? t('piece_mount', { x: modLabel(p.module_type) })
    : modKind(p.module_type) === 'nkvm' && v.nkvm_split && ['side', 'front'].includes(modItems(p.module_type)[0])
      ? `${modLabel(p.module_type)} · ${t('piece_plate')}` : ownIndex(p.module_type, v)
        ? numbered(modLabel(p.module_type), ownIndex(p.module_type, v)) : modLabel(p.module_type)) + qty;
  if (p.part.endsWith('_labels')) return `${t('piece_labels')} · ${p.part === 'filler_labels' ? t('piece_filler')
    : p.part === 'filler_2_labels' ? t('piece_filler2') : ownIndex(p.module_type, v)
      ? numbered(modLabel(p.module_type), ownIndex(p.module_type, v)) : modLabel(p.module_type)}`;
  if (p.part === 'rack_module_lid') return `${modLabel(p.module_type)} · ${t('piece_lid')}${qty}`;
  if (p.part === 'rack_module_bay') return `${modLabel(p.module_type)} · ${t(modItems(p.module_type)[0] === 'front' ? 'piece_drawer'
    : v.nkvm_raised ? 'piece_mountain' : 'piece_pocket')}${qty}`;
  if (p.part === 'pci_bracket') return t('piece_pci_' + p.pci_kind);
  if (p.part === 'button_cap') return `${t('piece_button')} · ${t('cap_' + p.btn_cap)}${qty}`;
  if (p.part === 'button_carrier') return `${t('piece_carrier')}${qty}`;
  if (p.part === 'keystone_cover') return `${t('piece_cover')} · ${t('cover_' + p.cover_type)}${qty}`;
  if (p.part.startsWith('test_')) return `${t('piece_test')} · ${t(p.part)}`;
  return f.name;
}

export function renderTabs() {
  const v = S.values;
  const pieces = kitList(v, true);
  const isPiece = (f) => Object.entries(f.part).every(([k, x]) => v[k] === x);
  const current = pieces.findIndex(isPiece);
  const tab = (label, active, onclick, tip) => h('button', {
    type: 'button', className: `tab${active ? ' active' : ''}`, onclick, dataset: { tip }, role: 'tab', 'aria-selected': String(active),
  }, t(label));
  const mounted = v.part === 'assembly';
  if (!mounted && current < 0 && pieces.length) {
    Object.assign(v, Object.fromEntries(PIECE_KEYS.map((k) => [k, S.defaults[k]])), pieces[0].part);
    schedule();
    return renderTabs();
  }
  const tabs = [
    tab('view_assembly', mounted, () => update({ part: 'assembly', ...Object.fromEntries(PIECE_KEYS.map((k) => [k, S.defaults[k]])) }), tipOf('part:assembly')),
    tab('view_pieces', !mounted, () => update({ ...pieces[Math.max(0, current)].part }), tipOf('part:pieces')),
  ];
  let sub = null;
  if (!mounted) {
    const sel = h('select', { className: 'select piece-select', 'aria-label': t('view_pieces'),
      onchange: () => update({ ...pieces[Number(sel.value)].part }) },
      pieces.map((f, i) => h('option', { value: i, textContent: pieceLabel(f, v) })));
    sel.value = String(Math.max(0, current));
    sub = sel;
  }
  $('#tabs').replaceChildren(...tabs, ...(sub ? [h('span', { className: 'tab-sub' }, sub)] : []));
  $('#download').textContent = mounted ? t('downloadPreview') : `${t('downloadPart')} (.stl)`;
}

// ---------------------------------------------------------------- advanced mode (every parameter)
export function control(p) {
  const set = (val) => update({ [p.name]: val });
  let input;
  if (p.widget === 'select') {
    input = h('select', { className: 'select' }, p.options.map((o) => h('option', { value: o.value, textContent: optionLabel(p, o) })));
    input.onchange = () => set(p.type === 'number' ? Number(input.value) : input.value);
  } else if (p.widget === 'check') {
    input = h('input', { type: 'checkbox', onchange: () => set(input.checked) });
  } else if (p.widget === 'slider') {
    const range = h('input', { type: 'range', min: p.min, max: p.max, step: p.step ?? 1 });
    const box = h('input', { type: 'number', min: p.min, max: p.max, step: p.step ?? 1, className: 'num' });
    range.oninput = () => { box.value = range.value; };
    range.onchange = () => set(Number(range.value));
    box.onchange = () => set(Number(box.value));
    input = h('span', { className: 'slider' }, range, box);
    input.setValue = (x) => { range.value = x; box.value = x; };
  } else if (p.widget === 'vector') {
    const boxes = p.value.map((_, i) => h('input', { type: 'number', step: 'any', min: p.min, max: p.max, className: 'num',
      onchange: () => set(boxes.map((b) => Number(b.value))) }));
    input = h('span', { className: 'vec' }, boxes);
    input.setValue = (x) => boxes.forEach((b, i) => { b.value = x[i]; });
  } else if (p.widget === 'number') {
    input = h('input', { type: 'number', step: 'any', className: 'num' });
    input.onchange = () => set(Number(input.value));
  } else {
    input = h('input', { type: 'text', className: 'text' });
    input.onchange = () => set(input.value);
  }
  input.setValue ??= (x) => { if (p.widget === 'check') input.checked = x; else input.value = x; };
  p.input = input;
  return h('label', { className: 'param', dataset: { tip: paramHelp(p) || undefined, tipTitle: `${paramLabel(p)}  ·  ${p.name}` } },
    h('span', { className: 'name', textContent: paramLabel(p) }), input);
}

export function buildAdvanced() {
  $('#form').replaceChildren(...S.sections.map((s) => h('details', { className: 'sec' },
    h('summary', { textContent: t('sec:' + s.name) }), s.params.map(control))));
  syncAdvanced();
}
export function syncAdvanced() {
  for (const p of Object.values(S.params)) {
    p.input?.setValue(S.values[p.name]);
    p.input?.closest('.param')?.classList.toggle('modified', !same(S.values[p.name], S.defaults[p.name]));
  }
}

// ---------------------------------------------------------------- pre-built files
export function matchingVariant() {
  const v = S.values;
  return S.catalog?.variants.find((x) => {
    const want = { ...S.defaults };
    for (const [k, s] of Object.entries(S.presets[x.path] ?? {})) if (S.params[k]) want[k] = fromPreset(S.params[k], s);
    if (x.params.part && x.params.part !== v.part) return false;
    if (x.params.module_type && x.params.module_type !== v.module_type) return false;
    if (x.params.cover_type && x.params.cover_type !== v.cover_type) return false;
    return Object.keys(want).every((k) => VIEW_ONLY.has(k) || same(want[k], v[k]));
  });
}
export function showPrebuilt() {
  const v = matchingVariant();
  const box = $('#prebuilt');
  box.replaceChildren();
  if (!v?.files.length) return;
  box.append(h('div', { className: 'label', textContent: t('prebuilt') }),
    h('div', { className: 'chips' }, v.files.map((f) => h('a', { className: 'file', href: BASE + 'stl/' + f,
      download: 'bay2rack-' + f.replace(/\//g, '-'), textContent: f.split('/').pop() }))));
}
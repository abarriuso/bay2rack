// Small controls the steps are built from.
import { t } from './i18n.js';
import { stepHelp, optionHelp, paramHelp } from './help.js';
import { UI, saveUI, h, svgEl, S } from './state.js';
import { update } from './edit.js';

// ---------------------------------------------------------------- small widgets
export const tipOf = (key) => optionHelp(key) || undefined;

// a choice that is off stays tappable: the tap shows why (tooltip.js), it changes nothing
export function choice(param, value, content, { cls = 'chip', tip, extra, disabled = false, flag = '' } = {}) {
  const active = S.values[param] === value;
  const b = h('button', {
    type: 'button', className: `${cls}${active ? ' active' : ''}${flag ? ' ' + flag : ''}${disabled ? ' off' : ''}`,
    onclick: () => { if (!disabled) update({ [param]: value, ...(extra ? extra(value) : {}) }); },
    dataset: { tip }, 'aria-pressed': String(active),
  }, content, disabled && tip ? h('span', { className: 'sr-only', textContent: `: ${tip}` }) : null);
  if (disabled) b.setAttribute('aria-disabled', 'true');
  return b;
}
export const chips = (param, values, label, tipPrefix) =>
  h('div', { className: 'chips' }, values.map((v) => choice(param, v, label(v), { tip: tipPrefix ? tipOf(tipPrefix + v) : undefined })));
export const segmented = (param, values, label, tip) =>
  h('div', { className: 'seg', dataset: { tip } }, values.map((v) => choice(param, v, label(v), { cls: 'seg-btn' })));

export function cards(param, options, extra) {
  return h('div', { className: 'cards' }, options.map((o) => choice(param, o.value,
    [o.icon ? svgEl(o.icon) : null, h('strong', { textContent: o.label }), o.sub ? h('small', { textContent: o.sub }) : null],
    { cls: 'card-btn', extra, tip: o.tip })));
}

// options: [[value, label, disabled?]]; onPick(value) or update({param: value})
export function select(param, options, current, onPick) {
  const sel = h('select', { className: 'select', onchange: () => (onPick ? onPick(sel.value) : update({ [param]: sel.value })) },
    options.map(([v, l, off]) => h('option', { value: v, textContent: l, disabled: !!off })));
  sel.value = current ?? S.values[param];
  return sel;
}

export function toggle(label, on, set) {
  return h('label', { className: 'toggle' },
    h('input', { type: 'checkbox', checked: on, onchange: (e) => set(e.target.checked) }), h('span', { className: 'track' }),
    h('span', { textContent: label }));
}

export function step(n, key, ...body) {
  const help = stepHelp(key);
  return h('section', { className: 'step' },
    h('header', { dataset: { tip: help || undefined, tipTitle: t('step_' + key) } },
      h('span', { className: 'step-num', textContent: n }), h('h3', { textContent: t('step_' + key) }),
      help ? h('button', { type: 'button', className: 'info', 'aria-label': `${t('aria_info')}: ${t('step_' + key)}`, textContent: 'i' }) : null),
    h('div', { className: 'body' }, body));
}

// a step most people can leave as it is: closed, what it is set to on its title line, open when you want it
// (and it stays open across the re-renders, and the next visit)
export const openSteps = new Set(Array.isArray(UI.open) ? UI.open : []);
export function foldStep(n, key, summary, ...body) {
  const help = stepHelp(key);
  const d = h('details', { className: 'step fold', open: openSteps.has(key) },
    h('summary', { dataset: { tip: help || undefined, tipTitle: t('step_' + key) } },
      h('span', { className: 'step-num', textContent: n }), h('h3', { textContent: t('step_' + key) }),
      h('span', { className: 'fold-sum', textContent: summary })),
    h('div', { className: 'body' }, body));
  d.addEventListener('toggle', () => {
    if (d.open) openSteps.add(key); else openSteps.delete(key);
    UI.open = [...openSteps];
    saveUI();
  });
  return d;
}
// the fits you tune after the test prints (tolerancesEditor): how many are not as they come
export const TOL_KEYS = ['sleeve_clearance', 'height_clearance', 'bezel_clearance', 'ks_fit', 'cover_clear', 'mount_clear', 'rack_insert_d',
  'bay_insert_d', 'nkvm_insert_d', 'mx_cut'];

export const rowTitle = (key) => h('small', { className: 'row-title', textContent: t(key) });

// a slider + number box for one parameter, with its range from the .scad
export function sliderRow(name, label) {
  const p = S.params[name];
  const v = S.values[name];
  const box = h('input', { type: 'number', className: 'num', min: p.min, max: p.max, step: p.step ?? 1, value: v,
    onchange: () => update({ [name]: Number(box.value) }) });
  const range = h('input', { type: 'range', min: p.min, max: p.max, step: p.step ?? 1, value: v,
    oninput: () => { box.value = range.value; },
    onchange: () => update({ [name]: Number(range.value) }) });
  return h('label', { className: 'param', dataset: { tip: paramHelp(p) || undefined } },
    h('span', { className: 'name', textContent: label }), h('span', { className: 'slider' }, range, box));
}

export const withTitle = (sel, key) => { sel.dataset.title = key; return sel; };
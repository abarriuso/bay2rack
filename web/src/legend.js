// Colour key of the showcase network: which VLAN each cable colour is.
import { t } from './i18n.js';

const css = (c) => `rgb(${c.map((x) => Math.round(x * 255)).join(',')})`;

export function renderLegend(el, scene) {
  if (!el) return;
  const vlans = scene?.homelab?.vlans ?? [];
  const used = new Set((scene?.cables ?? []).map((c) => c.vlan));
  const rows = vlans.filter(([id]) => used.has(id)).map(([id, c]) => {
    const row = document.createElement('li');
    const dot = document.createElement('i');
    dot.style.background = css(c);
    row.append(dot, t('vlan_' + (id < 0 ? 'wan' : id)));
    return row;
  });
  el.replaceChildren(...rows);
  el.hidden = rows.length === 0;
}

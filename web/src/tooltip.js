// One floating tooltip for every element with data-tip (and optional data-tip-title).
// Mouse: shows after a short hover. Touch / keyboard: the (i) buttons toggle it, and so does a tap on a
// choice that is off (aria-disabled), which says why.
export function initTooltips(tip) {
  let timer = null;
  let current = null;
  let touch = false;

  const place = (el) => {
    const r = el.getBoundingClientRect();
    tip.style.left = '0px';
    tip.style.top = '0px';
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let left = r.right + 12;
    let top = r.top;
    if (left + tw > window.innerWidth - 8) {        // no room on the right: below (above on a touch screen, off the controls)
      left = Math.max(8, Math.min(r.left, window.innerWidth - tw - 8));
      top = touch && r.top - th - 8 >= 8 ? r.top - th - 8 : r.bottom + 8;
    }
    if (top + th > window.innerHeight - 8) top = Math.max(8, r.top - th - 8);
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  };

  const show = (el) => {
    const text = el.dataset.tip;
    if (!text) return;
    current = el;
    tip.replaceChildren();
    if (el.dataset.tipTitle) tip.append(Object.assign(document.createElement('strong'), { textContent: el.dataset.tipTitle }));
    tip.append(Object.assign(document.createElement('p'), { textContent: text }));
    tip.hidden = false;
    place(el);
  };

  const hide = () => {
    clearTimeout(timer);
    current = null;
    tip.hidden = true;
  };

  document.addEventListener('pointerdown', (e) => { touch = e.pointerType === 'touch'; }, true);
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const el = e.target.closest('[data-tip]');
    if (el === current) return;
    clearTimeout(timer);
    if (!el) { timer = setTimeout(hide, 120); return; }
    timer = setTimeout(() => show(el), current ? 0 : 350);
  });
  document.addEventListener('click', (e) => {
    const off = e.target.closest('[aria-disabled="true"][data-tip]');
    if (off) {
      e.preventDefault();
      e.stopPropagation();
      if (current === off && !tip.hidden) hide(); else show(off);
      return;
    }
    const btn = e.target.closest('.info');
    if (!btn) { if (!e.target.closest('[data-tip]')) hide(); return; }
    e.preventDefault();
    e.stopPropagation();
    const el = btn.closest('[data-tip]');
    if (current === el && !tip.hidden) hide(); else show(el);
  }, true);
  document.addEventListener('scroll', hide, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
}

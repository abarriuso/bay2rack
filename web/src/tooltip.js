// One floating tooltip for every element with data-tip (and optional data-tip-title).
// Mouse: shows after a short hover, and stays while the pointer is on it. Touch / keyboard: the (i) buttons toggle
// it, and so does a tap on a choice that is off (aria-disabled), which says why. What it shows is tied to the element
// (aria-describedby), so a screen reader reads it too.
export function initTooltips(tip) {
  let timer = null;
  let current = null;
  let touch = false;
  let described = [];
  const describe = (els) => {
    for (const x of described) { x.removeAttribute('aria-describedby'); if (x.matches('.info')) x.setAttribute('aria-expanded', 'false'); }
    described = els;
    for (const x of els) { x.setAttribute('aria-describedby', tip.id); if (x.matches('.info')) x.setAttribute('aria-expanded', 'true'); }
  };

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
    const focused = document.activeElement;
    describe([...new Set([el, ...el.querySelectorAll('.info'), ...(focused && el.contains(focused) ? [focused] : [])])]);
  };

  const hide = () => {
    clearTimeout(timer);
    current = null;
    tip.hidden = true;
    describe([]);
  };

  document.addEventListener('pointerdown', (e) => { touch = e.pointerType === 'touch'; }, true);
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    if (e.target.closest?.('#' + tip.id)) { clearTimeout(timer); return; }   // on the tip itself: it stays
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
  // keyboard: the help of what has the focus (not on a click, that would cover what you just pressed)
  document.addEventListener('focusin', (e) => {
    const el = e.target.closest?.('[data-tip]');
    // (the (i) buttons and the choices that are off show it on Enter / Space, which would otherwise hide it again)
    if (el && e.target.matches(':focus-visible') && !e.target.matches('.info, [aria-disabled="true"]')) show(el);
  });
  document.addEventListener('focusout', () => { if (!touch) hide(); });
  document.addEventListener('scroll', hide, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
}

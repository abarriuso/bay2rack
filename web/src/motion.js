// The motion of the page itself: the theme opening in a circle from its key, the words of the other language coming
// in, and the big headings setting wide as they come into view. Each runs once, on its event: nothing is left running
// while the page is idle, nothing reads the layout while scrolling, and "reduce motion" (CALM) turns all of it off.
import './css/motion.css';
import { CALM } from './state.js';

const root = document.documentElement;
const CRISP = 'cubic-bezier(.7, 0, .2, 1)';          // the circle: a quick start, a hard stop
const SETTLE = 'cubic-bezier(.16, 1, .3, 1)';        // the headings: they open fast and settle

// ---------------------------------------------------------------- theme
// The new theme opens in a circle from the centre of the key (View Transitions: the old page is a still picture, the
// new one is live underneath, so the 3D view and the film draw their new frames in place, nothing goes blank).
// Without the API, with "reduce motion" or in a hidden tab: at once.
let themeRun = 0;
export function themeSwitch(apply, from) {
  if (CALM.matches || !document.startViewTransition || document.visibilityState !== 'visible' || !from) { apply(); return; }
  const r = from.getBoundingClientRect();                 // (one read, on the click)
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const run = ++themeRun;
  root.classList.add('vt-theme');
  let vt;
  try { vt = document.startViewTransition(apply); } catch { root.classList.remove('vt-theme'); apply(); return; }
  vt.ready.then(() => root.animate(
    { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
    { duration: 450, easing: CRISP, pseudoElement: '::view-transition-new(root)' },
  )).catch(() => {});
  // (a second click mid-way starts its own: only the last one takes the class away)
  vt.finished.catch(() => {}).finally(() => { if (run === themeRun) root.classList.remove('vt-theme'); });
}

// ---------------------------------------------------------------- language
// The words of the other language come in out of a blur: one class on <html> for a moment, the rest is CSS
// (motion.css). Two classes in turn, so a quick second click starts the animation again without a style flush.
let langFlip = false, langOff = 0;
export function langSwap() {
  if (CALM.matches) return;
  langFlip = !langFlip;
  root.classList.remove('lang-a', 'lang-b');
  root.classList.add(langFlip ? 'lang-a' : 'lang-b');
  clearTimeout(langOff);
  langOff = setTimeout(() => root.classList.remove('lang-a', 'lang-b'), 360);
}

// ---------------------------------------------------------------- wide headings
// A heading comes in condensed and opens to its full width (the font's own width axis), its letters settling. While it
// opens, its lines are held where they will end (each line one unbreakable block): a narrower heading would otherwise
// take fewer lines and push what is under it, then change its breaks mid-way.
function holdLines(el) {
  if (el.childElementCount) return null;
  const text = el.textContent;
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return null;                      // one word (the name in the foot): nothing can move
  el.textContent = '';
  const spans = words.map((w, i) => {
    const s = document.createElement('span');
    s.textContent = w;
    el.append(s);
    if (i < words.length - 1) el.append(' ');
    return s;
  });
  const lines = [];
  let top = NaN;
  for (const s of spans) {                                // (one layout read, once per heading)
    if (s.getClientRects().length > 1) { el.textContent = text; return null; }   // a word broken across lines
    if (s.offsetTop !== top) { top = s.offsetTop; lines.push([]); }
    lines.at(-1).push(s.textContent);
  }
  el.textContent = '';
  for (const l of lines) {
    const s = document.createElement('span');
    s.className = 'held-line';
    s.textContent = l.join(' ');
    el.append(s);
  }
  // back to the plain text (unless the language changed it meanwhile)
  return () => { if (el.firstElementChild?.classList.contains('held-line')) el.textContent = text; };
}

// the display face is in (its Latin part: the headings' letters)
const faceIn = () => !document.fonts || document.fonts.check('850 1em "Archivo Variable"');

export function widen(el, { delay = 60, duration = 1000 } = {}) {
  if (CALM.matches || !el?.animate) return;
  // with the fallback font still in, the lines would be held at the wrong places: then it only comes up
  if (!faceIn()) return;
  const cs = getComputedStyle(el);
  const to = { fontStretch: cs.fontStretch, letterSpacing: cs.letterSpacing };
  const release = holdLines(el);
  const a = el.animate([{ fontStretch: '78%', letterSpacing: '0em' }, to], { duration, delay, easing: SETTLE, fill: 'backwards' });
  // the window changes size mid-way: straight to the end (the held lines are only right for this width)
  const cut = () => a.finish();
  addEventListener('resize', cut, { once: true });
  const done = () => { removeEventListener('resize', cut); release?.(); };
  a.finished.then(done, done);
}
// (the film's first heading opens as the page first paints: CSS, motion.css)

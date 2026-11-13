// The phone's own bars: the status and address bar above the page take the colour of what is under them, so the page
// seems to run to the very top of the screen. (Under the bar below - the gesture bar - the page itself runs, the
// viewport reaching the edge: viewport-fit=cover.)
// What is at the top edge is asked of the page (elementFromPoint) a few times a second while it scrolls, and once
// after: the film's picture (its top edge's colour, frame by frame, film.js - read ahead from edges.json), the 3D
// view (the top of its studio), else the background of the page there.
const meta = document.querySelector('meta[name="theme-color"]');
const root = document.documentElement;

// the film's colour at its top edge now (film.js): film(fresh) -> a colour, or null (fresh: the page's layout is
// fresh - it may be measured)
let film = null;
let onFilm = false;                                         // the film is under the top edge
export function barsFilm(get) { film = get; bars(); }
// the film's frame changed: its colour, at once, when it is the one up there
export function barsFrame() { if (onFilm) set(film?.(false)); }

let last = '';
function set(hex) {
  if (!meta || !hex || hex === last) return;
  last = hex;
  meta.content = hex;
}

const css = (name) => getComputedStyle(root).getPropertyValue(name).trim();
const rgb = (hex) => { const n = parseInt(hex.replace('#', '').slice(0, 6), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const hexOf = (c) => '#' + c.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
// The studio's top edge: its gradient (style.css, .viewer: an ellipse 110 % as tall as the view, from 72 % down) is
// some two thirds of the way out there.
export function studio() {
  const a = rgb(css('--studio-in') || '#fbfbf9'), b = rgb(css('--studio-out') || '#dcdddb');
  const k = 0.72 / 1.1;
  return hexOf(a.map((x, i) => x + (b[i] - x) * k));
}
// the first background along the way up from the element (a see-through one - the header's - counted as solid)
function groundOf(el) {
  for (let e = el; e && e !== root; e = e.parentElement) {
    // (rgb(r g b / a), or color(srgb r g b / a) - a colour mixed in CSS - with its parts from 0 to 1)
    const bg = getComputedStyle(e).backgroundColor, c = bg.match(/[\d.]+/g);
    if (c && (c.length < 4 || +c[3] > 0.5)) return hexOf(c.slice(0, 3).map((x) => (bg.startsWith('color(') ? x * 255 : +x)));
  }
  return css('--ground') || null;
}

function look() {
  const el = document.elementFromPoint(innerWidth / 2, 1);
  onFilm = false;
  if (!el) return set(css('--ground'));
  if (el.closest('.viewer')) return set(studio());
  if (el.closest('.film-stage') && film) {
    const hex = film(true);
    if (hex) { onFilm = true; return set(hex); }
  }
  set(groundOf(el));
}

// Asked right after a frame is drawn (the page's layout is fresh then: asking costs next to nothing), at most every
// 120 ms while it scrolls, and once more when it has stopped (the film glides on a moment, a part may have moved in).
let queued = false, trail = 0;
export function bars() {
  clearTimeout(trail);
  trail = setTimeout(soon, 450);
  if (!queued) { queued = true; setTimeout(soon, 120); }
}
function soon() { queued = false; requestAnimationFrame(() => setTimeout(look, 0)); }
addEventListener('scroll', bars, { passive: true });
addEventListener('resize', bars, { passive: true });

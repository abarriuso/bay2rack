// Small explanatory pictograms (side and front views), drawn with currentColor + the accent.
const svg = (body) => `<svg viewBox="0 0 64 44" aria-hidden="true">${body}</svg>`;
const bayLines = '<g stroke="currentColor" stroke-width="1.2" fill="none" opacity=".45"><path d="M6 6h52M6 38h52"/></g>';

const line = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  // side view: case front line, thin frame behind the panels
  plate: svg(`<path d="M30 4v36" stroke="currentColor" stroke-width="1.5" opacity=".5"/>
    <rect x="31" y="9" width="24" height="26" rx="1.5" fill="currentColor" opacity=".18"/>
    <rect x="27" y="7" width="4" height="30" rx="1" fill="var(--accent)"/>
    <rect x="23" y="8" width="3" height="28" rx="1" fill="currentColor" opacity=".65"/>`),
  // side view: thick bezel that fills the plastic front, flush with it
  bezel: svg(`<path d="M20 4v8M20 32v8" stroke="currentColor" stroke-width="5" opacity=".35"/>
    <rect x="31" y="9" width="24" height="26" rx="1.5" fill="currentColor" opacity=".18"/>
    <rect x="18" y="12" width="13" height="20" rx="1.5" fill="var(--accent)"/>
    <rect x="15" y="13" width="3" height="18" rx="1" fill="currentColor" opacity=".65"/>`),
  // front view: panels inside the bay lines + a spare strip
  flush: svg(`${bayLines}<rect x="14" y="8" width="36" height="8" rx="1.5" fill="var(--accent-2)"/>
    <rect x="14" y="18" width="36" height="8.5" rx="1.5" fill="var(--accent)"/>
    <rect x="14" y="28" width="36" height="8.5" rx="1.5" fill="var(--accent)"/>`),
  // front view: taller panels that cross the bay lines
  overhang: svg(`${bayLines}<rect x="14" y="3" width="36" height="12" rx="1.5" fill="var(--accent)"/>
    <rect x="14" y="16" width="36" height="12" rx="1.5" fill="var(--accent)"/>
    <rect x="14" y="29" width="36" height="12" rx="1.5" fill="var(--accent)"/>`),
  // front view: one panel filling the bays, no rack units
  panel: svg(`${bayLines}<rect x="14" y="8" width="36" height="28" rx="2" fill="var(--accent-2)"/>
    <circle cx="32" cy="22" r="9" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".7"/>`),
  // use-case pictograms (24 x 24 line icons)
  use_router: line('<rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 16.5h.01M11 16.5h.01M8 13V9M16 13V9"/><path d="M5.5 7.5a9 9 0 0 1 13 0M8.5 10a5 5 0 0 1 7 0" opacity=".6"/>'),
  use_kvm: line('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/><path d="M8 10l2.5 2.5L16 7" opacity=".7"/>'),
  use_pi: line('<rect x="4" y="3" width="4" height="18" rx="1"/><rect x="10" y="3" width="4" height="18" rx="1"/><rect x="16" y="3" width="4" height="18" rx="1"/><path d="M6 7h.01M12 7h.01M18 7h.01"/>'),
  use_audio: line('<circle cx="7" cy="17" r="3"/><circle cx="17" cy="15" r="3"/><path d="M10 17V5l10-2v12"/>'),
  use_clients: line('<rect x="6" y="2.5" width="12" height="19" rx="2"/><circle cx="12" cy="14" r="3.5"/><path d="M9 6.5h6"/>'),
  use_fit: line('<path d="M4 6h16M4 12h16M4 18h16" opacity=".5"/><rect x="7" y="4" width="10" height="16" rx="1.5"/><path d="M7 9h2M7 15h2M15 9h2M15 15h2"/>'),
  github: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>',
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></g></svg>',
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill="currentColor"/></svg>',
  // a 2U faceplate between two rack rails
  logo: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="2" y="3" width="28" height="26" rx="3" fill="var(--ink)"/><g fill="var(--ground)"><rect x="4.5" y="6" width="2" height="2"/><rect x="4.5" y="15" width="2" height="2"/><rect x="4.5" y="24" width="2" height="2"/><rect x="25.5" y="6" width="2" height="2"/><rect x="25.5" y="15" width="2" height="2"/><rect x="25.5" y="24" width="2" height="2"/></g><rect x="9" y="7" width="14" height="7.5" rx="1" fill="var(--signal)"/><rect x="9" y="17.5" width="14" height="7.5" rx="1" fill="var(--ground)"/></svg>',
};

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
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></g></svg>',
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill="currentColor"/></svg>',
  logo: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="4" width="26" height="24" rx="5" fill="var(--accent)"/><rect x="7" y="9" width="18" height="5" rx="1.5" fill="#fff" opacity=".95"/><rect x="7" y="17" width="18" height="5" rx="1.5" fill="#fff" opacity=".7"/></svg>',
};

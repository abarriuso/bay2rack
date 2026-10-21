import { dict } from './strings.js';

const stored = (() => { try { return localStorage.getItem('lang'); } catch { return null; } })();
export let lang = (stored || navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';

export function t(key, vars = {}) {
  const s = dict[lang][key] ?? dict.en[key] ?? key.replace(/^\w+:/, '');
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

export function setLang(l) {
  lang = l;
  try { localStorage.setItem('lang', l); } catch { /* private mode */ }
  document.documentElement.lang = l;
  applyI18n();
}

export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-tip]').forEach((el) => { el.dataset.tip = t(el.dataset.i18nTip); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  root.querySelectorAll('[data-href-es]').forEach((el) => { el.href = lang === 'es' ? el.dataset.hrefEs : el.dataset.hrefEn; });
  if (root === document) {
    document.title = t('page_title');
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('page_desc'));
  }
}

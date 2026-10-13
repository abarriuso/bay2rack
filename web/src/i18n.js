const dict = {
  en: {
    subtitle: '5.25" drive bays → 6" mini rack',
    variant: 'Variant',
    custom: 'Custom',
    prebuilt: 'Pre-built files',
    parameters: 'Parameters',
    generate: 'Generate',
    auto: 'Update on change',
    download: 'Download',
    share: 'Copy link',
    copied: 'Link copied',
    resetView: 'Reset view',
    loading: 'Loading OpenSCAD (≈11 MB, first visit only)…',
    ready: 'OpenSCAD ready',
    rendering: 'Rendering…',
    rendered: 'Rendered in {s} s',
    failed: 'OpenSCAD failed - see the log',
    engineError: 'Could not load OpenSCAD: {e}',
    prebuiltShown: 'Pre-built STL of this variant. Generate to see the assembly with hardware.',
    bom: 'Bill of materials',
    warnings: 'Warnings',
    log: 'OpenSCAD log',
    summary: 'Summary',
    nothing: 'Nothing yet - press Generate.',
    footer: 'Runs entirely in your browser: OpenSCAD compiled to WebAssembly (GPL-3.0).',
    source: 'Source & STLs on GitHub',
    reset: 'Reset to the variant',
    'fam:plate-flush': 'Plate front · flush',
    'fam:plate-overhang': 'Plate front · overhang',
    'fam:bezel-flush': '5.25" bezel · flush',
    'fam:bezel-overhang': '5.25" bezel · overhang',
    'fam:panels': 'Rack panels',
    'fam:tests': 'Test prints',
  },
  es: {
    subtitle: 'Bahías de 5,25" → mini rack de 6"',
    variant: 'Variante',
    custom: 'Personalizada',
    prebuilt: 'Archivos ya generados',
    parameters: 'Parámetros',
    generate: 'Generar',
    auto: 'Actualizar al cambiar',
    download: 'Descargar',
    share: 'Copiar enlace',
    copied: 'Enlace copiado',
    resetView: 'Recentrar',
    loading: 'Cargando OpenSCAD (≈11 MB, solo la primera vez)…',
    ready: 'OpenSCAD listo',
    rendering: 'Generando…',
    rendered: 'Generado en {s} s',
    failed: 'OpenSCAD ha fallado - mira el registro',
    engineError: 'No se pudo cargar OpenSCAD: {e}',
    prebuiltShown: 'STL ya generado de esta variante. Pulsa Generar para ver el conjunto con tornillería.',
    bom: 'Lista de materiales',
    warnings: 'Avisos',
    log: 'Registro de OpenSCAD',
    summary: 'Resumen',
    nothing: 'Aún nada - pulsa Generar.',
    footer: 'Todo se ejecuta en tu navegador: OpenSCAD compilado a WebAssembly (GPL-3.0).',
    source: 'Código y STL en GitHub',
    reset: 'Volver a la variante',
    'fam:plate-flush': 'Frontal plano · flush',
    'fam:plate-overhang': 'Frontal plano · overhang',
    'fam:bezel-flush': 'Bisel 5,25" · flush',
    'fam:bezel-overhang': 'Bisel 5,25" · overhang',
    'fam:panels': 'Paneles de rack',
    'fam:tests': 'Piezas de prueba',
    'sec:Part to render': 'Pieza',
    'sec:Drive bays': 'Bahías',
    'sec:Front style': 'Frontal',
    'sec:Fit mode': 'Encaje',
    'sec:Rack standard': 'Estándar de rack',
    'sec:Rack hardware': 'Tornillería del rack',
    'sec:Bay hardware': 'Tornillería de bahía',
    'sec:Frame and sleeve': 'Marco y guía',
    'sec:Spare-zone filler': 'Relleno de la zona libre',
    'sec:Keystone patch': 'Patch panel keystone',
    'sec:Keystone - metal holder cell': 'Keystone metálico (celda)',
    'sec:Keystone - standard cut-out': 'Keystone estándar (hueco)',
    'sec:Standalone rack panel': 'Panel de rack suelto',
    'sec:Preview': 'Vista previa',
  },
};

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
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
}

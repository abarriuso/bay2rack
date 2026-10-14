// Reads the OpenSCAD Customizer annotations of a .scad file:
//   /* [Section] */          starts a section ("Hidden" ends the parameters)
//   // description          comment lines right above a parameter
//   name = value; // [a, b:Label]   dropdown      // [min:step:max]  slider

function parseValue(src) {
  if (/^".*"$/.test(src)) return { type: 'string', value: src.slice(1, -1) };
  if (/^\[[\d.,\s-]+\]$/.test(src)) return { type: 'vector', value: src.slice(1, -1).split(',').map(Number) };
  if (src === 'true' || src === 'false') return { type: 'bool', value: src === 'true' };
  const n = Number(src);
  return Number.isFinite(n) ? { type: 'number', value: n } : null;
}

export function parseCustomizer(source) {
  const sections = [];
  let cur = null;
  let desc = [];
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    let m;
    if ((m = line.match(/^\/\*\s*\[(.+?)\]\s*\*\/$/))) {
      if (m[1] === 'Hidden') break;
      cur = { name: m[1], params: [] };
      sections.push(cur);
      desc = [];
    } else if (!cur) {
      continue;
    } else if (line.startsWith('//')) {
      desc.push(line.replace(/^\/\/\s?/, ''));
    } else if ((m = line.match(/^([A-Za-z_]\w*)\s*=\s*(.+?);\s*(?:\/\/\s*\[(.*)\])?\s*$/))) {
      const v = parseValue(m[2]);
      if (v) cur.params.push(makeParam(m[1], v, m[3], desc.join(' ')));
      desc = [];
    } else {
      desc = [];
    }
  }
  return sections.filter((s) => s.params.length);
}

function makeParam(name, { type, value }, spec, desc) {
  const p = { name, type, value, desc, widget: type === 'bool' ? 'check' : type === 'string' ? 'text' : type === 'vector' ? 'vector' : 'number' };
  if (spec == null) return p;
  const s = spec.trim();
  if (type === 'number' && /^-?[\d.]+(:-?[\d.]+){1,2}$/.test(s)) {
    const n = s.split(':').map(Number);
    if (n.length === 2) [p.min, p.max] = n; else [p.min, p.step, p.max] = n;
    p.widget = 'slider';
  } else {
    p.options = s.split(',').map((o) => {
      const t = o.trim();
      const i = t.indexOf(':');
      return i < 0 ? { value: t, label: t } : { value: t.slice(0, i), label: t.slice(i + 1) };
    });
    p.widget = 'select';
  }
  return p;
}

// value -> OpenSCAD literal for -D
export function scadLiteral(p, v) {
  if (p.type === 'string') return '"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  if (p.type === 'bool') return v ? 'true' : 'false';
  if (p.type === 'vector') return '[' + v.join(',') + ']';
  return String(v);
}

// equality that also works for vectors
export const same = (a, b) => (Array.isArray(a) || Array.isArray(b)) ? JSON.stringify(a) === JSON.stringify(b) : a === b;

// Customizer preset values are strings: convert to the parameter's type
export function fromPreset(p, s) {
  if (p.type === 'bool') return s === true || s === 'true';
  if (p.type === 'vector') return Array.isArray(s) ? s.map(Number) : String(s).replace(/[[\]\s]/g, '').split(',').map(Number);
  if (p.type === 'number') return Number(s);
  return String(s);
}

export const humanize = (name) => name.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

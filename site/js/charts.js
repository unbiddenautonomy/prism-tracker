// Tiny charts drawn with SVG / CSS. Marks carry the color; text stays white/silver.
import { fmtNum } from './recipes.js';

const NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs) {
  const el = document.createElementNS(NS, tag);
  Object.keys(attrs).forEach((k) => el.setAttribute(k, String(attrs[k])));
  return el;
}

// Trend line with a soft wash underneath and a dot on the latest value.
// opts: { color, width, height, label }
export function sparkline(values, opts) {
  const o = opts || {};
  const w = o.width || 96;
  const hgt = o.height || 32;
  const pad = 4;
  const color = o.color || '#E2E8F0';
  const vals = values.length ? values : [0];
  const max = Math.max(1, ...vals);
  const step = vals.length > 1 ? (w - pad * 2) / (vals.length - 1) : 0;
  const pts = vals.map((v, i) => [pad + i * step, pad + (hgt - pad * 2) * (1 - v / max)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = line + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (hgt - pad) + ' L' + pts[0][0].toFixed(1) + ' ' + (hgt - pad) + ' Z';
  const svg = svgEl('svg', { class: 'spark', width: w, height: hgt, viewBox: '0 0 ' + w + ' ' + hgt, role: 'img' });
  svg.setAttribute('aria-label', o.label || vals.map(fmtNum).join(', '));
  const title = svgEl('title', {});
  title.textContent = o.label || vals.map(fmtNum).join(', ');
  svg.append(title);
  svg.append(svgEl('line', { x1: pad, x2: w - pad, y1: hgt - pad, y2: hgt - pad, style: 'stroke: var(--line-2)', 'stroke-width': 1 }));
  svg.append(svgEl('path', { d: area, fill: color, 'fill-opacity': 0.12 }));
  svg.append(svgEl('path', { d: line, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  const last = pts[pts.length - 1];
  svg.append(svgEl('circle', { cx: last[0], cy: last[1], r: 4, fill: color, style: 'stroke: var(--card)', 'stroke-width': 2 }));
  return svg;
}

// Single thin bar: value out of max.
export function bar(value, max, color) {
  const pct = max > 0 ? Math.max(value > 0 ? 3 : 0, Math.min(100, (value / max) * 100)) : 0;
  const wrap = document.createElement('div');
  wrap.className = 'bar';
  const fill = document.createElement('span');
  fill.style.width = pct + '%';
  fill.style.setProperty('--c', color);
  wrap.append(fill);
  return wrap;
}

// Used (solid) + wasted (striped) of one material, scaled to the biggest row.
export function usedWastedBar(used, wasted, max, color) {
  const wrap = document.createElement('div');
  wrap.className = 'bar-stack';
  wrap.style.setProperty('--c', color);
  const add = (v, cls) => {
    if (!(v > 0)) return;
    const s = document.createElement('span');
    s.className = cls;
    s.style.width = Math.max(2, (v / max) * 100) + '%';
    if (cls === 'solid') s.style.background = color;
    wrap.append(s);
  };
  add(used, 'solid');
  add(wasted, 'hatch');
  if (!wrap.children.length) {
    const s = document.createElement('span');
    s.style.width = '100%';
    s.style.background = 'var(--fill)';
    wrap.append(s);
  }
  return wrap;
}

// Recipe make-up: one segment per raw material, sized by its share of a batch.
// parts: [{ value, color, label }]
export function composition(parts) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const wrap = document.createElement('div');
  wrap.className = 'comp';
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', parts.map((p) => p.label + ' ' + Math.round((p.value / (total || 1)) * 100) + '%').join(', '));
  wrap.title = wrap.getAttribute('aria-label');
  parts.forEach((p) => {
    const s = document.createElement('span');
    s.style.flex = String(p.value / (total || 1));
    s.style.background = p.color;
    wrap.append(s);
  });
  return wrap;
}

// Recipe math, formatting and dates.
// Shared: the app imports this file, and tools/build_apps_script.py copies it
// into the Google Sheet script. Keep it plain JavaScript with no browser-only code.

export const WASTE_REASONS = [
  { key: 'spill', icon: '💧', en: 'Spill', hi: 'गिर गया' },
  { key: 'leak', icon: '🛢️', en: 'Leak', hi: 'लीक हुआ' },
  { key: 'contaminated', icon: '⚠️', en: 'Contaminated / dirty', hi: 'गंदा / मिलावट' },
  { key: 'expired', icon: '⏰', en: 'Expired / too old', hi: 'पुराना / एक्सपायर' },
  { key: 'failed', icon: '❌', en: 'Failed batch / QC', hi: 'बैच फेल / QC' },
  { key: 'cleaning', icon: '🧽', en: 'Cleaning / flushing', hi: 'सफ़ाई में गया' },
  { key: 'other', icon: '✏️', en: 'Other', hi: 'अन्य' },
];

export function reasonByKey(key) {
  return WASTE_REASONS.find((r) => r.key === key) || WASTE_REASONS[WASTE_REASONS.length - 1];
}

// The sheet stores the English label; turn it back into a key.
export function reasonKeyFromLabel(label) {
  const s = String(label || '').trim().toLowerCase();
  const found = WASTE_REASONS.find((r) => r.key === s || r.en.toLowerCase() === s);
  return found ? found.key : 'other';
}

export function round3(n) {
  return Math.round((Number(n) || 0) * 1000) / 1000;
}

// 123456.5 -> "1,23,456.5" (Indian grouping, up to 3 decimals)
export function fmtNum(n) {
  const v = round3(n);
  const neg = v < 0;
  const parts = String(Math.abs(v)).split('.');
  let int = parts[0];
  if (int.length > 3) {
    const last3 = int.slice(-3);
    const rest = int.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    int = rest + ',' + last3;
  }
  return (neg ? '-' : '') + int + (parts[1] ? '.' + parts[1] : '');
}

export function batchesLabel(n, lang) {
  const v = round3(n);
  if (lang === 'hi') return fmtNum(v) + ' बैच';
  return fmtNum(v) + (v === 1 ? ' batch' : ' batches');
}

export function findMaterial(config, code) {
  return ((config && config.materials) || []).find((m) => m.code === code) || null;
}

export function findProduct(config, name) {
  return ((config && config.products) || []).find((p) => p.name === name) || null;
}

// Raw material used for N batches of a product, in the order the materials are listed.
export function linesForBatches(product, batches, materials) {
  const recipe = (product && product.recipe) || {};
  const list = materials || [];
  const out = [];
  list.forEach((m) => {
    const per = Number(recipe[m.code]) || 0;
    if (per > 0) out.push({ material: m.code, qty: round3(per * batches), unit: m.unit || '' });
  });
  Object.keys(recipe).forEach((code) => {
    if (list.some((m) => m.code === code)) return;
    const per = Number(recipe[code]) || 0;
    if (per > 0) out.push({ material: code, qty: round3(per * batches), unit: '' });
  });
  return out;
}

export function lineText(lines) {
  return (lines || []).map((l) => (l.material + ' ' + fmtNum(l.qty) + ' ' + (l.unit || '')).trim()).join(', ');
}

// ---- Colors ----
// Used when a product / material has no color of its own in the config.
// Both orders were checked for color-blind separation on the dark background.
export const PRODUCT_COLORS = ['#0066FF', '#00F5A0', '#FF9F00', '#A855F7', '#22D3EE', '#FF4D8D', '#C6F432', '#FF6B4A'];
export const MATERIAL_COLORS = ['#FF6B4A', '#22D3EE', '#FF9F00', '#A855F7', '#FFD23F', '#FF4D8D', '#C6F432', '#3D8BFF', '#00F5A0'];
export const UNKNOWN_COLOR = '#64748B';

// Raw materials without their own color get a shade from their first letter:
// R = reds, Y = yellows, S = whites, P = purples (in order of appearance).
export const MATERIAL_FAMILIES = {
  R: ['#FF4D4D', '#C81D3A', '#FF8F87', '#8F1630'],
  Y: ['#FFF06A', '#FFC21A', '#D9A400', '#FFE7A3'],
  S: ['#FFFFFF', '#CBD5E1', '#8E9BAE', '#E8EEF6'],
  P: ['#A855F7', '#7C3AED', '#D8B4FE', '#C026D3'],
};

export function cleanColor(v) {
  const s = String(v == null ? '' : v).trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s) ? s.toUpperCase() : '';
}

export function productColor(config, name) {
  const p = findProduct(config, name);
  return p ? p.color : UNKNOWN_COLOR;
}

export function materialColor(config, code) {
  const m = findMaterial(config, code);
  return m ? m.color : UNKNOWN_COLOR;
}

// Cleans config from config.json or from the Google Sheet.
// Color order of choice: the item's own "color" -> its category's color -> the default palette.
export function normalizeConfig(raw) {
  const c = raw || {};
  const str = (v) => (v == null ? '' : String(v).trim());
  const categoryColors = {};
  Object.keys(c.categoryColors || {}).forEach((k) => {
    const col = cleanColor(c.categoryColors[k]);
    if (str(k) && col) categoryColors[str(k)] = col;
  });
  const familyCount = {};
  const autoMaterialColor = (code, i) => {
    const letter = code.charAt(0).toUpperCase();
    const family = MATERIAL_FAMILIES[letter];
    if (!family) return MATERIAL_COLORS[i % MATERIAL_COLORS.length];
    const n = familyCount[letter] || 0;
    familyCount[letter] = n + 1;
    return family[n % family.length];
  };
  const materials = (Array.isArray(c.materials) ? c.materials : [])
    .filter((m) => m && str(m.code))
    .map((m, i) => {
      const auto = autoMaterialColor(str(m.code), i); // counted for every material so shades don't repeat
      return {
        code: str(m.code),
        name: str(m.name) || str(m.code),
        name_hi: str(m.name_hi),
        unit: str(m.unit) || 'kg',
        color: cleanColor(m.color) || auto,
        containers: (Array.isArray(m.containers) ? m.containers : [])
          .map((k) => ({ name: str(k.name), name_hi: str(k.name_hi), size: Number(k.size) || 0 }))
          .filter((k) => k.name && k.size > 0),
      };
    });
  const products = (Array.isArray(c.products) ? c.products : [])
    .filter((p) => p && str(p.name))
    .map((p, i) => {
      const recipe = {};
      Object.keys(p.recipe || {}).forEach((code) => {
        const v = Number(p.recipe[code]);
        if (v > 0) recipe[str(code)] = v;
      });
      const category = str(p.category);
      return {
        name: str(p.name),
        name_hi: str(p.name_hi),
        batchNote: str(p.batchNote),
        batchNote_hi: str(p.batchNote_hi),
        category,
        color: cleanColor(p.color) || categoryColors[category] || PRODUCT_COLORS[i % PRODUCT_COLORS.length],
        recipe,
      };
    });
  const workers = (Array.isArray(c.workers) ? c.workers : []).map(str).filter(Boolean);
  return {
    appName: str(c.appName) || 'Prism',
    ownerPin: str(c.ownerPin) || '1234',
    categoryColors,
    materials,
    products,
    workers,
    warnings: Array.isArray(c.warnings) ? c.warnings.map(str) : [],
  };
}

// ---- Dates (always "YYYY-MM-DD" strings) ----

const MONTHS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  hi: ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'],
};
const DAYS = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  hi: ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'],
};

function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

export function localYmd(d) {
  const x = d || new Date();
  return x.getFullYear() + '-' + pad2(x.getMonth() + 1) + '-' + pad2(x.getDate());
}

export function localHm(d) {
  const x = d || new Date();
  return pad2(x.getHours()) + ':' + pad2(x.getMinutes());
}

export function addDays(ymd, n) {
  const p = ymd.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
}

export function prettyDate(ymd, lang) {
  const l = lang === 'hi' ? 'hi' : 'en';
  const p = ymd.split('-').map(Number);
  const wd = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
  return DAYS[l][wd] + ', ' + p[2] + ' ' + MONTHS[l][p[1] - 1] + ' ' + p[0];
}

export function shortDate(ymd, lang) {
  const l = lang === 'hi' ? 'hi' : 'en';
  const p = ymd.split('-').map(Number);
  return p[2] + ' ' + MONTHS[l][p[1] - 1];
}

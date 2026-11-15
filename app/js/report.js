// Builds the daily + month-to-date report.
// Shared: the app's Report screen and the Google Sheet's daily email use this same code
// (tools/build_apps_script.py copies it into google-sheet/Code.gs).
import { reasonByKey, round3, fmtNum, prettyDate, shortDate, lineText, batchesLabel, productColor, materialColor, addDays } from './recipes.js';

export const REPORT_TEXT = {
  en: {
    title: 'Daily report',
    fromSheet: 'All phones (from the Google Sheet)',
    fromPhone: 'This phone only (sheet not connected)',
    batchesToday: 'Batches today',
    wasteToday: 'Waste today',
    batchesMonth: 'Batches this month',
    today: 'Today',
    month: 'This month',
    production: 'Production',
    product: 'Product',
    batches: 'Batches',
    who: 'Who',
    rawMaterial: 'Raw material used',
    material: 'Material',
    inBatches: 'In batches',
    wasted: 'Wasted',
    total: 'Total',
    waste: 'Waste',
    time: 'Time',
    what: 'What',
    amount: 'Amount',
    reason: 'Reason',
    note: 'Note',
    nothing: 'Nothing recorded.',
    byReason: 'Waste by reason',
    entriesWord: 'entries',
    workers: 'By worker',
    worker: 'Worker',
    prodEntries: 'Production entries',
    wasteEntries: 'Waste entries',
    phones: 'Phones',
    phone: 'Phone',
    lastSent: 'Last sent',
    sentToday: 'sent today',
    notToday: 'NOT sent today',
    spoiled: 'spoiled batch',
    warnings: 'Problems in the Recipes sheet',
    openSheet: 'Open the Google Sheet',
    footer: 'Sent automatically by the Prism tracker.',
    stock: 'Raw material stock',
    stockEnd: 'end of {date}',
    stockIn: 'In',
    stockOut: 'Out',
    stockLeft: 'Left',
    stockAlert: 'Alert below',
    stockLow: 'LOW',
    stockNotTracked: 'not counted yet',
    stockNone: 'No stock has been added yet. Add it in the Prism Admin app (Stock).',
    stockOutNote: 'Out = used in batches + wasted + removed.',
    lowStock: 'Low stock',
    lowLine: '{left} left, alert below {alert}',
    lowAction: 'Add stock in the Prism Admin app when new material arrives.',
  },
  hi: {
    title: 'दैनिक रिपोर्ट',
    fromSheet: 'सभी फ़ोन (गूगल शीट से)',
    fromPhone: 'सिर्फ़ यह फ़ोन (शीट नहीं जुड़ी)',
    batchesToday: 'आज के बैच',
    wasteToday: 'आज की बर्बादी',
    batchesMonth: 'इस महीने के बैच',
    today: 'आज',
    month: 'इस महीने',
    production: 'उत्पादन',
    product: 'प्रोडक्ट',
    batches: 'बैच',
    who: 'किसने',
    rawMaterial: 'कच्चा माल लगा',
    material: 'माल',
    inBatches: 'बैच में',
    wasted: 'बर्बाद',
    total: 'कुल',
    waste: 'बर्बादी',
    time: 'समय',
    what: 'क्या',
    amount: 'मात्रा',
    reason: 'कारण',
    note: 'नोट',
    nothing: 'कुछ दर्ज नहीं हुआ।',
    byReason: 'कारण के हिसाब से बर्बादी',
    entriesWord: 'एंट्री',
    workers: 'वर्कर के हिसाब से',
    worker: 'वर्कर',
    prodEntries: 'उत्पादन एंट्री',
    wasteEntries: 'बर्बादी एंट्री',
    phones: 'फ़ोन',
    phone: 'फ़ोन',
    lastSent: 'आखिरी बार भेजा',
    sentToday: 'आज भेजा',
    notToday: 'आज नहीं भेजा',
    spoiled: 'खराब बैच',
    warnings: 'रेसिपी शीट में गलतियाँ',
    openSheet: 'गूगल शीट खोलें',
    footer: 'Prism ट्रैकर से अपने-आप भेजा गया।',
    stock: 'कच्चे माल का स्टॉक',
    stockEnd: '{date} के अंत में',
    stockIn: 'आया',
    stockOut: 'गया',
    stockLeft: 'बचा',
    stockAlert: 'चेतावनी इससे कम पर',
    stockLow: 'कम',
    stockNotTracked: 'अभी गिना नहीं',
    stockNone: 'अभी कोई स्टॉक नहीं जोड़ा गया। Prism Admin ऐप में (स्टॉक) जोड़ें।',
    stockOutNote: 'गया = बैच में लगा + बर्बाद + घटाया।',
    lowStock: 'स्टॉक कम है',
    lowLine: '{left} बचा, चेतावनी {alert} से कम पर',
    lowAction: 'नया माल आने पर Prism Admin ऐप में स्टॉक जोड़ें।',
  },
};

// opts: { entries, config, date: 'YYYY-MM-DD', phones: [{phone,lastSync,worker}], source: 'sheet'|'phone', sheetUrl }
export function buildReportModel(opts) {
  const config = opts.config || {};
  const date = opts.date;
  const monthKey = date.slice(0, 7);
  const live = (opts.entries || []).filter(
    (e) => e && e.status !== 'deleted' && /^\d{4}-\d{2}-\d{2}$/.test(String(e.date))
  );
  const dayList = live.filter((e) => e.date === date);
  const monthList = live.filter((e) => e.date.slice(0, 7) === monthKey && e.date <= date);
  const phones = (opts.phones || []).map((p) => ({
    phone: String(p.phone || ''),
    lastSync: String(p.lastSync || ''),
    worker: String(p.worker || ''),
    sentToday: String(p.lastSync || '').slice(0, 10) === date,
  }));
  // Day-by-day totals from the 1st of the month up to the report date (for the trend lines).
  const days = [];
  for (let d = monthKey + '-01'; d <= date; d = addDays(d, 1)) days.push(d);
  const series = { days, batches: days.map(() => 0), waste: days.map(() => 0) };
  monthList.forEach((e) => {
    const i = days.indexOf(e.date);
    if (i < 0) return;
    if (e.type === 'production') series.batches[i] = round3(series.batches[i] + (Number(e.batches) || 0));
    else if (e.type === 'waste') series.waste[i] += 1;
  });
  return {
    appName: config.appName || 'Prism',
    date,
    source: opts.source || 'phone',
    sheetUrl: opts.sheetUrl || '',
    today: summarizePeriod(dayList, config),
    month: summarizePeriod(monthList, config),
    series,
    phones,
    warnings: config.warnings || [],
    stock: Array.isArray(opts.stock) ? opts.stock : null,
  };
}

// ---- Raw material stock ----
// Stock left = added - removed - used in batches - wasted.
// A material is counted from its first "stock" entry onward, so batches made
// before anyone added stock don't push it below zero.

function entryKey(e) {
  return String(e.date) + ' ' + (String(e.time || '') || '00:00');
}

function stockRow(code, unit, color, lowStock) {
  return {
    code,
    unit: unit || '',
    color: color || '',
    lowStock: Number(lowStock) > 0 ? round3(lowStock) : 0,
    tracked: false,
    since: '',
    added: 0,
    removed: 0,
    used: 0,
    wasted: 0,
    left: 0,
    low: false,
    day: { added: 0, removed: 0, used: 0, wasted: 0 },
  };
}

function stockField(e) {
  if (e.type === 'stock') return e.move === 'out' ? 'removed' : 'added';
  if (e.type === 'production') return 'used';
  if (e.type === 'waste') return 'wasted';
  return '';
}

// Recomputes left / low after the totals change.
export function finishStockRow(r) {
  r.left = round3(r.added - r.removed - r.used - r.wasted);
  r.low = r.tracked && r.lowStock > 0 && r.left < r.lowStock;
  return r;
}

// entries: every entry ever (any phone). date: stock at the end of this day ('YYYY-MM-DD').
// Returns one row per raw material, in the order of the Materials list.
export function computeStock(entries, config, date) {
  const mats = (config && config.materials) || [];
  const live = (entries || []).filter(
    (e) => e && e.status !== 'deleted' && /^\d{4}-\d{2}-\d{2}$/.test(String(e.date)) && (!date || e.date <= date)
  );
  const start = {};
  live.forEach((e) => {
    if (e.type !== 'stock') return;
    const k = entryKey(e);
    (Array.isArray(e.lines) ? e.lines : []).forEach((l) => {
      if (l && l.material && (!(l.material in start) || k < start[l.material])) start[l.material] = k;
    });
  });
  const rows = {};
  const order = [];
  mats.forEach((m) => {
    rows[m.code] = stockRow(m.code, m.unit, m.color, m.lowStock);
    order.push(m.code);
  });
  live.forEach((e) => {
    const field = stockField(e);
    if (!field) return;
    const k = entryKey(e);
    (Array.isArray(e.lines) ? e.lines : []).forEach((l) => {
      if (!l || !l.material || !(l.material in start) || k < start[l.material]) return;
      let r = rows[l.material];
      if (!r) {
        r = rows[l.material] = stockRow(l.material, l.unit, materialColor(config, l.material), 0);
        order.push(l.material);
      }
      const q = Number(l.qty) || 0;
      r[field] = round3(r[field] + q);
      if (e.date === date) r.day[field] = round3(r.day[field] + q);
    });
  });
  return order.map((code) => {
    const r = rows[code];
    r.tracked = code in start;
    r.since = r.tracked ? start[code].slice(0, 10) : '';
    return finishStockRow(r);
  });
}

export function lowStockRows(stock) {
  return (stock || []).filter((r) => r.low);
}

// "12 kg"
function qtyUnit(v, unit) {
  return fmtNum(v) + (unit ? ' ' + unit : '');
}

export function lowLineText(r, L) {
  return L.lowLine.replace('{left}', qtyUnit(r.left, r.unit)).replace('{alert}', qtyUnit(r.lowStock, r.unit));
}

export function summarizePeriod(list, config) {
  const materials = (config && config.materials) || [];
  const prod = {};
  const mats = {};
  const reasons = {};
  const workers = {};
  const waste = [];
  let batches = 0;
  materials.forEach((m) => {
    mats[m.code] = { code: m.code, unit: m.unit || '', color: m.color || '', used: 0, wasted: 0, total: 0 };
  });
  const addLine = (l, field) => {
    if (!l || !l.material) return;
    const m = mats[l.material] ||
      (mats[l.material] = { code: l.material, unit: l.unit || '', color: materialColor(config, l.material), used: 0, wasted: 0, total: 0 });
    m[field] = round3(m[field] + (Number(l.qty) || 0));
    m.total = round3(m.used + m.wasted);
  };
  list = list.filter((e) => e.type === 'production' || e.type === 'waste');
  list.forEach((e) => {
    const w = e.worker || '?';
    const wk = workers[w] || (workers[w] = { worker: w, batches: 0, prodEntries: 0, wasteEntries: 0 });
    const lines = Array.isArray(e.lines) ? e.lines : [];
    if (e.type === 'production') {
      const b = Number(e.batches) || 0;
      batches = round3(batches + b);
      const p = prod[e.product] || (prod[e.product] = { product: e.product, color: productColor(config, e.product), batches: 0, byWorker: {} });
      p.batches = round3(p.batches + b);
      p.byWorker[w] = round3((p.byWorker[w] || 0) + b);
      wk.batches = round3(wk.batches + b);
      wk.prodEntries += 1;
      lines.forEach((l) => addLine(l, 'used'));
    } else if (e.type === 'waste') {
      wk.wasteEntries += 1;
      const r = e.reason || 'other';
      reasons[r] = (reasons[r] || 0) + 1;
      lines.forEach((l) => addLine(l, 'wasted'));
      waste.push({
        date: e.date,
        time: e.time || '',
        worker: w,
        phone: e.phone || '',
        product: e.material ? '' : e.product || '',
        batches: Number(e.batches) || 0,
        material: e.material || '',
        qty: Number(e.qty) || 0,
        unit: e.unit || '',
        entered: e.entered || '',
        reason: r,
        note: e.note || '',
        lines,
      });
    }
  });
  waste.sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
  return {
    entryCount: list.length,
    batches,
    wasteCount: waste.length,
    production: Object.keys(prod).map((k) => prod[k]).sort((a, b) => b.batches - a.batches),
    materials: Object.keys(mats).map((k) => mats[k]),
    waste,
    reasons: Object.keys(reasons).map((k) => ({ reason: k, count: reasons[k] })).sort((a, b) => b.count - a.count),
    workers: Object.keys(workers).map((k) => workers[k]).sort((a, b) => b.batches - a.batches),
  };
}

export function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const RS = {
  wrap: 'font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:15px;line-height:1.4;max-width:720px;margin:0 auto;',
  h1: 'font-size:22px;margin:0 0 2px;',
  sub: 'color:#4b5563;margin:0 0 14px;font-size:14px;',
  h2: 'font-size:17px;margin:22px 0 8px;padding:8px 12px;background:#1e293b;color:#ffffff;border-radius:6px;',
  h3: 'font-size:15px;margin:14px 0 6px;color:#1f2937;',
  table: 'border-collapse:collapse;width:100%;font-size:14px;',
  th: 'text-align:left;padding:6px 8px;background:#f1f5f9;border:1px solid #e2e8f0;',
  thR: 'text-align:right;padding:6px 8px;background:#f1f5f9;border:1px solid #e2e8f0;',
  td: 'padding:6px 8px;border:1px solid #e2e8f0;vertical-align:top;',
  tdR: 'padding:6px 8px;border:1px solid #e2e8f0;text-align:right;white-space:nowrap;vertical-align:top;',
  tdZero: 'padding:6px 8px;border:1px solid #e2e8f0;text-align:right;white-space:nowrap;color:#9ca3af;',
  muted: 'color:#6b7280;font-size:13px;',
  tile: 'padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;text-align:center;',
  tileNum: 'font-size:26px;font-weight:bold;display:block;',
  warn: 'padding:10px 12px;background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;margin:8px 0;',
};

function tableHtml(head, rows, rightCols) {
  const right = rightCols || [];
  let s = '<table style="' + RS.table + '"><tr>';
  head.forEach((hd, i) => {
    s += '<th style="' + (right.indexOf(i) >= 0 ? RS.thR : RS.th) + '">' + escapeHtml(hd) + '</th>';
  });
  s += '</tr>';
  rows.forEach((r) => {
    s += '<tr>';
    r.forEach((cell, i) => {
      const isZero = right.indexOf(i) >= 0 && (cell === '0' || cell === '–');
      const st = right.indexOf(i) >= 0 ? (isZero ? RS.tdZero : RS.tdR) : RS.td;
      s += '<td style="' + st + '">' + escapeHtml(cell) + '</td>';
    });
    s += '</tr>';
  });
  return s + '</table>';
}

function reasonText(key, lang) {
  const r = reasonByKey(key);
  return r.icon + ' ' + (lang === 'hi' ? r.hi : r.en);
}

function wasteWhat(w, L) {
  return w.material ? w.material : w.product + ' (' + L.spoiled + ')';
}

function wasteAmount(w, lang) {
  if (w.material) return fmtNum(w.qty) + ' ' + w.unit + (w.entered ? ' (' + w.entered + ')' : '');
  return batchesLabel(w.batches, lang) + ' = ' + lineText(w.lines);
}

function periodHtml(p, L, lang, isToday) {
  let s = '';
  s += '<h3 style="' + RS.h3 + '">' + escapeHtml(L.production) + '</h3>';
  if (p.production.length) {
    s += tableHtml(
      [L.product, L.batches, L.who],
      p.production.map((r) => [
        r.product,
        fmtNum(r.batches),
        Object.keys(r.byWorker).map((w) => w + ': ' + fmtNum(r.byWorker[w])).join(', '),
      ]),
      [1]
    );
  } else {
    s += '<p style="' + RS.muted + '">' + escapeHtml(L.nothing) + '</p>';
  }

  s += '<h3 style="' + RS.h3 + '">' + escapeHtml(L.rawMaterial) + '</h3>';
  s += tableHtml(
    [L.material, L.inBatches, L.wasted, L.total],
    p.materials.map((m) => {
      const u = m.unit ? ' ' + m.unit : '';
      const f = (v) => (v ? fmtNum(v) + u : '0');
      return [m.code, f(m.used), f(m.wasted), f(m.total)];
    }),
    [1, 2, 3]
  );

  s += '<h3 style="' + RS.h3 + '">' + escapeHtml(L.waste) + '</h3>';
  if (!p.waste.length) {
    s += '<p style="' + RS.muted + '">' + escapeHtml(L.nothing) + '</p>';
  } else if (isToday) {
    s += tableHtml(
      [L.time, L.what, L.amount, L.reason, L.who, L.note],
      p.waste.map((w) => [w.time, wasteWhat(w, L), wasteAmount(w, lang), reasonText(w.reason, lang), w.worker, w.note]),
      []
    );
  } else {
    s += tableHtml(
      [L.reason, L.entriesWord],
      p.reasons.map((r) => [reasonText(r.reason, lang), String(r.count)]),
      [1]
    );
  }

  if (!isToday && p.workers.length) {
    s += '<h3 style="' + RS.h3 + '">' + escapeHtml(L.workers) + '</h3>';
    s += tableHtml(
      [L.worker, L.batches, L.prodEntries, L.wasteEntries],
      p.workers.map((w) => [w.worker, fmtNum(w.batches), String(w.prodEntries), String(w.wasteEntries)]),
      [1, 2, 3]
    );
  }
  return s;
}

// Stock table with a bar per material. The bar is scaled to the biggest amount;
// the thin dark mark on it is the alert level.
export function stockHtml(stock, L) {
  const tracked = stock.filter((r) => r.tracked);
  if (!tracked.length) return '<p style="' + RS.muted + '">' + escapeHtml(L.stockNone) + '</p>';
  const max = Math.max(1, ...tracked.map((r) => Math.max(r.left, r.lowStock)));
  let s = '<table style="' + RS.table + '"><tr>';
  [[L.material, 0], [L.stockIn, 1], [L.stockOut, 1], [L.stockLeft, 1], ['', 0], [L.stockAlert, 1]].forEach((hd) => {
    s += '<th style="' + (hd[1] ? RS.thR : RS.th) + '">' + escapeHtml(hd[0]) + '</th>';
  });
  s += '</tr>';
  stock.forEach((r) => {
    const out = round3(r.day.used + r.day.wasted + r.day.removed);
    const cell = (v, st) => '<td style="' + st + '">' + escapeHtml(v) + '</td>';
    const lowSt = r.low ? 'background:#fef2f2;' : '';
    s += '<tr>';
    s += '<td style="' + RS.td + lowSt + '"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;border:1px solid #94a3b8;background:' +
      escapeHtml(r.color || '#64748b') + ';margin-right:6px;"></span><b>' + escapeHtml(r.code) + '</b>' +
      (r.low ? ' <span style="color:#b91c1c;font-weight:bold;">' + escapeHtml(L.stockLow) + '</span>' : '') + '</td>';
    if (!r.tracked) {
      s += '<td colspan="5" style="' + RS.td + 'color:#9ca3af;">' + escapeHtml(L.stockNotTracked) + '</td></tr>';
      return;
    }
    s += cell(r.day.added ? '+' + qtyUnit(r.day.added, r.unit) : '0', r.day.added ? RS.tdR : RS.tdZero);
    s += cell(out ? '−' + qtyUnit(out, r.unit) : '0', out ? RS.tdR : RS.tdZero);
    s += '<td style="' + RS.tdR + lowSt + (r.low ? 'color:#b91c1c;' : '') + '"><b>' + escapeHtml(qtyUnit(r.left, r.unit)) + '</b></td>';
    const pct = Math.max(0, Math.min(100, (Math.max(0, r.left) / max) * 100));
    const mark = r.lowStock ? Math.min(100, (r.lowStock / max) * 100) : -1;
    s += '<td style="' + RS.td + 'width:34%;"><div style="position:relative;height:12px;background:#eef2f7;border-radius:6px;">' +
      '<div style="width:' + pct.toFixed(1) + '%;height:12px;border-radius:6px;background:' + (r.low ? '#dc2626' : '#16a34a') + ';"></div>' +
      (mark >= 0 ? '<div style="position:absolute;top:-3px;left:' + mark.toFixed(1) + '%;width:2px;height:18px;background:#111827;"></div>' : '') +
      '</div></td>';
    s += cell(r.lowStock ? qtyUnit(r.lowStock, r.unit) : '–', r.lowStock ? RS.tdR : RS.tdZero);
    s += '</tr>';
  });
  s += '</table>';
  return s + '<p style="' + RS.muted + 'margin:4px 0 0;">' + escapeHtml(L.stockOutNote) + '</p>';
}

// The email sent the moment a raw material falls below its alert level.
export function renderLowStockHtml(rows, appName, sheetUrl) {
  const L = REPORT_TEXT.en;
  let s = '<div style="' + RS.wrap + '">';
  s += '<h1 style="' + RS.h1 + 'color:#b91c1c;">' + escapeHtml(appName + ' – ' + L.lowStock) + '</h1>';
  s += tableHtml(
    [L.material, L.stockLeft, L.stockAlert],
    rows.map((r) => [r.code, qtyUnit(r.left, r.unit), qtyUnit(r.lowStock, r.unit)]),
    [1, 2]
  );
  s += '<p>' + escapeHtml(L.lowAction) + '</p>';
  if (sheetUrl) s += '<p><a href="' + escapeHtml(sheetUrl) + '">' + escapeHtml(L.openSheet) + '</a></p>';
  return s + '<p style="' + RS.muted + '">' + escapeHtml(L.footer) + '</p></div>';
}

export function renderLowStockText(rows, appName) {
  const L = REPORT_TEXT.en;
  return [appName + ' – ' + L.lowStock, ''].concat(rows.map((r) => r.code + ': ' + lowLineText(r, L)), ['', L.lowAction]).join('\n');
}

export function renderReportHtml(model, lang) {
  const L = REPORT_TEXT[lang] || REPORT_TEXT.en;
  const day = Number(model.date.slice(8, 10));
  const monthRange = (day === 1 ? '' : '1–') + shortDate(model.date, lang);
  let s = '<div style="' + RS.wrap + '">';
  s += '<h1 style="' + RS.h1 + '">' + escapeHtml(model.appName + ' – ' + L.title) + '</h1>';
  s += '<p style="' + RS.sub + '">' + escapeHtml(prettyDate(model.date, lang)) + ' · ' +
    escapeHtml(model.source === 'sheet' ? L.fromSheet : L.fromPhone) + '</p>';

  (model.warnings || []).forEach((w) => {
    s += '<div style="' + RS.warn + '">⚠️ ' + escapeHtml(L.warnings) + ': ' + escapeHtml(w) + '</div>';
  });
  model.phones
    .filter((p) => !p.sentToday)
    .forEach((p) => {
      s += '<div style="' + RS.warn + '">⚠️ ' + escapeHtml(p.phone) + ': ' + escapeHtml(L.notToday) +
        (p.lastSync ? ' (' + escapeHtml(L.lastSent) + ' ' + escapeHtml(p.lastSync) + ')' : '') + '</div>';
    });

  s += '<table style="' + RS.table + 'border-collapse:separate;border-spacing:6px;"><tr>';
  [
    [fmtNum(model.today.batches), L.batchesToday],
    [String(model.today.wasteCount), L.wasteToday],
    [fmtNum(model.month.batches), L.batchesMonth],
  ].forEach((tile) => {
    s += '<td style="' + RS.tile + '"><span style="' + RS.tileNum + '">' + escapeHtml(tile[0]) + '</span>' +
      '<span style="' + RS.muted + '">' + escapeHtml(tile[1]) + '</span></td>';
  });
  s += '</tr></table>';

  lowStockRows(model.stock).forEach((r) => {
    s += '<div style="' + RS.warn + '">⚠️ <b>' + escapeHtml(L.lowStock) + ': ' + escapeHtml(r.code) + '</b> – ' + escapeHtml(lowLineText(r, L)) + '</div>';
  });

  s += '<h2 style="' + RS.h2 + '">' + escapeHtml(L.today + ' · ' + shortDate(model.date, lang)) + '</h2>';
  s += periodHtml(model.today, L, lang, true);
  if (model.stock) {
    s += '<h2 style="' + RS.h2 + '">' + escapeHtml(L.stock + ' · ' + L.stockEnd.replace('{date}', shortDate(model.date, lang))) + '</h2>';
    s += stockHtml(model.stock, L);
  }
  s += '<h2 style="' + RS.h2 + '">' + escapeHtml(L.month + ' · ' + monthRange) + '</h2>';
  s += periodHtml(model.month, L, lang, false);

  if (model.phones.length) {
    s += '<h3 style="' + RS.h3 + '">' + escapeHtml(L.phones) + '</h3>';
    s += tableHtml(
      [L.phone, L.lastSent, L.worker],
      model.phones.map((p) => [(p.sentToday ? '✅ ' : '⚠️ ') + p.phone, p.lastSync, p.worker]),
      []
    );
  }
  if (model.sheetUrl) {
    s += '<p style="margin-top:18px;"><a href="' + escapeHtml(model.sheetUrl) + '">' + escapeHtml(L.openSheet) + '</a></p>';
  }
  if (model.source === 'sheet') s += '<p style="' + RS.muted + '">' + escapeHtml(L.footer) + '</p>';
  return s + '</div>';
}

// Plain-text version (email fallback and the app's Share button).
export function renderReportText(model, lang) {
  const L = REPORT_TEXT[lang] || REPORT_TEXT.en;
  const out = [];
  out.push(model.appName + ' – ' + L.title + ' – ' + prettyDate(model.date, lang));
  out.push('');
  const period = (title, p, isToday) => {
    out.push('== ' + title + ' ==');
    out.push(L.production + ':');
    if (!p.production.length) out.push('  ' + L.nothing);
    p.production.forEach((r) => out.push('  ' + r.product + ': ' + batchesLabel(r.batches, lang)));
    out.push(L.rawMaterial + ' (' + L.inBatches + ' + ' + L.wasted + ' = ' + L.total + '):');
    p.materials
      .filter((m) => m.total)
      .forEach((m) => out.push('  ' + m.code + ': ' + fmtNum(m.used) + ' + ' + fmtNum(m.wasted) + ' = ' + fmtNum(m.total) + ' ' + m.unit));
    out.push(L.waste + ':');
    if (!p.waste.length) out.push('  ' + L.nothing);
    if (isToday) {
      p.waste.forEach((w) => out.push('  ' + w.time + ' ' + wasteWhat(w, L) + ' – ' + wasteAmount(w, lang) + ' – ' +
        reasonText(w.reason, lang) + ' – ' + w.worker + (w.note ? ' – ' + w.note : '')));
    } else {
      p.reasons.forEach((r) => out.push('  ' + reasonText(r.reason, lang) + ': ' + r.count));
    }
    out.push('');
  };
  lowStockRows(model.stock).forEach((r) => out.push('! ' + L.lowStock + ': ' + r.code + ' – ' + lowLineText(r, L)));
  if (lowStockRows(model.stock).length) out.push('');
  period(L.today, model.today, true);
  if (model.stock) {
    out.push('== ' + L.stock + ' (' + L.stockEnd.replace('{date}', shortDate(model.date, lang)) + ') ==');
    const tracked = model.stock.filter((r) => r.tracked);
    if (!tracked.length) out.push('  ' + L.stockNone);
    tracked.forEach((r) => out.push('  ' + r.code + ': ' + qtyUnit(r.left, r.unit) + (r.lowStock ? ' (' + L.stockAlert.toLowerCase() + ' ' + qtyUnit(r.lowStock, r.unit) + ')' : '') + (r.low ? ' ' + L.stockLow : '')));
    out.push('');
  }
  period(L.month, model.month, false);
  model.phones.filter((p) => !p.sentToday).forEach((p) => out.push('! ' + p.phone + ': ' + L.notToday));
  return out.join('\n');
}

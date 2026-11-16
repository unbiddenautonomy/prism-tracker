// Report screen: a dashboard built from the same numbers as the daily email.
import { h, dot } from '../ui.js';
import { t, getLang, nameOf } from '../i18n.js';
import { localYmd, addDays, prettyDate, shortDate, fmtNum, round3, materialColor, batchesLabel, findProduct, lineText, reasonByKey, normalizeConfig } from '../recipes.js';
import { buildReportModel, renderReportText, REPORT_TEXT, computeStock } from '../report.js';
import { icon, REASON_ICONS } from '../icons.js';
import { sparkline, bar, usedWastedBar, stockBar } from '../charts.js';
import { currentStock, lowStockBox } from './stock.js';
import * as store from '../store.js';
import * as nav from '../nav.js';
import * as sync from '../sync.js';

// App (not chemical) colors: neon on dark, a deeper shade on light so lines stay visible.
const isLight = () => document.documentElement.getAttribute('data-theme') === 'light';
const EMERALD = () => (isLight() ? '#059669' : '#00F5A0');
const AMBER = () => (isLight() ? '#D97706' : '#FF9F00');
const VIOLET = () => (isLight() ? '#7C3AED' : '#A855F7');

let day = null;
let lastModel = null;

export function openReport() {
  day = localYmd();
  nav.go('report');
}

// Stock without a fresh answer from the sheet: today's best guess on this phone.
function localStock(cfg) {
  if (day === localYmd()) {
    const cur = currentStock();
    if (cur) return cur.rows;
  }
  return store.sheetConnection().url ? null : computeStock(store.allEntries(), cfg, day);
}

function localModel(cfg) {
  return buildReportModel({ entries: store.allEntries(), config: cfg, date: day, phones: [], source: 'phone', stock: localStock(cfg) });
}

function stockPanel(stock, L, lang) {
  const tracked = stock.filter((r) => r.tracked);
  const head = h('div', { class: 'panel-title' }, L.stock, h('small', null, L.stockEnd.replace('{date}', shortDate(day, lang))));
  if (!tracked.length) return h('div', { class: 'panel glass' }, head, h('p', { class: 'hint' }, L.stockNone));
  const max = Math.max(1, ...tracked.map((r) => Math.max(r.left, r.lowStock)));
  const notYet = stock.filter((r) => !r.tracked).map((r) => r.code);
  return h('div', { class: 'panel glass' },
    head,
    tracked.map((r) => {
      const out = round3(r.day.used + r.day.wasted + r.day.removed);
      const moves = [r.day.added ? '+' + fmtNum(r.day.added) : '', out ? '−' + fmtNum(out) : ''].filter(Boolean).join(' ');
      return h('div', { class: 'rrow' + (r.low ? ' is-low' : ''), title: r.lowStock ? L.stockAlert + ' ' + fmtNum(r.lowStock) + ' ' + r.unit : '' },
        h('div', { class: 'rrow-name' }, dot(r.color), h('span', null, r.code), r.low ? h('b', { class: 'low-badge' }, L.stockLow) : null),
        h('div', { class: 'rrow-val num' }, fmtNum(r.left), h('small', null, ' ' + r.unit), moves ? h('small', null, ' · ' + moves) : null),
        stockBar(r.left, r.lowStock, max, r.color, r.low));
    }),
    notYet.length ? h('p', { class: 'hint' }, L.stockNotTracked + ': ' + notYet.join(', ')) : null);
}

function kpi(label, value, series, color) {
  return h('div', { class: 'kpi glass' },
    h('div', { class: 'kpi-label' }, label),
    h('div', { class: 'kpi-value num' }, value),
    series ? sparkline(series, { color, width: 92, height: 26, label: label }) : null);
}

function productPanel(p, cfg, L, lang) {
  if (!p.production.length) return h('div', { class: 'panel glass' }, h('div', { class: 'panel-title' }, L.production), h('p', { class: 'hint' }, L.nothing));
  const max = Math.max(...p.production.map((r) => r.batches));
  return h('div', { class: 'panel glass' },
    h('div', { class: 'panel-title' }, L.production, h('small', { class: 'num' }, batchesLabel(p.batches, lang))),
    p.production.map((r) => {
      const prod = findProduct(cfg, r.product);
      const who = Object.keys(r.byWorker).map((w) => w + ' ' + fmtNum(r.byWorker[w])).join(' · ');
      return h('div', { class: 'rrow', title: who },
        h('div', { class: 'rrow-name' }, dot(r.color), h('span', null, prod ? nameOf(prod) : r.product)),
        h('div', { class: 'rrow-val num' }, fmtNum(r.batches)),
        bar(r.batches, max, r.color));
    }));
}

function materialPanel(p, L) {
  const rows = p.materials.filter((m) => m.total > 0);
  const head = h('div', { class: 'panel-title' }, L.rawMaterial);
  if (!rows.length) return h('div', { class: 'panel glass' }, head, h('p', { class: 'hint' }, L.nothing));
  const max = Math.max(...rows.map((m) => m.total));
  return h('div', { class: 'panel glass' },
    head,
    h('div', { class: 'legend' }, h('span', null, h('i'), t('legendUsed')), h('span', null, h('i', { class: 'hatch' }), t('legendWasted'))),
    rows.map((m) =>
      h('div', { class: 'rrow', title: m.code + ': ' + fmtNum(m.used) + ' + ' + fmtNum(m.wasted) + ' ' + m.unit },
        h('div', { class: 'rrow-name' }, dot(m.color), h('span', null, m.code)),
        h('div', { class: 'rrow-val num' }, fmtNum(m.total), h('small', null, ' ' + m.unit),
          m.wasted ? h('small', null, ' · ' + L.wasted + ' ' + fmtNum(m.wasted)) : null),
        usedWastedBar(m.used, m.wasted, max, m.color))));
}

function wastePanel(p, cfg, L, lang, isToday) {
  const head = h('div', { class: 'panel-title' }, L.waste, h('small', { class: 'num' }, p.wasteCount + ' ' + L.entriesWord));
  if (!p.waste.length) return h('div', { class: 'panel glass' }, head, h('p', { class: 'hint' }, L.nothing));
  if (!isToday) {
    return h('div', { class: 'panel glass' }, head,
      h('div', { class: 'pills' }, p.reasons.map((r) => {
        const rs = reasonByKey(r.reason);
        return h('span', { class: 'pill' }, icon(REASON_ICONS[r.reason] || 'dots', 15), lang === 'hi' ? rs.hi : rs.en, h('b', { class: 'num' }, String(r.count)));
      })));
  }
  return h('div', { class: 'panel glass' }, head,
    h('div', null, p.waste.map((w) => {
      const rs = reasonByKey(w.reason);
      const prod = findProduct(cfg, w.product);
      const what = w.material
        ? w.material + ' · ' + fmtNum(w.qty) + ' ' + w.unit
        : (prod ? nameOf(prod) : w.product) + ' · ' + batchesLabel(w.batches, lang);
      return h('div', { class: 'wrow' },
        h('span', { class: 'action-icon' }, icon(REASON_ICONS[w.reason] || 'dots', 18)),
        h('div', null,
          h('div', { class: 'wrow-main' }, what),
          h('div', { class: 'wrow-meta num' }, [w.time, lang === 'hi' ? rs.hi : rs.en, w.worker, w.note].filter(Boolean).join(' · ')),
          !w.material && w.lines.length ? h('div', { class: 'wrow-meta num' }, lineText(w.lines) + (w.madeBefore ? ' · ' + L.madeBefore : '')) : null));
    })));
}

function workersPanel(p, L) {
  if (!p.workers.length) return null;
  return h('div', { class: 'panel glass' },
    h('div', { class: 'panel-title' }, L.workers),
    h('table', { class: 'mini-table' },
      h('tr', null, h('th', null, L.worker), h('th', { class: 'r' }, L.batches), h('th', { class: 'r' }, L.waste)),
      p.workers.map((w) => h('tr', null, h('td', null, w.worker), h('td', { class: 'r' }, fmtNum(w.batches)), h('td', { class: 'r' }, String(w.wasteEntries))))));
}

function phonesPanel(model, L) {
  if (!model.phones.length) return null;
  return h('div', { class: 'panel glass' },
    h('div', { class: 'panel-title' }, L.phones),
    model.phones.map((p) => h('div', { class: 'rrow' },
      h('div', { class: 'rrow-name' }, h('span', { class: 'dot', style: { '--c': p.sentToday ? EMERALD() : AMBER() } }), h('span', null, p.phone)),
      h('div', { class: 'rrow-val num' }, h('small', null, friendlyTime(p.lastSync) + (p.sentToday ? '' : ' · ' + L.notToday))))));
}

// "2026-11-03 01:09" -> "Today 01:09" / "2 Nov 18:40"
function friendlyTime(stamp) {
  const d = String(stamp || '').slice(0, 10);
  const time = String(stamp || '').slice(11, 16);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return stamp || '';
  return (d === localYmd() ? t('today') : shortDate(d, getLang())) + (time ? ' ' + time : '');
}

function dashboard(model, cfg) {
  const lang = getLang();
  const L = REPORT_TEXT[lang] || REPORT_TEXT.en;
  const d = Number(model.date.slice(8, 10));
  return [
    model.warnings.length ? h('div', { class: 'warn-box' }, h('b', null, L.warnings), h('ul', null, model.warnings.map((w) => h('li', null, w)))) : null,
    model.stock ? lowStockBox(model.stock.filter((r) => r.low), !!window.PRISM_ADMIN) : null,
    h('div', { class: 'kpis kpis-3' },
      kpi(L.batchesToday, fmtNum(model.today.batches), model.series.batches, EMERALD()),
      kpi(L.wasteToday, String(model.today.wasteCount), model.series.waste, AMBER()),
      kpi(L.batchesMonth, fmtNum(model.month.batches), null, VIOLET())),
    h('div', { class: 'section-title' }, L.today, h('small', null, shortDate(model.date, lang))),
    productPanel(model.today, cfg, L, lang),
    materialPanel(model.today, L),
    wastePanel(model.today, cfg, L, lang, true),
    model.stock ? stockPanel(model.stock, L, lang) : null,
    h('div', { class: 'section-title' }, L.month, h('small', null, (d === 1 ? '' : '1–') + shortDate(model.date, lang))),
    productPanel(model.month, cfg, L, lang),
    materialPanel(model.month, L),
    wastePanel(model.month, cfg, L, lang, false),
    workersPanel(model.month, L),
    phonesPanel(model, L),
  ];
}

export function reportScreen() {
  if (!day) day = localYmd();
  const today = localYmd();
  const lang = getLang();
  const cfg = store.getConfig();
  const source = h('div', { class: 'report-source' }, t('loading'));
  const out = h('div', { class: 'stack', style: { gap: '14px' } }, h('div', { class: 'empty' }, t('loading')));

  const shift = (n) => {
    const next = addDays(day, n);
    day = next > today ? today : next;
    nav.replace('report');
  };

  async function load() {
    const { url } = store.sheetConnection();
    let model;
    let useCfg = cfg;
    if (url) {
      try {
        const data = await sync.fetchReport(day);
        if (data.config) useCfg = normalizeConfig(Object.assign({}, cfg, data.config));
        (data.stock || []).forEach((r) => (r.color = materialColor(useCfg, r.code)));
        if (data.stock && day === data.today) store.setStockCache(data.stock, data.today);
        model = buildReportModel({ entries: data.entries, config: useCfg, date: day, phones: data.phones, source: 'sheet', stock: data.stock || null });
        source.textContent = t('reportAll');
        source.className = 'report-source is-sheet';
      } catch (err) {
        console.warn('Report from sheet failed:', err);
        model = localModel(cfg);
        source.textContent = t('reportOffline');
        source.className = 'report-source is-warn';
      }
    } else {
      model = localModel(cfg);
      source.textContent = t('reportPhone');
      source.className = 'report-source';
    }
    lastModel = model;
    out.replaceChildren(...dashboard(model, useCfg).filter(Boolean));
  }

  async function share() {
    if (!lastModel) return;
    const text = renderReportText(lastModel, getLang());
    const title = lastModel.appName + ' – ' + prettyDate(lastModel.date, getLang());
    try {
      if (navigator.share) {
        await navigator.share({ title, text });
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    location.href = 'mailto:?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(text);
  }

  load();
  const isAdmin = !!window.PRISM_ADMIN; // opened from the Prism Admin icon
  return {
    flow: isAdmin ? 'Prism Admin' : t('report'),
    back: isAdmin ? false : undefined,
    tone: 'purple',
    body: [
      isAdmin ? h('button', { class: 'btn btn-primary btn-stock', onclick: () => nav.go('stock') }, icon('stack', 20), t('stockTitle')) : null,
      h(
        'div',
        { class: 'report-nav glass' },
        h('button', { class: 'icon-btn', 'aria-label': 'previous day', onclick: () => shift(-1) }, icon('back', 20, 2)),
        h('div', { class: 'report-date' }, prettyDate(day, lang)),
        h('button', { class: 'icon-btn', 'aria-label': 'next day', disabled: day >= today, onclick: () => shift(1) }, icon('next', 20, 2))
      ),
      source,
      out,
      h(
        'div',
        { class: 'duo' },
        h('button', { class: 'btn', onclick: () => {
          out.style.opacity = '0.5';
          load().then(() => (out.style.opacity = ''));
        } }, icon('refresh', 18), t('refresh')),
        h('button', { class: 'btn', onclick: share }, icon('share', 18), t('share'))
      ),
      isAdmin ? h('button', { class: 'btn', onclick: () => nav.go('settings') }, icon('sliders', 18), t('settings')) : null,
    ],
  };
}

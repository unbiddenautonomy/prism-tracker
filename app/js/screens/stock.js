// Admin: raw material stock.
//   #/stock          every raw material with what's left, low ones first in a warning box
//   #/stock/<code>   add or remove stock, set the low stock alert, recent changes
import { h, numpad, segmented, dayPicker, noteField, toast, confirmDialog, entryBadge, dot, describeEntry, syncBadge } from '../ui.js';
import { t, getLang, nameOf } from '../i18n.js';
import { findMaterial, fmtNum, round3, localYmd, localHm, shortDate } from '../recipes.js';
import { computeStock, finishStockRow, wasteUsesRaw } from '../report.js';
import { stockBar } from '../charts.js';
import { icon } from '../icons.js';
import * as store from '../store.js';
import * as nav from '../nav.js';
import * as sync from '../sync.js';
import * as lock from '../lock.js';

let draft = null; // { code, move: 'in'|'out', amount, unitMode, note, date }
let lastFetch = { ok: null, err: '' };

const qtyUnit = (v, unit) => fmtNum(v) + (unit ? ' ' + unit : '');

function when(iso) {
  if (!iso) return t('never');
  const d = new Date(iso);
  const ymd = localYmd(d);
  return (ymd === localYmd() ? t('today') : shortDate(ymd, getLang())) + ' ' + localHm(d);
}

// Without a sheet, alert levels are kept on this phone.
function configWithLocalAlerts(cfg) {
  if (store.sheetConnection().url) return cfg;
  const local = store.getSettings().lowStockLocal || {};
  return Object.assign({}, cfg, {
    materials: cfg.materials.map((m) => (m.code in local ? Object.assign({}, m, { lowStock: Number(local[m.code]) || 0 }) : m)),
  });
}

function fieldOf(e) {
  if (e.type === 'stock') return e.move === 'out' ? 'removed' : 'added';
  if (e.type === 'production') return 'used';
  // A spoiled batch already recorded as made used no extra raw material: the same
  // rule the sheet uses, so the offline guess matches what comes back online.
  if (e.type === 'waste') return wasteUsesRaw(e) ? 'wasted' : '';
  return '';
}

// Stock as this phone knows it right now:
//  - sheet connected: the sheet's last numbers + entries this phone hasn't sent yet
//  - no sheet: worked out from the entries on this phone
// Returns { rows, source: 'sheet'|'phone', at } or null if the sheet was never reached.
export function currentStock() {
  const cfg = configWithLocalAlerts(store.getConfig());
  const today = localYmd();
  if (!store.sheetConnection().url) return { rows: computeStock(store.allEntries(), cfg, today), source: 'phone', at: null };
  const cache = store.getStockCache();
  if (!cache) return null;
  const fromSheet = {};
  cache.stock.forEach((r) => (fromSheet[r.code] = r));
  // Start from today's materials list (names, colors, alert levels), filled with the sheet's numbers.
  const rows = computeStock([], cfg, today).map((r) => {
    const s = fromSheet[r.code];
    if (!s) return r;
    ['tracked', 'since', 'added', 'removed', 'used', 'wasted'].forEach((k) => (r[k] = s[k]));
    if (cache.date === today && s.day) r.day = Object.assign({}, s.day);
    return r;
  });
  const byCode = {};
  rows.forEach((r) => (byCode[r.code] = r));
  store
    .allEntries()
    .filter((e) => !e.sentUpdatedAt && e.status !== 'deleted' && fieldOf(e))
    .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1))
    .forEach((e) => {
      const field = fieldOf(e);
      (e.lines || []).forEach((l) => {
        const r = byCode[l.material];
        if (!r) return;
        if (!r.tracked) {
          if (e.type !== 'stock') return;
          r.tracked = true;
          r.since = e.date;
        }
        const q = Number(l.qty) || 0;
        r[field] = round3(r[field] + q);
        if (e.date === today) r.day[field] = round3(r.day[field] + q);
      });
    });
  rows.forEach(finishStockRow);
  return { rows, source: 'sheet', at: cache.at };
}

// Asks the sheet for fresh numbers (after sending anything waiting).
export async function refreshStock() {
  if (!store.sheetConnection().url) return;
  try {
    if (store.pendingEntries().length) await sync.syncNow();
    await sync.fetchStock();
    lastFetch = { ok: true, err: '' };
  } catch (err) {
    lastFetch = { ok: false, err: String((err && err.message) || err) };
  }
}

export function lowStockBox(rows, withButton) {
  if (!rows.length) return null;
  return h(
    'div',
    { class: 'warn-box low-box' },
    h('b', { class: 'row' }, icon('alert', 16), t('stockLowTitle')),
    h('ul', null, rows.map((r) => h('li', null, t('stockLowLine', { code: r.code, left: qtyUnit(r.left, r.unit), alert: qtyUnit(r.lowStock, r.unit) })))),
    withButton ? h('button', { class: 'btn btn-mini-wide', onclick: () => nav.go('stock') }, icon('stack', 16), t('stockOpen')) : null
  );
}

export function stockScreen(args) {
  if (args && args[0]) return itemScreen(args[0]);
  return listScreen();
}

// ---------------- list ----------------

function stockCard(r, m, max) {
  return h(
    'button',
    { class: 'stock-card glass glow' + (r.low ? ' is-low' : ''), style: { '--c': r.color }, onclick: () => nav.go('stock/' + encodeURIComponent(r.code)) },
    h(
      'div',
      { class: 'stock-head' },
      h('span', { class: 'stock-code' }, dot(r.color), r.code, m && nameOf(m) !== r.code ? h('small', null, nameOf(m)) : null),
      r.tracked ? h('span', { class: 'stock-left num' }, fmtNum(r.left), h('small', null, ' ' + r.unit + ' ' + t('stockLeft'))) : null,
      h('span', { class: 'chev' }, icon('next', 20))
    ),
    r.tracked ? stockBar(r.left, r.lowStock, max, r.color, r.low) : null,
    h(
      'div',
      { class: 'stock-meta' },
      r.low ? h('span', { class: 'low-badge' }, icon('alert', 14), t('stockLowBadge')) : null,
      h('span', null, !r.tracked ? t('stockNotTracked') : r.lowStock ? t('stockAlertAt', { qty: qtyUnit(r.lowStock, r.unit) }) : t('stockNoAlert'))
    )
  );
}

function listScreen() {
  const source = h('div', { class: 'report-source' });
  const box = h('div', { class: 'stack' });

  function draw() {
    const cfg = store.getConfig();
    const cur = currentStock();
    if (!cur) {
      source.textContent = '';
      box.replaceChildren(h('div', { class: 'empty' }, lastFetch.ok === false ? t('stockNoData') : t('loading')));
      return;
    }
    if (cur.source === 'phone') {
      source.textContent = t('reportPhone');
      source.className = 'report-source';
    } else if (lastFetch.ok === false) {
      source.textContent = t('stockOffline', { time: when(cur.at) });
      source.className = 'report-source is-warn';
    } else {
      source.textContent = t('stockFromSheet', { time: when(cur.at) });
      source.className = 'report-source is-sheet';
    }
    const tracked = cur.rows.filter((r) => r.tracked);
    const max = Math.max(1, ...tracked.map((r) => Math.max(r.left, r.lowStock)));
    box.replaceChildren(
      ...[lowStockBox(cur.rows.filter((r) => r.low), false)].filter(Boolean),
      ...cur.rows.map((r) => stockCard(r, findMaterial(cfg, r.code), max))
    );
  }

  async function load() {
    box.style.opacity = '0.6';
    await refreshStock();
    box.style.opacity = '';
    if (box.isConnected) draw();
  }

  draw();
  if (store.sheetConnection().url) load();
  return {
    flow: t('stock'),
    tone: 'blue',
    heading: t('stockTitle'),
    sub: t('stockHelp'),
    body: [
      source,
      box,
      store.sheetConnection().url ? h('button', { class: 'btn', onclick: load }, icon('refresh', 18), t('refresh')) : null,
      syncBadge(),
    ],
  };
}

// ---------------- one material ----------------

function qtyOf(m) {
  const n = parseFloat(draft.amount);
  if (!(n > 0)) return 0;
  const c = draft.unitMode >= 0 ? (m.containers || [])[draft.unitMode] : null;
  return round3(c ? n * c.size : n);
}

function itemScreen(code) {
  const cfg = store.getConfig();
  const m = findMaterial(cfg, code);
  if (!m) {
    nav.replace('stock');
    return null;
  }
  // Adding, removing and alert levels are the owner's, not a worker's: anyone can
  // open the /admin link, so ask for the PIN before this screen (the list stays open).
  if (!lock.isUnlocked()) return lock.pinScreen({ flow: t('stock'), tone: 'blue', goTo: 'stock/' + encodeURIComponent(code) });
  lock.keepUnlocked();
  if (!draft || draft.code !== code) draft = { code, move: 'in', amount: '', unitMode: -1, note: '', date: localYmd() };
  const cur = currentStock();
  const row = cur ? cur.rows.find((r) => r.code === code) : null;
  const containers = m.containers || [];

  const howLabel = h('div', { class: 'label' });
  const display = h('div', { class: 'amount-value' });
  const unitLabel = h('div', { class: 'amount-unit' });
  const convert = h('div', { class: 'amount-convert' });
  const warn = h('div', { class: 'hint center' });
  const saveBtn = h('button', { class: 'btn btn-primary btn-big', onclick: save });
  const pad = numpad({
    value: draft.amount,
    onChange: (s) => {
      draft.amount = s;
      draw();
    },
  });

  function draw() {
    const c = draft.unitMode >= 0 ? containers[draft.unitMode] : null;
    const qty = qtyOf(m);
    howLabel.textContent = draft.move === 'in' ? t('stockAddHow') : t('stockRemoveHow');
    display.textContent = draft.amount || '0';
    display.classList.toggle('is-empty', !draft.amount);
    unitLabel.textContent = c ? nameOf(c) : m.unit;
    convert.textContent = c && qty ? '= ' + qtyUnit(qty, m.unit) : '';
    let w = '';
    if (draft.move === 'in' && row && !row.tracked) w = t('stockFirstAdd');
    if (draft.move === 'out' && row && row.tracked && qty > row.left) w = t('stockMoreThanLeft', { qty: qtyUnit(Math.max(0, row.left), m.unit) });
    warn.textContent = w;
    saveBtn.disabled = !(qty > 0);
    saveBtn.classList.toggle('btn-danger', draft.move === 'out' && qty > 0);
    saveBtn.replaceChildren(
      ...(qty > 0 ? [icon(draft.move === 'in' ? 'plus' : 'minus', 20, 2.25)] : []),
      qty > 0 ? t(draft.move === 'in' ? 'stockSaveAdd' : 'stockSaveRemove', { qty: qtyUnit(qty, m.unit) }) : t('enterAmount')
    );
  }

  function save() {
    const qty = qtyOf(m);
    if (!(qty > 0)) return;
    saveBtn.disabled = true;
    const c = draft.unitMode >= 0 ? containers[draft.unitMode] : null;
    const count = parseFloat(draft.amount);
    try {
      store.addEntry({
        type: 'stock',
        move: draft.move,
        material: m.code,
        qty,
        unit: m.unit,
        entered: c ? fmtNum(count) + ' × ' + c.name + ' (' + fmtNum(c.size) + ' ' + m.unit + ')' : '',
        enteredCount: c ? count : null,
        enteredContainer: c ? c.name : '',
        product: '',
        batches: null,
        reason: '',
        note: draft.note.trim(),
        date: draft.date,
        worker: store.getSettings().worker || 'Admin',
        lines: [{ material: m.code, qty, unit: m.unit }],
      });
      toast(t(draft.move === 'in' ? 'stockAddedToast' : 'stockRemovedToast', { qty: qtyUnit(qty, m.unit), code: m.code }));
      draft = null;
      sync.syncNow();
      nav.back();
    } catch (err) {
      console.error(err);
      saveBtn.disabled = false;
      toast(err.message === 'storage-full' ? t('storageFull') : t('errorGeneric'), 'error', 6000);
    }
  }

  const body = [
    h(
      'div',
      { class: 'stock-now glass' + (row && row.low ? ' is-low' : '') },
      h('div', { class: 'label' }, t('stockNow')),
      h('div', { class: 'stock-now-val num' }, row && row.tracked ? qtyUnit(row.left, m.unit) : '–'),
      row && row.low ? h('span', { class: 'low-badge' }, icon('alert', 14), t('stockLowBadge')) : null,
      h('div', { class: 'hint' }, row && row.tracked ? (m.lowStock ? t('stockAlertAt', { qty: qtyUnit(m.lowStock, m.unit) }) : t('stockNoAlert')) : t('stockNotTracked').split(' · ')[0])
    ),
    segmented(
      [
        { value: 'in', label: t('stockAdd') },
        { value: 'out', label: t('stockRemove') },
      ],
      draft.move,
      (v) => {
        draft.move = v;
        draw();
      }
    ),
  ];
  if (containers.length) {
    const opts = [{ value: -1, label: m.unit }].concat(containers.map((c, i) => ({ value: i, label: nameOf(c) + ' (' + fmtNum(c.size) + ' ' + m.unit + ')' })));
    body.push(h('div', { class: 'field' }, h('div', { class: 'label' }, t('countIn')), segmented(opts, draft.unitMode, (v) => {
      draft.unitMode = v;
      draw();
    })));
  }
  body.push(
    howLabel,
    h('div', { class: 'amount glass' }, display, unitLabel),
    convert,
    warn,
    pad,
    noteField(draft.note, (v) => (draft.note = v)),
    dayPicker(draft.date, (d) => (draft.date = d), t('stockWhen')),
    alertCard(m),
    recentList(m, cfg)
  );
  draw();
  return {
    flow: t('stock'),
    tone: 'blue',
    heading: m.code + (nameOf(m) !== m.code ? ' · ' + nameOf(m) : ''),
    headingColor: m.color,
    body,
    footer: saveBtn,
  };
}

function alertCard(m) {
  const local = !store.sheetConnection().url;
  const current = local ? Number((store.getSettings().lowStockLocal || {})[m.code]) || 0 : m.lowStock;
  const input = h('input', { class: 'input num alert-input', type: 'text', inputmode: 'decimal', maxlength: 9, placeholder: '0', value: current ? String(current) : '', 'aria-label': t('stockAlertTitle') });
  const btn = h('button', { class: 'btn', onclick: saveAlert }, icon('check', 18), t('stockAlertSave'));

  async function saveAlert() {
    const text = input.value.trim().replace(',', '.');
    const n = Number(text);
    if (text !== '' && !(n >= 0)) {
      toast(t('stockAlertFail', { err: text }), 'error', 5000);
      return;
    }
    const value = text === '' || n === 0 ? '' : round3(n);
    const done = () => toast(value === '' ? t('stockAlertCleared') : t('stockAlertSaved', { qty: qtyUnit(value, m.unit) }));
    if (local) {
      const all = Object.assign({}, store.getSettings().lowStockLocal || {});
      if (value === '') delete all[m.code];
      else all[m.code] = value;
      store.updateSettings({ lowStockLocal: all });
      done();
      nav.replace('stock/' + encodeURIComponent(m.code));
      return;
    }
    btn.disabled = true;
    try {
      await sync.setLowStock(m.code, value);
      lastFetch = { ok: true, err: '' };
      done();
      if (btn.isConnected) nav.replace('stock/' + encodeURIComponent(m.code));
    } catch (err) {
      btn.disabled = false;
      toast(t('stockAlertFail', { err: String((err && err.message) || err) }), 'error', 6000);
    }
  }

  return h(
    'section',
    { class: 'card glass' },
    h('h2', { class: 'card-title' }, icon('bell', 18), t('stockAlertTitle')),
    h('p', { class: 'hint' }, t('stockAlertHelp', { code: m.code })),
    h('div', { class: 'alert-row' }, input, h('span', { class: 'alert-unit' }, m.unit), btn)
  );
}

function recentList(m, cfg) {
  const list = store
    .allEntries()
    .filter((e) => e.type === 'stock' && e.material === m.code && e.status !== 'deleted')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 5);
  if (!list.length) return null;
  return h(
    'div',
    { class: 'stack' },
    h('div', { class: 'label' }, t('stockRecent')),
    list.map((e) =>
      h(
        'div',
        { class: 'entry glass', style: { '--c': e.move === 'out' ? 'var(--red)' : 'var(--emerald)' } },
        h('div', { class: 'entry-top' },
          h('span', { class: 'entry-type' }, icon(e.move === 'out' ? 'minus' : 'plus', 16)),
          h('span', { class: 'num' }, shortDate(e.date, getLang()) + ' · ' + e.time),
          h('span', { class: 'entry-worker' }, e.worker)),
        h('div', { class: 'entry-text' }, describeEntry(e, cfg)),
        e.entered || e.note ? h('div', { class: 'entry-reason' }, [e.entered, e.note].filter(Boolean).join(' · ')) : null,
        entryBadge(e.id),
        h('button', { class: 'btn btn-danger-outline', onclick: async () => {
          const ok = await confirmDialog({ title: t('confirmDelete'), message: describeEntry(e, cfg), yes: t('yesDelete'), no: t('noKeep'), danger: true });
          if (!ok) return;
          store.deleteEntry(e.id);
          sync.syncNow();
          toast(t('deletedToast'));
          nav.replace('stock/' + encodeURIComponent(m.code));
        } }, icon('trash', 16), t('delete'))
      )
    )
  );
}

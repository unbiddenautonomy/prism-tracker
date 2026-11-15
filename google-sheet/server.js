// ===================================================================
// Prism – Google Sheet side.
// Receives entries from the phones, hands them the latest recipes,
// and sends the daily email. Functions ending in "_" are internal.
// ===================================================================

const PRISM_VERSION = '0.2.0';

const TAB = {
  materials: 'Materials',
  recipes: 'Recipes',
  workers: 'Workers',
  settings: 'Settings',
  entries: 'Entries',
  use: 'Material Use',
  phones: 'Phones',
  categories: 'Categories',
  stock: 'Stock',
};

// [field, column header]. Phones write by position, so keep this order.
const ENTRY_COLS = [
  ['date', 'Date'],
  ['time', 'Time'],
  ['type', 'Type'],
  ['product', 'Product'],
  ['batches', 'Batches'],
  ['material', 'Material'],
  ['qty', 'Qty'],
  ['unit', 'Unit'],
  ['entered', 'Entered as'],
  ['reason', 'Reason'],
  ['note', 'Note'],
  ['worker', 'Worker'],
  ['phone', 'Phone'],
  ['status', 'Status'],
  ['rawText', 'Raw material used'],
  ['id', 'Entry ID'],
  ['createdAt', 'Created'],
  ['updatedAt', 'Updated'],
  ['linesJson', 'Raw material (data)'],
];
const ENTRY_TEXT_FIELDS = ['date', 'time', 'id', 'createdAt', 'updatedAt', 'linesJson', 'entered', 'note', 'product', 'worker', 'phone'];
const USE_HEADERS = ['Date', 'Type', 'Material', 'Qty', 'Unit', 'Product', 'Reason', 'Worker', 'Phone', 'Entry ID'];
const PHONE_HEADERS = ['Phone', 'Last sync', 'Worker', 'App version'];
const MATERIAL_HEADERS = ['Code', 'Name', 'Name (Hindi)', 'Unit', 'Container', 'Container (Hindi)', 'Container size', 'Color', 'Low stock alert'];
const LOW_STOCK_COL = 9; // Materials column with the alert level
const STOCK_HEADERS = ['Material', 'Unit', 'Counted since', 'Added', 'Removed', 'Used in batches', 'Wasted', 'Left', 'Alert below', 'Status', 'Updated'];
// Entries "Type" column for each kind of entry.
const TYPE_LABELS = { production: 'Production', waste: 'Waste', stockin: 'Stock in', stockout: 'Stock out' };
// Recipes: these columns are found by their header; every other header is a raw material code.
const RECIPE_FIXED = ['Product', 'Product (Hindi)', 'Batch note', 'Batch note (Hindi)', 'Category', 'Color'];
const CATEGORY_HEADERS = ['Category', 'Color'];

const SETTING_ROWS = [
  ['Report email', '', 'Who gets the daily email. Separate several addresses with commas. Empty = the owner of this sheet.'],
  ['Report hour', 20, 'Hour to send the daily email, 0 to 23 (20 = 8 pm). Uses this sheet\'s time zone (File > Settings).'],
  ['Secret key', '', 'Phones must send this key. Put it in the app (config.json or the phone\'s Settings screen).'],
  ['Owner PIN', '', 'PIN that opens Settings on the phones.'],
  ['App name', '', 'Shown in the app and the email.'],
  ['Last report sent', '', 'Filled in automatically. Clear it to send today\'s email again.'],
];

// ---------------- helpers ----------------

function getSS_() {
  let ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    ss = null;
  }
  if (!ss) {
    const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    if (id) ss = SpreadsheetApp.openById(id);
  }
  if (!ss) throw new Error('Run "setup" first.');
  return ss;
}

function tz_() {
  return getSS_().getSpreadsheetTimeZone();
}

function todayText_() {
  return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd');
}

function nowText_() {
  return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HH:mm');
}

function str_(v) {
  if (v == null) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  return String(v).trim();
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function ensureSheet_(ss, name, headers) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (headers && sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#e2e8f0');
    sh.setFrozenRows(1);
  }
  return sh;
}

function checkHeaders_(sh, headers) {
  const got = sh.getRange(1, 1, 1, headers.length).getValues()[0].map(String);
  for (let i = 0; i < headers.length; i++) {
    if (got[i] !== headers[i]) throw new Error('sheet-columns-changed: "' + sh.getName() + '" column ' + (i + 1) + ' should be "' + headers[i] + '"');
  }
}

// Writes rows, keeping the given columns as plain text so Sheets doesn't turn them into dates.
function writeRows_(sh, startRow, rows, textCols) {
  if (!rows.length) return;
  textCols.forEach((c) => sh.getRange(startRow, c, rows.length, 1).setNumberFormat('@'));
  sh.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
}

function colOf_(field) {
  for (let i = 0; i < ENTRY_COLS.length; i++) if (ENTRY_COLS[i][0] === field) return i + 1;
  throw new Error('unknown column ' + field);
}

// ---------------- settings & config ----------------

function readSettings_() {
  const sh = getSS_().getSheetByName(TAB.settings);
  const map = {};
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach((r) => {
      map[String(r[0]).trim()] = r[1];
    });
  }
  let hour = parseInt(map['Report hour'], 10);
  if (!(hour >= 0 && hour <= 23)) hour = 20;
  return {
    email: str_(map['Report email']),
    hour,
    key: str_(map['Secret key']),
    pin: str_(map['Owner PIN']) || '1234',
    appName: str_(map['App name']) || 'Prism',
    lastSent: str_(map['Last report sent']),
  };
}

function setSetting_(name, value) {
  const sh = getSS_().getSheetByName(TAB.settings);
  const names = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (let i = 0; i < names.length; i++) {
    if (String(names[i][0]).trim() === name) {
      const cell = sh.getRange(i + 1, 2);
      cell.setNumberFormat('@');
      cell.setValue(value);
      return;
    }
  }
  writeRows_(sh, sh.getLastRow() + 1, [[name, value, '']], [2]);
}

function readConfig_() {
  const ss = getSS_();
  const s = readSettings_();
  const warnings = [];
  const num = (v) => (v === '' || v == null ? 0 : Number(v));

  const materials = [];
  const mSh = ss.getSheetByName(TAB.materials);
  if (mSh && mSh.getLastRow() > 1) {
    const width = Math.max(MATERIAL_HEADERS.length, mSh.getLastColumn());
    mSh.getRange(2, 1, mSh.getLastRow() - 1, width).getValues().forEach((r) => {
      const code = str_(r[0]);
      if (!code) return;
      const size = num(r[6]);
      const color = str_(r[7]);
      const low = r[8] === '' || r[8] == null ? 0 : Number(r[8]);
      if (isNaN(low) || low < 0) warnings.push('Materials "' + code + '": low stock alert "' + r[8] + '" is not a number.');
      if (color && !cleanColor(color)) warnings.push('Materials "' + code + '": color "' + color + '" should look like #00F5A0.');
      materials.push({
        code,
        name: str_(r[1]) || code,
        name_hi: str_(r[2]),
        unit: str_(r[3]) || 'kg',
        color: cleanColor(color),
        lowStock: low > 0 ? low : 0,
        containers: size > 0 ? [{ name: str_(r[4]) || 'Container', name_hi: str_(r[5]), size }] : [],
      });
    });
  }
  const known = {};
  materials.forEach((m) => (known[m.code] = true));

  const products = [];
  const rSh = ss.getSheetByName(TAB.recipes);
  if (rSh && rSh.getLastRow() > 1) {
    const data = rSh.getDataRange().getValues();
    const head = data[0].map((v) => str_(v));
    const at = {};
    head.forEach((hd, j) => {
      if (RECIPE_FIXED.indexOf(hd) >= 0 && !(hd in at)) at[hd] = j;
    });
    const col = (row, hd) => (hd in at ? row[at[hd]] : '');
    const codeCols = [];
    head.forEach((code, j) => {
      if (!code || RECIPE_FIXED.indexOf(code) >= 0) return;
      if (!known[code]) warnings.push('Recipes column "' + code + '" is not in the Materials tab.');
      codeCols.push(j);
    });
    const seen = {};
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const name = str_(col(row, 'Product'));
      if (!name) continue;
      if (seen[name]) warnings.push('Product "' + name + '" is listed twice (row ' + (i + 1) + ').');
      seen[name] = true;
      const recipe = {};
      codeCols.forEach((j) => {
        const code = head[j];
        if (row[j] === '' || row[j] == null) return;
        const v = Number(row[j]);
        if (isNaN(v) || v < 0) warnings.push('Recipes row ' + (i + 1) + ' (' + name + '), ' + code + ': "' + row[j] + '" is not a number.');
        else if (v > 0) recipe[code] = v;
      });
      if (!Object.keys(recipe).length) warnings.push('Product "' + name + '" has no amounts in the Recipes tab.');
      const color = str_(col(row, 'Color'));
      if (color && !cleanColor(color)) warnings.push('Recipes "' + name + '": color "' + color + '" should look like #00F5A0.');
      products.push({
        name,
        name_hi: str_(col(row, 'Product (Hindi)')),
        batchNote: str_(col(row, 'Batch note')),
        batchNote_hi: str_(col(row, 'Batch note (Hindi)')),
        category: str_(col(row, 'Category')),
        color: cleanColor(color),
        recipe,
      });
    }
  }

  const workers = [];
  const wSh = ss.getSheetByName(TAB.workers);
  if (wSh && wSh.getLastRow() > 1) {
    wSh.getRange(2, 1, wSh.getLastRow() - 1, 1).getValues().forEach((r) => {
      const n = str_(r[0]);
      if (n) workers.push(n);
    });
  }
  const categoryColors = {};
  const cSh = ss.getSheetByName(TAB.categories);
  if (cSh && cSh.getLastRow() > 1) {
    cSh.getRange(2, 1, cSh.getLastRow() - 1, 2).getValues().forEach((r) => {
      const name = str_(r[0]);
      const color = str_(r[1]);
      if (!name) return;
      if (cleanColor(color)) categoryColors[name] = cleanColor(color);
      else if (color) warnings.push('Categories "' + name + '": color "' + color + '" should look like #00F5A0.');
    });
  }
  return { appName: s.appName, ownerPin: s.pin, categoryColors, materials, products, workers, warnings };
}

// ---------------- entries ----------------

function cleanEntry_(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').slice(0, 64);
  if (!id) return null;
  const type = raw.type === 'waste' || raw.type === 'stock' ? raw.type : 'production';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(raw.date)) ? String(raw.date) : todayText_();
  const s = (v, max) => String(v == null ? '' : v).slice(0, max || 200);
  const n = (v) => (v === '' || v == null || isNaN(Number(v)) ? '' : Number(v));
  const lines = (Array.isArray(raw.lines) ? raw.lines : [])
    .filter((l) => l && l.material)
    .slice(0, 50)
    .map((l) => ({ material: s(l.material, 20), qty: Number(l.qty) || 0, unit: s(l.unit, 10) }));
  return {
    id,
    type,
    date,
    time: s(raw.time, 5),
    product: s(raw.product, 120),
    batches: n(raw.batches),
    material: s(raw.material, 20),
    qty: n(raw.qty),
    unit: s(raw.unit, 10),
    entered: s(raw.entered, 80),
    reason: type === 'waste' ? s(raw.reason, 20) : '',
    move: type === 'stock' ? (raw.move === 'out' ? 'out' : 'in') : '',
    note: s(raw.note, 300),
    worker: s(raw.worker, 60),
    phone: s(raw.phone, 60),
    status: raw.status === 'deleted' ? 'deleted' : 'ok',
    createdAt: s(raw.createdAt, 30),
    updatedAt: s(raw.updatedAt, 30),
    lines,
  };
}

function typeLabel_(e) {
  if (e.type === 'stock') return e.move === 'out' ? TYPE_LABELS.stockout : TYPE_LABELS.stockin;
  return e.type === 'waste' ? TYPE_LABELS.waste : TYPE_LABELS.production;
}

function entryToRow_(e) {
  const v = {
    date: e.date,
    time: e.time,
    type: typeLabel_(e),
    product: e.product,
    batches: e.batches,
    material: e.material,
    qty: e.qty,
    unit: e.unit,
    entered: e.entered,
    reason: e.type === 'waste' ? reasonByKey(e.reason).en : '',
    note: e.note,
    worker: e.worker,
    phone: e.phone,
    status: e.status === 'deleted' ? 'DELETED' : 'OK',
    rawText: lineText(e.lines),
    id: e.id,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    linesJson: JSON.stringify(e.lines),
  };
  return ENTRY_COLS.map((c) => (v[c[0]] == null ? '' : v[c[0]]));
}

function rowToEntry_(r) {
  const get = (field) => r[colOf_(field) - 1];
  let lines = [];
  try {
    lines = JSON.parse(String(get('linesJson') || '[]'));
  } catch (e) {
    lines = [];
  }
  const label = String(get('type')).trim().toLowerCase();
  const type = label === 'waste' ? 'waste' : label.indexOf('stock') === 0 ? 'stock' : 'production';
  const num = (v) => (v === '' || v == null ? null : Number(v));
  return {
    id: str_(get('id')),
    date: str_(get('date')),
    time: str_(get('time')),
    type,
    product: str_(get('product')),
    batches: num(get('batches')),
    material: str_(get('material')),
    qty: num(get('qty')),
    unit: str_(get('unit')),
    entered: str_(get('entered')),
    reason: type === 'waste' ? reasonKeyFromLabel(get('reason')) : '',
    move: type === 'stock' ? (label === 'stock out' ? 'out' : 'in') : '',
    note: str_(get('note')),
    worker: str_(get('worker')),
    phone: str_(get('phone')),
    status: String(get('status')).toUpperCase() === 'DELETED' ? 'deleted' : 'ok',
    lines,
  };
}

function useRowsFor_(e) {
  if (e.status !== 'ok') return [];
  const type = typeLabel_(e);
  const reason = e.type === 'waste' ? reasonByKey(e.reason).en : '';
  return e.lines.map((l) => [e.date, type, l.material, l.qty, l.unit, e.product, reason, e.worker, e.phone, e.id]);
}

function upsertEntries_(rawEntries) {
  const ss = getSS_();
  const sh = ss.getSheetByName(TAB.entries);
  const useSh = ss.getSheetByName(TAB.use);
  checkHeaders_(sh, ENTRY_COLS.map((c) => c[1]));
  checkHeaders_(useSh, USE_HEADERS);

  // Newest version of each entry in this batch.
  const incoming = {};
  rawEntries.forEach((raw) => {
    const e = cleanEntry_(raw);
    if (e && (!incoming[e.id] || incoming[e.id].updatedAt <= e.updatedAt)) incoming[e.id] = e;
  });

  const idCol = colOf_('id');
  const updCol = colOf_('updatedAt');
  const last = sh.getLastRow();
  const existing = {};
  if (last >= 2) {
    const ids = sh.getRange(2, idCol, last - 1, 1).getValues();
    const upds = sh.getRange(2, updCol, last - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      const id = String(ids[i][0]);
      if (id) existing[id] = { row: i + 2, updatedAt: String(upds[i][0]) };
    }
  }

  const textCols = ENTRY_TEXT_FIELDS.map(colOf_);
  const saved = [];
  const toAppend = [];
  const replacedIds = {};
  let useRows = [];
  Object.keys(incoming).forEach((id) => {
    const e = incoming[id];
    const found = existing[id];
    saved.push(id);
    if (found && found.updatedAt && found.updatedAt >= e.updatedAt) return; // already have this or newer
    const row = entryToRow_(e);
    if (found) {
      writeRows_(sh, found.row, [row], textCols);
      replacedIds[id] = true;
    } else {
      toAppend.push(row);
    }
    useRows = useRows.concat(useRowsFor_(e));
  });
  writeRows_(sh, sh.getLastRow() + 1, toAppend, textCols);

  // Material Use: drop old rows of changed entries, then add the new ones.
  if (Object.keys(replacedIds).length && useSh.getLastRow() >= 2) {
    const ids = useSh.getRange(2, USE_HEADERS.length, useSh.getLastRow() - 1, 1).getValues();
    for (let i = ids.length - 1; i >= 0; i--) {
      if (replacedIds[String(ids[i][0])]) useSh.deleteRow(i + 2);
    }
  }
  writeRows_(useSh, useSh.getLastRow() + 1, useRows, [1, 10]);
  return saved;
}

function readAllEntries_() {
  const sh = getSS_().getSheetByName(TAB.entries);
  if (!sh || sh.getLastRow() < 2) return [];
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, ENTRY_COLS.length).getValues();
  return rows.map(rowToEntry_).filter((e) => e.id);
}

function readEntries_(monthKey, all) {
  return (all || readAllEntries_()).filter((e) => e.date.slice(0, 7) === monthKey);
}

// ---------------- stock ----------------

// Colors filled in the same way as on the phones.
function stockFor_(all, config, day) {
  return computeStock(all, normalizeConfig(config), day);
}

function stockNow_(all, config) {
  return stockFor_(all || readAllEntries_(), config || readConfig_(), todayText_());
}

// Writes the Stock tab: one row per raw material, refreshed after every sync.
function writeStockTab_(stock) {
  const ss = getSS_();
  const sh = ensureSheet_(ss, TAB.stock, STOCK_HEADERS);
  const stamp = nowText_();
  const rows = stock.map((r) => [
    r.code,
    r.unit,
    r.since || 'not counted yet',
    r.tracked ? r.added : '',
    r.tracked ? r.removed : '',
    r.tracked ? r.used : '',
    r.tracked ? r.wasted : '',
    r.tracked ? r.left : '',
    r.lowStock || '',
    !r.tracked ? '' : r.low ? 'LOW' : 'OK',
    stamp,
  ]);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, STOCK_HEADERS.length).clearContent();
  writeRows_(sh, 2, rows, [1, 3, 11]);
}

// Refreshes the Stock tab and emails once when a material falls below its alert
// level. It emails again only after that material has been back above it.
function checkStock_(all) {
  const config = readConfig_();
  const stock = stockNow_(all, config);
  writeStockTab_(stock);
  const props = PropertiesService.getScriptProperties();
  let alerted = {};
  try {
    alerted = JSON.parse(props.getProperty('LOW_ALERTED') || '{}') || {};
  } catch (e) {
    alerted = {};
  }
  const low = lowStockRows(stock);
  const fresh = low.filter((r) => !alerted[r.code]);
  const next = {};
  low.forEach((r) => (next[r.code] = true));
  if (fresh.length) {
    const s = readSettings_();
    MailApp.sendEmail({
      to: s.email || Session.getEffectiveUser().getEmail(),
      subject: config.appName + ': low stock – ' + fresh.map((r) => r.code).join(', '),
      htmlBody: renderLowStockHtml(low, config.appName, getSS_().getUrl()),
      body: renderLowStockText(low, config.appName),
      name: config.appName + ' tracker',
    });
  }
  props.setProperty('LOW_ALERTED', JSON.stringify(next));
  return { stock, emailed: fresh.map((r) => r.code) };
}

// The admin app sets a material's alert level (empty = no alert).
function setLowStock_(req) {
  const code = String(req.material || '').trim();
  const raw = req.value === '' || req.value == null ? '' : Number(req.value);
  if (raw !== '' && (isNaN(raw) || raw < 0)) return { ok: false, error: 'bad-number' };
  const sh = getSS_().getSheetByName(TAB.materials);
  const last = sh ? sh.getLastRow() : 0;
  if (last < 2) return { ok: false, error: 'unknown-material' };
  const codes = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < codes.length; i++) {
    if (str_(codes[i][0]) === code) {
      ensureLowStockHeader_(sh);
      sh.getRange(i + 2, LOW_STOCK_COL).setValue(raw === 0 ? '' : raw);
      return { ok: true, config: readConfig_() };
    }
  }
  return { ok: false, error: 'unknown-material' };
}

// Sheets made before stock tracking have no alert column yet.
function ensureLowStockHeader_(sh) {
  const cell = sh.getRange(1, LOW_STOCK_COL);
  if (!str_(cell.getValue())) cell.setValue(MATERIAL_HEADERS[LOW_STOCK_COL - 1]).setFontWeight('bold').setBackground('#e2e8f0');
}

function touchPhone_(phone, worker, version) {
  const sh = getSS_().getSheetByName(TAB.phones);
  const row = [String(phone).slice(0, 60), nowText_(), String(worker || '').slice(0, 60), String(version || '').slice(0, 20)];
  const last = sh.getLastRow();
  if (last >= 2) {
    const names = sh.getRange(2, 1, last - 1, 1).getValues();
    for (let i = 0; i < names.length; i++) {
      if (String(names[i][0]) === row[0]) {
        writeRows_(sh, i + 2, [row], [1, 2, 4]);
        return;
      }
    }
  }
  writeRows_(sh, last + 1, [row], [1, 2, 4]);
}

function readPhones_() {
  const sh = getSS_().getSheetByName(TAB.phones);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh
    .getRange(2, 1, sh.getLastRow() - 1, PHONE_HEADERS.length)
    .getValues()
    .filter((r) => str_(r[0]))
    .map((r) => ({
      phone: str_(r[0]),
      lastSync: Object.prototype.toString.call(r[1]) === '[object Date]' ? Utilities.formatDate(r[1], tz_(), 'yyyy-MM-dd HH:mm') : str_(r[1]),
      worker: str_(r[2]),
      appVersion: str_(r[3]),
    }));
}

// ---------------- web app (phones call this) ----------------

function doGet() {
  return json_({ ok: true, app: 'Prism sheet', version: PRISM_VERSION, note: 'Working. Phones talk to this link with POST.' });
}

function doPost(e) {
  let out;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const s = readSettings_();
    if (!s.key || String(req.key || '') !== s.key) return json_({ ok: false, error: 'bad-key' });
    if (req.action === 'ping') {
      out = { ok: true, sheetName: getSS_().getName(), products: readConfig_().products.length, version: PRISM_VERSION };
    } else if (req.action === 'sync') {
      out = handleSync_(req);
    } else if (req.action === 'report') {
      const day = /^\d{4}-\d{2}-\d{2}$/.test(String(req.day)) ? String(req.day) : todayText_();
      const all = readAllEntries_();
      const config = readConfig_();
      out = { ok: true, entries: readEntries_(day.slice(0, 7), all), phones: readPhones_(), config, stock: stockFor_(all, config, day), today: todayText_() };
    } else if (req.action === 'stock') {
      const config = readConfig_();
      out = { ok: true, stock: stockNow_(null, config), config, today: todayText_() };
    } else if (req.action === 'setLowStock') {
      const lock = LockService.getScriptLock();
      if (!lock.tryLock(25000)) return json_({ ok: false, error: 'busy' });
      try {
        out = setLowStock_(req);
        if (out.ok) {
          out.stock = checkStock_().stock;
          out.today = todayText_();
        }
      } finally {
        lock.releaseLock();
      }
    } else {
      out = { ok: false, error: 'unknown-action' };
    }
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return json_(out);
}

function handleSync_(req) {
  const entries = Array.isArray(req.entries) ? req.entries.slice(0, 300) : [];
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return { ok: false, error: 'busy' };
  let saved;
  try {
    saved = upsertEntries_(entries);
    if (req.phone) touchPhone_(req.phone, req.worker, req.appVersion);
    if (entries.length) {
      try {
        checkStock_();
      } catch (err) {
        // Never let the stock check stop entries from being saved.
        Logger.log('Stock check failed: ' + err);
      }
    }
  } finally {
    lock.releaseLock();
  }
  return { ok: true, saved, config: readConfig_(), serverTime: new Date().toISOString() };
}

// ---------------- daily email ----------------

// Runs every hour (set up by "setup"). Sends once a day, at or after the report hour.
function hourlyCheck() {
  const s = readSettings_();
  const now = new Date();
  const tz = tz_();
  const hour = Number(Utilities.formatDate(now, tz, 'H'));
  const today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  try {
    checkStock_();
  } catch (err) {
    Logger.log('Stock check failed: ' + err);
  }
  if (hour < s.hour || s.lastSent === today) return;
  sendReport_(today);
  setSetting_('Last report sent', today);
}

function sendReport_(day) {
  const s = readSettings_();
  const ss = getSS_();
  const config = readConfig_();
  const all = readAllEntries_();
  const model = buildReportModel({
    entries: readEntries_(day.slice(0, 7), all),
    stock: stockFor_(all, config, day),
    config,
    date: day,
    phones: readPhones_(),
    source: 'sheet',
    sheetUrl: ss.getUrl(),
  });
  const to = s.email || Session.getEffectiveUser().getEmail();
  MailApp.sendEmail({
    to,
    subject: config.appName + ' daily report – ' + prettyDate(day, 'en'),
    htmlBody: renderReportHtml(model, 'en'),
    body: renderReportText(model, 'en'),
    name: config.appName + ' tracker',
  });
  return to;
}

// Menu: Prism > Send today's report now (does not stop the scheduled one).
function sendReportNow() {
  const to = sendReport_(todayText_());
  notify_('Report sent to ' + to);
}

function showSecretKey() {
  notify_('Secret key for the phones:\n\n' + readSettings_().key);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Prism')
    .addItem('Send today\'s report now', 'sendReportNow')
    .addItem('Show secret key', 'showSecretKey')
    .addSeparator()
    .addItem('Set up / repair this sheet', 'setup')
    .addToUi();
}

function notify_(msg) {
  Logger.log(msg);
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    // Run from the script editor: the message is in the Execution log instead.
  }
}

// ---------------- repair garbled text ----------------
// If this script was copied on a Mac by a tool that read it as "Mac Roman"
// instead of UTF-8, text like "·" ends up as "¬∑" and Hindi as "‡§¨‡•ã...".
// fixGarbled_ undoes exactly that, and leaves any other text untouched.

const MAC_ROMAN_ =
  'ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ';

function macRomanByte_(ch) {
  const code = ch.charCodeAt(0);
  if (code < 128) return code;
  if (ch === '¤') return 0xdb; // older Mac Roman tables
  const i = MAC_ROMAN_.indexOf(ch);
  return i < 0 ? -1 : 128 + i;
}

// Strict UTF-8 decode; returns null if the bytes are not valid UTF-8.
function utf8Decode_(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    let need, cp;
    if (b < 0x80) { out += String.fromCharCode(b); i++; continue; }
    else if (b >= 0xc2 && b <= 0xdf) { need = 1; cp = b & 0x1f; }
    else if (b >= 0xe0 && b <= 0xef) { need = 2; cp = b & 0x0f; }
    else if (b >= 0xf0 && b <= 0xf4) { need = 3; cp = b & 0x07; }
    else return null;
    for (let k = 1; k <= need; k++) {
      const c = bytes[i + k];
      if (c === undefined || (c & 0xc0) !== 0x80) return null;
      cp = (cp << 6) | (c & 0x3f);
    }
    if ((need === 2 && cp < 0x800) || (need === 3 && (cp < 0x10000 || cp > 0x10ffff)) || (cp >= 0xd800 && cp <= 0xdfff)) return null;
    out += String.fromCodePoint(cp);
    i += need + 1;
  }
  return out;
}

function fixGarbled_(s) {
  if (typeof s !== 'string' || !/[^\x00-\x7f]/.test(s)) return s;
  for (let round = 0; round < 3; round++) {
    const bytes = [];
    for (const ch of s) {
      const b = macRomanByte_(ch);
      if (b < 0) return s;
      bytes.push(b);
    }
    const fixed = utf8Decode_(bytes);
    if (fixed === null || fixed === s) return s;
    s = fixed;
    if (!/[^\x00-\x7f]/.test(s)) return s;
  }
  return s;
}

// Fixes garbled text in every tab. Returns how many cells changed.
function repairText_(ss) {
  let changed = 0;
  ss.getSheets().forEach((sh) => {
    const rows = sh.getLastRow();
    const cols = sh.getLastColumn();
    if (!rows || !cols) return;
    const range = sh.getRange(1, 1, rows, cols);
    const values = range.getValues();
    const formulas = range.getFormulas();
    values.forEach((row, r) =>
      row.forEach((v, c) => {
        if (formulas[r][c]) return;
        const fixed = fixGarbled_(v);
        if (fixed !== v) {
          sh.getRange(r + 1, c + 1).setValue(fixed);
          changed++;
        }
      })
    );
  });
  return changed;
}

// ---------------- one-time setup ----------------

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  const seed = SEED_CONFIG;
  const codes = seed.materials.map((m) => m.code);

  const mSh = ensureSheet_(ss, TAB.materials, MATERIAL_HEADERS);
  if (mSh.getLastRow() < 2) {
    const rows = seed.materials.map((m) => {
      const c = (m.containers || [])[0] || {};
      return [m.code, m.name || m.code, m.name_hi || '', m.unit || 'kg', c.name || '', c.name_hi || '', c.size || '', m.color || '', m.lowStock || ''];
    });
    writeRows_(mSh, 2, rows, [1, 8]);
  }
  ensureLowStockHeader_(mSh);

  const rSh = ensureSheet_(ss, TAB.recipes, RECIPE_FIXED.concat(codes));
  if (rSh.getLastRow() < 2) {
    const rows = seed.products.map((p) =>
      [p.name, p.name_hi || '', p.batchNote || '', p.batchNote_hi || '', p.category || '', p.color || ''].concat(codes.map((c) => (p.recipe && p.recipe[c]) || ''))
    );
    if (rows.length) writeRows_(rSh, 2, rows, [1, 6]);
  }

  const cSh = ensureSheet_(ss, TAB.categories, CATEGORY_HEADERS);
  const cats = Object.keys(seed.categoryColors || {});
  if (cSh.getLastRow() < 2 && cats.length) writeRows_(cSh, 2, cats.map((k) => [k, seed.categoryColors[k]]), [1, 2]);

  const wSh = ensureSheet_(ss, TAB.workers, ['Name']);
  if (wSh.getLastRow() < 2 && seed.workers.length) writeRows_(wSh, 2, seed.workers.map((w) => [w]), [1]);

  const sSh = ensureSheet_(ss, TAB.settings, ['Setting', 'Value', 'What it means']);
  const have = {};
  if (sSh.getLastRow() > 1) sSh.getRange(2, 1, sSh.getLastRow() - 1, 2).getValues().forEach((r) => (have[String(r[0]).trim()] = r[1]));
  SETTING_ROWS.forEach((row) => {
    if (row[0] in have) return;
    let value = row[1];
    if (row[0] === 'Secret key') value = Utilities.getUuid().replace(/-/g, '').slice(0, 24);
    if (row[0] === 'Owner PIN') value = seed.ownerPin || '1234';
    if (row[0] === 'App name') value = seed.appName || 'Prism';
    writeRows_(sSh, sSh.getLastRow() + 1, [[row[0], value, row[2]]], [2]);
  });
  // An empty key would let nobody in; fill it if someone cleared it.
  if ('Secret key' in have && !str_(have['Secret key'])) setSetting_('Secret key', Utilities.getUuid().replace(/-/g, '').slice(0, 24));

  ensureSheet_(ss, TAB.entries, ENTRY_COLS.map((c) => c[1]));
  ensureSheet_(ss, TAB.use, USE_HEADERS);
  ensureSheet_(ss, TAB.phones, PHONE_HEADERS);
  ensureSheet_(ss, TAB.stock, STOCK_HEADERS);

  const blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);

  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === 'hourlyCheck') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('hourlyCheck').timeBased().everyHours(1).create();

  const fixedCells = repairText_(ss);
  checkStock_();

  const s = readSettings_();
  const msg =
    'Prism sheet is ready.\n\n' +
    (fixedCells ? 'Fixed garbled text in ' + fixedCells + ' cells.\n' : '') +
    'Secret key: ' + s.key + '\n' +
    'Time zone: ' + ss.getSpreadsheetTimeZone() + '\n' +
    'Daily email: after ' + s.hour + ':00 to ' + (s.email || Session.getEffectiveUser().getEmail()) + '\n\n' +
    'Next: Deploy > New deployment > Web app (see SETUP.md).';
  notify_(msg);
  return msg;
}

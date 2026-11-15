// Keeps everything this phone knows: its settings, its entries, and the latest
// recipes from the Google Sheet. Saved in the browser's localStorage so entries
// survive closing the app. (On Android this can later be swapped for native storage.)
import { normalizeConfig, localYmd, localHm, addDays } from './recipes.js';

const KEYS = {
  entries: 'prism.entries.v1',
  settings: 'prism.settings.v1',
  sheetConfig: 'prism.sheetConfig.v1',
  stock: 'prism.stock.v1',
};
const KEEP_SENT_DAYS = 62; // entries already in the sheet are kept on the phone this long

let builtIn = null;
let builtInSheet = { url: '', key: '' };
let entries = [];
let settings = {};
let sheetCfg = null; // { config, at }
const listeners = new Set();

function read(key, fallback) {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch (e) {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('Could not save', key, e);
    return false;
  }
}

function emit() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
  });
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function init() {
  const res = await fetch('config.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('config.json not found (' + res.status + ')');
  const raw = await res.json();
  builtIn = normalizeConfig(raw);
  builtInSheet = { url: String((raw.sheet && raw.sheet.url) || ''), key: String((raw.sheet && raw.sheet.key) || '') };
  entries = read(KEYS.entries, []);
  if (!Array.isArray(entries)) entries = [];
  settings = read(KEYS.settings, {}) || {};
  sheetCfg = read(KEYS.sheetConfig, null);
  if (!settings.phone) {
    settings.phone = 'Phone ' + (100 + Math.floor(Math.random() * 900));
    write(KEYS.settings, settings);
  }
  prune();
}

// ---- Config (recipes, materials, workers) ----

export function getConfig() {
  if (sheetCfg && sheetCfg.config) return sheetCfg.config;
  return builtIn;
}

export function configSource() {
  return sheetCfg && sheetCfg.config ? { from: 'sheet', at: sheetCfg.at } : { from: 'built-in', at: null };
}

// Returns true if the recipes/workers actually changed.
export function setSheetConfig(raw) {
  const config = normalizeConfig(raw);
  const changed = !sheetCfg || JSON.stringify(sheetCfg.config) !== JSON.stringify(config);
  sheetCfg = { config, at: new Date().toISOString() };
  write(KEYS.sheetConfig, sheetCfg);
  return changed;
}

export function clearSheetConfig() {
  sheetCfg = null;
  try {
    localStorage.removeItem(KEYS.stock);
    localStorage.removeItem(KEYS.sheetConfig);
  } catch (e) {
    /* ignore */
  }
}

// ---- Stock (admin) ----
// The last stock numbers from the sheet, so the admin app can show them offline.

export function getStockCache() {
  const c = read(KEYS.stock, null);
  return c && Array.isArray(c.stock) ? c : null;
}

export function setStockCache(stock, date) {
  write(KEYS.stock, { stock, date, at: new Date().toISOString() });
}

// ---- Settings ----

export function getSettings() {
  return settings;
}

export function updateSettings(patch) {
  Object.assign(settings, patch);
  write(KEYS.settings, settings);
  emit();
}

// The phone's own override wins; otherwise the link baked into config.json.
export function sheetConnection() {
  const url = 'sheetUrl' in settings ? settings.sheetUrl : builtInSheet.url;
  const key = 'sheetKey' in settings ? settings.sheetKey : builtInSheet.key;
  return { url: String(url || '').trim(), key: String(key || '').trim() };
}

// ---- Entries ----

function newId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
  const b = new Uint8Array(16);
  if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
}

// A new timestamp that is always later than the previous one (needed so the sheet
// can tell which version of an entry is newest).
function laterThan(prevIso) {
  const now = new Date();
  if (prevIso && now.toISOString() <= prevIso) return new Date(new Date(prevIso).getTime() + 1).toISOString();
  return now.toISOString();
}

function persist() {
  return write(KEYS.entries, entries);
}

export function allEntries() {
  return entries;
}

export function getEntry(id) {
  return entries.find((e) => e.id === id) || null;
}

export function addEntry(fields) {
  const now = new Date();
  const e = Object.assign(
    {
      id: newId(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      time: localHm(now),
      phone: settings.phone,
      worker: settings.worker || '',
      status: 'ok',
      sentUpdatedAt: null,
    },
    fields
  );
  entries.push(e);
  if (!persist()) {
    entries.pop();
    throw new Error('storage-full');
  }
  emit();
  return e;
}

export function updateEntry(id, patch) {
  const e = getEntry(id);
  if (!e) return null;
  const before = Object.assign({}, e);
  Object.assign(e, patch, { updatedAt: laterThan(e.updatedAt) });
  if (!persist()) {
    Object.keys(e).forEach((k) => delete e[k]);
    Object.assign(e, before);
    throw new Error('storage-full');
  }
  emit();
  return e;
}

// Entries are never removed straight away: they are marked deleted so the
// sheet hears about it too.
export function deleteEntry(id) {
  return updateEntry(id, { status: 'deleted' });
}

export function pendingEntries() {
  return entries.filter((e) => e.sentUpdatedAt !== e.updatedAt);
}

export function markSent(list) {
  let any = false;
  list.forEach((x) => {
    const e = getEntry(x.id);
    if (e && e.updatedAt === x.updatedAt) {
      e.sentUpdatedAt = x.updatedAt;
      any = true;
    }
  });
  if (any) {
    persist();
    emit();
  }
}

// Entries made on this phone today (or made today for yesterday), newest first.
export function todayEntries() {
  const today = localYmd();
  return entries
    .filter((e) => e.status !== 'deleted' && (e.date === today || localYmd(new Date(e.createdAt)) === today))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function prune() {
  const cutoff = addDays(localYmd(), -KEEP_SENT_DAYS);
  const before = entries.length;
  entries = entries.filter((e) => e.sentUpdatedAt !== e.updatedAt || String(e.date) >= cutoff);
  if (entries.length !== before) persist();
}

// Removes entries and the worker name; keeps phone name, language and sheet link.
export function clearEntries() {
  entries = [];
  persist();
  clearSheetConfig();
  delete settings.worker;
  write(KEYS.settings, settings);
  emit();
}

export function stripLocal(e) {
  const copy = Object.assign({}, e);
  delete copy.sentUpdatedAt;
  return copy;
}

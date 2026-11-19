// Talks to the Google Sheet (or the pretend sheet in dev_server.py).
// Entries wait on the phone until the sheet confirms it has them.
import * as store from './store.js';

export const APP_VERSION = '0.2.0';
const BATCH_SIZE = 200;
const TIMEOUT_MS = 25000;
const STUCK_MS = 60 * 60 * 1000; // failing this long while the phone has internet is a real problem

let state = 'idle'; // idle | local | sending | ok | waiting | error
let lastError = '';
let inFlight = null;
let runAgain = false;
let lastConfigPull = 0;
let failingSince = 0;
const statusListeners = new Set();
const configListeners = new Set();

export function onStatus(fn) {
  statusListeners.add(fn);
}

export function onConfigChange(fn) {
  configListeners.add(fn);
}

export function getStatus() {
  const pending = store.pendingEntries().length;
  const { url } = store.sheetConnection();
  let s = state;
  if (!url) s = 'local';
  else if (s === 'idle' || (s === 'ok' && pending)) s = pending ? 'waiting' : 'ok';
  return { state: s, pending, error: lastError };
}

function setState(s, err) {
  state = s;
  lastError = err || '';
  statusListeners.forEach((fn) => fn(getStatus()));
}

async function post(url, key, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    // text/plain avoids the extra "preflight" request that Google Apps Script can't answer.
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({}, body, { key })),
      signal: ctrl.signal,
      redirect: 'follow',
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(res.ok ? 'not-a-prism-sheet' : 'http-' + res.status);
    }
    if (!data.ok) throw new Error(data.error || 'sheet-error');
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('timeout');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export function syncNow(opts) {
  const pullConfig = !!(opts && opts.pullConfig);
  if (inFlight) {
    runAgain = true;
    return inFlight;
  }
  inFlight = run(pullConfig).finally(() => {
    inFlight = null;
    if (runAgain) {
      runAgain = false;
      syncNow();
    }
  });
  return inFlight;
}

async function run(pullConfig) {
  const { url, key } = store.sheetConnection();
  const pending = store.pendingEntries();
  if (!url) return setState('local');
  if (!pending.length && !pullConfig) return setState('ok');
  if (navigator.onLine === false) return setState('waiting');

  setState('sending');
  const batch = pending.slice(0, BATCH_SIZE).map(store.stripLocal);
  try {
    const s = store.getSettings();
    const data = await post(url, key, {
      action: 'sync',
      phone: s.phone,
      worker: s.worker || '',
      appVersion: APP_VERSION,
      entries: batch,
    });
    const saved = new Set(data.saved || []);
    store.markSent(batch.filter((e) => saved.has(e.id)).map((e) => ({ id: e.id, updatedAt: e.updatedAt })));
    store.updateSettings({ lastSyncAt: new Date().toISOString() });
    if (data.config) {
      lastConfigPull = Date.now();
      if (store.setSheetConfig(data.config)) configListeners.forEach((fn) => fn());
    }
    if (pending.length > BATCH_SIZE) runAgain = true;
    failingSince = 0;
    setState(store.pendingEntries().length ? 'waiting' : 'ok');
  } catch (err) {
    const msg = String((err && err.message) || err);
    console.warn('Sync failed:', msg);
    // A wrong key or broken sheet needs a person; anything else is probably just no internet.
    const needsPerson = msg === 'bad-key' || msg === 'not-a-prism-sheet' || msg.indexOf('sheet-columns') === 0;
    if (!failingSince) failingSince = Date.now();
    // Still not getting through after an hour, with the phone online: the link is
    // wrong or the sheet is gone. Saying "waiting for internet" forever hides that.
    const stuck = navigator.onLine !== false && Date.now() - failingSince > STUCK_MS;
    setState(needsPerson || stuck ? 'error' : 'waiting', msg);
  }
}

export function startAutoSync() {
  syncNow({ pullConfig: true });
  setInterval(() => {
    if (store.pendingEntries().length) syncNow();
  }, 2 * 60 * 1000);
  setInterval(() => syncNow({ pullConfig: true }), 15 * 60 * 1000);
  window.addEventListener('online', () => syncNow({ pullConfig: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastConfigPull > 60 * 1000) syncNow({ pullConfig: true });
  });
}

export async function testConnection() {
  const { url, key } = store.sheetConnection();
  if (!url) throw new Error('no-link');
  return post(url, key, { action: 'ping', phone: store.getSettings().phone });
}

// Stock left of every raw material (admin), computed by the sheet from all entries.
export async function fetchStock() {
  const { url, key } = store.sheetConnection();
  if (!url) throw new Error('no-link');
  const data = await post(url, key, { action: 'stock' });
  store.setStockCache(data.stock || [], data.today || '');
  if (data.config && store.setSheetConfig(data.config)) configListeners.forEach((fn) => fn());
  return data;
}

// Saves a raw material's low stock alert level in the sheet ('' = no alert).
export async function setLowStock(material, value) {
  const { url, key } = store.sheetConnection();
  if (!url) throw new Error('no-link');
  const data = await post(url, key, { action: 'setLowStock', material, value });
  if (data.stock) store.setStockCache(data.stock, data.today || '');
  if (data.config && store.setSheetConfig(data.config)) configListeners.forEach((fn) => fn());
  return data;
}

// Month's entries from every phone, for the Report screen.
export async function fetchReport(day) {
  const { url, key } = store.sheetConnection();
  if (!url) throw new Error('no-link');
  return post(url, key, { action: 'report', day });
}

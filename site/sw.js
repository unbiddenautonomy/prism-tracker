// Offline support. Answers from the saved copy first, so the app opens at once even
// on a weak signal, and fetches a fresh copy quietly for the next open.
const VERSION = 'prism-20261119-123505'; // tools/make_website.py stamps a new value for each upload
// Pages use their clean addresses ('./' and './admin'); Cloudflare redirects the .html names,
// and a saved redirect can't be used to open a page offline.
const SEND_TAG = 'prism-send';
// Sending with the app shut needs the waiting list; if this can't be loaded the app
// still works and still sends whenever it is open.
try {
  importScripts('./js/outbox.js');
} catch (err) {
  console.warn('Background sending unavailable:', err);
}

const CORE = [
  './',
  './admin',
  './js/outbox.js',
  './css/app.css',
  './config.json',
  './manifest.webmanifest',
  './admin.webmanifest',
  './js/main.js',
  './js/theme-boot.js',
  './js/admin-boot.js',
  './js/nav.js',
  './js/lock.js',
  './js/store.js',
  './js/sync.js',
  './js/ui.js',
  './js/i18n.js',
  './js/icons.js',
  './js/charts.js',
  './js/recipes.js',
  './js/report.js',
  './js/screens/home.js',
  './js/screens/who.js',
  './js/screens/production.js',
  './js/screens/waste.js',
  './js/screens/saved.js',
  './js/screens/log.js',
  './js/screens/report-view.js',
  './js/screens/settings.js',
  './js/screens/stock.js',
  './js/screens/recipes.js',
  './icons/app-192.png',
  './icons/admin-192.png',
  './icons/favicon-64.png',
  './icons/admin-favicon-64.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only this site's own files. Entries going to the Google Sheet are never touched.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(savedFirst(req));
});

// The saved copy is sent back straight away and a fresh one is fetched quietly for
// next time. Waiting for the internet first used to hold the app up for about 20
// seconds whenever the signal was weak enough that requests were accepted but never
// answered. A new upload still reaches the phone: make_website.py stamps a new
// VERSION, so "install" above fetches every file again and the next open shows it.
async function savedFirst(req) {
  const cache = await caches.open(VERSION);
  const saved = (await cache.match(req, { ignoreSearch: true })) || (await pageFallback(cache, req));
  const fresh = fetch(req).then((res) => {
    // A full phone can refuse the save; the page is served either way.
    if (res && res.ok && res.type === 'basic') cache.put(req, res.clone()).catch(() => {});
    return res;
  });
  if (!saved) return fresh;
  fresh.catch(() => {}); // no signal: the saved copy has already gone back
  return saved;
}

// ---- Sending with the app shut ----
// Android Chrome wakes the worker when the phone has signal again. iPhones don't
// support this, so there the app sends whenever someone opens it, as before.
self.addEventListener('sync', (event) => {
  if (event.tag === SEND_TAG) event.waitUntil(sendWaiting());
});

async function sendWaiting() {
  if (!self.PrismOutbox) return;
  const box = await self.PrismOutbox.read();
  if (!box || !box.url || !box.entries || !box.entries.length) return;
  const res = await fetch(box.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'sync',
      key: box.key,
      phone: box.phone,
      worker: box.worker,
      appVersion: box.appVersion,
      entries: box.entries,
    }),
    redirect: 'follow',
  });
  const data = JSON.parse(await res.text());
  // Throwing asks the phone to try again later, which is what a weak signal needs.
  if (!data.ok) throw new Error(data.error || 'sheet-error');
  const saved = data.saved || [];
  const done = box.entries.filter((e) => saved.indexOf(e.id) >= 0);
  if (!done.length) return;
  await self.PrismOutbox.addSent(done.map((e) => ({ id: e.id, updatedAt: e.updatedAt })));
  const left = box.entries.filter((e) => saved.indexOf(e.id) < 0);
  if (left.length) await self.PrismOutbox.save(Object.assign({}, box, { entries: left }));
  else await self.PrismOutbox.clear();
  // If a copy of the app happens to be open, let it tick the entries off at once.
  const open = await self.clients.matchAll({ includeUncontrolled: true });
  open.forEach((c) => c.postMessage({ type: 'prism-sent' }));
}

// Pages are saved under their clean addresses ('./' and './admin').
function pageFallback(cache, req) {
  if (req.mode !== 'navigate') return undefined;
  return cache.match(new URL(req.url).pathname.endsWith('/admin') ? './admin' : './');
}

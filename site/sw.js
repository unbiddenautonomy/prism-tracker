// Offline support. Always tries the internet first (so updates show up straight away),
// and falls back to the saved copy when there's no signal.
const VERSION = 'prism-20261115-181237'; // tools/make_website.py stamps a new value for each upload
// Pages use their clean addresses ('./' and './admin'); Cloudflare redirects the .html names,
// and a saved redirect can't be used to open a page offline.
const CORE = [
  './',
  './admin',
  './css/app.css',
  './config.json',
  './manifest.webmanifest',
  './admin.webmanifest',
  './js/main.js',
  './js/theme-boot.js',
  './js/admin-boot.js',
  './js/nav.js',
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
  './icons/app-192.png',
  './icons/admin-192.png',
  './icons/favicon-64.png',
  './icons/admin-favicon-64.png',
];
const WAIT_MS = 4000; // weak signal: after this long, use the saved copy

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
  event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  const fromCache = async () =>
    (await cache.match(req, { ignoreSearch: true })) ||
    (req.mode === 'navigate' ? await cache.match(new URL(req.url).pathname.endsWith('/admin') ? './admin' : './') : undefined);

  const network = fetch(req).then((res) => {
    if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
    return res;
  });
  network.catch(() => {}); // handled below

  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), WAIT_MS));
  try {
    const first = await Promise.race([network, timeout]);
    if (first) return first;
    return (await fromCache()) || (await network);
  } catch (err) {
    const saved = await fromCache();
    if (saved) return saved;
    throw err;
  }
}

// App start-up and the page frame (top bar, content, bottom button).
import { h } from './ui.js';
import { icon } from './icons.js';
import { t, setLang, getLang } from './i18n.js';
import * as store from './store.js';
import * as nav from './nav.js';
import * as sync from './sync.js';
import { homeScreen } from './screens/home.js';
import { whoScreen } from './screens/who.js';
import { productionPickScreen, productionQtyScreen } from './screens/production.js';
import { wasteScreen } from './screens/waste.js';
import { savedScreen } from './screens/saved.js';
import { logScreen } from './screens/log.js';
import { reportScreen } from './screens/report-view.js';
import { settingsScreen } from './screens/settings.js';
import { stockScreen } from './screens/stock.js';

const ROUTES = {
  home: () => homeScreen(),
  who: () => whoScreen(),
  production: (a) => (a[0] === 'qty' ? productionQtyScreen() : productionPickScreen()),
  waste: (a) => wasteScreen(a[0]),
  saved: (a) => savedScreen(a),
  log: () => logScreen(),
  report: () => reportScreen(),
  settings: () => settingsScreen(),
  stock: (a) => stockScreen(a),
};

const app = document.getElementById('app');

// ---- Light / dark ----
const systemLight = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

export function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#F3F5F9' : '#0A0F18');
}

function toggleTheme() {
  const next = currentTheme() === 'light' ? 'dark' : 'light';
  store.updateSettings({ theme: next });
  applyTheme(next);
  render();
}

function toggleLang() {
  const next = getLang() === 'en' ? 'hi' : 'en';
  setLang(next);
  store.updateSettings({ lang: next });
  render();
}

function frame(view) {
  const isHome = view.back === false;
  const header = h(
    'header',
    { class: 'topbar' },
    isHome
      ? h('span', { class: 'brand' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }), view.flow)
      : h('button', { class: 'icon-btn topbar-back', onclick: () => nav.back() }, icon('back', 18, 2), t('back')),
    isHome ? null : h('span', { class: 'topbar-flow' }, h('span', { class: 'dot' }), h('span', null, view.flow)),
    h('button', { class: 'icon-btn', onclick: toggleTheme, 'aria-label': currentTheme() === 'light' ? t('toDark') : t('toLight'), title: currentTheme() === 'light' ? t('toDark') : t('toLight') },
      icon(currentTheme() === 'light' ? 'moon' : 'sun', 18)),
    h('button', { class: 'icon-btn', onclick: toggleLang, 'aria-label': 'language' }, icon('globe', 16), t('langSwitch'))
  );
  const main = h(
    'main',
    { class: 'content' },
    view.steps || null,
    view.heading
      ? h('div', { class: 'heading-row' }, view.headingColor ? h('span', { class: 'dot', style: { '--c': view.headingColor } }) : null, h('h1', { class: 'heading' }, view.heading))
      : null,
    view.sub ? h('p', { class: 'sub' }, view.sub) : null,
    view.body
  );
  const parts = [header, main];
  if (view.footer) parts.push(h('footer', { class: 'actionbar' }, view.footer));
  return parts;
}

function render() {
  document.querySelectorAll('.overlay').forEach((o) => o.remove());
  const route = nav.currentRoute();
  // The owner can open Reports, Stock and Settings without picking a worker.
  if (!store.getSettings().worker && ['who', 'settings', 'report', 'stock'].indexOf(route.name) < 0) {
    nav.replace('who');
    return;
  }
  const fn = ROUTES[route.name] || ROUTES.home;
  let view;
  try {
    view = fn(route.args);
  } catch (err) {
    console.error(err);
    view = { flow: 'Error', tone: 'slate', heading: t('errorGeneric'), body: [h('pre', { class: 'hint' }, String(err && err.stack || err))] };
  }
  if (!view) return; // the screen moved somewhere else
  app.className = 'tone-' + (view.tone || 'slate') + (view.footer ? ' has-footer' : '');
  document.body.className = 'tone-' + (view.tone || 'slate');
  app.replaceChildren(...frame(view));
  window.scrollTo(0, 0);
  updateBadges();
}

function statusInfo(st) {
  switch (st.state) {
    case 'local':
      return { cls: 'local', text: t('stLocal') };
    case 'sending':
      return { cls: 'sending', text: t('stSending') };
    case 'error':
      return { cls: 'error', text: t('stError') + (st.error ? ' (' + st.error + ')' : '') };
    case 'waiting':
      // Nothing waiting = nothing lost, even if the sheet couldn't be reached just now.
      return st.pending ? { cls: 'waiting', text: t('stWaiting', { n: st.pending }) } : { cls: 'ok', text: t('stOk') };
    default:
      return { cls: 'ok', text: t('stOk') };
  }
}

function updateBadges() {
  const st = sync.getStatus();
  const info = statusInfo(st);
  document.querySelectorAll('[data-sync-badge]').forEach((el) => {
    el.className = 'sync-badge sync-' + info.cls;
    el.textContent = info.text;
  });
  const connected = !!store.sheetConnection().url;
  document.querySelectorAll('[data-entry-badge]').forEach((el) => {
    const e = store.getEntry(el.dataset.entryBadge);
    if (!e) return;
    const sent = e.sentUpdatedAt === e.updatedAt;
    el.className = 'entry-badge ' + (!connected ? 'is-local' : sent ? 'is-sent' : 'is-waiting');
    el.textContent = !connected ? t('entryLocal') : sent ? t('entrySent') : t('entryWaiting');
  });
}

async function boot() {
  try {
    await store.init();
  } catch (err) {
    app.replaceChildren(h('main', { class: 'content' }, h('h1', { class: 'heading' }, 'Prism'), h('p', null, t('bootError', { err: err.message }))));
    return;
  }
  setLang(store.getSettings().lang || 'en');
  const saved = store.getSettings().theme;
  applyTheme(saved === 'light' || saved === 'dark' ? saved : systemLight && systemLight.matches ? 'light' : 'dark');
  // Until someone taps the switch, follow the phone's own light/dark setting.
  if (systemLight && systemLight.addEventListener) {
    systemLight.addEventListener('change', (e) => {
      if (!store.getSettings().theme) {
        applyTheme(e.matches ? 'light' : 'dark');
        render();
      }
    });
  }
  nav.setRenderer(render);
  // A link ending in #/report (the PrismAdmin shortcut) opens straight on the Reports dashboard.
  nav.initNav(nav.currentRoute().name === 'report' ? 'report' : 'home');
  render();
  sync.onStatus(updateBadges);
  store.onChange(updateBadges);
  sync.onConfigChange(() => {
    // New recipes/workers arrived from the sheet: redraw pick lists, but never a half-filled form.
    const r = nav.currentRoute().name;
    if (r === 'home' || (r === 'production' && !nav.currentRoute().args.length)) render();
  });
  sync.startAutoSync();
  registerOffline();
}

// Offline support + install to home screen (needs https, or localhost while testing).
function registerOffline() {
  const okHost = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!okHost || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Offline support unavailable:', err));
  // Ask the phone not to clear this app's saved entries when storage runs low.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

window.addEventListener('unhandledrejection', (e) => {
  console.error(e.reason);
});

boot();

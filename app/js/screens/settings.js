// Owner/supervisor settings behind a PIN.
import { h, toast, confirmDialog, syncBadge } from '../ui.js';
import { t, getLang } from '../i18n.js';
import { localYmd, shortDate, localHm } from '../recipes.js';
import * as store from '../store.js';
import * as nav from '../nav.js';
import * as sync from '../sync.js';
import { languagePicker } from './who.js';
import { icon } from '../icons.js';
import * as lock from '../lock.js';

let testMessage = { text: '', cls: '' }; // kept so it survives the screen refreshing

function when(iso) {
  if (!iso) return t('never');
  const d = new Date(iso);
  const ymd = localYmd(d);
  return (ymd === localYmd() ? t('today') : shortDate(ymd, getLang())) + ' ' + localHm(d);
}

export function settingsScreen() {
  if (!lock.isUnlocked()) return lock.pinScreen({ flow: t('settings'), goTo: 'settings' });
  lock.keepUnlocked();
  return settingsBody();
}

function section(iconName, title, ...kids) {
  return h('section', { class: 'card glass' }, h('h2', { class: 'card-title' }, icon(iconName, 18), title), kids);
}

function field(label, input) {
  return h('label', { class: 'field' }, h('span', { class: 'label' }, label), input);
}

function settingsBody() {
  const s = store.getSettings();
  const cfg = store.getConfig();
  const conn = store.sheetConnection();
  const src = store.configSource();
  const pending = store.pendingEntries().length;

  const phoneInput = h('input', { class: 'input', type: 'text', maxlength: 30, value: s.phone });
  phoneInput.addEventListener('change', () => {
    const v = phoneInput.value.trim();
    if (v) store.updateSettings({ phone: v });
  });

  const urlInput = h('input', { class: 'input mono', type: 'url', placeholder: 'https://script.google.com/macros/s/…/exec', value: conn.url, autocomplete: 'off' });
  const keyInput = h('input', { class: 'input mono', type: 'text', value: conn.key, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  const result = h('div', { class: 'test-result ' + testMessage.cls, role: 'status' }, testMessage.text);
  const show = (text, cls) => {
    testMessage = { text, cls: cls || '' };
    result.textContent = text;
    result.className = 'test-result ' + (cls || '');
  };

  async function saveAndTest(url, key) {
    store.updateSettings({ sheetUrl: url, sheetKey: key });
    if (!url) {
      store.clearSheetConfig();
      show(t('setNotConnected'));
      await sync.syncNow();
      nav.replace('settings');
      return;
    }
    show(t('setTesting'));
    try {
      const data = await sync.testConnection();
      show(t('setTestOk', { name: data.sheetName || '?', n: data.products == null ? '?' : data.products }), 'is-ok');
      await sync.syncNow({ pullConfig: true });
      nav.replace('settings'); // show the new sync status and recipe source
    } catch (err) {
      show(t('setTestFail', { err: (err && err.message) || err }), 'is-bad');
    }
  }

  const sheetButtons = [
    h('button', { class: 'btn btn-primary', onclick: () => saveAndTest(urlInput.value.trim(), keyInput.value.trim()) }, t('setSaveTest')),
  ];
  // The pretend sheet only exists while testing on the computer (dev_server.py).
  if (location.protocol === 'http:') {
    sheetButtons.push(
      h('button', { class: 'btn', onclick: () => {
        urlInput.value = location.origin + '/mock-sheet';
        keyInput.value = 'test-key';
        saveAndTest(urlInput.value, keyInput.value);
      } }, icon('flask', 18), t('setUseTest'))
    );
  }
  if (conn.url) {
    sheetButtons.push(
      h('button', { class: 'btn', onclick: () => sync.syncNow({ pullConfig: true }).then(() => nav.replace('settings')) }, icon('cloud', 18), t('setSyncNow')),
      h('button', { class: 'btn btn-danger-outline', onclick: () => {
        urlInput.value = '';
        keyInput.value = '';
        saveAndTest('', '');
      } }, t('setDisconnect'))
    );
  }

  const clearBtn = h('button', { class: 'btn btn-danger-outline', onclick: async () => {
    const ok = await confirmDialog({
      title: t('setClear') + '?',
      message: t('setClearConfirm'),
      warning: pending ? t('setClearWarn', { n: pending }) : '',
      yes: t('yesDelete'),
      no: t('noKeep'),
      danger: true,
    });
    if (!ok) return;
    store.clearEntries();
    toast(t('setCleared'));
    lock.lock();
    nav.goHome();
  } }, icon('trash', 18), t('setClear'));

  return {
    flow: t('settings'),
    tone: 'slate',
    heading: t('settings'),
    body: [
      section(
        'phone',
        t('setPhone'),
        field(t('setPhoneName'), phoneInput),
        h('div', { class: 'row-between' },
          h('span', null, t('setWorker') + ': ', h('b', null, s.worker || '–')),
          h('button', { class: 'btn-mini', onclick: () => nav.go('who') }, t('changeWorker'))),
        h('div', { class: 'label' }, t('setLanguage')),
        languagePicker(() => nav.replace('settings'))
      ),
      section(
        'cloud',
        t('setSheet'),
        syncBadge(),
        h('p', { class: 'hint' }, conn.url ? t('setLastSync', { time: when(s.lastSyncAt) }) : t('setNotConnected')),
        field(t('setSheetUrl'), urlInput),
        field(t('setSheetKey'), keyInput),
        result,
        h('div', { class: 'stack' }, sheetButtons)
      ),
      section(
        'flask',
        t('setRecipes'),
        h('p', null, src.from === 'sheet' ? t('srcSheet', { time: when(src.at) }) : t('srcBuiltIn')),
        h('p', { class: 'hint' }, t('setCounts', { p: cfg.products.length, m: cfg.materials.length, w: cfg.workers.length })),
        cfg.warnings && cfg.warnings.length
          ? h('div', { class: 'warn-box' }, h('b', null, t('recipeWarnings')), h('ul', null, cfg.warnings.map((w) => h('li', null, w))))
          : null,
        conn.url ? h('button', { class: 'btn', onclick: () => sync.syncNow({ pullConfig: true }).then(() => nav.replace('settings')) }, icon('refresh', 18), t('setRefresh')) : null
      ),
      section(
        'list',
        t('setData'),
        h('p', null, t('setDataCounts', { n: store.allEntries().length, w: pending })),
        clearBtn
      ),
      h('button', { class: 'btn', onclick: () => {
        lock.lock();
        nav.goHome();
      } }, icon('lock', 18), t('setLock')),
      h('p', { class: 'hint center' }, t('setVersion', { v: sync.APP_VERSION })),
    ],
  };
}

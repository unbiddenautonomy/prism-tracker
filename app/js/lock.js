// The owner's PIN. Shared by ⚙ Settings and by stock changes in the admin app,
// so anyone who simply opens the /admin link cannot move stock or change alerts.
import { h } from './ui.js';
import { t } from './i18n.js';
import { icon } from './icons.js';
import * as store from './store.js';
import * as nav from './nav.js';

const UNLOCK_MINUTES = 10;
const MAX_TRIES = 5; // then the pad waits, so the PIN can't be guessed by trying every number
const WAIT_SECONDS = 30;

let unlockedUntil = 0;
let wrongTries = 0;
let waitUntil = 0;

export function isUnlocked() {
  return Date.now() <= unlockedUntil;
}

export function keepUnlocked() {
  unlockedUntil = Date.now() + UNLOCK_MINUTES * 60 * 1000;
}

export function lock() {
  unlockedUntil = 0;
}

// opts: { flow, tone, goTo } – goTo is the screen to open once the PIN is right.
export function pinScreen(opts) {
  const o = opts || {};
  const goTo = o.goTo || 'settings';
  const pin = String(store.getConfig().ownerPin || '1234');
  let typed = '';
  const dots = h('div', { class: 'pin-dots' });
  const msg = h('div', { class: 'pin-msg', role: 'alert' });
  const secondsLeft = () => Math.ceil((waitUntil - Date.now()) / 1000);

  const draw = () =>
    dots.replaceChildren(...Array.from({ length: pin.length }, (_, i) => h('span', { class: 'pin-dot' + (i < typed.length ? ' on' : '') })));

  function countDown() {
    const left = secondsLeft();
    if (left <= 0) {
      msg.textContent = '';
      return;
    }
    msg.textContent = t('pinWait', { s: left });
    if (msg.isConnected) setTimeout(countDown, 1000);
  }

  function wrong() {
    wrongTries += 1;
    if (wrongTries >= MAX_TRIES) {
      wrongTries = 0;
      waitUntil = Date.now() + WAIT_SECONDS * 1000;
      countDown();
    } else {
      msg.textContent = t('pinWrong');
    }
    dots.classList.add('shake');
    setTimeout(() => {
      typed = '';
      dots.classList.remove('shake');
      draw();
    }, 450);
  }

  const press = (k) => {
    if (secondsLeft() > 0) return;
    if (k === '⌫') typed = typed.slice(0, -1);
    else if (k) typed += k;
    draw();
    if (typed.length < pin.length) return;
    if (typed === pin) {
      wrongTries = 0;
      keepUnlocked();
      nav.replace(goTo);
      return;
    }
    wrong();
  };

  draw();
  if (secondsLeft() > 0) countDown();
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  return {
    flow: o.flow || t('settings'),
    tone: o.tone || 'slate',
    heading: t('pinTitle'),
    sub: t('pinHelp'),
    body: [
      dots,
      msg,
      h('div', { class: 'numpad numpad-pin' }, keys.map((k) =>
        k ? h('button', { class: 'numkey' + (k === '⌫' ? ' numkey-back' : ''), 'aria-label': k === '⌫' ? t('backspace') : k, onclick: () => press(k) },
          k === '⌫' ? icon('backspace', 24) : k) : h('span')
      )),
    ],
  };
}

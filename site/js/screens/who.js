// "Who are you?" – picked once per phone, changeable any time.
import { h } from '../ui.js';
import { t, getLang, setLang } from '../i18n.js';
import { icon } from '../icons.js';
import * as store from '../store.js';
import * as nav from '../nav.js';

export function languagePicker(onChange) {
  const cur = getLang();
  const pick = (l) => {
    setLang(l);
    store.updateSettings({ lang: l });
    onChange();
  };
  return h(
    'div',
    { class: 'lang-pick' },
    h('button', { class: 'btn btn-lang' + (cur === 'en' ? ' is-selected' : ''), onclick: () => pick('en') }, 'English'),
    h('button', { class: 'btn btn-lang' + (cur === 'hi' ? ' is-selected' : ''), onclick: () => pick('hi') }, 'हिंदी')
  );
}

export function whoScreen() {
  const cfg = store.getConfig();
  const current = store.getSettings().worker;
  const pick = (name) => {
    store.updateSettings({ worker: name });
    nav.goHome();
  };

  const input = h('input', { class: 'input', type: 'text', maxlength: 40, autocomplete: 'off', placeholder: t('typeName') });
  const saveTyped = () => {
    const v = input.value.trim();
    if (v) pick(v);
    else input.focus();
  };
  input.addEventListener('keydown', (e) => e.key === 'Enter' && saveTyped());
  const typeBox = h('div', { class: 'type-name', hidden: true }, input, h('button', { class: 'btn btn-primary', onclick: saveTyped }, t('saveName')));
  const showType = h('button', { class: 'btn-link', onclick: () => {
    typeBox.hidden = false;
    showType.hidden = true;
    input.focus();
  } }, icon('edit', 18), t('notInList'));

  return {
    flow: t('whoFlow'),
    tone: 'slate',
    back: !!current,
    heading: t('whoTitle'),
    sub: t('whoHelp'),
    body: [
      languagePicker(() => nav.replace('who')),
      h(
        'div',
        { class: 'stack' },
        cfg.workers.map((w) =>
          h('button', { class: 'person glass glow' + (w === current ? ' is-selected' : ''), onclick: () => pick(w) },
            h('span', { class: 'avatar' }, icon('user', 22)), w, h('span', { class: 'chev' }, icon('next', 20)))
        ),
        showType,
        typeBox
      ),
    ],
  };
}

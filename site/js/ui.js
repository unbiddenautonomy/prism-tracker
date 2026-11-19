// Small building blocks used by the screens: buttons, counters, number pad,
// pop-up questions and short messages.
import { t, getLang, nameOf } from './i18n.js';
import { fmtNum, round3, batchesLabel, findMaterial, findProduct, localYmd, addDays, shortDate, materialColor } from './recipes.js';
import { icon } from './icons.js';

// h('button', { class: 'btn', onclick: fn }, 'Text') -> a DOM element
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    Object.keys(props).forEach((k) => {
      const v = props[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'value') el.value = v;
      else if (k === 'style' && typeof v === 'object') Object.keys(v).forEach((p) => el.style.setProperty(p, v[p]));
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v === true ? '' : String(v));
    });
  }
  appendKids(el, kids);
  return el;
}

function appendKids(el, kids) {
  kids.flat(Infinity).forEach((c) => {
    if (c == null || c === false) return;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  });
}

export function dot(color) {
  return h('span', { class: 'dot', style: color ? { '--c': color } : null });
}


export function toast(msg, kind, ms) {
  const root = document.getElementById('toast-root');
  const el = h('div', { class: 'toast toast-' + (kind || 'info'), role: 'status' }, icon(kind === 'error' ? 'alert' : 'check', 18), msg);
  root.append(el);
  const wait = ms || 3000;
  setTimeout(() => el.classList.add('toast-out'), wait);
  setTimeout(() => el.remove(), wait + 400);
}

export function confirmDialog(opts) {
  return new Promise((resolve) => {
    let settled = false;
    // The phone's Back button should close the question, not leave the screen, so the
    // question gets a history step of its own. Answering gives that step back first
    // and only then tells the caller, so the screen never moves twice at once.
    const onKey = (ev) => ev.key === 'Escape' && close(false);
    const stopListening = () => {
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('keydown', onKey);
    };
    function onPop() {
      if (settled) return;
      settled = true;
      stopListening();
      overlay.remove();
      resolve(false);
    }
    function close(answer) {
      if (settled) return;
      settled = true;
      stopListening();
      overlay.remove();
      const after = () => {
        window.removeEventListener('popstate', after);
        resolve(answer);
      };
      window.addEventListener('popstate', after);
      history.back();
    }
    const noBtn = h('button', { class: 'btn', onclick: () => close(false) }, opts.no);
    const overlay = h(
      'div',
      { class: 'overlay', onclick: (e) => e.target === overlay && close(false) },
      h(
        'div',
        { class: 'dialog', role: 'dialog', 'aria-modal': 'true' },
        h('h2', { class: 'dialog-title' }, opts.title),
        opts.message ? h('p', { class: 'dialog-msg' }, opts.message) : null,
        opts.warning ? h('p', { class: 'dialog-warn' }, opts.warning) : null,
        h(
          'div',
          { class: 'dialog-actions' },
          h('button', { class: 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary'), onclick: () => close(true) }, opts.yes),
          noBtn
        )
      )
    );
    document.body.append(overlay);
    history.pushState({ depth: (history.state && history.state.depth) || 0 }, '', location.hash);
    window.addEventListener('popstate', onPop);
    document.addEventListener('keydown', onKey);
    noBtn.focus(); // the safe answer, and it puts a screen reader inside the question
  });
}

// Big  [ − ]  3  [ + ]  counter.
export function stepper(opts) {
  const min = opts.min == null ? 0 : opts.min;
  const max = opts.max == null ? 999 : opts.max;
  const step = opts.step || 1;
  let v = opts.value;
  const display = h('div', { class: 'stepper-value', 'aria-live': 'polite' });
  const minus = h('button', { class: 'stepper-btn', 'aria-label': t('less'), onclick: () => set(v - step) }, icon('minus', 26, 2));
  const plus = h('button', { class: 'stepper-btn', 'aria-label': t('more'), onclick: () => set(v + step) }, icon('plus', 26, 2));
  function draw() {
    display.textContent = fmtNum(v);
    minus.disabled = v <= min;
    plus.disabled = v >= max;
  }
  function set(n, silent) {
    v = Math.min(max, Math.max(min, round3(n)));
    draw();
    if (!silent && opts.onChange) opts.onChange(v);
  }
  draw();
  const el = h('div', { class: 'stepper glass' }, minus, display, plus);
  el.setValue = set;
  return el;
}

// Row of quick-pick buttons. options: [{ label, value }]
export function chips(options, current, onPick) {
  const row = h('div', { class: 'chips' });
  const buttons = options.map((o) => h('button', { class: 'chip', onclick: () => onPick(o.value) }, o.label));
  row.mark = (value) => buttons.forEach((b, i) => b.classList.toggle('is-selected', options[i].value === value));
  row.mark(current);
  appendKids(row, buttons);
  return row;
}

// Calculator-style keypad that edits a text value like "12.5".
export function numpad(opts) {
  let s = opts.value || '';
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
  function press(k) {
    if (k === '⌫') s = s.slice(0, -1);
    else if (k === '.') {
      if (s.indexOf('.') < 0) s = (s || '0') + '.';
    } else {
      if (s.replace('.', '').length >= 7) return;
      const dec = s.split('.')[1];
      if (dec != null && dec.length >= 3) return;
      s = s === '0' ? k : s + k;
    }
    opts.onChange(s);
  }
  const el = h(
    'div',
    { class: 'numpad' },
    keys.map((k) =>
      h('button', { class: 'numkey num' + (k === '⌫' ? ' numkey-back' : ''), 'aria-label': k === '⌫' ? t('backspace') : k, onclick: () => press(k) },
        k === '⌫' ? icon('backspace', 24) : k)
    )
  );
  el.setValue = (v) => {
    s = v;
  };
  return el;
}

// Two or three side-by-side choices.
export function segmented(options, current, onPick) {
  const wrap = h('div', { class: 'seg', role: 'group' });
  const buttons = options.map((o, i) =>
    h('button', { class: 'seg-btn' + (o.value === current ? ' is-selected' : ''), onclick: () => {
      buttons.forEach((b, j) => b.classList.toggle('is-selected', j === i));
      onPick(o.value);
    } }, o.label)
  );
  appendKids(wrap, buttons);
  return wrap;
}

// Today / Yesterday switch. Keeps any other date that an entry already has.
export function dayPicker(current, onPick, label) {
  const today = localYmd();
  const yesterday = addDays(today, -1);
  const lang = getLang();
  const opts = [
    { value: today, label: t('today') + ' · ' + shortDate(today, lang) },
    { value: yesterday, label: t('yesterday') + ' · ' + shortDate(yesterday, lang) },
  ];
  if (current !== today && current !== yesterday) opts.push({ value: current, label: shortDate(current, lang) });
  return h('div', { class: 'field' }, h('div', { class: 'label' }, label || t('when')), segmented(opts, current, onPick));
}

// "+ Add a note" that opens a text box.
export function noteField(value, onInput, open) {
  const area = h('textarea', { class: 'input note', rows: 2, maxlength: 300, placeholder: t('notePlaceholder'), oninput: (e) => onInput(e.target.value) });
  area.value = value || '';
  const show = open || !!value;
  const wrap = h('div', { class: 'field' });
  const link = h('button', { class: 'btn-link', onclick: () => {
    link.remove();
    wrap.append(area);
    area.focus();
  } }, icon('note', 18), t('addNote').replace(/^\+\s*/, ''));
  wrap.append(show ? area : link);
  return wrap;
}

// List of raw materials with amounts.
export function linesList(lines, config) {
  if (!lines.length) return h('div', { class: 'uses uses-empty glass' }, t('noRecipe'));
  return h(
    'div',
    { class: 'uses glass' },
    lines.map((l) => {
      const m = findMaterial(config, l.material);
      const color = materialColor(config, l.material);
      const name = m && nameOf(m) !== m.code ? nameOf(m) : '';
      return h('div', { class: 'uses-row' },
        h('span', { class: 'uses-code' }, dot(color), l.material, name ? h('small', null, name) : null),
        h('span', { class: 'uses-qty num' }, fmtNum(l.qty), h('small', null, l.unit || '')));
    })
  );
}

// Plain sentence for an entry, e.g. "3 batches of Product A".
export function describeEntry(e, config) {
  const lang = getLang();
  const product = findProduct(config, e.product);
  const pName = product ? nameOf(product) : e.product;
  if (e.type === 'production') return t('sumProduction', { batches: batchesLabel(e.batches, lang), product: pName });
  if (e.type === 'stock') {
    const m = findMaterial(config, e.material);
    return t(e.move === 'out' ? 'sumStockOut' : 'sumStockIn', { qty: fmtNum(e.qty) + ' ' + (e.unit || ''), material: m ? nameOf(m) : e.material });
  }
  if (e.material) {
    const m = findMaterial(config, e.material);
    return t('sumWasteMat', { qty: fmtNum(e.qty) + ' ' + (e.unit || ''), material: m ? nameOf(m) : e.material });
  }
  return t('sumWasteProd', { batches: batchesLabel(e.batches, lang), product: pName });
}

// Status line that main.js keeps up to date.
export function syncBadge() {
  return h('div', { class: 'sync-badge', 'data-sync-badge': '' });
}

export function entryBadge(id) {
  return h('span', { class: 'entry-badge', 'data-entry-badge': id });
}

export function steps(n, total) {
  return h(
    'div',
    { class: 'steps', 'aria-label': t('stepOf', { n, total }) },
    Array.from({ length: total }, (_, i) => h('span', { class: 'step-dot' + (i < n ? ' on' : '') })),
    h('span', { class: 'steps-text' }, t('stepOf', { n, total }))
  );
}

// "Waste / Spill": 1) what  2) how much  3) why -> save.
import { h, stepper, numpad, segmented, dayPicker, noteField, linesList, toast, steps, describeEntry, dot } from '../ui.js';
import { t, getLang, nameOf } from '../i18n.js';
import { WASTE_REASONS, findMaterial, findProduct, linesForBatches, fmtNum, round3, localYmd, materialColor, productColor } from '../recipes.js';
import { icon, REASON_ICONS } from '../icons.js';
import * as store from '../store.js';
import * as nav from '../nav.js';
import * as sync from '../sync.js';
import { productGrid } from './production.js';

let draft = null;

function fresh() {
  return { kind: null, material: null, product: null, amount: '', unitMode: -1, batches: 1, reason: null, note: '', date: localYmd(), editId: null };
}

export function startWaste() {
  draft = fresh();
  nav.go('waste');
}

export function resetWasteDraft() {
  draft = fresh();
}

export function openWasteFromEntry(entry, opts) {
  const o = opts || {};
  const cfg = store.getConfig();
  const d = fresh();
  d.editId = o.asNew ? null : entry.id;
  d.date = entry.date;
  d.reason = entry.reason || null;
  d.note = entry.note || '';
  if (entry.material) {
    d.kind = 'material';
    d.material = entry.material;
    const m = findMaterial(cfg, entry.material);
    const idx = m ? (m.containers || []).findIndex((c) => c.name === entry.enteredContainer) : -1;
    if (idx >= 0 && entry.enteredCount) {
      d.unitMode = idx;
      d.amount = String(entry.enteredCount);
    } else {
      d.amount = String(entry.qty || '');
    }
  } else {
    d.kind = 'product';
    d.product = entry.product;
    d.batches = Number(entry.batches) || 1;
  }
  draft = d;
  const path = o.step === 'reason' ? 'waste/reason' : 'waste/amount';
  if (o.replace) nav.replace(path);
  else nav.go(path);
}

export function wasteScreen(step) {
  if (!draft) draft = fresh();
  if (step === 'material') return materialPick();
  if (step === 'product') return productPick();
  if (step === 'amount') return amountStep();
  if (step === 'reason') return reasonStep();
  return kindPick();
}

const base = (extra) => Object.assign({ flow: t('tileWaste'), tone: 'orange' }, extra);

function kindCard(iconName, title, sub, onclick) {
  return h(
    'button',
    { class: 'kind glass glow', onclick },
    h('span', { class: 'action-icon' }, icon(iconName, 26)),
    h('span', null, h('div', { class: 'action-title' }, title), h('div', { class: 'kind-sub' }, sub)),
    h('span', { class: 'chev', style: { color: 'var(--text-3)' } }, icon('next', 20))
  );
}

function kindPick() {
  const cfg = store.getConfig();
  const codes = cfg.materials.map((m) => m.code).join(' · ');
  return base({
    steps: steps(1, 3),
    heading: t('wasteWhat'),
    body: [
      h(
        'div',
        { class: 'actions' },
        kindCard('barrel', t('wasteRaw'), codes, () => {
          draft.kind = 'material';
          nav.go('waste/material');
        }),
        kindCard('box', t('wasteProduct'), t('wasteProductSub'), () => {
          draft.kind = 'product';
          nav.go('waste/product');
        })
      ),
    ],
  });
}

function materialPick() {
  const cfg = store.getConfig();
  return base({
    steps: steps(1, 3),
    heading: t('whichMaterial'),
    body: [
      h(
        'div',
        { class: 'grid3' },
        cfg.materials.map((m) =>
          h(
            'button',
            { class: 'mcard glass glow' + (m.code === draft.material ? ' is-selected' : ''), style: { '--c': m.color }, onclick: () => {
              if (draft.material !== m.code) {
                draft.amount = '';
                draft.unitMode = -1;
              }
              draft.material = m.code;
              draft.kind = 'material';
              nav.go('waste/amount');
            } },
            h('span', { class: 'mcard-code' }, dot(m.color), m.code),
            nameOf(m) !== m.code ? h('span', { class: 'prow-note' }, nameOf(m)) : null
          )
        )
      ),
    ],
  });
}

function productPick() {
  const cfg = store.getConfig();
  return base({
    steps: steps(1, 3),
    heading: t('whichProductWaste'),
    body: cfg.products.length
      ? productGrid(cfg.products, (p) => {
          if (draft.product !== p.name) draft.batches = 1;
          draft.product = p.name;
          draft.kind = 'product';
          nav.go('waste/amount');
        }, draft.product, cfg)
      : [h('div', { class: 'empty' }, t('noProducts'))],
  });
}

// Amount in the material's base unit (kg etc.), taking containers into account.
function materialQty(m) {
  const n = parseFloat(draft.amount);
  if (!(n > 0)) return 0;
  const c = draft.unitMode >= 0 ? (m.containers || [])[draft.unitMode] : null;
  return round3(c ? n * c.size : n);
}

function amountStep() {
  const cfg = store.getConfig();
  if (draft.kind === 'material') {
    const m = findMaterial(cfg, draft.material);
    if (!m) {
      nav.replace('waste');
      return null;
    }
    return materialAmount(m);
  }
  const p = findProduct(cfg, draft.product);
  if (draft.kind !== 'product' || !p) {
    nav.replace('waste');
    return null;
  }
  return productAmount(p, cfg);
}

function materialAmount(m) {
  const containers = m.containers || [];
  const display = h('div', { class: 'amount-value' });
  const unitLabel = h('div', { class: 'amount-unit' });
  const convert = h('div', { class: 'amount-convert' });
  const nextBtn = h('button', { class: 'btn btn-primary btn-big', onclick: () => nav.go('waste/reason') });
  const pad = numpad({
    value: draft.amount,
    onChange: (s) => {
      draft.amount = s;
      draw();
    },
  });

  function draw() {
    const c = draft.unitMode >= 0 ? containers[draft.unitMode] : null;
    display.textContent = draft.amount || '0';
    display.classList.toggle('is-empty', !draft.amount);
    unitLabel.textContent = c ? nameOf(c) : m.unit;
    const qty = materialQty(m);
    convert.textContent = c && qty ? '= ' + fmtNum(qty) + ' ' + m.unit : '';
    nextBtn.disabled = !(qty > 0);
    nextBtn.replaceChildren(qty > 0 ? t('next') : t('enterAmount'), qty > 0 ? icon('next', 20, 2.25) : null);
  }

  const body = [];
  if (containers.length) {
    const opts = [{ value: -1, label: m.unit }].concat(
      containers.map((c, i) => ({ value: i, label: nameOf(c) + ' (' + fmtNum(c.size) + ' ' + m.unit + ')' }))
    );
    body.push(h('div', { class: 'field' }, h('div', { class: 'label' }, t('countIn')), segmented(opts, draft.unitMode, (v) => {
      draft.unitMode = v;
      draw();
    })));
  }
  body.push(h('div', { class: 'amount glass' }, display, unitLabel), convert, pad);
  draw();
  return base({
    steps: steps(2, 3),
    heading: t('howMuch', { name: nameOf(m) }),
    headingColor: m.color,
    body,
    footer: nextBtn,
  });
}

function productAmount(p, cfg) {
  const usesBox = h('div');
  const nextBtn = h('button', { class: 'btn btn-primary btn-big', onclick: () => nav.go('waste/reason') }, t('next'), icon('next', 20, 2.25));
  const counter = stepper({
    value: draft.batches,
    min: 0.5,
    max: 999,
    step: 0.5,
    onChange: (v) => {
      draft.batches = v;
      draw();
    },
  });
  function draw() {
    usesBox.replaceChildren(linesList(linesForBatches(p, draft.batches, cfg.materials), cfg));
  }
  draw();
  return base({
    steps: steps(2, 3),
    heading: t('howManySpoiled'),
    headingColor: p.color,
    sub: nameOf(p),
    body: [counter, h('div', { class: 'label' }, t('rawLost')), usesBox],
    footer: nextBtn,
  });
}

function buildFields(cfg) {
  if (draft.kind === 'material') {
    const m = findMaterial(cfg, draft.material);
    const c = draft.unitMode >= 0 ? (m.containers || [])[draft.unitMode] : null;
    const qty = materialQty(m);
    const count = parseFloat(draft.amount);
    return {
      type: 'waste',
      material: m.code,
      qty,
      unit: m.unit,
      entered: c ? fmtNum(count) + ' × ' + c.name + ' (' + fmtNum(c.size) + ' ' + m.unit + ')' : '',
      enteredCount: c ? count : null,
      enteredContainer: c ? c.name : '',
      product: '',
      batches: null,
      lines: [{ material: m.code, qty, unit: m.unit }],
    };
  }
  const p = findProduct(cfg, draft.product);
  return {
    type: 'waste',
    material: '',
    qty: null,
    unit: '',
    entered: '',
    enteredCount: null,
    enteredContainer: '',
    product: p.name,
    batches: draft.batches,
    lines: linesForBatches(p, draft.batches, cfg.materials),
  };
}

function reasonStep() {
  const cfg = store.getConfig();
  const valid =
    (draft.kind === 'material' && findMaterial(cfg, draft.material) && materialQty(findMaterial(cfg, draft.material)) > 0) ||
    (draft.kind === 'product' && findProduct(cfg, draft.product));
  if (!valid) {
    nav.replace('waste');
    return null;
  }
  const preview = buildFields(cfg);
  const saveBtn = h('button', { class: 'btn btn-primary btn-big', onclick: save });
  const noteHint = h('div', { class: 'hint' });
  const noteBox = h('div');

  function drawNote() {
    noteBox.replaceChildren(noteField(draft.note, (v) => {
      draft.note = v;
      draw();
    }, draft.reason === 'other'));
  }
  function draw() {
    const needNote = draft.reason === 'other' && !draft.note.trim();
    saveBtn.disabled = !draft.reason || needNote;
    const ready = draft.reason && !needNote;
    saveBtn.replaceChildren(ready ? icon('check', 20, 2.25) : null,
      !draft.reason ? t('pickReason') : needNote ? t('otherNeedsNote') : draft.editId ? t('saveChanges') : t('saveWaste'));
    noteHint.textContent = needNote ? t('otherNeedsNote') : '';
  }

  const tiles = WASTE_REASONS.map((r) =>
    h(
      'button',
      { class: 'reason glass glow' + (draft.reason === r.key ? ' is-selected' : ''), onclick: () => {
        draft.reason = r.key;
        tiles.forEach((b, i) => b.classList.toggle('is-selected', WASTE_REASONS[i].key === r.key));
        if (r.key === 'other') drawNote();
        draw();
      } },
      h('span', { class: 'action-icon' }, icon(REASON_ICONS[r.key], 22)),
      h('span', null, getLang() === 'hi' ? r.hi : r.en)
    )
  );

  function save() {
    saveBtn.disabled = true;
    try {
      const fields = Object.assign(buildFields(cfg), { reason: draft.reason, note: draft.note.trim(), date: draft.date });
      const isEdit = !!draft.editId;
      const entry = isEdit ? store.updateEntry(draft.editId, fields) : store.addEntry(fields);
      draft = null;
      sync.syncNow();
      nav.replace('saved/' + entry.id + (isEdit ? '/edit' : '/new'));
    } catch (err) {
      console.error(err);
      saveBtn.disabled = false;
      toast(err.message === 'storage-full' ? t('storageFull') : t('errorGeneric'), 'error', 6000);
    }
  }

  drawNote();
  draw();
  return base({
    steps: steps(3, 3),
    heading: t('whyWasted'),
    body: [
      h('div', { class: 'summary glass' },
        h('div', { class: 'summary-text' }, dot(preview.material ? materialColor(cfg, preview.material) : productColor(cfg, preview.product)), describeEntry(preview, cfg))),
      draft.kind === 'product' ? linesList(preview.lines, cfg) : null,
      h('div', { class: 'grid2' }, tiles),
      noteHint,
      noteBox,
      dayPicker(draft.date, (d) => (draft.date = d), t('whenWaste')),
    ],
    footer: saveBtn,
  });
}

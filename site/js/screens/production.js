// "Batches made": pick product -> how many batches -> save.
import { h, stepper, chips, dayPicker, noteField, linesList, toast } from '../ui.js';
import { t, getLang, nameOf, noteOf } from '../i18n.js';
import { findProduct, linesForBatches, batchesLabel, localYmd } from '../recipes.js';
import { icon } from '../icons.js';
import * as store from '../store.js';
import * as nav from '../nav.js';
import * as sync from '../sync.js';

let draft = null;

function fresh() {
  return { product: null, batches: 1, date: localYmd(), note: '', editId: null };
}

export function startProduction() {
  draft = fresh();
  nav.go('production');
}

export function resetProductionDraft() {
  draft = fresh();
}

export function openProductionFromEntry(entry, opts) {
  const o = opts || {};
  draft = {
    product: entry.product,
    batches: Number(entry.batches) || 1,
    date: entry.date,
    note: entry.note || '',
    editId: o.asNew ? null : entry.id,
  };
  if (o.replace) nav.replace('production/qty');
  else nav.go('production/qty');
}

// Product list: one big row per product, with its color on the left (also used by the waste flow).
export function productGrid(products, onPick, selectedName) {
  const grid = h('div', { class: 'plist' });
  const card = (p) =>
    h(
      'button',
      { class: 'prow glass glow' + (p.name === selectedName ? ' is-selected' : ''), style: { '--c': p.color }, onclick: () => onPick(p) },
      h('span', { class: 'prow-stripe' }),
      h('span', null, h('div', { class: 'prow-name' }, nameOf(p)), noteOf(p) ? h('div', { class: 'prow-note' }, noteOf(p)) : null),
      h('span', { class: 'chev' }, icon('next', 22))
    );
  const draw = (filter) => {
    const f = (filter || '').trim().toLowerCase();
    grid.replaceChildren(
      ...products.filter((p) => !f || p.name.toLowerCase().includes(f) || (p.name_hi || '').includes(f) || p.category.toLowerCase().includes(f)).map(card)
    );
  };
  draw('');
  const out = [];
  if (products.length > 8) {
    out.push(h('div', { class: 'search-wrap' }, icon('search', 18),
      h('input', { class: 'input search', type: 'search', placeholder: t('search'), oninput: (e) => draw(e.target.value) })));
  }
  out.push(grid);
  return out;
}

export function productionPickScreen() {
  if (!draft) draft = fresh();
  const cfg = store.getConfig();
  return {
    flow: t('tileProduction'),
    tone: 'green',
    heading: t('whichProduct'),
    body: cfg.products.length
      ? productGrid(cfg.products, (p) => {
          if (draft.product !== p.name) draft.batches = 1;
          draft.product = p.name;
          nav.go('production/qty');
        }, draft.product, cfg)
      : [h('div', { class: 'empty' }, t('noProducts'))],
  };
}

export function productionQtyScreen() {
  const cfg = store.getConfig();
  const product = draft && findProduct(cfg, draft.product);
  if (!product) {
    nav.replace('production');
    return null;
  }
  const lang = getLang();
  const usesBox = h('div');
  const saveBtn = h('button', { class: 'btn btn-primary btn-big', onclick: save });

  const quick = chips([1, 2, 3, 4, 5, 10].map((n) => ({ label: String(n), value: n })), draft.batches, (n) => counter.setValue(n));
  const counter = stepper({
    value: draft.batches,
    min: 1,
    max: 999,
    onChange: (v) => {
      draft.batches = v;
      refresh();
    },
  });

  function refresh() {
    const lines = linesForBatches(product, draft.batches, cfg.materials);
    usesBox.replaceChildren(linesList(lines, cfg));
    saveBtn.disabled = !lines.length;
    saveBtn.replaceChildren(icon('check', 20, 2.25), draft.editId ? t('saveChanges') : t('saveWhat', { what: batchesLabel(draft.batches, lang) }));
    quick.mark(draft.batches);
  }

  function save() {
    saveBtn.disabled = true;
    try {
      const fields = {
        type: 'production',
        product: product.name,
        batches: draft.batches,
        date: draft.date,
        note: draft.note.trim(),
        lines: linesForBatches(product, draft.batches, cfg.materials),
        material: '',
        qty: null,
        unit: '',
        entered: '',
        reason: '',
      };
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

  refresh();
  return {
    flow: t('tileProduction'),
    tone: 'green',
    heading: nameOf(product),
    headingColor: product.color,
    sub: noteOf(product),
    body: [
      h('div', { class: 'label' }, t('howManyBatches')),
      counter,
      quick,
      h('div', { class: 'label' }, t('willUse')),
      usesBox,
      dayPicker(draft.date, (d) => (draft.date = d), t('when')),
      noteField(draft.note, (v) => (draft.note = v)),
    ],
    footer: saveBtn,
  };
}

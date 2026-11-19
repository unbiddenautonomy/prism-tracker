// Admin: the products and what ONE batch of each uses.
//   #/recipes        every product; tap one to change it
//   #/recipes/edit   add or change one (behind the owner PIN)
// The amounts live in the Recipes tab of the Google Sheet, so this needs internet.
// Entries already recorded keep the amounts they were recorded with.
import { h, toast, confirmDialog, dot, syncBadge } from '../ui.js';
import { t, nameOf } from '../i18n.js';
import { findProduct, findMaterial, fmtNum, round3 } from '../recipes.js';
import { icon } from '../icons.js';
import * as store from '../store.js';
import * as nav from '../nav.js';
import * as sync from '../sync.js';
import * as lock from '../lock.js';

let draft = null;

function freshDraft(p) {
  const amounts = {};
  if (p) Object.keys(p.recipe || {}).forEach((code) => (amounts[code] = String(p.recipe[code])));
  return {
    original: p ? p.name : '', // empty = a brand new product
    name: p ? p.name : '',
    name_hi: p ? p.name_hi : '',
    batchNote: p ? p.batchNote : '',
    batchNote_hi: p ? p.batchNote_hi : '',
    category: p ? p.category : '',
    amounts,
  };
}

export function recipesScreen(args) {
  return args && args[0] === 'edit' ? editScreen() : listScreen();
}

// One line like "Y1 0.8 kg · Y5 0.3 kg"
function recipeLine(p, cfg) {
  const codes = Object.keys(p.recipe || {});
  if (!codes.length) return t('recipeNoAmounts');
  return codes
    .map((code) => {
      const m = findMaterial(cfg, code);
      return code + ' ' + fmtNum(p.recipe[code]) + (m && m.unit ? ' ' + m.unit : '');
    })
    .join(' · ');
}

// ---------------- list ----------------

function listScreen() {
  const cfg = store.getConfig();
  const connected = !!store.sheetConnection().url;
  const open = (p) => {
    // Recipes live in the sheet; without it there is nothing to write to.
    if (!connected) return toast(t('recipeNeedsSheet'), 'error', 5000);
    draft = freshDraft(p);
    nav.go('recipes/edit');
  };
  return {
    flow: t('setRecipes'),
    tone: 'green',
    heading: t('recipesTitle'),
    sub: connected ? t('recipesHelp') : null,
    body: [
      connected ? null : h('div', { class: 'warn-box' }, t('recipeNeedsSheet')),
      cfg.products.length
        ? h(
            'div',
            { class: 'stack' },
            cfg.products.map((p) =>
              h(
                'button',
                { class: 'prow glass glow', style: { '--c': p.color }, onclick: () => open(p) },
                h('span', { class: 'prow-stripe' }),
                h('span', null, h('div', { class: 'prow-name' }, nameOf(p)), h('div', { class: 'prow-note' }, recipeLine(p, cfg))),
                h('span', { class: 'chev' }, icon('edit', 20))
              )
            )
          )
        : h('div', { class: 'empty' }, t('recipeEmpty')),
      connected ? h('button', { class: 'btn btn-primary btn-big', onclick: () => open(null) }, icon('plus', 20, 2.25), t('recipeAdd')) : null,
      syncBadge(),
    ],
  };
}

// ---------------- add / change one ----------------

function editScreen() {
  if (!draft) {
    nav.replace('recipes');
    return null;
  }
  if (!lock.isUnlocked()) return lock.pinScreen({ flow: t('setRecipes'), tone: 'green', goTo: 'recipes/edit' });
  lock.keepUnlocked();

  const cfg = store.getConfig();
  const isNew = !draft.original;
  const saveBtn = h('button', { class: 'btn btn-primary btn-big', onclick: save });
  const warn = h('div', { class: 'hint center' });

  const nameInput = h('input', { class: 'input', type: 'text', maxlength: 60, value: draft.name, autocomplete: 'off', placeholder: t('recipeName') });
  nameInput.addEventListener('input', () => {
    draft.name = nameInput.value;
    draw();
  });
  const hiInput = h('input', { class: 'input', type: 'text', maxlength: 60, value: draft.name_hi, autocomplete: 'off' });
  hiInput.addEventListener('input', () => (draft.name_hi = hiInput.value));
  const noteInput = h('input', { class: 'input', type: 'text', maxlength: 60, value: draft.batchNote, autocomplete: 'off', placeholder: t('recipeNotePlaceholder') });
  noteInput.addEventListener('input', () => (draft.batchNote = noteInput.value));

  // One row per raw material: the amount used in a single batch.
  const amountRow = (m) => {
    const input = h('input', {
      class: 'input num alert-input',
      type: 'text',
      inputmode: 'decimal',
      maxlength: 9,
      placeholder: '0',
      value: draft.amounts[m.code] || '',
      'aria-label': m.code,
    });
    input.addEventListener('input', () => {
      draft.amounts[m.code] = input.value;
      draw();
    });
    return h(
      'div',
      { class: 'alert-row recipe-row' },
      h('span', { class: 'stock-code' }, dot(m.color), m.code, nameOf(m) !== m.code ? h('small', null, nameOf(m)) : null),
      input,
      h('span', { class: 'alert-unit' }, m.unit)
    );
  };

  function amounts() {
    const out = {};
    cfg.materials.forEach((m) => {
      const v = Number(String(draft.amounts[m.code] || '').trim().replace(',', '.'));
      if (v > 0) out[m.code] = round3(v);
    });
    return out;
  }

  function problem() {
    if (!draft.name.trim()) return t('recipeNeedName');
    const clash = cfg.products.find((p) => p.name.toLowerCase() === draft.name.trim().toLowerCase());
    if (clash && clash.name !== draft.original) return t('recipeNameTaken', { name: clash.name });
    const bad = cfg.materials.some((m) => {
      const raw = String(draft.amounts[m.code] || '').trim();
      return raw !== '' && !(Number(raw.replace(',', '.')) >= 0);
    });
    if (bad) return t('recipeBadAmount');
    if (!Object.keys(amounts()).length) return t('recipeNeedAmount');
    return '';
  }

  function draw() {
    const why = problem();
    warn.textContent = why;
    saveBtn.disabled = !!why;
    saveBtn.replaceChildren(...(why ? [t('recipeSave')] : [icon('check', 20, 2.25), t('recipeSave')]));
  }

  async function save() {
    if (problem()) return;
    saveBtn.disabled = true;
    try {
      const name = draft.name.trim();
      // The new name is written BEFORE the old row goes. If the signal drops between
      // the two, the worst case is the product listed twice, which is easy to see and
      // to fix; the other order would lose the recipe altogether.
      await sync.saveProduct({
        name,
        name_hi: draft.name_hi.trim(),
        batchNote: draft.batchNote.trim(),
        batchNote_hi: draft.batchNote_hi,
        category: draft.category,
        recipe: amounts(),
      });
      if (draft.original && draft.original !== name) await sync.deleteProduct(draft.original);
      toast(t('recipeSaved', { name }));
      draft = null;
      nav.back();
    } catch (err) {
      saveBtn.disabled = false;
      toast(t('recipeFail', { err: String((err && err.message) || err) }), 'error', 6000);
    }
  }

  async function remove() {
    const ok = await confirmDialog({
      title: t('recipeDeleteTitle', { name: draft.original }),
      message: t('recipeDeleteConfirm'),
      yes: t('yesDelete'),
      no: t('noKeep'),
      danger: true,
    });
    if (!ok) return;
    try {
      await sync.deleteProduct(draft.original);
      toast(t('recipeRemoved', { name: draft.original }));
      draft = null;
      nav.back();
    } catch (err) {
      toast(t('recipeFail', { err: String((err && err.message) || err) }), 'error', 6000);
    }
  }

  draw();
  const product = findProduct(cfg, draft.original);
  return {
    flow: t('setRecipes'),
    tone: 'green',
    heading: isNew ? t('recipeAdd') : nameOf(product) || draft.original,
    headingColor: product ? product.color : null,
    body: [
      h('div', { class: 'field' }, h('div', { class: 'label' }, t('recipeName')), nameInput),
      h('div', { class: 'field' }, h('div', { class: 'label' }, t('recipeNameHi')), hiInput),
      h('div', { class: 'field' }, h('div', { class: 'label' }, t('recipeNote')), noteInput),
      h('div', { class: 'label' }, t('recipePerBatch')),
      h('p', { class: 'hint' }, t('recipePerBatchHelp')),
      h('div', { class: 'card glass' }, cfg.materials.map(amountRow)),
      warn,
      isNew ? null : h('button', { class: 'btn btn-danger-outline', onclick: remove }, icon('trash', 18), t('recipeDelete')),
      isNew ? null : h('p', { class: 'hint' }, t('recipeDeleteSafe')),
    ],
    footer: saveBtn,
  };
}

// Big "Saved ✓" screen with Undo, shown after every save.
import { h, describeEntry, linesList, entryBadge, toast } from '../ui.js';
import { t } from '../i18n.js';
import { icon } from '../icons.js';
import * as store from '../store.js';
import * as nav from '../nav.js';
import * as sync from '../sync.js';
import { openProductionFromEntry, resetProductionDraft } from './production.js';
import { openWasteFromEntry, resetWasteDraft } from './waste.js';

const UNDO_SECONDS = 10;

export function savedScreen(args) {
  const id = args[0];
  const isNew = args[1] === 'new';
  const entry = store.getEntry(id);
  if (!entry || entry.status === 'deleted') {
    nav.goHome();
    return null;
  }
  const cfg = store.getConfig();
  const isWaste = entry.type === 'waste';
  const tone = isWaste ? 'orange' : 'green';

  let left = UNDO_SECONDS;
  const undoLabel = h('span', { class: 'num' }, t('undo', { s: left }));
  const undoBtn = h('button', { class: 'btn btn-undo', onclick: undo }, icon('undo', 18), undoLabel);
  const timer = setInterval(() => {
    if (!undoBtn.isConnected) return clearInterval(timer);
    left -= 1;
    if (left <= 0) {
      clearInterval(timer);
      undoBtn.remove();
    } else {
      undoLabel.textContent = t('undo', { s: left });
    }
  }, 1000);

  function undo() {
    clearInterval(timer);
    const snapshot = Object.assign({}, entry);
    store.deleteEntry(entry.id);
    sync.syncNow();
    toast(t('undone'));
    if (isWaste) openWasteFromEntry(snapshot, { asNew: true, replace: true, step: 'reason' });
    else openProductionFromEntry(snapshot, { asNew: true, replace: true });
  }

  function another() {
    clearInterval(timer);
    if (isWaste) resetWasteDraft();
    else resetProductionDraft();
    nav.backToDepth(1); // first screen of the same flow
  }

  return {
    flow: isWaste ? t('tileWaste') : t('tileProduction'),
    tone,
    back: false,
    body: [
      h(
        'div',
        { class: 'saved' },
        h('div', { class: 'saved-check', 'aria-hidden': 'true' }, icon('check', 48, 2.5)),
        h('div', { class: 'saved-title' }, t('saved')),
        h('div', { class: 'saved-text' }, describeEntry(entry, cfg)),
        entryBadge(entry.id),
        isWaste && entry.material ? null : linesList(entry.lines, cfg)
      ),
      isNew ? undoBtn : null,
    ],
    footer: h(
      'div',
      { class: 'footer-stack' },
      h('button', { class: 'btn btn-primary btn-big', onclick: () => {
        clearInterval(timer);
        nav.goHome();
      } }, t('done')),
      isNew ? h('button', { class: 'btn', onclick: another }, icon('plus', 18), t('another')) : null
    ),
  };
}

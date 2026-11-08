// Today's entries on this phone, with Change and Delete.
import { h, describeEntry, entryBadge, confirmDialog, toast, syncBadge } from '../ui.js';
import { t, getLang, reasonLabel } from '../i18n.js';
import { localYmd, shortDate, productColor, materialColor } from '../recipes.js';
import { icon, REASON_ICONS } from '../icons.js';
import * as store from '../store.js';
import * as nav from '../nav.js';
import * as sync from '../sync.js';
import { openProductionFromEntry } from './production.js';
import { openWasteFromEntry } from './waste.js';

function entryCard(e, cfg) {
  const isWaste = e.type === 'waste';
  const today = localYmd();
  const color = e.material ? materialColor(cfg, e.material) : productColor(cfg, e.product);
  const del = async () => {
    const ok = await confirmDialog({
      title: t('confirmDelete'),
      message: describeEntry(e, cfg),
      yes: t('yesDelete'),
      no: t('noKeep'),
      danger: true,
    });
    if (!ok) return;
    store.deleteEntry(e.id);
    sync.syncNow();
    toast(t('deletedToast'));
    nav.replace('log');
  };
  const change = () => (isWaste ? openWasteFromEntry(e) : openProductionFromEntry(e));
  return h(
    'div',
    { class: 'entry glass', style: { '--c': color } },
    h(
      'div',
      { class: 'entry-top' },
      h('span', { class: 'entry-type', style: { color: isWaste ? 'var(--amber)' : 'var(--emerald)' } }, icon(isWaste ? 'drop' : 'flask', 16)),
      h('span', { class: 'num' }, e.time, e.date !== today ? ' · ' + t('forDate', { date: shortDate(e.date, getLang()) }) : ''),
      h('span', { class: 'entry-worker' }, e.worker)
    ),
    h('div', { class: 'entry-text' }, describeEntry(e, cfg)),
    isWaste ? h('div', { class: 'entry-reason' }, icon(REASON_ICONS[e.reason] || 'dots', 16), reasonLabel(e.reason) + (e.note ? ' · ' + e.note : '')) : null,
    !isWaste && e.note ? h('div', { class: 'entry-reason' }, icon('note', 16), e.note) : null,
    entryBadge(e.id),
    h(
      'div',
      { class: 'entry-actions' },
      h('button', { class: 'btn', onclick: change }, icon('edit', 16), t('change')),
      h('button', { class: 'btn btn-danger-outline', onclick: del }, icon('trash', 16), t('delete'))
    )
  );
}

export function logScreen() {
  const cfg = store.getConfig();
  const list = store.todayEntries();
  return {
    flow: t('tileLog'),
    tone: 'blue',
    heading: t('logTitle'),
    sub: t('logHelp'),
    body: [
      list.length ? h('div', { class: 'stack' }, list.map((e) => entryCard(e, cfg))) : h('div', { class: 'empty' }, t('logEmpty')),
      h('p', { class: 'hint row' }, icon('lock', 14), t('logLocked')),
      syncBadge(),
    ],
  };
}

// Home: a greeting and three big actions. Numbers and charts live in Report.
import { h, syncBadge } from '../ui.js';
import { t, getLang } from '../i18n.js';
import { prettyDate, localYmd } from '../recipes.js';
import { icon } from '../icons.js';
import * as store from '../store.js';
import * as nav from '../nav.js';
import { startProduction } from './production.js';
import { startWaste } from './waste.js';
import { openReport } from './report-view.js';

function action(o) {
  return h(
    'button',
    { class: 'action glass glow', style: { '--a': o.color }, onclick: o.onclick },
    h('span', { class: 'action-icon' }, icon(o.icon, 26)),
    h('span', null,
      h('div', { class: 'action-title' }, o.title, o.badge ? h('span', { class: 'action-badge num' }, String(o.badge)) : null),
      h('div', { class: 'action-sub' }, o.sub)),
    h('span', { class: 'chev' }, icon('next', 22))
  );
}

export function homeScreen() {
  const s = store.getSettings();
  const n = store.todayEntries().length;
  return {
    flow: store.getConfig().appName,
    tone: 'slate',
    back: false,
    body: [
      h(
        'div',
        { class: 'hello' },
        h('div', { class: 'avatar' }, icon('user', 22)),
        h('div', { class: 'hello-text' },
          h('div', { class: 'eyebrow' }, prettyDate(localYmd(), getLang())),
          h('div', { class: 'hello-name' }, t('hello', { name: s.worker }))),
        h('button', { class: 'btn-mini', onclick: () => nav.go('who') }, t('changeWorker'))
      ),
      h(
        'div',
        { class: 'actions' },
        action({ color: '#00F5A0', icon: 'flask', title: t('tileProduction'), sub: t('tileProductionSub'), onclick: startProduction }),
        action({ color: '#FF9F00', icon: 'drop', title: t('tileWaste'), sub: t('tileWasteSub'), onclick: startWaste }),
        action({ color: '#3D8BFF', icon: 'list', title: t('tileLog'), sub: n ? t('todayCount', { n }) : t('tileLogSub'), badge: n, onclick: () => nav.go('log') })
      ),
      syncBadge(),
      h(
        'div',
        { class: 'duo' },
        h('button', { class: 'btn', onclick: openReport }, icon('chart', 18), t('report')),
        h('button', { class: 'btn', onclick: () => nav.go('settings') }, icon('sliders', 18), t('settings'))
      ),
    ],
  };
}

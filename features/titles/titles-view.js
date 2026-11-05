/* ================================================================
   🏆 称号一覧（#/titles、#/titles/<ツール>）。全ツールの称号をここに集めて並べる（2026-11-06にスタンプ帳を置き換えた）。
   獲得の判定と記録は今まで通り各ツールが行い、ここは読むだけ（js/titles.js）。
   まだの称号は名前を伏せ、条件だけを出す（何をすれば手に入るかが分かるように）。
   #/titles/<ツール> で開くと、そのツールだけに絞って表示する（各ツールの「称号一覧で見る」から）。
   旧スタンプ帳（#/stamps）も、この画面を開く。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { navigate } from '../../js/router.js';
import { notifyChanged } from '../../js/notices.js';
import { injectStylesheet } from '../bingo/bingo-view.js';
import { TITLE_TOOLS, toolTitles, titleTotals, markTitlesSeen } from '../../js/titles.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
let containerEl = null;
let filter = '';

export function mount(container, sub) {
  injectStylesheet();
  containerEl = container;
  filter = TITLE_TOOLS.some(x => x.key === sub) ? sub : '';
  const totals = titleTotals();
  markTitlesSeen(totals.earned);
  notifyChanged();
  container.innerHTML = '<div class="titles-view fun-view"></div>';
  render();
  root().addEventListener('click', onClick);
}
export function unmount() { containerEl = null; }
function root() { return containerEl && containerEl.querySelector('.titles-view'); }

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : t(`${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} に獲得`, `Earned ${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`);
}

function render() {
  const r = root();
  if (!r) return;
  const totals = titleTotals();
  const tools = TITLE_TOOLS.map(x => ({ ...x, list: toolTitles(x.key) }));
  const shown = filter ? tools.filter(x => x.key === filter) : tools;
  const recent = tools.flatMap(x => x.list.filter(i => i.earned && i.earnedAt).map(i => ({ ...i, tool: x }))).sort((a, b) => b.earnedAt.localeCompare(a.earnedAt)).slice(0, 3);
  r.innerHTML = `<div class="fun-wrap">
    <header class="fun-head">
      <h1 class="fun-h1"><svg class="inline-icon" width="22" height="22" aria-hidden="true"><use href="#i-trophy"/></svg>${t('称号一覧', 'Titles')}</h1>
      <p class="fun-lead">${t('各ツールで手に入れた称号を、ここにまとめています。まだの称号は名前が伏せてあり、手に入れる条件だけが見えます。', 'All the titles you’ve earned across the tools. Titles not yet earned show only how to get them.')}</p>
    </header>
    <div class="tl-total"><b>${totals.earned}</b><span>/ ${totals.total}</span><small>${t('の称号を獲得', 'titles earned')}</small>
      <span class="tl-bar" aria-hidden="true"><span style="width:${totals.total ? Math.round(totals.earned / totals.total * 100) : 0}%"></span></span></div>
    ${!filter && recent.length ? `<section class="fun-section"><h2 class="fun-h2">${t('最近の獲得', 'Recently earned')}</h2>
      <div class="tl-recent">${recent.map(i => `<span class="tl-recent-item"><span class="tl-recent-ic">${escapeHtml(i.icon)}</span><span><b>${escapeHtml(i.name)}</b><small>${escapeHtml(t(i.tool.ja, i.tool.en))}・${escapeHtml(fmtDate(i.earnedAt))}</small></span></span>`).join('')}</div></section>` : ''}
    <div class="fun-chips tl-filter" role="group" aria-label="${t('ツールで絞り込む', 'Filter by tool')}">
      <button type="button" class="fun-chip${!filter ? ' on' : ''}" data-act="filter" data-key="">${t('すべて', 'All')}</button>
      ${tools.map(x => `<button type="button" class="fun-chip${filter === x.key ? ' on' : ''}" data-act="filter" data-key="${x.key}">${escapeHtml(t(x.ja, x.en))}<span class="tl-chip-n">${x.list.filter(i => i.earned).length}/${x.list.length}</span></button>`).join('')}
    </div>
    ${shown.map(sectionHtml).join('')}
  </div>`;
}

function sectionHtml(x) {
  const n = x.list.filter(i => i.earned).length;
  return `<section class="fun-section tl-section">
    <div class="tl-sec-head">
      <h2 class="tl-sec-title"><svg class="inline-icon" width="17" height="17" aria-hidden="true"><use href="#${x.icon}"/></svg>${escapeHtml(t(x.ja, x.en))}<span>${n} / ${x.list.length}</span></h2>
      <button type="button" class="fun-btn small" data-act="go" data-route="${x.route}">${t('ツールを開く', 'Open tool')}<svg class="inline-icon" width="12" height="12"><use href="#i-chevron-right"/></svg></button>
    </div>
    <ul class="tl-grid">${x.list.map(i => `<li class="tl-item${i.earned ? ' on' : ''}">
      <span class="tl-ic" aria-hidden="true">${i.earned ? escapeHtml(i.icon) : '<svg class="inline-icon" width="18" height="18"><use href="#i-star"/></svg>'}</span>
      <span class="tl-text">
        <b>${i.earned ? escapeHtml(i.name) : t('？？？', '???')}</b>
        <small>${escapeHtml(i.desc)}</small>
        ${i.earned && i.earnedAt ? `<em>${escapeHtml(fmtDate(i.earnedAt))}</em>` : ''}
      </span>
    </li>`).join('')}</ul>
  </section>`;
}

function onClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  if (b.dataset.act === 'filter') { filter = b.dataset.key || ''; render(); return; }
  if (b.dataset.act === 'go') navigate(b.dataset.route, '');
}

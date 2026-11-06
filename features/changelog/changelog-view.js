/* ================================================================
   📝 更新履歴（#/changelog）。データは js/changelog-data.js、新しい版の判定は js/app-update.js。
   ・上に「お使いのバージョン」のカード。公開中の新しい版があれば、目立つ色で「今すぐ更新」を出す
     （まだ反映されていない版の内容も、下の一覧に「未反映」の印付きで先に見せる）。
   ・下はバージョンごとのカードを新しい順に並べる。種類（新機能・改善・修正・削除）で絞り込める。
     古いものは最初の8件だけ出し、「もっと見る」で続きを出す。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { navigate } from '../../js/router.js';
import { ROUTES } from '../../js/router-registry.js';
import { injectStylesheet } from '../bingo/bingo-view.js';
import { APP_VERSION, changelogList, pendingVersions, checkForUpdate, onUpdateChanged, startUpdate, typeLabel } from '../../js/app-update.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
const TYPES = ['new', 'improve', 'fix', 'remove'];
const FIRST_SHOWN = 8;
let containerEl = null;
let filter = '';
let showAll = false;
let checkState = ''; // '' | 'checking' | 'done'
let offUpdate = null;

export function mount(container) {
  injectStylesheet();
  containerEl = container;
  filter = '';
  showAll = false;
  checkState = '';
  container.innerHTML = '<div class="changelog-view fun-view"></div>';
  root().addEventListener('click', onClick);
  offUpdate = onUpdateChanged(render);
  render();
}
export function unmount() {
  if (offUpdate) offUpdate();
  offUpdate = null;
  containerEl = null;
}
function root() { return containerEl && containerEl.querySelector('.changelog-view'); }

const WD_JA = ['日', '月', '火', '水', '木', '金', '土'];
function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '';
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return t(`${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${WD_JA[d.getDay()]}）`, d.toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' }));
}

function statusHtml() {
  const pending = pendingVersions();
  if (pending.length) {
    const n = pending.reduce((s, v) => s + (v.items || []).length, 0);
    return `<section class="cl-status is-update" role="status">
      <span class="cl-status-ic" aria-hidden="true"><svg class="inline-icon" width="22" height="22"><use href="#i-sparkle"/></svg></span>
      <div class="cl-status-text">
        <p class="cl-status-title">${t('新しいバージョンがあります', 'A new version is available')}</p>
        <p class="cl-status-sub">${t(`Ver.${escapeHtml(pending[0].version)}（${n}件の変更）が公開されています。お使いの画面は Ver.${escapeHtml(APP_VERSION)} です。`, `Ver.${escapeHtml(pending[0].version)} (${n} changes) is out. You are on Ver.${escapeHtml(APP_VERSION)}.`)}</p>
      </div>
      <button type="button" class="cl-update-btn" data-act="update"><svg class="inline-icon" width="16" height="16"><use href="#i-sync"/></svg>${t('今すぐ更新', 'Update now')}</button>
      <p class="cl-status-note">${t('保存したデータは消えません', 'Your saved data is kept')}</p>
    </section>`;
  }
  const checkLabel = checkState === 'checking' ? t('確かめています…', 'Checking…') : checkState === 'done' ? t('最新です', 'Up to date') : t('最新か確かめる', 'Check for updates');
  return `<section class="cl-status">
    <span class="cl-status-ic" aria-hidden="true"><svg class="inline-icon" width="20" height="20"><use href="#i-check"/></svg></span>
    <div class="cl-status-text">
      <p class="cl-status-title">${t('お使いのバージョン', 'Your version')} <span class="cl-ver">Ver.${escapeHtml(APP_VERSION)}</span></p>
      <p class="cl-status-sub">${t('新しいバージョンが出ると、画面の下にお知らせが出ます。', 'A banner appears at the bottom when a new version is out.')}</p>
    </div>
    <button type="button" class="fun-btn small" data-act="check"${checkState === 'checking' ? ' disabled' : ''}><svg class="inline-icon" width="13" height="13"><use href="#i-sync"/></svg>${checkLabel}</button>
  </section>`;
}

function itemHtml(i) {
  const route = i.route && ROUTES[i.route] && i.route !== 'changelog' ? i.route : '';
  return `<li class="cl-item">
    <span class="cl-badge is-${escapeHtml(TYPES.includes(i.type) ? i.type : 'improve')}">${escapeHtml(typeLabel(i.type))}</span>
    <span class="cl-item-text">${escapeHtml(t(i.ja, i.en || i.ja))}</span>
    ${route ? `<button type="button" class="cl-open" data-act="open" data-route="${escapeHtml(route)}"${i.sub ? ` data-sub="${escapeHtml(i.sub)}"` : ''}>${t('開く', 'Open')}<svg class="inline-icon" width="12" height="12"><use href="#i-chevron-right"/></svg></button>` : ''}
  </li>`;
}

function versionHtml(v, idx) {
  const items = (v.items || []).filter(i => !filter || i.type === filter);
  if (!items.length) return '';
  const isCurrent = v.version === APP_VERSION;
  const isPending = v.version > APP_VERSION;
  return `<article class="cl-ver-card${isPending ? ' is-pending' : ''}${isCurrent ? ' is-current' : ''}">
    <header class="cl-ver-head">
      <h2 class="cl-ver-name">Ver.${escapeHtml(v.version)}</h2>
      ${isPending ? `<span class="cl-tag is-pending">${t('未反映', 'Not applied')}</span>` : ''}
      ${isCurrent ? `<span class="cl-tag is-current">${t('お使いの版', 'Current')}</span>` : ''}
      ${idx === 0 && !isPending && !isCurrent ? `<span class="cl-tag">${t('最新', 'Latest')}</span>` : ''}
      <time class="cl-ver-date" datetime="${escapeHtml(v.date || '')}">${escapeHtml(fmtDate(v.date))}</time>
    </header>
    <ul class="cl-items">${items.map(itemHtml).join('')}</ul>
  </article>`;
}

function render() {
  const r = root();
  if (!r) return;
  const list = changelogList();
  const counts = {};
  list.forEach(v => (v.items || []).forEach(i => { counts[i.type] = (counts[i.type] || 0) + 1; }));
  const visible = list.filter(v => (v.items || []).some(i => !filter || i.type === filter));
  const shown = showAll ? visible : visible.slice(0, FIRST_SHOWN);
  r.innerHTML = `<div class="fun-wrap">
    <header class="fun-head">
      <h1 class="fun-h1"><svg class="inline-icon" width="22" height="22" aria-hidden="true"><use href="#i-edit"/></svg>${t('更新履歴', 'Changelog')}</h1>
      <p class="fun-lead">${t('Skyツールに入った変更を、新しい順に載せています。', 'Every change to the Sky tools, newest first.')}</p>
    </header>
    ${statusHtml()}
    <div class="fun-chips cl-filter" role="group" aria-label="${t('種類で絞り込む', 'Filter by type')}">
      <button type="button" class="fun-chip${!filter ? ' on' : ''}" data-act="filter" data-type="">${t('すべて', 'All')}</button>
      ${TYPES.filter(k => counts[k]).map(k => `<button type="button" class="fun-chip${filter === k ? ' on' : ''}" data-act="filter" data-type="${k}"><span class="cl-dot is-${k}" aria-hidden="true"></span>${escapeHtml(typeLabel(k))}<span class="cl-chip-n">${counts[k]}</span></button>`).join('')}
    </div>
    <div class="cl-list">${shown.map(v => versionHtml(v, list.indexOf(v))).join('')}</div>
    ${!showAll && visible.length > FIRST_SHOWN ? `<button type="button" class="fun-btn cl-more" data-act="more">${t(`もっと見る（あと${visible.length - FIRST_SHOWN}件）`, `Show ${visible.length - FIRST_SHOWN} more`)}</button>` : ''}
  </div>`;
}

function onClick(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  if (act === 'filter') { filter = btn.dataset.type || ''; render(); return; }
  if (act === 'more') { showAll = true; render(); return; }
  if (act === 'open') { navigate(btn.dataset.route, btn.dataset.sub || ''); return; }
  if (act === 'update') {
    btn.disabled = true;
    btn.lastChild.textContent = t('更新しています…', 'Updating…');
    startUpdate();
    return;
  }
  if (act === 'check') {
    checkState = 'checking';
    render();
    checkForUpdate(true).then(() => { checkState = 'done'; render(); });
  }
}

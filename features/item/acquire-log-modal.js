/* ================================================================
   acquire-log-modal.js — アイテム獲得ログモーダル

   item/index.html の #acquireLogModal（openAcquireLog()/renderAcquireLog()
   系一式、「📅 アイテム獲得ログ」セクション）を tai-hub へ移植したもの。
   search-modal.js（横断アイテム検索モーダル）・wishlist-cost-modal.js
   （ウィッシュリスト・必要コスト計算）と同じ設計を踏襲する：document.body
   へ直接 .modal-overlay/.modal-card（css/chrome.css）を append する独立
   モーダルとして実装し、dashboard-view.js 等の既存ファイルは一切変更しない。

   ログ自体は js/state.js の getItemAcquireLog()/removeItemAcquireRecord()
   に委譲（itemAcquireLog_v1 キー・{[itemId]:{catKey,at}} という形状は
   完全互換、変更しない。所持チェックONで自動記録されるのは既に
   category-view.js/search-modal.js側で対応済み——このファイルは読み取り・
   削除・一覧表示のみを担当する）。

   ログには itemId と catKey しか無いため、表示名の解決には各カテゴリの
   data/items/<catKey>.js を動的importして該当idを探す（cost-view.js・
   wishlist-cost-modal.jsの画像ローダーと同じ「他ファイルに依存せず単体で
   完結させる」複製方針をここでも踏襲し、他モジュールとは共有しない）。

   対象は12種のウェアラブルカテゴリのみ（section:'special'の楽譜は対象外。
   楽譜専用ビューのmusic-sheet-view.jsはrecordItemAcquire()自体を呼ばない
   ため、実運用上もログには現れない）。

   ── エクスポート契約 ──────────────────────────────────────────
     export function open()  … モーダルを開く（初回のみ全カテゴリの
                                アイテムデータを読み込み、以後はキャッシュを再利用）
     export function close() … モーダルを閉じる
   ダッシュボードの「コスト管理」セクションから
   `import * as acquireLogModal from './acquire-log-modal.js'; acquireLogModal.open()`
   のように呼び出す想定（search-modal.js と同じ import-as-namespace の作法）。

   ── 元実装(item/index.html)との違い ────────────────────────────────
   1. 今月/今年の振り返りの画像シェア（getRecapStats/buildRecapExportCardEl/
      shareRecapOnTwitterの移植）は share/share-data.js の exportShareImage() を使う
      （Web Share API→画像プレビュー＋Xの投稿画面へ、のフォールバック込み）。
   2. 各行の「カテゴリ」表示はタップ可能なリンクにし、タップすると
      モーダルを閉じてそのカテゴリページ（#/item/<catKey>）へ遷移する
      ようにした。元実装はページ内モーダルだったため遷移の概念が無かったが、
      タスク指示の「各エントリがどのカテゴリに属するか識別・ジャンプできる
      ようにする」を満たすための、このモーダル固有の追加実装。
   3. カテゴリやアイテムが解決できない記録（該当カテゴリのアイテム一覧に
      そのidが存在しない等のデータ変更後の残骸）は一覧から除外する
      （元実装のgetAcquireLogEntries()と同一の防御的フィルタ）。
   上記以外（新しい順のソート、日時のロケール別フォーマット、削除ボタン、
   件数集計「記録件数／今月の入手数／今年の入手数」）は元実装のロジック・
   文言をそのまま移植している。
   ================================================================ */

import { CURRENT_LANG, trCat, trItem, escapeHtml } from '../../js/i18n.js';
import { getItemAcquireLog, removeItemAcquireRecord } from '../../js/state.js';
import { CATEGORY_REGISTRY } from './data/categories.js';
import { SHARE_THEMES, SITE_URL, RECAP_SHARE_HASHTAG, itemIconHtml, exportShareImage, showShareToast, injectShareSharedStyles } from './share/share-data.js';

// 12種のウェアラブルカテゴリのみ（section:'special'の楽譜は対象外。
// music-sheet-view.jsはrecordItemAcquire()を呼ばないため、ログにも現れない）
const GRID_CATEGORIES = CATEGORY_REGISTRY.filter(c => c.section === 'grid');

const STYLE_ID = 'acquire-log-modal-styles';
const OVERLAY_ID = 'acquireLogModalOverlay';

/* ================================================================
   各カテゴリのアイテムデータ読み込み（表示名・画像の解決専用。
   wishlist-cost-modal.jsの画像ローダーと同じ方式をこのファイル内に複製）
   ================================================================ */
const itemModuleCache = new Map();
function loadCategoryItemsModule(catKey) {
  if (!itemModuleCache.has(catKey)) {
    itemModuleCache.set(catKey, import(`./data/items/${catKey}.js`));
  }
  return itemModuleCache.get(catKey);
}
let itemsByCat = {}; // catKey -> {id: item}
let itemsLoadedPromise = null;
function loadAllItems() {
  if (itemsLoadedPromise) return itemsLoadedPromise;
  itemsLoadedPromise = Promise.all(GRID_CATEGORIES.map(async cat => {
    try {
      const mod = await loadCategoryItemsModule(cat.key);
      const map = {};
      (mod.ITEMS || []).forEach(it => { map[it.id] = it; });
      return [cat.key, map];
    } catch (e) {
      console.error(`[acquire log] failed to load item data: ${cat.key}`, e);
      return [cat.key, {}];
    }
  })).then(entries => {
    itemsByCat = Object.fromEntries(entries);
    return itemsByCat;
  });
  return itemsLoadedPromise;
}

/* ================================================================
   ログを cat/item 情報付きの配列に整形する（item/index.htmlの
   getAcquireLogEntries()と同一ロジック。カテゴリ改修等でitemsByCat側に
   存在しなくなったidは除外する）
   ================================================================ */
function getEntries() {
  const log = getItemAcquireLog();
  return Object.keys(log).map(itemId => {
    const rec = log[itemId];
    const cat = GRID_CATEGORIES.find(c => c.key === rec.catKey);
    const item = cat ? (itemsByCat[cat.key] || {})[itemId] : null;
    return (item && cat) ? { itemId, cat, item, at: rec.at } : null;
  }).filter(Boolean);
}

/* ================================================================
   モーダルの開閉
   ================================================================ */
let overlayEl = null;

export async function open() {
  injectStyles();
  document.getElementById(OVERLAY_ID)?.remove();

  overlayEl = document.createElement('div');
  overlayEl.className = 'modal-overlay';
  overlayEl.id = OVERLAY_ID;
  overlayEl.addEventListener('click', e => { if (e.target === overlayEl) close(); });
  overlayEl.innerHTML = renderModalHtml();
  document.body.appendChild(overlayEl);

  wireControls();
  requestAnimationFrame(() => overlayEl.classList.add('open'));

  showLoading();
  try {
    await loadAllItems();
    if (!overlayEl || !document.body.contains(overlayEl)) return; // 読み込み待ち中に閉じられていたら描画しない
    render();
  } catch (e) {
    console.error('[acquire log] failed to load item data', e);
    showLoadError();
  }
}

export function close() {
  document.getElementById(OVERLAY_ID)?.classList.remove('open');
}

/* ================================================================
   描画：モーダル外枠
   ================================================================ */
function renderModalHtml() {
  const en = CURRENT_LANG === 'en';
  return `
    <div class="modal-card alm-card">
      <button type="button" class="modal-close-btn" id="almCloseX" aria-label="${en ? 'Close' : '閉じる'}">
        <svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg>
      </button>
      <div class="modal-title">${en ? 'Acquisition Log' : 'アイテム獲得ログ'}</div>

      <div class="alm-hint">
        ${en
          ? 'Records the date/time you checked off each item as owned. Unchecking an item removes its record.'
          : '所持チェックを入れた日時を自動で記録します。チェックを外すと記録も消えます。'}
      </div>

      <div id="almBody"><!-- JS --></div>

      <div class="alm-done-row">
        <button type="button" class="alm-done-btn" id="almDoneBtn">${en ? 'Done' : '閉じる'}</button>
      </div>
    </div>`;
}

function wireControls() {
  const q = sel => overlayEl.querySelector(sel);
  q('#almCloseX').addEventListener('click', close);
  q('#almDoneBtn').addEventListener('click', close);

  const body = q('#almBody');
  // 削除ボタン・カテゴリジャンプリンクは再描画のたびにDOMごと差し替わるため、
  // 行単位でaddEventListenerし直すのではなく#almBody自体に1つだけ
  // 委譲リスナーを張る（search-modal.jsの#smResults委譲パターンと同じ）
  body.addEventListener('click', e => {
    const removeBtn = e.target.closest('[data-act="remove"]');
    if (removeBtn) {
      removeItemAcquireRecord(removeBtn.dataset.id);
      render();
      return;
    }
    const shareBtn = e.target.closest('[data-act="share-recap"]');
    if (shareBtn) {
      shareRecap(shareBtn.dataset.scope);
      return;
    }
    const jumpEl = e.target.closest('[data-act="jump"]');
    if (jumpEl) {
      e.preventDefault();
      close();
      location.hash = `#/item/${jumpEl.dataset.cat}`;
    }
  });
}

function showLoading() {
  const bodyEl = overlayEl?.querySelector('#almBody');
  if (bodyEl) bodyEl.innerHTML = `<div class="alm-empty">${CURRENT_LANG === 'en' ? 'Loading…' : '読み込み中…'}</div>`;
}

function showLoadError() {
  const bodyEl = overlayEl?.querySelector('#almBody');
  if (bodyEl) {
    bodyEl.innerHTML = `<div class="alm-empty">${CURRENT_LANG === 'en'
      ? 'Failed to load item data. Please try again.'
      : 'アイテムデータの読み込みに失敗しました。もう一度お試しください。'}</div>`;
  }
}

/* ================================================================
   日時フォーマット（item/index.htmlのfmtDateと同一）
   ================================================================ */
function fmtDate(iso) {
  const en = CURRENT_LANG === 'en';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return en
    ? d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ================================================================
   描画：本体（一覧・今月/今年の集計）
   ================================================================ */
function render() {
  if (!overlayEl) return;
  const bodyEl = overlayEl.querySelector('#almBody');
  if (!bodyEl) return;
  const en = CURRENT_LANG === 'en';

  const entries = getEntries();
  if (entries.length === 0) {
    bodyEl.innerHTML = `<div class="alm-empty">${en
      ? 'No records yet.<br>Checking off an item as owned on a category page will add it here.'
      : 'まだ記録がありません。<br>各カテゴリページで所持チェックを入れると、ここに記録されます。'}</div>`;
    return;
  }

  entries.sort((a, b) => new Date(b.at) - new Date(a.at));

  const listHtml = entries.map(e => `
    <div class="alm-row">
      <div class="alm-icon ${e.item.img ? '' : 'img-fallback'}">
        ${e.item.img ? `<img src="${e.item.img}" alt="${escapeHtml(trItem(e.item))}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('img-fallback')">` : ''}
        <span class="alm-icon-fallback"><svg class="inline-icon" width="18" height="18"><use href="#i-wing"/></svg></span>
      </div>
      <div class="alm-info">
        <div class="alm-name">${escapeHtml(trItem(e.item))}</div>
        <div class="alm-meta">
          <a href="#/item/${e.cat.key}" class="alm-cat-link" data-act="jump" data-cat="${e.cat.key}">${escapeHtml(trCat(e.cat.name))}</a>
          <span class="alm-meta-sep">・</span>${escapeHtml(fmtDate(e.at))}
        </div>
      </div>
      <button type="button" class="alm-remove-btn" data-act="remove" data-id="${e.itemId}" aria-label="${en ? 'Delete record' : '記録を削除'}">
        <svg class="inline-icon" width="15" height="15"><use href="#i-close"/></svg>
      </button>
    </div>`).join('');

  const now = new Date();
  const monthCount = entries.filter(e => {
    const d = new Date(e.at);
    return !isNaN(d.getTime()) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  const yearCount = entries.filter(e => {
    const d = new Date(e.at);
    return !isNaN(d.getTime()) && d.getFullYear() === now.getFullYear();
  }).length;

  bodyEl.innerHTML = `
    <div class="alm-list">${listHtml}</div>
    <div class="alm-total-box">
      <div class="alm-total-row"><span><svg class="inline-icon" width="16" height="16"><use href="#i-folder"/></svg> ${en ? 'Total recorded' : '記録件数'}</span><b>${entries.length}${en ? '' : ' 件'}</b></div>
      <div class="alm-total-row"><span><svg class="inline-icon" width="16" height="16"><use href="#i-calendar"/></svg> ${en ? 'Acquired this month' : '今月の入手数'}</span><b>${monthCount}${en ? '' : ' 件'}</b></div>
      <div class="alm-total-row"><span><svg class="inline-icon" width="16" height="16"><use href="#i-calendar"/></svg> ${en ? 'Acquired this year' : '今年の入手数'}</span><b>${yearCount}${en ? '' : ' 件'}</b></div>
    </div>
    <div class="alm-share-row">
      <button type="button" class="alm-share-btn" data-act="share-recap" data-scope="month">${en ? 'Share This Month’s Recap' : '今月の振り返りを画像でシェア'}</button>
      <button type="button" class="alm-share-btn" data-act="share-recap" data-scope="year">${en ? 'Share This Year’s Recap' : '今年の振り返りを画像でシェア'}</button>
    </div>`;
}

/* ================================================================
   📤 今月/今年の振り返りを画像でシェア（item/index.htmlの
   getRecapStats / buildRecapExportCardEl / buildRecapTweetText / shareRecapOnTwitter を移植）
   ================================================================ */
const RECAP_MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// 指定期間（'month'=今月 / 'year'=今年）に入手したアイテムを集計する（直近5件はカードのハイライト用）
function getRecapStats(scope) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const entries = getEntries().filter(e => {
    const d = new Date(e.at);
    if (isNaN(d.getTime())) return false;
    return scope === 'year' ? d.getFullYear() === y : (d.getFullYear() === y && d.getMonth() === m);
  });
  entries.sort((a, b) => new Date(b.at) - new Date(a.at));
  return { count: entries.length, recent: entries.slice(0, 5), year: y, month: m };
}

function buildRecapCardEl(scope) {
  const { count, recent, year, month } = getRecapStats(scope);
  const en = CURRENT_LANG === 'en';
  const periodTxt = scope === 'year' ? (en ? `${year}` : `${year}年`) : (en ? `${RECAP_MONTH_EN[month]} ${year}` : `${year}年${month + 1}月`);
  const labelTxt = scope === 'year' ? (en ? 'Items Acquired This Year' : '今年獲得したアイテム数') : (en ? 'Items Acquired This Month' : '今月獲得したアイテム数');
  const rows = recent.map(e => `
    <div class="ish-exp-row">
      <div class="ish-exp-icon">${itemIconHtml(e.cat, e.item)}</div>
      <div class="ish-exp-info">
        <div class="ish-exp-cat">${escapeHtml(trCat(e.cat.name))}</div>
        <div class="ish-exp-name">${escapeHtml(trItem(e.item))}</div>
      </div>
    </div>`).join('');
  const today = new Date();
  const dateTxt = en
    ? `Created ${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`
    : `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日作成`;
  const card = document.createElement('div');
  card.className = 'ish-export-card';
  card.style.background = SHARE_THEMES.orange.grad;
  card.innerHTML = `
    <div class="ish-exp-brand">${en ? 'Sky Item Collection Tracker' : 'Sky アイテム所持率管理'}</div>
    <div class="ish-exp-hero">
      <div class="ish-exp-hero-pct">${count}</div>
      <div class="ish-exp-hero-label">${labelTxt}</div>
      <div class="ish-exp-hero-nums">${escapeHtml(periodTxt)}</div>
    </div>
    ${rows
      ? `<div class="ish-exp-body">${rows}</div>`
      : `<div class="ish-exp-comment">${en ? 'No items recorded in this period yet' : 'この期間の記録はまだありません'}</div>`}
    <div class="ish-exp-date">${dateTxt}</div>`;
  document.body.appendChild(card);
  return card;
}

function buildRecapTweetText(scope) {
  const { count, year, month } = getRecapStats(scope);
  const en = CURRENT_LANG === 'en';
  const periodTxt = scope === 'year' ? (en ? `in ${year}` : `${year}年は`) : (en ? `in ${RECAP_MONTH_EN[month]} ${year}` : `${year}年${month + 1}月は`);
  return en
    ? `I acquired ${count} new item(s) ${periodTxt}!\nHow many did you get?\n\n${SITE_URL}\n${RECAP_SHARE_HASHTAG}`
    : `${periodTxt}新しく${count}件のアイテムを入手しました！\nあなたは何個入手した？\n\n${SITE_URL}\n${RECAP_SHARE_HASHTAG}`;
}

function shareRecap(scope) {
  const { count } = getRecapStats(scope);
  const en = CURRENT_LANG === 'en';
  if (count === 0) {
    showShareToast(en ? 'No items recorded in this period yet' : 'この期間の記録がまだありません');
    return;
  }
  injectShareSharedStyles();
  const filenameBase = scope === 'year' ? (en ? 'Yearly Recap' : '年間振り返り') : (en ? 'Monthly Recap' : '月間振り返り');
  return exportShareImage(() => buildRecapCardEl(scope), filenameBase, {
    shareText: buildRecapTweetText(scope),
    successToast: en ? 'Shared!' : '共有しました！',
  });
}

/* ================================================================
   スコープ付きスタイル注入（初回open()時のみ）
   ── モーダルはdocument.bodyへ直接appendするため、.item-view内でのみ
      定義されるitem.css側の色トークンは届かない。ここではハブ共通の
      --hub-*トークン（css/tokens.css）＋自前の--alm-*トークンのみを使う
      （search-modal.js/wishlist-cost-modal.jsと同じ設計）。
   ── 「開く」演出はCLAUDE.mdの方針通り、共有の.modal-overlay/.modal-card
      （css/chrome.css）が持つ@keyframes版アニメーションをそのまま使い、
      このファイル側でtransitionによる独自の開くアニメーションは実装しない。
   ================================================================ */
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.alm-hint { font-size: 12.5px; color: var(--hub-text-2); line-height: 1.6; margin-top: 2px; }

.alm-empty { font-size: 13px; color: var(--hub-text-2); padding: 28px 4px; text-align: center; line-height: 1.6; }

.alm-list { display: flex; flex-direction: column; margin-top: 14px; }
.alm-share-row { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
.alm-share-btn { width: 100%; padding: 12px; border: 0; border-radius: var(--hub-r-sm); background: #000; color: #fff; font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer; }
.alm-share-btn:active { opacity: 0.8; }
.alm-row { display: flex; align-items: center; gap: 10px; padding: 10px 2px; border-top: 0.5px solid var(--hub-sep); }
.alm-row:first-child { border-top: 0; }

.alm-icon { position: relative; width: 38px; height: 38px; flex-shrink: 0; border-radius: 8px; overflow: hidden; background: var(--hub-bg); display: flex; align-items: center; justify-content: center; }
.alm-icon img { width: 100%; height: 100%; object-fit: contain; padding: 12%; display: block; }
.alm-icon.img-fallback img { display: none; }
.alm-icon-fallback { display: none; color: var(--hub-text-3); }
.alm-icon.img-fallback .alm-icon-fallback { display: block; }

.alm-info { flex: 1; min-width: 0; }
.alm-name { font-size: 13.5px; font-weight: 600; color: var(--hub-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.alm-meta { font-size: 11px; color: var(--hub-text-2); margin-top: 2px; }
.alm-meta-sep { padding: 0 3px; }
.alm-cat-link { color: var(--hub-accent); font-weight: 700; text-decoration: none; }
.alm-cat-link:active { opacity: 0.7; }

.alm-remove-btn { flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%; border: 0; background: var(--hub-sep); color: var(--hub-text-2); display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
.alm-remove-btn:active { transform: scale(0.92); }

.alm-total-box { margin-top: 14px; padding: 16px; background: var(--hub-accent-bg); border-radius: var(--hub-r); }
.alm-total-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 5px 0; font-size: 13px; color: var(--hub-text); }
.alm-total-row span { display: flex; align-items: center; gap: 5px; }
.alm-total-row b { font-weight: 800; }

.alm-done-row { margin-top: 18px; }
.alm-done-btn {
  width: 100%; padding: 12px; border: 0; border-radius: var(--hub-r-sm); background: var(--hub-accent);
  color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit;
}
`;
  document.head.appendChild(style);
}

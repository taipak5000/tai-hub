/* ================================================================
   all-items-view.js — 全アイテム一覧（全カテゴリをまとめて表示・選択）

   item/index.html の「全アイテムを一覧で見る・選択」（#allItemsView /
   openAllItemsView() / renderAllItems() 系一式）を、tai-hub の SPA
   アーキテクチャに合わせて移植したもの。エモート所持率管理のように、
   全カテゴリのアイテムを画像タイルで1画面に並べ、タップするだけで所持を
   一気に選択できる。ルートは #/item/all。

   見た目は category-view.js（カテゴリ別チェックリスト）と完全に揃えるため、
   ヘッダーカード・フィルターパネル・タイル・リストの各 cv-* クラスと
   スタイルをそのまま再利用する（category-view.js が export する
   injectCategoryViewStyles() で注入）。このファイル固有のスタイルは
   .av-* に限定している（グループ見出し・詳細フィルター開閉・一括ボタン・
   「さらに表示」ボタンのみ）。

   データ読み込みは search-modal.js / dashboard-view.js と同じ方式
   （12種のグリッドカテゴリの data/items/<key>.js を動的importして
   1つの配列へまとめる）をこのファイル内に持つ（他のビューのキャッシュに
   依存しない）。状態の読み書きは js/state.js の getCategoryState() /
   saveCategoryState() に委譲しており、category-view.js・search-modal.js と
   完全に同じ localStorage キー（gameItems_<catKey>）・形状に書き込む
   （＝ここでの変更は各カテゴリページ・アイテム検索・ダッシュボードに
   そのまま反映される）。表示モード（グリッド/リスト）・列数も
   category-view.js と同じ設定キーを共有する。

   全アイテム数が約1,200件あるため、先頭から AV_CHUNK 件ずつ描画し、
   「さらに表示」ボタンが近づいたら（IntersectionObserver）続きを追加する。

   ── 元実装(item/index.html)からの意図的な簡略化 ──────────────────
   アイテム検索モーダル(search-modal.js)と同じく、「現在開催中のみ」や
   恒常精霊のエリア/大精霊フィルターは含めていない（検索モーダル側で提供）。
   ================================================================ */

import {
  getCategoryState, saveCategoryState, isCountableItem,
  getViewMode, setViewMode as storeSetViewMode,
  getGridCols, setGridCols as storeSetGridCols,
  isWishItem, toggleWishItem,
  recordItemAcquire, removeItemAcquireRecord,
} from '../../js/state.js';
import { CURRENT_LANG, trEvent, trCat, trItem, escapeHtml, resetFilterPanel } from '../../js/i18n.js';
import { CATEGORY_REGISTRY } from './data/categories.js';
import { isSeasonLikeEvent } from './data/season-data.js';
import { ITEM_YOMI } from './data/yomi-data.js';
import { checkAndUnlockTitles } from './titles-panel.js';
import { appendItemFooter } from './item-footer.js';
import { injectCategoryViewStyles, showCatViewToast, EVENT_ORDER } from './category-view.js';

// 12種のウェアラブルカテゴリのみが対象（section:'special' の楽譜は別形状のデータのため対象外）
const GRID_CATEGORIES = CATEGORY_REGISTRY.filter(c => c.section === 'grid');
const AV_CHUNK = 240;
const STYLE_ID = 'all-items-view-styles';

/* ── 全カテゴリのアイテムデータ（モジュール内キャッシュ） ───────────────── */
const itemsByCat = new Map(); // catKey -> ITEMS[]（所持トグル時にsaveCategoryStateへ渡す）
let allItemsCache = null;
let allItemsPromise = null;

function loadAllItemsOnce() {
  if (allItemsCache) return Promise.resolve(allItemsCache);
  if (allItemsPromise) return allItemsPromise;
  allItemsPromise = Promise.all(GRID_CATEGORIES.map(async cat => {
    try {
      const mod = await import(`./data/items/${cat.key}.js`);
      const items = Array.isArray(mod.ITEMS) ? mod.ITEMS : [];
      itemsByCat.set(cat.key, items);
      return items.map(item => ({ ...item, catKey: cat.key }));
    } catch (e) {
      console.error(`[all items] failed to load item data: ${cat.key}`, e);
      itemsByCat.set(cat.key, []);
      return [];
    }
  })).then(lists => {
    allItemsCache = lists.flat();
    allItemsPromise = null;
    return allItemsCache;
  }).catch(e => {
    allItemsPromise = null;
    throw e;
  });
  return allItemsPromise;
}

/* ── モジュール内状態（mount毎に更新される） ────────────────────────── */
let containerEl = null;
let mountToken = 0;
let viewMode = 'grid';
let gridCols = 'auto';
let avItems = [];        // 現在の絞り込み結果（並び替え済み）
let avRendered = 0;      // avItems のうち描画済みの件数
let avLastGroup = null;  // 直前に描画したグループ（カテゴリ／季節・日々）
let avGroupKind = null;  // 'cat' | 'event' | null（見出し無し）
let states = {};         // catKey -> { owned, fav }（描画のたびに読み直す）
let moreObserver = null;
let listeners = [];      // [target, type, handler]（unmountで解除）

function st(catKey) { return states[catKey] || (states[catKey] = getCategoryState(catKey)); }
function catOf(catKey) { return GRID_CATEGORIES.find(c => c.key === catKey); }
function q(sel) { return containerEl.querySelector(sel); }

/* 検索用にひらがなをカタカナへ正規化する（search-modal.js / item/index.html と同一） */
function normalizeSearchText(str) {
  return String(str).toLowerCase().replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
}
function isDayLikeEvent(e) { return !isSeasonLikeEvent(e) && (e.includes('日々') || e === 'Skyアニバーサリー'); }

/* ================================================================
   mount / unmount
   ================================================================ */
export async function mount(container) {
  const myToken = ++mountToken;
  injectCategoryViewStyles();
  injectStyles();
  container.innerHTML = '<div class="rt-loading"><div class="rt-spinner"></div></div>';

  try {
    await loadAllItemsOnce();
  } catch (e) {
    console.error('[all items] failed to load item data', e);
    if (myToken !== mountToken) return;
    container.innerHTML = `<div class="item-view"><div class="cv-wrap"><a href="#/item" class="back-link">${CURRENT_LANG === 'en' ? '&larr; Back to Main Menu' : '&larr; 総合メニューへ戻る'}</a><div class="cv-empty-message">${CURRENT_LANG === 'en' ? 'Failed to load item data. Please try again.' : 'アイテムデータの読み込みに失敗しました。もう一度お試しください。'}</div></div></div>`;
    return;
  }
  // 動的importの完了待ち中に別ルートへ遷移/unmountされていたら描画しない
  if (myToken !== mountToken) return;

  containerEl = container;
  viewMode = getViewMode() === 'list' ? 'list' : 'grid';
  gridCols = getGridCols();
  container.innerHTML = renderShell();
  appendItemFooter(container, 'all');
  buildEventOptions();
  wireControls();
  renderAll();
}

export function unmount() {
  mountToken++; // 進行中のmount()を無効化
  listeners.forEach(([target, type, handler]) => target.removeEventListener(type, handler));
  listeners = [];
  if (moreObserver) { moreObserver.disconnect(); moreObserver = null; }
  containerEl = null;
  avItems = [];
  states = {};
}

function listen(target, type, handler) {
  target.addEventListener(type, handler);
  listeners.push([target, type, handler]);
}

/* ================================================================
   描画：外枠
   ================================================================ */
function renderShell() {
  const en = CURRENT_LANG === 'en';
  return `
    <div class="item-view">
      <div class="cv-wrap">
        <a href="#/item" class="back-link">${en ? '&larr; Back to Main Menu' : '&larr; 総合メニューへ戻る'}</a>

        <div class="cv-header-card">
          <div class="cv-header-info">
            <div class="cv-header-icon"><svg class="inline-icon" width="26" height="26"><use href="#i-grid"/></svg></div>
            <div>
              <div class="cv-header-name">${en ? 'All Items' : '全アイテム'}</div>
              <div class="cv-header-count" id="avHdrCount">-- / -- ${en ? 'owned' : '所持'}</div>
            </div>
          </div>
          <div class="cv-header-pct" id="avHdrPct">--%</div>
        </div>

        <div class="cv-control-panel" id="avControlPanel">
          <div class="cv-control-row">
            <span class="cv-control-label">${en ? 'Name Search' : '名前検索'}</span>
            <svg class="inline-icon" width="16" height="16"><use href="#i-search"/></svg>
            <input type="text" class="cv-select-box cv-search-input" id="avName" autocomplete="off" placeholder="${en ? 'Search by item name, season, or day...' : 'アイテム名・季節/日々で検索...'}">
          </div>
          <div class="cv-control-row">
            <span class="cv-control-label">${en ? 'Season' : '季節・イベント'}</span>
            <select class="cv-select-box" id="avEvent">
              <option value="all">${en ? 'All Seasons/Events' : 'すべての季節・イベント'}</option>
            </select>
          </div>
          <div class="cv-control-row">
            <span class="cv-control-label">${en ? 'Filter' : '絞り込み'}</span>
            <select class="cv-select-box" id="avCat">
              <option value="all">${en ? 'All Categories' : 'すべてのカテゴリ'}</option>
              ${GRID_CATEGORIES.map(c => `<option value="${c.key}">${escapeHtml(en ? c.nameEn : c.name)}</option>`).join('')}
            </select>
            <select class="cv-select-box" id="avOwned">
              <option value="all">${en ? 'All ownership states' : 'すべての所持状態'}</option>
              <option value="owned">${en ? 'Owned only' : '所持中のみ'}</option>
              <option value="notOwned">${en ? 'Not owned only' : '未所持のみ'}</option>
            </select>
            <select class="cv-select-box" id="avFav">
              <option value="all">${en ? 'All favorites' : 'すべてのお気に入り'}</option>
              <option value="fav">${en ? 'Favorites only' : 'お気に入り指定のみ'}</option>
            </select>
          </div>
          <div class="cv-control-row">
            <button type="button" class="av-adv-btn" id="avAdvToggle" data-act="toggle-advanced" aria-expanded="false">
              <span>${en ? 'More Filters &amp; Sort' : '詳細な絞り込み・並び替え'}</span>
              <svg class="inline-icon av-adv-chevron" id="avAdvChevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
            </button>
          </div>
          <div class="cv-control-row" id="avAdvRow" style="display:none;">
            <span class="cv-control-label">${en ? 'Attributes' : '属性・条件'}</span>
            <select class="cv-select-box" id="avCostType">
              <option value="all">${en ? 'All (Free/Paid)' : 'すべて（無課金・課金）'}</option>
              <option value="free">${en ? 'Free Only' : '無課金のみ'}</option>
              <option value="premium">${en ? 'Paid Only' : '課金のみ'}</option>
            </select>
            <select class="cv-select-box" id="avReprint">
              <option value="all">${en ? 'All (Reprint)' : 'すべて（復刻）'}</option>
              <option value="reprint">${en ? 'Reprintable Only' : '復刻ありのみ'}</option>
              <option value="noReprint">${en ? 'No-Reprint Only' : '復刻なしのみ'}</option>
            </select>
            <select class="cv-select-box" id="avDye">
              <option value="all">${en ? 'All (Dye)' : 'すべて（染色）'}</option>
              <option value="dye">${en ? 'Dyeable Only' : '染色可のみ'}</option>
              <option value="noDye">${en ? 'Not Dyeable Only' : '染色不可のみ'}</option>
            </select>
            <select class="cv-select-box" id="avSort">
              <option value="default">${en ? 'Sort: Default (by Category)' : '並び替え：標準（カテゴリ別）'}</option>
              <option value="name">${en ? 'Sort: Name (A-Z)' : '並び替え：名前順'}</option>
              <option value="eventOrder">${en ? 'Sort: Season/Day Order' : '並び替え：季節・日々順'}</option>
              <option value="notOwnedFirst">${en ? 'Sort: Not Owned First' : '並び替え：未所持を先に'}</option>
              <option value="ownedFirst">${en ? 'Sort: Owned First' : '並び替え：所持済みを先に'}</option>
            </select>
          </div>
          <div class="cv-control-row cv-control-reset-row">
            <button type="button" class="cv-control-reset-btn" data-act="reset">
              <svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg> <span>${en ? 'Clear All Filters' : 'フィルターを全てクリア'}</span>
            </button>
          </div>
        </div>

        <button type="button" class="feature-btn av-bulk-btn" id="avBulkBtn" data-act="bulk" style="display:none;">
          <span class="feature-icon icon-chip" style="width:32px; height:32px;"><svg class="inline-icon" width="25" height="25"><use href="#i-check"/></svg></span>
          <span><span class="feature-label" id="avBulkLabel"></span></span>
        </button>

        <div class="cv-list-header-row">
          <p class="cv-sec-label" id="avCountLabel"></p>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <select class="cv-grid-cols-select" id="avColsSelect" title="${en ? 'Grid columns' : 'グリッドの列数'}" aria-label="${en ? 'Grid columns' : 'グリッドの列数'}">
              <option value="auto">${en ? 'Columns: Auto' : '列数: 自動'}</option>
              <option value="2">${en ? '2 columns' : '2列'}</option>
              <option value="3">${en ? '3 columns' : '3列'}</option>
              <option value="4">${en ? '4 columns' : '4列'}</option>
              <option value="5">${en ? '5 columns' : '5列'}</option>
              <option value="6">${en ? '6 columns' : '6列'}</option>
            </select>
            <div class="cv-view-toggle" role="group" aria-label="${en ? 'View mode' : '表示切替'}">
              <button type="button" class="cv-view-toggle-btn" id="avViewGrid" data-act="view-grid" aria-pressed="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
                <span>${en ? 'Grid' : 'グリッド'}</span>
              </button>
              <button type="button" class="cv-view-toggle-btn" id="avViewList" data-act="view-list" aria-pressed="false">
                <svg class="inline-icon" width="14" height="14"><use href="#i-menu"/></svg>
                <span>${en ? 'List' : 'リスト'}</span>
              </button>
            </div>
          </div>
        </div>
        <div class="cv-item-grid" id="avList"></div>
        <button type="button" class="av-more-btn" id="avMoreBtn" data-act="more" style="display:none;"></button>
      </div>
    </div>`;
}

/* 季節・イベント絞り込みセレクトを構築（「○○の季節」「○○の日々」という命名規則で
   optgroup 分け。search-modal.js の buildEventOptions と同一ロジック） */
function buildEventOptions() {
  const select = q('#avEvent');
  if (!select || !allItemsCache) return;
  const en = CURRENT_LANG === 'en';
  const events = [...new Set(allItemsCache.map(it => it.event))].sort((a, b) => {
    const ia = EVENT_ORDER.indexOf(a), ib = EVENT_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  const seasonEvents = events.filter(isSeasonLikeEvent);
  const dayEvents = events.filter(isDayLikeEvent);
  const otherEvents = events.filter(e => !isSeasonLikeEvent(e) && !isDayLikeEvent(e));
  const opts = list => list.map(ev => `<option value="${escapeHtml(ev)}">${escapeHtml(trEvent(ev))}</option>`).join('');
  select.innerHTML = `<option value="all">${en ? 'All Seasons/Events' : 'すべての季節・イベント'}</option>`
    + (seasonEvents.length ? `<optgroup label="${en ? 'Seasons' : '季節'}">${opts(seasonEvents)}</optgroup>` : '')
    + (dayEvents.length ? `<optgroup label="${en ? 'Days' : '日々'}">${opts(dayEvents)}</optgroup>` : '')
    + (otherEvents.length ? `<optgroup label="${en ? 'Other' : 'その他'}">${opts(otherEvents)}</optgroup>` : '');
}

/* ================================================================
   イベント配線（コンテナへの委譲。画面遷移で DOM ごと破棄されるため
   window.* への公開は不要）
   ================================================================ */
function wireControls() {
  listen(containerEl, 'input', e => { if (e.target.id === 'avName') renderAll(); });
  listen(containerEl, 'change', e => {
    const id = e.target.id;
    if (id === 'avColsSelect') {
      gridCols = e.target.value;
      storeSetGridCols(gridCols);
      applyViewUi();
    } else if (['avEvent', 'avCat', 'avOwned', 'avFav', 'avCostType', 'avReprint', 'avDye', 'avSort'].includes(id)) {
      renderAll();
    }
  });
  listen(containerEl, 'click', onClick);
  listen(containerEl, 'keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const actEl = e.target.closest?.('[data-act="toggle-owned"]');
    if (actEl && actEl === e.target) { e.preventDefault(); onClick(e); }
  });

  // 下へスクロールして「さらに表示」ボタンが近づいたら、続きを自動で描画する
  const moreBtn = q('#avMoreBtn');
  if (moreBtn && typeof IntersectionObserver !== 'undefined') {
    moreObserver = new IntersectionObserver(entries => {
      if (entries.some(en => en.isIntersecting) && avRendered < avItems.length) renderChunk();
    }, { rootMargin: '600px 0px' });
    moreObserver.observe(moreBtn);
  }
}

function onClick(e) {
  const actEl = e.target.closest('[data-act]');
  if (!actEl || !containerEl.contains(actEl)) return;
  const act = actEl.dataset.act;
  const entry = actEl.closest('.av-entry');

  if (act === 'toggle-owned') {
    if (e.target.closest('a')) return; // 名前リンク（検索）は通常どおり遷移させる
    if (entry) toggleOwned(entry.dataset.cat, entry.dataset.id, entry);
  } else if (act === 'toggle-fav') {
    if (entry) toggleFav(entry.dataset.cat, entry.dataset.id, actEl);
  } else if (act === 'toggle-wish') {
    if (entry) toggleWish(entry.dataset.cat, entry.dataset.id, actEl);
  } else if (act === 'view-grid') setView('grid');
  else if (act === 'view-list') setView('list');
  else if (act === 'more') renderChunk();
  else if (act === 'bulk') bulkOwnFiltered();
  else if (act === 'reset') resetFilterPanel('#avControlPanel', renderAll);
  else if (act === 'toggle-advanced') toggleAdvanced();
}

function toggleAdvanced() {
  const row = q('#avAdvRow');
  const open = row.style.display === 'none';
  row.style.display = open ? '' : 'none';
  q('#avAdvToggle').setAttribute('aria-expanded', String(open));
  q('#avAdvChevron').classList.toggle('open', open);
}

/* ================================================================
   絞り込み・並び替え
   ================================================================ */
// 並び替えに応じて見出し(グループ)を付ける。標準=カテゴリ別、季節・日々順=季節/日々別。それ以外は見出し無し
function groupKindNow() {
  const sort = q('#avSort').value;
  if (sort === 'default' && q('#avCat').value === 'all') return 'cat';
  if (sort === 'eventOrder') return 'event';
  return null;
}
function groupKey(item) { return avGroupKind === 'cat' ? item.catKey : item.event; }
function groupLabel(item) {
  if (avGroupKind === 'cat') {
    const c = catOf(item.catKey);
    return c ? escapeHtml(CURRENT_LANG === 'en' ? c.nameEn : c.name) : escapeHtml(item.catKey);
  }
  return escapeHtml(trEvent(item.event));
}

function getFiltered() {
  const v = id => q('#' + id).value;
  const fName = normalizeSearchText(v('avName').trim());
  const fEvent = v('avEvent'), fCat = v('avCat'), fOwned = v('avOwned'), fFav = v('avFav');
  const fCost = v('avCostType'), fReprint = v('avReprint'), fDye = v('avDye'), fSort = v('avSort');

  const filtered = allItemsCache.filter(item => {
    if (fName
      && !normalizeSearchText(item.name).includes(fName)
      && !(item.nameEn && normalizeSearchText(item.nameEn).includes(fName))
      && !normalizeSearchText(item.event).includes(fName)
      && !normalizeSearchText(trEvent(item.event)).includes(fName)
      && !(ITEM_YOMI[item.id] && normalizeSearchText(ITEM_YOMI[item.id]).includes(fName))) return false;
    if (fEvent !== 'all' && item.event !== fEvent) return false;
    if (fCat !== 'all' && item.catKey !== fCat) return false;
    if (fOwned !== 'all') {
      const isOwned = !!st(item.catKey).owned[item.id];
      if (fOwned === 'owned' && !isOwned) return false;
      if (fOwned === 'notOwned' && isOwned) return false;
    }
    if (fFav === 'fav' && !st(item.catKey).fav[item.id]) return false;
    if (fCost !== 'all' && item.cost !== fCost) return false;
    if (fReprint === 'reprint' && item.noReprint) return false;
    if (fReprint === 'noReprint' && !item.noReprint) return false;
    if (fDye === 'dye' && !item.dye) return false;
    if (fDye === 'noDye' && item.dye) return false;
    return true;
  });
  return sortItems(filtered, fSort);
}

function sortItems(items, mode) {
  const en = CURRENT_LANG === 'en';
  if (mode === 'name') {
    return [...items].sort((a, b) => trItem(a).localeCompare(trItem(b), en ? 'en' : 'ja'));
  }
  if (mode === 'eventOrder') {
    const sorted = [...items].sort((a, b) => {
      const ia = EVENT_ORDER.indexOf(a.event), ib = EVENT_ORDER.indexOf(b.event);
      return (ia === -1 ? EVENT_ORDER.length : ia) - (ib === -1 ? EVENT_ORDER.length : ib);
    });
    // EVENT_ORDER に載っていない季節・日々は並び順が同値になり散らばるため、同じ名前を1か所に寄せて見出しの重複を防ぐ
    const byEvent = new Map();
    sorted.forEach(it => { if (!byEvent.has(it.event)) byEvent.set(it.event, []); byEvent.get(it.event).push(it); });
    return [...byEvent.values()].flat();
  }
  if (mode === 'notOwnedFirst' || mode === 'ownedFirst') {
    const sign = mode === 'notOwnedFirst' ? 1 : -1;
    return [...items].sort((a, b) => {
      const oa = st(a.catKey).owned[a.id] ? 1 : 0;
      const ob = st(b.catKey).owned[b.id] ? 1 : 0;
      return (oa - ob) * sign;
    });
  }
  return items; // 'default'（カタログ順＝カテゴリ順のまま）
}

/* ================================================================
   描画：タイル／リスト行／見出し
   ================================================================ */
const ICON_STAR = filled => `<svg class="inline-icon" width="14" height="14" style="stroke:currentColor;fill:${filled ? 'currentColor' : 'none'};stroke-width:1.6"><use href="#i-star"/></svg>`;

function tileHtml(item) {
  const en = CURRENT_LANG === 'en';
  const s = st(item.catKey);
  const isOwned = !!s.owned[item.id], isFav = !!s.fav[item.id], isWish = isWishItem(item.catKey, item.id);
  const name = trItem(item);
  const wikiUrl = `https://www.google.com/search?q=${encodeURIComponent(name + '　Sky')}`;
  const tip = [
    name, trEvent(item.event),
    item.cost === 'premium' ? (en ? 'Paid' : '課金') : (en ? 'Free' : '無課金'),
    en ? `Dye ${item.dye ? 'Yes' : 'No'}` : `染色${item.dye ? 'あり' : 'なし'}`,
    item.noReprint ? (en ? 'No Re-release' : '復刻なし') : '',
  ].filter(Boolean).join(' ／ ');
  return `
    <div class="cv-item-tile av-entry" data-cat="${item.catKey}" data-id="${item.id}">
      <div class="cv-item-tile-frame ${isOwned ? 'is-owned' : ''}" data-act="toggle-owned" title="${escapeHtml(tip)}" tabindex="0" role="button" aria-pressed="${isOwned}">
        ${item.cost === 'premium' ? '<span class="cv-tile-cost-dot" aria-hidden="true"></span>' : ''}
        ${item.noReprint ? '<span class="cv-tile-nr-badge">NR</span>' : ''}
        <button type="button" class="cv-tile-fav-btn ${isFav ? 'is-fav' : ''}" data-act="toggle-fav" aria-label="${en ? 'Favorite' : 'お気に入り'}">${ICON_STAR(isFav)}</button>
        <button type="button" class="cv-tile-wish-btn ${isWish ? 'is-wish' : ''}" data-act="toggle-wish" aria-label="${en ? 'Wishlist' : 'ウィッシュリスト'}" title="${en ? 'Add to wishlist' : 'ウィッシュリストに追加'}"><svg class="inline-icon" width="13" height="13" style="stroke:currentColor;fill:none;stroke-width:1.8"><use href="#i-cart"/></svg></button>
        <div class="cv-item-tile-img-wrap">
          <img src="${item.img || ''}" alt="${escapeHtml(name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('cv-img-fallback')">
          <span class="cv-item-tile-fallback"><svg class="inline-icon" width="22" height="22"><use href="#i-wing"/></svg></span>
        </div>
        <span class="cv-tile-owned-check"><svg class="inline-icon" width="11" height="11" style="stroke:currentColor;fill:none;stroke-width:2.2"><use href="#i-check"/></svg></span>
      </div>
      <a href="${wikiUrl}" target="_blank" rel="noopener noreferrer" class="cv-item-tile-name">${escapeHtml(name)}</a>
    </div>`;
}

function rowHtml(item) {
  const en = CURRENT_LANG === 'en';
  const cat = catOf(item.catKey);
  if (!cat) return '';
  const s = st(item.catKey);
  const isOwned = !!s.owned[item.id], isFav = !!s.fav[item.id], isWish = isWishItem(item.catKey, item.id);
  const name = trItem(item);
  const wikiUrl = `https://www.google.com/search?q=${encodeURIComponent(name + '　Sky')}`;
  return `
    <div class="cv-item-card av-entry ${isOwned ? 'is-owned' : ''}" data-cat="${item.catKey}" data-id="${item.id}">
      <div class="cv-item-left" data-act="toggle-owned" tabindex="0" role="button" aria-pressed="${isOwned}">
        <div class="cv-item-thumb">
          <img src="${item.img || ''}" alt="${escapeHtml(name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('cv-img-fallback')">
          <span class="cv-item-thumb-fallback"><svg class="inline-icon" width="18" height="18"><use href="#i-wing"/></svg></span>
          <span class="cv-item-thumb-check"><svg class="inline-icon" width="10" height="10" style="stroke:currentColor;fill:none;stroke-width:2.2"><use href="#i-check"/></svg></span>
        </div>
        <div class="cv-item-details">
          <a href="${wikiUrl}" target="_blank" rel="noopener noreferrer" class="cv-item-name-link">${escapeHtml(name)}</a>
          <div class="cv-item-meta-row">
            <span class="cv-badge">${escapeHtml(en ? cat.nameEn : cat.name)}</span>
            <span class="cv-badge">${escapeHtml(trEvent(item.event))}</span>
            <span class="cv-badge ${item.cost === 'premium' ? 'cv-badge-premium' : 'cv-badge-free'}">${item.cost === 'premium' ? (en ? 'Paid' : '課金') : (en ? 'Free' : '無課金')}</span>
            ${item.noReprint ? `<span class="cv-badge cv-badge-no-reprint">${en ? 'No Re-release' : '復刻なし'}</span>` : ''}
          </div>
        </div>
      </div>
      <button type="button" class="cv-fav-btn ${isFav ? 'is-fav' : ''}" data-act="toggle-fav" aria-label="${en ? 'Favorite' : 'お気に入り'}">${ICON_STAR(isFav).replace('width="14" height="14"', 'width="18" height="18"')}</button>
      <button type="button" class="cv-wish-btn ${isWish ? 'is-wish' : ''}" data-act="toggle-wish" aria-label="${en ? 'Wishlist' : 'ウィッシュリスト'}" title="${en ? 'Add to wishlist' : 'ウィッシュリストに追加'}">
        <svg class="inline-icon" width="16" height="16" style="stroke:currentColor;fill:none;stroke-width:1.8"><use href="#i-cart"/></svg>
      </button>
    </div>`;
}

function groupHeadHtml(item) {
  return `<div class="av-group-head" data-g="${escapeHtml(groupKey(item))}"><span class="av-group-name">${groupLabel(item)}</span><span class="av-group-count"></span></div>`;
}

/* 見出し・件数・全体の達成率を最新の所持状態に合わせて更新する（絞り込み結果全体を数え直す） */
function refreshCounts() {
  const en = CURRENT_LANG === 'en';
  const groups = {};
  let filteredOwned = 0;
  avItems.forEach(it => {
    const owned = !!st(it.catKey).owned[it.id];
    if (owned) filteredOwned++;
    if (avGroupKind) {
      const g = groupKey(it);
      const s = groups[g] || (groups[g] = { total: 0, owned: 0 });
      s.total++;
      if (owned) s.owned++;
    }
  });
  containerEl.querySelectorAll('#avList .av-group-head').forEach(h => {
    const s = groups[h.dataset.g];
    const el = h.querySelector('.av-group-count');
    if (s && el) el.textContent = `${s.owned} / ${s.total}`;
  });
  q('#avCountLabel').textContent = avItems.length > 0
    ? (en ? `${avItems.length} items (${filteredOwned} owned)` : `${avItems.length}件（所持 ${filteredOwned}件）`) : '';

  // 全体の達成率（ダッシュボードと同じく、全カテゴリが分母。That Sky Shop は集計から除く）
  const countable = allItemsCache.filter(isCountableItem);
  const total = countable.length;
  const ownedAll = countable.filter(it => !!st(it.catKey).owned[it.id]).length;
  q('#avHdrCount').textContent = en ? `${ownedAll} / ${total} owned` : `${ownedAll} / ${total} 所持`;
  q('#avHdrPct').textContent = total > 0 ? `${Math.round(ownedAll / total * 100)}%` : '--%';

  // 一括ボタンは「何かで絞り込んでいる時だけ」出す（絞り込み無しで全件を誤って所持済みにしないため）
  const notOwned = avItems.length - filteredOwned;
  const narrowed = avItems.length < allItemsCache.length;
  const bulkBtn = q('#avBulkBtn');
  if (narrowed && notOwned > 0) {
    bulkBtn.style.display = '';
    q('#avBulkLabel').textContent = en
      ? `Mark ${notOwned} filtered item(s) as owned` : `絞り込み結果の未所持${notOwned}件を所持済みにする`;
  } else {
    bulkBtn.style.display = 'none';
  }
}

function renderChunk() {
  if (!containerEl) return;
  const list = q('#avList');
  const end = Math.min(avItems.length, avRendered + AV_CHUNK);
  let html = '';
  for (let i = avRendered; i < end; i++) {
    const item = avItems[i];
    if (avGroupKind) {
      const g = groupKey(item);
      if (g !== avLastGroup) { avLastGroup = g; html += groupHeadHtml(item); }
    }
    html += viewMode === 'list' ? rowHtml(item) : tileHtml(item);
  }
  list.insertAdjacentHTML('beforeend', html);
  avRendered = end;
  refreshCounts();
  const more = q('#avMoreBtn');
  const remaining = avItems.length - avRendered;
  if (remaining > 0) {
    more.style.display = '';
    more.textContent = CURRENT_LANG === 'en' ? `Show more (${remaining} remaining)` : `さらに表示（残り${remaining}件）`;
  } else {
    more.style.display = 'none';
  }
}

/* 絞り込み・並び替え・表示切替のたびに、一覧を先頭から描き直す */
function renderAll() {
  if (!containerEl || !allItemsCache) return;
  states = {};
  avGroupKind = groupKindNow();
  avItems = getFiltered();
  avRendered = 0;
  avLastGroup = null;
  applyViewUi();
  const list = q('#avList');
  if (avItems.length === 0) {
    list.innerHTML = `<div class="cv-empty-message">${CURRENT_LANG === 'en' ? 'No matching items found.' : '該当するアイテムが見つかりません。'}</div>`;
    q('#avMoreBtn').style.display = 'none';
    refreshCounts();
    return;
  }
  list.innerHTML = '';
  renderChunk();
}

// スクロール位置と描画済みの範囲を保ったまま描き直す（所持・お気に入りで絞り込み中に項目が外れる場合）
function rerenderKeepingPosition() {
  const y = window.scrollY;
  const renderedCount = avRendered;
  renderAll();
  while (avRendered < renderedCount && avRendered < avItems.length) renderChunk();
  window.scrollTo(0, y);
}

/* ================================================================
   表示モード（グリッド／リスト）・グリッド列数
   ================================================================ */
function setView(mode) {
  if (mode !== 'grid' && mode !== 'list') return;
  viewMode = mode;
  storeSetViewMode(mode);
  renderAll();
}

function applyViewUi() {
  const list = q('#avList');
  list.classList.toggle('cv-item-grid', viewMode === 'grid');
  list.classList.toggle('cv-item-list', viewMode === 'list');
  list.style.gridTemplateColumns = (viewMode === 'grid' && gridCols !== 'auto') ? `repeat(${gridCols}, 1fr)` : '';
  const gridBtn = q('#avViewGrid'), listBtn = q('#avViewList');
  gridBtn.classList.toggle('active', viewMode === 'grid');
  gridBtn.setAttribute('aria-pressed', String(viewMode === 'grid'));
  listBtn.classList.toggle('active', viewMode === 'list');
  listBtn.setAttribute('aria-pressed', String(viewMode === 'list'));
  const sel = q('#avColsSelect');
  sel.style.display = viewMode === 'grid' ? '' : 'none';
  sel.value = gridCols;
}

/* ================================================================
   所持／お気に入り／ウィッシュリストのトグル
   ================================================================ */
function toggleOwned(catKey, id, entry) {
  const s = st(catKey);
  s.owned[id] = !s.owned[id];
  saveCategoryState(catKey, s.owned, s.fav, itemsByCat.get(catKey) || []);
  if (s.owned[id]) recordItemAcquire(catKey, id); else removeItemAcquireRecord(id);
  notifyTitlesCheck();

  // 「所持中のみ／未所持のみ」で絞り込み中は対象から外れるため描き直し、それ以外はその1件だけ更新する
  if (q('#avOwned').value !== 'all') { rerenderKeepingPosition(); return; }
  const owned = s.owned[id];
  const frame = entry.classList.contains('cv-item-card') ? entry : entry.querySelector('.cv-item-tile-frame');
  frame.classList.toggle('is-owned', owned);
  const toggleEl = entry.querySelector('[data-act="toggle-owned"]');
  if (toggleEl) toggleEl.setAttribute('aria-pressed', String(owned));
  // 所持済みになると自動でウィッシュリストから外れるため、ボタンの見た目も合わせる
  if (owned) entry.querySelectorAll('.cv-tile-wish-btn, .cv-wish-btn').forEach(b => b.classList.remove('is-wish'));
  refreshCounts();
}

function toggleFav(catKey, id, btn) {
  const s = st(catKey);
  s.fav[id] = !s.fav[id];
  saveCategoryState(catKey, s.owned, s.fav, itemsByCat.get(catKey) || []);
  if (q('#avFav').value !== 'all') { rerenderKeepingPosition(); return; }
  btn.classList.toggle('is-fav', s.fav[id]);
  const svg = btn.querySelector('svg');
  if (svg) svg.style.fill = s.fav[id] ? 'currentColor' : 'none';
}

function toggleWish(catKey, id, btn) {
  const en = CURRENT_LANG === 'en';
  const added = toggleWishItem(catKey, id);
  if (added === null) {
    showCatViewToast(en ? 'Owned items cannot be added to the wishlist' : '所持済みのアイテムはウィッシュリストに追加できません');
    return;
  }
  btn.classList.toggle('is-wish', added);
  showCatViewToast(added
    ? (en ? 'Added to wishlist' : 'ウィッシュリストに追加しました')
    : (en ? 'Removed from wishlist' : 'ウィッシュリストから外しました'));
}

/* 現在の絞り込み結果のうち未所持のものをまとめて所持済みにする（確認ダイアログあり） */
function bulkOwnFiltered() {
  const en = CURRENT_LANG === 'en';
  const targets = avItems.filter(item => !st(item.catKey).owned[item.id]);
  if (targets.length === 0) return;
  const msg = en ? `Mark ${targets.length} item(s) as owned?` : `${targets.length}件のアイテムを所持済みにします。よろしいですか？`;
  if (!window.confirm(msg)) return;

  const touched = new Set();
  targets.forEach(item => {
    st(item.catKey).owned[item.id] = true;
    recordItemAcquire(item.catKey, item.id);
    touched.add(item.catKey);
  });
  touched.forEach(catKey => {
    const s = st(catKey);
    saveCategoryState(catKey, s.owned, s.fav, itemsByCat.get(catKey) || []);
  });
  notifyTitlesCheck();
  renderAll();
  showCatViewToast(en ? `${targets.length} item(s) marked as owned` : `${targets.length}件を所持済みにしました`);
}

/* 所持状態の変更のたびに称号の新規解禁が無いか確認し、あればトースト通知する
   （category-view.js の notifyTitlesCheck() と同じ役割） */
function notifyTitlesCheck() {
  checkAndUnlockTitles().then(newlyEarned => {
    if (!newlyEarned || !newlyEarned.length) return;
    const msg = newlyEarned.length === 1
      ? (CURRENT_LANG === 'en' ? `Title unlocked: ${newlyEarned[0].nameEn}` : `称号解禁「${newlyEarned[0].name}」`)
      : (CURRENT_LANG === 'en' ? `${newlyEarned.length} titles unlocked!` : `称号を${newlyEarned.length}個解禁！`);
    showCatViewToast(msg);
  }).catch(e => console.error('[all items] title check failed', e));
}

/* ================================================================
   スコープ付きスタイル注入（初回mount時のみ。cv-* は category-view.js 側）
   ================================================================ */
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.item-view .av-adv-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; width: 100%;
  background: var(--bg); border: none; border-radius: var(--r-sm); padding: 10px;
  font-size: 13px; font-weight: 700; color: var(--blue); cursor: pointer; font-family: inherit;
}
.item-view .av-adv-chevron { transition: transform 0.15s ease; }
.item-view .av-adv-chevron.open { transform: rotate(90deg); }

.item-view .av-bulk-btn { margin-top: 12px; margin-bottom: 0; }

.item-view .av-group-head {
  grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 14px 4px 2px; font-size: 13px; font-weight: 700; color: var(--text);
}
.item-view .cv-item-list > .av-group-head { padding: 14px 4px 2px; }
.item-view .av-group-name { min-width: 0; }
.item-view .av-group-count { font-size: 12px; font-weight: 600; color: var(--text-2); font-variant-numeric: tabular-nums; flex-shrink: 0; }

.item-view .av-more-btn {
  display: block; width: 100%; margin: 16px 0 4px; padding: 12px; border: 0; border-radius: var(--r);
  background: var(--card); box-shadow: 0 1px 3px rgba(0,0,0,0.08); font-size: 13px; font-weight: 700;
  color: var(--blue); cursor: pointer; font-family: inherit;
}
`;
  document.head.appendChild(style);
}

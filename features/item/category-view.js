/* ================================================================
   category-view.js — カテゴリ別アイテムチェックリスト（汎用版）

   item/cape.html（カテゴリ別アイテムチェックページ）を、tai-hub の
   SPA アーキテクチャに合わせて汎用ES moduleへ移植したもの。
   元実装はCAT_KEY/CAT_INFO/ITEMS_DATAをページごとに直接書き換えて
   カテゴリごとに1ファイルずつ複製する構成だったが、ここでは
   mount(container, categoryConfig) の第2引数（CATEGORY_REGISTRYの
   1要素）と `./data/items/<key>.js` の動的importだけでどのカテゴリ
   でも同じ関数から描画できるようにしている。

   状態の読み書きは元のloadUserData()/saveUserData()相当を
   js/state.js の getCategoryState()/saveCategoryState() に委譲
   （localStorageキー名・データ形状は完全互換、変更しないこと）。

   個別カテゴリ固有の副産物として保持している既知の簡略化・省略事項は
   このファイル末尾のコメントを参照。
   ================================================================ */

import {
  getCategoryState, saveCategoryState, isCountableItem,
  getViewMode, setViewMode as storeSetViewMode,
  getGridCols, setGridCols as storeSetGridCols,
  isWishItem, toggleWishItem,
  recordItemAcquire, removeItemAcquireRecord,
} from '../../js/state.js';
import { CURRENT_LANG, trEvent, trItem, escapeHtml, resetFilterPanel } from '../../js/i18n.js';
import { checkAndUnlockTitles } from './titles-panel.js';
import { appendItemFooter } from './item-footer.js';

/* 季節・日々の登場順（イベント名順ソート／絞り込みセレクトの並び順）。
   item/cape.html他、全カテゴリページで完全に同一の定数として定義されて
   いた（カテゴリ固有データではない）ため、ここに1つだけ持たせている。
   リストに無いイベント名（コラボ・単発イベント等）は登場順のまま末尾に続く。 */
export const EVENT_ORDER = [
  '感謝の季節', '光の探求者の季節', '想いを編む季節', 'リズムが弾ける季節', '魔法の季節',
  '楽園の季節', '預言者の季節', '夢かなう季節', '大樹に集う季節', '星の王子さまの季節',
  '羽ばたく季節', '深淵の季節', '表現者たちの季節', '砕ケル闇ノ季節', 'AURORAの季節',
  '追慕の季節', 'ならいの季節', '瞬きの季節', '復古の季節', '九色の鹿の季節',
  '巣づくりの季節', '重なる音色の季節', 'ムーミンの季節', '光に染まる季節', '青い鳥の季節',
  'ふたつの灯火の季節　前編', '渡りの季節', '光の修繕者の季節', 'カーニバルの季節', '親愛なるファン・ゴッホへ',
  '来福の日々', '花笑む日々', '自然の日々', '彩なす日々', 'Skyアニバーサリー',
  '陽光の日々', '月灯りの日々', 'いたずらな日々', '分かち合いの日々', '聖なる星の日々',
  '愛しみの日々',
];

const STYLE_ID = 'category-view-styles';

// ── モジュール内状態（mount毎に更新される） ──────────────────
let containerEl = null;
let categoryConfig = null;
let categoryItems = [];
let userStates = { owned: {}, fav: {} };
let viewMode = 'grid';
let gridCols = 'auto';
// 高速に別ルートへ遷移された場合、先行するmount()の非同期処理(動的import待ち)が
// 後から解決してcontainerを上書きしてしまわないようにするためのトークン
let mountToken = 0;

// 「タイプ」絞り込み・タイプ順・タイプ表示は、元サイトでもこの3カテゴリだけ（他のカテゴリのitem.typeは内部分類）
const TYPE_FILTER_CATS = ['portable_item', 'large_placeable', 'small_placeable'];
function typeEnabled() { return !!categoryConfig && TYPE_FILTER_CATS.includes(categoryConfig.key); }

export async function mount(container, catConfig) {
  const myToken = ++mountToken;
  injectStyles();

  // 🩹 router-registry.jsのlazyToolEntryはツール本体(=このモジュール自身)の
  // 初回importだけをスピナーで覆う。ここから先のカテゴリ別データファイルの
  // 動的importは、そのカテゴリを初めて開いた時点で毎回新しく発生するため
  // (以後はキャッシュされる)、この待ち時間にも同じスピナーを表示しておく
  // ——無いと「一瞬だけ素の状態」がカテゴリ切替のたびに再発する。
  container.innerHTML = '<div class="rt-loading"><div class="rt-spinner"></div></div>';

  let ITEMS = [];
  try {
    const mod = await import(`./data/items/${catConfig.key}.js`);
    ITEMS = mod.ITEMS || [];
  } catch (e) {
    console.error('カテゴリアイテムデータの読み込み失敗:', catConfig.key, e);
  }
  // 動的importの完了待ち中に別ルートへ遷移/unmountされていたら描画しない
  if (myToken !== mountToken) return;

  containerEl = container;
  categoryConfig = catConfig;
  categoryItems = ITEMS;
  userStates = getCategoryState(catConfig.key);
  viewMode = getViewMode();
  gridCols = getGridCols();

  container.innerHTML = renderShell(catConfig);
  appendItemFooter(container, catConfig.key);

  window.__catViewToggleOwned = handleToggleOwned;
  window.__catViewToggleFav = handleToggleFav;
  window.__catViewToggleWish = handleToggleWish;
  window.__catViewSetViewMode = handleSetViewMode;
  window.__catViewSetGridCols = handleSetGridCols;
  window.__catViewFilterAndRender = filterAndRender;
  window.__catViewResetFilters = handleResetFilters;

  updateViewToggleUI();
  applyGridCols();
  buildEventFilter();
  buildColorFilter();
  buildTypeFilter();
  filterAndRender();
  // 総合メニュー(ダッシュボード)側の集計ロジックに反映させるため、
  // 表示のたびにデータを保存し直す（元のDOMContentLoaded内の挙動と同じ）
  saveCategoryState(catConfig.key, userStates.owned, userStates.fav, categoryItems);
}

export function unmount() {
  mountToken++; // 進行中のmount()を無効化
  delete window.__catViewToggleOwned;
  delete window.__catViewToggleFav;
  delete window.__catViewToggleWish;
  delete window.__catViewSetViewMode;
  delete window.__catViewSetGridCols;
  delete window.__catViewFilterAndRender;
  delete window.__catViewResetFilters;
  containerEl = null;
  categoryConfig = null;
  categoryItems = [];
}

/* ================================================================
   描画：外枠（戻るリンク・ヘッダーバナー・フィルターパネル・一覧見出し）
   ================================================================ */
function renderShell(cfg) {
  const en = CURRENT_LANG === 'en';
  const catName = en ? cfg.nameEn : cfg.name;
  const iconHtml = cfg.img
    ? `<img src="${cfg.img}" alt="${escapeHtml(catName)}" loading="lazy" referrerpolicy="no-referrer">`
    : `<svg class="inline-icon" width="22" height="22"><use href="#i-wing"/></svg>`;
  // 元実装（item/cape.html）では「色」絞り込み・並び替えはケープカテゴリだけに
  // あるオプション（cape.htmlのitem.colorはケープの色そのもの）で、他の11カテゴリの
  // ページには存在しない。ここでは静的にハードコードせず、そのカテゴリのアイテムに
  // 実際にcolorフィールドがあるかどうかで自動判定する（データが増減しても追従する）。
  const hasColorData = categoryItems.some(item => item.color);
  // 同様に「タイプ」絞り込み・タイプ順の並び替えも、item.typeを持つカテゴリ
  // （元実装では 大きい設置アイテム・持ち物アイテム・小さい設置アイテム）だけに出す
  const hasTypeData = typeEnabled() && categoryItems.some(item => item.type);

  return `
    <div class="item-view">
      <div class="cv-wrap">
        <a href="#/item" class="back-link">${en ? '&larr; Back to Category List' : '&larr; カテゴリ一覧へ戻る'}</a>

        <div class="cv-header-card">
          <div class="cv-header-info">
            <div class="cv-header-icon" id="catIcon">${iconHtml}</div>
            <div>
              <div class="cv-header-name" id="catName">${escapeHtml(catName)}</div>
              <div class="cv-header-count" id="catCount">-- / -- ${en ? 'owned' : '所持'}</div>
            </div>
          </div>
          <div class="cv-header-pct" id="catPct">--%</div>
        </div>

        <div class="cv-control-panel">
          <div class="cv-control-row">
            <span class="cv-control-label">${en ? 'Name Search' : '名前検索'}</span>
            <svg class="inline-icon" width="16" height="16"><use href="#i-search"/></svg>
            <input type="text" class="cv-select-box cv-search-input" id="searchName" placeholder="${en ? 'Filter by item name...' : 'アイテム名で絞り込み...'}" oninput="window.__catViewFilterAndRender()">
          </div>
          <div class="cv-control-row">
            <span class="cv-control-label">${en ? 'Filter' : '絞り込み'}</span>
            <select class="cv-select-box" id="filterStatus" onchange="window.__catViewFilterAndRender()">
              <option value="all">${en ? 'All ownership states' : 'すべての所持状態'}</option>
              <option value="owned">${en ? 'Owned only' : '所持中のみ'}</option>
              <option value="notOwned">${en ? 'Not owned only' : '未所持のみ'}</option>
            </select>
            <select class="cv-select-box" id="filterFav" onchange="window.__catViewFilterAndRender()">
              <option value="all">${en ? 'All favorites' : 'すべてのお気に入り'}</option>
              <option value="fav">${en ? 'Favorites only' : 'お気に入り指定のみ'}</option>
            </select>
          </div>
          <div class="cv-control-row">
            <span class="cv-control-label">${en ? 'Attributes' : '属性・条件'}</span>
            <select class="cv-select-box" id="filterCost" onchange="window.__catViewFilterAndRender()">
              <option value="all">${en ? 'All acquisition methods (paid/free)' : 'すべての入手方法（課金/無課金）'}</option>
              <option value="free">${en ? 'Free items' : '無課金アイテム'}</option>
              <option value="premium">${en ? 'Paid items' : '課金アイテム'}</option>
            </select>
            <select class="cv-select-box" id="filterDye" onchange="window.__catViewFilterAndRender()">
              <option value="all">${en ? 'All dye options' : 'すべての染色可否'}</option>
              <option value="dye-o">${en ? 'Dyeable' : '染色あり'}</option>
              <option value="dye-x">${en ? 'Not dyeable' : '染色なし'}</option>
            </select>
            <select class="cv-select-box" id="filterReprint" onchange="window.__catViewFilterAndRender()">
              <option value="all">${en ? 'All re-release states' : 'すべての復刻状態'}</option>
              <option value="noReprint">${en ? 'No re-release' : '復刻なし'}</option>
            </select>
          </div>
          <div class="cv-control-row">
            <span class="cv-control-label">${en ? 'Other' : 'その他'}</span>
            <select class="cv-select-box" id="filterEvent" onchange="window.__catViewFilterAndRender()">
              <option value="all">${en ? 'All events/sources' : 'すべてのイベント・登場元'}</option>
            </select>
            ${hasColorData ? `<select class="cv-select-box" id="filterColor" onchange="window.__catViewFilterAndRender()">
              <option value="all">${en ? 'All colors' : 'すべての色'}</option>
            </select>` : ''}
            ${hasTypeData ? `<select class="cv-select-box" id="filterType" onchange="window.__catViewFilterAndRender()">
              <option value="all">${en ? 'All types' : 'すべてのタイプ'}</option>
            </select>` : ''}
          </div>
          <div class="cv-control-row">
            <span class="cv-control-label">${en ? 'Sort' : '並び替え'}</span>
            <select class="cv-select-box" id="sortOrder" onchange="window.__catViewFilterAndRender()">
              <option value="default">${en ? 'Sort: Default' : '並び替え: 標準'}</option>
              <option value="nameAsc">${en ? 'Item Name (A-Z)' : 'アイテム名（昇順）'}</option>
              <option value="event">${en ? 'By Event Name' : 'イベント名順'}</option>
              ${hasColorData ? `<option value="color">${en ? 'By Color' : '色順'}</option>` : ''}
              ${hasTypeData ? `<option value="type">${en ? 'By Type' : 'タイプ順'}</option>` : ''}
            </select>
          </div>
          <div class="cv-control-row cv-control-reset-row">
            <button type="button" class="cv-control-reset-btn" onclick="window.__catViewResetFilters()">
              <svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg> <span>${en ? 'Clear All Filters' : 'フィルターを全てクリア'}</span>
            </button>
          </div>
        </div>

        <div class="cv-list-header-row">
          <p class="cv-sec-label">${en ? 'Item List' : 'アイテム一覧'}</p>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <select class="cv-grid-cols-select" id="gridColsSelect" onchange="window.__catViewSetGridCols(this.value)" title="${en ? 'Grid columns' : 'グリッドの列数'}" aria-label="${en ? 'Grid columns' : 'グリッドの列数'}">
              <option value="auto">${en ? 'Columns: Auto' : '列数: 自動'}</option>
              <option value="2">${en ? '2 columns' : '2列'}</option>
              <option value="3">${en ? '3 columns' : '3列'}</option>
              <option value="4">${en ? '4 columns' : '4列'}</option>
              <option value="5">${en ? '5 columns' : '5列'}</option>
              <option value="6">${en ? '6 columns' : '6列'}</option>
            </select>
            <div class="cv-view-toggle" role="group" aria-label="${en ? 'View mode' : '表示切替'}">
              <button type="button" class="cv-view-toggle-btn" id="viewBtnGrid" onclick="window.__catViewSetViewMode('grid')" aria-pressed="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
                <span>${en ? 'Grid' : 'グリッド'}</span>
              </button>
              <button type="button" class="cv-view-toggle-btn" id="viewBtnList" onclick="window.__catViewSetViewMode('list')" aria-pressed="false">
                <svg class="inline-icon" width="14" height="14"><use href="#i-menu"/></svg>
                <span>${en ? 'List' : 'リスト'}</span>
              </button>
            </div>
          </div>
        </div>
        <div class="cv-item-grid" id="itemList"></div>
      </div>
    </div>
  `;
}

/* ================================================================
   ヘッダーのスコア表示更新
   ================================================================ */
// categoryItems 全体から、That Sky Shop を除いた {owned, total} を数えてヘッダーを更新する
// （旧サイトと同じ規則。カテゴリ内の一覧表示には That Sky Shop も出す）
function refreshHeaderScore() {
  const countable = categoryItems.filter(isCountableItem);
  updateHeaderScore(countable.filter(item => userStates.owned[item.id]).length, countable.length);
}

function updateHeaderScore(owned, total) {
  const en = CURRENT_LANG === 'en';
  const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
  const countEl = containerEl.querySelector('#catCount');
  const pctEl = containerEl.querySelector('#catPct');
  if (countEl) countEl.textContent = en ? `${owned} / ${total} owned` : `${owned} / ${total} 所持`;
  if (pctEl) pctEl.textContent = `${pct}%`;
}

/* ================================================================
   イベント／色の絞り込みセレクトを構築
   ================================================================ */
function buildEventFilter() {
  const events = [...new Set(categoryItems.map(item => item.event))];
  events.sort((a, b) => {
    const ia = EVENT_ORDER.indexOf(a);
    const ib = EVENT_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  const select = containerEl.querySelector('#filterEvent');
  events.forEach(ev => {
    const opt = document.createElement('option');
    opt.value = ev;
    opt.textContent = trEvent(ev);
    select.appendChild(opt);
  });
}

// #filterColorは、そのカテゴリのアイテムにcolorフィールドがある場合のみ
// renderShell()が描画する（元のitem/cape.htmlだけが持つオプション）ため、
// 無い場合は何もしない
function buildColorFilter() {
  const select = containerEl.querySelector('#filterColor');
  if (!select) return;
  const colors = [...new Set(categoryItems.map(item => item.color).filter(Boolean))];
  colors.forEach(color => {
    const opt = document.createElement('option');
    opt.value = color;
    opt.textContent = color;
    select.appendChild(opt);
  });
}

// #filterTypeも同様に、item.typeを持つカテゴリだけに存在する
function buildTypeFilter() {
  const select = containerEl.querySelector('#filterType');
  if (!select) return;
  const types = [...new Set(categoryItems.map(item => item.type).filter(Boolean))];
  types.forEach(type => {
    const opt = document.createElement('option');
    opt.value = type;
    opt.textContent = type;
    select.appendChild(opt);
  });
}

/* ================================================================
   所持／お気に入り／ウィッシュリストのトグル
   ================================================================ */
function handleToggleOwned(id) {
  userStates.owned[id] = !userStates.owned[id];
  saveCategoryState(categoryConfig.key, userStates.owned, userStates.fav, categoryItems);
  if (userStates.owned[id]) recordItemAcquire(categoryConfig.key, id);
  else removeItemAcquireRecord(id);
  notifyTitlesCheck();

  const card = containerEl.querySelector(`#card_${id}`);
  if (card) {
    card.classList.toggle('is-owned', userStates.owned[id]);
    const toggleEl = card.matches('[role="button"]') ? card : card.querySelector('[role="button"]');
    if (toggleEl) toggleEl.setAttribute('aria-pressed', String(userStates.owned[id]));
    // 所持済みになった場合、自動でウィッシュリストから外れるためボタンの見た目も同期する
    if (userStates.owned[id]) {
      const wishBtn = card.querySelector('.cv-tile-wish-btn, .cv-wish-btn');
      if (wishBtn) wishBtn.classList.remove('is-wish');
    }
  }
  refreshHeaderScore();
}

function handleToggleFav(id, btn) {
  userStates.fav[id] = !userStates.fav[id];
  saveCategoryState(categoryConfig.key, userStates.owned, userStates.fav, categoryItems);

  btn.classList.toggle('is-fav', userStates.fav[id]);
  btn.innerHTML = userStates.fav[id]
    ? '<svg class="inline-icon" width="16" height="16" style="stroke:currentColor;fill:currentColor;stroke-width:1.6"><use href="#i-star"/></svg>'
    : '<svg class="inline-icon" width="16" height="16" style="stroke:currentColor;fill:none;stroke-width:1.6"><use href="#i-star"/></svg>';
}

function handleToggleWish(id, btn) {
  const added = toggleWishItem(categoryConfig.key, id);
  if (added === null) {
    showCatViewToast(CURRENT_LANG === 'en' ? 'Owned items cannot be added to the wishlist' : '所持済みのアイテムはウィッシュリストに追加できません');
    return;
  }
  btn.classList.toggle('is-wish', added);
}

/* ================================================================
   表示モード（グリッド／リスト）・グリッド列数
   ================================================================ */
function handleSetViewMode(mode) {
  if (mode !== 'grid' && mode !== 'list') return;
  viewMode = mode;
  storeSetViewMode(mode);
  updateViewToggleUI();
  filterAndRender();
}

function updateViewToggleUI() {
  const gridBtn = containerEl.querySelector('#viewBtnGrid');
  const listBtn = containerEl.querySelector('#viewBtnList');
  const container = containerEl.querySelector('#itemList');
  gridBtn.classList.toggle('active', viewMode === 'grid');
  gridBtn.setAttribute('aria-pressed', viewMode === 'grid');
  listBtn.classList.toggle('active', viewMode === 'list');
  listBtn.setAttribute('aria-pressed', viewMode === 'list');
  container.classList.toggle('cv-item-grid', viewMode === 'grid');
  container.classList.toggle('cv-item-list', viewMode === 'list');
}

function handleSetGridCols(val) {
  gridCols = val;
  storeSetGridCols(val);
  applyGridCols();
}

function applyGridCols() {
  const container = containerEl.querySelector('#itemList');
  container.style.gridTemplateColumns = gridCols === 'auto' ? '' : `repeat(${gridCols}, 1fr)`;
  const sel = containerEl.querySelector('#gridColsSelect');
  if (sel) sel.value = gridCols;
}

function handleResetFilters() {
  resetFilterPanel('.cv-control-panel', filterAndRender);
}

/* ================================================================
   フィルター・ソートを適用してレンダリング
   ================================================================ */
function filterAndRender() {
  const en = CURRENT_LANG === 'en';
  const fStatus = containerEl.querySelector('#filterStatus').value;
  const fFav = containerEl.querySelector('#filterFav').value;
  const fCost = containerEl.querySelector('#filterCost').value;
  const fDye = containerEl.querySelector('#filterDye').value;
  const fReprint = containerEl.querySelector('#filterReprint').value;
  const fEvent = containerEl.querySelector('#filterEvent').value;
  // #filterColorはcolorデータを持つカテゴリ（現状はcapeのみ）だけに存在する
  const fColor = containerEl.querySelector('#filterColor')?.value ?? 'all';
  const fType = containerEl.querySelector('#filterType')?.value ?? 'all';
  const sOrder = containerEl.querySelector('#sortOrder').value;
  const fName = containerEl.querySelector('#searchName').value.trim().toLowerCase();

  // 1. 絞り込み (Filter)
  let filtered = categoryItems.filter(item => {
    const isOwned = !!userStates.owned[item.id];
    const isFav = !!userStates.fav[item.id];

    if (fName && !item.name.toLowerCase().includes(fName) && !(item.nameEn && item.nameEn.toLowerCase().includes(fName))) return false;
    if (fStatus === 'owned' && !isOwned) return false;
    if (fStatus === 'notOwned' && isOwned) return false;
    if (fFav === 'fav' && !isFav) return false;
    if (fCost !== 'all' && item.cost !== fCost) return false;
    if (fDye === 'dye-o' && !item.dye) return false;
    if (fDye === 'dye-x' && item.dye) return false;
    if (fReprint === 'noReprint' && !item.noReprint) return false;
    if (fEvent !== 'all' && item.event !== fEvent) return false;
    if (fColor !== 'all' && item.color !== fColor) return false;
    if (fType !== 'all' && item.type !== fType) return false;

    return true;
  });

  // 2. 並び替え (Sort)
  if (sOrder === 'nameAsc') {
    filtered.sort((a, b) => trItem(a).localeCompare(trItem(b), en ? 'en' : 'ja'));
  } else if (sOrder === 'event') {
    filtered.sort((a, b) => trEvent(a.event).localeCompare(trEvent(b.event), en ? 'en' : 'ja'));
  } else if (sOrder === 'color') {
    filtered.sort((a, b) => (a.color || '').localeCompare(b.color || '', 'ja'));
  } else if (sOrder === 'type') {
    filtered.sort((a, b) => (a.type || '').localeCompare(b.type || '', 'ja'));
  }

  // 3. 出力 (Render)
  const listEl = containerEl.querySelector('#itemList');
  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="cv-empty-message">${en ? 'No matching items found.' : '該当するアイテムが見つかりません。'}</div>`;
    refreshHeaderScore();
    return;
  }

  const getItemViewData = (item) => {
    const isOwned = !!userStates.owned[item.id];
    const isFav = !!userStates.fav[item.id];
    const isWish = isWishItem(categoryConfig.key, item.id);
    const wikiUrl = `https://www.google.com/search?q=${encodeURIComponent(trItem(item) + '　Sky')}`;
    const imgSrc = item.img || `images/${categoryConfig.key}/${item.id}.png`;
    return { isOwned, isFav, isWish, wikiUrl, imgSrc };
  };

  const renderItemGrid = (item) => {
    const { isOwned, isFav, isWish, wikiUrl, imgSrc } = getItemViewData(item);
    const tip = [
      trItem(item),
      trEvent(item.event),
      item.cost === 'premium' ? (en ? 'Paid' : '課金') : (en ? 'Free' : '無課金'),
      en ? `Dye ${item.dye ? 'Yes' : 'No'}` : `染色${item.dye ? 'あり' : 'なし'}`,
      item.noReprint ? (en ? 'No Re-release' : '復刻なし') : '',
      item.color ? (en ? `Color: ${item.color}` : `色:${item.color}`) : '',
      typeEnabled() ? (item.type || '') : '',
    ].filter(Boolean).join(' ／ ');

    return `
      <div class="cv-item-tile">
        <div class="cv-item-tile-frame ${isOwned ? 'is-owned' : ''}" id="card_${item.id}" title="${escapeHtml(tip)}" onclick="window.__catViewToggleOwned('${item.id}')" tabindex="0" role="button" aria-pressed="${isOwned}" onkeydown="if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();window.__catViewToggleOwned('${item.id}');}">
          ${item.cost === 'premium' ? '<span class="cv-tile-cost-dot" aria-hidden="true"></span>' : ''}
          ${item.noReprint ? '<span class="cv-tile-nr-badge">NR</span>' : ''}
          <button class="cv-tile-fav-btn ${isFav ? 'is-fav' : ''}" onclick="event.stopPropagation(); window.__catViewToggleFav('${item.id}', this)" aria-label="${en ? 'Favorite' : 'お気に入り'}"><svg class="inline-icon" width="14" height="14" style="stroke:currentColor;fill:${isFav ? 'currentColor' : 'none'};stroke-width:1.6"><use href="#i-star"/></svg></button>
          <button class="cv-tile-wish-btn ${isWish ? 'is-wish' : ''}" onclick="event.stopPropagation(); window.__catViewToggleWish('${item.id}', this)" aria-label="${en ? 'Wishlist' : 'ウィッシュリスト'}" title="${en ? 'Add to wishlist' : 'ウィッシュリストに追加'}"><svg class="inline-icon" width="13" height="13" style="stroke:currentColor;fill:none;stroke-width:1.8"><use href="#i-cart"/></svg></button>
          <div class="cv-item-tile-img-wrap">
            <img src="${imgSrc}" alt="${escapeHtml(trItem(item))}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('cv-img-fallback')">
            <span class="cv-item-tile-fallback"><svg class="inline-icon" width="22" height="22"><use href="#i-wing"/></svg></span>
          </div>
          <span class="cv-tile-owned-check"><svg class="inline-icon" width="11" height="11" style="stroke:currentColor;fill:none;stroke-width:2.2"><use href="#i-check"/></svg></span>
        </div>
        <a href="${wikiUrl}" target="_blank" rel="noopener noreferrer" class="cv-item-tile-name">${trItem(item)}</a>
      </div>
    `;
  };

  const renderItemList = (item) => {
    const { isOwned, isFav, isWish, wikiUrl, imgSrc } = getItemViewData(item);

    return `
      <div class="cv-item-card ${isOwned ? 'is-owned' : ''}" id="card_${item.id}">
        <div class="cv-item-left" onclick="window.__catViewToggleOwned('${item.id}')" tabindex="0" role="button" aria-pressed="${isOwned}" onkeydown="if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();window.__catViewToggleOwned('${item.id}');}">
          <div class="cv-item-thumb">
            <img src="${imgSrc}" alt="${escapeHtml(trItem(item))}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('cv-img-fallback')">
            <span class="cv-item-thumb-fallback"><svg class="inline-icon" width="18" height="18"><use href="#i-wing"/></svg></span>
            <span class="cv-item-thumb-check"><svg class="inline-icon" width="10" height="10" style="stroke:currentColor;fill:none;stroke-width:2.2"><use href="#i-check"/></svg></span>
          </div>
          <div class="cv-item-details">
            <a href="${wikiUrl}" target="_blank" rel="noopener noreferrer" class="cv-item-name-link" onclick="event.stopPropagation();">
              ${trItem(item)} <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 14L20 4"/><path d="M14 4h6v6"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/></svg>
            </a>
            <div class="cv-item-meta-row">
              <span class="cv-badge">${trEvent(item.event)}</span>
              <span class="cv-badge ${item.cost === 'premium' ? 'cv-badge-premium' : 'cv-badge-free'}">${item.cost === 'premium' ? (en ? 'Paid' : '課金') : (en ? 'Free' : '無課金')}</span>
              <span class="cv-badge ${item.dye ? 'cv-badge-dye-o' : ''}">${en ? 'Dye' : '染色'} ${item.dye ? '<svg class="inline-icon" width="14" height="14" style="vertical-align:-2px"><use href="#i-check"/></svg>' : '<svg class="inline-icon" width="14" height="14" style="vertical-align:-2px"><use href="#i-close"/></svg>'}</span>
              ${item.noReprint ? `<span class="cv-badge cv-badge-no-reprint">${en ? 'No Re-release' : '復刻なし'}</span>` : ''}
              ${item.color ? `<span class="cv-badge cv-badge-color">${item.color}</span>` : ''}
              ${typeEnabled() && item.type ? `<span class="cv-badge cv-badge-color">${item.type}</span>` : ''}
            </div>
          </div>
        </div>
        <button class="cv-fav-btn ${isFav ? 'is-fav' : ''}" onclick="window.__catViewToggleFav('${item.id}', this)">
          <svg class="inline-icon" width="18" height="18" style="stroke:currentColor;fill:${isFav ? 'currentColor' : 'none'};stroke-width:1.6"><use href="#i-star"/></svg>
        </button>
        <button class="cv-wish-btn ${isWish ? 'is-wish' : ''}" onclick="window.__catViewToggleWish('${item.id}', this)" aria-label="${en ? 'Wishlist' : 'ウィッシュリスト'}" title="${en ? 'Add to wishlist' : 'ウィッシュリストに追加'}">
          <svg class="inline-icon" width="16" height="16" style="stroke:currentColor;fill:none;stroke-width:1.8"><use href="#i-cart"/></svg>
        </button>
      </div>
    `;
  };

  const renderItem = (item) => viewMode === 'list' ? renderItemList(item) : renderItemGrid(item);

  // タイプ別にグループ化（通常の服 → ワンジー の順。onesie divider の文言は
  // 元のcape.htmlでも常に日本語固定だったため、byte-level忠実優先でそのまま維持）
  const outfitItems = filtered.filter(item => item.type !== 'onesie');
  const onesieItems = filtered.filter(item => item.type === 'onesie');

  let html = outfitItems.map(renderItem).join('');

  if (onesieItems.length > 0) {
    if (outfitItems.length > 0) {
      html += `<div class="cv-onesie-divider"><span><svg class="inline-icon" width="15" height="15"><use href="#i-hanger"/></svg> ワンジー</span></div>`;
    }
    html += onesieItems.map(renderItem).join('');
  }

  listEl.innerHTML = html;

  refreshHeaderScore();
}

// 所持状態の変更のたびに称号の新規解禁が無いか確認し、あればトースト通知する
// （item/profiles.jsのrefreshTitlesUI()と同じ役割。ダッシュボード自身のパネル
// 再描画は次にダッシュボードを開いた時にtitlesPanel.mount()が行う）
function notifyTitlesCheck() {
  checkAndUnlockTitles().then(newlyEarned => {
    if (!newlyEarned || !newlyEarned.length) return;
    const msg = newlyEarned.length === 1
      ? (CURRENT_LANG === 'en' ? `Title unlocked: ${newlyEarned[0].nameEn}` : `称号解禁「${newlyEarned[0].name}」`)
      : (CURRENT_LANG === 'en' ? `${newlyEarned.length} titles unlocked!` : `称号を${newlyEarned.length}個解禁！`);
    showCatViewToast(msg);
  }).catch(e => console.error('[item category] title check failed', e));
}

/* ================================================================
   簡易トースト通知（ウィッシュリストに所持済みアイテムを追加しようとした時など）
   ================================================================ */
export function showCatViewToast(msg) {
  const t = document.createElement('div');
  t.className = 'cv-toast';
  t.textContent = msg;
  const stackIndex = document.querySelectorAll('.cv-toast').length;
  if (stackIndex > 0) t.style.bottom = `calc(84px + env(safe-area-inset-bottom) + ${stackIndex * 44}px)`;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600);
}

/* ================================================================
   スコープ付きスタイル注入（初回mount時のみ／CLAUDE.mdの
   「開くアニメーションはtransitionではなくanimationにする」規則は
   このビューにはdisplay:none⇔表示切替を伴うモーダル/シートが無いため
   非対象。トーストはopacity:0の実体を先に挿入してから次tickでクラスを
   付与する構成のため、そちらもtransitionで正しく発火する）
   ================================================================ */
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.item-view .cv-wrap { max-width: 720px; margin: 0 auto; }
@media (min-width: 850px) { .item-view .cv-wrap { max-width: 960px; } }

.item-view .cv-header-card {
  background: var(--card); border-radius: var(--r); padding: 20px; margin-top: 4px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.07); display: flex; align-items: center; justify-content: space-between; gap: 16px;
}
.item-view .cv-header-info { display: flex; align-items: center; gap: 12px; }
.item-view .cv-header-icon { width: 44px; height: 44px; background: var(--bg); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }
.item-view .cv-header-icon img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; display: block; }
.item-view .cv-header-name { font-size: 18px; font-weight: 700; }
.item-view .cv-header-count { font-size: 13px; color: var(--text-2); margin-top: 2px; }
.item-view .cv-header-pct { font-size: 24px; font-weight: 800; color: var(--orange); }

.item-view .cv-control-panel {
  background: var(--card); border-radius: var(--r); padding: 16px; margin-top: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.07); display: flex; flex-direction: column; gap: 12px;
}
.item-view .cv-control-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.item-view .cv-control-label { font-size: 12px; font-weight: 600; color: var(--text-2); min-width: 60px; }
.item-view .cv-select-box {
  background: var(--bg); border: none; padding: 8px 12px; border-radius: var(--r-sm);
  font-size: 13px; color: var(--text); font-weight: 500; outline: none; flex: 1; min-width: 120px;
  font-family: inherit;
}
.item-view .cv-search-input { font-size: 16px; }
.item-view .cv-search-input::placeholder { color: var(--text-3); }
.item-view .cv-control-reset-row { justify-content: flex-end; }
.item-view .cv-control-reset-btn {
  background: var(--bg); border: none; padding: 8px 14px; border-radius: var(--r-sm);
  font-size: 13px; font-weight: 600; color: var(--blue); transition: background 0.15s;
  display: inline-flex; align-items: center; gap: 4px; cursor: pointer; font-family: inherit;
}
.item-view .cv-control-reset-btn:active { background: var(--sep); }

.item-view .cv-list-header-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 22px 4px 8px; }
.item-view .cv-sec-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-2); margin: 0; }
.item-view .cv-view-toggle { display: flex; background: var(--bg); border-radius: 999px; padding: 3px; gap: 2px; flex-shrink: 0; }
.item-view .cv-view-toggle-btn {
  display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: var(--text-2);
  padding: 7px 12px; border-radius: 999px; border: 0; background: none; transition: background 0.15s, color 0.15s; cursor: pointer; font-family: inherit;
}
.item-view .cv-view-toggle-btn.active { background: var(--card); color: var(--text); font-weight: 700; box-shadow: 0 1px 3px rgba(0,0,0,0.12); }
.item-view .cv-grid-cols-select {
  background: var(--bg); border: none; padding: 6px 10px; border-radius: 999px;
  font-size: 12px; color: var(--text-2); font-weight: 600; outline: none; flex-shrink: 0; font-family: inherit;
}

.item-view .cv-item-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(82px, 1fr)); gap: 10px; align-items: start; }
.item-view .cv-item-tile { display: flex; flex-direction: column; gap: 5px; }

.item-view .cv-item-tile-frame {
  position: relative; aspect-ratio: 1 / 1; overflow: hidden; background: var(--card); border-radius: var(--r-sm);
  border: 2px solid transparent; box-shadow: 0 1px 4px rgba(0,0,0,0.07); cursor: pointer; transition: border-color 0.15s, transform 0.1s;
}
.item-view .cv-item-tile-frame:active { transform: scale(0.95); }
.item-view .cv-item-tile-frame.is-owned { border-color: var(--green); }

.item-view .cv-item-tile-img-wrap {
  position: absolute; inset: 0; z-index: 1; display: flex; align-items: center; justify-content: center;
  background: var(--bg); filter: grayscale(1) opacity(0.4); transition: filter 0.15s;
}
.item-view .cv-item-tile-frame.is-owned .cv-item-tile-img-wrap { filter: none; }
.item-view .cv-item-tile-img-wrap img { width: 100%; height: 100%; object-fit: contain; padding: 14%; display: block; }
.item-view .cv-item-tile-img-wrap.cv-img-fallback img { display: none; }
.item-view .cv-item-tile-fallback { display: none; font-size: 26px; }
.item-view .cv-item-tile-img-wrap.cv-img-fallback .cv-item-tile-fallback { display: block; }

.item-view .cv-tile-cost-dot {
  position: absolute; top: 5px; left: 5px; z-index: 2; width: 9px; height: 9px; border-radius: 50%;
  background: var(--orange); box-shadow: 0 0 0 2px rgba(255,255,255,0.85);
}
.item-view .cv-tile-nr-badge {
  position: absolute; bottom: 5px; left: 5px; z-index: 2; font-size: 9px; font-weight: 700; color: #fff;
  letter-spacing: 0.2px; background: rgba(215,0,21,0.9); padding: 1px 4px; border-radius: 4px;
}
.item-view .cv-tile-fav-btn {
  position: absolute; top: 3px; right: 3px; z-index: 2; width: 22px; height: 22px; border-radius: 50%;
  background: var(--tile-btn-bg); border: 0; display: flex; align-items: center;
  justify-content: center; font-size: 13px; color: var(--text-3); transition: transform 0.1s, background 0.15s, color 0.15s; cursor: pointer;
}
.item-view .cv-tile-fav-btn:active { transform: scale(1.15); }
.item-view .cv-tile-fav-btn.is-fav { color: #FF9500; background: rgba(255,149,0,0.16); }
.item-view .cv-tile-wish-btn {
  position: absolute; top: 29px; right: 3px; z-index: 2; width: 22px; height: 22px; border-radius: 50%;
  background: var(--tile-btn-bg); border: 0; display: flex; align-items: center;
  justify-content: center; font-size: 12px; color: var(--text-3); transition: transform 0.1s, background 0.15s, color 0.15s; cursor: pointer;
}
.item-view .cv-tile-wish-btn:active { transform: scale(1.15); }
.item-view .cv-tile-wish-btn.is-wish { color: var(--blue); background: rgba(0,122,255,0.18); }
.item-view .cv-tile-owned-check {
  position: absolute; bottom: 4px; right: 4px; z-index: 2; width: 19px; height: 19px; border-radius: 50%;
  background: var(--green); color: #fff; font-size: 11px; font-weight: 800; display: flex; align-items: center;
  justify-content: center; opacity: 0; transform: scale(0.4); transition: all 0.15s;
}
.item-view .cv-item-tile-frame.is-owned .cv-tile-owned-check { opacity: 1; transform: scale(1); }

.item-view .cv-item-tile-name {
  font-size: 10.5px; line-height: 1.3; text-align: center; color: var(--text-2); display: -webkit-box;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; padding: 0 1px;
}
.item-view .cv-item-tile-name:hover { color: var(--blue); }

.item-view .cv-item-list { display: flex; flex-direction: column; gap: 8px; }
.item-view .cv-item-card {
  background: var(--card); border-radius: var(--r); padding: 14px 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.07);
  display: flex; align-items: center; justify-content: space-between; gap: 12px; transition: background 0.2s;
}
.item-view .cv-item-card.is-owned { background: rgba(52,199,89,0.03); }
.item-view .cv-item-left { display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0; cursor: pointer; }

.item-view .cv-item-thumb {
  position: relative; width: 48px; height: 48px; flex-shrink: 0; border-radius: var(--r-sm); overflow: hidden;
  background: var(--bg); border: 2px solid transparent; display: flex; align-items: center; justify-content: center;
  filter: grayscale(1) opacity(0.45); transition: filter 0.15s, border-color 0.15s;
}
.item-view .cv-item-card.is-owned .cv-item-thumb { border-color: var(--green); filter: none; }
.item-view .cv-item-thumb img { width: 100%; height: 100%; object-fit: contain; padding: 15%; display: block; }
.item-view .cv-item-thumb.cv-img-fallback img { display: none; }
.item-view .cv-item-thumb-fallback { display: none; font-size: 20px; }
.item-view .cv-item-thumb.cv-img-fallback .cv-item-thumb-fallback { display: block; }
.item-view .cv-item-thumb-check {
  position: absolute; bottom: -3px; right: -3px; width: 17px; height: 17px; border-radius: 50%; background: var(--green);
  color: #fff; font-size: 10px; font-weight: 800; display: flex; align-items: center; justify-content: center;
  opacity: 0; transform: scale(0.4); transition: all 0.15s; border: 1.5px solid var(--card);
}
.item-view .cv-item-card.is-owned .cv-item-thumb-check { opacity: 1; transform: scale(1); }

.item-view .cv-item-details { flex: 1; min-width: 0; }
.item-view .cv-item-name-link {
  font-size: 15px; font-weight: 600; color: var(--text); display: inline-block; max-width: 100%;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.item-view .cv-item-name-link:hover { color: var(--blue); text-decoration: underline; }
.item-view .cv-item-meta-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }

.item-view .cv-badge { font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: var(--bg); color: var(--text-2); }
.item-view .cv-badge-premium { background: rgba(255,149,0,0.12); color: var(--orange-d); }
.item-view .cv-badge-free { background: rgba(0,122,255,0.1); color: var(--blue); }
.item-view .cv-badge-dye-o { background: rgba(52,199,89,0.12); color: var(--green); }
.item-view .cv-badge-no-reprint { background: rgba(255,59,48,0.10); color: #FF3B30; }
.item-view .cv-badge-color { background: rgba(175,82,222,0.10); color: #AF52DE; }

.item-view .cv-fav-btn { font-size: 20px; color: var(--text-3); padding: 4px; transition: transform 0.1s; flex-shrink: 0; cursor: pointer; background: none; border: none; }
.item-view .cv-fav-btn:active { transform: scale(1.2); }
.item-view .cv-fav-btn.is-fav { color: #FFCC00; text-shadow: 0 0 2px rgba(255,180,0,0.4); }
.item-view .cv-wish-btn { font-size: 18px; color: var(--text-3); padding: 4px; transition: transform 0.1s; flex-shrink: 0; cursor: pointer; background: none; border: none; }
.item-view .cv-wish-btn:active { transform: scale(1.2); }
.item-view .cv-wish-btn.is-wish { color: var(--blue); }

.item-view .cv-empty-message { grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-2); font-size: 14px; background: var(--card); border-radius: var(--r); }

.item-view .cv-onesie-divider {
  grid-column: 1 / -1; display: flex; align-items: center; gap: 10px; padding: 20px 4px 8px; color: var(--text-2);
  font-size: 11px; font-weight: 700; letter-spacing: 0.8px;
}
.item-view .cv-onesie-divider::before, .item-view .cv-onesie-divider::after {
  content: ''; flex: 1; height: 1.5px; background: linear-gradient(90deg, var(--sep), rgba(60,60,67,0.06)); border-radius: 2px;
}

.cv-toast {
  position: fixed; left: 50%; bottom: calc(84px + env(safe-area-inset-bottom)); transform: translateX(-50%) translateY(20px);
  background: rgba(28,28,30,0.92); color: #fff; font-size: 13px; font-weight: 600; padding: 10px 18px; border-radius: 999px;
  box-shadow: 0 4px 14px rgba(0,0,0,0.25); opacity: 0; transition: opacity 0.25s, transform 0.25s; z-index: 999;
  pointer-events: none; max-width: calc(100vw - 32px); text-align: center;
}
.cv-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
`;
  document.head.appendChild(style);
}

// 全アイテム一覧(all-items-view.js)が同じ cv-* スタイルを再利用するための公開名
export { injectStyles as injectCategoryViewStyles };

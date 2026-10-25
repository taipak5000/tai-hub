/* ================================================================
   music-sheet-view.js — 楽譜コンプリート管理

   移植元: item/music_sheet.html
   他12カテゴリ（category-view.js）と同じ「アイテム所持チェックリスト」
   系の機能だが、実データ形状（MUSIC_SHEETS: 入手方法R/P/S/D・楽器パート
   別難易度 diff{m,w,b,p}・調号key・キャンドル価格の有無）と絞り込み/
   表示UIが他カテゴリと十分に異なるため、item/cost-view.js と同じ前例に
   倣い、汎用category-view.jsを拡張するのではなく専用モジュールとして
   移植した（router-registry.js側のmusic_sheet分岐コメント参照。この
   モジュール自体をルートへ配線する作業は別途行われる）。

   状態の読み書きは他機能と同じ js/state.js の nsKey() を経由するが、
   保存形状が ownedItems を持たない点だけ他12カテゴリ
   （getCategoryState/saveCategoryState）と異なるため、専用の
   data/music-sheet-state.js に委譲している（詳細はそちらの冒頭コメント
   参照）。マスターデータ（MUSIC_SHEETS配列・SEASON_ORDER・
   METHOD_LABEL_*）は data/music-sheets-data.js に verbatim移植。
   お気に入り／ウィッシュリストは他機能と同じ isWishItem/toggleWishItem/
   removeWishItem（js/state.js）をそのまま使う。

   CSS: item.cssの共有トークン（--bg/--card/--orange/--blue/--green/--text等）
   を .item-view 経由でそのまま再利用しつつ、難易度ドット・入手方法チップ・
   調号バッジなどこのビュー固有の見た目だけを css/item-music-sheet.css という
   別ファイルに分離し、mount時に一度だけ<link>注入している
   （category-view.js/cost-view.jsはスタイルをJS内<style>テンプレート
   文字列として注入するが、このビューは専用ルールがまとまった分量になる
   ため可読性を優先してここだけ別ファイル化した——他機能ではこのパターンを
   新たに増やさないこと）。

   ── このtai-hub移植で意図的に簡略化した点 ──
   1. 難易度（diff.m/w/b/p、各1〜4）の表示を、元実装のテキスト行
      （例:「旋律2 / 管楽器3 / 低音1 / 打楽器2」）から、パート名+数値+
      4段階ドット（●●○○）の小さな視覚表現に変更した。数値そのもの・
      絞り込み/並び替えロジック（filterDiffPart/filterDiffMax/diffAsc）は
      元実装と完全に同一で、見た目の表現だけの差（グリッドタイルの
      title属性ツールチップは従来通りテキストのまま）。
   ================================================================ */
import { CURRENT_LANG, escapeHtml, trEvent, resetFilterPanel } from '../../js/i18n.js';
import { nsKey, isWishItem, toggleWishItem, removeWishItem } from '../../js/state.js';
import { CATEGORY_REGISTRY } from './data/categories.js';
import { MUSIC_SHEETS, SEASON_ORDER, METHOD_LABEL_JA, METHOD_LABEL_EN, CAT_KEY } from './data/music-sheets-data.js';
import { loadMusicSheetState, saveMusicSheetState } from './data/music-sheet-state.js';
import { appendItemFooter } from './item-footer.js';

const LINK_ID = 'item-music-sheet-styles-link';
const VIEW_MODE_KEY = 'musicSheets_viewMode'; // item/music_sheet.htmlと同一キー（あえてnsKey化しない。元実装もプロフィール非依存）

function t(ja, en) { return CURRENT_LANG === 'en' ? en : ja; }

// ── モジュール内状態（mount毎に更新される） ──────────────────
let containerEl = null;
let userStates = { owned: {}, fav: {} };
let viewMode = 'grid';

export function mount(container) {
  injectLinkStyles();
  containerEl = container;
  userStates = loadMusicSheetState();
  viewMode = localStorage.getItem(VIEW_MODE_KEY) || 'grid';

  container.innerHTML = renderShell();
  appendItemFooter(container, 'music_sheet');

  window.__msViewToggleOwned = handleToggleOwned;
  window.__msViewToggleFav = handleToggleFav;
  window.__msViewToggleWish = handleToggleWish;
  window.__msViewSetViewMode = handleSetViewMode;
  window.__msViewFilterAndRender = filterAndRender;
  window.__msViewResetFilters = handleResetFilters;

  updateViewToggleUI();
  buildSeasonFilter();
  filterAndRender();
  // 総合メニュー・アイテム別コスト等（gameItems_music_sheet を参照する他機能）への
  // 反映のため、表示のたびに保存し直す（元実装のDOMContentLoaded内の挙動と同じ）
  persistState();
}

export function unmount() {
  delete window.__msViewToggleOwned;
  delete window.__msViewToggleFav;
  delete window.__msViewToggleWish;
  delete window.__msViewSetViewMode;
  delete window.__msViewFilterAndRender;
  delete window.__msViewResetFilters;
  containerEl = null;
}

/* ================================================================
   描画：外枠（戻るリンク・ヘッダーバナー・フィルターパネル・一覧見出し）
   ================================================================ */
function renderShell() {
  const en = CURRENT_LANG === 'en';
  const cfg = CATEGORY_REGISTRY.find(c => c.key === CAT_KEY) || {};
  const catName = en ? cfg.nameEn : cfg.name;

  return `
    <div class="item-view">
      <div class="ms-wrap">
        <a href="#/item" class="back-link">${en ? '&larr; Back to Category List' : '&larr; カテゴリ一覧へ戻る'}</a>
        <h1 class="item-large-title">${t('楽譜コンプリート管理', 'Music Sheet Completion')}</h1>

        <div class="ms-header-card">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:16px;">
            <div class="ms-header-info">
              <div class="ms-header-icon"><svg class="inline-icon" width="24" height="24"><use href="#i-sheet-music"/></svg></div>
              <div>
                <div class="ms-header-name">${escapeHtml(catName)}</div>
                <div class="ms-header-count" id="msCatCount">-- / -- ${en ? 'owned' : '所持'}</div>
              </div>
            </div>
            <div class="ms-header-pct" id="msCatPct">--%</div>
          </div>
          <div class="ms-method-summary" id="msMethodSummary"></div>
        </div>

        <div class="ms-control-panel">
          <div class="ms-control-row">
            <span class="ms-control-label">${t('名前検索', 'Name Search')}</span>
            <svg class="inline-icon" width="16" height="16"><use href="#i-search"/></svg>
            <input type="text" class="ms-select-box ms-search-input" id="msSearchName" placeholder="${t('楽譜名・番号で絞り込み...', 'Filter by name or number...')}" oninput="window.__msViewFilterAndRender()">
          </div>
          <div class="ms-control-row">
            <span class="ms-control-label">${t('絞り込み', 'Filter')}</span>
            <select class="ms-select-box" id="msFilterStatus" onchange="window.__msViewFilterAndRender()">
              <option value="all">${t('すべての所持状態', 'All ownership states')}</option>
              <option value="owned">${t('所持中のみ', 'Owned only')}</option>
              <option value="notOwned">${t('未所持のみ', 'Not owned only')}</option>
            </select>
            <select class="ms-select-box" id="msFilterFav" onchange="window.__msViewFilterAndRender()">
              <option value="all">${t('すべてのお気に入り', 'All favorites')}</option>
              <option value="fav">${t('お気に入り指定のみ', 'Favorites only')}</option>
            </select>
            <select class="ms-select-box" id="msFilterMethod" onchange="window.__msViewFilterAndRender()">
              <option value="all">${t('すべての入手方法', 'All acquisition methods')}</option>
              <option value="R">${t('恒常精霊', 'Realm Spirits')}</option>
              <option value="P">${t('常時交換可能', 'Always Tradable')}</option>
              <option value="S">${t('季節精霊', 'Season Spirits')}</option>
              <option value="D">${t('日々イベント', 'Days Events')}</option>
            </select>
          </div>
          <div class="ms-control-row">
            <span class="ms-control-label">${t('季節・入手元', 'Season')}</span>
            <select class="ms-select-box" id="msFilterSeason" onchange="window.__msViewFilterAndRender()">
              <option value="all">${t('すべての季節・入手元', 'All seasons/sources')}</option>
            </select>
          </div>
          <div class="ms-control-row">
            <span class="ms-control-label">${t('難易度', 'Difficulty')}</span>
            <select class="ms-select-box" id="msFilterDiffPart" onchange="window.__msViewFilterAndRender()">
              <option value="all">${t('すべてのパート', 'All parts')}</option>
              <option value="m">${t('旋律', 'Melody')}</option>
              <option value="w">${t('管楽器', 'Wind')}</option>
              <option value="b">${t('低音', 'Bass')}</option>
              <option value="p">${t('打楽器', 'Percussion')}</option>
            </select>
            <select class="ms-select-box" id="msFilterDiffMax" onchange="window.__msViewFilterAndRender()">
              <option value="all">${t('難易度指定なし', 'Any difficulty')}</option>
              <option value="1">${t('1以下（最も簡単）', '1 or below (Easiest)')}</option>
              <option value="2">${t('2以下', '2 or below')}</option>
              <option value="3">${t('3以下', '3 or below')}</option>
            </select>
          </div>
          <div class="ms-control-row">
            <span class="ms-control-label">${t('並び替え', 'Sort')}</span>
            <select class="ms-select-box" id="msSortOrder" onchange="window.__msViewFilterAndRender()">
              <option value="default">${t('並び替え: 標準（番号順）', 'Sort: Menu Order')}</option>
              <option value="nameAsc">${t('名前（昇順）', 'Name (A-Z)')}</option>
              <option value="priceDesc">${t('価格（高い順）', 'Price (High to Low)')}</option>
              <option value="season">${t('季節・入手元順', 'By Season/Source')}</option>
              <option value="diffAsc">${t('難易度（易しい順）', 'Difficulty (Easy to Hard)')}</option>
            </select>
          </div>
          <div class="ms-control-row ms-control-reset-row">
            <button type="button" class="ms-control-reset-btn" onclick="window.__msViewResetFilters()">
              <svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg> <span>${t('フィルターを全てクリア', 'Clear All Filters')}</span>
            </button>
          </div>
        </div>

        <div class="ms-list-header-row">
          <p class="ms-sec-label">${t('楽譜一覧', 'Music Sheet List')}</p>
          <div class="ms-view-toggle" role="group" aria-label="${t('表示切替', 'View mode')}">
            <button type="button" class="ms-view-toggle-btn" id="msViewBtnGrid" onclick="window.__msViewSetViewMode('grid')" aria-pressed="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
              <span>${t('グリッド', 'Grid')}</span>
            </button>
            <button type="button" class="ms-view-toggle-btn" id="msViewBtnList" onclick="window.__msViewSetViewMode('list')" aria-pressed="false">
              <svg class="inline-icon" width="14" height="14"><use href="#i-menu"/></svg>
              <span>${t('リスト', 'List')}</span>
            </button>
          </div>
        </div>
        <div class="ms-item-grid" id="msItemList"></div>
      </div>
    </div>
  `;
}

/* ================================================================
   季節・入手元の絞り込みセレクトを構築（SEASON_ORDER準拠、無い場合は末尾）
   ================================================================ */
function buildSeasonFilter() {
  const seasons = [...new Set(MUSIC_SHEETS.map(s => s.season))];
  seasons.sort((a, b) => {
    const ia = SEASON_ORDER.indexOf(a);
    const ib = SEASON_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  const select = containerEl.querySelector('#msFilterSeason');
  seasons.forEach(season => {
    const opt = document.createElement('option');
    opt.value = season;
    opt.textContent = trEvent(season);
    select.appendChild(opt);
  });
}

/* ================================================================
   保存・ヘッダー集計
   ================================================================ */
function persistState() {
  saveMusicSheetState(userStates.owned, userStates.fav, MUSIC_SHEETS);
}

function updateHeaderScore() {
  const en = CURRENT_LANG === 'en';
  const total = MUSIC_SHEETS.length;
  const owned = MUSIC_SHEETS.filter(s => userStates.owned[s.id]).length;
  const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
  const countEl = containerEl.querySelector('#msCatCount');
  const pctEl = containerEl.querySelector('#msCatPct');
  if (countEl) countEl.textContent = en ? `${owned} / ${total} owned` : `${owned} / ${total} 所持`;
  if (pctEl) pctEl.textContent = `${pct}%`;
}

// 入手方法ごとの所持内訳（R/P/S/D）をヘッダー下に表示
function updateMethodSummary() {
  const en = CURRENT_LANG === 'en';
  const methods = ['R', 'P', 'S', 'D'];
  const html = methods.map(m => {
    const group = MUSIC_SHEETS.filter(s => s.method === m);
    const owned = group.filter(s => userStates.owned[s.id]).length;
    const label = en ? METHOD_LABEL_EN[m] : METHOD_LABEL_JA[m];
    return `<span class="ms-method-chip on-${m}"><span class="dot"></span>${owned}/${group.length} ${label}</span>`;
  }).join('');
  const el = containerEl.querySelector('#msMethodSummary');
  if (el) el.innerHTML = html;
}

// 難易度が未公開（null）の楽譜は「?」と表示する
const dq = (v) => (v == null ? '?' : v);
function trKey(k) {
  return CURRENT_LANG === 'en' ? k.replace('メジャー', ' Major').trim() : k;
}

function sheetDisplayName(s) {
  return CURRENT_LANG === 'en' ? (s.nameEn || s.name) : s.name;
}

// 精霊名の表示（精霊がいない入手元＝奏の音楽堂・日々イベントの場合はnull）
function spiritDisplayName(s) {
  if (!s.spirit) return null;
  return CURRENT_LANG === 'en' ? (s.spiritEn || s.spirit) : s.spirit;
}

/* ================================================================
   所持／お気に入り／ウィッシュリストのトグル
   ================================================================ */
function handleToggleOwned(id) {
  userStates.owned[id] = !userStates.owned[id];
  persistState();
  // 所持済みになった場合、自動でウィッシュリストから外す（カテゴリページと同じ挙動）
  if (userStates.owned[id]) removeWishItem(CAT_KEY, id);

  const card = containerEl.querySelector(`#card_${id}`);
  if (card) {
    card.classList.toggle('is-owned', userStates.owned[id]);
    const toggleEl = card.matches('[role="button"]') ? card : card.querySelector('[role="button"]');
    if (toggleEl) toggleEl.setAttribute('aria-pressed', String(userStates.owned[id]));
    if (userStates.owned[id]) {
      const wishBtn = card.querySelector('.ms-tile-wish-btn, .ms-wish-btn');
      if (wishBtn) wishBtn.classList.remove('is-wish');
    }
  }
  updateHeaderScore();
  updateMethodSummary();
}

function handleToggleFav(id, btn) {
  userStates.fav[id] = !userStates.fav[id];
  persistState();
  btn.classList.toggle('is-fav', userStates.fav[id]);
  btn.innerHTML = `<svg class="inline-icon" width="16" height="16" style="stroke:currentColor;fill:${userStates.fav[id] ? 'currentColor' : 'none'};stroke-width:1.6"><use href="#i-star"/></svg>`;
}

function handleToggleWish(id, btn) {
  const added = toggleWishItem(CAT_KEY, id);
  if (added === null) {
    showMsToast(t('所持済みのアイテムはウィッシュリストに追加できません', 'Owned items cannot be added to the wishlist'));
    return;
  }
  btn.classList.toggle('is-wish', added);
}

/* ================================================================
   表示モード（グリッド／リスト）
   ================================================================ */
function handleSetViewMode(mode) {
  if (mode !== 'grid' && mode !== 'list') return;
  viewMode = mode;
  localStorage.setItem(VIEW_MODE_KEY, mode);
  updateViewToggleUI();
  filterAndRender();
}

function updateViewToggleUI() {
  const gridBtn = containerEl.querySelector('#msViewBtnGrid');
  const listBtn = containerEl.querySelector('#msViewBtnList');
  const list = containerEl.querySelector('#msItemList');
  gridBtn.classList.toggle('active', viewMode === 'grid');
  gridBtn.setAttribute('aria-pressed', viewMode === 'grid');
  listBtn.classList.toggle('active', viewMode === 'list');
  listBtn.setAttribute('aria-pressed', viewMode === 'list');
  list.classList.toggle('ms-item-grid', viewMode === 'grid');
  list.classList.toggle('ms-item-list', viewMode === 'list');
}

function handleResetFilters() {
  resetFilterPanel('.ms-control-panel', filterAndRender);
}

/* ================================================================
   難易度ドット（1〜4段階を●●○○のように可視化する小さな表現。
   元実装のテキスト表示を視覚的に簡略化した部分——詳細はファイル
   冒頭の「意図的に簡略化した点」コメント参照）
   ================================================================ */
function diffDotsHtml(value) {
  let dots = '';
  for (let i = 1; i <= 4; i++) dots += `<span class="ms-diff-dot${i <= value ? ' on' : ''}"></span>`;
  return dots;
}

/* ================================================================
   フィルター・ソートを適用してレンダリング
   ================================================================ */
function filterAndRender() {
  const en = CURRENT_LANG === 'en';
  const fStatus = containerEl.querySelector('#msFilterStatus').value;
  const fFav = containerEl.querySelector('#msFilterFav').value;
  const fMethod = containerEl.querySelector('#msFilterMethod').value;
  const fSeason = containerEl.querySelector('#msFilterSeason').value;
  const fDiffPart = containerEl.querySelector('#msFilterDiffPart').value;
  const fDiffMax = containerEl.querySelector('#msFilterDiffMax').value;
  const sOrder = containerEl.querySelector('#msSortOrder').value;
  const fName = containerEl.querySelector('#msSearchName').value.trim().toLowerCase();

  let filtered = MUSIC_SHEETS.filter(s => {
    const isOwned = !!userStates.owned[s.id];
    const isFav = !!userStates.fav[s.id];
    if (fName) {
      const hay = `${s.num} ${s.name} ${s.nameEn || ''} ${s.spirit || ''} ${s.spiritEn || ''} ${s.season}`.toLowerCase();
      if (!hay.includes(fName)) return false;
    }
    if (fStatus === 'owned' && !isOwned) return false;
    if (fStatus === 'notOwned' && isOwned) return false;
    if (fFav === 'fav' && !isFav) return false;
    if (fMethod !== 'all' && s.method !== fMethod) return false;
    if (fSeason !== 'all' && s.season !== fSeason) return false;
    if (fDiffPart !== 'all' && fDiffMax !== 'all' && s.diff[fDiffPart] > Number(fDiffMax)) return false;
    return true;
  });

  // パート未指定時は4パート合計、パート指定時はそのパートの値で難易度を評価する
  const diffScore = (s) => fDiffPart !== 'all' ? s.diff[fDiffPart] : (s.diff.m + s.diff.w + s.diff.b + s.diff.p);

  if (sOrder === 'nameAsc') {
    filtered.sort((a, b) => sheetDisplayName(a).localeCompare(sheetDisplayName(b), en ? 'en' : 'ja'));
  } else if (sOrder === 'priceDesc') {
    filtered.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
  } else if (sOrder === 'season') {
    filtered.sort((a, b) => {
      const ia = SEASON_ORDER.indexOf(a.season), ib = SEASON_ORDER.indexOf(b.season);
      if (ia !== ib) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      return Number(a.id.replace(/\D/g, '')) - Number(b.id.replace(/\D/g, ''));
    });
  } else if (sOrder === 'diffAsc') {
    filtered.sort((a, b) => diffScore(a) - diffScore(b));
  }

  const listEl = containerEl.querySelector('#msItemList');
  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="ms-empty-message">${t('該当する楽譜が見つかりません。', 'No matching music sheets found.')}</div>`;
    updateHeaderScore();
    updateMethodSummary();
    return;
  }

  const priceLabel = (s) => s.price === null
    ? `<span class="ms-badge ms-price-unknown">${t('価格: -', 'Price: -')}</span>`
    : `<span class="ms-badge"><svg class="inline-icon" width="12" height="12"><use href="#i-candle"/></svg> ${s.price}</span>`;

  const renderGrid = (s) => {
    const isOwned = !!userStates.owned[s.id];
    const isFav = !!userStates.fav[s.id];
    const isWish = isWishItem(CAT_KEY, s.id);
    const dispName = sheetDisplayName(s);
    const spiritName = spiritDisplayName(s);
    const tip = [
      `${en ? 'No.' : '№'}${s.num} ${dispName}`,
      en ? METHOD_LABEL_EN[s.method] : METHOD_LABEL_JA[s.method],
      trEvent(s.season),
      spiritName ? (en ? `Spirit: ${spiritName}` : `精霊: ${spiritName}`) : '',
      s.price === null ? (en ? 'Price unlisted on wiki' : '価格: Wiki未記載') : (en ? `Price: ${s.price}` : `価格: ${s.price}`),
      trKey(s.key),
      `${en ? 'Melody' : '旋律'}${dq(s.diff.m)} / ${en ? 'Wind' : '管楽器'}${dq(s.diff.w)} / ${en ? 'Bass' : '低音'}${dq(s.diff.b)} / ${en ? 'Percussion' : '打楽器'}${dq(s.diff.p)}`,
      s.note ? (en ? (s.noteEn || s.note) : s.note) : ''
    ].filter(Boolean).join(' ／ ');
    const wikiUrl = `https://www.google.com/search?q=${encodeURIComponent('Sky 星を紡ぐ子どもたち 楽譜 ' + s.name)}`;

    return `
      <div class="ms-item-tile">
        <div class="ms-sheet-frame ${isOwned ? 'is-owned' : ''}" id="card_${s.id}" title="${escapeHtml(tip)}" onclick="window.__msViewToggleOwned('${s.id}')" tabindex="0" role="button" aria-pressed="${isOwned}" onkeydown="if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();window.__msViewToggleOwned('${s.id}');}">
          <button class="ms-tile-fav-btn ${isFav ? 'is-fav' : ''}" onclick="event.stopPropagation(); window.__msViewToggleFav('${s.id}', this)" aria-label="${t('お気に入り', 'Favorite')}"><svg class="inline-icon" width="16" height="16" style="stroke:currentColor;fill:${isFav ? 'currentColor' : 'none'};stroke-width:1.6"><use href="#i-star"/></svg></button>
          <button class="ms-tile-wish-btn ${isWish ? 'is-wish' : ''}" onclick="event.stopPropagation(); window.__msViewToggleWish('${s.id}', this)" aria-label="${t('ウィッシュリスト', 'Wishlist')}" title="${t('ウィッシュリストに追加', 'Add to wishlist')}"><svg class="inline-icon" width="13" height="13" style="stroke:currentColor;fill:none;stroke-width:1.8"><use href="#i-cart"/></svg></button>
          <div class="ms-sheet-img-wrap">
            <img src="${s.img}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('ms-img-fallback')">
            <span class="ms-sheet-note-icon"><svg class="inline-icon" width="18" height="18"><use href="#i-music-note"/></svg></span>
          </div>
          <span class="ms-sheet-method-dot m-${s.method}" aria-hidden="true"></span>
          <span class="ms-sheet-num-badge">${s.num}</span>
          <span class="ms-tile-owned-check"><svg class="inline-icon" width="11" height="11" style="stroke:currentColor;fill:none;stroke-width:2.2"><use href="#i-check"/></svg></span>
        </div>
        <a href="${wikiUrl}" target="_blank" rel="noopener noreferrer" class="ms-item-tile-name">${escapeHtml(dispName)}</a>
      </div>
    `;
  };

  const renderList = (s) => {
    const isOwned = !!userStates.owned[s.id];
    const isFav = !!userStates.fav[s.id];
    const isWish = isWishItem(CAT_KEY, s.id);
    const dispName = sheetDisplayName(s);
    const spiritName = spiritDisplayName(s);
    const wikiUrl = `https://www.google.com/search?q=${encodeURIComponent('Sky 星を紡ぐ子どもたち 楽譜 ' + s.name)}`;
    const diffParts = [
      [t('旋律', 'Melody'), s.diff.m],
      [t('管楽器', 'Wind'), s.diff.w],
      [t('低音', 'Bass'), s.diff.b],
      [t('打楽器', 'Percussion'), s.diff.p],
    ];
    const diffHtml = diffParts.map(([label, v]) => `<span class="ms-diff-part">${label} ${dq(v)} ${diffDotsHtml(v)}</span>`).join('');

    return `
      <div class="ms-item-card ${isOwned ? 'is-owned' : ''}" id="card_${s.id}">
        <div class="ms-item-left" onclick="window.__msViewToggleOwned('${s.id}')" tabindex="0" role="button" aria-pressed="${isOwned}" onkeydown="if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();window.__msViewToggleOwned('${s.id}');}">
          <div class="ms-sheet-thumb">
            <img src="${s.img}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('ms-img-fallback')">
            <span class="ms-sheet-note-icon"><svg class="inline-icon" width="15" height="15"><use href="#i-music-note"/></svg></span>
            <span class="ms-sheet-thumb-num-badge">${s.num}</span>
            <span class="ms-sheet-thumb-check"><svg class="inline-icon" width="11" height="11" style="stroke:currentColor;fill:none;stroke-width:2.2"><use href="#i-check"/></svg></span>
          </div>
          <div class="ms-item-details">
            <a href="${wikiUrl}" target="_blank" rel="noopener noreferrer" class="ms-item-name-link" onclick="event.stopPropagation();">
              ${escapeHtml(dispName)} <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 14L20 4"/><path d="M14 4h6v6"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/></svg>
            </a>
            <div class="ms-item-meta-row">
              <span class="ms-badge ms-method-${s.method}">${en ? METHOD_LABEL_EN[s.method] : METHOD_LABEL_JA[s.method]}</span>
              ${priceLabel(s)}
              <span class="ms-badge ms-key-badge">${trKey(s.key)}</span>
              ${s.note ? `<span class="ms-badge">${escapeHtml(en ? (s.noteEn || s.note) : s.note)}</span>` : ''}
            </div>
            <div class="ms-source-row"><svg class="inline-icon" width="12" height="12"><use href="#i-calendar"/></svg> ${trEvent(s.season)}${spiritName ? ` ・ ${t('精霊', 'Spirit')}: ${escapeHtml(spiritName)}` : ''}</div>
            <div class="ms-diff-row">${diffHtml}</div>
          </div>
        </div>
        <button class="ms-fav-btn ${isFav ? 'is-fav' : ''}" onclick="window.__msViewToggleFav('${s.id}', this)"><svg class="inline-icon" width="18" height="18" style="stroke:currentColor;fill:${isFav ? 'currentColor' : 'none'};stroke-width:1.6"><use href="#i-star"/></svg></button>
        <button class="ms-wish-btn ${isWish ? 'is-wish' : ''}" onclick="window.__msViewToggleWish('${s.id}', this)" aria-label="${t('ウィッシュリスト', 'Wishlist')}" title="${t('ウィッシュリストに追加', 'Add to wishlist')}"><svg class="inline-icon" width="16" height="16" style="stroke:currentColor;fill:none;stroke-width:1.8"><use href="#i-cart"/></svg></button>
      </div>
    `;
  };

  listEl.innerHTML = filtered.map(viewMode === 'list' ? renderList : renderGrid).join('');
  updateHeaderScore();
  updateMethodSummary();
}

/* ================================================================
   簡易トースト通知（ウィッシュリストに所持済みアイテムを追加しようとした時など）
   ================================================================ */
function showMsToast(msg) {
  const elToast = document.createElement('div');
  elToast.className = 'ms-toast';
  elToast.textContent = msg;
  const stackIndex = document.querySelectorAll('.ms-toast').length;
  if (stackIndex > 0) elToast.style.bottom = `calc(84px + env(safe-area-inset-bottom) + ${stackIndex * 44}px)`;
  document.body.appendChild(elToast);
  setTimeout(() => elToast.classList.add('show'), 10);
  setTimeout(() => { elToast.classList.remove('show'); setTimeout(() => elToast.remove(), 300); }, 2600);
}

/* ================================================================
   このビュー専用CSSの<link>注入（1回だけ。詳細はファイル冒頭コメント参照）
   ================================================================ */
function injectLinkStyles() {
  if (document.getElementById(LINK_ID)) return;
  const link = document.createElement('link');
  link.id = LINK_ID;
  link.rel = 'stylesheet';
  link.href = 'css/item-music-sheet.css';
  document.head.appendChild(link);
}

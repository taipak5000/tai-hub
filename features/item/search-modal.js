/* ================================================================
   search-modal.js — 季節・イベント横断のアイテム検索モーダル

   item/index.html の横断検索モーダル（#itemSearchModal / openItemSearch() /
   renderGlobalSearch() 系一式）を移植したもの。dashboard-view.js が持つ
   「名前だけの簡易インライン検索バー」とは別物で、季節・イベント／カテゴリ／
   所持状態／お気に入り／詳細な絞り込み・並び替えを備えたフル機能の検索
   モーダルをここに実装する。

   データ読み込みは dashboard-view.js と同じ方式（12種のグリッドカテゴリの
   data/items/<key>.js を dynamic import して1つの配列へまとめる）をこの
   ファイル内に複製している。dashboard-view.js 側のキャッシュを直接
   importして共有してはいない（dashboard-view.js はこのファイルから見て
   「触ってはいけない」既存ファイルであり、後続パスでの配線をシンプルに
   保つため、このモジュールは他ファイルに依存せず単体で完結させている）。
   元実装（item/index.html）はさらに古い「各カテゴリページ本体を自己fetch
   してHTMLからITEMS_DATAを正規表現で抜き出す」方式だったが、SPA化に伴い
   dynamic importに置き換えている（dashboard-view.jsの冒頭コメントと同じ、
   tai-hub移植時の意図的なアーキテクチャ改善）。

   状態の読み書きは js/state.js の getCategoryState()/saveCategoryState()
   に委譲している。これは category-view.js 自身が書き込むのと完全に同じ
   localStorageキー（gameItems_<catKey>）・同じ形状であり、検索結果からの
   トグルはカテゴリページ側にもそのまま反映される（同一のストレージを見て
   いるだけなので、双方向で常に同期している）。

   ── エクスポート契約 ──────────────────────────────────────────
     export function open()  … モーダルを開く（初回のみ全カテゴリの
                                アイテムデータを読み込み、以後はキャッシュを再利用）
     export function close() … モーダルを閉じる
   ダッシュボードの「アイテム検索」カードから
   `import * as itemSearchModal from './search-modal.js'; itemSearchModal.open()`
   のように呼び出す想定（js/chrome/site-dock.js が pf-modal.js 等を
   呼び出しているのと同じ import-as-namespace の作法）。

   ── 元実装(item/index.html)と同じ機能をすべて備えている ───────────────
   「現在開催中のみ」内の季節／日々／再訪のサブフィルター、恒常精霊のエリア・大精霊の
   絞り込み、「絞り込み結果をすべて所持済みにする」一括操作、検索結果の行ごとの
   ウィッシュリスト追加ボタン。
   その他（季節・イベントの全履歴を含むプルダウン、カテゴリ・所持・
   お気に入りの絞り込み、詳細な絞り込み・並び替え[並び替え・課金/無課金・
   復刻・染色]、フィルター全クリア、結果件数表示「N件（所持M件）」）は
   元実装のロジック・文言をそのまま移植している。
   ================================================================ */

import { CURRENT_LANG, trEvent, trCat, trItem, escapeHtml, resetFilterPanel } from '../../js/i18n.js';
import { getCategoryState, saveCategoryState, recordItemAcquire, removeItemAcquireRecord, isWishItem, toggleWishItem } from '../../js/state.js';
import { CATEGORY_REGISTRY } from './data/categories.js';
import { isSeasonLikeEvent, getCurrentEventNames, REVISIT_SPIRIT_SCHEDULES, isRevisitScheduleActive } from './data/season-data.js';
import { REGULAR_ITEM_AREA, REGULAR_ELDER_IDS, REGULAR_AREA_ORDER, REGULAR_AREA_JA, REGULAR_AREA_EN } from './data/regular-areas.js';
import { ITEM_YOMI } from './data/yomi-data.js';
import { checkAndUnlockTitles } from './titles-panel.js';

// 12種のウェアラブルカテゴリのみが検索対象（section:'special' の楽譜は対象外。
// item/index.htmlのCATS配列も同じ12件のみで、楽譜は横断検索の対象に含まれていない）
const GRID_CATEGORIES = CATEGORY_REGISTRY.filter(c => c.section === 'grid');

// 季節は実装順（登場した順）、日々は来福の日々を起点とした年間の開催順。
// item/index.html・category-view.jsのEVENT_ORDERと同一の複製（カテゴリ固有
// データではなく複数ファイルで共通利用される定数のため、各ファイルで複製する
// という既存の方針=category-view.jsに倣っている）。リストに無いイベント名
// （コラボ・単発イベント等）は登場順のまま末尾に続く。
const EVENT_ORDER = [
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

const STYLE_ID = 'item-search-modal-styles';
const OVERLAY_ID = 'itemSearchModalOverlay';

/* ================================================================
   全カテゴリのアイテムデータ読み込み（dashboard-view.jsのloadCategoryItems/
   loadSearchIndexと同じ方式をこのファイル内に複製。dashboard-view.js冒頭
   コメント参照）
   ================================================================ */
const itemModuleCache = new Map(); // catKey -> Promise<{ITEMS}>
const resolvedItemsByCat = new Map(); // catKey -> ITEMS[]（所持/お気に入りトグル時にsaveCategoryStateへ渡す同期アクセス用）

function loadCategoryItems(catKey) {
  if (!itemModuleCache.has(catKey)) {
    const p = import(`./data/items/${catKey}.js`).then(mod => {
      resolvedItemsByCat.set(catKey, Array.isArray(mod.ITEMS) ? mod.ITEMS : []);
      return mod;
    });
    itemModuleCache.set(catKey, p);
  }
  return itemModuleCache.get(catKey);
}

let allItemsCache = null; // [{ ...item, catKey }, ...]（全カテゴリ分をフラット化）
let allItemsPromise = null;

function loadAllItemsOnce() {
  if (allItemsCache) return Promise.resolve(allItemsCache);
  if (allItemsPromise) return allItemsPromise;

  allItemsPromise = Promise.all(GRID_CATEGORIES.map(async cat => {
    try {
      const mod = await loadCategoryItems(cat.key);
      const items = Array.isArray(mod.ITEMS) ? mod.ITEMS : [];
      return items.map(item => {
        const area = REGULAR_ITEM_AREA[item.id];
        // 恒常精霊アイテムのエリア・大精霊（item/index.htmlのloadAllItemsOnceと同じ）
        return area ? { ...item, catKey: cat.key, regularArea: area, isElderItem: REGULAR_ELDER_IDS.has(item.id) } : { ...item, catKey: cat.key };
      });
    } catch (e) {
      console.error(`[item search] failed to load item data: ${cat.key}`, e);
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

/* 検索用にひらがなをカタカナへ正規化する（item/index.htmlのnormalizeSearchText
   と同一。ひらがな入力でもカタカナ表記のアイテム名にヒットさせるため） */
function normalizeSearchText(str) {
  return String(str).toLowerCase().replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

// イベント名が「季節」系か「日々」系かを判定（季節・イベント欄のoptgroup分け、
// 「現在開催中のみ」判定で共通利用。item/index.htmlのisSeasonLikeEvent/
// isDayLikeEventと同一ロジック）
function isDayLikeEvent(e) { return !isSeasonLikeEvent(e) && (e.includes('日々') || e === 'Skyアニバーサリー'); }

// 今、いずれかの再訪スケジュールが進行中かどうか（「現在開催中のみ」内の「再訪のみ」を出すか決める）
function isRevisitSpiritCurrentlyActive() {
  return REVISIT_SPIRIT_SCHEDULES.some(isRevisitScheduleActive);
}

// 指定アイテムが「今まさに来訪中」の再訪精霊アイテムかどうか
// （item/index.htmlのisRevisitSpiritItemと同一ロジック。season-data.jsに
// 既に移植済みのREVISIT_SPIRIT_SCHEDULES/isRevisitScheduleActiveを再利用する）
function isRevisitSpiritItem(item) {
  return REVISIT_SPIRIT_SCHEDULES.some(schedule =>
    isRevisitScheduleActive(schedule) && schedule.items.some(i => i.catKey === item.catKey && i.id === item.id)
  );
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

  if (allItemsCache) {
    buildEventOptions();
    render();
    return;
  }

  showLoading();
  try {
    await loadAllItemsOnce();
    // 読み込み待ち中にモーダルが閉じられ、別のoverlayに置き換わっていないか確認
    if (!overlayEl || !document.body.contains(overlayEl)) return;
    buildEventOptions();
    render();
  } catch (e) {
    console.error('[item search] failed to load item data for search', e);
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
    <div class="modal-card sm-card">
      <button type="button" class="modal-close-btn" id="smCloseX" aria-label="${en ? 'Close' : '閉じる'}">
        <svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg>
      </button>
      <div class="modal-title">${en ? 'Item Search' : 'アイテム検索'}</div>

      <div class="sm-panel">
        <div class="sm-row">
          <div class="sm-search-box">
            <svg class="inline-icon" width="15" height="15" style="flex-shrink:0;color:var(--hub-text-2)"><use href="#i-search"/></svg>
            <input type="text" class="sm-input" id="smName" autocomplete="off"
                   placeholder="${en ? 'Search by item name, season, or day...' : 'アイテム名・季節/日々で検索...'}">
          </div>
        </div>
        <div class="sm-row">
          <label class="sm-toggle">
            <input type="checkbox" id="smCurrentOnly">
            <span>${en ? 'Currently available only' : '現在開催中の季節・イベントのみ'}</span>
          </label>
        </div>
        <div class="sm-row" id="smCurrentTypeRow" style="display:none;">
          <select class="sm-select" id="smCurrentType">
            <option value="all">${en ? 'All (Season/Day/Revisit)' : 'すべて（季節・日々・再訪）'}</option>
          </select>
        </div>
        <div class="sm-row">
          <select class="sm-select" id="smEvent">
            <option value="all">${en ? 'All Seasons/Events' : 'すべての季節・イベント'}</option>
          </select>
        </div>
        <div class="sm-row sm-row-multi">
          <select class="sm-select" id="smCat">
            <option value="all">${en ? 'All Categories' : 'すべてのカテゴリ'}</option>
            ${GRID_CATEGORIES.map(c => `<option value="${c.key}">${escapeHtml(trCat(c.name))}</option>`).join('')}
          </select>
          <select class="sm-select" id="smOwned">
            <option value="all">${en ? 'All Ownership States' : 'すべての所持状態'}</option>
            <option value="owned">${en ? 'Owned Only' : '所持中のみ'}</option>
            <option value="notOwned">${en ? 'Not Owned Only' : '未所持のみ'}</option>
          </select>
          <select class="sm-select" id="smFav">
            <option value="all">${en ? 'All Favorites' : 'すべてのお気に入り'}</option>
            <option value="fav">${en ? 'Favorites Only' : 'お気に入り指定のみ'}</option>
          </select>
        </div>
        <div class="sm-row sm-row-multi" id="smRegularAreaRow" style="display:none;">
          <select class="sm-select" id="smRegularArea">
            <option value="all">${en ? 'All Areas' : 'すべてのエリア'}</option>
          </select>
          <label class="sm-toggle">
            <input type="checkbox" id="smElderOnly">
            <span>${en ? "Elders' items only" : '大精霊のアイテムのみ'}</span>
          </label>
        </div>
        <div class="sm-row">
          <button type="button" class="sm-advanced-toggle" id="smAdvancedToggleBtn">
            <span>${en ? 'More Filters &amp; Sort' : '詳細な絞り込み・並び替え'}</span>
            <span class="sm-advanced-chevron" id="smAdvancedChevron">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
            </span>
          </button>
        </div>
        <div class="sm-row sm-row-multi sm-advanced-row" id="smAdvancedRow" style="display:none;">
          <select class="sm-select" id="smSort">
            <option value="default">${en ? 'Sort: Default' : '並び替え：標準'}</option>
            <option value="name">${en ? 'Sort: Name (A-Z)' : '並び替え：名前順'}</option>
            <option value="eventOrder">${en ? 'Sort: Season/Day Order' : '並び替え：季節・日々順'}</option>
            <option value="notOwnedFirst">${en ? 'Sort: Not Owned First' : '並び替え：未所持を先に'}</option>
            <option value="ownedFirst">${en ? 'Sort: Owned First' : '並び替え：所持済みを先に'}</option>
          </select>
        </div>
        <div class="sm-row sm-row-multi sm-advanced-row" id="smAdvancedRow2" style="display:none;">
          <select class="sm-select" id="smCostType">
            <option value="all">${en ? 'All (Free/Paid)' : 'すべて（無課金・課金）'}</option>
            <option value="free">${en ? 'Free Only' : '無課金のみ'}</option>
            <option value="premium">${en ? 'Paid Only' : '課金のみ'}</option>
          </select>
          <select class="sm-select" id="smReprint">
            <option value="all">${en ? 'All (Reprint)' : 'すべて（復刻）'}</option>
            <option value="reprint">${en ? 'Reprintable Only' : '復刻ありのみ'}</option>
            <option value="noReprint">${en ? 'No-Reprint Only' : '復刻なしのみ'}</option>
          </select>
          <select class="sm-select" id="smDye">
            <option value="all">${en ? 'All (Dye)' : 'すべて（染色）'}</option>
            <option value="dye">${en ? 'Dyeable Only' : '染色可のみ'}</option>
            <option value="noDye">${en ? 'Not Dyeable Only' : '染色不可のみ'}</option>
          </select>
        </div>
        <div class="sm-row" style="justify-content:flex-end;">
          <button type="button" class="sm-clear-btn" id="smClearBtn">${en ? 'Clear All Filters' : 'フィルターを全てクリア'}</button>
        </div>
      </div>

      <button type="button" class="sm-markall-btn" id="smMarkAllBtn" style="display:none;">
        <svg class="inline-icon" width="18" height="18"><use href="#i-check"/></svg>
        <span class="sm-markall-text">
          <b id="smMarkAllLabel"></b>
          <small>${en ? 'Marks every not-yet-owned item currently shown below as owned' : '下に表示中の未所持アイテムをすべて所持済みにします'}</small>
        </span>
      </button>

      <div class="sm-result-header">
        <p class="sm-result-label">${en ? 'Results' : '検索結果'}</p>
        <span class="sm-result-count" id="smResultCount"></span>
      </div>
      <div id="smResults" class="sm-results"></div>

      <div class="sm-done-row">
        <button type="button" class="sm-done-btn" id="smDoneBtn">${en ? 'Done' : '閉じる'}</button>
      </div>
    </div>`;
}

function wireControls() {
  const overlay = overlayEl;
  const q = sel => overlay.querySelector(sel);

  q('#smCloseX').addEventListener('click', close);
  q('#smDoneBtn').addEventListener('click', close);

  q('#smName').addEventListener('input', render);
  q('#smCurrentOnly').addEventListener('change', render);
  q('#smElderOnly').addEventListener('change', render);
  q('#smMarkAllBtn').addEventListener('click', markFilteredOwned);
  ['#smEvent', '#smCurrentType', '#smRegularArea', '#smCat', '#smOwned', '#smFav', '#smSort', '#smCostType', '#smReprint', '#smDye']
    .forEach(sel => q(sel).addEventListener('change', render));

  q('#smAdvancedToggleBtn').addEventListener('click', () => {
    const row1 = q('#smAdvancedRow');
    const row2 = q('#smAdvancedRow2');
    const chevron = q('#smAdvancedChevron');
    const opening = row1.style.display === 'none';
    row1.style.display = opening ? '' : 'none';
    row2.style.display = opening ? '' : 'none';
    chevron.classList.toggle('open', opening);
  });

  q('#smClearBtn').addEventListener('click', () => {
    resetFilterPanel('.sm-panel', render);
  });

  // 検索結果一覧はフィルター変更のたびにinnerHTMLごと差し替わるため、行単位で
  // addEventListenerし直すのではなく、コンテナに1つだけ委譲リスナーを張る
  // （category-view.js/cost-view.jsのwindow.*公開＋インラインonclickとは異なる
  // 書き方だが、js/chrome/pf-modal.jsが自身のリスト再描画で採用しているのと
  // 同じdata-act委譲パターン。開閉のたびにDOMごと作り直す本モーダルの性質上、
  // こちらの方がグローバル汚染も後始末も不要で単純なため踏襲した）
  q('#smResults').addEventListener('click', e => {
    const actEl = e.target.closest('[data-act]');
    if (!actEl) return;
    const row = actEl.closest('.sm-result-row');
    if (!row) return;
    const { cat, id } = row.dataset;
    if (actEl.dataset.act === 'toggle-owned') toggleOwned(cat, id);
    else if (actEl.dataset.act === 'toggle-fav') toggleFav(cat, id);
    else if (actEl.dataset.act === 'toggle-wish') toggleWish(cat, id, actEl);
  });
}

/* ================================================================
   季節・イベント絞り込みセレクトの中身を構築
   （item/index.htmlのbuildEventFilterOptionsと同一ロジック。「○○の季節」
   「○○の日々」という命名規則を利用してoptgroupで分けて表示する）
   ================================================================ */
function buildEventOptions() {
  const select = overlayEl?.querySelector('#smEvent');
  if (!select || !allItemsCache) return;
  const en = CURRENT_LANG === 'en';

  const events = [...new Set(allItemsCache.map(it => it.event))].sort((a, b) => {
    const ia = EVENT_ORDER.indexOf(a);
    const ib = EVENT_ORDER.indexOf(b);
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

function showLoading() {
  const resultsEl = overlayEl?.querySelector('#smResults');
  if (resultsEl) {
    resultsEl.innerHTML = `<div class="sm-empty">${CURRENT_LANG === 'en'
      ? 'Loading…<br>Fetching item data from each category'
      : '読み込み中…<br>各カテゴリのアイテムデータを取得しています'}</div>`;
  }
  const countEl = overlayEl?.querySelector('#smResultCount');
  if (countEl) countEl.textContent = '';
}

function showLoadError() {
  const resultsEl = overlayEl?.querySelector('#smResults');
  if (resultsEl) {
    resultsEl.innerHTML = `<div class="sm-empty">${CURRENT_LANG === 'en'
      ? 'Failed to load item data. Please try again.'
      : 'アイテムデータの読み込みに失敗しました。もう一度お試しください。'}</div>`;
  }
}

/* ================================================================
   絞り込み・並び替え・描画
   ================================================================ */
// 12カテゴリ分の所持/お気に入り状態を1回のレンダリングで使い回すためのキャッシュ
// （item/index.htmlのreadCatState+stateCache、category-view.jsのuserStatesと
// 同じ狙い。isItemOwned/isItemFavを毎アイテムごとに呼ぶと同じlocalStorageキーを
// 何度もJSON.parseし直すことになるため、カテゴリ単位でまとめて1回だけ読む）
function buildStateCache() {
  const cache = {};
  GRID_CATEGORIES.forEach(c => { cache[c.key] = getCategoryState(c.key); });
  return cache;
}

// 恒常精霊（イベント名が「恒常」で始まる）が選択されている間だけ、エリア・大精霊の絞り込み行を出し、
// 選択肢はそのイベントに実在するエリアだけで組み立てる（item/index.htmlのsyncRegularAreaFilterUI）
function syncRegularAreaFilterUI(fEvent) {
  const row = overlayEl.querySelector('#smRegularAreaRow');
  const isRegular = fEvent !== 'all' && fEvent.startsWith('恒常');
  row.style.display = isRegular ? '' : 'none';
  if (!isRegular) return;
  const select = overlayEl.querySelector('#smRegularArea');
  const areasPresent = new Set(allItemsCache.filter(it => it.event === fEvent && it.regularArea).map(it => it.regularArea));
  const prev = select.value;
  select.innerHTML = `<option value="all">${CURRENT_LANG === 'en' ? 'All Areas' : 'すべてのエリア'}</option>`
    + REGULAR_AREA_ORDER.filter(a => areasPresent.has(a)).map(a =>
      `<option value="${a}">${escapeHtml(CURRENT_LANG === 'en' ? REGULAR_AREA_EN[a] : REGULAR_AREA_JA[a])}</option>`).join('');
  if ([...select.options].some(o => o.value === prev)) select.value = prev;
}

// 「現在開催中のみ」がオンの間だけ、その中を季節・日々・再訪でさらに絞り込める行を出す。
// 選択肢は実際に今存在するものだけ（item/index.htmlのsyncCurrentTypeFilterUI）
function syncCurrentTypeFilterUI() {
  const row = overlayEl.querySelector('#smCurrentTypeRow');
  const select = overlayEl.querySelector('#smCurrentType');
  const isCurrentOnly = overlayEl.querySelector('#smCurrentOnly').checked;
  row.style.display = isCurrentOnly ? '' : 'none';
  if (!isCurrentOnly) { select.value = 'all'; return; }
  const names = getCurrentEventNames();
  const hasSeason = names.some(isSeasonLikeEvent);
  const hasDay = names.some(isDayLikeEvent);
  const hasRevisit = isRevisitSpiritCurrentlyActive();
  const en = CURRENT_LANG === 'en';
  const prev = select.value;
  select.innerHTML = `<option value="all">${en ? 'All (Season/Day/Revisit)' : 'すべて（季節・日々・再訪）'}</option>`
    + (hasSeason ? `<option value="season">${en ? 'Season Only' : '季節のみ'}</option>` : '')
    + (hasDay ? `<option value="day">${en ? 'Day Event Only' : '日々のみ'}</option>` : '')
    + (hasRevisit ? `<option value="revisit">${en ? 'Revisit Spirit Only' : '再訪のみ'}</option>` : '');
  if ([...select.options].some(o => o.value === prev)) select.value = prev;
}

function getFilteredItems(stateCache) {
  if (!overlayEl || !allItemsCache) return [];
  const q = sel => overlayEl.querySelector(sel);

  const fName = normalizeSearchText(q('#smName').value.trim());
  const fEvent = q('#smEvent').value;
  const fCat = q('#smCat').value;
  const fOwned = q('#smOwned').value;
  const fFav = q('#smFav').value;
  const fCurrentOnly = q('#smCurrentOnly').checked;
  const fCurrentType = q('#smCurrentType').value;
  const fRegularArea = q('#smRegularArea').value;
  const fElderOnly = q('#smElderOnly').checked;
  const isRegularEvent = fEvent !== 'all' && fEvent.startsWith('恒常');
  const fSort = q('#smSort').value;
  const fCostType = q('#smCostType').value;
  const fReprint = q('#smReprint').value;
  const fDye = q('#smDye').value;
  const currentEventNames = getCurrentEventNames();

  const filtered = allItemsCache.filter(item => {
    if (fName
      && !normalizeSearchText(item.name).includes(fName)
      && !(item.nameEn && normalizeSearchText(item.nameEn).includes(fName))
      && !normalizeSearchText(item.event).includes(fName)
      && !normalizeSearchText(trEvent(item.event)).includes(fName)
      && !(ITEM_YOMI[item.id] && normalizeSearchText(ITEM_YOMI[item.id]).includes(fName))) return false;
    if (fEvent !== 'all' && item.event !== fEvent) return false;
    if (fCurrentOnly) {
      const isRevisitItem = isRevisitSpiritItem(item);
      const isCurrentEventItem = currentEventNames.includes(item.event);
      if (!isCurrentEventItem && !isRevisitItem) return false;
      if (fCurrentType === 'revisit' && !isRevisitItem) return false;
      if (fCurrentType === 'season' && !(isCurrentEventItem && isSeasonLikeEvent(item.event))) return false;
      if (fCurrentType === 'day' && !(isCurrentEventItem && isDayLikeEvent(item.event))) return false;
    }
    if (isRegularEvent && fRegularArea !== 'all' && item.regularArea !== fRegularArea) return false;
    if (isRegularEvent && fElderOnly && !item.isElderItem) return false;
    if (fCat !== 'all' && item.catKey !== fCat) return false;
    if (fOwned !== 'all') {
      const isOwned = !!stateCache[item.catKey].owned[item.id];
      if (fOwned === 'owned' && !isOwned) return false;
      if (fOwned === 'notOwned' && isOwned) return false;
    }
    if (fCostType !== 'all' && item.cost !== fCostType) return false;
    if (fReprint === 'reprint' && item.noReprint) return false;
    if (fReprint === 'noReprint' && !item.noReprint) return false;
    if (fDye === 'dye' && !item.dye) return false;
    if (fDye === 'noDye' && item.dye) return false;
    if (fFav === 'fav' && !stateCache[item.catKey].fav[item.id]) return false;
    return true;
  });

  return sortItems(filtered, fSort, stateCache);
}

function sortItems(items, mode, stateCache) {
  const en = CURRENT_LANG === 'en';
  if (mode === 'name') {
    return [...items].sort((a, b) => trItem(a).localeCompare(trItem(b), en ? 'en' : 'ja'));
  }
  if (mode === 'eventOrder') {
    return [...items].sort((a, b) => {
      const ia = EVENT_ORDER.indexOf(a.event), ib = EVENT_ORDER.indexOf(b.event);
      return (ia === -1 ? EVENT_ORDER.length : ia) - (ib === -1 ? EVENT_ORDER.length : ib);
    });
  }
  if (mode === 'notOwnedFirst' || mode === 'ownedFirst') {
    const sign = mode === 'notOwnedFirst' ? 1 : -1;
    return [...items].sort((a, b) => {
      const oa = stateCache[a.catKey].owned[a.id] ? 1 : 0;
      const ob = stateCache[b.catKey].owned[b.id] ? 1 : 0;
      return (oa - ob) * sign;
    });
  }
  return items; // 'default'（カタログ順のまま）
}

function render() {
  if (!overlayEl || !allItemsCache) return;
  const en = CURRENT_LANG === 'en';
  syncRegularAreaFilterUI(overlayEl.querySelector('#smEvent').value);
  syncCurrentTypeFilterUI();
  const stateCache = buildStateCache();
  const filtered = getFilteredItems(stateCache);

  const ownedCount = filtered.filter(it => stateCache[it.catKey].owned[it.id]).length;
  const countEl = overlayEl.querySelector('#smResultCount');
  if (countEl) {
    countEl.textContent = filtered.length > 0
      ? (en ? `${filtered.length} items (${ownedCount} owned)` : `${filtered.length}件（所持 ${ownedCount}件）`)
      : '';
  }

  // 季節・イベントが選ばれている間だけ「絞り込み結果をすべて所持済みにする」を出す
  const notOwnedCount = filtered.length - ownedCount;
  const markBtn = overlayEl.querySelector('#smMarkAllBtn');
  if (markBtn) {
    const show = overlayEl.querySelector('#smEvent').value !== 'all' && notOwnedCount > 0;
    markBtn.style.display = show ? '' : 'none';
    if (show) overlayEl.querySelector('#smMarkAllLabel').textContent = en
      ? `Mark ${notOwnedCount} filtered item(s) as owned`
      : `絞り込み結果の未所持${notOwnedCount}件を所持済みにする`;
  }

  const resultsEl = overlayEl.querySelector('#smResults');
  if (!resultsEl) return;
  if (filtered.length === 0) {
    resultsEl.innerHTML = `<div class="sm-empty">${en ? 'No items match the selected filters.' : '条件に一致するアイテムが見つかりません。'}</div>`;
    return;
  }
  resultsEl.innerHTML = filtered.map(item => resultRowHtml(item, stateCache)).join('');
}

function resultRowHtml(item, stateCache) {
  const cat = GRID_CATEGORIES.find(c => c.key === item.catKey);
  if (!cat) return '';
  const en = CURRENT_LANG === 'en';
  const isOwned = !!stateCache[item.catKey].owned[item.id];
  const isFav = !!stateCache[item.catKey].fav[item.id];
  const isWish = isWishItem(item.catKey, item.id);

  return `
    <div class="sm-result-row" data-cat="${item.catKey}" data-id="${item.id}">
      <div class="sm-result-main" data-act="toggle-owned">
        <img class="sm-result-icon" src="${item.img || ''}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">
        <div class="sm-result-info">
          <span class="sm-result-meta">${escapeHtml(trCat(cat.name))} ・ ${escapeHtml(trEvent(item.event))}</span>
          <span class="sm-result-name">${escapeHtml(trItem(item))}</span>
        </div>
      </div>
      <button type="button" class="sm-wish-btn ${isWish ? 'is-wish' : ''}" data-act="toggle-wish" aria-label="${en ? 'Wishlist' : 'ウィッシュリスト'}" title="${en ? 'Wishlist' : 'ウィッシュリスト'}">
        <svg class="inline-icon" width="17" height="17"><use href="#i-cart"/></svg>
      </button>
      <button type="button" class="sm-fav-btn ${isFav ? 'is-fav' : ''}" data-act="toggle-fav" aria-label="${en ? 'Favorite' : 'お気に入り'}">
        <svg class="inline-icon" width="17" height="17" style="stroke:currentColor; fill:${isFav ? 'currentColor' : 'none'}; stroke-width:1.8;"><use href="#i-star"/></svg>
      </button>
      <div class="sm-owned-dot ${isOwned ? 'owned' : ''}" data-act="toggle-owned" role="button" aria-label="${en ? 'Toggle ownership status' : '所持状態を切り替える'}">
        ${isOwned ? '<svg class="inline-icon" width="13" height="13" style="stroke:#fff; fill:none; stroke-width:2.6;"><use href="#i-check"/></svg>' : ''}
      </div>
    </div>`;
}

/* ================================================================
   所持／お気に入りのトグル（検索結果からの直接操作）
   ── category-view.jsのhandleToggleOwned/handleToggleFavと同じ
      getCategoryState()→値反転→saveCategoryState()という往復で、
      gameItems_<catKey>キー・{total,owned,itemOwned,itemFav,ownedItems}
      という形状に完全一致した書き込みを行う（＝各カテゴリページを開けば
      ここでの変更がそのまま反映される。localStorageを共有しているだけで
      特別な同期処理は不要）。
   ================================================================ */
function toggleOwned(catKey, id) {
  const items = resolvedItemsByCat.get(catKey) || [];
  const state = getCategoryState(catKey);
  const nextOwned = !state.owned[id];
  state.owned[id] = nextOwned;
  saveCategoryState(catKey, state.owned, state.fav, items);
  if (nextOwned) recordItemAcquire(catKey, id);
  else removeItemAcquireRecord(id);
  notifySearchTitlesCheck();
  render();
}

// 所持状態の変更のたびに称号の新規解禁が無いか確認し、あればトースト通知する
// （category-view.jsのnotifyTitlesCheck()と同じ役割）
function notifySearchTitlesCheck() {
  checkAndUnlockTitles().then(newlyEarned => {
    if (!newlyEarned || !newlyEarned.length) return;
    const msg = newlyEarned.length === 1
      ? (CURRENT_LANG === 'en' ? `Title unlocked: ${newlyEarned[0].nameEn}` : `称号解禁「${newlyEarned[0].name}」`)
      : (CURRENT_LANG === 'en' ? `${newlyEarned.length} titles unlocked!` : `称号を${newlyEarned.length}個解禁！`);
    showSearchModalToast(msg);
  }).catch(e => console.error('[item search] title check failed', e));
}

function showSearchModalToast(msg) {
  const t = document.createElement('div');
  t.className = 'cv-toast';
  t.textContent = msg;
  const stackIndex = document.querySelectorAll('.cv-toast').length;
  if (stackIndex > 0) t.style.bottom = `calc(84px + env(safe-area-inset-bottom) + ${stackIndex * 44}px)`;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600);
}

function toggleFav(catKey, id) {
  const items = resolvedItemsByCat.get(catKey) || [];
  const state = getCategoryState(catKey);
  state.fav[id] = !state.fav[id];
  saveCategoryState(catKey, state.owned, state.fav, items);
  render();
}

// 検索結果の行からウィッシュリストへ追加/解除（所持済みは追加できない）
function toggleWish(catKey, id, btnEl) {
  const en = CURRENT_LANG === 'en';
  const added = toggleWishItem(catKey, id);
  if (added === null) {
    showSearchModalToast(en ? 'Owned items cannot be added to the wishlist' : '所持済みのアイテムはウィッシュリストに追加できません');
    return;
  }
  if (btnEl) btnEl.classList.toggle('is-wish', added);
  showSearchModalToast(added ? (en ? 'Added to wishlist' : 'ウィッシュリストに追加しました') : (en ? 'Removed from wishlist' : 'ウィッシュリストから外しました'));
}

// 現在の絞り込み結果のうち未所持のものを、確認のうえまとめて所持済みにする
// （item/index.htmlのmarkFilteredItemsOwned。恒常精霊のフルコンプもこの操作でできる）
function markFilteredOwned() {
  if (!overlayEl || !allItemsCache) return;
  const en = CURRENT_LANG === 'en';
  const stateCache = buildStateCache();
  const targets = getFilteredItems(stateCache).filter(it => !stateCache[it.catKey].owned[it.id]);
  if (targets.length === 0) return;
  if (!window.confirm(en ? `Mark ${targets.length} item(s) as owned?` : `${targets.length}件のアイテムを所持済みにします。よろしいですか？`)) return;
  const touched = new Set();
  targets.forEach(it => {
    stateCache[it.catKey].owned[it.id] = true;
    recordItemAcquire(it.catKey, it.id);
    touched.add(it.catKey);
  });
  touched.forEach(catKey => {
    const s = stateCache[catKey];
    saveCategoryState(catKey, s.owned, s.fav, resolvedItemsByCat.get(catKey) || []);
  });
  notifySearchTitlesCheck();
  render();
  showSearchModalToast(en ? `${targets.length} item(s) marked as owned` : `${targets.length}件を所持済みにしました`);
}

/* ================================================================
   スコープ付きスタイル注入（初回open()時のみ）
   ── モーダルはdocument.bodyへ直接appendするため（js/chrome/pf-modal.js・
      settings-modal.jsと同じ作法）、.item-view内でのみ定義されるitem.css側の
      色トークン（--orange/--green/--blue等）は届かない。ここではハブ共通の
      --hub-*トークン（css/tokens.css）＋自前の--sm-*トークンのみを使う。
   ── 「開く」演出はCLAUDE.mdの方針通り、共有の.modal-overlay/.modal-card
      （css/chrome.css）が持つ@keyframes版アニメーションをそのまま使い、
      このファイル側でtransitionによる独自の開くアニメーションは実装しない
      （閉じる処理も含め、既存のjs/chrome/settings-modal.js・pf-modal.jsと
      同一の設計をそのまま踏襲）。
   ================================================================ */
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
:root { --sm-owned: #34C759; --sm-fav: #FFCC00; }
[data-theme="dark"] { --sm-owned: #30D158; --sm-fav: #FFD60A; }

.sm-panel { display: flex; flex-direction: column; gap: 10px; margin-top: 2px; }
.sm-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sm-row-multi > * { flex: 1 1 130px; min-width: 110px; }

.sm-search-box {
  display: flex; align-items: center; gap: 8px; background: var(--hub-bg);
  border-radius: var(--hub-r-sm); padding: 9px 12px; width: 100%;
}
.sm-input { border: 0; background: none; outline: none; flex: 1 1 auto; width: 100%; font-size: 16px; color: var(--hub-text); font-family: inherit; }
.sm-input::placeholder { color: var(--hub-text-3); }

.sm-toggle { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--hub-text); cursor: pointer; }
.sm-toggle input { width: 17px; height: 17px; accent-color: var(--hub-accent); cursor: pointer; }

.sm-select {
  background: var(--hub-bg); border: 0; padding: 9px 10px; border-radius: var(--hub-r-sm);
  font-size: 12.5px; color: var(--hub-text); font-family: inherit; outline: none; cursor: pointer;
}

.sm-advanced-toggle {
  display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%;
  background: var(--hub-bg); border: 0; border-radius: var(--hub-r-sm); padding: 10px;
  font-size: 13px; font-weight: 700; color: var(--hub-accent); cursor: pointer; font-family: inherit;
}
.sm-advanced-chevron { display: inline-flex; transition: transform 0.15s ease; }
.sm-advanced-chevron.open { transform: rotate(90deg); }
.sm-advanced-row { display: flex; }

.sm-clear-btn {
  background: var(--hub-sep); border: 0; border-radius: var(--hub-r-sm); padding: 8px 14px;
  font-size: 12.5px; font-weight: 700; color: var(--hub-text-2); cursor: pointer; font-family: inherit;
}
.sm-clear-btn:active { background: var(--hub-accent-bg); color: var(--hub-accent); }

.sm-result-header { display: flex; align-items: baseline; justify-content: space-between; padding: 18px 2px 6px; }
.sm-result-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: var(--hub-text-2); margin: 0; }
.sm-result-count { font-size: 12px; color: var(--hub-text-2); flex-shrink: 0; }

.sm-results { display: flex; flex-direction: column; }
.sm-empty { font-size: 13px; color: var(--hub-text-2); padding: 28px 4px; text-align: center; line-height: 1.6; }

.sm-result-row { display: flex; align-items: center; gap: 8px; padding: 9px 2px; border-top: 0.5px solid var(--hub-sep); }
.sm-result-row:first-child { border-top: 0; }
.sm-result-main { display: flex; align-items: center; gap: 10px; flex: 1 1 auto; min-width: 0; cursor: pointer; }
.sm-result-icon { width: 36px; height: 36px; object-fit: contain; flex-shrink: 0; background: var(--hub-bg); border-radius: 8px; padding: 4px; box-sizing: border-box; }
.sm-result-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.sm-result-meta { font-size: 10.5px; color: var(--hub-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sm-result-name { font-size: 13.5px; font-weight: 600; color: var(--hub-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.sm-fav-btn {
  flex-shrink: 0; width: 30px; height: 30px; border-radius: 50%; border: 0; background: none;
  display: flex; align-items: center; justify-content: center; color: var(--hub-text-3); cursor: pointer; padding: 0;
}
.sm-fav-btn:active { transform: scale(1.15); }
.sm-fav-btn.is-fav { color: var(--sm-fav); }

.sm-wish-btn {
  flex-shrink: 0; width: 30px; height: 30px; border-radius: 50%; border: 0; background: none;
  display: flex; align-items: center; justify-content: center; color: var(--hub-text-3); cursor: pointer; padding: 0;
}
.sm-wish-btn:active { transform: scale(1.15); }
.sm-wish-btn.is-wish { color: var(--hub-accent); }
.sm-wish-btn svg { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }

.sm-markall-btn {
  display: flex; align-items: center; gap: 12px; width: 100%; margin-top: 12px; padding: 12px 14px; text-align: left;
  background: var(--hub-bg); color: var(--hub-text); border: 1px solid var(--hub-sep); border-radius: var(--hub-r-sm);
  font-family: inherit; cursor: pointer;
}
.sm-markall-btn:active { background: var(--hub-accent-bg); }
.sm-markall-btn > svg { flex-shrink: 0; color: var(--sm-owned); }
.sm-markall-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.sm-markall-text b { font-size: 13.5px; font-weight: 700; }
.sm-markall-text small { font-size: 11.5px; color: var(--hub-text-2); }

.sm-owned-dot {
  flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%; background: var(--hub-sep);
  display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.15s;
}
.sm-owned-dot.owned { background: var(--sm-owned); }

.sm-done-row { margin-top: 18px; }
.sm-done-btn {
  width: 100%; padding: 12px; border: 0; border-radius: var(--hub-r-sm); background: var(--hub-accent);
  color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit;
}

.cv-toast {
  position: fixed; left: 50%; bottom: calc(84px + env(safe-area-inset-bottom)); transform: translateX(-50%) translateY(20px);
  background: rgba(28,28,30,0.92); color: #fff; font-size: 13px; font-weight: 600; padding: 10px 18px; border-radius: 999px;
  box-shadow: 0 4px 14px rgba(0,0,0,0.25); opacity: 0; transition: opacity 0.25s, transform 0.25s; z-index: 2000;
  pointer-events: none; max-width: calc(100vw - 32px); text-align: center;
}
.cv-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
`;
  document.head.appendChild(style);
}

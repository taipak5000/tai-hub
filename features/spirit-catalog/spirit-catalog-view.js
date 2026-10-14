/* ================================================================
   spirit-catalog（精霊ツリー管理）のtai-hub移植版。公開面は
   mount(container, sub)/unmount() の2関数のみ（js/router-registry.js
   からマウントされる）。

   移植元: spirit-catalog/index.html（~6400行のスタンドアロンページ）+
   spirit-tree-data.js/spirit-yomi-data.jsのうち、共有chrome
   （site-dock/pf-modal/dash-modal/tools-drawer/サイドバー・profile・
   nsKey/nsKeyFor・表示設定モーダル等）を除いた「このツール自身」の部分：
   検索・絞り込みパネル・統計サマリー（全体達成率／解放済みノード／
   コンプリート済み精霊数）・称号パネル・精霊一覧（一覧／エリア別／
   シーズン別の3ビュー）・精霊詳細（ツリー図・段階ツリー・ノード
   トグル・ツリー単位の一括操作）・絞り込み/グループ単位の一括
   「追いつき」・再訪連携バッジ・item/emote/wingsとの双方向同期。

   localStorageの読み書き・純粋な計算は spirit-catalog-state.js に、
   今日/今週/今月ダッシュボードは共有の features/shared/event-dashboard.js
   に分離している（このファイルはDOMの組み立てとイベント配線のみ）。

   【意図的な簡略化・アダプテーション】詳細は各節のコメント、および
   このエージェントの最終報告(deviationsFromSource)を参照。主なもの:
   - 所持通貨（キャンドル/ハート）の自動増減・季節のペンダント所持に
     よる「季節中に入手済み」除外は spirit-catalog-state.js 側に元実装と
     同じ挙動で移植済み。「所持通貨」編集パネル自体はtai-hub共通の
     プロフィール切替モーダル（js/chrome/pf-modal.js）に委ねる（同じ
     保存キーを直接read-modify-writeするため、値はズレなく連動する）。
   - 共有画像生成（Xシェア/html2canvas）は spirit-catalog-share.js に
     移植済み（features/wings/wings-share.jsと同じ移植方針）。
   - ノードの実機画像はspirit-catalog-state.jsのresolveNodeImg()に移植済み
     （treeNodeIconHtml()がそれを使い、画像が無い/読み込み失敗時は従来の
     線画アイコンにフォールバックする）。ホーム画面アイコンカスタマイズは
     移植していない。
   - 今日/今週/今月ダッシュボードはwings-view.jsと同じパターンで
     features/shared/event-dashboard.js を自前のモーダルにmountする。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { t, tt } from './data/i18n-catalog.js';
import * as S from './spirit-catalog-state.js';
import * as eventDashboard from '../shared/event-dashboard.js';
import * as scShare from './spirit-catalog-share.js';

const STYLE_LINK_ID = 'spirit-catalog-view-styles';
const ICON_SPRITE_ID = 'spirit-catalog-icon-sprite';

let containerEl = null;
let els = {};

let browseMode = 'grid'; // 'grid' | 'area' | 'season'
let revisitOnlyFilter = false;
let currentDetailGuid = null;

let markAllConfirming = false;
let markQuestsConfirming = false;
let markHeartsConfirming = false;
let resetTreeConfirming = false;

let bulkScopeRegistry = {}; // scopeId -> spirit guid配列（renderGrid/renderGroupedViewが毎回更新）
let bulkCatchUpConfirmingScope = null;
let bulkQuestConfirmingScope = null;
let bulkHeartConfirmingScope = null;

let revisitBadgeTimer = null;
let renderGridDebounceTimer = null;

let scToastQueue = [];
let scToastBusy = false;
let scToastTimer = null;

/* ================================================================
   公開API
   ================================================================ */
export function mount(container, sub) {
  injectStylesheet();
  injectLocalIconSprite();

  containerEl = container;
  browseMode = 'grid';
  revisitOnlyFilter = false;
  currentDetailGuid = null;
  markAllConfirming = false; markQuestsConfirming = false; markHeartsConfirming = false; resetTreeConfirming = false;
  bulkScopeRegistry = {}; bulkCatchUpConfirmingScope = null; bulkQuestConfirmingScope = null; bulkHeartConfirmingScope = null;

  container.innerHTML = renderShell();
  cacheEls();
  wireEvents();
  initSeasonFilter();
  containerEl.querySelector('.spirit-catalog-view')?.classList.toggle('sc-cost-on', S.getCostDisplayEnabled());
  if (els.costToggle) els.costToggle.checked = S.getCostDisplayEnabled();

  S.migrateRegularCapeTier2Link(); // 🩹 恒常精霊ティア2ケープのitem紐づけ修正に伴う、既存の解放済みデータの移行（1回のみ）
  renderGrid();
  renderRevisitBadge();
  startRevisitBadgeTimer();

  // 🖼️ ノードの実機画像データ（item機能の12カテゴリ）はアイドル時に遅延読み込みし、
  // 完了したら開いている詳細モーダルだけ再描画してアイコンを差し替える（初期表示を
  // 邪魔しないため。mount()が既にunmount済みでないことをcontainerElで確認する）。
  S.ensureNodeImageMapsLoaded(() => {
    if (!containerEl) return;
    if (currentDetailGuid) renderDetail(currentDetailGuid);
  });

  if (sub) openDetail(sub);
}

export function unmount() {
  if (revisitBadgeTimer) { clearInterval(revisitBadgeTimer); revisitBadgeTimer = null; }
  clearTimeout(renderGridDebounceTimer);
  clearTimeout(scToastTimer);
  scToastQueue = [];
  scToastBusy = false;
  document.getElementById('scDashModalOverlay')?.remove();
  eventDashboard.unmount();
  document.getElementById('scShareCustomizeOverlay')?.remove();
  document.getElementById('scSharePreviewOverlay')?.remove();
  document.querySelectorAll('.sc-share-toast').forEach((el) => el.remove());
  containerEl = null;
  els = {};
}

/* ================================================================
   スタイルシート・ローカルアイコンスプライトの注入（初回のみ）
   ================================================================ */
function injectStylesheet() {
  if (document.getElementById(STYLE_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_LINK_ID;
  link.rel = 'stylesheet';
  link.href = new URL('../../css/spirit-catalog.css', import.meta.url).href;
  document.head.appendChild(link);
}
// tai-hub共有の#pf-icon-sprite(js/icon-sprite.js)には無い、このツールでしか
// 使わないアイコンだけを衝突しない専用プレフィックス(sc-i-*)で自前に持つ
// （共有ファイルは編集しない）。中身は元のspirit-catalog/index.html自身の
// スプライト定義そのまま。
const LOCAL_SPRITE_HTML = `<svg id="${ICON_SPRITE_ID}" style="position:absolute;width:0;height:0;overflow:hidden;" aria-hidden="true"><defs>
<symbol id="sc-i-bell" viewBox="0 0 24 24"><path d="M12 3.2a1.3 1.3 0 0 0-1.3 1.3v.4C8.6 5.5 7 7.8 7 10.4V14l-1.8 2.8h13.6L17 14v-3.6c0-2.6-1.6-4.9-3.7-5.5v-.4A1.3 1.3 0 0 0 12 3.2Z"/><path d="M9.8 18.3a2.2 2.2 0 0 0 4.4 0"/></symbol>
<symbol id="sc-i-glasses" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.094) translate(-12 -12)"><circle cx="6.5" cy="14" r="3.2"/><circle cx="17.5" cy="14" r="3.2"/><path d="M9.7 14h4.6M3 12l1-2h2M21 12l-1-2h-2"/></g></symbol>
<symbol id="sc-i-sofa" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.094) translate(-12 -12)"><path d="M5 12V9.5a1.5 1.5 0 0 1 1.5-1.5h11A1.5 1.5 0 0 1 19 9.5V12"/><path d="M3.5 12h17v4a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1Z"/><path d="M4.5 17v2M19.5 17v2"/></g></symbol>
<symbol id="sc-i-scissors" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.207) translate(-12.75 -12)"><circle cx="7.5" cy="8" r="2"/><circle cx="7.5" cy="16" r="2"/><path d="M9 9.5L20 17M9 14.5L20 7"/></g></symbol>
<symbol id="sc-i-ribbon" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.25) translate(-12 -13.5)"><path d="M12 12L5 6.5v3.5c0 1.2 1 2.2 2.2 2.2H12ZM12 12l7-5.5v3.5c0 1.2-1 2.2-2.2 2.2H12Z"/><circle cx="12" cy="12" r="1.6"/><path d="M12 13.6v6.9M9.3 20.5h5.4"/></g></symbol>
<symbol id="sc-i-hat" viewBox="0 0 24 24"><path d="M4 13c0-4.5 3.5-8 8-8s8 3.5 8 8"/><path d="M2.5 13h19"/><path d="M6 13v1.5A2.5 2.5 0 0 0 8.5 17h7a2.5 2.5 0 0 0 2.5-2.5V13"/></symbol>
<symbol id="sc-i-balloon" viewBox="0 0 24 24"><path d="M12 3a5 5.5 0 0 0-5 5.5C7 12 9.5 14.3 11 14.7l-.6 1.8"/><path d="M12 3a5 5.5 0 0 1 5 5.5c0 3.5-2.5 5.8-4 6.2l.6 1.8"/><path d="M11 16.5h1.4"/><path d="M11.3 18.3c-.2.6.1 1.2.7 1.2s.9-.6.7-1.2"/></symbol>
<symbol id="sc-i-necklace" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.094) translate(-12 -12)"><path d="M5 4c0 5.5 3 9 7 9s7-3.5 7-9"/><path d="M12 13v2.3"/><circle cx="12" cy="17.7" r="2.3"/></g></symbol>
<symbol id="sc-i-flower" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.094) translate(-12 -12)"><circle cx="12" cy="12" r="2"/><path d="M12 4a3 3 0 0 1 3 3 3 3 0 0 1-3 3 3 3 0 0 1-3-3 3 3 0 0 1 3-3ZM12 20a3 3 0 0 1-3-3 3 3 0 0 1 3-3 3 3 0 0 1 3 3 3 3 0 0 1-3 3ZM4 12a3 3 0 0 1 3-3 3 3 0 0 1 3 3 3 3 0 0 1-3 3 3 3 0 0 1-3-3ZM20 12a3 3 0 0 1-3 3 3 3 0 0 1-3-3 3 3 0 0 1 3-3 3 3 0 0 1 3 3Z"/></g></symbol>
<symbol id="sc-i-scroll" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.094) translate(-13 -12)"><path d="M5 7a2 2 0 1 1 0 4h1.5"/><path d="M19 17a2 2 0 1 0 0-4h-1.5"/><path d="M6.5 7H17a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H6.5"/><path d="M9 10.5h6M9 13.5h4"/></g></symbol>
<symbol id="sc-i-shoe" viewBox="0 0 24 24"><path d="M4 18v-3.2c0-.8.5-1.5 1.3-1.8L9 11.5l3-3a2 2 0 0 1 2.6-.2L17 10h2a2 2 0 0 1 2 2v3a3 3 0 0 1-3 3H5a1 1 0 0 1-1-1Z"/><path d="M4 18h17"/></symbol>
<symbol id="sc-i-question" viewBox="0 0 24 24"><path d="M9 9a3 3 0 1 1 4.5 2.6c-1.1.6-1.5 1.1-1.5 2.4v.4"/><path d="M12 18.5v.01"/></symbol>
<symbol id="sc-i-leaf" viewBox="0 0 24 24"><path d="M12 3c-5 2-8 6-8 11a8 8 0 0 0 8 7c5-2 8-6 8-11a8 8 0 0 0-8-7Z"/><path d="M12 21V9"/></symbol>
<symbol id="sc-i-lock" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.094) translate(-12 -12)"><path d="M6.5 11h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z"/><path d="M8 11V8a4 4 0 1 1 8 0v3"/></g></symbol>
<symbol id="sc-i-ticket" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.094) translate(-12 -12)"><path d="M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.3a1.5 1.5 0 0 0 0 3.4V15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.3a1.5 1.5 0 0 0 0-3.4Z"/><path d="M12 7v10" stroke-dasharray="1.5 2"/></g></symbol>
<symbol id="sc-i-tree" viewBox="0 0 24 24"><path d="M12 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z"/><path d="M12 16v5"/></symbol>
</defs></svg>`;
function injectLocalIconSprite() {
  if (document.getElementById(ICON_SPRITE_ID)) return;
  document.body.insertAdjacentHTML('afterbegin', LOCAL_SPRITE_HTML);
}
function icon(id, size) {
  const px = size || 14;
  return `<svg class="sc-inline-icon" width="${px}" height="${px}"><use href="#${id}"/></svg>`;
}
// onerror="..." 属性の中に埋め込む用（属性値自体がダブルクォート区切りのため、
// 中に通常のicon()を入れるとSVG側の class="..." 等のダブルクォートで属性が
// 途中で終わってしまう。元実装のNODE_ICON_SVGと同じく無引用符で組み立てて回避する）。
function iconUnquoted(id, size) {
  const px = size || 14;
  return `<svg class=sc-inline-icon width=${px} height=${px}><use href=#${id} /></svg>`;
}

/* ================================================================
   マークアップ（外枠）
   ================================================================ */
function renderShell() {
  return `
    <div class="spirit-catalog-view">
      <div class="sc-wrap">
        <header class="sc-head">
          <h1>${icon('sc-i-tree', 18)} ${escapeHtml(tt('精霊ツリー管理', 'Spirit Tree Catalog'))}</h1>
        </header>

        <div class="revisit-badge" id="scRevisitBadge"></div>

        <div class="sc-dash-open-row">
          <button type="button" class="sc-dash-open-btn" id="scDashOpenBtn">${icon('i-calendar', 14)} ${escapeHtml(t('dash.openBtn'))}</button>
        </div>

        <p class="sc-sec-label">${escapeHtml(t('filter.sectionLabel'))}</p>
        <div class="filter-card">
          <div class="filter-row">
            <input type="search" class="filter-search" id="scSearchInput" placeholder="${escapeHtml(t('filter.searchPlaceholder'))}">
            <select class="filter-select" id="scTypeFilter">
              <option value="all">${escapeHtml(t('filter.typeAll'))}</option>
              <option value="Season">${escapeHtml(t('filter.typeSeason'))}</option>
              <option value="Regular">${escapeHtml(t('filter.typeRegular'))}</option>
              <option value="Elder">${escapeHtml(t('filter.typeElder'))}</option>
              <option value="Guide">${escapeHtml(t('filter.typeGuide'))}</option>
              <option value="Special">${escapeHtml(t('filter.typeSpecial'))}</option>
            </select>
            <select class="filter-select" id="scSeasonFilter">
              <option value="all">${escapeHtml(t('filter.seasonAll'))}</option>
            </select>
            <select class="filter-select" id="scProgressFilter">
              <option value="all">${escapeHtml(t('filter.progressAll'))}</option>
              <option value="incomplete">${escapeHtml(t('filter.progressIncomplete'))}</option>
              <option value="complete">${escapeHtml(t('filter.progressComplete'))}</option>
              <option value="untouched">${escapeHtml(t('filter.progressUntouched'))}</option>
            </select>
            <select class="filter-select" id="scSortFilter">
              <option value="default">${escapeHtml(t('filter.sortDefault'))}</option>
              <option value="nearestComplete">${escapeHtml(t('filter.sortNearestComplete'))}</option>
            </select>
          </div>
          <div class="filter-reset-row">
            <button type="button" class="filter-toggle-btn" id="scRevisitOnlyBtn">${escapeHtml(t('filter.revisitOnlyBtn'))}</button>
            <button type="button" class="filter-reset-btn" id="scClearFiltersBtn">${escapeHtml(t('filter.clearAllBtn'))}</button>
          </div>
          <div class="filter-stats" id="scFilterStats"></div>
          <div class="filter-remaining-cost" id="scFilterRemainingCost"></div>
          <div class="bulk-catchup-row" id="scBulkCatchupFilteredRow"></div>
          <div class="bulk-catchup-row" id="scBulkQuestCatchupFilteredRow"></div>
          <div class="bulk-catchup-row" id="scBulkHeartCatchupFilteredRow"></div>
          <div class="sc-cost-toggle-row">
            <label><input type="checkbox" id="scCostToggle"> ${escapeHtml(t('filter.costDisplayLabel'))} <span class="sc-test-tag">${escapeHtml(t('filter.costDisplayTestTag'))}</span></label>
            <div class="sc-cost-toggle-hint">${escapeHtml(t('filter.costDisplayHint'))}</div>
          </div>
        </div>

        <div class="overall-pct-card" id="scOverallPctCard"></div>
        <div class="stats-row" id="scStatsRow"></div>
        <div class="titles-panel" id="scTitlesPanel"></div>
        <div class="filter-remaining-cost" id="scGrandRemainingCost" style="padding:10px 2px 0;"></div>

        <div class="sync-refresh-row">
          <button type="button" class="filter-reset-btn sync-refresh-btn" id="scSyncRefreshBtn" title="${escapeHtml(t('stats.syncRefreshHint'))}">
            ${icon('i-sync', 13)} <span>${escapeHtml(t('stats.syncRefreshBtn'))}</span>
          </button>
        </div>

        <div class="share-btn-row">
          <button type="button" class="share-btn twitter" id="scShareTwitterBtn">${escapeHtml(t('share.twitterBtn'))}</button>
          <button type="button" class="share-btn customize" id="scShareCustomizeBtn">${escapeHtml(t('share.customizeBtn'))}</button>
        </div>

        <p class="sc-sec-label">${escapeHtml(t('grid.sectionLabel'))}</p>
        <div class="view-mode-row">
          <button type="button" class="view-mode-btn active" id="scViewModeGridBtn">${escapeHtml(t('browse.modeGrid'))}</button>
          <button type="button" class="view-mode-btn" id="scViewModeAreaBtn">${escapeHtml(t('browse.modeArea'))}</button>
          <button type="button" class="view-mode-btn" id="scViewModeSeasonBtn">${escapeHtml(t('browse.modeSeason'))}</button>
        </div>
        <div class="spirit-grid" id="scSpiritGrid"></div>
        <div class="grouped-view" id="scGroupedView" style="display:none;"></div>

        <footer class="sc-footer">
          <span>${escapeHtml(tt(
            'このサイトはSky 星を紡ぐ子どもたちの非公式ファンサイトです。thatgamecompanyは一切関与していません。',
            'This is an unofficial fan site for Sky: Children of the Light. thatgamecompany is not involved in any way.',
          ))}</span><br>
          <span>${escapeHtml(tt('作成・ご意見:', 'Created by / feedback:'))}</span> <a href="https://x.com/Skyzztai" target="_blank" rel="noopener noreferrer">@Skyzztai</a>　／
          <a href="https://odaibako.net/u/Skyzztai" target="_blank" rel="noopener noreferrer">${escapeHtml(tt('リクエストフォーム', 'Request form'))}</a><br>
          <span style="font-size:12px; margin-top:4px; display:inline-block;">
            <span>${escapeHtml(tt('参考・データ/画像引用元:', 'References / data & image sources:'))}</span>
            <a href="https://github.com/Silverfeelin/SkyGame-Data" target="_blank" rel="noopener noreferrer">${escapeHtml(tt('精霊ツリーデータ (SkyGame-Data)', 'Spirit Tree Data (SkyGame-Data)'))}</a>
            ／
            <a href="https://sky-children-of-the-light.fandom.com/ja/wiki/%E7%B2%BE%E9%9C%8A%E3%81%9F%E3%81%A1" target="_blank" rel="noopener noreferrer">${escapeHtml(tt('精霊たち (Sky Wiki 日本語)', 'Spirits (Sky Wiki Japanese)'))}</a>
            ／
            <a href="https://sky-children-of-the-light.fandom.com/wiki/Spirits" target="_blank" rel="noopener noreferrer">${escapeHtml(tt('Spirits (Sky Wiki 英語)', 'Spirits (Sky Wiki English)'))}</a>
          </span><br>
          <span style="font-size:12px; margin-top:4px; display:inline-block;">
            <a href="#/tai-info">${escapeHtml(tt('設定・クレジット・プライバシーポリシー', 'Settings & Credits / Privacy Policy'))}</a>
          </span>
        </footer>
      </div>

      <div class="sc-detail-overlay" id="scDetailOverlay">
        <div class="sc-detail-card" id="scDetailCard" tabindex="-1"></div>
      </div>

      <div class="sc-toast" id="scToast" role="status" aria-live="polite"></div>
    </div>
  `;
}

function cacheEls() {
  const q = (id) => containerEl.querySelector('#' + id);
  els = {
    searchInput: q('scSearchInput'),
    typeFilter: q('scTypeFilter'),
    seasonFilter: q('scSeasonFilter'),
    progressFilter: q('scProgressFilter'),
    sortFilter: q('scSortFilter'),
    revisitOnlyBtn: q('scRevisitOnlyBtn'),
    clearFiltersBtn: q('scClearFiltersBtn'),
    filterStats: q('scFilterStats'),
    filterRemainingCost: q('scFilterRemainingCost'),
    bulkCatchupFilteredRow: q('scBulkCatchupFilteredRow'),
    bulkQuestCatchupFilteredRow: q('scBulkQuestCatchupFilteredRow'),
    bulkHeartCatchupFilteredRow: q('scBulkHeartCatchupFilteredRow'),
    costToggle: q('scCostToggle'),
    overallPctCard: q('scOverallPctCard'),
    statsRow: q('scStatsRow'),
    titlesPanel: q('scTitlesPanel'),
    grandRemainingCost: q('scGrandRemainingCost'),
    syncRefreshBtn: q('scSyncRefreshBtn'),
    shareTwitterBtn: q('scShareTwitterBtn'),
    shareCustomizeBtn: q('scShareCustomizeBtn'),
    viewModeGridBtn: q('scViewModeGridBtn'),
    viewModeAreaBtn: q('scViewModeAreaBtn'),
    viewModeSeasonBtn: q('scViewModeSeasonBtn'),
    spiritGrid: q('scSpiritGrid'),
    groupedView: q('scGroupedView'),
    detailOverlay: q('scDetailOverlay'),
    detailCard: q('scDetailCard'),
    revisitBadge: q('scRevisitBadge'),
    dashOpenBtn: q('scDashOpenBtn'),
    toast: q('scToast'),
  };
}

function initSeasonFilter() {
  const seasons = [...new Set(S.SPIRIT_TREE_DATA.filter((s) => s.season).map((s) => s.season))];
  seasons.forEach((en) => {
    const opt = document.createElement('option');
    opt.value = en;
    opt.textContent = S.seasonLabel(en);
    els.seasonFilter.appendChild(opt);
  });
}

/* ================================================================
   イベント配線（すべてcontainerEl配下にスコープされるため、mount()の
   たびにrouterがcontainer.innerHTML=''してくれる前提で毎回張り直して良い）
   ================================================================ */
function wireEvents() {
  els.searchInput.addEventListener('input', renderGridDebounced);
  [els.typeFilter, els.seasonFilter, els.progressFilter, els.sortFilter].forEach((el) => {
    el.addEventListener('change', renderGrid);
  });
  els.revisitOnlyBtn.addEventListener('click', () => {
    revisitOnlyFilter = !revisitOnlyFilter;
    els.revisitOnlyBtn.classList.toggle('active', revisitOnlyFilter);
    renderGrid();
  });
  els.clearFiltersBtn.addEventListener('click', clearAllFilters);
  els.costToggle.addEventListener('change', () => {
    S.setCostDisplayEnabled(els.costToggle.checked);
    containerEl.querySelector('.spirit-catalog-view').classList.toggle('sc-cost-on', els.costToggle.checked);
  });
  els.syncRefreshBtn.addEventListener('click', refreshExternalSync);
  els.shareTwitterBtn.addEventListener('click', () => scShare.shareOnX());
  els.shareCustomizeBtn.addEventListener('click', () => scShare.openCustomize());
  els.viewModeGridBtn.addEventListener('click', () => setBrowseMode('grid'));
  els.viewModeAreaBtn.addEventListener('click', () => setBrowseMode('area'));
  els.viewModeSeasonBtn.addEventListener('click', () => setBrowseMode('season'));
  els.dashOpenBtn.addEventListener('click', openDashboardModal);

  els.spiritGrid.addEventListener('click', handleGridClick);
  els.groupedView.addEventListener('click', handleGridClick);
  els.detailOverlay.addEventListener('click', (ev) => { if (ev.target === els.detailOverlay) closeDetail(); });
  els.detailCard.addEventListener('click', handleDetailClick);
}

function handleGridClick(ev) {
  const card = ev.target.closest('.spirit-card');
  if (card && card.dataset.guid) { openDetail(card.dataset.guid); return; }
  const btn = ev.target.closest('[data-sc-act]');
  if (!btn) return;
  const act = btn.dataset.scAct;
  const scopeId = btn.dataset.scScope;
  if (act === 'bulk-start') { bulkCatchUpConfirmingScope = scopeId; bulkQuestConfirmingScope = null; bulkHeartConfirmingScope = null; rerenderCurrentBrowseView(); }
  else if (act === 'bulk-cancel') { bulkCatchUpConfirmingScope = null; rerenderCurrentBrowseView(); }
  else if (act === 'bulk-confirm') { bulkCatchUpConfirmingScope = null; bulkCatchUpConfirm(scopeId); }
  else if (act === 'bulk-quest-start') { bulkQuestConfirmingScope = scopeId; bulkHeartConfirmingScope = null; bulkCatchUpConfirmingScope = null; rerenderCurrentBrowseView(); }
  else if (act === 'bulk-quest-cancel') { bulkQuestConfirmingScope = null; rerenderCurrentBrowseView(); }
  else if (act === 'bulk-quest-confirm') { bulkQuestConfirmingScope = null; bulkQuestCatchUpConfirm(scopeId); }
  else if (act === 'bulk-heart-start') { bulkHeartConfirmingScope = scopeId; bulkQuestConfirmingScope = null; bulkCatchUpConfirmingScope = null; rerenderCurrentBrowseView(); }
  else if (act === 'bulk-heart-cancel') { bulkHeartConfirmingScope = null; rerenderCurrentBrowseView(); }
  else if (act === 'bulk-heart-confirm') { bulkHeartConfirmingScope = null; bulkHeartCatchUpConfirm(scopeId); }
}
function rerenderCurrentBrowseView() {
  if (browseMode === 'grid') renderGrid(); else renderGrid();
}

/* ================================================================
   フィルター
   ================================================================ */
function clearAllFilters() {
  els.searchInput.value = '';
  els.typeFilter.value = 'all';
  els.seasonFilter.value = 'all';
  els.progressFilter.value = 'all';
  els.sortFilter.value = 'default';
  revisitOnlyFilter = false;
  els.revisitOnlyBtn.classList.remove('active');
  renderGrid();
}
function setBrowseMode(mode) {
  browseMode = mode;
  els.viewModeGridBtn.classList.toggle('active', mode === 'grid');
  els.viewModeAreaBtn.classList.toggle('active', mode === 'area');
  els.viewModeSeasonBtn.classList.toggle('active', mode === 'season');
  bulkCatchUpConfirmingScope = null;
  renderGrid();
}
function renderGridDebounced() {
  clearTimeout(renderGridDebounceTimer);
  renderGridDebounceTimer = setTimeout(renderGrid, 200);
}
function refreshExternalSync() {
  S.invalidateExternalOwnCache();
  renderGrid();
  if (currentDetailGuid) renderDetail(currentDetailGuid);
  showToast(t('toast.syncRefreshed'));
}

/* ================================================================
   Fandom画像URLのサムネ縮小（item側cost-data.js等と同じ手法）
   ================================================================ */
function fandomThumbUrl(url, width) {
  if (!url || !/static\.wikia\.nocookie\.net/.test(url)) return url;
  if (/\/revision\//.test(url)) return url;
  return `${url}/revision/latest/scale-to-width-down/${width}`;
}

function spiritMetaLine(s) {
  if (s.season) return escapeHtml(S.seasonLabel(s.season));
  if (s.area) return escapeHtml(s.area);
  return '';
}
function spiritAreaTagHtml(s, areaTagMode) {
  if (!areaTagMode || !s.area) return '';
  if (areaTagMode === 'realm') {
    const realmKey = S.spiritRealmKey(s);
    const realmPart = realmKey !== S.OTHER_AREA_KEY ? S.realmOrderLabel(realmKey) + ' ・ ' : '';
    return `<div class="spirit-area-tag">${icon('i-map', 9)} ${escapeHtml(realmPart)}${escapeHtml(s.area)}</div>`;
  }
  return `<div class="spirit-area-tag">${icon('i-map', 9)} ${escapeHtml(s.area)}</div>`;
}
function spiritCardHtml(s, areaTagMode) {
  const { done, total } = S.spiritProgress(s);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const name = S.spiritName(s);
  const thumb = s.imageUrl
    ? `<img src="${fandomThumbUrl(s.imageUrl, 400)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<span class=spirit-thumb-fallback>${iconUnquoted('i-sparkle', 20)}</span>'">`
    : `<span class="spirit-thumb-fallback">${icon('i-sparkle', 20)}</span>`;
  const isComplete = total > 0 && done === total;
  return `
    <button type="button" class="spirit-card${isComplete ? ' complete' : ''}" data-guid="${s.guid}">
      <span class="spirit-badge">${escapeHtml(S.typeLabel(s.type))}</span>
      ${s.treeSource === 'revisit' ? `<span class="spirit-revisit-badge" title="${escapeHtml(t('detail.revisitTreeBadgeTitle'))}">${icon('i-sync', 10)}</span>` : ''}
      <div class="spirit-thumb-wrap">${thumb}</div>
      <div class="spirit-name">${escapeHtml(name)}</div>
      <div class="spirit-meta">${spiritMetaLine(s)}</div>
      ${spiritAreaTagHtml(s, areaTagMode)}
      <div class="spirit-progress-bar"><div class="spirit-progress-fill ${done === total ? 'complete' : ''}" style="width:${pct}%"></div></div>
    </button>`;
}

function remainingCostChipsHtml(totals) {
  const order = ['c', 'h', 'sc', 'sh', 'ac', 'ec'];
  return order.filter((k) => totals[k]).map((k) => `<span class="cost-chip cost-${k}">${icon(S.COST_ICON[k], 10)}${totals[k]}</span>`).join('');
}
function renderFilterRemainingCost(filtered) {
  const chips = remainingCostChipsHtml(S.sumRemainingCost(filtered));
  els.filterRemainingCost.innerHTML = `<b>${escapeHtml(t('filter.remainingCostLabel'))}</b>${escapeHtml(t('common.labelSep'))}${chips || escapeHtml(t('filter.remainingCostZero'))}`;
}
function renderGrandRemainingCost() {
  const chips = remainingCostChipsHtml(S.sumRemainingCost(S.SPIRIT_TREE_DATA));
  els.grandRemainingCost.innerHTML = `<b>${escapeHtml(t('stats.grandRemainingCostLabel', { total: S.SPIRIT_TREE_DATA.length }))}</b>${escapeHtml(t('common.labelSep'))}${chips || escapeHtml(t('filter.remainingCostZero'))}`;
}

/* ================================================================
   一覧／エリア別／シーズン別 グループ表示
   ================================================================ */
function bulkCatchUpControlHtml(scopeId) {
  let trees = 0, nodes = 0;
  (bulkScopeRegistry[scopeId] || []).forEach((guid) => {
    const sp = S.spiritByGuid[guid];
    if (!sp) return;
    const { done, total } = S.spiritProgress(sp);
    if (done < total) { trees++; nodes += (total - done); }
  });
  if (trees <= 0) return '';
  if (bulkCatchUpConfirmingScope !== scopeId) {
    return `<button type="button" class="sc-block-btn" data-sc-act="bulk-start" data-sc-scope="${escapeHtml(scopeId)}">${escapeHtml(t('browse.bulkCatchUpBtnTemplate', { count: trees }))}</button>`;
  }
  return `<div class="sc-confirm-row">
    <span class="sc-confirm-text">${escapeHtml(t('browse.bulkCatchUpConfirmTemplate', { count: trees, nodes }))}</span>
    <button type="button" class="sc-confirm-btn ok" data-sc-act="bulk-confirm" data-sc-scope="${escapeHtml(scopeId)}">${escapeHtml(t('detail.markAllConfirmBtn'))}</button>
    <button type="button" class="sc-confirm-btn cancel" data-sc-act="bulk-cancel">${escapeHtml(t('cancelBtn'))}</button>
  </div>`;
}
function bulkQuestCatchUpControlHtml(scopeId) {
  let trees = 0, nodes = 0;
  (bulkScopeRegistry[scopeId] || []).forEach((guid) => {
    const sp = S.spiritByGuid[guid];
    if (!sp) return;
    const remaining = S.spiritNodesRemaining(sp, S.isQuestNode);
    if (remaining > 0) { trees++; nodes += remaining; }
  });
  if (trees <= 0) return '';
  if (bulkQuestConfirmingScope !== scopeId) {
    return `<button type="button" class="sc-block-btn" data-sc-act="bulk-quest-start" data-sc-scope="${escapeHtml(scopeId)}">${escapeHtml(t('browse.bulkQuestCatchUpBtnTemplate', { count: trees }))}</button>`;
  }
  return `<div class="sc-confirm-row">
    <span class="sc-confirm-text">${escapeHtml(t('browse.bulkQuestCatchUpConfirmTemplate', { count: trees, nodes }))}</span>
    <button type="button" class="sc-confirm-btn ok" data-sc-act="bulk-quest-confirm" data-sc-scope="${escapeHtml(scopeId)}">${escapeHtml(t('detail.markAllConfirmBtn'))}</button>
    <button type="button" class="sc-confirm-btn cancel" data-sc-act="bulk-quest-cancel">${escapeHtml(t('cancelBtn'))}</button>
  </div>`;
}
function bulkHeartCatchUpControlHtml(scopeId) {
  let trees = 0, nodes = 0;
  (bulkScopeRegistry[scopeId] || []).forEach((guid) => {
    const sp = S.spiritByGuid[guid];
    if (!sp) return;
    const remaining = S.spiritNodesRemaining(sp, S.isHeartNode);
    if (remaining > 0) { trees++; nodes += remaining; }
  });
  if (trees <= 0) return '';
  if (bulkHeartConfirmingScope !== scopeId) {
    return `<button type="button" class="sc-block-btn" data-sc-act="bulk-heart-start" data-sc-scope="${escapeHtml(scopeId)}">${escapeHtml(t('browse.bulkHeartCatchUpBtnTemplate', { count: trees }))}</button>`;
  }
  return `<div class="sc-confirm-row">
    <span class="sc-confirm-text">${escapeHtml(t('browse.bulkHeartCatchUpConfirmTemplate', { count: trees, nodes }))}</span>
    <button type="button" class="sc-confirm-btn ok" data-sc-act="bulk-heart-confirm" data-sc-scope="${escapeHtml(scopeId)}">${escapeHtml(t('detail.markAllConfirmBtn'))}</button>
    <button type="button" class="sc-confirm-btn cancel" data-sc-act="bulk-heart-cancel">${escapeHtml(t('cancelBtn'))}</button>
  </div>`;
}
function afterBulkAction(msgKey, vars) {
  renderGrid();
  if (currentDetailGuid && els.detailOverlay.classList.contains('open')) renderDetail(currentDetailGuid);
  showToast(t(msgKey, vars));
}
function bulkCatchUpConfirm(scopeId) {
  let treesChanged = 0, nodesChanged = 0;
  (bulkScopeRegistry[scopeId] || []).forEach((guid) => {
    const changed = S.markTreeCompleteCore(guid);
    if (changed > 0) { treesChanged++; nodesChanged += changed; }
  });
  afterBulkAction('browse.bulkCatchUpDoneToast', { trees: treesChanged, nodes: nodesChanged });
}
function bulkQuestCatchUpConfirm(scopeId) {
  let treesChanged = 0, nodesChanged = 0;
  (bulkScopeRegistry[scopeId] || []).forEach((guid) => {
    const changed = S.markNodesByPredicateCore(guid, S.isQuestNode);
    if (changed > 0) { treesChanged++; nodesChanged += changed; }
  });
  afterBulkAction('browse.bulkQuestCatchUpDoneToast', { trees: treesChanged, nodes: nodesChanged });
}
function bulkHeartCatchUpConfirm(scopeId) {
  let treesChanged = 0, nodesChanged = 0;
  (bulkScopeRegistry[scopeId] || []).forEach((guid) => {
    const changed = S.markNodesByPredicateCore(guid, S.isHeartNode);
    if (changed > 0) { treesChanged++; nodesChanged += changed; }
  });
  afterBulkAction('browse.bulkHeartCatchUpDoneToast', { trees: treesChanged, nodes: nodesChanged });
}

function renderGroupedView(mode, list) {
  const groups = S.computeGroups(mode, list);
  if (groups.length === 0) {
    els.groupedView.innerHTML = `<div class="empty-note">${escapeHtml(t('grid.emptyNote'))}</div>`;
    return;
  }
  const groupIcon = mode === 'area' ? icon('i-map', 12) : icon('sc-i-leaf', 12);
  els.groupedView.innerHTML = groups.map((g) => {
    const label = mode === 'area' ? S.areaGroupLabel(g.key) : S.seasonGroupLabel(g.key);
    let totalNodes = 0, doneNodes = 0, completeTrees = 0;
    g.spirits.forEach((s) => {
      const { done, total } = S.spiritProgress(s);
      totalNodes += total; doneNodes += done;
      if (total > 0 && done === total) completeTrees++;
    });
    const pct = totalNodes > 0 ? Math.round((doneNodes / totalNodes) * 100) : 0;
    const costChips = remainingCostChipsHtml(S.sumRemainingCost(g.spirits));
    const scopeId = 'grp_' + mode + '_' + g.key;
    bulkScopeRegistry[scopeId] = g.spirits.map((s) => s.guid);
    const cardsHtml = g.spirits.map((s) => spiritCardHtml(s, mode === 'season' ? 'realm' : 'plain')).join('');
    return `
      <div class="area-group">
        <div class="area-group-head">
          <div class="area-group-head-row">
            <div>
              <div class="area-group-title">${groupIcon} ${escapeHtml(label)}</div>
              <div class="area-group-badge">${icon('sc-i-tree', 11)} ${escapeHtml(t('browse.treesCompleteTemplate', { done: completeTrees, total: g.spirits.length }))} ・ ${escapeHtml(t('browse.nodesPctTemplate', { pct }))}</div>
              <div class="area-group-remaining-cost"><b>${escapeHtml(t('browse.groupRemainingCostLabel'))}</b>${escapeHtml(t('common.labelSep'))}${costChips || escapeHtml(t('filter.remainingCostZero'))}</div>
            </div>
            ${bulkCatchUpControlHtml(scopeId)}
          </div>
          <div class="area-group-pct-bar"><div class="area-group-pct-fill ${pct === 100 ? 'complete' : ''}" style="width:${pct}%"></div></div>
        </div>
        <div class="area-group-grid">${cardsHtml}</div>
      </div>`;
  }).join('');
}

function renderGrid() {
  const q = S.normalizeSearchText(els.searchInput.value.trim());
  const typeF = els.typeFilter.value;
  const seasonF = els.seasonFilter.value;
  const progressF = els.progressFilter.value;
  const sortF = els.sortFilter.value;

  const filtered = S.SPIRIT_TREE_DATA.filter((s) => {
    if (typeF !== 'all' && s.type !== typeF) return false;
    if (seasonF !== 'all' && s.season !== seasonF) return false;
    if (revisitOnlyFilter && s.treeSource !== 'revisit') return false;
    if (q) {
      const nameJa = S.normalizeSearchText(s.nameJa || '');
      const nameEn = S.normalizeSearchText(s.name);
      const yomi = S.normalizeSearchText(S.spiritYomi(s));
      const itemMatch = s.nodes.some((n) => {
        const itemJa = S.normalizeSearchText(n.itemNameJa || '');
        const itemEn = S.normalizeSearchText(n.itemName || '');
        return itemJa.includes(q) || itemEn.includes(q);
      });
      if (!nameJa.includes(q) && !nameEn.includes(q) && !yomi.includes(q) && !itemMatch) return false;
    }
    if (progressF !== 'all') {
      const { done, total } = S.spiritProgress(s);
      if (progressF === 'complete' && done !== total) return false;
      if (progressF === 'incomplete' && done === total) return false;
      if (progressF === 'untouched' && done !== 0) return false;
    }
    return true;
  });

  if (sortF === 'nearestComplete') {
    filtered.sort((a, b) => {
      const pa = S.spiritProgress(a), pb = S.spiritProgress(b);
      const pctA = pa.total > 0 ? pa.done / pa.total : 0;
      const pctB = pb.total > 0 ? pb.done / pb.total : 0;
      return pctB - pctA;
    });
  }

  els.filterStats.textContent = t('filter.statsTemplate', { filtered: filtered.length, total: S.SPIRIT_TREE_DATA.length });
  renderFilterRemainingCost(filtered);

  bulkScopeRegistry.filtered = filtered.map((s) => s.guid);
  els.bulkCatchupFilteredRow.innerHTML = bulkCatchUpControlHtml('filtered');
  els.bulkQuestCatchupFilteredRow.innerHTML = bulkQuestCatchUpControlHtml('filtered');
  els.bulkHeartCatchupFilteredRow.innerHTML = bulkHeartCatchUpControlHtml('filtered');

  if (browseMode === 'grid') {
    els.spiritGrid.style.display = '';
    els.groupedView.style.display = 'none';
    els.spiritGrid.innerHTML = filtered.length === 0
      ? `<div class="empty-note">${escapeHtml(t('grid.emptyNote'))}</div>`
      : filtered.map((s) => spiritCardHtml(s, null)).join('');
  } else {
    els.spiritGrid.style.display = 'none';
    els.groupedView.style.display = '';
    renderGroupedView(browseMode, filtered);
  }

  renderStats();
}

/* ================================================================
   統計サマリー・称号
   ================================================================ */
function formatPct(pct) {
  if (pct <= 0) return '0%';
  if (pct >= 100) return '100%';
  return pct.toFixed(1) + '%';
}
function renderStats() {
  const rawUnlocked = S.getUnlockedMap();
  let totalNodes = 0, doneNodes = 0, completeSpirits = 0;
  let candleSpent = 0, heartSpent = 0, seasonCandleSpent = 0, seasonHeartSpent = 0;
  // 🕊️ 季節のペンダントを所持していて、かつアイテム別コスト（item機能）側で
  // 「季節中に入手（0扱い）」を選択済みのアイテムに対応するノードは、シーズン
  // キャンドル/ハートの「使用済み」集計から除外する（元実装のrenderStats()と同じ）。
  const pendantOwnedSeasons = S.getPendantOwnedSeasons();
  const seasonAcquireMap = S.loadSeasonAcquireMap();
  S.SPIRIT_TREE_DATA.forEach((s) => {
    let spiritDone = 0, spiritTotal = 0;
    const seasonJa = s.season ? S.SEASON_JA_MAP[s.season] : null;
    const pendantOwned = !!(seasonJa && pendantOwnedSeasons && pendantOwnedSeasons.has(seasonJa));
    s.nodes.forEach((n) => {
      if (S.isChecklistExcludedNode(n)) return;
      totalNodes++; spiritTotal++;
      if (S.isNodeUnlocked(n)) { doneNodes++; spiritDone++; }
      if (rawUnlocked[n.guid] && n.cost) {
        candleSpent += (n.cost.c || 0);
        heartSpent += (n.cost.h || 0);
        const freeViaPendant = pendantOwned && n.itemCatKey && n.itemCostId && seasonAcquireMap[n.itemCostId] === 'inSeason';
        if (!freeViaPendant) {
          seasonCandleSpent += (n.cost.sc || 0);
          seasonHeartSpent += (n.cost.sh || 0);
        }
      }
    });
    if (spiritDone === spiritTotal && spiritTotal > 0) completeSpirits++;
  });
  const overallPct = totalNodes > 0 ? (doneNodes / totalNodes) * 100 : 0;
  S.saveStatsSnapshot(totalNodes, doneNodes);

  els.overallPctCard.innerHTML = `
    <div class="overall-pct-num">${totalNodes > 0 ? formatPct(overallPct) : '--%'}</div>
    <div class="overall-pct-label">${escapeHtml(t('stats.overallPctLabel'))}</div>`;
  els.statsRow.innerHTML = `
    <div class="stat-box"><div class="stat-num">${doneNodes} / ${totalNodes}</div><div class="stat-label">${escapeHtml(t('stats.unlockedNodes'))}</div></div>
    <div class="stat-box"><div class="stat-num">${completeSpirits} / ${S.SPIRIT_TREE_DATA.length}</div><div class="stat-label">${escapeHtml(t('stats.completeSpirits'))}</div></div>
    <div class="stat-box cost-stat-box"><div class="stat-num">${icon('i-candle', 14)}${candleSpent}<br>${icon('i-heart', 14)}${heartSpent}</div><div class="stat-label">${escapeHtml(t('stats.candleHeartUsed'))}</div></div>
    <div class="stat-box cost-stat-box"><div class="stat-num">${icon('i-candle', 14)}${seasonCandleSpent}<br>${icon('i-heart', 14)}${seasonHeartSpent}</div><div class="stat-label">${escapeHtml(t('stats.seasonCandleHeartUsed'))}</div></div>`;

  const { earned, newlyEarned } = S.checkTitleUnlocks(doneNodes, totalNodes);
  renderTitlesPanel(earned);
  newlyEarned.forEach((def) => showToast(t('titles.unlockedToast', { name: t('titles.' + def.id + '.name') })));

  renderGrandRemainingCost();
}
function renderTitlesPanel(earnedMap) {
  const earned = earnedMap || S.loadEarnedTitles();
  const earnedCount = S.TITLES.filter((def) => earned[def.id]).length;
  const chips = S.TITLES.map((def) => earned[def.id]
    ? `<span class="title-chip" title="${escapeHtml(t('titles.' + def.id + '.desc'))}">${icon(def.icon, 13)} ${escapeHtml(t('titles.' + def.id + '.name'))}</span>`
    : `<span class="title-chip locked" title="${escapeHtml(t('titles.lockedHint'))}">${icon('sc-i-lock', 10)} ${escapeHtml(t('titles.lockedName'))}</span>`).join('');
  els.titlesPanel.innerHTML = `
    <div class="titles-panel-head">
      <div class="titles-label">${escapeHtml(t('titles.sectionLabel'))}</div>
      <div class="titles-count">${escapeHtml(t('titles.countTemplate', { earned: earnedCount, total: S.TITLES.length }))}</div>
    </div>
    <div class="titles-chip-row">${chips}</div>`;
}

/* ================================================================
   精霊詳細（ツリー）モーダル
   ================================================================ */
function openDetail(guid) {
  if (!S.spiritByGuid[guid]) return;
  currentDetailGuid = guid;
  markAllConfirming = false; resetTreeConfirming = false; markQuestsConfirming = false; markHeartsConfirming = false;
  renderDetail(guid);
  els.detailOverlay.classList.add('open');
}
function closeDetail() {
  els.detailOverlay.classList.remove('open');
  currentDetailGuid = null;
  markAllConfirming = false; resetTreeConfirming = false; markQuestsConfirming = false; markHeartsConfirming = false;
}

function markAllArea(spiritGuid, remainingCount) {
  if (remainingCount <= 0) return '';
  if (!markAllConfirming) {
    return `<button type="button" class="sc-block-btn" style="margin-top:10px;" data-sc-detail-act="mark-all-start">${escapeHtml(t('detail.markAllBtn'))}</button>`;
  }
  return `<div class="sc-confirm-row" style="margin-top:10px;">
    <span class="sc-confirm-text">${escapeHtml(t('detail.markAllConfirmTemplate', { count: remainingCount }))}</span>
    <button type="button" class="sc-confirm-btn ok" data-sc-detail-act="mark-all-confirm" data-sc-guid="${spiritGuid}">${escapeHtml(t('detail.markAllConfirmBtn'))}</button>
    <button type="button" class="sc-confirm-btn cancel" data-sc-detail-act="mark-all-cancel">${escapeHtml(t('cancelBtn'))}</button>
  </div>`;
}
function markQuestsArea(spiritGuid, remainingCount) {
  if (remainingCount <= 0) return '';
  if (!markQuestsConfirming) {
    return `<button type="button" class="sc-block-btn" style="margin-top:8px;" data-sc-detail-act="mark-quests-start">${escapeHtml(t('detail.markQuestsBtn'))}</button>`;
  }
  return `<div class="sc-confirm-row" style="margin-top:8px;">
    <span class="sc-confirm-text">${escapeHtml(t('detail.markQuestsConfirmTemplate', { count: remainingCount }))}</span>
    <button type="button" class="sc-confirm-btn ok" data-sc-detail-act="mark-quests-confirm" data-sc-guid="${spiritGuid}">${escapeHtml(t('detail.markAllConfirmBtn'))}</button>
    <button type="button" class="sc-confirm-btn cancel" data-sc-detail-act="mark-quests-cancel">${escapeHtml(t('cancelBtn'))}</button>
  </div>`;
}
function markHeartsArea(spiritGuid, remainingCount) {
  if (remainingCount <= 0) return '';
  if (!markHeartsConfirming) {
    return `<button type="button" class="sc-block-btn" style="margin-top:8px;" data-sc-detail-act="mark-hearts-start">${escapeHtml(t('detail.markHeartsBtn'))}</button>`;
  }
  return `<div class="sc-confirm-row" style="margin-top:8px;">
    <span class="sc-confirm-text">${escapeHtml(t('detail.markHeartsConfirmTemplate', { count: remainingCount }))}</span>
    <button type="button" class="sc-confirm-btn ok" data-sc-detail-act="mark-hearts-confirm" data-sc-guid="${spiritGuid}">${escapeHtml(t('detail.markAllConfirmBtn'))}</button>
    <button type="button" class="sc-confirm-btn cancel" data-sc-detail-act="mark-hearts-cancel">${escapeHtml(t('cancelBtn'))}</button>
  </div>`;
}
function resetTreeArea(spiritGuid, unlockedCount) {
  if (unlockedCount <= 0) return '';
  if (!resetTreeConfirming) {
    return `<button type="button" class="sc-block-btn" style="margin-top:8px;" data-sc-detail-act="reset-start">${escapeHtml(t('detail.resetAllBtn'))}</button>`;
  }
  return `<div class="sc-confirm-row" style="margin-top:8px;">
    <span class="sc-confirm-text">${escapeHtml(t('detail.resetAllConfirmTemplate', { count: unlockedCount }))}</span>
    <button type="button" class="sc-confirm-btn danger" data-sc-detail-act="reset-confirm" data-sc-guid="${spiritGuid}">${escapeHtml(t('detail.resetAllConfirmBtn'))}</button>
    <button type="button" class="sc-confirm-btn cancel" data-sc-detail-act="reset-cancel">${escapeHtml(t('cancelBtn'))}</button>
  </div>`;
}

// ノードアイコン欄のHTML（実機画像があればそれを、無ければ従来の線画アイコンを表示。
// 画像の読み込みに失敗した場合もこの同じ線画アイコンへフォールバックする——
// spiritCardHtml()のサムネフォールバックと同じ onerror + iconUnquoted() パターン）。
function treeNodeIconHtml(n, spirit, isQuest) {
  const iconId = S.nodeIconId(n, spirit, isQuest);
  const img = S.resolveNodeImg(n);
  if (!img) return icon(iconId, 20);
  return `<img src="${img}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{innerHTML:'${iconUnquoted(iconId, 20)}'}))">`;
}

function treeNodeHtml(spirit, n, style, prereqSatisfied) {
  const jaName = n.itemNameJa || S.resolveNodeNameJa(n, spirit);
  const name = S.itemDisplayName(n, spirit);
  const noJa = CURRENT_LANG === 'ja' && !jaName;

  if (S.isWarpNode(n) || S.isAccompanyNode(n)) {
    const titleKey = S.isWarpNode(n) ? 'detail.warpNodeTitleTemplate' : 'detail.accompanyNodeTitleTemplate';
    return `<div class="tree-node-wrap" style="${style || ''}">
      <div class="tree-node-circle-holder">
        <div class="tree-node tree-node-excluded" title="${escapeHtml(t(titleKey, { name }))}">
          <span class="tree-node-icon">${treeNodeIconHtml(n, spirit, false)}</span>
        </div>
      </div>
      <div class="tree-node-label no-ja">${escapeHtml(name)}</div>
    </div>`;
  }

  const unlockSource = S.getUnlockSource(n);
  const unlocked = !!unlockSource;
  const nextAvailable = !unlocked && !!prereqSatisfied;
  const costChips = Object.keys(n.cost || {}).map((k) => `<span class="cost-chip cost-${k}">${icon(S.COST_ICON[k], 10)}${n.cost[k]}</span>`).join('');
  const wingTag = n.itemType === 'WingBuff' ? `<span class="tree-node-wingtag" title="${escapeHtml(t('detail.wingSyncTitle'))}">${icon('i-sync', 11)}</span>` : '';
  const emoteTag = (n.itemType === 'Emote' && n.emoteId && n.emoteLevel)
    ? `<span class="tree-node-wingtag" title="${escapeHtml(t('detail.emoteSyncTitleTemplate', { level: n.emoteLevel }))}">${icon('i-sync', 11)}</span>` : '';
  const tierBadge = S.getCostTierBadge(spirit, n);
  const tierBadgeHtml = tierBadge
    ? (tierBadge.mode === 'emote'
      ? `<span class="tree-node-tier-badge" title="${escapeHtml(t('detail.emoteLevelBadgeTitleTemplate', { n: tierBadge.n, total: tierBadge.total }))}">Lv${tierBadge.n}</span>`
      : `<span class="tree-node-tier-badge" title="${escapeHtml(t(tierBadge.mode === 'cape' ? 'detail.capeTierTitleTemplate' : 'detail.tierVariantTitleTemplate', { n: tierBadge.n, total: tierBadge.total }))}">T${tierBadge.n}</span>`)
    : '';
  const syncBadge = unlockSource === 'sync' ? `<span class="tree-node-sync-badge" title="${escapeHtml(t('detail.syncBadgeTitle'))}">${icon('i-sync', 11)}</span>` : '';
  return `
    <div class="tree-node-wrap" style="${style || ''}">
      <div class="tree-node-circle-holder">
        <button type="button" class="tree-node ${unlocked ? 'checked' : ''} ${nextAvailable ? 'next-available' : ''}" data-sc-toggle-guid="${n.guid}" title="${escapeHtml(name)}" aria-pressed="${unlocked}">
          <span class="tree-node-icon">${treeNodeIconHtml(n, spirit, S.isQuestNode(n))}</span>
        </button>
        ${wingTag}${emoteTag}${tierBadgeHtml}${syncBadge}
      </div>
      <div class="tree-node-label ${noJa ? 'no-ja' : ''}">${escapeHtml(name)}</div>
      <div class="tree-node-cost">${costChips}</div>
    </div>`;
}

function getTreeScale() { return window.innerWidth >= 900 ? 1.35 : 1; }

function renderTreeDiagram(spirit) {
  const layout = S.computeTreeLayout(spirit);
  if (!layout) return `<div class="tier-grid-row">${spirit.nodes.map((n) => treeNodeHtml(spirit, n, '')).join('')}</div>`;

  const scale = getTreeScale();
  const unitW = 78 * scale, unitH = 96 * scale, pad = 30 * scale, nodeR = 22 * scale;
  const width = layout.leafCount * unitW + pad * 2;
  const height = (layout.maxDepth + 1) * unitH + pad * 2;
  const cx = (guid) => layout.xOf[guid] * unitW + unitW / 2 + pad;
  const cy = (guid) => (layout.maxDepth - layout.depthOf[guid]) * unitH + unitH / 2 + pad;

  let lines = '';
  Object.keys(layout.parentOf).forEach((childGuid) => {
    const p = layout.parentOf[childGuid];
    lines += `<line x1="${cx(p)}" y1="${cy(p)}" x2="${cx(childGuid)}" y2="${cy(childGuid)}" stroke="var(--sc-sep)" stroke-width="${3 * scale}" />`;
  });

  const nodesHtml = spirit.nodes.filter((n) => n.guid in layout.xOf).map((n) => {
    const x = cx(n.guid), y = cy(n.guid);
    const parentGuid = layout.parentOf[n.guid];
    const parentNode = parentGuid ? layout.nodeMap[parentGuid] : null;
    const prereqSatisfied = S.isPrereqNodeSatisfied(parentNode);
    return treeNodeHtml(spirit, n, `left:${x - unitW / 2}px; top:${y - nodeR}px; width:${unitW}px;`, prereqSatisfied);
  }).join('');

  return `<div class="tree-scroll"><div class="tree-canvas" style="width:${width}px; height:${height}px;">
    <svg class="tree-lines" width="${width}" height="${height}">${lines}</svg>
    ${nodesHtml}
  </div></div>`;
}
function renderTieredTree(spirit) {
  const byTier = {};
  spirit.nodes.forEach((n) => { (byTier[n.tier] = byTier[n.tier] || []).push(n); });
  const tierKeysAsc = Object.keys(byTier).map(Number).sort((a, b) => a - b);
  const tierComplete = {};
  tierKeysAsc.forEach((tn) => {
    tierComplete[tn] = byTier[tn].every((n) => S.isChecklistExcludedNode(n) || S.isNodeUnlocked(n));
  });
  const tierKeys = tierKeysAsc.slice().sort((a, b) => b - a);
  return tierKeys.map((tierNum) => {
    const tierIdx = tierKeysAsc.indexOf(tierNum);
    const prereqSatisfied = tierIdx === 0 || tierComplete[tierKeysAsc[tierIdx - 1]];
    const byRow = {};
    byTier[tierNum].forEach((n) => { (byRow[n.row] = byRow[n.row] || []).push(n); });
    const rowKeys = Object.keys(byRow).map(Number).sort((a, b) => a - b);
    const rowsHtml = rowKeys.map((r) => {
      const rowNodes = byRow[r].slice().sort((a, b) => (a.col || 0) - (b.col || 0));
      return `<div class="tier-grid-row">${rowNodes.map((n) => treeNodeHtml(spirit, n, '', prereqSatisfied)).join('')}</div>`;
    }).join('');
    return `<div class="tier-block"><div class="tier-label">${escapeHtml(t('detail.tierLabelTemplate', { n: tierNum + 1 }))}</div>${rowsHtml}</div>`;
  }).join('');
}

function renderDetail(guid) {
  const s = S.spiritByGuid[guid];
  if (!s) return;
  const { done, total } = S.spiritProgress(s);
  const name = S.spiritName(s);
  const thumb = s.imageUrl
    ? `<img src="${fandomThumbUrl(s.imageUrl, 150)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='${iconUnquoted('i-sparkle', 26)}'">`
    : icon('i-sparkle', 26);

  const bodyHtml = s.isTiered ? renderTieredTree(s) : renderTreeDiagram(s);
  const revisitNote = s.treeSource === 'revisit'
    ? `<span>${t('detail.revisitTemplate', { name: escapeHtml(s.revisitName || ''), date: escapeHtml(s.revisitDate || '') })}</span>` : '';

  els.detailCard.style.setProperty('--tree-scale', getTreeScale());
  els.detailCard.innerHTML = `
    <div class="detail-head">
      <div class="detail-thumb">${thumb}</div>
      <div>
        <div class="detail-title">${escapeHtml(name)}</div>
        <div class="detail-sub">${escapeHtml(S.typeLabel(s.type))}${s.season ? ' ・ ' + escapeHtml(S.seasonLabel(s.season)) : ''}</div>
      </div>
      <button type="button" class="detail-close" data-sc-detail-act="close">${icon('i-close', 18)}</button>
    </div>
    <div class="detail-body">
      <div class="detail-summary">
        <span>${escapeHtml(t('detail.progress'))}: <b>${done} / ${total}</b></span>
        ${revisitNote}
      </div>
      ${markAllArea(guid, total - done)}
      ${markQuestsArea(guid, S.spiritNodesRemaining(s, S.isQuestNode))}
      ${markHeartsArea(guid, S.spiritNodesRemaining(s, S.isHeartNode))}
      ${resetTreeArea(guid, done)}
      ${bodyHtml}
    </div>`;
}

function handleDetailClick(ev) {
  const toggleBtn = ev.target.closest('[data-sc-toggle-guid]');
  if (toggleBtn) {
    const result = S.toggleNode(currentDetailGuid, toggleBtn.dataset.scToggleGuid);
    if (result) { renderDetail(currentDetailGuid); renderGrid(); }
    return;
  }
  const btn = ev.target.closest('[data-sc-detail-act]');
  if (!btn) return;
  const act = btn.dataset.scDetailAct;
  const guid = btn.dataset.scGuid || currentDetailGuid;
  if (act === 'close') { closeDetail(); return; }
  if (act === 'mark-all-start') { markAllConfirming = true; resetTreeConfirming = false; markQuestsConfirming = false; markHeartsConfirming = false; renderDetail(currentDetailGuid); }
  else if (act === 'mark-all-cancel') { markAllConfirming = false; renderDetail(currentDetailGuid); }
  else if (act === 'mark-all-confirm') {
    markAllConfirming = false;
    const changed = S.markTreeCompleteCore(guid);
    renderDetail(guid); renderGrid();
    showToast(t('detail.markAllDoneToast', { count: changed }));
  } else if (act === 'mark-quests-start') { markQuestsConfirming = true; markHeartsConfirming = false; markAllConfirming = false; resetTreeConfirming = false; renderDetail(currentDetailGuid); }
  else if (act === 'mark-quests-cancel') { markQuestsConfirming = false; renderDetail(currentDetailGuid); }
  else if (act === 'mark-quests-confirm') {
    markQuestsConfirming = false;
    const changed = S.markNodesByPredicateCore(guid, S.isQuestNode);
    renderDetail(guid); renderGrid();
    showToast(t('detail.markQuestsDoneToast', { count: changed }));
  } else if (act === 'mark-hearts-start') { markHeartsConfirming = true; markQuestsConfirming = false; markAllConfirming = false; resetTreeConfirming = false; renderDetail(currentDetailGuid); }
  else if (act === 'mark-hearts-cancel') { markHeartsConfirming = false; renderDetail(currentDetailGuid); }
  else if (act === 'mark-hearts-confirm') {
    markHeartsConfirming = false;
    const changed = S.markNodesByPredicateCore(guid, S.isHeartNode);
    renderDetail(guid); renderGrid();
    showToast(t('detail.markHeartsDoneToast', { count: changed }));
  } else if (act === 'reset-start') { resetTreeConfirming = true; markAllConfirming = false; markQuestsConfirming = false; markHeartsConfirming = false; renderDetail(currentDetailGuid); }
  else if (act === 'reset-cancel') { resetTreeConfirming = false; renderDetail(currentDetailGuid); }
  else if (act === 'reset-confirm') {
    resetTreeConfirming = false;
    const changed = S.resetTreeToLocked(guid);
    renderDetail(guid); renderGrid();
    showToast(t('detail.resetAllDoneToast', { count: changed }));
  }
}

/* ================================================================
   🕊️ 再訪連携バッジ
   ================================================================ */
function renderRevisitBadge() {
  const rv = S.pickRevisitStatus();
  if (!rv) { els.revisitBadge.innerHTML = ''; return; }
  const countdown = S.formatCountdown(rv.target);
  if (rv.active) {
    els.revisitBadge.innerHTML = `
      <span class="revisit-badge-text">${t('revisitBadge.activeTemplate', { time: countdown })}</span>
      <button type="button" class="revisit-badge-btn" id="scViewRevisitBtn">${escapeHtml(t('revisitBadge.viewBtn'))}</button>`;
    els.revisitBadge.querySelector('#scViewRevisitBtn')?.addEventListener('click', viewRevisitTrees);
  } else {
    els.revisitBadge.innerHTML = `<span class="revisit-badge-text">${t('revisitBadge.upcomingTemplate', { time: countdown })}</span>`;
  }
}
function startRevisitBadgeTimer() {
  if (revisitBadgeTimer) return;
  revisitBadgeTimer = setInterval(renderRevisitBadge, 1000);
}
function viewRevisitTrees() {
  revisitOnlyFilter = true;
  els.revisitOnlyBtn.classList.add('active');
  renderGrid();
  (browseMode === 'grid' ? els.spiritGrid : els.groupedView).scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ================================================================
   今日/今週/今月ダッシュボード（features/shared/event-dashboard.js を
   自前のモーダルにmountする。wings-view.jsと同じパターン）
   ================================================================ */
function openDashboardModal() {
  document.getElementById('scDashModalOverlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'scDashModalOverlay';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeDashboardModal(); });
  overlay.innerHTML = `
    <div class="modal-card">
      <button type="button" class="modal-close-btn" id="scDashCloseBtn"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      <div class="modal-title">${escapeHtml(t('dash.modalTitle'))}</div>
      <div id="scDashBody"></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#scDashCloseBtn').addEventListener('click', closeDashboardModal);
  eventDashboard.mount(overlay.querySelector('#scDashBody'));
  requestAnimationFrame(() => overlay.classList.add('open'));
}
function closeDashboardModal() {
  document.getElementById('scDashModalOverlay')?.classList.remove('open');
  eventDashboard.unmount();
}

/* ================================================================
   トースト
   ================================================================ */
function showToast(msg) {
  scToastQueue.push(msg);
  if (!scToastBusy) advanceToastQueue();
}
function advanceToastQueue() {
  const el = els.toast;
  if (!el || scToastQueue.length === 0) { scToastBusy = false; return; }
  scToastBusy = true;
  const msg = scToastQueue.shift();
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(scToastTimer);
  scToastTimer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(advanceToastQueue, 200);
  }, 2600);
}

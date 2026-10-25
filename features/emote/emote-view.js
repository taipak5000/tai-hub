/* ================================================================
   emote-view.js — エモート所持率管理（メイン画面）

   移植元: C:\Users\user\Downloads\skyツール\emote\index.html
   （ヘッダー達成率カード／案内人エモート達成率パネル／称号パネル／
   「1年前の今日」バナー／検索・絞り込みパネル／エモート一覧
   グリッド・リスト／入手履歴モーダル、旧実装の <body> 内マークアップと
   renderList()・getFilteredEmotes()・renderTitles() 等のJS一式）。

   状態の読み書きは js/state.js の nsKey() を経由する emote-state.js に
   委譲している（localStorageのキー名・データ形状は元実装と完全に同一。
   詳細は emote-state.js 冒頭のコメントを参照）。

   ── このtai-hub移植で意図的に省略した機能（元実装にはあったもの） ──
   1. 「Xで画像を共有」「カスタマイズして共有」は features/emote/emote-share.js
      に移植済み（html2canvasでDOM→画像化する、item/wingsの同種機能と
      同じ方式。詳細はemote-share.js冒頭コメント参照）。
   2. ホーム画面アイコンのカスタマイズ機能（iconCustomModal）。これは
      「エモート管理を単独PWAとして追加した場合の、そのアプリ自身の
      アイコン」を変える機能で、tai-hubでは複数ツールが1つのハブに
      同居しホーム画面アイコンもハブ単位になるため、そもそも概念が
      成立しない（chrome側の対象にもなり得ない）。
   3. モーダルのフォーカストラップ（trapPush/trapPop）。tai-hub の既存
      chrome モーダル（js/chrome/dash-modal.js・settings-modal.js）も
      同様に持っていない簡易実装のため、それに合わせて統一した
      （オーバーレイクリックでの閉じるのみ対応）。

   称号（TITLES）・入手履歴（acquireLog）・コンプリート率推移スナップショット
   （completionHistory_v1）・「1年前の今日」バナー・案内人エモート達成率パネル・
   絞り込み結果の一括所持・レベル単位の所持トグルは、いずれも元実装と同じ
   ロジック・同じ見た目のまま移植している。
   ================================================================ */

import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { EMOTES } from './data/emotes.js';
import { TITLES } from './data/titles.js';
import {
  loadOwned, toggleLevel, toggleAllLevels, bulkOwnFiltered,
  loadAcquireLog, removeEmoteAcquireRecord, buildLatestAcquireMap, isRecentlyAcquired,
  getStats, formatPctHtml, checkTitles,
  recordCompletionSnapshotIfNeeded,
  isOneYearAgoBannerDismissedToday, findOneYearAgoAcquisition, dismissOneYearAgoBanner,
  getViewMode, setViewMode, getGridCols, setGridCols,
} from './emote-state.js';
import * as Share from './emote-share.js';

function t(ja, en) { return CURRENT_LANG === 'en' ? en : ja; }
function tpl(str, vars) { return str.replace(/\{(\w+)\}/g, (_, k) => (vars && k in vars) ? vars[k] : ''); }
// TITLES要素（{name,nameEn}）から現在言語の表示名を返す（元実装のL({ja,en})相当）
function L(obj) { return CURRENT_LANG === 'en' ? (obj.nameEn || obj.name) : obj.name; }

const STYLE_ID = 'emote-view-styles';
let containerEl = null;

/* ================================================================
   共有スプライト（js/icon-sprite.js）に無いアイコンのインライン定義。
   他機能も並行編集中のため共有スプライト自体は変更せず、
   features/item/cost-view.js と同じ方針でページ内だけで完結させる
   （i-compass/i-map/i-lockは元サイトの同じsymbol定義のpath形状を
   そのままインライン化したもの＝見た目は完全に同一）。
   ================================================================ */
function compassIcon(size) {
  return `<svg class="inline-icon" width="${size}" height="${size}" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.094) translate(-12 -12)"><path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"/><path d="M14.5 9.5l-1.8 4.2-4.2 1.8 1.8-4.2Z"/></g></svg>`;
}
const ICON_LOCK = '<svg class="inline-icon" width="13" height="13" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.094) translate(-12 -12)"><path d="M6.5 11h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z"/><path d="M8 11V8a4 4 0 1 1 8 0v3"/></g></svg>';
const ICON_CHECK_OK = '<svg class="inline-icon ok" width="13" height="13"><use href="#i-check"/></svg>';
const ICON_SYNC = '<svg class="inline-icon" width="13" height="13"><use href="#i-sync"/></svg>';
// 「最近入手」バッジのアイコン（元実装も共有スプライトを使わない単体svgだったためそのまま）
const RECENT_ICON_LIST = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.5 6L20 12l-6.5 1.5L12 21l-1.5-6L4 12l6.5-1.5Z"/></svg>';
const RECENT_ICON_TILE = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.5 6L20 12l-6.5 1.5L12 21l-1.5-6L4 12l6.5-1.5Z"/></svg>';
const TILE_CHECK_ICON = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5L20 6.5"/></svg>';

/* ================================================================
   表示アクセサ（LANGに応じてどちらの表記を主表示にするか切り替える）
   ================================================================ */
function emoteName(e) { return CURRENT_LANG === 'en' ? e.nameEn : e.name; }
function emoteNameSecondary(e) { return CURRENT_LANG === 'en' ? e.name : e.nameEn; }
function locationDisplay(e) { return CURRENT_LANG === 'en' ? (e.locationEn || e.location) : e.location; }
function spiritDisplay(e) { return CURRENT_LANG === 'en' ? (e.spiritEn || e.spirit) : e.spirit; }

// Sky Wiki検索リンク：精霊が判明していればその居場所を、案内人（AURORA等）が
// 付与するものは案内人名を、不明ならエモート名自体で検索する
function emoteSearchUrl(e) {
  let q;
  if (CURRENT_LANG === 'en') {
    if (e.spirit && e.isGuide) q = `${spiritDisplay(e)} sky`;
    else if (e.spirit) q = `${spiritDisplay(e)} location sky`;
    else q = `${e.nameEn} sky`;
  } else {
    if (e.spirit && e.isGuide) q = `${e.spirit} sky`;
    else if (e.spirit) q = `${e.spirit} 居場所 sky`;
    else q = `${e.name} sky`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

function fmtAcquireLogDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return CURRENT_LANG === 'en'
    ? d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ── 文言ヘルパー（1回しか使わないものはテンプレート内に直書き） ── */
function levelCountTemplate() {
  return t('<b class="em-stat-num">{owned}</b> / <b class="em-stat-num">{total}</b> レベル所持', '<b class="em-stat-num">{owned}</b> / <b class="em-stat-num">{total}</b> levels owned');
}
function ownAllBtnLabel() { return `${ICON_CHECK_OK} ${t('全部所持', 'Own All')}`; }
function ownAllUndoBtnLabel() { return `${ICON_SYNC} ${t('所持解除', 'Clear')}`; }
function ownAllBtnTitleText() { return t('このエモートの全レベルを所持済みにする', 'Mark all levels of this emote as owned'); }
function ownAllUndoBtnTitleText() { return t('このエモートの所持レベルをすべて解除する', 'Clear all owned levels for this emote'); }
function emoteCompleteLabelHtml() { return `${ICON_CHECK_OK} ${t('コンプリート', 'Complete')}`; }
function guideBadgeTitleText() { return t('精霊ではなく案内人（AURORAなど）から入手するエモートです', 'Granted by a Guide character (e.g. AURORA), not a regular spirit'); }
function guideBadgeLabelHtml(size) { return `${compassIcon(size)} ${t('案内人', 'Guide')}`; }
function bulkOwnBtnHtml(n) { return `${ICON_CHECK_OK} ${tpl(t('絞り込み結果（{n}件）を全部所持にする', 'Mark all {n} filtered emotes as owned'), { n })}`; }
function bulkOwnBtnTitleText() { return t('検索・絞り込みで表示されているエモートを、すべて全レベル所持済みにします', 'Marks every level of every emote currently shown by the search/filter as owned.'); }

/* ================================================================
   mount / unmount
   ================================================================ */
export function mount(container) {
  containerEl = container;
  injectStyles();
  container.innerHTML = buildShell();

  window.__emoteToggleLevel = handleToggleLevel;
  window.__emoteToggleAllLevels = handleToggleAllLevels;
  window.__emoteFilterAndRender = renderList;
  window.__emoteClearFilters = handleClearFilters;
  window.__emoteSetViewMode = handleSetViewMode;
  window.__emoteSetGridCols = handleSetGridCols;
  window.__emoteBulkOwnFiltered = handleBulkOwnFiltered;
  window.__emoteOpenAcquireLog = openAcquireLog;
  window.__emoteRemoveAcquireLogEntry = handleRemoveAcquireLogEntry;
  window.__emoteDismissOneYearAgoBanner = handleDismissOneYearAgoBanner;
  window.__emoteShareOnX = Share.shareOnX;
  window.__emoteOpenShareCustomize = Share.openCustomize;

  populateLocationFilter();
  applyGridColsToDom();
  buildAcquireLogModal();
  recordCompletionSnapshotIfNeeded();
  renderList();
  initOneYearAgoBanner();
}

export function unmount() {
  removeAcquireLogModal();
  Share.closeCustomize();
  document.getElementById('emoteShareCustomizeOverlay')?.remove();
  document.getElementById('emoteSharePreviewOverlay')?.remove();
  delete window.__emoteToggleLevel;
  delete window.__emoteToggleAllLevels;
  delete window.__emoteFilterAndRender;
  delete window.__emoteClearFilters;
  delete window.__emoteSetViewMode;
  delete window.__emoteSetGridCols;
  delete window.__emoteBulkOwnFiltered;
  delete window.__emoteOpenAcquireLog;
  delete window.__emoteRemoveAcquireLogEntry;
  delete window.__emoteDismissOneYearAgoBanner;
  delete window.__emoteShareOnX;
  delete window.__emoteOpenShareCustomize;
  containerEl = null;
}

/* ================================================================
   外枠の描画
   ================================================================ */
function buildShell() {
  return `
    <div class="emote-view">
      <div class="em-wrap">
        <header class="tool-nav-head"><h1><svg class="inline-icon" width="19" height="19"><use href="#i-masks"/></svg> ${CURRENT_LANG === 'en' ? 'Emote Collection Tracker' : 'エモート所持率管理'}</h1></header>
        <div id="emOneYearAgoBannerSlot"></div>

        <div class="em-header-card">
          <div class="em-header-info">
            <div class="em-header-icon"><svg class="inline-icon" width="24" height="24"><use href="#i-masks"/></svg></div>
            <div>
              <div class="em-header-name">${t('エモート全体', 'All Emotes')}</div>
              <div class="em-header-count" id="emHdrCount">-- / --</div>
            </div>
          </div>
          <div class="em-header-pct" id="emHdrPct">--%</div>
        </div>

        <div class="em-header-card em-guide-header-card" id="emGuideHeaderCard">
          <div class="em-header-info">
            <div class="em-header-icon">${compassIcon(24)}</div>
            <div>
              <div class="em-header-name">${t('案内人エモート', 'Guide Emotes')}</div>
              <div class="em-header-count" id="emGuideHdrCount">-- / --</div>
            </div>
          </div>
          <div class="em-header-pct" id="emGuideHdrPct">--%</div>
        </div>

        <div class="em-titles-panel">
          <div class="em-titles-panel-head">
            <span class="em-sec-label">${t('称号', 'Titles')}</span>
            <span class="em-titles-count" id="emTitlesCount">0 / 0</span>
          </div>
          <div class="em-titles-chip-row" id="emTitlesChipRow"></div>
        </div>

        <div class="em-control-panel">
          <div class="em-control-row">
            <span class="em-control-label">${t('検索', 'Search')}</span>
            <input type="text" class="em-select-box em-search-input" id="emSearchName" placeholder="${escapeHtml(t('名前・精霊・エリアで絞り込み...', 'Filter by name, spirit, or area...'))}" oninput="window.__emoteFilterAndRender()">
          </div>
          <div class="em-control-row">
            <span class="em-control-label">${t('絞り込み', 'Filter')}</span>
            <select class="em-select-box" id="emFilterStatus" onchange="window.__emoteFilterAndRender()">
              <option value="all">${t('すべての所持状態', 'All ownership status')}</option>
              <option value="complete">${t('コンプリート済みのみ', 'Complete only')}</option>
              <option value="partial">${t('一部所持のみ', 'Partially owned only')}</option>
              <option value="none">${t('未所持のみ', 'Unowned only')}</option>
            </select>
          </div>
          <div class="em-control-row">
            <span class="em-control-label">${t('エリア', 'Area')}</span>
            <select class="em-select-box" id="emFilterLocation" onchange="window.__emoteFilterAndRender()">
              <option value="all">${t('すべてのエリア', 'All areas')}</option>
            </select>
          </div>
          <div class="em-control-row">
            <span class="em-control-label">${t('種別', 'Type')}</span>
            <select class="em-select-box" id="emFilterGuide" onchange="window.__emoteFilterAndRender()">
              <option value="all">${t('すべての種別', 'All types')}</option>
              <option value="guideOnly">${t('案内人のみ', 'Guide only')}</option>
            </select>
          </div>
          <div class="em-control-row">
            <span class="em-control-label">${t('入手方法', 'Source')}</span>
            <select class="em-select-box" id="emFilterSource" onchange="window.__emoteFilterAndRender()">
              <option value="all">${t('すべての入手方法', 'All acquisition methods')}</option>
              <option value="spirit">${t('精霊から入手', 'From a Spirit')}</option>
              <option value="guide">${t('案内人から入手', 'From a Season Guide')}</option>
              <option value="default">${t('デフォルト所持', 'Default (no spirit)')}</option>
            </select>
          </div>
          <div class="em-control-row">
            <span class="em-control-label">${t('並び替え', 'Sort')}</span>
            <select class="em-select-box" id="emSortOrder" onchange="window.__emoteFilterAndRender()">
              <option value="default">${t('既定の順番', 'Default order')}</option>
              <option value="pctDesc">${t('所持率が高い順', 'Highest completion first')}</option>
              <option value="pctAsc">${t('所持率が低い順', 'Lowest completion first')}</option>
            </select>
          </div>
          <div class="em-control-row em-control-reset-row">
            <button type="button" class="em-clear-filters-btn" id="emClearFiltersBtn" onclick="window.__emoteClearFilters()" title="${escapeHtml(t('名前検索・絞り込み・並び替えをすべて既定の状態に戻します', 'Resets the name search, filters, and sort order back to their defaults'))}">${t('フィルターを全てクリア', 'Clear all filters')}</button>
          </div>
          <div class="em-control-row" id="emBulkOwnRow" style="display:none;">
            <button type="button" class="em-bulk-own-btn" id="emBulkOwnFilteredBtn" onclick="window.__emoteBulkOwnFiltered()"></button>
          </div>
        </div>

        <p class="em-sec-label" style="padding:22px 4px 8px; margin:0;">${t('達成率をシェア', 'Share your completion rate')}</p>
        <button type="button" class="em-feature-btn em-feature-btn-twitter" onclick="window.__emoteShareOnX()">
          <span class="em-feature-icon"><svg class="inline-icon" width="22" height="22"><use href="#i-upload"/></svg></span>
          <span class="em-feature-label">${t('Xで画像を共有', 'Share image on X')}</span>
          <span class="em-feature-desc">${t('所持率を画像にしてXへ投稿できます（画像の保存も同時にできます）', 'Turn your completion rate into an image and post it to X (the image is saved automatically too)')}</span>
        </button>
        <button type="button" class="em-feature-btn" onclick="window.__emoteOpenShareCustomize()">
          <span class="em-feature-icon"><svg class="inline-icon" width="22" height="22"><use href="#i-palette"/></svg></span>
          <span class="em-feature-label">${t('カスタマイズして共有', 'Customize & share')}</span>
          <span class="em-feature-desc">${t('背景テーマ・コメントを自分好みに設定してから保存/共有できます', 'Set your own background theme and comment before saving or sharing')}</span>
        </button>
        <button type="button" class="em-feature-btn" onclick="window.__emoteOpenAcquireLog()">
          <span class="em-feature-icon"><svg class="inline-icon" width="22" height="22"><use href="#i-calendar"/></svg></span>
          <span class="em-feature-label">${t('入手履歴', 'Acquisition Log')}</span>
          <span class="em-feature-desc">${t('所持チェックを入れた日時の一覧を確認できます', 'See a timeline of when you checked off each level as owned')}</span>
        </button>

        <div class="em-list-header-row">
          <span class="em-sec-label">${t('エモート一覧', 'Emote List')}</span>
          <span class="em-sec-label" id="emListCountLabel"></span>
        </div>
        <div class="em-list-header-row em-list-header-row-controls">
          <select class="em-grid-cols-select" id="emGridColsSelect" onchange="window.__emoteSetGridCols(this.value)" aria-label="${escapeHtml(t('グリッドの列数', 'Grid columns'))}" title="${escapeHtml(t('グリッドの列数', 'Grid columns'))}">
            <option value="auto">${t('列数: 自動', 'Columns: Auto')}</option>
            <option value="2">${t('2列', '2 columns')}</option>
            <option value="3">${t('3列', '3 columns')}</option>
            <option value="4">${t('4列', '4 columns')}</option>
            <option value="5">${t('5列', '5 columns')}</option>
            <option value="6">${t('6列', '6 columns')}</option>
          </select>
          <div class="em-view-toggle">
            <button type="button" class="em-view-toggle-btn" id="emViewGridBtn" onclick="window.__emoteSetViewMode('grid')">${t('グリッド', 'Grid')}</button>
            <button type="button" class="em-view-toggle-btn" id="emViewListBtn" onclick="window.__emoteSetViewMode('list')">${t('リスト', 'List')}</button>
          </div>
        </div>

        <div class="em-grid" id="emGrid"></div>
        <div class="em-list" id="emList"></div>

        <footer style="text-align:center; padding:24px 16px; color:var(--text-2); font-size:13px; border-top:1px solid var(--sep); margin-top:40px; line-height:1.6;">
          ${t('このサイトはSky 星を紡ぐ子どもたちの非公式ファンサイトです。thatgamecompanyは一切関与していません。', 'This site is an unofficial fan site for Sky: Children of the Light. thatgamecompany is not involved in any way.')}<br>
          ${t('作成・ご意見:', 'Made by / feedback:')} <a href="https://x.com/Skyzztai" target="_blank" rel="noopener noreferrer" style="color:var(--blue); text-decoration:underline; font-weight:bold;">@Skyzztai</a>　／　<a href="https://odaibako.net/u/Skyzztai" target="_blank" rel="noopener noreferrer" style="color:var(--blue); text-decoration:underline; font-weight:bold;">${t('リクエストフォーム', 'Request Form')}</a><br>
          <span style="color:var(--text-2); font-size:12px; margin-top:4px; display:inline-block;">
            ${t('参考・画像引用元:', 'References & image sources:')}
            <a href="https://sky-children-of-the-light.fandom.com/ja/wiki/%E6%84%9F%E6%83%85%E8%A1%A8%E7%8F%BE" target="_blank" rel="noopener noreferrer" style="color:var(--blue); text-decoration:underline;">${t('感情表現 (Sky Wiki 日本語)', 'Expressions (Sky Wiki Japanese)')}</a>
            ／
            <a href="https://sky-children-of-the-light.fandom.com/wiki/Expressions" target="_blank" rel="noopener noreferrer" style="color:var(--blue); text-decoration:underline;">${t('Expressions (Sky Wiki 英語)', 'Expressions (Sky Wiki English)')}</a>
          </span><br>
          <span style="color:var(--text-2); font-size:12px; margin-top:4px; display:inline-block;">
            <a href="#/tai-info" style="color:var(--blue); text-decoration:underline;">${t('設定・クレジット・プライバシーポリシー', 'Settings, Credits & Privacy Policy')}</a>
          </span>
        </footer>
      </div>
    </div>`;
}

/* ================================================================
   エリア絞り込みの構築（データに登場する順のまま重複なし）
   ================================================================ */
function populateLocationFilter() {
  const select = containerEl.querySelector('#emFilterLocation');
  const seen = new Set();
  EMOTES.forEach(e => {
    if (seen.has(e.location)) return;
    seen.add(e.location);
    const opt = document.createElement('option');
    opt.value = e.location;
    opt.textContent = locationDisplay(e);
    select.appendChild(opt);
  });
}

/* ================================================================
   絞り込み
   ================================================================ */
function getFilteredEmotesFromDom(data) {
  data = data || loadOwned();
  const search = containerEl.querySelector('#emSearchName').value.trim().toLowerCase();
  const filter = containerEl.querySelector('#emFilterStatus').value;
  const location = containerEl.querySelector('#emFilterLocation').value;
  const guideOnly = containerEl.querySelector('#emFilterGuide').value === 'guideOnly';
  const source = containerEl.querySelector('#emFilterSource').value;
  return EMOTES.filter(e => {
    if (search) {
      const haystack = [e.name, e.nameEn, e.spirit, e.spiritEn, e.location, e.locationEn].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (location !== 'all' && e.location !== location) return false;
    if (guideOnly && !e.isGuide) return false;
    if (source === 'spirit' && (!e.spirit || e.isGuide)) return false;
    if (source === 'guide' && !e.isGuide) return false;
    if (source === 'default' && e.spirit) return false;
    const ownedCount = (data[e.id] || []).length;
    if (filter === 'complete' && ownedCount !== e.maxLevel) return false;
    if (filter === 'partial' && (ownedCount === 0 || ownedCount === e.maxLevel)) return false;
    if (filter === 'none' && ownedCount !== 0) return false;
    return true;
  });
}

function isFilterActive() {
  const search = containerEl.querySelector('#emSearchName').value.trim();
  const filter = containerEl.querySelector('#emFilterStatus').value;
  const location = containerEl.querySelector('#emFilterLocation').value;
  const guide = containerEl.querySelector('#emFilterGuide').value;
  const source = containerEl.querySelector('#emFilterSource').value;
  return !!search || filter !== 'all' || location !== 'all' || guide !== 'all' || source !== 'all';
}

function handleClearFilters() {
  containerEl.querySelector('#emSearchName').value = '';
  containerEl.querySelector('#emFilterStatus').value = 'all';
  containerEl.querySelector('#emFilterLocation').value = 'all';
  containerEl.querySelector('#emFilterGuide').value = 'all';
  containerEl.querySelector('#emFilterSource').value = 'all';
  containerEl.querySelector('#emSortOrder').value = 'default';
  renderList();
}

/* ================================================================
   表示モード（グリッド／リスト）・グリッド列数
   ================================================================ */
function handleSetViewMode(mode) {
  if (mode !== 'grid' && mode !== 'list') return;
  setViewMode(mode);
  renderList();
}
function handleSetGridCols(val) {
  setGridCols(val);
  applyGridColsToDom();
}
function applyGridColsToDom() {
  const cols = getGridCols();
  const grid = containerEl.querySelector('#emGrid');
  if (grid) grid.style.gridTemplateColumns = cols === 'auto' ? '' : `repeat(${cols}, 1fr)`;
  const sel = containerEl.querySelector('#emGridColsSelect');
  if (sel) sel.value = cols;
}

/* ================================================================
   所持トグル
   ================================================================ */
function handleToggleLevel(emoteId, level) {
  toggleLevel(emoteId, level);
  renderList();
}
function handleToggleAllLevels(emoteId) {
  toggleAllLevels(emoteId);
  renderList();
}
function handleBulkOwnFiltered() {
  const filtered = getFilteredEmotesFromDom(loadOwned());
  bulkOwnFiltered(filtered);
  renderList();
}

/* ================================================================
   フォーカス位置の保持：renderList()は一覧全体をinnerHTMLで作り直すため、
   操作していたボタンがDOMごと差し替わりフォーカスが失われる。再描画の
   直前にフォーカス中の要素を識別しておき、再描画後に同じ要素へ戻す。
   ================================================================ */
function captureFocusedControl() {
  const active = document.activeElement;
  if (!active || !active.classList) return null;
  const types = ['em-lv-btn', 'em-tile-lv-dot', 'em-own-all-btn', 'em-tile-own-all-btn'];
  const type = types.find(cls => active.classList.contains(cls));
  if (!type || !active.dataset.emoteId) return null;
  return { type, emoteId: active.dataset.emoteId, level: active.dataset.level };
}
function restoreFocusedControl(focusInfo) {
  if (!focusInfo) return;
  const hasLevel = focusInfo.type === 'em-lv-btn' || focusInfo.type === 'em-tile-lv-dot';
  const selector = hasLevel
    ? `.${focusInfo.type}[data-emote-id="${focusInfo.emoteId}"][data-level="${focusInfo.level}"]`
    : `.${focusInfo.type}[data-emote-id="${focusInfo.emoteId}"]`;
  const el = containerEl.querySelector(selector);
  if (el) { el.focus(); return; }
  const isGrid = focusInfo.type === 'em-tile-lv-dot' || focusInfo.type === 'em-tile-own-all-btn';
  const list = containerEl.querySelector(isGrid ? '#emGrid' : '#emList');
  if (list) {
    if (!list.hasAttribute('tabindex')) list.setAttribute('tabindex', '-1');
    list.focus();
  }
}

/* ================================================================
   一覧描画（グリッド／リスト共通）
   ================================================================ */
function renderEmoteCardHtml(e, data, recentAcquireMap) {
  const ownedLevels = new Set(data[e.id] || []);
  const ownedCount = ownedLevels.size;
  const isComplete = ownedCount === e.maxLevel;
  const levelBtns = [];
  for (let lv = 1; lv <= e.maxLevel; lv++) {
    levelBtns.push(`<button type="button" class="em-lv-btn ${ownedLevels.has(lv) ? 'is-owned' : ''}" data-emote-id="${e.id}" data-level="${lv}" onclick="window.__emoteToggleLevel('${e.id}', ${lv})">${lv}</button>`);
  }
  const ownAllBtn = e.maxLevel > 1
    ? `<button type="button" class="em-own-all-btn ${isComplete ? 'is-complete' : ''}" data-emote-id="${e.id}" onclick="event.stopPropagation(); window.__emoteToggleAllLevels('${e.id}')" title="${escapeHtml(isComplete ? ownAllUndoBtnTitleText() : ownAllBtnTitleText())}">${isComplete ? ownAllUndoBtnLabel() : ownAllBtnLabel()}</button>`
    : '';
  const guideBadge = e.isGuide ? `<span class="em-guide-badge" title="${escapeHtml(guideBadgeTitleText())}">${guideBadgeLabelHtml(13)}</span>` : '';
  const recentBadge = isRecentlyAcquired(recentAcquireMap, e.id)
    ? `<span class="em-recent-badge" title="${escapeHtml(tpl(t('{date} に入手', 'Acquired {date}'), { date: fmtAcquireLogDate(recentAcquireMap[e.id]) }))}">${RECENT_ICON_LIST} ${t('最近入手', 'New')}</span>`
    : '';
  return `
    <div class="em-card ${isComplete ? 'is-complete' : ''}">
      <div class="em-card-icon">
        <img src="${e.img}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('em-img-fallback')">
        <span class="em-card-icon-fallback"><svg class="inline-icon" width="20" height="20"><use href="#i-masks"/></svg></span>
      </div>
      <div class="em-info">
        <a href="${emoteSearchUrl(e)}" target="_blank" rel="noopener noreferrer" class="em-name" onclick="event.stopPropagation()">${escapeHtml(emoteName(e))}</a>
        <div class="em-name-en">${escapeHtml(emoteNameSecondary(e))} ／ ${escapeHtml(locationDisplay(e))}</div>
        <div class="em-sub">${isComplete ? emoteCompleteLabelHtml() : tpl(levelCountTemplate(), { owned: ownedCount, total: e.maxLevel })}</div>
        ${guideBadge}${recentBadge}
      </div>
      ${ownAllBtn}
      <div class="em-lv-row">${levelBtns.join('')}</div>
    </div>`;
}

function renderEmoteTileHtml(e, data, recentAcquireMap) {
  const ownedLevels = new Set(data[e.id] || []);
  const ownedCount = ownedLevels.size;
  const isComplete = ownedCount === e.maxLevel;
  const dots = [];
  for (let lv = 1; lv <= e.maxLevel; lv++) {
    dots.push(`<button type="button" class="em-tile-lv-dot ${ownedLevels.has(lv) ? 'is-owned' : ''}" data-emote-id="${e.id}" data-level="${lv}" title="Lv${lv}" aria-label="Lv${lv}" onclick="event.stopPropagation(); window.__emoteToggleLevel('${e.id}', ${lv})"></button>`);
  }
  const tileOwnAllBtn = e.maxLevel > 1
    ? `<button type="button" class="em-tile-own-all-btn ${isComplete ? 'is-complete' : ''}" data-emote-id="${e.id}" onclick="event.stopPropagation(); window.__emoteToggleAllLevels('${e.id}')" title="${escapeHtml(isComplete ? ownAllUndoBtnTitleText() : ownAllBtnTitleText())}">${TILE_CHECK_ICON}</button>`
    : '';
  const tileGuideBadge = e.isGuide ? `<span class="em-tile-guide-badge" title="${escapeHtml(guideBadgeTitleText())}">${compassIcon(12)}</span>` : '';
  const tileRecentBadge = isRecentlyAcquired(recentAcquireMap, e.id)
    ? `<span class="em-tile-recent-badge" title="${escapeHtml(tpl(t('{date} に入手', 'Acquired {date}'), { date: fmtAcquireLogDate(recentAcquireMap[e.id]) }))}">${RECENT_ICON_TILE}</span>`
    : '';
  return `
    <div class="em-tile" title="${escapeHtml(locationDisplay(e))}">
      <div class="em-tile-frame ${isComplete ? 'is-complete' : ''}">
        <div class="em-tile-img-wrap">
          <img src="${e.img}" alt="${escapeHtml(emoteName(e))}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('em-img-fallback')">
          <span class="em-tile-fallback"><svg class="inline-icon" width="26" height="26"><use href="#i-masks"/></svg></span>
        </div>
        <div class="em-tile-levels">${dots.join('')}</div>
        ${tileOwnAllBtn}
        ${tileGuideBadge}
        ${tileRecentBadge}
      </div>
      <a href="${emoteSearchUrl(e)}" target="_blank" rel="noopener noreferrer" class="em-tile-name" onclick="event.stopPropagation()">${escapeHtml(emoteName(e))}</a>
    </div>`;
}

function renderList() {
  const focusInfo = captureFocusedControl();
  const data = loadOwned();
  const sortOrder = containerEl.querySelector('#emSortOrder').value;
  const viewMode = getViewMode();
  const filtered = getFilteredEmotesFromDom(data);
  const recentAcquireMap = buildLatestAcquireMap();

  if (sortOrder === 'pctDesc' || sortOrder === 'pctAsc') {
    const pctOf = e => e.maxLevel > 0 ? (data[e.id] || []).length / e.maxLevel : 0;
    filtered.sort((a, b) => {
      const diff = pctOf(a) - pctOf(b);
      return sortOrder === 'pctAsc' ? diff : -diff;
    });
  }

  const listHtml = filtered.map(e => renderEmoteCardHtml(e, data, recentAcquireMap)).join('');
  const gridHtml = filtered.map(e => renderEmoteTileHtml(e, data, recentAcquireMap)).join('');
  const emptyHtml = `<div class="em-empty-message">${t('条件に一致するエモートがありません。', 'No emotes match the current filter.')}</div>`;

  const listEl = containerEl.querySelector('#emList');
  const gridEl = containerEl.querySelector('#emGrid');
  listEl.innerHTML = listHtml || emptyHtml;
  gridEl.innerHTML = gridHtml || emptyHtml;
  listEl.style.display = viewMode === 'list' ? 'flex' : 'none';
  gridEl.style.display = viewMode === 'grid' ? 'grid' : 'none';
  containerEl.querySelector('#emViewListBtn').classList.toggle('active', viewMode === 'list');
  containerEl.querySelector('#emViewGridBtn').classList.toggle('active', viewMode === 'grid');

  containerEl.querySelector('#emListCountLabel').innerHTML = tpl(
    t('<b class="em-stat-num">{n}</b> / <b class="em-stat-num">{total}</b>件', '<b class="em-stat-num">{n}</b> / <b class="em-stat-num">{total}</b>'),
    { n: filtered.length, total: EMOTES.length }
  );

  const bulkRow = containerEl.querySelector('#emBulkOwnRow');
  const showBulk = isFilterActive() && filtered.length > 0;
  bulkRow.style.display = showBulk ? 'flex' : 'none';
  if (showBulk) {
    const bulkBtn = containerEl.querySelector('#emBulkOwnFilteredBtn');
    bulkBtn.innerHTML = bulkOwnBtnHtml(filtered.length);
    bulkBtn.title = bulkOwnBtnTitleText();
  }

  const stats = getStats();
  containerEl.querySelector('#emHdrCount').innerHTML = tpl(levelCountTemplate(), { owned: stats.owned, total: stats.total });
  containerEl.querySelector('#emHdrPct').innerHTML = formatPctHtml(stats.pct);
  renderTitlesPanel(stats);
  renderGuideStats(stats);

  restoreFocusedControl(focusInfo);
}

/* ================================================================
   🧭 案内人エモートの達成率パネル
   ================================================================ */
function renderGuideStats(stats) {
  const card = containerEl.querySelector('#emGuideHeaderCard');
  if (!card) return;
  if (stats.guideTotalLv === 0) { card.style.display = 'none'; return; }
  card.style.display = 'flex';
  containerEl.querySelector('#emGuideHdrCount').innerHTML = tpl(levelCountTemplate(), { owned: stats.guideOwnedLv, total: stats.guideTotalLv });
  containerEl.querySelector('#emGuideHdrPct').innerHTML = formatPctHtml(stats.guidePct);
}

/* ================================================================
   🏆 称号（実績）パネル
   ================================================================ */
function renderTitlesPanel(stats) {
  const { earned, newly } = checkTitles(stats);
  if (newly.length === 1) {
    showEmToast(tpl(t('称号「{name}」を獲得！', 'Title unlocked: {name}!'), { name: L(newly[0]) }));
  } else if (newly.length > 1) {
    const names = newly.map(L).join(CURRENT_LANG === 'en' ? ', ' : '、');
    showEmToast(tpl(t('称号を{n}個獲得！ {names}', '{n} titles unlocked! {names}'), { n: newly.length, names }));
  }
  const countEl = containerEl.querySelector('#emTitlesCount');
  const row = containerEl.querySelector('#emTitlesChipRow');
  if (!countEl || !row) return;
  const earnedCount = TITLES.filter(x => earned[x.id]).length;
  countEl.innerHTML = tpl(
    t('<b class="em-stat-num">{earned}</b> / <b class="em-stat-num">{total}</b> 個解除', '<b class="em-stat-num">{earned}</b> / <b class="em-stat-num">{total}</b> unlocked'),
    { earned: earnedCount, total: TITLES.length }
  );
  row.innerHTML = TITLES.map(title => {
    const got = earned[title.id];
    if (!got) {
      return `<span class="em-title-chip locked" title="${escapeHtml(t('称号は条件を満たすと明らかになります', 'Unlocks when you meet its condition'))}"><span class="em-title-chip-icon">${ICON_LOCK}</span>？？？</span>`;
    }
    const name = escapeHtml(L(title));
    const desc = escapeHtml(t(title.desc, title.descEn));
    return `<span class="em-title-chip" title="${desc}"><span class="em-title-chip-icon">${title.icon}</span>${name}</span>`;
  }).join('');
}

/* ================================================================
   簡易トースト通知（称号解除時のみ使用）
   ================================================================ */
function showEmToast(msg) {
  const el = document.createElement('div');
  el.className = 'em-toast';
  el.textContent = msg.replace(/<[^>]*>/g, ''); // タグを含まないプレーンテキストのみ表示
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2600);
}

/* ================================================================
   🎉 「1年前の今日」バナー
   ================================================================ */
function initOneYearAgoBanner() {
  const slot = containerEl.querySelector('#emOneYearAgoBannerSlot');
  if (!slot) return;
  if (isOneYearAgoBannerDismissedToday()) return;
  const found = findOneYearAgoAcquisition();
  if (!found) return;
  const name = escapeHtml(emoteName(found.emote));
  const icon = '<svg class="inline-icon" width="14" height="14"><use href="#i-sparkle"/></svg>';
  const ja = `${icon} ${found.yearsAgo}年前の今日、『{name}』を記録しました`;
  const en = found.yearsAgo === 1
    ? `${icon} You logged “{name}” exactly {years} year ago today`
    : `${icon} You logged “{name}” exactly {years} years ago today`;
  const msg = tpl(t(ja, en), { years: found.yearsAgo, name });
  slot.innerHTML = `
    <div class="em-oya-banner" id="emOneYearAgoBanner" role="status">
      <span class="em-oya-text">${msg}</span>
      <button class="em-oya-close" type="button" onclick="window.__emoteDismissOneYearAgoBanner()" aria-label="${escapeHtml(t('閉じる', 'Dismiss'))}"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
    </div>`;
}
function handleDismissOneYearAgoBanner() {
  dismissOneYearAgoBanner();
  const el = containerEl.querySelector('#emOneYearAgoBannerSlot');
  if (el) el.innerHTML = '';
}

/* ================================================================
   📅 入手履歴モーダル
   js/chrome/dash-modal.js と同じ方針：document.body直下にオーバーレイを
   1つだけ生成し、classList('open')の付け外しだけで開閉する（フォーカス
   トラップなし＝既存chromeモーダルと同水準の簡易実装。詳細はファイル冒頭コメント）。
   ================================================================ */
function buildAcquireLogModal() {
  removeAcquireLogModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'emAcquireLogModalOverlay';
  overlay.addEventListener('click', e => { if (e.target === overlay) closeAcquireLog(); });
  overlay.innerHTML = `
    <div class="modal-card em-acquire-log-card">
      <button type="button" class="modal-close-btn" id="emAcquireLogCloseBtn"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      <div class="modal-title">${t('入手履歴', 'Acquisition History')}</div>
      <div class="em-log-hint">${t('所持レベルにチェックを入れた日時を自動で記録します。チェックを外すと記録も消えます。', 'Records the date and time you checked off each level as owned. Unchecking a level removes its record.')}</div>
      <div id="emAcquireLogBody"></div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('emAcquireLogCloseBtn').addEventListener('click', closeAcquireLog);
}
function removeAcquireLogModal() {
  const el = document.getElementById('emAcquireLogModalOverlay');
  if (el) el.remove();
}
function openAcquireLog() {
  renderAcquireLogBody();
  document.getElementById('emAcquireLogModalOverlay')?.classList.add('open');
}
function closeAcquireLog() {
  document.getElementById('emAcquireLogModalOverlay')?.classList.remove('open');
}
// ログ1件の削除。所持データ（OWNED_KEY）は変更しない＝所持状態はそのまま残る
// （元実装と同じく、ここではrenderList()を呼ばずログ表示だけを更新する）
function handleRemoveAcquireLogEntry(key) {
  const log = loadAcquireLog();
  const rec = log[key];
  if (rec) removeEmoteAcquireRecord(rec.emoteId, rec.level);
  renderAcquireLogBody();
}
function renderAcquireLogBody() {
  const body = document.getElementById('emAcquireLogBody');
  if (!body) return;
  const log = loadAcquireLog();
  const entries = Object.keys(log).map(key => {
    const rec = log[key];
    const e = EMOTES.find(x => x.id === rec.emoteId);
    return e ? { key, emote: e, level: rec.level, at: rec.at } : null;
  }).filter(Boolean);

  if (entries.length === 0) {
    body.innerHTML = `<div class="em-log-empty">${t('まだ記録がありません。<br>エモートのレベルに所持チェックを入れると、ここに記録されます。', 'No records yet.<br>Checking off an emote level as owned will add it here.')}</div>`;
    return;
  }
  entries.sort((a, b) => new Date(b.at) - new Date(a.at));
  const rowsHtml = entries.map(entry => `
    <div class="em-log-row">
      <div class="em-log-row-icon">
        <img src="${entry.emote.img}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('em-img-fallback')">
        <span class="em-log-row-icon-fallback"><svg class="inline-icon" width="16" height="16"><use href="#i-masks"/></svg></span>
      </div>
      <div class="em-log-row-info">
        <div class="em-log-row-name">${escapeHtml(emoteName(entry.emote))} <span class="em-log-row-level">Lv${entry.level}</span></div>
        <div class="em-log-row-meta">${fmtAcquireLogDate(entry.at)}</div>
      </div>
      <button type="button" class="pf-icon-btn pf-row-btn-danger" onclick="window.__emoteRemoveAcquireLogEntry('${entry.key}')" title="${escapeHtml(t('記録を削除', 'Delete record'))}" aria-label="${escapeHtml(t('記録を削除', 'Delete record'))}"><svg class="inline-icon" width="14" height="14"><use href="#i-close"/></svg></button>
    </div>`).join('');
  body.innerHTML = `
    <div class="em-log-row-list">${rowsHtml}</div>
    <div class="em-log-count">${tpl(t('記録件数：<b class="em-stat-num">{n}</b>件', '<b class="em-stat-num">{n}</b> record(s)'), { n: entries.length })}</div>`;
}

/* ================================================================
   スコープ付きスタイル注入（features/item/category-view.js と同じ方針：
   mount毎の再注入を防ぐSTYLE_IDガード付き。tokens/chromeは触らず、この
   機能専用のトークン・見た目はすべて .emote-view 配下に閉じる）
   ================================================================ */
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
:where(.emote-view *, .emote-view *::before, .emote-view *::after) { margin: 0; padding: 0; box-sizing: border-box; }
.emote-view {
  --bg: #F2F2F7; --card: #FFFFFF; --sep: rgba(60,60,67,0.12);
  --orange: #FF9500; --orange-d: #FF6200; --orange-bg: rgba(255,149,0,0.10);
  --blue: #007AFF; --blue-bg: rgba(0,122,255,0.08);
  --own-all-blue: #0062CC; --blue-solid: #0062CC; --focus-ring: #CC4B00;
  --green: #34C759; --green-bg: rgba(52,199,89,0.10); --red: #FF3B30;
  --text: #1C1C1E; --text-2: #8E8E93; --text-3: #C7C7CC;
  --r: 16px; --r-sm: 10px;
  /* 🩹 このルート要素自身に必ずbackgroundを持たせる。#app-root/bodyは
     ハブ共通の--hub-bgトークンなので、ここで明示しないとカード間の
     余白・ページ上下の隙間からハブのダーク配色（濃紺寄り）が透けて見え、
     元実装の純黒(#000)と食い違う。 */
  background: var(--bg);
  min-height: 100vh;
}
[data-theme="dark"] .emote-view {
  --bg: #000000; --card: #1C1C1E; --sep: rgba(255,255,255,0.14);
  --orange: #FF9F0A; --orange-bg: rgba(255,159,10,0.18);
  --blue: #0A84FF; --blue-bg: rgba(10,132,255,0.16);
  --own-all-blue: #4DA3FF; --focus-ring: var(--orange);
  --green: #30D158; --green-bg: rgba(48,209,88,0.16); --red: #FF453A;
  --text: #F2F2F7; --text-2: #98989D; --text-3: #636366;
}
/* 🩹 入手履歴モーダルはjs/chrome/dash-modal.jsと同じ方針でdocument.body直下へ
   直接appendされ、.emote-viewの子孫にならない（コンテナがmount/unmountで
   入れ替わってもモーダルの開閉状態を保てるようにするための設計）。この
   結果、カスタムプロパティ(--orange/--orange-bg)は.emote-view配下にしか
   継承されず、モーダル側では未定義のまま(var()が解決できずスタイル無視)
   になる。star-candle.cssの.sc-shard-cal-cardと同じ対処として、モーダル
   カード自身(.em-acquire-log-card)にも同じトークンを再定義し、閉じる
   ボタンを元実装のicon-chip配色(オレンジ)に合わせる
   （共有chrome.cssの.modal-close-btn自体は他ツールと共通のため変更しない）。 */
.em-acquire-log-card { --orange: #FF9500; --orange-bg: rgba(255,149,0,0.10); }
[data-theme="dark"] .em-acquire-log-card { --orange: #FF9F0A; --orange-bg: rgba(255,159,10,0.18); }
.em-acquire-log-card .modal-close-btn { background: var(--orange-bg); color: var(--orange); }
.emote-view * { box-sizing: border-box; }
.emote-view .em-wrap { max-width: 720px; margin: 0 auto; padding: 0 16px; }
@media (min-width: 850px) { .emote-view .em-wrap { max-width: 960px; } }

/* このビュー内での.inline-icon既定色（共有chrome.cssのcurrentColor継承ではなく、
   元実装通り既定オレンジ＋.ok・.warn修飾を使う。詳細度で共有ルールに勝つ） */
.emote-view .inline-icon { stroke: var(--orange); fill: none; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; vertical-align: -3px; color: var(--orange); }
.emote-view .inline-icon.ok { stroke: var(--green); color: var(--green); }
.emote-view .em-stat-num { color: var(--text); font-weight: 700; }
.emote-view .em-pct-unit { font-size: 0.55em; font-weight: 600; opacity: 0.72; margin-left: 1px; }

/* ── ヘッダーカード（全体達成率／案内人エモート達成率） ── */
.emote-view .em-header-card {
  background: var(--card); border-radius: var(--r); padding: 20px; margin-top: 4px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.07), 0 0.5px 1px rgba(0,0,0,0.04);
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
}
.emote-view .em-guide-header-card { margin-top: 12px; }
.emote-view .em-guide-header-card .em-header-pct { color: var(--blue); }
.emote-view .em-header-info { display: flex; align-items: center; gap: 12px; }
.emote-view .em-header-icon { width: 44px; height: 44px; background: var(--bg); border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.emote-view .em-header-name { font-size: 18px; font-weight: 700; }
.emote-view .em-header-count { font-size: 13px; color: var(--text-2); margin-top: 2px; }
.emote-view .em-header-pct { font-size: 24px; font-weight: 800; color: var(--orange); }

/* ── 称号パネル ── */
.emote-view .em-titles-panel { background: var(--card); border-radius: var(--r); padding: 14px 16px; margin-top: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.07), 0 0.5px 1px rgba(0,0,0,0.04); }
.emote-view .em-titles-panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.emote-view .em-titles-count { font-size: 12px; font-weight: 700; color: var(--text-2); }
.emote-view .em-titles-chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
.emote-view .em-title-chip { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 7px 12px; font-size: 12.5px; font-weight: 700; background: var(--green-bg); color: var(--green); }
.emote-view .em-title-chip-icon { font-size: 14px; line-height: 1; display: inline-flex; }
.emote-view .em-title-chip.locked { background: var(--bg); color: var(--text-3); font-weight: 600; }

/* ── 「1年前の今日」バナー ── */
.emote-view .em-oya-banner { background: var(--orange-bg); color: var(--orange-d); border-radius: var(--r); padding: 12px 14px; margin-top: 16px; display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 13px; font-weight: 600; line-height: 1.5; }
.emote-view .em-oya-text { flex: 1; }
.emote-view .em-oya-close { background: none; border: none; color: inherit; font-size: 15px; font-weight: 700; cursor: pointer; padding: 2px 6px; line-height: 1; opacity: 0.7; flex-shrink: 0; }
.emote-view .em-oya-close:hover { opacity: 1; }
.emote-view .em-oya-close:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 1px; }

/* ── 検索・絞り込みパネル ── */
.emote-view .em-control-panel { background: var(--card); border-radius: var(--r); padding: 16px; margin-top: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.07), 0 0.5px 1px rgba(0,0,0,0.04); display: flex; flex-direction: column; gap: 12px; }
.emote-view .em-control-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.emote-view .em-control-label { font-size: 12px; font-weight: 600; color: var(--text-2); min-width: 60px; }
.emote-view .em-select-box { background: var(--bg); border: none; padding: 8px 12px; border-radius: var(--r-sm); font-size: 13px; color: var(--text); font-weight: 500; outline: none; flex: 1; min-width: 120px; font-family: inherit; }
.emote-view .em-select-box:focus { outline: 2px solid var(--focus-ring); outline-offset: 1px; }
.emote-view .em-search-input { font-size: 16px; }
.emote-view .em-search-input::placeholder { color: var(--text-3); }
.emote-view .em-control-reset-row { justify-content: flex-end; }
.emote-view .em-clear-filters-btn { background: var(--bg); border: none; color: var(--blue); border-radius: var(--r-sm); padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background 0.15s; }
.emote-view .em-clear-filters-btn:active { background: var(--sep); }
.emote-view .em-clear-filters-btn:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
.emote-view .em-bulk-own-btn { width: 100%; background: var(--blue-solid); color: #fff; border: none; border-radius: var(--r-sm); padding: 10px 14px; font-size: 13px; font-weight: 700; text-align: center; cursor: pointer; font-family: inherit; }
.emote-view .em-bulk-own-btn:active { transform: scale(0.98); }
.emote-view .em-bulk-own-btn:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }

/* ── 達成率シェア・入手履歴を開くボタン（feature-btn） ── */
.emote-view .em-feature-btn { width: 100%; box-sizing: border-box; background: var(--card); border: none; border-radius: var(--r); padding: 14px 16px; margin-top: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); text-align: left; display: flex; flex-direction: column; gap: 4px; cursor: pointer; font-family: inherit; }
.emote-view .em-feature-btn:active { transform: scale(0.985); box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
.emote-view .em-feature-icon { display: inline-flex; }
.emote-view .em-feature-label { font-size: 14px; font-weight: 700; color: var(--text); }
.emote-view .em-feature-desc { font-size: 11px; color: var(--text-2); line-height: 1.5; }
.emote-view .em-feature-btn-twitter { background: #000; }
.emote-view .em-feature-btn-twitter .em-feature-label { color: #fff; }
.emote-view .em-feature-btn-twitter .em-feature-desc { color: rgba(255,255,255,0.68); }
.emote-view .em-feature-btn-twitter .inline-icon { stroke: #fff; color: #fff; }

/* ── 一覧見出し・表示切替 ── */
.emote-view .em-list-header-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 22px 4px 8px; }
.emote-view .em-list-header-row-controls { padding-top: 0; justify-content: flex-end; }
.emote-view .em-sec-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-2); }
.emote-view .em-view-toggle { display: flex; background: var(--bg); border-radius: 999px; padding: 3px; gap: 2px; flex-shrink: 0; }
.emote-view .em-view-toggle-btn { font-size: 12px; font-weight: 600; color: var(--text-2); padding: 7px 12px; border-radius: 999px; transition: background 0.15s, color 0.15s; border: none; background: none; cursor: pointer; font-family: inherit; }
.emote-view .em-view-toggle-btn.active { background: var(--card); color: var(--text); font-weight: 700; box-shadow: 0 1px 3px rgba(0,0,0,0.12); }
.emote-view .em-grid-cols-select { background: var(--bg); border: none; padding: 6px 10px; border-radius: 999px; font-size: 12px; color: var(--text-2); font-weight: 600; outline: none; flex-shrink: 0; font-family: inherit; }

/* ── グリッド表示 ── */
.emote-view .em-grid { display: none; grid-template-columns: repeat(auto-fill, minmax(82px, 1fr)); gap: 10px; align-items: start; }
.emote-view .em-tile { display: flex; flex-direction: column; gap: 5px; }
.emote-view .em-tile-frame { position: relative; aspect-ratio: 1 / 1; overflow: hidden; background: var(--card); border-radius: var(--r-sm); border: 2px solid transparent; box-shadow: 0 1px 4px rgba(0,0,0,0.07), 0 0.5px 1px rgba(0,0,0,0.04); }
.emote-view .em-tile-frame.is-complete { border-color: var(--green); }
.emote-view .em-tile-img-wrap { position: absolute; inset: 0; z-index: 1; display: flex; align-items: center; justify-content: center; background: var(--bg); filter: grayscale(1) opacity(0.4); transition: filter 0.15s; }
.emote-view .em-tile-frame.is-complete .em-tile-img-wrap { filter: none; }
.emote-view .em-tile-img-wrap img { width: 100%; height: 100%; object-fit: contain; padding: 14%; display: block; }
.emote-view .em-tile-img-wrap.em-img-fallback img { display: none; }
.emote-view .em-tile-fallback { display: none; }
.emote-view .em-tile-img-wrap.em-img-fallback .em-tile-fallback { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
.emote-view .em-tile-levels { position: absolute; bottom: 4px; left: 0; right: 0; z-index: 2; display: flex; justify-content: center; flex-wrap: wrap; gap: 2px; padding: 0 4px; }
.emote-view .em-tile-lv-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; background: rgba(255,255,255,0.85); border: 1px solid var(--text-3); cursor: pointer; position: relative; padding: 0; }
.emote-view .em-tile-lv-dot::before { content: ''; position: absolute; inset: -8px; }
.emote-view .em-tile-lv-dot.is-owned { background: var(--green); border-color: var(--green); }
.emote-view .em-tile-lv-dot:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
.emote-view .em-tile-own-all-btn { position: absolute; top: 3px; right: 3px; z-index: 3; width: 18px; height: 18px; border-radius: 50%; background: var(--blue-solid); border: none; color: #fff; font-size: 10px; font-weight: 700; line-height: 1; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.35); cursor: pointer; padding: 0; }
.emote-view .em-tile-own-all-btn::before { content: ''; position: absolute; inset: -6px; }
.emote-view .em-tile-own-all-btn:active { transform: scale(0.9); }
.emote-view .em-tile-own-all-btn.is-complete { background: var(--text-3); }
.emote-view .em-tile-own-all-btn:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
.emote-view .em-tile-guide-badge { position: absolute; top: 3px; left: 3px; z-index: 3; width: 18px; height: 18px; border-radius: 50%; background: rgba(28,28,30,0.82); color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.35); }
.emote-view .em-tile-guide-badge .inline-icon { stroke: #fff; color: #fff; }
.emote-view .em-tile-recent-badge { position: absolute; top: 3px; left: 50%; transform: translateX(-50%); z-index: 3; width: 18px; height: 18px; border-radius: 50%; background: var(--orange); color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.35); }
.emote-view .em-tile-name { font-size: 10.5px; line-height: 1.3; text-align: center; color: var(--text-2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; padding: 0 1px; text-decoration: none; }
.emote-view .em-tile-name:hover { text-decoration: underline; }

/* ── リスト表示 ── */
.emote-view .em-list { display: flex; flex-direction: column; gap: 8px; }
.emote-view .em-card { background: var(--card); border-radius: var(--r); padding: 14px 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.07), 0 0.5px 1px rgba(0,0,0,0.04); display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; transition: background 0.2s; }
.emote-view .em-card.is-complete { background: rgba(52,199,89,0.05); }
.emote-view .em-card-icon { width: 44px; height: 44px; border-radius: var(--r-sm); flex-shrink: 0; background: var(--bg); display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; filter: grayscale(1) opacity(0.5); transition: filter 0.15s; }
.emote-view .em-card.is-complete .em-card-icon { filter: none; }
.emote-view .em-card-icon img { width: 100%; height: 100%; object-fit: contain; padding: 12%; display: block; }
.emote-view .em-card-icon.em-img-fallback img { display: none; }
.emote-view .em-card-icon-fallback { display: none; }
.emote-view .em-card-icon.em-img-fallback .em-card-icon-fallback { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
.emote-view .em-info { min-width: 140px; flex: 1; }
.emote-view .em-name { display: block; font-size: 15px; font-weight: 600; color: var(--text); text-decoration: none; }
.emote-view .em-name:hover { text-decoration: underline; }
.emote-view .em-name-en { font-size: 11px; color: var(--text-2); margin-top: 2px; }
.emote-view .em-sub { font-size: 12px; color: var(--text-2); margin-top: 3px; }
.emote-view .em-card.is-complete .em-sub { color: var(--green); font-weight: 600; }
.emote-view .em-guide-badge { display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; font-weight: 700; color: #fff; background: rgba(28,28,30,0.82); border-radius: 999px; padding: 2px 8px; margin-top: 4px; white-space: nowrap; }
.emote-view .em-guide-badge .inline-icon { stroke: #fff; color: #fff; }
.emote-view .em-recent-badge { display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; font-weight: 700; color: var(--orange-d); background: var(--orange-bg); border-radius: 999px; padding: 2px 8px; margin-top: 4px; white-space: nowrap; }
.emote-view .em-guide-badge + .em-recent-badge { margin-left: 6px; }
.emote-view .em-lv-row { display: flex; gap: 6px; flex-shrink: 0; flex-wrap: wrap; }
.emote-view .em-lv-btn { width: 34px; height: 34px; border-radius: 50%; background: var(--bg); color: var(--text-2); font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; border: 2px solid transparent; transition: all 0.12s; cursor: pointer; font-family: inherit; padding: 0; }
.emote-view .em-lv-btn:active { transform: scale(0.9); }
.emote-view .em-lv-btn.is-owned { background: var(--green-bg); color: var(--green); border-color: var(--green); }
.emote-view .em-lv-btn:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
.emote-view .em-own-all-btn { display: flex; align-items: center; gap: 4px; flex-shrink: 0; background: var(--blue-bg); color: var(--own-all-blue); border: none; border-radius: 999px; padding: 7px 12px; font-size: 12px; font-weight: 700; white-space: nowrap; cursor: pointer; font-family: inherit; }
.emote-view .em-own-all-btn:active { transform: scale(0.95); }
.emote-view .em-own-all-btn.is-complete { background: var(--bg); color: var(--text-2); }
.emote-view .em-own-all-btn:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }

.emote-view .em-empty-message { grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-2); font-size: 14px; background: var(--card); border-radius: var(--r); }

/* ── 入手履歴モーダルの内容（オーバーレイ自体は共有chrome.cssの.modal-overlay・.modal-card） ── */
.em-log-hint { font-size: 12.5px; color: var(--hub-text-2); line-height: 1.5; margin-top: -4px; }
.em-log-row-list { display: flex; flex-direction: column; margin-top: 10px; }
.em-log-row { display: flex; align-items: center; gap: 10px; padding: 10px 2px; border-bottom: 0.5px solid var(--hub-sep); }
.em-log-row:last-child { border-bottom: none; }
.em-log-row-icon { width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0; background: var(--hub-bg); display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; }
.em-log-row-icon img { width: 100%; height: 100%; object-fit: contain; padding: 12%; display: block; }
.em-log-row-icon.em-img-fallback img { display: none; }
.em-log-row-icon-fallback { display: none; }
.em-log-row-icon.em-img-fallback .em-log-row-icon-fallback { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
.em-log-row-info { flex: 1; min-width: 0; }
.em-log-row-name { font-size: 14px; font-weight: 600; color: var(--hub-text); }
.em-log-row-level { font-size: 11.5px; font-weight: 700; color: #FF9500; margin-left: 2px; }
.em-log-row-meta { font-size: 11.5px; color: var(--hub-text-2); margin-top: 2px; }
.em-log-empty { font-size: 12.5px; color: var(--hub-text-2); padding: 10px 2px; line-height: 1.6; }
.em-log-count { text-align: right; font-size: 11.5px; color: var(--hub-text-2); margin-top: 10px; }
.em-log-count .em-stat-num { color: var(--hub-text); font-weight: 700; }

.em-toast {
  position: fixed; left: 50%; bottom: calc(84px + env(safe-area-inset-bottom)); transform: translateX(-50%) translateY(10px);
  background: rgba(28,28,30,0.92); color: #fff; padding: 12px 20px; border-radius: 999px;
  font-size: 13.5px; font-weight: 600; z-index: 2000; opacity: 0; transition: opacity 0.25s, transform 0.25s;
  pointer-events: none; white-space: nowrap; max-width: 90vw; text-overflow: ellipsis; overflow: hidden;
}
.em-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
`;
  document.head.appendChild(style);
}

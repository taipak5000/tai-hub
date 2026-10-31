/* ================================================================
   tai-nomacan-pro（ノマキャン計算機プロ）のtai-hub移植版。
   公開面はmount(container)/unmount()の2関数のみ（js/router.jsから
   マウントされる）。

   移植元: tai-nomacan.pro/index.html（Vue 3製、~4900行）のうち、共有
   chrome（プロフィール切替・環境設定・他のツールドロワー・サイトドック）
   を除いた「このツール自身」の部分：キャンドル管理（繰越・日割り見込み・
   黒シャード予測・所持キャンドル数の他ツール連携）・効率自動最適化・
   エリア管理（%スライダー・検索・詳細設定でのチェックツリー）・
   マイルート（別ファイルnomacan-pro-routes.jsへ委譲）。

   「今日の精錬状況」「キャンドル管理」の2枚のカードは nomacan-pro-top.js、
   黒シャード/デイリーリセットの通知は nomacan-pro-notify.js に分けてある
   （入力欄を描き直さず値だけ更新する作り。1文字ごとにフォーカスが外れる不具合の対策）。

   【意図的な簡略化・アダプテーション】
   - プロフィール切替・環境設定（テーマ/言語/ショートカット）・
     「他のツール」ドロワーはtai-hub共有chrome（js/chrome/*.js）が
     既に持つため移植していない（nomacan-view.jsと同じ方針）。
   - 「表示するカード」のセクション個別表示/非表示トグル（visibleSections）は
     移植済み（下記renderShellの.nmp-visibility-card・applyVisibleSections、
     nomacan-pro-state.jsのDEFAULT_VISIBLE_SECTIONS）。
   - 黒シャード予測は、直近3回分の実現日時（JST）を表示する（移植元の
     shardPrediction/getBlackShardOccurrencesInJst相当。実体は
     nomacan-pro-state.jsのpredictUpcomingBlackShard）。
   - モーダルはtai-hub共有の.modal-overlay/.modal-cardクラス（chrome.css）
     に統一（nomacan-view.jsの目標管理モーダルと同じ方針）。
   ================================================================ */
import { CURRENT_LANG } from '../../js/i18n.js';
import { nsKey } from '../../js/state.js';
import { t } from './data/i18n-nomacan-pro.js';
import { displayAreaName as displayAreaNameRaw } from './data/area-names-en.js';
import * as S from './nomacan-pro-state.js';
import { initRoutes, renderRoutes, teardownRoutes, seedTemplateRoute } from './nomacan-pro-routes.js';
import * as Top from './nomacan-pro-top.js';

const STYLE_LINK_ID = 'nomacan-pro-view-styles';
const ICON_SPRITE_ID = 'nomacan-pro-icon-sprite';

let containerEl = null;

// ── 状態（mount毎に初期化） ──────────────────────────────────
let areas = [];
let myRoutes = [];
let currentCandles = 0;
let plannedUsage = 0;
let heartsToSend = 0;
let targetCandlesForOptimization = 20;
let carryOverPercent = 0;
let carryOverGap = 94;
let candleMemo = '';
let targetDate = '';
let dailyBonusArea = 0;
let dailyShard = 'none';
let visibleSections = { ...S.DEFAULT_VISIBLE_SECTIONS }; // 表示するカード（キャンドル管理/効率自動最適化/マイルート）
let currentTimeMult = 1.7;

let showDetailedAreaSettings = localStorage.getItem(S.AREA_DETAIL_OPEN_KEY) === '1';
let showTodayOnlyFilter = localStorage.getItem(S.AREA_TODAY_FILTER_KEY) === '1';
let areaSearchQuery = '';
let presetCheckedIds = new Set(); // 一括プリセットの対象として個別にチェックされたエリアid

let deletingAreaPath = null; // {mIdx,sIdx,spIdx} の一部のみ持つ削除確認対象
let toastSeq = 0;
let toastQueueEl = null;
let confirmModalCb = null;

let onCurrencyStorageListener = null;
let onVisibilityCommit = null;

export function mount(container) {
  injectStylesheet();
  injectLocalIconSprite();
  containerEl = container;

  const savedMult = localStorage.getItem(S.TIME_MULT_KEY);
  if (savedMult !== null && !isNaN(parseFloat(savedMult))) currentTimeMult = parseFloat(savedMult);

  const loaded = S.loadState();
  const initial = loaded || S.loadInitialData(currentTimeMult);
  areas = initial.areas;
  myRoutes = initial.myRoutes;
  currentCandles = initial.currentCandles;
  plannedUsage = initial.plannedUsage;
  heartsToSend = initial.heartsToSend;
  targetCandlesForOptimization = initial.targetCandlesForOptimization;
  carryOverPercent = initial.carryOverPercent;
  carryOverGap = initial.carryOverGap;
  candleMemo = initial.candleMemo;
  targetDate = initial.targetDate || defaultTargetDate();
  dailyBonusArea = initial.dailyBonusArea;
  dailyShard = initial.dailyShard;
  visibleSections = { ...S.DEFAULT_VISIBLE_SECTIONS, ...(initial.visibleSections || {}) };

  container.innerHTML = renderShell();
  toastQueueEl = document.getElementById('nmpToastStack');

  window.__nmpAreaToggleExpand = (mIdx) => { toggleAreaExpand(mIdx); };
  window.__nmpSubToggleExpand = (mIdx, sIdx) => { toggleSubExpand(mIdx, sIdx); };
  window.__nmpAreaCheckToggle = (mIdx) => { toggleAreaChecked(mIdx); };
  window.__nmpAreaPctChange = (mIdx, val) => { onAreaPctChange(mIdx, val); };
  window.__nmpAreaPctInput = (mIdx, val) => { onAreaPctInput(mIdx, val); };
  window.__nmpPresetClick = (pct) => { applyPresetToChecked(pct); };
  window.__nmpSubSelectToggle = (mIdx, sIdx) => { toggleSubSelected(mIdx, sIdx); };
  window.__nmpSpotSelectToggle = (mIdx, sIdx, spIdx) => { toggleSpotSelected(mIdx, sIdx, spIdx); };
  window.__nmpSearchInput = (val) => { areaSearchQuery = val; renderAreaList(); };
  window.__nmpTodayFilterToggle = () => { toggleTodayFilter(); };
  window.__nmpDetailToggle = () => { toggleDetail(); };
  window.__nmpAddMainArea = () => { addMainArea(); };
  window.__nmpAddSubArea = (mIdx) => { addSubArea(mIdx); };
  window.__nmpAddSpot = (mIdx, sIdx) => { addSpot(mIdx, sIdx); };
  window.__nmpRequestDeleteArea = (mIdx) => { requestDelete({ mIdx }); };
  window.__nmpRequestDeleteSub = (mIdx, sIdx) => { requestDelete({ mIdx, sIdx }); };
  window.__nmpRequestDeleteSpot = (mIdx, sIdx, spIdx) => { requestDelete({ mIdx, sIdx, spIdx }); };
  window.__nmpConfirmDelete = () => { confirmDelete(); };
  window.__nmpCancelDelete = () => { deletingAreaPath = null; closeConfirmModal(); };
  window.__nmpSpotFieldInput = (mIdx, sIdx, spIdx, field, val) => { onSpotFieldInput(mIdx, sIdx, spIdx, field, val); };
  window.__nmpAreaNameInput = (mIdx, val) => { areas[mIdx].name = val; persist(true); };
  window.__nmpSubNameInput = (mIdx, sIdx, val) => { areas[mIdx].subAreas[sIdx].name = val; persist(true); };
  window.__nmpSpotNameInput = (mIdx, sIdx, spIdx, val) => { areas[mIdx].subAreas[sIdx].spots[spIdx].name = val; persist(true); };
  window.__nmpSubTimeInput = (mIdx, sIdx, val) => { areas[mIdx].subAreas[sIdx].time = Math.max(0, Number(val) || 0); persist(true); recomputeAndRenderTop(); };

  window.__nmpTargetInput = (val) => { targetCandlesForOptimization = Math.max(0, Number(val) || 0); persist(); };
  window.__nmpOptimizeClick = () => { doOptimize(); };
  window.__nmpMoveMainArea = (mIdx, dir) => { moveMainArea(mIdx, dir); };
  window.__nmpMoveSubArea = (mIdx, sIdx, dir) => { moveSubArea(mIdx, sIdx, dir); };
  window.__nmpMainDirectInput = (mIdx, field, val) => { areas[mIdx][field] = Math.max(0, Number(val) || 0); persist(true); recomputeAndRenderTop(); };
  window.__nmpMainSelectedToggle = (mIdx, checked) => { areas[mIdx].isSelected = checked; persist(true); renderAreaList(); recomputeAndRenderTop(); };
  window.__nmpSubLightInput = (mIdx, sIdx, val) => { areas[mIdx].subAreas[sIdx].light = Math.max(0, Number(val) || 0); persist(true); recomputeAndRenderTop(); };
  window.__nmpConfirmResetData = () => { confirmResetData(); };
  window.__nmpVisibleSectionToggle = (key, checked) => { visibleSections[key] = checked; persist(); applyVisibleSections(); };

  initRoutes(container, {
    getAreas: () => areas,
    getMyRoutes: () => myRoutes,
    onChanged: (skipTopRerender) => { persist(true); if (!skipTopRerender) recomputeAndRenderTop(); },
    displayName: displayAreaName,
    showToast,
  });
  seedTemplateRoute(); // 「20本ルート（ソロ・試練無し）」を最初から入れておく（プロフィールごとに1回）

  // 🔗 所持キャンドル数を他ツール(item等)の所持通貨と同期する
  const sharedRaw = readSharedCandleRaw();
  if (sharedRaw !== null) {
    currentCandles = sharedRaw;
  } else if (currentCandles > 0) {
    S.writeOwnedCandle(currentCandles);
  }
  onCurrencyStorageListener = (e) => {
    if (e.key === 'skyActiveProfile_v1') { location.reload(); return; }
    if (e.key !== S.CURRENCY_KEY()) return;
    const v = readSharedCandleRaw();
    if (v !== null && v !== currentCandles) { currentCandles = v; recomputeAndRenderTop(); }
  };
  window.addEventListener('storage', onCurrencyStorageListener);

  renderAreaList();
  renderRoutes();
  Top.mountTop(document.getElementById('nmpRefineBody'), document.getElementById('nmpCandleBody'), topContext);
}

// 「今日の精錬状況」「キャンドル管理」カード(nomacan-pro-top.js)とのやり取り
const topContext = {
  get: () => ({ areas, carryOverPercent, carryOverGap, dailyBonusArea, dailyShard, currentCandles, plannedUsage, heartsToSend, targetDate, candleMemo }),
  set: (patch) => {
    if ('carryOverPercent' in patch) carryOverPercent = patch.carryOverPercent;
    if ('carryOverGap' in patch) carryOverGap = patch.carryOverGap;
    if ('dailyBonusArea' in patch) dailyBonusArea = patch.dailyBonusArea;
    if ('dailyShard' in patch) dailyShard = patch.dailyShard;
    if ('plannedUsage' in patch) plannedUsage = patch.plannedUsage;
    if ('heartsToSend' in patch) heartsToSend = patch.heartsToSend;
    if ('targetDate' in patch) targetDate = patch.targetDate;
    if ('candleMemo' in patch) candleMemo = patch.candleMemo;
    if ('currentCandles' in patch) { currentCandles = patch.currentCandles; S.writeOwnedCandle(currentCandles); }
    persist();
  },
  onAreasChanged: () => { persist(true); renderAreaList(); },
  showToast: (msg, type) => showToast(msg, type),
  requestResetData: () => requestResetData(),
};

export function unmount() {
  Top.unmountTop();
  if (onCurrencyStorageListener) { window.removeEventListener('storage', onCurrencyStorageListener); onCurrencyStorageListener = null; }
  if (onVisibilityCommit) { document.removeEventListener('visibilitychange', onVisibilityCommit); onVisibilityCommit = null; }
  teardownRoutes();
  document.getElementById('nmpConfirmModalOverlay')?.remove();
  containerEl = null;
}

function defaultTargetDate() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().split('T')[0];
}
function readSharedCandleRaw() {
  try {
    const raw = localStorage.getItem(S.CURRENCY_KEY());
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed.candle === 'number') ? Math.max(0, parsed.candle) : null;
  } catch (e) { return null; }
}
function displayAreaName(jaName) { return displayAreaNameRaw(CURRENT_LANG, jaName); }

/* ================================================================
   💾 保存
   ================================================================ */
function persist(skip) {
  S.saveState({
    areas, myRoutes, carryOverPercent, carryOverGap, targetDate, currentCandles,
    plannedUsage, heartsToSend, targetCandlesForOptimization, candleMemo, dailyBonusArea, dailyShard, visibleSections,
  });
}
// 👁️ 表示するカードのチェックボックスをトグルした直後、シェル全体を作り直さずに
// 対象セクションのdisplayだけ切り替える（他セクションの入力中の値やスクロール位置を保持するため）
function applyVisibleSections() {
  const map = { candleManage: 'nmpSectionCandleManage', optimization: 'nmpSectionOptimization', myRoutes: 'nmpSectionMyRoutes' };
  Object.keys(map).forEach((key) => {
    const el = document.getElementById(map[key]);
    if (el) el.style.display = visibleSections[key] ? '' : 'none';
  });
}
/* ================================================================
   🌲 エリアツリー操作
   ================================================================ */
function toggleAreaExpand(mIdx) { areas[mIdx].isExpanded = !areas[mIdx].isExpanded; renderAreaList(); }
function toggleSubExpand(mIdx, sIdx) { areas[mIdx].subAreas[sIdx].isExpanded = !areas[mIdx].subAreas[sIdx].isExpanded; renderAreaList(); }
function toggleAreaChecked(mIdx) {
  const area = areas[mIdx];
  area.isSelected = !area.isSelected; // このデータでは常時sub-modeのため「一括プリセット対象」フラグとして流用
  persist(true);
  renderAreaList();
}
function onAreaPctInput(mIdx, val) {
  const readout = document.getElementById(`nmpPctReadout${mIdx}`);
  if (readout) readout.textContent = `${val}%`;
}
function onAreaPctChange(mIdx, val) {
  S.applyAreaPercent(areas[mIdx], Number(val) || 0);
  persist(true);
  renderAreaList();
  recomputeAndRenderTop();
}
function applyPresetToChecked(pct) {
  const checked = areas.filter((a) => a.isSelected);
  if (checked.length === 0) return;
  checked.forEach((a) => S.applyAreaPercent(a, pct));
  persist(true);
  renderAreaList();
  recomputeAndRenderTop();
}
function toggleSubSelected(mIdx, sIdx) {
  const sub = areas[mIdx].subAreas[sIdx];
  sub.isSelected = !sub.isSelected;
  persist(true);
  renderAreaList();
  recomputeAndRenderTop();
}
function toggleSpotSelected(mIdx, sIdx, spIdx) {
  const sub = areas[mIdx].subAreas[sIdx];
  const spot = sub.spots[spIdx];
  spot.isSelected = !spot.isSelected;
  if (spot.isSelected) S.enforceSpotGroupExclusivity(sub.spots);
  persist(true);
  renderAreaList();
  recomputeAndRenderTop();
}
function toggleTodayFilter() {
  showTodayOnlyFilter = !showTodayOnlyFilter;
  try { localStorage.setItem(S.AREA_TODAY_FILTER_KEY, showTodayOnlyFilter ? '1' : '0'); } catch (e) { /* noop */ }
  renderAreaList();
}
function toggleDetail() {
  showDetailedAreaSettings = !showDetailedAreaSettings;
  try { localStorage.setItem(S.AREA_DETAIL_OPEN_KEY, showDetailedAreaSettings ? '1' : '0'); } catch (e) { /* noop */ }
  renderAreaList();
}
function moveMainArea(index, dir) {
  const target = index + dir;
  if (target < 0 || target >= areas.length) return;
  const item = areas.splice(index, 1)[0];
  areas.splice(target, 0, item);
  persist(true);
  renderAreaList();
}
function moveSubArea(mIdx, sIdx, dir) {
  const subs = areas[mIdx].subAreas;
  const target = sIdx + dir;
  if (target < 0 || target >= subs.length) return;
  const item = subs.splice(sIdx, 1)[0];
  subs.splice(target, 0, item);
  persist(true);
  renderAreaList();
}
function addMainArea() {
  areas.push({ id: S.uuid(), name: t('area.newMainArea'), isExpanded: true, light: 0, time: 0, isSelected: false, subAreas: [] });
  persist(true);
  renderAreaList();
}
function addSubArea(mIdx) {
  areas[mIdx].subAreas.push({ id: S.uuid(), name: t('area.newSubArea'), isExpanded: true, light: 0, time: 0, isSelected: false, spots: [] });
  persist(true);
  renderAreaList();
}
function addSpot(mIdx, sIdx) {
  areas[mIdx].subAreas[sIdx].spots.push({ id: S.uuid(), name: t('area.newSpot'), light: 0, time: 0, isSelected: false, group: '' });
  persist(true);
  renderAreaList();
}
function onSpotFieldInput(mIdx, sIdx, spIdx, field, val) {
  const spot = areas[mIdx].subAreas[sIdx].spots[spIdx];
  if (field === 'light') spot.light = Math.max(0, Number(val) || 0);
  else if (field === 'group') spot.group = val;
  persist(true);
  recomputeAndRenderTop();
}
function requestDelete(path) {
  deletingAreaPath = path;
  openConfirmModal(deleteConfirmMessage(path), () => confirmDelete());
}
function deleteConfirmMessage(path) {
  if (path.spIdx !== undefined) return t('area.deleteSpotConfirm', { name: areas[path.mIdx].subAreas[path.sIdx].spots[path.spIdx].name });
  if (path.sIdx !== undefined) return t('area.deleteSubAreaConfirm', { name: areas[path.mIdx].subAreas[path.sIdx].name });
  return t('area.deleteAreaConfirm', { name: areas[path.mIdx].name });
}
function confirmDelete() {
  const path = deletingAreaPath;
  if (!path) { closeConfirmModal(); return; }
  if (path.spIdx !== undefined) areas[path.mIdx].subAreas[path.sIdx].spots.splice(path.spIdx, 1);
  else if (path.sIdx !== undefined) areas[path.mIdx].subAreas.splice(path.sIdx, 1);
  else areas.splice(path.mIdx, 1);
  deletingAreaPath = null;
  closeConfirmModal();
  persist(true);
  renderAreaList();
  recomputeAndRenderTop();
}
function requestResetData() {
  openConfirmModal(t('confirmModal.resetDataConfirm'), () => confirmResetData());
}
function confirmResetData() {
  currentCandles = 0; plannedUsage = 0; heartsToSend = 0; carryOverPercent = 0; carryOverGap = 94;
  dailyBonusArea = 0; candleMemo = '';
  Top.syncDailyShardWithPrediction(true);
  areas.forEach((area) => {
    const aMode = S.getAreaMode(area);
    if (aMode === 'main') { area.isSelected = false; } else {
      (area.subAreas || []).forEach((sub) => {
        if (S.getSubMode(sub) === 'sub') sub.isSelected = false;
        else (sub.spots || []).forEach((sp) => { if (sp) sp.isSelected = false; });
      });
    }
  });
  closeConfirmModal();
  persist(true);
  renderAreaList();
  recomputeAndRenderTop();
  showToast(t('confirmModal.resetDataDone'), 'success');
}
function doOptimize() {
  Top.runOptimize(targetCandlesForOptimization);
  persist(true);
}

/* ================================================================
   🔔 トースト・確認モーダル
   ================================================================ */
function showToast(msg, type) {
  if (!msg || !toastQueueEl) return;
  const id = ++toastSeq;
  const el = document.createElement('div');
  el.className = `nmp-toast nmp-toast-${type === 'error' ? 'error' : 'success'}`;
  el.textContent = msg;
  el.dataset.toastId = id;
  toastQueueEl.appendChild(el);
  setTimeout(() => { el.remove(); }, type === 'error' ? 3400 : 2600);
}
function openConfirmModal(message, onConfirm) {
  confirmModalCb = onConfirm;
  let overlay = document.getElementById('nmpConfirmModalOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'nmpConfirmModalOverlay';
    overlay.className = 'modal-overlay nomacan-pro-view';
    overlay.innerHTML = `<div class="modal-card nmp-confirm-modal">
      <p class="nmp-confirm-modal-msg" id="nmpConfirmModalMsg"></p>
      <div class="nmp-confirm-modal-actions">
        <button type="button" class="nmp-btn nmp-btn-outline" onclick="__nmpCancelDelete()">${escHtml(t('confirmModal.cancel'))}</button>
        <button type="button" class="nmp-btn nmp-btn-red" onclick="__nmpConfirmDelete()">${escHtml(t('confirmModal.execute'))}</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeConfirmModal(); });
  }
  document.getElementById('nmpConfirmModalMsg').textContent = message;
  overlay.classList.add('open');
  window.__nmpConfirmDelete = () => { if (confirmModalCb) confirmModalCb(); };
}
function closeConfirmModal() {
  document.getElementById('nmpConfirmModalOverlay')?.classList.remove('open');
  confirmModalCb = null;
}
function escHtml(str) { return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ================================================================
   🖼️ 描画: シェル全体
   ================================================================ */
function renderShell() {
  return `
  <div class="nomacan-pro-view nmp-root">
    <div class="nmp-wrap">
      <header class="nmp-header"><h1>${t('pageTitle') || (CURRENT_LANG === 'en' ? 'Nomacan Calculator Pro' : 'ノマキャン計算機プロ')}</h1></header>
      <details class="nmp-card nmp-visibility-card">
        <summary class="nmp-visibility-summary"><svg class="inline-icon" width="14" height="14"><use href="#i-settings"/></svg> ${escHtml(t('settings.panelHeader'))}</summary>
        <div class="nmp-visibility-options">
          <label class="nmp-visibility-opt"><input type="checkbox" ${visibleSections.candleManage ? 'checked' : ''} onchange="__nmpVisibleSectionToggle('candleManage', this.checked)"> ${escHtml(t('settings.candleManage'))}</label>
          <label class="nmp-visibility-opt"><input type="checkbox" ${visibleSections.optimization ? 'checked' : ''} onchange="__nmpVisibleSectionToggle('optimization', this.checked)"> ${escHtml(t('settings.optimization'))}</label>
          <label class="nmp-visibility-opt"><input type="checkbox" ${visibleSections.myRoutes ? 'checked' : ''} onchange="__nmpVisibleSectionToggle('myRoutes', this.checked)"> ${escHtml(t('settings.myRoutes'))}</label>
        </div>
      </details>
      <div class="nmp-grid">
        <div class="nmp-col">
          <section class="nmp-card" id="nmpSectionRefine">
            <div class="nmp-card-header">${escHtml(t('refine.sectionHeader'))}</div>
            <div id="nmpRefineBody"></div>
          </section>
          <section class="nmp-card" id="nmpSectionCandleManage" style="${visibleSections.candleManage ? '' : 'display:none;'}">
            <div class="nmp-card-header nmp-card-header-split"><span>${escHtml(t('candle.sectionHeader') || (CURRENT_LANG === 'en' ? 'Candle Management' : 'キャンドル管理'))}</span><span class="nmp-dim nmp-normal">${escHtml(t('candle.dcNote'))}</span></div>
            <div id="nmpCandleBody"></div>
          </section>
          <section class="nmp-card" id="nmpSectionOptimization" style="${visibleSections.optimization ? '' : 'display:none;'}">
            <div class="nmp-card-header">${escHtml(t('optimize.sectionHeader'))}</div>
            <div class="nmp-row"><div>${escHtml(t('optimize.targetLabel'))}</div><input type="number" value="${targetCandlesForOptimization}" oninput="__nmpTargetInput(this.value)"></div>
            <button type="button" class="nmp-btn nmp-btn-orange nmp-btn-block" onclick="__nmpOptimizeClick()">${escHtml(t('optimize.autoSelectBtn'))}</button>
          </section>
        </div>
        <div class="nmp-col">
          <section class="nmp-card" id="nmpSectionMyRoutes" style="${visibleSections.myRoutes ? '' : 'display:none;'}">
            <div class="nmp-card-header">${escHtml(t('route.sectionHeader'))}</div>
            <div id="nmpRoutesBody"></div>
          </section>
          <section class="nmp-card">
            <div class="nmp-card-header">${escHtml(t('area.sectionHeader'))}</div>
            <div id="nmpAreaBody"></div>
          </section>
        </div>
      </div>
      <footer class="nmp-footer">
        <span>${escHtml(t('footer.disclaimer'))}</span><br>
        <span>${escHtml(t('footer.creditLabel'))}</span> <a href="https://x.com/Skyzztai" target="_blank" rel="noopener noreferrer">@Skyzztai</a>　／　<a href="https://odaibako.net/u/Skyzztai" target="_blank" rel="noopener noreferrer">${escHtml(t('footer.requestForm'))}</a><br>
        <span class="nmp-footer-sub">
          ${escHtml(t('footer.referencesLabel'))}
          <a href="https://sky-children-of-the-light.fandom.com/wiki/Pieces_of_Light" target="_blank" rel="noopener noreferrer">Pieces of Light (Sky Wiki)</a> |
          <a href="https://sky-children-of-the-light.fandom.com/wiki/Additional_Light_Sources" target="_blank" rel="noopener noreferrer">Additional Light Sources (Sky Wiki)</a>
        </span><br>
        <span class="nmp-footer-sub">
          <a href="#/tai-info">${escHtml(t('footer.infoLink'))}</a>
        </span>
      </footer>
    </div>
    <div class="nmp-toast-stack" id="nmpToastStack"></div>
  </div>`;
}

/* ================================================================
   🖼️ 上段2カード（今日の精錬状況・キャンドル管理）の更新。
   描画の実体は nomacan-pro-top.js（入力欄は描き直さず、数値だけ差し替える）
   ================================================================ */
function recomputeAndRenderTop() {
  Top.syncInputs();
  Top.update();
}

/* ================================================================
   🖼️ 描画: エリア管理カード
   ================================================================ */
// 元実装のAREA_VISUAL_MAPと同じ（アイコン＋丸バッジの色）。i-leaf・i-giftは共有スプライトに無いのでnmp-i-*で持つ
const AREA_VISUAL_MAP = {
  'ホーム': { icon: 'i-folder', color: 'blue' }, '孤島': { icon: 'i-sun', color: 'orange' },
  '草原': { icon: 'nmp-i-leaf', color: 'green' }, '雨林': { icon: 'i-tree', color: 'blue' },
  '峡谷': { icon: 'i-crown', color: 'purple' }, '捨て地': { icon: 'i-moon', color: 'orange' },
  '書庫': { icon: 'i-star', color: 'purple' }, 'コラボルーム': { icon: 'nmp-i-gift', color: 'red' },
  'ソーシャルライト': { icon: 'i-heart', color: 'green' }, 'ランダムの火種': { icon: 'i-sparkle', color: 'blue' },
};
function areaVisual(area) { return AREA_VISUAL_MAP[area.name] || { icon: 'i-pin', color: 'blue' }; }

function matchesSearch(name) {
  if (!areaSearchQuery.trim()) return true;
  return displayAreaName(name).toLowerCase().includes(areaSearchQuery.trim().toLowerCase()) || name.includes(areaSearchQuery.trim());
}
function subAreaMatchesSearch(sub) {
  if (matchesSearch(sub.name)) return true;
  if (Array.isArray(sub.spots)) return sub.spots.some((sp) => matchesSearch(sp.name));
  return false;
}
function areaMatchesSearch(area) {
  if (matchesSearch(area.name)) return true;
  if (Array.isArray(area.subAreas)) return area.subAreas.some((sub) => subAreaMatchesSearch(sub));
  return false;
}

function renderAreaList() {
  const el = document.getElementById('nmpAreaBody');
  if (!el) return;
  const hasSearch = areaSearchQuery.trim().length > 0;
  const anyChecked = areas.some((a) => a.isSelected);
  const detailAreas = areas.map((a, i) => ({ a, i })).filter(({ a }) => !hasSearch || areaMatchesSearch(a));
  const preset = (pct, key) => `<button type="button" class="nmp-preset-btn" ${anyChecked ? '' : 'disabled'} onclick="__nmpPresetClick(${pct})">${escHtml(t(key))}<br><b>${pct}%</b></button>`;

  el.innerHTML = `
    <div class="nmp-preset-row">
      ${preset(15, 'area.presetLittle')}${preset(60, 'area.presetSome')}${preset(80, 'area.presetMost')}${preset(100, 'area.presetAll')}
    </div>
    ${anyChecked ? '' : `<div class="nmp-preset-hint">${escHtml(t('area.presetHint'))}</div>`}
    ${areas.map((a, i) => renderMainAreaRow(a, i)).join('')}
    <button type="button" class="nmp-btn nmp-btn-blue nmp-btn-block" style="margin-top:10px;" onclick="${myRoutesQuickCreateHandler()}"><svg class="inline-icon" width="14" height="14"><use href="#i-pin"/></svg> ${escHtml(t('area.createRouteBtn'))}</button>
    <button type="button" class="nmp-btn-outline-blue nmp-btn-block" style="margin-top:6px;" onclick="__nmpDetailToggle()"><svg class="inline-icon" width="13" height="13"><use href="#nmp-i-list"/></svg> ${escHtml(showDetailedAreaSettings ? t('area.hideDetail') : t('area.showDetail'))}</button>
    ${showDetailedAreaSettings ? `
    <div style="margin:12px 0 10px;">
      <input type="text" placeholder="${escHtml(t('area.searchPlaceholder'))}" value="${escHtml(areaSearchQuery)}" oninput="__nmpSearchInput(this.value)" style="font-size:16px;">
    </div>
    <div style="margin-bottom:14px;">
      <label class="nmp-today-filter"><input type="checkbox" ${showTodayOnlyFilter ? 'checked' : ''} onchange="__nmpTodayFilterToggle()"> ${escHtml(t('area.todayOnlyFilterLabel') || '今日対象のみ表示')}</label>
    </div>
    ${hasSearch && detailAreas.length === 0 ? `<div class="nmp-empty-state">${t('area.searchNoResults', { q: escHtml(areaSearchQuery) })}</div>` : ''}
    ${detailAreas.map(({ a, i }) => renderMainAreaAccordion(a, i)).join('')}` : ''}
    <button type="button" class="nmp-btn-add" onclick="__nmpAddMainArea()">${escHtml(t('area.addMainArea'))}</button>
  `;
}
function myRoutesQuickCreateHandler() {
  const createRoute = () => {
    const ids = S.buildSelectedSpotIds(areas);
    if (ids.length === 0) { showToast(t('route.noSpotSelected'), 'error'); return false; }
    myRoutes.push({ id: S.uuid(), name: `${t('route.defaultNamePrefix')} ${myRoutes.length + 1}`, memo: '', selectedSpotIds: ids, isExpanded: true, actualSeconds: 0, splitTimes: {}, runHistory: [], generatedSpell: '', generatedTextExport: '' });
    persist(true);
    renderRoutes();
    return true;
  };
  // エリア管理カードの「この選択でルートを作る」: 作ってマイルートまでスクロール
  window.__nmpCreateRouteFromSelection = () => {
    if (!createRoute()) return;
    showToast(t('route.createdFromSelectionHint'), 'success');
    document.getElementById('nmpRoutesBody')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  // マイルートカードの「現在の選択をルートとして保存」: その場で保存したことだけ伝える
  window.__nmpSaveCurrentRoute = () => {
    if (createRoute()) showToast(t('route.savedHint'), 'success');
  };
  return '__nmpCreateRouteFromSelection()';
}

// エリア%スライダーの1行（元実装の .area-pct-row と同じ。チェックしていないエリアは薄く・スライダー無効）
function renderMainAreaRow(area, mIdx) {
  const total = S.getMainAreaTotalLight(area);
  const stats = S.getMainAreaStats(area);
  const pct = total > 0 ? Math.round((stats.light / total) * 100) : 0;
  const vis = areaVisual(area);
  return `
    <div class="nmp-area-pct-row" style="opacity:${area.isSelected ? 1 : 0.55};">
      <div class="nmp-row" style="border-bottom:none; padding-bottom:2px;">
        <label class="nmp-area-pct-label">
          <input type="checkbox" ${area.isSelected ? 'checked' : ''} onchange="__nmpAreaCheckToggle(${mIdx})" style="flex-shrink:0;">
          <span class="nmp-area-icon-badge c-${vis.color}"><svg class="inline-icon"><use href="#${vis.icon}"/></svg></span>
          <span class="nmp-area-pct-name">${escHtml(displayAreaName(area.name))}</span>
        </label>
        <span class="nmp-area-pct-frac">${stats.light} / ${total} <svg class="inline-icon" width="12" height="12"><use href="#i-flame"/></svg> <b id="nmpPctReadout${mIdx}">${pct}%</b></span>
      </div>
      <input type="range" min="0" max="100" step="1" value="${pct}" ${area.isSelected ? '' : 'disabled'} aria-label="${escHtml(t('area.pctSliderAria', { name: displayAreaName(area.name) }))}"
        oninput="__nmpAreaPctInput(${mIdx}, this.value)" onchange="__nmpAreaPctChange(${mIdx}, this.value)">
    </div>`;
}

// 詳細設定のアコーディオン1件（元実装の .area-accordion。展開でサブエリア・スポットを編集）
function renderMainAreaAccordion(area, mIdx) {
  return `
    <div class="nmp-area-accordion">
      <div class="nmp-area-title-row">
        <span class="nmp-area-accordion-name" onclick="__nmpAreaToggleExpand(${mIdx})">${escHtml(displayAreaName(area.name))}</span>
        <button type="button" class="nmp-expand-toggle-btn" onclick="__nmpAreaToggleExpand(${mIdx})" aria-expanded="${area.isExpanded ? 'true' : 'false'}"><svg class="inline-icon" width="13" height="13" style="${area.isExpanded ? 'transform:rotate(90deg)' : ''}"><use href="#i-chevron-right"/></svg></button>
      </div>
      ${area.isExpanded ? renderSubAreaList(area, mIdx) : ''}
    </div>`;
}

// 詳細設定でのメインエリア自体の編集（名前・並べ替え・サブエリアが無い/時間未入力のときの直接入力）
function renderMainAreaDetail(area, mIdx) {
  const subs = area.subAreas || [];
  const noSubs = subs.length === 0;
  const allSubTimeZero = !noSubs && subs.every((s) => !s || !(s.time > 0));
  return `
    <div class="nmp-main-detail">
      <div class="nmp-main-detail-row">
        <input type="text" class="nmp-inline-name-input" value="${escHtml(displayAreaName(area.name))}" oninput="__nmpAreaNameInput(${mIdx}, this.value)">
        <button type="button" class="nmp-btn nmp-btn-outline nmp-btn-xs" ${mIdx === 0 ? 'disabled' : ''} onclick="__nmpMoveMainArea(${mIdx}, -1)">${escHtml(t('area.moveUp'))}</button>
        <button type="button" class="nmp-btn nmp-btn-outline nmp-btn-xs" ${mIdx === areas.length - 1 ? 'disabled' : ''} onclick="__nmpMoveMainArea(${mIdx}, 1)">${escHtml(t('area.moveDown'))}</button>
      </div>
      ${noSubs ? `
      <div class="nmp-main-detail-row">
        <label class="nmp-check-sm"><input type="checkbox" ${area.isSelected ? 'checked' : ''} onchange="__nmpMainSelectedToggle(${mIdx}, this.checked)"> ${escHtml(t('area.selectedLabel'))}</label>
        <span class="nmp-dim">🔥</span><input type="number" class="nmp-inline-light-input" min="0" value="${area.light || 0}" oninput="__nmpMainDirectInput(${mIdx}, 'light', this.value)">
        <span class="nmp-dim">⏱️</span><input type="number" class="nmp-inline-time-input" min="0" value="${area.time || 0}" oninput="__nmpMainDirectInput(${mIdx}, 'time', this.value)"><span class="nmp-dim">${escHtml(t('area.secLabel'))}</span>
        ${(area.time || 0) > 0 ? `<b class="nmp-eff">${((area.light || 0) / area.time).toFixed(1)}/s</b>` : ''}
      </div>` : ''}
      ${allSubTimeZero ? `
      <div class="nmp-main-detail-row">
        <span class="nmp-dim">⏱️ ${escHtml(t('area.durationLabel'))}</span><input type="number" class="nmp-inline-time-input" min="0" value="${area.time || 0}" oninput="__nmpMainDirectInput(${mIdx}, 'time', this.value)"><span class="nmp-dim">${escHtml(t('area.secLabel'))}</span>
        <span class="nmp-dim" style="color:var(--npb-blue);">${escHtml(t('area.subAreaTimeFallbackNote'))}</span>
      </div>` : ''}
    </div>`;
}

function renderSubAreaList(area, mIdx) {
  const subs = (area.subAreas || []).map((s, i) => ({ s, i })).filter(({ s }) => !areaSearchQuery.trim() || subAreaMatchesSearch(s));
  return `<div class="nmp-sub-area-list">
    ${showDetailedAreaSettings ? renderMainAreaDetail(area, mIdx) : ''}
    ${subs.map(({ s, i }) => renderSubAreaRow(area, mIdx, s, i)).join('')}
    ${showDetailedAreaSettings ? `<button type="button" class="nmp-btn nmp-btn-outline nmp-btn-sm" style="width:100%;" onclick="__nmpAddSubArea(${mIdx})">${escHtml(t('area.addSubArea'))}</button>` : ''}
    ${showDetailedAreaSettings ? `<button type="button" class="nmp-icon-btn nmp-icon-btn-danger" style="margin-top:6px;" onclick="__nmpRequestDeleteArea(${mIdx})">${escHtml(t('area.deleteArea'))}</button>` : ''}
  </div>`;
}

function renderSubAreaRow(area, mIdx, sub, sIdx) {
  const sMode = S.getSubMode(sub);
  const subStats = S.getSubAreaStats(sub);
  if (!showDetailedAreaSettings) {
    // 簡易表示: サブエリア名＋見込みのみ（チェックはできない。詳細設定で行う）
    return `<div class="nmp-sub-area-row-simple">
      <span>${escHtml(displayAreaName(sub.name))}</span>
      <span class="nmp-dim">🔥${subStats.light} ⏱️${sub.time}s</span>
    </div>`;
  }
  return `<div class="nmp-sub-area-row">
    <div class="nmp-sub-area-head">
      ${sMode === 'sub' ? `<input type="checkbox" ${sub.isSelected ? 'checked' : ''} onchange="__nmpSubSelectToggle(${mIdx}, ${sIdx})">` : `<button type="button" class="nmp-icon-btn" onclick="__nmpSubToggleExpand(${mIdx}, ${sIdx})"><svg class="inline-icon" width="11" height="11" style="${sub.isExpanded ? 'transform:rotate(90deg)' : ''}"><use href="#i-chevron-right"/></svg></button>`}
      <input type="text" class="nmp-inline-name-input" value="${escHtml(displayAreaName(sub.name))}" oninput="__nmpSubNameInput(${mIdx}, ${sIdx}, this.value)">
      ${sMode === 'sub'
        ? `<span class="nmp-dim">🔥</span><input type="number" class="nmp-inline-light-input" min="0" value="${sub.light || 0}" oninput="__nmpSubLightInput(${mIdx}, ${sIdx}, this.value)">`
        : `<span class="nmp-dim">🔥${subStats.light}</span>`}
      <input type="number" class="nmp-inline-time-input" value="${sub.time}" title="${escHtml(t('area.durationLabel'))}" oninput="__nmpSubTimeInput(${mIdx}, ${sIdx}, this.value)">
      <span class="nmp-dim">${escHtml(t('area.secLabel'))}</span>
      <button type="button" class="nmp-icon-btn nmp-icon-btn-xs" ${sIdx === 0 ? 'disabled' : ''} onclick="__nmpMoveSubArea(${mIdx}, ${sIdx}, -1)" title="${escHtml(t('area.moveUp'))}">↑</button>
      <button type="button" class="nmp-icon-btn nmp-icon-btn-xs" ${sIdx === (area.subAreas.length - 1) ? 'disabled' : ''} onclick="__nmpMoveSubArea(${mIdx}, ${sIdx}, 1)" title="${escHtml(t('area.moveDown'))}">↓</button>
      <button type="button" class="nmp-icon-btn nmp-icon-btn-danger nmp-icon-btn-xs" onclick="__nmpRequestDeleteSub(${mIdx}, ${sIdx})"><svg class="inline-icon" width="10" height="10"><use href="#i-close"/></svg></button>
    </div>
    ${sMode === 'spot' && sub.isExpanded ? renderSpotList(sub, mIdx, sIdx) : ''}
  </div>`;
}

function renderSpotList(sub, mIdx, sIdx) {
  const spots = (sub.spots || []).map((sp, i) => ({ sp, i })).filter(({ sp }) => !areaSearchQuery.trim() || matchesSearch(sp.name));
  return `<div class="nmp-spot-list">
    ${spots.map(({ sp, i }) => renderSpotRow(sp, mIdx, sIdx, i)).join('')}
    <button type="button" class="nmp-btn nmp-btn-outline nmp-btn-xs" style="width:100%;" onclick="__nmpAddSpot(${mIdx}, ${sIdx})">${escHtml(t('area.addSpot'))}</button>
  </div>`;
}

function renderSpotRow(spot, mIdx, sIdx, spIdx) {
  const isToday = S.isSpotActiveToday(spot);
  if (showTodayOnlyFilter && !isToday) return '';
  return `<div class="nmp-spot-row ${isToday ? '' : 'nmp-spot-inactive'}">
    <input type="checkbox" ${spot.isSelected ? 'checked' : ''} onchange="__nmpSpotSelectToggle(${mIdx}, ${sIdx}, ${spIdx})">
    <input type="text" class="nmp-inline-name-input" value="${escHtml(displayAreaName(spot.name))}" oninput="__nmpSpotNameInput(${mIdx}, ${sIdx}, ${spIdx}, this.value)">
    <input type="number" class="nmp-inline-light-input" value="${spot.light}" title="${escHtml(t('area.fireLabel'))}" oninput="__nmpSpotFieldInput(${mIdx}, ${sIdx}, ${spIdx}, 'light', this.value)">
    ${spot.group ? `<span class="nmp-dim nmp-group-badge">${escHtml(spot.group)}</span>` : ''}
    <button type="button" class="nmp-icon-btn nmp-icon-btn-danger nmp-icon-btn-xs" onclick="__nmpRequestDeleteSpot(${mIdx}, ${sIdx}, ${spIdx})"><svg class="inline-icon" width="9" height="9"><use href="#i-close"/></svg></button>
  </div>`;
}

/* ================================================================
   スタイルシート・アイコンスプライトの注入
   ================================================================ */
function injectStylesheet() {
  if (document.getElementById(STYLE_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_LINK_ID;
  link.rel = 'stylesheet';
  link.href = new URL('../../css/tai-nomacan-pro.css', import.meta.url).href;
  document.head.appendChild(link);
}
// tai-hub共有スプライト(js/icon-sprite.js)には無い、このツール専用のアイコンだけ
// 衝突しないプレフィックス(nmp-i-*)で追加する（中身は元のtai-nomacan.pro自身の定義そのまま）。
const NOMACAN_PRO_SPRITE_HTML = `<svg id="${ICON_SPRITE_ID}" style="position:absolute;width:0;height:0;overflow:hidden;" aria-hidden="true"><defs>
<symbol id="nmp-i-leaf" viewBox="0 0 24 24"><path d="M11 20a10 10 0 0010-10 25.9 25.9 0 00-1.04-7.281 1 1 0 00-1.755-.325C15.833 5.5 13 5.5 9.8 6.1A7 7 0 0011 20"/> <path d="M2 21a5 5 0 012.911-4.544C7.613 15.212 8.351 15.24 11 13"/></symbol>
<symbol id="nmp-i-gift" viewBox="0 0 24 24"><path d="M12 7v14"/> <path d="M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"/> <path d="M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5"/> <rect x="3" y="7" width="18" height="4" rx="1"/></symbol>
<symbol id="nmp-i-bolt" viewBox="0 0 24 24"><path d="M13 3L5 14h5l-1 7 9-12h-5Z"/></symbol>
<symbol id="nmp-i-list" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.094) translate(-12 -12)"><path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.5" cy="6.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="17.5" r="1.1" fill="currentColor" stroke="none"/></g></symbol>
</defs></svg>`;
function injectLocalIconSprite() {
  if (document.getElementById(ICON_SPRITE_ID)) return;
  document.body.insertAdjacentHTML('afterbegin', NOMACAN_PRO_SPRITE_HTML);
}

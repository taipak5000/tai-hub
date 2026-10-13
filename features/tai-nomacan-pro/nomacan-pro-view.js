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
import { initRoutes, renderRoutes, teardownRoutes } from './nomacan-pro-routes.js';

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

  window.__nmpCurrentCandlesInput = (val) => { onCurrentCandlesInput(val); };
  window.__nmpPlannedUsageInput = (val) => { plannedUsage = Math.max(0, Number(val) || 0); persist(); recomputeAndRenderTop(); };
  window.__nmpHeartsInput = (val) => { heartsToSend = Math.max(0, Number(val) || 0); persist(); recomputeAndRenderTop(); };
  window.__nmpTargetInput = (val) => { targetCandlesForOptimization = Math.max(0, Number(val) || 0); persist(); };
  window.__nmpTargetDateInput = (val) => { targetDate = val; persist(); recomputeAndRenderTop(); };
  window.__nmpCarryInput = (val) => { carryOverPercent = Math.max(0, Math.min(100, Number(val) || 0)); persist(); recomputeAndRenderTop(); };
  window.__nmpMemoInput = (val) => { candleMemo = val; persist(); };
  window.__nmpOptimizeClick = () => { doOptimize(); };
  window.__nmpResetDataClick = () => { requestResetData(); };
  window.__nmpConfirmResetData = () => { confirmResetData(); };
  window.__nmpDailyShardSelect = (val) => { dailyShard = val; persist(); recomputeAndRenderTop(); };
  window.__nmpShardSyncClick = () => { dailyShard = todayShardKey(); persist(); recomputeAndRenderTop(); };
  window.__nmpDailyBonusSelect = (val) => { dailyBonusArea = Math.max(0, Number(val) || 0); persist(); recomputeAndRenderTop(); };
  window.__nmpVisibleSectionToggle = (key, checked) => { visibleSections[key] = checked; persist(); applyVisibleSections(); };

  initRoutes(container, {
    getAreas: () => areas,
    getMyRoutes: () => myRoutes,
    onChanged: (skipTopRerender) => { persist(true); if (!skipTopRerender) recomputeAndRenderTop(); },
    displayName: displayAreaName,
    showToast,
  });

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
  recomputeAndRenderTop();
}

export function unmount() {
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
function onCurrentCandlesInput(val) {
  currentCandles = Math.max(0, Number(val) || 0);
  persist();
  S.writeOwnedCandle(currentCandles);
  recomputeAndRenderTop();
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
  S.optimize(areas, targetCandlesForOptimization > 0 ? computeTargetLightFromCandles() : 0);
  persist(true);
  renderAreaList();
  recomputeAndRenderTop();
}
function computeTargetLightFromCandles() {
  const idx = Math.max(0, Math.min(S.THRESHOLDS.length - 1, targetCandlesForOptimization - 1));
  return S.THRESHOLDS[idx] || 0;
}
function todayShardKey() {
  const p = S.shardPredictionForDate(new Date());
  return `${p.realm}:${p.color}`;
}

// 🌋 黒シャード予測の表示件数（移植元と同じく直近3回分）
const SHARD_PREDICTION_COUNT = 3;
// 移植元のSHARD_JP_WEEKDAYと同じく、表示言語に関わらず常に日本語の曜日一字を使う
// （元実装のgetBlackShardOccurrencesInJstのラベル組み立てロジックをそのまま踏襲）
const SHARD_JP_WEEKDAY = ['日', '月', '火', '水', '木', '金', '土'];
function formatShardOccurrence(occ) {
  let dayLabel;
  if (occ.dayDiff === 0) dayLabel = t('date.today');
  else if (occ.dayDiff === 1) dayLabel = t('date.tomorrow');
  else dayLabel = `${occ.month}/${occ.day}(${SHARD_JP_WEEKDAY[occ.weekday]})`;
  const timeLabel = `${occ.hour}:${String(occ.minute).padStart(2, '0')}`;
  return `${dayLabel} ${timeLabel}`;
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
          <section class="nmp-card" id="nmpSectionCandleManage" style="${visibleSections.candleManage ? '' : 'display:none;'}">
            <div class="nmp-card-header">${escHtml(t('candle.sectionHeader') || (CURRENT_LANG === 'en' ? 'Candle Management' : 'キャンドル管理'))}</div>
            <div id="nmpCandleBody"></div>
          </section>
          <section class="nmp-card" id="nmpSectionOptimization" style="${visibleSections.optimization ? '' : 'display:none;'}">
            <div class="nmp-card-header">${escHtml(t('optimize.sectionHeader'))}</div>
            <div class="nmp-row"><div>${escHtml(t('optimize.targetLabel'))}</div><input type="number" value="${targetCandlesForOptimization}" oninput="__nmpTargetInput(this.value)"></div>
            <button type="button" class="nmp-btn nmp-btn-orange" style="width:100%;" onclick="__nmpOptimizeClick()">${escHtml(t('optimize.autoSelectBtn'))}</button>
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
          <a href="https://taipak5000.github.io/tai-info/" target="_blank" rel="noopener noreferrer">${escHtml(t('footer.infoLink'))}</a>
        </span>
      </footer>
    </div>
    <div class="nmp-toast-stack" id="nmpToastStack"></div>
  </div>`;
}

/* ================================================================
   🖼️ 描画: キャンドル管理カード（繰越・見込み・黒シャード予測）
   ================================================================ */
function recomputeAndRenderTop() {
  const el = document.getElementById('nmpCandleBody');
  if (!el) return;
  let selectedLight = 0; let selectedTime = 0;
  areas.forEach((a) => { const st = S.getMainAreaStats(a); selectedLight += st.light; });
  areas.forEach((a) => { selectedTime += areaSelectedTime(a); });
  const totalLight = selectedLight + Math.round((carryOverGap * carryOverPercent) / 100) + dailyBonusArea;
  const calculated = S.calcCandlesFromLight(totalLight);
  const nextThresholdGap = calculated < S.THRESHOLDS.length ? (S.THRESHOLDS[calculated] - totalLight) : 0;
  const totalEff = selectedTime > 0 ? (selectedLight / selectedTime) : 0;
  const blackShard = S.predictUpcomingBlackShard(SHARD_PREDICTION_COUNT);

  el.innerHTML = `
    <div class="nmp-row"><div>${escHtml(t('refine.dailyBonusLabel'))}</div>
      <select onchange="__nmpDailyBonusSelect(this.value)">
        <option value="0" ${dailyBonusArea === 0 ? 'selected' : ''}>${escHtml(t('refine.dailyBonusNone'))}</option>
        <option value="50" ${dailyBonusArea === 50 ? 'selected' : ''}>${escHtml(t('refine.dailyBonus1'))}</option>
        <option value="100" ${dailyBonusArea === 100 ? 'selected' : ''}>${escHtml(t('refine.dailyBonus2'))}</option>
        <option value="150" ${dailyBonusArea === 150 ? 'selected' : ''}>${escHtml(t('refine.dailyBonus3'))}</option>
        <option value="200" ${dailyBonusArea === 200 ? 'selected' : ''}>${escHtml(t('refine.dailyBonus4'))}</option>
      </select>
    </div>
    ${blackShard ? `
    <div class="nmp-shard-box">
      <div class="nmp-shard-title"><svg class="inline-icon" width="14" height="14"><use href="#nmp-i-bolt"/></svg> ${escHtml(t('refine.shardPredictionLabel', { realm: displayAreaName(blackShard.realm) }))}</div>
      <div class="nmp-shard-times">${blackShard.occurrences.map((occ) => `<span class="nmp-shard-time-chip">${escHtml(formatShardOccurrence(occ))}</span>`).join('')}</div>
      <div class="nmp-hint" style="padding-bottom:0;">${escHtml(t('refine.receiveOnceNote'))}</div>
      <button type="button" class="nmp-btn nmp-btn-outline nmp-btn-sm" style="margin-top:8px;" onclick="__nmpShardSyncClick()">${escHtml(t('refine.syncPrediction'))}</button>
    </div>` : ''}
    <div class="nmp-stat-row"><span>${escHtml(t('refine.expectedCandles'))}</span><span><b>${calculated}</b> ${escHtml(t('refine.candlesUnit'))}</span></div>
    <div class="nmp-stat-row"><span>${escHtml(t('refine.totalLight'))}</span><span><b>${totalLight}</b></span></div>
    <div class="nmp-stat-row"><span>${escHtml(t('refine.totalEfficiency'))}</span><span><b>${totalEff.toFixed(2)}</b>/s</span></div>
    <div class="nmp-stat-row"><span>${escHtml(t('refine.totalTime'))}</span><span><b>${fmtMinSecTop(selectedTime)}</b></span></div>
    <div class="nmp-stat-row"><span>${escHtml(t('refine.nextThreshold'))}</span><span><b>${nextThresholdGap}</b></span></div>
    <button type="button" class="nmp-btn nmp-btn-blue" style="width:100%;">${escHtml(t('refine.dailyResetBtn'))}</button>

    <div class="nmp-card-subheader">${escHtml(t('candle.sectionHeader'))}</div>
    <div class="nmp-row"><div>${escHtml(t('candle.currentCandles'))}</div><input type="number" value="${currentCandles}" oninput="__nmpCurrentCandlesInput(this.value)"></div>
    <div class="nmp-hint">${escHtml(t('candle.currentCandlesSyncNote'))}</div>
    <div class="nmp-row"><div>${escHtml(t('candle.plannedUsage'))}</div><input type="number" value="${plannedUsage}" oninput="__nmpPlannedUsageInput(this.value)"></div>
    <div class="nmp-row"><div>${escHtml(t('candle.dailyHearts'))}</div><input type="number" value="${heartsToSend}" oninput="__nmpHeartsInput(this.value)"></div>
    <div class="nmp-row"><div>${escHtml(t('candle.eventEndDate'))}</div><input type="date" value="${escHtml(targetDate)}" oninput="__nmpTargetDateInput(this.value)"></div>
    <div class="nmp-row"><div>${escHtml(t('candle.remainingDays'))}</div><span>${remainingEarningDays()} ${escHtml(t('candle.remainingDaysUnit'))}</span></div>
    <div class="nmp-row"><div>${escHtml(t('candle.projectedRemaining'))}</div><span><b>${projectedRemaining(calculated, remainingEarningDays())}</b> ${escHtml(t('refine.candlesUnit'))}</span></div>
    <div class="nmp-row"><div>${escHtml(t('candle.carryOver'))}</div><input type="number" min="0" max="100" value="${carryOverPercent}" oninput="__nmpCarryInput(this.value)"></div>
    <div class="nmp-hint">${escHtml(t('candle.slideHint'))}</div>
    <div class="nmp-row" style="flex-direction:column; align-items:flex-start;">
      <div class="nmp-hint">${escHtml(t('candle.memoLabel'))}</div>
      <textarea class="nmp-memo" oninput="__nmpMemoInput(this.value)">${escHtml(candleMemo)}</textarea>
    </div>
    <button type="button" class="nmp-btn nmp-btn-outline-red" style="width:100%; margin-top:10px;" onclick="__nmpResetDataClick()">${escHtml(t('settings.resetInputBtn') || (CURRENT_LANG === 'en' ? 'Reset Entered Values' : '入力数値をリセット'))}</button>
  `;
}
function areaSelectedTime(area) { return S.getMainAreaStats(area).light > 0 ? computeAreaTime(area) : 0; }
function computeAreaTime(mainArea) {
  // getMainAreaStatsは効率(eff)しか返さないため、timeはここで同じロジックを再計算する
  let time = 0;
  const aMode = S.getAreaMode(mainArea);
  if (aMode === 'main') { if (mainArea.isSelected) time = mainArea.time || 0; } else if (Array.isArray(mainArea.subAreas)) {
    mainArea.subAreas.forEach((sub) => {
      const sMode = S.getSubMode(sub);
      if (sMode === 'sub') { if (sub.isSelected) time += sub.time || 0; } else if (Array.isArray(sub.spots)) {
        if (sub.spots.some((s) => s && s.isSelected)) time += sub.time || 0;
      }
    });
  }
  return time;
}
function fmtMinSecTop(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return CURRENT_LANG === 'en' ? `${m}m ${s}s` : `${m}分${s}秒`;
}
function remainingEarningDays() {
  if (!targetDate) return 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate); target.setHours(0, 0, 0, 0);
  if (isNaN(target.getTime())) return 0;
  return Math.max(0, Math.ceil((target - today) / 86400000));
}
// 🩹 意図的な簡略化: 元実装は日別の内訳(候補日ごとに繰越ゲージの遷移を再計算)を
// 持つ複雑な見積りだったが、ここでは「所持数＋今日の精錬予定－使用予定数」の
// 簡易見積りにしている（中核機能ではないため）。
function projectedRemaining(calculated, days) {
  return Math.max(0, currentCandles + calculated - plannedUsage);
}

/* ================================================================
   🖼️ 描画: エリア管理カード
   ================================================================ */
const AREA_ICON_MAP = {
  'ホーム': 'i-folder', '孤島': 'i-sun', '草原': 'i-leaf', '雨林': 'i-tree', '峡谷': 'i-crown',
  '捨て地': 'i-moon', '書庫': 'i-star', 'コラボルーム': 'i-gift', 'ソーシャルライト': 'i-heart', 'ランダムの火種': 'i-sparkle',
};
function areaIcon(area) { return AREA_ICON_MAP[area.name] || 'i-pin'; }

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
  const visibleAreas = areas.map((a, i) => ({ a, i })).filter(({ a }) => !hasSearch || areaMatchesSearch(a));

  el.innerHTML = `
    <div class="nmp-area-search-row">
      <input type="text" placeholder="${escHtml(t('area.searchPlaceholder'))}" value="${escHtml(areaSearchQuery)}" oninput="__nmpSearchInput(this.value)">
    </div>
    <label class="nmp-checkbox-row"><input type="checkbox" ${showTodayOnlyFilter ? 'checked' : ''} onchange="__nmpTodayFilterToggle()"> ${escHtml(t('area.todayOnlyFilterLabel') || '今日対象のみ表示')}</label>
    <div class="nmp-preset-row">
      <button type="button" class="nmp-preset-btn" onclick="__nmpPresetClick(15)">${escHtml(t('area.presetLittle'))}<br><small>15%</small></button>
      <button type="button" class="nmp-preset-btn" onclick="__nmpPresetClick(60)">${escHtml(t('area.presetSome'))}<br><small>60%</small></button>
      <button type="button" class="nmp-preset-btn" onclick="__nmpPresetClick(80)">${escHtml(t('area.presetMost'))}<br><small>80%</small></button>
      <button type="button" class="nmp-preset-btn" onclick="__nmpPresetClick(100)">${escHtml(t('area.presetAll'))}<br><small>100%</small></button>
    </div>
    <div class="nmp-hint">${escHtml(t('area.presetHint'))}</div>
    ${hasSearch && visibleAreas.length === 0 ? `<div class="nmp-empty-state">${t('area.searchNoResults', { q: areaSearchQuery })}</div>` : ''}
    <div class="nmp-area-list">
      ${visibleAreas.map(({ a, i }) => renderMainAreaRow(a, i)).join('')}
    </div>
    <button type="button" class="nmp-btn nmp-btn-blue" style="width:100%; margin-top:10px;" onclick="${myRoutesQuickCreateHandler()}">${escHtml(t('area.createRouteBtn'))}</button>
    <button type="button" class="nmp-btn nmp-btn-outline" style="width:100%; margin-top:8px;" onclick="__nmpDetailToggle()">${escHtml(showDetailedAreaSettings ? t('area.hideDetail') : t('area.showDetail'))}</button>
    <button type="button" class="nmp-btn nmp-btn-outline" style="width:100%; margin-top:8px;" onclick="__nmpAddMainArea()">${escHtml(t('area.addMainArea'))}</button>
  `;
}
function myRoutesQuickCreateHandler() {
  window.__nmpCreateRouteFromSelection = () => {
    const ids = S.buildSelectedSpotIds(areas);
    if (ids.length === 0) { showToast(t('route.noSpotSelected'), 'error'); return; }
    myRoutes.push({ id: S.uuid(), name: `${t('route.defaultNamePrefix')} ${myRoutes.length + 1}`, memo: '', selectedSpotIds: ids, isExpanded: true, actualSeconds: 0, splitTimes: {}, runHistory: [], generatedSpell: '', generatedTextExport: '' });
    persist(true);
    renderRoutes();
    showToast(t('route.createdFromSelectionHint'), 'success');
    document.getElementById('nmpRoutesBody')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return '__nmpCreateRouteFromSelection()';
}

function renderMainAreaRow(area, mIdx) {
  const total = S.getMainAreaTotalLight(area);
  const stats = S.getMainAreaStats(area);
  const pct = total > 0 ? Math.round((stats.light / total) * 100) : 0;
  const icon = areaIcon(area);
  return `
    <div class="nmp-main-area-row">
      <div class="nmp-main-area-head">
        <input type="checkbox" ${area.isSelected ? 'checked' : ''} onchange="__nmpAreaCheckToggle(${mIdx})" title="${escHtml(t('area.presetHint'))}">
        <span class="nmp-area-icon-badge"><svg class="inline-icon" width="16" height="16"><use href="#${icon}"/></svg></span>
        <span class="nmp-main-area-name" onclick="__nmpAreaToggleExpand(${mIdx})">${escHtml(displayAreaName(area.name))}</span>
        <span class="nmp-main-area-frac">${stats.light} / ${total} 🔥 ${pct}%</span>
        <button type="button" class="nmp-icon-btn" onclick="__nmpAreaToggleExpand(${mIdx})"><svg class="inline-icon" width="12" height="12" style="${area.isExpanded ? 'transform:rotate(90deg)' : ''}"><use href="#i-chevron-right"/></svg></button>
      </div>
      <input type="range" class="nmp-pct-slider" min="0" max="100" value="${pct}" aria-label="${escHtml(t('area.pctSliderAria', { name: displayAreaName(area.name) }))}"
        oninput="__nmpAreaPctInput(${mIdx}, this.value); document.getElementById('nmpPctReadout${mIdx}').textContent = this.value + '%'"
        onchange="__nmpAreaPctChange(${mIdx}, this.value)">
      <div class="nmp-pct-readout" id="nmpPctReadout${mIdx}">${pct}%</div>
      ${area.isExpanded ? renderSubAreaList(area, mIdx) : ''}
    </div>`;
}

function renderSubAreaList(area, mIdx) {
  const subs = (area.subAreas || []).map((s, i) => ({ s, i })).filter(({ s }) => !areaSearchQuery.trim() || subAreaMatchesSearch(s));
  return `<div class="nmp-sub-area-list">
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
      <span class="nmp-dim">🔥${subStats.light}</span>
      <input type="number" class="nmp-inline-time-input" value="${sub.time}" title="${escHtml(t('area.durationLabel'))}" oninput="__nmpSubTimeInput(${mIdx}, ${sIdx}, this.value)">
      <span class="nmp-dim">${escHtml(t('area.secLabel'))}</span>
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
<symbol id="nmp-i-chevron-down" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.458) translate(-12 -12)"><path d="M6 9l6 6 6-6"/></g></symbol>
<symbol id="nmp-i-bolt" viewBox="0 0 24 24"><path d="M13 3L5 14h5l-1 7 9-12h-5Z"/></symbol>
<symbol id="nmp-i-list" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.094) translate(-12 -12)"><path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.5" cy="6.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="17.5" r="1.1" fill="currentColor" stroke="none"/></g></symbol>
</defs></svg>`;
function injectLocalIconSprite() {
  if (document.getElementById(ICON_SPRITE_ID)) return;
  document.body.insertAdjacentHTML('afterbegin', NOMACAN_PRO_SPRITE_HTML);
}

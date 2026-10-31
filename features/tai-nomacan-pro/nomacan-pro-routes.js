/* ================================================================
   マイルート（RTAタイマー・呼文共有・ルートテンプレ）カードの描画。
   nomacan-pro-view.js から呼ばれる。DOM構築とイベント配線のみを持ち、
   純粋な計算はnomacan-pro-state.jsに委譲する（nomacan-history.jsと
   同じ分割方針）。
   ================================================================ */
import { CURRENT_LANG } from '../../js/i18n.js';
import { t } from './data/i18n-nomacan-pro.js';
import * as S from './nomacan-pro-state.js';
import { nsKey } from '../../js/state.js';

const TEMPLATE_SEEDED_KEY = 'skyNomacanProTemplateSeeded_v1';

let containerEl = null;
let getAreas = null; // () => areas配列（親の最新参照を都度取得）
let getMyRoutes = null; // () => myRoutes配列
let onChanged = null; // 状態が変わった時に親へ通知（save()＋親側の再描画）
let displayName = null; // (jaName) => 表示名（言語切替対応）
let showToast = null; // (msg, type) => void（親のトースト機構を共有）

let runningRouteId = null;
let runningSeconds = 0;
let timerId = null;
let startTime = 0;

export function initRoutes(container, opts) {
  containerEl = container;
  getAreas = opts.getAreas;
  getMyRoutes = opts.getMyRoutes;
  onChanged = opts.onChanged;
  displayName = opts.displayName;
  showToast = opts.showToast;

  window.__nmpRouteApply = (id) => { const r = findRoute(id); if (r) { S.applyRoute(getAreas(), r); onChanged(); } };
  window.__nmpRouteShare = (id) => { const r = findRoute(id); if (!r) return; shareRoute(r); };
  window.__nmpRouteExportText = (id) => { const r = findRoute(id); if (r) exportRouteAsText(r); };
  window.__nmpRouteDelete = (id) => { requestDeleteRoute(id); };
  window.__nmpRouteMove = (id, dir) => { moveRouteCard(id, dir); };
  window.__nmpRouteToggleExpand = (id) => { const r = findRoute(id); if (r) { r.isExpanded = !r.isExpanded; renderRoutes(); } };
  window.__nmpRouteNameInput = (id, val) => { const r = findRoute(id); if (r) { r.name = val; onChanged(true); } };
  window.__nmpRouteMemoInput = (id, val) => { const r = findRoute(id); if (r) { r.memo = val; onChanged(true); } };
  window.__nmpRouteSpotMove = (id, idx, dir) => { moveRouteSpot(id, idx, dir); };
  window.__nmpRouteSpotRemove = (id, idx) => { removeSpotFromRoute(id, idx); };
  window.__nmpRouteTimerStart = (id) => { startTimer(id); };
  window.__nmpRouteTimerPause = (id) => { pauseTimer(id); };
  window.__nmpRouteTimerReset = (id) => { resetTimer(id); };
  window.__nmpRouteLap = (id, spotId) => { recordSplit(id, spotId); };
  window.__nmpRouteHistoryClearReq = (id) => { requestClearRunHistory(id); };
  window.__nmpSpellImportInput = (val) => { spellImportValue = val; };
  window.__nmpSpellImportGo = () => { doImportSpell(); };
  window.__nmpConfirmDeleteRoute = (id) => { confirmDeleteRoute(id); };
  window.__nmpCancelDeleteRoute = () => { deletingRouteId = null; renderRoutes(); };
}

export function teardownRoutes() {
  if (timerId) { clearInterval(timerId); timerId = null; }
  runningRouteId = null;
  containerEl = null;
}

function findRoute(id) { return getMyRoutes().find((r) => r.id === id); }

let spellImportValue = '';
let deletingRouteId = null;

/* ================================================================
   マイルートカード全体の描画
   ================================================================ */
export function renderRoutes() {
  const el = document.getElementById('nmpRoutesBody');
  if (!el) return;
  const routes = getMyRoutes();
  el.innerHTML = `
    <button type="button" class="nmp-btn nmp-btn-blue nmp-btn-block" style="margin-top:0; margin-bottom:4px;" onclick="__nmpSaveCurrentRoute()">${escT(t('route.saveCurrentBtn'))}</button>
    <div class="nmp-spell-import">
      <div class="nmp-spell-import-label">${escT(t('route.importLabel'))}</div>
      <div class="nmp-spell-import-row">
        <input type="text" id="nmpSpellImportInput" placeholder="${escT(t('route.importPlaceholder'))}" value="${escT(spellImportValue)}" oninput="__nmpSpellImportInput(this.value)">
        <button type="button" class="nmp-spell-import-btn" onclick="__nmpSpellImportGo()">${escT(t('route.importBtn'))}</button>
      </div>
      <div class="nmp-spell-note">${escT(t('route.spellNoBgImageNote'))}</div>
    </div>
    ${routes.length === 0 ? `<div class="nmp-empty-state">${t('route.emptyState')}</div>` : routes.map((r) => renderRouteCard(r)).join('')}
  `;
}

function renderRouteCard(route) {
  const stats = S.getRouteStats(getAreas(), route);
  const timeStr = fmtMinSec(stats.time);
  const areaNames = S.getRouteAreaNames(getAreas(), route, displayName);
  const isRunning = runningRouteId === route.id;
  const hist = getRunHistoryStats(route);

  if (deletingRouteId === route.id) {
    return `<div class="nmp-route-card">
      <div class="nmp-confirm-inline">${t('route.deleteConfirm', { name: escapeHtml(route.name) })}</div>
      <div class="nmp-confirm-inline-actions">
        <button type="button" class="nmp-btn nmp-btn-red" onclick="__nmpConfirmDeleteRoute('${route.id}')">${escT(t('confirmModal.execute'))}</button>
        <button type="button" class="nmp-btn nmp-btn-outline" onclick="__nmpCancelDeleteRoute()">${escT(t('confirmModal.cancel'))}</button>
      </div>
    </div>`;
  }

  return `<div class="nmp-route-card">
    <div class="nmp-route-card-head">
      <input type="text" class="nmp-route-name-input" value="${escapeHtml(route.name)}" oninput="__nmpRouteNameInput('${route.id}', this.value)">
      <div class="nmp-route-card-actions">
        <button type="button" class="nmp-icon-btn" onclick="__nmpRouteMove('${route.id}', -1)" title="↑"><svg class="inline-icon" width="12" height="12" style="transform:rotate(180deg)"><use href="#i-chevron-down"/></svg></button>
        <button type="button" class="nmp-icon-btn" onclick="__nmpRouteMove('${route.id}', 1)" title="↓"><svg class="inline-icon" width="12" height="12"><use href="#i-chevron-down"/></svg></button>
        <button type="button" class="nmp-btn nmp-btn-blue nmp-btn-sm" onclick="__nmpRouteApply('${route.id}')">${escT(t('route.apply'))}</button>
        <button type="button" class="nmp-btn nmp-btn-purple nmp-btn-sm" onclick="__nmpRouteShare('${route.id}')">${escT(t('route.share'))}</button>
        <button type="button" class="nmp-btn nmp-btn-outline nmp-btn-sm" onclick="__nmpRouteExportText('${route.id}')">${escT(t('route.exportTextBtn'))}</button>
        <button type="button" class="nmp-icon-btn" onclick="__nmpRouteToggleExpand('${route.id}')"><svg class="inline-icon" width="12" height="12" style="${route.isExpanded ? 'transform:rotate(90deg)' : ''}"><use href="#i-chevron-right"/></svg></button>
        <button type="button" class="nmp-icon-btn nmp-icon-btn-danger" onclick="__nmpRouteDelete('${route.id}')"><svg class="inline-icon" width="12" height="12"><use href="#i-close"/></svg></button>
      </div>
    </div>
    ${S.isTemplateRouteName(route.name) || route.isTemplate ? templateCreditsHtml() : ''}
    <div class="nmp-route-path">${escT(t('route.via'))} <b>${areaNames ? escapeHtml(areaNames) : escT(t('route.viaNone'))}</b></div>
    ${route.generatedSpell ? `<textarea class="nmp-route-spell-out" readonly onclick="this.select()">${escapeHtml(route.generatedSpell)}</textarea>` : ''}
    ${route.generatedTextExport ? `<textarea class="nmp-route-spell-out" readonly onclick="this.select()">${escapeHtml(route.generatedTextExport)}</textarea>` : ''}
    ${route.isExpanded ? `
      <div class="nmp-route-expanded">
        <div class="nmp-timer-box">
          <div class="nmp-timer-display ${isRunning ? 'running' : ''}">${fmtSeconds(isRunning ? runningSeconds : (route.actualSeconds || 0))}</div>
          <div class="nmp-timer-actions">
            ${isRunning
              ? `<button type="button" class="nmp-btn nmp-btn-orange nmp-btn-sm" onclick="__nmpRouteTimerPause('${route.id}')">${escT(t('route.pauseBtn'))}</button>`
              : `<button type="button" class="nmp-btn nmp-btn-green nmp-btn-sm" onclick="__nmpRouteTimerStart('${route.id}')">${escT(t('route.startBtn'))}</button>`}
            <button type="button" class="nmp-btn nmp-btn-red nmp-btn-sm" onclick="__nmpRouteTimerReset('${route.id}')">${escT(t('route.resetBtn'))}</button>
          </div>
          ${hist ? `<div class="nmp-hist-stats">
            <span>${escT(t('route.historyBestLabel'))} <b>${fmtSeconds(hist.best)}</b> ／ ${escT(t('route.historyAvgLabel'))} ${fmtSeconds(hist.avg)} (${t('route.historyCountLabel', { n: hist.count })})</span>
            <span class="nmp-hist-clear" onclick="__nmpRouteHistoryClearReq('${route.id}')">${escT(t('route.historyClearBtn'))}</span>
          </div>` : ''}
        </div>
        <div class="nmp-reorder-label">${escT(t('route.reorderLabel'))}</div>
        <div class="nmp-reorder-list">
          ${route.selectedSpotIds.map((spotId, idx) => `
            <div class="nmp-reorder-row">
              <span class="nmp-reorder-name">${escapeHtml(S.getSpotNameById(getAreas(), spotId, displayName, t('area.unknownSpot')))}</span>
              <div class="nmp-reorder-actions">
                ${(route.splitTimes || {})[spotId] != null ? `<span class="nmp-split-time">${fmtSeconds(route.splitTimes[spotId])}</span>` : ''}
                ${isRunning ? `<button type="button" class="nmp-btn nmp-btn-green nmp-btn-xs" onclick="__nmpRouteLap('${route.id}', '${spotId}')">${escT(t('route.lapBtn'))}</button>` : ''}
                <button type="button" class="nmp-icon-btn nmp-icon-btn-xs" ${idx === 0 ? 'disabled' : ''} onclick="__nmpRouteSpotMove('${route.id}', ${idx}, -1)"><svg class="inline-icon" width="10" height="10" style="transform:rotate(180deg)"><use href="#i-chevron-down"/></svg></button>
                <button type="button" class="nmp-icon-btn nmp-icon-btn-xs" ${idx === route.selectedSpotIds.length - 1 ? 'disabled' : ''} onclick="__nmpRouteSpotMove('${route.id}', ${idx}, 1)"><svg class="inline-icon" width="10" height="10"><use href="#i-chevron-down"/></svg></button>
                <button type="button" class="nmp-icon-btn nmp-icon-btn-xs nmp-icon-btn-danger" onclick="__nmpRouteSpotRemove('${route.id}', ${idx})"><svg class="inline-icon" width="10" height="10"><use href="#i-close"/></svg></button>
              </div>
            </div>`).join('')}
        </div>
        <textarea class="nmp-route-memo" placeholder="${escT(t('route.memoPlaceholder'))}" oninput="__nmpRouteMemoInput('${route.id}', this.value)">${escapeHtml(route.memo || '')}</textarea>
        <div class="nmp-route-summary">
          <div class="nmp-route-summary-row"><span>${escT(t('route.idealTotal'))}</span><span>🔥${stats.light} / ⏱️${timeStr} / ${escT(t('route.efficiency'))} <b>${stats.eff.toFixed(1)}/s</b></span></div>
        </div>
      </div>` : ''}
  </div>`;
}

/* ================================================================
   ルート操作
   ================================================================ */
function moveRouteCard(id, dir) {
  const routes = getMyRoutes();
  const idx = routes.findIndex((r) => r.id === id);
  const target = idx + dir;
  if (idx === -1 || target < 0 || target >= routes.length) return;
  const [item] = routes.splice(idx, 1);
  routes.splice(target, 0, item);
  onChanged(true);
  renderRoutes();
}
function moveRouteSpot(id, idx, dir) {
  const r = findRoute(id);
  if (!r) return;
  const target = idx + dir;
  if (target < 0 || target >= r.selectedSpotIds.length) return;
  const [item] = r.selectedSpotIds.splice(idx, 1);
  r.selectedSpotIds.splice(target, 0, item);
  onChanged(true);
  renderRoutes();
}
function removeSpotFromRoute(id, idx) {
  const r = findRoute(id);
  if (!r) return;
  r.selectedSpotIds.splice(idx, 1);
  onChanged(true);
  renderRoutes();
}
function requestDeleteRoute(id) { deletingRouteId = id; renderRoutes(); }
function confirmDeleteRoute(id) {
  const routes = getMyRoutes();
  const idx = routes.findIndex((r) => r.id === id);
  if (idx !== -1) routes.splice(idx, 1);
  deletingRouteId = null;
  if (runningRouteId === id) { if (timerId) clearInterval(timerId); timerId = null; runningRouteId = null; }
  onChanged(true);
  renderRoutes();
}

function shareRoute(route) {
  try {
    route.generatedSpell = S.generateRouteSpell(getAreas(), route);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(route.generatedSpell).then(() => showToast(t('route.shareCopiedHint'), 'success')).catch(() => showToast(t('route.shareCopyFailedHint'), 'error'));
    }
    onChanged(true);
    renderRoutes();
  } catch (e) { showToast(t('route.spellGenFailed'), 'error'); }
}
function exportRouteAsText(route) {
  const stats = S.getRouteStats(getAreas(), route);
  const lines = [];
  lines.push(route.name || '');
  if (route.memo) lines.push(route.memo);
  lines.push('');
  route.selectedSpotIds.forEach((id, idx) => {
    lines.push(`${idx + 1}. ${S.getSpotNameById(getAreas(), id, displayName, t('area.unknownSpot'))}`);
  });
  lines.push('──────────');
  lines.push(`${t('route.exportTotalLabel')} 🔥${stats.light} ／ ⏱️${fmtMinSec(stats.time)} ／ ⚡${stats.eff.toFixed(1)}/s`);
  route.generatedTextExport = lines.join('\n');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(route.generatedTextExport).then(() => showToast(t('route.exportCopiedHint'), 'success')).catch(() => showToast(t('route.shareCopyFailedHint'), 'error'));
  }
  onChanged(true);
  renderRoutes();
}
function doImportSpell() {
  if (!spellImportValue.trim()) return;
  try {
    const route = S.applyRouteSpell(getAreas(), spellImportValue, t('route.importedNamePrefix'));
    getMyRoutes().push(route);
    spellImportValue = '';
    showToast(t('route.spellImportSuccess'), 'success');
    onChanged(true);
    renderRoutes();
  } catch (e) { showToast(t('route.spellInvalid'), 'error'); }
}
// 「20本ルート（ソロ・試練無し）」を、プロフィールごとに最初の1回だけマイルートへ入れておく。
// 利用者が消した後に勝手に戻らないよう、入れたことを覚えておく（既に入っている人は名前だけ新しいものに揃える）
export function seedTemplateRoute() {
  const routes = getMyRoutes();
  const existing = routes.find((r) => r.isTemplate || S.isTemplateRouteName(r.name));
  let seeded = false;
  try { seeded = localStorage.getItem(nsKey(TEMPLATE_SEEDED_KEY)) === '1'; } catch (e) { /* 読めなければ未登録扱い */ }
  if (existing) {
    existing.isTemplate = true;
    if (S.isTemplateRouteName(existing.name)) existing.name = S.FAMOUS_ROUTE_TEMPLATE.routeName;
    S.ensureTemplateArea(getAreas()); // エリア側の名前も揃える
  } else if (!seeded) {
    const templateArea = S.ensureTemplateArea(getAreas());
    const selectedIds = [];
    templateArea.subAreas.forEach((sub) => sub.spots.forEach((s) => selectedIds.push(s.id)));
    routes.unshift({
      id: S.uuid(), name: S.FAMOUS_ROUTE_TEMPLATE.routeName, memo: S.FAMOUS_ROUTE_TEMPLATE.memo, isTemplate: true,
      selectedSpotIds: selectedIds, isExpanded: false, actualSeconds: 0, splitTimes: {}, runHistory: [],
      generatedSpell: '', generatedTextExport: '',
    });
  } else {
    return;
  }
  try { localStorage.setItem(nsKey(TEMPLATE_SEEDED_KEY), '1'); } catch (e) { /* 次回また試みる */ }
  onChanged(true);
}

// テンプレートルートのカードに出す、参考元（ツイート・動画・作成者）へのリンク
function templateCreditsHtml() {
  const ICON = { tweet: 'i-link', video: 'i-monitor', author: 'i-person' };
  const links = S.TEMPLATE_ROUTE_CREDITS.map((c) => `
      <a class="nmp-credit-link" href="${escapeHtml(c.url)}" target="_blank" rel="noopener noreferrer">
        <svg class="inline-icon" width="14" height="14"><use href="#${ICON[c.kind]}"/></svg>
        <span>${escapeHtml(CURRENT_LANG === 'en' ? c.en : c.ja)}</span>
        <svg class="inline-icon nmp-credit-arrow" width="12" height="12"><use href="#i-chevron-right"/></svg>
      </a>`).join('');
  return `<div class="nmp-route-credits">
    <div class="nmp-route-credits-title">${escapeHtml(CURRENT_LANG === 'en' ? 'Route credits' : 'このルートの参考元')}</div>
    <div class="nmp-route-credits-links">${links}</div>
  </div>`;
}

/* ================================================================
   ⏱️ RTAタイマー（区間タイム・実行履歴）
   ================================================================ */
function startTimer(id) {
  const r = findRoute(id);
  if (!r) return;
  if (runningRouteId && runningRouteId !== id) pauseTimer(runningRouteId, true);
  runningRouteId = id;
  runningSeconds = r.actualSeconds || 0;
  startTime = Date.now() - runningSeconds * 1000;
  if (timerId) clearInterval(timerId);
  timerId = setInterval(() => {
    runningSeconds = (Date.now() - startTime) / 1000;
    const disp = document.querySelector(`.nmp-route-card .nmp-timer-display.running`);
    if (disp) disp.textContent = fmtSeconds(runningSeconds);
  }, 100);
  renderRoutes();
}
function pauseTimer(id, silent) {
  const r = findRoute(id);
  if (timerId) { clearInterval(timerId); timerId = null; }
  if (r && runningRouteId === id) {
    r.actualSeconds = runningSeconds;
    r.runHistory = Array.isArray(r.runHistory) ? r.runHistory : [];
    r.runHistory.push({ seconds: runningSeconds, time: Date.now() });
    if (r.runHistory.length > 20) r.runHistory = r.runHistory.slice(-20);
  }
  runningRouteId = null;
  onChanged(true);
  if (!silent) renderRoutes();
}
function resetTimer(id) {
  const r = findRoute(id);
  if (!r) return;
  if (runningRouteId === id) { if (timerId) clearInterval(timerId); timerId = null; runningRouteId = null; }
  r.actualSeconds = 0;
  r.splitTimes = {};
  onChanged(true);
  renderRoutes();
}
function recordSplit(id, spotId) {
  const r = findRoute(id);
  if (!r || runningRouteId !== id) return;
  r.splitTimes = r.splitTimes || {};
  r.splitTimes[spotId] = runningSeconds;
  onChanged(true);
  renderRoutes();
}
function getRunHistoryStats(route) {
  const hist = route.runHistory;
  if (!Array.isArray(hist) || hist.length === 0) return null;
  const seconds = hist.map((h) => h.seconds);
  const best = Math.min(...seconds);
  const avg = seconds.reduce((a, b) => a + b, 0) / seconds.length;
  return { count: hist.length, best, avg };
}
function requestClearRunHistory(id) {
  const r = findRoute(id);
  if (!r) return;
  r.runHistory = [];
  onChanged(true);
  renderRoutes();
}

/* ================================================================
   ユーティリティ
   ================================================================ */
function fmtSeconds(s) {
  s = Math.max(0, s || 0);
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(3);
  return `${String(m).padStart(2, '0')}:${sec.padStart(6, '0')}`;
}
function fmtMinSec(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return CURRENT_LANG === 'en' ? `${m}m ${s}s` : `${m}分${s}秒`;
}
function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escT(str) { return escapeHtml(str); }

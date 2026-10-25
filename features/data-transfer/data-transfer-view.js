/* ================================================================
   data-transfer-view.js — データ引継ぎ（メイン画面）

   移植元: C:\Users\user\Downloads\skyツール\tai-transfer\index.html
   （~2893行のスタンドアロンページ）のうち、nav/サイドバー（他のツール
   ドロワー）/site-dock/表示設定モーダル/キーボードショートカット/
   フォーカストラップ/ボトムシートのドラッグ物理演算——といった
   「共有chrome」は、tai-hub側に同等のものが既にあるため移植していない
   （js/chrome/tools-drawer.js・js/chrome/settings-modal.js・
   js/shortcuts.js・js/icon-sprite.js）。このビュー自身が持つのは
   エクスポート（サイト選択→コード作成→ダウンロード/コピー/リンク/QR）・
   インポート（貼り付け/ファイル→検出→上書き確認→復元）・書き出し/
   読込履歴ログの3機能で、いずれも元実装と同じ見た目・同じ挙動のまま
   移植している。

   localStorageの読み書き・純粋な計算（SITE_CATALOG・キー照合・
   プロフィールマージ・スナップショット・コードの圧縮/展開・内容差分の
   集計）は data-transfer-state.js に分離している（詳細はそちらの
   冒頭コメント参照——キー名・データ形状の互換性維持がこのツールの
   存在意義そのもの）。

   【意図的な簡略化・アダプテーション（元の挙動を変えない範囲の adaptation）】
   - 元実装は「#code=...」というURLフラグメントでコードを共有していたが、
     tai-hubは#/以降をルーター（js/router.js）が丸ごと管理しているため、
     「リンクとしてコピー」は `#/data-transfer/<encodeURIComponentしたコード>`
     という1セグメントのサブルートに置き換えた（ルーター側は`/`区切りの
     最初の2セグメントしか見ないが、コード自体をencodeURIComponent済みの
     まま埋め込むため内部の'/'は%2Fにエスケープされ、経路のsplit('/')に
     干渉しない）。mount(container, sub) はsubが渡された場合、それを
     引き継ぎコードとして自動でインポート欄に読み込む＝元のURLフラグメント
     自動読み込みと同じ体験を、tai-hubのルーティング方式に合わせて再実装
     したもの（挙動そのものは同一）。
   - 元実装は言語切替時（setLang()）に各セクションをその場で再描画して
     いたが、tai-hubのsetLang()はページ全体をリロードする設計（他の
     移植済みツールと同じ、非リアクティブなi18n）のため、この再描画分岐は
     移植していない。
   - 表示設定モーダル・「他のツール」ドロワー・ヘッダーの言語切替ボタン・
     ダークモード切替・キーボードショートカット設定は、tai-hubの共有chrome
     に同等の機能が既にあるため移植していない（フッターの免責事項・
     クレジット行・tai-infoリンクは、他の移植済みツール［companion/
     tai-score/tai-revisit等］と同じくこのビュー内に直書きしている——
     tai-hubの共有chromeにはフッターを描画する仕組み自体が存在しない）。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { pfDisplayName } from '../../js/state.js';
import { t } from './data/i18n-data-transfer.js';
import * as S from './data-transfer-state.js';

function tt(ja, en) { return CURRENT_LANG === 'en' ? en : ja; }
const JOINER = CURRENT_LANG === 'en' ? ', ' : '、';

const STYLE_LINK_ID = 'data-transfer-view-styles';
const ICON_SPRITE_ID = 'data-transfer-icon-sprite';

let containerEl = null;
let els = {};

// エクスポート側の状態
let transferHistoryOpen = false;
let exportProfileFilters = {};
let lastExportCode = null;
let lastExportResult = null; // { selectedIds, keyCount, codeLength, compressRate, siteUpdatedAt }
let exportTextareaOpen = false;
let exportQrOpen = false;
let exportLinkOpen = false;
let qrLibLoading = null;

// インポート側の状態
let pendingImportData = null;
let pendingImportSiteUpdatedAt = null;
let lastImportDetected = null;
let lastImportDataKeys = null;
let lastImportOverwriteInfo = null;
let importOverwriteConfirming = false;
let importProfileFilters = {};

/* ================================================================
   公開API
   ================================================================ */
export function mount(container, sub) {
  injectStylesheet();
  injectLocalIconSprite();
  resetModuleState();

  containerEl = container;
  container.innerHTML = renderShell();
  cacheEls();
  wireEvents();

  S.refreshSiteSnapshots();
  renderExportSiteList();
  renderTransferHistory();

  if (sub) loadCodeFromSub(sub);
}

export function unmount() {
  // container-scoped リスナー（wireEvents内）はrouterがinnerHTML=''でDOMごと
  // 破棄するため個別removeは不要。document/window直付けのリスナーは持たない。
  containerEl = null;
  els = {};
}

function resetModuleState() {
  transferHistoryOpen = false;
  exportProfileFilters = {};
  lastExportCode = null;
  lastExportResult = null;
  exportTextareaOpen = false;
  exportQrOpen = false;
  exportLinkOpen = false;
  pendingImportData = null;
  pendingImportSiteUpdatedAt = null;
  lastImportDetected = null;
  lastImportDataKeys = null;
  lastImportOverwriteInfo = null;
  importOverwriteConfirming = false;
  importProfileFilters = {};
}

/* ================================================================
   スタイルシート・追加アイコンスプライトの注入（初回のみ）
   ================================================================ */
function injectStylesheet() {
  if (document.getElementById(STYLE_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_LINK_ID;
  link.rel = 'stylesheet';
  link.href = new URL('../../css/data-transfer.css', import.meta.url).href;
  document.head.appendChild(link);
}
// 共有スプライト（js/icon-sprite.js）に無い i-download だけを、衝突しない専用
// プレフィックス（dt-i-*）で追加する（共有ファイル自体は編集しない）。
const DT_SPRITE_HTML = `<svg id="${ICON_SPRITE_ID}" style="position:absolute;width:0;height:0;overflow:hidden;" aria-hidden="true"><defs>
<symbol id="dt-i-download" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.094) translate(-12 -12)"><path d="M12 4v11M8 11l4 4 4-4"/><path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6"/></g></symbol>
</defs></svg>`;
function injectLocalIconSprite() {
  if (document.getElementById(ICON_SPRITE_ID)) return;
  document.body.insertAdjacentHTML('afterbegin', DT_SPRITE_HTML);
}

/* ================================================================
   マークアップ（外枠）
   ================================================================ */
function renderShell() {
  return `
    <div class="data-transfer-view">
      <div class="dt-wrap">
        <header class="tool-nav-head">
          <h1><svg class="inline-icon" width="17" height="17"><use href="#i-sync"/></svg> ${escapeHtml(tt('データ引継ぎ', 'Data Transfer'))}</h1>
        </header>

        <p class="sec-label" id="dtExportSection">${escapeHtml(t('page.sectionExport'))}</p>
        <div class="card">
          <div class="hint">${t('page.exportHint')}</div>
          <button type="button" class="list-select-btn" id="dtHistoryToggleBtn" data-act="toggle-history" style="display:none; margin-bottom:10px;"></button>
          <div id="dtHistoryArea"></div>
          <div class="list-select-row">
            <button type="button" class="list-select-btn" data-act="select-all-export">${escapeHtml(t('page.selectAllBtn'))}</button>
            <button type="button" class="list-select-btn" data-act="select-none-export">${escapeHtml(t('page.selectNoneBtn'))}</button>
            <button type="button" class="list-select-btn" data-act="select-data-export">${escapeHtml(t('page.selectWithDataBtn'))}</button>
          </div>
          <div id="dtExportSiteList"></div>
          <button type="button" class="action-btn primary" data-act="create-code">${escapeHtml(t('page.createCodeBtn'))}</button>
          <div id="dtExportOutputArea"></div>
          <div id="dtExportStatus" class="status-msg"></div>
        </div>

        <p class="sec-label" id="dtImportSection">${escapeHtml(t('page.sectionImport'))}</p>
        <div class="card">
          <div class="hint">${t('page.importHint')}</div>
          <input type="file" id="dtImportFileInput" accept=".txt,.json">
          <div class="hint" style="margin:10px 0 6px;">${escapeHtml(t('page.pasteHint'))}</div>
          <textarea id="dtImportCodeInput" class="code-textarea" placeholder="${escapeHtml(t('page.pastePlaceholder'))}"></textarea>
          <button type="button" class="action-btn secondary" data-act="load-code">${escapeHtml(t('page.loadCodeBtn'))}</button>
          <div id="dtImportSiteArea"></div>
          <div id="dtImportConfirmArea"></div>
          <div id="dtImportStatus" class="status-msg"></div>
        </div>

        <footer>
          <span>${escapeHtml(tt('このサイトはSky 星を紡ぐ子どもたちの非公式ファンサイトです。thatgamecompanyは一切関与していません。', 'This is an unofficial fan site for Sky: Children of the Light. thatgamecompany is not involved in any way.'))}</span><br>
          <span>${escapeHtml(t('footer.creditLabel'))}</span> <a href="https://x.com/Skyzztai" target="_blank" rel="noopener noreferrer">@Skyzztai</a>　／
          <a href="https://odaibako.net/u/Skyzztai" target="_blank" rel="noopener noreferrer">${escapeHtml(t('footer.requestForm'))}</a><br>
          <a href="#/tai-info">${escapeHtml(t('footer.infoLink'))}</a>
        </footer>
      </div>
    </div>
  `;
}

function cacheEls() {
  const q = (id) => containerEl.querySelector('#' + id);
  els = {
    historyToggleBtn: q('dtHistoryToggleBtn'),
    historyArea: q('dtHistoryArea'),
    exportSiteList: q('dtExportSiteList'),
    exportOutputArea: q('dtExportOutputArea'),
    exportStatus: q('dtExportStatus'),
    importSection: q('dtImportSection'),
    importFileInput: q('dtImportFileInput'),
    importCodeInput: q('dtImportCodeInput'),
    importSiteArea: q('dtImportSiteArea'),
    importConfirmArea: q('dtImportConfirmArea'),
    importStatus: q('dtImportStatus'),
  };
}

/* ================================================================
   イベント配線（コンテナへの委譲。個別onclick文字列は使わない）
   ================================================================ */
function wireEvents() {
  containerEl.addEventListener('click', onContainerClick);
  containerEl.addEventListener('change', onContainerChange);
  els.importFileInput.addEventListener('change', handleImportFile);
}

function onContainerClick(ev) {
  const btn = ev.target.closest('[data-act]');
  if (!btn) return;
  switch (btn.dataset.act) {
    case 'toggle-history': transferHistoryOpen = !transferHistoryOpen; renderTransferHistory(); break;
    case 'select-all-export': setAllCheckboxes(els.exportSiteList, '.site-checkbox', true); break;
    case 'select-none-export': setAllCheckboxes(els.exportSiteList, '.site-checkbox', false); break;
    case 'select-data-export': selectSitesWithDataOnly(els.exportSiteList); break;
    case 'create-code': generateExportCode(); break;
    case 'download-file': downloadExportFile(); break;
    case 'toggle-show-code': toggleExportTextarea(); break;
    case 'copy-code': copyExportCode(); break;
    case 'toggle-show-link': toggleExportLink(); break;
    case 'copy-link': copyExportLinkCode(); break;
    case 'toggle-show-qr': toggleExportQr(); break;
    case 'load-code': loadCodeForImport(); break;
    case 'select-all-import': setAllCheckboxes(els.importSiteArea, '.import-site-checkbox', true); renderImportConfirmArea(); break;
    case 'select-none-import': setAllCheckboxes(els.importSiteArea, '.import-site-checkbox', false); renderImportConfirmArea(); break;
    case 'import-restore-clicked': importRestoreClicked(); break;
    case 'confirm-import': confirmImport(); break;
    case 'cancel-overwrite': importCancelOverwriteConfirm(); break;
    default: break;
  }
}

function onContainerChange(ev) {
  const target = ev.target;
  if (target.matches && target.matches('.site-profile-filter[data-scope="export"]')) {
    onExportProfileFilterChange(target.dataset.site, target.value);
    return;
  }
  if (target.matches && target.matches('.site-profile-filter[data-scope="import"]')) {
    onImportProfileFilterChange(target.dataset.site, target.value);
    return;
  }
  if (target.matches && target.matches('.import-site-checkbox')) {
    renderImportConfirmArea();
  }
}

function setAllCheckboxes(scopeEl, selector, checked) {
  scopeEl.querySelectorAll(selector).forEach((cb) => { cb.checked = checked; });
}
function selectSitesWithDataOnly(scopeEl) {
  scopeEl.querySelectorAll('label.site-opt').forEach((label) => {
    const cb = label.querySelector('input[type="checkbox"]');
    if (cb) cb.checked = !label.classList.contains('no-data');
  });
}

/* ================================================================
   🔢 数字と単位のコントラスト表示（t('dyn.keysCount',{n})が返す「42件」
   「42 keys」を、先頭の数字部分と続く単位部分に分割してspanで包む）
   ================================================================ */
function numUnitHtml(str) {
  const s = String(str);
  const m = s.match(/^(-?[\d,]+(?:\.\d+)?)(.*)$/s);
  if (!m) return escapeHtml(s);
  return `<span class="num-strong">${escapeHtml(m[1])}</span><span class="num-unit">${escapeHtml(m[2])}</span>`;
}

/* ================================================================
   🕒 書き出し/読込履歴ログ
   ================================================================ */
function renderTransferHistory() {
  const toggleBtn = els.historyToggleBtn;
  const areaEl = els.historyArea;
  if (!toggleBtn || !areaEl) return;
  const history = S.loadTransferHistory();
  toggleBtn.style.display = history.length > 0 ? '' : 'none';
  toggleBtn.textContent = transferHistoryOpen ? t('dyn.hideHistoryBtn') : t('dyn.showHistoryBtn');
  if (!transferHistoryOpen || history.length === 0) { areaEl.innerHTML = ''; return; }

  areaEl.innerHTML = '<div class="transfer-history-list">' + history.map((entry) => {
    const icon = entry.type === 'export'
      ? '<svg class="inline-icon" width="14" height="14"><use href="#i-upload"/></svg>'
      : '<svg class="inline-icon" width="14" height="14"><use href="#dt-i-download"/></svg>';
    const dateLabel = S.siteUpdatedAtLabel(entry.at);
    const siteNames = (entry.siteIds || []).map((id) => {
      const site = S.SITE_CATALOG.find((s) => s.id === id);
      return site ? S.siteLabel(site) : id;
    });
    let sitesText = siteNames.join(JOINER);
    if (entry.hiddenCount > 0) {
      const hiddenNote = t('dyn.historyHiddenNote', { n: entry.hiddenCount });
      sitesText = sitesText ? sitesText + JOINER + hiddenNote : hiddenNote;
    }
    if (!sitesText) sitesText = t('dyn.historyNoSites');
    const rowLabelKey = entry.type === 'export' ? 'dyn.historyExportRowLabel' : 'dyn.historyImportRowLabel';
    const ariaLabel = t(rowLabelKey, { date: dateLabel, sites: sitesText });
    return `<div class="transfer-history-row" aria-label="${escapeHtml(ariaLabel)}">
      <span class="transfer-history-icon" aria-hidden="true">${icon}</span>
      <span class="transfer-history-date">${escapeHtml(dateLabel)}</span>
      <span class="transfer-history-sites">${escapeHtml(sitesText)}</span>
    </div>`;
  }).join('') + '</div>';
}

/* ================================================================
   📤 エクスポート（サイト選択 → コード作成）
   ================================================================ */
function renderExportSiteList() {
  const allKeys = S.getAllLocalStorageKeys();
  const profiles = S.getLocalProfilesList();
  const savedSelection = S.getLastExportSelection();
  const lastExportAt = S.getLastExportAt();
  const snapshots = S.refreshSiteSnapshots();
  els.exportSiteList.innerHTML = S.SITE_CATALOG.filter((site) => !site.hidden).map((site) => {
    const matched = S.matchKeysForSite(site, allKeys);
    const hasData = matched.length > 0;
    const defaultChecked = savedSelection ? savedSelection.includes(site.id) : hasData;
    const changedSinceBackup = !!(hasData && lastExportAt && snapshots[site.id] && snapshots[site.id].updatedAt > lastExportAt);
    const showProfileFilter = site.namespaced && profiles.length > 1;
    const filterVal = showProfileFilter ? (exportProfileFilters[site.id] || 'all') : 'all';
    const filteredMatched = filterVal === 'all' ? matched : S.matchKeysForSiteProfile(site, allKeys, filterVal);
    const rowHtml = `
      <label class="site-opt ${hasData ? '' : 'no-data'} ${showProfileFilter ? 'has-profile-filter' : ''}" data-site="${site.id}">
        <input type="checkbox" class="site-checkbox" data-site="${site.id}" ${defaultChecked ? 'checked' : ''}>
        <span class="site-opt-label">${escapeHtml(S.siteLabel(site))}</span>
        <span class="site-opt-changed-badge ${changedSinceBackup ? 'show' : ''}" role="img"
          aria-label="${escapeHtml(t('dyn.changedSinceBackupTitle'))}" title="${escapeHtml(t('dyn.changedSinceBackupTitle'))}"><svg class="inline-icon" width="13" height="13"><use href="#i-sync"/></svg></span>
        <span class="site-opt-count">${numUnitHtml(t('dyn.keysCount', { n: filteredMatched.length }))}</span>
      </label>`;
    const profileRowHtml = showProfileFilter ? `
      <div class="site-opt-profile-row">
        <span aria-hidden="true"><svg class="inline-icon" width="14" height="14"><use href="#i-person"/></svg></span>
        <select class="site-profile-filter" data-site="${site.id}" data-scope="export"
          aria-label="${escapeHtml(t('page.profileFilterAriaLabel', { site: S.siteLabel(site) }))}">
          <option value="all" ${filterVal === 'all' ? 'selected' : ''}>${escapeHtml(t('page.allProfilesOption'))} (${t('dyn.keysCount', { n: matched.length })})</option>
          ${profiles.map((p) => {
            const cnt = S.matchKeysForSiteProfile(site, allKeys, p.id).length;
            return `<option value="${escapeHtml(p.id)}" ${filterVal === p.id ? 'selected' : ''}>${escapeHtml(pfDisplayName(p))} (${t('dyn.keysCount', { n: cnt })})</option>`;
          }).join('')}
        </select>
      </div>` : '';
    return rowHtml + profileRowHtml;
  }).join('');
}

function onExportProfileFilterChange(siteId, value) {
  exportProfileFilters[siteId] = value;
  const site = S.SITE_CATALOG.find((s) => s.id === siteId);
  if (!site) return;
  const allKeys = S.getAllLocalStorageKeys();
  const filtered = S.matchKeysForSiteProfile(site, allKeys, value);
  const countEl = els.exportSiteList.querySelector(`label.site-opt[data-site="${siteId}"] .site-opt-count`);
  if (countEl) countEl.innerHTML = numUnitHtml(t('dyn.keysCount', { n: filtered.length }));
}

function updateExportChangedBadges() {
  const allKeys = S.getAllLocalStorageKeys();
  const lastExportAt = S.getLastExportAt();
  const snapshots = S.refreshSiteSnapshots();
  S.SITE_CATALOG.filter((site) => !site.hidden).forEach((site) => {
    const hasData = S.matchKeysForSite(site, allKeys).length > 0;
    const changedSinceBackup = !!(hasData && lastExportAt && snapshots[site.id] && snapshots[site.id].updatedAt > lastExportAt);
    const badgeEl = els.exportSiteList.querySelector(`label.site-opt[data-site="${site.id}"] .site-opt-changed-badge`);
    if (badgeEl) badgeEl.classList.toggle('show', changedSinceBackup);
  });
}

function resetExportOutput() {
  lastExportCode = null;
  lastExportResult = null;
  exportTextareaOpen = false;
  exportQrOpen = false;
  exportLinkOpen = false;
  if (els.exportOutputArea) els.exportOutputArea.innerHTML = '';
}

async function generateExportCode() {
  const statusEl = els.exportStatus;
  statusEl.className = 'status-msg';
  statusEl.textContent = t('dyn.creatingCode');
  resetExportOutput();

  const allKeys = S.getAllLocalStorageKeys();
  const selectedIds = [...els.exportSiteList.querySelectorAll('.site-checkbox:checked')].map((el) => el.dataset.site);
  const hiddenExportSites = S.SITE_CATALOG.filter((s) => s.hidden).filter((site) => S.matchKeysForSite(site, allKeys).length > 0);
  if (selectedIds.length === 0 && hiddenExportSites.length === 0) {
    statusEl.className = 'status-msg err';
    statusEl.textContent = t('dyn.selectAtLeastOneSite');
    return;
  }

  const dump = {};
  S.PROFILE_REGISTRY_KEYS.forEach((k) => {
    const v = localStorage.getItem(k);
    if (v !== null) dump[k] = v;
  });
  const profilesNow = S.getLocalProfilesList();
  selectedIds.forEach((id) => {
    const site = S.SITE_CATALOG.find((s) => s.id === id);
    const requestedFilter = exportProfileFilters[id];
    const validFilter = (requestedFilter && requestedFilter !== 'all' && profilesNow.some((p) => p.id === requestedFilter))
      ? requestedFilter : 'all';
    S.matchKeysForSiteProfile(site, allKeys, validFilter).forEach((k) => { dump[k] = localStorage.getItem(k); });
  });
  S.SITE_CATALOG.filter((s) => s.hidden).forEach((site) => {
    S.matchKeysForSite(site, allKeys).forEach((k) => { dump[k] = localStorage.getItem(k); });
  });

  const snapshotsAtExport = S.refreshSiteSnapshots();
  const siteUpdatedAt = {};
  selectedIds.concat(S.SITE_CATALOG.filter((s) => s.hidden).map((s) => s.id)).forEach((id) => {
    if (snapshotsAtExport[id]) siteUpdatedAt[id] = snapshotsAtExport[id].updatedAt;
  });

  const payload = {
    exportedFrom: 'taipak5000.github.io/tai-hub (data-transfer)',
    exportedAt: new Date().toISOString(),
    sites: selectedIds,
    siteUpdatedAt,
    data: dump,
  };
  const json = JSON.stringify(payload);
  let code;
  let compressRate;
  try {
    const uncompressedLen = S.bytesToBase64Length(json);
    code = await S.encodeTransferCode(json);
    compressRate = uncompressedLen > 0 ? Math.max(0, Math.round((1 - code.length / uncompressedLen) * 100)) : 0;
  } catch (e) {
    statusEl.className = 'status-msg err';
    statusEl.textContent = t('dyn.codeGenFailed');
    return;
  }
  lastExportCode = code;
  lastExportResult = { selectedIds, keyCount: Object.keys(dump).length, codeLength: code.length, compressRate, siteUpdatedAt };

  S.recordLastExportAt();
  S.recordTransferHistoryEntry('export', selectedIds, hiddenExportSites.length);
  renderTransferHistory();
  S.saveLastExportSelection(selectedIds);
  updateExportChangedBadges();

  renderExportOutput();
  statusEl.className = 'status-msg';
  statusEl.textContent = '';
}

function renderExportOutput() {
  const outputEl = els.exportOutputArea;
  if (!lastExportResult) { outputEl.innerHTML = ''; return; }
  const { selectedIds, keyCount, codeLength, compressRate } = lastExportResult;
  const compressNote = compressRate > 0 ? t('dyn.compressNote', { rate: compressRate }) : '';
  const summary = selectedIds.length === 0
    ? t('dyn.hiddenOnlyExportSummary', { count: keyCount, length: codeLength.toLocaleString(), compressNote })
    : t('dyn.exportSummary', {
      sites: escapeHtml(selectedIds.map((id) => {
        const site = S.SITE_CATALOG.find((s) => s.id === id);
        return site ? S.siteLabel(site) : id;
      }).join(JOINER)),
      count: keyCount, length: codeLength.toLocaleString(), compressNote,
    });
  const qrFeasible = codeLength <= S.QR_MAX_BYTES;
  const updatedRows = selectedIds
    .map((id) => {
      const site = S.SITE_CATALOG.find((s) => s.id === id);
      const iso = lastExportResult.siteUpdatedAt && lastExportResult.siteUpdatedAt[id];
      return iso ? `<div class="site-updated-row"><span class="site-updated-name">${escapeHtml(site ? S.siteLabel(site) : id)}</span><span class="site-updated-date">${escapeHtml(S.siteUpdatedAtLabel(iso))}</span></div>` : '';
    })
    .filter(Boolean)
    .join('');
  const updatedListHtml = updatedRows
    ? `<div class="status-msg" style="margin-top:10px; margin-bottom:2px;">${t('dyn.siteUpdatedListHeading')}</div><div class="site-updated-list">${updatedRows}</div>`
    : '';
  outputEl.innerHTML = `
    <div class="status-msg">${summary}</div>
    ${updatedListHtml}
    <button type="button" class="action-btn primary" data-act="download-file">${escapeHtml(t('dyn.downloadBtn'))}</button>
    <button type="button" class="action-btn secondary" data-act="toggle-show-code">${escapeHtml(t('dyn.showCodeBtn'))}</button>
    <div id="dtExportTextareaArea"></div>
    <button type="button" class="action-btn secondary" data-act="toggle-show-link">${escapeHtml(t('dyn.showLinkBtn'))}</button>
    <div id="dtExportLinkArea"></div>
    ${qrFeasible
    ? `<button type="button" class="action-btn secondary" data-act="toggle-show-qr">${escapeHtml(t('dyn.showQrBtn'))}</button>`
    : `<div class="status-msg">${escapeHtml(t('dyn.qrTooLong'))}</div>`}
    <div id="dtExportQrArea"></div>
  `;
  renderExportTextareaArea();
  renderExportLinkArea();
  renderExportQrArea();
}

function toggleExportTextarea() {
  if (!lastExportCode) return;
  exportTextareaOpen = !exportTextareaOpen;
  renderExportTextareaArea();
}
function renderExportTextareaArea() {
  const area = containerEl.querySelector('#dtExportTextareaArea');
  if (!area) return;
  if (!exportTextareaOpen || !lastExportCode) { area.innerHTML = ''; return; }
  area.innerHTML = `
    <textarea id="dtCodeOutput" class="code-textarea" readonly>${escapeHtml(lastExportCode)}</textarea>
    <button type="button" class="action-btn secondary" data-act="copy-code">${escapeHtml(t('dyn.copyCodeBtn'))}</button>
  `;
  const ta = area.querySelector('#dtCodeOutput');
  if (ta) ta.addEventListener('click', () => ta.select());
}

function downloadExportFile() {
  if (!lastExportCode) return;
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const blob = new Blob([lastExportCode], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sky-tools-transfer_${stamp}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  els.exportStatus.className = 'status-msg ok';
  els.exportStatus.textContent = t('dyn.downloadSuccess');
}

async function copyExportCode() {
  const ta = containerEl.querySelector('#dtCodeOutput');
  if (!ta) return;
  ta.select();
  try {
    await navigator.clipboard.writeText(ta.value);
    els.exportStatus.className = 'status-msg ok';
    els.exportStatus.textContent = t('dyn.copySuccess');
  } catch (e) {
    els.exportStatus.className = 'status-msg err';
    els.exportStatus.textContent = t('dyn.copyFailed');
  }
}

/* ================================================================
   🔗 リンクとしてコピー（tai-hubのハッシュルーターに合わせたアダプテーション。
   ファイル冒頭のコメント参照）
   ================================================================ */
function buildTransferLink(code) {
  return `${location.origin}${location.pathname}#/data-transfer/${encodeURIComponent(code)}`;
}
function toggleExportLink() {
  if (!lastExportCode) return;
  exportLinkOpen = !exportLinkOpen;
  renderExportLinkArea();
}
function renderExportLinkArea() {
  const area = containerEl.querySelector('#dtExportLinkArea');
  if (!area) return;
  if (!exportLinkOpen || !lastExportCode) { area.innerHTML = ''; return; }
  const link = buildTransferLink(lastExportCode);
  const longNote = link.length > S.QR_MAX_BYTES ? `<div class="status-msg">${escapeHtml(t('dyn.linkTooLongNote'))}</div>` : '';
  area.innerHTML = `
    <textarea id="dtLinkOutput" class="code-textarea" readonly>${escapeHtml(link)}</textarea>
    ${longNote}
    <button type="button" class="action-btn secondary" data-act="copy-link">${escapeHtml(t('dyn.copyLinkBtn'))}</button>
  `;
  const ta = area.querySelector('#dtLinkOutput');
  if (ta) ta.addEventListener('click', () => ta.select());
}
async function copyExportLinkCode() {
  const ta = containerEl.querySelector('#dtLinkOutput');
  if (!ta) return;
  ta.select();
  try {
    await navigator.clipboard.writeText(ta.value);
    els.exportStatus.className = 'status-msg ok';
    els.exportStatus.textContent = t('dyn.copyLinkSuccess');
  } catch (e) {
    els.exportStatus.className = 'status-msg err';
    els.exportStatus.textContent = t('dyn.copyLinkFailed');
  }
}

// ページ読み込み時に #/data-transfer/<code> というサブルートで開かれた場合、
// 貼り付け欄への手動コピー&ペーストを省略して自動でコードを読み込む。
async function loadCodeFromSub(sub) {
  let code;
  try { code = decodeURIComponent(sub); } catch (e) { return; }
  if (!code) return;
  // 🔒 読み取ったら、URLバー・ブラウザ履歴にコードが残り続けないよう、
  // 同一ページ内でサブルートだけ即座に取り除く（hashchangeは発火しないreplaceState）。
  try { history.replaceState(null, '', `${location.pathname}${location.search}#/data-transfer`); } catch (e) { /* noop */ }
  if (els.importCodeInput) els.importCodeInput.value = code;
  if (els.importSection && els.importSection.scrollIntoView) els.importSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  await processImportCode(code);
  if (pendingImportData) {
    const statusEl = els.importStatus;
    if (statusEl && !statusEl.textContent) {
      statusEl.className = 'status-msg ok';
      statusEl.textContent = t('dyn.linkAutoLoadedNotice');
    }
  }
}

/* ================================================================
   📱 QRコード表示（kazuhikoarase/qrcode-generator, MIT・依存ライブラリ無し。
   使う瞬間までCDNから動的ロードしない＝元実装と同じ遅延ロード方式）
   ================================================================ */
function ensureQrCodeLib() {
  if (window.qrcode) return Promise.resolve();
  if (qrLibLoading) return qrLibLoading;
  qrLibLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
    s.onload = () => resolve();
    s.onerror = () => { qrLibLoading = null; reject(new Error('qrcode lib load failed')); };
    document.head.appendChild(s);
  });
  return qrLibLoading;
}
function toggleExportQr() {
  if (!lastExportCode) return;
  exportQrOpen = !exportQrOpen;
  renderExportQrArea();
}
async function renderExportQrArea() {
  const area = containerEl.querySelector('#dtExportQrArea');
  if (!area) return;
  if (!exportQrOpen || !lastExportCode) { area.innerHTML = ''; return; }
  const code = lastExportCode;
  area.innerHTML = `<div class="status-msg">${escapeHtml(t('dyn.qrLoading'))}</div>`;
  try {
    await ensureQrCodeLib();
  } catch (e) {
    if (code === lastExportCode && exportQrOpen) area.innerHTML = `<div class="status-msg err">${escapeHtml(t('dyn.qrLoadFailed'))}</div>`;
    return;
  }
  if (code !== lastExportCode || !exportQrOpen) return;

  try {
    const qr = window.qrcode(0, 'L');
    qr.addData(code);
    qr.make();
    const svg = qr.createSvgTag({ scalable: true });
    area.innerHTML = `
      <div class="qr-panel"><div class="qr-box">${svg}</div></div>
      <div class="status-msg">${escapeHtml(t('dyn.qrCaption'))}</div>
    `;
    const svgEl = area.querySelector('.qr-box svg');
    if (svgEl) {
      const qrAltText = t('dyn.qrAlt');
      svgEl.setAttribute('role', 'img');
      svgEl.setAttribute('aria-label', qrAltText);
      let titleEl = svgEl.querySelector('title');
      if (!titleEl) {
        titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        svgEl.insertBefore(titleEl, svgEl.firstChild);
      }
      titleEl.textContent = qrAltText;
    }
  } catch (e) {
    area.innerHTML = `<div class="status-msg err">${escapeHtml(t('dyn.qrTooLong'))}</div>`;
  }
}

/* ================================================================
   📥 インポート（コード読み込み → サイト選択 → 復元）
   ================================================================ */
async function loadCodeForImport() {
  const code = els.importCodeInput.value.trim();
  if (!code) return;
  await processImportCode(code);
}

function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const code = String(reader.result).trim();
    els.importCodeInput.value = code;
    await processImportCode(code);
  };
  reader.onerror = () => {
    els.importStatus.className = 'status-msg err';
    els.importStatus.textContent = t('dyn.fileReadFailed');
  };
  reader.readAsText(file);
  event.target.value = '';
}

async function processImportCode(code) {
  const statusEl = els.importStatus;
  statusEl.className = 'status-msg';
  statusEl.textContent = '';
  pendingImportData = null;
  pendingImportSiteUpdatedAt = null;
  lastImportDetected = null;
  lastImportDataKeys = null;
  lastImportOverwriteInfo = null;
  importOverwriteConfirming = false;
  importProfileFilters = {};
  renderImportSiteArea();

  let payload;
  try {
    payload = JSON.parse(await S.decodeTransferCode(code));
  } catch (e) {
    statusEl.className = 'status-msg err';
    statusEl.textContent = t('dyn.codeLoadFailed');
    return;
  }
  const data = payload && payload.data && typeof payload.data === 'object' ? payload.data : null;
  if (!data) {
    statusEl.className = 'status-msg err';
    statusEl.textContent = t('dyn.notThisToolCode');
    return;
  }

  pendingImportData = data;
  pendingImportSiteUpdatedAt = (payload.siteUpdatedAt && typeof payload.siteUpdatedAt === 'object') ? payload.siteUpdatedAt : {};
  const dataKeys = Object.keys(data);
  const detected = S.SITE_CATALOG.filter((site) => S.matchKeysForSite(site, dataKeys).length > 0);
  if (detected.length === 0) {
    statusEl.className = 'status-msg err';
    statusEl.textContent = t('dyn.noMatchingSiteData');
    return;
  }

  lastImportDetected = detected.filter((site) => !site.hidden);
  lastImportDataKeys = dataKeys;
  renderImportSiteArea();
}

function getImportedProfilesList() {
  if (!pendingImportData) return [];
  const raw = pendingImportData[S.PROFILES_KEY];
  return raw !== undefined ? S.parseProfileListJson(raw) : [];
}

function computeImportOverwriteInfo() {
  const currentLocalKeys = S.getAllLocalStorageKeys();
  const localSnapshots = S.refreshSiteSnapshots();
  const visible = (lastImportDetected || []).map((site) => {
    const profileFilter = (site.namespaced && importProfileFilters[site.id]) || 'all';
    const hasLocalData = S.matchKeysForSiteProfile(site, currentLocalKeys, profileFilter).length > 0;
    const localUpdatedAt = (hasLocalData && localSnapshots[site.id]) ? localSnapshots[site.id].updatedAt : null;
    const importUpdatedAt = (pendingImportSiteUpdatedAt && pendingImportSiteUpdatedAt[site.id]) || null;
    const contentDiff = hasLocalData ? S.computeSiteContentDiff(site, pendingImportData || {}, profileFilter) : null;
    return {
      site, hasLocalData, localUpdatedAt, importUpdatedAt, contentDiff,
    };
  });
  const hiddenOverwriteCount = S.SITE_CATALOG
    .filter((s) => s.hidden && S.matchKeysForSite(s, lastImportDataKeys || []).length > 0)
    .filter((site) => S.matchKeysForSite(site, currentLocalKeys).length > 0)
    .length;
  const { newProfiles } = S.previewProfileMerge(pendingImportData || {});
  return { visible, hiddenOverwriteCount, newProfiles };
}

function computeSelectedOverwriteRisk(info, selectedIds) {
  if (!info) return false;
  return info.visible.some((v) => selectedIds.includes(v.site.id) && v.hasLocalData) || info.hiddenOverwriteCount > 0;
}

function getCheckedImportSiteIds() {
  return [...els.importSiteArea.querySelectorAll('.import-site-checkbox:checked')].map((el) => el.dataset.site);
}

function formatSiteDiffSummary(diff) {
  if (!diff) return '';
  const parts = [];
  if (diff.entriesAdded > 0) parts.push(t('dyn.diffEntriesAdded', { n: diff.entriesAdded }));
  if (diff.titlesAdded > 0) parts.push(t('dyn.diffTitlesAdded', { n: diff.titlesAdded }));
  if (diff.entriesChanged > 0) parts.push(t('dyn.diffEntriesChanged', { n: diff.entriesChanged }));
  if (diff.entriesRemoved > 0) parts.push(t('dyn.diffEntriesRemoved', { n: diff.entriesRemoved }));
  if (parts.length === 0) return '';
  return t('dyn.diffSummaryPrefix') + parts.join(JOINER);
}

function renderImportWarningBoxHtml(info, selectedIds) {
  if (!info) return '';
  const ids = selectedIds || [];
  const overwriteRows = info.visible.filter((v) => v.hasLocalData && ids.includes(v.site.id)).map(({
    site, localUpdatedAt, importUpdatedAt, contentDiff,
  }) => {
    let text = escapeHtml(S.siteLabel(site));
    if (importUpdatedAt) {
      const openParen = CURRENT_LANG === 'en' ? ' (' : '（';
      const closeParen = CURRENT_LANG === 'en' ? ')' : '）';
      text += `${openParen}${t('dyn.importCodeDateLabel')}: ${escapeHtml(S.siteUpdatedAtLabel(importUpdatedAt))}`;
      if (localUpdatedAt) {
        text += ` / ${t('dyn.importLocalDateLabel')}: ${escapeHtml(S.siteUpdatedAtLabel(localUpdatedAt))}`;
        if (localUpdatedAt > importUpdatedAt) text += t('dyn.importLocalNewerFlag');
      }
      text += closeParen;
    }
    const diffText = formatSiteDiffSummary(contentDiff);
    const diffHtml = diffText ? `<div class="site-diff-note">${escapeHtml(diffText)}</div>` : '';
    return `<div class="site-updated-row overwrite"><span class="site-updated-name">${text}</span></div>${diffHtml}`;
  }).join('');

  const parts = [];
  if (overwriteRows) {
    parts.push(`<div>${t('dyn.overwriteSitesLabel')}</div><div class="site-updated-list">${overwriteRows}</div>`);
    if (info.hiddenOverwriteCount > 0) parts.push(`<div>${t('dyn.overwriteHiddenNote', { n: info.hiddenOverwriteCount })}</div>`);
  } else if (info.hiddenOverwriteCount > 0) {
    parts.push(`<div>${t('dyn.overwriteHiddenOnlyLabel', { n: info.hiddenOverwriteCount })}</div>`);
  }
  if (info.newProfiles.length > 0) {
    const names = info.newProfiles.map((p) => escapeHtml(pfDisplayName(p))).join(JOINER);
    parts.push(`<div>${t('dyn.newProfilesLabel', { n: info.newProfiles.length, names })}</div>`);
  }
  if (parts.length === 0) return '';
  return `<div class="import-warning-box">${parts.join('')}</div>`;
}

function renderImportSiteArea() {
  renderImportChecklist();
  renderImportConfirmArea();
}

function renderImportChecklist() {
  const siteAreaEl = els.importSiteArea;
  if (!lastImportDetected || !lastImportDataKeys) {
    siteAreaEl.innerHTML = '';
    lastImportOverwriteInfo = null;
    return;
  }

  lastImportOverwriteInfo = computeImportOverwriteInfo();
  const warningHtml = renderImportWarningBoxHtml(lastImportOverwriteInfo, lastImportOverwriteInfo.visible.map((v) => v.site.id));

  if (lastImportDetected.length === 0) {
    siteAreaEl.innerHTML = `<div id="dtImportWarningBox">${warningHtml}</div>`
      + `<div class="status-msg" style="margin-bottom:6px;">${escapeHtml(t('dyn.hiddenOnlyImportNotice'))}</div>`;
    return;
  }

  const importedProfiles = getImportedProfilesList();
  siteAreaEl.innerHTML = `<div id="dtImportWarningBox">${warningHtml}</div>`
    + `<div class="status-msg" style="margin-bottom:6px;">${escapeHtml(t('dyn.selectSitesToRestore'))}</div>`
    + `<div class="list-select-row">
      <button type="button" class="list-select-btn" data-act="select-all-import">${escapeHtml(t('page.selectAllBtn'))}</button>
      <button type="button" class="list-select-btn" data-act="select-none-import">${escapeHtml(t('page.selectNoneBtn'))}</button>
    </div>`
    + lastImportOverwriteInfo.visible.map(({ site, hasLocalData }) => {
      const matched = S.matchKeysForSite(site, lastImportDataKeys);
      const showProfileFilter = site.namespaced && importedProfiles.length > 1;
      const filterVal = showProfileFilter ? (importProfileFilters[site.id] || 'all') : 'all';
      const filteredMatched = filterVal === 'all' ? matched : S.matchKeysForSiteProfile(site, lastImportDataKeys, filterVal);
      const rowHtml = `
        <label class="site-opt ${showProfileFilter ? 'has-profile-filter' : ''}" data-site="${site.id}">
          <input type="checkbox" class="import-site-checkbox" data-site="${site.id}" checked>
          <span class="site-opt-label">${escapeHtml(S.siteLabel(site))}</span>
          <span class="site-opt-count">${numUnitHtml(t('dyn.keysCount', { n: filteredMatched.length }))}${hasLocalData ? ' <svg class="inline-icon warn" width="12" height="12"><use href="#i-warning"/></svg>' : ''}</span>
        </label>`;
      const profileRowHtml = showProfileFilter ? `
        <div class="site-opt-profile-row">
          <span aria-hidden="true"><svg class="inline-icon" width="14" height="14"><use href="#i-person"/></svg></span>
          <select class="site-profile-filter" data-site="${site.id}" data-scope="import"
            aria-label="${escapeHtml(t('page.profileFilterAriaLabel', { site: S.siteLabel(site) }))}">
            <option value="all" ${filterVal === 'all' ? 'selected' : ''}>${escapeHtml(t('page.allProfilesOption'))} (${t('dyn.keysCount', { n: matched.length })})</option>
            ${importedProfiles.map((p) => {
              const cnt = S.matchKeysForSiteProfile(site, lastImportDataKeys, p.id).length;
              return `<option value="${escapeHtml(p.id)}" ${filterVal === p.id ? 'selected' : ''}>${escapeHtml(pfDisplayName(p))} (${t('dyn.keysCount', { n: cnt })})</option>`;
            }).join('')}
          </select>
        </div>` : '';
      return rowHtml + profileRowHtml;
    }).join('');
}

function onImportProfileFilterChange(siteId, value) {
  importProfileFilters[siteId] = value;
  const site = S.SITE_CATALOG.find((s) => s.id === siteId);
  if (!site || !lastImportDataKeys) return;
  if (lastImportOverwriteInfo) lastImportOverwriteInfo = computeImportOverwriteInfo();
  const filtered = S.matchKeysForSiteProfile(site, lastImportDataKeys, value);
  const countEl = els.importSiteArea.querySelector(`label.site-opt[data-site="${siteId}"] .site-opt-count`);
  if (countEl) {
    const hasLocalData = !!(lastImportOverwriteInfo && lastImportOverwriteInfo.visible.some((v) => v.site.id === siteId && v.hasLocalData));
    countEl.innerHTML = numUnitHtml(t('dyn.keysCount', { n: filtered.length })) + (hasLocalData ? ' <svg class="inline-icon warn" width="12" height="12"><use href="#i-warning"/></svg>' : '');
  }
  renderImportConfirmArea();
}

function updateImportWarningBox() {
  const boxWrapEl = containerEl.querySelector('#dtImportWarningBox');
  if (!boxWrapEl || !lastImportOverwriteInfo) return;
  boxWrapEl.innerHTML = renderImportWarningBoxHtml(lastImportOverwriteInfo, getCheckedImportSiteIds());
}

function renderImportConfirmArea() {
  const confirmAreaEl = els.importConfirmArea;
  if (!lastImportDetected || !lastImportDataKeys) {
    confirmAreaEl.innerHTML = '';
    return;
  }
  updateImportWarningBox();
  const hasRisk = computeSelectedOverwriteRisk(lastImportOverwriteInfo, getCheckedImportSiteIds());
  if (importOverwriteConfirming && !hasRisk) importOverwriteConfirming = false;
  if (importOverwriteConfirming) {
    confirmAreaEl.innerHTML = `
      <div class="import-overwrite-confirm">
        <div>${escapeHtml(t('dyn.importOverwriteConfirmText'))}</div>
        <button type="button" class="action-btn danger" data-act="confirm-import">${escapeHtml(t('dyn.importOverwriteConfirmBtn'))}</button>
        <button type="button" class="action-btn secondary" data-act="cancel-overwrite">${escapeHtml(t('dyn.cancelBtn'))}</button>
      </div>`;
    return;
  }
  confirmAreaEl.innerHTML = `<button type="button" class="action-btn primary" data-act="${hasRisk ? 'import-restore-clicked' : 'confirm-import'}">${escapeHtml(t('dyn.restoreBtn'))}</button>`;
}
function importRestoreClicked() {
  importOverwriteConfirming = true;
  renderImportConfirmArea();
}
function importCancelOverwriteConfirm() {
  importOverwriteConfirming = false;
  renderImportConfirmArea();
}

function confirmImport() {
  if (!pendingImportData) return;
  const selectedIds = getCheckedImportSiteIds();
  if (!importOverwriteConfirming) {
    lastImportOverwriteInfo = computeImportOverwriteInfo();
    if (computeSelectedOverwriteRisk(lastImportOverwriteInfo, selectedIds)) {
      importRestoreClicked();
      return;
    }
  }
  const statusEl = els.importStatus;
  const dataKeys = Object.keys(pendingImportData);
  const hiddenSites = S.SITE_CATALOG.filter((s) => s.hidden);
  const hasHiddenData = hiddenSites.some((site) => S.matchKeysForSite(site, dataKeys).length > 0);
  if (selectedIds.length === 0 && !hasHiddenData) {
    statusEl.className = 'status-msg err';
    statusEl.textContent = t('dyn.selectAtLeastOneSite');
    return;
  }

  const importedProfilesNow = getImportedProfilesList();
  const siteValidFilter = {};
  selectedIds.forEach((id) => {
    const requestedFilter = importProfileFilters[id];
    siteValidFilter[id] = (requestedFilter && requestedFilter !== 'all' && importedProfilesNow.some((p) => p.id === requestedFilter))
      ? requestedFilter : 'all';
  });
  const allowedProfileIds = new Set();
  selectedIds.forEach((id) => {
    const site = S.SITE_CATALOG.find((s) => s.id === id);
    if (!site || !site.namespaced) return;
    const filter = siteValidFilter[id];
    importedProfilesNow.forEach((p) => {
      if ((filter === 'all' || filter === p.id) && S.matchKeysForSiteProfile(site, dataKeys, p.id).length > 0) {
        allowedProfileIds.add(p.id);
      }
    });
  });
  S.SITE_CATALOG.filter((s) => s.hidden && s.namespaced).forEach((site) => {
    importedProfilesNow.forEach((p) => {
      if (S.matchKeysForSiteProfile(site, dataKeys, p.id).length > 0) allowedProfileIds.add(p.id);
    });
  });

  let count = 0;
  const failedKeys = [];
  function safeSetItem(k, v) {
    try { localStorage.setItem(k, v); count += 1; } catch (e) { failedKeys.push(k); }
  }
  const { count: registryCount, newProfiles, failedKeys: registryFailedKeys } = S.applyProfileMerge(pendingImportData, allowedProfileIds);
  count += registryCount;
  failedKeys.push(...registryFailedKeys);
  selectedIds.forEach((id) => {
    const site = S.SITE_CATALOG.find((s) => s.id === id);
    S.matchKeysForSiteProfile(site, dataKeys, siteValidFilter[id]).forEach((k) => safeSetItem(k, pendingImportData[k]));
  });
  hiddenSites.forEach((site) => {
    S.matchKeysForSite(site, dataKeys).forEach((k) => safeSetItem(k, pendingImportData[k]));
  });
  const hiddenImportSiteCount = hiddenSites.filter((site) => S.matchKeysForSite(site, dataKeys).length > 0).length;
  S.recordTransferHistoryEntry('import', selectedIds, hiddenImportSiteCount);

  statusEl.className = failedKeys.length > 0 ? 'status-msg err' : 'status-msg ok';
  statusEl.innerHTML = escapeHtml(t('dyn.restoreSuccess', { n: count })) + (newProfiles.length > 0
    ? ' ' + t('dyn.restoreSuccessNewProfiles', { n: newProfiles.length, names: newProfiles.map((p) => escapeHtml(pfDisplayName(p))).join(JOINER) })
    : '') + (failedKeys.length > 0 ? ' <svg class="inline-icon warn" width="12" height="12"><use href="#i-warning"/></svg>' + escapeHtml(t('dyn.restoreFailedKeys', { n: failedKeys.length })) : '');

  pendingImportData = null;
  pendingImportSiteUpdatedAt = null;
  lastImportDetected = null;
  lastImportDataKeys = null;
  lastImportOverwriteInfo = null;
  importOverwriteConfirming = false;
  importProfileFilters = {};
  els.importSiteArea.innerHTML = '';
  els.importConfirmArea.innerHTML = '';
  els.importCodeInput.value = '';
  S.refreshSiteSnapshots();
  renderExportSiteList();
  renderTransferHistory();
  resetExportOutput();
}

/* ================================================================
   設定モーダル：テーマ切替・言語切替・データのエクスポート/インポート/
   全削除。item/profiles.js の settingsOpen系 + dmExport/dmImportFileSelected
   /dmConfirmWipe を移植。
   ================================================================ */
import { CURRENT_LANG, setLang, escapeHtml } from '../i18n.js';
import {
  getSkyThemeMode, toggleTheme, exportAllData, parseImportFile, importAllData, wipeAllData,
  getShortcutsEnabled, setShortcutsEnabled, getShowTitlesEnabled, setShowTitlesEnabled,
  getStartRoute, setStartRoute,
} from '../state.js';
import { getActiveTheme, wipeWallpapers } from '../theme.js';
import { ROUTES } from '../router-registry.js';

function t(ja, en) { return CURRENT_LANG === 'en' ? en : ja; }

function themeInfo(mode) {
  return {
    light: { icon: 'i-sun', label: t('ライト', 'Light') },
    dark: { icon: 'i-moon', label: t('ダーク', 'Dark') },
    system: { icon: 'i-monitor', label: t('システム', 'System') },
  }[mode];
}

// 「起動時に開くツール」の選択肢（ツール名はルーターの表示名から「 - tai-hub」を除いたもの）
function startRouteOptions() {
  const cur = getStartRoute();
  return Object.keys(ROUTES).map(k => {
    let name = k;
    try { name = String(ROUTES[k].title('')).replace(/ - tai-hub$/, ''); } catch (e) { /* 表示名が取れなければキー名 */ }
    return `<option value="${k}"${cur === k ? ' selected' : ''}>${escapeHtml(name)}</option>`;
  }).join('');
}

export function open() {
  document.getElementById('settingsModalOverlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'settingsModalOverlay';
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.innerHTML = `
    <div class="modal-card">
      <button type="button" class="modal-close-btn" id="settingsCloseBtn"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      <div class="modal-title">${t('表示設定', 'Display Settings')}</div>
      <div class="settings-row">
        <span>${t('着せ替え', 'Themes')}</span>
        <button type="button" class="settings-btn" id="settingsStudioBtn"><svg class="inline-icon" width="15" height="15"><use href="#i-palette"/></svg> ${t('開く', 'Open')}</button>
      </div>
      <div class="settings-row">
        <span>${t('テーマ', 'Theme')}</span>
        <button type="button" class="settings-btn" id="settingsThemeBtn"></button>
      </div>
      <div class="settings-row" style="gap:10px;">
        <span>${t('起動時に開く画面', 'Open on launch')}</span>
        <select class="settings-btn" id="settingsStartRoute" style="max-width:55%;">
          <option value="">${t('標準（アイテム）', 'Default (Items)')}</option>
          ${startRouteOptions()}
        </select>
      </div>
      <div class="settings-row">
        <span>${t('言語', 'Language')}</span>
        <div class="settings-lang-group">
          <button type="button" class="settings-btn${CURRENT_LANG === 'ja' ? ' active' : ''}" id="settingsLangJaBtn">日本語</button>
          <button type="button" class="settings-btn${CURRENT_LANG === 'en' ? ' active' : ''}" id="settingsLangEnBtn">English</button>
        </div>
      </div>
      <div class="settings-row">
        <span>${t('キーボードショートカット', 'Keyboard shortcuts')}</span>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="checkbox" id="settingsShortcutsCheckbox"${getShortcutsEnabled() ? ' checked' : ''}>
        </label>
      </div>
      <div class="settings-row">
        <span>${t('プロフィール切替で称号数を表示', 'Show title count when switching profiles')}</span>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="checkbox" id="settingsShowTitlesCheckbox"${getShowTitlesEnabled() ? ' checked' : ''}>
        </label>
      </div>
      <div class="settings-row" style="flex-direction:column;align-items:stretch;gap:8px;">
        <span>${t('データのバックアップ', 'Data Backup')}</span>
        <div style="display:flex;gap:8px;">
          <button type="button" class="pf-icon-btn" id="settingsExportBtn" style="flex:1;">${t('書き出し', 'Export')}</button>
          <label class="pf-icon-btn" style="flex:1;text-align:center;cursor:pointer;">${t('読み込み', 'Import')}<input type="file" accept="application/json" id="settingsImportInput" style="display:none;"></label>
        </div>
        <div id="settingsStatus" style="font-size:12px;color:var(--hub-text-2);"></div>
        <div id="settingsImportConfirmArea"></div>
      </div>
      <button type="button" class="settings-danger-btn" id="settingsWipeBtn">${t('全データを削除', 'Erase all data')}</button>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('settingsCloseBtn').addEventListener('click', close);
  syncThemeBtn();
  document.getElementById('settingsThemeBtn').addEventListener('click', () => { toggleTheme(); syncThemeBtn(); });
  document.getElementById('settingsStudioBtn').addEventListener('click', () => {
    close();
    import('./theme-studio.js').then(m => m.open());
  });
  document.getElementById('settingsStartRoute').addEventListener('change', e => setStartRoute(e.target.value));
  document.getElementById('settingsLangJaBtn').addEventListener('click', () => setLang('ja'));
  document.getElementById('settingsLangEnBtn').addEventListener('click', () => setLang('en'));
  document.getElementById('settingsShortcutsCheckbox').addEventListener('change', e => setShortcutsEnabled(e.target.checked));
  document.getElementById('settingsShowTitlesCheckbox').addEventListener('change', e => setShowTitlesEnabled(e.target.checked));
  document.getElementById('settingsExportBtn').addEventListener('click', () => {
    const count = exportAllData();
    document.getElementById('settingsStatus').textContent = t(`書き出しました（${count}件のキー）。`, `Exported (${count} keys).`);
  });
  document.getElementById('settingsImportInput').addEventListener('change', onImportFileSelected);
  document.getElementById('settingsWipeBtn').addEventListener('click', () => {
    if (confirm(t('すべてのデータを削除します。この操作は取り消せません。よろしいですか？', 'This will erase ALL locally stored data. This cannot be undone. Continue?'))) {
      wipeAllData();
      wipeWallpapers();
      location.reload();
    }
  });

  requestAnimationFrame(() => overlay.classList.add('open'));
}

function syncThemeBtn() {
  const btn = document.getElementById('settingsThemeBtn');
  if (!btn) return;
  const info = themeInfo(getSkyThemeMode());
  btn.innerHTML = `<svg class="inline-icon" width="15" height="15"><use href="#${info.icon}"/></svg> ${info.label}`;
  // 着せ替えが「明るさ固定」の時は、ライト/ダークの切替は見た目に影響しないので、その旨を示す
  const th = getActiveTheme();
  const locked = !!(th && (th.bg || th.force));
  btn.disabled = locked;
  btn.style.opacity = locked ? '0.45' : '';
  btn.title = locked ? t('着せ替えの明るさ設定が優先されています', 'The current theme fixes the brightness') : '';
}

let pendingImportData = null;
function onImportFileSelected(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try { data = parseImportFile(reader.result); }
    catch { document.getElementById('settingsStatus').textContent = t('ファイルの読み込みに失敗しました。', 'Failed to read file.'); return; }
    if (!data) { document.getElementById('settingsStatus').textContent = t('このツールで書き出したファイルではないようです。', "This doesn't look like a valid backup file."); return; }
    pendingImportData = data;
    const count = Object.keys(data).length;
    document.getElementById('settingsImportConfirmArea').innerHTML = `
      <div class="pf-row" style="flex-wrap:wrap;">
        <span class="pf-row-name">${t(`${count}件のキーをインポートします。よろしいですか？`, `Import ${count} keys?`)}</span>
        <button type="button" class="pf-icon-btn pf-row-btn-ok" id="confirmImportBtn">${t('実行', 'Import')}</button>
        <button type="button" class="pf-icon-btn" id="cancelImportBtn">${t('取消', 'Cancel')}</button>
      </div>`;
    document.getElementById('confirmImportBtn').addEventListener('click', () => {
      const { okCount } = importAllData(pendingImportData);
      document.getElementById('settingsStatus').textContent = t(`${okCount}件を復元しました。再読み込みします…`, `Restored ${okCount} keys. Reloading…`);
      setTimeout(() => location.reload(), 800);
    });
    document.getElementById('cancelImportBtn').addEventListener('click', () => {
      pendingImportData = null;
      document.getElementById('settingsImportConfirmArea').innerHTML = '';
    });
  };
  reader.readAsText(file);
}

export function close() {
  document.getElementById('settingsModalOverlay')?.classList.remove('open');
}

/* ================================================================
   設定モーダル：テーマ切替・言語切替・データのエクスポート/インポート/
   全削除。item/profiles.js の settingsOpen系 + dmExport/dmImportFileSelected
   /dmConfirmWipe を移植。

   🎨 着せ替えは、この「表示設定」シートの中の1画面（表示設定 > 着せ替え）。
   「着せ替え」の行を押すとシートの中身が着せ替え画面（chrome/theme-studio.js）に
   切り替わり、「‹ 表示設定」で設定一覧へ戻る。着せ替え画面の間だけシートは背景を
   暗くせず外側の操作も止めない（色を変えながら実際の画面で確かめられる。css/theme.css の .ts-live）。
   ================================================================ */
import { CURRENT_LANG, RAW_LANG, setLang, escapeHtml } from '../i18n.js';
import {
  getSkyThemeMode, toggleTheme, exportAllData, parseImportFile, importAllData, wipeAllData,
  getShortcutsEnabled, setShortcutsEnabled, getShowTitlesEnabled, setShowTitlesEnabled,
  getStartRoute, setStartRoute, getSidePanelEnabled, setSidePanelEnabled,
} from '../state.js';
import * as sidePanels from './side-panels.js';
import { getActiveTheme, wipeWallpapers, PRESETS, sameLook } from '../theme.js';
import { ROUTES } from '../router-registry.js';

function t(ja, en) { return CURRENT_LANG === 'en' ? en : ja; }

function themeInfo(mode) {
  return {
    light: { icon: 'i-sun', label: t('ライト', 'Light') },
    dark: { icon: 'i-moon', label: t('ダーク', 'Dark') },
    system: { icon: 'i-monitor', label: t('システム', 'System') },
  }[mode];
}

// 着せ替えの現在の状態（設定一覧の「着せ替え」行に出す）
function currentThemeLabel() {
  const th = getActiveTheme();
  if (!th) return t('標準', 'Default');
  const pr = PRESETS.find(p => sameLook(th, p.theme));
  return pr ? t(pr.ja, pr.en) : t('カスタム', 'Custom');
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

let overlayEl = null;
let cardEl = null;
let studio = null; // 着せ替え画面のモジュール（開いた時に読み込む）

export function open() {
  if (studio) studio.unmount(); // Escなどで着せ替え画面のまま閉じられていた場合の後始末
  document.getElementById('settingsModalOverlay')?.remove();
  studio = null;
  overlayEl = document.createElement('div');
  overlayEl.className = 'modal-overlay';
  overlayEl.id = 'settingsModalOverlay';
  overlayEl.addEventListener('click', e => { if (e.target === overlayEl) close(); });
  cardEl = document.createElement('div');
  cardEl.className = 'modal-card';
  overlayEl.appendChild(cardEl);
  document.body.appendChild(overlayEl);
  renderMain();
  requestAnimationFrame(() => overlayEl.classList.add('open'));
}

// 設定一覧（シートの中身）を描く。着せ替え画面から戻ってきた時にも使う
function renderMain() {
  overlayEl.classList.remove('ts-live');
  cardEl.innerHTML = `
      <button type="button" class="modal-close-btn" id="settingsCloseBtn"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      <div class="modal-title">${t('表示設定', 'Display Settings')}</div>
      <button type="button" class="settings-row settings-nav-row" id="settingsStudioBtn">
        <span class="settings-nav-label"><svg class="inline-icon" width="17" height="17"><use href="#i-palette"/></svg>${t('着せ替え', 'Themes')}</span>
        <span class="settings-nav-value">${escapeHtml(currentThemeLabel())}<svg class="inline-icon" width="16" height="16"><use href="#i-chevron-right"/></svg></span>
      </button>
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
          <button type="button" class="settings-btn${RAW_LANG === 'ja' ? ' active' : ''}" id="settingsLangJaBtn">日本語</button>
          <button type="button" class="settings-btn${RAW_LANG === 'en' ? ' active' : ''}" id="settingsLangEnBtn">English</button>
          <button type="button" class="settings-btn${RAW_LANG === 'zh-TW' ? ' active' : ''}" id="settingsLangZhBtn">繁體中文</button>
          <button type="button" class="settings-btn${RAW_LANG === 'ko' ? ' active' : ''}" id="settingsLangKoBtn">한국어</button>
        </div>
      </div>
      <div class="settings-row">
        <span>${t('キーボードショートカット', 'Keyboard shortcuts')}</span>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="checkbox" id="settingsShortcutsCheckbox"${getShortcutsEnabled() ? ' checked' : ''}>
        </label>
      </div>
      <div class="settings-row" style="flex-direction:column;align-items:stretch;gap:2px;">
        <span style="font-weight:600;">${t('ワイド画面のサイドパネル', 'Side panels on wide screens')}</span>
        <label class="settings-row" style="border-bottom:0;padding:8px 0;cursor:pointer;">
          <span>${t('関連ツールを左端に常時表示', 'Always show Related Tools on the left')}</span>
          <input type="checkbox" id="settingsSideToolsCheckbox"${getSidePanelEnabled('tools') ? ' checked' : ''}>
        </label>
        <label class="settings-row" style="border-bottom:0;padding:8px 0;cursor:pointer;">
          <span>${t('ダッシュボードを右端に常時表示', 'Always show the Dashboard on the right')}</span>
          <input type="checkbox" id="settingsSideDashCheckbox"${getSidePanelEnabled('dash') ? ' checked' : ''}>
        </label>
        <span style="font-size:11.5px;color:var(--hub-text-2);">${t('幅1280px以上の画面で有効です。オフにすると、これまでどおり画面下部のメニューから開きます。', 'Applies to screens 1280px or wider. When off, open them from the bottom menu as before.')}</span>
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
      <button type="button" class="settings-danger-btn" id="settingsWipeBtn">${t('全データを削除', 'Erase all data')}</button>`;

  document.getElementById('settingsCloseBtn').addEventListener('click', close);
  syncThemeBtn();
  document.getElementById('settingsThemeBtn').addEventListener('click', () => { toggleTheme(); syncThemeBtn(); });
  document.getElementById('settingsStudioBtn').addEventListener('click', openThemeView);
  document.getElementById('settingsStartRoute').addEventListener('change', e => setStartRoute(e.target.value));
  document.getElementById('settingsLangJaBtn').addEventListener('click', () => setLang('ja'));
  document.getElementById('settingsLangEnBtn').addEventListener('click', () => setLang('en'));
  document.getElementById('settingsLangZhBtn').addEventListener('click', () => setLang('zh-TW'));
  document.getElementById('settingsLangKoBtn').addEventListener('click', () => setLang('ko'));
  document.getElementById('settingsShortcutsCheckbox').addEventListener('change', e => setShortcutsEnabled(e.target.checked));
  document.getElementById('settingsSideToolsCheckbox').addEventListener('change', e => { setSidePanelEnabled('tools', e.target.checked); sidePanels.sync(); });
  document.getElementById('settingsSideDashCheckbox').addEventListener('change', e => { setSidePanelEnabled('dash', e.target.checked); sidePanels.sync(); });
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
  cardEl.scrollTop = 0;
}

// 「着せ替え」画面へ切り替える（使う時だけ読み込む＝起動の依存グラフを増やさない）
function openThemeView() {
  import('./theme-studio.js').then(m => {
    if (!overlayEl || !cardEl) return;
    studio = m;
    overlayEl.classList.add('ts-live');
    m.mount(cardEl, { onBack: renderMain, onClose: close });
  });
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
  if (studio) studio.unmount(); // 着せ替え画面の変更が保留中なら反映してから閉じる
  overlayEl?.classList.remove('open');
  overlayEl?.classList.remove('ts-live');
}

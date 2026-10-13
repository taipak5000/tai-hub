/* ================================================================
   画面下部固定のクイックアクセスドック（プロフィール/ダッシュボード/
   ツール/設定）。emote/index.html の.site-dock markupを移植。itemは
   元々これを持っていなかったため、tai-hubで初めて手に入る共通chrome。
   ================================================================ */
import { CURRENT_LANG } from '../i18n.js';
import * as pfModal from './pf-modal.js';
import * as dashModal from './dash-modal.js';
import * as toolsDrawer from './tools-drawer.js';
import * as settingsModal from './settings-modal.js';

export function render(mountEl) {
  toolsDrawer.init();
  mountEl.innerHTML = `
    <nav class="site-dock" aria-label="${CURRENT_LANG === 'en' ? 'Quick menu' : 'クイックメニュー'}">
      <button type="button" id="dockProfileBtn">
        <span class="site-dock-icon"><span class="icon-chip" style="width:28px;height:28px;"><svg class="inline-icon" width="22" height="22"><use href="#i-folder"/></svg></span></span>
        <span class="site-dock-label" id="siteDockProfileLabel">${CURRENT_LANG === 'en' ? 'Profile' : 'プロフィール'}</span>
      </button>
      <button type="button" id="dockDashboardBtn">
        <span class="site-dock-icon"><span class="icon-chip" style="width:28px;height:28px;"><svg class="inline-icon" width="22" height="22"><use href="#i-calendar"/></svg></span></span>
        <span class="site-dock-label">${CURRENT_LANG === 'en' ? 'Dashboard' : 'ダッシュボード'}</span>
      </button>
      <button type="button" id="dockToolsBtn">
        <span class="site-dock-icon"><span class="icon-chip" style="width:28px;height:28px;"><svg class="inline-icon" width="22" height="22"><use href="#i-menu"/></svg></span></span>
        <span class="site-dock-label">${CURRENT_LANG === 'en' ? 'Other Tools' : '他のツール'}</span>
      </button>
      <button type="button" id="dockSettingsBtn">
        <span class="site-dock-icon"><span class="icon-chip" style="width:28px;height:28px;"><svg class="inline-icon" width="22" height="22"><use href="#i-settings"/></svg></span></span>
        <span class="site-dock-label">${CURRENT_LANG === 'en' ? 'Display Settings' : '表示設定'}</span>
      </button>
    </nav>`;

  document.getElementById('dockProfileBtn').addEventListener('click', () => pfModal.open());
  document.getElementById('dockDashboardBtn').addEventListener('click', () => dashModal.open());
  document.getElementById('dockToolsBtn').addEventListener('click', () => toolsDrawer.open());
  document.getElementById('dockSettingsBtn').addEventListener('click', () => settingsModal.open());
}

export function refreshProfileLabel(label) {
  const el = document.getElementById('siteDockProfileLabel');
  if (el) el.textContent = label;
}

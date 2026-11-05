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
import * as noticeModal from './notice-modal.js';
import { unseenCount, onNoticesChanged } from '../notices.js';

export function render(mountEl) {
  toolsDrawer.init();
  mountEl.innerHTML = `
    <nav class="site-dock" aria-label="${CURRENT_LANG === 'en' ? 'Quick menu' : 'クイックメニュー'}">
      <button type="button" id="dockProfileBtn">
        <span class="site-dock-icon"><span class="icon-chip" style="width:28px;height:28px;"><svg class="inline-icon" width="22" height="22"><use href="#i-folder"/></svg></span></span>
        <span class="site-dock-label" id="siteDockProfileLabel">${CURRENT_LANG === 'en' ? 'Profile' : 'プロフィール'}</span>
      </button>
      <button type="button" id="dockDashboardBtn" class="dock-dash">
        <span class="site-dock-icon"><span class="icon-chip" style="width:28px;height:28px;"><svg class="inline-icon" width="22" height="22"><use href="#i-calendar"/></svg></span></span>
        <span class="site-dock-label">${CURRENT_LANG === 'en' ? 'Dashboard' : 'ダッシュボード'}</span>
      </button>
      <button type="button" id="dockNoticeBtn" class="dock-notice">
        <span class="site-dock-icon"><span class="icon-chip" style="width:28px;height:28px;"><svg class="inline-icon" width="22" height="22"><use href="#i-bell"/></svg></span><span class="dock-badge" id="dockNoticeBadge" hidden></span></span>
        <span class="site-dock-label">${CURRENT_LANG === 'en' ? 'Notices' : 'お知らせ'}</span>
      </button>
      <button type="button" id="dockToolsBtn" class="dock-tools">
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
  document.getElementById('dockNoticeBtn').addEventListener('click', () => noticeModal.open());

  // 🔔 未読のお知らせの数。起動直後の描画を邪魔しないよう少し待ってから数え、ツールの移動・画面へ戻った時・
  // 10分ごと（来訪の開始や日付の変わり目）に数え直す
  onNoticesChanged(refreshNoticeBadge);
  window.addEventListener('hashchange', () => setTimeout(refreshNoticeBadge, 300));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshNoticeBadge(); });
  setInterval(refreshNoticeBadge, 10 * 60 * 1000);
  setTimeout(refreshNoticeBadge, 1200);
}

export function refreshNoticeBadge() {
  const badge = document.getElementById('dockNoticeBadge');
  if (!badge) return;
  let n = 0;
  try { n = unseenCount(); } catch (e) { n = 0; }
  badge.hidden = n === 0;
  badge.textContent = n > 9 ? '9+' : String(n);
  const btn = document.getElementById('dockNoticeBtn');
  if (btn) btn.setAttribute('aria-label', n ? (CURRENT_LANG === 'en' ? `Notices (${n} new)` : `お知らせ（未読${n}件）`) : (CURRENT_LANG === 'en' ? 'Notices' : 'お知らせ'));
}

export function refreshProfileLabel(label) {
  const el = document.getElementById('siteDockProfileLabel');
  if (el) el.textContent = label;
}

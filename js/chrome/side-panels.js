/* ================================================================
   ワイド画面（幅1280px以上）の常設サイドパネル。
   ・左端: 「関連ツール」一覧（ドックの「他のツール」で開く引き出しと同じ一覧。js/chrome/tools-drawer.js）
   ・右端: 「今日・今週・今月」ダッシュボード（ドックの「ダッシュボード」で開くモーダルと同じ中身。
          features/shared/event-dashboard.js を persistent でマウント）
   16:9の広い画面で、ドックを経由せずいつでも見られるようにするためのもの。
   表示/非表示の切替（幅・設定）に合わせて、中身のマウント/アンマウントだけをここで行う
   （レイアウトはcss/chrome.cssの html.side-panels-on ＋メディアクエリが担当）。
   設定は 表示設定 > ワイド画面でサイドパネルを表示（js/state.js の getSidePanelsEnabled）。
   ================================================================ */
import { CURRENT_LANG } from '../i18n.js';
import { getSidePanelsEnabled } from '../state.js';
import * as toolsDrawer from './tools-drawer.js';
import * as eventDashboard from '../../features/shared/event-dashboard.js';

// css/chrome.css のメディアクエリと同じ幅にすること
const WIDE = window.matchMedia('(min-width: 1280px)');
let mounted = false;

function t(ja, en) { return CURRENT_LANG === 'en' ? en : ja; }

function mountPanels() {
  if (mounted) return;
  const left = document.getElementById('side-left-root');
  const right = document.getElementById('side-right-root');
  if (!left || !right) return;
  mounted = true;

  left.setAttribute('aria-label', t('関連ツール', 'Related Tools'));
  left.innerHTML = `
    <div class="side-panel-title"><svg class="inline-icon" width="20" height="20"><use href="#i-menu"/></svg> ${t('関連ツール', 'Related Tools')}</div>
    <nav class="pf-drawer-nav js-tools-nav"></nav>`;
  toolsDrawer.renderNav();

  right.setAttribute('aria-label', t('今日・今週・今月', 'Today / This Week / This Month'));
  right.innerHTML = `
    <div class="side-panel-title"><svg class="inline-icon" width="20" height="20"><use href="#i-calendar"/></svg> ${t('今日・今週・今月', 'Today / This Week / This Month')}</div>
    <div id="sideDashBody"></div>`;
  eventDashboard.mount(right.querySelector('#sideDashBody'), { persistent: true, icsExport: true });
}

function unmountPanels() {
  if (!mounted) return;
  mounted = false;
  eventDashboard.unmountPersistent();
  const left = document.getElementById('side-left-root');
  const right = document.getElementById('side-right-root');
  if (left) left.innerHTML = '';
  if (right) right.innerHTML = '';
}

/** 設定・画面幅の変化に合わせて、パネルの中身を出す/片付ける。レイアウト用クラスも設定に合わせる */
export function sync() {
  const enabled = getSidePanelsEnabled();
  document.documentElement.classList.toggle('side-panels-on', enabled);
  if (enabled && WIDE.matches) mountPanels(); else unmountPanels();
}

export function init() {
  if (WIDE.addEventListener) WIDE.addEventListener('change', sync);
  else if (WIDE.addListener) WIDE.addListener(sync); // 古いSafari
  sync();
}

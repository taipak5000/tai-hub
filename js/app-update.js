/* ================================================================
   🆕 新しいバージョンのお知らせ（更新履歴 js/changelog-data.js と組み）。
   ・今動いているバージョン＝読み込んだ changelog-data.js の先頭の version。
   ・公開中の最新版は、同じファイルを ?fresh=… 付きで読み直して調べる
     （service-worker.js は ?fresh の付いた要求を素通しにする＝保存してある古い版を返さない）。
     起動した時・画面に戻った時（30分おき）・30分ごとに確かめる。
   ・起動した直後（と、30分以上離れてから戻った直後）に新しい版が見つかり、まだ画面を触っていなければ、
     帯を出さずにそのまま新しい版へ切り替える（2026-11-10）。Service Worker は保存してある版をまず表示するため、
     新しい版を公開した後の最初の起動では必ず前の版が出て、そのたびに帯が出ていた。切り替えは同じ版につき1回まで。
   ・新しい版があれば、画面の上端いっぱいに目立つ帯（新しいバージョンがあります。［最新に更新］✕）を出す
     （inacro-note.com の見せ方にならった）。✕で閉じると、その版はこのタブを開いている間は出さない。
   ・関連ツール一覧の下にはバージョン欄（最新版です／新版あり＋今すぐ更新／最新に更新／更新履歴）を出す（tools-drawer.js）。
   ・更新して新しい版で開いた最初の1回は「Ver.… に更新しました」と短く知らせる。
   「今すぐ更新」は js/refresh.js の refreshToLatest()（保存分を消して取り直す。利用者のデータは消さない）。
   ================================================================ */
import { CHANGELOG } from './changelog-data.js';
import { CURRENT_LANG, escapeHtml } from './i18n.js';
import { refreshToLatest, retryRefreshIfBehind } from './refresh.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
/** 版番号を数字の並びとして比べる（'2026.11.10.10' が '2026.11.10.9' より新しいと分かるように。文字の大小だと逆になる） */
export function compareVersion(a, b) {
  const pa = String(a || '').split('.').map(Number), pb = String(b || '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}
export const APP_VERSION = (CHANGELOG[0] && CHANGELOG[0].version) || '';
const SEEN_VERSION_KEY = 'sky_hub_seen_version'; // 端末で最後に開いたバージョン（更新した直後の知らせ用）
const DISMISS_KEY = 'sky_hub_update_dismissed'; // sessionStorage: 「あとで」を押した版
const CHECK_EVERY = 30 * 60 * 1000;

let remote = null; // 公開中の更新履歴（確かめられた時だけ）
let lastCheck = 0;
let checking = null;
let barObserver = null;
const AUTO_KEY = 'sky_hub_auto_applied'; // sessionStorage: 起動直後に自動で切り替えた版（同じ版で繰り返さない）
const AUTO_WINDOW = 10000; // 起動・復帰から何ミリ秒までに見つかった版を自動で切り替えるか
let autoUntil = 0;
let touched = false;
function armAutoApply() { autoUntil = Date.now() + AUTO_WINDOW; touched = false; }
// 起動直後に新しい版が見つかり、まだ画面を触っていなければ、帯を出さずに切り替える
function maybeAutoApply() {
  const list = pendingVersions();
  if (!list.length || touched || Date.now() > autoUntil) return false;
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return false;
  const v = list[0].version;
  try {
    if (sessionStorage.getItem(AUTO_KEY) === v) return false;
    sessionStorage.setItem(AUTO_KEY, v);
  } catch (e) { return false; }
  autoUntil = 0;
  refreshToLatest(v);
  return true;
}
let status = ''; // '' | 'checking' | 'latest' | 'stale' | 'error'（関連ツール一覧の下のバージョン欄に出す）
const listeners = new Set();

export const TYPE_LABEL = {
  new: { ja: '新機能', en: 'New' },
  improve: { ja: '改善', en: 'Improved' },
  fix: { ja: '修正', en: 'Fixed' },
  remove: { ja: '削除', en: 'Removed' },
};
export function typeLabel(type) { const l = TYPE_LABEL[type] || TYPE_LABEL.improve; return t(l.ja, l.en); }

/** 今動いている版より新しい版の一覧（新しい順）。確かめていない・無い時は [] */
export function pendingVersions() {
  if (!remote) return [];
  return remote.filter(v => v && typeof v.version === 'string' && compareVersion(v.version, APP_VERSION) > 0);
}
/** 最後に確かめた結果（'checking'・'latest'・'stale'・'error'。まだなら ''） */
export function updateStatus() { return status; }
/** 表示用の更新履歴: 公開中の最新が取れていればそれ、無ければ同梱分 */
export function changelogList() { return pendingVersions().length ? remote : CHANGELOG; }
export function onUpdateChanged(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach(fn => { try { fn(); } catch (e) { /* noop */ } }); }

/** 公開中の最新版を確かめる（force=false なら30分以内の再確認はしない） */
export function checkForUpdate(force = false) {
  if (checking) return checking;
  if (!force && Date.now() - lastCheck < CHECK_EVERY) return Promise.resolve(pendingVersions());
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve(pendingVersions());
  lastCheck = Date.now();
  status = 'checking';
  emit();
  // 30分ごとに変わる値を付ける（毎回ちがうURLにすると、読み込んだモジュールが溜まり続けるため）
  const stamp = force ? Date.now() : Math.floor(Date.now() / CHECK_EVERY);
  checking = import(`./changelog-data.js?fresh=${stamp}`)
    .then(m => {
      if (Array.isArray(m.CHANGELOG)) {
        remote = m.CHANGELOG;
        status = pendingVersions().length ? 'stale' : 'latest';
        if (maybeAutoApply()) return pendingVersions();
        renderBanner();
        emit();
      }
      return pendingVersions();
    })
    .catch(() => { status = 'error'; emit(); return pendingVersions(); })
    .finally(() => { checking = null; });
  return checking;
}

function dismissedVersion() { try { return sessionStorage.getItem(DISMISS_KEY) || ''; } catch (e) { return ''; } }

/** 画面の上端の帯（新しい版があるとき）。inacro-note.com と同じく「新しいバージョンがあります。［最新に更新］✕」の1行 */
function bannerHtml(list) {
  return `<span class="hub-update-ic" aria-hidden="true"><svg class="inline-icon" width="16" height="16"><use href="#i-sparkle"/></svg></span>
    <span class="hub-update-msg">${t('新しいバージョンがあります。', 'A new version is available.')}<button type="button" class="hub-update-ver" data-open-changelog>Ver.${escapeHtml(list[0].version)}<span>${t('の内容', ' notes')}</span></button></span>
    <button type="button" class="hub-update-btn" data-act="update">${t('最新に更新', 'Update')}</button>
    <button type="button" class="hub-update-close" data-act="later" aria-label="${t('閉じる', 'Close')}"><svg class="inline-icon" width="13" height="13"><use href="#i-close"/></svg></button>`;
}

/** 新しい版があれば画面の上端に帯を出す（✕で閉じた版なら、このタブを開いている間は出さない） */
function renderBanner() {
  const list = pendingVersions();
  let el = document.getElementById('hubUpdateBanner');
  if (!list.length || dismissedVersion() === list[0].version) { if (el) closeBanner(el); return; }
  if (!el) {
    el = document.createElement('div');
    el.id = 'hubUpdateBanner';
    el.className = 'hub-update-banner';
    el.setAttribute('role', 'alert');
    el.addEventListener('click', onBannerClick);
    document.body.prepend(el);
    // ワイド画面の左右のパネル（固定配置）は、帯の高さぶん下げる（css/chrome.css の --update-bar-h）
    if (typeof ResizeObserver !== 'undefined') {
      barObserver = new ResizeObserver(() => document.documentElement.style.setProperty('--update-bar-h', `${el.offsetHeight}px`));
      barObserver.observe(el);
    }
  }
  el.classList.remove('out');
  el.innerHTML = bannerHtml(list);
}
function closeBanner(el) {
  el.classList.add('out');
  setTimeout(() => {
    if (!el.classList.contains('out')) return;
    if (barObserver) { barObserver.disconnect(); barObserver = null; }
    document.documentElement.style.removeProperty('--update-bar-h');
    el.remove();
  }, 220);
}
function onBannerClick(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const el = e.currentTarget;
  if (btn.dataset.act === 'update') {
    btn.disabled = true;
    btn.textContent = t('更新中…', 'Updating…');
    startUpdate();
  } else if (btn.dataset.act === 'later') {
    const list = pendingVersions();
    try { if (list[0]) sessionStorage.setItem(DISMISS_KEY, list[0].version); } catch (err) { /* noop */ }
    closeBanner(el);
  }
}

/** 更新履歴のポップアップを開く（features/changelog/changelog-view.js は開く時に読み込む） */
export function openChangelog() {
  import('../features/changelog/changelog-view.js').then(m => m.open()).catch(() => {});
}

/** 新しい版へ切り替える（読み込み直し） */
export function startUpdate() { const p = pendingVersions(); refreshToLatest(p[0] && p[0].version); }

/** 起動時に1回呼ぶ。更新した直後の最初の起動なら「Ver.… に更新しました」を出して true を返す */
export function initAppUpdate() {
  let shown = false;
  // 「最新に更新」で目指した版にまだなっていなければ、1回だけ自動でやり直す
  if (retryRefreshIfBehind(APP_VERSION, compareVersion)) return true;
  try {
    const seen = localStorage.getItem(SEEN_VERSION_KEY);
    if (seen && APP_VERSION && compareVersion(seen, APP_VERSION) < 0) { showUpdatedToast(); shown = true; }
    if (APP_VERSION && (!seen || compareVersion(seen, APP_VERSION) < 0)) localStorage.setItem(SEEN_VERSION_KEY, APP_VERSION);
  } catch (e) { /* noop */ }
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { touched = true; }, { capture: true, passive: true }));
  armAutoApply();
  checkForUpdate(true);
  setInterval(() => checkForUpdate(), CHECK_EVERY);
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    // 30分以上離れてから戻った時は、起動した時と同じに扱う（ホーム画面のアプリは閉じずに戻ることが多い）
    if (hiddenAt && Date.now() - hiddenAt >= CHECK_EVERY) { armAutoApply(); checkForUpdate(true); } else checkForUpdate();
  });
  window.addEventListener('online', () => checkForUpdate(true));
  // data-open-changelog の付いたボタン（上端の帯・関連ツール一覧の下・更新直後のトースト）で更新履歴を開く
  document.addEventListener('click', e => {
    if (e.target.closest && e.target.closest('[data-open-changelog]')) openChangelog();
  });
  return shown;
}

function showUpdatedToast() {
  const el = document.createElement('div');
  el.className = 'hub-updated-toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `<svg class="inline-icon" width="16" height="16" aria-hidden="true"><use href="#i-check"/></svg>
    <span>${t(`Ver.${escapeHtml(APP_VERSION)} に更新しました`, `Updated to Ver.${escapeHtml(APP_VERSION)}`)}</span>
    <button type="button" data-open-changelog>${t('更新内容', 'What’s new')}</button>`;
  document.body.appendChild(el);
  const hide = () => { el.classList.add('out'); setTimeout(() => el.remove(), 260); };
  el.querySelector('button').addEventListener('click', hide);
  setTimeout(hide, 6500);
}

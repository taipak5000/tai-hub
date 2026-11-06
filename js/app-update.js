/* ================================================================
   🆕 新しいバージョンのお知らせ（更新履歴 js/changelog-data.js と組み）。
   ・今動いているバージョン＝読み込んだ changelog-data.js の先頭の version。
   ・公開中の最新版は、同じファイルを ?fresh=… 付きで読み直して調べる
     （service-worker.js は ?fresh の付いた要求を素通しにする＝保存してある古い版を返さない）。
     起動の数秒後・画面に戻った時（30分おき）・30分ごとに確かめる。
   ・新しい版があれば、画面の下に目立つお知らせ（今すぐ更新／更新内容）を出す。「あとで」で閉じると、
     その版についてはこのタブを開いている間は出さない（次に開いた時はまた出す）。
   ・更新して新しい版で開いた最初の1回は「Ver.… に更新しました」と短く知らせる。
   「今すぐ更新」は js/refresh.js の refreshToLatest()（保存分を消して取り直す。利用者のデータは消さない）。
   ================================================================ */
import { CHANGELOG } from './changelog-data.js';
import { CURRENT_LANG, escapeHtml } from './i18n.js';
import { refreshToLatest } from './refresh.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
export const APP_VERSION = (CHANGELOG[0] && CHANGELOG[0].version) || '';
const SEEN_VERSION_KEY = 'sky_hub_seen_version'; // 端末で最後に開いたバージョン（更新した直後の知らせ用）
const DISMISS_KEY = 'sky_hub_update_dismissed'; // sessionStorage: 「あとで」を押した版
const CHECK_EVERY = 30 * 60 * 1000;

let remote = null; // 公開中の更新履歴（確かめられた時だけ）
let lastCheck = 0;
let checking = null;
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
  return remote.filter(v => v && typeof v.version === 'string' && v.version > APP_VERSION);
}
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
  // 30分ごとに変わる値を付ける（毎回ちがうURLにすると、読み込んだモジュールが溜まり続けるため）
  const stamp = force ? Date.now() : Math.floor(Date.now() / CHECK_EVERY);
  checking = import(`./changelog-data.js?fresh=${stamp}`)
    .then(m => {
      if (Array.isArray(m.CHANGELOG)) {
        remote = m.CHANGELOG;
        renderBanner();
        emit();
      }
      return pendingVersions();
    })
    .catch(() => pendingVersions())
    .finally(() => { checking = null; });
  return checking;
}

function dismissedVersion() { try { return sessionStorage.getItem(DISMISS_KEY) || ''; } catch (e) { return ''; } }

function countByType(list) {
  const c = {};
  list.forEach(v => (v.items || []).forEach(i => { c[i.type] = (c[i.type] || 0) + 1; }));
  return c;
}

function bannerHtml(list) {
  const latest = list[0];
  const counts = countByType(list);
  const summary = ['new', 'improve', 'fix', 'remove'].filter(k => counts[k]).map(k => `<span class="hub-update-count is-${k}">${escapeHtml(typeLabel(k))} ${counts[k]}</span>`).join('');
  const heads = list.flatMap(v => v.items || []).filter(i => i.type === 'new').concat(list.flatMap(v => v.items || []).filter(i => i.type !== 'new')).slice(0, 2);
  return `<div class="hub-update-main">
      <span class="hub-update-ic" aria-hidden="true"><svg class="inline-icon" width="20" height="20"><use href="#i-sparkle"/></svg></span>
      <div class="hub-update-text">
        <p class="hub-update-title">${t('新しいバージョンがあります', 'A new version is available')}<span class="hub-update-ver">Ver.${escapeHtml(latest.version)}</span></p>
        ${summary ? `<p class="hub-update-counts">${summary}</p>` : ''}
        ${heads.length ? `<ul class="hub-update-heads">${heads.map(i => `<li>${escapeHtml(t(i.ja, i.en || i.ja))}</li>`).join('')}</ul>` : ''}
      </div>
      <button type="button" class="hub-update-close" data-act="later" aria-label="${t('あとで', 'Later')}"><svg class="inline-icon" width="14" height="14"><use href="#i-close"/></svg></button>
    </div>
    <div class="hub-update-actions">
      <button type="button" class="hub-update-btn primary" data-act="update"><svg class="inline-icon" width="15" height="15"><use href="#i-sync"/></svg>${t('今すぐ更新', 'Update now')}</button>
      <a class="hub-update-btn" href="#/changelog" data-act="log">${t('更新内容を見る', 'What’s new')}</a>
    </div>
    <p class="hub-update-note">${t('保存したデータは消えません', 'Your saved data is kept')}</p>`;
}

/** 新しい版があれば画面の下にお知らせを出す（「あとで」で閉じた版なら出さない） */
function renderBanner() {
  const list = pendingVersions();
  let el = document.getElementById('hubUpdateBanner');
  // 更新履歴の画面には同じ内容の案内が上にあるので、下のお知らせは出さない
  const onLog = /^#\/changelog\b/.test(location.hash);
  if (!list.length || onLog || dismissedVersion() === list[0].version) { if (el) closeBanner(el); return; }
  if (!el) {
    el = document.createElement('section');
    el.id = 'hubUpdateBanner';
    el.className = 'hub-update-banner';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.addEventListener('click', onBannerClick);
    document.body.appendChild(el);
  }
  el.classList.remove('out');
  el.innerHTML = bannerHtml(list);
}
function closeBanner(el) {
  el.classList.add('out');
  setTimeout(() => { if (el.classList.contains('out')) el.remove(); }, 260);
}
function onBannerClick(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const el = e.currentTarget;
  const act = btn.dataset.act;
  if (act === 'update') {
    btn.disabled = true;
    btn.lastChild.textContent = t('更新しています…', 'Updating…');
    startUpdate();
  } else if (act === 'later') {
    const list = pendingVersions();
    try { if (list[0]) sessionStorage.setItem(DISMISS_KEY, list[0].version); } catch (err) { /* noop */ }
    closeBanner(el);
  }
  // 「更新内容を見る」はふつうのリンク（#/changelog）。開くとこのお知らせは隠れる（hashchange）
}

/** 新しい版へ切り替える（読み込み直し） */
export function startUpdate() { refreshToLatest(); }

/** 起動時に1回呼ぶ。更新した直後の最初の起動なら「Ver.… に更新しました」を出して true を返す */
export function initAppUpdate() {
  let shown = false;
  try {
    const seen = localStorage.getItem(SEEN_VERSION_KEY);
    if (seen && APP_VERSION && seen < APP_VERSION) { showUpdatedToast(); shown = true; }
    if (APP_VERSION && (!seen || seen < APP_VERSION)) localStorage.setItem(SEEN_VERSION_KEY, APP_VERSION);
  } catch (e) { /* noop */ }
  setTimeout(() => checkForUpdate(true), 4000);
  setInterval(() => checkForUpdate(), CHECK_EVERY);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });
  window.addEventListener('online', () => checkForUpdate(true));
  window.addEventListener('hashchange', () => { if (pendingVersions().length) renderBanner(); });
  return shown;
}

function showUpdatedToast() {
  const el = document.createElement('div');
  el.className = 'hub-updated-toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `<svg class="inline-icon" width="16" height="16" aria-hidden="true"><use href="#i-check"/></svg>
    <span>${t(`Ver.${escapeHtml(APP_VERSION)} に更新しました`, `Updated to Ver.${escapeHtml(APP_VERSION)}`)}</span>
    <a href="#/changelog">${t('更新内容', 'What’s new')}</a>`;
  document.body.appendChild(el);
  const hide = () => { el.classList.add('out'); setTimeout(() => el.remove(), 260); };
  el.querySelector('a').addEventListener('click', hide);
  setTimeout(hide, 6500);
}

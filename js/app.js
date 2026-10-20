/* ================================================================
   起動処理：テーマ初期化・アイコンスプライト注入・chromeマウント・
   router.start()。
   ================================================================ */
import { applyThemeToDOM, resolveSkyTheme, getSkyThemeMode, pfDisplayName, ensureProfilesInit, getActiveProfileId, applyProfileTint, ACTIVE_PROFILE_KEY, SKY_THEME_KEY } from './state.js';
import { injectIconSprite } from './icon-sprite.js';
import { initRouter, startRouter } from './router.js';
import { initShortcuts } from './shortcuts.js';
import * as siteDock from './chrome/site-dock.js';
import * as sidePanels from './chrome/side-panels.js';
import { initTheme } from './theme.js';
import { initSheetEngine } from './sheet-engine.js';

// 🩹 applyThemeToDOM(isDark)は真偽値を受け取る（'light'/'dark'の文字列をそのまま
// 渡すと、'light'も空でない文字列なので常にtruthy判定され、常にダークになって
// しまうバグがあった。resolveSkyTheme()の返り値は必ず==='dark'で真偽値化すること
// ——state.jsのtoggleTheme()と同じ規約）
applyThemeToDOM(resolveSkyTheme(getSkyThemeMode() === 'system' ? null : getSkyThemeMode()) === 'dark');
injectIconSprite();
initTheme(); // 🎨 着せ替え（保存済みなら配色・壁紙・きらめきを反映。ライト/ダーク切替にも追従）
initShortcuts();
initSheetEngine(); // ボトムシートのドラッグ/フリックで閉じる＋モーダルのフォーカストラップ

const dockMount = document.getElementById('dock-root');
siteDock.render(dockMount);
sidePanels.init(); // ワイド画面: 関連ツール(左端)・ダッシュボード(右端)の常設パネル
const activeProfile = ensureProfilesInit().find(p => p.id === getActiveProfileId());
siteDock.refreshProfileLabel(pfDisplayName(activeProfile));
applyProfileTint(activeProfile && activeProfile.color); // 🎨 起動時、選択中プロフィールのアカウントカラーを反映

initRouter(document.getElementById('app-root'));
startRouter();

// 🔁 別タブ・別サイトでの変更に追従する（storageイベントは変更した当のタブでは発火しない）。
//  ・選択中のプロフィールが切り替えられた → このタブの表示・保存先が古くならないよう再読み込み
//  ・プロフィール名/アカウントカラーの編集 → ドックの名前とティントを更新
//  ・テーマ（ライト/ダーク/システム）の変更 → 即座に反映
window.addEventListener('storage', (e) => {
  if (e.key === ACTIVE_PROFILE_KEY) { location.reload(); return; }
  if (e.key === 'skyProfiles_v1') {
    const p = ensureProfilesInit().find(x => x.id === getActiveProfileId());
    siteDock.refreshProfileLabel(pfDisplayName(p));
    applyProfileTint(p && p.color);
  }
  if (e.key === SKY_THEME_KEY) applyThemeToDOM(resolveSkyTheme(getSkyThemeMode() === 'system' ? null : getSkyThemeMode()) === 'dark');
});

// 🔔 通知リマインダー: 以前オプトインして通知が許可済みの時だけ、起動時にバックグラウンドの
// チェックを始める（ダッシュボードを一度も開かなくても通知が届くように。許可の新規リクエストは
// 絶対に出さない）。無効・未許可の端末ではevent-dashboard.js自体を読み込まない（起動を重くしない）。
try {
  if (localStorage.getItem('sky_dash_reminder_enabled') === '1' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    import('../features/shared/event-dashboard.js').then(m => m.startRemindersIfEnabled()).catch(() => {});
  }
} catch (e) { /* localStorageが使えない環境では何もしない */ }

// 🔔 ノマキャン計算機プロの通知（黒シャード発生前／デイリーリセット前）: オン＋許可済みの時だけ、
// 起動時に予約を始める（ハブは1つのタブで全ツールを行き来するため、ツールを開いていなくても届くように）。
try {
  const shardOn = localStorage.getItem('sky_shard_notify_enabled') === '1';
  const resetOn = localStorage.getItem('sky_dailyreset_notify_enabled') === '1';
  if ((shardOn || resetOn) && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    import('../features/tai-nomacan-pro/nomacan-pro-notify.js').then(m => m.startIfEnabled()).catch(() => {});
  }
} catch (e) { /* localStorageが使えない環境では何もしない */ }

// 📲 Service Worker（オフライン対応・起動の高速化。service-worker.js、stale-while-revalidate方式）。
// 開発中に「更新したのに古い画面が出る」混乱を避けるため、localhost系では ?sw=1 を付けた時だけ登録する。
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if (!isLocal || /[?&]sw=1\b/.test(location.search)) {
    const registerSw = () => navigator.serviceWorker.register('service-worker.js').catch(err => console.warn('service worker registration failed', err));
    if (document.readyState === 'complete') registerSw();
    else window.addEventListener('load', registerSw);
  }
}

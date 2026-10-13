/* ================================================================
   起動処理：テーマ初期化・アイコンスプライト注入・chromeマウント・
   router.start()。
   ================================================================ */
import { applyThemeToDOM, resolveSkyTheme, getSkyThemeMode, pfDisplayName, ensureProfilesInit, getActiveProfileId, applyProfileTint } from './state.js';
import { injectIconSprite } from './icon-sprite.js';
import { initRouter, startRouter } from './router.js';
import { initShortcuts } from './shortcuts.js';
import * as siteDock from './chrome/site-dock.js';
import { initTheme } from './theme.js';

// 🩹 applyThemeToDOM(isDark)は真偽値を受け取る（'light'/'dark'の文字列をそのまま
// 渡すと、'light'も空でない文字列なので常にtruthy判定され、常にダークになって
// しまうバグがあった。resolveSkyTheme()の返り値は必ず==='dark'で真偽値化すること
// ——state.jsのtoggleTheme()と同じ規約）
applyThemeToDOM(resolveSkyTheme(getSkyThemeMode() === 'system' ? null : getSkyThemeMode()) === 'dark');
injectIconSprite();
initTheme(); // 🎨 着せ替え（保存済みなら配色・壁紙・きらめきを反映。ライト/ダーク切替にも追従）
initShortcuts();

const dockMount = document.getElementById('dock-root');
siteDock.render(dockMount);
const activeProfile = ensureProfilesInit().find(p => p.id === getActiveProfileId());
siteDock.refreshProfileLabel(pfDisplayName(activeProfile));
applyProfileTint(activeProfile && activeProfile.color); // 🎨 起動時、選択中プロフィールのアカウントカラーを反映

initRouter(document.getElementById('app-root'));
startRouter();

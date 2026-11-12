/* ================================================================
   👋 はじめて使う人への案内（2026-11-12）。
   ・ダッシュボード（features/shared/event-dashboard.js）の先頭に、短いあいさつと主なツールへの入口を1回だけ出す。
     出すのは「今のプロフィールにまだ記録が何も無い」時だけ（すでに使っている人の画面は変えない）。
     ×で閉じると、そのプロフィールでは二度と出さない（welcomeDismissed_v1。nsKey）。
   ・サンプルのデータを入れることはしない（表示で案内するだけ）。
   ・各ツールの空の時の案内（アイテム所持管理の達成率・エモートの所持率）は、それぞれのツールのファイルに書いてある。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from './i18n.js';
import { nsKey } from './state.js';
import { navigate } from './router.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
const DISMISS_KEY = 'welcomeDismissed_v1';
// 記録とみなすキー（プロフィールごとのデータ）。表示の設定や、この案内・達成率の記録のように自動で作られるものは数えない
const DATA_KEY = /^(gameItems_(?!viewMode|gridCols)|emote|wing|skyNomacan|nomacan|starCandle|spiritCatalog|companion|share|taiCard|tai_card|friendsDoc|coordDiary|dailyCheck|bingo|musicSheets|itemAcquireLog|wish_|wishPlan|revisitWaitlist|tsts|score)/i;

function profileSuffix() {
  const probe = nsKey('x');
  return probe === 'x' ? '' : probe.slice(1); // 既定のプロフィールは接尾辞なし、それ以外は「__p_<id>」
}

/** 今のプロフィールに、何か記録が残っているか */
export function profileHasData() {
  const suffix = profileSuffix();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (suffix ? !key.endsWith(suffix) : key.includes('__p_')) continue;
    const raw = suffix ? key.slice(0, -suffix.length) : key;
    if (!DATA_KEY.test(raw)) continue;
    const val = localStorage.getItem(key) || '';
    if (raw.startsWith('gameItems_')) {
      try { if (Object.values(JSON.parse(val).itemOwned || {}).some(Boolean)) return true; } catch (e) { /* 壊れた値は数えない */ }
      continue;
    }
    if (val && val !== '{}' && val !== '[]' && val !== 'null') return true;
  }
  return false;
}

export function shouldWelcome() {
  try { if (localStorage.getItem(nsKey(DISMISS_KEY))) return false; } catch (e) { return false; }
  return !profileHasData();
}

const TOOLS = [
  { route: 'item', icon: 'i-folder', ja: 'アイテム所持管理', en: 'Item Tracker', subJa: '持っている服や家具にチェック', subEn: 'Check off cosmetics you own' },
  { route: 'tai-nomacan', icon: 'i-candle', ja: 'ノマキャン計算機', en: 'Candle Calculator', subJa: 'キャンドル集めの記録と予想', subEn: 'Log candles and forecast your goal' },
  { route: 'wings', icon: 'i-wing', ja: '羽トラッカー', en: 'Wing Tracker', subJa: '光の翼を季節・精霊ごとに記録', subEn: 'Track Winged Light by season and spirit' },
];

const STYLE_ID = 'hub-welcome-styles';
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement('style');
  st.id = STYLE_ID;
  st.textContent = `
.hub-welcome { position: relative; margin: 0 0 16px; padding: 14px 14px 10px; border-radius: var(--hub-r-sm, 10px); background: var(--hub-accent-bg); }
.hub-welcome h3 { margin: 0 32px 4px 0; font-size: 15px; font-weight: 700; letter-spacing: -0.01em; color: var(--hub-text); }
.hub-welcome p { margin: 0 0 8px; font-size: 12.5px; line-height: 1.6; color: var(--hub-text-2); }
.hub-welcome-close { position: absolute; top: 6px; right: 6px; width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 9px; background: none; color: var(--hub-text-2); cursor: pointer; }
.hub-welcome-close .inline-icon { stroke: currentColor; }
.hub-welcome-tool { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 8px 10px; margin-top: 6px; border: 0; border-radius: 10px; background: var(--hub-card); color: var(--hub-text); font: inherit; text-align: left; cursor: pointer; }
.hub-welcome-tool .inline-icon { flex-shrink: 0; stroke: var(--hub-accent-ink, var(--hub-accent)); }
.hub-welcome-tool b { display: block; font-size: 13.5px; font-weight: 600; }
.hub-welcome-tool small { display: block; font-size: 11.5px; color: var(--hub-text-2); }
.hub-welcome-tool:active { transform: scale(0.98); }
@media (prefers-reduced-motion: reduce) { .hub-welcome-tool:active { transform: none; } }
@media (prefers-contrast: more) { .hub-welcome { outline: 1px solid var(--hub-text-2); } }
`;
  document.head.appendChild(st);
}

/** el の先頭に、必要な時だけあいさつを出す */
export function mountWelcome(el) {
  if (!el) return;
  el.querySelector(':scope > .hub-welcome')?.remove();
  if (!shouldWelcome()) return;
  injectStyles();
  const box = document.createElement('section');
  box.className = 'hub-welcome';
  box.setAttribute('aria-labelledby', 'hubWelcomeTitle');
  box.innerHTML = `
    <button type="button" class="hub-welcome-close" data-welcome="close" aria-label="${t('閉じる（もう出しません）', 'Close (won’t show again)')}"><svg class="inline-icon" width="16" height="16" aria-hidden="true"><use href="#i-close"/></svg></button>
    <h3 id="hubWelcomeTitle">${t('ようこそ', 'Welcome')}</h3>
    <p>${t('記録はこの端末の中にだけ保存されます。登録はいりません。まずは気になるツールから始めてみてください。', 'Everything is saved only on this device — no sign-up. Start with whichever tool you like.')}</p>
    ${TOOLS.map(x => `<button type="button" class="hub-welcome-tool" data-welcome="go" data-route="${x.route}">
      <svg class="inline-icon" width="20" height="20" aria-hidden="true"><use href="#${x.icon}"/></svg>
      <span><b>${escapeHtml(t(x.ja, x.en))}</b><small>${escapeHtml(t(x.subJa, x.subEn))}</small></span></button>`).join('')}`;
  box.addEventListener('click', e => {
    const b = e.target.closest('[data-welcome]');
    if (!b) return;
    if (b.dataset.welcome === 'close') {
      try { localStorage.setItem(nsKey(DISMISS_KEY), new Date().toISOString()); } catch (err) { /* noop */ }
      document.querySelectorAll('.hub-welcome').forEach(w => w.remove());
      return;
    }
    document.getElementById('dashModalOverlay')?.classList.remove('open');
    navigate(b.dataset.route, '');
  });
  el.prepend(box);
}

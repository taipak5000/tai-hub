/* ================================================================
   🔁 計算機への一回限りの受け渡し（精霊ツリー管理の「残りコスト」→ノマキャン計算機・星のキャンドル計算機）
   - 送る側: writeCalcHandoff('candle' | 'ascended', 本数) を書いてから location.hash で移る。
   - 受け取る側: マウント時に takeCalcHandoff(自分の通貨) を呼ぶ。合う物があればその場でキーを消して返す。
     10分より古い物・壊れた物は消して無視する。別の計算機あての物は、その計算機のために残す（古くなれば次に消える）。
   - 計算機の値は、利用者がバナーで承諾した時だけ書き換える（無言で上書きしない）。
   ================================================================ */
import { nsKey } from '../../js/state.js';
import { escapeHtml } from '../../js/i18n.js';

const KEY_RAW = 'taiHubCalcHandoff_v1';
const MAX_AGE_MS = 10 * 60 * 1000;
const STYLE_ID = 'hub-calc-handoff-style';

export function writeCalcHandoff(currency, amount) {
  const n = Math.max(0, Math.round(Number(amount) || 0));
  try {
    localStorage.setItem(nsKey(KEY_RAW), JSON.stringify({ kind: 'spirit-remaining', currency, amount: n, at: Date.now() }));
  } catch (e) { /* 保存できなければ受け渡しなしで移るだけ */ }
}

/** currency が合う受け渡しを取り出して消す。無ければ null。 */
export function takeCalcHandoff(currency) {
  const key = nsKey(KEY_RAW);
  let raw = null;
  try { raw = localStorage.getItem(key); } catch (e) { return null; }
  if (!raw) return null;
  let p = null;
  try { p = JSON.parse(raw); } catch (e) { p = null; }
  const valid = p && p.kind === 'spirit-remaining' && (p.currency === 'candle' || p.currency === 'ascended')
    && Number.isFinite(p.amount) && p.amount >= 0 && Number.isFinite(p.at);
  const fresh = valid && Date.now() - p.at <= MAX_AGE_MS && Date.now() - p.at >= -60000;
  if (!fresh) { try { localStorage.removeItem(key); } catch (e) { /* noop */ } return null; }
  if (p.currency !== currency) return null;
  try { localStorage.removeItem(key); } catch (e) { /* noop */ }
  return { amount: Math.round(p.amount) };
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_ID;
  link.rel = 'stylesheet';
  link.href = new URL('../../css/calc-handoff.css', import.meta.url).href;
  document.head.appendChild(link);
}

/**
 * 取り込みバナーを beforeEl の直前に出す。承諾で onAccept()、「やめる」で何もせず閉じる。
 * @returns {HTMLElement} バナー要素
 */
export function showHandoffBanner(beforeEl, { message, acceptLabel, dismissLabel, onAccept }) {
  ensureStyle();
  const el = document.createElement('div');
  el.className = 'hub-handoff-banner';
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <div class="hub-handoff-text">${escapeHtml(message)}</div>
    <div class="hub-handoff-actions">
      <button type="button" class="hub-handoff-btn is-ok">${escapeHtml(acceptLabel)}</button>
      <button type="button" class="hub-handoff-btn is-dismiss">${escapeHtml(dismissLabel)}</button>
    </div>`;
  el.querySelector('.is-ok').addEventListener('click', () => { el.remove(); onAccept(); });
  el.querySelector('.is-dismiss').addEventListener('click', () => el.remove());
  beforeEl.parentNode.insertBefore(el, beforeEl);
  // 前の画面のスクロール位置のまま開くことがあるので、バナーが見える所まで寄せる
  requestAnimationFrame(() => { try { el.scrollIntoView({ block: 'center' }); } catch (e) { /* noop */ } });
  return el;
}

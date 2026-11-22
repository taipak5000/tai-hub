/* ================================================================
   🔁 ほしいもの計画 → ノマキャン計算機プロ の一回限りの受け渡し（目標ラインの表示用）
   - 送る側（features/wish-plan）: writeWishHandoff() を書いてから #/tai-nomacan-pro へ移る。
   - 受け取る側（features/tai-nomacan-pro）: マウント時に takeWishHandoff() を呼ぶ。新しい物ならキーを消して返す。
     10分より古い物・壊れた物は消して無視する。
   - 計算機の保存データには書かない。受け取った値は、その画面を開いている間の表示（到達予定日）だけに使う。
   ⚠️ 精霊ツリー管理→計算機の受け渡し（calc-handoff.js の taiHubCalcHandoff_v1）とは別のキーにしてある。
      あちらの受け手は知らない kind を古い物として消すので、同じキーに混ぜると受け渡しが消える。
   ================================================================ */
import { nsKey } from '../../js/state.js';

const KEY_RAW = 'taiHubWishHandoff_v1';
const MAX_AGE_MS = 10 * 60 * 1000;

export function writeWishHandoff({ currentCandles, needCandle, itemName }) {
  const need = Math.max(0, Math.round(Number(needCandle) || 0));
  const cur = Math.max(0, Math.round(Number(currentCandles) || 0));
  try {
    localStorage.setItem(nsKey(KEY_RAW), JSON.stringify({
      kind: 'wish-goal', targetTotal: cur + need, needCandle: need, itemName: String(itemName || '').slice(0, 80), at: Date.now(),
    }));
  } catch (e) { /* 保存できなければ受け渡しなしで移るだけ */ }
}

/** 新しい受け渡しがあれば取り出して消す。無ければ null */
export function takeWishHandoff() {
  const key = nsKey(KEY_RAW);
  let raw = null;
  try { raw = localStorage.getItem(key); } catch (e) { return null; }
  if (!raw) return null;
  let p = null;
  try { p = JSON.parse(raw); } catch (e) { p = null; }
  try { localStorage.removeItem(key); } catch (e) { /* noop */ }
  const valid = p && p.kind === 'wish-goal' && Number.isFinite(p.targetTotal) && p.targetTotal >= 0
    && Number.isFinite(p.needCandle) && p.needCandle >= 0 && Number.isFinite(p.at) && typeof p.itemName === 'string';
  if (!valid) return null;
  const age = Date.now() - p.at;
  if (age > MAX_AGE_MS || age < -60000) return null;
  return { targetTotal: Math.round(p.targetTotal), needCandle: Math.round(p.needCandle), itemName: p.itemName };
}

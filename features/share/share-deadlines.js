/* ================================================================
   創作物管理ツールの「期限が近い創作物」を、ツールを開かずに数える。
   お知らせ（js/notices.js）が起動時から使うので、Vueや画面の本体
   （share-view.js）は読み込まない小さなモジュールにしてある。
   日数の数え方は share-view.js の getDaysLeft() と同じ（設置日から14日後の
   日付まで、端末の日付で数える。0＝今日消える）。
   ================================================================ */
import { nsKey } from '../../js/state.js';

export const SHARE_STORAGE_KEY = 'sky_tracker_storage';
export const SHARE_LIFETIME_DAYS = 14;
export const SHARE_SOON_DAYS = 3; // 画面の「期限間近」と同じ（3日以内）

export function shareDaysLeft(placedDate, now = new Date()) {
  const expiry = new Date(placedDate);
  expiry.setDate(expiry.getDate() + SHARE_LIFETIME_DAYS);
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const expiryUTC = Date.UTC(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  return Math.ceil((expiryUTC - todayUTC) / 86400000);
}

/** 期限間近（一時停止中を除き、残り0〜3日）の創作物を、残りの少ない順に返す。 */
export function expiringSoonCreations(now = new Date()) {
  let items = [];
  try {
    const doc = JSON.parse(localStorage.getItem(nsKey(SHARE_STORAGE_KEY)));
    if (doc && Array.isArray(doc.placedItems)) items = doc.placedItems;
  } catch (e) { return []; }
  const out = [];
  items.forEach(it => {
    if (!it || typeof it !== 'object' || it.isSuspended || !it.placedDate) return;
    const placed = new Date(it.placedDate);
    if (isNaN(placed.getTime())) return;
    const days = shareDaysLeft(placed, now);
    if (days < 0 || days > SHARE_SOON_DAYS) return;
    const expiry = new Date(placed);
    expiry.setDate(expiry.getDate() + SHARE_LIFETIME_DAYS);
    out.push({ id: String(it.id || ''), memo: typeof it.memo === 'string' ? it.memo.trim() : '', days, expiry });
  });
  return out.sort((a, b) => a.days - b.days);
}

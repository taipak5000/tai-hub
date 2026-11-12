/* ================================================================
   📈 アイテム所持率の記録（2026-11-12）。
   アイテム所持管理の所持チェックを変えるたびに、その日の達成率（全体とカテゴリ別）を1件だけ記録する。
   ・保存: collectionHistory_v1（プロフィールごと＝nsKey）に
     [{ date: 'YYYY-MM-DD', owned, total, cats: { <カテゴリ>: [所持数, 総数] } }] を古い順に持つ。
     同じ日の分は上書きし、365日より前の分は消す（履歴が増えすぎないように）。
   ・数え方はアイテム所持管理の「全体の達成率」と同じ: 楽譜を除く12カテゴリ、That Sky Shop は数えない（isCountableItem）。
   ・きっかけ: js/state.js の saveCategoryState() が 'hub-collection-changed' を送る。ここで1.5秒まとめてから記録する。
   ・表示はアイテム所持管理のトップ（features/item/history-chart.js）と、ふりかえりの月ごと（features/recap/）。
   ================================================================ */
import { nsKey, getCategoryState, isCountableItem } from './state.js';
import { CATEGORY_REGISTRY } from '../features/item/data/categories.js';

export const HISTORY_KEY = 'collectionHistory_v1';
export const HISTORY_CATS = CATEGORY_REGISTRY.filter(c => c.section !== 'special');
const KEEP_DAYS = 365;
const itemsCache = new Map();

function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 記録の一覧（古い順）。壊れていれば [] */
export function readHistory() {
  try {
    const v = JSON.parse(localStorage.getItem(nsKey(HISTORY_KEY)));
    return Array.isArray(v) ? v.filter(r => r && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && Number.isFinite(r.total)) : [];
  } catch (e) { return []; }
}

async function countableItems(key) {
  if (!itemsCache.has(key)) {
    itemsCache.set(key, import(`../features/item/data/items/${key}.js`)
      .then(m => (Array.isArray(m.ITEMS) ? m.ITEMS : []).filter(isCountableItem))
      .catch(() => []));
  }
  return itemsCache.get(key);
}

/** 今の所持数（{ owned, total, cats: { <カテゴリ>: [所持数, 総数] } }）。シェア画像（js/share-card.js）でも使う */
export async function currentCounts() {
  const cats = {};
  let owned = 0, total = 0;
  for (const c of HISTORY_CATS) {
    const items = await countableItems(c.key);
    const st = getCategoryState(c.key).owned;
    const o = items.filter(it => st[it.id]).length;
    cats[c.key] = [o, items.length];
    owned += o; total += items.length;
  }
  return { owned, total, cats };
}

/** 今日の分を記録する（同じ日は上書き） */
export async function recordSnapshot() {
  const { owned, total, cats } = await currentCounts();
  if (!total) return;
  const today = localDate();
  const cutoff = localDate(new Date(Date.now() - KEEP_DAYS * 86400000));
  const list = readHistory().filter(r => r.date !== today && r.date >= cutoff);
  list.push({ date: today, owned, total, cats });
  list.sort((a, b) => (a.date < b.date ? -1 : 1));
  try { localStorage.setItem(nsKey(HISTORY_KEY), JSON.stringify(list)); } catch (e) { /* 容量不足などは記録をあきらめる */ }
  document.dispatchEvent(new CustomEvent('hub-collection-history'));
}

let timer = null;
let started = false;
/** js/app.js が起動時に1回呼ぶ */
export function initCollectionHistory() {
  if (started) return;
  started = true;
  document.addEventListener('hub-collection-changed', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { recordSnapshot().catch(() => {}); }, 1500);
  });
}

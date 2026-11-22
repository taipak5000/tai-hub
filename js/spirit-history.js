/* ================================================================
   🌳 精霊ツリーの達成率の記録（js/collection-history.js と同じ方式）。
   ・保存: spiritCatalogHistory_v1（プロフィールごと＝nsKey）に
     [{ date: 'YYYY-MM-DD', doneNodes, totalNodes, doneSpirits, totalSpirits }] を古い順に持つ。
     同じ日の分は上書きし、365日より前の分は消す。
   ・きっかけ: 精霊ツリー管理が集計（spiritCatalogStats_v1 の保存）をするたびに scheduleSpiritHistory() を呼ぶ。
     1.5秒まとめてから記録する。spiritCatalogStats_v1 そのものの形・読み手（ふりかえり・星紡ぎカード）は変えない。
   ・表示: 星紡ぎカードの「入手の推移」の1本（features/tai-card）。
   ================================================================ */
import { nsKey } from './state.js';

export const SPIRIT_HISTORY_KEY = 'spiritCatalogHistory_v1';
const KEEP_DAYS = 365;

function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 記録の一覧（古い順）。壊れていれば [] */
export function readSpiritHistory() {
  try {
    const v = JSON.parse(localStorage.getItem(nsKey(SPIRIT_HISTORY_KEY)));
    return Array.isArray(v) ? v.filter(r => r && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && Number.isFinite(r.totalNodes) && r.totalNodes > 0) : [];
  } catch (e) { return []; }
}

/** 今日の分を記録する（同じ日は上書き） */
export function recordSpiritHistory(stats) {
  if (!stats || !(stats.totalNodes > 0)) return;
  const today = localDate();
  const cutoff = localDate(new Date(Date.now() - KEEP_DAYS * 86400000));
  const list = readSpiritHistory().filter(r => r.date !== today && r.date >= cutoff);
  list.push({
    date: today,
    doneNodes: stats.doneNodes | 0, totalNodes: stats.totalNodes | 0,
    doneSpirits: stats.doneSpirits | 0, totalSpirits: stats.totalSpirits | 0,
  });
  list.sort((a, b) => (a.date < b.date ? -1 : 1));
  try { localStorage.setItem(nsKey(SPIRIT_HISTORY_KEY), JSON.stringify(list)); } catch (e) { /* 容量不足などは記録をあきらめる */ }
}

let timer = null;
let pending = null;
/** 精霊ツリー管理の集計のたびに呼ぶ。1.5秒まとめてから最後の値で記録する */
export function scheduleSpiritHistory(stats) {
  pending = stats;
  clearTimeout(timer);
  timer = setTimeout(() => { const s = pending; pending = null; recordSpiritHistory(s); }, 1500);
}

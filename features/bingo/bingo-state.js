/* ================================================================
   週替わりビンゴのデータ（プロフィールごと＝nsKey）。
   週の区切りはゲームのウィークリーと同じ「太平洋時間の日曜0時」（日本時間で日曜16時・冬は17時）。

   weeklyBingo_v1: {
     size: 3|4|5,                 // マスの数（5は真ん中がフリー）
     useDefault: true,            // 用意したお題を使うか（false＝自分のお題だけ）
     custom: ['…'],               // 自分で足したお題
     week: { key: 'YYYY-MM-DD'（その週の日曜。太平洋時間）, size, cells: ['…'], marks: [0/1…], doneAt: {idx: ms} },
     history: { 'YYYY-MM-DD': { size, filled, lines } }   // 過去の週の結果（ふりかえり用。最大120週）
   }
   ================================================================ */
import { nsKey } from '../../js/state.js';
import { ptParts, ptToReal } from '../../js/pacific-time.js';

export const BINGO_KEY = 'weeklyBingo_v1';
export const FREE = '__free__';

export const DEFAULT_PROMPTS = [
  { ja: 'フレンドと手をつないで飛ぶ', en: 'Fly holding hands with a friend' },
  { ja: '大キャンドルを燃やす', en: 'Burn a big candle' },
  { ja: 'デイリークエストを全部クリア', en: 'Finish all daily quests' },
  { ja: '闇の破片を浄化する', en: 'Clear a shard eruption' },
  { ja: 'フレンドにハートを贈る', en: 'Send a heart to a friend' },
  { ja: 'ベンチに座っておしゃべり', en: 'Chat on a bench' },
  { ja: '楽器で1曲演奏する', en: 'Play a song on an instrument' },
  { ja: '集合写真を撮る', en: 'Take a group photo' },
  { ja: '自撮りを1枚撮る', en: 'Take a selfie' },
  { ja: '好きな場所で寝転ぶ', en: 'Lie down somewhere you love' },
  { ja: 'エモートで誰かにあいさつ', en: 'Greet someone with an emote' },
  { ja: '季節のキャンドルを集める', en: 'Collect season candles' },
  { ja: '旅の精霊に会いに行く', en: 'Visit the traveling spirit' },
  { ja: '新しいコーデを試す', en: 'Try a new outfit' },
  { ja: 'ふだん行かない場所を探検', en: 'Explore a place you rarely visit' },
  { ja: '雨林で雨宿りする', en: 'Shelter from the rain in the forest' },
  { ja: '峡谷でスケートする', en: 'Skate in the valley' },
  { ja: '孤島の浜辺を散歩する', en: 'Walk along the isle beach' },
  { ja: '書庫を訪れる', en: 'Visit the vault' },
  { ja: 'ホームでのんびりする', en: 'Relax at home' },
  { ja: 'フレンドとハグする', en: 'Hug a friend' },
  { ja: '星座盤をながめる', en: 'Look at your constellation' },
  { ja: '初心者さんを案内する', en: 'Guide a new player' },
  { ja: '誰かと一緒にダンスする', en: 'Dance with someone' },
  { ja: 'テーブルでお茶会をする', en: 'Have a tea party at a table' },
  { ja: '空の写真を撮る', en: 'Take a photo of the sky' },
  { ja: '新しいフレンドができる', en: 'Make a new friend' },
  { ja: '「ありがとう」を伝える', en: 'Say “thank you” to someone' },
  { ja: 'キャンドルを20本集める', en: 'Collect 20 candles' },
  { ja: '季節のクエストを進める', en: 'Progress a season quest' },
  { ja: '焚き火を囲む', en: 'Gather around a campfire' },
  { ja: '誰かに道を教えてもらう', en: 'Let someone show you the way' },
  { ja: '雲の上を思いきり飛ぶ', en: 'Fly freely above the clouds' },
  { ja: '精霊のエモートを練習する', en: 'Practice a spirit emote' },
  { ja: '暴風域へ行く', en: 'Journey to Eden' },
  { ja: '草原の蝶と遊ぶ', en: 'Play with the butterflies' },
  { ja: 'アイテムの所持を1つ記録する', en: 'Log one item in the tracker' },
  { ja: '今日の思い出を日記に書く', en: 'Write today’s memory in the diary' },
];

const SIZES = [3, 4, 5];

export function normalizeBingo(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const size = SIZES.includes(d.size) ? d.size : 5;
  const custom = (Array.isArray(d.custom) ? d.custom : []).filter(s => typeof s === 'string' && s.trim()).map(s => s.trim().slice(0, 40)).slice(0, 100);
  let week = null;
  if (d.week && typeof d.week.key === 'string' && SIZES.includes(d.week.size) && Array.isArray(d.week.cells)) {
    const n = d.week.size * d.week.size;
    const cells = d.week.cells.slice(0, n).map(c => (typeof c === 'string' ? c.slice(0, 40) : ''));
    if (cells.length === n) {
      const marks = Array.from({ length: n }, (_, i) => (Array.isArray(d.week.marks) && d.week.marks[i] ? 1 : 0));
      const doneAt = {};
      if (d.week.doneAt && typeof d.week.doneAt === 'object') Object.keys(d.week.doneAt).forEach(k => { if (marks[k] && Number.isFinite(d.week.doneAt[k])) doneAt[k] = d.week.doneAt[k]; });
      week = { key: d.week.key.slice(0, 10), size: d.week.size, cells, marks, doneAt };
    }
  }
  const history = {};
  if (d.history && typeof d.history === 'object') {
    Object.keys(d.history).sort().slice(-120).forEach(k => {
      const h = d.history[k];
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && h && typeof h === 'object') history[k] = { size: SIZES.includes(h.size) ? h.size : 5, filled: Math.max(0, h.filled | 0), lines: Math.max(0, h.lines | 0) };
    });
  }
  return { size, useDefault: d.useDefault !== false, custom, week, history };
}

export function loadBingo() {
  try { return normalizeBingo(JSON.parse(localStorage.getItem(nsKey(BINGO_KEY)))); }
  catch (e) { return normalizeBingo(null); }
}
export function hasBingoData() {
  try { return !!localStorage.getItem(nsKey(BINGO_KEY)); } catch (e) { return false; }
}
export function saveBingo(doc) {
  try { localStorage.setItem(nsKey(BINGO_KEY), JSON.stringify(doc)); } catch (e) { /* 容量不足などは無視 */ }
}

/** その週の日曜（太平洋時間）の日付キー */
export function weekKeyAt(ms = Date.now()) {
  const p = ptParts(ms);
  const wd = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  const sun = new Date(Date.UTC(p.year, p.month - 1, p.day - wd));
  return `${sun.getUTCFullYear()}-${String(sun.getUTCMonth() + 1).padStart(2, '0')}-${String(sun.getUTCDate()).padStart(2, '0')}`;
}
/** 次の週が始まる実時刻（太平洋時間の次の日曜0時） */
export function nextWeekStart(ms = Date.now()) {
  const [y, m, d] = weekKeyAt(ms).split('-').map(Number);
  return ptToReal(y, m, d + 7, 0, 0, 0);
}

/** そろった列の数（縦・横・斜め） */
export function countLines(size, marks) {
  const on = i => !!marks[i];
  let lines = 0;
  for (let r = 0; r < size; r++) if ([...Array(size).keys()].every(c => on(r * size + c))) lines++;
  for (let c = 0; c < size; c++) if ([...Array(size).keys()].every(r => on(r * size + c))) lines++;
  if ([...Array(size).keys()].every(i => on(i * size + i))) lines++;
  if ([...Array(size).keys()].every(i => on(i * size + (size - 1 - i)))) lines++;
  return lines;
}
/** そろった列に含まれるマスの番号 */
export function lineCells(size, marks) {
  const on = i => !!marks[i];
  const set = new Set();
  const idx = [...Array(size).keys()];
  idx.forEach(r => { const row = idx.map(c => r * size + c); if (row.every(on)) row.forEach(i => set.add(i)); });
  idx.forEach(c => { const col = idx.map(r => r * size + c); if (col.every(on)) col.forEach(i => set.add(i)); });
  const d1 = idx.map(i => i * size + i); if (d1.every(on)) d1.forEach(i => set.add(i));
  const d2 = idx.map(i => i * size + (size - 1 - i)); if (d2.every(on)) d2.forEach(i => set.add(i));
  return set;
}

// 週ごとに同じ並びになる疑似乱数（同じ週なら何度作り直しても同じ盤面。シャッフルで変えられる）
function seededRandom(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}

export function promptPool(doc, lang) {
  const base = doc.useDefault ? DEFAULT_PROMPTS.map(p => (lang === 'en' ? p.en : p.ja)) : [];
  return [...new Set([...doc.custom, ...base])];
}

/** 盤面を作る。お題が足りない時は同じお題を繰り返さず、空欄（自由マス）で埋める */
export function buildCells(doc, key, size, lang, salt = '') {
  const n = size * size;
  const pool = promptPool(doc, lang);
  const rand = seededRandom(key + ':' + size + ':' + salt);
  const shuffled = pool.map(v => [rand(), v]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  const cells = [];
  const center = size === 5 ? 12 : -1;
  let k = 0;
  for (let i = 0; i < n; i++) {
    if (i === center) { cells.push(FREE); continue; }
    cells.push(k < shuffled.length ? shuffled[k++] : FREE);
  }
  return cells;
}

/** 今週の盤面を用意する（週が変わっていたら前の週の結果を履歴へ移して作り直す）。変わったらtrue */
export function ensureWeek(doc, lang, now = Date.now()) {
  const key = weekKeyAt(now);
  if (doc.week && doc.week.key === key) return false;
  if (doc.week) {
    const filled = doc.week.marks.filter((m, i) => m && doc.week.cells[i] !== FREE).length;
    doc.history[doc.week.key] = { size: doc.week.size, filled, lines: countLines(doc.week.size, doc.week.marks) };
  }
  const cells = buildCells(doc, key, doc.size, lang);
  doc.week = { key, size: doc.size, cells, marks: cells.map(c => (c === FREE ? 1 : 0)), doneAt: {} };
  return true;
}

/** 一年のふりかえり用: その年に遊んだ週（1マス以上埋めた週）の数・ビンゴの合計・埋めたマスの合計（今週の分も含む） */
export function bingoYearSummary(year) {
  const d = loadBingo();
  const weeks = { ...d.history };
  if (d.week) weeks[d.week.key] = { size: d.week.size, filled: d.week.marks.filter((m, i) => m && d.week.cells[i] !== FREE).length, lines: countLines(d.week.size, d.week.marks) };
  const list = Object.keys(weeks).filter(k => k.startsWith(String(year))).map(k => weeks[k]).filter(h => h.filled > 0);
  return { weeks: list.length, lines: list.reduce((s, h) => s + h.lines, 0), filled: list.reduce((s, h) => s + h.filled, 0) };
}

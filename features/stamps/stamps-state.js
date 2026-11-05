/* ================================================================
   スタンプ帳（features/stamps）の判定。各ツールの記録（localStorage）だけを読んで、達成したスタンプを決める。
   重いデータ（アイテム一覧など）は読まない＝お知らせ（js/notices.js）からも毎回呼べる軽さにしてある。

   stampsEarned_v1: { [stampId]: 'YYYY-MM-DD'（はじめて達成を確認した日） }   ※一度押したスタンプは消えない
   stampsSeen_v1:   数（お知らせで「新しいスタンプ」を出すための、最後に見た時の押印数）
   ================================================================ */
import { nsKey } from '../../js/state.js';

export const EARNED_KEY = 'stampsEarned_v1';
export const SEEN_KEY = 'stampsSeen_v1';

const CATS = ['outfit', 'shoes', 'mask', 'face_accessory', 'necklace', 'hairstyle', 'hair_accessory', 'head_accessory', 'cape', 'portable_item', 'large_placeable', 'small_placeable'];

function readJson(key, fb) { try { const v = JSON.parse(localStorage.getItem(nsKey(key))); return v == null ? fb : v; } catch (e) { return fb; } }
const countTrue = o => (o && typeof o === 'object' ? Object.keys(o).filter(k => o[k]).length : 0);

/** スタンプの判定に使う数をまとめて集める */
export function collectStats() {
  let items = 0;
  CATS.forEach(c => { items += countTrue((readJson('gameItems_' + c, {}) || {}).itemOwned); });
  const musicRaw = readJson('gameItems_music_sheet', null) || readJson('musicSheets', {});
  const music = countTrue((musicRaw || {}).itemOwned);
  const emotes = Object.keys(readJson('emoteOwned_v1', {}) || {}).length;
  let wings = 0;
  Object.values(readJson('wingTracker_v1', {}) || {}).forEach(s => { wings += countTrue(s); });
  const tree = readJson('spiritCatalogStats_v1', {}) || {};
  const streak = readJson('skyNomacanStreak_v1', {}) || {};
  const hist = readJson('skyNomacanCalc_history_v1', []);
  const candles = (Array.isArray(hist) ? hist : []).reduce((s, e) => s + (e && e.amount > 0 ? e.amount : 0), 0);
  const dc = readJson('dailyCheckLog_v1', {}) || {};
  const bingo = readJson('weeklyBingo_v1', {}) || {};
  const bHist = Object.values(bingo.history || {});
  const curLines = bingo.week ? lineCount(bingo.week) : 0;
  const curFull = bingo.week ? isFull(bingo.week) : false;
  const friends = readJson('friendsDoc_v1', {}) || {};
  const diary = Array.isArray(friends.diary) ? friends.diary : [];
  const omikuji = Object.values((readJson('omikujiLog_v1', {}) || {}).days || {});
  const coord = readJson('coordDiary_v1', {}) || {};
  const coordEntries = Array.isArray(coord.entries) ? coord.entries : [];
  const waitlist = readJson('revisitWaitlist_v1', []);
  return {
    items, music, emotes, wings,
    treeNodes: Number(tree.doneNodes) || 0,
    streakBest: Number(streak.longest) || 0,
    candleDays: countTrue(streak.days),
    candles,
    checkDays: countTrue(dc.days),
    bingoLines: bHist.reduce((s, h) => s + (h.lines | 0), 0) + curLines,
    bingoWeeks: bHist.filter(h => h.filled > 0).length + (bingo.week && bingo.week.marks && bingo.week.marks.some(Boolean) ? 1 : 0),
    bingoFull: curFull || bHist.some(h => h.filled >= h.size * h.size - (h.size === 5 ? 1 : 0)),
    friends: Array.isArray(friends.friends) ? friends.friends.length : 0,
    birthdays: Array.isArray(friends.friends) ? friends.friends.filter(f => f && f.birthday).length : 0,
    diary: diary.length,
    photos: diary.filter(d => d && d.photoId).length + coordEntries.filter(d => d && d.photoId).length,
    places: new Set([...diary, ...coordEntries].map(d => d && d.place).filter(Boolean)).size,
    omikuji: omikuji.length,
    daikichi: omikuji.filter(r => r && r.f === 0).length,
    coords: coordEntries.length,
    waitlist: Array.isArray(waitlist) ? waitlist.length : 0,
  };
}
function lineCount(w) {
  const n = w.size, m = w.marks || [];
  const idx = [...Array(n).keys()];
  let c = 0;
  idx.forEach(r => { if (idx.every(k => m[r * n + k])) c++; });
  idx.forEach(k => { if (idx.every(r => m[r * n + k])) c++; });
  if (idx.every(i => m[i * n + i])) c++;
  if (idx.every(i => m[i * n + (n - 1 - i)])) c++;
  return c;
}
function isFull(w) { return Array.isArray(w.marks) && w.marks.length === w.size * w.size && w.marks.every(Boolean); }

// group: 並べる時のまとまり。goal: 達成に必要な数（進み具合の表示にも使う）
const S = (id, group, mark, ja, en, stat, goal) => ({ id, group, mark, ja, en, stat, goal });
export const STAMPS = [
  S('item10', 'collect', '👗', 'はじめてのコレクション', 'First collection', 'items', 10),
  S('item100', 'collect', '🎀', 'おしゃれさん', 'Fashionista', 'items', 100),
  S('item300', 'collect', '👑', 'クローゼットいっぱい', 'Full closet', 'items', 300),
  S('item600', 'collect', '💎', 'コレクター', 'Collector', 'items', 600),
  S('emote20', 'collect', '🙌', 'ジェスチャー好き', 'Expressive', 'emotes', 20),
  S('emote60', 'collect', '💃', 'エモートマスター', 'Emote master', 'emotes', 60),
  S('music10', 'collect', '🎵', '音楽家のたまご', 'Budding musician', 'music', 10),
  S('music30', 'collect', '🎼', '楽譜あつめ', 'Sheet collector', 'music', 30),
  S('wing20', 'collect', '🪽', '羽ばたき', 'Taking flight', 'wings', 20),
  S('wing80', 'collect', '🕊️', '大空の旅人', 'Sky traveler', 'wings', 80),
  S('tree100', 'collect', '🌳', 'ツリーをのぼる', 'Tree climber', 'treeNodes', 100),
  S('tree500', 'collect', '🌲', '精霊の友だち', 'Friend of spirits', 'treeNodes', 500),
  S('streak7', 'daily', '🕯️', '7日つづけた', '7-day streak', 'streakBest', 7),
  S('streak30', 'daily', '🔥', '30日つづけた', '30-day streak', 'streakBest', 30),
  S('streak100', 'daily', '🌟', '100日つづけた', '100-day streak', 'streakBest', 100),
  S('candle1000', 'daily', '✨', 'キャンドル1000本', '1,000 candles', 'candles', 1000),
  S('check10', 'daily', '✅', 'チェックの習慣', 'Checklist habit', 'checkDays', 10),
  S('omikuji7', 'daily', '🎐', 'おみくじ好き', 'Fortune fan', 'omikuji', 7),
  S('daikichi', 'daily', '🍀', '大吉が出た', 'Great blessing!', 'daikichi', 1),
  S('bingo1', 'fun', '🎯', 'はじめてのビンゴ', 'First bingo', 'bingoLines', 1),
  S('bingo10', 'fun', '🎉', 'ビンゴ名人', 'Bingo pro', 'bingoLines', 10),
  S('bingoWeeks4', 'fun', '📅', '4週あそんだ', '4 weeks of bingo', 'bingoWeeks', 4),
  S('bingoFull', 'fun', '🏆', 'カードを全部うめた', 'Full card', 'bingoFull', 1),
  S('friend1', 'friends', '🤝', 'はじめてのフレンド', 'First friend', 'friends', 1),
  S('friend10', 'friends', '💞', 'フレンドの輪', 'Circle of friends', 'friends', 10),
  S('birthday3', 'friends', '🎂', 'お祝い上手', 'Birthday keeper', 'birthdays', 3),
  S('diary1', 'friends', '📷', '思い出をひとつ', 'First memory', 'diary', 1),
  S('diary20', 'friends', '📔', '思い出アルバム', 'Memory album', 'diary', 20),
  S('places5', 'friends', '🗺️', 'あちこち旅した', 'Well traveled', 'places', 5),
  S('coord1', 'fun', '🪞', 'はじめてのコーデ日記', 'First outfit log', 'coords', 1),
  S('coord10', 'fun', '👒', 'コーデ上手', 'Style diary', 'coords', 10),
  S('waiting', 'fun', '🔔', '待っている精霊がいる', 'Waiting for a spirit', 'waitlist', 1),
];
export const GROUPS = [
  { id: 'collect', ja: 'あつめる', en: 'Collect' },
  { id: 'daily', ja: 'つづける', en: 'Keep it up' },
  { id: 'fun', ja: 'あそぶ', en: 'Play' },
  { id: 'friends', ja: 'フレンドと思い出', en: 'Friends & memories' },
];

function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

/** 判定して、新しく達成したものに日付を付けて保存する。戻り値: { stats, earned: {id:date}, newly: [id] } */
export function evaluateStamps() {
  const stats = collectStats();
  const earned = readJson(EARNED_KEY, {}) || {};
  const newly = [];
  STAMPS.forEach(s => {
    const v = typeof stats[s.stat] === 'boolean' ? (stats[s.stat] ? 1 : 0) : stats[s.stat];
    if (!earned[s.id] && v >= s.goal) { earned[s.id] = today(); newly.push(s.id); }
  });
  if (newly.length) { try { localStorage.setItem(nsKey(EARNED_KEY), JSON.stringify(earned)); } catch (e) { /* noop */ } }
  return { stats, earned, newly };
}
export function earnedCount() { return Object.keys(readJson(EARNED_KEY, {}) || {}).filter(id => STAMPS.some(s => s.id === id)).length; }
export function seenCount() { return Number(readJson(SEEN_KEY, 0)) || 0; }
export function markStampsSeen(n) { try { localStorage.setItem(nsKey(SEEN_KEY), JSON.stringify(n)); } catch (e) { /* noop */ } }

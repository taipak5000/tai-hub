/* ================================================================
   emote-state.js — エモート機能の永続化レイヤー

   移植元: C:\Users\user\Downloads\skyツール\emote\index.html
   （所持データ/入手履歴/称号/コンプリート率推移/「1年前の今日」バナー/
   表示設定まわりの関数群、旧実装の行3636-4030・4917-4945付近）。

   localStorageのキー名・JSON形状は元実装と完全に同一に保っている
   （既存ユーザーのデータをそのまま読めることが必須のため）。

   注意: nsKey は js/state.js の named import であり、このモジュールの
   グローバル変数ではないため、featured/item/cost-view.js と同じ方針で
   「キー名を返す関数」を都度呼び出す形にしている（トップレベルで1回だけ
   nsKey(...) を評価して const にキャッシュしない）。
   ================================================================ */

import { nsKey } from '../../js/state.js';
import { EMOTES } from './data/emotes.js';
import { TITLES } from './data/titles.js';

/* ================================================================
   所持データ（emoteOwned_v1）
   { [emoteId]: [1,3,4] } のように、所持しているレベル番号だけを配列で持つ。
   ================================================================ */
function ownedKey() { return nsKey('emoteOwned_v1'); }

export function loadOwned() {
  try {
    const data = JSON.parse(localStorage.getItem(ownedKey()));
    return (data && typeof data === 'object') ? data : {};
  } catch (_) { return {}; }
}
export function saveOwned(data) {
  try { localStorage.setItem(ownedKey(), JSON.stringify(data)); } catch (_) { /* noop */ }
}

/* ================================================================
   入手履歴（emoteAcquireLog_v1）
   = { "<emoteId>::<level>": { emoteId, level, at: ISO日時 }, ... }
   ================================================================ */
function acquireLogStorageKey() { return nsKey('emoteAcquireLog_v1'); }
export function acquireLogEntryKey(emoteId, level) { return emoteId + '::' + level; }

// キーは常に acquireLogEntryKey() の形式でのみ生成しているため、それ以外は
// 不正な値（データ引継ぎ/改ざん等）とみなして除外する（XSS対策も兼ねる）。
function alIsSafeKey(key) {
  return typeof key === 'string' && /^[A-Za-z0-9_-]{1,64}::[0-9]{1,4}$/.test(key);
}

export function loadAcquireLog() {
  try {
    const data = JSON.parse(localStorage.getItem(acquireLogStorageKey()));
    if (!data || typeof data !== 'object') return {};
    const safe = {};
    Object.keys(data).forEach(key => { if (alIsSafeKey(key)) safe[key] = data[key]; });
    return safe;
  } catch (_) { return {}; }
}
export function saveAcquireLog(data) {
  try { localStorage.setItem(acquireLogStorageKey(), JSON.stringify(data)); } catch (_) { /* noop */ }
}

export function recordEmoteAcquire(emoteId, level) {
  const log = loadAcquireLog();
  log[acquireLogEntryKey(emoteId, level)] = { emoteId, level, at: new Date().toISOString() };
  saveAcquireLog(log);
}
export function removeEmoteAcquireRecord(emoteId, level) {
  const log = loadAcquireLog();
  const key = acquireLogEntryKey(emoteId, level);
  if (log[key]) { delete log[key]; saveAcquireLog(log); }
}

// 🆕 「最近入手」バッジ用：この期間内(ミリ秒)に入手履歴へ記録されたエモートには、
// 入手履歴モーダルを開かなくても一覧に直接バッジを表示する。
export const RECENT_ACQUIRE_MS = 3 * 24 * 60 * 60 * 1000; // 3日以内を「最近」とみなす

export function buildLatestAcquireMap() {
  const log = loadAcquireLog();
  const map = {};
  Object.keys(log).forEach(key => {
    const rec = log[key];
    const prev = map[rec.emoteId];
    if (!prev || new Date(rec.at) > new Date(prev)) map[rec.emoteId] = rec.at;
  });
  return map;
}
export function isRecentlyAcquired(recentAcquireMap, emoteId) {
  const at = recentAcquireMap[emoteId];
  if (!at) return false;
  return (Date.now() - new Date(at).getTime()) <= RECENT_ACQUIRE_MS;
}

/* ================================================================
   所持レベルのトグル・一括所持
   ================================================================ */
export function toggleLevel(emoteId, level) {
  const data = loadOwned();
  const owned = new Set(data[emoteId] || []);
  const wasOwned = owned.has(level);
  if (wasOwned) owned.delete(level); else owned.add(level);
  const arr = Array.from(owned).sort((a, b) => a - b);
  if (arr.length === 0) delete data[emoteId]; else data[emoteId] = arr;
  saveOwned(data);
  if (wasOwned) removeEmoteAcquireRecord(emoteId, level);
  else recordEmoteAcquire(emoteId, level);
}

// 指定エモートの全レベルを所持済みにする（純粋な状態更新のみ）
export function applyOwnAll(data, e) {
  data[e.id] = Array.from({ length: e.maxLevel }, (_, i) => i + 1);
}

// 一括所持切替：既に全レベル所持済みの場合は逆に全解除する
export function toggleAllLevels(emoteId) {
  const e = EMOTES.find(x => x.id === emoteId);
  if (!e) return;
  const data = loadOwned();
  const before = new Set(data[emoteId] || []);
  if (before.size >= e.maxLevel) {
    delete data[emoteId];
    before.forEach(lv => removeEmoteAcquireRecord(emoteId, lv));
  } else {
    applyOwnAll(data, e);
    for (let lv = 1; lv <= e.maxLevel; lv++) {
      if (!before.has(lv)) recordEmoteAcquire(emoteId, lv);
    }
  }
  saveOwned(data);
}

// 絞り込み結果のエモート全てを一括で「全部所持」にする（一方向操作：解除方向へは倒さない）
export function bulkOwnFiltered(filteredEmotes) {
  if (!filteredEmotes.length) return;
  const data = loadOwned();
  filteredEmotes.forEach(e => {
    const before = new Set(data[e.id] || []);
    applyOwnAll(data, e);
    for (let lv = 1; lv <= e.maxLevel; lv++) {
      if (!before.has(lv)) recordEmoteAcquire(e.id, lv);
    }
  });
  saveOwned(data);
}

/* ================================================================
   統計
   ================================================================ */
export function getStats() {
  const data = loadOwned();
  let owned = 0, total = 0, ownedEmoteCount = 0, guideCount = 0, ownedGuideCount = 0;
  let guideOwnedLv = 0, guideTotalLv = 0;
  EMOTES.forEach(e => {
    total += e.maxLevel;
    const lv = (data[e.id] || []).length;
    owned += lv;
    if (lv > 0) {
      ownedEmoteCount++;
      if (e.isGuide) ownedGuideCount++;
    }
    if (e.isGuide) {
      guideCount++;
      guideTotalLv += e.maxLevel;
      guideOwnedLv += lv;
    }
  });
  return {
    owned, total, pct: total > 0 ? (owned / total) * 100 : 0,
    emoteCount: EMOTES.length, ownedEmoteCount, guideCount, ownedGuideCount,
    guideOwnedLv, guideTotalLv, guidePct: guideTotalLv > 0 ? (guideOwnedLv / guideTotalLv) * 100 : 0,
  };
}

export function formatPct(pct) {
  if (pct <= 0) return '0%';
  if (pct >= 100) return '100%';
  return pct.toFixed(1) + '%';
}
export function formatPctHtml(pct) {
  return formatPct(pct).replace('%', '<span class="em-pct-unit">%</span>');
}

/* ================================================================
   称号（実績）— emoteTitles_v1
   一度解除した称号は、後から所持レベルを減らしても失われない。
   ================================================================ */
function titlesStorageKey() { return nsKey('emoteTitles_v1'); }

export function loadTitles() {
  try {
    const d = JSON.parse(localStorage.getItem(titlesStorageKey()));
    return (d && typeof d === 'object') ? d : {};
  } catch (_) { return {}; }
}
export function saveTitles(d) {
  try { localStorage.setItem(titlesStorageKey(), JSON.stringify(d)); } catch (_) { /* noop */ }
}

// 新規解除の判定・付与のみを行う。既に解除済みの称号は再判定しない。
// 戻り値: { earned: 保存済み称号ストア全体, newly: 今回新規に解除されたTITLES要素の配列 }
export function checkTitles(stats) {
  const earned = loadTitles();
  const newly = [];
  TITLES.forEach(title => {
    if (earned[title.id]) return;
    if (title.check(stats)) {
      earned[title.id] = { earnedAt: new Date().toISOString() };
      newly.push(title);
    }
  });
  if (newly.length > 0) saveTitles(earned);
  return { earned, newly };
}

/* ================================================================
   📈 コンプリート率の推移スナップショット（completionHistory_v1）
   1日1件・冪等。最大MAX_COMPLETION_HISTORY件でキャップ（古い方から捨てる）。
   ================================================================ */
const MAX_COMPLETION_HISTORY = 180;
// 🩹 以前は羽トラッカーと同じ completionHistory_v1 に書いていた（独立サイトの頃は保存先が別々だったが、
// ハブでは同じ保存先を共有するため、互いの記録を上書きしていた）。今はエモート専用のキーに書き、
// 新しいキーがまだ無い時だけ、古いキーからエモートの形（owned・totalを持つ）の記録だけを拾って引き継ぐ。
function completionHistoryKey() { return nsKey('emoteCompletionHistory_v1'); } // [{date,pct,owned,total}]（古い→新しい順）
const LEGACY_SHARED_HISTORY_KEY = () => nsKey('completionHistory_v1');

export function loadCompletionHistory() {
  try {
    const raw = localStorage.getItem(completionHistoryKey());
    if (raw !== null) { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : []; }
    const legacy = JSON.parse(localStorage.getItem(LEGACY_SHARED_HISTORY_KEY()));
    return Array.isArray(legacy) ? legacy.filter((e) => e && typeof e.owned === 'number' && typeof e.total === 'number') : [];
  } catch (_) { return []; }
}
export function saveCompletionHistory(arr) {
  try { localStorage.setItem(completionHistoryKey(), JSON.stringify(arr)); } catch (_) { /* noop */ }
}

// タイムゾーンによるズレを避けるため、UTCではなく端末のローカル日付でYYYY-MM-DDを作る
function todayLocalDateStr() {
  const d = new Date();
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 姉妹サイト(tai-card)のTREND_GRAPHSが読む「現在値＋獲得履歴(差分)」形式のミラーも
// 一緒に書いておく（本命はcompletionHistory_v1の{date,pct}の方。wings/emote共通の考え方）。
function updateCompletionTrendMirror(history) {
  if (!history.length) return;
  try {
    localStorage.setItem(nsKey('emoteCompletion_v1'), JSON.stringify({ current: history[history.length - 1].owned }));
    const deltas = [];
    for (let i = history.length - 1; i >= 1; i--) {
      const time = new Date(history[i].date + 'T12:00:00').getTime();
      deltas.push({ time, amount: history[i].owned - history[i - 1].owned });
    }
    localStorage.setItem(nsKey('emoteCompletion_history_v1'), JSON.stringify(deltas));
  } catch (_) { /* localStorageが使えない場合も本体機能には影響させない */ }
}

// mount() 時に1回だけ呼ぶ。同じ日に何度呼んでもno-op（冪等）。
export function recordCompletionSnapshotIfNeeded() {
  const stats = getStats();
  const pct = Math.round(stats.pct * 10) / 10;
  const today = todayLocalDateStr();
  const history = loadCompletionHistory();
  const last = history[history.length - 1];
  if (last && last.date === today) return;
  history.push({ date: today, pct, owned: stats.owned, total: stats.total });
  while (history.length > MAX_COMPLETION_HISTORY) history.shift();
  saveCompletionHistory(history);
  updateCompletionTrendMirror(history);
}

/* ================================================================
   🎉 「1年前の今日」バナー
   ================================================================ */
function oneYearAgoDismissKey() { return nsKey('emoteOneYearAgoDismiss_v1'); }

export function isOneYearAgoBannerDismissedToday() {
  try { return localStorage.getItem(oneYearAgoDismissKey()) === todayLocalDateStr(); } catch (_) { return false; }
}
export function findOneYearAgoAcquisition() {
  const log = loadAcquireLog();
  const today = new Date();
  const ty = today.getFullYear(), tm = today.getMonth(), td = today.getDate();
  const keys = Object.keys(log);
  for (let i = 0; i < keys.length; i++) {
    const rec = log[keys[i]];
    const at = new Date(rec.at);
    if (isNaN(at.getTime())) continue;
    const yearsAgo = ty - at.getFullYear();
    if (yearsAgo >= 1 && at.getMonth() === tm && at.getDate() === td) {
      const e = EMOTES.find(x => x.id === rec.emoteId);
      if (e) return { emote: e, level: rec.level, yearsAgo };
    }
  }
  return null;
}
export function dismissOneYearAgoBanner() {
  try { localStorage.setItem(oneYearAgoDismissKey(), todayLocalDateStr()); } catch (_) { /* noop */ }
}

/* ================================================================
   表示モード（グリッド/リスト）・グリッド列数
   端末ごとの表示設定なのでプロフィールをまたいで共通（namespace化しない）。
   item機能側のgameItems_viewMode/gameItems_gridColsとはキー名が異なる
   （元のemoteサイトが独自のキー名を持っていたため、そのまま維持）。
   ================================================================ */
const VIEW_MODE_KEY = 'emoteViewMode_v1';
const GRID_COLS_KEY = 'emoteGridCols_v1';

export function getViewMode() {
  try { return localStorage.getItem(VIEW_MODE_KEY) || 'list'; } catch (_) { return 'list'; }
}
export function setViewMode(mode) {
  try { localStorage.setItem(VIEW_MODE_KEY, mode); } catch (_) { /* noop */ }
}
export function getGridCols() {
  try { return localStorage.getItem(GRID_COLS_KEY) || 'auto'; } catch (_) { return 'auto'; }
}
export function setGridCols(val) {
  try { localStorage.setItem(GRID_COLS_KEY, val); } catch (_) { /* noop */ }
}

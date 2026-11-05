/* ================================================================
   wings-state.js — 羽トラッカー機能の永続化レイヤー

   移植元: C:\Users\user\Downloads\skyツール\wings\index.html
   （精霊の羽/恒常精霊/光の子トラッカー・称号・コンプリート率推移まわりの
   関数群、旧実装の行4960-5014・4454-4580付近）。

   localStorageのキー名・JSON形状は元実装と完全に同一に保っている
   （既存ユーザーのデータをそのまま読めることが必須のため）。すべて
   nsKey()経由でプロフィール名前空間化する点も元実装(nsKey()呼び出し)と同じ。

   注意: nsKey は js/state.js の named import であり、このモジュールの
   グローバル変数ではないため、features/emote/emote-state.js と同じ方針で
   「キー名を返す関数」を都度呼び出す形にしている（トップレベルで1回だけ
   nsKey(...) を評価して const にキャッシュしない——別タブでプロフィールが
   切り替わった後も正しい保存先を解決できるようにするため）。
   ================================================================ */

import { nsKey, getActiveProfileId, nsKeyFor } from '../../js/state.js';
import { SEASON_SPIRITS } from './data/season-spirits.js';
import { REALM_SPIRITS, CAPE_LEVELS } from './data/realm-spirits.js';
import { LIGHT_CHILDREN } from './data/light-children.js';
import { TITLES } from './data/titles.js';

export const CANDLES_PER_FEATHER = 2;
export const REBIRTH_BONUS = 1; // 原罪での転生ボーナス（精霊への配布とは別に+1）

/* ================================================================
   🗂️ トラッカー本体
   wingTracker_v1     = { [季節名ja]: { [精霊名ja]: {at:ISO8601} | true } }
   permWingTracker_v1 = { [精霊名ja]: { tier1: {at}|true, tier2: {at}|true } }
   lightChildrenTracker_v1 = { [id]: true }
   値が真偽値trueのままのものは、日時ログ機能追加以前からの既存データ
   （wingObtainedAt()側で「truthyだがatが無い＝日時不明の旧データ」として
   引き続き所持済み扱いする）。
   ================================================================ */
function trackerKey() { return nsKey('wingTracker_v1'); }
function permTrackerKey() { return nsKey('permWingTracker_v1'); }
function lightChildrenTrackerKey() { return nsKey('lightChildrenTracker_v1'); }

export function loadTracker() { return loadTrackerFor(getActiveProfileId()); }
export function saveTracker(t) { localStorage.setItem(trackerKey(), JSON.stringify(t)); }

export function loadPermTracker() { return loadPermTrackerFor(getActiveProfileId()); }
export function savePermTracker(t) { localStorage.setItem(permTrackerKey(), JSON.stringify(t)); }

export function loadLightChildrenTracker() { return loadLightChildrenTrackerFor(getActiveProfileId()); }
export function saveLightChildrenTracker(t) { localStorage.setItem(lightChildrenTrackerKey(), JSON.stringify(t)); }

// loadTracker()等の"任意プロフィール版"。アクティブプロフィールを切り替えずに他プロフィールの
// データを読みたい場合に使う（元実装のプロフィール比較モーダル用途。tai-hub版では比較UI自体は
// 未移植だが、読み取り関数自体は将来の再利用のためそのまま残す）。
export function loadTrackerFor(profileId) {
  try { return JSON.parse(localStorage.getItem(nsKeyFor('wingTracker_v1', profileId))) || {}; }
  catch (_) { return {}; }
}
export function loadPermTrackerFor(profileId) {
  try { return JSON.parse(localStorage.getItem(nsKeyFor('permWingTracker_v1', profileId))) || {}; }
  catch (_) { return {}; }
}
export function loadLightChildrenTrackerFor(profileId) {
  try { return JSON.parse(localStorage.getItem(nsKeyFor('lightChildrenTracker_v1', profileId))) || {}; }
  catch (_) { return {}; }
}

// トグルON時に保存する値から獲得日時（ISO8601）を取り出す。
// 旧データ（値が真偽値true）の場合はnullを返す（＝日時不明。所持自体は真偽値のtruthyで判定できる）。
export function wingObtainedAt(val) {
  return (val && typeof val === 'object') ? (val.at || null) : null;
}

/* ================================================================
   📊 集計
   ================================================================ */
export function countLightChildren(profileId) {
  const tracker = profileId ? loadLightChildrenTrackerFor(profileId) : loadLightChildrenTracker();
  let got = 0, total = 0;
  LIGHT_CHILDREN.forEach(({ areas }) => {
    areas.forEach(({ children }) => {
      total += children.length;
      children.forEach(child => { if (tracker[child.id]) got++; });
    });
  });
  return { got, total };
}

export function getWingStats(profileId) {
  const tracker = profileId ? loadTrackerFor(profileId) : loadTracker();
  const permTracker = profileId ? loadPermTrackerFor(profileId) : loadPermTracker();

  let seasonFeathers = 0, seasonSpiritsTotal = 0;
  SEASON_SPIRITS.forEach(({ season, spirits }) => {
    const checked = tracker[season.ja] || {};
    seasonFeathers += spirits.filter(sp => checked[sp.ja]).length;
    seasonSpiritsTotal += spirits.length;
  });

  let permFeathers = 0;
  const permTotal = REALM_SPIRITS.reduce((sum, r) => sum + r.spirits.reduce((s2, sp) => s2 + (sp.t2 ? 2 : 1), 0), 0);
  REALM_SPIRITS.forEach(({ spirits }) => {
    spirits.forEach(sp => {
      const state = permTracker[sp.name.ja] || {};
      if (state.tier1) permFeathers++;
      if (sp.t2 && state.tier2) permFeathers++;
    });
  });

  const { got: lightChildrenGot, total: lightChildrenTotal } = countLightChildren(profileId);

  const totalAll = seasonFeathers + permFeathers + lightChildrenGot + REBIRTH_BONUS;
  const capeLevel = CAPE_LEVELS.filter(need => totalAll >= need).length;

  return { totalAll, seasonFeathers, seasonSpiritsTotal, permFeathers, permTotal, lightChildrenGot, lightChildrenTotal, capeLevel };
}

/* ================================================================
   🏆 称号（実績）— wingsTitles_v1 = { [titleId]: { earnedAt: ISO8601 } }
   一度獲得した称号は、その後数値が下がっても再評価しない（＝取り消しは起きない）。
   ================================================================ */
function titlesKey() { return nsKey('wingsTitles_v1'); }
export function loadTitles() {
  try { return JSON.parse(localStorage.getItem(titlesKey())) || {}; }
  catch (_) { return {}; }
}
export function saveTitles(obj) { localStorage.setItem(titlesKey(), JSON.stringify(obj)); }

// 現在のstatsを見て、新規に条件を満たした称号があれば保存する。
// 戻り値: { owned: 保存済み称号ストア全体, newlyEarned: 今回新規に解除されたTITLES要素の配列 }
export function checkAndUnlockTitles() {
  const stats = getWingStats();
  const owned = loadTitles();
  const newlyEarned = [];
  TITLES.forEach(title => {
    if (owned[title.id]) return;
    if (title.condition(stats)) {
      owned[title.id] = { earnedAt: new Date().toISOString() };
      newlyEarned.push(title);
    }
  });
  if (newlyEarned.length) saveTitles(owned);
  return { owned, newlyEarned };
}

/* ================================================================
   📈 コンプリート率の推移スナップショット（completionHistory_v1）
   1日1件・冪等。最大MAX_COMPLETION_HISTORY件でキャップ（古い方から捨てる）。
   ================================================================ */
const MAX_COMPLETION_HISTORY = 180;
// 🩹 以前はエモート所持率管理と同じ completionHistory_v1 に書いていた（ハブでは保存先を共有するため、
// 互いの記録を上書きしていた）。今は羽トラッカー専用のキーに書き、新しいキーがまだ無い時だけ、
// 古いキーから羽トラッカーの形（totalAllを持つ）の記録だけを拾って引き継ぐ。
function completionHistoryKey() { return nsKey('wingsCompletionHistory_v1'); } // [{date,pct,totalAll}]（古い→新しい順）
const LEGACY_SHARED_HISTORY_KEY = () => nsKey('completionHistory_v1');

export function loadCompletionHistory() {
  try {
    const raw = localStorage.getItem(completionHistoryKey());
    if (raw !== null) { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : []; }
    const legacy = JSON.parse(localStorage.getItem(LEGACY_SHARED_HISTORY_KEY()));
    return Array.isArray(legacy) ? legacy.filter((e) => e && typeof e.totalAll === 'number') : [];
  } catch (_) { return []; }
}
export function saveCompletionHistory(arr) { localStorage.setItem(completionHistoryKey(), JSON.stringify(arr)); }

// タイムゾーンによるズレを避けるため、UTCではなく端末のローカル日付でYYYY-MM-DDを作る
function todayLocalDateStr() {
  const d = new Date();
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// getWingStats()の内訳から「全体コンプリート率」を単一の%に集約する。
// 転生ボーナス(+1)はどのチェックリストにも属さない特別加算のため、分母・分子どちらにも含めない。
export function computeOverallCompletionPct(stats) {
  const got = stats.seasonFeathers + stats.permFeathers + stats.lightChildrenGot;
  const total = stats.seasonSpiritsTotal + stats.permTotal + stats.lightChildrenTotal;
  return total > 0 ? Math.round((got / total) * 100) : 0;
}

// 姉妹サイト(tai-card)のTREND_GRAPHSが読む「現在値＋獲得履歴(差分)」形式のミラーも
// 一緒に書いておく（本命はcompletionHistory_v1の{date,pct}の方。emote等と同じ考え方）。
function updateCompletionTrendMirror(history) {
  if (!history.length) return;
  try {
    localStorage.setItem(nsKey('wingsCompletion_v1'), JSON.stringify({ current: history[history.length - 1].totalAll }));
    const deltas = [];
    for (let i = history.length - 1; i >= 1; i--) {
      const time = new Date(history[i].date + 'T12:00:00').getTime();
      deltas.push({ time, amount: history[i].totalAll - history[i - 1].totalAll });
    }
    localStorage.setItem(nsKey('wingsCompletion_history_v1'), JSON.stringify(deltas));
  } catch (_) { /* localStorageが使えない場合も本体機能(記録自体)には影響させない */ }
}

// mount() 時に1回だけ呼ぶ。同じ日に何度呼んでもno-op（冪等）。
export function recordCompletionSnapshotIfNeeded() {
  const stats = getWingStats();
  const pct = computeOverallCompletionPct(stats);
  const today = todayLocalDateStr();
  const history = loadCompletionHistory();
  const last = history[history.length - 1];
  if (last && last.date === today) return;
  history.push({ date: today, pct, totalAll: stats.totalAll });
  while (history.length > MAX_COMPLETION_HISTORY) history.shift();
  saveCompletionHistory(history);
  updateCompletionTrendMirror(history);
}

/* ================================================================
   📤 達成率シェア画像のカスタマイズ設定 — wingsShareCustomize_v1（非namespace化。
   元実装もnsKey()を通さず端末単位のプレーンキーとして保存している）
   ================================================================ */
const SHARE_CUSTOMIZE_KEY = 'wingsShareCustomize_v1';
export const SHARE_THEMES = {
  blue: { labelKey: 'themeNameBlue', grad: 'linear-gradient(135deg, #0051A8 0%, #007AFF 55%, #5AC8FA 100%)' },
  orange: { labelKey: 'themeNameOrange', grad: 'linear-gradient(135deg, #C56E06 0%, #FF9500 55%, #FFBB00 100%)' },
  green: { labelKey: 'themeNameGreen', grad: 'linear-gradient(135deg, #1F7A3D 0%, #34C759 55%, #8BE28B 100%)' },
  purple: { labelKey: 'themeNamePurple', grad: 'linear-gradient(135deg, #4B2E83 0%, #7B4FCB 55%, #B98CFF 100%)' },
  pink: { labelKey: 'themeNamePink', grad: 'linear-gradient(135deg, #B0184D 0%, #FF2D78 55%, #FF8FB3 100%)' },
  dark: { labelKey: 'themeNameDark', grad: 'linear-gradient(135deg, #05070d 0%, #1b2333 100%)' },
};
export function loadShareCustomize() {
  try {
    const d = JSON.parse(localStorage.getItem(SHARE_CUSTOMIZE_KEY));
    return { theme: (d && d.theme && SHARE_THEMES[d.theme]) ? d.theme : 'blue' };
  } catch (_) {
    return { theme: 'blue' };
  }
}
export function saveShareCustomize(theme) {
  localStorage.setItem(SHARE_CUSTOMIZE_KEY, JSON.stringify({ theme }));
}

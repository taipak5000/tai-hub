/* ================================================================
   tai-nomacan-pro（ノマキャン計算機プロ）のデータ層。DOMに一切触れない、
   localStorageの読み書き・純粋な計算関数だけをここに集約する
   （UIの組み立て・イベント配線は nomacan-pro-view.js）。

   移植元: tai-nomacan.pro/index.html のVue setup()内のロジック一式。
   Vueのref/computed/watchは、ここでは「プレーンなJSオブジェクト＋
   それを読み書きする純粋関数」に置き換えている（再描画は呼び出し側の
   責務。nomacan-state.jsと同じ設計）。

   ⚠️ localStorageキー名は元のものと完全一致させている(既存ユーザーの
   データ互換性のため)。nsKey()は必ずjs/state.jsの共有実装を使う。
   ================================================================ */
import { nsKey } from '../../js/state.js';
import { DEFAULT_AREAS, AREAS_DATA_VERSION } from './data/areas-data.js';

/* ── localStorage キー ── */
export const TRACKER_KEY = () => nsKey('sky_tracker_storage_v3');
export const CURRENCY_KEY = () => nsKey('wishOwnCurrency');
// 端末側の設定（プロフィール非依存。元実装と同じ扱い）
export const TIME_MULT_KEY = 'sky_current_time_mult';
export const SHARD_SYNC_DATE_KEY = 'sky_shard_sync_date';
export const SHARD_NOTIFY_KEY = 'sky_shard_notify_enabled';
export const DAILYRESET_NOTIFY_KEY = 'sky_dailyreset_notify_enabled';
export const AREA_TODAY_FILTER_KEY = 'sky_area_today_filter';
export const AREA_DETAIL_OPEN_KEY = 'sky_area_detail_open';

export function uuid() {
  return crypto.randomUUID();
}

/* ================================================================
   🌲 エリアツリーの初期化・モード判定
   ================================================================ */
export function getDefaultAreas(timeMult) {
  timeMult = timeMult == null ? 1.0 : timeMult;
  return DEFAULT_AREAS.map((area) => {
    const subAreas = Array.isArray(area.subAreas) ? area.subAreas : [];
    const baseAreaTime = Number(area.time) || 0;
    return {
      id: uuid(),
      name: area.name,
      isExpanded: !!area.isExpanded,
      light: Number(area.light) || 0,
      time: Math.round(baseAreaTime * timeMult),
      _baseTime: baseAreaTime,
      isSelected: false,
      subAreas: subAreas.map((sub) => {
        const spots = Array.isArray(sub.spots) ? sub.spots : [];
        const baseSubTime = Number(sub.time) || 0;
        return {
          id: uuid(),
          name: sub.name,
          isExpanded: !!sub.isExpanded,
          light: Number(sub.light) || 0,
          time: Math.round(baseSubTime * timeMult),
          _baseTime: baseSubTime,
          isSelected: false,
          spots: spots.map((spot) => {
            const baseSpotTime = Number(spot.time) || 0;
            return {
              id: uuid(),
              name: spot.name,
              light: Number(spot.light) || 0,
              time: Math.round(baseSpotTime * timeMult),
              _baseTime: baseSpotTime,
              isSelected: !!spot.isSelected,
              group: spot.group || '',
            };
          }),
        };
      }),
    };
  });
}

export function getAreaMode(mainArea) {
  if (!mainArea || !Array.isArray(mainArea.subAreas) || mainArea.subAreas.length === 0) return 'main';
  return 'sub';
}
export function getSubMode(subArea) {
  if (!subArea || !Array.isArray(subArea.spots) || subArea.spots.length === 0) return 'sub';
  return 'spot';
}

export function enforceSpotGroupExclusivity(spots) {
  if (!Array.isArray(spots)) return;
  const seenGroups = new Set();
  spots.forEach((s) => {
    if (!s || !s.isSelected) return;
    const g = s.group && s.group.trim();
    if (!g) return;
    if (seenGroups.has(g)) { s.isSelected = false; } else { seenGroups.add(g); }
  });
}

/* ================================================================
   📊 エリア/サブエリアの合計・統計
   ================================================================ */
// 選択済みの分だけ合計する（実際の見込み表示用）
export function getMainAreaStats(mainArea) {
  let light = 0; let time = 0;
  const aMode = getAreaMode(mainArea);
  if (aMode === 'main') {
    if (mainArea && mainArea.isSelected) { light = mainArea.light || 0; time = mainArea.time || 0; }
  } else if (mainArea && Array.isArray(mainArea.subAreas) && mainArea.subAreas.length > 0) {
    const allSubTimeZero = mainArea.subAreas.every((s) => !s || !(s.time > 0));
    if (allSubTimeZero) {
      mainArea.subAreas.forEach((sub) => {
        if (!sub) return;
        const sMode = getSubMode(sub);
        if (sMode === 'sub') {
          if (sub.isSelected) light += sub.light || 0;
        } else if (Array.isArray(sub.spots)) {
          sub.spots.forEach((s) => { if (s && s.isSelected) light += s.light; });
        }
      });
      if (light > 0) time = mainArea.time || 0;
    } else {
      mainArea.subAreas.forEach((sub) => {
        const sMode = getSubMode(sub);
        if (sMode === 'sub') {
          if (sub && sub.isSelected) { light += sub.light || 0; time += sub.time || 0; }
        } else if (sub && Array.isArray(sub.spots)) {
          sub.spots.forEach((s) => { if (s && s.isSelected) light += s.light; });
          const hasSelected = sub.spots.some((s) => s && s.isSelected);
          if (hasSelected) time += sub.time || 0;
        }
      });
    }
  }
  return { light, time, eff: time > 0 ? (light / time) : 0.0 };
}
// 選択状態に関係なく、メインエリア配下の火種を無条件合計する（%スライダーの分母）
export function getMainAreaTotalLight(mainArea) {
  let light = 0;
  const aMode = getAreaMode(mainArea);
  if (aMode === 'main') {
    light = (mainArea && mainArea.light) || 0;
  } else if (mainArea && Array.isArray(mainArea.subAreas)) {
    mainArea.subAreas.forEach((sub) => {
      if (!sub) return;
      const sMode = getSubMode(sub);
      if (sMode === 'sub') { light += sub.light || 0; } else if (Array.isArray(sub.spots)) { sub.spots.forEach((s) => { if (s) light += (s.light || 0); }); }
    });
  }
  return light;
}
export function getMainAreaPercent(mainArea) {
  const total = getMainAreaTotalLight(mainArea);
  if (total <= 0) return 0;
  return Math.round((getMainAreaStats(mainArea).light / total) * 100);
}
export function getMainAreaSelectedCount(mainArea) {
  let n = 0;
  const aMode = getAreaMode(mainArea);
  if (aMode === 'main') { if (mainArea && mainArea.isSelected) n = 1; } else if (mainArea && Array.isArray(mainArea.subAreas)) {
    mainArea.subAreas.forEach((sub) => {
      const sMode = getSubMode(sub);
      if (sMode === 'sub') { if (sub && sub.isSelected) n++; } else if (sub && Array.isArray(sub.spots)) { sub.spots.forEach((s) => { if (s && s.isSelected) n++; }); }
    });
  }
  return n;
}
export function getSubAreaStats(subArea) {
  let light = 0; let time = 0;
  const sMode = getSubMode(subArea);
  if (sMode === 'sub') {
    if (subArea && subArea.isSelected) { light = subArea.light || 0; time = subArea.time || 0; }
  } else if (subArea && Array.isArray(subArea.spots)) {
    subArea.spots.forEach((s) => { if (s && s.isSelected) light += s.light; });
    if (light > 0) time = subArea.time || 0;
  }
  return { light, eff: time > 0 ? (light / time) : 0.0 };
}

/* ================================================================
   🎯 エリア%スライダー: 目標%に達するまで、データ記載順に自然に選んでいく
   ================================================================ */
export function applyAreaPercent(mainArea, pct) {
  if (!mainArea || !Array.isArray(mainArea.subAreas)) return;
  const total = getMainAreaTotalLight(mainArea);
  const targetLight = Math.round(total * pct / 100);
  const flat = [];
  mainArea.subAreas.forEach((sub) => {
    if (!sub) return;
    const sMode = getSubMode(sub);
    if (sMode === 'sub') {
      flat.push({ kind: 'sub', ref: sub });
    } else if (Array.isArray(sub.spots)) {
      sub.spots.forEach((sp) => flat.push({ kind: 'spot', ref: sp, subId: sub.id }));
    }
  });
  // リセット
  mainArea.subAreas.forEach((sub) => {
    if (!sub) return;
    if (getSubMode(sub) === 'sub') sub.isSelected = false;
    else if (Array.isArray(sub.spots)) sub.spots.forEach((sp) => { if (sp) sp.isSelected = false; });
  });
  let acc = 0;
  const usedGroups = new Set();
  for (const item of flat) {
    if (acc >= targetLight) break;
    if (item.kind === 'sub') {
      item.ref.isSelected = true;
      acc += item.ref.light || 0;
    } else {
      const g = item.ref.group && item.ref.group.trim();
      if (g) {
        const key = `${item.subId}::${g}`;
        if (usedGroups.has(key)) continue;
        usedGroups.add(key);
      }
      item.ref.isSelected = true;
      acc += item.ref.light || 0;
    }
  }
}
export function applyPresetToChecked(areas, pct) {
  areas.forEach((area) => {
    if (area && area.isSelected) applyAreaPercent(area, pct);
  });
}

/* ================================================================
   📅 曜日限定スポット（group:"曜日"）の「本日該当」判定
   ================================================================ */
const WEEKDAY_CHARS = ['日', '月', '火', '水', '木', '金', '土'];
export function isWeekdayRotationSpot(spot) {
  return !!(spot && spot.group && spot.group.trim() === '曜日');
}
function ptTodayWeekdayIdx() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short' }).formatToParts(new Date());
  const wd = parts.find((p) => p.type === 'weekday').value;
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd];
}
export function isSpotActiveToday(spot) {
  if (!isWeekdayRotationSpot(spot)) return true;
  const todayIdx = ptTodayWeekdayIdx();
  const todayChar = WEEKDAY_CHARS[todayIdx];
  return spot.name.indexOf(todayChar) !== -1;
}

/* ================================================================
   ⚡ 効率自動最適化: 効率(火種/秒)の高い順に、必要火種量(targetLightNeeded)に達するまで選ぶ。
   元実装(tai-nomacan.pro)のoptimize()と同じく、スポット単位で候補にして
   （サブエリアのtimeで効率を計算）、目標を超えない範囲で必要なスポットだけ選ぶ。
   targetLightNeededは「目標本数のしきい値 − 繰越火種 − 当日ボーナス火種」で、
   呼び出し側(nomacan-pro-top.js)が求めて渡す。
   ================================================================ */
export function clearAllSelections(areas) {
  areas.forEach((area) => {
    if (!area) return;
    if (getAreaMode(area) === 'main') { area.isSelected = false; } else if (Array.isArray(area.subAreas)) {
      area.subAreas.forEach((sub) => {
        if (!sub) return;
        if (getSubMode(sub) === 'sub') sub.isSelected = false;
        else if (Array.isArray(sub.spots)) sub.spots.forEach((s) => { if (s) s.isSelected = false; });
      });
    }
  });
}

export function optimize(areas, targetLightNeeded) {
  if (!Array.isArray(areas)) return;
  clearAllSelections(areas);

  const refs = [];
  areas.forEach((area, mIdx) => {
    if (!area) return;
    if (getAreaMode(area) === 'main') {
      const lt = area.light || 0; const tm = area.time || 0;
      refs.push({ type: 'main', mIdx, eff: tm > 0 ? lt / tm : 0, light: lt });
    } else if (Array.isArray(area.subAreas)) {
      area.subAreas.forEach((sub, sIdx) => {
        if (!sub) return;
        if (getSubMode(sub) === 'sub') {
          const lt = sub.light || 0; const tm = sub.time || 0;
          refs.push({ type: 'sub', mIdx, sIdx, eff: tm > 0 ? lt / tm : 0, light: lt });
        } else if (Array.isArray(sub.spots)) {
          sub.spots.forEach((spot, spIdx) => {
            // 📅 曜日限定スポットは本日該当しないものを候補から除外する
            if (spot && isSpotActiveToday(spot)) {
              const subTime = sub.time || 0;
              refs.push({ type: 'spot', mIdx, sIdx, spIdx, eff: subTime > 0 ? spot.light / subTime : 0, light: spot.light });
            }
          });
        }
      });
    }
  });

  refs.sort((a, b) => b.eff - a.eff);
  let accumulated = 0;
  // 同一subArea内で同じgroup値は1件まで（手動選択と同じ排他制約）
  const selectedGroupsBySub = new Map();
  for (const ref of refs) {
    if (accumulated >= targetLightNeeded) break;
    if (ref.type === 'main' && areas[ref.mIdx]) {
      areas[ref.mIdx].isSelected = true;
      accumulated += ref.light;
    } else if (ref.type === 'sub' && areas[ref.mIdx] && areas[ref.mIdx].subAreas[ref.sIdx]) {
      areas[ref.mIdx].subAreas[ref.sIdx].isSelected = true;
      accumulated += ref.light;
    } else if (ref.type === 'spot' && areas[ref.mIdx] && areas[ref.mIdx].subAreas[ref.sIdx] && areas[ref.mIdx].subAreas[ref.sIdx].spots[ref.spIdx]) {
      const spot = areas[ref.mIdx].subAreas[ref.sIdx].spots[ref.spIdx];
      const g = spot.group && spot.group.trim();
      if (g) {
        const key = ref.mIdx + '|' + ref.sIdx;
        let groupSet = selectedGroupsBySub.get(key);
        if (!groupSet) { groupSet = new Set(); selectedGroupsBySub.set(key, groupSet); }
        if (groupSet.has(g)) continue; // 同一group内で既に1件選択済みのため除外
        groupSet.add(g);
      }
      spot.isSelected = true;
      accumulated += ref.light;
    }
  }
}

/* ================================================================
   🕯️ キャンドル計算（しきい値テーブル・繰越・日割り見込み）
   ================================================================ */
export const THRESHOLDS = [94, 188, 282, 376, 470, 609, 748, 887, 1026, 1165, 1304, 1443, 1582, 1721, 1860, 1999, 2138, 2277, 2416, 2555];
export function calcCandlesFromLight(totalLight) {
  let candles = 0;
  for (let i = 0; i < THRESHOLDS.length; i++) {
    if (totalLight >= THRESHOLDS[i]) candles = i + 1; else break;
  }
  return candles;
}

/* ================================================================
   🌋 闇の破片(黒)の自動判定（非公式のコミュニティ観測ルールに基づく推測）
   ・レルムは5日周期、時刻と色は12日周期、いずれも毎月1日が起点
   ・時刻はSkyのサーバー基準とされる米国太平洋時間(PT)で判定する
   🩹 以前はSHARD_TIME_PATTERNが5エントリ(mod 5)しか無く、実際の12日周期
   （かつ曜日によって発生しない日＝SHARD_REST_DAYSがある）を反映できて
   いなかった。黒シャードの直近3回分の発生時刻（predictUpcomingBlackShard）
   を正しく算出するために、移植元と同じ12エントリ＋休止曜日つきの定義に
   揃えている。
   ================================================================ */
export const SHARD_REALMS = ['草原', '雨林', '峡谷', '捨て地', '書庫'];
export const SHARD_TIME_PATTERN = [
  { time: '7:40', color: 'red' },
  { time: '2:10', color: 'black' },
  { time: '2:20', color: 'red' },
  { time: '1:50', color: 'black' },
  { time: '3:30', color: 'red' },
  { time: '2:10', color: 'black' },
  { time: '7:40', color: 'red' },
  { time: '1:50', color: 'black' },
  { time: '2:20', color: 'red' },
  { time: '2:10', color: 'black' },
  { time: '3:30', color: 'red' },
  { time: '1:50', color: 'black' },
];
export const SHARD_REST_DAYS = {
  '1:50': ['Sat', 'Sun'],
  '2:10': ['Sun', 'Mon'],
  '7:40': ['Mon', 'Tue'],
  '2:20': ['Tue', 'Wed'],
  '3:30': ['Wed', 'Thu'],
};
const SHARD_WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pacificDateParts(d) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short',
  }).formatToParts(d);
  const map = {};
  parts.forEach((p) => { map[p.type] = p.value; });
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day), weekday: map.weekday };
}
// 指定したPT暦日のn日後を計算（正午UTC基準で加算するのでDSTの影響を受けない）
function addDaysToPacificDate(year, month, day, n) {
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  d.setUTCDate(d.getUTCDate() + n);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), weekday: SHARD_WEEKDAY_NAMES[d.getUTCDay()] };
}
function predictShardForPacificDate(year, month, day, weekday) {
  const realm = SHARD_REALMS[(day - 1) % 5];
  const pattern = SHARD_TIME_PATTERN[(day - 1) % 12];
  const restDays = SHARD_REST_DAYS[pattern.time] || [];
  return { year, month, day, weekday, realm, time: pattern.time, color: pattern.color, occurs: !restDays.includes(weekday) };
}
// 今日(PT)の予測（本日の闇の破片有無の自動判定・「予測に合わせる」ボタンに使う）
export function shardPredictionForDate(d) {
  const { year, month, day, weekday } = pacificDateParts(d);
  return predictShardForPacificDate(year, month, day, weekday);
}
// 今日(PT)から最大31日先まで探索し、最初に見つかる「発生する黒シャード」の日を返す
export function findTodayOrNextBlackShard() {
  let cursor = pacificDateParts(new Date());
  for (let i = 0; i <= 31; i++) {
    const pred = predictShardForPacificDate(cursor.year, cursor.month, cursor.day, cursor.weekday);
    if (pred.occurs && pred.color === 'black') return pred;
    cursor = addDaysToPacificDate(cursor.year, cursor.month, cursor.day, 1);
  }
  return null;
}
// PTの暦日+時刻(壁時計)に対応するUTCミリ秒を求める（DSTを自動考慮／外部ライブラリ不要）
export function pacificWallClockToUtcMs(year, month, day, hour, minute) {
  let guessMs = Date.UTC(year, month - 1, day, hour + 8, minute, 0); // 初期推定 PST(-8)
  for (let i = 0; i < 4; i++) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: false,
    }).formatToParts(new Date(guessMs));
    const get = (t) => parseInt(parts.find((p) => p.type === t)?.value, 10);
    let gotHour = get('hour'); if (gotHour === 24) gotHour = 0;
    const gotMs = Date.UTC(get('year'), get('month') - 1, get('day'), gotHour, get('minute'), 0);
    const wantMs = Date.UTC(year, month - 1, day, hour, minute, 0);
    const diff = wantMs - gotMs;
    if (diff === 0) break;
    guessMs += diff;
  }
  return guessMs;
}
function jstNowParts() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date());
  const map = {};
  parts.forEach((p) => { map[p.type] = p.value; });
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) };
}
const SHARD_BLACK_REPEAT_HOURS = 8; // 黒シャードは初回発生から同日中8時間おきに再発生（受取は初回のみ）
// 指定したPT日付+基準時刻から、8時間おきに繰り返す発生時刻をcount回分、JSTの暦日/時刻に
// 変換して返す（表示用ラベルの組み立てはview側に委ねる。dayDiff: 今日=0, 明日=1, ...）
export function blackShardOccurrencesInJst(hit, count) {
  const [h, min] = hit.time.split(':').map(Number);
  const baseUtcMs = pacificWallClockToUtcMs(hit.year, hit.month, hit.day, h, min);
  const nowJst = jstNowParts();
  const todayJstMs = Date.UTC(nowJst.year, nowJst.month - 1, nowJst.day);
  const results = [];
  for (let i = 0; i < count; i++) {
    const utcMs = baseUtcMs + i * SHARD_BLACK_REPEAT_HOURS * 3600 * 1000;
    const jst = new Date(utcMs + 9 * 3600 * 1000);
    const y = jst.getUTCFullYear(); const m = jst.getUTCMonth() + 1; const dd = jst.getUTCDate();
    const dayDiff = Math.round((Date.UTC(y, m - 1, dd) - todayJstMs) / 86400000);
    results.push({ utcMs, year: y, month: m, day: dd, weekday: jst.getUTCDay(), hour: jst.getUTCHours(), minute: jst.getUTCMinutes(), dayDiff });
  }
  return results;
}
// 今日(PT)の次の発生日（year/month/dayより後）の黒シャードを探す（最大31日先まで）。
// ある発生日の3回をすべて消化した後に、通知リマインダーが次の発生日へ進むために使う
export function findNextBlackShardAfter(year, month, day) {
  let cursor = addDaysToPacificDate(year, month, day, 1);
  for (let i = 0; i <= 31; i++) {
    const pred = predictShardForPacificDate(cursor.year, cursor.month, cursor.day, cursor.weekday);
    if (pred.occurs && pred.color === 'black') return pred;
    cursor = addDaysToPacificDate(cursor.year, cursor.month, cursor.day, 1);
  }
  return null;
}
// 今日のPT暦日キー（「予測に合わせる」の1日1回自動判定に使う。元実装のdateKeyと同じ形式）
export function pacificDateKey(d) {
  const p = pacificDateParts(d || new Date());
  return `${p.year}-${p.month}-${p.day}`;
}
// 今日(PT)に黒シャードが発生するか
export function isBlackShardToday() {
  const p = shardPredictionForDate(new Date());
  return !!(p && p.occurs && p.color === 'black');
}
// 次のデイリーリセット（＝翌PT日の0:00）のUTCミリ秒。夏時間(PDT/PST)はpacificWallClockToUtcMsが吸収する
export function nextDailyResetUtcMs(now) {
  const p = pacificDateParts(now || new Date());
  const n = addDaysToPacificDate(p.year, p.month, p.day, 1);
  return pacificWallClockToUtcMs(n.year, n.month, n.day, 0, 0);
}
// 「本日の大キャンドル群」は個数(0〜4)で保存する（元実装と同じ。×50が火種）。
// 以前のハブ版は火種そのもの(0/50/100/150/200)で保存していたため、読み込み時に個数へ直す
export function normalizeDailyBonus(v) {
  let n = Number(v) || 0;
  if (n >= 50) n = Math.round(n / 50);
  return Math.max(0, Math.min(4, n));
}

// 直近(count)回分の黒シャード発生予測。見つかったレルムとJST発生時刻の配列を返す
// （31日以内に見つからなければnull＝実運用ではまず起こらない）
export function predictUpcomingBlackShard(count) {
  const hit = findTodayOrNextBlackShard();
  if (!hit) return null;
  return { realm: hit.realm, occurrences: blackShardOccurrencesInJst(hit, count) };
}

/* ================================================================
   👁️ 表示するカード（ダッシュボードの各セクションの表示/非表示設定）
   ================================================================ */
export const DEFAULT_VISIBLE_SECTIONS = { candleManage: true, optimization: true, myRoutes: true };

/* ================================================================
   💾 本体の保存/読込
   ================================================================ */
export function saveState(state) {
  try {
    const dataToSave = {
      areasDataVersion: AREAS_DATA_VERSION,
      areas: state.areas,
      carryOverPercent: state.carryOverPercent,
      carryOverGap: state.carryOverGap,
      targetDate: state.targetDate,
      currentCandles: state.currentCandles,
      plannedUsage: state.plannedUsage,
      heartsToSend: state.heartsToSend,
      targetCandlesForOptimization: state.targetCandlesForOptimization,
      candleMemo: state.candleMemo,
      dailyBonusArea: state.dailyBonusArea,
      dailyShard: state.dailyShard,
      visibleSections: state.visibleSections,
      myRoutes: state.myRoutes.map((r) => ({
        id: r.id, name: r.name, memo: r.memo,
        selectedSpotIds: r.selectedSpotIds || [],
        actualSeconds: r.actualSeconds || 0,
        splitTimes: r.splitTimes || {},
        runHistory: Array.isArray(r.runHistory) ? r.runHistory : [],
      })),
    };
    localStorage.setItem(TRACKER_KEY(), JSON.stringify(dataToSave));
  } catch (e) { /* noop */ }
}

// 保存済みデータを読み込む。無ければnullを返す（呼び出し側でloadInitialData相当を行う）
export function loadState() {
  let raw;
  try { raw = localStorage.getItem(TRACKER_KEY()); } catch (e) { return null; }
  if (!raw) return null;
  let decoded;
  try { decoded = JSON.parse(raw); } catch (e) { return null; }
  if (!decoded || !Array.isArray(decoded.areas)) return null;

  const baseMap = {};
  DEFAULT_AREAS.forEach((a) => {
    baseMap[a.name] = { time: Number(a.time) || 0, subs: {} };
    (a.subAreas || []).forEach((s) => {
      baseMap[a.name].subs[s.name] = { time: Number(s.time) || 0, spots: {} };
      (s.spots || []).forEach((sp) => { baseMap[a.name].subs[s.name].spots[sp.name] = Number(sp.time) || 0; });
    });
  });
  const areas = decoded.areas.map((area) => {
    const baseArea = baseMap[area.name];
    return {
      ...area,
      _baseTime: baseArea ? baseArea.time : (area._baseTime ?? Number(area.time) ?? 0),
      subAreas: (area.subAreas || []).map((sub) => {
        const baseSub = baseArea && baseArea.subs[sub.name];
        return {
          ...sub,
          _baseTime: baseSub ? baseSub.time : (sub._baseTime ?? Number(sub.time) ?? 0),
          spots: (sub.spots || []).map((spot) => ({
            ...spot,
            _baseTime: (baseSub && baseSub.spots[spot.name] !== undefined) ? baseSub.spots[spot.name] : (spot._baseTime ?? Number(spot.time) ?? 0),
          })),
        };
      }),
    };
  });

  // スポット構成マイグレーション: データバージョンが上がっていれば既定データへ置換する
  const savedDataVersion = Number(decoded.areasDataVersion) || 1;
  if (savedDataVersion < AREAS_DATA_VERSION) {
    const defaultsForMigration = getDefaultAreas(0);
    areas.forEach((area) => {
      if (!area) return;
      const defArea = defaultsForMigration.find((d) => d.name === area.name);
      if (!defArea) return;
      (area.subAreas || []).forEach((sub) => {
        if (!sub) return;
        const defSub = (defArea.subAreas || []).find((d) => d.name === sub.name);
        if (!defSub || !Array.isArray(defSub.spots) || defSub.spots.length === 0) return;
        const oldSpotsByName = new Map((sub.spots || []).filter((sp) => sp && sp.name).map((sp) => [sp.name, sp]));
        sub.spots = defSub.spots.map((sp) => {
          const existing = oldSpotsByName.get(sp.name);
          return existing ? { ...sp, id: existing.id, isSelected: !!existing.isSelected } : { ...sp, id: uuid(), isSelected: false };
        });
      });
    });
  }

  return {
    areas,
    carryOverPercent: decoded.carryOverPercent || 0,
    carryOverGap: Number(decoded.carryOverGap) || 94,
    candleMemo: decoded.candleMemo || '',
    targetDate: decoded.targetDate || '',
    currentCandles: Number(decoded.currentCandles) || 0,
    plannedUsage: Number(decoded.plannedUsage) || 0,
    heartsToSend: Number(decoded.heartsToSend) || 0,
    targetCandlesForOptimization: Number(decoded.targetCandlesForOptimization) || 20,
    dailyBonusArea: normalizeDailyBonus(decoded.dailyBonusArea),
    dailyShard: decoded.dailyShard || 'none',
    // 旧保存データ（この設定が無かった頃）・一部キーだけ欠けた保存データのどちらでも
    // 全カード表示のデフォルトへフォールバックする（移植元のref({...})とwatchのマージと同じ考え方）
    visibleSections: { ...DEFAULT_VISIBLE_SECTIONS, ...(decoded.visibleSections && typeof decoded.visibleSections === 'object' ? decoded.visibleSections : {}) },
    myRoutes: Array.isArray(decoded.myRoutes) ? decoded.myRoutes.map((r) => ({
      id: r.id || uuid(),
      name: r.name || '',
      memo: r.memo || '',
      isExpanded: false,
      selectedSpotIds: Array.isArray(r.selectedSpotIds) ? r.selectedSpotIds : [],
      actualSeconds: Number(r.actualSeconds) || 0,
      splitTimes: (r.splitTimes && typeof r.splitTimes === 'object') ? r.splitTimes : {},
      runHistory: Array.isArray(r.runHistory) ? r.runHistory : [],
      generatedSpell: '',
      generatedTextExport: '',
    })) : [],
  };
}

// 🩹 移植時に修正: 元実装はtimeMult=0で初期化し、後段のapplyTimeMult()
// （現在は削除済みの「習熟度アンケート」からしか呼ばれない設計）で本来の
// 秒数を書き込む二段構えだったが、アンケート機能が別作業で撤去された際に
// この初期化ロジックだけ取り残され、新規ユーザーは所要時間が常に0秒に
// なってしまう不具合が標準版（tai-nomacan.pro）に残っている。ここでは
// 最初から実際のtimeMultで初期化する一段構えにして、その不具合を踏襲しない。
export function loadInitialData(timeMult) {
  return {
    areas: getDefaultAreas(timeMult == null ? 1.7 : timeMult),
    carryOverPercent: 0,
    carryOverGap: 94,
    candleMemo: '',
    targetDate: '',
    currentCandles: 0,
    plannedUsage: 0,
    heartsToSend: 0,
    targetCandlesForOptimization: 20,
    dailyBonusArea: 0,
    dailyShard: 'none',
    visibleSections: { ...DEFAULT_VISIBLE_SECTIONS },
    myRoutes: [],
  };
}

/* ================================================================
   💰 所持通貨（他ツール横断で共有するキャンドル所持数）
   ================================================================ */
export function readOwnedCandle() {
  try {
    const wish = JSON.parse(localStorage.getItem(CURRENCY_KEY())) || {};
    return Math.max(0, wish.candle || 0);
  } catch (e) { return 0; }
}
export function writeOwnedCandle(rawValue) {
  const n = Math.max(0, Number(rawValue) || 0);
  let wish;
  try { wish = JSON.parse(localStorage.getItem(CURRENCY_KEY())) || {}; } catch (e) { wish = {}; }
  wish.candle = n;
  try { localStorage.setItem(CURRENCY_KEY(), JSON.stringify(wish)); } catch (e) { /* noop */ }
}

/* ================================================================
   🧭 マイルート
   ================================================================ */
export function buildSelectedSpotIds(areas) {
  const selectedIds = [];
  areas.forEach((area) => {
    if (!area) return;
    const aMode = getAreaMode(area);
    if (aMode === 'main') {
      if (area.isSelected) selectedIds.push(area.id);
    } else if (Array.isArray(area.subAreas)) {
      area.subAreas.forEach((sub) => {
        if (!sub) return;
        const sMode = getSubMode(sub);
        if (sMode === 'sub') { if (sub.isSelected) selectedIds.push(sub.id); } else if (Array.isArray(sub.spots)) {
          sub.spots.forEach((s) => { if (s && s.isSelected) selectedIds.push(s.id); });
        }
      });
    }
  });
  return selectedIds;
}

export function applyRoute(areas, route) {
  if (!route || !Array.isArray(route.selectedSpotIds)) return;
  areas.forEach((area) => {
    if (!area) return;
    const aMode = getAreaMode(area);
    if (aMode === 'main') {
      area.isSelected = route.selectedSpotIds.includes(area.id);
    } else if (Array.isArray(area.subAreas)) {
      area.subAreas.forEach((sub) => {
        if (!sub) return;
        const sMode = getSubMode(sub);
        if (sMode === 'sub') {
          sub.isSelected = route.selectedSpotIds.includes(sub.id);
        } else if (Array.isArray(sub.spots)) {
          sub.spots.forEach((s) => { if (s) s.isSelected = route.selectedSpotIds.includes(s.id); });
          enforceSpotGroupExclusivity(sub.spots);
        }
      });
    }
  });
}

export function getRouteStats(areas, route) {
  let light = 0; let time = 0;
  if (route && Array.isArray(route.selectedSpotIds)) {
    areas.forEach((area) => {
      if (!area) return;
      if (route.selectedSpotIds.includes(area.id)) { light += area.light || 0; time += area.time || 0; return; }
      if (Array.isArray(area.subAreas)) {
        area.subAreas.forEach((sub) => {
          if (!sub) return;
          if (route.selectedSpotIds.includes(sub.id)) { light += sub.light || 0; time += sub.time || 0; return; }
          if (Array.isArray(sub.spots)) {
            let subHasSelected = false;
            sub.spots.forEach((s) => {
              if (s && route.selectedSpotIds.includes(s.id)) { light += s.light || 0; subHasSelected = true; }
            });
            if (subHasSelected) time += (sub.time || 0);
          }
        });
      }
    });
  }
  const eff = time > 0 ? (light / time) : 0.0;
  return { light, time, eff };
}

export function getRouteAreaNames(areas, route, displayName) {
  const names = [];
  if (!route || !Array.isArray(route.selectedSpotIds)) return '';
  route.selectedSpotIds.forEach((id) => {
    for (const area of areas) {
      if (!area) continue;
      if (area.id === id) { names.push(displayName(area.name)); break; }
      if (Array.isArray(area.subAreas)) {
        let found = false;
        for (const sub of area.subAreas) {
          if (!sub) continue;
          if (sub.id === id) { names.push(`${displayName(area.name)}・${displayName(sub.name)}`); found = true; break; }
          if (Array.isArray(sub.spots)) {
            const sp = sub.spots.find((s) => s.id === id);
            if (sp) { names.push(`${displayName(sub.name)}(${displayName(sp.name)})`); found = true; break; }
          }
        }
        if (found) break;
      }
    }
  });
  return names.join(' → ');
}

export function getSpotNameById(areas, id, displayName, unknownLabel) {
  for (const area of areas) {
    if (!area) continue;
    if (area.id === id) return displayName(area.name);
    if (Array.isArray(area.subAreas)) {
      for (const sub of area.subAreas) {
        if (!sub) continue;
        if (sub.id === id) return `${displayName(area.name)}・${displayName(sub.name)}`;
        if (Array.isArray(sub.spots)) {
          const sp = sub.spots.find((s) => s.id === id);
          if (sp) return `${displayName(sub.name)}・${displayName(sp.name)}`;
        }
      }
    }
  }
  return unknownLabel;
}

/* 📤 ルート呪文（base64エンコードされたJSON）のエンコード/デコード */
export function generateRouteSpell(areas, route) {
  const packedSpots = [];
  if (Array.isArray(route.selectedSpotIds)) {
    route.selectedSpotIds.forEach((id) => {
      let found = false;
      for (const area of areas) {
        if (!area) continue;
        if (area.id === id) {
          packedSpots.push({ mainName: area.name, subName: area.name, spotName: area.name, light: area.light, time: area.time, group: area.group || '' });
          found = true; break;
        }
        if (Array.isArray(area.subAreas)) {
          for (const sub of area.subAreas) {
            if (!sub) continue;
            if (sub.id === id) {
              packedSpots.push({ mainName: area.name, subName: sub.name, spotName: sub.name, light: sub.light, time: sub.time, group: sub.group || '' });
              found = true; break;
            }
            if (Array.isArray(sub.spots)) {
              const sp = sub.spots.find((s) => s.id === id);
              if (sp) {
                packedSpots.push({ mainName: area.name, subName: sub.name, spotName: sp.name, light: sp.light, time: sp.time, group: sp.group || '' });
                found = true; break;
              }
            }
          }
        }
        if (found) break;
      }
    });
  }
  const exportData = { name: route.name, memo: route.memo, actualSeconds: route.actualSeconds || 0, spots: packedSpots };
  const uint8array = new TextEncoder().encode(JSON.stringify(exportData));
  let binString = '';
  for (let i = 0; i < uint8array.length; i++) binString += String.fromCharCode(uint8array[i]);
  return btoa(binString);
}

export function applyRouteSpell(areas, spellText, importedNamePrefix) {
  const binString = atob(spellText.trim());
  const uint8array = new Uint8Array(binString.length);
  for (let i = 0; i < binString.length; i++) uint8array[i] = binString.charCodeAt(i);
  const decoded = JSON.parse(new TextDecoder().decode(uint8array));
  if (!decoded.name || !Array.isArray(decoded.spots)) throw new Error('Invalid format');

  const importedSpotIds = [];
  const SHARED_AREA_NAME_JA = '📥 共有された外部エリア';
  decoded.spots.forEach((spInfo) => {
    let foundSpotId = null;
    for (const area of areas) {
      if (!area || area.name !== spInfo.mainName) continue;
      if (spInfo.subName === spInfo.mainName && spInfo.spotName === spInfo.mainName) { foundSpotId = area.id; break; }
      if (Array.isArray(area.subAreas)) {
        for (const sub of area.subAreas) {
          if (!sub || sub.name !== spInfo.subName) continue;
          if (spInfo.spotName === spInfo.subName) { foundSpotId = sub.id; break; }
          if (Array.isArray(sub.spots)) {
            const sp = sub.spots.find((s) => s && s.name === spInfo.spotName);
            if (sp) { foundSpotId = sp.id; break; }
          }
        }
      }
      if (foundSpotId) break;
    }
    if (!foundSpotId) {
      let sharedMain = areas.find((a) => a && a.name === SHARED_AREA_NAME_JA);
      if (!sharedMain) { sharedMain = { id: uuid(), name: SHARED_AREA_NAME_JA, isExpanded: true, subAreas: [] }; areas.push(sharedMain); }
      let sharedSub = sharedMain.subAreas.find((s) => s && s.name === spInfo.subName);
      if (!sharedSub) { sharedSub = { id: uuid(), name: spInfo.subName, isExpanded: true, spots: [] }; sharedMain.subAreas.push(sharedSub); }
      const newSpot = { id: uuid(), name: spInfo.spotName, light: Number(spInfo.light) || 0, time: Number(spInfo.time) || 0, isSelected: false, group: spInfo.group || '' };
      sharedSub.spots.push(newSpot);
      foundSpotId = newSpot.id;
    }
    importedSpotIds.push(foundSpotId);
  });

  return {
    id: uuid(),
    name: `${importedNamePrefix} ${decoded.name}`,
    memo: decoded.memo || '',
    selectedSpotIds: importedSpotIds,
    isExpanded: true,
    actualSeconds: decoded.actualSeconds || 0,
    splitTimes: {},
    runHistory: [],
    generatedSpell: '',
    generatedTextExport: '',
  };
}

/* ================================================================
   🌟 有名プレイヤー公開の「ソロ・試練なし 20本ルート」テンプレート
   ================================================================ */
export const TEMPLATE_ROUTE_AREA_NAME = '20本ルート（ソロ・試練なし）';
export const FAMOUS_ROUTE_TEMPLATE = {
  routeName: '20本ルート（ソロ・試練なし）',
  memo: '有名プレイヤー公開のルートを再現したテンプレートです。※チャレスペ・パン焼きはシーズンパスやフレンドのハート等の条件付きのため、状況により獲得できないことがあります（その場合は個別にチェックを外してください）。',
  subAreas: [
    { name: '雨林（固定）', time: 990, spots: [
      { name: '開拓地〜3門', light: 45 },
      { name: '小川', light: 227 },
      { name: '晴れ間', light: 42 },
      { name: '※チャレスペ', light: 750 },
      { name: 'パン焼き', light: 540 },
      { name: '神殿前', light: 173 },
    ] },
    { name: '草原', time: 480, spots: [
      { name: '入ってすぐ', light: 10 },
      { name: '蝶々の住処', light: 30 },
      { name: '鳥の巣', light: 30 },
      { name: '楽園', light: 299 },
      { name: 'カメの大闇', light: 51 },
      { name: '二枚貝', light: 100 },
      { name: '貝（小）×n', light: 200 },
    ] },
    { name: '書庫', time: 240, spots: [
      { name: '1F ベンチ近く', light: 5 },
      { name: '1F DC', light: 49 },
      { name: '1F 台座の近く', light: 11 },
      { name: '2F DC1', light: 48 },
      { name: '2F DC2', light: 48 },
      { name: '2F 4人扉前', light: 10 },
      { name: '4F DC1', light: 47 },
      { name: '4F DC2', light: 47 },
      { name: '4F DC3', light: 47 },
      { name: '4F DC4', light: 50 },
      { name: '4F その他', light: 18 },
    ] },
    { name: '花鳥卿', time: 390, spots: [
      { name: 'ホーム', light: 27 },
      { name: 'カフェ', light: 50 },
      { name: 'アリスカフェ', light: 284 },
      { name: 'カーニバル', light: 210 },
    ] },
    { name: '雨林→峡谷', time: 390, spots: [
      { name: '風の街道 DC', light: 50 },
      { name: '風の街道 諸々', light: 25 },
      { name: '隠者の峠 DC', light: 50 },
      { name: 'レースキャンドル', light: 38 },
      { name: '隠者レース', light: 200 },
      { name: '夢見DC1', light: 50 },
      { name: '夢見DC2', light: 50 },
      { name: '音楽', light: 100 },
    ] },
    { name: '他', time: 0, spots: [
      { name: 'DDC', light: 200 },
    ] },
    { name: '峡谷', time: 288, spots: [
      { name: 'スライダー', light: 40 },
      { name: 'スケートリンク', light: 39 },
      { name: '陸レ', light: 140 },
      { name: '神殿内', light: 75 },
    ] },
  ],
};

export function ensureTemplateArea(areas) {
  let templateArea = areas.find((a) => a && a.name === TEMPLATE_ROUTE_AREA_NAME);
  if (!templateArea) {
    templateArea = {
      id: uuid(),
      name: TEMPLATE_ROUTE_AREA_NAME,
      isExpanded: true,
      subAreas: FAMOUS_ROUTE_TEMPLATE.subAreas.map((sub) => ({
        id: uuid(),
        name: sub.name,
        isExpanded: true,
        light: 0,
        time: sub.time,
        isSelected: false,
        spots: sub.spots.map((sp) => ({ id: uuid(), name: sp.name, light: sp.light, time: 0, isSelected: false, group: '' })),
      })),
    };
    areas.push(templateArea);
  }
  return templateArea;
}

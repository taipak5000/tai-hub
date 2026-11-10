/* ================================================================
   event-dashboard.js — 「今日・今週・今月」イベントダッシュボード（カレンダー・
   デイリー予定・今日/今週/今月のカウントダウン・通知リマインダー）の、
   4サイト（wings/companion/spirit-catalog/profile）共通で再利用できる
   マウント可能パネル。

   移植元: C:\Users\user\Downloads\skyツール\wings\index.html の
   pfDash系・pfReminder系 一式（旧実装の行2783-3836・3628-3836付近。
   このサブシステムは4サイトでほぼ同一実装が重複していたうち、wingsの
   ものが最もwings固有データに依存しない＝最も汎用的と判断されたため、
   これを移植のベースにした）。

   ── これは「js/chrome/dash-modal.js」とは別物 ──────────────────
   dash-modal.jsはサイトドックの「ダッシュボード」ボタンから開ける、
   どのツールを見ていても開ける軽量な単一モーダル（シーズン・開催中
   イベント・再訪精霊の状態を1つのリストにまとめただけの簡易版）。
   対してこのモジュールは、4サイトそれぞれが「自分のページ内の一区画」
   として埋め込む、カレンダー・デイリー予定・通知リマインダーまで含む
   フル機能版。グローバルなシングルトンモーダルではなく、呼び出し側が
   用意したコンテナ要素にレンダリングするだけのプレーンな部品である
   （呼び出し側がそれをモーダルの中身にするか、ページ内セクションに
   埋め込むかは自由。wings-view.jsは元のUXに合わせてモーダルの中身として使う）。

   ── 公開API ────────────────────────────────────────────────
     export function mount(container, opts?)   … containerの中身をこのパネルで
       置き換え、1秒ごとのカウントダウン再描画タイマーを開始する。
       同じcontainerに対して何度呼んでもよい（前回のタイマーは自動停止
       してから作り直す）。初回呼び出し時に一度だけ、通知リマインダーの
       バックグラウンドチェック（オプトイン済み・許可済みの場合のみ）も
       開始する（原実装のpfReminderInit()と同じタイミング・条件）。
       opts.icsExport: true を渡すと「カレンダーへの登録」.icsエクスポート
       ボタンを追加表示する（下記参照。既定はfalse＝非表示）。
     export function unmount()          … 1秒ごとの再描画タイマーを止め、
       container参照を破棄する。通知リマインダーのタイマーはここでは
       止めない（原実装がページを開いている間ずっと動き続けるのと同じ
       挙動——パネルを閉じても、オプトイン済みの通知は引き続き届く）。
     export function getEndingSoonSeason() … 今のシーズンが7日以内に終了
       する場合だけ { seasonJa, seasonEn, daysLeft } を返す（それ以外は
       null）。ホストツールが自分の季節データ（例: wingsのSEASON_SPIRITS）
       とseasonEnで突き合わせて「まもなく終了する季節の、まだ集めていない
       ○○」的な警告を出すために使う（wingsのpfGetEndingSoonSeasonInfo
       相当）。データは直接importの同期データなので、mount()前でも呼べる。

   ── データ互換性 ──────────────────────────────────────────────
   通知リマインダー設定・通知済みログのキーは元実装のまま、あえて
   nsKey()で名前空間化しない・4サイト間で共有する（元のエコシステムでも
   これらのキーは各サイトが同じ名前で独立に重複実装していた＝実質共有
   されていたのと同じ挙動のため、ここでは明示的にそれを踏襲する）：
     sky_dash_reminder_enabled     — '1' | '0'
     sky_dash_reminder_minutes     — 分数の文字列（10/30/60/180/1440）
     sky_dash_reminder_notified_v1 — 通知済み対象キーのJSON配列（最大200件）

   ── SPA化による簡略化 ────────────────────────────────────────
   元実装は「自分のindex.htmlを自己fetch+正規表現抽出」ではなく、常に
   tai-item/index.htmlを毎回fetchしてCURRENT_SEASON等を取り出していた
   （元々複数サイトでitemのデータを二重管理しないための設計）。tai-hubは
   features/item/data/season-data.js を直接importできるため、そのfetch
   自体が丸ごと不要になった（dash-modal.js・nomacan-view.jsの日付
   クイックピック機能と同じ改善）。これに伴い、非同期のロード状態
   （pfDashLoading/「読み込み中…」プレースホルダー）も不要になった。

   ── 意図的に移植しなかったもの ────────────────────────────────
   - フォーカストラップ（Tabキーをモーダル内に閉じ込める仕組み）:
     tai-hubの既存モーダル(pf-modal.js/settings-modal.js/achievement-share.js
     等)がいずれもこの水準のフォーカストラップを実装していない方針に
     合わせ、同じ水準（背景タップ・Escキー(shortcuts.js)での閉じるのみ）
     にしている。

   ── .icsカレンダーエクスポート（オプトイン制）────────────────────
   移植元のwings/index.htmlにはこの機能が存在しなかった（grep調査で
   確認済み）ため当初は移植していなかったが、4サイトのうちcompanion/
   index.htmlだけはpfDashExportIcs()として実装を持っていることが判明した
   （spirit-catalog/profileの原実装にも存在しないことを再確認済み）。
   ホストツールごとに機能の有無が割れるため、全ホスト共通の既定では
   出さず、mount(container, {icsExport: true}) を明示的に渡したホストだけに
   「カレンダーへの登録」ボタンを表示する形にした（現状companion-view.js
   のみが有効化している）。実装（icsBuildEvent/icsEscape/icsDate/exportIcs）は
   companion/index.htmlのpfIcsBuildEvent/pfIcsEscape/pfIcsDate/
   pfDashExportIcsを、このモジュール既存のshardInfoForOffset()/
   nextPacificMidnight()/nextEdenResetTarget()等の共通計算関数を再利用する
   形で移植した。
   ================================================================ */

import { CURRENT_LANG } from '../../js/i18n.js';
import { pacificFakeToReal, cycleBounds, cycleIndexAt, ptOffsetChanges, ptParts, ptToReal } from '../../js/pacific-time.js';
import {
  CURRENT_SEASON, EVENT_SCHEDULE, CANDLE_BONUS_SCHEDULE, NEXT_UPDATE, REVISIT_SPIRIT_SCHEDULES,
  seasonInProgress, scheduleWithUpcomingSeason,
} from '../item/data/season-data.js';

function t(ja, en) { return CURRENT_LANG === 'en' ? en : ja; }

/* ================================================================
   🌐 このパネル固有の文言（wings/index.htmlのI18N辞書からdash*キーのみ移植）
   ================================================================ */
const REALM_LABEL = {
  prairie: { ja: '草原', en: 'Prairie' },
  forest: { ja: '雨林', en: 'Forest' },
  valley: { ja: '峡谷', en: 'Valley' },
  wasteland: { ja: '捨てられた地', en: 'Wasteland' },
  vault: { ja: '書庫', en: 'Vault' },
};
function srLabel(realmKey) { return t(REALM_LABEL[realmKey].ja, REALM_LABEL[realmKey].en); }

// 季節名・期間限定イベント名の英訳（未収録分は日本語のままフォールバック）
const DASH_EVENT_NAME_EN = {
  '親愛なるファン・ゴッホへ': 'Dear Van Gogh',
  '遥かなる真珠の季節': 'Season of Pearl',
  '陽光の日々': 'Days of Sunlight',
  '光に染まるイベント': 'Event of Radiant Light',
  '来訪する精霊団': 'Traveling Spirit Troupe',
  '夏のキャンプ': 'Summer Camp',
  '大キャン２倍・シーズンキャンドル２倍': 'Double Grand & Season Candles',
  '月灯りの日々': 'Days of Moonlight',
  'いたずらな日々': 'Days of Mischief',
  'お洒落な日々': 'Days of Style',
  'ハート2倍キャンペーン': 'Double Hearts Event',
};
function dashEventName(name) {
  return CURRENT_LANG === 'en' ? (DASH_EVENT_NAME_EN[name] || name) : name;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ================================================================
   🗓️ 太平洋時間・原罪週間リセット
   ================================================================ */
function pacificNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
}
function nextEdenResetTarget() {
  const now = pacificNow();
  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);
  let addDays = (7 - todayMidnight.getDay()) % 7;
  if (addDays === 0 && now.getTime() > todayMidnight.getTime()) addDays = 7;
  const target = new Date(todayMidnight);
  target.setDate(target.getDate() + addDays);
  return pacificFakeToReal(target);
}

/* ================================================================
   闇の破片（赤闇・黒闇）の出現予測。コミュニティ製の予測ツール
   https://github.com/PlutoyDev/sky-shards （src/data/shard.ts）のアルゴリズムを
   忠実に移植したもの。月の日付・曜日だけから決定論的に計算できる。
   ================================================================ */
const SHARD_REALMS = ['prairie', 'forest', 'valley', 'wasteland', 'vault'];
const SHARD_LOCATIONS = [
  { prairie: { ja: '蝶々の住処', en: 'Butterfly Fields' }, forest: { ja: '小川', en: 'Brook' }, valley: { ja: 'スケートリンク', en: 'Ice Rink' }, wasteland: { ja: '最初のエリア', en: 'First Area' }, vault: { ja: '星月夜の砂漠', en: 'Starlight Desert' } },
  { prairie: { ja: '神殿エリア', en: 'Temple Area' }, forest: { ja: '神殿前', en: 'Temple Approach' }, valley: { ja: 'スケートリンク', en: 'Ice Rink' }, wasteland: { ja: '戦場', en: 'Battlefield' }, vault: { ja: '星月夜の砂漠', en: 'Starlight Desert' } },
  { prairie: { ja: '洞窟', en: 'Caves' }, forest: { ja: '神殿奥', en: 'Behind the Temple' }, valley: { ja: '夢見の町', en: 'Village of Dreams' }, wasteland: { ja: '墓所', en: 'Graveyard' }, vault: { ja: '海月の入り江', en: 'Jellyfish Cove' } },
  { prairie: { ja: '鳥の巣', en: 'Bird Nest' }, forest: { ja: 'ツリーハウス', en: 'Treehouse' }, valley: { ja: '夢見の町', en: 'Village of Dreams' }, wasteland: { ja: '座礁船', en: 'Shipwreck' }, vault: { ja: '海月の入り江', en: 'Jellyfish Cove' } },
  { prairie: { ja: '楽園の島々', en: 'Sanctuary Islands' }, forest: { ja: '晴れ間', en: 'Clearing' }, valley: { ja: '隠者の峠', en: 'Hermit Valley' }, wasteland: { ja: '忘れられた方舟', en: 'Forgotten Ark' }, vault: { ja: '海月の入り江', en: 'Jellyfish Cove' } },
];
const SHARD_GROUPS = [
  { noShardWkDay: [6, 0], intervalH: 8, offsetH: 1, offsetM: 50 },
  { noShardWkDay: [0, 1], intervalH: 8, offsetH: 2, offsetM: 10 },
  { noShardWkDay: [1, 2], intervalH: 6, offsetH: 7, offsetM: 40 },
  { noShardWkDay: [2, 3], intervalH: 6, offsetH: 2, offsetM: 20 },
  { noShardWkDay: [3, 4], intervalH: 6, offsetH: 3, offsetM: 30 },
];
// dayOffset=0が「今日」。.icsエクスポートが向こう14日分をまとめて計算する
// ために日付をずらせるよう一般化した（shardInfo()自体はdayOffset=0の呼び出し）。
function shardInfoForOffset(dayOffset) {
  const pacNow = pacificNow();
  const today = new Date(pacNow);
  today.setHours(0, 0, 0, 0);
  today.setDate(today.getDate() + dayOffset);
  const dayOfMth = today.getDate();
  const dayOfWk = today.getDay();
  const isRed = dayOfMth % 2 === 1;
  const realmIdx = (dayOfMth - 1) % 5;
  const groupIdx = isRed ? (Math.floor((dayOfMth - 1) / 2) % 3) + 2 : Math.floor(dayOfMth / 2) % 2;
  const group = SHARD_GROUPS[groupIdx];
  const hasShard = !group.noShardWkDay.includes(dayOfWk);
  const realm = SHARD_REALMS[realmIdx];
  const location = SHARD_LOCATIONS[groupIdx][realm];
  const firstStartFake = new Date(today);
  firstStartFake.setHours(group.offsetH, group.offsetM, 0, 0);
  const intervalMs = group.intervalH * 3600000;
  const occurrences = [0, 1, 2].map(i => pacificFakeToReal(new Date(firstStartFake.getTime() + intervalMs * i)));
  return { isRed, hasShard, realm, location, occurrences };
}
function shardInfo() { return shardInfoForOffset(0); }
function nextShardTime() {
  const pacNow = pacificNow();
  for (let dayOffset = 0; dayOffset <= 10; dayOffset++) {
    const base = new Date(pacNow);
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() + dayOffset);
    const dayOfMth = base.getDate();
    const dayOfWk = base.getDay();
    const isRed = dayOfMth % 2 === 1;
    const groupIdx = isRed ? (Math.floor((dayOfMth - 1) / 2) % 3) + 2 : Math.floor(dayOfMth / 2) % 2;
    const group = SHARD_GROUPS[groupIdx];
    if (group.noShardWkDay.includes(dayOfWk)) continue;
    const firstStartFake = new Date(base);
    firstStartFake.setHours(group.offsetH, group.offsetM, 0, 0);
    const intervalMs = group.intervalH * 3600000;
    for (let i = 0; i < 3; i++) {
      const d = pacificFakeToReal(new Date(firstStartFake.getTime() + intervalMs * i));
      if (d.getTime() > Date.now()) return d;
    }
  }
  return null;
}
function formatShardTime(d) {
  const mm = d.getMonth() + 1, dd = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0'), mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mi}`;
}
// 闇の破片は出現（開始）から4時間で終わる（星のキャンドル計算機の END_LAG_SEC と同じ規則）
const SHARD_DURATION_MS = 4 * 3600000;
function shardEnd(start) { return new Date(start.getTime() + SHARD_DURATION_MS); }
// 「10/27 14:40〜18:40」。日付をまたぐ時だけ終了側にも日付を付ける
function formatShardRange(start) {
  const end = shardEnd(start);
  const sameDay = start.getDate() === end.getDate() && start.getMonth() === end.getMonth();
  const endLabel = sameDay
    ? `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
    : formatShardTime(end);
  return `${formatShardTime(start)}〜${endLabel}`;
}

// 日替わり大キャンドル：太平洋時間0時に、草原→雨林→峡谷→捨てられた地→書庫の順で毎日切り替わる固定ローテーション
// 大キャンドルの地域の並び（草原→雨林→峡谷→捨てられた地→書庫の順で毎日切り替わる）。起点は「2026/11/4(太平洋時間)が雨林」（翌日11/5は峡谷）。
// 以前の起点「2026/10/27が書庫」のまま数えると11/4が峡谷になり、実際より1日進んでいた（10/27〜11/4の間で1日ずれたため、利用者の報告で起点を取り直した）。
// ※ クエスト・シーズンキャンドルは、以前の起点（2026/10/27=書庫）で数えた「2日前の大キャンドル」と同じ地域
//   （10/27=峡谷、10/28=捨てられた地で確認）。大キャンドルの起点を取り直した時に一緒に動かないよう、起点を別に持つ。
const GRAND_CANDLE_ORDER = ['prairie', 'forest', 'valley', 'wasteland', 'vault'];
const GRAND_CANDLE_ANCHOR_DATE = new Date(2026, 10, 4); // 月は0始まりなので10=11月
const GRAND_CANDLE_ANCHOR_REALM_IDX = 1; // 雨林（GRAND_CANDLE_ORDERの添字）
const QUEST_CANDLE_ANCHOR_DATE = new Date(2026, 9, 27); // 月は0始まりなので9=10月
const QUEST_CANDLE_ANCHOR_REALM_IDX = 4; // 以前の大キャンドルの起点（10/27=書庫）と同じ値。ここから数えた2日前がクエスト・シーズンキャンドル
function grandCandleRealm(dayOffset = 0, anchorDate = GRAND_CANDLE_ANCHOR_DATE, anchorIdx = GRAND_CANDLE_ANCHOR_REALM_IDX) {
  const pacNow = pacificNow();
  const today = new Date(pacNow);
  today.setHours(0, 0, 0, 0);
  today.setDate(today.getDate() + dayOffset);
  const anchor = new Date(anchorDate);
  anchor.setHours(0, 0, 0, 0);
  const daysSince = Math.round((today - anchor) / 86400000);
  const idx = (((anchorIdx + daysSince) % 5) + 5) % 5;
  return GRAND_CANDLE_ORDER[idx];
}

// ウニ焼き・パン焼き・亀闇：2時間おき（太平洋時間の偶数時）に発生する協力プレイイベント。
// 太平洋時間基準で計算しているため、日本時間では夏時間中は偶数時、標準時（11月第1日曜〜3月）は奇数時に自動で切り替わる
function nextEvenHourEvent(minuteOffset) {
  const pacNow = pacificNow();
  const candidate = new Date(pacNow);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(minuteOffset);
  const curHour = candidate.getHours();
  candidate.setHours(curHour % 2 === 0 ? curHour : curHour - 1);
  if (candidate.getTime() <= pacNow.getTime()) candidate.setTime(candidate.getTime() + 2 * 3600000);
  return pacificFakeToReal(candidate);
}
function nextPacificMidnight() {
  const pacNow = pacificNow();
  const target = new Date(pacNow);
  target.setHours(24, 0, 0, 0);
  return pacificFakeToReal(target);
}

function countdown(target) {
  const ms = target - new Date();
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hh = String(Math.floor((totalSec % 86400) / 3600)).padStart(2, '0');
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  const dayUnit = t('日', 'd');
  return days > 0 ? `<b class="dash-count-num">${days}</b><span class="dash-count-unit">${dayUnit}</span> ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}
function countdownPlain(target) {
  const ms = target - new Date();
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hh = String(Math.floor((totalSec % 86400) / 3600)).padStart(2, '0');
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return days > 0 ? `${days}${t('日', 'd')} ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}

// 「実際の残り時間」で今日/今週/今月へ振り分ける（24時間未満=今日、7日未満=今週、それ以上=今月）
function bucketFor(target) {
  if (!target) return 'month';
  const ms = target.getTime() - Date.now();
  const MS_DAY = 24 * 60 * 60 * 1000, MS_WEEK = 7 * MS_DAY;
  if (ms <= MS_DAY) return 'today';
  if (ms <= MS_WEEK) return 'week';
  return 'month';
}

function soonestFuture(dates) {
  const now = new Date();
  const future = dates.filter(d => d > now).sort((a, b) => a - b);
  return future.length ? future[0] : null;
}

function revisitStatus(schedule) {
  if (!schedule) return null;
  const now = new Date();
  if (schedule.intervalDays) {
    if (!schedule.anchorStart || !schedule.anchorEnd) return null;
    const k = cycleIndexAt(schedule, now);
    const start = cycleBounds(schedule, k).start;
    const end = cycleBounds(schedule, k).end;
    if (start <= now && now <= end) return { active: true, daysLeft: Math.ceil((end - now) / 86400000), target: end };
    const nextStart = now < start ? start : cycleBounds(schedule, k + 1).start;
    return { active: false, daysUntil: Math.ceil((nextStart - now) / 86400000), target: nextStart };
  }
  if (!schedule.start || !schedule.end) return null;
  const start = new Date(schedule.start), end = new Date(schedule.end);
  if (start <= now && now <= end) return { active: true, daysLeft: Math.ceil((end - now) / 86400000), target: end };
  if (now < start) return { active: false, daysUntil: Math.ceil((start - now) / 86400000), target: start };
  return null;
}
function revisitStatuses(schedules) {
  return (schedules || [])
    .map(schedule => ({ schedule, status: revisitStatus(schedule) }))
    .filter(x => x.status);
}

/* ================================================================
   📅 月次カレンダー（今月分を表示）
   ================================================================ */
function occurrencesInRange(schedule, rangeStart, rangeEnd) {
  if (!schedule) return [];
  if (schedule.intervalDays) {
    if (!schedule.anchorStart || !schedule.anchorEnd) return [];
    const out = [];
    let k = cycleIndexAt(schedule, rangeStart) - 1;
    for (let guard = 0; guard < 400; guard++, k++) {
      const cycle = cycleBounds(schedule, k);
      const s = cycle.start;
      if (s.getTime() > rangeEnd.getTime()) break;
      const e = cycle.end;
      if (e.getTime() >= rangeStart.getTime()) out.push({ start: s, end: e });
    }
    return out;
  }
  if (!schedule.end) return [];
  const e = new Date(schedule.end);
  const s = schedule.start ? new Date(schedule.start) : null;
  if (e.getTime() < rangeStart.getTime()) return [];
  if (s && s.getTime() > rangeEnd.getTime()) return [];
  return [{ start: s, end: e }];
}
const DASH_CAL_BAR_PALETTE = [
  '#e775a0', '#3c768e', '#f2b32b', '#b27764', '#f48a77',
  '#06d1b6', '#4e91e1', '#b7a517', '#f16262',
];
function textColorFor(hex) {
  const c = hex.replace('#', '');
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const r = lin(parseInt(c.slice(0, 2), 16));
  const g = lin(parseInt(c.slice(2, 4), 16));
  const b = lin(parseInt(c.slice(4, 6), 16));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  const contrastWithBlack = (luminance + 0.05) / 0.05;
  return contrastWithWhite >= contrastWithBlack ? '#fff' : '#000';
}
function calendarBarItems(data, year, month) {
  const rangeStart = new Date(year, month, 1, 0, 0, 0);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rangeEnd = new Date(year, month, daysInMonth, 23, 59, 59);
  const items = [];
  const colorMap = new Map();
  function colorFor(name) {
    if (!colorMap.has(name)) colorMap.set(name, DASH_CAL_BAR_PALETTE[colorMap.size % DASH_CAL_BAR_PALETTE.length]);
    return colorMap.get(name);
  }
  function pushItems(schedule, name, colorKey) {
    const key = colorKey !== undefined ? colorKey : name;
    occurrencesInRange(schedule, rangeStart, rangeEnd).forEach(o => {
      const clipStart = o.start && o.start > rangeStart ? o.start : rangeStart;
      const clipEnd = o.end < rangeEnd ? o.end : rangeEnd;
      if (clipEnd < clipStart) return;
      const barColor = colorFor(key);
      items.push({
        name,
        color: barColor,
        textColor: textColorFor(barColor),
        startDay: clipStart.getDate(),
        endDay: clipEnd.getDate(),
        trueStart: !!o.start && o.start.getTime() >= rangeStart.getTime(),
        trueEnd: o.end.getTime() <= rangeEnd.getTime(),
        endsMidDay: !(o.end.getHours() === 23 && o.end.getMinutes() >= 59),
        startsMidDay: !!o.start && !(o.start.getHours() === 0 && o.start.getMinutes() === 0),
      });
    });
  }

  if (data.season && data.season.name && data.season.endDate && new Date() < new Date(data.season.endDate)) {
    pushItems({ start: data.season.startDate, end: data.season.endDate }, dashEventName(data.season.name));
  }
  (data.eventSchedule || []).forEach(ev => pushItems(ev, dashEventName(ev.name)));
  (data.candleBonusSchedule || []).forEach(ev => pushItems(ev, dashEventName(ev.name)));
  (data.revisitSchedules || []).forEach((sch, idx) => pushItems(sch, t('再訪精霊', 'Revisit Spirit'), 'revisit#' + idx));

  items.sort((a, b) => a.startDay - b.startDay || (b.endDay - b.startDay) - (a.endDay - a.startDay));
  const laneEndDay = [];
  items.forEach(it => {
    let lane = laneEndDay.findIndex(endDay => endDay < it.startDay);
    if (lane === -1) { lane = laneEndDay.length; laneEndDay.push(it.endDay); }
    else { laneEndDay[lane] = it.endDay; }
    it.lane = lane;
  });
  return { items, laneCount: laneEndDay.length };
}
function calendarHtml(data) {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = new Date(year, month, 1).getDay();
  const todayDate = now.getDate();
  const { items, laneCount } = calendarBarItems(data, year, month);

  const dow = CURRENT_LANG === 'en' ? ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] : ['日', '月', '火', '水', '木', '金', '土'];

  const totalCells = startWeekday + daysInMonth;
  const totalWeeks = Math.ceil(totalCells / 7);
  let weeksHtml = '';
  for (let w = 0; w < totalWeeks; w++) {
    const weekFirstDay = w * 7 - startWeekday + 1;
    const weekLastDay = weekFirstDay + 6;

    let dayNumsHtml = '';
    for (let col = 0; col < 7; col++) {
      const day = weekFirstDay + col;
      if (day < 1 || day > daysInMonth) {
        dayNumsHtml += '<div class="dash-cal-daynum"></div>';
      } else {
        const isToday = day === todayDate;
        dayNumsHtml += `<div class="dash-cal-daynum${isToday ? ' is-today' : ''}"><span>${day}</span></div>`;
      }
    }

    const weekItems = laneCount === 0 ? [] : items
      .filter(x => x.startDay <= weekLastDay && x.endDay >= weekFirstDay)
      .sort((a, b) => a.lane - b.lane);

    let barsHtml = '';
    weekItems.forEach((it, localRow) => {
      const segStartDay = Math.max(it.startDay, weekFirstDay);
      const segEndDay = Math.min(it.endDay, weekLastDay);
      const colStart = segStartDay - weekFirstDay + 1;
      const colSpan = segEndDay - segStartDay + 1;
      const roundLeft = it.trueStart && it.startDay >= weekFirstDay;
      const roundRight = it.trueEnd && it.endDay <= weekLastDay;
      const color = it.color;
      const textColor = it.textColor;
      const nameEsc = escapeHtml(it.name);
      const halfStart = roundLeft && it.startsMidDay;
      const halfEnd = roundRight && it.endsMidDay;
      if (!halfStart && !halfEnd) {
        barsHtml += `<div class="dash-cal-bar${roundLeft ? ' round-l' : ''}${roundRight ? ' round-r' : ''}"`
          + ` style="grid-column:${colStart} / span ${colSpan}; grid-row:${localRow + 1}; --bar:${color};"`
          + ` title="${nameEsc}">${nameEsc}</div>`;
      } else if (colSpan === 1) {
        const cls = 'dash-cal-bar' + (halfStart ? ' half-start' : '') + (halfEnd ? ' half-end' : '')
          + (roundLeft ? ' round-l' : '') + (roundRight ? ' round-r' : '');
        barsHtml += `<div class="${cls}"`
          + ` style="grid-column:${colStart} / span 1; grid-row:${localRow + 1}; --bar:${color};"`
          + ` title="${nameEsc}">${nameEsc}</div>`;
      } else {
        const endCol = colStart + colSpan - 1;
        const midStart = halfStart ? colStart + 1 : colStart;
        const midSpan = (halfEnd ? endCol : endCol + 1) - midStart;
        if (halfStart) {
          barsHtml += `<div class="dash-cal-bar half-start round-l"`
            + ` style="grid-column:${colStart} / span 1; grid-row:${localRow + 1}; --bar:${color};"`
            + ` title="${nameEsc}"></div>`;
        }
        if (midSpan > 0) {
          barsHtml += `<div class="dash-cal-bar${(!halfStart && roundLeft) ? ' round-l' : ''}${(!halfEnd && roundRight) ? ' round-r' : ''}"`
            + ` style="grid-column:${midStart} / span ${midSpan}; grid-row:${localRow + 1}; --bar:${color};"`
            + ` title="${nameEsc}">${nameEsc}</div>`;
        }
        if (halfEnd) {
          barsHtml += `<div class="dash-cal-bar half-end round-r"`
            + ` style="grid-column:${endCol} / span 1; grid-row:${localRow + 1}; --bar:${color};"`
            + ` title="${nameEsc}"></div>`;
        }
      }
    });

    weeksHtml += `<div class="dash-cal-week">
        <div class="dash-cal-daynum-row">${dayNumsHtml}</div>
        <div class="dash-cal-bars" style="grid-template-rows: repeat(${Math.max(weekItems.length, 1)}, 18px);">${barsHtml}</div>
      </div>`;
  }

  const monthLabel = CURRENT_LANG === 'en'
    ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(now)
    : `${year}年${month + 1}月`;

  return `
    <details class="dash-calendar">
      <summary class="dash-calendar-summary">
        <svg class="inline-icon" width="15" height="15"><use href="#i-calendar"/></svg>
        <span>${t(`カレンダー（${monthLabel}）`, `Calendar (${monthLabel})`)}</span>
        <span class="dash-calendar-chevron">›</span>
      </summary>
      <div class="dash-cal-body">
        <div class="dash-cal-dow-row">${dow.map(w => `<div class="dash-cal-dow">${w}</div>`).join('')}</div>
        ${weeksHtml}
      </div>
    </details>`;
}

/* ================================================================
   本体の組み立て
   ================================================================ */
function getData() {
  return {
    // 開始前の季節は「進行中の季節」ではなく、開始前のイベントとして渡す（season-data.js参照）
    season: seasonInProgress(CURRENT_SEASON),
    eventSchedule: scheduleWithUpcomingSeason(EVENT_SCHEDULE, CURRENT_SEASON),
    candleBonusSchedule: CANDLE_BONUS_SCHEDULE,
    revisitSchedules: REVISIT_SPIRIT_SCHEDULES,
    nextUpdate: NEXT_UPDATE,
  };
}

function activeScheduledEvents(schedule) {
  const now = new Date();
  return (schedule || []).filter(ev => {
    const end = new Date(ev.end);
    const start = ev.start ? new Date(ev.start) : null;
    return now <= end && (!start || now >= start);
  });
}
// これから開始するイベント（開始日時がまだ先のもの）を、開始の近い順に返す。startを持たない
// エントリは「常に開催中」扱いなので対象外。ダッシュボードの今日/今週/今月は、開催中のものは
// 「終了まで」、これから始まるものは「開始まで」の残り時間で振り分ける（例: 金曜に始まる季節は今週欄）。
// 開始が約1か月より先のものは、今月欄が埋もれないよう載せない（先の予定はカレンダーで確認できる）。
const UPCOMING_MAX_MS = 31 * 24 * 60 * 60 * 1000;
function upcomingScheduledEvents(schedule) {
  const now = Date.now();
  return (schedule || [])
    .filter(ev => {
      if (!ev || !ev.start) return false;
      const s = new Date(ev.start).getTime();
      return s > now && s - now <= UPCOMING_MAX_MS;
    })
    .sort((a, b) => new Date(a.start) - new Date(b.start));
}
// 「10/16(金) 16:00」形式（端末のローカル時刻）
function formatStart(d) {
  const wd = t('日,月,火,水,木,金,土', 'Sun,Mon,Tue,Wed,Thu,Fri,Sat').split(',')[d.getDay()] || '';
  const hh = String(d.getHours()).padStart(2, '0'), mi = String(d.getMinutes()).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()}${wd ? `(${wd})` : ''} ${hh}:${mi}`;
}
// 開催期間の小さな注記（開始〜終了。終了が無ければ開始だけ）。終了は「16:59:59」を分までで出す
function periodNote(ev) {
  const start = ev.start ? new Date(ev.start) : null;
  const end = ev.end ? new Date(ev.end) : null;
  if (start && end) return `${formatStart(start)} 〜 ${formatStart(end)}`;
  if (start) return formatStart(start);
  return end ? t(`${formatStart(end)}まで`, `Until ${formatStart(end)}`) : '';
}
function row(icon, html) {
  return `<div class="dash-row"><span class="dash-row-icon">${icon}</span><span class="dash-row-text">${html}</span></div>`;
}
// 🍃 予定1件ぶんのコンパクトな行（2026-11-10。大きなカードとアイコンをやめて、名前・残り時間・日付だけにした）。
// name は組み立て済みのHTML、state は「終了まで」などの短い言葉、note は日付などの小さな補足
function item({ name, state = '', time = '', note = '', dot = '' }) {
  return `<div class="dash-item">${dot}<span class="dash-item-name">${name}</span>`
    + (time ? `<span class="dash-item-time">${state ? `<span class="dash-item-state">${state}</span>` : ''}${time}</span>` : '')
    + (note ? `<span class="dash-item-note">${note}</span>` : '')
    + '</div>';
}
const shardDot = (isRed, dim) => `<span class="dash-item-dot${isRed ? ' is-red' : ''}${dim ? ' is-dim' : ''}" aria-hidden="true"></span>`;

function buildHtml(data) {
  const now = new Date();
  const dailyRows = [];
  const shard = shardInfo();
  if (shard.hasShard) {
    const colorLabel = shard.isRed ? t('赤闇', 'Red Shard') : t('黒闇', 'Black Shard');
    const where = `${srLabel(shard.realm)}・${t(shard.location.ja, shard.location.en)}`;
    // 開始〜終了を1回ずつ並べる。終わった回は打ち消し線、出現中の回には「出現中」を付ける
    const active = shard.occurrences.find(occ => occ.getTime() <= now.getTime() && now.getTime() < shardEnd(occ).getTime());
    const times = shard.occurrences.map(occ => {
      const past = shardEnd(occ).getTime() <= now.getTime();
      const isActive = occ === active;
      return `<span class="dash-shard-time${past ? ' past' : ''}${isActive ? ' active' : ''}">${formatShardRange(occ)}${isActive ? `<span class="dash-shard-active">${t('出現中', 'Active')}</span>` : ''}</span>`;
    }).join('');
    const soon = soonestFuture(shard.occurrences) || nextShardTime();
    dailyRows.push(item({
      dot: shardDot(shard.isRed),
      name: `${colorLabel} <span class="dash-item-sub">${where}</span>`,
      state: active ? t('終了まで', 'Ends in') : soon ? t('次まで', 'Next in') : '',
      time: active ? countdown(shardEnd(active)) : soon ? countdown(soon) : '',
      note: `<span class="dash-shard-times">${times}</span>`,
    }));
  } else {
    const nextShard = nextShardTime();
    dailyRows.push(item({ dot: shardDot(false, true), name: t('闇の破片なし', 'No shards today'), state: nextShard ? t('次まで', 'Next in') : '', time: nextShard ? countdown(nextShard) : '' }));
  }
  // 次のデイリー（太平洋時間0時の切り替わり後）の闇の破片
  const tomorrowShard = shardInfoForOffset(1);
  if (tomorrowShard.hasShard) {
    const colorLabel = tomorrowShard.isRed ? t('赤闇', 'Red Shard') : t('黒闇', 'Black Shard');
    const where = `${srLabel(tomorrowShard.realm)}・${t(tomorrowShard.location.ja, tomorrowShard.location.en)}`;
    const times = tomorrowShard.occurrences.map(occ => `<span class="dash-shard-time">${formatShardRange(occ)}</span>`).join('');
    dailyRows.push(item({ dot: shardDot(tomorrowShard.isRed, true), name: `${t('翌日', 'Next day')}：${colorLabel} <span class="dash-item-sub">${where}</span>`, note: `<span class="dash-shard-times">${times}</span>` }));
  } else {
    dailyRows.push(item({ dot: shardDot(false, true), name: t('翌日：闇の破片なし', 'Next day: no shards') }));
  }
  // 大キャンドルとクエストキャンドルは同じ時刻に切り替わるので、残り時間は見出しに1回だけ出す
  dailyRows.push(item({ name: `${t('大キャンドル', 'Grand Candle')} <b>${srLabel(grandCandleRealm())}</b>` }));
  dailyRows.push(item({ name: `${t('クエスト・シーズンキャンドル', 'Quest & Season Candle')} <b>${srLabel(grandCandleRealm(-2, QUEST_CANDLE_ANCHOR_DATE, QUEST_CANDLE_ANCHOR_REALM_IDX))}</b>` }));
  dailyRows.push(item({ name: t('ウニ焼き', 'Geyser'), state: t('次まで', 'Next in'), time: countdown(nextEvenHourEvent(5)) }));
  dailyRows.push(item({ name: t('パン焼き', 'Bread Baking'), state: t('次まで', 'Next in'), time: countdown(nextEvenHourEvent(35)) }));
  dailyRows.push(item({ name: t('亀闇', 'Turtle Darkness'), state: t('次まで', 'Next in'), time: countdown(nextEvenHourEvent(50)) }));
  const dailyHtml = dailyRows.join('');

  const bucketRows = { today: [], week: [], month: [] };
  const push = (target, html) => bucketRows[bucketFor(target)].push({ at: target.getTime(), html });
  let seasonErrored = false;
  const ended = ev => ({ name: escapeHtml(dashEventName(ev.name)), state: t('終了まで', 'Ends in'), time: countdown(new Date(ev.end)), note: t(`${formatStart(new Date(ev.end))}まで`, `Until ${formatStart(new Date(ev.end))}`) });
  activeScheduledEvents(data.eventSchedule).forEach(ev => push(new Date(ev.end), item(ended(ev))));
  activeScheduledEvents(data.candleBonusSchedule).forEach(ev => push(new Date(ev.end), item(ended(ev))));
  // これから始まるイベント（開催中のものが「終了まで」で振り分けられるのと対称に、「開始まで」で振り分ける）
  const upcoming = ev => push(new Date(ev.start), item({ name: escapeHtml(dashEventName(ev.name)), state: t('開始まで', 'Starts in'), time: countdown(new Date(ev.start)), note: periodNote(ev) }));
  upcomingScheduledEvents(data.eventSchedule).forEach(upcoming);
  upcomingScheduledEvents(data.candleBonusSchedule).forEach(upcoming);
  revisitStatuses(data.revisitSchedules).forEach(({ schedule, status: rv }) => {
    // 精霊団など名前の付いた来訪（season-data.js の labelJa/labelEn）はその名前で出す
    const label = schedule && schedule.labelJa ? escapeHtml(t(schedule.labelJa, schedule.labelEn || schedule.labelJa)) : t('再訪精霊', 'Revisit Spirit');
    push(rv.target, item({ name: label, state: rv.active ? t('帰るまで', 'Leaves in') : t('来訪まで', 'Arrives in'), time: countdown(rv.target) }));
  });
  const edenTarget = nextEdenResetTarget();
  push(edenTarget, item({ name: t('原罪の週間リセット', 'Eye of Eden reset'), time: countdown(edenTarget) }));
  if (data.nextUpdate && data.nextUpdate.date) {
    const updateTarget = new Date(data.nextUpdate.date);
    if (now < updateTarget) push(updateTarget, item({ name: t('次回アップデート', 'Next Update'), time: countdown(updateTarget) }));
  }
  if (data.season && data.season.endDate) {
    const end = new Date(data.season.endDate);
    // 終了済みの季節はダッシュボードに出さない（終了まで00:00:00のまま残ってしまうため）
    if (now < end) push(end, item({ name: escapeHtml(dashEventName(data.season.name)), state: t('終了まで', 'Ends in'), time: countdown(end), note: t(`${formatStart(end)}まで`, `Until ${formatStart(end)}`) }));
  } else {
    seasonErrored = true;
  }
  const list = k => bucketRows[k].sort((x, y) => x.at - y.at).map(r => r.html).join('');

  const bucketEmptyMsg = `<div class="dash-empty">${t('予定はありません', 'Nothing scheduled')}</div>`;
  const seasonErrorRow = seasonErrored ? `<div class="dash-empty">${t('シーズン情報が取得できませんでした', 'Could not load season info')}</div>` : '';
  const section = (label, body, extra = '') => `<div class="dash-section"><p class="dash-section-label"><span>${label}</span>${extra}</p><div class="dash-list">${body}</div></div>`;
  const resetExtra = `<span class="dash-section-extra">${t('リセットまで', 'Reset in')} ${countdown(nextPacificMidnight())}</span>`;

  return `
    <div class="dash-section">${calendarHtml(data)}</div>
    ${section(t('デイリー', 'Daily'), dailyHtml, resetExtra)}
    ${section(t('今日', 'Today'), list('today') || bucketEmptyMsg)}
    ${section(t('今週', 'This Week'), list('week') || bucketEmptyMsg)}
    ${section(t('今月', 'This Month'), seasonErrorRow + (list('month') || (seasonErrored ? '' : bucketEmptyMsg)))}`;
}

/* ================================================================
   🔔 通知リマインダー（任意オプトイン）
   ================================================================ */
const REMINDER_ENABLED_KEY = 'sky_dash_reminder_enabled';
const REMINDER_MINUTES_KEY = 'sky_dash_reminder_minutes';
const REMINDER_NOTIFIED_KEY = 'sky_dash_reminder_notified_v1';
const REMINDER_CHECK_INTERVAL_MS = 60 * 1000;

function reminderEnabled() { return localStorage.getItem(REMINDER_ENABLED_KEY) === '1'; }
function reminderMinutes() {
  const v = parseInt(localStorage.getItem(REMINDER_MINUTES_KEY), 10);
  return Number.isFinite(v) && v > 0 ? v : 30;
}
function reminderSaveMinutes(value) {
  const v = parseInt(value, 10);
  localStorage.setItem(REMINDER_MINUTES_KEY, String(Number.isFinite(v) && v > 0 ? v : 30));
  reminderCheckNow();
}
function reminderNotifiedSet() {
  try { return new Set(JSON.parse(localStorage.getItem(REMINDER_NOTIFIED_KEY) || '[]')); }
  catch (_) { return new Set(); }
}
function reminderMarkNotified(key) {
  const set = reminderNotifiedSet();
  set.add(key);
  localStorage.setItem(REMINDER_NOTIFIED_KEY, JSON.stringify([...set].slice(-200)));
}
function reminderTargets(data) {
  const targets = [
    { id: 'daily-reset', label: t('デイリーリセット（大キャンドル交代）', 'Daily reset (Grand Candle change)'), target: nextPacificMidnight() },
    { id: 'eden-weekly-reset', label: t('原罪：週間リセット', 'Eye of Eden: weekly reset'), target: nextEdenResetTarget() },
  ];
  if (data.season && data.season.name && data.season.endDate) {
    const end = new Date(data.season.endDate);
    if (new Date() < end) targets.push({ id: 'season-end', label: dashEventName(data.season.name), target: end });
  }
  activeScheduledEvents(data.eventSchedule).forEach((ev, i) => {
    targets.push({ id: `event-${i}-${ev.name}`, label: dashEventName(ev.name), target: new Date(ev.end) });
  });
  return targets;
}
function reminderCheckNow() {
  if (!reminderEnabled()) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const data = getData();
  const thresholdMs = reminderMinutes() * 60000;
  const notified = reminderNotifiedSet();
  reminderTargets(data).forEach(target => {
    const msLeft = target.target - new Date();
    if (msLeft <= 0 || msLeft > thresholdMs) return;
    const key = `${target.id}@${Math.round(target.target.getTime() / 60000)}`;
    if (notified.has(key)) return;
    reminderMarkNotified(key);
    try {
      new Notification(t('まもなく終了', 'Ending soon'), {
        body: t(`${target.label} — 残り ${countdownPlain(target.target)}`, `${target.label} — ${countdownPlain(target.target)} left`),
        tag: key,
      });
    } catch (e) { console.error('[event-dashboard] reminderCheckNow notify', e); }
  });
}
let reminderTimer = null;
function reminderStartTimer() {
  if (reminderTimer) return;
  reminderTimer = setInterval(reminderCheckNow, REMINDER_CHECK_INTERVAL_MS);
}
function reminderStopTimer() {
  if (reminderTimer) { clearInterval(reminderTimer); reminderTimer = null; }
}
async function reminderToggle(checked, syncUI) {
  if (checked) {
    if (typeof Notification === 'undefined') {
      localStorage.setItem(REMINDER_ENABLED_KEY, '0');
      syncUI();
      return;
    }
    let perm = Notification.permission;
    if (perm === 'default') perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      localStorage.setItem(REMINDER_ENABLED_KEY, '0');
      syncUI();
      return;
    }
    localStorage.setItem(REMINDER_ENABLED_KEY, '1');
    reminderStartTimer();
    reminderCheckNow();
  } else {
    localStorage.setItem(REMINDER_ENABLED_KEY, '0');
    reminderStopTimer();
  }
  syncUI();
}
let remindersInited = false;
// ページ（このモジュールが初めてmountされたタイミング）を開いた時点で、以前オプトイン
// していて、かつ既に許可が下りている場合だけ（＝新たな許可リクエストは絶対に発生させない）
// 自動でチェックを再開する（原実装のpfReminderInit()と同条件）。
function ensureRemindersInited() {
  if (remindersInited) return;
  remindersInited = true;
  if (reminderEnabled() && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    reminderCheckNow();
    reminderStartTimer();
  }
}

/** js/app.jsが起動時に呼ぶ。ダッシュボードを開かなくても、オプトイン済み・許可済みなら通知のチェックを始める */
export function startRemindersIfEnabled() { ensureRemindersInited(); }

/* ================================================================
   🖼️ スタイル・ローカルアイコンスプライトの注入（初回のみ）
   共有 js/icon-sprite.js（#pf-icon-sprite）に無いアイコンだけ、
   edb-i- プレフィックスの専用スプライトとして追加注入する
   （他エージェントがjs/icon-sprite.js自体を並行して触っているため編集しない。
   share-view.js/nomacan-view.jsの「ローカルスプライト」パターンを踏襲）。
   ================================================================ */
const ICON_SPRITE_ID = 'edb-icon-sprite';
const EDB_SPRITE_HTML = `
<svg id="${ICON_SPRITE_ID}" style="position:absolute;width:0;height:0;overflow:hidden;" aria-hidden="true"><defs>
<symbol id="edb-i-bell" viewBox="0 0 24 24"><path d="M12 3.2a1.3 1.3 0 0 0-1.3 1.3v.4C8.6 5.5 7 7.8 7 10.4V14l-1.8 2.8h13.6L17 14v-3.6c0-2.6-1.6-4.9-3.7-5.5v-.4A1.3 1.3 0 0 0 12 3.2Z"/><path d="M9.8 18.3a2.2 2.2 0 0 0 4.4 0"/></symbol>
<symbol id="edb-i-clock" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.167) translate(-12 -12)"><path d="M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Z"/><path d="M12 8.2V12.3l3 1.8"/></g></symbol>
<symbol id="edb-i-bolt" viewBox="0 0 24 24"><path d="M13 3L5 14h5l-1 7 9-12h-5Z"/></symbol>
<symbol id="edb-i-hammer" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.389) translate(-11.5 -12.1)"><path d="M14.8 6.2l3 3-2.1 2.1-3-3Z"/><path d="M12.7 8.3l-7.5 7.5v2.2h2.2l7.5-7.5Z"/></g></symbol>
<symbol id="edb-i-scroll" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.094) translate(-13 -12)"><path d="M5 7a2 2 0 1 1 0 4h1.5"/><path d="M19 17a2 2 0 1 0 0-4h-1.5"/><path d="M6.5 7H17a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H6.5"/><path d="M9 10.5h6M9 13.5h4"/></g></symbol>
<symbol id="edb-i-geyser" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.25) translate(-12 -12)"><path d="M5 19h14"/><path d="M8 19c0-3 1.5-5 4-5s4 2 4 5"/><path d="M12 12V5"/><path d="M9.5 8l2.5-3 2.5 3"/></g></symbol>
<symbol id="edb-i-bread" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.094) translate(-12 -13.75)"><path d="M4 14a8 5 0 0 1 16 0v2.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M9 12l1-3M13.5 12l1-3"/></g></symbol>
<symbol id="edb-i-turtle" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.389) translate(-12 -12)"><path d="M12 8a6 4.2 0 0 0-6 4.2A6 4.2 0 0 0 12 16.4a6 4.2 0 0 0 6-4.2A6 4.2 0 0 0 12 8Z"/><path d="M12 8V6M8 10.5l-2.3-1.2M16 10.5l2.3-1.2M8.3 14l-2 1.4M15.7 14l2 1.4M10.3 16l-1 2M13.7 16l1 2"/></g></symbol>
</defs></svg>`;
function injectLocalIconSprite() {
  if (document.getElementById(ICON_SPRITE_ID)) return;
  document.body.insertAdjacentHTML('afterbegin', EDB_SPRITE_HTML);
}

const STYLE_ID = 'edb-event-dashboard-styles';
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.edb-i { stroke: var(--hub-text-2); }
.dash-section { margin-top: 18px; }
.dash-section:first-child { margin-top: 0; }
.dash-section-label { display: flex; align-items: baseline; gap: 8px; font-size: 12px; font-weight: 700; color: var(--hub-text-2); margin: 0 0 6px; letter-spacing: 0.04em; }
.dash-section-extra { margin-left: auto; font-weight: 500; font-variant-numeric: tabular-nums; letter-spacing: 0; }
/* 🍃 予定の行（小さめの角丸カードに、名前・残り時間・日付だけを1行で並べる） */
.dash-item { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 8px; padding: 8px 11px; margin-bottom: 4px; background: var(--hub-bg); border-radius: var(--hub-r-sm); font-size: 13px; line-height: 1.45; color: var(--hub-text); }
.dash-list > .dash-item:last-child { margin-bottom: 0; }
.dash-item-dot { flex-shrink: 0; width: 8px; height: 8px; border-radius: 50%; background: #8e8e93; align-self: center; }
.dash-item-dot.is-red { background: #ff453a; }
.dash-item-dot.is-dim { opacity: 0.45; }
.dash-item-name { flex: 1 1 auto; min-width: 0; }
.dash-item-name b { font-weight: 600; color: var(--hub-accent-ink, var(--hub-accent)); }
.dash-item-sub { color: var(--hub-text-2); font-size: 12px; }
.dash-item-time { flex-shrink: 0; margin-left: auto; font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }
.dash-item-state { margin-right: 5px; font-size: 11px; font-weight: 500; color: var(--hub-text-2); }
.dash-item-note { flex-basis: 100%; font-size: 11.5px; color: var(--hub-text-2); font-variant-numeric: tabular-nums; }
.dash-item .dash-count-num { font-size: 1em; }
.dash-item .dash-count-unit { margin-right: 2px; }
/* 闇の破片の時刻は1回ずつ改行して、ぱっと見で分かるようにする */
.dash-item .dash-shard-times { display: block; margin-top: 2px; }
.dash-item .dash-shard-time { display: block; font-size: 12.5px; color: var(--hub-text); font-weight: 500; }
.dash-item .dash-shard-time.past { color: var(--hub-text-2); font-weight: 400; }
.dash-item .dash-shard-time.active { color: var(--hub-accent-ink, var(--hub-accent)); font-weight: 600; }
.dash-row { display: flex; align-items: flex-start; gap: 8px; padding: 9px 11px; background: var(--hub-bg); border-radius: var(--hub-r-sm); margin-bottom: 6px; font-size: 13px; color: var(--hub-text); line-height: 1.5; }
.dash-row:last-child { margin-bottom: 0; }
.dash-row-icon { flex-shrink: 0; }
.dash-row-text { flex: 1; min-width: 0; }
.dash-row b { color: var(--hub-accent); }
.dash-countdown { display: block; margin-top: 3px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--hub-accent); }
.dash-count-num { font-size: 1.1em; }
.dash-count-unit { font-weight: 500; opacity: 0.75; font-size: 0.85em; margin-right: 3px; }
.dash-note { display: block; margin-top: 2px; font-size: 11.5px; font-weight: 400; color: var(--hub-text-2); }
.dash-shard-times { display: block; margin-top: 3px; }
.dash-shard-time { display: block; color: var(--hub-accent); font-weight: 600; font-variant-numeric: tabular-nums; }
.dash-shard-active { display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 999px; font-size: 10.5px; font-weight: 700; line-height: 1.6; color: #fff; background: var(--hub-accent); vertical-align: 1px; }
.dash-shard-time.past { color: var(--hub-text-2); font-weight: 400; text-decoration: line-through; }
.dash-empty { font-size: 12.5px; color: var(--hub-text-2); padding: 7px 0; }
.dash-calendar-summary { display: flex; align-items: center; gap: 6px; cursor: pointer; list-style: none; font-size: 12px; font-weight: 700; color: var(--hub-text-2); padding: 4px 0; letter-spacing: 0.04em; user-select: none; }
.dash-calendar-summary::-webkit-details-marker { display: none; }
.dash-calendar-summary::marker { content: ''; }
.dash-calendar-summary:focus-visible { outline: 2px solid var(--hub-accent); outline-offset: -2px; }
.dash-calendar-chevron { margin-left: auto; font-size: 13px; color: var(--hub-text-2); transition: transform 0.2s ease; }
.dash-calendar[open] .dash-calendar-chevron { transform: rotate(90deg); }
.dash-cal-body { padding: 6px 0 0; }
.dash-cal-dow-row { display: grid; grid-template-columns: repeat(7, 1fr); }
.dash-cal-dow { text-align: center; font-size: 10px; font-weight: 700; color: var(--hub-text-2); padding-bottom: 4px; }
.dash-cal-week + .dash-cal-week { margin-top: 4px; }
.dash-cal-daynum-row { display: grid; grid-template-columns: repeat(7, 1fr); padding-top: 2px; }
.dash-cal-daynum { display: flex; align-items: center; justify-content: center; height: 20px; }
.dash-cal-daynum span { font-size: 11px; font-variant-numeric: tabular-nums; color: var(--hub-text); }
.dash-cal-daynum.is-today span { display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: var(--hub-accent); color: #fff; font-weight: 700; }
.dash-cal-bars { display: grid; grid-template-columns: repeat(7, 1fr); grid-auto-rows: 16px; row-gap: 2px; column-gap: 0; padding-top: 2px; }
/* 予定の帯は塗りつぶさず、左端の色の線＋淡い下地にする（色は名前ごと。文字は本文色） */
.dash-cal-bar { display: flex; align-items: center; min-width: 0; height: 16px; margin: 0; padding: 0 5px; font-size: 10px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  color: var(--hub-text); background: color-mix(in srgb, var(--bar) 18%, transparent); }
.dash-cal-bar.round-l { border-left: 3px solid var(--bar); border-top-left-radius: 2px; border-bottom-left-radius: 2px; margin-left: 1px; }
.dash-cal-bar.round-r { border-top-right-radius: 2px; border-bottom-right-radius: 2px; margin-right: 1px; }
@media (prefers-contrast: more) { .dash-cal-bar { background: color-mix(in srgb, var(--bar) 35%, transparent); } .dash-item { outline: 1px solid var(--hub-text-2); } }
@media (prefers-reduced-motion: reduce) { .dash-calendar-chevron { transition: none; } }
.dash-cal-bar.half-end { width: 50%; }
.dash-cal-bar.half-start { width: 50%; justify-self: end; }
.edb-reminder-row { align-items: center; flex-wrap: nowrap; cursor: pointer; }
.edb-select { flex-shrink: 0; padding: 4px 8px; border: 0.5px solid var(--hub-sep); border-radius: 8px; background: var(--hub-card); color: var(--hub-text); font: inherit; font-size: 12.5px; }
.edb-plain-btn { display: block; width: 100%; margin-top: 6px; padding: 8px 12px; border: 0.5px solid var(--hub-sep); border-radius: 10px; background: var(--hub-card); color: var(--hub-accent-ink, var(--hub-accent)); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.edb-plain-btn:active { transform: scale(0.98); }
.edb-hint { margin-top: 5px; font-size: 11.5px; line-height: 1.5; color: var(--hub-text-2); }
.edb-hint:empty { display: none; }
.edb-reminder-row input[type="checkbox"] { width: 19px; height: 19px; flex-shrink: 0; cursor: pointer; accent-color: var(--hub-accent); }
`;
  document.head.appendChild(style);
}

/* ================================================================
   📅 .icsカレンダーエクスポート（companion/index.html の pfDashExportIcs()
   一式を移植。移植元4サイトのうちcompanionだけが持つ機能のため、
   mount(container, {icsExport:true}) を渡したホストツールだけに表示する
   （wings/spirit-catalog/profileの各originalにはこの機能自体が存在しない
   ことをgrep調査で確認済み——デフォルトでは出さない）。
   ================================================================ */
function icsDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}
function icsEscape(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
function icsBuildEvent({ uid, start, end, summary, description, rrule, alarmTrigger }) {
  const lines = ['BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`];
  if (rrule) lines.push(`RRULE:${rrule}`);
  lines.push(`SUMMARY:${icsEscape(summary)}`);
  if (description) lines.push(`DESCRIPTION:${icsEscape(description)}`);
  if (alarmTrigger) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(summary)}`, `TRIGGER:${alarmTrigger}`, 'END:VALARM');
  lines.push('END:VEVENT');
  return lines;
}
function icsLocalDateStr(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}
// 繰り返し予定（毎日0時PT・毎週日曜0時PT）は、UTCで繰り返すRRULEのままだと夏時間⇔標準時の切替で
// 日本時間の時刻が1時間ずれる（夏時間中16:00 → 標準時17:00）。そこで切替の瞬間で系列を分け、
// 切替後の系列は「切替後の最初の発生」から始める。occurrenceAfter(ms)は「ms より後の最初の発生」を返す
function icsRecurringBlocks(firstStart, untilMs, occurrenceAfter) {
  const blocks = [];
  let start = firstStart;
  ptOffsetChanges(firstStart.getTime(), untilMs).forEach((cut) => {
    blocks.push({ start, until: new Date(cut - 1000) });
    start = occurrenceAfter(cut);
  });
  blocks.push({ start, until: new Date(untilMs) });
  return blocks.filter((b) => b.start.getTime() <= b.until.getTime());
}
function icsNextPacificMidnightAfter(ms) {
  const p = ptParts(ms);
  return ptToReal(p.year, p.month, p.day + 1, 0, 0, 0);
}
function icsNextEdenResetAfter(ms) {
  const p = ptParts(ms);
  const dow = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay(); // 0=日
  const days = (7 - dow) % 7 || 7; // 同じ日曜でも発生(0時)は過ぎているので、次の日曜は7日後
  return ptToReal(p.year, p.month, p.day + days, 0, 0, 0);
}
function exportIcs(statusEl) {
  try {
    const now = new Date();
    const uidHost = 'taipak5000.github.io';
    const events = [];

    // シーズン終了（コンプリート期限）
    let seasonEnd = null;
    if (CURRENT_SEASON && CURRENT_SEASON.endDate) {
      seasonEnd = new Date(CURRENT_SEASON.endDate);
      if (!isNaN(seasonEnd.getTime()) && seasonEnd.getTime() > now.getTime()) {
        events.push(...icsBuildEvent({
          uid: `edb-season-end-${seasonEnd.getTime()}@${uidHost}`,
          start: seasonEnd,
          end: new Date(seasonEnd.getTime() + 30 * 60000),
          summary: t(`${dashEventName(CURRENT_SEASON.name)}：終了`, `${dashEventName(CURRENT_SEASON.name)}: Ends`),
          description: t('シーズンの完了期限です', 'Season completion deadline'),
          alarmTrigger: '-P1D',
        }));
      } else {
        seasonEnd = null;
      }
    }
    // 繰り返し予定を打ち切る上限日時（季節終了が取れない場合は90日先を仮の上限にする）
    const recurUntil = seasonEnd || new Date(now.getTime() + 90 * 86400000);

    // 大キャンドル・クエストキャンドルの切替（太平洋時間0時・毎日）
    icsRecurringBlocks(nextPacificMidnight(), recurUntil.getTime(), icsNextPacificMidnightAfter).forEach((b, i) => {
      events.push(...icsBuildEvent({
        uid: `edb-daily-candle${i ? '-' + (i + 1) : ''}@${uidHost}`,
        start: b.start,
        end: new Date(b.start.getTime() + 5 * 60000),
        summary: t('大キャンドル・クエストキャンドルの切替', 'Grand/Quest Candle rotation'),
        description: t('日替わりで訪れるエリアが変わります', 'Today\'s Grand/Quest Candle locations rotate'),
        rrule: `FREQ=DAILY;UNTIL=${icsDate(b.until)}`,
        alarmTrigger: '-PT10M',
      }));
    });

    // 週間リセット（原罪など・毎週日曜0時＝太平洋時間）
    icsRecurringBlocks(nextEdenResetTarget(), recurUntil.getTime(), icsNextEdenResetAfter).forEach((b, i) => {
      events.push(...icsBuildEvent({
        uid: `edb-weekly-eden${i ? '-' + (i + 1) : ''}@${uidHost}`,
        start: b.start,
        end: new Date(b.start.getTime() + 5 * 60000),
        summary: t('原罪：週間リセット', 'Eye of Eden: weekly reset'),
        rrule: `FREQ=WEEKLY;BYDAY=SU;UNTIL=${icsDate(b.until)}`,
        alarmTrigger: '-PT30M',
      }));
    });

    // 闇の破片（赤闇・黒闇）出現ウィンドウ：直近14日分（季節終了がそれより早ければ短縮する）
    const daysUntilEnd = seasonEnd ? Math.ceil((seasonEnd - now) / 86400000) : 14;
    const shardHorizon = Math.max(0, Math.min(14, daysUntilEnd));
    for (let offset = 0; offset <= shardHorizon; offset++) {
      const info = shardInfoForOffset(offset);
      if (!info.hasShard) continue;
      info.occurrences.forEach((occ) => {
        if (occ.getTime() <= now.getTime()) return; // 過去の出現分は含めない
        const label = `${srLabel(info.realm)}・${t(info.location.ja, info.location.en)}`;
        events.push(...icsBuildEvent({
          uid: `edb-shard-${occ.getTime()}@${uidHost}`,
          start: occ,
          end: shardEnd(occ),
          summary: `${info.isRed ? t('赤闇', 'Red Shard') : t('黒闇', 'Black Shard')}${t('の出現', ' Eruption')}`,
          description: label,
          alarmTrigger: '-PT10M',
        }));
      });
    }

    const body = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      `PRODID:-//${uidHost}//tai-hub//${CURRENT_LANG.toUpperCase()}`,
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      ...events,
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([body], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sky-schedule_${icsLocalDateStr(now)}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    if (statusEl) statusEl.textContent = t('カレンダーファイルを書き出しました', 'Downloaded the calendar file');
  } catch (e) {
    console.error('event-dashboard exportIcs', e);
    if (statusEl) statusEl.textContent = t('書き出しに失敗しました', 'Failed to export');
  }
}
function icsExportSectionHtml() {
  return `
    <div class="dash-section">
      <p class="dash-section-label"><span>${t('カレンダーアプリに取り込む', 'Add to your calendar app')}</span></p>
      <button type="button" class="edb-plain-btn" id="edbIcsExportBtn">${t('.icsファイルを書き出す', 'Export .ics file')}</button>
      <div class="edb-hint">${t('季節の終了・リセット・闇の破片（14日分）', 'Season end, resets, shards (14 days)')}</div>
      <div class="edb-hint" id="edbIcsStatus"></div>
    </div>`;
}

/* ================================================================
   🎛️ マウント/アンマウント
   ================================================================ */
let containerEl = null;   // 各ツールのモーダルなどへの一時マウント（unmount()で破棄される）
let tickTimer = null;
let icsExportEnabled = false;
// 常設サイドパネル（js/chrome/side-panels.js）へのマウント。各ツールが画面を離れる時に呼ぶ
// unmount()では止まらず、unmountPersistent()でだけ破棄される（モーダルと同時に表示しても干渉しない）
let persistentEl = null;
let persistentTimer = null;

function reminderSectionHtml() {
  return `
    <div class="dash-section">
      <p class="dash-section-label"><span>${t('通知', 'Notifications')}</span></p>
      <label class="dash-item edb-reminder-row">
        <span class="dash-item-name">${t('終了やリセットの前に知らせる', 'Notify before ends and resets')}</span>
        <input type="checkbox" id="edbReminderCheckbox">
      </label>
      <div class="dash-item edb-reminder-row">
        <span class="dash-item-name">${t('タイミング', 'When')}</span>
        <select id="edbReminderMinutes" class="edb-select">
          <option value="10">${t('10分前', '10 min before')}</option>
          <option value="30">${t('30分前', '30 min before')}</option>
          <option value="60">${t('1時間前', '1 hour before')}</option>
          <option value="180">${t('3時間前', '3 hours before')}</option>
          <option value="1440">${t('1日前', '1 day before')}</option>
        </select>
      </div>
      <div class="edb-hint" id="edbReminderStatus"></div>
    </div>`;
}

function syncReminderUI() {
  [containerEl, persistentEl].forEach(syncReminderUIIn);
}

function syncReminderUIIn(root) {
  if (!root) return;
  const cb = root.querySelector('#edbReminderCheckbox');
  if (!cb) return;
  const sel = root.querySelector('#edbReminderMinutes');
  const status = root.querySelector('#edbReminderStatus');
  const enabled = reminderEnabled();
  cb.checked = enabled;
  if (sel) sel.value = String(reminderMinutes());
  if (status) {
    if (typeof Notification === 'undefined') {
      status.textContent = t('この端末・ブラウザは通知に対応していません', 'Notifications are not supported on this device/browser');
    } else if (Notification.permission === 'denied') {
      status.textContent = t('ブラウザの設定で通知が拒否されています', 'Notifications are blocked. Allow them in your browser settings to use this.');
    } else if (enabled) {
      status.textContent = t('このページを開いている間だけ届きます', 'Enabled: you’ll get a notification as it approaches (only while this page is open)');
    } else {
      status.textContent = '';
    }
  }
}

function rerenderBody(body, html) {
  const wasOpen = body.querySelector('.dash-calendar')?.open;
  const summaryHadFocus = document.activeElement === body.querySelector('.dash-calendar-summary');
  body.innerHTML = html;
  if (wasOpen) {
    const cal = body.querySelector('.dash-calendar');
    if (cal) cal.open = true;
  }
  if (summaryHadFocus) {
    const summary = body.querySelector('.dash-calendar-summary');
    if (summary) summary.focus({ preventScroll: true });
  }
}

/**
 * containerの中身をイベントダッシュボードパネルで置き換える。
 * 同じ/別のcontainerに対して繰り返し呼んでもよい（内部の1秒タイマーは
 * 毎回停止してから作り直すため、多重起動しない）。
 */
// rootの中身を描画してイベントを結び付ける（一時マウントと常設パネルで共通。
// IDはすべてroot内でのquerySelectorで引くので、2か所に同時に出ても干渉しない）
function renderInto(root, withIcs) {
  root.innerHTML = `<div id="edbBody">${buildHtml(getData())}</div>${withIcs ? icsExportSectionHtml() : ''}${reminderSectionHtml()}`;

  const cb = root.querySelector('#edbReminderCheckbox');
  const sel = root.querySelector('#edbReminderMinutes');
  cb.addEventListener('change', e => reminderToggle(e.target.checked, syncReminderUI));
  sel.addEventListener('change', e => reminderSaveMinutes(e.target.value));
  syncReminderUIIn(root);

  const icsBtn = root.querySelector('#edbIcsExportBtn');
  if (icsBtn) icsBtn.addEventListener('click', () => exportIcs(root.querySelector('#edbIcsStatus')));
}

function tickInto(root) {
  if (!root) return;
  const body = root.querySelector('#edbBody');
  if (!body) return;
  rerenderBody(body, buildHtml(getData()));
}

export function mount(container, opts) {
  injectStyles();
  injectLocalIconSprite();
  const withIcs = !!(opts && opts.icsExport);

  if (opts && opts.persistent) {
    if (persistentTimer) { clearInterval(persistentTimer); persistentTimer = null; }
    persistentEl = container;
    renderInto(container, withIcs);
    persistentTimer = setInterval(() => tickInto(persistentEl), 1000);
    ensureRemindersInited();
    return;
  }

  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  icsExportEnabled = withIcs;
  containerEl = container;
  renderInto(containerEl, icsExportEnabled);
  tickTimer = setInterval(() => tickInto(containerEl), 1000);

  ensureRemindersInited();
}

/** 常設サイドパネル用のマウント（mount(container, { persistent: true })）を止める */
export function unmountPersistent() {
  if (persistentTimer) { clearInterval(persistentTimer); persistentTimer = null; }
  persistentEl = null;
}

/**
 * 1秒ごとのカウントダウン再描画タイマーを止め、containerの参照を破棄する。
 * 通知リマインダーの動作(バックグラウンドの定期チェック)はここでは止めない
 * （原実装がページを開いている間ずっと動き続けるのと同じ挙動）。
 */
export function unmount() {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  containerEl = null;
}

/**
 * 今のシーズンが7日以内に終了する場合だけ { seasonJa, seasonEn, daysLeft } を返す。
 * ホストツールが自分の季節データとseasonEnで突き合わせるために使う
 * （wingsのpfGetEndingSoonSeasonInfo相当）。mount()前でも呼べる。
 */
const SEASON_ENDING_SOON_DAYS = 7;
export function getEndingSoonSeason() {
  const season = CURRENT_SEASON;
  if (!season || !season.name || !season.endDate) return null;
  const end = new Date(season.endDate);
  const now = new Date();
  if (!(now < end)) return null;
  const daysLeft = Math.ceil((end - now) / 86400000);
  if (daysLeft > SEASON_ENDING_SOON_DAYS) return null;
  return { seasonJa: season.name, seasonEn: DASH_EVENT_NAME_EN[season.name] || season.name, daysLeft };
}

/**
 * 「今日やること」（features/today）用の、今日の要点だけをまとめた値。表示はしない（呼び出し側が組み立てる）。
 * { nextReset: Date, nextEden: Date, grand: {ja,en}, quest: {ja,en},
 *   shard: { has, isRed, realm: {ja,en}, location: {ja,en}, occurrences: [{start, end}] },
 *   nextGeyser: Date（ウニ焼き）, nextGrandma: Date（パン焼き）, nextTurtle: Date（亀闇） }
 */
export function getTodayBrief() {
  const s = shardInfo();
  const label = k => ({ ja: REALM_LABEL[k].ja, en: REALM_LABEL[k].en });
  return {
    nextReset: nextPacificMidnight(),
    nextEden: nextEdenResetTarget(),
    grand: label(grandCandleRealm()),
    quest: label(grandCandleRealm(-2, QUEST_CANDLE_ANCHOR_DATE, QUEST_CANDLE_ANCHOR_REALM_IDX)),
    shard: {
      has: s.hasShard, isRed: s.isRed, realm: label(s.realm), location: s.location,
      occurrences: s.occurrences.map(start => ({ start, end: shardEnd(start) })),
    },
    nextGeyser: nextEvenHourEvent(5),
    nextGrandma: nextEvenHourEvent(35),
    nextTurtle: nextEvenHourEvent(50),
  };
}

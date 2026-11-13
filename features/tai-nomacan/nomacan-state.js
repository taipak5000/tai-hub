/* ================================================================
   tai-nomacan（ノマキャン計算機）のデータ層。DOM に一切触れない、
   localStorage の読み書き・純粋な計算関数だけをここに集約する
   （UIの組み立て・イベント配線は nomacan-view.js / nomacan-history.js）。

   移植元: tai-nomacan/index.html のIIFE内、目標(goal*)・獲得履歴
   (history*)・ストリーク(streak*)・デイリークエスト記録(quest*)・
   称号(titles*)・実際ペース算出(computeActualDailyRate*)まわりの
   関数群（~行4193-5605あたり）。

   ⚠️ localStorageキー名は元のものと完全に一致させている(既存ユーザーの
   データ互換性のため、下記の各 *Key() 関数のraw文字列は絶対に変更しない)。
   nsKey()は必ず js/state.js の共有実装を使う(独自実装しない)。
   ================================================================ */
import { nsKey } from '../../js/state.js';
import { CURRENT_LANG } from '../../js/i18n.js';
import { t } from './data/i18n-nomacan.js';
import { TITLES } from './data/titles.js';

/* ── localStorage キー（すべて nsKey() でプロフィール名前空間化） ── */
export const GOALS_KEY = () => nsKey('skyNomacanGoals_v1');
export const CALC_STATE_KEY = () => nsKey('skyNomacanCalc_v1'); // 旧単一目標形式からの移行元も兼ねる
export const HISTORY_KEY = () => nsKey('skyNomacanCalc_history_v1');
export const STREAK_KEY = () => nsKey('skyNomacanStreak_v1');
export const QUEST_LOG_KEY = () => nsKey('dailyQuestLog_v1');
export const QUEST_STREAK_KEY = () => nsKey('dailyQuestStreak_v1');
export const TITLES_KEY = () => nsKey('skyNomacanTitles_v1');
export const ONE_YEAR_AGO_DISMISS_KEY = () => nsKey('oneYearAgoBannerDismissedDate_v1'); // JSON化しないプレーンな日付文字列
export const CURRENCY_KEY = () => nsKey('wishOwnCurrency'); // 他ツール(item/companion等)と共有する所持通貨

export const HISTORY_MAX_ENTRIES = 50;
export const QUEST_LOG_MAX_ENTRIES = 50;
export const PACE_SUGGEST_WINDOW_MS = 14 * 86400000;
export const HEATMAP_MIN_WEEKS = 18;
export const HEATMAP_MAX_WEEKS = 53;
export const GOAL_DEFAULT_NAME_MARKER = '目標';

/* ================================================================
   汎用フォーマット・数値ユーティリティ
   ================================================================ */
export function fmt(n) {
  const r = Math.round(n * 100) / 100;
  return r.toLocaleString('ja-JP', { maximumFractionDigits: 2 });
}
// 単数/複数の出し分け用。fmt()と同じ丸め処理を経た値で1かどうかを判定する。
export function isOnePlural(n) {
  return Math.round(n * 100) / 100 === 1;
}
// 負の値・非数値は"0"に正規化する（空文字は単に未入力として維持する）
export function sanitizeNumericFieldValue(raw) {
  if (raw === undefined || raw === null || raw === '') return '';
  const n = parseFloat(raw);
  return (!isFinite(n) || n < 0) ? '0' : raw;
}

export const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function weekdayLabel(idx) { return CURRENT_LANG === 'ja' ? WEEKDAYS_JA[idx] : WEEKDAYS_EN[idx]; }
export function monthShortLabel(idx) { return MONTHS_EN[idx].slice(0, 3); }
export function monthFullLabel(idx) { return MONTHS_EN[idx]; }

export function jpDate(date) {
  if (CURRENT_LANG === 'ja') {
    return date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日(' + weekdayLabel(date.getDay()) + ')';
  }
  return MONTHS_EN[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear() + ' (' + weekdayLabel(date.getDay()) + ')';
}
export function jpDateShort(date) {
  if (CURRENT_LANG === 'ja') return (date.getMonth() + 1) + '月' + date.getDate() + '日';
  return MONTHS_EN[date.getMonth()].slice(0, 3) + ' ' + date.getDate();
}
export function heatmapMonthShort(monthIdx) {
  return CURRENT_LANG === 'ja' ? (monthIdx + 1) + '月' : MONTHS_EN[monthIdx].slice(0, 3);
}
export function formatDateValue(d) {
  const y = d.getFullYear();
  const m = ('0' + (d.getMonth() + 1)).slice(-2);
  const day = ('0' + d.getDate()).slice(-2);
  return y + '-' + m + '-' + day;
}
export function historyTimeLabel(ms) {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(ms));
  const map = {};
  parts.forEach((part) => { map[part.type] = part.value; });
  return map.month + '/' + map.day + ' ' + map.hour + ':' + map.minute;
}

/* ================================================================
   🗂️ 目標（複数目標管理）
   ================================================================ */
export function goalDisplayName(g) {
  if (!g) return '';
  return g.name === GOAL_DEFAULT_NAME_MARKER ? t('goal.defaultGoalName') : g.name;
}
export function goalIsSafeId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id);
}
export function goalGenId() {
  return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
export function goalFieldToString(v) {
  return typeof v === 'string' ? v : (v !== undefined && v !== null ? String(v) : '');
}

export function goalLoadDataRaw() {
  try {
    const parsed = JSON.parse(localStorage.getItem(GOALS_KEY()));
    if (!parsed || !Array.isArray(parsed.goals)) return null;
    const goals = parsed.goals.filter((g) => g && goalIsSafeId(g.id) && typeof g.name === 'string').map((g) => ({
      id: g.id,
      name: g.name,
      target: goalFieldToString(g.target),
      plannedUsage: goalFieldToString(g.plannedUsage),
      targetDate: goalFieldToString(g.targetDate),
      dailyRateOverride: goalFieldToString(g.dailyRateOverride),
    }));
    if (goals.length === 0) return null;
    let activeGoalId = goalIsSafeId(parsed.activeGoalId) ? parsed.activeGoalId : goals[0].id;
    if (!goals.some((g) => g.id === activeGoalId)) activeGoalId = goals[0].id;
    return { goals, activeGoalId };
  } catch (e) { return null; }
}
export function goalSaveData(data) {
  try { localStorage.setItem(GOALS_KEY(), JSON.stringify(data)); } catch (e) { /* noop */ }
}
// 有効なgoalsデータを返す。まだ無ければ、旧形式(単一目標、CALC_STATE_KEY)の
// 保存データがあればそれを引き継いで、無ければ空の目標を1件作って初期化する。
export function goalEnsureInit() {
  const existing = goalLoadDataRaw();
  if (existing) return existing;
  let legacy = {};
  try { legacy = JSON.parse(localStorage.getItem(CALC_STATE_KEY())) || {}; } catch (e) { legacy = {}; }
  const goal = {
    id: goalGenId(),
    name: GOAL_DEFAULT_NAME_MARKER,
    target: goalFieldToString(legacy.target),
    plannedUsage: goalFieldToString(legacy.plannedUsage),
    targetDate: goalFieldToString(legacy.targetDate),
    dailyRateOverride: '',
  };
  const data = { goals: [goal], activeGoalId: goal.id };
  goalSaveData(data);
  return data;
}
export function goalGetActive(data) {
  data = data || goalEnsureInit();
  for (const g of data.goals) { if (g.id === data.activeGoalId) return g; }
  return data.goals[0];
}
export function goalEffectiveDailyRate(g, globalRate) {
  if (g && g.dailyRateOverride !== undefined && g.dailyRateOverride !== null && g.dailyRateOverride !== '') {
    const n = parseInt(g.dailyRateOverride, 10);
    if (isFinite(n)) return Math.max(0, Math.min(25, n));
  }
  return globalRate;
}
// 目標切替モーダルの一覧に添える要約(残り本数・進捗率・今のペースでの目安日数)。
// current/heartsToSendはプロフィール共通の値をそのまま渡す(その目標自身が
// dailyRateOverrideを持っていればgoalEffectiveDailyRateがそちらを優先する)。
export function goalComputeSummary(g, current, globalDailyRate, heartsToSend) {
  const target = Math.max(0, parseFloat(g.target) || 0);
  const plannedUsage = Math.max(0, parseFloat(g.plannedUsage) || 0);
  const effectiveTarget = target + plannedUsage;
  if (effectiveTarget <= 0) return { hasTarget: false };
  current = Math.max(0, current || 0);
  const remaining = effectiveTarget - current;
  const pct = Math.min(100, Math.round((current / effectiveTarget) * 100));
  if (remaining <= 0) return { hasTarget: true, achieved: true, pct: 100 };
  const dailyRate = goalEffectiveDailyRate(g, Math.max(0, Math.min(25, globalDailyRate || 0)));
  const totalDaily = dailyRate - Math.max(0, heartsToSend || 0) * 3;
  const days = totalDaily > 0 ? Math.ceil(remaining / totalDaily) : null;
  return { hasTarget: true, achieved: false, remaining, pct, days };
}

/* ================================================================
   🧭 節目（マイルストーン）・目標日ペースの純粋計算
   どちらも保存データには一切触れない表示専用の計算。
   ================================================================ */
export const MILESTONE_PCTS = [25, 50, 75, 100];
// 進捗の節目（25/50/75/100%）ごとに「あと何本・今の実質ペース（ハート消費を
// 差し引いた1日あたり）であと何日・いつ頃か」を返す。すでに過ぎた節目は含めない。
// perDay<=0 のときは days/dateMs を null にして「本数だけ」の節目を返す。
export function computeMilestones(current, effectiveTarget, perDay, nowMs) {
  current = Math.max(0, current || 0);
  effectiveTarget = Math.max(0, effectiveTarget || 0);
  if (effectiveTarget <= 0 || current >= effectiveTarget) return [];
  const now = isFinite(nowMs) ? nowMs : Date.now();
  const out = [];
  for (const pct of MILESTONE_PCTS) {
    const atAmount = Math.ceil(effectiveTarget * pct / 100);
    if (atAmount <= current) continue;
    const remaining = Math.round((atAmount - current) * 100) / 100;
    const days = perDay > 0 ? Math.ceil(remaining / perDay) : null;
    out.push({ pct, atAmount, remaining, days, dateMs: days !== null ? now + days * 86400000 : null });
  }
  return out;
}
// 目標日までに必要なペース。requiredNet は「1日に純増しなければならない本数」で、
// ハート送信などで毎日消費する分がある場合は、集めペース（スライダー）自体は
// その分を上乗せした requiredGross が必要になる。達成可否の判定は必ず
// 実質ペース（集めペース − 毎日の消費）>= requiredNet で行うこと
// （消費を引く前のペースで判定すると、間に合わないのに「間に合う」と出てしまう）。
export function targetDatePace(remaining, daysUntil, heartCostPerDay) {
  remaining = Math.max(0, remaining || 0);
  if (!isFinite(daysUntil) || daysUntil <= 0 || remaining <= 0) return null;
  const requiredNet = remaining / daysUntil;
  const cost = Math.max(0, heartCostPerDay || 0);
  return { requiredNet, requiredGross: requiredNet + cost, heartCost: cost };
}

/* ================================================================
   💾 本体の入力状態(所持本数・集めペース・ハート送信数)
   ================================================================ */
export function loadCalcState() {
  try {
    const raw = localStorage.getItem(CALC_STATE_KEY());
    if (raw) return JSON.parse(raw);
  } catch (e) { /* no saved data, corrupted data, or storage unavailable */ }
  return null;
}
export function saveCalcState(state) {
  try {
    localStorage.setItem(CALC_STATE_KEY(), JSON.stringify({
      current: sanitizeNumericFieldValue(state.current),
      dailyRate: state.dailyRate,
      heartsToSend: state.heartsToSend,
    }));
  } catch (err) { /* storage unavailable - ignore */ }
}

/* ================================================================
   📜 獲得履歴
   ================================================================ */
export function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY());
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (err) { return []; }
}
export function saveHistory(list) {
  try { localStorage.setItem(HISTORY_KEY(), JSON.stringify(list)); } catch (err) { /* no-op */ }
}
// 履歴に1件追加する(amountが0/falsyなら何もしない)。ストリーク記録もここで一緒に行う
// (元実装のaddHistoryEntry()が「記録」相当の操作のたびに必ずstreakRecordToday()も
// 呼んでいたのと同じ結合)。DOM再描画は呼び出し側(nomacan-view.js)の責務。
export function addHistoryEntry(labelKey, amount, activeGoalId) {
  if (!amount) return null;
  const list = loadHistory();
  list.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    time: Date.now(),
    labelKey,
    amount,
    goalId: activeGoalId || null,
  });
  const trimmed = list.length > HISTORY_MAX_ENTRIES ? list.slice(0, HISTORY_MAX_ENTRIES) : list;
  saveHistory(trimmed);
  const streak = streakRecordToday(STREAK_KEY());
  return { list: trimmed, streak };
}

// 履歴には各操作の「差分」しか記録されていないため、現在の所持本数から新しい順に
// 差分を差し引いて遡ることで各時点の所持本数を逆算する。filterGoalIdがある場合は
// 「その目標がアクティブだった間に記録された差分」だけを古い順に0起点で積み上げる。
export function computeTrendPoints(fullHistory, current, filterGoalId) {
  if (filterGoalId) {
    const filteredChrono = fullHistory.filter((e) => e.goalId === filterGoalId).slice().reverse();
    const points = [];
    let running = 0;
    if (filteredChrono.length > 0) points.push({ time: filteredChrono[0].time - 1, value: 0 });
    for (const e of filteredChrono) {
      running += (e.amount || 0);
      points.push({ time: e.time, value: Math.max(0, running) });
    }
    return points;
  }
  const list = fullHistory; // 新しい順
  const currentVal = Math.max(0, current || 0);
  const points = [];
  let running = currentVal;
  for (const e of list) {
    points.push({ time: e.time, value: Math.max(0, running) });
    running -= (e.amount || 0);
  }
  if (list.length > 0) points.push({ time: list[list.length - 1].time - 1, value: Math.max(0, running) });
  points.push({ time: Date.now(), value: currentVal });
  points.sort((a, b) => a.time - b.time);
  return points;
}

/* ================================================================
   🔥 ストリーク（獲得履歴用・デイリークエスト記録用の両方から、保存先keyだけを
   差し替えて共有する。日付計算(streakDateStr/streakAddDays/streakRunEndingAt)は
   特定のstorage keyに依存しない純粋な関数のため、両者でそのまま再利用する）
   ================================================================ */
export function loadStreakData(key) {
  let s = { days: {}, longest: 0 };
  try {
    const d = JSON.parse(localStorage.getItem(key));
    if (d && typeof d === 'object') s = { days: d.days || {}, longest: d.longest || 0 };
  } catch (e) { /* 破損データは初期状態として扱う */ }
  // 過去の記録の補正に使う入力時刻（獲得履歴/クエスト記録のtime）。どちらのストリークでもない場合は補正しない。
  // 完了フラグは標準版(tai-nomacan単体)と同じ名前・同じnsKey()規則にして、プロフィール削除時に一緒に消え、
  // 単体版とtai-hub版のどちらで補正しても重複して行わないようにする。
  if (key === STREAK_KEY()) {
    return streakMigrateGameDay(s, key, nsKey('skyNomacanStreakGameDay_v1'), () => loadHistory().map((e) => e && e.time));
  }
  if (key === QUEST_STREAK_KEY()) {
    return streakMigrateGameDay(s, key, nsKey('dailyQuestStreakGameDay_v1'), () => loadQuestLog().map((e) => e && e.time));
  }
  return s;
}
export function saveStreakData(key, s) {
  try { localStorage.setItem(key, JSON.stringify(s)); } catch (e) { /* noop */ }
}
export function streakDateStr(d) {
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
export function streakAddDays(dateStr, delta) {
  const p = dateStr.split('-');
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  d.setDate(d.getDate() + delta);
  return streakDateStr(d);
}
export function streakRunEndingAt(days, dateStr) {
  if (!days[dateStr]) return 0;
  let n = 0, cur = dateStr;
  while (days[cur]) { n++; cur = streakAddDays(cur, -1); }
  return n;
}

/* ----------------------------------------------------------------
   🕓 連続記録の「1日」はゲーム内の日付で数える。
   ゲームの日付更新(デイリーリセット)は太平洋時間0時=日本時間では夏時間中16:00
   (冬時間中は17:00)。日付が変わった後でも、次の更新(日本時間15:59/16:59)までの入力は
   前のゲーム内日付の記録として扱い、連続記録が途切れないようにする。
   streakDateStr()はカレンダー計算用(ローカル日付)のままで、「いま/入力時刻がどのゲーム内日付か」
   を求める時だけ下のgameDayStr()を使う。
   ---------------------------------------------------------------- */
let gameDayFormatter = null;
export function gameDayStr(ms) {
  try {
    if (!gameDayFormatter) {
      gameDayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' });
    }
    const m = {};
    gameDayFormatter.formatToParts(new Date(ms)).forEach((p) => { m[p.type] = p.value; });
    return m.year + '-' + m.month + '-' + m.day;
  } catch (e) { return streakDateStr(new Date(ms)); }
}
// ゲーム内の「今日」を、カレンダー計算(ヒートマップ等)用のローカル0時のDateとして返す
export function gameTodayDate() {
  const p = gameDayStr(Date.now()).split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}
// 記録済みの日(days)の中で最も長く連続している日数
function streakLongestRun(days) {
  const keys = Object.keys(days).sort();
  let best = 0, run = 0, prev = null;
  keys.forEach((k) => {
    run = (prev !== null && streakAddDays(prev, 1) === k) ? run + 1 : 1;
    if (run > best) best = run;
    prev = k;
  });
  return best;
}
// 過去の記録の補正。以前はカレンダー日(日本時間0時区切り)で日付を記録していたため、
// 日付が変わった後〜15:59の入力が翌日の記録になり、連続記録が途切れていることがある。
// 残っている入力時刻から本来のゲーム内日付を求めて補い、最長記録も更新する
// (既存の記録は消さない＝連続日数が減ることはない)。プロフィールごとに1回だけ行う。
function streakMigrateGameDay(s, key, flagKey, getTimes) {
  try { if (localStorage.getItem(flagKey) === '1') return s; } catch (e) { return s; }
  let changed = false;
  getTimes().forEach((ms) => {
    if (typeof ms !== 'number' || !isFinite(ms)) return;
    const g = gameDayStr(ms);
    if (!s.days[g]) { s.days[g] = 1; changed = true; }
  });
  if (changed) {
    s.longest = Math.max(s.longest, streakLongestRun(s.days));
    saveStreakData(key, s);
  }
  try { localStorage.setItem(flagKey, '1'); } catch (e) { /* noop */ }
  return s;
}
export function streakRecordToday(key) {
  const s = loadStreakData(key);
  const today = gameDayStr(Date.now());
  if (!s.days[today]) {
    s.days[today] = 1;
    s.longest = Math.max(s.longest, streakRunEndingAt(s.days, today));
    saveStreakData(key, s);
  }
  return s;
}
export function streakCurrentLive(s) {
  const today = gameDayStr(Date.now());
  if (s.days[today]) return streakRunEndingAt(s.days, today);
  const yesterday = streakAddDays(today, -1);
  if (s.days[yesterday]) return streakRunEndingAt(s.days, yesterday);
  return 0;
}
// 表示範囲(グリッドの開始日・週数)を、記録済みの最も古い日付とHEATMAP_MIN/MAX_WEEKSから決める。
export function computeHeatmapRange(days) {
  const today = gameTodayDate();
  let minDate = today;
  Object.keys(days).forEach((k) => {
    const p = k.split('-');
    const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    if (!isNaN(d.getTime()) && d < minDate) minDate = d;
  });
  const daysSinceEarliest = Math.max(0, Math.round((today - minDate) / 86400000));
  const weeksNeeded = Math.ceil((daysSinceEarliest + 1) / 7) + 1;
  const weeks = Math.min(HEATMAP_MAX_WEEKS, Math.max(HEATMAP_MIN_WEEKS, weeksNeeded));
  const endOfThisWeek = new Date(today);
  endOfThisWeek.setDate(endOfThisWeek.getDate() + (6 - today.getDay()));
  const start = new Date(endOfThisWeek);
  start.setDate(start.getDate() - (weeks * 7 - 1));
  return { start, weeks, today };
}

/* ================================================================
   🗒️ デイリークエスト記録（獲得履歴とは完全に別ストレージのログ+ストリーク）
   ================================================================ */
export function loadQuestLog() {
  try {
    const raw = localStorage.getItem(QUEST_LOG_KEY());
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (err) { return []; }
}
export function saveQuestLog(list) {
  try { localStorage.setItem(QUEST_LOG_KEY(), JSON.stringify(list)); } catch (err) { /* no-op */ }
}
export function questDateLabel(dateStr) {
  const p = dateStr.split('-');
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  return jpDateShort(d);
}
// 今日の分を保存する。同じ日にすでにエントリがあれば上書き、なければ先頭に新規追加し、
// 最大件数を超えた古い分を切り捨てる。ストリーク記録も一緒に行う。
export function questLogSave(text) {
  text = (text || '').trim();
  if (!text) return null;
  const today = gameDayStr(Date.now());
  const list = loadQuestLog();
  const existing = list.find((e) => e.date === today);
  if (existing) {
    existing.text = text;
    existing.time = Date.now();
  } else {
    list.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), date: today, time: Date.now(), text });
    if (list.length > QUEST_LOG_MAX_ENTRIES) list.length = QUEST_LOG_MAX_ENTRIES;
  }
  saveQuestLog(list);
  const streak = streakRecordToday(QUEST_STREAK_KEY());
  return { list, streak };
}
export function questLogTodayText() {
  const today = gameDayStr(Date.now());
  const found = loadQuestLog().find((e) => e.date === today);
  return found ? found.text : '';
}

/* ================================================================
   🎉 「1年前の今日」お知らせバナー
   ================================================================ */
export function oneYearAgoTruncate(text, max) {
  if (!text) return '';
  return text.length > max ? text.slice(0, max) + '…' : text;
}
export function findOneYearAgoHistoryEntry(history, today) {
  for (const e of history) {
    const g = gameDayStr(e.time).split('-');
    if (Number(g[1]) - 1 === today.getMonth() && Number(g[2]) === today.getDate() && Number(g[0]) === today.getFullYear() - 1) return e;
  }
  return null;
}
export function findOneYearAgoQuestEntry(questList, today) {
  for (const e of questList) {
    const p = e.date.split('-');
    const y = Number(p[0]), m = Number(p[1]) - 1, dNum = Number(p[2]);
    if (m === today.getMonth() && dNum === today.getDate() && y === today.getFullYear() - 1) return e;
  }
  return null;
}

/* ================================================================
   🏆 称号(実績)
   ================================================================ */
export function loadTitleStore() {
  try {
    const d = JSON.parse(localStorage.getItem(TITLES_KEY()));
    if (d && typeof d === 'object') return { earned: d.earned || {}, hwm: { currentMax: (d.hwm && d.hwm.currentMax) || 0 } };
  } catch (e) { /* 破損データは初期状態として扱う */ }
  return { earned: {}, hwm: { currentMax: 0 } };
}
export function saveTitleStore(store) {
  try { localStorage.setItem(TITLES_KEY(), JSON.stringify(store)); } catch (e) { /* noop */ }
}
// 現在値からhwmを更新し、新規解禁分の称号一覧を返す(判定・保存まで行う。トースト表示・
// パネル再描画は呼び出し側の責務)。
export function checkAndUnlockTitles(currentValue, longestStreak) {
  const store = loadTitleStore();
  store.hwm.currentMax = Math.max(store.hwm.currentMax, Math.max(0, currentValue || 0));
  const stats = { currentMax: store.hwm.currentMax, longestStreak: longestStreak || 0 };
  const newlyEarned = [];
  TITLES.forEach((ti) => {
    if (store.earned[ti.id]) return;
    if (ti.condition(stats)) {
      store.earned[ti.id] = new Date().toISOString();
      newlyEarned.push(ti);
    }
  });
  saveTitleStore(store);
  return { store, newlyEarned };
}

/* ================================================================
   📊 獲得履歴から算出する「実際の平均ペース」
   ================================================================ */
export function computeActualDailyRate(history) {
  if (!history || history.length < 2) return null;
  const now = Date.now();
  const windowStart = now - PACE_SUGGEST_WINDOW_MS;
  const inWindow = history.filter((e) => e.time >= windowStart);
  const sample = inWindow.length >= 2 ? inWindow : history;
  if (sample.length < 2) return null;
  let total = 0, minTime = sample[0].time, maxTime = sample[0].time;
  for (const e of sample) {
    total += (e.amount || 0);
    if (e.time < minTime) minTime = e.time;
    if (e.time > maxTime) maxTime = e.time;
  }
  const spanDays = Math.max(1, (maxTime - minTime) / 86400000);
  return total / spanDays;
}
export function computeActualDailyRateRange(history) {
  if (!history || history.length < 2) return null;
  const now = Date.now();
  const windowStart = now - PACE_SUGGEST_WINDOW_MS;
  const inWindow = history.filter((e) => e.time >= windowStart);
  const sample = inWindow.length >= 2 ? inWindow : history;
  if (sample.length < 2) return null;
  const chrono = sample.slice().sort((a, b) => a.time - b.time);
  const segRates = [];
  for (let i = 1; i < chrono.length; i++) {
    const spanDays = (chrono[i].time - chrono[i - 1].time) / 86400000;
    if (spanDays <= 0) continue;
    segRates.push((chrono[i].amount || 0) / spanDays);
  }
  if (segRates.length === 0) return null;
  let min = segRates[0], max = segRates[0];
  for (const r of segRates) { if (r < min) min = r; if (r > max) max = r; }
  return { min, max };
}

/* ================================================================
   💰 所持通貨（他ツール横断で共有するキャンドル所持数）
   移植元: item/tai-nomacan共通の pfLoadCurrency()/pfSaveCurrencyField()。
   tai-hub側のプロフィールモーダル(js/chrome/pf-modal.js)は所持通貨パネル
   自体を意図的に簡略化済み(README参照)だが、保存データの形状(wishOwnCurrency.
   candle)自体は他ツールと共有のため、この「所持通貨から反映」ボタン用に
   candleフィールドの読み書きだけをここで直接行う。
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

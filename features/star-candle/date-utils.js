/* ================================================================
   star-candle-view.js / star-candle-forecast.js の両方から使う、小さな
   日付・数値フォーマット関数群。star-candle/index.html の同名関数
   （fmt/jpDate/weekdayLabel/monthYearLabel/formatDateValue、~行2799-2803,
   5289-5300, 5514-5519）を、2ファイルに重複させず1箇所にまとめたもの。
   ロジックは元の実装と同一。
   ================================================================ */
import { CURRENT_LANG } from '../../js/i18n.js';

export const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];
export const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function weekdayLabel(idx) {
  return CURRENT_LANG === 'ja' ? WEEKDAYS_JA[idx] : WEEKDAYS_EN[idx];
}

export function monthYearLabel(year, month1) {
  if (CURRENT_LANG !== 'ja') return `${MONTHS_EN[month1 - 1]} ${year}`;
  return `${year}年${month1}月`;
}

export function fmt(n) {
  const r = Math.round(n * 100) / 100;
  return r.toLocaleString('ja-JP', { maximumFractionDigits: 2 });
}

export function jpDate(date) {
  if (CURRENT_LANG !== 'ja') {
    return MONTHS_EN[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear() + ' (' + WEEKDAYS_EN[date.getDay()] + ')';
  }
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日(' + days[date.getDay()] + ')';
}

export function formatDateValue(d) {
  const y = d.getFullYear();
  const m = ('0' + (d.getMonth() + 1)).slice(-2);
  const day = ('0' + d.getDate()).slice(-2);
  return y + '-' + m + '-' + day;
}

export function pad2(n) { return String(n).padStart(2, '0'); }

// 進捗の節目（25/50/75/100%）ごとに「あと何本・週あたりペースであと何週間・
// いつ頃か」を返す純粋計算（表示専用、保存データには触れない）。
// すでに過ぎた節目は含めない。perWeek<=0 のときは weeks/dateMs を null にする。
export const MILESTONE_PCTS = [25, 50, 75, 100];
export function computeWeeklyMilestones(current, target, perWeek, nowMs) {
  current = Math.max(0, current || 0);
  target = Math.max(0, target || 0);
  if (target <= 0 || current >= target) return [];
  const now = isFinite(nowMs) ? nowMs : Date.now();
  const out = [];
  for (const pct of MILESTONE_PCTS) {
    const atAmount = Math.ceil(target * pct / 100);
    if (atAmount <= current) continue;
    const remaining = Math.round((atAmount - current) * 100) / 100;
    const weeks = perWeek > 0 ? Math.ceil(remaining / perWeek) : null;
    out.push({ pct, atAmount, remaining, weeks, dateMs: weeks !== null ? now + weeks * 7 * 86400000 : null });
  }
  return out;
}

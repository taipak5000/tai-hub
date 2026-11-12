/* ================================================================
   📅 予定を .ics（カレンダーファイル）にする（2026-11-12）。
   文字列を組み立てて端末に保存するだけで、どこにも送らない。
   ・予定は「終日」で入れる（DTSTART;VALUE=DATE）。日付は日本時間（Asia/Tokyo）で数える。
     例: 太平洋時間 11/12 23:59:59 に終わるイベント＝日本時間 11/13 16:59 → 11/13 の終日予定。
   ・終日の予定にはタイムゾーンが無いので、どの端末のカレンダーでも同じ日付に出る。
   ・使っている所: ダッシュボード（features/shared/event-dashboard.js）の各予定の「カレンダーに追加」と、まとめて書き出し。
   ================================================================ */
const HOST = 'taipak5000.github.io';
const TZ = 'Asia/Tokyo';

/** その瞬間が日本時間で何年何月何日か → 'YYYYMMDD' */
export function tokyoDateStr(when) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(when));
  const get = type => parts.find(p => p.type === type).value;
  return `${get('year')}${get('month')}${get('day')}`;
}
/** 'YYYYMMDD' の翌日 */
function nextDay(ymd) {
  const d = new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8) + 1));
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}
function stamp(d = new Date()) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
export function icsEscape(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
// 1行75オクテットまで（RFC 5545）。日本語は1文字3バイトなので、長い行は折り返す
function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = '';
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ch; } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

// 予定ごとに決まるUID（日本語の名前も区別できるよう、英数字以外を含む時はハッシュを足す）
function uidOf(id) {
  const str = String(id);
  const ascii = str.replace(/[^A-Za-z0-9._-]/g, '');
  if (ascii === str) return str;
  let h = 2166136261;
  for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return `${ascii}-${h.toString(36)}`;
}

/**
 * 終日の予定1件。ev = { id, date: 'YYYYMMDD'（日本時間の日付）, summary, description? }
 * id は同じ予定を何度取り込んでも重複しないように、予定ごとに決まった文字列にする
 */
export function allDayEvent(ev) {
  return [
    'BEGIN:VEVENT',
    `UID:${uidOf(ev.id)}@${HOST}`,
    `DTSTAMP:${stamp()}`,
    `DTSTART;VALUE=DATE:${ev.date}`,
    `DTEND;VALUE=DATE:${nextDay(ev.date)}`,
    `SUMMARY:${icsEscape(ev.summary)}`,
    ...(ev.description ? [`DESCRIPTION:${icsEscape(ev.description)}`] : []),
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ];
}

/** VEVENT の行の配列をまとめて1つのカレンダーにする */
export function calendarText(eventLines, lang = 'ja') {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${HOST}//tai-hub//${String(lang).toUpperCase()}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...eventLines,
    'END:VCALENDAR',
  ].map(fold).join('\r\n') + '\r\n';
}

/** .ics を端末に保存する */
export function downloadIcs(text, filename) {
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

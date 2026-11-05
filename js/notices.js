/* ================================================================
   🔔 お知らせ（ドックの「お知らせ」ボタン・js/chrome/notice-modal.js）の中身を集める。
   各ツールがばらばらに持っている「期限」や「来訪」を、ひとつの一覧にまとめる。

   集めるもの（どれも端末のデータと同梱の予定データから計算し、通信はしない）:
     - 旅の精霊の来訪（来訪中／発表済み）。再訪精霊データベースで「待っている」にした精霊なら強調し、
       アイテム所持管理の「欲しいもの」に入れたアイテムが来訪で手に入るなら名前を挙げる
     - 季節の終了・開始が近い（7日以内）／イベントの終了・開始が近い（3日以内）／次回アップデート（7日以内）
     - フレンドの記念日（7日以内。features/friends）
     - 週替わりビンゴの新しい週（ビンゴを使ったことがある人だけ）
     - 年末年始の「一年のふりかえり」
   既読はプロフィールごと（nsKey('noticesSeen_v1')＝お知らせのidの配列）。お知らせのidは
   「何の・いつの回か」まで含むので、次の来訪・翌年の記念日はまた未読として出る。
   ================================================================ */
import { CURRENT_LANG } from './i18n.js';
import { nsKey, getWishIds, isItemOwned } from './state.js';
import { cycleIndexAt, cycleBounds } from './pacific-time.js';
import { CURRENT_SEASON, EVENT_SCHEDULE, NEXT_UPDATE, REVISIT_SPIRIT_SCHEDULES } from '../features/item/data/season-data.js';
import { loadFriendsDoc, upcomingAnniversaries } from '../features/friends/friends-state.js';
import { hasBingoData, loadBingo, weekKeyAt } from '../features/bingo/bingo-state.js';
import { evaluateStamps, seenCount } from '../features/stamps/stamps-state.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
const DAY = 86400000;
const SEEN_KEY = 'noticesSeen_v1';
export const WAITLIST_KEY = 'revisitWaitlist_v1'; // 再訪精霊データベースの「待っている」精霊（英語名の配列）

/* ── 再訪の「待っている」精霊 ── */
export function getWaitlist() {
  try { const v = JSON.parse(localStorage.getItem(nsKey(WAITLIST_KEY))); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; }
  catch (e) { return []; }
}
export function isWaiting(nameEn) { return getWaitlist().includes(nameEn); }
export function toggleWaiting(nameEn) {
  const list = getWaitlist();
  const i = list.indexOf(nameEn);
  if (i === -1) list.push(nameEn); else list.splice(i, 1);
  try { localStorage.setItem(nsKey(WAITLIST_KEY), JSON.stringify(list)); } catch (e) { /* noop */ }
  notifyChanged();
  return i === -1;
}

/* ── 既読 ── */
function seenSet() {
  try { const v = JSON.parse(localStorage.getItem(nsKey(SEEN_KEY))); return new Set(Array.isArray(v) ? v : []); }
  catch (e) { return new Set(); }
}
export function markSeen(ids) {
  const set = seenSet();
  ids.forEach(id => set.add(id));
  try { localStorage.setItem(nsKey(SEEN_KEY), JSON.stringify([...set].slice(-300))); } catch (e) { /* noop */ }
  notifyChanged();
}

// ドックのバッジなど、件数を表示している所へ「変わったかも」を知らせる
const listeners = new Set();
export function onNoticesChanged(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function notifyChanged() { listeners.forEach(fn => { try { fn(); } catch (e) { /* noop */ } }); }

/* ── 期間の計算 ── */
function scheduleWindow(s, now) {
  if (s.intervalDays) {
    if (!s.anchorStart || !s.anchorEnd) return null;
    // 精霊の名前とアイテムが分かっているのは、データにある直近の来訪（k=0）だけ。それより後の来訪は
    // データを更新するまで誰が来るか分からないので、名前もアイテムも出さない
    const k = cycleIndexAt(s, now);
    const cur = cycleBounds(s, k);
    if (cur.start <= now && now <= cur.end) return { active: true, start: cur.start, end: cur.end, unknownSpirit: k !== 0 };
    const next = cycleBounds(s, k + 1);
    return { active: false, start: next.start, end: next.end, unknownSpirit: k + 1 !== 0 };
  }
  if (!s.start || !s.end) return null;
  const start = new Date(s.start), end = new Date(s.end);
  if (start <= now && now <= end) return { active: true, start, end };
  if (now < start) return { active: false, start, end };
  return null;
}
function daysLeftText(ms) {
  const d = Math.ceil(ms / DAY);
  if (ms < DAY) {
    const h = Math.max(1, Math.ceil(ms / 3600000));
    return t(`あと${h}時間`, `${h}h left`);
  }
  return t(`あと${d}日`, `${d} days left`);
}
function fmtDate(d) {
  const wd = t('日,月,火,水,木,金,土', 'Sun,Mon,Tue,Wed,Thu,Fri,Sat').split(',')[d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}(${wd}) ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function dateKey(d) { return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }

/**
 * お知らせの一覧（重要なもの→近いものの順）。
 * 各要素: { id, icon, tone: 'accent'|'warm'|'pink'|'plain', title, body, route?, routeLabel?, wishItems?: [{catKey,id}] }
 */
export function collectNotices(nowDate = new Date()) {
  const now = nowDate;
  const out = [];
  const waitlist = new Set(getWaitlist());

  // 旅の精霊・再訪
  REVISIT_SPIRIT_SCHEDULES.forEach((s, si) => {
    const w = scheduleWindow(s, now);
    if (!w) return;
    if (!w.active && w.start - now > 7 * DAY) return;
    const knownSpirit = !w.unknownSpirit;
    const name = knownSpirit ? (CURRENT_LANG === 'en' ? s.spiritEn : s.spiritJa) : null;
    const waiting = knownSpirit && s.spiritEn && waitlist.has(s.spiritEn);
    const wishItems = knownSpirit ? (s.items || []).filter(it => getWishIds(it.catKey).includes(String(it.id)) && !isItemOwned(it.catKey, it.id)) : [];
    const when = w.active ? t(`終了まで${daysLeftText(w.end - now)}（${fmtDate(w.end)}まで）`, `Ends in ${daysLeftText(w.end - now)} (until ${fmtDate(w.end)})`)
      : t(`${fmtDate(w.start)}から`, `From ${fmtDate(w.start)}`);
    let title;
    if (waiting) title = w.active ? t(`待っていた「${name}」が来ています`, `${name}, whom you were waiting for, is here`) : t(`待っていた「${name}」がもうすぐ来ます`, `${name}, whom you were waiting for, arrives soon`);
    else if (name) title = w.active ? t(`旅の精霊「${name}」が来ています`, `Traveling spirit: ${name}`) : t(`旅の精霊「${name}」がもうすぐ来ます`, `${name} arrives soon`);
    else title = t('次の旅の精霊がもうすぐ来ます', 'The next traveling spirit arrives soon');
    let body = when;
    if (wishItems.length) body += t(`\n欲しいものリストのアイテムが${wishItems.length}つ手に入ります`, `\n${wishItems.length} item(s) on your wishlist are available`);
    out.push({
      id: `revisit:${si}:${dateKey(w.start)}${waiting ? ':w' : ''}${wishItems.length ? ':i' : ''}`,
      icon: 'i-wing', tone: waiting || wishItems.length ? 'accent' : 'plain', priority: waiting || wishItems.length ? 0 : 2,
      sortAt: w.active ? w.end : w.start,
      title, body, wishItems,
      route: wishItems.length ? 'item' : 'tai-revisit', routeLabel: wishItems.length ? t('アイテム所持管理', 'Item tracker') : t('再訪精霊データベース', 'Revisit database'),
    });
  });

  // 季節
  if (CURRENT_SEASON && CURRENT_SEASON.endDate) {
    const start = CURRENT_SEASON.startDate ? new Date(CURRENT_SEASON.startDate) : null;
    const end = new Date(CURRENT_SEASON.endDate);
    if (start && now < start && start - now <= 7 * DAY) {
      out.push({ id: `season-start:${CURRENT_SEASON.name}`, icon: 'i-sparkle', tone: 'warm', priority: 1, sortAt: start, title: t(`「${CURRENT_SEASON.name}」がもうすぐ始まります`, `${CURRENT_SEASON.name} starts soon`), body: t(`${fmtDate(start)}から`, `From ${fmtDate(start)}`), route: 'spirit-catalog', routeLabel: t('精霊ツリー管理', 'Spirit trees') });
    } else if ((!start || now >= start) && now < end && end - now <= 7 * DAY) {
      out.push({ id: `season-end:${CURRENT_SEASON.name}`, icon: 'i-warning', tone: 'warm', priority: 1, sortAt: end, title: t(`「${CURRENT_SEASON.name}」がまもなく終わります`, `${CURRENT_SEASON.name} ends soon`), body: t(`終了まで${daysLeftText(end - now)}（${fmtDate(end)}まで）。季節のキャンドルや残りのアイテムを確かめておきましょう`, `Ends in ${daysLeftText(end - now)}. Check your season candles and remaining items.`), route: 'star-candle', routeLabel: t('星のキャンドル計算機', 'Star candle calculator') });
    }
  }

  // イベント
  (EVENT_SCHEDULE || []).forEach(ev => {
    const start = ev.start ? new Date(ev.start) : null;
    const end = new Date(ev.end);
    if (start && now < start && start - now <= 3 * DAY) {
      out.push({ id: `event-start:${ev.name}:${dateKey(start)}`, icon: 'i-calendar', tone: 'plain', priority: 2, sortAt: start, title: t(`「${ev.name}」がもうすぐ始まります`, `${ev.name} starts soon`), body: t(`${fmtDate(start)}から`, `From ${fmtDate(start)}`), route: 'item', routeLabel: t('アイテム所持管理', 'Item tracker') });
    } else if ((!start || now >= start) && now < end && end - now <= 3 * DAY) {
      out.push({ id: `event-end:${ev.name}:${dateKey(end)}`, icon: 'i-calendar', tone: 'warm', priority: 1, sortAt: end, title: t(`「${ev.name}」がまもなく終わります`, `${ev.name} ends soon`), body: t(`終了まで${daysLeftText(end - now)}（${fmtDate(end)}まで）`, `Ends in ${daysLeftText(end - now)} (until ${fmtDate(end)})`), route: 'item', routeLabel: t('アイテム所持管理', 'Item tracker') });
    }
  });

  // 次回アップデート
  if (NEXT_UPDATE && NEXT_UPDATE.date) {
    const d = new Date(NEXT_UPDATE.date);
    if (now < d && d - now <= 7 * DAY) out.push({ id: `update:${dateKey(d)}`, icon: 'i-sync', tone: 'plain', priority: 2, sortAt: d, title: t('次回アップデートが近づいています', 'The next update is coming'), body: t(`${fmtDate(d)}ごろ`, `Around ${fmtDate(d)}`) });
  }

  // フレンドの記念日
  const fdoc = loadFriendsDoc();
  upcomingAnniversaries(fdoc, 7, now).forEach(a => {
    const who = a.friend ? a.friend.name || t('フレンド', 'Friend') : '';
    const whenTxt = a.inDays === 0 ? t('今日', 'Today') : a.inDays === 1 ? t('明日', 'Tomorrow') : t(`${a.inDays}日後（${a.date.getMonth() + 1}/${a.date.getDate()}）`, `In ${a.inDays} days (${a.date.getMonth() + 1}/${a.date.getDate()})`);
    let title;
    if (a.kind === 'friend') title = t(`${who}さんとフレンドになって${a.years}周年`, `${a.years} year(s) with ${who}`);
    else if (a.kind === 'milestone') title = t(`${who}さんとフレンドになって${a.count}日`, `${a.count} days with ${who}`);
    else if (a.kind === 'birthday') title = a.years ? t(`${who}さんの${a.years}歳の誕生日`, `${who}'s ${a.years}th birthday`) : t(`${who}さんの誕生日`, `${who}'s birthday`);
    else title = a.years ? t(`${a.title}（${a.years}年目）`, `${a.title} (year ${a.years})`) : a.title;
    out.push({ id: `anniv:${a.key}`, icon: 'i-heart', tone: 'pink', priority: a.inDays === 0 ? 0 : 1, sortAt: a.date, title, body: whenTxt, route: 'friends', routeLabel: t('フレンド記念日', 'Friend anniversaries') });
  });

  // 週替わりビンゴ
  if (hasBingoData()) {
    const key = weekKeyAt(now.getTime());
    const b = loadBingo();
    if (!b.week || b.week.key !== key) {
      out.push({ id: `bingo:${key}`, icon: 'i-grid', tone: 'plain', priority: 3, sortAt: now, title: t('今週のビンゴが始まりました', 'A new weekly bingo has started'), body: t('新しいお題がそろっています', 'New prompts are ready'), route: 'bingo', routeLabel: t('週替わりビンゴ', 'Weekly bingo') });
    }
  }

  // スタンプ帳: 前に開いた時より押されたスタンプが増えていたら
  try {
    const { earned } = evaluateStamps();
    const n = Object.keys(earned).length;
    const diff = n - seenCount();
    if (diff > 0) out.push({ id: `stamps:${n}`, icon: 'i-crown', tone: 'pink', priority: 2, sortAt: now, title: t(`新しいスタンプが${diff}こ押されました`, `${diff} new stamp(s)!`), body: t(`スタンプ帳で確かめてみましょう（全部で${n}こ）`, `Check your stamp book (${n} total)`), route: 'stamps', routeLabel: t('スタンプ帳', 'Stamp book') });
  } catch (e) { /* 判定に失敗してもほかのお知らせは出す */ }

  // 先月のふりかえり（毎月1日〜7日。1月は一年のふりかえりと並べて出す）
  {
    const dd = now.getDate();
    if (dd <= 7) {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      out.push({ id: `recap-month:${prev.getFullYear()}-${prev.getMonth() + 1}`, icon: 'i-trophy', tone: 'plain', priority: 3, sortAt: now, title: t(`${prev.getMonth() + 1}月のふりかえりができました`, `Your ${prev.toLocaleString('en', { month: 'long' })} recap is ready`), body: t('先月に集めたものと続けたことをまとめました', 'What you collected and kept up last month'), route: 'recap', sub: 'month', routeLabel: t('ふりかえり', 'Recap') });
    }
  }

  // 一年のふりかえり（12/1〜1/7）
  const m = now.getMonth() + 1, d = now.getDate();
  if (m === 12 || (m === 1 && d <= 7)) {
    const year = m === 12 ? now.getFullYear() : now.getFullYear() - 1;
    out.push({ id: `recap:${year}`, icon: 'i-trophy', tone: 'accent', priority: 3, sortAt: now, title: t(`${year}年のふりかえりができました`, `Your ${year} in review is ready`), body: t('集めたアイテムや続けた記録を1枚のカードにまとめました', 'Your collection and streaks on one card'), route: 'recap', routeLabel: t('ふりかえり', 'Recap') });
  }

  return out.sort((a, b) => (a.priority - b.priority) || (a.sortAt - b.sortAt));
}

export function unseenCount(now = new Date()) {
  const seen = seenSet();
  return collectNotices(now).filter(n => !seen.has(n.id)).length;
}
export function isSeen(id) { return seenSet().has(id); }

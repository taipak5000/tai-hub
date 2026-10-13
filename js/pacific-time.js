/* ================================================================
   🕓 太平洋時間(PT)⇔実時刻の変換（夏時間の切替に対応）

   ゲームのリセット類（デイリー・週間・ウニ/パン/亀・再訪の周期など）はすべて「太平洋時間の壁時計」
   基準で動く。そのため夏時間(UTC-7)⇔標準時(UTC-8)の切替（毎年11月第1日曜・3月第2日曜）の前後で
   日本時間の時刻が1時間動く（夏時間中: 毎日16:00 → 標準時: 17:00。2026年は11/1 18:00 JSTに切替）。
   「今との時差を固定で足す」「24時間×日数で足す」方式だと、切替をまたぐ予定が1時間ずれるため、
   壁時計⇔実時刻の変換は必ずここを通す（各サイトのpfDashPtToReal等と同じ実装）。
   ================================================================ */

let ptFormatter = null;

// 実時刻ms → 太平洋時間の壁時計の各成分 {year, month, day, hour, minute, second}
export function ptParts(ms) {
  if (!ptFormatter) {
    ptFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles', hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
  }
  const o = {};
  ptFormatter.formatToParts(new Date(ms)).forEach((p) => { if (p.type !== 'literal') o[p.type] = Number(p.value); });
  if (o.hour === 24) o.hour = 0;
  return o;
}

// 太平洋時間の壁時計の成分 → 実時刻(Date)。日が範囲を超えていてもよい（例: day=32は翌月1日）。
// 夏時間(UTC-7)と標準時(UTC-8)の両方の候補を実際にPTへ変換し直し、元の壁時計と一致する方を採用する
// （切替の前後でも正確。3月の「存在しない2時台」は標準時として扱う）
export function ptToReal(y, mo, d, h, mi, s) {
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  for (const offsetH of [7, 8]) {
    const real = wall + offsetH * 3600000;
    const p = ptParts(real);
    if (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) === wall) return new Date(real);
  }
  return new Date(wall + 8 * 3600000);
}

// pacificNow()のような「太平洋時間の壁時計をローカルタイムゾーンの見た目で表したDate」→ 実時刻
export function pacificFakeToReal(fake) {
  return new Date(ptToReal(fake.getFullYear(), fake.getMonth() + 1, fake.getDate(), fake.getHours(), fake.getMinutes(), fake.getSeconds()).getTime() + fake.getMilliseconds());
}

// 周期的な来訪(intervalDaysあり)のk周期目の開始・終了。anchorStart/anchorEndを太平洋時間の壁時計に直し、
// 日付だけをintervalDays×k日ずらして実時刻へ戻す（「24時間×日数」で足すと、切替後の周期が1時間ずれる）
export function cycleBounds(schedule, k) {
  const a = ptParts(new Date(schedule.anchorStart).getTime());
  const e = ptParts(new Date(schedule.anchorEnd).getTime());
  const shift = k * schedule.intervalDays;
  return {
    start: ptToReal(a.year, a.month, a.day + shift, a.hour, a.minute, a.second),
    end: ptToReal(e.year, e.month, e.day + shift, e.hour, e.minute, e.second),
  };
}

// 時刻t（Dateまたはms）の時点で「始まっている最新の周期」の番号k（tが最初の周期より前なら負になる）
export function cycleIndexAt(schedule, t) {
  const ms = new Date(t).getTime();
  let k = Math.floor((ms - new Date(schedule.anchorStart).getTime()) / (schedule.intervalDays * 86400000));
  while (cycleBounds(schedule, k).start.getTime() > ms) k--;
  while (cycleBounds(schedule, k + 1).start.getTime() <= ms) k++;
  return k;
}

// fromMs〜toMsの間に起きる夏時間⇔標準時の切替の瞬間(ms)を古い順に返す（.icsの繰り返し予定を切替で分割するのに使う）。
// 1日刻みでUTCオフセットの変化を探し、変化した日の中を1時間刻みで絞り込む（切替は常にちょうど1時間の境目）
export function ptOffsetChanges(fromMs, toMs) {
  const HOUR = 3600000;
  const DAY = 86400000;
  const offsetAt = (ms) => {
    const p = ptParts(ms);
    return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000) / 60000);
  };
  const out = [];
  let t = Math.floor(fromMs / HOUR) * HOUR;
  let prev = offsetAt(t);
  while (t < toMs) {
    const dayEnd = t + DAY;
    if (offsetAt(dayEnd) !== prev) {
      for (let h = t + HOUR; h <= dayEnd; h += HOUR) {
        if (offsetAt(h) !== prev) {
          if (h > fromMs && h <= toMs) out.push(h);
          prev = offsetAt(h);
          break;
        }
      }
    }
    t = dayEnd;
  }
  return out;
}

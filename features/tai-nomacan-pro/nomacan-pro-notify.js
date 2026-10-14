/* ================================================================
   nomacan-pro-notify.js — 🔔 黒シャード発生前／デイリーリセット前の通知リマインダー

   tai-nomacan.pro/index.html の scheduleShardNotification / scheduleDailyResetNotification /
   onToggleShardNotify / onToggleDailyResetNotify を移植したもの（Notification API・オプトイン）。
   ・タブ（ハブ）を開いたままにしている間、発生/リセットの5分前にブラウザ通知を出す。
     閉じたタブには届かない（サーバーのプッシュ通知ではなく、setTimeoutによる予約のため）。
   ・ハブは1つのタブで全ツールを行き来するため、予約はこのモジュールが持ち、ルートを離れても
     止めない。アプリ起動時（js/app.js）にも「オン＋許可済み」なら予約を始める。
   ・時刻はPT(太平洋時間)の壁時計から求める（nomacan-pro-state.jsのpacificWallClockToUtcMs。
     夏時間(PDT)/標準時(PST)の切替をまたいでも正確）。「17:00/奇数時」等は直書きしない。
   ・setTimeoutの上限(約24.8日)を超える待ち時間は分割して再予約する（元実装は31日先まで
     探すため、超えると即時に鳴ってしまう）。
   ================================================================ */
import { CURRENT_LANG } from '../../js/i18n.js';
import { t } from './data/i18n-nomacan-pro.js';
import { displayAreaName } from './data/area-names-en.js';
import * as S from './nomacan-pro-state.js';

const LEAD_MS = 5 * 60 * 1000;      // 5分前
const MAX_WAIT_MS = 6 * 3600 * 1000; // 1回の待ちは最長6時間（長い待ちは再予約でつなぐ）
const JP_WEEKDAY = ['日', '月', '火', '水', '木', '金', '土'];

let shardTimerId = null;
let dailyTimerId = null;
let lastNotifiedShardUtcMs = 0; // 直前に通知済みの発生時刻（同じ回への二重通知を防ぐ）
let currentShardHit = null;     // 現在追跡中の発生日。その日の3回を消化したら次の発生日へ進める

function lsGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function lsSet(key, val) { try { localStorage.setItem(key, val); } catch (e) { /* noop */ } }

export function isShardNotifyEnabled() { return lsGet(S.SHARD_NOTIFY_KEY) === '1'; }
export function isDailyResetNotifyEnabled() { return lsGet(S.DAILYRESET_NOTIFY_KEY) === '1'; }
function permissionGranted() { return typeof Notification !== 'undefined' && Notification.permission === 'granted'; }

async function requestPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try { return await Notification.requestPermission(); } catch (e) { return 'denied'; }
}

// 発生時刻のラベル（通知本文用。表示言語に関わらず曜日は日本語一字＝画面のチップと同じ）
function formatOccurrence(occ) {
  let dayLabel;
  if (occ.dayDiff === 0) dayLabel = t('date.today');
  else if (occ.dayDiff === 1) dayLabel = t('date.tomorrow');
  else dayLabel = `${occ.month}/${occ.day}(${JP_WEEKDAY[occ.weekday]})`;
  return `${dayLabel} ${occ.hour}:${String(occ.minute).padStart(2, '0')}`;
}

function clearShardTimer() { if (shardTimerId) { clearTimeout(shardTimerId); shardTimerId = null; } }
function clearDailyTimer() { if (dailyTimerId) { clearTimeout(dailyTimerId); dailyTimerId = null; } }

function scheduleShard() {
  clearShardTimer();
  if (!isShardNotifyEnabled() || !permissionGranted()) return;
  // 画面の予測は日付をまたいでも自動更新されないため、常に「今」を基準に探し直す
  if (!currentShardHit) currentShardHit = S.findTodayOrNextBlackShard();
  let next = null;
  for (let guard = 0; guard < 32 && currentShardHit; guard++) {
    const occs = S.blackShardOccurrencesInJst(currentShardHit, 3);
    next = occs.find((o) => o.utcMs > Date.now() && o.utcMs > lastNotifiedShardUtcMs);
    if (next) break;
    // この発生日の3回をすべて消化済み → 次の発生日へ
    currentShardHit = S.findNextBlackShardAfter(currentShardHit.year, currentShardHit.month, currentShardHit.day);
  }
  if (!currentShardHit || !next) return;
  const hit = currentShardHit;
  let delay = next.utcMs - LEAD_MS - Date.now();
  if (delay < 0) delay = Math.max(0, next.utcMs - Date.now()); // すでに間近ならその時刻に鳴らす
  if (delay > MAX_WAIT_MS) { shardTimerId = setTimeout(scheduleShard, MAX_WAIT_MS); return; }
  shardTimerId = setTimeout(() => {
    lastNotifiedShardUtcMs = next.utcMs;
    try {
      new Notification(t('notify.shardTitle'), {
        body: t('notify.shardBody', { realm: displayAreaName(CURRENT_LANG, hit.realm), time: formatOccurrence(next) }),
        icon: 'icons/app-icon-192.png',
        tag: 'sky-black-shard',
      });
    } catch (e) { console.error('Shard notification error:', e); }
    scheduleShard(); // 次回発生分を続けて予約
  }, delay);
}

function scheduleDailyReset() {
  clearDailyTimer();
  if (!isDailyResetNotifyEnabled() || !permissionGranted()) return;
  const resetMs = S.nextDailyResetUtcMs();
  let delay = resetMs - LEAD_MS - Date.now();
  if (delay < 0) delay = Math.max(0, resetMs - Date.now());
  if (delay > MAX_WAIT_MS) { dailyTimerId = setTimeout(scheduleDailyReset, MAX_WAIT_MS); return; }
  dailyTimerId = setTimeout(() => {
    try {
      new Notification(t('notify.dailyResetTitle'), {
        body: t('notify.dailyResetBody'),
        icon: 'icons/app-icon-192.png',
        tag: 'sky-daily-reset',
      });
    } catch (e) { console.error('Daily reset notification error:', e); }
    // 次のリセットを予約（直後は「次のリセット」が翌日に切り替わるまで少し待つ）
    dailyTimerId = setTimeout(scheduleDailyReset, 60 * 1000);
  }, delay);
}

// 起動時／ツールを開いた時に呼ぶ。オン＋許可済みなら予約を始める。
// オンのまま許可が失われていた場合は、元実装と同じくオフに戻す。
export function startIfEnabled() {
  if (isShardNotifyEnabled()) {
    if (permissionGranted()) { if (!shardTimerId) scheduleShard(); } else lsSet(S.SHARD_NOTIFY_KEY, '0');
  }
  if (isDailyResetNotifyEnabled()) {
    if (permissionGranted()) { if (!dailyTimerId) scheduleDailyReset(); } else lsSet(S.DAILYRESET_NOTIFY_KEY, '0');
  }
}

// トグル操作。{ enabled, status } を返す（statusは画面に出す案内文。許可されなかった場合はenabled:false）
export async function setShardNotify(on) {
  if (on) {
    const perm = await requestPermission();
    if (perm !== 'granted') {
      lsSet(S.SHARD_NOTIFY_KEY, '0');
      return { enabled: false, status: perm === 'unsupported' ? t('refine.shardNotifyUnsupported') : t('refine.shardNotifyDenied') };
    }
    lsSet(S.SHARD_NOTIFY_KEY, '1');
    scheduleShard();
    return { enabled: true, status: t('refine.shardNotifyOnHint') };
  }
  lsSet(S.SHARD_NOTIFY_KEY, '0');
  clearShardTimer();
  // 次回オンにした時は「今日以降」の予測から探し直す（オフの間の追跡状態を持ち越さない）
  currentShardHit = null;
  lastNotifiedShardUtcMs = 0;
  return { enabled: false, status: '' };
}

export async function setDailyResetNotify(on) {
  if (on) {
    const perm = await requestPermission();
    if (perm !== 'granted') {
      lsSet(S.DAILYRESET_NOTIFY_KEY, '0');
      return { enabled: false, status: perm === 'unsupported' ? t('refine.dailyResetNotifyUnsupported') : t('refine.dailyResetNotifyDenied') };
    }
    lsSet(S.DAILYRESET_NOTIFY_KEY, '1');
    scheduleDailyReset();
    return { enabled: true, status: t('refine.dailyResetNotifyOnHint') };
  }
  lsSet(S.DAILYRESET_NOTIFY_KEY, '0');
  clearDailyTimer();
  return { enabled: false, status: '' };
}

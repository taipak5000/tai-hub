/* ================================================================
   nomacan-pro-extras.js — ノマキャン計算機プロの追加カード3枚
   （「Skyキャンドル効率計算機（試作2）」の計算方式・機能を参考にしたもの）

   1. 時間が決まっているイベント … ウニ焼き・パン焼き・ウミガメの次回の開始時刻（日本時間）と残り時間
   2. 効率の内訳 … 選んだエリアを並び順に足していき、エリアごとに「増えた本数」と
      「本/時（そのエリアを足して増えた本数 ÷ かかった時間）」を出す。
      精錬は後半ほど1本に必要な火種が増えるため、後ろのエリアほど本/時が下がる
   3. 実測ストップウォッチ … サブエリアを選んで時間を測り、保存するとそのサブエリアの所要時間を置き換える

   作り方は nomacan-pro-top.js と同じ: カードの骨組みは1回だけ描き、数値や表の中身だけを差し替える
   （ストップウォッチは動いている間に描き直すと表示が止まるため）。
   ── 呼び出し側(nomacan-pro-view.js)との取り決め ──
   ctx.get()  … { areas, carryOverPercent, carryOverGap, dailyBonusArea, dailyShard, timeMult }
   ctx.onAreasChanged() … サブエリアの所要時間を書き換えた後に呼ぶ（保存・再描画）
   ctx.showToast(msg, type)
   ================================================================ */
import { CURRENT_LANG } from '../../js/i18n.js';
import { ptParts, ptToReal } from '../../js/pacific-time.js';
import { t } from './data/i18n-nomacan-pro.js';
import { displayAreaName as displayAreaNameRaw } from './data/area-names-en.js';
import * as S from './nomacan-pro-state.js';

let ctx = null;
let timedEl = null;
let effEl = null;
let swEl = null;
let timedTimer = null;
let swTimer = null;
let swStartedAt = 0;   // 動いている間の開始時刻（performance.now）
let swAccum = 0;       // 止めるまでに積み上げたミリ秒
let swSubId = '';

const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const areaName = (ja) => displayAreaNameRaw(CURRENT_LANG, ja);

function fmtSec(sec) {
  const v = Math.max(0, Math.round(Number(sec) || 0));
  if (v >= 3600) { // 1時間以上は「時間・分」で（秒まで出すと長くて折り返すため）
    const h = Math.floor(v / 3600); const mm = Math.round((v % 3600) / 60);
    return CURRENT_LANG === 'en' ? `${h}h ${mm}m` : `${h}時間${mm}分`;
  }
  const m = Math.floor(v / 60); const r = v % 60;
  if (CURRENT_LANG === 'en') return m ? `${m}m${r ? ` ${r}s` : ''}` : `${r}s`;
  return m ? `${m}分${r ? `${r}秒` : ''}` : `${r}秒`;
}

/* ================================================================
   1. 時間が決まっているイベント
   太平洋時間の偶数時ちょうどから数えた分（ダッシュボードと同じ）。日本時間では、夏時間中は偶数時、
   標準時（11月第1日曜〜3月第2日曜）は奇数時になる。sub はエリア管理の同じサブエリア名
   ================================================================ */
const TIMED_EVENTS = [
  { key: 'geyser', minute: 5, durationMin: 10, sub: '間欠泉（ウニ）', ja: 'ウニ焼き（草原・間欠泉）', en: 'Geyser (Prairie)' },
  { key: 'bread', minute: 35, durationMin: 10, sub: '先祖の食楽（パン）', ja: 'パン焼き（雨林・晴れ間）', en: 'Grandma\'s bread (Forest)' },
  { key: 'turtle', minute: 50, durationMin: 10, sub: 'ウミガメの軌跡（パンと上限共有）', ja: 'ウミガメ（草原・楽園の夕日）', en: 'Sanctuary turtle (Prairie)' },
];
// 今開催中ならその回、そうでなければ次の回の開始時刻（実時刻のms）
function eventStartFor(ev, nowMs) {
  const p = ptParts(nowMs);
  const baseHour = p.hour - (p.hour % 2);
  for (let k = -1; k <= 2; k++) {
    const start = ptToReal(p.year, p.month, p.day, baseHour + k * 2, ev.minute, 0).getTime();
    if (start + ev.durationMin * 60000 > nowMs) return start;
  }
  return ptToReal(p.year, p.month, p.day, baseHour + 6, ev.minute, 0).getTime();
}
const jstFmt = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function findSubByName(name) {
  for (const a of (ctx.get().areas || [])) for (const s of (a.subAreas || [])) if (s && s.name === name) return s;
  return null;
}
function renderTimed() {
  if (!timedEl) return;
  const now = Date.now();
  const rows = TIMED_EVENTS.map((ev) => {
    const start = eventStartFor(ev, now);
    const live = start <= now;
    const mins = live ? Math.ceil((start + ev.durationMin * 60000 - now) / 60000) : Math.ceil((start - now) / 60000);
    const sub = findSubByName(ev.sub);
    const light = sub ? S.subTotalLight(sub) : 0;
    const picked = sub && S.subHasSelection(sub);
    const status = live
      ? `<span class="nmp-tm-live">${esc(t('extras.timedLive', { n: mins }))}</span>`
      : `<span class="nmp-tm-next">${esc(jstFmt.format(new Date(start)))}</span><span class="nmp-tm-left">${esc(t('extras.timedLeft', { n: mins }))}</span>`;
    return `<div class="nmp-tm-row ${live ? 'is-live' : ''}">
      <div class="nmp-tm-name">${esc(CURRENT_LANG === 'en' ? ev.en : ev.ja)}${picked ? `<span class="nmp-at-tag">${esc(t('extras.inRoute'))}</span>` : ''}
        <div class="nmp-tm-sub">${light ? `${esc(t('extras.timedLight', { n: light }))} · ` : ''}${esc(t('extras.timedEvery', { m: String(ev.minute).padStart(2, '0') }))}</div></div>
      <div class="nmp-tm-when">${status}</div>
    </div>`;
  }).join('');
  timedEl.innerHTML = `${rows}<p class="nmp-tm-note">${esc(t('extras.timedNote'))}</p>`;
}

/* ================================================================
   2. 効率の内訳（並び順に足していく）
   ================================================================ */
export function renderEfficiency() {
  if (!effEl || !ctx) return;
  const v = ctx.get();
  const base = S.baseLightFor(v);
  const T = S.THRESHOLDS;
  const candlesOf = (light) => { let n = 0; while (n < T.length && light >= T[n]) n++; return n; };
  let light = base.total;
  let time = 0;
  const startCandles = candlesOf(light);
  const rows = [];
  (v.areas || []).forEach((area) => {
    const st = S.getMainAreaStats(area);
    if (st.light <= 0 && st.time <= 0) return;
    const before = candlesOf(light);
    light += st.light; time += st.time;
    const after = candlesOf(light);
    const gained = after - before;
    rows.push({ name: areaName(area.name), light: st.light, time: st.time, cum: after, gained, perHour: st.time > 0 ? gained / st.time * 3600 : 0, perMin: st.time > 0 ? st.light / st.time * 60 : 0 });
  });
  if (rows.length === 0) {
    effEl.innerHTML = `<p class="nmp-ef-empty">${esc(t('extras.effEmpty'))}</p>`;
    return;
  }
  const total = candlesOf(light);
  const overall = time > 0 ? (total - startCandles) / time * 3600 : 0;
  const body = rows.map((r) => {
    const low = r.time > 0 && overall > 0 && r.perHour < overall * 0.5;
    return `<tr class="${low ? 'is-low' : ''}">
      <td class="nmp-ef-name">${esc(r.name)}</td>
      <td class="num">${esc(fmtSec(r.time))}</td>
      <td class="num">${r.light}<br><small>${r.perMin.toFixed(0)}${esc(t('area.perMinUnit'))}</small></td>
      <td class="num">${r.gained > 0 ? `+${r.gained}` : '0'}<br><small>${esc(t('extras.effCum', { n: r.cum }))}</small></td>
      <td class="num nmp-ef-ph">${r.time > 0 ? r.perHour.toFixed(1) : '–'}</td>
    </tr>`;
  }).join('');
  const next = total < T.length ? T[total] - light : 0;
  effEl.innerHTML = `
    <div class="nmp-ef-stats">
      <div><b>${total}</b><span>${esc(t('extras.effCandles'))}</span></div>
      <div><b>${esc(fmtSec(time))}</b><span>${esc(t('extras.effTime'))}</span></div>
      <div><b>${overall > 0 ? overall.toFixed(1) : '–'}</b><span>${esc(t('extras.effPerHour'))}</span></div>
      <div><b>${total > startCandles && time > 0 ? esc(fmtSec(time / (total - startCandles))) : '–'}</b><span>${esc(t('extras.effPerCandle'))}</span></div>
    </div>
    ${base.total > 0 ? `<p class="nmp-ef-note">${esc(t('extras.effBase', { n: base.total, c: startCandles }))}</p>` : ''}
    <div class="nmp-ef-tablewrap"><table class="nmp-ef-table">
      <thead><tr><th>${esc(t('extras.effColArea'))}</th><th class="num">${esc(t('extras.effColTime'))}</th><th class="num">${esc(t('extras.effColLight'))}</th><th class="num">${esc(t('extras.effColGained'))}</th><th class="num">${esc(t('extras.effColPerHour'))}</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>
    <p class="nmp-ef-note">${esc(next > 0 ? t('extras.effNext', { k: total + 1, n: next }) : t('extras.effCap'))}</p>
    <p class="nmp-ef-note">${esc(t('extras.effHelp'))}</p>`;
}

/* ================================================================
   3. 実測ストップウォッチ
   ================================================================ */
function swElapsedMs() { return swAccum + (swTimer ? performance.now() - swStartedAt : 0); }
function swRenderTime() {
  const disp = swEl && swEl.querySelector('#nmpSwDisp');
  if (!disp) return;
  const ms = swElapsedMs();
  const m = Math.floor(ms / 60000); const s = Math.floor((ms % 60000) / 1000); const d = Math.floor((ms % 1000) / 100);
  disp.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${d}`;
}
function swSetRunning(running) {
  const start = swEl.querySelector('[data-sw="start"]');
  const stop = swEl.querySelector('[data-sw="stop"]');
  if (start) start.disabled = running;
  if (stop) stop.disabled = !running;
  swEl.classList.toggle('is-running', running);
}
function findSub(id) {
  for (const a of (ctx.get().areas || [])) for (const s of (a.subAreas || [])) if (s && s.id === id) return s;
  return null;
}
// サブエリアの選択肢（エリアの構成が変わった時だけ作り直す。選んでいたものは残す）
export function refreshStopwatchOptions() {
  const sel = swEl && swEl.querySelector('#nmpSwSub');
  if (!sel || !ctx) return;
  const areas = ctx.get().areas || [];
  sel.innerHTML = areas.filter((a) => (a.subAreas || []).length).map((a) => `<optgroup label="${esc(areaName(a.name))}">${a.subAreas.map((s) => `<option value="${esc(s.id)}">${esc(areaName(s.name))}（${esc(fmtSec(s.time))}${s.measured ? `・${esc(t('extras.swMeasured'))}` : ''}）</option>`).join('')}</optgroup>`).join('');
  if (swSubId && findSub(swSubId)) sel.value = swSubId; else swSubId = sel.value;
  updateSwInfo();
}
function updateSwInfo() {
  const info = swEl && swEl.querySelector('#nmpSwInfo');
  const resetBtn = swEl && swEl.querySelector('[data-sw="restore"]');
  const sub = findSub(swSubId);
  if (info) info.textContent = sub ? t('extras.swCurrent', { time: fmtSec(sub.time), mark: sub.measured ? t('extras.swMeasured') : t('extras.swPreset') }) : '';
  if (resetBtn) resetBtn.disabled = !(sub && sub.measured);
}
function onSwClick(e) {
  const btn = e.target.closest('[data-sw]');
  if (!btn || btn.disabled) return;
  const act = btn.dataset.sw;
  if (act === 'start') {
    if (swTimer) return;
    swStartedAt = performance.now();
    swTimer = setInterval(swRenderTime, 100);
    swSetRunning(true);
  } else if (act === 'stop') {
    if (!swTimer) return;
    swAccum += performance.now() - swStartedAt;
    clearInterval(swTimer); swTimer = null;
    swSetRunning(false); swRenderTime();
  } else if (act === 'reset') {
    clearInterval(swTimer); swTimer = null; swAccum = 0;
    swSetRunning(false); swRenderTime();
  } else if (act === 'save') {
    const sub = findSub(swSubId);
    const sec = Math.round(swElapsedMs() / 1000);
    if (!sub || sec < 1) { ctx.showToast(t('extras.swTooShort'), 'error'); return; }
    sub.time = sec;
    sub.measured = true;
    clearInterval(swTimer); swTimer = null; swAccum = 0;
    swSetRunning(false); swRenderTime();
    ctx.onAreasChanged();
    ctx.showToast(t('extras.swSaved', { name: areaName(sub.name), time: fmtSec(sec) }), 'success');
  } else if (act === 'restore') {
    const sub = findSub(swSubId);
    if (!sub || !sub.measured) return;
    const mult = Number(ctx.get().timeMult) || 1;
    sub.time = Math.round((Number(sub._baseTime) || 0) * mult);
    delete sub.measured;
    ctx.onAreasChanged();
    ctx.showToast(t('extras.swRestored', { name: areaName(sub.name), time: fmtSec(sub.time) }), 'success');
  }
}
function onSwChange(e) {
  if (e.target.id !== 'nmpSwSub') return;
  swSubId = e.target.value;
  updateSwInfo();
}

/* ================================================================
   組み立て・後片付け
   ================================================================ */
export function mountExtras(timedBody, effBody, swBody, context) {
  ctx = context;
  timedEl = timedBody; effEl = effBody; swEl = swBody;
  if (swEl) {
    swEl.innerHTML = `
      <label class="nmp-sw-label" for="nmpSwSub">${esc(t('extras.swTarget'))}</label>
      <select id="nmpSwSub" class="nmp-sw-select"></select>
      <div class="nmp-sw-info" id="nmpSwInfo"></div>
      <div class="nmp-sw-disp" id="nmpSwDisp" aria-live="off">00:00.0</div>
      <div class="nmp-sw-btns">
        <button type="button" class="nmp-btn nmp-btn-blue" data-sw="start">${esc(t('extras.swStart'))}</button>
        <button type="button" class="nmp-btn nmp-btn-outline" data-sw="stop" disabled>${esc(t('extras.swStop'))}</button>
        <button type="button" class="nmp-btn nmp-btn-outline" data-sw="reset">${esc(t('extras.swReset'))}</button>
      </div>
      <button type="button" class="nmp-btn nmp-btn-orange nmp-btn-block" data-sw="save">${esc(t('extras.swSave'))}</button>
      <button type="button" class="nmp-btn-outline-blue nmp-btn-block nmp-sw-restore" data-sw="restore" disabled>${esc(t('extras.swRestore'))}</button>
      <p class="nmp-tm-note">${esc(t('extras.swNote'))}</p>`;
    swEl.addEventListener('click', onSwClick);
    swEl.addEventListener('change', onSwChange);
    refreshStopwatchOptions();
  }
  renderTimed();
  renderEfficiency();
  timedTimer = setInterval(renderTimed, 30000);
}
export function unmountExtras() {
  clearInterval(timedTimer); timedTimer = null;
  clearInterval(swTimer); swTimer = null; swAccum = 0;
  if (swEl) { swEl.removeEventListener('click', onSwClick); swEl.removeEventListener('change', onSwChange); }
  ctx = null; timedEl = null; effEl = null; swEl = null;
}

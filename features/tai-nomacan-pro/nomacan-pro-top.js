/* ================================================================
   nomacan-pro-top.js — 「今日の精錬状況」「キャンドル管理」の2枚のカード

   tai-nomacan.pro/index.html のテンプレート(今日の精錬状況・キャンドル管理)と、
   その計算（totalLight / calculated / projectedCandles / 日別内訳 / dailyReset /
   黒シャードの自動判定）をそのまま移植したもの。

   ── 作り方（重要） ───────────────────────────────────────────
   カードのHTMLは最初に1回だけ描き、以後は数値・ゲージ・内訳の「中身だけ」を
   update()で差し替える。入力欄をinnerHTMLごと描き直すと、1文字打つたびに
   フォーカスが外れて複数桁が入力できなくなるため（旧ハブ版の不具合）。
   イベントは各カードのルート要素への委譲で、windowのグローバル関数は使わない。

   ── 呼び出し側(nomacan-pro-view.js)との取り決め ───────────────
   ctx.get()          … 現在値 { areas, carryOverPercent, carryOverGap, dailyBonusArea,
                          dailyShard, currentCandles, plannedUsage, heartsToSend,
                          targetDate, candleMemo } を返す
   ctx.set(patch)     … 値を反映して保存（所持キャンドルは共有通貨へも書く）
   ctx.onAreasChanged() … 選択状態(areas)を書き換えた後に呼ばれる（エリア一覧の再描画）
   ctx.showToast(msg, type)
   ctx.requestResetData() … 「入力数値をリセット」確認モーダルを開く
   ================================================================ */
import { CURRENT_LANG } from '../../js/i18n.js';
import { t } from './data/i18n-nomacan-pro.js';
import { displayAreaName as displayAreaNameRaw } from './data/area-names-en.js';
import * as S from './nomacan-pro-state.js';
import * as N from './nomacan-pro-notify.js';

const CANDLE_PROJECTION_MAX_DAYS = 60;
const SHARD_PREDICTION_COUNT = 3;
const SHARD_JP_WEEKDAY = ['日', '月', '火', '水', '木', '金', '土'];

let ctx = null;
let refineEl = null;
let candleEl = null;
let showBreakdown = false;
let draggingGauge = false;
let shardStatusText = '';
let dailyStatusText = '';

function esc(str) { return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function displayAreaName(ja) { return displayAreaNameRaw(CURRENT_LANG, ja); }
const q = (root, sel) => root.querySelector(sel);

// 桁区切り付きの表示用フォーマッタ（極端に大きい値が指数表記にならないようにする）
function fmtCandles(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n);
  return num.toLocaleString(CURRENT_LANG === 'en' ? 'en-US' : 'ja-JP', { maximumFractionDigits: 2 });
}
function fmtMinSec(totalSeconds) {
  return t('time.minSec', { m: Math.floor(totalSeconds / 60), s: Math.floor(totalSeconds % 60) });
}
function formatShardOccurrence(occ) {
  let dayLabel;
  if (occ.dayDiff === 0) dayLabel = t('date.today');
  else if (occ.dayDiff === 1) dayLabel = t('date.tomorrow');
  else dayLabel = `${occ.month}/${occ.day}(${SHARD_JP_WEEKDAY[occ.weekday]})`;
  return `${dayLabel} ${occ.hour}:${String(occ.minute).padStart(2, '0')}`;
}

/* ================================================================
   計算（元実装のcomputedと同じ式）
   ================================================================ */
function calcCandles(total) {
  const T = S.THRESHOLDS;
  let candles = 0;
  for (let i = 0; i < T.length; i++) {
    if (total >= T[i]) candles = i + 1;
    else return { candles, nextReq: T[i] - total };
  }
  return { candles, nextReq: 0 };
}

function eventDaysFor(targetDate) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate); target.setHours(0, 0, 0, 0);
  if (isNaN(target.getTime())) return 0; // 日付未入力/削除時はInvalid Date
  return Math.max(0, Math.ceil((target - today) / 86400000));
}

function compute(v) {
  let selectedLight = 0, totalSeconds = 0;
  (v.areas || []).forEach((a) => {
    const st = S.getMainAreaStats(a);
    selectedLight += st.light;
    totalSeconds += st.time;
  });
  const carryOverLight = v.carryOverGap * (v.carryOverPercent / 100);
  const bonusLight = (Number(v.dailyBonusArea) || 0) * 50 + (v.dailyShard === 'black' ? 200 : 0);
  const totalLight = selectedLight + Math.floor(carryOverLight) + bonusLight;
  const calc = calcCandles(totalLight);
  const eventDays = eventDaysFor(v.targetDate);
  const dailyHeartCost = (v.heartsToSend || 0) * 3;
  const projected = v.currentCandles + calc.candles * eventDays - v.plannedUsage - dailyHeartCost * eventDays;
  return {
    selectedLight, totalSeconds, carryOverLight, bonusLight, totalLight, calc, eventDays, dailyHeartCost, projected,
    efficiency: totalSeconds > 0 ? selectedLight / totalSeconds : 0,
  };
}

// 「今のスポット構成を毎日そのまま周回し、毎日同じ数のハートを送る」前提の日別累計
// （使用予定数は日付を持たないので最終日にまとめて反映 → 最終日の累計は projected と一致する）
function projectionDaily(v, c) {
  const days = c.eventDays;
  if (days <= 0) return [];
  const dailyDelta = c.calc.candles - c.dailyHeartCost;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const shown = Math.min(days, CANDLE_PROJECTION_MAX_DAYS);
  let fmt = null;
  try { fmt = new Intl.DateTimeFormat(CURRENT_LANG === 'en' ? 'en-US' : 'ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' }); } catch (e) { /* noop */ }
  const rows = [];
  for (let d = 1; d <= shown; d++) {
    const date = new Date(today); date.setDate(date.getDate() + d);
    const total = v.currentCandles + dailyDelta * d - (d === days ? v.plannedUsage : 0);
    rows.push({ day: d, dateLabel: fmt ? fmt.format(date) : `${date.getMonth() + 1}/${date.getDate()}`, total });
  }
  return rows;
}

/* ================================================================
   「今日の精錬状況」カード
   ================================================================ */
function refineHtml(v) {
  const hit = S.predictUpcomingBlackShard(SHARD_PREDICTION_COUNT);
  return `
    <div class="nmp-box">
      <div class="nmp-box-row" style="flex-wrap:nowrap;">
        <span class="nmp-box-label" style="font-weight:500;">${esc(t('refine.dailyBonusLabel'))}</span>
        <select id="nmpDailyBonus" style="width:130px; padding:4px 6px; font-size:12px;">
          ${[0, 1, 2, 3, 4].map((n) => `<option value="${n}" ${v.dailyBonusArea === n ? 'selected' : ''}>${esc(t(n === 0 ? 'refine.dailyBonusNone' : `refine.dailyBonus${n}`))}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="nmp-box" style="padding:14px;">
      <div class="nmp-box-row">
        <span class="nmp-box-label nmp-box-label-lg">${esc(t('refine.shardLabel'))}</span>
        <label class="nmp-check-lg">
          <input type="checkbox" id="nmpShardCheck" ${v.dailyShard === 'black' ? 'checked' : ''}>
          <span id="nmpShardText"></span>
        </label>
      </div>
      ${hit ? `
      <div class="nmp-box-sep">
        <div class="nmp-box-row">
          <span class="nmp-dim">${esc(t('refine.shardPredictionLabel', { realm: displayAreaName(hit.realm) }))}</span>
          <button type="button" class="nmp-link-btn" id="nmpShardSync">${esc(t('refine.syncPrediction'))}</button>
        </div>
        <div class="nmp-shard-times">${hit.occurrences.map((occ) => `<span class="nmp-shard-time-chip">${esc(formatShardOccurrence(occ))}</span>`).join('')}</div>
        <div class="nmp-hint" style="padding-bottom:0;">${esc(t('refine.receiveOnceNote'))}</div>
        <div class="nmp-box-sep">
          <label class="nmp-check-sm"><input type="checkbox" id="nmpShardNotify" ${N.isShardNotifyEnabled() ? 'checked' : ''}> ${esc(t('refine.shardNotifyLabel'))}</label>
          <div class="nmp-hint" id="nmpShardNotifyStatus" style="padding-bottom:0;"></div>
        </div>
      </div>` : ''}
    </div>

    <div class="nmp-row"><div>${esc(t('refine.expectedCandles'))}</div><div class="nmp-bold" style="color:var(--npb-orange);"><span id="nmpExpCandles">0</span> <span class="nmp-unit">${esc(t('refine.candlesUnit'))}</span></div></div>
    <div class="nmp-row"><div>${esc(t('refine.totalLight'))}</div><div id="nmpTotalLight">0</div></div>
    <div class="nmp-row"><div>${esc(t('refine.totalEfficiency'))}</div><div class="nmp-bold" style="color:var(--npb-blue);"><span id="nmpTotalEff">0.00</span> <span style="font-size:12px; font-weight:normal; color:var(--npb-text-2);">/s</span></div></div>
    <div class="nmp-row"><div>${esc(t('refine.totalTime'))}</div><div class="nmp-bold" style="color:var(--npb-blue);" id="nmpTotalTime"></div></div>
    <div class="nmp-row" id="nmpNextRow"><div>${esc(t('refine.nextThreshold'))}</div><div style="color:var(--npb-text-2);" id="nmpNextReq">0</div></div>
    <button type="button" class="nmp-btn nmp-btn-blue nmp-btn-block" id="nmpDailyResetBtn">${esc(t('refine.dailyResetBtn'))}</button>

    <div class="nmp-box-sep" style="margin-top:12px;">
      <label class="nmp-check-sm"><input type="checkbox" id="nmpDailyNotify" ${N.isDailyResetNotifyEnabled() ? 'checked' : ''}> ${esc(t('refine.dailyResetNotifyLabel'))}</label>
      <div class="nmp-hint" id="nmpDailyNotifyStatus" style="padding-bottom:0;"></div>
    </div>`;
}

/* ================================================================
   「キャンドル管理」カード
   ================================================================ */
function candleHtml(v) {
  return `
    <div class="nmp-carry">
      <div style="display:flex; justify-content:space-between; width:100%;"><div>${esc(t('candle.carryOver'))}</div><div id="nmpCarryPct">0%</div></div>
      <div class="nmp-carry-gauge" id="nmpCarryGauge" role="slider" tabindex="0" aria-label="${esc(t('candle.carryGaugeAria'))}" aria-valuemin="0" aria-valuemax="99">
        <div class="nmp-carry-track-wrap">
          <div class="nmp-carry-track"><div class="nmp-carry-fill" id="nmpCarryFill"></div></div>
          <div class="nmp-carry-knob" id="nmpCarryKnob"></div>
        </div>
        <div class="nmp-carry-candle">
          <svg viewBox="0 0 120 150" style="width:100%; height:auto; display:block;">
            <defs>
              <mask id="nmpCarryCandleMask">
                <rect x="48" y="8" width="24" height="30" rx="12" fill="white"/>
                <rect x="12" y="32" width="96" height="108" rx="28" fill="white"/>
                <path d="M60,100 C60,100 44,89.6 44,80.8 C44,75.1 48.6,72 53.1,72 C56.6,72 60,75.1 60,75.1 C60,75.1 63.4,72 66.9,72 C71.4,72 76,75.1 76,80.8 C76,89.6 60,100 60,100 Z" fill="black"/>
              </mask>
              <clipPath id="nmpCarryCandleFillClip"><rect id="nmpCarryClipRect" x="0" y="150" width="120" height="0"/></clipPath>
            </defs>
            <rect x="0" y="0" width="120" height="150" fill="#8e8e93" mask="url(#nmpCarryCandleMask)"/>
            <g clip-path="url(#nmpCarryCandleFillClip)"><rect x="0" y="0" width="120" height="150" fill="#F5EEDB" mask="url(#nmpCarryCandleMask)"/></g>
          </svg>
        </div>
      </div>
      <div style="font-size:11px; color:var(--npb-text-2); margin-top:6px;">${esc(t('candle.slideHint'))}</div>
    </div>

    <div class="nmp-candle-owned-box">
      <div class="nmp-box-row" style="gap:10px; font-size:16px;">
        <span class="nmp-box-label" style="font-weight:700; gap:8px;"><span class="nmp-icon-chip"><svg class="inline-icon" width="16" height="16"><use href="#i-candle"/></svg></span> ${esc(t('candle.currentCandles'))}</span>
        <span style="display:flex; align-items:baseline; gap:8px;">
          <input type="number" id="nmpCurrentCandles" min="0" value="${esc(v.currentCandles)}">
          <span class="nmp-dim" id="nmpCurrentFmt"></span>
        </span>
      </div>
      <div class="nmp-hint" style="display:flex; align-items:flex-start; gap:5px; margin-top:8px; padding:0;"><svg class="inline-icon" width="12" height="12" style="flex-shrink:0; margin-top:2px;"><use href="#i-sync"/></svg><span>${esc(t('candle.currentCandlesSyncNote'))}</span></div>
    </div>

    <div class="nmp-row"><div>${esc(t('candle.plannedUsage'))}</div><input type="number" id="nmpPlanned" value="${esc(v.plannedUsage)}"></div>
    <div class="nmp-row" style="align-items:flex-start; flex-wrap:wrap;">
      <div style="white-space:nowrap;">${esc(t('candle.dailyHearts'))}</div>
      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
        <input type="number" id="nmpHearts" min="0" style="width:70px;" value="${esc(v.heartsToSend)}">
        <span class="nmp-dim" id="nmpHeartInfo"></span>
      </div>
    </div>
    <div class="nmp-row"><div>${esc(t('candle.eventEndDate'))}</div><input type="date" id="nmpTargetDate" value="${esc(v.targetDate)}" style="width:140px; text-align:left;"></div>
    <div class="nmp-row"><div>${esc(t('candle.remainingDays'))}</div><div style="font-weight:bold;"><span id="nmpEventDays">0</span> <span style="font-weight:normal; font-size:0.8em; color:var(--npb-text-2);">${esc(t('candle.remainingDaysUnit'))}</span></div></div>
    <div class="nmp-row"><div>${esc(t('candle.projectedRemaining'))}</div><div class="nmp-bold"><span id="nmpProjected">0</span> <span class="nmp-unit">${esc(t('refine.candlesUnit'))}</span></div></div>

    <div id="nmpBreakdownWrap" style="margin:-2px 0 10px;">
      <button type="button" class="nmp-link-btn" id="nmpBreakdownToggle"></button>
      <div id="nmpBreakdown" style="display:none;"></div>
    </div>

    <div class="nmp-row" style="flex-direction:column; align-items:flex-start; border-bottom:none; padding-bottom:0; margin-top:10px;">
      <div style="font-size:12px; color:var(--npb-text-2); margin-bottom:6px;">${esc(t('candle.memoLabel'))}</div>
      <textarea class="nmp-memo" id="nmpMemo" placeholder="${esc(t('candle.memoPlaceholder'))}">${esc(v.candleMemo)}</textarea>
    </div>
    <button type="button" class="nmp-btn-outline-red nmp-btn-block" id="nmpResetDataBtn" style="margin-top:12px;">${esc(t('settings.resetInputBtn'))}</button>`;
}

/* ================================================================
   値の反映（入力欄は触らず、表示だけ更新する）
   ================================================================ */
export function update() {
  if (!ctx || !refineEl || !candleEl) return;
  const v = ctx.get();
  const c = compute(v);
  const setText = (root, sel, text) => { const el = q(root, sel); if (el && el.textContent !== text) el.textContent = text; };

  // 今日の精錬状況
  setText(refineEl, '#nmpShardText', v.dailyShard === 'black' ? t('refine.shardYes') : t('refine.shardNo'));
  const shardText = q(refineEl, '#nmpShardText');
  if (shardText) shardText.style.color = v.dailyShard === 'black' ? 'var(--npb-green)' : 'var(--npb-text-2)';
  const shardCheck = q(refineEl, '#nmpShardCheck');
  if (shardCheck) shardCheck.checked = v.dailyShard === 'black';
  const bonusSel = q(refineEl, '#nmpDailyBonus');
  if (bonusSel && Number(bonusSel.value) !== v.dailyBonusArea) bonusSel.value = String(v.dailyBonusArea);
  setText(refineEl, '#nmpExpCandles', String(c.calc.candles));
  setText(refineEl, '#nmpTotalLight', String(c.totalLight));
  setText(refineEl, '#nmpTotalEff', c.efficiency.toFixed(2));
  setText(refineEl, '#nmpTotalTime', fmtMinSec(c.totalSeconds));
  const nextRow = q(refineEl, '#nmpNextRow');
  if (nextRow) nextRow.style.display = c.calc.candles < S.THRESHOLDS.length ? '' : 'none';
  setText(refineEl, '#nmpNextReq', String(c.calc.nextReq));
  setText(refineEl, '#nmpShardNotifyStatus', shardStatusText);
  setText(refineEl, '#nmpDailyNotifyStatus', dailyStatusText);

  // キャンドル管理
  const pct = Math.min(99, Math.max(0, v.carryOverPercent));
  const fill = (pct / 99) * 100;
  setText(candleEl, '#nmpCarryPct', `${Math.floor(v.carryOverPercent)}%`);
  const gauge = q(candleEl, '#nmpCarryGauge');
  if (gauge) gauge.setAttribute('aria-valuenow', String(Math.floor(v.carryOverPercent)));
  const fillEl = q(candleEl, '#nmpCarryFill'); if (fillEl) fillEl.style.height = `${fill}%`;
  const knob = q(candleEl, '#nmpCarryKnob');
  if (knob) {
    knob.style.bottom = `calc(${fill}% - 10px)`;
    knob.style.boxShadow = draggingGauge ? '0 0 0 5px rgba(0,122,255,0.25)' : '0 1px 3px rgba(0,0,0,0.3)';
  }
  const clip = q(candleEl, '#nmpCarryClipRect');
  if (clip) { clip.setAttribute('y', String(150 - (fill / 100) * 150)); clip.setAttribute('height', String((fill / 100) * 150)); }

  setText(candleEl, '#nmpCurrentFmt', v.currentCandles >= 1000 ? `(${fmtCandles(v.currentCandles)})` : '');
  const heartInfo = q(candleEl, '#nmpHeartInfo');
  if (heartInfo) {
    heartInfo.innerHTML = v.heartsToSend > 0
      ? `${esc(t('candle.perDayCost'))} <b style="color:var(--npb-orange);">-${esc(fmtCandles(c.dailyHeartCost))} <span class="nmp-dim">${esc(t('refine.candlesUnit'))}</span></b>`
        + (c.eventDays > 0 ? ` ${esc(t('candle.overDaysCost', { days: c.eventDays }))} <b style="color:var(--npb-red);">-${esc(fmtCandles(c.dailyHeartCost * c.eventDays))} <span class="nmp-dim">${esc(t('refine.candlesUnit'))}</span></b>` : '')
      : '';
  }
  setText(candleEl, '#nmpEventDays', String(c.eventDays));
  const projected = q(candleEl, '#nmpProjected');
  if (projected) { projected.textContent = fmtCandles(c.projected); projected.style.color = c.projected >= 0 ? '' : 'var(--npb-red)'; }

  // 日別内訳
  const wrap = q(candleEl, '#nmpBreakdownWrap');
  if (wrap) wrap.style.display = c.eventDays > 0 ? '' : 'none';
  const toggle = q(candleEl, '#nmpBreakdownToggle');
  if (toggle) toggle.textContent = showBreakdown ? t('candle.dailyBreakdownHide') : t('candle.dailyBreakdownShow');
  const bd = q(candleEl, '#nmpBreakdown');
  if (bd) {
    bd.style.display = (showBreakdown && c.eventDays > 0) ? '' : 'none';
    if (showBreakdown && c.eventDays > 0) {
      const rows = projectionDaily(v, c);
      const firstNeg = rows.find((r) => r.total < 0);
      bd.innerHTML = `
        ${firstNeg ? `<div class="nmp-alert-error">${esc(t('candle.dailyBreakdownNegativeWarning', { date: firstNeg.dateLabel }))}</div>` : ''}
        <div class="nmp-breakdown-list">${rows.map((r) => `
          <div class="nmp-breakdown-row ${r.total < 0 ? 'neg' : ''}">
            <span class="nmp-dim">${esc(t('candle.dailyBreakdownDayLabel', { n: r.day }))} ${esc(r.dateLabel)}</span>
            <b>${esc(fmtCandles(r.total))} <span class="nmp-dim">${esc(t('refine.candlesUnit'))}</span></b>
          </div>`).join('')}</div>
        <div class="nmp-hint" style="margin-top:8px;">${esc(t('candle.dailyBreakdownAssumptionNote'))}</div>
        ${c.eventDays > CANDLE_PROJECTION_MAX_DAYS ? `<div class="nmp-hint">${esc(t('candle.dailyBreakdownTruncatedNote', { days: CANDLE_PROJECTION_MAX_DAYS }))}</div>` : ''}`;
    }
  }
}

// 入力欄の値を外部の変更（他タブ・共有通貨の同期）に合わせる。入力中の欄は触らない
export function syncInputs() {
  if (!ctx || !candleEl) return;
  const v = ctx.get();
  const set = (sel, val) => {
    const el = q(candleEl, sel);
    if (el && document.activeElement !== el && String(el.value) !== String(val)) el.value = String(val);
  };
  set('#nmpCurrentCandles', v.currentCandles);
  set('#nmpPlanned', v.plannedUsage);
  set('#nmpHearts', v.heartsToSend);
  set('#nmpTargetDate', v.targetDate);
  set('#nmpMemo', v.candleMemo);
  const bonusSel = q(refineEl, '#nmpDailyBonus'); if (bonusSel) bonusSel.value = String(v.dailyBonusArea);
}

/* ================================================================
   操作
   ================================================================ */
// 「予測に合わせる」: 今日(PT)の黒シャード有無を反映する。force=falseは1日1回だけ（手動変更を尊重）
export function syncDailyShardWithPrediction(force) {
  const key = S.pacificDateKey();
  let last = null;
  try { last = localStorage.getItem(S.SHARD_SYNC_DATE_KEY); } catch (e) { /* noop */ }
  if (!force && last === key) return;
  ctx.set({ dailyShard: S.isBlackShardToday() ? 'black' : 'none' });
  try { localStorage.setItem(S.SHARD_SYNC_DATE_KEY, key); } catch (e) { /* noop */ }
}

function dailyReset() {
  const v = ctx.get();
  const c = compute(v);
  let leftoverPercent = 0;
  let gap = 94; // しきい値の段差は一定でないため、%算出に使った段差を保持して繰越時に再利用する
  if (c.calc.candles < S.THRESHOLDS.length) {
    const base = c.calc.candles === 0 ? 0 : S.THRESHOLDS[c.calc.candles - 1];
    gap = S.THRESHOLDS[c.calc.candles] - base;
    leftoverPercent = (c.totalLight - base) / gap;
  }
  S.clearAllSelections(v.areas);
  ctx.set({
    currentCandles: v.currentCandles + c.calc.candles,
    carryOverPercent: Math.min(99, Math.max(0, leftoverPercent * 100)),
    carryOverGap: gap,
    dailyBonusArea: 0,
  });
  syncDailyShardWithPrediction(true);
  ctx.onAreasChanged();
  syncInputs();
  update();
}

export function runOptimize(targetCandles) {
  const v = ctx.get();
  const target = Math.max(1, Math.min(Math.round(targetCandles) || 1, S.THRESHOLDS.length));
  const bonusLight = (Number(v.dailyBonusArea) || 0) * 50 + (v.dailyShard === 'black' ? 200 : 0);
  const targetLightNeeded = S.THRESHOLDS[target - 1] - v.carryOverGap * (v.carryOverPercent / 100) - bonusLight;
  S.optimize(v.areas, targetLightNeeded);
  ctx.onAreasChanged();
  update();
}

function updateCarryFromPointer(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  const ratio = 1 - Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
  ctx.set({ carryOverPercent: Math.round(ratio * 99) });
  update();
}

function wire() {
  // ── 今日の精錬状況 ──
  refineEl.addEventListener('change', async (e) => {
    const id = e.target.id;
    if (id === 'nmpDailyBonus') { ctx.set({ dailyBonusArea: S.normalizeDailyBonus(e.target.value) }); update(); }
    else if (id === 'nmpShardCheck') { ctx.set({ dailyShard: e.target.checked ? 'black' : 'none' }); update(); }
    else if (id === 'nmpShardNotify') {
      const res = await N.setShardNotify(e.target.checked);
      e.target.checked = res.enabled; shardStatusText = res.status; update();
    } else if (id === 'nmpDailyNotify') {
      const res = await N.setDailyResetNotify(e.target.checked);
      e.target.checked = res.enabled; dailyStatusText = res.status; update();
    }
  });
  refineEl.addEventListener('click', (e) => {
    if (e.target.closest('#nmpShardSync')) { syncDailyShardWithPrediction(true); update(); }
    else if (e.target.closest('#nmpDailyResetBtn')) dailyReset();
  });

  // ── キャンドル管理 ──
  candleEl.addEventListener('input', (e) => {
    const id = e.target.id;
    const num = (min) => Math.max(min, Number(e.target.value) || 0);
    if (id === 'nmpCurrentCandles') ctx.set({ currentCandles: num(0) });
    else if (id === 'nmpPlanned') ctx.set({ plannedUsage: Number(e.target.value) || 0 });
    else if (id === 'nmpHearts') ctx.set({ heartsToSend: num(0) });
    else if (id === 'nmpTargetDate') ctx.set({ targetDate: e.target.value });
    else if (id === 'nmpMemo') ctx.set({ candleMemo: e.target.value });
    else return;
    update();
  });
  candleEl.addEventListener('click', (e) => {
    if (e.target.closest('#nmpBreakdownToggle')) { showBreakdown = !showBreakdown; update(); }
    else if (e.target.closest('#nmpResetDataBtn')) ctx.requestResetData();
  });

  // 繰越ゲージ（キャンドル型・縦スライド）: ドラッグ＋矢印キー
  const gauge = q(candleEl, '#nmpCarryGauge');
  gauge.addEventListener('pointerdown', (e) => {
    draggingGauge = true;
    if (gauge.setPointerCapture) { try { gauge.setPointerCapture(e.pointerId); } catch (err) { /* noop */ } }
    if (e.cancelable) e.preventDefault();
    updateCarryFromPointer(e);
  });
  gauge.addEventListener('pointermove', (e) => {
    if (!draggingGauge) return;
    if (e.cancelable) e.preventDefault();
    updateCarryFromPointer(e);
  });
  const endDrag = () => { draggingGauge = false; update(); };
  gauge.addEventListener('pointerup', endDrag);
  gauge.addEventListener('pointercancel', endDrag);
  gauge.addEventListener('keydown', (e) => {
    const cur = Math.round(ctx.get().carryOverPercent);
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { ctx.set({ carryOverPercent: Math.min(99, cur + 1) }); update(); e.preventDefault(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { ctx.set({ carryOverPercent: Math.max(0, cur - 1) }); update(); e.preventDefault(); }
  });
}

/* ================================================================
   マウント／アンマウント
   ================================================================ */
export function mountTop(refineBody, candleBody, context) {
  ctx = context;
  refineEl = refineBody;
  candleEl = candleBody;
  showBreakdown = false;
  draggingGauge = false;
  shardStatusText = '';
  dailyStatusText = '';
  const v = ctx.get();
  refineEl.innerHTML = refineHtml(v);
  candleEl.innerHTML = candleHtml(v);
  wire();
  syncDailyShardWithPrediction(false); // 1日1回だけ、今日の黒シャード有無に自動で合わせる
  N.startIfEnabled();
  update();
}

export function unmountTop() {
  ctx = null; refineEl = null; candleEl = null;
}

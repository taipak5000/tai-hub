/* ================================================================
   star-candle-view.js — 星のキャンドル計算機のtai-hub移植版。公開面は
   mount(container)/unmount() の2関数のみ（js/router.js からマウントされる）。

   移植元: star-candle/index.html（~7300行のスタンドアロンページ）のうち、
   共有chrome（site-dock/pf-modal/dash-modal/tools-drawer/サイドバー・
   nsKey/nsKeyFor等）を除いた「このツール自身」の部分：
   目標カード・週の集め方カード(羽スライダー＋赤闇7日間予測は
   star-candle-forecast.jsに委譲)・週の消費カード(リサイズドリンク)・
   結果カード(キャンドルゲージ)・称号カード・通知カード・カスタム
   日付ピッカー・トースト通知・星の瞬く背景演出。

   赤闇の自動予測エンジン＋月表示カレンダーモーダル＋獲得履歴ログ
   （取り消し可能な一覧＋推移グラフ）＋「1年前の今日」バナーは
   star-candle-forecast.js に分離し、ctx（コールバック束）経由で
   このファイルの状態(目標/所持本数/羽/リサイズドリンク設定のDOM値・
   保存・称号の恒久チェックインログ)とやり取りする（詳細は
   star-candle-forecast.js冒頭のコメント参照）。

   【意図的な簡略化・アダプテーション】
   - ヘッダーの言語切替ボタン・「🔄 最新の状態に更新」ボタンは移植して
     いない。前者はtai-hubの表示設定モーダル（ドックの「表示設定」→
     言語）に既に同機能があり、後者は主にService Worker由来のキャッシュ
     固定を回避するための専用ボタンだったが、tai-hubはツールごとの
     Service Worker自体を持たないため意味を持たない
     （他の移植済みツールと同じ扱い）。
   - プロフィールモーダルの「所持通貨」編集パネル(.pf-currency-section等)は
     tai-hub側のjs/chrome/pf-modal.jsが既に持っている（starCandleフィールド
     込み）。このツールが読み書きする共有通貨キー(wishOwnCurrency.starCandle等、
     nsKey経由)は元の実装と完全互換の形で読み書きしており、プロフィール
     モーダル側の編集と自動的に連動する。
   - 通知カード(Notification API)は実装した。着地10分前/達成予定日前日の
     通知は、実際にNotification.requestPermission()を呼ぶ「オプトイン」
     方式を含め元の挙動のまま移植している（チェックをONにした操作
     そのものを起点にのみ許可を要求し、ページ読み込み時の不意打ち要求は
     しない）。通知アイコン画像(icons/app-icon-192.png)はtai-hubに
     このツール用のアイコン資産が無いため指定していない(ブラウザの
     既定アイコンで表示される、実害のない省略)。
   - 称号の🔥アイコン(streak_7)は共有アイコンスプライト(js/icon-sprite.js、
     編集しない)に無いため、このファイルが自前で追加するローカル
     スプライト(プレフィックス sc-i-)の#sc-i-flameを使う
     （data/titles.js参照）。
   ================================================================ */
import { nsKey } from '../../js/state.js';
import { CURRENT_LANG } from '../../js/i18n.js';
import { t } from './data/i18n-star-candle.js';
import { TITLES } from './data/titles.js';
import { fmt, jpDate, weekdayLabel, monthYearLabel, formatDateValue } from './date-utils.js';
import * as Forecast from './star-candle-forecast.js';

// 元のI18N辞書のうち、header/footer等「呼び出し箇所が少ない自前文言」向けの
// 素朴なt(ja,en)パターン(js/chrome/*.jsと同じ流儀)。この2件以外は全てdata/
// i18n-star-candle.jsのキー付き辞書t(key,vars)を使う。
function tt(ja, en) { return CURRENT_LANG === 'en' ? en : ja; }

const STYLE_LINK_ID = 'star-candle-view-styles';
const ICON_SPRITE_ID = 'star-candle-icon-sprite';
const RESIZE_DRINK_COST = 8; // リサイズドリンク: 週1回・星のキャンドル8本で購入
const NOTIFY_SHARD_LEAD_MS = 10 * 60 * 1000;      // 着地10分前
const NOTIFY_GOAL_LEAD_MS = 24 * 60 * 60 * 1000;  // 前日

let containerEl = null;
let refreshDateTrigger = () => {}; // 目標日ボタンの表示を値に合わせ直す（wireDatePicker()が差し替える）
let els = {};
let mountToken = 0;

// 保存キー(mount毎に、その時点のアクティブプロフィールに合わせて張り直す)
let STORAGE_KEY = '';
let TITLE_MAX_CANDLE_KEY = '';
let TITLE_CHECKIN_LOG_KEY = '';
let TITLE_STREAK_BEST_KEY = '';
let TITLES_STORE_KEY = '';
let NOTIFY_SHARD_ENABLED_KEY = '';
let NOTIFY_GOAL_ENABLED_KEY = '';
let NOTIFY_SHARD_LAST_KEY = '';
let NOTIFY_GOAL_LAST_KEY = '';

let datePickerViewDate = new Date();
let currentEditStartValue = null;
let notifyCheckIntervalId = null;
let onVisibilityChangeNotify = null;
let onDocumentClickCloseDatePicker = null;

let toastQueue = [];
let toastShowing = false;
let toastTimer = null;

/* ================================================================
   公開API
   ================================================================ */
export function mount(container) {
  const myToken = ++mountToken;
  injectStylesheet();
  injectLocalIconSprite();

  containerEl = container;

  STORAGE_KEY = nsKey('skyStarCandleCalc_v1');
  TITLE_MAX_CANDLE_KEY = nsKey('skyStarCandleCalc_maxCandle_v1');
  TITLE_CHECKIN_LOG_KEY = nsKey('skyStarCandleCalc_checkinLog_v1');
  TITLE_STREAK_BEST_KEY = nsKey('skyStarCandleCalc_streakBest_v1');
  TITLES_STORE_KEY = nsKey('skyStarCandleCalc_titles_v1');
  NOTIFY_SHARD_ENABLED_KEY = nsKey('skyStarCandleNotifyShardOn_v1');
  NOTIFY_GOAL_ENABLED_KEY = nsKey('skyStarCandleNotifyGoalOn_v1');
  NOTIFY_SHARD_LAST_KEY = nsKey('skyStarCandleNotifyShardLast_v1');
  NOTIFY_GOAL_LAST_KEY = nsKey('skyStarCandleNotifyGoalLast_v1');

  container.innerHTML = renderShell();
  cacheEls();
  renderStarField();
  wireEvents();

  loadState();
  refreshDateTrigger(); // 目標日の表示はloadState()より前に作られるので、読み込んだ値で作り直す
  update();

  const ctx = {
    getCurrent: () => Math.max(0, parseFloat(els.current.value) || 0),
    setCurrent: (n) => { els.current.value = n; },
    getTarget: () => Math.max(0, parseFloat(els.target.value) || 0),
    getFeathers: () => Math.max(0, Math.min(63, parseInt(els.feathers.value, 10) || 0)),
    getBuyDrink: () => els.buyDrink.checked,
    update,
    saveState,
    syncCurrentToSharedCurrency,
    recordShardCheckin,
  };
  Forecast.mount(container, ctx);
  if (myToken !== mountToken) return;

  // 赤闇予測欄・獲得履歴が揃った状態で、結果カードの試算(達成予定日・実績ペース)を
  // 正しく反映させるため、ここでもう一度だけ計算し直す(元実装の二段階update()呼び出しと同じ理由)。
  update();

  checkAndUnlockTitles();
  notifyInitToggles();
  notifyCheck();
  notifyCheckIntervalId = setInterval(notifyCheck, 60 * 1000);
  onVisibilityChangeNotify = () => { if (document.visibilityState === 'visible') notifyCheck(); };
  document.addEventListener('visibilitychange', onVisibilityChangeNotify);
}

export function unmount() {
  mountToken++;
  Forecast.unmount();

  if (notifyCheckIntervalId) { clearInterval(notifyCheckIntervalId); notifyCheckIntervalId = null; }
  if (onVisibilityChangeNotify) { document.removeEventListener('visibilitychange', onVisibilityChangeNotify); onVisibilityChangeNotify = null; }
  if (onDocumentClickCloseDatePicker) { document.removeEventListener('click', onDocumentClickCloseDatePicker); onDocumentClickCloseDatePicker = null; }
  clearTimeout(toastTimer);
  toastQueue = [];
  toastShowing = false;

  containerEl = null;
  els = {};
}

/* ================================================================
   スタイルシート・追加アイコンスプライトの注入（初回のみ）
   ================================================================ */
function injectStylesheet() {
  if (document.getElementById(STYLE_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_LINK_ID;
  link.rel = 'stylesheet';
  link.href = new URL('../../css/star-candle.css', import.meta.url).href;
  document.head.appendChild(link);
}
// tai-hub共有の#pf-icon-sprite(js/icon-sprite.js)にはこのツールでしか使わない
// アイコン(flame)が含まれないため、衝突しない専用プレフィックス(sc-i-*)で
// 1個だけ追加のスプライトを自前で持つ(共有ファイルは編集しない)。
// 中身は元のstar-candle/index.html自身のスプライト定義そのまま。
const SC_SPRITE_HTML = `<svg id="${ICON_SPRITE_ID}" style="position:absolute;width:0;height:0;overflow:hidden;" aria-hidden="true"><defs>
<symbol id="sc-i-flame" viewBox="0 0 24 24"><path d="M12 21c4 0 6-3 6-6.5 0-2-1-3.5-2-5 0 2-1.5 3-2.5 2C14 9 13 6 10 4c1 3-1 5-2.5 7-1 1.3-1.5 2.5-1.5 3.5C6 18 8 21 12 21Z"/></symbol>
</defs></svg>`;
function injectLocalIconSprite() {
  if (document.getElementById(ICON_SPRITE_ID)) return;
  document.body.insertAdjacentHTML('afterbegin', SC_SPRITE_HTML);
}

/* ================================================================
   マークアップ（外枠）
   ================================================================ */
function renderShell() {
  return `
    <div class="star-candle-view">
      <div class="sc-star-field" id="scStarField"></div>
      <div class="sc-wrap">
        <header class="sc-page-head">
          <div class="sc-title-icon" aria-hidden="true"></div>
          <h1>${tt('星のキャンドル計算機', 'Star Candle Calculator')}</h1>
          <p class="sc-subtitle">${tt('Sky 星を紡ぐ子どもたち・目標本数まであと何週間？', 'Sky: Children of the Light — how many weeks until your goal?')}</p>
        </header>

        <div class="sc-one-year-ago-banner" id="scOneYearAgoBanner">
          <span class="sc-one-year-ago-icon" aria-hidden="true"><svg class="inline-icon" width="18" height="18"><use href="#i-sparkle"/></svg></span>
          <span class="sc-one-year-ago-text" id="scOneYearAgoText"></span>
          <button type="button" class="sc-one-year-ago-close" id="scOneYearAgoCloseBtn" aria-label="${t('oneYearAgo.closeAriaLabel')}"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
        </div>

        <section class="sc-card">
          <h2>${t('goal.heading')}</h2>
          <div class="sc-field">
            <label for="scTarget">${t('goal.targetLabel')}</label>
            <div class="sc-input-suffix">
              <input type="number" id="scTarget" inputmode="decimal" min="0" max="99999" step="any" placeholder="${t('goal.targetPlaceholder')}">
              <span class="sc-unit">${t('goal.unit')}</span>
            </div>
          </div>
          <div class="sc-field">
            <label for="scCurrent">${t('goal.currentLabel')}</label>
            <div class="sc-input-suffix">
              <input type="number" id="scCurrent" inputmode="decimal" min="0" step="any" placeholder="${t('goal.currentPlaceholder')}">
              <span class="sc-unit">${t('goal.unit')}</span>
            </div>
          </div>
          <div class="sc-field">
            <label for="scTargetDateTrigger">${t('goal.targetDateLabel')}</label>
            <div class="sc-date-picker" id="scDatePicker">
              <button type="button" class="sc-date-picker-trigger" id="scTargetDateTrigger" aria-haspopup="true" aria-expanded="false">
                <span id="scTargetDateTriggerText">${t('goal.dateSelectPlaceholder')}</span>
                <span class="sc-date-picker-icon" aria-hidden="true"><svg class="inline-icon" width="14" height="14"><use href="#i-calendar"/></svg></span>
              </button>
              <div class="sc-date-picker-popup" id="scDatePickerPopup">
                <div class="sc-date-picker-header">
                  <button type="button" class="sc-date-picker-nav" id="scDatePickerPrev" aria-label="${t('goal.prevMonth')}">‹</button>
                  <span class="sc-date-picker-month" id="scDatePickerMonthLabel"></span>
                  <button type="button" class="sc-date-picker-nav" id="scDatePickerNext" aria-label="${t('goal.nextMonth')}">›</button>
                </div>
                <div class="sc-date-picker-weekdays" id="scDatePickerWeekdays"></div>
                <div class="sc-date-picker-grid" id="scDatePickerGrid"></div>
                <button type="button" class="sc-date-picker-clear" id="scDatePickerClear">${t('goal.clearSelection')}</button>
              </div>
            </div>
            <input type="date" id="scTargetDate" style="display:none" tabindex="-1" aria-hidden="true">
          </div>
        </section>

        <section class="sc-card">
          <h2>${t('weekly.heading')}</h2>
          <div class="sc-field">
            <div class="sc-slider-row">
              <label for="scFeathers">${t('weekly.featherLabel')}</label>
              <span class="sc-slider-readout" id="scFeathersReadout"></span>
            </div>
            <input type="range" id="scFeathers" min="0" max="63" step="1" value="63">
            <button type="button" class="sc-add-current-btn" id="scAddFeathersBtn"></button>
            <p class="sc-feather-unadded-note" id="scFeatherUnaddedNote" style="display:none;"></p>
          </div>

          <hr class="sc-divider">

          <div class="sc-sub-head">
            <span class="sc-shard-icon" aria-hidden="true"></span>
            <span>${t('weekly.shardSubHead')}</span>
          </div>
          <div class="sc-predict-box">
            <div class="sc-predict-head">
              <span class="sc-predict-title">${t('weekly.predictTitle')}</span>
              <span class="sc-predict-range" id="scPredictRange"></span>
            </div>
            <label class="sc-predict-filter">
              <input type="checkbox" id="scPredictFilterHigh">
              <span>${t('forecast.filterHighOnly')}</span>
            </label>
            <div class="sc-predict-list" id="scPredictList"></div>
            <div class="sc-predict-summary">
              <span class="sc-predict-count">${t('weekly.predictCountPrefix')}<strong id="scPredictDays">0</strong><span>${t('weekly.predictCountSuffix')}</span></span>
            </div>
            <button type="button" class="sc-shard-cal-btn" id="scShardCalBtn">${t('weekly.calendarBtn')}</button>
            <p class="sc-note">${t('weekly.note')}</p>
          </div>
        </section>

        <section class="sc-card">
          <h2>${t('consumption.heading')}</h2>
          <div class="sc-field">
            <div class="sc-toggle-field">
              <div class="sc-toggle-text">
                <span class="sc-toggle-title">${t('consumption.toggleTitle')}</span>
                <span class="sc-toggle-sub">${t('consumption.toggleSub')}</span>
              </div>
              <label class="sc-switch">
                <input type="checkbox" id="scBuyDrink">
                <span class="sc-switch-track"><span class="sc-switch-thumb"></span></span>
              </label>
            </div>
          </div>
        </section>

        <section class="sc-card sc-result-card">
          <h2 style="justify-content:center;">${t('result.heading')}</h2>
          <div class="sc-gauge-wrap">
            <div class="sc-candle">
              <span class="sc-spark" aria-hidden="true"></span>
              <span class="sc-spark" aria-hidden="true"></span>
              <span class="sc-spark" aria-hidden="true"></span>
              <div class="sc-flame" aria-hidden="true"></div>
              <div class="sc-wick" aria-hidden="true"></div>
              <div class="sc-candle-body"><div class="sc-candle-fill" id="scCandleFill"></div></div>
            </div>
          </div>
          <div id="scResultContent"></div>
        </section>

        <section class="sc-card" id="scTitlesCard">
          <div class="sc-titles-head">
            <h2>${t('titles.heading')}</h2>
            <span class="sc-titles-count" id="scTitlesCount">0 / ${TITLES.length}</span>
          </div>
          <div class="sc-titles-chips" id="scTitlesChips"></div>
        </section>

        <section class="sc-card">
          <h2>${t('notify.heading')}</h2>
          <div class="sc-field">
            <div class="sc-toggle-field">
              <div class="sc-toggle-text">
                <span class="sc-toggle-title">${t('notify.shardTitle')}</span>
                <span class="sc-toggle-sub">${t('notify.shardSub')}</span>
              </div>
              <label class="sc-switch">
                <input type="checkbox" id="scNotifyShardToggle">
                <span class="sc-switch-track"><span class="sc-switch-thumb"></span></span>
              </label>
            </div>
          </div>
          <div class="sc-field">
            <div class="sc-toggle-field">
              <div class="sc-toggle-text">
                <span class="sc-toggle-title">${t('notify.goalTitle')}</span>
                <span class="sc-toggle-sub">${t('notify.goalSub')}</span>
              </div>
              <label class="sc-switch">
                <input type="checkbox" id="scNotifyGoalToggle">
                <span class="sc-switch-track"><span class="sc-switch-thumb"></span></span>
              </label>
            </div>
          </div>
          <p class="sc-note" id="scNotifyStatus"></p>
          <p class="sc-note">${t('notify.note')}</p>
        </section>

        <section class="sc-card">
          <h2>${t('history.heading')}</h2>
          <div class="sc-trend-chart-wrap" id="scTrendChartWrap"></div>
          <div class="sc-history-list" id="scHistoryList"></div>
          <div class="sc-history-footer">
            <p class="sc-note">${t('history.note')}</p>
            <button type="button" class="sc-history-clear-btn" id="scHistoryClearBtn">${t('history.clearBtn')}</button>
          </div>
        </section>

        <footer>
          <span>${tt('このサイトはSky 星を紡ぐ子どもたちの非公式ファンサイトです。thatgamecompanyは一切関与していません。', 'This is an unofficial fan site for Sky: Children of the Light. thatgamecompany is not involved in any way.')}</span><br>
          <span>${tt('作成・ご意見:', 'Created by / feedback:')}</span> <a href="https://x.com/Skyzztai" target="_blank" rel="noopener noreferrer">@Skyzztai</a>　<span>${tt('参考データ:', 'Reference data:')}</span> <a href="https://sky-children-of-the-light.fandom.com/ja/wiki/%E7%A0%B4%E7%89%87%E3%81%AE%E5%99%B4%E5%87%BA" target="_blank" rel="noopener noreferrer">${tt('破片の噴出 (Sky Wiki 日本語)', 'Shard Eruptions (Sky Wiki, Japanese)')}</a><br>
          <a href="#/tai-info">${tt('設定・クレジット・プライバシーポリシー', 'Settings / Credits / Privacy Policy')}</a>
        </footer>
      </div>
    </div>
  `;
}

function cacheEls() {
  const q = (id) => containerEl.querySelector('#' + id);
  els = {
    target: q('scTarget'),
    current: q('scCurrent'),
    targetDate: q('scTargetDate'),
    feathers: q('scFeathers'),
    feathersReadout: q('scFeathersReadout'),
    addFeathersBtn: q('scAddFeathersBtn'),
    buyDrink: q('scBuyDrink'),
    candleFill: q('scCandleFill'),
    resultContent: q('scResultContent'),
  };
}

function renderStarField() {
  const field = containerEl.querySelector('#scStarField');
  if (!field) return;
  const STAR_COUNT = 46;
  let html = '';
  for (let i = 0; i < STAR_COUNT; i++) {
    const left = (Math.random() * 100).toFixed(2);
    const top = (Math.random() * 100).toFixed(2);
    const size = (Math.random() * 1.6 + 1).toFixed(1);
    const dur = (2.5 + Math.random() * 3.5).toFixed(1);
    const delay = (Math.random() * 4).toFixed(1);
    html += `<span class="sc-star" style="left:${left}%; top:${top}%; width:${size}px; height:${size}px; animation-duration:${dur}s; animation-delay:${delay}s;"></span>`;
  }
  field.innerHTML = html;
}

/* ================================================================
   状態の保存/読み込み(skyStarCandleCalc_v1)＋共有所持通貨キーとの同期
   ================================================================ */
function saveState() {
  try {
    const state = {
      target: els.target.value,
      current: els.current.value,
      targetDate: els.targetDate.value,
      feathers: els.feathers.value,
      buyDrink: els.buyDrink.checked,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) { /* storage unavailable - ignore */ }
  // 所持本数が変わるたびに呼ばれるこの場所で、称号(実績)のハイウォーターマーク更新・
  // 解禁判定もまとめて行う。
  checkAndUnlockTitles();
}
function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const state = raw ? JSON.parse(raw) : null;
    if (state) {
      if (state.target !== undefined) els.target.value = state.target;
      if (state.current !== undefined) els.current.value = state.current;
      if (state.targetDate !== undefined) els.targetDate.value = state.targetDate;
      if (state.feathers !== undefined) els.feathers.value = state.feathers;
      if (state.buyDrink !== undefined) els.buyDrink.checked = !!state.buyDrink;
    }
  } catch (err) { /* no saved data, corrupted data, or storage unavailable - ignore */ }
  // 所持本数(current)はプロフィール共通の所持星のキャンドル数(wishOwnCurrency.starCandle)と
  // 同一の値として扱われる。他サイト/他機能での更新がこのツールの秘密鍵(STORAGE_KEY)を
  // 経由せずに反映されている場合があるため、読み込み時は必ずこちらを正として上書きする。
  try {
    els.current.value = loadSharedCurrentCandle();
  } catch (err) { /* no-op */ }
}

// 星のキャンドルの共有所持数キー。プロフィールモーダルの通貨編集・他サイト
// (item/emote/wings等)からの更新も同じキーに書き込まれる(nsKey経由で
// プロフィール単位に名前空間化される点も含め、元実装のpfLoadCurrency/
// pfSaveCurrencyFieldと完全互換)。
function loadSharedCurrentCandle() {
  let wish, extra;
  try { wish = JSON.parse(localStorage.getItem(nsKey('wishOwnCurrency'))) || {}; } catch (e) { wish = {}; }
  try { extra = JSON.parse(localStorage.getItem(nsKey('skyCurrencyExtra_v1'))) || {}; } catch (e) { extra = {}; }
  // 星のキャンドルは以前 skyCurrencyExtra_v1.ascendedCandle で別管理していたが、
  // ウィッシュリストの所持星キャンドル(wishOwnCurrency.starCandle)と二重管理に
  // なっていたため統一されている。既存データがあれば一度だけ引き継ぐ。
  if (wish.starCandle === undefined && extra.ascendedCandle) {
    wish.starCandle = extra.ascendedCandle;
    try { localStorage.setItem(nsKey('wishOwnCurrency'), JSON.stringify(wish)); } catch (e) { /* no-op */ }
  }
  return wish.starCandle || 0;
}
// 所持本数をプロフィール共通の所持星のキャンドル数へ書き戻す。アイテム所持管理など
// 他機能の「所持通貨」表示にも同じ値が反映されるようにするため。ページ読み込み時
// (loadState直後)では呼ばない=他機能で先に更新された値を開いただけで上書きしない。
// ユーザーが実際に本数を動かした時だけ同期する。
function syncCurrentToSharedCurrency() {
  const key = nsKey('wishOwnCurrency');
  let wish;
  try { wish = JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { wish = {}; }
  wish.starCandle = Math.max(0, Number(els.current.value) || 0);
  try { localStorage.setItem(key, JSON.stringify(wish)); } catch (e) { /* no-op */ }
}

/* ================================================================
   結果カード：達成までの週数・達成予定日の計算と描画
   ================================================================ */
function update() {
  const target = Math.max(0, parseFloat(els.target.value) || 0);
  const current = Math.max(0, parseFloat(els.current.value) || 0);
  const feathers = Math.max(0, Math.min(63, parseInt(els.feathers.value, 10) || 0));
  const buyDrink = els.buyDrink.checked;

  const edenWeekly = feathers * 0.25;
  const drinkWeekly = buyDrink ? RESIZE_DRINK_COST : 0;
  const totalWeekly = edenWeekly - drinkWeekly;

  const sliderPct = (feathers / 63) * 100;
  els.feathers.style.setProperty('--fill', sliderPct + '%');
  els.feathersReadout.textContent = t('weekly.readout', { n: feathers, amount: fmt(edenWeekly) });
  els.addFeathersBtn.textContent = t('weekly.addBtn', { amount: fmt(edenWeekly) });
  els.addFeathersBtn.disabled = edenWeekly <= 0;
  try { Forecast.renderFeatherUnaddedNote(); } catch (err) { /* no-op */ }

  const progressPct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  els.candleFill.style.height = progressPct + '%';

  const remaining = target - current;
  let html = '';
  let actualPaceInline = '';
  try {
    const recentDailyPace = Forecast.computeRecentDailyPace();
    if (recentDailyPace !== null) actualPaceInline = t('result.actualPaceInline', { pace: fmt(recentDailyPace * 7) });
  } catch (err) { /* no-op */ }
  const weeklyLine = t('result.weeklyLine', { weekly: fmt(totalWeekly) }) +
    (drinkWeekly > 0 ? t('result.weeklyLineDetail', { feathers: fmt(edenWeekly), drink: fmt(drinkWeekly) }) : '') +
    actualPaceInline;

  // 目標日(任意)からの逆算:期日までに必要な週ペースを計算して表示用HTMLを組み立てる。
  // この必要ペースは、期日までに届く予定の赤闇報酬を先に差し引いてから算出する。
  let targetDateInfo = '';
  if (els.targetDate.value && remaining > 0) {
    const targetDateObj = new Date(els.targetDate.value + 'T23:59:59');
    if (!isNaN(targetDateObj.getTime())) {
      const msUntilTarget = targetDateObj.getTime() - new Date().getTime();
      if (msUntilTarget > 0) {
        const weeksUntilTarget = msUntilTarget / (7 * 86400000);
        let expectedShardByTarget = 0;
        try { expectedShardByTarget = Forecast.sumExpectedShardRewards(new Date(), targetDateObj); } catch (e) { /* no-op */ }
        const remainingAfterShards = Math.max(0, remaining - expectedShardByTarget);
        const requiredWeeklyPace = remainingAfterShards / weeksUntilTarget;
        const isOnPace = remainingAfterShards <= 0 || totalWeekly >= requiredWeeklyPace;
        const paceNeededLine = remainingAfterShards <= 0
          ? t('result.paceCoveredByShards', { date: jpDate(targetDateObj) })
          : t('result.paceNeededBy', { date: jpDate(targetDateObj), pace: fmt(requiredWeeklyPace) });
        targetDateInfo = '<div class="sc-target-date-box">' +
          paceNeededLine + '<br>' +
          `<span class="${isOnPace ? 'sc-pace-ok' : 'sc-pace-warn'}">` +
          (isOnPace ? t('result.paceOk') : t('result.paceWarn', { n: fmt(requiredWeeklyPace - totalWeekly) })) +
          '</span>' +
          `<div class="sc-pace-note">${t('result.paceShardNote')}</div>` +
          '</div>';
      }
    }
  }

  // 赤闇をすべて回収すると仮定した場合の達成予定日。
  let shardEstimateInfo = '';
  if (remaining > 0) {
    try {
      const shardResult = Forecast.estimateGoalDateAllShards(current, target, totalWeekly);
      if (shardResult) {
        shardEstimateInfo = `<div class="sc-shard-estimate-box">${t('result.shardEstimate', { date: jpDate(shardResult.date) })}</div>`;
      }
    } catch (err) { /* no-op */ }
  }

  if (target <= 0) {
    html = `<p class="sc-state-message">${t('result.enterTarget')}</p>`;
  } else if (remaining <= 0) {
    html =
      `<p class="sc-state-message achieved">${t('result.achieved')}</p>` +
      `<p class="sc-breakdown">${t('result.achievedBreakdown', { current: fmt(current), target: fmt(target) })}</p>`;
  } else if (totalWeekly <= 0) {
    const warnMsg = drinkWeekly > 0 ? t('result.warnDrink') : t('result.warnZero');
    html =
      `<p class="sc-state-message warning">${warnMsg}</p>` +
      `<p class="sc-breakdown">${t('result.remainingBreakdown', { remaining: fmt(remaining), weeklyLine })}</p>` +
      targetDateInfo + shardEstimateInfo;
  } else {
    const weeksNeeded = Math.ceil(remaining / totalWeekly);
    const today = new Date();
    const estDate = new Date(today.getTime() + weeksNeeded * 7 * 86400000);
    // 目標本数が桁外れに大きいと、Date計算がミリ秒の有効範囲を超えてInvalid Dateになり得る。
    const estDateValid = !isNaN(estDate.getTime());
    const goalDateLineHtml = estDateValid ? t('result.goalDateLine', { date: jpDate(estDate) }) : t('result.goalDateTooFar');
    html =
      `<div class="sc-hero-stat">${t('result.heroPrefix')}${fmt(weeksNeeded)}<span class="sc-unit-small">${t('result.heroSuffix')}</span></div>` +
      `<p class="sc-stat-line">${goalDateLineHtml}</p>` +
      `<p class="sc-stat-line">${t('result.remainingLine', { remaining: fmt(remaining) })}</p>` +
      targetDateInfo + shardEstimateInfo +
      `<p class="sc-breakdown">${t('result.progressLine', { weeklyLine, pct: Math.round(progressPct) })}</p>` +
      `<p class="sc-note">${t('result.footnote')}</p>`;
  }

  els.resultContent.innerHTML = html;

  // 目標本数・現在本数の変更(=グラフの目標ラインや基準点)にも追従させるため、
  // 結果再計算のたびに推移グラフも再描画する。
  try { Forecast.renderTrendChart(); } catch (err) { /* no-op */ }
}

/* ================================================================
   イベント配線
   ================================================================ */
function wireEvents() {
  [els.target, els.targetDate, els.feathers, els.buyDrink].forEach((el) => {
    el.addEventListener('input', () => { update(); saveState(); });
  });
  els.current.addEventListener('input', () => {
    update();
    saveState();
    syncCurrentToSharedCurrency();
  });

  // 所持本数(current)を手動で直接編集した場合、羽ボタン・赤闇チェックと違って獲得履歴には
  // 何も記録されない。記録しないままだと推移グラフ・実績ペースがこの増減を把握できず古い
  // ままになってしまう。フォーカス時点の値を基準に、変更確定(change)のたびに差分を記録する。
  currentEditStartValue = null;
  els.current.addEventListener('focus', () => {
    currentEditStartValue = Math.max(0, parseFloat(els.current.value) || 0);
  });
  els.current.addEventListener('blur', () => { currentEditStartValue = null; });
  els.current.addEventListener('change', () => {
    const newVal = Math.max(0, parseFloat(els.current.value) || 0);
    const baseline = currentEditStartValue !== null ? currentEditStartValue : newVal;
    const delta = Math.round((newVal - baseline) * 100) / 100;
    currentEditStartValue = newVal;
    if (delta !== 0) Forecast.addHistoryEntry('manual', t('history.manualEntry'), delta, null);
  });

  // 「＋◯本を所持本数に加算」ボタン:羽スライダーの換算本数(枚数×0.25)を所持本数に
  // そのまま加算する。何度でも押せる(週をまたいで複数回押す想定)。
  els.addFeathersBtn.addEventListener('click', () => {
    const feathers = Math.max(0, Math.min(63, parseInt(els.feathers.value, 10) || 0));
    const edenWeekly = feathers * 0.25;
    if (edenWeekly <= 0) return;
    const current = Math.max(0, parseFloat(els.current.value) || 0);
    els.current.value = Math.round((current + edenWeekly) * 100) / 100;
    update();
    saveState();
    syncCurrentToSharedCurrency();
    Forecast.addHistoryEntry('feather', '羽 ' + feathers + '枚', edenWeekly, null);
  });

  wireDatePicker();

  const notifyShardToggleEl = containerEl.querySelector('#scNotifyShardToggle');
  const notifyGoalToggleEl = containerEl.querySelector('#scNotifyGoalToggle');
  notifyShardToggleEl.addEventListener('change', () => notifySetEnabled(NOTIFY_SHARD_ENABLED_KEY, notifyShardToggleEl, notifyShardToggleEl.checked));
  notifyGoalToggleEl.addEventListener('change', () => notifySetEnabled(NOTIFY_GOAL_ENABLED_KEY, notifyGoalToggleEl, notifyGoalToggleEl.checked));
}

/* ================================================================
   目標日:カスタムカレンダーピッカー
   ネイティブの<input type="date">はサイトのテーマに合わせて装飾できないため、
   値の保持だけをtargetDate(非表示)に任せ、見た目は独自のカレンダーUIで作る。
   ================================================================ */
function wireDatePicker() {
  const datePickerEl = containerEl.querySelector('#scDatePicker');
  const trigger = containerEl.querySelector('#scTargetDateTrigger');
  const triggerText = containerEl.querySelector('#scTargetDateTriggerText');
  const popup = containerEl.querySelector('#scDatePickerPopup');
  const grid = containerEl.querySelector('#scDatePickerGrid');
  const monthLabel = containerEl.querySelector('#scDatePickerMonthLabel');
  const prevBtn = containerEl.querySelector('#scDatePickerPrev');
  const nextBtn = containerEl.querySelector('#scDatePickerNext');
  const clearBtn = containerEl.querySelector('#scDatePickerClear');
  const weekdaysEl = containerEl.querySelector('#scDatePickerWeekdays');
  datePickerViewDate = new Date();
  datePickerViewDate.setDate(1);

  function renderWeekdayHeader() {
    weekdaysEl.innerHTML = Array.from({ length: 7 }, (_, i) => `<span>${weekdayLabel(i)}</span>`).join('');
  }

  function updateTriggerText() {
    if (els.targetDate.value) {
      const p = els.targetDate.value.split('-');
      const d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
      triggerText.textContent = jpDate(d);
      trigger.classList.add('has-value');
    } else {
      triggerText.textContent = t('goal.dateSelectPlaceholder');
      trigger.classList.remove('has-value');
    }
  }

  function renderGrid() {
    const year = datePickerViewDate.getFullYear();
    const month = datePickerViewDate.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = formatDateValue(new Date());
    const selectedStr = els.targetDate.value;

    renderWeekdayHeader();
    monthLabel.textContent = monthYearLabel(year, month + 1);

    let html = '';
    for (let i = 0; i < firstWeekday; i++) html += '<span class="sc-date-picker-cell is-empty"></span>';
    for (let d = 1; d <= daysInMonth; d++) {
      const cellStr = formatDateValue(new Date(year, month, d));
      const isPast = cellStr < todayStr;
      let cls = 'sc-date-picker-cell';
      if (cellStr === selectedStr) cls += ' is-selected';
      if (cellStr === todayStr) cls += ' is-today';
      if (isPast) cls += ' is-past';
      html += `<button type="button" class="${cls}" data-date="${cellStr}"${isPast ? ' disabled' : ''}>${d}</button>`;
    }
    grid.innerHTML = html;
  }

  function open() {
    const p = els.targetDate.value ? els.targetDate.value.split('-') : null;
    datePickerViewDate = p ? new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, 1) : new Date();
    datePickerViewDate.setDate(1);
    renderGrid();
    popup.classList.add('is-open');
    trigger.classList.add('is-active');
    trigger.setAttribute('aria-expanded', 'true');
    // .sc-cardはbackdrop-filterで独自のスタッキングコンテキストを作るため、
    // popup側のz-indexだけでは次のカードの裏に隠れてしまう。開いている間だけ
    // 親カードごと引き上げることで解決する。
    const cardEl = datePickerEl.closest('.sc-card');
    if (cardEl) cardEl.classList.add('has-open-popup');
  }
  function close() {
    popup.classList.remove('is-open');
    trigger.classList.remove('is-active');
    trigger.setAttribute('aria-expanded', 'false');
    const cardEl = datePickerEl.closest('.sc-card');
    if (cardEl) cardEl.classList.remove('has-open-popup');
  }

  trigger.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (popup.classList.contains('is-open')) close(); else open();
  });
  prevBtn.addEventListener('click', (ev) => { ev.stopPropagation(); datePickerViewDate.setMonth(datePickerViewDate.getMonth() - 1); renderGrid(); });
  nextBtn.addEventListener('click', (ev) => { ev.stopPropagation(); datePickerViewDate.setMonth(datePickerViewDate.getMonth() + 1); renderGrid(); });
  grid.addEventListener('click', (ev) => {
    const cell = ev.target.closest ? ev.target.closest('.sc-date-picker-cell') : null;
    if (!cell || cell.disabled || cell.classList.contains('is-empty')) return;
    els.targetDate.value = cell.getAttribute('data-date');
    els.targetDate.dispatchEvent(new Event('input', { bubbles: true }));
    updateTriggerText();
    close();
  });
  clearBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    els.targetDate.value = '';
    els.targetDate.dispatchEvent(new Event('input', { bubbles: true }));
    updateTriggerText();
    close();
  });
  onDocumentClickCloseDatePicker = (ev) => { if (!datePickerEl.contains(ev.target)) close(); };
  document.addEventListener('click', onDocumentClickCloseDatePicker);

  refreshDateTrigger = updateTriggerText;
  updateTriggerText();
}

/* ================================================================
   🏆 称号(実績)
   2つのハイウォーターマークだけを基準に判定する:
     ・所持本数(current)は他機能とも共有する「今の残高」でいつでも減りうる
       → 最高到達値(TITLE_MAX_CANDLE_KEY)をMath.max()でのみ更新し、それを見る。
     ・赤闇の「獲得済み」チェックは予測欄の直近ウィンドウだけを保持し、表示範囲から
       外れると自動的にプルーニングされてしまう一時データなので、称号の連続日数判定
       にはそのまま使えない。そこで称号専用に、チェックした日を(チェックを外しても)
       消さずに積み上げていく恒久ログ(TITLE_CHECKIN_LOG_KEY)を別途持ち、そこから
       「赤闇が来る日を取りこぼさず連続で回収できた日数」の最長記録を都度計算し、
       その最長記録自体もハイウォーターマーク(TITLE_STREAK_BEST_KEY)として保存する。
   どちらも一度満たした称号はTITLES_STORE_KEYに恒久保存され、後から取り消されない。
   ================================================================ */
function loadMaxCandle() {
  try { return parseFloat(localStorage.getItem(TITLE_MAX_CANDLE_KEY)) || 0; } catch (e) { return 0; }
}
function bumpMaxCandle(current) {
  if (current > loadMaxCandle()) {
    try { localStorage.setItem(TITLE_MAX_CANDLE_KEY, String(current)); } catch (e) { /* no-op */ }
  }
}

function loadCheckinLog() {
  try {
    const raw = localStorage.getItem(TITLE_CHECKIN_LOG_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return (obj && typeof obj === 'object') ? obj : {};
  } catch (e) { return {}; }
}
function saveCheckinLog(obj) {
  try { localStorage.setItem(TITLE_CHECKIN_LOG_KEY, JSON.stringify(obj)); } catch (e) { /* no-op */ }
}
// 「獲得済み」チェックがONになった日を恒久ログに記録する。star-candle-forecast.js の
// 赤闇チェック処理からctx.recordShardCheckin(dayKey)として呼ばれる。
function recordShardCheckin(dayKey) {
  if (!dayKey) return;
  const log = loadCheckinLog();
  if (log[dayKey]) return;
  log[dayKey] = true;
  saveCheckinLog(log);
}

// dayKey("年-月-日")をUTC真夜中のタイムスタンプに変換する。
function shardDayKeyToUTCTime(key) {
  const p = (key || '').split('-');
  return Date.UTC(parseInt(p[0], 10) || 0, (parseInt(p[1], 10) || 1) - 1, parseInt(p[2], 10) || 1);
}

// 恒久ログにある最も古いチェック日から今日まで、実際の赤闇スケジュールを1日ずつ辿り、
// 「赤闇が来る日なのにログに無い」で途切れる連続日数の最大値を求める。
function computeLongestCheckinStreak() {
  const log = loadCheckinLog();
  const keys = Object.keys(log);
  if (keys.length === 0) return 0;
  const times = keys.map(shardDayKeyToUTCTime);
  let cursor = Math.min.apply(null, times);
  const todayPt = Forecast.getPTDateParts(new Date());
  const todayTime = Date.UTC(todayPt.year, todayPt.month - 1, todayPt.day);
  let streak = 0, best = 0, guard = 0;
  while (cursor <= todayTime && guard <= 3660) { // 安全のため約10年で打ち切る
    guard++;
    const d = new Date(cursor);
    const sched = Forecast.getDaySchedule(d.getUTCDate(), d.getUTCDay());
    if (sched.color === 'red' && !sched.skipped) {
      const key = d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate();
      if (log[key]) { streak++; if (streak > best) best = streak; } else { streak = 0; }
    }
    cursor += 86400000;
  }
  return best;
}
function loadStreakBest() {
  try { return parseInt(localStorage.getItem(TITLE_STREAK_BEST_KEY), 10) || 0; } catch (e) { return 0; }
}
function bumpStreakBest() {
  const computed = computeLongestCheckinStreak();
  if (computed > loadStreakBest()) {
    try { localStorage.setItem(TITLE_STREAK_BEST_KEY, String(computed)); } catch (e) { /* no-op */ }
  }
}

function loadTitleStore() {
  try {
    const obj = JSON.parse(localStorage.getItem(TITLES_STORE_KEY));
    return (obj && typeof obj === 'object') ? obj : {};
  } catch (e) { return {}; }
}
function saveTitleStore(obj) {
  try { localStorage.setItem(TITLES_STORE_KEY, JSON.stringify(obj)); } catch (e) { /* no-op */ }
}

// 所持本数の変化(saveState経由)・チェック操作のたびに呼ばれる。ハイウォーターマークを
// 更新し、新規に条件を満たした称号があれば記録してトースト表示する。
function checkAndUnlockTitles() {
  if (!containerEl) return;
  try {
    const current = Math.max(0, parseFloat(els.current.value) || 0);
    bumpMaxCandle(current);
    bumpStreakBest();
    const stats = { maxCandle: loadMaxCandle(), streakBest: loadStreakBest() };
    const store = loadTitleStore();
    const newlyEarned = [];
    TITLES.forEach((ti) => {
      if (store[ti.id]) return;
      if (ti.condition(stats)) {
        store[ti.id] = new Date().toISOString();
        newlyEarned.push(ti);
      }
    });
    if (newlyEarned.length) saveTitleStore(store);
    renderTitles(store);
    newlyEarned.forEach((ti) => {
      showToast(t('titles.unlockedToast', { icon: ti.icon, name: ti.name[CURRENT_LANG] !== undefined ? ti.name[CURRENT_LANG] : ti.name.ja }));
    });
  } catch (e) { /* no-op */ }
}

function renderTitles(store) {
  store = store || loadTitleStore();
  const chips = containerEl.querySelector('#scTitlesChips');
  const countEl = containerEl.querySelector('#scTitlesCount');
  if (!chips) return;
  const earnedCount = TITLES.filter((ti) => !!store[ti.id]).length;
  if (countEl) countEl.textContent = t('titles.countTemplate', { earned: earnedCount, total: TITLES.length });
  // 未獲得も含め全件を常に描画する。未獲得は名前・条件文を「？？？」で隠す。
  chips.innerHTML = TITLES.map((ti) => {
    const name = ti.name[CURRENT_LANG] !== undefined ? ti.name[CURRENT_LANG] : ti.name.ja;
    const desc = ti.desc[CURRENT_LANG] !== undefined ? ti.desc[CURRENT_LANG] : ti.desc.ja;
    if (store[ti.id]) {
      return `<span class="sc-title-chip" title="${desc}">${ti.icon} ${name}</span>`;
    }
    return `<span class="sc-title-chip locked" title="${t('titles.lockedTooltip')}">${ti.icon} ？？？</span>`;
  }).join('');
}

/* ================================================================
   🍞 汎用トースト(称号解禁の通知に使用)
   ================================================================ */
function showToast(msg) {
  toastQueue.push(msg);
  if (!toastShowing) processToastQueue();
}
function processToastQueue() {
  const msg = toastQueue.shift();
  if (msg === undefined) { toastShowing = false; return; }
  toastShowing = true;
  const el = document.createElement('div');
  el.className = 'sc-toast';
  // msgは常にこのファイル内部の信頼済みテンプレート(称号アイコンのSVG文字列 + 辞書の
  // 名前)から組み立てられ、外部入力は混入しない。アイコンを描画するためinnerHTMLを使用。
  el.innerHTML = msg;
  document.body.appendChild(el);
  toastTimer = setTimeout(() => { el.classList.add('show'); }, 10);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => { el.remove(); processToastQueue(); }, 300);
  }, 2600);
}

/* ================================================================
   🔔 通知(次の赤闇の着地 / 達成予定日)
   オプトイン。チェックをONにした操作そのものを起点にNotification.requestPermission()
   を呼ぶ(ページ読み込み時など、ユーザー操作を伴わない不意打ちの許可要求は行わない)。
   tai-hubはService Workerを持たない構成のため、通知はこのタブを開いたままにしている
   間だけ届く。setTimeoutの遅延上限(約24.8日)を超える先の予定にも対応できるよう、
   1回のsetTimeoutではなく定期チェック(setInterval)方式で毎分確認する。
   ================================================================ */
function notifySupported() { return typeof Notification !== 'undefined'; }
function notifyLoadFlag(key) {
  try { return localStorage.getItem(key) === '1'; } catch (e) { return false; }
}
function notifySaveFlag(key, on) {
  try { localStorage.setItem(key, on ? '1' : '0'); } catch (e) { /* no-op */ }
}
function notifyGetLast(key) {
  try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
}
function notifySetLast(key, val) {
  try { localStorage.setItem(key, val); } catch (e) { /* no-op */ }
}

function notifyRenderStatus() {
  const statusEl = containerEl && containerEl.querySelector('#scNotifyStatus');
  if (!statusEl) return;
  const shardToggle = containerEl.querySelector('#scNotifyShardToggle');
  const goalToggle = containerEl.querySelector('#scNotifyGoalToggle');
  if (!notifySupported()) {
    statusEl.textContent = t('notify.unsupported');
  } else if (Notification.permission === 'denied' && ((shardToggle && shardToggle.checked) || (goalToggle && goalToggle.checked) || notifyLoadFlag(NOTIFY_SHARD_ENABLED_KEY) || notifyLoadFlag(NOTIFY_GOAL_ENABLED_KEY))) {
    statusEl.innerHTML = t('notify.blocked');
  } else if (Notification.permission === 'granted' && ((shardToggle && shardToggle.checked) || (goalToggle && goalToggle.checked))) {
    statusEl.textContent = t('notify.granted');
  } else {
    statusEl.textContent = '';
  }
}

function notifyFire(title, body) {
  try { new Notification(title, { body }); } catch (e) { /* no-op */ }
}

// チェックON操作そのものを起点にのみ許可を要求する。
function notifySetEnabled(enabledKey, toggleEl, checked) {
  if (!checked) {
    notifySaveFlag(enabledKey, false);
    notifyRenderStatus();
    return;
  }
  if (!notifySupported()) {
    toggleEl.checked = false;
    notifyRenderStatus();
    return;
  }
  if (Notification.permission === 'granted') {
    notifySaveFlag(enabledKey, true);
    notifyRenderStatus();
    return;
  }
  if (Notification.permission === 'denied') {
    notifyRenderStatus();
    toggleEl.checked = false;
    return;
  }
  Notification.requestPermission().then((perm) => {
    if (perm === 'granted') {
      notifySaveFlag(enabledKey, true);
      notifyRenderStatus();
    } else {
      notifyRenderStatus();
      toggleEl.checked = false;
    }
  });
}

// 保存済みのON/OFF状態を復元する。通知許可が'granted'でない場合はチェックだけ外して
// 表示する(実際には通知が届かないため)。保存値自体は消さない(後で許可されれば自動でON)。
function notifyInitToggles() {
  const shardToggle = containerEl.querySelector('#scNotifyShardToggle');
  const goalToggle = containerEl.querySelector('#scNotifyGoalToggle');
  const granted = notifySupported() && Notification.permission === 'granted';
  if (shardToggle) shardToggle.checked = granted && notifyLoadFlag(NOTIFY_SHARD_ENABLED_KEY);
  if (goalToggle) goalToggle.checked = granted && notifyLoadFlag(NOTIFY_GOAL_ENABLED_KEY);
  notifyRenderStatus();
}

// 今後7日間の予測から、まだ着地していない一番近い候補時刻を1つ返す。
function findNextShardLanding() {
  try {
    const forecast = Forecast.buildRedForecast(7);
    for (let i = 0; i < forecast.length; i++) {
      const entries = forecast[i].entries;
      for (let j = 0; j < entries.length; j++) {
        if (!entries[j].active) return entries[j].landingDate;
      }
    }
  } catch (e) { /* no-op */ }
  return null;
}

// 「達成予定日」通知の対象日を1つ選ぶ。目標日(任意)が設定されていればそれを優先する。
// 未設定の場合は「今後の赤闇をすべて回収した場合の達成予定日」を使う。
function findGoalNotifyDate() {
  try {
    const target = Math.max(0, parseFloat(els.target.value) || 0);
    const current = Math.max(0, parseFloat(els.current.value) || 0);
    if (!(target > 0) || current >= target) return null;
    if (els.targetDate.value) {
      const d = new Date(els.targetDate.value + 'T23:59:59');
      if (!isNaN(d.getTime())) return d;
    }
    const feathers = Math.max(0, Math.min(63, parseInt(els.feathers.value, 10) || 0));
    const totalWeekly = feathers * 0.25 - (els.buyDrink.checked ? RESIZE_DRINK_COST : 0);
    const shardResult = Forecast.estimateGoalDateAllShards(current, target, totalWeekly);
    return shardResult ? shardResult.date : null;
  } catch (e) { return null; }
}

function notifyDayKey(date) { return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate(); }

// 毎分1回、通知対象の時刻がリード時間内に入っていないか確認する。同じ着地時刻/同じ
// 達成予定日には1回だけ通知するよう、直近に通知済みの識別子をlocalStorageへ保存して判定する。
function notifyCheck() {
  if (!containerEl || !notifySupported() || Notification.permission !== 'granted') return;
  const now = new Date().getTime();

  if (notifyLoadFlag(NOTIFY_SHARD_ENABLED_KEY)) {
    const landing = findNextShardLanding();
    if (landing) {
      const ts = String(landing.getTime());
      const msUntil = landing.getTime() - now;
      if (msUntil > 0 && msUntil <= NOTIFY_SHARD_LEAD_MS && notifyGetLast(NOTIFY_SHARD_LAST_KEY) !== ts) {
        notifySetLast(NOTIFY_SHARD_LAST_KEY, ts);
        notifyFire(t('notify.shardFireTitle'), t('notify.shardFireBody', { minutes: Math.max(1, Math.round(msUntil / 60000)) }));
      }
    }
  }

  if (notifyLoadFlag(NOTIFY_GOAL_ENABLED_KEY)) {
    const goalDate = findGoalNotifyDate();
    if (goalDate) {
      const gk = notifyDayKey(goalDate);
      const msUntilGoal = goalDate.getTime() - now;
      if (msUntilGoal > 0 && msUntilGoal <= NOTIFY_GOAL_LEAD_MS && notifyGetLast(NOTIFY_GOAL_LAST_KEY) !== gk) {
        notifySetLast(NOTIFY_GOAL_LAST_KEY, gk);
        notifyFire(t('notify.goalFireTitle'), t('notify.goalFireBody', { date: jpDate(goalDate) }));
      }
    }
  }
}

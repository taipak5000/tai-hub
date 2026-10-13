/* ================================================================
   tai-nomacan（ノマキャン計算機）のtai-hub移植版。公開面は mount(container)/
   unmount() の2関数のみ（js/router.js からマウントされる）。

   移植元: tai-nomacan/index.html （~6400行のスタンドアロンページ）のうち、
   共有chrome（site-dock/pf-modal/dash-modal/tools-drawer/サイドバー・
   nsKey/nsKeyFor等）を除いた「このツール自身」の部分：目標(複数目標)
   カード・1日の集めペースカード・結果カード（キャンドルゲージ）・称号
   カード・獲得履歴カード（ストリーク+ヒートマップ+推移グラフ+一覧）・
   デイリークエスト記録カード・「1年前の今日」バナー・カスタム日付
   ピッカー・トースト通知。

   このファイルが持つのはDOMの組み立てとイベント配線・update()（結果の
   算出とHTML構築）・目標(複数目標)管理モーダル・目標切替バー・日付
   ピッカー・目標日クイックピック・トーストキュー。localStorageの読み書き・
   純粋な計算は nomacan-state.js に、獲得履歴/デイリークエスト記録カードの
   描画は nomacan-history.js に分けている。

   【意図的な簡略化・アダプテーション（元の挙動を変えない範囲の adaptation）】
   - ヘッダーの「🔄 最新の状態に更新」ボタン・ヘッダー内の言語切替ボタンは
     移植していない。前者は旧cache-first Service Workerの副作用を回避する
     ための専用ボタンだったが、tai-hubはツールごとのService Worker自体を
     持たない（README参照）ため意味を持たない。後者はtai-hubの表示設定
     モーダル（ドックの「表示設定」→言語）に既に同機能がある。
   - 目標(複数目標)管理モーダルは、元のドラッグ物理演算つきボトムシート
     ではなく、tai-hubの他のモーダル(js/chrome/pf-modal.js等)と同じ
     「.modal-overlay/.modal-card + open クラスでのフェード/スライド」
     方式に統一した（ドラッグ操作でのシート閉じ自体は元々存在せず、
     見た目の開閉アニメーションだけの話。tai-hub全体でこの簡略化済みの
     モーダル方式に統一されているため足並みを揃えている）。行内の
     rename/delete/move/duplicate操作もinline onclick文字列ではなく、
     pf-modal.jsと同じ data-act 委譲方式で配線し直した（挙動は同一）。
   - 「目標日クイックピック」のシーズン終了日/次回アップデート日/開催中
     イベント終了日/再訪精霊終了日の候補は、元実装が自サイトのindex.html
     を自己fetch+正規表現抽出していた(pfDashLoadData)のに対し、tai-hubの
     dash-modal.js が既にそうしているのと同じく features/item/data/
     season-data.js を直接importして計算する（フェッチ自体が不要になった
     というSPA化による改善で、算出結果・表示文言は同一）。
   - キーボードショートカット（?/D/Esc）はtai-hubの共有chrome側の管轄
     （このツール固有の文言ではないため元々このファイルではi18n辞書ごと
     移植していない）。目標管理モーダルのEscキーでの閉じるも、tai-hubの
     既存モーダル(pf/dash/settings)がいずれもEscキー対応を実装していない
     のに合わせ、同じ水準（背景タップでの閉じるのみ）にしている。
   ================================================================ */
import { CURRENT_LANG, escapeHtml, trEvent } from '../../js/i18n.js';
import { t, L } from './data/i18n-nomacan.js';
import { TITLES } from './data/titles.js';
import * as S from './nomacan-state.js';
import * as History from './nomacan-history.js';
import {
  CURRENT_SEASON, EVENT_SCHEDULE, NEXT_UPDATE, REVISIT_SPIRIT_SCHEDULES, isSeasonStarted,
} from '../item/data/season-data.js';

const STYLE_LINK_ID = 'nomacan-view-styles';
const ICON_SPRITE_ID = 'nomacan-icon-sprite';

// 元のI18N辞書のうち「profile.*」等、共有chrome側の文言だった汎用アクション語
// （保存/取消/削除/追加、ヘッダー見出し）は NOMA_I18N には移植していない
// （data/i18n-nomacan.jsのコメント参照）。ここではjs/chrome/*.jsと同じ、call-site
// 数が少ない自前文言向けの素朴なt(ja,en)パターンで賄う。
function tt(ja, en) { return CURRENT_LANG === 'en' ? en : ja; }

let containerEl = null;
let els = {};

let datePickerViewDate = new Date();
let goalEditingId = null;
let goalDeletingId = null;

let currentCommittedValue = 0;
let currentCommitTimer = null;
const CURRENT_COMMIT_DEBOUNCE_MS = 900;

let nomaToastQueue = [];
let nomaToastBusy = false;
let nomaToastTimer = null;

// unmount()で確実に外すための、document/window直付けリスナーの参照
let onDocumentClickCloseDatePicker = null;
let onVisibilityChangeCommit = null;
let onPageHideCommit = null;

/* ================================================================
   公開API
   ================================================================ */
export function mount(container) {
  injectStylesheet();
  injectLocalIconSprite();

  containerEl = container;
  container.innerHTML = renderShell();
  cacheEls();
  wireEvents();

  History.initSections(container, {
    getCurrentValue: () => Math.max(0, parseFloat(els.current.value) || 0),
    getCurrentInputEl: () => els.current,
    getTargetFields: () => ({
      target: Math.max(0, parseFloat(els.target.value) || 0),
      plannedUsage: Math.max(0, parseFloat(els.plannedUsage.value) || 0),
    }),
    onCurrentEditedExternally: () => {
      update();
      saveState();
      syncCurrentToSharedCurrency();
      syncCommittedCurrent();
    },
    renderPaceSuggestion,
  });

  updateDateTriggerText();
  loadState();
  syncCommittedCurrent();
  goalRenderBar();
  update();
  History.renderHistory();
  renderPaceSuggestion();
  renderDateQuickPresets();
  History.renderStreak();
  History.renderStreakHeatmap();
  refreshTitlesUI();
  History.renderQuestLog();
  History.renderQuestStreak();
  renderOneYearAgoBanner();
}

export function unmount() {
  if (currentCommitTimer) { clearTimeout(currentCommitTimer); currentCommitTimer = null; }
  clearTimeout(nomaToastTimer);
  nomaToastQueue = [];
  nomaToastBusy = false;

  if (onDocumentClickCloseDatePicker) document.removeEventListener('click', onDocumentClickCloseDatePicker);
  if (onVisibilityChangeCommit) document.removeEventListener('visibilitychange', onVisibilityChangeCommit);
  if (onPageHideCommit) window.removeEventListener('pagehide', onPageHideCommit);
  onDocumentClickCloseDatePicker = null;
  onVisibilityChangeCommit = null;
  onPageHideCommit = null;

  document.getElementById('goalModalOverlay')?.remove();

  History.teardownSections();
  containerEl = null;
  els = {};
  goalEditingId = null;
  goalDeletingId = null;
}

/* ================================================================
   スタイルシート・追加アイコンスプライトの注入（初回のみ）
   ================================================================ */
function injectStylesheet() {
  if (document.getElementById(STYLE_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_LINK_ID;
  link.rel = 'stylesheet';
  link.href = new URL('../../css/tai-nomacan.css', import.meta.url).href;
  document.head.appendChild(link);
}
// tai-hub共有の#pf-icon-sprite(js/icon-sprite.js)にはこのツールでしか使わない
// アイコン(flame/lock/bolt/chevron-down/duplicate)が含まれないため、衝突しない
// 専用プレフィックス(nm-i-*)で少数だけ追加のスプライトを自前で持つ(共有ファイルは
// 編集しない)。中身は元のtai-nomacan/index.html自身のスプライト定義そのまま。
const NOMACAN_SPRITE_HTML = `<svg id="${ICON_SPRITE_ID}" style="position:absolute;width:0;height:0;overflow:hidden;" aria-hidden="true"><defs>
<symbol id="nm-i-flame" viewBox="0 0 24 24"><path d="M12 21c4 0 6-3 6-6.5 0-2-1-3.5-2-5 0 2-1.5 3-2.5 2C14 9 13 6 10 4c1 3-1 5-2.5 7-1 1.3-1.5 2.5-1.5 3.5C6 18 8 21 12 21Z"/></symbol>
<symbol id="nm-i-lock" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.094) translate(-12 -12)"><path d="M6.5 11h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z"/><path d="M8 11V8a4 4 0 1 1 8 0v3"/></g></symbol>
<symbol id="nm-i-bolt" viewBox="0 0 24 24"><path d="M13 3L5 14h5l-1 7 9-12h-5Z"/></symbol>
<symbol id="nm-i-chevron-down" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.458) translate(-12 -12)"><path d="M6 9l6 6-6 6"/></g></symbol>
<symbol id="nm-i-duplicate" viewBox="0 0 24 24"><path d="M8.5 8.5V5.5A1.5 1.5 0 0 1 10 4h8.5A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H15.5"/><path d="M4 9.5A1.5 1.5 0 0 1 5.5 8h8A1.5 1.5 0 0 1 15 9.5v9a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 4 18.5Z"/></symbol>
</defs></svg>`;
function injectLocalIconSprite() {
  if (document.getElementById(ICON_SPRITE_ID)) return;
  document.body.insertAdjacentHTML('afterbegin', NOMACAN_SPRITE_HTML);
}

/* ================================================================
   マークアップ（外枠）
   ================================================================ */
function renderShell() {
  return `
    <div class="nomacan-view">
      <div class="nm-wrap">
        <header class="page-head">
          <div class="title-icon" aria-hidden="true"></div>
          <h1>${escapeHtml(tt('ノマキャン計算機', 'Nomacan Calculator'))}</h1>
          <p class="subtitle">${CURRENT_LANG === 'en' ? 'Sky: Children of the Light — how many days until your goal?' : 'Sky 星を紡ぐ子どもたち・目標本数まであと何日？'}</p>
        </header>

        <div class="one-year-ago-banner" id="oneYearAgoBanner" role="status" aria-live="polite"></div>

        <section class="card">
          <h2>${t('goal.heading')}</h2>
          <div class="goal-switch-bar" id="goalSwitchBar"></div>
          <div class="field">
            <label for="nmTarget">${t('goal.targetLabel')}</label>
            <div class="input-suffix">
              <input type="number" id="nmTarget" inputmode="decimal" min="0" step="1" placeholder="${t('goal.targetPlaceholder')}">
              <span class="unit">${t('goal.unit')}</span>
            </div>
          </div>
          <div class="field">
            <label for="nmPlannedUsage">${t('goal.plannedUsageLabel')}</label>
            <div class="input-suffix">
              <input type="number" id="nmPlannedUsage" inputmode="decimal" min="0" step="1" placeholder="${t('goal.plannedUsagePlaceholder')}">
              <span class="unit">${t('goal.unit')}</span>
            </div>
            <p class="field-hint">${t('goal.plannedUsageHint')}</p>
          </div>
          <div class="field">
            <label for="nmCurrent">${t('goal.currentLabel')}</label>
            <div class="input-suffix">
              <input type="number" id="nmCurrent" inputmode="decimal" min="0" step="1" placeholder="${t('goal.currentPlaceholder')}">
              <span class="unit">${t('goal.unit')}</span>
            </div>
            <div class="quick-actions-row">
              <button type="button" class="fill-current-btn" id="nmFillCurrentBtn">${t('goal.fillCurrentBtn')}</button>
              <button type="button" class="survey-btn" id="nmSurveyBtn">${t('goal.surveyBtn')}</button>
              <button type="button" class="quest-btn" id="nmQuestBtn">${t('goal.questBtn')}</button>
              <button type="button" class="heart-sent-btn" id="nmHeartSentBtn">${t('goal.heartSentBtn')}</button>
            </div>
            <div class="adjust-amount-row">
              <input type="number" id="nmSubtractAmount" inputmode="decimal" min="0" step="1" class="adjust-amount-input" placeholder="${t('goal.subtractAmountPlaceholder')}">
              <button type="button" class="subtract-amount-btn" id="nmSubtractAmountBtn">${t('goal.subtractAmountBtn')}</button>
            </div>
          </div>
          <div class="field">
            <label for="nmTargetDateTrigger">${t('goal.targetDateLabel')}</label>
            <div class="date-picker" id="nmDatePicker">
              <button type="button" class="date-picker-trigger" id="nmTargetDateTrigger" aria-haspopup="true" aria-expanded="false">
                <span id="nmTargetDateTriggerText">${t('goal.dateSelectPlaceholder')}</span>
                <span class="date-picker-icon" aria-hidden="true"><svg class="inline-icon" width="14" height="14"><use href="#i-calendar"/></svg></span>
              </button>
              <div class="date-picker-popup" id="nmDatePickerPopup">
                <div class="date-picker-header">
                  <button type="button" class="date-picker-nav" id="nmDatePickerPrev" aria-label="${t('goal.prevMonth')}">‹</button>
                  <span class="date-picker-month" id="nmDatePickerMonthLabel"></span>
                  <button type="button" class="date-picker-nav" id="nmDatePickerNext" aria-label="${t('goal.nextMonth')}">›</button>
                </div>
                <div class="date-picker-weekdays" id="nmDatePickerWeekdays">${S.WEEKDAYS_JA.map((_, i) => '<span>' + S.weekdayLabel(i) + '</span>').join('')}</div>
                <div class="date-picker-grid" id="nmDatePickerGrid"></div>
                <button type="button" class="date-picker-clear" id="nmDatePickerClear">${t('goal.clearSelection')}</button>
              </div>
            </div>
            <input type="date" id="nmTargetDate" style="display:none" tabindex="-1" aria-hidden="true">
            <div class="date-quick-presets" id="nmDateQuickPresets"></div>
          </div>
        </section>

        <section class="card">
          <h2>${t('pace.heading')}</h2>
          <div class="field">
            <div class="slider-row">
              <label for="nmDailyRate">${t('pace.dailyRateLabel')}</label>
              <span class="slider-readout" id="nmDailyRateReadout"></span>
            </div>
            <input type="range" id="nmDailyRate" min="0" max="25" step="1" value="15">
            <p class="field-hint">${t('pace.dailyRateHint')}</p>
            <button type="button" class="fill-current-btn pace-finish-today-btn" id="nmFinishTodayBtn"></button>
            <div class="pace-suggest" id="nmPaceSuggest" style="display:none;">
              <div class="pace-suggest-texts">
                <span class="pace-suggest-text" id="nmPaceSuggestText"></span>
                <span class="pace-suggest-text" id="nmPaceSuggestRange" style="display:none;"></span>
              </div>
              <button type="button" class="fill-current-btn" id="nmPaceSuggestBtn">${t('pace.useActualBtn')}</button>
            </div>
          </div>
          <hr class="divider">
          <div class="field" id="nmGoalPaceOverrideField">
            <div class="toggle-field">
              <div class="toggle-text">
                <span class="toggle-title">${t('pace.overrideToggleTitle')}</span>
                <span class="toggle-sub">${t('pace.overrideToggleSub')}</span>
              </div>
              <input type="checkbox" id="nmGoalPaceOverrideCheckbox" style="width:20px; height:20px; accent-color: var(--amber); cursor:pointer; flex-shrink:0;">
            </div>
            <div class="input-suffix" id="nmGoalPaceOverrideInputWrap" style="display:none; margin-top:10px;">
              <input type="number" id="nmGoalPaceOverrideInput" inputmode="numeric" min="0" max="25" step="1" placeholder="${t('pace.overridePlaceholder')}">
              <span class="unit">${t('pace.heartsUnit')}</span>
            </div>
            <p class="field-hint" id="nmGoalPaceOverrideHint" style="display:none;"></p>
          </div>
          <hr class="divider">
          <div class="field">
            <div class="toggle-field">
              <div class="toggle-text">
                <span class="toggle-title">${t('pace.toggleTitle')}</span>
                <span class="toggle-sub">${t('pace.toggleSub')}</span>
              </div>
            </div>
            <div class="input-suffix" style="margin-top:10px;">
              <input type="number" id="nmHeartsToSend" inputmode="numeric" min="0" step="1" placeholder="0">
              <span class="unit">${t('pace.heartsUnit')}</span>
            </div>
          </div>
        </section>

        <section class="card result-card">
          <h2 style="justify-content:center;">${t('result.heading')}</h2>
          <div class="gauge-wrap">
            <div class="candle">
              <span class="spark" aria-hidden="true"></span>
              <span class="spark" aria-hidden="true"></span>
              <span class="spark" aria-hidden="true"></span>
              <div class="flame" aria-hidden="true"></div>
              <div class="wick" aria-hidden="true"></div>
              <div class="candle-body"><div class="candle-fill" id="nmCandleFill"></div></div>
            </div>
          </div>
          <div id="nmResultContent"></div>
        </section>

        <section class="card titles-card" id="nmTitlesPanel">
          <h2 style="justify-content:space-between;">
            <span>${t('titles.heading')}</span>
            <span class="titles-count" id="nmTitlesCount">0 / ${TITLES.length}</span>
          </h2>
          <div class="titles-chips" id="nmTitlesChips"></div>
        </section>

        <section class="card">
          <h2>${t('history.heading')}</h2>
          <div class="streak-strip" id="streakStrip"></div>
          <div class="streak-heatmap-wrap" id="streakHeatmapWrap"></div>
          <div class="history-goal-filter-row" id="historyGoalFilterRow" style="display:none;">
            <label class="history-goal-filter-label" for="historyGoalFilter">${t('history.filterLabel')}</label>
            <select class="history-goal-filter" id="historyGoalFilter"></select>
          </div>
          <div class="trend-chart-wrap" id="trendChartWrap"></div>
          <div class="history-list" id="historyList"></div>
          <div class="history-footer">
            <p class="note">${t('history.note')}</p>
            <button type="button" class="history-clear-btn" id="historyClearBtn">${t('history.clearBtn')}</button>
          </div>
        </section>

        <section class="card">
          <h2>${t('dailyQuest.heading')}</h2>
          <div class="streak-strip" id="questStreakStrip"></div>
          <div class="field">
            <label for="questLogInput">${t('dailyQuest.inputLabel')}</label>
            <textarea id="questLogInput" class="quest-log-textarea" rows="3" placeholder="${t('dailyQuest.inputPlaceholder')}"></textarea>
            <p class="field-hint">${t('dailyQuest.inputHint')}</p>
            <button type="button" class="fill-current-btn" id="questLogSaveBtn">${t('dailyQuest.saveBtn')}</button>
          </div>
          <hr class="divider">
          <div class="history-list" id="questLogList"></div>
          <div class="history-footer">
            <p class="note">${t('dailyQuest.note')}</p>
            <button type="button" class="history-clear-btn" id="questLogClearBtn">${t('dailyQuest.clearBtn')}</button>
          </div>
        </section>

        <footer>
          <span>${escapeHtml(t('footer.disclaimer'))}</span><br>
          <span>${escapeHtml(t('footer.creditLabel'))}</span> <a href="https://x.com/Skyzztai" target="_blank" rel="noopener noreferrer">@Skyzztai</a>　／　<a href="https://odaibako.net/u/Skyzztai" target="_blank" rel="noopener noreferrer">${escapeHtml(t('footer.requestForm'))}</a><br>
          <a href="https://taipak5000.github.io/tai-info/" target="_blank" rel="noopener noreferrer">${escapeHtml(t('footer.infoLink'))}</a>
        </footer>
      </div>
      <div class="noma-toast" id="nmNomaToast" role="status" aria-live="polite"></div>
    </div>
  `;
}

function cacheEls() {
  const q = (id) => containerEl.querySelector('#' + id);
  els = {
    target: q('nmTarget'),
    plannedUsage: q('nmPlannedUsage'),
    current: q('nmCurrent'),
    targetDate: q('nmTargetDate'),
    dailyRate: q('nmDailyRate'),
    dailyRateReadout: q('nmDailyRateReadout'),
    heartsToSend: q('nmHeartsToSend'),
    fillCurrentBtn: q('nmFillCurrentBtn'),
    surveyBtn: q('nmSurveyBtn'),
    questBtn: q('nmQuestBtn'),
    heartSentBtn: q('nmHeartSentBtn'),
    subtractAmount: q('nmSubtractAmount'),
    subtractAmountBtn: q('nmSubtractAmountBtn'),
    finishTodayBtn: q('nmFinishTodayBtn'),
    candleFill: q('nmCandleFill'),
    resultContent: q('nmResultContent'),
    goalPaceOverrideCheckbox: q('nmGoalPaceOverrideCheckbox'),
    goalPaceOverrideInput: q('nmGoalPaceOverrideInput'),
    goalPaceOverrideInputWrap: q('nmGoalPaceOverrideInputWrap'),
    goalPaceOverrideHint: q('nmGoalPaceOverrideHint'),
    paceSuggest: q('nmPaceSuggest'),
    paceSuggestText: q('nmPaceSuggestText'),
    paceSuggestRange: q('nmPaceSuggestRange'),
    paceSuggestBtn: q('nmPaceSuggestBtn'),
    goalSwitchBar: q('goalSwitchBar'),
    datePickerEl: q('nmDatePicker'),
    datePickerTrigger: q('nmTargetDateTrigger'),
    datePickerTriggerText: q('nmTargetDateTriggerText'),
    datePickerPopup: q('nmDatePickerPopup'),
    datePickerGrid: q('nmDatePickerGrid'),
    datePickerMonthLabel: q('nmDatePickerMonthLabel'),
    datePickerPrevBtn: q('nmDatePickerPrev'),
    datePickerNextBtn: q('nmDatePickerNext'),
    datePickerClearBtn: q('nmDatePickerClear'),
    dateQuickPresetsEl: q('nmDateQuickPresets'),
    titlesChips: q('nmTitlesChips'),
    titlesCount: q('nmTitlesCount'),
    oneYearAgoBanner: q('oneYearAgoBanner'),
    nomaToast: q('nmNomaToast'),
  };
}

/* ================================================================
   イベント配線
   ================================================================ */
function wireEvents() {
  [els.target, els.plannedUsage, els.targetDate, els.dailyRate, els.heartsToSend, els.goalPaceOverrideInput].forEach((el) => {
    if (!el) return;
    el.addEventListener('input', () => { update(); saveState(); });
  });

  els.current.addEventListener('input', () => {
    update();
    saveState();
    if (currentCommitTimer) clearTimeout(currentCommitTimer);
    currentCommitTimer = setTimeout(commitCurrentValue, CURRENT_COMMIT_DEBOUNCE_MS);
  });
  els.current.addEventListener('blur', commitCurrentValue);
  els.current.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); commitCurrentValue(); els.current.blur(); }
  });
  onVisibilityChangeCommit = () => { if (document.visibilityState === 'hidden') commitCurrentValue(); };
  onPageHideCommit = () => commitCurrentValue();
  document.addEventListener('visibilitychange', onVisibilityChangeCommit);
  window.addEventListener('pagehide', onPageHideCommit);

  els.fillCurrentBtn.addEventListener('click', () => {
    if (currentCommitTimer) clearTimeout(currentCommitTimer);
    const before = Math.max(0, parseFloat(els.current.value) || 0);
    const newVal = Math.max(0, S.readOwnedCandle());
    els.current.value = newVal;
    update();
    saveState();
    recordHistory('history.entryFillCurrent', Math.round((newVal - before) * 100) / 100);
    syncCommittedCurrent();
  });
  els.surveyBtn.addEventListener('click', () => {
    if (currentCommitTimer) clearTimeout(currentCommitTimer);
    const current = Math.max(0, parseFloat(els.current.value) || 0);
    els.current.value = Math.round((current + 3) * 100) / 100;
    update();
    saveState();
    syncCurrentToSharedCurrency();
    recordHistory('history.entrySurvey', 3);
    syncCommittedCurrent();
  });
  // 「クエスト分(+4本)」: クエスト報酬の4本をそのまま加算する（アンケート回答ボタンと同じ流れ）。
  els.questBtn.addEventListener('click', () => {
    if (currentCommitTimer) clearTimeout(currentCommitTimer);
    const current = Math.max(0, parseFloat(els.current.value) || 0);
    els.current.value = Math.round((current + 4) * 100) / 100;
    update();
    saveState();
    syncCurrentToSharedCurrency();
    recordHistory('history.entryQuest', 4);
    syncCommittedCurrent();
  });
  els.heartSentBtn.addEventListener('click', () => {
    if (currentCommitTimer) clearTimeout(currentCommitTimer);
    const current = Math.max(0, parseFloat(els.current.value) || 0);
    const newVal = Math.max(0, Math.round((current - 3) * 100) / 100);
    const delta = Math.round((newVal - current) * 100) / 100;
    els.current.value = newVal;
    update();
    saveState();
    syncCurrentToSharedCurrency();
    recordHistory('history.entryHeartSent', delta);
    syncCommittedCurrent();
  });
  els.subtractAmountBtn.addEventListener('click', subtractEnteredAmount);
  els.subtractAmount.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); subtractEnteredAmount(); } });
  els.finishTodayBtn.addEventListener('click', () => {
    if (currentCommitTimer) clearTimeout(currentCommitTimer);
    const globalDailyRate = Math.max(0, Math.min(25, parseInt(els.dailyRate.value, 10) || 0));
    const dailyRate = currentEffectiveDailyRate(globalDailyRate);
    if (dailyRate <= 0) return;
    const current = Math.max(0, parseFloat(els.current.value) || 0);
    els.current.value = Math.round((current + dailyRate) * 100) / 100;
    update();
    saveState();
    syncCurrentToSharedCurrency();
    recordHistory('history.entryFinishToday', dailyRate);
    syncCommittedCurrent();
  });
  if (els.paceSuggestBtn) {
    els.paceSuggestBtn.addEventListener('click', () => {
      const rate = S.computeActualDailyRate(S.loadHistory());
      if (rate === null) return;
      els.dailyRate.value = Math.max(0, Math.min(25, Math.round(rate)));
      els.dailyRate.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  els.resultContent.addEventListener('click', (ev) => {
    const btn = ev.target.closest ? ev.target.closest('#nmApplyRequiredPaceBtn') : null;
    if (!btn) return;
    const n = parseInt(btn.getAttribute('data-pace'), 10);
    if (!isFinite(n)) return;
    if (els.goalPaceOverrideCheckbox && els.goalPaceOverrideCheckbox.checked) {
      els.goalPaceOverrideInput.value = n;
      els.goalPaceOverrideInput.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      els.dailyRate.value = n;
      els.dailyRate.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  els.goalPaceOverrideCheckbox.addEventListener('change', () => goalPaceOverrideToggle(els.goalPaceOverrideCheckbox.checked));

  els.goalSwitchBar.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-goal-open]') || ev.target.closest('.goal-bar-text')) goalOpenModal();
  });
  els.goalSwitchBar.addEventListener('keydown', (ev) => {
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.closest('.goal-bar-text')) { ev.preventDefault(); goalOpenModal(); }
  });

  els.oneYearAgoBanner.addEventListener('click', (ev) => {
    const btn = ev.target.closest ? ev.target.closest('.one-year-ago-close-btn') : null;
    if (!btn) return;
    try { localStorage.setItem(S.ONE_YEAR_AGO_DISMISS_KEY(), S.gameDayStr(Date.now())); } catch (e) { /* noop */ }
    els.oneYearAgoBanner.classList.remove('is-visible');
    els.oneYearAgoBanner.innerHTML = '';
  });

  wireDatePicker();

  if (els.dateQuickPresetsEl) {
    els.dateQuickPresetsEl.addEventListener('click', (ev) => {
      const btn = ev.target.closest ? ev.target.closest('.date-quick-preset-btn') : null;
      if (!btn) return;
      els.targetDate.value = btn.getAttribute('data-date');
      els.targetDate.dispatchEvent(new Event('input', { bubbles: true }));
      updateDateTriggerText();
    });
  }
}

/* ================================================================
   💾 保存/読込（画面入力 ⇔ localStorage）
   ================================================================ */
function saveState() {
  S.saveCalcState({ current: els.current.value, dailyRate: els.dailyRate.value, heartsToSend: els.heartsToSend.value });
  saveActiveGoalFields();
}
function loadState() {
  const state = S.loadCalcState();
  if (state) {
    if (state.current !== undefined) els.current.value = S.sanitizeNumericFieldValue(state.current);
    if (state.dailyRate !== undefined) els.dailyRate.value = state.dailyRate;
    if (state.heartsToSend !== undefined) els.heartsToSend.value = state.heartsToSend;
  }
  loadActiveGoalIntoFields();
}
function loadActiveGoalIntoFields() {
  const g = S.goalGetActive();
  els.target.value = S.sanitizeNumericFieldValue(g.target || '');
  els.plannedUsage.value = S.sanitizeNumericFieldValue(g.plannedUsage || '');
  els.targetDate.value = g.targetDate || '';
  loadGoalPaceOverrideIntoFields(g);
}
function saveActiveGoalFields() {
  const data = S.goalEnsureInit();
  const g = S.goalGetActive(data);
  g.target = S.sanitizeNumericFieldValue(els.target.value);
  g.plannedUsage = S.sanitizeNumericFieldValue(els.plannedUsage.value);
  g.targetDate = els.targetDate.value;
  g.dailyRateOverride = goalPaceOverrideFieldValue();
  S.goalSaveData(data);
}

/* ================================================================
   🕯️ 目標ごとのペース個別設定
   ================================================================ */
function currentEffectiveDailyRate(globalRate) {
  if (els.goalPaceOverrideCheckbox && els.goalPaceOverrideCheckbox.checked) {
    return Math.max(0, Math.min(25, parseInt(els.goalPaceOverrideInput.value, 10) || 0));
  }
  return globalRate;
}
function goalPaceOverrideFieldValue() {
  if (!els.goalPaceOverrideCheckbox || !els.goalPaceOverrideCheckbox.checked) return '';
  return S.sanitizeNumericFieldValue(els.goalPaceOverrideInput.value);
}
function loadGoalPaceOverrideIntoFields(g) {
  const hasOverride = !!(g && g.dailyRateOverride !== undefined && g.dailyRateOverride !== null && g.dailyRateOverride !== '');
  if (els.goalPaceOverrideCheckbox) els.goalPaceOverrideCheckbox.checked = hasOverride;
  if (els.goalPaceOverrideInput) els.goalPaceOverrideInput.value = hasOverride ? g.dailyRateOverride : '';
  updateGoalPaceOverrideVisibility();
}
function updateGoalPaceOverrideVisibility() {
  const checked = !!(els.goalPaceOverrideCheckbox && els.goalPaceOverrideCheckbox.checked);
  if (els.goalPaceOverrideInputWrap) els.goalPaceOverrideInputWrap.style.display = checked ? '' : 'none';
  if (els.goalPaceOverrideHint) {
    if (checked) {
      const n = Math.max(0, Math.min(25, parseInt(els.goalPaceOverrideInput.value, 10) || 0));
      els.goalPaceOverrideHint.textContent = t('pace.overrideActiveHint', { n: S.fmt(n) });
      els.goalPaceOverrideHint.style.display = '';
    } else {
      els.goalPaceOverrideHint.style.display = 'none';
    }
  }
}
function goalPaceOverrideToggle(checked) {
  if (checked && els.goalPaceOverrideInput && !els.goalPaceOverrideInput.value) {
    els.goalPaceOverrideInput.value = els.dailyRate.value;
  }
  updateGoalPaceOverrideVisibility();
  saveActiveGoalFields();
  update();
}

/* ================================================================
   📜 履歴への記録（addHistoryEntry相当）+ ストリーク/称号/トーストの連鎖
   ================================================================ */
function recordHistory(labelKey, amount) {
  const activeGoalId = (() => { try { return S.goalEnsureInit().activeGoalId || null; } catch (e) { return null; } })();
  const result = S.addHistoryEntry(labelKey, amount, activeGoalId);
  if (!result) return;
  History.renderHistory();
  History.renderTrendChart();
  renderPaceSuggestion();
  History.renderStreak();
  History.renderStreakHeatmap();
  refreshTitlesUI();
}

/* ================================================================
   🎗️ 目標（複数目標）切替バー・管理モーダル
   ================================================================ */
function goalRenderBar() {
  const data = S.goalEnsureInit();
  const active = S.goalGetActive(data);
  els.goalSwitchBar.innerHTML =
    '<span class="goal-bar-text" tabindex="0" role="button"><b>' + escapeHtml(S.goalDisplayName(active)) + '</b>&nbsp;' + t('goalMulti.barActiveSuffix') + '</span>' +
    '<button type="button" class="goal-switch-icon-btn" data-goal-open title="' + escapeHtml(t('goalMulti.manageBtnTitle')) + '"><svg class="inline-icon" width="15" height="15"><use href="#i-folder"/></svg></button>';
  History.renderHistoryGoalFilter();
}

function goalOpenModal() {
  document.getElementById('goalModalOverlay')?.remove();
  goalEditingId = null;
  goalDeletingId = null;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'goalModalOverlay';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) goalCloseModal(); });
  overlay.innerHTML = `
    <div class="modal-card">
      <button type="button" class="modal-close-btn" id="goalModalCloseBtn"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      <div class="modal-title">${escapeHtml(t('goalMulti.modalTitle'))}</div>
      <div id="goalModalBody"></div>
      <div class="pf-add-row">
        <input type="text" id="goalNewGoalInput" maxlength="20" placeholder="${escapeHtml(t('goalMulti.newNamePlaceholder'))}">
        <button type="button" class="pf-icon-btn pf-row-btn-ok" id="goalAddBtn">${escapeHtml(tt('追加', 'Add'))}</button>
      </div>
      <p class="pf-hint">${escapeHtml(t('goalMulti.hint'))}</p>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('goalModalCloseBtn').addEventListener('click', goalCloseModal);
  const addBtn = document.getElementById('goalAddBtn');
  const newInput = document.getElementById('goalNewGoalInput');
  addBtn.addEventListener('click', () => goalAdd(newInput.value));
  newInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); goalAdd(newInput.value); } });
  const body = document.getElementById('goalModalBody');
  body.addEventListener('click', handleGoalModalClick);
  body.addEventListener('keydown', handleGoalModalKeydown);

  goalRenderModalBody();
  requestAnimationFrame(() => overlay.classList.add('open'));
}
function goalCloseModal() {
  goalEditingId = null;
  goalDeletingId = null;
  document.getElementById('goalModalOverlay')?.classList.remove('open');
}

function goalRenderModalBody() {
  const body = document.getElementById('goalModalBody');
  if (!body) return;
  const data = S.goalEnsureInit();
  const activeId = data.activeGoalId;
  const currentVal = Math.max(0, parseFloat(els.current.value) || 0);
  const globalDailyRate = Math.max(0, Math.min(25, parseInt(els.dailyRate.value, 10) || 0));
  const heartsToSend = Math.max(0, parseFloat(els.heartsToSend.value) || 0);

  body.innerHTML = data.goals.map((g, idx) => {
    if (goalEditingId === g.id) {
      return '<div class="pf-row" style="flex-wrap: wrap;">' +
        '<input type="text" class="pf-row-input" id="goalEditInput" value="' + escapeHtml(g.name) + '" maxlength="20">' +
        '<button type="button" class="pf-icon-btn pf-row-btn-ok" data-act="save-rename" data-id="' + g.id + '">' + escapeHtml(tt('保存', 'Save')) + '</button>' +
        '<button type="button" class="pf-icon-btn" data-act="cancel">' + escapeHtml(tt('取消', 'Cancel')) + '</button>' +
        '</div>';
    }
    if (goalDeletingId === g.id) {
      return '<div class="pf-row" style="flex-wrap: wrap;">' +
        '<span class="goal-row-confirm-text">' + t('goalMulti.deleteConfirmText', { name: escapeHtml(S.goalDisplayName(g)) }) + '</span>' +
        '<button type="button" class="pf-icon-btn pf-row-btn-danger" data-act="confirm-delete" data-id="' + g.id + '">' + escapeHtml(tt('削除', 'Delete')) + '</button>' +
        '<button type="button" class="pf-icon-btn" data-act="cancel">' + escapeHtml(tt('取消', 'Cancel')) + '</button>' +
        '</div>';
    }
    const summary = S.goalComputeSummary(g, currentVal, globalDailyRate, heartsToSend);
    let summaryHtml;
    if (!summary.hasTarget) {
      summaryHtml = t('goalMulti.summaryNoTarget');
    } else if (summary.achieved) {
      summaryHtml = t('goalMulti.summaryAchieved');
    } else {
      summaryHtml = t(S.isOnePlural(summary.remaining) ? 'goalMulti.summaryRemainingTemplateOne' : 'goalMulti.summaryRemainingTemplate', { remaining: S.fmt(summary.remaining), pct: summary.pct }) +
        (summary.days !== null ? t(summary.days === 1 ? 'goalMulti.summaryDaysTemplateOne' : 'goalMulti.summaryDaysTemplate', { n: summary.days }) : '');
    }
    if (g.dailyRateOverride !== undefined && g.dailyRateOverride !== null && g.dailyRateOverride !== '') {
      const overrideN = Math.max(0, Math.min(25, parseInt(g.dailyRateOverride, 10) || 0));
      summaryHtml += ' <span class="goal-row-pace-badge">' + t('goalMulti.paceOverrideBadge', { n: S.fmt(overrideN) }) + '</span>';
    }
    return '<div class="pf-row' + (g.id === activeId ? ' active' : '') + '">' +
      '<span class="goal-row-main">' +
        '<span class="pf-row-name' + (g.id === activeId ? ' is-active' : '') + '" tabindex="0" role="button" data-act="switch" data-id="' + g.id + '">' +
          (g.id === activeId ? '<svg class="inline-icon ok" width="13" height="13"><use href="#i-check"/></svg> ' : '') + escapeHtml(S.goalDisplayName(g)) + '</span>' +
        '<span class="goal-row-summary' + (summary.achieved ? ' is-achieved' : '') + '">' + summaryHtml + '</span>' +
      '</span>' +
      '<button type="button" class="pf-icon-btn pf-move-btn" data-act="move-up" data-id="' + g.id + '" title="' + escapeHtml(t('goalMulti.moveUpBtnTitle')) + '"' + (idx === 0 ? ' disabled' : '') + '><svg class="inline-icon" width="13" height="13" style="transform:rotate(180deg);"><use href="#nm-i-chevron-down"/></svg></button>' +
      '<button type="button" class="pf-icon-btn pf-move-btn" data-act="move-down" data-id="' + g.id + '" title="' + escapeHtml(t('goalMulti.moveDownBtnTitle')) + '"' + (idx === data.goals.length - 1 ? ' disabled' : '') + '><svg class="inline-icon" width="13" height="13"><use href="#nm-i-chevron-down"/></svg></button>' +
      '<button type="button" class="pf-icon-btn" data-act="duplicate" data-id="' + g.id + '" title="' + escapeHtml(t('goalMulti.duplicateBtnTitle')) + '"><svg class="inline-icon" width="14" height="14"><use href="#nm-i-duplicate"/></svg></button>' +
      '<button type="button" class="pf-icon-btn" data-act="rename" data-id="' + g.id + '"><svg class="inline-icon" width="14" height="14"><use href="#i-edit"/></svg></button>' +
      (data.goals.length > 1 ? '<button type="button" class="pf-icon-btn" data-act="delete" data-id="' + g.id + '"><svg class="inline-icon" width="14" height="14"><use href="#i-trash"/></svg></button>' : '') +
      '</div>';
  }).join('');

  if (goalEditingId !== null) {
    const input = document.getElementById('goalEditInput');
    if (input) { input.focus(); input.select(); }
  }
}

function handleGoalModalClick(ev) {
  const el = ev.target.closest ? ev.target.closest('[data-act]') : null;
  if (!el) return;
  const act = el.dataset.act;
  const id = el.dataset.id;
  if (act === 'switch') goalSwitch(id);
  else if (act === 'rename') { goalDeletingId = null; goalEditingId = id; goalRenderModalBody(); }
  else if (act === 'delete') { goalEditingId = null; goalDeletingId = id; goalRenderModalBody(); }
  else if (act === 'cancel') { goalEditingId = null; goalDeletingId = null; goalRenderModalBody(); }
  else if (act === 'save-rename') goalConfirmRenameInline(id);
  else if (act === 'confirm-delete') { goalDeletingId = null; goalDeleteGoal(id); }
  else if (act === 'move-up') goalMoveGoal(id, -1);
  else if (act === 'move-down') goalMoveGoal(id, 1);
  else if (act === 'duplicate') goalDuplicateGoal(id);
}
function handleGoalModalKeydown(ev) {
  if (ev.target && ev.target.id === 'goalEditInput') {
    if (ev.key === 'Enter') goalConfirmRenameInline(goalEditingId);
    else if (ev.key === 'Escape') { ev.stopPropagation(); goalEditingId = null; goalDeletingId = null; goalRenderModalBody(); }
  }
}
function goalConfirmRenameInline(id) {
  const input = document.getElementById('goalEditInput');
  const next = input ? input.value : '';
  goalEditingId = null;
  if (next && next.trim()) {
    const data = S.goalEnsureInit();
    const target = data.goals.find((g) => g.id === id);
    if (target) {
      target.name = next.trim().slice(0, 20);
      S.goalSaveData(data);
      goalRenderBar();
    }
  }
  goalRenderModalBody();
}
function goalDeleteGoal(id) {
  const data = S.goalEnsureInit();
  if (data.goals.length <= 1) return;
  const remaining = data.goals.filter((g) => g.id !== id);
  const wasActive = data.activeGoalId === id;
  const newActiveId = wasActive ? remaining[0].id : data.activeGoalId;
  S.goalSaveData({ goals: remaining, activeGoalId: newActiveId });
  if (wasActive) { loadActiveGoalIntoFields(); update(); updateDateTriggerText(); }
  goalRenderModalBody();
  goalRenderBar();
}
function goalMoveGoal(id, direction) {
  const data = S.goalEnsureInit();
  const idx = data.goals.findIndex((g) => g.id === id);
  if (idx === -1) return;
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= data.goals.length) return;
  const tmp = data.goals[idx];
  data.goals[idx] = data.goals[newIdx];
  data.goals[newIdx] = tmp;
  S.goalSaveData(data);
  goalRenderModalBody();
  goalRenderBar();
}
function goalDuplicateGoal(id) {
  const data = S.goalEnsureInit();
  const idx = data.goals.findIndex((g) => g.id === id);
  if (idx === -1) return;
  const src = data.goals[idx];
  const copy = {
    id: S.goalGenId(),
    name: t('goalMulti.duplicateNameTemplate', { name: S.goalDisplayName(src) }).slice(0, 20),
    target: src.target, plannedUsage: src.plannedUsage, targetDate: src.targetDate, dailyRateOverride: src.dailyRateOverride,
  };
  data.goals.splice(idx + 1, 0, copy);
  S.goalSaveData(data);
  goalRenderModalBody();
  goalRenderBar();
}
function goalAdd(rawName) {
  const name = (rawName || '').trim();
  if (!name) return;
  const data = S.goalEnsureInit();
  const id = S.goalGenId();
  data.goals.push({ id, name: name.slice(0, 20), target: '', plannedUsage: '', targetDate: '', dailyRateOverride: '' });
  S.goalSaveData(data);
  const input = document.getElementById('goalNewGoalInput');
  if (input) input.value = '';
  goalSwitch(id);
}
function goalSwitch(id) {
  const data = S.goalEnsureInit();
  if (id === data.activeGoalId) { goalCloseModal(); return; }
  data.activeGoalId = id;
  S.goalSaveData(data);
  loadActiveGoalIntoFields();
  update();
  updateDateTriggerText();
  goalRenderBar();
  goalCloseModal();
}

/* ================================================================
   🏆 称号
   ================================================================ */
function renderTitles(store) {
  store = store || S.loadTitleStore();
  const earnedCount = TITLES.filter((ti) => store.earned[ti.id]).length;
  if (els.titlesCount) els.titlesCount.textContent = t('titles.countTemplate', { earned: earnedCount, total: TITLES.length });
  els.titlesChips.innerHTML = TITLES.map((ti) => {
    if (store.earned[ti.id]) {
      return '<span class="title-chip" title="' + escapeHtml(L(ti.desc)) + '">' + ti.icon + ' ' + escapeHtml(L(ti.name)) + '</span>';
    }
    return '<span class="title-chip locked" title="' + escapeHtml(t('titles.lockedHint')) + '"><svg class="inline-icon" width="13" height="13"><use href="#nm-i-lock"/></svg> ' + escapeHtml(t('titles.lockedName')) + '</span>';
  }).join('');
}
function refreshTitlesUI() {
  const current = Math.max(0, parseFloat(els.current.value) || 0);
  const longestStreak = S.loadStreakData(S.STREAK_KEY()).longest;
  const { store, newlyEarned } = S.checkAndUnlockTitles(current, longestStreak);
  renderTitles(store);
  newlyEarned.forEach((ti) => {
    queueNomaToast(t('titles.unlockedToastTemplate', { icon: ti.icon, name: L(ti.name) }));
  });
}

/* ================================================================
   🔔 トースト
   ================================================================ */
function queueNomaToast(msg) {
  nomaToastQueue.push(msg);
  if (!nomaToastBusy) advanceNomaToastQueue();
}
function advanceNomaToastQueue() {
  const el = els.nomaToast;
  if (!el || nomaToastQueue.length === 0) { nomaToastBusy = false; return; }
  nomaToastBusy = true;
  const msg = nomaToastQueue.shift();
  el.innerHTML = msg;
  el.classList.add('show');
  clearTimeout(nomaToastTimer);
  nomaToastTimer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(advanceNomaToastQueue, 200);
  }, 2600);
}

/* ================================================================
   🎉 「1年前の今日」お知らせバナー
   ================================================================ */
function renderOneYearAgoBanner() {
  const wrap = els.oneYearAgoBanner;
  if (!wrap) return;
  const today = S.gameTodayDate();
  const todayStr = S.streakDateStr(today);
  let dismissedDate = null;
  try { dismissedDate = localStorage.getItem(S.ONE_YEAR_AGO_DISMISS_KEY()); } catch (e) { /* noop */ }
  if (dismissedDate === todayStr) { wrap.classList.remove('is-visible'); wrap.innerHTML = ''; return; }
  const historyEntry = S.findOneYearAgoHistoryEntry(S.loadHistory(), today);
  const questEntry = S.findOneYearAgoQuestEntry(S.loadQuestLog(), today);
  if (!historyEntry && !questEntry) { wrap.classList.remove('is-visible'); wrap.innerHTML = ''; return; }
  let msg;
  if (historyEntry && questEntry) {
    msg = t('oneYearAgo.bothText');
  } else if (historyEntry) {
    const label = historyEntry.labelKey ? t(historyEntry.labelKey) : (historyEntry.label || '');
    msg = t('oneYearAgo.historyTemplate', { label: escapeHtml(label) });
  } else {
    msg = t('oneYearAgo.questTemplate', { text: escapeHtml(S.oneYearAgoTruncate(questEntry.text, 30)) });
  }
  wrap.innerHTML = '<span class="one-year-ago-text">' + msg + '</span>' +
    '<button type="button" class="one-year-ago-close-btn" aria-label="' + escapeHtml(t('oneYearAgo.dismissBtn')) + '"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>';
  wrap.classList.add('is-visible');
}

/* ================================================================
   📊 「実際の平均ペース」の提案
   ================================================================ */
function renderPaceSuggestion() {
  const wrap = els.paceSuggest;
  const textEl = els.paceSuggestText;
  const rangeEl = els.paceSuggestRange;
  if (!wrap || !textEl) return;
  const history = S.loadHistory();
  const rate = S.computeActualDailyRate(history);
  if (rate === null || rate <= 0) { wrap.style.display = 'none'; return; }
  textEl.innerHTML = t('pace.actualPaceLabelTemplate', { n: S.fmt(rate) });
  wrap.style.display = '';
  if (!rangeEl) return;

  const target = Math.max(0, parseFloat(els.target.value) || 0);
  const plannedUsage = Math.max(0, parseFloat(els.plannedUsage.value) || 0);
  const current = Math.max(0, parseFloat(els.current.value) || 0);
  const remaining = (target + plannedUsage) - current;
  const range = (target > 0 && remaining > 0) ? S.computeActualDailyRateRange(history) : null;
  if (range && range.min > 0 && range.max > 0) {
    const now = Date.now();
    const daysFast = Math.max(0, Math.ceil(remaining / range.max));
    const daysSlow = Math.max(0, Math.ceil(remaining / range.min));
    const dateFast = new Date(now + daysFast * 86400000);
    if (daysSlow <= daysFast) {
      rangeEl.textContent = t('pace.actualPaceRangeSingleTemplate', { date: S.jpDateShort(dateFast) });
    } else {
      const dateSlow = new Date(now + daysSlow * 86400000);
      rangeEl.textContent = t('pace.actualPaceRangeTemplate', { dateFast: S.jpDateShort(dateFast), dateSlow: S.jpDateShort(dateSlow) });
    }
    rangeEl.style.display = '';
  } else {
    rangeEl.style.display = 'none';
  }
}

/* ================================================================
   🧮 本体の計算・結果カード
   ================================================================ */
function update() {
  const target = Math.max(0, parseFloat(els.target.value) || 0);
  const plannedUsage = Math.max(0, parseFloat(els.plannedUsage.value) || 0);
  const current = Math.max(0, parseFloat(els.current.value) || 0);
  const globalDailyRate = Math.max(0, Math.min(25, parseInt(els.dailyRate.value, 10) || 0));
  const dailyRate = currentEffectiveDailyRate(globalDailyRate);
  const heartsToSend = Math.max(0, parseFloat(els.heartsToSend.value) || 0);

  const heartCost = heartsToSend * 3;
  const totalDaily = dailyRate - heartCost;

  const sliderPct = (globalDailyRate / 25) * 100;
  els.dailyRate.style.setProperty('--fill', sliderPct + '%');
  els.dailyRateReadout.textContent = t(globalDailyRate === 1 ? 'pace.dailyRateReadoutOne' : 'pace.dailyRateReadout', { n: globalDailyRate }) + (globalDailyRate === 20 ? t('pace.ashRouteNote') : '');
  els.finishTodayBtn.innerHTML = t(dailyRate === 1 ? 'pace.finishTodayBtnOne' : 'pace.finishTodayBtn', { n: dailyRate });
  els.finishTodayBtn.disabled = dailyRate <= 0;
  updateGoalPaceOverrideVisibility();

  const effectiveTarget = target + plannedUsage;
  const progressPct = effectiveTarget > 0 ? Math.min(100, (current / effectiveTarget) * 100) : 0;
  els.candleFill.style.height = progressPct + '%';

  const remaining = effectiveTarget - current;
  const usageNote = plannedUsage > 0 ? t(S.isOnePlural(plannedUsage) ? 'result.usageNoteOne' : 'result.usageNote', { amount: S.fmt(plannedUsage) }) : '';
  let html = '';
  const dailyLine = t(S.isOnePlural(totalDaily) ? 'result.dailyLineTemplateOne' : 'result.dailyLineTemplate', { n: S.fmt(totalDaily) }) +
    (heartCost > 0 ? t('result.dailyLineDetailTemplate', { gained: S.fmt(dailyRate), cost: S.fmt(heartCost), gainedUnit: t(dailyRate === 1 ? 'goal.unitOne' : 'goal.unit'), costUnit: t(S.isOnePlural(heartCost) ? 'goal.unitOne' : 'goal.unit') }) : '');

  let hasTargetDate = false;
  let targetDateObj = null;
  let requiredDailyPace = 0;
  if (els.targetDate.value && remaining > 0) {
    targetDateObj = new Date(els.targetDate.value + 'T23:59:59');
    if (!isNaN(targetDateObj.getTime())) {
      const msUntilTarget = targetDateObj.getTime() - new Date().getTime();
      if (msUntilTarget > 0) { hasTargetDate = true; requiredDailyPace = remaining / (msUntilTarget / 86400000); }
    }
  }

  if (target <= 0) {
    html = '<p class="state-message">' + t('result.enterTarget') + '</p>';
  } else if (remaining <= 0) {
    html =
      '<p class="state-message achieved">' + t('result.achieved') + '</p>' +
      '<p class="breakdown">' + t('result.achievedBreakdown', { current: S.fmt(current), target: S.fmt(effectiveTarget), usageNote, currentUnit: t(S.isOnePlural(current) ? 'goal.unitOne' : 'goal.unit'), targetUnit: t(S.isOnePlural(effectiveTarget) ? 'goal.unitOne' : 'goal.unit') }) + '</p>';
  } else if (hasTargetDate) {
    const isOnPace = dailyRate >= requiredDailyPace;
    const neededPaceClamped = Math.max(0, Math.min(25, Math.ceil(requiredDailyPace)));
    html =
      '<div class="hero-stat">' + t(S.isOnePlural(requiredDailyPace) ? 'result.heroDailyPaceTemplateOne' : 'result.heroDailyPaceTemplate', { n: S.fmt(requiredDailyPace) }) + '</div>' +
      '<p class="stat-line">' + t('result.paceNeededByTemplate', { date: S.jpDate(targetDateObj) }) + '</p>' +
      '<p class="stat-line">' + t(S.isOnePlural(remaining) ? 'result.remainingLineTemplateOne' : 'result.remainingLineTemplate', { remaining: S.fmt(remaining), usageNote }) + '</p>' +
      '<div class="target-date-box">' +
        t(dailyRate === 1 ? 'result.currentPaceLabelTemplateOne' : 'result.currentPaceLabelTemplate', { n: S.fmt(dailyRate) }) +
        '<span class="' + (isOnPace ? 'pace-ok' : 'pace-warn') + '">' +
        (isOnPace ? t('result.paceOk') : t(S.isOnePlural(requiredDailyPace - dailyRate) ? 'result.paceWarnTemplateOne' : 'result.paceWarnTemplate', { n: S.fmt(requiredDailyPace - dailyRate) })) +
        '</span>' +
        (isOnPace ? '' : '<br><button type="button" class="apply-required-pace-btn" id="nmApplyRequiredPaceBtn" data-pace="' + neededPaceClamped + '">' + t('result.applyRequiredPaceBtnTemplate', { n: neededPaceClamped }) + '</button>') +
      '</div>' +
      '<p class="breakdown">' + dailyLine + '<br>' + t('result.progressLineTemplate', { pct: Math.round(progressPct) }) + '</p>' +
      '<p class="note">' + t('result.footnoteTargetDate') + '</p>';
  } else if (totalDaily <= 0) {
    const warnMsg = heartCost > 0 ? t('result.warnHeart') : t('result.warnZero');
    html =
      '<p class="state-message warning">' + warnMsg + '</p>' +
      '<p class="breakdown">' + t(S.isOnePlural(remaining) ? 'result.remainingBreakdownTemplateOne' : 'result.remainingBreakdownTemplate', { remaining: S.fmt(remaining), usageNote, dailyLine }) + '</p>';
  } else {
    const daysNeeded = Math.ceil(remaining / totalDaily);
    const weeksNeeded = Math.floor(daysNeeded / 7);
    const estDate = new Date(Date.now() + daysNeeded * 86400000);
    const estDateValid = !isNaN(estDate.getTime());
    const goalDateLineHtml = estDateValid ? t('result.goalDateLineTemplate', { date: S.jpDate(estDate) }) : t('result.goalDateTooFarTemplate');
    html =
      '<div class="hero-stat">' + t(daysNeeded === 1 ? 'result.heroDaysTemplateOne' : 'result.heroDaysTemplate', { n: S.fmt(daysNeeded) }) + '</div>' +
      (weeksNeeded > 0 ? '<p class="stat-line">' + t(weeksNeeded === 1 ? 'result.aboutWeeksTemplateOne' : 'result.aboutWeeksTemplate', { n: S.fmt(weeksNeeded) }) + '</p>' : '') +
      '<p class="stat-line">' + goalDateLineHtml + '</p>' +
      '<p class="stat-line">' + t(S.isOnePlural(remaining) ? 'result.remainingLineTemplateOne' : 'result.remainingLineTemplate', { remaining: S.fmt(remaining), usageNote }) + '</p>' +
      '<p class="breakdown">' + dailyLine + '<br>' + t('result.progressLineTemplate', { pct: Math.round(progressPct) }) + '</p>' +
      '<p class="note">' + t('result.footnoteDaily') + '</p>';
  }

  els.resultContent.innerHTML = html;
  History.renderTrendChart();
  renderPaceSuggestion();
}

/* ================================================================
   💰 所持通貨との同期・所持本数欄の確定コミット
   ================================================================ */
function syncCurrentToSharedCurrency() {
  S.writeOwnedCandle(els.current.value);
}
function syncCommittedCurrent() {
  currentCommittedValue = Math.max(0, parseFloat(els.current.value) || 0);
}
function commitCurrentValue() {
  if (currentCommitTimer) { clearTimeout(currentCommitTimer); currentCommitTimer = null; }
  const newVal = Math.max(0, parseFloat(els.current.value) || 0);
  const delta = Math.round((newVal - currentCommittedValue) * 100) / 100;
  if (delta !== 0) {
    syncCurrentToSharedCurrency();
    recordHistory('history.entryManualEdit', delta);
    currentCommittedValue = newVal;
  }
}
function subtractEnteredAmount() {
  if (currentCommitTimer) { clearTimeout(currentCommitTimer); currentCommitTimer = null; }
  const amount = Math.max(0, parseFloat(els.subtractAmount.value) || 0);
  if (amount <= 0) return;
  const current = Math.max(0, parseFloat(els.current.value) || 0);
  const newVal = Math.max(0, Math.round((current - amount) * 100) / 100);
  const delta = Math.round((newVal - current) * 100) / 100;
  els.current.value = newVal;
  update();
  saveState();
  syncCurrentToSharedCurrency();
  recordHistory('history.entryManualSubtract', delta);
  syncCommittedCurrent();
  els.subtractAmount.value = '';
}

/* ================================================================
   ---- 目標日:カスタムカレンダーピッカー ----
   ================================================================ */
function formatDateValue(d) { return S.formatDateValue(d); }
function updateDateTriggerText() {
  if (els.targetDate.value) {
    const p = els.targetDate.value.split('-');
    const d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    els.datePickerTriggerText.textContent = S.jpDate(d);
    els.datePickerTrigger.classList.add('has-value');
  } else {
    els.datePickerTriggerText.textContent = t('goal.dateSelectPlaceholder');
    els.datePickerTrigger.classList.remove('has-value');
  }
}
function renderDatePickerGrid() {
  const year = datePickerViewDate.getFullYear();
  const month = datePickerViewDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = formatDateValue(new Date());
  const selectedStr = els.targetDate.value;
  els.datePickerMonthLabel.textContent = CURRENT_LANG === 'ja' ? (year + '年' + (month + 1) + '月') : (S.monthFullLabel(month) + ' ' + year);
  let html = '';
  for (let i = 0; i < firstWeekday; i++) html += '<span class="date-picker-cell is-empty"></span>';
  for (let d = 1; d <= daysInMonth; d++) {
    const cellStr = formatDateValue(new Date(year, month, d));
    const isPast = cellStr < todayStr;
    let cls = 'date-picker-cell';
    if (cellStr === selectedStr) cls += ' is-selected';
    if (cellStr === todayStr) cls += ' is-today';
    if (isPast) cls += ' is-past';
    html += '<button type="button" class="' + cls + '" data-date="' + cellStr + '"' + (isPast ? ' disabled' : '') + '>' + d + '</button>';
  }
  els.datePickerGrid.innerHTML = html;
}
function openDatePicker() {
  const p = els.targetDate.value ? els.targetDate.value.split('-') : null;
  datePickerViewDate = p ? new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, 1) : new Date();
  datePickerViewDate.setDate(1);
  renderDatePickerGrid();
  els.datePickerPopup.classList.add('is-open');
  els.datePickerTrigger.classList.add('is-active');
  els.datePickerTrigger.setAttribute('aria-expanded', 'true');
  const cardEl = els.datePickerEl.closest('.card');
  if (cardEl) cardEl.classList.add('has-open-popup');
}
function closeDatePicker() {
  els.datePickerPopup.classList.remove('is-open');
  els.datePickerTrigger.classList.remove('is-active');
  els.datePickerTrigger.setAttribute('aria-expanded', 'false');
  const cardEl = els.datePickerEl.closest('.card');
  if (cardEl) cardEl.classList.remove('has-open-popup');
}
function wireDatePicker() {
  els.datePickerTrigger.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (els.datePickerPopup.classList.contains('is-open')) closeDatePicker(); else openDatePicker();
  });
  els.datePickerPrevBtn.addEventListener('click', (ev) => { ev.stopPropagation(); datePickerViewDate.setMonth(datePickerViewDate.getMonth() - 1); renderDatePickerGrid(); });
  els.datePickerNextBtn.addEventListener('click', (ev) => { ev.stopPropagation(); datePickerViewDate.setMonth(datePickerViewDate.getMonth() + 1); renderDatePickerGrid(); });
  els.datePickerGrid.addEventListener('click', (ev) => {
    const cell = ev.target.closest ? ev.target.closest('.date-picker-cell') : null;
    if (!cell || cell.disabled || cell.classList.contains('is-empty')) return;
    els.targetDate.value = cell.getAttribute('data-date');
    els.targetDate.dispatchEvent(new Event('input', { bubbles: true }));
    updateDateTriggerText();
    closeDatePicker();
  });
  els.datePickerClearBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    els.targetDate.value = '';
    els.targetDate.dispatchEvent(new Event('input', { bubbles: true }));
    updateDateTriggerText();
    closeDatePicker();
  });
  onDocumentClickCloseDatePicker = (ev) => { if (!els.datePickerEl.contains(ev.target)) closeDatePicker(); };
  document.addEventListener('click', onDocumentClickCloseDatePicker);
}

/* ================================================================
   🗓️ 目標日クイックピック
   ================================================================ */
function activeRevisitEnd(schedule) {
  const now = new Date();
  let start, end;
  if (schedule.intervalDays) {
    const start0 = new Date(schedule.anchorStart);
    const end0 = new Date(schedule.anchorEnd);
    const intervalMs = schedule.intervalDays * 86400000;
    const k = Math.floor((now - start0) / intervalMs);
    start = new Date(start0.getTime() + k * intervalMs);
    end = new Date(start.getTime() + (end0 - start0));
  } else {
    start = new Date(schedule.start);
    end = new Date(schedule.end);
  }
  return (start <= now && now <= end) ? end : null;
}
function renderDateQuickPresets() {
  if (!els.dateQuickPresetsEl) return;
  const now = new Date();
  const presets = [];
  if (CURRENT_SEASON && CURRENT_SEASON.endDate && isSeasonStarted(CURRENT_SEASON)) {
    const seasonEnd = new Date(CURRENT_SEASON.endDate);
    if (!isNaN(seasonEnd.getTime()) && seasonEnd > now) presets.push({ label: t('goal.presetSeasonEnd'), dateStr: formatDateValue(seasonEnd) });
  }
  if (NEXT_UPDATE && NEXT_UPDATE.date) {
    const nu = new Date(NEXT_UPDATE.date);
    if (!isNaN(nu.getTime()) && nu > now) presets.push({ label: t('goal.presetNextUpdate'), dateStr: formatDateValue(nu) });
  }
  (EVENT_SCHEDULE || []).forEach((ev) => {
    const end = new Date(ev.end);
    const start = ev.start ? new Date(ev.start) : null;
    if (now <= end && (!start || now >= start) && end > now) {
      presets.push({ label: t('goal.presetEventEndTemplate', { name: trEvent(ev.name) }), dateStr: formatDateValue(end) });
    }
  });
  (REVISIT_SPIRIT_SCHEDULES || []).forEach((schedule) => {
    const end = activeRevisitEnd(schedule);
    if (end && end > now) presets.push({ label: t('goal.presetRevisitSpirit'), dateStr: formatDateValue(end) });
  });
  presets.push({ label: t('goal.presetOneWeek'), dateStr: formatDateValue(new Date(now.getTime() + 7 * 86400000)) });
  presets.push({ label: t('goal.presetTwoWeeks'), dateStr: formatDateValue(new Date(now.getTime() + 14 * 86400000)) });
  const oneMonthLater = new Date(now);
  const oneMonthLaterTargetDay = oneMonthLater.getDate();
  oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
  if (oneMonthLater.getDate() !== oneMonthLaterTargetDay) oneMonthLater.setDate(0);
  presets.push({ label: t('goal.presetOneMonth'), dateStr: formatDateValue(oneMonthLater) });

  els.dateQuickPresetsEl.innerHTML = presets.map((p) => '<button type="button" class="fill-current-btn date-quick-preset-btn" data-date="' + p.dateStr + '">' + escapeHtml(p.label) + '</button>').join('');
}

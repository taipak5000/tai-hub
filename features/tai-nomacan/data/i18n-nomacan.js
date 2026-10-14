/* ================================================================
   tai-nomacan（ノマキャン計算機）のツール固有i18n辞書。

   移植元: tai-nomacan/index.html の `var I18N = {...}`（~行1608-1975）。
   元の辞書は page/sidebar/dock/tools/header/profile/currency/dashboard/
   realm/backup/iconCustom/settings 等、taipak5000.github.io系ツール共通の
   「共有chrome」文言もまとめて持っていたが、tai-hub側の共有chrome
   （js/chrome/*.js）が既に自分自身の翻訳を持っているため、それらは意図的に
   移植せず（そのまま複製すると死んだコードになる）、このツール自身の機能
   （目標/ペース/結果/称号/獲得履歴/デイリークエスト記録）に関わる
   セクションと、他の移植済みツールと同様にページ末尾に表示するfooter
   （disclaimer/creditLabel/requestForm/infoLink、全ツール共通の固定文言）
   だけを残している：
     goal / goalMulti / pace / result / history / streak / dailyQuest /
     oneYearAgo / titles / footer
   各キーの ja/en 文言・テンプレート({n}等のプレースホルダー・単数/複数の
   …One版バリアント)は元の値を一切変更していない。

   t(key, vars) は元の実装の t(key, vars) と同じ挙動（'.'区切りのキーで
   辞書を辿り、現在言語→ja→空文字にフォールバックし、{varName}を置換する）。
   ================================================================ */
import { CURRENT_LANG } from '../../../js/i18n.js';

export const NOMA_I18N = {
  goal: {
    heading: { ja: '目標を設定', en: 'Set Your Goal' },
    targetLabel: { ja: '目標本数', en: 'Target Amount' },
    plannedUsageLabel: { ja: '使用予定本数(任意)', en: 'Planned Usage (optional)' },
    plannedUsageHint: { ja: '目標本数とは別に、近々何かに使う予定がある分があれば入力してください。必要本数の計算に加算されます。', en: 'If you have candles you plan to spend on something soon, separate from your goal, enter that amount here. It will be added to your required total.' },
    currentLabel: { ja: '所持本数', en: 'Current Amount' },
    fillCurrentBtn: { ja: '一日のペースから反映', en: 'Fill from Daily Pace' },
    fillCurrentBtnPace: { ja: '一日のペースから反映(+{n}本)', en: 'Fill from Daily Pace (+{n} candles)' },
    fillCurrentBtnPaceOne: { ja: '一日のペースから反映(+{n}本)', en: 'Fill from Daily Pace (+{n} candle)' },
    surveyBtn: { ja: 'アンケートに回答した(+3本)', en: 'Answered the Survey (+3 candles)' },
    questBtn: { ja: 'クエスト分(+4本)', en: 'Quest Reward (+4 candles)' },
    heartSentBtn: { ja: 'ハートを送った(-3本)', en: 'Sent a Heart (-3 candles)' },
    subtractAmountPlaceholder: { ja: '例: 10', en: 'e.g. 10' },
    subtractAmountBtn: { ja: 'その分を減らす', en: 'Subtract' },
    targetDateLabel: { ja: '目標日(任意)', en: 'Target Date (optional)' },
    unit: { ja: '本', en: 'candles' },
    unitOne: { ja: '本', en: 'candle' },
    targetPlaceholder: { ja: '例: 200', en: 'e.g. 200' },
    plannedUsagePlaceholder: { ja: '例: 50', en: 'e.g. 50' },
    currentPlaceholder: { ja: '例: 30', en: 'e.g. 30' },
    dateSelectPlaceholder: { ja: '日付を選択(任意)', en: 'Select a date (optional)' },
    prevMonth: { ja: '前の月', en: 'Previous month' },
    nextMonth: { ja: '次の月', en: 'Next month' },
    clearSelection: { ja: '選択をクリア', en: 'Clear selection' },
    defaultGoalName: { ja: '目標', en: 'Goal' },
    presetSeasonEnd: { ja: 'シーズン終了日', en: 'Season End' },
    presetNextUpdate: { ja: '次回アップデート日', en: 'Next Update' },
    presetEventEndTemplate: { ja: '{name}終了日', en: '{name} End' },
    presetRevisitSpirit: { ja: '再訪精霊の来訪終了日', en: 'Traveling Spirit Departure' },
    presetOneWeek: { ja: '1週間後', en: 'In 1 Week' },
    presetTwoWeeks: { ja: '2週間後', en: 'In 2 Weeks' },
    presetOneMonth: { ja: '1ヶ月後', en: 'In 1 Month' },
  },
  goalMulti: {
    barActiveSuffix: { ja: 'を編集中（タップで切替）', en: 'active (tap to switch)' },
    manageBtnTitle: { ja: '目標を管理', en: 'Manage goals' },
    modalTitle: { ja: '目標（複数目標管理）', en: 'Goals' },
    newNamePlaceholder: { ja: '新しい目標名', en: 'New goal name' },
    hint: { ja: '複数の目標を切り替えて管理できます。目標を切り替えると、目標本数・使用予定本数・目標日がその目標専用の内容に切り替わります(所持本数・集めペースはプロフィール共通ですが、集めペースは目標ごとに専用の値を設定することもできます)。', en: "Switch between multiple goals. Switching a goal swaps its target amount, planned usage, and target date (current amount and collection pace stay shared across the whole profile, though you can also set a pace just for an individual goal)." },
    deleteConfirmText: { ja: '「{name}」を削除しますか？この目標の目標設定も削除されます。', en: 'Delete "{name}"? This goal\'s target settings will also be deleted.' },
    moveUpBtnTitle: { ja: '上へ移動', en: 'Move up' },
    moveDownBtnTitle: { ja: '下へ移動', en: 'Move down' },
    duplicateBtnTitle: { ja: 'この目標を複製', en: 'Duplicate this goal' },
    duplicateNameTemplate: { ja: '{name}のコピー', en: '{name} (Copy)' },
    summaryNoTarget: { ja: '目標本数が未設定です', en: 'No target amount set' },
    summaryAchieved: { ja: '<svg class="inline-icon" width="13" height="13"><use href="#i-sparkle"/></svg> 達成済み', en: '<svg class="inline-icon" width="13" height="13"><use href="#i-sparkle"/></svg> Goal reached' },
    summaryRemainingTemplate: { ja: '残り{remaining}本（{pct}%）', en: '{remaining} candles left ({pct}%)' },
    summaryRemainingTemplateOne: { ja: '残り{remaining}本（{pct}%）', en: '{remaining} candle left ({pct}%)' },
    summaryDaysTemplate: { ja: ' ・あと約{n}日', en: ' · about {n} days left' },
    summaryDaysTemplateOne: { ja: ' ・あと約{n}日', en: ' · about {n} day left' },
    paceOverrideBadge: { ja: '<svg class="inline-icon" width="12" height="12"><use href="#nm-i-bolt"/></svg>専用{n}本/日', en: '<svg class="inline-icon" width="12" height="12"><use href="#nm-i-bolt"/></svg> {n}/day' },
  },
  pace: {
    heading: { ja: '1日の集めペース', en: 'Daily Collection Pace' },
    dailyRateLabel: { ja: '1日にだいたい集めている本数', en: 'Roughly how many candles you collect per day' },
    dailyRateHint: { ja: 'デイリークエストや光の収集などをこなした場合の、ざっくりした目安で大丈夫です。', en: 'A rough estimate is fine — based on completing daily quests, collecting light, and so on.' },
    dailyRateReadout: { ja: '{n}本', en: '{n} candles' },
    dailyRateReadoutOne: { ja: '{n}本', en: '{n} candle' },
    ashRouteNote: { ja: '（灰キャン）', en: ' (Ash Route)' },
    finishTodayBtn: { ja: '今日の分を集め終わった(+{n}本)', en: "Finished today's collection (+{n} candles)" },
    finishTodayBtnOne: { ja: '今日の分を集め終わった(+{n}本)', en: "Finished today's collection (+{n} candle)" },
    toggleTitle: { ja: '毎日ハートを送っている', en: 'Sending a Heart every day' },
    toggleSub: { ja: 'ハート1個につき、1日キャンドル3本消費', en: 'Each Heart costs 3 Candles/day' },
    heartsUnit: { ja: '本/日', en: 'candles/day' },
    actualPaceLabelTemplate: { ja: '獲得履歴から算出した実際の平均ペース: 約<b>{n}</b>本/日', en: 'Your actual average pace from history: about <b>{n}</b>/day' },
    useActualBtn: { ja: '実際のペースを使う', en: 'Use My Actual Pace' },
    actualPaceRangeTemplate: { ja: '最近のペースの振れ幅なら、{dateFast}〜{dateSlow}の間に届きそうです', en: 'At your recent pace, expect to reach it between {dateFast} and {dateSlow}' },
    actualPaceRangeSingleTemplate: { ja: '最近のペースはほぼ一定で、{date}頃に届きそうです', en: 'Your recent pace has been steady — expect to reach it around {date}' },
    overrideToggleTitle: { ja: 'この目標専用のペースを使う', en: 'Use a pace just for this goal' },
    overrideToggleSub: { ja: 'オフのままなら、上の共通ペースがそのまま使われます', en: 'Leave this off to keep using the shared pace above' },
    overridePlaceholder: { ja: '例: 20', en: 'e.g. 20' },
    overrideActiveHint: { ja: 'この目標の計算には、上のスライダーの代わりに1日{n}本が使われます', en: "This goal's calculations use {n}/day instead of the shared slider above" },
  },
  result: {
    heading: { ja: '結果', en: 'Result' },
    paceOnlyHeroTemplate: { ja: '1日 {n}<span class="unit-small">本</span>のペース', en: '{n}<span class="unit-small"> candles/day</span>' },
    paceOnlyHeroTemplateOne: { ja: '1日 {n}<span class="unit-small">本</span>のペース', en: '{n}<span class="unit-small"> candle/day</span>' },
    paceOnlyWeekTemplate: { ja: '1週間後: 約{n}本', en: 'In 1 week: ~{n} candles' },
    paceOnlyMonthTemplate: { ja: '1ヶ月後: 約{n}本', en: 'In 1 month: ~{n} candles' },
    paceOnlyNote: { ja: '※目標本数を入力すると、達成までの日数も表示されます', en: '*Enter a target amount to also see the days until you reach it' },
    enterTarget: { ja: '目標本数を入力すると、達成までの日数が表示されます。', en: 'Enter a target amount to see how many days until you reach your goal.' },
    achieved: { ja: '<svg class="inline-icon" width="15" height="15"><use href="#i-sparkle"/></svg> 目標本数を達成しています！', en: '<svg class="inline-icon" width="15" height="15"><use href="#i-sparkle"/></svg> You\'ve reached your target!' },
    achievedBreakdown: { ja: '所持 {current}本 ／ 必要 {target}本{usageNote}', en: 'Current {current} {currentUnit} / Needed {target} {targetUnit}{usageNote}' },
    usageNote: { ja: '（使用予定{amount}本を含む）', en: ' (includes {amount} candles planned for use)' },
    usageNoteOne: { ja: '（使用予定{amount}本を含む）', en: ' (includes {amount} candle planned for use)' },
    heroDailyPaceTemplate: { ja: '1日 {n}<span class="unit-small">本</span>', en: '{n}<span class="unit-small"> candles/day</span>' },
    heroDailyPaceTemplateOne: { ja: '1日 {n}<span class="unit-small">本</span>', en: '{n}<span class="unit-small"> candle/day</span>' },
    paceNeededByTemplate: { ja: '目標日　<strong>{date}</strong>までに必要なペース', en: 'Pace needed by <strong>{date}</strong>' },
    remainingLineTemplate: { ja: '残り　<strong>{remaining}</strong>本{usageNote}', en: 'Remaining: <strong>{remaining}</strong> candles{usageNote}' },
    remainingLineTemplateOne: { ja: '残り　<strong>{remaining}</strong>本{usageNote}', en: 'Remaining: <strong>{remaining}</strong> candle{usageNote}' },
    currentPaceLabelTemplate: { ja: '今のペース(1日{n}本)では　', en: 'At your current pace ({n} candles/day): ' },
    currentPaceLabelTemplateOne: { ja: '今のペース(1日{n}本)では　', en: 'At your current pace ({n} candle/day): ' },
    paceOk: { ja: '<svg class="inline-icon ok" width="13" height="13"><use href="#i-check"/></svg> 間に合う見込みです', en: '<svg class="inline-icon ok" width="13" height="13"><use href="#i-check"/></svg> On pace to make it in time' },
    paceWarnTemplate: { ja: '<svg class="inline-icon warn" width="13" height="13"><use href="#i-warning"/></svg> 1日{n}本足りません', en: '<svg class="inline-icon warn" width="13" height="13"><use href="#i-warning"/></svg> You\'re short by {n} candles/day' },
    paceWarnTemplateOne: { ja: '<svg class="inline-icon warn" width="13" height="13"><use href="#i-warning"/></svg> 1日{n}本足りません', en: '<svg class="inline-icon warn" width="13" height="13"><use href="#i-warning"/></svg> You\'re short by {n} candle/day' },
    applyRequiredPaceBtnTemplate: { ja: '1日{n}本のペースを設定に反映', en: 'Apply {n}/day to Your Settings' },
    dailyLineTemplate: { ja: '1日あたり {n}本', en: 'Per day: {n} candles' },
    dailyLineTemplateOne: { ja: '1日あたり {n}本', en: 'Per day: {n} candle' },
    dailyLineDetailTemplate: { ja: '　(獲得 {gained}本 − ハート消費 {cost}本)', en: ' (gained {gained} {gainedUnit} − Heart cost {cost} {costUnit})' },
    progressLineTemplate: { ja: '進捗 {pct}%', en: 'Progress {pct}%' },
    footnoteTargetDate: { ja: '※目標日までの残り日数をもとにした目安です。実際の日付とは前後する場合があります。', en: '*This is an estimate based on the remaining days until your target date. The actual date may differ.' },
    warnHeart: { ja: '1日の収支がプラスにならないため、目標に到達できません。<br>集める本数か、送るハートの本数を見直してください。', en: "Your daily balance isn't positive, so you won't reach your goal.<br>Review the amount you collect or the number of Hearts you send." },
    warnZero: { ja: '1日の獲得本数が0本のため計算できません。<br>集める本数のスライダーを見直してください。', en: "Your daily gain is 0 candles, so this can't be calculated.<br>Review the collection amount slider." },
    remainingBreakdownTemplate: { ja: '残り {remaining}本{usageNote}<br>{dailyLine}', en: 'Remaining {remaining} candles{usageNote}<br>{dailyLine}' },
    remainingBreakdownTemplateOne: { ja: '残り {remaining}本{usageNote}<br>{dailyLine}', en: 'Remaining {remaining} candle{usageNote}<br>{dailyLine}' },
    heroDaysTemplate: { ja: 'あと {n}<span class="unit-small">日</span>', en: '{n}<span class="unit-small"> more days</span>' },
    heroDaysTemplateOne: { ja: 'あと {n}<span class="unit-small">日</span>', en: '{n}<span class="unit-small"> more day</span>' },
    aboutWeeksTemplate: { ja: '（約{n}週間）', en: '(about {n} weeks)' },
    aboutWeeksTemplateOne: { ja: '（約{n}週間）', en: '(about {n} week)' },
    goalDateLineTemplate: { ja: '達成予定日　<strong>{date}</strong>頃', en: 'Estimated goal date: <strong>{date}</strong> (approx.)' },
    goalDateTooFarTemplate: { ja: '達成予定日　<strong>計算できないほど遠い未来です</strong>', en: 'Estimated goal date: <strong>too far in the future to estimate</strong>' },
    footnoteDaily: { ja: '※1日ごとの獲得ペースをもとにした目安です。実際の日付とは前後する場合があります。', en: '*This is an estimate based on your gain rate per day. The actual date may differ.' },
  },
  history: {
    heading: { ja: '獲得履歴', en: 'History' },
    note: { ja: '一日のペースからの反映・アンケート回答・クエスト分による増減を記録します(最大50件)。「取り消す」でその操作だけを元に戻せます。', en: 'Records increases and decreases from filling in from owned currency, survey answers, and quest rewards (up to 50 entries). Use "Undo" to revert just that one action.' },
    clearBtn: { ja: '履歴を全て消去', en: 'Clear all history' },
    empty: { ja: 'まだ履歴はありません。一日のペースからの反映・アンケート回答・クエスト分ボタンで記録されます。', en: 'No history yet. It will be recorded when you use the Fill from Owned Currency, Survey Answered, or Quest Reward buttons.' },
    emptyFiltered: { ja: 'この目標での履歴はまだありません。', en: 'No history yet for this goal.' },
    filterLabel: { ja: '表示する目標', en: 'Filter by goal' },
    filterAllOption: { ja: 'すべての目標', en: 'All goals' },
    undoBtn: { ja: '取り消す', en: 'Undo' },
    amountTemplate: { ja: '{sign}{n}本', en: '{sign}{n} candles' },
    amountTemplateOne: { ja: '{sign}{n}本', en: '{sign}{n} candle' },
    entryFillCurrent: { ja: '一日のペースから反映', en: 'Filled from daily pace' },
    entrySurvey: { ja: 'アンケート回答', en: 'Survey answered' },
    entryQuest: { ja: 'クエスト分', en: 'Quest reward' },
    entryHeartSent: { ja: 'ハートを送った', en: 'Sent a heart' },
    entryManualSubtract: { ja: '手動で減らした', en: 'Manually subtracted' },
    entryFinishToday: { ja: '今日の分を集め終わった', en: "Finished today's collection" },
    entryManualEdit: { ja: '本数を直接入力', en: 'Entered amount directly' },
    confirmClear: { ja: '獲得履歴をすべて消去します。よろしいですか？(所持本数自体は変わりません)', en: "This will clear all history. Are you sure? (Your current amount won't change.)" },
    trendEmpty: { ja: 'まだ十分な履歴がないため、グラフは表示できません。', en: 'Not enough history yet to show a chart.' },
    trendTargetLabel: { ja: '目標', en: 'Target' },
    trendYAxisLabel: { ja: '{n}本', en: '{n}' },
    trendAriaLabel: { ja: '所持本数の推移グラフ', en: 'Chart of your candle amount over time' },
  },
  streak: {
    activeTemplate: { ja: '<svg class="inline-icon" width="15" height="15"><use href="#nm-i-flame"/></svg> 連続{n}日目の記録中', en: '<svg class="inline-icon" width="15" height="15"><use href="#nm-i-flame"/></svg> Day {n} of your streak' },
    bestSuffixTemplate: { ja: '（最長 {n}日）', en: ' (Best: {n} days)' },
    bestSuffixTemplateOne: { ja: '（最長 {n}日）', en: ' (Best: {n} day)' },
    emptyText: { ja: '記録するとストリークが貯まります。今日の分を記録してみましょう。', en: 'Start recording to build a streak — try logging today\'s collection.' },
    heatmapLabel: { ja: '記録カレンダー(直近{weeks}週間)', en: 'Activity Calendar (last {weeks} weeks)' },
    heatmapAriaLabel: { ja: '連続記録日数のカレンダーヒートマップ', en: 'Calendar heatmap of your recording activity' },
    heatmapLegendEmpty: { ja: '未記録', en: 'No record' },
    heatmapLegendRecorded: { ja: '記録した日', en: 'Recorded day' },
    heatmapCellRecordedTemplate: { ja: '{date}：記録あり', en: '{date}: Recorded' },
    heatmapCellEmptyTemplate: { ja: '{date}：記録なし', en: '{date}: No record' },
  },
  dailyQuest: {
    heading: { ja: 'デイリークエスト記録', en: 'Daily Quest Log' },
    inputLabel: { ja: '今日やったデイリークエスト', en: "Today's daily quests" },
    inputPlaceholder: { ja: '例: 光の翼を集めた、キャンドルを配った、精霊と一緒に座った', en: 'e.g. Collected wax, gave candles, sat with a spirit' },
    inputHint: { ja: '今日終わらせたデイリークエストを自由に書き留めておけます。同じ日にもう一度保存すると、その日の内容が上書きされます。', en: "Jot down whatever daily quests you finished today, in your own words. Saving again on the same day overwrites that day's entry." },
    saveBtn: { ja: '今日の記録を保存', en: "Save Today's Log" },
    note: { ja: '保存すると1日ごとに1件、記録として残ります(最大50日分)。', en: "Saving keeps one entry per day (up to 50 days)." },
    streakEmptyText: { ja: '記録するとストリークが貯まります。今日やったデイリークエストを書いてみましょう。', en: "Start logging to build a streak — try writing down today's daily quests." },
    clearBtn: { ja: '記録を全て消去', en: 'Clear all logs' },
    confirmClear: { ja: 'デイリークエストの記録をすべて消去します。よろしいですか？', en: 'This will clear all daily quest logs. Are you sure?' },
    empty: { ja: 'まだ記録はありません。今日やったデイリークエストを書いて保存してみましょう。', en: "No logs yet. Try writing down today's daily quests and saving them." },
  },
  oneYearAgo: {
    historyTemplate: { ja: '<svg class="inline-icon" width="15" height="15"><use href="#i-sparkle"/></svg> 1年前の今日、獲得履歴に「{label}」を記録していました', en: '<svg class="inline-icon" width="15" height="15"><use href="#i-sparkle"/></svg> One year ago today, you logged "{label}" in your History' },
    questTemplate: { ja: '<svg class="inline-icon" width="15" height="15"><use href="#i-sparkle"/></svg> 1年前の今日、デイリークエストに「{text}」を記録していました', en: '<svg class="inline-icon" width="15" height="15"><use href="#i-sparkle"/></svg> One year ago today, you logged "{text}" in your Daily Quest Log' },
    bothText: { ja: '<svg class="inline-icon" width="15" height="15"><use href="#i-sparkle"/></svg> 1年前の今日、獲得履歴とデイリークエストの両方に記録していました', en: '<svg class="inline-icon" width="15" height="15"><use href="#i-sparkle"/></svg> One year ago today, you logged entries in both your History and your Daily Quest Log' },
    dismissBtn: { ja: '閉じる', en: 'Dismiss' },
  },
  titles: {
    heading: { ja: '称号', en: 'Titles' },
    countTemplate: { ja: '{earned} / {total} 個解除', en: '{earned} / {total} unlocked' },
    unlockedToastTemplate: { ja: '称号「{icon} {name}」を獲得しました！', en: 'Title unlocked: {icon} {name}!' },
    lockedName: { ja: '？？？', en: '？？？' },
    lockedHint: { ja: '称号は条件を満たすと明らかになります', en: 'Unlocks when you meet its condition' },
  },
  footer: {
    disclaimer: { ja: 'このサイトはSky 星を紡ぐ子どもたちの非公式ファンサイトです。thatgamecompanyは一切関与していません。', en: 'This is an unofficial fan site for Sky: Children of the Light. thatgamecompany is not involved in any way.' },
    creditLabel: { ja: '作成・ご意見:', en: 'Created by / feedback:' },
    requestForm: { ja: 'リクエストフォーム', en: 'Request form' },
    infoLink: { ja: '設定・クレジット・プライバシーポリシー', en: "Settings / Credits / Privacy Policy" },
  },
};

/* 元の t(key, vars) と同じ挙動（'.'区切りキーで辞書を辿り、現在言語→jaの
   フォールバック順に文字列を取り出し、{varName}をvars[varName]で置換する）。 */
export function t(key, vars) {
  const parts = key.split('.');
  let node = NOMA_I18N;
  for (const p of parts) node = node ? node[p] : undefined;
  let str = node ? (node[CURRENT_LANG] !== undefined ? node[CURRENT_LANG] : (node.ja !== undefined ? node.ja : '')) : '';
  if (vars) {
    Object.keys(vars).forEach((k) => { str = str.split('{' + k + '}').join(vars[k]); });
  }
  return str;
}

// {ja,en}形式のペア(TITLES の name/desc 等)から現在言語の値を取り出す(元のL()と同じ)。
export function L(pair) {
  if (!pair) return '';
  return pair[CURRENT_LANG] !== undefined ? pair[CURRENT_LANG] : pair.ja;
}

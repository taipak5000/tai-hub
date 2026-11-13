/* ================================================================
   star-candle（星のキャンドル計算機）のツール固有i18n辞書。

   移植元: star-candle/index.html の `var I18N = {...}`（~行2450-2782）。
   元の辞書は page/sidebar/tools/profile/currency/dashboard/backup/
   iconCustom/footer/header/settings/dock 等、taipak5000.github.io系
   ツール共通の「共有chrome」文言もまとめて持っていたが、tai-hub側の
   共有chrome（js/chrome/*.js）が既に自分自身の翻訳を持っているため、
   それらは意図的に移植せず（そのまま複製すると死んだコードになる）、
   このツール自身の機能に関わるセクションだけを残している：
     goal / weekly / consumption / result / notify / history /
     oneYearAgo / forecast / shardCal / titles / realm / misc
   （realmは着地レルム名の翻訳、miscはカウントダウン表示の「日」単位のみ。
   どちらもこのツール自身の描画でしか使わない）。
   各キーの ja/en 文言・テンプレート({n}等のプレースホルダー)は元の値を
   一切変更していない。

   t(key, vars) は元の実装の t(key, vars) と同じ挙動（'.'区切りのキーで
   辞書を辿り、現在言語→ja→空文字にフォールバックし、{varName}を置換する）。
   ================================================================ */
import { CURRENT_LANG } from '../../../js/i18n.js';

export const SC_I18N = {
  goal: {
    heading: { ja: '目標を設定', en: 'Set Your Goal' },
    targetLabel: { ja: '目標本数', en: 'Target Amount' },
    currentLabel: { ja: '所持本数', en: 'Current Amount' },
    targetDateLabel: { ja: '目標日(任意)', en: 'Target Date (optional)' },
    unit: { ja: '本', en: 'candles' },
    targetPlaceholder: { ja: '例: 60', en: 'e.g. 60' },
    currentPlaceholder: { ja: '例: 5', en: 'e.g. 5' },
    dateSelectPlaceholder: { ja: '日付を選択(任意)', en: 'Select a date (optional)' },
    prevMonth: { ja: '前の月', en: 'Previous month' },
    nextMonth: { ja: '次の月', en: 'Next month' },
    clearSelection: { ja: '選択をクリア', en: 'Clear selection' },
    presetSeasonEnd: { ja: 'シーズン終了日', en: 'Season End' },
    presetNextUpdate: { ja: '次回アップデート日', en: 'Next Update' },
    presetEventEndTemplate: { ja: '{name}終了日', en: '{name} End' },
    presetOneWeek: { ja: '1週間後', en: 'In 1 Week' },
    presetTwoWeeks: { ja: '2週間後', en: 'In 2 Weeks' },
    presetOneMonth: { ja: '1ヶ月後', en: 'In 1 Month' },
  },
  weekly: {
    heading: { ja: '週の集め方', en: 'Weekly Gains' },
    featherLabel: { ja: '原罪で配る羽の枚数', en: 'Feathers from Eye of Eden' },
    readout: { ja: '{n}枚 = {amount}本', en: '{n} feathers = {amount} candles' },
    addBtn: { ja: '＋ {amount}本を所持本数に加算', en: '+ Add {amount} candles to current amount' },
    shardSubHead: { ja: '闇の噴出(シャード)', en: 'Shard Eruptions' },
    predictTitle: { ja: '赤闇の自動予測(β)', en: 'Auto Red Shard Forecast (Beta)' },
    predictCountPrefix: { ja: '今後7日間で赤闇が来る日数：', en: 'Red Shard days in the next 7 days: ' },
    predictCountSuffix: { ja: '日', en: '' },
    calendarBtn: { ja: 'カレンダーで1か月分見る', en: 'View a Full Month in the Calendar' },
    note: { ja: 'コミュニティ観測による非公式の推測ルールです。実際とズレる場合があります。赤闇の報酬は着地場所ごとに最大値が決まっており(2〜3.5本)、闇の花をどれだけ燃やせたかによって最大値より少なくなることもあります。1日の報酬は1回までのため、候補時刻は「どれか1つで報酬確定」という意味です。', en: 'This is an unofficial rule inferred from community observation, and may not exactly match what happens in-game. Red Shard rewards have a maximum set by each landing spot (2–3.5 candles), and you may get less than that maximum depending on how much of the Dark Flower you managed to burn. Since you can only receive the reward once per day, the candidate times mean "any one of them confirms the reward."' },
    unaddedNote: { ja: '<svg class="inline-icon warn" width="14" height="14"><use href="#i-warning"/></svg> 前回の加算({lastDate})から{weeks}週間分、加算し忘れているかもしれません(目安 約{amount}本)', en: '<svg class="inline-icon warn" width="14" height="14"><use href="#i-warning"/></svg> It\'s been {weeks} week(s) since your last add ({lastDate}) — about {amount} candles may not be added yet' },
  },
  consumption: {
    heading: { ja: '週の消費', en: 'Weekly Consumption' },
    toggleTitle: { ja: 'リサイズドリンクを毎週購入する', en: 'Buy a Resize Drink every week' },
    toggleSub: { ja: '週1回・星のキャンドル8本で交換', en: 'Once a week, for 8 Star Candles' },
  },
  result: {
    heading: { ja: '結果', en: 'Result' },
    enterTarget: { ja: '目標本数を入力すると、達成までの週数が表示されます。', en: 'Enter a target amount to see how many weeks until you reach your goal.' },
    achieved: { ja: '<svg class="inline-icon" width="15" height="15"><use href="#i-sparkle"/></svg> 目標本数を達成しています！', en: '<svg class="inline-icon" width="15" height="15"><use href="#i-sparkle"/></svg> You\'ve reached your target!' },
    achievedBreakdown: { ja: '所持 {current}本 ／ 目標 {target}本', en: 'Current {current} candles / Target {target} candles' },
    warnDrink: { ja: '週の収支がプラスにならないため、目標に到達できません。<br>羽の枚数か、リサイズドリンクの購入設定を見直してください。', en: "Your weekly balance isn't positive, so you won't reach your goal.<br>Review your feather count or your Resize Drink setting." },
    warnZero: { ja: '週の獲得本数が0本のため計算できません。<br>羽の枚数を見直してください。', en: "Your weekly gain is 0 candles, so this can't be calculated.<br>Review your feather count." },
    remainingBreakdown: { ja: '残り {remaining}本<br>{weeklyLine}', en: 'Remaining {remaining} candles<br>{weeklyLine}' },
    weeklyLine: { ja: '週あたり {weekly}本', en: 'Per week: {weekly} candles' },
    weeklyLineDetail: { ja: '　(羽 {feathers}本 − リサイズドリンク {drink}本)', en: ' (feathers {feathers} candles − resize drink {drink} candles)' },
    actualPaceInline: { ja: '　(実績ペース　週{pace}本)', en: ' (recent actual pace: {pace}/week)' },
    paceNeededBy: { ja: '{date}までに必要なペース　<strong>週{pace}本</strong>', en: 'Pace needed by {date}: <strong>{pace} candles/week</strong>' },
    paceCoveredByShards: { ja: '{date}までに必要なペース　<strong>今後の赤闇の回収だけで到達見込み</strong>', en: 'Pace needed by {date}: <strong>upcoming Red Shards alone should get you there</strong>' },
    paceOk: { ja: '<svg class="inline-icon ok" width="13" height="13"><use href="#i-check"/></svg> 今のペースで間に合う見込みです', en: '<svg class="inline-icon ok" width="13" height="13"><use href="#i-check"/></svg> On pace to make it in time' },
    paceWarn: { ja: '<svg class="inline-icon warn" width="13" height="13"><use href="#i-warning"/></svg> 今のペースだと週{n}本足りません', en: '<svg class="inline-icon warn" width="13" height="13"><use href="#i-warning"/></svg> You\'re short by {n} candles/week at your current pace' },
    paceShardNote: { ja: '※未チェックの今後の赤闇をすべて回収する前提で計算しています(下の「達成予定日」の試算と同じ前提)。', en: "*Assumes you collect every upcoming Red Shard that isn't already checked off (same assumption as the estimated goal date below)." },
    shardEstimate: { ja: '今後の赤闇をすべて回収すると仮定した場合<br>達成予定日　<strong>{date}</strong>頃', en: 'Assuming you collect every future Red Shard<br>Estimated goal date: <strong>{date}</strong>' },
    heroPrefix: { ja: 'あと ', en: '' },
    heroSuffix: { ja: '週間', en: ' more weeks' },
    goalDateLine: { ja: '達成予定日　<strong>{date}</strong>頃', en: 'Estimated goal date: <strong>{date}</strong> (approx.)' },
    goalDateTooFar: { ja: '達成予定日　<strong>計算できないほど遠い未来です</strong>', en: 'Estimated goal date: <strong>too far in the future to estimate</strong>' },
    remainingLine: { ja: '残り　<strong>{remaining}本</strong>', en: 'Remaining: <strong>{remaining} candles</strong>' },
    progressLine: { ja: '{weeklyLine}<br>進捗 {pct}%', en: '{weeklyLine}<br>Progress {pct}%' },
    footnote: { ja: '※7日ごとの獲得ペースをもとにした目安です。実際の日付とは前後する場合があります。', en: '*This is an estimate based on your gain rate over each 7-day period. The actual date may differ.' },
    milestonesHeading: { ja: '節目までの目安（羽ペースのみ・赤闇は含まない）', en: 'Milestones (feather pace only, Red Shards not included)' },
    milestoneRowTemplate: { ja: '{pct}%（{at}本）まで あと{remaining}本 ・ あと{weeks}週間（{date}頃）', en: '{pct}% ({at} candles): {remaining} to go · {weeks} more week(s) (around {date})' },
    milestoneGoalRowTemplate: { ja: '達成（{at}本）まで あと{remaining}本 ・ あと{weeks}週間（{date}頃）', en: 'Goal ({at} candles): {remaining} to go · {weeks} more week(s) (around {date})' },
  },
  notify: {
    heading: { ja: '通知', en: 'Notifications' },
    shardTitle: { ja: '次の赤闇の着地前に通知', en: 'Notify before the next Red Shard lands' },
    shardSub: { ja: '着地の10分前にブラウザ通知でお知らせします', en: "We'll send a browser notification 10 minutes before it lands" },
    goalTitle: { ja: '達成予定日が近づいたら通知', en: 'Notify as the goal date approaches' },
    goalSub: { ja: '目標日(設定時)、または赤闇をすべて回収した場合の達成予定日の前日にお知らせします', en: "We'll notify you the day before your target date (if set), or before the estimated goal date assuming you collect every Red Shard" },
    note: { ja: '通知はこのタブ(ウィンドウ)を開いたままにしている間だけ届きます。閉じている・他のタブに切り替えている間の分は届きません。ブラウザで通知がブロックされている場合は、ブラウザ側のサイト設定から通知を許可してください。', en: "Notifications only arrive while this tab stays open — none will arrive while it's closed or backgrounded. If your browser is blocking notifications, allow them from your browser's site settings." },
    unsupported: { ja: 'お使いのブラウザは通知に対応していません。', en: "Your browser doesn't support notifications." },
    blocked: { ja: '<svg class="inline-icon warn" width="14" height="14"><use href="#i-warning"/></svg> ブラウザの通知がブロックされています。ブラウザ側のサイト設定から許可してください。', en: '<svg class="inline-icon warn" width="14" height="14"><use href="#i-warning"/></svg> Notifications are blocked by your browser. Allow them from your site settings.' },
    granted: { ja: '通知は許可されています。', en: 'Notifications are allowed.' },
    shardFireTitle: { ja: '🔮 まもなく赤闇が着地します', en: '🔮 A Red Shard is about to land' },
    shardFireBody: { ja: 'あと約{minutes}分で着地予定です。', en: 'Landing in about {minutes} minute(s).' },
    goalFireTitle: { ja: '🕯️ 達成予定日が近づいています', en: '🕯️ Your goal date is approaching' },
    goalFireBody: { ja: '達成予定日：{date}', en: 'Estimated goal date: {date}' },
  },
  history: {
    heading: { ja: '獲得履歴', en: 'History' },
    note: { ja: '羽ボタン・赤闇のチェックによる増減を記録します(最大50件)。「取り消す」でその操作だけを元に戻せます。', en: 'Records increases and decreases from the feather button and Red Shard checks (up to 50 entries). Use "Undo" to revert just that one action.' },
    clearBtn: { ja: '履歴を全て消去', en: 'Clear all history' },
    empty: { ja: 'まだ履歴はありません。羽ボタンや赤闇のチェックで記録されます。', en: 'No history yet. It will be recorded when you use the feather button or check off a Red Shard.' },
    undoBtn: { ja: '取り消す', en: 'Undo' },
    featherEntry: { ja: '羽 {n}枚', en: '{n} Feathers' },
    shardEntry: { ja: '赤闇 {day}', en: 'Red Shard {day}' },
    manualEntry: { ja: '手動編集', en: 'Manual edit' },
    confirmClear: { ja: '獲得履歴をすべて消去します。よろしいですか？(所持本数自体は変わりません)', en: "This will clear all history. Are you sure? (Your current amount won't change.)" },
    trendEmpty: { ja: 'まだ十分な履歴がないため、グラフは表示できません。', en: 'Not enough history yet to show a chart.' },
    trendTargetLabel: { ja: '目標', en: 'Target' },
    trendAriaLabel: { ja: '所持本数の推移グラフ', en: 'Chart of your candle amount over time' },
    paceLineLabel: { ja: '現在ペース', en: 'Current pace' },
    paceProjectionNote: { ja: '直近の実績ペースがこのまま続く場合、目標到達は{date}頃の見込みです。', en: "At your recent pace, you're on track to reach your target around {date}." },
    paceProjectionNone: { ja: '直近の実績では、今のペースのままだと目標到達の見込みが立ちません。', en: "Based on your recent history, you're not currently on pace to reach your target." },
  },
  oneYearAgo: {
    banner: { ja: '{years}年前の今日の記録があります({label} {sign}{amount}{unit})', en: "You have a record from {years} year(s) ago today ({label} {sign}{amount}{unit})" },
    closeAriaLabel: { ja: '閉じる', en: 'Close' },
  },
  forecast: {
    nextRedShard: { ja: '次の赤闇まで', en: 'Next Red Shard' },
    collected: { ja: '獲得済み', en: 'Collected' },
    timeUntilEnd: { ja: '終了まで残り', en: 'Time until end' },
    timeUntilLanding: { ja: '着地まで残り', en: 'Time until landing' },
    headerLanding: { ja: '着地', en: 'Landing' },
    headerEnd: { ja: '終了', en: 'End' },
    active: { ja: '進行中', en: 'Active' },
    maxReward: { ja: '最大{n}本', en: 'Max {n} candles' },
    candidatesPrefix: { ja: '候補 ', en: 'Candidates: ' },
    jstAnyOne: { ja: ' JST・いずれか1回', en: ' JST, any one confirms it' },
    nextNote: { ja: '日本時間(JST)基準・いずれか1回で報酬確定', en: 'Based on Japan time (JST) · Any one confirms the reward' },
    range: { ja: '今後7日間・日本時間(JST)基準', en: 'Next 7 days · Based on Japan time (JST)' },
    empty: { ja: '今後7日間、赤闇の予測はありません。', en: 'No Red Shard forecast for the next 7 days.' },
    error: { ja: '予測の計算中にエラーが発生しました。', en: 'An error occurred while calculating the forecast.' },
    realmLocationSep: { ja: '・', en: ' · ' },
    listSep: { ja: '・', en: ', ' },
    filterHighOnly: { ja: '<svg class="inline-icon" width="14" height="14"><use href="#i-gem"/></svg> 最高報酬(3.5本)の日だけ表示', en: '<svg class="inline-icon" width="14" height="14"><use href="#i-gem"/></svg> Show only max-reward days (3.5 candles)' },
    filterEmpty: { ja: '最高報酬の日は今後7日間にありません。', en: 'No max-reward days in the next 7 days.' },
  },
  shardCal: {
    title: { ja: '赤闇カレンダー', en: 'Red Shard Calendar' },
    legend: { ja: '赤闇が来る日(タップで詳細)', en: 'Days with a Red Shard (tap for details)' },
    maxRewardShort: { ja: '　最大{n}本', en: ' Max {n} candles' },
    candidatesLabel: { ja: '候補(着地→終了・JST) ', en: 'Candidates (landing → end, JST): ' },
  },
  titles: {
    heading: { ja: '称号', en: 'Titles' },
    countTemplate: { ja: '{earned} / {total} 個解除', en: '{earned} / {total} unlocked' },
    lockedTooltip: { ja: '称号は条件を満たすと明らかになります', en: 'Unlocks when you meet its condition' },
    unlockedToast: { ja: '称号「{icon} {name}」を獲得しました！', en: 'Title unlocked: {icon} {name}!' },
  },
  realm: {
    prairie: { ja: '草原', en: 'Prairie' },
    forest: { ja: '雨林', en: 'Forest' },
    valley: { ja: '峡谷', en: 'Valley' },
    wasteland: { ja: '捨てられた地', en: 'Wasteland' },
    vault: { ja: '書庫', en: 'Vault' },
  },
  // カウントダウン表示("N日 HH:MM:SS")の「日」単位のみ。ダッシュボードモーダル
  // (js/chrome/dash-modal.js)の dashboard.dayUnit と同じ文言だが、あちらは
  // 共有chrome側で完結しているためこちらでは重複を避けず独立して持つ。
  misc: {
    dayUnit: { ja: '日', en: 'd' },
  },
};

/* 元の t(key, vars) と同じ挙動（'.'区切りキーで辞書を辿り、現在言語→jaの
   フォールバック順に文字列を取り出し、{varName}をvars[varName]で置換する）。 */
export function t(key, vars) {
  const parts = key.split('.');
  let node = SC_I18N;
  for (const p of parts) node = node ? node[p] : undefined;
  let str = node ? (node[CURRENT_LANG] !== undefined ? node[CURRENT_LANG] : (node.ja !== undefined ? node.ja : '')) : '';
  if (vars) {
    Object.keys(vars).forEach((k) => { str = str.split('{' + k + '}').join(vars[k]); });
  }
  return str;
}

/* ================================================================
   companion（精霊同行ツール／Spirit Companion Tool）の tai-hub 移植版。
   公開面は mount(container, sub)/unmount() の2関数のみ（js/router.js から
   マウントされる）。sub（サブルート）は現状使わない（このツールに
   サブルートは無い）。

   移植元: companion/index.html（~9120行のスタンドアロンページ）。このツールは
   share と同じく、このプロジェクトの明示的な方針によりバニラJSではなく
   Vue 3（CDN読み込み・ビルドレス・Composition API）のまま移植する。
   元の #app に mount していた単一の createApp({ setup(){...} }) のうち、
   setup() 本体とそのテンプレート（<div id="app" class="container" v-cloak>）を、
   共有chrome（ヘッダーの言語セレクタ・プロフィールバー/モーダル・サイドバー・
   サイトドック・表示設定モーダル・データ引継ぎモーダル・ホーム画面アイコン
   モーダル・プロフィール比較モーダル・所持通貨セクション）を除いた
   「このツール自身」の部分だけに絞って移植した（features/share/share-view.js
   と同じ方針・同じカテゴライズ観点）。

   【共有chromeとのブリッジの扱い（share-view.jsと同じ考え方）】
     - テーマ切替（isDarkMode/themeMode/toggleTheme）→ remove。
       js/chrome/settings-modal.js（state.jsのtoggleTheme/getSkyThemeMode）が
       全ルート共通で提供済み。このツールのテンプレート自体はテーマ切替
       ボタンを持たない。
     - 言語切替（currentLang/setLang/SUPPORTED_LANGS、ヘッダーの<select>）→
       remove。js/i18n.jsのCURRENT_LANG（定数、切替はリロードを伴う）を
       直接読む非リアクティブなt()に置き換えた（他の移植済みツールと同じ
       方針）。4言語(ja/en/zh-TW/ko)あった元の辞書は、tai-hub全体の方針に
       合わせてja/enの2言語だけに絞っている（zh-TW/koの文言はこのポートでは
       扱わない）。
     - プロフィール（記録）バー・記録切替/追加/削除/リネーム/アカウントカラー・
       プロフィール比較モーダル・所持通貨セクション・データ引継ぎ
       （エクスポート/インポート/全削除）モーダル・ホーム画面アイコン
       カスタマイズモーダル → remove。tai-hub側の共有プロフィール機構
       （js/state.jsのensureProfilesInit/getActiveProfileId等、js/chrome/
       pf-modal.js）が全ルート共通で提供済み。データ保存は下記の通り
       nsKey()でプロフィール名前空間化するだけで、既存の共有プロフィール
       一覧（skyProfiles_v1）に自動的に参加する。
     - サイドバー（「他のツール」ドロワー）・サイトドック → remove。
       js/chrome/tools-drawer.js・js/chrome/site-dock.js が全ルート共通で
       提供済み。
     - 表示設定モーダル（ダークモード切替の第二導線・キーボードショート
       カットの有効/無効） → remove。js/chrome/settings-modal.jsが提供済み。
     - ダッシュボード（今日・今週・今月。カレンダー・デイリー予定・
       通知リマインダー） → features/shared/event-dashboard.js（このバッチで
       wingsをベースに切り出された共有モジュール）をmountする形に置き換えた。
       companion自身が持っていた「今日の連れ歩き記録」（ワンタップ記録・
       連続記録(ストリーク)・月間カレンダー・履歴一覧）はこのツール固有の
       機能のため、そのまま移植してダッシュボードモーダルの中に共有
       モジュールと並べて表示する（下記参照）。
   【状態・ストレージ】localStorage キー名・JSON形状は元実装と完全一致
   （nsKey()でプロフィール名前空間化）:
     - sky_companion_v4_data: {
         activeIndex, spirits, hasSeasonPass,
         ownedCandles, estimatedDailyCandles, optimizerPlan:{ids}, walkLog
       }
       （元実装にあった sharedNotes / sharedCalcFormula =「全精霊共通のメモ・計算」と、
       シーズン進捗のシェアカードは、利用者がいないため2026-10-14に機能ごと廃止した。
       保存済みの値は読み込まず、次回の保存で消える）
       spirits は4要素の配列（各 { id, name, walkDays, currentPreset,
       treeData:{tier1..4:[{id,type?,name,points,candles,checked,excluded,
       customLabel?,customImage?,firstUnlock?,noPoints?,firstBonus?,
       requiresSeasonPass?,isHeartGoal?,wrapRow?}]} }）。
     - sky_companion_oneyear_banner_dismissed_date: 'YYYY-MM-DD'文字列
       （このツール固有のバナー既読状態なのでnsKey化する）。
   元実装は「記録（データ）」という、プロフィールとは別軸の複数セーブ枠
   機構を自前で持っていた（sky_companion_v4_data__<id>という独自の接尾辞、
   skyProfiles_v1/skyActiveProfile_v1という*プロフィール*一覧キーを流用）。
   tai-hubは既にプロフィール機構でこれと同じ役割（複数セーブ枠の切替）を
   果たしているため、この独自の「記録」機構（records/activeRecordId/
   switchRecord/addRecord/deleteRecord/pfCompare*等）は移植せず、
   nsKey()一本に統一した。これにより、デフォルトプロフィールの既存
   ユーザーのデータ（サフィックス無しの生キー）はそのまま引き継がれるが、
   元サイトで「記録2」等の追加セーブ枠を作っていたユーザーの分（独自の
   __<id>サフィックス）はtai-hub側のプロフィール（__p_<id>サフィックス）
   とは別物として扱われる（自動移行はしない）。

   【意図的な簡略化（deviationsFromSourceにも記載）】
   - 上記の通りプロフィール比較・所持通貨・データ引継ぎ・ホーム画面アイコンの
     各モーダルは移植していない（chromeが肩代わり、または非該当のため）。
   - ダッシュボードの.icsカレンダー書き出しは、共有モジュール
     (event-dashboard.js)側にオプトインの実装が追加されたため、
     このツールもmount(el, {icsExport:true})で明示的に有効化して含めている
     （companion自身の元実装にも存在した機能）。
   - 4言語(ja/en/zh-TW/ko)だった文言をja/enの2言語に絞った。
   - アイコンは共有スプライト（js/icon-sprite.js）に無い分だけ、
     tai-nomacan/share等と同じ方式でこのファイル専用のローカルスプライト
     （cp-i-* プレフィックス）を追加注入している。
   ================================================================ */
import { CURRENT_LANG, RAW_LANG } from '../../js/i18n.js';
import { nsKey } from '../../js/state.js';
import * as eventDashboard from '../shared/event-dashboard.js';
import {
  TRANSLATIONS_ZH_TW, TRANSLATIONS_KO, NAME_ZH_TW, NAME_KO, TYPE_LABELS_ZH_TW, TYPE_LABELS_KO,
  FORECAST_TIER_LABELS_ZH_TW, FORECAST_TIER_LABELS_KO, FIRST_UNLOCK_SUFFIX_I18N, DATE_LOCALE_I18N,
} from './data/i18n-zh-ko.js';
import {
  createDefaultSpiritsData, TIER_TOTAL_OVERRIDES,
  CURRENT_SEASON_NAME, SEASON_START, SEASON_END,
} from './data/tree-data.js';

const STYLE_LINK_ID = 'companion-view-styles';
const ICON_SPRITE_ID = 'companion-icon-sprite';
const VUE_CDN_URL = 'https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.prod.js';
const DATA_KEY = 'sky_companion_v4_data';
const ONEYEAR_BANNER_DISMISS_KEY = 'sky_companion_oneyear_banner_dismissed_date';

/* ================================================================
   🌐 UI文言辞書（元のUI_TEXT（ja/en/zh-TW/ko）から、このポートで使う
   ja/enの2言語分だけを、元の文言・キー名のまま移植したもの）。
   {n}や{date}のようなプレースホルダーは第2引数で置換できる。
   ================================================================ */
const TRANSLATIONS = {
  ja: {
    app_title: 'Sky 精霊同行ポイント計算機',
    app_subtitle: '連れ歩き日数とアイテム交換の最適化シミュレーター',
    countdown_label: '終了まで', countdown_label_start: '開始まで', countdown_day_suffix: '日', countdown_ended: 'シーズン終了しました',
    countdown_jst_note: '※ 日本時間（JST）で表示しています',
    season_day_label: '本日はシーズン{current}日目（全{total}日間）',
    season_upcoming_label: 'シーズン開始前（全{total}日間）',

    dash_btn_title: '今日・今週・今月ダッシュボード',
    dash_title: '今日・今週・今月',
    dash_walk_label: '今日の連れ歩き記録',
    dash_walk_hint: 'どの精霊と歩いたか、ワンタップで記録できます（1日1回まで）',
    dash_walk_logged_pre: '今日は', dash_walk_logged_post: 'と記録しました',
    dash_walk_history_toggle: '最近の記録（{n}件）',
    dash_walk_streak_current: '現在の連続記録', dash_walk_streak_longest: '最長連続記録',
    dash_walk_cal_toggle: '今月のカレンダー',
    dash_walk_cal_month_label: '{year}年{month}月',
    dash_walk_cal_dow: '日,月,火,水,木,金,土',
    wr_title: '連れ歩きの記録',
    wr_today_done: '今日は{name}と記録済み',
    wr_today_todo: '今日はまだ記録していません',
    wr_streak_active: '連続{n}日目の記録中',
    wr_streak_best: '最長{n}日',
    wr_streak_empty: '記録するとストリークが貯まります',
    wr_log_today: '今日の記録：',
    wr_aria: '連れ歩き記録のカレンダー',
    wr_legend_empty: '未記録',
    wr_legend_recorded: '記録した日',
    wr_tap_hint: '日付をタップすると、過去の記録の追加・変更・削除ができます',
    wr_cell_recorded: '{date}：{name}と記録',
    wr_cell_empty: '{date}：記録なし',
    wr_date_label: '{m}月{d}日({dow})',
    wr_edit_title_date: '{y}年{m}月{d}日({dow})',
    wr_edit_recorded: '記録済み：{name}',
    wr_edit_none: 'この日は記録がありません',
    wr_edit_pick: '連れ歩いた精霊を選ぶ',
    wr_edit_delete: 'この日の記録を削除',
    wr_edit_close: '閉じる',
    wr_edit_hint: '追加・変更・削除に合わせて、連れ歩き日数のカウンターも増減します。',
    wr_month: '{m}月',
    dash_walk_cal_prev_title: '前の月', dash_walk_cal_next_title: '次の月',

    oneyear_banner_pre: '1年前の今日、', oneyear_banner_post: 'と歩きました',
    oneyear_dismiss_title: '閉じる',

    fc_title: '精霊ツリー（4体横並び比較）', fc_close: '閉じる', fc_open: '比較表を見る',
    fc_desc: '公開されたツリー画像をもとにした一覧表示です。数値は下の個別ツリーと連動しています。',
    fc_legend_magic: '魔法', fc_legend_walk: 'エモート', fc_legend_seasonal: '季節アイテム', fc_legend_dye: '染料',
    fc_legend_adpass: 'アドパス', fc_legend_heart: 'ハートと交換', fc_no_slot: '枠なし', fc_grand_total: '4体合計',
    fc_eta_done: '交換済み', fc_eta_ready: '今すぐ交換可能', fc_eta_days: 'あと{n}日', fc_eta_unreachable: '算出不可',

    mobile_owned: '所持', mobile_add_today: '（今日の分）',
    mobile_add_one_title: '集めきれなかった分などを1本ずつ調整できます',

    goal_hearts: 'シーズンハート獲得: {n} / 4 個', goal_complete_msg: 'おめでとうございます！全精霊のシーズンハートを獲得しました！',

    calc_adpass_label: 'アドパス', calc_pass_yes: 'あり（1日6本）', calc_pass_no: 'なし（1日5本）',
    calc_unit: '本', calc_owned_label: '所持本数', calc_day_unit: '日',
    est_daily_hint: '下の「おすすめプラン」「ハート最短シミュレーション」「交換順の計算」に共通で使われる見込み値です（デイリークエスト分＋普段の探索分の合計目安）。',

    plan_title: '効率的な進め方のおすすめ（4体分・魔法除く）', plan_close: '閉じる', plan_open: '開く',
    plan_all_done: '魔法以外のアイテムは4体ともすべて完了しています！',
    plan_today_reco: '今日のおすすめ', plan_walk_pre: '連れ歩き:', plan_walk_post: '（4体の中で最もポイントが低いため優先）',
    plan_walk_none: '連れ歩き: 対象精霊は全員280p到達済みです',
    plan_buy_now_pre: '今の所持数（', plan_buy_now_post: '本）で交換できるアイテム:',
    plan_buy_none: '今すぐ交換できるアイテムはありません（候補は未解放か、キャンドル不足です）',
    plan_item_open: '（', plan_item_close: '）',
    plan_overall_title: '4体全体の完了見込み', plan_unreachable: '現在のペースでは完了時期を見積もれませんでした。',
    plan_total_pre: 'このペースなら、あと', plan_total_post: '日で4体すべて完了する見込みです。',
    plan_log_toggle: '日別プランを見る（{n}日分）', plan_log_close: '閉じる', plan_log_open: '開く',
    plan_day_prefix: '', plan_day_suffix: '日目',
    plan_note: '※ 連れ歩きは「4体の中で最もポイントが低い精霊」を、交換は「ポイント効率の良いアイテム」を毎日優先する想定のシミュレーションです。アドパスアイテムは好きなタイミングで取得できるためプラン対象外です。実際の進め方の参考としてご利用ください。',

    tabs_complete: '完了',
    pts_progress_suffix: 'の進行度', pts_current_status: '現在の状態', pts_remaining_to_heart: 'ハートまでの残り',
    pts_congrats_label: 'おめでとうございます！', pts_congrats_rest: '必要ポイントを満たしました。',
    pts_advice_label: 'アドバイス:', pts_advice_pre: 'あと', pts_advice_day_unit: '日',
    pts_advice_post: '連れ歩けば、{n}pに到達します！',
    pts_advice_warn: '注意: 季節の残り日数を超えてしまうため、魔法などの追加交換が必要です。',
    pts_actual_compare: '実績: 記録した連れ歩き日数 {logged}日 ／ 現在のカウンター {counter}日',

    heart_title: '最短ハート交換シミュレーション', heart_done: 'すでにハートと交換済みです！',
    heart_unreachable: '現在の設定では見込みを計算できませんでした。連れ歩き日数やキャンドル所持数を確認してください。',
    heart_ready: 'ポイント・キャンドルともに、ハート交換の条件をすでに満たしています！',
    heart_plan_pre: '連れ歩き（毎日この精霊を選択）とキャンドル購入をこの精霊に集中させた場合、最短',
    heart_plan_day_unit: '日後', heart_plan_post: 'にハートと交換できる見込みです。',
    heart_total_cost_pre: 'ここから必要なキャンドル合計:', heart_total_cost_unit: '本',
    heart_total_cost_note_pre: '（ハート交換分', heart_total_cost_note_mid: 'を含む／現在の所持数', heart_total_cost_note_post: '本は別）',
    heart_pass_needed: 'ハートとの交換にはアドパスが必要です（現在: 未保有）。',
    heart_order_toggle: '交換の優先順位（ハート到達に必要な分のみ）', heart_order_close: '閉じる', heart_order_open: '見る',
    heart_order_day_suffix: '日目',
    heart_order_note: '※ 280p到達に不要なアイテム（例: 季節アイテム②など）は最短ルートでは省略されます。見た目も揃えたい場合は、そのアイテムも追加で交換してください。',
    heart_note: '※ 連れ歩きは1日1体までのため、他の精霊とも連れ歩きを分け合う場合はこの日数より遅くなります。キャンドルも他の精霊に使わずこの精霊に全て使った想定の最短見込みです。',
    heart_node_name: 'シーズンハート', heart_node_got: '獲得!',

    preset_custom: '自由入力', preset_no_magic: '魔法スルー', preset_reset: 'リセット',
    reset_all_btn: '全4体を一気にリセット',
    reset_all_confirm: '全4体のチェックと連れ歩き日数を、初期状態に戻します。よろしいですか？',
    reset_all_do: 'リセットする', reset_all_cancel: 'やめる', reset_all_done: '全4体をリセットしました',

    opt_title: '交換アイテムを取る順番の計算',
    opt_desc: '欲しいアイテムを優先順に登録すると、所持キャンドルと1日の獲得数から「いつ交換できるか」を上から順に計算し、シーズン終了日に間に合うかを表示します。',
    opt_select_placeholder: '― ツリーからアイテムを選ぶ ―', opt_add_btn: '追加',
    opt_daily_label: '1日の獲得キャンドル', opt_owned_note: '所持:',
    opt_empty: 'まだ登録がありません。上のリストから欲しいアイテムを追加してください。',
    opt_done: '交換済み', opt_now: '今すぐ交換可能', opt_unreachable: '獲得ペースが0のため到達できません',
    opt_est_suffix: 'ごろ', opt_within: 'シーズン内', opt_over: 'シーズン終了後', opt_cum: '累計',
    opt_total_pre: '合計', opt_total_unit: '本', opt_lack: '不足',
    opt_reachable_pre: 'シーズン内に交換できる見込み：', opt_reachable_post: '個',
    opt_reorder_hint: '→ 並び順を見直すと結果が変わります',
    opt_note: '※ 各層の解放に必要な累計ポイントは考慮していません。交換には該当する層の解放が必要です。',
    copy_plan_btn: 'プランをコピー', copy_success: 'コピーしました', copy_failed: 'コピーに失敗しました',

    shared_close: '閉じる', shared_open: '開く',

    walk_title_pre: '', walk_title_post: 'との連れ歩き（同行）日数', walk_unit: '/ 77 日',

    tree_title_pre: '', tree_title_post: 'のツリー', tree_right_col_note: '右列はポイント外',
    tree_remaining_pre: 'このツリーの残り:', tree_remaining_mid: '本（配った:',
    tree_remaining_excluded: '・除外:', tree_remaining_unit: '本', tree_remaining_post: '）',
    tree_pass_heart_label: 'ハートとの交換', tree_pass_frag1: '（', tree_pass_frag2: '）と、各層右列の',
    tree_pass_adpass_label: 'アドパスアイテム', tree_pass_frag3: 'は', tree_pass_holder_label: 'アドパス保有者のみ', tree_pass_frag4: '可能です',
    tree_pass_note_have: '（現在: 保有）',
    tree_pass_note_none: '（現在: 未保有 — 上の「アドパス」トグルで変更できます）',
    tree_pass_required: 'アドパスが必要です', tree_no_points: 'P外',
    tree_exclude_undo: '除外を解除', tree_exclude_do: '取りたくないアイテムとして除外',

    tier1_title: '第1層（基礎ティア）',
    status_complete: '完了！', status_tier4: '第4層', status_tier3: '第3層', status_tier2: '第2層', status_tier1: '第1層',
    tier2_title: '第2層（必要累計: 40p）', tier3_title: '第3層（必要累計: {n}p）', tier4_title: '第4層（必要累計: {n}p）',
    tier_unlocked: '解放完了', tier_remaining_pre: 'あと ', tier_remaining_post: 'p',

    info_title: '連れ歩きシステムの仕様メモ:',
    info_1: '・連れ歩きをしなくても、各層のアイテムをすべて取得すれば次の層へ進めます。',
    info_2: '・先にポイントを貯めて上の層を開放した後から、スルーしたアイテムを回収してもポイントは反映されます。',
    info_3: '・各アイテムのキャンドルコストは目安です。',

    footer_disclaimer: 'このサイトはSky 星を紡ぐ子どもたちの非公式ファンサイトです。thatgamecompanyは一切関与していません。',
    footer_credit_pre: '作成・ご意見:', footer_sources: '参考データ・画像引用元:',
    footer_source_season_spirit: '季節精霊 (Sky Wiki 日本語)',
    footer_source_van_gogh_ja: '親愛なるファン・ゴッホへ (Sky Wiki 日本語)',
    footer_source_van_gogh_en: 'Dear Van Gogh (Sky Wiki 英語)',
  },
  en: {
    app_title: 'Sky Spirit Companion Tracker',
    app_subtitle: 'A simulator for optimizing walk days and item exchanges',
    countdown_label: 'Ends in', countdown_label_start: 'Starts in', countdown_day_suffix: 'd', countdown_ended: 'Season has ended',
    countdown_jst_note: '※ Times shown are in Japan Standard Time (JST)',
    season_day_label: 'Day {current} of the season ({total} days total)',
    season_upcoming_label: 'Before the season starts ({total} days total)',

    dash_btn_title: 'Today / This Week / This Month Dashboard',
    dash_title: 'Today / This Week / This Month',
    dash_walk_label: "Today's Walk Log",
    dash_walk_hint: 'Tap once to record which spirit you walked with (once per day).',
    dash_walk_logged_pre: 'Logged a walk with ', dash_walk_logged_post: ' today',
    dash_walk_history_toggle: 'Recent entries ({n})',
    dash_walk_streak_current: 'Current Streak', dash_walk_streak_longest: 'Longest Streak',
    dash_walk_cal_toggle: "This Month's Calendar",
    dash_walk_cal_month_label: '{month}/{year}',
    dash_walk_cal_dow: 'Su,Mo,Tu,We,Th,Fr,Sa',
    wr_title: 'Walk Log',
    wr_today_done: 'Logged today: {name}',
    wr_today_todo: 'Not logged today',
    wr_streak_active: '{n}-day streak',
    wr_streak_best: 'Best: {n} days',
    wr_streak_empty: 'Log a walk to start a streak',
    wr_log_today: 'Log today:',
    wr_aria: 'Walk log calendar',
    wr_legend_empty: 'No record',
    wr_legend_recorded: 'Logged day',
    wr_tap_hint: 'Tap a day to add, change or delete a past record',
    wr_cell_recorded: '{date}: {name}',
    wr_cell_empty: '{date}: No record',
    wr_date_label: '{dow}, {m}/{d}',
    wr_edit_title_date: '{dow}, {y}/{m}/{d}',
    wr_edit_recorded: 'Logged: {name}',
    wr_edit_none: 'No record for this day',
    wr_edit_pick: 'Pick the spirit you walked with',
    wr_edit_delete: 'Delete this day’s record',
    wr_edit_close: 'Close',
    wr_edit_hint: 'The walk-day counter changes along with additions, changes and deletions.',
    wr_month: '{m}',
    dash_walk_cal_prev_title: 'Previous month', dash_walk_cal_next_title: 'Next month',

    oneyear_banner_pre: 'One year ago today, you walked with ', oneyear_banner_post: '.',
    oneyear_dismiss_title: 'Dismiss',

    fc_title: 'Spirit Trees (4-way comparison)', fc_close: 'Close', fc_open: 'View comparison',
    fc_desc: 'A reference list based on published tree images. Values are linked to the individual tree below.',
    fc_legend_magic: 'Spell', fc_legend_walk: 'Emote', fc_legend_seasonal: 'Seasonal Item', fc_legend_dye: 'Dye',
    fc_legend_adpass: 'Season Pass', fc_legend_heart: 'Trade for Heart', fc_no_slot: 'No slot', fc_grand_total: 'Total (all 4)',
    fc_eta_done: 'Done', fc_eta_ready: 'Ready now', fc_eta_days: '{n}d to go', fc_eta_unreachable: 'N/A',

    mobile_owned: 'Owned', mobile_add_today: " (today's)",
    mobile_add_one_title: "Adjust one at a time, e.g. if you couldn't collect the full amount",

    goal_hearts: 'Season Hearts Earned: {n} / 4', goal_complete_msg: "Congratulations! You've earned every spirit's Season Heart!",

    calc_adpass_label: 'Season Pass', calc_pass_yes: 'Yes (6/day)', calc_pass_no: 'No (5/day)',
    calc_unit: '', calc_owned_label: 'Candles currently owned', calc_day_unit: 'd',
    est_daily_hint: 'Used as a shared estimate by the plan, heart simulation, and purchase-order calculations below (a rough total including both the daily quest and regular exploration).',

    plan_title: 'Recommended efficient route (all 4 spirits, excluding Spells)', plan_close: 'Close', plan_open: 'Open',
    plan_all_done: 'Every non-Spell item is already complete for all 4 spirits!',
    plan_today_reco: "Today's recommendation", plan_walk_pre: 'Walk with:',
    plan_walk_post: ' (prioritized as the lowest-point spirit of the 4)',
    plan_walk_none: 'Walk: every spirit has already reached 280p',
    plan_buy_now_pre: 'Items you can trade for with your current candles (', plan_buy_now_post: '):',
    plan_buy_none: "No items can be traded for right now (candidates are either locked or you don't have enough candles)",
    plan_item_open: ' (', plan_item_close: ')',
    plan_overall_title: 'Overall completion estimate (all 4)', plan_unreachable: 'Could not estimate a completion date at the current pace.',
    plan_total_pre: 'At this pace, all 4 spirits should be complete in about ', plan_total_post: ' more day(s).',
    plan_log_toggle: 'View day-by-day plan ({n} day(s))', plan_log_close: 'Close', plan_log_open: 'Open',
    plan_day_prefix: 'Day ', plan_day_suffix: '',
    plan_note: "※ This simulation assumes you walk each day with whichever of the 4 spirits has the lowest points, and trade for the most point-efficient item available. Season Pass items can be collected anytime, so they're excluded from this plan. Use this as a rough guide.",

    tabs_complete: 'Done',
    pts_progress_suffix: "'s Progress", pts_current_status: 'Current Status', pts_remaining_to_heart: 'Remaining to Heart',
    pts_congrats_label: 'Congratulations!', pts_congrats_rest: "You've reached the points you need.",
    pts_advice_label: 'Tip:', pts_advice_pre: 'Walk together for', pts_advice_day_unit: 'more day(s)',
    pts_advice_post: 'to reach {n}p!',
    pts_advice_warn: "Note: this would exceed the days left in the season, so you'll need extra exchanges like Spells too.",
    pts_actual_compare: 'Actual: {logged} day(s) logged / current counter {counter} day(s)',

    heart_title: 'Fastest Heart Exchange Simulation', heart_done: 'Already traded for the Heart!',
    heart_unreachable: "Couldn't calculate an estimate with the current settings. Please check your walk days and candle count.",
    heart_ready: 'You already meet both the points and candles needed to trade for the Heart!',
    heart_plan_pre: 'If you focus all walking (choosing this spirit every day) and candle purchases on this spirit, you could trade for the Heart in as few as',
    heart_plan_day_unit: ' day(s)', heart_plan_post: '.',
    heart_total_cost_pre: 'Total candles needed from here:', heart_total_cost_unit: '',
    heart_total_cost_note_pre: ' (includes ', heart_total_cost_note_mid: ' for the Heart trade itself; your current', heart_total_cost_note_post: ' candles are separate)',
    heart_pass_needed: 'Trading for the Heart requires the Season Pass (currently: not owned).',
    heart_order_toggle: "Exchange priority order (only what's needed to reach the Heart)", heart_order_close: 'Close', heart_order_open: 'View',
    heart_order_day_suffix: 'd',
    heart_order_note: "※ Items not needed to reach 280p (e.g. Seasonal Item ② etc.) are skipped on the fastest route. If you also want to collect those for completeness, trade for them separately.",
    heart_note: '※ Since you can only walk with one spirit per day, this will take longer if you split walking time with other spirits too. This is the fastest-case estimate assuming all candles go to this spirit as well.',
    heart_node_name: 'Season Heart', heart_node_got: 'Got it!',

    preset_custom: 'Manual', preset_no_magic: 'Skip Spells', preset_reset: 'Reset',
    reset_all_btn: 'Reset all 4 at once',
    reset_all_confirm: 'This will reset the checks and walk days of all 4 spirits. Continue?',
    reset_all_do: 'Reset all', reset_all_cancel: 'Cancel', reset_all_done: 'Reset all 4 spirits',

    opt_title: 'Exchange Optimizer (purchase order planner)',
    opt_desc: 'Register the items you want in priority order. Using your owned candles and daily candle income, it estimates when each can be exchanged and whether it fits within the season.',
    opt_select_placeholder: '― Pick an item from the trees ―', opt_add_btn: 'Add',
    opt_daily_label: 'Candles per day', opt_owned_note: 'Owned:',
    opt_empty: 'Nothing registered yet. Add items you want from the list above.',
    opt_done: 'Exchanged', opt_now: 'Affordable now', opt_unreachable: 'Unreachable with a pace of 0',
    opt_est_suffix: '', opt_within: 'within season', opt_over: 'after season ends', opt_cum: 'cum.',
    opt_total_pre: 'Total', opt_total_unit: '', opt_lack: 'short',
    opt_reachable_pre: 'Expected within the season: ', opt_reachable_post: '',
    opt_reorder_hint: '→ Reordering may change the result',
    opt_note: '* Tier unlock points are not taken into account. Exchanging requires the corresponding tier to be unlocked.',
    copy_plan_btn: 'Copy Plan', copy_success: 'Copied', copy_failed: 'Copy failed',

    shared_close: 'Close', shared_open: 'Open',

    walk_title_pre: 'Days walked with', walk_title_post: '', walk_unit: '/ 77 days',

    tree_title_pre: '', tree_title_post: "'s Tree", tree_right_col_note: 'Right column is outside points',
    tree_remaining_pre: 'Remaining in this tree:', tree_remaining_mid: '(spent:',
    tree_remaining_excluded: '· excluded:', tree_remaining_unit: '', tree_remaining_post: 'candles)',
    tree_pass_heart_label: 'Trading for the Heart', tree_pass_frag1: ' (', tree_pass_frag2: ") and each tier's right-column ",
    tree_pass_adpass_label: 'Season Pass item', tree_pass_frag3: ' are only available to ', tree_pass_holder_label: 'Season Pass holders', tree_pass_frag4: '',
    tree_pass_note_have: ' (currently: owned)',
    tree_pass_note_none: ' (currently: not owned — change this with the Season Pass toggle above)',
    tree_pass_required: 'Requires the Season Pass', tree_no_points: 'No pts',
    tree_exclude_undo: 'Remove exclusion', tree_exclude_do: "Mark as an item you don't want",

    tier1_title: 'Tier 1 (Base Tier)',
    status_complete: 'Complete!', status_tier4: 'Tier 4', status_tier3: 'Tier 3', status_tier2: 'Tier 2', status_tier1: 'Tier 1',
    tier2_title: 'Tier 2 (cumulative required: 40p)', tier3_title: 'Tier 3 (cumulative required: {n}p)', tier4_title: 'Tier 4 (cumulative required: {n}p)',
    tier_unlocked: 'Unlocked', tier_remaining_pre: '', tier_remaining_post: 'p to go',

    info_title: 'Notes on how walking works:',
    info_1: "・You don't have to walk together to progress — collecting every item in a tier is enough to move on to the next.",
    info_2: '・Points still count even if you collect a skipped item later, after already unlocking a higher tier by earning points first.',
    info_3: "・Each item's candle cost is an estimate.",

    footer_disclaimer: 'This site is an unofficial fan site for Sky: Children of the Light. thatgamecompany is not involved in any way.',
    footer_credit_pre: 'Made by / feedback:', footer_sources: 'Reference data & image sources:',
    footer_source_season_spirit: 'Season Spirits (Sky Wiki Japanese)',
    footer_source_van_gogh_ja: 'Dear Van Gogh (Sky Wiki Japanese)',
    footer_source_van_gogh_en: 'Dear Van Gogh (Sky Wiki English)',
  },
};
// この精霊同行ツールだけは4言語(ja/en/zh-TW/ko)に対応する（js/i18n.jsのRAW_LANGを読む。
// 他のツールはja/enの2言語のまま）。繁體中文・한국어の文言は data/i18n-zh-ko.js
const LANG = RAW_LANG;
const ALL_TRANSLATIONS = { ...TRANSLATIONS, 'zh-TW': TRANSLATIONS_ZH_TW, ko: TRANSLATIONS_KO };
function t(key, vars) {
  const dict = ALL_TRANSLATIONS[LANG] || TRANSLATIONS.ja;
  let str = dict[key] !== undefined ? dict[key] : (TRANSLATIONS.ja[key] !== undefined ? TRANSLATIONS.ja[key] : key);
  if (vars) Object.keys(vars).forEach(k => { str = str.split('{' + k + '}').join(vars[k]); });
  return str;
}

/* ================================================================
   🌐 精霊名・アイテム名・季節名の英語訳（元のSPIRIT_NAME_EN/NAME_EN/
   TYPE_LABELS_EN/SEASON_NAME_EN/FIRST_UNLOCK_SUFFIX_I18Nをja/en版だけ移植）
   ================================================================ */
// 精霊名の英語訳。遥かなる真珠の季節の精霊の英語名は未収録（日本語名のまま表示）。
// 精霊名が決まったら「日本語名: 英語名」の形で追加する（未収録の名前はそのまま表示される）。
const SPIRIT_NAME_EN = {};
const NAME_EN = {
  'エモートLv3': 'Emote Lv3',
  '魔法③': 'Spell ③',
  '魔法④': 'Spell ④',
  '白染料': 'White Dye',
  '赤染料': 'Red Dye',
  '黄色染料': 'Yellow Dye',
  '黒染料': 'Black Dye',
  '青染料': 'Blue Dye',
  '水色染料': 'Cyan Dye',
  'アドパス魔法': 'Season Pass Spell',
  'アドパスエモートLv2': 'Season Pass Emote Lv2',
  'アドパスエモートLv4': 'Season Pass Emote Lv4',
  'アドパスアイテム': 'Season Pass Item',
  '♡ ハートと交換': '♡ Trade for Heart',
};
const TYPE_LABELS_JA = { walk: 'エモート', magic: '魔法', seasonal: '季節アイテム', dye: '染料' };
const TYPE_LABELS_EN = { walk: 'Emote', magic: 'Spell', seasonal: 'Seasonal Item', dye: 'Dye' };
// 「遥かなる真珠の季節」の公式の英語名は未確認のため、判明するまでは日本語名をそのまま表示する
// （判明したら、ここを英語名に差し替える）。
const SEASON_NAME_EN = CURRENT_SEASON_NAME;
const FIRST_UNLOCK_SUFFIX = FIRST_UNLOCK_SUFFIX_I18N[LANG] || ' (初回解放)';
function spiritNameOf(spirit) { return CURRENT_LANG === 'en' ? (SPIRIT_NAME_EN[spirit.name] || spirit.name) : spirit.name; }
const NAME_I18N = { en: NAME_EN, 'zh-TW': NAME_ZH_TW, ko: NAME_KO };
function translateItemName(str) { const m = NAME_I18N[LANG]; return m ? (m[str] || str) : str; }
const TYPE_LABELS = { en: TYPE_LABELS_EN, 'zh-TW': TYPE_LABELS_ZH_TW, ko: TYPE_LABELS_KO }[LANG] || TYPE_LABELS_JA;
// 日付表示のロケール（Intl.DateTimeFormat用）
const DATE_LOCALE = DATE_LOCALE_I18N[LANG] || 'ja-JP';
const CIRCLED_NUMS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];
const TYPE_ICONS = { walk: 'cp-i-tree-emote', magic: 'cp-i-tree-magic', seasonal: 'cp-i-tree-bloom', dye: 'cp-i-tree-dye' };
// 🖼️ 種別ごとのカスタム画像。魔法アイテムの渦巻きアイコンは全精霊共通の実機画像。
const TYPE_IMAGES = {
  walk: '',
  seasonal: '',
  magic: 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/2/28/Special-event-spell-icon.png/revision/latest/scale-to-width-down/51',
  adpass: '',
};

/* ================================================================
   🕓 デイリーリセット（太平洋時間0時）関連ヘルパー。「本日はシーズン
   何日目か」の表示にのみ使う（companion/index.htmlのpacificWallClock/
   pacificDayNumber/countDailyResetsUntilを完全移植）。
   ================================================================ */
function pacificWallClock(tm) { return new Date(tm.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })); }
// 🕓 fromTimeより後〜untilTime以前に発生するデイリーリセット（太平洋時間0時）の回数を数える。
// 太平洋時間の「日付」の差がそのまま回数になる（「最初のリセット＋24時間刻み」で数えると、
// 開始がちょうどリセット時刻の時に初日が2日目になったり、夏時間終了をまたぐと1日多く数える）。
function pacificDayNumber(tm) {
  const w = pacificWallClock(tm);
  return Math.round(Date.UTC(w.getFullYear(), w.getMonth(), w.getDate()) / 86400000);
}
function countDailyResetsUntil(fromTime, untilTime) {
  return Math.max(0, pacificDayNumber(untilTime) - pacificDayNumber(fromTime));
}
function pfLocalDateStr(d = new Date()) {
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}
function dayNumFromDateStr(s) {
  const [y, m, d] = s.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}
function pad2(n) { return String(n).padStart(2, '0'); }
function fmtNum(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 0 });
}

/* ================================================================
   🖼️ スタイル・ローカルアイコンスプライトの注入（初回のみ）
   ================================================================ */
function injectStylesheet() {
  if (document.getElementById(STYLE_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_LINK_ID;
  link.rel = 'stylesheet';
  link.href = new URL('../../css/companion.css', import.meta.url).href;
  document.head.appendChild(link);
}

// 共有スプライト(js/icon-sprite.js)には無いアイコンだけを、衝突しない
// 専用プレフィックス(cp-i-*)でこのツール専用に追加する。cp-i-tree-*の7個は
// 元のcompanion/index.htmlが持っていた「ic-*」ローカルスプライト（ツリーの
// アイテム種別バッジ用、viewBox 0 0 100 100）をそのまま移植したもの、
// 残り3個（clock/chevron-down/footprint）は共有スプライトに無い汎用アイコン。
const CP_SPRITE_HTML = `
<svg id="${ICON_SPRITE_ID}" style="position:absolute;width:0;height:0;overflow:hidden;" aria-hidden="true"><defs>
<symbol id="cp-i-tree-candle" viewBox="0 0 100 100">
  <rect x="33" y="40" width="34" height="52" rx="7" fill="currentColor"/>
  <rect x="45" y="30" width="10" height="14" fill="currentColor" opacity="0.75"/>
  <path d="M50 4c10 13 10 22 0 29-10-7-10-16 0-29z" fill="#ffb020"/>
</symbol>
<symbol id="cp-i-tree-magic" viewBox="0 0 100 100">
  <mask id="cp-i-tree-magic-moonmask">
    <rect width="100" height="100" fill="#fff"/>
    <circle cx="46.8" cy="40.8" r="9.2" fill="#000"/>
  </mask>
  <path d="M 50 12 C 53.83 12 53.69 29.04 60 32.68 C 66.31 36.32 80.99 27.68 82.91 31 C 84.83 34.32 70 42.72 70 50 C 70 57.28 84.83 65.68 82.91 69 C 80.99 72.32 66.31 63.68 60 67.32 C 53.69 70.96 53.83 88 50 88 C 46.17 88 46.31 70.96 40 67.32 C 33.69 63.68 19.01 72.32 17.09 69 C 15.17 65.68 30 57.28 30 50 C 30 42.72 15.17 34.32 17.09 31 C 19.01 27.68 33.69 36.32 40 32.68 C 46.31 29.04 46.17 12 50 12 Z" fill="var(--magic-star-fill)"/>
  <circle cx="41" cy="45" r="10.5" fill="var(--magic-star-accent)" mask="url(#cp-i-tree-magic-moonmask)"/>
  <circle cx="57" cy="42" r="2.4" fill="var(--magic-star-accent)"/>
  <circle cx="62.5" cy="47" r="1.6" fill="var(--magic-star-accent)"/>
  <circle cx="59" cy="52.5" r="1.2" fill="var(--magic-star-accent)"/>
</symbol>
<symbol id="cp-i-tree-emote" viewBox="0 0 100 100">
  <circle cx="49" cy="27" r="13" fill="currentColor"/>
  <path d="M49 43c-15 0-23 13-21 37h13l2-21 6 15 6-15 2 21h13c2-24-6-37-21-37z" fill="currentColor"/>
  <path d="M64 35c9-3 16-12 15-20" stroke="currentColor" stroke-width="6.5" fill="none" stroke-linecap="round"/>
</symbol>
<symbol id="cp-i-tree-bloom" viewBox="0 0 100 100">
  <g fill="currentColor">
    <ellipse cx="50" cy="27" rx="10.5" ry="17" transform="rotate(0 50 50)"/>
    <ellipse cx="50" cy="27" rx="10.5" ry="17" transform="rotate(72 50 50)"/>
    <ellipse cx="50" cy="27" rx="10.5" ry="17" transform="rotate(144 50 50)"/>
    <ellipse cx="50" cy="27" rx="10.5" ry="17" transform="rotate(216 50 50)"/>
    <ellipse cx="50" cy="27" rx="10.5" ry="17" transform="rotate(288 50 50)"/>
  </g>
  <circle cx="50" cy="50" r="11" fill="#ffd76a"/>
</symbol>
<symbol id="cp-i-tree-dye" viewBox="0 0 100 100">
  <path d="M50 10C50 10 21 47 21 67a29 29 0 0 0 58 0c0-20-29-57-29-57z" fill="currentColor"/>
  <ellipse cx="39" cy="63" rx="6.5" ry="10" fill="rgba(255,255,255,0.4)"/>
</symbol>
<symbol id="cp-i-tree-heart" viewBox="0 0 100 100">
  <path d="M50 88C18 64 6 43 6 26 6 11 19 1 34 1c8 0 14 4.5 16 11 2-6.5 8-11 16-11 15 0 28 10 28 25 0 17-12 38-44 62z" fill="currentColor"/>
</symbol>
<symbol id="cp-i-tree-sparkle" viewBox="0 0 100 100">
  <path d="M50 16 L59 41 L84 50 L59 59 L50 84 L41 59 L16 50 L41 41 Z" fill="currentColor"/>
</symbol>
<symbol id="cp-i-clock" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.167) translate(-12 -12)"><path d="M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Z"/><path d="M12 8.2V12.3l3 1.8"/></g></symbol>
<symbol id="cp-i-chevron-down" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.458) translate(-12 -12)"><path d="M6 9l6 6-6 6"/></g></symbol>
<symbol id="cp-i-footprint" viewBox="0 0 24 24"><path d="M9 4c-2 0-3.2 2-3.2 4.5S7 13 9 13s3.2-2 3.2-4.5S11 4 9 4Z"/><path d="M15.3 10.2c-1.9 0-2.9 1.8-2.9 4s1 4.8 2.9 4.8 2.9-2.6 2.9-4.8-1-4-2.9-4Z"/></symbol>
</defs></svg>`;
function injectLocalIconSprite() {
  if (document.getElementById(ICON_SPRITE_ID)) return;
  document.body.insertAdjacentHTML('afterbegin', CP_SPRITE_HTML);
}

/* ================================================================
   Vue 3 (CDN) の遅延読み込み（share-view.jsと同じパターン）
   ================================================================ */
let vueLoadPromise = null;
function ensureVue() {
  if (window.Vue) return Promise.resolve();
  if (!vueLoadPromise) {
    vueLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = VUE_CDN_URL;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('[companion] Vueの読み込みに失敗しました'));
      document.head.appendChild(script);
    });
  }
  return vueLoadPromise;
}

/* ================================================================
   テンプレート（元index.htmlの#app内、共有chrome部分を除いた本体のみ）
   ================================================================ */
const TEMPLATE = `
<div class="companion-view" v-cloak>
  <header>
    <h1><svg class="inline-icon" width="20" height="20" style="vertical-align:-3px;"><use href="#i-sparkle"/></svg> {{ t('app_title') }}</h1>
    <div class="subtitle">{{ t('app_subtitle') }}</div>
    <div class="season-info-badge">
      <strong>{{ seasonNameDisplay }}</strong>
      <span class="season-info-dates">{{ seasonStartText }} 〜 {{ seasonEndText }}</span>
      <div class="season-day-badge" v-if="seasonCountdown.phase !== 'before'">{{ t('season_day_label', { current: seasonDayInfo.current, total: seasonDayInfo.total }) }}</div>
      <div class="season-day-badge" v-else>{{ t('season_upcoming_label', { total: seasonDayInfo.total }) }}</div>
      <div class="season-countdown" :class="{ 'is-ended': seasonCountdown.ended, 'is-upcoming': seasonCountdown.phase === 'before' }">
        <template v-if="!seasonCountdown.ended">
          <span class="season-countdown-label"><svg class="inline-icon" width="11" height="11"><use href="#cp-i-clock"/></svg> {{ seasonCountdown.phase === 'before' ? t('countdown_label_start') : t('countdown_label') }}</span>
          <span class="season-countdown-value">
            <span class="cd-days">{{ seasonCountdown.days }}<i>{{ t('countdown_day_suffix') }}</i></span>
            <span class="cd-time">{{ pad2(seasonCountdown.hours) }}:{{ pad2(seasonCountdown.minutes) }}:{{ pad2(seasonCountdown.seconds) }}</span>
          </span>
          <span class="season-countdown-note">{{ t('countdown_jst_note') }}</span>
        </template>
        <template v-else>
          <span class="season-countdown-label">{{ t('countdown_ended') }}</span>
        </template>
      </div>
    </div>
  </header>

  <!-- 🎉 「1年前の今日」通知バナー -->
  <div v-if="showOneYearAgoBanner" class="oneyear-banner">
    <span class="oneyear-banner-text">{{ t('oneyear_banner_pre') }}<b>{{ oneYearAgoSpiritName }}</b>{{ t('oneyear_banner_post') }}</span>
    <button type="button" class="oneyear-banner-close" :title="t('oneyear_dismiss_title')" :aria-label="t('oneyear_dismiss_title')" @click="dismissOneYearAgoBanner"><span class="icon-chip" style="width:22px; height:22px;"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></span></button>
  </div>

  <!-- 📅 今日・今週・今月ダッシュボードを開くボタン -->
  <button type="button" class="dash-entry-btn" @click="openDashboardModal">
    <svg class="inline-icon" width="15" height="15"><use href="#i-calendar"/></svg> {{ t('dash_btn_title') }}
  </button>

  <!-- ═══ 🗓️ ダッシュボード（今日・今週・今月） ═══ -->
  <div class="modal-overlay" ref="dashOverlayEl" @click.self="closeDashboardModal">
    <div class="modal-card">
      <button type="button" class="modal-close-btn" @click="closeDashboardModal"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      <div class="modal-title">{{ t('dash_title') }}</div>

      <div ref="edbBodyEl"></div>

      <div class="dash-section">
        <p class="dash-section-label">{{ t('dash_walk_label') }}</p>
        <div class="dash-row" v-if="hasLoggedWalkToday" style="background:rgba(52,197,89,0.08); color:var(--success-text);">
          <span class="dash-row-icon"><svg class="inline-icon ok" width="13" height="13"><use href="#i-check"/></svg></span>
          <span class="dash-row-text">{{ t('dash_walk_logged_pre') }}<b>{{ todayWalkLogSpiritName }}</b>{{ t('dash_walk_logged_post') }}</span>
        </div>
        <template v-else>
          <p class="pf-hint" style="margin:0 0 8px;">{{ t('dash_walk_hint') }}</p>
          <div class="preset-group">
            <button type="button" class="btn-sm" v-for="spirit in spirits" :key="spirit.id" @click="logTodayWalk(spirit.id)">{{ spiritName(spirit) }}</button>
          </div>
        </template>
        <div class="stats-grid" style="margin-top:10px;">
          <div class="stat-box">
            <div style="font-size: 11px; color: var(--text-gray);">{{ t('dash_walk_streak_current') }}</div>
            <div class="stat-val" style="color: var(--accent-orange);">{{ currentWalkStreak }} <span style="font-size: 12px; font-weight: normal; color: var(--text-gray);">{{ t('calc_day_unit') }}</span></div>
          </div>
          <div class="stat-box">
            <div style="font-size: 11px; color: var(--text-gray);">{{ t('dash_walk_streak_longest') }}</div>
            <div class="stat-val" style="color: var(--accent-blue);">{{ longestWalkStreak }} <span style="font-size: 12px; font-weight: normal; color: var(--text-gray);">{{ t('calc_day_unit') }}</span></div>
          </div>
        </div>
        <div style="margin-top:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" @click="showWalkCalendar = !showWalkCalendar">
            <span style="font-size:10.5px; color:var(--text-gray); font-weight:bold;">{{ t('dash_walk_cal_toggle') }}</span>
            <span style="font-size:10.5px; color:var(--text-gray); font-weight:bold;">{{ showWalkCalendar ? t('shared_close') : t('shared_open') }}</span>
          </div>
          <div v-if="showWalkCalendar">
            <div class="walk-cal-nav-row">
              <button type="button" class="walk-cal-nav-btn" :title="t('dash_walk_cal_prev_title')" @click="walkCalendarPrevMonth">‹</button>
              <span class="walk-cal-month-label">{{ walkCalendarLabel }}</span>
              <button type="button" class="walk-cal-nav-btn" :title="t('dash_walk_cal_next_title')" @click="walkCalendarNextMonth">›</button>
            </div>
            <div class="walk-cal-grid">
              <div v-for="dow in walkCalendarDowLabels" :key="'dow'+dow" class="walk-cal-dow">{{ dow }}</div>
              <div v-for="cell in walkCalendarDays" :key="cell.key" class="walk-cal-day" :class="{ 'is-padding': cell.isPadding, 'has-log': cell.hasLog, 'is-today': cell.isToday }">{{ cell.isPadding ? '' : cell.day }}</div>
            </div>
          </div>
        </div>
        <div v-if="walkLog.length" style="margin-top:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" @click="showWalkHistory = !showWalkHistory">
            <span style="font-size:10.5px; color:var(--text-gray); font-weight:bold;">{{ t('dash_walk_history_toggle', { n: walkLog.length }) }}</span>
            <span style="font-size:10.5px; color:var(--text-gray); font-weight:bold;">{{ showWalkHistory ? t('shared_close') : t('shared_open') }}</span>
          </div>
          <div v-if="showWalkHistory" class="multi-spirit-log">
            <div v-for="(entry, idx) in walkLogDisplay" :key="idx" class="multi-spirit-log-row">
              <span class="msl-day">{{ entry.date }}</span>
              <span><svg class="inline-icon" width="11" height="11"><use href="#cp-i-footprint"/></svg> {{ entry.spiritNameDisplay }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>


  <!-- 📅 連れ歩きの記録カード: 記録できているか・毎日続いているかを一目で分かるように、メイン画面に常時表示する。
       日付のマスをタップすると、過去の記録の追加・変更・削除ができる（連れ歩き日数カウンターも連動） -->
  <div class="wr-card">
      <div class="wr-head">
          <span class="wr-title">{{ t('wr_title') }}</span>
          <span class="wr-today" :class="{ done: hasLoggedWalkToday }">{{ hasLoggedWalkToday ? t('wr_today_done', { name: todayWalkLogSpiritName }) : t('wr_today_todo') }}</span>
      </div>
      <div class="wr-strip">
          <span v-if="currentWalkStreak > 0" class="wr-streak">{{ t('wr_streak_active', { n: currentWalkStreak }) }}</span>
          <span v-else>{{ t('wr_streak_empty') }}</span>
          <span v-if="longestWalkStreak > 0 && longestWalkStreak !== currentWalkStreak">{{ t('wr_streak_best', { n: longestWalkStreak }) }}</span>
      </div>
      <div v-if="!hasLoggedWalkToday" class="wr-actions">
          <span class="wr-actions-label">{{ t('wr_log_today') }}</span>
          <button type="button" class="wr-pick" v-for="spirit in spirits" :key="'wrlog' + spirit.id" @click="logTodayWalk(spirit.id)">{{ spiritName(spirit) }}</button>
      </div>
      <div class="wr-scroll" id="wrScroll">
          <div class="wr-months" :style="{ gridTemplateColumns: 'repeat(' + walkHeatmap.weeks + ', var(--hm-cell))' }">
              <span v-for="m in walkHeatmap.monthLabels" :key="'wrm' + m.col" class="wr-month" :style="{ gridColumn: m.col }">{{ m.text }}</span>
          </div>
          <div class="wr-grid" role="group" :aria-label="t('wr_aria')" :style="{ gridTemplateColumns: 'repeat(' + walkHeatmap.weeks + ', var(--hm-cell))', gridTemplateRows: 'repeat(7, var(--hm-cell))' }">
              <button v-for="c in walkHeatmap.cells" :key="c.dateStr" type="button" class="wr-cell"
                      :class="{ 'is-recorded': c.recorded, 'is-future': c.isFuture, 'is-today': c.isToday, 'is-selected': walkEditDate === c.dateStr }"
                      :style="{ gridColumn: c.col, gridRow: c.row }" :title="c.title" :aria-label="c.title" :tabindex="c.isFuture ? -1 : 0"
                      @click="openWalkEdit(c.dateStr)"></button>
          </div>
      </div>
      <div class="wr-legend">
          <span class="wr-legend-swatch"></span><span>{{ t('wr_legend_empty') }}</span>
          <span class="wr-legend-swatch is-recorded"></span><span>{{ t('wr_legend_recorded') }}</span>
      </div>
      <div v-if="walkEditDate" class="wr-edit">
          <div class="wr-edit-title">{{ walkEditLabel }}</div>
          <div class="wr-edit-status">{{ walkEditEntry ? t('wr_edit_recorded', { name: walkEditSpiritName }) : t('wr_edit_none') }}</div>
          <div class="wr-edit-btns" role="group" :aria-label="t('wr_edit_pick')">
              <button type="button" class="wr-pick" v-for="spirit in spirits" :key="'wredit' + spirit.id" :class="{ 'is-active': walkEditEntry && walkEditEntry.spiritId === spirit.id }" @click="setWalkLogFor(walkEditDate, spirit.id)">{{ spiritName(spirit) }}</button>
          </div>
          <div class="wr-edit-foot">
              <button v-if="walkEditEntry" type="button" class="wr-del" @click="removeWalkLogFor(walkEditDate)">{{ t('wr_edit_delete') }}</button>
              <button type="button" class="wr-close" @click="walkEditDate = null">{{ t('wr_edit_close') }}</button>
          </div>
          <p class="wr-edit-hint">{{ t('wr_edit_hint') }}</p>
      </div>
      <p v-else class="wr-tap-hint">{{ t('wr_tap_hint') }}</p>
  </div>

  <div class="forecast-card">
    <div class="forecast-head" style="cursor:pointer;" @click="showForecast = !showForecast">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
        <div class="forecast-title">{{ t('fc_title') }}</div>
        <span style="font-size: 11px; color: var(--text-gray); font-weight: bold; white-space: nowrap;">{{ showForecast ? t('fc_close') : t('fc_open') }}</span>
      </div>
      <div class="forecast-desc">{{ t('fc_desc') }}</div>
    </div>

    <template v-if="showForecast">
    <div class="forecast-legend">
      <span><img v-if="TYPE_IMAGES.magic" class="fl-icon" :src="TYPE_IMAGES.magic" alt="" referrerpolicy="no-referrer"><svg v-else class="inline-icon fl-icon" viewBox="0 0 100 100"><use href="#cp-i-tree-magic"></use></svg>{{ t('fc_legend_magic') }}</span>
      <span><img v-if="TYPE_IMAGES.walk" class="fl-icon" :src="TYPE_IMAGES.walk" alt="" referrerpolicy="no-referrer"><svg v-else class="inline-icon fl-icon" viewBox="0 0 100 100"><use href="#cp-i-tree-emote"></use></svg>{{ t('fc_legend_walk') }}</span>
      <span><img v-if="TYPE_IMAGES.seasonal" class="fl-icon" :src="TYPE_IMAGES.seasonal" alt="" referrerpolicy="no-referrer"><svg v-else class="inline-icon fl-icon" viewBox="0 0 100 100"><use href="#cp-i-tree-bloom"></use></svg>{{ t('fc_legend_seasonal') }}</span>
      <span><svg class="inline-icon fl-icon" viewBox="0 0 100 100"><use href="#cp-i-tree-dye"></use></svg>{{ t('fc_legend_dye') }}</span>
      <span><img v-if="TYPE_IMAGES.adpass" class="fl-icon" :src="TYPE_IMAGES.adpass" alt="" referrerpolicy="no-referrer"><svg v-else class="inline-icon fl-icon" viewBox="0 0 100 100"><use href="#cp-i-tree-sparkle"></use></svg>{{ t('fc_legend_adpass') }}</span>
      <span><svg class="inline-icon fl-icon" viewBox="0 0 100 100"><use href="#cp-i-tree-heart"></use></svg>{{ t('fc_legend_heart') }}</span>
    </div>

    <div class="forecast-grid">
      <div v-for="sf in spiritForecasts" :key="sf.spirit.id" class="forecast-column" :class="'forecast-theme-' + sf.themeIndex">
        <div class="forecast-col-head">
          <span class="forecast-spirit-name">{{ spiritName(sf.spirit) }}</span>
          <span class="forecast-total"><svg class="inline-icon forecast-total-icon" viewBox="0 0 100 100"><use href="#cp-i-tree-candle"></use></svg>{{ sf.total }}</span>
          <span class="forecast-eta" :class="{ 'forecast-eta-done': sf.heartPlan && (sf.heartPlan.alreadyDone || sf.heartPlan.day === 0) }">{{ forecastEtaText(sf.heartPlan) }}</span>
        </div>
        <div class="forecast-tree">
          <div class="forecast-tier" v-for="row in sf.rows" :key="row.key">
            <div class="forecast-tier-header"><span class="forecast-tier-title">{{ row.label }}</span></div>
            <div class="game-node-wrapper">
              <div v-for="item in row.items" :key="item.id" class="game-node-btn" :class="{'no-points-node': item.noPoints, 'first-bonus-node': item.firstBonus, 'node-excluded': item.excluded}" :title="cleanName(getItemLabelForSpirit(item, sf.spirit))">
                <div v-if="!item.noPoints" class="node-candle-badge"><svg class="inline-icon" width="11" height="11"><use href="#i-candle"/></svg>{{ item.candles || 0 }}</div>
                <div v-if="getLevel(getItemLabelForSpirit(item, sf.spirit))" class="node-level">{{ getLevel(getItemLabelForSpirit(item, sf.spirit)) }}</div>
                <div class="node-icon">
                  <img v-if="getItemImageUrl(item)" class="node-svg-icon" :src="getItemImageUrl(item)" :alt="cleanName(getItemLabelForSpirit(item, sf.spirit))" referrerpolicy="no-referrer">
                  <svg v-else class="inline-icon node-svg-icon" viewBox="0 0 100 100"><use :href="'#' + getForecastIconId(item)"></use></svg>
                </div>
                <div class="node-name">{{ cleanName(getItemLabelForSpirit(item, sf.spirit)) }}</div>
              </div>
              <div v-if="row.items.length === 0" class="forecast-tier-empty">{{ t('fc_no_slot') }}</div>
            </div>
          </div>
          <div class="forecast-tier forecast-tier-heart" v-if="sf.heartItem">
            <div class="game-node-wrapper">
              <div class="game-node-btn heart-node" :title="translateItemName(sf.heartItem.name)">
                <div class="node-candle-badge"><svg class="inline-icon" width="11" height="11"><use href="#i-candle"/></svg>{{ sf.heartItem.candles || 0 }}</div>
                <div class="node-icon"><svg class="inline-icon node-svg-icon" viewBox="0 0 100 100"><use href="#cp-i-tree-heart"></use></svg></div>
                <div class="node-name">{{ cleanName(translateItemName(sf.heartItem.name)) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </template>

    <div class="forecast-total-bar">
      <span><svg class="inline-icon" width="12" height="12"><use href="#i-candle"/></svg> {{ t('fc_grand_total') }}</span>
      <span class="forecast-grand-total"><svg class="inline-icon forecast-total-icon" viewBox="0 0 100 100"><use href="#cp-i-tree-candle"></use></svg>{{ grandTotalCandles }}</span>
    </div>
  </div>

  <div class="main-layout">
    <div class="mobile-candle-bar">
      <span style="font-weight:bold; white-space:nowrap;"><svg class="inline-icon" width="12" height="12"><use href="#i-candle"/></svg> {{ t('mobile_owned') }}</span>
      <input type="number" min="0" v-model.number="ownedCandles">
      <span style="white-space:nowrap;">{{ t('calc_unit') }}</span>
      <div style="display:flex; gap:6px; margin-left:auto;">
        <button class="btn-sm" :title="t('mobile_add_one_title')" @click="ownedCandles = (ownedCandles || 0) + 1">+1</button>
        <button class="btn-sm" @click="ownedCandles = (ownedCandles || 0) + candlesPerDay">+{{ candlesPerDay }}{{ t('mobile_add_today') }}</button>
      </div>
    </div>

    <div class="left-column">
      <div class="total-goal-banner" :class="{ 'goal-complete': totalHearts === 4 }">
        <div v-if="totalHearts === 4" class="confetti-burst" aria-hidden="true">
          <span v-for="n in 16" :key="n" class="confetti-piece" :style="{ left: (n * 6.2 + 2) + '%', animationDelay: (n * 0.12) + 's' }" v-html="'&lt;svg class=inline-icon width=16 height=16&gt;&lt;use href=#i-sparkle /&gt;&lt;/svg&gt;'"></span>
        </div>
        <div style="font-size: 22px; font-weight: bold; margin: 0; position: relative;">{{ t('goal_hearts', {n: totalHearts}) }}</div>
        <div v-if="totalHearts === 4" class="goal-complete-message"><svg class="inline-icon ok" width="14" height="14"><use href="#i-check"/></svg> {{ t('goal_complete_msg') }}</div>
      </div>

      <div class="section-card" style="border: 1px solid var(--accent-orange); background: rgba(255, 149, 0, 0.02);">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <span style="font-size: 11px; color: var(--text-gray); font-weight: bold;">{{ t('calc_adpass_label') }}</span>
          <div class="preset-group">
            <button class="btn-sm" :class="{'btn-active': hasSeasonPass}" @click="hasSeasonPass = true">{{ t('calc_pass_yes') }}</button>
            <button class="btn-sm" :class="{'btn-active': !hasSeasonPass}" @click="hasSeasonPass = false">{{ t('calc_pass_no') }}</button>
          </div>
        </div>
        <div style="display:flex; align-items:baseline; justify-content:space-between; gap:8px; margin-top: 12px; flex-wrap: wrap;">
          <label style="font-size: 11px; color: var(--text-gray); font-weight: bold;">{{ t('calc_owned_label') }}</label>
          <div style="display:flex; align-items:baseline; gap:6px;">
            <input type="number" v-model.number="ownedCandles" class="calc-input owned-candle-input" :style="{ color: (ownedCandles || 0) < 0 ? 'var(--danger-text)' : 'var(--accent-orange)' }">
            <span style="font-size: 13px; color: var(--text-gray);">{{ t('calc_unit') }}</span>
          </div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:6px; margin-top: 8px;">
          <button type="button" class="btn-sm" :title="t('mobile_add_one_title')" @click="ownedCandles = (ownedCandles || 0) + 1">+1</button>
          <button type="button" class="btn-sm" @click="ownedCandles = (ownedCandles || 0) + candlesPerDay">+{{ candlesPerDay }}{{ t('mobile_add_today') }}</button>
        </div>
        <div style="display:flex; align-items:baseline; justify-content:space-between; gap:8px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border-color);">
          <label style="font-size: 11px; color: var(--text-gray); font-weight: bold;">{{ t('opt_daily_label') }}</label>
          <div style="display:flex; align-items:baseline; gap:6px;">
            <input type="number" min="0" max="99" v-model.number="estimatedDailyCandles" class="calc-input owned-candle-input">
            <span style="font-size: 13px; color: var(--text-gray);">{{ t('calc_unit') }}</span>
          </div>
        </div>
        <div style="font-size: 10.5px; color: var(--text-gray); line-height: 1.5; margin-top: 4px;">{{ t('est_daily_hint') }}</div>
      </div>

      <div class="section-card" style="border: 1px solid var(--accent-blue); background: rgba(0,122,255,0.02);">
        <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" @click="showMultiSpiritPlan = !showMultiSpiritPlan">
          <span style="font-weight: bold; font-size: 14px;">{{ t('plan_title') }}</span>
          <span style="font-size: 11px; color: var(--text-gray); font-weight: bold; white-space: nowrap;">{{ showMultiSpiritPlan ? t('plan_close') : t('plan_open') }}</span>
        </div>
        <template v-if="showMultiSpiritPlan">
        <template v-if="multiSpiritPlan.allDone">
          <div class="advice-box" style="margin-top: 12px; background:rgba(52,197,89,0.08); color:var(--success-text); border-color:rgba(52,197,89,0.2);">{{ t('plan_all_done') }}</div>
        </template>
        <template v-else>
          <div class="advice-box" style="margin-top: 12px;">
            <div style="font-weight: bold; margin-bottom: 4px;">{{ t('plan_today_reco') }}</div>
            <div v-if="multiSpiritPlan.walkTargetName">{{ t('plan_walk_pre') }} <strong>{{ multiSpiritPlan.walkTargetName }}</strong>{{ t('plan_walk_post') }}</div>
            <div v-else style="color: var(--text-gray);">{{ t('plan_walk_none') }}</div>
            <div v-if="multiSpiritPlan.buyNow.length" style="margin-top: 8px;">
              {{ t('plan_buy_now_pre') }}{{ fmtNum(ownedCandles || 0) }}{{ t('plan_buy_now_post') }}
              <div v-for="(b, idx) in multiSpiritPlan.buyNow" :key="idx" style="margin-top: 3px; padding-left: 2px;">
                ・{{ b.spiritName }}: {{ b.itemName }}{{ t('plan_item_open') }}<svg class="inline-icon" width="11" height="11"><use href="#i-candle"/></svg>{{ b.candles }}{{ t('plan_item_close') }}
              </div>
            </div>
            <div v-else style="margin-top: 8px; color: var(--text-gray);">{{ t('plan_buy_none') }}</div>
          </div>
          <div class="advice-box" style="margin-top: 10px;">
            <div style="font-weight: bold; margin-bottom: 4px;">{{ t('plan_overall_title') }}</div>
            <template v-if="multiSpiritPlan.unreachable">{{ t('plan_unreachable') }}</template>
            <template v-else>{{ t('plan_total_pre') }}<strong>{{ multiSpiritPlan.totalDays }}</strong>{{ t('plan_total_post') }}</template>
          </div>
          <div v-if="multiSpiritPlan.dayLog.length" style="margin-top: 10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" @click="showMultiSpiritLog = !showMultiSpiritLog">
              <span style="font-size: 10.5px; color: var(--text-gray); font-weight: bold;">{{ t('plan_log_toggle', {n: multiSpiritPlan.dayLog.length}) }}</span>
              <span style="font-size: 10.5px; color: var(--text-gray); font-weight: bold;">{{ showMultiSpiritLog ? t('plan_log_close') : t('plan_log_open') }}</span>
            </div>
            <div v-if="showMultiSpiritLog" class="multi-spirit-log">
              <div v-for="d in multiSpiritPlan.dayLog" :key="d.day" class="multi-spirit-log-row">
                <span class="msl-day">{{ t('plan_day_prefix') }}{{ d.day }}{{ t('plan_day_suffix') }}</span>
                <span v-if="d.walkName"><svg class="inline-icon" width="11" height="11"><use href="#cp-i-footprint"/></svg> {{ d.walkName }}</span>
                <span v-for="(b, bi) in d.buys" :key="bi"><svg class="inline-icon" width="11" height="11"><use href="#i-candle"/></svg> {{ b.spiritName }}:{{ b.itemName }}</span>
              </div>
            </div>
          </div>
        </template>
        <div style="font-size: 10px; color: var(--text-gray); margin-top: 10px; line-height: 1.5;">{{ t('plan_note') }}</div>
        </template>
      </div>

      <div class="spirit-tabs">
        <button v-for="(spirit, index) in spirits" :key="spirit.id" class="tab-btn" :class="{ active: activeIndex === index }" @click="activeIndex = index">
          <span class="tab-name">{{ spiritName(spirit) }}</span>
          <span class="tab-p-sub">
            <template v-if="getSpiritPoints(spirit) >= getSpiritTier4Total(spirit)"><svg class="inline-icon ok" width="11" height="11"><use href="#i-check"/></svg> {{ t('tabs_complete') }}</template>
            <template v-else>{{ getSpiritPoints(spirit) }} p</template>
          </span>
        </button>
      </div>

      <div class="section-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: bold; font-size: 15px;">{{ spiritName(activeSpirit) }}{{ t('pts_progress_suffix') }}</span>
          <span style="font-weight: bold; color: var(--accent-orange);">{{ activePoints }} / {{ activeTier4Total }} p</span>
        </div>
        <div class="progress-container"><div class="progress-bar" :style="{ width: (activePoints / activeTier4Total * 100) + '%' }"></div></div>
        <div class="stats-grid">
          <div class="stat-box">
            <div style="font-size: 11px; color: var(--text-gray);">{{ t('pts_current_status') }}</div>
            <div class="stat-val" :style="{ color: activePoints >= activeTier4Total ? '#ff2d55' : 'var(--accent-orange)' }">{{ activeStatusText }}</div>
          </div>
          <div class="stat-box">
            <div style="font-size: 11px; color: var(--text-gray);">{{ t('pts_remaining_to_heart') }}</div>
            <div class="stat-val">{{ Math.max(0, activeTier4Total - activePoints) }} <span style="font-size: 12px; font-weight: normal; color: var(--text-gray);">p</span></div>
          </div>
        </div>
        <div class="advice-box" :style="activePoints >= activeTier4Total ? 'background:rgba(52,197,89,0.08); color:var(--success-text); border-color:rgba(52,197,89,0.2);' : ''">
          <div v-if="activePoints >= activeTier4Total"><strong>{{ t('pts_congrats_label') }}</strong> {{ t('pts_congrats_rest') }}</div>
          <div v-else>
            {{ t('pts_advice_label') }} {{ t('pts_advice_pre') }} <strong>{{ activeRemainingDays }}</strong><span style="font-size: 11px; font-weight: normal; color: var(--text-gray);"> {{ t('pts_advice_day_unit') }}</span> {{ t('pts_advice_post', {n: activeTier4Total}) }}
            <span v-if="activeSpirit.walkDays + activeRemainingDays > 77" style="color: var(--danger-text); display: block; margin-top: 4px; font-weight: bold;">{{ t('pts_advice_warn') }}</span>
          </div>
        </div>
        <div v-if="walkLog.length" style="font-size: 10.5px; color: var(--text-gray); margin-top: 6px; padding-left: 2px;">{{ t('pts_actual_compare', { logged: activeSpiritLoggedWalkDays, counter: activeSpirit.walkDays }) }}</div>

        <div class="advice-box" style="margin-top: 10px; border-color: rgba(255,149,0,0.3); background: rgba(255,149,0,0.05); color: var(--text-color);">
          <div style="font-weight: bold; margin-bottom: 4px; color: var(--accent-orange); display:flex; align-items:center; justify-content:space-between; gap:8px;">
            <span>{{ t('heart_title') }}</span>
            <button type="button" class="pf-icon-btn" style="font-weight:normal; flex-shrink:0;" @click="heartCopyPlan">{{ t('copy_plan_btn') }}</button>
          </div>
          <div v-if="heartCopyStatus" class="opt-copy-status" style="margin-bottom:6px;">{{ heartCopyStatus }}</div>
          <template v-if="activeFastestHeartPlan.alreadyDone">{{ t('heart_done') }}</template>
          <template v-else-if="activeFastestHeartPlan.unreachable">{{ t('heart_unreachable') }}</template>
          <template v-else>
            <template v-if="activeFastestHeartPlan.day === 0">{{ t('heart_ready') }}</template>
            <template v-else>
              {{ t('heart_plan_pre') }}
              <strong>{{ activeFastestHeartPlan.day }}</strong><span style="font-size: 11px; font-weight: normal; color: var(--text-gray);">{{ t('heart_plan_day_unit') }}</span>{{ t('heart_plan_post') }}
              <div style="margin-top: 6px;">
                {{ t('heart_total_cost_pre') }} <strong style="color: var(--accent-orange); font-size: 14px;">{{ activeFastestHeartPlan.totalCost }}</strong><span style="color: var(--text-gray); font-size: 11px;">{{ t('heart_total_cost_unit') }}</span>
                <span style="color: var(--text-gray); font-size: 10.5px;">{{ t('heart_total_cost_note_pre') }}{{ activeSpirit.treeData.tier4[2].candles }}{{ t('heart_total_cost_note_mid') }} {{ fmtNum(ownedCandles) }}{{ t('heart_total_cost_note_post') }}</span>
              </div>
            </template>
            <div v-if="activeFastestHeartPlan.readyExceptPass" style="color: var(--danger-text); margin-top: 6px; font-weight: bold;">{{ t('heart_pass_needed') }}</div>
            <div v-if="activeFastestHeartPlan.order && activeFastestHeartPlan.order.length" style="margin-top: 10px;">
              <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" @click="showHeartPlanDetail = !showHeartPlanDetail">
                <span style="font-size: 10.5px; color: var(--text-gray); font-weight: bold;">{{ t('heart_order_toggle') }}</span>
                <span style="font-size: 10.5px; color: var(--text-gray); font-weight: bold; white-space: nowrap;">{{ showHeartPlanDetail ? t('heart_order_close') : t('heart_order_open') }}</span>
              </div>
              <template v-if="showHeartPlanDetail">
              <div class="priority-chart" style="margin-top: 6px;">
                <template v-for="(step, idx) in activeFastestHeartPlan.order" :key="idx">
                  <div class="priority-step" :class="{ 'priority-step-heart': step.isHeart }">
                    <div class="priority-step-num">{{ idx + 1 }}</div>
                    <div class="priority-step-icon">
                      <img v-if="step.imageUrl" :src="step.imageUrl" :alt="step.name" style="width: 17px; height: 17px; object-fit: contain; vertical-align: middle;" referrerpolicy="no-referrer">
                      <svg v-else class="inline-icon priority-step-svg-icon" viewBox="0 0 100 100"><use :href="'#' + step.icon"></use></svg>
                    </div>
                    <div class="priority-step-name">{{ step.name }}</div>
                    <div class="priority-step-cost"><svg class="inline-icon" width="11" height="11"><use href="#i-candle"/></svg>{{ step.candles }}</div>
                    <div class="priority-step-day">{{ step.day }}{{ t('heart_order_day_suffix') }}</div>
                  </div>
                  <div v-if="idx < activeFastestHeartPlan.order.length - 1" class="priority-arrow">→</div>
                </template>
              </div>
              <div style="font-size: 10px; color: var(--text-gray); margin-top: 4px;">{{ t('heart_order_note') }}</div>
              </template>
            </div>
            <div style="font-size: 10.5px; color: var(--text-gray); margin-top: 8px; line-height: 1.4;">{{ t('heart_note') }}</div>
          </template>
        </div>
      </div>

      <div class="preset-group">
        <button class="btn-sm" :class="{'btn-active': activeSpirit.currentPreset === 'custom'}" @click="activeSpirit.currentPreset = 'custom'">{{ t('preset_custom') }}</button>
        <button class="btn-sm" @click="applyPreset('no-magic')">{{ t('preset_no_magic') }}</button>
        <button class="btn-sm" @click="applyPreset('reset')" style="color: var(--text-gray);">{{ t('preset_reset') }}</button>
      </div>
      <!-- 🔁 4体まとめてリセット（誤操作防止のため、1回目のタップで確認表示→2回目で実行。ポップアップ(confirm)は使わない） -->
      <div class="reset-all-row">
        <button v-if="!resetAllConfirming" type="button" class="btn-sm reset-all-btn" @click="requestResetAll">{{ t('reset_all_btn') }}</button>
        <template v-else>
          <span class="reset-all-warn" role="alert">{{ t('reset_all_confirm') }}</span>
          <button type="button" class="btn-sm reset-all-btn is-confirming" @click="requestResetAll">{{ t('reset_all_do') }}</button>
          <button type="button" class="btn-sm" @click="cancelResetAll">{{ t('reset_all_cancel') }}</button>
        </template>
      </div>

      <div class="section-card" style="padding-bottom: 16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" @click="showOptimizer = !showOptimizer">
          <span style="font-weight: bold; font-size: 14px; color: var(--text-color);">{{ t('opt_title') }}</span>
          <span style="font-size: 11px; color: var(--text-gray); font-weight: bold; white-space: nowrap;">{{ showOptimizer ? t('shared_close') : t('shared_open') }}</span>
        </div>
        <div v-if="showOptimizer" style="margin-top: 12px;">
          <div style="font-size: 11.5px; color: var(--text-gray); line-height: 1.6;">{{ t('opt_desc') }}</div>
          <div class="opt-controls">
            <select class="opt-select" v-model="optSelectedId">
              <option value="">{{ t('opt_select_placeholder') }}</option>
              <option v-for="cand in optimizerCandidates" :key="cand.id" :value="cand.id">{{ cand.label }}</option>
            </select>
            <button type="button" class="opt-add-btn" :disabled="!optSelectedId" @click="optAdd()">{{ t('opt_add_btn') }}</button>
          </div>
          <div class="opt-controls" style="margin-top:8px;">
            <label style="font-size:12px; color:var(--text-gray); display:flex; align-items:center; gap:7px;">
              <svg class="inline-icon" width="11" height="11"><use href="#i-candle"/></svg> {{ t('opt_daily_label') }}
              <input type="number" class="opt-daily-input" min="0" max="99" v-model.number="estimatedDailyCandles">
            </label>
            <span style="font-size:11px; color:var(--text-gray);">{{ t('opt_owned_note') }} {{ fmtNum(ownedCandles) }}</span>
          </div>
          <div v-if="optimizerRows.length === 0" class="opt-empty">{{ t('opt_empty') }}</div>
          <div v-else style="margin-top: 6px;">
            <div v-for="(row, idx) in optimizerRows" :key="row.id" class="opt-row" :class="{done: row.done}">
              <span class="opt-order">{{ idx + 1 }}</span>
              <div class="opt-info">
                <div class="opt-name">{{ row.name }}</div>
                <span v-if="row.done" class="opt-when now"><svg class="inline-icon ok" width="11" height="11"><use href="#i-check"/></svg> {{ t('opt_done') }}</span>
                <span v-else-if="row.affordableNow" class="opt-when now">{{ t('opt_now') }}</span>
                <span v-else-if="row.unreachable" class="opt-when late">{{ t('opt_unreachable') }}</span>
                <span v-else class="opt-when" :class="row.inSeason ? 'ok' : 'late'">
                  {{ row.dateText }}{{ t('opt_est_suffix') }}
                  <svg v-if="row.inSeason" class="inline-icon ok" width="10" height="10"><use href="#i-check"/></svg>
                  <svg v-else class="inline-icon warn" width="10" height="10"><use href="#i-warning"/></svg>
                  {{ row.inSeason ? t('opt_within') : t('opt_over') }}
                </span>
              </div>
              <span class="opt-cost"><svg class="inline-icon" width="11" height="11"><use href="#i-candle"/></svg>{{ row.candles }}<br><small>{{ t('opt_cum') }} {{ row.cumulative }}</small></span>
              <div class="opt-btns">
                <button type="button" class="opt-mini-btn" @click="optMove(idx, -1)" :disabled="idx === 0"><svg class="inline-icon" width="11" height="11" style="transform:rotate(180deg)"><use href="#cp-i-chevron-down"/></svg></button>
                <button type="button" class="opt-mini-btn" @click="optMove(idx, 1)" :disabled="idx === optimizerRows.length - 1"><svg class="inline-icon" width="11" height="11"><use href="#cp-i-chevron-down"/></svg></button>
                <button type="button" class="opt-mini-btn danger" @click="optRemove(idx)"><svg class="inline-icon warn" width="11" height="11"><use href="#i-close"/></svg></button>
              </div>
            </div>
            <div class="opt-summary">
              {{ t('opt_total_pre') }} <strong>{{ optimizerSummary.totalCost }}</strong>{{ t('opt_total_unit') }}
              （{{ t('opt_lack') }} <strong>{{ optimizerSummary.lack }}</strong>{{ t('opt_total_unit') }}）<br>
              {{ t('opt_reachable_pre') }} <strong>{{ optimizerSummary.reachable }} / {{ optimizerSummary.total }}</strong>{{ t('opt_reachable_post') }}
              <span v-if="optimizerSummary.reachable < optimizerSummary.total">　{{ t('opt_reorder_hint') }}</span>
              <span v-else>　<svg class="inline-icon ok" width="12" height="12"><use href="#i-check"/></svg></span>
            </div>
            <div class="opt-copy-row">
              <button type="button" class="pf-icon-btn" @click="optCopyPlan">{{ t('copy_plan_btn') }}</button>
              <span v-if="optCopyStatus" class="opt-copy-status">{{ optCopyStatus }}</span>
            </div>
            <div style="font-size: 10.5px; color: var(--text-gray); margin-top: 8px; line-height: 1.5;">{{ t('opt_note') }}</div>
          </div>
        </div>
      </div>


    </div>

    <div class="right-column">
      <div class="section-card walk-days-card">
        <div class="mini-spirit-tabs">
          <button v-for="(spirit, index) in spirits" :key="spirit.id" class="mini-tab-btn" :class="{ active: activeIndex === index }" @click="activeIndex = index">
            <span class="mini-tab-name">{{ spiritName(spirit) }}</span><span v-if="getSpiritPoints(spirit) >= getSpiritTier4Total(spirit)" class="mini-tab-check"><svg class="inline-icon ok" width="12" height="12"><use href="#i-check"/></svg></span>
          </button>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: bold; font-size: 14px;">{{ t('walk_title_pre') ? t('walk_title_pre') + ' ' : '' }}{{ spiritName(activeSpirit) }}{{ t('walk_title_post') }}</span>
          <span style="font-weight: bold; color: var(--accent-blue);">+{{ activeSpirit.walkDays * 10 }} p</span>
        </div>
        <div class="walk-input-area">
          <button class="btn-counter" @click="decrementWalkDays" :disabled="activeSpirit.walkDays <= 0">−</button>
          <div class="counter-value"><span class="days-num">{{ activeSpirit.walkDays }}</span><span class="days-unit">{{ t('walk_unit') }}</span></div>
          <button class="btn-counter" @click="incrementWalkDays" :disabled="activeSpirit.walkDays >= 77">+</button>
        </div>
      </div>

      <div class="tree-card" style="padding-bottom: 30px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px;">
          <div style="font-size: 12px; color: var(--text-gray); font-weight: bold; text-transform: uppercase;">{{ t('tree_title_pre') ? t('tree_title_pre') + ' ' : '' }}{{ spiritName(activeSpirit) }}{{ t('tree_title_post') }}</div>
          <div style="font-size: 10px; color: var(--accent-purple); opacity: 0.85;">{{ t('tree_right_col_note') }}</div>
        </div>
        <div class="tree-subtotal-bar">
          <span>{{ t('tree_remaining_pre') }} <b>{{ activeRemainingCandles }}</b> / {{ activeTotalCandles }} {{ t('tree_remaining_mid') }} {{ activeDistributedCandles }} {{ t('tree_remaining_unit') }}<template v-if="activeExcludedCandles > 0">{{ t('tree_remaining_excluded') }} {{ activeExcludedCandles }} {{ t('tree_remaining_unit') }}</template>{{ t('tree_remaining_post') }}</span>
        </div>
        <div style="font-size: 10.5px; margin-top: 6px; line-height: 1.4;" :style="{ color: hasSeasonPass ? 'var(--text-gray)' : 'var(--danger-text)' }">
          <svg class="inline-icon" width="12" height="12"><use href="#i-heart"/></svg> {{ t('tree_pass_heart_label') }}{{ t('tree_pass_frag1') }}{{ activeSpirit.treeData.tier4[2].candles }}{{ t('tree_pass_frag2') }}{{ t('tree_pass_adpass_label') }}{{ t('tree_pass_frag3') }}<b>{{ t('tree_pass_holder_label') }}</b>{{ t('tree_pass_frag4') }}{{ hasSeasonPass ? t('tree_pass_note_have') : t('tree_pass_note_none') }}
        </div>

        <div class="tree-container">
          <div class="tree-tier" :class="{'tier-unlocked': activePoints >= 40}">
            <div class="tier-header"><span class="tier-title">{{ t('tier1_title') }}</span><span class="tier-req">{{ activePoints >= 40 ? t('tier_unlocked') : t('tier_remaining_pre') + (40 - activePoints) + t('tier_remaining_post') }}</span></div>
            <div class="game-node-wrapper">
              <div v-for="item in activeSpirit.treeData.tier1.filter(i => !isPhantomItem(i))" :key="item.id" class="game-node-btn"
                   :class="{'node-checked': item.checked, 'no-points-node': item.noPoints, 'first-bonus-node': item.firstBonus, 'node-excluded': item.excluded, 'node-disabled': item.requiresSeasonPass && !hasSeasonPass && !item.checked, 'node-pass-locked': item.requiresSeasonPass && !hasSeasonPass && !item.checked}"
                   :title="(item.requiresSeasonPass && !hasSeasonPass && !item.checked) ? t('tree_pass_required') : null" @click="toggleTreeItem(item)">
                <div v-if="!item.noPoints" class="node-candle-badge"><svg class="inline-icon" width="11" height="11"><use href="#i-candle"/></svg>{{ item.candles || 0 }}</div>
                <div v-if="getLevel(getItemLabel(item))" class="node-level">{{ getLevel(getItemLabel(item)) }}</div>
                <div class="node-icon">
                  <img v-if="getItemImageUrl(item)" class="node-svg-icon" :src="getItemImageUrl(item)" :alt="cleanName(getItemLabel(item))" referrerpolicy="no-referrer">
                  <svg v-else class="inline-icon node-svg-icon" viewBox="0 0 100 100"><use :href="'#' + getForecastIconId(item)"></use></svg>
                </div>
                <div class="node-name">{{ cleanName(getItemLabel(item)) }}</div>
                <div class="node-cost" :class="{'no-points-cost': item.noPoints}"><template v-if="item.noPoints">{{ t('tree_no_points') }}</template><template v-else><svg class="inline-icon" width="11" height="11"><use href="#cp-i-footprint"/></svg> +{{ Math.round(item.points) }}p</template></div>
                <button type="button" class="node-exclude-toggle" :class="{active: item.excluded}" :title="item.excluded ? t('tree_exclude_undo') : t('tree_exclude_do')" @click.stop="toggleExcluded(item)"><svg class="inline-icon" width="10" height="10"><use href="#i-close"/></svg></button>
              </div>
              <div class="node-placeholder"></div>
            </div>
          </div>

          <div class="tree-tier" :class="{'tier-unlocked': activePoints >= activeTier2Total}">
            <div class="tier-header"><span class="tier-title">{{ t('tier2_title') }}</span><span class="tier-req">{{ activePoints >= activeTier2Total ? t('tier_unlocked') : t('tier_remaining_pre') + (activePoints < 40 ? activeTier2Total - 40 : activeTier2Total - activePoints) + t('tier_remaining_post') }}</span></div>
            <div class="game-node-wrapper" style="margin-bottom: 16px;" v-if="activeSpirit.treeData.tier2.some(i => i.wrapRow && !isPhantomItem(i))">
              <div class="node-placeholder"></div>
              <div class="node-placeholder"></div>
              <div v-for="item in activeSpirit.treeData.tier2.filter(i => i.wrapRow && !isPhantomItem(i))" :key="item.id" class="game-node-btn"
                   :class="{'node-checked': item.checked, 'no-points-node': item.noPoints, 'first-bonus-node': item.firstBonus, 'node-excluded': item.excluded, 'node-disabled': (activePoints < 40 && !item.checked) || (item.requiresSeasonPass && !hasSeasonPass && !item.checked), 'node-pass-locked': item.requiresSeasonPass && !hasSeasonPass && !item.checked}"
                   :title="(item.requiresSeasonPass && !hasSeasonPass && !item.checked) ? t('tree_pass_required') : null" @click="toggleTreeItem(item, 40)">
                <div v-if="!item.noPoints" class="node-candle-badge"><svg class="inline-icon" width="11" height="11"><use href="#i-candle"/></svg>{{ item.candles || 0 }}</div>
                <div v-if="getLevel(getItemLabel(item))" class="node-level">{{ getLevel(getItemLabel(item)) }}</div>
                <div class="node-icon">
                  <img v-if="getItemImageUrl(item)" class="node-svg-icon" :src="getItemImageUrl(item)" :alt="cleanName(getItemLabel(item))" referrerpolicy="no-referrer">
                  <svg v-else class="inline-icon node-svg-icon" viewBox="0 0 100 100"><use :href="'#' + getForecastIconId(item)"></use></svg>
                </div>
                <div class="node-name">{{ cleanName(getItemLabel(item)) }}</div>
                <div class="node-cost" :class="{'no-points-cost': item.noPoints}"><template v-if="item.noPoints">{{ t('tree_no_points') }}</template><template v-else><svg class="inline-icon" width="11" height="11"><use href="#cp-i-footprint"/></svg> +{{ Math.round(item.points) }}p</template></div>
                <button type="button" class="node-exclude-toggle" :class="{active: item.excluded}" :title="item.excluded ? t('tree_exclude_undo') : t('tree_exclude_do')" @click.stop="toggleExcluded(item)"><svg class="inline-icon" width="10" height="10"><use href="#i-close"/></svg></button>
              </div>
            </div>
            <div class="game-node-wrapper">
              <template v-for="(item, slotIdx) in getTier2Slots(activeSpirit)" :key="slotIdx">
                <div v-if="!item" class="node-placeholder"></div>
                <div v-else class="game-node-btn"
                     :class="{'node-checked': item.checked, 'no-points-node': item.noPoints, 'first-bonus-node': item.firstBonus, 'node-excluded': item.excluded, 'node-disabled': (activePoints < 40 && !item.checked) || (item.requiresSeasonPass && !hasSeasonPass && !item.checked), 'node-pass-locked': item.requiresSeasonPass && !hasSeasonPass && !item.checked}"
                     :title="(item.requiresSeasonPass && !hasSeasonPass && !item.checked) ? t('tree_pass_required') : null" @click="toggleTreeItem(item, 40)">
                  <div v-if="!item.noPoints" class="node-candle-badge"><svg class="inline-icon" width="11" height="11"><use href="#i-candle"/></svg>{{ item.candles || 0 }}</div>
                  <div v-if="getLevel(getItemLabel(item))" class="node-level">{{ getLevel(getItemLabel(item)) }}</div>
                  <div class="node-icon">
                    <img v-if="getItemImageUrl(item)" class="node-svg-icon" :src="getItemImageUrl(item)" :alt="cleanName(getItemLabel(item))" referrerpolicy="no-referrer">
                    <svg v-else class="inline-icon node-svg-icon" viewBox="0 0 100 100"><use :href="'#' + getForecastIconId(item)"></use></svg>
                  </div>
                  <div class="node-name">{{ cleanName(getItemLabel(item)) }}</div>
                  <div class="node-cost" :class="{'no-points-cost': item.noPoints}"><template v-if="item.noPoints">{{ t('tree_no_points') }}</template><template v-else><svg class="inline-icon" width="11" height="11"><use href="#cp-i-footprint"/></svg> +{{ Math.round(item.points) }}p</template></div>
                  <button type="button" class="node-exclude-toggle" :class="{active: item.excluded}" :title="item.excluded ? t('tree_exclude_undo') : t('tree_exclude_do')" @click.stop="toggleExcluded(item)"><svg class="inline-icon" width="10" height="10"><use href="#i-close"/></svg></button>
                </div>
              </template>
            </div>
          </div>

          <div class="tree-tier" :class="{'tier-unlocked': activePoints >= activeTier3Total}">
            <div class="tier-header"><span class="tier-title">{{ t('tier3_title', {n: activeTier2Total}) }}</span><span class="tier-req">{{ activePoints >= activeTier3Total ? t('tier_unlocked') : t('tier_remaining_pre') + (activePoints < activeTier2Total ? activeTier3Total - activeTier2Total : activeTier3Total - activePoints) + t('tier_remaining_post') }}</span></div>
            <div class="game-node-wrapper">
              <div v-for="item in activeSpirit.treeData.tier3.filter(i => !isPhantomItem(i))" :key="item.id" class="game-node-btn"
                   :class="{'node-checked': item.checked, 'no-points-node': item.noPoints, 'first-bonus-node': item.firstBonus, 'node-excluded': item.excluded, 'node-disabled': (activePoints < activeTier2Total && !item.checked) || (item.requiresSeasonPass && !hasSeasonPass && !item.checked), 'node-pass-locked': item.requiresSeasonPass && !hasSeasonPass && !item.checked}"
                   :title="(item.requiresSeasonPass && !hasSeasonPass && !item.checked) ? t('tree_pass_required') : null" @click="toggleTreeItem(item, activeTier2Total)">
                <div v-if="!item.noPoints" class="node-candle-badge"><svg class="inline-icon" width="11" height="11"><use href="#i-candle"/></svg>{{ item.candles || 0 }}</div>
                <div v-if="getLevel(getItemLabel(item))" class="node-level">{{ getLevel(getItemLabel(item)) }}</div>
                <div class="node-icon">
                  <img v-if="getItemImageUrl(item)" class="node-svg-icon" :src="getItemImageUrl(item)" :alt="cleanName(getItemLabel(item))" referrerpolicy="no-referrer">
                  <svg v-else class="inline-icon node-svg-icon" viewBox="0 0 100 100"><use :href="'#' + getForecastIconId(item)"></use></svg>
                </div>
                <div class="node-name">{{ cleanName(getItemLabel(item)) }}</div>
                <div class="node-cost" :class="{'no-points-cost': item.noPoints}"><template v-if="item.noPoints">{{ t('tree_no_points') }}</template><template v-else><svg class="inline-icon" width="11" height="11"><use href="#cp-i-footprint"/></svg> +{{ Math.round(item.points) }}p</template></div>
                <button type="button" class="node-exclude-toggle" :class="{active: item.excluded}" :title="item.excluded ? t('tree_exclude_undo') : t('tree_exclude_do')" @click.stop="toggleExcluded(item)"><svg class="inline-icon" width="10" height="10"><use href="#i-close"/></svg></button>
              </div>
            </div>
          </div>

          <div class="tree-tier" :class="{'tier-unlocked': activePoints >= activeTier4Total}">
            <div class="tier-header"><span class="tier-title">{{ t('tier4_title', {n: activeTier3Total}) }}</span><span class="tier-req">{{ activePoints >= activeTier4Total ? t('tier_unlocked') : t('tier_remaining_pre') + (activePoints < activeTier3Total ? activeTier4Total - activeTier3Total : activeTier4Total - activePoints) + t('tier_remaining_post') }}</span></div>
            <div class="game-node-wrapper" style="margin-bottom: 16px;" v-if="activeSpirit.treeData.tier4.some(i => i.wrapRow && !isPhantomItem(i))">
              <div class="node-placeholder"></div>
              <div class="node-placeholder"></div>
              <div v-for="item in activeSpirit.treeData.tier4.filter(i => i.wrapRow && !isPhantomItem(i))" :key="item.id" class="game-node-btn"
                   :class="{'node-checked': item.checked, 'no-points-node': item.noPoints, 'first-bonus-node': item.firstBonus, 'node-excluded': item.excluded, 'node-disabled': activePoints < activeTier3Total && !item.checked}" @click="toggleTreeItem(item, activeTier3Total)">
                <div v-if="!item.noPoints" class="node-candle-badge"><svg class="inline-icon" width="11" height="11"><use href="#i-candle"/></svg>{{ item.candles || 0 }}</div>
                <div v-if="getLevel(getItemLabel(item))" class="node-level">{{ getLevel(getItemLabel(item)) }}</div>
                <div class="node-icon">
                  <img v-if="getItemImageUrl(item)" class="node-svg-icon" :src="getItemImageUrl(item)" :alt="cleanName(getItemLabel(item))" referrerpolicy="no-referrer">
                  <svg v-else class="inline-icon node-svg-icon" viewBox="0 0 100 100"><use :href="'#' + getForecastIconId(item)"></use></svg>
                </div>
                <div class="node-name">{{ cleanName(getItemLabel(item)) }}</div>
                <div class="node-cost" :class="{'no-points-cost': item.noPoints}"><template v-if="item.noPoints">{{ t('tree_no_points') }}</template><template v-else><svg class="inline-icon" width="11" height="11"><use href="#cp-i-footprint"/></svg> +{{ Math.round(item.points) }}p</template></div>
                <button type="button" class="node-exclude-toggle" :class="{active: item.excluded}" :title="item.excluded ? t('tree_exclude_undo') : t('tree_exclude_do')" @click.stop="toggleExcluded(item)"><svg class="inline-icon" width="10" height="10"><use href="#i-close"/></svg></button>
              </div>
            </div>
            <div class="game-node-wrapper">
              <template v-for="(item, slotIdx) in activeSpirit.treeData.tier4.filter(i => !i.isHeartGoal && !i.wrapRow).map(i => isPhantomItem(i) ? null : i)" :key="slotIdx">
                <div v-if="!item" class="node-placeholder"></div>
                <div v-else class="game-node-btn"
                     :class="{'node-checked': item.checked, 'no-points-node': item.noPoints, 'first-bonus-node': item.firstBonus, 'node-excluded': item.excluded, 'node-disabled': activePoints < activeTier3Total && !item.checked}" @click="toggleTreeItem(item, activeTier3Total)">
                  <div v-if="!item.noPoints" class="node-candle-badge"><svg class="inline-icon" width="11" height="11"><use href="#i-candle"/></svg>{{ item.candles || 0 }}</div>
                  <div v-if="getLevel(getItemLabel(item))" class="node-level">{{ getLevel(getItemLabel(item)) }}</div>
                  <div class="node-icon">
                    <img v-if="getItemImageUrl(item)" class="node-svg-icon" :src="getItemImageUrl(item)" :alt="cleanName(getItemLabel(item))" referrerpolicy="no-referrer">
                    <svg v-else class="inline-icon node-svg-icon" viewBox="0 0 100 100"><use :href="'#' + getForecastIconId(item)"></use></svg>
                  </div>
                  <div class="node-name">{{ cleanName(getItemLabel(item)) }}</div>
                  <div class="node-cost" :class="{'no-points-cost': item.noPoints}"><template v-if="item.noPoints">{{ t('tree_no_points') }}</template><template v-else><svg class="inline-icon" width="11" height="11"><use href="#cp-i-footprint"/></svg> +{{ Math.round(item.points) }}p</template></div>
                  <button type="button" class="node-exclude-toggle" :class="{active: item.excluded}" :title="item.excluded ? t('tree_exclude_undo') : t('tree_exclude_do')" @click.stop="toggleExcluded(item)"><svg class="inline-icon" width="10" height="10"><use href="#i-close"/></svg></button>
                </div>
              </template>
            </div>
          </div>

          <div class="heart-goal-container">
            <div class="game-node-btn heart-node"
                 :class="{'node-checked': activeSpirit.treeData.tier4[2].checked, 'node-disabled': (activePoints < activeTier4Total && !activeSpirit.treeData.tier4[2].checked) || (!hasSeasonPass && !activeSpirit.treeData.tier4[2].checked), 'node-pass-locked': !hasSeasonPass && !activeSpirit.treeData.tier4[2].checked}"
                 :title="(!hasSeasonPass && !activeSpirit.treeData.tier4[2].checked) ? t('tree_pass_required') : null" @click="toggleTreeItem(activeSpirit.treeData.tier4[2], activeTier4Total)">
              <div class="node-candle-badge"><svg class="inline-icon" width="11" height="11"><use href="#i-candle"/></svg>{{ activeSpirit.treeData.tier4[2].candles || 0 }}</div>
              <div class="node-level" style="color: #ff2d55;">MAX</div>
              <div class="node-icon"><svg class="inline-icon node-svg-icon" viewBox="0 0 100 100"><use href="#cp-i-tree-heart"></use></svg></div>
              <div class="node-name" style="font-size: 10px; color: inherit; opacity: 0.8;">{{ t('heart_node_name') }}</div>
              <div class="node-cost" style="color: #ff5e7e;">{{ activeSpirit.treeData.tier4[2].checked ? t('heart_node_got') : (activeTier4Total + 'p') }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="info-memo">
    <strong>{{ t('info_title') }}</strong><br>
    {{ t('info_1') }}<br>
    {{ t('info_2') }}<br>
    {{ t('info_3') }}
  </div>

  <footer style="text-align: center; padding: 24px 16px; color: var(--text-gray); font-size: 13px; line-height: 1.6; border-top: 1px solid var(--border-color); margin-top: 40px;">
    {{ t('footer_disclaimer') }}<br>
    {{ t('footer_credit_pre') }} <a href="https://x.com/Skyzztai" target="_blank" rel="noopener noreferrer" style="color: var(--accent-blue); text-decoration: underline; font-weight: bold;">@Skyzztai</a>
    <span style="color: var(--text-gray); font-size: 12px; margin-top: 4px; display: inline-block;">
      {{ t('footer_sources') }}
      <a href="https://sky-children-of-the-light.fandom.com/ja/wiki/%E5%AD%A3%E7%AF%80%E7%B2%BE%E9%9C%8A#%E7%B2%BE%E9%9C%8A%E5%8F%8B%E6%83%85%E3%82%B7%E3%82%B9%E3%83%86%E3%83%A0" target="_blank" rel="noopener noreferrer" style="color: var(--accent-blue);">{{ t('footer_source_season_spirit') }}</a>・<a href="https://sky-children-of-the-light.fandom.com/ja/wiki/Dear_Van_Gogh_%E8%A6%AA%E6%84%9B%E3%81%AA%E3%82%8B%E3%83%95%E3%82%A1%E3%83%B3%E3%83%BB%E3%82%B4%E3%83%83%E3%83%9B%E3%81%B8" target="_blank" rel="noopener noreferrer" style="color: var(--accent-blue);">{{ t('footer_source_van_gogh_ja') }}</a>・<a href="https://sky-children-of-the-light.fandom.com/wiki/Dear_Van_Gogh" target="_blank" rel="noopener noreferrer" style="color: var(--accent-blue);">{{ t('footer_source_van_gogh_en') }}</a>
    </span>
  </footer>

  <div class="app-toast" :class="{ 'is-visible': toastVisible }" role="status" aria-live="polite">{{ toastMessage }}</div>
</div>
`;

/* ================================================================
   setup()：元ファイルのsetup()本体（5910-8852行相当）から、テーマ/言語/
   プロフィール（記録）管理/所持通貨/データ引継ぎ/ホーム画面アイコン/
   ダッシュボードのfetch部分を除いた「このツール自身」のロジックだけを
   移植したもの。
   ================================================================ */
function buildSetup(Vue) {
  const { ref, computed, watch, onMounted, onUnmounted, nextTick } = Vue;

  return function setup() {
    /* ── 🕯️ ツリー・キャンドル計算機の状態 ── */
    const activeIndex = ref(0);
    const spirits = ref(createDefaultSpiritsData());
    const hasSeasonPass = ref(true);
    const ownedCandles = ref(0);
    const candlesPerDay = computed(() => hasSeasonPass.value ? 6 : 5);
    const estimatedDailyCandles = ref(candlesPerDay.value);
    const showForecast = ref(false);
    const showHeartPlanDetail = ref(false);
    const showMultiSpiritLog = ref(false);
    const showMultiSpiritPlan = ref(false);
    const showOptimizer = ref(false);
    const optSelectedId = ref('');
    const optimizerIds = ref([]);
    const optCopyStatus = ref('');
    const heartCopyStatus = ref('');

    /* ── 🚶 今日の連れ歩き記録（ワンタップ記録・ストリーク・月間カレンダー） ── */
    const walkLog = ref([]);
    const WALK_LOG_KEEP_MAX = 200;
    const WALK_LOG_DISPLAY_LIMIT = 20;
    const showWalkHistory = ref(false);
    const showWalkCalendar = ref(false);
    const walkCalendarViewDate = ref((() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); })());

    /* ── 🎉 「1年前の今日」バナー ── */
    const oneYearBannerDismissedToday = ref(false);

    /* ── 📤 シェアカード・🗓️ ダッシュボード・🔔 トースト ──
       🩹 モーダルの開閉は、Vueの:classバインディングではなくtemplate ref経由の
       classList直接操作にする。理由: js/shortcuts.jsのグローバルEscapeハンドラは
       「開いている.modal-overlayから直接.openクラスを外す」というDOM直操作で
       閉じる（Vueのリアクティブ状態は一切経由しない）。もし:class="{open: X}"
       のようにVue側のrefでクラスを制御していると、Escで外部からクラスを
       外された後にrefの値(true)自体は変化していないため、再度開こうとして
       同じtrueを代入してもVueは「値が変わっていない」と判断してDOM
       パッチをスキップし、二度と開かなくなる（実機で確認済みの不具合）。
       refを使わずclassListを直接操作すれば、Escでの外部クローズ後も
       毎回確実に'open'を付け外しできる。 ── */
    const dashOverlayEl = ref(null);
    const edbBodyEl = ref(null);
    const toastMessage = ref('');
    const toastVisible = ref(false);
    let toastHideTimer = null;

    /* ── ⏳ ヘッダーに表示するシーズン残り時間（1秒ごとに更新） ── */
    const nowForCountdown = ref(new Date());
    let seasonCountdownTimer = null;

    /* ================================================================
       🔓 各層の完了に必要な累計ポイント・精霊名/精霊ごとの最終累計
       ================================================================ */
    const activeSpirit = computed(() => spirits.value[activeIndex.value]);
    const getSpiritPoints = (spirit) => {
      let points = 0;
      Object.values(spirit.treeData).forEach(tier => {
        tier.forEach(item => { if (item.checked && !item.noPoints) points += item.points; });
      });
      points += (spirit.walkDays * 10);
      const cap = (TIER_TOTAL_OVERRIDES[spirit.id] || {}).t4 || 280;
      return Math.min(cap, Math.round(points));
    };
    const activePoints = computed(() => getSpiritPoints(activeSpirit.value));
    const totalHearts = computed(() => spirits.value.filter(s => s.treeData.tier4[2].checked).length);
    const activeTier2Total = computed(() => (TIER_TOTAL_OVERRIDES[activeSpirit.value.id] || {}).t2 || 100);
    const activeTier3Total = computed(() => (TIER_TOTAL_OVERRIDES[activeSpirit.value.id] || {}).t3 || 180);
    const activeTier4Total = computed(() => (TIER_TOTAL_OVERRIDES[activeSpirit.value.id] || {}).t4 || 280);
    const getSpiritTier4Total = (spirit) => (TIER_TOTAL_OVERRIDES[spirit.id] || {}).t4 || 280;

    const spiritName = (spirit) => spiritNameOf(spirit);

    /* ================================================================
       🕯️ ツリーのアイテムをチェック/解除する共通処理
       ================================================================ */
    const toggleTreeItem = (item, minPoints) => {
      if (!item.checked) {
        if (item.requiresSeasonPass && !hasSeasonPass.value) return;
        if (minPoints !== undefined && activePoints.value < minPoints) return;
      }
      item.checked = !item.checked;
      activeSpirit.value.currentPreset = 'custom';
      const delta = item.checked ? -(item.candles || 0) : (item.candles || 0);
      ownedCandles.value = (ownedCandles.value || 0) + delta;
    };
    const toggleExcluded = (item) => {
      item.excluded = !item.excluded;
      activeSpirit.value.currentPreset = 'custom';
    };

    const getSpiritCandleItems = (spirit) => {
      const items = [];
      Object.values(spirit.treeData).forEach(tier => { tier.forEach(item => { if (!item.noPoints) items.push(item); }); });
      return items;
    };
    const getSpiritTotalCandles = (spirit) => getSpiritCandleItems(spirit).reduce((sum, item) => sum + (item.candles || 0), 0);
    const getSpiritRemainingCandles = (spirit) => getSpiritCandleItems(spirit).filter(item => !item.checked).reduce((sum, item) => sum + (item.candles || 0), 0);
    const getSpiritLockedHeartCost = (spirit) => {
      if (hasSeasonPass.value) return 0;
      const heartItem = spirit.treeData.tier4[2];
      if (!heartItem || !heartItem.isHeartGoal || heartItem.checked) return 0;
      return heartItem.candles || 0;
    };
    const getSpiritExcludedCandles = (spirit) => getSpiritCandleItems(spirit).filter(item => !item.checked && item.excluded).reduce((sum, item) => sum + (item.candles || 0), 0);

    const activeCandleItems = computed(() => getSpiritCandleItems(activeSpirit.value));
    const activeTotalCandles = computed(() => getSpiritTotalCandles(activeSpirit.value) - getSpiritLockedHeartCost(activeSpirit.value) - getSpiritExcludedCandles(activeSpirit.value));
    const activeRemainingCandles = computed(() => getSpiritRemainingCandles(activeSpirit.value) - getSpiritLockedHeartCost(activeSpirit.value) - getSpiritExcludedCandles(activeSpirit.value));
    const activeDistributedCandles = computed(() => activeTotalCandles.value - activeRemainingCandles.value);
    const activeExcludedCandles = computed(() => getSpiritExcludedCandles(activeSpirit.value));
    const totalRemainingCandles = computed(() => spirits.value.reduce((sum, s) => sum + getSpiritRemainingCandles(s) - getSpiritLockedHeartCost(s) - getSpiritExcludedCandles(s), 0));
    const candleBudgetPct = computed(() => {
      const need = totalRemainingCandles.value;
      if (need <= 0) return 100;
      return Math.max(0, Math.min(100, Math.round((ownedCandles.value || 0) / need * 100)));
    });

    /* ================================================================
       🔮 精霊ツリー（4体横並び比較）
       ================================================================ */
    const FORECAST_TIER_LABELS_JA = { tier4: '第4層', tier3: '第3層', tier2: '第2層', tier1: '第1層' };
    const FORECAST_TIER_LABELS_EN = { tier4: 'Tier 4', tier3: 'Tier 3', tier2: 'Tier 2', tier1: 'Tier 1' };
    const FORECAST_TIER_LABELS = { en: FORECAST_TIER_LABELS_EN, 'zh-TW': FORECAST_TIER_LABELS_ZH_TW, ko: FORECAST_TIER_LABELS_KO }[LANG] || FORECAST_TIER_LABELS_JA;
    const getForecastData = (spirit) => {
      let heartItem = null;
      const tierOrder = ['tier1', 'tier2', 'tier3', 'tier4'];
      const rows = tierOrder.map(key => ({
        key, label: FORECAST_TIER_LABELS[key],
        items: spirit.treeData[key].filter(item => {
          if (item.isHeartGoal) { heartItem = item; return false; }
          if (isPhantomItem(item)) return false;
          return true;
        }),
      }));
      return { heartItem, rows, total: getSpiritTotalCandles(spirit) };
    };
    const spiritForecasts = computed(() => spirits.value.map((s, idx) => {
      const found = allSpiritsFastestHeartPlans.value.find(x => x.spirit.id === s.id);
      return { spirit: s, themeIndex: idx, heartPlan: found ? found.plan : null, ...getForecastData(s) };
    }));
    const grandTotalCandles = computed(() => spirits.value.reduce((sum, s) => sum + getSpiritTotalCandles(s), 0));
    const getForecastIconId = (item) => {
      if (!item) return 'cp-i-tree-sparkle';
      if (item.isHeartGoal) return 'cp-i-tree-heart';
      if (item.noPoints) return 'cp-i-tree-sparkle';
      if (item.type === 'magic') return 'cp-i-tree-magic';
      if (item.type === 'seasonal') return 'cp-i-tree-bloom';
      if (item.type === 'dye') return 'cp-i-tree-dye';
      if (item.type === 'walk') return 'cp-i-tree-emote';
      return 'cp-i-tree-sparkle';
    };
    const forecastEtaText = (plan) => {
      if (!plan) return '';
      if (plan.alreadyDone) return t('fc_eta_done');
      if (plan.unreachable) return t('fc_eta_unreachable');
      if (plan.day === 0) return t('fc_eta_ready');
      return t('fc_eta_days', { n: plan.day });
    };

    /* ================================================================
       🧭 4体をまたいだ効率的な進め方のシミュレーション（魔法を除く）
       ================================================================ */
    const getTierThresholds = (spiritId) => {
      const o = TIER_TOTAL_OVERRIDES[spiritId];
      return { tier1: 0, tier2: 40, tier3: o ? o.t2 : 100, tier4: o ? o.t3 : 180 };
    };
    const buildMultiSpiritState = () => spirits.value.map(spirit => {
      const tierThresholds = getTierThresholds(spirit.id);
      const remaining = [];
      Object.keys(spirit.treeData).forEach(tierKey => {
        spirit.treeData[tierKey].forEach(item => {
          if (item.checked || item.type === 'magic') return;
          if (item.noPoints) return;
          if (item.isHeartGoal) return;
          if (item.requiresSeasonPass && !hasSeasonPass.value) return;
          if (item.excluded) return;
          remaining.push({ name: cleanName(getItemLabelForSpirit(item, spirit)), candles: item.candles || 0, points: item.points || 0, threshold: tierThresholds[tierKey] });
        });
      });
      return { name: spiritName(spirit), points: getSpiritPoints(spirit), cap: getSpiritTier4Total(spirit), remaining };
    });
    const pickBestBuy = (state, pool) => {
      let best = null, bestRatio = -1, bestSIdx = -1, bestIIdx = -1;
      state.forEach((s, sIdx) => {
        s.remaining.forEach((item, iIdx) => {
          if (s.points >= item.threshold && item.candles <= pool) {
            const ratio = item.candles === 0 ? Infinity : (item.points / item.candles);
            if (ratio > bestRatio) { bestRatio = ratio; best = item; bestSIdx = sIdx; bestIIdx = iIdx; }
          }
        });
      });
      return best ? { best, bestSIdx, bestIIdx } : null;
    };
    const pickWalkTarget = (state) => {
      const candidates = state.filter(s => s.points < s.cap && s.remaining.length > 0);
      if (!candidates.length) return null;
      return candidates.reduce((min, s) => (s.points < min.points ? s : min), candidates[0]);
    };
    const multiSpiritPlan = computed(() => {
      const state = buildMultiSpiritState();
      let pool = ownedCandles.value || 0;
      const perDay = Math.max(0, Number(estimatedDailyCandles.value) || 0);
      const buyNow = [];
      let picked;
      while ((picked = pickBestBuy(state, pool))) {
        const { best, bestSIdx, bestIIdx } = picked;
        pool -= best.candles;
        state[bestSIdx].points = Math.min(state[bestSIdx].cap, state[bestSIdx].points + best.points);
        buyNow.push({ spiritName: state[bestSIdx].name, itemName: best.name, candles: best.candles });
        state[bestSIdx].remaining.splice(bestIIdx, 1);
      }
      const walkTarget = pickWalkTarget(state);
      const isIncomplete = () => state.some(s => s.remaining.length > 0);
      const alreadyAllDone = !isIncomplete();
      const dayLog = [];
      let day = 0;
      const MAX_DAYS = 500;
      while (isIncomplete() && day < MAX_DAYS) {
        day++;
        pool += perDay;
        const w = pickWalkTarget(state);
        if (w) w.points = Math.min(w.cap, w.points + 10);
        const buysToday = [];
        let p;
        while ((p = pickBestBuy(state, pool))) {
          const { best, bestSIdx, bestIIdx } = p;
          pool -= best.candles;
          state[bestSIdx].points = Math.min(state[bestSIdx].cap, state[bestSIdx].points + best.points);
          buysToday.push({ spiritName: state[bestSIdx].name, itemName: best.name });
          state[bestSIdx].remaining.splice(bestIIdx, 1);
        }
        dayLog.push({ day, walkName: w ? w.name : null, buys: buysToday });
      }
      return { buyNow, walkTargetName: walkTarget ? walkTarget.name : null, totalDays: day, unreachable: day >= MAX_DAYS, dayLog, allDone: alreadyAllDone };
    });

    /* ================================================================
       🚀 最短ハート到達シミュレーション
       ================================================================ */
    const computeFastestHeartPlanFor = (spirit) => {
      const heartItem = spirit.treeData.tier4[2];
      const tierThreshold = getTierThresholds(spirit.id);
      const goalPoints = getSpiritTier4Total(spirit);
      let remaining = [];
      Object.keys(spirit.treeData).forEach(tierKey => {
        spirit.treeData[tierKey].forEach(item => {
          if (item === heartItem || item.noPoints || item.checked || !item.points || item.excluded) return;
          remaining.push({ name: cleanName(getItemLabelForSpirit(item, spirit)), icon: getIcon(item), imageUrl: getItemImageUrl(item), candles: item.candles || 0, points: item.points || 0, threshold: tierThreshold[tierKey] });
        });
      });
      let points = getSpiritPoints(spirit);
      let candlePool = ownedCandles.value || 0;
      const perDay = Math.max(0, Number(estimatedDailyCandles.value) || 0);
      const heartCost = heartItem.candles || 0;
      const heartName = cleanName(translateItemName(heartItem.name));
      if (heartItem.checked) return { alreadyDone: true, order: [], totalCost: 0 };
      const order = [];
      const meetsGoal = () => points >= goalPoints && candlePool >= heartCost;
      if (meetsGoal()) return { day: 0, passOk: hasSeasonPass.value, candlePool, readyExceptPass: !hasSeasonPass.value, order: [], totalCost: 0 };
      const MAX_DAYS = 500;
      let day = 0;
      while (day < MAX_DAYS) {
        day++;
        candlePool += perDay;
        points = Math.min(goalPoints, points + 10);
        let bought = true;
        while (bought) {
          bought = false;
          let bestIdx = -1, bestRatio = -1;
          remaining.forEach((c, idx) => {
            if (points >= c.threshold && c.candles <= candlePool) {
              const ratio = c.candles === 0 ? Infinity : (c.points / c.candles);
              if (ratio > bestRatio) { bestRatio = ratio; bestIdx = idx; }
            }
          });
          if (bestIdx >= 0) {
            const it = remaining.splice(bestIdx, 1)[0];
            candlePool -= it.candles;
            points = Math.min(goalPoints, points + it.points);
            order.push({ name: it.name, icon: it.icon, imageUrl: it.imageUrl, candles: it.candles, points: it.points, day });
            bought = true;
          }
        }
        if (points >= goalPoints && candlePool >= heartCost) {
          order.push({ name: heartName, icon: 'cp-i-tree-heart', imageUrl: null, candles: heartCost, points: 0, day, isHeart: true });
          const totalCost = order.reduce((sum, o) => sum + (o.candles || 0), 0);
          return { day, candlePool, passOk: hasSeasonPass.value, readyExceptPass: !hasSeasonPass.value, order, totalCost };
        }
      }
      return { unreachable: true, order: [], totalCost: 0 };
    };
    const activeFastestHeartPlan = computed(() => computeFastestHeartPlanFor(activeSpirit.value));
    const allSpiritsFastestHeartPlans = computed(() => spirits.value.map(s => ({ spirit: s, plan: computeFastestHeartPlanFor(s) })));

    /* ================================================================
       🎯 交換アイテムの取得順計算
       ================================================================ */
    const findTreeItemById = (id) => {
      for (const spirit of spirits.value) {
        for (const tierKey of Object.keys(spirit.treeData)) {
          const item = spirit.treeData[tierKey].find(i => i && i.id === id);
          if (item) return { spirit, item };
        }
      }
      return null;
    };
    const optimizerCandidates = computed(() => {
      const list = [];
      spirits.value.forEach(spirit => {
        Object.keys(spirit.treeData).forEach(tierKey => {
          spirit.treeData[tierKey].forEach(item => {
            if (!item || item.noPoints || !(item.candles > 0)) return;
            if (item.checked || item.excluded) return;
            if (optimizerIds.value.includes(item.id)) return;
            list.push({ id: item.id, label: `${spiritName(spirit)}／${getItemLabelForSpirit(item, spirit)}（🕯️${item.candles}）` });
          });
        });
      });
      return list;
    });
    const optAdd = () => { if (!optSelectedId.value) return; optimizerIds.value.push(optSelectedId.value); optSelectedId.value = ''; save(); };
    const optMove = (idx, dir) => {
      const to = idx + dir;
      if (to < 0 || to >= optimizerIds.value.length) return;
      const it = optimizerIds.value.splice(idx, 1)[0];
      optimizerIds.value.splice(to, 0, it);
      save();
    };
    const optRemove = (idx) => { optimizerIds.value.splice(idx, 1); save(); };
    const optimizerRows = computed(() => {
      const daily = Math.max(0, Number(estimatedDailyCandles.value) || 0);
      const owned = Math.max(0, Number(ownedCandles.value) || 0);
      let cumulative = 0;
      const now = new Date();
      return optimizerIds.value.map(id => {
        const found = findTreeItemById(id);
        if (!found) return null;
        const { spirit, item } = found;
        const row = { id, name: `${getItemLabelForSpirit(item, spirit)}（${spiritName(spirit)}）`, candles: item.candles, done: !!item.checked, affordableNow: false, unreachable: false, inSeason: true, dateText: '', cumulative: 0 };
        if (row.done) { row.cumulative = cumulative; return row; }
        cumulative += item.candles;
        row.cumulative = cumulative;
        if (cumulative <= owned) {
          row.affordableNow = true;
        } else if (daily <= 0) {
          row.unreachable = true;
        } else {
          const daysNeeded = Math.ceil((cumulative - owned) / daily);
          const estDate = new Date(now);
          estDate.setDate(estDate.getDate() + daysNeeded);
          row.inSeason = estDate <= SEASON_END;
          const locale = DATE_LOCALE;
          row.dateText = new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric' }).format(estDate);
        }
        return row;
      }).filter(Boolean);
    });
    const optimizerSummary = computed(() => {
      const rows = optimizerRows.value.filter(r => !r.done);
      const totalCost = rows.reduce((a, r) => a + r.candles, 0);
      const owned = Math.max(0, Number(ownedCandles.value) || 0);
      const reachable = rows.filter(r => r.affordableNow || (!r.unreachable && r.inSeason)).length;
      return { totalCost, lack: Math.max(0, totalCost - owned), reachable, total: rows.length };
    });

    /* ================================================================
       🌐 アイテムの表示名・アイコン・レベル文字列
       ================================================================ */
    const getIcon = (item) => {
      const obj = (typeof item === 'string') ? { name: item } : (item || {});
      if (obj.type && TYPE_ICONS[obj.type]) return TYPE_ICONS[obj.type];
      return 'cp-i-tree-sparkle';
    };
    const getItemImageKey = (item) => {
      if (!item) return null;
      if (item.noPoints && !item.isHeartGoal) return 'adpass';
      if (item.type && Object.prototype.hasOwnProperty.call(TYPE_IMAGES, item.type)) return item.type;
      return null;
    };
    const getItemImageUrl = (item) => {
      if (item && item.customImage) return item.customImage;
      const key = getItemImageKey(item);
      if (!key) return null;
      return TYPE_IMAGES[key] || null;
    };
    const getItemLabel = (item) => {
      if (item.customLabel) return translateItemName(item.customLabel);
      if (!item.type) return translateItemName(item.name);
      if (isPhantomItem(item)) return item.name;
      const ordered = activeCandleItems.value;
      let count = 0;
      for (const i of ordered) {
        if (isPhantomItem(i)) continue;
        if (i.type === item.type) { count++; if (i.id === item.id) break; }
      }
      const base = item.type === 'walk' ? TYPE_LABELS.walk + 'Lv' + count : (TYPE_LABELS[item.type] || item.type) + (CIRCLED_NUMS[count - 1] || ('#' + count));
      return item.firstUnlock ? base + FIRST_UNLOCK_SUFFIX : base;
    };
    const getItemLabelForSpirit = (item, spirit) => {
      if (item.customLabel) return translateItemName(item.customLabel);
      if (!item.type) return translateItemName(item.name);
      if (isPhantomItem(item)) return item.name;
      const ordered = getSpiritCandleItems(spirit);
      let count = 0;
      for (const i of ordered) {
        if (isPhantomItem(i)) continue;
        if (i.type === item.type) { count++; if (i.id === item.id) break; }
      }
      const base = item.type === 'walk' ? TYPE_LABELS.walk + 'Lv' + count : (TYPE_LABELS[item.type] || item.type) + (CIRCLED_NUMS[count - 1] || ('#' + count));
      return item.firstUnlock ? base + FIRST_UNLOCK_SUFFIX : base;
    };
    const getLevel = (name) => { const match = name.match(/Lv\.?\d+/); return match ? match[0] : ''; };
    const cleanName = (name) => name.replace(/[💨🪄✨♡]/g, '').replace(/Lv\.?\d+/, '').replace(/\(.*?\)/g, '').trim();
    const isPhantomItem = (item) => !!(item.type && !item.firstUnlock && !item.candles);
    const getTier2Slots = (spirit) => {
      const items = spirit.treeData.tier2.filter(i => !i.wrapRow);
      const freeItems = items.filter(i => !i.noPoints && !isPhantomItem(i));
      const bonusItems = items.filter(i => i.noPoints);
      const slots = [null, null, null];
      freeItems.slice(0, 2).forEach((item, idx) => { slots[idx] = item; });
      bonusItems.slice(0, 1).forEach((item) => { slots[2] = item; });
      return slots;
    };

    /* ================================================================
       👣 連れ歩き日数・プリセット
       ================================================================ */
    const incrementWalkDays = () => { if (activeSpirit.value.walkDays < 77) { activeSpirit.value.walkDays++; activeSpirit.value.currentPreset = 'custom'; } };
    const decrementWalkDays = () => { if (activeSpirit.value.walkDays > 0) { activeSpirit.value.walkDays--; activeSpirit.value.currentPreset = 'custom'; } };
    const setSpiritItems = (spirit, status) => { Object.values(spirit.treeData).forEach(tier => { tier.forEach(item => { item.checked = status; }); }); };
    // 1体ぶんを初期状態へ戻す（連れ歩き日数0・全アイテム未取得・最初のエモートLv1だけ取得済み）。
    // 「リセット」ボタン（その精霊だけ）と「全4体を一気にリセット」の両方がこれを使う。
    const resetSpiritProgress = (spirit) => {
      spirit.walkDays = 0;
      setSpiritItems(spirit, false);
      spirit.treeData.tier1[0].checked = true;
      spirit.currentPreset = 'custom';
    };
    // 🔁 全4体まとめてリセット。誤操作で進捗を失わないよう、1回目で確認表示にして、
    // 6秒以内にもう一度押した時だけ実行する（放置すると自動で通常表示に戻る）。
    const resetAllConfirming = ref(false);
    let resetAllTimer = null;
    const cancelResetAll = () => {
      resetAllConfirming.value = false;
      if (resetAllTimer) { clearTimeout(resetAllTimer); resetAllTimer = null; }
    };
    const requestResetAll = () => {
      if (!resetAllConfirming.value) {
        resetAllConfirming.value = true;
        resetAllTimer = setTimeout(cancelResetAll, 6000);
        return;
      }
      cancelResetAll();
      spirits.value.forEach(resetSpiritProgress);
      showToast(t('reset_all_done'));
    };
    const applyPreset = (type) => {
      activeSpirit.value.currentPreset = type;
      if (type === 'reset') {
        resetSpiritProgress(activeSpirit.value);
      } else if (type === 'no-magic') {
        activeSpirit.value.walkDays = 9;
        setSpiritItems(activeSpirit.value, true);
        Object.values(activeSpirit.value.treeData).forEach(tier => { tier.forEach(item => { if (item.type === 'magic') item.checked = false; }); });
        if (!hasSeasonPass.value) {
          Object.values(activeSpirit.value.treeData).forEach(tier => { tier.forEach(item => { if (item.requiresSeasonPass) item.checked = false; }); });
        }
      }
    };

    /* ================================================================
       📅 ヘッダーのシーズン残り時間・シーズン何日目か
       ================================================================ */
    const pad2Local = pad2;
    const seasonNameDisplay = computed(() => CURRENT_LANG === 'en' ? SEASON_NAME_EN : CURRENT_SEASON_NAME);
    const seasonDayInfo = computed(() => {
      const now = nowForCountdown.value;
      const totalDays = countDailyResetsUntil(SEASON_START, SEASON_END) + 1;
      if (now < SEASON_START) return { current: 1, total: totalDays, ended: false };
      if (now > SEASON_END) return { current: totalDays, total: totalDays, ended: true };
      const current = Math.min(totalDays, countDailyResetsUntil(SEASON_START, now) + 1);
      return { current, total: totalDays, ended: false };
    });
    // 開始前（phase:'before'）は開始までを、開始後（'active'）は終了までを数え、終了後は ended:true。
    // 開始の瞬間に自動で「終了までのカウントダウン」へ切り替わる（毎秒の再計算なので手動更新は不要）。
    const seasonCountdown = computed(() => {
      const now = nowForCountdown.value;
      const before = now < SEASON_START;
      const diffMs = (before ? SEASON_START : SEASON_END) - now;
      if (diffMs <= 0) return { ended: true, phase: 'ended', days: 0, hours: 0, minutes: 0, seconds: 0 };
      const totalSeconds = Math.floor(diffMs / 1000);
      return { ended: false, phase: before ? 'before' : 'active', days: Math.floor(totalSeconds / 86400), hours: Math.floor((totalSeconds % 86400) / 3600), minutes: Math.floor((totalSeconds % 3600) / 60), seconds: totalSeconds % 60 };
    });
    const seasonStartText = computed(() => new Intl.DateTimeFormat(DATE_LOCALE, { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(SEASON_START));
    const seasonEndText = computed(() => new Intl.DateTimeFormat(DATE_LOCALE, { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(SEASON_END));

    /* ================================================================
       🎯 進捗ステータス文言・「あと何日で到達するか」の目安
       ================================================================ */
    const activeStatusText = computed(() => {
      const p = activePoints.value;
      if (p >= activeTier4Total.value) return t('status_complete');
      if (p >= activeTier3Total.value) return t('status_tier4');
      if (p >= activeTier2Total.value) return t('status_tier3');
      if (p >= 40) return t('status_tier2');
      return t('status_tier1');
    });
    const activeRemainingDays = computed(() => {
      let itemPoints = 0;
      Object.values(activeSpirit.value.treeData).forEach(tier => { tier.forEach(item => { if (item.checked) itemPoints += item.points; }); });
      const totalDaysNeeded = Math.max(0, Math.ceil((activeTier4Total.value - itemPoints) / 10));
      return Math.max(0, totalDaysNeeded - activeSpirit.value.walkDays);
    });

    /* ================================================================
       🚶 今日の連れ歩き記録・ストリーク・月間カレンダー・履歴
       ================================================================ */
    const todayWalkEntry = computed(() => walkLog.value.find(e => e.date === pfLocalDateStr()));
    const hasLoggedWalkToday = computed(() => !!todayWalkEntry.value);
    const todayWalkLogSpiritName = computed(() => {
      if (!todayWalkEntry.value) return '';
      const sp = spirits.value.find(s => s.id === todayWalkEntry.value.spiritId);
      return sp ? spiritName(sp) : '';
    });
    const logTodayWalk = (spiritId) => {
      if (hasLoggedWalkToday.value) return;
      const spirit = spirits.value.find(s => s.id === spiritId);
      if (!spirit) return;
      if (spirit.walkDays < 77) spirit.walkDays++;
      spirit.currentPreset = 'custom';
      walkLog.value.unshift({ date: pfLocalDateStr(), spiritId });
      if (walkLog.value.length > WALK_LOG_KEEP_MAX) walkLog.value.length = WALK_LOG_KEEP_MAX;
    };
    const walkLogDisplay = computed(() => walkLog.value.slice(0, WALK_LOG_DISPLAY_LIMIT).map(e => {
      const sp = spirits.value.find(s => s.id === e.spiritId);
      return { date: e.date, spiritNameDisplay: sp ? spiritName(sp) : '?' };
    }));
    const activeSpiritLoggedWalkDays = computed(() => walkLog.value.filter(e => e.spiritId === activeSpirit.value.id).length);
    const walkStreakInfo = computed(() => {
      const uniqueDayNums = Array.from(new Set(walkLog.value.map(e => e.date))).map(dayNumFromDateStr).sort((a, b) => a - b);
      if (!uniqueDayNums.length) return { current: 0, longest: 0 };
      let longest = 1, run = 1;
      for (let i = 1; i < uniqueDayNums.length; i++) {
        run = (uniqueDayNums[i] === uniqueDayNums[i - 1] + 1) ? run + 1 : 1;
        if (run > longest) longest = run;
      }
      const todayNum = dayNumFromDateStr(pfLocalDateStr());
      const lastDayNum = uniqueDayNums[uniqueDayNums.length - 1];
      let current = 0;
      if (lastDayNum === todayNum || lastDayNum === todayNum - 1) {
        current = 1;
        for (let i = uniqueDayNums.length - 1; i > 0; i--) {
          if (uniqueDayNums[i] === uniqueDayNums[i - 1] + 1) current++; else break;
        }
      }
      return { current, longest };
    });
    const currentWalkStreak = computed(() => walkStreakInfo.value.current);
    const longestWalkStreak = computed(() => walkStreakInfo.value.longest);
    const walkCalendarPrevMonth = () => { const d = walkCalendarViewDate.value; walkCalendarViewDate.value = new Date(d.getFullYear(), d.getMonth() - 1, 1); };
    const walkCalendarNextMonth = () => { const d = walkCalendarViewDate.value; walkCalendarViewDate.value = new Date(d.getFullYear(), d.getMonth() + 1, 1); };
    const walkCalendarLabel = computed(() => {
      const d = walkCalendarViewDate.value;
      return t('dash_walk_cal_month_label', { year: d.getFullYear(), month: pad2Local(d.getMonth() + 1) });
    });
    const walkCalendarDowLabels = computed(() => t('dash_walk_cal_dow').split(','));
    const walkCalendarDays = computed(() => {
      const viewDate = walkCalendarViewDate.value;
      const year = viewDate.getFullYear();
      const month = viewDate.getMonth();
      const firstWeekday = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const loggedDates = new Set(walkLog.value.map(e => e.date));
      const todayStr = pfLocalDateStr();
      const cells = [];
      for (let i = 0; i < firstWeekday; i++) cells.push({ key: 'pad-' + i, isPadding: true });
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${pad2Local(month + 1)}-${pad2Local(day)}`;
        cells.push({ key: dateStr, isPadding: false, day, hasLog: loggedDates.has(dateStr), isToday: dateStr === todayStr });
      }
      return cells;
    });

    // 📅 連れ歩きの記録カード（メイン画面）: 直近の週を右端に、日付ごとの記録の有無を草グラフ風に表示し、
    // マスをタップして過去の記録を追加・変更・削除できる。連れ歩き日数カウンター(walkDays)は記録の増減に連動させる。
    const WR_MIN_WEEKS = 18; // 使い始めでも極端に小さいグリッドにならない下限
    const WR_MAX_WEEKS = 53; // 直近1年ぶん
    const wrParse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
    const walkDateLabel = (date) => t('wr_date_label', { m: date.getMonth() + 1, d: date.getDate(), dow: t('dash_walk_cal_dow').split(',')[date.getDay()] });
    const walkEditDate = ref(null);
    const walkHeatmap = computed(() => {
        const today = wrParse(pfLocalDateStr());
        const byDate = new Map(walkLog.value.map(e => [e.date, e]));
        let minDate = today;
        walkLog.value.forEach(e => { const dt = wrParse(e.date); if (!isNaN(dt.getTime()) && dt < minDate) minDate = dt; });
        const daysSince = Math.max(0, Math.round((today - minDate) / 86400000));
        const weeks = Math.min(WR_MAX_WEEKS, Math.max(WR_MIN_WEEKS, Math.ceil((daysSince + 1) / 7) + 1));
        const end = new Date(today); end.setDate(end.getDate() + (6 - today.getDay())); // 右端＝今週の土曜（未来日は隠す）
        const start = new Date(end); start.setDate(start.getDate() - (weeks * 7 - 1));
        const todayStr = pfLocalDateStr();
        const cells = [];
        const monthLabels = [];
        let lastMonth = null, lastLabelCol = -99;
        for (let w = 0; w < weeks; w++) {
            const colDate = new Date(start); colDate.setDate(colDate.getDate() + w * 7);
            if (colDate.getMonth() !== lastMonth) {
                lastMonth = colDate.getMonth();
                if (w - lastLabelCol >= 2) { monthLabels.push({ col: w + 1, text: t('wr_month', { m: colDate.getMonth() + 1 }) }); lastLabelCol = w; }
            }
            for (let d = 0; d < 7; d++) {
                const date = new Date(start); date.setDate(date.getDate() + w * 7 + d);
                const dateStr = pfLocalDateStr(date);
                const entry = byDate.get(dateStr);
                const sp = entry ? spirits.value.find(s => s.id === entry.spiritId) : null;
                const isFuture = date > today;
                cells.push({
                    dateStr, col: w + 1, row: d + 1, isFuture, recorded: !!entry, isToday: dateStr === todayStr,
                    title: isFuture ? '' : (entry ? t('wr_cell_recorded', { date: walkDateLabel(date), name: sp ? spiritName(sp) : '?' }) : t('wr_cell_empty', { date: walkDateLabel(date) }))
                });
            }
        }
        return { weeks, cells, monthLabels };
    });
    const walkEditEntry = computed(() => walkEditDate.value ? (walkLog.value.find(e => e.date === walkEditDate.value) || null) : null);
    const walkEditSpiritName = computed(() => {
        if (!walkEditEntry.value) return '';
        const sp = spirits.value.find(s => s.id === walkEditEntry.value.spiritId);
        return sp ? spiritName(sp) : '?';
    });
    const walkEditLabel = computed(() => {
        if (!walkEditDate.value) return '';
        const date = wrParse(walkEditDate.value);
        return t('wr_edit_title_date', { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate(), dow: t('dash_walk_cal_dow').split(',')[date.getDay()] });
    });
    const openWalkEdit = (dateStr) => {
        if (dateStr > pfLocalDateStr()) return; // 未来の日付は記録できない
        walkEditDate.value = (walkEditDate.value === dateStr) ? null : dateStr;
    };
    const wrAdjustWalkDays = (spiritId, delta) => {
        const sp = spirits.value.find(s => s.id === spiritId);
        if (!sp) return;
        sp.walkDays = Math.min(77, Math.max(0, sp.walkDays + delta));
        sp.currentPreset = 'custom';
    };
    const setWalkLogFor = (dateStr, spiritId) => {
        if (dateStr > pfLocalDateStr()) return;
        const existing = walkLog.value.find(e => e.date === dateStr);
        if (existing) {
            if (existing.spiritId === spiritId) return;
            wrAdjustWalkDays(existing.spiritId, -1);
            wrAdjustWalkDays(spiritId, +1);
            existing.spiritId = spiritId;
            return;
        }
        wrAdjustWalkDays(spiritId, +1);
        walkLog.value.push({ date: dateStr, spiritId });
        walkLog.value.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // 新しい順を保つ
        if (walkLog.value.length > WALK_LOG_KEEP_MAX) walkLog.value.length = WALK_LOG_KEEP_MAX;
    };
    const removeWalkLogFor = (dateStr) => {
        const idx = walkLog.value.findIndex(e => e.date === dateStr);
        if (idx < 0) return;
        wrAdjustWalkDays(walkLog.value[idx].spiritId, -1);
        walkLog.value.splice(idx, 1);
    };
    // 直近（グリッドの右端）がまず目に入るよう、横スクロールは右端に寄せておく
    const wrScrollToEnd = () => nextTick(() => { const el = document.getElementById('wrScroll'); if (el) el.scrollLeft = el.scrollWidth; });
    onMounted(wrScrollToEnd);
    watch(() => walkHeatmap.value.weeks, wrScrollToEnd);

    /* ================================================================
       🎉 「1年前の今日」通知バナー
       ================================================================ */
    const oneYearAgoWalkEntry = computed(() => {
      const now = new Date();
      const oneYearAgoStr = `${now.getFullYear() - 1}-${pad2Local(now.getMonth() + 1)}-${pad2Local(now.getDate())}`;
      return walkLog.value.find(e => e.date === oneYearAgoStr) || null;
    });
    const oneYearAgoSpiritName = computed(() => {
      if (!oneYearAgoWalkEntry.value) return '';
      const sp = spirits.value.find(s => s.id === oneYearAgoWalkEntry.value.spiritId);
      return sp ? spiritName(sp) : '';
    });
    const showOneYearAgoBanner = computed(() => !!oneYearAgoWalkEntry.value && !oneYearBannerDismissedToday.value);
    const dismissOneYearAgoBanner = () => {
      oneYearBannerDismissedToday.value = true;
      try { localStorage.setItem(nsKey(ONEYEAR_BANNER_DISMISS_KEY), pfLocalDateStr()); } catch (e) { /* noop */ }
    };

    /* ================================================================
       🔔 トースト・📋 クリップボードコピー
       ================================================================ */
    const showToast = (msg) => {
      if (!msg) return;
      toastMessage.value = msg;
      toastVisible.value = true;
      clearTimeout(toastHideTimer);
      toastHideTimer = setTimeout(() => { toastVisible.value = false; }, 2600);
    };
    const pfCopyStatusTimers = new WeakMap();
    const pfCopyText = async (text, statusRef) => {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement('textarea');
          ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; ta.style.pointerEvents = 'none';
          document.body.appendChild(ta); ta.focus(); ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        statusRef.value = t('copy_success');
        showToast(t('copy_success'));
      } catch (e) {
        console.error('pfCopyText', e);
        statusRef.value = t('copy_failed');
        showToast(t('copy_failed'));
      }
      if (pfCopyStatusTimers.has(statusRef)) clearTimeout(pfCopyStatusTimers.get(statusRef));
      pfCopyStatusTimers.set(statusRef, setTimeout(() => { statusRef.value = ''; }, 3000));
    };
    const optCopyPlan = () => {
      const rows = optimizerRows.value;
      const lines = [t('opt_title')];
      if (rows.length === 0) {
        lines.push(t('opt_empty'));
      } else {
        rows.forEach((row, idx) => {
          let statusText;
          if (row.done) statusText = `✓ ${t('opt_done')}`;
          else if (row.affordableNow) statusText = t('opt_now');
          else if (row.unreachable) statusText = t('opt_unreachable');
          else statusText = `${row.dateText}${t('opt_est_suffix')}${row.inSeason ? ' ✓' + t('opt_within') : ' ⚠' + t('opt_over')}`;
          lines.push(`${idx + 1}. ${row.name} 🕯️${row.candles}（${t('opt_cum')} ${row.cumulative}） - ${statusText}`);
        });
        const s = optimizerSummary.value;
        lines.push('');
        lines.push(`${t('opt_total_pre')} ${s.totalCost}${t('opt_total_unit')}（${t('opt_lack')} ${s.lack}${t('opt_total_unit')}）`);
        lines.push(`${t('opt_reachable_pre').trim()} ${s.reachable} / ${s.total}${t('opt_reachable_post')}`);
      }
      pfCopyText(lines.join('\n'), optCopyStatus);
    };
    const heartCopyPlan = () => {
      const plan = activeFastestHeartPlan.value;
      const lines = [`${t('heart_title')}（${spiritName(activeSpirit.value)}）`];
      if (plan.alreadyDone) {
        lines.push(t('heart_done'));
      } else if (plan.unreachable) {
        lines.push(t('heart_unreachable'));
      } else {
        if (plan.day === 0) lines.push(t('heart_ready'));
        else lines.push(`${t('heart_plan_pre')} ${plan.day}${t('heart_plan_day_unit')}${t('heart_plan_post')}`);
        lines.push(`${t('heart_total_cost_pre')} ${plan.totalCost}${t('heart_total_cost_unit')}`);
        if (plan.readyExceptPass) lines.push(t('heart_pass_needed'));
        if (plan.order && plan.order.length) {
          lines.push('');
          plan.order.forEach((step, idx) => { lines.push(`${idx + 1}. ${step.day}${t('heart_order_day_suffix')} - ${step.name} 🕯️${step.candles}`); });
        }
      }
      pfCopyText(lines.join('\n'), heartCopyStatus);
    };

    /* ================================================================
       🗓️ ダッシュボードモーダル（features/shared/event-dashboard.js をmount）
       ================================================================ */
    const openDashboardModal = () => {
      if (dashOverlayEl.value) dashOverlayEl.value.classList.add('open');
      nextTick(() => { if (edbBodyEl.value) eventDashboard.mount(edbBodyEl.value, { icsExport: true }); });
    };
    const closeDashboardModal = () => {
      if (dashOverlayEl.value) dashOverlayEl.value.classList.remove('open');
      eventDashboard.unmount();
    };

    /* ================================================================
       💾 保存・読み込み（nsKey()でプロフィール名前空間化）
       ================================================================ */
    const save = () => {
      const data = {
        activeIndex: activeIndex.value,
        spirits: spirits.value,
        hasSeasonPass: hasSeasonPass.value,
        ownedCandles: ownedCandles.value,
        estimatedDailyCandles: estimatedDailyCandles.value,
        optimizerPlan: { ids: optimizerIds.value },
        walkLog: walkLog.value,
      };
      try { localStorage.setItem(nsKey(DATA_KEY), JSON.stringify(data)); } catch (e) { /* 保存領域の上限などで失敗した場合、今回の保存のみスキップする */ }
    };
    const applyLoadedData = (parsed) => {
      if (!parsed) return;
      if (Number.isInteger(parsed.activeIndex) && parsed.activeIndex >= 0 && parsed.activeIndex < spirits.value.length) activeIndex.value = parsed.activeIndex;
      if (parsed.hasSeasonPass !== undefined) hasSeasonPass.value = parsed.hasSeasonPass;
      if (parsed.ownedCandles !== undefined) ownedCandles.value = parsed.ownedCandles;
      if (parsed.optimizerPlan) optimizerIds.value = Array.isArray(parsed.optimizerPlan.ids) ? parsed.optimizerPlan.ids : [];
      const readDaily = (n) => {
        if (n === null || typeof n === 'object') return candlesPerDay.value;
        const v = Number(n);
        return Number.isFinite(v) ? v : candlesPerDay.value;
      };
      if (parsed.estimatedDailyCandles !== undefined) estimatedDailyCandles.value = readDaily(parsed.estimatedDailyCandles);
      else if (parsed.optimizerPlan && parsed.optimizerPlan.daily !== undefined) estimatedDailyCandles.value = readDaily(parsed.optimizerPlan.daily);
      if (Array.isArray(parsed.walkLog)) {
        walkLog.value = parsed.walkLog.filter(e => e && typeof e.date === 'string' && typeof e.spiritId === 'number').slice(0, WALK_LOG_KEEP_MAX);
      }
      if (parsed.spirits && Array.isArray(parsed.spirits)) {
        parsed.spirits.forEach((savedSpirit, sIdx) => {
          if (!spirits.value[sIdx] || !savedSpirit || !savedSpirit.treeData) return;
          if (savedSpirit.walkDays !== undefined) spirits.value[sIdx].walkDays = savedSpirit.walkDays;
          if (savedSpirit.currentPreset) spirits.value[sIdx].currentPreset = savedSpirit.currentPreset;
          Object.keys(savedSpirit.treeData).forEach(tierKey => {
            if (spirits.value[sIdx].treeData[tierKey]) {
              savedSpirit.treeData[tierKey].forEach((savedItem, iIdx) => {
                const targetItem = spirits.value[sIdx].treeData[tierKey][iIdx];
                if (!targetItem || (savedItem.id && targetItem.id !== savedItem.id)) return;
                targetItem.checked = savedItem.checked;
                if (savedItem.excluded !== undefined) targetItem.excluded = savedItem.excluded;
              });
            }
          });
        });
      }
    };
    const load = () => {
      try {
        const saved = localStorage.getItem(nsKey(DATA_KEY));
        if (saved) applyLoadedData(JSON.parse(saved));
      } catch (e) { console.error(e); }
      try { oneYearBannerDismissedToday.value = localStorage.getItem(nsKey(ONEYEAR_BANNER_DISMISS_KEY)) === pfLocalDateStr(); } catch (e) { oneYearBannerDismissedToday.value = false; }
    };

    onMounted(() => {
      load();
      seasonCountdownTimer = setInterval(() => { nowForCountdown.value = new Date(); }, 1000);
    });
    onUnmounted(() => {
      if (seasonCountdownTimer) clearInterval(seasonCountdownTimer);
      clearTimeout(toastHideTimer);
      eventDashboard.unmount();
    });
    watch([activeIndex, spirits, hasSeasonPass, ownedCandles, estimatedDailyCandles, walkLog], () => { save(); }, { deep: true });

    return {
      t, fmtNum, pad2, spiritName, translateItemName, seasonNameDisplay,
      activeIndex, spirits, activeSpirit, activePoints, totalHearts, activeTier2Total, activeTier3Total, activeTier4Total, getSpiritTier4Total, getSpiritPoints, toggleTreeItem, toggleExcluded,
      activeStatusText, activeRemainingDays,
      incrementWalkDays, decrementWalkDays, applyPreset, resetAllConfirming, requestResetAll, cancelResetAll,
      getIcon, getItemImageUrl, TYPE_IMAGES, getLevel, cleanName, getItemLabel, getItemLabelForSpirit, isPhantomItem, getTier2Slots,
      showOptimizer, optSelectedId, estimatedDailyCandles, optimizerCandidates, optimizerRows, optimizerSummary, optAdd, optMove, optRemove,
      optCopyStatus, optCopyPlan, heartCopyStatus, heartCopyPlan,
      hasSeasonPass, ownedCandles, candlesPerDay,
      showForecast, showHeartPlanDetail, showMultiSpiritLog, showMultiSpiritPlan,
      activeCandleItems, activeTotalCandles, activeRemainingCandles, activeDistributedCandles, activeExcludedCandles,
      totalRemainingCandles, candleBudgetPct,
      multiSpiritPlan,
      seasonStartText, seasonEndText, seasonCountdown, seasonDayInfo,
      activeFastestHeartPlan,
      walkLog, showWalkHistory, walkLogDisplay, hasLoggedWalkToday, todayWalkLogSpiritName, logTodayWalk, activeSpiritLoggedWalkDays,
      currentWalkStreak, longestWalkStreak,
      showWalkCalendar, walkCalendarLabel, walkCalendarDowLabels, walkCalendarDays, walkCalendarPrevMonth, walkCalendarNextMonth,
      walkHeatmap, walkEditDate, walkEditEntry, walkEditSpiritName, walkEditLabel, openWalkEdit, setWalkLogFor, removeWalkLogFor,
      showOneYearAgoBanner, oneYearAgoSpiritName, dismissOneYearAgoBanner,
      spiritForecasts, grandTotalCandles, getForecastIconId, forecastEtaText,
      dashOverlayEl, openDashboardModal, closeDashboardModal, edbBodyEl,
      toastMessage, toastVisible,
    };
  };
}

/* ================================================================
   公開API
   ================================================================ */
let app = null;
let mountToken = 0;

export async function mount(container /* , sub */) {
  const myToken = ++mountToken;
  injectStylesheet();
  injectLocalIconSprite();

  await ensureVue();
  if (myToken !== mountToken) return;

  container.innerHTML = '<div id="companion-vue-root"></div>';

  const Vue = window.Vue;
  app = Vue.createApp({ setup: buildSetup(Vue), template: TEMPLATE });
  app.mount('#companion-vue-root');
}

export function unmount() {
  mountToken++;
  eventDashboard.unmount();
  if (app) { app.unmount(); app = null; }
}

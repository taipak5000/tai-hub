/* ================================================================
   tai-revisit（再訪精霊データベース）のツール固有i18n辞書。

   移植元: tai-revisit/index.html の `const I18N = {...}`。元の辞書には
   relatedTools/toolXxx/settingsXxx/dockXxx/themeXxx等、taipak5000.github.io
   系ツール共通の「共有chrome」文言も含まれていたが、tai-hub側の共有chrome
   （js/chrome/*.js）が既に自分自身の翻訳を持っているため、それらは意図的に
   移植せず、このツール自身の文言（検索・フィルター・精霊カード・再訪達成度・
   進行中/次回の特別来訪・フッター）だけを残している。各キーのja/en文言・
   テンプレート（{n}等のプレースホルダー）は元の値を一切変更していない。

   t(key, vars) は元の実装の t(key, vars) と同じ挙動（現在言語→ja→キー自身に
   フォールバックし、{varName}を置換する）。
   ================================================================ */
import { CURRENT_LANG } from '../../../js/i18n.js';

export const REVISIT_I18N = {
  ja: {
    introPart1: '過去に来訪（Traveling Spirit）・特別来訪（Returning Spirits）した精霊の履歴を検索できる、閲覧専用の参考データベースです。所持チェックなどの記録機能はありません。データは',
    introPart2: 'プロジェクトを基にしています。',
    searchPlaceholder: '精霊名で検索…',
    seasonAll: 'すべての季節',
    areaAll: 'すべてのエリア',
    sortLatest: '最新の来訪順',
    sortDaysSince: '最終来訪からの日数が長い順',
    sortName: '精霊名順',
    sortCount: '来訪回数が多い順',
    sortItemCount: 'アイテム数が多い順',
    sortItemCountAsc: 'アイテム数が少ない順',
    sortOngoing: '進行中の再訪を優先',
    clearAllFiltersBtn: 'フィルターを全てクリア',
    collapseSummary: 'まだ一度も再訪が来ていない精霊',
    collapseNote: '季節精霊のうち、来訪（Traveling Spirit）・特別来訪（Returning Spirits）が一度も来ていない精霊の一覧です。',
    filterStats: '{shown} / {total} 精霊',
    emptyState: '該当する精霊が見つかりませんでした',
    visitCountLine: '来訪 <span class="num-value">{count}</span><span class="num-unit"> 回</span>　・　最終来訪から <span class="num-value">{days}</span><span class="num-unit"> 日</span>',
    rankLabel: '{rank}位',
    rankTitle: '「最終来訪からの日数が長い順」での全精霊中の順位（検索・季節フィルターに関わらず一定）',
    neverRevisitedCount: '（{n}）',
    typeVisit: '来訪',
    typeReturning: '特別来訪',
    typeError: 'エラー表示',
    visitTypeLegendLabel: '来訪種別の凡例',
    ongoingBadge: '進行中の再訪',
    visitOngoingTitle: '{type}（進行中）',
    seasonSummaryLine: '{season}　・　精霊 {count} 体　・　来訪合計 {visits} 回　・　最も滞っているのは「{mostOverdue}」（{days}日）',
    seasonSummaryNeverLine: '　・　未再訪 {n} 体',
    seasonOverviewSummary: 'シーズン別 再訪達成度',
    seasonOverviewNote: '季節ごとに、来訪（Traveling Spirit）・特別来訪（Returning Spirits）が一度でも来た精霊の割合をまとめています。行をタップするとその季節で絞り込みます。',
    seasonOverviewOverallLine: '全季節合計: {revisited} / {total} 精霊が再訪済み（{pct}%）',
    seasonOverviewSubLine: '{revisited} / {total} 精霊　・　来訪合計 {visits} 回',
    upcomingSectionLabel: '進行中・次回の特別来訪',
    upcomingSectionSub: '現在進行中、またはこれから始まる特別来訪（Returning Spirits）の一覧です。',
    upcomingEmptyState: '現在、進行中・予定されている特別来訪はありません。',
    calendarOngoingBadge: '進行中',
    calendarNextBadge: '次回予定',
    footerDisclaimer: 'このサイトはSky 星を紡ぐ子どもたちの非公式ファンサイトです。thatgamecompanyは一切関与していません。',
    footerDataLabel: '再訪履歴データ: ',
    footerDataCredit: '（Silverfeelin氏、MIT License）／',
    footerIconLabel: '精霊アイコン: ',
    footerIconCredit: '© Sky: Children of the Light Icons by contributors of the Sky: Children of the Light wiki',
    footerCreditLabel: '作成・ご意見: ',
    footerRequestForm: 'リクエストフォーム',
    footerInfoLink: '設定・クレジット・プライバシーポリシー',
    treeProgressLabel: '精霊ツリー',
    treeManageBtn: 'ツリーを管理',
    treeLoading: '精霊ツリーを読み込み中…',
    treeManageTitle: '精霊ツリー管理で、この精霊のツリーをチェックする（閉じるとここに戻ります）',
  },
  en: {
    introPart1: 'A read-only reference database for looking up the visit history of Traveling Spirits and Returning Spirits. There is no ownership-tracking feature here. Data is based on the',
    introPart2: ' project.',
    searchPlaceholder: 'Search by spirit name…',
    seasonAll: 'All Seasons',
    areaAll: 'All Areas',
    sortLatest: 'Most Recent Visit',
    sortDaysSince: 'Longest Since Last Visit',
    sortName: 'Spirit Name',
    sortCount: 'Most Visits',
    sortItemCount: 'Most Items',
    sortItemCountAsc: 'Fewest Items',
    sortOngoing: 'Ongoing Revisits First',
    clearAllFiltersBtn: 'Clear all filters',
    collapseSummary: 'Never-Revisited Spirits',
    collapseNote: 'Seasonal spirits that have never had a Traveling Spirit or Returning Spirits visit.',
    filterStats: '{shown} / {total} spirits',
    emptyState: 'No matching spirits found',
    visitCountLine: 'Visited <span class="num-value">{count}</span><span class="num-unit">×</span> · <span class="num-value">{days}</span><span class="num-unit">d</span> since last visit',
    rankLabel: '#{rank}',
    rankTitle: 'Rank among all spirits by "Longest Since Last Visit" (unaffected by search/season filter)',
    neverRevisitedCount: '({n})',
    typeVisit: 'Visit',
    typeReturning: 'Returning Spirits',
    typeError: 'Display Error',
    visitTypeLegendLabel: 'Visit type legend',
    ongoingBadge: 'Ongoing Revisit',
    visitOngoingTitle: '{type} (ongoing)',
    seasonSummaryLine: '{season} · {count} spirits · {visits} total visits · most overdue: {mostOverdue} ({days}d)',
    seasonSummaryNeverLine: ' · {n} never revisited',
    seasonOverviewSummary: 'Season Achievement Overview',
    seasonOverviewNote: 'Shows, for each season, the share of spirits that have had at least one Traveling Spirit or Returning Spirits visit. Tap a row to filter the list by that season.',
    seasonOverviewOverallLine: 'All seasons: {revisited} / {total} spirits revisited ({pct}%)',
    seasonOverviewSubLine: '{revisited} / {total} spirits · {visits} total visits',
    upcomingSectionLabel: 'Ongoing & Next Returning Spirits',
    upcomingSectionSub: 'Returning Spirits currently active or scheduled to start soon.',
    upcomingEmptyState: 'No ongoing or upcoming Returning Spirits right now.',
    calendarOngoingBadge: 'Ongoing',
    calendarNextBadge: 'Coming Up',
    footerDisclaimer: 'This is an unofficial fan site for Sky: Children of the Light. thatgamecompany is not involved in any way.',
    footerDataLabel: 'Revisit history data: ',
    footerDataCredit: ' (by Silverfeelin, MIT License) / ',
    footerIconLabel: 'Spirit icons: ',
    footerIconCredit: '© Sky: Children of the Light Icons by contributors of the Sky: Children of the Light wiki',
    footerCreditLabel: 'Created by / feedback: ',
    footerRequestForm: 'Request form',
    footerInfoLink: "Settings / Credits / Privacy Policy",
    treeProgressLabel: 'Spirit tree',
    treeManageBtn: 'Manage tree',
    treeLoading: 'Loading spirit tree…',
    treeManageTitle: 'Check off this spirit\'s tree in the Spirit Tree Tracker (closing it brings you back here)',
  },
};

export function t(key, vars) {
  let str = (REVISIT_I18N[CURRENT_LANG] && REVISIT_I18N[CURRENT_LANG][key] !== undefined)
    ? REVISIT_I18N[CURRENT_LANG][key]
    : (REVISIT_I18N.ja[key] !== undefined ? REVISIT_I18N.ja[key] : key);
  if (vars) {
    Object.keys(vars).forEach((k) => { str = str.split('{' + k + '}').join(vars[k]); });
  }
  return str;
}

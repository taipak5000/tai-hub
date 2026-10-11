/* ================================================================
   spirit-catalog（精霊ツリー管理）専用の i18n 辞書。

   移植元: spirit-catalog/index.html の I18N オブジェクト
   （filter/grid/browse/stats/titles/detail/revisitBadge/realm/footer
   セクション相当）から、このツール自身の文言だけを抜き出したもの。
   共有chrome（プロフィール・ダッシュボード・バックアップ・ホーム画面
   アイコン・共有画像カスタマイズ等）の訳文は、それらの機能自体を
   移植していないため含めていない（詳細はビュー側のコメント参照）。

   js/i18n.js の CURRENT_LANG（非リアクティブ、setLang()はページ
   リロードで切り替える設計）をそのまま使う、他の移植済みツールと
   同じ方針。
   ================================================================ */
import { CURRENT_LANG } from '../../../js/i18n.js';

export const I18N = {
  common: { labelSep: { ja: '：', en: ': ' } },
  filter: {
    sectionLabel: { ja: '検索・絞り込み', en: 'Search & Filter' },
    searchPlaceholder: { ja: '精霊名・アイテム名で検索…', en: 'Search by spirit or item name…' },
    typeAll: { ja: 'すべての種別', en: 'All Types' },
    typeSeason: { ja: '季節精霊', en: 'Seasonal' },
    typeRegular: { ja: '恒常精霊', en: 'Regular' },
    typeElder: { ja: '長老', en: 'Elder' },
    typeGuide: { ja: '季節ガイド', en: 'Guide' },
    typeSpecial: { ja: '特殊', en: 'Special' },
    seasonAll: { ja: 'すべてのシーズン', en: 'All Seasons' },
    progressAll: { ja: 'すべての進捗', en: 'All Progress' },
    progressIncomplete: { ja: '未完了のみ', en: 'Incomplete Only' },
    progressComplete: { ja: '完了済みのみ', en: 'Complete Only' },
    progressUntouched: { ja: '未着手のみ', en: 'Not Started Only' },
    statsTemplate: { ja: '{filtered} / {total} 件を表示', en: 'Showing {filtered} / {total}' },
    sortDefault: { ja: '既定の並び順', en: 'Default order' },
    sortNearestComplete: { ja: '達成に近い順', en: 'Nearest to completion' },
    clearAllBtn: { ja: 'フィルターを全てクリア', en: 'Clear All Filters' },
    remainingCostLabel: { ja: '残りコスト（現在の絞り込み）', en: 'Remaining cost (current filter)' },
    remainingCostZero: { ja: '0', en: '0' },
    revisitOnlyBtn: { ja: '再訪ツリーのみ', en: 'Revisit Trees Only' },
    costDisplayLabel: { ja: 'コスト表示', en: 'Cost Display' },
    costDisplayTestTag: { ja: 'テスト機能', en: 'Experimental' },
    costDisplayHint: { ja: '残りコスト・ツリー内の必要コストの数値は正確性を保証できないため、試験的な機能として提供しています。既定ではオフです。', en: 'Remaining-cost and in-tree cost figures are not guaranteed to be accurate, so this is provided as an experimental feature. It is off by default.' },
  },
  share: {
    twitterBtn: { ja: 'Xで画像を共有', en: 'Share image on X' },
    customizeBtn: { ja: 'カスタマイズして共有', en: 'Customize & share' },
  },
  grid: {
    sectionLabel: { ja: '精霊一覧', en: 'Spirit List' },
    emptyNote: { ja: '条件に一致する精霊が見つかりません', en: 'No spirits match the current filter.' },
  },
  browse: {
    modeGrid: { ja: '一覧', en: 'List' },
    modeArea: { ja: 'エリア別', en: 'By Area' },
    modeSeason: { ja: 'シーズン別', en: 'By Season' },
    otherAreas: { ja: 'その他の特別エリア', en: 'Other Special Areas' },
    noSeasonGroup: { ja: '季節に属さない精霊（恒常・長老・特殊）', en: 'Non-seasonal Spirits (Regular / Elder / Special)' },
    treesCompleteTemplate: { ja: 'ツリー {done}/{total} 件完了', en: '{done}/{total} trees complete' },
    nodesPctTemplate: { ja: 'ノード解放 {pct}%', en: 'Nodes {pct}% unlocked' },
    groupRemainingCostLabel: { ja: '残りコスト', en: 'Remaining cost' },
    bulkCatchUpBtnTemplate: { ja: '未完了の{count}件を一括で追いつかせる', en: 'Catch up {count} incomplete trees' },
    bulkCatchUpConfirmTemplate: { ja: 'ここに表示中の未完了ツリー{count}件（残りノード{nodes}件）をまとめて解放済みにします。この操作は個別に取り消す必要があります。よろしいですか？', en: 'Mark all {count} incomplete trees shown here ({nodes} remaining nodes) as complete? You will need to undo them one by one if this was a mistake. Continue?' },
    bulkCatchUpDoneToast: { ja: '{trees}件のツリー・{nodes}件のノードを解放済みにしました', en: 'Marked {trees} trees ({nodes} nodes) as complete' },
    bulkQuestCatchUpBtnTemplate: { ja: 'クエスト未完了の{count}件をまとめて完了済みにする', en: 'Catch up quests in {count} trees' },
    bulkQuestCatchUpConfirmTemplate: { ja: 'ここに表示中のクエスト未完了ツリー{count}件（残りクエスト{nodes}件）をまとめて完了済みにします。この操作は個別に取り消す必要があります。よろしいですか？', en: 'Mark all {count} trees with incomplete quests shown here ({nodes} remaining quests) as complete? You will need to undo them one by one if this was a mistake. Continue?' },
    bulkQuestCatchUpDoneToast: { ja: '{trees}件のツリー・{nodes}件のクエストを完了済みにしました', en: 'Marked {trees} trees ({nodes} quests) as complete' },
    bulkHeartCatchUpBtnTemplate: { ja: 'ハート未獲得の{count}件をまとめて獲得済みにする', en: 'Catch up hearts in {count} trees' },
    bulkHeartCatchUpConfirmTemplate: { ja: 'ここに表示中のハート未獲得ツリー{count}件（残りハート{nodes}件）をまとめて獲得済みにします。この操作は個別に取り消す必要があります。よろしいですか？', en: 'Mark all {count} trees with un-obtained hearts shown here ({nodes} remaining hearts) as obtained? You will need to undo them one by one if this was a mistake. Continue?' },
    bulkHeartCatchUpDoneToast: { ja: '{trees}件のツリー・{nodes}件のハートを獲得済みにしました', en: 'Marked {trees} trees ({nodes} hearts) as obtained' },
  },
  stats: {
    overallPctLabel: { ja: '全体の達成率', en: 'Overall Completion Rate' },
    unlockedNodes: { ja: '解放済みノード', en: 'Unlocked Nodes' },
    completeSpirits: { ja: 'コンプリート済み精霊', en: 'Completed Spirits' },
    candleHeartUsed: { ja: '使用したキャンドル/ハート（全ツリー合計）', en: 'Candles/Hearts used (all trees)' },
    seasonCandleHeartUsed: { ja: '使用したシーズンキャンドル/ハート（全ツリー合計）', en: 'Season Candles/Hearts used (all trees)' },
    grandRemainingCostLabel: { ja: '残りコスト（現在の絞り込みに関わらず全{total}ツリー合計）', en: 'Remaining cost (all {total} trees, regardless of filter)' },
    syncRefreshBtn: { ja: 'アイテム所持管理・羽トラッカーとの同期を更新', en: 'Refresh sync with Item Collection & Wing Tracker' },
    syncRefreshHint: { ja: 'アイテム所持管理・エモート所持率管理・羽トラッカーを別タブで操作した直後は、ここを押すと最新の状態に反映されます', en: 'If you just made changes in Item Collection, Emote Collection, or Wing Tracker in another tab, tap this to pull in the latest state' },
  },
  titles: {
    sectionLabel: { ja: '称号', en: 'Titles' },
    countTemplate: { ja: '{earned} / {total} 個解除', en: '{earned} / {total} unlocked' },
    lockedName: { ja: '？？？', en: '？？？' },
    lockedHint: { ja: '称号は条件を満たすと明らかになります', en: 'Unlocks when you meet its condition' },
    unlockedToast: { ja: '称号「{name}」を獲得しました！', en: 'Title earned: “{name}”!' },
    pct1: { name: { ja: '芽吹きの精霊使い', en: 'Budding Spirit Keeper' }, desc: { ja: '精霊ツリーのノードを1%以上解放した', en: 'Unlocked 1%+ of all spirit tree nodes' } },
    pct10: { name: { ja: '灯火の道しるべ', en: 'Candlelit Trailblazer' }, desc: { ja: '精霊ツリーのノードを10%以上解放した', en: 'Unlocked 10%+ of all spirit tree nodes' } },
    pct25: { name: { ja: '深緑の探求者', en: 'Verdant Explorer' }, desc: { ja: '精霊ツリーのノードを25%以上解放した', en: 'Unlocked 25%+ of all spirit tree nodes' } },
    pct50: { name: { ja: '満開の森の守り人', en: 'Guardian of the Blooming Grove' }, desc: { ja: '精霊ツリーのノードを50%以上解放した', en: 'Unlocked 50%+ of all spirit tree nodes' } },
    pct100: { name: { ja: '精霊の森の賢者', en: 'Sage of the Spirit Forest' }, desc: { ja: '精霊ツリーの全ノードをコンプリートした', en: 'Unlocked 100% of all spirit tree nodes' } },
  },
  detail: {
    progress: { ja: '進捗', en: 'Progress' },
    revisitTemplate: { ja: '再訪ツリー({name} / {date})', en: 'Revisit Tree ({name} / {date})' },
    revisitTreeBadgeTitle: { ja: '再訪ツリー', en: 'Revisit Tree' },
    noItemName: { ja: '（アイテム不明）', en: '(Unknown Item)' },
    warpNodeTitleTemplate: { ja: '{name}（イベント期間限定のワープ機能のため管理対象外）', en: '{name} (event-limited warp feature — not tracked)' },
    accompanyNodeTitleTemplate: { ja: '{name}（イベント期間限定の同伴ボタンのため管理対象外）', en: '{name} (event-limited accompany button — not tracked)' },
    wingSyncTitle: { ja: '羽トラッカーと同期されます', en: 'Synced with Wing Tracker' },
    emoteSyncTitleTemplate: { ja: 'エモート管理と同期されます（Lv{level}）', en: 'Synced with Emote Collection (Lv{level})' },
    tierLabelTemplate: { ja: '段 {n}', en: 'Tier {n}' },
    markAllBtn: { ja: 'このツリーを全て解放済みにする', en: 'Mark entire tree as complete' },
    markAllConfirmTemplate: { ja: 'このツリーの未解放ノード {count} 件をすべて解放済みにします。この操作は個別に取り消す必要があります。よろしいですか？', en: 'Mark all {count} remaining locked nodes in this tree as unlocked? You will need to undo them one by one if this was a mistake. Continue?' },
    markAllConfirmBtn: { ja: '実行', en: 'Mark Complete' },
    markAllDoneToast: { ja: '{count}件のノードを解放済みにしました', en: 'Marked {count} nodes as complete' },
    markQuestsBtn: { ja: 'クエストをまとめて完了済みにする', en: 'Mark all quests as complete' },
    markQuestsConfirmTemplate: { ja: 'このツリーの未完了のクエスト {count} 件をすべて完了済みにします。この操作は個別に取り消す必要があります。よろしいですか？', en: 'Mark all {count} remaining incomplete quests in this tree as complete? You will need to undo them one by one if this was a mistake. Continue?' },
    markQuestsDoneToast: { ja: '{count}件のクエストを完了済みにしました', en: 'Marked {count} quests as complete' },
    markHeartsBtn: { ja: 'ハートをまとめて獲得済みにする', en: 'Mark all hearts as obtained' },
    markHeartsConfirmTemplate: { ja: 'このツリーの未獲得のハート {count} 件をすべて獲得済みにします。この操作は個別に取り消す必要があります。よろしいですか？', en: 'Mark all {count} remaining un-obtained hearts in this tree as obtained? You will need to undo them one by one if this was a mistake. Continue?' },
    markHeartsDoneToast: { ja: '{count}件のハートを獲得済みにしました', en: 'Marked {count} hearts as obtained' },
    tierVariantTitleTemplate: { ja: '同じアイテムのコスト違いバリエーション（{n}/{total}）', en: 'Cost-tier variant of the same item ({n} of {total})' },
    capeTierTitleTemplate: { ja: 'ケープのティア{n}（全{total}段階）。アイテム所持管理でも別のアイテムとして管理されます', en: 'Cape tier {n} (of {total}). Tracked as a separate item in the Item Collection Tracker' },
    emoteLevelBadgeTitleTemplate: { ja: '同じエモートのレベル違いバリエーション（Lv{n}・全{total}レベル中）', en: 'Level variant of the same emote (Lv{n} of {total})' },
    syncBadgeTitle: { ja: '連携ツール（アイテム/エモート/羽トラッカー）の所持データから自動で解放されました', en: 'Auto-unlocked via sync with a connected tool (item/emote/wing tracker)' },
    resetAllBtn: { ja: 'このツリーを全て未解放に戻す', en: 'Reset entire tree to locked' },
    resetAllConfirmTemplate: { ja: 'このツリーの解放済みノード {count} 件をすべて未解放に戻します。連携ツール（アイテム/エモート/羽トラッカー）側の所持データもあわせて未所持に戻ります。この操作は個別にやり直す必要があります。よろしいですか？', en: 'Reset all {count} unlocked nodes in this tree back to locked? This also clears ownership on connected tools (item/emote/wing tracker). You will need to redo them one by one if this was a mistake. Continue?' },
    resetAllConfirmBtn: { ja: 'リセット', en: 'Reset' },
    resetAllDoneToast: { ja: '{count}件のノードを未解放に戻しました', en: 'Reset {count} nodes to locked' },
  },
  revisitBadge: {
    activeTemplate: { ja: '再訪イベント開催中・残り <b>{time}</b>', en: 'Revisit event active — <b>{time}</b> left' },
    upcomingTemplate: { ja: '次の再訪イベントまで <b>{time}</b>', en: 'Next revisit event in <b>{time}</b>' },
    viewBtn: { ja: '再訪ツリーの精霊を見る', en: 'View Revisit-Tree Spirits' },
    dayUnit: { ja: '日', en: 'd' },
  },
  dash: {
    openBtn: { ja: '今日・今週・今月', en: 'Today / This Week / This Month' },
    modalTitle: { ja: '今日・今週・今月', en: 'Today / This Week / This Month' },
  },
  toast: {
    syncRefreshed: { ja: '同期を更新しました', en: 'Sync refreshed' },
    generating: { ja: '画像を生成中…', en: 'Generating image…' },
    saved: { ja: '画像を保存しました！', en: 'Image saved!' },
    shared: { ja: '共有しました！', en: 'Shared!' },
    saveFailed: { ja: '画像の保存に失敗しました', en: 'Failed to save the image' },
    dataLoading: { ja: 'データを読み込み中です', en: 'Data is still loading' },
  },
  theme: {
    green: { ja: 'グリーン', en: 'Green' },
    orange: { ja: 'オレンジ', en: 'Orange' },
    blue: { ja: 'ブルー', en: 'Blue' },
    purple: { ja: 'パープル', en: 'Purple' },
    pink: { ja: 'ピンク', en: 'Pink' },
    dark: { ja: 'ダーク', en: 'Dark' },
  },
  customize: {
    modalTitle: { ja: '画像をカスタマイズ', en: 'Customize Image' },
    themeLabel: { ja: '背景テーマ', en: 'Background Theme' },
    commentLabel: { ja: 'コメント（任意）', en: 'Comment (optional)' },
    commentPlaceholder: { ja: '例）プレイヤーネーム：〇〇（未入力の場合は通常の文言になります）', en: 'e.g. Player name: XX (leave blank to use the default text)' },
    shareBtn: { ja: 'この設定でXへ画像を共有', en: 'Share image on X with these settings' },
  },
  preview: {
    titleSave: { ja: '画像を保存', en: 'Save Image' },
    titleSaveShare: { ja: '画像を保存してXへ投稿', en: 'Save Image & Post to X' },
    hintSave: { ja: '画像を長押し（PCの場合は右クリック）して「画像を保存」を選んでください', en: 'Press and hold the image (or right-click on PC) and choose "Save Image"' },
    hintSaveShare: { ja: '① 下の「ダウンロード」で画像を保存 → ② 「Xの投稿画面を開く」を押して、保存した画像を添付して投稿してください', en: '① Save the image with "Download" below → ② Tap "Open X post screen" and attach the saved image to your post' },
    downloadBtn: { ja: 'ダウンロード', en: 'Download' },
    twitterBtn: { ja: 'Xの投稿画面を開く', en: 'Open X post screen' },
    imgAlt: { ja: '保存用の画像', en: 'Image to save' },
  },
  exportCard: {
    brand: { ja: '精霊ツリー管理', en: 'Spirit Tree Catalog' },
    heroLabel: { ja: '精霊ツリー解放率', en: 'Spirit Tree Unlock Rate' },
    numsTemplate: { ja: '解放済み {done} ／ 総ノード数 {total}', en: 'Unlocked {done} / Total Nodes {total}' },
    subTemplate: { ja: 'コンプリート済み {complete} / {totalSpirits} 精霊', en: 'Completed {complete} / {totalSpirits} Spirits' },
    dateTemplate: { ja: '{y}年{m}月{d}日作成', en: 'Created {m}/{d}/{y}' },
  },
  tweet: {
    template: {
      ja: '精霊ツリー解放率は{pct}でした！\n（解放済み {done} ／ 総ノード数 {total}）\nあなたは何%解放してる？✨\n\n{url}\n{hashtag}',
      en: "I've unlocked {pct} of my Spirit Tree! (Unlocked {done} / Total Nodes {total})\nHow much have you unlocked? ✨\n\n{url}\n{hashtag}",
    },
  },
  cancelBtn: { ja: '取消', en: 'Cancel' },
};

export function t(path, vars) {
  const parts = path.split('.');
  let node = I18N;
  for (const p of parts) { node = node && node[p]; }
  let s = node ? (node[CURRENT_LANG] !== undefined ? node[CURRENT_LANG] : node.ja) : path;
  if (s === undefined) s = path;
  if (vars) {
    Object.keys(vars).forEach((k) => { s = String(s).split('{' + k + '}').join(vars[k]); });
  }
  return s;
}

// 呼び出し数が少ない自前文言向けの素朴な t(ja, en) パターン（他の移植済みツールと同じ、
// nomacan-view.js の tt() 相当）。
export function tt(ja, en) { return CURRENT_LANG === 'en' ? en : ja; }

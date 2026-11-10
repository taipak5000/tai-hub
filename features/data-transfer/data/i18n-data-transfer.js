/* ================================================================
   data-transfer（データ引継ぎ）のツール固有i18n辞書。

   移植元: tai-transfer/index.html の `const I18N = {...}` のうち、
   tools.*・sidebar.*・dock.*・settings.*（「他のツール」ドロワーのラベル・
   表示設定モーダル等）は、tai-hub側の共有chrome（js/chrome/*.js）が既に
   自分自身の翻訳を持っているため意図的に移植していない。
   footer.*（フッターの免責事項・クレジット行・tai-infoリンク）は、
   tai-hub側の共有chromeにはこれを描画する仕組みが存在しない（各ツールが
   ビュー側で直書きする設計）ため、他の移植済みツール
   ［companion/tai-score/tai-revisit等］と同じく footer セクションとして
   このファイルに残し、ビュー側（data-transfer-view.js）で直書きする。
   残した page.* / dyn.* / footer.* の文言・テンプレート（{n}等の
   プレースホルダー・英語の単数/複数バリアント関数）は元の値を一切
   変更していない。

   t(key, vars) は nomacan/star-candle等、他の移植済みツールと同じ
   '.'区切りキー方式だが、値が文字列ではなく関数（vars => string）の
   場合はその場で呼び出す点だけ元のtai-transfer自身のt()に合わせている
   （英語の "1 key" vs "2 keys" のような、変数の値で文言自体が変わる
   ケースに対応するため）。
   ================================================================ */
import { CURRENT_LANG } from '../../../js/i18n.js';

const DT_I18N = {
  page: {
    sectionExport: { ja: '引き継ぎコードを作成', en: 'Create a Transfer Code' },
    sectionImport: { ja: 'コードから復元', en: 'Restore from a Code' },
    exportHint: {
      ja: '引き継ぐツールを選んでコードを作り、別の端末の「コードから復元」で読み込みます。コードは長いので、ファイルで送るのがおすすめです。プロフィール（保存枠）は必ず一緒に引き継がれます。',
      en: 'You can transfer data between devices using a file or copy & paste, without any external service like Dropbox. Select only the sites you want to bring over to generate a code, then load it into "Restore from a Code" on another device. The code is compressed automatically, but it can still get long, so downloading it as a file is recommended (you can send it via AirDrop or as a message attachment). This applies to data stored in this browser — the profiles (save slots) shared across taipak5000.github.io tools are always carried over together with it.',
    },
    importHint: {
      ja: 'コードのファイルを読み込むか、貼り付けてください。復元するツールを選べます。',
      en: 'Load the transfer code created on another device from a file, or paste it below. The sites contained in the code are detected automatically, and you can choose which ones to restore.',
    },
    pasteHint: { ja: 'またはコードを直接貼り付け：', en: 'Or paste the code directly:' },
    createCodeBtn: { ja: '選んだサイトのコードを作成', en: 'Create Code for Selected Sites' },
    loadCodeBtn: { ja: 'コードを読み込む', en: 'Load Code' },
    pastePlaceholder: { ja: 'ここに引き継ぎコードを貼り付け', en: 'Paste your transfer code here' },
    selectAllBtn: { ja: '全選択', en: 'Select All' },
    selectNoneBtn: { ja: '全解除', en: 'Deselect All' },
    selectWithDataBtn: { ja: 'データがあるサイトだけ', en: 'Only sites with data' },
    allProfilesOption: { ja: 'すべてのプロフィール', en: 'All profiles' },
    profileFilterAriaLabel: { ja: '{site}の引き継ぎプロフィールを絞り込む', en: 'Filter transferred profile for {site}' },
  },
  dyn: {
    creatingCode: { ja: 'コードを作成中…', en: 'Creating code…' },
    selectAtLeastOneSite: { ja: '少なくとも1つサイトを選んでください。', en: 'Please select at least one site.' },
    codeGenFailed: { ja: 'コードの生成に失敗しました。', en: 'Failed to generate the code.' },
    keysCount: { ja: '{n}件', en: vars => `${vars.n} ${vars.n === 1 ? 'key' : 'keys'}` },
    exportSummary: { ja: '選択したサイト: {sites}（{count}件のキー、コード{length}文字{compressNote}）', en: 'Selected sites: {sites} ({count} keys, code is {length} characters{compressNote})' },
    hiddenOnlyExportSummary: { ja: '非公開ツールのデータのみが含まれています（{count}件のキー、コード{length}文字{compressNote}）', en: 'Only data from private (unpublished) tools is included ({count} keys, code is {length} characters{compressNote})' },
    compressNote: { ja: '　圧縮で約{rate}%短縮済み', en: ' · Compressed by about {rate}%' },
    downloadBtn: { ja: 'ファイルとしてダウンロード（推奨）', en: 'Download as File (Recommended)' },
    showCodeBtn: { ja: 'コードをテキストで表示してコピー', en: 'Show Code as Text to Copy' },
    copyCodeBtn: { ja: 'コードをコピー', en: 'Copy Code' },
    showQrBtn: { ja: 'QRコードを表示', en: 'Show QR Code' },
    qrLoading: { ja: 'QRコードを準備中…', en: 'Preparing QR code…' },
    qrAlt: { ja: 'データ引き継ぎ用のQRコード', en: 'QR code for data transfer' },
    qrCaption: { ja: '別の端末のカメラや読み取りアプリでスキャンしてください。', en: "Scan this with another device's camera or a QR reader app." },
    qrTooLong: { ja: 'コードが長すぎるため、QRコードとしては表示できません。「ファイルとしてダウンロード」またはコピー&ペーストをご利用ください。', en: 'This code is too long to display as a QR code. Please use "Download as File" or copy & paste instead.' },
    qrLoadFailed: { ja: 'QRコード表示用のライブラリの読み込みに失敗しました。通信環境をご確認のうえ、もう一度お試しください。', en: 'Failed to load the QR code library. Please check your connection and try again.' },
    downloadSuccess: { ja: 'ファイルをダウンロードしました。別の端末に送って「コードから復元」の「ファイルを選択」で読み込んでください。', en: 'File downloaded. Send it to another device and load it using "Choose File" under "Restore from a Code".' },
    copySuccess: { ja: 'コピーしました。別の端末の「コードから復元」に貼り付けてください。', en: 'Copied. Paste it into "Restore from a Code" on another device.' },
    copyFailed: { ja: 'コピーに失敗しました。コードが選択された状態なので、手動でコピーしてください。', en: 'Copy failed. The code is selected, so please copy it manually.' },
    fileReadFailed: { ja: 'ファイルの読み込みに失敗しました。', en: 'Failed to read the file.' },
    codeLoadFailed: { ja: 'コードの読み込みに失敗しました（コードの一部が欠けているか、正しくないコードです）。', en: 'Failed to load the code (it may be incomplete or invalid).' },
    notThisToolCode: { ja: 'このツールで作成したコードではないようです。', en: "This doesn't look like a code created by this tool." },
    noMatchingSiteData: { ja: 'コードの中に、対応するサイトのデータが見つかりませんでした。', en: 'No supported site data was found in this code.' },
    selectSitesToRestore: { ja: '復元するサイトを選んでください：', en: 'Select the sites to restore:' },
    hiddenOnlyImportNotice: { ja: '非公開ツールのデータのみが含まれています。', en: 'Only data from private (unpublished) tools is included.' },
    restoreBtn: { ja: '選んだサイトを復元する', en: 'Restore Selected Sites' },
    restoreSuccess: { ja: '{n}件のキーを復元しました。', en: vars => `Restored ${vars.n} ${vars.n === 1 ? 'key' : 'keys'}.` },
    siteUpdatedListHeading: { ja: '各サイトの最終更新（このツールで検知した限りの日時）', en: 'Last updated per site (as detected by this tool)' },
    overwriteSitesLabel: { ja: '⚠️ 既にこの端末にデータがあり、上書きされるサイト：', en: '⚠️ Sites that already have local data on this device and will be overwritten:' },
    overwriteHiddenNote: { ja: '（このほか非公開ツールのデータも{n}件、上書きされます）', en: vars => ` (plus data from ${vars.n} private ${vars.n === 1 ? 'tool' : 'tools'}, also overwritten)` },
    overwriteHiddenOnlyLabel: { ja: '⚠️ 非公開ツールのデータ{n}件が、既にこの端末にあるデータを上書きします。', en: vars => `⚠️ Data from ${vars.n} private ${vars.n === 1 ? 'tool' : 'tools'} will overwrite data already on this device.` },
    newProfilesLabel: { ja: '新しいプロフィールが{n}件追加されます：{names}', en: vars => `${vars.n} new ${vars.n === 1 ? 'profile' : 'profiles'} will be added: ${vars.names}` },
    importCodeDateLabel: { ja: 'コード内', en: 'in code' },
    importLocalDateLabel: { ja: 'ローカル', en: 'local' },
    importLocalNewerFlag: { ja: ' ❗ローカルの方が新しい可能性があります', en: ' ❗ Local data may be newer' },
    importOverwriteConfirmText: { ja: '本当に上書きしてよろしいですか？この操作は取り消せません。心配な場合は、先に「エクスポート」で現在のデータをバックアップしておくことをおすすめします。', en: "Are you sure you want to overwrite? This cannot be undone. If you're unsure, we recommend backing up your current data with \"Export\" first." },
    importOverwriteConfirmBtn: { ja: '⚠️ 上書きして復元する', en: '⚠️ Overwrite and Restore' },
    cancelBtn: { ja: '取消', en: 'Cancel' },
    restoreSuccessNewProfiles: { ja: '新しいプロフィールも{n}件追加されました：{names}', en: vars => ` ${vars.n} new ${vars.n === 1 ? 'profile was' : 'profiles were'} also added: ${vars.names}` },
    restoreFailedKeys: { ja: ' ⚠️ {n}件は保存に失敗しました（保存容量の上限などが原因の可能性があります）。', en: vars => ` ⚠️ ${vars.n} ${vars.n === 1 ? 'key' : 'keys'} failed to save (this may be due to reaching the browser's storage limit).` },
    changedSinceBackupTitle: { ja: '前回のバックアップから内容が変わっています', en: 'Changed since your last backup' },
    diffSummaryPrefix: { ja: '内容差分：', en: 'Content diff: ' },
    diffEntriesAdded: { ja: '新規データ{n}件', en: vars => `${vars.n} new ${vars.n === 1 ? 'entry' : 'entries'}` },
    diffTitlesAdded: { ja: '称号{n}件を新たに獲得', en: vars => `${vars.n} new ${vars.n === 1 ? 'title' : 'titles'}` },
    diffEntriesChanged: { ja: '{n}件の内容が変化', en: vars => `${vars.n} ${vars.n === 1 ? 'entry' : 'entries'} changed` },
    diffEntriesRemoved: { ja: 'ローカルのみのデータ{n}件は消えます', en: vars => `${vars.n} local-only ${vars.n === 1 ? 'entry' : 'entries'} would be lost` },
    showLinkBtn: { ja: 'リンクとしてコピー', en: 'Copy as Link' },
    copyLinkBtn: { ja: 'リンクをコピー', en: 'Copy Link' },
    copyLinkSuccess: { ja: 'リンクをコピーしました。別の端末でこのリンクを開くと、コードが自動で読み込まれます。', en: 'Link copied. Opening it on another device will load the code automatically.' },
    copyLinkFailed: { ja: 'コピーに失敗しました。リンクが選択された状態なので、手動でコピーしてください。', en: 'Copy failed. The link is selected, so please copy it manually.' },
    linkTooLongNote: { ja: 'リンクが長くなっています。開く環境によってはうまく機能しない場合があります。心配な場合はファイルまたはQRコードもご利用ください。', en: "This link is quite long. It may not work well in some apps — consider the file or QR code options if you're concerned." },
    linkAutoLoadedNotice: { ja: 'リンクからコードを読み込みました。復元したいサイトを選んでください。', en: 'Code loaded from a link. Select the sites you want to restore.' },
    showHistoryBtn: { ja: '書き出し/読込履歴を見る', en: 'View Transfer History' },
    hideHistoryBtn: { ja: '履歴を隠す', en: 'Hide History' },
    historyHiddenNote: { ja: '非公開ツール{n}件', en: vars => `${vars.n} private ${vars.n === 1 ? 'tool' : 'tools'}` },
    historyNoSites: { ja: '（サイトなし）', en: '(no sites)' },
    historyExportRowLabel: { ja: '書き出し：{date}・{sites}', en: 'Export: {date} · {sites}' },
    historyImportRowLabel: { ja: '読込：{date}・{sites}', en: 'Import: {date} · {sites}' },
  },
  footer: {
    creditLabel: { ja: '作成・ご意見:', en: 'Created by / feedback:' },
    requestForm: { ja: 'リクエストフォーム', en: 'Request form' },
    infoLink: { ja: '設定・クレジット・プライバシーポリシー', en: "Settings / Credits / Privacy Policy" },
  },
};

export function t(key, vars) {
  const parts = key.split('.');
  let node = DT_I18N;
  for (const p of parts) node = node ? node[p] : undefined;
  let entry = node ? (node[CURRENT_LANG] !== undefined ? node[CURRENT_LANG] : node.ja) : undefined;
  if (entry === undefined) entry = '';
  let str = typeof entry === 'function' ? entry(vars || {}) : entry;
  if (vars) {
    Object.keys(vars).forEach((k) => { str = str.split('{' + k + '}').join(vars[k]); });
  }
  return str;
}

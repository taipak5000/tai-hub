/* ================================================================
   📝 更新履歴のデータ（#/changelog が表示する。js/app-update.js が「新しいバージョンがあるか」の判定にも使う）。
   ・新しい順に並べる。先頭の version が「今のバージョン」になる。
   ・利用者に届く変更を公開したら、先頭に1件足す（同じ日に2回目なら '2026.11.06.2' のように末尾に番号を付ける）。
     version は「年.月.日」をゼロ埋めで書く（文字列の大小で新旧を比べるため）。
   ・title は版の見出し（何が変わったかを一言で）。
   ・type: 'new'＝新機能、'improve'＝改善、'fix'＝修正、'remove'＝削除・終了。
     route を書くと「開く」ボタンが付く（ハブ内のルート名。sub はその下の画面）。
   ・非公開のツール（デイリーチェックシート・試作中の機能など）のことは書かない。
   ================================================================ */
export const CHANGELOG = [
  {
    version: '2026.11.06',
    title: { ja: '更新履歴と新しいバージョンのお知らせを追加', en: 'Changelog and update notices' },
    date: '2026-11-06',
    items: [
      { type: 'new', ja: '表示設定に「ホーム画面のアイコン」を追加しました。「ホーム画面に追加」した時のアイコンを、絵文字＋背景色や好きな画像にできます（追加する前に設定してください）。', en: 'Added “Home screen icon” to Display Settings: use an emoji on a color or your own image for the home screen icon (set it before adding).' },
      { type: 'improve', ja: '各ツールの共有文（Xへのポストなど）に入るURLを、終了した旧サイトではなく今のサイトのURLにしました。', en: 'Share texts now link to this site instead of the retired old sites.' },
      { type: 'new', ja: '更新履歴を追加しました。関連ツールの一覧のいちばん下の「更新履歴」から、これまでの変更をバージョンごとに見られます。', en: 'Added this changelog. Open it from “Changelog” at the bottom of the tool list.' },
      { type: 'new', ja: '新しいバージョンが公開されると、画面の上端にお知らせの帯が出るようになりました。「最新に更新」を押すとその場で新しい版に切り替わります（保存したデータは消えません）。関連ツールの一覧のいちばん下でも、今のバージョンと最新かどうかを確かめられます。', en: 'When a new version is published, a bar now appears at the top of the screen. Tap “Update” to switch right away (your saved data is kept).' },
    ],
  },
  {
    version: '2026.11.05',
    title: { ja: 'お知らせ・まとめてさがす・新しいツール5つを追加', en: 'Notices, search and five new tools' },
    date: '2026-11-05',
    items: [
      { type: 'new', ja: 'ドックに「お知らせ」を追加。旅の精霊の来訪、季節やイベントの終わり、次回アップデート、フレンドの記念日をまとめて知らせます。', en: 'Added Notices to the dock: travelling spirits, season and event endings, the next game update and friend anniversaries in one place.' },
      { type: 'new', ja: '「まとめてさがす」を追加。アイテム・楽譜・エモート・精霊・ツール名をひとつの欄から探せます（キーボードの / でも開きます）。', en: 'Added Search everything: items, music sheets, emotes, spirits and tools from one box (press / to open).' },
      { type: 'new', ja: 'フレンド記念日を追加。フレンドと出会った日や誕生日を記録でき、フォト日記に写真を残せます。', en: 'Added Friend Anniversaries, with birthdays and a photo diary.', route: 'friends' },
      { type: 'new', ja: 'ふりかえりを追加。1年分と1か月分の記録を1枚のカードにまとめます。', en: 'Added Recap for your year and your month on one card.', route: 'recap' },
      { type: 'new', ja: '称号一覧を追加。各ツールで手に入れた称号を1か所で見られます（各ツールの画面からは小さな案内だけになりました）。', en: 'Added Titles, which gathers the titles from every tool in one place.', route: 'titles' },
      { type: 'new', ja: 'コーデ日記を追加。その日のコーデを写真と着ているアイテムで記録できます。シーズンアルバム、撮影ポーズに困った時のくじ、Xへのポスト（アイテムのアイコンをまとめた画像付き）もここにあります。', en: 'Added Outfit Diary: log outfits with a photo and the items you wear, plus a season album, a photo-prompt draw and posting to X with an item icon image.', route: 'coord-diary' },
      { type: 'new', ja: 'ほしいもの計画を追加。欲しいアイテムに必要なキャンドルとハートを、今の所持数と比べて計算します。', en: 'Added Wishlist Plan, which totals the candles and hearts your wishlist needs.', route: 'wish-plan' },
      { type: 'improve', ja: '精霊ツリーの楽譜のマスが、アイテム所持管理の楽譜の所持とつながりました（どちらで付けても両方に反映されます）。', en: 'Music sheet nodes in spirit trees now sync with owned music sheets in the item tracker.', route: 'spirit-catalog' },
      { type: 'improve', ja: 'ランダムコーデ・マイコーデ・コラージュを、アイテム所持管理からコーデ日記の中へ移しました。', en: 'Random outfit, My outfits and Collage moved from the item tracker into Outfit Diary.', route: 'coord-diary' },
      { type: 'improve', ja: '関連ツールの一覧で「テスト中のツール」を折りたためるようにしました。', en: 'The “Tools in testing” group in the tool list can now be collapsed.' },
      { type: 'remove', ja: '精霊同行ツールの所持本数の下にあった「1日の獲得キャンドル」の欄を外しました（効率の計算の欄からは今まで通り変えられます）。', en: 'Removed the “Candles per day” field under owned candles in the companion tool (still editable in the optimizer).', route: 'companion' },
      { type: 'fix', ja: '夏時間の終了に合わせて、旅の精霊（ぽんぽんする若者）の来訪を日本時間 11/5 17:00〜11/9 16:59 に、いたずらな日々の終了を 11/12 16:59 に直しました。', en: 'Adjusted the travelling spirit (11/5 17:00–11/9 16:59 JST) and the end of Days of Mischief (11/12 16:59 JST) for the end of daylight saving time.' },
      { type: 'fix', ja: 'ツール間の同期・バックアップ・表示で見つかった不具合をまとめて直しました。', en: 'Fixed several issues with syncing between tools, backups and display.' },
    ],
  },
  {
    version: '2026.11.04',
    title: { ja: '遥かなる真珠の季節に対応、ノマキャン計算機プロを強化', en: 'New season support and Calculator Pro upgrades' },
    date: '2026-11-04',
    items: [
      { type: 'new', ja: '精霊ツリー管理に「遥かなる真珠の季節」（案内人と4体）のツリーを追加しました。', en: 'Added the trees of the new season (guide and four spirits) to Spirit Trees.', route: 'spirit-catalog' },
      { type: 'new', ja: 'エモート所持率管理に、遥かなる真珠の季節の4つのエモート（腕相撲・見せびらかす・ためらう・転げまわる）を追加しました。', en: 'Added the four new season emotes to the emote tracker.', route: 'emote' },
      { type: 'new', ja: 'ノマキャン計算機プロに「効率の内訳」「時間が決まっているイベント」「実測ストップウォッチ」を追加しました。', en: 'Candle Calculator Pro: added an efficiency breakdown, timed events and a stopwatch.', route: 'tai-nomacan-pro' },
      { type: 'improve', ja: 'ノマキャン計算機プロの精錬コストを最新の値に直し、エリアの管理を「回る場所を選ぶ」形に作り直しました。', en: 'Candle Calculator Pro: updated refining costs and rebuilt area settings as a route picker.', route: 'tai-nomacan-pro' },
      { type: 'new', ja: '旅の精霊「ぽんぽんする若者」の再訪を反映しました。', en: 'Added the Hairtousle Teen revisit.', route: 'tai-revisit' },
      { type: 'improve', ja: '精霊ツリー管理のツリーから同期の印（🔄）を消し、すっきりさせました。', en: 'Removed the sync markers (🔄) from spirit trees.', route: 'spirit-catalog' },
      { type: 'fix', ja: 'カーニバルの季節と遥かなる真珠の季節のツリーで、段の中の並びを下から上の順に直しました。', en: 'Fixed the order inside tiers of two season trees.' },
      { type: 'fix', ja: 'ダッシュボードの日替わり大キャンドルの地域が1日ずれていたのを直しました。', en: 'Fixed the daily big candle realm on the dashboard being one day off.' },
    ],
  },
  {
    version: '2026.11.01',
    title: { ja: 'いたずらな日々（2026）のアイテムを追加', en: 'Days of Mischief 2026 items' },
    date: '2026-11-01',
    items: [
      { type: 'new', ja: 'アイテム所持管理に、いたずらな日々（2026）の新しいアイテムを追加しました。', en: 'Added the Days of Mischief 2026 items to the item tracker.', route: 'item' },
      { type: 'new', ja: '精霊同行ツールに、全精霊で共通のメモ欄を追加しました。', en: 'Added a shared memo to the companion tool.', route: 'companion' },
      { type: 'fix', ja: '思い出のボボキャンドルを無償配布のアイテム（価格なし）に、いたずら小悪魔の羽の色を黒に直しました。', en: 'Fixed the price and color of two event items.' },
    ],
  },
  {
    version: '2026.10.31',
    title: { ja: 'ノマキャン計算機プロに20本ルートを追加', en: '20-candle route preset' },
    date: '2026-10-31',
    items: [
      { type: 'improve', ja: 'ノマキャン計算機プロに「20本ルート（ソロ・試練無し）」を最初から入れ、参考元へのリンクを載せました。', en: 'Candle Calculator Pro now includes a 20-candle solo route preset with a source link.', route: 'tai-nomacan-pro' },
    ],
  },
  {
    version: '2026.10.29',
    title: { ja: '引き継いだデータの表示を修正', en: 'Fix for transferred data' },
    date: '2026-10-29',
    items: [
      { type: 'fix', ja: '引き継いだデータの一部が表示されない不具合を直しました。', en: 'Fixed some transferred data not being shown.' },
    ],
  },
  {
    version: '2026.10.28',
    title: { ja: '再訪精霊データベースからツリーを管理できるように', en: 'Tree progress from the revisit database' },
    date: '2026-10-28',
    items: [
      { type: 'new', ja: '再訪精霊データベースから、その精霊のツリーの進み具合を確かめて付けられるようにしました。', en: 'You can now check and edit a spirit’s tree progress from the revisit database.', route: 'tai-revisit' },
      { type: 'new', ja: 'ダッシュボードに、デイリーの切り替え後の闇の破片を出すようにしました。', en: 'The dashboard now shows the shard eruption after the daily reset.' },
      { type: 'fix', ja: '九色の鹿の4体（薬草採集人・狩人・国王・王女）の再訪ツリーを実際の形に直しました。', en: 'Fixed the revisit trees of four spirits to match the game.' },
      { type: 'fix', ja: '精霊同行ツールで、旧サイトのサブ保存枠のデータが表示されない不具合を直しました。', en: 'Fixed sub-slot data from the old companion site not showing.', route: 'companion' },
    ],
  },
  {
    version: '2026.10.27',
    title: { ja: '「最新の状態に更新」ボタンを追加', en: 'Update button' },
    date: '2026-10-27',
    items: [
      { type: 'new', ja: '関連ツールの一覧のいちばん下に「最新の状態に更新」ボタンを追加しました。画面が古いままの時に押すと、新しい版を取り直します。', en: 'Added “Update to the latest version” at the bottom of the tool list.' },
    ],
  },
];

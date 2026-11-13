/* ================================================================
   📝 更新履歴のデータ（#/changelog が表示する。js/app-update.js が「新しいバージョンがあるか」の判定にも使う）。
   ・新しい順に並べる。先頭の version が「今のバージョン」になる。
   ・利用者に届く変更を公開したら記録する。**1日1件にまとめる**: その日の版がすでにあれば、新しい版を足さずにその版の items へ書き足し、
     version の末尾の番号だけ上げる（'2026.11.10' → '2026.11.10.2'。番号を上げないと新しい版のお知らせが出ない）。title もその日の内容に合わせて直す。
   ・並び順・誤字・データの小さな直しは、単独の行にしない。同じ日の関連する行に一言足すか、気付かれにくいものは載せない。
     version は「年.月.日」をゼロ埋めで書く。新旧は js/app-update.js の compareVersion() で数字として比べる（.10 以降も正しく新しいと判定される）。
   ・title は版の見出し（何が変わったかを一言で）。
   ・type: 'new'＝新機能、'improve'＝改善、'fix'＝修正、'remove'＝削除・終了。
     route を書くと「開く」ボタンが付く（ハブ内のルート名。sub はその下の画面）。
   ・非公開のツール（試作中の機能など）のことは書かない。
   ================================================================ */
export const CHANGELOG = [
  {
    version: '2026.11.13.7',
    title: { ja: 'キャンドル計算機に節目の目安、羽トラッカーを見やすく', en: 'Candle calculator milestones, easier-to-read Wing Tracker' },
    date: '2026-11-13',
    items: [
      { type: 'fix', ja: 'ノマキャン計算機の目標日の判定が、ハートを送る分を差し引かずに「間に合う」と出ていたのを直しました。「今のペースだと何日頃に届くか」も出るようになり、「ペースを設定に反映」ボタンもハートの分を上乗せした本数を入れます。', en: 'Candle Calculator: the target-date check now accounts for hearts you send, shows when you would reach the goal at your current pace, and the “apply pace” button includes the heart cost.', route: 'tai-nomacan' },
      { type: 'new', ja: 'ノマキャン計算機と星のキャンドル計算機に、25%・50%・75%・達成の節目まで「あと何本・いつ頃か」の目安を出すようにしました（星のキャンドルは羽のペースだけで計算します）。', en: 'Candle Calculator and Ascended Candle Calculator now show when you’ll reach 25%, 50%, 75% and your goal.', route: 'tai-nomacan' },
      { type: 'new', ja: '星のキャンドル計算機の目標日に、シーズン終了日・イベント終了日・1週間後などをワンタップで入れるボタンを付けました。', en: 'Ascended Candle Calculator: quick buttons for the target date (season end, event end, in 1 week, etc.).', route: 'star-candle' },
      { type: 'improve', ja: '羽トラッカーを見やすくしました。取得済みの精霊は行の色と✓で分かるようにし、季節・地方ごとと全体に進捗バーを付けました。恒常精霊と光の子も地方ごとに折りたためるようになり、開閉は次に開いた時も残ります（コンプリート済みの所は最初から畳んでおきます）。上の説明と共有ボタンもコンパクトにしました。', en: 'Wing Tracker is easier to scan: owned spirits are marked, progress bars per season/realm and overall, collapsible Regular Spirit and Children of Light sections that remember their state, and a more compact top.', route: 'wings' },
      { type: 'improve', ja: 'コーデ日記で着ていたアイテムを選ぶ時、アイテム所持管理でお気に入り（☆）にしたアイテムを各カテゴリの先頭に並べ、星の印を付けました。', en: 'Outfit Diary: your favorite (☆) items from the Item Tracker now come first when picking what you wore.', route: 'coord-diary' },
      { type: 'improve', ja: 'アイテム所持管理の「達成率の推移」のグラフを、見出しを押して開け閉めできるようにしました。最初は閉じていて、開いておくと次に来た時も開いたままになります。', en: 'Item Tracker: the Completion Over Time graph now starts collapsed; tap the heading to open it (your choice is remembered).', route: 'item' },
      { type: 'fix', ja: '累計消費コスト・実額の共有ボタンを押してから画像ができるまで、十数秒かかって止まったように見えていたのを直しました（1秒かからなくなりました）。アイテム所持管理のほかの共有も速くなっています。画像を作っている間は「画像を作っています…」と表示します。', en: 'Sharing from Total Spent & Real Money no longer takes 10+ seconds; other Item Tracker shares are faster too, and a “Creating image…” indicator shows while it works.', route: 'item', sub: 'cost' },
      { type: 'improve', ja: '画面下のメニュー（プロフィール・ダッシュボード・お知らせ・他のツール・表示設定）は、開いている時にもう一度押すと閉じるようにしました。別のボタンを押すと、開いている画面を閉じてから切り替わります。', en: 'Bottom menu buttons now close their panel when tapped again, and switching buttons closes the open panel first.' },
      { type: 'improve', ja: 'アイテム所持管理の「アイテム別コスト」を「累計消費コスト・実額」に名前を変えました。「アルティメットギフト」の表記も「究極の贈り物」にそろえています。', en: 'Item Tracker: “Item Costs” is now called “Total Spent & Real Money”.', route: 'item', sub: 'cost' },
    ],
  },
  {
    version: '2026.11.12.6',
    title: { ja: '達成率の推移・画像カード・ピン留めなどを追加、アイテム別コストを見やすく', en: 'Completion graph, image cards, pinned tools, clearer Item Costs' },
    date: '2026-11-12',
    items: [
      { type: 'improve', ja: '11/13から来る「来訪する精霊団」の顔ぶれ（そっと覗く郵便屋・ハグ好きの隠者・のんびり屋の音楽家・一生懸命な舞台美術家）を、お知らせとダッシュボードに出すようにしました。「待っている」精霊が混じっていればお知らせで教えます。アイテムの「今手に入る」絞り込みにも、4人のアイテムが入ります。再訪精霊データベースの来訪の記録にも足しました。', en: 'The Traveling Spirit Group arriving 11/13 (Peeking Postman, Bearhug Hermit, Mellow Musician, Frantic Stagehand) now appears in Notices and the dashboard, including your waitlist, “available now” filters and the Revisit database.', route: 'tai-revisit' },
      { type: 'improve', ja: 'アイテム別コストを見やすくしました。残りコストと、かかったコストを最初から並べて表示し、一覧は1行ずつのコンパクトな形にしました（行を押すと入手経緯の切り替えなどが開きます）。アイテム名での検索、季節ごとの小計と折りたたみも追加しています。上のボタンから、プレゼント履歴・キャンドル課金へすぐ移動できます。', en: 'Item Costs is easier to read: remaining and spent totals side by side, compact rows (tap for details), name search, per-season subtotals you can collapse, and shortcuts to Gift and Candle purchase records.', route: 'item', sub: 'cost' },
      { type: 'new', ja: 'アイテム所持管理で、アイテムの名前を押すと詳細が開くようにしました。価格の確認、ほしいもの計画への追加、名前での検索ができます。', en: 'Item Tracker: tap an item name to see its price, add it to your Wishlist Plan, or search for it.', route: 'item' },
      { type: 'new', ja: 'アイテム所持管理に「達成率の推移」を追加しました。チェックを変えた日ごとに達成率を記録して、グラフで見られます。ふりかえりにも、その期間の伸びが出ます。', en: 'Item Tracker: a graph of your completion rate over time, also summarized in Recap.', route: 'item' },
      { type: 'new', ja: '達成率とコーデ日記を、そのまま投稿できる画像カード（横長・正方形）にできるようにしました。色は今の着せ替えに合わせます。', en: 'Save your completion rate or an outfit as an image card (wide or square) in your theme colors.' },
      { type: 'new', ja: 'ダッシュボードの季節・イベント・旅の精霊・フレンドの記念日を、カレンダーアプリに追加できるようにしました。まとめて書き出すこともできます。', en: 'Add dashboard events, spirits and friend anniversaries to your calendar app, one by one or all at once.' },
      { type: 'improve', ja: 'ダッシュボードの欄を並び替えたり、隠したりできるようにしました。「お知らせ」と「今月のふりかえり」の欄も選べます。', en: 'Rearrange or hide dashboard sections, and add Notices or This Month sections.' },
      { type: 'new', ja: 'よく使うツールを4つまでピン留めして、画面の上からすぐ開けるようにしました（「他のツール」の一覧のピンから）。', en: 'Pin up to four tools to the top of the screen from the Other Tools list.' },
      { type: 'new', ja: '着せ替えに、草原・雨林・峡谷・捨てられた地・書庫・天界をイメージした見本を追加しました。', en: 'New realm-inspired themes: Prairie, Forest, Valley, Wasteland, Vault and Heaven.' },
      { type: 'improve', ja: 'しばらくバックアップしていない時に、ダッシュボードでお知らせするようにしました。', en: 'The dashboard now reminds you when you haven’t backed up for a while.' },
      { type: 'fix', ja: '着せ替えの色によって読みにくかったボタンや文字（星紡ぎカードの投稿ボタン・ノマキャン計算機プロのボタン・羽トラッカーのボタン・デイリーチェックシートの日付など）を、読める濃さにしました。', en: 'Buttons and labels that were hard to read with some themes (Star-Spun Card, Candle Calculator Pro, Wing Tracker, Daily Checklist) are now readable.' },
    ],
  },
  {
    version: '2026.11.11',
    title: { ja: 'いたずらな日々の終了日時を修正', en: 'Days of Mischief end time fixed' },
    date: '2026-11-11',
    items: [
      { type: 'fix', ja: 'いたずらな日々の終了を、日本時間 11/13（金）16:59 に直しました（1日早く表示されていました）。', en: 'Days of Mischief now ends 11/13 16:59 JST (it was shown a day early).' },
    ],
  },
  {
    version: '2026.11.10.16',
    title: { ja: '巣づくり工房の新しい家具を追加、アイテム別コストの不明な価格を補完', en: 'New Nesting Workshop furniture, more item costs' },
    date: '2026-11-10',
    items: [
      { type: 'improve', ja: '各ツールの説明文を短くし、アイテム所持管理・エモート所持率管理の機能の入口を、アイコンと名前だけの1行にしました。', en: 'Shorter descriptions across the tools, and simpler one-line entries for features in the Item and Emote trackers.' },
      { type: 'improve', ja: 'ダッシュボード（今日・今週・今月）を見やすくしました。予定は名前と残り時間だけの小さなカードにまとめ、重なっていた説明を減らし、カレンダーの帯を控えめな色にしました。闇の破片の時刻は1回ずつ改行して出します。', en: 'Cleaner dashboard: compact rows with name and time left, fewer repeated notes, subtler calendar bars, and shard times on separate lines.' },
      { type: 'fix', ja: '「新しいバージョンがあります」が何度も出る不具合を直しました。「最新に更新」は1回押せば新しい版になります。起動した直後に新しい版が見つかった時は、お知らせを出さずにそのまま新しい版に切り替えます。', en: 'Fixed the update notice appearing repeatedly. "Update" now works in one tap, and a new version found right at launch is applied automatically.' },
      { type: 'improve', ja: 'ほしいもの計画で、計算に入れるアイテムをチェックで選べるようにしました。名前付きのグループを作って、グループごとに計算することもできます（グループに入れるアイテムはチェックで選び、1つのアイテムを複数のグループに入れられます）。各アイテムの「手に入れた」を押すと、価格ぶんキャンドル（またはハート）を減らして、アイテム所持管理で所持にします。', en: 'Wishlist Plan: choose which items to include, and sort your wishlist into named groups to plan each group separately.', route: 'wish-plan' },
      { type: 'improve', ja: 'アイテム所持管理の絞り込みで、季節・イベントを複数まとめて選べるようにしました（カテゴリの一覧・全アイテムの一覧・季節・イベントの検索）。「季節をまとめて」「日々をまとめて」で一度に選ぶこともできます。', en: 'Item tracker filters now let you pick several seasons/events at once, with one-tap “all seasons/all days”.', route: 'item' },
      { type: 'improve', ja: 'ダッシュボードのイベントに、開始日時だけでなく終了日時も小さく載せるようにしました（開催中のものは「○/○ ○:○まで」）。', en: 'The dashboard now shows end times for events, not just start times.' },
      { type: 'new', ja: 'アイテム所持管理の大きい設置アイテムに、巣づくり工房の新しい家具8つ（木製の寝室チェア・木製の寝室テーブル・木箱・木製の寝室ベッド・木製のコンソールテーブル・木製の絵の具箱・木製のロッキングチェア・木製のデスク）を追加しました。日本語名は仮のものです。', en: 'Added eight new Nesting Workshop furniture items (Arles set and Crate) to large placeables.', route: 'item', sub: 'large_placeable' },
      { type: 'improve', ja: 'アイテム別コストで「不明」だったアイテムのほとんどに価格を入れました（季節キャンドル・チケット・キャンドル・実額）。季節パスの報酬は「報酬」、精霊ツリーで無料のものは「無料」と表示します。季節キャンドルの価格は季節の開催中のもので、キャンドルの合計には含めません。精霊ツリー管理のツリーでも、価格の無いノードに「報酬」「無料」や課金額を出すようにしました（コスト表示をオンにした時）。あわせて、精霊のツリーを開いた時に「100%まで あと○個」と、必要なキャンドル・ハートなどをまとめて出すようにしました。', en: 'Filled in prices for 84 items that were “Unknown” in the cost list (season candles, tickets, candles and real money). Season candle prices are not added to candle totals.', route: 'item', sub: 'cost' },
      { type: 'improve', ja: 'コーデ日記の「着ていたアイテム」を、マイコーデと同じくカテゴリごとに所持アイテムのアイコンから1つずつ選ぶ形にしました。名前での絞り込みもできます（持ち運べる・小さい設置・大きい設置はどれか1つ）。', en: 'Outfit Diary now lets you pick one owned item per category from icons, like My Coord, with a name filter.', route: 'coord-diary' },
      { type: 'improve', ja: 'ロイヤリティクラブの4アイテムに画像と英語名を入れ、引き換えに必要なポイント（10・20・50・150）を載せました。', en: 'Added images, English names and point costs (10/20/50/150) to the Loyalty Club items.', route: 'item' },
    ],
  },
  {
    version: '2026.11.09.4',
    title: { ja: 'ロイヤリティクラブのアイテムと11月後半の予定を追加', en: 'Loyalty Club items and late November schedule' },
    date: '2026-11-09',
    items: [
      { type: 'new', ja: 'アイテム所持管理に、ロイヤリティクラブのアイテム（ひまわりカチューシャ・春めくクローバー飾り・ひまわりクロスタイ・ひまわりドレス）を追加しました。', en: 'Added four Loyalty Club items to the item tracker.', route: 'item' },
      { type: 'improve', ja: 'ダッシュボードとお知らせに、来訪する精霊団（11/13 17:00〜11/27 16:59）・ハート2倍キャンペーン（同じ期間）・お洒落な日々（11/27 17:00〜12/11 16:59）を追加しました。お洒落な日々は、期間中はアイテム検索の「現在開催中」にも入ります。', en: 'Added the traveling spirit group and double hearts event (Nov 13–27) and Days of Style (Nov 27–Dec 11, JST) to the dashboard and notices.' },
      { type: 'fix', ja: 'ヘアアクセサリーの一部（常夏ハットから音楽ヘアピンまでの間）の並び順を直しました。', en: 'Fixed the order of several hair accessories.', route: 'item', sub: 'hair_accessory' },
    ],
  },
  {
    version: '2026.11.08.4',
    title: { ja: 'デイリーチェックシートをテスト公開、アイテム所持管理を使いやすく', en: 'Daily Checklist (beta) and item tracker updates' },
    date: '2026-11-08',
    items: [
      { type: 'new', ja: 'デイリーチェックシートをテスト機能として公開しました。関連ツールの一覧の「テスト中のツール」から開けます。毎日やることのチェック、今日の要点とおみくじ、週替わりビンゴ、印刷・PDF・画像での保存ができます。', en: 'Released the Daily Checklist as a beta: daily tasks, today’s highlights and fortune, weekly bingo, and print/PDF/image export. Find it under “Tools in testing”.', route: 'daily-check' },
      { type: 'new', ja: 'アイテム所持管理に「今手に入る未所持アイテム」ボタンを追加しました。押すと「現在開催中の季節・イベントのみ」「未所持のみ」を選んだ状態で検索が開きます。あわせて、季節・イベントの検索を「全アイテム」の下に、楽譜をカテゴリ一覧の下に移しました。', en: 'Added “Unowned items available now” to the item tracker, and moved search and Music Sheets closer to the item lists.', route: 'item' },
      { type: 'improve', ja: '横長の画面で左右に出る「関連ツール」と「ダッシュボード」の幅をそろえ、本文が画面の中央に来るようにしました。', en: 'On wide screens, the side panels now have the same width so the page is centered.' },
    ],
  },
  {
    version: '2026.11.07',
    title: { ja: 'Googleなどの検索から各ツールを見つけやすく', en: 'Easier to find in search engines' },
    date: '2026-11-07',
    items: [
      { type: 'improve', ja: 'ツールごとの紹介ページを作り、「Sky アイテム管理」「Sky 連れ歩き」などで検索した時に見つかりやすくしました（検索結果に出るまでには時間がかかります）。', en: 'Added an intro page for each tool so they are easier to find in search engines (it takes time to show up).' },
    ],
  },
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
    title: { ja: '「最新の状態に更新」ボタン、ノマキャン計算機プロの20本ルート', en: 'Update button and 20-candle route' },
    date: '2026-10-31',
    items: [
      { type: 'new', ja: '関連ツールの一覧のいちばん下に「最新の状態に更新」ボタンを追加しました。画面が古いままの時に押すと、新しい版を取り直します。', en: 'Added “Update to the latest version” at the bottom of the tool list.' },
      { type: 'improve', ja: 'ノマキャン計算機プロに「20本ルート（ソロ・試練無し）」を最初から入れ、参考元へのリンクを載せました。', en: 'Candle Calculator Pro now includes a 20-candle solo route preset with a source link.', route: 'tai-nomacan-pro' },
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
];

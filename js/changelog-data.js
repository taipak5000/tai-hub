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
    version: '2026.11.22.6',
    title: { ja: 'デイリーチェックシートを正式公開・毎日の自動バックアップ、ノマキャン計算機プロを見直し（デイリーリセットを安全に・自動最適化を元に戻せる・所要時間の倍率・通常版の目標・ルートの実測をエリアへ）', en: 'Daily Checklist is official, daily automatic backups; Candle Calculator Pro refresh (safer daily reset, undo for auto-optimize, time multiplier, Candle Calculator goal, split times to areas)' },
    date: '2026-11-22',
    items: [
      { type: 'new', ja: 'ほしいもの計画で、キャンドルが足りない一番上のアイテムに「ノマキャン計算機プロで到達日を見る」を付けました。押すとノマキャン計算機プロが開き、キャンドル管理の先頭に「『◯◯』まであと28本（合計68本）」と、今の選択で毎日集めた時の到達予定日が出ます（60日以内に届かない時はそう出ます）。', en: 'Wishlist Plan: the first item you still need candles for has "See the date in Candle Calculator Pro". It opens the Pro calculator with how many more candles you need and the expected date if you refine your current selection every day.', route: 'wish-plan' },
      { type: 'new', ja: 'コーデ日記の写真を、星紡ぎカードのカスタム欄の画像に使えるようにしました（日記の「星紡ぎカードで使う」）。写真はコピーせずに日記の写真を読むので、カードの保存容量を使いません。日記で写真を消すと、カードからも画像が外れます。', en: 'Outfit Diary photos can now be used as the custom section image on your Star Card ("Use on Star Card"). The photo is read from the diary rather than copied, so it takes no space in the card; deleting it in the diary removes it from the card.', route: 'coord-diary' },
      { type: 'new', ja: '精霊ツリー管理の達成率を日ごとに記録し、星紡ぎカードの「入手グラフ」に「精霊ツリーの達成率の推移」を足しました（編集画面でオンにすると出ます）。記録は、精霊ツリー管理を開いたり解放を変えたりした日の分からたまります。', en: 'Spirit Tree Catalog completion is now recorded per day, and the Star Card graphs have a new "Spirit Tree Completion Trend" (turn it on in the editor). Records start from the days you open or update the catalog.', route: 'tai-card' },
      { type: 'new', ja: '1日1回、アプリを開いた時に、全部のツールの記録をこの端末の中へ自動で保存するようにしました（新しい順に3件まで）。記録がおかしくなった時は、「データ引継ぎ」の「自動バックアップ」から、その時点に戻せます。戻す直前の状態も1件残るので、戻したことを取り消せます。表示設定の「毎日の自動バックアップ」でオフにできます。写真と、ほかの端末への引継ぎは対象外です（これまでどおり「データ引継ぎ」で書き出してください）。', en: 'Once a day when you open the app, all tool records are now saved inside this device (the latest 3). If something goes wrong, restore an earlier state from "Automatic backups" in Data Transfer; the state just before restoring is kept too, so you can undo it. Turn it off with "Daily automatic backup" in Display Settings. Photos are not included, and moving to another device still uses Data Transfer.', route: 'data-transfer' },
      { type: 'improve', ja: 'デイリーチェックシートのテストを終え、正式なツールにしました。関連ツールの一覧では「テスト中のツール」から外れ、ほかのツールと並びます。ホーム画面に追加したアプリのアイコンを長押しすると、「デイリーチェックシート」「ノマキャン計算機プロ」「精霊ツリー管理」をすぐ開けます（対応している端末のみ）。', en: 'The Daily Checklist is now a regular tool and is listed with the others instead of under "Tools in testing". Long-press the installed app icon to jump straight to the Daily Checklist, Candle Calculator Pro or Spirit Tree Catalog (on supported devices).', route: 'daily-check' },
      { type: 'fix', ja: 'ノマキャン計算機プロの「デイリーリセット」を同じ日に2回押すと、2回目が火種0として計算され、繰越が0%に戻ってしまう問題を直しました。押した日を記録し、その日のうちはボタンが「本日分は精算済みです」になって押せなくなります。前回のリセットのあとに選んだ分が残ったまま日付が変わっていると、「今日の精錬状況」の先頭に「前回の精算（11月20日）のあとに選んだ分が、まだ精算されていません」と出し、そこから精算できます。何日空いていても精算するのは1日分です。', en: 'Candle Calculator Pro: pressing Daily Reset twice on the same day counted the second press as 0 light and reset your carry-over to 0%. The reset day is now recorded and the button reads "Today\'s reset is done" until the next Sky day. If spots picked after your last reset are still there on a later day, a notice at the top of "Today\'s Refining Status" lets you settle them (one day only, however many days have passed).', route: 'tai-nomacan-pro' },
      { type: 'improve', ja: 'ノマキャン計算機プロの「高効率エリアを自動選択」は今の選択を全部外して選び直すため、実行後のお知らせに「元に戻す」を付けました。押すと、自分で選んでいたエリア・スポットの選択が実行前に戻ります（所要時間などの編集はそのままです）。', en: 'Candle Calculator Pro: auto-select clears your current picks before choosing again, so its message now has an Undo button that brings back your previous selection (edited times stay as they are).', route: 'tai-nomacan-pro' },
      { type: 'improve', ja: 'ノマキャン計算機プロの「各窓の表示・非表示設定」で、所要時間の倍率（慣れ具合）を×0.8〜×2.0から選べるようにしました（既定は×1.7）。変えると、一度も直していないエリアの時間だけが掛け直されます。手で直した時間や、ストップウォッチ・ルートで測った時間はそのままです。', en: 'Candle Calculator Pro: choose a time multiplier (×0.8–×2.0, default ×1.7) under "Show/Hide Each Panel". Only times you have never changed are recalculated; edited and measured times stay as they are.', route: 'tai-nomacan-pro' },
      { type: 'new', ja: 'ノマキャン計算機プロのキャンドル管理に、ノマキャン計算機で選んでいる目標を「目標（あと400本・12月31日まで）」のように出し、押すとノマキャン計算機を開くようにしました。目標の作成・変更はノマキャン計算機で行います（プロからは変更しません）。', en: 'Candle Calculator Pro: Candle Management now shows your active Candle Calculator goal (e.g. "Goal (400 left · by 12/31)"); tap it to open the Candle Calculator, where goals are created and edited.', route: 'tai-nomacan-pro' },
      { type: 'new', ja: 'ノマキャン計算機プロのマイルートで、各スポットの「記録」から求めた区間タイムを、サブエリアの所要時間に反映できるようにしました（ルートを開いて「実測をエリアの所要時間に反映」）。反映の前に、置き換えるサブエリアと「1分42秒 → 1分35秒」のような新旧の時間を一覧で確かめられます。戻す時は実測ストップウォッチの「目安の時間に戻す」か、エリアの編集から直せます。', en: 'Candle Calculator Pro: in My Routes, "Use split times as area times" turns your splits into sub-area times, after showing each sub-area with its old and new time. Undo with "Restore the preset time" in the stopwatch or by editing the area.', route: 'tai-nomacan-pro' },
    ],
  },
  {
    version: '2026.11.21.3',
    title: { ja: '精霊ツリー管理を見直し（集計を1枚に・残りを計算機の目標に・開催中の再訪へすぐ移動・一括操作を元に戻せるように）', en: 'Spirit Tree Tracker refresh (one summary card, send what is left to the calculators, jump to visiting spirits, undo for tree actions)' },
    date: '2026-11-21',
    items: [
      { type: 'new', ja: '精霊ツリー管理の達成率・解放済みノード・コンプリート済みの精霊・全ツリーを100%にするまでの残り（キャンドル・ハート・星のキャンドル・季節キャンドル・季節ハート・課金額）を、絞り込みの下の1枚にまとめました。残りの下のボタンから、キャンドルの本数をノマキャン計算機へ、星のキャンドルの本数を星キャン計算機へ渡せます。計算機では「目標にしますか？」と聞かれ、「目標にする」を押した時だけ入ります（ノマキャン計算機は目標「精霊ツリーの残り」を作るので、今の目標はそのまま残ります）。', en: 'Spirit Tree Tracker: completion, unlocked nodes, completed spirits and everything left to finish all trees (candles, hearts, ascended candles, season candles and hearts, paid) are now in one card under the filters. Buttons below send the candles left to the Candle Calculator and the ascended candles left to the Star Candle Calculator, which ask before setting it as a goal (the Candle Calculator adds a separate goal "Spirit trees left", so your current goal stays).', route: 'spirit-catalog' },
      { type: 'new', ja: '精霊ツリー管理の上に、今来ている旅の精霊・精霊団のうちツリーが残っている精霊を「残り11ノード / あとキャンドル195本」のように並べ、押すとその精霊のツリーを開くようにしました。', en: 'Spirit Tree Tracker: spirits visiting now whose trees are not finished are listed at the top (e.g. "11 nodes / 195 candles left"); tap one to open its tree.', route: 'spirit-catalog' },
      { type: 'improve', ja: '精霊ツリー管理の並び替えに「残りノードが少ない順」（コンプリート済みは最後）と「残りキャンドルが多い順」を足しました。エリア別・シーズン別の見出しには「0 / 61 ノード解放済み ・ 残りキャンドル659本」のように、そのまとまりの進み具合を出します。コスト表示の「テスト機能」の印は外しました。', en: 'Spirit Tree Tracker: new sorts "Fewest nodes left" (completed trees last) and "Most candles left". Area and season headings now show progress such as "0 / 61 nodes unlocked · 659 candles left". The "Experimental" tag on Cost Display was removed.', route: 'spirit-catalog' },
      { type: 'improve', ja: '精霊ツリー管理の一覧から、絞り込んだ精霊やエリア・シーズンごとにまとめて解放済みにする「追いつき」のボタンを外しました。押し間違えると何十体分のツリーと所持キャンドルがまとめて変わってしまうためです。精霊の詳細の「このツリーを全部解放」「クエストを一括完了」「ハートを一括獲得」「ツリーをリセット」は残し、実行後に出る「元に戻す」を押すと、ツリーの解放状況・所持キャンドルとハート・アイテムやエモートの所持が操作の前に戻るようにしました（詳細を閉じるか、ほかのノードを押すまで有効です）。', en: 'Spirit Tree Tracker: removed the "catch up" buttons that marked every filtered spirit, area or season as complete at once, since a mis-tap could change dozens of trees and your candles together. The per-spirit actions (unlock the whole tree, complete quests, obtain hearts, reset the tree) remain, and now show an Undo button that restores the tree, your candles and hearts, and linked item and emote ownership (available until you close the spirit or tap another node).', route: 'spirit-catalog' },
    ],
  },
  {
    version: '2026.11.20.8',
    title: { ja: '楽譜づくりの作曲機能を見直し（範囲を変える・セクション・弾いて録音・読み込みの確認・和音など）', en: 'Sheet Music Maker composing overhaul (transform ranges, sections, record by playing, import review, chords and more)' },
    date: '2026-11-20',
    items: [
      { type: 'improve', ja: '楽譜づくりの作曲画面に「和音」の欄を足しました。ドからシまでの7つから一番下の音を選ぶと、1つ飛ばしに3つ重ねた和音（ド→ドミソ）を今のマスに入れます（もう一度押すと外れます）。作曲ツールの「範囲を変える」で、範囲のマスの長さをまとめて2倍・半分にできます（¼〜4拍に収まらない時は変えません）。BPMの横の「再生の速さ」（×0.5〜×1.5）で、曲のBPMを変えずに確かめる再生だけを遅く・速くできます（練習・試験には効きません）。マスの番号で移動する欄は、タイル・縦列の切り替えと同じ行に移しました。', en: 'Sheet Music Maker: a new Chord row adds a triad on the chosen lowest note (Do → Do-Mi-Sol) to the current tile, tapping again removes it. "Transform range" can double or halve tile lengths (only when every tile stays within ¼–4 beats). "Playback speed" next to BPM (×0.5–×1.5) changes check playback only, without changing the song BPM (not used in practice or tests). The tile-number jump box moved next to the Tile/Column switch.', route: 'tai-score' },
      { type: 'improve', ja: '楽譜づくりの「音声・動画から作る」「MIDIから作る」「楽譜画像から作る」で、解析が終わってもすぐには曲を作らず、音の数・マス数・BPM・長さと「試しに再生」を出すようにしました。「この内容で曲を作る」を押した時だけ曲になります。音声・動画はファイルを選び直さずに、調や感度を変えてもう一度解析できます。MIDIは12の調を比べて、半音を寄せずに置ける音がいちばん多い調をおすすめとして選びます（例:「おすすめの調: D（そのまま置ける音 100%）」）。調は選び直せて、これまでどおりCにもできます。', en: 'Sheet Music Maker: audio/video, MIDI and sheet-image imports now show the notes, tiles, BPM and length with a Preview before creating anything; only "Create this song" makes the song. Audio can be analyzed again with a different key or sensitivity without choosing the file again. MIDI compares all 12 keys and recommends the one where the most notes fit without semitone snapping (e.g. "Recommended key: D (100%)"); you can still pick any key, including C.', route: 'tai-score' },
      { type: 'new', ja: '楽譜づくりで、弾いたフレーズをそのまま楽譜にできるようにしました。作曲画面の上の赤い丸のボタンで「弾いて録音」を開き、新しい曲として作るか、今の曲の末尾に追記するかを選んで録音します。メトロノームがオンなら4拍のカウントインのあと拍を鳴らし続けます。止めると音の数・マス数・BPM・長さが出て、「試しに再生」で確かめてから「作る」を押した時だけ保存されます（録り直し・破棄では何も変わりません。追記は「元に戻す」1回で取り消せます）。フリー演奏の「録音して曲にする」からも新しい曲を作れます。', en: 'Sheet Music Maker: turn what you play into sheet music. Open "Record by playing" with the red dot at the top of the editor, choose a new song or adding to the end of this one, and play. With the metronome on, a 4-beat count-in plays and the beat keeps going. After stopping you see the notes, tiles, BPM and length, can preview, and only "Create" saves (Retry and Discard change nothing; adding to a song undoes in one step). You can also record a new song from Free Play.', route: 'tai-score' },
      { type: 'new', ja: '楽譜づくりで、長い曲の中の場所に「Aメロ」「サビ」のような目印を付けられるようにしました（作曲ツールの「セクション」。1曲に50個まで）。目印は譜面の上にチップで並び、押すとそこへ移動します。マスを足したり消したりしても目印は一緒に動き、譜面ビューにも名前が出ます。譜面の上の欄にマスの番号を入れて移動することもできます。作曲画面に「今の位置 / 曲全体」の演奏時間を出し、作曲ツールから空のマスを1〜100個まとめて足せるようにしました。目印は自分の作業用なので、共有コードや書き出したファイルには入りません。', en: 'Sheet Music Maker: mark places in long songs like "Verse" or "Chorus" (Sections in the compose tools, up to 50 per song). Markers appear as chips above the sheet that jump to them, move with the tiles when you add or delete tiles, and show in the sheet view. You can also type a tile number to jump to it. The editor now shows the time at the current tile and the total, and you can add 1–100 empty tiles at once. Markers are for your own work and are not included in share codes or exported files.', route: 'tai-score' },
      { type: 'new', ja: '楽譜づくりの作曲ツール（金づちのボタン）に「範囲を変える」を足しました。選んだ範囲の音の位置を±1・±7（1オクターブ）ずらす、並びを逆にする、上下を反転する、2〜16回繰り返して貼る、ができます。15音の外に出る音は「折り返す・消す・ずらさない」から選べます。貼り付けは「挿入」と「上書き」を切り替えられます。どの操作も「元に戻す」1回で戻ります。あわせて、曲全体のBPM・調・楽器の変更も「元に戻す」で戻せるようにし、範囲を選んでいる時のテンポ変化は範囲の先頭のマスに付くと表示するようにしました。', en: 'Sheet Music Maker: new "Transform range" in the compose tools (hammer button). Shift the notes in a range by ±1 or ±7 (an octave), reverse the order, flip upside down, or repeat-paste 2–16 times. Choose whether out-of-range notes wrap, are removed, or block the shift. Paste can now insert or overwrite. Every operation undoes in one step. Changes to the song\'s BPM, key and instrument can now be undone too, and a tempo change with a range selected is shown to apply from the first tile of the range.', route: 'tai-score' },
      { type: 'improve', ja: '楽譜づくりで楽譜を読み込む時、音と音の間隔をマスの長さで表すようにしました（MIDI・音声や動画・楽譜画像・Sky Studioのファイル）。これまでは音の間を空のマスで埋めていたため、4分音符が続く曲でも1拍に何マスも使っていました。MIDIは4分音符を1拍にして元のテンポのまま読み込みます（例: 60マス→12マス）。音声・楽譜画像・Sky Studioのファイルは、いちばんよく出る音の間隔を1拍にして、各音を¼拍の位置にそろえます（200音の演奏で2,001マス→200マス）。音声から作る時、元の曲より遅く再生されることがあった問題もこれで直りました。前の作り方にしたい時は、読み込みの画面のチェックを外してください。', en: 'Sheet Music Maker: imports (MIDI, audio/video, sheet images, Sky Studio files) now use tile lengths for the gaps between notes instead of filling them with empty tiles. MIDI keeps its tempo with a quarter note as one beat (e.g. 60 tiles → 12); audio, images and Sky Studio files use the most common gap as one beat and align notes to quarter beats (a 200-note performance: 2,001 tiles → 200). This also fixes audio imports sometimes playing slower than the original. Uncheck the option in the import screen to use the old layout.', route: 'tai-score' },
      { type: 'improve', ja: '楽譜づくりの作曲画面で、譜面のマスをなぞって範囲を選べるようにしました。スマホではマスを少し長押ししてから指を動かします（そのまま動かすと今までどおりスクロールします）。パソコンではマウスを押したまま別のマスへ動かします。譜面の端までなぞると、その先へ自動でスクロールします。選んだ範囲は、そのままコピー・音を消す・削除・長さの変更に使えます。', en: 'Sheet Music Maker: drag across tiles to select a range. On phones, press and hold a tile briefly, then drag (a plain swipe still scrolls). With a mouse, press and drag to another tile. The sheet scrolls automatically when you reach its edge. Use the selection to copy, clear, delete or change the length.', route: 'tai-score' },
    ],
  },
  {
    version: '2026.11.18.3',
    title: { ja: '楽譜づくりでマスごとの長さを決められるように、作曲を書きやすく、創作物の期限のお知らせ', en: 'Per-tile length and easier composing in Sheet Music Maker, notices for expiring creations' },
    date: '2026-11-18',
    items: [
      { type: 'new', ja: '楽譜づくりで、マスごとの長さを決められるようにしました。音のボタンの上の「長さ」で ¼・½・¾・1・1½・2・3・4拍から選びます（1が今までどおりの長さ）。範囲を選んでいれば、その全部のマスにまとめて付けられます（パソコンでは [ と ] でも変えられます）。最後のマスで「次へ」を押して足したマスは、前のマスの長さを引き継ぎます。再生・譜面ビュー・演奏時間の計算・共有コードに反映され、Sky Music Nightly形式の書き出し・読み込みでも長さが残ります。', en: 'Sheet Music Maker: set each tile\'s length (¼, ½, ¾, 1, 1½, 2, 3 or 4 beats; 1 is the usual length) from "Length" above the note buttons. Applies to a whole selected range at once (keyboard: [ and ]). New tiles added with "Next" keep the previous tile\'s length. Playback, the sheet view, the play time, share codes and Sky Music Nightly export/import all respect it.', route: 'tai-score' },
      { type: 'improve', ja: '楽譜づくりの作曲画面を書きやすくしました。音のボタンの下に操作バーを置き、スマホでも前後のマスへの移動・元に戻す・やり直す・コピー・貼り付け・マスの挿入・音を消す・削除ができます。「入れたら次へ」をオンにすると、音を入れるたびに次のマスへ進みます（同時に押した音は同じマスの和音になります）。最後のマスで「次へ」を押すと新しいマスが足されます。「範囲」を押してから譜面のマスを押すと、そこまでをまとめて選べます（パソコンではShift＋クリックかShift＋←→）。パソコンでは、スペースで再生・停止、Enterで次へ、Ctrl+Z・Ctrl+Yで元に戻す・やり直す、Ctrl+C・Ctrl+Vでコピー・貼り付け、Backspaceで音を消す、Shift+Deleteでマスを削除できます。長い曲でも音を押した時に引っかからないようにし、譜面のマスの大きさがそろわない問題も直しました。', en: 'Sheet Music Maker: easier composing. A toolbar under the note buttons now works on phones too (previous/next, undo/redo, copy/paste, insert, clear, delete). Turn on "Auto-advance" to move to the next tile after each note (notes pressed together form a chord), and "Next" on the last tile adds a new one. Use "Range" (or Shift+click / Shift+←→) to select several tiles. Keyboard: Space play/stop, Enter next, Ctrl+Z/Y undo/redo, Ctrl+C/V copy/paste, Backspace clear, Shift+Delete delete. Entering notes is now smooth in long songs, and tile sizes in the sheet are consistent.', route: 'tai-score' },
      { type: 'improve', ja: '創作物管理ツールで消えるまで3日以内になった創作物を、画面下の「お知らせ」で知らせるようにしました（一時停止中のものは除きます）。いちばん早く消える創作物の名前と日にちが出て、「創作物管理ツール」を押すと期限間近の創作物だけを選んだ状態で開くので、そのまま一括で置き直せます。最終日にはもう一度お知らせします。', en: 'Creation Manager: creations within 3 days of disappearing now show up in Notices (paused ones excluded). Opening it from the notice selects just the expiring creations so you can re-place them in one go. You get another reminder on the last day.', route: 'share' },
    ],
  },
  {
    version: '2026.11.17.4',
    title: { ja: '楽譜づくりに譜面ビュー（印刷・PDF保存つき）、複数の楽器のMIDIの読み込み、ロイヤリティクラブのポイントの合計', en: 'Sheet view and multi-instrument MIDI in Sheet Music Maker, Loyalty Club points totalled' },
    date: '2026-11-17',
    items: [
      { type: 'new', ja: '楽譜づくりに「譜面を見る」を足しました。曲の全部のマスを、編集の道具なしで画面いっぱいに並べて見られます（4マスごとに番号）。マスの大きさは小・中・大、空のマスを「休み×3」のように詰めることもできます。選んだマスから再生でき、「このマスを編集」でそのマスの編集へ移れます。「印刷・PDF」で白地の譜面を印刷でき、印刷の画面で「PDFに保存」を選べばPDFにもなります（1行のマス数は大きさの設定で16・12・8マス）。ライブラリの曲と、作成画面の上のボタンから開きます。', en: 'Sheet Music Maker: new "View sheet" shows every frame of a song across the whole screen without the editing tools (numbered every 4 frames). Choose S/M/L frame size, collapse empty frames into "Rest ×3", play from the selected frame, jump to "Edit this frame", and print it or save it as a PDF ("Print / PDF"; 16, 12 or 8 frames per row by size). Open it from a song in the library or the button at the top of the editor.', route: 'tai-score' },
      { type: 'improve', ja: '累計消費コスト・実額で、ロイヤリティクラブ（ウェブショップ）のアイテムに使ったポイントと、残りを集めるのに要るポイントを合計するようにしました（4アイテムで計230ポイント）。これまでは「対象外」として数えていませんでした。通貨の絞り込みにも「ロイヤリティクラブのポイント」を足しています。', en: 'Total Spent & Real Money now totals the Loyalty Club (web shop) points you have used and the points still needed (230 points across four items). They were previously shown as N/A. A "Loyalty Club points" currency filter was added too.', route: 'item', sub: 'cost' },
      { type: 'improve', ja: '楽譜づくりの「MIDIから作る」で、ピアノ・ギター・ストリングス・ベースのように複数の楽器が入ったMIDIは、使うパートを選べるようにしました（ベースなどの低音は最初は外れています）。最初の音の前の無音を詰め、曲名には楽器名ではなくファイル名を使います。端末によって.midファイルが選べなかった問題も直しました。', en: 'Sheet Music Maker: when a MIDI file contains several instruments (piano, guitar, strings, bass…), you can now choose which parts to use (low parts like bass start unchecked). Leading silence is trimmed, the song is named after the file instead of an instrument, and .mid files that some devices would not let you pick can now be selected.', route: 'tai-score' },
    ],
  },
  {
    version: '2026.11.16',
    title: { ja: 'ほしいもの計画で、精霊のツリーから選べるように', en: 'Wishlist Plan: pick from a spirit tree' },
    date: '2026-11-16',
    items: [
      { type: 'new', ja: 'ほしいもの計画に「精霊のツリーから選ぶ」を足しました。再訪・精霊団の精霊のツリーで欲しいアイテムを押すと、そこまでの通り道にある祝福（魔法）やハートなども合わせて、あと何本・いつ頃かを計算します。欲しいものに入れてあるアイテムの行にも「通り道も計算する」ボタンが出ます。解放は今までどおり精霊ツリー管理で行い、解放した分は計画から自動で外れます。', en: 'Wishlist Plan: “Pick from a spirit tree” lets you tap the items you want on a returning spirit’s tree and counts the blessings and hearts on the way there, too.', route: 'wish-plan' },
    ],
  },
  {
    version: '2026.11.15.3',
    title: { ja: '楽譜づくりのライブラリを見やすく、舞い踊る表現者の再訪、デイリーの項目を選べるように', en: 'Sheet Music Maker library, Dancing Performer visit, pick your Daily items' },
    date: '2026-11-15',
    items: [
      { type: 'improve', ja: 'ダッシュボードの「デイリー」に出す項目を選べるようにしました。「表示を編集」のデイリーの下で、闇の破片（今日・翌日）・大キャンドル・クエスト・シーズンキャンドル・ウニ焼き・パン焼き・亀闇を1つずつ出す・隠すにできます。', en: 'Dashboard: choose which items appear under Daily (shards, Grand Candle, Quest & Season Candle, Geyser, Bread Baking, Turtle Darkness) from “Customize”.' },
      { type: 'improve', ja: '11/26 17:00〜12/3 16:59 に特別に再訪する「舞い踊る表現者」を、再訪精霊データベースとお知らせに載せました。来訪中は、アイテム所持管理の「現在開催中」の絞り込みにヘアスタイル・マスク・ケープが入ります。', en: 'Dancing Performer returns for a special visit from Nov 26 to Dec 3 (JST). It’s now in the Returning Spirits database and Notices, and its hair, mask and cape appear under “Happening now” in the Item Tracker during the visit.', route: 'tai-revisit' },
      { type: 'improve', ja: '楽譜づくりの最初の画面を整理しました。上の案内を低くして曲の一覧がすぐ見えるようにし、「音声・動画から作る」「楽譜画像から作る」「MIDIから作る」を折りたたみの外へ出しました。曲のカードには調・楽器と前回の練習・試験の結果が出て、カードのどこを押しても開けます。削除は右上の小さなボタンに移しました（保存済みの曲はそのままです）。', en: 'Sheet Music Maker: a tidier library screen. Songs appear sooner, the audio/video, sheet image and MIDI importers are always visible, and song cards show key, instrument and your last practice/test results. Tap anywhere on a card to open it.', route: 'tai-score' },
    ],
  },
  {
    version: '2026.11.14.2',
    title: { ja: '手持ちアイテムをURLで共有、思慮深き座長の再訪予想', en: 'Share your closet as a link, Thoughtful Director visit' },
    date: '2026-11-14',
    items: [
      { type: 'improve', ja: '11/19 17:00〜11/23 16:59 に再訪すると予想されている「思慮深き座長」を、再訪精霊データベースとお知らせに載せました。来訪中は、アイテム所持管理の「現在開催中」の絞り込みにマスク・石琴・ケープが入ります（11/18(水)に確定予定です）。', en: 'Thoughtful Director is expected to visit 11/19–11/23 (to be confirmed 11/18); its mask, Xylophone and cape appear in the “available now” filter while it is here.', route: 'tai-revisit' },
      { type: 'new', ja: 'アイテム所持管理で、持っているアイテムの一覧をURLで共有できるようにしました（「コーデ機能」の「手持ちアイテムをURLで共有」から）。開いた人はあなたの手持ちをカテゴリごとに見られて、その中からアイテムを選んでコーデを組み、リンクで送り返せます。送り返されたコーデは、持っているアイテムに✓が付いて表示されます。', en: 'Item Tracker: share the items you own as a link. Friends can browse your closet, put a coord together from it, and send it back as a link.', route: 'item' },
    ],
  },
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

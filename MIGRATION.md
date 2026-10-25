# tai-hub への引っ越しメモ（2026年10月末）

10月末で独立サイト15個をtai-hubへ移す。データの大半は自動で引き継がれるが、iOSのホーム画面アプリで使っている人だけは手動のバックアップが要る。告知バナーは2026-10-25に全サイトへ掲載した。

## 告知バナー

全サイトが `/tai-item/hub-move-notice.js` を読み込み、ページ先頭にお知らせを出す。文面・リンク・日付はこのファイルだけで管理しているので、直す時は全サイトを触らなくてよい。

- 「tai-hubを開く」ボタンは、`/tai-hub/manifest.json` が取れた時だけ有効になる。リポジトリ名を `tsts` → `tai-hub` に改名すれば、その時点から自動でリンクが生きる（改名前は「tai-hub（準備中）」と灰色表示）。
- リンク先は開いていたサイトに対応するツール。例: `/tai-item/cape.html` → `/tai-hub/#/item/cape`、`/tai-catalog/` → `/tai-hub/#/spirit-catalog`。
- 「データをバックアップ」は `/tai-transfer/`（データ引継ぎ）へ。tai-transfer上ではこのボタンは出さない。
- ×で閉じると24時間出ない（`sky_hub_move_notice_closed`）。英語設定（`sky_app_lang=en`）なら英文。

対象: tai-item（全16ページ）・tai-emote・share・tai-nomacan・tai-nomacan.pro・star-candle・companion・wings・tai-catalog・tai-revisit・tai-score・tai-card・tai-transfer・tai-info・skyzztai-profile。`timer` はハブに移植していないので対象外。

## データがどう移るか

すべて `taipak5000.github.io` という同じオリジンにあり、保存先は全サイトともlocalStorageだけ（IndexedDBは未使用、2026-10-25確認）。ハブは同じキー名・形状で読むため、次のように分かれる。

| 使い方 | 引っ越し後 |
| --- | --- |
| Safari・Chromeなどで普通に開いている | そのまま引き継がれる。作業不要 |
| Androidのホーム画面アプリ（Chrome） | ブラウザと保存先が共通なので、引き継がれる見込み【要実機確認】 |
| iOSのホーム画面アプリ | アプリごとに保存先が分かれるため自動では移らない。データ引継ぎでコードを作り、tai-hubの `#/data-transfer` で復元してもらう |
| 別のブラウザ・別の端末・プライベートブラウズ | 元々データが共有されていない。同じくコードで移す |

旧tai-transferのコードはハブのデータ引継ぎでそのまま復元できる（キー照合の処理が同一）。引継ぎコードに入らないのは、ノマキャン計算機プロの通知のオン/オフなど一部の表示設定だけで、所持データ・記録はすべて含まれる。

## 引っ越し当日にやること

1. GitHubで `tsts` リポジトリを `tai-hub` に改名し、`https://taipak5000.github.io/tai-hub/` が開くことを確かめる（Pagesは旧URLから転送されないので、`/tsts/` は以後404になる）。
2. 旧サイトのバナーの「tai-hubを開く」が有効になったことを1サイトで確認する。
3. `js/site-config.js` の `USE_HUB_SHARE_URLS` を `true` にする（共有文のURLがハブに切り替わる）。
4. 旧サイトを転送スタブに置き換える（旧URL→ハブ、古いService Workerの停止）。手順は `_ecosystem-tools/retire-stubs/README.md`。スタブ化はバックアップの呼びかけ期間を取ってから行う。

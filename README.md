# tai-hub

Sky: Children of the Light ファンツール群（アイテム・エモート・羽・精霊ツリー・再訪精霊・
楽譜・ノマキャン・星のキャンドル・創作物管理…）を1つのPWAアプリにまとめたものです
（[SkyGame-Planner](https://github.com/Silverfeelin/SkyGame-Planner/) 参考）。

📌 **現状: 独立サイトからの移行準備中。** 各ツールの独立サイト（`item`/`emote`/`share`等）が
引き続き現行の本番で、ハブはそれと同じlocalStorageキー・データ形状で動く（同じオリジンなので
データはそのまま共有される）。独立サイトを閉じる手順（旧URL→ハブの転送スタブ・古いService Worker
の停止・iOSホーム画面アプリのデータ移行）は `_ecosystem-tools/retire-stubs/README.md` に準備してあり、
**まだデプロイしていない**。リポジトリ名は `tai-hub` に改名予定（公開URLは
`https://taipak5000.github.io/tai-hub/`）。

## 公開に向けた準備（2026-10-14）

- **PWA**: `manifest.json`・アイコン・`service-worker.js`（stale-while-revalidate。localhostでは
  `?sw=1` を付けた時だけ登録）。外部サイトへの依存（サイト一覧など）は静的データに置き換え済み。
- **共有URLの切替**: `js/site-config.js` の `USE_HUB_SHARE_URLS`。移行日までは共有文のURLが旧サイトのまま、
  `true` にすると全ツールの共有文・画像がハブのURLになる。
- **コーデの共有リンク**: `#/item/coord=<code>`（旧サイトの `#coord=<code>` も自動で読み替える）。
- **全モーダル共通**: ボトムシートのドラッグ/フリックで閉じる操作とフォーカストラップ（`js/sheet-engine.js`）。
- **他タブへの追従**: プロフィール切替・改名・テーマ変更は `storage` イベントで全タブに反映。
- **通知**: イベント・星のキャンドルのリマインダー、ノマキャン計算機プロの黒シャード/デイリーリセット（起動時に予約）。

## 今回やったこと

- Node.js/npm等のビルドツールが無い環境のため、素のHTML/CSS/JSと
  ネイティブES Modules（`<script type="module">`）だけで動くSPA基盤を構築。
- ハッシュベースのルーター（`#/item/cape`等）、状態・ストレージ層
  （`skyProfiles_v1`・`nsKey`等、**既存itemサイトと完全に同じ
  localStorageキー名・データ形状**）、共有chrome（下部ドック・
  プロフィール切替モーダル・設定モーダル・ツール引き出し）を実装。
- **5ツール全てを完全移植**：
  - `item`（アイテム所持管理）：ダッシュボード（シーズン/イベント表示・
    全体達成率ゲージ・称号パネル・13カテゴリのグリッド）、12の装着
    アイテムカテゴリ＋楽譜コンプリート管理（`MUSIC_SHEETS`という別形状の
    データのため専用の`music-sheet-view.js`として移植）の所持/お気に入り
    チェックページ、コスト集計ページ、本格的な横断検索モーダル、
    ウィッシュリスト・必要コスト計算、アイテム獲得ログ、コーデ機能
    （ランダムコーデ・マイコーデ・クローゼットコラージュ）、達成率/
    お気に入りのX画像シェアまで、本家サイトの機能をほぼ完全に移植。
  - `emote`（エモート所持率管理）：エモート一覧（レベルごとの個別所持
    トグル）・称号・入手履歴・「1年前の今日」バナー。
  - `tai-nomacan`（ノマキャン計算機）：複数目標管理・ペース計算・獲得
    履歴（ストリーク＋推移グラフ）・デイリークエスト記録・称号。
  - `star-candle`（星のキャンドル計算機）：目標計算・赤闇の自動予測
    エンジン＋月表示カレンダー・獲得履歴・通知設定・称号。
  - `share`（創作物管理ツール）：唯一Vue 3（CDN読み込み・ビルドレス）で
    書かれているツールのため、**ユーザーの明示的な指示によりこのツール
    だけVueのまま移植**（他はすべてバニラJS）。カレンダー表示・作品の
    CRUD・一括操作・称号。ルート遷移のたびにVueアプリをmount/unmountし、
    多重マウントが起きないことを確認済み。

## 着せ替え（2026-10-13追加）

「表示設定」の中の「着せ替え」から、画面の色・質感・背景を自由に設定して、お気に入りとして保存できます。

- **テーマ**: 見本14種（桜・ミント・夕焼け・夜空・ネオン…）から選ぶ／「おまかせ」で調和する配色を自動生成。
- **カスタム**: アクセント色・背景の色合い/好きな色・グラデーション・壁紙（端末の画像）・背景のきらめき
  （星・花びら・シャボン玉・ほたる・雪）・カードの質感（やわらか/フラット/ガラス）・角の丸さ・フォント。
  文字色は背景から自動で読めるコントラストに補正されます。
- **お気に入り**: 名前を付けて最大24個まで保存。共有コード（`skyhub1:…`）で友達とやり取りできます。
- 表示設定の「起動時に開く画面」で、ハッシュ無しで開いた時に表示するツールを選べます。
- 設計メモと「新しいツールを足した時の手順」は`CLAUDE.md`の「着せ替えエンジン」を参照。

## 動作確認方法

ビルド不要ですが、ES Modulesは`file://`直接オープンでは動きません
（ブラウザのCORS制限のため）。ローカル静的サーバー経由で開いてください。
このリポジトリは`skyツール/`ディレクトリの兄弟フォルダとして配置されている
ため、`skyツール/`全体を静的サーバーのルートにして、
`http://localhost:<port>/tai-hub/` を開いてください。

## 既存itemサイトとのデータ互換性について

`skyProfiles_v1`・`gameItems_<cat>`・`wish_<cat>`・`itemAcquireLog_v1`・
`itemTitles_v1`等、既存の`item`サイト（taipak5000.github.io/tai-item/）が
使っているlocalStorageキーは、**キー名・データ形状を完全に一致させて**
実装しています。将来このリポジトリを同じ`taipak5000.github.io`ドメイン配下
（同一オリジン）にデプロイした場合、既存ユーザーが`item`サイトで保存した
データはそのまま引き継がれます（移行処理不要）。ローカル環境同士では
オリジンが異なる限りこの共有は成立しません。

## 今回スコープ外にしたもの（意図的な簡略化）

- **Service Worker / オフライン対応**：未実装。ローカル専用のためオフライン
  需要が無く、旧実装の「index.htmlだけnetwork-first」という特別扱いは、
  今回廃止した自己fetch問題への対処だったため、そのまま移植する意味が
  無い。デプロイが視野に入った段階で改めて設計する。
- **ダッシュボードモーダル（ドックの「ダッシュボード」ボタン）**：
  元の「今日/今週/今月」の3分割レイアウトではなく、現在のシーズン・
  開催中イベント・次回アップデート・再訪精霊の状態を1つのリストに
  まとめた軽量版（※itemダッシュボード本体の全体達成率ゲージ・称号
  パネルとは別物）。
- **横断検索モーダル**：現在開催中の季節/日々サブフィルター、恒常精霊限定
  エリア/大精霊フィルター、結果を一括所持済みにする操作は未移植（詳細は
  `features/item/search-modal.js`のコメント参照）。
- **コスト集計・ウィッシュリストページの一部サブ機能**：課金アイテム
  プレゼント履歴等、個別編集が複雑な機能は簡略化している場合がある
  （詳細は`features/item/cost-view.js`・`wishlist-cost-modal.js`の
  コメント参照）。
- **コーデ機能・シェア機能**：X/Twitterへの実際の投稿フロー自体は
  移植済みだが、共有時のカスタマイズ項目の一部・写真の詳細なクロップ
  UI等は簡略化している場合がある（詳細は`features/item/coord/`・
  `features/item/share/`各ファイルのコメント参照）。
- **楽譜コンプリート管理**：難易度（旋律/管楽器/低音/打楽器）の表示のみ
  ドット表示に変更（フィルター・並び替えロジックは元実装と同一）。
  旧保存キー（`musicSheets`）からの移行読み込みは維持。
- **プロフィールの複製機能**：既存の`item`サイトにはそもそも存在しない
  機能（tai-card等、別ツールにのみある機能と混同しないよう明記）。
- **言語切替**：`location.reload()`で切り替える既存挙動のまま
  （リアクティブな再描画は今回作っていない）。
- **emote**：X（Twitter）への画像共有・カスタマイズ機能（Canvas 2Dで
  達成率カード画像を1から描画する専用コード）とホーム画面アイコンの
  カスタマイズ機能（単独PWA向けの機能でハブでは意味を持たない）は未移植。
- **tai-nomacan / star-candle**：各ツール独自の「🔄最新の状態に更新」
  ボタンと言語切替ボタンは未移植（前者はツールごとのService Worker
  キャッシュ回避策で、tai-hubはService Worker自体を持たないため不要。
  後者はハブの表示設定モーダルに同機能あり）。目標管理モーダルの
  ドラッグ物理演算つきボトムシートは、ハブ共通のシンプルなモーダルに
  簡略化。
- **share**：サイドバー開閉・フォーカストラップ・テーマ/言語のIIFE側
  ブリッジ呼び出しは、ハブの共有chrome（`js/chrome/*.js`）が全ルート
  共通で肩代わりするため除去。詳細は`features/share/share-view.js`
  冒頭のコメント参照。
- 各ツールの正確な簡略化・アダプテーション内容は、それぞれの
  `features/<tool>/*-view.js`冒頭のコメントに詳しく記載しています。

## ディレクトリ構成

詳細は各ファイルの冒頭コメントを参照。大まかな構成：

```
index.html          シェル本体
css/                 tokens.css(ハブ共通) / chrome.css(ドック・モーダル) / theme.css(着せ替え) / <tool>.css(各ツール専用・元配色維持)
js/                  router.js / router-registry.js / state.js / i18n.js / icon-sprite.js / app.js / chrome/*.js /
                       theme.js(着せ替えエンジン) / theme-fx.js(背景のきらめき) / chrome/theme-studio.js(着せ替えスタジオ)
features/item/        dashboard-view.js / category-view.js / cost-view.js / music-sheet-view.js /
                       titles-panel.js / search-modal.js / wishlist-cost-modal.js / acquire-log-modal.js /
                       coord/（random-coord.js・my-coord.js・closet-collage.js・coord-data.js）/
                       share/（achievement-share.js・favorites-share.js・share-data.js）/ data/
features/emote/        emote-view.js / emote-state.js / data/
features/tai-nomacan/  nomacan-view.js / nomacan-history.js / nomacan-state.js / data/
features/star-candle/  star-candle-view.js / star-candle-forecast.js / date-utils.js / data/
features/share/        share-view.js（Vue 3をCDN読み込みしてマウント）
features/placeholder/  現在は5ツールすべて移植済みのため未使用（新ツール追加時用に残置）
```

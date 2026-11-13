# tai-hub — 開発ガイド

Sky: Children of the Light のファンツール群を1つのSPA（PWA）にまとめたリポジトリ。ビルドツールなしのネイティブES Modules。
各ツールは`features/<tool>/`にあり、`js/router-registry.js`のROUTESテーブルで`js/router.js`のハッシュルーターに登録する。

共通の決まり:
- Service Workerは stale-while-revalidate（キャッシュをすぐ返し、裏で取り直す。キャッシュの無い初回だけネットワークを待つ）。
- 開くアニメーションは`transition`ではなく`animation`で書く。
- ボトムシートは画面幅にかかわらず常にフルワイド。

## 作業の流れ

- 作業ブランチにプッシュしたら、そのまま`main`へ反映してよい（GitHub Pagesは`main`から公開される）。
- ただし次のような大きな変更は、反映の前に確認を取る: 多くのツールの画面や動きを一度に変えるもの、
  利用者の保存データを書き換える・消すもの（データ移行など）、リポジトリの削除・改名など元に戻しにくいもの。
- データファイル（`features/item/data/items/*.js`など）の行を並べ替えたり末尾に足したりした時は、
  公開前に`node --input-type=module -e "import('file://…')"`で実際に読み込めるか確かめる（末尾のカンマ抜けで丸ごと読めなくなる）。

## UIの設計方針: Apple Design (Fluid Interfaces)

新しくUIを作る時・既存のUIを触る時は、
[emilkowalski/skills — apple-design](https://github.com/emilkowalski/skills/blob/main/skills/apple-design/SKILL.md)
（Appleの"Designing Fluid Interfaces"をWeb向けにまとめた設計原則集）を参照する。

要点: 動きは「今画面に出ている値」から始まり、指の速度を引き継ぎ、慣性を先まで投影し、いつでも掴んで反転できる時に
「生きている」と感じられる。固定durationの`@keyframes`/`transition`は中断できないので、タッチ可能な要素
（モーダル・ドロワー・ドラッグ操作）にはバネ物理を使う。

### 今の状態

そのまま踏襲するもの:
- `:active`による押した瞬間の`transform:scale()`のフィードバック。
- `features/tai-card/tai-card-view.js`のクロップ・時計ハンドルのドラッグ（`setPointerCapture`による1:1の直接操作）。
- `@keyframes`の中身はtransform/opacityだけにする。
- `tokens.css`の本文フォントはシステムフォント優先。`tai-nomacan`/`star-candle`/`tai-card`/`profile`は
  意図的に装飾フォントを使っているので、一律にシステムフォントへ変えない。

気付いた範囲から直していくもの:
- **開閉の非対称**: `js/chrome/*.js`のモーダル/ドロワーは開く時だけアニメーションがあり、閉じる時は即座に消える。
  閉じる処理を書く・直す時は、閉じる用の`@keyframes`を足すか、`js/motion.js`の`animateSpring`で動かしてから`display:none`にする。
- **ドラッグでの開閉**: 新しくドラッグできるシート/ドロワーを作る時は`js/motion.js`を使う。
- **半透明（マテリアル）**: 不透明な背景色に`backdrop-filter`を重ねても効かない。半透明トークン（`--hub-card-glass`）とセットで使う。
- **文字の詰め**: 大きい文字（20px以上）は`letter-spacing`を負（`-0.02em`前後）、小さいラベル（13px以下）は正（`0.02〜0.06em`前後）。
  行間は見出しほど詰め（`1〜1.15`）、本文はゆったり（`1.6〜1.9`）。
- **アクセシビリティ**: 半透明の面や凝ったアニメーションを足す時は、`prefers-reduced-motion`・`prefers-reduced-transparency`・
  `prefers-contrast`の3つを最初からセットで書く（下のテンプレート）。

### `js/motion.js` — 依存なしの最小バネユーティリティ

npmの依存を足さないため自前で持っている（`animateSpring`/`rubberband`/`project`/`velocityFromHistory`）。
ダンピング比（`damping`）とレスポンス秒数（`response`）の2つで指定する。

```js
import { animateSpring, rubberband, project, velocityFromHistory } from '../../js/motion.js';

// 既定は減衰比1.0(オーバーシュート無し)。ジェスチャーの勢いを伴わない演出はこれを使う。
animateSpring(() => currentX, v => { el.style.transform = `translateX(${v}px)`; }, targetX);

// フリック・ドラッグ解放など勢いのある操作だけ、わずかに弾む damping ~0.8 を使う。
animateSpring(() => currentY, v => { sheet.style.transform = `translateY(${v}px)`; }, target, {
  damping: 0.8, response: 0.3, velocity: releaseVelocity,
});

// ドラッグの境界はハードクランプではなく rubberband() で弾性抵抗を掛ける。
const overshoot = rawValue - bound;
const value = overshoot > 0 ? bound + rubberband(overshoot, dimension) : rawValue;

// pointerup時、pointermoveの履歴から離脱速度を求めてから着地点を予測する。
const v = velocityFromHistory(moveHistory);
const landingPoint = currentY + project(v);
```

途中でジェスチャーが再開・反転した時は、`animateSpring`が返すハンドルの`.redirect(newTarget, newVelocity)`を使う
（今の値・速度から継ぎ目なくつながる。最初からやり直さない）。

### 半透明の面のテンプレート

```css
.your-translucent-chrome {
  background: var(--hub-card-glass); /* rgba(255,255,255,0.72) / rgba(28,27,34,0.68) */
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
}
@media (prefers-reduced-transparency: reduce) {
  .your-translucent-chrome { background: var(--hub-card); backdrop-filter: none; -webkit-backdrop-filter: none; }
}
```

操作を止めて注意を求めるモーダルは、不透明なカード＋`rgba(0,0,0,0.4〜0.45)`の暗いスクリム（既存の`.modal-overlay`）。
並行して見える知らせ（トースト・ポップオーバー）は、スクリムなし＋半透明トークン（`css/share.css`の`.sv-toast`が実例）。

### アクセシビリティ3種のテンプレート

```css
@media (prefers-reduced-motion: reduce) {
  /* 全称セレクタで0.01msに潰すのではなく、対象を列挙してスライド等をクロスフェードに置き換える
     （companion.css の該当箇所が実例） */
  .your-sheet-overlay { animation: iosFade 200ms ease !important; }
  .your-sheet-card { animation: none !important; transform: none !important; }
}
@media (prefers-reduced-transparency: reduce) {
  .your-translucent-chrome { background: var(--hub-card); backdrop-filter: none; }
}
@media (prefers-contrast: more) {
  .your-translucent-chrome { background: var(--hub-card); border: 1px solid var(--hub-text-2); backdrop-filter: none; }
}
```

## ワイド画面のサイドパネル（関連ツール＝左端／ダッシュボード＝右端）

幅1280px以上で、「関連ツール」を左端、「今日・今週・今月」のダッシュボードを右端に常に出す（どちらも幅300px）。
表示設定の「ワイド画面のサイドパネル」で左右を別々にオフにできる（既定オン。キーは`sky_side_tools`／`sky_side_dash`。
旧`sky_hub_side_panels`が`0`なら未設定の間それを引き継ぐ）。オフにした側はドックのボタンから開く。

- 実装: `js/chrome/side-panels.js`（中身）・`css/chrome.css`（`html.side-panels-on`＋メディアクエリ）・`index.html`（`#side-left-root`/`#side-right-root`）。
  幅の境界（1280px）はCSSとside-panels.jsの2か所で一致させる。
- レイアウト用クラス（左=`side-panels-on`／右=`side-dash-on`）は`index.html`先頭のインラインスクリプトで描画前に付ける
  （起動後に付けると本文がずれて画面がガクつく）。設定の切替では`sidePanels.sync()`がクラスと中身をまとめて更新する。
  ドックのボタンは`dock-tools`／`dock-dash`クラスで、対応する側のクラスが付いている間だけ隠れる。
- ダッシュボード（`features/shared/event-dashboard.js`）は、常設用の`mount(el, { persistent: true })`／`unmountPersistent()`と、
  各ツールのモーダル用の`mount()`/`unmount()`を別々に管理している。`unmount()`は常設分に影響しない。
- ツール一覧の描画先は`.js-tools-nav`すべて（引き出し＋左パネル）。`tools-drawer.js`の`renderNav()`が全部に描く。
- モーダル/ボトムシートはパネルより手前に全幅で出す（画面幅で形を変える実装ではない）。
- 右端に固定配置するボタン（`.tr-quick-jump`・`.floating-stop-btn`など）は、`--side-right-w`ぶん内側へ寄せる。
- 画面上端の「新しいバージョン」の帯が出ている間は、パネルを帯の高さ（`--update-bar-h`）ぶん下げる。

## 着せ替え（テーマ）エンジン

画面の色・質感・背景を利用者が変えられる機能（`js/theme.js`＝配色の生成・CSS出力・保存、`js/theme-fx.js`＝背景のきらめき、
`js/chrome/theme-studio.js`＝着せ替え画面、`css/theme.css`）。表示設定シートの中の1画面として開く（`chrome/settings-modal.js`が
設定一覧と着せ替え画面を切り替える。着せ替え画面の間だけシートは背景を暗くせず、外側も操作できる＝`#settingsModalOverlay.ts-live`）。
表示設定には、ほかに「ホーム画面のアイコン」（`js/chrome/home-icon.js`）と「起動時に開く画面」（`sky_hub_start_route`）がある。

### 仕組み

- 軸は「アクセント色」と「背景の色合い」の2つ。文字・区切り線・アクセントの文字用/塗り用は、背景から計算してコントラストを保証する
  （`ensureContrast`）。色を直書きせず、この関数を通した値（`p.text`/`p.accentInk`/`p.redInk`…）を使う。
- 各ツールの色トークンは名前がばらばらなので、`theme.js`の`TOOL_MAPS`に「ツールのルート要素 → 共通の色の割り当て」を持つ。
  生成したCSSは`<style id="hub-theme-style">`に入れ、セレクタは`:root[data-hub-theme] .xxx-view`と詳細度を上げてある。`!important`は使わない。
- 「アクセントに合わせる」背景はライト/ダークの切替に追従する（`data-theme`の変化を`MutationObserver`で拾う）。「好きな色」の背景と
  「明るさ固定」のテーマは切替に関わらず固定。
- 描画前スクリプト（`index.html`）が`localStorage`のキャッシュ（`sky_hub_theme_css_v1`）を先に差し込み、起動時のちらつきを防ぐ。
  キャッシュの書き込みはスライダー操作中に毎フレーム走らないよう350msで間引く。
- 外部入力（共有コード・バックアップ）は必ず`normalizeTheme()`を通す。色は`#RRGGBB`のみ。描画前スクリプトは`url(`・`@import`を含むキャッシュを無視する。
- 壁紙はIndexedDBに保存し（共有コードには含めない）、使われなくなった壁紙は`pruneWallpapers()`で消す。
- 着せ替えが無効（標準）の時は、スタイル・属性・キャッシュを残さない。

### 新しいツールを足した時の手順

1. ツールのルート要素のクラス名（例`.xxx-view`）を`VIEW_ROOTS`に追加する（背景を透明にして、壁紙やきらめきを透かすため）。
2. ツールの色トークンを`TOOL_MAPS`に追加する。意味のある色（所持=緑・課金=橙・警告=赤など）は上書きしない。
   上書きするのは主役の色（リンク・ボタン・強調）と面の色だけ。赤を文字に使うなら`'--red': p.redInk`を足す。
3. 色を直書きしている主役の色（固定の橙のバナーなど）は、`BRAND_RULES`に個別のルールを足す。
4. 確認: 複数のテーマ（ライト系・ダーク固定・淡い黄色のアクセント・中間グレーの背景）で、文字と背景のコントラストを全ルートで機械的に走査する。

### 半透明（ガラス質感）

`theme.card==='glass'`の時だけ、ドックと主要な大きな面（`GLASS_TARGETS`）に`backdrop-filter`を掛ける。タイルや一覧の行のように
数が多い要素には掛けない（重くなる）。モーダル/引き出しは常に不透明。`prefers-reduced-transparency`/`prefers-contrast`向けの上書きは`buildCss`が出力する。

## 各機能のメモ

- **お知らせ**（ドックの「お知らせ」。`js/notices.js`が集め、`js/chrome/notice-modal.js`が表示）: 旅の精霊の来訪・季節やイベントの開始/終了・
  次回アップデート・フレンドの記念日・ビンゴの新しい週・新しい称号・ふりかえり・新しいバージョンをまとめて出す。既読はプロフィールごと（`noticesSeen_v1`）。
- **季節・イベント・旅の精霊の予定**: `features/item/data/season-data.js`（`CURRENT_SEASON`・`EVENT_SCHEDULE`・`CANDLE_BONUS_SCHEDULE`・`REVISIT_SPIRIT_SCHEDULES`）。
  夏時間が終わる11月から3月までは、日本時間のリセットが17:00になる。日時は太平洋時間（`-08:00`）の`00:00:00`〜`23:59:59`で書くと迷わない。
  旅の精霊を更新する時は`spiritJa`/`spiritEn`も書き換える（「待っている」印との照合に使う）。精霊団など名前のある来訪は`labelJa`/`labelEn`。
  複数の精霊が一緒に来る時は`spiritsJa`/`spiritsEn`（配列）に並べる（お知らせ・ダッシュボードに顔ぶれを出し、`spiritsEn`で「待っている」印と照合する）。
  あわせて再訪精霊データベース（`features/tai-revisit/data/revisit-data.js`）の各精霊の`visits`末尾にも、精霊団なら`{"date","endDate","type":"SV"}`、旅の精霊なら`type:"TS"`の来訪を足す（日付は日本時間）。
  **どの精霊が来るか分かった時点で、イベントの開始前でも足す**（開始前は「進行中・次回の特別来訪」に「次回予定」として載り、始まると「進行中」に変わる）。
- **まとめてさがす**（`js/chrome/search-modal.js`。関連ツール一覧の先頭・キー`/`）: データは開いた時に読み込む（精霊ツリーのデータは大きいので起動時には読まない）。
- **デイリーチェックシート**（`#/daily-check`。テスト公開中）: `features/today/today-view.js`が今日の要点・おみくじを出し、
  その下にチェックシート（`features/daily-check/`）を`mount(el, { embedded: true, labLinks: true })`で埋め込む。週替わりビンゴ（`features/bingo/`）も
  この画面の中の折りたたみ。`#/today`と`#/bingo`は古いリンク用（hidden）。
- **フレンド記念日／フォト日記**（`features/friends/`。写真はIndexedDB`tai-hub-photos`）・**ふりかえり**（`features/recap/`、`#/recap/month`）。
  CSSは`css/fun-tools.css`、色は`--hub-*`トークンだけを使う。新しいツールに記録を足したら、ふりかえりにも数を足せるか考える。
- **ほしいもの計画**（`features/wish-plan/`）: 欲しいもの`wish_<cat>`と所持通貨`wishOwnCurrency`は他ツールと共通。並び順・設定・グループ分けと
  「計算に入れない」印は`wishPlanOrder_v1`/`wishPlanSettings_v1`/`wishPlanGroups_v1`。グループは`items`にアイテムを持ち（チェックで選ぶ。1つのアイテムを複数のグループに入れられる）、
  「計算に入れない」印は表示（すべて・各グループ）ごとに`offBy`へ別々に持つ。
  「手に入れた」ボタン（`acquireRow()`）は、キャンドル・ハートの価格ぶん`wishOwnCurrency`を減らし（0未満にはしない）、所持にして獲得ログに残す（楽譜は`music-sheet-state.js`経由）。
- **コーデ日記**（`features/coord-diary/`）: 写真はフォト日記と同じIndexedDB。着ていたアイテムはカテゴリごとに所持アイテムのアイコンから1つ選ぶ
  （`wearRowsHtml()`。選び直しは`refreshWearRows()`でその欄だけ描き直す）。シーズンアルバム（`season-album.js`）は季節（`features/shared/season-dates.js`）と
  日々（`features/shared/event-dates.js`）ごとに並べる。新しい季節・日々が始まったら、この2つのファイルの末尾に足す。撮影お題ガチャは`photo-gacha.js`。
- **称号一覧**（`#/titles`、`features/titles/titles-view.js`）: 全ツールの称号をここに集める。各ツールの画面には`js/titles.js`の`titlesLinkHtml(ツール)`の
  小さな案内だけを出す。獲得の判定・記録は各ツール。称号の定義は`features/tai-card/data/title-catalog.js`の`TITLE_CATALOG`（ツールに称号を足したらここにも足す）。
- **試作中の機能**（`features/lab/`）: 今は無い。作る時はルートを`lab-*`で`hidden: true`にし、入口はデイリーチェックシート単体のページの「試作中の機能」だけにする。
  `LAB_TOOLS`（`lab-common.js`）が空の間は枠ごと出さない。公開する時は`hidden`を外して`site-links.js`へ足し、`LAB_TOOLS`から外す。
- **アイテム所持管理の季節・イベントの絞り込み**: カテゴリ一覧・全アイテム・検索の3か所とも`features/item/event-multi.js`で複数選択にしている
  （元の`<select>`は隠して残し、選び直すと`change`を起こす。値は`eventSet(selectEl)`で受け取る。空＝すべて）。
- **精霊ツリーの楽譜ノード**: `spirit-catalog-state.js`の`linkMusicNodes()`が実行時に楽譜（`gameItems_music_sheet`）へ紐づける。
  楽譜だけ旧キー`musicSheets`にしかデータが無い場合があるので、読み書きは`readMusicOwnedRaw()`を通す。
- **アイテムの詳細シート**（`features/item/item-detail-sheet.js`）: カテゴリ一覧・全アイテムでアイテム名を押すと開く。ほしいもの計画への追加は既存の`wish_<cat>`に書くだけ。
- **累計消費コスト・実額**（旧アイテム別コスト。`features/item/cost-view.js`、`#/item/cost`）: サマリー（残り＝塗りの面／かかった＝淡い面）→stickyなフィルターバー→季節ごとの一覧→課金の記録→「この集計について」の順。
  一覧の行は名前と価格だけで、入手経緯の切替などは行を押すと開く詳細（開いた行だけ中身を描く。`openItems`）。集計は`computeOwnedBreakdown()`／`computeRemainBreakdown()`が
  アイテムごとの寄与を記録し、季節の小計はその和（小計の和＝サマリーのアイテム分。プレゼント履歴・キャンドル課金は小計に入らない）。意味色は`--cost-*`（着せ替え中は`TOOL_MAPS`が上書き）。
- **達成率の記録**（`js/collection-history.js`）: `saveCategoryState()`が送る`hub-collection-changed`で、その日の分を1件だけ記録（`collectionHistory_v1`、365日まで）。
  グラフは`features/item/history-chart.js`（自前のSVG）、ふりかえりにも伸びを出す。
- **画像カード**（`js/share-card.js`）: 達成率・コーデをCanvasで描く（1200×630／1080×1080、色は`--hub-*`から）。外部の画像は`crossOrigin`で読めた物だけ描く。
- **カレンダー書き出し**（`js/ics.js`）: ダッシュボードの各予定は日本時間の日付で終日の予定にする。記念日は端末の日付のまま。
- **ダッシュボードの並び**（`sky_hub_dash_layout_v1`、端末ごと）: 欄を足す時は`event-dashboard.js`の`SECTION_DEFS`と`parts`の両方に足す。
- **バックアップのリマインド**（`js/backup-reminder.js`）・**はじめての案内**（`js/onboarding.js`）: どちらもダッシュボードの先頭に出す。案内は記録が何も無いプロフィールにだけ。
- **ピン留め**（`js/chrome/pin-bar.js`、`sky_hub_pinned_tools`、最大4つ）: 「他のツール」の一覧のピンで留め、`#app-root`の上に並べる。
- アクセント色を**文字**に使う時は`--hub-accent`ではなく`--hub-accent-ink`を使う（着せ替え中は背景に対して4.5:1を保証した色が入る）。

## 更新履歴と「新しいバージョンがあります」

- 利用者に届く変更を公開したら`js/changelog-data.js`に記録する。**1日1件にまとめる**: その日の版がもうあれば新しい版を足さず、その版の`items`に書き足して
  `version`の末尾の番号だけ上げる（`2026.11.10`→`2026.11.10.2`。上げないと新しい版のお知らせが出ない）。`title`もその日の内容に合わせて直す。
- 並び順・誤字・データの小さな直しは単独の行にせず、関連する行に一言足すか、載せない。非公開の機能（試作中の機能）のことは書かない。
- `version`は`年.月.日`のゼロ埋め。新旧は`js/app-update.js`の`compareVersion()`で数字として比べる。`type`は`new`/`improve`/`fix`/`remove`、`route`を書くと「開く」ボタンが付く。
- 更新履歴はポップアップ（`features/changelog/changelog-view.js`の`open()`）。`data-open-changelog`の付いたボタンで開く（`app-update.js`が拾う）。
  入口は関連ツール一覧の下の「更新履歴」・上端の帯・更新直後のトースト・お知らせ。古いリンク`#/changelog`は起動時のツールへ移ってから開く。
- 判定は`js/app-update.js`: 同じファイルを`?fresh=…`付きで読み直し、先頭の版が新しければ画面の上端に帯（新しいバージョンがあります。［最新に更新］✕）を出す
  （`body`の先頭に差し込み`position:sticky`）。お知らせと、関連ツール一覧の下のバージョン欄にも出る。`service-worker.js`は`?fresh`付きの要求を素通しにする。
  新しい版で開いた最初の1回は「Ver.… に更新しました」のトーストを出す（`sky_hub_seen_version`）。

## 累計消費コスト・実額の価格データ（`features/item/data/cost-data.js`）

- `cost.type`は`candle`／`heart`／`starCandle`（星のキャンドル）／`money`（円）／`ticket`／`seasonCandle`（季節キャンドル）／`reward`（季節パスの報酬＝「報酬」）／
  `free`（精霊ツリーで無料＝「無料」）／`na`／`unknown`。`seasonCandle`・`reward`・`free`はキャンドルの合計に入れない（表示とフィルターだけ）。
- 「不明」を埋める時は SkyGame-Data（npm `skygame-data`）の`nodes`（精霊ツリー）・`itemLists`（ショップ）・`iaps`（課金パック）と英語名で突き合わせる。
  対応: `c`→candle、`h`→heart、`ac`→starCandle、`ec`→ticket、`sc`→seasonCandle。価格の無いノードは、アイテムの`group`が`SeasonPass`なら`reward`、それ以外は`free`。
  課金パックのドル→円: 1.99→260・2.99→400・3.99→530・4.99→650・6.99→900・9.99→1300・11.99→1550・14.99→1950・17.99→2380・19.99→2600・24.99→3300・29.99→3900。
- 精霊ツリー管理のツリーは、ツリーのデータに価格が無いノードだけ、このデータの`reward`／`free`／`money`を印として出す（`spirit-catalog-state.js`の`itemCostChip()`）。
  ツリーを開いた時の「100%まで」の欄は`spiritRemainingSummary()`。
- アイテムの画像を外部から持ってくる時は、小さくして`images/<カテゴリ>/<id>.png`に置く（ほかのサイトの画像を直接読み込まない。Wikiの画像は従来どおりURLで参照してよい）。

## 検索エンジン向けの紹介ページ

- ツールは`#/item`のような`#`以降で切り替えるため、検索エンジンには別々のページとして載らない。ツールごとの静的な紹介ページ（`item/index.html`など）と
  `sitemap.xml`を`tools/build-tool-pages.py`で作っている。紹介ページは直接書き換えず、スクリプトの`TOOLS`を直して`python3 tools/build-tool-pages.py`を実行する。
  公開ツールを足した時もここに足す。
- 紹介ページはアプリへ自動で移動させない（移動させると紹介ページが検索に載らない）。「ツールを開く」ボタンで`../#/<ルート>`を開く。
- `service-worker.js`は、アプリ本体（`./`と`./index.html`）以外のページを開く操作を素通しにする。
- ルート直下に、ツールのルート名と同じ名前のフォルダ（`item/`・`share/`…）がある。アプリから`item/…`のような相対パスでファイルを読まないこと。
- `index.html`の`google-site-verification`（Search Consoleの所有権確認）は消さない。

## 旧サイト

- 以前の独立サイトは終了済み。残っている旧サイトは、共通の終了画面（`legacy/hub-move-notice.js`。旧サイトの`index.html`が`/tai-hub/legacy/hub-move-notice.js`を読み込む）を出し、
  `index.html`には対応する紹介ページへの`<link rel="canonical">`を入れてある。
- 共有文のURLは`js/site-config.js`で tai-hub のURLにしてある（`USE_HUB_SHARE_URLS = true`）。

## 気を付けること（実際に起きた不具合のパターン）

### コメント内でクラス名を`/`区切りで並べると、コメントが途中で終わる

CSS/JSの`/* ... */`は最初の`*/`で閉じる。`.foo-*/.bar-*`のように「`-*`」の直後に`/`を置くと、そこでコメントが閉じ、残りがCSSとして解釈されて
直後のルール（ルート要素のトークン定義など）が丸ごと消える。エラーは出ず、「背景が透ける」「文字色がおかしい」といった形で現れる。

**対処**: クラス名を並べる時は`・`（中黒）・読点・カンマ＋スペースを使う（`.pf-modal-*・.sidebar*`）。コメントを書き足した後は次で走査する
（コメントの終わりの直前が英数字/ハイフンなら、途中で閉じている疑いが強い）:

```python
import re, glob
for f in glob.glob('**/*.js', recursive=True) + glob.glob('**/*.css', recursive=True):
    text = open(f, encoding='utf-8').read()
    i, in_comment, start = 0, False, None
    while i < len(text) - 1:
        if not in_comment and text[i:i+2] == '/*':
            in_comment, start = True, i; i += 2; continue
        if in_comment and text[i:i+2] == '*/':
            content = text[start+2:i]
            if content and re.match(r'[A-Za-z0-9_-]', content[-1]):
                print(f, start, repr(content[-50:]))
            in_comment = False; i += 2; continue
        i += 1
```

直した後は、ルート要素（`.<tool>-view`）のカスタムプロパティが`getComputedStyle(el).getPropertyValue('--xxx')`で実際に解決するかまで確かめる。

### アイコンは`class="inline-icon"`を付けないと黒く塗りつぶされる

`<svg><use href="#i-xxx"/></svg>`で書くアイコンは、`.inline-icon`経由で`fill:none; stroke:currentColor;`が効く設計。付け忘れると既定の
`fill:black`で黒い塊になる（エラーは出ない）。次で走査する:

```python
import re, glob
pattern = re.compile(r'<svg([^>]*)>((?:(?!</svg>).)*?<use href="#i-[^"]+"[^>]*/?>(?:(?!</svg>).)*?)</svg>', re.DOTALL)
for f in glob.glob('**/*.js', recursive=True):
    content = open(f, encoding='utf-8').read()
    broken = [m for m in pattern.findall(content) if 'inline-icon' not in m[0]]
    if broken: print(f, len(broken))
```

一括で直す時は、同じ正規表現で`<svg`の直後に`class="inline-icon"`を入れればよい。参照先のシンボルID（`js/icon-sprite.js`やツールのスプライト）が
実在するかもあわせて確かめる（無いと何も表示されない）。

### `<button>`は`border`/`background`をそのクラス自身で明示する

複数ツールが1ページに同居するため、ページ全体の`button { border:none; background:none; }`のようなリセットは置いていない。ボタンのクラスごとに
`border: 0;`（と必要なら`background`）を書く。書き忘れるとブラウザ既定の枠線が残り、丸いボタンに黒っぽいリングが出る。確認:

```js
const el = document.querySelector('.your-new-btn');
getComputedStyle(el).border     // "0px none ..." になっているか
getComputedStyle(el).background // 意図した色 or "none" になっているか
```

### ツールのページ全体に効く「全称リセット」と「.inline-icon の基本色」

- 余白: 元が`*, *::before, *::after { margin:0; padding:0; }`を前提にしているツールは、そのツールのCSSに
  `:where(.xxx-view *, .xxx-view *::before, .xxx-view *::after) { margin:0; padding:0; box-sizing:border-box; }`を置く（`:where()`で詳細度0にする）。
- アイコン: ツール固有のアイコンの色・太さは`:where(.xxx-view) .inline-icon {...}`で指定する。ハブ共通の既定は`currentColor`・太さ1.8。
- 確認は数値で: 画面内の`svg.inline-icon`の`stroke`/`stroke-width`の分布やページの高さを比べる。

### 「動いて見える」で終わらせず、操作して確かめる

- 画面にあるボタン・チェック・入力を一つずつ実際に操作し、結果の数値を確かめる（ハンドラの無いボタン、合計に入らない値などは見た目では分からない）。
- 数値の入力欄は、実際に複数桁を打ってフォーカスが外れないことを確かめる（入力欄は描き直さず、表示だけ差し替える。
  `features/tai-nomacan-pro/nomacan-pro-top.js`・`features/coord-diary/coord-diary-view.js`の`refreshWearRows()`が実例）。
- 上の2つ（アイコンのクラス・ボタンの枠線）は、変更のたびに機械的に走査する。

# tai-hub — 作業時の注意事項

`tai-hub/`は、既存の各スタンドアロンサイト(`item`/`emote`/`share`/`tai-nomacan`/
`star-candle`/`wings`/`companion`/`spirit-catalog`/`tai-revisit`/`tai-score`/
`tai-card`/`tai-transfer`/`tai-info`/`profile`)を1つのSPA(PWA)へ統合したリポジトリ
（独立サイトからの移行準備中。README.md参照）。ビルドツールなしのネイティブES Modules。各ツールは
`features/<tool>/`配下に移植され、`js/router-registry.js`のROUTESテーブルで
`js/router.js`のハッシュルーターに登録される。

親ディレクトリ(`skyツール/`)のCLAUDE.mdに書かれている全社的なルール
(Service Workerのstale-while-revalidate方針・開くアニメーションは
transitionでなくanimationにする・ボトムシートは常にフルワイド)は、
tai-hubで新しくモーダル/シートを書く場合にも同様に適用される。それに加えて、
以下はtai-hub固有の「移植作業で実際に繰り返し発生した」不具合パターン。
新しくツールを移植する時、既存の移植済みツールを直す時は、必ずこのページを
確認すること。

## 🔀 作業後のmainへのマージ（ユーザー指定 2026-10-27）

作業が終わったら、作業ブランチへのプッシュに続けて、確認を取らずにmainまでマージしてよい
（GitHub Pagesはmainから公開されるので、マージしないと修正が利用者に届かない）。
ただし次のような大きな変更は、マージの前にユーザーに確認する:
多くのツールの画面や動きを一度に変えるもの、利用者の保存データを書き換える・消すもの（データ移行など）、
リポジトリの削除・改名など元に戻しにくいもの。対象は tai-hub と各旧サイトのリポジトリすべて。

## 🍎 UIの設計方針: Apple Design (Fluid Interfaces)

**tai-hubで新しくUIを作る時、既存のUIを触る時は、
[emilkowalski/skills — apple-design](https://github.com/emilkowalski/skills/blob/main/skills/apple-design/SKILL.md)
（Appleの"Designing Fluid Interfaces"(WWDC 2018)をWeb向けに翻訳した設計原則集）
を参照すること。** ユーザー指定のハウススタイル(2026-09-23)。

核心は一文で言うと：**動きは「今画面に出ている値」から始まり、ユーザーの
指の速度を引き継ぎ、慣性を先まで投影し、いつでも掴んで反転できる時に
「生きている」と感じられる。** 固定durationの`@keyframes`/`transition`は
中断できない＝この核心と根本的に相性が悪い。タッチ可能な要素（モーダル・
ドロワー・ドラッグ操作）にはバネ物理を使う。

### 現状の棚卸し(2026-09-23、6並列エージェントによる実地監査済み)

すでに良い状態のもの(そのまま踏襲する)：
- `:active`によるpointerdown起点のタップフィードバック（`transform:scale()`)は
  複数ツールに広く根付いている。
- `features/tai-card/tai-card-view.js`のアバター/背景クロップドラッグ・
  時計ハンドルドラッグは`setPointerCapture`による正しい1:1直接操作の実例。
- `@keyframes`の中身はほぼ全てtransform/opacityのみでコンポジタ最適。
- `tokens.css`のbody fontは`-apple-system, BlinkMacSystemFont, ...`と
  システムフォント優先（`tai-nomacan`/`star-candle`/`tai-card`/`profile`の
  4ツールは意図的な装飾フォントでブランディング差別化しており、これは
  「直すべきバグ」ではなくスコープ外——全ツール一律システムフォント化は
  しないこと）。

まだギャップがあるもの(新規/修正時に意識する。全面的な一括リトロフィットは
していない——気付いた範囲から直す)：
- **開閉の非対称性**: `js/chrome/*.js`のモーダル/ドロワーは「開く」時だけ
  `@keyframes`(`sheetSlideUp`/`iosFade`)で演出され、「閉じる」時は
  `classList.remove('open')`一発で`display:none`へ即座にスナップする
  (`close()`にアニメーションが無い)。入口と出口は同じ経路を辿るべき、
  というApple原則に反する。新しく閉じる処理を書く/直す時は、閉じる用の
  `@keyframes`を追加するか、下記`js/motion.js`の`animateSpring`で
  transformをフェードアウトさせてから`display:none`にする。
- **バネ物理が0件**: `js/chrome/*.js`にはドラッグでの開閉ジェスチャーが
  一切無い(タップでの開閉のみ)。新しくドラッグ可能なシート/ドロワーを
  作る時は、下記`js/motion.js`を使うこと。
- **マテリアル階層が未整備**: `backdrop-filter`は7箇所のみで、うち3箇所
  (旧`.site-dock`含む)は不透明な背景色に掛けていたため視覚的に無効化
  していた(`--hub-card-glass`トークンを追加し`.site-dock`は修正済み——
  下記参照)。`blur`の強さでマテリアルの「重み」を意図的に表現する設計は
  まだ無い。
- **タイポグラフィが未トークン化**: 大きい見出しには負のtracking、小さい
  ラベルには正のtrackingという方向性は複数ツールに実例があるが、
  `tokens.css`/`chrome.css`に共有トークンが無く、ファイルごとに符号が
  割れている箇所もある。新しく`chrome.css`/`tokens.css`に見出し・数値
  表示を追加する時は、大きい文字(20px+)は`letter-spacing`を負に
  (`-0.02em`前後)、小さいラベル(13px-)は正に(`0.02〜0.06em`前後)、
  行間は見出しほどタイト(`line-height:1〜1.15`)・本文ほどゆったり
  (`1.6〜1.9`)、という既存の暗黙の作法を明示的に踏襲すること。
- **アクセシビリティ3種のうち1種のみ対応**: `prefers-reduced-motion`は
  6ファイルにあるが大半が「全アニメーションを0.01msに潰す」力技(唯一
  `companion.css`だけがスライドをクロスフェードに置き換える正しい実装)。
  `prefers-reduced-transparency`と`prefers-contrast`は全CSS中0件だった
  (`.site-dock`にのみ`prefers-reduced-transparency`を追加済み——下記参照)。
  半透明面や凝ったアニメーションを新しく追加する時は、この3つの
  メディアクエリすべてを最初からセットで書くこと(テンプレは下記)。

### `js/motion.js` — 依存追加なしの最小バネユーティリティ

npm依存(Motion/Framer Motion等)はビルドツール不要という設計と相性が悪いため
追加せず、`js/motion.js`に自前実装した(`animateSpring`/`rubberband`/
`project`/`velocityFromHistory`)。ダンピング比(`damping`)とレスポンス秒数
(`response`)というApple準拠の2パラメータで指定する。使う時の指針：

```js
import { animateSpring, rubberband, project, velocityFromHistory } from '../../js/motion.js';

// 既定は減衰比1.0(オーバーシュート無し)。メニュー・シートのフェードイン等、
// ジェスチャーの勢いを伴わない演出はこれを使う。
animateSpring(() => currentX, v => { el.style.transform = `translateX(${v}px)`; }, targetX);

// フリック・ドラッグ解放などモメンタムのある操作だけ、わずかに弾む
// damping ~0.8 を使う(理由なくオーバーシュートさせない)。
animateSpring(() => currentY, v => { sheet.style.transform = `translateY(${v}px)`; }, target, {
  damping: 0.8, response: 0.3, velocity: releaseVelocity,
});

// ドラッグ境界はMath.max/minのハードクランプではなくrubberband()で
// 弾性抵抗を掛ける。
const overshoot = rawValue - bound;
const value = overshoot > 0 ? bound + rubberband(overshoot, dimension) : rawValue;

// pointerup時、pointermove履歴から離脱速度を求めてから慣性の着地点を予測する。
const v = velocityFromHistory(moveHistory);
const landingPoint = currentY + project(v);
```

途中で再度呼び出したい(=ジェスチャーが再開/反転した)時は、`animateSpring`が
返すハンドルの`.redirect(newTarget, newVelocity)`を使う——その時点の
現在値・速度から継ぎ目なく繋がる(中断可能性の核心。最初からアニメーションを
やり直さない)。

### マテリアル(半透明)を書く時のテンプレート

```css
.your-translucent-chrome {
  /* 🍎 不透明色にbackdrop-filterを重ねても無効。半透明トークンとセットで使う */
  background: var(--hub-card-glass); /* rgba(255,255,255,0.72) / rgba(28,27,34,0.68) */
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
}
@media (prefers-reduced-transparency: reduce) {
  .your-translucent-chrome { background: var(--hub-card); backdrop-filter: none; -webkit-backdrop-filter: none; }
}
```

モーダルタスク(操作を止めて注意を要求する)は不透明カード+`rgba(0,0,0,0.4〜0.45)`
の暗いスクリム(既存の`.modal-overlay`と同じ、これは変更不要)。並行して見える
非ブロッキングなパネル(トースト・ポップオーバー等)は逆に、スクリムなし+
上記の半透明トークンを使う——`css/share.css`の`.sv-toast`
(`blur(25px) saturate(180%)`)が良い実例。

### アクセシビリティ3種のテンプレート(半透明・凝ったアニメーションを追加する時は必ずセットで)

```css
@media (prefers-reduced-motion: reduce) {
  /* 🩹 全称セレクタでduration:0.01msに潰すのではなく、該当セレクタを
     列挙してスライド/バネ/オーバーシュートをクロスフェードに置き換える
     (companion.css:1402-1403が正しい実例) */
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

## 🪟 ワイド画面のサイドパネル（関連ツール＝左端／ダッシュボード＝右端）

幅1280px以上で、「関連ツール」一覧を左端、「今日・今週・今月」ダッシュボードを右端に常時表示する
（パネルを使う側のドックのボタンはこの幅では非表示）。ユーザー要望（16:9ディスプレイで
ドックを経由せずに使いたい）への対応。設定は 表示設定 > 「ワイド画面のサイドパネル」で**左（関連ツール）と右（ダッシュボード）を別々に**
オフにできる（既定オン。キーは`sky_side_tools`／`sky_side_dash`。旧`sky_hub_side_panels`が`0`なら未設定の間それを引き継ぐ）。
オフにした側は従来どおりドックのボタンから開く。**キーは単体ツール全サイト（`item`〜`wings`）と共通**で、どちらで変えても同じ端末では反映される。

- 実装: `js/chrome/side-panels.js`（中身のマウント/アンマウント）・`css/chrome.css`（`html.side-panels-on`＋メディアクエリ）・
  `index.html`（`#side-left-root`/`#side-right-root`の足場）。幅の境界（1280px）はCSSとside-panels.jsの2か所で一致させること。
- **レイアウト用クラス（左=`side-panels-on`／右=`side-dash-on`）は`index.html`先頭のインラインスクリプトで描画前に付ける**
  （JS起動後に付けると本文が左右にずれて画面がガクつく）。設定の切替では`sidePanels.sync()`がクラスと中身をまとめて更新する。
  ドックのボタンは`dock-tools`／`dock-dash`クラスで、対応する側のクラスが付いている間だけ隠れる。
- ダッシュボード（`features/shared/event-dashboard.js`）は元々1か所にしかマウントできなかったため、常設用に
  `mount(el, { persistent: true })`／`unmountPersistent()`を追加した。各ツールが自前モーダルで使う`mount()`/`unmount()`
  （一時マウント）とは別管理なので、同時に出しても、ツールを離れて`unmount()`しても常設パネルは止まらない。
  新しくevent-dashboardを使うビューを足す時も、`unmount()`は常設分に影響しない前提でよい。
- ツール一覧の描画先は`.js-tools-nav`すべて（引き出し＋左パネル）。`tools-drawer.js`の`renderNav()`が全部に描く。
- モーダル/ボトムシートは従来どおり全幅（パネルより手前）。**これは「画面幅でモーダルの形を変える」実装ではない**ので、
  ルートCLAUDE.mdの「ボトムシートは画面幅を問わず常にフルワイド」方針とは矛盾しない。
- 右端に浮かぶ固定ボタン（`.tr-quick-jump`・`.floating-stop-btn`）は`chrome.css`でパネルの内側へ寄せている。
  右端に固定配置する要素を新しく足す時は同様に`--side-right-w`ぶん内側へ寄せること。

## 🎨 着せ替え（テーマ）エンジン — 新しいツールを移植/追加した時は必ず対応表に足す

画面の色・質感・背景などを利用者が自由に着せ替えられる機能
（`js/theme.js`＝配色の生成とCSS出力・保存、`js/theme-fx.js`＝背景のきらめき、
`js/chrome/theme-studio.js`＝着せ替え画面、`css/theme.css`）。**独立したドックのボタンは持たず、
「表示設定」シートの中の1画面（表示設定 > 着せ替え）**として開く（`chrome/settings-modal.js`が
シートの中身を設定一覧⇔着せ替え画面で切り替える。着せ替え画面の間だけシートは背景を暗くせず外側の操作も
止めない＝`#settingsModalOverlay.ts-live`）。起動時に開くツールの設定（`sky_hub_start_route`）も同じ設定一覧にある。

### 仕組み（なぜこの形か）

- 軸は「アクセント色」と「背景の色合い」の2つ。文字・区切り線・アクセントの
  文字用/塗り用は**背景から計算してコントラストを保証**する（`ensureContrast`）。
  利用者が自由に色を選んでも読めなくならないための安全弁なので、色を直書きせず
  必ずこの関数を通した値（`p.text`/`p.accentInk`/`p.redInk`…）を使うこと。
- 各ツールは色トークンの語彙がバラバラ（`--card`/`--sc-card`/`--card-bg`/`--pv-panel`…）
  なので、`theme.js`の`TOOL_MAPS`に「ツールのルート要素 → 共通の色の割り当て」を持つ。
  生成CSSは`<style id="hub-theme-style">`に入れ、セレクタは`:root[data-hub-theme] .xxx-view`
  と詳細度を上げてある（各ツールの`[data-theme="dark"] .xxx-view`や、後から注入される
  `<style>`より必ず勝つため）。**`!important`は使わない。**
- 「アクセントに合わせる」背景は、既存のライト/ダーク/システム切替に追従する
  （`data-theme`の変化を`MutationObserver`で拾って配色を作り直す）。「好きな色」の背景と
  「明るさ固定」のテーマは切替に関わらず固定。
- 描画前スクリプト（`index.html`）が、`localStorage`のキャッシュ（`sky_hub_theme_css_v1`）の
  CSSを先に差し込む＝起動時に標準の配色が一瞬見えるちらつきを防ぐ。キャッシュの書き込みは
  スライダー操作中に毎フレーム走らないよう350msで間引いている。
- 外部入力（共有コード・バックアップのインポート）は必ず`normalizeTheme()`を通す。色は
  `#RRGGBB`のみ。描画前スクリプトは`url(`・`@import`を含むキャッシュを無視する。
- 壁紙（端末の画像）はlocalStorageの容量を圧迫しないようIndexedDBに保存（共有コードには含めない）。
  どのテーマからも参照されなくなった壁紙は`pruneWallpapers()`で消す。
- 着せ替えが無効（標準）の時は、スタイル・属性・キャッシュのすべてを残さない。ツール本来の
  見た目が標準であり、それを変えないこと。

### 新しいツールを追加/移植した時の手順

1. そのツールのルート要素のクラス名（例`.xxx-view`）を`VIEW_ROOTS`に追加（背景を透明にして
   背景グラデーション・壁紙・きらめきを透かすため）。
2. そのツールが使う色トークンを`TOOL_MAPS`に追加する。**意味のある色（所持=緑・課金=橙・
   警告=赤など）は上書きしない**。上書きするのは「主役の色」（リンク・ボタン・強調）と面の色だけ。
   赤をテキストに使うなら`'--red': p.redInk`を足す（淡い背景でも読める濃さに補正される）。
3. 色を直書きしている「主役の色」（固定の橙のバナー・金のボタンの文字など）は、トークンでは
   追従しないので`BRAND_RULES`に個別ルールを足す。
4. 確認: 複数のテーマ（ライト系・ダーク固定・淡い黄色のアクセント・好きな色の中間グレー背景）で、
   テキストと実効背景のコントラストを全ルートで機械的に走査する（2026-10-13にこの方法で
   star-candle/tai-revisitの悪化を見つけた）。見た目の確認だけで終わらせない。

### 半透明（ガラス質感）

`theme.card==='glass'`のときだけ、ドック・主要な大きな面（`GLASS_TARGETS`）に`backdrop-filter`を掛ける。
タイルや一覧の行のように**数が多い要素には掛けない**（重くなる）。モーダル/引き出しは常に不透明
（読みやすさ優先）。`prefers-reduced-transparency`/`prefers-contrast`向けの上書きは`buildCss`が自動で出力する。

## 🩹 コメント内でクラス名を`/`区切りで列挙すると、CSSコメントが途中で終わる

**日本語のdocコメント内で「このクラス群は使われなくなった」のような説明を
書く時、複数のクラス名を`.foo-*/.bar*/.baz-*`のように`/`で区切って列挙する
書き方を絶対にしないこと。** 過去に実際に発生した、影響が非常に大きい不具合
(2026-09-23発見)。`wg-i-*`のような命名規則の説明でも同様に注意。

CSSの`/* ... */`コメントは(JSのブロックコメントも同様)最初に出現した`*/`で
問答無用に閉じる仕様で、途中でネストしたり長さを推測したりはしない。
「クラス名-*」の直後に区切りの`/`を置くと、「-\*」+「/」が文字通り
コメント終端記号`*/`になってしまい、**その時点でコメントが強制的に閉じる**。
実例(`css/companion.css`): `.pf-modal-*/.sidebar*/.site-dock*/.lang-select`と
書いたところ、`.pf-modal-*/`の部分でコメントが閉じてしまい、続く
「.sidebar*/.site-dock*/...」からコメントの本来の閉じ`*/`までの間が
**CSSとして解釈されてしまい**(日本語の地の文でCSS構文として無意味)、
パーサーはこれをエラーとして復旧しようとした結果、直後にあった本物の
`.companion-view{ --card-bg:#fff; --text-color:#000; ... 20個以上のトークン }`
という**ルート定義ルールが丸ごと消滅**した。ダークモード用の上書きブロックは
別の場所にあり無事だったため、**ライトモード限定で**カードの背景・文字色・
枠線色が軒並み未定義(空文字列)になり、「背景が透けて見える」
「文字色がおかしい」という一見無関係に見える不具合として現れた
——コンソールエラーは一切出ない。同種の不具合はこのセッション中に
`wings`(`pfDash*/pfReminder*`)・`data-transfer`・`companion`・
`features/item/coord/my-coord.js`の計4箇所で独立に発生している。

**対処**: クラス名を列挙する時は`/`ではなく`・`(中黒)や読点、カンマ+スペース
などCSS的に無害な区切り文字を使う。`.pf-modal-*・.sidebar*・.site-dock*`
のように書けば、`*・`はコメント終端記号にならないため安全。

**検出方法**(新しくコメントを書き足した後、既存コメントを疑う時は必ず実行)：
非ネストのCSSコメント解析(最初の`*/`で問答無用に閉じる)を正しく再現し、
検出したコメントの終端直前の文字が英数字/ハイフンかどうかを調べる
——自然な日本語コメントの終わりは通常、空白・句読点・括弧閉じなどで終わる
はずで、英数字やハイフンが`*/`に直接くっついているのは「本来もっと長い
コメントのつもりだったのに、途中の`単語-*/`で事故的に閉じてしまった」
ことを示す強いシグナルになる：

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

見つかった箇所だけを機械的に直すのではなく、**修正後に該当ファイルの
ルート要素(`.<tool>-view`)のCSSカスタムプロパティがブラウザで実際に
`getComputedStyle(el).getPropertyValue('--xxx')`で解決するかまで
必ず確認する**こと——「動いているように見える」だけでは、変数が
未定義のままフォールバック値やブラウザ既定値で偶然それらしく
表示されているだけ、というケースを見逃す。

## 🩹 アイコンは`class="inline-icon"`を省略すると黒塗りになる

**`<svg><use href="#i-xxx"/></svg>`パターンでアイコンを書く時は、
必ず`class="inline-icon"`を付けること。** 過去に実際に発生した不具合。

`js/icon-sprite.js`(共有)や各ツールがmount時に注入するローカルスプライトの
`<symbol>`は、アウトライン表示を前提に`fill:none; stroke:currentColor;`が
`.inline-icon`クラス経由で適用される設計。このクラスを書き忘れると、
ブラウザの既定値`fill:black`がそのまま効き、塗りつぶし可能な形状を持つ
パスは黒い塊としてレンダリングされる——コンソールエラーは一切出ず、
`<use href>`の参照先シンボルも正しく存在するため、実際に画面を見ないと
気付けない。5ツール移植時に64箇所、その後の追加パスで3箇所、9ツール
移植時にも複数箇所で再発した(コピー元コードから`<svg>...</svg>`を
コピペする際にクラスだけ落ちる、という単純なミスが繰り返し起きている)。

検出はripgrepでは(lookaheadが必要で)厳しいので、Pythonで機械的に走査する：

```python
import re, glob
pattern = re.compile(r'<svg([^>]*)>((?:(?!</svg>).)*?<use href="#i-[^"]+"[^>]*/?>(?:(?!</svg>).)*?)</svg>', re.DOTALL)
for f in glob.glob('**/*.js', recursive=True):
    content = open(f, encoding='utf-8').read()
    broken = [m for m in pattern.findall(content) if 'inline-icon' not in m[0]]
    if broken: print(f, len(broken))
```

一括修正は同じ正規表現で`<svg`の直後に`class="inline-icon"`を挿入すればよい
(個々の`<path>`が独自に`fill="currentColor" stroke="none"`等を持つ場合は
そちらが優先されるため、機械的に全箇所へ付与しても安全)。

関連する別バグ：`#i-xxx`で参照しているシンボルIDが`js/icon-sprite.js`や
ローカルスプライトに実在しないケース(この場合は黒塗りではなく「何も
表示されない」——`SITE_LINKS`の`icon`フィールドで実際に発生した)。
アイコンを使う場所を新しく追加したら、参照先シンボルが定義済みかも
あわせて確認すること。

## 🩹 移植した`<button>`要素は`border`/`background`を必ず自分で明示する

**新しく`<button class="...">`要素を書く時、既存のものを直す時は、
そのクラス自身のCSSルールに`border`(と必要なら`background`)を必ず
明示すること。** 過去に実際に発生した不具合(2026-09-23)。

移植元の各スタンドアロンサイトは、ページ先頭の`<style>`に
`button { cursor:pointer; border:none; background:none; font-family:inherit; }`
という**ページ全体に効くグローバルリセット**を必ず持っている。tai-hubは
複数ツールが1ページに同居するため、この手のグローバルリセットは意図的に
使わず、代わりに個々のボタンクラス(`.feature-btn`・`.cat-tile`等)が
それぞれ`border: 0;`を自分で書く、という規約になっている——しかし
`features/item/category-view.js`の`.cv-tile-fav-btn`/`.cv-tile-wish-btn`
(お気に入り/ウィッシュリストのタイルボタン)と、同じパターンを複製した
`css/item-music-sheet.css`の`.ms-tile-fav-btn`/`.ms-tile-wish-btn`、
さらに`.cv-view-toggle-btn`/`.ms-view-toggle-btn`(グリッド/リスト切替)が、
`background`(と`.cv-tile-*`は半透明度)だけ調整して`border`のリセットを
書き忘れていたため、ブラウザ既定の「2px outset」枠線が消えずに残り、
特に円形の丸ボタンでは黒っぽいリングが浮いて見える不具合になっていた
(ユーザーからは「アイコンボタンがギラギラして浮いて見える」という、
原因がbox-shadowだと誤解しやすい形で報告された——実際にはbox-shadow
除去だけでは直らず、border未リセットが真因だった)。

検出は、移植元サイトの対応する要素と`getComputedStyle(el).border`を
突き合わせるのが確実(見た目だけでは既定の枠線か意図した枠線か判別しにくい)。
新しくボタンを移植・追加する際は、以下を毎回セットで確認する：

```js
// ブラウザのコンソール等で
const el = document.querySelector('.your-new-btn');
getComputedStyle(el).border   // "0px none ..." になっているか
getComputedStyle(el).background // 意図した色 or "none" になっているか(既定は薄灰色)
```

## 🩹 移植作業は「その場で動いて見える」だけでは終わりにしない

9ツール大量移植バッチ(2026-09-23)の直後、ユーザーから「幅が画面に合わせて
伸びている」「記号が黒くなっている」「背景が透けている」という指摘が複数の
ページにわたって出た。各移植エージェントは自分の担当ツールを個別にブラウザで
動作確認していたが、①他の移植済みツールとの相対比較、②本家サイトの
`getComputedStyle`との数値突き合わせ、③複数ツールを横断した共通パターンの
再発チェック、まではしていなかった。新しくツールを移植・修正したら、
「動く」で終わらせず、上記2つのパターン(アイコンクラス・ボタンの
border/background)を機械的に再走査し、かつ本家サイトと横に並べて
`max-width`/コンテナ幅・背景色・枠線を数値で突き合わせることまでを
「移植完了」の条件とする。

## 🩹 独立サイトのページ全体に効いていた「全称リセット」と「.inline-icon の基本色」を移し忘れない

最終確認(2026-10-25)で、8ツールの見出し・段落にブラウザ既定の余白が付き、6ツールのアイコンが黒っぽく細く
なっていた。どちらも独立サイトではページ先頭の`<style>`に1行で書かれていたもので、ハブでは複数ツールが同居する
ため移植時に落ちやすい。

- 余白: 元が`*, *::before, *::after { margin:0; padding:0; }`を持つツールは、そのツールのCSSに
  `:where(.xxx-view *, .xxx-view *::before, .xxx-view *::after) { margin:0; padding:0; box-sizing:border-box; }`を置く
  （`:where()`で詳細度0にして、元の全称セレクタと同じく個々のルールが必ず勝つようにする）。
- アイコン: 元の`.inline-icon { stroke: var(--色); stroke-width: 2.2; ... }`を`:where(.xxx-view) .inline-icon {...}`で
  移す。ハブ共通の既定は`currentColor`・太さ1.8なので、これが無いとアイコンの色と太さが元と変わる。
  元サイトで文字色のまま描いている矢印など（itemのカテゴリの「›」）は個別に`stroke: currentColor`へ戻す。
- 確認は見た目ではなく数値で: 画面内の`svg.inline-icon`の`stroke`/`stroke-width`の分布と、ページ全体の高さを
  独立サイトと突き合わせる。

## 🩹 移植した画面は「ボタンを実際に押して」確かめる（ハンドラの無いボタン・入力のたびにフォーカスが外れる）

ノマキャン計算機プロ(2026-10-14)で、「マウントできてデータも同じ」なのに実際には使えない状態が
見つかった: ①「デイリーリセット」ボタンに`onclick`が無かった、②入力欄を含むカードを`innerHTML`ごと
描き直していたため1文字打つたびにフォーカスが外れた、③黒シャード+200が合計に反映されず予想残数が
日数を無視していた。マウント確認・データ突き合わせ・コンソールエラー無し、では見つからない。
新しくツールを移植・修正したら、①本家のテンプレートにある操作（ボタン・チェック・入力）を一つずつ
ハブ側で操作して結果の数値を本家と突き合わせる、②数値入力は実際に複数桁を打ってフォーカスが
残ることを確認する（入力欄は描き直さず、数値表示だけ差し替える。`features/tai-nomacan-pro/nomacan-pro-top.js`参照）、
までを完了条件とする。


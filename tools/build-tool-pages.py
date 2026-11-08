#!/usr/bin/env python3
"""
🔎 検索エンジン向けの「ツールの紹介ページ」と sitemap.xml を作る（2026-11-07）。

tai-hub は1ページのアプリで、ツールは #/item のような # 以降で切り替えている。Google は # 以降を別のページとして
扱わないので、このままでは「Sky アイテム管理」「連れ歩き」などで調べても各ツールが出てこない。
そこで、ツールごとに中身のある静的なページ（./item/index.html など）を置き、そこからアプリのツールを開けるようにする。

  python3 tools/build-tool-pages.py   （tai-hub のフォルダで実行。ページと sitemap.xml を上書きする）

・ツールを足した・説明を変えた時は、下の TOOLS を直してから実行する。
・紹介ページは勝手にアプリへ移動させない（移動させると Google が紹介ページではなくアプリ本体だけを載せるため）。
  大きな「ツールを開く」ボタンで開いてもらう。
・service-worker.js は、アプリ本体（./ と ./index.html）以外のページを開く操作を素通しにしている。
"""
import html
import os

BASE = 'https://taipak5000.github.io/tai-hub/'
LASTMOD = '2026-11-07'

# slug（紹介ページのフォルダ名）, ルート, ページ名, 検索結果に出る説明, 見出しの下の文, できること, 検索されそうな言い方
TOOLS = [
    ('item', 'item', 'Sky アイテム所持管理（アイテム一覧・所持率）',
     'Sky 星を紡ぐ子どもたちのアイテムを一覧で管理できる無料ツール。ケープ・お面・髪型・衣装・楽器・家具などの所持をチェックして、所持率や欲しいものリスト、必要なキャンドル・ハートを確かめられます。',
     'ケープ・お面・髪型・アクセサリー・衣装・靴・楽器・家具など、Skyのアイテムを画像つきの一覧でチェックできます。',
     ['カテゴリごとのアイテム一覧（画像つき）と所持チェック', '全体・カテゴリ別・無課金で手に入るものなどの所持率', '欲しいものリストと、必要なキャンドル・ハート・季節キャンドルの合計', 'シーズン・イベント・旅の精霊で手に入るアイテムの絞り込み', '所持率の画像を作ってXでシェア'],
     'Sky アイテム管理、Sky アイテム一覧、Sky 所持率、Sky ケープ一覧、Sky 衣装一覧'),
    ('coord-diary', 'coord-diary', 'Sky コーデ日記（コーデ記録・ランダムコーデ）',
     'Sky 星を紡ぐ子どもたちのコーデを写真と着ているアイテムで記録できるツール。シーズンごとのアルバム、ランダムコーデ、コーデの画像を付けたXへのポストもできます。',
     'その日のコーデを、写真と着ているアイテムのアイコンで残せます。',
     ['写真・場所・メモつきのコーデ日記', '季節・日々のイベントごとのシーズンアルバム', '持っているアイテムからのランダムコーデ・マイコーデ・コラージュ', '撮影ポーズに困った時のお題くじ', '着ているアイテムのアイコン画像を付けてXにポスト'],
     'Sky コーデ、Sky コーデ記録、Sky ランダムコーデ'),
    ('wish-plan', 'wish-plan', 'Sky ほしいもの計画（必要キャンドル計算）',
     'Sky 星を紡ぐ子どもたちの欲しいアイテムに必要なキャンドル・ハート・季節キャンドルを、今の所持数と比べて計算するツールです。',
     '欲しいアイテムをまとめて、あと何本のキャンドルが要るかを計算できます。',
     ['欲しいものリストの合計（キャンドル・ハート・季節キャンドル）', '今の所持数との差と、貯まるまでの目安'],
     'Sky 必要キャンドル、Sky 欲しいもの'),
    ('emote', 'emote', 'Sky エモート所持率管理（エモート一覧）',
     'Sky 星を紡ぐ子どもたちのエモートをレベルごとに一覧で管理できるツール。所持率や、精霊・エリア別の絞り込みができます。',
     'エモートをレベルごとにチェックして、所持率を確かめられます。',
     ['エモート一覧（レベルごと）と所持チェック', '精霊・エリア・入手方法での絞り込み', '所持率の画像を作ってシェア'],
     'Sky エモート一覧、Sky エモート 所持率'),
    ('companion', 'companion', 'Sky 精霊同行ツール（連れ歩き・ポイント計算）',
     'Sky 星を紡ぐ子どもたちの精霊の連れ歩き（同行）で、ハートやアイテムを手に入れるまでの日数・必要なキャンドルを計算するツールです。',
     '精霊の連れ歩きで、目当てのアイテムまで何日かかるか・キャンドルがいくつ要るかを計算できます。',
     ['精霊ごとのツリーと、連れ歩きで手に入るものの確認', '目標までの日数・必要キャンドルの計算', '複数の精霊を連れ歩く時の効率の比較', '全精霊共通のメモ'],
     'Sky 連れ歩き、Sky 精霊同行、Sky 同行ポイント'),
    ('tai-nomacan', 'tai-nomacan', 'Sky ノマキャン計算機（キャンドル集め）',
     'Sky 星を紡ぐ子どもたちのキャンドル（ノーマルキャンドル）集めを記録・計算するツール。毎日の獲得本数を記録して、目標の本数に届く日を予想できます。',
     'キャンドル集めの記録と、目標までの残りを計算できます。',
     ['毎日のキャンドル集めの記録と獲得履歴', '今のペースから、目標の本数に届く日の予想', 'デイリークエストの記録'],
     'Sky ノマキャン、Sky キャンドル 計算、Sky キャンドルラン'),
    ('star-candle', 'star-candle', 'Sky 星のキャンドル計算機（シーズンキャンドル）',
     'Sky 星を紡ぐ子どもたちの季節キャンドル（シーズンキャンドル）が、目標の本数にいつ届くか・シーズン終了までに間に合うかを計算するツールです。',
     '季節キャンドルの目標に届く日と、間に合わせるのに必要なペースを計算できます。',
     ['目標の本数に届く日の予想', '目標の日までに必要な1日のペース', '集めた記録の保存'],
     'Sky シーズンキャンドル 計算、Sky 季節キャンドル'),
    ('wings', 'wings', 'Sky 羽トラッカー（光の翼・羽の数）',
     'Sky 星を紡ぐ子どもたちの光の翼（羽）の取得状況を、エリアごとに記録できるツールです。',
     '光の翼をエリアごとにチェックして、取り逃しを確かめられます。',
     ['エリアごとの光の翼のチェック', '集めた羽の数の確認'],
     'Sky 羽 場所、Sky 光の翼、Sky 羽 数'),
    ('tai-revisit', 'tai-revisit', 'Sky 再訪精霊データベース（復刻・旅の精霊）',
     'Sky 星を紡ぐ子どもたちの再訪精霊（旅の精霊・復刻）の来訪履歴と、次の来訪を待つ精霊をまとめて確認できるデータベースです。',
     '旅の精霊の来訪の記録を、精霊ごとに確かめられます。',
     ['精霊ごとの再訪の履歴', '待っている精霊の印（来た時にお知らせ）', 'その精霊のツリーの進み具合の確認'],
     'Sky 再訪精霊、Sky 旅の精霊、Sky 復刻'),
    ('spirit-catalog', 'spirit-catalog', 'Sky 精霊ツリー管理',
     'Sky 星を紡ぐ子どもたちの精霊ツリー（フレンドシップツリー）の解放状況を、精霊ごとに管理できるツールです。',
     '精霊ツリーのどこまで解放したかを、精霊ごとに記録できます。',
     ['精霊ごとのツリーの解放状況の記録', '季節ごとの精霊の一覧'],
     'Sky 精霊ツリー、Sky フレンドシップツリー'),
    ('daily-check', 'daily-check', 'Sky デイリーチェックシート（毎日やること）',
     'Sky 星を紡ぐ子どもたちの毎日やること（デイリークエスト・キャンドル集め・大キャンドルなど）をチェックできるシート。今日の要点や週替わりビンゴもあり、印刷・PDF・画像でも保存できます（テスト中）。',
     '毎日やることをチェックして、続けた日数を記録できます。',
     ['毎日やることのチェックと、連続・通算の記録', '今日の要点（大キャンドルの場所など）と1日1回のおみくじ', '週替わりビンゴ', 'A4での印刷・PDF・画像での保存'],
     'Sky デイリー、Sky 毎日やること、Sky チェックリスト'),
    ('share', 'share', 'Sky 創作物管理ツール',
     'Sky 星を紡ぐ子どもたちのシェア系の創作物（シェアメモリー・シェアスペースなど）を、エリアや期限ごとに管理できるツールです。',
     'シェアメモリーやシェアスペースなどの創作物を、置いたエリアや期限と一緒に整理できます。',
     ['創作物の記録（エリア・ジャンル・メモ・日付）', '期限が近いものの確認', 'エリアでの絞り込み'],
     'Sky シェアスペース、Sky 創作物'),
    ('tai-card', 'tai-card', 'Sky 星紡ぎカード（自己紹介カード）',
     'Sky 星を紡ぐ子どもたちの自己紹介カードを作れるツール。プロフィールや好きなものを1枚の画像にまとめてシェアできます。',
     'プロフィールを1枚のカードにして、画像で保存・シェアできます。',
     ['自己紹介カードの作成と画像保存', 'アバターや背景の切り抜き', '称号の表示'],
     'Sky 自己紹介カード、Sky プロフィールカード'),
    ('friends', 'friends', 'Sky フレンド記念日（フォト日記）',
     'Sky 星を紡ぐ子どもたちのフレンドと出会った日や誕生日を記録して、記念日を知らせてくれるツール。写真を残すフォト日記もあります。',
     'フレンドとの記念日や誕生日を記録して、近づいたら知らせます。',
     ['フレンドごとの出会った日・誕生日', '記念日のお知らせ', '写真を残すフォト日記'],
     'Sky フレンド 記念日'),
]

CSS = """
:root{--bg:#F4F3F8;--card:#fff;--text:#1C1C1E;--sub:#6b6b73;--sep:rgba(60,60,67,.14);--accent:#5B52C9;--btn:#4B439E}
@media (prefers-color-scheme:dark){:root{--bg:#0F0E14;--card:#1C1B22;--text:#F2F2F7;--sub:#a1a1a8;--sep:rgba(255,255,255,.14);--accent:#A9A2FF;--btn:#5B52C9}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP",sans-serif;line-height:1.8}
main{max-width:720px;margin:0 auto;padding:28px 16px 40px}
.brand{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:var(--sub);text-decoration:none}
.brand img{width:28px;height:28px;border-radius:8px}
h1{margin:16px 0 8px;font-size:26px;line-height:1.3;letter-spacing:-.02em}
.lead{margin:0 0 20px;color:var(--sub)}
.open{display:flex;align-items:center;justify-content:center;gap:8px;padding:16px;border-radius:14px;background:var(--btn);color:#fff;font-size:17px;font-weight:800;text-decoration:none}
.note{margin:8px 0 0;text-align:center;font-size:12px;color:var(--sub)}
section{margin-top:22px;padding:16px 18px;border:1px solid var(--sep);border-radius:16px;background:var(--card)}
h2{margin:0 0 6px;font-size:16px}
ul{margin:0;padding-left:20px}
.tools{display:flex;flex-wrap:wrap;gap:8px;list-style:none;padding:0}
.tools a{display:inline-block;padding:6px 12px;border:1px solid var(--sep);border-radius:999px;color:var(--accent);font-size:13px;font-weight:700;text-decoration:none;background:var(--card)}
footer{margin-top:24px;font-size:12px;color:var(--sub)}
footer a{color:var(--accent)}
"""


def e(s):
    return html.escape(s, quote=True)


def page(tool):
    slug, route, name, desc, lead, feats, words = tool
    url = BASE + slug + '/'
    others = ''.join(f'<li><a href="../{t[0]}/">{e(t[2].split("（")[0].replace("Sky ", ""))}</a></li>' for t in TOOLS if t[0] != slug)
    ld = ('{"@context":"https://schema.org","@type":"WebApplication","name":%s,"url":%s,"description":%s,'
          '"applicationCategory":"GameApplication","operatingSystem":"Web","inLanguage":"ja",'
          '"offers":{"@type":"Offer","price":"0","priceCurrency":"JPY"},'
          '"isPartOf":{"@type":"WebSite","name":"tai-hub","url":%s}}') % tuple(
        '"' + x.replace('\\', '\\\\').replace('"', '\\"') + '"' for x in (name, url, desc, BASE))
    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{e(name)} | tai-hub</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="tai-hub">
<meta property="og:title" content="{e(name)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{BASE}icons/app-icon-512.png">
<meta name="twitter:card" content="summary">
<link rel="icon" type="image/png" href="../icons/app-icon-192.png">
<link rel="apple-touch-icon" href="../icons/app-icon-192.png">
<script type="application/ld+json">{ld}</script>
<style>{CSS}</style>
</head>
<body>
<!-- このページは tools/build-tool-pages.py で作っている（直接書き換えず、スクリプトを直して実行し直す） -->
<main>
  <a class="brand" href="../"><img src="../icons/app-icon-192.png" alt="" width="28" height="28">tai-hub｜Sky ファンツールまとめ</a>
  <h1>{e(name)}</h1>
  <p class="lead">{e(lead)}</p>
  <a class="open" href="../#/{route}">ツールを開く</a>
  <p class="note">無料・登録不要。データはこの端末のブラウザに保存されます。</p>
  <section>
    <h2>できること</h2>
    <ul>{''.join(f'<li>{e(f)}</li>' for f in feats)}</ul>
  </section>
  <section>
    <h2>こんな時に</h2>
    <p style="margin:0">{e(words)} などを調べている方に。スマホのホーム画面に追加すると、アプリのように使えます。</p>
  </section>
  <section>
    <h2>tai-hub のほかのツール</h2>
    <ul class="tools">{others}</ul>
  </section>
  <footer>tai-hub は「Sky 星を紡ぐ子どもたち」の非公式ファンツールです。ゲームの運営会社とは関係ありません。<br><a href="../">tai-hub のトップへ</a></footer>
</main>
</body>
</html>
"""


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for t in TOOLS:
        d = os.path.join(root, t[0])
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(page(t))
    urls = [BASE] + [BASE + t[0] + '/' for t in TOOLS]
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    sm += ''.join(f'  <url><loc>{u}</loc><lastmod>{LASTMOD}</lastmod></url>\n' for u in urls)
    sm += '</urlset>\n'
    with open(os.path.join(root, 'sitemap.xml'), 'w', encoding='utf-8') as f:
        f.write(sm)
    print(f'{len(TOOLS)} pages + sitemap.xml')


if __name__ == '__main__':
    main()

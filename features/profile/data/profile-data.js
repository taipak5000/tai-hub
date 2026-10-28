/* ================================================================
   作者プロフィール（自己紹介ページ）の表示内容。
   移植元: profile/index.html の <script> 冒頭にあった `profile` / `links`
   の2つのオブジェクト・配列を、値を一切変えずにそのままES moduleへ
   移した。site-dock/pf-modal/tools-drawer等の共有chrome向けのリンク
   （共通ツール一覧 site-links.json）とは別物で、こちらは「Links」セクション自体の見出し・
   説明文（サイト運営者向けの日本語コメントも含め、編集のしやすさを
   優先した元の1件ずつのオブジェクト形式）をそのまま保持する。

   icon フィールドのみ、元実装（<use href="#i-xxx"/>）から参照先を
   tai-hub側のアイコンID体系に合わせて更新している（表示は同一）：
   ・tai-hub共有スプライト(js/icon-sprite.js)に既にあるもの
     （i-folder/i-masks/i-pin/i-candle/i-star-candle/i-sparkle/i-wing/
     i-music-note/i-card/i-sync）はそのまま #i-xxx を参照。
   ・共有スプライトに無いもの（i-x-logo・i-box）だけ、このツール専用の
     ローカルスプライト（profile-view.js が注入。id先頭 pv-i-）を参照する
     よう #pv-i-xxx に差し替えた。
   ================================================================ */

export const PROFILE = {
  name: 'たい',
  tagline: 'ものづくりが好きです',
  // ▼ 英語表示用（空欄ならtaglineが代わりに表示されます）
  taglineEn: 'I love making things.',

  // MBTIタイプ（空欄なら非表示になります）
  mbti: 'ISTJ',

  // 年齢ステータス（空欄なら非表示になります）
  ageStatus: '成人済み',
  // ▼ 英語表示用（空欄ならageStatusが代わりに表示されます）
  ageStatusEn: 'Adult',

  // ゲーム内の名前（空欄なら非表示になります）
  gameName: 'Paㅋ',

  bio: '普段は自分が欲しいと思ったサイトを作って公開しています。\n効率化やちょっとしたグリッチ技を扱うのが好きです。\n含み笑いのスカウトマスクを愛用している方とフレンドになりたいです。',
  // ▼ 英語表示用（空欄ならbioが代わりに表示されます）
  bioEn: "I usually build and publish whatever websites I feel like I need myself.\nI enjoy efficiency tricks and the occasional small glitch technique.\nI'd love to be friends with anyone who wears the smirking Scout mask.",

  // 「もっと知りたい人向け」を押すと表示される追加情報（空欄なら非表示になります）
  extraInfo: 'Sky以外に、モンストやイナクロもプレイしている方仲良くしてくれると嬉しいです\n切り絵の作成やイラストを描いたりと、いろんなことに手を出しています！',
  // ▼ 英語表示用（空欄ならextraInfoが代わりに表示されます）
  extraInfoEn: "Besides Sky, I'd be happy to get along with anyone who also plays Monster Strike or Inazuma Eleven Climax.\nI also dabble in a bunch of other things, like paper cutting art and illustration!",

  // 写真を使いたい場合はここにファイル名やURLを入れてください
  avatarImage: 'https://pbs.twimg.com/profile_images/2056923572296437760/EnPe2tws_400x400.jpg',

  // 右上の小さなラベル文字
  label: 'SELF INTRODUCTION',

  // ページ下部の小さな文字（空欄なら「© 年 名前」が自動で入ります）
  footnote: '',
};

export const LINKS = [
  {
    icon: '<svg class="inline-icon" width="20" height="20"><use href="#pv-i-x-logo"/></svg>',
    title: 'X (Twitter)',
    titleEn: 'X (Twitter)',
    url: 'https://x.com/skyzztai',
    description: '日々のぼやきやスクショ、メモなど\nゆるい呟きを投稿しています！\n早く返信してほしい・確実に読んでほしい内容は、リプライ・引用・DMでお送りください！',
    descriptionEn: 'I post casual day-to-day musings, screenshots, and notes.\nIf you want a fast reply, or want to make sure I actually see something, please send it as a reply, quote tweet, or DM!',
  },
  {
    icon: '<svg class="inline-icon" width="20" height="20"><use href="#pv-i-box"/></svg>',
    title: 'お題箱',
    titleEn: 'Odaibako (Question Box)',
    url: 'https://odaibako.net/u/Skyzztai',
    description: '感想やご意見はこちらへどうぞ。\nDMやリプで送りにくい内容も気軽にお送りください！',
    descriptionEn: "Feel free to send feedback or thoughts here.\nIt's also a good place for anything that feels awkward to send as a DM or reply!",
  },
];

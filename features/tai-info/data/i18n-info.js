/* ================================================================
   tai-info（設定・クレジット）のツール固有i18n辞書。

   移植元: tai-info/index.html の `const I18N = {...}`（~行1079-1312）。
   元の辞書は nav/sidebar/tools/iconCustom/dispSettings/dock/footer等、
   taipak5000.github.io系ツール共通の「共有chrome」文言もまとめて
   持っていたが、tai-hub側の共有chrome（js/chrome/*.js）が既に自分自身の
   翻訳を持っているため、それらは意図的に移植せず（そのまま複製すると
   死んだコードになる）、このツール自身のタブコンテンツ（設定について/
   クレジット/プライバシーポリシー/参考文献）に関わる文言だけを
   残している。「ホーム画面アイコンをカスタマイズ」機能（iconCustomModal）
   は tai-hub では概念が成立しない（emote-view.jsと同じ理由。同コメント
   参照）ため未移植で、settings.icon.customizeBtn キーも同様に省いている。

   t(key, vars) は元の t(key, vars) と同じ挙動（'.'区切りのキーで辞書を
   辿り、現在言語→jaへフォールバックし、{varName}を置換する）。
   ================================================================ */
import { CURRENT_LANG } from '../../../js/i18n.js';

export const INFO_I18N = {
  tabs: {
    settings: { ja: `設定について`, en: `About Settings` },
    credits: { ja: `クレジット`, en: `Credits` },
    privacy: { ja: `プライバシーポリシー`, en: `Privacy Policy` },
    references: { ja: `参考文献・画像引用元`, en: `References & Image Credits` },
  },

  settings: {
    label: { ja: `設定について`, en: `About Settings` },
    sub: { ja: `taipak5000.github.io系のSkyツール群に共通する設定・機能の説明です。実際の操作は各サイト側の画面で行ってください。`, en: `This explains settings and features shared across the taipak5000.github.io family of Sky tools. Please perform the actual operations on each site's own screen.` },
    profile: {
      title: { ja: `プロフィール（保存枠）切替`, en: `Profile (Save Slot) Switching` },
      body: { ja: `ほとんどのサイトのヘッダー・サイドバーから開ける「プロフィール切替」メニューで、複数のセーブデータ（サブ垢など）を切り替えられます。プロフィールを切り替えると、所持アイテム・マイコーデ・お気に入り・精霊ツリーの解放状況などが、切り替え先のプロフィールのものに入れ替わります。データはすべてこのブラウザ内に保存されます。`, en: `The "Profile Switch" menu, available from the header or sidebar on most sites, lets you switch between multiple save data sets (e.g. sub-accounts). Switching profiles swaps in that profile's owned items, my outfits, favorites, spirit tree unlock progress, and more. All data is stored within this browser.` },
    },
    currency: {
      title: { ja: `所持通貨（6種統一管理）`, en: `Owned Currency (Unified Across 6 Types)` },
      body: { ja: `プロフィール切替メニュー内の「所持通貨」セクションで、キャンドル・ハート・昇華キャンドル・シーズンキャンドル・シーズンハート・イベント通貨をどのサイトからでも編集できます。編集した内容は全サイトで共通して反映されます。`, en: `In the "Owned Currency" section inside the Profile Switch menu, you can edit your candles, hearts, ascended candles, season candles, season hearts, and event currency from any site. Edits are reflected consistently across all sites.` },
    },
    backup: {
      title: { ja: `データのバックアップ・復元・削除`, en: `Data Backup, Restore & Deletion` },
      body: { ja: `プロフィール切替メニュー内の「データのバックアップ・復元・削除」から、このブラウザに保存されているデータ全体をファイルに書き出し・読み込み・削除できます。別の端末へ引き継ぎたい場合は<a href="#/data-transfer"><svg class="inline-icon" width="14" height="14"><use href="#i-sync"/></svg> データ引継ぎ</a>で、サイトを選んでコードの形で引き継ぐこともできます。`, en: `From "Data Backup, Restore & Deletion" inside the Profile Switch menu, you can export, import, or delete all of the data stored in this browser. To move your data to another device, you can also use <a href="#/data-transfer"><svg class="inline-icon" width="14" height="14"><use href="#i-sync"/></svg> Data Transfer</a> to choose which sites' data to carry over as a code.` },
    },
    lang: {
      title: { ja: `言語切替（EN/JA）`, en: `Language Toggle (EN/JA)` },
      body: { ja: `多くのサイトでは、ヘッダーの「EN」ボタンから日本語・英語の表示を切り替えられます。対応は順次拡大中で、一部のサイトはまだ非対応です。`, en: `Most sites let you switch the display between Japanese and English using the "EN" button in the header. Support is being rolled out across the tool family, so a few sites may not have it yet.` },
    },
    icon: {
      title: { ja: `ホーム画面アイコンのカスタマイズ`, en: `Customizing the Home Screen Icon` },
      body: { ja: `画面下の「表示設定」の「ホーム画面のアイコン」から、「ホーム画面に追加」時のアイコンを絵文字＋背景色、または好きな画像に変更できます。この端末・ブラウザごとの設定で、プロフィール（保存枠）の切替には影響されません。<b>「ホーム画面に追加」をする前に設定してください</b>（追加した後に変更しても、既に追加済みのアイコンは自動更新されません）。`, en: `From "Home screen icon" in "Display Settings" (bottom menu), you can change the icon used for "Add to Home Screen" — either an emoji plus background color, or an image of your choice. This is a per-device, per-browser setting and is not affected by switching profiles (save slots). <b>Please set this up before adding to your home screen</b> (changing it afterward won't update an icon you've already added).` },
    },
  },

  credits: {
    label: { ja: `クレジット`, en: `Credits` },
    made: {
      title: { ja: `制作`, en: `Created By` },
      body: { ja: `<a href="https://x.com/Skyzztai" target="_blank" rel="noopener noreferrer">@Skyzztai</a>　／ <a href="https://odaibako.net/u/Skyzztai" target="_blank" rel="noopener noreferrer">リクエストフォーム</a>`, en: `<a href="https://x.com/Skyzztai" target="_blank" rel="noopener noreferrer">@Skyzztai</a>　／ <a href="https://odaibako.net/u/Skyzztai" target="_blank" rel="noopener noreferrer">Request form</a>` },
    },
    dataSource: {
      title: { ja: `データ・画像の参照元`, en: `Data & Image Sources` },
      list: {
        ja: `<li><a href="https://sky-children-of-the-light.fandom.com/wiki/Sky:_Children_of_the_Light_Wiki" target="_blank" rel="noopener noreferrer">Sky: Children of the Light Wiki</a>（Fandom、日本語版・英語版）— アイテム・精霊・イベント等のデータ、画像</li>
          <li><a href="https://9-bit.jp/skygold/" target="_blank" rel="noopener noreferrer">9bit</a>、<a href="https://game8.jp/sky" target="_blank" rel="noopener noreferrer">ゲームエイト</a>、<a href="https://wikiwiki.jp/sky-jp/" target="_blank" rel="noopener noreferrer">wikiwiki.jp</a>（Sky 星を紡ぐ子どもたち Wiki*）— 日本語データの補助的な確認元</li>`,
        en: `<li><a href="https://sky-children-of-the-light.fandom.com/wiki/Sky:_Children_of_the_Light_Wiki" target="_blank" rel="noopener noreferrer">Sky: Children of the Light Wiki</a> (Fandom, Japanese &amp; English editions) — data and images for items, spirits, events, etc.</li>
          <li><a href="https://9-bit.jp/skygold/" target="_blank" rel="noopener noreferrer">9bit</a>, <a href="https://game8.jp/sky" target="_blank" rel="noopener noreferrer">Game8</a>, <a href="https://wikiwiki.jp/sky-jp/" target="_blank" rel="noopener noreferrer">wikiwiki.jp</a> (Sky: Children of the Light Wiki*) — supplementary sources for verifying Japanese-language data</li>`,
      },
      note: { ja: `詳しい引用元の一覧は「参考文献・画像引用元」タブをご覧ください。`, en: `See the "References &amp; Image Credits" tab for the full list of sources.` },
    },
    libs: {
      title: { ja: `使用ライブラリ`, en: `Libraries Used` },
      list: {
        ja: `<li>Vue 3 — 精霊同行ツール・創作物管理ツールで使用</li>
          <li>html2canvas — 達成率・コーデの画像保存/シェア機能で使用</li>
          <li>Google Fonts（Noto Sans JP）</li>`,
        en: `<li>Vue 3 — used in Spirit Companion Tool and Creation Manager</li>
          <li>html2canvas — used for the completion-rate and outfit image save/share features</li>
          <li>Google Fonts (Noto Sans JP)</li>`,
      },
    },
    disclaimer: {
      title: { ja: `免責事項`, en: `Disclaimer` },
      body: { ja: `これらのサイトはすべて「Sky 星を紡ぐ子どもたち」の非公式ファンサイトです。thatgamecompanyは制作・運営に一切関与していません。`, en: `All of these sites are unofficial fan sites for Sky: Children of the Light. thatgamecompany is not involved in their creation or operation in any way.` },
    },
    policy: {
      title: { ja: `制作方針について`, en: `Our Approach to Fan Content` },
      intro: { ja: `このサイト群は、thatgamecompanyが公開しているファンコンテンツ向けのガイドライン（<a href="https://thatgamecompany.helpshift.com/hc/ja/17-sky-children-of-the-light/faq/697-can-i-create-a-supplemental-app-or-service-for-sky/" target="_blank" rel="noopener noreferrer">補助アプリ・サービスについて</a>／<a href="https://thatgamecompany.helpshift.com/hc/ja/17-sky-children-of-the-light/faq/655-can-i-share-my-fan-art-and-other-sky-inspired-works/" target="_blank" rel="noopener noreferrer">ファンアートについて</a>）を確認したうえで、以下の方針で制作・運営しています。`, en: `Having reviewed thatgamecompany's published guidelines for fan content (<a href="https://thatgamecompany.helpshift.com/hc/ja/17-sky-children-of-the-light/faq/697-can-i-create-a-supplemental-app-or-service-for-sky/" target="_blank" rel="noopener noreferrer">on supplemental apps/services</a> / <a href="https://thatgamecompany.helpshift.com/hc/ja/17-sky-children-of-the-light/faq/655-can-i-share-my-fan-art-and-other-sky-inspired-works/" target="_blank" rel="noopener noreferrer">on fan art</a>), this family of sites is built and operated under the following principles.` },
      list: {
        ja: `<li>すべて無料・非営利で提供しており、対価は一切受け取っていません</li>
          <li>アイコン等の画像は、ゲームのアプリファイルから直接抽出したもの（いわゆる extracted assets）をサイト内に保存せず、Sky Wiki（Fandom）から都度直接読み込む形式のみを使用しています</li>
          <li>ゲーム内の既存機能を代替・妨害するものではなく、記録・計算を補助するツールとして提供しています</li>
          <li>「Sky」やthatgamecompanyのロゴ・商標を、自サイトの独自ブランディングとして使用していません</li>
          <li>サイト内のすべての場所（各サイトのフッター等）に、非公式ファンサイトである旨を明記しています</li>`,
        en: `<li>Everything is provided free of charge and non-commercially — we do not accept any form of compensation</li>
          <li>We never store icons or other images extracted directly from the game's app files ("extracted assets") on our sites; images are always loaded live from the Sky Wiki (Fandom) instead</li>
          <li>These tools do not replace or interfere with any in-game feature — they only assist with record-keeping and calculations</li>
          <li>We do not use the "Sky" name or thatgamecompany's logos/trademarks as our own site branding</li>
          <li>Every site clearly states, in every location (e.g. each site's footer), that it is an unofficial fan site</li>`,
      },
      footnote: { ja: `※上記は公開されているガイドラインを踏まえた自主的な運営方針であり、thatgamecompanyから個別の許諾・お墨付きを得たものではありません。内容は今後変更される可能性があります。`, en: `*The above is a voluntary operating policy based on publicly available guidelines, and does not represent individual permission or endorsement from thatgamecompany. This content may change in the future.` },
    },
  },

  privacy: {
    label: { ja: `プライバシーポリシー`, en: `Privacy Policy` },
    summary: {
      title: { ja: `ひとことで言うと`, en: `In Short` },
      body: { ja: `あなたが入力したデータ（所持アイテムのチェック、コーデ、通貨の記録など）は、今お使いのスマホ・パソコンの中だけに保存されます。インターネットのどこか（サーバーなど）に送られることはなく、運営者を含めて<b>誰にも見られません</b>。会員登録も不要です。`, en: `The data you enter (item ownership checks, outfits, currency records, etc.) is stored only on the phone or computer you're currently using. It is never sent anywhere on the internet (such as to a server), and <b>no one — including us, the operators — can see it</b>. No account registration is required.` },
    },
    storage: {
      title: { ja: `データはどこに保存されているの？`, en: `Where is my data stored?` },
      p1: { ja: `スマホやパソコンの「ブラウザ」（Safari・Chromeなどのアプリ）には、それぞれのブラウザだけが使える専用の保存スペースがあります（専門用語では「ローカルストレージ」と呼びます）。所持アイテムのチェックやコーデ、通貨の記録は、すべてこの中に書き込まれます。`, en: `Your phone or computer's browser (apps like Safari or Chrome) has a dedicated storage space that only that browser can use — technically called "local storage." Your item ownership checks, outfits, and currency records are all written into this space.` },
      p2: { ja: `つまり、あなたのデータは<b>あなたの手元の端末だけ</b>にあり、私たち運営者を含め、誰かがそれを見たり集めたりすることはできません。`, en: `In other words, your data exists <b>only on the device in your hands</b>, and no one — including us, the operators — can view or collect it.` },
      p3: { ja: `※ただし、同じ端末でも「別のブラウザ」（SafariとChromeなど）や「別のスマホ・パソコン」に切り替えると、データは引き継がれません。機種変更などでデータを移したいときは、下の「データ引継ぎ機能について」をご覧ください。`, en: `*Note that switching to a different browser on the same device (e.g. Safari vs. Chrome) or to a different phone/computer will not carry your data over. If you want to move your data when getting a new device, see "About the Data Transfer feature" below.` },
    },
    account: {
      title: { ja: `会員登録・ログインは必要？`, en: `Do I need to sign up or log in?` },
      body: { ja: `不要です。名前やメールアドレスの入力、パスワードの設定なども一切ありません。「プロフィール」という機能がありますが、これは同じブラウザの中で複数のセーブデータ（例: サブ垢用）を切り替えるためのものだけで、外部のアカウントとは関係ありません。`, en: `No. There's no need to enter a name or email address, set a password, or anything like that. There is a "Profile" feature, but it's only for switching between multiple save data sets within the same browser (e.g. for a sub-account) — it has nothing to do with any external account.` },
    },
    analytics: {
      title: { ja: `行動を記録・分析する仕組みは使っている？`, en: `Do you use any tracking or analytics?` },
      body: { ja: `使っていません。「どのページが何回見られたか」のような、訪問者の行動を計測する仕組み（アクセス解析・Cookieなど）は入れていません。`, en: `No. We don't include any mechanism (such as web analytics or cookies) that measures visitor behavior, like how many times a page was viewed.` },
    },
    network: {
      title: { ja: `インターネットへの通信は発生する？`, en: `Does the site communicate over the internet?` },
      intro: { ja: `基本的にはありませんが、以下の2つの場面でだけ、外部への通信が発生します。どちらも「画像やアイテム名を表示するために取ってくる」だけの通信で、あなたの個人情報が送られることはありません。`, en: `Generally, no — but there are two situations where communication with an external source occurs. In both cases, it's purely fetching images or item names to display; none of your personal information is ever sent out.` },
      list: {
        ja: `<li>アイテムや精霊の画像を表示するとき、Sky Wiki（外部サイト）から画像を読み込みます</li>
          <li>「アイテム検索」「コーデの共有リンク」などの機能で、同じ作者が作った他のツールのページから、アイテム名や画像を取ってきます</li>`,
        en: `<li>When displaying images of items or spirits, images are loaded from the Sky Wiki (an external site)</li>
          <li>Features like "Item Search" and "Outfit Share Links" fetch item names and images from other tools' pages made by the same developer</li>`,
      },
    },
    transfer: {
      title: { ja: `データ引継ぎ機能について`, en: `About the Data Transfer feature` },
      p1: { ja: `機種変更などで、データを別のスマホ・パソコンに移したいときのための機能です。仕組みはシンプルで、あなたのデータを一旦「コード」という文字の羅列に変換し、それを①あなた自身がコピー&amp;ペーストで別の端末に貼り付けるか、②ファイルとしてダウンロードして別の端末で読み込むか、いずれかの方法で移します。`, en: `This feature is for when you want to move your data to a different phone or computer, such as when getting a new device. The process is simple: your data is converted into a string of characters called a "code," which you then move to the other device either by ① copying and pasting it yourself, or ② downloading it as a file and loading that file on the other device.` },
      p2: { ja: `このコード・ファイルが自動でどこかに送られることはありません。あなたがコピー&amp;ペースト、またはファイルのダウンロード/読み込みという操作をしない限り、データが動くことは一切ありません。`, en: `This code — whether copied or saved as a file — is never automatically sent anywhere. Unless you yourself perform the copy-and-paste, or the file download/load, your data never moves at all.` },
    },
    contact: {
      title: { ja: `お問い合わせ`, en: `Contact` },
      body: { ja: `データの扱いについて不安な点や質問があれば、<a href="https://x.com/Skyzztai" target="_blank" rel="noopener noreferrer">@Skyzztai</a>（X）までお気軽にご連絡ください。`, en: `If you have any concerns or questions about how your data is handled, feel free to reach out via <a href="https://x.com/Skyzztai" target="_blank" rel="noopener noreferrer">@Skyzztai</a> (X).` },
    },
  },

  references: {
    label: { ja: `参考文献・画像引用元`, en: `References & Image Credits` },
    sub: { ja: `このサイト群を作る際に参考にした文献・引用元の一覧です。以前は別のページに載せていましたが、このページに統合しました。`, en: `A list of references and sources consulted while building this family of sites. This used to be listed elsewhere, but has been consolidated onto this page.` },
    quickJumpAriaLabel: { ja: `参考文献グループへジャンプ`, en: `Jump to a reference group` },
    toolGuide: {
      title: { ja: `目的別ツール早見表`, en: `Which Tool Should I Use?` },
      sub: { ja: `やりたいことから、使うツールを探せます。`, en: `Find the right tool based on what you want to do.` },
    },
    compatTable: {
      title: { ja: `サイト別機能対応表`, en: `Feature Compatibility Table` },
      sub: { ja: `公開中の姉妹サイト間での、共通機能の対応状況です。`, en: `Shows how shared features compare across the published sister sites.` },
      colTool: { ja: `ツール`, en: `Tool` },
      colDark: { ja: `ダーク`, en: `Dark` },
      colProfile: { ja: `複数プロフィール`, en: `Multi-Profile` },
      colLang: { ja: `言語数`, en: `Languages` },
      colTest: { ja: `注記`, en: `Note` },
      footnote: { ja: `※「複数プロフィール」欄が「—」の3サイト（設定・クレジット／楽譜づくり／作者プロフィール）は、所持アイテムなどのセーブデータそのものを扱わないため、姉妹サイト共通のプロフィール切替システムの対象外です。「言語数」は日本語・英語の2言語が基本で、精霊同行ツールのみ日本語・英語・繁體中文・한국어の4言語に対応しています。`, en: `*The three sites showing "—" under "Multi-Profile" (Settings &amp; Credits, Sheet Music Maker, Creator Profile) don't manage any owned-item save data of their own, so they fall outside the shared profile-switching system. "Languages" is 2 (Japanese/English) by default; only Spirit Companion Tool supports 4 (Japanese, English, Traditional Chinese, Korean).` },
    },
  },
};

function resolve(dict, path) {
  return path.split('.').reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), dict);
}

export function t(key, vars) {
  const entry = resolve(INFO_I18N, key);
  let str = entry ? ((CURRENT_LANG === 'en' ? entry.en : entry.ja) || entry.ja || key) : key;
  if (vars) {
    Object.keys(vars).forEach(k => { str = str.split('{' + k + '}').join(vars[k]); });
  }
  return str;
}

/* ================================================================
   item-footer.js — アイテム所持管理の各ページ共通フッター
   （非公式ファンサイトの免責・作成/ご意見・参考/画像引用元（ページごとのSky Wikiリンク）・
   設定/クレジットへのリンク）。

   item/index.html・各カテゴリHTML・item_cost.html・music_sheet.html のフッターを移植したもの。
   参考・画像引用元のリンクは元のページごとの内容のまま（本ファイルの REFS は元のHTMLから抽出）。
   ハブでは設定/クレジットは同じSPA内のページ（#/tai-info）。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';

const REFS = {
  "dashboard": {
    "jaLabel": "参考・画像引用元:",
    "enLabel": "References / image sources:",
    "links": [
      {
        "href": "https://sky-children-of-the-light.fandom.com/ja/wiki/%E3%83%89%E3%83%AC%E3%82%B9%E3%82%A2%E3%83%83%E3%83%97%E3%82%A2%E3%82%A4%E3%83%86%E3%83%A0",
        "ja": "ドレスアップアイテム (Sky Wiki 日本語)",
        "en": "Dress-Up Items (Sky Wiki Japanese)"
      },
      {
        "href": "https://sky-children-of-the-light.fandom.com/wiki/Cosmetics",
        "ja": "Cosmetics (Sky Wiki 英語)",
        "en": "Cosmetics (Sky Wiki English)"
      }
    ]
  },
  "outfit": {
    "jaLabel": "参考・画像引用元:",
    "enLabel": "References / image sources:",
    "links": [
      {
        "href": "https://sky-children-of-the-light.fandom.com/ja/wiki/%E3%82%A2%E3%82%A6%E3%83%88%E3%83%95%E3%82%A3%E3%83%83%E3%83%88",
        "ja": "アウトフィット (Sky Wiki 日本語)",
        "en": "Outfits (Sky Wiki Japanese)"
      },
      {
        "href": "https://sky-children-of-the-light.fandom.com/wiki/Outfits",
        "ja": "Outfits (Sky Wiki 英語)",
        "en": "Outfits (Sky Wiki English)"
      }
    ]
  },
  "shoes": {
    "jaLabel": "参考・画像引用元:",
    "enLabel": "References / image sources:",
    "links": [
      {
        "href": "https://sky-children-of-the-light.fandom.com/ja/wiki/%E3%82%B7%E3%83%A5%E3%83%BC%E3%82%BA",
        "ja": "シューズ (Sky Wiki 日本語)",
        "en": "Shoes (Sky Wiki Japanese)"
      },
      {
        "href": "https://sky-children-of-the-light.fandom.com/wiki/Shoes",
        "ja": "Shoes (Sky Wiki 英語)",
        "en": "Shoes (Sky Wiki English)"
      }
    ]
  },
  "mask": {
    "jaLabel": "参考・画像引用元:",
    "enLabel": "References / image sources:",
    "links": [
      {
        "href": "https://sky-children-of-the-light.fandom.com/ja/wiki/%E3%83%9E%E3%82%B9%E3%82%AF",
        "ja": "マスク (Sky Wiki 日本語)",
        "en": "Masks (Sky Wiki Japanese)"
      },
      {
        "href": "https://sky-children-of-the-light.fandom.com/wiki/Masks",
        "ja": "Masks (Sky Wiki 英語)",
        "en": "Masks (Sky Wiki English)"
      }
    ]
  },
  "face_accessory": {
    "jaLabel": "参考・画像引用元:",
    "enLabel": "References / image sources:",
    "links": [
      {
        "href": "https://sky-children-of-the-light.fandom.com/ja/wiki/%E3%83%95%E3%82%A7%E3%82%A4%E3%82%B9%E3%82%A2%E3%82%AF%E3%82%BB%E3%82%B5%E3%83%AA%E3%83%BC",
        "ja": "フェイスアクセサリー(Sky Wiki 日本語)",
        "en": "Face Accessories (Sky Wiki Japanese)"
      },
      {
        "href": "https://sky-children-of-the-light.fandom.com/wiki/Face_Accessories",
        "ja": "Face Accessories (Sky Wiki 英語)",
        "en": "Face Accessories (Sky Wiki English)"
      }
    ]
  },
  "necklace": {
    "jaLabel": "参考・画像引用元:",
    "enLabel": "References / image sources:",
    "links": [
      {
        "href": "https://sky-children-of-the-light.fandom.com/ja/wiki/%E3%83%8D%E3%83%83%E3%82%AF%E3%83%AC%E3%82%B9",
        "ja": "ネックレス(Sky Wiki 日本語)",
        "en": "Necklaces (Sky Wiki Japanese)"
      },
      {
        "href": "https://sky-children-of-the-light.fandom.com/wiki/Necklaces",
        "ja": "Necklaces (Sky Wiki 英語)",
        "en": "Necklaces (Sky Wiki English)"
      }
    ]
  },
  "hairstyle": {
    "jaLabel": "参考・画像引用元:",
    "enLabel": "References / image sources:",
    "links": [
      {
        "href": "https://sky-children-of-the-light.fandom.com/ja/wiki/%E3%83%98%E3%82%A2%E3%82%B9%E3%82%BF%E3%82%A4%E3%83%AB",
        "ja": "ヘアスタイル (Sky Wiki 日本語)",
        "en": "Hair (Sky Wiki Japanese)"
      },
      {
        "href": "https://sky-children-of-the-light.fandom.com/wiki/Hair",
        "ja": "Hair (Sky Wiki 英語)",
        "en": "Hair (Sky Wiki English)"
      }
    ]
  },
  "hair_accessory": {
    "jaLabel": "参考・画像引用元:",
    "enLabel": "References / image sources:",
    "links": [
      {
        "href": "https://sky-children-of-the-light.fandom.com/ja/wiki/%E3%83%98%E3%82%A2%E3%82%A2%E3%82%AF%E3%82%BB%E3%82%B5%E3%83%AA%E3%83%BC",
        "ja": "ヘアアクセサリー (Sky Wiki 日本語)",
        "en": "Hair Accessories (Sky Wiki Japanese)"
      },
      {
        "href": "https://sky-children-of-the-light.fandom.com/wiki/Hair_Accessories",
        "ja": "Hair Accessories (Sky Wiki 英語)",
        "en": "Hair Accessories (Sky Wiki English)"
      }
    ]
  },
  "head_accessory": {
    "jaLabel": "参考・画像引用元:",
    "enLabel": "References / image sources:",
    "links": [
      {
        "href": "https://sky-children-of-the-light.fandom.com/ja/wiki/%E3%83%98%E3%83%83%E3%83%89%E3%82%A2%E3%82%AF%E3%82%BB%E3%82%B5%E3%83%AA%E3%83%BC",
        "ja": "ヘッドアクセサリー (Sky Wiki 日本語)",
        "en": "Head Accessories (Sky Wiki Japanese)"
      },
      {
        "href": "https://sky-children-of-the-light.fandom.com/wiki/Head_Accessories",
        "ja": "Head Accessories (Sky Wiki 英語)",
        "en": "Head Accessories (Sky Wiki English)"
      }
    ]
  },
  "cape": {
    "jaLabel": "参考・画像引用元:",
    "enLabel": "References / image sources:",
    "links": [
      {
        "href": "https://sky-children-of-the-light.fandom.com/ja/wiki/%E3%82%B1%E3%83%BC%E3%83%97",
        "ja": "ケープ (Sky Wiki 日本語)",
        "en": "Capes (Sky Wiki Japanese)"
      },
      {
        "href": "https://sky-children-of-the-light.fandom.com/wiki/Capes",
        "ja": "Capes (Sky Wiki 英語)",
        "en": "Capes (Sky Wiki English)"
      }
    ]
  },
  "portable_item": {
    "jaLabel": "参考・画像引用元:",
    "enLabel": "References / image sources:",
    "links": [
      {
        "href": "https://sky-children-of-the-light.fandom.com/ja/wiki/%E6%8C%81%E3%81%A1%E7%89%A9%E3%82%A2%E3%82%A4%E3%83%86%E3%83%A0/%E6%8C%81%E3%81%A1%E9%81%8B%E3%81%B9%E3%82%8B%E3%82%A2%E3%82%A4%E3%83%86%E3%83%A0",
        "ja": "持ち物アイテム (Sky Wiki 日本語)",
        "en": "Props (Sky Wiki Japanese)"
      },
      {
        "href": "https://sky-children-of-the-light.fandom.com/wiki/Held_Props",
        "ja": "Held Props (Sky Wiki 英語)",
        "en": "Held Props (Sky Wiki English)"
      }
    ]
  },
  "large_placeable": {
    "jaLabel": "参考・画像引用元:",
    "enLabel": "References / image sources:",
    "links": [
      {
        "href": "https://sky-children-of-the-light.fandom.com/ja/wiki/%E6%8C%81%E3%81%A1%E7%89%A9%E3%82%A2%E3%82%A4%E3%83%86%E3%83%A0/%E5%A4%A7%E3%81%8D%E3%81%AA%E8%A8%AD%E7%BD%AE%E5%8F%AF%E8%83%BD%E3%82%A2%E3%82%A4%E3%83%86%E3%83%A0",
        "ja": "大きな設置可能アイテム (Sky Wiki 日本語)",
        "en": "Large Placeable Items (Sky Wiki Japanese)"
      },
      {
        "href": "https://sky-children-of-the-light.fandom.com/wiki/Large_Props",
        "ja": "Large Props (Sky Wiki 英語)",
        "en": "Large Props (Sky Wiki English)"
      }
    ]
  },
  "small_placeable": {
    "jaLabel": "参考・画像引用元:",
    "enLabel": "References / image sources:",
    "links": [
      {
        "href": "https://sky-children-of-the-light.fandom.com/ja/wiki/%E6%8C%81%E3%81%A1%E7%89%A9%E3%82%A2%E3%82%A4%E3%83%86%E3%83%A0/%E5%B0%8F%E3%81%95%E3%81%AA%E8%A8%AD%E7%BD%AE%E5%8F%AF%E8%83%BD%E3%82%A2%E3%82%A4%E3%83%86%E3%83%A0",
        "ja": "小さな設置可能アイテム (Sky Wiki 日本語)",
        "en": "Small Placeable Items (Sky Wiki Japanese)"
      },
      {
        "href": "https://sky-children-of-the-light.fandom.com/wiki/Small_Props",
        "ja": "Small Props (Sky Wiki 英語)",
        "en": "Small Props (Sky Wiki English)"
      }
    ]
  },
  "cost": {
    "jaLabel": "参考・画像引用元:",
    "enLabel": "References / image sources:",
    "links": [
      {
        "href": "https://sky-children-of-the-light.fandom.com/ja/wiki/%E3%83%89%E3%83%AC%E3%82%B9%E3%82%A2%E3%83%83%E3%83%97%E3%82%A2%E3%82%A4%E3%83%86%E3%83%A0",
        "ja": "ドレスアップアイテム (Sky Wiki 日本語)",
        "en": "Dress-up Items (Sky Wiki Japanese)"
      },
      {
        "href": "https://sky-children-of-the-light.fandom.com/wiki/Cosmetics",
        "ja": "Cosmetics (Sky Wiki 英語)",
        "en": "Cosmetics (Sky Wiki English)"
      }
    ]
  },
  "music_sheet": {
    "jaLabel": "参考:",
    "enLabel": "References:",
    "links": [
      {
        "href": "https://sky-children-of-the-light.fandom.com/ja/wiki/%E6%A5%BD%E8%AD%9C",
        "ja": "楽譜 (Sky Wiki 日本語)",
        "en": "Music Sheets (Sky Wiki English)",
        "enHref": "https://sky-children-of-the-light.fandom.com/wiki/Music_Sheets"
      }
    ]
  },
  "all": {
    "jaLabel": "参考・画像引用元:",
    "enLabel": "References / image sources:",
    "links": [
      {
        "href": "https://sky-children-of-the-light.fandom.com/ja/wiki/%E3%83%89%E3%83%AC%E3%82%B9%E3%82%A2%E3%83%83%E3%83%97%E3%82%A2%E3%82%A4%E3%83%86%E3%83%A0",
        "ja": "ドレスアップアイテム (Sky Wiki 日本語)",
        "en": "Dress-Up Items (Sky Wiki Japanese)"
      },
      {
        "href": "https://sky-children-of-the-light.fandom.com/wiki/Cosmetics",
        "ja": "Cosmetics (Sky Wiki 英語)",
        "en": "Cosmetics (Sky Wiki English)"
      }
    ]
  }
};

function tt(ja, en) { return CURRENT_LANG === 'en' ? en : ja; }

/** key: 'dashboard' | 'all' | 'cost' | 'music_sheet' | <カテゴリkey>。未知のkeyは参考リンク無しで返す */
export function itemFooterHtml(key) {
  const ref = REFS[key];
  const en = CURRENT_LANG === 'en';
  const A = 'target="_blank" rel="noopener noreferrer"';
  const refBlock = ref ? `
    <span class="item-footer-sub">
      ${escapeHtml(en ? ref.enLabel : ref.jaLabel)}
      ${ref.links.map(l => `<a href="${en && l.enHref ? l.enHref : l.href}" ${A}>${escapeHtml(en ? l.en : l.ja)}</a>`).join('\n      ／\n      ')}
    </span><br>` : '';
  return `
  <footer class="item-footer">
    ${escapeHtml(tt('このサイトはSky 星を紡ぐ子どもたちの非公式ファンサイトです。thatgamecompanyは一切関与していません。',
      'This is an unofficial fan site for Sky: Children of the Light. thatgamecompany is not involved in any way.'))}<br>
    ${escapeHtml(tt('作成・ご意見:', 'Created by / feedback:'))} <a class="item-footer-strong" href="https://x.com/Skyzztai" ${A}>@Skyzztai</a>　／　<a class="item-footer-strong" href="https://odaibako.net/u/Skyzztai" ${A}>${escapeHtml(tt('リクエストフォーム', 'Request form'))}</a><br>${refBlock}
    <span class="item-footer-sub"><a href="#/tai-info">${escapeHtml(tt('設定・クレジット・プライバシーポリシー', 'Settings / Credits / Privacy Policy'))}</a></span>
  </footer>`;
}

// 描画済みのビュー（.item-view）の末尾にフッターを足す（二重に付けない）
export function appendItemFooter(rootEl, key) {
  if (!rootEl) return;
  const view = rootEl.querySelector('.item-view') || rootEl;
  if (view.querySelector(':scope > .item-footer')) return;
  view.insertAdjacentHTML('beforeend', itemFooterHtml(key));
}

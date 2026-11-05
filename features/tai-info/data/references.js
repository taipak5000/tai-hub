/* ================================================================
   tai-info（設定・クレジット）の参考文献・画像引用元データ。

   移植元: tai-info/index.html の `const referenceSources = [...]`
   （行2200-2258）。id はディープリンク用の安定したスラッグ
   （#/tai-info/references:<id> でそのグループへスクロール+ハイライト）。
   group/note は groupEn/noteEn を用意し、未訳の場合はJAへフォールバック。
   title は実際のページ名（固有名詞）のためグループ内で統一言語表記のまま。
   ================================================================ */
export const REFERENCE_SOURCES = [
  {
    // 🔗 idはディープリンク用の安定したスラッグ（#references:idの形式でこのグループへ
    // 直接ジャンプできる。実際のDOM要素idは "references-" + id。renderReferences参照）。
    id: 'item',
    group: 'アイテム所持管理',
    groupEn: 'Item Tracker',
    items: [
      { title: 'Outfits | Sky Wiki', url: 'https://sky-children-of-the-light.fandom.com/wiki/Outfits', note: 'アウトフィット一覧・入手元データ', noteEn: `Outfit list and acquisition-source data` },
      { title: 'Shoes | Sky Wiki', url: 'https://sky-children-of-the-light.fandom.com/wiki/Shoes', note: 'シューズ一覧・入手元データ、コスト表', noteEn: `Shoe list, acquisition-source data, and cost table` },
      { title: 'Masks | Sky Wiki', url: 'https://sky-children-of-the-light.fandom.com/wiki/Masks', note: 'マスク一覧・入手元データ', noteEn: `Mask list and acquisition-source data` },
      { title: 'Face Accessories | Sky Wiki', url: 'https://sky-children-of-the-light.fandom.com/wiki/Face_Accessories', note: 'フェイスアクセサリー一覧・入手元データ', noteEn: `Face accessory list and acquisition-source data` },
      { title: 'Necklaces | Sky Wiki', url: 'https://sky-children-of-the-light.fandom.com/wiki/Necklaces', note: 'ネックレス一覧・入手元データ', noteEn: `Necklace list and acquisition-source data` },
      { title: 'Hair | Sky Wiki', url: 'https://sky-children-of-the-light.fandom.com/wiki/Hair', note: 'ヘアスタイル一覧・入手元データ', noteEn: `Hair style list and acquisition-source data` },
      { title: 'Hair Accessories | Sky Wiki', url: 'https://sky-children-of-the-light.fandom.com/wiki/Hair_Accessories', note: 'ヘアアクセサリー一覧・入手元データ', noteEn: `Hair accessory list and acquisition-source data` },
      { title: 'Head Accessories | Sky Wiki', url: 'https://sky-children-of-the-light.fandom.com/wiki/Head_Accessories', note: 'ヘッドアクセサリー一覧・入手元データ', noteEn: `Head accessory list and acquisition-source data` },
      { title: 'Capes | Sky Wiki', url: 'https://sky-children-of-the-light.fandom.com/wiki/Capes', note: 'ケープ一覧・入手元データ', noteEn: `Cape list and acquisition-source data` },
      { title: 'Held Props | Sky Wiki', url: 'https://sky-children-of-the-light.fandom.com/wiki/Held_Props', note: '持ち運べるアイテム一覧・入手元データ', noteEn: `Held prop list and acquisition-source data` },
      { title: 'Large Props | Sky Wiki', url: 'https://sky-children-of-the-light.fandom.com/wiki/Large_Props', note: '大きな設置可能アイテム一覧・入手元データ', noteEn: `Large placeable prop list and acquisition-source data` },
      { title: 'Small Props | Sky Wiki', url: 'https://sky-children-of-the-light.fandom.com/wiki/Small_Props', note: '小さな設置可能アイテム一覧・入手元データ', noteEn: `Small placeable prop list and acquisition-source data` },
      { title: 'Cosmetics | Sky Wiki', url: 'https://sky-children-of-the-light.fandom.com/wiki/Cosmetics', note: 'ドレスアップアイテム一覧・入手元データ', noteEn: `Cosmetic item list and acquisition-source data` },
    ]
  },
  {
    id: 'wings',
    group: '羽トラッカー',
    groupEn: 'Wing Tracker',
    items: [
      { title: 'Traveling Spirit | Sky Wiki', url: 'https://sky-children-of-the-light.fandom.com/wiki/Traveling_Spirit', note: '放浪精霊の初期羽枚数などのデータ', noteEn: `Data such as initial wing counts for Traveling Spirits` },
      { title: 'Regular Spirit | Sky Wiki', url: 'https://sky-children-of-the-light.fandom.com/wiki/Regular_Spirit', note: '通常精霊のデータ', noteEn: `Regular spirit data` },
      { title: 'Children of Light | Sky Wiki', url: 'https://sky-children-of-the-light.fandom.com/wiki/Children_of_Light', note: '光の子供たちの再訪データ、および掲載画像（Fandom画像CDNから直接参照）', noteEn: `Revisit data for Children of Light spirits, and images used (referenced directly from the Fandom image CDN)` },
    ]
  },
  {
    id: 'companion',
    group: '精霊同行ツール',
    groupEn: 'Spirit Companion Tool',
    items: [
      { title: 'Season of Pearl | Sky Wiki', url: 'https://sky-children-of-the-light.fandom.com/wiki/Season_of_Pearl', note: '現行シーズンのツリー・コストデータ', noteEn: `Tree and cost data for the current season` },
      { title: '季節精霊（精霊友情システム） | Sky Wiki 日本語版', url: 'https://sky-children-of-the-light.fandom.com/ja/wiki/%E5%AD%A3%E7%AF%80%E7%B2%BE%E9%9C%8A#%E7%B2%BE%E9%9C%8A%E5%8F%8B%E6%83%85%E3%82%B7%E3%82%B9%E3%83%86%E3%83%A0', note: '精霊友情システムの仕様確認', noteEn: `Confirming the specifications of the Spirit Friendship system` },
    ]
  },
  {
    id: 'starCandle',
    group: '星のキャンドル計算機',
    groupEn: 'Star Candle Calculator',
    items: [
      { title: '破片の噴出 | Sky Wiki 日本語版', url: 'https://sky-children-of-the-light.fandom.com/ja/wiki/%E7%A0%B4%E7%89%87%E3%81%AE%E5%99%B4%E5%87%BA', note: '赤闇（星のキャンドル）出現予測のデータ', noteEn: `Data for predicting Red Shard (Star Candle) eruptions` },
    ]
  },
  {
    id: 'emote',
    group: 'エモート所持率管理',
    groupEn: 'Emote Tracker',
    items: [
      { title: 'Expressions | Sky Wiki', url: 'https://sky-children-of-the-light.fandom.com/wiki/Expressions', note: 'エモート一覧・入手元データ', noteEn: `Emote list and acquisition-source data` },
    ]
  },
];

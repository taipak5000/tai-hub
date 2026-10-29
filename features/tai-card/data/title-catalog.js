/* ================================================================
   TITLE_CATALOG — 他ツールで獲得済みの称号（実績）を、読み取り専用で
   参照するためのカタログ。移植元: tai-card/index.html の
   `const TITLE_CATALOG = {...}`（~行1391-1473）を、値・構造とも
   完全に複製したもの。

   各ツールは別デプロイ（別オリジンではないが別リポジトリ/別
   index.html）のため、tai-card側から称号の「定義」（アイコン・名前・
   説明）そのものを動的に取得することはできない。よってこの定義自体を
   ミラーとして持っておき、各ツールが実際にlocalStorageへ書き込んだ
   「獲得済みidの配列」（storageKeyから読み、extract()で正規化）と
   突き合わせて表示する。

   注意: これは他ツールが「所有」するキーを読むだけの読み取り専用
   カタログなので、storageKeyそのものにはnsKey()を適用しない
   （namespaced:true の場合のみ、呼び出し側がnsKeyFor(storageKey, profileId)
   を使う——tai-card自身が所有するキーではないため）。

   ── REQUIRED FIX（今回のポート作業で反映） ──────────────────────
   tai-score（楽譜づくり）は今回の移植バッチで、称号ストレージ
   (taiScoreTitles_v1) を含む自身の保存キー全体がnsKey()による
   プロフィール名前空間化に切り替わった（元のtai-card/index.htmlでは
   `score: { ..., namespaced:false, ... }` という「グローバル直下・
   プロフィール非依存」の扱いだったが、これは移植前のtai-scoreの
   仕様に基づく記述であり、移植後のtai-scoreの実際の保存先とは
   もう一致しない）。そのため、この移植版カタログでは score エントリの
   namespaced を true に変更している。他の6ツール（emote/wings/spirit/
   share/nomacan/starcandle）は元々 namespaced:true のままで変更なし。
   ================================================================ */

export const TITLE_CATALOG = {
  item: {
    storageKey: 'itemTitles_v1', namespaced: true, source: 'アイテム所持管理', sourceEn: 'Item Collection Tracker',
    extract: d => Object.keys((d && d.earned) || {}),
    titles: {
      rate25: { icon: '🕯️', name: '灯火の旅人', nameEn: 'Traveler of the Flame', desc: '全アイテムの所持率が25%に到達', descEn: 'Reached 25% overall ownership' },
      rate50: { icon: '🌙', name: '星屑の収集家', nameEn: 'Stardust Collector', desc: '全アイテムの所持率が50%に到達', descEn: 'Reached 50% overall ownership' },
      rate75: { icon: '✨', name: '煌めきの探究者', nameEn: 'Seeker of Radiance', desc: '全アイテムの所持率が75%に到達', descEn: 'Reached 75% overall ownership' },
      rate100: { icon: '👑', name: '光の守護者', nameEn: 'Guardian of the Light', desc: '登録した全アイテムを100%所持', descEn: 'Reached 100% overall ownership' },
      catmaster1: { icon: '🏅', name: 'コレクションの第一歩', nameEn: 'First Steps of a Collection', desc: 'いずれか1カテゴリを100%達成', descEn: 'Completed at least 1 category' },
      catmaster6: { icon: '🏆', name: '熟練コレクター', nameEn: 'Master Collector', desc: '6カテゴリ以上を100%達成', descEn: 'Completed 6 or more categories' },
      spend1k: { icon: '💴', name: '灯火の支援者', nameEn: 'Supporter of the Flame', desc: '実額の合計が¥1,000に到達', descEn: 'Real-money total reached ¥1,000' },
      spend5k: { icon: '🎁', name: '季節の後援者', nameEn: 'Patron of the Season', desc: '実額の合計が¥5,000に到達', descEn: 'Real-money total reached ¥5,000' },
      spend15k: { icon: '💎', name: '彩りの後援者', nameEn: 'Patron of Colors', desc: '実額の合計が¥15,000に到達', descEn: 'Real-money total reached ¥15,000' },
      spend30k: { icon: '🌌', name: '星空の大後援者', nameEn: 'Grand Patron of the Stars', desc: '実額の合計が¥30,000に到達', descEn: 'Real-money total reached ¥30,000' },
      spend50k: { icon: '🌟', name: '光の大後援者', nameEn: 'Grand Patron of Light', desc: '実額の合計が¥50,000に到達', descEn: 'Real-money total reached ¥50,000' },
    },
  },
  emote: {
    storageKey: 'emoteTitles_v1', namespaced: true, source: 'エモート所持率管理', sourceEn: 'Emote Collection Tracker',
    extract: d => Object.keys(d || {}),
    titles: {
      apprentice: { icon: '🔰', name: '一芸見習い', nameEn: 'Emote Apprentice', desc: '所持レベル数が全体の10%に到達', descEn: 'Owned levels reached 10% of the total' },
      performer: { icon: '🎭', name: '芸達者', nameEn: 'Skilled Performer', desc: '所持レベル数が全体の50%に到達', descEn: 'Owned levels reached 50% of the total' },
      grandmaster: { icon: '👑', name: 'エモート完全制覇', nameEn: 'Emote Grandmaster', desc: '全エモートの全レベルを所持', descEn: 'Owns every level of every emote' },
      completionist: { icon: '🗺️', name: '全種踏破', nameEn: 'Full Collection', desc: '全エモートを最低1レベルずつ所持', descEn: 'Owns at least one level of every emote' },
      guideFan: { icon: '🧭', name: '案内人めぐり', nameEn: 'Guide Enthusiast', desc: '「案内人」エモートを全種最低1レベルずつ所持', descEn: 'Owns at least one level of every Guide emote' },
    },
  },
  wings: {
    storageKey: 'wingsTitles_v1', namespaced: true, source: '羽トラッカー', sourceEn: 'Wing Tracker',
    extract: d => Object.keys(d || {}),
    titles: {
      cape_lv5: { icon: '🪶', name: '羽ばたきの証', nameEn: 'Budding Wings', desc: 'ケープレベル5に到達（光の翼20枚）', descEn: 'Reached Cape Level 5 (20 Wings of Light)' },
      cape_lv10: { icon: '🧥', name: '旅するケープ使い', nameEn: 'Traveling Cloak-Bearer', desc: 'ケープレベル10に到達（光の翼120枚）', descEn: 'Reached Cape Level 10 (120 Wings of Light)' },
      cape_lv13: { icon: '👑', name: '光の翼、極めし者', nameEn: 'Master of the Winged Light', desc: 'ケープレベル最大の13に到達（光の翼250枚）', descEn: 'Reached the max Cape Level 13 (250 Wings of Light)' },
      lc_half: { icon: '🔦', name: '光を辿る探検家', nameEn: 'Light-Tracing Explorer', desc: '光の子を62体（半数）発見', descEn: 'Found 62 Children of Light (half)' },
      lc_all: { icon: '🌟', name: '光の子コンプリート', nameEn: 'Children of Light Completionist', desc: '光の子124体すべてを発見', descEn: 'Found all 124 Children of Light' },
    },
  },
  spirit: {
    storageKey: 'spiritCatalogTitles_v1', namespaced: true, source: '姉妹サイト', sourceEn: 'Sibling Site',
    extract: d => Object.keys(d || {}),
    titles: {
      pct1: { icon: '🌱', name: '芽吹きの精霊使い', nameEn: 'Budding Spirit Keeper', desc: '精霊ツリーのノードを1%以上解放した', descEn: 'Unlocked 1%+ of all spirit tree nodes' },
      pct10: { icon: '🕯️', name: '灯火の道しるべ', nameEn: 'Candlelit Trailblazer', desc: '精霊ツリーのノードを10%以上解放した', descEn: 'Unlocked 10%+ of all spirit tree nodes' },
      pct25: { icon: '🌿', name: '深緑の探求者', nameEn: 'Verdant Explorer', desc: '精霊ツリーのノードを25%以上解放した', descEn: 'Unlocked 25%+ of all spirit tree nodes' },
      pct50: { icon: '🌳', name: '満開の森の守り人', nameEn: 'Guardian of the Blooming Grove', desc: '精霊ツリーのノードを50%以上解放した', descEn: 'Unlocked 50%+ of all spirit tree nodes' },
      pct100: { icon: '👑', name: '精霊の森の賢者', nameEn: 'Sage of the Spirit Forest', desc: '精霊ツリーの全ノードをコンプリートした', descEn: 'Unlocked 100% of all spirit tree nodes' },
    },
  },
  // 🩹 REQUIRED FIX: tai-scoreは今回の移植バッチでnsKey()による名前空間化
  // に切り替わったため、元実装の namespaced:false ではなく true にする
  // （ファイル冒頭コメント参照）。
  score: {
    storageKey: 'taiScoreTitles_v1', namespaced: true, sharedFallback: true, source: '姉妹サイト', sourceEn: 'Sibling Site',
    extract: d => ((d && d.earned) || []).map(e => e.id),
    titles: {
      firstSong: { icon: '🎼', name: 'はじめの一歩', nameEn: 'First Step', desc: 'はじめての1曲をライブラリに加えた', descEn: 'Added your first song to the library' },
      apprentice: { icon: '🎶', name: '作曲家見習い', nameEn: 'Aspiring Composer', desc: '曲を5曲、ライブラリに加えた', descEn: 'Added 5 songs to the library' },
      craftsman: { icon: '🎹', name: '楽譜職人', nameEn: 'Sheet Music Craftsman', desc: '曲を20曲、ライブラリに加えた', descEn: 'Added 20 songs to the library' },
      legend: { icon: '🏅', name: '伝説の作曲家', nameEn: 'Legendary Composer', desc: '曲を50曲、ライブラリに加えた', descEn: 'Added 50 songs to the library' },
      passionate: { icon: '🔥', name: '情熱の演奏者', nameEn: 'Passionate Performer', desc: '1曲に100音を超える演奏を詰め込んだ', descEn: 'Packed over 100 notes into a single song' },
      virtuoso: { icon: '⚡', name: '超絶技巧', nameEn: 'Virtuoso', desc: '1曲に300音を超える演奏を詰め込んだ', descEn: 'Packed over 300 notes into a single song' },
    },
  },
  share: {
    storageKey: 'shareTitles_v1', namespaced: true, source: '創作物管理ツール', sourceEn: 'Creation Manager',
    extract: d => ((d && d.earned) || []).map(e => e.id),
    titles: {
      first: { icon: '🌱', name: 'はじめての一歩', nameEn: 'First Steps', desc: '創作物をはじめて追加した', descEn: 'Added your first creation' },
      apprentice: { icon: '🔨', name: '見習い設置職人', nameEn: 'Apprentice Builder', desc: '累計5個の創作物を追加した', descEn: '5 creations added (lifetime)' },
      skilled: { icon: '🏗️', name: '熟練の設置職人', nameEn: 'Skilled Builder', desc: '累計15個の創作物を追加した', descEn: '15 creations added (lifetime)' },
      master: { icon: '🏛️', name: '創作の匠', nameEn: 'Master Creator', desc: '累計30個の創作物を追加した', descEn: '30 creations added (lifetime)' },
      legend: { icon: '👑', name: '伝説の創作者', nameEn: 'Legendary Creator', desc: '累計50個の創作物を追加した', descEn: '50 creations added (lifetime)' },
    },
  },
  nomacan: {
    storageKey: 'skyNomacanTitles_v1', namespaced: true, source: 'ノマキャン計算機', sourceEn: 'Candle Calculator',
    extract: d => Object.keys((d && d.earned) || {}),
    titles: {
      streak3: { icon: '🔥', name: '灯し始め', nameEn: 'Spark of a Streak', desc: '3日連続で記録', descEn: 'Recorded 3 days in a row' },
      streak7: { icon: '🕯️', name: '一週間の灯火', nameEn: 'A Week of Flame', desc: '7日連続で記録', descEn: 'Recorded 7 days in a row' },
      streak30: { icon: '🌟', name: '絶やさぬ灯', nameEn: 'Unwavering Flame', desc: '30日連続で記録', descEn: 'Recorded 30 days in a row' },
      hold100: { icon: '🕯️', name: '灯の蓄え', nameEn: 'Candle Stockpile', desc: '所持本数が100本に到達', descEn: 'Reached 100 candles held' },
      hold300: { icon: '🏮', name: '光の貯蔵庫', nameEn: 'Vault of Light', desc: '所持本数が300本に到達', descEn: 'Reached 300 candles held' },
      hold600: { icon: '👑', name: '灯火の富豪', nameEn: 'Candle Baron', desc: '所持本数が600本に到達', descEn: 'Reached 600 candles held' },
    },
  },
  starcandle: {
    storageKey: 'skyStarCandleCalc_titles_v1', namespaced: true, source: '星のキャンドル計算機', sourceEn: 'Star Candle Calculator',
    extract: d => Object.keys(d || {}),
    titles: {
      streak_3: { icon: '🕯️', name: '灯を絶やさぬ者', nameEn: 'Flame Unwavering', desc: '赤闇を3日連続で取りこぼさず回収', descEn: 'Collected shard rewards 3 days in a row without missing one' },
      streak_7: { icon: '🔥', name: '一週間の灯火番', nameEn: 'Week-Long Keeper of Flame', desc: '赤闇を7日連続で取りこぼさず回収', descEn: 'Collected shard rewards 7 days in a row without missing one' },
      streak_20: { icon: '🌌', name: '常夜の灯守', nameEn: "Eternal Night's Keeper", desc: '赤闇を20日連続で取りこぼさず回収', descEn: 'Collected shard rewards 20 days in a row without missing one' },
      candle_30: { icon: '⭐', name: '星屑の蒐集者', nameEn: 'Stardust Gatherer', desc: '所持本数が最高30本に到達', descEn: 'Held 30 candles at once for the first time' },
      candle_100: { icon: '🌟', name: '百連の灯', nameEn: 'Hundredfold Flame', desc: '所持本数が最高100本に到達', descEn: 'Held 100 candles at once for the first time' },
      candle_300: { icon: '👑', name: '星々の帳を統べる者', nameEn: 'Sovereign of the Starry Veil', desc: '所持本数が最高300本に到達', descEn: 'Held 300 candles at once for the first time' },
    },
  },
};

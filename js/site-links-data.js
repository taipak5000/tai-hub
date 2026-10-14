/* ================================================================
   「他のツール」一覧の元データ（tai-hubが唯一の編集元）。
   以前は item/site-links.json（https://taipak5000.github.io/tai-item/site-links.json）を
   起動のたびに取得していたが、独立サイトを閉じても tai-hub だけで完結するよう、
   このファイルに取り込んだ（js/site-links.js が使う）。ツールの追加・改名・並べ替えは
   ここを編集する。独立サイト側のサイドバーは引き続き item/site-links.json を見ているので、
   完全に移行するまでは両方を揃えて更新すること。

   id は tai-hub のルート名（#/<id>）と一致させる。path は旧サイトのURL
   （https://taipak5000.github.io/<path>/）の<path>で、旧サイトへ転送する時だけ使う。
   icon は js/icon-sprite.js のシンボルID、badgeTest は「test」バッジ表示。
   表示名は ja/en（companion のみ zh-TW/ko も使う。無い言語は en → ja の順で代替）。
   非公開のツール（tai-nomacan-pro）は js/site-links.js の HUB_ONLY_TOOLS に書く。
   ================================================================ */
export const SITE_LINK_TOOLS = [
  { id: 'item',           path: 'tai-item',         icon: 'i-folder',      ja: 'アイテム所持管理',       en: 'Item Collection Tracker',  'zh-TW': '道具持有管理',     ko: '아이템 보유 관리' },
  { id: 'emote',          path: 'tai-emote',        icon: 'i-masks',       ja: 'エモート所持率管理',     en: 'Emote Collection Tracker', 'zh-TW': '動作持有率管理',   ko: '감정표현 보유율 관리' },
  { id: 'share',          path: 'share',            icon: 'i-pin',         ja: '創作物管理ツール',       en: 'Creation Manager',         'zh-TW': '創作物管理工具',   ko: '창작물 관리 도구' },
  { id: 'tai-nomacan',    path: 'tai-nomacan',      icon: 'i-candle',      ja: 'ノマキャン計算機',       en: 'Candle Calculator',        'zh-TW': '一般蠟燭計算機',   ko: '일반 초 계산기' },
  { id: 'star-candle',    path: 'star-candle',      icon: 'i-star-candle', ja: '星のキャンドル計算機',   en: 'Star Candle Calculator',   'zh-TW': '星之蠟燭計算機',   ko: '별의 초 계산기' },
  { id: 'companion',      path: 'companion',        icon: 'i-sparkle',     ja: '精霊同行ツール',         en: 'Spirit Companion Tool',    'zh-TW': '精靈同行工具',     ko: '정령 동행 도구' },
  { id: 'wings',          path: 'wings',            icon: 'i-wing',        ja: '羽トラッカー',           en: 'Wing Tracker',             'zh-TW': '羽翼追蹤器',       ko: '날개 트래커' },
  { id: 'spirit-catalog', path: 'tai-catalog',      icon: 'i-tree',        ja: '精霊ツリー管理',         en: 'Spirit Tree Catalog',      'zh-TW': '精靈樹管理',       ko: '정령 트리 관리', badgeTest: true },
  { id: 'tai-revisit',    path: 'tai-revisit',      icon: 'i-wing',        ja: '再訪精霊データベース',   en: 'Revisit Spirit Database',  'zh-TW': '再訪精靈資料庫',   ko: '재방문 정령 데이터베이스' },
  { id: 'tai-score',      path: 'tai-score',        icon: 'i-music-note',  ja: '楽譜づくり',             en: 'Sheet Music Maker',        'zh-TW': '樂譜製作工具',     ko: '악보 제작 도구', badgeTest: true },
  { id: 'tai-card',       path: 'tai-card',         icon: 'i-card',        ja: '星紡ぎカード',           en: 'Self-Intro Card Maker',    'zh-TW': '星紡卡片',         ko: '별잣기 카드' },
  { id: 'data-transfer',  path: 'tai-transfer',     icon: 'i-sync',        ja: 'データ引継ぎ',           en: 'Data Transfer',            'zh-TW': '資料轉移',         ko: '데이터 이전' },
  { id: 'tai-info',       path: 'tai-info',         icon: 'i-settings',    ja: '設定・クレジット',       en: 'Settings & Credits',       'zh-TW': '設定・製作名單',   ko: '설정・크레딧' },
  { id: 'profile',        path: 'skyzztai-profile', icon: 'i-person',      ja: '作者プロフィール',       en: 'Creator Profile',          'zh-TW': '作者個人檔案',     ko: '제작자 프로필' },
];

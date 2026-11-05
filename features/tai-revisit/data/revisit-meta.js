/* ================================================================
   移植元: tai-revisit/index.html の AREA_JA / SEASON_ORDER（値は変更なし）。
   AREA_JA: エリア名（英語→日本語）対応表。出典は元ファイルのコメント参照
   （Sky 星を紡ぐ子どもたち Wiki* / Sky: Children of the Light Wiki 日本語版）。
   SEASON_ORDER: 季節の実装（リリース）順。
   季節名（日本語→英語）は js/i18n.js の trEvent()/SEASON_NAME_EN が
   このサイトで使う季節名を全てカバーしているため、ここでは複製せず
   trEvent() をそのまま再利用する（tai-revisit-view.js 側）。
   ================================================================ */

export const AREA_JA = {
  'Village of Dreams': '夢見の町', 'Butterfly Fields': '蝶々の住処', 'The Wind Paths': '風の街道',
  'Upper Vault': '書庫上層', 'Revival Season Shop': '復古の季節ショップ', 'Forgotten Ark': '忘れられた方舟',
  'Frozen Lake': '凍った湖', 'Prairie Peaks': '草原連峰', 'Sanctuary Islands': '楽園の島々',
  'Passage Rock': 'ならいの大岩', 'Treasure Reef': '秘宝の環礁', 'Boneyard': '雨林の墓場',
  'Forest Courtyard': '雨林の前庭', 'Forest Brook': '雨林の小川', 'Temple of the Valley': '峡谷の神殿',
  'Crab Fields': '蟹の沼地', 'Cave of Prophecies': '預言者の石窟', 'Village Theatre': '夢見の劇場',
  'The Graveyard': '墓所', 'Repository of Refuge': '君憶う保存庫', 'Dawn Overlook': '孤島の見晴らし台',
  'The Coliseum': '円形劇場', 'Prairie Cave': '草原の洞窟', 'Starlight Desert': '星月夜の砂漠',
  'Starlight Desert Jar': '星月夜の砂漠（壺）', 'Jellyfish Beach': '海月の浜辺', 'Dawn Circle': '夜明けの円環',
  'Temple of the Isle Entrance': '孤島の神殿（入口）', 'Void of Shattering': '砕ける闇の虚',
  'Vault Rest': '書庫の交流広場', 'Bird Nest': '鳥の巣', 'Forest Cavern': '雨林の大空洞',
  'Vault Archive': '資料庫', 'Blue Bird theater': '青い鳥劇場', 'Wandering Carnival': 'さすらいカーニバル',
  'Starry Gallery': '星月夜の画廊', 'Concert Hall': 'コンサートホール', 'Fractured Lantern Storage': '壊れし燈の保管庫',
  'Moominvalley Glade': 'ムーミン谷', 'Nesting Workshop': '巣づくり工房', 'Crescent Oasis': '三日月オアシス',
  'Aviary Village': '花鳥郷', 'The Last City': '最後の街',
};
export function areaJa(area) { return AREA_JA[area] || area; }

export const SEASON_ORDER = [
  '感謝の季節', '光の探求者の季節', '想いを編む季節', 'リズムが弾ける季節', '魔法の季節',
  '楽園の季節', '預言者の季節', '夢かなう季節', '大樹に集う季節', '星の王子さまの季節',
  '羽ばたく季節', '深淵の季節', '表現者たちの季節', '砕ケル闇ノ季節', 'AURORAの季節',
  '追慕の季節', 'ならいの季節', '瞬きの季節', '復古の季節', '九色の鹿の季節',
  '巣づくりの季節', '重なる音色の季節', 'ムーミンの季節', '光に染まる季節', '青い鳥の季節',
  'ふたつの灯火の季節　前編', '渡りの季節', '光の修繕者の季節', 'カーニバルの季節', 'ゴッホの季節',
  '遥かなる真珠の季節',
];

/* ================================================================
   共通 i18n（言語切り替え）ユーティリティ
   item/i18n.js を ES module として移植したもの。ロジック・キー名は
   元の実装と完全に同一（sky_app_lang は taipak5000.github.io 配下の
   全ツール共通キー）。setLang() の location.reload() 挙動もそのまま
   維持する（tai-hub は今回、言語切替の反応的な再描画までは作らない
   ——リロード後はrouterがhashから現在のルートを再マウントするため
   体験として大きな破綻はない）。
   ================================================================ */

export const SITE_LANG_KEY = 'sky_app_lang';

// 保存できる言語。zh-TW/ko は精霊同行ツール(companion)だけが対応していて、他のツールは
// 元サイト群と同じく日本語表示にフォールバックする（getLang()はja/enの2値のまま）
export const SITE_LANGS = ['ja', 'en', 'zh-TW', 'ko'];

// 保存されている言語（4値）。精霊同行ツールなど、zh-TW/koを扱うものだけがこちらを読む
export function getRawLang() {
  let v = null;
  try { v = localStorage.getItem(SITE_LANG_KEY); } catch (e) { /* noop */ }
  return SITE_LANGS.includes(v) ? v : 'ja';
}

export function getLang() {
  return getRawLang() === 'en' ? 'en' : 'ja';
}

export function setLang(lang) {
  localStorage.setItem(SITE_LANG_KEY, SITE_LANGS.includes(lang) ? lang : 'ja');
  location.reload();
}

export function toggleLang() {
  setLang(getLang() === 'ja' ? 'en' : 'ja');
}

export const CURRENT_LANG = getLang();
export const RAW_LANG = getRawLang(); // zh-TW/ko を含む4値（精霊同行ツール用）

// 季節・日々・コラボイベント名の日本語→英語対応表（item/i18n.jsと同一）
export const SEASON_NAME_EN = {
  '感謝の季節': 'Season of Gratitude',
  '光の探求者の季節': 'Season of Lightseekers',
  '想いを編む季節': 'Season of Belonging',
  'リズムが弾ける季節': 'Season of Rhythm',
  '魔法の季節': 'Season of Enchantment',
  '楽園の季節': 'Season of Sanctuary',
  '預言者の季節': 'Season of Prophecy',
  '夢かなう季節': 'Season of Dreams',
  '大樹に集う季節': 'Season of Assembly',
  '星の王子さまの季節': 'Season of The Little Prince',
  '羽ばたく季節': 'Season of Flight',
  '深淵の季節': 'Season of Abyss',
  '表現者たちの季節': 'Season of Performance',
  '砕ケル闇ノ季節': 'Season of Shattering',
  'AURORAの季節': 'Season of AURORA',
  '追慕の季節': 'Season of Remembrance',
  'ならいの季節': 'Season of Passage',
  '瞬きの季節': 'Season of Moments',
  '復古の季節': 'Season of Revival',
  '九色の鹿の季節': 'Season of the Nine-Colored Deer',
  '巣づくりの季節': 'Season of Nesting',
  '重なる音色の季節': 'Season of Duets',
  'ムーミンの季節': 'Season of Moomin',
  '光に染まる季節': 'Season of Radiance',
  '青い鳥の季節': 'Season of the Blue Bird',
  'ふたつの灯火の季節　前編': 'Season of The Two Embers - Part 1',
  '渡りの季節': 'Season of Migration',
  '光の修繕者の季節': 'Season of Lightmending',
  'カーニバルの季節': 'Season of Carnival',
  '親愛なるファン・ゴッホへ': 'Dear Van Gogh',
  '遥かなる真珠の季節': 'Season of Pearl',
  '来福の日々': 'Days of Fortune',
  '癒しの日々': 'Days of Healing',
  '花笑む日々': 'Days of Bloom',
  '自然の日々': 'Days of Nature',
  '彩なす日々': 'Days of Color',
  'Skyアニバーサリー': 'Sky Anniversary',
  '陽光の日々': 'Days of Sunlight',
  '月灯りの日々': 'Days of Moonlight',
  'いたずらな日々': 'Days of Mischief',
  '分かち合いの日々': 'Days of Giving',
  '聖なる星の日々': 'Days of Feast',
  '愛しみの日々': 'Days of Love',
  '宝探しの日々': 'Days of Treasure',
  'お洒落な日々': 'Days of Style',
  '音楽の日々': 'Days of Music',
  '凱旋の大競技会': 'Tournament of Triumph',
  '光に染まるイベント': 'Event of Radiant Light',
  '来訪する精霊団': 'Traveling Spirit Troupe',
  '夏のキャンプ': 'Summer Camp',
  '大キャン２倍・シーズンキャンドル２倍': 'Double Grand & Season Candles',
  '恒常精霊': 'Realm Spirits',
  '奏の音楽堂': 'Concert Hall',
  '恒常精霊・過去': 'Realm Spirits (Past)',
  '恒常究極': 'Realm Spirit (Ultimate)',
  '常駐精霊': 'Realm Spirits',
  '季節精霊・過去': 'Traveling Spirit (Past)',
  '初期装備': 'Starting Item',
  '季節の存在・過去': 'Season Manifestation (Past)',
  '季節の存在': 'Season Manifestation',
  '季節の案内人・究極の贈り物': 'Season Guide (Ultimate Gift)',
  '季節の案内人': 'Season Guide',
  'アルティメットギフト': 'Ultimate Gift',
  'アドベンチャーパス': 'Adventure Pass',
  'ペンダント': 'Pendant',
  'デイズ限定': 'Days-event Exclusive',
  'デイズ限定・過去開催': 'Days-event Exclusive (Past)',
  '定期開催': 'Recurring',
  '常設': 'Permanent',
  '常設アイテム': 'Permanent Item',
  '常設ショップ': 'Permanent Shop',
  '復刻なし': 'No Re-release',
  '期間限定・復刻なし': 'Limited-time, No Re-release',
  '限定・復刻なし': 'Limited, No Re-release',
  '条件付き': 'Conditional',
  'AURORAアンコール・コンサート': 'AURORA Encore Concerts',
};

export const CAT_NAME_EN = {
  'アウトフィット': 'Outfit',
  'シューズ': 'Shoes',
  'マスク': 'Mask',
  'フェイスアクセサリー': 'Face Accessory',
  'ネックレス': 'Necklace',
  'ヘアスタイル': 'Hairstyle',
  'ヘアアクセサリー': 'Hair Accessory',
  'ヘッドアクセサリー': 'Head Accessory',
  'ケープ': 'Cape',
  '持ち運べるアイテム': 'Props',
  '持ち物アイテム': 'Props',
  '小さい設置アイテム': 'Small Placeable Items',
  '大きい設置アイテム': 'Large Placeable Items',
  '楽譜': 'Music Sheets',
};

export function trEvent(jpName) {
  if (CURRENT_LANG !== 'en') return jpName;
  return SEASON_NAME_EN[jpName] || jpName;
}

export function trSource(source) {
  if (CURRENT_LANG !== 'en') return source;
  const m = /^([^（(]+)(?:[（(](.+)[）)])?$/.exec(source);
  if (!m) return source;
  const base = trEvent(m[1].trim());
  if (!m[2]) return base;
  const suffix = trEvent(m[2].trim());
  return `${base} (${suffix})`;
}

export function trCat(jpName) {
  if (CURRENT_LANG !== 'en') return jpName;
  return CAT_NAME_EN[jpName] || jpName;
}

export function trItem(item) {
  if (CURRENT_LANG !== 'en') return item.name;
  return item.nameEn || item.name;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function resetFilterPanel(panelSelector, afterRender) {
  const panel = document.querySelector(panelSelector);
  if (!panel) return;
  panel.querySelectorAll('input[type="text"], input[type="search"]').forEach(el => { el.value = ''; });
  panel.querySelectorAll('input[type="checkbox"]').forEach(el => { el.checked = false; });
  panel.querySelectorAll('select').forEach(el => {
    if (el.options.length > 0) el.value = el.options[0].value;
  });
  if (typeof afterRender === 'function') afterRender();
}

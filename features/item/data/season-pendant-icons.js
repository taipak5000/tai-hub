/* ================================================================
   season-pendant-icons.js — 季節ペンダントのアイコン画像

   item/profiles.js の SEASON_PENDANT_ICON / seasonPendantIconHtml を移植
   （necklaceカテゴリのペンダントのimgと同じ画像を、季節名で引けるようにした
   もの）。コスト集計の季節見出しなど、「季節名」を表示する場所で、汎用の
   線アイコンの代わりにその季節の実際のペンダント画像を小さな丸アイコンとして
   出すために使う。対応する季節が無い場合（日々イベント等）は線アイコンに
   フォールバックする。
   ================================================================ */

export const SEASON_PENDANT_ICON = {
  '感謝の季節': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/7/73/1_Gratitude.png/revision/latest/scale-to-width-down/51',
  '光の探求者の季節': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/5/51/2_Lightseekers.png/revision/latest/scale-to-width-down/51',
  '想いを編む季節': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/d/dc/3_Belonging.png/revision/latest/scale-to-width-down/51',
  'リズムが弾ける季節': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/2/25/4_Rhythm.png/revision/latest/scale-to-width-down/51',
  '魔法の季節': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/e/e8/5_Enchantment.png/revision/latest/scale-to-width-down/51',
  '楽園の季節': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/a/a4/6_Sanctuary.png/revision/latest/scale-to-width-down/51',
  '預言者の季節': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/7/76/7_Prophecy.png/revision/latest/scale-to-width-down/51',
  '夢かなう季節': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/a/a7/8_Dreams.png/revision/latest/scale-to-width-down/51',
  '大樹に集う季節': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/4/47/9_Assembly.png/revision/latest/scale-to-width-down/51',
  '星の王子さまの季節': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/2/20/10_Little_Prince.png/revision/latest/scale-to-width-down/51',
  '羽ばたく季節': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/4/41/11_Flight.png/revision/latest/scale-to-width-down/51',
  '深淵の季節': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/1/15/Season-of-Abyss-Icon.png/revision/latest/scale-to-width-down/51',
  '表現者たちの季節': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/1/16/13_SOPerformance_logo.png/revision/latest/scale-to-width-down/51',
  '砕ケル闇ノ季節': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/d/d0/14_SOShattering.png/revision/latest/scale-to-width-down/51',
  'AURORAの季節': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/3/3a/15-Aurora.png/revision/latest/scale-to-width-down/51',
  '追慕の季節': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/d/da/16_SORemembrance_logo.png/revision/latest/scale-to-width-down/51',
  'ならいの季節': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/c/c3/17_SOPassage_logo.png/revision/latest/scale-to-width-down/51',
  '瞬きの季節': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/5/5c/Season-of-Moments-icon.png/revision/latest/scale-to-width-down/51',
  '復古の季節': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/6/60/Season-of-Revival-icon.png/revision/latest/scale-to-width-down/51',
  '九色の鹿の季節': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/5/5a/Season-of-The-Nine-Colored-Deer-icon.png/revision/latest/scale-to-width-down/51',
  '巣づくりの季節': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/8/87/Season-of-Nesting-icon.png/revision/latest/scale-to-width-down/51',
  '重なる音色の季節': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/3/3f/Season-of-Duets-icon.png/revision/latest/scale-to-width-down/51',
  'ムーミンの季節': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/3/3a/Season-of-Moomin-icon.png/revision/latest/scale-to-width-down/51',
  '光に染まる季節': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/b/b0/Season-of-Radiance-icon.png/revision/latest/scale-to-width-down/51',
  '青い鳥の季節': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/6/63/Season-of-Blue-Bird-icon.png/revision/latest/scale-to-width-down/51',
  'ふたつの灯火の季節　前編': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/9/98/Season-of-the-Two-Embers-icon.png/revision/latest/scale-to-width-down/51',
  '渡りの季節': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/5/59/Season-of-Migration-icon.png/revision/latest/scale-to-width-down/51',
  '光の修繕者の季節': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/6/60/Season-of-Lightmending-icon.png/revision/latest/scale-to-width-down/51',
  'カーニバルの季節': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/5/51/Season-of-Carnival-icon.png/revision/latest/scale-to-width-down/51',
  '親愛なるファン・ゴッホへ': 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/9/9d/Dear-Van-Gogh-icon.png/revision/latest/scale-to-width-down/51',
};
// 季節名からその季節のペンダント画像を小さな丸アイコンとして返す。対応する季節が無い場合
// （日々イベント等）は従来通り線アイコン（fallbackSymbolId）にフォールバックする。
export function seasonPendantIconHtml(seasonName, size, fallbackSymbolId) {
  const url = SEASON_PENDANT_ICON[seasonName];
  if (!url) return `<svg class="inline-icon" width="${size}" height="${size}"><use href="#${fallbackSymbolId}"/></svg>`;
  const fallbackSvg = `<svg class=&quot;inline-icon&quot; width=&quot;${size}&quot; height=&quot;${size}&quot;><use href=&quot;#${fallbackSymbolId}&quot;/></svg>`;
  return `<img src="${url}" alt="" loading="lazy" referrerpolicy="no-referrer" width="${size}" height="${size}" style="border-radius:50%;object-fit:cover;vertical-align:-${Math.round(size*0.2)}px;flex-shrink:0;display:inline-block;" onerror="this.outerHTML='${fallbackSvg}'">`;
}

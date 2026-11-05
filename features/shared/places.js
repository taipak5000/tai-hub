/* ================================================================
   思い出の場所（フォト日記・コーデ日記で共通に選べるエリア）。
   保存するのは id だけ（表示名はここで引く）。並びはゲームを進める順。
   ================================================================ */
export const PLACES = [
  { id: 'isle', ja: '孤島', en: 'Isle of Dawn', color: '#E9B872' },
  { id: 'prairie', ja: '草原', en: 'Daylight Prairie', color: '#9BCB6B' },
  { id: 'forest', ja: '雨林', en: 'Hidden Forest', color: '#4FA08B' },
  { id: 'valley', ja: '峡谷', en: 'Valley of Triumph', color: '#7FB3E6' },
  { id: 'wasteland', ja: '捨てられた地', en: 'Golden Wasteland', color: '#8E8A7A' },
  { id: 'vault', ja: '書庫', en: 'Vault of Knowledge', color: '#6C7BD0' },
  { id: 'eden', ja: '暴風域', en: 'Eye of Eden', color: '#5B5F7A' },
  { id: 'home', ja: 'ホーム', en: 'Home', color: '#D98BB4' },
  { id: 'season', ja: '季節のエリア', en: 'Season area', color: '#C79BE8' },
  { id: 'event', ja: 'イベント', en: 'Event', color: '#F2A65A' },
  { id: 'other', ja: 'その他', en: 'Other', color: '#A0A4AE' },
];
export const PLACE_IDS = new Set(PLACES.map(p => p.id));
export function placeById(id) { return PLACES.find(p => p.id === id) || null; }
export function placeName(id, lang) { const p = placeById(id); return p ? (lang === 'en' ? p.en : p.ja) : ''; }

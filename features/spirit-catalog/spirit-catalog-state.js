/* ================================================================
   spirit-catalog-state.js — 精霊ツリー管理機能の永続化・計算レイヤー

   移植元: C:\Users\user\Downloads\skyツール\spirit-catalog\index.html
   （~6400行のスタンドアロンページ）のうち、localStorageの読み書き・
   ノード解放判定・ツリーレイアウト計算・一括操作のコア処理・item/emote/
   wingsとのクロスツール同期を担う部分。DOM構築・イベント配線は
   spirit-catalog-view.js 側に分離している。

   localStorageのキー名・JSON形状は元実装と完全に同一に保っている
   （既存ユーザーのデータをそのまま読めることが必須のため）。
   spirit-catalog自身が所有するキー（spiritCatalogUnlocked_v1 /
   spiritCatalogTitles_v1 / spiritCatalogStats_v1）は nsKey() 経由で
   プロフィール名前空間化する。item/emote/wings側の共有キー
   （gameItems_<cat> / wish_<cat> / emoteOwned_v1 / wingTracker_v1 /
   permWingTracker_v1）も同様に nsKey() を通す — これは元実装と同じ
   （taipak5000.github.io系ツールは全ツールが同一オリジンでlocalStorageを
   共有し、プロフィール機構も共通のため）。

   【意図的な簡略化（元の挙動を変えない範囲のスコープ調整。詳細は
   spirit-catalog-view.jsの冒頭コメント・最終報告のdeviationsFromSourceに
   まとめる）】
   - 所持通貨（キャンドル・ハート）の自動増減（adjustOwnCurrency）・
     季節のペンダント所持による「シーズン中に入手済み（0扱い）」除外
     （getPendantOwnedSeasons/seasonAcquireMode_v1）は元実装と同じ挙動で
     下記に移植済み。元実装と同じく、シーズンキャンドル/ハート・昇華
     キャンドル・イベント通貨（cost.sc/sh/ac/ec）は自動増減の対象外の
     まま（コスト表示はあくまで「残り必要数の目安」）。
   - ノードの実機画像解決（item/emoteの実データをfetchして名前/ID照合する
     Stage1〜4のロジック）は下記のresolveNodeImg()に元実装と同じ優先順位
     （itemCatKey+itemCostId直接参照 → emoteId直接参照 → 汎用報酬名辞書
     node-image-map.js → 名前照合 → Warp/Quest固定画像）で移植済み。
     元実装はitem/emote側の自HTMLをfetch+正規表現で読んでいたが、tai-hub版は
     item/emote機能が既にモジュール化されたデータファイルを持つため、それを
     直接dynamic importする（fetchより軽量・確実。挙動は同じ）。
   ================================================================ */
import { nsKey, nsKeyFor, getActiveProfileId, removeWishItem } from '../../js/state.js';
import { CURRENT_LANG } from '../../js/i18n.js';
import { t } from './data/i18n-catalog.js';
import { SPIRIT_TREE_DATA } from './data/spirit-tree-data.js';
import { SPIRIT_YOMI } from './data/spirit-yomi-data.js';
import { REVISIT_SPIRIT_SCHEDULES } from '../item/data/season-data.js';
import { ITEM_COST_DATA } from '../item/data/cost-data.js';
import { GENERIC_ITEM_IMG } from './data/node-image-map.js';
import { EMOTES } from '../emote/data/emotes.js';

/* ================================================================
   季節名・種別のJA/EN対応表
   ================================================================ */
export const SEASON_JA_MAP = {
  'Season of Gratitude': '感謝の季節', 'Season of Lightseekers': '光の探求者の季節',
  'Season of Belonging': '想いを編む季節', 'Season of Rhythm': 'リズムが弾ける季節',
  'Season of Enchantment': '魔法の季節', 'Season of Sanctuary': '楽園の季節',
  'Season of Prophecy': '預言者の季節', 'Season of Dreams': '夢かなう季節',
  'Season of Assembly': '大樹に集う季節', 'Season of The Little Prince': '星の王子さまの季節',
  'Season of Flight': '羽ばたく季節', 'Season of Abyss': '深淵の季節',
  'Season of Performance': '表現者たちの季節', 'Season of Shattering': '砕ケル闇ノ季節',
  'Season of AURORA': 'AURORAの季節', 'Season of Remembrance': '追慕の季節',
  'Season of Passage': 'ならいの季節', 'Season of Moments': '瞬きの季節',
  'Season of Revival': '復古の季節', 'Season of the Nine-Colored Deer': '九色の鹿の季節',
  'Season of Nesting': '巣づくりの季節', 'Season of Duets': '重なる音色の季節',
  'Season of Moomin': 'ムーミンの季節', 'Season of Radiance': '光に染まる季節',
  'Season of the Blue Bird': '青い鳥の季節', 'Season of The Two Embers - Part 1': 'ふたつの灯火の季節　前編',
  'Season of Migration': '渡りの季節', 'Season of Lightmending': '光の修繕者の季節',
  'Season of Carnival': 'カーニバルの季節', 'Dear Van Gogh': 'ゴッホの季節',
};
export function seasonLabel(seasonKey) {
  if (!seasonKey) return seasonKey;
  return CURRENT_LANG === 'en' ? seasonKey : (SEASON_JA_MAP[seasonKey] || seasonKey);
}
const TYPE_JA = { Season: '季節精霊', Regular: '恒常精霊', Elder: '長老', Guide: '季節ガイド', Special: '特殊', Event: 'イベント' };
const TYPE_EN = { Season: 'Seasonal', Regular: 'Regular', Elder: 'Elder', Guide: 'Guide', Special: 'Special', Event: 'Event' };
export function typeLabel(type) { return (CURRENT_LANG === 'en' ? TYPE_EN[type] : TYPE_JA[type]) || type; }

/* ================================================================
   並び順（種別→エリア/シーズン順）。読み込み時に1回だけ適用する。
   ================================================================ */
const REALM_ORDER = ['Isle of Dawn', 'Daylight Prairie', 'Hidden Forest', 'Valley of Triumph', 'Golden Wasteland', 'Vault of Knowledge'];
export const AREA_TO_REALM = {
  'Dawn Circle': 'Isle of Dawn', 'Temple of the Isle Entrance': 'Isle of Dawn',
  'Prairie Heights': 'Daylight Prairie', 'Prairie Village': 'Daylight Prairie', 'Prairie Cave': 'Daylight Prairie',
  'Butterfly Fields': 'Daylight Prairie', 'Bird Nest': 'Daylight Prairie',
  'Forest Brook': 'Hidden Forest', 'Forest Courtyard': 'Hidden Forest', 'Boneyard': 'Hidden Forest',
  'The Coliseum': 'Valley of Triumph', 'The Citadel': 'Valley of Triumph', 'Frozen Lake': 'Valley of Triumph',
  'The Graveyard': 'Golden Wasteland', 'Wasteland Battlefield': 'Golden Wasteland',
  'Crab Fields': 'Golden Wasteland', 'The Outer Bailey': 'Golden Wasteland',
  'Vault Rest': 'Vault of Knowledge', 'Upper Vault': 'Vault of Knowledge',
  'Lower Vault': 'Vault of Knowledge', 'Vault Second Floor': 'Vault of Knowledge',
  'Dawn Overlook': 'Isle of Dawn', 'Cave of Prophecies': 'Isle of Dawn', 'Passage Rock': 'Isle of Dawn',
  'Prairie Peaks': 'Daylight Prairie', 'Sanctuary Islands': 'Daylight Prairie',
  'Forest Cavern': 'Hidden Forest', 'The Treehouse': 'Hidden Forest',
  'The Wind Paths': 'Hidden Forest', 'Blue Bird theater': 'Hidden Forest',
  'Village of Dreams': 'Valley of Triumph', 'Temple of the Valley': 'Valley of Triumph',
  'Forgotten Ark': 'Golden Wasteland', 'Treasure Reef': 'Golden Wasteland',
  'Starlight Desert': 'Vault of Knowledge', 'Starlight Desert Jar': 'Vault of Knowledge',
  'Crescent Oasis': 'Vault of Knowledge', 'Vault Archive': 'Vault of Knowledge',
  'Jellyfish Beach': 'Vault of Knowledge',
};
export const OTHER_AREA_KEY = '__other_area__';
export const AREA_GROUP_ORDER = [...REALM_ORDER, OTHER_AREA_KEY];
const REALM_ORDER_JA = {
  'Isle of Dawn': '孤島', 'Daylight Prairie': '草原', 'Hidden Forest': '雨林',
  'Valley of Triumph': '峡谷', 'Golden Wasteland': '捨てられた地', 'Vault of Knowledge': '書庫',
};
export function realmOrderLabel(realmKey) { return CURRENT_LANG === 'en' ? realmKey : (REALM_ORDER_JA[realmKey] || realmKey); }
export function areaGroupLabel(key) { return key === OTHER_AREA_KEY ? t('browse.otherAreas') : realmOrderLabel(key); }
export function spiritRealmKey(s) { return (s.area && AREA_TO_REALM[s.area]) || OTHER_AREA_KEY; }
export const NO_SEASON_KEY = '__no_season__';
export function spiritSeasonKey(s) { return s.season || NO_SEASON_KEY; }
export function seasonGroupLabel(key) { return key === NO_SEASON_KEY ? t('browse.noSeasonGroup') : seasonLabel(key); }

const TYPE_GROUP_ORDER = { Guide: 0, Special: 1, Elder: 2, Regular: 3, Season: 4 };
(function sortSpiritsBySeasonOrder() {
  const seasonOrder = {};
  Object.keys(SEASON_JA_MAP).forEach((k, i) => { seasonOrder[k] = i; });
  const realmOrder = {};
  REALM_ORDER.forEach((r, i) => { realmOrder[r] = i; });
  SPIRIT_TREE_DATA.sort((a, b) => {
    const aGroup = TYPE_GROUP_ORDER[a.type] ?? 9;
    const bGroup = TYPE_GROUP_ORDER[b.type] ?? 9;
    if (aGroup !== bGroup) return aGroup - bGroup;
    if (a.type === 'Regular') {
      const aRealm = realmOrder[AREA_TO_REALM[a.area]] ?? 999;
      const bRealm = realmOrder[AREA_TO_REALM[b.area]] ?? 999;
      if (aRealm !== bRealm) return aRealm - bRealm;
      if (a.area !== b.area) return (a.area || '').localeCompare(b.area || '', 'en');
      return (a.nameJa || a.name).localeCompare(b.nameJa || b.name, 'ja');
    }
    if (a.type === 'Guide' || a.type === 'Season') {
      const aIdx = seasonOrder[a.season] ?? 999;
      const bIdx = seasonOrder[b.season] ?? 999;
      if (aIdx !== bIdx) return aIdx - bIdx;
      return (a.seasonOrderIndex ?? 0) - (b.seasonOrderIndex ?? 0);
    }
    return (a.nameJa || a.name).localeCompare(b.nameJa || b.name, 'ja');
  });
})();

export { SPIRIT_TREE_DATA };
export const spiritByGuid = {};
SPIRIT_TREE_DATA.forEach((s) => { spiritByGuid[s.guid] = s; });

export function spiritName(s) {
  if (CURRENT_LANG === 'en') return s.name;
  return s.nameJa || s.name;
}

export function normalizeSearchText(str) {
  return String(str).toLowerCase().replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}
export function spiritYomi(s) { return SPIRIT_YOMI[s.nameJa] || ''; }

/* ================================================================
   チェックリスト対象外ノード（ワープ/連れ歩くボタン）
   ================================================================ */
export function isWarpNode(node) { return node.itemType === 'Special' && /Warp$/.test(node.itemName || ''); }
export function isAccompanyNode(node) { return /^Accompany /.test(node.itemName || ''); }
export function isChecklistExcludedNode(node) { return isWarpNode(node) || isAccompanyNode(node); }
export function isQuestNode(node) { return /^Quest \d+/.test(node.itemName || ''); }
export function isHeartNode(node) { return node.itemType === 'Special' && (node.itemName === 'Heart' || node.itemName === 'Season Heart'); }

/* ================================================================
   ノード解放状況の保存（プロフィールごとに名前空間化）
   spiritCatalogUnlocked_v1 = { [nodeGuid]: true }
   （元実装はコスト実額記録用に {spentC,spentH} オブジェクトも書き得るが、
   通貨連動を移植していないtai-hub版では常に boolean true のみを書く。
   読み込み側はtruthyかどうかしか見ないため、元サイトが書いた
   {spentC,spentH} 形式のデータも引き続き「解放済み」として正しく読める）。
   ================================================================ */
const UNLOCK_KEY_RAW = 'spiritCatalogUnlocked_v1';
let unlockedMapCache = null;
export function getUnlockedMap() {
  if (unlockedMapCache) return unlockedMapCache;
  try { unlockedMapCache = JSON.parse(localStorage.getItem(nsKey(UNLOCK_KEY_RAW))) || {}; }
  catch (_) { unlockedMapCache = {}; }
  return unlockedMapCache;
}
export function saveUnlockedMap(map) {
  localStorage.setItem(nsKey(UNLOCK_KEY_RAW), JSON.stringify(map));
  unlockedMapCache = map;
}
export function invalidateUnlockedMapCache() { unlockedMapCache = null; }

/* ================================================================
   🏆 称号（実績）— スプリットツリー全体の解放率で段階的に獲得。
   一度獲得した称号は、後でノードのチェックを外しても取り消されない。
   ================================================================ */
const TITLES_KEY_RAW = 'spiritCatalogTitles_v1';
export const TITLES = [
  { id: 'pct1', icon: 'sc-i-leaf', threshold: 1 },
  { id: 'pct10', icon: 'i-candle', threshold: 10 },
  { id: 'pct25', icon: 'sc-i-leaf', threshold: 25 },
  { id: 'pct50', icon: 'sc-i-tree', threshold: 50 },
  { id: 'pct100', icon: 'i-crown', threshold: 100 },
];
export function loadEarnedTitles() {
  try { return JSON.parse(localStorage.getItem(nsKey(TITLES_KEY_RAW))) || {}; }
  catch (_) { return {}; }
}
export function saveEarnedTitles(map) { localStorage.setItem(nsKey(TITLES_KEY_RAW), JSON.stringify(map)); }
// 戻り値: { earned, newlyEarned: TITLES[] }
export function checkTitleUnlocks(doneNodes, totalNodes) {
  if (!totalNodes) return { earned: loadEarnedTitles(), newlyEarned: [] };
  const earned = loadEarnedTitles();
  const pct = (doneNodes / totalNodes) * 100;
  const newlyEarned = [];
  TITLES.forEach((def) => {
    if (earned[def.id]) return;
    const reached = def.threshold >= 100 ? doneNodes >= totalNodes : pct >= def.threshold;
    if (!reached) return;
    earned[def.id] = { earnedAt: new Date().toISOString() };
    newlyEarned.push(def);
  });
  if (newlyEarned.length) saveEarnedTitles(earned);
  return { earned, newlyEarned };
}

/* ================================================================
   🔄 item/emote/wingsの所持データを読む（逆方向同期の判定用）
   ================================================================ */
const ITEM_CATS_FOR_TREE = [
  'cape', 'mask', 'necklace', 'hairstyle', 'hair_accessory', 'head_accessory',
  'outfit', 'shoes', 'face_accessory', 'portable_item', 'large_placeable', 'small_placeable',
];
let externalOwnCache = null;
export function getExternalOwnCache() {
  if (externalOwnCache) return externalOwnCache;
  const itemOwnedByCat = {};
  ITEM_CATS_FOR_TREE.forEach((catKey) => {
    try {
      const d = JSON.parse(localStorage.getItem(nsKey('gameItems_' + catKey)));
      itemOwnedByCat[catKey] = (d && d.itemOwned) || {};
    } catch (_) { itemOwnedByCat[catKey] = {}; }
  });
  let emoteOwned = {};
  try { emoteOwned = JSON.parse(localStorage.getItem(nsKey('emoteOwned_v1'))) || {}; } catch (_) { /* noop */ }

  const wingUnlockedGuids = new Set();
  let seasonWingTracker = {};
  let permWingTracker = {};
  try { seasonWingTracker = JSON.parse(localStorage.getItem(nsKey('wingTracker_v1'))) || {}; } catch (_) { /* noop */ }
  try { permWingTracker = JSON.parse(localStorage.getItem(nsKey('permWingTracker_v1'))) || {}; } catch (_) { /* noop */ }
  SPIRIT_TREE_DATA.forEach((spirit) => {
    if (!spirit.nameJa) return;
    const wingBuffNodes = (spirit.nodes || []).filter((n) => n.itemType === 'WingBuff');
    if (wingBuffNodes.length === 0) return;
    if (spirit.type === 'Season') {
      const seasonJa = spirit.season ? SEASON_JA_MAP[spirit.season] : null;
      if (!seasonJa) return;
      if (seasonWingTracker[seasonJa] && seasonWingTracker[seasonJa][spirit.nameJa]) {
        wingBuffNodes.forEach((n) => wingUnlockedGuids.add(n.guid));
      }
    } else if (spirit.type === 'Regular') {
      const entry = permWingTracker[spirit.nameJa];
      if (!entry) return;
      wingBuffNodes.forEach((n, idx) => {
        const tierKey = idx === 0 ? 'tier1' : 'tier2';
        if (entry[tierKey]) wingUnlockedGuids.add(n.guid);
      });
    }
  });

  externalOwnCache = { itemOwnedByCat, emoteOwned, wingUnlockedGuids };
  return externalOwnCache;
}
export function invalidateExternalOwnCache() { externalOwnCache = null; pendantOwnedSeasonsCache = null; }

/* ================================================================
   🕊️ 季節のペンダント所持による「季節中に入手済み（0扱い）」除外
   （元実装のgetPendantOwnedSeasons/seasonAcquireMode_v1を移植）

   item側のnecklaceカタログ（features/item/data/cost-data.jsの
   ITEM_COST_DATA.necklace。id/name/sourceを持つ一次データ）のうち、
   名前に「ペンダント」を含み、かつ所持済み（getExternalOwnCache()の
   itemOwnedByCat.necklace）のものから、そのペンダントの季節名
   （sourceの先頭「〇〇の季節」部分。features/item/cost-view.jsの
   extractSource()と同じ抽出ロジック）を集める。
   item_cost.html（アイテム別コスト。tai-hub版はfeatures/item/
   cost-view.js）側で選ぶ「季節中に入手（0扱い）」の選択
   （seasonAcquireMode_v1、itemId→'inSeason'等）と組み合わせ、季節
   キャンドル/ハートの「使用済み」集計（renderStats()）からそのノード分を
   除外できるようにする（renderStats()側で実際に使う。isNodeUnlocked()
   自体や残りコスト集計には影響しない——元実装と同じ適用範囲）。
   ================================================================ */
function extractSeasonFromSource(source) {
  const m = /^([^（(]+)/.exec(source || '');
  return m ? m[1].trim() : source;
}
let pendantOwnedSeasonsCache = null;
export function getPendantOwnedSeasons() {
  if (pendantOwnedSeasonsCache) return pendantOwnedSeasonsCache;
  const necklaceOwned = getExternalOwnCache().itemOwnedByCat.necklace || {};
  const seasons = new Set();
  (ITEM_COST_DATA.necklace || []).forEach((it) => {
    if (it.name && it.name.includes('ペンダント') && it.source && necklaceOwned[it.id]) {
      seasons.add(extractSeasonFromSource(it.source));
    }
  });
  pendantOwnedSeasonsCache = seasons;
  return seasons;
}
export function loadSeasonAcquireMap() {
  try { return JSON.parse(localStorage.getItem(nsKey('seasonAcquireMode_v1'))) || {}; }
  catch (_) { return {}; }
}

/* ================================================================
   ツリーレイアウト（非段階ツリーの枝分かれ座標計算。nw/n/neから算出）
   ================================================================ */
export function computeTreeLayout(s) {
  const nodeMap = {};
  s.nodes.forEach((n) => { nodeMap[n.guid] = n; });
  const root = s.rootNodeGuid;
  if (!root || !nodeMap[root]) return null;

  const depthOf = {};
  const xOf = {};
  const parentOf = {};
  function assign(guid, depth, x) {
    depthOf[guid] = depth;
    xOf[guid] = x;
    const node = nodeMap[guid];
    if (node.nw && nodeMap[node.nw]) { parentOf[node.nw] = guid; assign(node.nw, depth + 1, x - 1); }
    if (node.n && nodeMap[node.n]) { parentOf[node.n] = guid; assign(node.n, depth + 1, x); }
    if (node.ne && nodeMap[node.ne]) { parentOf[node.ne] = guid; assign(node.ne, depth + 1, x + 1); }
  }
  assign(root, 0, 0);

  const xs = Object.values(xOf);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  Object.keys(xOf).forEach((g) => { xOf[g] -= minX; });
  const maxDepth = Math.max(...Object.values(depthOf));
  return { nodeMap, depthOf, xOf, parentOf, maxDepth, leafCount: (maxX - minX + 1) };
}

let blessingWingBuffCache = null;
function getBlessingWingBuffMap() {
  if (blessingWingBuffCache) return blessingWingBuffCache;
  const map = {};
  SPIRIT_TREE_DATA.forEach((s) => {
    const layout = computeTreeLayout(s);
    if (!layout) return;
    const { nodeMap, parentOf } = layout;
    s.nodes.forEach((n) => {
      if (n.itemType !== 'WingBuff') return;
      let cur = parentOf[n.guid];
      while (cur) {
        const ancestor = nodeMap[cur];
        if (ancestor && ancestor.itemNameJa === '祝福') {
          (map[cur] = map[cur] || []).push(n);
        }
        cur = parentOf[cur];
      }
    });
  });
  blessingWingBuffCache = map;
  return map;
}

/* ================================================================
   ノード解放状況の判定: 'own'(このツールで解放) / 'sync'(item/emote/wings
   側の所持データから自動解放) / null(未解放)
   ================================================================ */
export function getUnlockSource(node) {
  if (getUnlockedMap()[node.guid]) return 'own';
  const ext = getExternalOwnCache();
  if (node.itemCatKey && node.itemCostId && ext.itemOwnedByCat[node.itemCatKey] && ext.itemOwnedByCat[node.itemCatKey][node.itemCostId]) return 'sync';
  if (node.emoteId && node.emoteLevel && (ext.emoteOwned[node.emoteId] || []).includes(node.emoteLevel)) return 'sync';
  if (node.itemType === 'WingBuff' && ext.wingUnlockedGuids.has(node.guid)) return 'sync';
  if (node.itemNameJa === '祝福') {
    const wingNodes = getBlessingWingBuffMap()[node.guid];
    if (wingNodes) {
      for (const wn of wingNodes) {
        if (getUnlockSource(wn) === 'sync') return 'sync';
      }
    }
  }
  return null;
}
export function isNodeUnlocked(node) { return !!getUnlockSource(node); }
export function isPrereqNodeSatisfied(parentNode) {
  if (!parentNode) return true;
  return isChecklistExcludedNode(parentNode) || isNodeUnlocked(parentNode);
}

/* ================================================================
   wings（羽トラッカー）と自動同期（Wing Buffノードのみ）
   ================================================================ */
export function syncWingBuff(spirit, node, nowUnlocked) {
  if (!spirit.nameJa || !node || node.itemType !== 'WingBuff') return;
  const wingBuffNodes = spirit.nodes.filter((n) => n.itemType === 'WingBuff');
  const idx = wingBuffNodes.findIndex((n) => n.guid === node.guid);
  if (idx === -1) return;

  if (spirit.type === 'Season') {
    const seasonJa = spirit.season ? SEASON_JA_MAP[spirit.season] : null;
    if (!seasonJa) return;
    const key = nsKey('wingTracker_v1');
    let tracker;
    try { tracker = JSON.parse(localStorage.getItem(key)) || {}; } catch (_) { tracker = {}; }
    if (!tracker[seasonJa]) tracker[seasonJa] = {};
    tracker[seasonJa][spirit.nameJa] = nowUnlocked;
    localStorage.setItem(key, JSON.stringify(tracker));
  } else if (spirit.type === 'Regular') {
    const tierKey = idx === 0 ? 'tier1' : 'tier2';
    const key = nsKey('permWingTracker_v1');
    let tracker;
    try { tracker = JSON.parse(localStorage.getItem(key)) || {}; } catch (_) { tracker = {}; }
    const entry = { ...(tracker[spirit.nameJa] || {}) };
    if (nowUnlocked) { entry[tierKey] = true; } else { delete entry[tierKey]; }
    if (Object.keys(entry).length === 0) { delete tracker[spirit.nameJa]; } else { tracker[spirit.nameJa] = entry; }
    localStorage.setItem(key, JSON.stringify(tracker));
  }
}

/* ================================================================
   💰 所持キャンドル/ハートの自動増減（元実装のadjustOwnCurrencyを移植）

   js/state.js の loadOwnedCurrency/saveOwnedCurrencyField と同じキー
   （nsKey('wishOwnCurrency')、フィールド名candle/heart）を直接
   read-modify-writeする。プロフィール切替モーダル（js/chrome/pf-modal.js）
   の所持通貨欄と完全に同じ保存先のため、そちらで編集した値ともここで
   増減した値ともズレなく同期する。
   元実装と同じくキャンドル・ハート（cost.c/cost.h）のみを対象とし、
   シーズンキャンドル/ハート・昇華キャンドル・イベント通貨（sc/sh/ac/ec）
   は対象外（コスト表示はあくまで「残り必要数の目安」のまま）。
   戻り値は実際に反映された増減額（Math.max(0, ...)によるクランプ後の
   実額）。所持通貨が不足している状態で消費（負のdelta）すると、要求額
   より少ない額しか実際には引かれないことがあるため、呼び出し側が
   「実際に何が起きたか」を追跡できるようにする（toggleNode()の解放/解除
   の往復での通貨水増し防止に使う）。
   ================================================================ */
function adjustOwnCurrency(deltaCandle, deltaHeart) {
  if (!deltaCandle && !deltaHeart) return { candle: 0, heart: 0 };
  const key = nsKey('wishOwnCurrency');
  let cur;
  try { cur = JSON.parse(localStorage.getItem(key)) || { candle: 0, heart: 0 }; }
  catch (_) { cur = { candle: 0, heart: 0 }; }
  const beforeCandle = cur.candle || 0, beforeHeart = cur.heart || 0;
  cur.candle = Math.max(0, beforeCandle + (deltaCandle || 0));
  cur.heart = Math.max(0, beforeHeart + (deltaHeart || 0));
  localStorage.setItem(key, JSON.stringify(cur));
  return { candle: cur.candle - beforeCandle, heart: cur.heart - beforeHeart };
}

/* ================================================================
   item（アイテム所持管理）の所持アイテムと自動同期
   ================================================================ */
export function syncItemOwned(node, nowUnlocked) {
  if (!node.itemCatKey || !node.itemCostId) return;
  const key = nsKey('gameItems_' + node.itemCatKey);
  let data;
  try { data = JSON.parse(localStorage.getItem(key)) || {}; } catch (_) { data = {}; }
  if (!data.itemOwned) data.itemOwned = {};
  if (nowUnlocked) { data.itemOwned[node.itemCostId] = true; } else { delete data.itemOwned[node.itemCostId]; }
  localStorage.setItem(key, JSON.stringify(data));
  if (nowUnlocked) removeWishItem(node.itemCatKey, node.itemCostId);
}

/* 🩹 恒常精霊のティア2ケープは、以前はティア1と同じitemCostId（itemの「…ケープ」）に紐づいていた
   （itemには「…ケープ2」という別アイテムがある）。そのためティア2を解放しても、itemでは
   ティア1が所持扱いになるだけでティア2は未所持のままだった。紐づけを直した後も、すでに
   このツールでティア2を解放済みのユーザーのitem側（ケープ2）が未所持のまま残らないよう、
   プロフィールごとに1回だけ、ティア2を解放済みのノードに対応するitemのケープ2を所持扱いにする。
   追加のみ（所持の取り消しはしない）。ティア1側のitem所持は、item側で直接付けた所持と区別できないため触らない。 */
export function migrateRegularCapeTier2Link() {
  const flagKey = nsKey('capeTier2LinkMigrated_v1');
  try { if (localStorage.getItem(flagKey)) return; } catch (_) { return; }
  const unlocked = getUnlockedMap();
  SPIRIT_TREE_DATA.forEach((s) => {
    if (s.type !== 'Regular') return;
    s.nodes.forEach((n) => {
      if (n.itemType === 'Cape' && n.itemCatKey === 'cape' && / Cape 2$/.test(n.itemName) && unlocked[n.guid]) {
        syncItemOwned(n, true);
      }
    });
  });
  try { localStorage.setItem(flagKey, '1'); } catch (_) { /* ストレージ不可時は次回に再試行 */ }
}

/* ================================================================
   emote（エモート所持率管理）の所持データと自動同期
   emoteOwned_v1 = { [emoteId]: [所持レベル番号の配列] }
   ================================================================ */
export function syncEmoteOwned(node, nowUnlocked) {
  if (!node.emoteId || !node.emoteLevel) return;
  const key = nsKey('emoteOwned_v1');
  let data;
  try { data = JSON.parse(localStorage.getItem(key)) || {}; } catch (_) { data = {}; }
  const owned = new Set(data[node.emoteId] || []);
  if (nowUnlocked) { owned.add(node.emoteLevel); } else { owned.delete(node.emoteLevel); }
  const arr = Array.from(owned).sort((a, b) => a - b);
  if (arr.length === 0) { delete data[node.emoteId]; } else { data[node.emoteId] = arr; }
  localStorage.setItem(key, JSON.stringify(data));
}

/* ================================================================
   進捗集計
   ================================================================ */
export function spiritProgress(spirit) {
  const trackable = spirit.nodes.filter((n) => !isChecklistExcludedNode(n));
  const total = trackable.length;
  const done = trackable.filter((n) => isNodeUnlocked(n)).length;
  return { done, total };
}
export function spiritNodesRemaining(spirit, predicate) {
  return spirit.nodes.filter((n) => !isChecklistExcludedNode(n) && predicate(n) && !isNodeUnlocked(n)).length;
}

/* ================================================================
   ノード単体のトグル（コスト消費あり: キャンドル/ハートのみ自動増減）
   ================================================================ */
export function toggleNode(spiritGuid, nodeGuid) {
  const spirit = spiritByGuid[spiritGuid];
  if (!spirit) return null;
  const node = spirit.nodes.find((n) => n.guid === nodeGuid);
  if (!node) return null;

  const wasDisplayedUnlocked = isNodeUnlocked(node);
  const nowUnlocked = !wasDisplayedUnlocked;

  const unlocked = getUnlockedMap();
  const prevEntry = unlocked[nodeGuid];
  const wasInOwnMap = !!prevEntry; // spirit-catalog自身の解放記録での状態（コスト計算用）

  // 解放でコスト分を消費、解除で払い戻す（キャンドル・ハートのみitemと同期）。
  // item/emote側の所持だけで表示上「解放済み」になっていたノード（＝spirit-catalog
  // 自身ではコストを払っていない）は、この増減の対象外にする。
  //
  // 🪙 所持通貨が不足していても解放操作自体は許可しており、adjustOwnCurrency()は
  // Math.max(0, ...)で0未満を自動クランプする。そのため「解放時に実際に引かれた額」が
  // ノードの名目コストを下回ることがあり、解除時に名目コストをそのまま払い戻すと、
  // 実際には払っていない分の通貨が生成されてしまう（解放→解除の往復で通貨が増える）。
  // これを防ぐため、解放時はadjustOwnCurrency()が実際に適用した額をunlocked[guid]に
  // 記録しておき、解除時はその記録された実額のみを払い戻す。記録の無い旧データ
  // （boolean trueのみ）の場合に限り、従来通り名目コストで払い戻す。
  if (nowUnlocked) {
    const cost = node.cost || {};
    const applied = adjustOwnCurrency(-(cost.c || 0), -(cost.h || 0));
    unlocked[nodeGuid] = { spentC: -applied.candle, spentH: -applied.heart };
  } else if (wasInOwnMap) {
    const spent = (prevEntry && typeof prevEntry === 'object')
      ? { c: prevEntry.spentC || 0, h: prevEntry.spentH || 0 }
      : { c: node.cost?.c || 0, h: node.cost?.h || 0 };
    adjustOwnCurrency(spent.c, spent.h);
    delete unlocked[nodeGuid];
  } else {
    delete unlocked[nodeGuid];
  }
  saveUnlockedMap(unlocked);

  if (node.itemType === 'WingBuff') syncWingBuff(spirit, node, nowUnlocked);
  syncItemOwned(node, nowUnlocked);
  syncEmoteOwned(node, nowUnlocked);
  invalidateExternalOwnCache();
  return { spirit, node, nowUnlocked };
}

// markTreeCompleteCore()（ツリー全体一括解放）とmarkNodesByPredicateCore()
// （種別を絞った一括解放：クエスト一括完了・ハート一括獲得）が共有する
// 1ノード分の「解放済みにする」処理本体。toggleNode()と同じ通貨計算
// ロジック（実際に適用された額をunlocked[guid]へ記録する）を1箇所に保つ。
function unlockNodeForBulk(spirit, unlocked, node) {
  const wasInOwnMap = !!unlocked[node.guid];
  if (wasInOwnMap) {
    unlocked[node.guid] = { spentC: 0, spentH: 0 };
  } else {
    const cost = node.cost || {};
    const applied = adjustOwnCurrency(-(cost.c || 0), -(cost.h || 0));
    unlocked[node.guid] = { spentC: -applied.candle, spentH: -applied.heart };
  }
  syncItemOwned(node, true);
  syncEmoteOwned(node, true);
  if (node.itemType === 'WingBuff') syncWingBuff(spirit, node, true);
}

export function markTreeCompleteCore(spiritGuid) {
  const spirit = spiritByGuid[spiritGuid];
  if (!spirit) return 0;
  const unlocked = getUnlockedMap();
  let changedCount = 0;
  spirit.nodes.forEach((node) => {
    if (isChecklistExcludedNode(node)) return;
    if (isNodeUnlocked(node)) return;
    unlockNodeForBulk(spirit, unlocked, node);
    changedCount++;
  });
  saveUnlockedMap(unlocked);
  invalidateExternalOwnCache();
  return changedCount;
}

export function markNodesByPredicateCore(spiritGuid, predicate) {
  const spirit = spiritByGuid[spiritGuid];
  if (!spirit) return 0;
  const unlocked = getUnlockedMap();
  let changedCount = 0;
  spirit.nodes.forEach((node) => {
    if (isChecklistExcludedNode(node)) return;
    if (isNodeUnlocked(node)) return;
    if (!predicate(node)) return;
    unlockNodeForBulk(spirit, unlocked, node);
    changedCount++;
  });
  saveUnlockedMap(unlocked);
  invalidateExternalOwnCache();
  return changedCount;
}

export function resetTreeToLocked(spiritGuid) {
  const spirit = spiritByGuid[spiritGuid];
  if (!spirit) return 0;
  const unlocked = getUnlockedMap();
  let changedCount = 0;
  spirit.nodes.forEach((node) => {
    if (isChecklistExcludedNode(node)) return;
    if (!isNodeUnlocked(node)) return;
    const prevEntry = unlocked[node.guid];
    if (prevEntry) {
      // toggleNode()の単体解除と同じく、実際に適用された額（記録が無い旧データは名目コスト）
      // のみを払い戻す（通貨不足でクランプされていた場合の水増し防止。詳細はtoggleNode()参照）。
      const spent = (typeof prevEntry === 'object')
        ? { c: prevEntry.spentC || 0, h: prevEntry.spentH || 0 }
        : { c: node.cost?.c || 0, h: node.cost?.h || 0 };
      adjustOwnCurrency(spent.c, spent.h);
      delete unlocked[node.guid];
    } else if (node.itemNameJa === '祝福') {
      return; // 羽ロックの解放状況から動的導出されるのみ。次の再描画で自動的に未解放へ戻る
    }
    syncItemOwned(node, false);
    syncEmoteOwned(node, false);
    if (node.itemType === 'WingBuff') syncWingBuff(spirit, node, false);
    changedCount++;
  });
  saveUnlockedMap(unlocked);
  invalidateExternalOwnCache();
  return changedCount;
}

/* ================================================================
   統計スナップショット（他サイトが直接読めるようにする）
   ================================================================ */
export function saveStatsSnapshot(totalNodes, doneNodes) {
  try { localStorage.setItem(nsKey('spiritCatalogStats_v1'), JSON.stringify({ totalNodes, doneNodes })); }
  catch (_) { /* ストレージ不可時は無視 */ }
}

/* ================================================================
   ノード名・アイコン解決（実機画像フェッチは行わず、アイテム名の
   日本語補完＋種別アイコンのみ。GENERIC_ITEM_NAME_JAは元実装の同名
   辞書をそのまま移植）
   ================================================================ */
const GENERIC_ITEM_NAME_JA = {
  'Belonging Ultimate Fireplace': 'ぬくもりの焚火', 'High Five': 'ハイタッチ', 'Hug': 'ハグ',
  'Double-Five': 'ダブルタッチ', 'Assembly Jar': '壺', 'Assembly Pillow': 'クッション',
  'Little Prince Ultimate Outfit': '星の王子さまの究極のアウトフィット', 'Sword Outfit': '王子さまの剣士服',
  'Flight Ultimate Outfit': '羽ばたく究極アウトフィット', 'Duet Dance': 'ペアダンス',
  'Performance Flower Pot Prop': '花瓶の花束', 'Shattering Ultimate Manta Cape': '究極のマンタケープ',
  'Shattering Ultimate Krill Cape': '究極の暗黒竜ケープ', 'Remembrance Potted Plant': '植木鉢',
  'Remembrance Kettle': 'ケトル', 'Nesting Ultimate Outfit': '巣づくりの究極アウトフィット',
  'Nesting Ultimate Prop': 'フィギュア', 'Duets Ultimate Instrument': '重なる音色のグランドピアノ',
  'Duet Bow': '仲良しお辞儀', 'The Two Embers - Part 1 Ultimate Pendant': 'ふたつの灯火の季節 −前篇−のペンダント',
  'Two Embers - Part 1 Ultimate Hair Accessory': 'ふたつの灯火−前篇の究極ヘアアクセサリー',
  'Two Embers - Part 1 Ultimate Cape': 'ふたつの灯火−前篇の究極ケープ',
  'Challenge Ball Dispenser': 'チャレンジボール供給機', 'Challenge Target': 'チャレンジの的',
  'Challenge Token': 'チャレンジトークン', 'Challenge Bounce Pad': 'チャレンジ跳躍パッド',
  'Challenge Platform': 'チャレンジの台座', 'Forest Elder Hair': '究極のヘアスタイル',
  'Forest Elder Ultimate Face Accessory': '究極のシールドフェイスアクセサリー',
  'Valley Elder Hair 2': '2つ目の究極のヘアスタイル', 'Valley Ultimate Mask B': '2つ目の究極のシールドフェイスアクセサリー',
  'Valley Elder Hair 1': '1つ目の究極のヘアスタイル', 'Valley Ultimate Mask A': '1つ目の究極のシールドフェイスアクセサリー',
  'Isle Elder Hair': '究極のヘアスタイル（あごひげ）', 'Isle Elder Ultimate Face Accessory': '究極のシールドフェイスアクセサリー',
  'Wasteland Elder Hair': '究極のヘアスタイル', 'Vault Elder Hair': '究極のヘアスタイル',
  'Prairie Elder Hair': '究極のヘアスタイル', 'Prairie Elder Ultimate Face Accessory': '究極のシールドフェイスアクセサリー',
  'Meditating Monastic Table Prop': 'チャットテーブル', 'Piggyback': 'おんぶ', 'Hair Tousle': 'なでなで',
  'Play Fight': 'けんかごっこ', 'Bearhug': 'くまハグ', 'Voila': 'ジャジャーン', 'Handshake': '握手',
  'Side Hug': '肩組み', 'Herb Gatherer Prop': '薬草壺', 'Cradle Carry': 'ゆりかご抱っこ',
  'Nesting Nook Shelf': '木製棚', 'Nesting Nook Spice Rack': '木製スパイスラック', 'Nesting Nook Couch': '木製カウチ',
  'Nesting Solarium Hanging Planter': '木製ハンギングプランター', 'Nesting Solarium Table': '木製テーブル',
  'Nesting Solarium Bathtub': '木製浴槽', 'Nesting Solarium Painting': '木製絵画大',
  'Nesting Atrium Floor Light': '木製フロアライト', 'Nesting Atrium Branch': '枝',
  'Nesting Atrium Hanging Lamp': '木製ハンギングランプ', 'Nesting Loft Chair': '木製チェア',
  'Nesting Loft Paintings': '木製絵画セット', 'Nesting Loft Bed': '木製ベッド',
  "The Pianist's Beginnings Rug": 'ピアニストの小さな長方形ラグ', "The Pianist's Beginnings Poster": 'ピアノ鍵盤ポスター',
  "The Cellist's Beginnings Poster": 'チェリストの巻貝ポスター', "The Musicians' Legacy Piano": 'グランドピアノ',
  "The Pianist's Flourishing Poster": 'ピアノポスター', "The Cellist's Flourishing Rug": 'チェリストの小さな長方形ラグ',
  "The Cellist's Flourishing Poster": 'チェロポスター', 'Comfort of Kindness Chandelier': 'シャンデリア',
  'Comfort of Kindness Painting': '橋の絵画', 'Spirit Of Adventure Prop': 'スナフキンテント',
  'Inspiration Of Inclusion Clock': 'おじいさんの時計', 'Inspiration Of Inclusion Painting': 'ムーミンやしきの絵画',
  'Radiance Leaping Dancer Prop': 'カーテンウォール', 'Resourceful Recluse Tea Table': '茶店',
  'Resourceful Recluse Tree Prop': '蔓植物', 'Whispering': 'ないしょ話', 'Secret Handshake': 'ひみつの握手',
  'Revolving Dance': 'くるくるダンス', 'Vase with Sunflowers': '15本のひまわり（持ち物アイテム）',
  'Vase with Blue Flowers': 'アイリスの花瓶', 'Jellyfish Cape': '海月ケープ', 'Jellyfish Hair': '海月ヘアスタイル',
  'Manta Cape': 'マンタケープ', 'Manta Hair': 'マンタヘアスタイル',
};
export function resolveNodeNameJa(n, spirit) {
  if (!n.itemName) return null;
  if (spirit && spirit.nameJa && /^Accompany /.test(n.itemName)) return `${spirit.nameJa}と連れ歩く`;
  const challengeMatch = /^Challenge (\d+)$/.exec(n.itemName);
  if (challengeMatch) return `チャレンジ${challengeMatch[1]}`;
  const questMatch = /^Quest (\d+)/.exec(n.itemName);
  if (questMatch) return `クエスト${questMatch[1]}`;
  return GENERIC_ITEM_NAME_JA[n.itemName] || null;
}
export function itemDisplayName(n, spirit) {
  if (n.itemType === 'Music' && n.itemName) return n.itemName;
  if (CURRENT_LANG === 'en') return n.itemName || n.itemNameJa || resolveNodeNameJa(n, spirit) || t('detail.noItemName');
  return n.itemNameJa || resolveNodeNameJa(n, spirit) || n.itemName || t('detail.noItemName');
}

/* ================================================================
   ノード種別アイコン（resolveNodeImg()が実機画像を解決できなかった場合の
   フォールバックとして使う線画アイコン。i-*** は共有スプライト
   (js/icon-sprite.js)、sc-i-*** はこのツール固有のローカルスプライト
   (spirit-catalog-view.jsが注入)を指す）
   ================================================================ */
export const NODE_TYPE_ICON = {
  Call: 'sc-i-bell', Cape: 'i-hanger', Emote: 'i-person', FaceAccessory: 'sc-i-glasses',
  Furniture: 'sc-i-sofa', Hair: 'sc-i-scissors', HairAccessory: 'sc-i-ribbon', HeadAccessory: 'sc-i-hat',
  Held: 'sc-i-balloon', Mask: 'i-masks', Music: 'i-music-note', Necklace: 'sc-i-necklace',
  Outfit: 'i-hanger', OutfitShoes: 'i-hanger', Prop: 'sc-i-flower', Quest: 'sc-i-scroll', Shoes: 'sc-i-shoe',
  Special: 'i-star', Spell: 'i-sparkle', Stance: 'i-person', WingBuff: 'i-wing',
};
export const NODE_NAME_ICON_OVERRIDE = {
  'ハート': 'i-heart', 'シーズンハート': 'i-heart', 'Heart': 'i-heart', 'Season Heart': 'i-heart',
  'カットシーン': 'sc-i-question', 'Cutscene': 'sc-i-question',
};
export function nodeIconId(node, spirit, isQuest) {
  const name = itemDisplayName(node, spirit);
  return NODE_NAME_ICON_OVERRIDE[name] || (isQuest ? NODE_TYPE_ICON.Quest : NODE_TYPE_ICON[node.itemType]) || 'i-sparkle';
}

/* ================================================================
   🖼️ ノードの実機画像解決（元実装のresolveNodeImg/resolveNodeImgByNameを
   移植。優先順位は元実装と同じ）:
     1. itemCatKey+itemCostId直接参照 — item機能の各カテゴリデータ
        （features/item/data/items/<cat>.js のITEMS配列、img/id）
     2. emoteId直接参照 — emote機能のデータ（features/emote/data/emotes.js
        のEMOTES配列、img/id）
     3. 汎用報酬名辞書（node-image-map.js のGENERIC_ITEM_IMG。itemNameJa優先、
        無ければitemNameの英語）
     4. 名前照合（Stage3相当）— 直接ID参照が無いノードを、itemTypeから
        推定した該当カテゴリ（TYPE_TO_CATKEYS）に対して名前で照合する
     5. Warp/Questの固定画像（精霊ごとに名前は違うが実機アイコンは共通）
     どれにも一致しなければnull（呼び出し側はnodeIconId()の線画アイコンに
     フォールバックする）。

   1・4に使うitem機能側のカテゴリデータ（12ファイル計数百KB）は初期表示の
   重さに影響しないよう、features/item/cost-view.jsのloadAllItemImages()と
   同じ考え方でmount()後に遅延読み込みする（ensureNodeImageMapsLoaded()）。
   2・3は軽量（emotes.jsは1ファイル、node-image-map.jsは静的定数）なため
   通常のstatic importで即時利用できる。
   ================================================================ */
const emoteImgMap = {};
const emoteByNameJa = {};
const emoteByNameEn = {};
EMOTES.forEach((e) => {
  if (e.img) emoteImgMap[e.id] = e.img;
  if (e.name) emoteByNameJa[e.name] = e;
  if (e.nameEn) emoteByNameEn[e.nameEn] = e;
});

// itemCatKeyが無いノード向け: itemTypeからitemの該当カテゴリキー（複数の
// 可能性がある場合は候補リスト）を推定する（元実装のTYPE_TO_CATKEYSを移植）
const TYPE_TO_CATKEYS = {
  Cape: ['cape'], Mask: ['mask'], Necklace: ['necklace'], Hair: ['hairstyle'],
  HairAccessory: ['hair_accessory'], HeadAccessory: ['head_accessory'], Outfit: ['outfit'],
  OutfitShoes: ['outfit', 'shoes'], Shoes: ['shoes'], FaceAccessory: ['face_accessory'],
  Held: ['portable_item'], Furniture: ['large_placeable', 'small_placeable'],
  Prop: ['portable_item', 'large_placeable', 'small_placeable'],
};

let itemImgMapByCat = null; // {catKey: {itemId: img}}（直接ID参照用）
let itemListByCatForImg = null; // {catKey: [{id,name,nameEn,img}, ...]}（名前照合用）
let itemImgMapLoadingPromise = null;
function loadItemImgMapForTree() {
  if (itemImgMapByCat) return Promise.resolve(itemImgMapByCat);
  if (itemImgMapLoadingPromise) return itemImgMapLoadingPromise;
  itemImgMapLoadingPromise = Promise.all(ITEM_CATS_FOR_TREE.map(async (catKey) => {
    try {
      const mod = await import(`../item/data/items/${catKey}.js`);
      return [catKey, mod.ITEMS || []];
    } catch (e) {
      console.error('[spirit-catalog] failed to load item image data', catKey, e);
      return [catKey, []];
    }
  })).then((entries) => {
    itemImgMapByCat = {};
    itemListByCatForImg = {};
    entries.forEach(([catKey, list]) => {
      const idMap = {};
      list.forEach((it) => { if (it.img) idMap[it.id] = it.img; });
      itemImgMapByCat[catKey] = idMap;
      itemListByCatForImg[catKey] = list;
    });
    itemImgMapLoadingPromise = null;
    return itemImgMapByCat;
  });
  return itemImgMapLoadingPromise;
}
// view.js のmount()から一度だけ呼ぶ。読み込み完了後にonReadyを呼び、開いている
// 詳細モーダルがあれば再描画してノード画像を反映させる（元実装のloadItemEmoteMapsDeferredと
// 同じ「初期表示を邪魔しないアイドル時読み込み→完了後に開いている画面だけ更新」方針）。
export function ensureNodeImageMapsLoaded(onReady) {
  const run = () => loadItemImgMapForTree().then(() => { if (onReady) onReady(); });
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 3000 });
  else setTimeout(run, 1500);
}

function resolveNodeImgByName(n) {
  if (n.itemType === 'Emote') {
    const found = (n.itemNameJa && emoteByNameJa[n.itemNameJa]) || (n.itemName && emoteByNameEn[n.itemName]);
    if (found?.img) return found.img;
  }
  const catKeys = TYPE_TO_CATKEYS[n.itemType];
  if (catKeys && itemListByCatForImg) {
    for (const catKey of catKeys) {
      const list = itemListByCatForImg[catKey] || [];
      const found = list.find((it) => (n.itemNameJa && it.name === n.itemNameJa) || (n.itemName && it.nameEn === n.itemName));
      if (found?.img) return found.img;
    }
  }
  return null;
}
const QUEST_IMG = 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/8/8b/Exclamation-mark-Ray.png/revision/latest/scale-to-width-down/51';
export function resolveNodeImg(n) {
  if (n.itemCatKey && n.itemCostId && itemImgMapByCat) {
    const img = itemImgMapByCat[n.itemCatKey]?.[n.itemCostId];
    if (img) return img;
  }
  if (n.emoteId && emoteImgMap[n.emoteId]) return emoteImgMap[n.emoteId];
  if (n.itemNameJa && GENERIC_ITEM_IMG[n.itemNameJa]) return GENERIC_ITEM_IMG[n.itemNameJa];
  if (n.itemName && GENERIC_ITEM_IMG[n.itemName]) return GENERIC_ITEM_IMG[n.itemName];
  const byName = resolveNodeImgByName(n);
  if (byName) return byName;
  if (isWarpNode(n)) return GENERIC_ITEM_IMG['Warp'];
  if (isQuestNode(n)) return QUEST_IMG;
  return null;
}

function nodeCostSum(n) {
  const cost = n.cost || {};
  return Object.keys(cost).reduce((sum, k) => sum + (cost[k] || 0), 0);
}
// 「コスト違いバリエーション」「エモートのレベル違いバリエーション」判定バッジ（表示専用）
export function getCostTierBadge(spirit, node) {
  if (!spirit) return null;
  if (node.itemType === 'Emote') {
    if (node.emoteId == null || node.emoteLevel == null) return null;
    const group = spirit.nodes.filter((n) => n.itemType === 'Emote' && n.emoteId === node.emoteId);
    if (group.length < 2) return null;
    return { n: node.emoteLevel, total: group.length, mode: 'emote' };
  }
  // 恒常精霊のケープは「ティア1」「ティア2」の2段階で、item（アイテム所持管理）でも別のアイテム
  // （ケープ／ケープ2、itemCostIdが別）として管理されている。そのため下の「同じitemCostId」判定には
  // 掛からないので、同じ精霊のケープノードをコストの安い順に1始まりの段番号にして返す（mode: 'cape'）。
  // （以前は両ノードが同じitemCostIdに紐づいていたため下の判定で拾えていたが、それ自体が
  // 「片方を解放するともう片方も解放される」不具合の原因だった。）
  const isRegularCape = spirit.type === 'Regular' && node.itemType === 'Cape';
  if (!isRegularCape && (!node.itemCostId || !node.itemType)) return null;
  const group = isRegularCape
    ? spirit.nodes.filter((n) => n.itemType === 'Cape')
    : spirit.nodes.filter((n) => n.itemCostId === node.itemCostId && n.itemType === node.itemType);
  if (group.length < 2) return null;
  const sorted = group.slice().sort((a, b) => nodeCostSum(a) - nodeCostSum(b) || (a.guid < b.guid ? -1 : 1));
  const idx = sorted.findIndex((n) => n.guid === node.guid);
  if (idx === -1) return null;
  return { n: idx + 1, total: sorted.length, mode: isRegularCape ? 'cape' : 'cost' };
}

/* ================================================================
   コスト表示（テスト機能・既定オフ）: 残りコスト集計
   ================================================================ */
export const COST_DISPLAY_KEY = 'sky_catalog_cost_display_enabled';
export function getCostDisplayEnabled() {
  try { return localStorage.getItem(COST_DISPLAY_KEY) === '1'; } catch (_) { return false; }
}
export function setCostDisplayEnabled(on) {
  try { localStorage.setItem(COST_DISPLAY_KEY, on ? '1' : '0'); } catch (_) { /* noop */ }
}
export const COST_ICON = { c: 'i-candle', h: 'i-heart', sc: 'i-candle', sh: 'i-heart', ac: 'i-star-candle', ec: 'sc-i-ticket' };
export function sumRemainingCost(list) {
  const totals = {};
  list.forEach((s) => {
    s.nodes.forEach((n) => {
      if (isChecklistExcludedNode(n)) return;
      if (isNodeUnlocked(n)) return;
      Object.keys(n.cost || {}).forEach((k) => { totals[k] = (totals[k] || 0) + (n.cost[k] || 0); });
    });
  });
  return totals;
}

/* ================================================================
   🕊️ 再訪カウントダウン（item/data/season-data.js のREVISIT_SPIRIT_
   SCHEDULESを直接importして使う。固有名詞は特定できないため、開催有無・
   タイミングのみを算出する — 元実装のpfDashRevisitStatus/
   pfDashPickRevisitStatus/pfDashCountdownと同じ計算式）。
   ================================================================ */
function revisitScheduleStatus(schedule) {
  const now = new Date();
  if (schedule.intervalDays) {
    if (!schedule.anchorStart || !schedule.anchorEnd) return null;
    const start0 = new Date(schedule.anchorStart);
    const end0 = new Date(schedule.anchorEnd);
    const intervalMs = schedule.intervalDays * 86400000;
    const k = Math.floor((now - start0) / intervalMs);
    const start = new Date(start0.getTime() + k * intervalMs);
    const end = new Date(start.getTime() + (end0 - start0));
    if (start <= now && now <= end) return { active: true, target: end };
    const nextStart = now < start ? start : new Date(start.getTime() + intervalMs);
    return { active: false, target: nextStart };
  }
  if (!schedule.start || !schedule.end) return null;
  const start = new Date(schedule.start);
  const end = new Date(schedule.end);
  if (start <= now && now <= end) return { active: true, target: end };
  if (now < start) return { active: false, target: start };
  return null;
}
export function pickRevisitStatus() {
  const statuses = REVISIT_SPIRIT_SCHEDULES.map(revisitScheduleStatus).filter(Boolean);
  const active = statuses.filter((s) => s.active);
  if (active.length) return active.sort((a, b) => a.target - b.target)[0];
  const upcoming = statuses.filter((s) => !s.active);
  return upcoming.length ? upcoming.sort((a, b) => a.target - b.target)[0] : null;
}
export function formatCountdown(target) {
  const ms = target - new Date();
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hh = String(Math.floor((totalSec % 86400) / 3600)).padStart(2, '0');
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return days > 0 ? `${days}${t('revisitBadge.dayUnit')} ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}

/* ================================================================
   グループ分け（エリア別／シーズン別ビュー）
   ================================================================ */
export function computeGroups(mode, list) {
  const order = [];
  const bucket = new Map();
  const pushKey = (k) => { if (!bucket.has(k)) { bucket.set(k, []); order.push(k); } };
  if (mode === 'area') {
    AREA_GROUP_ORDER.forEach(pushKey);
    list.forEach((s) => { const k = spiritRealmKey(s); pushKey(k); bucket.get(k).push(s); });
  } else {
    const seasonsInData = [...new Set(SPIRIT_TREE_DATA.filter((s) => s.season).map((s) => s.season))];
    seasonsInData.forEach(pushKey);
    pushKey(NO_SEASON_KEY);
    list.forEach((s) => { const k = spiritSeasonKey(s); pushKey(k); bucket.get(k).push(s); });
  }
  return order.filter((k) => bucket.get(k).length > 0).map((k) => ({ key: k, spirits: bucket.get(k) }));
}

/* ================================================================
   📊 精霊ツリー全体の達成状況（spirit-catalog-share.jsの画像共有カード用。
   renderStats()と同じ考え方だが、通貨集計を含まない軽量版。元実装の
   getSpiritStats()を移植）
   ================================================================ */
export function getSpiritStats() {
  let totalNodes = 0, doneNodes = 0, completeSpirits = 0;
  SPIRIT_TREE_DATA.forEach((s) => {
    let spiritDone = 0, spiritTotal = 0;
    s.nodes.forEach((n) => {
      if (isChecklistExcludedNode(n)) return;
      totalNodes++; spiritTotal++;
      if (isNodeUnlocked(n)) { doneNodes++; spiritDone++; }
    });
    if (spiritDone === spiritTotal && spiritTotal > 0) completeSpirits++;
  });
  const pct = totalNodes > 0 ? (doneNodes / totalNodes) * 100 : 0;
  return { doneNodes, totalNodes, completeSpirits, totalSpirits: SPIRIT_TREE_DATA.length, pct };
}

/* ================================================================
   📤 達成率シェア画像のカスタマイズ設定 — catalogShareCustomize_v1
   （非namespace化。元実装もnsKey()を通さず端末単位のプレーンキーとして
   保存している。features/wings/wings-state.jsのSHARE_THEMES/
   loadShareCustomize/saveShareCustomizeと同じ設計・移植方針）
   ================================================================ */
const SHARE_CUSTOMIZE_KEY = 'catalogShareCustomize_v1';
export const SHARE_THEMES = {
  green: { grad: 'linear-gradient(135deg, #248A3D 0%, #34C759 55%, #8BE28B 100%)' },
  orange: { grad: 'linear-gradient(135deg, #C56E06 0%, #FF9500 55%, #FFBB00 100%)' },
  blue: { grad: 'linear-gradient(135deg, #0051A8 0%, #007AFF 55%, #5AC8FA 100%)' },
  purple: { grad: 'linear-gradient(135deg, #4B2E83 0%, #7B4FCB 55%, #B98CFF 100%)' },
  pink: { grad: 'linear-gradient(135deg, #B0184D 0%, #FF2D78 55%, #FF8FB3 100%)' },
  dark: { grad: 'linear-gradient(135deg, #05070d 0%, #1b2333 100%)' },
};
export function loadShareCustomize() {
  try {
    const d = JSON.parse(localStorage.getItem(SHARE_CUSTOMIZE_KEY));
    return { theme: (d && d.theme && SHARE_THEMES[d.theme]) ? d.theme : 'green' };
  } catch (_) {
    return { theme: 'green' };
  }
}
export function saveShareCustomize(theme) {
  localStorage.setItem(SHARE_CUSTOMIZE_KEY, JSON.stringify({ theme }));
}

/* nsKeyFor/getActiveProfileId を再exportしておく（view側で直接使うことがあるため） */
export { nsKeyFor, getActiveProfileId };

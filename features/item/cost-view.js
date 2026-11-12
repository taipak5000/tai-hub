/* ================================================================
   cost-view.js — アイテム別コスト（所持済みアイテムの入手コスト集計）

   item/item_cost.html を tai-hub の SPA アーキテクチャへ移植したもの。
   所持状態は他のitem機能と同じく js/state.js の getCategoryState() を
   通して読む（gameItems_<cat> のキー名・形状は完全互換、直接
   localStorageを読み書きしない）。価格テーブルは data/cost-data.js
   （item/cost-data.js を verbatim移植）、画像URLは各カテゴリの
   data/items/<cat>.js を動的importして補う（元実装は各カテゴリページ
   本体をfetch+正規表現でITEMS_DATAを抜き出していたが、SPA化に伴い
   直接importに置き換えている——元のCLAUDE.md方針とは無関係の、
   tai-hub移植時の意図的なアーキテクチャ改善）。

   楽譜（music_sheet）はカテゴリ形状が異なり今回のダッシュボード同様に
   スコープ外のため、このコスト集計にも合流させない。

   画像共有（Xへ投稿）4種は cost-share.js、季節見出しのペンダント画像は
   data/season-pendant-icons.js に分けてある。楽譜（music_sheet）は他の12カテゴリと
   同じ形のアイテムに変換して、このコスト集計に合流させている（元実装と同じ）。
   ================================================================ */

import { CURRENT_LANG, trEvent, trSource, trCat, trItem, escapeHtml } from '../../js/i18n.js';
import { getCategoryState, isWishItem, toggleWishItem, nsKey, getItemAcquireLog } from '../../js/state.js';
import { CATEGORY_REGISTRY } from './data/categories.js';
import { ITEM_COST_DATA } from './data/cost-data.js';
import { MUSIC_SHEETS, CAT_KEY as MUSIC_SHEET_CAT_KEY } from './data/music-sheets-data.js';
import { seasonPendantIconHtml } from './data/season-pendant-icons.js';
import * as costShare from './cost-share.js';
import { appendItemFooter } from './item-footer.js';
import { checkAndUnlockTitles } from './titles-panel.js';

const STYLE_ID = 'item-cost-view-styles';

// 12種のウェアラブルカテゴリのみ（section:'special' の music_sheet は対象外）
const GRID_CATEGORIES = CATEGORY_REGISTRY.filter(c => c.section === 'grid');
const CAT_LABEL_MAP = Object.fromEntries(GRID_CATEGORIES.map(c => [c.key, c.name]));
CAT_LABEL_MAP[MUSIC_SHEET_CAT_KEY] = '楽譜';

function t(ja, en) { return CURRENT_LANG === 'en' ? en : ja; }

/* ================================================================
   季節の実装順・日々の年間開催順（item/item_cost.html の
   SEASON_ORDER / DAY_ORDER を verbatim移植）
   ================================================================ */
const SEASON_ORDER = [
  '感謝の季節', '光の探求者の季節', '想いを編む季節', 'リズムが弾ける季節', '魔法の季節',
  '楽園の季節', '預言者の季節', '夢かなう季節', '大樹に集う季節', '星の王子さまの季節',
  '羽ばたく季節', '深淵の季節', '表現者たちの季節', '砕ケル闇ノ季節', 'AURORAの季節',
  '追慕の季節', 'ならいの季節', '瞬きの季節', '復古の季節', '九色の鹿の季節',
  '巣づくりの季節', '重なる音色の季節', 'ムーミンの季節', '光に染まる季節', '青い鳥の季節',
  'ふたつの灯火の季節　前編', '渡りの季節', '光の修繕者の季節', 'カーニバルの季節', '親愛なるファン・ゴッホへ', '遥かなる真珠の季節',
];
const DAY_ORDER = [
  '来福の日々', '花笑む日々', '自然の日々', '彩なす日々', 'Skyアニバーサリー',
  '陽光の日々', '月灯りの日々', 'いたずらな日々', '聖なる星の日々', '愛しみの日々',
  '宝探しの日々', 'お洒落な日々', '音楽の日々', '凱旋の大競技会',
];

// キャンドルパック（常時ショップ）。item/item_cost.html の CANDLE_PACKS と同一。
const CANDLE_PACKS = [
  { key: 'p650', price: 650, candles: 15 },
  { key: 'p1300', price: 1300, candles: 35 },
  { key: 'p2600', price: 2600, candles: 72 },
  { key: 'p6600', price: 6600, candles: 190 },
];
function candlePackByKey(key) { return CANDLE_PACKS.find(p => p.key === key); }

// ギフトパスは単体の課金プロダクト（カテゴリ横断の疑似アイテム）。
const GIFT_PASS_CAT_KEY = 'giftpass';
const GIFT_PASS_ITEM = { id: 'gift_pass', name: 'ギフトパス', nameEn: 'Gift Pass', cost: { type: 'money', value: 867 } };
function getGiftPickableItems(catKey) {
  if (catKey === GIFT_PASS_CAT_KEY) return [GIFT_PASS_ITEM];
  return (ITEM_COST_DATA[catKey] || []).filter(it => it.cost && it.cost.type === 'money');
}
function getGiftPickableItem(catKey, itemId) {
  if (catKey === GIFT_PASS_CAT_KEY) return itemId === GIFT_PASS_ITEM.id ? GIFT_PASS_ITEM : null;
  return (ITEM_COST_DATA[catKey] || []).find(i => i.id === itemId);
}

// 手書きの小さいインラインSVGアイコン（共有スプライト js/icon-sprite.js に
// 無いものだけ）。他ページは他エージェントが並行編集中のため、共有ファイル
// (icon-sprite.js) は変更せずページ内だけで完結させる。
const ICON_CHEVRON = '<svg width="12" height="12" viewBox="0 0 24 24" style="stroke:currentColor;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;vertical-align:-1px"><path d="M9 6l6 6-6 6"/></svg>';
const ICON_GIFT = '<svg width="16" height="16" viewBox="0 0 24 24" style="stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-3px"><path d="M4 9h16v3H4Z"/><path d="M5 12h14v8H5Z"/><path d="M12 9v11"/><path d="M9 9c-1.3 0-2.3-.9-2.3-2S7.7 5 9 5c1.3 0 3 1.7 3 4M15 9c1.3 0 2.3-.9 2.3-2S16.3 5 15 5c-1.3 0-3 1.7-3 4"/></svg>';
const ICON_WALLET = '<svg width="14" height="14" viewBox="0 0 24 24" style="stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-2px"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="16.5" cy="13.5" r="1" fill="currentColor" stroke="none"/></svg>';
const ICON_TICKET = '<svg width="14" height="14" viewBox="0 0 24 24" style="stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-2px"><path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.3a1.5 1.5 0 0 0 0 3.4V15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.3a1.5 1.5 0 0 0 0-3.4Z"/></svg>';

/* ================================================================
   保存キー。すべて item/item_cost.html 内の定義と完全に同じ「生の
   キー名文字列」を js/state.js の nsKey() でラップして使う
   （nsKey/nsKeyFor はこのモジュールのグローバルではなく named import
   のため、元のコードのような裸の nsKey() 呼び出しは使えない——
   関数化して呼び出し毎に nsKey() を通す）。
   ================================================================ */
const seasonAcquireKey = () => nsKey('seasonAcquireMode_v1');
const moneyAcquireKey = () => nsKey('moneyAcquireMode_v1');
const candleMoneyKey = () => nsKey('candleMoneyMode_v1');
const giftHistoryKey = () => nsKey('giftHistory_v1');
const giftDisplayModeKey = () => nsKey('giftDisplayMode_v1');
const candlePurchaseKey = () => nsKey('candlePurchaseLog_v1');
const candleDisplayModeKey = () => nsKey('candleDisplayMode_v1');
const itemQuantityKey = () => nsKey('itemQuantity_v1');
// item/profiles.js 側の称号ハイウォーターマーク集計が読む「直近の実額合計」。
// 称号UI自体はtai-hubに未移植だが、キー・形状だけは互換のため書き続ける。
const moneySpentKey = () => nsKey('itemCostMoneySum_v1');

function loadSeasonAcquireMap() {
  try { return JSON.parse(localStorage.getItem(seasonAcquireKey())) || {}; } catch (_) { return {}; }
}
function saveSeasonAcquireMap(map) { localStorage.setItem(seasonAcquireKey(), JSON.stringify(map)); }

function loadMoneyAcquireMap() {
  try { return JSON.parse(localStorage.getItem(moneyAcquireKey())) || {}; } catch (_) { return {}; }
}
function saveMoneyAcquireMap(map) { localStorage.setItem(moneyAcquireKey(), JSON.stringify(map)); }

function loadCandleMoneyMap() {
  try { return JSON.parse(localStorage.getItem(candleMoneyKey())) || {}; } catch (_) { return {}; }
}
function saveCandleMoneyMap(map) { localStorage.setItem(candleMoneyKey(), JSON.stringify(map)); }

function loadGiftHistory() {
  try { return JSON.parse(localStorage.getItem(giftHistoryKey())) || []; } catch (_) { return []; }
}
function saveGiftHistory(list) { localStorage.setItem(giftHistoryKey(), JSON.stringify(list)); }

function loadGiftDisplayMode() {
  const v = localStorage.getItem(giftDisplayModeKey());
  return v === 'separate' ? 'separate' : 'combined';
}

function loadCandlePurchases() {
  try { return JSON.parse(localStorage.getItem(candlePurchaseKey())) || []; } catch (_) { return []; }
}
function saveCandlePurchases(list) { localStorage.setItem(candlePurchaseKey(), JSON.stringify(list)); }

function loadCandleDisplayMode() {
  const v = localStorage.getItem(candleDisplayModeKey());
  return v === 'separate' ? 'separate' : 'combined';
}

// 📦 大きい設置アイテム／小さい設置アイテムの所持数（item/item_cost.html の
// ITEM_QUANTITY_KEY 相当）。同じアイテムを複数個設置できるこの2カテゴリに
// 限り、所持済みアイテムの個数を任意で記録できるようにする。
const QUANTITY_ELIGIBLE_CATS = ['large_placeable', 'small_placeable'];
function loadItemQuantityMap() {
  try { return JSON.parse(localStorage.getItem(itemQuantityKey())) || {}; } catch (_) { return {}; }
}
function saveItemQuantityMap(map) { localStorage.setItem(itemQuantityKey(), JSON.stringify(map)); }

// source文字列（例:「感謝の季節（季節精霊・過去）」）から季節/イベント名部分だけを取り出す
function extractSource(source) {
  const m = /^([^（(]+)/.exec(source || '');
  return m ? m[1].trim() : source;
}

/* ================================================================
   モジュール内状態
   ================================================================ */
let hostEl = null;
let mountToken = 0;
let toastTimers = [];

// 各カテゴリの data/items/<catKey>.js は画像URL補完専用（価格・名前・source
// は ITEM_COST_DATA が一次データ）。一度読み込んだPromiseはモジュールレベルで
// キャッシュし、他のitem機能ビューとの往復でも読み直さない。
const itemModuleCache = new Map();
function loadCategoryItemsModule(catKey) {
  if (!itemModuleCache.has(catKey)) {
    itemModuleCache.set(catKey, import(`./data/items/${catKey}.js`));
  }
  return itemModuleCache.get(catKey);
}
let itemImagesByCat = {};
let itemImagesLoadedPromise = null;
function loadAllItemImages() {
  if (itemImagesLoadedPromise) return itemImagesLoadedPromise;
  itemImagesLoadedPromise = Promise.all(GRID_CATEGORIES.map(async cat => {
    try {
      const mod = await loadCategoryItemsModule(cat.key);
      const map = {};
      (mod.ITEMS || []).forEach(it => { if (it.img) map[it.id] = it.img; });
      return [cat.key, map];
    } catch (e) {
      console.error(`[item cost] failed to load item images: ${cat.key}`, e);
      return [cat.key, {}];
    }
  })).then(entries => {
    itemImagesByCat = Object.fromEntries(entries);
    return itemImagesByCat;
  });
  return itemImagesLoadedPromise;
}

/* ================================================================
   全アイテムの構築（item/item_cost.html の getAllItems() 相当）
   ================================================================ */
function computeAllItems() {
  const all = [];
  GRID_CATEGORIES.forEach(cat => {
    const catKey = cat.key;
    const { owned } = getCategoryState(catKey);
    const imgMap = itemImagesByCat[catKey] || {};
    (ITEM_COST_DATA[catKey] || []).forEach(item => {
      all.push({ ...item, owned: !!owned[item.id], catKey, img: imgMap[item.id] });
    });
  });

  // 🎼 楽譜（Music Sheets）：他の12カテゴリと全く同じ形（cost/owned/catKey）に変換して合流させる。
  // price（キャンドル価格）がnull＝Wiki未記載の楽譜はcost.type='unknown'扱い（他カテゴリの
  // 価格不明アイテムと同じ扱いで、集計からは自然に除外される）
  const musicOwned = getCategoryState(MUSIC_SHEET_CAT_KEY).owned;
  MUSIC_SHEETS.forEach(s => {
    all.push({
      id: s.id, name: s.name, nameEn: s.nameEn, source: s.season,
      cost: typeof s.price === 'number'
        ? { type: 'candle', value: s.price, note: s.note, noteEn: s.noteEn }
        : { type: 'unknown', note: s.note, noteEn: s.noteEn },
      dye: false, catKey: MUSIC_SHEET_CAT_KEY,
      owned: !!musicOwned[s.id], img: s.img,
    });
  });

  // 季節のペンダント（ネックレスの季節アルティメットギフト）を所持している季節を集計
  const pendantOwnedSeasons = new Set();
  all.forEach(item => {
    if (item.catKey === 'necklace' && item.name.includes('ペンダント') && item.owned) {
      pendantOwnedSeasons.add(extractSource(item.source));
    }
  });

  const acquireMap = loadSeasonAcquireMap();
  const acquireEligibleTypes = ['candle', 'starCandle', 'heart'];
  const moneyAcquireMap = loadMoneyAcquireMap();
  const candleMoneyMap = loadCandleMoneyMap();
  const quantityMap = loadItemQuantityMap();
  all.forEach(item => {
    item.seasonPendantOwned = !item.revisitOnly && pendantOwnedSeasons.has(extractSource(item.source)) && acquireEligibleTypes.includes(item.cost.type);
    item.isTicketItem = item.cost.type === 'ticket';
    item.acquireMode = acquireMap[item.id] || (item.isTicketItem ? 'ticket' : 'revisit');
    item.moneyAcquireMode = item.cost.type === 'money' ? (moneyAcquireMap[item.id] || 'self') : null;
    const candleEntry = (item.cost.type === 'candle' || item.cost.type === 'starCandle') ? candleMoneyMap[item.id] : null;
    item.candleMoneyMode = candleEntry ? (candleEntry.mode || 'normal') : 'normal';
    item.candleMoneyYen = candleEntry ? (candleEntry.yen || 0) : 0;
    // 大きい/小さい設置アイテムに限り所持数を扱う（未設定時は1個）
    item.quantityEligible = QUANTITY_ELIGIBLE_CATS.includes(item.catKey);
    item.quantity = item.quantityEligible ? (quantityMap[item.id] || 1) : 1;
  });

  return all;
}

// quantity（所持数）はコストが確定しているtype（candle/starCandle/heart/money）にのみ
// 乗算を反映する。ticket/na/unknownはそもそも確定した数値が無いため、quantityを渡しても
// 表示は変わらない（個数自体は呼び出し側の所持数入力欄で別途わかる）。
function costHtml(cost, quantity) {
  const en = CURRENT_LANG === 'en';
  if (!cost) return en ? 'Unknown' : '不明';
  const qty = (quantity && quantity > 1) ? quantity : 1;
  const withQty = (iconTag, unit) => {
    if (qty > 1 && cost.value > 0) {
      const total = cost.value * qty;
      return `${iconTag} ${total.toLocaleString()}${en ? '' : unit}<span class="cost-qty-note">(${cost.value.toLocaleString()}${en ? '' : unit}×${qty})</span>`;
    }
    return `${iconTag} ${cost.value}${en ? '' : unit}`;
  };
  if (cost.type === 'candle') return withQty('<svg class="inline-icon" width="15" height="15"><use href="#i-candle"/></svg>', '本');
  if (cost.type === 'starCandle') return withQty('<svg class="inline-icon" width="15" height="15"><use href="#i-star"/></svg>', '本');
  if (cost.type === 'heart') return withQty('<svg class="inline-icon" width="15" height="15"><use href="#i-heart"/></svg>', '個');
  if (cost.type === 'money') {
    if (qty > 1 && cost.value > 0) {
      const total = cost.value * qty;
      return `¥${total.toLocaleString()}<span class="cost-qty-note">(¥${cost.value.toLocaleString()}×${qty})</span>`;
    }
    return `¥${cost.value.toLocaleString()}`;
  }
  // 季節キャンドルの価格（季節の開催中の価格。キャンドル・星のキャンドルとは別の通貨なので、合計には入れない）
  if (cost.type === 'seasonCandle') return `<svg class="inline-icon" width="15" height="15"><use href="#i-star-candle"/></svg> ${en ? `${cost.value} Season Candles` : `季節キャンドル ${cost.value}本`}`;
  // 季節パスの報酬・精霊ツリーで無料（価格が無いことが分かっているもの。合計には入れない）
  if (cost.type === 'reward') return en ? 'Season Pass reward' : '報酬';
  if (cost.type === 'free') return en ? 'Free' : '無料';
  if (cost.type === 'na') return en ? 'N/A' : '対象外';
  if (cost.type === 'ticket') return en ? 'Ticket Exchange' : 'チケット交換';
  return en ? 'Unknown' : '不明';
}

/* ================================================================
   一覧の1行（タスク3・4・7）
   通常は「サムネイル・名前・価格・ウィッシュリスト」だけを出し、出典の全文・注釈・バッジ・
   入手経緯の切替・入力欄は行を押した時の詳細（アコーディオン）に入れる。詳細の中身は開いた
   行だけ描く（1,280件ぶんの切替UIを常に持たないため）。開いている行は openItems に覚えておき、
   切替操作で一覧を描き直しても開いたままにする（保存はしない）。
   ================================================================ */
const openItems = new Set();     // 詳細を開いている行（itemKey）
let itemsByKey = new Map();      // 直近の computeAllItems() の結果（行の開閉だけで一覧を作り直さないため）
function itemKey(item) { return `${item.catKey}/${item.id}`; }
function domSafe(key) { return key.replace(/[^A-Za-z0-9_-]/g, '_'); }

// 一覧の価格列に出す通貨（数値＋アイコン＋単位。季節キャンドルは合計外だが数値として揃えて出す）
const PRICE_CURRENCIES = {
  candle: { icon: 'i-candle', unit: '本' },
  starCandle: { icon: 'i-star', unit: '本' },
  heart: { icon: 'i-heart', unit: '個' },
  seasonCandle: { icon: 'i-star-candle', unit: '本' },
};
// 数値でない価格は小さなグレーのピルにする（数値の列の揃いを崩さない）
function pricePillLabel(type) {
  const en = CURRENT_LANG === 'en';
  if (type === 'reward') return en ? 'Pass reward' : '報酬';
  if (type === 'free') return en ? 'Free' : '無料';
  if (type === 'na') return en ? 'N/A' : '対象外';
  if (type === 'ticket') return en ? 'Ticket' : 'チケット交換';
  return en ? 'Unknown' : '不明';
}
// 行の価格（所持数が2以上なら合計だけを出す。単価×個数の内訳は詳細の costHtml() で出す）
function priceCellHtml(cost, quantity) {
  const en = CURRENT_LANG === 'en';
  if (!cost) return `<span class="cost-pill">${pricePillLabel('unknown')}</span>`;
  const qty = (quantity && quantity > 1) ? quantity : 1;
  if (cost.type === 'money' && typeof cost.value === 'number') {
    const v = cost.value > 0 ? cost.value * qty : cost.value;
    return `<span class="cost-price money"><span class="cost-price-num">¥${v.toLocaleString()}</span></span>`;
  }
  const cur = PRICE_CURRENCIES[cost.type];
  if (cur && typeof cost.value === 'number') {
    const v = (cost.type !== 'seasonCandle' && cost.value > 0) ? cost.value * qty : cost.value;
    return `<span class="cost-price cur-${cost.type}"><svg class="inline-icon" width="14" height="14"><use href="#${cur.icon}"/></svg><span class="cost-price-num">${v.toLocaleString()}</span>${en ? '' : `<span class="cost-price-unit">${cur.unit}</span>`}</span>`;
  }
  return `<span class="cost-pill">${pricePillLabel(cost.type)}</span>`;
}

// 注釈の短縮形（タスク4）。全文は詳細に1回だけ出す。判定は注釈文（日本語）の文字列で行い、データは変えない。
// 価格の種類をそのまま説明しているだけの定型文（報酬・チケット・究極の贈り物など）は、価格のピルで分かるので行には出さない。
const NOTE_BADGES = [
  [/シーズンパス、¥1300相当）の購入が前提/, () => ['パス代¥1,300込', 'Incl. ¥1,300 pass']],
  [/^最大(\d+)個まで購入可/, m => [`最大${m[1]}個`, `Max ${m[1]}`]],
  [/とのセット価格です/, () => ['セット価格', 'Bundle price']],
  [/再訪した時のキャンドル価格は未確認/, () => ['再訪価格は未確認', 'Revisit price TBD']],
  [/アドベンチャーパス（ペンダント）を購入していれば/, () => ['パス所持で無料', 'Free with pass']],
  [/未確認/, () => ['未確認', 'Unconfirmed']],
];
const NOTE_SILENT = [
  /究極の贈り物」のため/, /での交換アイテムです（キャンドル等の通常価格はありません）/, /季節パス（アドベンチャーパス）の報酬で/,
  /精霊ツリーで無料で受け取れる/, /完全無料アイテム/, /星のキャンドルでの価格です/, /無償配布されたアイテム/, /^元表記は/, /App Store価格帯換算/,
];
function noteBadgeText(noteJa) {
  if (!noteJa) return '';
  for (const [re, fn] of NOTE_BADGES) {
    const m = re.exec(noteJa);
    if (m) { const [ja, en] = fn(m); return t(ja, en); }
  }
  if (NOTE_SILENT.some(re => re.test(noteJa))) return '';
  return t('※注釈あり', '※ Note');
}

// 行に出す出典。グループ見出しと同じ季節・日々名は省き、「季節精霊・過去」のような種別だけを残す
function shortSourceText(source, groupName) {
  const m = /^([^（(]+)(?:[（(](.+)[）)])?$/.exec(source || '');
  if (m && groupName && m[1].trim() === groupName) {
    if (!m[2]) return '';
    return CURRENT_LANG === 'en' ? trEvent(m[2].trim()) : m[2].trim();
  }
  return trSource(source || '');
}
function catLabelOf(catKey) {
  return catKey === MUSIC_SHEET_CAT_KEY ? t('楽譜', 'Music Sheets') : trCat(CAT_LABEL_MAP[catKey] || catKey);
}

// 行に出す価格（従来の renderItemCard と同じ決め方：チケットの復刻入手は復刻の価格、季節中入手は0）
function rowDisplayCost(item) {
  if (item.owned && item.isTicketItem) {
    return item.acquireMode === 'revisit' ? (item.revisitCost || { type: 'unknown' }) : item.cost;
  }
  const isFree = item.owned && item.seasonPendantOwned && item.acquireMode === 'inSeason';
  return isFree ? { ...item.cost, value: 0 } : item.cost;
}
function rowNoteObj(item) {
  return (item.owned && item.isTicketItem && item.acquireMode === 'revisit') ? item.revisitCost : item.cost;
}

function toggleGroupHtml(labelJa, labelEn, buttonsHtml) {
  return `<div class="cost-acquire-group"><div class="cost-acquire-label">${t(labelJa, labelEn)}</div><div class="cost-acquire-toggle">${buttonsHtml}</div></div>`;
}
function acquireBtn(fk, active, free, onclick, inner) {
  return `<button type="button" class="cost-acquire-btn ${active ? 'active' : ''} ${active && free ? 'free' : ''}" aria-pressed="${active}" data-fk="${fk}" onclick="${onclick}">${inner}</button>`;
}

// 詳細（行を押すと開く）。入手経緯の切替・入力欄の機能と保存先は従来どおり
function renderItemDetail(item) {
  const en = CURRENT_LANG === 'en';
  const key = itemKey(item);
  const owned = item.owned;
  const badges = [];
  if (owned) badges.push(`<span class="cost-item-badge owned">${t('所持済み', 'Owned')}</span>`);
  if (item.dye) badges.push(`<span class="cost-item-badge dye-yes">${t('染色〇', 'Dyeable')}</span>`);
  if (item.limited) badges.push(`<span class="cost-item-badge limited">${t('復刻なし', 'No Re-release')}</span>`);

  const showPendantToggle = owned && item.seasonPendantOwned;
  const showTicketToggle = owned && item.isTicketItem;
  let acquireToggleHtml = '';
  if (showTicketToggle) {
    const useRevisit = item.acquireMode === 'revisit';
    acquireToggleHtml = toggleGroupHtml('入手経緯', 'How obtained',
      acquireBtn(`${key}|ticket`, !useRevisit, true, `window.__costViewSetSeasonAcquire('${item.id}', 'ticket')`, `${ICON_TICKET} ${t('チケット（0）', 'Ticket (0)')}`)
      + acquireBtn(`${key}|revisit`, useRevisit, false, `window.__costViewSetSeasonAcquire('${item.id}', 'revisit')`, `<svg class="inline-icon" width="14" height="14"><use href="#i-sync"/></svg> ${t('復刻（復刻の価格）', 'Revisit (revisit price)')}`));
  } else if (showPendantToggle) {
    const isFree = item.acquireMode === 'inSeason';
    acquireToggleHtml = toggleGroupHtml('入手経緯', 'How obtained',
      acquireBtn(`${key}|inSeason`, isFree, true, `window.__costViewSetSeasonAcquire('${item.id}', 'inSeason')`, t('季節中（0）', 'In-season (0)'))
      + acquireBtn(`${key}|revisit`, !isFree, false, `window.__costViewSetSeasonAcquire('${item.id}', 'revisit')`, t('再訪（記載コスト）', 'Revisit (listed cost)')));
  }

  const moneyOriginToggleHtml = (owned && item.cost.type === 'money') ? toggleGroupHtml('支払い', 'Paid by',
    acquireBtn(`${key}|self`, item.moneyAcquireMode !== 'gift', false, `window.__costViewSetMoneyAcquire('${item.id}', 'self')`, `${ICON_WALLET} ${t('自分で購入', 'Bought it myself')}`)
    + acquireBtn(`${key}|gift`, item.moneyAcquireMode === 'gift', true, `window.__costViewSetMoneyAcquire('${item.id}', 'gift')`, `${ICON_GIFT} ${t('ギフトでもらった', 'Received as a gift')}`)) : '';

  const showCandleMoneyToggle = owned && (item.cost.type === 'candle' || item.cost.type === 'starCandle');
  const isPaidCandle = item.candleMoneyMode === 'paidCandle';
  const candleMoneyToggleHtml = showCandleMoneyToggle ? toggleGroupHtml('使ったキャンドル', 'Candles used',
    acquireBtn(`${key}|normal`, !isPaidCandle, false, `window.__costViewSetCandleMoneyMode('${item.id}', 'normal')`, `<svg class="inline-icon" width="14" height="14"><use href="#i-candle"/></svg> ${t('通常のキャンドル', 'Regular candles')}`)
    + acquireBtn(`${key}|paidCandle`, isPaidCandle, true, `window.__costViewSetCandleMoneyMode('${item.id}', 'paidCandle')`, `${ICON_WALLET} ${t('課金で買ったキャンドル', 'Paid candles')}`))
    + (isPaidCandle ? `
    <label class="cost-candle-money-input-row">
      <span>${t('実額に加算する金額：', 'Amount spent (added to real-money total):')}</span>
      <span>¥</span><input type="number" min="0" inputmode="numeric" class="cost-candle-money-input" data-fk="${key}|yen" value="${item.candleMoneyYen || ''}" placeholder="0" onchange="window.__costViewSetCandleMoneyYen('${item.id}', this.value)">
    </label>` : '') : '';

  const quantityRowHtml = (owned && item.quantityEligible) ? `
    <label class="cost-quantity-input-row">
      <span>${t('所持数：', 'Quantity owned:')}</span>
      <input type="number" min="1" step="1" inputmode="numeric" class="cost-quantity-input" data-fk="${key}|qty" value="${item.quantity}" onchange="window.__costViewSetItemQuantity('${item.id}', this.value)">
      ${item.quantity > 1 ? `<span class="cost-quantity-hint">${t('（一覧の価格に反映済み）', '(reflected in the listed cost)')}</span>` : ''}
    </label>` : '';

  const noteObj = rowNoteObj(item);
  const noteText = noteObj && (en ? (noteObj.noteEn || noteObj.note) : noteObj.note);
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(trItem(item) + '　Sky')}`;

  return `
    <dl class="cost-detail-list">
      <div><dt>${t('価格', 'Cost')}</dt><dd class="cost-detail-cost">${costHtml(rowDisplayCost(item), item.quantity)}</dd></div>
      <div><dt>${t('入手方法', 'Source')}</dt><dd>${escapeHtml(trSource(item.source))}<span class="cost-detail-cat">${escapeHtml(catLabelOf(item.catKey))}</span></dd></div>
    </dl>
    ${noteText ? `<p class="cost-item-note">※ ${escapeHtml(noteText)}</p>` : ''}
    ${badges.length ? `<div class="cost-item-badges">${badges.join('')}</div>` : ''}
    ${acquireToggleHtml}
    ${moneyOriginToggleHtml}
    ${candleMoneyToggleHtml}
    ${quantityRowHtml}
    <a href="${searchUrl}" target="_blank" rel="noopener noreferrer" class="cost-detail-search"><svg class="inline-icon" width="14" height="14"><use href="#i-search"/></svg>${t('Googleで調べる', 'Search on Google')}</a>`;
}

function renderItemRow(item, groupName) {
  const key = itemKey(item);
  const domId = `costDet-${domSafe(key)}`;
  const isOpen = openItems.has(key);
  const owned = item.owned;
  const name = escapeHtml(trItem(item));
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(trItem(item) + '　Sky')}`;
  const sub = [catLabelOf(item.catKey), shortSourceText(item.source, groupName)].filter(Boolean).join(' · ');
  const badge = noteBadgeText((rowNoteObj(item) || {}).note);
  const wish = isWishItem(item.catKey, item.id);
  return `
    <div class="cost-row-wrap ${owned ? 'owned' : ''} ${isOpen ? 'open' : ''}" data-key="${key}">
      <div class="cost-row">
        <button type="button" class="cost-row-toggle" data-key="${key}" data-fk="${key}|row" aria-expanded="${isOpen}" aria-controls="${domId}"
          aria-label="${t(`${name} の詳細`, `Details: ${name}`)}" onclick="window.__costViewToggleRow(this.dataset.key)"></button>
        <div class="cost-item-thumb ${item.img ? '' : 'img-fallback'}">
          ${item.img ? `<img src="${item.img}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('img-fallback')">` : ''}
          <span class="cost-item-thumb-fallback"><svg class="inline-icon" width="18" height="18"><use href="#i-wing"/></svg></span>
          ${owned ? `<span class="cost-owned-mark"><svg class="inline-icon" width="10" height="10"><use href="#i-check"/></svg></span>` : ''}
        </div>
        <div class="cost-row-info">
          <a href="${searchUrl}" target="_blank" rel="noopener noreferrer" class="cost-item-name">${name}</a>
          <div class="cost-row-sub">${owned ? `<span class="cost-vh">${t('所持済み', 'Owned')}</span>` : ''}<span class="cost-row-src">${escapeHtml(sub)}</span>${badge ? `<span class="cost-note-badge">${escapeHtml(badge)}</span>` : ''}</div>
        </div>
        <div class="cost-row-price">${priceCellHtml(rowDisplayCost(item), item.quantity)}</div>
        <button type="button" class="cost-item-wish-btn ${wish ? 'is-wish' : ''}" aria-pressed="${wish}"
          onclick="window.__costViewToggleWish('${item.catKey}','${item.id}', this)"
          title="${t('ウィッシュリストに追加', 'Add to wishlist')}"
          aria-label="${t('ウィッシュリストに追加', 'Add to wishlist')}"><span class="cost-wish-dot"><svg class="inline-icon" width="15" height="15"><use href="#i-cart"/></svg></span></button>
      </div>
      ${isOpen ? `<div class="cost-row-detail" id="${domId}">${renderItemDetail(item)}</div>` : ''}
    </div>`;
}

// 行の開閉（一覧全体は描き直さず、その行の詳細だけを差し替える）
function toggleRow(key) {
  if (!hostEl) return;
  const wrap = hostEl.querySelector(`.cost-row-wrap[data-key="${CSS.escape(key)}"]`);
  const item = itemsByKey.get(key);
  if (!wrap || !item) return;
  const btn = wrap.querySelector('.cost-row-toggle');
  const willOpen = !openItems.has(key);
  const old = wrap.querySelector('.cost-row-detail');
  if (old) old.remove();
  if (willOpen) {
    openItems.add(key);
    wrap.insertAdjacentHTML('beforeend', `<div class="cost-row-detail anim-in" id="${btn.getAttribute('aria-controls')}">${renderItemDetail(item)}</div>`);
  } else {
    openItems.delete(key);
  }
  wrap.classList.toggle('open', willOpen);
  btn.setAttribute('aria-expanded', String(willOpen));
}

/* ================================================================
   一覧・集計の描画
   ================================================================ */
function setText(sel, text) {
  const el = hostEl && hostEl.querySelector(sel);
  if (el) el.textContent = text;
}
// サマリーの数値（単位は小さく添える。textContent は従来と同じ「1,234本」になるので共有画像の読み取りもそのまま）
function sumValueHtml(n, unit) {
  return `${n.toLocaleString()}${CURRENT_LANG === 'en' || !unit ? '' : `<span class="cost-unit">${unit}</span>`}`;
}
function setSumValues(suffix, candle, starCandle, heart, money) {
  if (!hostEl) return;
  const put = (key, html) => { const el = hostEl.querySelector(`#costSum${key}${suffix}`); if (el) el.innerHTML = html; };
  put('Candle', sumValueHtml(candle, '本'));
  put('StarCandle', sumValueHtml(starCandle, '本'));
  put('Heart', sumValueHtml(heart, '個'));
  put('Money', `¥${money.toLocaleString()}`);
}

/* ── 一覧の絞り込み・グループの開閉（画面の中だけの状態。保存はしない）── */
let ownFilter = 'all';            // 'all' | 'owned' | 'notOwned'
let searchQuery = '';
const collapsedGroups = new Set(); // 折りたたんだグループ（季節名・日々名・'__other'）
let searchTimer = null;

// 検索用の正規化（全角半角・大文字小文字・カタカナ/ひらがなの違いを無視する）
function normSearch(str) {
  return String(str || '').normalize('NFKC').toLowerCase()
    .replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

// グループ見出しの小計（0の通貨は省く）
function subtotalPartsHtml(c) {
  const parts = [];
  if (c.candle) parts.push(`<span><svg class="inline-icon" width="12" height="12"><use href="#i-candle"/></svg>${c.candle.toLocaleString()}</span>`);
  if (c.starCandle) parts.push(`<span><svg class="inline-icon" width="12" height="12"><use href="#i-star"/></svg>${c.starCandle.toLocaleString()}</span>`);
  if (c.heart) parts.push(`<span><svg class="inline-icon" width="12" height="12"><use href="#i-heart"/></svg>${c.heart.toLocaleString()}</span>`);
  if (c.money) parts.push(`<span class="is-money">¥${c.money.toLocaleString()}</span>`);
  return parts.join('');
}
function groupSubtotal(groupItems, ob, rb) {
  const own = { candle: 0, starCandle: 0, heart: 0, money: 0 };
  const rem = { candle: 0, starCandle: 0, heart: 0, money: 0 };
  groupItems.forEach(item => {
    const o = ob.per.get(item), r = rb.per.get(item);
    if (o) { own.candle += o.candle; own.starCandle += o.starCandle; own.heart += o.heart; own.money += o.money; }
    if (r) { rem.candle += r.candle; rem.starCandle += r.starCandle; rem.heart += r.heart; rem.money += r.money; }
  });
  return { own, rem };
}

function renderGroup(gid, gkey, iconHtml, label, groupItems, groupNameForRows, ob, rb) {
  const collapsed = collapsedGroups.has(gkey);
  const { own, rem } = groupSubtotal(groupItems, ob, rb);
  const ownHtml = subtotalPartsHtml(own), remHtml = subtotalPartsHtml(rem);
  const sub = (ownHtml ? `<span class="cost-sub-set"><span class="cost-sub-lbl">${t('所持', 'Spent')}</span>${ownHtml}</span>` : '')
    + (remHtml ? `<span class="cost-sub-set"><span class="cost-sub-lbl">${t('残り', 'Left')}</span>${remHtml}</span>` : '');
  return `
    <section class="cost-group" id="${gid}">
      <button type="button" class="cost-group-head" data-gkey="${escapeHtml(gkey)}" aria-expanded="${!collapsed}" aria-controls="${gid}-list"
        onclick="window.__costViewToggleGroup(this.dataset.gkey)">
        <span class="cost-group-top">
          <span class="cost-season-group-name"><span class="cost-group-chev">${ICON_CHEVRON}</span>${iconHtml} ${escapeHtml(label)}</span>
          <span class="cost-season-group-count">${groupItems.length}${t('件', ' items')}</span>
        </span>
        ${sub ? `<span class="cost-group-sub">${sub}</span>` : ''}
      </button>
      <div class="cost-group-list" id="${gid}-list" ${collapsed ? 'hidden' : ''} style="contain-intrinsic-size: auto ${groupItems.length * 61}px;">
        ${collapsed ? '' : groupItems.map(it => renderItemRow(it, groupNameForRows)).join('')}
      </div>
    </section>`;
}

function renderItems() {
  if (!hostEl) return;
  // 描き直しでフォーカスが外れないよう、操作中の要素（data-fk）を覚えておき、描き直した後に戻す
  const active = document.activeElement;
  const focusKey = active && hostEl.contains(active) && active.dataset ? active.dataset.fk : null;
  const allItems = computeAllItems();
  itemsByKey = new Map(allItems.map(it => [itemKey(it), it]));
  const ob = computeOwnedBreakdown(allItems);
  const rb = computeRemainBreakdown(allItems);

  const costTypeFilter = hostEl.querySelector('#costTypeFilter')?.value || 'all';
  const categoryFilter = hostEl.querySelector('#costCategoryFilter')?.value || 'all';
  const q = normSearch(searchQuery.trim());
  const items = allItems.filter(item => {
    if (ownFilter === 'owned' && !item.owned) return false;
    if (ownFilter === 'notOwned' && item.owned) return false;
    if (costTypeFilter !== 'all' && (!item.cost || item.cost.type !== costTypeFilter)) return false;
    if (categoryFilter !== 'all' && item.catKey !== categoryFilter) return false;
    if (q && !normSearch(item.name).includes(q) && !normSearch(item.nameEn).includes(q)) return false;
    return true;
  });

  // 季節 → 日々 → その他 の順にグループ化（カテゴリ分けはしない）
  const seasonGroups = {};
  const dayGroups = {};
  const otherItems = [];
  items.forEach(item => {
    const src = extractSource(item.source);
    if (SEASON_ORDER.includes(src)) (seasonGroups[src] = seasonGroups[src] || []).push(item);
    else if (DAY_ORDER.includes(src)) (dayGroups[src] = dayGroups[src] || []).push(item);
    else otherItems.push(item);
  });

  let html = '';
  let seasonOptions = '', dayOptions = '', otherOptions = '';
  let groupIndex = 0;
  const groupKeys = [];

  SEASON_ORDER.forEach(season => {
    if (!seasonGroups[season]) return;
    const gid = `costGrp-${groupIndex++}`;
    groupKeys.push(season);
    html += renderGroup(gid, season, seasonPendantIconHtml(season, 16, 'i-sparkle'), trEvent(season), seasonGroups[season], season, ob, rb);
    seasonOptions += `<option value="${gid}">${escapeHtml(trEvent(season))}（${seasonGroups[season].length}）</option>`;
  });
  DAY_ORDER.forEach(day => {
    if (!dayGroups[day]) return;
    const gid = `costGrp-${groupIndex++}`;
    groupKeys.push(day);
    html += renderGroup(gid, day, '<svg class="inline-icon" width="14" height="14"><use href="#i-sun"/></svg>', trEvent(day), dayGroups[day], day, ob, rb);
    dayOptions += `<option value="${gid}">${escapeHtml(trEvent(day))}（${dayGroups[day].length}）</option>`;
  });
  if (otherItems.length) {
    const gid = `costGrp-${groupIndex++}`;
    groupKeys.push('__other');
    html += renderGroup(gid, '__other', '<svg class="inline-icon" width="14" height="14"><use href="#i-sparkle"/></svg>',
      t('その他（パック・恒常精霊・ショップなど）', 'Other (Packs, Realm Spirits, Shops, etc.)'), otherItems, null, ob, rb);
    otherOptions = `<option value="${gid}">${t('その他', 'Other')}（${otherItems.length}）</option>`;
  }
  lastGroupKeys = groupKeys;

  if (!html) {
    html = `<div class="cost-notice-card cost-empty">${t('条件に一致するアイテムがありません。', 'No items match the current filter.')}`
      + (searchQuery.trim() ? `<button type="button" class="cost-clear-search-btn" onclick="window.__costViewClearSearch()">${t('検索をクリア', 'Clear search')}</button>` : '')
      + `</div>`;
  }

  const listEl = hostEl.querySelector('#costItemList');
  if (listEl) listEl.innerHTML = html;
  if (focusKey) {
    const again = hostEl.querySelector(`[data-fk="${CSS.escape(focusKey)}"]`);
    if (again) again.focus({ preventScroll: true });
  }

  const jumpSelect = hostEl.querySelector('#costJumpSelect');
  if (jumpSelect) {
    jumpSelect.innerHTML =
      `<option value="">${t('ジャンプ', 'Jump to')}</option>` +
      (seasonOptions ? `<optgroup label="${t('季節', 'Seasons')}">${seasonOptions}</optgroup>` : '') +
      (dayOptions ? `<optgroup label="${t('日々', 'Days')}">${dayOptions}</optgroup>` : '') +
      (otherOptions ? `<optgroup label="${t('その他', 'Other')}">${otherOptions}</optgroup>` : '');
  }
  updateFilterControls();

  renderSummary(allItems, ob);
  renderRemainingSummary(allItems, rb);
}

let lastGroupKeys = [];
function toggleGroup(gkey) {
  if (collapsedGroups.has(gkey)) collapsedGroups.delete(gkey); else collapsedGroups.add(gkey);
  renderItems();
}
// すべて折りたたむ／すべて開く
function toggleAllGroups() {
  const allCollapsed = lastGroupKeys.length > 0 && lastGroupKeys.every(k => collapsedGroups.has(k));
  if (allCollapsed) collapsedGroups.clear(); else lastGroupKeys.forEach(k => collapsedGroups.add(k));
  renderItems();
  const list = hostEl && hostEl.querySelector('#costItemList');
  if (list && list.getBoundingClientRect().top < 0) list.scrollIntoView({ block: 'start' });
}

function setOwnFilter(v) { ownFilter = ['owned', 'notOwned'].includes(v) ? v : 'all'; renderItems(); }
function onSearchInput(v) {
  searchQuery = v || '';
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => renderItems(), 120);
  const clr = hostEl && hostEl.querySelector('#costSearchClear');
  if (clr) clr.hidden = !searchQuery;
}
function clearSearch() {
  searchQuery = '';
  const input = hostEl && hostEl.querySelector('#costSearch');
  if (input) { input.value = ''; input.focus(); }
  renderItems();
}
function updateFilterControls() {
  if (!hostEl) return;
  hostEl.querySelectorAll('.cost-seg-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.own === ownFilter)));
  const clr = hostEl.querySelector('#costSearchClear');
  if (clr) clr.hidden = !searchQuery;
  const allBtn = hostEl.querySelector('#costToggleAllGroups');
  if (allBtn) {
    const allCollapsed = lastGroupKeys.length > 0 && lastGroupKeys.every(k => collapsedGroups.has(k));
    allBtn.textContent = allCollapsed ? t('すべて開く', 'Expand') : t('折りたたむ', 'Collapse');
    allBtn.setAttribute('aria-label', allCollapsed ? t('すべてのグループを開く', 'Expand all groups') : t('すべてのグループを折りたたむ', 'Collapse all groups'));
  }
}

function jumpToGroup(gid) {
  if (!gid || !hostEl) return;
  const el = hostEl.querySelector(`#${gid}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const jumpSelect = hostEl.querySelector('#costJumpSelect');
  if (jumpSelect) jumpSelect.value = '';
}

let lastOwnedCount = 0, lastTotalItemCount = 0; // 共有画像（コスト集計カード）用

// 所持済みアイテムの集計（従来の renderSummary() の判定をそのまま、アイテムごとの寄与として記録する）。
// 総計は寄与の和なので、季節ごとの小計（renderItems）を全部足すとサマリーのアイテム分と必ず一致する。
// セット価格は従来どおり、items の並び（カテゴリ順）で最初に数えたアイテムに1回分だけ付く。
function computeOwnedBreakdown(items) {
  const per = new Map();
  const r = { per, candle: 0, starCandle: 0, heart: 0, money: 0, ownedCount: 0, giftReceivedCount: 0, giftReceivedMoneySum: 0, paidCandleCount: 0, paidCandleMoneySum: 0 };
  const countedSetIds = new Set();
  items.forEach(item => {
    if (!item.owned) return;
    r.ownedCount++;
    const c = { candle: 0, starCandle: 0, heart: 0, money: 0 };
    per.set(item, c);
    if (item.seasonPendantOwned && item.acquireMode === 'inSeason') return; // 季節中入手扱いのためコスト計算から除外
    if (item.isTicketItem && item.acquireMode !== 'revisit') return; // チケットで入手扱い（0）のためコスト計算から除外
    const cost = item.isTicketItem ? (item.revisitCost || {}) : item.cost;
    // 大きい/小さい設置アイテムは所持数（未設定時は1）をコストに乗算して集計する
    const qty = item.quantity || 1;
    if (cost.type === 'candle' && typeof cost.value === 'number') c.candle += cost.value * qty;
    else if (cost.type === 'starCandle' && typeof cost.value === 'number') c.starCandle += cost.value * qty;
    else if (cost.type === 'heart' && typeof cost.value === 'number') c.heart += cost.value * qty;

    // 課金で購入したキャンドルで入手したと申告されたアイテムは、キャンドル本数の集計は変えず、
    // 申告された実額も別途「実額」の集計に加算する（この申告額は自己申告の合計額のため、
    // 所持数による乗算はしない）
    if ((cost.type === 'candle' || cost.type === 'starCandle') && item.candleMoneyMode === 'paidCandle' && item.candleMoneyYen > 0) {
      r.paidCandleCount++;
      r.paidCandleMoneySum += item.candleMoneyYen;
      c.money += item.candleMoneyYen;
    }
    if (cost.type === 'money' && typeof cost.value === 'number') {
      if (cost.setId) {
        if (countedSetIds.has(cost.setId)) return;
        countedSetIds.add(cost.setId);
      }
      if (item.moneyAcquireMode === 'gift') {
        r.giftReceivedCount++;
        r.giftReceivedMoneySum += cost.value * qty;
        return; // ギフトでもらった分は自分の課金額の集計から除外
      }
      c.money += cost.value * qty;
    }
  });
  per.forEach(c => { r.candle += c.candle; r.starCandle += c.starCandle; r.heart += c.heart; r.money += c.money; });
  return r;
}

// 未所持アイテムの集計（従来の renderRemainingSummary() と同じ判定。アイテムごとの寄与も記録する）
function computeRemainBreakdown(items) {
  const per = new Map();
  const r = { per, candle: 0, starCandle: 0, heart: 0, money: 0, remainCount: 0 };
  const ownedSetIds = new Set();
  const countedNotOwnedSetIds = new Set();
  // セットの一部を既に所持している場合、残りのピースに追加コストはかからない
  items.forEach(item => { if (item.owned && item.cost.setId) ownedSetIds.add(item.cost.setId); });
  items.forEach(item => {
    if (item.owned) return;
    r.remainCount++;
    const c = { candle: 0, starCandle: 0, heart: 0, money: 0 };
    per.set(item, c);
    const cost = item.cost;
    if (cost.type === 'candle' && typeof cost.value === 'number') c.candle += cost.value;
    else if (cost.type === 'starCandle' && typeof cost.value === 'number') c.starCandle += cost.value;
    else if (cost.type === 'heart' && typeof cost.value === 'number') c.heart += cost.value;
    else if (cost.type === 'money' && typeof cost.value === 'number') {
      if (cost.setId) {
        if (ownedSetIds.has(cost.setId)) return;
        if (countedNotOwnedSetIds.has(cost.setId)) return;
        countedNotOwnedSetIds.add(cost.setId);
      }
      c.money += cost.value;
    }
  });
  per.forEach(c => { r.candle += c.candle; r.starCandle += c.starCandle; r.heart += c.heart; r.money += c.money; });
  return r;
}

function renderSummary(items, ob) {
  const candleSum = ob.candle, starCandleSum = ob.starCandle, heartSum = ob.heart, ownedCount = ob.ownedCount;
  const { giftReceivedCount, giftReceivedMoneySum, paidCandleCount, paidCandleMoneySum } = ob;
  // ob.money はアイテム分（課金キャンドルの申告額を含む）。従来と同じく、プレゼント履歴・キャンドル課金を「合計に含める」時だけ足す
  let moneySum = ob.money;

  const giftHistory = loadGiftHistory().filter(g => g.include);
  let giftGivenMoneySum = 0;
  giftHistory.forEach(g => {
    const it = getGiftPickableItem(g.catKey, g.itemId);
    if (it && it.cost && it.cost.type === 'money' && typeof it.cost.value === 'number') giftGivenMoneySum += it.cost.value;
  });
  const giftDisplayMode = loadGiftDisplayMode();
  if (giftDisplayMode === 'combined') moneySum += giftGivenMoneySum;

  const candlePurchases = loadCandlePurchases().filter(p => p.include !== false);
  let candlePurchaseMoneySum = 0;
  candlePurchases.forEach(p => {
    const pack = candlePackByKey(p.packKey);
    if (pack) candlePurchaseMoneySum += pack.price;
  });
  const candleDisplayMode = loadCandleDisplayMode();
  if (candleDisplayMode === 'combined') moneySum += candlePurchaseMoneySum;

  lastOwnedCount = ownedCount;
  lastTotalItemCount = items.length;
  setSumValues('', candleSum, starCandleSum, heartSum, moneySum);
  setText('#costOwnedCount', t(`所持 ${ownedCount.toLocaleString()} / ${items.length.toLocaleString()}件`, `${ownedCount.toLocaleString()} / ${items.length.toLocaleString()} owned`));

  const giftRow = hostEl.querySelector('#costSummaryGiftRow');
  if (giftRow) {
    if (giftHistory.length > 0 && giftDisplayMode === 'separate') {
      setText('#costSummaryGiftMoney', `¥${giftGivenMoneySum.toLocaleString()}`);
      giftRow.style.display = 'flex';
    } else giftRow.style.display = 'none';
  }
  const candleRow = hostEl.querySelector('#costSummaryCandleRow');
  if (candleRow) {
    if (candlePurchases.length > 0 && candleDisplayMode === 'separate') {
      setText('#costSummaryCandleMoney', `¥${candlePurchaseMoneySum.toLocaleString()}`);
      candleRow.style.display = 'flex';
    } else candleRow.style.display = 'none';
  }

  let hint = t(
    `所持済み ${ownedCount} / ${items.length} 件（対応済みカテゴリ内）をもとに集計しています。他のアイテムとのセット価格（実額）の場合、セット内の複数アイテムを所持済みにしても実額は1回分のみ加算されます。`,
    `Calculated from ${ownedCount} / ${items.length} owned items (within supported categories). For real-money items priced as part of a bundle, owning multiple items from the same bundle only adds that bundle's price once.`,
  );
  if (giftReceivedCount > 0) {
    hint += t(
      `「ギフトでもらった」に設定した ${giftReceivedCount}件（¥${giftReceivedMoneySum.toLocaleString()}）は実額の合計から除外しています。`,
      ` ${giftReceivedCount} item(s) marked "Received as a gift" (¥${giftReceivedMoneySum.toLocaleString()}) are excluded from the real-money total.`,
    );
  }
  if (giftHistory.length > 0) {
    hint += giftDisplayMode === 'combined'
      ? t(`課金アイテムプレゼント履歴のうち ${giftHistory.length}件（¥${giftGivenMoneySum.toLocaleString()}）を実額の合計に含めています。`, ` ${giftHistory.length} gift purchase(s) (¥${giftGivenMoneySum.toLocaleString()}) from your Gift Purchase History are included in the real-money total.`)
      : t(`課金アイテムプレゼント履歴のうち ${giftHistory.length}件（¥${giftGivenMoneySum.toLocaleString()}）は実額の合計に含めず、別枠で表示しています。`, ` ${giftHistory.length} gift purchase(s) (¥${giftGivenMoneySum.toLocaleString()}) from your Gift Purchase History are shown separately below, not included in the real-money total.`);
  }
  if (paidCandleCount > 0) {
    hint += t(
      `「課金で買ったキャンドルで入手」に設定した ${paidCandleCount}件（¥${paidCandleMoneySum.toLocaleString()}）も実額の合計に含めています。`,
      ` ${paidCandleCount} item(s) marked "Obtained with paid candles" (¥${paidCandleMoneySum.toLocaleString()}) are also included in the real-money total.`,
    );
  }
  if (candlePurchases.length > 0) {
    hint += candleDisplayMode === 'combined'
      ? t(`キャンドル課金のうち ${candlePurchases.length}件（¥${candlePurchaseMoneySum.toLocaleString()}）を実額の合計に含めています。`, ` ${candlePurchases.length} candle purchase(s) (¥${candlePurchaseMoneySum.toLocaleString()}) from your Candle Purchases log are included in the real-money total.`)
      : t(`キャンドル課金のうち ${candlePurchases.length}件（¥${candlePurchaseMoneySum.toLocaleString()}）は実額の合計に含めず、別枠で表示しています。`, ` ${candlePurchases.length} candle purchase(s) (¥${candlePurchaseMoneySum.toLocaleString()}) from your Candle Purchases log are shown separately below, not included in the real-money total.`);
  }
  const hintEl = hostEl.querySelector('#costSummaryHint');
  if (hintEl) hintEl.innerHTML = hint;

  // 🏆 称号システム（titles-panel.js）が読むハイウォーターマーク用の生値を書く
  try { localStorage.setItem(moneySpentKey(), String(moneySum)); } catch (e) { /* private browsing等 */ }
  notifyTitlesCheck();
}

// 実額合計の更新のたびに称号の新規解禁が無いか確認し、あればトースト通知する
function notifyTitlesCheck() {
  checkAndUnlockTitles().then(newlyEarned => {
    if (!newlyEarned || !newlyEarned.length) return;
    const msg = newlyEarned.length === 1
      ? t(`称号解禁「${newlyEarned[0].name}」`, `Title unlocked: ${newlyEarned[0].nameEn}`)
      : t(`称号を${newlyEarned.length}個解禁！`, `${newlyEarned.length} titles unlocked!`);
    showToast(msg);
  }).catch(e => console.error('[item cost] title check failed', e));
}

function renderRemainingSummary(items, rb) {
  const candleSum = rb.candle, starCandleSum = rb.starCandle, heartSum = rb.heart, moneySum = rb.money, remainCount = rb.remainCount;
  setSumValues('Remain', candleSum, starCandleSum, heartSum, moneySum);
  setText('#costRemainCount', t(`未所持 ${remainCount.toLocaleString()}件`, `${remainCount.toLocaleString()} not owned`));
  const hintEl = hostEl.querySelector('#costSummaryHintRemain');
  if (hintEl) {
    hintEl.innerHTML = t(
      `未所持 ${remainCount} / ${items.length} 件（対応済みカテゴリ内）をすべて集めるために必要な合計です。セット価格のアイテムは、セットの一部を既に所持していれば追加コストなし、未所持のセットは1回分のみ加算しています。`,
      `Total needed to collect all ${remainCount} / ${items.length} unowned items (within supported categories). For bundle-priced items, no extra cost is added if you already own part of the bundle; each not-yet-owned bundle is only counted once.`,
    ) + t(
      '一覧の季節ごとの小計は、表示中のアイテムの分です（絞り込みをしていなければ、全部の小計の和が上の合計と一致します）。課金アイテムプレゼント履歴とキャンドル課金はアイテムではないため、小計には含みません。',
      ' Subtotals in each season heading cover the items currently shown (with no filter, they add up to the totals above). Gift purchases and candle purchases are not items, so they are not part of any subtotal.',
    );
  }
}

/* ================================================================
   折りたたみカード（プレゼント履歴／キャンドル課金／この集計について）
   ================================================================ */
function toggleCollapse(bodySel, iconSel) {
  const body = hostEl.querySelector(bodySel);
  const icon = hostEl.querySelector(iconSel);
  if (!body) return;
  const expanded = body.style.display !== 'none';
  body.style.display = expanded ? 'none' : 'block';
  if (icon) icon.style.transform = expanded ? '' : 'rotate(90deg)';
  const head = hostEl.querySelector(`[aria-controls="${body.id}"]`);
  if (head) head.setAttribute('aria-expanded', String(!expanded));
}
function toggleGiftCard() { toggleCollapse('#costGiftBody', '#costGiftToggleIcon'); }
function toggleCandleCard() { toggleCollapse('#costCandleBody', '#costCandleToggleIcon'); }
function toggleAbout() { toggleCollapse('#costAboutBody', '#costAboutToggleIcon'); }

/* ================================================================
   🎁 課金アイテムプレゼント履歴（全カテゴリ横断のアイコン付きライブ検索ピッカー、
   追加後の相手名・日付のインライン編集つき）
   ================================================================ */
function setGiftDisplayMode(mode) {
  localStorage.setItem(giftDisplayModeKey(), mode === 'separate' ? 'separate' : 'combined');
  renderGiftDisplayModeToggle();
  renderItems();
}
function renderGiftDisplayModeToggle() {
  const mode = loadGiftDisplayMode();
  const wrap = hostEl.querySelector('#costGiftDisplayModeToggle');
  if (!wrap) return;
  const buttons = wrap.querySelectorAll('.cost-acquire-btn');
  if (buttons[0]) buttons[0].classList.toggle('active', mode === 'combined');
  if (buttons[1]) { buttons[1].classList.toggle('active', mode === 'separate'); buttons[1].classList.toggle('free', mode === 'separate'); }
}

const ICON_IMAGE = '<svg class="inline-icon" width="16" height="16"><use href="#i-image"/></svg>';
let giftSelected = null; // 選択中のアイテム { catKey, itemId }

function giftCatLabel(catKey) {
  return catKey === GIFT_PASS_CAT_KEY ? t('ギフトパス', 'Gift Pass') : trCat(CAT_LABEL_MAP[catKey] || catKey);
}
function giftItemImg(catKey, itemId) {
  return (itemImagesByCat[catKey] || {})[itemId] || '';
}
// アイテム画像のサムネイル（画像が無い/読めない場合はアイコンにフォールバック）
function giftThumbHtml(catKey, itemId, extraClass) {
  const img = giftItemImg(catKey, itemId);
  const fallback = catKey === GIFT_PASS_CAT_KEY ? ICON_GIFT : ICON_IMAGE;
  return `<div class="cost-item-thumb ${extraClass || ''} ${img ? '' : 'img-fallback'}">`
    + (img ? `<img src="${img}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('img-fallback')">` : '')
    + `<span class="cost-item-thumb-fallback">${fallback}</span></div>`;
}

// 全カテゴリ横断でのアイテム名検索用：{ catKey, item } の平坦なリスト（ギフトパスを含む）
function getAllGiftPickableEntries() {
  const entries = [{ catKey: GIFT_PASS_CAT_KEY, item: GIFT_PASS_ITEM }];
  GRID_CATEGORIES.forEach(cat => getGiftPickableItems(cat.key).forEach(it => entries.push({ catKey: cat.key, item: it })));
  return entries;
}

function populateGiftCatSelect() {
  const sel = hostEl.querySelector('#costGiftCat');
  if (!sel) return;
  sel.innerHTML = `<option value="">${t('カテゴリを選択', 'Select a category')}</option>` +
    `<option value="${GIFT_PASS_CAT_KEY}">${t('ギフトパス', 'Gift Pass')}</option>` +
    GRID_CATEGORIES.map(c => `<option value="${c.key}">${escapeHtml(trCat(c.name))}</option>`).join('');
}

// カテゴリ変更時：選択状態をリセットし、一覧を作り直す（入力中の検索語はそのまま残し、選んだカテゴリでさらに絞り込める）
function onGiftCatChange() {
  giftSelected = null;
  renderGiftItemPicker();
  updateGiftItemPreview();
}

// アイコン付きのアイテム一覧。カテゴリを選んでいればそのカテゴリ内、選んでいなければ全カテゴリ横断で名前検索できる
function renderGiftItemPicker() {
  const picker = hostEl && hostEl.querySelector('#costGiftPicker');
  if (!picker) return;
  const catKey = hostEl.querySelector('#costGiftCat').value;
  const q = (hostEl.querySelector('#costGiftFilter').value || '').trim().toLowerCase();
  const match = it => !q || it.name.toLowerCase().includes(q) || (it.nameEn && it.nameEn.toLowerCase().includes(q));

  let entries;
  if (catKey) {
    entries = getGiftPickableItems(catKey).filter(match).map(it => ({ catKey, item: it }));
  } else if (!q) {
    picker.innerHTML = `<div class="cost-gift-picker-empty">${t('カテゴリを選ぶか、アイテム名を入力すると全カテゴリから検索できます。', 'Select a category above, or type an item name to search across all categories.')}</div>`;
    return;
  } else {
    entries = getAllGiftPickableEntries().filter(({ item }) => match(item));
  }
  if (entries.length === 0) {
    picker.innerHTML = `<div class="cost-gift-picker-empty">${t('該当するアイテムがありません', 'No matching items')}</div>`;
    return;
  }
  picker.innerHTML = entries.map(({ catKey: ck, item: it }) => {
    const selected = giftSelected && giftSelected.catKey === ck && giftSelected.itemId === it.id;
    const catTag = catKey ? '' : `<span class="cost-gift-picker-cat">${escapeHtml(giftCatLabel(ck))}</span>`;
    return `
      <div class="cost-gift-picker-row ${selected ? 'selected' : ''}" role="button" tabindex="0"
        onclick="window.__costViewSelectGift('${ck}','${it.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.__costViewSelectGift('${ck}','${it.id}')}">
        ${giftThumbHtml(ck, it.id)}
        <span class="cost-gift-picker-name">${escapeHtml(trItem(it))}</span>
        ${catTag}
        <span class="cost-gift-picker-cost">¥${it.cost.value.toLocaleString()}</span>
      </div>`;
  }).join('');
}

function selectGiftItem(catKey, itemId) {
  giftSelected = { catKey, itemId };
  const catSel = hostEl.querySelector('#costGiftCat');
  if (catSel) catSel.value = catKey; // 横断検索で選んだ場合もカテゴリ選択と見た目を同期させる
  renderGiftItemPicker();
  updateGiftItemPreview();
}

// 選択中アイテムの画像とアイテム名をプレビュー表示する
function updateGiftItemPreview() {
  const preview = hostEl && hostEl.querySelector('#costGiftPreview');
  if (!preview) return;
  const it = giftSelected ? getGiftPickableItem(giftSelected.catKey, giftSelected.itemId) : null;
  if (!it) { preview.style.display = 'none'; return; }
  preview.innerHTML = `${giftThumbHtml(giftSelected.catKey, giftSelected.itemId)}<span class="cost-gift-preview-label">${escapeHtml(trItem(it))}</span>`;
  preview.style.display = 'flex';
}

function addGiftRecord() {
  const recipientEl = hostEl.querySelector('#costGiftRecipient');
  const dateEl = hostEl.querySelector('#costGiftDate');
  if (!giftSelected) {
    showToast(t('カテゴリとアイテムを選択してください', 'Please select a category and item'));
    return;
  }
  const list = loadGiftHistory();
  list.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    catKey: giftSelected.catKey, itemId: giftSelected.itemId,
    recipient: (recipientEl && recipientEl.value || '').trim(),
    date: (dateEl && dateEl.value) || '',
    include: true,
    createdAt: new Date().toISOString(),
  });
  saveGiftHistory(list);

  giftSelected = null;
  if (recipientEl) recipientEl.value = '';
  if (dateEl) dateEl.value = '';
  hostEl.querySelector('#costGiftCat').value = '';
  hostEl.querySelector('#costGiftFilter').value = '';
  renderGiftItemPicker();
  updateGiftItemPreview();
  showToast(t('追加しました', 'Added'));
  renderGiftHistoryList();
  renderItems();
}

function removeGiftRecord(id) {
  saveGiftHistory(loadGiftHistory().filter(g => g.id !== id));
  renderGiftHistoryList();
  renderItems();
}

function toggleGiftInclude(id, checked) {
  const list = loadGiftHistory();
  const rec = list.find(g => g.id === id);
  if (rec) { rec.include = checked; saveGiftHistory(list); }
  renderItems();
}

// 相手・日付を後から編集する（再描画するとフォーカスが外れるため、保存だけしてリストは描き直さない）
function updateGiftField(id, field, value) {
  const list = loadGiftHistory();
  const rec = list.find(g => g.id === id);
  if (!rec) return;
  rec[field] = value;
  saveGiftHistory(list);
  showToast(t('更新しました', 'Updated'));
  renderItems();
}

function renderGiftHistoryList() {
  const el = hostEl.querySelector('#costGiftList');
  if (!el) return;
  const list = loadGiftHistory();
  if (list.length === 0) {
    el.innerHTML = `<div class="cost-gift-empty">${t('まだ記録がありません。', 'No gift purchases recorded yet.')}</div>`;
    return;
  }
  el.innerHTML = list.slice().reverse().map(g => {
    const it = getGiftPickableItem(g.catKey, g.itemId);
    const itemName = it ? trItem(it) : g.itemId;
    const costTxt = (it && it.cost && it.cost.type === 'money') ? `¥${it.cost.value.toLocaleString()}` : t('データなし', 'No data');
    return `
      <div class="cost-gift-record">
        ${giftThumbHtml(g.catKey, g.itemId, 'cost-gift-record-thumb')}
        <div class="cost-gift-record-info">
          <b>${escapeHtml(itemName)}</b>（${costTxt}）
          <div class="cost-gift-record-sub">${escapeHtml(giftCatLabel(g.catKey))}</div>
          <div class="cost-gift-edit-row">
            <input type="text" class="cost-gift-edit-input" placeholder="${t('相手のプレイヤーネーム（任意）', "Recipient's name (optional)")}" maxlength="60" value="${escapeHtml(g.recipient || '')}"
              onchange="window.__costViewUpdateGiftField('${g.id}','recipient',this.value.trim())">
            <input type="date" class="cost-gift-edit-input" value="${escapeHtml(g.date || '')}"
              onchange="window.__costViewUpdateGiftField('${g.id}','date',this.value)">
          </div>
        </div>
        <label class="cost-gift-include-toggle">
          <input type="checkbox" ${g.include ? 'checked' : ''} onchange="window.__costViewToggleGiftInclude('${g.id}', this.checked)">
          ${t('実額に含める', 'Include in total')}
        </label>
        <button type="button" class="cost-gift-remove-btn" onclick="window.__costViewRemoveGiftRecord('${g.id}')" aria-label="${t('削除', 'Remove')}"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      </div>`;
  }).join('');
}

/* ================================================================
   🕯️ キャンドル課金（常時ショップのパック購入ログ。追加後の購入日は
   リスト上で編集できる）
   ================================================================ */
function setCandleDisplayMode(mode) {
  localStorage.setItem(candleDisplayModeKey(), mode === 'separate' ? 'separate' : 'combined');
  renderCandleDisplayModeToggle();
  renderItems();
}
function renderCandleDisplayModeToggle() {
  const mode = loadCandleDisplayMode();
  const wrap = hostEl.querySelector('#costCandleDisplayModeToggle');
  if (!wrap) return;
  const buttons = wrap.querySelectorAll('.cost-acquire-btn');
  if (buttons[0]) buttons[0].classList.toggle('active', mode === 'combined');
  if (buttons[1]) { buttons[1].classList.toggle('active', mode === 'separate'); buttons[1].classList.toggle('free', mode === 'separate'); }
}

function renderCandlePackGrid() {
  const el = hostEl.querySelector('#costCandlePackGrid');
  if (!el) return;
  el.innerHTML = CANDLE_PACKS.map(p => `
    <button type="button" class="cost-candle-pack-btn" onclick="window.__costViewAddCandlePurchase('${p.key}')">
      <span class="cost-candle-pack-price">¥${p.price.toLocaleString()}</span>
      <span class="cost-candle-pack-amount"><svg class="inline-icon" width="14" height="14"><use href="#i-candle"/></svg>${p.candles}${t('本', '')}</span>
      <span class="cost-candle-pack-add">${t('+ 購入を記録', '+ Record purchase')}</span>
    </button>`).join('');
}

function addCandlePurchase(packKey) {
  const pack = candlePackByKey(packKey);
  if (!pack) return;
  const list = loadCandlePurchases();
  list.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    packKey,
    date: new Date().toISOString().slice(0, 10),
    include: true,
    createdAt: new Date().toISOString(),
  });
  saveCandlePurchases(list);
  showToast(t('記録しました', 'Recorded'));
  renderCandlePurchaseList();
  renderItems();
}

function updateCandlePurchaseDate(id, value) {
  const list = loadCandlePurchases();
  const rec = list.find(p => p.id === id);
  if (!rec) return;
  rec.date = value;
  saveCandlePurchases(list);
  showToast(t('更新しました', 'Updated'));
  renderItems(); // 日付は支出振り返りの集計にも使われる
}

function removeCandlePurchase(id) {
  saveCandlePurchases(loadCandlePurchases().filter(p => p.id !== id));
  renderCandlePurchaseList();
  renderItems();
}

function toggleCandleInclude(id, checked) {
  const list = loadCandlePurchases();
  const rec = list.find(p => p.id === id);
  if (rec) { rec.include = checked; saveCandlePurchases(list); }
  renderItems();
}

function renderCandlePurchaseList() {
  const el = hostEl.querySelector('#costCandleList');
  const summaryEl = hostEl.querySelector('#costCandlePurchaseSummary');
  if (!el) return;
  const list = loadCandlePurchases();

  if (summaryEl) {
    if (list.length === 0) {
      summaryEl.style.display = 'none';
    } else {
      const totalYen = list.reduce((sum, p) => sum + ((candlePackByKey(p.packKey) || {}).price || 0), 0);
      const totalCandles = list.reduce((sum, p) => sum + ((candlePackByKey(p.packKey) || {}).candles || 0), 0);
      summaryEl.style.display = 'flex';
      summaryEl.innerHTML = `<span>${t(`${list.length}回購入`, `${list.length} purchases`)}</span><span>¥${totalYen.toLocaleString()} → <svg class="inline-icon" width="14" height="14"><use href="#i-candle"/></svg>${totalCandles.toLocaleString()}${t('本', '')}</span>`;
    }
  }

  if (list.length === 0) {
    el.innerHTML = `<div class="cost-gift-empty">${t('まだ記録がありません。', 'No candle purchases recorded yet.')}</div>`;
    return;
  }

  el.innerHTML = list.slice().reverse().map(p => {
    const pack = candlePackByKey(p.packKey);
    if (!pack) return '';
    return `
      <div class="cost-gift-record">
        <div class="cost-item-thumb cost-gift-record-thumb img-fallback"><span class="cost-item-thumb-fallback"><svg class="inline-icon" width="16" height="16"><use href="#i-candle"/></svg></span></div>
        <div class="cost-gift-record-info">
          <b>¥${pack.price.toLocaleString()}</b>（<svg class="inline-icon" width="14" height="14"><use href="#i-candle"/></svg>${pack.candles}${t('本', '')}）
          <div class="cost-gift-edit-row">
            <input type="date" class="cost-gift-edit-input" value="${escapeHtml(p.date || '')}" onchange="window.__costViewUpdateCandleDate('${p.id}', this.value)">
          </div>
        </div>
        <label class="cost-gift-include-toggle">
          <input type="checkbox" ${p.include !== false ? 'checked' : ''} onchange="window.__costViewToggleCandleInclude('${p.id}', this.checked)">
          ${t('実額に含める', 'Include in total')}
        </label>
        <button type="button" class="cost-gift-remove-btn" onclick="window.__costViewRemoveCandlePurchase('${p.id}')" aria-label="${t('削除', 'Remove')}"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      </div>`;
  }).join('');
}

/* ================================================================
   📤 画像共有（Xへ投稿）。集計・一覧データはここで用意し、カード生成と
   Web Share/プレビューは cost-share.js に任せる
   ================================================================ */
const RECAP_ICON = costShare.COST_ICONS;

function shareCost() {
  const txt = sel => (hostEl.querySelector(sel) || {}).textContent || '';
  const giftRow = hostEl.querySelector('#costSummaryGiftRow');
  const giftVisible = giftRow && giftRow.style.display !== 'none';
  return costShare.shareCostSummary({
    owned: lastOwnedCount, total: lastTotalItemCount,
    candle: txt('#costSumCandle'), starCandle: txt('#costSumStarCandle'), heart: txt('#costSumHeart'), money: txt('#costSumMoney'),
  }, giftVisible ? txt('#costSummaryGiftMoney') : null);
}

function shareReceivedGifts() {
  const items = computeAllItems()
    .filter(item => item.owned && item.cost.type === 'money' && item.moneyAcquireMode === 'gift')
    .map(item => ({ img: item.img, catLabel: trCat(CAT_LABEL_MAP[item.catKey] || item.catKey), name: trItem(item), yen: item.cost.value || 0 }));
  return costShare.shareReceivedGifts(items);
}

function shareGiftHistory() {
  const rows = loadGiftHistory().slice().reverse().map(g => {
    const it = getGiftPickableItem(g.catKey, g.itemId);
    return {
      img: giftItemImg(g.catKey, g.itemId),
      sub: [g.recipient, g.date].filter(Boolean).join(' ・ '),
      name: it ? trItem(it) : g.itemId,
      yen: (it && it.cost && it.cost.type === 'money') ? it.cost.value : null,
    };
  });
  return costShare.shareGiftHistory(rows);
}

// 指定期間（'month'=今月 / 'year'=今年）に実額支出として計上される明細（集計ロジックはrenderSummary()の実額と同じ考え方で、
// 日付の無いもの＝獲得日が記録されていないアイテムは対象外）
function getCostRecapEntries(scope) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const inScopeIso = iso => {
    if (!iso) return false;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return false;
    return scope === 'year' ? d.getFullYear() === y : (d.getFullYear() === y && d.getMonth() === m);
  };
  // "YYYY-MM-DD"（日付入力欄由来）はUTC解釈だとタイムゾーンで日付がずれるため、年月日を直接見てローカル日付として判定する
  const inScopeDateStr = str => {
    if (!str) return false;
    const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
    if (dm) return scope === 'year' ? Number(dm[1]) === y : (Number(dm[1]) === y && (Number(dm[2]) - 1) === m);
    return inScopeIso(str);
  };
  const atMs = (str) => {
    const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || '');
    return dm ? new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3])).getTime() : new Date(str).getTime();
  };

  const entries = [];
  const acquireLog = getItemAcquireLog();
  const countedSetIds = new Set();
  computeAllItems().forEach(item => {
    if (!item.owned) return;
    if (item.seasonPendantOwned && item.acquireMode === 'inSeason') return; // 季節中入手扱いのため対象外
    if (item.isTicketItem && item.acquireMode !== 'revisit') return; // チケットで入手扱い（0）のため対象外
    const rec = acquireLog[item.id];
    if (!rec || rec.catKey !== item.catKey || !inScopeIso(rec.at)) return; // 記録が無い/期間外は対象外

    const cost = item.isTicketItem ? (item.revisitCost || {}) : item.cost;
    const base = { name: trItem(item), catLabel: trCat(CAT_LABEL_MAP[item.catKey] || item.catKey), img: item.img, at: new Date(rec.at).getTime() };
    if ((cost.type === 'candle' || cost.type === 'starCandle') && item.candleMoneyMode === 'paidCandle' && item.candleMoneyYen > 0) {
      entries.push({ ...base, fallback: RECAP_ICON.candle, yen: item.candleMoneyYen });
      return;
    }
    if (cost.type === 'money' && typeof cost.value === 'number') {
      if (item.moneyAcquireMode === 'gift') return; // ギフトでもらった分は自分の支出から除外
      if (cost.setId) {
        if (countedSetIds.has(cost.setId)) return;
        countedSetIds.add(cost.setId);
      }
      entries.push({ ...base, fallback: RECAP_ICON.coin, yen: cost.value * (item.quantity || 1) });
    }
  });

  // 課金アイテムプレゼント履歴：実額に含める設定のものだけ（「合計に含める」設定の場合のみ）
  if (loadGiftDisplayMode() === 'combined') {
    loadGiftHistory().filter(g => g.include).forEach(g => {
      const at = g.date || g.createdAt;
      if (!inScopeDateStr(at)) return;
      const it = getGiftPickableItem(g.catKey, g.itemId);
      if (it && it.cost && it.cost.type === 'money' && typeof it.cost.value === 'number') {
        entries.push({ name: trItem(it), catLabel: giftCatLabel(g.catKey), img: giftItemImg(g.catKey, g.itemId), fallback: RECAP_ICON.gift, yen: it.cost.value, at: atMs(at) });
      }
    });
  }
  // キャンドル課金の購入ログ：実額に含める設定のものだけ（「合計に含める」設定の場合のみ）
  if (loadCandleDisplayMode() === 'combined') {
    loadCandlePurchases().filter(p => p.include !== false).forEach(p => {
      const at = p.date || p.createdAt;
      if (!inScopeDateStr(at)) return;
      const pack = candlePackByKey(p.packKey);
      if (!pack) return;
      entries.push({
        name: t(`キャンドルパック（${pack.candles}本）`, `Candle Pack (${pack.candles})`),
        catLabel: t('キャンドル課金', 'Candle Purchase'), img: '', fallback: RECAP_ICON.candle, yen: pack.price, at: atMs(at),
      });
    });
  }
  entries.sort((a, b) => b.at - a.at);
  return entries;
}

function shareRecap(scope) {
  return costShare.shareCostRecap(scope, getCostRecapEntries(scope));
}

/* ================================================================
   ウィッシュリスト・トースト
   ================================================================ */
function handleToggleWish(catKey, itemId, btn) {
  const added = toggleWishItem(catKey, itemId);
  if (added === null) {
    showToast(t('所持済みのアイテムはウィッシュリストに追加できません', 'Owned items cannot be added to the wishlist'));
    return;
  }
  if (btn) { btn.classList.toggle('is-wish', added); btn.setAttribute('aria-pressed', String(added)); }
}

function showToast(msg) {
  const el = document.createElement('div');
  el.className = 'cost-toast';
  el.textContent = msg;
  const stackIndex = document.querySelectorAll('.cost-toast').length;
  if (stackIndex > 0) el.style.bottom = `calc(84px + env(safe-area-inset-bottom) + ${stackIndex * 44}px)`;
  document.body.appendChild(el);
  toastTimers.push(setTimeout(() => el.classList.add('show'), 10));
  toastTimers.push(setTimeout(() => {
    el.classList.remove('show');
    toastTimers.push(setTimeout(() => el.remove(), 300));
  }, 2600));
}
function clearToasts() {
  toastTimers.forEach(id => clearTimeout(id));
  toastTimers = [];
  document.querySelectorAll('.cost-toast').forEach(el => el.remove());
}

/* ================================================================
   外枠の描画
   ================================================================ */
// サマリーの4通貨（並び順・アイコンは「残り」「かかった」の両セクションで共通）
const SUM_CURRENCIES = [
  { key: 'Candle', icon: 'i-candle', ja: 'キャンドル', en: 'Candles', unit: '本' },
  { key: 'StarCandle', icon: 'i-star', ja: '星のキャンドル', en: 'Star Candles', unit: '本' },
  { key: 'Heart', icon: 'i-heart', ja: 'ハート', en: 'Hearts', unit: '個' },
  { key: 'Money', icon: 'i-coin', ja: '実額', en: 'Real Money', unit: '' },
];
function sumGridHtml(suffix) {
  return `<div class="cost-sum-grid">${SUM_CURRENCIES.map(c => `
    <div class="cost-sum-cell">
      <div class="cost-sum-label"><svg class="inline-icon" width="14" height="14"><use href="#${c.icon}"/></svg>${t(c.ja, c.en)}</div>
      <div class="cost-sum-value" id="costSum${c.key}${suffix}">${c.key === 'Money' ? '¥0' : `0${t(`<span class="cost-unit">${c.unit}</span>`, '')}`}</div>
    </div>`).join('')}</div>`;
}

// 折りたたみ（課金の記録・この集計について）の見出しボタン
function collapseHeadHtml(onclick, iconId, labelHtml, bodyId) {
  return `<button type="button" class="cost-collapse-head" aria-expanded="false" aria-controls="${bodyId}" onclick="${onclick}">
      <span>${labelHtml}</span>
      <span class="cost-summary-toggle-icon" id="${iconId}">${ICON_CHEVRON}</span>
    </button>`;
}

function renderShell() {
  const en = CURRENT_LANG === 'en';
  return `
    <div class="item-view">
      <div class="cost-wrap">
        <a href="#/item" class="back-link">${en ? '&larr; Back to Category List' : '&larr; カテゴリ一覧へ戻る'}</a>
        <h1 class="item-large-title">${en ? 'Item Costs' : 'アイテム別コスト'}</h1>

        <section class="cost-summary" aria-label="${t('コストの合計', 'Cost totals')}">
          <div class="cost-sum-sec remain">
            <div class="cost-sum-head">
              <h2 class="cost-sum-title">${t('集めるための残りコスト', 'Remaining cost to collect')}</h2>
              <span class="cost-sum-count" id="costRemainCount"></span>
            </div>
            ${sumGridHtml('Remain')}
          </div>
          <div class="cost-sum-sec spent">
            <div class="cost-sum-head">
              <h2 class="cost-sum-title">${t('かかったコスト（所持済み）', 'Spent on owned items')}</h2>
              <span class="cost-sum-count" id="costOwnedCount"></span>
            </div>
            ${sumGridHtml('')}
            <div class="cost-summary-gift-row" id="costSummaryGiftRow" style="display:none;">
              <span>${ICON_GIFT} ${t('プレゼント分（実額とは別）', 'Gift purchases (shown separately)')}</span><b id="costSummaryGiftMoney">¥0</b>
            </div>
            <div class="cost-summary-gift-row" id="costSummaryCandleRow" style="display:none;">
              <span><svg class="inline-icon" width="14" height="14"><use href="#i-candle"/></svg> ${t('キャンドル課金分（実額とは別）', 'Candle purchases (shown separately)')}</span><b id="costSummaryCandleMoney">¥0</b>
            </div>
          </div>
          <details class="cost-sum-details">
            <summary><span class="cost-sum-excl">${t('季節キャンドル・チケット交換はこの合計に含まれません', 'Season Candles and ticket exchanges are not included in these totals')}</span><span class="cost-sum-more">${t('内訳', 'Details')}<span class="cost-summary-toggle-icon">${ICON_CHEVRON}</span></span></summary>
            <p class="cost-summary-hint" id="costSummaryHint">${t('読み込み中…', 'Loading…')}</p>
            <p class="cost-summary-hint" id="costSummaryHintRemain"></p>
          </details>
          <div class="cost-share-chips" role="group" aria-label="${t('画像でXに共有', 'Share an image on X')}">
            <button type="button" class="cost-share-chip" onclick="window.__costViewShareCost()"><svg class="inline-icon" width="15" height="15"><use href="#i-upload"/></svg><span>${t('集計を共有', 'Share totals')}</span></button>
            <button type="button" class="cost-share-chip" onclick="window.__costViewShareReceivedGifts()">${ICON_GIFT}<span>${t('もらったギフト', 'Gifts received')}</span></button>
            <button type="button" class="cost-share-chip" onclick="window.__costViewShareRecap('month')"><svg class="inline-icon" width="15" height="15"><use href="#i-calendar"/></svg><span>${t('今月の支出', 'This month')}</span></button>
            <button type="button" class="cost-share-chip" onclick="window.__costViewShareRecap('year')"><svg class="inline-icon" width="15" height="15"><use href="#i-calendar"/></svg><span>${t('今年の支出', 'This year')}</span></button>
          </div>
        </section>

        <div class="cost-filter-bar" id="costFilterBar">
          <div class="cost-search">
            <svg class="inline-icon" width="16" height="16" aria-hidden="true"><use href="#i-search"/></svg>
            <input type="search" id="costSearch" autocomplete="off" enterkeyhint="search" aria-label="${t('アイテム名で検索', 'Search by item name')}"
              placeholder="${t('アイテム名で検索', 'Search by item name')}" oninput="window.__costViewOnSearch(this.value)">
            <button type="button" class="cost-search-clear" id="costSearchClear" hidden aria-label="${t('検索をクリア', 'Clear search')}" onclick="window.__costViewClearSearch()"><svg class="inline-icon" width="14" height="14"><use href="#i-close"/></svg></button>
          </div>
          <div class="cost-filter-row">
            <div class="cost-seg" role="group" aria-label="${t('所持状況', 'Ownership')}">
              <button type="button" class="cost-seg-btn" data-own="all" aria-pressed="true" onclick="window.__costViewSetOwnFilter('all')">${t('すべて', 'All')}</button>
              <button type="button" class="cost-seg-btn" data-own="owned" aria-pressed="false" onclick="window.__costViewSetOwnFilter('owned')">${t('所持', 'Owned')}</button>
              <button type="button" class="cost-seg-btn" data-own="notOwned" aria-pressed="false" onclick="window.__costViewSetOwnFilter('notOwned')">${t('未所持', 'Missing')}</button>
            </div>
            <select id="costCategoryFilter" class="cost-filter-select" aria-label="${t('カテゴリ', 'Category')}" onchange="window.__costViewRenderItems()">
              <option value="all">${t('全カテゴリ', 'All categories')}</option>
              ${GRID_CATEGORIES.map(c => `<option value="${c.key}">${escapeHtml(trCat(c.name))}</option>`).join('')}
              <option value="${MUSIC_SHEET_CAT_KEY}">${t('楽譜', 'Music Sheets')}</option>
            </select>
            <select id="costTypeFilter" class="cost-filter-select" aria-label="${t('通貨', 'Currency')}" onchange="window.__costViewRenderItems()">
              <option value="all">${t('全通貨', 'All currencies')}</option>
              <option value="candle">${t('キャンドル', 'Candles')}</option>
              <option value="starCandle">${t('星のキャンドル', 'Star Candles')}</option>
              <option value="heart">${t('ハート', 'Hearts')}</option>
              <option value="seasonCandle">${t('季節キャンドル', 'Season Candles (seasonal price)')}</option>
              <option value="reward">${t('報酬', 'Rewards')}</option>
              <option value="free">${t('無料', 'Free')}</option>
              <option value="money">${t('実額', 'Real Money')}</option>
            </select>
          </div>
        </div>

        <div class="cost-list-head">
          <h2 class="sec-label cost-list-label">${t('アイテムのコスト一覧', 'Item Cost List')}</h2>
          <div class="cost-jump-row">
          <select id="costJumpSelect" class="cost-jump-select" aria-label="${t('季節・日々へジャンプ', 'Jump to a season/day')}" onchange="window.__costViewJumpToGroup(this.value)">
            <option value="">${t('ジャンプ', 'Jump to')}</option>
          </select>
          <button type="button" class="cost-link-btn" id="costToggleAllGroups" onclick="window.__costViewToggleAllGroups()">${t('折りたたむ', 'Collapse')}</button>
          </div>
        </div>
        <p class="cost-legend">
          <span><svg class="inline-icon" width="13" height="13"><use href="#i-candle"/></svg>${t('キャンドル', 'Candles')}</span>
          <span><svg class="inline-icon" width="13" height="13"><use href="#i-star"/></svg>${t('星のキャンドル', 'Star Candles')}</span>
          <span><svg class="inline-icon" width="13" height="13"><use href="#i-heart"/></svg>${t('ハート', 'Hearts')}</span>
          <span class="is-season"><svg class="inline-icon" width="13" height="13"><use href="#i-star-candle"/></svg>${t('季節キャンドル', 'Season Candles')}</span>
          <span class="is-money">¥ ${t('実額', 'Real money')}</span>
          <span class="cost-legend-hint">${t('行を押すと詳細', 'Tap a row for details')}</span>
        </p>
        <div id="costItemList"></div>

        <p class="sec-label cost-more-label">${t('課金の記録', 'Purchase records')}</p>
        <div class="cost-gift-card">
          ${collapseHeadHtml('window.__costViewToggleGiftCard()', 'costGiftToggleIcon', `${ICON_GIFT} ${t('課金アイテムプレゼント履歴', 'Gift Purchase History')}`, 'costGiftBody')}
          <div id="costGiftBody" style="display:none;">
            <p class="cost-note">${t('相手にプレゼントするために購入した課金アイテムを記録できます。実額の合計に加算するかは1件ずつ任意で選べます。', 'Record real-money items you bought to gift to another player. You can optionally include each one in the real-money total above.')}</p>
            <div style="margin-top:10px;">
              <p class="cost-note" style="margin:0 0 4px;">${t('上の実額の合計への反映方法：', 'How to reflect included gifts in the real-money total above:')}</p>
              <div class="cost-acquire-toggle" id="costGiftDisplayModeToggle">
                <button type="button" class="cost-acquire-btn" onclick="window.__costViewSetGiftDisplayMode('combined')">${t('合計に含める', 'Merge into the total')}</button>
                <button type="button" class="cost-acquire-btn" onclick="window.__costViewSetGiftDisplayMode('separate')">${t('分けて表示', 'Show separately')}</button>
              </div>
            </div>
            <div class="cost-gift-form">
              <select id="costGiftCat" onchange="window.__costViewOnGiftCatChange()" aria-label="${t('カテゴリ', 'Category')}"></select>
              <input type="text" id="costGiftFilter" class="cost-gift-filter" autocomplete="off"
                placeholder="${t('アイテム名で検索（全カテゴリ横断）', 'Search by item name (across all categories)')}" oninput="window.__costViewRenderGiftPicker()">
              <div class="cost-gift-picker" id="costGiftPicker"></div>
              <div class="cost-gift-preview" id="costGiftPreview" style="display:none;"></div>
              <div class="cost-gift-form-row">
                <input type="text" id="costGiftRecipient" placeholder="${t('相手のプレイヤーネーム（任意）', "Recipient's player name (optional)")}" maxlength="60">
                <input type="date" id="costGiftDate">
              </div>
              <button type="button" class="cost-gift-add-btn" onclick="window.__costViewAddGiftRecord()">${t('追加する', 'Add')}</button>
            </div>
            <div class="cost-gift-list" id="costGiftList"></div>
            <div class="cost-share-row" style="margin-top:14px;">
              <button type="button" class="cost-share-btn" onclick="window.__costViewShareGiftHistory()">
                <svg class="inline-icon" width="15" height="15"><use href="#i-upload"/></svg><span>${t('プレゼント履歴を共有', 'Share Gift History')}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="cost-gift-card">
          ${collapseHeadHtml('window.__costViewToggleCandleCard()', 'costCandleToggleIcon', `<svg class="inline-icon" width="20" height="20"><use href="#i-candle"/></svg> ${t('キャンドル課金', 'Candle Purchases')}`, 'costCandleBody')}
          <div id="costCandleBody" style="display:none;">
            <p class="cost-note">${t('常時ショップで購入できるキャンドルパックの購入回数を記録できます。上の実額の合計に含めるかは任意で選べます。', 'Record how many times you bought the candle packs that are always available in the shop. You can optionally include the total in the real-money total above.')}</p>
            <div style="margin-top:10px;">
              <p class="cost-note" style="margin:0 0 4px;">${t('上の実額の合計への反映方法：', 'How to reflect included purchases in the real-money total above:')}</p>
              <div class="cost-acquire-toggle" id="costCandleDisplayModeToggle">
                <button type="button" class="cost-acquire-btn" onclick="window.__costViewSetCandleDisplayMode('combined')">${t('合計に含める', 'Merge into the total')}</button>
                <button type="button" class="cost-acquire-btn" onclick="window.__costViewSetCandleDisplayMode('separate')">${t('分けて表示', 'Show separately')}</button>
              </div>
            </div>
            <div class="cost-candle-pack-grid" id="costCandlePackGrid"></div>
            <div class="cost-candle-summary-row" id="costCandlePurchaseSummary" style="display:none;"></div>
            <div class="cost-gift-list" id="costCandleList"></div>
          </div>
        </div>

        <div class="cost-gift-card cost-about-card">
          ${collapseHeadHtml('window.__costViewToggleAbout()', 'costAboutToggleIcon', `<svg class="inline-icon" width="16" height="16"><use href="#i-warning"/></svg> ${t('この集計について', 'About these costs')}`, 'costAboutBody')}
          <div id="costAboutBody" class="cost-about-body" style="display:none;">
          ${en
            ? `Costs are compiled from the <a href="https://sky-children-of-the-light.fandom.com/wiki/Shoes" target="_blank" rel="noopener noreferrer">Sky: Children of the Light Wiki (English)</a>'s "Source" and "Cost" tables for each item.<br>
          There are four currencies: <b>Candles</b> (the basic currency for most items), <b>Season Candles</b> (a special currency used for Nesting Workshop furniture and some permanent items), <b>Hearts</b>, and <b>Real Money (JPY)</b>. Real-money amounts are converted to Japanese App Store price tiers (the wiki lists USD, so tier prices are converted to their real JPY equivalents). Some real-money items are priced as a bundle with another item (noted where applicable) &mdash; owning multiple items in the same bundle only adds that bundle's price once to the total.<br>
          Covers all 12 categories (Shoes, Necklace, Large Placeable Items, Outfit, Hairstyle, Face Accessory, Head Accessory, Hair Accessory, Props, Mask, Small Placeable Items, Cape) plus Music Sheets. Items are grouped by season/day rather than by category.<br>
          <b><svg class="inline-icon" width="14" height="14"><use href="#i-warning"/></svg> The costs listed here are approximate estimates only.</b> Actual amounts may differ due to how wiki data, bundle pricing, and currency rounding are interpreted. No accuracy is guaranteed &mdash; please use this as a reference only.`
            : `<a href="https://sky-children-of-the-light.fandom.com/wiki/Shoes" target="_blank" rel="noopener noreferrer">Sky: Children of the Light Wiki（英語版）</a>の「入手方法(Source)」「コスト(Cost)」の一覧表を基に、各アイテムの実際の入手コストをまとめています。<br>
          通貨は<b>キャンドル</b>（通常アイテムの基本通貨）・<b>星のキャンドル</b>（巣づくり工房の家具や一部の恒常アイテムで使う特別な通貨）・<b>ハート</b>・<b>実額（円）</b>の4種類があります。実額は日本のAppストア価格帯を基にした円換算です（Wikiは米ドル表記のため、Tierごとの実際の円価格に置き換えています）。実額のアイテムは、他のアイテムとのセット価格になっている場合があります（その場合は注記しています）。セット内の複数アイテムを所持済みにしても、合計額にはセット価格が1回分のみ加算されます。<br>
          全12カテゴリ（シューズ・ネックレス・大きい設置アイテム・アウトフィット・ヘアスタイル・フェイスアクセサリー・ヘッドアクセサリー・ヘアアクセサリー・持ち物アイテム・マスク・小さい設置アイテム・ケープ）に加え、楽譜にも対応しています。カテゴリ分けはせず、季節・日々ごとにまとめて表示しています。<br>
          <b><svg class="inline-icon" width="14" height="14"><use href="#i-warning"/></svg> ここに記載しているコストはあくまで目安・概算です。</b>Wikiの情報やセット価格の解釈、円換算の丸めなどにより、実際の金額と差が生じる場合があります。正確な金額の保証はできませんので、参考程度にご利用ください。`}
          </div>
        </div>
      </div>
    </div>`;
}

/* ================================================================
   window.* ハンドラの登録/解除（innerHTMLで描いたonclick属性から呼ぶため。
   このコードベースの既存の慣例——category-view.js の window.__catViewXxx等
   ——に合わせている）
   ================================================================ */
const HANDLERS = {
  __costViewRenderItems: () => renderItems(),
  __costViewJumpToGroup: gid => jumpToGroup(gid),
  __costViewToggleAbout: () => toggleAbout(),
  __costViewToggleRow: key => toggleRow(key),
  __costViewToggleGroup: gkey => toggleGroup(gkey),
  __costViewToggleAllGroups: () => toggleAllGroups(),
  __costViewSetOwnFilter: v => setOwnFilter(v),
  __costViewOnSearch: v => onSearchInput(v),
  __costViewClearSearch: () => clearSearch(),
  __costViewToggleGiftCard: () => toggleGiftCard(),
  __costViewToggleCandleCard: () => toggleCandleCard(),
  __costViewSetGiftDisplayMode: mode => setGiftDisplayMode(mode),
  __costViewSetCandleDisplayMode: mode => setCandleDisplayMode(mode),
  __costViewOnGiftCatChange: () => onGiftCatChange(),
  __costViewAddGiftRecord: () => addGiftRecord(),
  __costViewRenderGiftPicker: () => renderGiftItemPicker(),
  __costViewSelectGift: (catKey, itemId) => selectGiftItem(catKey, itemId),
  __costViewUpdateGiftField: (id, field, value) => updateGiftField(id, field, value),
  __costViewUpdateCandleDate: (id, value) => updateCandlePurchaseDate(id, value),
  __costViewShareCost: () => shareCost(),
  __costViewShareReceivedGifts: () => shareReceivedGifts(),
  __costViewShareGiftHistory: () => shareGiftHistory(),
  __costViewShareRecap: scope => shareRecap(scope),
  __costViewRemoveGiftRecord: id => removeGiftRecord(id),
  __costViewToggleGiftInclude: (id, checked) => toggleGiftInclude(id, checked),
  __costViewAddCandlePurchase: packKey => addCandlePurchase(packKey),
  __costViewRemoveCandlePurchase: id => removeCandlePurchase(id),
  __costViewToggleCandleInclude: (id, checked) => toggleCandleInclude(id, checked),
  __costViewToggleWish: (catKey, itemId, btn) => handleToggleWish(catKey, itemId, btn),
  __costViewSetSeasonAcquire: (itemId, mode) => setSeasonAcquire(itemId, mode),
  __costViewSetMoneyAcquire: (itemId, mode) => setMoneyAcquire(itemId, mode),
  __costViewSetCandleMoneyMode: (itemId, mode) => setCandleMoneyMode(itemId, mode),
  __costViewSetCandleMoneyYen: (itemId, rawValue) => setCandleMoneyYen(itemId, rawValue),
  __costViewSetItemQuantity: (itemId, rawValue) => setItemQuantity(itemId, rawValue),
};
function exposeHandlers() { Object.keys(HANDLERS).forEach(k => { window[k] = HANDLERS[k]; }); }
function removeHandlers() { Object.keys(HANDLERS).forEach(k => { delete window[k]; }); }

function setSeasonAcquire(itemId, mode) {
  const map = loadSeasonAcquireMap();
  map[itemId] = mode;
  saveSeasonAcquireMap(map);
  renderItems();
}

function setMoneyAcquire(itemId, mode) {
  const map = loadMoneyAcquireMap();
  map[itemId] = mode;

  // セット価格のアイテムは1回の購入/ギフトでセット全体を受け取っているため、
  // 同じセットの他のアイテムにも同じ入手経緯（自分で購入/ギフトでもらった）を反映する
  const allMoneyItems = Object.values(ITEM_COST_DATA).flat();
  const target = allMoneyItems.find(it => it.id === itemId);
  const setId = target && target.cost && target.cost.setId;
  if (setId) {
    allMoneyItems.forEach(it => { if (it.cost && it.cost.setId === setId) map[it.id] = mode; });
  }

  saveMoneyAcquireMap(map);
  renderItems();
}

function setCandleMoneyMode(itemId, mode) {
  const map = loadCandleMoneyMap();
  const entry = map[itemId] || {};
  entry.mode = mode;
  map[itemId] = entry;
  saveCandleMoneyMap(map);
  renderItems();
}

function setCandleMoneyYen(itemId, rawValue) {
  const map = loadCandleMoneyMap();
  const entry = map[itemId] || {};
  entry.yen = Math.max(0, Number(rawValue) || 0);
  map[itemId] = entry;
  saveCandleMoneyMap(map);
  renderItems();
}

function setItemQuantity(itemId, rawValue) {
  const map = loadItemQuantityMap();
  const n = Math.max(1, Math.floor(Number(rawValue)) || 1);
  if (n <= 1) delete map[itemId]; // 1個は従来通りの状態のため保存不要
  else map[itemId] = n;
  saveItemQuantityMap(map);
  renderItems();
}

/* ================================================================
   スコープ付きスタイル注入（初回mount時のみ）
   ================================================================ */
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
/* このページの意味色（文字用の〜ink と、白い文字を載せる面の〜solid）。着せ替え中は js/theme.js の TOOL_MAPS が
   背景に対して読める濃さに補正した値（orangeInk・redInk・greenInk・accentSolid・greenSolid）で上書きする */
.item-view {
  --cost-orange-ink: #B84500; --cost-money: #D70015; --cost-green-ink: #1B6E30; --cost-link: #0062CC;
  --cost-solid: #0062CC; --cost-solid-green: #1F7A37;
  --cost-remain-bg: color-mix(in srgb, var(--blue) 46%, #08122b);
}
[data-theme="dark"] .item-view {
  --cost-orange-ink: #FF9F0A; --cost-money: #FF7B73; --cost-green-ink: #30D158; --cost-link: #4DA3FF;
  --cost-solid: #0064D2; --cost-solid-green: #1F7A37;
}
.item-view .cost-wrap { max-width: 720px; margin: 0 auto; --cost-sub: color-mix(in srgb, var(--text-2) 60%, var(--text)); }
@media (min-width: 850px) { .item-view .cost-wrap { max-width: 960px; } }

.item-view .cost-notice-card {
  background: var(--card); border-radius: var(--r); padding: 16px; margin-top: 4px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.07); font-size: 13px; color: var(--cost-sub); line-height: 1.7;
}
.item-view .cost-about-body { font-size: 13px; color: var(--cost-sub); line-height: 1.75; margin-top: 10px; }
.item-view .cost-about-body b { color: var(--text); }
.item-view .cost-about-body a { color: var(--cost-link); font-weight: 600; }

/* ── 統合サマリー（残り＝塗りの面／かかった＝淡い面＋色帯）──
   塗りの面はアクセント（--blue。着せ替え中は文字用のアクセント色が入る）を濃紺と混ぜて暗くし、
   どの着せ替えでも白文字が読める濃さにする。 */
.item-view .cost-summary { background: var(--card); border-radius: var(--r); padding: 10px; margin-top: 6px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); display: flex; flex-direction: column; gap: 8px; }
.item-view .cost-sum-sec { border-radius: var(--r-sm); padding: 10px 12px; }
.item-view .cost-sum-sec.remain { background: var(--cost-remain-bg); color: #fff; }
.item-view .cost-sum-sec.remain :is(.cost-sum-title, .cost-sum-count, .cost-sum-label, .cost-sum-value) { color: #fff; }
.item-view .cost-sum-sec.spent { background: var(--orange-bg); border-left: 4px solid var(--orange); color: var(--text); }
.item-view .cost-sum-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
.item-view .cost-sum-title { font-size: 14px; font-weight: 700; line-height: 1.3; margin: 0; }
.item-view .cost-sum-count { font-size: 12.5px; font-weight: 600; letter-spacing: 0.02em; font-variant-numeric: tabular-nums; }
.item-view .cost-sum-sec.spent .cost-sum-count { color: var(--cost-sub); }
.item-view .cost-sum-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px 14px; }
@media (min-width: 700px) { .item-view .cost-sum-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.item-view .cost-sum-cell { min-width: 0; }
.item-view .cost-sum-label { display: flex; align-items: center; gap: 4px; font-size: 12.5px; font-weight: 600; letter-spacing: 0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-view .cost-sum-sec.spent .cost-sum-label { color: var(--cost-sub); }
.item-view .cost-sum-sec.remain .cost-sum-label .inline-icon { stroke: #fff; }
.item-view .cost-sum-value { font-size: 20px; font-weight: 800; line-height: 1.15; letter-spacing: -0.02em; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.item-view .cost-unit { font-size: 12.5px; font-weight: 700; margin-left: 2px; letter-spacing: 0.02em; }
.item-view .cost-summary-gift-row { display: flex; align-items: center; gap: 6px; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--sep); font-size: 13px; }
.item-view .cost-summary-gift-row span { display: flex; align-items: center; gap: 5px; }
.item-view .cost-summary-gift-row b { font-variant-numeric: tabular-nums; }
.item-view .cost-sum-excl { flex: 1; min-width: 0; font-size: 12.5px; color: var(--cost-sub); font-weight: 600; line-height: 1.45; }
.item-view .cost-sum-more { flex-shrink: 0; display: inline-flex; align-items: center; gap: 2px; color: var(--cost-link); font-weight: 600; }
.item-view .cost-share-chips { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.item-view .cost-share-chip {
  min-height: 44px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 4px;
  background: transparent; border: 1px solid var(--sep); border-radius: var(--r-sm); color: var(--text); cursor: pointer;
  font-family: inherit; font-size: 11.5px; font-weight: 600; line-height: 1.2; letter-spacing: 0.02em; text-align: center;
}
@media (min-width: 700px) { .item-view .cost-share-chip { flex-direction: row; gap: 6px; font-size: 12.5px; } }
.item-view .cost-share-chip:active { transform: scale(0.97); }
.item-view .cost-sum-details { font-size: 12.5px; color: var(--cost-sub); }
.item-view .cost-sum-details summary { cursor: pointer; min-height: 32px; padding: 0 2px; display: flex; align-items: center; gap: 8px; list-style: none; }
.item-view .cost-sum-details summary::-webkit-details-marker { display: none; }
.item-view .cost-sum-details[open] summary .cost-summary-toggle-icon { transform: rotate(90deg); }
.item-view .cost-summary-hint { margin: 4px 0 0; font-size: 12.5px; line-height: 1.7; color: var(--cost-sub); }
@media (prefers-contrast: more) {
  .item-view .cost-sum-sec.remain { background: #08122b; }
  .item-view .cost-sum-sec.spent { background: var(--card); border: 1px solid var(--text-2); border-left-width: 4px; }
  .item-view .cost-share-chip { border-color: var(--cost-sub); }
}
@media (prefers-reduced-motion: reduce) { .item-view .cost-share-chip:active { transform: none; opacity: 0.7; } }

.item-view .cost-collapse-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-height: 44px; padding: 0; margin: -4px 0; background: none; border: 0; color: var(--text); font-family: inherit; font-size: 14px; font-weight: 700; text-align: left; cursor: pointer; }
.item-view .cost-collapse-head > span:first-child { display: flex; align-items: center; gap: 6px; }
.item-view .cost-more-label { margin-top: 28px; }
/* ── フィルターバー（sticky）と季節の見出し（sticky・小計つき・折りたたみ）──
   スクロールはページ全体。上端の「新しいバージョン」の帯（--update-bar-h）の下に留め、
   見出しはさらにフィルターバーの高さ（--cost-bar-h。ResizeObserverで実測）ぶん下に留める。 */
.item-view .cost-filter-bar {
  position: sticky; top: var(--update-bar-h, 0px); z-index: 6; margin: 8px -8px 0; padding: 6px 8px;
  display: flex; flex-direction: column; gap: 6px;
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  backdrop-filter: blur(20px) saturate(180%); -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-radius: 0 0 var(--r) var(--r);
}
.item-view .cost-search { position: relative; display: flex; align-items: center; }
.item-view .cost-search > .inline-icon { position: absolute; left: 11px; color: var(--cost-sub); pointer-events: none; }
.item-view .cost-search input { width: 100%; height: 38px; padding: 0 40px 0 34px; border: 1px solid var(--sep); border-radius: var(--r-sm); background: var(--card); color: var(--text); font-size: 16px; font-family: inherit; -webkit-appearance: none; appearance: none; }
.item-view .cost-search input::-webkit-search-cancel-button { display: none; }
.item-view .cost-search-clear { position: absolute; right: 2px; width: 36px; height: 36px; padding: 0; background: none; border: 0; color: var(--cost-sub); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.item-view .cost-search-clear[hidden] { display: none; }
.item-view .cost-filter-row { display: flex; gap: 6px; align-items: stretch; }
.item-view .cost-seg { display: flex; flex-shrink: 0; padding: 2px; gap: 2px; border-radius: var(--r-sm); background: rgba(118,118,128,0.14); }
.item-view .cost-seg-btn { min-width: 44px; height: 34px; padding: 0 9px; border: 0; border-radius: 7px; background: transparent; color: var(--text); font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.item-view .cost-seg-btn[aria-pressed="true"] { background: var(--card); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,0.14); font-weight: 700; }
.item-view .cost-filter-select { flex: 1; min-width: 0; height: 38px; padding: 0 8px; border: 1px solid var(--sep); border-radius: var(--r-sm); background: var(--card); color: var(--text); font-family: inherit; font-size: 13px; font-weight: 600; }
.item-view .cost-list-head { display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-top: 4px; }
.item-view .cost-list-head .cost-list-label { margin: 0; white-space: nowrap; }
.item-view .cost-jump-row { display: flex; align-items: center; gap: 2px; margin-left: auto; min-width: 0; }
.item-view .cost-jump-select { max-width: 140px; min-width: 0; field-sizing: content; height: 40px; background: transparent; border: 0; padding: 0 2px; font-size: 13px; font-weight: 600; color: var(--cost-link); font-family: inherit; }
.item-view .cost-link-btn { flex-shrink: 0; min-height: 40px; padding: 0 6px; background: none; border: 0; color: var(--cost-link); font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }

.item-view .cost-group { margin-top: 10px; }
.item-view .cost-group-head {
  position: sticky; top: calc(var(--update-bar-h, 0px) + var(--cost-bar-h, 0px)); z-index: 4;
  display: flex; flex-direction: column; gap: 2px; width: 100%; padding: 8px 6px; margin: 0; border: 0; text-align: left; cursor: pointer;
  font-family: inherit; color: var(--text);
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  backdrop-filter: blur(20px) saturate(180%); -webkit-backdrop-filter: blur(20px) saturate(180%);
  scroll-margin-top: calc(var(--update-bar-h, 0px) + var(--cost-bar-h, 0px));
}
.item-view .cost-group { scroll-margin-top: calc(var(--update-bar-h, 0px) + var(--cost-bar-h, 0px)); }
.item-view .cost-group-head:focus-visible { outline: 2px solid var(--blue); outline-offset: -2px; border-radius: var(--r-sm); }
.item-view .cost-group-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.item-view .cost-season-group-name { font-size: 14px; font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 5px; min-width: 0; line-height: 1.3; }
.item-view .cost-group-chev { display: inline-flex; color: var(--cost-sub); transform: rotate(90deg); transition: transform 0.15s; }
.item-view .cost-group-head[aria-expanded="false"] .cost-group-chev { transform: none; }
.item-view .cost-season-group-count { flex-shrink: 0; font-size: 12px; color: var(--cost-sub); font-weight: 600; letter-spacing: 0.02em; }
.item-view .cost-group-sub { display: flex; flex-wrap: wrap; gap: 2px 12px; padding-left: 17px; font-size: 12px; color: var(--cost-sub); font-variant-numeric: tabular-nums; letter-spacing: 0.01em; }
.item-view .cost-sub-set { display: inline-flex; align-items: center; gap: 7px; }
.item-view .cost-sub-set > span { display: inline-flex; align-items: center; gap: 2px; }
.item-view .cost-sub-lbl { font-weight: 700; color: var(--text); }
.item-view .cost-group-sub .is-money { color: var(--cost-money); font-weight: 700; }
.item-view .cost-group-list { content-visibility: auto; }
.item-view .cost-group-list[hidden] { display: none; }
.item-view .cost-empty { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: 12px; }
.item-view .cost-clear-search-btn { min-height: 40px; padding: 0 16px; border: 1px solid var(--sep); border-radius: 999px; background: var(--card); color: var(--cost-link); font-family: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
@media (prefers-reduced-transparency: reduce) {
  .item-view .cost-filter-bar, .item-view .cost-group-head { background: var(--bg); backdrop-filter: none; -webkit-backdrop-filter: none; }
}
@media (prefers-contrast: more) {
  .item-view .cost-filter-bar, .item-view .cost-group-head { background: var(--bg); backdrop-filter: none; -webkit-backdrop-filter: none; }
  .item-view .cost-filter-bar { border-bottom: 1px solid var(--text-2); }
  .item-view .cost-search input, .item-view .cost-filter-select { border-color: var(--cost-sub); }
}
@media (prefers-reduced-motion: reduce) { .item-view .cost-group-chev { transition: none; } }

/* ── 一覧（季節ごとの角丸リスト＋1行型）── */
.item-view .cost-legend { display: flex; flex-wrap: nowrap; gap: 10px; margin: 0 0 2px; padding: 0 4px; overflow-x: auto; scrollbar-width: none; white-space: nowrap; font-size: 11.5px; color: var(--cost-sub); letter-spacing: 0.02em; }
.item-view .cost-legend::-webkit-scrollbar { display: none; }
@media (max-width: 520px) { .item-view .cost-legend .cost-legend-hint { display: none; } }
.item-view .cost-legend span { display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0; }
.item-view .cost-legend .is-season { color: var(--cost-sub); }
.item-view .cost-legend .is-money { color: var(--cost-money); font-weight: 700; }
.item-view .cost-group-list { background: var(--card); border-radius: var(--r); box-shadow: 0 1px 4px rgba(0,0,0,0.07); overflow: hidden; }
.item-view .cost-row-wrap + .cost-row-wrap { border-top: 0.5px solid var(--sep); }
.item-view .cost-row-wrap.owned { background: color-mix(in srgb, var(--green-bg) 55%, transparent); }
.item-view .cost-row { position: relative; display: grid; grid-template-columns: 36px minmax(0, 1fr) auto 44px; align-items: center; column-gap: 6px; min-height: 60px; padding: 4px 2px 4px 12px; }
.item-view .cost-row-toggle { position: absolute; inset: 0; z-index: 0; width: 100%; height: 100%; padding: 0; margin: 0; background: transparent; border: 0; cursor: pointer; border-radius: 0; }
.item-view .cost-row-toggle:focus-visible { outline: 2px solid var(--blue); outline-offset: -2px; }
.item-view .cost-row-toggle:active { background: rgba(127,127,127,0.10); }
.item-view .cost-row > :not(.cost-row-toggle) { position: relative; z-index: 1; pointer-events: none; }
.item-view .cost-row .cost-item-name, .item-view .cost-row .cost-item-wish-btn { pointer-events: auto; }
.item-view .cost-item-thumb { width: 36px; height: 36px; flex-shrink: 0; border-radius: var(--r-sm); overflow: visible; background: var(--bg); display: flex; align-items: center; justify-content: center; position: relative; }
.item-view .cost-item-thumb img { width: 100%; height: 100%; object-fit: contain; padding: 10%; display: block; border-radius: inherit; }
.item-view .cost-item-thumb.img-fallback img { display: none; }
.item-view .cost-item-thumb-fallback { display: none; color: var(--text-3); }
.item-view .cost-item-thumb.img-fallback .cost-item-thumb-fallback { display: block; }
.item-view .cost-owned-mark { position: absolute; right: -4px; bottom: -4px; width: 16px; height: 16px; border-radius: 50%; background: var(--cost-solid-green); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 2px var(--card); }
.item-view .cost-owned-mark .inline-icon { stroke: #fff; stroke-width: 3.2; }
.item-view .cost-row-info { min-width: 0; }
.item-view .cost-item-name { display: inline-block; max-width: 100%; vertical-align: top; font-size: 14px; font-weight: 700; line-height: 1.35; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-decoration: none; }
.item-view .cost-item-name:hover { color: var(--blue); }
.item-view .cost-row-sub { display: flex; align-items: center; gap: 6px; min-width: 0; margin-top: 1px; font-size: 12px; line-height: 1.4; color: var(--cost-sub); white-space: nowrap; letter-spacing: 0.02em; }
.item-view .cost-row-src { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.item-view .cost-note-badge { flex-shrink: 0; font-size: 11px; font-weight: 700; padding: 1px 6px; border-radius: 999px; background: var(--bg); color: var(--cost-sub); }
.item-view .cost-row-wrap.owned .cost-note-badge { background: var(--card); }
.item-view .cost-vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.item-view .cost-row-price { width: 78px; text-align: right; font-variant-numeric: tabular-nums; }
.item-view .cost-price { display: inline-flex; align-items: center; justify-content: flex-end; gap: 2px; font-size: 15px; font-weight: 800; color: var(--cost-orange-ink); white-space: nowrap; letter-spacing: -0.01em; }
.item-view .cost-price.money { color: var(--cost-money); }
.item-view .cost-price.cur-seasonCandle { color: var(--cost-sub); font-weight: 700; }
.item-view .cost-price-unit { font-size: 11.5px; font-weight: 700; margin-left: 1px; }
.item-view .cost-pill { display: inline-block; max-width: 78px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; font-weight: 700; color: var(--cost-sub); background: var(--bg); border-radius: 999px; padding: 2px 8px; letter-spacing: 0.02em; }
.item-view .cost-row-wrap.owned .cost-pill { background: var(--card); }
.item-view .cost-row-wrap.open > .cost-row { background: rgba(127,127,127,0.07); }
.item-view .cost-item-wish-btn { width: 44px; height: 44px; padding: 0; background: none; border: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--cost-sub); }
.item-view .cost-wish-dot { width: 32px; height: 32px; border-radius: 50%; border: 1.5px dashed var(--text-3); display: flex; align-items: center; justify-content: center; }
.item-view .cost-item-wish-btn.is-wish .cost-wish-dot { background: var(--cost-orange-ink); border: 1.5px solid var(--cost-orange-ink); }
.item-view .cost-item-wish-btn.is-wish .inline-icon { stroke: #fff; }
.item-view .cost-item-wish-btn:active .cost-wish-dot { transform: scale(0.92); }

.item-view .cost-row-detail { padding: 2px 14px 14px 56px; }
.item-view .cost-row-detail.anim-in { animation: costDetIn 0.22s ease-out; }
@keyframes costDetIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
.item-view .cost-detail-list { margin: 0; display: grid; gap: 4px; font-size: 13px; line-height: 1.6; }
.item-view .cost-detail-list > div { display: grid; grid-template-columns: 4.5em minmax(0, 1fr); gap: 8px; }
.item-view .cost-detail-list dt { color: var(--cost-sub); font-size: 12px; letter-spacing: 0.02em; padding-top: 1px; }
.item-view .cost-detail-list dd { margin: 0; color: var(--text); }
.item-view .cost-detail-cost { font-weight: 700; }
.item-view .cost-detail-cat { margin-left: 6px; font-size: 12px; color: var(--cost-sub); }
.item-view .cost-qty-note { display: inline; margin-left: 4px; font-size: 12px; font-weight: 600; color: var(--cost-sub); }
.item-view .cost-item-badges { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.item-view .cost-item-badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: transparent; border: 1px solid currentColor; color: var(--cost-sub); }
.item-view .cost-item-badge.owned { color: var(--cost-green-ink); }
.item-view .cost-item-badge.dye-yes { color: var(--cost-green-ink); }
.item-view .cost-item-badge.limited { color: var(--cost-money); }
.item-view .cost-item-note { font-size: 12.5px; color: var(--cost-sub); margin: 8px 0 0; line-height: 1.65; }
.item-view .cost-detail-search { display: inline-flex; align-items: center; gap: 4px; min-height: 36px; margin-top: 6px; font-size: 12.5px; font-weight: 600; color: var(--cost-link); text-decoration: none; }

.item-view .cost-acquire-group { margin-top: 10px; }
.item-view .cost-acquire-label { font-size: 12px; color: var(--cost-sub); margin-bottom: 4px; letter-spacing: 0.02em; }
.item-view .cost-acquire-toggle { display: flex; gap: 6px; flex-wrap: wrap; }
.item-view .cost-acquire-btn { flex: 1; min-width: 120px; min-height: 44px; font-size: 12.5px; font-weight: 700; padding: 6px 8px; border-radius: var(--r-sm); background: var(--card); color: var(--cost-sub); border: 1px solid var(--sep); text-align: center; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px; font-family: inherit; }
.item-view .cost-acquire-btn.active { background: var(--cost-solid); color: #fff; border-color: var(--cost-solid); }
.item-view .cost-acquire-btn.active.free { background: var(--cost-solid-green); border-color: var(--cost-solid-green); }
.item-view .cost-acquire-btn.active .inline-icon { stroke: #fff; }
.item-view .cost-candle-money-input-row, .item-view .cost-quantity-input-row { display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 12.5px; color: var(--cost-sub); flex-wrap: wrap; }
.item-view .cost-candle-money-input { width: 100px; min-height: 40px; background: var(--card); border: 1px solid var(--sep); border-radius: var(--r-sm); padding: 5px 8px; font-size: 16px; font-family: inherit; color: var(--text); }
.item-view .cost-quantity-input { width: 72px; min-height: 40px; background: var(--card); border: 1px solid var(--sep); border-radius: var(--r-sm); padding: 5px 8px; font-size: 16px; font-family: inherit; color: var(--text); }
.item-view .cost-quantity-hint { font-size: 12px; color: var(--cost-sub); }
@media (prefers-reduced-motion: reduce) {
  .item-view .cost-row-detail.anim-in { animation: none; }
}
@media (prefers-contrast: more) {
  .item-view .cost-row-wrap + .cost-row-wrap { border-top-color: var(--cost-sub); }
  .item-view .cost-pill, .item-view .cost-note-badge { border: 1px solid var(--text-2); }
}

.item-view .cost-gift-card { background: var(--card); border-radius: var(--r); padding: 16px; margin-top: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }
.item-view .cost-summary-toggle-icon { transition: transform 0.15s; flex-shrink: 0; display: inline-flex; }
.item-view .cost-gift-card .cost-summary-toggle-icon { color: var(--cost-sub); }
.item-view .cost-note { font-size: 11.5px; color: var(--cost-sub); line-height: 1.6; margin: 0; }
.item-view .cost-gift-form { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
.item-view .cost-gift-form select, .item-view .cost-gift-form input { background: var(--bg); border: 1px solid var(--sep); border-radius: var(--r-sm); padding: 9px 12px; font-size: 13.5px; font-family: inherit; color: var(--text); width: 100%; }
.item-view .cost-gift-form input { font-size: 16px; }
.item-view .cost-gift-form select:disabled { opacity: 0.5; }
.item-view .cost-gift-form-row { display: flex; gap: 8px; }
.item-view .cost-gift-picker { max-height: 220px; overflow-y: auto; background: var(--bg); border-radius: var(--r-sm); display: flex; flex-direction: column; gap: 2px; padding: 4px; }
.item-view .cost-gift-picker-row { display: flex; align-items: center; gap: 10px; padding: 7px 8px; border-radius: 8px; cursor: pointer; }
.item-view .cost-gift-picker-row:hover { background: rgba(0,0,0,0.04); }
.item-view .cost-gift-picker-row:focus-visible { outline: 2px solid var(--blue); outline-offset: -2px; }
.item-view .cost-gift-picker-row.selected { background: var(--orange-bg); }
.item-view .cost-gift-picker-row .cost-item-thumb { width: 32px; height: 32px; }
.item-view .cost-gift-picker-name { flex: 1; min-width: 0; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-view .cost-gift-picker-cat { font-size: 10px; color: var(--cost-sub); background: var(--card); border-radius: 999px; padding: 2px 7px; flex-shrink: 0; white-space: nowrap; }
.item-view .cost-gift-picker-cost { font-size: 12px; color: var(--cost-sub); flex-shrink: 0; }
.item-view .cost-gift-picker-empty { text-align: center; color: var(--cost-sub); font-size: 12.5px; padding: 12px 0; }
.item-view .cost-gift-preview { display: none; align-items: center; gap: 10px; }
.item-view .cost-gift-preview .cost-item-thumb { width: 36px; height: 36px; }
.item-view .cost-gift-preview-label { font-size: 12.5px; color: var(--cost-sub); }
.item-view .cost-gift-record-thumb { width: 36px; height: 36px; flex-shrink: 0; }
.item-view .cost-gift-edit-row { display: flex; gap: 6px; margin-top: 5px; flex-wrap: wrap; }
.item-view .cost-gift-edit-input { background: var(--card); color: var(--text); border: 1px solid var(--sep); border-radius: 7px; padding: 5px 8px; font-size: 16px; font-family: inherit; flex: 1; min-width: 110px; }
.item-view .cost-share-row { display: flex; gap: 10px; margin-top: 12px; }
.item-view .cost-share-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; background: #000; color: #fff; border: 0;
  border-radius: var(--r-sm); padding: 11px 14px; font-size: 13.5px; font-weight: 700; font-family: inherit; cursor: pointer;
}
.item-view .cost-share-btn .inline-icon, .item-view .cost-share-btn svg { stroke: #fff; }
.item-view .cost-share-btn:active { opacity: 0.8; }
[data-theme="dark"] .item-view .cost-share-btn { background: #fff; color: #000; }
[data-theme="dark"] .item-view .cost-share-btn .inline-icon, [data-theme="dark"] .item-view .cost-share-btn svg { stroke: #000; }
.item-view .cost-gift-form-row > * { flex: 1; min-width: 0; }
.item-view .cost-gift-add-btn { background: var(--orange); color: #fff; border-radius: var(--r-sm); min-height: 44px; padding: 10px; font-size: 13.5px; font-weight: 700; text-align: center; cursor: pointer; border: none; font-family: inherit; }
.item-view .cost-gift-add-btn:active { opacity: 0.85; }
.item-view .cost-gift-list { margin-top: 14px; display: flex; flex-direction: column; gap: 8px; }
.item-view .cost-gift-record { background: var(--bg); border-radius: var(--r-sm); padding: 10px 12px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.item-view .cost-gift-record-info { flex: 1; min-width: 160px; font-size: 13px; line-height: 1.5; }
.item-view .cost-gift-record-info b { font-size: 13.5px; }
.item-view .cost-gift-record-sub { font-size: 11.5px; color: var(--cost-sub); margin-top: 2px; }
.item-view .cost-gift-include-toggle { display: flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--cost-sub); white-space: nowrap; }
.item-view .cost-gift-remove-btn { color: var(--cost-money); width: 44px; height: 44px; padding: 0; display: flex; align-items: center; justify-content: center; flex-shrink: 0; cursor: pointer; background: none; border: none; }
.item-view .cost-gift-empty { text-align: center; color: var(--cost-sub); font-size: 12.5px; padding: 14px 0; }

.item-view .cost-candle-pack-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 10px; }
.item-view .cost-candle-pack-btn { background: var(--bg); border-radius: var(--r-sm); padding: 12px 10px; display: flex; flex-direction: column; align-items: center; gap: 2px; text-align: center; cursor: pointer; border: none; font-family: inherit; }
.item-view .cost-candle-pack-btn:active { opacity: 0.8; }
.item-view .cost-candle-pack-price { font-size: 15px; font-weight: 800; color: var(--orange-d); }
.item-view .cost-candle-pack-amount { font-size: 12px; color: var(--cost-sub); display: flex; align-items: center; gap: 4px; }
.item-view .cost-candle-pack-add { font-size: 11px; color: var(--blue); font-weight: 700; margin-top: 4px; }
.item-view .cost-candle-summary-row { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding: 10px 12px; background: var(--orange-bg); border-radius: var(--r-sm); font-size: 12.5px; color: var(--orange-d); font-weight: 700; }

.cost-toast {
  position: fixed; bottom: calc(84px + env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%) translateY(20px);
  background: rgba(0,0,0,0.75); color: #fff; font-size: 13px; font-weight: 500; padding: 10px 20px;
  border-radius: 20px; z-index: 2000; opacity: 0; transition: all 0.25s ease; white-space: nowrap; pointer-events: none;
}
.cost-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
`;
  document.head.appendChild(style);
}

/* ================================================================
   エクスポート
   ================================================================ */
let barObserver = null;
export function mount(container) {
  hostEl = container;
  injectStyles();
  const token = ++mountToken;
  // 絞り込み・開閉は画面の中だけの状態（開き直したら初期状態に戻す）
  ownFilter = 'all'; searchQuery = ''; collapsedGroups.clear(); openItems.clear();

  hostEl.innerHTML = renderShell();
  const bar = hostEl.querySelector('#costFilterBar');
  if (bar && typeof ResizeObserver !== 'undefined') {
    barObserver = new ResizeObserver(() => { if (hostEl) hostEl.style.setProperty('--cost-bar-h', `${bar.offsetHeight}px`); });
    barObserver.observe(bar);
  }
  appendItemFooter(hostEl, 'cost');
  exposeHandlers();

  populateGiftCatSelect();
  onGiftCatChange(); // ピッカーとプレビューを初期状態に
  renderGiftDisplayModeToggle();
  renderGiftHistoryList();

  renderCandlePackGrid();
  renderCandleDisplayModeToggle();
  renderCandlePurchaseList();

  renderItems(); // 画像URL読み込み前の1回目（テキストは即表示できる）
  loadAllItemImages().then(() => {
    if (token !== mountToken || !hostEl) return; // 別ルートへ遷移済みなら描画しない
    renderItems();
    renderGiftItemPicker();
    updateGiftItemPreview();
    renderGiftHistoryList();
  });
}

export function unmount() {
  mountToken++; // 進行中の画像読み込み待ちを無効化
  if (barObserver) { barObserver.disconnect(); barObserver = null; }
  clearTimeout(searchTimer);
  if (hostEl) hostEl.style.removeProperty('--cost-bar-h');
  removeHandlers();
  clearToasts();
  hostEl = null;
}

/* ================================================================
   元 item/item_cost.html との既知の差分

   ・「所持数」「楽譜の合流」「X画像共有」「ギフト検索ピッカー」「履歴の日付/相手の
     インライン編集」「季節見出しのペンダント画像」はすべて移植済み。
   ・通知カード(notice-card)の説明文は元実装の文面をそのまま移植している。
   ・画像URLは元実装のように各カテゴリページをfetchして正規表現で抜き出す代わりに、
     data/items/<cat>.js を直接importして補っている（ハブのアーキテクチャ上の改善）。
   ================================================================ */

/* ================================================================
   wishlist-cost-modal.js — ウィッシュリスト・必要コスト計算モーダル

   item/index.html の #wishModal（openWishList()/renderWishList()系一式、
   「🛒 ウィッシュリスト・必要コスト計算」セクション）を tai-hub へ移植した
   もの。search-modal.js（横断アイテム検索モーダル）と同じ設計を踏襲する：
   document.body へ直接 .modal-overlay/.modal-card（css/chrome.css）を
   append する独立モーダルとして実装し、dashboard-view.js 等の既存ファイルは
   一切変更しない。

   状態の読み書きは js/state.js の getWishIds()/removeWishItem() に委譲
   （wish_<catKey> キー・JSON配列という形状は完全互換、変更しない）。
   所持通貨（キャンドル/星のキャンドル/ハート）の保存キーも、元実装と
   同じ生キー名 'wishOwnCurrency' を nsKey() でラップして使う
   （形状: {candle,heart,starCandle}）。

   コストの突き合わせは cost-view.js が所持済みアイテムの実額集計で使って
   いるのと同じ方式（ITEM_COST_DATA[catKey] を一次データとし、画像URLだけ
   data/items/<catKey>.js から動的importで補う）を、所持済みではなく
   ウィッシュリスト登録済みアイテムに対して行う（タスク指示通り）。
   画像ローダー自体はcost-view.js/search-modal.jsからimportせず、この
   ファイル内に複製している（他ファイルへ依存せず単体で完結させる、という
   search-modal.jsの冒頭コメントに明記された既存の方針を踏襲）。

   対象は12種のウェアラブルカテゴリのみ（section:'special'の楽譜は対象外
   ——cost-view.jsの実額集計が楽譜を対象外としているのと同じスコープ判断で、
   今回のタスク指示でも「12 grid categories」と明示されている）。

   ── エクスポート契約 ──────────────────────────────────────────
     export function open()  … モーダルを開く（初回のみ全カテゴリの
                                画像データを読み込み、以後はキャッシュを再利用）
     export function close() … モーダルを閉じる
   ダッシュボードの「コスト管理」セクションから
   `import * as wishlistCostModal from './wishlist-cost-modal.js'; wishlistCostModal.open()`
   のように呼び出す想定（search-modal.js と同じ import-as-namespace の作法）。

   ── 元実装からの意図的な簡略化・注記（何を・なぜ） ────────────────
   1. 楽譜（music_sheet）のウィッシュリストも、元実装と同じくこの合計に合流させる
      （価格はMUSIC_SHEETSのprice。キャンドル価格が無い楽譜は「価格不明」扱い）。
   2. アイテムの実在確認は ITEM_COST_DATA[catKey] を一次データとして行う
      （cost-view.jsのcomputeAllItems()と同じ前提）。そのため、万一
      wish_<catKey>にcost-data.js未収録のidが残っていた場合はその行を
      表示しない（元実装はカテゴリの全アイテム一覧を一次データにしていた
      ため「価格不明」として表示していたが、cost-data.js は12カテゴリの
      全アイテムを網羅する設計のため、実運用上この差は表面化しない想定）。
   3. X/Twitterへの共有機能は無い（元実装のこのモーダルにも存在しない）。
   上記以外（所持中は自動的に合計から除外、通貨種別ごとの合計・不足分
   （あと◯本／足りています）の算出ロジック、価格不明件数の集計）は
   元実装のロジックをそのまま移植している。
   ================================================================ */

import { CURRENT_LANG, trCat, trItem, trSource, escapeHtml } from '../../js/i18n.js';
import { getCategoryState, getWishIds, removeWishItem, nsKey } from '../../js/state.js';
import { CATEGORY_REGISTRY } from './data/categories.js';
import { ITEM_COST_DATA } from './data/cost-data.js';
import { MUSIC_SHEETS, CAT_KEY as MUSIC_SHEET_CAT_KEY } from './data/music-sheets-data.js';

// 12種のウェアラブルカテゴリ（楽譜は別形状のデータなので、getWishRows()で別枠として合流させる）
const GRID_CATEGORIES = CATEGORY_REGISTRY.filter(c => c.section === 'grid');
const MUSIC_CATEGORY = CATEGORY_REGISTRY.find(c => c.key === MUSIC_SHEET_CAT_KEY);

const STYLE_ID = 'wishlist-cost-modal-styles';
const OVERLAY_ID = 'wishCostModalOverlay';

function t(ja, en) { return CURRENT_LANG === 'en' ? en : ja; }

/* ================================================================
   画像URLの読み込み（cost-view.jsのloadCategoryItemsModule/
   loadAllItemImagesと同じ方式をこのファイル内に複製。ファイル冒頭
   コメント参照——他の「触ってはいけない」既存ファイルには依存しない）
   ================================================================ */
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
      console.error(`[wishlist cost] failed to load item images: ${cat.key}`, e);
      return [cat.key, {}];
    }
  })).then(entries => {
    itemImagesByCat = Object.fromEntries(entries);
    return itemImagesByCat;
  });
  return itemImagesLoadedPromise;
}

// cost-data.js からアイテムのコスト情報（＋名前・出典元）を取得（無ければ null）
function getCostEntry(catKey, itemId) {
  const list = ITEM_COST_DATA[catKey] || [];
  return list.find(e => e.id === itemId) || null;
}

/* ================================================================
   所持通貨（プロフィール別）。item/index.htmlのgetWishOwnCurrency/
   saveWishOwnCurrencyと完全に同じキー名・形状。
   ================================================================ */
function getOwnCurrency() {
  try { return { candle: 0, heart: 0, starCandle: 0, ...JSON.parse(localStorage.getItem(nsKey('wishOwnCurrency'))) }; }
  catch { return { candle: 0, heart: 0, starCandle: 0 }; }
}

// <input type="number">のvalue属性用に数値を文字列化する（item/index.htmlの
// numInputValと同一。Number#toStringの指数表記化・桁区切りカンマ非対応の
// 両方を回避するため）
function numInputVal(n) {
  return Number(n).toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 });
}

/* ================================================================
   モーダルの開閉
   ================================================================ */
let overlayEl = null;

export async function open() {
  injectStyles();
  document.getElementById(OVERLAY_ID)?.remove();

  overlayEl = document.createElement('div');
  overlayEl.className = 'modal-overlay';
  overlayEl.id = OVERLAY_ID;
  overlayEl.addEventListener('click', e => { if (e.target === overlayEl) close(); });
  overlayEl.innerHTML = renderModalHtml();
  document.body.appendChild(overlayEl);

  wireControls();
  requestAnimationFrame(() => overlayEl.classList.add('open'));

  // テキスト・コストはITEM_COST_DATAが同期的import済みなので即描画できる。
  // 画像だけ非同期で読み込み、完了後に再描画する（cost-view.jsのmount()と同じ流れ）
  render();
  try {
    await loadAllItemImages();
    if (!overlayEl || !document.body.contains(overlayEl)) return; // 読み込み待ち中に閉じられていたら描画しない
    render();
  } catch (e) {
    console.error('[wishlist cost] failed to load item images', e);
  }
}

export function close() {
  document.getElementById(OVERLAY_ID)?.classList.remove('open');
}

/* ================================================================
   描画：モーダル外枠
   ================================================================ */
function renderModalHtml() {
  const en = CURRENT_LANG === 'en';
  return `
    <div class="modal-card wcm-card">
      <button type="button" class="modal-close-btn" id="wcmCloseX" aria-label="${en ? 'Close' : '閉じる'}">
        <svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg>
      </button>
      <div class="modal-title">${en ? 'Wishlist &amp; Cost Calculator' : 'ウィッシュリスト・必要コスト計算'}</div>

      <div class="wcm-hint">
        ${en
          ? 'Add items using the cart button on each category page or the Item Cost page. Items you mark as owned are automatically excluded from the totals.'
          : '各カテゴリページや「アイテム別コスト」ページのカートボタンで追加できます。入手済みにしたアイテムは自動で合計から外れます。'}
      </div>

      <div id="wcmBody"><!-- JS --></div>

      <div class="wcm-done-row">
        <button type="button" class="wcm-done-btn" id="wcmDoneBtn">${en ? 'Done' : '閉じる'}</button>
      </div>
    </div>`;
}

function wireControls() {
  const q = sel => overlayEl.querySelector(sel);
  q('#wcmCloseX').addEventListener('click', close);
  q('#wcmDoneBtn').addEventListener('click', close);

  const body = q('#wcmBody');
  // 削除ボタン・所持通貨inputは再描画のたびにDOMごと差し替わるため、
  // 行単位でaddEventListenerし直すのではなく#wcmBody自体に1つだけ
  // 委譲リスナーを張る（search-modal.jsの#smResults委譲パターンと同じ）
  body.addEventListener('click', e => {
    const btn = e.target.closest('[data-act="remove"]');
    if (!btn) return;
    removeWishItem(btn.dataset.cat, btn.dataset.id);
    render();
  });
  body.addEventListener('change', e => {
    if (!e.target.closest('[data-own-currency]')) return;
    saveOwnCurrency();
  });
}

function saveOwnCurrency() {
  const q = sel => overlayEl.querySelector(sel);
  const candle = Math.max(0, Number(q('#wcmOwnCandle')?.value) || 0);
  const starCandle = Math.max(0, Number(q('#wcmOwnStarCandle')?.value) || 0);
  const heart = Math.max(0, Number(q('#wcmOwnHeart')?.value) || 0);
  localStorage.setItem(nsKey('wishOwnCurrency'), JSON.stringify({ candle, heart, starCandle }));
  render();
}

/* ================================================================
   行データの構築（12カテゴリ全ての wish_<catKey> を集約）
   ================================================================ */
function getWishRows() {
  const rows = [];
  GRID_CATEGORIES.forEach(cat => {
    const { owned } = getCategoryState(cat.key);
    getWishIds(cat.key).forEach(id => {
      const entry = getCostEntry(cat.key, id);
      if (!entry) return; // cost-data.js未収録（通常発生しない想定。ファイル冒頭コメント参照）
      rows.push({
        cat, id,
        name: entry.name, nameEn: entry.nameEn,
        source: entry.source,
        cost: entry.cost,
        img: (itemImagesByCat[cat.key] || {})[id],
        owned: !!owned[id],
      });
    });
  });

  // 🎼 楽譜（Music Sheets）：他のカテゴリと同じ行の形に変換して合流させる
  if (MUSIC_CATEGORY) {
    const musicOwned = getCategoryState(MUSIC_SHEET_CAT_KEY).owned;
    getWishIds(MUSIC_SHEET_CAT_KEY).forEach(id => {
      const s = MUSIC_SHEETS.find(m => m.id === id);
      if (!s) return;
      rows.push({
        cat: MUSIC_CATEGORY, id,
        name: s.name, nameEn: s.nameEn,
        source: s.season,
        cost: typeof s.price === 'number' ? { type: 'candle', value: s.price } : { type: 'unknown' },
        img: s.img,
        owned: !!musicOwned[id],
      });
    });
  }
  return rows;
}

function computeTotals(rows) {
  let sumCandle = 0, sumStarCandle = 0, sumHeart = 0, sumMoney = 0, unknownCount = 0, ownedCount = 0;
  rows.forEach(r => {
    if (r.owned) { ownedCount++; return; } // 所持済みは合計から除外
    const cost = r.cost;
    if (!cost) { unknownCount++; return; }
    if (cost.type === 'candle') sumCandle += Number(cost.value) || 0;
    else if (cost.type === 'starCandle') sumStarCandle += Number(cost.value) || 0;
    else if (cost.type === 'heart') sumHeart += Number(cost.value) || 0;
    else if (cost.type === 'money') sumMoney += Number(cost.value) || 0;
    else unknownCount++; // ticket/na/unknown はまとめて「価格不明・対象外」扱い（元実装と同一）
  });
  return { sumCandle, sumStarCandle, sumHeart, sumMoney, unknownCount, ownedCount };
}

/* ================================================================
   コストの表示文字列（種別ごとにアイコンを変える）。tai-hubの共有
   アイコンスプライト（js/icon-sprite.js）に i-coin/i-ticket が無いため、
   その2種だけcost-view.jsに倣いテキストのみの表示にしている。
   ================================================================ */
function costHtml(cost) {
  const en = CURRENT_LANG === 'en';
  if (!cost) return `<span class="wcm-cost unknown">${en ? 'No data' : 'データなし'}</span>`;
  switch (cost.type) {
    case 'candle': return `<span class="wcm-cost"><svg class="inline-icon" width="16" height="16"><use href="#i-candle"/></svg> ${cost.value}</span>`;
    case 'starCandle': return `<span class="wcm-cost"><svg class="inline-icon" width="16" height="16"><use href="#i-star"/></svg> ${cost.value}</span>`;
    case 'heart': return `<span class="wcm-cost"><svg class="inline-icon" width="16" height="16"><use href="#i-heart"/></svg> ${cost.value}</span>`;
    case 'money': return `<span class="wcm-cost money">¥${Number(cost.value).toLocaleString()}</span>`;
    case 'ticket': return `<span class="wcm-cost unknown">${en ? 'Ticket exchange' : 'チケット交換'}</span>`;
    case 'na': return `<span class="wcm-cost unknown">${en ? 'Pass/Ultimate item' : 'パス・究極系'}</span>`;
    default: return `<span class="wcm-cost unknown">${en ? 'Unknown' : '価格不明'}</span>`;
  }
}

/* ================================================================
   描画：本体（一覧・所持通貨入力・合計）
   ================================================================ */
function render() {
  if (!overlayEl) return;
  const bodyEl = overlayEl.querySelector('#wcmBody');
  if (!bodyEl) return;
  const en = CURRENT_LANG === 'en';

  const rows = getWishRows();
  if (rows.length === 0) {
    bodyEl.innerHTML = `<div class="wcm-empty">${en
      ? 'Your wishlist is empty.<br>Add items using the cart button on each category page or the Item Cost page.'
      : 'ウィッシュリストは空です。<br>各カテゴリページや「アイテム別コスト」ページのカートボタンで追加できます。'}</div>`;
    return;
  }

  const totals = computeTotals(rows);
  const own = getOwnCurrency();
  const lackCandle = Math.max(0, totals.sumCandle - own.candle);
  const lackStarCandle = Math.max(0, totals.sumStarCandle - own.starCandle);
  const lackHeart = Math.max(0, totals.sumHeart - own.heart);

  const listHtml = rows.map(r => `
    <div class="wcm-row ${r.owned ? 'is-owned' : ''}">
      <div class="wcm-icon ${r.img ? '' : 'img-fallback'}">
        ${r.img ? `<img src="${r.img}" alt="${escapeHtml(trItem(r))}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('img-fallback')">` : ''}
        <span class="wcm-icon-fallback"><svg class="inline-icon" width="18" height="18"><use href="#i-wing"/></svg></span>
      </div>
      <div class="wcm-info">
        <div class="wcm-name">${escapeHtml(trItem(r))}${r.owned ? `<span class="wcm-owned-badge"><svg class="inline-icon" width="13" height="13"><use href="#i-check"/></svg>${en ? 'Owned' : '入手済み'}</span>` : ''}</div>
        <div class="wcm-meta">${escapeHtml(trCat(r.cat.name))} ・ ${escapeHtml(trSource(r.source))}</div>
      </div>
      ${costHtml(r.cost)}
      <button type="button" class="wcm-remove-btn" data-act="remove" data-cat="${r.cat.key}" data-id="${r.id}" aria-label="${en ? 'Remove' : '削除'}">
        <svg class="inline-icon" width="15" height="15"><use href="#i-close"/></svg>
      </button>
    </div>`).join('');

  bodyEl.innerHTML = `
    <div class="wcm-list">${listHtml}</div>

    <div class="wcm-own-inputs">
      <label><svg class="inline-icon" width="17" height="17"><use href="#i-candle"/></svg> ${en ? 'Owned Candles' : '所持キャンドル'}
        <input type="number" id="wcmOwnCandle" data-own-currency min="0" value="${numInputVal(own.candle)}">
      </label>
      <label><svg class="inline-icon" width="17" height="17"><use href="#i-star"/></svg> ${en ? 'Owned Season Candles' : '所持星のキャンドル'}
        <input type="number" id="wcmOwnStarCandle" data-own-currency min="0" value="${numInputVal(own.starCandle)}">
      </label>
      <label><svg class="inline-icon" width="17" height="17"><use href="#i-heart"/></svg> ${en ? 'Owned Hearts' : '所持ハート'}
        <input type="number" id="wcmOwnHeart" data-own-currency min="0" value="${numInputVal(own.heart)}">
      </label>
    </div>

    <div class="wcm-total-box">
      <div class="wcm-total-row"><span><svg class="inline-icon" width="17" height="17"><use href="#i-candle"/></svg> ${en ? 'Candles needed' : '必要キャンドル合計'}</span><b>${totals.sumCandle.toLocaleString()}</b></div>
      <div class="wcm-total-row"><span class="wcm-total-sub">${en ? 'Still short' : 'あと'}</span>
        <b class="${lackCandle > 0 ? 'lack' : 'enough'}">${lackCandle > 0 ? lackCandle.toLocaleString() + (en ? '' : ' 本') : (en ? 'Enough! ' : '足りています ') + '<svg class="inline-icon" width="14" height="14"><use href="#i-check"/></svg>'}</b></div>
      <div class="wcm-total-row"><span><svg class="inline-icon" width="17" height="17"><use href="#i-star"/></svg> ${en ? 'Season Candles needed' : '必要星のキャンドル合計'}</span><b>${totals.sumStarCandle.toLocaleString()}</b></div>
      <div class="wcm-total-row"><span class="wcm-total-sub">${en ? 'Still short' : 'あと'}</span>
        <b class="${lackStarCandle > 0 ? 'lack' : 'enough'}">${lackStarCandle > 0 ? lackStarCandle.toLocaleString() + (en ? '' : ' 本') : (en ? 'Enough! ' : '足りています ') + '<svg class="inline-icon" width="14" height="14"><use href="#i-check"/></svg>'}</b></div>
      <div class="wcm-total-row"><span><svg class="inline-icon" width="17" height="17"><use href="#i-heart"/></svg> ${en ? 'Hearts needed' : '必要ハート合計'}</span><b>${totals.sumHeart.toLocaleString()}</b></div>
      <div class="wcm-total-row"><span class="wcm-total-sub">${en ? 'Still short' : 'あと'}</span>
        <b class="${lackHeart > 0 ? 'lack' : 'enough'}">${lackHeart > 0 ? lackHeart.toLocaleString() + (en ? '' : ' 個') : (en ? 'Enough! ' : '足りています ') + '<svg class="inline-icon" width="14" height="14"><use href="#i-check"/></svg>'}</b></div>
      ${totals.sumMoney > 0 ? `<div class="wcm-total-row"><span>${en ? 'Real-money total' : '課金合計'}</span><b>¥${totals.sumMoney.toLocaleString()}</b></div>` : ''}
      ${totals.unknownCount > 0 ? `<div class="wcm-total-row"><span>${en ? 'No price data' : '価格不明・対象外'}</span><b>${totals.unknownCount}${en ? '' : ' 件'}</b></div>` : ''}
      ${totals.ownedCount > 0 ? `<div class="wcm-total-row wcm-total-row-muted"><span><svg class="inline-icon" width="15" height="15"><use href="#i-check"/></svg> ${en ? 'Already owned (excluded)' : '入手済み（合計から除外）'}</span><b>${totals.ownedCount}${en ? '' : ' 件'}</b></div>` : ''}
    </div>`;
}

/* ================================================================
   スコープ付きスタイル注入（初回open()時のみ）
   ── モーダルはdocument.bodyへ直接appendするため、.item-view内でのみ
      定義されるitem.css側の色トークンは届かない。ここではハブ共通の
      --hub-*トークン（css/tokens.css）＋自前の--wcm-*トークンのみを使う
      （search-modal.jsと同じ設計）。
   ── 「開く」演出はCLAUDE.mdの方針通り、共有の.modal-overlay/.modal-card
      （css/chrome.css）が持つ@keyframes版アニメーションをそのまま使い、
      このファイル側でtransitionによる独自の開くアニメーションは実装しない。
   ================================================================ */
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
:root { --wcm-owned: #34C759; --wcm-lack: #FF3B30; --wcm-money: #FF3B30; }
[data-theme="dark"] { --wcm-owned: #30D158; --wcm-lack: #FF453A; --wcm-money: #FF453A; }

.wcm-hint { font-size: 12.5px; color: var(--hub-text-2); line-height: 1.6; margin-top: 2px; }

.wcm-empty { font-size: 13px; color: var(--hub-text-2); padding: 28px 4px; text-align: center; line-height: 1.6; }

.wcm-list { display: flex; flex-direction: column; margin-top: 14px; }
.wcm-row { display: flex; align-items: center; gap: 10px; padding: 10px 2px; border-top: 0.5px solid var(--hub-sep); }
.wcm-row:first-child { border-top: 0; }
.wcm-row.is-owned { opacity: 0.7; }

.wcm-icon { position: relative; width: 38px; height: 38px; flex-shrink: 0; border-radius: 8px; overflow: hidden; background: var(--hub-bg); display: flex; align-items: center; justify-content: center; }
.wcm-icon img { width: 100%; height: 100%; object-fit: contain; padding: 12%; display: block; }
.wcm-icon.img-fallback img { display: none; }
.wcm-icon-fallback { display: none; color: var(--hub-text-3); }
.wcm-icon.img-fallback .wcm-icon-fallback { display: block; }

.wcm-info { flex: 1; min-width: 0; }
.wcm-name { font-size: 13.5px; font-weight: 600; color: var(--hub-text); display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.wcm-owned-badge { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 700; color: var(--wcm-owned); }
.wcm-meta { font-size: 11px; color: var(--hub-text-2); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.wcm-cost { flex-shrink: 0; font-size: 13.5px; font-weight: 700; color: var(--hub-text); display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.wcm-cost.money { color: var(--wcm-money); }
.wcm-cost.unknown { color: var(--hub-text-3); font-size: 11.5px; font-weight: 600; }

.wcm-remove-btn { flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%; border: 0; background: var(--hub-sep); color: var(--hub-text-2); display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
.wcm-remove-btn:active { transform: scale(0.92); }

.wcm-own-inputs { display: flex; flex-direction: column; gap: 8px; margin-top: 18px; padding-top: 16px; border-top: 0.5px solid var(--hub-sep); }
.wcm-own-inputs label { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--hub-text); }
.wcm-own-inputs input { margin-left: auto; width: 100px; background: var(--hub-bg); border: 0; border-radius: var(--hub-r-sm); padding: 8px 10px; font-size: 16px; font-family: inherit; color: var(--hub-text); text-align: right; }

.wcm-total-box { margin-top: 14px; padding: 16px; background: var(--hub-accent-bg); border-radius: var(--hub-r); }
.wcm-total-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 5px 0; font-size: 13px; color: var(--hub-text); }
.wcm-total-row span { display: flex; align-items: center; gap: 5px; }
.wcm-total-sub { padding-left: 6px; color: var(--hub-text-2); font-size: 12px; }
.wcm-total-row b { font-weight: 800; display: inline-flex; align-items: center; gap: 4px; }
.wcm-total-row b.lack { color: var(--wcm-lack); }
.wcm-total-row b.enough { color: var(--wcm-owned); }
.wcm-total-row-muted { color: var(--hub-text-2); }
.wcm-total-row-muted span { color: var(--hub-text-2); }

.wcm-done-row { margin-top: 18px; }
.wcm-done-btn {
  width: 100%; padding: 12px; border: 0; border-radius: var(--hub-r-sm); background: var(--hub-accent);
  color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit;
}
`;
  document.head.appendChild(style);
}

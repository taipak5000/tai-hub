/* ================================================================
   share-data.js — 達成率/お気に入り シェア機能の共通データ・画像化基盤

   item/index.html の「達成率をシェア」「お気に入りをシェア」ブロック
   （openCustomizeModal〜shareOverallOnTwitter、getFavoriteItems〜
   shareFavOnTwitter、4260〜4626行目付近）のうち、achievement-share.js/
   favorites-share.js の両方が共有しているロジックをここに集約している：
     - 12種のウェアラブルカテゴリのアイテムデータ読み込み（dashboard-view.js/
       search-modal.js/coord-data.js と同じdynamic import方式をここでも
       複製——search-modal.js冒頭コメントに明記された「他ファイルへ依存せず
       単体で完結させる」という既存方針を踏襲し、coord-data.jsからは
       importしない）
     - 達成率・カテゴリ別所持率・お気に入りアイテム一覧の算出
     - html2canvas（CDN）を使った「DOM上にオフスクリーンでカードを組み立てて
       ラスタライズ→画像として保存/共有」という元実装の画像化方式一式
       （ensureHtml2Canvas/isMobileDevice/tryShareImage/exportShareImage/
       showImagePreview）。元実装はCanvas 2D手動描画ではなく、html2canvasに
       よるDOM→画像変換だったため、ここでも同じ方式で移植している。
     - SHARE_THEMES（背景テーマ6色）・SITE_URL・ハッシュタグ定数
     - 3つの共有画像共通の見た目（エクスポートカード・画像プレビュー
       モーダル・トースト）のスタイル注入

   ── データ互換性 ──────────────────────────────────────────────
   元実装と完全に同じ localStorage キーはこのファイルでは持たない
   （テーマ/カテゴリ選択の shareCustomize_v1 は achievement-share.js側、
   表示スタイル/背景テーマの favShareStyle_v1・favShareTheme_v1 は
   favorites-share.js側で、それぞれ nsKey() 経由の元キー名のまま保持する）。

   ── 意図的な簡略化 ────────────────────────────────────────────
   - 達成率・カテゴリ別所持率は、元実装の readCat()（gameItems_<key>の
     total/owned集計値をそのまま読む）ではなく、category-view.jsの
     ヘッダースコア計算と同じ「現在の当該カテゴリItems配列をowned
     マップでfilterして数える」方式を採用している（stale化したid
     （過去に削除されたアイテムのowned記録）を集計に含めない、より
     堅牢な方式。dashboard-view.js の renderCategoryGrid が採用している
     「Object.values(owned).filter(Boolean).lengthをそのまま数える」
     方式より category-view.js 式の方を優先した）。
   ================================================================ */

import { CURRENT_LANG, escapeHtml } from '../../../js/i18n.js';
import { toolShareUrl } from '../../../js/site-config.js';
import { getCategoryState } from '../../../js/state.js';
import { CATEGORY_REGISTRY } from '../data/categories.js';

export const GRID_CATEGORIES = CATEGORY_REGISTRY.filter(c => c.section === 'grid');

export const SITE_URL = toolShareUrl('item');
export const SHARE_HASHTAG = '#Skyアイテム所持率';
export const FAV_SHARE_HASHTAG = '#Sky所持率管理お気に入り';
export const COORD_SHARE_HASHTAG = '#Sky所持率管理コーデ';
export const RANDOM_SHARE_HASHTAG = '#Sky所持率管理今日のコーデ';
export const CLOSET_SHARE_HASHTAG = '#Sky所持率管理コラージュ';
export const RECAP_SHARE_HASHTAG = '#Sky所持率管理振り返り';
export const COST_SHARE_HASHTAG = '#Skyアイテム所持率';

/* ================================================================
   背景テーマ（item/index.html の SHARE_THEMES を移植。'orange' だけ元は
   var(--orange-d)/var(--orange) を参照していたが、このモジュールは
   .item-view 配下ではない document.body 直下にカードを組み立てるため
   その変数は解決できない——item.cssのライトモード値をそのままリテラル化
   している。他5色は元々リテラルhexだったため無変更）
   ================================================================ */
export const SHARE_THEMES = {
  orange: { label: CURRENT_LANG === 'en' ? 'Orange' : 'オレンジ', grad: 'linear-gradient(135deg, #FF6200 0%, #FF9500 55%, #FFBB00 100%)' },
  blue:   { label: CURRENT_LANG === 'en' ? 'Blue'   : 'ブルー',   grad: 'linear-gradient(135deg, #0051A8 0%, #007AFF 55%, #5AC8FA 100%)' },
  green:  { label: CURRENT_LANG === 'en' ? 'Green'  : 'グリーン', grad: 'linear-gradient(135deg, #1F7A3D 0%, #34C759 55%, #8BE28B 100%)' },
  purple: { label: CURRENT_LANG === 'en' ? 'Purple' : 'パープル', grad: 'linear-gradient(135deg, #4B2E83 0%, #7B4FCB 55%, #B98CFF 100%)' },
  pink:   { label: CURRENT_LANG === 'en' ? 'Pink'   : 'ピンク',   grad: 'linear-gradient(135deg, #B0184D 0%, #FF2D78 55%, #FF8FB3 100%)' },
  dark:   { label: CURRENT_LANG === 'en' ? 'Dark'   : 'ダーク',   grad: 'linear-gradient(135deg, #05070d 0%, #1b2333 100%)' },
};

/* ================================================================
   全カテゴリのアイテムデータ読み込み（dashboard-view.js/search-modal.js/
   coord-data.js と同じ方式をここでも複製）
   ================================================================ */
let allItemsCache = null; // [{ ...item, catKey }, ...]
let allItemsPromise = null;

export function loadAllShareItemsOnce() {
  if (allItemsCache) return Promise.resolve(allItemsCache);
  if (allItemsPromise) return allItemsPromise;

  allItemsPromise = Promise.all(GRID_CATEGORIES.map(async cat => {
    try {
      const mod = await import(`../data/items/${cat.key}.js`);
      const items = Array.isArray(mod.ITEMS) ? mod.ITEMS : [];
      return items.map(item => ({ ...item, catKey: cat.key }));
    } catch (e) {
      console.error(`[item share] failed to load item data: ${cat.key}`, e);
      return [];
    }
  })).then(lists => {
    allItemsCache = lists.flat();
    allItemsPromise = null;
    return allItemsCache;
  }).catch(e => {
    allItemsPromise = null;
    throw e;
  });

  return allItemsPromise;
}

function pct(owned, total) {
  return total > 0 ? Math.round((owned / total) * 100) : null;
}

/* ── 全体達成率（12カテゴリ横断） ── loadAllShareItemsOnce() 完了後に呼ぶこと */
export function getShareStats() {
  if (!allItemsCache) return { own: 0, tot: 0, p: null };
  const stateCache = {};
  let own = 0;
  allItemsCache.forEach(it => {
    const st = stateCache[it.catKey] || (stateCache[it.catKey] = getCategoryState(it.catKey));
    if (st.owned[it.id]) own++;
  });
  return { own, tot: allItemsCache.length, p: pct(own, allItemsCache.length) };
}

/* ── カテゴリ別所持率 ── */
export function getCatShareStats(catKey) {
  if (!allItemsCache) return { owned: 0, total: 0, p: null };
  const { owned: ownedMap } = getCategoryState(catKey);
  const items = allItemsCache.filter(it => it.catKey === catKey);
  const owned = items.filter(it => ownedMap[it.id]).length;
  return { owned, total: items.length, p: pct(owned, items.length) };
}

/* ── お気に入りアイテム（全カテゴリ横断） ── */
export async function getFavoriteShareItems() {
  const items = await loadAllShareItemsOnce();
  const stateCache = {};
  return items.filter(it => {
    const st = stateCache[it.catKey] || (stateCache[it.catKey] = getCategoryState(it.catKey));
    return !!st.fav[it.id];
  });
}

/* ================================================================
   アイコン描画ヘルパー（coord-data.jsのcatIconHtml/itemIconHtmlと同内容
   ——ファイル間の依存を避けるため複製。理由はこのファイル冒頭コメント参照）
   ================================================================ */
export function catIconHtml(cat) {
  return cat.img
    ? `<img src="${cat.img}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : `<svg class="inline-icon" width="20" height="20"><use href="#i-wing"/></svg>`;
}
export function itemIconHtml(cat, item) {
  if (!item) return catIconHtml(cat);
  const src = item.img || (cat && cat.img);
  if (!src) return `<svg class="inline-icon" width="20" height="20"><use href="#i-wing"/></svg>`;
  return `<img src="${src}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
}

function sanitizeFilename(str) {
  return String(str).replace(/[\\/:*?"<>|]/g, '_').trim() || 'share';
}

/* ================================================================
   html2canvas（CDN）を必要になった時点で読み込む（item/index.htmlの
   ensureHtml2Canvasと同一のCDN URL・同一のロード方式）
   ================================================================ */
let html2canvasLoading = null;
function ensureHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve();
  if (html2canvasLoading) return html2canvasLoading;
  html2canvasLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.onload = () => resolve();
    s.onerror = () => { html2canvasLoading = null; reject(new Error('html2canvas load failed')); };
    document.head.appendChild(s);
  });
  return html2canvasLoading;
}

/* スマホ端末かどうかの判定（item/index.htmlのisMobileDeviceを移植。
   PCのWeb Share APIは「画像+テキストを受け取れる共有先」が無いことが
   多く、共有シートで「保存」を選ぶとエラー無しに成功扱いになって
   フォールバック（Xの投稿画面）が二度と出せなくなるため、ファイル共有は
   スマホ端末に限定する） */
function isMobileDevice() {
  if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') {
    return navigator.userAgentData.mobile;
  }
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPod|iPad/i.test(ua)) return true;
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return true;
  return false;
}

/* Web Share API（ファイル共有）を試みる。戻り値は
   'success' / 'cancelled' / 'unsupported'（item/index.htmlのtryShareImageと同一） */
async function tryShareImage(canvas, filename, text) {
  if (!isMobileDevice()) return 'unsupported';
  if (!navigator.share || !navigator.canShare) return 'unsupported';
  try {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return 'unsupported';
    const file = new File([blob], filename, { type: 'image/png' });
    const shareData = text ? { files: [file], text } : { files: [file] };
    if (!navigator.canShare(shareData)) return 'unsupported';
    await navigator.share(shareData);
    return 'success';
  } catch (err) {
    if (err && err.name === 'AbortError') return 'cancelled';
    return 'unsupported';
  }
}

/* ================================================================
   画像プレビュー（保存用）オーバーレイ。Web Share非対応/失敗時のフォール
   バックとして、生成した画像を表示して長押し/右クリック保存、または
   ダウンロードボタンで保存してもらう。shareTextがあれば「Xの投稿画面を
   開く」ボタンも表示する（item/index.htmlのopenImagePreviewを移植。
   固定DOMのモーダルではなく、呼ばれるたびに動的に組み立てる）
   ================================================================ */
const PREVIEW_OVERLAY_ID = 'itemSharePreviewOverlay';
function showImagePreview(dataUrl, filename, shareText) {
  document.getElementById(PREVIEW_OVERLAY_ID)?.remove();
  const en = CURRENT_LANG === 'en';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = PREVIEW_OVERLAY_ID;
  overlay.addEventListener('click', e => { if (e.target === overlay) closePreview(); });

  const twitterHref = shareText ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}` : '';
  overlay.innerHTML = `
    <div class="modal-card">
      <button type="button" class="modal-close-btn" id="ispCloseX" aria-label="${en ? 'Close' : '閉じる'}">
        <svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg>
      </button>
      <div class="modal-title">${shareText ? (en ? 'Save Image & Post to X' : '画像を保存してXへ投稿') : (en ? 'Save Image' : '画像を保存')}</div>
      <div class="ish-hint">${shareText
        ? (en ? '1. Save the image with "Download" below → 2. Tap "Open X Post Screen" and attach the saved image to your post' : '1. 下の「ダウンロード」で画像を保存 → 2. 「Xの投稿画面を開く」を押して、保存した画像を添付して投稿してください')
        : (en ? 'Long-press the image (right-click on PC) and choose "Save Image"' : '画像を長押し（PCの場合は右クリック）して「画像を保存」を選んでください')}</div>
      <img class="ish-preview-img" src="${dataUrl}" alt="">
      <div class="ish-action-row">
        <a class="ish-action-btn primary full" href="${dataUrl}" download="${escapeHtml(filename)}">${en ? 'Download' : 'ダウンロード'}</a>
      </div>
      ${shareText ? `
      <div class="ish-action-row">
        <a class="ish-action-btn twitter full" href="${twitterHref}" target="_blank" rel="noopener noreferrer">${en ? 'Open X Post Screen' : 'Xの投稿画面を開く'}</a>
      </div>` : ''}
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#ispCloseX').addEventListener('click', closePreview);
  requestAnimationFrame(() => overlay.classList.add('open'));
}
function closePreview() {
  document.getElementById(PREVIEW_OVERLAY_ID)?.classList.remove('open');
}

/* ================================================================
   指定したカード生成関数の出力を画像として書き出し、保存/共有する
   共通処理（item/index.htmlのexportElementAsImageを移植）。
   1) スマホ端末ならWeb Share API（ファイル共有）でOS標準の共有シートへ
   2) 非対応/失敗時は画像プレビューを表示し、長押し/ダウンロードボタンで
      保存 + （shareText指定時）Xの投稿画面を開くボタンを提供する
   buildCardFn() はスタイル注入済みの<div>要素（document.bodyへ未追加）を
   返す関数、または既にdocument.bodyへ追加済みの要素を返す関数のどちらでも
   よい（このファイル内ではbuildCardFn自身がappendまで行う設計にしている）。
   ================================================================ */
export async function exportShareImage(buildCardFn, filenameBase, opts = {}) {
  const en = CURRENT_LANG === 'en';
  const { shareText, successToast = (en ? 'Shared!' : '共有しました！') } = opts;
  showShareToast(en ? 'Generating image…' : '画像を生成中…');
  let card = null;
  try {
    await ensureHtml2Canvas();
    card = buildCardFn();
    const attribution = document.createElement('div');
    attribution.className = 'ish-exp-attribution';
    attribution.textContent = '© Sky: Children of the Light Icons by contributors of the Sky: Children of the Light wiki';
    card.appendChild(attribution);

    const canvas = await window.html2canvas(card, { backgroundColor: null, scale: 2, useCORS: true });
    const filename = sanitizeFilename(filenameBase) + '.png';

    const shareResult = await tryShareImage(canvas, filename, shareText);
    if (shareResult === 'success') {
      showShareToast(successToast);
      return;
    }
    if (shareResult === 'cancelled') return; // ユーザー自身が共有シートをキャンセル

    showImagePreview(canvas.toDataURL('image/png'), filename, shareText);
  } catch (err) {
    console.error('[item share] failed to export image', err);
    showShareToast(en ? 'Failed to save the image' : '画像の保存に失敗しました');
  } finally {
    if (card) card.remove();
  }
}

/* ================================================================
   トースト通知（category-view.js/coord-data.jsと同じ「opacity:0の実体を
   先に挿入してから次tickでクラスを付与する」構成をここでも複製）
   ================================================================ */
export function showShareToast(msg) {
  const t = document.createElement('div');
  t.className = 'ish-toast';
  t.textContent = msg;
  const stackIndex = document.querySelectorAll('.ish-toast').length;
  if (stackIndex > 0) t.style.bottom = `calc(84px + env(safe-area-inset-bottom) + ${stackIndex * 44}px)`;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600);
}

/* ================================================================
   共有スタイル注入（achievement-share.js/favorites-share.js 共通）。
   document.bodyへ直接appendするモーダル/カードのため、search-modal.js/
   coord-data.js冒頭コメントと同じ理由で --hub-* トークン（css/tokens.css）
   を使う。X系の黒ボタン・お気に入りの金色等ハブ共通トークンに無い色は
   ここで --ish-* トークンとして定義する。
   ================================================================ */
const SHARED_STYLE_ID = 'item-share-shared-styles';
export function injectShareSharedStyles() {
  if (document.getElementById(SHARED_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SHARED_STYLE_ID;
  style.textContent = `
:root { --ish-x-black: #000000; }

.ish-section-label { font-size: 12px; font-weight: 700; color: var(--hub-text-2); margin: 16px 0 8px; text-transform: uppercase; letter-spacing: 0.4px; }
.ish-section-label:first-child { margin-top: 0; }
.ish-hint { font-size: 12.5px; color: var(--hub-text-2); line-height: 1.6; margin-bottom: 12px; }
.ish-empty-msg { font-size: 13px; color: var(--hub-text-2); text-align: center; padding: 28px 8px; line-height: 1.7; grid-column: 1 / -1; }

.ish-theme-row { display: flex; gap: 10px; flex-wrap: wrap; }
.ish-theme-swatch { width: 36px; height: 36px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; flex-shrink: 0; position: relative; }
.ish-theme-swatch.selected { border-color: var(--hub-text); }
.ish-theme-swatch.selected::after {
  content: ''; position: absolute; inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M4.5 12.5l5 5L20 6.5' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: center; background-size: 44%;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.35));
}

.ish-cat-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.ish-cat-opt { display: flex; align-items: center; gap: 7px; font-size: 13px; color: var(--hub-text); padding: 7px 8px; border-radius: var(--hub-r-sm); cursor: pointer; min-width: 0; }
.ish-cat-opt:hover { background: var(--hub-bg); }
.ish-cat-opt input { width: 16px; height: 16px; flex-shrink: 0; accent-color: var(--hub-accent); }
.ish-cat-icon { width: 20px; height: 20px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; }
.ish-cat-icon img { width: 100%; height: 100%; object-fit: cover; border-radius: 5px; display: block; }
.ish-cat-opt > span:last-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.ish-textarea {
  width: 100%; box-sizing: border-box; border: none; border-radius: var(--hub-r-sm); padding: 10px 12px;
  font-size: 16px; font-family: inherit; color: var(--hub-text); resize: vertical; min-height: 60px; background: var(--hub-bg);
}
.ish-textarea:focus { outline: 2px solid var(--hub-accent); outline-offset: -1px; }

.ish-select {
  background: var(--hub-bg); border: none; padding: 8px 10px; border-radius: var(--hub-r-sm);
  font-size: 13px; color: var(--hub-text); font-weight: 500; outline: none; flex: 1; min-width: 0;
  font-family: inherit;
}

.ish-action-row { display: flex; gap: 10px; margin-top: 12px; }
.ish-action-btn { flex: 1; padding: 12px; border-radius: var(--hub-r-sm); font-size: 14px; font-weight: 700; font-family: inherit; border: 0; cursor: pointer; text-align: center; display: flex; align-items: center; justify-content: center; text-decoration: none; }
.ish-action-btn.primary { background: var(--hub-accent); color: #fff; }
.ish-action-btn.secondary { background: var(--hub-bg); color: var(--hub-text); }
.ish-action-btn.secondary.is-active { background: var(--hub-accent-bg); color: var(--hub-accent); box-shadow: inset 0 0 0 1.5px var(--hub-accent); }
.ish-action-btn.twitter { background: var(--ish-x-black); color: #fff; }
.ish-action-btn.full { width: 100%; }
.ish-action-btn:disabled { opacity: 0.5; cursor: default; }

.ish-preview-img { width: 100%; display: block; margin-top: 4px; margin-bottom: 12px; border-radius: var(--hub-r-sm); background: var(--hub-bg); -webkit-touch-callout: default; }

/* ── オフスクリーンのエクスポートカード（html2canvasでラスタライズする実体） ── */
.ish-export-card {
  position: fixed; left: -9999px; top: 0; width: 560px; box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif;
  padding: 28px; border-radius: 28px;
}
.ish-exp-brand { color: #fff; font-size: 12px; font-weight: 600; opacity: 0.85; letter-spacing: 0.3px; margin-bottom: 6px; }
.ish-exp-title { color: #fff; font-size: 21px; font-weight: 700; margin-bottom: 18px; }
.ish-exp-comment {
  color: #fff; background: rgba(255,255,255,0.16); border-radius: 14px; padding: 10px 14px; font-size: 13px;
  line-height: 1.6; text-align: left; margin-bottom: 14px; white-space: pre-wrap; word-break: break-word;
}
.ish-exp-date { color: rgba(255,255,255,0.75); font-size: 10.5px; text-align: right; margin-top: 10px; }
.ish-exp-attribution { color: rgba(255,255,255,0.55); font-size: 8.5px; line-height: 1.4; text-align: center; margin-top: 10px; }

.ish-num-unit { font-weight: 500; font-size: 0.72em; opacity: 0.7; margin-left: 1px; }

.ish-exp-hero { text-align: center; padding: 6px 0 18px; }
.ish-exp-hero-pct { color: #fff; font-size: 52px; font-weight: 800; letter-spacing: -1px; line-height: 1; }
.ish-exp-hero-label { color: rgba(255,255,255,0.85); font-size: 12px; margin-top: 6px; letter-spacing: 0.5px; }
.ish-exp-hero-nums { color: #fff; font-size: 13px; margin-top: 10px; opacity: 0.92; }

.ish-exp-cat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; background: #fff; border-radius: 18px; padding: 14px; }
.ish-exp-cat-cell { background: #F2F2F7; border-radius: 12px; padding: 10px 6px; text-align: center; }
.ish-exp-cat-cell-icon img { width: 28px; height: 28px; object-fit: cover; border-radius: 8px; display: inline-block; }
.ish-exp-cat-cell-pct { font-size: 13px; font-weight: 700; color: #FF9500; margin-top: 3px; }
.ish-exp-cat-cell-pct.high { color: #34C759; }
.ish-exp-cat-cell-pct.empty { color: #C7C7CC; }
.ish-exp-cat-cell-name { font-size: 8.5px; color: #8E8E93; margin-top: 3px; line-height: 1.3; word-break: break-all; }

.ish-exp-body { background: #fff; border-radius: 18px; padding: 4px 18px; }
.ish-exp-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 0.5px solid rgba(60,60,67,0.12); }
.ish-exp-row:last-child { border-bottom: none; }
.ish-exp-icon { width: 34px; height: 34px; background: #F2F2F7; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
.ish-exp-icon img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
.ish-exp-info { flex: 1; min-width: 0; }
.ish-exp-cat { font-size: 10.5px; color: #8E8E93; }
.ish-exp-name { font-size: 13.5px; font-weight: 600; color: #1C1C1E; margin-top: 1px; }

.ish-exp-fav-icon-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; background: #fff; border-radius: 18px; padding: 14px; }
.ish-exp-fav-icon-cell { background: #F2F2F7; border-radius: 10px; aspect-ratio: 1; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.ish-exp-fav-icon-cell img { width: 100%; height: 100%; object-fit: contain; padding: 10%; box-sizing: border-box; display: block; }

.ish-toast {
  position: fixed; left: 50%; bottom: calc(84px + env(safe-area-inset-bottom)); transform: translateX(-50%) translateY(20px);
  background: rgba(28,28,30,0.92); color: #fff; font-size: 13px; font-weight: 600; padding: 10px 18px; border-radius: 999px;
  box-shadow: 0 4px 14px rgba(0,0,0,0.25); opacity: 0; transition: opacity 0.25s, transform 0.25s; z-index: 1300;
  pointer-events: none; max-width: calc(100vw - 32px); text-align: center;
}
.ish-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
`;
  document.head.appendChild(style);
}

/* ================================================================
   coord-share.js — コーデ機能の「共有まわり」一式

   item/index.html の次の機能を、ランダムコーデ／マイコーデ／クローゼット
   コラージュの3機能から共通で使えるようにまとめて移植したもの。
     1. 写真の位置調整（ドラッグ＆ズームでトリミング範囲を選ぶ）
        … openPhotoCrop() / openPhotoCropForCoord()
     2. コーデ画像のスタイル（ポラロイド風／写真×アイコングリッド）と
        「自分のID」（グリッド画像の写真右下に載る）の保存
        … getCoordShareStyle() / setCoordShareStyle() / getShareUserId() /
          setShareUserId()、UI部品は coordShareControlsHtml() + wireCoordShareControls()
     3. コーデ画像の書き出しとXへの共有
        … shareCoordImage()（share/share-data.js の exportShareImage を利用。
          スマホはWeb Share→非対応ならプレビュー＋Xの投稿画面ボタン）
     4. コーデの共有リンク（コーデ保管庫・「この組み合わせどう？」の相談用）
        … shareCoordLink() / openSharedCoordFromRoute()
        リンクを開いた人は所持の有無に関わらずプレビューでき、
        「マイコーデに保存」できる。

   ── データ互換性 ──────────────────────────────────────────
   localStorageキー coordShareStyle_v1 / shareUserId_v1 は item/index.html と
   同名（nsKey経由）。共有リンクの中身（{n:名前, i:{catKey:itemId}} を
   UTF-8→base64化したもの）も同一形式。
   ただし置き場所が違う：旧 `item/#coord=<code>` → ハブでは
   `#/item/coord=<code>`（router.js が旧形式 `#coord=<code>` も同じ画面へ読み替える）。
   旧実装はカテゴリページのHTMLをfetchして名前を引いていたが、ハブは
   coord-data.js の全アイテム一覧を読み込んで引き当てる（fetch不要）。

   ── 元実装(item/index.html)との違い ─────────────────────────
   * 共有画像はハブ共通の share-data.js の exportShareImage() を使う
     （画像生成→Web Share→プレビュー＋Xの投稿画面、の流れは元実装と同一）。
   * 色はテーマに左右されないよう、画像用カードはすべてリテラル値にしてある
     （画面外のカードは document.body 直下に作るため、ハブのCSS変数が
     ダークテーマで反転しても画像の見た目が変わらないようにする）。
   ================================================================ */

import { CURRENT_LANG, trCat, trItem, escapeHtml } from '../../../js/i18n.js';
import { nsKey } from '../../../js/state.js';
import {
  GRID_CATEGORIES, loadAllItemsOnce, getItemByCatId, getOwnedItemsForCat,
  itemIconHtml, addSavedCoord, injectCoordSharedStyles, showCoordToast,
} from './coord-data.js';
import {
  SHARE_THEMES, SITE_URL, COORD_SHARE_HASHTAG, RANDOM_SHARE_HASHTAG,
  exportShareImage, injectShareSharedStyles, isMobileDevice,
} from '../share/share-data.js';

const STYLE_ID = 'item-coord-share-styles';
const STYLE_KEY = 'coordShareStyle_v1';
const USER_ID_KEY = 'shareUserId_v1';
const POLAROID_RATIO = 452 / 300; // ポラロイド風カードの写真枠の実際の比率（横長寄り）

/* ================================================================
   画像スタイル／自分のIDの保存
   ================================================================ */
export function getCoordShareStyle() {
  try { return localStorage.getItem(nsKey(STYLE_KEY)) === 'grid' ? 'grid' : 'polaroid'; } catch (e) { return 'polaroid'; }
}
export function setCoordShareStyle(style) {
  try { localStorage.setItem(nsKey(STYLE_KEY), style === 'grid' ? 'grid' : 'polaroid'); } catch (e) { /* 保存できない環境では今回限り */ }
}
export function getShareUserId() {
  try { return localStorage.getItem(nsKey(USER_ID_KEY)) || ''; } catch (e) { return ''; }
}
export function setShareUserId(value) {
  try { localStorage.setItem(nsKey(USER_ID_KEY), String(value || '').trim()); } catch (e) { /* 同上 */ }
}
// グリッドスタイルは正方形、ポラロイド風は写真枠の実際の比率に合わせる
export function getCoordPhotoAspectRatio() {
  return getCoordShareStyle() === 'grid' ? 1 : POLAROID_RATIO;
}

/* ================================================================
   画像スタイル切替＋自分のID入力（ランダムコーデ・マイコーデで共通のUI）
   ================================================================ */
export function coordShareControlsHtml() {
  const en = CURRENT_LANG === 'en';
  return `
    <div class="cs-style-toggle" role="group" aria-label="${en ? 'Image style' : '画像のスタイル'}">
      <button type="button" class="cs-style-btn" data-cs-style="polaroid">${en ? 'Polaroid' : 'ポラロイド風'}</button>
      <button type="button" class="cs-style-btn" data-cs-style="grid">${en ? 'Icon Grid' : 'アイコングリッド'}</button>
    </div>
    <div class="cs-id-row">
      <input type="text" class="cs-id-input" maxlength="40" value="${escapeHtml(getShareUserId())}"
        placeholder="${en ? 'Your ID (optional, shown on the photo)' : '自分のID（任意・写真に表示されます）'}">
    </div>`;
}

// rootの中にあるスタイル切替ボタンとID入力を配線する。ルートが複数あっても
// 設定は共有なので、変更時は他のルートの表示も同期する。
export function wireCoordShareControls(root) {
  const sync = () => {
    const style = getCoordShareStyle();
    document.querySelectorAll('.cs-style-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.csStyle === style);
      btn.setAttribute('aria-pressed', String(btn.dataset.csStyle === style));
    });
  };
  root.querySelectorAll('.cs-style-btn').forEach(btn => {
    btn.addEventListener('click', () => { setCoordShareStyle(btn.dataset.csStyle); sync(); });
  });
  root.querySelectorAll('.cs-id-input').forEach(input => {
    input.addEventListener('input', () => setShareUserId(input.value));
  });
  sync();
}

/* ================================================================
   画像カード（画面外に置いてhtml2canvasでPNG化する実体）
   ================================================================ */
const BRAND_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" style="stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-2px;margin-right:3px"><path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h4l1.6 2H18.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z"/></svg>';
const STICKER_SPARKLE = '<svg width="22" height="22" viewBox="0 0 24 24" style="stroke:#007AFF;fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round"><path d="M12 3l1.5 6L20 12l-6.5 1.5L12 21l-1.5-6L4 12l6.5-1.5Z"/></svg>';
const STICKER_CANDLE = '<svg width="22" height="22" viewBox="0 0 24 24" style="stroke:#007AFF;fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round"><g transform="translate(12 12) scale(1.25) translate(-12 -13.5)"><path d="M12 12L5 6.5v3.5c0 1.2 1 2.2 2.2 2.2H12ZM12 12l7-5.5v3.5c0 1.2-1 2.2-2.2 2.2H12Z"/><circle cx="12" cy="12" r="1.6"/><path d="M12 13.6v6.9M9.3 20.5h5.4"/></g></svg>';
const PHOTO_PLACEHOLDER = '<svg width="28" height="28" viewBox="0 0 24 24" style="stroke:rgba(255,255,255,0.35);fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round"><g transform="translate(12 12) scale(1.167) translate(-12 -12)"><path d="M4.5 4.5h15v15h-15Z"/><path d="M4.5 15.5l4.2-4.5a1 1 0 0 1 1.5 0l2.3 2.5 2.5-3a1 1 0 0 1 1.5 0l3 4.5"/><path d="M9 9.5a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z"/></g></svg>';

function brandLabel() { return CURRENT_LANG === 'en' ? 'Item Collection Tracker' : 'アイテム所持率管理'; }

function createdDateText() {
  const today = new Date();
  return CURRENT_LANG === 'en'
    ? `Created ${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`
    : `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日作成`;
}

// ポラロイド風（写真があればテープ・ステッカー付きのポラロイド、その下に装備一覧）
export function buildPolaroidCardEl(title, items, photoDataUrl) {
  const rows = GRID_CATEGORIES.map(cat => {
    const item = items[cat.key];
    if (!item) return '';
    return `
      <div class="ish-exp-row">
        <div class="ish-exp-icon">${itemIconHtml(cat, item)}</div>
        <div class="ish-exp-info">
          <div class="ish-exp-cat">${escapeHtml(trCat(cat.name))}</div>
          <div class="ish-exp-name">${escapeHtml(trItem(item))}</div>
        </div>
      </div>`;
  }).join('');

  const card = document.createElement('div');
  card.className = 'ish-export-card';
  card.style.background = SHARE_THEMES.orange.grad;
  card.innerHTML = `
    <div class="ish-exp-brand">${BRAND_ICON}${brandLabel()}</div>
    <div class="ish-exp-title">${escapeHtml(title)}</div>
    ${photoDataUrl ? `
    <div class="cs-photo-wrap">
      <div class="cs-photo-tape cs-photo-tape-1"></div>
      <div class="cs-photo-tape cs-photo-tape-2"></div>
      <div class="cs-photo-polaroid">
        <img class="cs-photo" src="${photoDataUrl}" alt="">
        <div class="cs-photo-caption">${escapeHtml(title)}</div>
      </div>
      <div class="cs-photo-sticker cs-photo-sticker-1">${STICKER_SPARKLE}</div>
      <div class="cs-photo-sticker cs-photo-sticker-2">${STICKER_CANDLE}</div>
    </div>` : ''}
    <div class="ish-exp-body">${rows}</div>`;
  document.body.appendChild(card);
  return card;
}

// 写真×アイコングリッド（左上に大きく写真、その周りに装備アイコン）
export function buildIconGridCardEl(items, photoDataUrl, playerName) {
  const cells = GRID_CATEGORIES.map(cat => {
    const item = items[cat.key];
    if (!item) return '';
    return `<div class="cs-grid-icon-cell">${itemIconHtml(cat, item)}</div>`;
  }).join('');

  const card = document.createElement('div');
  card.className = 'cs-grid-card';
  card.innerHTML = `
    <div class="cs-grid-brand">${BRAND_ICON}${brandLabel()}</div>
    <div class="cs-grid-body">
      <div class="cs-grid-photo-cell">
        ${photoDataUrl ? `<img src="${photoDataUrl}" alt="">` : `<span>${PHOTO_PLACEHOLDER}</span>`}
        ${playerName ? `<div class="cs-grid-photo-id">${escapeHtml(playerName)}</div>` : ''}
      </div>
      ${cells}
    </div>
    <div class="cs-grid-date">${createdDateText()}</div>`;
  document.body.appendChild(card);
  return card;
}

/* ================================================================
   コーデ画像をXへ共有（画像生成→Web Share→プレビュー＋Xの投稿画面）
   ================================================================ */
export function shareCoordImage(title, items, filenameBase, shareText, photoDataUrl) {
  const en = CURRENT_LANG === 'en';
  if (!items || Object.keys(items).length === 0) {
    showCoordToast(en ? 'No coord selected' : 'コーデが選択されていません');
    return Promise.resolve();
  }
  injectCoordSharedStyles();
  injectShareSharedStyles();
  injectStyles();
  const buildFn = getCoordShareStyle() === 'grid'
    ? () => buildIconGridCardEl(items, photoDataUrl, getShareUserId())
    : () => buildPolaroidCardEl(title, items, photoDataUrl);
  return exportShareImage(buildFn, filenameBase, {
    shareText,
    successToast: en ? 'Shared!' : '共有しました！',
  });
}

// コメント文（アイテムの列挙はしない。内容は画像側で見せる）
export function buildRandomShareText() {
  return CURRENT_LANG === 'en'
    ? `Here's my random coord!\n\n${SITE_URL}\n${RANDOM_SHARE_HASHTAG}`
    : `ランダムコーデが決まりました！\n\n${SITE_URL}\n${RANDOM_SHARE_HASHTAG}`;
}
export function buildMyCoordShareText(label) {
  return CURRENT_LANG === 'en'
    ? `My "${label}" coord\n\n${SITE_URL}\n${COORD_SHARE_HASHTAG}`
    : `「${label}」のコーデ\n\n${SITE_URL}\n${COORD_SHARE_HASHTAG}`;
}

/* ================================================================
   🔗 コーデの共有リンク
   ================================================================ */
function encodeBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function decodeBase64Utf8(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function buildCoordShareUrl(items, name) {
  const compact = {};
  Object.entries(items).forEach(([catKey, item]) => { if (item && item.id) compact[catKey] = item.id; });
  const code = encodeBase64Utf8(JSON.stringify({ n: name || '', i: compact }));
  const base = location.href.split('#')[0];
  return `${base}#/item/coord=${encodeURIComponent(code)}`;
}

export async function shareCoordLink(items, name) {
  const en = CURRENT_LANG === 'en';
  if (!items || Object.keys(items).length === 0) {
    showCoordToast(en ? 'No coord selected' : 'コーデが選択されていません');
    return;
  }
  const url = buildCoordShareUrl(items, name);
  const shareText = en
    ? `Check out this coord: "${name}"! What do you think?`
    : `「${name}」というコーデを考えてみました！どう思いますか？`;
  if (isMobileDevice() && navigator.share) {
    try {
      await navigator.share({ title: name, text: shareText, url });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      // 失敗時はコピーへフォールバック
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    showCoordToast(en ? 'Link copied! Paste it anywhere to share.' : 'リンクをコピーしました！好きな場所に貼り付けて共有できます。');
  } catch (e) {
    openLinkPreview(url);
  }
}

// クリップボードが使えない環境向けに、リンクを表示して手動コピーできるモーダルを出す
const LINK_OVERLAY_ID = 'coordLinkPreviewOverlay';
function openLinkPreview(url) {
  injectCoordSharedStyles();
  injectStyles();
  const en = CURRENT_LANG === 'en';
  document.getElementById(LINK_OVERLAY_ID)?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = LINK_OVERLAY_ID;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
  overlay.innerHTML = `
    <div class="modal-card">
      <button type="button" class="modal-close-btn" aria-label="${en ? 'Close' : '閉じる'}"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      <div class="modal-title">${en ? 'Share Link' : '共有リンク'}</div>
      <textarea class="cs-link-text" readonly></textarea>
      <div class="cs-hint">${en ? 'Long-press or select the text above to copy it manually.' : '上のテキストを長押しまたは選択してコピーしてください。'}</div>
    </div>`;
  document.body.appendChild(overlay);
  const ta = overlay.querySelector('textarea');
  ta.value = url;
  ta.addEventListener('click', () => ta.select());
  overlay.querySelector('.modal-close-btn').addEventListener('click', () => overlay.classList.remove('open'));
  requestAnimationFrame(() => { overlay.classList.add('open'); ta.select(); });
}

/* ── 共有リンクを開いたときのプレビュー ── */
const SHARED_OVERLAY_ID = 'sharedCoordOverlay';
let sharedCoord = null; // { name, items:{[catKey]:Item} }

// #/item/coord=<code> の "coord=<code>" 部分を受け取り、プレビューを開く
export async function openSharedCoordFromRoute(sub) {
  const m = /^coord=(.+)$/.exec(sub || '');
  if (!m) return;
  let payload;
  try {
    payload = JSON.parse(decodeBase64Utf8(decodeURIComponent(m[1])));
  } catch (e) { return clearCoordHash(); }
  if (!payload || typeof payload.i !== 'object' || payload.i === null) return clearCoordHash();

  const catKeys = Object.keys(payload.i).filter(k => GRID_CATEGORIES.some(c => c.key === k));
  if (catKeys.length === 0) return clearCoordHash();

  const en = CURRENT_LANG === 'en';
  try {
    await loadAllItemsOnce();
  } catch (e) {
    console.error('[coord-share] failed to load item data', e);
    showCoordToast(en ? 'Failed to load item data.' : 'アイテムデータの読み込みに失敗しました。');
    return clearCoordHash();
  }
  const items = {};
  catKeys.forEach(catKey => {
    const found = getItemByCatId(catKey, String(payload.i[catKey]));
    if (found) items[catKey] = found;
  });
  const rawName = typeof payload.n === 'string' ? payload.n.trim().slice(0, 60) : '';
  sharedCoord = { name: rawName || (en ? 'Shared Coord' : '共有されたコーデ'), items };
  renderSharedCoord();
}

function clearCoordHash() {
  // ダッシュボードはすでに表示済みなので、URLだけ #/item に戻す（replaceStateはhashchangeを起こさない）
  if (/^#\/item\/coord=/.test(location.hash)) history.replaceState(null, '', '#/item');
}

function renderSharedCoord() {
  injectCoordSharedStyles();
  injectStyles();
  const en = CURRENT_LANG === 'en';
  document.getElementById(SHARED_OVERLAY_ID)?.remove();

  const rows = GRID_CATEGORIES.map(cat => {
    const item = sharedCoord.items[cat.key];
    if (!item) return '';
    const owned = getOwnedItemsForCat(cat.key).some(o => String(o.id) === String(item.id));
    return `
      <div class="cs-shared-row">
        <div class="cs-shared-icon">${itemIconHtml(cat, item)}</div>
        <div class="cs-shared-info">
          <div class="cs-shared-cat">${escapeHtml(trCat(cat.name))}</div>
          <div class="cs-shared-name">${escapeHtml(trItem(item))}</div>
        </div>
        ${owned ? `<svg class="inline-icon cs-shared-owned" width="18" height="18" aria-label="${en ? 'Owned' : '所持済み'}"><use href="#i-check"/></svg>` : ''}
      </div>`;
  }).join('');
  const hasItems = Object.keys(sharedCoord.items).length > 0;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = SHARED_OVERLAY_ID;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSharedCoord(); });
  overlay.innerHTML = `
    <div class="modal-card">
      <button type="button" class="modal-close-btn" id="scCloseX" aria-label="${en ? 'Close' : '閉じる'}"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      <div class="modal-title">${en ? 'Shared Coord' : '共有されたコーデ'}</div>
      <div class="cd-card">
        <div class="cd-card-header"><div class="cd-card-title">${escapeHtml(sharedCoord.name)}</div></div>
        ${hasItems ? rows : `<div class="cd-empty-msg">${en ? 'No items could be loaded.' : 'アイテムを読み込めませんでした。'}</div>`}
      </div>
      <div class="cs-hint"><svg class="inline-icon cs-shared-owned" width="14" height="14"><use href="#i-check"/></svg> ${en ? '= you already own this' : '＝ 所持済み'}</div>
      <div class="cd-action-row">
        <button type="button" class="cd-action-btn primary full" id="scSaveBtn" ${hasItems ? '' : 'disabled'}>${en ? 'Save to My Coord' : 'マイコーデに保存'}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#scCloseX').addEventListener('click', closeSharedCoord);
  overlay.querySelector('#scSaveBtn').addEventListener('click', () => {
    if (!sharedCoord || Object.keys(sharedCoord.items).length === 0) return;
    addSavedCoord(sharedCoord.name, sharedCoord.items);
    showCoordToast(en ? 'Saved to My Coord!' : 'マイコーデに保存しました！');
    closeSharedCoord();
  });
  requestAnimationFrame(() => overlay.classList.add('open'));
}

// 閉じる（URLの #/item/coord=… を消し、再読み込み時に同じプレビューが再表示されないようにする）
export function closeSharedCoord() {
  document.getElementById(SHARED_OVERLAY_ID)?.classList.remove('open');
  sharedCoord = null;
  clearCoordHash();
}

/* ================================================================
   🖼️ 写真の位置調整（ドラッグ＆ズームでトリミング範囲を自分で選ぶ）
   選択直後に自動で中央クロップするのではなく、プレビューを見ながら位置と
   ズームを決めてから、枠の中だけを画像として書き出す。
   Promiseは「決定」でdata URL、「キャンセル/読み込み失敗」でnullを返す。
   ================================================================ */
const CROP_OVERLAY_ID = 'photoCropOverlay';

export function openPhotoCropForCoord(file) {
  return openPhotoCrop(file, { ratio: getCoordPhotoAspectRatio() });
}

export function openPhotoCrop(file, { ratio = 1, outSize = 900 } = {}) {
  injectCoordSharedStyles();
  injectStyles();
  const en = CURRENT_LANG === 'en';
  if (!file || !/^image\//.test(file.type)) {
    showCoordToast(en ? 'Please select an image file' : '画像ファイルを選択してください');
    return Promise.resolve(null);
  }
  return new Promise(resolve => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      showCoordToast(en ? 'Failed to load the image' : '画像の読み込みに失敗しました');
      resolve(null);
    };
    img.onload = () => startCrop(img, objectUrl, ratio, outSize, resolve);
    img.src = objectUrl;
  });
}

function startCrop(img, objectUrl, ratio, outSize, resolve) {
  const en = CURRENT_LANG === 'en';
  document.getElementById(CROP_OVERLAY_ID)?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = CROP_OVERLAY_ID;
  overlay.innerHTML = `
    <div class="modal-card">
      <button type="button" class="modal-close-btn" data-crop="cancel" aria-label="${en ? 'Close' : '閉じる'}"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      <div class="modal-title">${en ? 'Adjust Photo Position' : '写真の位置を調整'}</div>
      <div class="cs-hint">${en
        ? 'Drag to reposition, and use the slider to zoom in/out. Nothing outside the frame will be included.'
        : 'ドラッグして位置を調整し、スライダーで拡大・縮小できます。枠の外側は画像に含まれません。'}</div>
      <div class="cs-crop-viewport"><img alt=""></div>
      <div class="cs-crop-zoom-row">
        <svg class="inline-icon" width="18" height="18"><use href="#i-search"/></svg>
        <input type="range" class="cs-crop-slider" min="100" max="300" value="100" aria-label="${en ? 'Zoom' : 'ズーム'}">
      </div>
      <div class="cd-action-row">
        <button type="button" class="cd-action-btn secondary" data-crop="cancel">${en ? 'Cancel' : 'キャンセル'}</button>
        <button type="button" class="cd-action-btn primary" data-crop="ok">${en ? 'Use This Position' : 'この位置で決定'}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const viewport = overlay.querySelector('.cs-crop-viewport');
  const imgEl = viewport.querySelector('img');
  const slider = overlay.querySelector('.cs-crop-slider');
  viewport.style.aspectRatio = String(ratio);
  imgEl.src = objectUrl;
  overlay.classList.add('open'); // 幅を測るため、先に表示状態にする

  const vw = viewport.clientWidth || 300;
  const vh = vw / ratio;
  const nw = img.naturalWidth, nh = img.naturalHeight;
  const minScale = Math.max(vw / nw, vh / nh);
  const st = { scale: minScale, ox: (vw - nw * minScale) / 2, oy: (vh - nh * minScale) / 2 };

  const clamp = () => {
    st.ox = Math.min(0, Math.max(vw - nw * st.scale, st.ox));
    st.oy = Math.min(0, Math.max(vh - nh * st.scale, st.oy));
  };
  const render = () => {
    imgEl.style.width = `${nw * st.scale}px`;
    imgEl.style.height = `${nh * st.scale}px`;
    imgEl.style.transform = `translate(${st.ox}px, ${st.oy}px)`;
  };
  // 枠の中心に写っていた画像上の点が、ズーム後も中心に残るようにする
  const zoomTo = factor => {
    const f = Math.min(3, Math.max(1, factor));
    const cx = vw / 2, cy = vh / 2;
    const px = (cx - st.ox) / st.scale, py = (cy - st.oy) / st.scale;
    st.scale = minScale * f;
    st.ox = cx - px * st.scale;
    st.oy = cy - py * st.scale;
    clamp();
    render();
    slider.value = String(Math.round(f * 100));
  };
  render();

  slider.addEventListener('input', () => zoomTo(Number(slider.value) / 100));
  viewport.addEventListener('wheel', e => {
    e.preventDefault();
    zoomTo(st.scale / minScale * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
  }, { passive: false });

  // ドラッグ（マウス・タッチ共通のPointer Events）
  let drag = null;
  viewport.addEventListener('pointerdown', e => {
    drag = { x: e.clientX, y: e.clientY, ox: st.ox, oy: st.oy };
    viewport.classList.add('dragging');
    try { viewport.setPointerCapture(e.pointerId); } catch (err) { /* no-op */ }
  });
  viewport.addEventListener('pointermove', e => {
    if (!drag) return;
    st.ox = drag.ox + (e.clientX - drag.x);
    st.oy = drag.oy + (e.clientY - drag.y);
    clamp();
    render();
  });
  const endDrag = () => { drag = null; viewport.classList.remove('dragging'); };
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);

  const finish = dataUrl => {
    URL.revokeObjectURL(objectUrl);
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 400);
    resolve(dataUrl);
  };
  overlay.addEventListener('click', e => { if (e.target === overlay) finish(null); });
  overlay.querySelectorAll('[data-crop="cancel"]').forEach(b => b.addEventListener('click', () => finish(null)));
  overlay.querySelector('[data-crop="ok"]').addEventListener('click', () => {
    const outW = ratio >= 1 ? outSize : Math.round(outSize * ratio);
    const outH = ratio >= 1 ? Math.round(outSize / ratio) : outSize;
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const k = outW / vw;
    canvas.getContext('2d').drawImage(img, st.ox * k, st.oy * k, nw * st.scale * k, nh * st.scale * k);
    finish(canvas.toDataURL('image/jpeg', 0.85));
  });
}

/* ================================================================
   スコープ付きスタイル注入
   ================================================================ */
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.cd-action-btn.x-share { background: #000; color: #fff; }
[data-theme="dark"] .cd-action-btn.x-share { background: #fff; color: #000; }
.cs-hint { font-size: 12.5px; color: var(--hub-text-2); line-height: 1.6; margin: 8px 0; }

/* ── 画像スタイル切替・ID入力 ── */
.cs-style-toggle { display: flex; gap: 8px; margin-top: 12px; }
.cs-style-btn {
  flex: 1; font-size: 12px; font-weight: 700; padding: 9px 8px; border-radius: var(--hub-r-sm); font-family: inherit;
  background: var(--hub-bg); color: var(--hub-text-2); border: 1px solid var(--hub-sep); text-align: center; cursor: pointer;
}
.cs-style-btn.active { background: var(--hub-accent); color: #fff; border-color: var(--hub-accent); }
.cs-id-row { margin-top: 10px; }
.cs-id-input {
  width: 100%; box-sizing: border-box; background: var(--hub-bg); color: var(--hub-text); border: 1px solid var(--hub-sep);
  border-radius: var(--hub-r-sm); padding: 9px 12px; font-size: 16px; font-family: inherit; outline: none;
}
.cs-id-input::placeholder { color: var(--hub-text-3); }

/* ── 写真の添付行 ── */
.cs-photo-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 10px; }
.cs-photo-pick {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: var(--hub-r-sm);
  background: var(--hub-bg); color: var(--hub-text); border: 1px solid var(--hub-sep); font-size: 13px; font-weight: 600; cursor: pointer;
}
.cs-photo-status { font-size: 12px; color: var(--hub-text-2); }
.cs-photo-clear { border: 0; background: none; color: var(--hub-accent); font-weight: 600; font-size: 12px; cursor: pointer; font-family: inherit; padding: 4px; }
.cs-photo-thumb { width: 34px; height: 34px; border-radius: 8px; object-fit: cover; }

/* ── 共有リンク（手動コピー用） ── */
.cs-link-text {
  width: 100%; min-height: 80px; box-sizing: border-box; font-size: 11px; font-family: ui-monospace, monospace;
  background: var(--hub-bg); color: var(--hub-text); border: 1px solid var(--hub-sep); border-radius: var(--hub-r-sm); padding: 10px;
}

/* ── 共有リンクのプレビュー ── */
.cs-shared-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 0.5px solid var(--hub-sep); }
.cs-shared-row:last-child { border-bottom: 0; }
.cs-shared-icon { width: 34px; height: 34px; background: var(--hub-card); border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
.cs-shared-icon img { width: 100%; height: 100%; object-fit: contain; padding: 10%; box-sizing: border-box; }
.cs-shared-info { flex: 1; min-width: 0; }
.cs-shared-cat { font-size: 11px; color: var(--hub-text-2); }
.cs-shared-name { font-size: 14px; font-weight: 600; margin-top: 1px; }
.cs-shared-owned { color: var(--cd-green); stroke: currentColor; fill: none; flex-shrink: 0; }

/* ── 写真の位置調整 ── */
.cs-crop-viewport {
  position: relative; width: 100%; max-width: 440px; overflow: hidden; border-radius: 14px; background: #000; margin: 12px auto 0;
  touch-action: none; cursor: grab; user-select: none;
}
.cs-crop-viewport.dragging { cursor: grabbing; }
.cs-crop-viewport img { position: absolute; top: 0; left: 0; max-width: none; pointer-events: none; }
.cs-crop-zoom-row { display: flex; align-items: center; gap: 10px; margin-top: 14px; color: var(--hub-text-2); }
.cs-crop-slider { flex: 1; accent-color: var(--hub-accent); }

/* ── 画像カード：ポラロイド風の写真まわり（画面外のカードで使う。色はすべてリテラル） ── */
.cs-photo-wrap { position: relative; margin: 8px 16px 30px; }
.cs-photo-polaroid {
  background: #fff; padding: 10px 10px 32px; border-radius: 4px; transform: rotate(-3deg);
  box-shadow: 0 10px 24px rgba(0,0,0,0.25); position: relative;
}
.cs-photo { display: block; width: 100%; max-height: 300px; object-fit: cover; border-radius: 2px; }
.cs-photo-caption { text-align: center; font-size: 13px; font-weight: 700; color: #6b5b4f; letter-spacing: 0.3px; margin-top: 6px; }
.cs-photo-tape { position: absolute; width: 64px; height: 24px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); opacity: 0.85; z-index: 2; }
.cs-photo-tape-1 { top: -10px; left: 18px; background: #FFD4E2; transform: rotate(-9deg); }
.cs-photo-tape-2 { top: -8px; right: 14px; background: #FFF3B0; transform: rotate(11deg); }
.cs-photo-sticker { position: absolute; z-index: 3; text-shadow: 0 2px 3px rgba(0,0,0,0.18); }
.cs-photo-sticker-1 { top: -14px; right: -8px; transform: rotate(16deg); }
.cs-photo-sticker-2 { bottom: -10px; left: -12px; transform: rotate(-18deg); }

/* ── 画像カード：写真×アイコングリッド ── */
.cs-grid-card {
  position: fixed; left: -9999px; top: 0; width: 560px; box-sizing: border-box; padding: 16px; border-radius: 24px;
  font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif;
  background: linear-gradient(135deg, #3a2f28 0%, #6b5645 100%);
}
.cs-grid-brand { color: rgba(255,255,255,0.85); font-size: 12px; font-weight: 600; margin-bottom: 10px; }
.cs-grid-body { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.cs-grid-photo-cell {
  grid-column: span 2; grid-row: span 2; position: relative; aspect-ratio: 1 / 1; border-radius: 16px; overflow: hidden;
  background: #1c1c1e; display: flex; align-items: center; justify-content: center;
}
.cs-grid-photo-cell img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cs-grid-photo-id {
  position: absolute; right: 8px; bottom: 6px; color: #fff; font-size: 12px; font-weight: 700; letter-spacing: 0.2px;
  text-shadow: 0 1px 4px rgba(0,0,0,0.85); max-width: calc(100% - 16px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cs-grid-icon-cell {
  aspect-ratio: 1 / 1; border-radius: 14px; background: rgba(0,0,0,0.35); border: 1.5px solid rgba(255,255,255,0.14);
  display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.cs-grid-icon-cell img { width: 68%; height: 68%; object-fit: contain; }
.cs-grid-date { color: rgba(255,255,255,0.65); font-size: 10.5px; text-align: right; margin-top: 10px; }
`;
  document.head.appendChild(style);
}

export function ensureCoordShareStyles() {
  injectCoordSharedStyles();
  injectShareSharedStyles();
  injectStyles();
}

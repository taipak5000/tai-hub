/* ================================================================
   closet-collage.js — 🖼️ クローゼットコラージュ

   item/index.html の「クローゼットコラージュ」モーダル（closetBgPreset()〜
   shareClosetOnTwitter()、3481〜3764行目付近）を移植したもの。所持
   アイテムのアイコンや自分の写真を rows×cols のマス目（2〜5、可変）に
   並べ、8種類の背景プリセットと組み合わせて1枚の画像として書き出せる。

   ── データ形状（coord-data.jsのCLOSET_KEY = 'closetCollages_v1'） ──
   Array<{ id:number, name:string, rows:number, cols:number,
           cells:Array<null|{type:'item',catKey,itemId}|{type:'photo',dataUrl}>,
           bg:string, caption:string, createdAt:string }>
   'item'セルはID参照のみを保持する（表示のたびにallItemsCacheと突き
   合わせて解決する）元実装通りの形状。保存/読み込みは coord-data.js の
   getClosetCollages()/saveClosetCollages() に委譲している。

   ── エクスポート契約 ──────────────────────────────────────────
     export async function open()  … モーダルを開く（一覧表示から開始。
                                      セル内容の解決にallItemsCacheが
                                      必要なため、表示前に必ず読み込みを
                                      待つ——元実装のopenCloset()と同じ）。
     export function close()       … モーダルを閉じる（開いていれば、
                                      マス目ピッカー・画像プレビューの
                                      入れ子モーダルも一緒に閉じる）。
   random-coord.js/my-coord.jsと同じ「document.bodyへ直接
   <div class="modal-overlay">をappendする」方式。ダッシュボードの
   「コーデ機能」セクションから
   `import * as closetCollage from './coord/closet-collage.js'; closetCollage.open()`
   のように呼び出す想定（dashboard-view.jsへの配線は後続パスで行う）。

   ── 写真・画像共有 ─────────────────────────────────────────
   写真セルは元実装と同じドラッグ＆ズーム式の位置調整（coord-share.jsの
   openPhotoCrop、マス目は正方形固定なので1:1）。画像の書き出しは
   share/share-data.js の exportShareImage() を使い、元実装の
   shareClosetOnTwitter と同じく「スマホはWeb Share API→非対応ならプレビュー
   （長押し保存・ダウンロード）＋Xの投稿画面を開くボタン」の流れになる。
   ================================================================ */

import { CURRENT_LANG, trCat, trItem, escapeHtml } from '../../../js/i18n.js';
import {
  GRID_CATEGORIES,
  loadAllItemsOnce, getItemByCatId, getOwnedItemsForCat,
  itemIconHtml, catIconHtml,
  getClosetCollages, saveClosetCollages,
  CLOSET_MIN_GRID, CLOSET_MAX_GRID, CLOSET_BG_PRESETS, closetBgPreset,
  injectCoordSharedStyles, showCoordToast,
} from './coord-data.js';
import { openPhotoCrop, ensureCoordShareStyles } from './coord-share.js';
import { SITE_URL, CLOSET_SHARE_HASHTAG, exportShareImage, injectShareSharedStyles } from '../share/share-data.js';

const STYLE_ID = 'item-closet-collage-styles';
const OVERLAY_ID = 'closetModalOverlay';
const CELL_OVERLAY_ID = 'closetCellPickerOverlay';

let overlayEl = null;
let closetEditing = null;      // 編集中のコラージュ { id, name, rows, cols, cells, bg, caption }
let closetPickingIndex = null; // マス目ピッカーで選択対象になっているマスのindex

/* ================================================================
   一覧表示
   ================================================================ */
function showListView() {
  if (!overlayEl) return;
  overlayEl.querySelector('#clListView').style.display = 'block';
  overlayEl.querySelector('#clEditView').style.display = 'none';
  renderList();
}

function cellPreviewHtml(cell) {
  if (!cell) return `<div class="cl-cell cl-cell-empty"></div>`;
  if (cell.type === 'photo') return `<div class="cl-cell cl-cell-photo"><img src="${cell.dataUrl}" alt=""></div>`;
  const cat = GRID_CATEGORIES.find(c => c.key === cell.catKey);
  const item = cat ? getItemByCatId(cell.catKey, cell.itemId) : null;
  return `<div class="cl-cell cl-cell-item">${item && cat ? itemIconHtml(cat, item) : (cat ? catIconHtml(cat) : '')}</div>`;
}

function renderList() {
  const en = CURRENT_LANG === 'en';
  const el = overlayEl?.querySelector('#clList');
  if (!el) return;
  const sets = getClosetCollages();

  if (sets.length === 0) {
    el.innerHTML = `<div class="cd-empty-msg">${en
      ? 'No collages yet.<br>Create one from the button below!'
      : 'まだコラージュがありません。<br>下のボタンから作成してみましょう！'}</div>`;
    return;
  }

  el.innerHTML = sets.map(set => {
    const preset = closetBgPreset(set.bg);
    const cellsHtml = set.cells.map(cellPreviewHtml).join('');
    return `
      <div class="cd-card" data-id="${set.id}">
        <div class="cd-card-header">
          <div class="cd-card-title">${escapeHtml(set.name)}</div>
          <div class="cd-card-actions">
            <button type="button" class="cd-icon-btn" data-act="edit" title="${en ? 'Edit' : '編集'}"><svg class="inline-icon" width="15" height="15"><use href="#i-edit"/></svg></button>
            <button type="button" class="cd-icon-btn" data-act="export" title="${en ? 'Share Image on X' : 'Xで画像を共有'}"><svg class="inline-icon" width="15" height="15"><use href="#i-upload"/></svg></button>
            <button type="button" class="cd-icon-btn danger" data-act="delete" title="${en ? 'Delete' : '削除'}"><svg class="inline-icon" width="15" height="15"><use href="#i-trash"/></svg></button>
          </div>
        </div>
        <div class="cl-mini-board" style="grid-template-columns:repeat(${set.cols}, 1fr); background:${preset.css};">${cellsHtml}</div>
      </div>`;
  }).join('');
}

async function handleListClick(e) {
  const card = e.target.closest('.cd-card');
  if (!card) return;
  const id = Number(card.dataset.id);
  const actEl = e.target.closest('[data-act]');
  if (!actEl) return;
  const act = actEl.dataset.act;

  if (act === 'delete') {
    const en = CURRENT_LANG === 'en';
    if (!confirm(en ? 'Delete this collage?' : 'このコラージュを削除しますか？')) return;
    saveClosetCollages(getClosetCollages().filter(s => s.id !== id));
    renderList();
  } else if (act === 'edit') {
    editCollage(id);
  } else if (act === 'export') {
    exportClosetImage(id);
  }
}

/* ================================================================
   編集画面
   ================================================================ */
function newCollage() {
  closetEditing = {
    id: null, name: '', rows: 3, cols: 3,
    cells: Array(9).fill(null), bg: CLOSET_BG_PRESETS[0].key, caption: '',
  };
  showEditView();
}

function editCollage(id) {
  const set = getClosetCollages().find(s => s.id === id);
  if (!set) return;
  closetEditing = JSON.parse(JSON.stringify(set)); // 保存前のキャンセルで元データを壊さないよう複製
  showEditView();
}

function showEditView() {
  if (!overlayEl) return;
  overlayEl.querySelector('#clListView').style.display = 'none';
  overlayEl.querySelector('#clEditView').style.display = 'block';
  overlayEl.querySelector('#clNameInput').value = closetEditing.name || '';
  overlayEl.querySelector('#clCaptionInput').value = closetEditing.caption || '';
  renderBgPicker();
  renderGridSteppers();
  renderBoard();
}

function renderGridSteppers() {
  const rowsEl = overlayEl.querySelector('#clRowsVal');
  const colsEl = overlayEl.querySelector('#clColsVal');
  if (rowsEl) rowsEl.textContent = closetEditing.rows;
  if (colsEl) colsEl.textContent = closetEditing.cols;
}

// 行/列の増減。既存マスの中身は、新しいグリッドでも同じ行・列位置にあたるものだけ引き継ぐ
function adjustGrid(axis, delta) {
  const cur = closetEditing[axis];
  const next = Math.min(CLOSET_MAX_GRID, Math.max(CLOSET_MIN_GRID, cur + delta));
  if (next === cur) return;

  const newRows = axis === 'rows' ? next : closetEditing.rows;
  const newCols = axis === 'cols' ? next : closetEditing.cols;
  const newCells = [];
  for (let r = 0; r < newRows; r++) {
    for (let c = 0; c < newCols; c++) {
      const fits = r < closetEditing.rows && c < closetEditing.cols;
      newCells.push(fits ? closetEditing.cells[r * closetEditing.cols + c] : null);
    }
  }
  closetEditing.rows = newRows;
  closetEditing.cols = newCols;
  closetEditing.cells = newCells;

  renderGridSteppers();
  renderBoard();
}

function renderBgPicker() {
  const el = overlayEl.querySelector('#clBgRow');
  el.innerHTML = CLOSET_BG_PRESETS.map(p => `
    <div class="cl-bg-swatch ${closetEditing.bg === p.key ? 'selected' : ''}" style="background:${p.css};"
      data-bg="${p.key}" title="${escapeHtml(p.label)}"></div>
  `).join('');
}

function selectBg(key) {
  closetEditing.bg = key;
  renderBgPicker();
  renderBoard();
}

function renderBoard() {
  const board = overlayEl.querySelector('#clBoard');
  const preset = closetBgPreset(closetEditing.bg);
  board.style.gridTemplateColumns = `repeat(${closetEditing.cols}, 1fr)`;
  board.style.background = preset.css;
  board.innerHTML = closetEditing.cells.map((cell, i) => cellEditHtml(cell, i)).join('');
}

function cellEditHtml(cell, i) {
  if (!cell) return `<div class="cl-cell cl-cell-empty" data-idx="${i}"><svg class="inline-icon" width="20" height="20" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></div>`;
  if (cell.type === 'photo') return `<div class="cl-cell cl-cell-photo" data-idx="${i}"><img src="${cell.dataUrl}" alt=""></div>`;
  const cat = GRID_CATEGORIES.find(c => c.key === cell.catKey);
  const item = cat ? getItemByCatId(cell.catKey, cell.itemId) : null;
  return `<div class="cl-cell cl-cell-item" data-idx="${i}">${item && cat ? itemIconHtml(cat, item) : (cat ? catIconHtml(cat) : '<svg class="inline-icon" width="18" height="18"><use href="#i-warning"/></svg>')}</div>`;
}

function saveCollage() {
  const en = CURRENT_LANG === 'en';
  const name = overlayEl.querySelector('#clNameInput').value.trim();
  if (!name) { showCoordToast(en ? 'Please enter a collage name' : 'コラージュ名を入力してください'); overlayEl.querySelector('#clNameInput').focus(); return; }
  if (closetEditing.cells.every(c => !c)) { showCoordToast(en ? 'Please fill in at least one cell' : '最低1マスは埋めてください'); return; }

  closetEditing.name = name;
  closetEditing.caption = overlayEl.querySelector('#clCaptionInput').value.trim();

  const sets = getClosetCollages();
  if (closetEditing.id) {
    const idx = sets.findIndex(s => s.id === closetEditing.id);
    if (idx >= 0) sets[idx] = closetEditing; else sets.push(closetEditing);
  } else {
    closetEditing.id = Date.now();
    closetEditing.createdAt = new Date().toISOString();
    sets.push(closetEditing);
  }
  try {
    saveClosetCollages(sets);
  } catch (err) {
    console.error('[closet-collage] failed to save', err);
    const msg = (err && err.name === 'QuotaExceededError')
      ? (en ? 'Not enough storage space to save this collage' : 'コラージュを保存する容量が足りません')
      : (en ? 'Failed to save the collage' : 'コラージュの保存に失敗しました');
    showCoordToast(msg);
    return;
  }
  showCoordToast(en ? `Saved "${name}"!` : `「${name}」を保存しました！`);
  showListView();
}

/* ================================================================
   マス目ピッカー（入れ子モーダル）
   ================================================================ */
let cellOverlayEl = null;

function openCellPicker(index) {
  closetPickingIndex = index;
  ensureCellOverlay();
  renderCellPicker();
  cellOverlayEl.querySelector('#clClearCellBtn').style.display = closetEditing.cells[index] ? '' : 'none';
  requestAnimationFrame(() => cellOverlayEl.classList.add('open'));
}

function closeCellPicker() {
  cellOverlayEl?.classList.remove('open');
}

function ensureCellOverlay() {
  if (cellOverlayEl) return;
  const en = CURRENT_LANG === 'en';
  cellOverlayEl = document.createElement('div');
  cellOverlayEl.className = 'modal-overlay';
  cellOverlayEl.id = CELL_OVERLAY_ID;
  cellOverlayEl.addEventListener('click', e => { if (e.target === cellOverlayEl) closeCellPicker(); });
  cellOverlayEl.innerHTML = `
    <div class="modal-card">
      <button type="button" class="modal-close-btn" id="clCellCloseX" aria-label="${en ? 'Close' : '閉じる'}"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      <div class="modal-title">${en ? 'Choose Cell Content' : 'マスの内容を選ぶ'}</div>

      <div class="cd-action-row">
        <label class="cd-action-btn secondary full" style="display:flex; align-items:center; justify-content:center; gap:6px;">
          <svg class="inline-icon" width="16" height="16" viewBox="0 0 24 24"><path d="M4.5 4.5h15v15h-15Z"/><path d="M4.5 15.5l4.2-4.5a1 1 0 0 1 1.5 0l2.3 2.5 2.5-3a1 1 0 0 1 1.5 0l3 4.5"/><path d="M9 9.5a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z"/></svg>
          <span>${en ? 'Add a Photo' : '写真を追加'}</span>
          <input type="file" accept="image/*" id="clCellPhotoInput" style="display:none;">
        </label>
      </div>

      <label class="cd-form-label" style="margin-top:16px;">${en ? 'Choose from Owned Items' : '所持アイテムから選ぶ'}</label>
      <div id="clItemPicks"></div>

      <button type="button" class="cd-action-btn secondary danger full" id="clClearCellBtn" style="margin-top:14px;">${en ? 'Clear This Cell' : 'このマスを空にする'}</button>
    </div>`;
  document.body.appendChild(cellOverlayEl);

  cellOverlayEl.querySelector('#clCellCloseX').addEventListener('click', closeCellPicker);
  cellOverlayEl.querySelector('#clCellPhotoInput').addEventListener('change', handleCellPhotoChange);
  cellOverlayEl.querySelector('#clClearCellBtn').addEventListener('click', clearCell);
  cellOverlayEl.querySelector('#clItemPicks').addEventListener('click', e => {
    const pick = e.target.closest('.cd-pick-item');
    if (!pick) return;
    closetEditing.cells[closetPickingIndex] = { type: 'item', catKey: pick.dataset.cat, itemId: pick.dataset.id };
    closeCellPicker();
    renderBoard();
  });
}

function renderCellPicker() {
  const en = CURRENT_LANG === 'en';
  const el = cellOverlayEl.querySelector('#clItemPicks');
  const rows = GRID_CATEGORIES.map(cat => {
    const owned = getOwnedItemsForCat(cat.key);
    if (owned.length === 0) return '';
    const itemBtns = owned.map(i => `<div class="cd-pick-item" data-cat="${cat.key}" data-id="${escapeHtml(String(i.id))}" title="${escapeHtml(trItem(i))}">${itemIconHtml(cat, i)}</div>`).join('');
    return `<div class="cd-pick-row">
        <div class="cd-pick-label">${catIconHtml(cat)} ${escapeHtml(trCat(cat.name))}</div>
        <div class="cd-pick-strip">${itemBtns}</div>
      </div>`;
  }).join('');
  el.innerHTML = rows || `<div class="cd-empty-msg">${en ? 'No owned items yet' : 'まだ所持アイテムがありません'}</div>`;
}

function clearCell() {
  closetEditing.cells[closetPickingIndex] = null;
  closeCellPicker();
  renderBoard();
}

async function handleCellPhotoChange(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const index = closetPickingIndex;
  const en = CURRENT_LANG === 'en';
  const dataUrl = await openPhotoCrop(file, { ratio: 1, outSize: 500 }); // マス目は正方形固定のため1:1。キャンセルならnull
  if (!dataUrl) return;
  try {
    closetEditing.cells[index] = { type: 'photo', dataUrl };
    closeCellPicker();
    renderBoard();
  } catch (err) {
    console.error('[closet-collage] failed to attach cell photo', err);
    showCoordToast(en ? 'Failed to attach the photo' : '写真の添付に失敗しました');
  }
}

/* ================================================================
   画像書き出し・Xへの共有（share-data.jsのexportShareImageへ委譲）
   ================================================================ */
function buildExportCardEl(set) {
  const preset = closetBgPreset(set.bg);
  const cellsHtml = set.cells.map(cell => {
    if (!cell) return `<div class="cle-cell cle-cell-empty"></div>`;
    if (cell.type === 'photo') return `<div class="cle-cell cle-cell-photo"><img src="${cell.dataUrl}" alt=""></div>`;
    const cat = GRID_CATEGORIES.find(c => c.key === cell.catKey);
    const item = cat ? getItemByCatId(cell.catKey, cell.itemId) : null;
    if (!item || !cat) return `<div class="cle-cell cle-cell-empty"></div>`;
    return `<div class="cle-cell cle-cell-item">${itemIconHtml(cat, item)}</div>`;
  }).join('');

  const en = CURRENT_LANG === 'en';
  const today = new Date();
  const dateTxt = en
    ? `Created ${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`
    : `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日作成`;

  const card = document.createElement('div');
  card.className = 'cle-export-card' + (preset.dark ? ' cle-dark' : '');
  card.style.background = preset.css;
  card.innerHTML = `
    ${preset.accent ? `<div class="cle-accent cle-accent-tl">${preset.accent}</div><div class="cle-accent cle-accent-br">${preset.accent}</div>` : ''}
    <div class="cle-brand">${en ? 'Item Collection Tracker' : 'アイテム所持率管理'}</div>
    <div class="cle-title">${escapeHtml(set.name)}</div>
    <div class="cle-board" style="grid-template-columns:repeat(${set.cols}, 1fr);">${cellsHtml}</div>
    ${set.caption ? `<div class="cle-caption">${escapeHtml(set.caption)}</div>` : ''}
    <div class="cle-date">${dateTxt}</div>
  `;
  document.body.appendChild(card);
  return card;
}

function exportClosetImage(id) {
  const set = getClosetCollages().find(s => s.id === id);
  if (!set) return;
  const en = CURRENT_LANG === 'en';
  injectShareSharedStyles();
  const shareText = en
    ? `My "${set.name}" closet collage!\n\n${SITE_URL}\n${CLOSET_SHARE_HASHTAG}`
    : `「${set.name}」のクローゼットコラージュ！\n\n${SITE_URL}\n${CLOSET_SHARE_HASHTAG}`;
  return exportShareImage(() => buildExportCardEl(set), set.name, {
    shareText,
    successToast: en ? 'Shared!' : '共有しました！',
  });
}

/* ================================================================
   メインモーダルの開閉
   ================================================================ */
function renderModalHtml() {
  const en = CURRENT_LANG === 'en';
  return `
    <div class="modal-card">
      <button type="button" class="modal-close-btn" id="clCloseX" aria-label="${en ? 'Close' : '閉じる'}">
        <svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg>
      </button>

      <div id="clListView">
        <div class="modal-title">${en ? 'Closet Collage' : 'クローゼットコラージュ'}</div>
        <div id="clList"></div>
        <button type="button" class="cd-action-btn primary full" id="clNewBtn" style="margin-top:12px;">
          <svg class="inline-icon" width="14" height="14" viewBox="0 0 24 24" style="vertical-align:-2px;"><path d="M12 5v14M5 12h14"/></svg>
          ${en ? 'Create New Collage' : '新しいコラージュを作成'}
        </button>
      </div>

      <div id="clEditView" style="display:none;">
        <button type="button" class="cd-modal-back" id="clBackBtn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6l-6 6 6 6"/></svg>
          ${en ? 'Back' : '戻る'}
        </button>
        <div class="modal-title" style="font-size:15px; margin-top:6px;">${en ? 'Edit Collage' : 'コラージュを編集'}</div>

        <div class="cd-form-field">
          <label class="cd-form-label">${en ? 'Collage Name' : 'コラージュ名'}</label>
          <input type="text" class="cd-form-input" id="clNameInput" placeholder="${en ? 'e.g. My Favorites Closet' : '例: お気に入りクローゼット'}">
        </div>

        <div class="cl-size-row">
          <div class="cl-stepper">
            <span class="cl-stepper-label">${en ? 'Rows' : '縦'}</span>
            <button type="button" class="cl-stepper-btn" data-axis="rows" data-delta="-1"><svg class="inline-icon" width="13" height="13" viewBox="0 0 24 24"><path d="M5 12h14"/></svg></button>
            <span class="cl-stepper-val" id="clRowsVal">3</span>
            <button type="button" class="cl-stepper-btn" data-axis="rows" data-delta="1"><svg class="inline-icon" width="13" height="13" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
          </div>
          <div class="cl-stepper">
            <span class="cl-stepper-label">${en ? 'Cols' : '横'}</span>
            <button type="button" class="cl-stepper-btn" data-axis="cols" data-delta="-1"><svg class="inline-icon" width="13" height="13" viewBox="0 0 24 24"><path d="M5 12h14"/></svg></button>
            <span class="cl-stepper-val" id="clColsVal">3</span>
            <button type="button" class="cl-stepper-btn" data-axis="cols" data-delta="1"><svg class="inline-icon" width="13" height="13" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
          </div>
        </div>

        <label class="cd-form-label">${en ? 'Background' : '背景'}</label>
        <div class="cl-bg-row" id="clBgRow"></div>

        <label class="cd-form-label" style="margin-top:14px;">${en ? 'Tap a cell to add an item or photo' : 'マスをタップしてアイテムや写真を追加'}</label>
        <div class="cl-board" id="clBoard"></div>

        <div class="cd-form-field">
          <label class="cd-form-label">${en ? 'Caption (optional)' : 'コメント（任意）'}</label>
          <input type="text" class="cd-form-input" id="clCaptionInput" maxlength="60" placeholder="${en ? 'e.g. My favorite coords this season' : '例: 今季のお気に入りまとめ'}">
        </div>

        <button type="button" class="cd-action-btn primary full" id="clSaveBtn">${en ? 'Save This Collage' : 'このコラージュを保存'}</button>
      </div>
    </div>`;
}

function wireControls() {
  const q = sel => overlayEl.querySelector(sel);
  q('#clCloseX').addEventListener('click', close);
  q('#clNewBtn').addEventListener('click', newCollage);
  q('#clBackBtn').addEventListener('click', showListView);
  q('#clSaveBtn').addEventListener('click', saveCollage);
  q('#clList').addEventListener('click', handleListClick);
  q('#clBgRow').addEventListener('click', e => {
    const swatch = e.target.closest('.cl-bg-swatch');
    if (swatch) selectBg(swatch.dataset.bg);
  });
  q('#clBoard').addEventListener('click', e => {
    const cell = e.target.closest('.cl-cell');
    if (cell) openCellPicker(Number(cell.dataset.idx));
  });
  overlayEl.querySelectorAll('.cl-stepper-btn').forEach(btn => {
    btn.addEventListener('click', () => adjustGrid(btn.dataset.axis, Number(btn.dataset.delta)));
  });
}

export async function open() {
  injectCoordSharedStyles();
  ensureCoordShareStyles();
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

  const en = CURRENT_LANG === 'en';
  overlayEl.querySelector('#clList').innerHTML = `<div class="cd-empty-msg">${en ? 'Loading…' : '読み込み中…'}</div>`;
  try {
    await loadAllItemsOnce(); // セル内容（所持アイテムのID参照）の解決に必要
  } catch (e) {
    console.error('[closet-collage] failed to load item data', e);
    if (overlayEl) overlayEl.querySelector('#clList').innerHTML = `<div class="cd-empty-msg">${en ? 'Failed to load item data.' : 'アイテムデータの読み込みに失敗しました。'}</div>`;
    return;
  }
  if (!overlayEl || !document.body.contains(overlayEl)) return; // 読込待ち中に閉じられた
  showListView();
}

export function close() {
  document.getElementById(OVERLAY_ID)?.classList.remove('open');
  closeCellPicker();
}

/* ================================================================
   スコープ付きスタイル注入
   ================================================================ */
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.cl-mini-board { display: grid; gap: 3px; padding: 8px; border-radius: 10px; margin-top: 2px; }
.cl-mini-board .cl-cell { border-radius: 5px; box-shadow: none; cursor: default; }
.cl-mini-board .cl-cell-empty { font-size: 13px; }

.cl-size-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.cl-stepper { display: flex; align-items: center; gap: 10px; background: var(--hub-bg); border-radius: var(--hub-r-sm); padding: 6px 12px; }
.cl-stepper-label { font-size: 12.5px; color: var(--hub-text-2); }
.cl-stepper-btn {
  width: 26px; height: 26px; border-radius: 50%; background: var(--hub-card); color: var(--hub-text); border: 0;
  display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 2px rgba(0,0,0,0.1); flex-shrink: 0; cursor: pointer;
}
.cl-stepper-btn:active { transform: scale(0.9); }
.cl-stepper-val { min-width: 14px; text-align: center; font-weight: 700; font-size: 14px; }

.cl-bg-row { display: flex; gap: 9px; overflow-x: auto; padding: 2px 2px 6px; -webkit-overflow-scrolling: touch; }
.cl-bg-swatch { flex-shrink: 0; width: 42px; height: 42px; border-radius: 12px; border: 2px solid transparent; position: relative; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.12); }
.cl-bg-swatch.selected { border-color: var(--hub-accent); }
.cl-bg-swatch.selected::after {
  content: ''; position: absolute; inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M4.5 12.5l5 5L20 6.5' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: center; background-size: 44%; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));
}

.cl-board { display: grid; gap: 6px; padding: 14px; border-radius: var(--hub-r); margin: 4px 0 14px; }
.cl-cell {
  aspect-ratio: 1; background: rgba(255,255,255,0.55); border-radius: 10px; display: flex; align-items: center; justify-content: center;
  overflow: hidden; cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,0.1); transition: transform 0.12s ease; color: rgba(0,0,0,0.32);
}
.cl-cell:active { transform: scale(0.95); }
.cl-cell-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cl-cell-item img { width: 78%; height: 78%; object-fit: contain; display: block; }

/* ── 画像書き出し用カード（画面外に配置してhtml2canvasで書き出す） ── */
.cle-export-card {
  position: fixed; left: -9999px; top: 0; width: 640px; padding: 32px 28px 26px;
  font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif;
  box-sizing: border-box; border-radius: 22px; overflow: hidden;
}
.cle-accent { position: absolute; font-size: 90px; opacity: 0.16; pointer-events: none; line-height: 1; }
.cle-accent-tl { top: -18px; left: -14px; }
.cle-accent-br { bottom: -18px; right: -14px; }
.cle-brand { font-size: 13px; font-weight: 700; color: rgba(28,28,30,0.55); margin-bottom: 6px; position: relative; }
.cle-title { font-size: 22px; font-weight: 800; color: #1C1C1E; margin-bottom: 16px; position: relative; }
.cle-board { display: grid; gap: 10px; position: relative; }
.cle-cell { aspect-ratio: 1; background: rgba(255,255,255,0.65); border-radius: 14px; display: flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.10); }
.cle-cell-empty { background: rgba(255,255,255,0.28); box-shadow: none; }
.cle-cell-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cle-cell-item img { width: 76%; height: 76%; object-fit: contain; display: block; }
.cle-caption { font-size: 20px; font-weight: 400; color: #1C1C1E; text-align: center; margin-top: 18px; line-height: 1.6; position: relative; }
.cle-date { font-size: 10.5px; color: rgba(28,28,30,0.45); text-align: right; margin-top: 14px; position: relative; }
.cle-export-card .ish-exp-attribution { color: rgba(28,28,30,0.4); position: relative; }
.cle-export-card.cle-dark .cle-brand { color: rgba(255,255,255,0.65); }
.cle-export-card.cle-dark .cle-title { color: #fff; }
.cle-export-card.cle-dark .cle-caption { color: #fff; }
.cle-export-card.cle-dark .cle-date { color: rgba(255,255,255,0.55); }
.cle-export-card.cle-dark .ish-exp-attribution { color: rgba(255,255,255,0.45); }
.cle-export-card.cle-dark .cle-cell { background: rgba(255,255,255,0.14); }
.cle-export-card.cle-dark .cle-cell-empty { background: rgba(255,255,255,0.06); }
`;
  document.head.appendChild(style);
}

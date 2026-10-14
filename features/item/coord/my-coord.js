/* ================================================================
   my-coord.js — 👗 マイコーデ

   item/index.html の「マイコーデ」モーダル（openMyCoord()〜
   saveCreatedCoord()、3136〜3474行目付近）を移植したもの。所持
   アイテムからカテゴリごとに1つずつ選んで名前を付けて保存し、
   一覧から見返す／削除する／写真を1枚添付できる。

   ── データ形状（coord-data.jsのMY_COORDS_KEY = 'myCoords'） ──────
   Array<{ id:number, name:string, items:{[catKey]:Item}, createdAt:string,
           photoDataUrl?:string }>
   保存/削除/写真の読み書きは coord-data.js の getSavedCoords()/
   addSavedCoord()/deleteSavedCoord()/setSavedCoordPhoto() に委譲している
   （random-coord.js の「ランダムコーデから保存」も同じ関数群を通るため、
   保存形状は完全に一致する）。

   ── エクスポート契約 ──────────────────────────────────────────
     export async function open()  … モーダルを開く（一覧表示から開始）。
     export function close()       … モーダルを閉じる。
   random-coord.js/search-modal.jsと同じ「document.bodyへ直接
   <div class="modal-overlay">をappendする」方式。ダッシュボードの
   「コーデ機能」セクションから
   `import * as myCoord from './coord/my-coord.js'; myCoord.open()`
   のように呼び出す想定（dashboard-view.jsへの配線は後続パスで行う）。

   ── 写真・共有 ─────────────────────────────────────────────
   写真は元実装と同じ、ドラッグ＆ズームで範囲を選ぶ方式（coord-share.jsの
   openPhotoCropForCoord）。Xへの画像共有・リンク共有・画像スタイル・
   自分のIDも coord-share.js に集約してあり、各カードのボタンから呼ぶ。
   元実装の写真専用モーダル（coordPhotoModal）は、一覧カード上の
   ボタンから直接ファイル選択→位置調整→保存まで完結させている。
   ================================================================ */

import { CURRENT_LANG, trCat, trItem, escapeHtml } from '../../../js/i18n.js';
import {
  GRID_CATEGORIES, EXCLUSIVE_KEYS,
  loadAllItemsOnce, getAllItemsCache, getOwnedItemsForCat,
  itemIconHtml, catIconHtml,
  getSavedCoords, addSavedCoord, deleteSavedCoord, setSavedCoordPhoto,
  injectCoordSharedStyles, showCoordToast,
} from './coord-data.js';
import {
  coordShareControlsHtml, wireCoordShareControls, openPhotoCropForCoord, shareCoordImage, shareCoordLink,
  buildMyCoordShareText, ensureCoordShareStyles,
} from './coord-share.js';

const STYLE_ID = 'item-my-coord-styles';
const OVERLAY_ID = 'myCoordModalOverlay';

let overlayEl = null;
let coordFormSelection = {}; // { [catKey]: itemId }
let photoTargetId = null;    // ファイル選択ダイアログの対象コーデid

/* ================================================================
   一覧表示
   ================================================================ */
function showList() {
  if (!overlayEl) return;
  overlayEl.querySelector('#mcListView').style.display = 'block';
  overlayEl.querySelector('#mcCreateView').style.display = 'none';
  renderList();
}

function renderList() {
  const en = CURRENT_LANG === 'en';
  const el = overlayEl?.querySelector('#mcList');
  if (!el) return;
  const sets = getSavedCoords();

  if (sets.length === 0) {
    el.innerHTML = `<div class="cd-empty-msg">${en
      ? 'No saved coords yet.<br>Save one from Random Coord, or<br>create a new one.'
      : '保存されたコーデはありません。<br>ランダムコーデから保存するか、<br>新規作成してください。'}</div>`;
    return;
  }

  el.innerHTML = sets.map(set => {
    const rows = Object.entries(set.items).map(([catKey, item]) => {
      const cat = GRID_CATEGORIES.find(c => c.key === catKey);
      if (!cat || !item) return '';
      return `<div class="cd-item-row">
        <span class="cd-item-cat"><span class="cd-item-row-icon">${catIconHtml(cat)}</span> ${escapeHtml(trCat(cat.name))}</span>
        <span class="cd-item-name">${escapeHtml(trItem(item))}</span>
      </div>`;
    }).join('');

    return `
      <div class="cd-card" data-id="${set.id}">
        <div class="cd-card-header">
          <div class="cd-card-title">${escapeHtml(set.name)}</div>
          <div class="cd-card-actions">
            <button type="button" class="cd-icon-btn" data-act="share-x" title="${en ? 'Share Image on X' : 'Xで画像を共有'}"><svg class="inline-icon" width="15" height="15"><use href="#i-upload"/></svg></button>
            <button type="button" class="cd-icon-btn" data-act="share-link" title="${en ? 'Share as Link' : 'リンクで共有'}"><svg class="inline-icon" width="15" height="15"><use href="#i-link"/></svg></button>
            ${set.photoDataUrl ? `<img class="cd-photo-thumb" src="${set.photoDataUrl}" alt="" data-act="pick-photo" title="${en ? 'Change Photo' : '写真を変更'}">` : ''}
            <button type="button" class="cd-icon-btn" data-act="pick-photo" title="${en ? 'Attach a Photo' : '写真を添付'}">
              <svg class="inline-icon" width="16" height="16" viewBox="0 0 24 24"><path d="M4.5 4.5h15v15h-15Z"/><path d="M4.5 15.5l4.2-4.5a1 1 0 0 1 1.5 0l2.3 2.5 2.5-3a1 1 0 0 1 1.5 0l3 4.5"/><path d="M9 9.5a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z"/></svg>
            </button>
            ${set.photoDataUrl ? `<button type="button" class="cd-icon-btn danger" data-act="clear-photo" title="${en ? 'Remove Photo' : '写真を削除'}"><svg class="inline-icon" width="15" height="15"><use href="#i-close"/></svg></button>` : ''}
            <button type="button" class="cd-icon-btn danger" data-act="delete" title="${en ? 'Delete' : '削除'}"><svg class="inline-icon" width="15" height="15"><use href="#i-trash"/></svg></button>
          </div>
        </div>
        <div class="cd-item-rows">${rows}</div>
      </div>`;
  }).join('');
}

function handleListClick(e) {
  const card = e.target.closest('.cd-card');
  if (!card) return;
  const id = Number(card.dataset.id);
  const actEl = e.target.closest('[data-act]');
  if (!actEl) return;
  const act = actEl.dataset.act;

  if (act === 'delete') {
    const en = CURRENT_LANG === 'en';
    if (!confirm(en ? 'Delete this coord?' : 'このコーデを削除しますか？')) return;
    deleteSavedCoord(id);
    renderList();
  } else if (act === 'share-x') {
    const set = getSavedCoords().find(s => s.id === id);
    if (set) shareCoordImage(set.name, set.items, set.name, buildMyCoordShareText(set.name), set.photoDataUrl);
  } else if (act === 'share-link') {
    const set = getSavedCoords().find(s => s.id === id);
    if (set) shareCoordLink(set.items, set.name);
  } else if (act === 'pick-photo') {
    photoTargetId = id;
    overlayEl.querySelector('#mcPhotoFileInput')?.click();
  } else if (act === 'clear-photo') {
    setSavedCoordPhoto(id, null);
    renderList();
  }
}

async function handlePhotoFileChange(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file || photoTargetId === null) return;
  const targetId = photoTargetId;
  const en = CURRENT_LANG === 'en';
  const dataUrl = await openPhotoCropForCoord(file); // ドラッグ＆ズームで範囲を選ぶ（キャンセルならnull）
  if (!dataUrl) return;
  try {
    setSavedCoordPhoto(targetId, dataUrl);
    renderList();
  } catch (err) {
    console.error('[my-coord] failed to attach photo', err);
    const msg = (err && err.name === 'QuotaExceededError')
      ? (en ? 'Not enough storage space to save this photo' : '写真を保存する容量が足りません')
      : (en ? 'Failed to attach the photo' : '写真の添付に失敗しました');
    showCoordToast(msg);
  }
}

/* ================================================================
   新規作成フォーム
   ================================================================ */
async function showCreateForm() {
  if (!overlayEl) return;
  overlayEl.querySelector('#mcListView').style.display = 'none';
  overlayEl.querySelector('#mcCreateView').style.display = 'block';
  coordFormSelection = {};
  const nameInput = overlayEl.querySelector('#mcNewName');
  if (nameInput) nameInput.value = '';

  if (!getAllItemsCache()) {
    overlayEl.querySelector('#mcCatSelects').innerHTML = `<div class="cd-empty-msg">${CURRENT_LANG === 'en' ? 'Loading…' : '読み込み中…'}</div>`;
    try {
      await loadAllItemsOnce();
    } catch (err) {
      console.error('[my-coord] failed to load item data', err);
      overlayEl.querySelector('#mcCatSelects').innerHTML = `<div class="cd-empty-msg">${CURRENT_LANG === 'en' ? 'Failed to load item data.' : 'アイテムデータの読み込みに失敗しました。'}</div>`;
      return;
    }
    if (!overlayEl || overlayEl.querySelector('#mcCreateView').style.display === 'none') return;
  }
  buildCreateForm();
}

function buildCreateForm() {
  const en = CURRENT_LANG === 'en';
  const el = overlayEl?.querySelector('#mcCatSelects');
  if (!el) return;

  el.innerHTML = GRID_CATEGORIES.map(cat => {
    const owned = getOwnedItemsForCat(cat.key);
    const prefix = cat.key === EXCLUSIVE_KEYS[0]
      ? `<div class="cd-exclusive-hint"><svg class="inline-icon" width="16" height="16"><use href="#i-warning"/></svg> ${en ? 'Only one of the following 3 categories can be selected' : '以下3カテゴリはどれか1つのみ選択できます'}</div>`
      : '';

    if (owned.length === 0) {
      return `${prefix}<div class="cd-pick-row">
          <div class="cd-pick-label">${catIconHtml(cat)} ${escapeHtml(trCat(cat.name))}</div>
          <div class="cd-pick-empty">${en ? '(No owned items)' : '（所持アイテムなし）'}</div>
        </div>`;
    }

    const selectedId = coordFormSelection[cat.key];
    const noneBtn = `<div class="cd-pick-item cd-pick-none ${!selectedId ? 'selected' : ''}" data-cat="${cat.key}" data-id=""
        title="${en ? 'None' : '選択しない'}"><svg class="inline-icon" width="19" height="19"><use href="#i-close"/></svg></div>`;
    const itemBtns = owned.map(i => `<div class="cd-pick-item ${selectedId === i.id ? 'selected' : ''}" data-cat="${cat.key}" data-id="${escapeHtml(String(i.id))}"
        title="${escapeHtml(trItem(i))}">${itemIconHtml(cat, i)}</div>`).join('');

    return `${prefix}<div class="cd-pick-row">
        <div class="cd-pick-label">${catIconHtml(cat)} ${escapeHtml(trCat(cat.name))}</div>
        <div class="cd-pick-strip">${noneBtn}${itemBtns}</div>
      </div>`;
  }).join('');
}

function handleCatSelectsClick(e) {
  const pick = e.target.closest('.cd-pick-item');
  if (!pick) return;
  const catKey = pick.dataset.cat;
  const itemId = pick.dataset.id;
  if (itemId) {
    coordFormSelection[catKey] = itemId;
    if (EXCLUSIVE_KEYS.includes(catKey)) {
      EXCLUSIVE_KEYS.forEach(key => { if (key !== catKey) delete coordFormSelection[key]; });
    }
  } else {
    delete coordFormSelection[catKey];
  }
  buildCreateForm();
}

function saveCreatedCoord() {
  const en = CURRENT_LANG === 'en';
  const nameInput = overlayEl.querySelector('#mcNewName');
  const name = (nameInput?.value || '').trim();
  if (!name) { showCoordToast(en ? 'Please enter a coord name' : 'コーデ名を入力してください'); nameInput?.focus(); return; }

  const items = {};
  GRID_CATEGORIES.forEach(cat => {
    const itemId = coordFormSelection[cat.key];
    if (!itemId) return;
    const owned = getOwnedItemsForCat(cat.key);
    const item = owned.find(i => i.id === itemId);
    if (item) items[cat.key] = item;
  });

  if (Object.keys(items).length === 0) { showCoordToast(en ? 'Please select at least one item' : '最低1つのアイテムを選択してください'); return; }

  addSavedCoord(name, items);
  coordFormSelection = {};
  showCoordToast(en ? `Saved "${name}"!` : `「${name}」を保存しました！`);
  showList();
}

/* ================================================================
   モーダルの開閉
   ================================================================ */
function renderModalHtml() {
  const en = CURRENT_LANG === 'en';
  return `
    <div class="modal-card">
      <button type="button" class="modal-close-btn" id="mcCloseX" aria-label="${en ? 'Close' : '閉じる'}">
        <svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg>
      </button>

      <div id="mcListView">
        <div class="modal-title">${en ? 'My Coord' : 'マイコーデ'}</div>
        <div id="mcList"></div>
        <button type="button" class="cd-action-btn primary full" id="mcCreateBtn" style="margin-top:12px;">
          <svg class="inline-icon" width="14" height="14" viewBox="0 0 24 24" style="vertical-align:-2px;"><path d="M12 5v14M5 12h14"/></svg>
          ${en ? 'Create New Coord' : '新しいコーデを作成'}
        </button>
        <div class="cs-hint" style="margin-top:18px;">${en ? 'Image style when sharing (applies to Random Coord too)' : '共有する画像のスタイル（ランダムコーデにも共通で適用されます）'}</div>
        ${coordShareControlsHtml()}
      </div>

      <div id="mcCreateView" style="display:none;">
        <button type="button" class="cd-modal-back" id="mcBackBtn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6l-6 6 6 6"/></svg>
          ${en ? 'Back' : '戻る'}
        </button>
        <div class="modal-title" style="font-size:15px; margin-top:6px;">${en ? 'Create New Coord' : '新規コーデ作成'}</div>

        <div class="cd-form-field">
          <label class="cd-form-label">${en ? 'Coord Name' : 'コーデ名'}</label>
          <input type="text" class="cd-form-input" id="mcNewName" placeholder="${en ? 'e.g. Casual, Favorites...' : '例: 普段着、お気に入り...'}">
        </div>

        <label class="cd-form-label">${en ? 'Select Items (per category)' : 'アイテムを選択（カテゴリごと）'}</label>
        <div id="mcCatSelects"></div>

        <button type="button" class="cd-action-btn primary full" id="mcSaveNewBtn" style="margin-top:12px;">${en ? 'Save This Coord' : 'このコーデを保存'}</button>
      </div>

      <input type="file" accept="image/*" id="mcPhotoFileInput" style="display:none;">
    </div>`;
}

function wireControls() {
  const q = sel => overlayEl.querySelector(sel);
  q('#mcCloseX').addEventListener('click', close);
  q('#mcCreateBtn').addEventListener('click', showCreateForm);
  q('#mcBackBtn').addEventListener('click', showList);
  q('#mcSaveNewBtn').addEventListener('click', saveCreatedCoord);
  q('#mcList').addEventListener('click', handleListClick);
  q('#mcCatSelects').addEventListener('click', handleCatSelectsClick);
  q('#mcPhotoFileInput').addEventListener('change', handlePhotoFileChange);
  wireCoordShareControls(overlayEl);
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
  showList();

  // 一覧表示は保存済みスナップショットのみで完結するため待たない。
  // 新規作成フォームを開くまでにキャッシュが温まるよう裏側で先読みしておく。
  loadAllItemsOnce().catch(e => console.error('[my-coord] background preload failed', e));
}

export function close() {
  document.getElementById(OVERLAY_ID)?.classList.remove('open');
}

/* ================================================================
   スコープ付きスタイル注入
   ================================================================ */
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
/* my-coord.js固有の追加スタイルは今のところ無く、coord-data.jsの
   共有スタイル（.cd-card・.cd-pick-*・.cd-action-btn等）だけで構成できて
   いる。将来的な拡張に備えてこのファイル専用のSTYLE_IDだけ確保しておく。 */
`;
  document.head.appendChild(style);
}

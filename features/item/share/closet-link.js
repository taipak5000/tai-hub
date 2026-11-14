/* ================================================================
   closet-link.js — 手持ちアイテムの共有リンク（2026-11-14）

   「自分の手持ちで誰かにコーデを組んでもらいたい」ためのリンク。
   サーバーは無いので、所持アイテムの一覧そのものをURLの # 以降に詰める。
     共有する側: openShareModal() … 名前（任意）と含めるカテゴリを選び、リンクをコピー/共有する
     開いた側:   #/item/closet=<code> … 相手の手持ちを閲覧専用で一覧し、そこからアイテムを
                 選んでコーデを組み、既存のコーデのリンク（#/item/coord=…）で送り返せる
   開いた側の保存データには一切書き込まない（見るだけ。コーデのリンクを作る時も保存しない）。

   【URLの中身（version 1）】バイト列を deflate-raw で圧縮して base64url にする（先頭1文字が形式:
   'z'＝圧縮、'r'＝無圧縮。CompressionStream の無いブラウザは無圧縮で作る）。
     [1][名前の長さ][名前UTF-8][作成日＝2020-01-01からの日数][カテゴリ数]
       カテゴリごと: [カテゴリ番号][件数][番号の差分…][例外件数][例外のID…]
   アイテムIDは「<カテゴリ>_<3桁の番号><枝番b〜h>」なので、番号×8＋枝番を昇順の差分で持つ
   （連番が多いので差分はほぼ8になり、よく縮む）。この形に合わないIDは例外として文字列のまま入れる。
   数値はすべて LEB128 の可変長整数。カテゴリ番号は CAT_CODES の位置（並べ替え・削除は禁止、足すのは末尾だけ）。
   ================================================================ */

import { CURRENT_LANG, trCat, trItem, escapeHtml } from '../../../js/i18n.js';
import { getCategoryState } from '../../../js/state.js';
import { GRID_CATEGORIES, loadAllItemsOnce, getAllItemsCache, getItemByCatId, itemIconHtml } from '../coord/coord-data.js';
import { shareCoordLink } from '../coord/coord-share.js';
import { isMobileDevice, showShareToast } from './share-data.js';

function t(ja, en) { return CURRENT_LANG === 'en' ? en : ja; }

// ⚠️ 並べ替え・削除禁止（作ったURLが読めなくなる）。新しいカテゴリは末尾に足す
const CAT_CODES = ['outfit', 'shoes', 'mask', 'face_accessory', 'necklace', 'hairstyle', 'hair_accessory', 'head_accessory',
  'cape', 'portable_item', 'large_placeable', 'small_placeable'];
const EPOCH = Date.UTC(2020, 0, 1);
const NAME_MAX = 20;

/* ================================================================
   🔢 エンコード／デコード
   ================================================================ */
function idToSlot(catKey, id) {
  const m = new RegExp(`^${catKey}_(\\d{3,})([b-h]?)$`).exec(id);
  if (!m) return -1;
  const slot = parseInt(m[1], 10) * 8 + (m[2] ? m[2].charCodeAt(0) - 97 : 0);
  return slotToId(catKey, slot) === id ? slot : -1; // 戻して同じIDになる物だけ（桁数の違う番号などは例外へ）
}
function slotToId(catKey, slot) {
  const n = Math.floor(slot / 8), s = slot % 8;
  return `${catKey}_${String(n).padStart(3, '0')}${s ? String.fromCharCode(97 + s) : ''}`;
}

class Writer {
  constructor() { this.b = []; }
  uint(v) { do { let x = v & 0x7f; v = Math.floor(v / 128); if (v) x |= 0x80; this.b.push(x); } while (v); }
  bytes(arr) { this.uint(arr.length); arr.forEach(x => this.b.push(x)); }
  str(s) { this.bytes(Array.from(new TextEncoder().encode(s))); }
}
class Reader {
  constructor(u8) { this.u = u8; this.i = 0; }
  uint() {
    let v = 0, mul = 1, x;
    do {
      if (this.i >= this.u.length) throw new Error('truncated');
      x = this.u[this.i++]; v += (x & 0x7f) * mul; mul *= 128;
      if (mul > 2 ** 35) throw new Error('varint too long');
    } while (x & 0x80);
    return v;
  }
  str(max) {
    const len = this.uint();
    if (len > max || this.i + len > this.u.length) throw new Error('bad string');
    const s = new TextDecoder().decode(this.u.slice(this.i, this.i + len)); this.i += len; return s;
  }
}

function toB64Url(u8) {
  let bin = ''; for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64Url(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8;
}
async function pipe(u8, stream) {
  const res = new Response(new Blob([u8]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

// owned: { [catKey]: string[] (アイテムID) }
export async function encodeCloset(owned, name) {
  const w = new Writer();
  w.uint(1);
  w.str(String(name || '').trim().slice(0, NAME_MAX));
  w.uint(Math.max(0, Math.floor((Date.now() - EPOCH) / 86400000)));
  const cats = CAT_CODES.filter(k => owned[k] && owned[k].length);
  w.uint(cats.length);
  cats.forEach(k => {
    const slots = [], extras = [];
    owned[k].forEach(id => { const s = idToSlot(k, id); if (s >= 0) slots.push(s); else extras.push(id); });
    slots.sort((a, b) => a - b);
    w.uint(CAT_CODES.indexOf(k));
    w.uint(slots.length);
    let prev = 0; slots.forEach(s => { w.uint(s - prev); prev = s; });
    w.uint(extras.length);
    extras.forEach(id => w.str(id));
  });
  const raw = new Uint8Array(w.b);
  if (typeof CompressionStream === 'function') {
    try { return 'z' + toB64Url(await pipe(raw, new CompressionStream('deflate-raw'))); } catch (e) { /* 無圧縮で作る */ }
  }
  return 'r' + toB64Url(raw);
}

// 戻り値: { name, createdAt(Date), owned:{ [catKey]: string[] } }。読めない時は例外
export async function decodeCloset(code) {
  const kind = code[0];
  let u8 = fromB64Url(code.slice(1));
  if (kind === 'z') {
    if (typeof DecompressionStream !== 'function') throw new Error('no-decompress');
    u8 = await pipe(u8, new DecompressionStream('deflate-raw'));
  } else if (kind !== 'r') throw new Error('unknown kind');
  if (u8.length > 200000) throw new Error('too large');
  const r = new Reader(u8);
  if (r.uint() !== 1) throw new Error('unknown version');
  const name = r.str(NAME_MAX * 4).slice(0, NAME_MAX);
  const createdAt = new Date(EPOCH + r.uint() * 86400000);
  const owned = {};
  const catCount = r.uint();
  if (catCount > CAT_CODES.length) throw new Error('bad cat count');
  for (let c = 0; c < catCount; c++) {
    const catKey = CAT_CODES[r.uint()];
    const n = r.uint();
    if (n > 5000) throw new Error('bad count');
    const ids = [];
    let slot = 0;
    for (let i = 0; i < n; i++) { slot += r.uint(); if (catKey) ids.push(slotToId(catKey, slot)); }
    const ex = r.uint();
    if (ex > 5000) throw new Error('bad count');
    for (let i = 0; i < ex; i++) { const id = r.str(80); if (catKey) ids.push(id); }
    if (catKey) owned[catKey] = ids; // 知らないカテゴリ（新しい版で足されたもの）は読み飛ばす
  }
  return { name, createdAt, owned };
}

function myOwnedIds(catKey) {
  const { owned } = getCategoryState(catKey);
  const all = getAllItemsCache() || [];
  // 所持の正本は itemOwned。アイテムデータにあるIDだけを入れる（消えた古いIDは送らない）
  return all.filter(it => it.catKey === catKey && owned[it.id]).map(it => it.id);
}
function buildUrl(code) {
  return `${location.href.split('#')[0]}#/item/closet=${code}`;
}

/* ================================================================
   📤 共有する側（アイテム所持管理のトップから開く）
   ================================================================ */
const SHARE_OVERLAY_ID = 'closetShareOverlay';
let shareState = null; // { name, cats:Set, url }
let buildSeq = 0;

export async function openShareModal() {
  injectStyles();
  try { await loadAllItemsOnce(); } catch (e) { showShareToast(t('アイテムデータを読み込めませんでした', 'Could not load item data')); return; }
  const counts = {};
  GRID_CATEGORIES.forEach(c => { counts[c.key] = myOwnedIds(c.key).length; });
  shareState = { name: '', cats: new Set(GRID_CATEGORIES.filter(c => counts[c.key] > 0 && CAT_CODES.includes(c.key)).map(c => c.key)), url: '' };

  document.getElementById(SHARE_OVERLAY_ID)?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = SHARE_OVERLAY_ID;
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.innerHTML = `
    <div class="modal-card cl-card">
      <button type="button" class="modal-close-btn" aria-label="${t('閉じる', 'Close')}"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      <div class="modal-title">${t('手持ちアイテムを共有', 'Share Your Closet')}</div>
      <p class="cl-hint">${t(
        '持っているアイテムの一覧をURLにします。開いた人はあなたの手持ちを見て、その中からコーデを組んでリンクで送り返せます。',
        'Turns the list of items you own into a link. Whoever opens it can browse your closet, put together a coord from it, and send it back as a link.')}</p>
      <label class="cl-field-label" for="clNameInput">${t('表示する名前（なくてもOK）', 'Name to show (optional)')}</label>
      <input type="text" class="cl-input" id="clNameInput" maxlength="${NAME_MAX}" placeholder="${t('例：たい', 'e.g. Tai')}" autocomplete="off">
      <div class="cl-field-label">${t('含めるカテゴリ', 'Categories to include')}</div>
      <div class="cl-cat-grid">
        ${GRID_CATEGORIES.filter(c => CAT_CODES.includes(c.key)).map(c => `
          <label class="cl-cat-opt${counts[c.key] ? '' : ' is-empty'}">
            <input type="checkbox" data-cat="${c.key}" ${shareState.cats.has(c.key) ? 'checked' : ''} ${counts[c.key] ? '' : 'disabled'}>
            <span class="cl-cat-name">${escapeHtml(trCat(c.name))}</span><span class="cl-cat-count">${counts[c.key]}</span>
          </label>`).join('')}
      </div>
      <div class="cl-summary" id="clSummary" aria-live="polite"></div>
      <textarea class="cl-url" id="clUrl" readonly rows="3" aria-label="${t('共有リンク', 'Share link')}"></textarea>
      <div class="cl-actions">
        <button type="button" class="cl-btn primary" id="clCopyBtn"><svg class="inline-icon" width="16" height="16"><use href="#i-copy"/></svg>${t('リンクをコピー', 'Copy link')}</button>
        ${navigator.share ? `<button type="button" class="cl-btn" id="clShareBtn"><svg class="inline-icon" width="16" height="16"><use href="#i-upload"/></svg>${t('共有する', 'Share')}</button>` : ''}
      </div>
      <p class="cl-note">${t(
        'URLにはリンクを作った時点の手持ちだけが入ります（名前・コメントや他の記録は入りません）。あとで増えたアイテムを見せたい時は、作り直して送ってください。',
        'The link only contains what you own right now (no other records). If you get more items later, make a new link.')}</p>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.modal-close-btn').addEventListener('click', close);
  const nameEl = overlay.querySelector('#clNameInput');
  let nameTimer = null;
  nameEl.addEventListener('input', () => { shareState.name = nameEl.value; clearTimeout(nameTimer); nameTimer = setTimeout(rebuild, 200); });
  overlay.querySelector('.cl-cat-grid').addEventListener('change', e => {
    const cb = e.target.closest('input[data-cat]'); if (!cb) return;
    if (cb.checked) shareState.cats.add(cb.dataset.cat); else shareState.cats.delete(cb.dataset.cat);
    rebuild();
  });
  const urlEl = overlay.querySelector('#clUrl');
  urlEl.addEventListener('focus', () => urlEl.select());
  overlay.querySelector('#clCopyBtn').addEventListener('click', copyUrl);
  overlay.querySelector('#clShareBtn')?.addEventListener('click', async () => {
    if (!shareState.url) return;
    try {
      await navigator.share({ title: t('手持ちアイテム', 'My closet'), text: shareText(), url: shareState.url });
    } catch (e) { if (!e || e.name !== 'AbortError') copyUrl(); }
  });
  requestAnimationFrame(() => overlay.classList.add('open'));
  rebuild();
}

function shareText() {
  return t('私の手持ちアイテムです。これでコーデを組んでもらえると嬉しいです！', 'Here is my Sky closet — could you put a coord together for me?');
}

async function rebuild() {
  const overlay = document.getElementById(SHARE_OVERLAY_ID);
  if (!overlay || !shareState) return;
  const seq = ++buildSeq;
  const owned = {};
  let total = 0;
  shareState.cats.forEach(k => { owned[k] = myOwnedIds(k); total += owned[k].length; });
  const copyBtn = overlay.querySelector('#clCopyBtn'), shareBtn = overlay.querySelector('#clShareBtn');
  if (!total) {
    shareState.url = '';
    overlay.querySelector('#clUrl').value = '';
    overlay.querySelector('#clSummary').textContent = t('含めるアイテムがありません', 'No items to include');
    copyBtn.disabled = true; if (shareBtn) shareBtn.disabled = true;
    return;
  }
  const code = await encodeCloset(owned, shareState.name);
  if (seq !== buildSeq || !document.getElementById(SHARE_OVERLAY_ID)) return; // 入力が続いた時は最後の分だけ反映
  shareState.url = buildUrl(code);
  overlay.querySelector('#clUrl').value = shareState.url;
  overlay.querySelector('#clSummary').textContent = t(`${total}件のアイテム（${shareState.cats.size}カテゴリ）`, `${total} items (${shareState.cats.size} categories)`);
  copyBtn.disabled = false; if (shareBtn) shareBtn.disabled = false;
}

async function copyUrl() {
  if (!shareState || !shareState.url) return;
  try {
    await navigator.clipboard.writeText(shareState.url);
    showShareToast(t('リンクをコピーしました', 'Link copied'));
  } catch (e) {
    const urlEl = document.querySelector(`#${SHARE_OVERLAY_ID} #clUrl`);
    if (urlEl) { urlEl.focus(); urlEl.select(); }
    showShareToast(t('上のリンクを選択してコピーしてください', 'Select the link above to copy it'));
  }
}

export function close() {
  document.getElementById(SHARE_OVERLAY_ID)?.classList.remove('open');
  closeSharedCloset();
}

/* ================================================================
   👀 開いた側（#/item/closet=<code>）。閲覧専用＋コーデを組んで送り返す
   ================================================================ */
const VIEW_OVERLAY_ID = 'sharedClosetOverlay';
let view = null; // { name, createdAt, cats:[{cat, items}], current, query, picks:{[catKey]:item} }

export async function openSharedClosetFromRoute(sub) {
  const m = /^closet=([A-Za-z0-9_-]+)$/.exec(sub || '');
  if (!m) return clearHash();
  let data;
  try {
    data = await decodeCloset(m[1]);
  } catch (e) {
    console.warn('[closet-link] could not read link', e);
    showShareToast(e && e.message === 'no-decompress'
      ? t('このブラウザではこのリンクを開けません。新しいブラウザでお試しください', 'This browser cannot open this link. Please try a newer browser.')
      : t('リンクが壊れているため開けませんでした', 'This link appears to be broken'));
    return clearHash();
  }
  try { await loadAllItemsOnce(); } catch (e) {
    showShareToast(t('アイテムデータを読み込めませんでした', 'Could not load item data'));
    return clearHash();
  }
  const cats = GRID_CATEGORIES.map(cat => ({
    cat,
    items: (data.owned[cat.key] || []).map(id => getItemByCatId(cat.key, id)).filter(Boolean),
  })).filter(x => x.items.length);
  if (!cats.length) { showShareToast(t('このリンクにはアイテムが入っていません', 'This link has no items')); return clearHash(); }
  view = { name: data.name, createdAt: data.createdAt, cats, current: cats[0].cat.key, query: '', picks: {} };
  renderView();
}

function clearHash() {
  if (/^#\/item\/closet=/.test(location.hash)) history.replaceState(null, '', '#/item');
}

export function closeSharedCloset() {
  document.getElementById(VIEW_OVERLAY_ID)?.classList.remove('open');
  view = null;
  clearHash();
}

function fmtDate(d) {
  return CURRENT_LANG === 'en' ? `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}` : `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function renderView() {
  injectStyles();
  document.getElementById(VIEW_OVERLAY_ID)?.remove();
  const total = view.cats.reduce((s, x) => s + x.items.length, 0);
  const who = view.name ? t(`${view.name}さんの手持ちアイテム`, `${view.name}'s closet`) : t('共有された手持ちアイテム', 'Shared closet');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = VIEW_OVERLAY_ID;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSharedCloset(); });
  overlay.innerHTML = `
    <div class="modal-card cl-card cl-view">
      <button type="button" class="modal-close-btn" aria-label="${t('閉じる', 'Close')}"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      <div class="modal-title">${escapeHtml(who)}</div>
      <p class="cl-hint">${t(`${total}件・${fmtDate(view.createdAt)}時点`, `${total} items · as of ${fmtDate(view.createdAt)}`)}　${t('アイテムを押すと、コーデに入れられます。', 'Tap items to build a coord.')}</p>
      <div class="cl-view-top">
        <input type="search" class="cl-input" id="clViewSearch" placeholder="${t('アイテム名で検索（全カテゴリ）', 'Search all categories')}" autocomplete="off">
        <div class="cl-chips" role="tablist" aria-label="${t('カテゴリ', 'Categories')}"></div>
      </div>
      <div class="cl-grid" id="clViewGrid"></div>
      <p class="cl-note">${t('見ているだけで、あなたの記録には何も保存されません。', 'Nothing is saved to your own records while browsing.')}</p>
      <div class="cl-pickbar" id="clPickbar" hidden>
        <div class="cl-pick-icons" id="clPickIcons"></div>
        <input type="text" class="cl-input cl-coord-name" id="clCoordName" maxlength="40" value="${escapeHtml(view.name ? t(`${view.name}さんへのコーデ`, `A coord for ${view.name}`) : t('おすすめコーデ', 'Suggested coord'))}" aria-label="${t('コーデの名前', 'Coord name')}">
        <button type="button" class="cl-btn primary" id="clSendBtn"><svg class="inline-icon" width="16" height="16"><use href="#i-link"/></svg>${t('このコーデをリンクで送る', 'Send this coord as a link')}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.modal-close-btn').addEventListener('click', closeSharedCloset);
  const search = overlay.querySelector('#clViewSearch');
  let qTimer = null;
  search.addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(() => { view.query = search.value.trim().toLowerCase(); renderGrid(); }, 120); });
  overlay.querySelector('.cl-chips').addEventListener('click', e => {
    const chip = e.target.closest('[data-cat]'); if (!chip) return;
    view.current = chip.dataset.cat;
    if (view.query) { view.query = ''; search.value = ''; }
    renderChips(); renderGrid();
    overlay.querySelector('.modal-card').scrollTo({ top: 0 });
  });
  overlay.querySelector('#clViewGrid').addEventListener('click', e => {
    const tile = e.target.closest('[data-key]'); if (!tile) return;
    const [catKey, ...rest] = tile.dataset.key.split(':'); const id = rest.join(':');
    if (view.picks[catKey] && view.picks[catKey].id === id) delete view.picks[catKey];
    else { const it = getItemByCatId(catKey, id); if (it) view.picks[catKey] = it; }
    renderGrid(); renderChips(); renderPickbar();
  });
  overlay.querySelector('#clPickIcons').addEventListener('click', e => {
    const b = e.target.closest('[data-unpick]'); if (!b) return;
    delete view.picks[b.dataset.unpick]; renderGrid(); renderChips(); renderPickbar();
  });
  overlay.querySelector('#clSendBtn').addEventListener('click', () => {
    if (!Object.keys(view.picks).length) return;
    const name = overlay.querySelector('#clCoordName').value.trim() || t('おすすめコーデ', 'Suggested coord');
    shareCoordLink({ ...view.picks }, name); // 既存のコーデのリンク（#/item/coord=…）。持ち主が開くと✓付きで見られる
  });
  renderChips(); renderGrid(); renderPickbar();
  requestAnimationFrame(() => overlay.classList.add('open'));
}

function renderChips() {
  const el = document.querySelector(`#${VIEW_OVERLAY_ID} .cl-chips`); if (!el) return;
  el.innerHTML = view.cats.map(({ cat, items }) => {
    const on = !view.query && view.current === cat.key;
    const picked = !!view.picks[cat.key];
    return `<button type="button" class="cl-chip${on ? ' on' : ''}" role="tab" aria-selected="${on}" data-cat="${cat.key}">${escapeHtml(trCat(cat.name))}<span>${items.length}</span>${picked ? '<i class="cl-chip-dot" aria-label="' + t('選択あり', 'Picked') + '"></i>' : ''}</button>`;
  }).join('');
}

function tileHtml(cat, it) {
  const picked = view.picks[cat.key] && view.picks[cat.key].id === it.id;
  const name = escapeHtml(trItem(it));
  return `<button type="button" class="cl-tile${picked ? ' picked' : ''}" data-key="${cat.key}:${escapeHtml(it.id)}" aria-pressed="${picked}" title="${name}">
    <span class="cl-tile-img">${itemIconHtml(cat, it)}</span><span class="cl-tile-name">${name}</span></button>`;
}

function renderGrid() {
  const el = document.getElementById('clViewGrid'); if (!el) return;
  if (view.query) {
    const q = view.query;
    const html = view.cats.map(({ cat, items }) => {
      const hit = items.filter(it => `${it.name || ''} ${it.nameEn || ''} ${trItem(it)}`.toLowerCase().includes(q));
      return hit.length ? `<div class="cl-grid-head">${escapeHtml(trCat(cat.name))}</div>${hit.map(it => tileHtml(cat, it)).join('')}` : '';
    }).join('');
    el.innerHTML = html || `<p class="cl-empty">${t('見つかりません', 'No matches')}</p>`;
  } else {
    const x = view.cats.find(c => c.cat.key === view.current) || view.cats[0];
    el.innerHTML = x.items.map(it => tileHtml(x.cat, it)).join('');
  }
}

function renderPickbar() {
  const bar = document.getElementById('clPickbar'); if (!bar) return;
  const picks = GRID_CATEGORIES.filter(c => view.picks[c.key]);
  bar.hidden = !picks.length;
  document.getElementById('clPickIcons').innerHTML = picks.map(c => {
    const it = view.picks[c.key];
    return `<button type="button" class="cl-pick" data-unpick="${c.key}" title="${escapeHtml(t(`${trItem(it)}（外す）`, `${trItem(it)} (remove)`))}">${itemIconHtml(c, it)}</button>`;
  }).join('') + `<span class="cl-pick-count">${t(`${picks.length}点`, `${picks.length} items`)}</span>`;
}

/* ================================================================
   🎨 スタイル（モーダルは chrome.css の .modal-overlay/.modal-card。色は --hub-* だけ）
   ================================================================ */
const STYLE_ID = 'item-closet-link-styles';
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
.cl-card .cl-hint { font-size: 13px; color: var(--hub-text-2); line-height: 1.7; margin: 4px 0 14px; }
.cl-card .cl-note { font-size: 12px; color: var(--hub-text-2); line-height: 1.6; margin: 12px 0 0; }
.cl-card .cl-field-label { display: block; font-size: 12px; font-weight: 700; color: var(--hub-text-2); letter-spacing: 0.04em; margin: 14px 0 6px; }
.cl-card .cl-input {
  width: 100%; box-sizing: border-box; font: inherit; font-size: 16px; color: var(--hub-text); background: var(--hub-bg);
  border: 1px solid var(--hub-sep); border-radius: 10px; padding: 9px 12px; outline: none;
}
.cl-card .cl-input:focus { border-color: var(--hub-accent); }
.cl-card .cl-cat-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 8px; }
.cl-card .cl-cat-opt { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 7px 6px; border-radius: 8px; cursor: pointer; min-width: 0; }
.cl-card .cl-cat-opt input { width: 16px; height: 16px; flex-shrink: 0; accent-color: var(--hub-accent); }
.cl-card .cl-cat-opt.is-empty { opacity: 0.5; cursor: default; }
.cl-card .cl-cat-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cl-card .cl-cat-count { font-size: 12px; color: var(--hub-text-2); font-variant-numeric: tabular-nums; }
.cl-card .cl-summary { font-size: 13px; font-weight: 700; margin: 14px 0 6px; }
.cl-card .cl-url {
  width: 100%; box-sizing: border-box; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--hub-text-2);
  background: var(--hub-bg); border: 1px solid var(--hub-sep); border-radius: 10px; padding: 8px 10px; resize: none; word-break: break-all;
}
.cl-card .cl-actions { display: flex; gap: 8px; margin-top: 10px; }
.cl-card .cl-btn {
  flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; padding: 10px 12px;
  border: 1px solid var(--hub-sep); border-radius: 12px; background: var(--hub-card); color: var(--hub-text);
  font: inherit; font-size: 14px; font-weight: 700; cursor: pointer;
}
.cl-card .cl-btn.primary { background: var(--hub-accent); border-color: transparent; color: #fff; }
.cl-card .cl-btn:disabled { opacity: 0.45; cursor: default; }
.cl-card .cl-btn:not(:disabled):active { transform: scale(0.97); }
.cl-card .cl-btn .inline-icon { stroke: currentColor; }

/* 上に止まる検索とカテゴリ。カードの上の余白(20px)ぶん上で止め、余白から一覧がのぞかないようにする */
.cl-view .cl-view-top { position: sticky; top: -20px; z-index: 2; background: var(--hub-card); margin: 0 -20px; padding: 8px 20px 8px; }
.cl-view .cl-chips { display: flex; gap: 6px; overflow-x: auto; padding: 8px 0 2px; scrollbar-width: none; }
.cl-view .cl-chips::-webkit-scrollbar { display: none; }
.cl-view .cl-chip {
  position: relative; flex-shrink: 0; display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 999px;
  border: 1px solid var(--hub-sep); background: var(--hub-bg); color: var(--hub-text); font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer;
}
.cl-view .cl-chip span { font-size: 11px; color: var(--hub-text-2); font-weight: 600; }
.cl-view .cl-chip.on { background: var(--hub-accent); border-color: transparent; color: #fff; }
.cl-view .cl-chip.on span { color: rgba(255,255,255,0.85); }
.cl-view .cl-chip-dot { position: absolute; top: 2px; right: 4px; width: 7px; height: 7px; border-radius: 50%; background: var(--hub-accent); box-shadow: 0 0 0 1.5px var(--hub-card); }
.cl-view .cl-chip.on .cl-chip-dot { background: #fff; box-shadow: none; }
.cl-view .cl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 8px; margin-top: 8px; }
.cl-view .cl-grid-head { grid-column: 1 / -1; font-size: 12px; font-weight: 700; color: var(--hub-text-2); letter-spacing: 0.04em; margin-top: 6px; }
.cl-view .cl-tile {
  display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 4px; border-radius: 12px;
  border: 2px solid transparent; background: var(--hub-bg); color: var(--hub-text); font: inherit; cursor: pointer; min-width: 0;
}
.cl-view .cl-tile:active { transform: scale(0.96); }
.cl-view .cl-tile.picked { border-color: var(--hub-accent); background: var(--hub-card); }
.cl-view .cl-tile-img { width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; }
.cl-view .cl-tile-img img { max-width: 100%; max-height: 100%; object-fit: contain; }
.cl-view .cl-tile-name { font-size: 11px; line-height: 1.3; text-align: center; letter-spacing: 0.02em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-all; }
.cl-view .cl-empty { grid-column: 1 / -1; text-align: center; color: var(--hub-text-2); font-size: 13px; padding: 24px 0; }
.cl-view .cl-pickbar {
  /* 止まる位置はカードの下の余白（画面下のメニューの分）の上端＝bottom:0 でちょうどメニューの上になる。
     中身が短い時にせり上がって一覧に重ならないよう、カードの最後の要素にしておく */
  position: sticky; bottom: 0; z-index: 2; margin: 12px -20px 0; padding: 10px 20px;
  background: var(--hub-card); border-top: 1px solid var(--hub-sep); display: grid; gap: 8px;
}
.cl-view .cl-pickbar[hidden] { display: none; }
.cl-view .cl-pick-icons { display: flex; align-items: center; gap: 6px; overflow-x: auto; scrollbar-width: none; }
.cl-view .cl-pick { flex-shrink: 0; width: 38px; height: 38px; padding: 3px; border-radius: 10px; border: 1.5px solid var(--hub-accent); background: var(--hub-bg); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.cl-view .cl-pick img { max-width: 100%; max-height: 100%; object-fit: contain; }
.cl-view .cl-pick-count { font-size: 12.5px; font-weight: 700; color: var(--hub-text-2); white-space: nowrap; margin-left: 2px; }
@media (prefers-contrast: more) {
  .cl-view .cl-tile { border-color: var(--hub-text-2); }
  .cl-view .cl-tile.picked { border-width: 3px; }
}
`;
  document.head.appendChild(s);
}

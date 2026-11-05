/* ================================================================
   🪞 コーデ日記（#/coord-diary）。その日のコーデを写真と「着ていたアイテム」で残し、カレンダーで見返す。
   アイテムは、アイテム所持管理で所持にしたもの（gameItems_<cat>.ownedItems）から選ぶ。
   写真はフォト日記と同じ IndexedDB（features/friends/friends-state.js の putPhoto/getPhoto）に保存する。

   coordDiary_v1: { entries: [{ id, date: 'YYYY-MM-DD', photoId?, items: [{ cat, id }], memo, place? }] }
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { nsKey } from '../../js/state.js';
import { notifyChanged } from '../../js/notices.js';
import { CATEGORY_REGISTRY } from '../item/data/categories.js';
import { injectStylesheet } from '../bingo/bingo-view.js';
import { toast } from '../shared/share-image.js';
import { PLACES, PLACE_IDS, placeName } from '../shared/places.js';
import { putPhoto, getPhoto, deletePhoto, todayStr } from '../friends/friends-state.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
const KEY = 'coordDiary_v1';
const CATS = CATEGORY_REGISTRY.filter(c => c.section !== 'special');
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

let containerEl = null;
let doc = null;
let owned = null; // { 'cat:id': {cat, id, name, img} }
let month = null; // { y, m }（0始まりの月）
let form = null; // { id?, date, items: Set<'cat:id'>, query, removePhoto }
let confirmId = null;
let pendingPhoto = null, pendingUrl = null;
const urls = new Map();

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

export function normalizeCoordDiary(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  return {
    entries: (Array.isArray(d.entries) ? d.entries : []).filter(e => e && e.id && DATE_RE.test(e.date || '')).slice(0, 3000).map(e => ({
      id: String(e.id).slice(0, 40), date: e.date,
      photoId: typeof e.photoId === 'string' ? e.photoId.slice(0, 60) : '',
      items: (Array.isArray(e.items) ? e.items : []).filter(x => x && CATS.some(c => c.key === x.cat) && typeof x.id === 'string').slice(0, 30).map(x => ({ cat: x.cat, id: x.id.slice(0, 40) })),
      memo: typeof e.memo === 'string' ? e.memo.slice(0, 1000) : '',
      place: PLACE_IDS.has(e.place) ? e.place : '',
    })),
  };
}
function load() { try { return normalizeCoordDiary(JSON.parse(localStorage.getItem(nsKey(KEY)))); } catch (e) { return normalizeCoordDiary(null); } }
function save() {
  try { localStorage.setItem(nsKey(KEY), JSON.stringify(doc)); } catch (e) { toast(t('保存できませんでした', 'Could not save')); }
  notifyChanged();
}
function loadOwned() {
  const out = {};
  CATS.forEach(c => {
    try {
      const d = JSON.parse(localStorage.getItem(nsKey('gameItems_' + c.key))) || {};
      (Array.isArray(d.ownedItems) ? d.ownedItems : []).forEach(it => {
        if (it && it.id && d.itemOwned && d.itemOwned[it.id]) out[`${c.key}:${it.id}`] = { cat: c, id: it.id, name: CURRENT_LANG === 'en' ? (it.nameEn || it.name) : it.name, img: it.img };
      });
    } catch (e) { /* noop */ }
  });
  return out;
}

export function mount(container) {
  injectStylesheet();
  containerEl = container;
  doc = load();
  owned = loadOwned();
  const now = new Date();
  month = { y: now.getFullYear(), m: now.getMonth() };
  form = null; confirmId = null;
  container.innerHTML = '<div class="coord-diary-view fun-view"></div>';
  render();
  const r = root();
  r.addEventListener('click', onClick);
  r.addEventListener('change', onChange);
  r.addEventListener('input', onInput);
  r.addEventListener('submit', onSubmit);
}
export function unmount() {
  urls.forEach(u => URL.revokeObjectURL(u)); urls.clear();
  clearPending();
  containerEl = null;
}
function root() { return containerEl && containerEl.querySelector('.coord-diary-view'); }
function clearPending() { if (pendingUrl) URL.revokeObjectURL(pendingUrl); pendingPhoto = null; pendingUrl = null; }

function itemInfo(x) {
  return owned[`${x.cat}:${x.id}`] || { cat: CATS.find(c => c.key === x.cat), id: x.id, name: x.id, img: '' };
}
function fmtDate(str) { const [y, m, d] = str.split('-').map(Number); return t(`${m}月${d}日`, `${m}/${d}`) + (y !== new Date().getFullYear() ? t(`（${y}年）`, ` ${y}`) : ''); }

function render() {
  const r = root();
  if (!r) return;
  const mKey = `${month.y}-${String(month.m + 1).padStart(2, '0')}`;
  const inMonth = doc.entries.filter(e => e.date.startsWith(mKey)).sort((a, b) => b.date.localeCompare(a.date));
  r.innerHTML = `<div class="fun-wrap">
    <header class="fun-head">
      <h1 class="fun-h1"><svg class="inline-icon" width="22" height="22" aria-hidden="true"><use href="#i-hanger"/></svg>${t('コーデ日記', 'Outfit Diary')}</h1>
      <p class="fun-lead">${t('その日のコーデを、写真と着ていたアイテムで残しておけます。アイテムは「アイテム所持管理」で所持にしたものから選べます。', 'Log your outfit of the day with a photo and the items you wore, picked from your owned items.')}</p>
    </header>
    ${form ? formHtml() : `<button type="button" class="fun-add" data-act="new"><svg class="inline-icon" width="16" height="16"><use href="#i-plus"/></svg>${t('今日のコーデを残す', 'Log today’s outfit')}</button>`}
    <section class="cd-cal">
      <div class="cd-cal-head">
        <button type="button" class="fun-icon-btn" data-act="prev" aria-label="${t('前の月', 'Previous month')}"><svg class="inline-icon" width="15" height="15"><use href="#i-chevron-left"/></svg></button>
        <b>${t(`${month.y}年${month.m + 1}月`, `${month.m + 1}/${month.y}`)}</b>
        <button type="button" class="fun-icon-btn" data-act="next" aria-label="${t('次の月', 'Next month')}"><svg class="inline-icon" width="15" height="15"><use href="#i-chevron-right"/></svg></button>
      </div>
      ${calendarHtml()}
    </section>
    ${inMonth.length ? `<div class="cd-list">${inMonth.map(entryHtml).join('')}</div>` : `<p class="fun-hint cd-empty-month">${t('この月の記録はまだありません。カレンダーの日付を押しても残せます。', 'No outfits this month yet. Tap a day to add one.')}</p>`}
    ${favoritesHtml()}
  </div>`;
  loadPhotos();
}

function calendarHtml() {
  const first = new Date(month.y, month.m, 1);
  const days = new Date(month.y, month.m + 1, 0).getDate();
  const lead = first.getDay();
  const today = todayStr();
  const heads = t('日,月,火,水,木,金,土', 'S,M,T,W,T,F,S').split(',').map(w => `<span class="cd-wd">${w}</span>`).join('');
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<span class="cd-day is-blank"></span>');
  for (let d = 1; d <= days; d++) {
    const key = `${month.y}-${String(month.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const e = doc.entries.filter(x => x.date === key);
    const photo = e.find(x => x.photoId);
    cells.push(`<button type="button" class="cd-day${e.length ? ' has' : ''}${key === today ? ' is-today' : ''}" data-act="day" data-date="${key}"${key > today ? ' disabled' : ''}>
      ${photo ? `<span class="cd-day-photo" data-photo="${escapeHtml(photo.photoId)}"></span>` : ''}<span class="cd-day-num">${d}</span>${e.length && !photo ? '<span class="cd-day-dot"></span>' : ''}</button>`);
  }
  return `<div class="cd-grid">${heads}${cells.join('')}</div>`;
}

function entryHtml(e) {
  const items = e.items.map(itemInfo);
  return `<article class="cd-entry" id="cd-${e.id}">
    ${e.photoId ? `<div class="fr-photo cd-photo" data-photo="${escapeHtml(e.photoId)}"><span class="fr-photo-ph"><svg class="inline-icon" width="22" height="22"><use href="#i-image"/></svg></span></div>` : ''}
    <div class="cd-entry-body">
      <div class="fr-entry-date">${fmtDate(e.date)}${e.place ? `<span class="cd-place">${escapeHtml(placeName(e.place, CURRENT_LANG))}</span>` : ''}</div>
      ${items.length ? `<div class="cd-items">${items.map(it => `<span class="cd-item">${it.img ? `<img src="${escapeHtml(it.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}${escapeHtml(it.name)}</span>`).join('')}</div>` : ''}
      ${e.memo ? `<p class="fr-entry-text">${escapeHtml(e.memo).replace(/\n/g, '<br>')}</p>` : ''}
    </div>
    <button type="button" class="fun-icon-btn fr-entry-edit" data-act="edit" data-id="${e.id}" aria-label="${t('編集', 'Edit')}"><svg class="inline-icon" width="15" height="15"><use href="#i-edit"/></svg></button>
  </article>`;
}

// よく着ているアイテム（全期間で3回以上）
function favoritesHtml() {
  const count = {};
  doc.entries.forEach(e => e.items.forEach(x => { const k = `${x.cat}:${x.id}`; count[k] = (count[k] || 0) + 1; }));
  const top = Object.keys(count).filter(k => count[k] >= 3).sort((a, b) => count[b] - count[a]).slice(0, 8);
  if (!top.length) return '';
  return `<section class="fun-section"><h2 class="fun-h2">${t('よく着ているアイテム', 'Most worn')}</h2>
    <div class="cd-items">${top.map(k => { const [cat, id] = k.split(':'); const it = itemInfo({ cat, id }); return `<span class="cd-item">${it.img ? `<img src="${escapeHtml(it.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}${escapeHtml(it.name)}<b>${count[k]}</b></span>`; }).join('')}</div></section>`;
}

function formHtml() {
  const e = form.id ? doc.entries.find(x => x.id === form.id) : null;
  const preview = pendingUrl || (e && e.photoId && !form.removePhoto ? urls.get(e.photoId) : '');
  const hasPhoto = !!pendingUrl || (!!(e && e.photoId) && !form.removePhoto);
  const selected = [...form.items].map(k => { const [cat, id] = k.split(':'); return { key: k, ...itemInfo({ cat, id }) }; });
  const ownedCount = Object.keys(owned).length;
  return `<form class="fun-form" data-form="coord">
    <div class="fr-photo-pick${hasPhoto ? ' has' : ''}">
      ${preview ? `<img src="${preview}" alt="">` : (hasPhoto ? `<span><svg class="inline-icon" width="26" height="26"><use href="#i-image"/></svg></span>` : `<span><svg class="inline-icon" width="26" height="26"><use href="#i-camera"/></svg>${t('コーデの写真（なくてもOK）', 'Outfit photo (optional)')}</span>`)}
      <input type="file" accept="image/*" name="photo" aria-label="${t('写真を選ぶ', 'Choose a photo')}">
    </div>
    ${hasPhoto ? `<button type="button" class="fun-btn small" data-act="clear-photo">${t('写真を外す', 'Remove photo')}</button>` : ''}
    <div class="fun-field-row">
      <label class="fun-field"><span class="fun-label">${t('日付', 'Date')}</span><input class="fun-input" type="date" name="date" required max="${todayStr()}" value="${form.date}"></label>
      <label class="fun-field"><span class="fun-label">${t('場所（あれば）', 'Place (optional)')}</span><select class="fun-input" name="place"><option value="">${t('なし', 'None')}</option>${PLACES.map(p => `<option value="${p.id}"${(form.place || '') === p.id ? ' selected' : ''}>${escapeHtml(CURRENT_LANG === 'en' ? p.en : p.ja)}</option>`).join('')}</select></label>
    </div>
    <div class="fun-field">
      <span class="fun-label">${t('着ていたアイテム', 'Items worn')} <span class="cd-sel-count">${selected.length}</span></span>
      <div class="cd-items cd-selected">${selected.map(it => `<button type="button" class="cd-item is-chip" data-act="unpick" data-key="${escapeHtml(it.key)}">${it.img ? `<img src="${escapeHtml(it.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}${escapeHtml(it.name)}<svg class="inline-icon" width="11" height="11"><use href="#i-close"/></svg></button>`).join('')}</div>
      ${ownedCount ? `<input class="fun-input" type="search" name="q" value="${escapeHtml(form.query || '')}" placeholder="${t('所持アイテムから探す（例: ケープ）', 'Search your items (e.g. cape)')}" autocomplete="off">
        <div class="cd-pick">${pickHtml()}</div>`
        : `<p class="fun-hint">${t('アイテム所持管理で所持にしたアイテムが、ここで選べるようになります。', 'Items you mark as owned in the item tracker can be picked here.')}</p>`}
    </div>
    <label class="fun-field"><span class="fun-label">${t('メモ', 'Note')}</span><textarea class="fun-textarea" name="memo" rows="2" maxlength="1000" placeholder="${t('テーマ・こだわり・染色の色など', 'Theme, dye colors, details…')}">${escapeHtml(form.memo || '')}</textarea></label>
    <div class="fun-form-actions">
      ${e ? `<button type="button" class="fun-btn danger${confirmId === e.id ? ' is-confirm' : ''}" data-act="del" data-id="${e.id}">${confirmId === e.id ? t('もう一度押すと削除', 'Tap again to delete') : t('削除', 'Delete')}</button>` : ''}
      <span class="fun-spacer"></span>
      <button type="button" class="fun-btn" data-act="cancel">${t('やめる', 'Cancel')}</button>
      <button type="submit" class="fun-btn primary">${t('保存', 'Save')}</button>
    </div>
  </form>`;
}
function norm(s) { return String(s || '').normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/\s/g, ''); }
function pickHtml() {
  const q = norm(form.query);
  const list = Object.entries(owned).filter(([k, it]) => !form.items.has(k) && (!q || norm(it.name).includes(q) || norm(CURRENT_LANG === 'en' ? it.cat.nameEn : it.cat.name).includes(q))).slice(0, q ? 40 : 12);
  if (!list.length) return `<p class="fun-hint">${t('見つかりません', 'No matches')}</p>`;
  return list.map(([k, it]) => `<button type="button" class="cd-item is-pick" data-act="pick" data-key="${escapeHtml(k)}">${it.img ? `<img src="${escapeHtml(it.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}${escapeHtml(it.name)}</button>`).join('');
}

async function loadPhotos() {
  const slots = root() ? root().querySelectorAll('[data-photo]') : [];
  for (const slot of slots) {
    const id = slot.dataset.photo;
    let url = urls.get(id);
    if (!url) {
      try { const blob = await getPhoto(id); if (!blob) continue; url = URL.createObjectURL(blob); urls.set(id, url); } catch (e) { continue; }
    }
    if (slot.isConnected) slot.innerHTML = `<img src="${url}" alt="" loading="lazy">`;
  }
}

async function shrink(file) {
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(res => c.toBlob(res, 'image/jpeg', 0.85));
  } finally { URL.revokeObjectURL(src); }
}

function openForm(entry, date) {
  clearPending(); confirmId = null;
  form = entry
    ? { id: entry.id, date: entry.date, items: new Set(entry.items.map(x => `${x.cat}:${x.id}`)), memo: entry.memo, place: entry.place, query: '', removePhoto: false }
    : { id: null, date: date || todayStr(), items: new Set(), memo: '', place: '', query: '', removePhoto: false };
  render();
  root().querySelector('.fun-form')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
// 描き直しても入力途中の文字・日付・場所が残るよう、フォームの値をformへ写しておく
function syncForm() {
  const f = root() && root().querySelector('.fun-form');
  if (!f || !form) return;
  form.date = f.elements.date.value || form.date;
  form.memo = f.elements.memo.value;
  form.place = f.elements.place.value;
}

function onClick(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn || btn.disabled) return;
  const { act } = btn.dataset;
  if (act === 'new') { openForm(null); return; }
  if (act === 'prev' || act === 'next') {
    if (form) syncForm();
    const d = new Date(month.y, month.m + (act === 'prev' ? -1 : 1), 1);
    month = { y: d.getFullYear(), m: d.getMonth() }; render(); return;
  }
  if (act === 'day') {
    const list = doc.entries.filter(x => x.date === btn.dataset.date);
    if (list.length) { document.getElementById(`cd-${list[0].id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    openForm(null, btn.dataset.date); return;
  }
  if (act === 'edit') { openForm(doc.entries.find(x => x.id === btn.dataset.id)); return; }
  if (act === 'cancel') { form = null; clearPending(); render(); return; }
  if (act === 'pick' || act === 'unpick') {
    syncForm();
    if (act === 'pick') form.items.add(btn.dataset.key); else form.items.delete(btn.dataset.key);
    render();
    const q = root().querySelector('.fun-form input[name=q]');
    if (q && act === 'pick') { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    return;
  }
  if (act === 'clear-photo') { syncForm(); clearPending(); form.removePhoto = true; render(); return; }
  if (act === 'del') {
    const id = btn.dataset.id;
    if (confirmId !== id) { confirmId = id; syncForm(); render(); return; }
    const entry = doc.entries.find(x => x.id === id);
    if (entry && entry.photoId) deletePhoto(entry.photoId).catch(() => {});
    doc.entries = doc.entries.filter(x => x.id !== id);
    form = null; confirmId = null; save(); render();
  }
}
let qTimer = null;
function onInput(e) {
  if (e.target.name !== 'q' || !form) return;
  form.query = e.target.value;
  clearTimeout(qTimer);
  qTimer = setTimeout(() => { const box = root().querySelector('.cd-pick'); if (box) box.innerHTML = pickHtml(); }, 100);
}
async function onChange(e) {
  if (e.target.name !== 'photo' || !e.target.files || !e.target.files[0]) return;
  try {
    const blob = await shrink(e.target.files[0]);
    if (!blob) throw new Error('no blob');
    syncForm(); clearPending();
    pendingPhoto = blob; pendingUrl = URL.createObjectURL(blob); form.removePhoto = false;
    render();
  } catch (err) { toast(t('この写真は読み込めませんでした', 'Could not read this photo')); }
}
async function onSubmit(e) {
  e.preventDefault();
  syncForm();
  const entry = form.id ? doc.entries.find(x => x.id === form.id) : { id: genId(), photoId: '' };
  entry.date = DATE_RE.test(form.date) ? form.date : todayStr();
  entry.items = [...form.items].map(k => { const [cat, id] = k.split(':'); return { cat, id }; });
  entry.memo = String(form.memo || '').slice(0, 1000);
  entry.place = PLACE_IDS.has(form.place) ? form.place : '';
  const old = entry.photoId;
  if (pendingPhoto) {
    const pid = 'c_' + genId();
    try { await putPhoto(pid, pendingPhoto); entry.photoId = pid; if (old) deletePhoto(old).catch(() => {}); }
    catch (err) { toast(t('写真を保存できませんでした', 'Could not save the photo')); }
  } else if (form.removePhoto && old) { entry.photoId = ''; deletePhoto(old).catch(() => {}); }
  if (!entry.photoId && !entry.items.length && !entry.memo) { toast(t('写真・アイテム・メモのどれかを入れてください', 'Add a photo, items, or a note')); return; }
  if (!form.id) doc.entries.push(entry);
  const [y, m] = entry.date.split('-').map(Number);
  month = { y, m: m - 1 };
  form = null; clearPending(); save(); render();
  toast(t('保存しました', 'Saved'));
}

/* ================================================================
   🪞 コーデ日記（#/coord-diary）。その日のコーデを写真と「着ていたアイテム」で残し、カレンダーで見返す。
   アイテムは、アイテム所持管理で所持にしたもの（gameItems_<cat>.ownedItems）から選ぶ。
   写真はフォト日記と同じ IndexedDB（features/friends/friends-state.js の putPhoto/getPhoto）に保存する。

   coordDiary_v1: { entries: [{ id, date: 'YYYY-MM-DD', photoId?, items: [{ cat, id }], memo, place? }] }

   🪄 アイテム所持管理にあった「コーデ機能」（ランダムコーデ・マイコーデ・クローゼットコラージュ）もここから開く
   （2026-11-06に引っ越し。中身は features/item/coord/ のまま＝保存データも共通。使う時だけ読み込む）。
   コーデの共有リンク（#/item/coord=…）の受け取りは、従来どおりアイテム所持管理が担当する。
   📸 「撮影ポーズに困ったら」（photo-gacha.js）: 撮影お題ガチャを小さな折りたたみで置く（2026-11-06に試作から移した）。
   📚 「シーズンアルバム」タブ（season-album.js）: 季節ごとの記録と写真のアルバム（2026-11-06に試作から移した）。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { nsKey } from '../../js/state.js';
import { notifyChanged } from '../../js/notices.js';
import { CATEGORY_REGISTRY } from '../item/data/categories.js';
import { injectStylesheet } from '../bingo/bingo-view.js';
import { toast, renderElementBlob } from '../shared/share-image.js';
import { PLACES, PLACE_IDS, placeName } from '../shared/places.js';
import { putPhoto, getPhoto, deletePhoto, todayStr } from '../friends/friends-state.js';
import { albumsHtml } from './season-album.js';
import { gachaHtml, handleGacha, ensureEmotes, resetGacha, gachaOpen } from './photo-gacha.js';
import { HUB_BASE_URL } from '../../js/site-config.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
const KEY = 'coordDiary_v1';
const CATS = CATEGORY_REGISTRY.filter(c => c.section !== 'special');
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COORD_TOOLS = {
  random: () => import('../item/coord/random-coord.js'),
  my: () => import('../item/coord/my-coord.js'),
  collage: () => import('../item/coord/closet-collage.js'),
};
const openedTools = new Set();
const TAB_KEY = 'sky_coord_tab'; // 'diary'＝コーデ日記 ／ 'album'＝シーズンアルバム
let tab = 'diary';
let albumOpen = null;

let containerEl = null;
let doc = null;
let owned = null; // { 'cat:id': {cat, id, name, img, key} }（所持中のアイテム）
let catalog = null; // { 'cat:id': {cat, id, name, img, key} }（全アイテム。名前・画像・読みがなの元）
let catalogLoading = null;
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
// 所持の判定は itemOwned（所持の正本）で行う。ownedItems（アイテム所持管理が保存する一覧）は、精霊ツリーとの同期で
// 所持になった分が入らないことがあり、画像の無い古い形も残っているため、名前と画像はアイテムのデータ（items/<cat>.js）から引く。
// データを読み終わるまでは ownedItems で仮に表示する
function ownedMaps() {
  const out = {};
  CATS.forEach(c => {
    try { out[c.key] = (JSON.parse(localStorage.getItem(nsKey('gameItems_' + c.key))) || {}); } catch (e) { out[c.key] = {}; }
  });
  return out;
}
function loadOwned() {
  const maps = ownedMaps();
  const out = {};
  CATS.forEach(c => {
    const d = maps[c.key];
    const ownedIds = d.itemOwned || {};
    if (catalog) {
      Object.keys(ownedIds).forEach(id => { const it = catalog[`${c.key}:${id}`]; if (ownedIds[id] && it) out[it.k] = it; });
    } else {
      (Array.isArray(d.ownedItems) ? d.ownedItems : []).forEach(it => {
        if (it && it.id && ownedIds[it.id]) {
          const name = CURRENT_LANG === 'en' ? (it.nameEn || it.name) : it.name;
          out[`${c.key}:${it.id}`] = { k: `${c.key}:${it.id}`, cat: c, id: it.id, name, img: it.img, key: norm(`${it.name} ${it.nameEn || ''} ${c.name} ${c.nameEn}`) };
        }
      });
    }
  });
  return out;
}
function loadCatalog() {
  if (catalog) return Promise.resolve(catalog);
  if (catalogLoading) return catalogLoading;
  catalogLoading = Promise.all([
    import('../item/data/yomi-data.js').catch(() => ({ ITEM_YOMI: {} })),
    ...CATS.map(c => import(`../item/data/items/${c.key}.js`).catch(() => ({ ITEMS: [] }))),
  ]).then(([yomiMod, ...mods]) => {
    const yomi = yomiMod.ITEM_YOMI || {};
    const out = {};
    CATS.forEach((c, i) => (mods[i].ITEMS || []).forEach(it => {
      const k = `${c.key}:${it.id}`;
      // 検索はひらがな・カタカナ・英語名・読みがな・カテゴリ名のどれでも当たるようにする
      out[k] = { k, cat: c, id: it.id, name: CURRENT_LANG === 'en' ? (it.nameEn || it.name) : it.name, img: it.img || '', key: norm(`${it.name} ${it.nameEn || ''} ${yomi[it.id] || ''} ${c.name} ${c.nameEn} ${it.event || ''}`) };
    }));
    catalog = out;
    return out;
  }).catch(e => { catalogLoading = null; throw e; });
  return catalogLoading;
}

export function mount(container) {
  injectStylesheet();
  containerEl = container;
  doc = load();
  owned = loadOwned();
  loadCatalog().then(() => {
    if (!containerEl) return;
    owned = loadOwned();
    // 入力中の検索欄・フォームを消さないよう、候補とアイテム表示の部分だけ差し替える（フォームが無ければ全体を描き直す）
    if (form) {
      syncForm();
      const box = root().querySelector('.cd-pick'); if (box) box.innerHTML = pickHtml();
      const sel = root().querySelector('.cd-selected'); if (sel) sel.innerHTML = selectedHtml();
      const list = root().querySelector('.cd-list'); if (list) list.innerHTML = monthEntries().map(entryHtml).join('');
      loadPhotos();
    } else render();
  }).catch(() => {});
  const now = new Date();
  month = { y: now.getFullYear(), m: now.getMonth() };
  form = null; confirmId = null; albumOpen = null;
  resetGacha();
  try { tab = localStorage.getItem(TAB_KEY) === 'album' ? 'album' : 'diary'; } catch (e) { tab = 'diary'; }
  container.innerHTML = '<div class="coord-diary-view fun-view"></div>';
  render();
  const r = root();
  r.addEventListener('click', onClick);
  r.addEventListener('change', onChange);
  r.addEventListener('input', onInput);
  r.addEventListener('submit', onSubmit);
}
export function unmount() {
  // 開きっぱなしのコーデ機能のモーダルを閉じる（アイテム所持管理のダッシュボードと同じ後片付け）
  openedTools.forEach(k => COORD_TOOLS[k]().then(m => { try { m.close(); } catch (e) { /* noop */ } }));
  openedTools.clear();
  urls.forEach(u => URL.revokeObjectURL(u)); urls.clear();
  clearPending();
  containerEl = null;
}
function root() { return containerEl && containerEl.querySelector('.coord-diary-view'); }
function clearPending() { if (pendingUrl) URL.revokeObjectURL(pendingUrl); pendingPhoto = null; pendingUrl = null; }

function itemInfo(x) {
  const k = `${x.cat}:${x.id}`;
  return (catalog && catalog[k]) || owned[k] || { cat: CATS.find(c => c.key === x.cat), id: x.id, name: x.id, img: '' };
}
function fmtDate(str) { const [y, m, d] = str.split('-').map(Number); return t(`${m}月${d}日`, `${m}/${d}`) + (y !== new Date().getFullYear() ? t(`（${y}年）`, ` ${y}`) : ''); }

function render() {
  const r = root();
  if (!r) return;
  const inMonth = monthEntries();
  r.innerHTML = `<div class="fun-wrap">
    <header class="fun-head">
      <h1 class="fun-h1"><svg class="inline-icon" width="22" height="22" aria-hidden="true"><use href="#i-hanger"/></svg>${t('コーデ日記', 'Outfit Diary')}</h1>
      <p class="fun-lead">${t('その日のコーデを、写真と着ていたアイテムで残しておけます。アイテムは「アイテム所持管理」で所持にしたものから選べます。', 'Log your outfit of the day with a photo and the items you wore, picked from your owned items.')}</p>
    </header>
    <div class="cd-tools" role="group" aria-label="${t('コーデ機能', 'Coord tools')}">
      ${toolBtn('random', 'i-dice', t('ランダムコーデ', 'Random Coord'), t('所持アイテムからコーデを提案', 'A random outfit from your items'))}
      ${toolBtn('my', 'i-hanger', t('マイコーデ', 'My Coord'), t('お気に入りのコーデを保存', 'Save favorite outfits'))}
      ${toolBtn('collage', 'i-image', t('クローゼットコラージュ', 'Closet Collage'), t('アイテムや写真でコラージュ', 'Make a collage image'))}
    </div>
    ${gachaHtml()}
    <div class="fun-tabs" role="tablist">
      <button type="button" class="fun-tab${tab === 'diary' ? ' on' : ''}" role="tab" aria-selected="${tab === 'diary'}" data-act="tab" data-tab="diary">${t('コーデ日記', 'Outfit diary')}</button>
      <button type="button" class="fun-tab${tab === 'album' ? ' on' : ''}" role="tab" aria-selected="${tab === 'album'}" data-act="tab" data-tab="album">${t('シーズンアルバム', 'Season album')}</button>
    </div>
    ${tab === 'album' ? albumsHtml(albumOpen) : diaryTabHtml(inMonth)}
  </div>`;
  loadPhotos();
}

function diaryTabHtml(inMonth) {
  return `
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
    ${favoritesHtml()}`;
}

function toolBtn(key, icon, label, desc) {
  return `<button type="button" class="cd-tool" data-act="tool" data-tool="${key}"><span class="cd-tool-ic"><svg class="inline-icon" width="20" height="20"><use href="#${icon}"/></svg></span><span class="cd-tool-text"><b>${escapeHtml(label)}</b><small>${escapeHtml(desc)}</small></span></button>`;
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
      <div class="cd-entry-actions"><button type="button" class="fun-btn small cd-post-btn" data-act="post" data-id="${e.id}">${X_ICON}${t('Xでポスト', 'Post on X')}</button></div>
    </div>
    <button type="button" class="fun-icon-btn fr-entry-edit" data-act="edit" data-id="${e.id}" aria-label="${t('編集', 'Edit')}"><svg class="inline-icon" width="15" height="15"><use href="#i-edit"/></svg></button>
  </article>`;
}

/* ── 📣 Xでポスト ─────────────────────────────────────────────
   投稿文は日付・場所・メモとハッシュタグ・URL（Xの文字数＝全角は2として280まで。メモを後ろから短くする）。
   着ているアイテムは名前を並べず、アイコンをまとめた1枚の画像にして添付する（写真があれば画像の上に入れる）。
   スマホは共有シートで画像ごと渡し（Xを選べば画像付きで投稿できる）、それ以外は投稿画面を開いて画像を端末に保存する
   （Xの投稿画面へ画像は自動で付けられないため、手で添付してもらう）。 */
const X_ICON = '<svg class="cd-x-ic" width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.32l4.37 5.78zm-1.08 16.18h1.7L7.4 4.73H5.58z"/></svg>';
const POST_TAGS = '#Skyコーデ日記 #Sky星を紡ぐ子どもたち';
function xLength(str) { return [...str].reduce((n, ch) => n + (ch.codePointAt(0) > 0x10FF ? 2 : 1), 0); }
function buildPostText(e) {
  const [, m, d] = e.date.split('-').map(Number);
  const head = t(`${m}月${d}日のコーデ`, `My outfit on ${m}/${d}`) + (e.place ? t(`（${placeName(e.place, CURRENT_LANG)}）`, ` (${placeName(e.place, CURRENT_LANG)})`) : '');
  let memo = e.memo.trim();
  const compose = () => [head, memo, POST_TAGS].filter(Boolean).join('\n');
  const budget = 280 - 24; // URLは23文字として数えられる（＋改行）
  while (xLength(compose()) > budget && memo) memo = memo.length > 12 ? memo.slice(0, -8).trimEnd() + '…' : '';
  return `${compose()}\n${HUB_BASE_URL}`;
}
function isMobileDevice() {
  if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') return navigator.userAgentData.mobile;
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPod|iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}
// 投稿に添付する画像（写真＋着ているアイテムのアイコン）。画面の外に組み立てて画像にする
function coordCardHtml(e, photoUrl) {
  const [y, m, d] = e.date.split('-').map(Number);
  const items = e.items.map(itemInfo);
  return `<div class="cd-share-card">
    <div class="cd-share-head"><b>${t(`${m}月${d}日のコーデ`, `Outfit · ${m}/${d}/${y}`)}</b>${e.place ? `<span>${escapeHtml(placeName(e.place, CURRENT_LANG))}</span>` : ''}</div>
    ${photoUrl ? `<div class="cd-share-photo"><img src="${photoUrl}" alt=""></div>` : ''}
    ${items.length ? `<div class="cd-share-icons${items.length <= 4 ? ' is-few' : ''}">${items.map(it => `<span class="cd-share-icon">${it.img ? `<img src="${escapeHtml(it.img)}" alt="" crossorigin="anonymous" referrerpolicy="no-referrer">` : `<b>${escapeHtml(it.name.slice(0, 6))}</b>`}</span>`).join('')}</div>` : ''}
    <div class="cd-share-foot"><span>tai-hub ${t('コーデ日記', 'Outfit Diary')}</span><small>© Sky: Children of the Light Icons by contributors of the Sky: Children of the Light wiki</small></div>
  </div>`;
}
async function buildCoordImage(e) {
  if (!e.items.length && !e.photoId) return null;
  let photoUrl = '';
  if (e.photoId) { try { const b = await getPhoto(e.photoId); if (b) photoUrl = URL.createObjectURL(b); } catch (err) { photoUrl = ''; } }
  const stage = document.createElement('div');
  stage.className = 'cd-share-stage';
  stage.innerHTML = coordCardHtml(e, photoUrl);
  root().appendChild(stage);
  try {
    // 画像を読み終えてから写す（読めないアイコンは消して、空のマスにする）
    await Promise.all([...stage.querySelectorAll('img')].map(img => (img.complete && img.naturalWidth ? null : new Promise(res => { img.onload = res; img.onerror = () => { img.remove(); res(); }; setTimeout(res, 6000); }))));
    const bg = getComputedStyle(stage.querySelector('.cd-share-card')).backgroundColor || '#ffffff';
    return await renderElementBlob(stage.querySelector('.cd-share-card'), bg);
  } finally {
    stage.remove();
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }
}
async function postEntry(e) {
  const text = buildPostText(e);
  let blob = null;
  if (e.items.length || e.photoId) {
    toast(t('画像を作っています…', 'Creating the image…'), 8000);
    try { blob = await buildCoordImage(e); } catch (err) { blob = null; }
    toast(null);
  }
  const filename = `coord-${e.date}.png`;
  if (blob && isMobileDevice() && navigator.share && navigator.canShare) {
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text }); return; } catch (err) { if (err && err.name === 'AbortError') return; }
    }
  }
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  if (blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(t('コーデの画像を端末に保存しました。Xの投稿画面で添付してください', 'Outfit image saved — attach it in the X post'), 4500);
  } else if (e.items.length || e.photoId) {
    toast(t('画像を作れませんでした。文章だけで投稿画面を開きました', 'Could not create the image; opened the post with text only'), 4000);
  }
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
  const selectedCount = form.items.size;
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
      <span class="fun-label">${t('着ていたアイテム', 'Items worn')} <span class="cd-sel-count">${selectedCount}</span></span>
      <div class="cd-items cd-selected">${selectedHtml()}</div>
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
function selectedHtml() {
  return [...form.items].map(k => {
    const [cat, id] = k.split(':');
    const it = itemInfo({ cat, id });
    return `<button type="button" class="cd-item is-chip" data-act="unpick" data-key="${escapeHtml(k)}">${it.img ? `<img src="${escapeHtml(it.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}${escapeHtml(it.name)}<svg class="inline-icon" width="11" height="11"><use href="#i-close"/></svg></button>`;
  }).join('');
}
function monthEntries() {
  const mKey = `${month.y}-${String(month.m + 1).padStart(2, '0')}`;
  return doc.entries.filter(e => e.date.startsWith(mKey)).sort((a, b) => b.date.localeCompare(a.date));
}
function norm(s) { return String(s || '').normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/\s/g, ''); }
function pickHtml() {
  const q = norm(form.query);
  const list = Object.entries(owned).filter(([k, it]) => !form.items.has(k) && (!q || it.key.includes(q))).slice(0, q ? 40 : 12);
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
    if (!slot.isConnected || slot.querySelector('img')) continue;
    // アルバムの枠は日付などの文字を持っているので、その前に写真を差し込む
    if (slot.classList.contains('sa-photo') || slot.classList.contains('sa-cover-photo')) slot.insertAdjacentHTML('afterbegin', `<img src="${url}" alt="" loading="lazy">`);
    else slot.innerHTML = `<img src="${url}" alt="" loading="lazy">`;
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
  if (act === 'tab') {
    if (form) syncForm();
    tab = btn.dataset.tab === 'album' ? 'album' : 'diary';
    try { localStorage.setItem(TAB_KEY, tab); } catch (err) { /* noop */ }
    render(); return;
  }
  if (act.startsWith('gacha-')) {
    if (form) syncForm();
    if (handleGacha(act)) {
      render();
      if (gachaOpen) ensureEmotes(() => { if (containerEl) { if (form) syncForm(); render(); } });
    }
    return;
  }
  if (act === 'album-toggle') { albumOpen = albumOpen === btn.dataset.key ? null : btn.dataset.key; render(); return; }
  if (act === 'tool') {
    const key = btn.dataset.tool;
    if (!COORD_TOOLS[key]) return;
    openedTools.add(key);
    COORD_TOOLS[key]().then(m => m.open()).catch(() => toast(t('読み込めませんでした。通信状態を確かめてください', 'Could not load. Check your connection.')));
    return;
  }
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
  if (act === 'post') { const entry = doc.entries.find(x => x.id === btn.dataset.id); if (entry) postEntry(entry); return; }
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

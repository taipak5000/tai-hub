/* ================================================================
   🔎 ツール横断検索（関連ツールの一覧の先頭「さがす」・キーボードの「/」から開く）。
   アイテム（12カテゴリ）・楽譜・エモート・精霊・ツール名を、ひとつの入力欄でまとめて探す。
   ひらがな／カタカナ／英語名のどれでも当たる（アイテムと精霊は読みがなのデータも使う）。

   データは開いた時に初めて読み込む（精霊ツリーのデータは大きいので、起動時には読まない）。
   結果を選ぶと、そのツールへ移動して、ツール側の絞り込み欄に同じ言葉を入れる
   （精霊はツリーの詳細を直接開く）。所持済みのアイテム・エモートには印を付ける。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../i18n.js';
import { navigate } from '../router.js';
import { nsKey } from '../state.js';
import { getSiteLinks, siteLinkName } from '../site-links.js';
import { CATEGORY_REGISTRY } from '../../features/item/data/categories.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
const MAX_PER_GROUP = 8;

let overlayEl = null;
let index = null; // { items, music, emotes, spirits }
let loading = null;
let lastQuery = '';

export function norm(str) {
  return String(str || '').normalize('NFKC').toLowerCase()
    .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s・･\-_.'’"]/g, '');
}

function ownedMap(catKey) {
  try {
    const raw = localStorage.getItem(nsKey('gameItems_' + catKey)) || (catKey === 'music_sheet' ? localStorage.getItem(nsKey('musicSheets')) : null);
    return (raw && JSON.parse(raw).itemOwned) || {};
  } catch (e) { return {}; }
}

async function buildIndex() {
  const cats = CATEGORY_REGISTRY.filter(c => c.section !== 'special');
  const [yomiMod, musicMod, emoteMod, treeMod, spiritYomiMod, ...catMods] = await Promise.all([
    import('../../features/item/data/yomi-data.js'),
    import('../../features/item/data/music-sheets-data.js'),
    import('../../features/emote/data/emotes.js'),
    import('../../features/spirit-catalog/data/spirit-tree-data.js'),
    import('../../features/spirit-catalog/data/spirit-yomi-data.js'),
    ...cats.map(c => import(`../../features/item/data/items/${c.key}.js`).catch(() => ({ ITEMS: [] }))),
  ]);
  const yomi = yomiMod.ITEM_YOMI || {};
  const items = [];
  cats.forEach((c, i) => {
    (catMods[i].ITEMS || []).forEach(it => {
      items.push({ cat: c, id: it.id, name: it.name, nameEn: it.nameEn || '', img: it.img, key: norm(`${it.name} ${it.nameEn || ''} ${yomi[it.id] || ''} ${it.event || ''}`) });
    });
  });
  const music = (musicMod.MUSIC_SHEETS || []).map(m => ({
    id: m.id, name: m.name, num: m.num, spirit: m.spirit, season: m.season, img: m.img,
    key: norm(`${m.name} ${m.num} 楽譜${m.num} ${m.spirit || ''} ${m.spiritEn || ''} ${m.season || ''}`),
  }));
  const emotes = (emoteMod.EMOTES || []).map(e => ({
    id: e.id, name: e.name, nameEn: e.nameEn, img: e.img, spirit: e.spirit, location: e.location,
    key: norm(`${e.name} ${e.nameEn} ${e.spirit || ''} ${e.spiritEn || ''}`),
  }));
  const sy = spiritYomiMod.SPIRIT_YOMI || {};
  const spirits = (treeMod.SPIRIT_TREE_DATA || []).map(s => ({
    guid: s.guid, nameJa: s.nameJa || s.name, nameEn: s.name, type: s.type,
    key: norm(`${s.nameJa || ''} ${s.name} ${sy[s.nameJa] || ''}`),
  }));
  return { items, music, emotes, spirits };
}

function ensureIndex() {
  if (index) return Promise.resolve(index);
  if (!loading) loading = buildIndex().then(r => { index = r; return r; }).catch(e => { loading = null; throw e; });
  return loading;
}

export function open(initial = '') {
  document.getElementById('searchModalOverlay')?.remove();
  overlayEl = document.createElement('div');
  overlayEl.className = 'modal-overlay';
  overlayEl.id = 'searchModalOverlay';
  overlayEl.addEventListener('click', e => { if (e.target === overlayEl) close(); });
  overlayEl.innerHTML = `
    <div class="modal-card search-card" role="dialog" aria-modal="true" aria-labelledby="hubSearchTitle">
      <button type="button" class="modal-close-btn" id="hubSearchClose" aria-label="${t('閉じる', 'Close')}"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      <div class="modal-title" id="hubSearchTitle">${t('まとめてさがす', 'Search everything')}</div>
      <label class="hub-search-field">
        <svg class="inline-icon" width="18" height="18" aria-hidden="true"><use href="#i-search"/></svg>
        <input type="search" id="hubSearchInput" enterkeyhint="search" autocomplete="off" placeholder="${t('アイテム・エモート・精霊・楽譜・ツール', 'Items, emotes, spirits, music, tools')}" value="${escapeHtml(initial || lastQuery)}">
      </label>
      <div id="hubSearchResults" class="hub-search-results" aria-live="polite"></div>
    </div>`;
  document.body.appendChild(overlayEl);
  overlayEl.querySelector('#hubSearchClose').addEventListener('click', close);
  const input = overlayEl.querySelector('#hubSearchInput');
  let timer = null;
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 120); });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const first = overlayEl.querySelector('.hub-search-hit'); if (first) first.click(); }
  });
  overlayEl.querySelector('#hubSearchResults').addEventListener('click', onPick);
  requestAnimationFrame(() => { overlayEl && overlayEl.classList.add('open'); input.focus(); input.select(); });
  render();
  ensureIndex().then(() => { if (overlayEl) render(); }).catch(() => {
    const box = overlayEl && overlayEl.querySelector('#hubSearchResults');
    if (box) box.innerHTML = `<p class="hub-search-note">${t('データを読み込めませんでした。通信状態を確かめてもう一度開いてください', 'Could not load the data. Check your connection and try again.')}</p>`;
  });
}

export function close() { overlayEl?.classList.remove('open'); }

function match(list, q) {
  const starts = [], contains = [];
  for (const x of list) {
    const i = x.key.indexOf(q);
    if (i === 0) starts.push(x); else if (i > 0) contains.push(x);
    if (starts.length >= 60) break;
  }
  return starts.concat(contains);
}

function groupHtml(title, hits, rowFn, total) {
  if (!hits.length) return '';
  return `<section class="hub-search-group"><h3>${escapeHtml(title)}<span>${total}</span></h3><ul>${hits.map(rowFn).join('')}</ul></section>`;
}
function thumb(img, icon) {
  return img ? `<span class="hub-search-thumb"><img src="${escapeHtml(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()"></span>`
    : `<span class="hub-search-thumb"><svg class="inline-icon" width="18" height="18"><use href="#${icon}"/></svg></span>`;
}
const ownedTag = () => `<span class="hub-search-owned"><svg class="inline-icon" width="12" height="12"><use href="#i-check"/></svg>${t('所持', 'Owned')}</span>`;

function render() {
  if (!overlayEl) return;
  const box = overlayEl.querySelector('#hubSearchResults');
  const raw = overlayEl.querySelector('#hubSearchInput').value.trim();
  lastQuery = raw;
  const q = norm(raw);
  if (!q) {
    box.innerHTML = `<p class="hub-search-note">${t('名前の一部や読みがなで探せます。例:「まんた」「ケープ」「おじぎ」', 'Type part of a name, e.g. “manta”, “cape”, “bow”.')}</p>`;
    return;
  }
  const tools = (getSiteLinks() || []).filter(s => norm(`${s.ja} ${s.en}`).includes(q));
  let html = groupHtml(t('ツール', 'Tools'), tools, s => `<li><button type="button" class="hub-search-hit" data-route="${escapeHtml(s.id)}">${thumb(null, s.icon)}<span class="hub-search-name">${escapeHtml(siteLinkName(s, CURRENT_LANG))}</span></button></li>`, tools.length);
  if (!index) {
    box.innerHTML = html + `<p class="hub-search-note"><span class="rt-spinner hub-search-spin"></span>${t('データを読み込んでいます…', 'Loading data…')}</p>`;
    return;
  }
  const spirits = match(index.spirits, q);
  const items = match(index.items, q);
  const music = match(index.music, q);
  const emotes = match(index.emotes, q);
  const owned = {};
  const isOwned = (catKey, id) => { owned[catKey] = owned[catKey] || ownedMap(catKey); return !!owned[catKey][id]; };
  let emoteOwned = {};
  try { emoteOwned = JSON.parse(localStorage.getItem(nsKey('emoteOwned_v1'))) || {}; } catch (e) { /* noop */ }

  html += groupHtml(t('精霊', 'Spirits'), spirits.slice(0, MAX_PER_GROUP), s => `<li><button type="button" class="hub-search-hit" data-route="spirit-catalog" data-sub="${escapeHtml(encodeURIComponent(s.guid))}">${thumb(null, 'i-tree')}<span class="hub-search-name">${escapeHtml(CURRENT_LANG === 'en' ? s.nameEn : s.nameJa)}</span><span class="hub-search-sub">${t('精霊ツリー', 'Spirit tree')}</span></button></li>`, spirits.length);
  html += groupHtml(t('アイテム', 'Items'), items.slice(0, MAX_PER_GROUP), it => `<li><button type="button" class="hub-search-hit" data-route="item" data-sub="${escapeHtml(it.cat.key)}" data-fill="#searchName" data-q="${escapeHtml(it.name)}">${thumb(it.img, 'i-folder')}<span class="hub-search-name">${escapeHtml(CURRENT_LANG === 'en' ? it.nameEn || it.name : it.name)}</span><span class="hub-search-sub">${escapeHtml(CURRENT_LANG === 'en' ? it.cat.nameEn : it.cat.name)}</span>${isOwned(it.cat.key, it.id) ? ownedTag() : ''}</button></li>`, items.length);
  html += groupHtml(t('エモート', 'Emotes'), emotes.slice(0, MAX_PER_GROUP), e => `<li><button type="button" class="hub-search-hit" data-route="emote" data-fill="#emSearchName" data-q="${escapeHtml(CURRENT_LANG === 'en' ? e.nameEn : e.name)}">${thumb(e.img, 'i-masks')}<span class="hub-search-name">${escapeHtml(CURRENT_LANG === 'en' ? e.nameEn : e.name)}</span><span class="hub-search-sub">${escapeHtml(e.spirit || e.location || '')}</span>${(emoteOwned[e.id] || []).length ? ownedTag() : ''}</button></li>`, emotes.length);
  html += groupHtml(t('楽譜', 'Music sheets'), music.slice(0, MAX_PER_GROUP), m => `<li><button type="button" class="hub-search-hit" data-route="item" data-sub="music_sheet" data-fill="#msSearchName" data-q="${escapeHtml(m.name)}">${thumb(m.img, 'i-sheet-music')}<span class="hub-search-name">${escapeHtml(m.name)}</span><span class="hub-search-sub">${escapeHtml([m.num && (/^\d/.test(m.num) ? '#' + m.num : m.num), m.spirit].filter(Boolean).join(' ・ '))}</span>${isOwned('music_sheet', m.id) ? ownedTag() : ''}</button></li>`, music.length);
  box.innerHTML = html || `<p class="hub-search-note">${t('見つかりませんでした。別の言い方や読みがなでも試してみてください', 'No results. Try another spelling.')}</p>`;
}

function onPick(e) {
  const hit = e.target.closest('.hub-search-hit');
  if (!hit) return;
  const { route, sub, fill, q } = hit.dataset;
  close();
  navigate(route, sub || '');
  if (fill && q) fillWhenReady(fill, q);
}

// 移動先のツールが描画し終わるのを待ってから、絞り込み欄に言葉を入れる（最大4秒）
function fillWhenReady(selector, value) {
  const started = Date.now();
  const tryFill = () => {
    const el = document.querySelector(`#app-root ${selector}`);
    if (el) {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    if (Date.now() - started < 4000) setTimeout(tryFill, 80);
  };
  setTimeout(tryFill, 60);
}

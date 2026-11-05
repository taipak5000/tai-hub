/* ================================================================
   ⭐ シール帳（#/lab-stickers・試作）。ページにシールを貼って、指で動かして自由に飾る（2025年ごろからのシール帳ブームの遊び）。
   - シールを選ぶとページの真ん中に貼られる。ドラッグで移動（setPointerCapture で指に1:1で追従）。
   - 選んだシールは、下の欄で大きさ・向きを変えたり、前に出したり、はがしたりできる。
   - ページは何枚でも作れて、台紙の柄を選べる。画像で保存もできる。
   stickerBook_v1: { activeId, pages: [{ id, title, bg, items: [{ id, ch, x, y（0〜100の%）, s（倍率）, r（度） }] }] }
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { injectStylesheet } from '../bingo/bingo-view.js';
import { saveElementImage, toast } from '../shared/share-image.js';
import { t, readJson, writeJson, genId, labHeadHtml } from './lab-common.js';

const KEY = 'stickerBook_v1';
const SETS = [
  { ja: 'Sky', en: 'Sky', list: ['🕯️', '⭐', '🌙', '☁️', '🦋', '🐳', '🦀', '🌈', '🪽', '🎵', '🎻', '🪄', '🔥', '💫', '🌟', '✨'] },
  { ja: 'かわいい', en: 'Cute', list: ['💖', '🎀', '🌸', '🍓', '🧸', '🍰', '🫧', '💐', '🌷', '🍭', '🐰', '🐱', '🐻', '🍒', '🩷', '💝'] },
  { ja: 'しぜん', en: 'Nature', list: ['🌿', '🍀', '🌻', '🍁', '🍄', '🌊', '❄️', '☀️', '🌺', '🌵', '🐚', '🪸', '🌼', '🍂', '🌳', '🪷'] },
  { ja: 'ことば', en: 'Words', list: ['ありがとう', 'だいすき', 'おつかれさま', 'すてき', 'また遊ぼう', 'Thank you', 'Love', 'Happy', '♡', '☆', '♪', '✿'] },
];
const BGS = {
  dot: { ja: 'ドット', en: 'Dots' }, grid: { ja: '方眼', en: 'Grid' }, pink: { ja: 'ピンク', en: 'Pink' },
  sky: { ja: 'そら', en: 'Sky' }, night: { ja: '夜空', en: 'Night' }, kraft: { ja: 'クラフト', en: 'Kraft' },
};

let containerEl = null;
let doc = null;
let selectedId = null;
let setIdx = 0;
let drag = null;

function load() {
  const d = readJson(KEY, {});
  const pages = (Array.isArray(d.pages) ? d.pages : []).filter(p => p && p.id).slice(0, 50).map(p => ({
    id: String(p.id).slice(0, 40), title: typeof p.title === 'string' ? p.title.slice(0, 30) : '', bg: BGS[p.bg] ? p.bg : 'dot',
    items: (Array.isArray(p.items) ? p.items : []).filter(i => i && typeof i.ch === 'string').slice(0, 200).map(i => ({
      id: String(i.id || genId()).slice(0, 40), ch: i.ch.slice(0, 12),
      x: clamp(Number(i.x) || 50, 0, 100), y: clamp(Number(i.y) || 50, 0, 100), s: clamp(Number(i.s) || 1, 0.4, 4), r: clamp(Number(i.r) || 0, -180, 180),
    })),
  }));
  if (!pages.length) pages.push({ id: genId(), title: '', bg: 'dot', items: [] });
  return { activeId: pages.some(p => p.id === d.activeId) ? d.activeId : pages[0].id, pages };
}
function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
function page() { return doc.pages.find(p => p.id === doc.activeId) || doc.pages[0]; }
function save() { writeJson(KEY, doc); }

export function mount(container) {
  injectStylesheet();
  containerEl = container;
  doc = load(); selectedId = null; drag = null;
  container.innerHTML = '<div class="lab-stickers-view fun-view"></div>';
  render();
  const r = root();
  r.addEventListener('click', onClick);
  r.addEventListener('input', onInput);
  r.addEventListener('pointerdown', onDown);
}
export function unmount() { containerEl = null; drag = null; }
function root() { return containerEl && containerEl.querySelector('.lab-stickers-view'); }

function render() {
  const r = root();
  if (!r) return;
  const p = page();
  const sel = p.items.find(i => i.id === selectedId);
  r.innerHTML = `<div class="fun-wrap">
    ${labHeadHtml('stickers', t('シールを選ぶとページに貼られます。指でドラッグして好きな場所へ動かしましょう。', 'Pick a sticker to place it, then drag it anywhere.'))}
    <div class="dc-tabs sk-tabs">${doc.pages.map((pg, i) => `<button type="button" class="fun-chip${pg.id === p.id ? ' on' : ''}" data-act="page" data-id="${pg.id}">${escapeHtml(pg.title || t(`${i + 1}ページ`, `Page ${i + 1}`))}</button>`).join('')}
      <button type="button" class="fun-chip" data-act="new-page">＋ ${t('ページ', 'Page')}</button></div>
    <div class="sk-page bg-${p.bg}" id="skPage" data-no-sheet-drag>
      ${p.items.map(i => `<span class="sk-item${i.id === selectedId ? ' sel' : ''}${[...i.ch].length > 2 ? ' is-word' : ''}" data-sid="${i.id}" style="left:${i.x}%;top:${i.y}%;--s:${i.s};--r:${i.r}deg">${escapeHtml(i.ch)}</span>`).join('')}
      ${p.items.length ? '' : `<span class="sk-empty">${t('下のシールを押して貼ってみよう', 'Tap a sticker below to place it')}</span>`}
    </div>
    ${sel ? `<section class="sk-edit">
      <label><span>${t('大きさ', 'Size')}</span><input type="range" min="0.4" max="4" step="0.05" value="${sel.s}" data-f="s"></label>
      <label><span>${t('向き', 'Angle')}</span><input type="range" min="-180" max="180" step="1" value="${sel.r}" data-f="r"></label>
      <div class="fun-chips"><button type="button" class="fun-chip" data-act="front">${t('いちばん前へ', 'Bring to front')}</button><button type="button" class="fun-chip" data-act="dup">${t('ふやす', 'Duplicate')}</button><button type="button" class="fun-chip is-confirm" data-act="peel">${t('はがす', 'Peel off')}</button><button type="button" class="fun-chip" data-act="deselect">${t('選ぶのをやめる', 'Done')}</button></div>
    </section>` : ''}
    <section class="sk-palette">
      <div class="fun-chips">${SETS.map((s, i) => `<button type="button" class="fun-chip${i === setIdx ? ' on' : ''}" data-act="set" data-i="${i}">${escapeHtml(t(s.ja, s.en))}</button>`).join('')}</div>
      <div class="sk-stickers">${SETS[setIdx].list.map(ch => `<button type="button" class="sk-pick${[...ch].length > 2 ? ' is-word' : ''}" data-act="add" data-ch="${escapeHtml(ch)}">${escapeHtml(ch)}</button>`).join('')}</div>
    </section>
    <section class="sk-settings">
      <label class="fun-field"><span class="fun-label">${t('ページの名前', 'Page title')}</span><input class="fun-input" data-f="title" maxlength="30" value="${escapeHtml(p.title)}" placeholder="${t('例: 11月のおもいで', 'e.g. November memories')}"></label>
      <div class="fun-field"><span class="fun-label">${t('台紙', 'Background')}</span><div class="fun-chips">${Object.keys(BGS).map(k => `<button type="button" class="fun-chip${p.bg === k ? ' on' : ''}" data-act="bg" data-k="${k}">${escapeHtml(t(BGS[k].ja, BGS[k].en))}</button>`).join('')}</div></div>
      <div class="fun-actions"><button type="button" class="fun-btn primary" data-act="image"><svg class="inline-icon" width="15" height="15"><use href="#i-image"/></svg>${t('画像で保存', 'Save image')}</button>
        ${doc.pages.length > 1 ? `<button type="button" class="fun-btn danger" data-act="del-page">${t('このページを削除', 'Delete page')}</button>` : ''}</div>
    </section>
  </div>`;
}

function onClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const p = page();
  const act = b.dataset.act;
  const sel = p.items.find(i => i.id === selectedId);
  if (act === 'add') {
    const it = { id: genId(), ch: b.dataset.ch, x: 40 + Math.random() * 20, y: 40 + Math.random() * 20, s: 1, r: Math.round(Math.random() * 30 - 15) };
    p.items.push(it); selectedId = it.id; save(); render();
    root().querySelector(`[data-sid="${it.id}"]`)?.classList.add('just-placed');
    return;
  }
  if (act === 'set') { setIdx = Number(b.dataset.i); render(); return; }
  if (act === 'page') { doc.activeId = b.dataset.id; selectedId = null; save(); render(); return; }
  if (act === 'new-page') { const pg = { id: genId(), title: '', bg: 'dot', items: [] }; doc.pages.push(pg); doc.activeId = pg.id; selectedId = null; save(); render(); return; }
  if (act === 'bg') { p.bg = b.dataset.k; save(); render(); return; }
  if (act === 'deselect') { selectedId = null; render(); return; }
  if (act === 'front' && sel) { p.items = p.items.filter(i => i !== sel).concat(sel); save(); render(); return; }
  if (act === 'dup' && sel) { const c = { ...sel, id: genId(), x: clamp(sel.x + 6, 0, 100), y: clamp(sel.y + 6, 0, 100) }; p.items.push(c); selectedId = c.id; save(); render(); return; }
  if (act === 'peel' && sel) { p.items = p.items.filter(i => i !== sel); selectedId = null; save(); render(); return; }
  if (act === 'del-page') {
    if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = t('もう一度押すと削除', 'Tap again to delete'); b.classList.add('is-confirm'); return; }
    doc.pages = doc.pages.filter(x => x.id !== p.id); doc.activeId = doc.pages[0].id; selectedId = null; save(); render(); return;
  }
  if (act === 'image') saveImage();
}

function onInput(e) {
  const f = e.target.dataset.f;
  const p = page();
  if (f === 'title') { p.title = e.target.value.slice(0, 30); save(); const chip = root().querySelector('.sk-tabs .fun-chip.on'); if (chip) chip.textContent = p.title || t('ページ', 'Page'); return; }
  const sel = p.items.find(i => i.id === selectedId);
  if (!sel || (f !== 's' && f !== 'r')) return;
  sel[f] = Number(e.target.value);
  const el = root().querySelector(`[data-sid="${sel.id}"]`);
  if (el) el.style.setProperty(f === 's' ? '--s' : '--r', f === 's' ? String(sel.s) : `${sel.r}deg`);
  clearTimeout(onInput.timer); onInput.timer = setTimeout(save, 250);
}

// 指（マウス）に1:1で追従するドラッグ。掴んだ位置のずれを保ったまま動かす
function onDown(e) {
  const el = e.target.closest('.sk-item');
  const pageEl = root().querySelector('#skPage');
  if (!pageEl) return;
  if (!el) {
    if (e.target === pageEl && selectedId) { selectedId = null; render(); }
    return;
  }
  e.preventDefault();
  const p = page();
  const it = p.items.find(i => i.id === el.dataset.sid);
  if (!it) return;
  if (selectedId !== it.id) {
    selectedId = it.id;
    root().querySelectorAll('.sk-item.sel').forEach(x => x.classList.remove('sel'));
    el.classList.add('sel');
  }
  const rect = pageEl.getBoundingClientRect();
  drag = { el, it, rect, dx: e.clientX - (rect.left + it.x / 100 * rect.width), dy: e.clientY - (rect.top + it.y / 100 * rect.height), moved: false };
  el.setPointerCapture(e.pointerId);
  el.classList.add('is-dragging');
  const move = ev => {
    if (!drag) return;
    drag.moved = true;
    drag.it.x = clamp((ev.clientX - drag.dx - drag.rect.left) / drag.rect.width * 100, 0, 100);
    drag.it.y = clamp((ev.clientY - drag.dy - drag.rect.top) / drag.rect.height * 100, 0, 100);
    drag.el.style.left = `${drag.it.x}%`; drag.el.style.top = `${drag.it.y}%`;
  };
  const up = () => {
    el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
    el.classList.remove('is-dragging');
    const wasMoved = drag && drag.moved;
    drag = null;
    save();
    if (!wasMoved || !root().querySelector('.sk-edit')) render(); // 選び直した時は編集欄を出す
  };
  el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}

async function saveImage() {
  const el = root().querySelector('#skPage');
  if (!el) return;
  const prev = selectedId; selectedId = null; render();
  toast(t('画像を作っています…', 'Creating the image…'), 6000);
  try {
    const res = await saveElementImage(root().querySelector('#skPage'), { filename: `sticker-${page().title || 'page'}`, text: t('シール帳を作りました', 'My sticker page') });
    toast(res === 'saved' ? t('画像を保存しました', 'Image saved') : null);
  } catch (err) { toast(t('画像を作れませんでした', 'Could not create the image')); }
  selectedId = prev;
}

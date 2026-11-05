/* ================================================================
   🎯 週替わりビンゴ（#/bingo）。Skyで遊ぶ時の小さなお題をマスに並べ、できたらタップして埋める。
   縦・横・斜めがそろうと「ビンゴ」。お題は毎週日曜のウィークリーリセット（太平洋時間0時）で入れ替わる。
   ゲームの記録とは関係しない、楽しむための道具（デイリーチェックシートと同じ位置づけ）。

   - マスの数は3×3／4×4／5×5（5×5は真ん中がフリー）。
   - お題は用意したもの＋自分で足したもの。どのマスも書き換えられる（「マスを書き換える」）。
   - 過去の週の結果（埋めたマス・ビンゴの数）は履歴に残り、一年のふりかえり（features/recap）でも数える。
   データの形は bingo-state.js を参照。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { notifyChanged } from '../../js/notices.js';
import { saveElementImage, toast } from '../shared/share-image.js';
import { HUB_BASE_URL } from '../../js/site-config.js';
import {
  FREE, loadBingo, saveBingo, ensureWeek, buildCells, countLines, lineCells, nextWeekStart,
} from './bingo-state.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
const STYLE_ID = 'fun-tools-styles';

let containerEl = null;
let doc = null;
let editing = false;
let settingsOpen = false;
let confirmKey = null; // 2回押しで確定する操作（'shuffle' | 'size:N'）
let confirmTimer = null;
let tickTimer = null;

// opts.embedded: デイリーチェックシートの画面（features/today/today-view.js）の中に出す時。見出しと説明を出さない
let embedded = false;
export function mount(container, opts) {
  injectStylesheet();
  containerEl = container;
  embedded = !!(opts && typeof opts === 'object' && opts.embedded);
  editing = false; settingsOpen = false; confirmKey = null;
  doc = loadBingo();
  if (ensureWeek(doc, CURRENT_LANG)) { saveBingo(doc); notifyChanged(); }
  container.innerHTML = `<div class="bingo-view fun-view${embedded ? ' is-embedded' : ''}"></div>`;
  render();
  const root = container.querySelector('.bingo-view');
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  root.addEventListener('input', onInput);
  tickTimer = setInterval(onTick, 30000);
}

export function unmount() {
  clearInterval(tickTimer); tickTimer = null;
  clearTimeout(confirmTimer);
  containerEl = null;
}

export function injectStylesheet() {
  if (document.getElementById(STYLE_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_ID; link.rel = 'stylesheet';
  link.href = new URL('../../css/fun-tools.css', import.meta.url).href;
  document.head.appendChild(link);
}

function root() { return containerEl && containerEl.querySelector('.bingo-view'); }

function onTick() {
  if (!containerEl) return;
  if (ensureWeek(doc, CURRENT_LANG)) { saveBingo(doc); notifyChanged(); render(); return; }
  const el = root().querySelector('.bg-reset');
  if (el) el.textContent = resetText();
}

function resetText() {
  const ms = nextWeekStart() - Date.now();
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000);
  return d > 0 ? t(`入れ替わりまで あと${d}日${h}時間`, `New prompts in ${d}d ${h}h`) : t(`入れ替わりまで あと${h}時間`, `New prompts in ${h}h`);
}
function weekLabel(key) {
  const [, m, d] = key.split('-').map(Number);
  const end = new Date(Date.UTC(2000, m - 1, d + 6));
  return t(`${m}/${d}〜${end.getUTCMonth() + 1}/${end.getUTCDate()}の週`, `Week of ${m}/${d}`);
}

function render() {
  const el = root();
  if (!el) return;
  const w = doc.week;
  const lines = countLines(w.size, w.marks);
  const inLine = lineCells(w.size, w.marks);
  const filled = w.marks.filter((m, i) => m && w.cells[i] !== FREE).length;
  const total = w.cells.filter(c => c !== FREE).length;
  const full = filled === total && total > 0;
  el.innerHTML = `
    <div class="fun-wrap">
      ${embedded ? `<p class="fun-hint bg-embed-lead">${t('できたマスをタップして、縦・横・斜めをそろえましょう。毎週日曜のウィークリーリセットで新しいお題に変わります。', 'Tap a square when you’ve done it and line them up. New prompts every weekly reset.')}</p>` : `<header class="fun-head">
        <h1 class="fun-h1"><svg class="inline-icon" width="22" height="22" aria-hidden="true"><use href="#i-grid"/></svg>${t('週替わりビンゴ', 'Weekly Bingo')}</h1>
        <p class="fun-lead">${t('Skyで遊ぶ時の小さなお題です。できたマスをタップして、縦・横・斜めをそろえましょう。毎週日曜のウィークリーリセットで新しいお題に変わります。', 'Little things to do in Sky. Tap a square when you’ve done it and line them up. New prompts every weekly reset.')}</p>
      </header>`}

      <div class="bg-card" id="bgCapture">
        <div class="bg-card-head">
          <div>
            <div class="bg-week">${escapeHtml(weekLabel(w.key))}</div>
            <div class="bg-reset">${resetText()}</div>
          </div>
          <div class="bg-score" aria-live="polite">
            <span class="bg-score-num">${lines}</span><span class="bg-score-label">${t('ビンゴ', lines === 1 ? 'bingo' : 'bingos')}</span>
          </div>
        </div>
        <div class="bg-board size-${w.size}${editing ? ' is-editing' : ''}" role="grid" aria-label="${t('ビンゴカード', 'Bingo card')}">
          ${w.cells.map((c, i) => cellHtml(c, i, w.marks[i], inLine.has(i))).join('')}
        </div>
        <div class="bg-progress">
          <span class="bg-bar" aria-hidden="true"><span style="width:${total ? Math.round(filled / total * 100) : 0}%"></span></span>
          <span class="bg-count">${t(`${filled} / ${total} マス`, `${filled} / ${total}`)}</span>
        </div>
        ${full ? `<div class="bg-full">${t('ぜんぶ埋まりました！ すてきな1週間でしたね', 'Card complete! What a week!')}</div>` : ''}
        <div class="fun-credit">${t('tai-hub 週替わりビンゴ', 'tai-hub Weekly Bingo')}</div>
      </div>

      <div class="fun-actions">
        <button type="button" class="fun-btn" data-act="edit" aria-pressed="${editing}"><svg class="inline-icon" width="15" height="15"><use href="#i-edit"/></svg>${editing ? t('書き換えを終える', 'Done editing') : t('マスを書き換える', 'Edit squares')}</button>
        <button type="button" class="fun-btn${confirmKey === 'shuffle' ? ' is-confirm' : ''}" data-act="shuffle"><svg class="inline-icon" width="15" height="15"><use href="#i-dice"/></svg>${confirmKey === 'shuffle' ? t('もう一度押すと印も消えます', 'Tap again to clear marks') : t('お題を入れ替える', 'Shuffle prompts')}</button>
        <button type="button" class="fun-btn" data-act="image"><svg class="inline-icon" width="15" height="15"><use href="#i-image"/></svg>${t('画像で保存', 'Save image')}</button>
        <button type="button" class="fun-btn" data-act="settings" aria-expanded="${settingsOpen}"><svg class="inline-icon" width="15" height="15"><use href="#i-settings"/></svg>${t('カードの設定', 'Card settings')}</button>
      </div>

      ${settingsOpen ? settingsHtml() : ''}
      ${historyHtml()}
    </div>`;
}

function cellHtml(c, i, marked, inLine) {
  if (c === FREE) {
    return `<div class="bg-cell is-free${inLine ? ' in-line' : ''}" role="gridcell"><span class="bg-free"><svg class="inline-icon" width="18" height="18"><use href="#i-star"/></svg>FREE</span></div>`;
  }
  if (editing) {
    return `<div class="bg-cell is-edit" role="gridcell"><textarea class="bg-cell-input" data-cell="${i}" maxlength="40" rows="3" aria-label="${t(`マス${i + 1}のお題`, `Square ${i + 1}`)}">${escapeHtml(c)}</textarea></div>`;
  }
  return `<button type="button" class="bg-cell${marked ? ' is-on' : ''}${inLine ? ' in-line' : ''}" data-cell="${i}" role="gridcell" aria-pressed="${!!marked}">
    <span class="bg-cell-text">${escapeHtml(c)}</span>
    ${marked ? '<span class="bg-stamp" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' : ''}
  </button>`;
}

function settingsHtml() {
  const sizeBtn = n => {
    const pending = confirmKey === `size:${n}`;
    return `<button type="button" class="fun-chip${doc.size === n ? ' on' : ''}${pending ? ' is-confirm' : ''}" data-act="size" data-size="${n}">${pending ? t('もう一度押す', 'Tap again') : `${n}×${n}`}</button>`;
  };
  return `<section class="fun-panel">
    <div class="fun-field">
      <span class="fun-label">${t('マスの数', 'Card size')}</span>
      <div class="fun-chips">${[3, 4, 5].map(sizeBtn).join('')}</div>
      <p class="fun-hint">${t('5×5は真ん中がフリーです。変えると今週のカードを作り直します。', '5×5 has a free center. Changing rebuilds this week’s card.')}</p>
    </div>
    <label class="fun-check"><input type="checkbox" data-act="use-default"${doc.useDefault ? ' checked' : ''}> ${t('用意したお題も使う', 'Include built-in prompts')}</label>
    <div class="fun-field">
      <span class="fun-label">${t('自分のお題（1行に1つ）', 'Your own prompts (one per line)')}</span>
      <textarea class="fun-textarea" data-act="custom" rows="5" placeholder="${t('例: フレンドと孤島で日の出を見る', 'e.g. Watch the sunrise with a friend')}">${escapeHtml(doc.custom.join('\n'))}</textarea>
      <p class="fun-hint">${t('自分のお題は優先してカードに入ります。来週のカードから反映されます（今すぐ使うなら「お題を入れ替える」）。', 'Your prompts are used first, starting next week (or tap “Shuffle prompts”).')}</p>
    </div>
  </section>`;
}

function historyHtml() {
  const keys = Object.keys(doc.history).filter(k => doc.history[k].filled > 0).sort().reverse().slice(0, 12);
  if (!keys.length) return '';
  return `<section class="fun-section">
    <h2 class="fun-h2">${t('これまでの週', 'Past weeks')}</h2>
    <ul class="bg-history">${keys.map(k => {
      const h = doc.history[k];
      const total = h.size * h.size - (h.size === 5 ? 1 : 0);
      return `<li><span class="bg-history-week">${escapeHtml(weekLabel(k))}</span><span class="bg-history-bar" aria-hidden="true"><span style="width:${Math.round(h.filled / total * 100)}%"></span></span><span class="bg-history-num">${t(`${h.lines}ビンゴ・${h.filled}マス`, `${h.lines} bingo · ${h.filled}`)}</span></li>`;
    }).join('')}</ul>
  </section>`;
}

function setConfirm(key) {
  confirmKey = key;
  clearTimeout(confirmTimer);
  if (key) confirmTimer = setTimeout(() => { confirmKey = null; if (containerEl) render(); }, 3500);
}

function rebuild(size, salt) {
  doc.size = size;
  const cells = buildCells(doc, doc.week.key, size, CURRENT_LANG, salt);
  doc.week = { key: doc.week.key, size, cells, marks: cells.map(c => (c === FREE ? 1 : 0)), doneAt: {} };
  saveBingo(doc);
}

function onClick(e) {
  const cell = e.target.closest('button.bg-cell');
  if (cell) { toggleCell(Number(cell.dataset.cell), cell); return; }
  const btn = e.target.closest('[data-act]');
  if (!btn || btn.tagName === 'TEXTAREA' || btn.tagName === 'INPUT') return;
  const act = btn.dataset.act;
  if (act === 'edit') { editing = !editing; setConfirm(null); render(); return; }
  if (act === 'settings') { settingsOpen = !settingsOpen; render(); return; }
  if (act === 'shuffle') {
    const hasMarks = doc.week.marks.some((m, i) => m && doc.week.cells[i] !== FREE);
    if (hasMarks && confirmKey !== 'shuffle') { setConfirm('shuffle'); render(); return; }
    setConfirm(null);
    rebuild(doc.week.size, String(Date.now()));
    render();
    return;
  }
  if (act === 'size') {
    const n = Number(btn.dataset.size);
    if (n === doc.week.size) { doc.size = n; saveBingo(doc); render(); return; }
    const hasMarks = doc.week.marks.some((m, i) => m && doc.week.cells[i] !== FREE);
    if (hasMarks && confirmKey !== `size:${n}`) { setConfirm(`size:${n}`); render(); return; }
    setConfirm(null);
    rebuild(n, '');
    render();
    return;
  }
  if (act === 'image') { saveImage(); }
}

function toggleCell(i, el) {
  const w = doc.week;
  if (w.cells[i] === FREE) return;
  const before = countLines(w.size, w.marks);
  w.marks[i] = w.marks[i] ? 0 : 1;
  if (w.marks[i]) w.doneAt[i] = Date.now(); else delete w.doneAt[i];
  saveBingo(doc);
  const after = countLines(w.size, w.marks);
  render();
  const newEl = root().querySelector(`button.bg-cell[data-cell="${i}"]`);
  if (newEl && w.marks[i]) newEl.classList.add('just-on');
  if (after > before) celebrate(after);
}

function celebrate(lines) {
  const board = root().querySelector('.bg-board');
  if (!board) return;
  const burst = document.createElement('div');
  burst.className = 'bg-burst';
  burst.innerHTML = `<span>BINGO!</span>${lines > 1 ? `<small>${t(`${lines}列目`, `×${lines}`)}</small>` : ''}`;
  board.appendChild(burst);
  setTimeout(() => burst.remove(), 1600);
}

function onChange(e) {
  const el = e.target;
  if (el.dataset.act === 'use-default') { doc.useDefault = el.checked; saveBingo(doc); }
}

let customTimer = null;
function onInput(e) {
  const el = e.target;
  if (el.classList.contains('bg-cell-input')) {
    const i = Number(el.dataset.cell);
    doc.week.cells[i] = el.value.replace(/\n/g, ' ').slice(0, 40);
    clearTimeout(customTimer); customTimer = setTimeout(() => saveBingo(doc), 300);
    return;
  }
  if (el.dataset.act === 'custom') {
    doc.custom = el.value.split('\n').map(s => s.trim()).filter(Boolean).map(s => s.slice(0, 40)).slice(0, 100);
    clearTimeout(customTimer); customTimer = setTimeout(() => saveBingo(doc), 300);
  }
}

async function saveImage() {
  const card = root().querySelector('#bgCapture');
  if (!card) return;
  toast(t('画像を作っています…', 'Creating the image…'), 6000);
  card.classList.add('is-capturing');
  try {
    const res = await saveElementImage(card, {
      filename: `bingo-${doc.week.key}`,
      text: t(`今週のSkyビンゴ ${countLines(doc.week.size, doc.week.marks)}ビンゴ！\n${HUB_BASE_URL}`, `My Sky bingo this week\n${HUB_BASE_URL}`),
      bg: getComputedStyle(document.body).backgroundColor || '#ffffff',
    });
    toast(res === 'saved' ? t('画像を保存しました', 'Image saved') : null);
  } catch (err) {
    toast(t('画像を作れませんでした。通信状態を確かめてください', 'Could not create the image.'));
  } finally {
    card.classList.remove('is-capturing');
  }
}

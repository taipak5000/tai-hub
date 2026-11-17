/* ================================================================
   楽譜づくり: 譜面ビュー（曲の全マスを、編集の道具なしで折り返して並べる全画面の画面）。
   入口はライブラリの曲カードの「譜面を見る」と、作曲モードの上端のボタン。

   ・1マスは5×3の音の配置（Skyの楽器と同じ並び。2・4列目はひし形）。空いている位置の薄い印は
     全マス共通なので、マスごとに15個の要素を作らず、::before の mask（SVG）1枚で描く。
     鳴る音だけを要素にする（長い曲で数千マスあっても要素数が増えすぎないように）。
   ・「空のマスを詰める」をオンにすると、続いた休みを小さな「休み×n」の札1つにまとめる。
   ・マスを押すと選んで音を鳴らす。再生は選んだマスから。「このマスを編集」で作曲モードのそのマスへ移る。
   ・大きさ（小・中・大）と詰める設定は端末に保存する（taiScoreSheetPrefs_v1）。
   ================================================================ */
import { t } from './data/i18n-score.js';
import { noteLabel } from './data/constants.js';
import * as S from './tai-score-state.js';
import * as A from './tai-score-audio.js';
import { escapeHtml, trapPush, trapPop } from './tai-score-runtime.js';

const PREFS_KEY = 'taiScoreSheetPrefs_v1';
const SIZES = ['s', 'm', 'l'];

let song = null;          // 表示中の曲
let selected = 0;         // 選んでいるマス
let onEdit = null;        // 「このマスを編集」を押した時の処理（マス番号を受け取る）
let timer = null;         // 再生のタイマー
let playing = false;

function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    return { size: SIZES.includes(p.size) ? p.size : 'm', collapse: !!p.collapse };
  } catch (e) { return { size: 'm', collapse: false }; }
}
function savePrefs(p) { try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch (e) { /* 保存できなくても表示は続ける */ } }

const $ = id => document.getElementById(id);
export function isOpen() { const el = $('sheetOverlay'); return !!(el && el.classList.contains('open')); }

export function renderSheetOverlay() {
  return `
  <div class="sheet-overlay" id="sheetOverlay" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">
    <div class="sheet-header">
      <button type="button" class="compose-close" data-act="sheet-close" title="${escapeHtml(t('sheetCloseTitle'))}" aria-label="${escapeHtml(t('sheetCloseTitle'))}"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      <div class="sheet-title-wrap">
        <div class="sheet-title" id="sheetTitle"></div>
        <div class="sheet-meta" id="sheetMeta"></div>
      </div>
      <button type="button" class="transport-btn primary" id="sheetPlayBtn" data-act="sheet-play">${escapeHtml(t('playBtn'))}</button>
    </div>
    <div class="sheet-toolbar">
      <div class="sheet-seg" role="group" aria-label="${escapeHtml(t('sheetSizeLabel'))}">
        ${SIZES.map(sz => `<button type="button" class="sheet-seg-btn" data-act="sheet-size" data-size="${sz}" aria-pressed="false">${escapeHtml(t('sheetSize_' + sz))}</button>`).join('')}
      </div>
      <label class="sheet-collapse">
        <input type="checkbox" id="sheetCollapseToggle">
        <span>${escapeHtml(t('sheetCollapseLabel'))}</span>
      </label>
      <button type="button" class="transport-btn sheet-edit-btn" data-act="sheet-edit">${escapeHtml(t('sheetEditBtn'))}</button>
    </div>
    <div class="sheet-body" id="sheetBody"></div>
  </div>`;
}

function frameLabel(frame) {
  return frame.length ? frame.slice().sort((a, b) => a - b).map(i => noteLabel(i)).join('・') : t('sheetRest');
}
function cellHtml(frame, fi) {
  const on = frame.map(i => `<i class="sheet-n${(i % 5) % 2 === 1 ? ' dia' : ''}" style="grid-area:${Math.floor(i / 5) + 1}/${(i % 5) + 1}"></i>`).join('');
  const bpmOv = S.frameBpmOverride(song, fi);
  return `<button type="button" class="sheet-cell${frame.length ? '' : ' rest'}${fi % 4 === 0 ? ' beat' : ''}${fi === selected ? ' selected' : ''}" id="sheetCell_${fi}" data-act="sheet-cell" data-frame="${fi}"
    aria-label="${escapeHtml(t('sheetCellAria', { n: fi + 1, notes: frameLabel(frame) }))}">`
    + `${fi % 4 === 0 ? `<span class="sheet-idx">${fi + 1}</span>` : ''}`
    + `${bpmOv !== null ? `<span class="sheet-bpm">♩${bpmOv}</span>` : ''}`
    + `<span class="sheet-dots">${on}</span></button>`;
}

function renderBody() {
  const body = $('sheetBody');
  if (!body || !song) return;
  const { size, collapse } = loadPrefs();
  body.className = 'sheet-body size-' + size;
  fitColumns();
  const frames = song.frames;
  let html = '';
  for (let fi = 0; fi < frames.length; fi++) {
    const frame = frames[fi] || [];
    if (collapse && !frame.length && fi !== selected) {
      // 続いた休みを1枚の札にまとめる（選んでいるマスと、テンポが変わるマスはまとめない）
      let end = fi;
      while (end + 1 < frames.length && !(frames[end + 1] || []).length && end + 1 !== selected && S.frameBpmOverride(song, end + 1) === null) end++;
      if (end > fi && S.frameBpmOverride(song, fi) === null) {
        html += `<span class="sheet-rest-run" id="sheetCell_${fi}" data-from="${fi}" data-to="${end}" title="${escapeHtml(t('sheetRestRunTitle', { from: fi + 1, to: end + 1 }))}">${escapeHtml(t('sheetRestRun', { n: end - fi + 1 }))}</span>`;
        fi = end;
        continue;
      }
    }
    html += cellHtml(frame, fi);
  }
  body.innerHTML = html;
  document.querySelectorAll('#sheetOverlay .sheet-seg-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.size === size)));
  const tg = $('sheetCollapseToggle');
  if (tg) tg.checked = collapse;
}

// 1行に並べるマスの数を、画面の幅と大きさの設定から4の倍数で決める（大きさは目安の幅）
const SIZE_PX = { s: 42, m: 64, l: 96 };
function fitColumns() {
  const body = $('sheetBody');
  if (!body) return;
  const w = body.clientWidth - 8;
  const gap = { s: 4, m: 6, l: 8 }[loadPrefs().size];
  const fit = Math.max(1, Math.floor((w + gap) / (SIZE_PX[loadPrefs().size] + gap)));
  // 4マス（1拍）のまとまりを崩さないよう、狭い画面でも最低4列にする
  body.style.setProperty('--sheet-cols', String(Math.max(4, fit - (fit % 4))));
}
let resizeObs = null;

function renderHeader() {
  $('sheetTitle').textContent = song.name || t('untitledSong');
  const notes = S.songNoteCount(song);
  // 1マスの長さ（BPMはマスの速さ）から、だいたいの演奏時間を出す（テンポ変化も足し込む）
  let sec = 0;
  for (let i = 0; i < song.frames.length; i++) sec += 60 / S.effectiveBpmAtFrame(song, i);
  const mm = Math.floor(sec / 60), ss = String(Math.round(sec % 60)).padStart(2, '0');
  $('sheetMeta').textContent = t('sheetMeta', { frames: song.frames.length, notes, bpm: song.bpm, time: `${mm}:${ss}` });
}

export function open(targetSong, startFrame, editHandler) {
  if (!targetSong) return;
  stop();
  song = targetSong;
  selected = Math.max(0, Math.min((startFrame || 0), song.frames.length - 1));
  onEdit = editHandler || null;
  renderHeader();
  renderBody();
  const ov = $('sheetOverlay');
  ov.classList.add('open');
  trapPush('sheetOverlay', ov);
  fitColumns();
  if (!resizeObs && window.ResizeObserver) { resizeObs = new ResizeObserver(() => fitColumns()); resizeObs.observe($('sheetBody')); }
  scrollToCell(selected, false);
}
export function close() {
  if (!isOpen()) return;
  stop();
  $('sheetOverlay').classList.remove('open');
  trapPop('sheetOverlay');
  song = null;
}

function scrollToCell(fi, smooth) {
  const el = $('sheetCell_' + fi) || cellElFor(fi);
  if (!el) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: smooth && !reduce ? 'smooth' : 'auto' });
}
// まとめた休みの札の中にあるマスは、札の要素を返す
function cellElFor(fi) {
  return [...document.querySelectorAll('#sheetBody .sheet-rest-run')].find(r => fi >= +r.dataset.from && fi <= +r.dataset.to) || null;
}

function select(fi, { sound = true, scroll = true } = {}) {
  if (!song) return;
  fi = Math.max(0, Math.min(fi, song.frames.length - 1));
  const prev = $('sheetCell_' + selected);
  if (prev) prev.classList.remove('selected');
  selected = fi;
  let el = $('sheetCell_' + fi);
  if (!el && cellElFor(fi)) { renderBody(); el = $('sheetCell_' + fi); } // 札の中のマスを選んだら、そのマスだけ取り出して描き直す
  if (el) el.classList.add('selected');
  if (sound && song.frames[fi] && song.frames[fi].length) A.playFrame(song.frames[fi], song.pitch, song.instrument);
  if (scroll) scrollToCell(fi, true);
}

function setPlayingUi(on) {
  playing = on;
  const btn = $('sheetPlayBtn');
  if (btn) { btn.textContent = on ? t('stopBtn') : t('playBtn'); btn.classList.toggle('active', on); }
  document.querySelectorAll('#sheetBody .playing').forEach(el => el.classList.remove('playing'));
}
function play() {
  if (!song) return;
  stop();
  setPlayingUi(true);
  let i = selected >= song.frames.length - 1 ? 0 : selected;
  const step = () => {
    if (!song || i >= song.frames.length) { stop(); return; }
    document.querySelectorAll('#sheetBody .playing').forEach(el => el.classList.remove('playing'));
    const el = $('sheetCell_' + i) || cellElFor(i);
    if (el) { el.classList.add('playing'); scrollToCell(i, true); }
    A.playFrame(song.frames[i] || [], song.pitch, song.instrument);
    const bpm = S.effectiveBpmAtFrame(song, i);
    i++;
    timer = setTimeout(step, 60000 / bpm);
  };
  step();
}
export function stop() {
  clearTimeout(timer);
  timer = null;
  if (playing) setPlayingUi(false);
}

// view.js のクリック委譲から呼ぶ。扱ったら true
export function handleClick(act, el) {
  switch (act) {
    case 'sheet-close': close(); return true;
    case 'sheet-play': if (playing) stop(); else play(); return true;
    case 'sheet-cell': if (!playing) select(+el.dataset.frame, { scroll: false }); else { stop(); select(+el.dataset.frame, { scroll: false }); } return true;
    case 'sheet-size': { const p = loadPrefs(); p.size = el.dataset.size; savePrefs(p); renderBody(); scrollToCell(selected, false); return true; }
    case 'sheet-edit': { const fi = selected; const h = onEdit; close(); if (h) h(fi); return true; }
    default: return false;
  }
}
export function onCollapseChange(checked) {
  const p = loadPrefs(); p.collapse = !!checked; savePrefs(p);
  renderBody();
  scrollToCell(selected, false);
}

// 譜面ビューが開いている間のキー操作（Escで閉じる・スペースで再生/停止・←→でマス移動・Enterで編集）。扱ったら true
export function handleKeydown(e) {
  if (!isOpen()) return false;
  if (e.key === 'Escape') { close(); e.preventDefault(); return true; }
  const tag = document.activeElement && document.activeElement.tagName;
  if (e.key === ' ' && tag !== 'BUTTON' && tag !== 'INPUT') { if (playing) stop(); else play(); e.preventDefault(); return true; }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    if (playing) stop();
    select(selected + (e.key === 'ArrowLeft' ? -1 : 1));
    e.preventDefault();
    return true;
  }
  if (e.key === 'Enter' && tag !== 'BUTTON' && tag !== 'INPUT') { handleClick('sheet-edit'); e.preventDefault(); return true; }
  return true; // 開いている間は、後ろの作曲モードへキー（音の入力など）を渡さない
}

// unmount時の後始末
export function teardown() {
  stop(); song = null; onEdit = null;
  if (resizeObs) { resizeObs.disconnect(); resizeObs = null; }
}

/* ================================================================
   tai-score（楽譜づくり）の「作成・演奏」（作曲モード＝#composeOverlay、
   全画面オーバーレイ）。譜面編集・音符入力（グリッド/ピアノ/五線譜）・
   タイムライン表示（タイル/縦列）・Undo/Redo・BPM/テンポ変化・練習/試験の
   範囲・フレームクリップボード・タップテンポ・メトロノーム設定・キー設定
   モーダル・再生（Play）をここに集約する。

   移植元: tai-score/index.html 行2826-3699・4029-4069（~1000行）。
   ================================================================ */
import { t } from './data/i18n-score.js';
import { NOTE_LABELS, noteLabel, PITCHES, DEFAULT_KEY_BINDINGS } from './data/constants.js';
import * as S from './tai-score-state.js';
import * as A from './tai-score-audio.js';
import { RT, escapeHtml, showToast, openModal, closeModal, registerCustomClose, trapPush, trapPop } from './tai-score-runtime.js';

/* ================================================================
   タブ切替（作曲モード全画面オーバーレイの開閉）
   ================================================================ */
export function openComposeMode() {
  document.getElementById('composeOverlay').classList.add('open');
  trapPush('composeOverlay', document.getElementById('composeOverlay'));
}
export function closeComposeMode() {
  document.getElementById('composeOverlay').classList.remove('open');
  trapPop('composeOverlay');
}

registerCustomClose('keyBindModal', () => closeKeyBindModal());

/* ================================================================
   エディタ描画
   ================================================================ */
export function populatePitchSelect() {
  const sel = document.getElementById('songPitchInput');
  if (!sel) return;
  sel.innerHTML = PITCHES.map(p => `<option value="${p}">${escapeHtml(t('pitchOptionLabel', { p }))}</option>`).join('');
}

export function renderEditor() {
  const song = RT.currentSong;
  if (!song) return;
  clearEditHistory(); // 曲を切り替えるたびに、前の曲のUndo履歴を引き継がないようにする
  document.getElementById('songNameInput').value = song.name;
  document.getElementById('songPitchInput').value = song.pitch;
  document.getElementById('songInstrumentInput').value = song.instrument;
  document.getElementById('bpmSlider').value = song.bpm;
  document.getElementById('bpmNumber').value = song.bpm;
  const metronomeToggle = document.getElementById('metronomeToggle');
  if (metronomeToggle) metronomeToggle.checked = S.metronomeEnabled();
  const loopRangeToggle = document.getElementById('loopRangeToggle');
  if (loopRangeToggle) loopRangeToggle.checked = S.loopRangeEnabled(song);
  const noScrollToggle = document.getElementById('noScrollToggle');
  if (noScrollToggle) noScrollToggle.checked = S.noScrollDuringPlaybackEnabled();
  if (RT.selectedFrameIndex >= song.frames.length) RT.selectedFrameIndex = Math.max(0, song.frames.length - 1);
  RT.selection = null;
  RT.rangeMode = false;
  const autoAdvanceToggle = document.getElementById('autoAdvanceToggle');
  if (autoAdvanceToggle) autoAdvanceToggle.checked = S.autoAdvanceEnabled();
  applyRangeModeButton();
  renderRangeTools();
  applyInputMode();
  applyTimelineView();
  renderFrameStrip();
  renderBigGrid();
  updatePracticeRangeBounds(true);
  renderFrameClipboardHint();
  renderLastResult();
}

// 練習・試験モードで使う範囲（マス目の番号、1始まり）の入力欄を、楽譜の長さに合わせて更新する。
export function updatePracticeRangeBounds(resetToFull) {
  const song = RT.currentSong;
  if (!song) return;
  const total = song.frames.length;
  const startInput = document.getElementById('practiceRangeStart');
  const endInput = document.getElementById('practiceRangeEnd');
  startInput.max = total;
  endInput.max = total;
  if (resetToFull) {
    const savedStart = song.practiceRangeStart;
    const savedEnd = song.practiceRangeEnd;
    if (Number.isFinite(savedStart) && Number.isFinite(savedEnd)) {
      const start = Math.max(1, Math.min(total, savedStart));
      startInput.value = start;
      endInput.value = Math.max(start, Math.min(total, savedEnd));
    } else {
      startInput.value = 1;
      endInput.value = total;
    }
    return;
  }
  if (!startInput.value || !endInput.value) {
    startInput.value = 1;
    endInput.value = total;
    return;
  }
  const start = Math.max(1, Math.min(total, parseInt(startInput.value, 10) || 1));
  const end = Math.max(start, Math.min(total, parseInt(endInput.value, 10) || total));
  startInput.value = start;
  endInput.value = end;
}
export function onPracticeRangeChange() {
  updatePracticeRangeBounds(false);
  const song = RT.currentSong;
  if (!song) return;
  song.practiceRangeStart = parseInt(document.getElementById('practiceRangeStart').value, 10);
  song.practiceRangeEnd = parseInt(document.getElementById('practiceRangeEnd').value, 10);
  persistCurrentSong();
}
export function getPracticeRange() {
  const song = RT.currentSong;
  const total = song.frames.length;
  const startInput = document.getElementById('practiceRangeStart');
  const endInput = document.getElementById('practiceRangeEnd');
  const start = Math.max(1, Math.min(total, parseInt(startInput.value, 10) || 1));
  const end = Math.max(start, Math.min(total, parseInt(endInput.value, 10) || total));
  return { start: start - 1, end: end - 1 };
}

export function renderBigGrid() {
  const grid = document.getElementById('bigGrid');
  const song = RT.currentSong;
  const frame = song.frames[RT.selectedFrameIndex] || [];
  grid.innerHTML = NOTE_LABELS.map((_, i) => {
    const on = frame.includes(i);
    const diamond = (i % 5) % 2 === 1;
    const cls = ['big-note', on && 'on', diamond && 'diamond-shape'].filter(Boolean).join(' ');
    return `<div class="${cls}" data-idx="${i}" data-act="toggle-note" data-note="${i}">${escapeHtml(noteLabel(i))}<span class="key-badge">${escapeHtml(S.keyDisplayLabel(RT.keyBindings[i]))}</span></div>`;
  }).join('');
  renderPianoKeys();
  renderStaffPicker();
  renderFrameBpmRow();
  renderFrameLengthRow();
}

/* ── マスの長さ（選んだ範囲があれば、その全部のマスに付ける） ── */
export function renderFrameLengthRow() {
  const song = RT.currentSong;
  const wrap = document.getElementById('frameLengthChips');
  if (!song || !wrap) return;
  const range = editRange();
  const lens = new Set();
  for (let i = range.start; i <= range.end; i++) lens.add(S.frameLength(song, i));
  const cur = lens.size === 1 ? [...lens][0] : null; // 範囲の中で長さがまちまちなら、どれも押されていない表示にする
  wrap.innerHTML = S.FRAME_LENGTHS.map(len => `<button type="button" class="len-chip${len === cur ? ' active' : ''}${len === 1 ? ' base' : ''}" data-act="set-frame-length" data-len="${len}" aria-pressed="${len === cur}" title="${escapeHtml(t('frameLenChipTitle', { len: S.lengthLabel(len) }))}">${escapeHtml(S.lengthLabel(len))}</button>`).join('');
}
export function setFrameLengthForRange(len) {
  const song = RT.currentSong;
  if (!song || !S.FRAME_LENGTHS.includes(len)) return;
  const range = editRange();
  let changed = false;
  for (let i = range.start; i <= range.end; i++) if (S.frameLength(song, i) !== len) changed = true;
  if (!changed) return;
  cancelAutoAdvance();
  pushEditHistory();
  for (let i = range.start; i <= range.end; i++) S.setFrameLength(song, i, len);
  persistCurrentSong();
  if (range.start === range.end) refreshFrameBox(range.start); else renderFrameStrip();
  renderFrameLengthRow();
  if (range.end > range.start) showToast(t('frameLenSetToast', { count: range.end - range.start + 1, len: S.lengthLabel(len) }));
}
// 1つ短く／長くする（キーボードの [ と ]）
export function stepFrameLength(dir) {
  const song = RT.currentSong;
  if (!song) return;
  const list = S.FRAME_LENGTHS;
  const cur = S.frameLength(song, editRange().start);
  const next = list[Math.max(0, Math.min(list.length - 1, list.indexOf(cur) + dir))];
  setFrameLengthForRange(next);
}

/* ================================================================
   音符入力の表示切り替え：グリッド⇔ピアノ⇔五線譜
   ================================================================ */
export function applyInputMode() {
  const mode = S.getInputMode();
  document.getElementById('bigGrid').style.display = mode === 'grid' ? 'grid' : 'none';
  document.getElementById('pianoKeysWrap').style.display = mode === 'piano' ? 'block' : 'none';
  document.getElementById('staffWrap').style.display = mode === 'staff' ? 'block' : 'none';
  document.querySelectorAll('.input-mode-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
}
export function setInputMode(mode) {
  S.setInputMode(mode);
  applyInputMode();
  renderFrameStrip();
}

/* ── 譜面(frame-strip)全体の表示方法：「タイル」⇔「縦列」 ── */
export function applyTimelineView() {
  const view = S.getTimelineView();
  document.querySelectorAll('.timeline-view-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
}
export function setTimelineView(view) {
  S.setTimelineView(view);
  applyTimelineView();
  if (RT.currentSong) renderFrameStrip();
}
// 白鍵の音番号（オクターブ内0〜6 = ド レ ミ ファ ソ ラ シ）のうち、右側に黒鍵がある位置
function hasBlackKeyAfter(i) {
  if (i >= NOTE_LABELS.length - 1) return false;
  const pos = i % 7;
  return pos === 0 || pos === 1 || pos === 3 || pos === 4 || pos === 5;
}
export function renderPianoKeys() {
  const wrap = document.getElementById('pianoKeys');
  const frame = RT.currentSong.frames[RT.selectedFrameIndex] || [];
  wrap.innerHTML = NOTE_LABELS.map((_, i) => {
    const on = frame.includes(i);
    const octaveStart = i === 7 || i === 14;
    const blackKey = hasBlackKeyAfter(i) ? `<div class="piano-black-key" title="${escapeHtml(t('blackKeyTitle'))}"></div>` : '';
    const keyBadge = `<span class="key-badge">${escapeHtml(S.keyDisplayLabel(RT.keyBindings[i]))}</span>`;
    const cls = ['piano-key', on && 'on', octaveStart && 'octave-start'].filter(Boolean).join(' ');
    return `<div class="${cls}" data-idx="${i}" data-act="toggle-note" data-note="${i}">${blackKey}${keyBadge}${escapeHtml(noteLabel(i))}</div>`;
  }).join('');
}

/* ================================================================
   五線譜での音符入力
   ================================================================ */
const STAFF_STEP = 7.6;
const STAFF_BASE_Y = 138;
const STAFF_NOTE_X = 92;
const STAFF_LINE_LEFT = 26;
const STAFF_LINE_RIGHT = 118;
const STAFF_LINE_INDICES = [2, 4, 6, 8, 10];
const STAFF_LEDGER_INDICES = [0, 12, 14];
function staffY(i) { return STAFF_BASE_Y - i * STAFF_STEP; }
export function renderStaffPicker() {
  const svg = document.getElementById('staffSvg');
  if (!svg) return;
  const frame = RT.currentSong.frames[RT.selectedFrameIndex] || [];
  let html = '';
  STAFF_LINE_INDICES.forEach(i => {
    const y = staffY(i);
    html += `<line x1="${STAFF_LINE_LEFT}" y1="${y}" x2="${STAFF_LINE_RIGHT}" y2="${y}" stroke="var(--text-3)" stroke-width="1"/>`;
  });
  NOTE_LABELS.forEach((_, i) => {
    const y = staffY(i);
    const on = frame.includes(i);
    if (STAFF_LEDGER_INDICES.includes(i)) {
      html += `<line x1="${STAFF_NOTE_X - 10}" y1="${y}" x2="${STAFF_NOTE_X + 10}" y2="${y}" stroke="var(--text-3)" stroke-width="1"/>`;
    }
    html += `
      <g class="staff-note-slot" data-idx="${i}" data-act="toggle-note" data-note="${i}">
        <rect x="${STAFF_NOTE_X - 16}" y="${y - 8}" width="70" height="16" fill="transparent" pointer-events="all" style="cursor:pointer;"/>
        <ellipse cx="${STAFF_NOTE_X}" cy="${y}" rx="6.4" ry="5" fill="${on ? 'var(--note-on)' : 'var(--card)'}" stroke="${on ? 'var(--note-on)' : 'var(--text-3)'}" stroke-width="1.4"/>
        <text x="${STAFF_NOTE_X + 14}" y="${y + 4}" font-size="11" font-weight="600" fill="var(--text-2)">${escapeHtml(noteLabel(i))}</text>
        <text x="${STAFF_NOTE_X + 36}" y="${y + 4}" font-size="9.5" font-weight="700" fill="var(--text-3)">${escapeHtml(S.keyDisplayLabel(RT.keyBindings[i]))}</text>
      </g>`;
  });
  svg.innerHTML = html;
}
// frame-strip（譜面全体）の1マス分を、五線譜上に和音として積んだ音符で描く簡易版
function frameStaffSvg(frame) {
  const baseY = 76, step = 4.4, noteX = 42, left = 8, right = 74;
  let html = '';
  STAFF_LINE_INDICES.forEach(i => {
    const y = baseY - i * step;
    html += `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="var(--sep)" stroke-width="1"/>`;
  });
  STAFF_LEDGER_INDICES.forEach(i => {
    if (!frame.includes(i)) return;
    const y = baseY - i * step;
    html += `<line x1="${noteX - 7}" y1="${y}" x2="${noteX + 7}" y2="${y}" stroke="var(--text-3)" stroke-width="1"/>`;
  });
  frame.forEach(i => {
    const y = baseY - i * step;
    html += `<ellipse cx="${noteX}" cy="${y}" rx="3.6" ry="2.8" fill="var(--note-on)"/>`;
  });
  return `<svg viewBox="0 0 82 84" class="frame-staff-svg">${html}</svg>`;
}

// 譜面の「縦列表示」の1マス分（縦=音程・上が高音）
const COL_CELL_H = 18, COL_W = 30;
function frameColumnSvg(frame) {
  const rows = NOTE_LABELS.length;
  const h = rows * COL_CELL_H + 6;
  let html = `<rect x="0" y="0" width="${COL_W}" height="${h}" rx="3" fill="var(--col-bg-fill)"/>`;
  [7, 14].forEach(i => {
    const y = 3 + (rows - i) * COL_CELL_H;
    html += `<line x1="0" y1="${y}" x2="${COL_W}" y2="${y}" stroke="var(--col-sep-stroke)" stroke-width="0.8"/>`;
  });
  for (let i = 0; i < rows; i++) {
    const y = 3 + (rows - 1 - i) * COL_CELL_H;
    const on = frame.includes(i);
    if (!on) {
      html += `<rect x="0" y="${y + 1}" width="${COL_W}" height="${COL_CELL_H - 2}" rx="1.5" fill="var(--col-off-fill)" opacity="0.45"/>`;
    } else {
      html += `<rect x="0" y="${y + 0.5}" width="${COL_W}" height="${COL_CELL_H - 1}" rx="1.5" fill="var(--col-note-on-fill)"/>`;
    }
  }
  return `<svg viewBox="0 0 ${COL_W} ${h}" class="frame-column-svg">${html}</svg>`;
}
function frameColumnGutterHtml() {
  const rows = NOTE_LABELS.length;
  let rowsHtml = '';
  for (let i = rows - 1; i >= 0; i--) {
    rowsHtml += `<div class="column-gutter-row" style="height:${COL_CELL_H}px;">${escapeHtml(noteLabel(i))}</div>`;
  }
  return `<div class="column-pitch-gutter">${rowsHtml}</div>`;
}

function frameBoxHtml(song, fi, view) {
  const frame = song.frames[fi];
  const columnMode = view === 'column';
  const staffMode = !columnMode && S.getInputMode() === 'staff';
  const bpmOv = S.frameBpmOverride(song, fi);
  const len = S.frameLength(song, fi);
  const isSelected = fi === RT.selectedFrameIndex;
  const sel = RT.selection;
  const inSel = !!sel && fi >= Math.min(sel.anchor, sel.focus) && fi <= Math.max(sel.anchor, sel.focus);
  const showIndex = !columnMode || isSelected || fi % 4 === 0;
  const cls = ['frame-box',
    isSelected && 'selected',
    inSel && 'in-sel',
    frame.length === 0 && 'is-empty',
    fi % 4 === 0 && 'beat-start',
    staffMode && 'staff-mode',
    columnMode && 'column-mode',
    len !== 1 && (len < 1 ? 'len-short' : 'len-long')].filter(Boolean).join(' ');
  const lenStyle = columnMode && len !== 1 ? ` style="--len:${len}"` : '';
  return `
    <div class="${cls}" id="frameBox_${fi}" data-act="select-frame" data-frame="${fi}"${lenStyle}>
      ${showIndex ? `<span class="frame-index">${fi + 1}</span>` : ''}
      <button type="button" class="frame-del-btn" data-act="delete-frame" data-frame="${fi}"><svg class="inline-icon" width="12" height="12"><use href="#i-close"/></svg></button>
      <button type="button" class="frame-insert-btn" data-act="insert-frame-after" data-frame="${fi}" title="${escapeHtml(t('insertFrameAfterTitle'))}" aria-label="${escapeHtml(t('insertFrameAfterTitle'))}">＋</button>
      ${columnMode ? frameColumnSvg(frame)
        : staffMode ? frameStaffSvg(frame)
          : NOTE_LABELS.map((_, ni) => {
            const dotOn = frame.includes(ni);
            const dotDiamond = (ni % 5) % 2 === 1;
            return `<div class="frame-dot${dotOn ? ' on' : ''}${dotDiamond ? ' diamond-shape' : ''}"></div>`;
          }).join('')}
      ${len !== 1 ? `<span class="frame-len-badge" title="${escapeHtml(t('frameLenBadgeTitle', { len: S.lengthLabel(len) }))}">${escapeHtml(S.lengthLabel(len))}</span>` : ''}
      ${bpmOv !== null ? `<span class="frame-bpm-badge" title="${escapeHtml(t('frameBpmBadgeTitle', { bpm: bpmOv }))}"><svg class="inline-icon" width="10" height="10"><use href="#ts-i-clock"/></svg>${bpmOv}</span>` : ''}
    </div>
  `;
}

export function renderFrameStrip() {
  const strip = document.getElementById('frameStrip');
  const song = RT.currentSong;
  const view = S.getTimelineView();
  strip.className = 'frame-strip compose-timeline view-' + view;
  strip.innerHTML = (view === 'column' ? frameColumnGutterHtml() : '')
    + song.frames.map((_, fi) => frameBoxHtml(song, fi, view)).join('')
    + `<button type="button" class="add-frame-btn" data-act="add-frame" title="${escapeHtml(t('addFrameTitle'))}" aria-label="${escapeHtml(t('addFrameTitle'))}">＋</button>`;
  renderSectionChips();
  updateEditPos();
}
// 1マスだけ描き直す（音を1つ押すたびに数千マスを描き直さないため）。無ければ全体を描き直す
function refreshFrameBox(fi) {
  const song = RT.currentSong;
  const el = document.getElementById('frameBox_' + fi);
  if (!song || !song.frames[fi]) { if (el) renderFrameStrip(); return; }
  if (!el) { renderFrameStrip(); return; }
  const wasPlaying = el.classList.contains('playing');
  el.outerHTML = frameBoxHtml(song, fi, S.getTimelineView());
  if (wasPlaying) document.getElementById('frameBox_' + fi)?.classList.add('playing');
}
// 選んでいるマスが譜面の見えている範囲から外れていたら、そこまでスクロールする
function revealSelectedFrame() {
  const el = document.getElementById('frameBox_' + RT.selectedFrameIndex);
  const strip = document.getElementById('frameStrip');
  if (!el || !strip) return;
  const er = el.getBoundingClientRect(), sr = strip.getBoundingClientRect();
  const out = er.top < sr.top || er.bottom > sr.bottom || er.left < sr.left || er.right > sr.right;
  if (out) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function updateEditPos() {
  const song = RT.currentSong;
  const pos = document.getElementById('editPos');
  if (!song) return;
  if (pos) {
    const sel = editRange();
    pos.textContent = RT.selection
      ? t('editPosRange', { a: sel.start + 1, b: sel.end + 1, total: song.frames.length })
      : t('editPos', { n: RT.selectedFrameIndex + 1, total: song.frames.length });
  }
  const nextLabel = document.getElementById('editNextLabel');
  if (nextLabel) nextLabel.textContent = RT.selectedFrameIndex >= song.frames.length - 1 ? t('addFrameShort') : t('nextFrameShort');
  // 演奏時間: 全体と、今のマスが曲の頭から何分何秒の所か（譜面ビューと同じ songDurationSec・frameDurationMs の合計）
  const timeEl = document.getElementById('editTime');
  if (timeEl) {
    const cum = timingTable();
    timeEl.textContent = t('editTime', { now: S.formatDuration(cum[Math.min(RT.selectedFrameIndex, cum.length - 1)] / 1000), total: S.formatDuration(S.songDurationSec(song)) });
  }
  const cur = S.sectionAt(song, RT.selectedFrameIndex);
  document.querySelectorAll('#sectionChips .section-chip').forEach(chip => chip.classList.toggle('active', !!cur && parseInt(chip.dataset.frame, 10) === cur.frame));
}
// 各マスが始まる時刻（ms）の表。保存のたびに作り直し、選ぶマスを変えるだけなら作り直さない（数千マスでも軽くするため）
function timingTable() {
  const song = RT.currentSong;
  const key = song.id + ':' + (RT.songVersion || 0) + ':' + song.frames.length + ':' + song.bpm;
  if (RT.timingCache && RT.timingCache.key === key) return RT.timingCache.cum;
  const cum = new Float64Array(song.frames.length + 1);
  for (let i = 0; i < song.frames.length; i++) cum[i + 1] = cum[i] + S.frameDurationMs(song, i);
  RT.timingCache = { key, cum };
  return cum;
}

/* ── セクションの目印（タイムライン上のチップ帯・作曲ツールの一覧） ── */
export function renderSectionChips() {
  const song = RT.currentSong;
  const wrap = document.getElementById('sectionChips');
  if (!song || !wrap) return;
  const list = S.getSections(song);
  wrap.hidden = list.length === 0;
  wrap.innerHTML = list.map(sec => `<button type="button" class="section-chip" data-act="jump-section" data-frame="${sec.frame}" title="${escapeHtml(t('sectionChipTitle', { n: sec.frame + 1 }))}"><span class="section-chip-n">${sec.frame + 1}</span>${escapeHtml(sec.label)}</button>`).join('');
}
export function renderSectionList() {
  const song = RT.currentSong;
  if (!song) return;
  const here = document.getElementById('sectionAddHere');
  if (here) here.textContent = t('sectionAddHere', { n: RT.selectedFrameIndex + 1 });
  const listEl = document.getElementById('sectionList');
  if (!listEl) return;
  const list = S.getSections(song);
  listEl.innerHTML = list.length ? list.map(sec => `
    <li class="section-row">
      <span class="section-row-n">${sec.frame + 1}</span>
      <span class="section-row-label">${escapeHtml(sec.label)}</span>
      <button type="button" class="mini-btn" data-act="jump-section" data-frame="${sec.frame}" data-close="1">${escapeHtml(t('sectionJumpBtn'))}</button>
      <button type="button" class="mini-btn danger-text" data-act="remove-section" data-frame="${sec.frame}" aria-label="${escapeHtml(t('sectionRemoveAria', { label: sec.label }))}">${escapeHtml(t('sectionRemoveBtn'))}</button>
    </li>`).join('') : `<li class="section-empty">${escapeHtml(t('sectionEmpty'))}</li>`;
}
export function addSectionHere(label) {
  const song = RT.currentSong;
  if (!song) return false;
  const text = String(label || '').trim();
  if (!text) { showToast(t('sectionNeedLabel')); return false; }
  const fi = RT.selectedFrameIndex;
  const trial = JSON.parse(JSON.stringify({ frames: song.frames.map(() => 0), sections: song.sections }));
  if (S.setSection(trial, fi, text) === 'full') { showToast(t('sectionFullToast', { max: S.SECTIONS_MAX })); return false; }
  pushEditHistory();
  const res = S.setSection(song, fi, text);
  persistCurrentSong();
  renderSectionChips();
  renderSectionList();
  updateEditPos();
  showToast(t(res === 'renamed' ? 'sectionRenamedToast' : 'sectionAddedToast', { n: fi + 1, label: text.slice(0, S.SECTION_LABEL_MAX) }));
  return true;
}
export function removeSectionAt(frame) {
  const song = RT.currentSong;
  if (!song) return;
  pushEditHistory();
  S.removeSection(song, frame);
  persistCurrentSong();
  renderSectionChips();
  renderSectionList();
  updateEditPos();
}
// マス番号（1始まり）を入れて移動する。範囲外は端に寄せる
export function jumpToFrameNumber(raw) {
  const song = RT.currentSong;
  if (!song) return;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return;
  jumpToFrame(Math.max(0, Math.min(song.frames.length - 1, n - 1)), false);
}

// 押した音のボタンを一瞬光らせる（録音中は曲を書き換えないので、押せたことをここで示す）
function flashNote(idx) {
  document.querySelectorAll(`#composeOverlay [data-act="toggle-note"][data-note="${idx}"]`).forEach(el => {
    el.classList.remove('rec-hit');
    void el.offsetWidth;
    el.classList.add('rec-hit');
  });
}
// 録音した譜面を曲の末尾に足す（履歴は1回。元に戻す1回で録音分が丸ごと消える）。戻り値は足したマス数
export function appendRecordedFrames(rec) {
  const song = RT.currentSong;
  if (!song || !rec || !rec.frames.length) return 0;
  const endBpm = S.effectiveBpmAtFrame(song, song.frames.length - 1);
  if (song.frames.length + rec.frames.length > MAX_FRAMES_BY_EDIT) { showToast(t('tooManyFramesToast', { max: MAX_FRAMES_BY_EDIT })); return 0; }
  // 曲の今の速さで¼拍の倍数に収まるなら、そのまま長さを数え直す。収まらなければ、足した先頭からテンポを録音の速さに変える
  const fit = S.retimeForBpm(rec, endBpm);
  const clip = fit
    ? { frames: fit.frames, frameLengths: fit.frameLengths, bpmOverrides: {} }
    : { frames: rec.frames, frameLengths: rec.frameLengths || {}, bpmOverrides: { 0: rec.bpm } };
  cancelAutoAdvance();
  pushEditHistory();
  const at = song.frames.length;
  S.insertClipAt(song, at, clip);
  clearSelection();
  RT.selectedFrameIndex = at;
  persistCurrentSong();
  renderFrameStrip();
  renderBigGrid();
  revealSelectedFrame();
  updatePracticeRangeBounds(false);
  return clip.frames.length;
}

/* ── 空のマスをまとめて足す（履歴は1回。目印・長さ・テンポ変化の表も一度にずらす） ── */
export function insertBlankFrames(rawCount, where) {
  const song = RT.currentSong;
  if (!song) return;
  const n = Math.max(1, Math.min(100, parseInt(rawCount, 10) || 1));
  if (song.frames.length + n > MAX_FRAMES_BY_EDIT) { showToast(t('tooManyFramesToast', { max: MAX_FRAMES_BY_EDIT })); return; }
  cancelAutoAdvance();
  pushEditHistory();
  const atEnd = where === 'end';
  const at = atEnd ? song.frames.length : editRange().end + 1;
  // 1つずつ足す時と同じく、元のマス（末尾なら最後のマス）の長さを引き継ぐ
  const len = S.frameLength(song, atEnd ? song.frames.length - 1 : at - 1);
  song.frames.splice(at, 0, ...Array.from({ length: n }, () => []));
  if (!atEnd) { S.shiftBpmOverridesForInsert(song, at, n); S.shiftSectionsForInsert(song, at, n); }
  for (let i = at; i < at + n; i++) S.setFrameLength(song, i, len);
  clearSelection();
  RT.selectedFrameIndex = at;
  persistCurrentSong();
  renderFrameStrip();
  renderBigGrid();
  revealSelectedFrame();
  updatePracticeRangeBounds(false);
  renderRangeTools();
  showToast(t(atEnd ? 'blankAppendedToast' : 'blankInsertedToast', { count: n }));
}

// 選択範囲（範囲選択モード・Shift+クリック・Shift+矢印）。無ければ今のマス1つ
function editRange() {
  const sel = RT.selection;
  if (!sel) return { start: RT.selectedFrameIndex, end: RT.selectedFrameIndex };
  return { start: Math.min(sel.anchor, sel.focus), end: Math.max(sel.anchor, sel.focus) };
}
function applyRangeModeButton() {
  document.querySelectorAll('.range-mode-btn').forEach(btn => {
    btn.classList.toggle('active', !!RT.rangeMode);
    btn.setAttribute('aria-pressed', RT.rangeMode ? 'true' : 'false');
  });
}
export function toggleRangeMode() {
  RT.rangeMode = !RT.rangeMode;
  RT.selection = RT.rangeMode ? { anchor: RT.selectedFrameIndex, focus: RT.selectedFrameIndex } : null;
  applyRangeModeButton();
  renderFrameStrip();
  if (RT.rangeMode) showToast(t('rangeModeOnToast'));
}
export function selectAllFrames() {
  const song = RT.currentSong;
  if (!song) return;
  RT.selection = { anchor: 0, focus: song.frames.length - 1 };
  renderFrameStrip();
}
function clearSelection() {
  if (!RT.selection && !RT.rangeMode) return false;
  RT.selection = null;
  RT.rangeMode = false;
  applyRangeModeButton();
  return true;
}

/* ================================================================
   譜面を指（マウス）でなぞって範囲を選ぶ
   - マウス・ペン: 押したまま別のマスへ動かすと、すぐ範囲選択になる。
   - タッチ: 普通に動かすと譜面のスクロール。マスを少し長押し（300ms）してから
     なぞると範囲選択になる（スクロールと区別するため）。
   - なぞっている間に譜面の端へ近づくと、その方向へ自動でスクロールする。
   - 描き直しは選択の印（クラス）だけにして、数千マスでも指に遅れずに付いてくる。
   ================================================================ */
const LONG_PRESS_MS = 300;
const MOVE_TOLERANCE = 8;   // 長押しの判定中に、これ以上動いたらスクロールとみなす
const EDGE_ZONE = 36;       // 譜面の端からこの距離に入ったら自動スクロール
let drag = null;            // { pointerId, type, anchor, focus, startX, startY, x, y, active, timer, raf }
let suppressClickUntil = 0; // なぞり終わり直後の click だけを無視する（時刻で判定。次に押した時まで持ち越さない）

function frameIndexAt(x, y) {
  const el = document.elementFromPoint(x, y);
  const box = el && el.closest && el.closest('#frameStrip .frame-box');
  if (box) return parseInt(box.dataset.frame, 10);
  return null;
}
// 選択の印だけを付け直す（全体の描き直しはしない）
function paintDragSelection() {
  const strip = document.getElementById('frameStrip');
  if (!strip || !drag) return;
  const a = Math.min(drag.anchor, drag.focus), b = Math.max(drag.anchor, drag.focus);
  strip.querySelectorAll('.frame-box.in-sel').forEach(el => {
    const fi = parseInt(el.dataset.frame, 10);
    if (fi < a || fi > b) el.classList.remove('in-sel');
  });
  for (let i = a; i <= b; i++) document.getElementById('frameBox_' + i)?.classList.add('in-sel');
  strip.querySelector('.frame-box.selected')?.classList.remove('selected');
  document.getElementById('frameBox_' + drag.focus)?.classList.add('selected');
  RT.selection = { anchor: drag.anchor, focus: drag.focus };
  RT.selectedFrameIndex = drag.focus;
  updateEditPos();
}
function updateDragFocus() {
  if (!drag || !drag.active) return;
  const fi = frameIndexAt(drag.x, drag.y);
  if (fi === null || fi === drag.focus) return;
  drag.focus = fi;
  paintDragSelection();
}
function beginDragSelect() {
  if (!drag || drag.active) return;
  drag.active = true;
  try { document.getElementById('frameStrip')?.setPointerCapture(drag.pointerId); } catch (e) { /* 指が離れた後 */ }
  drag.activeX = drag.x; drag.activeY = drag.y;
  drag.moved = false;
  cancelAutoAdvance();
  // 範囲選択モード中に始めたなら、モードの起点を引き継ぐ（なぞって決めた範囲がそのまま残る）
  if (RT.rangeMode && RT.selection) drag.anchor = RT.selection.anchor;
  document.getElementById('frameStrip')?.classList.add('drag-selecting');
  if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) { /* 対応していない端末 */ } }
  paintDragSelection();
  autoScrollLoop();
}
function autoScrollLoop() {
  if (!drag || !drag.active) return;
  const strip = document.getElementById('frameStrip');
  // 長押ししただけ（まだ動かしていない）なら、端の近くでもスクロールしない
  if (!drag.moved && Math.hypot(drag.x - drag.activeX, drag.y - drag.activeY) > 10) drag.moved = true;
  if (strip && drag.moved) {
    const r = strip.getBoundingClientRect();
    const speed = d => Math.min(18, Math.max(0, (EDGE_ZONE - d) / EDGE_ZONE * 18));
    let dx = 0, dy = 0;
    if (strip.scrollHeight > strip.clientHeight) {
      if (drag.y < r.top + EDGE_ZONE) dy = -speed(drag.y - r.top);
      else if (drag.y > r.bottom - EDGE_ZONE) dy = speed(r.bottom - drag.y);
    }
    if (strip.scrollWidth > strip.clientWidth) {
      if (drag.x < r.left + EDGE_ZONE) dx = -speed(drag.x - r.left);
      else if (drag.x > r.right - EDGE_ZONE) dx = speed(r.right - drag.x);
    }
    if (dx || dy) {
      strip.scrollBy(dx, dy);
      // 指の位置が譜面の外でも、譜面の中の一番近い点でマスを探す
      const cx = Math.min(r.right - 4, Math.max(r.left + 4, drag.x));
      const cy = Math.min(r.bottom - 4, Math.max(r.top + 4, drag.y));
      const fi = frameIndexAt(cx, cy);
      if (fi !== null && fi !== drag.focus) { drag.focus = fi; paintDragSelection(); }
    }
  }
  drag.raf = requestAnimationFrame(autoScrollLoop);
}
function endDrag(commit) {
  if (!drag) return;
  clearTimeout(drag.timer);
  cancelAnimationFrame(drag.raf);
  const wasActive = drag.active;
  const strip = document.getElementById('frameStrip');
  strip?.classList.remove('drag-selecting');
  try { strip?.releasePointerCapture(drag.pointerId); } catch (e) { /* 捕まえていない */ }
  drag = null;
  if (!wasActive) return;
  suppressClickUntil = performance.now() + 300; // なぞり終わりの click で選択が消えないように
  if (!commit || !RT.selection) return;
  // 1マスだけなぞって戻ってきた時は、範囲ではなく普通の選択にする
  if (RT.selection.anchor === RT.selection.focus && !RT.rangeMode) {
    const fi = RT.selection.focus;
    RT.selection = null;
    selectFrame(fi, { rerender: true });
    return;
  }
  renderFrameStrip();
  renderBigGrid();
  if (RT.selection) showToast(t('dragSelectedToast', { count: editRange().end - editRange().start + 1 }));
}
export function consumeFrameClickAfterDrag() {
  if (performance.now() > suppressClickUntil) return false;
  suppressClickUntil = 0;
  return true;
}
export function wireFrameStripDrag() {
  const strip = document.getElementById('frameStrip');
  if (!strip || strip.dataset.dragWired) return;
  strip.dataset.dragWired = '1';
  strip.addEventListener('pointerdown', e => {
    if (e.button !== 0 || drag) return;
    if (e.target.closest('button')) return; // マスの×・＋、末尾の＋はそのまま押せるように
    const box = e.target.closest('.frame-box');
    if (!box || !RT.currentSong) return;
    const fi = parseInt(box.dataset.frame, 10);
    drag = { pointerId: e.pointerId, type: e.pointerType, anchor: fi, focus: fi, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, active: false, timer: null, raf: 0 };
    // 指（ポインター）を捕まえるのは範囲選択が始まってから。先に捕まえると、普通に押した時の click が
    // マスではなく譜面全体に届き、マスを選べなくなる
    if (e.pointerType === 'touch') drag.timer = setTimeout(beginDragSelect, LONG_PRESS_MS);
  });
  strip.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    drag.x = e.clientX; drag.y = e.clientY;
    if (!drag.active) {
      if (drag.type === 'touch') {
        // 長押しが決まる前に動いたらスクロール。範囲選択はやめる
        if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > MOVE_TOLERANCE) endDrag(false);
        return;
      }
      // マウス・ペンは、別のマスへ入った時点で範囲選択を始める
      const fi = frameIndexAt(e.clientX, e.clientY);
      if (fi === null || fi === drag.anchor) return;
      beginDragSelect();
    }
    updateDragFocus();
  });
  strip.addEventListener('pointerup', e => { if (drag && e.pointerId === drag.pointerId) endDrag(true); });
  strip.addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.pointerId) endDrag(drag.active); });
  // 範囲選択に入った後は、指の動きで譜面がスクロールしないようにする（タッチは touchmove を止める）
  strip.addEventListener('touchmove', e => { if (drag && drag.active) e.preventDefault(); }, { passive: false });
  // 長押しで出るメニュー（画像の保存など）を止める
  strip.addEventListener('contextmenu', e => { if (drag) e.preventDefault(); });
}

// 譜面のマスを押した時。範囲選択モード中かShiftを押しながらなら、範囲を広げる
export function onFrameClick(fi, shift) {
  if (RT.rangeMode || shift) {
    const anchor = RT.selection ? RT.selection.anchor : RT.selectedFrameIndex;
    RT.selection = { anchor, focus: fi };
    RT.selectedFrameIndex = fi;
    renderFrameStrip();
    renderBigGrid();
    return;
  }
  const hadSel = clearSelection();
  selectFrame(fi, { rerender: hadSel });
}
// キーボードでの移動（Shiftを押しながらなら範囲を広げる）
export function jumpToFrame(fi, shift) {
  if (!RT.currentSong) return;
  if (shift) {
    const anchor = RT.selection ? RT.selection.anchor : RT.selectedFrameIndex;
    RT.selection = { anchor, focus: fi };
    RT.selectedFrameIndex = fi;
    renderFrameStrip();
    renderBigGrid();
    revealSelectedFrame();
    return;
  }
  const hadSel = !RT.rangeMode && clearSelection();
  if (RT.rangeMode) RT.selection = { anchor: RT.selection ? RT.selection.anchor : fi, focus: fi };
  selectFrame(fi, { rerender: hadSel || RT.rangeMode });
}

export function selectFrame(fi, opts = {}) {
  const prev = RT.selectedFrameIndex;
  cancelAutoAdvance();
  RT.selectedFrameIndex = fi;
  if (opts.rerender || S.getTimelineView() === 'column') renderFrameStrip(); // 縦列は選んだマスにだけ番号が付くので全体を描き直す
  else { refreshFrameBox(prev); refreshFrameBox(fi); updateEditPos(); }
  renderBigGrid();
  revealSelectedFrame();
  // クリック（や矢印キー）でマスへ移動した時、そのマスに入っている音を鳴らして内容を確認しやすくする
  const song = RT.currentSong;
  if (!opts.silent && song && song.frames[fi]) A.playFrame(song.frames[fi], song.pitch, song.instrument);
}
export function selectPrevFrame() {
  if (!RT.currentSong || RT.selectedFrameIndex <= 0) return;
  jumpToFrame(RT.selectedFrameIndex - 1, false);
}
export function selectNextFrame() {
  if (!RT.currentSong || RT.selectedFrameIndex >= RT.currentSong.frames.length - 1) return;
  jumpToFrame(RT.selectedFrameIndex + 1, false);
}
// 次のマスへ。最後のマスなら新しいマスを足して進む（入力を止めずに書き進められるように）
export function nextOrAddFrame(opts = {}) {
  const song = RT.currentSong;
  if (!song) return;
  if (RT.selectedFrameIndex >= song.frames.length - 1) {
    pushEditHistory();
    song.frames.push([]);
    // 続けて書く時は同じ長さが続くことが多いので、新しいマスは今のマスの長さを引き継ぐ
    S.setFrameLength(song, song.frames.length - 1, S.frameLength(song, RT.selectedFrameIndex));
    clearSelection();
    RT.selectedFrameIndex = song.frames.length - 1;
    persistCurrentSong();
    renderFrameStrip();
    renderBigGrid();
    revealSelectedFrame();
    updatePracticeRangeBounds(false);
    return;
  }
  const hadSel = clearSelection();
  selectFrame(RT.selectedFrameIndex + 1, { rerender: hadSel, silent: opts.silent });
}

/* ── 「入力したら次へ」: 音を入れると少し待って次のマスへ進む。待つ間に押した音は同じマス（和音）に入る ── */
const AUTO_ADVANCE_DELAY = 160;
export function setAutoAdvance(on) {
  S.setAutoAdvanceEnabled(on);
  if (!on) cancelAutoAdvance();
}
function cancelAutoAdvance() {
  clearTimeout(RT.autoAdvanceTimer);
  RT.autoAdvanceTimer = null;
}
function scheduleAutoAdvance() {
  if (RT.autoAdvanceTimer) return; // 和音の受付中（最初の音から数える）
  RT.autoAdvanceTimer = setTimeout(() => {
    RT.autoAdvanceTimer = null;
    nextOrAddFrame({ silent: true });
  }, AUTO_ADVANCE_DELAY);
}

/* ================================================================
   音符・マスの編集のUndo/Redo
   ================================================================ */
const EDIT_HISTORY_LIMIT = 200;
function snapshotCurrentSong() {
  return {
    frames: JSON.parse(JSON.stringify(RT.currentSong.frames)),
    bpmOverrides: JSON.parse(JSON.stringify(RT.currentSong.bpmOverrides || {})),
    frameLengths: JSON.parse(JSON.stringify(RT.currentSong.frameLengths || {})),
    sections: JSON.parse(JSON.stringify(RT.currentSong.sections || [])),
    selectedFrameIndex: RT.selectedFrameIndex,
    // 曲全体のBPM・調・楽器も元に戻せるようにする（曲名は対象外）
    bpm: RT.currentSong.bpm,
    pitch: RT.currentSong.pitch,
    instrument: RT.currentSong.instrument,
  };
}
// スナップショットを曲へ戻す。項目が無い古いスナップショットでは、その値は今のままにする
function applySnapshot(snap) {
  const song = RT.currentSong;
  song.frames = snap.frames;
  if (snap.bpmOverrides && Object.keys(snap.bpmOverrides).length) song.bpmOverrides = snap.bpmOverrides;
  else delete song.bpmOverrides;
  restoreFrameLengths(snap.frameLengths);
  if (Array.isArray(snap.sections)) { if (snap.sections.length) song.sections = snap.sections; else delete song.sections; }
  if (typeof snap.bpm === 'number') song.bpm = snap.bpm;
  if (typeof snap.pitch === 'string') song.pitch = snap.pitch;
  if (typeof snap.instrument === 'string') song.instrument = snap.instrument;
  RT.selectedFrameIndex = Math.min(snap.selectedFrameIndex, song.frames.length - 1);
  syncSongMetaInputs();
}
// BPM・調・楽器の入力欄を曲の値に合わせる（元に戻した時など）
function syncSongMetaInputs() {
  const song = RT.currentSong;
  const set = (id, v) => { const el = document.getElementById(id); if (el && String(el.value) !== String(v)) el.value = v; };
  set('bpmSlider', song.bpm);
  set('bpmNumber', song.bpm);
  set('songPitchInput', song.pitch);
  set('songInstrumentInput', song.instrument);
}
function pushEditHistory() {
  if (!RT.currentSong) return;
  RT.bpmEditOpen = false; // ほかの編集をはさんだら、次のBPMの変更は別の1回として数える
  RT.editHistory.push(snapshotCurrentSong());
  if (RT.editHistory.length > EDIT_HISTORY_LIMIT) RT.editHistory.shift();
  RT.redoHistory = [];
  updateUndoButton();
  updateRedoButton();
}
function restoreFrameLengths(map) {
  if (map && Object.keys(map).length) RT.currentSong.frameLengths = map;
  else delete RT.currentSong.frameLengths;
}
export function clearEditHistory() {
  RT.editHistory = [];
  RT.redoHistory = [];
  updateUndoButton();
  updateRedoButton();
}
function updateUndoButton() {
  document.querySelectorAll('.undo-edit-btn').forEach(btn => { btn.disabled = RT.editHistory.length === 0; });
}
function updateRedoButton() {
  document.querySelectorAll('.redo-edit-btn').forEach(btn => { btn.disabled = RT.redoHistory.length === 0; });
}
export function undoEdit() {
  if (RT.editHistory.length === 0 || !RT.currentSong) return;
  RT.redoHistory.push(snapshotCurrentSong());
  if (RT.redoHistory.length > EDIT_HISTORY_LIMIT) RT.redoHistory.shift();
  const prev = RT.editHistory.pop();
  applySnapshot(prev);
  cancelAutoAdvance();
  clearSelection();
  persistCurrentSong();
  renderFrameStrip();
  renderBigGrid();
  updatePracticeRangeBounds(false);
  updateUndoButton();
  updateRedoButton();
  showToast(t('undoneToast'));
}
export function redoEdit() {
  if (RT.redoHistory.length === 0 || !RT.currentSong) return;
  RT.editHistory.push(snapshotCurrentSong());
  if (RT.editHistory.length > EDIT_HISTORY_LIMIT) RT.editHistory.shift();
  const next = RT.redoHistory.pop();
  applySnapshot(next);
  cancelAutoAdvance();
  clearSelection();
  persistCurrentSong();
  renderFrameStrip();
  renderBigGrid();
  updatePracticeRangeBounds(false);
  updateUndoButton();
  updateRedoButton();
  showToast(t('redoneToast'));
}

// 「弾いて録音」のパネルが開いている間は、押した音を録音へ回す（曲は書き換えず、音だけ鳴らす）
let noteInterceptor = null;
export function setNoteInterceptor(fn) { noteInterceptor = fn; }
export function toggleNote(noteIndex) {
  const song = RT.currentSong;
  if (!song) return;
  if (noteInterceptor && noteInterceptor(noteIndex)) {
    A.playNote(noteIndex, song.pitch, song.instrument);
    flashNote(noteIndex);
    return;
  }
  if (RT.isPlaying) stopPlayback(); // 再生中に入力したら止めて、押したマスに入れる
  // 和音の受付中に押した音は、同じマスへの追加としてまとめて1回で元に戻せるようにする
  if (!RT.autoAdvanceTimer) pushEditHistory();
  const frame = song.frames[RT.selectedFrameIndex];
  const pos = frame.indexOf(noteIndex);
  const added = pos < 0;
  if (added) frame.push(noteIndex); else frame.splice(pos, 1);
  persistCurrentSong();
  renderBigGrid();
  refreshFrameBox(RT.selectedFrameIndex);
  A.playNote(noteIndex, song.pitch, song.instrument);
  if (added && S.autoAdvanceEnabled() && !RT.selection) scheduleAutoAdvance();
}
export function addFrame() {
  pushEditHistory();
  RT.currentSong.frames.push([]);
  S.setFrameLength(RT.currentSong, RT.currentSong.frames.length - 1, S.frameLength(RT.currentSong, RT.currentSong.frames.length - 2));
  clearSelection();
  RT.selectedFrameIndex = RT.currentSong.frames.length - 1;
  persistCurrentSong();
  renderFrameStrip();
  renderBigGrid();
  revealSelectedFrame();
  updatePracticeRangeBounds(false);
}
export function deleteFrame(fi) {
  if (RT.currentSong.frames.length <= 1) { showToast(t('lastFrameCannotDelete')); return; }
  cancelAutoAdvance();
  pushEditHistory();
  clearSelection();
  RT.currentSong.frames.splice(fi, 1);
  S.shiftBpmOverridesForDelete(RT.currentSong, fi);
  S.shiftSectionsForDelete(RT.currentSong, fi);
  if (fi < RT.selectedFrameIndex) RT.selectedFrameIndex--;
  if (RT.selectedFrameIndex >= RT.currentSong.frames.length) RT.selectedFrameIndex = RT.currentSong.frames.length - 1;
  persistCurrentSong();
  renderFrameStrip();
  renderBigGrid();
  updatePracticeRangeBounds(false);
}
export function deleteFrameRange(range = editRange()) {
  const song = RT.currentSong;
  if (!song) return;
  cancelAutoAdvance();
  const count = range.end - range.start + 1;
  if (count >= song.frames.length) { showToast(t('cannotDeleteAllFrames')); return; }
  pushEditHistory();
  for (let i = 0; i < count; i++) {
    song.frames.splice(range.start, 1);
    S.shiftBpmOverridesForDelete(song, range.start);
    S.shiftSectionsForDelete(song, range.start);
  }
  if (RT.selectedFrameIndex > range.end) RT.selectedFrameIndex -= count;
  else if (RT.selectedFrameIndex >= range.start) RT.selectedFrameIndex = range.start;
  if (RT.selectedFrameIndex >= song.frames.length) RT.selectedFrameIndex = song.frames.length - 1;
  clearSelection();
  persistCurrentSong();
  renderFrameStrip();
  renderBigGrid();
  updatePracticeRangeBounds(false);
  showToast(t('frameRangeDeletedToast', { count }));
}
// 選択範囲（無ければ今のマス）の音を消す。マスは残す（休符になる）
export function clearFrameRange() {
  const song = RT.currentSong;
  if (!song) return;
  cancelAutoAdvance();
  const range = editRange();
  let any = false;
  for (let i = range.start; i <= range.end; i++) if (song.frames[i] && song.frames[i].length) any = true;
  if (!any) return;
  pushEditHistory();
  for (let i = range.start; i <= range.end; i++) song.frames[i] = [];
  persistCurrentSong();
  if (range.start === range.end) refreshFrameBox(range.start); else renderFrameStrip();
  renderBigGrid();
  if (range.end > range.start) showToast(t('frameRangeClearedToast', { count: range.end - range.start + 1 }));
}
export function insertBlankFrameAfter(fi) {
  const song = RT.currentSong;
  if (!song) return;
  pushEditHistory();
  const at = fi + 1;
  cancelAutoAdvance();
  song.frames.splice(at, 0, []);
  S.shiftBpmOverridesForInsert(song, at, 1);
  S.shiftSectionsForInsert(song, at, 1);
  S.setFrameLength(song, at, S.frameLength(song, fi));
  clearSelection();
  RT.selectedFrameIndex = at;
  persistCurrentSong();
  renderFrameStrip();
  renderBigGrid();
  updatePracticeRangeBounds(false);
  showToast(t('frameInsertedToast'));
}

/* ================================================================
   フレーム単位のBPM変更（テンポ変化）の設定UI
   ================================================================ */
export function renderFrameBpmRow() {
  const song = RT.currentSong;
  if (!song) return;
  const toggle = document.getElementById('frameBpmOverrideToggle');
  const valueInput = document.getElementById('frameBpmOverrideValue');
  if (!toggle || !valueInput) return;
  const target = bpmOverrideTarget();
  const existing = S.frameBpmOverride(song, target);
  toggle.checked = existing !== null;
  valueInput.style.display = existing !== null ? '' : 'none';
  valueInput.value = existing !== null ? existing : song.bpm;
  // 範囲を選んでいる時は、テンポ変化が付くのは範囲の先頭のマスだけだと示す（範囲の全マスには書かない）
  const note = document.getElementById('frameBpmRangeNote');
  if (note) {
    note.hidden = !RT.selection;
    if (RT.selection) note.textContent = t('frameBpmRangeNote', { n: target + 1 });
  }
}
// テンポ変化を付けるマス: 範囲を選んでいればその先頭、無ければ選んでいるマス
function bpmOverrideTarget() { return editRange().start; }
export function onFrameBpmOverrideToggle(checked) {
  const song = RT.currentSong;
  if (!song) return;
  const target = bpmOverrideTarget();
  pushEditHistory();
  if (checked) {
    if (!song.bpmOverrides) song.bpmOverrides = {};
    song.bpmOverrides[target] = song.bpm;
  } else if (song.bpmOverrides) {
    delete song.bpmOverrides[target];
  }
  persistCurrentSong();
  renderFrameBpmRow();
  refreshFrameBox(target);
}
export function onFrameBpmOverrideValueChange(val) {
  const song = RT.currentSong;
  if (!song) return;
  const parsed = parseInt(val, 10);
  const bpm = Math.max(40, Math.min(999, isNaN(parsed) ? song.bpm : parsed));
  const target = bpmOverrideTarget();
  pushEditHistory();
  if (!song.bpmOverrides) song.bpmOverrides = {};
  song.bpmOverrides[target] = bpm;
  persistCurrentSong();
  renderFrameBpmRow();
  refreshFrameBox(target);
}

/* ================================================================
   フレーム範囲のコピー＆ペースト
   ================================================================ */
export function copyFrameRange(range = editRange()) {
  const song = RT.currentSong;
  if (!song) return;
  RT.frameClipboard = S.clipFromRange(song, range.start, range.end);
  S.saveFrameClipboard(RT.frameClipboard);
  renderFrameClipboardHint();
  showToast(t('frameRangeCopiedToast', { count: RT.frameClipboard.frames.length }));
}
// 貼り付け: 「挿入」（選んだ範囲の後ろへ差し込む。従来どおり）か「上書き」（選んだ範囲の先頭から置き換える）
export function pasteFrameRange() {
  const song = RT.currentSong;
  if (!song || !RT.frameClipboard || RT.frameClipboard.frames.length === 0) return;
  cancelAutoAdvance();
  const overwrite = S.loadUiState().pasteMode === 'overwrite';
  const range = editRange();
  const at = overwrite ? range.start : range.end + 1;
  const n = RT.frameClipboard.frames.length;
  if ((overwrite ? Math.max(song.frames.length, at + n) : song.frames.length + n) > MAX_FRAMES_BY_EDIT) { showToast(t('tooManyFramesToast', { max: MAX_FRAMES_BY_EDIT })); return; }
  pushEditHistory();
  clearSelection();
  if (overwrite) S.overwriteClipAt(song, at, RT.frameClipboard);
  else S.insertClipAt(song, at, RT.frameClipboard);
  RT.selectedFrameIndex = at + n - 1;
  persistCurrentSong();
  renderFrameStrip();
  renderBigGrid();
  revealSelectedFrame();
  updatePracticeRangeBounds(false);
  showToast(t(overwrite ? 'frameRangeOverwrittenToast' : 'frameRangePastedToast', { count: n }));
}
export function renderFrameClipboardHint() {
  const hint = document.getElementById('frameClipboardHint');
  const count = RT.frameClipboard ? RT.frameClipboard.frames.length : 0;
  document.querySelectorAll('.paste-frame-btn').forEach(btn => { btn.disabled = count === 0; });
  if (hint) hint.textContent = count > 0 ? t('frameClipboardReadyHint', { count }) : t('frameClipboardEmptyHint');
}

/* ================================================================
   範囲を変える（作曲ツールの一括変換）。対象は editRange()（範囲が無ければ選んでいるマス1つ）。
   どの操作も履歴は1回だけ積み、Ctrl+Z 1回で丸ごと戻せる。
   ================================================================ */
const MAX_FRAMES_BY_EDIT = 10000; // 編集操作で増やせる総マス数の上限（読み込みの上限とは別）
export function renderRangeTools() {
  const song = RT.currentSong;
  if (!song) return;
  renderSectionList();
  const r = editRange();
  const target = document.getElementById('rangeToolsTarget');
  if (target) target.textContent = r.start === r.end ? t('rangeToolsTargetOne', { n: r.start + 1 }) : t('rangeToolsTargetRange', { a: r.start + 1, b: r.end + 1, count: r.end - r.start + 1 });
  const ui = S.loadUiState();
  const mode = document.getElementById('shiftModeSelect');
  if (mode) mode.value = ui.shiftMode;
  document.querySelectorAll('.paste-mode-btn').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.mode === ui.pasteMode)));
  // 貼り付けボタンの文言・説明も、今の貼り付け方に合わせる
  const ow = ui.pasteMode === 'overwrite';
  document.querySelectorAll('.paste-frame-btn').forEach(btn => {
    if (btn.classList.contains('mini-btn')) btn.textContent = t(ow ? 'pasteOverwriteBtn' : 'pasteFrameRangeBtn');
    else { btn.title = t(ow ? 'pasteOverwriteBtn' : 'railPasteRangeTitle') + ' (Ctrl+V)'; btn.setAttribute('aria-label', t(ow ? 'pasteOverwriteBtn' : 'railPasteRangeTitle')); }
  });
  document.querySelectorAll('input[name="repeatSource"]').forEach(el => { el.checked = el.value === ui.repeatSource; });
  const clipOpt = document.getElementById('repeatSourceClipboard');
  if (clipOpt) clipOpt.disabled = !(RT.frameClipboard && RT.frameClipboard.frames.length);
}
function afterRangeEdit(keepSelection) {
  if (!keepSelection) clearSelection();
  persistCurrentSong();
  renderFrameStrip();
  renderBigGrid();
  updatePracticeRangeBounds(false);
  renderRangeTools();
}
export function shiftRangeNotes(delta) {
  const song = RT.currentSong;
  if (!song) return;
  const r = editRange();
  const mode = S.loadUiState().shiftMode;
  const res = S.shiftNotesInFrames(song.frames.slice(r.start, r.end + 1), delta, mode);
  if (res.overflow && mode === 'abort') { showToast(t('shiftAbortedToast')); return; }
  const changed = res.frames.some((f, i) => f.join() !== song.frames[r.start + i].join());
  if (!changed) { showToast(t('rangeNoNotesToast')); return; }
  cancelAutoAdvance();
  pushEditHistory();
  res.frames.forEach((f, i) => { song.frames[r.start + i] = f; });
  afterRangeEdit(true); // 続けてもう一度ずらせるよう、範囲は残す
  showToast(t('shiftDoneToast', { d: (delta > 0 ? '+' : '') + delta }) + (res.overflow ? t(mode === 'drop' ? 'shiftDroppedSuffix' : 'shiftWrappedSuffix') : ''));
}
export function invertRangeNotes() {
  const song = RT.currentSong;
  if (!song) return;
  const r = editRange();
  const next = S.invertNotesInFrames(song.frames.slice(r.start, r.end + 1));
  if (!next.some((f, i) => f.join() !== song.frames[r.start + i].join())) { showToast(t('rangeNoNotesToast')); return; }
  cancelAutoAdvance();
  pushEditHistory();
  next.forEach((f, i) => { song.frames[r.start + i] = f; });
  afterRangeEdit(true);
  showToast(t('invertDoneToast'));
}
export function reverseRangeFrames() {
  const song = RT.currentSong;
  if (!song) return;
  const r = editRange();
  if (r.end <= r.start) { showToast(t('reverseNeedsRangeToast')); return; }
  cancelAutoAdvance();
  pushEditHistory();
  S.reverseFramesInSong(song, r.start, r.end);
  afterRangeEdit(true);
  showToast(t('reverseDoneToast', { count: r.end - r.start + 1 }));
}
export function setPasteMode(mode) {
  S.saveUiState({ pasteMode: mode === 'overwrite' ? 'overwrite' : 'insert' });
  renderRangeTools();
}
export function setShiftMode(mode) { S.saveUiState({ shiftMode: mode }); }
export function setRepeatSource(src) { S.saveUiState({ repeatSource: src }); }
// 範囲（またはコピーした内容）を、範囲の直後へ count 回くり返して挿入する
export function repeatPaste(countRaw) {
  const song = RT.currentSong;
  if (!song) return;
  const count = Math.max(2, Math.min(16, parseInt(countRaw, 10) || 2));
  const r = editRange();
  const useClip = S.loadUiState().repeatSource === 'clipboard';
  const clip = useClip ? RT.frameClipboard : S.clipFromRange(song, r.start, r.end);
  if (!clip || !clip.frames.length) { showToast(t('repeatNoClipToast')); return; }
  const added = clip.frames.length * count;
  if (song.frames.length + added > MAX_FRAMES_BY_EDIT) { showToast(t('tooManyFramesToast', { max: MAX_FRAMES_BY_EDIT })); return; }
  cancelAutoAdvance();
  pushEditHistory();
  let at = r.end + 1;
  for (let k = 0; k < count; k++) at += S.insertClipAt(song, at, clip);
  RT.selectedFrameIndex = at - 1;
  afterRangeEdit(false);
  revealSelectedFrame();
  showToast(t('repeatDoneToast', { count, frames: added }));
}

/* ================================================================
   曲メタ情報・BPM・タップテンポ
   ================================================================ */
export function onSongMetaChange() {
  const song = RT.currentSong;
  if (!song) return;
  const pitch = document.getElementById('songPitchInput').value;
  const instrument = document.getElementById('songInstrumentInput').value;
  // 調・楽器の変更は元に戻せるようにする（曲名の入力は対象外）
  if (pitch !== song.pitch || instrument !== song.instrument) pushEditHistory();
  song.name = document.getElementById('songNameInput').value || t('untitledSong');
  song.pitch = pitch;
  song.instrument = instrument;
  persistCurrentSong();
}
// commit=true は確定（スライダーを離した・数値欄から離れた）。ドラッグ中や数字を打っている間の変化は、
// 確定までをまとめて1回の「元に戻す」にする
export function onBpmChange(val, source, commit) {
  const parsed = parseInt(val, 10);
  const bpm = Math.max(40, Math.min(999, isNaN(parsed) ? 150 : parsed));
  if (bpm !== RT.currentSong.bpm && !RT.bpmEditOpen) { pushEditHistory(); RT.bpmEditOpen = true; }
  if (commit) RT.bpmEditOpen = false;
  RT.currentSong.bpm = bpm;
  document.getElementById('bpmSlider').value = bpm;
  if (source !== 'number') document.getElementById('bpmNumber').value = bpm;
  persistCurrentSong();
}
export function tapTempo() {
  const result = A.registerTapTempo();
  const btn = document.getElementById('tapTempoBtn');
  btn.classList.add('flash');
  clearTimeout(tapTempo._flashTimer);
  tapTempo._flashTimer = setTimeout(() => btn.classList.remove('flash'), 100);

  const hint = document.getElementById('tapTempoHint');
  if (!result) { hint.textContent = t('tapAgainHint'); return; }
  onBpmChange(result.bpm);
  hint.textContent = t('tapMeasuredHint', { count: result.count, bpm: result.bpm });
}

/* ================================================================
   再生モード。ループ再生（loopRangeEnabled）がONの時は、練習・試験の範囲
   （getPracticeRange()）だけを繰り返し再生し続ける。フレーム単位の
   テンポ変化（bpmOverrides）にも対応。
   ================================================================ */
export function togglePlayback() {
  if (RT.isPlaying) { stopPlayback(); return; }
  stopPlayback();
  const song = RT.currentSong;
  if (S.metronomeEnabled()) {
    RT.isPlaying = true;
    document.getElementById('playBtn').classList.add('active');
    document.getElementById('playBtn').textContent = t('countInLabel');
    document.getElementById('stopBtn').style.display = 'flex';
    document.getElementById('floatingStopBtn').classList.add('show');
    const looping = S.loopRangeEnabled(song);
    const range = looping ? getPracticeRange() : null;
    const startIdx = (looping && (RT.selectedFrameIndex < range.start || RT.selectedFrameIndex > range.end)) ? range.start : RT.selectedFrameIndex;
    A.runCountIn(S.effectiveBpmAtFrame(song, startIdx), null, startPlaybackLoop);
    return;
  }
  startPlaybackLoop();
}
function startPlaybackLoop() {
  RT.isPlaying = true;
  document.getElementById('playBtn').classList.add('active');
  document.getElementById('playBtn').textContent = t('playingLabel');
  document.getElementById('stopBtn').style.display = 'flex';
  document.getElementById('floatingStopBtn').classList.add('show');
  const song = RT.currentSong;
  const looping = S.loopRangeEnabled(song);
  const range = looping ? getPracticeRange() : null;
  let i = (looping && (RT.selectedFrameIndex < range.start || RT.selectedFrameIndex > range.end)) ? range.start : RT.selectedFrameIndex;
  let bpm = S.effectiveBpmAtFrame(song, i);
  const step = () => {
    if (looping ? i > range.end : i >= song.frames.length) {
      if (!looping) { stopPlayback(); return; }
      i = range.start;
      bpm = S.effectiveBpmAtFrame(song, i);
    }
    const override = S.frameBpmOverride(song, i);
    if (override !== null) bpm = override;
    highlightPlayingFrame(i);
    A.playFrame(song.frames[i], song.pitch, song.instrument);
    if (S.metronomeEnabled()) A.playMetronomeClick(false);
    const wait = (60000 / bpm) * S.frameLength(song, i);
    i++;
    RT.playbackTimer = setTimeout(step, wait);
  };
  step();
}
export function stopPlayback() {
  A.cancelCountIn();
  clearTimeout(RT.playbackTimer);
  RT.playbackTimer = null;
  RT.isPlaying = false;
  const playBtn = document.getElementById('playBtn');
  if (playBtn) { playBtn.classList.remove('active'); playBtn.textContent = t('playBtn'); }
  const stopBtn = document.getElementById('stopBtn');
  if (stopBtn) stopBtn.style.display = 'none';
  const floatingBtn = document.getElementById('floatingStopBtn');
  if (floatingBtn) floatingBtn.classList.remove('show');
  clearPlayingHighlight();
}
function highlightPlayingFrame(i) {
  clearPlayingHighlight();
  const prevEl = document.getElementById('frameBox_' + RT.selectedFrameIndex);
  if (prevEl) prevEl.classList.remove('selected');
  const el = document.getElementById('frameBox_' + i);
  if (el) {
    el.classList.add('playing', 'selected');
    if (!S.noScrollDuringPlaybackEnabled()) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
  RT.selectedFrameIndex = i;
  renderBigGrid();
  updateEditPos();
}
function clearPlayingHighlight() {
  document.querySelectorAll('.frame-box.playing').forEach(b => b.classList.remove('playing'));
}

/* ================================================================
   練習・試験結果の表示（エディタ画面に「前回の練習・試験結果」を表示する）
   ================================================================ */
export function renderLastResult() {
  const el = document.getElementById('lastResultRow');
  const song = RT.currentSong;
  if (!el || !song) return;
  const d = ts => { const dt = new Date(ts); return `${dt.getFullYear()}/${dt.getMonth() + 1}/${dt.getDate()}`; };
  const lines = [];
  const pr = song.lastPracticeResult;
  const tr = song.lastTestResult;
  if (pr) lines.push(t('lastPracticeResultText', { date: d(pr.at) }));
  if (tr) lines.push(t(tr.mistakes === 0 ? 'lastTestResultTextNoMistake' : 'lastTestResultText', { date: d(tr.at), count: tr.mistakes }));
  el.innerHTML = lines.map(line => `<div>${escapeHtml(line)}</div>`).join('');
}

/* ================================================================
   曲データの保存＋称号チェック（トースト＋称号UI更新は呼び出し側の責務にせず、
   ここで完結させる：view.jsのrenderTitles()を動的importで呼ぶと循環を招くため、
   称号チップの再描画はDOM更新のみ軽量に行うregisterTitlesRenderer()経由にする）
   ================================================================ */
let titlesRenderer = null;
export function registerTitlesRenderer(fn) { titlesRenderer = fn; }
function announceNewTitles(newlyEarned) {
  if (!newlyEarned || !newlyEarned.length) return;
  newlyEarned.forEach(ti => showToast(t('titleUnlockedToast', { name: t(ti.nameKey) })));
  if (titlesRenderer) titlesRenderer();
}
export function persistCurrentSong() {
  const song = RT.currentSong;
  if (!song) return;
  RT.songVersion = (RT.songVersion || 0) + 1; // 演奏時間の表を作り直す合図
  song.updatedAt = Date.now();
  const songs = S.loadSongs();
  const idx = songs.findIndex(s => s.id === song.id);
  if (idx >= 0) songs[idx] = song; else songs.unshift(song);
  S.saveSongs(songs);
  announceNewTitles(S.recordNoteCount(S.songNoteCount(song)));
}

/* ================================================================
   キーボード設定モーダル：マスごとに好きなキーを割り当てる
   ================================================================ */
export function openKeyBindModal() {
  RT.capturingKeyIndex = null;
  renderKeyBindModal();
  openModal('keyBindModal');
}
export function closeKeyBindModal() {
  RT.capturingKeyIndex = null;
  closeModal('keyBindModal');
}
export function renderKeyBindModal() {
  const wrap = document.getElementById('keyBindList');
  if (!wrap) return;
  wrap.innerHTML = NOTE_LABELS.map((_, i) => {
    const capturing = RT.capturingKeyIndex === i;
    return `
      <div class="keybind-row${capturing ? ' capturing' : ''}">
        <div class="keybind-note">${escapeHtml(noteLabel(i))}<span class="keybind-note-idx">${escapeHtml(t('keybindNoteIdx', { n: i + 1 }))}</span></div>
        <div class="keybind-key-display">${capturing ? escapeHtml(t('keybindWaitingInput')) : escapeHtml(S.keyDisplayLabel(RT.keyBindings[i]))}</div>
        <button type="button" class="mini-btn${capturing ? ' primary' : ''}" data-act="start-key-capture" data-idx="${i}">${capturing ? escapeHtml(t('keybindCancelBtn')) : escapeHtml(t('keybindChangeBtn'))}</button>
      </div>`;
  }).join('');
}
export function startKeyCapture(i) {
  RT.capturingKeyIndex = (RT.capturingKeyIndex === i) ? null : i;
  renderKeyBindModal();
}
export function resetKeyBindings() {
  RT.keyBindings = DEFAULT_KEY_BINDINGS.slice();
  S.saveKeyBindings(RT.keyBindings);
  RT.capturingKeyIndex = null;
  renderKeyBindModal();
  refreshAllKeyHints();
  showToast(t('resetKeyBindingsToast'));
}
export function refreshAllKeyHints() {
  if (RT.currentSong && document.getElementById('viewEditor')?.classList.contains('active')) renderBigGrid();
  refreshAllKeyHintsPerfHook();
}
let perfKeyHintRefresher = null;
export function registerPerfKeyHintRefresher(fn) { perfKeyHintRefresher = fn; }
function refreshAllKeyHintsPerfHook() { if (perfKeyHintRefresher) perfKeyHintRefresher(); }

// キー入力の取り込み（キャプチャ中のキー割り当て）。document直付けのキー捕捉は
// tai-score-view.jsのグローバルkeydownハンドラから呼ばれる（重複listener登録防止のため
// このファイル自体ではaddEventListenerしない）。
export function captureKeyForBinding(e) {
  if (RT.capturingKeyIndex === null) return false;
  if (e.key === 'Escape') { RT.capturingKeyIndex = null; renderKeyBindModal(); e.preventDefault(); return true; }
  if (['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return true;
  const newKey = S.normalizeKeyEvent(e);
  const swapIdx = RT.keyBindings.findIndex((k, idx) => idx !== RT.capturingKeyIndex && k === newKey);
  if (swapIdx >= 0) {
    RT.keyBindings[swapIdx] = RT.keyBindings[RT.capturingKeyIndex];
    showToast(t('keySwapToast', { label: noteLabel(swapIdx), n: swapIdx + 1 }));
  }
  RT.keyBindings[RT.capturingKeyIndex] = newKey;
  S.saveKeyBindings(RT.keyBindings);
  RT.capturingKeyIndex = null;
  renderKeyBindModal();
  refreshAllKeyHints();
  e.preventDefault();
  return true;
}

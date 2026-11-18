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
    selectedFrameIndex: RT.selectedFrameIndex,
  };
}
function pushEditHistory() {
  if (!RT.currentSong) return;
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
  RT.currentSong.frames = prev.frames;
  RT.currentSong.bpmOverrides = prev.bpmOverrides;
  restoreFrameLengths(prev.frameLengths);
  RT.selectedFrameIndex = Math.min(prev.selectedFrameIndex, RT.currentSong.frames.length - 1);
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
  RT.currentSong.frames = next.frames;
  RT.currentSong.bpmOverrides = next.bpmOverrides;
  restoreFrameLengths(next.frameLengths);
  RT.selectedFrameIndex = Math.min(next.selectedFrameIndex, RT.currentSong.frames.length - 1);
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

export function toggleNote(noteIndex) {
  const song = RT.currentSong;
  if (!song) return;
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
  const existing = S.frameBpmOverride(song, RT.selectedFrameIndex);
  toggle.checked = existing !== null;
  valueInput.style.display = existing !== null ? '' : 'none';
  valueInput.value = existing !== null ? existing : song.bpm;
}
export function onFrameBpmOverrideToggle(checked) {
  const song = RT.currentSong;
  if (!song) return;
  pushEditHistory();
  if (checked) {
    if (!song.bpmOverrides) song.bpmOverrides = {};
    song.bpmOverrides[RT.selectedFrameIndex] = song.bpm;
  } else if (song.bpmOverrides) {
    delete song.bpmOverrides[RT.selectedFrameIndex];
  }
  persistCurrentSong();
  renderFrameBpmRow();
  refreshFrameBox(RT.selectedFrameIndex);
}
export function onFrameBpmOverrideValueChange(val) {
  const song = RT.currentSong;
  if (!song) return;
  const parsed = parseInt(val, 10);
  const bpm = Math.max(40, Math.min(999, isNaN(parsed) ? song.bpm : parsed));
  pushEditHistory();
  if (!song.bpmOverrides) song.bpmOverrides = {};
  song.bpmOverrides[RT.selectedFrameIndex] = bpm;
  persistCurrentSong();
  renderFrameBpmRow();
  refreshFrameBox(RT.selectedFrameIndex);
}

/* ================================================================
   フレーム範囲のコピー＆ペースト
   ================================================================ */
export function copyFrameRange(range = editRange()) {
  const song = RT.currentSong;
  if (!song) return;
  const frames = song.frames.slice(range.start, range.end + 1).map(f => f.slice());
  const bpmOverrides = {};
  if (song.bpmOverrides) {
    for (let i = range.start; i <= range.end; i++) {
      const v = song.bpmOverrides[i];
      if (typeof v === 'number' && v > 0) bpmOverrides[i - range.start] = v;
    }
  }
  const frameLengths = {};
  for (let i = range.start; i <= range.end; i++) {
    const len = S.frameLength(song, i);
    if (len !== 1) frameLengths[i - range.start] = len;
  }
  RT.frameClipboard = { frames, bpmOverrides, frameLengths };
  S.saveFrameClipboard(RT.frameClipboard);
  renderFrameClipboardHint();
  showToast(t('frameRangeCopiedToast', { count: frames.length }));
}
export function pasteFrameRange() {
  const song = RT.currentSong;
  if (!song || !RT.frameClipboard || RT.frameClipboard.frames.length === 0) return;
  cancelAutoAdvance();
  pushEditHistory();
  const at = editRange().end + 1;
  clearSelection();
  const copied = RT.frameClipboard.frames.map(f => f.slice());
  song.frames.splice(at, 0, ...copied);
  S.shiftBpmOverridesForInsert(song, at, copied.length);
  Object.keys(RT.frameClipboard.bpmOverrides || {}).forEach(k => {
    if (!song.bpmOverrides) song.bpmOverrides = {};
    song.bpmOverrides[at + parseInt(k, 10)] = RT.frameClipboard.bpmOverrides[k];
  });
  Object.keys(RT.frameClipboard.frameLengths || {}).forEach(k => {
    S.setFrameLength(song, at + parseInt(k, 10), RT.frameClipboard.frameLengths[k]);
  });
  RT.selectedFrameIndex = at + copied.length - 1;
  persistCurrentSong();
  renderFrameStrip();
  renderBigGrid();
  revealSelectedFrame();
  updatePracticeRangeBounds(false);
  showToast(t('frameRangePastedToast', { count: copied.length }));
}
export function renderFrameClipboardHint() {
  const hint = document.getElementById('frameClipboardHint');
  const count = RT.frameClipboard ? RT.frameClipboard.frames.length : 0;
  document.querySelectorAll('.paste-frame-btn').forEach(btn => { btn.disabled = count === 0; });
  if (hint) hint.textContent = count > 0 ? t('frameClipboardReadyHint', { count }) : t('frameClipboardEmptyHint');
}

/* ================================================================
   曲メタ情報・BPM・タップテンポ
   ================================================================ */
export function onSongMetaChange() {
  const song = RT.currentSong;
  if (!song) return;
  song.name = document.getElementById('songNameInput').value || t('untitledSong');
  song.pitch = document.getElementById('songPitchInput').value;
  song.instrument = document.getElementById('songInstrumentInput').value;
  persistCurrentSong();
}
export function onBpmChange(val, source) {
  const parsed = parseInt(val, 10);
  const bpm = Math.max(40, Math.min(999, isNaN(parsed) ? 150 : parsed));
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

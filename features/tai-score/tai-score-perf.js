/* ================================================================
   tai-score（楽譜づくり）の演奏オーバーレイ（練習モード／試験モード／
   フリー演奏モード共通、#perfOverlay 全画面固定表示）。

   移植元: tai-score/index.html 行3805-4025・3865-3885（フリー演奏）。
   ================================================================ */
import { t } from './data/i18n-score.js';
import { NOTE_LABELS, noteLabel, INSTRUMENT_LABELS, instrumentLabel } from './data/constants.js';
import * as S from './tai-score-state.js';
import * as A from './tai-score-audio.js';
import { RT, escapeHtml, showToast, trapPush, trapPop } from './tai-score-runtime.js';
import { getPracticeRange, stopPlayback, renderLastResult, registerPerfKeyHintRefresher } from './tai-score-editor.js';
import * as R from './tai-score-recorder.js';

let titlesRenderer = null;
export function registerTitlesRenderer(fn) { titlesRenderer = fn; }

registerPerfKeyHintRefresher(() => {
  if (document.getElementById('perfOverlay')?.classList.contains('open')) {
    renderPerfGrid();
    if (RT.perfMode === 'practice') highlightPerfTargets();
  }
});

export function openPractice() { startPerfSession('practice'); }
export function openTestMode() { startPerfSession('test'); }

function startPerfSession(mode) {
  const song = RT.currentSong;
  if (!song || song.frames.length === 0) {
    showToast(t('noSongToast'));
    return;
  }
  const range = getPracticeRange();
  const hasNotes = song.frames.slice(range.start, range.end + 1).some(f => f.length > 0);
  if (!hasNotes) {
    showToast(mode === 'practice' ? t('noNotesInRangePractice') : t('noNotesInRangeTest'));
    return;
  }
  stopPlayback();
  RT.perfMode = mode;
  RT.perfRangeStart = range.start;
  RT.perfRangeEnd = range.end;
  RT.perfMistakeCount = 0;
  const isFullRange = range.start === 0 && range.end === song.frames.length - 1;
  const rangeLabel = isFullRange ? '' : t('rangeLabelTemplate', { start: range.start + 1, end: range.end + 1 });
  const songName = song.name || t('untitledSong');
  document.getElementById('perfTitle').textContent = mode === 'practice'
    ? t('practiceModeTitle', { name: songName, range: rangeLabel })
    : t('testModeTitle', { name: songName, range: rangeLabel });
  document.getElementById('perfCloseBtn').textContent = t('perfCloseEnd');
  document.getElementById('perfInstrumentRow').style.display = 'none';
  document.getElementById('perfRecBtn').style.display = 'none';
  renderPerfGrid();
  RT.perfFrameIndex = RT.perfRangeStart - 1;
  openPerfOverlay();
  if (S.metronomeEnabled()) {
    // 練習・試験モードはユーザーの入力待ちで進むため、一定間隔のメトロノームは
    // 鳴らし続けられない。代わりに開始前の4拍カウントインだけを鳴らす。
    RT.perfCountingIn = true;
    document.getElementById('perfProgress').textContent = '';
    A.runCountIn(S.effectiveBpmAtFrame(song, range.start), (beat, total) => {
      document.getElementById('perfFooter').textContent = t('countInBeatLabel', { n: total - beat + 1 });
    }, () => {
      RT.perfCountingIn = false;
      goToNextPerfFrame();
    });
  } else {
    goToNextPerfFrame();
  }
}

export function openFreeMode() {
  stopPlayback();
  RT.perfMode = 'free';
  RT.freePlayInstrument = S.getFreePlayInstrument();
  document.getElementById('perfTitle').textContent = t('freePlayModeTitle');
  document.getElementById('perfProgress').textContent = '';
  document.getElementById('perfFooter').textContent = t('freePlayFooterHint');
  document.getElementById('perfCloseBtn').textContent = t('perfCloseClose');
  document.getElementById('perfInstrumentRow').style.display = 'flex';
  document.getElementById('perfRecBtn').style.display = ''; // フリー演奏だけ「録音して曲にする」を出す
  renderFreePlayInstrumentRow();
  renderPerfGrid();
  clearPerfTargets();
  openPerfOverlay();
}
export function setFreePlayInstrument(code) {
  RT.freePlayInstrument = code;
  S.setFreePlayInstrument(code);
  renderFreePlayInstrumentRow();
}
function renderFreePlayInstrumentRow() {
  const row = document.getElementById('perfInstrumentRow');
  const noteIcon = '<svg class="inline-icon" width="15" height="15"><use href="#i-music-note"/></svg>';
  row.innerHTML = Object.keys(INSTRUMENT_LABELS).map(code => `
    <button type="button" class="perf-instrument-btn${code === RT.freePlayInstrument ? ' active' : ''}" data-act="set-free-instrument" data-code="${code}">${noteIcon} ${escapeHtml(instrumentLabel(code))}</button>
  `).join('');
}

function openPerfOverlay() {
  document.getElementById('perfOverlay').classList.add('open');
  trapPush('perfOverlay', document.getElementById('perfOverlay'));
}
export function closePerformance() {
  R.discard(); // フリー演奏の録音の途中で閉じたら、何も保存せずに捨てる
  A.cancelCountIn();
  RT.perfCountingIn = false;
  document.getElementById('perfOverlay').classList.remove('open');
  trapPop('perfOverlay');
  RT.perfMode = null;
  renderLastResult(); // 練習・試験モード終了で結果が更新されている場合、下の画面にも反映する
}

/* ================================================================
   練習・試験結果の記憶
   ================================================================ */
function recordPerfResult() {
  const song = RT.currentSong;
  if (!song) return;
  if (RT.perfMode === 'test') {
    song.lastTestResult = { at: Date.now(), mistakes: RT.perfMistakeCount };
  } else if (RT.perfMode === 'practice') {
    song.lastPracticeResult = { at: Date.now() };
  }
  const songs = S.loadSongs();
  const idx = songs.findIndex(s => s.id === song.id);
  if (idx >= 0) songs[idx] = song; else songs.unshift(song);
  S.saveSongs(songs);
  if (RT.perfMode === 'practice') S.recordPracticeCompleted();
  if (titlesRenderer) titlesRenderer();
}

// pointerdown（押した瞬間）で反応させ、和音の同時押しに対応する
export function renderPerfGrid() {
  const grid = document.getElementById('perfGrid');
  grid.innerHTML = NOTE_LABELS.map((_, i) => `<div class="perf-key" data-idx="${i}"><span class="perf-key-label">${escapeHtml(noteLabel(i))}</span><span class="perf-key-hint">${escapeHtml(S.keyDisplayLabel(RT.keyBindings[i]))}</span></div>`).join('');
  grid.querySelectorAll('.perf-key').forEach(el => {
    el.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      onPerfKeyPress(parseInt(el.dataset.idx, 10));
    });
  });
}

export function onPerfKeyPress(idx) {
  const song = RT.currentSong;
  // pitch（調）は演奏モードに関わらず常に現在の曲のpitchを使う（フリー演奏でも移植元と同じ挙動）。
  // instrumentだけフリー演奏時は専用に選んだ楽器(freePlayInstrument)に差し替える。
  A.playNote(idx, song && song.pitch, RT.perfMode === 'free' ? RT.freePlayInstrument : ((song && song.instrument) || 'Harp'));
  const el = document.querySelector(`#perfGrid .perf-key[data-idx="${idx}"]`);
  if (el) {
    el.classList.add('pressed-flash');
    setTimeout(() => el.classList.remove('pressed-flash'), 120);
  }
  if (RT.perfMode === 'free') { R.hit(idx); return; } // フリー演奏の録音中は、弾いた音を記録する
  if (RT.perfCountingIn) return; // カウントイン中は判定しない（音のプレビューだけは鳴らす）
  if (RT.perfMode !== 'practice' && RT.perfMode !== 'test') return;
  const frame = song.frames[RT.perfFrameIndex];
  if (!frame) return;
  if (frame.includes(idx)) {
    if (!RT.perfHitSet.has(idx)) {
      RT.perfHitSet.add(idx);
      if (el) el.classList.add('hit');
      if (frame.every(n => RT.perfHitSet.has(n))) {
        setTimeout(() => goToNextPerfFrame(), 220);
      }
    }
  } else if (RT.perfMode === 'test') {
    // 試験モードでは、お手本（光っているマス）が出ていない状態で不正解を押した場合は
    // ミスとして数え、そのマスをもう一度最初からやり直させる
    RT.perfMistakeCount++;
    RT.perfHitSet = new Set();
    if (el) {
      el.classList.add('miss-flash');
      setTimeout(() => el.classList.remove('miss-flash'), 250);
    }
    document.getElementById('perfFooter').innerHTML = t('wrongAnswerFooter', { count: RT.perfMistakeCount });
  }
}

function goToNextPerfFrame() {
  const song = RT.currentSong;
  if (!song || (RT.perfMode !== 'practice' && RT.perfMode !== 'test')) return;
  RT.perfFrameIndex++;
  while (RT.perfFrameIndex <= RT.perfRangeEnd && song.frames[RT.perfFrameIndex].length === 0) RT.perfFrameIndex++;
  RT.perfHitSet = new Set();
  const totalInRange = RT.perfRangeEnd - RT.perfRangeStart + 1;
  if (RT.perfFrameIndex > RT.perfRangeEnd) {
    clearPerfTargets();
    if (RT.perfMode === 'test') {
      document.getElementById('perfFooter').innerHTML = RT.perfMistakeCount === 0
        ? t('passNoMistake')
        : t('passWithMistakes', { count: RT.perfMistakeCount });
    } else {
      document.getElementById('perfFooter').textContent = t('performedToEnd');
    }
    document.getElementById('perfProgress').textContent = `${totalInRange} / ${totalInRange}`;
    recordPerfResult();
    return;
  }
  const posInRange = RT.perfFrameIndex - RT.perfRangeStart + 1;
  document.getElementById('perfProgress').textContent = `${posInRange} / ${totalInRange}`;
  if (RT.perfMode === 'practice') {
    highlightPerfTargets();
    document.getElementById('perfFooter').textContent = t('practiceTargetFooter');
  } else {
    clearPerfTargets();
    document.getElementById('perfFooter').textContent = t('testTargetFooter');
  }
}
function highlightPerfTargets() {
  clearPerfTargets();
  const frame = RT.currentSong.frames[RT.perfFrameIndex] || [];
  frame.forEach(idx => {
    const el = document.querySelector(`#perfGrid .perf-key[data-idx="${idx}"]`);
    if (el) el.classList.add('target');
  });
}
function clearPerfTargets() {
  document.querySelectorAll('#perfGrid .perf-key').forEach(el => el.classList.remove('target', 'hit'));
}

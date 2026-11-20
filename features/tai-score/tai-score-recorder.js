/* ================================================================
   tai-score（楽譜づくり）の「弾いて録音」。
   弾いた音（音番号と、録音を始めてからの時刻ms）を記録し、止めた後に
   quantizeNoteEventsToFrames()（音声・楽譜画像・Sky Studioの読み込みと同じ量子化）で
   マスに直す。止めた時点では何も保存せず、要約と試聴を見てから
   「作る／追記する」を押した時だけ保存する（録り直し・破棄では曲データも称号の累計も変わらない）。

   置き場所は2つ:
     - 作曲画面（host='compose'）: 下の操作バーの代わりに録音パネルを出す。音のボタン（グリッド・ピアノ・
       五線譜）とキーボードで弾く。新しい曲を作るか、今の曲の末尾に追記するかを選べる。
     - フリー演奏（host='free'）: 演奏画面の下に同じパネルを出す。新しい曲を作るだけ。
   途中への上書き録音はしない（既存のマスと時刻を突き合わせる必要があるため。将来の拡張）。

   録音中は、画面の移動・曲の切り替え・モーダルを開くことができないようにし、
   それでも起きた時（ルートの移動・作曲画面を閉じる・演奏画面を閉じる）は録音を破棄する。
   ================================================================ */
import { t } from './data/i18n-score.js';
import * as S from './tai-score-state.js';
import * as A from './tai-score-audio.js';
import { RT, escapeHtml, showToast } from './tai-score-runtime.js';
import * as E from './tai-score-editor.js';

const MAX_MS = 5 * 60 * 1000;   // 5分で自動で止める
const MAX_EVENTS = 5000;        // 音が5,000個で自動で止める

let rec = null; // { host, phase, target, bpm, events, t0, tickTimer, clickTimer, result, previewTimer }
let songCreator = null;
export function registerSongCreator(fn) { songCreator = fn; }

export function isActive() { return !!rec; }
export function isRecording() { return !!rec && rec.phase === 'recording'; }
// 録音パネルが開いている間（準備・カウントイン・録音中・確認）は、ほかの操作のショートカットを止める
export function blocksShortcuts() { return !!rec; }

function panelEl() { return document.getElementById(rec && rec.host === 'free' ? 'perfRecordPanel' : 'recordPanel'); }
function hostEl() { return document.getElementById(rec && rec.host === 'free' ? 'perfOverlay' : 'composeOverlay'); }
function soundPitch() { return (RT.currentSong && RT.currentSong.pitch) || 'C'; }
function soundInstrument() {
  return rec && rec.host === 'free' ? (RT.freePlayInstrument || 'Harp') : ((RT.currentSong && RT.currentSong.instrument) || 'Harp');
}

/* ── 開く・閉じる ── */
export function open(host) {
  if (rec) return;
  if (host === 'compose' && !RT.currentSong) return;
  // モーダルが開いている間は始めない
  if (RT.containerEl && RT.containerEl.querySelector('.modal-overlay.open')) return;
  E.stopPlayback();
  rec = {
    host, phase: 'setup', target: 'new',
    bpm: (RT.currentSong && RT.currentSong.bpm) || 120,
    events: [], t0: 0, tickTimer: null, clickTimer: null, result: null, previewTimer: null,
  };
  hostEl()?.classList.add('recording');
  render();
}
// 何も保存せずに閉じる（破棄・画面の移動・曲の切り替え）
export function discard(silent) {
  if (!rec) return;
  const hadNotes = rec.events.length > 0 && rec.phase !== 'review';
  stopTimers();
  stopPreview();
  const panel = panelEl();
  hostEl()?.classList.remove('recording');
  if (panel) { panel.hidden = true; panel.innerHTML = ''; }
  rec = null;
  if (!silent && hadNotes) showToast(t('recDiscardedToast'));
}
function stopTimers() {
  if (!rec) return;
  A.cancelCountIn();
  clearInterval(rec.tickTimer); rec.tickTimer = null;
  clearTimeout(rec.clickTimer); rec.clickTimer = null;
}

/* ── 録音 ── */
function start() {
  if (!rec) return;
  if (RT.containerEl && RT.containerEl.querySelector('.modal-overlay.open')) return;
  rec.events = [];
  rec.result = null;
  const bpm = beatBpm();
  if (S.metronomeEnabled()) {
    rec.phase = 'countin';
    render();
    A.runCountIn(bpm, (beat, total) => {
      const el = document.getElementById('recCountIn');
      if (el) el.textContent = t('recCountIn', { n: total - beat + 1 });
    }, beginRecording);
  } else {
    beginRecording();
  }
}
// 録音の拍の速さ: 新しい曲はパネルのBPM、追記は今の曲の最後のマスのBPM
function beatBpm() {
  if (rec.target === 'append' && RT.currentSong) return S.effectiveBpmAtFrame(RT.currentSong, RT.currentSong.frames.length - 1);
  return Math.max(40, Math.min(999, parseInt(rec.bpm, 10) || 120));
}
function beginRecording() {
  if (!rec) return;
  rec.phase = 'recording';
  rec.t0 = performance.now();
  render();
  // メトロノームがオンなら、録音中も拍を鳴らし続ける（4拍ごとに強く）
  if (S.metronomeEnabled()) {
    const interval = 60000 / beatBpm();
    let beat = 0;
    const click = () => {
      if (!rec || rec.phase !== 'recording') return;
      A.playMetronomeClick(beat % 4 === 0);
      beat++;
      rec.clickTimer = setTimeout(click, rec.t0 + beat * interval - performance.now());
    };
    click();
  }
  rec.tickTimer = setInterval(() => {
    if (!rec || rec.phase !== 'recording') return;
    const ms = performance.now() - rec.t0;
    if (ms >= MAX_MS) { stop(t('recAutoStopTime')); return; }
    const el = document.getElementById('recClock');
    if (el) el.textContent = S.formatDuration(ms / 1000);
  }, 250);
}
// 弾いた音を受け取る。録音中でなければ false（呼び出し側がふつうの入力として扱う）
export function hit(idx) {
  if (!rec) return false;
  if (rec.phase === 'recording') {
    rec.events.push({ idx, time: Math.round(performance.now() - rec.t0) });
    const el = document.getElementById('recCount');
    if (el) el.textContent = t('recNotes', { n: rec.events.length });
    if (rec.events.length >= MAX_EVENTS) stop(t('recAutoStopNotes'));
  }
  return true; // パネルが開いている間は、音を鳴らすだけで曲は書き換えない
}
function stop(reasonToast) {
  if (!rec || rec.phase !== 'recording') return;
  stopTimers();
  rec.phase = 'review';
  rec.result = buildResult();
  render();
  if (reasonToast) showToast(reasonToast);
}
// 弾いた音をマスに直す（量子化は読み込みと同じ quantizeNoteEventsToFrames をそのまま使う）
function buildResult() {
  if (!rec.events.length) return null;
  const q = S.quantizeNoteEventsToFrames(rec.events, beatBpm(), { useLengths: S.importUseLengthsEnabled() });
  const song = { bpm: q.bpm, frames: q.frames };
  if (q.frameLengths && Object.keys(q.frameLengths).length) song.frameLengths = q.frameLengths;
  return { song, notes: rec.events.length, sec: S.songDurationSec(song) };
}

/* ── 試聴（結果のマスを、曲と同じ待ち時間で鳴らす） ── */
function togglePreview() {
  if (!rec || !rec.result) return;
  if (rec.previewTimer) { stopPreview(); render(); return; }
  const song = rec.result.song;
  let i = 0;
  const step = () => {
    if (!rec || i >= song.frames.length) { stopPreview(); render(); return; }
    A.playFrame(song.frames[i], soundPitch(), soundInstrument());
    const wait = S.frameDurationMs(song, i);
    i++;
    rec.previewTimer = setTimeout(step, wait);
  };
  rec.previewTimer = -1; // 再生中の印（最初の step の前に表示を切り替えるため）
  render();
  step();
}
function stopPreview() {
  if (!rec) return;
  if (rec.previewTimer && rec.previewTimer !== -1) clearTimeout(rec.previewTimer);
  rec.previewTimer = null;
}

/* ── 保存（ここで初めて曲データに書く） ── */
function commit() {
  if (!rec || !rec.result) return;
  stopPreview();
  const r = rec.result.song;
  if (rec.host === 'compose' && rec.target === 'append') {
    const n = E.appendRecordedFrames(r);
    discard(true);
    showToast(t('recAppendedToast', { n }));
    return;
  }
  const d = new Date();
  const pad = v => String(v).padStart(2, '0');
  const song = {
    id: S.genId(),
    name: t('recSongName', { date: `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}` }),
    bpm: r.bpm, pitch: soundPitch(), instrument: soundInstrument(),
    frames: r.frames, updatedAt: Date.now(),
  };
  if (r.frameLengths) song.frameLengths = r.frameLengths;
  discard(true);
  if (songCreator) songCreator(song);
}

/* ── パネルの描画 ── */
function render() {
  const panel = panelEl();
  if (!panel || !rec) return;
  panel.hidden = false;
  const canAppend = rec.host === 'compose';
  let body = '';
  if (rec.phase === 'setup') {
    const appendBpm = canAppend && RT.currentSong ? S.effectiveBpmAtFrame(RT.currentSong, RT.currentSong.frames.length - 1) : 0;
    body = `
      ${canAppend ? `<div class="rec-targets" role="radiogroup" aria-label="${escapeHtml(t('recTargetLabel'))}">
        <label class="rec-target"><input type="radio" name="recTarget" value="new"${rec.target === 'new' ? ' checked' : ''} data-act="rec-target"> ${escapeHtml(t('recTargetNew'))}</label>
        <label class="rec-target"><input type="radio" name="recTarget" value="append"${rec.target === 'append' ? ' checked' : ''} data-act="rec-target"> ${escapeHtml(t('recTargetAppend'))}</label>
      </div>` : ''}
      ${rec.target === 'append'
        ? `<p class="rec-hint">${escapeHtml(t('recAppendBpmHint', { bpm: appendBpm }))}</p>`
        : `<label class="rec-bpm">${escapeHtml(t('recBpmLabel'))} <input type="number" id="recBpmInput" min="40" max="999" value="${escapeHtml(String(rec.bpm))}"></label>`}
      <p class="rec-hint">${escapeHtml(t(S.metronomeEnabled() ? 'recHintMetronome' : 'recHintNoMetronome'))}</p>
      <div class="rec-actions">
        <button type="button" class="rec-btn primary" data-act="rec-start"><span class="rec-dot" aria-hidden="true"></span>${escapeHtml(t('recStartBtn'))}</button>
        <button type="button" class="rec-btn" data-act="rec-discard">${escapeHtml(t('recCancelBtn'))}</button>
      </div>`;
  } else if (rec.phase === 'countin') {
    body = `
      <p class="rec-status" id="recCountIn" aria-live="assertive">${escapeHtml(t('recCountIn', { n: 4 }))}</p>
      <div class="rec-actions"><button type="button" class="rec-btn" data-act="rec-discard">${escapeHtml(t('recCancelBtn'))}</button></div>`;
  } else if (rec.phase === 'recording') {
    body = `
      <p class="rec-status live"><span class="rec-dot" aria-hidden="true"></span>${escapeHtml(t('recNow'))} <span id="recClock">0:00</span> ・ <span id="recCount">${escapeHtml(t('recNotes', { n: rec.events.length }))}</span></p>
      <p class="rec-hint">${escapeHtml(t('recPlayHint'))}</p>
      <div class="rec-actions"><button type="button" class="rec-btn primary" data-act="rec-stop"><svg class="inline-icon" width="14" height="14"><use href="#ts-i-stop"/></svg>${escapeHtml(t('recStopBtn'))}</button></div>`;
  } else if (rec.phase === 'review') {
    const r = rec.result;
    body = r ? `
      <p class="rec-status">${escapeHtml(t('recSummary', { notes: r.notes, frames: r.song.frames.length, bpm: r.song.bpm, time: S.formatDuration(r.sec) }))}</p>
      <p class="rec-hint">${escapeHtml(t('recReviewHint'))}</p>
      <div class="rec-actions">
        <button type="button" class="rec-btn" data-act="rec-preview">${escapeHtml(t(rec.previewTimer ? 'recPreviewStop' : 'recPreviewBtn'))}</button>
        <button type="button" class="rec-btn primary" data-act="rec-commit">${escapeHtml(t(rec.host === 'compose' && rec.target === 'append' ? 'recAppendBtn' : 'recCreateBtn'))}</button>
        <button type="button" class="rec-btn" data-act="rec-retry">${escapeHtml(t('recRetryBtn'))}</button>
        <button type="button" class="rec-btn danger" data-act="rec-discard">${escapeHtml(t('recDiscardBtn'))}</button>
      </div>` : `
      <p class="rec-status">${escapeHtml(t('recNoNotes'))}</p>
      <div class="rec-actions">
        <button type="button" class="rec-btn primary" data-act="rec-retry">${escapeHtml(t('recRetryBtn'))}</button>
        <button type="button" class="rec-btn" data-act="rec-discard">${escapeHtml(t('recCancelBtn'))}</button>
      </div>`;
  }
  panel.innerHTML = `<p class="rec-title">${escapeHtml(t('recTitle'))}</p>${body}`;
  const bpmInput = document.getElementById('recBpmInput');
  if (bpmInput) bpmInput.addEventListener('input', e => { if (rec) rec.bpm = e.target.value; });
}

// view.js のクリック委譲から呼ぶ。扱ったら true
export function handleClick(act, el) {
  switch (act) {
    case 'rec-open': open(el.dataset.host || 'compose'); return true;
    case 'rec-target': if (rec) { rec.target = el.value === 'append' ? 'append' : 'new'; render(); } return true;
    case 'rec-start': start(); return true;
    case 'rec-stop': stop(); return true;
    case 'rec-preview': togglePreview(); return true;
    case 'rec-commit': commit(); return true;
    case 'rec-retry': if (rec) { stopTimers(); stopPreview(); rec.phase = 'setup'; rec.events = []; rec.result = null; render(); } return true;
    case 'rec-discard': discard(); return true;
    default: return false;
  }
}

// 画面を離れて戻った時など、裏に回ったら録音を止めて確認に進む（保存はしない）
document.addEventListener('visibilitychange', () => { if (document.hidden && isRecording()) stop(); });

/* ================================================================
   音声から楽譜を作成（Goertzelアルゴリズムによるピッチ検出）
   移植元: tai-score/index.html 行4686-4869。

   一般的な自動採譜と違い、Skyの音は常に15個の決まった音階（NOTE_MIDIを
   選んだ調で移調したもの）のどれかしか鳴らない。そのため「音声にどんな
   音が含まれるか」を広く探す必要がなく、「その15個の周波数それぞれの
   強さ」だけを効率よく求めれば十分。これにはGoertzelアルゴリズム
   （特定の周波数1つぶんのDFTだけを高速に計算する手法）を使う。
   音声（動画ファイルの場合は音声トラック）はサーバーには一切送信せず、
   すべてブラウザ内だけで処理する。
   ================================================================ */
import { NOTE_MIDI, PITCHES } from '../data/constants.js';
import { quantizeNoteEventsToFrames, importUseLengthsEnabled } from '../tai-score-state.js';

// 窓かけ済みのサンプル列に対してGoertzelアルゴリズムを実行する。
// ダイアトニック音階は「ミ→ファ」「シ→ド」の半音（隣の音との差が
// 他より小さい）があり、矩形窓のままだと隣の音との漏れ込み（スペクトル
// リーケージ）を誤検出してしまうため、事前にハン窓をかけて漏れを抑える。
function goertzelOnWindowed(windowedSamples, sampleRate, targetFreq) {
  const length = windowedSamples.length;
  const k = Math.round(length * targetFreq / sampleRate);
  const omega = (2 * Math.PI * k) / length;
  const coeff = 2 * Math.cos(omega);
  let q0 = 0, q1 = 0, q2 = 0;
  for (let i = 0; i < length; i++) {
    q0 = coeff * q1 - q2 + windowedSamples[i];
    q2 = q1;
    q1 = q0;
  }
  const real = q1 - q2 * Math.cos(omega);
  const imag = q2 * Math.sin(omega);
  return Math.sqrt(real * real + imag * imag) / length;
}
function buildHannWindow(length) {
  const win = new Float32Array(length);
  for (let i = 0; i < length; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (length - 1));
  return win;
}
function noteTargetFrequencies(pitch) {
  const pitchOffset = PITCHES.indexOf(pitch || 'C');
  return NOTE_MIDI.map(m => 440 * Math.pow(2, (m + Math.max(0, pitchOffset) - 69) / 12));
}

// opts: { file, pitch, sensitivityRatio(0-70程度), onProgress(pct, count), isCancelled() }
// opts.audioBuffer: 前回デコードした音声（あれば読み直さない）
// 戻り値: { frames, bpm, noteCount, audioBuffer（再解析で使い回す） }
export async function analyzeAudioFile(opts) {
  const { file, pitch, sensitivityValue, onProgress, isCancelled } = opts;
  const sensitivityRatio = 1 + sensitivityValue / 20; // 目安: 1.5〜5倍

  // 再解析（調や感度だけを変えてもう一度）の時は、前回デコードした音声（opts.audioBuffer）をそのまま使う。
  // 検出の処理そのものは同じで、ファイルの読み直しとデコードを省くだけ
  let audioBuffer = opts.audioBuffer || null;
  if (!audioBuffer) {
    const arrayBuffer = await file.arrayBuffer();
    const decodeCtx = new (window.AudioContext || window.webkitAudioContext)();
    try {
      audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
    } finally {
      decodeCtx.close();
    }
  }
  if (isCancelled && isCancelled()) return null;

  const sampleRate = audioBuffer.sampleRate;
  const totalSamples = audioBuffer.length;
  const chCount = audioBuffer.numberOfChannels;
  const mono = new Float32Array(totalSamples);
  for (let c = 0; c < chCount; c++) {
    const ch = audioBuffer.getChannelData(c);
    for (let i = 0; i < totalSamples; i++) mono[i] += ch[i] / chCount;
  }

  const targetFreqs = noteTargetFrequencies(pitch);
  // ダイアトニック音階の中で最も接近している「ミ-ファ」「シ-ド」の半音差
  // （約20Hz、C4付近）を確実に分離できるよう、窓を大きめ（約186ms）に取る。
  const WINDOW = 8192;
  // HOPを窓の1/8まで細かくし（75%→87.5%オーバーラップ）、タイミングの検出精度を上げる。
  const HOP = 1024;
  const HISTORY_LEN = 10;
  const REFRACTORY_SEC = 0.15;
  // 倍音は含めない：Skyの15音は2オクターブにまたがっており、ある音の
  // 2倍音は必ず1オクターブ上の別の音の基音と一致してしまうため。
  const PEER_RATIO = 0.5;
  const totalSteps = Math.max(1, Math.floor((totalSamples - WINDOW) / HOP));
  const hannWindow = buildHannWindow(WINDOW);
  const windowedBuf = new Float32Array(WINDOW);

  const history = targetFreqs.map(() => []);
  const wasAbove = targetFreqs.map(() => false);
  const lastOnsetTime = targetFreqs.map(() => -Infinity);
  const noteEvents = [];

  for (let step = 0; step < totalSteps; step++) {
    if (isCancelled && isCancelled()) return null;
    const offset = step * HOP;
    const tSec = offset / sampleRate;
    for (let i = 0; i < WINDOW; i++) windowedBuf[i] = mono[offset + i] * hannWindow[i];

    const mags = targetFreqs.map(freq => goertzelOnWindowed(windowedBuf, sampleRate, freq));
    const maxMag = Math.max(...mags);
    targetFreqs.forEach((freq, i) => {
      const mag = mags[i];
      const hist = history[i];
      hist.push(mag);
      if (hist.length > HISTORY_LEN) hist.shift();
      const baseline = hist.length >= 3 ? Math.min(...hist) : mag;
      const risingEdge = mag > baseline * sensitivityRatio + 0.0006;
      const isPeerDominant = mag > maxMag * PEER_RATIO;
      const isAbove = risingEdge && isPeerDominant;
      if (isAbove && !wasAbove[i] && (tSec - lastOnsetTime[i]) > REFRACTORY_SEC) {
        noteEvents.push({ idx: i, time: Math.round(tSec * 1000) });
        lastOnsetTime[i] = tSec;
      }
      wasAbove[i] = isAbove;
    });

    if (step % 20 === 0) {
      const pct = Math.round((step / totalSteps) * 100);
      if (onProgress) onProgress(pct, noteEvents.length);
      await new Promise(res => setTimeout(res, 0));
    }
  }
  if (isCancelled && isCancelled()) return null;
  if (onProgress) onProgress(100, noteEvents.length);

  const { frames, bpm, frameLengths, packedFrom } = quantizeNoteEventsToFrames(noteEvents, 150, { useLengths: importUseLengthsEnabled() });
  return { frames, bpm, frameLengths, packedFrom, noteCount: noteEvents.length, audioBuffer };
}

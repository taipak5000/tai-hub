/* ================================================================
   楽譜画像から楽譜を作成（簡易OMR）
   移植元: tai-score/index.html 行4871-5360。

   五線譜の画像から、①五線（横線5本の束）→②大譜表（ト音・ヘ音の2段組）
   →③符頭（音符の玉）の位置、を画像処理だけで検出し、Skyの15音
   （2オクターブ+1のダイアトニック音階）に丸め込んで自動で楽譜を作成する。

   意図的に省略している処理（移植元と同一の仕様）：
   ・臨時記号（#/♭）や調号の認識……段の位置から「自然音」として決め打ちする。
   ・符尾・連桁・付点からの正確なリズム認識……符頭のx座標の間隔をそのまま
     音の間隔とみなし、quantizeNoteEventsToFrames（音声解析と共通のGCD量子化）
     に渡すことで、大まかなタイミングだけ再現する。
   これらはOMRとしては簡易的だが、音声解析と同様「下書き」を作ることが
   目的で、完璧な変換は狙っていない。
   ================================================================ */
import { quantizeNoteEventsToFrames, importUseLengthsEnabled } from '../tai-score-state.js';
import { NOTE_MIDI } from '../data/constants.js';

export function loadImageBitmapFromFile(file) {
  if (window.createImageBitmap) return createImageBitmap(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')); };
    img.src = url;
  });
}

// 画像を二値化（インク=1／背景=0）する。白背景に黒い印刷、という前提の簡易版。
function buildInkMask(imgData, w, h) {
  const data = imgData.data;
  const gray = new Uint8Array(w * h);
  let sum = 0;
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    const g = (data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114) | 0;
    gray[i] = g;
    sum += g;
  }
  const mean = sum / gray.length;
  const threshold = mean * 0.72;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < gray.length; i++) mask[i] = gray[i] < threshold ? 1 : 0;
  return mask;
}

// 行ごとの黒画素密度を求め、その「局所的な極大値」を五線の候補行とする。
function detectStaffLineRows(mask, w, h) {
  const density = new Float64Array(h);
  for (let y = 0; y < h; y++) {
    let count = 0;
    const base = y * w;
    for (let x = 0; x < w; x++) count += mask[base + x];
    density[y] = count / w;
  }
  const WINDOW = 3;
  const MIN_DENSITY = 0.08;
  const peaks = [];
  for (let y = 0; y < h; y++) {
    if (density[y] < MIN_DENSITY) continue;
    let isPeak = true;
    for (let dy = -WINDOW; dy <= WINDOW; dy++) {
      if (dy === 0) continue;
      const ny = y + dy;
      if (ny < 0 || ny >= h) continue;
      if (density[ny] > density[y]) { isPeak = false; break; }
    }
    if (isPeak) peaks.push(y);
  }
  const filtered = [];
  for (const p of peaks) {
    if (filtered.length && p - filtered[filtered.length - 1] < 4) {
      if (density[p] > density[filtered[filtered.length - 1]]) filtered[filtered.length - 1] = p;
    } else {
      filtered.push(p);
    }
  }
  // 密度がかなり高い（＝ページ幅の半分以上を占める、本物の五線らしい）行を
  // 別途覚えておき、誤検出の五線をあとで除外するのに使う。
  const strongYs = new Set(filtered.filter(p => density[p] > 0.28));
  return { lineYs: filtered, strongYs };
}

// 検出した線（y座標の配列）を、間隔が揃った5本ずつの五線にまとめる
function groupIntoStaves(lineYs, strongYs) {
  if (lineYs.length < 4) return [];
  const gapCounts = new Map();
  for (let i = 0; i < lineYs.length; i++) {
    for (let j = i + 1; j < lineYs.length; j++) {
      const gap = lineYs[j] - lineYs[i];
      if (gap >= 40) break;
      if (gap > 3) {
        const bucket = Math.round(gap);
        gapCounts.set(bucket, (gapCounts.get(bucket) || 0) + 1);
      }
    }
  }
  if (gapCounts.size === 0) return [];
  let unit = 0, bestCount = 0;
  gapCounts.forEach((count, bucket) => { if (count > bestCount) { bestCount = count; unit = bucket; } });
  if (unit <= 3) return [];

  const TOL = Math.max(1.5, unit * 0.35);
  const used = new Array(lineYs.length).fill(false);
  const staves = [];
  for (let i = 0; i < lineYs.length; i++) {
    if (used[i]) continue;
    const base = lineYs[i];
    const matched = [{ idx: i, y: base }];
    for (let k = 1; k <= 4; k++) {
      const target = base + unit * k;
      let bestJ = -1, bestDist = TOL;
      for (let j = 0; j < lineYs.length; j++) {
        if (used[j] || j === i) continue;
        const d = Math.abs(lineYs[j] - target);
        if (d < bestDist) { bestDist = d; bestJ = j; }
      }
      matched.push(bestJ >= 0 ? { idx: bestJ, y: lineYs[bestJ] } : { idx: -1, y: target });
    }
    const realMatches = matched.filter(m => m.idx >= 0).length;
    const hasStrongLine = matched.some(m => m.idx >= 0 && strongYs && strongYs.has(m.y));
    if (realMatches >= 4 && hasStrongLine) {
      matched.forEach(m => { if (m.idx >= 0) used[m.idx] = true; });
      const lines = matched.map(m => m.y);
      staves.push({ lines, lineSpacing: unit, top: lines[0], bottom: lines[4] });
    }
  }
  return staves;
}

// 隣り合う五線同士の間隔が近ければ、大譜表（ト音+ヘ音）としてペアにする
function pairStavesIntoSystems(staves) {
  const systems = [];
  let i = 0;
  while (i < staves.length) {
    const treble = staves[i];
    const next = staves[i + 1];
    if (next) {
      const gap = next.top - treble.bottom;
      const avgSpacing = (treble.lineSpacing + next.lineSpacing) / 2;
      if (gap > 0 && gap < avgSpacing * 8) {
        systems.push({ treble, bass: next, top: treble.top, bottom: next.bottom, lineSpacing: avgSpacing });
        i += 2;
        continue;
      }
    }
    systems.push({ treble, bass: null, top: treble.top, bottom: treble.bottom, lineSpacing: treble.lineSpacing });
    i += 1;
  }
  return systems;
}

// 五線そのもの（細い横線）だけを消す。符頭が線に重なっている場合、その列だけ
// 縦方向に太い（符頭の分厚みがある）ので、太い部分は消さずに残す。
function eraseThinStaffLines(mask, w, h, lineYs) {
  const cleaned = mask.slice();
  const rowSet = new Set();
  lineYs.forEach(y => { for (let dy = -1; dy <= 1; dy++) rowSet.add(Math.round(y) + dy); });
  rowSet.forEach(y => {
    if (y < 0 || y >= h) return;
    const base = y * w;
    for (let x = 0; x < w; x++) {
      const idx = base + x;
      if (!mask[idx]) continue;
      let thickness = 1;
      let top = y - 1;
      while (top >= 0 && mask[top * w + x] && thickness <= 3) { thickness++; top--; }
      let bottom = y + 1;
      while (bottom < h && mask[bottom * w + x] && thickness <= 3) { thickness++; bottom++; }
      if (thickness <= 3) cleaned[idx] = 0;
    }
  });
  return cleaned;
}

// 4近傍の連結成分（ラベリング）を、指定したy範囲内だけ走査して求める
function findConnectedComponents(mask, w, h, minY, maxY) {
  const visited = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const components = [];
  const yStart = Math.max(0, Math.floor(minY));
  const yEnd = Math.min(h - 1, Math.ceil(maxY));
  for (let y = yStart; y <= yEnd; y++) {
    for (let x = 0; x < w; x++) {
      const start = y * w + x;
      if (!mask[start] || visited[start]) continue;
      let sp = 0;
      stack[sp++] = start;
      visited[start] = 1;
      let minX = x, maxX = x, minYc = y, maxYc = y, count = 0;
      while (sp > 0) {
        const idx = stack[--sp];
        count++;
        const cx = idx % w, cy = (idx / w) | 0;
        if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
        if (cy < minYc) minYc = cy; if (cy > maxYc) maxYc = cy;
        if (cx > 0 && mask[idx - 1] && !visited[idx - 1]) { visited[idx - 1] = 1; stack[sp++] = idx - 1; }
        if (cx < w - 1 && mask[idx + 1] && !visited[idx + 1]) { visited[idx + 1] = 1; stack[sp++] = idx + 1; }
        if (cy > 0 && mask[idx - w] && !visited[idx - w]) { visited[idx - w] = 1; stack[sp++] = idx - w; }
        if (cy < h - 1 && mask[idx + w] && !visited[idx + w]) { visited[idx + w] = 1; stack[sp++] = idx + w; }
      }
      components.push({ minX, maxX, minY: minYc, maxY: maxYc, area: count });
    }
  }
  return components;
}

// 符頭らしい形（線間隔に対してだいたい正方形で、ある程度塗りつぶされている）かを判定する
function isNoteheadShape(c, lineSpacing) {
  const minSize = lineSpacing * 0.55, maxSize = lineSpacing * 2.4;
  if (c.w < minSize || c.w > maxSize) return false;
  if (c.h < minSize || c.h > maxSize) return false;
  const fill = c.area / (c.w * c.h);
  if (fill < 0.22) return false;
  const aspect = c.w / c.h;
  if (aspect < 0.45 || aspect > 2.4) return false;
  return true;
}

// 五線上のy座標（符頭の中心）から、自然音のMIDI番号を求める（#/♭は見ない）
function staffPositionToMidi(staff, clef, cy) {
  const NATURAL_SEMITONES = [0, 2, 4, 5, 7, 9, 11]; // C,D,E,F,G,A,B
  const baseMidi = clef === 'bass' ? 43 : 64; // ヘ音記号=ソ(G2) ／ ト音記号=ミ(E4)
  const baseLetterIdx = NATURAL_SEMITONES.indexOf(((baseMidi % 12) + 12) % 12);
  const baseOctave = Math.floor(baseMidi / 12) - 1;
  const halfStep = staff.lineSpacing / 2;
  const stepsFromBottomLine = Math.round((staff.bottom - cy) / halfStep);
  let letterIdx = baseLetterIdx + stepsFromBottomLine;
  const octave = baseOctave + Math.floor(letterIdx / 7);
  letterIdx = ((letterIdx % 7) + 7) % 7;
  return (octave + 1) * 12 + NATURAL_SEMITONES[letterIdx];
}

// 任意のMIDI番号を、Skyの15音（NOTE_MIDI、2オクターブ+1のダイアトニック）に
// オクターブ単位で丸め込む。音域からはみ出す音は無理やり上げ下げして最も近い音に割り当てる。
export function midiToSkyIndex(midi) {
  let m = midi;
  while (m < NOTE_MIDI[0]) m += 12;
  while (m > NOTE_MIDI[NOTE_MIDI.length - 1]) m -= 12;
  let best = 0, bestDist = Infinity;
  for (let i = 0; i < NOTE_MIDI.length; i++) {
    const d = Math.abs(NOTE_MIDI[i] - m);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

// 1システム（ト音+ヘ音、または単段）分の符頭を、x座標の近さで和音にまとめる
function buildSystemChords(sys, noteheads) {
  if (noteheads.length === 0) return { chords: [] };
  noteheads.forEach(nh => {
    let staff = sys.treble, clef = 'treble';
    if (sys.bass) {
      const dT = nh.cy < sys.treble.top ? sys.treble.top - nh.cy : (nh.cy > sys.treble.bottom ? nh.cy - sys.treble.bottom : 0);
      const dB = nh.cy < sys.bass.top ? sys.bass.top - nh.cy : (nh.cy > sys.bass.bottom ? nh.cy - sys.bass.bottom : 0);
      if (dB < dT) { staff = sys.bass; clef = 'bass'; }
    }
    nh.skyIdx = midiToSkyIndex(staffPositionToMidi(staff, clef, nh.cy));
  });

  const sorted = noteheads.slice().sort((a, b) => a.cx - b.cx);
  const CHORD_X_TOL = sys.lineSpacing * 0.9;
  const chords = [];
  sorted.forEach(nh => {
    const last = chords[chords.length - 1];
    if (last && nh.cx - last.cxSum / last.count <= CHORD_X_TOL) {
      last.indices.add(nh.skyIdx);
      last.cxSum += nh.cx; last.count++;
    } else {
      chords.push({ cxSum: nh.cx, count: 1, indices: new Set([nh.skyIdx]) });
    }
  });
  const originX = sorted[0].cx;
  chords.forEach(ch => {
    ch.xUnit = (ch.cxSum / ch.count - originX) / sys.lineSpacing;
    ch.indices = [...ch.indices];
  });
  return { chords };
}

// 画像1枚（1ページ）分を解析し、システムごとの和音列を返す
function analyzeSheetImage(bitmap) {
  // 五線検出は行ごとの黒画素密度を見るため、解像度が低いと線が細すぎて
  // アンチエイリアスに埋もれ検出を取りこぼす。小さい画像は逆に拡大しておく。
  const MAX_DIM = 2000;
  const MIN_DIM = 1400;
  const srcW = bitmap.width, srcH = bitmap.height;
  const longest = Math.max(srcW, srcH);
  const scale = longest > MAX_DIM ? MAX_DIM / longest : (longest < MIN_DIM ? MIN_DIM / longest : 1);
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);

  const mask = buildInkMask(imgData, w, h);
  const { lineYs, strongYs } = detectStaffLineRows(mask, w, h);
  const staves = groupIntoStaves(lineYs, strongYs);
  if (staves.length === 0) return { systems: [] };
  const systems = pairStavesIntoSystems(staves);
  const cleanedMask = eraseThinStaffLines(mask, w, h, lineYs);

  const overallLS = systems.reduce((a, s) => a + s.lineSpacing, 0) / systems.length;
  const bandTop = systems[0].top - overallLS * 6;
  const bandBottom = systems[systems.length - 1].bottom + overallLS * 6;
  const components = findConnectedComponents(cleanedMask, w, h, bandTop, bandBottom);

  const noteheads = components
    .map(c => ({
      minX: c.minX, maxX: c.maxX, minY: c.minY, maxY: c.maxY, area: c.area,
      w: c.maxX - c.minX + 1, h: c.maxY - c.minY + 1,
      cx: (c.minX + c.maxX) / 2, cy: (c.minY + c.maxY) / 2,
    }))
    .filter(c => isNoteheadShape(c, overallLS));

  const buckets = systems.map(() => []);
  noteheads.forEach(nh => {
    let bestIdx = -1, bestDist = Infinity;
    systems.forEach((sys, si) => {
      const bandT = sys.top - sys.lineSpacing * 6, bandB = sys.bottom + sys.lineSpacing * 6;
      if (nh.cy >= bandT && nh.cy <= bandB) {
        const dist = nh.cy < sys.top ? sys.top - nh.cy : (nh.cy > sys.bottom ? nh.cy - sys.bottom : 0);
        if (dist < bestDist) { bestDist = dist; bestIdx = si; }
      }
    });
    if (bestIdx >= 0) buckets[bestIdx].push(nh);
  });

  const resultSystems = systems.map((sys, si) => buildSystemChords(sys, buckets[si]));
  return { systems: resultSystems };
}

// opts: { files: File[], onProgress(page, total), isCancelled() }
// 戻り値: { frames, bpm, pagesOk } | null（画像を1枚も解析できなかった場合はpagesOk===0、
// 五線・音符が検出できなかった場合はfarmes/bpmを持たずpagesOk>0の結果を返す）
export async function analyzeImageFiles(opts) {
  const { files, onProgress, isCancelled } = opts;
  const sortedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name, 'ja', { numeric: true, sensitivity: 'base' }));

  const allNotes = []; // {idx, xUnit}
  let timeOffset = 0;
  let pagesOk = 0;

  for (let pageIdx = 0; pageIdx < sortedFiles.length; pageIdx++) {
    if (isCancelled && isCancelled()) return null;
    if (onProgress) onProgress(pageIdx + 1, sortedFiles.length);
    await new Promise(r => setTimeout(r, 0));

    let bitmap;
    try {
      bitmap = await loadImageBitmapFromFile(sortedFiles[pageIdx]);
    } catch (e) {
      continue;
    }
    let pageResult;
    try {
      pageResult = analyzeSheetImage(bitmap);
    } catch (e) {
      continue;
    }
    pagesOk++;

    pageResult.systems.forEach(system => {
      if (system.chords.length === 0) return;
      system.chords.forEach(ch => {
        ch.indices.forEach(idx => allNotes.push({ time: timeOffset + ch.xUnit, idx }));
      });
      const lastXUnit = system.chords[system.chords.length - 1].xUnit;
      // 段の切れ目：譜面上は続きの音楽なので、大きな間は空けない。間隔はその段自体の
      // 音符間隔（中央値）を使う（曲によって音符の密度がまちまちなため）。
      const xGaps = [];
      for (let i = 1; i < system.chords.length; i++) xGaps.push(system.chords[i].xUnit - system.chords[i - 1].xUnit);
      xGaps.sort((a, b) => a - b);
      const typicalGap = xGaps.length ? xGaps[Math.floor(xGaps.length / 2)] : 3;
      timeOffset += lastXUnit + Math.max(1, typicalGap);
    });
  }

  if (isCancelled && isCancelled()) return null;
  if (allNotes.length === 0) return { frames: null, bpm: null, pagesOk, firstFileName: sortedFiles[0] && sortedFiles[0].name };

  // 符頭のx座標は画素単位で検出しているため、本来同じタイミングの音でも1px程度の
  // 揺れが乗る。そこで先に「曲全体の代表的な間隔（中央値寄りのパーセンタイル）」を
  // 1マスとみなし、各和音をその整数倍の位置へスナップしてから量子化に渡す。
  const chordTimeMap = new Map();
  allNotes.forEach(n => {
    if (!chordTimeMap.has(n.time)) chordTimeMap.set(n.time, new Set());
    chordTimeMap.get(n.time).add(n.idx);
  });
  const sortedTimes = [...chordTimeMap.keys()].sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < sortedTimes.length; i++) gaps.push(sortedTimes[i] - sortedTimes[i - 1]);
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const unitGap = sortedGaps.length ? sortedGaps[Math.floor(sortedGaps.length * 0.2)] : 0;
  const unit = unitGap > 0 ? unitGap : 1;

  const tickMap = new Map();
  const t0 = sortedTimes[0] || 0;
  sortedTimes.forEach(tt => {
    const tick = Math.round((tt - t0) / unit);
    if (!tickMap.has(tick)) tickMap.set(tick, new Set());
    chordTimeMap.get(tt).forEach(idx => tickMap.get(tick).add(idx));
  });

  // quantizeNoteEventsToFrames は実時間(ms)を前提に20ms未満の間隔を丸めてしまうため、
  // スナップ後の1マスを100単位として十分大きくスケールしてから渡す
  const notesForQuantize = [];
  tickMap.forEach((indices, tick) => { indices.forEach(idx => notesForQuantize.push({ idx, time: tick * 100 })); });
  const { frames, bpm, frameLengths, packedFrom } = quantizeNoteEventsToFrames(notesForQuantize, 150, { useLengths: importUseLengthsEnabled() });
  return { frames, bpm, frameLengths, packedFrom, pagesOk, firstFileName: sortedFiles[0] && sortedFiles[0].name };
}

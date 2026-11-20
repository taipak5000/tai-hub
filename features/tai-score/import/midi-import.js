/* ================================================================
   MIDIファイル（標準MIDIファイル/SMF）から楽譜を作成
   移植元: tai-score/index.html 行5362-5658。

   外部ライブラリは使わず、ArrayBufferのバイト列からフォーマット0/1/2の
   SMFを直接パースする（ヘッダーチャンク＋MTrkチャンク群、可変長数値
   （VLQ）のデルタタイム、ランニングステータス、テンポ／トラック名の
   メタイベントに対応）。RIFFで包んだMIDI（.rmi）も中のSMFを取り出して読む。

   演奏の録音や音声から自動で書き起こしたMIDI（例: ピアノ＋ギター＋ストリングス＋ベースの
   複数トラックで、音の位置が拍にそろっていないもの）も読めるように、次のようにしている:
   ・inspectMidiFile() がトラック（＋チャンネル）ごとの「パート」を一覧にし、画面で使うパートを選べる。
     低音のパート（ベース系の音色・平均の音高が低いもの）は既定で外す（2オクターブに折り返すと伴奏で埋まるため）。
   ・最初の音の前の無音を詰め、グリッドは最初の音を起点に合わせる（拍頭が0tickでないファイルでずれないように）。
   ・曲名は先頭トラック（フォーマット1ではテンポ等を持つ指揮トラック）の名前か、ファイル名から取る。
     楽器のトラック名（「Acoustic Piano」など）は曲名にしない。
   ================================================================ */
import { midiToSkyIndex } from './image-import.js';
import { NOTE_MIDI, PITCHES } from '../data/constants.js';
import { genId, compressWithLengths } from '../tai-score-state.js';

function midiError(msgKey) {
  const err = new Error(msgKey);
  err.midiUserMessage = msgKey;
  return err;
}
function readUint32(bytes, pos) {
  return ((bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3]) >>> 0;
}
function readUint16(bytes, pos) {
  return (bytes[pos] << 8) | bytes[pos + 1];
}
// 可変長数値（Variable Length Quantity）：各バイトの上位1bitが継続フラグ、下位7bitが値
function readVarLen(bytes, pos, limit) {
  let value = 0, b, count = 0;
  do {
    if (pos >= limit || count++ > 5) throw midiError('midiParseFailed');
    b = bytes[pos++];
    value = (value << 7) | (b & 0x7f);
  } while (b & 0x80);
  return [value >>> 0, pos];
}
function decodeMidiText(byteSubarray) {
  try { return new TextDecoder('utf-8').decode(byteSubarray).trim(); } catch (e) { return ''; }
}

// RIFF形式のMIDI（RMID）なら、中の"data"チャンクのSMFを取り出す
function unwrapRiffMidi(bytes) {
  const tag = (pos) => String.fromCharCode(bytes[pos], bytes[pos + 1], bytes[pos + 2], bytes[pos + 3]);
  if (bytes.length < 20 || tag(0) !== 'RIFF' || tag(8) !== 'RMID') return bytes;
  let pos = 12;
  while (pos + 8 <= bytes.length) {
    const len = (bytes[pos + 4] | (bytes[pos + 5] << 8) | (bytes[pos + 6] << 16) | (bytes[pos + 7] << 24)) >>> 0;
    if (tag(pos) === 'data') return bytes.subarray(pos + 8, Math.min(bytes.length, pos + 8 + len));
    pos += 8 + len + (len & 1);
  }
  return bytes;
}
// MIDIでないファイル（音声・動画など）を選んだ時に、別の読み込み方を案内するための判定
function looksLikeAudioOrVideo(bytes) {
  const s = String.fromCharCode(...bytes.subarray(0, 12));
  return s.startsWith('ID3') || (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) || s.startsWith('OggS') || s.startsWith('fLaC')
    || (s.startsWith('RIFF') && s.slice(8, 12) === 'WAVE') || s.slice(4, 8) === 'ftyp' || (bytes[0] === 0x1A && bytes[1] === 0x45);
}

function parseMidiHeader(bytes) {
  if (bytes.length < 14) throw midiError('midiParseFailed');
  if (bytes[0] !== 0x4D || bytes[1] !== 0x54 || bytes[2] !== 0x68 || bytes[3] !== 0x64) throw midiError('midiParseFailed'); // "MThd"
  const headerLen = readUint32(bytes, 4);
  const format = readUint16(bytes, 8);
  const trackCount = readUint16(bytes, 10);
  const divisionRaw = readUint16(bytes, 12);
  let ticksPerQuarter = null, smpte = null;
  if (divisionRaw & 0x8000) {
    // SMPTEタイムコード形式（映像同期用途などで稀に使われる）
    const framesPerSecond = (256 - ((divisionRaw >> 8) & 0xFF)) || 30;
    const ticksPerFrame = (divisionRaw & 0xFF) || 4;
    smpte = { framesPerSecond, ticksPerFrame };
  } else {
    ticksPerQuarter = divisionRaw & 0x7FFF;
  }
  if (!smpte && ticksPerQuarter <= 0) throw midiError('midiParseFailed');
  return { format, trackCount, ticksPerQuarter, smpte, headerEnd: 8 + headerLen };
}

// 1トラック（MTrkチャンクの中身）をイベント列にパースする。
function parseMidiTrackEvents(bytes, start, end) {
  const events = [];
  let pos = start, tick = 0, runningStatus = 0;
  while (pos < end) {
    let delta;
    [delta, pos] = readVarLen(bytes, pos, end);
    tick += delta;
    if (pos >= end) break;

    let statusByte = bytes[pos];
    if (statusByte & 0x80) {
      pos++;
      if (statusByte < 0xF0) runningStatus = statusByte;
    } else {
      statusByte = runningStatus;
      if (!statusByte) break;
    }

    if (statusByte === 0xFF) {
      if (pos >= end) break;
      const metaType = bytes[pos++];
      let len; [len, pos] = readVarLen(bytes, pos, end);
      const dataStart = pos, dataEnd = pos + len;
      if (dataEnd > end) break;
      if (metaType === 0x51 && len >= 3) {
        events.push({ tick, type: 'tempo', usPerQuarter: (bytes[dataStart] << 16) | (bytes[dataStart + 1] << 8) | bytes[dataStart + 2] });
      } else if (metaType === 0x03) {
        events.push({ tick, type: 'trackName', text: decodeMidiText(bytes.subarray(dataStart, dataEnd)) });
      }
      pos = dataEnd;
    } else if (statusByte === 0xF0 || statusByte === 0xF7) {
      let len; [len, pos] = readVarLen(bytes, pos, end);
      pos += len;
    } else if (statusByte >= 0x80 && statusByte <= 0xEF) {
      const type = statusByte & 0xF0, channel = statusByte & 0x0F;
      if (pos >= end) break;
      const d1 = bytes[pos++];
      if (type === 0xC0 || type === 0xD0) {
        // プログラムチェンジ／チャンネルアフタータッチ：データ1バイトのみ。音色はパートの既定選択に使う
        if (type === 0xC0) events.push({ tick, type: 'program', program: d1, channel });
      } else {
        if (pos >= end) break;
        const d2 = bytes[pos++];
        if (type === 0x90 && d2 > 0) events.push({ tick, type: 'noteOn', note: d1, channel }); // velocity 0のノートオンはノートオフ扱い
      }
    } else {
      break; // 未知のステータスバイト：これ以上安全に読み進められない
    }
  }
  return events;
}

function parseMidiFile(arrayBuffer) {
  const bytes = unwrapRiffMidi(new Uint8Array(arrayBuffer));
  if (!(bytes[0] === 0x4D && bytes[1] === 0x54 && bytes[2] === 0x68 && bytes[3] === 0x64) && looksLikeAudioOrVideo(bytes)) {
    throw midiError('midiNotMidiFile');
  }
  const header = parseMidiHeader(bytes);
  const tracks = [];
  let pos = header.headerEnd;
  while (pos + 8 <= bytes.length) {
    const id = String.fromCharCode(bytes[pos], bytes[pos + 1], bytes[pos + 2], bytes[pos + 3]);
    const len = readUint32(bytes, pos + 4);
    const dataStart = pos + 8, dataEnd = dataStart + len;
    if (dataEnd > bytes.length) break;
    if (id === 'MTrk') tracks.push(parseMidiTrackEvents(bytes, dataStart, dataEnd));
    pos = dataEnd;
  }
  if (tracks.length === 0) throw midiError('midiParseFailed');
  return { format: header.format, ticksPerQuarter: header.ticksPerQuarter, smpte: header.smpte, tracks };
}

function mapMidiNoteToSkyIndex(midiNote) { return midiToSkyIndex(midiNote); }

// 区間の長さ（tick）で重み付けした平均テンポ（マイクロ秒/4分音符）を求める。
function averageMidiTempo(tempoEvents, endTick) {
  if (tempoEvents.length === 0) return 500000; // デフォルト 120BPM
  const points = [];
  tempoEvents.forEach(te => {
    if (points.length && points[points.length - 1].tick === te.tick) points[points.length - 1].usPerQuarter = te.usPerQuarter;
    else points.push({ tick: te.tick, usPerQuarter: te.usPerQuarter });
  });
  if (points[0].tick > 0) points.unshift({ tick: 0, usPerQuarter: points[0].usPerQuarter });
  let total = 0, weighted = 0;
  for (let i = 0; i < points.length; i++) {
    const segStart = points[i].tick;
    const segEnd = i + 1 < points.length ? points[i + 1].tick : Math.max(endTick, segStart);
    const segLen = Math.max(0, segEnd - segStart);
    total += segLen;
    weighted += segLen * points[i].usPerQuarter;
  }
  return total > 0 ? weighted / total : points[0].usPerQuarter;
}

// トラック（＋チャンネル）ごとのパート一覧。フォーマット0は1トラックに全チャンネルが入るので、チャンネルで分ける。
// channel 9（表記上のMIDIチャンネル10）はGM規格上のドラム専用チャンネルのため対象外。
function collectParts(midi) {
  const parts = new Map();
  midi.tracks.forEach((events, trackIndex) => {
    let trackName = '';
    const programByCh = {};
    events.forEach(ev => {
      if (ev.type === 'trackName' && !trackName && ev.text) trackName = ev.text;
      else if (ev.type === 'program' && programByCh[ev.channel] === undefined) programByCh[ev.channel] = ev.program;
      else if (ev.type === 'noteOn' && ev.channel !== 9 && ev.note >= 0 && ev.note <= 127) {
        const id = `${trackIndex}:${ev.channel}`;
        if (!parts.has(id)) parts.set(id, { id, trackIndex, channel: ev.channel, trackName: '', program: null, notes: [] });
        parts.get(id).notes.push({ tick: ev.tick, note: ev.note });
      }
    });
    parts.forEach(p => {
      if (p.trackIndex !== trackIndex) return;
      p.trackName = trackName;
      if (programByCh[p.channel] !== undefined) p.program = programByCh[p.channel];
    });
  });
  const list = [...parts.values()];
  list.forEach(p => {
    p.noteCount = p.notes.length;
    p.avgNote = p.notes.reduce((a, n) => a + n.note, 0) / Math.max(1, p.notes.length);
    // GMの32〜39番はベース系の音色。音色が分からなくても平均の音高がE2付近より低ければ低音のパートとみなす
    p.isBass = (p.program !== null && p.program >= 32 && p.program <= 39) || p.avgNote < 45;
  });
  // 低音のパートは既定で外す。ただし低音のパートしか無い時は全部使う
  const hasMelodic = list.some(p => !p.isBass);
  list.forEach(p => { p.defaultOn = hasMelodic ? !p.isBass : true; });
  return list;
}

// 曲名: 先頭トラックの名前（フォーマット1では指揮トラック。楽器名のトラックとは別）か、ファイル名。
// ファイル名の「.solo-piano」のような後ろの区切りも外す（例: recording-20261115.solo-piano.mid → recording-20261115）。
function songNameFor(midi, fileName, t) {
  const firstName = (midi.tracks[0] || []).find(ev => ev.type === 'trackName' && ev.text);
  const firstHasNotes = (midi.tracks[0] || []).some(ev => ev.type === 'noteOn');
  if (firstName && (midi.format === 0 || !firstHasNotes || midi.tracks.length === 1)) {
    const nm = firstName.text.trim();
    // フォーマット0や1トラックだけのファイルでは、トラック名が楽器名のことも多い
    if (nm && !(midi.tracks.length === 1 && /piano|guitar|bass|string|violin|flute|synth|organ|harp|track/i.test(nm))) return nm;
  }
  const base = (fileName || '').replace(/\.(mid|midi|rmi|kar|smf)$/i, '').replace(/(\.[A-Za-z][\w-]*)+$/, '').trim();
  return base || t('midiDefaultSongName');
}

// 音の間隔をマスの長さで詰める処理（compressWithLengths）は、ほかの読み込みと共通で tai-score-state.js にある
/* ── 調のおすすめ ──
   Skyの楽器は、調を P にすると15音が NOTE_MIDI＋（P の半音数）で鳴る。だから MIDI の音 m を調 P で置くと、
   m −（P の半音数）を C の15音に当てはめることになる。12の調それぞれで
     - fit: そのまま（半音の寄せなしで）音階に乗る音の割合
     - folds: 15音の音域から外れて、オクターブで折り返す音の数
   を数え、fit が高い順、同じなら folds が少ない順、それも同じなら C に近い順（PITCHES の並び）で並べる。
   C の時の当てはめ方は従来と同じ（m をそのまま midiToSkyIndex に渡す）なので、C を選べば結果は変わらない。 */
const DIATONIC = new Set([0, 2, 4, 5, 7, 9, 11]);
function selectedNoteNumbers(midi, partIds) {
  const parts = collectParts(midi);
  const useIds = partIds ? new Set(partIds) : new Set(parts.filter(p => p.defaultOn).map(p => p.id));
  return parts.filter(p => useIds.has(p.id)).flatMap(p => p.notes.map(n => n.note));
}
export function suggestKeys(midi, partIds) {
  const notes = selectedNoteNumbers(midi, partIds);
  const total = notes.length || 1;
  const lo = NOTE_MIDI[0], hi = NOTE_MIDI[NOTE_MIDI.length - 1];
  return PITCHES.map((pitch, offset) => {
    let fit = 0, folds = 0;
    notes.forEach(n => {
      const m = n - offset;
      if (DIATONIC.has(((m % 12) + 12) % 12)) fit++;
      if (m < lo || m > hi) folds++;
    });
    return { pitch, offset, fit: fit / total, snaps: notes.length - fit, folds };
  }).sort((a, b) => (b.fit - a.fit) || (a.folds - b.folds) || (a.offset - b.offset));
}

function midiToSong(midi, fileName, t, partIds, opts = {}) {
  // 調（opts.pitch）。省略時は従来どおり C
  const pitch = PITCHES.includes(opts.pitch) ? opts.pitch : 'C';
  const keyOffset = PITCHES.indexOf(pitch);
  let ticksPerQuarter = midi.ticksPerQuarter;
  if (!ticksPerQuarter) {
    const ticksPerSecond = midi.smpte.framesPerSecond * midi.smpte.ticksPerFrame;
    ticksPerQuarter = Math.max(1, Math.round(ticksPerSecond * 0.5));
  }

  const tempoEvents = [];
  midi.tracks.forEach(events => events.forEach(ev => {
    if (ev.type === 'tempo') tempoEvents.push({ tick: ev.tick, usPerQuarter: ev.usPerQuarter });
  }));
  const parts = collectParts(midi);
  const useIds = partIds ? new Set(partIds) : new Set(parts.filter(p => p.defaultOn).map(p => p.id));
  const noteOnEvents = parts.filter(p => useIds.has(p.id)).flatMap(p => p.notes);
  if (noteOnEvents.length === 0) throw midiError('midiNoNotesFound');

  tempoEvents.sort((a, b) => a.tick - b.tick);
  // 最初の音の前の無音を詰める（録音由来のMIDIは頭に数百tickの「間」があることが多い）。グリッドもここを起点にする
  const firstTick = noteOnEvents.reduce((m, ev) => Math.min(m, ev.tick), Infinity);
  const maxTick = noteOnEvents.reduce((m, ev) => Math.max(m, ev.tick), 0) - firstTick;
  const usPerQuarter = averageMidiTempo(tempoEvents, maxTick + firstTick);

  // 16分音符ぶんのグリッドへスナップ。曲が長い／密な場合やテンポが安全範囲
  // （40〜999 BPM）を超える場合は8分音符→4分音符→2分音符の順に粗くする。
  const FRAME_CAP = 3000;
  const BPM_MIN = 40, BPM_MAX = 999;
  const gridCandidates = [ticksPerQuarter / 4, ticksPerQuarter / 2, ticksPerQuarter, ticksPerQuarter * 2];
  const rawBpmForGrid = (ticks) => {
    const ms = (usPerQuarter / 1000) * (ticks / ticksPerQuarter);
    return ms > 0 ? 60000 / ms : BPM_MAX;
  };
  let gridTicks = Math.max(1, Math.round(gridCandidates[0]));
  let maxFrameIndex = Math.round(maxTick / gridTicks);
  let rawBpm = rawBpmForGrid(gridTicks);
  for (let i = 1; i < gridCandidates.length && (maxFrameIndex > FRAME_CAP || rawBpm > BPM_MAX); i++) {
    gridTicks = Math.max(1, Math.round(gridCandidates[i]));
    maxFrameIndex = Math.round(maxTick / gridTicks);
    rawBpm = rawBpmForGrid(gridTicks);
  }

  const frameNotes = new Map();
  noteOnEvents.forEach(ev => {
    const skyIndex = mapMidiNoteToSkyIndex(ev.note - keyOffset);
    const frameIndex = Math.round((ev.tick - firstTick) / gridTicks);
    if (!frameNotes.has(frameIndex)) frameNotes.set(frameIndex, new Set());
    frameNotes.get(frameIndex).add(skyIndex);
  });
  if (frameNotes.size === 0) throw midiError('midiNoNotesFound');

  const totalFrames = Math.max(1, maxFrameIndex + 1);
  const frames = [];
  for (let i = 0; i < totalFrames; i++) {
    frames.push(frameNotes.has(i) ? [...frameNotes.get(i)].sort((a, b) => a - b) : []);
  }

  const name = songNameFor(midi, fileName, t);

  // マスの長さで詰める（既定）: 1拍＝4分音符にして、元のテンポのまま鳴らす。
  // 4分音符のテンポが再生できる範囲（40〜999 BPM）を外れる時だけ、従来の詰めない作り方にする
  const quarterBpm = 60000 / (usPerQuarter / 1000);
  if (opts.useLengths !== false && quarterBpm >= BPM_MIN && quarterBpm <= BPM_MAX) {
    const packed = compressWithLengths(frames, gridTicks / ticksPerQuarter);
    const song = { id: genId(), name, bpm: Math.round(quarterBpm), pitch, instrument: 'Harp', frames: packed.frames, updatedAt: Date.now() };
    if (Object.keys(packed.frameLengths).length) song.frameLengths = packed.frameLengths;
    return { song, tempoAdjusted: false, packedFrom: frames.length };
  }

  const tempoAdjusted = rawBpm > BPM_MAX || rawBpm < BPM_MIN;
  const bpm = Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(rawBpm)));

  return {
    song: { id: genId(), name, bpm, pitch, instrument: 'Harp', frames, updatedAt: Date.now() },
    tempoAdjusted,
  };
}

// 画面でパートを選ぶための下調べ。戻り値: { midi, parts: [{ id, label, noteCount, isBass, defaultOn }] }
// label はトラック名（無ければ「トラックn」）。同じトラックに複数チャンネルがある時はチャンネル番号を添える。
export function inspectMidiFile(arrayBuffer, t) {
  const midi = parseMidiFile(arrayBuffer);
  const parts = collectParts(midi);
  if (parts.length === 0) throw midiError('midiNoNotesFound');
  const perTrack = {};
  parts.forEach(p => { perTrack[p.trackIndex] = (perTrack[p.trackIndex] || 0) + 1; });
  return {
    midi,
    parts: parts.map(p => ({
      id: p.id,
      label: (p.trackName || t('midiTrackLabel', { n: p.trackIndex + 1 })) + (perTrack[p.trackIndex] > 1 ? ` (ch ${p.channel + 1})` : ''),
      noteCount: p.noteCount, isBass: p.isBass, defaultOn: p.defaultOn,
    })),
  };
}

// inspectMidiFile() の結果から、選んだパートだけで楽譜を作る
// opts.useLengths: false で、音の間を空のマスで埋める従来の作り方にする（既定は長さで詰める）
export function buildSongFromMidi(midi, fileName, t, partIds, opts) {
  return midiToSong(midi, fileName, t, partIds, opts);
}

// t: i18n-score.jsのt(key,vars)（曲名デフォルト値の生成に使う）。
// 戻り値: { song, tempoAdjusted } / 失敗時は err.midiUserMessage を持つErrorをthrowする
export async function convertMidiFile(arrayBuffer, fileName, t, opts) {
  const midi = parseMidiFile(arrayBuffer);
  return midiToSong(midi, fileName, t, null, opts);
}

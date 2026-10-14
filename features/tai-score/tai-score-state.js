/* ================================================================
   tai-score（楽譜づくり）のデータ層。DOMに一切触れない、localStorageの
   読み書き・純粋な計算関数・各種ファイル形式との相互変換だけをここに
   集約する（UIの組み立て・イベント配線は tai-score-view.js / -editor.js /
   -perf.js）。

   移植元: tai-score/index.html のIIFE内、曲データ・称号・ライブラリ並び順・
   キー割り当て・入力方法/表示方法設定・フレームクリップボード・
   メトロノーム/ノースクロール設定・BPMオーバーライド・テキスト譜面・
   Sky Music Nightly(Specy)形式・旧Sky Studio形式・共有コード(gzip+Base64)
   まわりの関数群（~行2212-4485・4608-4657あたり）。

   ⚠️ localStorageキー名は元のものと完全に一致させている。ただし、このツール
   （tai-score）は移植元にプロフィール機構が一切無く、フラットなグローバル
   キーだったため、tai-hubへの移植にあたり全キーを共有のnsKey()でラップする
   （プロジェクト全体の方針として決定済み。他の移植済みツールと同じ扱い）。
   nsKeyFor()は既定プロフィールに対しては元のキー名をそのまま返すため、
   既存ユーザーのデータ（＝既定プロフィール相当）は無改修でそのまま読める。
   ================================================================ */
import { nsKey } from '../../js/state.js';
import { CURRENT_LANG } from '../../js/i18n.js';
import { toolShareUrl } from '../../js/site-config.js';
import { t } from './data/i18n-score.js';
import { PITCHES, NOTE_ABC_CODES, instrumentCodeFromLabel, DEFAULT_KEY_BINDINGS } from './data/constants.js';

/* ── localStorage キー（すべて nsKey() でプロフィール名前空間化） ── */
export const SONGS_KEY = () => nsKey('taiScoreSongs_v1');
export const TITLES_KEY = () => nsKey('taiScoreTitles_v1');
export const KEY_BINDINGS_KEY = () => nsKey('taiScoreKeyBindings_v1');
export const LIBRARY_SORT_KEY = () => nsKey('taiScoreLibrarySort_v1');
export const INPUT_MODE_KEY = () => nsKey('taiScoreInputMode_v1');
export const TIMELINE_VIEW_KEY = () => nsKey('taiScoreTimelineView_v1');
export const FRAME_CLIPBOARD_KEY = () => nsKey('taiScoreFrameClipboard_v1');
export const FREE_PLAY_INSTRUMENT_KEY = () => nsKey('taiScoreFreePlayInstrument_v1');
export const METRONOME_KEY = () => nsKey('taiScoreMetronomeEnabled_v1');
export const NO_SCROLL_KEY = () => nsKey('taiScoreNoScrollDuringPlayback_v1');
export const LOOP_RANGE_KEY = () => nsKey('taiScoreLoopRangeEnabled_v1');

/* ================================================================
   曲データの保存（localStorage）
   1曲 = { id, name, bpm, pitch, instrument, frames: [[noteIndex,...], ...],
           bpmOverrides?: { [フレーム番号]: BPM }, updatedAt,
           practiceRangeStart?, practiceRangeEnd?: 練習・試験の範囲（1始まりのマス番号、
             未指定なら曲全体）、loopRangeEnabled?: その範囲をループ再生するか、
           lastPracticeResult?: { at }、lastTestResult?: { at, mistakes } }
   （形状は移植元と完全に同一。詳細は移植元コメント参照）
   ================================================================ */
export function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
export function songNoteCount(s) { return s.frames.reduce((sum, f) => sum + f.length, 0); }

export function loadSongs() {
  try {
    const songs = JSON.parse(localStorage.getItem(SONGS_KEY())) || [];
    // 🧹 以前この端末に存在した2レイヤー機能(値0〜14=レイヤー1, 15〜29=レイヤー2の
    // オフセット方式)の名残りが保存済みの楽譜に残っていた場合、%15で正規化して
    // 単一レイヤーの音程に統合する(重複除去つき)。レイヤー機能を廃止した今、
    // 音を消さずに自動できれいな状態へ戻すための後方互換処理。
    songs.forEach(s => { s.frames = s.frames.map(f => [...new Set(f.map(n => n % 15))]); });
    return songs;
  } catch (_) { return []; }
}
export function saveSongs(songs) { localStorage.setItem(SONGS_KEY(), JSON.stringify(songs)); }

/* ================================================================
   称号（実績）
   一度獲得した称号は、あとで曲を削除したりノートを減らしたりしても
   絶対に失われない。そのため判定は「今の曲数」ではなく、削除では減らない
   累計値（songsCreatedTotal＝作成・複製・読み込みで曲が加わった延べ回数、
   maxNoteCount＝これまでに存在した1曲あたりの最大ノート数）で行う。
   ================================================================ */
export const TITLES = [
  { id: 'firstSong', icon: 'i-sheet-music', nameKey: 'titleFirstSongName', descKey: 'titleFirstSongDesc', check: d => d.songsCreatedTotal >= 1 },
  { id: 'apprentice', icon: 'i-music-note', nameKey: 'titleApprenticeName', descKey: 'titleApprenticeDesc', check: d => d.songsCreatedTotal >= 5 },
  { id: 'craftsman', icon: 'i-music-note', nameKey: 'titleCraftsmanName', descKey: 'titleCraftsmanDesc', check: d => d.songsCreatedTotal >= 20 },
  { id: 'legend', icon: 'ts-i-medal', nameKey: 'titleLegendName', descKey: 'titleLegendDesc', check: d => d.songsCreatedTotal >= 50 },
  { id: 'passionate', icon: 'i-flame', nameKey: 'titlePassionateName', descKey: 'titlePassionateDesc', check: d => d.maxNoteCount >= 100 },
  { id: 'virtuoso', icon: 'ts-i-bolt', nameKey: 'titleVirtuosoName', descKey: 'titleVirtuosoDesc', check: d => d.maxNoteCount >= 300 },
];
export function loadTitlesData() {
  try {
    const d = JSON.parse(localStorage.getItem(TITLES_KEY()));
    if (d && typeof d === 'object') {
      return {
        earned: d.earned || [],
        songsCreatedTotal: d.songsCreatedTotal || 0,
        maxNoteCount: d.maxNoteCount || 0,
        practiceCountTotal: d.practiceCountTotal || 0,
      };
    }
  } catch (_) { /* 無視 */ }
  return { earned: [], songsCreatedTotal: 0, maxNoteCount: 0, practiceCountTotal: 0 };
}
export function saveTitlesData(d) { localStorage.setItem(TITLES_KEY(), JSON.stringify(d)); }

// 新規に条件を満たした称号があれば付与して保存し、新しく獲得した称号定義の配列を返す
// （トースト表示・再描画は呼び出し側の責務）
export function checkTitles(d) {
  d = d || loadTitlesData();
  const earnedIds = new Set(d.earned.map(e => e.id));
  const newlyEarned = TITLES.filter(ti => !earnedIds.has(ti.id) && ti.check(d));
  if (newlyEarned.length) {
    newlyEarned.forEach(ti => d.earned.push({ id: ti.id, earnedAt: new Date().toISOString() }));
    saveTitlesData(d);
  }
  return newlyEarned;
}
// 曲がライブラリに加わった（新規作成・複製・インポート・共有リンク読込）たびに呼ぶ。
// この延べ回数は曲を削除しても減らないので、称号の判定基準として安全に使える
export function recordSongCreated() {
  const d = loadTitlesData();
  d.songsCreatedTotal += 1;
  saveTitlesData(d);
  return checkTitles(d);
}
// 1曲あたりのノート数の「最高記録」を更新する。ノートを減らしても記録は下がらない
export function recordNoteCount(count) {
  const d = loadTitlesData();
  if (count > d.maxNoteCount) {
    d.maxNoteCount = count;
    saveTitlesData(d);
  }
  return checkTitles(d);
}
export function recordPracticeCompleted() {
  const d = loadTitlesData();
  d.practiceCountTotal += 1;
  saveTitlesData(d);
  return d;
}

/* ── ライブラリの並び順（この端末で記憶する。曲名検索の絞り込みとは独立） ── */
export const LIBRARY_SORT_MODES = ['updated', 'name', 'bpm', 'notes'];
export function loadLibrarySort() {
  const v = localStorage.getItem(LIBRARY_SORT_KEY());
  return LIBRARY_SORT_MODES.includes(v) ? v : 'updated';
}
export function saveLibrarySort(v) { localStorage.setItem(LIBRARY_SORT_KEY(), v); }
export function sortSongs(songs, sortMode) {
  const arr = songs.slice();
  switch (sortMode) {
    case 'name': arr.sort((a, b) => (a.name || '').localeCompare(b.name || '', CURRENT_LANG === 'en' ? 'en' : 'ja')); break;
    case 'bpm': arr.sort((a, b) => a.bpm - b.bpm); break;
    case 'notes': arr.sort((a, b) => songNoteCount(b) - songNoteCount(a)); break;
    case 'updated':
    default: arr.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  return arr;
}

/* ================================================================
   パソコンのキーボードでの操作（作成・演奏）
   マスごとにキーを自由に割り当てられる。初期値はSky Music Nightly等
   でも定番のY U I O P / H J K L ; / N M , . / 配列。
   ================================================================ */
export function loadKeyBindings() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY_BINDINGS_KEY()));
    if (Array.isArray(saved) && saved.length === 15) return saved;
  } catch (_) { /* 無視してデフォルトを使う */ }
  return DEFAULT_KEY_BINDINGS.slice();
}
export function saveKeyBindings(bindings) { localStorage.setItem(KEY_BINDINGS_KEY(), JSON.stringify(bindings)); }
export function keyDisplayLabel(k) { return k === ' ' ? 'Space' : (k.length === 1 ? k.toUpperCase() : k); }
export function normalizeKeyEvent(e) { return e.key.length === 1 ? e.key.toLowerCase() : e.key; }

/* ================================================================
   音符入力の表示切り替え：グリッド（ゲーム内のマス配置）⇔ ピアノ（白鍵のみ）⇔ 五線譜
   ================================================================ */
export function getInputMode() {
  const m = localStorage.getItem(INPUT_MODE_KEY());
  return (m === 'piano' || m === 'staff') ? m : 'grid';
}
export function setInputMode(mode) { localStorage.setItem(INPUT_MODE_KEY(), mode); }

/* ── 譜面(frame-strip)全体の表示方法：「タイル」⇔「縦列」 ── */
export function getTimelineView() {
  return localStorage.getItem(TIMELINE_VIEW_KEY()) === 'column' ? 'column' : 'tile';
}
export function setTimelineView(view) { localStorage.setItem(TIMELINE_VIEW_KEY(), view); }

/* ================================================================
   フレーム単位のテンポ変化（bpmOverrides）
   ================================================================ */
export function frameBpmOverride(song, fi) {
  if (!song || !song.bpmOverrides) return null;
  const v = song.bpmOverrides[fi];
  return (typeof v === 'number' && v > 0) ? v : null;
}
// idx番目のマスを再生する時点で実際に効いているBPMを、その場所から曲の先頭方向へ
// 遡って直近のテンポ変化（無ければ曲全体のbpm）から求める
export function effectiveBpmAtFrame(song, idx) {
  if (song && song.bpmOverrides) {
    for (let j = idx; j >= 0; j--) {
      const v = song.bpmOverrides[j];
      if (typeof v === 'number' && v > 0) return v;
    }
  }
  return song ? song.bpm : 150;
}
// fi番目のマスを削除する時、それより後ろのテンポ変化のインデックスを1つずつ詰める
export function shiftBpmOverridesForDelete(song, fi) {
  if (!song.bpmOverrides) return;
  const next = {};
  Object.keys(song.bpmOverrides).forEach(k => {
    const idx = parseInt(k, 10);
    if (idx === fi) return; // このマスごと削除される
    next[idx > fi ? idx - 1 : idx] = song.bpmOverrides[k];
  });
  song.bpmOverrides = next;
}
// at番目の位置にcount個のマスを挿入する時、それ以降のテンポ変化のインデックスを
// 後ろへずらして空ける（挿入されたマス自体には既存のテンポ変化は付かない）
export function shiftBpmOverridesForInsert(song, at, count) {
  if (!song.bpmOverrides || count <= 0) return;
  const next = {};
  Object.keys(song.bpmOverrides).forEach(k => {
    const idx = parseInt(k, 10);
    next[idx >= at ? idx + count : idx] = song.bpmOverrides[k];
  });
  song.bpmOverrides = next;
}

/* ================================================================
   フレーム範囲のコピー＆ペーストのクリップボード
   この端末に1件だけ保存し、曲を切り替えても（＝別の曲を開いても）保持される。
   ================================================================ */
export function loadFrameClipboard() {
  try {
    const c = JSON.parse(localStorage.getItem(FRAME_CLIPBOARD_KEY()));
    if (c && Array.isArray(c.frames) && c.frames.length > 0) return c;
  } catch (e) { /* 無視 */ }
  return null;
}
export function saveFrameClipboard(clip) {
  try { localStorage.setItem(FRAME_CLIPBOARD_KEY(), JSON.stringify(clip)); } catch (e) { /* 無視 */ }
}

/* ── フリー演奏の楽器選択（特定の楽譜に紐づかないため専用に記憶する） ── */
export function getFreePlayInstrument() {
  return localStorage.getItem(FREE_PLAY_INSTRUMENT_KEY()) || 'Harp';
}
export function setFreePlayInstrument(code) { localStorage.setItem(FREE_PLAY_INSTRUMENT_KEY(), code); }

/* ── メトロノーム／カウントイン・再生中ノースクロール（端末ごとの設定） ── */
export function metronomeEnabled() {
  try { return localStorage.getItem(METRONOME_KEY()) === '1'; } catch (e) { return false; }
}
export function setMetronomeEnabled(on) {
  try { localStorage.setItem(METRONOME_KEY(), on ? '1' : '0'); } catch (e) { /* 無視 */ }
}
export function noScrollDuringPlaybackEnabled() {
  try { return localStorage.getItem(NO_SCROLL_KEY()) === '1'; } catch (e) { return false; }
}
export function setNoScrollDuringPlaybackEnabled(on) {
  try { localStorage.setItem(NO_SCROLL_KEY(), on ? '1' : '0'); } catch (e) { /* 無視 */ }
}
// ループON/OFFは曲ごとに記憶する（song.loopRangeEnabled）。旧バージョン（端末共通の
// 1設定だった頃）のキーは、まだこの曲用の設定を保存していない曲の初期値としてだけ参照する。
export function loopRangeEnabled(song) {
  if (song && typeof song.loopRangeEnabled === 'boolean') return song.loopRangeEnabled;
  try { return localStorage.getItem(LOOP_RANGE_KEY()) === '1'; } catch (e) { return false; }
}

/* ================================================================
   テキスト譜面（ABC譜）
   Skyコミュニティで広く使われている記法（上段=A、中段=B、下段=Cの行 ＋
   左から1〜5の列）で、文字だけの楽譜を作成・読み込みできるようにする。
   ================================================================ */
// テキスト譜面の出力はSkyコミュニティ標準の日本語ラベルで固定する（表示言語に関わらず、
// 移植元と同じ挙動：出力ヘッダーの「曲名/BPM/調/楽器」ラベル自体は常に日本語）
const INSTRUMENT_LABELS_JA_LOCAL = { Harp: '楽器A', Guitar: '楽器B', Bass: '楽器C', Flute: '楽器D', Bells: '楽器E' };
export function songToTextSheet(song) {
  const body = song.frames.map(frame => {
    if (frame.length === 0) return '.';
    return frame.slice().sort((a, b) => a - b).map(i => NOTE_ABC_CODES[i]).join('');
  });
  const lines = [];
  for (let i = 0; i < body.length; i += 8) lines.push(body.slice(i, i + 8).join(' '));
  const instLabel = INSTRUMENT_LABELS_JA_LOCAL[song.instrument] || song.instrument || 'ハープ';
  const header = [
    `# 曲名: ${song.name || '無題'}`,
    `# BPM: ${song.bpm}　調: ${song.pitch}　楽器: ${instLabel}`,
    `# tai-score (${toolShareUrl('tai-score')}) のテキスト譜面`,
    '',
  ].join('\n');
  return header + lines.join('\n');
}

export function parseAbcToken(token) {
  if (token === '.' || token === '') return [];
  const indices = [];
  for (let i = 0; i < token.length; i += 2) {
    const idx = NOTE_ABC_CODES.indexOf(token.slice(i, i + 2).toUpperCase());
    if (idx >= 0 && !indices.includes(idx)) indices.push(idx); // 同じ音が重複して書かれていても1つにまとめる
  }
  return indices;
}
export function isAbcTextSheet(text) {
  const tt = (text || '').trim();
  if (!tt || tt.startsWith('{') || tt.startsWith('[')) return false;
  const bodyLines = tt.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#'));
  if (bodyLines.length === 0) return false;
  const tokens = bodyLines.join(' ').trim().split(/\s+/);
  return tokens.length > 0 && tokens.every(tok => /^(\.|([A-C][1-5])+)$/i.test(tok));
}
export function textSheetToSong(text) {
  let name = t('importedSongDefaultName'), bpm = 150, pitch = 'C', instrument = 'Harp';
  const bodyLines = [];
  text.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('#')) {
      const nameMatch = trimmed.match(/曲名[:：]\s*(.+)/);
      if (nameMatch) name = nameMatch[1].trim();
      const bpmMatch = trimmed.match(/BPM[:：]\s*(\d+)/i);
      if (bpmMatch) bpm = Math.max(40, Math.min(999, parseInt(bpmMatch[1], 10)));
      const pitchMatch = trimmed.match(/調[:：]\s*([A-G]b?)/);
      if (pitchMatch && PITCHES.includes(pitchMatch[1])) pitch = pitchMatch[1];
      const instMatch = trimmed.match(/楽器[:：]\s*([^\s　]+)/);
      if (instMatch) instrument = instrumentCodeFromLabel(instMatch[1]) || instrument;
      return;
    }
    bodyLines.push(trimmed);
  });
  const tokens = bodyLines.join(' ').trim().split(/\s+/).filter(Boolean);
  const frames = tokens.map(parseAbcToken);
  if (frames.length === 0) throw new Error('no frames parsed');
  return { id: genId(), name, bpm, pitch, instrument, frames, updatedAt: Date.now() };
}

export function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
// ダウンロードファイル名としてそのまま使えない文字（/ \ : * ? " < > |）を置き換える。
export function sanitizeFilename(str) {
  return String(str).replace(/[\\/:*?"<>|]/g, '_').trim() || 'song';
}

/* ================================================================
   Sky Music Nightly (Specy) 形式との相互変換
   参考: github.com/Specy/genshin-music の SongTypes / ComposedSong / SongClasses
   ================================================================ */
export function songToSpecyFormat(song) {
  return {
    id: null, type: 'composed', folderId: null, name: song.name, version: 3,
    bpm: song.bpm, pitch: song.pitch,
    data: { isComposed: true, appName: 'Sky', isEncrypted: false },
    instruments: [{ name: song.instrument || 'Harp', notes: [], volume: 100, pitch: song.pitch, baseNotes: [] }],
    breakpoints: [],
    reverb: false,
    columns: song.frames.map(frame => [0, frame.map(idx => [idx, '1'])]),
  };
}
export function specyFormatToSong(data) {
  const columns = data.columns || [];
  return {
    id: genId(),
    name: data.name || t('importedSongDefaultName'),
    bpm: data.bpm || 150,
    pitch: data.pitch || 'C',
    instrument: (data.instruments && data.instruments[0] && data.instruments[0].name) || 'Harp',
    frames: columns.map(col => {
      const notes = Array.isArray(col) ? (col[1] || []) : [];
      const indices = notes.map(n => (Array.isArray(n) ? n[0] : (n.index !== undefined ? n.index : n.key))).filter(n => typeof n === 'number' && n >= 0 && n < 15);
      return [...new Set(indices)];
    }),
    updatedAt: Date.now(),
  };
}
export function isSpecyFormat(data) {
  return data && (data.type === 'composed' || data.type === 'recorded' || Array.isArray(data.columns) || Array.isArray(data.notes));
}

/* ================================================================
   Sky Studio（Maple氏）形式との変換
   「マス」ではなく絶対時間（ミリ秒）で音を記録しているため、実際の音の間隔から
   GCD（最大公約数）でマス単位を自動検出し、マス目の譜面に変換する。
   ================================================================ */
export function isOldSkyStudioFormat(data) {
  return !!(data && !data.type && !data.kind && Array.isArray(data.songNotes));
}
export function gcdInt(a, b) {
  a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b));
  while (b) { const tmp = a % b; a = b; b = tmp; }
  return a;
}
// notes = [{idx, time(ミリ秒)}] から、実際の間隔のGCD（最大公約数）で最も細かい
// マス単位を自動検出し、マス目の配列(frames)とBPMに変換する共通処理。
// Sky Studio形式のインポート、音声解析、楽譜画像OMRのインポートで共通して使う。
export function quantizeNoteEventsToFrames(notes, fallbackBpmHint) {
  const fallbackBpm = Math.max(40, Math.round(fallbackBpmHint) || 150);
  if (notes.length === 0) {
    return { frames: [[]], bpm: fallbackBpm };
  }
  const uniqueTimes = [...new Set(notes.map(n => n.time))].sort((a, b) => a - b);
  let unitMs = 60000 / fallbackBpm;
  if (uniqueTimes.length > 1) {
    let g = 0;
    for (let i = 1; i < uniqueTimes.length; i++) {
      const delta = uniqueTimes[i] - uniqueTimes[i - 1];
      if (delta > 0) g = g === 0 ? delta : gcdInt(g, delta);
    }
    if (g > 0) unitMs = Math.max(g, 20); // 20ms未満の間隔は異常値とみなし切り捨てない
  }
  const maxTime = uniqueTimes[uniqueTimes.length - 1];
  const FRAME_CAP = 2000;
  if (Math.round(maxTime / unitMs) > FRAME_CAP) unitMs = maxTime / FRAME_CAP;
  const maxTick = Math.round(maxTime / unitMs);

  const frameNotes = new Map();
  notes.forEach(n => {
    const tick = Math.round(n.time / unitMs);
    if (!frameNotes.has(tick)) frameNotes.set(tick, new Set());
    frameNotes.get(tick).add(n.idx);
  });

  const frames = [];
  for (let ti = 0; ti <= maxTick; ti++) {
    frames.push(frameNotes.has(ti) ? [...frameNotes.get(ti)].sort((a, b) => a - b) : []);
  }
  const bpm = Math.max(40, Math.min(999, Math.round(60000 / unitMs)));
  return { frames, bpm };
}
export function oldSkyStudioFormatToSong(data) {
  const rawNotes = Array.isArray(data.songNotes) ? data.songNotes : [];
  const seen = new Set();
  const notes = [];
  rawNotes.forEach(n => {
    const idx = parseInt(String(n.key).split('Key')[1], 10);
    if (!Number.isFinite(idx) || idx < 0 || idx > 14) return; // 白鍵15個の範囲外は無視
    const time = Number(n.time) || 0;
    const dedupeKey = idx + '|' + time;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    notes.push({ idx, time });
  });
  const { frames, bpm } = quantizeNoteEventsToFrames(notes, Number(data.bpm));
  const pitch = PITCHES[Number.isInteger(data.pitchLevel) ? data.pitchLevel : 0] || 'C';
  let name = data.name || t('importedSongDefaultName');
  if (data.author) name += `（${data.author}）`;
  return { id: genId(), name, bpm, pitch, instrument: 'Harp', frames, updatedAt: Date.now() };
}

// ファイルのバイト列からエンコーディング（BOM）を判定してデコードする。
// Sky Studio等が書き出す .txt ファイルはUTF-16（LE）の場合があるため、
// 単純なreadAsText()（UTF-8前提）では文字化けしてJSONとして読めないことがある。
export function decodeFileBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return new TextDecoder('utf-8').decode(bytes.subarray(3));
  return new TextDecoder('utf-8').decode(bytes);
}

// 読み込んだデータ（配列で複数曲が包まれている場合を含む）から、取り込める曲を全て取り出す。
// 配列中の一部が未対応形式でも、その曲だけ読み飛ばして残りは取り込む
// （全滅した場合のみ、従来通り「unknown format」としてエラーにする）。
export function pickImportableSongs(parsed) {
  const list = Array.isArray(parsed) ? parsed : [parsed];
  if (list.length === 0) throw new Error('empty array');
  const songs = [];
  list.forEach(item => {
    try {
      if (item && item.kind === 'tai-score-song' && item.song) {
        const song = item.song; song.id = genId(); song.updatedAt = Date.now();
        songs.push(song);
      } else if (isOldSkyStudioFormat(item)) {
        songs.push(oldSkyStudioFormatToSong(item));
      } else if (isSpecyFormat(item)) {
        songs.push(specyFormatToSong(item));
      }
    } catch (e) { /* この1曲だけ読み込めない場合はスキップし、残りの曲は取り込む */ }
  });
  if (songs.length === 0) throw new Error('unknown format');
  const extraNote = songs.length > 1 ? t('multiSongNote', { count: songs.length }) : '';
  return { songs, extraNote };
}

/* ================================================================
   コードの圧縮/展開 + Base64（データ引継ぎと同じ方式）と共有コード
   ================================================================ */
function bytesToBase64(bytes) {
  let binString = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) binString += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  return btoa(binString);
}
function base64ToBytes(b64) {
  const binString = atob(b64);
  const bytes = new Uint8Array(binString.length);
  for (let i = 0; i < binString.length; i++) bytes[i] = binString.charCodeAt(i);
  return bytes;
}
export async function encodeShareCode(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream === 'undefined') return 'U1:' + bytesToBase64(bytes);
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(bytes); writer.close();
  const compressed = new Uint8Array(await new Response(cs.readable).arrayBuffer());
  return 'G1:' + bytesToBase64(compressed);
}
export async function decodeShareCode(code) {
  const marker = code.slice(0, 3);
  const body = code.slice(3);
  let bytes;
  if (marker === 'G1:') {
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(base64ToBytes(body)); writer.close();
    bytes = new Uint8Array(await new Response(ds.readable).arrayBuffer());
  } else if (marker === 'U1:') {
    bytes = base64ToBytes(body);
  } else {
    bytes = base64ToBytes(code);
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
// 共有コード・共有ファイルには、この端末だけの練習・試験に関する情報
// （練習/試験の範囲・ループ設定・前回の練習/試験結果）を含めない。
export function stripPersonalPracticeData(song) {
  const copy = Object.assign({}, song);
  delete copy.practiceRangeStart;
  delete copy.practiceRangeEnd;
  delete copy.loopRangeEnabled;
  delete copy.lastPracticeResult;
  delete copy.lastTestResult;
  return copy;
}

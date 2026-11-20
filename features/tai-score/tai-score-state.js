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
export const AUTO_ADVANCE_KEY = () => nsKey('taiScoreAutoAdvance_v1');
export const FRAME_CLIPBOARD_KEY = () => nsKey('taiScoreFrameClipboard_v1');
export const FREE_PLAY_INSTRUMENT_KEY = () => nsKey('taiScoreFreePlayInstrument_v1');
export const METRONOME_KEY = () => nsKey('taiScoreMetronomeEnabled_v1');
export const NO_SCROLL_KEY = () => nsKey('taiScoreNoScrollDuringPlayback_v1');
export const LOOP_RANGE_KEY = () => nsKey('taiScoreLoopRangeEnabled_v1');

/* ================================================================
   曲データの保存（localStorage）
   1曲 = { id, name, bpm, pitch, instrument, frames: [[noteIndex,...], ...],
           bpmOverrides?: { [フレーム番号]: BPM },
           frameLengths?: { [フレーム番号]: 拍数（FRAME_LENGTHSのどれか。書いていないマスは1拍） },
           sections?: [{ frame: 0始まりのマス番号, label: 20字まで }]（セクションの目印。frame昇順・最大50件・同じframeは1件。
             無い曲は空として扱い、書き足さない。共有コード・ファイルには含めない）, updatedAt,
           practiceRangeStart?, practiceRangeEnd?: 練習・試験の範囲（1始まりのマス番号、
             未指定なら曲全体）、loopRangeEnabled?: その範囲をループ再生するか、
           lastPracticeResult?: { at }、lastTestResult?: { at, mistakes } }
   （形状は移植元と完全に同一。詳細は移植元コメント参照）
   ================================================================ */
// 旧サイトの楽譜づくりには保存枠（プロフィール）が無く、曲・称号・キー割り当ては1つの共通キーにあった
// （どの保存枠を選んでいても同じ曲が見えていた）。ハブで保存枠ごとのデータがまだ無い間は、その共通キーを読む。
// 保存した時点でこの保存枠専用のキーに書かれ、以後はそちらが使われる
function readProfileOrShared(key, rawKey) {
  const v = localStorage.getItem(key);
  return v === null && key !== rawKey ? localStorage.getItem(rawKey) : v;
}

export function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
export function songNoteCount(s) { return s.frames.reduce((sum, f) => sum + f.length, 0); }

export function loadSongs() {
  try {
    const songs = JSON.parse(readProfileOrShared(SONGS_KEY(), 'taiScoreSongs_v1')) || [];
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
    const d = JSON.parse(readProfileOrShared(TITLES_KEY(), 'taiScoreTitles_v1'));
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
    const saved = JSON.parse(readProfileOrShared(KEY_BINDINGS_KEY(), 'taiScoreKeyBindings_v1'));
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

/* ── 「入力したら次へ」（音を入れたら次のマスへ進む）。既定はオフ ── */
export function autoAdvanceEnabled() {
  try { return localStorage.getItem(AUTO_ADVANCE_KEY()) === '1'; } catch (e) { return false; }
}
export function setAutoAdvanceEnabled(on) {
  try { localStorage.setItem(AUTO_ADVANCE_KEY(), on ? '1' : '0'); } catch (e) { /* noop */ }
}



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
// マス番号をキーにした表（テンポ変化 bpmOverrides・マスの長さ frameLengths）は、マスの削除・挿入に合わせて番号をずらす。
// 下の2つの関数は名前に Bpm と付いているが、両方の表をまとめてずらす（呼び出し側を増やさないため）
const PER_FRAME_MAPS = ['bpmOverrides', 'frameLengths'];
// fi番目のマスを削除する時、それより後ろのインデックスを1つずつ詰める
export function shiftBpmOverridesForDelete(song, fi) {
  PER_FRAME_MAPS.forEach(key => {
    if (!song[key]) return;
    const next = {};
    Object.keys(song[key]).forEach(k => {
      const idx = parseInt(k, 10);
      if (idx === fi) return; // このマスごと削除される
      next[idx > fi ? idx - 1 : idx] = song[key][k];
    });
    song[key] = next;
  });
}
// at番目の位置にcount個のマスを挿入する時、それ以降のインデックスを後ろへずらして空ける
// （挿入されたマス自体には既存のテンポ変化・長さは付かない）
export function shiftBpmOverridesForInsert(song, at, count) {
  if (count <= 0) return;
  PER_FRAME_MAPS.forEach(key => {
    if (!song[key]) return;
    const next = {};
    Object.keys(song[key]).forEach(k => {
      const idx = parseInt(k, 10);
      next[idx >= at ? idx + count : idx] = song[key][k];
    });
    song[key] = next;
  });
}

/* ================================================================
   範囲の一括変換（作曲ツールの「範囲を変える」）。どれも曲データを直接書き換える純粋な処理で、
   履歴（Undo）・保存・再描画は呼び出し側（tai-score-editor.js）が受け持つ。
   ================================================================ */
const NOTE_MAX = 14; // 音番号は0〜14（5×3の15音）。7ずらすと1オクターブ
// 音の位置をずらす（調の変更ではなく、指使い＝音番号の移動）。mode:
//   'wrap'  … 0〜14に収まるまで∓7（オクターブ）で折り返す
//   'drop'  … はみ出した音だけ消す（マスは休符として残る）
//   'abort' … 1音でもはみ出すなら何もしない（戻り値の overflow が true）
// 戻り値: { frames（新しい配列）, overflow（はみ出す音があったか） }。各マスは重複を除いて昇順にそろえる
export function shiftNotesInFrames(frames, delta, mode = 'wrap') {
  let overflow = false;
  const out = frames.map(frame => {
    const set = new Set();
    frame.forEach(idx => {
      let v = idx + delta;
      if (v < 0 || v > NOTE_MAX) {
        overflow = true;
        if (mode === 'drop') return;
        while (v > NOTE_MAX) v -= 7;
        while (v < 0) v += 7;
      }
      set.add(v);
    });
    return [...set].sort((a, b) => a - b);
  });
  if (overflow && mode === 'abort') return { frames: frames.map(f => f.slice()), overflow };
  return { frames: out, overflow };
}
// 上下反転（音域の中心で裏返す）: idx → 14 − idx
export function invertNotesInFrames(frames) {
  return frames.map(frame => [...new Set(frame.map(idx => NOTE_MAX - idx))].sort((a, b) => a - b));
}
// start〜endのマスの並びを逆にする。マスに付いた長さ（frameLengths）とテンポ変化（bpmOverrides）も、
// そのマスの鳴り方としてマスと一緒に動かす
export function reverseFramesInSong(song, start, end) {
  const mirror = i => start + end - i;
  song.frames.splice(start, end - start + 1, ...song.frames.slice(start, end + 1).reverse());
  ['bpmOverrides', 'frameLengths'].forEach(key => {
    if (!song[key]) return;
    const next = {};
    Object.keys(song[key]).forEach(k => {
      const i = parseInt(k, 10);
      next[i >= start && i <= end ? mirror(i) : i] = song[key][k];
    });
    song[key] = next;
  });
}
// start〜endの範囲を、コピーと同じ形 { frames, bpmOverrides, frameLengths }（後2者は範囲先頭からの相対位置）で取り出す
export function clipFromRange(song, start, end) {
  const frames = song.frames.slice(start, end + 1).map(f => f.slice());
  const bpmOverrides = {}, frameLengths = {};
  for (let i = start; i <= end; i++) {
    const v = song.bpmOverrides ? song.bpmOverrides[i] : undefined;
    if (typeof v === 'number' && v > 0) bpmOverrides[i - start] = v;
    const len = frameLength(song, i);
    if (len !== 1) frameLengths[i - start] = len;
  }
  return { frames, bpmOverrides, frameLengths };
}
// at番目の位置へ clip を挿入する（後ろのマスとその表はずらす）。戻り値は挿入したマス数
export function insertClipAt(song, at, clip) {
  const copied = clip.frames.map(f => f.slice());
  song.frames.splice(at, 0, ...copied);
  shiftBpmOverridesForInsert(song, at, copied.length);
  shiftSectionsForInsert(song, at, copied.length);
  Object.keys(clip.bpmOverrides || {}).forEach(k => {
    if (!song.bpmOverrides) song.bpmOverrides = {};
    song.bpmOverrides[at + parseInt(k, 10)] = clip.bpmOverrides[k];
  });
  Object.keys(clip.frameLengths || {}).forEach(k => setFrameLength(song, at + parseInt(k, 10), clip.frameLengths[k]));
  return copied.length;
}
// at番目から clip の内容で上書きする。曲の末尾を超える分は足す。上書きした範囲の長さ・テンポ変化は、
// clip に無い位置は消す（貼った内容がそのまま再現されるように）
export function overwriteClipAt(song, at, clip) {
  const n = clip.frames.length;
  for (let j = 0; j < n; j++) {
    const i = at + j;
    if (i < song.frames.length) song.frames[i] = clip.frames[j].slice();
    else song.frames.push(clip.frames[j].slice());
    if (song.bpmOverrides) delete song.bpmOverrides[i];
    setFrameLength(song, i, 1);
    const v = clip.bpmOverrides ? clip.bpmOverrides[j] : undefined;
    if (typeof v === 'number' && v > 0) { if (!song.bpmOverrides) song.bpmOverrides = {}; song.bpmOverrides[i] = v; }
    const len = clip.frameLengths ? clip.frameLengths[j] : undefined;
    if (len !== undefined) setFrameLength(song, i, len);
  }
  return n;
}

/* ================================================================
   セクションの目印（sections）。長い曲で「ここからサビ」のように場所に名前を付ける。
   マスの挿入・削除に合わせて frame をずらす（bpmOverrides・frameLengths をずらす関数とは別に、
   マスを増減する全部の経路から呼ぶ）。削除したマスに付いていた目印は一緒に消える。
   ================================================================ */
export const SECTION_LABEL_MAX = 20;
export const SECTIONS_MAX = 50;
// 表示・編集用に、正しい形の目印だけを frame 昇順で返す（曲データ自体は書き換えない）
export function getSections(song) {
  if (!song || !Array.isArray(song.sections)) return [];
  const seen = new Set();
  return song.sections
    .filter(sec => sec && Number.isInteger(sec.frame) && sec.frame >= 0 && sec.frame < song.frames.length && typeof sec.label === 'string')
    .sort((a, b) => a.frame - b.frame)
    .filter(sec => (seen.has(sec.frame) ? false : (seen.add(sec.frame), true)));
}
function writeSections(song, list) {
  if (list.length) song.sections = list.map(sec => ({ frame: sec.frame, label: sec.label }));
  else delete song.sections;
}
// frame に目印を付ける（同じマスにあれば名前を差し替える）。戻り値: 'added' | 'renamed' | 'full' | 'empty'
export function setSection(song, frame, label) {
  const text = String(label || '').trim().slice(0, SECTION_LABEL_MAX);
  if (!text) return 'empty';
  const list = getSections(song);
  const hit = list.find(sec => sec.frame === frame);
  if (hit) { hit.label = text; writeSections(song, list); return 'renamed'; }
  if (list.length >= SECTIONS_MAX) return 'full';
  list.push({ frame, label: text });
  list.sort((a, b) => a.frame - b.frame);
  writeSections(song, list);
  return 'added';
}
export function removeSection(song, frame) {
  writeSections(song, getSections(song).filter(sec => sec.frame !== frame));
}
// at番目にcount個のマスを挿入した時、それ以降の目印を後ろへずらす
export function shiftSectionsForInsert(song, at, count) {
  if (!song || !Array.isArray(song.sections) || count <= 0) return;
  song.sections = song.sections.map(sec => (sec && sec.frame >= at ? Object.assign({}, sec, { frame: sec.frame + count }) : sec));
}
// fi番目のマスを削除した時、そのマスの目印は消し、後ろの目印を1つずつ詰める
export function shiftSectionsForDelete(song, fi) {
  if (!song || !Array.isArray(song.sections)) return;
  const next = song.sections.filter(sec => !(sec && sec.frame === fi)).map(sec => (sec && sec.frame > fi ? Object.assign({}, sec, { frame: sec.frame - 1 }) : sec));
  if (next.length) song.sections = next; else delete song.sections;
}
// 指定のマスが入っているセクション（そのマス以前で一番近い目印）。無ければ null
export function sectionAt(song, fi) {
  let cur = null;
  getSections(song).forEach(sec => { if (sec.frame <= fi) cur = sec; });
  return cur;
}

/* ── 録音した譜面を、別のBPMの曲へ追記できる形に直す ──
   rec = { bpm, frames, frameLengths? }。各マスの長さを toBpm の拍で数え直し、どれも¼拍の倍数になるなら
   その形で返す（例: 録音が BPM 240・曲が BPM 120 なら、1拍のマスは½拍になる）。¼拍の倍数にならない時は null
   （呼び出し側は、追記する先頭のマスにテンポ変化を付けてそのまま足す）。 */
export function retimeForBpm(rec, toBpm) {
  if (!rec || !rec.frames.length) return null;
  if (rec.bpm === toBpm) return { frames: rec.frames.map(f => f.slice()), frameLengths: Object.assign({}, rec.frameLengths || {}) };
  const ratio = toBpm / rec.bpm;
  let pos = 0;
  const onsets = [];
  for (let i = 0; i < rec.frames.length; i++) {
    const q = pos * 4;
    if (Math.abs(q - Math.round(q)) > 1e-6) return null;
    if (rec.frames[i].length) onsets.push({ q: Math.round(q), notes: rec.frames[i] });
    pos += frameLength(rec, i) * ratio;
  }
  const endQ = pos * 4;
  if (Math.abs(endQ - Math.round(endQ)) > 1e-6 || !onsets.length) return null;
  const grid = Array.from({ length: Math.round(endQ) }, () => []);
  onsets.forEach(o => { grid[o.q] = o.notes.slice(); });
  // 最後の音の長さも数え直した値を残すため、最後の音の後ろの休みは grid の長さで表し、compress の「最後は1拍」を補正する
  const packed = compressWithLengths(grid.slice(0, onsets[onsets.length - 1].q + 1), 0.25);
  const lastLenBeats = (Math.round(endQ) - onsets[onsets.length - 1].q) / 4;
  // 最後の音のマスの長さを、元の最後の音の長さ（拍に直した値）にする
  const tail = [];
  let rest = lastLenBeats;
  for (const l of FRAME_LENGTHS.slice().sort((a, b) => b - a)) { while (rest + 1e-9 >= l) { tail.push(l); rest = Math.round((rest - l) * 4) / 4; } }
  if (rest > 1e-9 || !tail.length) return null;
  const lastIdx = packed.frames.length - 1;
  const frameLengths = Object.assign({}, packed.frameLengths);
  delete frameLengths[lastIdx];
  if (tail[0] !== 1) frameLengths[lastIdx] = tail[0];
  const frames = packed.frames.slice();
  for (let k = 1; k < tail.length; k++) { if (tail[k] !== 1) frameLengths[frames.length] = tail[k]; frames.push([]); }
  return { frames, frameLengths };
}

/* ── 演奏時間の表示（譜面ビューと作曲画面で同じ書き方にする） ── */
export function formatDuration(sec) {
  const total = Math.max(0, Math.round(sec));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/* ── 範囲の時間の伸び縮み（マスの長さを2倍・½にする）。
   全部のマスが FRAME_LENGTHS に収まる時だけ新しい長さの表を返す。収まらなければ { blocked: 最初に収まらないマス番号 }。
   空のマスを挟んで調整する方式は使わない。 */
export function stretchedLengths(song, start, end, factor) {
  const next = {};
  for (let i = start; i <= end; i++) {
    const len = frameLength(song, i) * factor;
    if (!FRAME_LENGTHS.includes(len)) return { blocked: i };
    next[i] = len;
  }
  return { lengths: next };
}
/* ── 和音（三和音）: 根音 r に対して r・r+2・r+4（15音の上で1つ飛ばしに3つ重ねる） ── */
export function triadNotes(root) { return [root, root + 2, root + 4].filter(i => i >= 0 && i <= 14); }

/* ── 作曲画面の細かな選択（貼り付け方・ずらし方・繰り返しの元）。曲データにも既存のキーにも混ぜず、専用のキーに置く ── */
export const UI_STATE_KEY = () => nsKey('taiScoreUiState_v1');
const UI_STATE_DEFAULTS = { pasteMode: 'insert', shiftMode: 'wrap', repeatSource: 'range', playbackRate: 1 };
export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5]; // チェック再生の速さの倍率（曲のBPMは変えない）
export function loadUiState() {
  try {
    const v = JSON.parse(localStorage.getItem(UI_STATE_KEY()));
    const out = Object.assign({}, UI_STATE_DEFAULTS);
    if (v && typeof v === 'object') {
      if (v.pasteMode === 'insert' || v.pasteMode === 'overwrite') out.pasteMode = v.pasteMode;
      if (['wrap', 'drop', 'abort'].includes(v.shiftMode)) out.shiftMode = v.shiftMode;
      if (v.repeatSource === 'range' || v.repeatSource === 'clipboard') out.repeatSource = v.repeatSource;
      if (PLAYBACK_RATES.includes(v.playbackRate)) out.playbackRate = v.playbackRate;
    }
    return out;
  } catch (e) { return Object.assign({}, UI_STATE_DEFAULTS); }
}
export function saveUiState(patch) {
  const next = Object.assign(loadUiState(), patch);
  try { localStorage.setItem(UI_STATE_KEY(), JSON.stringify(next)); } catch (e) { /* noop */ }
  return next;
}

/* ================================================================
   マスごとの長さ（frameLengths）。1マス＝1拍（BPMの1拍）が基準で、
   ½なら半分の時間で次のマスへ、2なら2拍ぶん待ってから次のマスへ進む。
   ================================================================ */
export const FRAME_LENGTHS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
export function frameLength(song, fi) {
  const v = song && song.frameLengths ? song.frameLengths[fi] : undefined;
  return FRAME_LENGTHS.includes(v) ? v : 1;
}
export function setFrameLength(song, fi, len) {
  if (!FRAME_LENGTHS.includes(len) || len === 1) {
    if (song.frameLengths) delete song.frameLengths[fi];
  } else {
    if (!song.frameLengths) song.frameLengths = {};
    song.frameLengths[fi] = len;
  }
  if (song.frameLengths && Object.keys(song.frameLengths).length === 0) delete song.frameLengths;
}
// fi番目のマスを鳴らしてから次のマスまでの時間（ミリ秒）
export function frameDurationMs(song, fi) {
  return (60000 / effectiveBpmAtFrame(song, fi)) * frameLength(song, fi);
}
export function songDurationSec(song) {
  let ms = 0;
  for (let i = 0; i < song.frames.length; i++) ms += frameDurationMs(song, i);
  return ms / 1000;
}
const LENGTH_LABELS = { 0.25: '¼', 0.5: '½', 0.75: '¾', 1: '1', 1.5: '1½', 2: '2', 3: '3', 4: '4' };
export function lengthLabel(len) { return LENGTH_LABELS[len] || String(len); }

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
  // テキスト譜面にはマスの長さを書く欄が無いので、2拍以上のマスは後ろに休み（.）を足して長さを残す
  const body = [];
  song.frames.forEach((frame, fi) => {
    body.push(frame.length === 0 ? '.' : frame.slice().sort((a, b) => a - b).map(i => NOTE_ABC_CODES[i]).join(''));
    for (let k = 1; k < Math.floor(frameLength(song, fi)); k++) body.push('.');
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
    columns: specyColumns(song),
  };
}
// Sky Music Nightly の列は「テンポの変え方」0=1拍・1=½・2=¼・3=¾ を持つ。1拍より長いマスは、
// 1拍の列のあとに空の列を足して表す（1½なら 1拍＋空の½）
const SPECY_TEMPO = { 1: 0, 0.5: 1, 0.25: 2, 0.75: 3 };
const SPECY_TEMPO_LEN = [1, 0.5, 0.25, 0.75];
function specyColumns(song) {
  const cols = [];
  song.frames.forEach((frame, fi) => {
    const len = frameLength(song, fi);
    const notes = frame.map(idx => [idx, '1']);
    if (len <= 1) { cols.push([SPECY_TEMPO[len] || 0, notes]); return; }
    cols.push([0, notes]);
    let rest = len - 1;
    while (rest >= 1) { cols.push([0, []]); rest -= 1; }
    if (rest > 0) cols.push([SPECY_TEMPO[rest] || 0, []]);
  });
  return cols;
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
    ...specyFrameLengths(columns),
    updatedAt: Date.now(),
  };
}
function specyFrameLengths(columns) {
  const map = {};
  columns.forEach((col, fi) => {
    const len = Array.isArray(col) ? SPECY_TEMPO_LEN[col[0]] : undefined;
    if (len && len !== 1) map[fi] = len;
  });
  return Object.keys(map).length ? { frameLengths: map } : {};
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
/* ── 格子にそろえた譜面を、マスの長さを使って詰める（読み込み全般で共通） ──
   音のあるマスに「次の音までの拍数」を長さとして付け、長さの選択肢（最大4拍）に収まらない分は
   休みのマスを足して表す。unitBeats は格子1マスぶんの拍数（¼・½・1・2のどれか）。
   鳴るタイミングは格子のままと完全に同じになる。戻り値: { frames, frameLengths } */
const LENGTHS_DESC = FRAME_LENGTHS.slice().sort((a, b) => b - a);
function splitBeats(beats) {
  const pieces = [];
  let rest = Math.round(beats * 4) / 4; // 格子は¼拍の倍数なので、誤差を丸めて止まらないようにする
  while (rest > 1e-9) {
    const len = LENGTHS_DESC.find(l => l <= rest + 1e-9) || LENGTHS_DESC[LENGTHS_DESC.length - 1];
    pieces.push(len);
    rest = Math.round((rest - len) * 4) / 4;
  }
  return pieces;
}
export function compressWithLengths(gridFrames, unitBeats) {
  const onsets = [];
  gridFrames.forEach((f, i) => { if (f.length) onsets.push(i); });
  const frames = [];
  const frameLengths = {};
  const push = (notes, len) => {
    if (len !== 1) frameLengths[frames.length] = len;
    frames.push(notes);
  };
  onsets.forEach((idx, k) => {
    // 最後の音は1拍ぶん鳴らして終わる
    const beats = k + 1 < onsets.length ? (onsets[k + 1] - idx) * unitBeats : 1;
    const pieces = splitBeats(beats);
    push(gridFrames[idx], pieces[0]);
    for (let j = 1; j < pieces.length; j++) push([], pieces[j]);
  });
  if (!frames.length) frames.push([]);
  return { frames, frameLengths };
}
// 実際の時刻（ms）で並んだ音を、マスの長さを使った譜面にする（音声・楽譜画像・Sky Studioの読み込みで使う）。
// 格子（GCD）を経由しないのは、揺れのある記録では格子が20ms程度まで細かくなったり、曲が長いと粗くまとめられたりして、
// 拍の長さを正しく推し量れないため。
//   1. 音の間隔の中央値を1拍の仮の長さにする（BPMが40〜999に入るよう2倍・半分で直す）
//   2. 隣の音との間隔を¼拍に丸めて足し上げ、各音の位置を決める。位置と時刻に直線を当てはめて¼拍の長さを求め直す（3回）
//   3. 次の音までの拍数をマスの長さにする（同じ位置の音は和音にまとめる）
// 間隔ごとのずれは最大⅛拍。BPMは整数に丸めるので、曲全体の速さが最大で0.4%ほど変わる（音の並びはずれない）。
export function packNoteTimesWithLengths(notes) {
  const byTime = new Map();
  notes.forEach(n => {
    if (!byTime.has(n.time)) byTime.set(n.time, new Set());
    byTime.get(n.time).add(n.idx);
  });
  const times = [...byTime.keys()].sort((x, y) => x - y);
  if (times.length < 2) return null;
  const gaps = [];
  for (let i = 1; i < times.length; i++) if (times[i] - times[i - 1] >= 40) gaps.push(times[i] - times[i - 1]); // 和音のばらつき（40ms未満）は数えない
  if (!gaps.length) return null;
  gaps.sort((x, y) => x - y);
  let beat = gaps[Math.floor(gaps.length / 2)];
  while (beat < 60000 / 999) beat *= 2;
  while (beat > 60000 / 40) beat /= 2;
  // 各音の位置（¼拍単位）は、隣の音との間隔を¼拍に丸めて足し上げて決める。曲の頭からの時刻で一度に丸めると、
  // 拍の推定のわずかな誤差が後半ほど積み重なって位置がずれるが、間隔ごとなら誤差は1つの間隔の中で収まる
  let quarter = beat / 4;
  let qs = [];
  for (let iter = 0; iter < 3; iter++) {
    qs = [0];
    for (let i = 1; i < times.length; i++) qs.push(qs[i - 1] + Math.round((times[i] - times[i - 1]) / quarter));
    // 位置と時刻に直線を当てはめて、¼拍の長さを求め直す
    const n = qs.length;
    const mq = qs.reduce((x, y) => x + y, 0) / n, mt = times.reduce((x, y) => x + y, 0) / n;
    let num = 0, den = 0;
    qs.forEach((q, i) => { num += (q - mq) * (times[i] - mt); den += (q - mq) * (q - mq); });
    if (den <= 0 || !(num / den > 0)) break;
    quarter = num / den;
  }
  const bpm = Math.round(60000 / (quarter * 4));
  if (bpm < 40 || bpm > 999) return null;
  const snapped = new Map();
  times.forEach((tm, i) => {
    const q = qs[i]; // 和音のばらつき（¼拍の半分未満の間隔）は同じ位置になり、和音にまとまる
    if (!snapped.has(q)) snapped.set(q, new Set());
    byTime.get(tm).forEach(idx => snapped.get(q).add(idx));
  });
  const last = qs[qs.length - 1];
  const grid = [];
  for (let q = 0; q <= last; q++) grid.push(snapped.has(q) ? [...snapped.get(q)].sort((x, y) => x - y) : []);
  const packed = compressWithLengths(grid, 0.25);
  return { frames: packed.frames, frameLengths: packed.frameLengths, bpm };
}

/* ── 読み込みで、音の間隔をマスの長さで表すか（MIDI・音声・楽譜画像・Sky Studio共通。既定はオン） ──
   キー名は最初にMIDIだけで使っていた時のまま */
export const IMPORT_USE_LENGTHS_KEY = () => nsKey('taiScoreMidiUseLengths_v1');
export function importUseLengthsEnabled() {
  try { return localStorage.getItem(IMPORT_USE_LENGTHS_KEY()) !== '0'; } catch (e) { return true; }
}
export function setImportUseLengthsEnabled(on) {
  try { localStorage.setItem(IMPORT_USE_LENGTHS_KEY(), on ? '1' : '0'); } catch (e) { /* noop */ }
}

// opts.useLengths が true なら、量子化した後にマスの長さで詰める（戻り値に frameLengths・packedFrom が付く）
export function quantizeNoteEventsToFrames(notes, fallbackBpmHint, opts = {}) {
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
  if (opts.useLengths && frames.length > 1) {
    const packed = packNoteTimesWithLengths(notes);
    if (packed) {
      const out = { frames: packed.frames, bpm: packed.bpm, packedFrom: frames.length };
      if (Object.keys(packed.frameLengths).length) out.frameLengths = packed.frameLengths;
      return out;
    }
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
  const q = quantizeNoteEventsToFrames(notes, Number(data.bpm), { useLengths: importUseLengthsEnabled() });
  const pitch = PITCHES[Number.isInteger(data.pitchLevel) ? data.pitchLevel : 0] || 'C';
  let name = data.name || t('importedSongDefaultName');
  if (data.author) name += `（${data.author}）`;
  const song = { id: genId(), name, bpm: q.bpm, pitch, instrument: 'Harp', frames: q.frames, updatedAt: Date.now() };
  if (q.frameLengths) song.frameLengths = q.frameLengths;
  return song;
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
  delete copy.sections; // セクションの目印は自分の作業用。共有の形は変えない
  return copy;
}

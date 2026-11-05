/* ================================================================
   デイリーチェックシート（試作・非公開）。#/daily-check でだけ開ける。
   関連ツールの一覧・サイドバー・「起動時に開くツール」には出さない
   （router-registry.js の hidden フラグ。公開する時に site-links へ足す）。

   - 「大キャン □1本 □2本 …」のように、行ごとに好きな数のチェックを並べたシートを作って保存する。
     行・選択肢・見出しは編集でき、シートは複数持てる。選択肢は2種類:
     box（□＋ラベル）と num（□＋数の入力欄＋「個まで」などのラベル）。
   - チェックはゲームのデイリーと同じく太平洋時間0時（日本時間で夏時間中16時・それ以外17時）に
     自動で外れる（シートごとにオフにできる）。日付の判定は js/pacific-time.js を通す。
   - 印刷: A4に、1日分（縦）か2日分（横向きで左右に並べる）を空欄のまま印刷する。印刷中だけ
     html.dc-printing を付け、@media print で印刷用の面（.dc-print-area）以外を隠す。
   - 着せ替え: 色・チェックの形・紙の柄・飾り（テーマでまとめて切り替えもできる）。紙の色はシートの見た目そのものなので、
     ダークモードでも明るい紙のまま（印刷結果と同じ見た目にするため）。

   保存（nsKey＝プロフィールごと）:
     dailyCheckSheets_v1: { activeId, sheets: [{ id, title, autoReset, style, sections: [{ id, title, rows: [{ id, label, opts: [{ t:'box'|'num', label }] }] }] }] }
     dailyCheckState_v1:  { dayKey: 'YYYY-M-D'（太平洋時間）, sheets: { [sheetId]: { [rowId]: { [i]: true, [i+'n']: '3' } } } }
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { nsKey } from '../../js/state.js';
import { ptParts, ptToReal } from '../../js/pacific-time.js';
import { shareSheetImage, savePrintPdf } from './daily-check-share.js';
import { LAB_TOOLS, labRoute } from '../lab/lab-common.js';

const STYLE_LINK_ID = 'daily-check-view-styles';
const SHEETS_KEY = 'dailyCheckSheets_v1';
const STATE_KEY = 'dailyCheckState_v1';
const LOG_KEY = 'dailyCheckLog_v1'; // 記録した日（連続記録・通算日数用）: { days: { 'YYYY-M-D': 1 }, best }

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);

/* ── 着せ替えの選択肢 ── */
const COLORS = {
  pink: { ja: 'ピンク', en: 'Pink', accent: '#E8679A', soft: '#FFE1EC', paper: '#FFF9FB', ink: '#5A3443', line: '#F6C9DA' },
  mint: { ja: 'ミント', en: 'Mint', accent: '#25A58B', soft: '#D7F4EC', paper: '#F7FFFC', ink: '#27473F', line: '#BFE9DD' },
  lavender: { ja: 'ラベンダー', en: 'Lavender', accent: '#8574DB', soft: '#ECE8FF', paper: '#FBFAFF', ink: '#3B3560', line: '#D9D2FB' },
  lemon: { ja: 'レモン', en: 'Lemon', accent: '#C98F00', soft: '#FFF1C2', paper: '#FFFDF4', ink: '#54451C', line: '#F3E1A6' },
  sky: { ja: 'そら', en: 'Sky', accent: '#3489D6', soft: '#DCEEFF', paper: '#F8FBFF', ink: '#24405A', line: '#C3DDF6' },
  mono: { ja: 'モノクロ', en: 'Mono', accent: '#3A3A3C', soft: '#ECECEE', paper: '#FFFFFF', ink: '#1C1C1E', line: '#D1D1D6' },
  // 大人かわいい・シック向けの、彩度を落とした色（文字の色は紙に対して4.2:1以上）
  greige: { ja: 'グレージュ', en: 'Greige', accent: '#8A7366', soft: '#EFE8E2', paper: '#FBF8F5', ink: '#4A3F38', line: '#E2D8CF' },
  dustyrose: { ja: 'くすみローズ', en: 'Dusty rose', accent: '#A8646F', soft: '#F3E3E4', paper: '#FCF8F8', ink: '#4E3437', line: '#EAD3D6' },
  sage: { ja: 'セージ', en: 'Sage', accent: '#5F7F63', soft: '#E4ECE2', paper: '#F9FBF7', ink: '#33413A', line: '#D3DFD1' },
  kraft: { ja: 'クラフト', en: 'Kraft', accent: '#83623A', soft: '#E9DCC6', paper: '#F6EFE3', ink: '#4A3A28', line: '#DCCBAF' },
  navy: { ja: 'ネイビー', en: 'Navy', accent: '#34466B', soft: '#E2E6EF', paper: '#FAFAF7', ink: '#1F2A40', line: '#D3D8E3' },
  bordeaux: { ja: 'ボルドー', en: 'Bordeaux', accent: '#7E2F3E', soft: '#F1E1E3', paper: '#FBF8F6', ink: '#3E1F25', line: '#E4CFD2' },
  gold: { ja: 'ブラック＆ゴールド', en: 'Black & gold', accent: '#8C6A22', soft: '#F2EBDC', paper: '#FFFEFB', ink: '#1F1F1F', line: '#E3D9C3' },
};
const SHAPES = {
  square: { ja: '四角', en: 'Square', d: 'M7 3.5h10a3.5 3.5 0 0 1 3.5 3.5v10a3.5 3.5 0 0 1-3.5 3.5H7A3.5 3.5 0 0 1 3.5 17V7A3.5 3.5 0 0 1 7 3.5z' },
  circle: { ja: 'まる', en: 'Circle', d: 'M12 3.2a8.8 8.8 0 1 1 0 17.6a8.8 8.8 0 1 1 0-17.6z' },
  heart: { ja: 'ハート', en: 'Heart', d: 'M12 20.3s-7.6-4.5-9.3-9.2C1.5 7.7 3.7 4.4 7.1 4.4c2 0 3.7 1.1 4.9 2.8 1.2-1.7 2.9-2.8 4.9-2.8 3.4 0 5.6 3.3 4.4 6.7-1.7 4.7-9.3 9.2-9.3 9.2z' },
  star: { ja: 'ほし', en: 'Star', d: 'M12 2.6l2.8 5.9 6.4.8-4.7 4.5 1.2 6.4L12 17.1l-5.7 3.1 1.2-6.4-4.7-4.5 6.4-.8z' },
  diamond: { ja: 'ひし形', en: 'Diamond', d: 'M12 2.8l8.6 9.2-8.6 9.2-8.6-9.2z' },
};
const TICK_D = 'M8 12.4l2.7 2.7 5.3-5.6';
const PAPERS = { plain: { ja: '無地', en: 'Plain' }, grid: { ja: '方眼', en: 'Grid' }, dot: { ja: 'ドット', en: 'Dots' }, lined: { ja: '罫線', en: 'Lined' } };
const STICKERS = {
  none: { ja: 'なし', en: 'None', ch: '' },
  star: { ja: '星', en: 'Stars', ch: '✦' },
  flower: { ja: '花', en: 'Flowers', ch: '✿' },
  heart: { ja: 'ハート', en: 'Hearts', ch: '♡' },
  cloud: { ja: 'くも', en: 'Clouds', ch: '☁' },
  // 大人っぽい飾りは小さめの記号だけで、マスキングテープは貼らない（noTape）
  twinkle: { ja: 'きらめき', en: 'Twinkle', ch: '✧', noTape: true },
  moon: { ja: '月', en: 'Moon', ch: '☾', noTape: true },
};
// 書体はテーマが決める（「ひとつずつ変える」には出さない）。round＝丸ゴシック、serif＝明朝
const TYPEFACES = { round: true, serif: true };
const DEFAULT_STYLE = { color: 'pink', shape: 'square', paper: 'plain', sticker: 'star', typeface: 'round', perPage: 1, showDate: true, showYear: false, showPlayer: false, showMemo: true, showHoles: true };

// テーマ＝色・チェックの形・紙・飾りの組み合わせ。選ぶと4つをまとめて切り替える
// （その後で1つずつ変えるのは自由。4つが一致するテーマが無ければ「カスタム」と表示する）
const THEMES = {
  // かわいい
  standard: { group: 'cute', ja: 'スタンダード', en: 'Standard', color: 'pink', shape: 'square', paper: 'plain', sticker: 'star' },
  sakura: { group: 'cute', ja: 'さくら', en: 'Sakura', color: 'pink', shape: 'heart', paper: 'dot', sticker: 'flower' },
  mintnote: { group: 'cute', ja: 'ミントノート', en: 'Mint notebook', color: 'mint', shape: 'circle', paper: 'lined', sticker: 'none' },
  yume: { group: 'cute', ja: 'ゆめかわ', en: 'Dreamy', color: 'lavender', shape: 'star', paper: 'dot', sticker: 'star' },
  lemon: { group: 'cute', ja: 'レモンティー', en: 'Lemon tea', color: 'lemon', shape: 'circle', paper: 'grid', sticker: 'flower' },
  sky: { group: 'cute', ja: '空とくも', en: 'Sky & clouds', color: 'sky', shape: 'circle', paper: 'plain', sticker: 'cloud' },
  // 大人かわいい（くすんだ色・小さな飾り）
  greige: { group: 'adult', ja: 'グレージュ', en: 'Greige', color: 'greige', shape: 'circle', paper: 'plain', sticker: 'twinkle' },
  rosemilk: { group: 'adult', ja: 'ローズミルク', en: 'Rose milk', color: 'dustyrose', shape: 'heart', paper: 'dot', sticker: 'twinkle' },
  sage: { group: 'adult', ja: 'セージグリーン', en: 'Sage green', color: 'sage', shape: 'circle', paper: 'lined', sticker: 'none' },
  kraft: { group: 'adult', ja: 'クラフト紙', en: 'Kraft paper', color: 'kraft', shape: 'square', paper: 'grid', sticker: 'star' },
  milktea: { group: 'adult', ja: 'ミルクティー', en: 'Milk tea', color: 'greige', shape: 'heart', paper: 'dot', sticker: 'flower' },
  antique: { group: 'adult', ja: 'アンティークローズ', en: 'Antique rose', color: 'dustyrose', shape: 'circle', paper: 'plain', sticker: 'moon', typeface: 'serif' },
  // シック（落ち着いた色・明朝体）
  simple: { group: 'chic', ja: 'シンプル', en: 'Simple', color: 'mono', shape: 'square', paper: 'plain', sticker: 'none' },
  notebook: { group: 'chic', ja: '方眼ノート', en: 'Graph notebook', color: 'mono', shape: 'square', paper: 'grid', sticker: 'none' },
  monotone: { group: 'chic', ja: 'モノトーン', en: 'Monotone', color: 'mono', shape: 'square', paper: 'lined', sticker: 'none', typeface: 'serif' },
  navy: { group: 'chic', ja: 'ネイビー', en: 'Navy', color: 'navy', shape: 'square', paper: 'lined', sticker: 'none', typeface: 'serif' },
  bordeaux: { group: 'chic', ja: 'ボルドー', en: 'Bordeaux', color: 'bordeaux', shape: 'diamond', paper: 'plain', sticker: 'moon', typeface: 'serif' },
  blackgold: { group: 'chic', ja: 'ブラック＆ゴールド', en: 'Black & gold', color: 'gold', shape: 'diamond', paper: 'plain', sticker: 'twinkle', typeface: 'serif' },
};
const THEME_GROUPS = [
  { key: 'cute', ja: 'かわいい', en: 'Cute' },
  { key: 'adult', ja: '大人かわいい', en: 'Grown-up cute' },
  { key: 'chic', ja: 'シック', en: 'Chic' },
];
// テーマの書体（書いていなければ丸ゴシック）
function themeField(th, f) { return f === 'typeface' ? (th.typeface || 'round') : th[f]; }
const THEME_KEYS = ['color', 'shape', 'paper', 'sticker', 'typeface'];
function currentThemeKey(style) {
  return Object.keys(THEMES).find(k => THEME_KEYS.every(f => themeField(THEMES[k], f) === style[f])) || null;
}

// 「エリアごと」の既定の行。草原・雨林・峡谷は人によって回るところが違うので、小エリアごとにチェックを並べる
// （小エリア名はノマキャン計算機プロのエリアデータ features/tai-nomacan-pro/data/areas-data.js に合わせた）
const AREA_ROWS = [
  { ja: 'ホーム', en: 'Home', spots: ['花鳥郷', '海ホーム', 'カーニバル', 'アリス'] },
  { ja: '孤島', en: 'Isle', spots: null },
  { ja: '草原', en: 'Prairie', spots: ['蝶々の住処', '草原の村', 'オレオ', '草原の神殿', '草原の洞窟', '鳥の巣', '楽園'] },
  { ja: '雨林', en: 'Forest', spots: ['前庭', '小川', '墓場', '晴れ間', '雨林の神殿', '聖なる池', 'ツリーハウス'] },
  { ja: '峡谷', en: 'Valley', spots: ['凍った湖', '陸レ', '城塞都市', '空レ', '峡谷の神殿', '夢見の町', '隠者の峠', '奏の音楽堂'] },
  { ja: '捨てられた地', en: 'Wasteland', spots: null },
  { ja: '書庫', en: 'Vault', spots: null },
];
const DYES_JA = ['赤', '黄', '緑', '水', '青', '紫', '黒', '白'];
const DYES_EN = ['Red', 'Yellow', 'Green', 'Cyan', 'Blue', 'Purple', 'Black', 'White'];

let containerEl = null;
let doc = null;    // シート一式（SHEETS_KEY）
let chk = null;    // 今日のチェック（STATE_KEY）
let editing = false;
let styling = false;
let goaling = false; // 「目標を決める」中（行をタップして目標に入れる/外す）
let tickTimer = null;
let saveTimer = null;
let onAfterPrint = null;

/* ================================================================
   公開API
   ================================================================ */
// opts.embedded: 「今日の要点」の画面（features/today）の中に埋め込む時。見出し・説明・フッターを出さない
// opts.labLinks: 埋め込んだ時も「試作中の機能」への入口を出す（#/daily-check の画面で使う）
let embedded = false;
let showLabLinks = false;
export function mount(container, opts) {
  injectStylesheet();
  containerEl = container;
  embedded = !!(opts && typeof opts === 'object' && opts.embedded);
  showLabLinks = !embedded || !!(opts && opts.labLinks);
  editing = false;
  styling = false;
  goaling = false;
  doc = loadDoc();
  chk = loadChecks();
  rollOverIfNeeded();
  container.innerHTML = `<div class="daily-check-view${embedded ? ' is-embedded' : ''}"></div>`;
  render();
  const root = viewRoot();
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  tickTimer = setInterval(onTick, 30000);
}

export function unmount() {
  clearInterval(tickTimer); tickTimer = null;
  flushSave();
  if (onAfterPrint) { window.removeEventListener('afterprint', onAfterPrint); onAfterPrint = null; }
  document.documentElement.classList.remove('dc-printing');
  closeConfirm(true);
  document.querySelector('.dc-share-overlay')?.remove();
  document.querySelector('.dc-toast')?.remove();
  containerEl = null;
}

function injectStylesheet() {
  if (document.getElementById(STYLE_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_LINK_ID;
  link.rel = 'stylesheet';
  link.href = new URL('../../css/daily-check.css', import.meta.url).href;
  document.head.appendChild(link);
}
function viewRoot() { return containerEl && containerEl.querySelector('.daily-check-view'); }

/* ================================================================
   保存・読み込み
   ================================================================ */
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
const box = label => ({ t: 'box', label });
const num = label => ({ t: 'num', label });
const row = (label, opts, cols) => ({ id: genId(), label, opts, ...(cols ? { cols } : {}) });

function templateSheet(title) {
  const en = CURRENT_LANG === 'en';
  return {
    id: genId(),
    title: title || t('毎日のチェック', 'Daily checklist'),
    autoReset: true,
    style: { ...DEFAULT_STYLE },
    sections: [
      {
        id: genId(),
        title: t('デイリー', 'Dailies'),
        rows: [
          row(t('大キャン', 'Big candles'), ['1本', '2本', '3本', '4本'].map((l, i) => box(en ? String(i + 1) : l))),
          row(t('クエスト', 'Quests'), [num(t('個まで', 'done')), box(t('すべて完了', 'All done'))]),
          row(t('パン焼き', 'Bread baking'), ['1回', '2回'].map((l, i) => box(en ? `#${i + 1}` : l))),
          row(t('ウニ焼き', 'Geyser'), ['1回', '2回', '3回', '4回'].map((l, i) => box(en ? `#${i + 1}` : l))),
          row(t('シーキャン', 'Season candles'), [box(t('完了', 'Done'))]),
          row(t('連れ歩き', 'Spirit walk'), [box(t('完了', 'Done'))]),
          row(t('日々チケット', 'Daily tickets'), [box(t('完了', 'Done'))]),
          row(t('染料上限', 'Dye cap'), (en ? DYES_EN : DYES_JA).map(box), 2),
        ],
      },
      {
        id: genId(),
        title: t('エリアごと', 'By area'),
        rows: AREA_ROWS.map(a => row(en ? a.en : a.ja, a.spots ? a.spots.map(box) : [box(t('完了', 'Done'))])),
      },
    ],
  };
}

// 外から読んだデータは形を確かめてから使う（壊れていたら既定のシートで始める）
function normalizeSheet(s) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.sections)) return null;
  const style = { ...DEFAULT_STYLE, ...(s.style || {}) };
  if (!COLORS[style.color]) style.color = DEFAULT_STYLE.color;
  if (!SHAPES[style.shape]) style.shape = DEFAULT_STYLE.shape;
  if (!PAPERS[style.paper]) style.paper = DEFAULT_STYLE.paper;
  if (!STICKERS[style.sticker]) style.sticker = DEFAULT_STYLE.sticker;
  if (!TYPEFACES[style.typeface]) style.typeface = DEFAULT_STYLE.typeface;
  delete style.font; // 以前の「文字」設定の名残りは捨てる
  style.perPage = style.perPage === 2 ? 2 : 1;
  ['printLeft', 'printRight', 'printLeftBottom', 'printRightBottom', 'printBottom'].forEach(k => { if (typeof style[k] !== 'string' || !style[k]) delete style[k]; });
  delete style.printLayout; delete style.paperSize; // 以前の「印刷する形」「用紙」の名残り（今はA4・1日分単位に固定）
  return {
    id: String(s.id || genId()),
    title: String(s.title || ''),
    autoReset: s.autoReset !== false,
    style,
    sections: s.sections.filter(sec => sec && Array.isArray(sec.rows)).map(sec => ({
      id: String(sec.id || genId()),
      title: String(sec.title || ''),
      rows: sec.rows.filter(r => r && Array.isArray(r.opts)).map(r => ({
        id: String(r.id || genId()),
        label: String(r.label || ''),
        ...(r.cols === 2 ? { cols: 2 } : {}),
        ...(r.goal ? { goal: true } : {}),
        opts: r.opts.filter(o => o && (o.t === 'box' || o.t === 'num')).map(o => ({ t: o.t, label: String(o.label || '') })).map((o, i, all) => (
          // 以前の既定「孤島/捨てられた地/書庫 □キャンドル回収」は「□完了」に変わった（自分で書き換えた行はそのまま）
          all.length === 1 && o.t === 'box' && o.label === 'キャンドル回収' && ['孤島', '捨てられた地', '書庫'].includes(r.label) ? { ...o, label: '完了' } : o
        )),
      })),
    })),
  };
}
function loadDoc() {
  try {
    const d = JSON.parse(localStorage.getItem(nsKey(SHEETS_KEY)));
    const sheets = d && Array.isArray(d.sheets) ? d.sheets.map(normalizeSheet).filter(Boolean) : [];
    if (sheets.length) return { activeId: sheets.some(s => s.id === d.activeId) ? d.activeId : sheets[0].id, sheets };
  } catch (e) { /* 壊れたデータは使わない */ }
  // 初めて開いた時の既定のシートもすぐ保存する（保存しないと、開くたびに行のIDが変わってチェックが消える）
  const first = templateSheet();
  const fresh = { activeId: first.id, sheets: [first] };
  try { localStorage.setItem(nsKey(SHEETS_KEY), JSON.stringify(fresh)); } catch (e) { /* 保存できなくても表示はする */ }
  return fresh;
}
function saveDoc() {
  try { localStorage.setItem(nsKey(SHEETS_KEY), JSON.stringify(doc)); } catch (e) { /* 容量不足などは今回だけ諦める */ }
}
// 文字入力のたびに書き込まないよう間引く（構造の変更はsaveDoc()で即保存）
function saveDocSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { saveTimer = null; saveDoc(); }, 300); }
function flushSave() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; saveDoc(); } }

function loadChecks() {
  try {
    const c = JSON.parse(localStorage.getItem(nsKey(STATE_KEY)));
    if (c && typeof c === 'object' && c.sheets && typeof c.sheets === 'object') return { dayKey: String(c.dayKey || ''), sheets: c.sheets };
  } catch (e) { /* 壊れたデータは使わない */ }
  return { dayKey: dayKeyNow(), sheets: {} };
}
/* ================================================================
   🔥 連続記録・通算記録日数（ほかのツールの連続記録と同じ考え方）
   どのシートでも1つチェックを付けた日（ゲーム内の日付＝太平洋時間）を「記録した日」として残す。
   チェックを外しても記録した日は消さない。今日まだ記録していなくても、前日まで続いていれば途切れていない扱い
   ================================================================ */
function loadLog() {
  try {
    const l = JSON.parse(localStorage.getItem(nsKey(LOG_KEY)));
    if (l && l.days && typeof l.days === 'object') return { days: l.days, best: Number(l.best) || 0 };
  } catch (e) { /* 壊れたデータは使わない */ }
  return { days: {}, best: 0 };
}
const dayNum = key => { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
const keyOfDayNum = n => { const dt = new Date(n * 86400000); return `${dt.getUTCFullYear()}-${dt.getUTCMonth() + 1}-${dt.getUTCDate()}`; };
function currentStreak(log) {
  const today = dayNum(dayKeyNow());
  let n = log.days[keyOfDayNum(today)] ? today : today - 1; // 今日まだなら前日から数える
  let count = 0;
  while (log.days[keyOfDayNum(n)]) { count++; n--; }
  return count;
}
function recordToday() {
  const log = loadLog();
  const key = dayKeyNow();
  if (log.days[key]) return;
  log.days[key] = 1;
  log.best = Math.max(log.best, currentStreak(log));
  try { localStorage.setItem(nsKey(LOG_KEY), JSON.stringify(log)); } catch (e) { /* 容量不足などは今回だけ諦める */ }
  const el = viewRoot() && viewRoot().querySelector('.dc-streak-wrap');
  if (el) el.innerHTML = streakInnerHtml();
}
function streakHtml() { return `<div class="dc-streak-wrap">${streakInnerHtml()}</div>`; }
function streakInnerHtml() {
  const log = loadLog();
  const cur = currentStreak(log);
  const best = Math.max(log.best, cur);
  const total = Object.keys(log.days).length;
  const recordedToday = !!log.days[dayKeyNow()];
  const main = cur > 0
    ? `<span class="dc-streak-main"><svg class="inline-icon" width="16" height="16"><use href="#i-flame"/></svg>${escapeHtml(t(`${cur}日連続で記録中`, `${cur}-day streak`))}</span>${recordedToday ? '' : `<span class="dc-streak-hint">${escapeHtml(t('今日チェックすると続きます', 'Check something today to keep it'))}</span>`}`
    : `<span class="dc-streak-main is-empty">${escapeHtml(t('チェックを付けると連続記録が始まります', 'Check something to start a streak'))}</span>`;
  const stats = total > 0
    ? `<span class="dc-streak-stats">${escapeHtml(t(`最長 ${best}日 ・ 通算 ${total}日`, `Best ${best} days · ${total} days total`))}</span>`
    : '';
  return `<div class="dc-streak">${main}${stats}</div>${total > 0 ? heatmapHtml(log) : ''}`;
}
// 直近の記録をカレンダー状に（1列＝1週間・日曜はじまり）。古い週は左、今日の週は右端
const HEATMAP_WEEKS = 12;
function heatmapHtml(log) {
  const today = dayNum(dayKeyNow());
  const todayDow = new Date(today * 86400000).getUTCDay();
  const start = today - todayDow - (HEATMAP_WEEKS - 1) * 7;
  let cells = '';
  for (let w = 0; w < HEATMAP_WEEKS; w++) {
    for (let d = 0; d < 7; d++) {
      const n = start + w * 7 + d;
      if (n > today) continue;
      const key = keyOfDayNum(n);
      const [, m, dd] = key.split('-');
      const on = !!log.days[key];
      cells += `<span class="dc-hm-cell${on ? ' on' : ''}${n === today ? ' today' : ''}" style="grid-column:${w + 1};grid-row:${d + 1}" title="${escapeHtml(`${m}/${dd}${on ? t(' 記録あり', ' recorded') : ''}`)}"></span>`;
    }
  }
  return `<details class="dc-hm"><summary>${escapeHtml(t(`記録カレンダー（直近${HEATMAP_WEEKS}週）`, `Log calendar (last ${HEATMAP_WEEKS} weeks)`))}</summary>
    <div class="dc-hm-grid" role="img" aria-label="${escapeHtml(t('記録した日のカレンダー', 'Calendar of recorded days'))}">${cells}</div>
    <div class="dc-hm-legend"><span class="dc-hm-cell"></span>${escapeHtml(t('記録なし', 'None'))}<span class="dc-hm-cell on"></span>${escapeHtml(t('記録あり', 'Recorded'))}</div>
  </details>`;
}

function saveChecks() {
  try { localStorage.setItem(nsKey(STATE_KEY), JSON.stringify(chk)); } catch (e) { /* 同上 */ }
}

/* ================================================================
   日付とリセット（太平洋時間の0時＝日本時間で夏時間中16時・それ以外17時）
   ================================================================ */
function dayKeyNow() {
  const p = ptParts(Date.now());
  return `${p.year}-${p.month}-${p.day}`;
}
function nextReset() {
  const p = ptParts(Date.now());
  return ptToReal(p.year, p.month, p.day + 1, 0, 0, 0);
}
// 日が変わっていたら、自動リセットがオンのシートのチェックを外す（オフのシートはそのまま残す）
function rollOverIfNeeded() {
  const today = dayKeyNow();
  if (chk.dayKey === today) return false;
  doc.sheets.forEach(s => { if (s.autoReset) delete chk.sheets[s.id]; });
  chk.dayKey = today;
  saveChecks();
  return true;
}
function onTick() {
  if (!containerEl) return;
  if (rollOverIfNeeded()) render();
  else updateResetInfo();
}
function two(n) { return String(n).padStart(2, '0'); }
function resetInfoText() {
  const next = nextReset();
  const ms = Math.max(0, next - Date.now());
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  const at = `${next.getMonth() + 1}/${next.getDate()} ${two(next.getHours())}:${two(next.getMinutes())}`;
  return t(`次の自動リセット ${at}（あと${h}時間${m}分）`, `Next reset ${at} (in ${h}h ${m}m)`);
}
function updateResetInfo() {
  const el = viewRoot() && viewRoot().querySelector('.dc-reset-next');
  if (el) el.textContent = resetInfoText();
}

/* ================================================================
   参照ヘルパー
   ================================================================ */
function activeSheet() { return doc.sheets.find(s => s.id === doc.activeId) || doc.sheets[0]; }
function findRow(sheet, rowId) {
  for (const sec of sheet.sections) {
    const i = sec.rows.findIndex(r => r.id === rowId);
    if (i !== -1) return { sec, row: sec.rows[i], index: i };
  }
  return null;
}
function rowChecks(sheet, rowId, create) {
  if (!chk.sheets[sheet.id]) { if (!create) return {}; chk.sheets[sheet.id] = {}; }
  const sc = chk.sheets[sheet.id];
  if (!sc[rowId]) { if (!create) return {}; sc[rowId] = {}; }
  return sc[rowId];
}
// 進み具合は「目標に入れた項目（行）のうち、1つでもチェックしたものの数」で数える
// （大キャンなら何本目かに関わらず、1つ付いていれば済み）。目標を決めていなければ total は0で、表示しない
function progress(sheet) {
  let done = 0, total = 0;
  sheet.sections.forEach(sec => sec.rows.forEach(r => {
    if (!r.goal || !r.opts.length) return;
    total++;
    const c = rowChecks(sheet, r.id, false);
    if (r.opts.some((o, i) => c[i])) done++;
  }));
  return { done, total };
}
// 行・見出し・シートが「全部済んだ」か（はんこ・見出しの色が変わる演出に使う）
function rowDone(sheet, r) {
  if (!r.opts.length) return false;
  const c = rowChecks(sheet, r.id, false);
  return r.opts.every((o, i) => c[i]);
}
function sectionDone(sheet, sec) {
  const rows = sec.rows.filter(r => r.opts.length);
  return rows.length > 0 && rows.every(r => rowDone(sheet, r));
}
// 目標を決めていれば「目標が全部済んだ」、決めていなければ「全部の行が済んだ」でシート完了
function sheetComplete(sheet) {
  const p = progress(sheet);
  if (p.total) return p.done === p.total;
  const secs = sheet.sections.filter(sec => sec.rows.some(r => r.opts.length));
  return secs.length > 0 && secs.every(sec => sectionDone(sheet, sec));
}

function sheetVars(style) {
  const c = COLORS[style.color];
  return `--dc-accent:${c.accent};--dc-soft:${c.soft};--dc-paper:${c.paper};--dc-ink:${c.ink};--dc-line:${c.line};`;
}

/* ================================================================
   描画
   ================================================================ */
function render() {
  const root = viewRoot();
  if (!root) return;
  const sheet = activeSheet();
  root.innerHTML = `
    <div class="dc-wrap">
      ${embedded ? '' : `<header class="dc-head">
        <h1 class="dc-h1"><svg class="inline-icon dc-h1-ic" width="20" height="20" aria-hidden="true"><use href="#i-sparkle"/></svg>${escapeHtml(t('デイリーチェックシート', 'Daily Checklist'))}<span class="dc-beta">${escapeHtml(t('試作', 'Preview'))}</span></h1>
        <p class="dc-lead">${escapeHtml(t('毎日の予定をチェックできるシートです。印刷して紙で記録することもできます。', 'A checklist for your daily routine. You can also print it and keep a paper log.'))}</p>
      </header>`}
      ${tabsHtml(sheet)}
      ${toolbarHtml(sheet)}
      ${styling ? stylePanelHtml(sheet) : ''}
      ${paperHtml(sheet, { mode: editing ? 'edit' : 'screen' })}
      ${editing ? sheetAdminHtml() : ''}
      ${showLabLinks ? labLinksHtml() : ''}
      ${embedded ? '' : `<footer class="dc-footer">
        <span>${escapeHtml(t('このサイトはSky 星を紡ぐ子どもたちの非公式ファンサイトです。thatgamecompanyは一切関与していません。', 'This is an unofficial fan site for Sky: Children of the Light. thatgamecompany is not involved in any way.'))}</span><br>
        <span>${escapeHtml(t('作成・ご意見:', 'Created by / feedback:'))}</span> <a href="https://x.com/Skyzztai" target="_blank" rel="noopener noreferrer">@Skyzztai</a>　／　<a href="https://odaibako.net/u/Skyzztai" target="_blank" rel="noopener noreferrer">${escapeHtml(t('リクエストフォーム', 'Request form'))}</a><br>
        <a class="dc-footer-sub" href="#/tai-info">${escapeHtml(t('設定・クレジット・プライバシーポリシー', 'Settings, Credits & Privacy Policy'))}</a>
      </footer>`}
    </div>
    <div class="dc-print-area" aria-hidden="true"></div>`;
}

// 🧪 試作中の機能への入口（非公開の機能はここからだけ開ける。「今日やること」に埋め込んだ時は出さない）
function labLinksHtml() {
  return `<section class="dc-lab">
    <h2 class="dc-lab-title">${escapeHtml(t('試作中の機能', 'Lab'))}</h2>
    <div class="dc-lab-grid">${LAB_TOOLS.map(x => `<a class="dc-lab-link" href="#/${labRoute(x.id)}"><svg class="inline-icon" width="18" height="18" aria-hidden="true"><use href="#${x.icon}"/></svg><span><b>${escapeHtml(t(x.ja, x.en))}</b><small>${escapeHtml(t(x.desc.ja, x.desc.en))}</small></span></a>`).join('')}</div>
  </section>`;
}

function tabsHtml(sheet) {
  const tabs = doc.sheets.map(s => `<button type="button" class="dc-tab${s.id === sheet.id ? ' on' : ''}" data-act="tab" data-id="${escapeHtml(s.id)}" aria-pressed="${s.id === sheet.id}">${escapeHtml(s.title || t('無題のシート', 'Untitled'))}</button>`).join('');
  return `<nav class="dc-tabs" aria-label="${escapeHtml(t('シート', 'Sheets'))}">${tabs}<button type="button" class="dc-tab dc-tab-add" data-act="add-sheet">＋ ${escapeHtml(t('新しいシート', 'New sheet'))}</button></nav>`;
}

function toolbarHtml(sheet) {
  const p = progress(sheet);
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  const progressHtml = p.total ? `
      <div class="dc-progress">
        <span class="dc-progress-num">${escapeHtml(t('今日の目標', "Today's goals"))} <b>${p.done}</b> / ${p.total}</span>
        <span class="dc-progress-track" aria-hidden="true"><span style="width:${pct}%"></span></span>
      </div>` : '';
  const goalHint = goaling ? `<p class="dc-goal-hint">${escapeHtml(t('達成したい項目の「目標」をタップしてください。選んだ項目のうち、チェックした数が上に出ます。', 'Tap "Goal" on the items you want to finish. The count of checked goals appears above.'))}</p>` : '';
  return `
    <div class="dc-bar">${progressHtml}
      <div class="dc-actions">
        <div class="dc-act-group" role="group" aria-label="${escapeHtml(t('シートを整える', 'Set up'))}">
          <button type="button" class="dc-btn${goaling ? ' on' : ''}" data-act="toggle-goal" aria-pressed="${goaling}">${btnIcon('star')}${escapeHtml(goaling ? t('目標を決め終える', 'Done') : t('目標を決める', 'Set goals'))}</button>
          <button type="button" class="dc-btn${editing ? ' on' : ''}" data-act="toggle-edit" aria-pressed="${editing}">${btnIcon('edit')}${escapeHtml(editing ? t('編集を終える', 'Done editing') : t('項目を編集', 'Edit items'))}</button>
          <button type="button" class="dc-btn${styling ? ' on' : ''}" data-act="toggle-style" aria-pressed="${styling}">${btnIcon('palette')}${escapeHtml(t('着せ替え・印刷設定', 'Style & print'))}</button>
        </div>
        <div class="dc-act-group" role="group" aria-label="${escapeHtml(t('書き出す', 'Export'))}">
          <button type="button" class="dc-btn primary" data-act="print">${PRINT_ICON}${escapeHtml(t('印刷する', 'Print'))}</button>
          <button type="button" class="dc-btn" data-act="pdf">${PDF_ICON}${escapeHtml(t('PDFで保存', 'Save as PDF'))}</button>
          <button type="button" class="dc-btn" data-act="share">${btnIcon('image')}${escapeHtml(t('画像で保存・共有', 'Save / share image'))}</button>
          <button type="button" class="dc-btn danger dc-btn-quiet" data-act="sheet-del">${btnIcon('trash')}${escapeHtml(t('このシートを削除', 'Delete sheet'))}</button>
        </div>
      </div>${goalHint}
      ${streakHtml()}
      <div class="dc-reset">
        <span class="dc-reset-next">${escapeHtml(resetInfoText())}</span>
        <span class="dc-reset-note">${escapeHtml(sheet.autoReset
    ? t('毎日 日本時間16時（サマータイム中）・17時（それ以外）にチェックが外れます', 'Checks clear daily at the in-game reset (4 pm JST in daylight time, 5 pm otherwise)')
    : t('このシートは自動リセットしません', 'Auto reset is off for this sheet'))}</span>
        <button type="button" class="dc-link" data-act="clear-today">${escapeHtml(t('今日のチェックを全部外す', 'Clear today'))}</button>
      </div>
    </div>`;
}

// ツールバーのボタンのアイコン（共有スプライト）。印刷はスプライトに無いので線画をその場で描く
function btnIcon(id) { return `<svg class="inline-icon dc-btn-ic" width="15" height="15" aria-hidden="true"><use href="#i-${id}"/></svg>`; }
const PDF_ICON = '<svg class="dc-btn-ic" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3.5H7A2.5 2.5 0 0 0 4.5 6v12A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5V9z"/><path d="M14 3.5V9h5.5"/><path d="M12 12v5m-2.2-2.2L12 17l2.2-2.2"/></svg>';
const PRINT_ICON = '<svg class="dc-btn-ic" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14h10v6.5H7z"/></svg>';

function chipGroup(label, key, options, current) {
  const chips = Object.keys(options).map(k => {
    const o = options[k];
    const swatch = key === 'color' ? `<span class="dc-swatch" style="background:${o.accent}"></span>` : '';
    const shape = key === 'shape' ? `<svg class="dc-chip-shape" viewBox="0 0 24 24" aria-hidden="true"><path d="${o.d}"/></svg>` : '';
    const sticker = key === 'sticker' && o.ch ? `<span class="dc-chip-sticker">${o.ch}</span>` : '';
    return `<button type="button" class="dc-chip${String(current) === k ? ' on' : ''}" data-act="style" data-k="${key}" data-v="${k}" aria-pressed="${String(current) === k}">${swatch}${shape}${sticker}${escapeHtml(t(o.ja, o.en))}</button>`;
  }).join('');
  return `<div class="dc-style-row"><span class="dc-style-label">${escapeHtml(label)}</span><div class="dc-chips">${chips}</div></div>`;
}
function themeGroupHtml(st) {
  const cur = currentThemeKey(st);
  const card = (k) => {
    const th = THEMES[k];
    const c = COLORS[th.color];
    const on = cur === k;
    const ch = STICKERS[th.sticker].ch;
    return `<button type="button" class="dc-theme${on ? ' on' : ''}" data-act="theme" data-v="${k}" aria-pressed="${on}">
      <span class="dc-theme-swatch paper-${th.paper} font-${themeField(th, 'typeface')}" style="--dc-accent:${c.accent};--dc-paper:${c.paper};--dc-ink:${c.ink};--dc-line:${c.line};--dc-soft:${c.soft}">
        ${ch ? `<span class="dc-theme-stk">${ch}</span>` : ''}
        <span class="dc-theme-line"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="dc-shape on" d="${SHAPES[th.shape].d}"/><path class="dc-tick" d="${TICK_D}"/></svg><span class="dc-theme-bar"></span></span>
        <span class="dc-theme-line"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="dc-shape" d="${SHAPES[th.shape].d}"/></svg><span class="dc-theme-bar short"></span></span>
      </span>
      <span class="dc-theme-name font-${themeField(th, 'typeface')}">${escapeHtml(t(th.ja, th.en))}</span>
    </button>`;
  };
  const groups = THEME_GROUPS.map(g => {
    const keys = Object.keys(THEMES).filter(k => THEMES[k].group === g.key);
    // まとまりには名前を出さず、細い線で区切るだけにする
    return `<div class="dc-theme-group" role="group" aria-label="${escapeHtml(t(g.ja, g.en))}"><div class="dc-themes">${keys.map(card).join('')}</div></div>`;
  }).join('');
  return `<div class="dc-style-row"><span class="dc-style-label">${escapeHtml(t('テーマ', 'Theme'))}${cur ? '' : `<span class="dc-custom-tag">${escapeHtml(t('カスタム', 'Custom'))}</span>`}</span>${groups}</div>`;
}
// 印刷するシートの選び方。2日分は左右（それぞれ上・下）、1日分は上（＝今のシート）と下。
// 「下」は、上のシートと下のシートがどちらも半分の高さに収まって上下2段で印刷する時だけ使う（初期値は上と同じシート）。
// 小さいシートなら、2日分で最大4枚を1度に印刷できる
function printPairHtml(sheet) {
  const st = sheet.style;
  const opts = (cur, withSame) => (withSame ? `<option value=""${cur ? '' : ' selected'}>${escapeHtml(t('（上と同じ）', '(same as top)'))}</option>` : '')
    + doc.sheets.map(s => `<option value="${escapeHtml(s.id)}"${s.id === cur ? ' selected' : ''}>${escapeHtml(s.title || t('無題のシート', 'Untitled'))}</option>`).join('');
  const sel = (key, label, cur, withSame) => `<label class="dc-pair"><span>${escapeHtml(label)}</span><select class="dc-pair-select" data-print-side="${key}">${opts(cur, withSame)}</select></label>`;
  const valid = id => (id && doc.sheets.some(s => s.id === id) ? id : '');
  let body;
  if (st.perPage === 2) {
    const [left, right] = printPairSheets(sheet).map(s => s.id);
    body = `<div class="dc-pairs dc-pairs-grid">
      ${sel('printLeft', t('左・上', 'Left, top'), left, false)}${sel('printRight', t('右・上', 'Right, top'), right, false)}
      ${sel('printLeftBottom', t('左・下', 'Left, bottom'), valid(st.printLeftBottom), true)}${sel('printRightBottom', t('右・下', 'Right, bottom'), valid(st.printRightBottom), true)}
    </div>`;
  } else {
    body = `<div class="dc-pairs"><span class="dc-pair"><span>${escapeHtml(t('上', 'Top'))}</span><b>${escapeHtml(sheet.title || t('無題のシート', 'Untitled'))}</b></span>${sel('printBottom', t('下', 'Bottom'), valid(st.printBottom), true)}</div>`;
  }
  return `<div class="dc-style-row"><span class="dc-style-label">${escapeHtml(t('印刷するシート', 'Sheets to print'))}</span>${body}
    <p class="dc-style-note">${escapeHtml(t('「下」は、上のシートと下のシートがどちらも小さく、紙の上半分と下半分に収まる時だけ印刷されます。大きいシートの時は上のシートを1枚で大きく印刷します。', '"Bottom" is used only when both the top and bottom sheets are small enough to fit in half the page. Otherwise the top sheet is printed full size.'))}</p></div>`;
}
function printPairSheets(sheet) {
  const find = id => doc.sheets.find(s => s.id === id) || sheet;
  return [find(sheet.style.printLeft), find(sheet.style.printRight)];
}
// 列ごとの { top, bottom }（下が未選択・削除済みなら上と同じ）
function printColumns(sheet) {
  const find = (id, fallback) => doc.sheets.find(s => s.id === id) || fallback;
  if (sheet.style.perPage === 2) {
    const [left, right] = printPairSheets(sheet);
    return [{ top: left, bottom: find(sheet.style.printLeftBottom, left) }, { top: right, bottom: find(sheet.style.printRightBottom, right) }];
  }
  return [{ top: sheet, bottom: find(sheet.style.printBottom, sheet) }];
}
function stylePanelHtml(sheet) {
  const st = sheet.style;
  const onOff = (k, val, label) => `<label class="dc-switch"><input type="checkbox" data-style-check="${k}"${val ? ' checked' : ''}><span>${escapeHtml(label)}</span></label>`;
  return `
    <section class="dc-panel" aria-label="${escapeHtml(t('着せ替え・印刷設定', 'Style & print'))}">
      ${themeGroupHtml(st)}
      <div class="dc-style-sub">${escapeHtml(t('ひとつずつ変える', 'Customize'))}</div>
      ${chipGroup(t('色', 'Color'), 'color', COLORS, st.color)}
      ${chipGroup(t('チェックの形', 'Check shape'), 'shape', SHAPES, st.shape)}
      ${chipGroup(t('紙', 'Paper'), 'paper', PAPERS, st.paper)}
      ${chipGroup(t('飾り', 'Decoration'), 'sticker', STICKERS, st.sticker)}
      ${chipGroup(t('1枚に', 'Per page'), 'perPage', { 1: { ja: '1日分（縦）', en: '1 day (portrait)' }, 2: { ja: '2日分（横に並べる）', en: '2 days side by side' } }, st.perPage)}
      <p class="dc-style-note">${escapeHtml(st.perPage === 2
    ? t('A4を横向きにして、左右に1枚ずつ並べて印刷します。真ん中の点線で切ると、A5サイズのシートが2枚になります。項目が少ないシートは、その側の上半分と下半分に1回ずつ印刷します。', 'Prints two sheets side by side on landscape A4. Cut along the center line to get two A5 sheets. A short sheet is printed twice on its side, top and bottom.')
    : t('A4の縦向きで印刷します。項目が少なく半分の高さに収まるシートは、上半分と下半分に1回ずつ印刷します。', 'Prints on portrait A4. A short sheet that fits in half the height is printed twice, top and bottom.'))}</p>
      ${printPairHtml(sheet)}
      <div class="dc-style-row"><span class="dc-style-label">${escapeHtml(t('その他', 'Other'))}</span><div class="dc-chips">
        ${onOff('showDate', st.showDate, t('日付の欄', 'Date field'))}
        ${st.showDate ? onOff('showYear', st.showYear, t('日付に年も入れる', 'Include the year')) : ''}
        ${onOff('showPlayer', st.showPlayer, t('プレイヤー名の欄', 'Player name field'))}
        ${onOff('showMemo', st.showMemo, t('メモの欄', 'Memo field'))}
        ${onOff('showHoles', st.showHoles, t('穴あけの目印（●）', 'Punch hole marks (●)'))}
        ${onOff('autoReset', sheet.autoReset, t('毎日自動でリセット', 'Reset every day'))}
      </div></div>
    </section>`;
}

function shapeSvg(style, on) {
  return `<svg class="dc-box-svg" viewBox="0 0 24 24" aria-hidden="true"><path class="dc-shape" d="${SHAPES[style.shape].d}"/>${on ? `<path class="dc-tick" d="${TICK_D}"/>` : ''}</svg>`;
}
function stickersHtml(style) {
  const ch = STICKERS[style.sticker].ch;
  if (!ch) return '';
  // 飾りがあるテーマでは、左上と右下の角にマスキングテープも貼る（紙の端で切れて、貼ってあるように見える）。
  // 大人っぽい飾り（きらめき・月）はテープなし
  const tape = STICKERS[style.sticker].noTape ? '' : `<span class="dc-tape t1" aria-hidden="true"></span><span class="dc-tape t2" aria-hidden="true"></span>`;
  return tape + `<span class="dc-stk s1" aria-hidden="true">${ch}</span><span class="dc-stk s2" aria-hidden="true">${ch}</span><span class="dc-stk s3" aria-hidden="true">${ch}</span>`;
}
// 全部済んだ日に紙に押される「よくできました」のはんこ（画面のみ。印刷・画像には出さない）
function stampHtml() {
  return `<div class="dc-stamp" role="status"><span class="dc-stamp-sub">${escapeHtml(t('よく', 'Well'))}</span><span class="dc-stamp-main">${escapeHtml(t('できました', 'done!'))}</span></div>`;
}
function todayLabel(withYear) {
  // 表示上の「今日」はゲーム内の日付（太平洋時間）。リセット前の16時台は前日扱いになる
  const [y, m, d] = dayKeyNow().split('-').map(Number);
  const wd = t('日月火水木金土', 'SMTWTFS')[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return withYear ? t(`${y}年${m}月${d}日（${wd}）`, `${y}/${m}/${d} (${wd})`) : t(`${m}月${d}日（${wd}）`, `${m}/${d} (${wd})`);
}

// mode: 'screen'（チェックできる）/ 'edit'（文言・構成を編集）/ 'print'（空欄の印刷用）
function paperHtml(sheet, { mode }) {
  const st = sheet.style;
  const dateHtml = st.showDate
    ? (mode === 'print'
      ? `<div class="dc-date">${escapeHtml(st.showYear ? t('　　　　年　　月　　日（　　）', 'Date: ____/____/____') : t('　　月　　日（　　）', 'Date: ______'))}</div>`
      : `<div class="dc-date">${escapeHtml(todayLabel(st.showYear))}</div>`)
    : '';
  // プレイヤー名は手書きで書き込む欄（画面でも印刷でも下線だけ）
  const playerHtml = st.showPlayer && mode !== 'edit'
    ? `<div class="dc-player"><span class="dc-player-label">${escapeHtml(t('プレイヤー名', 'Player'))}</span><span class="dc-player-line"></span></div>`
    : '';
  const titleHtml = mode === 'edit'
    ? `<input class="dc-in dc-in-title" data-edit="sheet-title" value="${escapeHtml(sheet.title)}" placeholder="${escapeHtml(t('シートの名前', 'Sheet name'))}" aria-label="${escapeHtml(t('シートの名前', 'Sheet name'))}">`
    : `<h2 class="dc-title">${escapeHtml(sheet.title)}</h2>`;
  const sections = sheet.sections.map(sec => sectionHtml(sheet, sec, mode)).join('');
  const addSection = mode === 'edit' ? `<button type="button" class="dc-add dc-add-sec" data-act="sec-add">＋ ${escapeHtml(t('見出しを追加', 'Add heading'))}</button>` : '';
  const memo = st.showMemo && mode !== 'edit'
    ? `<div class="dc-memo"><span class="dc-memo-label">${escapeHtml(t('メモ', 'Memo'))}</span>${mode === 'print' ? '<span class="dc-memo-lines"></span>' : '<span class="dc-memo-lines short"></span>'}</div>`
    : '';
  return `
    <article class="dc-paper paper-${st.paper} font-${st.typeface}${mode === 'edit' ? ' editing' : ''}${mode === 'screen' && sheetComplete(sheet) ? ' complete' : ''}" style="${sheetVars(st)}">
      ${stickersHtml(st)}${mode === 'screen' ? stampHtml() : ''}
      <div class="dc-paper-head">${titleHtml}${dateHtml}</div>${playerHtml}
      ${sections}${addSection}${memo}
    </article>`;
}

function sectionHtml(sheet, sec, mode) {
  const head = mode === 'edit'
    ? `<div class="dc-sec-head"><input class="dc-in dc-in-sec" data-edit="sec-title" data-s="${escapeHtml(sec.id)}" value="${escapeHtml(sec.title)}" placeholder="${escapeHtml(t('見出し', 'Heading'))}" aria-label="${escapeHtml(t('見出し', 'Heading'))}"><button type="button" class="dc-mini danger" data-act="sec-del" data-s="${escapeHtml(sec.id)}">${escapeHtml(t('見出しごと削除', 'Delete heading'))}</button></div>`
    : (sec.title ? `<h3 class="dc-sec"><span class="dc-sec-done" aria-hidden="true">✓</span>${escapeHtml(sec.title)}</h3>` : '');
  const rows = sec.rows.map((r, i) => rowHtml(sheet, sec, r, i, mode)).join('');
  const add = mode === 'edit' ? `<button type="button" class="dc-add" data-act="row-add" data-s="${escapeHtml(sec.id)}">＋ ${escapeHtml(t('行を追加', 'Add row'))}</button>` : '';
  const done = mode === 'screen' && sectionDone(sheet, sec);
  return `<section class="dc-section${done ? ' done' : ''}" data-s="${escapeHtml(sec.id)}">${head}<div class="dc-rows">${rows}</div>${add}</section>`;
}

function rowHtml(sheet, sec, r, index, mode) {
  const st = sheet.style;
  const rid = escapeHtml(r.id);
  if (mode === 'edit') {
    const opts = r.opts.map((o, i) => `
      <span class="dc-edit-opt">
        ${shapeSvg(st, false)}${o.t === 'num' ? '<span class="dc-num-blank">＿</span>' : ''}
        <input class="dc-in dc-in-opt" data-edit="opt-label" data-r="${rid}" data-i="${i}" value="${escapeHtml(o.label)}" size="${Math.max(3, o.label.length + 1)}" aria-label="${escapeHtml(t('チェックの名前', 'Checkbox label'))}">
        <button type="button" class="dc-x" data-act="opt-del" data-r="${rid}" data-i="${i}" aria-label="${escapeHtml(t('このチェックを削除', 'Remove checkbox'))}">×</button>
      </span>`).join('');
    return `
      <div class="dc-row editing">
        <div class="dc-row-edit-head">
          <input class="dc-in dc-in-label" data-edit="row-label" data-r="${rid}" value="${escapeHtml(r.label)}" placeholder="${escapeHtml(t('項目名', 'Item'))}" aria-label="${escapeHtml(t('項目名', 'Item'))}">
          <span class="dc-row-tools">
            <button type="button" class="dc-mini" data-act="row-up" data-r="${rid}"${index === 0 ? ' disabled' : ''} aria-label="${escapeHtml(t('上へ', 'Move up'))}">↑</button>
            <button type="button" class="dc-mini" data-act="row-down" data-r="${rid}"${index === sec.rows.length - 1 ? ' disabled' : ''} aria-label="${escapeHtml(t('下へ', 'Move down'))}">↓</button>
            <button type="button" class="dc-mini danger" data-act="row-del" data-r="${rid}">${escapeHtml(t('行を削除', 'Delete row'))}</button>
          </span>
        </div>
        <div class="dc-opts">${opts}
          <button type="button" class="dc-mini" data-act="opt-add-box" data-r="${rid}">＋ ${escapeHtml(t('チェック', 'Checkbox'))}</button>
          <button type="button" class="dc-mini" data-act="opt-add-num" data-r="${rid}">＋ ${escapeHtml(t('数を書くチェック', 'Count box'))}</button>
          <button type="button" class="dc-mini${r.cols === 2 ? ' on' : ''}" data-act="row-cols" data-r="${rid}" aria-pressed="${r.cols === 2}">${escapeHtml(t('2列で並べる', 'Two columns'))}</button>
        </div>
      </div>`;
  }
  const c = mode === 'screen' ? rowChecks(sheet, r.id, false) : {};
  const opts = r.opts.map((o, i) => {
    const on = !!c[i];
    if (mode === 'print') {
      return `<span class="dc-opt">${shapeSvg(st, false)}${o.t === 'num' ? '<span class="dc-num-line"></span>' : ''}<span class="dc-opt-label">${escapeHtml(o.label)}</span></span>`;
    }
    const boxBtn = `<button type="button" class="dc-box${on ? ' on' : ''}" role="checkbox" aria-checked="${on}" data-act="check" data-r="${rid}" data-i="${i}" aria-label="${escapeHtml(`${r.label} ${o.label}`)}">${shapeSvg(st, on)}${o.t === 'box' ? `<span class="dc-opt-label">${escapeHtml(o.label)}</span>` : ''}</button>`;
    if (o.t === 'num') {
      return `<span class="dc-opt dc-opt-num">${boxBtn}<input class="dc-num" type="number" inputmode="numeric" min="0" max="999" data-edit="num" data-r="${rid}" data-i="${i}" value="${escapeHtml(c[i + 'n'] || '')}" aria-label="${escapeHtml(`${r.label} ${o.label}`)}"><span class="dc-opt-label">${escapeHtml(o.label)}</span></span>`;
    }
    return boxBtn;
  }).join('');
  const allDone = mode === 'screen' && r.opts.length > 0 && r.opts.every((o, i) => c[i]);
  const goalMark = r.goal && !goaling ? `<span class="dc-goal-mark" title="${escapeHtml(t('目標', 'Goal'))}" aria-label="${escapeHtml(t('目標', 'Goal'))}">★</span>` : '';
  const goalBtn = goaling && mode === 'screen'
    ? `<button type="button" class="dc-goal-btn${r.goal ? ' on' : ''}" data-act="goal" data-r="${rid}" aria-pressed="${!!r.goal}">${r.goal ? '★' : '☆'} ${escapeHtml(t('目標', 'Goal'))}</button>` : '';
  return `<div class="dc-row${allDone ? ' done' : ''}${r.goal ? ' is-goal' : ''}"><span class="dc-label">${goalMark}${escapeHtml(r.label)}${goalBtn}</span><span class="dc-opts${r.cols === 2 ? ' cols-2' : ''}">${opts}</span></div>`;
}

function sheetAdminHtml() {
  return `
    <div class="dc-admin">
      <button type="button" class="dc-btn" data-act="sheet-dup">${escapeHtml(t('このシートを複製', 'Duplicate sheet'))}</button>
      <button type="button" class="dc-btn" data-act="sheet-template">${escapeHtml(t('はじめの内容に戻す', 'Reset to template'))}</button>
    </div>`;
}

/* ── 印刷のレイアウト（A4固定。位置はすべて、印刷の余白8mmの内側を原点としたmm）──
   左端は穴あけ用に空ける。穴の目印●は市販の2穴パンチ（穴の中心が紙の端から12mm・2つの穴の間隔80mm）に合わせ、
   縮小しない外枠に置く（シートだけを縮めるので、●の位置はmmのまま正確に出る）。
   2日分（横向き）は真ん中（用紙の端から148.5mm）に切り取り線。切るとA5が2枚になり、右のシートは切り取り線が左端になる */
const PRINT_MARGIN_MM = 8;
const PX_PER_MM = 96 / 25.4;
const HOLE_FROM_EDGE_MM = 12;
const HOLE_GAP_MM = 80;
// w,h: 余白の内側の大きさ（hは丸め誤差で2枚目にはみ出さないよう2mm控える）。
// sides: シートを置く列（縦は1列、2日分は左右2列）。x,w: シートの位置と幅、x0〜x1: その列の範囲（上下の区切り線を引く範囲）、
// midY: 用紙の上下の真ん中（用紙の端から148.5mm／105mm）。holes: ●の中心
const LAYOUTS = {
  portrait: {
    w: 194, h: 279,
    sides: [{ x: 14, w: 180, x0: 0, x1: 194, midY: 140.5 }],
    holes: [[HOLE_FROM_EDGE_MM - PRINT_MARGIN_MM, 140.5 - HOLE_GAP_MM / 2], [HOLE_FROM_EDGE_MM - PRINT_MARGIN_MM, 140.5 + HOLE_GAP_MM / 2]],
    cut: null,
  },
  landscape: {
    w: 281, h: 192,
    sides: [{ x: 14, w: 118.5, x0: 0, x1: 140.5, midY: 97 }, { x: 162.5, w: 118.5, x0: 140.5, x1: 281, midY: 97 }],
    holes: [
      [HOLE_FROM_EDGE_MM - PRINT_MARGIN_MM, 97 - HOLE_GAP_MM / 2], [HOLE_FROM_EDGE_MM - PRINT_MARGIN_MM, 97 + HOLE_GAP_MM / 2],
      [140.5 + HOLE_FROM_EDGE_MM, 97 - HOLE_GAP_MM / 2], [140.5 + HOLE_FROM_EDGE_MM, 97 + HOLE_GAP_MM / 2],
    ],
    cut: 140.5,
  },
};
const STACK_GAP_MM = 6.5; // 上下に2回印刷する時の、区切り線から上下のシートまでの間隔

// その列にシートを置く枠。stack なら上半分と下半分に1つずつ
function sideSlots(layout, side, stack) {
  if (!stack) return [{ x: side.x, y: 0, w: side.w, h: layout.h }];
  const bottomY = side.midY + STACK_GAP_MM;
  return [{ x: side.x, y: 0, w: side.w, h: side.midY - STACK_GAP_MM }, { x: side.x, y: bottomY, w: side.w, h: layout.h - bottomY }];
}

// シート1枚を枠（px）に収まる縮小率を求める。縮めると横幅に余裕ができて折り返しが減り高さが変わるので、
// 幅を広げて測り直すのを数回くり返す
function fitScale(paper, availW, availH) {
  let scale = 1;
  for (let k = 0; k < 10; k++) {
    paper.style.width = `${availW / scale}px`;
    const next = Math.min(1, availH / paper.scrollHeight);
    if (Math.abs(next - scale) < 0.003) { scale = next; break; }
    scale = next;
  }
  paper.style.width = `${availW / scale}px`;
  for (let k = 0; k < 20 && paper.scrollHeight * scale > availH; k++) {
    scale *= 0.97;
    paper.style.width = `${availW / scale}px`;
  }
  // 印刷時は文字の配置が画面で測った時とわずかにずれることがある（縮小率が小さいほど大きい）ので、3%余裕を持たせる
  return scale < 1 ? scale * 0.97 : 1;
}

// 項目が少ないシートは、その列の上半分と下半分に1回ずつ印刷する（メモが紙の大半を占めないように）。
// 半分の高さに入れた時の縮小率が、列いっぱいに入れた時のこの割合以上（＝あまり縮めずに収まる）なら上下2回にする
const STACK_MIN_RATIO = 0.85;

// plan: 列ごとの { sheet, bottom, stack }（bottom は上下2段の時の下のシート）。枠・区切り線・●を描き、各シートの要素と枠を返す
function renderPrintArea(area, layout, plan, showHoles) {
  const mm = v => `${v}mm`;
  const slots = [];
  plan.forEach((p, i) => sideSlots(layout, layout.sides[i], p.stack).forEach((sl, j) => slots.push({ ...sl, sheet: j === 1 ? (p.bottom || p.sheet) : p.sheet })));
  area.innerHTML = `
    <div class="dc-print-sheet" style="width:${mm(layout.w)};height:${mm(layout.h)}">
      ${slots.map(sl => `<div class="dc-slot" style="left:${mm(sl.x)};top:${mm(sl.y)};width:${mm(sl.w)};height:${mm(sl.h)}">${paperHtml(sl.sheet, { mode: 'print' })}</div>`).join('')}
      ${layout.cut != null ? `<div class="dc-cut" style="left:${mm(layout.cut)}"></div>` : ''}
      ${plan.map((p, i) => (p.stack ? `<div class="dc-cut-h" style="top:${mm(layout.sides[i].midY)};left:${mm(layout.sides[i].x0)};width:${mm(layout.sides[i].x1 - layout.sides[i].x0)}"></div>` : '')).join('')}
      ${showHoles ? layout.holes.map(([x, y]) => `<span class="dc-hole" style="left:${mm(x)};top:${mm(y)}"></span>`).join('') : ''}
    </div>`;
  return { papers: [...area.querySelectorAll('.dc-slot > .dc-paper')], slots };
}
// 列ごとの縮小率（上下2回なら2つのうち小さい方）
function sideScales(rendered, plan) {
  const out = [];
  let k = 0;
  plan.forEach((p) => {
    const n = p.stack ? 2 : 1;
    let sc = 1;
    for (let j = 0; j < n; j++, k++) sc = Math.min(sc, fitScale(rendered.papers[k], rendered.slots[k].w * PX_PER_MM, rendered.slots[k].h * PX_PER_MM));
    out.push(sc);
  });
  return out;
}

// 印刷用の面（.dc-print-area）を、印刷・PDFと同じ紙面に組み立てる（A4・向き・左右2枚・上下2回・穴の目印）
function preparePrintArea(sheet) {
  const two = sheet.style.perPage === 2;
  const layout = LAYOUTS[two ? 'landscape' : 'portrait'];
  const cols = printColumns(sheet);
  const area = viewRoot().querySelector('.dc-print-area');
  const html = document.documentElement;
  // 画面外で、印刷時と同じ見た目にして測る。列いっぱいに1回の場合と上下2段の場合を両方測り、列ごとに決める
  // （上下2段は、上と下のどちらのシートも半分の高さにあまり縮めずに収まる時だけ）
  html.classList.add('dc-measuring');
  const full = sideScales(renderPrintArea(area, layout, cols.map(c => ({ sheet: c.top, stack: false })), false), cols.map(() => ({ stack: false })));
  const stacked = sideScales(renderPrintArea(area, layout, cols.map(c => ({ sheet: c.top, bottom: c.bottom, stack: true })), false), cols.map(() => ({ stack: true })));
  const plan = cols.map((c, i) => ({ sheet: c.top, bottom: c.bottom, stack: stacked[i] >= full[i] * STACK_MIN_RATIO }));
  const rendered = renderPrintArea(area, layout, plan, sheet.style.showHoles);
  // 左右（上下）のシートは同じ縮小率にそろえる（大きさが揃って見えるように）
  const scale = Math.min(...plan.map((p, i) => (p.stack ? stacked[i] : full[i])));
  rendered.papers.forEach((paper, i) => {
    const sl = rendered.slots[i];
    paper.style.width = `${(sl.w * PX_PER_MM) / scale}px`;
    // 枠の高さいっぱいに伸ばす。項目が少なくて余った分はメモの欄が広がって埋める（.dc-print-area の flex 指定）
    paper.style.height = `${(sl.h * PX_PER_MM) / scale}px`;
    // 縮小はtransformで（zoomは画像化（html2canvas）で正しく扱えないため。左上を基準に縮めて枠にぴったり収める）
    paper.style.transform = `scale(${scale})`;
    paper.style.transformOrigin = '0 0';
    // 背景で描く細い線（メモの罫線・方眼）は縮小で1px未満になると印刷で消えるので、縮めた後も1pxになる太さを渡す
    paper.style.setProperty('--dc-hair', `${Math.max(1, 1 / scale)}px`);
  });
  html.classList.remove('dc-measuring');
  const printed = [];
  plan.forEach(p => { printed.push(p.sheet); if (p.stack) printed.push(p.bottom); });
  // 下に別のシートを選んだのに、どちらかが大きくて上下2段にできなかった列
  const skipped = plan.filter(p => !p.stack && p.bottom !== p.sheet).map(p => p.bottom);
  return { two, printed, skipped, area };
}

function notifySkipped(skipped) {
  if (!skipped.length) return;
  const names = [...new Set(skipped.map(s => `「${s.title || t('無題のシート', 'Untitled')}」`))].join('');
  showToast(t(`シートが大きく上下に分けられないため、下に選んだ${names}は印刷しません`, `${names} was not printed: the sheets are too large to split top and bottom`));
}

function doPrint() {
  const sheet = activeSheet();
  const { two, skipped } = preparePrintArea(sheet);
  notifySkipped(skipped);
  const html = document.documentElement;
  let styleEl = document.getElementById('dcPageStyle');
  if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'dcPageStyle'; document.head.appendChild(styleEl); }
  styleEl.textContent = `@page { size: A4 ${two ? 'landscape' : 'portrait'}; margin: ${PRINT_MARGIN_MM}mm; }`;

  html.classList.add('dc-printing');
  if (onAfterPrint) window.removeEventListener('afterprint', onAfterPrint);
  onAfterPrint = () => {
    html.classList.remove('dc-printing');
    document.getElementById('dcPageStyle')?.remove();
    window.removeEventListener('afterprint', onAfterPrint); onAfterPrint = null;
  };
  window.addEventListener('afterprint', onAfterPrint);
  window.print();
}

/* ================================================================
   操作
   ================================================================ */
function onClick(ev) {
  const btn = ev.target.closest('[data-act]');
  if (!btn || btn.disabled) return;
  const act = btn.dataset.act;
  const sheet = activeSheet();
  const hit = btn.dataset.r ? findRow(sheet, btn.dataset.r) : null;
  const i = Number(btn.dataset.i);

  if (act === 'check') {
    const c = rowChecks(sheet, btn.dataset.r, true);
    if (c[i]) delete c[i]; else c[i] = true;
    saveChecks();
    if (c[i]) recordToday();
    // 押したボタンだけ差し替える（行全体を描き直すと数の入力欄のフォーカスが外れるため）
    const on = !!c[i];
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-checked', String(on));
    btn.querySelector('.dc-box-svg').outerHTML = shapeSvg(sheet.style, on);
    btn.classList.remove('pop'); void btn.offsetWidth; if (on) btn.classList.add('pop');
    refreshDoneStates(btn);
    refreshProgress();
    return;
  }
  if (act === 'tab') { flushSave(); doc.activeId = btn.dataset.id; saveDoc(); render(); return; }
  if (act === 'add-sheet') {
    const s = templateSheet(t(`チェックシート${doc.sheets.length + 1}`, `Checklist ${doc.sheets.length + 1}`));
    doc.sheets.push(s); doc.activeId = s.id; editing = true; saveDoc(); render(); return;
  }
  if (act === 'toggle-edit') { flushSave(); editing = !editing; goaling = false; render(); return; }
  if (act === 'toggle-goal') { flushSave(); goaling = !goaling; editing = false; render(); return; }
  if (act === 'goal' && hit) {
    if (hit.row.goal) delete hit.row.goal; else hit.row.goal = true;
    saveDoc(); render(); return;
  }
  if (act === 'toggle-style') { styling = !styling; render(); return; }
  if (act === 'print') { flushSave(); doPrint(); return; }
  if (act === 'pdf') {
    flushSave();
    if (btn.dataset.busy) return; // 作っている間の連打を防ぐ
    btn.dataset.busy = '1';
    const { two, printed, skipped, area } = preparePrintArea(sheet);
    notifySkipped(skipped);
    const name = [...new Set(printed.map(s => s.title || t('チェックシート', 'Checklist')))].join('_');
    savePrintPdf(area, { landscape: two, marginMm: PRINT_MARGIN_MM, filename: name, onToast: showToast })
      .finally(() => { delete btn.dataset.busy; });
    return;
  }
  if (act === 'share') {
    flushSave();
    if (btn.dataset.busy) return; // 作っている間の連打を防ぐ
    btn.dataset.busy = '1';
    shareSheetImage(viewRoot(), paperHtml(sheet, { mode: 'print' }), sheet.title || t('チェックシート', 'Checklist'), showToast)
      .finally(() => { delete btn.dataset.busy; });
    return;
  }
  if (act === 'clear-today') { delete chk.sheets[sheet.id]; saveChecks(); render(); return; }
  if (act === 'theme') {
    const th = THEMES[btn.dataset.v];
    if (th) THEME_KEYS.forEach(f => { sheet.style[f] = themeField(th, f); });
    saveDoc(); render(); return;
  }
  if (act === 'style') {
    const k = btn.dataset.k;
    sheet.style[k] = k === 'perPage' ? Number(btn.dataset.v) : btn.dataset.v;
    saveDoc(); render(); return;
  }

  // ── 編集 ──
  if (act === 'row-add') {
    const sec = sheet.sections.find(s => s.id === btn.dataset.s);
    if (sec) sec.rows.push(row('', [box('1回')]));
  } else if (act === 'row-del' && hit) {
    hit.sec.rows.splice(hit.index, 1);
  } else if ((act === 'row-up' || act === 'row-down') && hit) {
    const to = hit.index + (act === 'row-up' ? -1 : 1);
    if (to < 0 || to >= hit.sec.rows.length) return;
    hit.sec.rows.splice(hit.index, 1);
    hit.sec.rows.splice(to, 0, hit.row);
  } else if (act === 'opt-del' && hit) {
    hit.row.opts.splice(i, 1);
    // 後ろの選択肢の番号が詰まるので、この行の今日のチェックは付け直してもらう
    if (chk.sheets[sheet.id]) delete chk.sheets[sheet.id][hit.row.id];
    saveChecks();
  } else if (act === 'opt-add-box' && hit) {
    hit.row.opts.push(box(`${hit.row.opts.length + 1}${t('回', '')}`));
  } else if (act === 'row-cols' && hit) {
    if (hit.row.cols === 2) delete hit.row.cols; else hit.row.cols = 2;
  } else if (act === 'opt-add-num' && hit) {
    hit.row.opts.push(num(t('個まで', 'done')));
  } else if (act === 'sec-add') {
    sheet.sections.push({ id: genId(), title: t('見出し', 'Heading'), rows: [row('', [box('1回')])] });
  } else if (act === 'sec-del') {
    const sec = sheet.sections.find(s => s.id === btn.dataset.s);
    if (!sec) return;
    const removeSec = () => { sheet.sections = sheet.sections.filter(s => s !== sec); saveDoc(); render(); };
    if (!sec.rows.length) { removeSec(); return; }
    askConfirm({
      title: t('見出しを削除しますか？', 'Delete this heading?'),
      message: t(`「${sec.title || '見出し'}」と、中の${sec.rows.length}行を削除します。`, `"${sec.title || 'Heading'}" and its ${sec.rows.length} rows will be deleted.`),
      okLabel: t('削除する', 'Delete'), danger: true, onOk: removeSec,
    });
    return;
  } else if (act === 'sheet-dup') {
    flushSave();
    const copy = normalizeSheet(JSON.parse(JSON.stringify(sheet)));
    copy.id = genId();
    copy.title = t(`${sheet.title} のコピー`, `${sheet.title} copy`);
    copy.sections.forEach(sec => { sec.id = genId(); sec.rows.forEach(r => { r.id = genId(); }); });
    doc.sheets.push(copy); doc.activeId = copy.id;
  } else if (act === 'sheet-template') {
    askConfirm({
      title: t('はじめの内容に戻しますか？', 'Reset to the template?'),
      message: t('このシートの項目と今日のチェックが、はじめの内容に戻ります。着せ替えはそのまま残ります。', 'This sheet\'s items and today\'s checks go back to the template. The style is kept.'),
      okLabel: t('戻す', 'Reset'), danger: true,
      onOk: () => {
        sheet.sections = templateSheet(sheet.title).sections;
        delete chk.sheets[sheet.id]; saveChecks();
        saveDoc(); render();
      },
    });
    return;
  } else if (act === 'sheet-del') {
    // 最後の1枚を消すとシートが無くなるので、その時ははじめの内容の新しいシートに置き換える
    const last = doc.sheets.length <= 1;
    const name = sheet.title || t('無題のシート', 'Untitled');
    askConfirm({
      title: t('シートを削除しますか？', 'Delete this sheet?'),
      message: last
        ? t(`「${name}」の項目とチェックを削除し、はじめの内容のシートに置き換えます。元に戻せません。`, `"${name}" and its checks will be deleted and replaced with a fresh template sheet. This can't be undone.`)
        : t(`「${name}」の項目とチェックを削除します。元に戻せません。`, `"${name}" and its checks will be deleted. This can't be undone.`),
      okLabel: t('削除する', 'Delete'), danger: true,
      onOk: () => {
        doc.sheets = doc.sheets.filter(s => s !== sheet);
        delete chk.sheets[sheet.id]; saveChecks();
        if (!doc.sheets.length) doc.sheets.push(templateSheet());
        doc.activeId = doc.sheets[0].id;
        editing = false;
        saveDoc(); render();
      },
    });
    return;
  } else {
    return;
  }
  saveDoc();
  render();
}

// 文字の入力は描き直さずにモデルだけ更新する（1文字ごとにフォーカスが外れないように）
function onInput(ev) {
  const el = ev.target;
  const kind = el.dataset && el.dataset.edit;
  if (!kind) return;
  const sheet = activeSheet();
  if (kind === 'num') {
    const c = rowChecks(sheet, el.dataset.r, true);
    const i = Number(el.dataset.i);
    const v = el.value.trim();
    if (v) c[i + 'n'] = v; else delete c[i + 'n'];
    // 数を書いたら、そのチェックも付いたことにする
    const boxBtn = el.parentElement.querySelector('.dc-box');
    if (v && Number(v) > 0 && !c[i]) {
      c[i] = true;
      recordToday();
      boxBtn.classList.add('on'); boxBtn.setAttribute('aria-checked', 'true');
      boxBtn.querySelector('.dc-box-svg').outerHTML = shapeSvg(sheet.style, true);
      refreshDoneStates(boxBtn);
      refreshProgress();
    }
    saveChecks();
    return;
  }
  if (kind === 'sheet-title') {
    sheet.title = el.value;
    const tab = viewRoot().querySelector('.dc-tab.on');
    if (tab) tab.textContent = el.value || t('無題のシート', 'Untitled');
  } else if (kind === 'sec-title') {
    const sec = sheet.sections.find(s => s.id === el.dataset.s);
    if (sec) sec.title = el.value;
  } else if (kind === 'row-label') {
    const hit = findRow(sheet, el.dataset.r);
    if (hit) hit.row.label = el.value;
  } else if (kind === 'opt-label') {
    const hit = findRow(sheet, el.dataset.r);
    const o = hit && hit.row.opts[Number(el.dataset.i)];
    if (o) { o.label = el.value; el.size = Math.max(3, el.value.length + 1); }
  }
  saveDocSoon();
}

function onChange(ev) {
  const el = ev.target;
  if (el.dataset && el.dataset.printSide) {
    const st = activeSheet().style;
    if (el.value) st[el.dataset.printSide] = el.value; else delete st[el.dataset.printSide];
    saveDoc();
    return;
  }
  const k = el.dataset && el.dataset.styleCheck;
  if (!k) return;
  const sheet = activeSheet();
  if (k === 'autoReset') sheet.autoReset = el.checked;
  else sheet.style[k] = el.checked;
  saveDoc();
  render();
}

/* 行・見出し・シートの「済んだ」表示を、押したチェック（el）のまわりだけ更新する。
   済んでいなかったものが済んだ瞬間だけ、きらきら（見出し）とはんこ（シート）で知らせる。
   どちらも1日に数回しか起きないので、少しだけ遊びのある動きにしてよい */
function refreshDoneStates(el) {
  const sheet = activeSheet();
  const rowEl = el.closest('.dc-row');
  const secEl = el.closest('.dc-section');
  const paper = el.closest('.dc-paper');
  const hit = el.dataset.r ? findRow(sheet, el.dataset.r) : null;
  if (rowEl && hit) rowEl.classList.toggle('done', rowDone(sheet, hit.row));
  if (secEl && hit) {
    const was = secEl.classList.contains('done');
    const now = sectionDone(sheet, hit.sec);
    secEl.classList.toggle('done', now);
    if (now && !was) burst(secEl.querySelector('.dc-sec') || el);
  }
  if (paper) {
    const was = paper.classList.contains('complete');
    const now = sheetComplete(sheet);
    paper.classList.toggle('complete', now);
    if (now && !was) { paper.classList.remove('stamped'); void paper.offsetWidth; paper.classList.add('stamped'); burst(paper.querySelector('.dc-stamp'), 10); }
  }
}
// 小さな星が飛び散る演出。要素は終わったら消す
function burst(anchor, count = 6) {
  if (!anchor || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  const paper = anchor.closest('.dc-paper');
  if (!paper) return;
  const pr = paper.getBoundingClientRect();
  const ar = anchor.getBoundingClientRect();
  const wrap = document.createElement('span');
  wrap.className = 'dc-burst';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.style.left = `${ar.left - pr.left + ar.width / 2}px`;
  wrap.style.top = `${ar.top - pr.top + ar.height / 2}px`;
  for (let k = 0; k < count; k++) {
    const a = (Math.PI * 2 * k) / count + Math.random() * 0.5;
    const d = 26 + Math.random() * 18;
    const sp = document.createElement('span');
    sp.textContent = k % 2 ? '✦' : '•';
    sp.style.setProperty('--dx', `${Math.cos(a) * d}px`);
    sp.style.setProperty('--dy', `${Math.sin(a) * d}px`);
    sp.style.animationDelay = `${k * 12}ms`;
    wrap.appendChild(sp);
  }
  paper.appendChild(wrap);
  setTimeout(() => wrap.remove(), 700);
}

function refreshProgress() {
  const root = viewRoot();
  const p = progress(activeSheet());
  if (!p.total) return;
  const numEl = root.querySelector('.dc-progress-num b');
  if (numEl) numEl.textContent = p.done;
  const bar = root.querySelector('.dc-progress-track > span');
  if (bar) bar.style.width = `${p.total ? Math.round((p.done / p.total) * 100) : 0}%`;
}

/* ================================================================
   確認ダイアログ（ページ内）
   window.confirm() は広告ブロックや一部のアプリ内ブラウザで出ないことがあるため、自前で出す。
   操作を止めて確認を求めるので、暗いスクリム＋不透明なカード。閉じる時も開く時と同じ道筋で消す。
   ================================================================ */
let confirmEl = null;
let confirmKeyHandler = null;
let confirmReturnFocus = null;

function askConfirm({ title, message, okLabel, danger, onOk }) {
  closeConfirm(true);
  confirmReturnFocus = document.activeElement;
  const el = document.createElement('div');
  el.className = 'dc-confirm-overlay';
  el.innerHTML = `
    <div class="dc-confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="dcConfirmTitle" aria-describedby="dcConfirmMsg">
      <h2 class="dc-confirm-title" id="dcConfirmTitle">${escapeHtml(title)}</h2>
      <p class="dc-confirm-msg" id="dcConfirmMsg">${escapeHtml(message)}</p>
      <div class="dc-confirm-actions">
        <button type="button" class="dc-confirm-btn" data-confirm="cancel">${escapeHtml(t('キャンセル', 'Cancel'))}</button>
        <button type="button" class="dc-confirm-btn ok${danger ? ' danger' : ''}" data-confirm="ok">${escapeHtml(okLabel || 'OK')}</button>
      </div>
    </div>`;
  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-confirm]');
    if (b) {
      const ok = b.dataset.confirm === 'ok';
      closeConfirm();
      if (ok) onOk();
    } else if (ev.target === el) {
      closeConfirm(); // 外側をタップしたらキャンセル
    }
  });
  confirmKeyHandler = (ev) => {
    if (ev.key === 'Escape') { ev.preventDefault(); closeConfirm(); return; }
    if (ev.key === 'Tab') { // フォーカスをダイアログの2つのボタンの中に留める
      const btns = [...el.querySelectorAll('button')];
      const idx = btns.indexOf(document.activeElement);
      ev.preventDefault();
      btns[(idx + (ev.shiftKey ? -1 : 1) + btns.length) % btns.length].focus();
    }
  };
  document.addEventListener('keydown', confirmKeyHandler);
  document.body.appendChild(el);
  confirmEl = el;
  // 誤って消してしまわないよう、最初のフォーカスはキャンセル側に置く
  el.querySelector('[data-confirm="cancel"]').focus();
}

function closeConfirm(immediate) {
  if (!confirmEl) return;
  const el = confirmEl;
  confirmEl = null;
  document.removeEventListener('keydown', confirmKeyHandler);
  confirmKeyHandler = null;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (immediate || reduce) el.remove();
  else {
    el.classList.add('closing');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400); // animationendが来ない環境の保険
  }
  if (!immediate && confirmReturnFocus && document.contains(confirmReturnFocus)) confirmReturnFocus.focus();
  confirmReturnFocus = null;
}

// 短いお知らせ（画面下・数秒で消える）。操作は止めないので半透明の面
let toastTimer = null;
function showToast(msg) {
  let el = document.querySelector('.dc-toast');
  if (msg === null) { clearTimeout(toastTimer); if (el) el.classList.remove('show'); return; }
  if (!el) { el = document.createElement('div'); el.className = 'dc-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); }, 2600);
}

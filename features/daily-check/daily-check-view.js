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

const STYLE_LINK_ID = 'daily-check-view-styles';
const SHEETS_KEY = 'dailyCheckSheets_v1';
const STATE_KEY = 'dailyCheckState_v1';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);

/* ── 着せ替えの選択肢 ── */
const COLORS = {
  pink: { ja: 'ピンク', en: 'Pink', accent: '#E8679A', soft: '#FFE1EC', paper: '#FFF9FB', ink: '#5A3443', line: '#F6C9DA' },
  mint: { ja: 'ミント', en: 'Mint', accent: '#25A58B', soft: '#D7F4EC', paper: '#F7FFFC', ink: '#27473F', line: '#BFE9DD' },
  lavender: { ja: 'ラベンダー', en: 'Lavender', accent: '#8574DB', soft: '#ECE8FF', paper: '#FBFAFF', ink: '#3B3560', line: '#D9D2FB' },
  lemon: { ja: 'レモン', en: 'Lemon', accent: '#C98F00', soft: '#FFF1C2', paper: '#FFFDF4', ink: '#54451C', line: '#F3E1A6' },
  sky: { ja: 'そら', en: 'Sky', accent: '#3489D6', soft: '#DCEEFF', paper: '#F8FBFF', ink: '#24405A', line: '#C3DDF6' },
  mono: { ja: 'モノクロ', en: 'Mono', accent: '#3A3A3C', soft: '#ECECEE', paper: '#FFFFFF', ink: '#1C1C1E', line: '#D1D1D6' },
};
const SHAPES = {
  square: { ja: '四角', en: 'Square', d: 'M7 3.5h10a3.5 3.5 0 0 1 3.5 3.5v10a3.5 3.5 0 0 1-3.5 3.5H7A3.5 3.5 0 0 1 3.5 17V7A3.5 3.5 0 0 1 7 3.5z' },
  circle: { ja: 'まる', en: 'Circle', d: 'M12 3.2a8.8 8.8 0 1 1 0 17.6a8.8 8.8 0 1 1 0-17.6z' },
  heart: { ja: 'ハート', en: 'Heart', d: 'M12 20.3s-7.6-4.5-9.3-9.2C1.5 7.7 3.7 4.4 7.1 4.4c2 0 3.7 1.1 4.9 2.8 1.2-1.7 2.9-2.8 4.9-2.8 3.4 0 5.6 3.3 4.4 6.7-1.7 4.7-9.3 9.2-9.3 9.2z' },
  star: { ja: 'ほし', en: 'Star', d: 'M12 2.6l2.8 5.9 6.4.8-4.7 4.5 1.2 6.4L12 17.1l-5.7 3.1 1.2-6.4-4.7-4.5 6.4-.8z' },
};
const TICK_D = 'M8 12.4l2.7 2.7 5.3-5.6';
const PAPERS = { plain: { ja: '無地', en: 'Plain' }, grid: { ja: '方眼', en: 'Grid' }, dot: { ja: 'ドット', en: 'Dots' }, lined: { ja: '罫線', en: 'Lined' } };
const STICKERS = {
  none: { ja: 'なし', en: 'None', ch: '' },
  star: { ja: '星', en: 'Stars', ch: '✦' },
  flower: { ja: '花', en: 'Flowers', ch: '✿' },
  heart: { ja: 'ハート', en: 'Hearts', ch: '♡' },
  cloud: { ja: 'くも', en: 'Clouds', ch: '☁' },
};
const DEFAULT_STYLE = { color: 'pink', shape: 'square', paper: 'plain', sticker: 'star', perPage: 1, showDate: true, showYear: false, showPlayer: false, showMemo: true, showHoles: true };

// テーマ＝色・チェックの形・紙・飾りの組み合わせ。選ぶと4つをまとめて切り替える
// （その後で1つずつ変えるのは自由。4つが一致するテーマが無ければ「カスタム」と表示する）
const THEMES = {
  standard: { ja: 'スタンダード', en: 'Standard', color: 'pink', shape: 'square', paper: 'plain', sticker: 'star' },
  sakura: { ja: 'さくら', en: 'Sakura', color: 'pink', shape: 'heart', paper: 'dot', sticker: 'flower' },
  mintnote: { ja: 'ミントノート', en: 'Mint notebook', color: 'mint', shape: 'circle', paper: 'lined', sticker: 'none' },
  yume: { ja: 'ゆめかわ', en: 'Dreamy', color: 'lavender', shape: 'star', paper: 'dot', sticker: 'star' },
  lemon: { ja: 'レモンティー', en: 'Lemon tea', color: 'lemon', shape: 'circle', paper: 'grid', sticker: 'flower' },
  sky: { ja: '空とくも', en: 'Sky & clouds', color: 'sky', shape: 'circle', paper: 'plain', sticker: 'cloud' },
  simple: { ja: 'シンプル', en: 'Simple', color: 'mono', shape: 'square', paper: 'plain', sticker: 'none' },
  notebook: { ja: '方眼ノート', en: 'Graph notebook', color: 'mono', shape: 'square', paper: 'grid', sticker: 'none' },
};
const THEME_KEYS = ['color', 'shape', 'paper', 'sticker'];
function currentThemeKey(style) {
  return Object.keys(THEMES).find(k => THEME_KEYS.every(f => THEMES[k][f] === style[f])) || null;
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
export function mount(container) {
  injectStylesheet();
  containerEl = container;
  editing = false;
  styling = false;
  goaling = false;
  doc = loadDoc();
  chk = loadChecks();
  rollOverIfNeeded();
  container.innerHTML = '<div class="daily-check-view"></div>';
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
  delete style.font; // 以前の「文字」設定の名残りは捨てる
  style.perPage = style.perPage === 2 ? 2 : 1;
  ['printLeft', 'printRight'].forEach(k => { if (typeof style[k] !== 'string') delete style[k]; });
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
      <header class="dc-head">
        <h1 class="dc-h1">${escapeHtml(t('デイリーチェックシート', 'Daily Checklist'))}<span class="dc-beta">${escapeHtml(t('試作', 'Preview'))}</span></h1>
        <p class="dc-lead">${escapeHtml(t('毎日の予定をチェックできるシートです。印刷して紙で記録することもできます。', 'A checklist for your daily routine. You can also print it and keep a paper log.'))}</p>
      </header>
      ${tabsHtml(sheet)}
      ${toolbarHtml(sheet)}
      ${styling ? stylePanelHtml(sheet) : ''}
      ${paperHtml(sheet, { mode: editing ? 'edit' : 'screen' })}
      ${editing ? sheetAdminHtml() : ''}
    </div>
    <div class="dc-print-area" aria-hidden="true"></div>`;
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
        <button type="button" class="dc-btn${goaling ? ' on' : ''}" data-act="toggle-goal" aria-pressed="${goaling}">${escapeHtml(goaling ? t('目標を決め終える', 'Done') : t('目標を決める', 'Set goals'))}</button>
        <button type="button" class="dc-btn${editing ? ' on' : ''}" data-act="toggle-edit" aria-pressed="${editing}">${escapeHtml(editing ? t('編集を終える', 'Done editing') : t('項目を編集', 'Edit items'))}</button>
        <button type="button" class="dc-btn${styling ? ' on' : ''}" data-act="toggle-style" aria-pressed="${styling}">${escapeHtml(t('着せ替え・印刷設定', 'Style & print'))}</button>
        <button type="button" class="dc-btn primary" data-act="print">${escapeHtml(t('印刷する', 'Print'))}</button>
        <button type="button" class="dc-btn danger" data-act="sheet-del">${escapeHtml(t('このシートを削除', 'Delete sheet'))}</button>
      </div>${goalHint}
      <div class="dc-reset">
        <span class="dc-reset-next">${escapeHtml(resetInfoText())}</span>
        <span class="dc-reset-note">${escapeHtml(sheet.autoReset
    ? t('毎日 日本時間16時（サマータイム中）・17時（それ以外）にチェックが外れます', 'Checks clear daily at the in-game reset (4 pm JST in daylight time, 5 pm otherwise)')
    : t('このシートは自動リセットしません', 'Auto reset is off for this sheet'))}</span>
        <button type="button" class="dc-link" data-act="clear-today">${escapeHtml(t('今日のチェックを全部外す', 'Clear today'))}</button>
      </div>
    </div>`;
}

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
  const cards = Object.keys(THEMES).map(k => {
    const th = THEMES[k];
    const c = COLORS[th.color];
    const on = cur === k;
    const ch = STICKERS[th.sticker].ch;
    return `<button type="button" class="dc-theme${on ? ' on' : ''}" data-act="theme" data-v="${k}" aria-pressed="${on}">
      <span class="dc-theme-swatch paper-${th.paper}" style="--dc-accent:${c.accent};--dc-paper:${c.paper};--dc-ink:${c.ink};--dc-line:${c.line};--dc-soft:${c.soft}">
        ${ch ? `<span class="dc-theme-stk">${ch}</span>` : ''}
        <span class="dc-theme-line"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="dc-shape on" d="${SHAPES[th.shape].d}"/><path class="dc-tick" d="${TICK_D}"/></svg><span class="dc-theme-bar"></span></span>
        <span class="dc-theme-line"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="dc-shape" d="${SHAPES[th.shape].d}"/></svg><span class="dc-theme-bar short"></span></span>
      </span>
      <span class="dc-theme-name">${escapeHtml(t(th.ja, th.en))}</span>
    </button>`;
  }).join('');
  return `<div class="dc-style-row"><span class="dc-style-label">${escapeHtml(t('テーマ', 'Theme'))}${cur ? '' : `<span class="dc-custom-tag">${escapeHtml(t('カスタム', 'Custom'))}</span>`}</span><div class="dc-themes">${cards}</div></div>`;
}
// 2日分（左右に並べる）で、左と右にどのシートを印刷するか。初期値はどちらも今開いているシート
function printPairHtml(sheet) {
  const sel = (side, cur) => `<label class="dc-pair"><span>${escapeHtml(side === 'printLeft' ? t('左', 'Left') : t('右', 'Right'))}</span>
    <select class="dc-pair-select" data-print-side="${side}">${doc.sheets.map(s => `<option value="${escapeHtml(s.id)}"${s.id === cur ? ' selected' : ''}>${escapeHtml(s.title || t('無題のシート', 'Untitled'))}</option>`).join('')}</select></label>`;
  const [left, right] = printPairSheets(sheet).map(s => s.id);
  return `<div class="dc-style-row"><span class="dc-style-label">${escapeHtml(t('印刷するシート', 'Sheets to print'))}</span><div class="dc-pairs">${sel('printLeft', left)}${sel('printRight', right)}</div></div>`;
}
function printPairSheets(sheet) {
  const find = id => doc.sheets.find(s => s.id === id) || sheet;
  return [find(sheet.style.printLeft), find(sheet.style.printRight)];
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
    ? t('A4を横向きにして、左右に1枚ずつ並べて印刷します。真ん中の点線で切ると、A5サイズのシートが2枚になります。', 'Prints two sheets side by side on landscape A4. Cut along the center line to get two A5 sheets.')
    : t('A4の縦向きで印刷します。項目が少なく半分の高さに収まるシートは、上半分と下半分に1回ずつ印刷します。', 'Prints on portrait A4. A short sheet that fits in half the height is printed twice, top and bottom.'))}</p>
      ${st.perPage === 2 ? printPairHtml(sheet) : ''}
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
  return `<span class="dc-stk s1" aria-hidden="true">${ch}</span><span class="dc-stk s2" aria-hidden="true">${ch}</span><span class="dc-stk s3" aria-hidden="true">${ch}</span>`;
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
    <article class="dc-paper paper-${st.paper}${mode === 'edit' ? ' editing' : ''}" style="${sheetVars(st)}">
      ${stickersHtml(st)}
      <div class="dc-paper-head">${titleHtml}${dateHtml}</div>${playerHtml}
      ${sections}${addSection}${memo}
    </article>`;
}

function sectionHtml(sheet, sec, mode) {
  const head = mode === 'edit'
    ? `<div class="dc-sec-head"><input class="dc-in dc-in-sec" data-edit="sec-title" data-s="${escapeHtml(sec.id)}" value="${escapeHtml(sec.title)}" placeholder="${escapeHtml(t('見出し', 'Heading'))}" aria-label="${escapeHtml(t('見出し', 'Heading'))}"><button type="button" class="dc-mini danger" data-act="sec-del" data-s="${escapeHtml(sec.id)}">${escapeHtml(t('見出しごと削除', 'Delete heading'))}</button></div>`
    : (sec.title ? `<h3 class="dc-sec">${escapeHtml(sec.title)}</h3>` : '');
  const rows = sec.rows.map((r, i) => rowHtml(sheet, sec, r, i, mode)).join('');
  const add = mode === 'edit' ? `<button type="button" class="dc-add" data-act="row-add" data-s="${escapeHtml(sec.id)}">＋ ${escapeHtml(t('行を追加', 'Add row'))}</button>` : '';
  return `<section class="dc-section">${head}<div class="dc-rows">${rows}</div>${add}</section>`;
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
const LAYOUTS = {
  // w,h: 余白の内側の大きさ（hは丸め誤差で2枚目にはみ出さないよう2mm控える）。slots: シートを置く枠。holes: ●の中心
  portrait: {
    w: 194, h: 279,
    slots: [{ x: 14, y: 0, w: 180, h: 279 }],
    holes: [[HOLE_FROM_EDGE_MM - PRINT_MARGIN_MM, 140.5 - HOLE_GAP_MM / 2], [HOLE_FROM_EDGE_MM - PRINT_MARGIN_MM, 140.5 + HOLE_GAP_MM / 2]],
    cut: null,
  },
  // 項目が少ないシート（1日分）は、同じシートを上半分と下半分に1回ずつ。真ん中（用紙の端から148.5mm）に区切りの点線
  portraitStack: {
    w: 194, h: 279,
    slots: [{ x: 14, y: 0, w: 180, h: 134 }, { x: 14, y: 147, w: 180, h: 132 }],
    holes: [[HOLE_FROM_EDGE_MM - PRINT_MARGIN_MM, 140.5 - HOLE_GAP_MM / 2], [HOLE_FROM_EDGE_MM - PRINT_MARGIN_MM, 140.5 + HOLE_GAP_MM / 2]],
    cut: null, cutY: 140.5,
  },
  landscape: {
    w: 281, h: 192,
    slots: [{ x: 14, y: 0, w: 118.5, h: 192 }, { x: 162.5, y: 0, w: 118.5, h: 192 }],
    holes: [
      [HOLE_FROM_EDGE_MM - PRINT_MARGIN_MM, 97 - HOLE_GAP_MM / 2], [HOLE_FROM_EDGE_MM - PRINT_MARGIN_MM, 97 + HOLE_GAP_MM / 2],
      [140.5 + HOLE_FROM_EDGE_MM, 97 - HOLE_GAP_MM / 2], [140.5 + HOLE_FROM_EDGE_MM, 97 + HOLE_GAP_MM / 2],
    ],
    cut: 140.5,
  },
};

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

// 項目が少なく、半分の高さでもあまり縮めずに収まる（この縮小率以上）なら、上下に2回印刷する
const STACK_MIN_SCALE = 0.85;

function renderPrintArea(area, layout, sheets, showHoles) {
  const mm = v => `${v}mm`;
  area.innerHTML = `
    <div class="dc-print-sheet" style="width:${mm(layout.w)};height:${mm(layout.h)}">
      ${layout.slots.map((sl, i) => `<div class="dc-slot" style="left:${mm(sl.x)};top:${mm(sl.y)};width:${mm(sl.w)};height:${mm(sl.h)}">${paperHtml(sheets[i], { mode: 'print' })}</div>`).join('')}
      ${layout.cut != null ? `<div class="dc-cut" style="left:${mm(layout.cut)}"></div>` : ''}
      ${layout.cutY != null ? `<div class="dc-cut-h" style="top:${mm(layout.cutY)}"></div>` : ''}
      ${showHoles ? layout.holes.map(([x, y]) => `<span class="dc-hole" style="left:${mm(x)};top:${mm(y)}"></span>`).join('') : ''}
    </div>`;
}
function measureScale(area, layout) {
  const papers = [...area.querySelectorAll('.dc-slot > .dc-paper')];
  return Math.min(...papers.map((paper, i) => fitScale(paper, layout.slots[i].w * PX_PER_MM, layout.slots[i].h * PX_PER_MM)));
}

function doPrint() {
  const sheet = activeSheet();
  const two = sheet.style.perPage === 2;
  const area = viewRoot().querySelector('.dc-print-area');
  const html = document.documentElement;
  // 画面外で、印刷時と同じ見た目にして測る。左右（上下）のシートは同じ縮小率にそろえる（大きさが揃って見えるように）
  html.classList.add('dc-measuring');
  let layout;
  let scale;
  if (two) {
    layout = LAYOUTS.landscape;
    renderPrintArea(area, layout, printPairSheets(sheet), sheet.style.showHoles);
    scale = measureScale(area, layout);
  } else {
    // まず上下2回で収まるか試し、項目が多くて縮みすぎるなら1回（縦いっぱい）に戻す
    layout = LAYOUTS.portraitStack;
    renderPrintArea(area, layout, [sheet, sheet], sheet.style.showHoles);
    scale = measureScale(area, layout);
    if (scale < STACK_MIN_SCALE) {
      layout = LAYOUTS.portrait;
      renderPrintArea(area, layout, [sheet], sheet.style.showHoles);
      scale = measureScale(area, layout);
    }
  }

  let styleEl = document.getElementById('dcPageStyle');
  if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'dcPageStyle'; document.head.appendChild(styleEl); }
  styleEl.textContent = `@page { size: A4 ${two ? 'landscape' : 'portrait'}; margin: ${PRINT_MARGIN_MM}mm; }`;

  const papers = [...area.querySelectorAll('.dc-slot > .dc-paper')];
  papers.forEach((paper, i) => {
    const sl = layout.slots[i];
    paper.style.width = `${(sl.w * PX_PER_MM) / scale}px`;
    // 枠の高さいっぱいに伸ばす。項目が少なくて余った分はメモの欄が広がって埋める（.dc-print-area の flex 指定）
    paper.style.height = `${(sl.h * PX_PER_MM) / scale}px`;
    paper.style.zoom = String(scale);
    // 背景で描く細い線（メモの罫線・方眼）は縮小で1px未満になると印刷で消えるので、縮めた後も1pxになる太さを渡す
    paper.style.setProperty('--dc-hair', `${Math.max(1, 1 / scale)}px`);
  });
  html.classList.remove('dc-measuring');

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
    // 押したボタンだけ差し替える（行全体を描き直すと数の入力欄のフォーカスが外れるため）
    const on = !!c[i];
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-checked', String(on));
    btn.querySelector('.dc-box-svg').outerHTML = shapeSvg(sheet.style, on);
    btn.classList.remove('pop'); void btn.offsetWidth; if (on) btn.classList.add('pop');
    const rowEl = btn.closest('.dc-row');
    if (rowEl && hit) rowEl.classList.toggle('done', hit.row.opts.every((o, k) => c[k]));
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
  if (act === 'clear-today') { delete chk.sheets[sheet.id]; saveChecks(); render(); return; }
  if (act === 'theme') {
    const th = THEMES[btn.dataset.v];
    if (th) THEME_KEYS.forEach(f => { sheet.style[f] = th[f]; });
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
      boxBtn.classList.add('on'); boxBtn.setAttribute('aria-checked', 'true');
      boxBtn.querySelector('.dc-box-svg').outerHTML = shapeSvg(sheet.style, true);
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
    activeSheet().style[el.dataset.printSide] = el.value;
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

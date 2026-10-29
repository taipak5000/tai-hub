/* ================================================================
   tai-card-state.js — 星紡ぎカードの永続化層・静的データ・クロスツール
   同期ロジック。移植元: tai-card/index.html の該当ブロック
   （THEMES/DETAIL_GROUPS/ECO_STATS/TREND_GRAPHS/CAPE_LEVELS の各定数、
   state初期値、loadState/saveState、sync*Stat()各関数、羽トラッカー
   集計、computeCape、時計ダイヤルの純粋計算関数）。

   ── データ互換性 ──────────────────────────────────────────────
   STATE_KEY ('taiCardState_v1') は tai-card 自身が所有するキーなので
   nsKey() でプロフィール名前空間化する（既存ユーザーのデフォルト
   プロフィールでは無印のまま読み書きされ、互換性が保たれる）。
   他ツールの localStorage キー（gameItems_*, emoteOwned_v1,
   spiritCatalogStats_v1, taiScoreSongs_v1, sky_tracker_storage,
   wingTracker_v1 等）は「読み取り専用のクロスツール参照」であり、
   tai-card が所有するキーではないため、そのツール自身の名前空間規則
   （nsKey対象かどうか）にそのまま従う。値の形状・キー名は元実装から
   一切変更していない。

   🩹 tai-scoreは今回の移植バッチでnsKey()による名前空間化に切り替わった
   （元は 'taiScoreSongs_v1' というプロフィール非依存のグローバル直下
   キーだった）。syncScoreStat()はこれに合わせ、元のフラット読み取りでは
   なく nsKey('taiScoreSongs_v1') を読む（title-catalog.jsのREQUIRED FIX
   コメントと同じ理由）。
   ================================================================ */
import { nsKey, nsKeyFor, getActiveProfileId } from '../../js/state.js';
import { TITLE_CATALOG } from './data/title-catalog.js';

export const STATE_KEY = 'taiCardState_v1';

export const THEMES = [
  { id: 'night', name: '夜空', nameEn: 'Night Sky', grad: 'linear-gradient(165deg, #F7F5FB 0%, #ECE9F5 100%)', ca: '#8B7BAE', ca2: '#6B5A93' },
  { id: 'dawn', name: '夜明け', nameEn: 'Dawn', grad: 'linear-gradient(165deg, #FBF3ED 0%, #F6E6DA 100%)', ca: '#D08A5C', ca2: '#B5673D' },
  { id: 'morning', name: '朝', nameEn: 'Morning', grad: 'linear-gradient(165deg, #F2F8F6 0%, #E5F1EE 100%)', ca: '#4F8B79', ca2: '#3A6B5C' },
  { id: 'day', name: '昼', nameEn: 'Day', grad: 'linear-gradient(165deg, #FDFBF4 0%, #F7F0DF 100%)', ca: '#C99A4A', ca2: '#A87A32' },
  { id: 'dusk', name: '夕暮れ', nameEn: 'Dusk', grad: 'linear-gradient(165deg, #FBF0F1 0%, #F4E0E4 100%)', ca: '#C46F82', ca2: '#A24F63' },
  { id: 'aurora', name: 'オーロラ', nameEn: 'Aurora', grad: 'linear-gradient(165deg, #F1F7F6 0%, #EAEEF9 100%)', ca: '#5C9E8E', ca2: '#6C74B0' },
];

export const PLAY_TIME_IRREGULAR = '不定期';
export const FREE_TEXT = '自由記述';
export const CAPE_LEVELS = [1, 2, 5, 10, 20, 35, 55, 75, 100, 120, 150, 200, 250];

export const DETAIL_GROUPS = [
  { id: 'playStyle', icon: '🎮', label: 'プレイスタイル', labelEn: 'Play Style', options: ['ソロ', 'サブと', 'フレンド', FREE_TEXT] },
  { id: 'friendRecruit', icon: '🤝', label: 'フレンド募集', labelEn: 'Friend Requests', options: ['募集中', 'フレ申大歓迎', 'していない', FREE_TEXT] },
  { id: 'chat', icon: '💬', label: 'チャット解放', labelEn: 'Chat', options: ['フレコで解放する', 'ミュートしたい', 'ミュートされたい', '開放しない', FREE_TEXT] },
  { id: 'heartTrade', icon: '❤️', label: 'ハート交換', labelEn: 'Heart Trades', options: ['募集中', '頼まれたらやる', 'やらない', FREE_TEXT] },
  { id: 'warp', icon: '🌀', label: 'ワープ', labelEn: 'Warps', options: ['したい', 'されたい', FREE_TEXT] },
  { id: 'candleMarathon', icon: '🕯️', label: 'キャンマラ', labelEn: 'Candle Runs', options: ['毎日灰まで', '毎日15本くらい', 'マイペースに', 'しない', FREE_TEXT] },
  { id: 'carry', icon: '🎒', label: 'キャリー', labelEn: 'Carrying', options: ['まかせろ', 'お願いしたい', 'どちらでも可能', FREE_TEXT] },
  { id: 'eden', icon: '⛰️', label: '原罪', labelEn: 'Eye of Eden', options: ['毎週', '月に2、3回', '不定期', '必要時のみ', FREE_TEXT] },
];

// 表示専用の英訳テーブル（state.detail[groupId]には日本語の原文のまま保存されるため、
// 保存値と表示文字列を分離する必要がある）。
export const DETAIL_OPTION_EN = {
  'ソロ': 'Solo', 'サブと': 'With alts', 'フレンド': 'With friends',
  '募集中': 'Open', 'フレ申大歓迎': 'Welcome anytime', 'していない': 'Not accepting',
  'フレコで解放する': 'Unlock via friend code', 'ミュートしたい': 'Prefer to mute', 'ミュートされたい': 'OK to be muted', '開放しない': 'Keep muted',
  '頼まれたらやる': 'If asked', 'やらない': 'Not doing them',
  'したい': 'Want to warp', 'されたい': 'Want to be warped',
  '毎日灰まで': 'Daily, to full reset', '毎日15本くらい': '~15 candles daily', 'マイペースに': 'At my own pace', 'しない': 'Not doing them',
  'まかせろ': 'I can carry', 'お願いしたい': 'Looking for a carry', 'どちらでも可能': 'Either way',
  '毎週': 'Every week', '月に2、3回': '2-3x a month', '不定期': 'Irregularly', '必要時のみ': 'Only when needed',
  '自由記述': 'Custom',
};

export const FRIEND_CONTACT_OPTIONS = ['DMへ', 'リプで'];
export const FRIEND_CONTACT_OPTION_EN = { 'DMへ': 'By DM', 'リプで': 'By reply' };

export function ecoStatsDefaults() {
  return [
    { id: 'item', icon: '🗂️', label: 'アイテム所持率', labelEn: 'Item Ownership', source: 'アイテム所持管理', sourceEn: 'Item Collection Tracker', value: '', placeholder: '例: 82%', placeholderEn: 'e.g. 82%', visible: true },
    { id: 'emote', icon: '🎭', label: 'エモート所持率', labelEn: 'Emote Ownership', source: 'エモート所持率管理', sourceEn: 'Emote Collection Tracker', value: '', placeholder: '例: 65%', placeholderEn: 'e.g. 65%', visible: true },
    { id: 'spirit', icon: '✨', label: '精霊ツリー進行度', labelEn: 'Spirit Tree Progress', source: '精霊ツリー管理', sourceEn: 'Spirit Tree Catalog', value: '', placeholder: '例: 47%', placeholderEn: 'e.g. 47%', visible: true },
    { id: 'score', icon: '🎵', label: '作った曲数', labelEn: 'Songs Made', source: '楽譜づくり', sourceEn: 'Sheet Music Maker', value: '', placeholder: '例: 24曲', placeholderEn: 'e.g. 24', visible: true },
    { id: 'share', icon: '📌', label: 'シェア中の作品数', labelEn: 'Shared Creations', source: '創作物管理ツール', sourceEn: 'Creation Manager', value: '', placeholder: '例: 6件', placeholderEn: 'e.g. 6', visible: true },
  ];
}

export function trendGraphsDefaults() {
  return [
    { id: 'nomacan', icon: '🕯️', label: 'ノマキャンの入手推移', labelEn: 'Candle Calculator Trend', source: 'ノマキャン計算機', sourceEn: 'Candle Calculator', visible: false, rawCurrentKey: 'skyNomacanCalc_v1', rawHistoryKey: 'skyNomacanCalc_history_v1' },
    { id: 'starcandle', icon: '🕯️', label: '星のキャンドルの入手推移', labelEn: 'Star Candle Calculator Trend', source: '星のキャンドル計算機', sourceEn: 'Star Candle Calculator', visible: false, rawCurrentKey: 'skyStarCandleCalc_v1', rawHistoryKey: 'skyStarCandleCalc_history_v1' },
  ];
}

export function defaultState() {
  return {
    theme: 'night',
    avatarImage: { src: null, zoom: 1, offsetX: 0, offsetY: 0 },
    cardBgImage: { src: null, zoom: 1, offsetX: 0, offsetY: 0, opacity: 35 },
    name: 'たい',
    oneLiner: 'ものづくりが好きです',
    journeyYear: '',
    favorites: [{ label: '季節', value: '' }],
    wingTotal: '',
    snsList: [{ platform: 'X', id: '' }],
    playTimeRanges: [{ start: null, end: null }],
    playTimeIrregular: false,
    detail: {},
    detailFreeText: {},
    friendCode: '',
    friendCodeContact: null,
    titles: { selected: [] },
    customNote: { text: '', image: null, title: '' },
    vis: { sns: true, playTime: true, details: true, friendCode: true, ecoStats: true, cape: true, titles: true, customNote: true },
    ecoStats: {},
    trendGraphs: {},
    autoSync: false,
  };
}

/* ================================================================
   状態の永続化（nsKey経由・400msデバウンス・容量超過時の段階的フォールバック）
   ================================================================ */
let saveStateTimer = null;

export function loadState() {
  try {
    const raw = localStorage.getItem(nsKey(STATE_KEY));
    if (!raw) return null;
    const saved = JSON.parse(raw);
    return (saved && typeof saved === 'object') ? saved : null;
  } catch (_) { return null; }
}

// dropMsgCallback(msgKey) は容量超過で画像を諦めた段階のトースト文言キーを受け取る
export function flushSaveState(state, dropMsgCallback) {
  clearTimeout(saveStateTimer);
  const dropSteps = [
    { patch: {}, msg: null },
    { patch: { cardBgImage: Object.assign({}, state.cardBgImage, { src: null }) }, msg: 'quotaBgDroppedMsg' },
    { patch: { cardBgImage: Object.assign({}, state.cardBgImage, { src: null }), customNote: Object.assign({}, state.customNote, { image: null }) }, msg: 'quotaBgAndNoteDroppedMsg' },
    { patch: { cardBgImage: Object.assign({}, state.cardBgImage, { src: null }), customNote: Object.assign({}, state.customNote, { image: null }), avatarImage: Object.assign({}, state.avatarImage, { src: null }) }, msg: 'quotaAllDroppedMsg' },
  ];
  for (let i = 0; i < dropSteps.length; i++) {
    try {
      const toSave = i === 0 ? state : Object.assign({}, state, dropSteps[i].patch);
      localStorage.setItem(nsKey(STATE_KEY), JSON.stringify(toSave));
      if (dropSteps[i].msg && dropMsgCallback) dropMsgCallback(dropSteps[i].msg);
      return;
    } catch (err) { /* 次の段階（より多くの画像を諦める）を試す */ }
  }
}

export function scheduleSaveState(state, dropMsgCallback) {
  clearTimeout(saveStateTimer);
  saveStateTimer = setTimeout(() => flushSaveState(state, dropMsgCallback), 400);
}

export function cancelScheduledSave() {
  clearTimeout(saveStateTimer);
  saveStateTimer = null;
}

/* ================================================================
   収集状況：実データ連携（同一オリジンの他ツールのlocalStorageを直接読む）
   ================================================================ */
export function syncItemStat() {
  const CAT_KEYS = ['outfit', 'shoes', 'mask', 'face_accessory', 'necklace', 'hairstyle', 'hair_accessory', 'head_accessory', 'cape', 'portable_item', 'large_placeable', 'small_placeable'];
  let owned = 0, total = 0, registered = 0;
  CAT_KEYS.forEach(catKey => {
    try {
      const d = JSON.parse(localStorage.getItem(nsKey('gameItems_' + catKey)));
      if (d && typeof d.total === 'number' && d.total > 0) {
        owned += (typeof d.owned === 'number' ? d.owned : 0);
        total += d.total;
        registered++;
      }
    } catch (_) { /* 未訪問・壊れたデータはスキップ */ }
  });
  if (!registered || !total) return null;
  return Math.round(owned / total * 100) + '%';
}

export function syncEmoteStat() {
  const EMOTE_TOTAL_LEVELS = 477;
  let data;
  try { data = JSON.parse(localStorage.getItem(nsKey('emoteOwned_v1'))); } catch (_) { data = null; }
  if (!data || typeof data !== 'object') return null;
  let owned = 0;
  for (const id in data) { if (Array.isArray(data[id])) owned += data[id].length; }
  if (!owned) return null;
  const pct = owned / EMOTE_TOTAL_LEVELS * 100;
  return (pct > 0 && pct < 100 ? Math.round(pct * 10) / 10 : Math.round(pct)) + '%';
}

export function syncSpiritStat() {
  let stats;
  try { stats = JSON.parse(localStorage.getItem(nsKey('spiritCatalogStats_v1'))); } catch (_) { stats = null; }
  if (!stats || typeof stats.totalNodes !== 'number' || !stats.totalNodes || !stats.doneNodes) return null;
  const pct = stats.doneNodes / stats.totalNodes * 100;
  return (pct > 0 && pct < 100 ? Math.round(pct * 10) / 10 : Math.round(pct)) + '%';
}

// 🩹 元実装は 'taiScoreSongs_v1' をnsKey()無しのグローバル直下キーとして
// 読んでいたが、tai-scoreが今回の移植バッチでnsKey()化されたため、
// ここも同じくnsKey()経由で読む（ファイル冒頭コメント参照）。
export function syncScoreStat() {
  let songs;
  // 楽譜づくりと同じく、この保存枠の曲がまだ無ければ旧サイトの共通キーを読む
  const raw = localStorage.getItem(nsKey('taiScoreSongs_v1'));
  try { songs = JSON.parse(raw === null ? localStorage.getItem('taiScoreSongs_v1') : raw); } catch (_) { songs = null; }
  if (!Array.isArray(songs) || !songs.length) return null;
  return songs.length + '曲';
}

export function syncShareStat() {
  let decoded;
  try { decoded = JSON.parse(localStorage.getItem(nsKey('sky_tracker_storage'))); } catch (_) { decoded = null; }
  const items = decoded && Array.isArray(decoded.placedItems) ? decoded.placedItems : [];
  if (!items.length) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const count = items.reduce((n, item) => {
    if (item.isSuspended) return n;
    const expiry = new Date(item.placedDate); expiry.setDate(expiry.getDate() + 14); expiry.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((expiry - today) / 86400000);
    return daysLeft < 0 ? n : n + 1;
  }, 0);
  return count ? count + '件' : null;
}

export const ECO_SYNC_FNS = { item: syncItemStat, emote: syncEmoteStat, spirit: syncSpiritStat, score: syncScoreStat, share: syncShareStat };

/* ================================================================
   称号：他ツールで獲得済みの称号を読み込む（TITLE_CATALOG参照）
   ================================================================ */
export function syncEarnedTitles(profileId) {
  const pid = profileId || getActiveProfileId();
  const earned = [];
  Object.keys(TITLE_CATALOG).forEach(toolId => {
    const tool = TITLE_CATALOG[toolId];
    const key = tool.namespaced ? nsKeyFor(tool.storageKey, pid) : tool.storageKey;
    let data;
    let raw = localStorage.getItem(key);
    // 旧サイトに保存枠が無かったツール（楽譜づくり）は、この保存枠のデータがまだ無ければ共通キーを読む
    if (raw === null && tool.sharedFallback && key !== tool.storageKey) raw = localStorage.getItem(tool.storageKey);
    try { data = JSON.parse(raw); } catch (_) { data = null; }
    let ids = [];
    try { ids = tool.extract(data) || []; } catch (_) { ids = []; }
    ids.forEach(id => {
      const def = tool.titles[id];
      if (!def) return;
      earned.push({ key: `${toolId}:${id}`, icon: def.icon, name: def.name, nameEn: def.nameEn, desc: def.desc, descEn: def.descEn, source: tool.source, sourceEn: tool.sourceEn });
    });
  });
  return earned;
}

/* ================================================================
   光の翼 合計枚数：羽トラッカーの実データ連携（羽トラッカー自身のrender()
   と同じ集計式をミラーする）
   ================================================================ */
const WING_REBIRTH_BONUS = 1;

// 🩹 羽トラッカー側で精霊名が未確定→後から差し替えになった旧キー（重なる音色の季節・
// 砕ケル闇ノ季節）は、tai-card側の集計に紛れ込むと羽トラッカー本体の表示より
// +1多く出てしまうため明示的に除外する（元実装のコメント参照）。
const LEGACY_ORPHANED_SEASON_SPIRIT_KEYS = {
  '重なる音色の季節': ['未確認（再訪の有無・精霊名は要確認）'],
  '砕ケル闇ノ季節': ['万古の光', '万古の闇'],
};

function countSeasonWingFeathers(tracker) {
  let n = 0;
  Object.entries(tracker || {}).forEach(([season, seasonObj]) => {
    if (seasonObj && typeof seasonObj === 'object') {
      const legacyKeys = LEGACY_ORPHANED_SEASON_SPIRIT_KEYS[season] || [];
      Object.entries(seasonObj).forEach(([spirit, v]) => { if (v && !legacyKeys.includes(spirit)) n++; });
    }
  });
  return n;
}
function countPermWingFeathers(tracker) {
  let n = 0;
  Object.values(tracker || {}).forEach(entry => {
    if (entry && typeof entry === 'object') {
      if (entry.tier1) n++;
      if (entry.tier2) n++;
    }
  });
  return n;
}
function countLightChildrenFeathers(tracker) {
  return Object.values(tracker || {}).filter(Boolean).length;
}

export function syncWingTotalStat() {
  let seasonRaw, permRaw, lightRaw;
  try { seasonRaw = localStorage.getItem(nsKey('wingTracker_v1')); } catch (_) { seasonRaw = null; }
  try { permRaw = localStorage.getItem(nsKey('permWingTracker_v1')); } catch (_) { permRaw = null; }
  try { lightRaw = localStorage.getItem(nsKey('lightChildrenTracker_v1')); } catch (_) { lightRaw = null; }
  if (seasonRaw === null && permRaw === null && lightRaw === null) return null;

  let seasonTracker, permTracker, lightTracker;
  try { seasonTracker = JSON.parse(seasonRaw); } catch (_) { seasonTracker = null; }
  try { permTracker = JSON.parse(permRaw); } catch (_) { permTracker = null; }
  try { lightTracker = JSON.parse(lightRaw); } catch (_) { lightTracker = null; }

  const total = countSeasonWingFeathers(seasonTracker) + countPermWingFeathers(permTracker)
    + countLightChildrenFeathers(lightTracker) + WING_REBIRTH_BONUS;
  return String(total);
}

/* ================================================================
   ケープレベル（羽トラッカーのrenderCapeLevels()と同じ閾値・tier分けロジック）
   ================================================================ */
export function computeCape(total) {
  const reachedLevel = CAPE_LEVELS.filter(need => total >= need).length;
  const nextNeed = CAPE_LEVELS[reachedLevel];
  const isMax = reachedLevel >= CAPE_LEVELS.length;
  const prevNeed = reachedLevel > 0 ? CAPE_LEVELS[reachedLevel - 1] : 0;
  const pct = isMax ? 100 : Math.max(0, Math.min(100, Math.round((total - prevNeed) / (nextNeed - prevNeed) * 100)));
  return { reachedLevel, nextNeed, remain: isMax ? 0 : nextNeed - total, isMax, pct };
}

/* ================================================================
   入手推移グラフ：ノマキャン計算機・星のキャンドル計算機のcomputeTrendPoints()
   と同じ再構築ロジック（現在値から履歴のamountを順に差し引いて遡る）
   ================================================================ */
export function getTrendSeriesFromTool(rawCurrentKey, rawHistoryKey) {
  let currentData;
  try { currentData = JSON.parse(localStorage.getItem(nsKey(rawCurrentKey))); } catch (_) { currentData = null; }
  if (!currentData || typeof currentData !== 'object') return [];
  const currentVal = Math.max(0, parseFloat(currentData.current) || 0);

  let list;
  try {
    const raw = JSON.parse(localStorage.getItem(nsKey(rawHistoryKey)));
    list = Array.isArray(raw) ? raw : [];
  } catch (_) { list = []; }

  const points = [];
  let running = currentVal;
  for (let i = 0; i < list.length; i++) {
    const entry = list[i] || {};
    if (typeof entry.time !== 'number') continue;
    points.push({ time: entry.time, value: Math.max(0, running) });
    running -= (entry.amount || 0);
  }
  if (points.length > 0) {
    points.push({ time: points[points.length - 1].time - 1, value: Math.max(0, running) });
  }
  points.push({ time: Date.now(), value: currentVal });
  points.sort((a, b) => a.time - b.time);
  return points.map(p => p.value);
}

/* ================================================================
   時計ダイヤル：純粋な角度⇔時刻の計算（DOM参照を持たない部分だけをここに置く）
   ================================================================ */
export function hourToDeg(h) { return ((h % 24) / 24) * 360; }
export function polarPoint(deg, r, cx, cy) {
  const rad = (deg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
export function degToHour(deg) { return Math.round(deg / 360 * 24) % 24; }

export function mergeRangeIntervals(ranges) {
  let intervals = [];
  ranges.forEach(r => {
    if (r.start === 0 && r.end === 24) { intervals.push({ start: 0, end: 360 }); return; }
    const s = hourToDeg(r.start), e = hourToDeg(r.end);
    if (s === e) return;
    if (s < e) { intervals.push({ start: s, end: e }); }
    else {
      intervals.push({ start: s, end: 360 });
      if (e > 0) intervals.push({ start: 0, end: e });
    }
  });
  if (!intervals.length) return [];
  intervals.sort((a, b) => a.start - b.start);
  const merged = [];
  intervals.forEach(iv => {
    const last = merged[merged.length - 1];
    if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end);
    else merged.push({ ...iv });
  });
  return merged;
}

export function buildDialBackground(ranges, activeColor, baseColor) {
  const base = baseColor || 'var(--tc-surface-2)';
  const active = activeColor || 'var(--tc-teal)';
  const merged = mergeRangeIntervals(ranges);
  if (!merged.length) return base;
  const stops = [];
  let cursor = 0;
  merged.forEach(iv => {
    if (iv.start > cursor) stops.push(`${base} ${cursor}deg`, `${base} ${iv.start}deg`);
    stops.push(`${active} ${iv.start}deg`, `${active} ${iv.end}deg`);
    cursor = iv.end;
  });
  if (cursor < 360) stops.push(`${base} ${cursor}deg`, `${base} 360deg`);
  return `conic-gradient(${stops.join(', ')})`;
}

export function buildDialArcSvg(ranges, activeColor, baseColor, size) {
  const cx = size / 2, cy = size / 2, r = size / 2;
  const merged = mergeRangeIntervals(ranges);
  const base = baseColor || 'rgba(37,53,46,0.08)';
  const active = activeColor || 'var(--tc-teal)';
  let wedges = '';
  merged.forEach(iv => {
    const span = iv.end - iv.start;
    if (span <= 0) return;
    if (span >= 360) { wedges += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${active}"></circle>`; return; }
    const p1 = polarPoint(iv.start, r, cx, cy), p2 = polarPoint(iv.end, r, cx, cy);
    const largeArc = span > 180 ? 1 : 0;
    wedges += `<path d="M${cx},${cy} L${p1.x.toFixed(2)},${p1.y.toFixed(2)} A${r},${r} 0 ${largeArc} 1 ${p2.x.toFixed(2)},${p2.y.toFixed(2)} Z" fill="${active}"></path>`;
  });
  return `<svg class="tc-card-clock-arc-svg" viewBox="0 0 ${size} ${size}" preserveAspectRatio="none">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${base}"></circle>
    ${wedges}
  </svg>`;
}

export function clampHour(v, max) {
  if (v === '' || v == null) return null;
  const n = Math.round(Number(v));
  if (isNaN(n)) return null;
  return Math.max(0, Math.min(max, n));
}

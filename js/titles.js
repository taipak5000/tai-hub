/* ================================================================
   🏆 称号（全ツール共通の窓口）。称号の定義は星紡ぎカードが持つ一覧
   （features/tai-card/data/title-catalog.js の TITLE_CATALOG。各ツールの称号と同じidと名前）を使い、
   獲得の記録は各ツールが自分のキーに書いたものをそのまま読む（ここでは書き換えない）。

   - 称号一覧の画面（features/titles/titles-view.js、#/titles）が全部を並べる
   - 各ツールは自分の画面に称号の一覧を持たず、titlesLinkHtml(ツール) の小さな案内だけを出す（2026-11-06）
   - お知らせ（js/notices.js）は、前に称号一覧を開いた時より獲得数が増えていたら知らせる（titlesSeen_v1）
   称号を獲得した時のトーストは、今まで通り各ツールが出す。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from './i18n.js';
import { nsKey, nsKeyFor, getActiveProfileId } from './state.js';
import { TITLE_CATALOG } from '../features/tai-card/data/title-catalog.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);

/** 称号を持つツール（並び順＝称号一覧の並び）。route は称号一覧から「そのツールを開く」の行き先 */
export const TITLE_TOOLS = [
  { key: 'item', route: 'item', icon: 'i-folder', ja: 'アイテム所持管理', en: 'Item Collection Tracker' },
  { key: 'emote', route: 'emote', icon: 'i-masks', ja: 'エモート所持率管理', en: 'Emote Collection Tracker' },
  { key: 'wings', route: 'wings', icon: 'i-wing', ja: '羽トラッカー', en: 'Wing Tracker' },
  { key: 'spirit', route: 'spirit-catalog', icon: 'i-tree', ja: '精霊ツリー管理', en: 'Spirit Tree Catalog' },
  { key: 'nomacan', route: 'tai-nomacan', icon: 'i-candle', ja: 'ノマキャン計算機', en: 'Candle Calculator' },
  { key: 'starcandle', route: 'star-candle', icon: 'i-star-candle', ja: '星のキャンドル計算機', en: 'Star Candle Calculator' },
  { key: 'share', route: 'share', icon: 'i-pin', ja: '創作物管理ツール', en: 'Creation Manager' },
  { key: 'score', route: 'tai-score', icon: 'i-music-note', ja: '楽譜づくり', en: 'Sheet Music Maker' },
].filter(x => TITLE_CATALOG[x.key]);

function readRaw(key, profileId) {
  const entry = TITLE_CATALOG[key];
  const pid = profileId || getActiveProfileId();
  try {
    let raw = localStorage.getItem(entry.namespaced ? nsKeyFor(entry.storageKey, pid) : entry.storageKey);
    if (raw == null && entry.sharedFallback) raw = localStorage.getItem(entry.storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

// 獲得日を探す（ツールごとに形が違う: { id: ISO } ／ { id: { earnedAt } } ／ { earned: { id: … } } ／ { earned: [{ id, earnedAt }] }）
function dateOf(v) {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return new Date(v).toISOString();
  if (typeof v === 'object') return dateOf(v.earnedAt || v.at || v.date || v.unlockedAt || '');
  return '';
}
function earnedDates(raw, ids) {
  const out = {};
  ids.forEach(id => {
    let v = null;
    if (raw && Array.isArray(raw.earned)) v = (raw.earned.find(e => e && e.id === id) || {});
    else if (raw && raw.earned && typeof raw.earned === 'object') v = raw.earned[id];
    else if (raw) v = raw[id];
    const d = dateOf(v);
    out[id] = d && !isNaN(new Date(d)) ? d : '';
  });
  return out;
}

/** そのツールの称号: [{ id, icon, name, desc, earned, earnedAt }] */
export function toolTitles(key, profileId) {
  const entry = TITLE_CATALOG[key];
  if (!entry) return [];
  const raw = readRaw(key, profileId);
  let ids = [];
  try { ids = raw ? entry.extract(raw) : []; } catch (e) { ids = []; }
  const set = new Set(ids);
  const dates = earnedDates(raw, ids);
  return Object.keys(entry.titles).map(id => {
    const d = entry.titles[id];
    return { id, icon: d.icon, name: CURRENT_LANG === 'en' ? d.nameEn || d.name : d.name, desc: CURRENT_LANG === 'en' ? d.descEn || d.desc : d.desc, earned: set.has(id), earnedAt: dates[id] || '' };
  });
}

/** 全ツールの獲得数・総数 */
export function titleTotals(profileId) {
  let earned = 0, total = 0;
  TITLE_TOOLS.forEach(x => { const list = toolTitles(x.key, profileId); total += list.length; earned += list.filter(i => i.earned).length; });
  return { earned, total };
}

/* ── お知らせ用: 前に称号一覧を開いた時の獲得数 ── */
const SEEN_KEY = 'titlesSeen_v1';
export function titlesSeenCount() { try { return Number(JSON.parse(localStorage.getItem(nsKey(SEEN_KEY)))) || 0; } catch (e) { return 0; } }
export function markTitlesSeen(n) { try { localStorage.setItem(nsKey(SEEN_KEY), JSON.stringify(n)); } catch (e) { /* noop */ } }

/** 各ツールの画面に出す、称号一覧への小さな案内（そのツールの獲得数つき） */
export function titlesLinkHtml(key, extraClass = '') {
  const list = toolTitles(key);
  const n = list.filter(i => i.earned).length;
  const icons = list.filter(i => i.earned).slice(0, 5).map(i => `<span aria-hidden="true">${escapeHtml(i.icon)}</span>`).join('');
  return `<a class="hub-titles-link ${extraClass}" href="#/titles/${encodeURIComponent(key)}">
    <svg class="inline-icon" width="16" height="16" aria-hidden="true"><use href="#i-trophy"/></svg>
    <span class="hub-titles-link-text">${t('称号', 'Titles')} <b>${n}</b> / ${list.length}</span>
    ${icons ? `<span class="hub-titles-link-icons">${icons}</span>` : ''}
    <span class="hub-titles-link-go">${t('称号一覧で見る', 'See all titles')}<svg class="inline-icon" width="12" height="12" aria-hidden="true"><use href="#i-chevron-right"/></svg></span>
  </a>`;
}

/** 称号一覧への案内を置く枠（data-titles-tool）。中身は refreshTitleLinks() で描き直せる */
export function titlesSlotHtml(key, extraClass = '') {
  return `<div class="hub-titles-slot" data-titles-tool="${escapeHtml(key)}" data-titles-class="${escapeHtml(extraClass)}">${titlesLinkHtml(key, extraClass)}</div>`;
}
/** root の中の案内の獲得数を最新にする（各ツールが称号を獲得した直後に呼ぶ） */
export function refreshTitleLinks(root) {
  (root || document).querySelectorAll('[data-titles-tool]').forEach(el => { el.innerHTML = titlesLinkHtml(el.dataset.titlesTool, el.dataset.titlesClass || ''); });
}

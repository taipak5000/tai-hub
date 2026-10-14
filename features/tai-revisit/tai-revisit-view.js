/* ================================================================
   tai-revisit（再訪精霊データベース）のtai-hub移植版。公開面は
   mount(container, sub)/unmount() の2関数のみ（js/router.js からマウント
   される）。閲覧専用の参考データベースで、localStorageへの読み書きは
   一切行わない（所持チェック等の記録機能はそもそも元サイトにも無い）。

   移植元: tai-revisit/index.html（~2027行のスタンドアロンページ）のうち、
   共有chrome（nav/サイドバー/site-dock/設定モーダル/言語切替ボタン等）を
   除いた「このツール自身」の部分：進行中・次回の特別来訪・シーズン別
   再訪達成度・検索/季節/エリア/並び替えフィルター付きの精霊一覧・
   まだ一度も再訪が来ていない精霊の一覧。

   【ルーティングの扱い（このツール固有の注意点）】
   元サイトは自分自身のhash（#season=X&area=Y&search=Z、#spirit=Name）を
   専有していたが、tai-hubのrouterはlocation.hashをグローバルに所有し、
   hashが変わるたびに mount(container, sub) を「空のcontainerで」呼び直す
   （sub = 'tai-revisit'セグメントの次の1セグメント全体）。そのため：
   - 読み取り: parseSub(sub) が元の parseFilterHash()/parseSpiritHash() の
     役割を統合し、location.hashではなく引数のsubをパースする。
   - 書き込み: 元コードはそもそも location.hash への直接代入を一度も
     行っておらず、常に history.replaceState() でアドレスバーのURLだけを
     静かに書き換えていた（hashchangeイベントを発火させない）。この方式を
     そのまま踏襲する（updateSubHash()）ことで、検索ボックスへの1文字
     入力のたびにrouterのhashchangeが発火してcontainerが空になり入力
     フォーカスが失われる、という事態を避けている（router.navigate()の
     ようなlocation.hash直接代入は使わない）。mount()自体は、ブラウザの
     戻る/進むや外部からの#/tai-revisit/spirit=Name形式のディープリンク
     など、実際にhashchangeが起きた場合にsubを正しく再解釈できるよう
     常に「subを単一の情報源として完全に再構築する」形で実装している。

   【意図的な簡略化・アダプテーション】
   - 元サイト自前のnavバー（タイトル+EN切替ボタン）・サイドバー・
     site-dock（検索へジャンプ/未再訪へジャンプ/他のツール/表示設定の
     4アイコン）は、tai-hubの共有chromeが既に同等の役割を持つため
     移植していない。特に「未再訪へジャンプ」「検索欄へジャンプ」の
     2アクションはtai-hubの共有site-dock（js/chrome/site-dock.js。
     プロフィール/ダッシュボード/他のツール/表示設定の4固定枠で、
     ツールごとのカスタムボタンは持てない）に対応する枠が無いため、
     素直に落としてある（このセクション自体は通常のスクロールで到達可能）。
   - 表示設定モーダル（テーマ/言語/ショートカット）はtai-hub共有のものを
     使うため、このファイルにはロジックごと存在しない。
   ================================================================ */
import { CURRENT_LANG, escapeHtml, trEvent } from '../../js/i18n.js';
import { t } from './data/i18n-revisit.js';
import { REVISIT_DATA, NEVER_REVISITED_DATA } from './data/revisit-data.js';
import { SPIRIT_ITEMS_MAP } from './data/spirit-items-map.js';
import { SPIRIT_YOMI } from './data/spirit-yomi.js';
import { AREA_JA, areaJa, SEASON_ORDER } from './data/revisit-meta.js';

const STYLE_LINK_ID = 'tai-revisit-view-styles';
const ROUTE_BASE = '#/tai-revisit';

let containerEl = null;
let els = {};

/* ================================================================
   公開API
   ================================================================ */
export function mount(container, sub) {
  injectStylesheet();

  containerEl = container;
  container.innerHTML = renderShell();
  cacheEls();
  wireEvents();

  const parsed = parseSub(sub);
  populateSeasonFilterFor(els.seasonFilter, REVISIT_DATA, parsed.season);
  populateSeasonFilterFor(els.neverRevisitedSeasonFilter, NEVER_REVISITED_DATA, 'all');
  populateAreaFilter(parsed.area);
  els.searchInput.value = parsed.search;

  renderUpcomingRevisits();
  renderSeasonOverview();
  render();
  renderNeverRevisited();

  if (parsed.spirit) applySpiritHash(parsed.spirit);
}

export function unmount() {
  // document/window直付けのリスナーはこのビューには存在しない
  // （hashchangeはrouter.js側が一元管理し、テーマ/言語切替もtai-hub共有
  // chrome側の管轄のため、このファイルには元サイトのような自前の
  // window.addEventListener('hashchange', ...)・matchMedia監視が無い）。
  containerEl = null;
  els = {};
}

function injectStylesheet() {
  if (document.getElementById(STYLE_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_LINK_ID;
  link.rel = 'stylesheet';
  link.href = new URL('../../css/tai-revisit.css', import.meta.url).href;
  document.head.appendChild(link);
}

/* ================================================================
   ルーティング: sub ⇄ フィルター状態
   ================================================================ */
function parseSub(sub) {
  const result = { search: '', season: 'all', area: 'all', spirit: null };
  const raw = sub || '';
  if (!raw) return result;
  raw.split('&').forEach((pair) => {
    const eq = pair.indexOf('=');
    if (eq === -1) return;
    const key = pair.slice(0, eq);
    let val;
    try { val = decodeURIComponent(pair.slice(eq + 1)); } catch (e) { return; }
    if (key === 'season') result.season = val;
    else if (key === 'area') result.area = val;
    else if (key === 'search') result.search = val;
    else if (key === 'spirit') result.spirit = val;
  });
  return result;
}

// 現在の検索語・季節・エリアフィルターをURLへ静かに反映する（history.replaceState、
// hashchangeは発火させない）。いずれも既定値ならこのツールのベースルートに戻す。
function updateSubHash(searchValue, seasonValue, areaValue) {
  const parts = [];
  if (seasonValue && seasonValue !== 'all') parts.push('season=' + encodeURIComponent(seasonValue));
  if (areaValue && areaValue !== 'all') parts.push('area=' + encodeURIComponent(areaValue));
  if (searchValue) parts.push('search=' + encodeURIComponent(searchValue));
  const newHash = ROUTE_BASE + (parts.length ? '/' + parts.join('&') : '');
  if (location.hash !== newHash) {
    history.replaceState(null, '', location.pathname + location.search + newHash);
  }
}

/* ================================================================
   小さなユーティリティ（元index.htmlの同名関数の移植、挙動は変更なし）
   ================================================================ */
function normalizeSearchText(str) {
  return String(str).toLowerCase().replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

function typeLabel(type) {
  const key = { TS: 'typeVisit', SV: 'typeReturning', 'TS-Error': 'typeError' }[type];
  return key ? t(key) : type;
}

function areaLabel(area) { return CURRENT_LANG === 'en' ? area : areaJa(area); }
// 🩹 js/i18n.js の trEvent()/SEASON_NAME_EN は、このツールが使う季節名を
// ほぼ全てカバーしているが「ゴッホの季節」だけは無い（i18n.js側は同じ季節を
// 「親愛なるファン・ゴッホへ」という別表記のキーで持っているため、trEvent()に
// そのまま通すと未翻訳のまま素通りしてしまう）。この1件だけ個別に補う。
const SEASON_LABEL_OVERRIDE_EN = { 'ゴッホの季節': 'Dear Van Gogh' };
function seasonDisplay(season) {
  if (CURRENT_LANG === 'en' && SEASON_LABEL_OVERRIDE_EN[season]) return SEASON_LABEL_OVERRIDE_EN[season];
  return trEvent(season);
}

function formatDate(d) {
  const dt = new Date(d + 'T00:00:00+09:00');
  return `${dt.getFullYear()}/${dt.getMonth() + 1}/${dt.getDate()}`;
}

function getTodayStr() {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
}

// 最終来訪日（範囲のある特別来訪はendDateを終了日として優先）。開始日が今日より
// 後（まだ始まっていない予告来訪）は「最終来訪」に含めない（daysSince/ソート/
// 順位バッジが実態と逆に狂うのを防ぐ、元実装と同じガード）。
function lastVisitEndDate(s) {
  const todayStr = getTodayStr();
  const started = s.visits.filter((v) => v.date <= todayStr);
  const v = started.length ? started[started.length - 1] : s.visits[s.visits.length - 1];
  return v.endDate || v.date;
}

function daysSince(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d);
  const now = new Date();
  const todayLocal = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((todayLocal - target) / 86400000));
}

// 「最終来訪からの日数が長い順」での、全精霊(REVISIT_DATA全体)を対象にした
// 順位表（nameJa → 1始まりの順位）。季節/エリア/検索の絞り込みの影響を受けない。
function computeOverdueRanks() {
  const sorted = [...REVISIT_DATA].sort((a, b) => lastVisitEndDate(a).localeCompare(lastVisitEndDate(b)));
  const ranks = new Map();
  sorted.forEach((s, i) => ranks.set(s.nameJa, i + 1));
  return ranks;
}

function isOngoingVisit(v) {
  if (!v.endDate) return false;
  const todayStr = getTodayStr();
  return v.date <= todayStr && v.endDate >= todayStr;
}
function hasOngoingVisit(s) { return s.visits.some(isOngoingVisit); }

function spiritItemCount(nameEn) {
  const items = SPIRIT_ITEMS_MAP[nameEn];
  return items ? items.length : 0;
}
function spiritItemsHtml(nameEn) {
  const items = SPIRIT_ITEMS_MAP[nameEn];
  if (!items || !items.length) return '';
  const icons = items.map((it) => `<span class="spirit-item-icon" title="${escapeHtml(it.name)}"><img src="${it.icon}" alt="${escapeHtml(it.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.style.display='none'"></span>`).join('');
  return `<div class="spirit-items">${icons}</div>`;
}

function findSpiritCardEl(nameJa) {
  if (!els.spiritList) return null;
  return Array.from(els.spiritList.querySelectorAll('.spirit-card')).find((el) => el.dataset.spiritName === nameJa) || null;
}

// #/tai-revisit/spirit=<精霊名> ディープリンクの本体。REVISIT_DATAに実在する
// 精霊名にだけ反応し、該当カードまでスクロールして一時的にハイライトする。
// フィルターに阻まれて非表示の場合はフィルターを全解除してから再度探す。
function applySpiritHash(nameJa) {
  if (!nameJa) return;
  if (!REVISIT_DATA.some((s) => s.nameJa === nameJa)) return;
  let card = findSpiritCardEl(nameJa);
  if (!card) {
    clearAllFilters();
    card = findSpiritCardEl(nameJa);
  }
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.remove('spirit-card-highlight');
  void card.offsetWidth;
  card.classList.add('spirit-card-highlight');
  setTimeout(() => card.classList.remove('spirit-card-highlight'), 2000);
}

/* ================================================================
   フィルター用<select>の構築
   ================================================================ */
function populateSeasonFilterFor(select, dataArray, initialValue) {
  const seasons = [...new Set(dataArray.map((s) => s.season))].sort((a, b) => {
    const ia = SEASON_ORDER.indexOf(a); const ib = SEASON_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b, 'ja');
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  while (select.options.length > 1) select.remove(1);
  seasons.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = seasonDisplay(s);
    select.appendChild(opt);
  });
  select.value = (initialValue && seasons.includes(initialValue)) ? initialValue : 'all';
}

function populateAreaFilter(initialValue) {
  const usedAreas = new Set(REVISIT_DATA.map((s) => s.area));
  const known = Object.keys(AREA_JA).filter((a) => usedAreas.has(a));
  const unknown = [...usedAreas].filter((a) => !AREA_JA[a]).sort((a, b) => a.localeCompare(b));
  const areas = [...known, ...unknown];
  const select = els.areaFilter;
  while (select.options.length > 1) select.remove(1);
  areas.forEach((a) => {
    const opt = document.createElement('option');
    opt.value = a; opt.textContent = areaLabel(a);
    select.appendChild(opt);
  });
  select.value = (initialValue && areas.includes(initialValue)) ? initialValue : 'all';
}

/* ================================================================
   検索語+季節+並び順をまとめて既定値に戻す
   ================================================================ */
function clearAllFilters() {
  els.searchInput.value = '';
  els.seasonFilter.value = 'all';
  els.areaFilter.value = 'all';
  els.sortMode.value = 'latest';
  render();
}

/* ================================================================
   📊 季節フィルター選択中のみ表示するサマリー統計
   ================================================================ */
function renderSeasonSummary(seasonFilter) {
  const el = els.seasonSummary;
  if (seasonFilter === 'all') { el.classList.remove('show'); el.textContent = ''; return; }
  const seasonSpirits = REVISIT_DATA.filter((s) => s.season === seasonFilter);
  if (seasonSpirits.length === 0) { el.classList.remove('show'); el.textContent = ''; return; }
  const totalVisits = seasonSpirits.reduce((sum, s) => sum + s.visits.length, 0);
  const mostOverdue = [...seasonSpirits].sort((a, b) => lastVisitEndDate(a).localeCompare(lastVisitEndDate(b)))[0];
  const neverCount = NEVER_REVISITED_DATA.filter((s) => s.season === seasonFilter).length;
  let line = t('seasonSummaryLine', {
    season: seasonDisplay(seasonFilter),
    count: seasonSpirits.length,
    visits: totalVisits,
    mostOverdue: CURRENT_LANG === 'en' ? mostOverdue.nameEn : mostOverdue.nameJa,
    days: daysSince(lastVisitEndDate(mostOverdue)),
  });
  if (neverCount > 0) line += t('seasonSummaryNeverLine', { n: neverCount });
  el.textContent = line;
  el.classList.add('show');
}

/* ================================================================
   📅 進行中/次回の特別来訪
   ================================================================ */
function getUpcomingRevisits() {
  const todayStr = getTodayStr();
  const items = [];
  REVISIT_DATA.forEach((s) => {
    s.visits.forEach((v) => {
      if (v.type !== 'SV') return;
      if (!v.endDate) return;
      if (v.endDate < todayStr) return;
      items.push({ spirit: s, visit: v, ongoing: v.date <= todayStr });
    });
  });
  items.sort((a, b) => {
    if (a.ongoing !== b.ongoing) return a.ongoing ? -1 : 1;
    return a.visit.date.localeCompare(b.visit.date);
  });
  return items;
}

function renderUpcomingRevisits() {
  const container = els.upcomingList;
  const items = getUpcomingRevisits();
  if (items.length === 0) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(t('upcomingEmptyState'))}</div>`;
    return;
  }
  container.innerHTML = items.map(({ spirit: s, visit: v, ongoing }) => {
    const dateLabel = `${formatDate(v.date)}–${formatDate(v.endDate)}`;
    const badge = ongoing
      ? `<span class="spirit-badge ongoing">${escapeHtml(t('calendarOngoingBadge'))}</span>`
      : `<span class="spirit-badge">${escapeHtml(t('calendarNextBadge'))}</span>`;
    return `
      <div class="spirit-card">
        <div class="spirit-icon">
          <img src="${s.imageUrl}" alt="${escapeHtml(s.nameJa)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('no-image')">
          <span class="spirit-icon-fallback"><svg class="inline-icon" width="20" height="20"><use href="#i-wing"/></svg></span>
        </div>
        <div class="spirit-body">
          <span class="spirit-name-ja">${escapeHtml(s.nameJa)}</span>
          <div class="spirit-name-en">${escapeHtml(s.nameEn)}</div>
          <div class="spirit-meta">
            ${badge}
            <span class="spirit-badge">${escapeHtml(seasonDisplay(s.season))}</span>
            <span class="spirit-badge area">${escapeHtml(areaLabel(s.area))}</span>
          </div>
          ${spiritItemsHtml(s.nameEn)}
          <div class="visit-list"><span class="visit-chip sv">${dateLabel}</span></div>
        </div>
      </div>`;
  }).join('');
}

/* ================================================================
   📊 全シーズンの来訪達成度概観
   ================================================================ */
function computeSeasonAchievement() {
  const seasons = [...new Set([...REVISIT_DATA.map((s) => s.season), ...NEVER_REVISITED_DATA.map((s) => s.season)])];
  seasons.sort((a, b) => {
    const ia = SEASON_ORDER.indexOf(a); const ib = SEASON_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b, 'ja');
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  return seasons.map((season) => {
    const seasonRevisitData = REVISIT_DATA.filter((s) => s.season === season);
    const revisited = seasonRevisitData.length;
    const neverRevisited = NEVER_REVISITED_DATA.filter((s) => s.season === season).length;
    const total = revisited + neverRevisited;
    const totalVisits = seasonRevisitData.reduce((sum, s) => sum + s.visits.length, 0);
    return { season, revisited, total, totalVisits, pct: total > 0 ? Math.round((revisited / total) * 100) : 0 };
  });
}

function renderSeasonOverview() {
  const rows = computeSeasonAchievement();

  const totalRevisited = rows.reduce((sum, r) => sum + r.revisited, 0);
  const totalAll = rows.reduce((sum, r) => sum + r.total, 0);
  const overallPct = totalAll > 0 ? Math.round((totalRevisited / totalAll) * 100) : 0;
  els.seasonOverviewOverall.textContent = t('seasonOverviewOverallLine', { revisited: totalRevisited, total: totalAll, pct: overallPct });

  els.seasonOverviewList.innerHTML = rows.map((r) => `
    <button type="button" class="season-overview-row" data-season="${escapeHtml(r.season)}">
      <div class="season-overview-head">
        <span class="season-overview-name">${escapeHtml(seasonDisplay(r.season))}</span>
        <span class="season-overview-pct"><span class="num-value">${r.pct}</span><span class="num-unit">%</span></span>
      </div>
      <div class="season-overview-track"><div class="season-overview-fill" style="width:${r.pct}%"></div></div>
      <div class="season-overview-sub">${escapeHtml(t('seasonOverviewSubLine', { revisited: r.revisited, total: r.total, visits: r.totalVisits }))}</div>
    </button>`).join('');
}

function jumpToSeasonFilter(season) {
  els.seasonFilter.value = season;
  render();
  els.seasonFilter.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ================================================================
   メインリスト
   ================================================================ */
function render() {
  const rawSearch = els.searchInput.value.trim();
  const q = normalizeSearchText(rawSearch);
  const seasonFilter = els.seasonFilter.value;
  const areaFilter = els.areaFilter.value;
  const sortMode = els.sortMode.value;

  const anyFilterActive = !!q || seasonFilter !== 'all' || areaFilter !== 'all' || sortMode !== 'latest';
  els.clearAllFiltersBtn.style.display = anyFilterActive ? '' : 'none';

  let list = REVISIT_DATA.filter((s) => {
    if (seasonFilter !== 'all' && s.season !== seasonFilter) return false;
    if (areaFilter !== 'all' && s.area !== areaFilter) return false;
    if (!q) return true;
    const yomi = SPIRIT_YOMI[s.nameJa] ? normalizeSearchText(SPIRIT_YOMI[s.nameJa]) : '';
    return normalizeSearchText(s.nameJa).includes(q) || normalizeSearchText(s.nameEn).includes(q) || yomi.includes(q);
  });

  if (sortMode === 'name') {
    list = [...list].sort((a, b) => a.nameJa.localeCompare(b.nameJa, 'ja'));
  } else if (sortMode === 'count') {
    list = [...list].sort((a, b) => b.visits.length - a.visits.length);
  } else if (sortMode === 'itemCount') {
    list = [...list].sort((a, b) => spiritItemCount(b.nameEn) - spiritItemCount(a.nameEn));
  } else if (sortMode === 'itemCountAsc') {
    list = [...list].sort((a, b) => spiritItemCount(a.nameEn) - spiritItemCount(b.nameEn));
  } else if (sortMode === 'daysSince') {
    list = [...list].sort((a, b) => lastVisitEndDate(a).localeCompare(lastVisitEndDate(b)));
  } else if (sortMode === 'ongoingFirst') {
    list = [...list].sort((a, b) => {
      const oa = hasOngoingVisit(a) ? 1 : 0; const ob = hasOngoingVisit(b) ? 1 : 0;
      if (oa !== ob) return ob - oa;
      return lastVisitEndDate(b).localeCompare(lastVisitEndDate(a));
    });
  } else {
    list = [...list].sort((a, b) => lastVisitEndDate(b).localeCompare(lastVisitEndDate(a)));
  }

  els.filterStats.textContent = t('filterStats', { shown: list.length, total: REVISIT_DATA.length });
  renderSeasonSummary(seasonFilter);
  updateSubHash(rawSearch, seasonFilter, areaFilter);

  if (list.length === 0) {
    els.spiritList.innerHTML = `<div class="empty-state">${escapeHtml(t('emptyState'))}</div>`;
    return;
  }

  const overdueRanks = sortMode === 'daysSince' ? computeOverdueRanks() : null;

  els.spiritList.innerHTML = list.map((s) => {
    const chips = s.visits.map((v) => {
      const cls = v.type === 'SV' ? 'sv' : (v.type === 'TS-Error' ? 'err' : '');
      const label = typeLabel(v.type);
      // 期間表記は特別来訪(SV)だけ。単独の来訪(TS等)は来訪初日のみを表示する。
      const dateLabel = (v.type === 'SV' && v.endDate) ? `${formatDate(v.date)}–${formatDate(v.endDate)}` : formatDate(v.date);
      const ongoing = isOngoingVisit(v);
      const titleText = ongoing ? t('visitOngoingTitle', { type: label }) : label;
      return `<span class="visit-chip ${cls}" title="${escapeHtml(titleText)}">${dateLabel}${ongoing ? ' <span class="ongoing-dot"></span>' : ''}</span>`;
    }).join('');
    const rankBadge = overdueRanks
      ? `<span class="spirit-rank-badge" title="${escapeHtml(t('rankTitle'))}">${escapeHtml(t('rankLabel', { rank: overdueRanks.get(s.nameJa) }))}</span>`
      : '';
    const ongoingBadge = hasOngoingVisit(s) ? `<span class="spirit-badge ongoing">${escapeHtml(t('ongoingBadge'))}</span>` : '';
    return `
      <div class="spirit-card" data-spirit-name="${escapeHtml(s.nameJa)}">
        <div class="spirit-icon">
          <img src="${s.imageUrl}" alt="${escapeHtml(s.nameJa)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('no-image')">
          <span class="spirit-icon-fallback"><svg class="inline-icon" width="20" height="20"><use href="#i-wing"/></svg></span>
        </div>
        <div class="spirit-body">
          <span class="spirit-name-ja">${escapeHtml(s.nameJa)}</span>
          <div class="spirit-name-en">${escapeHtml(s.nameEn)}</div>
          <div class="spirit-meta">
            ${ongoingBadge}
            <span class="spirit-badge">${escapeHtml(seasonDisplay(s.season))}</span>
            <span class="spirit-badge area">${escapeHtml(areaLabel(s.area))}</span>
          </div>
          ${spiritItemsHtml(s.nameEn)}
          <div class="visit-list">${chips}</div>
          <div class="visit-count">${rankBadge}${t('visitCountLine', { count: s.visits.length, days: daysSince(lastVisitEndDate(s)) })}</div>
        </div>
      </div>`;
  }).join('');
}

/* ================================================================
   🔍 まだ一度も再訪が来ていない精霊
   ================================================================ */
function renderNeverRevisited() {
  const q = normalizeSearchText(els.neverRevisitedSearchInput.value.trim());
  const seasonFilter = els.neverRevisitedSeasonFilter.value;

  els.neverRevisitedCount.textContent = t('neverRevisitedCount', { n: NEVER_REVISITED_DATA.length });

  let list = NEVER_REVISITED_DATA.filter((s) => {
    if (seasonFilter !== 'all' && s.season !== seasonFilter) return false;
    if (!q) return true;
    const yomi = SPIRIT_YOMI[s.nameJa] ? normalizeSearchText(SPIRIT_YOMI[s.nameJa]) : '';
    return normalizeSearchText(s.nameJa).includes(q) || normalizeSearchText(s.nameEn).includes(q) || yomi.includes(q);
  });

  list = [...list].sort((a, b) => {
    const ia = SEASON_ORDER.indexOf(a.season); const ib = SEASON_ORDER.indexOf(b.season);
    if (ia !== ib) return ia - ib;
    return a.nameJa.localeCompare(b.nameJa, 'ja');
  });

  els.neverRevisitedFilterStats.textContent = t('filterStats', { shown: list.length, total: NEVER_REVISITED_DATA.length });

  if (list.length === 0) {
    els.neverRevisitedList.innerHTML = `<div class="empty-state">${escapeHtml(t('emptyState'))}</div>`;
    return;
  }

  els.neverRevisitedList.innerHTML = list.map((s) => `
    <div class="spirit-card">
      <div class="spirit-icon${s.imageUrl ? '' : ' no-image'}">
        ${s.imageUrl
    ? `<img src="${s.imageUrl}" alt="${escapeHtml(s.nameJa)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('no-image')"><span class="spirit-icon-fallback"><svg class="inline-icon" width="20" height="20"><use href="#i-wing"/></svg></span>`
    : '<svg class="inline-icon" width="20" height="20"><use href="#i-wing"/></svg>'}
      </div>
      <div class="spirit-body">
        <span class="spirit-name-ja">${escapeHtml(s.nameJa)}</span>
        <div class="spirit-name-en">${escapeHtml(s.nameEn)}</div>
        <div class="spirit-meta">
          <span class="spirit-badge">${escapeHtml(seasonDisplay(s.season))}</span>
          <span class="spirit-badge area">${escapeHtml(areaLabel(s.area))}</span>
        </div>
        ${spiritItemsHtml(s.nameEn)}
      </div>
    </div>`).join('');
}

/* ================================================================
   マークアップ（外枠）
   ================================================================ */
function renderShell() {
  return `
    <div class="tai-revisit-view">
      <div class="tr-wrap">
        <header class="page-head">
          <h1>${escapeHtml(CURRENT_LANG === 'en' ? 'Revisit Spirit Database' : '再訪精霊データベース')}</h1>
        </header>

        <div class="card">
          <p><span>${escapeHtml(t('introPart1'))}</span>
            <a href="https://github.com/Silverfeelin/SkyGame-Data" target="_blank" rel="noopener noreferrer">SkyGame-Data</a>
            <span>${escapeHtml(t('introPart2'))}</span></p>
        </div>

        <p class="sec-label">${escapeHtml(t('upcomingSectionLabel'))}</p>
        <div class="sec-sub">${escapeHtml(t('upcomingSectionSub'))}</div>
        <div class="spirit-list" id="trUpcomingList"></div>

        <details class="collapse-section" id="trSeasonOverviewSection">
          <summary class="collapse-summary">
            <span>${escapeHtml(t('seasonOverviewSummary'))}</span>
          </summary>
          <div class="collapse-note">${escapeHtml(t('seasonOverviewNote'))}</div>
          <div class="season-overview-overall" id="trSeasonOverviewOverall"></div>
          <div id="trSeasonOverviewList"></div>
        </details>

        <div class="filter-card">
          <div class="filter-row">
            <input type="search" class="filter-search" id="trSearchInput" placeholder="${escapeHtml(t('searchPlaceholder'))}">
            <select class="filter-select" id="trSeasonFilter">
              <option value="all">${escapeHtml(t('seasonAll'))}</option>
            </select>
            <select class="filter-select" id="trAreaFilter">
              <option value="all">${escapeHtml(t('areaAll'))}</option>
            </select>
            <select class="filter-select" id="trSortMode">
              <option value="latest">${escapeHtml(t('sortLatest'))}</option>
              <option value="daysSince">${escapeHtml(t('sortDaysSince'))}</option>
              <option value="ongoingFirst">${escapeHtml(t('sortOngoing'))}</option>
              <option value="name">${escapeHtml(t('sortName'))}</option>
              <option value="count">${escapeHtml(t('sortCount'))}</option>
              <option value="itemCount">${escapeHtml(t('sortItemCount'))}</option>
              <option value="itemCountAsc">${escapeHtml(t('sortItemCountAsc'))}</option>
            </select>
          </div>
          <div class="filter-legend" role="group" aria-label="${escapeHtml(t('visitTypeLegendLabel'))}">
            <span class="visit-chip">${escapeHtml(t('typeVisit'))}</span>
            <span class="visit-chip sv">${escapeHtml(t('typeReturning'))}</span>
            <span class="visit-chip err">${escapeHtml(t('typeError'))}</span>
          </div>
          <div class="filter-stats-row">
            <div class="filter-stats" id="trFilterStats"></div>
            <button type="button" class="filter-clear-btn" id="trClearAllFiltersBtn" style="display:none;">${escapeHtml(t('clearAllFiltersBtn'))}</button>
          </div>
          <div class="season-summary" id="trSeasonSummary"></div>
        </div>

        <div class="spirit-list" id="trSpiritList"></div>

        <details class="collapse-section" id="trNeverRevisitedSection">
          <summary class="collapse-summary">
            <span>${escapeHtml(t('collapseSummary'))}</span><span class="collapse-count" id="trNeverRevisitedCount"></span>
          </summary>
          <div class="collapse-note">${escapeHtml(t('collapseNote'))}</div>
          <div class="filter-row">
            <input type="search" class="filter-search" id="trNeverRevisitedSearchInput" placeholder="${escapeHtml(t('searchPlaceholder'))}">
            <select class="filter-select" id="trNeverRevisitedSeasonFilter">
              <option value="all">${escapeHtml(t('seasonAll'))}</option>
            </select>
          </div>
          <div class="filter-stats" id="trNeverRevisitedFilterStats"></div>
          <div class="spirit-list" id="trNeverRevisitedList"></div>
        </details>
      </div>

      <footer>
        <span>${escapeHtml(t('footerDisclaimer'))}</span><br>
        <span>${escapeHtml(t('footerDataLabel'))}</span><a href="https://github.com/Silverfeelin/SkyGame-Data" target="_blank" rel="noopener noreferrer">SkyGame-Data</a><span>${escapeHtml(t('footerDataCredit'))}</span>
        <span>${escapeHtml(t('footerIconLabel'))}</span>${escapeHtml(t('footerIconCredit'))}<br>
        <span>${escapeHtml(t('footerCreditLabel'))}</span><a href="https://x.com/Skyzztai" target="_blank" rel="noopener noreferrer">@Skyzztai</a>　／
        <a href="https://odaibako.net/u/Skyzztai" target="_blank" rel="noopener noreferrer">${escapeHtml(t('footerRequestForm'))}</a><br>
        <span style="font-size:12px; margin-top:4px; display:inline-block;">
          <a href="#/tai-info">${escapeHtml(t('footerInfoLink'))}</a>
        </span>
      </footer>
    </div>`;
}

function cacheEls() {
  els = {
    searchInput: containerEl.querySelector('#trSearchInput'),
    seasonFilter: containerEl.querySelector('#trSeasonFilter'),
    areaFilter: containerEl.querySelector('#trAreaFilter'),
    sortMode: containerEl.querySelector('#trSortMode'),
    filterStats: containerEl.querySelector('#trFilterStats'),
    clearAllFiltersBtn: containerEl.querySelector('#trClearAllFiltersBtn'),
    seasonSummary: containerEl.querySelector('#trSeasonSummary'),
    spiritList: containerEl.querySelector('#trSpiritList'),
    upcomingList: containerEl.querySelector('#trUpcomingList'),
    seasonOverviewOverall: containerEl.querySelector('#trSeasonOverviewOverall'),
    seasonOverviewList: containerEl.querySelector('#trSeasonOverviewList'),
    neverRevisitedCount: containerEl.querySelector('#trNeverRevisitedCount'),
    neverRevisitedSearchInput: containerEl.querySelector('#trNeverRevisitedSearchInput'),
    neverRevisitedSeasonFilter: containerEl.querySelector('#trNeverRevisitedSeasonFilter'),
    neverRevisitedFilterStats: containerEl.querySelector('#trNeverRevisitedFilterStats'),
    neverRevisitedList: containerEl.querySelector('#trNeverRevisitedList'),
  };
}

function wireEvents() {
  els.searchInput.addEventListener('input', render);
  els.seasonFilter.addEventListener('change', render);
  els.areaFilter.addEventListener('change', render);
  els.sortMode.addEventListener('change', render);
  els.clearAllFiltersBtn.addEventListener('click', clearAllFilters);
  els.neverRevisitedSearchInput.addEventListener('input', renderNeverRevisited);
  els.neverRevisitedSeasonFilter.addEventListener('change', renderNeverRevisited);
  els.seasonOverviewList.addEventListener('click', (e) => {
    const row = e.target.closest('.season-overview-row');
    if (!row) return;
    jumpToSeasonFilter(row.dataset.season);
  });
}

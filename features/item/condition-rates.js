/* ================================================================
   condition-rates.js — 条件別の達成率（無課金・限定など）

   全体の達成率を「無課金で入手できる」「限定（復刻なし）」などの条件で切り分けて
   表示する。item/index.html の同名セクション（renderConditionRates）と同じ内容。
   titles-panel.js の全体達成率ゲージの直下にマウントされる。

   ・元データ: 各カテゴリの data/items/<catKey>.js の ITEMS（dynamic import・キャッシュ）
   ・所持状態: js/state.js の getCategoryState(catKey).owned
   ・That Sky Shop は集計対象外（旧サイトの条件別達成率と同じ。全体ゲージ・カテゴリ件数も同じ規則）
   ・cost==='free' は、キャンドル/ハート交換・アドベンチャーパス入手など「課金なしで入手できる」もの
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { getCategoryState } from '../../js/state.js';
import { CATEGORY_REGISTRY } from './data/categories.js';
import { isSeasonLikeEvent } from './data/season-data.js';

const STYLE_ID = 'item-condition-rates-styles';
// 開閉状態は端末ごとの表示設定（旧サイトと同じキー。折りたたみ=1）
const COLLAPSED_KEY = 'itemCondRatesCollapsed_v1';
const CHEVRON_PATH = '<g transform="translate(12 12) scale(1.458) translate(-12 -12)"><path d="M9 6l6 6-6 6"/></g>';
function readCollapsed() {
  try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch (e) { return false; }
}
const GRID_CAT_KEYS = CATEGORY_REGISTRY.filter(c => c.section === 'grid').map(c => c.key);

function isDayLikeEvent(e) {
  return !isSeasonLikeEvent(e) && (e.includes('日々') || e === 'Skyアニバーサリー');
}

const ROWS = [
  { ja: '無課金で入手できる', en: 'Free (no purchase needed)',
    descJa: 'キャンドル・ハート交換やアドベンチャーパス入手など、課金なしで手に入るアイテム',
    descEn: 'Items you can get without paying (Candle/Heart trades, Adventure Pass rewards, etc.)',
    test: it => it.cost === 'free' },
  { ja: '課金アイテム', en: 'Paid items', test: it => it.cost === 'premium' },
  { ja: '限定（復刻なし）', en: 'Limited (no re-release)', test: it => !!it.noReprint },
  { ja: '無課金の限定アイテム', en: 'Free & limited',
    descJa: '無課金で入手できたが、復刻されないアイテム',
    descEn: 'Free items that will not be re-released',
    test: it => it.cost === 'free' && !!it.noReprint },
  { ja: '復刻の可能性あり', en: 'May be re-released', test: it => !it.noReprint },
  { ja: '季節のアイテム', en: 'Season items', test: it => isSeasonLikeEvent(it.event) },
  { ja: '日々イベントのアイテム', en: 'Days event items', test: it => isDayLikeEvent(it.event) },
  { ja: '恒常精霊のアイテム', en: 'Regular spirit items', test: it => it.event === '恒常精霊' },
  { ja: '染料に対応', en: 'Dyeable', test: it => !!it.dye },
];

// data/items/<catKey>.js は静的配列なので、一度読み込んだPromiseを使い回す
const itemsCache = new Map(); // catKey -> Promise<item[]>
function loadItems(catKey) {
  if (!itemsCache.has(catKey)) {
    itemsCache.set(catKey, import(`./data/items/${catKey}.js`)
      .then(mod => (Array.isArray(mod.ITEMS) ? mod.ITEMS : []))
      .catch(e => { console.error(`[item condition-rates] failed to load item data: ${catKey}`, e); return []; }));
  }
  return itemsCache.get(catKey);
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.item-view .cond-toggle {
  display: flex; align-items: center; justify-content: space-between; width: 100%;
  background: none; border: 0; cursor: pointer; font-family: inherit; text-align: left;
  font-size: 13px; font-weight: 700; color: var(--text-2); text-transform: uppercase; letter-spacing: 0.02em;
  padding: 0; margin: 20px 0 8px;
}
.item-view .cond-chev { transition: transform 0.2s; transform: rotate(90deg); }
.item-view .cond-toggle[aria-expanded="false"] .cond-chev { transform: rotate(0deg); }
.item-view .cond-section.collapsed .cond-card { display: none; }
.item-view .cond-card {
  background: var(--card); border-radius: var(--r); padding: 10px 16px 6px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.07), 0 0.5px 1px rgba(0,0,0,0.04);
  display: grid; grid-template-columns: 1fr; column-gap: 28px;
}
@media (min-width: 640px) { .item-view .cond-card { grid-template-columns: 1fr 1fr; } }
.item-view .cond-row { padding: 9px 0 7px; min-width: 0; }
.item-view .cond-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 7px; }
.item-view .cond-name { font-size: 13px; font-weight: 600; color: var(--text); line-height: 1.35; }
.item-view .cond-pct { font-size: 14px; font-weight: 700; color: var(--orange); white-space: nowrap; }
.item-view .cond-pct.high { color: var(--green); }
.item-view .cond-pct.empty { color: var(--text-3); }
.item-view .cond-sub { font-size: 11px; color: var(--text-2); }
.item-view .cond-desc { font-size: 11px; color: var(--text-2); line-height: 1.5; margin-top: 2px; }
.item-view .cond-note { grid-column: 1 / -1; font-size: 11px; color: var(--text-2); padding: 6px 0 8px; border-top: 1px solid var(--sep); margin-top: 4px; }
.item-view .cond-loading { grid-column: 1 / -1; font-size: 12px; color: var(--text-2); padding: 14px 0; text-align: center; }
`;
  document.head.appendChild(style);
}

function rowHtml(row, owned, total, en) {
  const p = Math.round(owned / total * 100);
  const high = p >= 80;
  const desc = en ? row.descEn : row.descJa;
  return `
    <div class="cond-row">
      <div class="cond-top">
        <span class="cond-name">${escapeHtml(en ? row.en : row.ja)}</span>
        <span class="cond-pct ${p === 0 ? 'empty' : high ? 'high' : ''}">${p}<span class="num-unit">%</span></span>
      </div>
      <div class="cat-bar"><div class="cat-fill ${high ? 'high' : ''}" style="width:${p}%"></div></div>
      <div class="cond-sub">${owned} / ${total}${en ? ' owned' : ' 所持'}</div>
      ${desc ? `<div class="cond-desc">${escapeHtml(desc)}</div>` : ''}
    </div>`;
}

/** container（titles-panel.js が用意した空の要素）に「条件別の達成率」セクションを描画する */
export async function mount(container) {
  if (!container) return;
  injectStyles();
  const en = CURRENT_LANG === 'en';
  const collapsed = readCollapsed();
  container.innerHTML = `
    <div class="cond-section${collapsed ? ' collapsed' : ''}">
      <button type="button" class="cond-toggle" aria-expanded="${!collapsed}">
        <span>${en ? 'Completion Rate by Condition' : '条件別の達成率'}</span>
        <svg class="inline-icon cond-chev" width="14" height="14" viewBox="0 0 24 24">${CHEVRON_PATH}</svg>
      </button>
      <div class="cond-card"><div class="cond-loading">${en ? 'Loading…' : '読み込み中…'}</div></div>
    </div>`;
  const section = container.querySelector('.cond-section');
  const toggle = container.querySelector('.cond-toggle');
  toggle.addEventListener('click', () => {
    const nowCollapsed = !section.classList.contains('collapsed');
    section.classList.toggle('collapsed', nowCollapsed);
    toggle.setAttribute('aria-expanded', String(!nowCollapsed));
    try { localStorage.setItem(COLLAPSED_KEY, nowCollapsed ? '1' : '0'); } catch (e) { /* noop */ }
  });

  const perCat = await Promise.all(GRID_CAT_KEYS.map(async catKey => {
    const items = await loadItems(catKey);
    const { owned } = getCategoryState(catKey);
    return items.map(it => ({ it, owned: !!owned[it.id] }));
  }));
  if (!document.body.contains(container)) return; // await中に別ルートへ遷移済みなら描画しない

  // That Sky Shop は集計対象外（旧サイトの全体達成率と同じ）
  const all = perCat.flat().filter(x => x.it.event !== 'That Sky Shop');
  const rowsHtml = ROWS.map(row => {
    const hit = all.filter(x => row.test(x.it));
    if (hit.length === 0) return '';
    return rowHtml(row, hit.filter(x => x.owned).length, hit.length, en);
  }).join('');

  const card = container.querySelector('.cond-card');
  if (card) {
    card.innerHTML = rowsHtml + `<div class="cond-note">${en
      ? 'Items from That Sky Shop are excluded from these rates.'
      : '※ That Sky Shop のアイテムは集計対象外です。'}</div>`;
  }
}

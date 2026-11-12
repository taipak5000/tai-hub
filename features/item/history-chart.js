/* ================================================================
   📈 達成率の推移（アイテム所持管理のトップ。2026-11-12）。
   記録は js/collection-history.js（所持チェックを変えた日ごとに1件）。外部ライブラリは使わず、SVGの折れ線を自前で描く。
   ・全体の達成率を出し、カテゴリを選ぶとそのカテゴリだけの推移に切り替わる（選んだものは端末に残す）。
   ・記録が1日分しか無い間は、グラフの代わりに「記録が2日分たまるとグラフになります」と出す。
   ・色だけに頼らないよう、最初と最後の数値と増えた量を文字でも出す。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { readHistory, recordSnapshot, HISTORY_CATS } from '../../js/collection-history.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
const SEL_KEY = 'sky_hub_history_cat';
const STYLE_ID = 'item-history-chart-styles';
let hostEl = null;
let onHist = null;

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement('style');
  st.id = STYLE_ID;
  st.textContent = `
.item-view .hc-card { background: var(--card); border-radius: var(--r); padding: 14px 14px 10px; margin-bottom: 10px; }
.item-view .hc-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 6px; }
.item-view .hc-now { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; color: var(--text); font-variant-numeric: tabular-nums; }
.item-view .hc-now small { font-size: 12px; font-weight: 500; color: var(--text-2); margin-left: 4px; letter-spacing: 0; }
.item-view .hc-select { max-width: 52%; padding: 6px 8px; border: 1px solid var(--border, rgba(0,0,0,0.1)); border-radius: 9px; background: var(--card); color: var(--text); font: inherit; font-size: 12.5px; }
.item-view .hc-svg { display: block; width: 100%; height: auto; overflow: visible; }
.item-view .hc-grid { stroke: var(--border, rgba(0,0,0,0.08)); stroke-width: 1; }
.item-view .hc-axis { fill: var(--text-2); font-size: 10px; font-variant-numeric: tabular-nums; }
.item-view .hc-area { fill: var(--blue); opacity: 0.1; }
.item-view .hc-line { fill: none; stroke: var(--blue); stroke-width: 2.2; stroke-linejoin: round; stroke-linecap: round; }
.item-view .hc-dot { fill: var(--card); stroke: var(--blue); stroke-width: 2; }
.item-view .hc-summary { margin: 6px 0 0; font-size: 12px; color: var(--text-2); font-variant-numeric: tabular-nums; }
.item-view .hc-empty { margin: 4px 0 2px; font-size: 12.5px; line-height: 1.6; color: var(--text-2); }
@media (prefers-contrast: more) { .item-view .hc-area { opacity: 0.2; } .item-view .hc-grid { stroke: var(--text-2); } }
`;
  document.head.appendChild(st);
}

function selected() { try { return localStorage.getItem(SEL_KEY) || 'all'; } catch (e) { return 'all'; } }
function pctOf(r, key) {
  if (key === 'all') return r.total ? (r.owned / r.total) * 100 : null;
  const c = r.cats && r.cats[key];
  return c && c[1] ? (c[0] / c[1]) * 100 : null;
}
const fmt = v => (Math.round(v * 10) / 10).toFixed(1);
function md(date) { const [, m, d] = date.split('-').map(Number); return `${m}/${d}`; }

function chartSvg(points) {
  const W = 320, H = 130, L = 34, R = 8, T = 8, B = 20;
  const t0 = Date.parse(points[0].date), t1 = Date.parse(points[points.length - 1].date);
  const span = Math.max(1, t1 - t0);
  const vals = points.map(p => p.v);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max(1, (hi - lo) * 0.2);
  lo = Math.max(0, Math.floor(lo - pad)); hi = Math.min(100, Math.ceil(hi + pad));
  if (hi - lo < 2) { hi = Math.min(100, lo + 2); lo = Math.max(0, hi - 2); }
  const x = d => L + ((Date.parse(d) - t0) / span) * (W - L - R);
  const y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const pts = points.map(p => [x(p.date), y(p.v)]);
  const line = pts.map(([a, b], i) => `${i ? 'L' : 'M'}${a.toFixed(1)},${b.toFixed(1)}`).join('');
  const area = `${line}L${pts[pts.length - 1][0].toFixed(1)},${H - B}L${pts[0][0].toFixed(1)},${H - B}Z`;
  const ticks = [lo, (lo + hi) / 2, hi];
  const dots = points.length <= 40 ? pts.map(([a, b]) => `<circle class="hc-dot" cx="${a.toFixed(1)}" cy="${b.toFixed(1)}" r="2.6"/>`).join('') : '';
  return `<svg class="hc-svg" viewBox="0 0 ${W} ${H}" role="img" aria-hidden="true">
    ${ticks.map(v => `<line class="hc-grid" x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="hc-axis" x="${L - 5}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end">${Math.round(v)}%</text>`).join('')}
    <path class="hc-area" d="${area}"/>
    <path class="hc-line" d="${line}"/>
    ${dots}
    <text class="hc-axis" x="${L}" y="${H - 5}">${md(points[0].date)}</text>
    <text class="hc-axis" x="${W - R}" y="${H - 5}" text-anchor="end">${md(points[points.length - 1].date)}</text>
  </svg>`;
}

function render() {
  if (!hostEl) return;
  const key = selected();
  const hist = readHistory();
  const points = hist.map(r => ({ date: r.date, v: pctOf(r, key) })).filter(p => p.v !== null);
  const opts = [`<option value="all"${key === 'all' ? ' selected' : ''}>${t('全体', 'Overall')}</option>`]
    .concat(HISTORY_CATS.map(c => `<option value="${c.key}"${key === c.key ? ' selected' : ''}>${escapeHtml(t(c.name, c.nameEn))}</option>`)).join('');
  const last = points[points.length - 1];
  let body;
  if (points.length < 2) {
    body = `<p class="hc-empty">${t('所持チェックを変えた日ごとに達成率を記録します。2日分たまるとグラフになります。', 'Your completion rate is saved on each day you check items. The graph appears once there are two days of records.')}</p>`;
  } else {
    const first = points[0];
    const diff = last.v - first.v;
    body = `${chartSvg(points)}
      <p class="hc-summary">${t(`${md(first.date)} ${fmt(first.v)}% → ${md(last.date)} ${fmt(last.v)}%（${diff >= 0 ? '+' : ''}${fmt(diff)}ポイント）`, `${md(first.date)} ${fmt(first.v)}% → ${md(last.date)} ${fmt(last.v)}% (${diff >= 0 ? '+' : ''}${fmt(diff)} pts)`)}</p>`;
  }
  hostEl.innerHTML = `<div class="hc-card">
    <div class="hc-head">
      <div class="hc-now">${last ? `${fmt(last.v)}%` : '--%'}<small>${last ? t(`${md(last.date)}時点`, `as of ${md(last.date)}`) : ''}</small></div>
      <select class="hc-select" aria-label="${t('表示するカテゴリ', 'Category')}">${opts}</select>
    </div>
    ${body}
  </div>`;
  hostEl.querySelector('.hc-select').addEventListener('change', e => {
    try { localStorage.setItem(SEL_KEY, e.target.value); } catch (err) { /* noop */ }
    render();
  });
}

/** アイテム所持管理のトップに描く（mount のたびに呼んでよい） */
export function mountHistoryChart(el) {
  injectStyles();
  hostEl = el;
  render();
  if (!onHist) { onHist = () => render(); document.addEventListener('hub-collection-history', onHist); }
  // まだ記録が無い（この機能より前から使っている）時は、今日の分を最初の1件として残す
  if (!readHistory().length) recordSnapshot().catch(() => {});
}
export function unmountHistoryChart() {
  if (onHist) document.removeEventListener('hub-collection-history', onHist);
  onHist = null;
  hostEl = null;
}

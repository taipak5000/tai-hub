/* ================================================================
   🫙 キャンドル貯金箱（#/candle-jar）。ノマキャン計算機の兄弟機能（関連ツールの一覧ではノマキャン計算機のすぐ下）。
   目標の本数を決めて、キャンドルがたまっていく様子を瓶で見る。見た目はノマキャン計算機と同じ
   （ルート要素に .nomacan-view を付けて css/tai-nomacan.css の色・書体・カードをそのまま使う。着せ替えの対応表も共通）。

   - 今の本数はノマキャン計算機などと共通の wishOwnCurrency.candle をそのまま使い、ここで直してもよい
   - candlePiggy_v1: { goal, label, log: { 'YYYY-MM-DD': 本数 } }
     開いた日の本数を1日1回残し、増え方のグラフにする（最大120日）。試作（#/lab-piggy）の頃と同じキー＝データはそのまま
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { nsKey } from '../../js/state.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
const KEY = 'candlePiggy_v1';
const STYLE_LINK_ID = 'nomacan-view-styles'; // nomacan-view.js と同じ（同じCSSを二重に読まない）

let containerEl = null;
let doc = null;

function readJson(key, fb) { try { const v = JSON.parse(localStorage.getItem(nsKey(key))); return v == null ? fb : v; } catch (e) { return fb; } }
function writeJson(key, v) { try { localStorage.setItem(nsKey(key), JSON.stringify(v)); } catch (e) { /* noop */ } }
function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

function load() {
  const d = readJson(KEY, {}) || {};
  const log = {};
  if (d.log && typeof d.log === 'object') Object.keys(d.log).sort().slice(-120).forEach(k => { if (/^\d{4}-\d{2}-\d{2}$/.test(k) && Number.isFinite(d.log[k])) log[k] = Math.max(0, d.log[k]); });
  return { goal: Number.isFinite(d.goal) && d.goal > 0 ? Math.min(99999, d.goal) : 300, label: typeof d.label === 'string' ? d.label.slice(0, 40) : '', log };
}
function candles() { const c = readJson('wishOwnCurrency', {}) || {}; return Math.max(0, Math.floor(Number(c.candle) || 0)); }
function setCandles(n) { const c = readJson('wishOwnCurrency', {}) || {}; c.candle = Math.max(0, Math.floor(n)); writeJson('wishOwnCurrency', c); }
function record() { doc.log[today()] = candles(); writeJson(KEY, doc); }

function injectStylesheet() {
  if (document.getElementById(STYLE_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_LINK_ID; link.rel = 'stylesheet';
  link.href = new URL('../../css/tai-nomacan.css', import.meta.url).href;
  document.head.appendChild(link);
}

export function mount(container) {
  injectStylesheet();
  containerEl = container;
  doc = load();
  record();
  container.innerHTML = `<div class="nomacan-view candle-jar-view"><div class="nm-wrap">
    <header class="page-head">
      <div class="title-icon" aria-hidden="true"></div>
      <h1>${t('キャンドル貯金箱', 'Candle Jar')}</h1>
      <p class="subtitle">${t('目標の本数まで、キャンドルがたまっていく様子を瓶で見られます', 'Watch your candles fill a jar toward your goal')}</p>
    </header>
    <div class="cj-body"></div>
  </div></div>`;
  render();
  const r = root();
  r.addEventListener('click', onClick);
  r.addEventListener('change', onChange);
}
export function unmount() { containerEl = null; }
function root() { return containerEl && containerEl.querySelector('.candle-jar-view'); }

function render() {
  const r = root();
  if (!r) return;
  const now = candles();
  const pct = Math.min(1, now / doc.goal);
  const left = Math.max(0, doc.goal - now);
  const keys = Object.keys(doc.log).sort();
  const recent = keys.slice(-30);
  const weekAgo = keys.length ? doc.log[keys[Math.max(0, keys.length - 8)]] : now;
  const weekGain = now - weekAgo;
  const max = Math.max(doc.goal, ...recent.map(k => doc.log[k]), 1);
  // 瓶の中のキャンドル（たまった割合に応じて下から並べる。重くならないよう最大60本まで描く）
  const n = Math.round(pct * 60);
  const sticks = Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / 10), col = i % 10;
    return `<span class="cj-stick" style="left:${8 + col * 8.4 + (row % 2) * 4}%;bottom:${4 + row * 13}%;animation-delay:${i * 18}ms"></span>`;
  }).join('');
  r.querySelector('.cj-body').innerHTML = `
    <section class="card cj-stage-card">
      <div class="cj-stage">
        <div class="cj-jar${pct >= 1 ? ' is-full' : ''}" role="img" aria-label="${t(`${Math.round(pct * 100)}%たまっています`, `${Math.round(pct * 100)}% full`)}">
          <span class="cj-lid"></span><span class="cj-fill" style="height:${Math.round(pct * 92)}%"></span>${sticks}
          <span class="cj-pct">${Math.round(pct * 100)}%</span>
        </div>
        <div class="cj-info">
          <div class="cj-label">${escapeHtml(doc.label || t('目標', 'Goal'))}</div>
          <div class="cj-num"><b>${now.toLocaleString()}</b><span>/ ${doc.goal.toLocaleString()}${t('本', '')}</span></div>
          <div class="cj-left${pct >= 1 ? ' is-done' : ''}">${pct >= 1 ? t('目標達成！おめでとうございます', 'Goal reached!') : t(`あと${left.toLocaleString()}本`, `${left.toLocaleString()} to go`)}</div>
          ${keys.length > 1 ? `<div class="cj-gain">${t(`この1週間で ${weekGain >= 0 ? '+' : ''}${weekGain}本`, `This week: ${weekGain >= 0 ? '+' : ''}${weekGain}`)}</div>` : ''}
        </div>
      </div>
    </section>

    <section class="card">
      <h2><svg class="inline-icon" width="18" height="18"><use href="#i-candle"/></svg>${t('貯金の設定', 'Settings')}</h2>
      <div class="field">
        <label for="cjNow">${t('いまのキャンドル（ノマキャン計算機と共通）', 'Candles now (shared with the calculator)')}</label>
        <div class="input-suffix"><input type="number" id="cjNow" inputmode="numeric" min="0" data-f="now" value="${now}"><span class="unit">${t('本', '')}</span></div>
        <div class="quick-actions-row">${[1, 5, 10, 20].map(v => `<button type="button" class="fill-current-btn" data-act="add" data-v="${v}">+${v}</button>`).join('')}<button type="button" class="fill-current-btn cj-minus" data-act="add" data-v="-1">−1</button></div>
      </div>
      <div class="field">
        <label for="cjGoal">${t('目標の本数', 'Goal')}</label>
        <div class="input-suffix"><input type="number" id="cjGoal" inputmode="numeric" min="1" data-f="goal" value="${doc.goal}"><span class="unit">${t('本', '')}</span></div>
      </div>
      <div class="field">
        <label for="cjLabel">${t('何のための貯金？', 'Saving for')}</label>
        <input class="cj-text" id="cjLabel" data-f="label" maxlength="40" value="${escapeHtml(doc.label)}" placeholder="${t('例: 次の季節パス、あのケープ', 'e.g. the next season pass')}">
      </div>
    </section>

    ${recent.length > 1 ? `<section class="card">
      <h2><svg class="inline-icon" width="18" height="18"><use href="#i-calendar"/></svg>${t('最近のたまり方', 'Recent growth')}</h2>
      <div class="cj-chart">${recent.map(k => `<span title="${k}: ${doc.log[k]}" style="height:${Math.max(3, Math.round(doc.log[k] / max * 100))}%"></span>`).join('')}<i class="cj-goal-line" style="bottom:${Math.round(doc.goal / max * 100)}%"></i></div>
      <p class="field-hint">${t('このページを開いた日の本数を1日1回記録しています。点線が目標です。', 'The count is recorded once a day when you open this page. The dashed line is your goal.')}</p>
    </section>` : ''}`;
}

function onClick(e) {
  const b = e.target.closest('[data-act=add]');
  if (!b) return;
  setCandles(candles() + Number(b.dataset.v));
  record(); render();
}
function onChange(e) {
  const f = e.target.dataset.f;
  if (!f) return;
  if (f === 'now') setCandles(Number(e.target.value) || 0);
  if (f === 'goal') doc.goal = Math.min(99999, Math.max(1, Math.floor(Number(e.target.value) || 1)));
  if (f === 'label') doc.label = e.target.value.slice(0, 40);
  record(); render();
}

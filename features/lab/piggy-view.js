/* ================================================================
   🫙 キャンドル貯金箱（#/lab-piggy・試作）。目標の本数を決めて、たまっていく様子を瓶で見る。
   今の本数は他ツールと共通の wishOwnCurrency.candle（ノマキャン計算機などで入れた値）をそのまま使い、ここで直してもよい。
   candlePiggy_v1: { goal, label, log: { 'YYYY-MM-DD': 本数 } }   // 開いた日の本数を1日1回残し、増え方のグラフにする（最大120日）
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { injectStylesheet } from '../bingo/bingo-view.js';
import { t, readJson, writeJson, localDateStr, labHeadHtml } from './lab-common.js';

const KEY = 'candlePiggy_v1';
let containerEl = null;
let doc = null;

function load() {
  const d = readJson(KEY, {});
  const log = {};
  if (d && d.log && typeof d.log === 'object') Object.keys(d.log).sort().slice(-120).forEach(k => { if (/^\d{4}-\d{2}-\d{2}$/.test(k) && Number.isFinite(d.log[k])) log[k] = Math.max(0, d.log[k]); });
  return { goal: Number.isFinite(d.goal) && d.goal > 0 ? Math.min(99999, d.goal) : 300, label: typeof d.label === 'string' ? d.label.slice(0, 40) : '', log };
}
function candles() { const c = readJson('wishOwnCurrency', {}); return Math.max(0, Math.floor(Number(c.candle) || 0)); }
function setCandles(n) { const c = readJson('wishOwnCurrency', {}); c.candle = Math.max(0, Math.floor(n)); writeJson('wishOwnCurrency', c); }

export function mount(container) {
  injectStylesheet();
  containerEl = container;
  doc = load();
  doc.log[localDateStr()] = candles();
  writeJson(KEY, doc);
  container.innerHTML = '<div class="lab-piggy-view fun-view"></div>';
  render();
  root().addEventListener('click', onClick);
  root().addEventListener('change', onChange);
}
export function unmount() { containerEl = null; }
function root() { return containerEl && containerEl.querySelector('.lab-piggy-view'); }

function render() {
  const r = root();
  if (!r) return;
  const now = candles();
  const pct = Math.min(1, now / doc.goal);
  const left = Math.max(0, doc.goal - now);
  const keys = Object.keys(doc.log).sort();
  const recent = keys.slice(-30);
  const first = keys.length ? doc.log[keys[Math.max(0, keys.length - 8)]] : now;
  const weekGain = now - first;
  const max = Math.max(doc.goal, ...recent.map(k => doc.log[k]), 1);
  // 瓶の中のキャンドル（たまった割合に応じて、下から並べる。多すぎると重いので最大60本まで描く）
  const n = Math.round(pct * 60);
  const sticks = Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / 10), col = i % 10;
    return `<span class="pg-stick" style="left:${8 + col * 8.4 + (row % 2) * 4}%;bottom:${4 + row * 13}%;animation-delay:${i * 18}ms"></span>`;
  }).join('');
  r.innerHTML = `<div class="fun-wrap">
    ${labHeadHtml('piggy', t('目標の本数を決めて、キャンドルがたまっていく様子を瓶で見られます。今の本数はノマキャン計算機などと共通です。', 'Set a goal and watch your candles fill the jar. The count is shared with the candle calculators.'))}
    <section class="pg-stage">
      <div class="pg-jar${pct >= 1 ? ' is-full' : ''}" role="img" aria-label="${t(`${Math.round(pct * 100)}%たまっています`, `${Math.round(pct * 100)}% full`)}">
        <span class="pg-lid"></span>
        <span class="pg-fill" style="height:${Math.round(pct * 92)}%"></span>
        ${sticks}
        <span class="pg-pct">${Math.round(pct * 100)}%</span>
      </div>
      <div class="pg-info">
        <div class="pg-label">${escapeHtml(doc.label || t('目標', 'Goal'))}</div>
        <div class="pg-num"><b>${now.toLocaleString()}</b><span>/ ${doc.goal.toLocaleString()}${t('本', '')}</span></div>
        <div class="pg-left">${pct >= 1 ? t('目標達成！おめでとうございます', 'Goal reached!') : t(`あと${left.toLocaleString()}本`, `${left.toLocaleString()} to go`)}</div>
        ${keys.length > 1 ? `<div class="pg-gain">${t(`この1週間で ${weekGain >= 0 ? '+' : ''}${weekGain}本`, `This week: ${weekGain >= 0 ? '+' : ''}${weekGain}`)}</div>` : ''}
      </div>
    </section>
    <section class="pg-form">
      <label class="wp-field"><span>${t('いまのキャンドル', 'Candles now')}</span><input class="fun-input" type="number" inputmode="numeric" min="0" data-f="now" value="${now}"></label>
      <label class="wp-field"><span>${t('目標の本数', 'Goal')}</span><input class="fun-input" type="number" inputmode="numeric" min="1" data-f="goal" value="${doc.goal}"></label>
      <label class="wp-field pg-wide"><span>${t('何のための貯金？', 'Saving for')}</span><input class="fun-input" data-f="label" maxlength="40" value="${escapeHtml(doc.label)}" placeholder="${t('例: 次の季節パス、あのケープ', 'e.g. the next season pass')}"></label>
      <div class="pg-quick">${[1, 5, 10, 20].map(v => `<button type="button" class="fun-chip" data-act="add" data-v="${v}">+${v}</button>`).join('')}<button type="button" class="fun-chip" data-act="add" data-v="-1">−1</button></div>
    </section>
    ${recent.length > 1 ? `<section class="fun-section"><h2 class="fun-h2">${t('最近のたまり方', 'Recent growth')}</h2>
      <div class="pg-chart">${recent.map(k => `<span title="${k}: ${doc.log[k]}" style="height:${Math.max(3, Math.round(doc.log[k] / max * 100))}%"></span>`).join('')}<i class="pg-goal-line" style="bottom:${Math.round(doc.goal / max * 100)}%"></i></div>
      <p class="fun-hint">${t('このページを開いた日の本数を1日1回記録しています。', 'The count is recorded once a day when you open this page.')}</p></section>` : ''}
  </div>`;
}

function onClick(e) {
  const b = e.target.closest('[data-act=add]');
  if (!b) return;
  setCandles(candles() + Number(b.dataset.v));
  doc.log[localDateStr()] = candles(); writeJson(KEY, doc); render();
}
function onChange(e) {
  const f = e.target.dataset.f;
  if (!f) return;
  if (f === 'now') setCandles(Number(e.target.value) || 0);
  if (f === 'goal') doc.goal = Math.min(99999, Math.max(1, Math.floor(Number(e.target.value) || 1)));
  if (f === 'label') doc.label = e.target.value.slice(0, 40);
  doc.log[localDateStr()] = candles(); writeJson(KEY, doc); render();
}

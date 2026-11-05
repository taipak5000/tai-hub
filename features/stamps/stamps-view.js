/* ================================================================
   🏅 スタンプ帳（#/stamps）。各ツールで集めた・続けたことに応じて、スタンプが1つずつ押されていく。
   判定は stamps-state.js（各ツールの記録を読むだけ。ここで何かを書き換えることはない）。
   まだのスタンプは薄く表示し、あといくつで押されるかを出す。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { notifyChanged } from '../../js/notices.js';
import { injectStylesheet } from '../bingo/bingo-view.js';
import { STAMPS, GROUPS, evaluateStamps, markStampsSeen } from './stamps-state.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
let containerEl = null;

export function mount(container) {
  injectStylesheet();
  containerEl = container;
  const { stats, earned, newly } = evaluateStamps();
  const count = STAMPS.filter(s => earned[s.id]).length;
  markStampsSeen(count);
  notifyChanged();
  container.innerHTML = `<div class="stamps-view fun-view"><div class="fun-wrap">
    <header class="fun-head">
      <h1 class="fun-h1"><svg class="inline-icon" width="22" height="22" aria-hidden="true"><use href="#i-crown"/></svg>${t('スタンプ帳', 'Stamp Book')}</h1>
      <p class="fun-lead">${t('tai-hubの各ツールで集めたもの・続けたことに応じて、スタンプが押されていきます。', 'Earn stamps for what you collect and keep up across tai-hub.')}</p>
    </header>
    <div class="st-total"><b>${count}</b><span>/ ${STAMPS.length}</span><small>${t('こ押されています', 'stamped')}</small>
      <span class="st-bar" aria-hidden="true"><span style="width:${Math.round(count / STAMPS.length * 100)}%"></span></span></div>
    ${GROUPS.map(g => `<section class="fun-section">
      <h2 class="fun-h2">${escapeHtml(t(g.ja, g.en))}</h2>
      <ul class="st-grid">${STAMPS.filter(s => s.group === g.id).map(s => stampHtml(s, stats, earned, newly.includes(s.id))).join('')}</ul>
    </section>`).join('')}
  </div></div>`;
}
export function unmount() { containerEl = null; }

function stampHtml(s, stats, earned, isNew) {
  const raw = stats[s.stat];
  const v = typeof raw === 'boolean' ? (raw ? 1 : 0) : (raw || 0);
  const on = !!earned[s.id];
  const date = on ? earned[s.id].split('-').map(Number) : null;
  const tilt = ((s.id.charCodeAt(0) + s.id.length * 7) % 13) - 6; // スタンプごとに少しだけ傾ける（毎回同じ角度）
  return `<li class="st-item${on ? ' on' : ''}${isNew ? ' is-new' : ''}">
    <span class="st-stamp" style="--tilt:${tilt}deg" aria-hidden="true"><span class="st-mark">${s.mark}</span></span>
    <span class="st-name">${escapeHtml(t(s.ja, s.en))}</span>
    <span class="st-sub">${on ? t(`${date[1]}/${date[2]} に達成`, `Earned ${date[1]}/${date[2]}`) : (s.goal > 1 ? `${Math.min(v, s.goal).toLocaleString()} / ${s.goal.toLocaleString()}` : t('まだ', 'Not yet'))}</span>
  </li>`;
}

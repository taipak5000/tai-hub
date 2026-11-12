/* ================================================================
   📌 よく使うツールのピン留め（2026-11-12）。
   「他のツール」の一覧（と幅の広い画面の左パネル）で、各ツールの右のピンを押すと留められる。
   留めたツール（最大4つ）は、画面の上（#pin-bar-root。index.html の #app-root の直前）にショートカットとして並ぶ。
   ・保存: sky_hub_pinned_tools（端末ごと。ルート名の配列）。何も留めていない時はバーごと出さない。
   ・5つ目を留めようとした時は、外してから留めるよう知らせる（勝手に古いものを外さない）。
   ・ツールの名前・アイコンは一覧と同じ js/site-links.js から引く。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../i18n.js';
import { getSiteLinks, siteLinkName } from '../site-links.js';
import { navigate } from '../router.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
const KEY = 'sky_hub_pinned_tools';
export const MAX_PINS = 4;
const listeners = new Set();

export function getPins() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, MAX_PINS) : [];
  } catch (e) { return []; }
}
function setPins(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_PINS))); } catch (e) { /* noop */ }
  render();
  listeners.forEach(fn => { try { fn(); } catch (e) { /* noop */ } });
}
export function isPinned(id) { return getPins().includes(id); }
export function onPinsChanged(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** ピンの付け外し。戻り値: true＝留めた / false＝外した / null＝いっぱいで留められない */
export function togglePin(id) {
  const pins = getPins();
  if (pins.includes(id)) { setPins(pins.filter(x => x !== id)); return false; }
  if (pins.length >= MAX_PINS) return null;
  setPins([...pins, id]);
  return true;
}

function linkFor(id) {
  const links = getSiteLinks() || [];
  return links.find(s => s.id === id) || null;
}
function currentRoute() { return (location.hash.replace(/^#\/?/, '').split('/')[0]) || ''; }

let rootEl = null;
export function render() {
  if (!rootEl) return;
  const pins = getPins().map(linkFor).filter(Boolean);
  document.documentElement.classList.toggle('has-pins', pins.length > 0);
  if (!pins.length) { rootEl.innerHTML = ''; rootEl.hidden = true; return; }
  rootEl.hidden = false;
  const cur = currentRoute();
  rootEl.innerHTML = `<div class="pin-bar" role="navigation" aria-label="${t('ピン留めしたツール', 'Pinned tools')}">${pins.map(s =>
    `<a class="pin-chip${s.id === cur ? ' is-current' : ''}" href="#/${escapeHtml(s.id)}" data-pin-route="${escapeHtml(s.id)}"${s.id === cur ? ' aria-current="page"' : ''}>
      <svg class="inline-icon" width="15" height="15" aria-hidden="true"><use href="#${escapeHtml(s.icon)}"/></svg><span>${escapeHtml(siteLinkName(s, CURRENT_LANG))}</span></a>`).join('')}</div>`;
}

/** 起動時に1回呼ぶ（js/app.js） */
export function initPinBar() {
  const app = document.getElementById('app-root');
  if (!app || document.getElementById('pin-bar-root')) return;
  rootEl = document.createElement('div');
  rootEl.id = 'pin-bar-root';
  app.before(rootEl);
  rootEl.addEventListener('click', e => {
    const a = e.target.closest('[data-pin-route]');
    if (!a) return;
    e.preventDefault();
    navigate(a.dataset.pinRoute, '');
  });
  window.addEventListener('hashchange', render);
  render();
}

/** 一覧の各行に付けるピンのボタン */
export function pinButtonHtml(id) {
  const on = isPinned(id);
  return `<button type="button" class="pf-pin-btn${on ? ' is-on' : ''}" data-pin="${escapeHtml(id)}" aria-pressed="${on}" aria-label="${on ? t('ピン留めを外す', 'Unpin') : t('ピン留めする', 'Pin')}" title="${on ? t('ピン留めを外す', 'Unpin') : t('画面の上にピン留め', 'Pin to the top')}"><svg class="inline-icon" width="15" height="15" aria-hidden="true"><use href="#i-pushpin"/></svg></button>`;
}

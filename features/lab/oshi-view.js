/* ================================================================
   💖 推し精霊（#/lab-oshi・試作）。推しの季節精霊を登録して、来訪の歴史・最後の来訪からの日数・「推し歴」をまとめる。
   再訪精霊データベースのデータ（features/tai-revisit/data/revisit-data.js）を使い、「待っている」印も共通（js/notices.js）。
   oshiSpirits_v1: { list: [{ nameEn, since: 'YYYY-MM-DD', note, color }] }
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { isWaiting, toggleWaiting } from '../../js/notices.js';
import { injectStylesheet } from '../bingo/bingo-view.js';
import { t, readJson, writeJson, localDateStr, labHeadHtml } from './lab-common.js';

const KEY = 'oshiSpirits_v1';
const COLORS = ['#E8679A', '#F59E0B', '#22A06B', '#3489D6', '#8574DB', '#A8646F'];
let containerEl = null;
let doc = null;
let spirits = null; // nameEn -> spirit
let picking = false;
let query = '';
let token = 0;

function norm(s) { return String(s || '').normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/\s/g, ''); }

export function mount(container) {
  injectStylesheet();
  containerEl = container;
  const d = readJson(KEY, {});
  doc = { list: (Array.isArray(d.list) ? d.list : []).filter(x => x && typeof x.nameEn === 'string').slice(0, 50).map(x => ({
    nameEn: x.nameEn.slice(0, 80), since: /^\d{4}-\d{2}-\d{2}$/.test(x.since || '') ? x.since : localDateStr(),
    note: typeof x.note === 'string' ? x.note.slice(0, 300) : '', color: /^#[0-9a-fA-F]{6}$/.test(x.color || '') ? x.color : COLORS[0],
  })) };
  picking = false; query = '';
  container.innerHTML = '<div class="lab-oshi-view fun-view"><div class="fun-wrap"><div class="rc-loading"><span class="rt-spinner"></span></div></div></div>';
  const my = ++token;
  import('../tai-revisit/data/revisit-data.js').then(m => {
    if (my !== token || !containerEl) return;
    spirits = new Map([...(m.REVISIT_DATA || []), ...(m.NEVER_REVISITED_DATA || []).map(s => ({ ...s, visits: [] }))].map(s => [s.nameEn, s]));
    render();
    root().addEventListener('click', onClick);
    root().addEventListener('input', onInput);
  });
}
export function unmount() { token++; containerEl = null; }
function root() { return containerEl && containerEl.querySelector('.lab-oshi-view'); }
function save() { writeJson(KEY, doc); }
function daysFrom(dateStr) { const [y, m, d] = dateStr.split('-').map(Number); const a = new Date(); a.setHours(0, 0, 0, 0); return Math.round((a - new Date(y, m - 1, d)) / 86400000); }
function fmt(dateStr) { const [y, m, d] = dateStr.split('-').map(Number); return t(`${y}/${m}/${d}`, `${m}/${d}/${y}`); }

function render() {
  const r = root();
  if (!r) return;
  r.innerHTML = `<div class="fun-wrap">
    ${labHeadHtml('oshi', t('推しの季節精霊を登録すると、来訪の歴史や最後に来てからの日数、推しになってからの日数をまとめて見られます。', 'Register your favorite seasonal spirits to see their visit history and how long you’ve loved them.'))}
    ${picking ? pickerHtml() : `<button type="button" class="fun-add" data-act="pick"><svg class="inline-icon" width="16" height="16"><use href="#i-plus"/></svg>${t('推しを登録する', 'Add a favorite')}</button>`}
    <div class="os-list">${doc.list.map(cardHtml).join('')}</div>
    ${!doc.list.length && !picking ? `<div class="fun-empty"><svg class="inline-icon" width="30" height="30"><use href="#i-heart"/></svg><p>${t('いちばん好きな精霊はだれですか？', 'Who is your favorite spirit?')}</p></div>` : ''}
  </div>`;
}

function cardHtml(o, idx) {
  const s = spirits.get(o.nameEn);
  if (!s) return '';
  const visits = (s.visits || []).filter(v => v.type !== 'TS-Error').map(v => v.date).sort();
  const last = visits[visits.length - 1];
  const since = daysFrom(o.since);
  const waiting = isWaiting(o.nameEn);
  return `<article class="os-card" style="--oc:${o.color}">
    <div class="os-top">
      <span class="os-img">${s.imageUrl ? `<img src="${escapeHtml(s.imageUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}<svg class="inline-icon" width="22" height="22"><use href="#i-wing"/></svg></span>
      <div class="os-name"><b>${escapeHtml(CURRENT_LANG === 'en' ? s.nameEn : s.nameJa)}</b><small>${escapeHtml(s.season || '')}</small></div>
      <span class="os-rank">${idx === 0 ? t('いちばんの推し', 'No.1') : t(`推し ${idx + 1}`, `#${idx + 1}`)}</span>
    </div>
    <div class="os-stats">
      <div><b>${since.toLocaleString()}</b><small>${t('推し歴（日）', 'days as fave')}</small></div>
      <div><b>${visits.length}</b><small>${t('来訪の回数', 'visits')}</small></div>
      <div><b>${last ? daysFrom(last).toLocaleString() : '—'}</b><small>${last ? t('最後の来訪から（日）', 'days since visit') : t('まだ来訪なし', 'never returned')}</small></div>
    </div>
    ${visits.length ? `<div class="os-visits">${visits.map(v => `<span>${fmt(v)}</span>`).join('')}</div>` : ''}
    <textarea class="fun-textarea os-note" data-note="${idx}" rows="2" maxlength="300" placeholder="${t('好きなところ・思い出', 'What you love about them')}">${escapeHtml(o.note)}</textarea>
    <div class="os-actions">
      <div class="fun-swatches">${COLORS.map(c => `<button type="button" class="os-color${c === o.color ? ' on' : ''}" style="--sw:${c}" data-act="color" data-i="${idx}" data-c="${c}" aria-label="${c}"></button>`).join('')}</div>
      <span class="fun-spacer"></span>
      <button type="button" class="fun-btn small${waiting ? ' is-on' : ''}" data-act="wait" data-i="${idx}" aria-pressed="${waiting}"><svg class="inline-icon" width="13" height="13"><use href="#i-bell"/></svg>${waiting ? t('来訪を待っています', 'Waiting') : t('来訪を待つ', 'Wait for visit')}</button>
      <button type="button" class="fun-icon-btn" data-act="up" data-i="${idx}"${idx === 0 ? ' disabled' : ''} aria-label="${t('上へ', 'Move up')}"><svg class="inline-icon" width="13" height="13" style="transform:rotate(180deg)"><use href="#i-chevron-down"/></svg></button>
      <button type="button" class="fun-icon-btn" data-act="remove" data-i="${idx}" aria-label="${t('外す', 'Remove')}"><svg class="inline-icon" width="13" height="13"><use href="#i-close"/></svg></button>
    </div>
  </article>`;
}

function pickerHtml() {
  const q = norm(query);
  const have = new Set(doc.list.map(o => o.nameEn));
  const list = [...spirits.values()].filter(s => !have.has(s.nameEn) && (!q || norm(s.nameJa).includes(q) || norm(s.nameEn).includes(q) || norm(s.season).includes(q))).slice(0, 30);
  return `<section class="fun-form">
    <input class="fun-input" type="search" data-q value="${escapeHtml(query)}" placeholder="${t('精霊の名前・季節で探す', 'Search by name or season')}" autocomplete="off">
    <div class="os-pick">${list.map(s => `<button type="button" class="os-pick-item" data-act="add" data-en="${escapeHtml(s.nameEn)}"><span class="os-img is-small">${s.imageUrl ? `<img src="${escapeHtml(s.imageUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span><span><b>${escapeHtml(CURRENT_LANG === 'en' ? s.nameEn : s.nameJa)}</b><small>${escapeHtml(s.season || '')}</small></span></button>`).join('') || `<p class="fun-hint">${t('見つかりません', 'No matches')}</p>`}</div>
    <div class="fun-form-actions"><span class="fun-spacer"></span><button type="button" class="fun-btn" data-act="cancel">${t('やめる', 'Cancel')}</button></div>
  </section>`;
}

function onClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const { act } = b.dataset;
  const i = Number(b.dataset.i);
  if (act === 'pick') { picking = true; render(); root().querySelector('[data-q]')?.focus(); return; }
  if (act === 'cancel') { picking = false; query = ''; render(); return; }
  if (act === 'add') { doc.list.push({ nameEn: b.dataset.en, since: localDateStr(), note: '', color: COLORS[doc.list.length % COLORS.length] }); save(); picking = false; query = ''; render(); return; }
  if (act === 'color') { doc.list[i].color = b.dataset.c; save(); render(); return; }
  if (act === 'wait') { toggleWaiting(doc.list[i].nameEn); render(); return; }
  if (act === 'up') { [doc.list[i - 1], doc.list[i]] = [doc.list[i], doc.list[i - 1]]; save(); render(); return; }
  if (act === 'remove') { doc.list.splice(i, 1); save(); render(); }
}
let timer = null;
function onInput(e) {
  if (e.target.hasAttribute('data-q')) {
    query = e.target.value;
    clearTimeout(timer);
    timer = setTimeout(() => { const box = root().querySelector('.os-pick'); if (!box) return; const tmp = document.createElement('div'); tmp.innerHTML = pickerHtml(); box.replaceWith(tmp.querySelector('.os-pick')); }, 120);
    return;
  }
  const idx = e.target.dataset.note;
  if (idx != null) { doc.list[Number(idx)].note = e.target.value.slice(0, 300); clearTimeout(timer); timer = setTimeout(save, 300); }
}

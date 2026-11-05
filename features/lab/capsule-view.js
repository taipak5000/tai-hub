/* ================================================================
   💌 タイムカプセル（#/lab-capsule・試作）。未来の自分へ手紙を書き、決めた日まで封をしておく。
   開ける日になると封筒が「開けられます」に変わり、押すと読める（読んだ日を残す）。
   timeCapsules_v1: { items: [{ id, created: 'YYYY-MM-DD', openAt: 'YYYY-MM-DD', title, text, openedAt? }] }
   ※ 中身は端末に保存しているだけなので、本気で隠したい内容には向かない（画面の上で読めなくしているだけ）。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { injectStylesheet } from '../bingo/bingo-view.js';
import { toast } from '../shared/share-image.js';
import { t, readJson, writeJson, genId, localDateStr, labHeadHtml } from './lab-common.js';

const KEY = 'timeCapsules_v1';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
let containerEl = null;
let doc = null;
let writing = false;
let reading = null;
let confirmId = null;

function load() {
  const d = readJson(KEY, {});
  return { items: (Array.isArray(d.items) ? d.items : []).filter(x => x && x.id && DATE_RE.test(x.openAt || '')).slice(0, 300).map(x => ({
    id: String(x.id).slice(0, 40), created: DATE_RE.test(x.created || '') ? x.created : localDateStr(), openAt: x.openAt,
    title: typeof x.title === 'string' ? x.title.slice(0, 60) : '', text: typeof x.text === 'string' ? x.text.slice(0, 5000) : '',
    openedAt: DATE_RE.test(x.openedAt || '') ? x.openedAt : '',
  })) };
}

export function mount(container) {
  injectStylesheet();
  containerEl = container;
  doc = load(); writing = false; reading = null; confirmId = null;
  container.innerHTML = '<div class="lab-capsule-view fun-view"></div>';
  render();
  root().addEventListener('click', onClick);
  root().addEventListener('submit', onSubmit);
}
export function unmount() { containerEl = null; }
function root() { return containerEl && containerEl.querySelector('.lab-capsule-view'); }

function daysUntil(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d) - today) / 86400000);
}
function fmt(dateStr) { const [y, m, d] = dateStr.split('-').map(Number); return t(`${y}年${m}月${d}日`, `${m}/${d}/${y}`); }
function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return localDateStr(d); }

function render() {
  const r = root();
  if (!r) return;
  const list = [...doc.items].sort((a, b) => a.openAt.localeCompare(b.openAt));
  const ready = list.filter(x => daysUntil(x.openAt) <= 0 && !x.openedAt);
  const sealed = list.filter(x => daysUntil(x.openAt) > 0);
  const opened = list.filter(x => x.openedAt).sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  r.innerHTML = `<div class="fun-wrap">
    ${labHeadHtml('capsule', t('未来の自分へ手紙を書いて、決めた日まで封をしておけます。その日が来たら開けて読めます。', 'Write a letter to your future self. It stays sealed until the day you choose.'))}
    ${reading ? letterHtml(doc.items.find(x => x.id === reading)) : ''}
    ${writing ? formHtml() : `<button type="button" class="fun-add" data-act="write"><svg class="inline-icon" width="16" height="16"><use href="#i-edit"/></svg>${t('未来の自分へ手紙を書く', 'Write to your future self')}</button>`}
    ${ready.length ? `<section class="fun-section"><h2 class="fun-h2">${t('開けられます', 'Ready to open')}</h2><div class="cp-list">${ready.map(x => envHtml(x, 'ready')).join('')}</div></section>` : ''}
    ${sealed.length ? `<section class="fun-section"><h2 class="fun-h2">${t('封をしている手紙', 'Sealed')}</h2><div class="cp-list">${sealed.map(x => envHtml(x, 'sealed')).join('')}</div></section>` : ''}
    ${opened.length ? `<section class="fun-section"><h2 class="fun-h2">${t('読んだ手紙', 'Opened')}</h2><div class="cp-list">${opened.map(x => envHtml(x, 'opened')).join('')}</div></section>` : ''}
    ${!doc.items.length && !writing ? `<div class="fun-empty"><svg class="inline-icon" width="30" height="30"><use href="#i-gift"/></svg><p>${t('1年後の自分、次の季節の自分へ。今の気持ちを残してみましょう。', 'To yourself a year from now, or next season — leave a note about today.')}</p></div>` : ''}
    <p class="fun-hint">${t('手紙はこの端末に保存されます。画面の上で読めなくしているだけなので、秘密の内容には向きません。', 'Letters are stored on this device; sealing only hides them on screen.')}</p>
  </div>`;
}

function envHtml(x, state) {
  const n = daysUntil(x.openAt);
  return `<button type="button" class="cp-env is-${state}" data-act="${state === 'sealed' ? 'peek' : 'open'}" data-id="${x.id}">
    <span class="cp-flap" aria-hidden="true"></span><span class="cp-seal" aria-hidden="true">${state === 'sealed' ? '🔒' : state === 'ready' ? '💌' : '📖'}</span>
    <span class="cp-title">${escapeHtml(x.title || t('未来の自分へ', 'To my future self'))}</span>
    <span class="cp-when">${state === 'sealed' ? t(`${fmt(x.openAt)}に開けられます（あと${n}日）`, `Opens ${fmt(x.openAt)} (${n} days)`) : state === 'ready' ? t(`${fmt(x.created)}に書いた手紙`, `Written ${fmt(x.created)}`) : t(`${fmt(x.openedAt)}に読みました`, `Opened ${fmt(x.openedAt)}`)}</span>
  </button>`;
}
function letterHtml(x) {
  if (!x) return '';
  return `<article class="cp-letter">
    <div class="cp-letter-head"><b>${escapeHtml(x.title || t('未来の自分へ', 'To my future self'))}</b><small>${t(`${fmt(x.created)}の自分より`, `From me on ${fmt(x.created)}`)}</small></div>
    <p class="cp-letter-text">${escapeHtml(x.text).replace(/\n/g, '<br>')}</p>
    <div class="fun-form-actions">
      <button type="button" class="fun-btn danger${confirmId === x.id ? ' is-confirm' : ''}" data-act="del" data-id="${x.id}">${confirmId === x.id ? t('もう一度押すと削除', 'Tap again to delete') : t('削除', 'Delete')}</button>
      <span class="fun-spacer"></span><button type="button" class="fun-btn" data-act="close">${t('閉じる', 'Close')}</button>
    </div>
  </article>`;
}
function formHtml() {
  const presets = [[30, t('1か月後', '1 month')], [100, t('100日後', '100 days')], [182, t('半年後', '6 months')], [365, t('1年後', '1 year')]];
  return `<form class="fun-form" data-form="capsule">
    <label class="fun-field"><span class="fun-label">${t('題名', 'Title')}</span><input class="fun-input" name="title" maxlength="60" placeholder="${t('例: 1年後のわたしへ', 'e.g. To me, one year later')}"></label>
    <label class="fun-field"><span class="fun-label">${t('手紙', 'Letter')}</span><textarea class="fun-textarea" name="text" rows="7" maxlength="5000" required placeholder="${t('今がんばっていること、楽しみにしていること、フレンドのこと…', 'What you’re working on, what you’re looking forward to…')}"></textarea></label>
    <div class="fun-field"><span class="fun-label">${t('開ける日', 'Open on')}</span>
      <div class="fun-chips">${presets.map(([n, l]) => `<button type="button" class="fun-chip" data-act="preset" data-n="${n}">${l}</button>`).join('')}</div>
      <input class="fun-input" type="date" name="openAt" required min="${addDays(1)}" value="${addDays(365)}">
    </div>
    <div class="fun-form-actions"><span class="fun-spacer"></span>
      <button type="button" class="fun-btn" data-act="cancel">${t('やめる', 'Cancel')}</button>
      <button type="submit" class="fun-btn primary">${t('封をする', 'Seal it')}</button>
    </div>
  </form>`;
}

function onClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const { act, id } = b.dataset;
  if (act === 'write') { writing = true; reading = null; render(); root().querySelector('textarea')?.focus(); return; }
  if (act === 'cancel') { writing = false; render(); return; }
  if (act === 'preset') { const input = root().querySelector('input[name=openAt]'); if (input) input.value = addDays(Number(b.dataset.n)); return; }
  if (act === 'peek') { const x = doc.items.find(i => i.id === id); toast(t(`まだ開けられません（あと${daysUntil(x.openAt)}日）`, `Not yet — ${daysUntil(x.openAt)} days to go`)); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); return; }
  if (act === 'open') {
    const x = doc.items.find(i => i.id === id);
    if (x && !x.openedAt) { x.openedAt = localDateStr(); writeJson(KEY, doc); }
    reading = id; writing = false; confirmId = null; render(); root().querySelector('.cp-letter')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); return;
  }
  if (act === 'close') { reading = null; render(); return; }
  if (act === 'del') {
    if (confirmId !== id) { confirmId = id; render(); return; }
    doc.items = doc.items.filter(i => i.id !== id); writeJson(KEY, doc); reading = null; confirmId = null; render();
  }
}
function onSubmit(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const openAt = String(fd.get('openAt') || '');
  if (!DATE_RE.test(openAt) || openAt <= localDateStr()) { toast(t('開ける日は明日以降にしてください', 'Pick a date after today')); return; }
  doc.items.push({ id: genId(), created: localDateStr(), openAt, title: String(fd.get('title') || '').trim().slice(0, 60), text: String(fd.get('text') || '').slice(0, 5000), openedAt: '' });
  writeJson(KEY, doc); writing = false; render();
  toast(t('封をしました。その日まで、おたのしみに', 'Sealed. See you then!'));
}

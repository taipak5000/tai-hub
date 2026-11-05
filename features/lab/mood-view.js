/* ================================================================
   🎨 気分カレンダー（#/lab-mood・試作）。1日1色で気分を塗り、1年分を色のマス（Year in Pixels）で見返す。
   moodLog_v1: { days: { 'YYYY-MM-DD'（端末の日付）: { m: 0〜4, note } } }
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { injectStylesheet } from '../bingo/bingo-view.js';
import { t, readJson, writeJson, localDateStr, labHeadHtml } from './lab-common.js';

const KEY = 'moodLog_v1';
export const MOODS = [
  { ja: 'さいこう', en: 'Amazing', color: '#F6B93B', face: '😆' },
  { ja: 'いい感じ', en: 'Good', color: '#7BC67B', face: '😊' },
  { ja: 'ふつう', en: 'Okay', color: '#7FB3E6', face: '🙂' },
  { ja: 'つかれた', en: 'Tired', color: '#B39DDB', face: '😪' },
  { ja: 'しょんぼり', en: 'Down', color: '#90A4AE', face: '😢' },
];

let containerEl = null;
let doc = null;
let year = 0;
let selected = '';

function load() {
  const d = readJson(KEY, {});
  const days = {};
  if (d && d.days && typeof d.days === 'object') {
    Object.keys(d.days).forEach(k => {
      const v = d.days[k];
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && v && Number.isInteger(v.m) && v.m >= 0 && v.m < MOODS.length) days[k] = { m: v.m, note: typeof v.note === 'string' ? v.note.slice(0, 200) : '' };
    });
  }
  return { days };
}

export function mount(container) {
  injectStylesheet();
  containerEl = container;
  doc = load();
  year = new Date().getFullYear();
  selected = localDateStr();
  container.innerHTML = '<div class="lab-mood-view fun-view"></div>';
  render();
  const r = root();
  r.addEventListener('click', onClick);
  r.addEventListener('input', onInput);
}
export function unmount() { containerEl = null; }
function root() { return containerEl && containerEl.querySelector('.lab-mood-view'); }

function render() {
  const r = root();
  if (!r) return;
  const cur = doc.days[selected];
  const [, sm, sd] = selected.split('-').map(Number);
  const yearDays = Object.keys(doc.days).filter(k => k.startsWith(String(year)));
  const counts = MOODS.map((_, i) => yearDays.filter(k => doc.days[k].m === i).length);
  const total = yearDays.length;
  r.innerHTML = `<div class="fun-wrap">
    ${labHeadHtml('mood', t('その日の気分を1色えらんで塗っていきます。1年たつと、色のマスがあなたの1年の模様になります。', 'Pick one color for each day. Over a year, the squares become a picture of your year.'))}
    <section class="md-today">
      <div class="md-date">${t(`${sm}月${sd}日の気分`, `Mood on ${sm}/${sd}`)}${selected !== localDateStr() ? `<button type="button" class="fun-btn small" data-act="today">${t('今日にもどる', 'Back to today')}</button>` : ''}</div>
      <div class="md-moods" role="radiogroup" aria-label="${t('気分', 'Mood')}">
        ${MOODS.map((m, i) => `<button type="button" class="md-mood${cur && cur.m === i ? ' on' : ''}" data-act="mood" data-i="${i}" role="radio" aria-checked="${!!(cur && cur.m === i)}" style="--mc:${m.color}"><span class="md-face">${m.face}</span><span>${escapeHtml(t(m.ja, m.en))}</span></button>`).join('')}
      </div>
      ${cur ? `<input class="fun-input md-note" data-note maxlength="200" value="${escapeHtml(cur.note)}" placeholder="${t('ひとこと（なくてもOK）', 'A few words (optional)')}">` : ''}
    </section>
    <section class="fun-section">
      <div class="md-year-head">
        <button type="button" class="fun-icon-btn" data-act="py" aria-label="${t('前の年', 'Previous year')}"><svg class="inline-icon" width="14" height="14"><use href="#i-chevron-left"/></svg></button>
        <b>${t(`${year}年`, String(year))}</b>
        <button type="button" class="fun-icon-btn" data-act="ny" aria-label="${t('次の年', 'Next year')}"${year >= new Date().getFullYear() ? ' disabled' : ''}><svg class="inline-icon" width="14" height="14"><use href="#i-chevron-right"/></svg></button>
      </div>
      ${pixelsHtml()}
      ${total ? `<div class="md-stats">${MOODS.map((m, i) => `<span><i style="background:${m.color}"></i>${escapeHtml(t(m.ja, m.en))} ${counts[i]}</span>`).join('')}</div>
      <div class="md-bar">${MOODS.map((m, i) => counts[i] ? `<span style="background:${m.color};flex:${counts[i]}"></span>` : '').join('')}</div>` : `<p class="fun-hint">${t('マスを押すと、その日の気分を塗れます。', 'Tap a square to color that day.')}</p>`}
    </section>
  </div>`;
}

function pixelsHtml() {
  const today = localDateStr();
  const months = t('1,2,3,4,5,6,7,8,9,10,11,12', 'J,F,M,A,M,J,J,A,S,O,N,D').split(',');
  let html = `<div class="md-grid"><span></span>${months.map(m => `<span class="md-mh">${m}</span>`).join('')}`;
  for (let d = 1; d <= 31; d++) {
    html += `<span class="md-dh">${d % 5 === 0 || d === 1 ? d : ''}</span>`;
    for (let m = 0; m < 12; m++) {
      const last = new Date(year, m + 1, 0).getDate();
      if (d > last) { html += '<span class="md-px is-none"></span>'; continue; }
      const key = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const v = doc.days[key];
      const future = key > today;
      html += `<button type="button" class="md-px${key === selected ? ' sel' : ''}${future ? ' is-future' : ''}" data-act="pick" data-date="${key}"${future ? ' disabled' : ''} style="${v ? `background:${MOODS[v.m].color}` : ''}" aria-label="${m + 1}/${d}${v ? ' ' + t(MOODS[v.m].ja, MOODS[v.m].en) : ''}"></button>`;
    }
  }
  return html + '</div>';
}

function onClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const act = b.dataset.act;
  if (act === 'mood') {
    const i = Number(b.dataset.i);
    const cur = doc.days[selected];
    if (cur && cur.m === i) delete doc.days[selected]; else doc.days[selected] = { m: i, note: cur ? cur.note : '' };
    writeJson(KEY, doc); render(); return;
  }
  if (act === 'pick') { selected = b.dataset.date; render(); root().querySelector('.md-today')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
  if (act === 'today') { selected = localDateStr(); year = new Date().getFullYear(); render(); return; }
  if (act === 'py' || act === 'ny') { year += act === 'py' ? -1 : 1; render(); }
}
let timer = null;
function onInput(e) {
  if (!e.target.hasAttribute('data-note')) return;
  const cur = doc.days[selected];
  if (!cur) return;
  cur.note = e.target.value.slice(0, 200);
  clearTimeout(timer); timer = setTimeout(() => writeJson(KEY, doc), 300);
}

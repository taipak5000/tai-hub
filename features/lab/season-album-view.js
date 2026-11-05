/* ================================================================
   📚 シーズンアルバム（#/lab-season-album・試作）。季節ごとに、その期間に集めたもの・残した思い出を1冊のアルバムにまとめる。
   数えるもの（どれも記録の日付で季節の期間に振り分ける。記録がない季節は出さない）:
     アイテム（itemAcquireLog_v1）・エモート（emoteAcquireLog_v1）・羽（wingTracker_v1 の日時）・
     フォト日記（friendsDoc_v1）・コーデ日記（coordDiary_v1）・気分カレンダー（moodLog_v1）
   季節の期間は features/shared/season-dates.js。季節と季節のあいだの日の記録は、どのアルバムにも入れない。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { injectStylesheet } from '../bingo/bingo-view.js';
import { getPhoto } from '../friends/friends-state.js';
import { SEASON_DATES } from '../shared/season-dates.js';
import { t, readJson, localDateStr, labHeadHtml } from './lab-common.js';
import { MOODS } from './mood-view.js';

let containerEl = null;
let openKey = null;
const urls = new Map();

export function mount(container) {
  injectStylesheet();
  containerEl = container;
  openKey = null;
  container.innerHTML = '<div class="lab-season-album-view fun-view"></div>';
  render();
  root().addEventListener('click', onClick);
}
export function unmount() { urls.forEach(u => URL.revokeObjectURL(u)); urls.clear(); containerEl = null; }
function root() { return containerEl && containerEl.querySelector('.lab-season-album-view'); }

function dayStr(iso) { const d = new Date(iso); return isNaN(d) ? '' : localDateStr(d); }

function collect() {
  const itemLog = Object.values(readJson('itemAcquireLog_v1', {}) || {}).map(e => e && dayStr(e.at)).filter(Boolean);
  const emoteLog = Object.values(readJson('emoteAcquireLog_v1', {}) || {}).map(e => e && dayStr(e.at)).filter(Boolean);
  const wings = [];
  Object.values(readJson('wingTracker_v1', {}) || {}).forEach(s => Object.values(s || {}).forEach(v => { if (v && v.at) wings.push(dayStr(v.at)); }));
  const fr = readJson('friendsDoc_v1', {}) || {};
  const diary = (Array.isArray(fr.diary) ? fr.diary : []).filter(d => d && d.date);
  const coord = ((readJson('coordDiary_v1', {}) || {}).entries || []).filter(d => d && d.date);
  const moods = (readJson('moodLog_v1', {}) || {}).days || {};
  const today = localDateStr();
  return [...SEASON_DATES].reverse().filter(s => s.start <= today).map(s => {
    const inS = d => d >= s.start && d <= s.end;
    const photos = [...diary, ...coord].filter(d => inS(d.date) && d.photoId).sort((a, b) => a.date.localeCompare(b.date));
    const moodKeys = Object.keys(moods).filter(inS);
    const moodCounts = MOODS.map((_, i) => moodKeys.filter(k => moods[k] && moods[k].m === i).length);
    return {
      key: s.start, s,
      items: itemLog.filter(inS).length, emotes: emoteLog.filter(inS).length, wings: wings.filter(inS).length,
      diary: diary.filter(d => inS(d.date)), coords: coord.filter(d => inS(d.date)), photos, moodCounts, moodTotal: moodKeys.length,
      ongoing: today <= s.end,
    };
  }).filter(x => x.items || x.emotes || x.wings || x.diary.length || x.coords.length || x.moodTotal);
}

function fmt(d) { const [y, m, dd] = d.split('-').map(Number); return t(`${y}/${m}/${dd}`, `${m}/${dd}/${y}`); }

function render() {
  const r = root();
  if (!r) return;
  const list = collect();
  r.innerHTML = `<div class="fun-wrap">
    ${labHeadHtml('season-album', t('季節ごとに、その期間に集めたものと残した思い出をまとめました。表紙を押すと中身が開きます。', 'Your finds and memories, grouped by season. Tap a cover to open it.'))}
    ${list.length ? `<div class="sa-list">${list.map(albumHtml).join('')}</div>`
      : `<div class="fun-empty"><svg class="inline-icon" width="30" height="30"><use href="#i-image"/></svg><p>${t('アイテムの所持やフォト日記・コーデ日記を記録すると、季節ごとのアルバムができていきます。', 'Log items, photos and outfits to start building your season albums.')}</p></div>`}
  </div>`;
  loadPhotos();
}

function albumHtml(a) {
  const name = CURRENT_LANG === 'en' ? a.s.en : a.s.ja;
  const open = openKey === a.key;
  const cover = a.photos[0];
  const stats = [
    a.items && t(`アイテム ${a.items}`, `${a.items} items`), a.emotes && t(`エモート ${a.emotes}`, `${a.emotes} emotes`),
    a.wings && t(`羽 ${a.wings}`, `${a.wings} wings`), a.diary.length && t(`思い出 ${a.diary.length}`, `${a.diary.length} memories`),
    a.coords.length && t(`コーデ ${a.coords.length}`, `${a.coords.length} outfits`),
  ].filter(Boolean);
  return `<article class="sa-album${open ? ' is-open' : ''}">
    <button type="button" class="sa-cover" data-act="toggle" data-key="${a.key}" aria-expanded="${open}">
      <span class="sa-cover-photo"${cover ? ` data-photo="${escapeHtml(cover.photoId)}"` : ''}></span>
      <span class="sa-cover-text">
        <b>${escapeHtml(name)}</b>
        <small>${fmt(a.s.start)}〜${fmt(a.s.end)}${a.ongoing ? t('（開催中）', ' (now)') : ''}</small>
        <span class="sa-stats">${stats.map(x => `<span>${escapeHtml(x)}</span>`).join('')}</span>
      </span>
    </button>
    ${open ? `<div class="sa-inner">
      ${a.moodTotal ? `<div class="sa-mood"><small>${t('この季節の気分', 'Mood this season')}</small><div class="md-bar">${MOODS.map((m, i) => a.moodCounts[i] ? `<span style="background:${m.color};flex:${a.moodCounts[i]}"></span>` : '').join('')}</div></div>` : ''}
      ${a.photos.length ? `<div class="sa-photos">${a.photos.map(p => `<span class="sa-photo" data-photo="${escapeHtml(p.photoId)}"><small>${fmt(p.date)}</small></span>`).join('')}</div>` : ''}
      ${a.diary.filter(d => d.text).slice(0, 12).map(d => `<p class="sa-memo"><span>${fmt(d.date)}</span>${escapeHtml(d.text.slice(0, 140))}</p>`).join('')}
    </div>` : ''}
  </article>`;
}

async function loadPhotos() {
  const slots = root() ? root().querySelectorAll('[data-photo]') : [];
  for (const slot of slots) {
    const id = slot.dataset.photo;
    let url = urls.get(id);
    if (!url) { try { const b = await getPhoto(id); if (!b) continue; url = URL.createObjectURL(b); urls.set(id, url); } catch (e) { continue; } }
    if (slot.isConnected && !slot.querySelector('img')) slot.insertAdjacentHTML('afterbegin', `<img src="${url}" alt="" loading="lazy">`);
  }
}

function onClick(e) {
  const b = e.target.closest('[data-act=toggle]');
  if (!b) return;
  openKey = openKey === b.dataset.key ? null : b.dataset.key;
  render();
}

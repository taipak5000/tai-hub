/* ================================================================
   📚 シーズンアルバム（コーデ日記の「シーズンアルバム」タブ。features/coord-diary/coord-diary-view.js が表示する）。
   季節ごとに、その期間に手に入れたもの・残した思い出を1冊のアルバムにまとめる（2026-11-06に試作からコーデ日記へ移した）。
   数えるもの（記録の日付で季節の期間に振り分ける。記録がない季節は出さない）:
     アイテム（itemAcquireLog_v1）・エモート（emoteAcquireLog_v1）・羽（wingTracker_v1 の日時）・
     フォト日記（friendsDoc_v1）・コーデ日記（coordDiary_v1）
   季節の期間は features/shared/season-dates.js。季節と季節のあいだの日の記録は、季節のアルバムには入れない。
   「日々」のイベント（features/shared/event-dates.js）のアルバムも、季節と同じ数え方で並べる（2026-11-06〜）。
   イベントは季節の最中にあるので、同じ記録が季節のアルバムと日々のアルバムの両方に入ることがある。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { nsKey } from '../../js/state.js';
import { SEASON_DATES } from '../shared/season-dates.js';
import { EVENT_DATES } from '../shared/event-dates.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
function readJson(key, fb) { try { const v = JSON.parse(localStorage.getItem(nsKey(key))); return v == null ? fb : v; } catch (e) { return fb; } }
function localDateStr(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

function dayStr(iso) { const d = new Date(iso); return isNaN(d) ? '' : localDateStr(d); }

export function collectAlbums() {
  const itemLog = Object.values(readJson('itemAcquireLog_v1', {}) || {}).map(e => e && dayStr(e.at)).filter(Boolean);
  const emoteLog = Object.values(readJson('emoteAcquireLog_v1', {}) || {}).map(e => e && dayStr(e.at)).filter(Boolean);
  const wings = [];
  Object.values(readJson('wingTracker_v1', {}) || {}).forEach(s => Object.values(s || {}).forEach(v => { if (v && v.at) wings.push(dayStr(v.at)); }));
  const fr = readJson('friendsDoc_v1', {}) || {};
  const diary = (Array.isArray(fr.diary) ? fr.diary : []).filter(d => d && d.date);
  const coord = ((readJson('coordDiary_v1', {}) || {}).entries || []).filter(d => d && d.date);
  const today = localDateStr();
  const periods = [
    ...SEASON_DATES.map(s => ({ ...s, kind: 'season' })),
    ...EVENT_DATES.map(s => ({ ...s, kind: 'event' })),
  ].sort((a, b) => b.start.localeCompare(a.start) || (a.kind === 'season' ? -1 : 1));
  return periods.filter(s => s.start <= today).map(s => {
    const inS = d => d >= s.start && d <= s.end;
    const photos = [...diary, ...coord].filter(d => inS(d.date) && d.photoId).sort((a, b) => a.date.localeCompare(b.date));
    return {
      key: `${s.kind}:${s.start}`, s,
      items: itemLog.filter(inS).length, emotes: emoteLog.filter(inS).length, wings: wings.filter(inS).length,
      diary: diary.filter(d => inS(d.date)), coords: coord.filter(d => inS(d.date)), photos,
      ongoing: today <= s.end,
    };
  }).filter(x => x.items || x.emotes || x.wings || x.diary.length || x.coords.length);
}

function fmt(d) { const [y, m, dd] = d.split('-').map(Number); return t(`${y}/${m}/${dd}`, `${m}/${dd}/${y}`); }


/** アルバムの一覧。openKey は開いている季節（開始日）。写真の枠は data-photo を持つ（呼び出し側が読み込む） */
export function albumsHtml(openKey) {
  const list = collectAlbums();
  if (!list.length) return `<div class="fun-empty"><svg class="inline-icon" width="30" height="30"><use href="#i-image"/></svg><p>${t('アイテムの所持やフォト日記・コーデ日記を記録すると、季節ごとのアルバムができていきます。', 'Log items, photos and outfits to start building your season albums.')}</p></div>`;
  return `<p class="fun-hint sa-lead">${t('季節と「日々」のイベントごとに、その期間に集めたものと残した思い出をまとめました。表紙を押すと中身が開きます。', 'Your finds and memories, grouped by season and event. Tap a cover to open it.')}</p>
    <div class="sa-list">${list.map(a => albumHtml(a, openKey)).join('')}</div>`;
}

function albumHtml(a, openKey) {
  const name = CURRENT_LANG === 'en' ? a.s.en : a.s.ja;
  const open = openKey === a.key;
  const cover = a.photos[0];
  const stats = [
    a.items && t(`アイテム ${a.items}`, `${a.items} items`), a.emotes && t(`エモート ${a.emotes}`, `${a.emotes} emotes`),
    a.wings && t(`羽 ${a.wings}`, `${a.wings} wings`), a.diary.length && t(`思い出 ${a.diary.length}`, `${a.diary.length} memories`),
    a.coords.length && t(`コーデ ${a.coords.length}`, `${a.coords.length} outfits`),
  ].filter(Boolean);
  return `<article class="sa-album${open ? ' is-open' : ''}">
    <button type="button" class="sa-cover" data-act="album-toggle" data-key="${a.key}" aria-expanded="${open}">
      <span class="sa-cover-photo"${cover ? ` data-photo="${escapeHtml(cover.photoId)}"` : ''}></span>
      <span class="sa-cover-text">
        <b><span class="sa-kind is-${a.s.kind}">${a.s.kind === 'event' ? t('日々', 'Event') : t('季節', 'Season')}</span>${escapeHtml(name)}</b>
        <small>${fmt(a.s.start)}〜${fmt(a.s.end)}${a.ongoing ? t('（開催中）', ' (now)') : ''}</small>
        <span class="sa-stats">${stats.map(x => `<span>${escapeHtml(x)}</span>`).join('')}</span>
      </span>
    </button>
    ${open ? `<div class="sa-inner">
      ${a.photos.length ? `<div class="sa-photos">${a.photos.map(p => `<span class="sa-photo" data-photo="${escapeHtml(p.photoId)}"><small>${fmt(p.date)}</small></span>`).join('')}</div>` : ''}
      ${a.diary.filter(d => d.text).slice(0, 12).map(d => `<p class="sa-memo"><span>${fmt(d.date)}</span>${escapeHtml(d.text.slice(0, 140))}</p>`).join('')}
    </div>` : ''}
  </article>`;
}


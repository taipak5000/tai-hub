/* ================================================================
   📖 今日ページの「おみくじ帳」と「1年前の今日」（どちらも読むだけ。元のデータは書き換えない）
   - おみくじ帳: omikujiLog_v1（loadOmikuji()）を月ごとにまとめて、新しい月から並べる。
     日付の行を押すと、その日のひとことが開く（<details> なので状態は持たない）。記録が無い月は出さない。
   - 1年前の今日: 端末の日付（'YYYY-MM-DD'）の年だけ1つ戻した文字列と、各記録の date を単純に比べる
     （タイムゾーンの変換はしない。2月29日は1年前に同じ日が無いので何も出ない）。
       ・コーデ日記 coordDiary_v1 の entries: 写真と着ていたアイテム
       ・フレンドのフォト日記 friendsDoc_v1 の diary: 写真・ひとこと・写っているフレンド
     写真は IndexedDB（tai-hub-photos）から getPhoto で読む。該当が無ければ欄ごと出さない。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { nsKey } from '../../js/state.js';
import { CATEGORY_REGISTRY } from '../item/data/categories.js';
import { loadFriendsDoc, getPhoto, todayStr } from '../friends/friends-state.js';
import { loadOmikuji, FORTUNES, LUCKY_REALMS, LUCKY_COLORS, MESSAGES } from './today-state.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
const L = o => (CURRENT_LANG === 'en' ? o.en : o.ja);
const WD_JA = ['日', '月', '火', '水', '木', '金', '土'];
const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/* ── おみくじ帳 ── */
export function omikujiBookHtml(todayKey) {
  const days = loadOmikuji().days;
  // ゲームの日付（ゼロ埋めなし 'Y-M-D'）を数字で並べ替える
  const list = Object.keys(days).map((k) => {
    const [y, m, d] = k.split('-').map(Number);
    return { k, y, m, d, r: days[k] };
  }).sort((a, b) => (b.y - a.y) || (b.m - a.m) || (b.d - a.d));
  if (!list.length) return '';
  const months = [];
  list.forEach((x) => {
    const last = months[months.length - 1];
    if (last && last.y === x.y && last.m === x.m) last.rows.push(x);
    else months.push({ y: x.y, m: x.m, rows: [x] });
  });
  const rowHtml = (x) => {
    const wd = new Date(x.y, x.m - 1, x.d).getDay();
    const color = LUCKY_COLORS[x.r.color];
    const dateLabel = t(`${x.m}/${x.d}（${WD_JA[wd]}）`, `${x.m}/${x.d} ${WD_EN[wd]}`);
    return `<details class="td-ob-row f${x.r.f}${x.k === todayKey ? ' is-today' : ''}">
      <summary>
        <span class="td-ob-date">${escapeHtml(dateLabel)}</span>
        <span class="td-ob-fortune">${escapeHtml(L(FORTUNES[x.r.f]))}</span>
        <span class="td-ob-realm">${escapeHtml(L(LUCKY_REALMS[x.r.realm]))}</span>
        <span class="td-ob-color"><span class="td-omi-swatch" style="background:${color.hex}"></span><span class="td-ob-color-name">${escapeHtml(L(color))}</span></span>
      </summary>
      <p class="td-ob-msg">${escapeHtml(L(MESSAGES[x.r.msg]))}</p>
    </details>`;
  };
  return `<details class="td-omibook">
    <summary class="td-omibook-sum">
      <svg class="inline-icon" width="16" height="16" aria-hidden="true"><use href="#i-calendar"/></svg>
      <span class="td-omibook-title">${t('おみくじ帳', 'Fortune log')}</span>
      <span class="td-omibook-count">${escapeHtml(t(`${list.length}日分`, `${list.length} days`))}</span>
      <svg class="inline-icon td-omibook-chev" width="14" height="14" aria-hidden="true"><use href="#i-chevron-down"/></svg>
    </summary>
    <div class="td-omibook-body">${months.map(mo => `
      <section class="td-ob-month">
        <h3 class="td-ob-month-title">${escapeHtml(t(`${mo.y}年${mo.m}月`, `${mo.m}/${mo.y}`))}<span>${escapeHtml(t(`${mo.rows.length}日`, `${mo.rows.length} days`))}</span></h3>
        ${mo.rows.map(rowHtml).join('')}
      </section>`).join('')}
    </div>
  </details>`;
}

/* ── 1年前の今日 ── */
export function oneYearAgoDate(now = new Date()) {
  const s = todayStr(now);
  return `${Number(s.slice(0, 4)) - 1}${s.slice(4)}`;
}
function readCoordEntries(date) {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(nsKey('coordDiary_v1'))); } catch (e) { d = null; }
  const cats = new Set(CATEGORY_REGISTRY.map(c => c.key));
  return (d && Array.isArray(d.entries) ? d.entries : []).filter(e => e && e.date === date && DATE_RE.test(e.date)).map(e => ({
    photoId: typeof e.photoId === 'string' ? e.photoId.slice(0, 60) : '',
    items: (Array.isArray(e.items) ? e.items : []).filter(x => x && cats.has(x.cat) && typeof x.id === 'string').slice(0, 30),
    memo: typeof e.memo === 'string' ? e.memo.slice(0, 300) : '',
  })).filter(e => e.photoId || e.items.length || e.memo);
}
function readDiaryEntries(date) {
  const doc = loadFriendsDoc();
  const byId = new Map(doc.friends.map(f => [f.id, f]));
  return doc.diary.filter(x => x.date === date).map(x => ({
    photoId: x.photoId, text: x.text, names: x.friendIds.map(id => byId.get(id)).filter(Boolean).map(f => f.name),
  })).filter(x => x.photoId || x.text || x.names.length);
}
async function itemNames(entries) {
  const need = new Set();
  entries.forEach(e => e.items.forEach(x => need.add(x.cat)));
  const map = new Map();
  await Promise.all([...need].map(cat => import(`../item/data/items/${cat}.js`).then((m) => {
    (m.ITEMS || []).forEach(it => map.set(`${cat}:${it.id}`, { name: CURRENT_LANG === 'en' ? (it.nameEn || it.name) : it.name, img: it.img || '' }));
  }).catch(() => {})));
  return map;
}

/** 欄のHTMLを作る（無ければ ''）。写真は data-photo の枠だけ入れ、fillPhotos() で後から読む */
export async function oneYearAgoHtml(now = new Date()) {
  const date = oneYearAgoDate(now);
  const coords = readCoordEntries(date);
  const diary = readDiaryEntries(date);
  if (!coords.length && !diary.length) return '';
  const names = coords.length ? await itemNames(coords) : new Map();
  const [y, m, d] = date.split('-').map(Number);
  const photo = id => (id ? `<div class="td-ago-photo" data-photo="${escapeHtml(id)}"><svg class="inline-icon" width="20" height="20" aria-hidden="true"><use href="#i-image"/></svg></div>` : '');
  const coordHtml = coords.map(e => `<article class="td-ago-card">
      ${photo(e.photoId)}
      <div class="td-ago-body">
        <div class="td-ago-kind"><svg class="inline-icon" width="13" height="13" aria-hidden="true"><use href="#i-hanger"/></svg>${t('コーデ日記', 'Outfit Diary')}</div>
        ${e.items.length ? `<div class="td-ago-items">${e.items.map((x) => {
          const it = names.get(`${x.cat}:${x.id}`);
          return `<span class="td-ago-item">${it && it.img ? `<img src="${escapeHtml(it.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}${escapeHtml(it ? it.name : x.id)}</span>`;
        }).join('')}</div>` : ''}
        ${e.memo ? `<p class="td-ago-text">${escapeHtml(e.memo).replace(/\n/g, '<br>')}</p>` : ''}
      </div>
    </article>`).join('');
  const diaryHtml = diary.map(e => `<article class="td-ago-card">
      ${photo(e.photoId)}
      <div class="td-ago-body">
        <div class="td-ago-kind"><svg class="inline-icon" width="13" height="13" aria-hidden="true"><use href="#i-heart"/></svg>${t('フォト日記', 'Photo diary')}${e.names.length ? `<span class="td-ago-with">${escapeHtml(t(`${e.names.join('・')}さんと`, `with ${e.names.join(', ')}`))}</span>` : ''}</div>
        ${e.text ? `<p class="td-ago-text">${escapeHtml(e.text).replace(/\n/g, '<br>')}</p>` : ''}
      </div>
    </article>`).join('');
  return `<section class="fun-section td-ago">
    <h2 class="fun-h2">${t('1年前の今日', 'One year ago today')}<span class="td-ago-date">${escapeHtml(t(`${y}年${m}月${d}日`, `${m}/${d}/${y}`))}</span></h2>
    <div class="td-ago-list">${coordHtml}${diaryHtml}</div>
  </section>`;
}

/** data-photo の枠に写真を入れる。作ったURLを返す（呼び出し側で片付ける） */
export async function fillPhotos(rootEl) {
  const urls = [];
  await Promise.all([...rootEl.querySelectorAll('[data-photo]')].map(async (el) => {
    try {
      const blob = await getPhoto(el.dataset.photo);
      if (!(blob instanceof Blob)) { el.remove(); return; } // 写真が消されていれば枠ごと外す
      const url = URL.createObjectURL(blob);
      urls.push(url);
      el.innerHTML = `<img src="${url}" alt="">`;
    } catch (e) { el.remove(); }
  }));
  return urls;
}

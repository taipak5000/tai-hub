/* ================================================================
   🏆 一年のふりかえり（#/recap）。tai-hub の各ツールに残っている記録から、その年に
   集めたもの・続けたことを1枚のカードにまとめ、画像で保存・共有できるようにする。

   数える元（どれもこの端末・選択中のプロフィールの記録。記録が無いものはカードに出さない）:
     アイテム   itemAcquireLog_v1（所持にした日時）・gameItems_<cat>（今の所持数）
     エモート   emoteAcquireLog_v1（所持にした日時）・emoteCompletionHistory_v1（所持率の推移）
     羽         wingTracker_v1（受け取った日時）・wingsCompletionHistory_v1
     精霊ツリー spiritCatalogStats_v1（解放したマスの数）
     キャンドル skyNomacanCalc_history_v1（記録した本数）・skyNomacanStreak_v1（記録した日）
     デイリーチェックシート dailyCheckLog_v1 ／ 週替わりビンゴ weeklyBingo_v1 ／ フレンド friendsDoc_v1
   記録した日時が残っていない古いデータ（日時を記録する前に所持にした分）は、その年の数に入らない。
   その旨はカードの下に小さく書いておく。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { nsKey, getActiveProfile, pfDisplayName, isCountableItem } from '../../js/state.js';
import { CATEGORY_REGISTRY } from '../item/data/categories.js';
import { injectStylesheet } from '../bingo/bingo-view.js';
import { bingoYearSummary } from '../bingo/bingo-state.js';
import { loadFriendsDoc } from '../friends/friends-state.js';
import { saveElementImage, toast } from '../shared/share-image.js';
import { HUB_BASE_URL } from '../../js/site-config.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
const THEME_KEY = 'sky_recap_style';
const STYLES = {
  dusk: { ja: '夕焼け', en: 'Dusk' },
  night: { ja: '星空', en: 'Starry night' },
  dawn: { ja: '朝焼け', en: 'Dawn' },
  forest: { ja: '雨林', en: 'Forest' },
};

let containerEl = null;
let year = 0;
let month = null; // null＝一年のふりかえり ／ 0〜11＝その月のふりかえり
let style = 'dusk';
let stats = null;
let token = 0;

function readJson(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(nsKey(key))); return v == null ? fallback : v; } catch (e) { return fallback; }
}
function inYear(iso, y) {
  if (!iso) return false;
  const d = new Date(iso);
  return !isNaN(d) && d.getFullYear() === y && (month === null || d.getMonth() === month);
}
// 'YYYY-MM-DD' や 'YYYY-M-D' の日付キーが、選んでいる期間に入るか
function keyIn(k, y) {
  const [ky, km] = String(k).split('-').map(Number);
  return ky === y && (month === null || km - 1 === month);
}
function bucketOf(dateObj) { return month === null ? dateObj.getMonth() : dateObj.getDate() - 1; }

export function mount(container, sub) {
  injectStylesheet();
  containerEl = container;
  const now = new Date();
  if (sub === 'month') {
    // 月の初めの1週間は先月の分、それ以降は今月の分を出す（お知らせの「先月のふりかえり」から開いた時も同じ）
    const base = now.getDate() <= 7 ? new Date(now.getFullYear(), now.getMonth() - 1, 1) : now;
    year = base.getFullYear(); month = base.getMonth();
  } else {
    year = now.getMonth() === 0 && now.getDate() <= 7 ? now.getFullYear() - 1 : now.getFullYear();
    month = null;
  }
  try { style = STYLES[localStorage.getItem(THEME_KEY)] ? localStorage.getItem(THEME_KEY) : 'dusk'; } catch (e) { style = 'dusk'; }
  container.innerHTML = '<div class="recap-view fun-view"></div>';
  root().addEventListener('click', onClick);
  stats = null;
  render();
  compute();
}

export function unmount() { token++; containerEl = null; }

function root() { return containerEl && containerEl.querySelector('.recap-view'); }

async function compute() {
  const my = ++token;
  const y = year;
  const cats = CATEGORY_REGISTRY.filter(c => c.section !== 'special');
  const mods = await Promise.all(cats.map(c => import(`../item/data/items/${c.key}.js`).catch(() => ({ ITEMS: [] }))));
  if (my !== token || !containerEl) return;

  const months = Array(month === null ? 12 : new Date(y, month + 1, 0).getDate()).fill(0); // 年＝月ごと／月＝日ごと
  // アイテム
  let ownedNow = 0, totalNow = 0;
  const catCount = {};
  cats.forEach((c, i) => {
    const items = (mods[i].ITEMS || []).filter(isCountableItem);
    const owned = (readJson('gameItems_' + c.key, {}).itemOwned) || {};
    totalNow += items.length;
    ownedNow += items.filter(it => owned[it.id]).length;
  });
  const itemLog = readJson('itemAcquireLog_v1', {});
  let itemsYear = 0;
  Object.values(itemLog).forEach(e => {
    if (e && inYear(e.at, y)) {
      itemsYear++;
      months[bucketOf(new Date(e.at))]++;
      catCount[e.catKey] = (catCount[e.catKey] || 0) + 1;
    }
  });
  const topCatKey = Object.keys(catCount).sort((a, b) => catCount[b] - catCount[a])[0];
  const topCat = topCatKey ? CATEGORY_REGISTRY.find(c => c.key === topCatKey) : null;

  // エモート
  const emoteLog = readJson('emoteAcquireLog_v1', {});
  let emotesYear = 0;
  Object.values(emoteLog).forEach(e => { if (e && inYear(e.at, y)) { emotesYear++; months[bucketOf(new Date(e.at))]++; } });
  const emHist = readJson('emoteCompletionHistory_v1', []);
  const emLast = Array.isArray(emHist) && emHist.length ? emHist[emHist.length - 1] : null;

  // 羽
  const wingTracker = readJson('wingTracker_v1', {});
  let wingsYear = 0;
  Object.values(wingTracker || {}).forEach(season => Object.values(season || {}).forEach(v => { if (v && typeof v === 'object' && inYear(v.at, y)) wingsYear++; }));
  const wgHist = readJson('wingsCompletionHistory_v1', []);
  const wgLast = Array.isArray(wgHist) && wgHist.length ? wgHist[wgHist.length - 1] : null;

  // 精霊ツリー
  const tree = readJson('spiritCatalogStats_v1', null);

  // キャンドル
  const hist = readJson('skyNomacanCalc_history_v1', []);
  let candles = 0;
  (Array.isArray(hist) ? hist : []).forEach(e => { if (e && e.amount > 0 && inYear(e.time, y)) candles += e.amount; });
  const streak = readJson('skyNomacanStreak_v1', { days: {} });
  const candleDays = Object.keys(streak.days || {}).filter(k => keyIn(k, y)).length;
  const longest = longestRun(Object.keys(streak.days || {}).filter(k => keyIn(k, y)));

  // デイリーチェックシート（キーは 'YYYY-M-D'）
  const dc = readJson('dailyCheckLog_v1', { days: {} });
  const dcDays = Object.keys((dc && dc.days) || {}).filter(k => keyIn(k, y)).length;

  // ビンゴ・フレンド
  const bingo = bingoYearSummary(y, month);
  const fdoc = loadFriendsDoc();
  const newFriends = fdoc.friends.filter(f => f.since && keyIn(f.since, y)).length;
  const diaryYear = fdoc.diary.filter(d => keyIn(d.date, y));
  const photosYear = diaryYear.filter(d => d.photoId).length;

  // コーデ日記・おみくじ・スタンプ
  const coord = readJson('coordDiary_v1', {});
  const coordCount = (Array.isArray(coord.entries) ? coord.entries : []).filter(e => e && keyIn(e.date, y)).length;
  const omi = Object.entries((readJson('omikujiLog_v1', {}) || {}).days || {}).filter(([k]) => keyIn(k, y)).map(([, r]) => r);
  const stampsEarned = Object.values(readJson('stampsEarned_v1', {}) || {}).filter(d => keyIn(d, y)).length;

  const topMonth = months.some(v => v > 0) ? months.indexOf(Math.max(...months)) : -1;
  stats = {
    y, months, topMonth, itemsYear, ownedNow, totalNow, topCat, topCatCount: topCatKey ? catCount[topCatKey] : 0,
    emotesYear, emPct: emLast ? emLast.pct : null, wingsYear, wgPct: wgLast ? wgLast.pct : null,
    tree, candles, candleDays, longest, dcDays, bingo, newFriends, diaryCount: diaryYear.length, photosYear,
    coordCount, omikuji: omi.length, daikichi: omi.filter(r => r && r.f === 0).length, stampsEarned, month,
  };
  render();
}

// 'YYYY-MM-DD' の配列から、いちばん長く続いた日数
function longestRun(keys) {
  const days = keys.map(k => { const [a, b, c] = k.split('-').map(Number); return Date.UTC(a, b - 1, c) / 86400000; }).sort((a, b) => a - b);
  let best = 0, run = 0, prev = null;
  days.forEach(d => { run = prev !== null && d - prev === 1 ? run + 1 : 1; best = Math.max(best, run); prev = d; });
  return best;
}

function render() {
  const r = root();
  if (!r) return;
  const nowY = new Date().getFullYear();
  r.innerHTML = `
    <div class="fun-wrap">
      <header class="fun-head">
        <h1 class="fun-h1"><svg class="inline-icon" width="22" height="22" aria-hidden="true"><use href="#i-trophy"/></svg>${t('ふりかえり', 'Recap')}</h1>
        <p class="fun-lead">${t('tai-hubに残っている記録から、その年・その月に集めたものと続けたことをまとめました。画像にして保存・共有できます。', 'A look back at what you collected and kept up, by year or by month. Save it as an image to share.')}</p>
      </header>
      <div class="fun-tabs" role="tablist">
        <button type="button" class="fun-tab${month === null ? ' on' : ''}" role="tab" aria-selected="${month === null}" data-act="period" data-p="year">${t('一年', 'Year')}</button>
        <button type="button" class="fun-tab${month !== null ? ' on' : ''}" role="tab" aria-selected="${month !== null}" data-act="period" data-p="month">${t('月ごと', 'Month')}</button>
      </div>
      <div class="fun-actions">
        ${month === null ? `<div class="fun-chips" role="group" aria-label="${t('年', 'Year')}">
          ${[nowY - 1, nowY].map(v => `<button type="button" class="fun-chip${v === year ? ' on' : ''}" data-act="year" data-year="${v}">${t(`${v}年`, String(v))}</button>`).join('')}
        </div>` : `<div class="rc-month-pick">
          <button type="button" class="fun-icon-btn" data-act="mprev" aria-label="${t('前の月', 'Previous month')}"><svg class="inline-icon" width="15" height="15"><use href="#i-chevron-left"/></svg></button>
          <b>${t(`${year}年${month + 1}月`, `${month + 1}/${year}`)}</b>
          <button type="button" class="fun-icon-btn" data-act="mnext" aria-label="${t('次の月', 'Next month')}"${year === nowY && month >= new Date().getMonth() ? ' disabled' : ''}><svg class="inline-icon" width="15" height="15"><use href="#i-chevron-right"/></svg></button>
        </div>`}
        <div class="fun-chips" role="group" aria-label="${t('カードの色', 'Card style')}">
          ${Object.keys(STYLES).map(k => `<button type="button" class="fun-chip rc-style-chip rc-${k}${k === style ? ' on' : ''}" data-act="style" data-style="${k}"><span></span>${t(STYLES[k].ja, STYLES[k].en)}</button>`).join('')}
        </div>
      </div>
      ${stats ? cardHtml(stats) : `<div class="rc-loading"><span class="rt-spinner"></span>${t('記録を集めています…', 'Gathering your records…')}</div>`}
      ${stats ? `<div class="fun-actions"><button type="button" class="fun-btn primary" data-act="image"><svg class="inline-icon" width="15" height="15"><use href="#i-image"/></svg>${t('画像で保存', 'Save image')}</button></div>
        <p class="fun-hint">${t('数えているのは、この端末で選んでいるプロフィールの記録です。日時を残すようになる前に所持にしたアイテムやエモートは、その期間の数には入りません。', 'Counts come from the selected profile on this device. Items marked owned before dates were recorded aren’t counted for the year.')}</p>` : ''}
    </div>`;
}

function tile(icon, num, label, sub) {
  return `<div class="rc-tile"><svg class="inline-icon" width="18" height="18" aria-hidden="true"><use href="#${icon}"/></svg><div class="rc-num">${num}</div><div class="rc-label">${escapeHtml(label)}</div>${sub ? `<div class="rc-sub">${escapeHtml(sub)}</div>` : ''}</div>`;
}
const fmt = n => Number(n || 0).toLocaleString();

function cardHtml(s) {
  const tiles = [];
  if (s.itemsYear || s.ownedNow) tiles.push(tile('i-folder', fmt(s.itemsYear), t('集めたアイテム', 'Items collected'), s.totalNow ? t(`いまの所持 ${fmt(s.ownedNow)} / ${fmt(s.totalNow)}`, `Owned ${fmt(s.ownedNow)} / ${fmt(s.totalNow)}`) : ''));
  if (s.emotesYear || s.emPct != null) tiles.push(tile('i-masks', fmt(s.emotesYear), t('覚えたエモート', 'Emotes learned'), s.emPct != null ? t(`所持率 ${s.emPct}%`, `${s.emPct}% complete`) : ''));
  if (s.wingsYear || s.wgPct != null) tiles.push(tile('i-wing', fmt(s.wingsYear), t('受け取った羽', 'Wings received'), s.wgPct != null ? t(`所持率 ${s.wgPct}%`, `${s.wgPct}% complete`) : ''));
  if (s.tree && s.tree.totalNodes) tiles.push(tile('i-tree', fmt(s.tree.doneNodes), t('解放したツリーのマス', 'Tree nodes unlocked'), t(`全${fmt(s.tree.totalNodes)}マス中`, `of ${fmt(s.tree.totalNodes)}`)));
  if (s.candles) tiles.push(tile('i-candle', fmt(s.candles), t('記録したキャンドル', 'Candles logged'), s.candleDays ? t(`${s.candleDays}日記録・最長${s.longest}日連続`, `${s.candleDays} days · best ${s.longest} in a row`) : ''));
  if (s.dcDays) tiles.push(tile('i-check', fmt(s.dcDays), t('チェックシートの日', 'Checklist days'), ''));
  if (s.bingo.weeks) tiles.push(tile('i-grid', fmt(s.bingo.lines), t('ビンゴ', 'Bingos'), t(`${s.bingo.weeks}週・${fmt(s.bingo.filled)}マス`, `${s.bingo.weeks} weeks · ${fmt(s.bingo.filled)} squares`)));
  if (s.coordCount) tiles.push(tile('i-hanger', fmt(s.coordCount), t('コーデ日記', 'Outfit logs'), ''));
  if (s.omikuji) tiles.push(tile('i-sparkle', fmt(s.omikuji), t('おみくじ', 'Fortunes drawn'), s.daikichi ? t(`大吉 ${s.daikichi}回`, `${s.daikichi} great blessings`) : ''));
  if (s.stampsEarned) tiles.push(tile('i-crown', fmt(s.stampsEarned), t('押されたスタンプ', 'Stamps earned'), ''));
  if (s.newFriends || s.diaryCount) tiles.push(tile('i-heart', fmt(s.newFriends), t('新しいフレンド', 'New friends'), s.diaryCount ? t(`思い出 ${s.diaryCount}件・写真 ${s.photosYear}枚`, `${s.diaryCount} memories · ${s.photosYear} photos`) : ''));

  const max = Math.max(1, ...s.months);
  const anyMonth = s.months.some(v => v > 0);
  const highlights = [];
  if (s.topMonth >= 0) highlights.push(s.month === null
    ? t(`いちばん集めた月は${s.topMonth + 1}月（${s.months[s.topMonth]}個）`, `Busiest month: ${new Date(2000, s.topMonth, 1).toLocaleString('en', { month: 'long' })} (${s.months[s.topMonth]})`)
    : t(`いちばん集めた日は${s.month + 1}月${s.topMonth + 1}日（${s.months[s.topMonth]}個）`, `Busiest day: ${s.month + 1}/${s.topMonth + 1} (${s.months[s.topMonth]})`));
  if (s.topCat && s.topCatCount) highlights.push(t(`よく集めたのは「${s.topCat.name}」（${s.topCatCount}個）`, `Most collected: ${s.topCat.nameEn} (${s.topCatCount})`));
  if (s.longest >= 3) highlights.push(t(`キャンドル集めを${s.longest}日続けました`, `${s.longest}-day candle streak`));

  const profile = pfDisplayName(getActiveProfile());
  return `<div class="rc-card rc-${style}" id="rcCapture">
    <div class="rc-sparkles" aria-hidden="true">${'<i></i>'.repeat(14)}</div>
    <div class="rc-top">
      <div class="rc-year${s.month !== null ? ' is-month' : ''}">${s.month === null ? s.y : t(`${s.month + 1}月`, new Date(2000, s.month, 1).toLocaleString('en', { month: 'short' }))}</div>
      ${s.month !== null ? `<div class="rc-sub-year">${s.y}</div>` : ''}
      <div class="rc-title">${t('わたしのSky', 'My Sky')}</div>
      <div class="rc-who">${escapeHtml(profile)}</div>
    </div>
    ${tiles.length ? `<div class="rc-tiles">${tiles.join('')}</div>` : `<p class="rc-none">${t('この年の記録はまだありません。アイテムやキャンドルを記録すると、ここに集まっていきます', 'No records for this year yet. Log items or candles and they’ll gather here.')}</p>`}
    ${anyMonth ? `<div class="rc-months${s.month !== null ? ' is-days' : ''}" aria-label="${s.month === null ? t('月ごとに集めた数', 'Collected per month') : t('日ごとに集めた数', 'Collected per day')}">${s.months.map((v, i) => `<div class="rc-month${i === s.topMonth ? ' top' : ''}"><span style="height:${Math.max(4, Math.round(v / max * 100))}%"></span><small>${s.month === null || (i + 1) % 5 === 0 || i === 0 ? i + 1 : ''}</small></div>`).join('')}</div>` : ''}
    ${highlights.length ? `<ul class="rc-highlights">${highlights.map(h => `<li>${escapeHtml(h)}</li>`).join('')}</ul>` : ''}
    <div class="rc-foot">tai-hub ・ ${escapeHtml(HUB_BASE_URL.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</div>
  </div>`;
}

function onClick(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  if (act === 'year') { year = Number(btn.dataset.year); stats = null; render(); compute(); return; }
  if (act === 'period') {
    const now = new Date();
    if (btn.dataset.p === 'month') { const b = now.getDate() <= 7 ? new Date(now.getFullYear(), now.getMonth() - 1, 1) : now; year = b.getFullYear(); month = b.getMonth(); }
    else { month = null; year = now.getMonth() === 0 && now.getDate() <= 7 ? now.getFullYear() - 1 : now.getFullYear(); }
    stats = null; render(); compute(); return;
  }
  if (act === 'mprev' || act === 'mnext') {
    if (btn.disabled) return;
    const d = new Date(year, month + (act === 'mprev' ? -1 : 1), 1);
    year = d.getFullYear(); month = d.getMonth(); stats = null; render(); compute(); return;
  }
  if (act === 'style') {
    style = btn.dataset.style;
    try { localStorage.setItem(THEME_KEY, style); } catch (err) { /* noop */ }
    render();
    return;
  }
  if (act === 'image') saveImage();
}

async function saveImage() {
  const card = root().querySelector('#rcCapture');
  if (!card || !stats) return;
  toast(t('画像を作っています…', 'Creating the image…'), 6000);
  try {
    const res = await saveElementImage(card, {
      filename: stats.month === null ? `sky-${stats.y}-recap` : `sky-${stats.y}-${String(stats.month + 1).padStart(2, '0')}-recap`,
      text: stats.month === null ? t(`わたしの${stats.y}年のSky\n${HUB_BASE_URL}`, `My ${stats.y} in Sky\n${HUB_BASE_URL}`) : t(`わたしの${stats.y}年${stats.month + 1}月のSky\n${HUB_BASE_URL}`, `My Sky this month\n${HUB_BASE_URL}`),
      bg: '#1c1b22',
    });
    toast(res === 'saved' ? t('画像を保存しました', 'Image saved') : null);
  } catch (err) {
    toast(t('画像を作れませんでした。通信状態を確かめてください', 'Could not create the image.'));
  }
}

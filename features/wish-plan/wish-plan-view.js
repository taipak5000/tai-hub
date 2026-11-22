/* ================================================================
   🎯 ほしいもの計画（#/wish-plan）。アイテム所持管理の「欲しいもの」に入れたアイテムに順番を付け、
   上から順に「今のキャンドルであと何本か」「1日◯本集めると、いつ手に入るか」を並べる。
   期限（季節の終わり・好きな日）までに全部そろえるには1日何本必要かも逆算する。

   - 欲しいもの: wish_<catKey>（アイテム所持管理と共通。ここで外すと向こうからも外れる）
   - 価格: features/item/data/cost-data.js（楽譜は music-sheets-data.js の price）
   - 所持キャンドル・ハート: wishOwnCurrency（ノマキャン計算機・アイテム所持管理と共通）
   - このツールだけのデータ（プロフィールごと）:
       wishPlanOrder_v1: ['catKey:id', …]（上ほど先に欲しい。載っていないものは最後に元の順で並ぶ）
       wishPlanSettings_v1: { deadline: 'season'|'date', date: 'YYYY-MM-DD', perDay: 1日に集める本数 }
       wishPlanGroups_v1: { groups: [{ id, name, items: ['catKey:id', …] }], offBy: { all|groupId: ['catKey:id', …] }, view: 'all'|groupId }
         グループは作る時にチェックでアイテムを選ぶ（1つのアイテムを複数のグループに入れられる）。
         「計算に入れない」印は表示（すべて・各グループ）ごとに別々に持つ。計算は表示中の一覧のうち、印の付いていないものだけ。
   キャンドル以外（課金・チケット・価格不明）のアイテムは、順番には並べるが本数の計算からは外す。

   - 精霊のツリーから選んだ分（wishPlanTrees_v1。tree-pick.js）は、精霊ごとに1行（key は 'tree:<guid>'）。
     通り道の祝福・ハートなども合わせたキャンドルとハートの両方を数える。欲しいものの中に同じツリーのアイテムがあれば、
     そのアイテムの行は「ツリーの行に入っている」として二重に数えない。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { nsKey, getWishIds, removeWishItem, getCategoryState, saveCategoryState, recordItemAcquire } from '../../js/state.js';
import { loadMusicSheetState, saveMusicSheetState } from '../item/data/music-sheet-state.js';
import { navigate } from '../../js/router.js';
import { writeWishHandoff } from '../shared/wish-handoff.js';
import { CATEGORY_REGISTRY } from '../item/data/categories.js';
import { CURRENT_SEASON } from '../item/data/season-data.js';
import { injectStylesheet } from '../bingo/bingo-view.js';
import { toast } from '../shared/share-image.js';
import { loadS, loadTreePlans, saveTreePlans, buildTreeRows, itemTreeIndex, planNodes, costText, pickerHtml, spiritResultsHtml } from './tree-pick.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
const ORDER_KEY = 'wishPlanOrder_v1';
const SETTINGS_KEY = 'wishPlanSettings_v1';
const GROUPS_KEY = 'wishPlanGroups_v1';
let grp = null; // { groups, assign, off:Set, view }
let groupEdit = null; // null | { mode: 'new'|'rename' }
let groupDelConfirm = false;
function loadGroups() {
  const g = readJson(GROUPS_KEY, {});
  const groups = (Array.isArray(g.groups) ? g.groups : []).filter(x => x && typeof x.id === 'string' && typeof x.name === 'string')
    .map(x => ({ id: x.id.slice(0, 20), name: x.name.slice(0, 30), items: Array.isArray(x.items) ? x.items.filter(k => typeof k === 'string') : [] }));
  // 以前の形（1アイテム1グループの assign）から移す
  if (g.assign && typeof g.assign === 'object') {
    Object.entries(g.assign).forEach(([k, id]) => { const gr = groups.find(x => x.id === id); if (gr && !gr.items.includes(k)) gr.items.push(k); });
  }
  const ids = new Set(groups.map(x => x.id));
  const offBy = {};
  if (g.offBy && typeof g.offBy === 'object') Object.entries(g.offBy).forEach(([v, list]) => { if ((v === 'all' || ids.has(v)) && Array.isArray(list)) offBy[v] = new Set(list.filter(k => typeof k === 'string')); });
  if (Array.isArray(g.off) && !offBy.all) offBy.all = new Set(g.off.filter(k => typeof k === 'string')); // 以前の形
  grp = { groups, offBy, view: ids.has(g.view) ? g.view : 'all' };
}
function saveGroups() {
  const offBy = {};
  Object.entries(grp.offBy).forEach(([v, set]) => { if (set.size) offBy[v] = [...set]; });
  writeJson(GROUPS_KEY, { groups: grp.groups, offBy, view: grp.view });
}
// 表示中（すべて・グループ）の「計算に入れない」印
function offSet() { if (!grp.offBy[grp.view]) grp.offBy[grp.view] = new Set(); return grp.offBy[grp.view]; }
// 表示中のグループの行（「すべて」なら全部）
function visibleRows() {
  if (grp.view === 'all') return rows;
  const g = grp.groups.find(x => x.id === grp.view);
  const set = new Set(g ? g.items : []);
  return rows.filter(r => set.has(r.key));
}const DAY = 86400000;

let containerEl = null;
let costData = null;
let music = null;
const images = {};
let rows = [];
let settings = null;
let token = 0;
let confirmId = null;
let getConfirmId = null; // 「手に入れた」を一度押して確認待ちの行
let S = null; // 精霊ツリー管理の状態モジュール（読み込めたら入る。tree-pick.js の loadS）
let pick = null; // 「精霊のツリーから選ぶ」を開いている間だけ { step, q, guid, targets:Set }

function readJson(key, fb) { try { const v = JSON.parse(localStorage.getItem(nsKey(key))); return v == null ? fb : v; } catch (e) { return fb; } }
function writeJson(key, v) { try { localStorage.setItem(nsKey(key), JSON.stringify(v)); } catch (e) { /* noop */ } }

export function mount(container) {
  injectStylesheet();
  containerEl = container;
  confirmId = null; groupEdit = null; groupDelConfirm = false; pick = null;
  loadGroups();
  const s = readJson(SETTINGS_KEY, {});
  settings = {
    deadline: s.deadline === 'date' ? 'date' : 'season',
    date: /^\d{4}-\d{2}-\d{2}$/.test(s.date || '') ? s.date : '',
    perDay: Number.isFinite(s.perDay) && s.perDay > 0 ? Math.min(999, s.perDay) : 15,
  };
  container.innerHTML = `<div class="wish-plan-view fun-view"><div class="fun-wrap"><div class="rc-loading"><span class="rt-spinner"></span></div></div></div>`;
  const my = ++token;
  // ほかのツールで解放・所持が変わっているかもしれないので、ツリーの解放状況は開くたびに読み直す
  const useS = mod => { S = mod; S.invalidateUnlockedMapCache(); S.invalidateExternalOwnCache(); };
  if (S) useS(S);
  // ツリーの計画がある時は、行の順番が崩れないようツリーのデータを待ってから描く。無い時は後から読む（通り道の案内に使う）
  const hasPlans = Object.keys(loadTreePlans()).length > 0;
  Promise.all([import('../item/data/cost-data.js'), import('../item/data/music-sheets-data.js'), hasPlans && !S ? loadS().catch(() => null) : null]).then(([c, m, st]) => {
    if (my !== token || !containerEl) return;
    costData = c.ITEM_COST_DATA; music = m.MUSIC_SHEETS;
    if (st) useS(st);
    buildRows(); render();
    root().addEventListener('click', onClick);
    root().addEventListener('change', onChange);
    root().addEventListener('input', onInput);
    loadImages(my);
    if (!S) loadS().then(mod => { if (my !== token || !containerEl) return; useS(mod); buildRows(); if (!pick) render(); }).catch(() => { /* ツリーが読めなくても表は使える */ });
  });
}
export function unmount() { token++; containerEl = null; }
function root() { return containerEl && containerEl.querySelector('.wish-plan-view'); }

function buildRows() {
  const list = [];
  CATEGORY_REGISTRY.forEach(cat => {
    const { owned } = getCategoryState(cat.key);
    getWishIds(cat.key).forEach(id => {
      if (owned[id]) return;
      if (cat.key === 'music_sheet') {
        const m = music.find(x => x.id === id);
        if (m) list.push({ key: `${cat.key}:${id}`, cat, id, name: m.name, img: m.img, cost: typeof m.price === 'number' ? { type: 'candle', value: m.price } : { type: 'unknown' }, source: m.season });
        return;
      }
      const e = (costData[cat.key] || []).find(x => x.id === id);
      if (e) list.push({ key: `${cat.key}:${id}`, cat, id, name: CURRENT_LANG === 'en' ? (e.nameEn || e.name) : e.name, cost: e.cost || { type: 'unknown' }, source: e.source || '' });
    });
  });
  if (S) list.push(...buildTreeRows(S));
  const order = readJson(ORDER_KEY, []);
  const pos = new Map((Array.isArray(order) ? order : []).map((k, i) => [k, i]));
  rows = list.map((r, i) => ({ r, i })).sort((a, b) => {
    const pa = pos.has(a.r.key) ? pos.get(a.r.key) : 1e6 + a.i;
    const pb = pos.has(b.r.key) ? pos.get(b.r.key) : 1e6 + b.i;
    return pa - pb;
  }).map(x => x.r);
}
function saveOrder() { writeJson(ORDER_KEY, rows.map(r => r.key)); }

async function loadImages(my) {
  const cats = [...new Set(rows.filter(r => r.cat.key !== 'music_sheet' && !r.tree).map(r => r.cat.key))];
  for (const key of cats) {
    try {
      const mod = await import(`../item/data/items/${key}.js`);
      images[key] = Object.fromEntries((mod.ITEMS || []).map(it => [it.id, it.img]));
    } catch (e) { /* 画像が無くても表は出す */ }
  }
  if (my !== token || !containerEl) return;
  root().querySelectorAll('[data-img-key]').forEach(el => {
    const [cat, id] = el.dataset.imgKey.split(':');
    const src = images[cat] && images[cat][id];
    if (src && !el.querySelector('img')) el.innerHTML = `<img src="${escapeHtml(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`;
  });
}

// 行のアイコン: 楽譜は行に画像を持ち、ほかは読み込み済みのアイテムデータ（images）から引く。
// 並び替えなどで描き直した時にもアイコンが消えないよう、描くたびにここを通す
function thumbSrc(row) { return row.img || (images[row.cat.key] && images[row.cat.key][row.id]) || ''; }
// 「手に入れた」の確認の文言（キャンドル・ハートで交換するものは、減る数を出す）
function getConfirmLabel(row) {
  const c = row.cost, cur = currency();
  if (c.type === 'candle' && c.value) return cur.candle >= c.value ? t(`キャンドル−${c.value}で入手`, `Spend ${c.value} candles`) : t(`キャンドルが足りません（${cur.candle}→0）`, `Not enough candles (${cur.candle}→0)`);
  if (c.type === 'heart' && c.value) return cur.heart >= c.value ? t(`ハート−${c.value}で入手`, `Spend ${c.value} hearts`) : t(`ハートが足りません（${cur.heart}→0）`, `Not enough hearts (${cur.heart}→0)`);
  return t('もう一度押すと所持にします', 'Tap again to mark owned');
}
// 手に入れた: キャンドル・ハートの価格ぶん所持数を減らし、アイテム所持管理で所持にする（欲しいものからは外れる）
async function acquireRow(row) {
  const c = row.cost;
  let spent = '';
  if ((c.type === 'candle' || c.type === 'heart') && c.value) {
    const field = c.type === 'candle' ? 'candle' : 'heart';
    const before = currency()[field];
    setCurrency(field, Math.max(0, before - Number(c.value)));
    spent = c.type === 'candle' ? t(`キャンドル−${Math.min(before, c.value)}`, `−${Math.min(before, c.value)} candles`) : t(`ハート−${Math.min(before, c.value)}`, `−${Math.min(before, c.value)} hearts`);
  }
  if (row.cat.key === 'music_sheet') {
    const st = loadMusicSheetState();
    st.owned[row.id] = true;
    saveMusicSheetState(st.owned, st.fav, music);
  } else {
    const mod = await import(`../item/data/items/${row.cat.key}.js`);
    const st = getCategoryState(row.cat.key);
    st.owned[row.id] = true;
    saveCategoryState(row.cat.key, st.owned, st.fav, mod.ITEMS || []);
  }
  recordItemAcquire(row.cat.key, row.id); // 獲得ログに残し、欲しいものから外す
  return spent;
}
function currency() {
  const c = readJson('wishOwnCurrency', {});
  return { candle: Math.max(0, Number(c.candle) || 0), heart: Math.max(0, Number(c.heart) || 0) };
}
function setCurrency(field, value) {
  const c = readJson('wishOwnCurrency', {});
  c[field] = Math.max(0, Math.floor(Number(value) || 0));
  writeJson('wishOwnCurrency', c);
}

function deadlineDate() {
  if (settings.deadline === 'date' && settings.date) {
    const [y, m, d] = settings.date.split('-').map(Number);
    return new Date(y, m - 1, d, 23, 59, 59);
  }
  return CURRENT_SEASON && CURRENT_SEASON.endDate ? new Date(CURRENT_SEASON.endDate) : null;
}
function fmtDate(d) { return t(`${d.getMonth() + 1}月${d.getDate()}日`, `${d.getMonth() + 1}/${d.getDate()}`); }
function costLabel(c) {
  if (c.type === 'tree') return '';
  if (c.type === 'candle') return t(`キャンドル ${c.value}`, `${c.value} candles`);
  if (c.type === 'heart') return t(`ハート ${c.value}`, `${c.value} hearts`);
  if (c.type === 'money') return c.value ? t(`課金 ${Number(c.value).toLocaleString()}円`, `Paid ¥${Number(c.value).toLocaleString()}`) : t('課金', 'Paid');
  if (c.type === 'ticket') return t('チケット', 'Tickets');
  if (c.type === 'reward') return t('報酬', 'Reward');
  if (c.type === 'free') return t('無料', 'Free');
  if (c.type === 'seasonCandle') return t(`季節キャンドル ${c.value}`, `${c.value} season candles`);
  if (c.type === 'point') return t(`ロイヤリティクラブ ${c.value}ポイント`, `${c.value} Loyalty Club points`);
  if (c.type === 'na') return t('交換なし', 'Not purchasable');
  return t('価格不明', 'Unknown price');
}

let firstNeed = null; // 先頭の「キャンドルが足りない」行 { key, name, needCandle, current }（render()が毎回作り直す）
function render() {
  const r = root();
  if (!r) return;
  const cur = currency();
  const dl = deadlineDate();
  const daysLeft = dl ? Math.max(0, Math.ceil((dl - Date.now()) / DAY)) : null;
  let cumC = 0, cumH = 0;
  const perDay = settings.perDay;
  const now = new Date();
  const vis = visibleRows();
  const counted = vis.filter(r => !offSet().has(r.key));
  // ツリーの行（計算に入れているもの）がこれから解放するアイテム。同じアイテムの行は二重に数えない
  const covered = new Map();
  counted.forEach(row => { if (row.tree) row.plan.nodes.forEach(x => { if (x.node.itemCatKey && x.node.itemCostId) covered.set(`${x.node.itemCatKey}:${x.node.itemCostId}`, row); }); });
  const treeIdx = S ? itemTreeIndex(S) : null;
  // 先頭の「キャンドルが足りない」行だけに、ノマキャン計算機プロで到達日を見るボタンを出す
  firstNeed = null;
  const lines = vis.map((row, idx) => {
    let status = '', cls = '';
    const off = offSet().has(row.key);
    const cover = !row.tree && covered.get(row.key);
    const cc = row.tree ? row.cost.c : row.cost.type === 'candle' ? Number(row.cost.value) || 0 : 0;
    const hh = row.tree ? row.cost.h : row.cost.type === 'heart' ? Number(row.cost.value) || 0 : 0;
    if (off) { status = t('計算に入れていません', 'Not included in the plan'); cls = 'off'; }
    else if (cover) { status = t(`「${cover.name}」の行でまとめて数えています`, `Counted in “${cover.name}”`); cls = 'other'; }
    else if (row.tree || row.cost.type === 'candle' || row.cost.type === 'heart') {
      cumC += cc; cumH += hh;
      const needCandle = cc ? Math.max(0, cumC - cur.candle) : 0;
      const needHeart = hh ? Math.max(0, cumH - cur.heart) : 0;
      if (!needCandle && !needHeart) { status = row.tree && !cc && !hh ? t('本数の計算には入りません', 'Not counted in candles') : t('今のぶんで手に入ります', 'Affordable now'); cls = row.tree && !cc && !hh ? 'other' : 'ok'; }
      else {
        const parts = [];
        cls = 'soon';
        if (needCandle) {
          if (!firstNeed) firstNeed = { key: row.key, name: row.name, needCandle, current: cur.candle };
          const days = Math.ceil(needCandle / perDay);
          const when = new Date(now.getTime() + days * DAY);
          parts.push(t(`あと${needCandle}本・${fmtDate(when)}ごろ（${days}日後）`, `${needCandle} more · around ${fmtDate(when)} (${days}d)`));
          if (dl && when > dl) cls = 'late';
        }
        if (needHeart) parts.push(t(`あとハート${needHeart}`, `${needHeart} more hearts`));
        status = parts.join(t('／', ' / '));
      }
    } else { status = t('本数の計算には入りません', 'Not counted in candles'); cls = 'other'; }
    // アイテムの行: ツリーの通り道にまだ解放していないノードがあれば、ツリーで計算する入口を出す
    let pathHint = '';
    if (!row.tree && !cover && treeIdx && treeIdx.has(row.key)) {
      const hit = treeIdx.get(row.key);
      const p = planNodes(S, hit.spirit, [hit.node.guid]);
      const extra = costText(p.pathCost);
      if (p.nodes.length > 1) pathHint = `<button type="button" class="wp-path-btn" data-act="tp-for" data-guid="${escapeHtml(hit.spirit.guid)}"><svg class="inline-icon" width="12" height="12" aria-hidden="true"><use href="#i-tree"/></svg>${extra ? t(`通り道も計算する（＋${extra}）`, `Count the way there (+${extra})`) : t('ツリーで通り道も計算する', 'Count the way there')}</button>`;
    }
    const first = idx === 0, last = idx === vis.length - 1;
    const inGroups = grp.groups.filter(g => g.items.includes(row.key)).map(g => g.name);
    const groupSel = inGroups.length ? `<div class="wp-in-groups">${inGroups.map(n => `<span>${escapeHtml(n)}</span>`).join('')}</div>` : '';
    return `<li class="wp-row ${cls}">
      <label class="wp-include" title="${t('計算に入れる', 'Include in the plan')}"><input type="checkbox" data-include="${escapeHtml(row.key)}"${off ? '' : ' checked'} aria-label="${t('計算に入れる', 'Include in the plan')}"></label>
      <span class="wp-rank">${idx + 1}</span>
      <span class="wp-thumb" data-img-key="${escapeHtml(row.key)}">${thumbSrc(row) ? `<img src="${escapeHtml(thumbSrc(row))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span>
      <div class="wp-main">
        <div class="wp-name">${escapeHtml(row.name)}</div>
        <div class="wp-meta">${escapeHtml(CURRENT_LANG === 'en' ? row.cat.nameEn : row.cat.name)}・${escapeHtml(row.tree ? (costText(row.plan.cost) || t('交換するものなし', 'Nothing to pay')) : costLabel(row.cost))}</div>
        ${row.tree ? treeDetailHtml(row) : ''}
        <div class="wp-status">${escapeHtml(status)}</div>
        ${firstNeed && firstNeed.key === row.key ? `<div class="wp-get-row"><button type="button" class="wp-path-btn" data-act="to-pro"><svg class="inline-icon" width="12" height="12" aria-hidden="true"><use href="#i-calendar"/></svg>${t('ノマキャン計算機プロで到達日を見る', 'See the date in Candle Calculator Pro')}</button></div>` : ''}
        ${groupSel}
        ${row.tree ? `<div class="wp-get-row"><button type="button" class="wp-path-btn" data-act="tp-edit" data-key="${escapeHtml(row.key)}"><svg class="inline-icon" width="12" height="12" aria-hidden="true"><use href="#i-edit"/></svg>${t('選び直す', 'Change')}</button><button type="button" class="wp-path-btn" data-act="tp-catalog" data-key="${escapeHtml(row.key)}"><svg class="inline-icon" width="12" height="12" aria-hidden="true"><use href="#i-tree"/></svg>${t('精霊ツリー管理で解放する', 'Unlock in Spirit Tree Catalog')}</button></div>`
        : `${pathHint ? `<div class="wp-get-row">${pathHint}</div>` : ''}
        <div class="wp-get-row"><button type="button" class="wp-get-btn${getConfirmId === row.key ? ' is-confirm' : ''}" data-act="get" data-key="${escapeHtml(row.key)}">${getConfirmId === row.key ? escapeHtml(getConfirmLabel(row)) : `<svg class="inline-icon" width="13" height="13" aria-hidden="true"><use href="#i-check"/></svg>${t('手に入れた', 'Got it')}`}</button></div>`}
      </div>
      <div class="wp-move">
        <button type="button" class="fun-icon-btn" data-act="up" data-key="${escapeHtml(row.key)}"${first ? ' disabled' : ''} aria-label="${t('上へ', 'Move up')}"><svg class="inline-icon" width="14" height="14" style="transform:rotate(180deg)"><use href="#i-chevron-down"/></svg></button>
        <button type="button" class="fun-icon-btn" data-act="down" data-key="${escapeHtml(row.key)}"${last ? ' disabled' : ''} aria-label="${t('下へ', 'Move down')}"><svg class="inline-icon" width="14" height="14"><use href="#i-chevron-down"/></svg></button>
        <button type="button" class="fun-icon-btn${confirmId === row.key ? ' is-confirm' : ''}" data-act="remove" data-key="${escapeHtml(row.key)}" aria-label="${confirmId === row.key ? t('もう一度押すと外します', 'Tap again to remove') : (row.tree ? t('計画から外す', 'Remove from plan') : t('欲しいものから外す', 'Remove from wishlist'))}"><svg class="inline-icon" width="14" height="14"><use href="#i-close"/></svg></button>
      </div>
    </li>`;
  }).join('');
  const needC = Math.max(0, cumC - cur.candle);
  const pace = daysLeft ? Math.ceil(needC / daysLeft) : null;
  const allDays = Math.ceil(needC / perDay);
  r.innerHTML = `<div class="fun-wrap">
    <header class="fun-head">
      <h1 class="fun-h1"><svg class="inline-icon" width="22" height="22" aria-hidden="true"><use href="#i-cart"/></svg>${t('ほしいもの計画', 'Wishlist Plan')}</h1>
      <p class="fun-lead">${t('欲しいものに順番を付けると、いつ手に入るかを計算します。', 'Put your wishlist in order and see when you can get each item, and how many candles a day you need.')}</p>
    </header>

    <section class="wp-summary">
      <label class="wp-field"><span>${t('いまのキャンドル', 'Candles now')}</span><input class="fun-input" type="number" inputmode="numeric" min="0" data-cur="candle" value="${cur.candle}"></label>
      <label class="wp-field"><span>${t('いまのハート', 'Hearts now')}</span><input class="fun-input" type="number" inputmode="numeric" min="0" data-cur="heart" value="${cur.heart}"></label>
      <label class="wp-field"><span>${t('1日に集める本数', 'Candles per day')}</span><input class="fun-input" type="number" inputmode="numeric" min="1" max="999" data-set="perDay" value="${perDay}"></label>
      <div class="wp-field"><span>${t('期限', 'Deadline')}</span>
        <div class="fun-chips">
          <button type="button" class="fun-chip${settings.deadline === 'season' ? ' on' : ''}" data-act="dl-season">${t('季節の終わり', 'Season end')}</button>
          <button type="button" class="fun-chip${settings.deadline === 'date' ? ' on' : ''}" data-act="dl-date">${t('日付を選ぶ', 'Pick a date')}</button>
        </div>
        ${settings.deadline === 'date' ? `<input class="fun-input" type="date" data-set="date" value="${settings.date}">` : ''}
      </div>
    </section>

    ${pick && S ? pickerHtml(S, pick) : `<div class="wp-tree-entry"><button type="button" class="fun-btn" data-act="tp-open"><svg class="inline-icon" width="15" height="15" aria-hidden="true"><use href="#i-tree"/></svg>${t('精霊のツリーから選ぶ', 'Pick from a spirit tree')}</button><p class="fun-hint">${t('再訪・精霊団の精霊は、通り道の祝福（魔法）やハートも合わせて計算できます。', 'For returning spirits, this also counts the blessings and hearts on the way.')}</p></div>`}

    ${rows.length ? groupBarHtml(vis, counted) : ''}
    ${rows.length && !vis.length ? `<p class="fun-hint wp-empty-group">${t('このグループにはまだアイテムがありません。「名前・アイテムを編集」から入れるアイテムを選んでください。', 'No items in this group yet. Use “Edit group” to choose items.')}</p>` : ''}
    ${vis.length ? `<section class="wp-result">
      <div class="wp-big"><span>${counted.length === vis.length ? t('全部そろえるのに', 'To get everything') : t(`選んだ${counted.length}件をそろえるのに`, `To get the ${counted.length} selected`)}</span><b>${needC.toLocaleString()}</b><small>${t('本たりません', 'candles short')}</small></div>
      ${needC > 0 ? `<div class="wp-big"><span>${dl ? t(`期限（${fmtDate(dl)}）まで${daysLeft}日`, `${daysLeft} days to ${fmtDate(dl)}`) : t('期限なし', 'No deadline')}</span><b>${pace != null ? pace.toLocaleString() : '—'}</b><small>${t('本／日 あれば間に合います', 'candles/day needed')}</small></div>
      <p class="wp-note">${t(`1日${perDay}本なら、あと${allDays}日（${fmtDate(new Date(Date.now() + allDays * DAY))}ごろ）で全部そろいます。`, `At ${perDay}/day, you’ll have everything in ${allDays} days.`)}${pace != null && pace > perDay ? t(' このままだと期限に間に合わないものがあります。', ' Some items won’t make the deadline at this pace.') : ''}</p>` : `<p class="wp-note ok">${t('今のキャンドルで、欲しいもの（キャンドルで交換できるもの）が全部そろいます！', 'You can afford everything on your list right now!')}</p>`}
    </section>
    <ol class="wp-list">${lines}</ol>
    <p class="fun-hint">${t('左のチェックを外すと、そのアイテムは計算に入りません。↑↓で順番を入れ替えられます。所持にしたアイテムは自動で一覧から外れます。', 'Uncheck an item to leave it out of the plan. Reorder with ↑↓. Items you mark as owned drop off automatically.')}</p>`
    : (rows.length ? '' : `<div class="fun-empty"><svg class="inline-icon" width="30" height="30"><use href="#i-cart"/></svg><p>${t('欲しいものリストが空です。アイテム所持管理で欲しいアイテムのリボンを押すか、上の「精霊のツリーから選ぶ」で追加してください。', 'Your wishlist is empty. Add items from the item tracker.')}</p><button type="button" class="fun-btn" data-act="go-item">${t('アイテム所持管理を開く', 'Open item tracker')}</button></div>`)}
  </div>`;
}

// ツリーの行の内訳（欲しいもの／通り道）
function treeDetailHtml(row) {
  const nm = x => `${S.itemDisplayName(x.node, row.spirit)}${costText(x.node.cost) ? `（${costText(x.node.cost)}）` : ''}`;
  const want = row.plan.nodes.filter(x => x.target).map(nm);
  const path = row.plan.nodes.filter(x => !x.target).map(nm);
  return `<div class="wp-tree-detail"><p><b>${t('欲しいもの', 'Wanted')}</b>${escapeHtml(want.join(t('、', ', ')))}</p>${path.length ? `<p><b>${t('通り道', 'On the way')}</b>${escapeHtml(path.join(t('、', ', ')))}</p>` : ''}</div>`;
}

/* ---- 精霊のツリーから選ぶ（描画は tree-pick.js） ---- */
function openPicker(guid, extraTargets) {
  const start = () => {
    if (!containerEl) return;
    if (guid && S.spiritByGuid[guid]) {
      // 保存してある選択に、欲しいものに入っている同じツリーのアイテムを足した状態から始める
      const targets = new Set(loadTreePlans()[guid] || []);
      (extraTargets || []).forEach(g => targets.add(g));
      const wishKeys = new Set(rows.filter(r => !r.tree).map(r => r.key));
      S.spiritByGuid[guid].nodes.forEach(n => { if (n.itemCatKey && wishKeys.has(`${n.itemCatKey}:${n.itemCostId}`) && !S.isNodeUnlocked(n)) targets.add(n.guid); });
      pick = { step: 'tree', q: '', guid, targets };
    } else pick = { step: 'spirit', q: '', guid: null, targets: new Set() };
    render();
    root().querySelector('[data-tp]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (pick.step === 'spirit') root().querySelector('[data-tp-q]')?.focus({ preventScroll: true });
    S.ensureNodeImageMapsLoaded(() => { if (pick && pick.step === 'tree' && containerEl) refreshPicker(); });
  };
  if (S) { start(); return; }
  toast(t('ツリーを読み込んでいます…', 'Loading spirit trees…'));
  const my = token;
  loadS().then(mod => { if (my !== token || !containerEl) return; S = mod; buildRows(); start(); })
    .catch(() => toast(t('ツリーを読み込めませんでした。通信を確かめて、もう一度お試しください', 'Could not load spirit trees. Please try again.')));
}
// 選ぶ画面だけを描き直す（ページ全体を描き直すとスクロール位置が動くため）
function refreshPicker() {
  const el = root() && root().querySelector('[data-tp]');
  if (!el || !pick) return;
  const x = el.querySelector('.wp-tp-scroll')?.scrollLeft || 0;
  el.outerHTML = pickerHtml(S, pick);
  const sc = root().querySelector('.wp-tp-scroll'); if (sc) sc.scrollLeft = x;
}
function onPickAction(act, btn) {
  if (act === 'tp-open') { openPicker(null); return true; }
  if (act === 'tp-for') { openPicker(btn.dataset.guid); return true; }
  if (act === 'tp-edit') { openPicker(btn.dataset.key.slice(5)); return true; }
  if (act === 'tp-catalog') { navigate('spirit-catalog', btn.dataset.key.slice(5)); return true; }
  if (!act.startsWith('tp-')) return false;
  if (!pick || !S) return true;
  if (act === 'tp-close') { pick = null; render(); return true; }
  if (act === 'tp-back') { pick = { step: 'spirit', q: '', guid: null, targets: new Set() }; refreshPicker(); return true; }
  if (act === 'tp-spirit') { openPicker(btn.dataset.guid); return true; }
  const spirit = S.spiritByGuid[pick.guid];
  if (!spirit) return true;
  if (act === 'tp-node') {
    const g = btn.dataset.guid;
    if (pick.targets.has(g)) pick.targets.delete(g); else pick.targets.add(g);
    refreshPicker();
    root().querySelector(`[data-act="tp-node"][data-guid="${CSS.escape(g)}"]`)?.focus({ preventScroll: true });
    return true;
  }
  if (act === 'tp-all') { pick.targets = new Set(spirit.nodes.filter(n => !S.isChecklistExcludedNode(n) && !S.isNodeUnlocked(n)).map(n => n.guid)); refreshPicker(); return true; }
  if (act === 'tp-none') { pick.targets = new Set(); refreshPicker(); return true; }
  if (act === 'tp-save') {
    const plans = loadTreePlans();
    const targets = planNodes(S, spirit, pick.targets).targets;
    const had = !!plans[spirit.guid];
    if (targets.length) plans[spirit.guid] = targets; else delete plans[spirit.guid];
    saveTreePlans(plans);
    const name = S.spiritName(spirit);
    pick = null; saveOrder(); buildRows(); saveOrder(); render();
    toast(targets.length ? t(`「${name}」のツリーを計画に入れました`, `Added ${name}’s tree to your plan`) : had ? t(`「${name}」のツリーを計画から外しました`, `Removed ${name}’s tree from your plan`) : t('何も選ばれていません', 'Nothing selected'));
    if (targets.length) root().querySelector(`[data-act="tp-edit"][data-key="tree:${CSS.escape(spirit.guid)}"]`)?.closest('.wp-row')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return true;
  }
  return true;
}
function onInput(e) {
  // 精霊をさがす欄は、結果だけ差し替える（入力欄を描き直すとフォーカスが外れる）
  if (!e.target.matches('[data-tp-q]') || !pick || !S) return;
  pick.q = e.target.value;
  const box = root().querySelector('.wp-tp-results');
  if (box) box.innerHTML = spiritResultsHtml(S, pick.q);
}

// グループのタブ（すべて・各グループ・＋グループを作る）と、選んでいるグループの名前の変更・削除、表示中をまとめて計算に入れる／外す
function groupBarHtml(vis, counted) {
  const rowKeys = new Set(rows.map(r => r.key));
  const count = id => (id === 'all' ? rows.length : (grp.groups.find(g => g.id === id)?.items || []).filter(k => rowKeys.has(k)).length);
  const cur = grp.groups.find(g => g.id === grp.view);
  const editing = groupEdit ? `<div class="wp-group-edit">
      <input class="fun-input" type="text" maxlength="30" data-group-name value="${escapeHtml(groupEdit.name || '')}" placeholder="${t('グループの名前（例: 次の季節で買う）', 'Group name')}">
      <p class="wp-group-pick-head">${t('このグループに入れるアイテム', 'Items in this group')}<span>${t(`${groupEdit.items.size}件`, `${groupEdit.items.size}`)}</span>
        <button type="button" class="fun-btn small" data-act="pick-all">${t('すべて選ぶ', 'All')}</button><button type="button" class="fun-btn small" data-act="pick-none">${t('選択を外す', 'None')}</button></p>
      <div class="wp-group-pick">${rows.map(r => `<label class="wp-pick-row"><input type="checkbox" data-pick="${escapeHtml(r.key)}"${groupEdit.items.has(r.key) ? ' checked' : ''}><span class="wp-thumb">${thumbSrc(r) ? `<img src="${escapeHtml(thumbSrc(r))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span><span class="wp-pick-name">${escapeHtml(r.name)}<small>${escapeHtml(CURRENT_LANG === 'en' ? r.cat.nameEn : r.cat.name)}</small></span></label>`).join('')}</div>
      <div class="wp-group-edit-actions">
        <button type="button" class="fun-btn small" data-act="group-cancel">${t('やめる', 'Cancel')}</button>
        <button type="button" class="fun-btn small primary" data-act="group-save">${groupEdit.mode === 'new' ? t('作る', 'Create') : t('保存', 'Save')}</button>
      </div>
    </div>` : '';
  return `<section class="wp-groups">
    <div class="fun-chips wp-group-tabs" role="tablist">
      <button type="button" class="fun-chip${grp.view === 'all' ? ' on' : ''}" data-act="group-view" data-g="all">${t('すべて', 'All')}<span class="wp-chip-n">${count('all')}</span></button>
      ${grp.groups.map(g => `<button type="button" class="fun-chip${grp.view === g.id ? ' on' : ''}" data-act="group-view" data-g="${escapeHtml(g.id)}">${escapeHtml(g.name)}<span class="wp-chip-n">${count(g.id)}</span></button>`).join('')}
      <button type="button" class="fun-chip wp-group-add" data-act="group-new"><svg class="inline-icon" width="12" height="12"><use href="#i-plus"/></svg>${t('グループを作る', 'New group')}</button>
    </div>
    ${editing}
    <div class="wp-group-tools">
      <span class="wp-group-info">${t(`計算に入れる: ${counted.length} / ${vis.length}件`, `Included: ${counted.length} / ${vis.length}`)}</span>
      ${vis.length ? `<button type="button" class="fun-btn small" data-act="include-all">${t('すべて入れる', 'Include all')}</button><button type="button" class="fun-btn small" data-act="include-none">${t('すべて外す', 'Exclude all')}</button>` : ''}
      ${cur && !groupEdit ? `<button type="button" class="fun-btn small" data-act="group-rename">${t('名前・アイテムを編集', 'Edit group')}</button><button type="button" class="fun-btn small${groupDelConfirm ? ' is-confirm' : ''}" data-act="group-del">${groupDelConfirm ? t('もう一度押すと削除', 'Tap again to delete') : t('グループを消す', 'Delete group')}</button>` : ''}
    </div>
  </section>`;
}
function genGroupId() { return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
function onGroupAction(act, btn) {
  if (act === 'group-view') { grp.view = btn.dataset.g; groupEdit = null; groupDelConfirm = false; saveGroups(); render(); return true; }
  if (act === 'group-new') {
    groupEdit = { mode: 'new', name: '', items: new Set() }; // 作る時は何も選んでいない状態から
    groupDelConfirm = false; render(); root().querySelector('[data-group-name]')?.focus(); return true;
  }
  if (act === 'group-rename') {
    const g = grp.groups.find(x => x.id === grp.view);
    if (!g) return true;
    groupEdit = { mode: 'edit', name: g.name, items: new Set(g.items) };
    render(); root().querySelector('[data-group-name]')?.focus(); return true;
  }
  if (act === 'pick-all' || act === 'pick-none') {
    if (!groupEdit) return true;
    groupEdit.name = root().querySelector('[data-group-name]')?.value || groupEdit.name;
    groupEdit.items = new Set(act === 'pick-all' ? rows.map(r => r.key) : []);
    render(); return true;
  }
  if (act === 'group-cancel') { groupEdit = null; render(); return true; }
  if (act === 'group-save') {
    const name = (root().querySelector('[data-group-name]')?.value || '').trim().slice(0, 30);
    if (!groupEdit) return true;
    if (!name) { toast(t('グループの名前を入れてください', 'Enter a group name')); return true; }
    // 欲しいものから外れたアイテムの印も、グループには残しておく（また欲しいものに入れた時に戻るように）。ここでは選んだものだけを入れ直す
    const keep = groupEdit.mode === 'edit' ? (grp.groups.find(x => x.id === grp.view)?.items || []).filter(k => !rows.some(r => r.key === k)) : [];
    const items = [...keep, ...rows.map(r => r.key).filter(k => groupEdit.items.has(k))];
    if (groupEdit.mode === 'edit') { const g = grp.groups.find(x => x.id === grp.view); if (g) { g.name = name; g.items = items; } }
    else { const id = genGroupId(); grp.groups.push({ id, name, items }); grp.view = id; }
    groupEdit = null; saveGroups(); render(); return true;
  }
  if (act === 'group-del') {
    if (!groupDelConfirm) { groupDelConfirm = true; render(); setTimeout(() => { if (groupDelConfirm && containerEl) { groupDelConfirm = false; render(); } }, 3500); return true; }
    const id = grp.view;
    grp.groups = grp.groups.filter(g => g.id !== id);
    delete grp.offBy[id]; // グループを消しても、アイテムは欲しいものに残る
    grp.view = 'all'; groupDelConfirm = false; saveGroups(); render();
    toast(t('グループを消しました（アイテムはそのまま残っています）', 'Group deleted (items are kept)'));
    return true;
  }
  if (act === 'include-all' || act === 'include-none') {
    const off = offSet();
    visibleRows().forEach(r => { if (act === 'include-all') off.delete(r.key); else off.add(r.key); });
    saveGroups(); render(); return true;
  }
  return false;
}
function onClick(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn || btn.disabled) return;
  const { act, key } = btn.dataset;
  if (act === 'go-item') { navigate('item', ''); return; }
  if (act === 'to-pro') {
    if (!firstNeed) return;
    writeWishHandoff({ currentCandles: firstNeed.current, needCandle: firstNeed.needCandle, itemName: firstNeed.name });
    navigate('tai-nomacan-pro', '');
    return;
  }
  if (onGroupAction(act, btn)) return;
  if (onPickAction(act, btn)) return;
  if (act === 'dl-season' || act === 'dl-date') {
    settings.deadline = act === 'dl-season' ? 'season' : 'date';
    if (settings.deadline === 'date' && !settings.date) {
      const d = new Date(Date.now() + 30 * DAY);
      settings.date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    writeJson(SETTINGS_KEY, settings); render(); return;
  }
  const i = rows.findIndex(r => r.key === key);
  if (i < 0) return;
  if (act === 'up' || act === 'down') {
    // 表示中（グループで絞った）一覧の中で、となりの行と入れ替える
    const vis = visibleRows();
    const vi = vis.findIndex(r => r.key === key);
    const other = vis[act === 'up' ? vi - 1 : vi + 1];
    if (!other) return;
    const j = rows.indexOf(other);
    [rows[i], rows[j]] = [rows[j], rows[i]];
    saveOrder(); render();
    root().querySelector(`[data-act="${act}"][data-key="${CSS.escape(key)}"]`)?.focus();
    return;
  }
  if (act === 'get') {
    if (getConfirmId !== key) {
      getConfirmId = key; confirmId = null; render();
      setTimeout(() => { if (getConfirmId === key && containerEl) { getConfirmId = null; render(); } }, 4000);
      return;
    }
    getConfirmId = null;
    const row = rows[i];
    acquireRow(row).then(spent => {
      rows = rows.filter(r => r.key !== row.key); saveOrder();
      // 手に入れたアイテムがツリーの行に入っていれば、その行の中身も減らす
      if (S) { S.invalidateExternalOwnCache(); buildRows(); }
      if (containerEl) render();
      toast(spent ? t(`「${row.name}」を所持にしました（${spent}）`, `Marked “${row.name}” as owned (${spent})`) : t(`「${row.name}」を所持にしました`, `Marked “${row.name}” as owned`));
    }).catch(() => toast(t('所持にできませんでした。もう一度お試しください', 'Could not mark as owned. Please try again.')));
    return;
  }
  if (act === 'remove') {
    if (confirmId !== key) { confirmId = key; render(); setTimeout(() => { if (confirmId === key && containerEl) { confirmId = null; render(); } }, 3500); return; }
    confirmId = null;
    if (rows[i].tree) {
      const plans = loadTreePlans(); delete plans[rows[i].id]; saveTreePlans(plans);
      rows.splice(i, 1); saveOrder(); render();
      toast(t('ツリーを計画から外しました', 'Removed the tree from your plan'));
      return;
    }
    removeWishItem(rows[i].cat.key, rows[i].id);
    rows.splice(i, 1); saveOrder(); render();
    toast(t('欲しいものから外しました', 'Removed from wishlist'));
  }
}
function onChange(e) {
  const el = e.target;
  if (el.dataset.include) { const off = offSet(); if (el.checked) off.delete(el.dataset.include); else off.add(el.dataset.include); saveGroups(); render(); return; }
  if (el.dataset.pick && groupEdit) {
    // 選び直しは数だけ書き換える（名前の入力欄を描き直してフォーカスを外さないため）
    if (el.checked) groupEdit.items.add(el.dataset.pick); else groupEdit.items.delete(el.dataset.pick);
    const n = root().querySelector('.wp-group-pick-head span'); if (n) n.textContent = t(`${groupEdit.items.size}件`, `${groupEdit.items.size}`);
    return;
  }
  if (el.dataset.cur) { setCurrency(el.dataset.cur, el.value); render(); return; }
  if (el.dataset.set === 'perDay') { settings.perDay = Math.min(999, Math.max(1, Math.floor(Number(el.value) || 1))); writeJson(SETTINGS_KEY, settings); render(); return; }
  if (el.dataset.set === 'date') { settings.date = el.value; writeJson(SETTINGS_KEY, settings); render(); }
}

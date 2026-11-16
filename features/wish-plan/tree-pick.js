/* ================================================================
   🌳 ほしいもの計画の「精霊のツリーから選ぶ」。
   再訪・精霊団の精霊は、欲しいアイテムの手前にある祝福（魔法）やハートなども解放しないと届かない。
   精霊ツリー管理のツリー（features/spirit-catalog）をそのまま使い、欲しいノードを選ぶと
   「そこまでの通り道でまだ解放していないノード」も合わせて数える。

   - 保存（プロフィールごと）: wishPlanTrees_v1 = { <精霊のguid>: [<欲しいノードのguid>, …] }
     通り道は保存しない（解放の状況から毎回計算する）。精霊ツリー管理・アイテム所持管理で解放済みになったノードは
     自動で計算から外れ、欲しいノードが全部解放済みになった精霊は計画から消える。
   - ツリーのデータは大きい（約1.8MB）ので、ここから動的に読み込む（loadS）。
   - このファイルは計算と描画だけ。押した時の処理は wish-plan-view.js が data-act で受ける。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { nsKey } from '../../js/state.js';
import { REVISIT_SPIRIT_SCHEDULES } from '../item/data/season-data.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
const TREES_KEY = 'wishPlanTrees_v1';
export const TREE_CAT = { key: 'tree', name: '精霊ツリー', nameEn: 'Spirit tree' };

let statePromise = null;
/** 精霊ツリー管理の状態モジュール（ツリーのデータ込み）を読み込む */
export function loadS() {
  if (!statePromise) statePromise = import('../spirit-catalog/spirit-catalog-state.js').catch(e => { statePromise = null; throw e; });
  return statePromise;
}

export function loadTreePlans() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(nsKey(TREES_KEY))); } catch (e) { raw = null; }
  const out = {};
  if (raw && typeof raw === 'object') {
    Object.entries(raw).forEach(([guid, list]) => {
      if (Array.isArray(list)) { const ids = list.filter(x => typeof x === 'string'); if (ids.length) out[guid] = ids; }
    });
  }
  return out;
}
export function saveTreePlans(plans) {
  try {
    if (Object.keys(plans).length) localStorage.setItem(nsKey(TREES_KEY), JSON.stringify(plans));
    else localStorage.removeItem(nsKey(TREES_KEY));
  } catch (e) { /* noop */ }
}

const COST_KEYS = ['c', 'h', 'ac', 'sc', 'sh', 'ec'];
const COST_NAME = {
  c: ['キャンドル', 'candles'], h: ['ハート', 'hearts'], ac: ['星のキャンドル', 'ascended candles'],
  sc: ['季節キャンドル', 'season candles'], sh: ['季節ハート', 'season hearts'], ec: ['チケット', 'tickets'],
};
function addCost(total, cost) { COST_KEYS.forEach(k => { if (cost && cost[k]) total[k] = (total[k] || 0) + cost[k]; }); return total; }
/** { c: 50, h: 3 } → 「キャンドル 50・ハート 3」。何も無ければ空文字 */
export function costText(cost) {
  return COST_KEYS.filter(k => cost && cost[k]).map(k => t(`${COST_NAME[k][0]} ${cost[k]}`, `${cost[k]} ${COST_NAME[k][1]}`)).join(t('・', ', '));
}

// あるノードを解放するのに先に要るノード（自分は含まない）。枝分かれのツリーは根までの親、段のあるツリーは下の段すべて
function prereqGuids(S, spirit, node) {
  if (spirit.isTiered) return spirit.nodes.filter(n => (n.tier || 0) < (node.tier || 0)).map(n => n.guid);
  const layout = S.computeTreeLayout(spirit);
  const out = [];
  if (!layout) return out;
  let cur = layout.parentOf[node.guid];
  while (cur) { out.push(cur); cur = layout.parentOf[cur]; }
  return out;
}

/**
 * 欲しいノード（targets）をそろえるのに、これから解放するノードをまとめる。
 * 返り値: { nodes: [{ node, target }]（解放済み・ワープなどは除く）, cost: 合計, pathCost: そのうち通り道の分, targets: まだ解放していない欲しいノードのguid }
 */
export function planNodes(S, spirit, targets) {
  const byGuid = new Map(spirit.nodes.map(n => [n.guid, n]));
  const want = new Set();
  const path = new Set();
  [...targets].forEach(g => {
    const node = byGuid.get(g);
    if (!node || S.isChecklistExcludedNode(node) || S.isNodeUnlocked(node)) return;
    want.add(g);
    prereqGuids(S, spirit, node).forEach(p => path.add(p));
  });
  const nodes = [];
  const cost = {}, pathCost = {};
  spirit.nodes.forEach(n => {
    const target = want.has(n.guid);
    if (!target && !path.has(n.guid)) return;
    if (S.isChecklistExcludedNode(n) || S.isNodeUnlocked(n)) return;
    nodes.push({ node: n, target });
    addCost(cost, n.cost);
    if (!target) addCost(pathCost, n.cost);
  });
  return { nodes, cost, pathCost, targets: [...want] };
}

export function spiritThumb(spirit) {
  const url = spirit.imageUrl || '';
  if (!url || !/static\.wikia\.nocookie\.net/.test(url) || /\/revision\//.test(url)) return url;
  return `${url}/revision/latest/scale-to-width-down/96`;
}

/** 保存してある精霊ごとの計画を、ほしいもの計画の行にする（解放が進んで要らなくなった分は保存からも外す） */
export function buildTreeRows(S) {
  const plans = loadTreePlans();
  const rows = [];
  let changed = false;
  Object.keys(plans).forEach(guid => {
    const spirit = S.spiritByGuid[guid];
    const plan = spirit ? planNodes(S, spirit, plans[guid]) : null;
    if (!plan || !plan.targets.length) { delete plans[guid]; changed = true; return; }
    if (plan.targets.length !== plans[guid].length) { plans[guid] = plan.targets; changed = true; }
    rows.push({
      key: `tree:${guid}`, tree: true, cat: TREE_CAT, id: guid, spirit, plan,
      name: t(`${S.spiritName(spirit)}のツリー`, `${S.spiritName(spirit)} (tree)`),
      img: spiritThumb(spirit),
      cost: { type: 'tree', c: plan.cost.c || 0, h: plan.cost.h || 0 },
      source: '',
    });
  });
  if (changed) saveTreePlans(plans);
  return rows;
}

let itemIndex = null;
/** アイテム（'catKey:id'）→ そのアイテムが載っているツリーのノード */
export function itemTreeIndex(S) {
  if (itemIndex) return itemIndex;
  itemIndex = new Map();
  Object.values(S.spiritByGuid).forEach(spirit => {
    spirit.nodes.forEach(node => {
      if (!node.itemCatKey || !node.itemCostId) return;
      const key = `${node.itemCatKey}:${node.itemCostId}`;
      if (!itemIndex.has(key)) itemIndex.set(key, { spirit, node });
    });
  });
  return itemIndex;
}

/** 来ている・これから来る精霊（season-data.js の予定から。名前の分かっているものだけ） */
export function visitingSpirits(S) {
  const now = Date.now();
  const names = [];
  REVISIT_SPIRIT_SCHEDULES.forEach(s => {
    if (!s.intervalDays && !(s.end && new Date(s.end).getTime() >= now)) return;
    if (Array.isArray(s.spiritsEn)) names.push(...s.spiritsEn);
    if (s.spiritEn) names.push(s.spiritEn);
  });
  const all = Object.values(S.spiritByGuid);
  return [...new Set(names)].map(en => all.find(sp => sp.name === en)).filter(Boolean);
}

export function searchSpirits(S, q) {
  const query = S.normalizeSearchText(q.trim());
  if (!query) return [];
  return Object.values(S.spiritByGuid).filter(sp => {
    const hay = S.normalizeSearchText(`${sp.nameJa || ''} ${sp.name || ''} ${S.spiritYomi(sp)}`);
    return hay.includes(query);
  }).slice(0, 40);
}

/* ================================================================
   描画（選ぶ画面）
   ================================================================ */
const svgIcon = (id, size) => `<svg class="inline-icon" width="${size}" height="${size}" aria-hidden="true"><use href="#${id}"/></svg>`;
const CHIP_ICON = { c: 'i-candle', h: 'i-heart', ac: 'i-star-candle', sc: 'i-candle', sh: 'i-heart' };
const CHIP_PREFIX = { sc: ['季', 'S'], sh: ['季', 'S'], ec: ['券', 'T'] };
function costChips(cost) {
  return COST_KEYS.filter(k => cost && cost[k]).map(k =>
    `<span class="wp-tn-chip k-${k}" title="${escapeHtml(t(`${COST_NAME[k][0]} ${cost[k]}`, `${cost[k]} ${COST_NAME[k][1]}`))}">${CHIP_ICON[k] ? svgIcon(CHIP_ICON[k], 10) : ''}${CHIP_PREFIX[k] ? t(CHIP_PREFIX[k][0], CHIP_PREFIX[k][1]) : ''}${cost[k]}</span>`).join('');
}

function spiritRowHtml(S, sp, plans) {
  const picked = plans[sp.guid] ? plans[sp.guid].length : 0;
  const sub = [S.typeLabel(sp.type), sp.season ? S.seasonLabel(sp.season) : ''].filter(Boolean).join('・');
  return `<button type="button" class="wp-tp-spirit" data-act="tp-spirit" data-guid="${escapeHtml(sp.guid)}">
    <span class="wp-thumb">${sp.imageUrl ? `<img src="${escapeHtml(spiritThumb(sp))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span>
    <span class="wp-pick-name">${escapeHtml(S.spiritName(sp))}<small>${escapeHtml(sub)}</small></span>
    ${picked ? `<span class="wp-tp-picked">${t(`${picked}件 選択中`, `${picked} picked`)}</span>` : ''}
    ${svgIcon('i-chevron-right', 14)}
  </button>`;
}

/** 精霊をさがす欄の結果（入力のたびにここだけ差し替える） */
export function spiritResultsHtml(S, q) {
  const plans = loadTreePlans();
  if (q.trim()) {
    const found = searchSpirits(S, q);
    return found.length ? found.map(sp => spiritRowHtml(S, sp, plans)).join('') : `<p class="fun-hint">${t('見つかりませんでした。名前の一部（ひらがなでも）で試してください。', 'No spirits found.')}</p>`;
  }
  const visiting = visitingSpirits(S);
  const planned = Object.keys(plans).map(g => S.spiritByGuid[g]).filter(sp => sp && !visiting.includes(sp));
  return `${visiting.length ? `<p class="wp-tp-label">${t('来ている・これから来る精霊', 'Visiting now or soon')}</p>${visiting.map(sp => spiritRowHtml(S, sp, plans)).join('')}` : ''}
    ${planned.length ? `<p class="wp-tp-label">${t('計画に入っている精霊', 'Already in your plan')}</p>${planned.map(sp => spiritRowHtml(S, sp, plans)).join('')}` : ''}
    ${!visiting.length && !planned.length ? `<p class="fun-hint">${t('精霊の名前を入れてさがしてください。', 'Type a spirit name to search.')}</p>` : ''}`;
}

function nodeHtml(S, spirit, n, state, style) {
  const name = S.itemDisplayName(n, spirit);
  const img = S.resolveNodeImg(n);
  const inner = img ? `<img src="${escapeHtml(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : svgIcon('i-sparkle', 18);
  const label = `<div class="wp-tn-label">${escapeHtml(name)}</div><div class="wp-tn-cost">${costChips(n.cost)}</div>`;
  if (state === 'skip' || state === 'owned') {
    return `<div class="wp-tn-wrap" style="${style}"><span class="wp-tn is-${state}" title="${escapeHtml(state === 'owned' ? t(`${name}（解放済み）`, `${name} (unlocked)`) : name)}">${inner}${state === 'owned' ? `<i class="wp-tn-mark">${svgIcon('i-check', 10)}</i>` : ''}</span>${label}</div>`;
  }
  return `<div class="wp-tn-wrap" style="${style}">
    <button type="button" class="wp-tn${state ? ` is-${state}` : ''}" data-act="tp-node" data-guid="${escapeHtml(n.guid)}" aria-pressed="${state === 'target'}" title="${escapeHtml(name)}">${inner}${state === 'target' ? `<i class="wp-tn-mark">${svgIcon('i-check', 10)}</i>` : ''}</button>
    ${label}
  </div>`;
}

function treeHtml(S, spirit, targets) {
  const plan = planNodes(S, spirit, targets);
  const need = new Map(plan.nodes.map(x => [x.node.guid, x.target ? 'target' : 'path']));
  const stateOf = n => (S.isChecklistExcludedNode(n) ? 'skip' : S.isNodeUnlocked(n) ? 'owned' : (need.get(n.guid) || ''));
  if (spirit.isTiered) {
    const tiers = [...new Set(spirit.nodes.map(n => n.tier || 0))].sort((a, b) => b - a);
    return tiers.map(tier => {
      const inTier = spirit.nodes.filter(n => (n.tier || 0) === tier);
      const rowKeys = [...new Set(inTier.map(n => n.row || 0))].sort((a, b) => a - b);
      return `<div class="wp-tp-tier"><p class="wp-tp-label">${t(`${tier + 1}段目`, `Tier ${tier + 1}`)}</p>${rowKeys.map(r =>
        `<div class="wp-tp-tier-row">${inTier.filter(n => (n.row || 0) === r).sort((a, b) => (a.col || 0) - (b.col || 0)).map(n => nodeHtml(S, spirit, n, stateOf(n), '')).join('')}</div>`).join('')}</div>`;
    }).join('');
  }
  const layout = S.computeTreeLayout(spirit);
  if (!layout) return `<div class="wp-tp-tier-row">${spirit.nodes.map(n => nodeHtml(S, spirit, n, stateOf(n), '')).join('')}</div>`;
  const unitW = 84, unitH = 104, pad = 10, top = 26;
  const width = layout.leafCount * unitW + pad * 2;
  const height = (layout.maxDepth + 1) * unitH + pad * 2;
  const cx = g => layout.xOf[g] * unitW + unitW / 2 + pad;
  const cy = g => (layout.maxDepth - layout.depthOf[g]) * unitH + top + pad;
  const lines = Object.keys(layout.parentOf).map(child => {
    const p = layout.parentOf[child];
    const on = need.has(child) && (need.has(p) || S.isNodeUnlocked(layout.nodeMap[p]) || S.isChecklistExcludedNode(layout.nodeMap[p]));
    return `<line class="${on ? 'on' : ''}" x1="${cx(p)}" y1="${cy(p)}" x2="${cx(child)}" y2="${cy(child)}"/>`;
  }).join('');
  const nodes = spirit.nodes.filter(n => n.guid in layout.xOf).map(n =>
    nodeHtml(S, spirit, n, stateOf(n), `position:absolute;left:${cx(n.guid) - unitW / 2}px;top:${cy(n.guid) - 22}px;width:${unitW}px;`)).join('');
  return `<div class="wp-tp-scroll"><div class="wp-tp-canvas" style="width:${width}px;height:${height}px;"><svg class="wp-tp-lines" width="${width}" height="${height}" aria-hidden="true">${lines}</svg>${nodes}</div></div>`;
}

/** 選ぶ画面の合計の欄 */
function totalHtml(S, spirit, targets) {
  const plan = planNodes(S, spirit, targets);
  if (!plan.targets.length) return `<p class="wp-tp-total">${t('欲しいアイテムを押して選んでください。そこまでの通り道（祝福など）は自動で入ります。', 'Tap the items you want. The nodes on the way are added automatically.')}</p>`;
  const path = costText(plan.pathCost);
  return `<p class="wp-tp-total"><b>${escapeHtml(costText(plan.cost) || t('交換するものはありません', 'Nothing to pay'))}</b>
    <span>${t(`選んだもの ${plan.targets.length}件・通り道 ${plan.nodes.length - plan.targets.length}件`, `${plan.targets.length} picked · ${plan.nodes.length - plan.targets.length} on the way`)}${path ? t(`（通り道のぶん: ${path}）`, ` (on the way: ${path})`) : ''}</span></p>`;
}

/** 選ぶ画面全体。pick = { step: 'spirit'|'tree', q, guid, targets:Set } */
export function pickerHtml(S, pick) {
  if (pick.step === 'tree') {
    const spirit = S.spiritByGuid[pick.guid];
    const leftAll = spirit.nodes.filter(n => !S.isChecklistExcludedNode(n) && !S.isNodeUnlocked(n)).length;
    return `<section class="wp-treepick" data-tp>
      <div class="wp-tp-head">
        <button type="button" class="fun-icon-btn" data-act="tp-back" aria-label="${t('精霊を選び直す', 'Back to spirits')}">${svgIcon('i-chevron-left', 16)}</button>
        <span class="wp-thumb">${spirit.imageUrl ? `<img src="${escapeHtml(spiritThumb(spirit))}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span>
        <h2 class="wp-tp-title">${escapeHtml(S.spiritName(spirit))}<small>${t('欲しいアイテムを押して選ぶ', 'Tap the items you want')}</small></h2>
      </div>
      <div class="wp-tp-legend"><span class="lg-target">${t('欲しい', 'Wanted')}</span><span class="lg-path">${t('通り道', 'On the way')}</span><span class="lg-owned">${t('解放済み', 'Unlocked')}</span></div>
      ${leftAll ? treeHtml(S, spirit, pick.targets) : `<p class="fun-hint">${t('この精霊のツリーはすべて解放済みです。', 'This tree is already complete.')}</p>`}
      ${totalHtml(S, spirit, pick.targets)}
      <div class="wp-tp-actions">
        ${leftAll ? `<button type="button" class="fun-btn small" data-act="tp-all">${t('まだのもの全部', 'Everything left')}</button><button type="button" class="fun-btn small" data-act="tp-none">${t('選択を外す', 'Clear')}</button>` : ''}
        <span class="wp-tp-spacer"></span>
        <button type="button" class="fun-btn small" data-act="tp-close">${t('やめる', 'Cancel')}</button>
        <button type="button" class="fun-btn small primary" data-act="tp-save">${t('計画に入れる', 'Add to plan')}</button>
      </div>
    </section>`;
  }
  return `<section class="wp-treepick" data-tp>
    <div class="wp-tp-head">
      <h2 class="wp-tp-title">${t('精霊のツリーから選ぶ', 'Pick from a spirit tree')}<small>${t('祝福（魔法）やハートなど、通り道のぶんも合わせて計算します', 'Counts the blessings and hearts on the way, too')}</small></h2>
      <button type="button" class="fun-icon-btn" data-act="tp-close" aria-label="${t('閉じる', 'Close')}">${svgIcon('i-close', 16)}</button>
    </div>
    <input class="fun-input" type="search" data-tp-q value="${escapeHtml(pick.q)}" placeholder="${t('精霊の名前でさがす（ひらがなでも）', 'Search spirits by name')}" aria-label="${t('精霊の名前でさがす', 'Search spirits by name')}">
    <div class="wp-tp-results">${spiritResultsHtml(S, pick.q)}</div>
  </section>`;
}

/* ================================================================
   cost-share.js — コスト集計ページの画像共有（Xへ投稿）

   item/item_cost.html の次の4機能を移植したもの。
     1. コスト集計カード（所持済みアイテムにかかったキャンドル/星のキャンドル/
        ハート/実額） … shareCostSummary()
     2. もらったギフト一覧（「ギフトでもらった」に設定した所持済みの実額アイテム）
        … shareReceivedGifts()
     3. 課金アイテムプレゼント履歴（自分が相手に贈った記録） … shareGiftHistory()
     4. 今月/今年の支出振り返り … shareCostRecap()
   画像の生成→（スマホは）Web Share→プレビュー＋Xの投稿画面ボタン、という流れは
   share/share-data.js の exportShareImage() が担う（元実装の
   exportElementAsImage と同一）。

   このファイルは「画面に出ている集計値・一覧データ」を引数で受け取って
   カードに起こすだけで、集計ロジック自体はcost-view.js側にある
   （数値の食い違いが起きないよう、集計を二重に持たない）。
   画像カードの色はハブのテーマ(ダーク)に左右されないようすべてリテラル値。
   ================================================================ */

import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import {
  SHARE_THEMES, SITE_URL, COST_SHARE_HASHTAG, exportShareImage, injectShareSharedStyles, showShareToast,
} from './share/share-data.js';

const STYLE_ID = 'item-cost-share-styles';
const MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const SVG_ATTR = 'width="20" height="20" viewBox="0 0 24 24" style="stroke:#FF6200;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"';
const ICON_COIN = '<path d="M12 5.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z"/><path d="M9.5 9.5h5M9.5 12h5M12 9v6"/>';
const ICON_CANDLE = '<path d="M9.5 21h5a1 1 0 0 0 1-1v-7.5a3 3 0 0 0-3-3h-1a3 3 0 0 0-3 3V20a1 1 0 0 0 1 1Z"/><path d="M12 9.5V5M10.3 5.2C10.3 3.7 12 3.5 12 2c0 1.5 1.7 1.7 1.7 3.2 0 .9-.75 1.3-1.7 1.3s-1.7-.4-1.7-1.3Z"/>';
const ICON_STAR = '<path d="M12 3.5l2.5 5.6 6.1.6-4.6 4.1 1.3 6-5.3-3.2-5.3 3.2 1.3-6-4.6-4.1 6.1-.6Z"/>';
const ICON_HEART = '<path d="M12 20.5c-5-3.5-9-7-9-11.2C3 6 5 4 7.7 4c1.7 0 3.3.9 4.3 2.4C13 4.9 14.6 4 16.3 4 19 4 21 6 21 9.3c0 4.2-4 7.7-9 11.2Z"/>';
const ICON_GIFT = '<path d="M4 9h16v3H4Z"/><path d="M5 12h14v8H5Z"/><path d="M12 9v11"/><path d="M9 9c-1.3 0-2.3-.9-2.3-2S7.7 5 9 5c1.3 0 3 1.7 3 4M15 9c1.3 0 2.3-.9 2.3-2S16.3 5 15 5c-1.3 0-3 1.7-3 4"/>';
const svg = path => `<svg ${SVG_ATTR}>${path}</svg>`;
const svgSmall = path => `<svg width="18" height="18" viewBox="0 0 24 24" style="stroke:#FF6200;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round">${path}</svg>`;

export const COST_ICONS = { coin: ICON_COIN, candle: ICON_CANDLE, star: ICON_STAR, heart: ICON_HEART, gift: ICON_GIFT };

function t(ja, en) { return CURRENT_LANG === 'en' ? en : ja; }

function brandHtml() {
  return `<div class="ish-exp-brand"><svg width="13" height="13" viewBox="0 0 24 24" style="stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-2px;margin-right:3px">${ICON_COIN}</svg>${t('アイテム別コスト管理', 'Item Cost Tracker')}</div>`;
}
function dateHtml() {
  const d = new Date();
  const txt = CURRENT_LANG === 'en'
    ? `Created ${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
    : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日作成`;
  return `<div class="ish-exp-date">${txt}</div>`;
}
function newCard(inner) {
  const card = document.createElement('div');
  card.className = 'ish-export-card';
  card.style.background = SHARE_THEMES.orange.grad;
  card.innerHTML = inner;
  document.body.appendChild(card);
  return card;
}
function prep() {
  injectShareSharedStyles();
  injectStyles();
}
function share(buildFn, filenameBase, shareText) {
  prep();
  return exportShareImage(buildFn, filenameBase, {
    shareText,
    successToast: t('共有しました！', 'Shared!'),
  });
}
function iconCell(img, fallbackPath) {
  return img
    ? `<img src="${img}" alt="" referrerpolicy="no-referrer">`
    : svgSmall(fallbackPath || ICON_GIFT);
}

/* ── 1. コスト集計カード ── */
// vals: { owned, total, candle, starCandle, heart, money }（画面に出ている文字列をそのまま渡す）、giftMoney: 別枠表示するプレゼント分（無ければnull）
export function shareCostSummary(vals, giftMoney) {
  const cell = (path, val, label) => `
      <div class="ish-exp-cat-cell">
        <div class="ish-exp-cat-cell-icon">${svg(path)}</div>
        <div class="ish-exp-cat-cell-pct">${escapeHtml(val)}</div>
        <div class="ish-exp-cat-cell-name">${label}</div>
      </div>`;
  const build = () => newCard(`
    ${brandHtml()}
    <div class="ish-exp-hero">
      <div class="ish-exp-hero-label">${t('所持済みアイテムにかかったコスト（全カテゴリ）', 'Cost of owned items (all categories)')}</div>
      <div class="cst-hero-count">${t(`所持済み ${vals.owned} / ${vals.total} 件`, `${vals.owned} / ${vals.total} items owned`)}</div>
    </div>
    <div class="ish-exp-cat-grid cst-grid-2">
      ${cell(ICON_CANDLE, vals.candle, t('キャンドル', 'Candles'))}
      ${cell(ICON_STAR, vals.starCandle, t('星のキャンドル', 'Season Candles'))}
      ${cell(ICON_HEART, vals.heart, t('ハート', 'Hearts'))}
      ${cell(ICON_COIN, vals.money, t('実額', 'Real Money'))}
    </div>
    ${giftMoney ? `<div class="ish-exp-comment" style="margin-top:12px; margin-bottom:0;"><svg width="14" height="14" viewBox="0 0 24 24" style="stroke:#fff;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-2px">${ICON_GIFT}</svg> ${t('プレゼント分（実額とは別）', 'Gift purchases (shown separately)')}: ${escapeHtml(giftMoney)}</div>` : ''}
    ${dateHtml()}`);
  const text = t(`Skyのアイテム収集にかかったコストはこちら！\n\n${SITE_URL}\n${COST_SHARE_HASHTAG}`,
    `Here's my Sky item collection cost so far!\n\n${SITE_URL}\n${COST_SHARE_HASHTAG}`);
  return share(build, t('アイテム別コスト', 'Item Cost'), text);
}

/* ── 共通: 行リスト＋合計のカード ── */
function listCard(title, rows, emptyMsg, totalLabel, totalYen) {
  return newCard(`
    ${brandHtml()}
    <div class="ish-exp-title">${escapeHtml(title)}</div>
    <div class="ish-exp-body">${rows || `<div class="cst-empty-list">${emptyMsg}</div>`}</div>
    ${rows ? `
    <div class="cst-total-row">
      <span class="cst-total-label">${totalLabel}</span>
      <span class="cst-total-value">¥${totalYen.toLocaleString()}</span>
    </div>` : ''}
    ${dateHtml()}`);
}
function rowHtml({ img, fallback, cat, name, costText }) {
  return `
      <div class="ish-exp-row">
        <div class="ish-exp-icon">${iconCell(img, fallback)}</div>
        <div class="ish-exp-info">
          <div class="ish-exp-cat">${escapeHtml(cat)}</div>
          <div class="ish-exp-name">${escapeHtml(name)}</div>
        </div>
        <div class="cst-exp-cost">${escapeHtml(costText)}</div>
      </div>`;
}

/* ── 2. もらったギフト一覧 ── items: [{ img, catLabel, name, yen }] ── */
export function shareReceivedGifts(items) {
  const total = items.reduce((s, it) => s + (it.yen || 0), 0);
  const build = () => listCard(
    t('ギフトでもらったアイテム', 'Items Received as Gifts'),
    items.map(it => rowHtml({ img: it.img, cat: it.catLabel, name: it.name, costText: `¥${it.yen.toLocaleString()}` })).join(''),
    t('まだ「ギフトでもらった」に設定したアイテムがありません。', 'No items marked "Received as a gift" yet.'),
    t(`${items.length}件`, `${items.length} item(s)`), total);
  const text = t(`ギフトでもらったアイテムはこちら！\n\n${SITE_URL}\n${COST_SHARE_HASHTAG}`,
    `Here are the items I've received as gifts!\n\n${SITE_URL}\n${COST_SHARE_HASHTAG}`);
  return share(build, t('もらったギフト', 'Gifts Received'), text);
}

/* ── 3. プレゼント履歴 ── rows: [{ img, sub, name, yen|null }]（新しい順で渡す） ── */
export function shareGiftHistory(rows) {
  const total = rows.reduce((s, r) => s + (typeof r.yen === 'number' ? r.yen : 0), 0);
  const build = () => listCard(
    t('課金アイテムプレゼント履歴', 'Gift Purchase History'),
    rows.map(r => rowHtml({
      img: r.img, cat: r.sub || t('相手・日付未記入', 'No recipient/date recorded'), name: r.name,
      costText: typeof r.yen === 'number' ? `¥${r.yen.toLocaleString()}` : t('データなし', 'No data'),
    })).join(''),
    t('まだ記録がありません。', 'No gift purchases recorded yet.'),
    t(`${rows.length}件`, `${rows.length} gift(s)`), total);
  const text = t(`プレゼントしたアイテムの履歴はこちら！\n\n${SITE_URL}\n${COST_SHARE_HASHTAG}`,
    `Here's my history of gift items I've sent!\n\n${SITE_URL}\n${COST_SHARE_HASHTAG}`);
  return share(build, t('プレゼント履歴', 'Gift History'), text);
}

/* ── 4. 今月/今年の支出振り返り ── entries: [{ name, catLabel, img, fallback, yen, at }]（at=ミリ秒、新しい順） ── */
export function shareCostRecap(scope, entries) {
  const total = entries.reduce((s, e) => s + e.yen, 0);
  if (total === 0) {
    showShareToast(t('この期間の支出記録がまだありません', 'No spending recorded in this period yet'));
    return Promise.resolve();
  }
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const periodTxt = scope === 'year'
    ? t(`${year}年`, `${year}`)
    : t(`${year}年${month + 1}月`, `${MONTH_EN[month]} ${year}`);
  const labelTxt = scope === 'year' ? t('今年使った実額', 'Real-Money Spent This Year') : t('今月使った実額', 'Real-Money Spent This Month');
  const recent = entries.slice(0, 5);
  const build = () => newCard(`
    ${brandHtml()}
    <div class="ish-exp-hero">
      <div class="ish-exp-hero-pct">¥${total.toLocaleString()}</div>
      <div class="ish-exp-hero-label">${labelTxt}</div>
      <div class="ish-exp-hero-nums">${escapeHtml(periodTxt)}</div>
    </div>
    <div class="ish-exp-body">${recent.map(e => rowHtml({ img: e.img, fallback: e.fallback, cat: e.catLabel, name: e.name, costText: `¥${e.yen.toLocaleString()}` })).join('')}</div>
    ${dateHtml()}`);
  const periodWord = scope === 'year'
    ? t(`${year}年は`, `in ${year}`)
    : t(`${year}年${month + 1}月は`, `in ${MONTH_EN[month]} ${year}`);
  const text = t(`${periodWord}Skyのアイテムに¥${total.toLocaleString()}使いました！\nあなたはいくら使った？\n\n${SITE_URL}\n${COST_SHARE_HASHTAG}`,
    `I spent ¥${total.toLocaleString()} on Sky items ${periodWord}!\nHow much did you spend?\n\n${SITE_URL}\n${COST_SHARE_HASHTAG}`);
  return share(build, scope === 'year' ? t('年間コスト振り返り', 'Yearly Cost Recap') : t('月間コスト振り返り', 'Monthly Cost Recap'), text);
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.cst-grid-2 { grid-template-columns: repeat(2, 1fr); }
.cst-hero-count { color: rgba(255,255,255,0.75); font-size: 12.5px; margin-top: 4px; }
.cst-exp-cost { font-size: 12.5px; font-weight: 700; color: #FF6200; white-space: nowrap; flex-shrink: 0; }
.cst-empty-list { text-align: center; color: #8E8E93; font-size: 12.5px; padding: 20px 0; }
.cst-total-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 4px 0; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.3); }
.cst-total-label { color: rgba(255,255,255,0.9); font-size: 12.5px; }
.cst-total-value { color: #fff; font-size: 16px; font-weight: 800; }
`;
  document.head.appendChild(style);
}

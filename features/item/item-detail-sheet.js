/* ================================================================
   🔎 アイテムの詳細シート（2026-11-12）。
   アイテム所持管理のカテゴリ一覧・全アイテム一覧で、アイテム名を押すと開く。
   ・画像・名前・登場元・価格（features/item/data/cost-data.js）・所持の状態を出す。
   ・未所持なら「ほしいもの計画に追加」。保存先はアイテム所持管理の欲しいもの（wish_<cat>）で、
     ほしいもの計画（features/wish-plan/）はこれを読む＝新しい保存先は作らない。登録済みなら
     その旨と「ほしいもの計画を開く」を出し、二重には登録しない。
   ・キャンドル・ハートで交換するものは、ほしいもの計画の所持数（wishOwnCurrency）と比べて不足分を出す。
   ・以前は名前を押すと「名前＋Sky」をGoogleで検索していた。その操作はシートの中のボタンに移した。
   ・シートは他と同じ .modal-overlay ＋ .modal-card（全幅のボトムシート。下へ引いて閉じられる＝js/sheet-engine.js）。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { nsKey, isWishItem, toggleWishItem, getCategoryState } from '../../js/state.js';
import { navigate } from '../../js/router.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
const OVERLAY_ID = 'itemDetailOverlay';
const STYLE_ID = 'item-detail-sheet-styles';
let costCache = null;

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement('style');
  st.id = STYLE_ID;
  st.textContent = `
.ids-head { display: flex; gap: 14px; align-items: center; margin: 4px 0 14px; }
.ids-img { flex-shrink: 0; width: 72px; height: 72px; border-radius: 14px; background: var(--hub-bg); display: flex; align-items: center; justify-content: center; overflow: hidden; }
.ids-img img { width: 100%; height: 100%; object-fit: contain; }
.ids-name { margin: 0; font-size: 18px; font-weight: 700; line-height: 1.3; letter-spacing: -0.01em; color: var(--hub-text); }
.ids-sub { margin: 4px 0 0; font-size: 12.5px; color: var(--hub-text-2); }
.ids-rows { border-radius: 12px; background: var(--hub-bg); padding: 2px 12px; margin-bottom: 14px; }
.ids-row { display: flex; justify-content: space-between; gap: 10px; padding: 9px 0; font-size: 13.5px; color: var(--hub-text); }
.ids-row + .ids-row { border-top: 0.5px solid var(--hub-sep); }
.ids-row span:first-child { color: var(--hub-text-2); }
.ids-row b { font-weight: 600; text-align: right; }
.ids-short { font-size: 12.5px; color: var(--hub-text-2); margin: -6px 2px 14px; }
.ids-short.is-ok { color: var(--hub-accent-ink, var(--hub-accent)); }
.ids-actions { display: flex; flex-direction: column; gap: 8px; }
.ids-btn { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; min-height: 44px; padding: 10px 14px; border: 0; border-radius: 12px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; }
.ids-btn:active { transform: scale(0.98); }
.ids-btn.is-primary { background: var(--hub-accent); color: #fff; }
.ids-btn.is-plain { background: var(--hub-bg); color: var(--hub-text); }
.ids-btn.is-done { background: var(--hub-accent-bg); color: var(--hub-accent-ink, var(--hub-accent)); }
.ids-note { margin: 0 2px; font-size: 12.5px; color: var(--hub-text-2); text-align: center; }
@media (prefers-reduced-motion: reduce) { .ids-btn:active { transform: none; } }
@media (prefers-contrast: more) { .ids-rows, .ids-btn.is-plain { outline: 1px solid var(--hub-text-2); } }
`;
  document.head.appendChild(st);
}

async function costEntry(catKey, id) {
  try {
    if (!costCache) costCache = (await import('./data/cost-data.js')).ITEM_COST_DATA;
    return (costCache[catKey] || []).find(x => x.id === id) || null;
  } catch (e) { return null; }
}
function priceLabel(c) {
  if (!c) return t('不明', 'Unknown');
  if (c.type === 'candle') return t(`キャンドル ${c.value}`, `${c.value} candles`);
  if (c.type === 'heart') return t(`ハート ${c.value}`, `${c.value} hearts`);
  if (c.type === 'starCandle') return t(`星のキャンドル ${c.value}`, `${c.value} ascended candles`);
  if (c.type === 'seasonCandle') return t(`季節キャンドル ${c.value}`, `${c.value} season candles`);
  if (c.type === 'money') return c.value ? t(`課金 ${Number(c.value).toLocaleString()}円`, `Paid ¥${Number(c.value).toLocaleString()}`) : t('課金', 'Paid');
  if (c.type === 'ticket') return t('チケット', 'Tickets');
  if (c.type === 'reward') return t('報酬', 'Reward');
  if (c.type === 'free') return t('無料', 'Free');
  if (c.type === 'na') return t('交換なし', 'Not purchasable');
  return t('不明', 'Unknown');
}
function ownCurrency() {
  try {
    const c = JSON.parse(localStorage.getItem(nsKey('wishOwnCurrency'))) || {};
    return { candle: Math.max(0, Number(c.candle) || 0), heart: Math.max(0, Number(c.heart) || 0) };
  } catch (e) { return { candle: 0, heart: 0 }; }
}
// キャンドル・ハートの不足分（それ以外の価格は出さない）
function shortageHtml(c) {
  if (!c || !c.value || (c.type !== 'candle' && c.type !== 'heart')) return '';
  const own = ownCurrency()[c.type];
  const unit = c.type === 'candle' ? t('キャンドル', 'candles') : t('ハート', 'hearts');
  if (own >= c.value) return `<p class="ids-short is-ok">${t(`今の${unit}（${own}）で足ります`, `You have enough ${unit} (${own})`)}</p>`;
  return `<p class="ids-short">${t(`あと${unit} ${c.value - own}（今の所持 ${own}）`, `${c.value - own} more ${unit} needed (you have ${own})`)}</p>`;
}

/**
 * 詳細シートを開く。item はアイテムのデータ（id・name・nameEn・event・img）、label は表示名、eventLabel は登場元の表示名。
 * onChange は所持・欲しいものが変わった時に呼ぶ（一覧の見た目を合わせるため）
 */
export async function openItemDetail({ catKey, item, label, eventLabel, imgSrc, onChange }) {
  injectStyles();
  document.getElementById(OVERLAY_ID)?.remove();
  const id = String(item.id);
  const entry = await costEntry(catKey, id);
  const cost = entry && entry.cost;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = OVERLAY_ID;
  overlay.innerHTML = '<div class="modal-card ids-card" role="dialog" aria-modal="true" aria-labelledby="idsName"></div>';
  const card = overlay.firstElementChild;
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(label + '　Sky')}`;

  const render = () => {
    const owned = !!getCategoryState(catKey).owned[id];
    const wish = isWishItem(catKey, id);
    let action;
    if (owned) action = `<p class="ids-note">${t('所持しています', 'You own this item')}</p>`;
    else if (wish) action = `<button type="button" class="ids-btn is-done" data-act="open-plan">${t('ほしいもの計画に入っています・開く', 'In your Wishlist Plan · Open')}</button>`;
    else action = `<button type="button" class="ids-btn is-primary" data-act="add"><svg class="inline-icon" width="16" height="16" aria-hidden="true"><use href="#i-cart"/></svg>${t('ほしいもの計画に追加', 'Add to Wishlist Plan')}</button>`;
    card.innerHTML = `
      <button type="button" class="modal-close-btn" data-act="close" aria-label="${t('閉じる', 'Close')}"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      <div class="ids-head">
        <div class="ids-img">${imgSrc ? `<img src="${escapeHtml(imgSrc)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</div>
        <div><h2 class="ids-name" id="idsName">${escapeHtml(label)}</h2>${eventLabel ? `<p class="ids-sub">${escapeHtml(eventLabel)}</p>` : ''}</div>
      </div>
      <div class="ids-rows">
        <div class="ids-row"><span>${t('価格', 'Price')}</span><b>${escapeHtml(priceLabel(cost))}</b></div>
        <div class="ids-row"><span>${t('所持', 'Owned')}</span><b>${owned ? t('所持', 'Yes') : t('未所持', 'No')}</b></div>
      </div>
      ${owned ? '' : shortageHtml(cost)}
      <div class="ids-actions">
        ${action}
        <a class="ids-btn is-plain" href="${searchUrl}" target="_blank" rel="noopener noreferrer">${t('「名前＋Sky」で検索', 'Search the web')}</a>
      </div>`;
  };
  render();

  const close = () => { overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 250); };
  overlay.addEventListener('click', e => {
    if (e.target === overlay) { close(); return; }
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'close') close();
    else if (act === 'open-plan') { close(); navigate('wish-plan'); }
    else if (act === 'add') {
      // 押した後に他の画面で登録された場合も、二重には入れない
      if (isWishItem(catKey, id)) { toast(t('すでにほしいもの計画に入っています', 'Already in your Wishlist Plan')); render(); return; }
      const added = toggleWishItem(catKey, id);
      if (added === null) { toast(t('所持済みのアイテムは追加できません', 'Owned items cannot be added')); return; }
      toast(t('ほしいもの計画に追加しました', 'Added to your Wishlist Plan'));
      render();
      if (onChange) onChange();
    }
  });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
}

function toast(msg) {
  import('./category-view.js').then(m => m.showCatViewToast(msg)).catch(() => {});
}

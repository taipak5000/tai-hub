/* ================================================================
   🔔 お知らせシート（ドックの「お知らせ」ボタンから開く）。中身は js/notices.js が集める。
   開いた時点で並んでいるお知らせを既読にする（ドックのバッジが消える）。
   未読だったものには小さな点を付けて、今回新しく届いたものが分かるようにする。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../i18n.js';
import { navigate } from '../router.js';
import { collectNotices, markSeen, isSeen } from '../notices.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
let overlayEl = null;

const ITEM_CATS = ['cape', 'mask', 'necklace', 'hairstyle', 'hair_accessory', 'head_accessory', 'outfit', 'shoes', 'face_accessory', 'portable_item', 'large_placeable', 'small_placeable'];

export function open() {
  document.getElementById('noticeModalOverlay')?.remove();
  const list = collectNotices();
  const unseen = new Set(list.filter(n => !isSeen(n.id)).map(n => n.id));
  overlayEl = document.createElement('div');
  overlayEl.className = 'modal-overlay';
  overlayEl.id = 'noticeModalOverlay';
  overlayEl.addEventListener('click', e => { if (e.target === overlayEl) close(); });
  overlayEl.innerHTML = `
    <div class="modal-card notice-card" role="dialog" aria-modal="true" aria-labelledby="noticeTitle">
      <button type="button" class="modal-close-btn" id="noticeCloseBtn" aria-label="${t('閉じる', 'Close')}"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      <div class="modal-title" id="noticeTitle">${t('お知らせ', 'Notices')}</div>
      ${list.length ? `<ul class="notice-list">${list.map(n => itemHtml(n, unseen.has(n.id))).join('')}</ul>`
        : `<div class="notice-empty"><svg class="inline-icon" width="34" height="34"><use href="#i-bell"/></svg><p>${t('いまはお知らせがありません', 'No notices right now')}</p><p class="notice-empty-sub">${t('旅の精霊の来訪、季節やイベントの終わり、フレンドの記念日などをここでお知らせします', 'Traveling spirits, season and event deadlines, and friend anniversaries show up here.')}</p></div>`}
    </div>`;
  document.body.appendChild(overlayEl);
  overlayEl.querySelector('#noticeCloseBtn').addEventListener('click', close);
  overlayEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-notice-route]');
    if (!btn) return;
    close();
    navigate(btn.dataset.noticeRoute, btn.dataset.noticeSub || '');
  });
  requestAnimationFrame(() => overlayEl && overlayEl.classList.add('open'));
  if (list.length) markSeen(list.map(n => n.id));
  fillWishNames(list);
}

export function close() {
  overlayEl?.classList.remove('open');
}

function itemHtml(n, isNew) {
  const lines = String(n.body || '').split('\n').map(escapeHtml).join('<br>');
  return `<li class="notice-item tone-${n.tone}${isNew ? ' is-new' : ''}">
    <span class="notice-ic"><svg class="inline-icon" width="18" height="18"><use href="#${n.icon}"/></svg></span>
    <div class="notice-main">
      <div class="notice-title">${isNew ? `<span class="notice-dot" aria-label="${t('新着', 'New')}"></span>` : ''}${escapeHtml(n.title)}</div>
      <div class="notice-body">${lines}</div>
      ${n.wishItems && n.wishItems.length ? `<div class="notice-wish" data-wish='${escapeHtml(JSON.stringify(n.wishItems))}'></div>` : ''}
      ${n.route ? `<button type="button" class="notice-go" data-notice-route="${escapeHtml(n.route)}"${n.sub ? ` data-notice-sub="${escapeHtml(n.sub)}"` : ''}>${escapeHtml(n.routeLabel || t('開く', 'Open'))}<svg class="inline-icon" width="13" height="13"><use href="#i-chevron-right"/></svg></button>` : ''}
    </div>
  </li>`;
}

// 欲しいものリストのアイテム名は、該当カテゴリのデータを開いた時だけ読み込む（起動を重くしない）
async function fillWishNames(list) {
  const slots = overlayEl ? overlayEl.querySelectorAll('.notice-wish') : [];
  for (const slot of slots) {
    let items = [];
    try { items = JSON.parse(slot.dataset.wish); } catch (e) { continue; }
    const names = await Promise.all(items.map(async it => {
      if (!ITEM_CATS.includes(it.catKey)) return null;
      try {
        const mod = await import(`../../features/item/data/items/${it.catKey}.js`);
        const found = (mod.ITEMS || []).find(x => x.id === it.id);
        return found ? { name: CURRENT_LANG === 'en' ? (found.nameEn || found.name) : found.name, img: found.img } : null;
      } catch (e) { return null; }
    }));
    slot.innerHTML = names.filter(Boolean).map(x => `<span class="notice-wish-chip">${x.img ? `<img src="${escapeHtml(x.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}${escapeHtml(x.name)}</span>`).join('');
  }
}

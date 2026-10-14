/* ================================================================
   wings-share.js — 📤 達成率をXへ画像で共有（Xで画像を共有／カスタマイズして共有）

   移植元: wings/index.html の「達成率をXへ画像で共有」ブロック
   （旧実装の行4339-4446・4724-4869付近: buildOverallExportCardEl〜
   shareOverallOnTwitter、openCustomizeModal〜readShareCustomizeFromModal）。
   html2canvas（CDN）でDOM上にオフスクリーンで組み立てたカードをラスタライズ
   して画像化する方式は、features/item/share/achievement-share.js・
   share-data.js と同じ（元実装自体がこの方式だったため、同じ移植方針を踏襲）。

   ── エクスポート契約 ──────────────────────────────────────────
     export async function shareOnX() … 「Xで画像を共有」の直接トリガー
       （モーダル無し・ワンクリック。保存済みのカスタマイズ設定とは無関係に
       既定の青テーマ・コメント無しのカードを生成する）。
     export function openCustomize() … 「カスタマイズして共有」モーダルを開く
       （背景テーマ・コメントを選べる）。
     export function closeCustomize() … モーダルを閉じる。

   ── データ互換性 ──────────────────────────────────────────────
   カスタマイズ設定の保存キー wingsShareCustomize_v1・形状 {theme} は
   wings-state.js 側に既に移植済み（このファイルはそこに委譲するだけ）。
   ================================================================ */

import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { toolShareUrl } from '../../js/site-config.js';
import {
  getWingStats, SHARE_THEMES, loadShareCustomize, saveShareCustomize,
} from './wings-state.js';

function t(ja, en) { return CURRENT_LANG === 'en' ? en : ja; }

const SITE_URL = toolShareUrl('wings');
const SHARE_HASHTAG = '#Sky羽トラッカー';
const OVERLAY_ID = 'wingsShareModalOverlay';
const PREVIEW_OVERLAY_ID = 'wingsSharePreviewOverlay';

function themeLabel(key) {
  const map = {
    blue: t('ブルー', 'Blue'), orange: t('オレンジ', 'Orange'), green: t('グリーン', 'Green'),
    purple: t('パープル', 'Purple'), pink: t('ピンク', 'Pink'), dark: t('ダーク', 'Dark'),
  };
  return map[key] || key;
}

/* ================================================================
   達成率カード（DOM）の組み立て（元実装のbuildOverallExportCardElを移植）
   ================================================================ */
function buildExportCardEl(opts = {}) {
  const { totalAll, seasonFeathers, seasonSpiritsTotal, permFeathers, permTotal, capeLevel } = getWingStats();
  const theme = SHARE_THEMES[opts.theme] ? opts.theme : 'blue';
  const comment = opts.comment || '';

  const today = new Date();
  const dateTxt = t(
    `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日作成`,
    `Created ${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`,
  );

  const card = document.createElement('div');
  card.className = 'wg-export-card';
  card.style.background = SHARE_THEMES[theme].grad;
  card.innerHTML = `
    <div class="wg-exp-brand"><svg width="13" height="13" viewBox="0 0 24 24" style="vertical-align:-2px;margin-right:3px;" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(12 12) scale(1.281) translate(-10.5 -12.83)"><path d="M4 19c2-6 6-11 13-13-1 6-2 9-6 12-3 2-5 2-7 1Z"/><path d="M7 17c3-2 6-5 8-9"/></g></svg> ${t('羽トラッカー', 'Wing Tracker')}</div>
    <div class="wg-exp-hero">
      <div class="wg-exp-hero-pct">${totalAll.toLocaleString()}${CURRENT_LANG === 'en' ? '' : '<span class="wg-num-unit">枚</span>'}</div>
      <div class="wg-exp-hero-label">${t('光の翼 合計', 'Total Winged Light')}</div>
      <div class="wg-exp-hero-nums">${t(
        `季節精霊 ${seasonFeathers}/${seasonSpiritsTotal} ・ 恒常精霊 ${permFeathers}/${permTotal}`,
        `Seasonal ${seasonFeathers}/${seasonSpiritsTotal} · Regular ${permFeathers}/${permTotal}`,
      )}</div>
      <div class="wg-exp-hero-sub">${t(`ケープレベル ${capeLevel}`, `Cape Level ${capeLevel}`)}</div>
    </div>
    ${comment ? `<div class="wg-exp-comment">${escapeHtml(comment)}</div>` : ''}
    <div class="wg-exp-date">${dateTxt}</div>
  `;
  document.body.appendChild(card);
  return card;
}

let html2canvasLoading = null;
function ensureHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve();
  if (html2canvasLoading) return html2canvasLoading;
  html2canvasLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.onload = () => resolve();
    s.onerror = () => { html2canvasLoading = null; reject(new Error('html2canvas load failed')); };
    document.head.appendChild(s);
  });
  return html2canvasLoading;
}
function sanitizeFilename(str) {
  return String(str).replace(/[\\/:*?"<>|]/g, '_').trim() || 'wings';
}
function isMobileDevice() {
  if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') return navigator.userAgentData.mobile;
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPod|iPad/i.test(ua)) return true;
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return true;
  return false;
}
async function tryShareImage(canvas, filename, text) {
  if (!isMobileDevice()) return 'unsupported';
  if (!navigator.share || !navigator.canShare) return 'unsupported';
  try {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return 'unsupported';
    const file = new File([blob], filename, { type: 'image/png' });
    const shareData = text ? { files: [file], text } : { files: [file] };
    if (!navigator.canShare(shareData)) return 'unsupported';
    await navigator.share(shareData);
    return 'success';
  } catch (err) {
    if (err && err.name === 'AbortError') return 'cancelled';
    return 'unsupported';
  }
}

function showToast(msg) {
  const el = document.createElement('div');
  el.className = 'wg-toast';
  el.textContent = msg;
  const stackIndex = document.querySelectorAll('.wg-toast').length;
  if (stackIndex > 0) el.style.bottom = `calc(84px + env(safe-area-inset-bottom) + ${stackIndex * 44}px)`;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 1600);
}

function showImagePreview(dataUrl, filename, shareText) {
  document.getElementById(PREVIEW_OVERLAY_ID)?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = PREVIEW_OVERLAY_ID;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeImagePreview(); });
  const twitterHref = shareText ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}` : '';
  overlay.innerHTML = `
    <div class="modal-card">
      <button type="button" class="modal-close-btn" id="wgPreviewCloseBtn"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      <div class="modal-title">${shareText ? t('画像を保存してXへ投稿', 'Save Image & Post to X') : t('画像を保存', 'Save Image')}</div>
      <p class="pf-hint" style="margin-top:0;">${shareText
        ? t('① 下の「ダウンロード」で画像を保存 → ② 「Xの投稿画面を開く」を押して、保存した画像を添付して投稿してください', '① Save the image with "Download" below → ② Tap "Open X post screen" and attach the saved image to your post')
        : t('画像を長押し（PCの場合は右クリック）して「画像を保存」を選んでください', 'Press and hold the image (or right-click on PC) and choose "Save Image"')}</p>
      <img class="wg-preview-img" src="${dataUrl}" alt="${t('保存用の画像', 'Image to save')}">
      <a class="pf-add-btn" style="width:100%; box-sizing:border-box; padding:10px; display:block; text-align:center; text-decoration:none;" href="${dataUrl}" download="${escapeHtml(filename)}">${t('ダウンロード', 'Download')}</a>
      ${shareText ? `<a class="pf-add-btn" style="width:100%; box-sizing:border-box; padding:10px; display:block; text-align:center; text-decoration:none; background:#000; margin-top:8px;" href="${twitterHref}" target="_blank" rel="noopener noreferrer">${t('Xの投稿画面を開く', 'Open X post screen')}</a>` : ''}
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#wgPreviewCloseBtn').addEventListener('click', closeImagePreview);
  requestAnimationFrame(() => overlay.classList.add('open'));
}
function closeImagePreview() {
  document.getElementById(PREVIEW_OVERLAY_ID)?.classList.remove('open');
}

async function exportAsImage(buildCardFn, filenameBase, opts = {}) {
  const { shareText, successToast = t('共有しました！', 'Shared!') } = opts;
  showToast(t('画像を生成中…', 'Generating image…'));
  let card = null;
  try {
    await ensureHtml2Canvas();
    card = buildCardFn();
    const canvas = await window.html2canvas(card, { backgroundColor: null, scale: 2, useCORS: true });
    const filename = sanitizeFilename(filenameBase) + '.png';

    const shareResult = await tryShareImage(canvas, filename, shareText);
    if (shareResult === 'success') { showToast(successToast); return; }
    if (shareResult === 'cancelled') return;

    showImagePreview(canvas.toDataURL('image/png'), filename, shareText);
  } catch (err) {
    console.error('[wings-share] failed to export image', err);
    showToast(t('画像の保存に失敗しました', 'Failed to save the image'));
  } finally {
    if (card) card.remove();
  }
}

function buildTweetText(comment) {
  if (comment) return `${comment}\n\n${SITE_URL}\n${SHARE_HASHTAG}`;
  const { totalAll, capeLevel } = getWingStats();
  return t(
    `光の翼を${totalAll.toLocaleString()}枚集めました！（ケープレベル${capeLevel}）\nあなたは何枚集めてる？✨\n\n${SITE_URL}\n${SHARE_HASHTAG}`,
    `I've collected ${totalAll.toLocaleString()} Winged Light! (Cape Level ${capeLevel})\nHow many have you collected? ✨\n\n${SITE_URL}\n${SHARE_HASHTAG}`,
  );
}

/* ================================================================
   「Xで画像を共有」の直接トリガー（モーダル無し）
   ================================================================ */
export async function shareOnX() {
  return exportAsImage(() => buildExportCardEl({}), t('光の翼 合計', 'Total Winged Light'), {
    shareText: buildTweetText(''),
    successToast: t('共有しました！', 'Shared!'),
  });
}

/* ================================================================
   カスタマイズモーダル
   ================================================================ */
function renderThemeRow(overlay, selectedTheme) {
  const row = overlay.querySelector('#wgThemeRow');
  row.innerHTML = Object.keys(SHARE_THEMES).map(key => `
    <div class="wg-theme-swatch ${key === selectedTheme ? 'selected' : ''}" data-theme="${key}"
      style="background:${SHARE_THEMES[key].grad};" title="${escapeHtml(themeLabel(key))}"></div>`).join('');
}

export function openCustomize() {
  document.getElementById(OVERLAY_ID)?.remove();
  const saved = loadShareCustomize();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = OVERLAY_ID;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeCustomize(); });
  overlay.innerHTML = `
    <div class="modal-card">
      <button type="button" class="modal-close-btn" id="wgCustomizeCloseBtn"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      <div class="modal-title">${t('画像をカスタマイズ', 'Customize Image')}</div>
      <div class="wg-share-section-label">${t('背景テーマ', 'Background Theme')}</div>
      <div class="wg-theme-row" id="wgThemeRow"></div>
      <div class="wg-share-section-label">${t('コメント（任意）', 'Comment (optional)')}</div>
      <textarea id="wgCustomizeComment" class="wg-comment-input" maxlength="120" placeholder="${escapeHtml(t('例）プレイヤーネーム：〇〇（未入力の場合は通常の文言になります）', 'e.g. Player name: XX (leave blank to use the default text)'))}"></textarea>
      <button type="button" class="pf-add-btn" style="width:100%; box-sizing:border-box; padding:10px; margin-top:16px;" id="wgCustomizeShareBtn">${t('この設定でXへ画像を共有', 'Share image on X with these settings')}</button>
    </div>`;
  document.body.appendChild(overlay);
  renderThemeRow(overlay, saved.theme);
  overlay.querySelector('#wgCustomizeCloseBtn').addEventListener('click', closeCustomize);
  overlay.querySelector('#wgThemeRow').addEventListener('click', e => {
    const sw = e.target.closest('.wg-theme-swatch');
    if (!sw) return;
    overlay.querySelectorAll('.wg-theme-swatch').forEach(el => el.classList.toggle('selected', el === sw));
  });
  overlay.querySelector('#wgCustomizeShareBtn').addEventListener('click', async () => {
    const themeEl = overlay.querySelector('.wg-theme-swatch.selected');
    const theme = themeEl ? themeEl.dataset.theme : 'blue';
    const comment = overlay.querySelector('#wgCustomizeComment').value.trim();
    saveShareCustomize(theme);
    closeCustomize();
    await exportAsImage(() => buildExportCardEl({ theme, comment }), t('光の翼 合計', 'Total Winged Light'), {
      shareText: buildTweetText(comment),
      successToast: t('共有しました！', 'Shared!'),
    });
  });
  requestAnimationFrame(() => overlay.classList.add('open'));
}
export function closeCustomize() {
  document.getElementById(OVERLAY_ID)?.classList.remove('open');
}

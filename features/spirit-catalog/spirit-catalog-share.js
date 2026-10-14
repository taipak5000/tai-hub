/* ================================================================
   spirit-catalog-share.js — 📤 達成率をXへ画像で共有（Xで画像を共有／
   カスタマイズして共有）

   移植元: spirit-catalog/index.html の「達成率をXへ画像で共有」ブロック
   （buildOverallExportCardEl〜shareOverallOnTwitter、openCustomizeModal〜
   readShareCustomizeFromModal）。html2canvas（CDN）でDOM上にオフスクリーン
   で組み立てたカードをラスタライズして画像化する方式は、tai-hub内の
   features/wings/wings-share.js・features/item/share/achievement-share.js
   と同じ（元実装自体がこの方式だったため、同じ移植方針を踏襲）。

   ── エクスポート契約 ──────────────────────────────────────────
     export async function shareOnX() … 「Xで画像を共有」の直接トリガー
       （モーダル無し・ワンクリック。保存済みのカスタマイズ設定とは無関係に
       既定のグリーンテーマ・コメント無しのカードを生成する）。
     export function openCustomize() … 「カスタマイズして共有」モーダルを開く
       （背景テーマ・コメントを選べる）。
     export function closeCustomize() … モーダルを閉じる。

   ── データ互換性 ──────────────────────────────────────────────
   カスタマイズ設定の保存キー catalogShareCustomize_v1・形状 {theme} は
   spirit-catalog-state.js 側に既に移植済み（このファイルはそこに委譲する
   だけ）。元実装と同じく非namespace化（端末単位、プロフィール非依存）。

   ── wings-share.jsからの意図的な差分 ──────────────────────────
   プレビュー/カスタマイズモーダルのボタンは、wings-share.jsが使う
   .pf-add-btn/.pf-hintクラス（companion.css内で.companion-view配下にしか
   定義されておらず、document.body直下に生成するモーダルからは実質未適用に
   なっている）ではなく、css/chrome.cssでグローバルに定義済みの
   .pf-icon-btn/.pf-row-btn-okクラスを使う（他の全モーダル・トースト同様、
   このファイルもdocument.body直下に生成するため）。
   ================================================================ */

import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { toolShareUrl } from '../../js/site-config.js';
import { t } from './data/i18n-catalog.js';
import {
  getSpiritStats, SHARE_THEMES, loadShareCustomize, saveShareCustomize,
} from './spirit-catalog-state.js';

const SITE_URL = toolShareUrl('spirit-catalog');
const SHARE_HASHTAG_JA = '#Sky精霊ツリー管理';
const SHARE_HASHTAG_EN = '#SkySpiritTree';
// ツイート本文の他の部分と同じくCURRENT_LANGに応じてハッシュタグも切り替える
function shareHashtag() { return CURRENT_LANG === 'en' ? SHARE_HASHTAG_EN : SHARE_HASHTAG_JA; }

const OVERLAY_ID = 'scShareCustomizeOverlay';
const PREVIEW_OVERLAY_ID = 'scSharePreviewOverlay';

function formatPct(pct) {
  if (pct <= 0) return '0%';
  if (pct >= 100) return '100%';
  return pct.toFixed(1) + '%';
}
function themeLabel(key) { return t('theme.' + key); }

/* ================================================================
   達成率カード（DOM）の組み立て（元実装のbuildOverallExportCardElを移植）
   ================================================================ */
function buildExportCardEl(opts = {}) {
  const { doneNodes, totalNodes, completeSpirits, totalSpirits, pct } = getSpiritStats();
  const pctTxt = formatPct(pct);
  const theme = SHARE_THEMES[opts.theme] ? opts.theme : 'green';
  const comment = opts.comment || '';

  const today = new Date();
  const dateTxt = t('exportCard.dateTemplate', { y: today.getFullYear(), m: today.getMonth() + 1, d: today.getDate() });

  const card = document.createElement('div');
  card.className = 'sc-export-card';
  card.style.background = SHARE_THEMES[theme].grad;
  card.innerHTML = `
    <div class="sc-exp-brand"><svg width="12" height="12" viewBox="0 0 24 24" style="stroke:#fff; fill:none; stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round; vertical-align:-2px;"><path d="M12 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z"/><path d="M12 16v5"/></svg> ${escapeHtml(t('exportCard.brand'))}</div>
    <div class="sc-exp-hero">
      <div class="sc-exp-hero-pct">${pctTxt}</div>
      <div class="sc-exp-hero-label">${escapeHtml(t('exportCard.heroLabel'))}</div>
      <div class="sc-exp-hero-nums">${escapeHtml(t('exportCard.numsTemplate', { done: doneNodes, total: totalNodes }))}</div>
      <div class="sc-exp-hero-sub">${escapeHtml(t('exportCard.subTemplate', { complete: completeSpirits, totalSpirits }))}</div>
    </div>
    ${comment ? `<div class="sc-exp-comment">${escapeHtml(comment)}</div>` : ''}
    <div class="sc-exp-date">${escapeHtml(dateTxt)}</div>
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
  return String(str).replace(/[\\/:*?"<>|]/g, '_').trim() || 'spirit-catalog';
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
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
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
  el.className = 'sc-share-toast';
  el.textContent = msg;
  const stackIndex = document.querySelectorAll('.sc-share-toast').length;
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
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeImagePreview(); });
  const twitterHref = shareText ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}` : '';
  overlay.innerHTML = `
    <div class="modal-card">
      <button type="button" class="modal-close-btn" id="scPreviewCloseBtn"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      <div class="modal-title">${shareText ? escapeHtml(t('preview.titleSaveShare')) : escapeHtml(t('preview.titleSave'))}</div>
      <p class="sc-share-hint">${shareText ? escapeHtml(t('preview.hintSaveShare')) : escapeHtml(t('preview.hintSave'))}</p>
      <img class="sc-preview-img" src="${dataUrl}" alt="${escapeHtml(t('preview.imgAlt'))}">
      <a class="pf-icon-btn pf-row-btn-ok" style="width:100%; box-sizing:border-box; padding:10px; display:block; text-align:center; text-decoration:none;" href="${dataUrl}" download="${escapeHtml(filename)}">${escapeHtml(t('preview.downloadBtn'))}</a>
      ${shareText ? `<a class="pf-icon-btn" style="width:100%; box-sizing:border-box; padding:10px; display:block; text-align:center; text-decoration:none; background:#000; color:#fff; margin-top:8px;" href="${twitterHref}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('preview.twitterBtn'))}</a>` : ''}
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#scPreviewCloseBtn').addEventListener('click', closeImagePreview);
  requestAnimationFrame(() => overlay.classList.add('open'));
}
function closeImagePreview() {
  document.getElementById(PREVIEW_OVERLAY_ID)?.classList.remove('open');
}

async function exportAsImage(buildCardFn, filenameBase, opts = {}) {
  const { shareText, successToast = t('toast.shared') } = opts;
  showToast(t('toast.generating'));
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
    console.error('[spirit-catalog-share] failed to export image', err);
    showToast(t('toast.saveFailed'));
  } finally {
    if (card) card.remove();
  }
}

function buildTweetText(comment) {
  if (comment) return `${comment}\n\n${SITE_URL}\n${shareHashtag()}`;
  const { doneNodes, totalNodes, pct } = getSpiritStats();
  return t('tweet.template', { pct: formatPct(pct), done: doneNodes, total: totalNodes, url: SITE_URL, hashtag: shareHashtag() });
}

/* ================================================================
   「Xで画像を共有」の直接トリガー（モーダル無し）
   ================================================================ */
export async function shareOnX() {
  if (getSpiritStats().totalNodes === 0) { showToast(t('toast.dataLoading')); return; }
  return exportAsImage(() => buildExportCardEl({}), t('exportCard.heroLabel'), {
    shareText: buildTweetText(''),
    successToast: t('toast.shared'),
  });
}

/* ================================================================
   カスタマイズモーダル
   ================================================================ */
function renderThemeRow(overlay, selectedTheme) {
  const row = overlay.querySelector('#scThemeRow');
  row.innerHTML = Object.keys(SHARE_THEMES).map((key) => `
    <div class="sc-theme-swatch ${key === selectedTheme ? 'selected' : ''}" data-theme="${key}"
      style="background:${SHARE_THEMES[key].grad};" title="${escapeHtml(themeLabel(key))}"></div>`).join('');
}

export function openCustomize() {
  document.getElementById(OVERLAY_ID)?.remove();
  const saved = loadShareCustomize();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = OVERLAY_ID;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeCustomize(); });
  overlay.innerHTML = `
    <div class="modal-card">
      <button type="button" class="modal-close-btn" id="scCustomizeCloseBtn"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      <div class="modal-title">${escapeHtml(t('customize.modalTitle'))}</div>
      <div class="sc-share-section-label">${escapeHtml(t('customize.themeLabel'))}</div>
      <div class="sc-theme-row" id="scThemeRow"></div>
      <div class="sc-share-section-label">${escapeHtml(t('customize.commentLabel'))}</div>
      <textarea id="scCustomizeComment" class="sc-comment-input" maxlength="120" placeholder="${escapeHtml(t('customize.commentPlaceholder'))}"></textarea>
      <button type="button" class="pf-icon-btn pf-row-btn-ok" style="width:100%; box-sizing:border-box; padding:10px; margin-top:16px;" id="scCustomizeShareBtn">${escapeHtml(t('customize.shareBtn'))}</button>
    </div>`;
  document.body.appendChild(overlay);
  renderThemeRow(overlay, saved.theme);
  overlay.querySelector('#scCustomizeCloseBtn').addEventListener('click', closeCustomize);
  overlay.querySelector('#scThemeRow').addEventListener('click', (e) => {
    const sw = e.target.closest('.sc-theme-swatch');
    if (!sw) return;
    overlay.querySelectorAll('.sc-theme-swatch').forEach((el) => el.classList.toggle('selected', el === sw));
  });
  overlay.querySelector('#scCustomizeShareBtn').addEventListener('click', async () => {
    if (getSpiritStats().totalNodes === 0) { showToast(t('toast.dataLoading')); return; }
    const themeEl = overlay.querySelector('.sc-theme-swatch.selected');
    const theme = themeEl ? themeEl.dataset.theme : 'green';
    const comment = overlay.querySelector('#scCustomizeComment').value.trim();
    saveShareCustomize(theme);
    closeCustomize();
    await exportAsImage(() => buildExportCardEl({ theme, comment }), t('exportCard.heroLabel'), {
      shareText: buildTweetText(comment),
      successToast: t('toast.shared'),
    });
  });
  requestAnimationFrame(() => overlay.classList.add('open'));
}
export function closeCustomize() {
  document.getElementById(OVERLAY_ID)?.classList.remove('open');
}

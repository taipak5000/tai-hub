/* ================================================================
   デイリーチェックシートの画像保存・共有。
   チェックの付いていない（配布用の）シートを画面外に組み立て、html2canvas（CDN。wings-share.js と同じ版）で
   PNGにする。画像の下端にはサイトのURLを小さく入れる。
   スマホは共有シート（navigator.share）で、そうでなければプレビューを出して「画像を保存」とXへの投稿を選べる。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { HUB_BASE_URL } from '../../js/site-config.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
const H2C_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
const SITE_LABEL = HUB_BASE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');

let h2cLoading = null;
function ensureHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve();
  if (h2cLoading) return h2cLoading;
  h2cLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = H2C_URL;
    s.onload = () => resolve();
    s.onerror = () => { h2cLoading = null; reject(new Error('html2canvas load failed')); };
    document.head.appendChild(s);
  });
  return h2cLoading;
}

function isMobileDevice() {
  if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') return navigator.userAgentData.mobile;
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPod|iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}
function safeFilename(str) { return String(str).replace(/[\\/:*?"<>|]/g, '_').trim() || 'daily-check'; }

/**
 * root: .daily-check-view（シートのスタイルが効く場所）。paperHtml: 配布用（空欄）のシートのHTML。
 * title: シート名（ファイル名と投稿文に使う）。onToast: (msg) => void（null でお知らせを消す）
 */
export async function shareSheetImage(root, paperHtml, title, onToast) {
  onToast(t('画像を作っています…', 'Creating the image…'));
  const stage = document.createElement('div');
  stage.className = 'dc-share-stage';
  stage.innerHTML = `<div class="dc-share-card">${paperHtml}<div class="dc-share-url">${escapeHtml(t('Sky 星を紡ぐ子どもたち 非公式ファンサイト', 'Unofficial Sky: CotL fan site'))}　${escapeHtml(SITE_LABEL)}</div></div>`;
  root.appendChild(stage);
  try {
    await ensureHtml2Canvas();
    const card = stage.querySelector('.dc-share-card');
    const canvas = await window.html2canvas(card, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
    const filename = `${safeFilename(title)}.png`;
    const text = t(`チェックシート「${title}」を作りました\n${HUB_BASE_URL}`, `My checklist "${title}"\n${HUB_BASE_URL}`);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (blob && isMobileDevice() && navigator.share && navigator.canShare) {
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        onToast(null);
        try { await navigator.share({ files: [file], text }); return; } catch (err) { if (err && err.name === 'AbortError') return; }
      }
    }
    onToast(null); // 「作っています…」を消してからプレビューを出す
    showPreview(canvas.toDataURL('image/png'), filename, text);
  } catch (err) {
    console.error('[daily-check-share] failed to create image', err);
    onToast(t('画像を作れませんでした。通信状況を確かめて、もう一度お試しください', 'Could not create the image. Check your connection and try again'));
  } finally {
    stage.remove();
  }
}

// 画像のプレビュー（ページ内。確認ダイアログと同じ作り）。保存とXへの投稿を選べる
function showPreview(dataUrl, filename, text) {
  document.querySelector('.dc-share-overlay')?.remove();
  const el = document.createElement('div');
  el.className = 'dc-confirm-overlay dc-share-overlay';
  el.innerHTML = `
    <div class="dc-confirm-card dc-share-modal" role="dialog" aria-modal="true" aria-labelledby="dcShareTitle">
      <h2 class="dc-confirm-title" id="dcShareTitle">${escapeHtml(t('画像で保存・共有', 'Save & share as an image'))}</h2>
      <p class="dc-confirm-msg">${escapeHtml(t('「画像を保存」で端末に保存できます。Xに投稿する時は、保存した画像を添付してください。', 'Use "Save image" to download it. To post on X, attach the saved image.'))}</p>
      <img class="dc-share-img" src="${dataUrl}" alt="${escapeHtml(t('共有用のチェックシートの画像', 'Checklist image for sharing'))}">
      <div class="dc-confirm-actions dc-share-actions">
        <a class="dc-confirm-btn ok" href="${dataUrl}" download="${escapeHtml(filename)}">${escapeHtml(t('画像を保存', 'Save image'))}</a>
        <a class="dc-confirm-btn dc-share-x" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('Xに投稿', 'Post on X'))}</a>
      </div>
      <button type="button" class="dc-confirm-btn dc-share-close" data-share-close>${escapeHtml(t('閉じる', 'Close'))}</button>
    </div>`;
  const close = () => {
    document.removeEventListener('keydown', onKey);
    el.classList.add('closing');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400);
  };
  const onKey = (ev) => { if (ev.key === 'Escape') close(); };
  el.addEventListener('click', (ev) => { if (ev.target === el || ev.target.closest('[data-share-close]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(el);
  el.querySelector('[data-share-close]').focus();
}

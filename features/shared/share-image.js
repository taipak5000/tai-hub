/* ================================================================
   画面の一部を画像（PNG）にして保存・共有する共通の部品（週替わりビンゴ・一年のふりかえり・フレンド記念日）。
   html2canvas はデイリーチェックシート・羽トラッカーと同じ版を、使う時だけCDNから読み込む。
   スマホは共有シート（navigator.share）、それ以外は端末へ保存（ダウンロード）する。
   ================================================================ */
const H2C_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';

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
export function safeFilename(str) { return String(str).replace(/[\\/:*?"<>|]/g, '_').trim() || 'tai-hub'; }

/**
 * el を画像にする。bg は背景色（透明な所を埋める）。
 * 戻り値: 'shared'（共有シートで送った）| 'saved'（保存した）| 'cancelled'
 */
export async function saveElementImage(el, { filename, text, bg = '#ffffff' } = {}) {
  await ensureHtml2Canvas();
  const canvas = await window.html2canvas(el, { backgroundColor: bg, scale: 2, useCORS: true, logging: false });
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  const name = `${safeFilename(filename || 'tai-hub')}.png`;
  if (blob && isMobileDevice() && navigator.share && navigator.canShare) {
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text }); return 'shared'; }
      catch (err) { if (err && err.name === 'AbortError') return 'cancelled'; }
    }
  }
  const url = blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  if (blob) setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'saved';
}

/** 画面下に短く出すお知らせ（非ブロッキング。chrome.css の .hub-refresh-toast と同じ見た目） */
export function toast(msg, ms = 2200) {
  document.querySelector('.hub-fun-toast')?.remove();
  if (!msg) return;
  const el = document.createElement('div');
  el.className = 'hub-refresh-toast hub-fun-toast';
  el.setAttribute('role', 'status');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, ms);
}

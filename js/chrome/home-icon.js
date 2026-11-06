/* ================================================================
   📱 ホーム画面のアイコン（表示設定 > ホーム画面のアイコン）。
   旧サイトの「表示のカスタマイズ」（pfIcon*）を移したもの（2026-11-06）。
   「ホーム画面に追加」した時のアイコンを、絵文字＋背景色、または好きな画像にできる。
   ・ページの apple-touch-icon・icon・manifest のアイコンを、作った画像（data URL）に差し替える。
     ブラウザは「ホーム画面に追加」を押した時点のアイコンを使うので、追加する前に設定してもらう
     （追加した後に変えても、すでにあるアイコンは変わらない）。
   ・保存はこの端末・ブラウザに1つ（プロフィールごとではない）。キーは旧サイトと同じ形の
     pfCustomHomeIcon_v1__site_tai-hub。{ mode: 'emoji'|'image', dataUrl, emoji?, bgColor? }
   ・起動時に applyHomeIconFromStorage()（js/app.js）で差し替える。
   ・画面は表示設定シートの中の1画面（着せ替えと同じ。chrome/settings-modal.js が mount する）。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../i18n.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
const KEY = 'pfCustomHomeIcon_v1__site_tai-hub';
const SIZE = 512;
const SWATCHES = ['#FF9500', '#007AFF', '#34C759', '#FF3B30', '#AF52DE', '#8E8E93', '#FFCC00', '#00C7BE', '#5856D6', '#A2845E', '#32ADE6', '#48484A'];
// 差し替える前の元のURL（「元に戻す」で使う）
let original = null;
function rememberOriginal() {
  if (original) return;
  original = {
    apple: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href') || '',
    icon: document.querySelector('link[rel="icon"]')?.getAttribute('href') || '',
    manifest: document.querySelector('link[rel="manifest"]')?.href || '',
  };
}

function readState() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); return s && typeof s.dataUrl === 'string' && s.dataUrl.startsWith('data:image/') ? s : null; } catch (e) { return null; }
}

let manifestUrl = null;
async function applyIcon(dataUrl) {
  rememberOriginal();
  const apple = document.querySelector('link[rel="apple-touch-icon"]');
  if (apple) apple.href = dataUrl;
  const icon = document.querySelector('link[rel="icon"]');
  if (icon) icon.href = dataUrl;
  // Android（Chrome）向け: manifest のアイコンも差し替える。blob: のURLから相対パスを解決できないので、
  // start_url・scope・アイコン以外の相対URLは元の manifest.json の場所で絶対URLにしておく
  try {
    const res = await fetch(original.manifest);
    const m = await res.json();
    const base = original.manifest;
    if (m.start_url) m.start_url = new URL(m.start_url, base).href;
    if (m.scope) m.scope = new URL(m.scope, base).href;
    m.icons = [
      { src: dataUrl, sizes: '192x192', type: dataUrl.slice(5, dataUrl.indexOf(';')) },
      { src: dataUrl, sizes: '512x512', type: dataUrl.slice(5, dataUrl.indexOf(';')) },
    ];
    if (manifestUrl) URL.revokeObjectURL(manifestUrl);
    manifestUrl = URL.createObjectURL(new Blob([JSON.stringify(m)], { type: 'application/manifest+json' }));
    const link = document.querySelector('link[rel="manifest"]');
    if (link) link.href = manifestUrl;
  } catch (e) { /* manifest を差し替えられなくても、iPhone向けのアイコンは差し替わっている */ }
}
function restoreOriginal() {
  if (!original) return;
  const apple = document.querySelector('link[rel="apple-touch-icon"]');
  if (apple) apple.setAttribute('href', original.apple);
  const icon = document.querySelector('link[rel="icon"]');
  if (icon) icon.setAttribute('href', original.icon);
  const link = document.querySelector('link[rel="manifest"]');
  if (link) link.href = original.manifest;
  if (manifestUrl) { URL.revokeObjectURL(manifestUrl); manifestUrl = null; }
}

/** 起動時に呼ぶ。保存したアイコンがあればページのアイコンを差し替える */
export function applyHomeIconFromStorage() {
  const s = readState();
  if (s) applyIcon(s.dataUrl);
}
/** 表示設定の一覧に出す今の状態 */
export function homeIconLabel() {
  const s = readState();
  if (!s) return t('標準', 'Default');
  return s.mode === 'image' ? t('画像', 'Image') : (s.emoji || '✨');
}

// ---- 設定画面（表示設定シートの中の1画面） ----
let host = null;
let rootEl = null;
let mode = 'emoji';
let emoji = '✨';
let bg = '#FF9500';
let img = null; // 選んだ画像（HTMLImageElement）

function draw(canvas) {
  const size = canvas.width;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  if (mode === 'emoji') {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
    ctx.font = `${Math.floor(size * 0.6)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji || '✨', size / 2, size / 2 + size * 0.05);
  } else if (img) {
    // 正方形に収まるよう、短い辺に合わせて中央を切り抜く
    const scale = Math.max(size / img.width, size / img.height);
    const w = img.width * scale, h = img.height * scale;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  } else {
    ctx.fillStyle = '#E5E5EA';
    ctx.fillRect(0, 0, size, size);
  }
}
function preview() { const c = rootEl && rootEl.querySelector('#hiPreview'); if (c) draw(c); }
function status(msg) { const el = rootEl && rootEl.querySelector('#hiStatus'); if (el) el.textContent = msg; }

/**
 * @param {HTMLElement} cardEl 表示設定シートの .modal-card
 * @param {{onBack?: () => void, onClose?: () => void}} opts
 */
export function mount(cardEl, opts = {}) {
  host = opts;
  rootEl = cardEl;
  const s = readState();
  mode = s && s.mode === 'image' ? 'image' : 'emoji';
  emoji = (s && s.emoji) || '✨';
  bg = (s && /^#[0-9a-f]{6}$/i.test(s.bgColor || '') ? s.bgColor : '#FF9500');
  img = null;
  if (s && s.mode === 'image') { const im = new Image(); im.onload = () => { img = im; preview(); }; im.src = s.dataUrl; }
  render();
}
export function unmount() { rootEl = null; host = null; }

function render() {
  if (!rootEl) return;
  rootEl.innerHTML = `
    <button type="button" class="modal-close-btn" id="hiClose" aria-label="${t('閉じる', 'Close')}"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
    <button type="button" class="ts-back" id="hiBack"><svg class="inline-icon" width="18" height="18"><use href="#i-chevron-left"/></svg><span>${t('表示設定', 'Display Settings')}</span></button>
    <div class="modal-title">${t('ホーム画面のアイコン', 'Home screen icon')}</div>
    <p class="hi-hint">${t('「ホーム画面に追加」した時のアイコンを、絵文字＋背景色、または好きな画像にできます。この端末・ブラウザだけの設定です。', 'Choose the icon used when you add tai-hub to your home screen: an emoji on a color, or your own image. Saved on this device and browser only.')}<br>
      <b>${t('「ホーム画面に追加」をする前に保存してください。', 'Save it before adding to the home screen.')}</b>${t('追加した後に変えても、すでにあるアイコンは変わりません（変えたい時は、ホーム画面のアイコンを消してから追加し直します）。', ' Changing it later does not update an icon that is already there (remove it and add it again).')}</p>
    <div class="hi-seg" role="group">
      <button type="button" class="hi-seg-btn${mode === 'emoji' ? ' on' : ''}" data-mode="emoji">${t('絵文字＋背景色', 'Emoji + color')}</button>
      <button type="button" class="hi-seg-btn${mode === 'image' ? ' on' : ''}" data-mode="image">${t('画像', 'Image')}</button>
    </div>
    ${mode === 'emoji' ? `
      <p class="hi-label">${t('絵文字', 'Emoji')}</p>
      <input type="text" class="hi-emoji" id="hiEmoji" maxlength="8" value="${escapeHtml(emoji)}" aria-label="${t('絵文字', 'Emoji')}">
      <p class="hi-label">${t('背景色', 'Background color')}</p>
      <div class="hi-swatches">${SWATCHES.map(c => `<button type="button" class="hi-swatch${c.toLowerCase() === bg.toLowerCase() ? ' on' : ''}" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div>
      <label class="hi-color"><span>${t('ほかの色', 'Other color')}</span><input type="color" id="hiColor" value="${escapeHtml(bg)}"></label>`
    : `
      <p class="hi-label">${t('画像を選ぶ', 'Choose an image')}</p>
      <label class="hi-file"><svg class="inline-icon" width="16" height="16"><use href="#i-image"/></svg><span>${t('端末の画像を選ぶ', 'Pick an image')}</span><input type="file" accept="image/*" id="hiFile"></label>
      <p class="hi-note">${t('正方形に切り抜いて使います（短い辺に合わせて中央を使います）。', 'The center is cropped to a square.')}</p>`}
    <div class="hi-preview-wrap"><p class="hi-label">${t('プレビュー', 'Preview')}</p><canvas id="hiPreview" width="96" height="96"></canvas></div>
    <button type="button" class="hi-save" id="hiSave">${t('このアイコンを保存', 'Save this icon')}</button>
    <button type="button" class="hi-reset" id="hiReset">${t('標準のアイコンに戻す', 'Back to the default icon')}</button>
    <p class="hi-status" id="hiStatus" role="status"></p>`;
  rootEl.scrollTop = 0;
  preview();
  rootEl.querySelector('#hiClose').addEventListener('click', () => { const h = host; unmount(); if (h && h.onClose) h.onClose(); });
  rootEl.querySelector('#hiBack').addEventListener('click', () => { const h = host; unmount(); if (h && h.onBack) h.onBack(); });
  rootEl.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; render(); }));
  rootEl.querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => {
    bg = b.dataset.color;
    rootEl.querySelectorAll('.hi-swatch').forEach(x => x.classList.toggle('on', x === b));
    const c = rootEl.querySelector('#hiColor'); if (c) c.value = bg;
    preview();
  }));
  // 入力欄は描き直さず、プレビューだけ描き直す（打っている途中でフォーカスが外れないように）
  rootEl.querySelector('#hiEmoji')?.addEventListener('input', e => { emoji = e.target.value; preview(); });
  rootEl.querySelector('#hiColor')?.addEventListener('input', e => {
    bg = e.target.value;
    rootEl.querySelectorAll('.hi-swatch').forEach(x => x.classList.remove('on'));
    preview();
  });
  rootEl.querySelector('#hiFile')?.addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { const im = new Image(); im.onload = () => { img = im; preview(); status(''); }; im.onerror = () => status(t('画像を読み込めませんでした', 'Could not read the image')); im.src = reader.result; };
    reader.readAsDataURL(file);
  });
  rootEl.querySelector('#hiSave').addEventListener('click', save);
  rootEl.querySelector('#hiReset').addEventListener('click', reset);
}

function save() {
  if (mode === 'image' && !img) { status(t('先に画像を選んでください', 'Choose an image first')); return; }
  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  draw(canvas);
  // 写真はPNGだと大きくなり端末の保存領域を圧迫するので、JPEGにする（絵文字は小さいのでPNGのまま）
  const dataUrl = mode === 'image' ? canvas.toDataURL('image/jpeg', 0.9) : canvas.toDataURL('image/png');
  const state = mode === 'emoji' ? { mode, dataUrl, emoji: emoji || '✨', bgColor: bg } : { mode, dataUrl };
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { status(t('保存できませんでした（端末の保存領域がいっぱいかもしれません）', 'Could not save (storage may be full)')); return; }
  applyIcon(dataUrl);
  status(t('保存しました。このまま「ホーム画面に追加」すると、このアイコンになります。', 'Saved. Add to the home screen now to use this icon.'));
}
function reset() {
  try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
  restoreOriginal();
  mode = 'emoji'; emoji = '✨'; bg = '#FF9500'; img = null;
  render();
  status(t('標準のアイコンに戻しました', 'Back to the default icon'));
}

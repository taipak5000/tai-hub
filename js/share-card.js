/* ================================================================
   🖼️ シェア用の画像カード（2026-11-12）。Canvasで端末の中だけで描き、PNGで保存・共有する（外部には送らない）。
   ・達成率カード: 全体の達成率・カテゴリ別の内訳・プロフィール名・作った日。
   ・コーデカード: コーデ日記の写真＋着ていたアイテムの一覧（アイコンと名前）。
   ・大きさは 1200×630（Xなどの横長）と 1080×1080（正方形）から選ぶ。
   ・色は今の着せ替え（--hub-* のトークン。js/theme.js が書き換える）から取るので、テーマを変えるとカードも変わる。
   ・アイテムのアイコンは外部（Wiki）の画像なので、CORSで読めた物だけ描く（読めない時は名前の頭文字のマス）。
     読めない画像を描くとCanvasが書き出せなくなるため、必ず crossOrigin='anonymous' で読み込んでから使う。
   ・長い名前は幅に合わせて「…」で切る。写真が無い時はアイテム一覧を広げる。
   ・プレビューと保存の画面は他と同じ .modal-overlay ＋ .modal-card（全幅のボトムシート）。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from './i18n.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
const FONT = '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", sans-serif';
export const SIZES = { wide: [1200, 630], square: [1080, 1080] };

/** 今の着せ替えの色 */
export function themePalette() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name, fb) => (cs.getPropertyValue(name) || '').trim() || fb;
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    bg: v('--hub-bg', dark ? '#0F0E14' : '#F4F3F8'),
    card: v('--hub-card', dark ? '#1C1B22' : '#FFFFFF'),
    accent: v('--hub-accent', '#6C63D8'),
    accentInk: v('--hub-accent-ink', v('--hub-accent', '#6C63D8')),
    accentBg: v('--hub-accent-bg', 'rgba(108,99,216,0.12)'),
    text: v('--hub-text', dark ? '#F2F1F7' : '#1C1B22'),
    text2: v('--hub-text-2', dark ? '#A7A5B4' : '#6E6C7A'),
    sep: v('--hub-sep', dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'),
  };
}

function font(px, weight = 400) { return `${weight} ${px}px ${FONT}`; }
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
// 幅に収まらない文字は後ろを「…」にする
function fitText(ctx, str, maxW) {
  const s = String(str || '');
  if (ctx.measureText(s).width <= maxW) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(s.slice(0, mid) + '…').width <= maxW) lo = mid; else hi = mid - 1;
  }
  return s.slice(0, lo) + '…';
}
function loadImage(src, timeout = 6000) {
  return new Promise(resolve => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    if (!/^(blob|data):/.test(src)) img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    const done = ok => { clearTimeout(timer); resolve(ok ? img : null); };
    const timer = setTimeout(() => done(false), timeout);
    img.onload = () => done(img.naturalWidth > 0);
    img.onerror = () => done(false);
    img.src = src;
  });
}
function drawCover(ctx, img, x, y, w, h, r) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const iw = img.naturalWidth * s, ih = img.naturalHeight * s;
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  ctx.restore();
}
function footer(ctx, W, H, p, pad, left) {
  ctx.font = font(22, 600);
  ctx.fillStyle = p.text2;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText(fitText(ctx, left, W * 0.6), pad, H - pad + 6);
  ctx.textAlign = 'right';
  ctx.fillText('tai-hub', W - pad, H - pad + 6);
  ctx.textAlign = 'left';
}
function fmtDate(d) { return t(`${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`, d.toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })); }

/**
 * 達成率カード。data = { owned, total, cats: [{ name, owned, total }], profile, date: Date }
 */
export function drawAchievementCard(canvas, data, size = 'wide', p = themePalette()) {
  const [W, H] = SIZES[size];
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const pad = size === 'wide' ? 48 : 64;
  ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
  const pct = data.total ? (data.owned / data.total) * 100 : 0;

  // 左（正方形は上）: 全体の達成率の輪
  const ringR = size === 'wide' ? 150 : 170;
  const cx = size === 'wide' ? pad + ringR + 20 : W / 2;
  const cy = size === 'wide' ? H / 2 - 4 : pad + 70 + ringR;
  ctx.lineWidth = size === 'wide' ? 26 : 30;
  ctx.lineCap = 'round';
  ctx.strokeStyle = p.sep; ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2); ctx.stroke();
  if (pct > 0) { ctx.strokeStyle = p.accent; ctx.beginPath(); ctx.arc(cx, cy, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, pct / 100)); ctx.stroke(); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = p.text; ctx.font = font(size === 'wide' ? 76 : 88, 700);
  ctx.fillText(`${pct.toFixed(1)}%`, cx, cy - 12);
  ctx.fillStyle = p.text2; ctx.font = font(26, 600);
  ctx.fillText(`${data.owned.toLocaleString()} / ${data.total.toLocaleString()}`, cx, cy + 48);
  ctx.font = font(24, 700); ctx.fillStyle = p.accentInk;
  ctx.fillText(t('アイテム達成率', 'Item completion'), cx, size === 'wide' ? cy - ringR - 50 : pad + 26);

  // 右（正方形は下）: カテゴリ別の内訳（2列）
  const area = size === 'wide'
    ? { x: cx + ringR + 70, y: pad + 6, w: W - (cx + ringR + 70) - pad, h: H - pad * 2 - 46 }
    : { x: pad, y: cy + ringR + 60, w: W - pad * 2, h: H - (cy + ringR + 60) - pad - 50 };
  const cats = data.cats.slice(0, 12);
  const cols = 2, rows = Math.ceil(cats.length / cols);
  const gap = 26;
  const colW = (area.w - gap) / cols;
  const rowH = area.h / Math.max(1, rows);
  ctx.textBaseline = 'alphabetic';
  cats.forEach((c, i) => {
    const col = Math.floor(i / rows), row = i % rows;
    const x = area.x + col * (colW + gap), y = area.y + row * rowH;
    const cp = c.total ? (c.owned / c.total) * 100 : 0;
    ctx.textAlign = 'right'; ctx.fillStyle = p.text; ctx.font = font(22, 700);
    const pctTxt = `${Math.round(cp)}%`;
    ctx.fillText(pctTxt, x + colW, y + 26);
    const pw = ctx.measureText(pctTxt).width;
    ctx.textAlign = 'left'; ctx.font = font(22, 500); ctx.fillStyle = p.text;
    ctx.fillText(fitText(ctx, c.name, colW - pw - 12), x, y + 26);
    const by = y + 38, bh = 8;
    ctx.fillStyle = p.sep; roundRect(ctx, x, by, colW, bh, 4); ctx.fill();
    if (cp > 0) { ctx.fillStyle = p.accent; roundRect(ctx, x, by, Math.max(bh, colW * Math.min(1, cp / 100)), bh, 4); ctx.fill(); }
  });
  footer(ctx, W, H, p, pad, `${data.profile ? data.profile + ' ・ ' : ''}${fmtDate(data.date)}`);
}

/**
 * コーデカード。data = { title, sub, photoUrl, items: [{ name, img }], date: Date, profile }
 */
export async function drawCoordCard(canvas, data, size = 'wide', p = themePalette()) {
  const [W, H] = SIZES[size];
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const pad = size === 'wide' ? 44 : 56;
  ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
  const photo = await loadImage(data.photoUrl);
  const icons = await Promise.all(data.items.map(it => loadImage(it.img, 5000)));

  // 写真の場所（横長: 左の正方形、正方形: 上半分）
  let list;
  if (photo && size === 'wide') {
    const ph = H - pad * 2 - 44; // 下の1行（プロフィール名・tai-hub）と重ならないように
    drawCover(ctx, photo, pad, pad, ph, ph, 24);
    list = { x: pad * 2 + ph, y: pad, w: W - pad * 3 - ph, h: H - pad * 2 + 8 };
  } else if (photo) {
    const ph = Math.round(H * 0.5);
    drawCover(ctx, photo, pad, pad, W - pad * 2, ph, 28);
    list = { x: pad, y: pad * 2 + ph, w: W - pad * 2, h: H - pad * 3 - ph };
  } else {
    list = { x: pad, y: pad, w: W - pad * 2, h: H - pad * 2 };
  }

  // 見出し（日付・場所）
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = p.text; ctx.font = font(size === 'wide' ? 40 : 44, 700);
  ctx.fillText(fitText(ctx, data.title, list.w), list.x, list.y + 40);
  let y = list.y + 40;
  if (data.sub) { ctx.fillStyle = p.text2; ctx.font = font(24, 500); ctx.fillText(fitText(ctx, data.sub, list.w), list.x, y + 38); y += 38; }
  y += 26;

  // 着ていたアイテム（アイコン＋名前）。入りきらない分は「ほか○点」
  const bottom = list.y + list.h - 52;
  const rowH = 56, icon = 44;
  const cols = !photo || size === 'square' ? 2 : 1;
  const gap = 24;
  const colW = (list.w - gap * (cols - 1)) / cols;
  const perCol = Math.max(1, Math.floor((bottom - y) / rowH));
  const cap = perCol * cols;
  const shown = data.items.length > cap ? cap - 1 : data.items.length;
  if (!data.items.length) {
    ctx.fillStyle = p.text2; ctx.font = font(24, 500);
    ctx.fillText(t('着ていたアイテムは記録していません', 'No items recorded'), list.x, y + 30);
  }
  for (let i = 0; i < shown; i++) {
    const col = Math.floor(i / perCol), row = i % perCol;
    const x = list.x + col * (colW + gap), ry = y + row * rowH;
    ctx.fillStyle = p.card; roundRect(ctx, x, ry, icon, icon, 10); ctx.fill();
    if (icons[i]) {
      const s = Math.min(icon / icons[i].naturalWidth, icon / icons[i].naturalHeight) * 0.86;
      const iw = icons[i].naturalWidth * s, ih = icons[i].naturalHeight * s;
      ctx.drawImage(icons[i], x + (icon - iw) / 2, ry + (icon - ih) / 2, iw, ih);
    } else {
      ctx.fillStyle = p.accentInk; ctx.font = font(20, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText([...String(data.items[i].name || '?')][0], x + icon / 2, ry + icon / 2);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
    ctx.fillStyle = p.text; ctx.font = font(23, 500);
    ctx.fillText(fitText(ctx, data.items[i].name, colW - icon - 14), x + icon + 14, ry + icon / 2 + 8);
  }
  if (shown < data.items.length) {
    const i = shown, col = Math.floor(i / perCol), row = i % perCol;
    ctx.fillStyle = p.text2; ctx.font = font(23, 600);
    ctx.fillText(t(`ほか${data.items.length - shown}点`, `+${data.items.length - shown} more`), list.x + col * (colW + gap), y + row * rowH + icon / 2 + 8);
  }
  footer(ctx, W, H, p, pad, `${data.profile ? data.profile + ' ・ ' : ''}${t('コーデ日記', 'Outfit Diary')}`);
}

function canvasBlob(canvas) { return new Promise(resolve => canvas.toBlob(resolve, 'image/png')); }
function isMobile() {
  if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') return navigator.userAgentData.mobile;
  return /Android|iPhone|iPod|iPad/i.test(navigator.userAgent || '') || (/Macintosh/i.test(navigator.userAgent || '') && navigator.maxTouchPoints > 1);
}

const STYLE_ID = 'hub-share-card-styles';
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement('style');
  st.id = STYLE_ID;
  st.textContent = `
.scd-preview { display: block; width: 100%; height: auto; border-radius: 12px; border: 0.5px solid var(--hub-sep); background: var(--hub-bg); }
.scd-sizes { display: flex; gap: 6px; margin: 12px 0; }
.scd-size { flex: 1; min-height: 38px; padding: 6px 10px; border: 0.5px solid var(--hub-sep); border-radius: 10px; background: var(--hub-card); color: var(--hub-text); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.scd-size.on { border-color: var(--hub-accent); background: var(--hub-accent-bg); color: var(--hub-accent-ink, var(--hub-accent)); }
.scd-actions { display: flex; gap: 8px; }
.scd-btn { flex: 1; min-height: 44px; padding: 10px 14px; border: 0; border-radius: 12px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
.scd-btn.is-primary { background: var(--hub-accent); color: #fff; }
.scd-btn.is-plain { background: var(--hub-bg); color: var(--hub-text); }
.scd-btn:active, .scd-size:active { transform: scale(0.98); }
.scd-note { margin: 8px 2px 0; font-size: 12px; color: var(--hub-text-2); }
@media (prefers-reduced-motion: reduce) { .scd-btn:active, .scd-size:active { transform: none; } }
@media (prefers-contrast: more) { .scd-size, .scd-preview { border-color: var(--hub-text-2); } }
`;
  document.head.appendChild(st);
}

/**
 * プレビューを出して保存・共有するシートを開く。
 * draw(canvas, size) で描く。filename は保存名（.png は付けない）、text は共有する時の文
 */
export function openShareCard({ title, draw, filename, text = '' }) {
  injectStyles();
  document.getElementById('shareCardOverlay')?.remove();
  let size = 'wide';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'shareCardOverlay';
  overlay.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="scdTitle">
    <button type="button" class="modal-close-btn" data-act="close" aria-label="${t('閉じる', 'Close')}"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
    <div class="modal-title" id="scdTitle">${escapeHtml(title)}</div>
    <canvas class="scd-preview" aria-label="${t('画像のプレビュー', 'Image preview')}"></canvas>
    <div class="scd-sizes" role="group" aria-label="${t('大きさ', 'Size')}">
      <button type="button" class="scd-size on" data-size="wide">${t('横長 1200×630', 'Wide 1200×630')}</button>
      <button type="button" class="scd-size" data-size="square">${t('正方形 1080×1080', 'Square 1080×1080')}</button>
    </div>
    <div class="scd-actions">
      <button type="button" class="scd-btn is-primary" data-act="save">${isMobile() && navigator.share ? t('保存・共有', 'Save / Share') : t('画像を保存', 'Save image')}</button>
    </div>
    <p class="scd-note">${t('画像はこの端末の中で作っています。色は今の着せ替えに合わせています。', 'The image is made on this device, using your current theme colors.')}</p>
  </div>`;
  const canvas = overlay.querySelector('canvas');
  let busy = Promise.resolve();
  const redraw = () => { busy = Promise.resolve(draw(canvas, size)).catch(e => console.error('[share-card]', e)); return busy; };
  const close = () => { overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 250); };
  overlay.addEventListener('click', async e => {
    if (e.target === overlay) { close(); return; }
    const sz = e.target.closest('[data-size]');
    if (sz) {
      size = sz.dataset.size;
      overlay.querySelectorAll('.scd-size').forEach(b => b.classList.toggle('on', b === sz));
      redraw();
      return;
    }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    if (act.dataset.act === 'close') close();
    if (act.dataset.act === 'save') {
      await busy;
      const blob = await canvasBlob(canvas);
      if (!blob) return;
      const name = `${filename}-${size}.png`;
      if (isMobile() && navigator.share && navigator.canShare) {
        const file = new File([blob], name, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], text }); return; } catch (err) { if (err && err.name === 'AbortError') return; }
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
  });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
  redraw();
}

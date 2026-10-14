/* ================================================================
   emote-share.js — 🖼️ 達成率をシェア（Xで画像を共有／カスタマイズして共有）

   移植元: C:\Users\user\Downloads\skyツール\emote\index.html の
   「達成率をシェア」ブロック（1161-1176行目のボタン2つ・1203-1250行目の
   customizeModal/imagePreviewModal・4756-4980行目付近のJS一式：
   loadShareCustomize〜shareOverallOnTwitter）。html2canvas（CDN）でDOM上に
   オフスクリーンで組み立てたカードをラスタライズして画像化する方式は、
   tai-hub内の同種機能（features/item/share/achievement-share.js・
   features/wings/wings-share.js）と同じ（元実装自体がこの方式だったため、
   emote-view.js冒頭コメントの「Canvas 2Dで約400行」という記述は誤りで、
   実際はitem/wingsと同じDOM→html2canvas方式だった。今回そのことを確認した
   うえで、他2機能と同じ移植方針で実装している）。

   ── エクスポート契約 ──────────────────────────────────────────
     export async function shareOnX() … 「Xで画像を共有」の直接トリガー
       （モーダル無し・ワンクリック。保存済みのカスタマイズ設定とは無関係に
       既定のオレンジテーマ・アイコン一覧非表示・コメント無しのカードを
       生成する。元実装のshareOverallOnTwitter()（fromCustomize省略）と同じ）。
     export function openCustomize()  … 「カスタマイズして共有」モーダルを開く
       （背景テーマ・所持エモートのアイコン一覧表示有無・コメントを選べる。
       元実装のopenCustomizeModal相当）。
     export function closeCustomize() … モーダルを閉じる。
   emote-view.jsから
   `import * as Share from './emote-share.js'; Share.shareOnX(); / Share.openCustomize();`
   のように呼び出す想定（wings-view.jsのimport-as-namespaceと同じ作法）。

   ── データ互換性 ──────────────────────────────────────────────
   カスタマイズ設定（背景テーマ・アイコン一覧表示）の保存キー
   emoteShareCustomize_v1・形状 {theme, showIcons} は元実装と完全に同一
   （wings-state.jsのwingsShareCustomize_v1と同じ理由で、元実装も
   nsKey()を通さない端末単位のプレーンキーだったため、そのまま
   非namespace化で踏襲している）。コメント欄の内容自体は保存しない
   （元実装と同じ——毎回空欄から始まる）。

   ── スタイル注入について ──────────────────────────────────────
   達成率カード・カスタマイズモーダルの中身・画像プレビューモーダルは
   emote-view.jsのcontainer外（document.body直下）に組み立てられるため、
   .emote-view配下のCSSトークン（--orange等）を継承できない。
   features/item/share/share-data.jsのinjectShareSharedStyles()と同じ方針で、
   このファイル専用のスタイルを自己完結で注入する（--hub-*トークンを使い、
   emote-view.js側の既存スタイルは一切変更しない）。
   ================================================================ */

import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { toolShareUrl } from '../../js/site-config.js';
import { EMOTES } from './data/emotes.js';
import { getStats, formatPct, loadOwned } from './emote-state.js';

function t(ja, en) { return CURRENT_LANG === 'en' ? en : ja; }

const SITE_URL = toolShareUrl('emote');
const SHARE_HASHTAG = '#Skyエモート所持率';
const SHARE_CUSTOMIZE_KEY = 'emoteShareCustomize_v1';
const OVERLAY_ID = 'emoteShareCustomizeOverlay';
const PREVIEW_OVERLAY_ID = 'emoteSharePreviewOverlay';
const STYLE_ID = 'emote-share-styles';

/* 背景テーマ（元実装のSHARE_THEMESを移植。'orange'は元は
   var(--orange-d)/var(--orange)参照だったが、このモジュールは.emote-view配下
   ではないため、share-data.js/wings-share.jsと同じくライトモード値を
   リテラル化している） */
const SHARE_THEMES = {
  orange: { label: t('オレンジ', 'Orange'), grad: 'linear-gradient(135deg, #FF6200 0%, #FF9500 55%, #FFBB00 100%)' },
  blue:   { label: t('ブルー', 'Blue'), grad: 'linear-gradient(135deg, #0051A8 0%, #007AFF 55%, #5AC8FA 100%)' },
  green:  { label: t('グリーン', 'Green'), grad: 'linear-gradient(135deg, #1F7A3D 0%, #34C759 55%, #8BE28B 100%)' },
  purple: { label: t('パープル', 'Purple'), grad: 'linear-gradient(135deg, #4B2E83 0%, #7B4FCB 55%, #B98CFF 100%)' },
  pink:   { label: t('ピンク', 'Pink'), grad: 'linear-gradient(135deg, #B0184D 0%, #FF2D78 55%, #FF8FB3 100%)' },
  dark:   { label: t('ダーク', 'Dark'), grad: 'linear-gradient(135deg, #05070d 0%, #1b2333 100%)' },
};

function loadShareCustomize() {
  try {
    const d = JSON.parse(localStorage.getItem(SHARE_CUSTOMIZE_KEY));
    return {
      theme: (d && d.theme && SHARE_THEMES[d.theme]) ? d.theme : 'orange',
      showIcons: !!(d && d.showIcons),
    };
  } catch (_) {
    return { theme: 'orange', showIcons: false };
  }
}
function saveShareCustomize(theme, showIcons) {
  try { localStorage.setItem(SHARE_CUSTOMIZE_KEY, JSON.stringify({ theme, showIcons })); } catch (_) { /* noop */ }
}

/* ================================================================
   所持しているエモートのアイコングリッド（元実装のbuildEmoteIconGridHtmlを移植。
   全レベル所持＝コンプリートのものは緑枠で強調表示）
   ================================================================ */
function buildEmoteIconGridHtml() {
  const data = loadOwned();
  const ownedEmotes = EMOTES.filter(e => (data[e.id] || []).length > 0);
  if (ownedEmotes.length === 0) {
    return `<div class="es-exp-icon-empty">${t('まだ所持しているエモートがありません', "You don't own any emotes yet")}</div>`;
  }
  const cells = ownedEmotes.map(e => {
    const ownedLevels = new Set(data[e.id] || []);
    const isComplete = ownedLevels.size === e.maxLevel;
    const dots = [];
    for (let lv = 1; lv <= e.maxLevel; lv++) {
      dots.push(`<span class="es-exp-lv-dot ${ownedLevels.has(lv) ? 'is-owned' : ''}"></span>`);
    }
    const name = CURRENT_LANG === 'en' ? e.nameEn : e.name;
    return `
      <div class="es-exp-icon-cell ${isComplete ? 'is-complete' : ''}" title="${escapeHtml(name)}">
        <img src="${e.img}" alt="${escapeHtml(name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none';">
        <div class="es-exp-icon-levels">${dots.join('')}</div>
      </div>`;
  }).join('');
  return `<div class="es-exp-icon-grid">${cells}</div>`;
}

/* ================================================================
   達成率カード（DOM）の組み立て（元実装のbuildOverallExportCardElを移植）
   opts: { theme?: string, showIcons?: boolean, comment?: string }
   ================================================================ */
function buildOverallExportCardEl(opts = {}) {
  const { owned, total, pct } = getStats();
  const pctTxt = formatPct(pct);
  const theme = SHARE_THEMES[opts.theme] ? opts.theme : 'orange';
  const comment = opts.comment || '';

  const data = loadOwned();
  const completeCount = EMOTES.filter(e => (data[e.id] || []).length === e.maxLevel).length;

  const today = new Date();
  const dateTxt = t(
    `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日作成`,
    `Created ${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`,
  );

  const card = document.createElement('div');
  card.className = 'es-export-card';
  card.style.background = SHARE_THEMES[theme].grad;
  card.innerHTML = `
    <div class="es-exp-brand"><svg width="13" height="13" viewBox="0 0 24 24" style="vertical-align:-2px;margin-right:3px;" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(12 12) scale(1.094) translate(-12 -12)"><path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z"/><path d="M9 10v.01M15 10v.01"/><path d="M8.5 14.5q3.5 3 7 0"/></g></svg> ${t('エモート所持率管理', 'Emote Collection')}</div>
    <div class="es-exp-hero">
      <div class="es-exp-hero-pct">${pctTxt}</div>
      <div class="es-exp-hero-label">${t('エモート所持率', 'Emote Completion Rate')}</div>
      <div class="es-exp-hero-nums">${t(
        `所持中 ${total > 0 ? owned : '--'} ／ 総レベル数 ${total > 0 ? total : '--'}`,
        `Owned ${total > 0 ? owned : '--'} / Total Levels ${total > 0 ? total : '--'}`,
      )}</div>
      <div class="es-exp-hero-sub">${t(
        `コンプリート済み ${completeCount} / ${EMOTES.length} エモート`,
        `Complete ${completeCount} / ${EMOTES.length} emotes`,
      )}</div>
    </div>
    ${comment ? `<div class="es-exp-comment">${escapeHtml(comment)}</div>` : ''}
    ${opts.showIcons ? buildEmoteIconGridHtml() : ''}
    <div class="es-exp-date">${dateTxt}</div>
    ${opts.showIcons ? `<div class="es-exp-attribution">© Sky: Children of the Light Icons by contributors of the Sky: Children of the Light wiki</div>` : ''}
  `;
  document.body.appendChild(card);
  return card;
}

/* html2canvasを必要になった時点で読み込む（item/wingsの同種モジュールと同じCDN URL・同じ方式） */
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
  return String(str).replace(/[\\/:*?"<>|]/g, '_').trim() || 'emote';
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
  el.className = 'es-toast';
  el.textContent = msg;
  const stackIndex = document.querySelectorAll('.es-toast').length;
  if (stackIndex > 0) el.style.bottom = `calc(84px + env(safe-area-inset-bottom) + ${stackIndex * 44}px)`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2600);
}

/* ================================================================
   画像保存プレビュー（Web Share非対応/失敗時のフォールバック。
   元実装のopenImagePreviewを移植。shareTextがあれば「Xの投稿画面を開く」も表示）
   ================================================================ */
function showImagePreview(dataUrl, filename, shareText) {
  document.getElementById(PREVIEW_OVERLAY_ID)?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = PREVIEW_OVERLAY_ID;
  overlay.addEventListener('click', e => { if (e.target === overlay) closePreview(); });
  const twitterHref = shareText ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}` : '';
  overlay.innerHTML = `
    <div class="modal-card">
      <button type="button" class="modal-close-btn" id="esPreviewCloseBtn"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      <div class="modal-title">${shareText ? t('画像を保存してXへ投稿', 'Save Image & Post to X') : t('画像を保存', 'Save Image')}</div>
      <p class="es-hint">${shareText
        ? t('① 下の「ダウンロード」で画像を保存 → ② 「Xの投稿画面を開く」を押して、保存した画像を添付して投稿してください', '① Save the image with "Download" below → ② Tap "Open X post screen" and attach the saved image to your post')
        : t('画像を長押し（PCの場合は右クリック）して「画像を保存」を選んでください', 'Press and hold the image (or right-click on PC) and choose "Save Image"')}</p>
      <img class="es-preview-img" src="${dataUrl}" alt="${escapeHtml(t('保存用の画像', 'Image to save'))}">
      <div class="es-action-row">
        <a class="es-action-btn primary full" href="${dataUrl}" download="${escapeHtml(filename)}">${t('ダウンロード', 'Download')}</a>
      </div>
      ${shareText ? `
      <div class="es-action-row">
        <a class="es-action-btn twitter full" href="${twitterHref}" target="_blank" rel="noopener noreferrer">${t('Xの投稿画面を開く', 'Open X post screen')}</a>
      </div>` : ''}
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#esPreviewCloseBtn').addEventListener('click', closePreview);
  requestAnimationFrame(() => overlay.classList.add('open'));
}
function closePreview() {
  document.getElementById(PREVIEW_OVERLAY_ID)?.classList.remove('open');
}

/* ================================================================
   指定したカード生成関数の出力を画像として書き出し、保存/共有する共通処理
   （元実装のexportElementAsImageを移植）
   ================================================================ */
async function exportAsImage(buildCardFn, filenameBase, opts = {}) {
  const { shareText, successToast = t('共有しました！', 'Shared!') } = opts;
  injectStyles();
  showToast(t('画像を生成中…', 'Generating image…'));
  let card = null;
  try {
    await ensureHtml2Canvas();
    card = buildCardFn();
    const canvas = await window.html2canvas(card, { backgroundColor: null, scale: 2, useCORS: true });
    const filename = sanitizeFilename(filenameBase) + '.png';

    const shareResult = await tryShareImage(canvas, filename, shareText);
    if (shareResult === 'success') { showToast(successToast); return; }
    if (shareResult === 'cancelled') return; // ユーザー自身が共有シートをキャンセル

    showImagePreview(canvas.toDataURL('image/png'), filename, shareText);
  } catch (err) {
    console.error('[emote-share] failed to export image', err);
    showToast(t('画像の保存に失敗しました', 'Failed to save the image'));
  } finally {
    if (card) card.remove();
  }
}

function buildTweetText(comment) {
  if (comment) return `${comment}\n\n${SITE_URL}\n${SHARE_HASHTAG}`;
  const { owned, total, pct } = getStats();
  const pctTxt = formatPct(pct);
  return t(
    `エモート所持率は${pctTxt}でした！\n（所持中 ${owned} ／ 総レベル数 ${total}）\nあなたは何%持ってる？✨\n\n${SITE_URL}\n${SHARE_HASHTAG}`,
    `My emote completion rate is ${pctTxt}!\n(Owned ${owned} / Total Levels ${total})\nHow much do you have? ✨\n\n${SITE_URL}\n${SHARE_HASHTAG}`,
  );
}

/* ================================================================
   「Xで画像を共有」の直接トリガー（モーダル無し）
   ================================================================ */
export async function shareOnX() {
  if (getStats().total === 0) {
    injectStyles();
    showToast(t('まずはエモートを登録してください', 'No emote data is available yet'));
    return;
  }
  return exportAsImage(() => buildOverallExportCardEl({}), t('エモート所持率', 'Emote Completion Rate'), {
    shareText: buildTweetText(''),
    successToast: t('共有しました！', 'Shared!'),
  });
}

/* ================================================================
   カスタマイズモーダル
   ================================================================ */
function renderThemeRow(overlay, selectedTheme) {
  const row = overlay.querySelector('#esThemeRow');
  row.innerHTML = Object.keys(SHARE_THEMES).map(key => `
    <button type="button" class="es-theme-swatch ${key === selectedTheme ? 'selected' : ''}" data-theme="${key}"
      style="background:${SHARE_THEMES[key].grad};" title="${escapeHtml(SHARE_THEMES[key].label)}"></button>`).join('');
}

export function openCustomize() {
  if (getStats().total === 0) {
    injectStyles();
    showToast(t('まずはエモートを登録してください', 'No emote data is available yet'));
    return;
  }
  injectStyles();
  document.getElementById(OVERLAY_ID)?.remove();
  const saved = loadShareCustomize();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = OVERLAY_ID;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeCustomize(); });
  overlay.innerHTML = `
    <div class="modal-card">
      <button type="button" class="modal-close-btn" id="esCustomizeCloseBtn"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      <div class="modal-title">${t('画像をカスタマイズ', 'Customize Image')}</div>

      <div class="es-section-label">${t('背景テーマ', 'Background Theme')}</div>
      <div class="es-theme-row" id="esThemeRow"></div>

      <div class="es-section-label">${t('表示オプション', 'Display Options')}</div>
      <label class="es-toggle-opt">
        <input type="checkbox" id="esShowIcons" ${saved.showIcons ? 'checked' : ''}>
        <span>${t('所持しているエモートのアイコン一覧を載せる', 'Include a grid of your owned emote icons')}</span>
      </label>

      <div class="es-section-label">${t('コメント（任意）', 'Comment (optional)')}</div>
      <textarea id="esComment" class="es-comment-input" maxlength="120" placeholder="${escapeHtml(t('例）プレイヤーネーム：〇〇（未入力の場合は通常の文言になります）', 'e.g. Player name: XX (leave blank to use the default text)'))}"></textarea>

      <div class="es-action-row" style="margin-top:16px;">
        <button type="button" class="es-action-btn twitter full" id="esShareBtn">${t('この設定でXへ画像を共有', 'Share image on X with these settings')}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  renderThemeRow(overlay, saved.theme);
  overlay.querySelector('#esCustomizeCloseBtn').addEventListener('click', closeCustomize);
  overlay.querySelector('#esThemeRow').addEventListener('click', e => {
    const sw = e.target.closest('.es-theme-swatch');
    if (!sw) return;
    overlay.querySelectorAll('.es-theme-swatch').forEach(el => el.classList.toggle('selected', el === sw));
  });
  overlay.querySelector('#esShareBtn').addEventListener('click', async () => {
    const themeEl = overlay.querySelector('.es-theme-swatch.selected');
    const theme = themeEl ? themeEl.dataset.theme : 'orange';
    const showIcons = overlay.querySelector('#esShowIcons').checked;
    const comment = overlay.querySelector('#esComment').value.trim();
    saveShareCustomize(theme, showIcons);
    closeCustomize();
    await exportAsImage(() => buildOverallExportCardEl({ theme, showIcons, comment }), t('エモート所持率', 'Emote Completion Rate'), {
      shareText: buildTweetText(comment),
      successToast: t('共有しました！', 'Shared!'),
    });
  });

  requestAnimationFrame(() => overlay.classList.add('open'));
}
export function closeCustomize() {
  document.getElementById(OVERLAY_ID)?.classList.remove('open');
}

/* ================================================================
   スタイル注入（document.body直下に組み立てるため.emote-view配下の
   トークンを継承できない——features/item/share/share-data.jsの
   injectShareSharedStyles()と同じ方針で--hub-*トークンを使い、
   このファイル内だけで完結させる）
   ================================================================ */
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.es-section-label { font-size: 12px; font-weight: 700; color: var(--hub-text-2); margin: 16px 0 8px; text-transform: uppercase; letter-spacing: 0.4px; }
.es-section-label:first-of-type { margin-top: 0; }
.es-hint { font-size: 12.5px; color: var(--hub-text-2); line-height: 1.6; margin: 0 0 12px; }

.es-theme-row { display: flex; gap: 10px; flex-wrap: wrap; }
.es-theme-swatch { width: 36px; height: 36px; padding: 0; border-radius: 50%; border: 2px solid transparent; cursor: pointer; flex-shrink: 0; position: relative; }
.es-theme-swatch.selected { border-color: var(--hub-text); }
.es-theme-swatch.selected::after {
  content: ''; position: absolute; inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M4.5 12.5l5 5L20 6.5' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: center; background-size: 44%;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.35));
}

.es-toggle-opt { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: var(--hub-text); padding: 8px 2px; line-height: 1.5; cursor: pointer; }
.es-toggle-opt input { width: 17px; height: 17px; flex-shrink: 0; accent-color: var(--hub-accent); }

.es-comment-input {
  width: 100%; box-sizing: border-box; border: none; border-radius: var(--hub-r-sm); padding: 10px 12px;
  font-size: 16px; font-family: inherit; color: var(--hub-text); resize: vertical; min-height: 60px; background: var(--hub-bg);
}
.es-comment-input:focus { outline: 2px solid var(--hub-accent); outline-offset: -1px; }

.es-action-row { display: flex; gap: 10px; margin-top: 12px; }
.es-action-btn { flex: 1; padding: 12px; border-radius: var(--hub-r-sm); font-size: 14px; font-weight: 700; font-family: inherit; border: 0; cursor: pointer; text-align: center; display: flex; align-items: center; justify-content: center; text-decoration: none; }
.es-action-btn.primary { background: var(--hub-accent); color: #fff; }
.es-action-btn.twitter { background: #000000; color: #fff; }
.es-action-btn.full { width: 100%; }

.es-preview-img { width: 100%; display: block; margin: 4px 0 12px; border-radius: var(--hub-r-sm); background: var(--hub-bg); -webkit-touch-callout: default; }

/* ── オフスクリーンのエクスポートカード（html2canvasでラスタライズする実体） ── */
.es-export-card {
  position: fixed; left: -9999px; top: 0; width: 560px; box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif;
  padding: 28px; border-radius: 28px;
}
.es-exp-brand { color: #fff; font-size: 12px; font-weight: 600; opacity: 0.85; letter-spacing: 0.3px; margin-bottom: 6px; }
.es-exp-hero { text-align: center; padding: 6px 0 18px; }
.es-exp-hero-pct { color: #fff; font-size: 52px; font-weight: 800; letter-spacing: -1px; line-height: 1; }
.es-exp-hero-label { color: rgba(255,255,255,0.85); font-size: 12px; margin-top: 6px; letter-spacing: 0.5px; }
.es-exp-hero-nums { color: #fff; font-size: 13px; margin-top: 10px; opacity: 0.92; }
.es-exp-hero-sub { color: #fff; font-size: 13px; margin-top: 4px; opacity: 0.92; }
.es-exp-comment {
  color: #fff; background: rgba(255,255,255,0.16); border-radius: 14px; padding: 10px 14px; font-size: 13px;
  line-height: 1.6; text-align: center; margin-bottom: 4px; white-space: pre-wrap; word-break: break-word;
}
.es-exp-date { color: rgba(255,255,255,0.75); font-size: 10.5px; text-align: right; margin-top: 10px; }
.es-exp-attribution { color: rgba(255,255,255,0.55); font-size: 8.5px; line-height: 1.4; text-align: center; margin-top: 10px; }

.es-exp-icon-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 7px; background: #fff; border-radius: 18px; padding: 14px; margin-bottom: 4px; }
.es-exp-icon-cell { background: #F2F2F7; border-radius: 10px; aspect-ratio: 1; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 2px solid transparent; }
.es-exp-icon-cell.is-complete { border-color: #34C759; }
.es-exp-icon-cell img { width: 100%; height: 100%; object-fit: contain; padding: 12%; box-sizing: border-box; display: block; }
.es-exp-icon-empty { color: #fff; font-size: 12.5px; text-align: center; opacity: 0.85; padding: 10px 0; }
.es-exp-icon-levels { position: absolute; bottom: 3px; left: 0; right: 0; z-index: 2; display: flex; justify-content: center; flex-wrap: wrap; gap: 2px; padding: 0 3px; }
.es-exp-lv-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; background: rgba(255,255,255,0.85); border: 1px solid #C7C7CC; }
.es-exp-lv-dot.is-owned { background: #34C759; border-color: #34C759; }

.es-toast {
  position: fixed; left: 50%; bottom: calc(84px + env(safe-area-inset-bottom)); transform: translateX(-50%) translateY(10px);
  background: rgba(28,28,30,0.92); color: #fff; padding: 12px 20px; border-radius: 999px;
  font-size: 13.5px; font-weight: 600; z-index: 2000; opacity: 0; transition: opacity 0.25s, transform 0.25s;
  pointer-events: none; white-space: nowrap; max-width: 90vw; text-overflow: ellipsis; overflow: hidden;
}
.es-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
`;
  document.head.appendChild(style);
}

/* ================================================================
   着せ替えスタジオ。画面の色・質感・背景などを自由に選び、
   気に入った組み合わせをお気に入りに保存できる。エンジンは js/theme.js。

   ・「表示設定」シートの中の1画面として表示する（表示設定 > 着せ替え）。
     chrome/settings-modal.js が mount() で表示設定のシート本体に差し込み、
     「‹ 表示設定」で元の設定画面に戻る。独立したボタンやシートは持たない。
   ・変更は選んだ瞬間に画面へ反映し、そのまま保存する（OKボタンは無い）。
     「開いた時の見た目に戻す」と「標準に戻す」で、いつでも巻き戻せる。
   ・この画面を表示している間は、表示設定のシートが背景を暗くせず、シートの外側の
     操作も止めない（css/theme.css の .ts-live）。色を変えながら、シートの上に
     見える実際の画面で確かめられる。
   ・タブ: テーマ（見本から選ぶ・おまかせ）／カスタム（細かく調整）／
     お気に入り（保存・共有コード）。
   ・開く演出は他のボトムシートと同じ@keyframes（CLAUDE.md参照）。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../i18n.js';
import * as T from '../theme.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
const ICON = (id, size = 16) => `<svg class="inline-icon" width="${size}" height="${size}"><use href="#${id}"/></svg>`;

const ACCENTS = ['#E9578A', '#F2603D', '#F5A524', '#D4A02C', '#2F9E5B', '#14A37F', '#1E88E5', '#6C63D8', '#8466E8', '#B0794C', '#FF2BD6', '#6B7280'];
const BGS = ['#FFFFFF', '#FFF4E5', '#FDE7EF', '#E8F5EC', '#E6F1FD', '#EDE7F9', '#15161B', '#0D1B2A', '#1B1230', '#10201A'];

let rootEl = null;      // 表示設定のシート本体（.modal-card）。この中に描画する
let host = null;        // { onBack, onClose }
let tab = 'themes';
let undoTheme = null;   // 開いた時点のテーマ（巻き戻し用）
let pending;            // 次のフレームで適用する値（undefined＝なし／null＝標準）
let raf = 0;
let renamingId = null;
let lastThumbToken = 0;

/* ================================================================
   現在のテーマの読み書き（スライダーのドラッグ中は1フレームに1回だけ適用）
   ================================================================ */
function current() { return pending !== undefined ? pending : T.getActiveTheme(); }
function flush() {
  raf = 0;
  if (pending !== undefined) { const v = pending; pending = undefined; T.setActiveTheme(v); }
}
function commit(theme, immediate) {
  pending = theme;
  if (immediate) { if (raf) cancelAnimationFrame(raf); flush(); } else if (!raf) raf = requestAnimationFrame(flush);
}
function editBase() {
  const cur = current();
  return cur || { ...T.BASE_THEME, grad: { ...T.BASE_THEME.grad } };
}
function edit(patch, immediate) {
  const next = T.normalizeTheme({ ...editBase(), ...patch });
  commit(next, immediate);
  return next;
}

function toast(msg) {
  document.querySelectorAll('.ts-toast').forEach(x => x.remove()); // 連続操作で重ならないよう、前のものは消す
  const el = document.createElement('div');
  el.className = 'ts-toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (_) { /* フォールバックへ */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (_) { return false; }
}

/* ================================================================
   プレビュー（見本の小さな画面）
   ================================================================ */
function previewHtml(theme, selected) {
  let bg, card, accent, text3;
  if (!theme) {
    const dark = T.schemeFor({ bg: null, force: null }) === 'dark';
    bg = dark ? '#0F0E14' : '#F4F3F8'; card = dark ? '#1C1B22' : '#FFFFFF'; accent = dark ? '#9B93FF' : '#6C63D8'; text3 = dark ? '#636366' : '#C7C7CC';
  } else {
    const p = T.derivePalette(theme, T.schemeFor(theme));
    bg = theme.grad.on ? `linear-gradient(${Math.round(theme.grad.angle)}deg, ${p.bg}, ${p.bg2})` : p.bg;
    card = p.card; accent = p.accent; text3 = p.text3;
  }
  const rad = theme ? Math.round(T.RADIUS[theme.radius][1] * 0.8) : 8;
  return `<span class="ts-pv" style="background:${bg}">
    <span class="ts-pv-dot" style="background:${accent}"></span>
    <span class="ts-pv-card" style="background:${card};border-radius:${rad}px"><i style="background:${accent}"></i><b style="background:${text3}"></b></span>
    ${selected ? `<span class="ts-pv-check">${ICON('i-check', 12)}</span>` : '<span class="ts-pv-check"></span>'}
  </span>`;
}

/* ================================================================
   タブ: テーマ
   ================================================================ */
function paneThemes() {
  const cur = current();
  const presetCards = T.PRESETS.map(pr => {
    const sel = T.sameLook(cur, pr.theme);
    return `<button type="button" class="ts-preset${sel ? ' selected' : ''}" data-act="preset" data-id="${pr.id}" aria-pressed="${sel}">
      ${previewHtml(pr.theme, sel)}<span class="ts-pname">${escapeHtml(t(pr.ja, pr.en))}</span></button>`;
  }).join('');
  const stdSel = cur === null;
  const changed = JSON.stringify(undoTheme) !== JSON.stringify(cur);
  return `
    <p class="ts-note">${t('見た目を選ぶとすぐに反映されます。上に見えている画面で確かめながら選べます。', 'Your choice is applied right away — check it on the screen above the sheet.')}</p>
    <div class="ts-grid">
      <button type="button" class="ts-preset${stdSel ? ' selected' : ''}" data-act="standard" aria-pressed="${stdSel}">
        ${previewHtml(null, stdSel)}<span class="ts-pname">${t('標準', 'Default')}</span></button>
      ${presetCards}
    </div>
    <div class="ts-actions">
      <button type="button" class="ts-btn" data-act="random">${ICON('i-dice')}${t('おまかせ', 'Surprise me')}</button>
      <button type="button" class="ts-btn" data-act="goto-custom">${ICON('i-palette')}${t('細かく調整する', 'Fine-tune')}</button>
      ${changed ? `<button type="button" class="ts-btn" data-act="undo">${t('開いた時の見た目に戻す', 'Revert to how it was')}</button>` : ''}
    </div>`;
}

/* ================================================================
   タブ: カスタム
   ================================================================ */
function seg(key, value, options, disabled) {
  return `<div class="ts-seg ts-seg-inline" data-seg="${key}" role="group">${options.map(([v, label]) =>
    `<button type="button" data-v="${v}" class="${String(value) === String(v) ? 'active' : ''}" aria-pressed="${String(value) === String(v)}"${disabled ? ' disabled' : ''}>${label}</button>`).join('')}</div>`;
}
function swatches(list, selected, act) {
  return `<div class="ts-swatches">${list.map(c => `<button type="button" class="ts-sw${(selected || '').toUpperCase() === c ? ' selected' : ''}" style="background:${c}" data-act="${act}" data-v="${c}" aria-label="${c}"></button>`).join('')}</div>`;
}
function slider(key, label, min, max, value, unit, extra) {
  return `<div class="ts-row ts-stack"><div class="ts-row-label"><span>${label}</span><span class="ts-val" data-lab="${key}">${Math.round(value)}${unit || ''}</span></div>
    <input type="range" data-k="${key}" min="${min}" max="${max}" step="1" value="${Math.round(value)}"${extra && extra.cls ? ` class="${extra.cls}"` : ''} aria-label="${label}"></div>`;
}

function paneCustom() {
  const cur = current() || editBase();
  const isStd = current() === null;
  const fixedBg = !!cur.bg;
  const scheme = T.schemeFor(cur);
  const accentVal = cur.accent;
  const hue = cur.hue === null ? T.hexHue(cur.accent) : cur.hue;
  const dim = cur.wp ? '' : ' disabled';
  const font = [['system', t('各ツール標準', 'Tool default')], ['gothic', t('ゴシック', 'Gothic')], ['rounded', t('丸ゴシック', 'Rounded')], ['serif', t('明朝', 'Serif')], ['hand', t('手書き風', 'Handwritten')]];
  const fx = [['none', t('なし', 'None')], ['stars', t('星', 'Stars')], ['petals', t('花びら', 'Petals')], ['bubbles', t('シャボン玉', 'Bubbles')], ['fireflies', t('ほたる', 'Fireflies')], ['snow', t('雪', 'Snow')]];

  return `
    ${isStd ? `<p class="ts-note">${t('いまは「標準」です。何か変えると、標準の見た目をもとに着せ替えが始まります。', 'You are on the default look. Changing anything starts a custom theme from it.')}</p>` : ''}

    <div class="ts-section">${t('色', 'Color')}</div>
    <div class="ts-row">
      <div><div class="ts-row-label">${t('明るさ', 'Brightness')}</div>
        <div class="ts-row-sub">${fixedBg ? t('「好きな色」の背景では背景の色で決まります', 'Decided by your custom background color') : t('「自動」は表示設定のライト／ダークに従います', '"Auto" follows the Light / Dark setting')}</div></div>
      <div class="ts-ctrl">${seg('force', cur.force || '', [['', t('自動', 'Auto')], ['light', t('ライト', 'Light')], ['dark', t('ダーク', 'Dark')]], fixedBg)}</div>
    </div>
    <div class="ts-row ts-stack">
      <div class="ts-row-label">${t('アクセントの色', 'Accent color')}</div>
      <div class="ts-ctrl">${swatches(ACCENTS, accentVal, 'accent')}<input type="color" class="ts-color" data-k="accent" value="${accentVal.toLowerCase()}" aria-label="${t('アクセントの色', 'Accent color')}"></div>
    </div>
    <div class="ts-row">
      <div class="ts-row-label">${t('背景の色', 'Background')}</div>
      <div class="ts-ctrl">${seg('bgmode', fixedBg ? 'fixed' : 'follow', [['follow', t('アクセントに合わせる', 'Match accent')], ['fixed', t('好きな色', 'Custom')]])}</div>
    </div>
    ${fixedBg
      ? `<div class="ts-row ts-stack"><div class="ts-row-label">${t('背景の色を選ぶ', 'Pick a background color')}</div>
          <div class="ts-ctrl">${swatches(BGS, cur.bg, 'bg')}<input type="color" class="ts-color" data-k="bg" value="${cur.bg.toLowerCase()}" aria-label="${t('背景の色', 'Background color')}"></div></div>`
      : `${slider('hue', t('背景の色合い', 'Background hue'), 0, 360, hue, '°', { cls: 'ts-hue' })}
         ${slider('tint', t('背景の色の濃さ', 'Background tint'), 0, 100, cur.tint, '%')}`}

    <div class="ts-section">${t('背景', 'Backdrop')}</div>
    <div class="ts-row">
      <div class="ts-row-label">${t('グラデーション', 'Gradient')}</div>
      <div class="ts-ctrl"><label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" data-k="gradOn"${cur.grad.on ? ' checked' : ''} style="width:20px;height:20px;accent-color:var(--hub-accent);"></label></div>
    </div>
    ${cur.grad.on ? `${slider('gradShift', t('グラデーションの色のずらし', 'Gradient color shift'), -120, 120, cur.grad.shift, '°', { cls: 'ts-hue' })}
      ${slider('gradAngle', t('グラデーションの向き', 'Gradient angle'), 0, 360, cur.grad.angle, '°')}` : ''}
    <div class="ts-row">
      <div><div class="ts-row-label">${t('壁紙', 'Wallpaper')}</div>
        <div class="ts-row-sub">${T.wallpaperSupported() ? t('端末の写真を背景に敷けます（端末内にだけ保存）', 'Use a photo from this device (stored only on this device)') : t('この環境では使えません', 'Not available in this browser')}</div></div>
      <div class="ts-ctrl">
        ${cur.wp ? '<span class="ts-wp-thumb" id="tsWpThumb"></span>' : ''}
        <label class="ts-btn${T.wallpaperSupported() ? '' : ' ts-btn-off'}" style="cursor:pointer;">${ICON('i-image')}${cur.wp ? t('変更', 'Change') : t('画像を選ぶ', 'Choose')}<input type="file" accept="image/*" id="tsWpInput" style="display:none;"${T.wallpaperSupported() ? '' : ' disabled'}></label>
        ${cur.wp ? `<button type="button" class="ts-btn danger" data-act="wp-clear">${t('外す', 'Remove')}</button>` : ''}
      </div>
    </div>
    ${cur.wp ? `${slider('wpDim', t('壁紙の覆い（文字を読みやすく）', 'Wallpaper veil (for readability)'), 0, 85, cur.wpDim, '%')}
      ${slider('wpBlur', t('壁紙のぼかし', 'Wallpaper blur'), 0, 24, cur.wpBlur, 'px')}` : ''}
    <div class="ts-row">
      <div class="ts-row-label">${t('背景のきらめき', 'Ambient sparkle')}</div>
      <div class="ts-ctrl"><select class="ts-select" data-k="fx" aria-label="${t('背景のきらめき', 'Ambient sparkle')}">${fx.map(([v, l]) => `<option value="${v}"${cur.fx === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
    </div>

    <div class="ts-section">${t('かたち', 'Shape & type')}</div>
    <div class="ts-row">
      <div class="ts-row-label">${t('カードの質感', 'Card style')}</div>
      <div class="ts-ctrl">${seg('card', cur.card, [['soft', t('やわらか', 'Soft')], ['flat', t('フラット', 'Flat')], ['glass', t('ガラス', 'Glass')]])}</div>
    </div>
    <div class="ts-row">
      <div class="ts-row-label">${t('角の丸さ', 'Corners')}</div>
      <div class="ts-ctrl">${seg('radius', cur.radius, [['sharp', t('シャープ', 'Sharp')], ['normal', t('標準', 'Normal')], ['round', t('まる', 'Round')], ['pill', t('ぷっくり', 'Plump')]])}</div>
    </div>
    <div class="ts-row">
      <div class="ts-row-label">${t('フォント', 'Font')}</div>
      <div class="ts-ctrl"><select class="ts-select" data-k="font" aria-label="${t('フォント', 'Font')}">${font.map(([v, l]) => `<option value="${v}"${cur.font === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
    </div>

    <div class="ts-section">${t('お気に入りに保存', 'Save as favorite')}</div>
    <div class="ts-row" style="border-bottom:0;">
      <input type="text" class="ts-input" id="tsFavName" maxlength="24" placeholder="${t('名前（例: 夜のおうち）', 'Name (e.g. Cozy night)')}" value="${escapeHtml(cur.name && !cur.base ? cur.name : '')}">
      <button type="button" class="ts-btn primary" data-act="save-fav">${ICON('i-star')}${t('保存', 'Save')}</button>
    </div>
    <div class="ts-actions" style="margin-top:0;">
      <button type="button" class="ts-btn danger" data-act="standard">${t('標準に戻す', 'Reset to default')}</button>
      <button type="button" class="ts-btn" data-act="copy-current">${t('共有コードをコピー', 'Copy share code')}</button>
    </div>`;
}

/* ================================================================
   タブ: お気に入り
   ================================================================ */
function paneFavs() {
  const favs = T.getFavorites();
  const cur = current();
  const list = favs.length
    ? favs.map(f => {
      const sel = T.sameLook(cur, f.theme);
      const name = renamingId === f.id
        ? `<input type="text" class="ts-input" id="tsRenameInput" maxlength="24" value="${escapeHtml(f.name)}" style="flex:1 1 auto;font-size:14px;padding:6px 9px;">`
        : `<span class="ts-fav-name">${escapeHtml(f.name)}</span>`;
      return `<div class="ts-fav" data-id="${f.id}">
        <button type="button" class="ts-fav-main" data-act="fav-apply" aria-label="${t('適用', 'Apply')}: ${escapeHtml(f.name)}" style="display:flex;align-items:center;gap:12px;">
          ${previewHtml(f.theme, sel)}
          <span style="min-width:0;display:block;flex:1;">${renamingId === f.id ? '' : name}<span class="ts-fav-sub">${sel ? t('使用中', 'In use') : (f.theme.fx !== 'none' ? t('きらめきあり', 'With sparkle') : '&nbsp;')}</span></span>
        </button>
        ${renamingId === f.id ? name : ''}
        <div class="ts-fav-ops">
          <button type="button" class="ts-icon-btn" data-act="fav-rename" aria-label="${t('名前を変える', 'Rename')}">${ICON('i-edit', 15)}</button>
          <button type="button" class="ts-icon-btn" data-act="fav-copy" aria-label="${t('共有コードをコピー', 'Copy share code')}">${ICON('i-sync', 15)}</button>
          <button type="button" class="ts-icon-btn danger" data-act="fav-del" aria-label="${t('削除', 'Delete')}">${ICON('i-close', 15)}</button>
        </div>
      </div>`;
    }).join('')
    : `<div class="ts-empty">${t('まだお気に入りはありません。<br>「カスタム」で見た目を作って、保存してみてください。', 'No favorites yet.<br>Build a look in "Custom" and save it here.')}</div>`;
  return `
    <p class="ts-note">${t(`お気に入りは${T.MAX_FAVORITES}個まで保存できます。タップで適用します。`, `Up to ${T.MAX_FAVORITES} favorites. Tap one to apply it.`)}</p>
    <div>${list}</div>
    <div class="ts-section">${t('共有コードから追加', 'Add from a share code')}</div>
    <textarea class="ts-code" id="tsCode" placeholder="skyhub1:…" spellcheck="false" aria-label="${t('共有コード', 'Share code')}"></textarea>
    <div class="ts-actions"><button type="button" class="ts-btn primary" data-act="import-code">${t('お気に入りに追加', 'Add to favorites')}</button></div>
    <p class="ts-note" style="margin-top:8px;">${t('壁紙は端末の画像なので、共有コードには含まれません。', 'Wallpapers are photos on this device, so they are not part of share codes.')}</p>`;
}

/* ================================================================
   描画・イベント
   ================================================================ */
const TABS = () => [['themes', t('テーマ', 'Themes')], ['custom', t('カスタム', 'Custom')], ['favs', t('お気に入り', 'Favorites')]];

function renderTabs() {
  rootEl.querySelector('#tsTabs').innerHTML = TABS().map(([k, l]) =>
    `<button type="button" role="tab" data-tab="${k}" class="${tab === k ? 'active' : ''}" aria-selected="${tab === k}">${l}</button>`).join('');
}

function renderPane() {
  const pane = rootEl.querySelector('#tsPane');
  const scroller = rootEl;
  const top = scroller.scrollTop;
  pane.innerHTML = tab === 'themes' ? paneThemes() : tab === 'custom' ? paneCustom() : paneFavs();
  scroller.scrollTop = top;
  renderTabs();
  fillWallpaperThumb();
  if (renamingId) { const i = pane.querySelector('#tsRenameInput'); if (i) { i.focus(); i.select(); } }
}

async function fillWallpaperThumb() {
  const el = rootEl && rootEl.querySelector('#tsWpThumb');
  const cur = current();
  if (!el || !cur || !cur.wp) return;
  const token = ++lastThumbToken;
  try {
    const url = await T.getWallpaperUrl(cur.wp);
    if (token === lastThumbToken && url) el.style.backgroundImage = `url("${url}")`;
  } catch (_) { /* サムネイルが無くても動作に支障はない */ }
}

function setTab(k) { tab = k; renamingId = null; renderPane(); }

function onClick(e) {
  const tabBtn = e.target.closest('[data-tab]');
  if (tabBtn) { setTab(tabBtn.dataset.tab); return; }

  const segBtn = e.target.closest('[data-seg] button');
  if (segBtn && !segBtn.disabled) {
    const key = segBtn.closest('[data-seg]').dataset.seg;
    const v = segBtn.dataset.v;
    if (key === 'bgmode') {
      const cur = editBase();
      if (v === 'fixed') edit({ bg: T.derivePalette(cur, T.schemeFor(cur)).bg, force: null }, true);
      else edit({ bg: null }, true);
    } else if (key === 'force') edit({ force: v || null }, true);
    else edit({ [key]: v }, true);
    renderPane();
    return;
  }

  const actEl = e.target.closest('[data-act]');
  if (!actEl || !rootEl.contains(actEl)) return;
  const act = actEl.dataset.act;
  const id = actEl.dataset.id || (actEl.closest('[data-id]') && actEl.closest('[data-id]').dataset.id);

  switch (act) {
    case 'standard':
      commit(null, true); T.pruneWallpapers(); renderPane(); break;
    case 'preset': {
      const pr = T.PRESETS.find(p => p.id === id);
      if (pr) { commit(T.normalizeTheme(pr.theme), true); T.pruneWallpapers(); renderPane(); }
      break;
    }
    case 'random': commit(T.randomTheme(), true); T.pruneWallpapers(); renderPane(); break;
    case 'goto-custom': setTab('custom'); break;
    case 'undo': commit(undoTheme, true); T.pruneWallpapers(); renderPane(); break;
    case 'accent': edit({ accent: actEl.dataset.v }, true); renderPane(); break;
    case 'bg': edit({ bg: actEl.dataset.v }, true); renderPane(); break;
    case 'wp-clear': edit({ wp: null }, true); T.pruneWallpapers(); renderPane(); break;
    case 'save-fav': {
      const cur = current();
      if (!cur) { toast(t('先に見た目を変えてから保存してください', 'Change the look first, then save it')); break; }
      const name = rootEl.querySelector('#tsFavName').value;
      const fav = T.addFavorite(name, cur);
      if (!fav) { toast(t(`お気に入りは${T.MAX_FAVORITES}個までです`, `Up to ${T.MAX_FAVORITES} favorites`)); break; }
      toast(t(`「${fav.name}」をお気に入りに保存しました`, `Saved "${fav.name}" to favorites`));
      break;
    }
    case 'copy-current': {
      const cur = current();
      if (!cur) { toast(t('標準の見た目は共有コードがありません', 'The default look has no share code')); break; }
      copyText(T.exportThemeCode(cur)).then(ok => toast(ok ? t('共有コードをコピーしました', 'Share code copied') : t('コピーできませんでした', 'Could not copy')));
      break;
    }
    case 'fav-apply': {
      const f = T.getFavorites().find(x => x.id === id);
      if (f) { commit(T.normalizeTheme(f.theme), true); T.pruneWallpapers(); renderPane(); }
      break;
    }
    case 'fav-rename': renamingId = renamingId === id ? null : id; renderPane(); break;
    case 'fav-copy': {
      const f = T.getFavorites().find(x => x.id === id);
      if (f) copyText(T.exportThemeCode(f.theme)).then(ok => toast(ok ? t('共有コードをコピーしました', 'Share code copied') : t('コピーできませんでした', 'Could not copy')));
      break;
    }
    case 'fav-del': {
      const f = T.getFavorites().find(x => x.id === id);
      if (f && window.confirm(t(`「${f.name}」を削除します。よろしいですか？`, `Delete "${f.name}"?`))) { T.removeFavorite(id); renderPane(); }
      break;
    }
    case 'import-code': {
      const code = rootEl.querySelector('#tsCode').value;
      const th = T.importThemeCode(code);
      if (!th) { toast(t('共有コードを読み取れませんでした', 'That share code could not be read')); break; }
      const fav = T.addFavorite(th.name || t('共有されたテーマ', 'Shared theme'), th);
      if (!fav) { toast(t(`お気に入りは${T.MAX_FAVORITES}個までです`, `Up to ${T.MAX_FAVORITES} favorites`)); break; }
      toast(t(`「${fav.name}」を追加しました`, `Added "${fav.name}"`));
      renderPane();
      break;
    }
    default: break;
  }
}

function onInput(e) {
  const el = e.target;
  const k = el.dataset && el.dataset.k;
  if (!k) return;
  const v = el.type === 'range' ? Number(el.value) : el.value;
  const lab = rootEl.querySelector(`[data-lab="${k}"]`);
  if (lab && el.type === 'range') lab.textContent = `${v}${k === 'wpBlur' ? 'px' : k === 'tint' || k === 'wpDim' ? '%' : '°'}`;
  const cur = editBase();
  switch (k) {
    case 'accent': edit({ accent: v }); break;
    case 'bg': edit({ bg: v }); break;
    case 'hue': edit({ hue: v }); break;
    case 'tint': edit({ tint: v }); break;
    case 'gradShift': edit({ grad: { ...cur.grad, shift: v } }); break;
    case 'gradAngle': edit({ grad: { ...cur.grad, angle: v } }); break;
    case 'wpDim': edit({ wpDim: v }); break;
    case 'wpBlur': edit({ wpBlur: v }); break;
    default: break;
  }
}

async function onChange(e) {
  const el = e.target;
  if (el.id === 'tsWpInput') {
    const file = el.files && el.files[0];
    el.value = '';
    if (!file) return;
    try {
      const wp = await T.saveWallpaperFile(file);
      edit({ wp }, true);
      T.pruneWallpapers();
      renderPane();
    } catch (_) { toast(t('画像を読み込めませんでした', 'Could not load that image')); }
    return;
  }
  const k = el.dataset && el.dataset.k;
  if (!k) return;
  if (k === 'gradOn') { const cur = editBase(); edit({ grad: { ...cur.grad, on: el.checked } }, true); renderPane(); }
  else if (k === 'fx') edit({ fx: el.value }, true);
  else if (k === 'font') edit({ font: el.value }, true);
  else if (k === 'accent' || k === 'bg') { flushNow(); renderPane(); }
}

function flushNow() { if (raf) cancelAnimationFrame(raf); flush(); }

function onKeydown(e) {
  if (e.target.id === 'tsRenameInput') {
    if (e.key === 'Enter') { e.preventDefault(); finishRename(true); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finishRename(false); }
  }
}
function finishRename(save) {
  const input = rootEl.querySelector('#tsRenameInput');
  if (!input || !renamingId) return;
  const id = renamingId;
  renamingId = null;
  if (save) T.renameFavorite(id, input.value);
  renderPane();
}

/* ================================================================
   表示と取り外し（表示設定のシート本体に差し込む）
   ================================================================ */
function onFocusout(e) { if (e.target.id === 'tsRenameInput') setTimeout(() => finishRename(true), 0); }

/**
 * 表示設定のシート本体（cardEl）を着せ替え画面にする。
 * @param {HTMLElement} cardEl 表示設定の .modal-card
 * @param {{onBack?: () => void, onClose?: () => void, initialTab?: string}} opts
 *   onBack: 「‹ 表示設定」を押した時（設定画面を描き直す）／onClose: ×を押した時（シートごと閉じる）
 */
export function mount(cardEl, opts = {}) {
  unmount();
  rootEl = cardEl;
  host = { onBack: opts.onBack, onClose: opts.onClose };
  undoTheme = T.getActiveTheme();
  pending = undefined;
  renamingId = null;
  tab = ['themes', 'custom', 'favs'].includes(opts.initialTab) ? opts.initialTab : 'themes';

  rootEl.classList.add('ts-card');
  rootEl.innerHTML = `
    <button type="button" class="modal-close-btn" id="tsClose" aria-label="${t('閉じる', 'Close')}">${ICON('i-close')}</button>
    <button type="button" class="ts-back" id="tsBack">${ICON('i-chevron-left', 18)}<span>${t('表示設定', 'Display Settings')}</span></button>
    <div class="modal-title">${t('着せ替え', 'Themes')}</div>
    <div class="ts-seg" id="tsTabs" role="tablist"></div>
    <div id="tsPane"></div>`;
  rootEl.addEventListener('click', onClick);
  rootEl.addEventListener('input', onInput);
  rootEl.addEventListener('change', onChange);
  rootEl.addEventListener('keydown', onKeydown);
  rootEl.addEventListener('focusout', onFocusout);
  rootEl.querySelector('#tsClose').addEventListener('click', () => { const h = host; unmount(); if (h && h.onClose) h.onClose(); });
  rootEl.querySelector('#tsBack').addEventListener('click', () => { const h = host; unmount(); if (h && h.onBack) h.onBack(); });
  rootEl.scrollTop = 0;
  renderPane();
}

/** 着せ替え画面を取り外す（保留中の変更は反映してから）。表示設定が閉じる時・戻る時に呼ぶ */
export function unmount() {
  if (!rootEl) return;
  flushNow();
  rootEl.removeEventListener('click', onClick);
  rootEl.removeEventListener('input', onInput);
  rootEl.removeEventListener('change', onChange);
  rootEl.removeEventListener('keydown', onKeydown);
  rootEl.removeEventListener('focusout', onFocusout);
  rootEl.classList.remove('ts-card');
  rootEl = null;
  host = null;
}

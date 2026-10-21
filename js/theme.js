/* ================================================================
   theme.js — 着せ替え（テーマ）エンジン

   「アクセント色」と「背景の色合い」の2つを軸に、画面全体の配色を自動で
   生成して、ハブ共通のトークン(--hub-*)と、各ツールがそれぞれ持っている
   色トークンの両方へ流し込む。ツールごとに色の変数名が違う（--card /
   --sc-card / --card-bg / --pv-panel …）ため、ツール別の対応表を
   TOOL_MAPS に持っている。

   ── 設計の要点 ─────────────────────────────────────────────
   ・文字色・区切り線・アクセントの文字用/塗り用の各バリエーションは、
     背景色から計算して必ず読めるコントラストになるよう補正する。
     利用者がどんな色を選んでも「文字が読めない」状態にならないための
     安全弁（ensureContrast）。
   ・「アクセントに合わせる」背景は、既存の ライト/ダーク/システム 切替に
     追従する（同じテーマでライト・ダークの両方が作られる）。「好きな色」
     の背景や 明るさ固定 のテーマは、切替に関わらずその明るさで固定する。
   ・意味を持つ色（所持=緑・課金=橙・警告=赤など）は上書きしない。
     上書きするのは「主役の色」（リンク・ボタン・強調）と面の色のみ。
   ・生成したCSSは <style id="hub-theme-style"> に入れ、index.html の
     描画前スクリプトが同じCSSをlocalStorageのキャッシュから先に差し込む
     （起動時に標準の配色が一瞬見えるちらつきを防ぐ）。セレクタは
     :root[data-hub-theme] を付けて詳細度を上げ、各ツールのCSSより
     後から読み込まれたり、ダーク用の上書きがあっても必ず勝つようにする。
   ・外部入力（共有コード・バックアップのインポート）は必ず
     normalizeTheme() を通す。色は #RRGGBB のみ、列挙値は許可リストのみ。
   ================================================================ */
import { resolveSkyTheme, getSkyThemeMode } from './state.js';
import { setFx } from './theme-fx.js';

export const THEME_KEY = 'sky_hub_theme_v1';
export const THEME_CSS_KEY = 'sky_hub_theme_css_v1';
export const MAX_FAVORITES = 24;
const STYLE_ID = 'hub-theme-style';
const FONT_LINK_ID = 'hub-theme-font';

/* ================================================================
   色ユーティリティ
   ================================================================ */
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

export function isHex(c) { return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c); }

export function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function toHex({ r, g, b }) {
  return '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
}
export function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h, s, l };
}
function hslToRgb({ h, s, l }) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}
export function hsl(h, s, l) { return toHex(hslToRgb({ h, s: clamp(s, 0, 1), l: clamp(l, 0, 1) })); }
export function hexHue(hex) { return rgbToHsl(hexToRgb(hex)).h; }

function lum(hex) {
  const { r, g, b } = hexToRgb(hex);
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return toHex({ r: A.r + (B.r - A.r) * t, g: A.g + (B.g - A.g) * t, b: A.b + (B.b - A.b) * t });
}
function rgba(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
// fg の色味はそのままに明度だけを動かし、bgs（文字が載りうる複数の面）のすべてで対比が min 以上に
// なる、元の明度に最も近い値を選ぶ。背景が中間の明るさでも、カード・背景・塗りのどの上でも読める。
// 条件を満たす明度が無い場合は、最も対比が高くなるものを返す。
function ensureContrast(fg, bgs, min) {
  const list = Array.isArray(bgs) ? bgs : [bgs];
  const h = rgbToHsl(hexToRgb(fg));
  const worst = l => { const col = hsl(h.h, h.s, l); return Math.min(...list.map(b => contrast(col, b))); };
  if (worst(h.l) >= min) return fg;
  let best = null, bestScore = -1, fallback = h.l, fallbackScore = -1;
  for (let k = 0; k <= 100; k++) {
    const l = k / 100;
    const s = worst(l);
    if (s > fallbackScore) { fallbackScore = s; fallback = l; }
    if (s >= min) {
      const d = Math.abs(l - h.l);
      if (best === null || d < bestScore) { best = l; bestScore = d; }
    }
  }
  return hsl(h.h, h.s, best !== null ? best : fallback);
}
// 白い文字を載せても読める（対比 min 以上）まで暗くする
function darkenForWhiteText(c, min) {
  const h = rgbToHsl(hexToRgb(c));
  let l = h.l;
  for (let i = 0; i < 60 && contrast(hsl(h.h, h.s, l), '#ffffff') < min; i++) l -= 0.015;
  return hsl(h.h, h.s, clamp(l, 0, 1));
}

/* ================================================================
   テーマの形・正規化
   ================================================================ */
export const RADIUS = { sharp: [6, 4], normal: [16, 10], round: [22, 14], pill: [28, 18] };
export const CARDS = ['soft', 'flat', 'glass'];
export const FX_KINDS = ['none', 'stars', 'petals', 'bubbles', 'fireflies', 'snow'];
export const FORCES = [null, 'light', 'dark'];
export const FONTS = {
  system: { stack: null, href: null },
  gothic: {
    stack: "'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', -apple-system, BlinkMacSystemFont, sans-serif",
    // item.cssの常時@importをやめたので、この書体を選んだ時だけ読み込む
    href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap',
  },
  rounded: {
    stack: "'Zen Maru Gothic', 'Hiragino Maru Gothic ProN', 'Noto Sans JP', sans-serif",
    href: 'https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700&display=swap',
  },
  serif: {
    stack: "'Shippori Mincho', 'Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', serif",
    href: 'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500;700&display=swap',
  },
  hand: {
    stack: "'Yomogi', 'Zen Kurenaido', 'Hiragino Maru Gothic ProN', cursive",
    href: 'https://fonts.googleapis.com/css2?family=Yomogi&display=swap',
  },
};

export const BASE_THEME = Object.freeze({
  v: 1, name: '', base: '',
  accent: '#6C63D8',
  hue: null,          // 背景の色合い(0-360)。null＝アクセント色に合わせる
  tint: 40,           // 背景に乗せる色の濃さ(0-100)
  bg: null,           // 「好きな色」の背景(#RRGGBB)。指定時は明るさもこの色から決まる
  force: null,        // 明るさの固定: null(切替に従う) / 'light' / 'dark'
  grad: { on: false, shift: -30, angle: 160 },
  card: 'soft', radius: 'normal', font: 'system', fx: 'none',
  wp: null, wpDim: 35, wpBlur: 0,
});

const num = (v, a, b, d) => (typeof v === 'number' && isFinite(v) ? clamp(v, a, b) : d);

/** 外部から来た値（保存データ・共有コード・バックアップ）を安全な形に整える */
export function normalizeTheme(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const g = r.grad && typeof r.grad === 'object' ? r.grad : {};
  const B = BASE_THEME;
  return {
    v: 1,
    name: typeof r.name === 'string' ? r.name.slice(0, 24) : '',
    base: typeof r.base === 'string' && /^[a-z0-9_-]{0,24}$/.test(r.base) ? r.base : '',
    accent: isHex(r.accent) ? r.accent.toUpperCase() : B.accent,
    hue: r.hue === null || r.hue === undefined ? null : num(r.hue, 0, 360, null),
    tint: num(r.tint, 0, 100, B.tint),
    bg: isHex(r.bg) ? r.bg.toUpperCase() : null,
    force: FORCES.includes(r.force) ? r.force : null,
    grad: {
      on: !!g.on,
      shift: num(g.shift, -120, 120, B.grad.shift),
      angle: num(g.angle, 0, 360, B.grad.angle),
    },
    card: CARDS.includes(r.card) ? r.card : B.card,
    radius: Object.prototype.hasOwnProperty.call(RADIUS, r.radius) ? r.radius : B.radius,
    font: Object.prototype.hasOwnProperty.call(FONTS, r.font) ? r.font : B.font,
    fx: FX_KINDS.includes(r.fx) ? r.fx : B.fx,
    wp: typeof r.wp === 'string' && /^[a-z0-9_-]{1,40}$/i.test(r.wp) ? r.wp : null,
    wpDim: num(r.wpDim, 0, 85, B.wpDim),
    wpBlur: num(r.wpBlur, 0, 24, B.wpBlur),
  };
}

/** 見た目に関わる項目だけで同じかどうか（名前・ベース名は無視）。プリセットの選択表示に使う */
export function sameLook(a, b) {
  if (!a || !b) return !a && !b;
  const strip = t => { const n = normalizeTheme(t); n.name = ''; n.base = ''; return JSON.stringify(n); };
  return strip(a) === strip(b);
}

/* ================================================================
   プリセット（着せ替えの見本）
   ================================================================ */
const P = (id, ja, en, t) => ({ id, ja, en, theme: normalizeTheme({ ...t, base: id, name: ja }) });
export const PRESETS = [
  P('sakura', '桜', 'Sakura', { accent: '#E9578A', hue: 340, tint: 55, radius: 'round', fx: 'petals', font: 'rounded' }),
  P('mint', 'ミント', 'Mint', { accent: '#14A37F', hue: 165, tint: 45, radius: 'round', card: 'soft' }),
  P('sunset', '夕焼け', 'Sunset', { accent: '#F2603D', hue: 22, tint: 60, grad: { on: true, shift: -38, angle: 165 }, card: 'glass' }),
  P('lavender', 'ラベンダー', 'Lavender', { accent: '#8466E8', hue: 265, tint: 50, radius: 'round', grad: { on: true, shift: 28, angle: 150 } }),
  P('lemon', 'レモンスカッシュ', 'Lemon Soda', { accent: '#D9A000', hue: 50, tint: 55, card: 'flat', radius: 'pill' }),
  P('ocean', '海', 'Ocean', { accent: '#1E88E5', hue: 205, tint: 50, grad: { on: true, shift: 24, angle: 170 }, fx: 'bubbles' }),
  P('forest', '森', 'Forest', { accent: '#2F9E5B', hue: 140, tint: 45, fx: 'fireflies', font: 'serif' }),
  P('night', '夜空', 'Night Sky', { accent: '#7F86FF', hue: 240, tint: 75, force: 'dark', grad: { on: true, shift: 34, angle: 170 }, fx: 'stars', card: 'glass' }),
  P('milktea', 'ミルクティー', 'Milk Tea', { accent: '#B0794C', hue: 30, tint: 45, radius: 'round', font: 'serif', card: 'flat' }),
  P('neon', 'ネオン', 'Neon', { accent: '#FF2BD6', hue: 300, tint: 80, force: 'dark', radius: 'sharp', fx: 'fireflies', card: 'glass', grad: { on: true, shift: -40, angle: 200 } }),
  P('autumn', '紅葉', 'Autumn', { accent: '#D8532A', hue: 18, tint: 55, fx: 'petals', font: 'serif' }),
  P('winter', '雪', 'Snow', { accent: '#4A86C5', hue: 210, tint: 30, force: 'light', fx: 'snow', card: 'glass', radius: 'round' }),
  P('gold', '黄金', 'Golden', { accent: '#D4A02C', hue: 42, tint: 55, force: 'dark', fx: 'stars', font: 'serif', radius: 'sharp' }),
  P('mono', 'モノクロ', 'Mono', { accent: '#6B7280', hue: 220, tint: 5, card: 'flat', radius: 'sharp', font: 'gothic' }),
];

/** おまかせ生成: 調和する色の組み合わせをランダムに作る */
export function randomTheme() {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const hue = Math.floor(Math.random() * 360);
  const accent = hsl(hue + (Math.random() < 0.5 ? 0 : 18), 0.6 + Math.random() * 0.25, 0.48 + Math.random() * 0.08);
  return normalizeTheme({
    accent, hue, tint: 30 + Math.floor(Math.random() * 45),
    force: Math.random() < 0.3 ? 'dark' : null,
    grad: { on: Math.random() < 0.55, shift: pick([-40, -28, 28, 40]), angle: pick([135, 160, 180, 200]) },
    card: pick(['soft', 'glass', 'flat']), radius: pick(['normal', 'round', 'round', 'pill']),
    font: pick(['system', 'rounded', 'serif']), fx: pick(['none', 'none', 'stars', 'petals', 'bubbles', 'fireflies']),
    name: '',
  });
}

/* ================================================================
   配色の生成
   ================================================================ */
export function schemeFor(theme) {
  if (theme.bg) return lum(theme.bg) < 0.18 ? 'dark' : 'light';
  if (theme.force) return theme.force;
  const mode = getSkyThemeMode();
  return resolveSkyTheme(mode === 'system' ? null : mode);
}

export function derivePalette(theme, scheme) {
  const dark = scheme === 'dark';
  const aHsl = rgbToHsl(hexToRgb(theme.accent));
  const tint = theme.tint / 100;

  let bg;
  if (theme.bg) {
    bg = theme.bg;
  } else {
    const h = theme.hue === null ? aHsl.h : theme.hue;
    bg = dark ? hsl(h, 0.10 + 0.30 * tint, 0.075 + 0.04 * tint) : hsl(h, 0.10 + 0.55 * tint, 0.965 - 0.07 * tint);
  }
  const bgH = rgbToHsl(hexToRgb(bg));
  const ink = dark ? hsl(bgH.h, 0.14, 0.95) : hsl(bgH.h, 0.28, 0.10);
  const card = dark ? mix(bg, '#ffffff', 0.065) : mix(bg, '#ffffff', 0.62);
  const surface2 = dark ? mix(card, '#ffffff', 0.04) : mix(card, bg, 0.5);
  const fill = dark ? mix(bg, '#ffffff', 0.11) : mix(bg, ink, 0.07);
  const text = ink;
  // 文字が載る面（カード・背景・塗り）のどれの上でも読めるようにする
  const faces = [card, bg, fill];
  const text2 = ensureContrast(mix(ink, bg, 0.42), faces, 4.5);
  // 補助文字（ヒント・注記）は読めることを優先して、対比3.2以上を保証する
  const text3 = ensureContrast(mix(ink, bg, 0.6), faces, 3.2);
  const sep = rgba(ink, dark ? 0.16 : 0.12);

  const accent = theme.accent;
  const accentFill = darkenForWhiteText(accent, 3.0);
  const accentSolid = darkenForWhiteText(accent, 4.5);
  const accentInk = ensureContrast(accent, [...faces, mix(card, accent, 0.12)], 4.5);
  const accentBg = rgba(accent, dark ? 0.2 : 0.12);

  const a2 = hsl(aHsl.h + 38, Math.max(aHsl.s * 0.9, 0.35), aHsl.l);
  const accent2Fill = darkenForWhiteText(a2, 3.0);
  const accent2Ink = ensureContrast(a2, [...faces, mix(card, a2, 0.12)], 4.5);
  const accent2Bg = rgba(a2, dark ? 0.2 : 0.12);

  // グラデーションの終点: 背景の色相をずらし、明るさをほんの少し動かす
  let bg2 = bg;
  if (theme.grad.on) {
    bg2 = hsl(bgH.h + theme.grad.shift, clamp(bgH.s * 1.05 + 0.04, 0, 1), clamp(bgH.l + (dark ? 0.035 : -0.035), 0, 1));
  }

  // 金（アクセント）のグラデーション面に載せる文字色: 濃紺か白のうち、面のどちらの端でも読める方
  const accentLight = mix(accent, '#ffffff', 0.38);
  const worst = col => Math.min(contrast(col, accentLight), contrast(col, accentFill));
  const onGold = worst('#1B1B3A') >= worst('#ffffff') ? '#1B1B3A' : '#ffffff';
  // 意味色（エラー赤）は色味を保ったまま、その面で読める濃さにだけ補正する
  const redInk = ensureContrast('#FF3B30', faces, 4.5);

  // 白い文字を載せる大きなカード用の「深い色」。accentSolid（白文字で4.5以上）をさらに暗くした
  // グラデーションの終点と、アクセントの色相を帯びた夜色（暗い面。白文字がいつでも読める）
  const accentDeep = mix(accentSolid, '#000000', 0.38);
  const night1 = hsl(aHsl.h, 0.30, 0.17);
  const night2 = hsl(aHsl.h, 0.34, 0.06);

  const [r, rs] = RADIUS[theme.radius];
  const glassA = theme.card === 'glass';
  return {
    dark, bg, bg2, card, surface2, fill, ink, text, text2, text3, sep,
    accent, accentFill, accentSolid, accentInk, accentBg,
    a2, accent2Fill, accent2Ink, accent2Bg,
    accentLight, onGold, redInk, accentDeep, night1, night2,
    glass: rgba(card, dark ? 0.68 : 0.72),
    // 「ガラス」の質感では、カードの面をやや透かす
    cardSurface: glassA ? rgba(card, dark ? 0.55 : 0.62) : card,
    r, rs,
    shadow: theme.card === 'flat' ? 'none' : (dark ? '0 1px 6px rgba(0,0,0,0.35)' : `0 1px 6px ${rgba(ink, 0.10)}`),
  };
}

/* ================================================================
   CSSの生成（ツール別の対応表）
   ================================================================ */
const R = ':root[data-hub-theme]';
const decl = o => Object.entries(o).map(([k, v]) => `${k}:${v}`).join(';');
const rule = (sel, o) => `${sel}{${decl(o)}}`;

// 各ツールのビュー直下のルート要素。背景を透明にして、背景グラデーション・壁紙・きらめきを透かす
const VIEW_ROOTS = [
  '.item-view', '.emote-view', '.share-view', '.nomacan-view', '.nomacan-pro-view', '.star-candle-view',
  '.wings-view', '.companion-view', '.spirit-catalog-view', '.tai-revisit-view', '.tai-score-view',
  '.tai-card-view', '.data-transfer-view', '.tai-info-view', '.profile-view',
];

// 面（背景・カード・区切り・文字）の共通トークンを、ツールごとの変数名へ割り当てる
const TOOL_MAPS = [
  ['.item-view', p => ({
    '--bg': p.bg, '--card': p.cardSurface, '--sep': p.sep, '--text': p.text, '--text-2': p.text2, '--text-3': p.text3,
    '--blue': p.accentInk, '--blue-bg': p.accentBg, '--purple': p.accentInk, '--purple-bg': p.accentBg,
    '--tile-btn-bg': p.dark ? 'rgba(60, 60, 60, 0.55)' : 'rgba(255, 255, 255, 0.6)',
  })],
  ['.emote-view', p => ({
    '--bg': p.bg, '--card': p.cardSurface, '--sep': p.sep, '--text': p.text, '--text-2': p.text2, '--text-3': p.text3,
    '--blue': p.accentInk, '--blue-bg': p.accentBg, '--blue-solid': p.accentSolid, '--own-all-blue': p.accentInk,
    // emote では橙が「主役の色」（意味色ではない）なので、アクセント色に揃える
    '--orange': p.accentFill, '--orange-d': p.accentInk, '--orange-bg': p.accentBg, '--red': p.redInk,
  })],
  ['.wings-view', p => ({
    '--bg': p.bg, '--card': p.cardSurface, '--sep': p.sep, '--text': p.text, '--text-2': p.text2, '--text-3': p.text3,
    '--blue': p.accentInk, '--blue-bg': p.accentBg, '--blue-solid': p.accentSolid,
    '--orange': p.accentFill, '--orange-d': p.accentInk, '--orange-bg': p.accentBg, '--red': p.redInk,
  })],
  ['.share-view', p => ({
    '--card': p.cardSurface, '--bg2': p.surface2, '--fill': p.fill, '--fill-2': p.fill, '--sep': p.sep,
    '--text': p.text, '--text-2': p.text2, '--blue': p.accentInk, '--blue-solid': p.accentSolid, '--indigo-text': p.accent2Ink,
    '--glass-bg': p.glass, '--input-bg': p.surface2, '--red': p.redInk,
  })],
  ['.spirit-catalog-view', p => ({
    '--sc-bg': p.bg, '--sc-card': p.cardSurface, '--sc-sep': p.sep, '--sc-text': p.text, '--sc-text-2': p.text2, '--sc-text-3': p.text3,
    '--sc-blue': p.accentInk, '--sc-blue-bg': p.accentBg, '--sc-r': p.r + 'px', '--sc-r-sm': p.rs + 'px',
  })],
  ['.tai-revisit-view', p => ({
    '--bg': p.bg, '--card': p.cardSurface, '--sep': p.sep, '--text': p.text, '--text-2': p.text2, '--text-3': p.text3,
    '--cyan': p.accentFill, '--cyan-d': p.accentInk, '--cyan-bg': p.accentBg, '--red': p.redInk,
  })],
  ['.tai-info-view', p => ({
    '--bg': p.bg, '--card': p.cardSurface, '--sep': p.sep, '--text': p.text, '--text-2': p.text2, '--text-3': p.text3,
    '--indigo': p.accentFill, '--indigo-d': p.accentInk, '--indigo-bg': p.accentBg,
  })],
  ['.data-transfer-view', p => ({
    '--bg': p.bg, '--card': p.cardSurface, '--sep': p.sep, '--text': p.text, '--text-2': p.text2, '--text-3': p.text3,
    '--purple': p.accentFill, '--purple-d': p.accentInk, '--purple-bg': p.accentBg, '--blue': p.accentInk, '--red': p.redInk,
  })],
  ['.tai-score-view', p => ({
    '--bg': p.bg, '--card': p.cardSurface, '--sep': p.sep, '--text': p.text, '--text-2': p.text2, '--text-3': p.text3,
    '--pink': p.accentFill, '--pink-d': p.accentInk, '--pink-bg': p.accentBg, '--pink-btn': p.accentSolid,
    '--note-on': p.accentFill, '--note-off': p.fill, '--blue': p.accentInk, '--red': p.redInk, '--red-d': p.redInk,
  })],
  ['.tai-score-view .compose-overlay', p => ({
    '--timeline-tile-bg': p.card, '--timeline-tile-bg-2': p.surface2, '--timeline-tile-border': p.sep, '--timeline-lane-bg': p.accentBg,
  })],
  ['.profile-view', p => ({
    '--pv-bg': p.bg, '--pv-panel': p.cardSurface, '--pv-panel-alt': p.surface2, '--pv-row': p.surface2, '--pv-border': p.sep,
    '--pv-border-strong': rgba(p.accent, 0.45), '--pv-text': p.text, '--pv-text-muted': p.text2,
    '--pv-sky': p.accentInk, '--pv-sky-bright': p.accentInk, '--pv-sky-deep': p.accentFill, '--pv-sky-deep-contrast': p.accentSolid,
    '--pv-indigo': p.accent2Fill, '--pv-indigo-contrast': p.accent2Ink, '--pv-radius': p.r + 'px',
  })],
  ['.companion-view', p => ({
    '--bg-color': p.bg, '--card-bg': p.cardSurface, '--text-color': p.text, '--text-gray': p.text2,
    '--accent-blue': p.accentInk, '--accent-blue-solid': p.accentSolid, '--accent-purple': p.accent2Ink,
    '--border-color': p.sep, '--input-bg': p.surface2, '--tab-bg': p.fill, '--tab-btn-active': p.card, '--stat-box-bg': p.surface2,
  })],
  ['.nomacan-view', p => ({
    '--cream': p.bg, '--cream-deep': p.surface2, '--card-bg': p.cardSurface, '--amber': p.accentFill, '--amber-light': p.accentLight,
    '--amber-solid': p.accentSolid, '--amber-deep': p.accentInk, '--amber-deep-bg': p.accentBg,
    '--text': p.text, '--text-dim': p.text2, '--border': p.sep,
  })],
  ['.nomacan-pro-view', p => ({
    '--npb-bg': p.bg, '--npb-card': p.cardSurface, '--npb-text': p.text, '--npb-text-2': p.text2, '--npb-border': p.sep,
    '--npb-input-bg': p.surface2, '--npb-stat-bg': p.surface2, '--npb-blue': p.accentInk,
  })],
  ['.star-candle-view, ' + R + ' .sc-shard-cal-card', p => ({
    '--indigo': p.bg, '--violet': p.card, '--violet-deep': p.surface2, '--gold': p.accentFill, '--gold-light': p.accentLight,
    '--cream': p.text, '--lavender': p.text2, '--text-dim': p.text3, '--card-bg': p.dark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.55)', '--card-border': p.sep,
  })],
  ['.tai-card-view', p => ({
    '--tc-surface': p.cardSurface, '--tc-surface-2': p.surface2, '--tc-surface-3': p.fill, '--tc-border': p.sep,
    '--tc-text': p.text, '--tc-text-2': p.text2, '--tc-text-3': p.text3,
    // tai-card では「ティール」が主役（見出し・スイッチ・ボタン）、「ゴールド」が補助色
    '--tc-teal': p.accentFill, '--tc-teal-ink': p.accentInk, '--tc-teal-bg': p.accentBg,
    '--tc-gold': p.accent2Fill, '--tc-gold-ink': p.accent2Ink, '--tc-gold-bg': p.accent2Bg,
    '--tc-r': p.r + 'px', '--tc-r-sm': p.rs + 'px',
  })],
];

// 配色トークンだけでは追従しない「主役の色」（固定の橙・グラデーション等を直書きしている箇所）を
// アクセント色に揃えるための個別ルール。所持=緑・課金=橙のような意味のある色は触らない。
const BRAND_RULES = p => [
  // item: 称号バナー・各種の達成率・進捗バー・機能アイコン・称号チップ
  `.item-view .titp-gauge-card{background:linear-gradient(135deg,${p.accentSolid} 0%,${p.accent} 55%,${p.accentLight} 100%);box-shadow:0 4px 18px ${rgba(p.accent, 0.28)}}`,
  `.item-view :is(.cat-pct,.cv-header-pct,.ms-header-pct){color:${p.accentInk}}`,
  `.item-view .cat-fill:not(.high){background:linear-gradient(90deg,${p.accent},${p.accentLight})}`,
  `.item-view .feature-icon{background:${p.accentBg};color:${p.accentInk}}`,
  `.item-view .titp-chip{background:${p.accentBg};border-color:${p.accent}}`,
  `.item-view .titp-chip-name{color:${p.accentInk}}`,
  // wings: 合計サマリーカード（青のグラデーション）・ケープレベルカード（暗い夜色）・選択中のタブ。
  // 白い文字を載せるので、アクセントから作った「白文字で読める深い色」を使う
  `.wings-view .summary-card{background:linear-gradient(135deg,${p.accentSolid} 0%,${p.accentDeep} 100%);box-shadow:0 4px 14px ${rgba(p.accentSolid, 0.28)}}`,
  `.wings-view .cape-card{background:linear-gradient(160deg,${p.night1} 0%,${p.night2} 100%);box-shadow:0 4px 14px ${rgba(p.night2, 0.4)}}`,
  `.wings-view .mode-tab.active{background:${p.accentSolid};box-shadow:0 2px 8px ${rgba(p.accentSolid, 0.3)}}`,
  // star-candle: 金のグラデーション面（ボタン・バッジ・選択中の日付）の文字は、背景色ではなく読める濃さの色にする
  `.star-candle-view :is(.sc-add-current-btn,.sc-max-badge,.sc-active-badge,.sc-date-picker-cell.is-selected){color:${p.onGold}}`,
];

// 「ガラス」質感でぼかしを掛ける大きな面（小さな部品やタイル・一覧の行には掛けない：数が多く重くなるため）
const GLASS_TARGETS = [
  '.site-dock',
  '.item-view .cv-header-card', '.item-view .cv-control-panel', '.item-view .feature-btn', '.item-view .cat-card',
  '.item-view .welcome-card', '.item-view .titles-panel', '.item-view .banner',
  '.spirit-catalog-view .overall-pct-card', '.share-view .card', '.profile-view .card',
];

// 面・文字・アクセントの色の宣言だけをまとめたもの。通常用に加えて、
// 「透明感を減らす」「コントラストを上げる」設定向けの上書きにも同じ関数を使い回す。
function surfaceRules(p) {
  const out = [];
  out.push(rule(R, {
    // モーダル・引き出しなどハブ共通の面は、質感に関わらず常に不透明にして文字を読みやすく保つ
    '--hub-bg': p.bg, '--hub-card': p.card, '--hub-card-glass': p.glass, '--hub-sep': p.sep,
    '--hub-accent': p.accentFill, '--hub-accent-bg': p.accentBg,
    '--hub-text': p.text, '--hub-text-2': p.text2, '--hub-text-3': p.text3,
    '--hub-r': p.r + 'px', '--hub-r-sm': p.rs + 'px',
  }));
  TOOL_MAPS.forEach(([sel, fn]) => {
    const full = sel.split(',').map((s, i) => (i === 0 ? `${R} ${s.trim()}` : s.trim())).join(',');
    out.push(rule(full, fn(p)));
  });
  BRAND_RULES(p).forEach(r => out.push(`${R} ${r}`));
  return out;
}

export function buildCss(theme, scheme) {
  const p = derivePalette(theme, scheme);
  const out = [];

  out.push(...surfaceRules(p));

  // 背景（グラデーション）。プロフィールのアカウントカラーの薄い重ねも維持する
  const tintLayer = 'linear-gradient(var(--pf-tint-rgb, transparent), var(--pf-tint-rgb, transparent))';
  const base = theme.grad.on
    ? `linear-gradient(${Math.round(theme.grad.angle)}deg, ${p.bg} 0%, ${p.bg2} 100%)`
    : `linear-gradient(${p.bg}, ${p.bg})`;
  // accent-color は継承されるので、チェックボックス・スライダー等のブラウザ標準部品もアクセント色に揃う
  out.push(rule(R, { background: `${tintLayer}, ${base}`, 'background-attachment': 'fixed', 'background-color': p.bg, 'accent-color': p.accentFill }));
  out.push(`${R} body{background:transparent}`);

  // 各ツールのルート要素: 背景を透明にして、背景・壁紙・きらめきを透かす
  out.push(`${R} :is(${VIEW_ROOTS.join(',')}){background:transparent}`);

  // 質感
  if (theme.card === 'glass') {
    out.push(`${R} :is(${GLASS_TARGETS.join(',')}){backdrop-filter:blur(16px) saturate(150%);-webkit-backdrop-filter:blur(16px) saturate(150%)}`);
  }
  out.push(`${R} :is(.item-view .cv-header-card,.item-view .cv-control-panel,.item-view .cat-card,.item-view .feature-btn,.item-view .card){box-shadow:${p.shadow}}`);

  // 角丸（item系・共通の --r / --r-sm を使うツール）
  out.push(`${R} :is(${VIEW_ROOTS.join(',')}){--r:${p.r}px;--r-sm:${p.rs}px}`);
  out.push(`${R} :is(.modal-card,.pf-modal-card){border-radius:${Math.max(p.r + 4, 8)}px ${Math.max(p.r + 4, 8)}px 0 0}`);

  // フォント
  const font = FONTS[theme.font];
  if (font && font.stack) {
    out.push(`${R} body,${R} :is(${VIEW_ROOTS.join(',')}),${R} :is(button,input,select,textarea){font-family:${font.stack}}`);
  }

  // ♿ 半透明（ガラス）の質感は、システムの「透明度を下げる」設定では不透明に、
  //    「コントラストを上げる」設定では区切り線・補助文字を濃くする（tai-hub/CLAUDE.md の方針）
  if (theme.card === 'glass') {
    out.push(`@media (prefers-reduced-transparency: reduce){${[
      ...surfaceRules({ ...p, cardSurface: p.card, glass: p.card }),
      `${R} :is(${GLASS_TARGETS.join(',')}){backdrop-filter:none;-webkit-backdrop-filter:none}`,
    ].join('\n')}}`);
  }
  out.push(`@media (prefers-contrast: more){${surfaceRules({
    ...p, cardSurface: p.card, glass: p.card, sep: rgba(p.ink, 0.55), text2: p.text, text3: p.text2,
  }).join('\n')}}`);
  return out.join('\n');
}

/* ================================================================
   保存データ（有効なテーマ＋お気に入り）
   ================================================================ */
function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(THEME_KEY));
    if (raw && typeof raw === 'object') {
      const favs = Array.isArray(raw.favs) ? raw.favs : [];
      return {
        active: raw.active ? normalizeTheme(raw.active) : null,
        favs: favs.filter(f => f && typeof f.id === 'string' && /^[a-z0-9_-]{1,40}$/i.test(f.id))
          .slice(0, MAX_FAVORITES)
          .map(f => ({ id: f.id, name: typeof f.name === 'string' ? f.name.slice(0, 24) : '', theme: normalizeTheme(f.theme) })),
      };
    }
  } catch (_) { /* 破損データは初期状態として扱う */ }
  return { active: null, favs: [] };
}
function saveState(st) {
  try { localStorage.setItem(THEME_KEY, JSON.stringify(st)); return true; }
  catch (_) { return false; }
}

export function getActiveTheme() { return loadState().active; }
export function getFavorites() { return loadState().favs; }
export function isThemeActive() { return !!loadState().active; }

// 色のスライダーをドラッグしている間は毎フレーム呼ばれるため、壁紙の掃除（IndexedDBの走査）は
// ここでは行わない。壁紙を外す・テーマを切り替える・お気に入りを消す時に pruneWallpapers() を呼ぶ。
export function setActiveTheme(theme) {
  const st = loadState();
  st.active = theme ? normalizeTheme(theme) : null;
  saveState(st);
  applyTheme();
}

function newId() { return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export function addFavorite(name, theme) {
  const st = loadState();
  if (st.favs.length >= MAX_FAVORITES) return null;
  const t = normalizeTheme(theme);
  const nm = (name || '').trim().slice(0, 24) || t.name || 'My Theme';
  t.name = nm;
  const fav = { id: newId(), name: nm, theme: t };
  st.favs.unshift(fav);
  saveState(st);
  return fav;
}
export function renameFavorite(id, name) {
  const st = loadState();
  const f = st.favs.find(x => x.id === id);
  if (!f) return;
  f.name = (name || '').trim().slice(0, 24) || f.name;
  f.theme.name = f.name;
  saveState(st);
}
export function removeFavorite(id) {
  const st = loadState();
  st.favs = st.favs.filter(x => x.id !== id);
  saveState(st);
  pruneWallpapers();
}

/* ── 共有コード（壁紙は端末の画像なので含めない） ── */
const CODE_PREFIX = 'skyhub1:';
export function exportThemeCode(theme) {
  const t = normalizeTheme(theme);
  t.wp = null;
  const json = JSON.stringify(t);
  const b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return CODE_PREFIX + b64;
}
export function importThemeCode(code) {
  const s = String(code || '').trim();
  if (!s.startsWith(CODE_PREFIX)) return null;
  try {
    const b64 = s.slice(CODE_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(escape(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))));
    return normalizeTheme(JSON.parse(json));
  } catch (_) { return null; }
}

/* ================================================================
   壁紙（端末の画像。IndexedDBに保存。localStorageの容量を圧迫しないため）
   ================================================================ */
const DB_NAME = 'sky_hub_theme_db';
function openDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('no idb')); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('wp');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idb(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('wp', mode);
    const store = tx.objectStore('wp');
    const req = fn(store);
    tx.oncomplete = () => { db.close(); resolve(req && req.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
  });
}
export function wallpaperSupported() { return !!window.indexedDB; }
/** 端末に保存した壁紙をすべて消す（「全データを削除」から呼ぶ） */
export function wipeWallpapers() {
  wpUrlCache.forEach(u => URL.revokeObjectURL(u));
  wpUrlCache.clear();
  try { if (window.indexedDB) indexedDB.deleteDatabase(DB_NAME); } catch (_) { /* 何もしない */ }
}

/** 画像ファイルを縮小してJPEGにし、保存したIDを返す */
export async function saveWallpaperFile(file) {
  const bmp = await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
  const max = 1400;
  const k = Math.min(1, max / Math.max(bmp.naturalWidth, bmp.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.naturalWidth * k));
  c.height = Math.max(1, Math.round(bmp.naturalHeight * k));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((resolve, reject) => c.toBlob(b => (b ? resolve(b) : reject(new Error('enc'))), 'image/jpeg', 0.8));
  const id = 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await idb('readwrite', s => s.put(blob, id));
  return id;
}

const wpUrlCache = new Map();
/** 保存済み壁紙の表示用URL（無ければnull）。スタジオのサムネイルにも使う */
export async function getWallpaperUrl(id) {
  if (wpUrlCache.has(id)) return wpUrlCache.get(id);
  const blob = await idb('readonly', s => s.get(id));
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  wpUrlCache.set(id, url);
  return url;
}

// どのテーマ（有効・お気に入り）からも参照されなくなった壁紙を消す
export async function pruneWallpapers() {
  if (!wallpaperSupported()) return;
  try {
    const st = loadState();
    const used = new Set();
    if (st.active && st.active.wp) used.add(st.active.wp);
    st.favs.forEach(f => { if (f.theme.wp) used.add(f.theme.wp); });
    const keys = await idb('readonly', s => s.getAllKeys());
    for (const k of keys || []) {
      if (!used.has(k)) {
        await idb('readwrite', s => s.delete(k));
        const u = wpUrlCache.get(k);
        if (u) { URL.revokeObjectURL(u); wpUrlCache.delete(k); }
      }
    }
  } catch (_) { /* 壁紙が使えない環境では何もしない */ }
}

/* ================================================================
   適用
   ================================================================ */
let styleEl = null;
let wpEl = null;
let wpDimEl = null;
let wpToken = 0;

function ensureStyleEl() {
  if (styleEl && document.head.contains(styleEl)) return styleEl;
  styleEl = document.getElementById(STYLE_ID);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    document.head.appendChild(styleEl);
  }
  return styleEl;
}
function ensureWallpaperLayer() {
  if (wpEl && document.body.contains(wpEl)) return;
  wpEl = document.createElement('div');
  wpEl.id = 'hub-wallpaper';
  wpEl.setAttribute('aria-hidden', 'true');
  wpDimEl = document.createElement('div');
  wpDimEl.className = 'hub-wallpaper-dim';
  wpEl.appendChild(wpDimEl);
  document.body.insertBefore(wpEl, document.body.firstChild);
}

function applyFont(theme) {
  const href = FONTS[theme.font] && FONTS[theme.font].href;
  let link = document.getElementById(FONT_LINK_ID);
  if (!href) { if (link) link.remove(); return; }
  if (!link) {
    link = document.createElement('link');
    link.id = FONT_LINK_ID;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  if (link.getAttribute('href') !== href) link.setAttribute('href', href);
}

async function applyWallpaper(theme, p) {
  const token = ++wpToken;
  if (!theme.wp || !wallpaperSupported()) {
    if (wpEl) { wpEl.classList.remove('on'); wpEl.style.backgroundImage = ''; }
    return;
  }
  ensureWallpaperLayer();
  let url = null;
  try { url = await getWallpaperUrl(theme.wp); } catch (_) { url = null; }
  if (token !== wpToken) return; // 後から別の適用が走った
  if (!url) { wpEl.classList.remove('on'); return; }
  wpEl.style.backgroundImage = `url("${url}")`;
  wpEl.style.filter = theme.wpBlur ? `blur(${theme.wpBlur}px)` : '';
  wpEl.style.transform = theme.wpBlur ? 'scale(1.08)' : '';
  wpDimEl.style.background = rgba(p.bg, theme.wpDim / 100);
  wpEl.classList.add('on');
}

// 描画前スクリプト用のキャッシュ(localStorage)は、色のスライダーをドラッグ中に毎フレーム
// 書き換えると無駄が大きいので、操作が落ち着いてから1回だけ書く（画面への反映は即時）。
let cacheTimer = 0;
function scheduleCacheWrite() {
  clearTimeout(cacheTimer);
  cacheTimer = setTimeout(writeCacheNow, 350);
}
function writeCacheNow() {
  cacheTimer = 0;
  const theme = getActiveTheme();
  if (!theme) return;
  try {
    const scheme = schemeFor(theme);
    const fixed = theme.bg || theme.force ? scheme : null;
    // 明るさ固定のテーマは、使う方のCSSだけを保存する（同じものを2つ持たない）
    const cache = { fixed, card: theme.card, font: FONTS[theme.font] ? FONTS[theme.font].href : null };
    if (fixed) cache[fixed] = buildCss(theme, fixed);
    else { cache.light = buildCss(theme, 'light'); cache.dark = buildCss(theme, 'dark'); }
    localStorage.setItem(THEME_CSS_KEY, JSON.stringify(cache));
  } catch (_) { /* 容量不足など。次回はちらつきが出るだけ */ }
}

let applying = false;
/** 保存されている有効なテーマを画面へ反映する（無ければ標準に戻す）。何度呼んでも安全 */
export function applyTheme() {
  if (applying) return;
  applying = true;
  try {
    const html = document.documentElement;
    const theme = getActiveTheme();
    if (!theme) {
      const el = document.getElementById(STYLE_ID);
      if (el) el.textContent = '';
      ['data-hub-theme', 'data-hub-card'].forEach(a => html.removeAttribute(a));
      const link = document.getElementById(FONT_LINK_ID);
      if (link) link.remove();
      if (wpEl) wpEl.classList.remove('on');
      wpToken++;
      setFx('none');
      clearTimeout(cacheTimer); cacheTimer = 0;
      try { localStorage.removeItem(THEME_CSS_KEY); } catch (_) { /* noop */ }
      // 標準に戻す: ライト/ダーク/システムの設定に従った明るさへ
      const mode = getSkyThemeMode();
      const std = resolveSkyTheme(mode === 'system' ? null : mode);
      if (html.getAttribute('data-theme') !== std) html.setAttribute('data-theme', std);
      return;
    }
    const scheme = schemeFor(theme);
    if (html.getAttribute('data-theme') !== scheme) html.setAttribute('data-theme', scheme);
    ensureStyleEl().textContent = buildCss(theme, scheme);
    html.setAttribute('data-hub-theme', 'on');
    html.setAttribute('data-hub-card', theme.card);
    applyFont(theme);

    const p = derivePalette(theme, scheme);
    applyWallpaper(theme, p);
    setFx(theme.fx, { dark: p.dark, accent: p.accent, accent2: p.a2, light: p.accentLight });

    scheduleCacheWrite();
  } finally {
    applying = false;
  }
}

/** 起動時に1回呼ぶ。以後は ライト/ダーク切替・システム設定の変化にも追従する */
export function initTheme() {
  applyTheme();
  addEventListener('pagehide', () => { if (cacheTimer) { clearTimeout(cacheTimer); writeCacheNow(); } });
  // 既存の「テーマ切替」(ライト/ダーク/システム)が data-theme を書き換えたら、配色を作り直す
  new MutationObserver(() => { if (isThemeActive()) applyTheme(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  // システムの明るさが変わった時（「システム」設定の時だけ意味がある）
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getSkyThemeMode() !== 'system') return;
      const mode = resolveSkyTheme(null);
      if (document.documentElement.getAttribute('data-theme') !== mode && !(getActiveTheme() && (getActiveTheme().bg || getActiveTheme().force))) {
        document.documentElement.setAttribute('data-theme', mode);
      }
    });
  } catch (_) { /* 古いブラウザ */ }
}

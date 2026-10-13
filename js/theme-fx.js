/* ================================================================
   theme-fx.js — 背景のきらめき演出（星・花びら・シャボン玉・ほたる・雪）

   画面の最背面に固定した <canvas> へ、少数の粒子をゆっくり動かすだけの
   軽い演出。操作の邪魔にならないよう:
   ・pointer-events:none・最背面（z-index:-1）。各ツールの背景は透明にして
     あるので、カードの隙間から見える（theme.js 参照）。
   ・粒子数は画面面積に比例させ、上限60。
   ・タブが非表示の間は描画を止める（バッテリー節約）。
   ・prefers-reduced-motion では動かさず、静止した1コマだけを描く。
   ================================================================ */

let canvas = null;
let ctx = null;
let raf = 0;
let kind = 'none';
let colors = { dark: false, accent: '#888888', accent2: '#888888', light: '#cccccc' };
let parts = [];
let W = 0;
let H = 0;
let dpr = 1;
let last = 0;
let resizeTimer = 0;
let listening = false;

const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const rnd = (a, b) => a + Math.random() * (b - a);

function ensureCanvas() {
  if (canvas && document.body.contains(canvas)) return;
  canvas = document.createElement('canvas');
  canvas.id = 'hub-fx';
  canvas.setAttribute('aria-hidden', 'true');
  // #hub-wallpaper（最背面の壁紙レイヤー）より手前、アプリ本体より奥
  const wp = document.getElementById('hub-wallpaper');
  if (wp && wp.nextSibling) document.body.insertBefore(canvas, wp.nextSibling);
  else document.body.insertBefore(canvas, document.body.firstChild);
  ctx = canvas.getContext('2d');
}

function resize() {
  if (!canvas) return;
  dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  seed();
}

function count() {
  return Math.max(16, Math.min(60, Math.floor((W * H) / 26000)));
}

function make(init) {
  const y = init ? rnd(0, H) : (kind === 'bubbles' ? H + 20 : -20);
  switch (kind) {
    case 'stars': return { x: rnd(0, W), y: rnd(0, H), r: rnd(0.6, 1.9), ph: rnd(0, 6.28), sp: rnd(0.6, 1.8), big: Math.random() < 0.12 };
    case 'petals': return { x: rnd(-20, W), y, r: rnd(5, 9), vy: rnd(18, 38), vx: rnd(8, 22), ph: rnd(0, 6.28), sw: rnd(0.8, 1.6), rot: rnd(0, 6.28), vr: rnd(-1.2, 1.2), a: rnd(0.45, 0.8), alt: Math.random() < 0.4 };
    case 'bubbles': return { x: rnd(0, W), y, r: rnd(5, 18), vy: -rnd(14, 34), ph: rnd(0, 6.28), sw: rnd(0.6, 1.4), a: rnd(0.25, 0.5) };
    case 'fireflies': return { x: rnd(0, W), y: rnd(0, H), r: rnd(1.6, 3.2), ph: rnd(0, 6.28), sp: rnd(0.5, 1.4), vx: rnd(-10, 10), vy: rnd(-10, 10), alt: Math.random() < 0.35 };
    case 'snow': return { x: rnd(0, W), y, r: rnd(1.2, 3.4), vy: rnd(14, 34), ph: rnd(0, 6.28), sw: rnd(0.5, 1.2), a: rnd(0.5, 0.9) };
    default: return null;
  }
}

function seed() {
  parts = [];
  if (kind === 'none') return;
  const n = count();
  for (let i = 0; i < n; i++) parts.push(make(true));
}

function rgbaOf(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function draw(t, dt) {
  ctx.clearRect(0, 0, W, H);
  const dark = colors.dark;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    switch (kind) {
      case 'stars': {
        const tw = 0.5 + 0.5 * Math.sin(t * p.sp + p.ph);
        const col = dark ? (p.big ? '#FFE9A8' : '#FFFFFF') : colors.accent;
        ctx.globalAlpha = (dark ? 0.35 : 0.28) + tw * (dark ? 0.6 : 0.4);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.8 + tw * 0.5), 0, 6.283); ctx.fill();
        if (p.big) {
          ctx.strokeStyle = col; ctx.lineWidth = 0.8;
          const s = p.r * (3.5 + tw * 3);
          ctx.beginPath(); ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x + s, p.y); ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x, p.y + s); ctx.stroke();
        }
        break;
      }
      case 'petals': {
        p.y += p.vy * dt; p.x += (p.vx + Math.sin(t * p.sw + p.ph) * 14) * dt; p.rot += p.vr * dt;
        if (p.y > H + 20 || p.x > W + 30) { Object.assign(p, make(false)); p.x = rnd(-30, W * 0.8); }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = p.a;
        ctx.fillStyle = p.alt ? colors.accent2 : colors.light;
        ctx.beginPath();
        ctx.moveTo(0, -p.r);
        ctx.bezierCurveTo(p.r * 0.95, -p.r * 0.5, p.r * 0.7, p.r * 0.7, 0, p.r * 0.95);
        ctx.bezierCurveTo(-p.r * 0.7, p.r * 0.7, -p.r * 0.95, -p.r * 0.5, 0, -p.r);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'bubbles': {
        p.y += p.vy * dt; p.x += Math.sin(t * p.sw + p.ph) * 10 * dt;
        if (p.y < -30) { Object.assign(p, make(false)); }
        const base = dark ? '#FFFFFF' : colors.accent;
        ctx.globalAlpha = p.a;
        ctx.lineWidth = 1;
        ctx.strokeStyle = rgbaOf(base, 0.7);
        ctx.fillStyle = rgbaOf(base, 0.08);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill(); ctx.stroke();
        ctx.fillStyle = rgbaOf('#FFFFFF', 0.7);
        ctx.beginPath(); ctx.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, Math.max(1, p.r * 0.16), 0, 6.283); ctx.fill();
        break;
      }
      case 'fireflies': {
        p.x += (p.vx + Math.sin(t * 0.7 + p.ph) * 8) * dt; p.y += (p.vy + Math.cos(t * 0.6 + p.ph) * 8) * dt;
        if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
        const glow = 0.5 + 0.5 * Math.sin(t * p.sp + p.ph);
        const col = p.alt ? colors.accent2 : (dark ? '#FFF3A0' : colors.accent);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
        g.addColorStop(0, rgbaOf(col, 0.85 * glow + 0.1));
        g.addColorStop(1, rgbaOf(col, 0));
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 6, 0, 6.283); ctx.fill();
        break;
      }
      case 'snow': {
        p.y += p.vy * dt; p.x += Math.sin(t * p.sw + p.ph) * 12 * dt;
        if (p.y > H + 10) { Object.assign(p, make(false)); }
        ctx.globalAlpha = p.a;
        ctx.fillStyle = dark ? '#FFFFFF' : colors.light;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
        break;
      }
      default: break;
    }
  }
  ctx.globalAlpha = 1;
}

function frame(now) {
  raf = 0;
  if (kind === 'none' || document.hidden) return;
  const t = now / 1000;
  const dt = Math.min(0.05, last ? t - last : 0.016);
  last = t;
  draw(t, dt);
  raf = requestAnimationFrame(frame);
}

function start() {
  if (raf || kind === 'none') return;
  if (reduceMotion()) { draw(0, 0); return; } // 静止した1コマだけ
  last = 0;
  raf = requestAnimationFrame(frame);
}

function stop() {
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
}

function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (kind !== 'none') { resize(); if (reduceMotion()) draw(0, 0); } }, 150);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else if (kind !== 'none') start();
  });
}

/** きらめきの種類を切り替える。'none' なら止めてキャンバスを隠す */
export function setFx(next, c) {
  if (c) colors = { ...colors, ...c };
  if (next === 'none' || !next) {
    kind = 'none';
    stop();
    if (canvas) { ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.style.display = 'none'; }
    return;
  }
  ensureCanvas();
  canvas.style.display = '';
  const changed = kind !== next;
  kind = next;
  listen();
  if (changed || !parts.length) resize();
  stop();
  if (reduceMotion()) draw(0, 0); else start();
}

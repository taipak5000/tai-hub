/* ================================================================
   sheet-engine.js — 流体ボトムシート ＋ モーダルのフォーカストラップ

   item/ios-hig.js（姉妹サイト全ページ共通）の「3. 流体ボトムシート」と
   「5. フォーカストラップ」を、ハブ向けにES module化して移植したもの。
   ハブの全モーダル（.modal-overlay / .pf-modal-overlay の .open 切替）に、
   個々のモジュールを書き換えずに一律で効く（新しいモーダルを足してもここは触らない）。

   ── ボトムシート ────────────────────────────────────────────
   Apple "Designing Fluid Interfaces" の考え方: Pointer Eventsとスプリング物理。
   指に1:1で追従（掴んだ位置を保持）、離した速度をそのまま初速に引き継ぎ、慣性の
   投影先で閉じる/戻すを決め、上方向はラバーバンド、動いている途中でも掴める。
   PCのマウスでも同じ経路で動く（幅によるガードは置かない。CLAUDE.md参照）。
   prefers-reduced-motion時はスライドをやめ（CSS側のフェードに任せる）。
   タップでの開閉はCSSのanimation/transitionに任せ、ドラッグ/フリック中だけJSが駆動する。
   閉じるときは、各モーダルが背景クリックで行う「正しい閉じ方」をそのまま呼ぶため、
   オーバーレイ自身へクリックを送る（Esc/背景タップと同じ後始末が走る）。

   ── フォーカストラップ ────────────────────────────────────────
   Tabキーがモーダルの外へ抜けないようスタック最上段のカード内で折り返し、閉じたときは
   開く前にフォーカスしていた要素へ戻す（多重ネスト対応）。
   ================================================================ */

const OVERLAY_SEL = '.pf-modal-overlay, .modal-overlay';
const CARD_SEL = '.pf-modal-card, .modal-card';
// ドラッグの起点にしない要素（入力・ボタン・スライダー・トリミング枠等は自分のジェスチャを持つ）
const INTERACTIVE_SEL = 'input, select, textarea, button, a, label, summary, [contenteditable], [role="button"], [role="slider"], .cs-crop-viewport, .nmp-carry-gauge, [data-no-sheet-drag]';

let started = false;

export function initSheetEngine() {
  if (started) return;
  started = true;
  initSheets();
  initFocusTrap();
}

/* ================================================================
   流体ボトムシート
   ================================================================ */
function initSheets() {
  const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sheets = {};
  let active = null;

  // Appleのパラメータ化: 減衰比(1.0=行き過ぎなし, <1で弾む) と 応答時間(秒)
  const spring = (damping, response) => ({ zeta: damping, omega: (2 * Math.PI) / response });
  const SPRING_FLICK = spring(0.8, 0.3); // 指を離した後（勢いがある動き）だけ少し弾む

  const project = (v, d) => { d = d || 0.998; return (v / 1000) * d / (1 - d); }; // 慣性の投影先(px)
  const rubberband = (over, dim, c) => { c = c || 0.55; return (over * dim * c) / (dim + c * Math.abs(over)); };

  const isOverlay = (el) => !!(el && el.classList && (el.classList.contains('pf-modal-overlay') || el.classList.contains('modal-overlay')));
  function stateFor(overlay) {
    if (!overlay.id) overlay.id = 'sheet-' + Math.random().toString(36).slice(2);
    let s = sheets[overlay.id];
    const card = overlay.querySelector(CARD_SEL);
    if (!s) {
      s = sheets[overlay.id] = { overlay, card, y: 0, v: 0, target: 0, height: 0, raf: null, last: 0,
        spring: SPRING_FLICK, dragging: false, pointerId: null, grabY: 0, hist: [], onSettle: null, closedByGesture: false, hideTimer: null };
    } else {
      // 開くたびに同じidでオーバーレイごと作り直すモジュールがあるため、要素の参照も毎回更新する
      if (s.overlay !== overlay) { s.overlay = overlay; clearTimeout(s.hideTimer); stopAnim(s); }
      if (s.card !== card) s.card = card;
    }
    return s;
  }
  const measure = (s) => { s.height = s.card.getBoundingClientRect().height || window.innerHeight; };
  function render(s) {
    s.card.style.transform = 'translate3d(0,' + s.y.toFixed(2) + 'px,0)';
    const p = 1 - Math.min(Math.max(s.y / s.height, 0), 1);
    s.overlay.style.setProperty('--sheet-progress', p.toFixed(3));
  }
  function stopAnim(s) { if (s.raf) { cancelAnimationFrame(s.raf); s.raf = null; } }
  // 現在のtransformからY方向の実際の描画位置(px)を読む（CSSトランジション中のカードを途中で掴んでも続行できるように）
  function readCardY(card) {
    const m = getComputedStyle(card).transform;
    if (!m || m === 'none') return 0;
    const m3 = m.match(/matrix3d\(([^)]+)\)/);
    if (m3) { const v = m3[1].split(',').map(Number); return v[13] || 0; }
    const m2 = m.match(/matrix\(([^)]+)\)/);
    if (m2) { const v2 = m2[1].split(',').map(Number); return v2[5] || 0; }
    return 0;
  }
  function animateTo(s, target, sp, velocity, onSettle) {
    stopAnim(s);
    s.card.classList.add('js-anim'); // 物理演算で毎フレーム書き換える間はCSSトランジションを止める
    s.target = target; s.spring = sp; s.onSettle = onSettle || null;
    if (typeof velocity === 'number') s.v = velocity;
    s.last = performance.now();
    function step(now) {
      // 実時間に追従させる（フレームが飛んでも遅くならない）。4ms刻みのセミ陰的オイラーで安定化
      const dt = Math.min((now - s.last) / 1000, 0.1); s.last = now;
      const steps = Math.max(1, Math.ceil(dt / 0.004));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        const x = s.y - s.target;
        const a = -2 * s.spring.zeta * s.spring.omega * s.v - s.spring.omega * s.spring.omega * x;
        s.v += a * h; s.y += s.v * h;
      }
      if (Math.abs(s.y - s.target) < 0.5 && Math.abs(s.v) < 20) {
        s.y = s.target; s.v = 0; render(s); s.raf = null;
        s.card.classList.remove('js-anim'); // 以後はCSSトランジションに委ねる
        if (s.onSettle) { const fn = s.onSettle; s.onSettle = null; fn(); }
        return;
      }
      render(s);
      s.raf = requestAnimationFrame(step);
    }
    s.raf = requestAnimationFrame(step);
  }

  // 各モーダルの「正しい閉じ方」を呼ぶ: 背景クリックと同じ経路（オーバーレイ自身へのクリック）。
  // それで閉じなかった（背景クリックで閉じない作りの）場合だけ、openクラスを外して閉じる。
  function closeOverlay(overlay) {
    overlay.click();
    if (overlay.classList.contains('open')) overlay.classList.remove('open');
  }
  function finishHide(s) {
    clearTimeout(s.hideTimer);
    s.card.classList.remove('js-anim');
    s.overlay.classList.remove('is-closing');
    s.card.style.transform = '';
    s.overlay.style.removeProperty('--sheet-progress');
    s.y = 0; s.v = 0;
  }
  // タップでの開閉（ドラッグ/フリックによるものではない）はCSSに任せる。閉じるときだけ、
  // 表示を保ったまま下へスライドさせてから隠す（is-closing）。
  function onVisibilityChange(overlay, visible) {
    if (REDUCE_MOTION.matches) return;
    const s = stateFor(overlay);
    if (!s.card) return;
    if (s.dragging) return;
    stopAnim(s);
    s.card.classList.remove('js-anim');
    clearTimeout(s.hideTimer);
    if (visible) {
      overlay.classList.remove('is-closing');
      s.card.style.transform = '';
      overlay.style.removeProperty('--sheet-progress');
      s.y = 0; s.v = 0;
    } else {
      if (s.closedByGesture) { s.closedByGesture = false; finishHide(s); return; }
      measure(s);
      overlay.classList.add('is-closing');
      s.card.style.transform = 'translate3d(0,' + s.height + 'px,0)';
      overlay.style.setProperty('--sheet-progress', '0');
      s.y = s.height; s.v = 0;
      s.hideTimer = setTimeout(() => finishHide(s), 340);
    }
  }
  new MutationObserver((records) => {
    records.forEach((r) => {
      const el = r.target;
      if (!isOverlay(el)) return;
      const was = (' ' + (r.oldValue || '') + ' ').indexOf(' open ') !== -1;
      const now = el.classList.contains('open');
      if (was !== now) onVisibilityChange(el, now);
    });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'], subtree: true, attributeOldValue: true });

  const isInteractive = (el) => !!(el && el.closest && el.closest(INTERACTIVE_SEL));

  document.addEventListener('pointerdown', (e) => {
    if (REDUCE_MOTION.matches) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const card = e.target && e.target.closest ? e.target.closest(CARD_SEL) : null;
    if (!card) return;
    const overlay = card.closest(OVERLAY_SEL);
    if (!overlay || !overlay.classList.contains('open') || isInteractive(e.target)) return;
    const s = stateFor(overlay);
    measure(s);
    stopAnim(s);                 // 動いている途中でも掴める（表示中の値から続行）
    s.y = readCardY(s.card);     // CSSトランジション中の実描画位置にs.yを同期させる
    s.pointerId = e.pointerId;
    s.grabY = e.clientY - s.y;   // 掴んだ位置のオフセットを保持
    s.hist = [{ t: performance.now(), y: e.clientY }];
    s.dragging = false;
    active = s;
  }, { passive: true });

  document.addEventListener('pointermove', (e) => {
    const s = active; if (!s || e.pointerId !== s.pointerId) return;
    s.hist.push({ t: performance.now(), y: e.clientY }); if (s.hist.length > 6) s.hist.shift();
    if (!s.dragging) {
      const moved = e.clientY - s.hist[0].y;
      if (Math.abs(moved) < 10) return;                                 // 10pxのヒステリシス
      if (moved < 0 || s.card.scrollTop > 0) { active = null; return; }  // 内容のスクロールに譲る
      s.dragging = true;
      s.card.classList.add('is-dragging');
      try { s.card.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
    }
    let y = e.clientY - s.grabY;
    if (y < 0) y = rubberband(y, s.height);                             // 上へはラバーバンド
    s.y = y; render(s);
  });

  // ドラッグ中はページ/カードのスクロールを止める（passive:falseが必要）
  document.addEventListener('touchmove', (e) => {
    if (active && active.dragging && e.cancelable) e.preventDefault();
  }, { passive: false });

  function release(e) {
    const s = active; if (!s || e.pointerId !== s.pointerId) return;
    active = null;
    if (!s.dragging) return;
    s.dragging = false; s.card.classList.remove('is-dragging');
    try { s.card.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
    // 直近約100msの履歴から離した瞬間の速度(px/s)を求める
    const h = s.hist; let v = 0;
    if (h.length >= 2) {
      const b = h[h.length - 1]; let a = b;
      for (let i = h.length - 2; i >= 0; i--) { if (b.t - h[i].t > 100) break; a = h[i]; }
      const dt = (b.t - a.t) / 1000; if (dt > 0) v = (b.y - a.y) / dt;
    }
    // 勢いがあれば速度の向きで、なければ慣性の投影先が半分を越えるかで決める
    const projected = s.y + project(v);
    const shouldClose = Math.abs(v) > 250 ? v > 0 : projected > s.height * 0.5;
    if (shouldClose) {
      animateTo(s, s.height, SPRING_FLICK, v, () => { s.closedByGesture = true; closeOverlay(s.overlay); });
    } else {
      animateTo(s, 0, SPRING_FLICK, v, null);
    }
  }
  document.addEventListener('pointerup', release);
  document.addEventListener('pointercancel', release);
}

/* ================================================================
   フォーカストラップ（スタック式）
   ================================================================ */
function initFocusTrap() {
  const trapStack = [];
  let listening = false;

  const focusableEls = (container) => Array.prototype.filter.call(
    container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'),
    (el) => el.offsetParent !== null,
  );
  // 今まさにフォーカスを受け取れる、目に見える状態か（bodyや非表示化された要素は弾く）
  const isFocusable = (el) => !!el && typeof el.focus === 'function' && document.contains(el) && el.offsetParent !== null;

  // 開く前にフォーカスしていた要素が無効になっている場合の復帰先:
  // 開いたままの直近の親モーダルの閉じるボタン → 先頭のフォーカス可能要素 → カード自体、
  // どのモーダルも無ければ、常時表示のクイックドックの先頭ボタン。
  function fallbackFocusTarget() {
    if (trapStack.length) {
      const card = trapStack[trapStack.length - 1].card;
      const closeBtn = card.querySelector('.modal-close-btn, .modal-close, .pf-close-btn');
      if (isFocusable(closeBtn)) return closeBtn;
      const focusable = focusableEls(card);
      if (focusable.length) return focusable[0];
      return card;
    }
    // querySelectorのカンマ区切りはDOM順になるため、優先順位どおりに1つずつ試す
    const candidates = ['.site-dock button', 'nav a[href]'];
    for (let i = 0; i < candidates.length; i++) {
      const el = document.querySelector(candidates[i]);
      if (isFocusable(el)) return el;
    }
    return null;
  }
  function trapKeydown(e) {
    if (e.key !== 'Tab' || !trapStack.length) return;
    const card = trapStack[trapStack.length - 1].card;
    const focusable = focusableEls(card);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first || !card.contains(document.activeElement)) { e.preventDefault(); last.focus(); }
    } else if (document.activeElement === last || !card.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  }
  // preClosureActiveEl: 同一MutationObserverバッチで「Aを閉じてBを開く」が起きたとき、Aのtrapが
  // フォーカスを動かす前の値（＝Bが開かれた本来の瞬間の値）を使うためのスナップショット
  function trapPush(overlayId, card, preClosureActiveEl) {
    if (!card || trapStack.some((s) => s.overlayId === overlayId)) return;
    let candidate = preClosureActiveEl !== undefined ? preClosureActiveEl : document.activeElement;
    if (!isFocusable(candidate)) candidate = fallbackFocusTarget() || candidate;
    trapStack.push({ overlayId, card, prevFocusEl: candidate });
    if (!listening) { document.addEventListener('keydown', trapKeydown, true); listening = true; }
    const focusable = focusableEls(card);
    (focusable[0] || card).focus({ preventScroll: true });
  }
  function trapPop(overlayId) {
    const idx = trapStack.findIndex((s) => s.overlayId === overlayId);
    if (idx === -1) return;
    const entry = trapStack.splice(idx, 1)[0];
    if (!trapStack.length && listening) { document.removeEventListener('keydown', trapKeydown, true); listening = false; }
    const target = isFocusable(entry.prevFocusEl) ? entry.prevFocusEl : fallbackFocusTarget();
    if (target && typeof target.focus === 'function') target.focus({ preventScroll: true });
  }

  // 開閉状態を持つ要素と、フォーカスすべきカードの対応。ツールドロワーは背景(.pf-drawer-overlay)と
  // パネル(.pf-drawer)が別要素で、フォーカスすべきはパネル（ハブでは.mobile-openで開閉する）
  function trapTargetOf(el) {
    if (!el || !el.classList) return null;
    if (el.classList.contains('pf-modal-overlay') || el.classList.contains('modal-overlay')) {
      return el.querySelector(CARD_SEL) || el;
    }
    if (el.classList.contains('pf-drawer') && !el.classList.contains('pf-drawer-overlay')) return el;
    return null;
  }
  const isOpenState = (el) => el.classList.contains('open') || el.classList.contains('mobile-open');
  const wasOpen = (oldValue) => /(^|\s)(open|mobile-open)(\s|$)/.test(oldValue || '');
  function idOf(el) {
    if (!el.id) el.id = 'trap-' + Math.random().toString(36).slice(2);
    return el.id;
  }

  new MutationObserver((records) => {
    const preClosureActiveEl = document.activeElement;
    records.forEach((r) => {
      const el = r.target;
      const card = trapTargetOf(el);
      if (!card) return;
      const was = wasOpen(r.oldValue);
      const now = isOpenState(el);
      if (was === now) return;
      if (now) trapPush(idOf(el), card, preClosureActiveEl);
      else trapPop(idOf(el));
    });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'], subtree: true, attributeOldValue: true });
}

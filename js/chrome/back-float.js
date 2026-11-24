/* 浮かぶ「戻る」ボタン（css/chrome.css の .back-float）
   アイテム所持管理のカテゴリ画面などは「← カテゴリ一覧へ戻る」が画面の上端にしかなく、
   下までスクロールした後に戻るには上まで戻す必要があった。
   #app-root の中の .back-link が画面の外へ出ている間だけ、同じ行き先のボタンを画面の左下に出す。
   各ツール側の変更は要らない（.back-link を置けば自動で付く）。 */

let root = null;
let btn = null;
let watched = null;   // いま監視している .back-link
let io = null;
let scanQueued = false;

function ensureButton() {
  if (btn) return btn;
  btn = document.createElement('a');
  btn.className = 'back-float';
  btn.hidden = true;
  btn.innerHTML = '<svg class="inline-icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg><span class="back-float-label"></span>';
  btn.addEventListener('animationend', () => {
    if (btn.classList.contains('closing')) { btn.classList.remove('closing'); btn.hidden = true; }
  });
  document.body.appendChild(btn);
  return btn;
}

function show() {
  ensureButton();
  if (!btn.hidden && !btn.classList.contains('closing')) return;
  btn.classList.remove('closing');
  btn.hidden = false;
}

function hide(immediate) {
  if (!btn || btn.hidden) return;
  if (immediate) { btn.classList.remove('closing'); btn.hidden = true; return; }
  if (!btn.classList.contains('closing')) btn.classList.add('closing');
}

function labelOf(link) {
  // 「← カテゴリ一覧へ戻る」→「カテゴリ一覧へ戻る」（矢印はアイコンで出す）
  return (link.textContent || '').replace(/^[\s←‹<]+/, '').trim();
}

function watch(link) {
  if (link === watched) return;
  if (io) { io.disconnect(); io = null; }
  watched = link;
  if (!link) { hide(true); return; }
  ensureButton();
  btn.href = link.getAttribute('href') || '#/';
  const label = labelOf(link);
  btn.querySelector('.back-float-label').textContent = label;
  btn.setAttribute('aria-label', label);
  hide(true);
  io = new IntersectionObserver(entries => {
    const e = entries[entries.length - 1];
    // 画面より上へ流れて見えなくなった時だけ出す（読み込み直後など、下にあって見えない時は出さない）
    if (!e.isIntersecting && e.boundingClientRect.bottom <= 0) show(); else hide();
  });
  io.observe(link);
}

function scan() {
  scanQueued = false;
  const link = root.querySelector('.back-link');
  watch(link && link.isConnected ? link : null);
}

function queueScan() {
  if (scanQueued) return;
  scanQueued = true;
  requestAnimationFrame(scan);
}

export function initBackFloat(appRoot) {
  if (!appRoot || root) return;
  root = appRoot;
  // ツールの画面は後から（データの読み込み後に）描かれることがあるので、中身の入れ替えを見て探し直す
  new MutationObserver(queueScan).observe(appRoot, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => hide(true));
  queueScan();
}

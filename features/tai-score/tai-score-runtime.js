/* ================================================================
   tai-score（楽譜づくり）の実行時（非永続）状態＋UIインフラ共通部品。
   view/editor/perf の3ファイルが共有する「今開いている曲・選択中のマス・
   演奏モード」等のミュータブルな状態と、フォーカストラップ・モーダル
   開閉・トーストをここに集約する（循環importを避けるための土台）。

   移植元: tai-score/index.html のIIFE内、フォーカス管理(trapPush/trapPop、
   ~行2226-2423)・トースト(~行2424-2448)・確認モーダル(~行2677-2698)の各関数群。
   ================================================================ */
import { escapeHtml } from '../../js/i18n.js';

export { escapeHtml };

/* ── 実行時状態（曲を開いている間だけ有効。永続化はtai-score-state.js） ── */
export const RT = {
  containerEl: null,
  currentSong: null,      // 編集中の曲（保存前はライブラリに存在しない場合もある）
  selectedFrameIndex: 0,
  selection: null,        // 範囲選択 { anchor, focus }（マスの番号）| null
  rangeMode: false,       // 範囲選択モード（タッチ操作用。Shiftの代わり）
  autoAdvanceTimer: null, // 「入力したら次へ」の待ち時間
  keyBindings: null,      // 15要素のキー配列（マウント時にstate.loadKeyBindings()で初期化）
  capturingKeyIndex: null,
  editHistory: [],
  redoHistory: [],
  frameClipboard: null,   // { frames, bpmOverrides } | null
  freePlayInstrument: 'Harp',
  perfMode: null,         // 'practice' | 'test' | 'free'
  perfFrameIndex: -1,
  perfHitSet: new Set(),
  perfRangeStart: 0,
  perfRangeEnd: 0,
  perfMistakeCount: 0,
  perfCountingIn: false,
  isPlaying: false,
  playbackTimer: null,
  creatingNewSong: false,
  duplicatingSong: false,
  confirmModalCallback: null,
  lastShareCode: null,
  audioImportFile: null,
  audioAnalysisCancelled: false,
  imageImportFiles: [],
  imageAnalysisCancelled: false,
  listenersAttached: false,   // document/window直付けリスナーの多重登録防止（ルーター契約）
  boundKeydown: null,
};

export function resetRuntimeForMount() {
  RT.currentSong = null;
  RT.selectedFrameIndex = 0;
  RT.selection = null;
  RT.rangeMode = false;
  clearTimeout(RT.autoAdvanceTimer);
  RT.autoAdvanceTimer = null;
  RT.capturingKeyIndex = null;
  RT.editHistory = [];
  RT.redoHistory = [];
  RT.perfMode = null;
  RT.perfFrameIndex = -1;
  RT.perfHitSet = new Set();
  RT.isPlaying = false;
  if (RT.playbackTimer) { clearTimeout(RT.playbackTimer); RT.playbackTimer = null; }
  RT.creatingNewSong = false;
  RT.duplicatingSong = false;
  RT.confirmModalCallback = null;
  RT.lastShareCode = null;
  RT.audioImportFile = null;
  RT.audioAnalysisCancelled = true;
  RT.imageImportFiles = [];
  RT.imageAnalysisCancelled = true;
}

/* ================================================================
   ♿ モーダル／サイドバーのフォーカス管理（wings基準のスタック式trapPush/trapPop）
   - 開く時: カード内の最初のフォーカス可能要素へフォーカスを移す。
   - 開いている間: Tab/Shift+Tabを、開いている中で一番手前（＝スタック最上段）の
     カードだけに閉じ込める。
   - 閉じる時: 開く直前にフォーカスがあった要素（トリガー）に戻す。
   ================================================================ */
const trapStack = [];
let trapListenerAttached = false;
// 連鎖的なクローズ（closeOtherTopLevelOverlays()やcomposeToolsSwitchTo()のように
// 「自分を閉じてから別のオーバーレイを開く」パターン）の最中だけ1以上になるカウンター。
let trapSuppressFocusRestore = 0;

function trapFocusableEls(container) {
  const all = container.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  return Array.prototype.filter.call(all, el => el.offsetParent !== null);
}
function trapFocusFallback() {
  // 1. まずは常時DOM上にあり、通常のモーダル群より手前にあるサイトドックの最初のボタンへ。
  const dockBtn = document.querySelector('.site-dock button');
  if (dockBtn && dockBtn.offsetParent !== null) { dockBtn.focus(); return; }
  // 2. ドックが隠れている＝全画面オーバーレイ表示中なので、その全画面オーバーレイ自身
  //    （トラップスタックに残っている一番手前のカード）の中の最初のフォーカス可能要素へ。
  if (trapStack.length) {
    const topCard = trapStack[trapStack.length - 1].card;
    const focusable = trapFocusableEls(topCard);
    (focusable[0] || topCard).focus();
    return;
  }
  document.body.focus();
}
function trapKeydown(e) {
  if (e.key !== 'Tab' || !trapStack.length) return;
  const card = trapStack[trapStack.length - 1].card;
  const focusable = trapFocusableEls(card);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === first || !card.contains(document.activeElement)) {
      e.preventDefault();
      last.focus();
    }
  } else if (document.activeElement === last || !card.contains(document.activeElement)) {
    e.preventDefault();
    first.focus();
  }
}
export function trapPush(overlayId, card) {
  if (!card || trapStack.some(s => s.overlayId === overlayId)) return;
  trapStack.push({ overlayId, card, prevFocusEl: document.activeElement });
  if (!trapListenerAttached) {
    document.addEventListener('keydown', trapKeydown, true);
    trapListenerAttached = true;
  }
  const focusable = trapFocusableEls(card);
  (focusable[0] || card).focus();
}
export function trapPop(overlayId) {
  const idx = trapStack.findIndex(s => s.overlayId === overlayId);
  if (idx === -1) return;
  const [entry] = trapStack.splice(idx, 1);
  if (!trapStack.length && trapListenerAttached) {
    document.removeEventListener('keydown', trapKeydown, true);
    trapListenerAttached = false;
  }
  if (trapSuppressFocusRestore > 0) return;
  const el = entry.prevFocusEl;
  if (el && typeof el.focus === 'function' && document.contains(el) && el.offsetParent !== null) {
    el.focus();
  } else {
    trapFocusFallback();
  }
}
export function teardownTrap() {
  trapStack.length = 0;
  if (trapListenerAttached) { document.removeEventListener('keydown', trapKeydown, true); trapListenerAttached = false; }
  trapSuppressFocusRestore = 0;
}

/* ================================================================
   表示設定／共有・保存／読み込み／音声・画像・MIDIから作成／確認／キー設定／
   ツール（作曲）は、いずれもメイン画面や演奏・作曲モードのオーバーレイから
   独立して直接開けるため、他のどれかが開いたままもう1つを開くと重なって
   しまう。開く前に、開こうとしているもの以外を閉じておく。
   ================================================================ */
export const TOP_LEVEL_MODAL_IDS = ['shareModal', 'importModal', 'audioImportModal', 'imageImportModal', 'midiImportModal', 'confirmModal', 'keyBindModal', 'composeToolsModal'];
const CUSTOM_CLOSE_FN = {}; // id -> () => void（closeModal(id)だけでは済まない後始末が要る場合に登録）
export function registerCustomClose(id, fn) { CUSTOM_CLOSE_FN[id] = fn; }

export function closeOtherTopLevelOverlays(exceptId) {
  trapSuppressFocusRestore++;
  try {
    TOP_LEVEL_MODAL_IDS.forEach(id => {
      if (id === exceptId) return;
      const el = document.getElementById(id);
      if (!el || !el.classList.contains('open')) return;
      if (CUSTOM_CLOSE_FN[id]) CUSTOM_CLOSE_FN[id]();
      else closeModal(id);
    });
  } finally {
    trapSuppressFocusRestore--;
  }
}
// composeToolsModal（ツール）内の各ボタン（練習モード／試験モード／共有・保存／キー設定）は
// 自分自身（composeToolsModal）を閉じてから別のオーバーレイを開く。
export function composeToolsSwitchTo(openFn) {
  trapSuppressFocusRestore++;
  try {
    closeModal('composeToolsModal');
    openFn();
  } finally {
    trapSuppressFocusRestore--;
  }
}
let resetShareModalOutputsFn = null;
export function registerResetShareModalOutputs(fn) { resetShareModalOutputsFn = fn; }
export function openModal(id) {
  const el = document.getElementById(id);
  if (!el || el.classList.contains('open')) return;
  closeOtherTopLevelOverlays(id);
  if (id === 'shareModal' && resetShareModalOutputsFn) resetShareModalOutputsFn();
  el.classList.add('open');
  trapPush(id, el.querySelector('.modal-card'));
}
export function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('open');
  trapPop(id);
}

/* ================================================================
   トースト表示は1個のグローバル要素を使い回す。同じ操作の中で複数回連続して
   呼ばれる（称号を複数同時に獲得した時等）場合に備え、1件ずつキューに積んで
   順番に表示する。
   ================================================================ */
const toastQueue = [];
let toastShowing = false;
let toastTimer = null;
export function showToast(msg) {
  toastQueue.push(msg);
  if (!toastShowing) advanceToastQueue();
}
function advanceToastQueue() {
  const msg = toastQueue.shift();
  if (msg === undefined) { toastShowing = false; return; }
  toastShowing = true;
  const el = document.getElementById('toast');
  if (!el) { toastShowing = false; return; }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(advanceToastQueue, 260); // .toastのtransition(0.25s)のフェードアウトを待ってから次を出す
  }, 1800);
}
export function resetToastQueue() {
  toastQueue.length = 0;
  toastShowing = false;
  clearTimeout(toastTimer);
}

/* ================================================================
   画面内の確認モーダル（ブラウザ標準のconfirm()はダイアログブロックの
   対象になり得るため、代わりにこのモーダルを使う）
   ================================================================ */
export function showConfirm(message, onConfirm, okLabel) {
  document.getElementById('confirmModalMessage').textContent = message;
  document.getElementById('confirmModalOkBtn').textContent = okLabel || 'OK';
  RT.confirmModalCallback = onConfirm;
  openModal('confirmModal');
}
export function closeConfirm() {
  closeModal('confirmModal');
  RT.confirmModalCallback = null;
}

/* ================================================================
   ⌨️ グローバルキーボードショートカット。item/profiles.js の
   handleGlobalKeydown()を移植したもの。

   元実装はページ固有のモーダルID一覧（PF_INDEX_LOCAL_MODAL_IDS等）を
   手動管理してEscで閉じる対象を判定していたが、tai-hubでは全モーダルが
   共通の.modal-overlay/.pf-modal-overlayクラス＋.openで状態管理される
   よう既に統一されているため、個別ID列挙は不要——DOM上で「今開いている
   最前面のオーバーレイ」を汎用的に探して閉じるだけで同じ効果が得られる。

   - Escape: 最前面の開いているオーバーレイを1つ閉じる（常に有効）
   - ?      : 表示設定モーダルを開く（sky_shortcuts_enabled有効時のみ）
   - d/D    : テーマを切り替える（同上）
   - /      : ツール横断検索を開く（同上）
   ================================================================ */
import { getShortcutsEnabled, toggleTheme } from './state.js';

const NON_TEXT_INPUT_TYPES = ['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'];

function closeTopmostOpenOverlay() {
  const overlays = document.querySelectorAll('.modal-overlay.open, .pf-modal-overlay.open, .pf-drawer.mobile-open');
  const topmost = overlays[overlays.length - 1];
  if (!topmost) return false;
  if (topmost.classList.contains('pf-drawer')) {
    topmost.classList.remove('mobile-open');
    document.getElementById('toolsDrawerOverlay')?.classList.remove('show');
  } else {
    topmost.classList.remove('open');
  }
  return true;
}

async function handleGlobalKeydown(e) {
  if (e.repeat) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  const isTextInput = t && t.tagName === 'INPUT' && NON_TEXT_INPUT_TYPES.indexOf((t.type || '').toLowerCase()) === -1;
  const isTyping = t && (isTextInput || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

  if (e.key === 'Escape') {
    closeTopmostOpenOverlay();
    return;
  }

  if (isTyping) return;
  if (!getShortcutsEnabled()) return;

  if (e.key === '?') {
    e.preventDefault();
    const settingsModal = await import('./chrome/settings-modal.js');
    settingsModal.open();
    return;
  }
  if (e.key === '/') {
    e.preventDefault();
    const searchModal = await import('./chrome/search-modal.js');
    searchModal.open();
    return;
  }
  if (e.key === 'd' || e.key === 'D') {
    e.preventDefault();
    toggleTheme();
    return;
  }
}

let installed = false;
export function initShortcuts() {
  if (installed) return;
  installed = true;
  document.addEventListener('keydown', handleGlobalKeydown);
}

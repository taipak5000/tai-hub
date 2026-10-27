/* ================================================================
   🔄 「最新の状態に更新」。
   tai-hubはService Worker（service-worker.js、stale-while-revalidate）で、保存してある版を
   すぐ表示して裏で最新版を取り直す。そのため公開直後は、開いた1回目に前の版が出ることがある。
   このボタンは保存してある版（Cache Storage の tai-hub-*）を消し、Service Worker自体の更新も
   確かめてから読み込み直す。次の表示は必ずネットワークから取る（Service Workerはサーバーに
   最新かどうかを毎回問い合わせる＝ブラウザの使い回しを経由しない）。
   利用者のデータ（localStorage・IndexedDBの壁紙）には触らない。
   ================================================================ */
const RELOADED_FLAG = 'sky_hub_refreshed_at';

// Service Workerの更新を確かめ、新しい版があれば有効になるまで少し待つ（最大3秒）
async function updateServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;
  await reg.update().catch(() => {});
  const worker = reg.installing || reg.waiting;
  if (!worker) return;
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 3000);
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated' || worker.state === 'redundant') { clearTimeout(timer); resolve(); }
    });
  });
}

export async function refreshToLatest() {
  try {
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('tai-hub-')).map((n) => caches.delete(n)));
    }
    await updateServiceWorker();
  } catch (e) { /* 消せなくても読み込み直しはする */ }
  try { sessionStorage.setItem(RELOADED_FLAG, String(Date.now())); } catch (e) { /* noop */ }
  location.reload();
}

// 更新ボタンで読み込み直した直後なら true（1回だけ）
function consumeRefreshedFlag() {
  try {
    const at = Number(sessionStorage.getItem(RELOADED_FLAG));
    sessionStorage.removeItem(RELOADED_FLAG);
    return at > 0 && Date.now() - at < 60000;
  } catch (e) { return false; }
}

/** 起動時に呼ぶ。更新ボタンで読み込み直した直後だけ「最新の状態にしました」を短く出す */
export function showRefreshedToastIfNeeded(message) {
  if (!consumeRefreshedFlag()) return;
  const el = document.createElement('div');
  el.className = 'hub-refresh-toast';
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 250);
  }, 2400);
}

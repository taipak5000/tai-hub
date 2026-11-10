/* ================================================================
   🔄 「最新の状態に更新」。
   tai-hubはService Worker（service-worker.js、stale-while-revalidate）で、保存してある版を
   すぐ表示して裏で最新版を取り直す。そのため公開直後は、開いた1回目に前の版が出ることがある。
   このボタンは保存してある版（Cache Storage の tai-hub-*）を消し、Service Worker自体の更新も
   確かめてから読み込み直す。次の表示は必ずネットワークから取る（Service Workerはサーバーに
   最新かどうかを毎回問い合わせる＝ブラウザの使い回しを経由しない）。
   消す前に、保存してあったファイルを配信網（CDN）を通らない ?fresh 付きで取り直して保存し直す
   （GitHub Pagesの配信網は最大10分古い版を返すことがあり、何度も押さないと新しい版にならなかったため。2026-11-10）。
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

const CACHE_NAME = 'tai-hub-v1'; // service-worker.js の CACHE_NAME と同じ
const TARGET_KEY = 'sky_hub_update_target';
const RETRIED_KEY = 'sky_hub_update_retried';
const APP_FILE = /\.(?:js|css|json|html)$/;

// 今の保存分に入っているアプリのファイル（js・css・json・html）と、このページが読み込んだファイルのURL
async function collectAppUrls() {
  const urls = new Set();
  const add = (u) => {
    try {
      const x = new URL(u, location.href);
      if (x.origin !== location.origin || x.searchParams.has('fresh')) return;
      if (APP_FILE.test(x.pathname)) urls.add(x.origin + x.pathname + x.search);
    } catch (e) { /* noop */ }
  };
  if ('caches' in window) {
    for (const n of (await caches.keys()).filter((k) => k.startsWith('tai-hub-'))) {
      (await (await caches.open(n)).keys()).forEach((r) => add(r.url));
    }
  }
  performance.getEntriesByType('resource').forEach((e) => add(e.name));
  return [...urls];
}

// 配信網（CDN）のため込みを避けて ?fresh 付きで取り直し、元のURLで保存し直す。
// 読み込み直した直後の表示は、Service Workerがこの保存分をすぐ返す（新旧のファイルが混ざらない）
async function prefill(urls) {
  if (!('caches' in window)) return;
  const cache = await caches.open(CACHE_NAME);
  const scope = new URL('./', location.href);
  const jobs = [new URL('index.html', scope).href, ...urls];
  let i = 0;
  const worker = async () => {
    while (i < jobs.length) {
      const u = jobs[i++];
      try {
        const b = new URL(u);
        b.searchParams.set('fresh', Date.now().toString(36) + i);
        const res = await fetch(b.href, { cache: 'no-store', credentials: 'same-origin' });
        if (!res.ok) continue;
        const copy = new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
        await cache.put(u === jobs[0] ? new Request(new URL('index.html', scope).href) : new Request(u), copy);
      } catch (e) { /* 取れなかったものは、開いた時にService Workerが取る */ }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
}

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 保存分を消して最新版を取り直し、読み込み直す。
 * targetVersion（公開中の新しい版）を渡すと、読み込み直してもまだ前の版だった時に1回だけ自動でやり直す
 */
export async function refreshToLatest(targetVersion) {
  try {
    const urls = await collectAppUrls();
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('tai-hub-')).map((n) => caches.delete(n)));
    }
    await updateServiceWorker();
    await Promise.race([prefill(urls), timeout(15000)]);
  } catch (e) { /* 消せなくても読み込み直しはする */ }
  try {
    sessionStorage.setItem(RELOADED_FLAG, String(Date.now()));
    if (targetVersion) sessionStorage.setItem(TARGET_KEY, targetVersion);
  } catch (e) { /* noop */ }
  location.reload();
}

/**
 * 起動時に呼ぶ。更新ボタンで目指した版にまだなっていなければ、1回だけ自動でやり直して true を返す。
 * compare は js/app-update.js の compareVersion（ここで読み込むと循環するので渡してもらう）
 */
export function retryRefreshIfBehind(currentVersion, compare) {
  try {
    const target = sessionStorage.getItem(TARGET_KEY);
    if (!target) return false;
    if (!currentVersion || compare(currentVersion, target) >= 0 || sessionStorage.getItem(RETRIED_KEY)) {
      sessionStorage.removeItem(TARGET_KEY);
      sessionStorage.removeItem(RETRIED_KEY);
      return false;
    }
    sessionStorage.setItem(RETRIED_KEY, '1');
    refreshToLatest(target);
    return true;
  } catch (e) { return false; }
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

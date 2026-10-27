/* ================================================================
   tai-hub の Service Worker（オフライン対応＋起動の高速化）。

   skyツール/CLAUDE.md の方針どおり stale-while-revalidate にしている:
   キャッシュがあれば即それを返し、同時に裏でネットワークから最新版を取り直して
   キャッシュを更新する（初回のキャッシュが無い時だけネットワークを待つ）。
   → CACHE_VERSIONを上げ忘れても、サイトを1回開けば裏で最新化される。
   CACHE_VERSIONは「今すぐ全端末のキャッシュを捨てたい」時の手動トリガー。
   ・裏で取り直す時（とキャッシュが無い時）は、同一オリジンのファイルを cache:'no-cache' で取る。
     ブラウザ自体のキャッシュ（GitHub Pagesは最大10分）を使い回さず、必ずサーバーに最新か
     問い合わせる（変わっていなければ304で済むので重くない）。関連ツール一覧の
     「最新の状態に更新」（js/refresh.js）は、保存分を消してこの経路で取り直させる。

   ・同一オリジンのGETと、Vue / html2canvas / フォントのCDNだけを対象にする
     （Wikiの画像などの外部画像は対象外＝オフラインでは表示されない）。
   ・ナビゲーション（ページを開く操作）は、オフラインなら保存済みの index.html を返す
     （ルートは#以降なのでページ自体は常に ./ 1枚）。
   ================================================================ */
const CACHE_VERSION = 'v1';
const CACHE_NAME = 'tai-hub-' + CACHE_VERSION;
const CDN_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const SHELL = ['./', 'index.html', 'manifest.json', 'icons/app-icon-192.png', 'icons/app-icon-512.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => Promise.all(SHELL.map((u) => cache.add(u).catch(() => {})))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith('tai-hub-') && n !== CACHE_NAME).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !CDN_HOSTS.includes(url.hostname)) return;

  event.respondWith((async () => {
    const isNav = req.mode === 'navigate';
    // ページ自体は ./ 1枚（クエリ違い・ハッシュ違いでも同じ index.html）
    const cached = isNav
      ? (await caches.match('index.html', { ignoreSearch: true })) || (await caches.match('./', { ignoreSearch: true }))
      : await caches.match(req);
    const revalidate = (async () => {
      try {
        // 同一オリジンはブラウザのキャッシュを経由せずサーバーに確かめる（ページ遷移は index.html を取る）
        const res = sameOrigin
          ? await fetch(isNav ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : new Request(req, { cache: 'no-cache' }))
          : await fetch(req);
        // 同一オリジンは成功したものだけ、CDNは不透明レスポンス（no-corsのscript）も保存する
        if (res && (res.ok || (!sameOrigin && res.type === 'opaque'))) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(isNav ? new Request('index.html') : req, res.clone());
        }
        return res;
      } catch (err) {
        return cached || Response.error(); // オフライン等はキャッシュへフォールバック
      }
    })();
    if (cached) {
      event.waitUntil(revalidate); // 裏側の更新はレスポンスを待たせず継続させる
      return cached;
    }
    return revalidate; // キャッシュが無い初回はネットワークの完了を待つ
  })());
});

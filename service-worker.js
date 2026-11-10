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
   ・さらに同一オリジンは、URLに ?fresh=… を付けて取る（2026-11-10）。GitHub Pagesの配信網（CDN）は
     ファイルを最大10分ため込み、no-cache を付けても古い版を返すことがあるため。手元の保存分の
     ETag・Last-Modified を付けて問い合わせるので、変わっていなければ304で済む。
     返すレスポンスは元のURLのものとして作り直す（モジュールの基準URLが ?fresh 付きにならないように）。

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

// 配信網（CDN）のため込みを避けるため、同一オリジンのURLに毎回ちがう ?fresh を付ける
function bustUrl(u) {
  const b = new URL(u.href);
  b.searchParams.set('fresh', Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
  return b.href;
}
// 手元の保存分があれば、それと同じなら304を返してもらう
function conditionalHeaders(cached) {
  const h = {};
  if (!cached) return h;
  const etag = cached.headers.get('ETag');
  const lm = cached.headers.get('Last-Modified');
  if (etag) h['If-None-Match'] = etag;
  else if (lm) h['If-Modified-Since'] = lm;
  return h;
}
// ?fresh 付きで取ったレスポンスを、URLを持たないレスポンスに作り直す（要求した元のURLのものとして扱われる）
async function asOriginal(res) {
  const body = await res.blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !CDN_HOSTS.includes(url.hostname)) return;
  // ?fresh の付いた要求（js/app-update.js が新しいバージョンを確かめる時）は保存分を返さず、そのままネットワークへ
  if (sameOrigin && url.searchParams.has('fresh')) return;

  // ページを開く操作のうち、アプリ本体（./ と ./index.html）以外は素通しにする。
  // ツールの紹介ページ（./item/ など。検索エンジン向けの静的なページ）を開いた時に、アプリの index.html を返してしまわないため
  if (req.mode === 'navigate' && sameOrigin) {
    const root = new URL('./', self.registration.scope).pathname;
    if (url.pathname !== root && url.pathname !== root + 'index.html') return;
  }

  event.respondWith((async () => {
    const isNav = req.mode === 'navigate';
    // ページ自体は ./ 1枚（クエリ違い・ハッシュ違いでも同じ index.html）
    const cached = isNav
      ? (await caches.match('index.html', { ignoreSearch: true })) || (await caches.match('./', { ignoreSearch: true }))
      : await caches.match(req);
    const revalidate = (async () => {
      try {
        // 同一オリジンはブラウザのキャッシュを経由せずサーバーに確かめる（ページ遷移は index.html を取る）
        let res;
        if (sameOrigin) {
          const net = await fetch(bustUrl(isNav ? new URL(url.pathname, url.origin) : url), {
            cache: 'no-store', credentials: 'same-origin', headers: conditionalHeaders(cached),
          });
          if (net.status === 304 && cached) return cached; // 変わっていない
          res = net.ok ? await asOriginal(net) : net;
        } else {
          res = await fetch(req);
        }
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

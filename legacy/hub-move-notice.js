/* ================================================================
   hub-move-notice.js — 新サイト「tai-hub」へのお引っ越しのお知らせ

   各スタンドアロンサイト（tai-item・tai-emote・share・wings…）が
   <script defer src="/tai-hub/legacy/hub-move-notice.js"></script> で読み込む共通バナー。
   （2026-11-06に tai-item から tai-hub/legacy/ へ移した。tai-item のリポジトリを削除するため）
   文面・日付・リンク先はこのファイル1か所で管理する（全サイトに一括で反映される）。

   ・tai-hubへのボタンは、/tai-hub/ が実際に公開されているか（リポジトリ名を
     tsts → tai-hub に改名済みか）を HEAD リクエストで確かめてから有効にする。
     改名前は「公開準備中」の表示になり、改名後はこのファイルを触らなくても
     そのサイトに対応するツールの画面（例: /tai-hub/#/item/cape）へ飛べる。
   ・閉じると24時間は表示しない（sky_hub_move_notice_closed に時刻を保存）。
   ・CLOSE_AT（2026/11/1 0:00 日本時間）を過ぎたら、お知らせの代わりに画面全体を覆う
     「終了しました」画面を出し、サイトの機能を使えなくする（閉じるボタンは無い）。
     ページを開いたまま日付が変わった場合も、その瞬間に切り替わる。
     ホーム画面アプリ（iOS）はブラウザと保存先が別なので、データだけは持ち出せるよう
     「データをファイルに保存」を残す。形式はtai-hubの 表示設定 > データのバックアップ と
     同じ（{ exportedFrom, exportedAt, data: localStorageの中身 }）なので、そのまま読み込める。
   ================================================================ */
(function () {
  'use strict';
  if (window.__skyHubMoveNotice) return;
  window.__skyHubMoveNotice = true;

  var HUB_PATH = '/tai-hub/';
  var TRANSFER_PATH = '/tai-transfer/';
  var CLOSED_KEY = 'sky_hub_move_notice_closed';
  var HIDE_MS = 24 * 60 * 60 * 1000;
  var CLOSE_AT = Date.parse('2026-11-01T00:00:00+09:00');

  // 旧サイトのパス（先頭のディレクトリ名）→ tai-hub のルート
  var ROUTES = {
    'tai-item': 'item',
    'tai-emote': 'emote',
    'share': 'share',
    'tai-nomacan': 'tai-nomacan',
    'tai-nomacan.pro': 'tai-nomacan-pro',
    'star-candle': 'star-candle',
    'companion': 'companion',
    'wings': 'wings',
    'tai-catalog': 'spirit-catalog',
    'tai-revisit': 'tai-revisit',
    'tai-score': 'tai-score',
    'tai-card': 'tai-card',
    'tai-transfer': 'data-transfer',
    'tai-info': 'tai-info',
    'skyzztai-profile': 'profile'
  };

  function store(fn) { try { return fn(); } catch (e) { return null; } }

  var en = store(function () { return localStorage.getItem('sky_app_lang'); }) === 'en';
  var T = en ? {
    title: 'We are moving to “tai-hub” by the end of October',
    body: 'All tools are being combined into one new site, tai-hub. From November 1, this site can no longer be used. In the same browser, your data carries over as is. ' +
      'If you use a home-screen app or another browser, please save your data to a file with Data Transfer before the move.',
    open: 'Open tai-hub',
    soon: 'tai-hub (coming soon)',
    backup: 'Back up data',
    close: 'Close',
    appGuide: 'Using a home-screen app?',
    appSteps: [
      'In this app, open "Data Transfer", select the sites, tap "Create Code", then "Download as File". You do not need to copy the code (it can be too long to paste).',
      'Open tai-hub where you will use it (the tai-hub app added to your home screen, or Safari). They keep separate data, so use the one you will keep using.',
      'In tai-hub, go to "Data Transfer" → "Restore from a Code", tap "Choose File", pick the saved file, and restore.'
    ],
    endTitle: 'This site closed on October 31',
    endBody: 'All tools have moved to the new site, tai-hub. Please use tai-hub from now on. In the same browser, your data has already carried over.',
    endOpen: 'Open in tai-hub',
    endAppTitle: 'If you used this site as a home-screen app',
    endAppBody: 'Data in a home-screen app does not move automatically. Save it to a file below, then in tai-hub go to "Data Transfer" → "Restore from a Code" and choose that file.',
    endSave: 'Save data to a file',
    endSaved: 'Saved {n} items. Restore the file in tai-hub.',
    endSaveFailed: 'Could not save the data.'
  } : {
    title: '10月末で、新サイト「tai-hub」へお引っ越しします',
    body: '各ツールを1つにまとめた新サイト「tai-hub」へ移ります。11月1日からはこのサイトは使えなくなります。同じブラウザならデータはそのまま引き継がれます。' +
      'ホーム画面に追加したアプリや別のブラウザで使っている方は、引っ越し前に「データ引継ぎ」でデータをファイルに保存しておいてください。',
    open: 'tai-hubを開く',
    soon: 'tai-hub（準備中）',
    backup: 'データをバックアップ',
    close: '閉じる',
    appGuide: 'ホーム画面のアプリで使っている方へ',
    appSteps: [
      'このアプリの「データ引継ぎ」で移したいサイトを選び、「選んだサイトのコードを作成」→「ファイルとしてダウンロード」を押します。コードのコピーは長すぎて貼り付けられないことがあるので、使わなくて大丈夫です。',
      'tai-hubを、これから使う場所で開きます（ホーム画面に追加したtai-hubのアプリ、またはSafari）。この2つでもデータは別々なので、使い続ける方で開いてください。',
      'tai-hubの「データ引継ぎ」→「コードから復元」で「ファイルを選択」を押し、保存したファイルを選んで復元します。'
    ],
    endTitle: 'このサイトは10月31日で終了しました',
    endBody: '各ツールは新サイト「tai-hub」に移りました。これからは tai-hub をご利用ください。同じブラウザなら、データはそのまま引き継がれています。',
    endOpen: 'tai-hubで開く',
    endAppTitle: 'ホーム画面に追加したアプリで使っていた方へ',
    endAppBody: 'アプリに保存されたデータは自動では移りません。下のボタンでファイルに保存し、tai-hubの「データ引継ぎ」→「コードから復元」でこのファイルを選んで復元してください。',
    endSave: 'データをファイルに保存',
    endSaved: '{n}件を保存しました。tai-hubで読み込んでください。',
    endSaveFailed: 'データを保存できませんでした。'
  };

  function hubUrl() {
    var parts = location.pathname.split('/').filter(Boolean);
    var route = ROUTES[parts[0]];
    if (!route) return HUB_PATH;
    if (route === 'item' && parts[1]) {
      var page = parts[1].replace(/\.html$/, '');
      if (page === 'item_cost') return HUB_PATH + '#/item/cost';
      if (page !== 'index' && /^[a-z_]+$/.test(page)) return HUB_PATH + '#/item/' + page;
    }
    return HUB_PATH + '#/' + route;
  }

  var CSS = '' +
    '.hmn{--hmn-bg:#fff;--hmn-text:#1c1c1e;--hmn-text-2:#5b5b63;--hmn-line:rgba(60,60,67,.18);--hmn-accent:#0a66d8;--hmn-accent-ink:#fff;--hmn-soft:rgba(10,102,216,.1);' +
    'box-sizing:border-box;position:relative;z-index:50;margin:12px auto;width:calc(100% - 24px);max-width:720px;padding:14px 16px;' +
    'background:var(--hmn-bg);color:var(--hmn-text);border:1px solid var(--hmn-line);border-radius:16px;box-shadow:0 4px 18px rgba(0,0,0,.08);' +
    'font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif;text-align:left;' +
    'animation:hmnIn .32s cubic-bezier(.2,.8,.2,1)}' +
    '.hmn *{box-sizing:border-box}' +
    '.hmn-title{margin:0 0 6px;padding-right:28px;font-size:15px;font-weight:700;line-height:1.35;letter-spacing:-.01em}' +
    '.hmn-body{margin:0 0 12px;font-size:13px;line-height:1.7;color:var(--hmn-text-2)}' +
    '.hmn-actions{display:flex;flex-wrap:wrap;gap:8px}' +
    '.hmn-guide-btn{display:inline-flex;align-items:center;gap:4px;margin:10px 0 0;padding:0;border:0;background:none;font:inherit;font-size:12.5px;font-weight:600;color:var(--hmn-accent);cursor:pointer}' +
    '.hmn-guide-btn::before{content:"›";display:inline-block;font-size:16px;line-height:1;transition:transform .2s ease}' +
    '.hmn-guide-btn[aria-expanded="true"]::before{transform:rotate(90deg)}' +
    '.hmn-steps{margin:8px 0 0;padding-left:1.4em;font-size:12.5px;line-height:1.7;color:var(--hmn-text-2)}' +
    '.hmn-steps li+li{margin-top:4px}' +
    '.hmn-btn{display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:0 14px;border:0;border-radius:999px;font:inherit;font-size:13px;font-weight:600;text-decoration:none;cursor:pointer;transition:transform .12s}' +
    '.hmn-btn:active{transform:scale(.96)}' +
    '.hmn-primary{background:var(--hmn-accent);color:var(--hmn-accent-ink)}' +
    '.hmn-secondary{background:var(--hmn-soft);color:var(--hmn-accent)}' +
    '.hmn-btn[aria-disabled="true"]{background:var(--hmn-line);color:var(--hmn-text-2);pointer-events:none}' +
    '.hmn-close{position:absolute;top:8px;right:8px;width:30px;height:30px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--hmn-text-2);font:inherit;font-size:18px;line-height:30px;cursor:pointer}' +
    '.hmn-close:active{background:var(--hmn-line)}' +
    '.hmn.hmn-out{animation:hmnOut .2s ease forwards}' +
    '@keyframes hmnIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}' +
    '@keyframes hmnOut{to{opacity:0;transform:translateY(-8px)}}' +
    'html[data-theme="dark"] .hmn{--hmn-bg:#1c1b22;--hmn-text:#f2f2f7;--hmn-text-2:#b4b4bd;--hmn-line:rgba(235,235,245,.2);--hmn-accent:#4c9dff;--hmn-accent-ink:#0b1220;--hmn-soft:rgba(76,157,255,.16);box-shadow:none}' +
    '@media (prefers-color-scheme:dark){html:not([data-theme]) .hmn{--hmn-bg:#1c1b22;--hmn-text:#f2f2f7;--hmn-text-2:#b4b4bd;--hmn-line:rgba(235,235,245,.2);--hmn-accent:#4c9dff;--hmn-accent-ink:#0b1220;--hmn-soft:rgba(76,157,255,.16);box-shadow:none}}' +
    '@media (prefers-reduced-motion:reduce){.hmn{animation:hmnFade .2s ease}.hmn.hmn-out{animation:hmnFadeOut .2s ease forwards}}' +
    '@keyframes hmnFade{from{opacity:0}to{opacity:1}}' +
    '@keyframes hmnFadeOut{to{opacity:0}}' +
    '@media (prefers-contrast:more){.hmn{border-color:var(--hmn-text-2)}}';

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  /* ── 11/1以降: サイトを覆う「終了しました」画面 ── */
  var END_CSS = '' +
    'html.hmn-ended,html.hmn-ended body{overflow:hidden!important}' +
    '.hmn-end{--e-bg:#f2f2f7;--e-card:#fff;--e-text:#1c1c1e;--e-text-2:#5b5b63;--e-line:rgba(60,60,67,.18);--e-accent:#0a66d8;--e-accent-ink:#fff;--e-soft:rgba(10,102,216,.1);' +
    'position:fixed;inset:0;z-index:2147483647;overflow-y:auto;-webkit-overflow-scrolling:touch;background:var(--e-bg);color:var(--e-text);' +
    'display:flex;align-items:center;justify-content:center;padding:24px 16px calc(24px + env(safe-area-inset-bottom));box-sizing:border-box;' +
    'font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif;text-align:left;outline:none}' +
    '.hmn-end *{box-sizing:border-box}' +
    '.hmn-end-card{width:100%;max-width:480px;background:var(--e-card);border-radius:20px;padding:24px 20px;box-shadow:0 6px 24px rgba(0,0,0,.08)}' +
    '.hmn-end-title{margin:0 0 10px;font-size:20px;font-weight:700;line-height:1.3;letter-spacing:-.02em}' +
    '.hmn-end-body{margin:0 0 18px;font-size:14px;line-height:1.75;color:var(--e-text-2)}' +
    '.hmn-end-btn{display:flex;align-items:center;justify-content:center;width:100%;min-height:46px;padding:0 16px;border:0;border-radius:12px;font:inherit;font-size:15px;font-weight:700;text-decoration:none;cursor:pointer;transition:transform .12s}' +
    '.hmn-end-btn:active{transform:scale(.97)}' +
    '.hmn-end-primary{background:var(--e-accent);color:var(--e-accent-ink)}' +
    '.hmn-end-secondary{background:var(--e-soft);color:var(--e-accent)}' +
    '.hmn-end-sep{margin:22px 0 14px;border:0;border-top:1px solid var(--e-line)}' +
    '.hmn-end-sub{margin:0 0 6px;font-size:14px;font-weight:700}' +
    '.hmn-end-note{margin:0 0 12px;font-size:13px;line-height:1.7;color:var(--e-text-2)}' +
    '.hmn-end-status{margin:10px 0 0;font-size:12.5px;line-height:1.6;color:var(--e-text-2);min-height:1em}' +
    'html[data-theme="dark"] .hmn-end{--e-bg:#000;--e-card:#1c1b22;--e-text:#f2f2f7;--e-text-2:#b4b4bd;--e-line:rgba(235,235,245,.2);--e-accent:#4c9dff;--e-accent-ink:#0b1220;--e-soft:rgba(76,157,255,.16)}' +
    '@media (prefers-color-scheme:dark){html:not([data-theme]) .hmn-end{--e-bg:#000;--e-card:#1c1b22;--e-text:#f2f2f7;--e-text-2:#b4b4bd;--e-line:rgba(235,235,245,.2);--e-accent:#4c9dff;--e-accent-ink:#0b1220;--e-soft:rgba(76,157,255,.16)}}' +
    '@media (prefers-contrast:more){.hmn-end-card{border:1px solid var(--e-text-2)}}';

  // tai-hubの exportAllData() と同じ形式で、このオリジンのlocalStorageをまるごと書き出す
  function saveAllData(statusEl) {
    try {
      var dump = {};
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        dump[key] = localStorage.getItem(key);
      }
      var payload = { exportedFrom: 'taipak5000.github.io', exportedAt: new Date().toISOString(), data: dump };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'sky-tools-backup_' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      statusEl.textContent = T.endSaved.replace('{n}', String(Object.keys(dump).length));
    } catch (e) {
      statusEl.textContent = T.endSaveFailed;
    }
  }

  var ended = false;
  function renderEnded() {
    if (ended) return;
    ended = true;
    document.querySelectorAll('.hmn').forEach(function (n) { n.remove(); });
    var style = el('style');
    style.textContent = END_CSS;
    document.head.appendChild(style);
    document.documentElement.classList.add('hmn-ended');

    var wrap = el('div', 'hmn-end');
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', T.endTitle);
    var card = el('div', 'hmn-end-card');
    card.appendChild(el('h1', 'hmn-end-title', T.endTitle));
    card.appendChild(el('p', 'hmn-end-body', T.endBody));
    var open = el('a', 'hmn-end-btn hmn-end-primary', T.endOpen);
    open.href = hubUrl();
    card.appendChild(open);
    card.appendChild(el('hr', 'hmn-end-sep'));
    card.appendChild(el('p', 'hmn-end-sub', T.endAppTitle));
    card.appendChild(el('p', 'hmn-end-note', T.endAppBody));
    var save = el('button', 'hmn-end-btn hmn-end-secondary', T.endSave);
    save.type = 'button';
    var status = el('p', 'hmn-end-status');
    status.setAttribute('role', 'status');
    save.addEventListener('click', function () { saveAllData(status); });
    card.appendChild(save);
    card.appendChild(status);
    wrap.appendChild(card);
    document.body.appendChild(wrap);

    // 画面の下にあるサイト本体は、見えないだけでなく操作・フォーカスもできないようにする。
    // 後からサイト側が足す要素（モーダル・Vueの描画など）も同じく止める
    var lock = function (node) { if (node !== wrap && node.nodeType === 1 && node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE') node.inert = true; };
    Array.prototype.forEach.call(document.body.children, lock);
    new MutationObserver(function (list) {
      list.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, lock); });
    }).observe(document.body, { childList: true });
    wrap.tabIndex = -1;
    try { wrap.focus({ preventScroll: true }); } catch (e) { /* noop */ }
  }

  function render() {
    var style = el('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var box = el('section', 'hmn');
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', T.title);
    box.appendChild(el('p', 'hmn-title', T.title));
    box.appendChild(el('p', 'hmn-body', T.body));

    var actions = el('div', 'hmn-actions');
    var open = el('a', 'hmn-btn hmn-primary', T.soon);
    open.setAttribute('aria-disabled', 'true');
    var backup = el('a', 'hmn-btn hmn-secondary', T.backup);
    backup.href = TRANSFER_PATH;
    actions.appendChild(open);
    if (location.pathname.indexOf(TRANSFER_PATH) !== 0) actions.appendChild(backup);
    box.appendChild(actions);

    // ホーム画面アプリの人向けの手順（開閉式）
    var guideBtn = el('button', 'hmn-guide-btn', T.appGuide);
    guideBtn.type = 'button';
    guideBtn.setAttribute('aria-expanded', 'false');
    var steps = el('ol', 'hmn-steps');
    steps.hidden = true;
    T.appSteps.forEach(function (text) { steps.appendChild(el('li', '', text)); });
    guideBtn.addEventListener('click', function () {
      steps.hidden = !steps.hidden;
      guideBtn.setAttribute('aria-expanded', String(!steps.hidden));
    });
    box.appendChild(guideBtn);
    box.appendChild(steps);

    var close = el('button', 'hmn-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', T.close);
    close.addEventListener('click', function () {
      store(function () { localStorage.setItem(CLOSED_KEY, String(Date.now())); });
      box.classList.add('hmn-out');
      setTimeout(function () { box.remove(); }, 220);
    });
    box.appendChild(close);

    document.body.insertBefore(box, document.body.firstChild);

    // tai-hub が公開済み（改名済み）ならボタンを有効にする
    if (window.fetch) {
      fetch(HUB_PATH + 'manifest.json', { method: 'HEAD', cache: 'no-store' }).then(function (res) {
        if (!res.ok) return;
        open.textContent = T.open;
        open.href = hubUrl();
        open.removeAttribute('aria-disabled');
      }).catch(function () {});
    }
  }

  function start() {
    if (Date.now() >= CLOSE_AT) { renderEnded(); return; }
    // ページを開いたまま11/1を迎えたら、その時点で終了画面に切り替える
    // （タイマーは上限約24.8日で早く発火するので時刻を確かめる。スリープ復帰時は表示に戻った時に確かめる）
    var checkEnd = function () { if (Date.now() >= CLOSE_AT) renderEnded(); };
    setTimeout(checkEnd, Math.min(CLOSE_AT - Date.now() + 50, 0x7fffffff));
    document.addEventListener('visibilitychange', checkEnd);
    var closedAt = Number(store(function () { return localStorage.getItem(CLOSED_KEY); })) || 0;
    if (Date.now() - closedAt < HIDE_MS) return;
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

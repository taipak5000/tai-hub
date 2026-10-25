/* ================================================================
   作者プロフィール（自己紹介ページ）のtai-hub移植版。公開面は
   mount(container, sub)/unmount() の2関数のみ（js/router.js からマウント
   される。profileはサブルートを持たない単一ページのため sub は無視する）。

   移植元: profile/index.html （~3680行のスタンドアロンページ、ライブ版
   https://taipak5000.github.io/skyzztai-profile/ ・ローカルチェックアウト
   skyツール/profile/index.html）のうち、共有chrome（site-dock/pf-modal/
   settings-modal/tools-drawer/サイドバー・テーマ/言語/ショートカット・
   フォーカストラップ・ドラッグ物理演算つきボトムシート等）を除いた
   「このツール自身」の部分：プロフィールカード（アバター・名前・
   タグライン・MBTI/AGE/GAMEバッジ・自己紹介文・「もっと知りたい人向け」
   詳細・闇の破片バッジ）・リンク一覧・プロフィールリンクのコピー・
   アバターのイースターエッグ（シャボン玉パーティクル＋弾む演出）・
   「今日・今週・今月」ダッシュボードの呼び出し。

   闇の破片バッジの予測ロジックは profile-shard.js に、表示内容
   （profile本文・links配列）は data/profile-data.js に分けている。

   【意図的な簡略化・アダプテーション（元の挙動を変えない範囲の adaptation）】
   - カード右上の「表示設定」歯車ボタン・言語切替(EN/日本語)ボタンは
     移植していない。tai-hubの共有chrome（ドック「表示設定」→
     js/chrome/settings-modal.js）に同機能（テーマ・言語・ショートカット・
     データのバックアップ）が既にあるため（nomacan-view.js等、既存の
     移植済みツールと同じ判断）。これに伴い、値の読み書きが無くなった
     toggleLang()/setLang() 等のページ内言語切替一式・初回訪問ヒント
     バナー（sky_first_visit_hint_shown_v1。多保存枠・データ引継ぎの
     案内文で、tai-hub自体がその2機能を統合済みのSPAであるため元の
     訴求内容が薄れる）も同じ理由で見送った。言語自体は
     tai-hub共通のCURRENT_LANG（js/i18n.js）に従うため、設定側の
     言語切替（reload方式）はそのまま機能する。
   - 「今日・今週・今月」ダッシュボードは features/shared/event-dashboard.js
     （companion/spirit-catalog/wings/profileの4ツールが元々別々に持って
     いたpfDash系・pfReminder系一式を抽出した共有モジュール）をmountして
     使う。元実装は自サイトのitem/index.htmlを自己fetch+正規表現抽出して
     いた(pfDashLoadData/pfExtractArray)が、event-dashboard.js は
     features/item/data/season-data.js を直接importするためその仕組み
     ごと不要になった（fetchなしで同じ情報を即座に表示できる、という
     SPA化の具体的な改善点）。闇の破片バッジ（アバター横の常時表示の
     小さいバッジ）はダッシュボードとは別物として元々存在するため、
     従来通り profile-shard.js の独立した予測ロジックで表示する。
     このダッシュボードを開く入口として、カード上部に `.pv-dash-trigger-row`
     （`#pvOpenDashBtn`）を新設している。原本の profile/index.html 自体には
     この位置にボタンは無く、site-dock の「ダッシュボード」ボタン
     （`pfDashOpen()`）だけが入口だったが、tai-hub の site-dock 側
     「ダッシュボード」タブ（js/chrome/dash-modal.js）は全ツール共通の
     軽量版（今日/今週/今月の3分割やカレンダーを持たない簡易リスト）で
     あり、原本の site-dock ボタンが開いていたフル機能版とは別物になる。
     そのため、原本と同じフル機能ダッシュボードへ到達できる入口を維持する
     目的で、このツール固有の入口ボタンを意図的に追加している（オーバー
     サイトではなく意図的なアダプテーション）。
   - ダッシュボードモーダル・カードの登場演出は元のドラッグ物理演算つき
     ボトムシートではなく、tai-hubの他のモーダル（js/chrome/pf-modal.js
     等）と同じ「.modal-overlay・.modal-card + open クラスでのフェード/
     スライド」方式に統一した（nomacan-view.js等、既存移植と同じ
     簡略化。ドラッグでの開閉自体は元々「見た目の演出」の話で、
     背景タップ/×ボタンでの閉じる操作自体は変わらず機能する）。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { PROFILE, LINKS } from './data/profile-data.js';
import { findShardStatus, realmName, SHARD_REALMS } from './profile-shard.js';
import * as eventDashboard from '../shared/event-dashboard.js';
import { navigate } from '../../js/router.js';

const STYLE_LINK_ID = 'profile-view-styles';
const ICON_SPRITE_ID = 'profile-icon-sprite';
const SHARD_REFRESH_MS = 30000;

function t(ja, en) { return CURRENT_LANG === 'en' ? en : ja; }
function tpl(str, vars) {
  return Object.keys(vars || {}).reduce((s, k) => s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]), str);
}
// { xxx, xxxEn } の組を持つオブジェクトから、現在の表示言語に対応する
// フィールドを取り出す（元のlocalizedField()と同じ規約：英語版が空欄なら
// 日本語版にフォールバック）
function localizedField(obj, field) {
  if (!obj) return '';
  if (CURRENT_LANG === 'en') {
    const v = obj[field + 'En'];
    if (v) return v;
  }
  return obj[field] || '';
}

let containerEl = null;
let els = {};
let shardIntervalId = null;
let toastTimer = null;
let prefersReducedMotion = false;

/* ================================================================
   公開API
   ================================================================ */
export function mount(container /* , sub */) {
  injectStylesheet();
  injectLocalIconSprite();

  prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  containerEl = container;
  container.innerHTML = renderShell();
  cacheEls();
  wireEvents();

  renderShardBadge();
  clearInterval(shardIntervalId);
  shardIntervalId = setInterval(renderShardBadge, SHARD_REFRESH_MS);
}

export function unmount() {
  clearInterval(shardIntervalId);
  shardIntervalId = null;
  clearTimeout(toastTimer);
  document.getElementById('pvDashModalOverlay')?.remove();
  eventDashboard.unmount();
  // アバターのイースターエッグで発生させたパーティクル（position:fixedでbody直下に
  // 追加している）は通常animationendで自己削除するが、アンマウントのタイミングが
  // 重なった場合に取り残されないよう念のため一括で片付ける
  document.querySelectorAll('.pv-particle').forEach(el => el.remove());
  containerEl = null;
  els = {};
}

/* ================================================================
   スタイルシート・ローカルアイコンスプライトの注入（初回のみ）
   ================================================================ */
function injectStylesheet() {
  if (document.getElementById(STYLE_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_LINK_ID;
  link.rel = 'stylesheet';
  link.href = new URL('../../css/profile.css', import.meta.url).href;
  document.head.appendChild(link);
}
// tai-hub共有の#pf-icon-sprite(js/icon-sprite.js)には無い、このツールの
// リンク一覧だけで使うアイコン2種（X (Twitter)ロゴ・お題箱の箱）と、
// プロフィールリンクのコピー用アイコン(i-link。共有スプライトにも無い)だけを
// pv-i- プレフィックスで追加注入する（共有ファイル自体は編集しない。
// nomacan-view.js/wings-view.js等の「ローカルスプライト」パターンを踏襲）。
const PROFILE_SPRITE_HTML = `
<svg id="${ICON_SPRITE_ID}" style="position:absolute;width:0;height:0;overflow:hidden;" aria-hidden="true"><defs>
<symbol id="pv-i-link" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.167) translate(-12.5 -11.5)"><path d="M9 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19h11a1.5 1.5 0 0 0 1.5-1.5V15"/><path d="M14 4h6v6"/><path d="M20 4L10 14"/></g></symbol>
<symbol id="pv-i-x-logo" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.25) translate(-12 -12)"><path d="M5 5l14 14M19 5L5 19"/></g></symbol>
<symbol id="pv-i-box" viewBox="0 0 24 24"><path d="M4 8.5L12 4l8 4.5v8L12 21l-8-4.5Z"/><path d="M4 8.5L12 12.5l8-4"/><path d="M12 12.5V21"/></symbol>
</defs></svg>`;
function injectLocalIconSprite() {
  if (document.getElementById(ICON_SPRITE_ID)) return;
  document.body.insertAdjacentHTML('afterbegin', PROFILE_SPRITE_HTML);
}

/* ================================================================
   マークアップ
   ================================================================ */
function renderShell() {
  const initial = (PROFILE.name || '?').trim().charAt(0);
  const avatarInner = PROFILE.avatarImage
    ? `<img src="${escapeHtml(PROFILE.avatarImage)}" alt="${escapeHtml(PROFILE.name)}">`
    : escapeHtml(initial);
  const year = new Date().getFullYear();
  const footnoteText = localizedField(PROFILE, 'footnote') || `© ${year} ${PROFILE.name}`;

  return `
    <div class="profile-view">
    <div class="pv-wrap">
      <header class="tool-nav-head"><h1><svg class="inline-icon" width="19" height="19"><use href="#i-person"/></svg> ${t('プロフィール', 'Profile')}</h1></header>
      <div class="pv-dash-trigger-row">
        <button type="button" class="pv-dash-trigger-btn" id="pvOpenDashBtn">
          <svg class="inline-icon" width="15" height="15"><use href="#i-calendar"/></svg>
          ${t('今日・今週・今月', 'Today / This Week / This Month')}
        </button>
      </div>

      <main class="card" id="pvCard">
        <div class="term-bar">
          <span class="term-dots" aria-hidden="true">
            <span class="term-dot"></span>
            <span class="term-dot"></span>
            <span class="term-dot"></span>
          </span>
          <p class="card-label">${escapeHtml(PROFILE.label || '')}</p>
          <button type="button" class="lang-toggle" id="pvCopyLinkBtn" title="${escapeHtml(t('リンクをコピー', 'Copy link'))}" aria-label="${escapeHtml(t('プロフィールのリンクをコピー', 'Copy profile link'))}">
            <svg class="inline-icon" width="16" height="16"><use href="#pv-i-link"/></svg>
          </button>
        </div>

        <div class="profile">
          <div class="avatar-row">
            <div class="avatar-wrap" id="pvAvatarWrap" role="button" tabindex="0" title="${escapeHtml(t('タップしてみてね', 'Tap me!'))}">
              <div class="avatar" id="pvAvatar">${avatarInner}</div>
              <div class="shard-badge" id="pvShardBadge" role="button" tabindex="0">
                <span class="shard-dot" id="pvShardDot"></span>
                <span class="shard-realm" id="pvShardRealmText">--</span>
              </div>
            </div>
          </div>
          <h1 class="name">${escapeHtml(PROFILE.name)}</h1>
          <p class="tagline">${escapeHtml(localizedField(PROFILE, 'tagline'))}</p>
          <div class="badges-row">
            ${PROFILE.mbti ? `<div class="info-badge" id="pvMbtiBadge"><span class="info-badge-label">MBTI</span><span class="info-badge-value">${escapeHtml(PROFILE.mbti)}</span></div>` : ''}
            ${PROFILE.ageStatus ? `<div class="info-badge" id="pvAgeBadge"><span class="info-badge-label">AGE</span><span class="info-badge-value">${escapeHtml(localizedField(PROFILE, 'ageStatus'))}</span></div>` : ''}
            ${PROFILE.gameName ? `<div class="info-badge" id="pvGameNameBadge"><span class="info-badge-label">GAME</span><span class="info-badge-value">${escapeHtml(PROFILE.gameName)}</span></div>` : ''}
          </div>
          <p class="bio">${escapeHtml(localizedField(PROFILE, 'bio'))}</p>

          ${PROFILE.extraInfo ? `
          <details class="more-info" id="pvMoreInfo">
            <summary class="more-info-summary">${escapeHtml(t('興味を持ってくれた方へ', 'For those curious to know more'))}</summary>
            <p class="more-info-content">${escapeHtml(localizedField(PROFILE, 'extraInfo'))}</p>
          </details>` : ''}
        </div>

        <hr class="divider" />

        <section>
          <h2 class="section-label">Links</h2>
          <div class="links" id="pvLinksContainer">${renderLinksHtml()}</div>
        </section>
      </main>

      <p class="footnote" style="margin-top:6px;">${escapeHtml(t('このサイトはSky 星を紡ぐ子どもたちの非公式ファンサイトです。thatgamecompanyは一切関与していません。', 'This site is an unofficial fan site for Sky: Children of the Light. thatgamecompany is not involved in any way.'))}</p>
        <p class="footnote">${escapeHtml('// ' + footnoteText)}</p>
        <p class="footnote" style="margin-top:6px;"><a href="#/tai-info" class="pv-footnote-link">${escapeHtml(t('設定・クレジット・プライバシーポリシー', 'Settings, Credits & Privacy Policy'))}</a></p>
    </div>
    <div class="pv-toast" id="pvToast" role="status" aria-live="polite"></div>
    </div>
  `;
}

// 🩹 LINKS配列のうち姉妹ツールの11件は、以前は常に外部URL+target="_blank"で
// 開いていたが、tools-drawer.js/tai-info-view.jsと同じくtai-hub内蔵済みの
// ツールは内部ルートへ遷移するのが site全体の規約になったため、hubRouteが
// 設定されている項目（profile-data.js参照）はSPA内遷移に切り替えた。
// X(Twitter)・お題箱の2件はhubRouteを持たないため、従来通り外部リンクのまま。
function renderLinksHtml() {
  return LINKS.map(link => {
    const titleHtml = link.badgeTest ? `<span class="tool-badge-test">test</span>${escapeHtml(localizedField(link, 'title'))}` : escapeHtml(localizedField(link, 'title'));
    const attrs = link.hubRoute
      ? `href="${link.hubRoute}" data-hub-route="${link.hubRoute}"`
      : `href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer"`;
    return `
      <a class="link-row" ${attrs}>
        <span class="link-icon" aria-hidden="true">${link.icon || '<svg class="inline-icon" width="20" height="20"><use href="#pv-i-link"/></svg>'}</span>
        <span class="link-text">
          <span class="link-title">${titleHtml}</span>
          <span class="link-desc">${escapeHtml(localizedField(link, 'description'))}</span>
        </span>
        <span class="link-arrow" aria-hidden="true">-&gt;</span>
      </a>`;
  }).join('');
}

function cacheEls() {
  const q = id => containerEl.querySelector('#' + id);
  els = {
    avatarWrap: q('pvAvatarWrap'),
    avatar: q('pvAvatar'),
    shardBadge: q('pvShardBadge'),
    shardDot: q('pvShardDot'),
    shardRealmText: q('pvShardRealmText'),
    copyLinkBtn: q('pvCopyLinkBtn'),
    openDashBtn: q('pvOpenDashBtn'),
    toast: q('pvToast'),
  };
}

function wireEvents() {
  setupAvatarEasterEgg();

  els.shardBadge.addEventListener('click', ev => {
    ev.stopPropagation();
    els.shardBadge.classList.toggle('tap-open');
  });
  els.shardBadge.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      ev.stopPropagation();
      els.shardBadge.classList.toggle('tap-open');
    }
  });

  els.copyLinkBtn.addEventListener('click', copyProfileLink);
  els.openDashBtn.addEventListener('click', openDashboardModal);

  // hubRoute付きのLinksエントリ（tai-hub内蔵済みの姉妹ツール）はSPA内遷移に
  // する（tai-info-view.js/tools-drawer.jsと同じ方式。通常の<a href>による
  // フルリロードを避ける）
  containerEl.addEventListener('click', (e) => {
    const hubLinkEl = e.target.closest('[data-hub-route]');
    if (hubLinkEl) {
      e.preventDefault();
      navigate(hubLinkEl.dataset.hubRoute.replace(/^#\//, ''), '');
    }
  });
}

/* ================================================================
   ✨ アバターのイースターエッグ（タップでシャボン玉が弾ける＋弾む演出）
   ================================================================ */
function burstParticles(x, y, count) {
  if (prefersReducedMotion) return;
  for (let i = 0; i < (count || 6); i++) {
    const p = document.createElement('span');
    p.className = 'pv-particle';
    const size = 8 + Math.random() * 10;
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    p.style.setProperty('--dx', ((Math.random() - 0.5) * 90) + 'px');
    document.body.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  }
}
function setupAvatarEasterEgg() {
  function trigger() {
    const rect = els.avatarWrap.getBoundingClientRect();
    burstParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, 8);
    els.avatar.classList.remove('boing');
    void els.avatar.offsetWidth; // アニメーションを再生し直すためのリフロー
    els.avatar.classList.add('boing');
  }
  els.avatarWrap.addEventListener('click', trigger);
  els.avatarWrap.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); trigger(); }
  });
  els.avatar.addEventListener('animationend', () => els.avatar.classList.remove('boing'));
}

/* ================================================================
   🔺 闇の破片バッジの表示更新
   ================================================================ */
function fmtSkyRemain(ms) {
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return t('あと{n}日', '{n}d').replace('{n}', days);
  const h = Math.floor(ms / 3600000);
  if (h >= 1) return t('あと{n}時間', '{n}h').replace('{n}', h);
  const mi = Math.floor(ms / 60000);
  if (mi >= 1) return t('あと{n}分', '{n}m').replace('{n}', mi);
  return t('あと{n}秒', '{n}s').replace('{n}', Math.max(0, Math.floor(ms / 1000)));
}
function renderShardBadge() {
  if (!els.shardBadge) return;
  const status = findShardStatus();
  if (!status) { els.shardBadge.style.display = 'none'; return; }

  const now = new Date();
  const place = CURRENT_LANG === 'en' ? (status.placeEn || status.place) : status.place;

  // 開催中でなければ、日本時間の「今日」の範囲内に開始するものだけを対象にする
  if (!status.active) {
    const toParts = d => new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    if (toParts(now) !== toParts(status.start)) {
      els.shardDot.className = 'shard-dot';
      els.shardRealmText.textContent = t('なし', 'None');
      els.shardBadge.classList.add('upcoming');
      els.shardBadge.title = t('本日（日本時間）はこの後、闇の破片の出現予定はありません', 'No more Shard Eruptions are expected today (Japan time).');
      els.shardBadge.style.display = '';
      return;
    }
  }

  const colorName = status.color === 'red' ? t('赤い破片', 'Red Shard') : t('黒い破片', 'Black Shard');
  const remain = fmtSkyRemain(status.active ? (status.end - now) : (status.start - now));

  els.shardDot.className = `shard-dot ${status.color} ${status.active ? 'active' : ''}`;
  els.shardRealmText.textContent = place;
  els.shardBadge.classList.toggle('upcoming', !status.active);
  els.shardBadge.title = status.active
    ? tpl(t('{color}が来ています（{realm}・{place}）／終了まで{remain}', '{color} is here ({realm} · {place}) / Ends in {remain}'), { color: colorName, realm: realmName(CURRENT_LANG, SHARD_REALMS[status.realmIdx]), place, remain })
    : tpl(t('{color}が来ます（{place}）／開始まで{remain}', '{color} is coming ({place}) / Starts in {remain}'), { color: colorName, place, remain });
  els.shardBadge.style.display = '';
}

/* ================================================================
   🔔 トースト通知（リンクコピー成功時の短い確認メッセージ）
   ================================================================ */
function showToast(msg) {
  const el = els.toast;
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

/* ================================================================
   🔗 このページ自身のURLをコピーする（プロフィールをシェアしたい人向け）
   ================================================================ */
async function copyProfileLink() {
  const url = window.location.href;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      showToast(t('リンクをコピーしました！', 'Link copied!'));
      return;
    } catch (e) {
      // 下のフォールバックへ
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast(t('リンクをコピーしました！', 'Link copied!'));
  } catch (e) {
    showToast(t('コピーに失敗しました', 'Failed to copy the link'));
  }
}

/* ================================================================
   📅 ダッシュボードモーダル（features/shared/event-dashboard.js をmountする）
   ================================================================ */
function openDashboardModal() {
  document.getElementById('pvDashModalOverlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'pvDashModalOverlay';
  overlay.addEventListener('click', e => { if (e.target === overlay) closeDashboardModal(); });
  overlay.innerHTML = `
    <div class="modal-card">
      <button type="button" class="modal-close-btn" id="pvDashCloseBtn"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      <div class="modal-title">${t('今日・今週・今月', 'Today / This Week / This Month')}</div>
      <div id="pvDashBody"></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#pvDashCloseBtn').addEventListener('click', closeDashboardModal);
  eventDashboard.mount(overlay.querySelector('#pvDashBody'));
  requestAnimationFrame(() => overlay.classList.add('open'));
}
function closeDashboardModal() {
  document.getElementById('pvDashModalOverlay')?.classList.remove('open');
  eventDashboard.unmount();
}

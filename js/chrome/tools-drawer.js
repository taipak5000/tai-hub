/* ================================================================
   「他のツール」引き出し。一覧は全サイト共通の site-links.json
   （js/site-links.js）から取得して描画する。ハブ内にあるツールは#/ハッシュ
   リンク（SPA内遷移）、無いものは外部URL。現在開いているツールの強調表示は無い。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../i18n.js';
import { navigate } from '../router.js';
import { initSiteLinks, refreshSiteLinks, getSiteLinks, siteLinkHref, siteLinkName } from '../site-links.js';
import { refreshToLatest } from '../refresh.js';

let siteLinksStarted = false;

function t(ja, en) { return CURRENT_LANG === 'en' ? en : ja; }

function ensureDom() {
  if (document.getElementById('toolsDrawerPanel')) return;
  const overlay = document.createElement('div');
  overlay.className = 'pf-drawer-overlay';
  overlay.id = 'toolsDrawerOverlay';
  overlay.addEventListener('click', close);
  document.body.appendChild(overlay);

  const drawer = document.createElement('aside');
  drawer.className = 'pf-drawer';
  drawer.id = 'toolsDrawerPanel';
  drawer.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <div class="pf-drawer-label"><svg class="inline-icon" width="20" height="20"><use href="#i-menu"/></svg> ${t('関連ツール', 'Related Tools')}</div>
      <button type="button" class="modal-close-btn" id="toolsDrawerCloseBtn" style="position:static;"><svg class="inline-icon" width="14" height="14"><use href="#i-close"/></svg></button>
    </div>
    <div class="pf-drawer-nav js-tools-nav"></div>`;
  document.body.appendChild(drawer);
  document.getElementById('toolsDrawerCloseBtn').addEventListener('click', close);
  renderNav();
}

// 起動時に1回だけ呼ぶ（site-dock.jsのrender()から）。キャッシュ済みの一覧を読み込み、
// 裏で最新を取得して端末に保存する（引き出しを開いていれば描画し直す）。
export function init() {
  if (siteLinksStarted) return;
  siteLinksStarted = true;
  initSiteLinks();
  refreshSiteLinks().then(changed => { if (changed) renderNav(); }).catch(() => renderNav());
}

// 一覧の描画先は .js-tools-nav すべて（引き出し＋ワイド画面の左サイドパネル）
export function renderNav() {
  document.querySelectorAll('.js-tools-nav').forEach(renderNavInto);
}

function linkHtml(s) {
  const { href, hubRoute } = siteLinkHref(s);
  return `<a class="pf-drawer-link${s.child ? ' is-child' : ''}" href="${href}" data-hub-route="${hubRoute}">
      <svg class="inline-icon" width="19" height="19"><use href="#${s.icon}"/></svg>
      ${s.badgeTest ? `<span class="pf-drawer-badge-test">${t('test', 'test')}</span>` : ''} ${escapeHtml(siteLinkName(s, CURRENT_LANG))}
    </a>`;
}

// 🧪 test印のツールは一覧の最後にまとめ、見出しを押すと折りたためる（引き出しと左パネルで共通の設定。端末ごと）
const TEST_COLLAPSED_KEY = 'sky_tools_test_collapsed';
function testCollapsed() { try { return localStorage.getItem(TEST_COLLAPSED_KEY) === '1'; } catch (e) { return false; } }
function testGroupHtml(list) {
  if (!list.length) return '';
  const collapsed = testCollapsed();
  return `<div class="pf-drawer-test${collapsed ? ' is-collapsed' : ''}">
      <button type="button" class="pf-drawer-test-toggle js-test-toggle" aria-expanded="${!collapsed}">
        <span>${t('テスト中のツール', 'Tools in testing')}</span><span class="pf-drawer-test-count">${list.length}</span>
        <svg class="inline-icon pf-drawer-test-chev" width="15" height="15" aria-hidden="true"><use href="#i-chevron-down"/></svg>
      </button>
      <div class="pf-drawer-test-list">${list.map(linkHtml).join('')}</div>
    </div>`;
}

function renderNavInto(nav) {
  const links = getSiteLinks();
  if (!links) {
    nav.innerHTML = `<p style="font-size:12px;color:var(--hub-text-2);padding:4px 12px;">${t('ツール一覧を読み込めませんでした', 'Could not load the tool list')}</p>`;
    return;
  }
  nav.innerHTML = `
    <button type="button" class="hub-search-open js-hub-search">
      <svg class="inline-icon" width="17" height="17"><use href="#i-search"/></svg><span>${t('まとめてさがす', 'Search everything')}</span>
    </button>` + links.filter(s => !s.badgeTest || s.child).map(linkHtml).join('') + testGroupHtml(links.filter(s => s.badgeTest && !s.child)) + `
    <div class="hub-refresh">
      <button type="button" class="hub-refresh-btn js-hub-refresh">
        <svg class="inline-icon" width="17" height="17"><use href="#i-sync"/></svg> ${t('最新の状態に更新', 'Update to the latest version')}
      </button>
      <p class="hub-refresh-hint">${t('画面が古いままのときに押してください。保存したデータは消えません。', 'Tap this if the page looks out of date. Your saved data is kept.')}</p>
    </div>`;
  nav.querySelector('.js-test-toggle')?.addEventListener('click', () => {
    const next = !testCollapsed();
    try { localStorage.setItem(TEST_COLLAPSED_KEY, next ? '1' : '0'); } catch (e) { /* noop */ }
    // 引き出しと左パネルの両方へ同じ状態を反映する（描き直さずにクラスだけ切り替える）
    document.querySelectorAll('.pf-drawer-test').forEach(g => {
      g.classList.toggle('is-collapsed', next);
      g.querySelector('.js-test-toggle')?.setAttribute('aria-expanded', String(!next));
    });
  });
  nav.querySelector('.js-hub-search').addEventListener('click', () => {
    close();
    import('./search-modal.js').then(m => m.open());
  });
  nav.querySelector('.js-hub-refresh').addEventListener('click', e => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.lastChild.textContent = ` ${t('更新しています…', 'Updating…')}`;
    refreshToLatest();
  });
  nav.querySelectorAll('a[data-hub-route]').forEach(a => {
    const route = a.dataset.hubRoute;
    if (!route) return;
    a.addEventListener('click', e => {
      e.preventDefault();
      navigate(route.replace(/^#\//, ''), '');
      close();
    });
  });
}

export function open() {
  ensureDom();
  document.getElementById('toolsDrawerOverlay').classList.add('show');
  document.getElementById('toolsDrawerPanel').classList.add('mobile-open');
}

export function close() {
  document.getElementById('toolsDrawerOverlay')?.classList.remove('show');
  document.getElementById('toolsDrawerPanel')?.classList.remove('mobile-open');
}

/* ================================================================
   tai-info-view.js — 設定・クレジット（tai-hub移植版）

   移植元: C:\Users\user\Downloads\skyツール\tai-info\index.html
   のうち、4つのページ内タブ（設定について/クレジット/
   プライバシーポリシー/参考文献・画像引用元）の中身。
   REFERENCE_SOURCESは data/ 以下に、UI文言は data/i18n-info.js に
   分離している。

   ── tai-hubへの移植で意図的に省略・変更した点 ──
   1. ナビバーのEN切替ボタン・ハンバーガーサイドバー（関連ツール）・
      画面下部ドック（クレジット/他のツール/表示設定）・
      表示設定モーダル（テーマ/ショートカット/言語/データ管理）は、
      tai-hubの共有chrome（js/chrome/*.js）が既に同等以上の機能を
      持つため移植していない（他の全ポート済みツールと同じ方針）。
   2. 「ホーム画面アイコンをカスタマイズ」モーダル（iconCustomModal）は
      「このツールを単独PWAとして追加した場合の、そのアプリ自身の
      アイコン」を変える機能で、複数ツールが1つのハブに同居する
      tai-hubではそもそも概念が成立しない。emote-view.jsが同じ理由で
      同機能を省略しているのと同じ判断で、この「設定について」タブの
      該当カードもボタンを外し説明文のみ残した（他サイトの説明としては
      引き続き正しい内容のため文章自体は残す）。
   3. 「参考文献・画像引用元」タブの目的別ツール早見表・サイト別機能
      対応表の各リンクは、tai-hubに移植済みの5ツール
      （item/emote/share/tai-nomacan/star-candle）についてのみ
      外部URLではなくハブ内ルート（#/item 等、router.navigate()経由の
      SPA内遷移）に差し替えている。他の既存ポート（tools-drawer.js）と
      同じ判断で、掲載内容・順序・文言はすべて原文のまま。
   4. 原文のtai-infoが2026年9月、「更新情報」（changelog）機能を
      廃止し「設定・クレジット」に改名したため、本移植でも同様に
      更新情報タブ・未読インジケーター・ツール自動検出による強調表示
      （CHANGELOG/TOOL_USAGE_SIGNS関連一式）を削除し、ラベルを
      「設定・クレジット」に追従させた。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { navigate } from '../../js/router.js';
import { t } from './data/i18n-info.js';
import { REFERENCE_SOURCES } from './data/references.js';

function tt(ja, en) { return CURRENT_LANG === 'en' ? en : ja; }

const STYLE_LINK_ID = 'tai-info-view-styles';
const ICON_SPRITE_ID = 'tai-info-icon-sprite';
const TABS = ['settings', 'credits', 'privacy', 'references'];

// 🔑 tai-hub内での全14ツールのハブ内ルート（共通ツール一覧 site-links.json の
// id と同じ #/<id>。js/site-links.js 参照）。この表は目的別早見表・機能対応表の
// リンク用に、このファイル内に同じ値を直接持つ。
// 🩹 以前はitem/emote/share/nomacan/starCandleの5件だけがこのマップに入っており、
// 残り9件（wings/companion/spirit-catalog/tai-revisit/tai-score/tai-card/
// data-transfer/tai-info自身/profile）はhrefで外部github.ioへ直接リンクして
// いたが、それらも9ツール移植バッチで全てtai-hub内蔵済みになったため、
// 外部リンクのまま放置するとタップした瞬間にSPAを離脱してしまっていた
// （tools-drawer.jsは既に全14件を内部ルート化済みで、この不整合だけが
// 残っていた）。全14ツール分を揃え、下のTOOL_GUIDE_ITEMS/COMPAT_TABLE_ROWS
// 側もhref→routeへ切り替えた。
const HUB_ROUTE = {
  item: '#/item',
  emote: '#/emote',
  share: '#/share',
  nomacan: '#/tai-nomacan',
  starCandle: '#/star-candle',
  wings: '#/wings',
  companion: '#/companion',
  spiritCatalog: '#/spirit-catalog',
  taiRevisit: '#/tai-revisit',
  taiScore: '#/tai-score',
  taiCard: '#/tai-card',
  dataTransfer: '#/data-transfer',
  taiInfo: '#/tai-info',
  profile: '#/profile',
};

let containerEl = null;
let els = {};

/* ================================================================
   公開API
   ================================================================ */
export function mount(container, sub) {
  injectStylesheet();
  injectLocalIconSprite();

  containerEl = container;

  container.innerHTML = renderShell();
  cacheEls();
  wireEvents();

  renderReferences();

  const [initialTab, initialAnchor] = (sub || '').split(':');
  showTab(TABS.includes(initialTab) ? initialTab : TABS[0], initialAnchor);
}

export function unmount() {
  containerEl = null;
  els = {};
}

/* ================================================================
   スタイルシート・追加アイコンスプライトの注入（初回のみ）
   ================================================================ */
function injectStylesheet() {
  if (document.getElementById(STYLE_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_LINK_ID;
  link.rel = 'stylesheet';
  link.href = new URL('../../css/tai-info.css', import.meta.url).href;
  document.head.appendChild(link);
}
// tai-hub共有の#pf-icon-sprite（js/icon-sprite.js）に無いのはi-globeだけ
// （他はすべて既存共有アイコンで足りる）。衝突しない専用プレフィックス
// （ti-i-*）で1個だけ自前スプライトを持つ（共有ファイルは編集しない）。
const TAI_INFO_SPRITE_HTML = `<svg id="${ICON_SPRITE_ID}" style="position:absolute;width:0;height:0;overflow:hidden;" aria-hidden="true"><defs>
<symbol id="ti-i-globe" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.094) translate(-12 -12)"><path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"/><path d="M4.5 9h15M4.5 15h15"/><path d="M12 4a12 12 0 0 1 0 16"/><path d="M12 4a12 12 0 0 0 0 16"/></g></symbol>
</defs></svg>`;
function injectLocalIconSprite() {
  if (document.getElementById(ICON_SPRITE_ID)) return;
  document.body.insertAdjacentHTML('afterbegin', TAI_INFO_SPRITE_HTML);
}

/* ================================================================
   マークアップ（外枠）
   ================================================================ */
function renderShell() {
  return `
    <div class="tai-info-view">
      <div class="ti-layout">
        <header class="tool-nav-head">
          <h1><svg class="inline-icon" width="19" height="19"><use href="#i-settings"/></svg> ${escapeHtml(tt('設定・クレジット', 'Settings & Credits'))}</h1>
        </header>

        <div class="page-tabs" id="tiPageTabs" role="tablist">
          <button class="page-tab" id="ti-tab-settings" data-tab="settings" role="tab" aria-selected="false">${escapeHtml(t('tabs.settings'))}</button>
          <button class="page-tab" id="ti-tab-credits" data-tab="credits" role="tab" aria-selected="false">${escapeHtml(t('tabs.credits'))}</button>
          <button class="page-tab" id="ti-tab-privacy" data-tab="privacy" role="tab" aria-selected="false">${escapeHtml(t('tabs.privacy'))}</button>
          <button class="page-tab" id="ti-tab-references" data-tab="references" role="tab" aria-selected="false">${escapeHtml(t('tabs.references'))}</button>
        </div>

        <section data-tab="settings" id="ti-panel-settings" role="tabpanel" tabindex="0">
          <p class="sec-label">${escapeHtml(t('settings.label'))}</p>
          <p class="sec-sub">${escapeHtml(t('settings.sub'))}</p>

          <div class="card" id="settings-profile" tabindex="-1">
            <h3>${escapeHtml(t('settings.profile.title'))}</h3>
            <p>${t('settings.profile.body')}</p>
          </div>
          <div class="card" id="settings-currency" tabindex="-1">
            <h3>${escapeHtml(t('settings.currency.title'))}</h3>
            <p>${t('settings.currency.body')}</p>
          </div>
          <div class="card" id="settings-backup" tabindex="-1">
            <h3>${escapeHtml(t('settings.backup.title'))}</h3>
            <p>${t('settings.backup.body')}</p>
          </div>
          <div class="card" id="settings-lang" tabindex="-1">
            <h3>${escapeHtml(t('settings.lang.title'))}</h3>
            <p>${t('settings.lang.body')}</p>
          </div>
          <div class="card" id="settings-icon" tabindex="-1">
            <h3>${escapeHtml(t('settings.icon.title'))}</h3>
            <p>${t('settings.icon.body')}</p>
          </div>
        </section>

        <section data-tab="credits" id="ti-panel-credits" role="tabpanel" tabindex="0">
          <p class="sec-label">${escapeHtml(t('credits.label'))}</p>
          <div class="card" id="credits-made" tabindex="-1">
            <h3>${escapeHtml(t('credits.made.title'))}</h3>
            <p>${t('credits.made.body')}</p>
          </div>
          <div class="card" id="credits-dataSource" tabindex="-1">
            <h3>${escapeHtml(t('credits.dataSource.title'))}</h3>
            <ul>${t('credits.dataSource.list')}</ul>
            <p style="margin-top:8px;">${t('credits.dataSource.note')}</p>
          </div>
          <div class="card" id="credits-libs" tabindex="-1">
            <h3>${escapeHtml(t('credits.libs.title'))}</h3>
            <ul>${t('credits.libs.list')}</ul>
          </div>
          <div class="card" id="credits-disclaimer" tabindex="-1">
            <h3>${escapeHtml(t('credits.disclaimer.title'))}</h3>
            <p>${t('credits.disclaimer.body')}</p>
          </div>
          <div class="card" id="credits-policy" tabindex="-1">
            <h3>${escapeHtml(t('credits.policy.title'))}</h3>
            <p>${t('credits.policy.intro')}</p>
            <ul style="margin-top:8px;">${t('credits.policy.list')}</ul>
            <p style="margin-top:8px; color:var(--text-2); font-size:11.5px;">${t('credits.policy.footnote')}</p>
          </div>
        </section>

        <section data-tab="privacy" id="ti-panel-privacy" role="tabpanel" tabindex="0">
          <p class="sec-label">${escapeHtml(t('privacy.label'))}</p>
          <div class="card" id="privacy-summary" tabindex="-1" style="background:var(--indigo-bg); box-shadow:none;">
            <h3>${escapeHtml(t('privacy.summary.title'))}</h3>
            <p>${t('privacy.summary.body')}</p>
          </div>
          <div class="card" id="privacy-storage" tabindex="-1">
            <h3>${escapeHtml(t('privacy.storage.title'))}</h3>
            <p>${t('privacy.storage.p1')}</p>
            <p style="margin-top:8px;">${t('privacy.storage.p2')}</p>
            <p style="margin-top:8px;">${t('privacy.storage.p3')}</p>
          </div>
          <div class="card" id="privacy-account" tabindex="-1">
            <h3>${escapeHtml(t('privacy.account.title'))}</h3>
            <p>${t('privacy.account.body')}</p>
          </div>
          <div class="card" id="privacy-analytics" tabindex="-1">
            <h3>${escapeHtml(t('privacy.analytics.title'))}</h3>
            <p>${t('privacy.analytics.body')}</p>
          </div>
          <div class="card" id="privacy-network" tabindex="-1">
            <h3>${escapeHtml(t('privacy.network.title'))}</h3>
            <p>${t('privacy.network.intro')}</p>
            <ul>${t('privacy.network.list')}</ul>
          </div>
          <div class="card" id="privacy-transfer" tabindex="-1">
            <h3>${escapeHtml(t('privacy.transfer.title'))}</h3>
            <p>${t('privacy.transfer.p1')}</p>
            <p style="margin-top:8px;">${t('privacy.transfer.p2')}</p>
          </div>
          <div class="card" id="privacy-contact" tabindex="-1">
            <h3>${escapeHtml(t('privacy.contact.title'))}</h3>
            <p>${t('privacy.contact.body')}</p>
          </div>
        </section>

        <section data-tab="references" id="ti-panel-references" role="tabpanel" tabindex="0">
          <p class="sec-label">${escapeHtml(t('references.label'))}</p>
          <p class="sec-sub">${escapeHtml(t('references.sub'))}</p>

          <div class="card" id="references-toolGuide" tabindex="-1">
            <h3>${escapeHtml(t('references.toolGuide.title'))}</h3>
            <p style="margin-bottom:8px;">${escapeHtml(t('references.toolGuide.sub'))}</p>
            <ul>${renderToolGuideList()}</ul>
          </div>

          <div class="card" id="references-compatTable" tabindex="-1">
            <h3>${escapeHtml(t('references.compatTable.title'))}</h3>
            <p style="margin-bottom:10px;">${escapeHtml(t('references.compatTable.sub'))}</p>
            <div class="compat-table-wrap">
              <table class="compat-table">
                <thead>
                  <tr>
                    <th>${escapeHtml(t('references.compatTable.colTool'))}</th>
                    <th><svg class="inline-icon" width="14" height="14"><use href="#i-moon"/></svg> ${escapeHtml(t('references.compatTable.colDark'))}</th>
                    <th><svg class="inline-icon" width="14" height="14"><use href="#i-person"/></svg> ${escapeHtml(t('references.compatTable.colProfile'))}</th>
                    <th><svg class="inline-icon" width="14" height="14"><use href="#ti-i-globe"/></svg> ${escapeHtml(t('references.compatTable.colLang'))}</th>
                    <th>${escapeHtml(t('references.compatTable.colTest'))}</th>
                  </tr>
                </thead>
                <tbody>${renderCompatTableRows()}</tbody>
              </table>
            </div>
            <p style="margin-top:8px; color:var(--text-2); font-size:11.5px;">${t('references.compatTable.footnote')}</p>
          </div>

          <div class="ref-quickjump" id="tiRefQuickJump" aria-label="${escapeHtml(t('references.quickJumpAriaLabel'))}"></div>
          <div class="card" id="tiRefCard"></div>
        </section>

        <footer class="ti-footer">
          <span>${escapeHtml(tt('このサイトはSky 星を紡ぐ子どもたちの非公式ファンサイトです。thatgamecompanyは一切関与していません。', 'This is an unofficial fan site for Sky: Children of the Light. thatgamecompany is not involved in any way.'))}</span>
        </footer>
      </div>
    </div>
  `;
}

/* ================================================================
   目的別ツール早見表 / サイト別機能対応表
   （原文: tai-info/index.html #references-toolGuide / #references-compatTable。
   掲載内容・順序・文言は原文のまま、5ツール分のリンク先だけをtai-hubの
   ハブ内ルートに差し替えている）
   ================================================================ */
const TOOL_GUIDE_ITEMS = [
  { icon: 'i-candle', textJa: 'キャンドルを計算したい（目標本数・あと何日で貯まるか等）', textEn: 'Want to calculate candles (target amount, days until you have enough, etc.)',
    links: [
      { ja: 'ノマキャン計算機', en: 'Nomacan Calculator', route: HUB_ROUTE.nomacan },
      { ja: '星のキャンドル計算機', en: 'Star Candle Calculator', route: HUB_ROUTE.starCandle },
    ] },
  { icon: 'i-wing', textJa: '翼・光の子（ウィングバフ）を集めたい', textEn: 'Want to collect wings (Wing Buff) from Children of Light',
    links: [{ ja: '羽トラッカー', en: 'Wing Tracker', route: HUB_ROUTE.wings }] },
  { icon: 'i-folder', textJa: 'アイテムの所持状況を管理したい', textEn: 'Want to track which items you own',
    links: [{ ja: 'アイテム所持管理', en: 'Item Tracker', route: HUB_ROUTE.item }] },
  { icon: 'i-masks', textJa: 'エモートの所持状況を管理したい', textEn: 'Want to track which emotes you own',
    links: [{ ja: 'エモート所持率管理', en: 'Emote Tracker', route: HUB_ROUTE.emote }] },
  { icon: 'i-sparkle', textJa: '精霊と一緒に過ごしたい・精霊友情やシーズンツリーを進めたい', textEn: 'Want to hang out with a spirit companion, or progress friendship/season trees',
    links: [{ ja: '精霊同行ツール', en: 'Spirit Companion Tool', route: HUB_ROUTE.companion }] },
  { icon: 'i-pin', textJa: '自分のコーデ・創作物を紹介したい', textEn: 'Want to showcase your outfits or creations',
    links: [{ ja: '創作物管理ツール', en: 'Creation Manager', route: HUB_ROUTE.share }] },
  { icon: 'i-music-note', textJa: '楽譜を演奏・作成したい', textEn: 'Want to play or create sheet music',
    links: [{ ja: '楽譜づくり', en: 'Sheet Music Maker', route: HUB_ROUTE.taiScore, badgeTest: true }] },
  { icon: 'i-sync', textJa: '別の端末にデータを引き継ぎたい', textEn: 'Want to move your data to another device',
    links: [{ ja: 'データ引継ぎ', en: 'Data Transfer', route: HUB_ROUTE.dataTransfer }] },
  { icon: 'i-settings', textJa: '使い方や共通設定について知りたい', textEn: 'Want to learn how things work or find shared settings',
    links: [{ ja: '設定について', en: 'About Settings', tabSwitch: 'settings' }], suffixJa: 'タブ', suffixEn: ' tab' },
  { icon: 'i-person', textJa: '制作者について知りたい・リクエストを送りたい', textEn: 'Want to learn about the creator or send a request',
    links: [{ ja: '作者プロフィール', en: 'Creator Profile', route: HUB_ROUTE.profile }] },
];

function renderLink(link) {
  const label = escapeHtml(CURRENT_LANG === 'en' ? link.en : link.ja);
  const badge = link.badgeTest ? `<span class="tool-badge-test">${escapeHtml(tt('test', 'test'))}</span> ` : '';
  if (link.tabSwitch) {
    return `${badge}<a href="javascript:void(0)" data-tab-switch="${link.tabSwitch}">${label}</a>`;
  }
  if (link.route) {
    return `${badge}<a href="${link.route}" data-hub-route="${link.route}">${label}</a>`;
  }
  return `${badge}<a href="${link.href}">${label}</a>`;
}

function renderToolGuideList() {
  return TOOL_GUIDE_ITEMS.map(item => {
    const text = escapeHtml(CURRENT_LANG === 'en' ? item.textEn : item.textJa);
    const linksHtml = item.links.map(renderLink).join('・');
    const suffix = item.suffixJa ? escapeHtml(CURRENT_LANG === 'en' ? (item.suffixEn || '') : item.suffixJa) : '';
    return `<li><svg class="inline-icon" width="15" height="15"><use href="#${item.icon}"/></svg> <b>${text}</b> → ${linksHtml}${suffix}</li>`;
  }).join('');
}

const COMPAT_TABLE_ROWS = [
  { icon: 'i-folder', ja: 'アイテム所持管理', en: 'Item Tracker', route: HUB_ROUTE.item, profile: true, lang: 2 },
  { icon: 'i-masks', ja: 'エモート所持率管理', en: 'Emote Tracker', route: HUB_ROUTE.emote, profile: true, lang: 2 },
  { icon: 'i-pin', ja: '創作物管理ツール', en: 'Creation Manager', route: HUB_ROUTE.share, profile: true, lang: 2 },
  { icon: 'i-candle', ja: 'ノマキャン計算機', en: 'Nomacan Calculator', route: HUB_ROUTE.nomacan, profile: true, lang: 2 },
  { icon: 'i-star-candle', ja: '星のキャンドル計算機', en: 'Star Candle Calculator', route: HUB_ROUTE.starCandle, profile: true, lang: 2 },
  { icon: 'i-sparkle', ja: '精霊同行ツール', en: 'Spirit Companion Tool', route: HUB_ROUTE.companion, profile: true, lang: 4 },
  { icon: 'i-wing', ja: '羽トラッカー', en: 'Wing Tracker', route: HUB_ROUTE.wings, profile: true, lang: 2 },
  { icon: 'i-sync', ja: 'データ引継ぎ', en: 'Data Transfer', route: HUB_ROUTE.dataTransfer, profile: true, lang: 2 },
  { icon: 'i-settings', ja: '設定・クレジット', en: 'Settings & Credits', tabSwitch: 'settings', profile: false, lang: 2 },
  { icon: 'i-music-note', ja: '楽譜づくり', en: 'Sheet Music Maker', route: HUB_ROUTE.taiScore, profile: false, lang: 2, badgeTest: true },
  { icon: 'i-person', ja: '作者プロフィール', en: 'Creator Profile', route: HUB_ROUTE.profile, profile: false, lang: 2 },
];

function renderCompatTableRows() {
  const okIcon = `<svg class="inline-icon ok" width="14" height="14"><use href="#i-check"/></svg>`;
  return COMPAT_TABLE_ROWS.map(row => {
    const label = escapeHtml(CURRENT_LANG === 'en' ? row.en : row.ja);
    const linkHtml = row.tabSwitch
      ? `<a href="javascript:void(0)" data-tab-switch="${row.tabSwitch}"><svg class="inline-icon" width="19" height="19"><use href="#${row.icon}"/></svg> ${label}</a>`
      : row.route
        ? `<a href="${row.route}" data-hub-route="${row.route}"><svg class="inline-icon" width="19" height="19"><use href="#${row.icon}"/></svg> ${label}</a>`
        : `<a href="${row.href}"><svg class="inline-icon" width="19" height="19"><use href="#${row.icon}"/></svg> ${label}</a>`;
    return `<tr>
      <td>${linkHtml}</td>
      <td>${okIcon}</td>
      <td>${row.profile ? okIcon : '—'}</td>
      <td>${row.lang}</td>
      <td>${row.badgeTest ? `<span class="tool-badge-test">${escapeHtml(tt('test', 'test'))}</span>` : '—'}</td>
    </tr>`;
  }).join('');
}

/* ================================================================
   要素キャッシュ・イベント配線
   ================================================================ */
function cacheEls() {
  const q = (id) => containerEl.querySelector('#' + id);
  els = {
    pageTabs: q('tiPageTabs'),
    refQuickJump: q('tiRefQuickJump'),
    refCard: q('tiRefCard'),
  };
}

function wireEvents() {
  els.pageTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.page-tab');
    if (btn) showTab(btn.dataset.tab);
  });
  els.pageTabs.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const btn = e.target.closest('.page-tab');
    if (!btn) return;
    e.preventDefault();
    const idx = TABS.indexOf(btn.dataset.tab);
    let nextIdx = idx;
    if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + TABS.length) % TABS.length;
    else if (e.key === 'ArrowRight') nextIdx = (idx + 1) % TABS.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = TABS.length - 1;
    const nextTab = TABS[nextIdx];
    showTab(nextTab);
    containerEl.querySelector(`.page-tab[data-tab="${nextTab}"]`)?.focus();
  });

  // 目的別ツール早見表・サイト別機能対応表・目的別ツール早見表内の「設定について」
  // 自己リンクは、ハブ内ルートへの遷移（router.navigate）またはタブ切替に委譲する
  // （通常の<a href>によるフルリロードを避ける。tools-drawer.jsと同じ方式）。
  containerEl.addEventListener('click', (e) => {
    const tabSwitchEl = e.target.closest('[data-tab-switch]');
    if (tabSwitchEl) { e.preventDefault(); showTab(tabSwitchEl.dataset.tabSwitch); return; }
    const hubLinkEl = e.target.closest('[data-hub-route]');
    if (hubLinkEl) {
      e.preventDefault();
      navigate(hubLinkEl.dataset.hubRoute.replace(/^#\//, ''), '');
    }
  });
}

/* ================================================================
   タブ切替・ディープリンク（原文の showTab()/applyHashRoute() 相当）
   ================================================================ */
function showTab(tab, anchor) {
  if (!TABS.includes(tab)) tab = TABS[0];
  containerEl.querySelectorAll('section[data-tab]').forEach(s => s.classList.toggle('show', s.dataset.tab === tab));
  containerEl.querySelectorAll('.page-tab').forEach(b => {
    const isActive = b.dataset.tab === tab;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-selected', isActive ? 'true' : 'false');
    b.tabIndex = isActive ? 0 : -1;
  });
  // 🔗 原文はhistory.replaceState()でURLのハッシュだけを書き換え、hashchangeを
  // 発火させずにルーターの再マウントを避けていた。tai-hubでも同じ理由で
  // router.navigate()（location.hash=、hashchangeを発火させる）ではなく
  // history.replaceState()を直接呼び、タブ切替のたびにコンテナが丸ごと
  // 再マウントされる（スクロール位置・フィルタ選択状態が失われる）のを防ぐ。
  history.replaceState(null, '', '#/tai-info/' + tab + (anchor ? ':' + anchor : ''));
  if (anchor) scrollToCardAnchor(tab, anchor);
}

function scrollToCardAnchor(tab, anchor) {
  const el = containerEl && containerEl.querySelector('#' + tab + '-' + anchor);
  if (!el) return;
  requestAnimationFrame(() => {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.remove('anchor-highlight');
    void el.offsetWidth;
    el.classList.add('anchor-highlight');
    setTimeout(() => el.classList.remove('anchor-highlight'), 1700);
    if (typeof el.focus === 'function') el.focus({ preventScroll: true });
  });
}

/* ================================================================
   参考文献・画像引用元タブ
   ================================================================ */
function renderRefQuickJump() {
  const el = els.refQuickJump;
  if (!el) return;
  el.innerHTML = REFERENCE_SOURCES.map(g => `
    <button type="button" class="ref-jump-pill" data-jump="${g.id}">${escapeHtml(CURRENT_LANG === 'en' ? (g.groupEn || g.group) : g.group)}</button>`).join('');
  el.querySelectorAll('.ref-jump-pill').forEach(btn => {
    btn.addEventListener('click', () => scrollToCardAnchor('references', btn.dataset.jump));
  });
}

function renderReferences() {
  const el = els.refCard;
  if (!el) return;
  renderRefQuickJump();
  el.innerHTML = REFERENCE_SOURCES.map(g => `
  <div class="ref-group" id="references-${g.id}" tabindex="-1">
    <div class="ref-group-label">${escapeHtml(CURRENT_LANG === 'en' ? (g.groupEn || g.group) : g.group)}</div>
    <ul class="ref-list">
      ${g.items.map(it => `
        <li class="ref-item">
          ${it.url ? `<a href="${it.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(it.title)}</a>` : `<span>${escapeHtml(it.title)}</span>`}
          ${it.note ? `<span class="ref-note">${escapeHtml(CURRENT_LANG === 'en' ? (it.noteEn || it.note) : it.note)}</span>` : ''}
        </li>`).join('')}
    </ul>
  </div>`).join('');
}

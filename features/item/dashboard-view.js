/* ================================================================
   item（アイテム所持管理）ダッシュボード（ホーム画面）。
   item/index.html のうち、カテゴリグリッド・楽譜/コスト管理への導線・
   横断アイテム検索・全体達成率＋称号パネル・ウィッシュリスト/獲得ログ・
   コーデ機能・シェア機能を移植したもの。各サブ機能自体の実装は
   features/item/配下の専用ファイルに分かれており、このファイルは
   それらをダッシュボードへ配線する役割。

   元実装はカテゴリ横断検索のために各カテゴリページ本体をfetchして
   HTMLから正規表現でITEMS_DATAを抜き出していたが（item/index.htmlの
   loadAllItemsOnce）、SPA化に伴いこの自己fetch+スクレイプは廃止し、
   各カテゴリの data/items/<catKey>.js を直接dynamic importする方式に
   置き換えている（元のCLAUDE.md方針とは無関係の、tai-hub移植時の
   意図的なアーキテクチャ改善）。横断検索自体は search-modal.js に
   分離済みのため、このファイル自身の検索インデックス構築ロジックは
   カテゴリグリッドの所持数集計にのみ使う。
   ================================================================ */
import { CURRENT_LANG, trCat, escapeHtml } from '../../js/i18n.js';
import { getCategoryState } from '../../js/state.js';
import { CATEGORY_REGISTRY } from './data/categories.js';
import * as titlesPanel from './titles-panel.js';
import * as searchModal from './search-modal.js';
import * as wishlistCostModal from './wishlist-cost-modal.js';
import * as acquireLogModal from './acquire-log-modal.js';
import * as randomCoord from './coord/random-coord.js';
import * as myCoord from './coord/my-coord.js';
import * as closetCollage from './coord/closet-collage.js';
import * as coordShare from './coord/coord-share.js';
import * as achievementShare from './share/achievement-share.js';
import * as favoritesShare from './share/favorites-share.js';

const STYLE_ID = 'item-dashboard-view-styles';

// 12種のウェアラブルカテゴリのみ（section:'special' の music_sheet は今回のダッシュボード
// 移植スコープ外——別枠の単独リンクとしてのみ扱う。categories.js からの動的取得のため、
// カテゴリが増減してもこのファイルを直接編集する必要はない）
const GRID_CATEGORIES = CATEGORY_REGISTRY.filter(c => c.section === 'grid');
const MUSIC_SHEET_CAT = CATEGORY_REGISTRY.find(c => c.key === 'music_sheet');

let hostEl = null;
let mountToken = 0; // 再マウント/アンマウント後に古い非同期処理の描画を捨てるためのトークン

// 各カテゴリの data/items/<catKey>.js は静的アイテム配列なので、一度読み込んだ
// Promiseをキャッシュして再利用する（タブを行き来するたびに読み直さない）
const itemModuleCache = new Map(); // catKey -> Promise<{ ITEMS }>
function loadCategoryItems(catKey) {
  if (!itemModuleCache.has(catKey)) {
    itemModuleCache.set(catKey, import(`./data/items/${catKey}.js`));
  }
  return itemModuleCache.get(catKey);
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .item-view .dash-wrap { max-width: 720px; margin: 0 auto; }
    @media (min-width: 850px) { .item-view .dash-wrap { max-width: 960px; } }

    /* 💡 初回訪問ヒントバナー（item/profiles.js の .pf-hint-banner を移植）。
       元実装は.pf-bar（プロフィール切替バー）の直後に出るが、tai-hubでは
       プロフィール切替バー自体がsite-dock側のモーダルに集約されているため
       （wings-view.js等の既存コメント参照）、item機能ページの先頭にそのまま
       出す。dismissフラグ（sky_first_visit_hint_shown_v1）は元サイトと
       同一オリジンのlocalStorageを共有する生のキー名のため変更しない。 */
    .item-view .pf-hint-banner {
      background: var(--card); border: 1px solid var(--blue); border-radius: var(--r-sm);
      padding: 9px 12px; font-size: 12.5px; color: var(--text-2);
      display: flex; align-items: flex-start; gap: 8px; line-height: 1.5;
    }
    .item-view .pf-hint-banner-text { flex: 1; min-width: 0; }
    .item-view .pf-hint-banner-close {
      background: none; border: 0; color: var(--text-2); cursor: pointer;
      padding: 2px; flex-shrink: 0; display: flex;
    }
    .item-view .pf-hint-banner-close:hover { color: var(--text); }

    /* ▸ はじめての方へ（紹介文カード。item/index.html の .welcome-card を移植） */
    .item-view .welcome-card {
      background: var(--card); border-radius: var(--r); padding: 18px 18px 16px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.07), 0 0.5px 1px rgba(0,0,0,0.04);
    }
    .item-view .welcome-title {
      display: flex; align-items: center; justify-content: space-between; gap: 6px;
      font-size: 14px; font-weight: 700; color: var(--text); cursor: pointer;
      background: none; border: 0; width: 100%; padding: 0; font-family: inherit; text-align: left;
    }
    .item-view .welcome-title-label { display: flex; align-items: center; gap: 6px; }
    .item-view .welcome-toggle-icon { display: flex; color: var(--text-2); transition: transform 0.15s; }
    .item-view .welcome-toggle-icon.expanded { transform: rotate(180deg); }
    .item-view .welcome-text { font-size: 13px; line-height: 1.75; color: var(--text-2); margin-top: 8px; }

    .item-view .dash-feature-row { display: flex; flex-direction: column; gap: 10px; }
  `;
  document.head.appendChild(style);
}

// 🩹 元実装（item/index.html の cardHTML()）を忠実に移植。以前は
// アイコン＋名前＋件数だけの小さな正方形タイル（.cat-tile）だったが、
// 達成率バー・chevronを含む横長カード（.cat-card、css/item.css参照）に
// 差し替えた（詳細はcss/item.cssの同箇所コメント参照）。
function catTileHtml(cat, owned, total) {
  const name = trCat(cat.name);
  const loading = owned === null || total === null;
  const p = loading ? null : (total > 0 ? Math.round(owned / total * 100) : 0);
  const high = p !== null && p >= 80;
  const pctCls = p === null ? 'empty' : (high ? 'high' : '');
  const pctText = p !== null ? `${p}<span class="num-unit">%</span>` : '--';
  const countText = loading ? '…' : `${owned} / ${total}`;
  return `
    <a class="cat-card" href="#/item/${cat.key}">
      <div class="cat-top">
        <div class="cat-icon-wrap">
          <span class="cat-icon"><img src="${cat.img}" alt="${escapeHtml(name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'"></span>
          <span class="cat-name">${escapeHtml(name)}</span>
        </div>
        <span class="cat-pct ${pctCls}">${pctText}</span>
      </div>
      <div class="cat-bar"><div class="cat-fill ${high ? 'high' : ''}" style="width:${p ?? 0}%"></div></div>
      <div class="cat-bottom">
        <span class="cat-count">${countText}</span>
        <span class="cat-chevron"><svg class="inline-icon" width="14" height="14">${CHEVRON_RIGHT_PATH}</svg></span>
      </div>
    </a>`;
}

/* ================================================================
   💡 初回訪問ヒントバナー＋はじめての方へカード
   item/profiles.js の pfRenderFirstVisitHint() / item/index.html の
   .welcome-card を移植したもの。ライブ本家では季節・イベント情報は
   メインページに常時表示せず、この2つのオンボーディング要素を先頭に
   置く構成になっているため、tai-hub側の常時表示だった season-banner を
   撤去してこちらに差し替えている（季節・イベント情報自体は本家同様、
   ダッシュボードモーダル側の役割）。

   アイコンはi-lightbulb/i-chevron-rightがtai-hub共有js/icon-sprite.js
   に無く、他パスが並行編集中の共有ファイルを増やしたくないため、
   titles-panel.jsのICON_PATHSと同じ方針でパスデータをこのファイル内に
   複製している（item/profiles.jsのsymbol定義から抜粋、見た目は同一）。
   ================================================================ */
const LIGHTBULB_PATH = '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-6 6c0 2.5 1.5 4 2.5 5.5.5.7.5 1 .5 1.5h6c0-.5 0-.8.5-1.5C16.5 13 18 11.5 18 9a6 6 0 0 0-6-6Z"/>';
const CHEVRON_RIGHT_PATH = '<g transform="translate(12 12) scale(1.458) translate(-12 -12)"><path d="M9 6l6 6-6 6"/></g>';

// 生のキー名（nsKey化しない）。元サイトと同一オリジンのlocalStorageを
// 共有し、item以外のツールを含むサイト全体で「初回のみ」を成立させる
// ためのフラグなので、値の意味・キー名は変更しないこと。
const FIRST_VISIT_HINT_KEY = 'sky_first_visit_hint_shown_v1';
function firstVisitHintShown() {
  try { return localStorage.getItem(FIRST_VISIT_HINT_KEY) === '1'; }
  catch (e) { return true; } // 書き込めない環境では、消せないバナーを出し続けないよう表示自体を諦める
}
function markFirstVisitHintShown() {
  try { localStorage.setItem(FIRST_VISIT_HINT_KEY, '1'); } catch (e) { /* private browsing等 */ }
}

function renderFirstVisitHint() {
  if (firstVisitHintShown()) return '';
  const en = CURRENT_LANG === 'en';
  return `
    <div class="pf-hint-banner" id="dashFirstVisitHint">
      <span class="pf-hint-banner-text"><svg class="inline-icon" width="18" height="18">${LIGHTBULB_PATH}</svg> ${en
        ? 'New here from a shared link? Switch between multiple save-slot profiles, and use Data Transfer to move your data to another device — no cloud account needed.'
        : '共有リンクから来た方へ：プロフィール切替で複数の保存枠を使い分けたり、データ引継ぎでクラウド不要のまま別端末にデータを移せます。'}</span>
      <button type="button" class="pf-hint-banner-close" id="dashFirstVisitHintClose" aria-label="${en ? 'Dismiss' : '閉じる'}"><svg class="inline-icon" width="18" height="18"><use href="#i-close"/></svg></button>
    </div>`;
}

function renderWelcomeCard() {
  const en = CURRENT_LANG === 'en';
  return `
    <div class="welcome-card">
      <button type="button" class="welcome-title" id="dashWelcomeToggle" aria-expanded="false">
        <span class="welcome-title-label">${en ? 'For First-Time Visitors' : 'はじめての方へ'}</span>
        <span class="welcome-toggle-icon" id="dashWelcomeToggleIcon"><svg class="inline-icon" width="14" height="14">${CHEVRON_RIGHT_PATH}</svg></span>
      </button>
      <div class="welcome-text" id="dashWelcomeText" style="display:none;">${en
        ? 'This tool lets you track your Sky dress-up item collection by category.<br>Use the Random Coord feature to discover new combinations, save favorites with My Coord, and share your completion rate as an image on X.<br>Start by registering items in a category you\'re interested in!<br>Clicking an item\'s name searches for &quot;item name + Sky&quot; automatically, so give it a try!<br>Please report any bugs or issues to @Skyzztai!'
        : 'このツールでは、Skyのドレスアップアイテムの所持状況をカテゴリ別にチェックできます。<br>ランダムコーデ機能で新しい組み合わせを発見したり、マイコーデでお気に入りを保存したりできるほか、達成率を画像にしてXでシェアすることも可能です。<br>まずは気になるカテゴリからアイテムを登録してみてください！<br>アイテムの名前をクリックすると、「アイテム名+Sky」で自動で検索できますので活用してみてください！<br>不具合やミスは@Skyzztaiまでお知らせください！'}</div>
    </div>`;
}

function featureBtnHtml({ id, href, icon, label, desc }) {
  const tag = href ? 'a' : 'button';
  const attrs = href ? `href="${href}"` : `type="button" id="${id}"`;
  return `
    <${tag} class="feature-btn" ${attrs}>
      <span class="feature-icon icon-chip" style="width:32px; height:32px;"><svg class="inline-icon" width="25" height="25"><use href="#${icon}"/></svg></span>
      <span>
        <span class="feature-label">${label}</span>
        <span class="feature-desc">${desc}</span>
      </span>
    </${tag}>`;
}

function renderShell() {
  const en = CURRENT_LANG === 'en';
  return `
    <div class="item-view">
    <div class="dash-wrap">
      <div id="dashFirstVisitHintWrap">${renderFirstVisitHint()}</div>
      ${renderWelcomeCard()}

      <div id="dashTitlesPanel"></div>

      <p class="sec-label">${en ? 'All Items' : '全アイテム'}</p>
      ${featureBtnHtml({
        href: '#/item/all', icon: 'i-grid',
        label: en ? 'Browse & Select All Items at Once' : '全アイテムを一覧で見る・選択',
        desc: en ? 'View items from every category together as image tiles, and tap to mark what you own'
                 : '全カテゴリのアイテムを画像タイルでまとめて表示し、タップで所持を一気に選択できます',
      })}

      <p class="sec-label" id="dashCatLabel">${en ? 'Categories' : 'カテゴリ一覧'}</p>
      <div class="cat-grid" id="dashCatGrid">
        ${GRID_CATEGORIES.map(cat => catTileHtml(cat, null, null)).join('')}
      </div>

      <p class="sec-label">${en ? 'Music Sheet Completion' : '楽譜コンプリート管理'}</p>
      ${featureBtnHtml({
        href: `#/item/${MUSIC_SHEET_CAT ? MUSIC_SHEET_CAT.key : 'music_sheet'}`, icon: 'i-sheet-music',
        label: en ? 'Music Sheet Completion Tracker' : '楽譜コンプリート率',
        desc: en ? "Track which of the in-game Music Sheets you've collected, by acquisition method and candle cost"
                 : 'ゲーム内の楽譜の入手状況とコンプリート率を管理できます',
      })}

      <p class="sec-label">${en ? 'Item Search' : 'アイテム検索'}</p>
      ${featureBtnHtml({
        id: 'dashOpenSearchBtn', icon: 'i-search',
        label: en ? 'Search Items by Season / Event' : '季節・イベントでアイテムを検索',
        desc: en ? 'Search items across all categories by season, day event, category, favorite, and ownership status'
                 : '全カテゴリのアイテムを季節・日々・カテゴリ・お気に入り・所持状況で横断検索できます',
      })}

      <p class="sec-label">${en ? 'Cost Management' : 'コスト管理'}</p>
      <div class="dash-feature-row">
        ${featureBtnHtml({
          href: '#/item/cost', icon: 'i-candle',
          label: en ? 'Item Cost Breakdown' : 'アイテム別コスト',
          desc: en ? 'Check the actual acquisition cost of owned items (Candles, Wax, Hearts, real currency)'
                   : '所持アイテムの実際の入手コスト（キャンドル・星のキャンドル・ハート・実額）を確認できます',
        })}
        ${featureBtnHtml({
          id: 'dashOpenWishlistBtn', icon: 'i-cart',
          label: en ? 'Wishlist & Unlock Calculator' : 'ウィッシュリスト・必要コスト計算',
          desc: en ? 'Register items you want, and it automatically totals the candles/hearts/money needed and the shortfall'
                   : '欲しいアイテムを登録すると、必要なキャンドル・ハート・課金額の合計と不足数を自動計算します',
        })}
        ${featureBtnHtml({
          id: 'dashOpenAcquireLogBtn', icon: 'i-calendar',
          label: en ? 'Acquisition Log' : 'アイテム獲得ログ',
          desc: en ? 'View a chronological list of when you marked each item as owned' : '所持チェックを入れた日時の一覧を確認できます',
        })}
      </div>

      <p class="sec-label">${en ? 'Coord Features' : 'コーデ機能'}</p>
      <div class="dash-feature-row">
        ${featureBtnHtml({
          id: 'dashOpenRandomCoordBtn', icon: 'i-dice',
          label: en ? 'Random Coord' : 'ランダムコーデ',
          desc: en ? 'Suggest a random outfit combination from your owned items' : '所持アイテムからランダムにコーデを提案',
        })}
        ${featureBtnHtml({
          id: 'dashOpenMyCoordBtn', icon: 'i-hanger',
          label: en ? 'My Coord' : 'マイコーデ',
          desc: en ? 'Save and manage your favorite outfit sets' : 'お気に入りのコーデセットを保存・管理',
        })}
        ${featureBtnHtml({
          id: 'dashOpenClosetCollageBtn', icon: 'i-image',
          label: en ? 'Closet Collage' : 'クローゼットコラージュ',
          desc: en ? 'Arrange owned items and your own photos into a grid to create and share a cute collage image'
                   : '所持アイテムや自分の写真をマス目に並べて、かわいいコラージュ画像を作成・共有できます',
        })}
      </div>

      <p class="sec-label">${en ? 'Share Achievement Rate' : '達成率をシェア'}</p>
      <div class="dash-feature-row">
        ${featureBtnHtml({
          id: 'dashShareOnXBtn', icon: 'i-upload',
          label: en ? 'Share Image to X' : 'Xで画像を共有',
          desc: en ? 'Turn your achievement rate into an image and post it to X (also saves the image)'
                   : '達成率を画像にしてXへ投稿できます（画像の保存も同時にできます）',
        })}
        ${featureBtnHtml({
          id: 'dashCustomizeShareBtn', icon: 'i-palette',
          label: en ? 'Customize & Share' : 'カスタマイズして共有',
          desc: en ? 'Choose which categories to show, a background theme, and a comment before saving/sharing'
                   : '表示するカテゴリ・背景テーマ・コメントを自分好みに設定してから保存/共有できます',
        })}
      </div>

      <p class="sec-label">${en ? 'Share Your Favorites' : 'お気に入りをシェア'}</p>
      ${featureBtnHtml({
        id: 'dashFavShareBtn', icon: 'i-heart',
        label: en ? 'Share Favorite Items' : 'お気に入りアイテムを共有',
        desc: en ? 'Save and share your favorited items as an image with a comment' : 'お気に入り登録したアイテムをコメント付きの画像で保存・共有できます',
      })}
    </div>
    </div>`;
}

async function renderCategoryGrid(token) {
  const results = await Promise.all(GRID_CATEGORIES.map(async cat => {
    let total = 0;
    try {
      const mod = await loadCategoryItems(cat.key);
      total = Array.isArray(mod.ITEMS) ? mod.ITEMS.length : 0;
    } catch (e) {
      console.error(`[item dashboard] failed to load item data: ${cat.key}`, e);
    }
    const { owned } = getCategoryState(cat.key);
    const ownedCount = Object.values(owned).filter(Boolean).length;
    return { cat, ownedCount, total };
  }));

  if (token !== mountToken || !hostEl) return; // 別ルートへ遷移済みなら描画しない
  const gridEl = hostEl.querySelector('#dashCatGrid');
  if (gridEl) gridEl.innerHTML = results.map(r => catTileHtml(r.cat, r.ownedCount, r.total)).join('');

  const labelEl = hostEl.querySelector('#dashCatLabel');
  if (labelEl) {
    const totalOwned = results.reduce((s, r) => s + r.ownedCount, 0);
    const totalAll = results.reduce((s, r) => s + r.total, 0);
    labelEl.textContent = CURRENT_LANG === 'en'
      ? `Categories (${totalOwned}/${totalAll} owned)`
      : `カテゴリ一覧（${totalOwned}/${totalAll} 所持）`;
  }
}

// ダッシュボード上の各「開く」ボタンとサブ機能モジュールの対応表。
// mount()でこの表を元にリスナーを配線し、unmount()で同じ表を使って
// 開きっぱなしのモーダルを閉じる（ルート離脱時に後片付けする）。
const FEATURE_TRIGGERS = [
  { btnId: 'dashOpenSearchBtn', mod: searchModal, action: 'open' },
  { btnId: 'dashOpenWishlistBtn', mod: wishlistCostModal, action: 'open' },
  { btnId: 'dashOpenAcquireLogBtn', mod: acquireLogModal, action: 'open' },
  { btnId: 'dashOpenRandomCoordBtn', mod: randomCoord, action: 'open' },
  { btnId: 'dashOpenMyCoordBtn', mod: myCoord, action: 'open' },
  { btnId: 'dashOpenClosetCollageBtn', mod: closetCollage, action: 'open' },
  { btnId: 'dashShareOnXBtn', mod: achievementShare, action: 'shareOnX' },
  { btnId: 'dashCustomizeShareBtn', mod: achievementShare, action: 'open' },
  { btnId: 'dashFavShareBtn', mod: favoritesShare, action: 'open' },
];

// 「はじめての方へ」の開閉・初回訪問ヒントの閉じるボタン配線
// （FEATURE_TRIGGERSと同じ [{el, handler}] 保持パターンでunmount時に後片付けする）
let introListeners = [];

function setupIntroCard() {
  introListeners = [];
  const toggleBtn = hostEl.querySelector('#dashWelcomeToggle');
  if (toggleBtn) {
    const handler = () => {
      const body = hostEl.querySelector('#dashWelcomeText');
      const icon = hostEl.querySelector('#dashWelcomeToggleIcon');
      const expanded = body.style.display !== 'none';
      body.style.display = expanded ? 'none' : 'block';
      icon.classList.toggle('expanded', !expanded);
      toggleBtn.setAttribute('aria-expanded', String(!expanded));
    };
    toggleBtn.addEventListener('click', handler);
    introListeners.push({ el: toggleBtn, handler });
  }
  const dismissBtn = hostEl.querySelector('#dashFirstVisitHintClose');
  if (dismissBtn) {
    const handler = () => {
      markFirstVisitHintShown();
      hostEl.querySelector('#dashFirstVisitHint')?.remove();
    };
    dismissBtn.addEventListener('click', handler);
    introListeners.push({ el: dismissBtn, handler });
  }
}

function teardownIntroCard() {
  introListeners.forEach(({ el, handler }) => el.removeEventListener('click', handler));
  introListeners = [];
}

let triggerListeners = []; // [{el, handler}] unmount時にremoveEventListenerするため保持

function setupFeatureTriggers() {
  triggerListeners = FEATURE_TRIGGERS.map(({ btnId, mod, action }) => {
    const el = hostEl.querySelector(`#${btnId}`);
    if (!el) return null;
    const handler = () => { mod[action](); };
    el.addEventListener('click', handler);
    return { el, handler };
  }).filter(Boolean);
}

function teardownFeatureTriggers() {
  triggerListeners.forEach(({ el, handler }) => el.removeEventListener('click', handler));
  triggerListeners = [];
  // 離脱時、開きっぱなしのモーダルがあれば閉じる（close()はどのモーダルも
  // 「開いていなければ何もしない」実装のため、常時呼んでも安全）
  [searchModal, wishlistCostModal, acquireLogModal, randomCoord, myCoord, closetCollage, achievementShare, favoritesShare]
    .forEach(mod => { try { mod.close(); } catch (e) { /* no-op */ } });
  try { coordShare.closeSharedCoord(); } catch (e) { /* no-op */ }
}

export function mount(container) {
  hostEl = container;
  injectStyles();
  const token = ++mountToken;

  hostEl.innerHTML = renderShell();
  renderCategoryGrid(token);
  setupFeatureTriggers();
  setupIntroCard();
  titlesPanel.mount(hostEl.querySelector('#dashTitlesPanel'));
}

export function unmount() {
  mountToken++; // 進行中の非同期描画（カテゴリ件数取得）を無効化する
  teardownFeatureTriggers();
  teardownIntroCard();
  hostEl = null;
}

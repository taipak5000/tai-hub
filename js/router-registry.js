/* ================================================================
   ROUTESテーブル：ツールキー -> {mount(container, sub), unmount(), title(sub)}

   🩹 各ツールのビューモジュールは、以前はここで static import * as ... で
   全14ツール分を一括して読み込んでいた。ES Modulesの仕様上、type="module"の
   エントリポイント（js/app.js）はその静的import依存グラフ全体（router.js→
   router-registry.js→14ツール分のview module→さらにその先の数十〜百件の
   サブファイル。例えばspirit-catalogのデータファイル1つだけで41,591行ある）を
   フェッチ・パースし終えるまで、app.js自身のトップレベルコード（テーマ適用・
   アイコンスプライト注入・サイトドック描画・ルーター起動）を一切実行できない
   ——つまりユーザーが実際に見ているのがitemだけであっても、他13ツール分の
   コードを全部読み込み終えるまでdockすら表示されない。これが「tai-hubを
   開くと一瞬UIの無い画面が表示される」不具合の主因だった。
   対処として、CATEGORY_REGISTRY（軽量なデータのみ）以外の
   全ツールのview moduleを動的import()（初回mount時に必要な分だけ遅延読み込み、
   以後はモジュール側のキャッシュが効くので2回目以降は再フェッチされない）に
   変更した。動的importは静的依存グラフに含まれないため、app.js側の初期化は
   一切ブロックされなくなる。読み込み中は#app-rootに.rt-loadingスピナー
   （css/chrome.css）を一瞬だけ表示する。
   ================================================================ */

import { CATEGORY_REGISTRY } from '../features/item/data/categories.js';
import { CURRENT_LANG } from './i18n.js';

export const DEFAULT_ROUTE = 'item';

const LOADING_HTML = '<div class="rt-loading"><div class="rt-spinner"></div></div>';

/* ── item専用エントリ：dashboard/category/cost/music_sheetの4サブビューを
   それぞれ独立して遅延読み込み・キャッシュする ── */
const itemImporters = {
  dashboard: () => import('../features/item/dashboard-view.js'),
  category: () => import('../features/item/category-view.js'),
  cost: () => import('../features/item/cost-view.js'),
  musicSheet: () => import('../features/item/music-sheet-view.js'),
  allItems: () => import('../features/item/all-items-view.js'),
};
const itemMods = {};
let itemToken = 0;

const itemEntry = {
  async mount(container, sub) {
    const myToken = ++itemToken;
    let targetKey;
    let cat = null;
    let sharedCoordSub = null; // コーデの共有リンク（#/item/coord=<code>）: ダッシュボードの上にプレビューを出す
    if (!sub) {
      targetKey = 'dashboard';
    } else if (sub.startsWith('coord=')) {
      targetKey = 'dashboard';
      sharedCoordSub = sub;
    } else if (sub === 'cost') {
      targetKey = 'cost';
    } else if (sub === 'all') {
      targetKey = 'allItems';
    } else {
      cat = CATEGORY_REGISTRY.find(c => c.key === sub);
      if (cat && cat.section === 'special') {
        // music_sheet は MUSIC_SHEETS という別形状のデータ（曲ごとの入手方法・
        // 難易度・音楽キー等）を持ち、汎用category-view.jsの前提（ITEMS_DATA型の
        // フィールド）に合わないため、item_cost.html同様に専用ビューとして移植した。
        targetKey = 'musicSheet';
      } else if (cat) {
        targetKey = 'category';
      } else {
        // 未知のサブルートはダッシュボードへフォールバック
        location.hash = '#/item';
        return;
      }
    }

    if (!itemMods[targetKey]) {
      container.innerHTML = LOADING_HTML;
      itemMods[targetKey] = await itemImporters[targetKey]();
    }
    if (myToken !== itemToken) return; // 読み込み待ち中に別ルートへ遷移済み

    const mod = itemMods[targetKey];
    if (targetKey === 'category') mod.mount(container, cat);
    else mod.mount(container);
    // ダッシュボードの次にはほぼ必ずカテゴリを開くので、手が空いた時にカテゴリ画面の
    // モジュールを先読みしておく（タップしてからのダウンロード待ちを無くす。各カテゴリの
    // アイテムデータは称号の集計のためダッシュボードがすでに読み込んでいる）
    if (targetKey === 'dashboard' && !itemMods.category) {
      const idle = window.requestIdleCallback || (cb => setTimeout(cb, 1500));
      idle(() => {
        itemImporters.category().then(m => { itemMods.category = itemMods.category || m; }).catch(() => {});
      });
    }
    if (sharedCoordSub) {
      import('../features/item/coord/coord-share.js').then(m => {
        if (myToken === itemToken) m.openSharedCoordFromRoute(sharedCoordSub);
      });
    }
  },
  unmount() {
    itemToken++; // 進行中のmount()（動的import待ち等）を無効化
    Object.values(itemMods).forEach(mod => mod && mod.unmount && mod.unmount());
  },
  title(sub) {
    if (!sub || sub.startsWith('coord=')) return CURRENT_LANG === 'en' ? 'Item Collection Tracker - tai-hub' : 'アイテム所持管理 - tai-hub';
    if (sub === 'cost') return CURRENT_LANG === 'en' ? 'Cost Calculator - tai-hub' : 'コスト集計 - tai-hub';
    if (sub === 'all') return CURRENT_LANG === 'en' ? 'All Items - tai-hub' : '全アイテム一覧 - tai-hub';
    const cat = CATEGORY_REGISTRY.find(c => c.key === sub);
    if (cat) return `${CURRENT_LANG === 'en' ? cat.nameEn : cat.name} - tai-hub`;
    return 'tai-hub';
  },
};

// 単一ページ系ツール共通のROUTESエントリ。ビューモジュールは初回mount時に
// 動的import()で遅延読み込みし、以後は使い回す。subは常にそのままビューへ渡す
// （サブルートを持たないビューのmount(container)はJSの仕様上、余分な第2引数を
// 単に無視するだけなので安全——item以外の全ツールをこの1関数で統一できる）。
function lazyToolEntry(importFn, nameJa, nameEn) {
  let mod = null;
  let token = 0;
  return {
    async mount(container, sub) {
      const myToken = ++token;
      if (!mod) {
        container.innerHTML = LOADING_HTML;
        mod = await importFn();
      }
      if (myToken !== token) return; // 読み込み待ち中に別ルートへ遷移済み
      mod.mount(container, sub);
    },
    unmount() {
      token++; // 進行中のmount()（動的import待ち）を無効化
      if (mod) mod.unmount();
    },
    title() { return `${CURRENT_LANG === 'en' ? nameEn : nameJa} - tai-hub`; },
  };
}

export const ROUTES = {
  item: itemEntry,
  emote: lazyToolEntry(() => import('../features/emote/emote-view.js'), 'エモート所持率管理', 'Emote Collection Tracker'),
  share: lazyToolEntry(() => import('../features/share/share-view.js'), '創作物管理ツール', 'Creation Manager'),
  'tai-nomacan': lazyToolEntry(() => import('../features/tai-nomacan/nomacan-view.js'), 'ノマキャン計算機', 'Candle Calculator'),
  'tai-nomacan-pro': lazyToolEntry(() => import('../features/tai-nomacan-pro/nomacan-pro-view.js'), 'ノマキャン計算機プロ', 'Candle Calculator Pro'),
  'star-candle': lazyToolEntry(() => import('../features/star-candle/star-candle-view.js'), '星のキャンドル計算機', 'Star Candle Calculator'),
  wings: lazyToolEntry(() => import('../features/wings/wings-view.js'), '羽トラッカー', 'Wing Tracker'),
  companion: lazyToolEntry(() => import('../features/companion/companion-view.js'), '精霊同行ツール', 'Spirit Companion Tool'),
  'spirit-catalog': lazyToolEntry(() => import('../features/spirit-catalog/spirit-catalog-view.js'), '精霊ツリー管理', 'Spirit Tree Catalog'),
  'tai-revisit': lazyToolEntry(() => import('../features/tai-revisit/tai-revisit-view.js'), '再訪精霊データベース', 'Revisit Spirit Database'),
  'tai-score': lazyToolEntry(() => import('../features/tai-score/tai-score-view.js'), '楽譜づくり', 'Sheet Music Maker'),
  'tai-card': lazyToolEntry(() => import('../features/tai-card/tai-card-view.js'), '星紡ぎカード', 'Self-Intro Card Maker'),
  'data-transfer': lazyToolEntry(() => import('../features/data-transfer/data-transfer-view.js'), 'データ引継ぎ', 'Data Transfer'),
  'tai-info': lazyToolEntry(() => import('../features/tai-info/tai-info-view.js'), '設定・クレジット', 'Settings & Credits'),
  profile: lazyToolEntry(() => import('../features/profile/profile-view.js'), '作者プロフィール', 'Creator Profile'),
};

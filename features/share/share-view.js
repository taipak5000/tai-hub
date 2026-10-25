/* ================================================================
   share（創作物管理ツール／Creation Manager）の tai-hub 移植版。
   公開面は mount(container)/unmount() の2関数のみ（js/router.js から
   マウントされる）。

   移植元: share/index.html（~5443行のスタンドアロンページ）。このツールは
   他の姉妹ツールと異なりバニラJSではなく Vue 3（CDN読み込み・ビルド
   レス・Composition API）で書かれており、ユーザーの明示的な指示により
   このツールに限り Vue のまま移植する（tai-hub の他ツールはバニラJS）。
   元の #app に mount していた単一の createApp({ setup(){...} }) のうち、
   setup() 本体（元ファイル4366-5430行）と、そのテンプレート（同
   1231-1756行の <div class="container" id="app" v-cloak"> 内）を、
   共有chrome（ヘッダー/ナビバー・サイドバー・プロフィールバー・
   ダッシュボード/バックアップ/アイコンカスタマイズ/表示設定の各モーダル・
   サイトドック）を除いた「このツール自身」の部分だけに絞って移植した。

   【共有chromeとのブリッジ関数（window.*）の扱い】
   元のsetup()は、同ファイル内の別IIFE（プレーンJS、プロフィールバー・
   各種モーダル・サイドバーのフォーカストラップ・テーマ/言語のIIFE側
   フックを持つ）と window.* 経由で相互に橋渡ししていた。tai-hubでは
   これらの chrome はすべて js/chrome/*.js が肩代わりし、かつ router
   経由でどのツールがマウントされていても常時アクティブなため、以下の
   ように整理した（"remove" = 呼び出し自体を削除、"local" = tai-hub側の
   等価な処理をこのファイル内で直接使う形に置き換え）:
     - window.pfSidebarIsOpen / pfSidebarClose / trapPush / trapPop /
       pfCloseOtherTopLevelOverlays （サイドバー開閉の排他制御・フォーカス
       トラップ） → remove。「他のツール」ドロワーは js/chrome/tools-drawer.js
       が全ルート共通で提供済みで、このツール自身はサイドバーを持たない。
     - window.toggleTheme / pfSyncThemeMode、themeMode/isDarkMode の ref・
       systemThemeQueryのmatchMedia監視 → remove。テーマ切替は
       js/chrome/settings-modal.js（state.jsのtoggleTheme/getSkyThemeMode）
       が全ルート共通で提供済みで、このツールのテンプレート自体はテーマ
       切替ボタンを持たない（元のヘッダー内ボタンのみが chrome 側）。
     - window.setLang / pfApplyLang、lang ref・toggleLang → remove。
       言語切替は表示設定モーダル（設定変更後 location.reload()）に
       既にあり、このファイルは js/i18n.js の CURRENT_LANG（定数）を
       直接読む非リアクティブな t()/optLabel() に置き換えた
       （他の移植済みツールと同じ方針。切替はリロードを伴うため
       リアクティブである必要がない）。
     - window.pfSyncDockProfile / pfGetActiveProfile / pfDisplayName、
       activeProfileName ref → remove。サイトドックのプロフィール表示は
       js/chrome/site-dock.js が独自に持っている。
     - window.pfIconUpdatePreview（onMounted内） → remove。ホーム画面
       アイコンカスタマイズ機能自体を tai-hub はまだ持たない（他の
       移植済みツールにも存在しない、chrome側スコープ外の機能）。
   上記はすべて「chromeが既に肩代わりしている／このツール固有ではない」
   ため、tai-hub 側の等価関数を呼ぶのではなく削除している。反対に、
   データ層のブリッジ（nsKey）は js/state.js の共有実装をそのまま使う
   （後述）。

   【状態・ストレージ】localStorage キー名・JSON形状は元実装と完全一致
   （nsKey()でプロフィール名前空間化）:
     - sky_tracker_storage: { placedItems: [{ id, memo, placedDate(ISO),
       isSuspended, genres:[], area, thumbnail }] }（旧: 単一genre文字列→
       genres配列へ、area/thumbnail欠損→空値へ、の移行ロジックも移植済み）
     - shareTitles_v1: { lifetimeCreated, earned: [{ id, earnedAt }] }
     - sky_share_calendar_collapsed: '1'/'0' の生文字列（JSONではない）

   【意図的な簡略化】
   - TRANSLATIONS辞書は元のsetup()内のもの（217行）から、共有chrome側と
     重複する項目（theme.系、sidebar.系、dock.系）を除いた「このツール
     固有」の項目だけを残している。文言・キー名は元のまま。ただし
     header.title（ページ見出し）とfooter.*（フッターの免責文・クレジット・
     リンク）は、他の姉妹ツール（companion等）と同様にこのツール自身の
     テンプレートが直接描画する必要があるため残してある（chromeが提供する
     のはナビバー/サイドバー/プロフィールバー等の「枠」だけで、ページ内の
     見出しテキストやフッターまでは肩代わりしない）。
   - カレンダー日別詳細の色ドットは元テンプレートでは
     :style="{ background: 'var(--accent-blue-solid)' }" という定数
     バインディングだったため、CSS側の固定値に置き換えた（挙動・見た目は
     同一、単なるVueバインディングの削減）。
   - アイコンは共有スプライト（js/icon-sprite.js）に無い分だけ、
     tai-nomacan/star-candle と同じ方式でこのファイル専用の小さな
     ローカルスプライト（sv-i-* プレフィックス）を追加注入している
     （共有icon-sprite.jsは他エージェントが並行して触っているため、
     衝突を避けて編集しない）。
   ================================================================ */
import { CURRENT_LANG } from '../../js/i18n.js';
import { nsKey } from '../../js/state.js';

const STYLE_LINK_ID = 'share-view-styles';
const ICON_SPRITE_ID = 'share-icon-sprite';
const VUE_CDN_URL = 'https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.prod.js';

/* ================================================================
   翻訳辞書（このツール固有の文言のみ。共有chrome側の文言は含めない）
   ================================================================ */
const TRANSLATIONS = {
  ja: {
    'header.title': '創作物期限管理 (14日間)',
    'footer.disclaimer': 'このサイトはSky 星を紡ぐ子どもたちの非公式ファンサイトです。thatgamecompanyは一切関与していません。',
    'footer.createdBy': '作成・ご意見:',
    'footer.settingsLink': '設定・クレジット・プライバシーポリシー',
    'stats.header': '現在の状態',
    'stats.active': '設置中',
    'stats.warning': '期限間近',
    'stats.pending': '保留中',
    'stats.expired': '期限切れ',
    'stats.warningHint': 'クリックして期限間近の項目を一括再設置',
    'list.header': '設置した創作物一覧',
    'list.emptyAll': '現在管理している創作物は記憶されていません。<br>下のボタンから追加してください！',
    'list.emptyFiltered': '選択したジャンル・エリア・検索条件に該当する設置物はありません。',
    'list.searchPlaceholder': 'メモを検索',
    'list.clearFilters': 'フィルターを全てクリア',
    'list.areaFilterAll': 'すべて',
    'item.memoPlaceholder': '設置場所や内容 (例: 花鳥郷 魔法のお店前)',
    'item.placedDate': '設置日',
    'item.expiryDate': '自動消滅日',
    'item.area': 'エリア',
    'item.thumbnailAlt': '設置物の写真',
    'badge.suspended': '保留中',
    'badge.expired': '消滅',
    'badge.dueToday': '今日まで',
    'badge.daysLeft': 'あと {n}日',
    'actions.replace': '今日再設置',
    'actions.suspend': '保留',
    'actions.delete': '削除',
    'actions.cancel': '取消',
    'actions.deleteConfirm': '削除しますか？メモ・ジャンル・日付もすべて削除されます。',
    'actions.exportIcs': 'カレンダー登録',
    'actions.addNew': '新しい設置物を追加',
    'actions.exportAllIcs': '全期限をまとめてカレンダー登録',
    'actions.addPhoto': '写真を追加',
    'actions.changePhoto': '写真を変更',
    'actions.removePhoto': '写真を削除',
    'export.btn': 'テキスト書き出し',
    'export.header': '=== 創作物 設置リスト（このツールのみ） ===',
    'export.exportedAt': '書き出し日時',
    'export.noMemo': '(メモなし)',
    'export.genreLabel': 'ジャンル',
    'export.statusLabel': '状態',
    'export.areaLabel': 'エリア',
    'bulk.enter': '選択して一括操作',
    'bulk.exit': '選択解除',
    'bulk.selectedCount': '{n}件選択中',
    'bulk.rePlaceSelected': '選択項目を今日再設置',
    'bulk.suspendSelected': '選択項目を保留',
    'bulk.deleteSelected': '選択項目を削除',
    'bulk.deleteConfirm': '選択した{n}件を削除しますか？メモ・ジャンル・日付もすべて削除されます。',
    'bulk.selectAll': 'すべて選択',
    'bulk.deselectAll': '選択を解除',
    'bulk.selectItem': 'この項目を選択',
    'ics.summary': '{memo} の自動消滅',
    'ics.summaryFallback': '創作物',
    'ics.description': 'Sky 星を紡ぐ子どもたちの創作物（掲示期限14日間）の自動消滅日のリマインダーです。',
    'titles.header': '称号',
    'titles.countTemplate': '{earned} / {total} 個解除',
    'titles.lockedName': '？？？',
    'titles.lockedHint': '称号は条件を満たすと明らかになります',
    'titles.unlocked': '称号を獲得しました！',
    'titles.first.name': 'はじめての一歩',
    'titles.first.desc': '創作物をはじめて追加した',
    'titles.apprentice.name': '見習い設置職人',
    'titles.apprentice.desc': '累計5個の創作物を追加した',
    'titles.skilled.name': '熟練の設置職人',
    'titles.skilled.desc': '累計15個の創作物を追加した',
    'titles.master.name': '創作の匠',
    'titles.master.desc': '累計30個の創作物を追加した',
    'titles.legend.name': '伝説の創作者',
    'titles.legend.desc': '累計50個の創作物を追加した',
    'quickFilter.expiringSoonNotice': '期限間近の項目だけを表示しています',
    'calendar.header': '消滅カレンダー',
    'calendar.collapse': 'カレンダーを折りたたむ',
    'calendar.expand': 'カレンダーを開く',
    'calendar.prevMonth': '前の月',
    'calendar.nextMonth': '次の月',
    'calendar.today': '今月',
    'calendar.emptyAll': '掲示中の創作物がありません。',
    'calendar.legendPast': '消滅済み',
    'calendar.legendSoon': '期限間近(3日以内)',
    'calendar.legendLater': '掲示中',
    'calendar.noSelection': '日付をタップすると内訳が見られます',
    'calendar.areaFilterAll': 'すべて',
    'calendar.jumpToList': '一覧で見る',
  },
  en: {
    'header.title': 'Creation Expiry Manager (14-Day)',
    'footer.disclaimer': 'This is an unofficial fan site for Sky: Children of the Light. thatgamecompany is not involved in any way.',
    'footer.createdBy': 'Created by / feedback:',
    'footer.settingsLink': "Settings / Credits / Privacy Policy",
    'stats.header': 'Current Status',
    'stats.active': 'Active',
    'stats.warning': 'Expiring Soon',
    'stats.pending': 'Suspended',
    'stats.expired': 'Expired',
    'stats.warningHint': 'Click to bulk re-place items expiring soon',
    'list.header': 'Placed Creations',
    'list.emptyAll': 'No creations are being tracked yet.<br>Add one with the button below!',
    'list.emptyFiltered': 'No placed items match the selected genre, area, or search.',
    'list.searchPlaceholder': 'Search memo',
    'list.clearFilters': 'Clear all filters',
    'list.areaFilterAll': 'All',
    'item.memoPlaceholder': 'Where you placed it (e.g. Hidden Forest, in front of the magic shop)',
    'item.placedDate': 'Placed on',
    'item.expiryDate': 'Auto-expires',
    'item.area': 'Area',
    'item.thumbnailAlt': 'Creation photo',
    'badge.suspended': 'Suspended',
    'badge.expired': 'Expired',
    'badge.dueToday': 'Due today',
    'badge.daysLeft': '{n} day(s) left',
    'actions.replace': 'Re-place today',
    'actions.suspend': 'Suspend',
    'actions.delete': 'Delete',
    'actions.cancel': 'Cancel',
    'actions.deleteConfirm': 'Delete this? The memo, genre, and dates will all be removed too.',
    'actions.exportIcs': 'Add to Calendar',
    'actions.addNew': 'Add New Placement',
    'actions.exportAllIcs': 'Export all expiries to calendar',
    'actions.addPhoto': 'Add Photo',
    'actions.changePhoto': 'Change Photo',
    'actions.removePhoto': 'Remove photo',
    'export.btn': 'Export as text',
    'export.header': '=== Placed Creations List (this tool only) ===',
    'export.exportedAt': 'Exported at',
    'export.noMemo': '(No memo)',
    'export.genreLabel': 'Genre',
    'export.statusLabel': 'Status',
    'export.areaLabel': 'Area',
    'bulk.enter': 'Select for Bulk Actions',
    'bulk.exit': 'Cancel selection',
    'bulk.selectedCount': '{n} selected',
    'bulk.rePlaceSelected': 'Re-place selected today',
    'bulk.suspendSelected': 'Suspend selected',
    'bulk.deleteSelected': 'Delete selected',
    'bulk.deleteConfirm': 'Delete the {n} selected item(s)? Their memo, genre, and dates will all be removed too.',
    'bulk.selectAll': 'Select all',
    'bulk.deselectAll': 'Deselect all',
    'bulk.selectItem': 'Select this item',
    'ics.summary': '{memo} auto-expires',
    'ics.summaryFallback': 'Placed creation',
    'ics.description': 'Reminder for the 14-day auto-expiry of a placed creation in Sky: Children of the Light.',
    'titles.header': 'Titles',
    'titles.countTemplate': '{earned} / {total} unlocked',
    'titles.lockedName': '？？？',
    'titles.lockedHint': 'Unlocks when you meet its condition',
    'titles.unlocked': 'Title unlocked!',
    'titles.first.name': 'First Steps',
    'titles.first.desc': 'Added your first creation',
    'titles.apprentice.name': 'Apprentice Placer',
    'titles.apprentice.desc': '5 creations added (lifetime)',
    'titles.skilled.name': 'Skilled Placer',
    'titles.skilled.desc': '15 creations added (lifetime)',
    'titles.master.name': 'Master Craftsperson',
    'titles.master.desc': '30 creations added (lifetime)',
    'titles.legend.name': 'Legendary Creator',
    'titles.legend.desc': '50 creations added (lifetime)',
    'quickFilter.expiringSoonNotice': 'Showing only items expiring soon',
    'calendar.header': 'Expiry Calendar',
    'calendar.collapse': 'Collapse calendar',
    'calendar.expand': 'Expand calendar',
    'calendar.prevMonth': 'Previous month',
    'calendar.nextMonth': 'Next month',
    'calendar.today': 'This month',
    'calendar.emptyAll': 'No active creations to show.',
    'calendar.legendPast': 'Expired',
    'calendar.legendSoon': 'Expiring soon (within 3 days)',
    'calendar.legendLater': 'Active',
    'calendar.noSelection': 'Tap a date to see details',
    'calendar.areaFilterAll': 'All',
    'calendar.jumpToList': 'View in list',
  },
};

function t(key, params) {
  const dict = TRANSLATIONS[CURRENT_LANG] || TRANSLATIONS.ja;
  let str = dict[key] !== undefined ? dict[key] : (TRANSLATIONS.ja[key] !== undefined ? TRANSLATIONS.ja[key] : key);
  if (params) {
    Object.keys(params).forEach((k) => { str = str.split('{' + k + '}').join(params[k]); });
  }
  return str;
}

function optLabel(o) { return CURRENT_LANG === 'en' ? o.labelEn : o.label; }

/* 🏷️ ジャンル選択(複数選択可)・絞り込み */
const GENRE_OPTIONS = [
  { value: '', label: '未選択', labelEn: 'None', color: '#757579' },
  { value: 'ボート', label: 'ボート', labelEn: 'Boat', color: 'var(--blue-solid)' },
  { value: 'メモリー', label: 'メモリー', labelEn: 'Memory', color: '#a44dd0' },
  { value: 'スペース', label: 'スペース', labelEn: 'Space', color: '#5e5ce6' },
];
const FILTER_OPTIONS = [{ value: 'all', label: 'すべて', labelEn: 'All', color: '#757579' }, ...GENRE_OPTIONS];

/* 🗺️ エリア(マップ)タグ。wings等の他ツールと呼称・絵文字をそろえてある */
const AREA_OPTIONS = [
  { value: '', label: '未設定', labelEn: 'Not set' },
  { value: 'isleOfDawn', label: '孤島', labelEn: 'Isle of Dawn' },
  { value: 'prairie', label: '草原', labelEn: 'Prairie' },
  { value: 'forest', label: '雨林', labelEn: 'Forest' },
  { value: 'valley', label: '峡谷', labelEn: 'Valley' },
  { value: 'wasteland', label: '捨てられた地', labelEn: 'Wasteland' },
  { value: 'vault', label: '書庫', labelEn: 'Vault' },
  { value: 'eden', label: '暴風域', labelEn: 'Eye of Eden' },
];
function areaLabel(value) {
  const opt = AREA_OPTIONS.find((o) => o.value === value);
  return opt ? optLabel(opt) : '';
}

/* 🏆 称号(実績)。しきい値は累計追加数(lifetimeCreated)に対するもの */
const TITLES_KEY = 'shareTitles_v1';
const TITLES = [
  { id: 'first', icon: '<svg class="inline-icon" width="15" height="15"><use href="#sv-i-leaf"/></svg>', threshold: 1 },
  { id: 'apprentice', icon: '<svg class="inline-icon" width="15" height="15"><use href="#sv-i-hammer"/></svg>', threshold: 5 },
  { id: 'skilled', icon: '<svg class="inline-icon" width="15" height="15"><use href="#sv-i-hammer"/></svg>', threshold: 15 },
  { id: 'master', icon: '<svg class="inline-icon" width="15" height="15"><use href="#i-building"/></svg>', threshold: 30 },
  { id: 'legend', icon: '<svg class="inline-icon" width="15" height="15"><use href="#i-crown"/></svg>', threshold: 50 },
];

const MAX_THUMB_DIM = 200;

/* ================================================================
   スタイルシート・ローカルアイコンスプライトの注入（初回のみ）
   ================================================================ */
function injectStylesheet() {
  if (document.getElementById(STYLE_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_LINK_ID;
  link.rel = 'stylesheet';
  link.href = new URL('../../css/share.css', import.meta.url).href;
  document.head.appendChild(link);
}

// 共有スプライト(js/icon-sprite.js)には無いアイコンだけを、衝突しない
// 専用プレフィックス(sv-i-*)でこのツール専用に追加する（他エージェントが
// 並行して触っている共有icon-sprite.jsは編集しない。tai-nomacan/
// star-candleの各ビューと同じ方式）。
const SV_SPRITE_HTML = `
<svg id="${ICON_SPRITE_ID}" style="position:absolute;width:0;height:0;overflow:hidden;" aria-hidden="true"><defs>
<symbol id="sv-i-map" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.074) translate(-12 -12.15)"><path d="M4 6l6-2 4 2 6-2v14l-6 2-4-2-6 2Z"/><path d="M10 4.3v14M14 6.3v14"/></g></symbol>
<symbol id="sv-i-plus" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.25) translate(-12 -12)"><path d="M12 5v14M5 12h14"/></g></symbol>
<symbol id="sv-i-image" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.167) translate(-12 -12)"><path d="M4.5 4.5h15v15h-15Z"/><path d="M4.5 15.5l4.2-4.5a1 1 0 0 1 1.5 0l2.3 2.5 2.5-3a1 1 0 0 1 1.5 0l3 4.5"/><path d="M9 9.5a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z"/></g></symbol>
<symbol id="sv-i-box" viewBox="0 0 24 24"><path d="M4 8.5L12 4l8 4.5v8L12 21l-8-4.5Z"/><path d="M4 8.5L12 12.5l8-4"/><path d="M12 12.5V21"/></symbol>
<symbol id="sv-i-leaf" viewBox="0 0 24 24"><path d="M12 3c-5 2-8 6-8 11a8 8 0 0 0 8 7c5-2 8-6 8-11a8 8 0 0 0-8-7Z"/><path d="M12 21V9"/></symbol>
<symbol id="sv-i-hammer" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.389) translate(-11.5 -12.1)"><path d="M14.8 6.2l3 3-2.1 2.1-3-3Z"/><path d="M12.7 8.3l-7.5 7.5v2.2h2.2l7.5-7.5Z"/></g></symbol>
<symbol id="sv-i-lock" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.094) translate(-12 -12)"><path d="M6.5 11h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z"/><path d="M8 11V8a4 4 0 1 1 8 0v3"/></g></symbol>
</defs></svg>`;
function injectLocalIconSprite() {
  if (document.getElementById(ICON_SPRITE_ID)) return;
  document.body.insertAdjacentHTML('afterbegin', SV_SPRITE_HTML);
}

/* ================================================================
   Vue 3 (CDN) の遅延読み込み。既にwindow.Vueがあれば即解決、無ければ
   <script>タグを1回だけ作ってonloadを待つ（複数回mount()されても
   再フェッチしない）。
   ================================================================ */
let vueLoadPromise = null;
function ensureVue() {
  if (window.Vue) return Promise.resolve();
  if (!vueLoadPromise) {
    vueLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = VUE_CDN_URL;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('[share] Vueの読み込みに失敗しました'));
      document.head.appendChild(script);
    });
  }
  return vueLoadPromise;
}

/* ================================================================
   テンプレート（元index.htmlの#app内、共有chrome部分を除いた本体のみ）
   ================================================================ */
const TEMPLATE = `
<div class="share-view">
  <div class="sv-toast-wrap" aria-live="polite">
    <div v-for="tt in titleToasts" :key="tt.seq" class="sv-toast">
      <span class="sv-toast-icon" v-html="tt.icon"></span>
      <div>
        <div class="sv-toast-label">{{ t('titles.unlocked') }}</div>
        <div class="sv-toast-name">{{ tt.name }}</div>
      </div>
    </div>
  </div>

  <h1 class="sv-page-title">{{ t('header.title') }}</h1>

  <div class="sv-card">
    <div class="sv-card-header">{{ t('stats.header') }}</div>
    <div class="sv-stats-grid">
      <div class="sv-stat-box">
        <div class="sv-stat-box-label">{{ t('stats.active') }}</div>
        <div class="sv-stat-val" style="color: var(--green);">{{ stats.active }}</div>
      </div>
      <button type="button" class="sv-stat-box" :class="{ 'sv-stat-box-clickable': stats.warning > 0 }"
              :disabled="stats.warning === 0"
              :title="stats.warning > 0 ? t('stats.warningHint') : null"
              @click="focusExpiringSoon">
        <div class="sv-stat-box-label">{{ t('stats.warning') }}</div>
        <div class="sv-stat-val" style="color: var(--orange);">{{ stats.warning }}</div>
      </button>
      <div class="sv-stat-box">
        <div class="sv-stat-box-label">{{ t('stats.pending') }}</div>
        <div class="sv-stat-val" style="color: var(--text-2);">{{ stats.pending }}</div>
      </div>
      <div class="sv-stat-box">
        <div class="sv-stat-box-label">{{ t('stats.expired') }}</div>
        <div class="sv-stat-val" style="color: var(--red);">{{ stats.expired }}</div>
      </div>
    </div>
  </div>

  <div class="sv-card">
    <div class="sv-card-header sv-cal-header-row" role="button" tabindex="0"
         :aria-expanded="!calendarCollapsed" :aria-label="calendarCollapsed ? t('calendar.expand') : t('calendar.collapse')"
         @click="toggleCalendarCollapsed" @keydown.enter="toggleCalendarCollapsed" @keydown.space.prevent="toggleCalendarCollapsed">
      <span>{{ t('calendar.header') }}</span>
      <span class="sv-cal-caret" :class="{ 'is-expanded': !calendarCollapsed }"><svg class="inline-icon" width="13" height="13"><use href="#i-chevron-right"/></svg></span>
    </div>
    <template v-if="!calendarCollapsed">
      <div v-if="!hasAnyCalendarEvents" class="sv-cal-empty">{{ t('calendar.emptyAll') }}</div>
      <template v-else>
        <div class="sv-cal-nav">
          <button type="button" class="sv-cal-nav-btn" :aria-label="t('calendar.prevMonth')" @click="goToPrevMonth">‹</button>
          <div class="sv-cal-month-label">{{ calendarMonthLabel }}</div>
          <button type="button" class="sv-cal-nav-btn" :aria-label="t('calendar.nextMonth')" @click="goToNextMonth">›</button>
        </div>
        <div class="sv-cal-today-row">
          <button type="button" class="sv-btn sv-btn-outline" :disabled="isCurrentMonthShown" @click="goToCurrentMonth">{{ t('calendar.today') }}</button>
        </div>
        <div class="sv-area-row">
          <span class="sv-area-row-label"><svg class="inline-icon" width="16" height="16"><use href="#sv-i-map"/></svg> {{ t('item.area') }}</span>
          <select class="sv-area-select" v-model="calendarAreaFilter">
            <option value="all">{{ t('calendar.areaFilterAll') }}</option>
            <option v-for="a in areaOptions" :key="a.value" :value="a.value">{{ optLabel(a) }}</option>
          </select>
        </div>
        <div class="sv-cal-grid">
          <div v-for="wd in calendarWeekdayLabels" :key="wd" class="sv-cal-weekday">{{ wd }}</div>
          <template v-for="(cell, idx) in calendarCells" :key="idx">
            <div v-if="!cell" class="sv-cal-day sv-cal-day-empty"></div>
            <button v-else type="button" class="sv-cal-day"
                    :class="{ 'is-today': cell.isToday, 'has-events': cell.items.length > 0, 'is-selected': selectedCalendarDate === cell.key }"
                    :disabled="cell.items.length === 0"
                    @click="selectCalendarDay(cell)">
              <span class="sv-cal-day-num">{{ cell.day }}</span>
              <span v-if="cell.items.length" class="sv-cal-day-dot" :style="{ background: calendarSeverityColor(cell.severity) }"></span>
            </button>
          </template>
        </div>
        <div class="sv-cal-legend">
          <span><span class="sv-cal-legend-dot" style="background: var(--red);"></span>{{ t('calendar.legendPast') }}</span>
          <span><span class="sv-cal-legend-dot" style="background: var(--orange);"></span>{{ t('calendar.legendSoon') }}</span>
          <span><span class="sv-cal-legend-dot" style="background: var(--green);"></span>{{ t('calendar.legendLater') }}</span>
        </div>
        <div v-if="selectedCalendarDate && selectedDayItems.length" class="sv-cal-detail">
          <div class="sv-cal-detail-header">{{ selectedCalendarDateLabel }}</div>
          <div v-for="di in selectedDayItems" :key="di.id" class="sv-cal-detail-item">
            <span class="sv-cal-detail-dot"></span>
            <span class="sv-cal-detail-memo">{{ di.memo && di.memo.trim() ? di.memo.trim() : t('export.noMemo') }}</span>
            <span v-if="di.area" class="sv-badge sv-badge-gray">{{ areaLabel(di.area) }}</span>
            <button type="button" class="sv-action-btn sv-action-jump" @click="jumpToListItem(di.id)">{{ t('calendar.jumpToList') }}</button>
          </div>
        </div>
        <div v-else class="sv-cal-hint">{{ t('calendar.noSelection') }}</div>
      </template>
    </template>
  </div>

  <div class="sv-card">
    <div class="sv-card-header sv-card-header-row">
      <span>{{ t('titles.header') }}</span>
      <span class="sv-titles-count">{{ t('titles.countTemplate', { earned: earnedTitleList.length, total: titleChipList.length }) }}</span>
    </div>
    <div class="sv-title-chip-row">
      <span v-for="ti in titleChipList" :key="ti.id" class="sv-title-chip" :class="{ locked: !ti.earned }"
            :title="ti.earned ? t('titles.' + ti.id + '.desc') : t('titles.lockedHint')">
        <span v-html="ti.earned ? ti.icon : '<svg class=inline-icon width=13 height=13><use href=#sv-i-lock /></svg>'"></span> {{ ti.earned ? t('titles.' + ti.id + '.name') : t('titles.lockedName') }}
      </span>
    </div>
  </div>

  <div class="sv-card" ref="listSectionRef">
    <div class="sv-card-header">{{ t('list.header') }}</div>

    <div class="sv-list-toolbar">
      <button type="button" class="sv-btn sv-btn-outline" @click="exportListText">{{ t('export.btn') }}</button>
      <button type="button" class="sv-btn sv-btn-outline" :disabled="activeItemsForIcs.length === 0" @click="exportAllIcs">{{ t('actions.exportAllIcs') }}</button>
      <button type="button" class="sv-btn sv-btn-outline" :class="{ active: bulkMode }" :aria-pressed="bulkMode" @click="toggleBulkMode">{{ bulkMode ? t('bulk.exit') : t('bulk.enter') }}</button>
    </div>

    <div v-if="expiringSoonOnly" class="sv-bulk-bar sv-quick-filter">
      <span>{{ t('quickFilter.expiringSoonNotice') }}</span>
      <button type="button" class="sv-btn sv-btn-fill" @click="clearAllFilters">{{ t('list.clearFilters') }}</button>
    </div>

    <div v-if="bulkMode" class="sv-bulk-bar">
      <span>{{ t('bulk.selectedCount', { n: selectedIds.length }) }}</span>
      <template v-if="confirmBulkDelete">
        <span class="sv-confirm-text">{{ t('bulk.deleteConfirm', { n: selectedIds.length }) }}</span>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button type="button" class="sv-action-btn sv-action-del" @click="bulkDelete">{{ t('actions.delete') }}</button>
          <button type="button" class="sv-action-btn sv-action-susp" @click="confirmBulkDelete = false">{{ t('actions.cancel') }}</button>
        </div>
      </template>
      <div v-else style="display:flex; gap:6px; flex-wrap:wrap;">
        <button type="button" class="sv-btn sv-btn-fill" @click="selectAllVisible">{{ allVisibleSelected ? t('bulk.deselectAll') : t('bulk.selectAll') }}</button>
        <button type="button" class="sv-btn sv-btn-primary" :disabled="selectedIds.length === 0" @click="bulkRePlace"><svg class="inline-icon" width="15" height="15"><use href="#i-sync"/></svg> {{ t('bulk.rePlaceSelected') }}</button>
        <button type="button" class="sv-btn sv-btn-fill" :disabled="selectedIds.length === 0" @click="bulkSuspend"><svg class="inline-icon" width="15" height="15"><use href="#sv-i-box"/></svg> {{ t('bulk.suspendSelected') }}</button>
        <button type="button" class="sv-btn sv-btn-danger" :disabled="selectedIds.length === 0" @click="confirmBulkDelete = true"><svg class="inline-icon" width="15" height="15"><use href="#i-trash"/></svg> {{ t('bulk.deleteSelected') }}</button>
      </div>
    </div>

    <input type="text" v-model="searchQuery" class="sv-search-input" :placeholder="t('list.searchPlaceholder')" :aria-label="t('list.searchPlaceholder')">

    <div class="sv-area-row">
      <span class="sv-area-row-label"><svg class="inline-icon" width="16" height="16"><use href="#sv-i-map"/></svg> {{ t('item.area') }}</span>
      <select class="sv-area-select" v-model="listAreaFilter">
        <option value="all">{{ t('list.areaFilterAll') }}</option>
        <option v-for="a in areaOptions" :key="a.value" :value="a.value">{{ optLabel(a) }}</option>
      </select>
    </div>

    <div class="sv-filter-row">
      <button v-for="f in filterOptions" :key="f.value" class="sv-pill sv-filter-pill"
              :class="{ active: isGenreFilterActive(f.value) }"
              :style="isGenreFilterActive(f.value) ? { background: f.color } : {}"
              :aria-pressed="isGenreFilterActive(f.value)"
              @click="toggleGenreFilter(f.value)">
        {{ optLabel(f) }}
      </button>
      <button type="button" class="sv-btn sv-btn-outline" :disabled="!hasActiveFilters" @click="clearAllFilters">{{ t('list.clearFilters') }}</button>
    </div>

    <div v-if="placedItems.length === 0" class="sv-empty" v-html="t('list.emptyAll')"></div>
    <div v-else-if="sortedPlacedItems.length === 0" class="sv-empty">{{ t('list.emptyFiltered') }}</div>

    <div v-for="item in sortedPlacedItems" :key="item.id" :id="'share-item-card-' + item.id"
         class="sv-item-card" :class="{ 'is-highlighted': highlightedItemId === item.id }">
      <div class="sv-row-flex">
        <input v-if="bulkMode" type="checkbox" class="sv-bulk-checkbox" :checked="isSelected(item.id)" :aria-label="t('bulk.selectItem')" @change="toggleSelected(item.id)">
        <input type="text" v-model="item.memo" :placeholder="t('item.memoPlaceholder')">

        <span v-if="item.isSuspended" class="sv-badge sv-badge-gray"><svg class="inline-icon" width="13" height="13"><use href="#sv-i-box"/></svg> {{ t('badge.suspended') }}</span>
        <span v-else :class="['sv-badge', getDaysLeft(item.placedDate) < 0 ? 'sv-badge-red' : (getDaysLeft(item.placedDate) <= 3 ? 'sv-badge-yellow' : 'sv-badge-green')]">
          {{ getDaysLeft(item.placedDate) < 0 ? t('badge.expired') : (getDaysLeft(item.placedDate) === 0 ? t('badge.dueToday') : t('badge.daysLeft', { n: getDaysLeft(item.placedDate) })) }}
        </span>
      </div>

      <div v-if="item.thumbnail" class="sv-thumb-row">
        <img :src="item.thumbnail" class="sv-thumb" :alt="t('item.thumbnailAlt')">
        <button type="button" class="sv-thumb-remove" :aria-label="t('actions.removePhoto')" @click="removePhoto(item.id)"><svg class="inline-icon" width="13" height="13"><use href="#i-close"/></svg></button>
      </div>

      <div class="sv-genre-selector">
        <button v-for="g in genreOptions" :key="g.value" class="sv-pill sv-genre-pill"
                :class="{ active: isGenreActive(item, g.value) }"
                :style="isGenreActive(item, g.value) ? { background: g.color } : {}"
                :aria-pressed="isGenreActive(item, g.value)"
                @click="toggleItemGenre(item.id, g.value)">
          {{ optLabel(g) }}
        </button>
      </div>

      <div class="sv-area-row">
        <span class="sv-area-row-label"><svg class="inline-icon" width="16" height="16"><use href="#sv-i-map"/></svg> {{ t('item.area') }}</span>
        <select class="sv-area-select" v-model="item.area">
          <option v-for="a in areaOptions" :key="a.value" :value="a.value">{{ optLabel(a) }}</option>
        </select>
      </div>

      <div class="sv-date-inputs">
        <div class="sv-date-box">
          <span style="font-size: 11px;">{{ t('item.placedDate') }}</span>
          <input type="date" :value="formatDateForInput(item.placedDate)" @input="updateItemDate(item.id, $event.target.value)">
        </div>
        <div class="sv-date-box sv-date-box-end">
          <span style="font-size: 11px;">{{ t('item.expiryDate') }}</span>
          <div class="sv-date-val">{{ getExpiryDateString(item.placedDate) }}</div>
        </div>
      </div>

      <div class="sv-action-links">
        <template v-if="confirmDeleteId === item.id">
          <span class="sv-confirm-text">{{ t('actions.deleteConfirm') }}</span>
          <button class="sv-action-btn sv-action-del" @click="removeItem(item.id)">{{ t('actions.delete') }}</button>
          <button class="sv-action-btn sv-action-susp" @click="confirmDeleteId = null">{{ t('actions.cancel') }}</button>
        </template>
        <template v-else>
          <label class="sv-action-btn sv-action-photo">
            <svg class="inline-icon" width="15" height="15"><use href="#sv-i-image"/></svg> {{ item.thumbnail ? t('actions.changePhoto') : t('actions.addPhoto') }}
            <input type="file" accept="image/*" style="display:none" @change="handlePhotoFile($event, item.id)">
          </label>
          <button class="sv-action-btn sv-action-ics" @click="exportItemIcs(item)"><svg class="inline-icon" width="15" height="15"><use href="#i-calendar"/></svg> {{ t('actions.exportIcs') }}</button>
          <button class="sv-action-btn sv-action-renew" @click="rePlaceItem(item.id)"><svg class="inline-icon" width="15" height="15"><use href="#i-sync"/></svg> {{ t('actions.replace') }}</button>
          <button v-if="!item.isSuspended" class="sv-action-btn sv-action-susp" @click="suspendItem(item.id)"><svg class="inline-icon" width="15" height="15"><use href="#sv-i-box"/></svg> {{ t('actions.suspend') }}</button>
          <button class="sv-action-btn sv-action-del" @click="confirmDeleteId = item.id"><svg class="inline-icon" width="15" height="15"><use href="#i-trash"/></svg> {{ t('actions.delete') }}</button>
        </template>
      </div>
    </div>

    <button type="button" class="sv-btn-cta" @click="addItem"><svg class="inline-icon" width="15" height="15"><use href="#sv-i-plus"/></svg> {{ t('actions.addNew') }}</button>
  </div>

  <footer class="sv-footer">
    {{ t('footer.disclaimer') }}<br>
    {{ t('footer.createdBy') }} <a href="https://x.com/Skyzztai" target="_blank" rel="noopener noreferrer" class="sv-footer-credit-link">@Skyzztai</a><br>
    <span class="sv-footer-sub">
      <a href="#/tai-info">{{ t('footer.settingsLink') }}</a>
    </span>
  </footer>
</div>
`;

/* ================================================================
   setup()：元ファイル4732-5408行相当（データ層・カレンダー・称号・
   一括操作・.ics書き出し等）。テーマ/言語/サイドバー/プロフィール表示は
   前述の理由によりここでは扱わない。
   ================================================================ */
function buildSetup(Vue) {
  const { ref, computed, onMounted, watch, nextTick } = Vue;

  return function setup() {
    const placedItems = ref([]);
    const uuid = () => crypto.randomUUID();

    // 🔒 データの読み込み（旧形式からの移行ロジックを含む）
    const load = () => {
      const saved = localStorage.getItem(nsKey('sky_tracker_storage'));
      if (saved) {
        try {
          const decoded = JSON.parse(saved);
          if (Array.isArray(decoded.placedItems)) {
            placedItems.value = decoded.placedItems.reduce((acc, item) => {
              if (!item || typeof item !== 'object') return acc;
              try {
                const { genre, genres, ...rest } = item;
                acc.push({
                  ...rest,
                  placedDate: new Date(item.placedDate),
                  isSuspended: item.isSuspended || false,
                  // 旧データ(単一ジャンル)は配列に変換して引き継ぐ
                  genres: genres || (genre ? [genre] : []),
                  // エリアタグ・サムネイルは後から追加した任意項目のため、
                  // これらを持たない旧データでは明示的に空値を補う
                  area: rest.area || '',
                  thumbnail: rest.thumbnail || null,
                });
              } catch (e) { /* このエントリのみ読み飛ばす */ }
              return acc;
            }, []);
          }
        } catch (e) {
          placedItems.value = [];
        }
      }
    };

    // 💾 データの保存
    const save = () => {
      const saved = localStorage.getItem(nsKey('sky_tracker_storage'));
      let currentData = {};
      if (saved) {
        try { currentData = JSON.parse(saved); } catch (e) { currentData = {}; }
      }
      currentData.placedItems = placedItems.value;
      localStorage.setItem(nsKey('sky_tracker_storage'), JSON.stringify(currentData));
    };

    const getDaysLeft = (placedDate) => {
      const today = new Date();
      const expiry = new Date(placedDate); expiry.setDate(expiry.getDate() + 14);
      const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
      const expiryUTC = Date.UTC(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
      return Math.ceil((expiryUTC - todayUTC) / (1000 * 60 * 60 * 24));
    };

    const getExpiryDateString = (placedDate) => {
      const expiry = new Date(placedDate); expiry.setDate(expiry.getDate() + 14);
      return expiry.toLocaleDateString(CURRENT_LANG === 'en' ? 'en-US' : 'ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    const activeGenres = ref(new Set());
    const isGenreFilterActive = (value) => (value === 'all' ? activeGenres.value.size === 0 : activeGenres.value.has(value));
    const toggleGenreFilter = (value) => {
      if (value === 'all') { activeGenres.value.clear(); return; }
      if (activeGenres.value.has(value)) activeGenres.value.delete(value);
      else activeGenres.value.add(value);
    };

    const listAreaFilter = ref('all');
    const searchQuery = ref('');

    const isGenreActive = (item, value) => {
      if (value === '') return !item.genres || item.genres.length === 0;
      return !!(item.genres && item.genres.includes(value));
    };

    const toggleItemGenre = (id, genre) => {
      const item = placedItems.value.find((i) => i.id === id);
      if (!item) return;
      if (genre === '') { item.genres = []; return; }
      if (!item.genres) item.genres = [];
      const idx = item.genres.indexOf(genre);
      if (idx === -1) item.genres.push(genre);
      else item.genres.splice(idx, 1);
    };

    const expiringSoonOnly = ref(false);

    const filteredPlacedItems = computed(() => {
      let list = placedItems.value;
      if (activeGenres.value.size > 0) {
        const selected = [...activeGenres.value];
        list = list.filter((item) => selected.some((g) => (g === '' ? (!item.genres || item.genres.length === 0) : (item.genres && item.genres.includes(g)))));
      }
      if (listAreaFilter.value !== 'all') list = list.filter((item) => (item.area || '') === listAreaFilter.value);
      if (expiringSoonOnly.value) list = list.filter((item) => !item.isSuspended && getDaysLeft(item.placedDate) >= 0 && getDaysLeft(item.placedDate) <= 3);
      const q = searchQuery.value.trim().toLowerCase();
      if (q) list = list.filter((item) => (item.memo || '').toLowerCase().includes(q));
      return list;
    });

    const hasActiveFilters = computed(() => activeGenres.value.size > 0 || listAreaFilter.value !== 'all' || searchQuery.value.trim() !== '' || expiringSoonOnly.value);
    const clearAllFilters = () => {
      activeGenres.value.clear();
      listAreaFilter.value = 'all';
      searchQuery.value = '';
      expiringSoonOnly.value = false;
    };

    const sortedPlacedItems = computed(() => [...filteredPlacedItems.value].sort((a, b) => {
      if (a.isSuspended && !b.isSuspended) return 1;
      if (!a.isSuspended && b.isSuspended) return -1;
      if (a.isSuspended && b.isSuspended) return 0;
      return getDaysLeft(a.placedDate) - getDaysLeft(b.placedDate);
    }));

    const stats = computed(() => {
      let active = 0; let warning = 0; let pending = 0; let expired = 0;
      placedItems.value.forEach((item) => {
        if (item.isSuspended) { pending++; } else {
          const days = getDaysLeft(item.placedDate);
          if (days < 0) expired++;
          else if (days <= 3) warning++;
          else active++;
        }
      });
      return { active, warning, pending, expired };
    });

    const formatDateForInput = (date) => {
      if (!date || isNaN(date.getTime())) return '';
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const updateItemDate = (id, dateString) => {
      if (!dateString) return;
      const item = placedItems.value.find((i) => i.id === id);
      if (item) {
        const [year, month, day] = dateString.split('-').map(Number);
        item.placedDate = new Date(year, month - 1, day);
      }
    };

    // 🏆 称号(実績)。累計追加数(lifetimeCreated)はハイウォーターマークで
    // 一方向にしか増やさない(削除しても減らない)
    const titlesData = ref({ lifetimeCreated: 0, earned: [] });
    const titleToasts = ref([]);
    let titleToastSeq = 0;

    const loadTitles = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(nsKey(TITLES_KEY)));
        if (saved && typeof saved === 'object') {
          titlesData.value = {
            lifetimeCreated: Number(saved.lifetimeCreated) || 0,
            earned: Array.isArray(saved.earned) ? saved.earned : [],
          };
        }
      } catch (e) { /* noop */ }
    };
    const saveTitles = () => { localStorage.setItem(nsKey(TITLES_KEY), JSON.stringify(titlesData.value)); };

    const earnedTitleList = computed(() => {
      const earnedIds = new Set(titlesData.value.earned.map((e) => e.id));
      return TITLES.filter((ti) => earnedIds.has(ti.id));
    });
    const titleChipList = computed(() => {
      const earnedIds = new Set(titlesData.value.earned.map((e) => e.id));
      return TITLES.map((ti) => ({ ...ti, earned: earnedIds.has(ti.id) }));
    });

    const showTitleToast = (title) => {
      const seq = ++titleToastSeq;
      titleToasts.value.push({ seq, icon: title.icon, name: t('titles.' + title.id + '.name') });
      setTimeout(() => {
        const idx = titleToasts.value.findIndex((tt2) => tt2.seq === seq);
        if (idx !== -1) titleToasts.value.splice(idx, 1);
      }, 3600);
    };

    const checkTitles = () => {
      const earnedIds = new Set(titlesData.value.earned.map((e) => e.id));
      TITLES.forEach((title) => {
        if (titlesData.value.lifetimeCreated >= title.threshold && !earnedIds.has(title.id)) {
          titlesData.value.earned.push({ id: title.id, earnedAt: new Date().toISOString() });
          earnedIds.add(title.id);
          showTitleToast(title);
        }
      });
    };

    const bumpLifetimeCreated = () => {
      titlesData.value.lifetimeCreated += 1;
      checkTitles();
      saveTitles();
    };

    const addItem = () => {
      placedItems.value.push({ id: uuid(), memo: '', placedDate: new Date(), isSuspended: false, genres: [], area: '', thumbnail: null });
      bumpLifetimeCreated();
    };

    const confirmDeleteId = ref(null);
    const removeItem = (id) => {
      const idx = placedItems.value.findIndex((i) => i.id === id);
      if (idx !== -1) placedItems.value.splice(idx, 1);
      if (confirmDeleteId.value === id) confirmDeleteId.value = null;
      const selIdx = selectedIds.value.indexOf(id);
      if (selIdx !== -1) selectedIds.value.splice(selIdx, 1);
    };

    const rePlaceItem = (id) => { const item = placedItems.value.find((i) => i.id === id); if (item) { item.placedDate = new Date(); item.isSuspended = false; } };
    const suspendItem = (id) => { const item = placedItems.value.find((i) => i.id === id); if (item) item.isSuspended = true; };

    // 📷 写真サムネイル添付：FileReaderで読み込み→<canvas>に縮小して描画→
    // toDataURL('image/png')でdata URI化（最大辺MAX_THUMB_DIMに縮小）
    const handlePhotoFile = (e, id) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(MAX_THUMB_DIM / img.width, MAX_THUMB_DIM / img.height, 1);
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const item = placedItems.value.find((i) => i.id === id);
          if (item) item.thumbnail = canvas.toDataURL('image/png');
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    };
    const removePhoto = (id) => { const item = placedItems.value.find((i) => i.id === id); if (item) item.thumbnail = null; };

    // ☑️ 一括操作（選択して今日再設置・保留・削除）
    const bulkMode = ref(false);
    const selectedIds = ref([]);
    const toggleBulkMode = () => {
      bulkMode.value = !bulkMode.value;
      if (!bulkMode.value) { selectedIds.value = []; confirmBulkDelete.value = false; }
    };
    const isSelected = (id) => selectedIds.value.includes(id);
    const toggleSelected = (id) => {
      const idx = selectedIds.value.indexOf(id);
      if (idx === -1) selectedIds.value.push(id);
      else selectedIds.value.splice(idx, 1);
    };
    const allVisibleSelected = computed(() => sortedPlacedItems.value.length > 0 && sortedPlacedItems.value.every((i) => selectedIds.value.includes(i.id)));
    const selectAllVisible = () => {
      const visibleIds = sortedPlacedItems.value.map((i) => i.id);
      selectedIds.value = allVisibleSelected.value ? [] : visibleIds.slice();
    };
    const bulkRePlace = () => {
      selectedIds.value.forEach((id) => {
        const item = placedItems.value.find((i) => i.id === id);
        if (item) { item.placedDate = new Date(); item.isSuspended = false; }
      });
      selectedIds.value = [];
      bulkMode.value = false;
      expiringSoonOnly.value = false;
    };

    const confirmBulkDelete = ref(false);
    const bulkSuspend = () => {
      selectedIds.value.forEach((id) => suspendItem(id));
      selectedIds.value = [];
      bulkMode.value = false;
      expiringSoonOnly.value = false;
    };
    const bulkDelete = () => {
      [...selectedIds.value].forEach((id) => removeItem(id));
      selectedIds.value = [];
      bulkMode.value = false;
      confirmBulkDelete.value = false;
      expiringSoonOnly.value = false;
    };

    const listSectionRef = ref(null);
    const focusExpiringSoon = () => {
      const targetIds = placedItems.value
        .filter((item) => !item.isSuspended && getDaysLeft(item.placedDate) >= 0 && getDaysLeft(item.placedDate) <= 3)
        .map((item) => item.id);
      if (targetIds.length === 0) return;
      activeGenres.value.clear();
      listAreaFilter.value = 'all';
      searchQuery.value = '';
      expiringSoonOnly.value = true;
      bulkMode.value = true;
      selectedIds.value = targetIds;
      nextTick(() => {
        if (listSectionRef.value && listSectionRef.value.scrollIntoView) {
          listSectionRef.value.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    };

    // 📅 .ics書き出し（RFC5545最低限フィールド＋前日通知のVALARM）
    const icsEscape = (s) => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    const icsDateStamp = (d) => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    const downloadTextFile = (filename, mime, content) => {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    };
    const buildIcsVevent = (item) => {
      const expiry = new Date(item.placedDate);
      expiry.setDate(expiry.getDate() + 14);
      expiry.setHours(0, 0, 0, 0);
      const dtEnd = new Date(expiry);
      dtEnd.setDate(dtEnd.getDate() + 1);
      const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const memo = item.memo && item.memo.trim() ? item.memo.trim() : t('ics.summaryFallback');
      const lines = [
        'BEGIN:VEVENT',
        'UID:' + item.id + '@share.taipak5000.github.io',
        'DTSTAMP:' + dtStamp,
        'DTSTART;VALUE=DATE:' + icsDateStamp(expiry),
        'DTEND;VALUE=DATE:' + icsDateStamp(dtEnd),
        'SUMMARY:' + icsEscape(t('ics.summary', { memo })),
        'DESCRIPTION:' + icsEscape(t('ics.description')),
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        'DESCRIPTION:' + icsEscape(t('ics.summary', { memo })),
        'TRIGGER:-P1D',
        'END:VALARM',
        'END:VEVENT',
      ];
      return { lines, expiry };
    };

    const exportItemIcs = (item) => {
      const { lines: veventLines, expiry } = buildIcsVevent(item);
      const lines = [
        'BEGIN:VCALENDAR', 'VERSION:2.0',
        'PRODID:-//taipak5000.github.io//share//' + (CURRENT_LANG === 'en' ? 'EN' : 'JA'),
        'CALSCALE:GREGORIAN', ...veventLines, 'END:VCALENDAR',
      ];
      downloadTextFile('sky-creation-expiry_' + icsDateStamp(expiry) + '.ics', 'text/calendar;charset=utf-8', lines.join('\r\n'));
    };

    const activeItemsForIcs = computed(() => placedItems.value.filter((item) => !item.isSuspended));
    const exportAllIcs = () => {
      const targets = activeItemsForIcs.value;
      if (targets.length === 0) return;
      const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//taipak5000.github.io//share//' + (CURRENT_LANG === 'en' ? 'EN' : 'JA'), 'CALSCALE:GREGORIAN'];
      targets.forEach((item) => { lines.push(...buildIcsVevent(item).lines); });
      lines.push('END:VCALENDAR');
      downloadTextFile('sky-creation-expiry-all_' + icsDateStamp(new Date()) + '.ics', 'text/calendar;charset=utf-8', lines.join('\r\n'));
    };

    const exportListText = () => {
      const lines = [t('export.header'), t('export.exportedAt') + ': ' + new Date().toLocaleString(CURRENT_LANG === 'en' ? 'en-US' : 'ja-JP'), ''];
      const list = [...placedItems.value].sort((a, b) => getDaysLeft(a.placedDate) - getDaysLeft(b.placedDate));
      list.forEach((item, idx) => {
        const genreLabels = (item.genres && item.genres.length)
          ? item.genres.map((g) => { const opt = GENRE_OPTIONS.find((o) => o.value === g); return opt ? optLabel(opt) : g; }).join(', ')
          : optLabel(GENRE_OPTIONS[0]);
        const status = item.isSuspended
          ? t('badge.suspended')
          : (getDaysLeft(item.placedDate) < 0 ? t('badge.expired') : (getDaysLeft(item.placedDate) === 0 ? t('badge.dueToday') : t('badge.daysLeft', { n: getDaysLeft(item.placedDate) })));
        lines.push((idx + 1) + '. ' + (item.memo && item.memo.trim() ? item.memo.trim() : t('export.noMemo')));
        lines.push('   ' + t('export.genreLabel') + ': ' + genreLabels);
        if (item.area) lines.push('   ' + t('export.areaLabel') + ': ' + areaLabel(item.area));
        lines.push('   ' + t('item.placedDate') + ': ' + formatDateForInput(item.placedDate));
        lines.push('   ' + t('item.expiryDate') + ': ' + getExpiryDateString(item.placedDate));
        lines.push('   ' + t('export.statusLabel') + ': ' + status);
        lines.push('');
      });
      downloadTextFile('sky-creation-list_' + icsDateStamp(new Date()) + '.txt', 'text/plain;charset=utf-8', lines.join('\n'));
    };

    // 📅 画面上の消滅カレンダー（月グリッド）
    const dateKeyOf = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const parseDateKey = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };

    const calendarAreaFilter = ref('all');

    const expiryByDate = computed(() => {
      const map = {};
      placedItems.value.forEach((item) => {
        if (item.isSuspended) return;
        if (calendarAreaFilter.value !== 'all' && (item.area || '') !== calendarAreaFilter.value) return;
        const expiry = new Date(item.placedDate);
        expiry.setDate(expiry.getDate() + 14);
        expiry.setHours(0, 0, 0, 0);
        const key = dateKeyOf(expiry);
        if (!map[key]) map[key] = [];
        map[key].push(item);
      });
      return map;
    });
    const hasAnyCalendarEvents = computed(() => placedItems.value.some((item) => !item.isSuspended));

    const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
    const calendarMonthCursor = ref(startOfMonth(new Date()));
    const calendarMonthLabel = computed(() => calendarMonthCursor.value.toLocaleDateString(CURRENT_LANG === 'en' ? 'en-US' : 'ja-JP', { year: 'numeric', month: 'long' }));
    const calendarWeekdayLabels = computed(() => {
      const loc = CURRENT_LANG === 'en' ? 'en-US' : 'ja-JP';
      return Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 1 + i).toLocaleDateString(loc, { weekday: 'short' }));
    });
    const isCurrentMonthShown = computed(() => {
      const now = new Date();
      return calendarMonthCursor.value.getFullYear() === now.getFullYear() && calendarMonthCursor.value.getMonth() === now.getMonth();
    });
    const goToPrevMonth = () => {
      const d = calendarMonthCursor.value;
      calendarMonthCursor.value = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      selectedCalendarDate.value = null;
    };
    const goToNextMonth = () => {
      const d = calendarMonthCursor.value;
      calendarMonthCursor.value = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      selectedCalendarDate.value = null;
    };
    const goToCurrentMonth = () => { calendarMonthCursor.value = startOfMonth(new Date()); selectedCalendarDate.value = null; };

    // 折りたたみ状態はプロフィールごとの好みとして永続化する
    const calendarCollapsed = ref(localStorage.getItem(nsKey('sky_share_calendar_collapsed')) === '1');
    const toggleCalendarCollapsed = () => {
      calendarCollapsed.value = !calendarCollapsed.value;
      localStorage.setItem(nsKey('sky_share_calendar_collapsed'), calendarCollapsed.value ? '1' : '0');
    };

    const calendarCells = computed(() => {
      const monthStart = calendarMonthCursor.value;
      const year = monthStart.getFullYear(); const month = monthStart.getMonth();
      const firstWeekday = monthStart.getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayKey = dateKeyOf(today);
      const cells = [];
      for (let i = 0; i < firstWeekday; i++) cells.push(null);
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const key = dateKeyOf(date);
        const items = expiryByDate.value[key] || [];
        let severity = 'none';
        if (items.length) {
          const diffDays = Math.round((date - today) / (1000 * 60 * 60 * 24));
          severity = diffDays < 0 ? 'past' : (diffDays <= 3 ? 'soon' : 'later');
        }
        cells.push({ key, day, items, severity, isToday: key === todayKey });
      }
      return cells;
    });
    const calendarSeverityColor = (severity) => {
      if (severity === 'past') return 'var(--red)';
      if (severity === 'soon') return 'var(--orange)';
      if (severity === 'later') return 'var(--green)';
      return 'transparent';
    };

    const selectedCalendarDate = ref(null);
    const selectCalendarDay = (cell) => {
      if (!cell || !cell.items.length) return;
      selectedCalendarDate.value = selectedCalendarDate.value === cell.key ? null : cell.key;
    };
    const selectedDayItems = computed(() => (selectedCalendarDate.value ? (expiryByDate.value[selectedCalendarDate.value] || []) : []));
    const selectedCalendarDateLabel = computed(() => {
      if (!selectedCalendarDate.value) return '';
      return parseDateKey(selectedCalendarDate.value).toLocaleDateString(CURRENT_LANG === 'en' ? 'en-US' : 'ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
    });
    // エリアで絞り込むと選択中の日付に該当項目が無くなり得るため、月移動時と同様にリセットする
    watch(calendarAreaFilter, () => { selectedCalendarDate.value = null; });

    // 📅➡📍 カレンダー日別詳細の「一覧で見る」
    const highlightedItemId = ref(null);
    let highlightTimer = null;
    const jumpToListItem = (id) => {
      clearAllFilters();
      highlightedItemId.value = id;
      if (highlightTimer) clearTimeout(highlightTimer);
      highlightTimer = setTimeout(() => { highlightedItemId.value = null; }, 2500);
      nextTick(() => {
        const el = document.getElementById('share-item-card-' + id);
        if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    };

    onMounted(() => {
      load();
      // 🏆 称号の読み込み。導入前から創作物を追加していたユーザーのため、
      // 現在の設置数を下回らないようハイウォーターマークを引き上げる
      loadTitles();
      if (placedItems.value.length > titlesData.value.lifetimeCreated) {
        titlesData.value.lifetimeCreated = placedItems.value.length;
      }
      checkTitles();
      saveTitles();
    });

    watch(placedItems, () => { save(); }, { deep: true });

    return {
      t, optLabel,
      placedItems, sortedPlacedItems, stats, getDaysLeft, getExpiryDateString, formatDateForInput,
      updateItemDate, addItem, removeItem, rePlaceItem, suspendItem, confirmDeleteId,
      genreOptions: GENRE_OPTIONS, filterOptions: FILTER_OPTIONS, activeGenres, isGenreFilterActive, toggleGenreFilter, isGenreActive, toggleItemGenre, searchQuery,
      hasActiveFilters, clearAllFilters,
      areaOptions: AREA_OPTIONS, areaLabel, listAreaFilter,
      bulkMode, selectedIds, toggleBulkMode, isSelected, toggleSelected, allVisibleSelected, selectAllVisible, bulkRePlace,
      confirmBulkDelete, bulkSuspend, bulkDelete,
      expiringSoonOnly, focusExpiringSoon, listSectionRef,
      exportItemIcs, exportListText, exportAllIcs, activeItemsForIcs,
      handlePhotoFile, removePhoto,
      earnedTitleList, titleChipList, titleToasts,
      hasAnyCalendarEvents, calendarMonthLabel, calendarWeekdayLabels, calendarCells, calendarSeverityColor,
      isCurrentMonthShown, goToPrevMonth, goToNextMonth, goToCurrentMonth,
      selectedCalendarDate, selectCalendarDay, selectedDayItems, selectedCalendarDateLabel,
      calendarCollapsed, toggleCalendarCollapsed,
      calendarAreaFilter, highlightedItemId, jumpToListItem,
    };
  };
}

/* ================================================================
   公開API
   ================================================================ */
let app = null;
let mountToken = 0;

export async function mount(container) {
  const myToken = ++mountToken;
  injectStylesheet();
  injectLocalIconSprite();

  await ensureVue();
  // Vueの読み込み待ち中に別ルートへ遷移/unmountされていたら何もしない
  if (myToken !== mountToken) return;

  container.innerHTML = '<div id="share-vue-root"></div>';

  const Vue = window.Vue;
  app = Vue.createApp({
    setup: buildSetup(Vue),
    template: TEMPLATE,
  });
  app.mount('#share-vue-root');
}

export function unmount() {
  mountToken++; // 進行中のmount()（Vue読み込み待ち等）を無効化
  if (app) {
    app.unmount();
    app = null;
  }
}

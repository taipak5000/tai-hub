/* ================================================================
   wings（羽トラッカー）のtai-hub移植版。公開面は mount(container, sub)/
   unmount() の2関数のみ（js/router.js からマウントされる。wingsは元々
   サブルートを持たない単一ページのため sub は無視する）。

   移植元: wings/index.html （~6010行のスタンドアロンページ）のうち、
   共有chrome（site-dock/pf-modal/dash-modal/tools-drawer/サイドバー・
   nsKey/nsKeyFor・テーマ/言語/ショートカット・データエクスポート等）を
   除いた「このツール自身」の部分：通知バナー・合計サマリー・ケープ
   レベルカード・称号パネル・Xへ画像共有・季節精霊/恒常精霊/光の子の
   各チェックリスト（検索・フィルター・季節ジャンプ・一括選択/リセット
   込み）・「今日・今週・今月」ダッシュボードの呼び出し。

   localStorageの読み書き・純粋な計算は wings-state.js に、Xへの画像共有は
   wings-share.js に、静的データは data/ 以下に分けている。

   【意図的な簡略化・アダプテーション（元の挙動を変えない範囲の adaptation）】
   - プロフィール切替バー(pf-bar)・プロフィール比較・データのバックアップ/
     インポート/削除・ホーム画面アイコンカスタマイズ・表示設定（テーマ/
     言語/ショートカット）は、tai-hubの共有chrome（js/chrome/pf-modal.js・
     settings-modal.js等）が既に同等の機能を提供しているため移植して
     いない（nomacan-view.js等、既存の移植済みツールと同じ判断）。
   - 「今日・今週・今月」ダッシュボードは features/shared/event-dashboard.js
     （wings自身のpfDash系・pfReminder系一式を抽出した共有モジュール）を
     mountして使う（後述の理由でこのファイル自身はロジックを持たない）。
   - モーダル（ダッシュボード・共有カスタマイズ・画像プレビュー）は元の
     ドラッグ物理演算つきボトムシートではなく、tai-hubの他のモーダルと
     同じ「.modal-overlay/.modal-card + open クラスでのフェード/スライド」
     方式に統一した（nomacan-view.js等の既存移植と同じ簡略化）。
   - 季節精霊/恒常精霊リスト（.spirit-opt）の↑↓キーでのハイライト移動
     （kbNavMove相当）は移植済み（後述のkbNavGetTargets/kbNavMove）。
     一方、光の子タイルの矢印キーでのグリッドナビゲーション（←→での
     移動）は移植していない（他の移植済みツールにも同等の実装が無く、
     今回のスコープでは見送り。Tab/Enter/Spaceでのキーボード操作自体は
     onLightChildrenListKeydownにより通常通り機能する）。
   - 確認ダイアログ（showConfirmModal）はポップアップブロック対策の
     カスタムモーダルだったが、tai-hubの他のモーダル(pf-modal.js等)が
     いずれも標準の confirm() で済ませている方針に合わせ、同じ水準にした
     （光の子の「全リセット」「全エリア取得済みにする」の2箇所のみ対象）。
   ================================================================ */

import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { getActiveProfileId, ensureProfilesInit, pfDisplayName } from '../../js/state.js';
import { SEASON_SPIRITS } from './data/season-spirits.js';
import { REALM_SPIRITS, CAPE_LEVELS } from './data/realm-spirits.js';
import { LIGHT_CHILDREN } from './data/light-children.js';
import { TITLES } from './data/titles.js';
import * as S from './wings-state.js';
import * as Share from './wings-share.js';
import * as eventDashboard from '../shared/event-dashboard.js';

const STYLE_LINK_ID = 'wings-view-styles';
const ICON_SPRITE_ID = 'wings-icon-sprite';

function t(ja, en) { return CURRENT_LANG === 'en' ? en : ja; }
// { ja, en } 形式のオブジェクトから現在の表示言語の文字列を返す（元実装のL()相当）
function L(obj) {
  if (!obj) return '';
  if (CURRENT_LANG === 'en' && obj.en) return obj.en;
  return obj.ja;
}
function escapeAttr(s) { return String(s).replace(/'/g, '&#39;'); }

let containerEl = null; // .wings-view ラッパー（mount()のたびに作り直す）
let boundKbNavKeydown = null; // document直付けの矢印キーリスナー（unmount()で必ず外す）
let kbNavIndex = -1; // 季節精霊/恒常精霊リストの↑↓ハイライト位置（-1=未選択）

/* ── フィルター/検索/開閉のUI状態（ページを開き直すまで維持。localStorageへは保存しない） ── */
let seasonFilterUnowned = false;
let permFilterUnowned = false;
let lightChildrenFilterUnowned = false;
let spiritSearchQuery = '';
const seasonCollapsedIds = new Set();
let currentTitlesLoaded = null; // checkAndUnlockTitles()の新規解除トースト表示用に一時保持

/* ================================================================
   公開API
   ================================================================ */
export function mount(container /* , sub */) {
  injectStylesheet();
  injectLocalIconSprite();

  container.innerHTML = renderShell();
  containerEl = container.querySelector('.wings-view');
  wireEvents();

  boundKbNavKeydown = handleKbNavKeydown;
  document.addEventListener('keydown', boundKbNavKeydown);

  S.recordCompletionSnapshotIfNeeded();
  render();
}

export function unmount() {
  document.getElementById('wgDashModalOverlay')?.remove();
  document.getElementById('wgCompareModalOverlay')?.remove();
  eventDashboard.unmount();
  Share.closeCustomize();
  document.getElementById('wingsShareModalOverlay')?.remove();
  document.getElementById('wingsSharePreviewOverlay')?.remove();
  if (boundKbNavKeydown) { document.removeEventListener('keydown', boundKbNavKeydown); boundKbNavKeydown = null; }
  kbNavReset();
  containerEl = null;
}

function injectStylesheet() {
  if (document.getElementById(STYLE_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_LINK_ID;
  link.rel = 'stylesheet';
  link.href = new URL('../../css/wings.css', import.meta.url).href;
  document.head.appendChild(link);
}

// tai-hub共有の#pf-icon-sprite(js/icon-sprite.js)には無い、このツールだけで使う
// アイコン（i-flashlight）だけを wg-i- プレフィックスで追加注入する
// （js/icon-sprite.js自体は他エージェントが並行編集中のため触らない。share-view.js/
// nomacan-view.jsの「ローカルスプライト」パターンを踏襲）。
const WG_SPRITE_HTML = `
<svg id="${ICON_SPRITE_ID}" style="position:absolute;width:0;height:0;overflow:hidden;" aria-hidden="true"><defs>
<symbol id="wg-i-flashlight" viewBox="0 0 24 24"><path d="M9 4h6l1.5 2.5v3l-1.5 1.5v9a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-9L7.5 9.5v-3Z"/><path d="M9.5 4V2.5h5V4"/></symbol>
</defs></svg>`;
function injectLocalIconSprite() {
  if (document.getElementById(ICON_SPRITE_ID)) return;
  document.body.insertAdjacentHTML('afterbegin', WG_SPRITE_HTML);
}

/* ================================================================
   静的シェル（データに依存しない部分）。動的部分はrender()がinnerHTMLで埋める。
   ================================================================ */
function renderShell() {
  return `
  <div class="wings-view">
   <div class="wg-wrap">
    <header class="tool-nav-head"><h1><svg class="inline-icon" width="19" height="19"><use href="#i-wing"/></svg> ${t('羽トラッカー', 'Wing Tracker')}</h1></header>
    <div class="wg-dash-trigger-row">
      <button type="button" class="wg-dash-trigger-btn" id="wgOpenDashBtn">
        <svg class="inline-icon" width="15" height="15"><use href="#i-calendar"/></svg>
        ${t('今日・今週・今月', 'Today / This Week / This Month')}
      </button>
    </div>

    <div class="notice-card">
      ${t(
        '精霊が再訪してきたとき、その精霊から初回だけもらえる<b>光の翼</b>（星のキャンドル2本消費）を、季節・精霊ごとにチェックして記録します。地方に隠れている光の子を見つけた場合も、光の子1体につき光の翼1枚がもらえます。<br>また、原罪に行って転生すると、精霊に配った枚数とは別に光の翼が1枚加算されるため、下のケープレベルの計算にはこの分を+1して反映しています。',
        'Track the <b>Winged Light</b> you receive the first time a Revisit Spirit returns (costs 2 Star Candles), checked off by season and spirit. Finding a hidden Child of Light in a realm also grants 1 Winged Light each.<br>Also, reincarnating at Eye of Eden adds 1 more Winged Light on top of what you\'ve given to Spirits, so the Cape Level calculation below includes this +1.',
      )}
    </div>

    <div class="summary-card">
      <div class="summary-title">${t('光の翼の合計', 'Total Winged Light')}</div>
      <div class="summary-grid">
        <div>
          <div class="summary-item-label">${t('もらった光の翼（合計）', 'Winged Light received (total)')}</div>
          <div class="summary-item-value" id="wgSumFeathersAll">0</div>
          <div class="summary-item-sub" id="wgSumFeathersAllSub"></div>
        </div>
        <div>
          <div class="summary-item-label">${t('翼に使った星のキャンドル', 'Star Candles spent on wings')}</div>
          <div class="summary-item-value" id="wgSumCandles">0</div>
          <div class="summary-item-sub">${t('光の翼1枚 = 星のキャンドル2本（季節精霊の場合）', '1 Winged Light = 2 Star Candles (for Seasonal Spirits)')}</div>
        </div>
      </div>
    </div>

    <div class="cape-card">
      <div class="cape-card-title">${t('ケープレベル', 'Cape Level')}</div>
      <div class="cape-card-sub" id="wgCapeSummary"></div>
      <div class="cape-level-label" id="wgCapeLevelLabel"></div>
      <div class="cape-pips" id="wgCapePips"></div>
    </div>

    <div class="titles-card">
      <div class="titles-card-head">
        <div class="titles-card-title">${t('称号', 'Titles')}</div>
        <span class="titles-count" id="wgTitlesCount">0 / 0</span>
      </div>
      <div class="titles-chips" id="wgTitlesChips"></div>
    </div>

    <div class="share-btn-row">
      <button type="button" class="share-btn customize" id="wgCompareBtn">${t('プロフィールを比較', 'Compare Profiles')}</button>
    </div>

    <div class="share-btn-row">
      <button type="button" class="share-btn twitter" id="wgShareXBtn">${t('Xで画像を共有', 'Share image on X')}</button>
      <button type="button" class="share-btn customize" id="wgShareCustomizeBtn">${t('カスタマイズして共有', 'Customize & share')}</button>
    </div>

    <div class="mode-tabs">
      <button type="button" class="mode-tab active" id="wgTabWings" data-mode="wings">${t('精霊の羽', 'Spirit Wings')}</button>
      <button type="button" class="mode-tab" id="wgTabLightChildren" data-mode="lightChildren">${t('光の子', 'Children of Light')}</button>
    </div>

    <div class="spirit-search-row">
      <input type="text" class="pf-input" id="wgSearchInput" placeholder="${escapeAttr(t('精霊の名前で検索...', 'Search by spirit name...'))}">
      <button type="button" class="pf-icon-btn" id="wgSearchClearBtn" style="display:none;" title="${escapeAttr(t('検索をクリア', 'Clear search'))}"><svg class="inline-icon" width="13" height="13"><use href="#i-close"/></svg></button>
    </div>
    <div style="display:flex; justify-content:flex-end; margin-top:8px;">
      <button type="button" class="filter-toggle-btn" id="wgClearAllFiltersBtn" style="display:none;"><svg class="inline-icon" width="13" height="13"><use href="#i-close"/></svg> ${t('フィルターを全てクリア', 'Clear all filters')}</button>
    </div>

    <div id="wgWingsMode">
      <p class="sec-label">${t('季節ごとの精霊一覧', 'Seasonal Spirits by Season')}</p>
      <div class="sticky-section">
        <div class="notice-card sticky-notice" id="wgSeasonStickyNotice">
          <div class="notice-head">
            <span>${t('季節精霊・再訪の光の翼: ', 'Seasonal Spirits · Revisit Winged Light: ')}<b id="wgSumFeathersSeason">0 / 0</b>${t('体分', '')}</span>
            <button type="button" class="filter-toggle-btn" id="wgSeasonFilterBtn">${t('未取得のみ表示', 'Show unowned only')}</button>
          </div>
          <div class="season-jump-row">
            <label for="wgSeasonJumpSelect" class="season-jump-label"><svg class="inline-icon" width="14" height="14"><use href="#i-search"/></svg> ${t('季節へジャンプ', 'Jump to season')}</label>
            <select class="pf-input season-jump-select" id="wgSeasonJumpSelect">
              <option value="">${t('選択してください', 'Select a season...')}</option>
              ${SEASON_SPIRITS.map((entry, i) => `<option value="${i}">${escapeHtml(L(entry.season))}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="wgSeasonList"></div>
      </div>

      <div class="notice-card" style="margin-top:16px;">
        ${t(
          '砕ケル闇ノ季節・復古の季節・ムーミンの季節・巣づくりの季節は、通常の季節精霊ではなく「季節の存在」（マネキンや展示場など）が再訪の対象です。名前の誤りや抜け漏れがあれば教えてください。',
          'For the Season of Shattering, Season of Revival, Season of Moomin, and Season of Nesting, the Revisit target is a "seasonal entity" (like a mannequin or display) rather than a normal Seasonal Spirit. Please let us know if any names are wrong or missing.',
        )}
      </div>

      <p class="sec-label">${t('恒常精霊のツリー（地方の精霊）', 'Regular Spirit Trees (Realm Spirits)')}</p>
      <div class="sticky-section">
        <div class="notice-card sticky-notice">
          <span>${t(
            '各地方の恒常精霊37体には友情ツリーの光の翼（Tier1）が1つずつ、うち12体には追加のTier2の光の翼もあります。開放に必要な星のキャンドルの本数は精霊ごとに異なります。',
            'Each of the 37 Regular Spirits across the realms has one Winged Light on its friendship tree (Tier 1); 12 of them also have an additional Tier 2 Winged Light. The number of Star Candles needed to unlock each varies by spirit.',
          )}</span><br>
          <div class="notice-head">
            <span><b id="wgSumFeathersPerm">0 / 49</b>${t('枚 開放済み ／ 使った星のキャンドル ', ' unlocked / Star Candles used: ')}<b id="wgSumPermCandles">0</b>${t('本', '')}</span>
            <button type="button" class="filter-toggle-btn" id="wgPermFilterBtn">${t('未取得のみ表示', 'Show unowned only')}</button>
          </div>
        </div>
        <div id="wgRealmList"></div>
      </div>
    </div>

    <div id="wgLightChildrenMode" style="display:none;">
      <p class="sec-label">${t('地方ごとの光の子一覧', 'Children of Light by Realm')}</p>
      <div class="sticky-section">
        <div class="notice-card sticky-notice">
          <span>${t(
            '光の子1体につき光の翼1枚がもらえます（星のキャンドルは不要）。地方ごと・場所ごとにチェックしてください。',
            'Each Child of Light grants 1 Winged Light (no Star Candles needed). Check them off by realm and location.',
          )}</span><br>
          <div class="notice-head">
            <span><b id="wgSumLightChildren">0 / 124</b>${t('体 発見済み', ' found')}</span>
            <span style="display:flex; gap:8px; flex-wrap:wrap;">
              <button type="button" class="filter-toggle-btn" id="wgLightChildrenFilterBtn">${t('未取得のみ表示', 'Show unowned only')}</button>
              <button type="button" class="filter-toggle-btn success" id="wgMarkAllLcBtn">${t('光の子を全エリア取得済みにする', 'Mark all areas found')}</button>
              <button type="button" class="filter-toggle-btn danger" id="wgResetAllLcBtn">${t('光の子を全リセット', 'Reset all Children of Light')}</button>
            </span>
          </div>
        </div>
        <div id="wgLightChildrenList"></div>
      </div>
    </div>
   </div>
   <footer style="text-align:center; padding:24px 16px; color:var(--hub-text-2); font-size:13px; border-top:1px solid var(--hub-sep); margin-top:40px; line-height:1.6;">
     <span>${t('このサイトはSky 星を紡ぐ子どもたちの非公式ファンサイトです。thatgamecompanyは一切関与していません。', 'This is an unofficial fan site for Sky: Children of the Light. thatgamecompany is not involved in any way.')}</span><br>
     <span>${t('作成・ご意見:', 'Created by / feedback:')}</span> <a href="https://x.com/Skyzztai" target="_blank" rel="noopener noreferrer" style="color:var(--hub-accent); font-weight:bold;">@Skyzztai</a>　／　<a href="https://odaibako.net/u/Skyzztai" target="_blank" rel="noopener noreferrer" style="color:var(--hub-accent); font-weight:bold;">${t('リクエストフォーム', 'Request form')}</a><br>
     <span style="font-size:12px; margin-top:4px; display:inline-block;">
       <span>${t('参考:', 'References:')}</span>
       <a href="https://sky-children-of-the-light.fandom.com/ja/wiki/%E6%97%85%E3%81%99%E3%82%8B%E7%B2%BE%E9%9C%8A" target="_blank" rel="noopener noreferrer" style="color: var(--hub-accent);">${t('旅する精霊 (Sky Wiki 日本語)', 'Traveling Spirits (Sky Wiki Japanese)')}</a>
       ／
       <a href="https://sky-children-of-the-light.fandom.com/wiki/Traveling_Spirit" target="_blank" rel="noopener noreferrer" style="color: var(--hub-accent);">${t('Traveling Spirits (Sky Wiki 英語)', 'Traveling Spirits (Sky Wiki English)')}</a>
       ／
       <a href="https://sky-children-of-the-light.fandom.com/ja/wiki/%E9%80%9A%E5%B8%B8%E7%B2%BE%E9%9C%8A" target="_blank" rel="noopener noreferrer" style="color: var(--hub-accent);">${t('通常精霊 (Sky Wiki 日本語)', 'Regular Spirits (Sky Wiki Japanese)')}</a>
       ／
       <a href="https://sky-children-of-the-light.fandom.com/wiki/Regular_Spirit" target="_blank" rel="noopener noreferrer" style="color: var(--hub-accent);">${t('Regular Spirits (Sky Wiki 英語)', 'Regular Spirits (Sky Wiki English)')}</a>
       ／
       <a href="https://sky-children-of-the-light.fandom.com/ja/wiki/%E5%85%89%E3%81%AE%E5%AD%90" target="_blank" rel="noopener noreferrer" style="color: var(--hub-accent);">${t('光の子 (Sky Wiki 日本語)', 'Children of Light (Sky Wiki Japanese)')}</a>
       ／
       <a href="https://sky-children-of-the-light.fandom.com/wiki/Children_of_Light" target="_blank" rel="noopener noreferrer" style="color: var(--hub-accent);">${t('Children of Light (Sky Wiki 英語)', 'Children of Light (Sky Wiki English)')}</a>
     </span><br>
     <span style="font-size:12px; margin-top:4px; display:inline-block;">
       <a href="#/tai-info" style="color: var(--hub-accent);">${t('設定・クレジット・プライバシーポリシー', 'Settings & Credits / Privacy Policy')}</a>
     </span>
   </footer>
  </div>`;
}

/* ================================================================
   イベント配線（委譲方式。containerElはmount()のたびに作り直されるため、
   ここで貼るリスナーはmount()を繰り返し呼んでも積み上がらない）
   ================================================================ */
function wireEvents() {
  const q = sel => containerEl.querySelector(sel);

  q('#wgOpenDashBtn').addEventListener('click', openDashboardModal);
  q('#wgShareXBtn').addEventListener('click', () => Share.shareOnX());
  q('#wgCompareBtn').addEventListener('click', openCompareModal);
  q('#wgShareCustomizeBtn').addEventListener('click', () => Share.openCustomize());

  q('#wgTabWings').addEventListener('click', () => switchMode('wings'));
  q('#wgTabLightChildren').addEventListener('click', () => switchMode('lightChildren'));

  q('#wgSearchInput').addEventListener('input', e => onSpiritSearchInput(e.target.value));
  q('#wgSearchClearBtn').addEventListener('click', clearSpiritSearch);
  q('#wgClearAllFiltersBtn').addEventListener('click', clearAllFilters);

  q('#wgSeasonFilterBtn').addEventListener('click', () => { seasonFilterUnowned = !seasonFilterUnowned; render(); });
  q('#wgPermFilterBtn').addEventListener('click', () => { permFilterUnowned = !permFilterUnowned; render(); });
  q('#wgLightChildrenFilterBtn').addEventListener('click', () => { lightChildrenFilterUnowned = !lightChildrenFilterUnowned; render(); });
  q('#wgSeasonJumpSelect').addEventListener('change', e => jumpToSeason(e.target.value));

  q('#wgMarkAllLcBtn').addEventListener('click', markAllLightChildren);
  q('#wgResetAllLcBtn').addEventListener('click', resetAllLightChildren);

  // 季節精霊/恒常精霊リスト：チェックボックス・一括選択/リセット・開閉トグルをまとめて委譲
  q('#wgSeasonList').addEventListener('change', onSeasonListChange);
  q('#wgSeasonList').addEventListener('click', onSeasonListClick);
  q('#wgRealmList').addEventListener('change', onRealmListChange);
  q('#wgRealmList').addEventListener('click', onRealmListClick);

  // 光の子リスト：チェックボックス・一括選択/リセット・キーボード操作(Enter/Space)を委譲
  q('#wgLightChildrenList').addEventListener('change', onLightChildrenListChange);
  q('#wgLightChildrenList').addEventListener('click', onLightChildrenListClick);
  q('#wgLightChildrenList').addEventListener('keydown', onLightChildrenListKeydown);
}

function switchMode(mode) {
  containerEl.querySelector('#wgWingsMode').style.display = mode === 'wings' ? 'block' : 'none';
  containerEl.querySelector('#wgLightChildrenMode').style.display = mode === 'lightChildren' ? 'block' : 'none';
  containerEl.querySelector('#wgTabWings').classList.toggle('active', mode === 'wings');
  containerEl.querySelector('#wgTabLightChildren').classList.toggle('active', mode === 'lightChildren');
  kbNavReset(); // タブ切替で見えているリストが変わるので、↑↓の選択位置は破棄する
}

/* ================================================================
   ⌨️ 季節精霊/恒常精霊リストの↑↓キーでのハイライト移動（移植元 wings/index.html の
   kbNavMove相当。視覚的なハイライトを移動するだけで、実際のフォーカスや値の変更は
   行わない）。対象は「精霊の羽」タブ表示中の #wgSeasonList/#wgRealmList にある
   .spirit-opt のみ（光の子タブの←→グリッドナビゲーションは今回のスコープ外）。
   ================================================================ */
function kbNavReset() {
  kbNavIndex = -1;
}
function kbNavGetTargets() {
  const wingsMode = containerEl && containerEl.querySelector('#wgWingsMode');
  if (!wingsMode || wingsMode.style.display === 'none') return [];
  return Array.from(wingsMode.querySelectorAll('.spirit-opt'));
}
// 矢印キー1回分の移動を試みる。対象が無い（光の子タブ表示中等）場合は何もせずfalseを返す
// （呼び出し側はpreventDefaultしない＝ページスクロール等の既定動作を妨げない）
function kbNavMove(key) {
  const els = kbNavGetTargets();
  if (!els.length) return false;

  const delta = key === 'ArrowUp' ? -1 : 1;
  if (kbNavIndex < 0 || kbNavIndex >= els.length) kbNavIndex = 0; // 初回操作時は先頭行から
  else kbNavIndex = Math.max(0, Math.min(els.length - 1, kbNavIndex + delta));

  els.forEach(el => el.classList.remove('kb-nav-selected'));
  const el = els[kbNavIndex];
  el.classList.add('kb-nav-selected');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  return true;
}
// input/textarea/select/contenteditableへの入力中はショートカット扱いにしない
// （checkbox/radio等の非テキスト系inputは対象外＝矢印キーナビを妨げない）
const WG_NON_TEXT_INPUT_TYPES = ['checkbox', 'radio', 'range', 'color', 'button', 'submit', 'reset', 'file', 'image', 'hidden'];
function handleKbNavKeydown(e) {
  if (e.repeat) return;
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (!containerEl) return; // このビューがunmount済み

  const tgt = e.target;
  const isTextInput = tgt && tgt.tagName === 'INPUT' && WG_NON_TEXT_INPUT_TYPES.indexOf((tgt.type || '').toLowerCase()) === -1;
  const isTyping = tgt && (isTextInput || tgt.tagName === 'TEXTAREA' || tgt.tagName === 'SELECT' || tgt.isContentEditable);
  if (isTyping) return;

  // モーダル（ダッシュボード・共有カスタマイズ・画像プレビュー）表示中はリストが隠れているため無効化
  if (document.querySelector('.modal-overlay.open')) return;

  if (kbNavMove(e.key)) e.preventDefault();
}

/* ================================================================
   ダッシュボードモーダル（features/shared/event-dashboard.js をmountする）
   ================================================================ */
function openDashboardModal() {
  document.getElementById('wgDashModalOverlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'wgDashModalOverlay';
  overlay.addEventListener('click', e => { if (e.target === overlay) closeDashboardModal(); });
  overlay.innerHTML = `
    <div class="modal-card">
      <button type="button" class="modal-close-btn" id="wgDashCloseBtn"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      <div class="modal-title">${t('今日・今週・今月', 'Today / This Week / This Month')}</div>
      <div id="wgDashBody"></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#wgDashCloseBtn').addEventListener('click', closeDashboardModal);
  eventDashboard.mount(overlay.querySelector('#wgDashBody'));
  requestAnimationFrame(() => overlay.classList.add('open'));
}
function closeDashboardModal() {
  document.getElementById('wgDashModalOverlay')?.classList.remove('open');
  eventDashboard.unmount();
}

/* ================================================================
   📊 プロフィール比較（元実装wings/index.htmlのpfCompareOpen/pfCompareRender）
   2つのプロフィールの進捗を、切り替えずに並べて見比べる。S.getWingStats(profileId)
   にIDを渡すと、アクティブプロフィールを変えずに任意のプロフィールの保存データだけを
   読み取って集計できる。値が大きい側のセルは緑字で強調する。
   （ハブのプロフィール窓は全ツール共通のため、比較はこのページ専用のボタンから開く）
   ================================================================ */
function openCompareModal() {
  const list = ensureProfilesInit();
  if (list.length < 2) {
    showToast(t('プロフィールが1つしかないため比較できません。まず「追加」でもう1つ作成してください。',
      'You need at least two profiles to compare. Create another one first with "Add".'));
    return;
  }
  document.getElementById('wgCompareModalOverlay')?.remove();
  const active = getActiveProfileId();
  const optsHtml = list.map(p => `<option value="${escapeAttr(p.id)}">${escapeHtml(pfDisplayName(p))}</option>`).join('');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'wgCompareModalOverlay';
  overlay.addEventListener('click', e => { if (e.target === overlay) closeCompareModal(); });
  overlay.innerHTML = `
    <div class="modal-card">
      <button type="button" class="modal-close-btn" id="wgCompareCloseBtn" aria-label="${escapeAttr(t('閉じる', 'Close'))}"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      <div class="modal-title">${t('プロフィールを比較', 'Compare Profiles')}</div>
      <div class="wg-compare-selects">
        <select class="pf-input" id="wgCompareSelectA">${optsHtml}</select>
        <select class="pf-input" id="wgCompareSelectB">${optsHtml}</select>
      </div>
      <div id="wgCompareBody"></div>
    </div>`;
  document.body.appendChild(overlay);
  const selA = overlay.querySelector('#wgCompareSelectA');
  const selB = overlay.querySelector('#wgCompareSelectB');
  selA.value = active;
  const other = list.find(p => p.id !== active);
  selB.value = other ? other.id : active;
  selA.addEventListener('change', renderCompare);
  selB.addEventListener('change', renderCompare);
  overlay.querySelector('#wgCompareCloseBtn').addEventListener('click', closeCompareModal);
  renderCompare();
  requestAnimationFrame(() => overlay.classList.add('open'));
}
function closeCompareModal() {
  document.getElementById('wgCompareModalOverlay')?.classList.remove('open');
}
function compareRow(label, a, b, totalA, totalB) {
  const aLead = a > b, bLead = b > a;
  const fmt = (v, total) => (total === undefined ? `${v}` : `${v} / ${total}`);
  return `<tr>
    <td>${label}</td>
    <td class="${aLead ? 'wg-compare-lead' : ''}">${fmt(a, totalA)}</td>
    <td class="${bLead ? 'wg-compare-lead' : ''}">${fmt(b, totalB)}</td>
  </tr>`;
}
function renderCompare() {
  const overlay = document.getElementById('wgCompareModalOverlay');
  if (!overlay) return;
  const idA = overlay.querySelector('#wgCompareSelectA').value;
  const idB = overlay.querySelector('#wgCompareSelectB').value;
  if (!idA || !idB) return;
  const list = ensureProfilesInit();
  const pA = list.find(p => p.id === idA), pB = list.find(p => p.id === idB);
  const A = S.getWingStats(idA), B = S.getWingStats(idB);
  overlay.querySelector('#wgCompareBody').innerHTML = `
    <table class="wg-compare-table">
      <thead><tr><th></th><th>${escapeHtml(pA ? pfDisplayName(pA) : '')}</th><th>${escapeHtml(pB ? pfDisplayName(pB) : '')}</th></tr></thead>
      <tbody>
        ${compareRow(t('季節精霊', 'Season Spirits'), A.seasonFeathers, B.seasonFeathers, A.seasonSpiritsTotal, B.seasonSpiritsTotal)}
        ${compareRow(t('恒常精霊', 'Realm Spirits'), A.permFeathers, B.permFeathers, A.permTotal, B.permTotal)}
        ${compareRow(t('光の子', 'Children of Light'), A.lightChildrenGot, B.lightChildrenGot, A.lightChildrenTotal, B.lightChildrenTotal)}
        ${compareRow(t('光の翼 合計', 'Total Wings'), A.totalAll, B.totalAll)}
        ${compareRow(t('ケープレベル', 'Cape Level'), A.capeLevel, B.capeLevel)}
      </tbody>
    </table>`;
}

/* ================================================================
   フィルター・検索・季節ジャンプ
   ================================================================ */
function onSpiritSearchInput(value) {
  spiritSearchQuery = (value || '').trim().toLowerCase();
  containerEl.querySelector('#wgSearchClearBtn').style.display = spiritSearchQuery ? '' : 'none';
  render();
}
function clearSpiritSearch() {
  spiritSearchQuery = '';
  containerEl.querySelector('#wgSearchInput').value = '';
  containerEl.querySelector('#wgSearchClearBtn').style.display = 'none';
  render();
}
function spiritMatchesSearch(label) {
  return !spiritSearchQuery || String(label).toLowerCase().includes(spiritSearchQuery);
}
function clearAllFilters() {
  spiritSearchQuery = '';
  containerEl.querySelector('#wgSearchInput').value = '';
  containerEl.querySelector('#wgSearchClearBtn').style.display = 'none';
  seasonFilterUnowned = false;
  permFilterUnowned = false;
  lightChildrenFilterUnowned = false;
  render();
}
function jumpToSeason(value) {
  if (value === '') return;
  const idx = parseInt(value, 10);
  const entry = SEASON_SPIRITS[idx];
  if (!entry) return;
  let needsRerender = false;
  if (seasonFilterUnowned) { seasonFilterUnowned = false; needsRerender = true; }
  if (spiritSearchQuery) {
    spiritSearchQuery = '';
    containerEl.querySelector('#wgSearchInput').value = '';
    containerEl.querySelector('#wgSearchClearBtn').style.display = 'none';
    needsRerender = true;
  }
  if (seasonCollapsedIds.has(entry.season.ja)) { seasonCollapsedIds.delete(entry.season.ja); needsRerender = true; }
  if (needsRerender) render();
  const el = containerEl.querySelector('#wg-season-card-' + idx);
  if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' });
  containerEl.querySelector('#wgSeasonJumpSelect').value = '';
}

/* ================================================================
   季節精霊リスト：委譲ハンドラ
   ================================================================ */
function onSeasonListChange(e) {
  const input = e.target.closest('input[type="checkbox"]');
  if (!input) return;
  const label = input.closest('.spirit-opt');
  onSpiritToggle(label.dataset.season, label.dataset.spirit, input.checked);
}
function onSeasonListClick(e) {
  const toggleBtn = e.target.closest('.season-toggle-btn');
  if (toggleBtn) { toggleSeasonCard(toggleBtn.dataset.season); return; }
  const areaBtn = e.target.closest('.area-btn');
  if (areaBtn) { setSeasonSpirits(areaBtn.dataset.season, areaBtn.dataset.checked === '1'); }
}
function onSpiritToggle(season, spirit, isChecked) {
  const tracker = S.loadTracker();
  if (!tracker[season]) tracker[season] = {};
  if (isChecked) tracker[season][spirit] = { at: new Date().toISOString() };
  else delete tracker[season][spirit];
  S.saveTracker(tracker);
  render();
  showToast(t('保存しました', 'Saved'));
}
function toggleSeasonCard(seasonJa) {
  if (seasonCollapsedIds.has(seasonJa)) seasonCollapsedIds.delete(seasonJa); else seasonCollapsedIds.add(seasonJa);
  render();
}
function setSeasonSpirits(seasonJa, checked) {
  const found = SEASON_SPIRITS.find(s => s.season.ja === seasonJa);
  if (!found) return;
  const tracker = S.loadTracker();
  if (!tracker[seasonJa]) tracker[seasonJa] = {};
  const at = new Date().toISOString();
  found.spirits.forEach(sp => {
    if (checked) tracker[seasonJa][sp.ja] = { at };
    else delete tracker[seasonJa][sp.ja];
  });
  S.saveTracker(tracker);
  render();
  showToast(checked ? t('エリアをまとめて選択しました', 'Selected all in this area') : t('エリアをリセットしました', 'Reset this area'));
}

/* ================================================================
   恒常精霊リスト：委譲ハンドラ
   ================================================================ */
function onRealmListChange(e) {
  const input = e.target.closest('input[type="checkbox"]');
  if (!input) return;
  const label = input.closest('.spirit-opt');
  onPermToggle(label.dataset.spirit, label.dataset.tier, input.checked);
}
function onRealmListClick(e) {
  const areaBtn = e.target.closest('.area-btn');
  if (!areaBtn) return;
  setRealmSpirits(areaBtn.dataset.realm, areaBtn.dataset.checked === '1');
}
function onPermToggle(spirit, tier, isChecked) {
  const tracker = S.loadPermTracker();
  if (!tracker[spirit]) tracker[spirit] = {};
  if (isChecked) tracker[spirit][tier] = { at: new Date().toISOString() };
  else delete tracker[spirit][tier];
  S.savePermTracker(tracker);
  render();
  showToast(t('保存しました', 'Saved'));
}
function setRealmSpirits(realmJa, checked) {
  const found = REALM_SPIRITS.find(r => r.realm.ja === realmJa);
  if (!found) return;
  const tracker = S.loadPermTracker();
  const at = new Date().toISOString();
  found.spirits.forEach(sp => {
    if (!tracker[sp.name.ja]) tracker[sp.name.ja] = {};
    if (checked) {
      tracker[sp.name.ja].tier1 = { at };
      if (sp.t2) tracker[sp.name.ja].tier2 = { at };
    } else {
      delete tracker[sp.name.ja].tier1;
      delete tracker[sp.name.ja].tier2;
    }
  });
  S.savePermTracker(tracker);
  render();
  showToast(checked ? t('エリアをまとめて選択しました', 'Selected all in this area') : t('エリアをリセットしました', 'Reset this area'));
}

/* ================================================================
   光の子リスト：委譲ハンドラ
   ================================================================ */
function onLightChildrenListChange(e) {
  const input = e.target.closest('input[type="checkbox"]');
  if (!input) return;
  onLightChildToggle(input.dataset.id, input.checked);
}
function onLightChildrenListClick(e) {
  const areaBtn = e.target.closest('.area-btn');
  if (!areaBtn) return;
  setAreaChildren(areaBtn.dataset.ids.split(','), areaBtn.dataset.checked === '1');
}
function onLightChildrenListKeydown(e) {
  if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
  const opt = e.target.closest('.light-child-opt');
  if (!opt) return;
  e.preventDefault();
  const input = opt.querySelector('input[type="checkbox"]');
  if (input) input.click();
}
function onLightChildToggle(id, isChecked) {
  const tracker = S.loadLightChildrenTracker();
  if (isChecked) tracker[id] = true;
  else delete tracker[id];
  S.saveLightChildrenTracker(tracker);
  render();
  showToast(t('保存しました', 'Saved'));
}
function setAreaChildren(ids, checked) {
  const tracker = S.loadLightChildrenTracker();
  ids.forEach(id => {
    if (checked) tracker[id] = true;
    else delete tracker[id];
  });
  S.saveLightChildrenTracker(tracker);
  render();
  showToast(checked ? t('エリアをまとめて選択しました', 'Selected all in this area') : t('エリアをリセットしました', 'Reset this area'));
}
function resetAllLightChildren() {
  if (!confirm(t('光の子のチェックをすべてリセットします。よろしいですか？', 'This will reset all Children of Light checkmarks. Continue?'))) return;
  S.saveLightChildrenTracker({});
  render();
  showToast(t('光の子をすべてリセットしました', 'Reset all Children of Light'));
}
function markAllLightChildren() {
  if (!confirm(t('光の子を全エリア一気に取得済みにします。よろしいですか？', 'This will mark all Children of Light as found at once. Continue?'))) return;
  const tracker = S.loadLightChildrenTracker();
  LIGHT_CHILDREN.forEach(({ areas }) => {
    areas.forEach(({ children }) => {
      children.forEach(child => { tracker[child.id] = true; });
    });
  });
  S.saveLightChildrenTracker(tracker);
  render();
  showToast(t('光の子を全エリア取得済みにしました', 'Marked all Children of Light as found'));
}

/* ================================================================
   称号ロック解除の日付表示・光の子ラベルのEN生成
   ================================================================ */
function formatObtainedDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
  return CURRENT_LANG === 'en' ? `${m}/${day}/${y}` : `${y}/${m}/${day}`;
}
// 光の子1体の表示ラベル。JAは元のlabel文字列をそのまま使い、ENはlabel末尾の通し番号を
// 抜き出してrealmのEN名と組み合わせて生成する（124体分を個別に{ja,en}化しなくて済むように）。
function lcChildLabel(child, realmObj) {
  if (CURRENT_LANG !== 'en') return child.label;
  const m = /(\d+)\s*$/.exec(child.label);
  const num = m ? m[1] : '';
  return `${realmObj.en} Child of Light ${num}`.trim();
}

/* ================================================================
   トースト通知
   ================================================================ */
function showToast(msg, opts) {
  const el = document.createElement('div');
  el.className = 'wg-toast';
  if (opts && opts.html) el.innerHTML = msg; else el.textContent = msg;
  const stackIndex = document.querySelectorAll('.wg-toast').length;
  if (stackIndex > 0) el.style.bottom = `calc(84px + env(safe-area-inset-bottom) + ${stackIndex * 44}px)`;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 1600);
}

/* ================================================================
   🏆 称号（実績）
   ================================================================ */
function checkAndUnlockTitles() {
  const { owned, newlyEarned } = S.checkAndUnlockTitles();
  renderTitles(owned);
  newlyEarned.forEach(title => {
    showToast(t(
      `称号「${title.icon} ${escapeHtml(L(title.name))}」を獲得しました！`,
      `Title unlocked: ${title.icon} ${escapeHtml(L(title.name))}!`,
    ), { html: true });
  });
}
function renderTitles(owned) {
  owned = owned || S.loadTitles();
  const earnedCount = TITLES.filter(ti => owned[ti.id]).length;
  containerEl.querySelector('#wgTitlesCount').textContent = t(`${earnedCount} / ${TITLES.length} 個解除`, `${earnedCount} / ${TITLES.length} unlocked`);
  containerEl.querySelector('#wgTitlesChips').innerHTML = TITLES.map(ti => {
    if (owned[ti.id]) {
      return `<span class="title-chip" title="${escapeAttr(L(ti.desc))}">${ti.icon} ${escapeHtml(L(ti.name))}</span>`;
    }
    return `<span class="title-chip locked" title="${escapeAttr(t('称号は条件を満たすと明らかになります', 'Unlocks when you meet its condition'))}">${ti.icon} ${escapeHtml(t('？？？', '???'))}</span>`;
  }).join('');
}

/* ================================================================
   ケープレベル表示
   ================================================================ */
function renderCapeLevels(total) {
  const reachedLevel = CAPE_LEVELS.filter(need => total >= need).length;
  const nextNeed = CAPE_LEVELS[reachedLevel];

  const summary = reachedLevel >= CAPE_LEVELS.length
    ? t(`現在 光の翼 ${total}枚 — 最大ケープレベル ${CAPE_LEVELS.length} に到達済み！`, `Currently ${total} Winged Light — reached the max Cape Level ${CAPE_LEVELS.length}!`)
    : t(`現在 光の翼 ${total}枚（レベル${reachedLevel + 1}まであと ${nextNeed - total}枚）`, `Currently ${total} Winged Light (need ${nextNeed - total} more for Level ${reachedLevel + 1})`);
  containerEl.querySelector('#wgCapeSummary').textContent = summary;
  containerEl.querySelector('#wgCapeLevelLabel').innerHTML = `<span class="cape-lv-prefix">Lv</span>${reachedLevel}`;

  const pipsEl = containerEl.querySelector('#wgCapePips');
  if (reachedLevel === 0) { pipsEl.innerHTML = ''; return; }

  const pipCount = Math.min(reachedLevel, 5);
  const numSparkle = Math.max(0, Math.min(reachedLevel - 10, 5));
  const numOutlined = Math.max(0, Math.min(reachedLevel - 5, 5));

  const pips = Array.from({ length: pipCount }, (_, i) => {
    const distFromTop = pipCount - 1 - i;
    if (distFromTop < numSparkle) {
      return `<div class="cape-pip tier3"><span class="cape-pip-inner"></span><span class="cape-spark t"></span><span class="cape-spark b"></span><span class="cape-spark l"></span><span class="cape-spark r"></span></div>`;
    }
    if (distFromTop < numOutlined) {
      return `<div class="cape-pip tier2"><span class="cape-pip-inner"></span></div>`;
    }
    return `<div class="cape-pip"></div>`;
  }).join('');
  pipsEl.innerHTML = pips;
}

/* ================================================================
   メイン描画
   ================================================================ */
function render() {
  const tracker = S.loadTracker();
  const permTracker = S.loadPermTracker();

  containerEl.querySelector('#wgSeasonFilterBtn').classList.toggle('active', seasonFilterUnowned);
  containerEl.querySelector('#wgPermFilterBtn').classList.toggle('active', permFilterUnowned);
  containerEl.querySelector('#wgLightChildrenFilterBtn').classList.toggle('active', lightChildrenFilterUnowned);
  const anyFilterActive = !!spiritSearchQuery || seasonFilterUnowned || permFilterUnowned || lightChildrenFilterUnowned;
  containerEl.querySelector('#wgClearAllFiltersBtn').style.display = anyFilterActive ? '' : 'none';

  // ── 季節精霊・再訪 ──
  const endingSoon = getEndingSoonSeasonInfo();
  let seasonFeathers = 0, seasonSpiritsTotal = 0;
  const seasonHtml = SEASON_SPIRITS.map(({ season, spirits }, seasonIdx) => {
    const checked = tracker[season.ja] || {};
    const gotCount = spirits.filter(sp => checked[sp.ja]).length;
    seasonFeathers += gotCount;
    seasonSpiritsTotal += spirits.length;
    const complete = gotCount === spirits.length;

    if (seasonFilterUnowned && complete) return '';

    let visibleSpirits = seasonFilterUnowned ? spirits.filter(sp => !checked[sp.ja]) : spirits;
    if (spiritSearchQuery) visibleSpirits = visibleSpirits.filter(sp => spiritMatchesSearch(L(sp)));
    if (spiritSearchQuery && !visibleSpirits.length) return '';

    const seasonEndingSoon = (!complete && endingSoon && endingSoon.seasonJa === season.ja) ? endingSoon : null;
    const collapsed = !spiritSearchQuery && seasonCollapsedIds.has(season.ja);

    const spiritsHtml = visibleSpirits.map(sp => {
      const val = checked[sp.ja];
      const dateStr = formatObtainedDate(S.wingObtainedAt(val));
      const warnThis = seasonEndingSoon && !val;
      return `
      <label class="spirit-opt${warnThis ? ' warn' : ''}" data-season="${escapeAttr(season.ja)}" data-spirit="${escapeAttr(sp.ja)}">
        <input type="checkbox" ${val ? 'checked' : ''}>
        <span class="spirit-opt-label">${escapeHtml(L(sp))}</span>
        ${dateStr ? `<span class="spirit-opt-date" title="${escapeAttr(t(`${dateStr}に獲得`, `Obtained on ${dateStr}`))}"><svg class="inline-icon" width="12" height="12"><use href="#i-calendar"/></svg> ${escapeHtml(dateStr)}</span>` : ''}
      </label>`;
    }).join('');

    return `
      <div class="season-card${seasonEndingSoon ? ' ending-soon' : ''}" id="wg-season-card-${seasonIdx}">
        <div class="season-head">
          <div class="season-name">${escapeHtml(L(season))}</div>
          <div class="season-head-actions">
            <span class="season-sub-badge ${complete ? 'complete' : ''}">${gotCount} / ${spirits.length} ${t('体', '')}</span>
            ${seasonEndingSoon ? `<span class="season-sub-badge warn" title="${escapeAttr(t('この季節はまもなく終了します。再訪でしか手に入らない光の翼を見逃さないようご注意ください。', 'This season is ending soon. Do not miss out on Winged Light only available through Revisit before it closes for good.'))}"><svg class="inline-icon warn" width="12" height="12"><use href="#i-warning"/></svg> ${t(`終了まであと${seasonEndingSoon.daysLeft}日`, `Ends in ${seasonEndingSoon.daysLeft}d`)}</span>` : ''}
            <button type="button" class="season-toggle-btn" data-season="${escapeAttr(season.ja)}" aria-expanded="${collapsed ? 'false' : 'true'}" title="${escapeAttr(t(collapsed ? '展開する' : '折りたたむ', collapsed ? 'Expand' : 'Collapse'))}"><svg class="inline-icon" width="13" height="13"><use href="#i-chevron-down"/></svg></button>
          </div>
        </div>
        ${collapsed ? '' : `
        <div class="area-actions" style="margin: 8px 0 0;">
          <button type="button" class="area-btn" data-season="${escapeAttr(season.ja)}" data-checked="1">${t('全選択', 'Select all')}</button>
          <button type="button" class="area-btn" data-season="${escapeAttr(season.ja)}" data-checked="0">${t('リセット', 'Reset')}</button>
        </div>
        <div class="spirit-list">${spiritsHtml}</div>`}
      </div>`;
  }).join('');
  containerEl.querySelector('#wgSeasonList').innerHTML = seasonHtml
    || (spiritSearchQuery ? `<div class="notice-card">${t('検索条件に一致する精霊が見つかりません。', 'No spirits match your search.')}</div>` : '');

  // ── 恒常精霊 ──
  let permFeathers = 0, permCandles = 0;
  const permTotal = REALM_SPIRITS.reduce((sum, r) => sum + r.spirits.reduce((s2, sp) => s2 + (sp.t2 ? 2 : 1), 0), 0);
  const realmHtml = REALM_SPIRITS.map(({ realm, spirits }) => {
    let realmGot = 0;
    const realmMax = spirits.reduce((s, sp) => s + (sp.t2 ? 2 : 1), 0);

    const spiritsHtml = spirits.map(sp => {
      const state = permTracker[sp.name.ja] || {};
      const t1Owned = !!state.tier1;
      const t2Owned = sp.t2 ? !!state.tier2 : false;
      if (t1Owned) { realmGot++; permCandles += sp.t1; }
      if (sp.t2 && t2Owned) { realmGot++; permCandles += sp.t2; }

      if (spiritSearchQuery && !spiritMatchesSearch(L(sp.name))) return '';

      const t1Date = formatObtainedDate(S.wingObtainedAt(state.tier1));
      const t2Date = formatObtainedDate(S.wingObtainedAt(state.tier2));
      const t1Unit = sp.t1 === 1 ? '' : 's';
      const t2Unit = sp.t2 === 1 ? '' : 's';
      const tier1Opt = (!permFilterUnowned || !t1Owned) ? `
      <label class="spirit-opt" data-spirit="${escapeAttr(sp.name.ja)}" data-tier="tier1">
        <input type="checkbox" ${t1Owned ? 'checked' : ''}>
        <span class="spirit-opt-label">${escapeHtml(L(sp.name))}${t(`（Tier1・星のキャンドル${sp.t1}本）`, ` (Tier 1 · ${sp.t1} Star Candle${t1Unit})`)}</span>
        ${t1Date ? `<span class="spirit-opt-date" title="${escapeAttr(t(`${t1Date}に獲得`, `Obtained on ${t1Date}`))}"><svg class="inline-icon" width="12" height="12"><use href="#i-calendar"/></svg> ${escapeHtml(t1Date)}</span>` : ''}
      </label>` : '';
      const tier2Opt = (sp.t2 && (!permFilterUnowned || !t2Owned)) ? `
      <label class="spirit-opt" data-spirit="${escapeAttr(sp.name.ja)}" data-tier="tier2">
        <input type="checkbox" ${t2Owned ? 'checked' : ''}>
        <span class="spirit-opt-label">${escapeHtml(L(sp.name))}${t(`（Tier2・星のキャンドル${sp.t2}本）`, ` (Tier 2 · ${sp.t2} Star Candle${t2Unit})`)}</span>
        ${t2Date ? `<span class="spirit-opt-date" title="${escapeAttr(t(`${t2Date}に獲得`, `Obtained on ${t2Date}`))}"><svg class="inline-icon" width="12" height="12"><use href="#i-calendar"/></svg> ${escapeHtml(t2Date)}</span>` : ''}
      </label>` : '';
      return tier1Opt + tier2Opt;
    }).join('');

    permFeathers += realmGot;
    const complete = realmGot === realmMax;

    if (permFilterUnowned && complete) return '';
    if (spiritSearchQuery && !spiritsHtml.trim()) return '';

    return `
      <div class="season-card">
        <div class="season-head">
          <div class="season-name">${escapeHtml(L(realm))}</div>
          <span class="season-sub-badge ${complete ? 'complete' : ''}">${realmGot} / ${realmMax} ${t('枚', '')}</span>
        </div>
        <div class="area-actions" style="margin: 8px 0 0;">
          <button type="button" class="area-btn" data-realm="${escapeAttr(realm.ja)}" data-checked="1">${t('全選択', 'Select all')}</button>
          <button type="button" class="area-btn" data-realm="${escapeAttr(realm.ja)}" data-checked="0">${t('リセット', 'Reset')}</button>
        </div>
        <div class="spirit-list">${spiritsHtml}</div>
      </div>`;
  }).join('');
  containerEl.querySelector('#wgRealmList').innerHTML = realmHtml
    || (spiritSearchQuery ? `<div class="notice-card">${t('検索条件に一致する精霊が見つかりません。', 'No spirits match your search.')}</div>` : '');

  // ── 光の子 ──
  const { got: lightChildrenGot, total: lightChildrenTotal } = renderLightChildren();

  // ── 集計表示 ──
  const totalAll = seasonFeathers + permFeathers + lightChildrenGot + S.REBIRTH_BONUS;
  containerEl.querySelector('#wgSumFeathersAll').innerHTML = `${totalAll.toLocaleString()}<span class="num-unit">${t('枚', '')}</span>`;
  containerEl.querySelector('#wgSumFeathersAllSub').textContent = t(
    `季節精霊 ${seasonFeathers} + 恒常精霊 ${permFeathers} + 光の子 ${lightChildrenGot} + 転生 ${S.REBIRTH_BONUS}`,
    `Seasonal ${seasonFeathers} + Regular ${permFeathers} + Children of Light ${lightChildrenGot} + Rebirth ${S.REBIRTH_BONUS}`,
  );
  containerEl.querySelector('#wgSumCandles').innerHTML = `${((seasonFeathers * S.CANDLES_PER_FEATHER) + permCandles).toLocaleString()}<span class="num-unit">${t('本', '')}</span>`;
  containerEl.querySelector('#wgSumFeathersSeason').textContent = `${seasonFeathers} / ${seasonSpiritsTotal}`;
  containerEl.querySelector('#wgSumFeathersPerm').textContent = `${permFeathers} / ${permTotal}`;
  containerEl.querySelector('#wgSumPermCandles').textContent = `${permCandles.toLocaleString()}`;
  containerEl.querySelector('#wgSumLightChildren').textContent = `${lightChildrenGot} / ${lightChildrenTotal}`;

  renderCapeLevels(totalAll);
  checkAndUnlockTitles();
}

// 光の子チェックリストを描画し、{ got, total } を返す
function renderLightChildren() {
  const tracker = S.loadLightChildrenTracker();
  let got = 0, total = 0;

  const html = LIGHT_CHILDREN.map(({ realm, areas }) => {
    let realmGot = 0, realmTotal = 0;
    const areasHtml = areas.map(({ area, children }) => {
      realmTotal += children.length;
      const optsHtml = children.map(child => {
        const checked = !!tracker[child.id];
        if (checked) realmGot++;
        if (lightChildrenFilterUnowned && checked) return '';
        const label = lcChildLabel(child, realm);
        if (spiritSearchQuery && !spiritMatchesSearch(label)) return '';
        const thumb = child.img
          ? `<img src="${escapeAttr(child.img)}" alt="${escapeHtml(label)}" loading="lazy" onerror="this.parentElement.classList.add('img-fallback')">`
          : '';
        return `
          <label class="light-child-opt ${checked ? 'checked' : ''}" tabindex="0" role="checkbox" aria-checked="${checked ? 'true' : 'false'}">
            <div class="light-child-thumb ${child.img ? '' : 'img-fallback'}">
              ${thumb}
              <span class="light-child-thumb-fallback"><svg class="inline-icon" width="18" height="18"><use href="#i-person"/></svg></span>
              <span class="light-child-check">${checked ? '<svg class="inline-icon ok" width="12" height="12"><use href="#i-check"/></svg>' : ''}</span>
            </div>
            <input type="checkbox" style="display:none;" data-id="${escapeAttr(child.id)}" ${checked ? 'checked' : ''}>
            <span class="light-child-label">${escapeHtml(label)}</span>
          </label>`;
      }).join('');
      if (!optsHtml.trim()) return '';
      const idsCsv = children.map(c => c.id).join(',');
      return `
        <div class="area-name">
          <span class="area-name-label">${escapeHtml(L(area))}</span>
          <span class="area-actions">
            <button type="button" class="area-btn" data-ids="${idsCsv}" data-checked="1">${t('全選択', 'Select all')}</button>
            <button type="button" class="area-btn" data-ids="${idsCsv}" data-checked="0">${t('リセット', 'Reset')}</button>
          </span>
        </div>
        <div class="light-child-grid">${optsHtml}</div>`;
    }).join('');

    total += realmTotal;
    got += realmGot;
    const complete = realmGot === realmTotal;

    if (lightChildrenFilterUnowned && complete) return '';
    if (spiritSearchQuery && !areasHtml.trim()) return '';

    return `
      <div class="realm-block">
        <div class="season-head">
          <div class="season-name">${escapeHtml(L(realm))}</div>
          <span class="season-sub-badge ${complete ? 'complete' : ''}">${realmGot} / ${realmTotal} ${t('体', '')}</span>
        </div>
        ${areasHtml}
      </div>`;
  }).join('');

  containerEl.querySelector('#wgLightChildrenList').innerHTML = html
    || `<div class="notice-card">${t('条件に一致する光の子がいません。', 'No Children of Light match the current filter.')}</div>`;
  return { got, total };
}

/* ================================================================
   ⏰ 季節精霊チェックリスト × ダッシュボードの季節終了カウントダウン連携
   ダッシュボードが把握している「現在のシーズン終了日時」と、このチェック
   リストが持つ季節精霊リスト(SEASON_SPIRITS)を突き合わせ、「まもなく
   終了するシーズンの、まだ集めていない光の翼」があれば検出する
   （元実装のpfGetEndingSoonSeasonInfo相当。event-dashboard.jsの
   getEndingSoonSeason()が返すseasonEnで突き合わせる）。
   ================================================================ */
function getEndingSoonSeasonInfo() {
  const info = eventDashboard.getEndingSoonSeason();
  if (!info) return null;
  const match = SEASON_SPIRITS.find(s => s.season.en === info.seasonEn);
  if (!match) return null;
  return { seasonJa: match.season.ja, daysLeft: info.daysLeft };
}

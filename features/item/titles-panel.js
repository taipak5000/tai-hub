/* ================================================================
   titles-panel.js — 🏆 称号（実績）パネル：全体達成率ゲージ + 称号チップ列

   item/profiles.js の「🏆 称号（実績）機能」ブロック（TITLE_CAT_KEYS・
   TITLES・checkAndUnlockTitles()・renderTitlesPanel()・refreshTitlesUI()）
   と、item/index.html のOverall rate banner（.gauge-wrap 一式）を、
   tai-hub の他機能ビューと同じ自己完結モジュールの形に移植したもの。
   ライブサイト（https://taipak5000.github.io/tai-item/）のダッシュボード
   最上部にある「大きいオレンジ色のグラデーションカード＋円形ゲージ」と
   「称号 X/11個解除」のチップ列に相当する。

   状態はすべて js/state.js の loadTitleStore()/saveTitleStore()
   （キー: itemTitles_v1、nsKeyで名前空間化）に委譲する——このファイル
   自身は生のlocalStorageキー名を直接読み書きしない（実額合計だけ例外。
   下記コメント参照）。

   ── 呼び出し契約（他パスでdashboard-view.js/category-view.js/
      cost-view.js に配線する際の仕様） ──────────────────────────
   ・mount(container): container.innerHTML を丸ごと描画する。ゲージと
     称号チップ列の両方を含む1つのブロックを描く（見出し2つ＋カード＋
     チップ列）。何度呼んでも安全な冪等な再描画（内部で
     checkAndUnlockTitles()も実行し、最新のhwm/earnedを反映してから
     描く——ただしトーストは出さない）。呼び出し側は、CSS変数
     （--orange, --card 等）を提供する `.item-view` の子孫要素として
     containerを配置すること（css/item.css がこれらのトークンを
     `.item-view` スコープでしか定義していないため）。
   ・refresh(container): 称号のチェック→新規解禁分のトースト表示→
     mount(container)と同じ再描画、をまとめて行う。ユーザーがカテゴリの
     所持トグルやコスト計算の実額を変更した直後に呼ぶ想定
     （category-view.js の toggleOwned 相当・cost-view.js の
     renderSummary 相当の末尾から呼び出す）。
   ・checkAndUnlockTitles(): 判定→hwm更新→保存のみを行い、新規解禁分の
     称号オブジェクト配列を返す（描画・トーストはしない）。非同期
     （各カテゴリの総アイテム数をdynamic importで取得するため）。
   ・TITLES / TITLE_CAT_KEYS: 元データそのまま（id・name・description・
     conditionは一切変更していない）。
   ================================================================ */

import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { getCategoryState, loadTitleStore, saveTitleStore, nsKey } from '../../js/state.js';
import * as conditionRates from './condition-rates.js';

const STYLE_ID = 'item-titles-panel-styles';

// 総合達成率・カテゴリ制覇数の集計対象となる12カテゴリ。
// item/profiles.js の TITLE_CAT_KEYS と完全に同一のキー集合・順序
// （music_sheet は CATEGORY_REGISTRY 側も section:'special' で除外対象）。
export const TITLE_CAT_KEYS = [
  'outfit', 'shoes', 'mask', 'face_accessory', 'necklace', 'hairstyle',
  'hair_accessory', 'head_accessory', 'cape', 'portable_item', 'large_placeable', 'small_placeable',
];

/* ── アイコン（16x16 inline-icon。tai-hub の共有 js/icon-sprite.js には
   i-medal/i-trophy/i-coin/i-gift/i-lock が無く、他パスが並行編集中の
   共有ファイルを増やさないため、item/profiles.js のiconスプライト定義
   から該当パスデータをそのまま複製してこのファイル内で完結させている
   （cost-view.js が ICON_GIFT 等を自前定義しているのと同じ方針）。
   candle/moon/sparkle/crown/gem/star はtai-hub共有スプライトにも同じ
   パスデータで存在するが、依存を一本化するためここでも複製している） ── */
const ICON_PATHS = {
  candle: '<path d="M9.5 21h5a1 1 0 0 0 1-1v-7.5a3 3 0 0 0-3-3h-1a3 3 0 0 0-3 3V20a1 1 0 0 0 1 1Z"/><path d="M12 9.5V5M10.3 5.2C10.3 3.7 12 3.5 12 2c0 1.5 1.7 1.7 1.7 3.2 0 .9-.75 1.3-1.7 1.3s-1.7-.4-1.7-1.3Z"/>',
  moon: '<g transform="translate(12 12) scale(1.049) translate(-11.66 -12.34)"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/></g>',
  sparkle: '<path d="M12 3l1.5 6L20 12l-6.5 1.5L12 21l-1.5-6L4 12l6.5-1.5Z"/>',
  crown: '<g transform="translate(12 12) scale(1.094) translate(-12 -12)"><path d="M4 10l4 3 4-6 4 6 4-3v7H4Z"/></g>',
  medal: '<path d="M8 3l3 8M16 3l-3 8"/><path d="M12 20a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Z"/><path d="M10 14.5l2-1.2 2 1.2"/>',
  trophy: '<g transform="translate(12 12) scale(1.061) translate(-12 -12.25)"><path d="M8 4h8v6a4 4 0 0 1-8 0V4Z"/><path d="M8 5H5.5A1.5 1.5 0 0 0 4 6.5 3.5 3.5 0 0 0 7.5 10H8"/><path d="M16 5h2.5A1.5 1.5 0 0 1 20 6.5 3.5 3.5 0 0 1 16.5 10H16"/><path d="M12 14v3M9 20.5h6M9.5 17.5h5v3h-5Z"/></g>',
  coin: '<path d="M6 3l6 9m6-9l-6 9M12 12v9M8.5 14.5h7M8.5 17.5h7"/>',
  gift: '<g transform="translate(12 12) scale(1.094) translate(-12 -12.5)"><path d="M4 9h16v3H4Z"/><path d="M5 12h14v8H5Z"/><path d="M12 9v11"/><path d="M9 9c-1.3 0-2.3-.9-2.3-2S7.7 5 9 5c1.3 0 3 1.7 3 4M15 9c1.3 0 2.3-.9 2.3-2S16.3 5 15 5c-1.3 0-3 1.7-3 4"/></g>',
  gem: '<path d="M6.5 9L12 3l5.5 6L12 20Z"/><path d="M6.5 9h11"/>',
  star: '<path d="M12 3.5l2.5 5.6 6.1.6-4.6 4.1 1.3 6-5.3-3.2-5.3 3.2 1.3-6-4.6-4.1 6.1-.6Z"/>',
  // item/profiles.js の #i-lightbulb シンボルと同一パスデータ（達成率ゼロ時のヒント表示用。
  // tai-hub共有js/icon-sprite.jsには無いため、他アイコン同様このファイル内で完結させている）
  lightbulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-6 6c0 2.5 1.5 4 2.5 5.5.5.7.5 1 .5 1.5h6c0-.5 0-.8.5-1.5C16.5 13 18 11.5 18 9a6 6 0 0 0-6-6Z"/>',
  lock: '<g transform="translate(12 12) scale(1.094) translate(-12 -12)"><path d="M6.5 11h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z"/><path d="M8 11V8a4 4 0 1 1 8 0v3"/></g>',
};
function iconHtml(name) {
  return `<svg class="inline-icon" width="16" height="16" viewBox="0 0 24 24">${ICON_PATHS[name]}</svg>`;
}

// item/profiles.js の TITLES 配列を verbatim移植（id・name・nameEn・
// descJa・descEn・conditionは一切変更していない。iconだけ上記
// ICON_PATHS経由の自前描画に差し替え——見た目は同一パスデータ）。
export const TITLES = [
  { id: 'rate25', icon: iconHtml('candle'), name: '灯火の旅人', nameEn: 'Traveler of the Flame', descJa: '全アイテムの所持率が25%に到達', descEn: 'Reached 25% overall ownership', condition: hwm => hwm.overallPct >= 25 },
  { id: 'rate50', icon: iconHtml('moon'), name: '星屑の収集家', nameEn: 'Stardust Collector', descJa: '全アイテムの所持率が50%に到達', descEn: 'Reached 50% overall ownership', condition: hwm => hwm.overallPct >= 50 },
  { id: 'rate75', icon: iconHtml('sparkle'), name: '煌めきの探究者', nameEn: 'Seeker of Radiance', descJa: '全アイテムの所持率が75%に到達', descEn: 'Reached 75% overall ownership', condition: hwm => hwm.overallPct >= 75 },
  { id: 'rate100', icon: iconHtml('crown'), name: '光の守護者', nameEn: 'Guardian of the Light', descJa: '登録した全アイテムを100%所持', descEn: 'Reached 100% overall ownership', condition: hwm => hwm.overallPct >= 100 },
  { id: 'catmaster1', icon: iconHtml('medal'), name: 'コレクションの第一歩', nameEn: 'First Steps of a Collection', descJa: 'いずれか1カテゴリを100%達成', descEn: 'Completed at least 1 category', condition: hwm => hwm.masteredCount >= 1 },
  { id: 'catmaster6', icon: iconHtml('trophy'), name: '熟練コレクター', nameEn: 'Master Collector', descJa: '6カテゴリ以上を100%達成', descEn: 'Completed 6 or more categories', condition: hwm => hwm.masteredCount >= 6 },
  { id: 'spend1k', icon: iconHtml('coin'), name: '灯火の支援者', nameEn: 'Supporter of the Flame', descJa: '実額の合計が¥1,000に到達', descEn: 'Real-money total reached ¥1,000', condition: hwm => hwm.moneySpentMax >= 1000 },
  { id: 'spend5k', icon: iconHtml('gift'), name: '季節の後援者', nameEn: "Patron of the Season", descJa: '実額の合計が¥5,000に到達', descEn: 'Real-money total reached ¥5,000', condition: hwm => hwm.moneySpentMax >= 5000 },
  { id: 'spend15k', icon: iconHtml('gem'), name: '彩りの後援者', nameEn: 'Patron of Colors', descJa: '実額の合計が¥15,000に到達', descEn: 'Real-money total reached ¥15,000', condition: hwm => hwm.moneySpentMax >= 15000 },
  { id: 'spend30k', icon: iconHtml('sparkle'), name: '星空の大後援者', nameEn: 'Grand Patron of the Stars', descJa: '実額の合計が¥30,000に到達', descEn: 'Real-money total reached ¥30,000', condition: hwm => hwm.moneySpentMax >= 30000 },
  { id: 'spend50k', icon: iconHtml('star'), name: '光の大後援者', nameEn: 'Grand Patron of Light', descJa: '実額の合計が¥50,000に到達', descEn: 'Real-money total reached ¥50,000', condition: hwm => hwm.moneySpentMax >= 50000 },
];

/* ================================================================
   💴 実額合計（moneySpentMax の元データ）
   cost-view.js が renderSummary() の末尾で、item/item_cost.html と
   完全に同じキー名 itemCostMoneySum_v1（nsKey経由）に「直近の実額合計」
   を書き続けている（互換維持のためのミラー書き込み——cost-view.js内の
   コメント参照）。ここではそのキーを item/profiles.js の
   titleMoneySpentStat() と全く同じ読み方で読むだけで、実額の計算自体を
   再実装・複製はしない（cost-view.jsが「唯一の実額計算ロジック」で
   あり続ける）。cost_viewを一度も開いていない場合は0のまま。
   ================================================================ */
const MONEY_SPENT_KEY = 'itemCostMoneySum_v1';
function currentMoneySpentStat() {
  const v = Number(localStorage.getItem(nsKey(MONEY_SPENT_KEY)));
  return isFinite(v) && v > 0 ? v : 0;
}

/* ================================================================
   カテゴリ別アイテム総数（item/profiles.js の titleCatStats() 相当）。
   元実装は gameItems_<catKey> の生localStorageから total/owned を直接
   読んでいた（かつ「一度もそのカテゴリページを開いていなければ集計から
   除外する」ゲートがあった）が、tai-hubではdashboard-view.js/cost-view.js
   と同じ既存の慣例（data/items/<catKey>.js の静的ITEMS配列長を「その
   カテゴリの総アイテム数」として扱う）に合わせ、getCategoryState() +
   dynamic importで求める。総アイテム数が常にローカルの静的データから
   分かるtai-hubでは「未訪問だから除外」という状態自体が実質存在しない
   ため、12カテゴリを常にすべて集計対象にする（下部の簡略化コメント参照）。
   ================================================================ */
const itemCountCache = new Map(); // catKey -> Promise<number>
function loadCategoryItemCount(catKey) {
  if (!itemCountCache.has(catKey)) {
    itemCountCache.set(catKey, import(`./data/items/${catKey}.js`)
      .then(mod => (Array.isArray(mod.ITEMS) ? mod.ITEMS.length : 0))
      .catch(e => {
        console.error(`[item titles] failed to load item data: ${catKey}`, e);
        return 0;
      }));
  }
  return itemCountCache.get(catKey);
}

// 12カテゴリぶんの {owned, total} と、その合計を返す
async function computeCategoryTotals() {
  const entries = await Promise.all(TITLE_CAT_KEYS.map(async catKey => {
    const total = await loadCategoryItemCount(catKey);
    const owned = Object.values(getCategoryState(catKey).owned).filter(Boolean).length;
    return [catKey, { owned, total }];
  }));
  const perCat = Object.fromEntries(entries);
  const sumOwned = entries.reduce((s, [, v]) => s + v.owned, 0);
  const sumTotal = entries.reduce((s, [, v]) => s + v.total, 0);
  return { perCat, sumOwned, sumTotal };
}

/* ================================================================
   🏆 判定：現在の所持データからハイウォーターマークを更新し、
   新規解禁分の称号一覧を返す。
   item/profiles.js の checkAndUnlockTitles() と同じアルゴリズム
   （perCatのpctMaxはMath.maxで単調増加、overallPct/masteredCount/
   moneySpentMaxも同様——一度解禁した称号は所持を外しても取り消されない）。
   ================================================================ */
export async function checkAndUnlockTitles() {
  const store = loadTitleStore();
  const { perCat, sumOwned, sumTotal } = await computeCategoryTotals();

  TITLE_CAT_KEYS.forEach(catKey => {
    const { owned, total } = perCat[catKey];
    const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
    const prevMax = (store.hwm.perCat[catKey] && store.hwm.perCat[catKey].pctMax) || 0;
    store.hwm.perCat[catKey] = { pctMax: Math.max(prevMax, pct) };
  });

  const overallPct = sumTotal > 0 ? Math.round((sumOwned / sumTotal) * 100) : 0;
  store.hwm.overallPct = Math.max(store.hwm.overallPct, overallPct);

  // perCatのpctMaxは既にhwmなので、そこから数える制覇数も自然と単調増加になる
  const masteredCount = Object.values(store.hwm.perCat).filter(c => c.pctMax >= 100).length;
  store.hwm.masteredCount = Math.max(store.hwm.masteredCount, masteredCount);

  store.hwm.moneySpentMax = Math.max(store.hwm.moneySpentMax || 0, currentMoneySpentStat());

  const newlyEarned = [];
  TITLES.forEach(t => {
    if (store.earned[t.id]) return;
    if (t.condition(store.hwm)) {
      store.earned[t.id] = new Date().toISOString();
      newlyEarned.push(t);
    }
  });

  saveTitleStore(store);
  return newlyEarned;
}

/* ================================================================
   描画：全体達成率ゲージ（円形SVG）＋ 称号チップ列
   ゲージは「今この瞬間の実際の所持率」（hwmではない）を表示する。
   item/index.html の loadAndRender() と同じ考え方（円周 r=38,
   C=2πr≈238.8。stroke-dashoffsetをC*(1-pct/100)へアニメーションさせる）。
   ================================================================ */
const GAUGE_CIRC = 238.76; // 2 * Math.PI * 38

function chipHtml(t, store) {
  const en = CURRENT_LANG === 'en';
  if (!store.earned[t.id]) {
    return `
      <div class="titp-chip locked" title="${escapeHtml(en ? 'Unlocks when you meet its condition' : '称号は条件を満たすと明らかになります')}">
        <span class="titp-chip-icon">${iconHtml('lock')}</span>
        <span class="titp-chip-name">？？？</span>
      </div>`;
  }
  return `
    <div class="titp-chip" title="${escapeHtml(en ? t.descEn : t.descJa)}">
      <span class="titp-chip-icon">${t.icon}</span>
      <span class="titp-chip-name">${escapeHtml(en ? t.nameEn : t.name)}</span>
    </div>`;
}

async function renderPanel(container) {
  if (!container) return;
  const en = CURRENT_LANG === 'en';
  const store = loadTitleStore();
  const { sumOwned, sumTotal } = await computeCategoryTotals();
  if (!document.body.contains(container)) return; // await中に別ルートへ遷移済みなら描画しない
  // 🩹 元実装（item/index.html）はsumTotalが「訪問済みカテゴリのみの合計」だったため、
  // 未訪問（=データ未登録）の状態ではsumTotal===0となり自然に'--'表示になっていた。
  // tai-hubはdata/items/<catKey>.jsの静的配列から常に全カテゴリの総数が分かるため
  // sumTotalは実質常に>0になり、この判定のままだと「フレッシュなプロフィールでも
  // 0%と表示され、'--'のプレースホルダーもヒントも出ない」という表示差分が生まれる。
  // 総数を都度知れるtai-hubの前提を維持しつつ元のUXに近づけるため、判定を
  // 「何か1つでも所持しているか」に置き換える（達成率の計算式自体は変更しない）。
  const hasAnyOwned = sumOwned > 0;
  const pct = hasAnyOwned ? Math.round((sumOwned / sumTotal) * 100) : null;
  const earnedCount = TITLES.filter(t => store.earned[t.id]).length;

  container.innerHTML = `
    <p class="sec-label">${en ? 'Overall Completion Rate' : '全体の達成率'}</p>
    <div class="titp-gauge-card">
      <div class="titp-gauge-wrap">
        <svg class="titp-gauge-svg" viewBox="0 0 96 96">
          <circle class="titp-g-track" cx="48" cy="48" r="38"/>
          <circle class="titp-g-fill" cx="48" cy="48" r="38"/>
        </svg>
        <div class="titp-gauge-center">
          <div class="titp-gauge-pct">${pct !== null ? `${pct}<span class="titp-gauge-pct-unit">%</span>` : '--%'}</div>
          <div class="titp-gauge-lbl">TOTAL</div>
        </div>
      </div>
      <div class="titp-gauge-text">
        <div class="titp-gauge-title">${en ? 'Collection Completion Rate' : 'コレクション達成率'}</div>
        <div class="titp-gauge-nums">
          <div>
            <div class="titp-gauge-num">${hasAnyOwned ? sumOwned : '--'}</div>
            <div class="titp-gauge-num-lbl">${en ? 'Owned' : '所持中'}</div>
          </div>
          <div>
            <div class="titp-gauge-num" style="opacity:.72">${hasAnyOwned ? sumTotal : '--'}</div>
            <div class="titp-gauge-num-lbl">${en ? 'Total Items' : '総アイテム数'}</div>
          </div>
        </div>
      </div>
    </div>
    ${!hasAnyOwned ? `
    <div class="titp-hint">
      <span class="titp-hint-icon">${iconHtml('lightbulb')}</span>
      <span>${en ? 'Register items on each category page and your completion rate will automatically appear here' : '各カテゴリページでアイテムを登録すると、ここに所持率が自動で反映されます'}</span>
    </div>` : ''}

    <div id="titpCondRates"></div>

    <p class="sec-label">${en ? 'Titles' : '称号'}<span class="titp-titles-count">${en ? `${earnedCount} / ${TITLES.length} unlocked` : `${earnedCount} / ${TITLES.length} 個解除`}</span></p>
    <div class="titp-panel">${TITLES.map(t => chipHtml(t, store)).join('')}</div>
  `;

  // 条件別の達成率（無課金・限定など）。ゲージと称号チップ列の間に差し込む
  conditionRates.mount(container.querySelector('#titpCondRates'));

  // ゲージのアニメーション（初期状態→次フレームで目標値へ。item/index.htmlのrequestAnimationFrame方式と同じ）
  const fillEl = container.querySelector('.titp-g-fill');
  if (fillEl) {
    fillEl.style.strokeDasharray = GAUGE_CIRC;
    fillEl.style.strokeDashoffset = GAUGE_CIRC;
    requestAnimationFrame(() => {
      fillEl.style.strokeDashoffset = pct !== null ? GAUGE_CIRC * (1 - pct / 100) : GAUGE_CIRC;
    });
  }
}

/* ================================================================
   🔔 簡易トースト通知（category-view.js の showCatViewToast /
   cost-view.js の showToast と同じ見た目・タイミングの自前実装。
   tai-hubには全体共通のshowToastが無いため、各ビューファイルが
   スコープ付きクラス名で自前実装するのが既存の慣例）
   ================================================================ */
function showToast(msg) {
  const el = document.createElement('div');
  el.className = 'titp-toast';
  el.textContent = msg;
  const stackIndex = document.querySelectorAll('.titp-toast').length;
  if (stackIndex > 0) el.style.bottom = `calc(84px + env(safe-area-inset-bottom) + ${stackIndex * 44}px)`;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2600);
}

/* ================================================================
   スコープ付きスタイル注入（初回mount時のみ。他機能ビューと同じ
   `.item-view .xxx` プレフィックス——css/item.css がデザイントークンを
   .item-view スコープでしか定義していないため、呼び出し側は
   .item-view の子孫としてcontainerを配置すること）
   ================================================================ */
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.item-view .titp-gauge-card {
  background: linear-gradient(135deg, var(--orange-d) 0%, var(--orange) 55%, #FFBB00 100%);
  border-radius: var(--r); padding: 22px 20px; color: #fff;
  position: relative; overflow: hidden;
  box-shadow: 0 4px 18px rgba(255,120,0,0.28);
  display: flex; align-items: center; gap: 18px;
}
.item-view .titp-gauge-card::before {
  content: ''; position: absolute; top: -40px; right: -30px; width: 180px; height: 180px;
  background: rgba(255,255,255,0.09); border-radius: 50%; pointer-events: none;
}
.item-view .titp-gauge-card::after {
  content: ''; position: absolute; bottom: -60px; right: 60px; width: 220px; height: 220px;
  background: rgba(255,255,255,0.05); border-radius: 50%; pointer-events: none;
}
.item-view .titp-gauge-wrap { flex-shrink: 0; position: relative; width: 96px; height: 96px; z-index: 1; }
.item-view .titp-gauge-svg { width: 96px; height: 96px; transform: rotate(-90deg); }
.item-view .titp-g-track { fill: none; stroke: rgba(255,255,255,0.28); stroke-width: 8; }
.item-view .titp-g-fill {
  fill: none; stroke: #fff; stroke-width: 8; stroke-linecap: round;
  stroke-dasharray: 238.8; stroke-dashoffset: 238.8;
  transition: stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1);
}
.item-view .titp-gauge-center {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
}
.item-view .titp-gauge-pct { font-size: 21px; font-weight: 700; letter-spacing: -0.5px; line-height: 1; color: #fff; }
.item-view .titp-gauge-pct-unit { font-size: 13px; }
.item-view .titp-gauge-lbl { font-size: 8px; opacity: 0.78; margin-top: 3px; letter-spacing: 0.8px; }
.item-view .titp-gauge-text { flex: 1; min-width: 0; z-index: 1; }
.item-view .titp-gauge-title { font-size: 13px; opacity: 0.85; margin-bottom: 12px; letter-spacing: 0.2px; }
.item-view .titp-gauge-nums { display: flex; gap: 24px; }
.item-view .titp-gauge-num { font-size: 26px; font-weight: 700; letter-spacing: -0.8px; line-height: 1; color: #fff; }
.item-view .titp-gauge-num-lbl { font-size: 11px; opacity: 0.8; margin-top: 4px; }

/* 達成率ゼロ（所持アイテム0件）時のヒント。item/index.htmlの.hintと同じ見た目 */
.item-view .titp-hint {
  margin-top: 10px; background: var(--blue-bg); border-radius: var(--r-sm);
  padding: 12px 14px; font-size: 12px; color: var(--blue); line-height: 1.65;
  display: flex; gap: 6px;
}
.item-view .titp-hint-icon { display: flex; flex-shrink: 0; }

/* .sec-label（親要素）の text-transform:uppercase / letter-spacing がこのカウント表示にも
   継承されてしまう（英語表示時に UNLOCKED と大文字化される等）ため、明示的に打ち消す
   （item/profiles.js の .titles-count と同じ対処） */
.item-view .titp-titles-count { font-size: 12px; font-weight: 700; color: var(--text-2); text-transform: none; letter-spacing: normal; margin-left: 8px; }

.item-view .titp-panel { display: flex; flex-wrap: wrap; gap: 8px; }
.item-view .titp-chip {
  display: flex; align-items: center; gap: 6px; background: var(--orange-bg);
  border: 1px solid var(--orange); border-radius: 20px; padding: 6px 12px 6px 8px;
}
.item-view .titp-chip-icon { display: flex; }
/* item/profiles.js の --orange-current（WCAG AA対応のため通常のorange-dより暗い専用トークン、
   ダークモードのみorange-dへ切替）を、新規のCSS変数を増やさずこの値だけ直接複製して再現 */
.item-view .titp-chip-name { font-size: 12.5px; font-weight: 700; color: #B34700; white-space: nowrap; }
[data-theme="dark"] .item-view .titp-chip-name { color: var(--orange-d); }
.item-view .titp-chip.locked { background: var(--bg); border-color: var(--sep); }
.item-view .titp-chip.locked .titp-chip-name { color: var(--text-3); font-weight: 600; }

.titp-toast {
  position: fixed; left: 50%; bottom: calc(84px + env(safe-area-inset-bottom)); transform: translateX(-50%) translateY(20px);
  background: rgba(28,28,30,0.92); color: #fff; font-size: 13px; font-weight: 600; padding: 10px 18px; border-radius: 999px;
  box-shadow: 0 4px 14px rgba(0,0,0,0.25); opacity: 0; transition: opacity 0.25s, transform 0.25s; z-index: 999;
  pointer-events: none; max-width: calc(100vw - 32px); text-align: center;
}
.titp-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
`;
  document.head.appendChild(style);
}

/* ================================================================
   エクスポート
   ================================================================ */

// container.innerHTML を丸ごと描画する。何度呼んでも安全（冪等な再描画）。
// 呼ぶたびにcheckAndUnlockTitles()も実行し最新のhwm/earnedを反映するが、
// トーストは出さない（初回mount・ルート遷移での毎回の「静かな」更新用）。
export async function mount(container) {
  injectStyles();
  // 🩹 checkAndUnlockTitles()→computeCategoryTotals()は全カテゴリ(最大12個)の
  // data/items/<key>.jsを動的importしてから初めてrenderPanel()がcontainerへ
  // 書き込む。dashboardはDEFAULT_ROUTEのためほぼ全ての初回起動でこの経路を
  // 通ることになり、対策が無いとダッシュボード上部の達成率ゲージ部分だけが
  // 「一瞬だけ素の状態（空欄）」になる——router-registry.jsのルート切替スピナー
  // と同じ見た目を先に出しておくことで解消する。
  if (container) container.innerHTML = '<div class="rt-loading"><div class="rt-spinner"></div></div>';
  await checkAndUnlockTitles();
  await renderPanel(container);
}

// checkAndUnlockTitles() → 新規解禁分のトースト → mount()と同じ再描画、を一括で行う。
// category-view.js の所持トグル・cost-view.js の実額再計算の直後から呼ぶ想定
// （まだ未配線——router-registry.js/dashboard-view.js/category-view.js/cost-view.js
// 側の配線は別パスで行う）。
export async function refresh(container) {
  injectStyles();
  const newlyEarned = await checkAndUnlockTitles();
  if (newlyEarned.length) {
    const en = CURRENT_LANG === 'en';
    const msg = newlyEarned.length === 1
      ? (en ? `Title unlocked: ${newlyEarned[0].nameEn}` : `称号解禁「${newlyEarned[0].name}」`)
      : (en ? `${newlyEarned.length} titles unlocked!` : `称号を${newlyEarned.length}個解禁！`);
    showToast(msg);
  }
  await renderPanel(container);
}

/* ================================================================
   既知の簡略化・省略事項（元 item/profiles.js・item/index.html との差分）

   1. カテゴリ集計の「未訪問ゲート」を撤廃した。元実装のtitleCatStats()は
      gameItems_<catKey> が未保存（＝そのカテゴリページを一度も開いていない）
      場合、overallPct/masteredCountの集計対象から丸ごと除外していた。
      tai-hubでは12カテゴリすべての総アイテム数が data/items/<catKey>.js
      の静的配列として常にローカルへバンドルされており
      （dashboard-view.js・cost-view.jsも同じ前提で総数を出している）、
      「未訪問だから総数が分からない」という状態が実質存在しないため、
      本モジュールでは常に12カテゴリすべてを対象にしている（未所持なら
      owned:0のまま集計に加わるだけで、達成率の分母は変わらず総アイテム数
      ベースになる）。数値上は「初回訪問前は集計対象外」→「初回から
      0/総数として集計対象」という違いのみで、実際の達成率計算式・
      称号解禁条件そのものは変更していない。

   2. --orange-current というCSS変数は新規に追加せず、その値
      （ライトモード#B34700／ダークモードはvar(--orange-d)）を
      .titp-chip-name に直接複製した。元実装がWCAG AA未達を理由に
      通常のorange-dより暗い専用トークンを使っていた経緯をそのまま
      踏襲しつつ、共有ファイル css/item.css には手を入れないための対応。

   3. アイコンをtai-hub共有の js/icon-sprite.js への <use href> 参照では
      なく、このファイル内に複製したパスデータの直接描画にした
      （共有スプライトに i-medal/i-trophy/i-coin/i-gift/i-lock が無く、
      他パスが並行編集中の共有ファイルを増やしたくないため）。見た目は
      元のアイコンと同一。
   ================================================================ */

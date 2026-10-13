/* ================================================================
   状態・ストレージ層。item/profiles.js の核（プロフィールCRUD・
   nsKey/nsKeyFor・カテゴリ所持状態・wishlist・入手ログ・テーマ・
   エクスポート/インポート）を、キー名・データ形状を完全一致させて
   移植したもの。

   既存の item サイト（taipak5000.github.io/tai-item/）と同一オリジンで
   共有される localStorage を読み書きするため、ここで形状を変えると
   既存ユーザーのデータ互換性が壊れる。値の意味を変える変更はしないこと。
   ================================================================ */

import { CURRENT_LANG } from './i18n.js';

export const PROFILES_KEY = 'skyProfiles_v1';
export const ACTIVE_PROFILE_KEY = 'skyActiveProfile_v1';
export const DEFAULT_PROFILE_ID = 'default';

export function pfDefaultName() {
  return CURRENT_LANG === 'en' ? 'Main' : 'メイン';
}

export function pfDisplayName(p) {
  return p.isDefaultName ? pfDefaultName() : p.name;
}

export function pfIsSafeId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id);
}

// アカウントカラー（任意）。item/profiles.js の pfIsSafeColor と同じく #RRGGBB 形式のみ許可する。
export function pfIsSafeColor(c) {
  return typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c);
}

export function loadProfiles() {
  try {
    let list = JSON.parse(localStorage.getItem(PROFILES_KEY));
    if (!Array.isArray(list)) return null;
    list = list.filter(p => p && pfIsSafeId(p.id) && typeof p.name === 'string');
    list = list.map(p => {
      if (p.color !== undefined && !pfIsSafeColor(p.color)) { const { color, ...rest } = p; return rest; }
      return p;
    });
    list = list.map(p => (
      p.id === DEFAULT_PROFILE_ID && p.isDefaultName === undefined && (p.name === 'メイン' || p.name === 'Main')
        ? { ...p, isDefaultName: true }
        : p
    ));
    if (list.length > 0) return list;
  } catch (_) { /* 破損データは初期状態として扱う */ }
  return null;
}

export function saveProfiles(list) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(list));
}

export function ensureProfilesInit() {
  let list = loadProfiles();
  if (!list) {
    list = [{ id: DEFAULT_PROFILE_ID, name: '', isDefaultName: true }];
    saveProfiles(list);
  }
  if (!localStorage.getItem(ACTIVE_PROFILE_KEY)) {
    localStorage.setItem(ACTIVE_PROFILE_KEY, DEFAULT_PROFILE_ID);
  }
  return list;
}

export function getActiveProfileId() {
  return localStorage.getItem(ACTIVE_PROFILE_KEY) || DEFAULT_PROFILE_ID;
}

export function getActiveProfile() {
  const list = ensureProfilesInit();
  return list.find(p => p.id === getActiveProfileId()) || list[0];
}

/* ================================================================
   🎨 プロフィールごとのアカウントカラー（任意）。item/profiles.js の
   pfApplyThemeColor/pfSetProfileColor/pfClearProfileColorを移植したもの。
   選んだ色はフォントやボタンではなく、画面背景へのうっすらとした
   色重ねとして反映する（--pf-tint-rgb をCSS側のbody背景で使う。
   css/tokens.css のbody { background: ... } 参照）。
   ================================================================ */
const PF_TINT_VAR = '--pf-tint-rgb';
function pfHexToRgb(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}
export function applyProfileTint(hex) {
  const root = document.documentElement.style;
  if (!hex || !pfIsSafeColor(hex)) { root.removeProperty(PF_TINT_VAR); return; }
  const c = pfHexToRgb(hex);
  root.setProperty(PF_TINT_VAR, `rgba(${c.r}, ${c.g}, ${c.b}, 0.07)`);
}
export function setProfileColor(id, color) {
  if (!pfIsSafeColor(color)) return;
  const list = ensureProfilesInit();
  const p = list.find(x => x.id === id);
  if (!p) return;
  p.color = color;
  saveProfiles(list);
  if (id === getActiveProfileId()) applyProfileTint(color);
}
export function clearProfileColor(id) {
  const list = ensureProfilesInit();
  const p = list.find(x => x.id === id);
  if (!p) return;
  delete p.color;
  saveProfiles(list);
  if (id === getActiveProfileId()) applyProfileTint(null);
}

export function switchProfile(id) {
  if (id === getActiveProfileId()) return;
  localStorage.setItem(ACTIVE_PROFILE_KEY, id);
  location.reload();
}

export function createProfile(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return;
  const list = ensureProfilesInit();
  const id = 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  list.push({ id, name: trimmed });
  saveProfiles(list);
  switchProfile(id);
}

export function renameProfile(id, name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return;
  const list = ensureProfilesInit();
  const p = list.find(pr => pr.id === id);
  if (!p) return;
  p.name = trimmed;
  p.isDefaultName = false;
  saveProfiles(list);
}

// プロフィールを複製する（tai-card移植のために追加——item自身にはこの機能は無い。
// 複製元プロフィール配下の全nsKey化キー（__p_<id>サフィックス、デフォルト
// プロフィールなら接尾辞なし）を新しいプロフィールIDの下へコピーする）
export function duplicateProfile(id) {
  const list = ensureProfilesInit();
  const src = list.find(p => p.id === id);
  if (!src) return;
  const newId = 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const baseName = pfDisplayName(src);
  const newName = CURRENT_LANG === 'en' ? `${baseName} Copy` : `${baseName}のコピー`;

  const suffix = id === DEFAULT_PROFILE_ID ? null : `__p_${id}`;
  const keysToCopy = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (suffix) {
      if (key.endsWith(suffix)) keysToCopy.push(key);
    } else if (!key.includes('__p_')) {
      // デフォルトプロフィールの複製時は、他プロフィール接尾辞を持たない
      // 「無印」キーが対象。ただしskyProfiles_v1/skyActiveProfile_v1等の
      // プロフィール機構自体のキーはコピー対象から除外する
      if (key === PROFILES_KEY || key === ACTIVE_PROFILE_KEY) continue;
      keysToCopy.push(key);
    }
  }
  keysToCopy.forEach(key => {
    const rawKey = suffix ? key.slice(0, -suffix.length) : key;
    const value = localStorage.getItem(key);
    if (value !== null) localStorage.setItem(nsKeyFor(rawKey, newId), value);
  });

  list.push({ id: newId, name: newName });
  saveProfiles(list);
  switchProfile(newId);
}

export function deleteProfile(id) {
  const list = ensureProfilesInit();
  if (list.length <= 1) return;
  const remaining = list.filter(p => p.id !== id);
  saveProfiles(remaining);
  if (getActiveProfileId() === id) {
    localStorage.setItem(ACTIVE_PROFILE_KEY, remaining[0].id);
    location.reload();
  }
}

/* ── 保存キーの名前空間化 ── */
export function nsKeyFor(rawKey, profileId) {
  return profileId === DEFAULT_PROFILE_ID ? rawKey : `${rawKey}__p_${profileId}`;
}
export function nsKey(rawKey) {
  return nsKeyFor(rawKey, getActiveProfileId());
}

/* ================================================================
   🗂️ カテゴリ所持状態
   localStorage キー: gameItems_<catKey>
   形状: { total, owned, itemOwned:{id:bool}, itemFav:{id:bool}, ownedItems:[{id,name,nameEn,img}] }
   （item/cape.html の saveUserData() と完全に同じ形状。total/owned/ownedItems は
   　書き込みのたびに items 配列から再計算する派生値で、他機能から参照されるため必須）
   ================================================================ */
export function getCategoryState(catKey) {
  try {
    const saved = localStorage.getItem(nsKey('gameItems_' + catKey));
    if (saved) {
      const parsed = JSON.parse(saved);
      return { owned: parsed.itemOwned || {}, fav: parsed.itemFav || {} };
    }
  } catch (e) { console.error('カテゴリ状態の読み込み失敗:', catKey, e); }
  return { owned: {}, fav: {} };
}

export function saveCategoryState(catKey, itemOwned, itemFav, itemsArray) {
  const total = itemsArray.length;
  const owned = itemsArray.filter(item => itemOwned[item.id]).length;
  const ownedItems = itemsArray
    .filter(item => itemOwned[item.id])
    .map(item => ({ id: item.id, name: item.name, nameEn: item.nameEn, img: item.img }));
  const dataToSave = { total, owned, itemOwned, itemFav, ownedItems };
  localStorage.setItem(nsKey('gameItems_' + catKey), JSON.stringify(dataToSave));
}

export function isItemOwned(catKey, itemId) {
  return !!getCategoryState(catKey).owned[itemId];
}
export function isItemFav(catKey, itemId) {
  return !!getCategoryState(catKey).fav[itemId];
}

/* ── 表示設定（非名前空間化・プロフィール共通） ── */
export const VIEW_MODE_KEY = 'gameItems_viewMode';
export const GRID_COLS_KEY = 'gameItems_gridCols';
export function getViewMode() { return localStorage.getItem(VIEW_MODE_KEY) || 'grid'; }
export function setViewMode(mode) { localStorage.setItem(VIEW_MODE_KEY, mode); }
export function getGridCols() { return localStorage.getItem(GRID_COLS_KEY) || 'auto'; }
export function setGridCols(cols) { localStorage.setItem(GRID_COLS_KEY, cols); }

/* ================================================================
   🛒 ウィッシュリスト。localStorage キー: wish_<catKey> = JSON array of item IDs
   ================================================================ */
export function getWishIds(catKey) {
  try { return JSON.parse(localStorage.getItem(nsKey('wish_' + catKey))) || []; }
  catch { return []; }
}
export function isWishItem(catKey, itemId) {
  return getWishIds(catKey).includes(String(itemId));
}
export function removeWishItem(catKey, itemId) {
  const id = String(itemId);
  const wishes = getWishIds(catKey);
  const idx = wishes.indexOf(id);
  if (idx === -1) return;
  wishes.splice(idx, 1);
  localStorage.setItem(nsKey('wish_' + catKey), JSON.stringify(wishes));
}
export function toggleWishItem(catKey, itemId) {
  const id = String(itemId);
  const wishes = getWishIds(catKey);
  const idx = wishes.indexOf(id);
  const isAdding = idx === -1;
  if (isAdding && isItemOwned(catKey, id)) return null;
  if (isAdding) wishes.push(id); else wishes.splice(idx, 1);
  localStorage.setItem(nsKey('wish_' + catKey), JSON.stringify(wishes));
  return isAdding;
}

/* ================================================================
   📅 アイテム獲得（所持登録）ログ
   localStorage キー: itemAcquireLog_v1 = { [itemId]: { catKey, at: ISO日時 } }
   ================================================================ */
export function recordItemAcquire(catKey, itemId) {
  const key = nsKey('itemAcquireLog_v1');
  let log;
  try { log = JSON.parse(localStorage.getItem(key)) || {}; } catch { log = {}; }
  log[itemId] = { catKey, at: new Date().toISOString() };
  localStorage.setItem(key, JSON.stringify(log));
  removeWishItem(catKey, itemId);
}
export function removeItemAcquireRecord(itemId) {
  const key = nsKey('itemAcquireLog_v1');
  let log;
  try { log = JSON.parse(localStorage.getItem(key)) || {}; } catch { log = {}; }
  if (log[itemId]) {
    delete log[itemId];
    localStorage.setItem(key, JSON.stringify(log));
  }
}
export function getItemAcquireLog() {
  try { return JSON.parse(localStorage.getItem(nsKey('itemAcquireLog_v1'))) || {}; }
  catch { return {}; }
}

/* ================================================================
   🎖️ 称号（itemTitles_v1）。今回のプロトタイプでは称号カタログUI全体の
   完全移植までは行わず、保存レイヤーだけ互換維持する（README参照）。
   ================================================================ */
export const TITLES_KEY = 'itemTitles_v1';
export function loadTitleStore() {
  try {
    const d = JSON.parse(localStorage.getItem(nsKey(TITLES_KEY)));
    if (d && typeof d === 'object') {
      return {
        earned: d.earned || {},
        hwm: {
          perCat: (d.hwm && d.hwm.perCat) || {},
          overallPct: (d.hwm && d.hwm.overallPct) || 0,
          masteredCount: (d.hwm && d.hwm.masteredCount) || 0,
          moneySpentMax: (d.hwm && d.hwm.moneySpentMax) || 0,
        },
      };
    }
  } catch (e) { /* 破損データは初期状態として扱う */ }
  return { earned: {}, hwm: { perCat: {}, overallPct: 0, masteredCount: 0, moneySpentMax: 0 } };
}
export function saveTitleStore(store) {
  localStorage.setItem(nsKey(TITLES_KEY), JSON.stringify(store));
}

// 他ツールの実績（*Titles_v1）を読み取り専用で参照するためのカタログ。
// 各サイトは別デプロイのため共有できず、item/profiles.js のCROSS_TOOL_TITLE_CATALOGを
// そのまま複製している（storageKeyとnamespacedの対応はそちらと1対1）。
export const CROSS_TOOL_TITLE_CATALOG = {
  emote: { storageKey: 'emoteTitles_v1', namespaced: true, source: 'エモート所持率管理', sourceEn: 'Emote Ownership Tracker', extract: d => Object.keys(d || {}) },
  wings: { storageKey: 'wingsTitles_v1', namespaced: true, source: '羽トラッカー', sourceEn: 'Wings Tracker', extract: d => Object.keys(d || {}) },
  spirit: { storageKey: 'spiritCatalogTitles_v1', namespaced: true, source: '精霊ツリー管理', sourceEn: 'Spirit Tree Catalog', extract: d => Object.keys(d || {}) },
  score: { storageKey: 'taiScoreTitles_v1', namespaced: true, source: '楽譜づくり', sourceEn: 'Sheet Music Maker', extract: d => ((d && d.earned) || []).map(e => e.id) },
  share: { storageKey: 'shareTitles_v1', namespaced: true, source: '創作物管理ツール', sourceEn: 'Creation Manager', extract: d => ((d && d.earned) || []).map(e => e.id) },
  nomacan: { storageKey: 'skyNomacanTitles_v1', namespaced: true, source: 'ノマキャン計算機', sourceEn: 'Candle Calculator', extract: d => Object.keys((d && d.earned) || {}) },
  starcandle: { storageKey: 'skyStarCandleCalc_titles_v1', namespaced: true, source: '星のキャンドル計算機', sourceEn: 'Star Candle Calculator', extract: d => Object.keys((d && d.earned) || {}) },
};
export function getCrossToolTitleCount(toolKey, profileId) {
  const tool = CROSS_TOOL_TITLE_CATALOG[toolKey];
  if (!tool) return 0;
  const key = tool.namespaced ? nsKeyFor(tool.storageKey, profileId) : tool.storageKey;
  try {
    const d = JSON.parse(localStorage.getItem(key));
    return tool.extract(d).length;
  } catch { return 0; }
}

/* ================================================================
   🌓 表示設定（ダークモード）。taipak5000.github.io 配下の全ツール共通キー。
   ================================================================ */
export const SKY_THEME_KEY = 'sky_app_theme';
export function applyThemeToDOM(isDark) {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}
export function resolveSkyTheme(stored) {
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
export function getSkyThemeMode() {
  try {
    const v = localStorage.getItem(SKY_THEME_KEY);
    return (v === 'light' || v === 'dark') ? v : 'system';
  } catch (e) { return 'system'; }
}
export function toggleTheme() {
  const current = getSkyThemeMode();
  const next = current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light';
  applyThemeToDOM(resolveSkyTheme(next) === 'dark');
  try { localStorage.setItem(SKY_THEME_KEY, next); } catch (e) { /* private browsing等 */ }
  return next;
}

/* ================================================================
   🏠 起動時に開くツール（ハッシュ無しで開いた時に表示する画面）。
   tai-hub専用の端末単位の設定（プロフィール非依存なのでnsKey化しない）。
   未設定＝従来どおり既定（item）。値の妥当性（ROUTESに存在するか）は
   router.js側で確認する。
   ================================================================ */
export const SKY_START_ROUTE_KEY = 'sky_hub_start_route';
export function getStartRoute() {
  try {
    const v = localStorage.getItem(SKY_START_ROUTE_KEY);
    return v && /^[A-Za-z0-9_-]{1,40}$/.test(v) ? v : '';
  } catch (e) { return ''; }
}
export function setStartRoute(key) {
  try {
    if (key && /^[A-Za-z0-9_-]{1,40}$/.test(key)) localStorage.setItem(SKY_START_ROUTE_KEY, key);
    else localStorage.removeItem(SKY_START_ROUTE_KEY);
  } catch (e) { /* private browsing等 */ }
}

/* ================================================================
   ⌨️ キーボードショートカット有効/無効。taipak5000.github.io 配下の
   全ツール共通キー（未設定＝有効扱い。item/profiles.jsのskyShortcutsEnabled
   と同じ規約）。実際のキー入力ディスパッチはjs/shortcuts.jsが担う。
   ================================================================ */
export const SKY_SHORTCUTS_KEY = 'sky_shortcuts_enabled';
export function getShortcutsEnabled() {
  try {
    const v = localStorage.getItem(SKY_SHORTCUTS_KEY);
    return v === null ? true : v === '1';
  } catch (e) { return true; }
}
export function setShortcutsEnabled(checked) {
  try { localStorage.setItem(SKY_SHORTCUTS_KEY, checked ? '1' : '0'); } catch (e) { /* private browsing等 */ }
}

/* ================================================================
   🏆 称号表示のオン/オフ設定。taipak5000.github.io 配下の全ツール共通キー
   （未設定＝オン扱い、SKY_SHORTCUTS_KEYと同じ規約）。プロフィール切替
   モーダル（js/chrome/pf-modal.js）の実績数バッジ表示に反映する。
   端末単位（プロフィール非依存）の表示設定なのでnsKey化しない。
   ================================================================ */
export const SKY_SHOW_TITLES_KEY = 'sky_pf_show_titles';
export function getShowTitlesEnabled() {
  try {
    const v = localStorage.getItem(SKY_SHOW_TITLES_KEY);
    return v === null ? true : v === '1';
  } catch (e) { return true; }
}
export function setShowTitlesEnabled(checked) {
  try { localStorage.setItem(SKY_SHOW_TITLES_KEY, checked ? '1' : '0'); } catch (e) { /* private browsing等 */ }
}

/* ================================================================
   💰 プロフィールごとの所持通貨（プロフィール切替モーダルの所持通貨編集）。
   item/profiles.js の pfLoadCurrency/pfSaveCurrencyField を移植したもの。
   candle/heart/starCandleはitem/star-candle等が既に読み書きしているキー
   （wishOwnCurrency）を、seasonCandleはcompanionの保存データ内の
   ownedCandlesフィールドを直接読み書きし、二重管理を避ける。
   昇華キャンドル以外の追加通貨（ギフトパス等）は、それを使う機能自体が
   tai-hubにまだ移植されていないため、このプロトタイプでは含めない。
   ================================================================ */
export const CURRENCY_WISH_KEY = 'wishOwnCurrency';
export const CURRENCY_COMPANION_KEY = 'sky_companion_v4_data';
export function loadOwnedCurrency(profileId = getActiveProfileId()) {
  let wish;
  try { wish = JSON.parse(localStorage.getItem(nsKeyFor(CURRENCY_WISH_KEY, profileId))) || {}; } catch (e) { wish = {}; }
  let companionData;
  try { companionData = JSON.parse(localStorage.getItem(nsKeyFor(CURRENCY_COMPANION_KEY, profileId))) || {}; } catch (e) { companionData = {}; }
  return {
    candle: wish.candle || 0,
    heart: wish.heart || 0,
    starCandle: wish.starCandle || 0,
    seasonCandle: companionData.ownedCandles || 0,
  };
}
export function saveOwnedCurrencyField(field, rawValue, profileId = getActiveProfileId()) {
  // pf-modal.js側はnumber inputではなくtext+inputmode="numeric"（桁区切り
  // カンマを表示するため）を使っているので、カンマ等の非数字を先に除去する。
  const cleaned = String(rawValue).replace(/[^0-9.-]/g, '');
  const n = Math.max(0, Math.floor(Number(cleaned)) || 0);
  if (field === 'seasonCandle') {
    const key = nsKeyFor(CURRENCY_COMPANION_KEY, profileId);
    let data;
    try { data = JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { data = {}; }
    data.ownedCandles = n;
    localStorage.setItem(key, JSON.stringify(data));
  } else {
    const key = nsKeyFor(CURRENCY_WISH_KEY, profileId);
    let wish;
    try { wish = JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { wish = {}; }
    wish[field] = n;
    localStorage.setItem(key, JSON.stringify(wish));
  }
  return n;
}

/* ================================================================
   💾 データのエクスポート/インポート/全削除
   localStorage は taipak5000.github.io 配下の全ツールで共有されているため、
   ここで書き出す/読み込む/消す内容はこのサイトだけでなく item・wings・
   companion 等すべてのデータが対象になる（item/profiles.js の dmExport等と同一挙動）。
   ================================================================ */
export function exportAllData() {
  const dump = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    dump[key] = localStorage.getItem(key);
  }
  const payload = { exportedFrom: 'taipak5000.github.io', exportedAt: new Date().toISOString(), data: dump };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `sky-tools-backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return Object.keys(dump).length;
}

export function parseImportFile(jsonText) {
  const parsed = JSON.parse(jsonText);
  const data = parsed && parsed.data && typeof parsed.data === 'object' ? parsed.data : null;
  return data;
}

export function importAllData(data) {
  let okCount = 0;
  const failedKeys = [];
  Object.keys(data).forEach(key => {
    try { localStorage.setItem(key, data[key]); okCount++; }
    catch (e) { failedKeys.push(key); }
  });
  return { okCount, failedKeys };
}

export function wipeAllData() {
  localStorage.clear();
}


/* ================================================================
   data-transfer（データ引継ぎ）の状態・ストレージ層。

   移植元: C:\Users\user\Downloads\skyツール\tai-transfer\index.html
   （~2893行のスタンドアロンページ）の <script> 内、UI描画を伴わない
   純粋なロジック部分（SITE_CATALOG・キー照合・プロフィールマージ・
   サイト別スナップショット・圧縮コード変換・内容差分の集計）。

   ⚠️ SITE_CATALOG とそこに列挙された生のキー名は、姉妹サイト
   （item/wings/companion/star-candle/tai-nomacan/share/tai-emote/
   spirit-catalog/tai-score/tai-card/skyzztai/ホーム画面アイコン設定）
   が実際に localStorage へ書き込んでいるキー名と1文字も変えずに
   一致させる必要がある（このツールの存在意義そのものであり、
   変更すると引き継ぎ機能自体が壊れる）。要素の追加・削除・ラベル文言の
   変更も含め、元のcatalogと完全に同じ内容を維持すること。

   一方、このツール自身の内部管理専用キー（SITE_SNAPSHOT_KEY等、
   どのSITE_CATALOGエントリのkeysにも一致しない＝引き継ぎコードには
   絶対に含まれない）は、tai-hub の複数プロフィール機構に合わせて
   nsKey() で名前空間化した（デフォルトプロフィールでは nsKey() は
   rawKeyをそのまま返すため、既存ユーザーの記録はキー名を変えず
   引き続き読み書きできる。プロフィールを切り替えると「最終バックアップ
   日時」「書き出し/読込履歴」等がプロフィールごとに独立するようになる
   ——tai-hubで新たに導入された複数プロフィール機構に対する妥当な
   拡張で、元のスタンドアロン版の挙動を壊すものではない）。
   ================================================================ */
import { CURRENT_LANG } from '../../js/i18n.js';
import { PROFILES_KEY, ACTIVE_PROFILE_KEY, DEFAULT_PROFILE_ID, loadProfiles, saveProfiles, nsKey } from '../../js/state.js';

export { PROFILES_KEY, ACTIVE_PROFILE_KEY, DEFAULT_PROFILE_ID };
export const PROFILE_REGISTRY_KEYS = [PROFILES_KEY, ACTIVE_PROFILE_KEY];

/* ================================================================
   サイト別 localStorage キーのカタログ（元実装の SITE_CATALOG を完全一致で移植）
   ================================================================ */
export const SITE_CATALOG = [
  { id: 'item', label: 'アイテム所持管理', labelEn: 'Item Collection', namespaced: true, keys: [
    'gameItems_outfit', 'gameItems_shoes', 'gameItems_mask', 'gameItems_face_accessory', 'gameItems_necklace',
    'gameItems_hairstyle', 'gameItems_hair_accessory', 'gameItems_head_accessory', 'gameItems_cape',
    'gameItems_portable_item', 'gameItems_large_placeable', 'gameItems_small_placeable',
    'seasonAcquireMode_v1', 'shareCustomize_v1', 'favShareStyle_v1', 'favShareTheme_v1',
    'gameItems_viewMode', 'gameItems_gridCols', 'lastRandomCoord_v1',
    'wish_outfit', 'wish_shoes', 'wish_mask', 'wish_face_accessory', 'wish_necklace',
    'wish_hairstyle', 'wish_hair_accessory', 'wish_head_accessory', 'wish_cape',
    'wish_portable_item', 'wish_large_placeable', 'wish_small_placeable',
    'myCoords', 'closetCollages_v1',
    'moneyAcquireMode_v1', 'candleMoneyMode_v1', 'itemAcquireLog_v1',
    'giftHistory_v1', 'giftDisplayMode_v1', 'candlePurchaseLog_v1', 'candleDisplayMode_v1',
    'coordShareStyle_v1', 'shareUserId_v1',
    'sky_dash_reminder_enabled', 'sky_dash_reminder_minutes', 'sky_dash_reminder_notified_v1',
    'itemTitles_v1', 'itemCostMoneySum_v1',
  ] },
  { id: 'wings', label: '羽トラッカー', labelEn: 'Wing Tracker', namespaced: true, keys: [
    'wingTracker_v1', 'permWingTracker_v1', 'lightChildrenTracker_v1',
    'wingsShareCustomize_v1',
    'wingsTitles_v1',
  ] },
  { id: 'companion', label: '精霊同行ツール', labelEn: 'Spirit Companion Tool', namespaced: true, keys: [
    'sky_companion_v4_data', 'sky_companion_records_meta_v1',
  ] },
  { id: 'star-candle', label: '星のキャンドル計算機', labelEn: 'Star Candle Calculator', namespaced: true, keys: [
    'skyStarCandleCalc_v1', 'skyStarCandleCalc_checkedDays_v1', 'skyStarCandleCalc_history_v1',
    'skyStarCandleForecastFilterHigh_v1', 'skyStarCandleNotifyShardOn_v1', 'skyStarCandleNotifyGoalOn_v1',
    'skyStarCandleNotifyShardLast_v1', 'skyStarCandleNotifyGoalLast_v1',
    'skyStarCandleCalc_maxCandle_v1', 'skyStarCandleCalc_checkinLog_v1',
    'skyStarCandleCalc_streakBest_v1', 'skyStarCandleCalc_titles_v1',
  ] },
  { id: 'nomacan', label: 'ノマキャン計算機', labelEn: 'Nomacan Calculator', namespaced: true, keys: [
    'skyNomacanCalc_v1', 'skyNomacanCalc_history_v1', 'skyNomacanGoals_v1',
    'skyNomacanStreak_v1', 'skyNomacanTitles_v1',
  ] },
  { id: 'share', label: '創作物管理ツール', labelEn: 'Creation Manager', namespaced: true, keys: [
    'sky_tracker_storage',
    'shareTitles_v1',
  ] },
  { id: 'emote', label: 'エモート所持率管理', labelEn: 'Emote Collection', namespaced: true, keys: [
    'emoteOwned_v1', 'emoteShareCustomize_v1', 'emoteViewMode_v1',
    'emoteAcquireLog_v1', 'emoteTitles_v1',
  ] },
  // 🌳 精霊ツリー管理はまだ一般公開していないため hidden:true（チェックリストには
  // 出さないが、既存データを静かに落とさないよう対象キーとしては常に処理する）
  { id: 'spirit-catalog', label: '精霊ツリー管理', labelEn: 'Spirit Tree Manager', namespaced: true, hidden: true, keys: [
    'spiritCatalogUnlocked_v1',
    'catalogShareCustomize_v1',
    'spiritCatalogTitles_v1',
  ] },
  { id: 'score', label: '楽譜づくり', labelEn: 'Sheet Music Maker', namespaced: false, keys: [
    'taiScoreSongs_v1', 'taiScoreKeyBindings_v1', 'taiScoreInputMode_v1', 'taiScoreFreePlayInstrument_v1',
    'taiScoreTitles_v1', 'taiScoreLibrarySort_v1', 'taiScoreMetronomeEnabled_v1',
  ] },
  // 🩹 旧サイト(tai-transfer)2026-09-26の修正を反映: 星紡ぎカードは公開済みなのでバックアップ対象に表示する
  { id: 'tai-card', label: '星紡ぎカード', labelEn: 'Star-Spinning Cards', namespaced: true, keys: [
    'taiCardState_v1',
  ] },
  { id: 'currency', label: '所持通貨（共通）', labelEn: 'Owned Currency (Shared)', namespaced: true, keys: [
    'wishOwnCurrency', 'skyCurrencyExtra_v1',
  ] },
  { id: 'skyzztai', label: 'ノーマルキャンドル計算機（旧版・リアルム/エリア情報）', labelEn: 'Normal Candle Calculator (Legacy · Realm/Area Info)', namespaced: false, hidden: true, keys: [
    'sky_tracker_storage_v3', 'sky_shard_sync_date', 'sky_skill_answered', 'sky_skill_level_key',
    'sky_current_time_mult', 'sky_area_view_mode', 'sky_atlas_bg_opacity',
  ] },
  { id: 'homeIcon', label: 'ホーム画面アイコン設定（サイト別）', labelEn: 'Home Screen Icon (Per Site)', namespaced: false, keys: [
    'pfCustomHomeIcon_v1__site_tai-item', 'pfCustomHomeIcon_v1__site_companion',
    'pfCustomHomeIcon_v1__site_wings', 'pfCustomHomeIcon_v1__site_star-candle',
    'pfCustomHomeIcon_v1__site_tai-nomacan', 'pfCustomHomeIcon_v1__site_tai-emote',
    'pfCustomHomeIcon_v1__site_tai-catalog', 'pfCustomHomeIcon_v1__site_tai-info',
  ] },
];

export function siteLabel(site) {
  return CURRENT_LANG === 'en' ? site.labelEn : site.label;
}

export function getAllLocalStorageKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
  return keys;
}

// companion（精霊同行ツール）独自レコードの "__p" + id(区切りアンダースコア無し)にも
// 対応するため、通常のnsKey()接尾辞("__p_<id>")と合わせて前方一致で判定する
// （元実装の matchKeysForSite() と完全に同じロジック）。
export function matchKeysForSite(site, keyPool) {
  return keyPool.filter(k => site.keys.some(prefix => (
    site.namespaced ? (k === prefix || k.startsWith(prefix + '__p')) : (k === prefix)
  )));
}

export function keyMatchesProfile(rawKey, key, profileId) {
  if (profileId === DEFAULT_PROFILE_ID) return key === rawKey;
  return key === (rawKey + '__p_' + profileId) || key === (rawKey + '__' + profileId);
}

export function matchKeysForSiteProfile(site, keyPool, profileId) {
  if (!site.namespaced || profileId === 'all') return matchKeysForSite(site, keyPool);
  return keyPool.filter(k => site.keys.some(rawKey => keyMatchesProfile(rawKey, k, profileId)));
}

/* ================================================================
   プロフィール一覧の読み取り・マージ
   ================================================================ */
// この端末に登録済みのプロフィール一覧（js/state.js の loadProfiles() を再利用。
// 旧データのisDefaultName補完も既にそちらで行われている）
export function getLocalProfilesList() {
  return loadProfiles() || [];
}

// 引き継ぎコード（インポート側payload）に含まれる生JSON文字列から、
// loadProfiles()と同じ検証・isDefaultName補完を行って読み出す
// （localStorageではなく任意のJSON文字列が入力のため、loadProfiles()自体は使えない）
export function parseProfileListJson(raw) {
  let list;
  try { list = JSON.parse(raw); } catch (e) { return []; }
  if (!Array.isArray(list)) return [];
  list = list.filter(p => p && typeof p.id === 'string' && typeof p.name === 'string');
  return list.map(p => (
    p.id === DEFAULT_PROFILE_ID && p.isDefaultName === undefined && (p.name === 'メイン' || p.name === 'Main')
      ? { ...p, isDefaultName: true } : p
  ));
}

export function previewProfileMerge(importedData) {
  const localList = getLocalProfilesList();
  const raw = importedData ? importedData[PROFILES_KEY] : undefined;
  const importedList = raw !== undefined ? parseProfileListJson(raw) : [];
  const localIds = new Set(localList.map(p => p && p.id));
  const newProfiles = importedList.filter(p => p && typeof p.id === 'string' && !localIds.has(p.id));
  return { localList, importedList, newProfiles, hasImportedRegistry: raw !== undefined };
}

export function applyProfileMerge(importedData, allowedProfileIds) {
  const { localList, newProfiles, hasImportedRegistry } = previewProfileMerge(importedData);
  const filteredNewProfiles = allowedProfileIds ? newProfiles.filter(p => allowedProfileIds.has(p.id)) : newProfiles;
  const mergedList = localList.concat(filteredNewProfiles);
  let count = 0;
  const failedKeys = [];
  if (hasImportedRegistry) {
    try { saveProfiles(mergedList); count++; }
    catch (e) { failedKeys.push(PROFILES_KEY); }
  }
  const importedActive = importedData ? importedData[ACTIVE_PROFILE_KEY] : undefined;
  if (localStorage.getItem(ACTIVE_PROFILE_KEY) === null && importedActive !== undefined && mergedList.some(p => p && p.id === importedActive)) {
    try { localStorage.setItem(ACTIVE_PROFILE_KEY, importedActive); count++; }
    catch (e) { failedKeys.push(ACTIVE_PROFILE_KEY); }
  }
  return { count, newProfiles: filteredNewProfiles, failedKeys };
}

/* ================================================================
   🕒 サイト別「最終更新」スナップショット（このツール自身の内部管理用。
   引き継ぎコードの対象キーには含まれない＝nsKey()で名前空間化）
   ================================================================ */
const SITE_SNAPSHOT_KEY_RAW = 'dataTransferSiteSnapshot_v1';

function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
function computeSiteSignature(site, allKeys) {
  const matched = matchKeysForSite(site, allKeys).sort();
  return hashString(matched.map(k => k + '=' + localStorage.getItem(k)).join(''));
}
function loadSiteSnapshots() {
  try {
    const v = JSON.parse(localStorage.getItem(nsKey(SITE_SNAPSHOT_KEY_RAW)));
    return (v && typeof v === 'object') ? v : {};
  } catch (e) { return {}; }
}
function saveSiteSnapshots(map) {
  try { localStorage.setItem(nsKey(SITE_SNAPSHOT_KEY_RAW), JSON.stringify(map)); } catch (e) { /* 容量上限等は無視 */ }
}

export function refreshSiteSnapshots() {
  const allKeys = getAllLocalStorageKeys();
  const snapshots = loadSiteSnapshots();
  const nowIso = new Date().toISOString();
  let changed = false;
  SITE_CATALOG.forEach(site => {
    const matched = matchKeysForSite(site, allKeys);
    if (matched.length === 0) {
      if (snapshots[site.id]) { delete snapshots[site.id]; changed = true; }
      return;
    }
    const sig = computeSiteSignature(site, allKeys);
    const prev = snapshots[site.id];
    if (!prev || prev.sig !== sig) {
      snapshots[site.id] = { sig, updatedAt: nowIso };
      changed = true;
    }
  });
  if (changed) saveSiteSnapshots(snapshots);
  return snapshots;
}

export function siteUpdatedAtLabel(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString(CURRENT_LANG === 'en' ? 'en-US' : 'ja-JP', {
      year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch (e) { return ''; }
}

/* ================================================================
   🕒 「最終バックアップ」日時 / 前回のサイト選択（nsKey()で名前空間化）
   ================================================================ */
const LAST_EXPORT_KEY_RAW = 'dataTransferLastExportAt_v1';
const LAST_EXPORT_SELECTION_KEY_RAW = 'dataTransferLastExportSelection_v1';

export function getLastExportAt() {
  try { return localStorage.getItem(nsKey(LAST_EXPORT_KEY_RAW)); } catch (e) { return null; }
}
export function recordLastExportAt() {
  try { localStorage.setItem(nsKey(LAST_EXPORT_KEY_RAW), new Date().toISOString()); } catch (e) { /* noop */ }
}
export function getLastExportSelection() {
  try {
    const v = JSON.parse(localStorage.getItem(nsKey(LAST_EXPORT_SELECTION_KEY_RAW)));
    return Array.isArray(v) ? v : null;
  } catch (e) { return null; }
}
export function saveLastExportSelection(selectedIds) {
  try { localStorage.setItem(nsKey(LAST_EXPORT_SELECTION_KEY_RAW), JSON.stringify(selectedIds)); } catch (e) { /* noop */ }
}

/* ================================================================
   🕒 直近の書き出し/読込履歴ログ（最大5件、nsKey()で名前空間化）
   ================================================================ */
const TRANSFER_HISTORY_KEY_RAW = 'dataTransferHistory_v1';
export const TRANSFER_HISTORY_MAX = 5;

export function loadTransferHistory() {
  try {
    const v = JSON.parse(localStorage.getItem(nsKey(TRANSFER_HISTORY_KEY_RAW)));
    return Array.isArray(v) ? v : [];
  } catch (e) { return []; }
}
export function recordTransferHistoryEntry(type, siteIds, hiddenCount) {
  try {
    const list = loadTransferHistory();
    list.unshift({ type, at: new Date().toISOString(), siteIds: (siteIds || []).slice(), hiddenCount: hiddenCount || 0 });
    localStorage.setItem(nsKey(TRANSFER_HISTORY_KEY_RAW), JSON.stringify(list.slice(0, TRANSFER_HISTORY_MAX)));
  } catch (e) { /* noop */ }
}

/* ================================================================
   コードの圧縮/展開 + Base64（UTF-8セーフ）。CompressionStream未対応の
   ブラウザではU1:(無圧縮)にフォールバックする。
   ================================================================ */
function bytesToBase64(bytes) {
  let binString = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binString += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binString);
}
function base64ToBytes(b64) {
  const binString = atob(b64);
  const bytes = new Uint8Array(binString.length);
  for (let i = 0; i < binString.length; i++) bytes[i] = binString.charCodeAt(i);
  return bytes;
}
export async function encodeTransferCode(str) {
  const bytes = new TextEncoder().encode(str);
  if (typeof CompressionStream === 'undefined') {
    return 'U1:' + bytesToBase64(bytes);
  }
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(bytes).catch(() => {});
  writer.close().catch(() => {});
  const compressed = new Uint8Array(await new Response(cs.readable).arrayBuffer());
  return 'G1:' + bytesToBase64(compressed);
}
export async function decodeTransferCode(code) {
  const marker = code.slice(0, 3);
  const body = code.slice(3);
  if (marker === 'G1:') {
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(base64ToBytes(body)).catch(() => {});
    writer.close().catch(() => {});
    const bytes = new Uint8Array(await new Response(ds.readable).arrayBuffer());
    return new TextDecoder().decode(bytes);
  }
  if (marker === 'U1:') {
    return new TextDecoder().decode(base64ToBytes(body));
  }
  return new TextDecoder().decode(base64ToBytes(code));
}
export function bytesToBase64Length(str) {
  return bytesToBase64(new TextEncoder().encode(str)).length;
}

export const QR_MAX_BYTES = 2953;

/* ================================================================
   📊 上書き警告の「内容差分」集計（i18n非依存の数値集計のみ。文言組み立ては
   view側のformatSiteDiffSummary()が担当する）
   ================================================================ */
function tryParseJson(raw) {
  if (raw === null || raw === undefined) return { ok: false };
  try { return { ok: true, value: JSON.parse(raw) }; } catch (e) { return { ok: false }; }
}
function diffJsonLeaves(localVal, importedVal, out, depth) {
  if (depth > 8) return;
  const isArr = v => Array.isArray(v);
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

  if (isArr(localVal) || isArr(importedVal)) {
    const a = isArr(localVal) ? localVal : [];
    const b = isArr(importedVal) ? importedVal : [];
    const norm = x => (x !== null && typeof x === 'object') ? JSON.stringify(x) : x;
    const aSet = new Set(a.map(norm));
    const bSet = new Set(b.map(norm));
    b.forEach(x => { if (!aSet.has(norm(x))) out.added++; });
    a.forEach(x => { if (!bSet.has(norm(x))) out.removed++; });
    return;
  }
  if (isObj(localVal) || isObj(importedVal)) {
    const a = isObj(localVal) ? localVal : {};
    const b = isObj(importedVal) ? importedVal : {};
    const keys = new Set(Object.keys(a).concat(Object.keys(b)));
    keys.forEach(k => {
      const av = a[k]; const bv = b[k];
      if (isObj(av) || isArr(av) || isObj(bv) || isArr(bv)) { diffJsonLeaves(av, bv, out, depth + 1); return; }
      const aHas = Object.prototype.hasOwnProperty.call(a, k) && !!av;
      const bHas = Object.prototype.hasOwnProperty.call(b, k) && !!bv;
      if (bHas && !aHas) out.added++;
      else if (aHas && !bHas) out.removed++;
      else if (aHas && bHas && av !== bv) out.changed++;
    });
  }
}
function diffKeyValues(localRaw, importedRaw) {
  const out = { added: 0, removed: 0, changed: 0 };
  if (localRaw === importedRaw) return out;
  const lp = tryParseJson(localRaw);
  const ip = tryParseJson(importedRaw);
  const lVal = lp.ok ? lp.value : undefined;
  const iVal = ip.ok ? ip.value : undefined;
  const lIsStruct = lVal !== null && typeof lVal === 'object';
  const iIsStruct = iVal !== null && typeof iVal === 'object';
  if (lIsStruct || iIsStruct) {
    diffJsonLeaves(lIsStruct ? lVal : {}, iIsStruct ? iVal : {}, out, 0);
    return out;
  }
  if (localRaw === null || localRaw === undefined) out.added = 1;
  else if (importedRaw === null || importedRaw === undefined) out.removed = 1;
  else out.changed = 1;
  return out;
}
export function computeSiteContentDiff(site, importedData, profileFilter) {
  const importedKeysForSite = matchKeysForSiteProfile(site, Object.keys(importedData), profileFilter || 'all');
  const totals = { entriesAdded: 0, entriesRemoved: 0, entriesChanged: 0, titlesAdded: 0 };
  importedKeysForSite.forEach(k => {
    const d = diffKeyValues(localStorage.getItem(k), importedData[k]);
    const rawKey = site.keys.find(prefix => k === prefix || (site.namespaced && k.startsWith(prefix + '__p')));
    if (/Titles_v1$/i.test(rawKey || k)) totals.titlesAdded += d.added;
    else {
      totals.entriesAdded += d.added;
      totals.entriesRemoved += d.removed;
      totals.entriesChanged += d.changed;
    }
  });
  return totals;
}

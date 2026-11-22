/* ================================================================
   💾 自動バックアップ（端末の中に世代をためておく保険）
   データの保存先が localStorage 1か所だけだと、壊れたり消えたりした時に戻せない。
   起動時、前回の自動バックアップから24時間以上たっていれば、データ引継ぎ（features/data-transfer）の
   書き出しと同じ範囲（プロフィール一覧＋SITE_CATALOGに載っている全キー・全プロフィール分）を1件とり、
   新しい順に3件だけ残す。戻す時は、戻す直前の状態を1件とってから、引継ぎの取り込みと同じ書き方で書き戻す。

   保存先は IndexedDB `tai-hub-backups` の store `snapshots`（写真用の tai-hub-photos とは別）。
   ・スナップショット: { id: 's<ミリ秒>', kind: 'auto' | 'before-restore', at: ISO日時, profileId, keyCount, data: {キー: 値} }
   ・設定: { id: 'config', enabled: true/false }（表示設定のオン・オフ。新しい localStorage キーは作らない）
   IndexedDB が使えない環境・失敗した時は黙って何もしない（アプリの動きには影響させない）。
   ================================================================ */
import { getActiveProfileId } from './state.js';
import {
  SITE_CATALOG, PROFILE_REGISTRY_KEYS, getAllLocalStorageKeys, matchKeysForSite, applyProfileMerge, parseProfileListJson, PROFILES_KEY,
} from '../features/data-transfer/data-transfer-state.js';

const DB_NAME = 'tai-hub-backups';
const STORE = 'snapshots';
const CONFIG_ID = 'config';
export const KEEP_COUNT = 3;
export const AUTO_INTERVAL_MS = 24 * 60 * 60 * 1000;

function available() {
  try { return typeof indexedDB !== 'undefined' && indexedDB !== null; } catch (e) { return false; }
}

let dbPromise = null;
function openDb() {
  if (!available()) return Promise.reject(new Error('indexedDB unavailable'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); dbPromise = null; }; // 「全データを削除」でDBを消す時に止まらないように
      resolve(db);
    };
    req.onerror = () => { dbPromise = null; reject(req.error); };
    req.onblocked = () => { dbPromise = null; reject(new Error('blocked')); };
  });
  return dbPromise;
}
function run(mode, fn) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let result;
    const req = fn(store);
    if (req) req.onsuccess = () => { result = req.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

/* ── 設定（既定はオン） ── */
export async function isAutoBackupEnabled() {
  try {
    const cfg = await run('readonly', s => s.get(CONFIG_ID));
    return !(cfg && cfg.enabled === false);
  } catch (e) { return false; }
}
export async function setAutoBackupEnabled(on) {
  try { await run('readwrite', s => s.put({ id: CONFIG_ID, enabled: !!on })); return true; } catch (e) { return false; }
}

/* ── 一覧（新しい順。dataは含めたまま返す） ── */
export async function listSnapshots() {
  try {
    const all = await run('readonly', s => s.getAll());
    return (all || []).filter(r => r && r.id !== CONFIG_ID && r.data && typeof r.at === 'string')
      .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  } catch (e) { return []; }
}

/* ── 収集: 引継ぎの書き出しで「全部のツール・全プロフィール」を選んだ時と同じ範囲 ── */
export function collectBackupData() {
  const allKeys = getAllLocalStorageKeys();
  const data = {};
  PROFILE_REGISTRY_KEYS.forEach(k => { const v = localStorage.getItem(k); if (v !== null) data[k] = v; });
  SITE_CATALOG.forEach(site => {
    matchKeysForSite(site, allKeys).forEach(k => { const v = localStorage.getItem(k); if (v !== null) data[k] = v; });
  });
  return data;
}
// プロフィール一覧以外に記録が1つも無ければ「空」
function hasRecords(data) {
  return Object.keys(data).some(k => !PROFILE_REGISTRY_KEYS.includes(k));
}

async function putSnapshot(kind, data) {
  const now = Date.now();
  const snap = {
    id: 's' + now + Math.random().toString(36).slice(2, 6),
    kind,
    at: new Date(now).toISOString(),
    profileId: getActiveProfileId(),
    keyCount: Object.keys(data).length,
    data,
  };
  await run('readwrite', s => s.put(snap));
  return snap;
}
// 新しい順に keep 件だけ残す
async function prune(keep) {
  const list = await listSnapshots();
  const old = list.slice(keep);
  if (!old.length) return 0;
  await run('readwrite', (s) => { old.forEach(r => s.delete(r.id)); return null; });
  return old.length;
}

/** 起動時に呼ぶ。オン・24時間以上空いている・記録がある、の時だけ1件とって3件に整える */
export async function maybeAutoBackup(nowMs) {
  if (!available()) return { taken: false, reason: 'unavailable' };
  try {
    if (!(await isAutoBackupEnabled())) return { taken: false, reason: 'off' };
    const list = await listSnapshots();
    const now = Number.isFinite(nowMs) ? nowMs : Date.now();
    const latest = list[0];
    if (latest && now - Date.parse(latest.at) < AUTO_INTERVAL_MS) return { taken: false, reason: 'recent' };
    const data = collectBackupData();
    if (!hasRecords(data)) return { taken: false, reason: 'empty' };
    await putSnapshot('auto', data);
    await prune(KEEP_COUNT);
    return { taken: true };
  } catch (e) { return { taken: false, reason: 'error' }; }
}

/**
 * スナップショットの時点に戻す。戻す直前の状態を 'before-restore' として1件とってから、
 * 引継ぎの取り込みと同じ書き方（プロフィール一覧はマージ、各ツールのキーは上書き）で書き戻す。
 * 直前の分は、戻した先の世代を消さないよう、ここでは整理しない（次の自動バックアップの時に3件に整える）。
 * 呼び出し側で再読み込みする。
 */
export async function restoreSnapshot(id) {
  const list = await listSnapshots();
  const snap = list.find(r => r.id === id);
  if (!snap) throw new Error('not found');
  await putSnapshot('before-restore', collectBackupData());
  const data = snap.data;
  const keys = Object.keys(data);
  const profileIds = new Set(parseProfileListJson(data[PROFILES_KEY] || '[]').map(p => p.id));
  const { count: registryCount, failedKeys } = applyProfileMerge(data, profileIds);
  let count = registryCount;
  SITE_CATALOG.forEach(site => {
    matchKeysForSite(site, keys).forEach(k => {
      try { localStorage.setItem(k, data[k]); count += 1; } catch (e) { failedKeys.push(k); }
    });
  });
  return { count, failedKeys };
}

/** 「全データを削除」用 */
export function deleteBackupDatabase() {
  if (!available()) return;
  try { indexedDB.deleteDatabase(DB_NAME); } catch (e) { /* noop */ }
}

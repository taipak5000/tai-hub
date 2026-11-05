/* ================================================================
   フレンド記念日・フォト日記のデータ（プロフィールごと＝nsKey）。
   画面（friends-view.js）と、お知らせ（js/notices.js）・一年のふりかえり（features/recap）が読む。

   friendsDoc_v1: {
     friends: [{ id, name, since: 'YYYY-MM-DD'（フレンドになった日。空でもよい）, memo, color: '#RRGGBB',
                 avatar: アイコンの文字・絵文字（空なら名前の1文字目）, avatarPhotoId: アイコンの写真のID（IndexedDB。空なら文字） }],
     days:    [{ id, name, date: 'MM-DD' または 'YYYY-MM-DD'（毎年の記念日。誕生日など）, friendId? }],
     diary:   [{ id, date: 'YYYY-MM-DD', text, friendIds: [id], photoId? }]
   }
   写真は localStorage の容量を圧迫しないよう IndexedDB（tai-hub-photos / photos）に保存する
   （着せ替えの壁紙と同じ考え方。データ引継ぎのバックアップには写真そのものは含めない）。
   ================================================================ */
import { nsKey } from '../../js/state.js';

export const FRIENDS_KEY = 'friendsDoc_v1';

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MD_RE = /^(\d{4}-)?\d{2}-\d{2}$/;

function str(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }

export function normalizeFriendsDoc(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const friends = (Array.isArray(d.friends) ? d.friends : []).filter(f => f && f.id).slice(0, 500).map(f => ({
    id: str(f.id, 40),
    name: str(f.name, 40),
    since: DATE_RE.test(f.since || '') ? f.since : '',
    memo: str(f.memo, 400),
    color: COLOR_RE.test(f.color || '') ? f.color : '#E8679A',
    avatar: str(f.avatar, 16).trim(),          // アイコンに出す文字・絵文字（空なら名前の1文字目）
    avatarPhotoId: typeof f.avatarPhotoId === 'string' ? f.avatarPhotoId.slice(0, 60) : '', // アイコンの写真（IndexedDB）
  }));
  const ids = new Set(friends.map(f => f.id));
  const days = (Array.isArray(d.days) ? d.days : []).filter(x => x && x.id && MD_RE.test(x.date || '')).slice(0, 500).map(x => ({
    id: str(x.id, 40),
    name: str(x.name, 40),
    date: x.date,
    friendId: ids.has(x.friendId) ? x.friendId : '',
  }));
  const diary = (Array.isArray(d.diary) ? d.diary : []).filter(x => x && x.id && DATE_RE.test(x.date || '')).slice(0, 3000).map(x => ({
    id: str(x.id, 40),
    date: x.date,
    text: str(x.text, 2000),
    friendIds: (Array.isArray(x.friendIds) ? x.friendIds : []).filter(id => ids.has(id)),
    photoId: typeof x.photoId === 'string' ? x.photoId.slice(0, 60) : '',
  }));
  return { friends, days, diary };
}

export function loadFriendsDoc() {
  try { return normalizeFriendsDoc(JSON.parse(localStorage.getItem(nsKey(FRIENDS_KEY)))); }
  catch (e) { return normalizeFriendsDoc(null); }
}
export function saveFriendsDoc(doc) {
  try { localStorage.setItem(nsKey(FRIENDS_KEY), JSON.stringify(doc)); return true; }
  catch (e) { return false; }
}

/* ── 日付（端末のローカル日付。記念日は暦の日付なので太平洋時間ではなく手元の日付で数える） ── */
export function todayStr(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function dayStart(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

/** 「今日から何日後にその月日が来るか」と、その日に迎える年数。2/29は平年なら2/28に寄せる */
function nextOccurrence(month, day, now) {
  const today = dayStart(now);
  for (const y of [today.getFullYear(), today.getFullYear() + 1]) {
    const last = new Date(y, month, 0).getDate();
    const dt = new Date(y, month - 1, Math.min(day, last));
    if (dt >= today) return { date: dt, inDays: Math.round((dt - today) / 86400000) };
  }
  return null;
}

/**
 * これから withinDays 日以内（今日を含む）に来る記念日。
 * フレンドになった日（毎年の「◯周年」と、100日・1000日などの節目）と、登録した記念日の両方。
 * 戻り値: [{ key, kind: 'friend'|'milestone'|'day', title, friend?, inDays, date, years?, count? }]（近い順）
 */
export function upcomingAnniversaries(doc, withinDays = 7, now = new Date()) {
  const out = [];
  const today = dayStart(now);
  const byId = Object.fromEntries(doc.friends.map(f => [f.id, f]));
  doc.friends.forEach(f => {
    if (!f.since) return;
    const [y, m, d] = f.since.split('-').map(Number);
    const start = new Date(y, m - 1, d);
    if (start > today) return;
    const occ = nextOccurrence(m, d, now);
    if (occ) {
      const years = occ.date.getFullYear() - y;
      if (years >= 1 && occ.inDays <= withinDays) {
        out.push({ key: `friend:${f.id}:${occ.date.getFullYear()}`, kind: 'friend', friend: f, inDays: occ.inDays, date: occ.date, years });
      }
    }
    // フレンドになってからの日数の節目（100日・200日・…・1000日・2000日…）
    const elapsed = Math.round((today - start) / 86400000);
    [100, 200, 300, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000].forEach(n => {
      const left = n - elapsed;
      if (left >= 0 && left <= withinDays) {
        const date = new Date(start.getTime()); date.setDate(date.getDate() + n);
        out.push({ key: `milestone:${f.id}:${n}`, kind: 'milestone', friend: f, inDays: left, date, count: n });
      }
    });
  });
  doc.days.forEach(x => {
    const parts = x.date.split('-').map(Number);
    const [m, d] = parts.length === 3 ? [parts[1], parts[2]] : parts;
    const occ = nextOccurrence(m, d, now);
    if (occ && occ.inDays <= withinDays) {
      const years = parts.length === 3 ? occ.date.getFullYear() - parts[0] : null;
      out.push({ key: `day:${x.id}:${occ.date.getFullYear()}`, kind: 'day', title: x.name, friend: byId[x.friendId] || null, inDays: occ.inDays, date: occ.date, years: years && years > 0 ? years : null });
    }
  });
  return out.sort((a, b) => a.inDays - b.inDays);
}

/** フレンドになってからの日数（今日を1日目とは数えず、当日=0日） */
export function daysSince(since, now = new Date()) {
  if (!since) return null;
  const [y, m, d] = since.split('-').map(Number);
  return Math.round((dayStart(now) - new Date(y, m - 1, d)) / 86400000);
}

/* ── 写真（IndexedDB） ── */
const DB_NAME = 'tai-hub-photos';
const STORE = 'photos';
let dbPromise = null;
function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no indexedDB')); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}
function tx(mode, fn) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const req = fn(store);
    t.oncomplete = () => resolve(req && req.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}
export function putPhoto(id, blob) { return tx('readwrite', s => s.put(blob, id)); }
export function getPhoto(id) { return tx('readonly', s => s.get(id)); }
export function deletePhoto(id) { return tx('readwrite', s => s.delete(id)); }

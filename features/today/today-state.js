/* ================================================================
   「今日やること」（features/today）のデータ（プロフィールごと＝nsKey）。
   日付はゲームのデイリーと同じ太平洋時間0時区切り（キーは 'YYYY-M-D'。デイリーチェックシートと同じ形）。

   todayTodo_v1:  { items: [{ id, label }], dayKey, done: { [id]: 1 } }   // 自分で決める「今日やること」。日付が変わると外れる
   omikujiLog_v1: { days: { [dayKey]: { f: 0..4（運勢）, realm, emoteId, color, msg } } }   // 1日1回のおみくじ（最大400日）
   ================================================================ */
import { nsKey } from '../../js/state.js';
import { ptParts } from '../../js/pacific-time.js';

export const TODO_KEY = 'todayTodo_v1';
export const OMIKUJI_KEY = 'omikujiLog_v1';

export function gameDayKey(ms = Date.now()) {
  const p = ptParts(ms);
  return `${p.year}-${p.month}-${p.day}`;
}

const DEFAULT_TODO = [
  { ja: 'デイリークエスト', en: 'Daily quests' },
  { ja: '大キャンドル', en: 'Big candle' },
  { ja: '季節のキャンドル', en: 'Season candles' },
  { ja: '闇の破片', en: 'Shard eruption' },
  { ja: 'フレンドにハートを贈る', en: 'Send hearts to friends' },
];

function readJson(key) { try { return JSON.parse(localStorage.getItem(nsKey(key))); } catch (e) { return null; } }

export function loadTodo(lang) {
  const d = readJson(TODO_KEY);
  const items = d && Array.isArray(d.items)
    ? d.items.filter(x => x && typeof x.id === 'string' && typeof x.label === 'string').slice(0, 30).map(x => ({ id: x.id.slice(0, 40), label: x.label.slice(0, 40) }))
    : DEFAULT_TODO.map((x, i) => ({ id: 'd' + i, label: lang === 'en' ? x.en : x.ja }));
  const today = gameDayKey();
  const done = d && d.dayKey === today && d.done && typeof d.done === 'object' ? d.done : {};
  return { items, dayKey: today, done: Object.fromEntries(Object.keys(done).filter(k => done[k]).map(k => [k, 1])) };
}
export function saveTodo(doc) {
  try { localStorage.setItem(nsKey(TODO_KEY), JSON.stringify(doc)); } catch (e) { /* noop */ }
}

/* ── おみくじ ── */
export const FORTUNES = [
  { ja: '大吉', en: 'Great blessing', w: 16 },
  { ja: '中吉', en: 'Good blessing', w: 24 },
  { ja: '小吉', en: 'Small blessing', w: 26 },
  { ja: '吉', en: 'Blessing', w: 22 },
  { ja: '末吉', en: 'Future blessing', w: 12 },
];
export const LUCKY_REALMS = [
  { ja: '孤島', en: 'Isle of Dawn' }, { ja: '草原', en: 'Daylight Prairie' }, { ja: '雨林', en: 'Hidden Forest' },
  { ja: '峡谷', en: 'Valley of Triumph' }, { ja: '捨てられた地', en: 'Golden Wasteland' }, { ja: '書庫', en: 'Vault of Knowledge' },
  { ja: 'ホーム', en: 'Home' }, { ja: '季節のエリア', en: 'The season area' },
];
export const LUCKY_COLORS = [
  { ja: '桜色', en: 'Cherry pink', hex: '#F4A7B9' }, { ja: '空色', en: 'Sky blue', hex: '#8EC5F0' }, { ja: '若草色', en: 'Fresh green', hex: '#A6D66F' },
  { ja: '金色', en: 'Gold', hex: '#E8BE4F' }, { ja: '藤色', en: 'Wisteria', hex: '#B9A3E3' }, { ja: '夕焼け色', en: 'Sunset orange', hex: '#F59E6B' },
  { ja: '真珠色', en: 'Pearl', hex: '#E9E4DA' }, { ja: '夜空色', en: 'Night blue', hex: '#4B5A9A' },
];
export const MESSAGES = [
  { ja: '知らない星の子に、手を差しのべてみて', en: 'Reach out a hand to a stranger today.' },
  { ja: '寄り道した先に、すてきな景色が待っています', en: 'A detour will lead to a lovely view.' },
  { ja: 'ベンチでひと休み。いい出会いがあるかも', en: 'Rest on a bench — a nice meeting may follow.' },
  { ja: '今日は写真日和。空を見上げてみましょう', en: 'A great day for photos. Look up at the sky.' },
  { ja: '久しぶりのフレンドにハートを贈ると吉', en: 'Send a heart to a friend you haven’t seen in a while.' },
  { ja: '新しいコーデで出かけると、気分も新しく', en: 'A new outfit brings a fresh mood.' },
  { ja: 'ゆっくり飛ぶほど、見つかるものがあります', en: 'Fly slowly and you’ll find more.' },
  { ja: '楽器をひとつ奏でると、誰かが集まってきます', en: 'Play a song and someone will gather around.' },
  { ja: '小さなキャンドルも、積もれば大きな灯りに', en: 'Little candles add up to a great light.' },
  { ja: '手をつないで飛べば、どこまでも行けそう', en: 'Holding hands, you can fly anywhere.' },
  { ja: '「ありがとう」を伝えると、光が増えます', en: 'Say “thank you” and the light grows.' },
  { ja: 'いつもと違うエリアで、いい知らせが', en: 'Good news awaits in a different area.' },
];

// その日・そのプロフィールで決まる疑似乱数（引き直しても同じ結果になる＝1日1回）
function seeded(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000000) / 1000000; };
}

export function loadOmikuji() {
  const d = readJson(OMIKUJI_KEY);
  const days = {};
  if (d && d.days && typeof d.days === 'object') {
    Object.keys(d.days).sort().slice(-400).forEach(k => {
      const r = d.days[k];
      if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(k) && r && Number.isInteger(r.f) && r.f >= 0 && r.f < FORTUNES.length) {
        days[k] = { f: r.f, realm: Math.abs(r.realm | 0) % LUCKY_REALMS.length, color: Math.abs(r.color | 0) % LUCKY_COLORS.length, msg: Math.abs(r.msg | 0) % MESSAGES.length, emoteId: typeof r.emoteId === 'string' ? r.emoteId.slice(0, 20) : '' };
      }
    });
  }
  return { days };
}

/** 今日のおみくじを引く（すでに引いていればその結果を返す）。emotes は EMOTES 配列 */
export function drawOmikuji(emotes, profileSalt = '') {
  const log = loadOmikuji();
  const key = gameDayKey();
  if (log.days[key]) return { result: log.days[key], fresh: false };
  const rand = seeded(key + ':' + profileSalt + ':' + Math.random().toString(36).slice(2, 6));
  const total = FORTUNES.reduce((s, f) => s + f.w, 0);
  let r = rand() * total, f = 0;
  for (; f < FORTUNES.length - 1; f++) { r -= FORTUNES[f].w; if (r < 0) break; }
  const pool = (emotes || []).filter(e => e.id && e.id !== 'emote_001');
  const result = {
    f,
    realm: Math.floor(rand() * LUCKY_REALMS.length),
    color: Math.floor(rand() * LUCKY_COLORS.length),
    msg: Math.floor(rand() * MESSAGES.length),
    emoteId: pool.length ? pool[Math.floor(rand() * pool.length)].id : '',
  };
  log.days[key] = result;
  try { localStorage.setItem(nsKey(OMIKUJI_KEY), JSON.stringify(log)); } catch (e) { /* noop */ }
  return { result, fresh: true };
}

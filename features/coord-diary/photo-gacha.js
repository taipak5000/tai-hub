/* ================================================================
   📸 撮影お題ガチャ（コーデ日記の中の折りたたみ「撮影ポーズに困ったら」。coord-diary-view.js が表示する）。
   場所・時間帯・ポーズ（エモート）・構図・人数をくじで決める。2026-11-06に試作（#/lab-photo-gacha）から移した。
   photoGacha_v1: { log: [{ id, date, place, time, emoteId, comp, people, done }] }（新しい順・最大100件。試作の頃と同じ）
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { nsKey } from '../../js/state.js';
import { PLACES } from '../shared/places.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
const KEY = 'photoGacha_v1';
const TIMES = [{ ja: '朝焼け', en: 'Sunrise' }, { ja: '昼', en: 'Daytime' }, { ja: '夕暮れ', en: 'Sunset' }, { ja: '夜', en: 'Night' }, { ja: '雨・雪の中', en: 'In rain or snow' }, { ja: '雲の上', en: 'Above the clouds' }];
const COMPS = [{ ja: '顔のアップ', en: 'Close-up' }, { ja: '全身', en: 'Full body' }, { ja: '後ろ姿', en: 'From behind' }, { ja: '見上げる角度', en: 'Low angle' }, { ja: '見下ろす角度', en: 'High angle' }, { ja: 'シルエット', en: 'Silhouette' }, { ja: '景色を大きく', en: 'Wide landscape' }, { ja: '手もとだけ', en: 'Hands only' }];
const PEOPLE = [{ ja: 'ひとりで', en: 'Solo' }, { ja: 'ふたりで', en: 'With one friend' }, { ja: 'みんなで', en: 'With a group' }, { ja: '精霊と', en: 'With a spirit' }];
const PLACE_POOL = PLACES.filter(p => p.id !== 'other');
const L = o => (o ? t(o.ja, o.en) : '');
const pick = arr => Math.floor(Math.random() * arr.length);

let doc = null;
let current = null;
let emotes = null;
let emotesLoading = null;
export let gachaOpen = false;

function load() {
  if (doc) return;
  let d = {};
  try { d = JSON.parse(localStorage.getItem(nsKey(KEY))) || {}; } catch (e) { d = {}; }
  doc = { log: (Array.isArray(d.log) ? d.log : []).filter(x => x && x.id).slice(0, 100) };
  current = doc.log[0] && !doc.log[0].done ? doc.log[0] : null;
}
function save() { try { localStorage.setItem(nsKey(KEY), JSON.stringify(doc)); } catch (e) { /* noop */ } }
/** プロフィールを切り替えた時などに読み直す（コーデ日記を開くたびに呼ぶ） */
export function resetGacha() { doc = null; current = null; gachaOpen = false; }
/** ポーズの候補（エモート）を読み込む。読み終わったら onReady を呼ぶ */
export function ensureEmotes(onReady) {
  if (emotes) return;
  if (!emotesLoading) emotesLoading = import('../emote/data/emotes.js').then(m => { emotes = (m.EMOTES || []).filter(e => e.id !== 'emote_001'); }).catch(() => { emotes = []; });
  emotesLoading.then(() => onReady && onReady());
}
function emoteName(id) { const e = (emotes || []).find(x => x.id === id); return e ? (CURRENT_LANG === 'en' ? e.nameEn : e.name) : t('好きなエモート', 'Any emote'); }

export function gachaHtml() {
  load();
  const done = doc.log.filter(x => x.done).length;
  const c = current;
  const rows = [
    [t('場所', 'Place'), c ? L(PLACE_POOL.find(p => p.id === c.place)) : ''],
    [t('時間帯', 'Time'), c ? L(TIMES[c.time]) : ''],
    [t('ポーズ', 'Pose'), c ? emoteName(c.emoteId) : ''],
    [t('構図', 'Framing'), c ? L(COMPS[c.comp]) : ''],
    [t('人数', 'Who'), c ? L(PEOPLE[c.people]) : ''],
  ];
  return `<section class="cd-gacha${gachaOpen ? ' is-open' : ''}">
    <button type="button" class="cd-gacha-head" data-act="gacha-toggle" aria-expanded="${gachaOpen}">
      <svg class="inline-icon" width="16" height="16" aria-hidden="true"><use href="#i-camera"/></svg>
      <span>${t('撮影ポーズに困ったら', 'Stuck on a pose?')}</span>
      ${done ? `<small>${t(`撮れた ${done}`, `${done} done`)}</small>` : ''}
      <svg class="inline-icon cd-gacha-chev" width="14" height="14" aria-hidden="true"><use href="#i-chevron-down"/></svg>
    </button>
    ${gachaOpen ? `<div class="cd-gacha-body">
      ${c ? `<dl class="cd-gacha-list">${rows.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}</dl>`
        : `<p class="fun-hint">${t('場所・時間帯・ポーズ・構図・人数をくじで決めます。いつもと違う1枚が撮れるかもしれません。', 'Draw a random place, time, pose, framing and company for your next photo.')}</p>`}
      <div class="cd-gacha-actions">
        <button type="button" class="fun-btn small primary" data-act="gacha-roll"><svg class="inline-icon" width="13" height="13"><use href="#i-dice"/></svg>${c ? t('引きなおす', 'Draw again') : t('お題を引く', 'Draw')}</button>
        ${c ? `<button type="button" class="fun-btn small" data-act="gacha-done"><svg class="inline-icon" width="13" height="13"><use href="#i-check"/></svg>${t('撮れた！', 'Got it!')}</button>` : ''}
      </div>
    </div>` : ''}
  </section>`;
}

/** コーデ日記のクリックから呼ぶ。処理したら true（呼び出し側は描き直す） */
export function handleGacha(act) {
  load();
  if (act === 'gacha-toggle') { gachaOpen = !gachaOpen; return true; }
  if (act === 'gacha-roll') {
    const c = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date: new Date().toISOString().slice(0, 10), place: PLACE_POOL[pick(PLACE_POOL)].id, time: pick(TIMES), emoteId: emotes && emotes.length ? emotes[pick(emotes)].id : '', comp: pick(COMPS), people: pick(PEOPLE), done: false };
    if (current && !current.done) doc.log = doc.log.filter(x => x.id !== current.id);
    doc.log.unshift(c); doc.log = doc.log.slice(0, 100); current = c; save();
    return true;
  }
  if (act === 'gacha-done' && current) { current.done = true; save(); current = null; return true; }
  return false;
}

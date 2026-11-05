/* ================================================================
   📸 撮影お題ガチャ（#/lab-photo-gacha・試作）。場所・時間帯・ポーズ（エモート）・構図・人数をくじ引きで決めて、写真を撮る遊び。
   「撮れた！」を押すと記録に残る（フォト日記へもすぐ書ける）。
   photoGacha_v1: { log: [{ id, date, place, time, emoteId, comp, people, done }] }（新しい順・最大100件）
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { navigate } from '../../js/router.js';
import { injectStylesheet } from '../bingo/bingo-view.js';
import { PLACES } from '../shared/places.js';
import { t, readJson, writeJson, genId, localDateStr, labHeadHtml } from './lab-common.js';

const KEY = 'photoGacha_v1';
const TIMES = [{ ja: '朝焼け', en: 'Sunrise' }, { ja: '昼', en: 'Daytime' }, { ja: '夕暮れ', en: 'Sunset' }, { ja: '夜', en: 'Night' }, { ja: '雨・雪の中', en: 'In rain or snow' }, { ja: '雲の上', en: 'Above the clouds' }];
const COMPS = [{ ja: '顔のアップ', en: 'Close-up' }, { ja: '全身', en: 'Full body' }, { ja: '後ろ姿', en: 'From behind' }, { ja: '見上げる角度', en: 'Low angle' }, { ja: '見下ろす角度', en: 'High angle' }, { ja: 'シルエット', en: 'Silhouette' }, { ja: '景色を大きく', en: 'Wide landscape' }, { ja: '手もとだけ', en: 'Hands only' }];
const PEOPLE = [{ ja: 'ひとりで', en: 'Solo' }, { ja: 'ふたりで', en: 'With one friend' }, { ja: 'みんなで', en: 'With a group' }, { ja: '精霊と', en: 'With a spirit' }];
const PLACE_POOL = PLACES.filter(p => p.id !== 'other');

let containerEl = null;
let doc = null;
let emotes = [];
let current = null;
let rolling = false;
let token = 0;

export function mount(container) {
  injectStylesheet();
  containerEl = container;
  const d = readJson(KEY, {});
  doc = { log: (Array.isArray(d.log) ? d.log : []).filter(x => x && x.id).slice(0, 100) };
  current = doc.log[0] && !doc.log[0].done ? doc.log[0] : null;
  container.innerHTML = '<div class="lab-photo-gacha-view fun-view"></div>';
  const my = ++token;
  import('../emote/data/emotes.js').then(m => { if (my === token) { emotes = (m.EMOTES || []).filter(e => e.id !== 'emote_001'); if (containerEl) render(); } }).catch(() => {});
  render();
  root().addEventListener('click', onClick);
}
export function unmount() { token++; containerEl = null; }
function root() { return containerEl && containerEl.querySelector('.lab-photo-gacha-view'); }
const pick = arr => Math.floor(Math.random() * arr.length);
const L = o => (o ? t(o.ja, o.en) : '');
function emoteName(id) { const e = emotes.find(x => x.id === id); return e ? (CURRENT_LANG === 'en' ? e.nameEn : e.name) : t('好きなエモート', 'Any emote'); }

function cardsHtml(c, spinning) {
  const cards = [
    { label: t('場所', 'Place'), value: c ? L(PLACE_POOL.find(p => p.id === c.place)) : '?', icon: 'i-map' },
    { label: t('時間帯', 'Time'), value: c ? L(TIMES[c.time]) : '?', icon: 'i-sun' },
    { label: t('ポーズ', 'Pose'), value: c ? emoteName(c.emoteId) : '?', icon: 'i-masks' },
    { label: t('構図', 'Framing'), value: c ? L(COMPS[c.comp]) : '?', icon: 'i-camera' },
    { label: t('人数', 'Who'), value: c ? L(PEOPLE[c.people]) : '?', icon: 'i-person' },
  ];
  return `<div class="pgc-cards${spinning ? ' is-spinning' : ''}">${cards.map((x, i) => `<div class="pgc-card" style="animation-delay:${i * 90}ms"><svg class="inline-icon" width="16" height="16"><use href="#${x.icon}"/></svg><small>${escapeHtml(x.label)}</small><b>${escapeHtml(x.value)}</b></div>`).join('')}</div>`;
}

function render() {
  const r = root();
  if (!r) return;
  const done = doc.log.filter(x => x.done);
  r.innerHTML = `<div class="fun-wrap">
    ${labHeadHtml('photo-gacha', t('くじで決まったお題で写真を撮ってみましょう。いつもと違う1枚が撮れるかもしれません。', 'Draw a random prompt and take a photo — you might get a shot you’d never think of.'))}
    ${cardsHtml(current, rolling)}
    <div class="fun-actions pgc-actions">
      <button type="button" class="fun-btn primary" data-act="roll"${rolling ? ' disabled' : ''}><svg class="inline-icon" width="15" height="15"><use href="#i-dice"/></svg>${current ? t('引きなおす', 'Draw again') : t('お題を引く', 'Draw a prompt')}</button>
      ${current ? `<button type="button" class="fun-btn" data-act="done"><svg class="inline-icon" width="15" height="15"><use href="#i-check"/></svg>${t('撮れた！', 'Got it!')}</button>` : ''}
    </div>
    ${done.length ? `<section class="fun-section"><h2 class="fun-h2">${t(`撮れたお題 ${done.length}`, `Completed ${done.length}`)}</h2>
      <ul class="pgc-log">${done.slice(0, 30).map(x => `<li><span>${escapeHtml(x.date)}</span>${escapeHtml([L(PLACE_POOL.find(p => p.id === x.place)), L(TIMES[x.time]), emoteName(x.emoteId), L(COMPS[x.comp]), L(PEOPLE[x.people])].join('・'))}</li>`).join('')}</ul>
      <button type="button" class="fun-btn small" data-act="diary"><svg class="inline-icon" width="13" height="13"><use href="#i-camera"/></svg>${t('フォト日記に写真を残す', 'Save the photo in your diary')}</button></section>` : ''}
  </div>`;
}

function onClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  if (b.dataset.act === 'roll') {
    rolling = true; render();
    setTimeout(() => {
      if (!containerEl) return;
      const c = { id: genId(), date: localDateStr(), place: PLACE_POOL[pick(PLACE_POOL)].id, time: pick(TIMES), emoteId: emotes.length ? emotes[pick(emotes)].id : '', comp: pick(COMPS), people: pick(PEOPLE), done: false };
      if (current && !current.done) doc.log = doc.log.filter(x => x.id !== current.id);
      doc.log.unshift(c); doc.log = doc.log.slice(0, 100); current = c; rolling = false;
      writeJson(KEY, doc); render();
    }, 650);
    return;
  }
  if (b.dataset.act === 'done' && current) { current.done = true; current.date = localDateStr(); writeJson(KEY, doc); current = null; render(); return; }
  if (b.dataset.act === 'diary') navigate('friends', '');
}

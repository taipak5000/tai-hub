/* ================================================================
   🧪 試作中の機能（features/lab/）の共通部品。
   どれも非公開（router-registry.js で hidden）で、関連ツールの一覧・検索・お知らせには出さない。
   入口はデイリーチェックシート単体のページ（#/daily-check）の「試作中の機能」だけ。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { nsKey } from '../../js/state.js';

export const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);

export function readJson(key, fb) { try { const v = JSON.parse(localStorage.getItem(nsKey(key))); return v == null ? fb : v; } catch (e) { return fb; } }
export function writeJson(key, v) { try { localStorage.setItem(nsKey(key), JSON.stringify(v)); return true; } catch (e) { return false; } }
export function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
export function localDateStr(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

/** 試作中の機能の一覧（デイリーチェックシートの入口と、各ページの「ほかの試作」に使う） */
export const LAB_TOOLS = [
  { id: 'mood', icon: 'i-palette', ja: '気分カレンダー', en: 'Mood Calendar', desc: { ja: '1日1色で気分を塗って、1年を色のマスで見返す', en: 'One color a day — your year in pixels' } },
  { id: 'capsule', icon: 'i-gift', ja: 'タイムカプセル', en: 'Time Capsule', desc: { ja: '未来の自分へ手紙を書いて、決めた日まで封をする', en: 'Write to your future self and seal it' } },
  { id: 'piggy', icon: 'i-candle', ja: 'キャンドル貯金箱', en: 'Candle Jar', desc: { ja: '目標の本数まで、たまっていく様子を瓶で見る', en: 'Watch your candles fill a jar toward a goal' } },
  { id: 'oshi', icon: 'i-heart', ja: '推し精霊', en: 'Favorite Spirits', desc: { ja: '推しの精霊の来訪歴と「推し歴」をまとめる', en: 'Your favorite spirits and their visits' } },
  { id: 'stickers', icon: 'i-star', ja: 'シール帳', en: 'Sticker Book', desc: { ja: 'ページにシールを貼って、自由に飾る', en: 'Decorate pages with stickers' } },
  { id: 'photo-gacha', icon: 'i-camera', ja: '撮影お題ガチャ', en: 'Photo Prompt Gacha', desc: { ja: '場所・時間・ポーズのお題で写真を撮る', en: 'Random photo prompts: place, time, pose' } },
  { id: 'season-album', icon: 'i-image', ja: 'シーズンアルバム', en: 'Season Album', desc: { ja: '季節ごとに、集めたものと思い出をまとめる', en: 'Your memories and finds, season by season' } },
];
export const labRoute = id => `lab-${id}`;

export function labHeadHtml(id, lead) {
  const tool = LAB_TOOLS.find(x => x.id === id);
  return `<header class="fun-head">
    <a class="lab-back" href="#/daily-check"><svg class="inline-icon" width="14" height="14"><use href="#i-chevron-left"/></svg>${t('デイリーチェックシート', 'Daily Checklist')}</a>
    <h1 class="fun-h1"><svg class="inline-icon" width="22" height="22" aria-hidden="true"><use href="#${tool.icon}"/></svg>${escapeHtml(t(tool.ja, tool.en))}<span class="lab-badge">${t('試作', 'Lab')}</span></h1>
    ${lead ? `<p class="fun-lead">${lead}</p>` : ''}
  </header>`;
}

/* ================================================================
   Sky MBTI診断（#/sky-mbti）。Skyの場面で答える16問の2択から、MBTI風の4文字のタイプを出すファンメイドの診断。
   元は単体ページ（sky-mbtizhen-duan.html）。中身の文言は data/mbti-data.js（一字一句そのまま）。
   見た目はハブ共通のトークン（--hub-*）だけで組み直した＝着せ替えにそのまま追従する（css/sky-mbti.css）。

   画面: スタート → 質問 → 結果、と「全16タイプ図鑑」→タイプの詳細。
     ・図鑑は #/sky-mbti/types、タイプの詳細は #/sky-mbti/type-INTJ（ブラウザの戻るで戻れるように）。
     ・質問・結果はURLを変えない。図鑑から #/sky-mbti に戻った時は、途中の質問・直前の結果の画面に戻る（下の session）。
   保存: 最後の結果だけを skyMbtiResult_v1 = { type, scores, at }（プロフィールごと）に持つ。
     スタート画面の「前回の結果」と、図鑑の自分のタイプの印に使う。回答そのものは保存しない。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { nsKey } from '../../js/state.js';
import { HUB_BASE_URL } from '../../js/site-config.js';
import { toast } from '../shared/share-image.js';
import {
  QUESTIONS, RESULTS, AXES, GOOD_REASONS, GOOD_REASON_FALLBACK, CLASH_REASONS, CLASH_REASON_FALLBACK,
} from './data/mbti-data.js';

const STYLE_ID = 'sky-mbti-styles';
const RESULT_KEY = 'skyMbtiResult_v1';
const TYPE_ORDER = Object.keys(RESULTS);
const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
const icon = (id, size = 18) => `<svg class="inline-icon" width="${size}" height="${size}" aria-hidden="true"><use href="#${id}"/></svg>`;

// 画面をまたいで残す状態（ルートを移っても、戻ってきたら続きから）
const session = { screen: 'start', idx: 0, answers: [], resultType: null, resultScores: null };
let containerEl = null;
let advanceTimer = 0;

function injectStylesheet() {
  if (document.getElementById(STYLE_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_ID; link.rel = 'stylesheet';
  link.href = new URL('../../css/sky-mbti.css', import.meta.url).href;
  document.head.appendChild(link);
}

function loadSaved() {
  try {
    const v = JSON.parse(localStorage.getItem(nsKey(RESULT_KEY)));
    return v && RESULTS[v.type] ? v : null;
  } catch (e) { return null; }
}
function saveResult(type, scores) {
  try { localStorage.setItem(nsKey(RESULT_KEY), JSON.stringify({ type, scores, at: new Date().toISOString() })); } catch (e) { /* 保存できなくても診断は続ける */ }
}

/* ── 採点（元の実装どおり: 同点は軸の先の文字） ── */
function scoreAnswers(answers) {
  const s = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
  answers.forEach(v => { if (v in s) s[v]++; });
  return s;
}
function validScores(s) {
  if (!s || typeof s !== 'object') return null;
  return 'EISNTFJP'.split('').every(k => Number.isInteger(s[k]) && s[k] >= 0) ? s : null;
}
function typeOf(s) {
  return (s.E >= s.I ? 'E' : 'I') + (s.S >= s.N ? 'S' : 'N') + (s.T >= s.F ? 'T' : 'F') + (s.J >= s.P ? 'J' : 'P');
}

/* ================================================================
   公開API
   ================================================================ */
export function mount(container, sub) {
  injectStylesheet();
  containerEl = container;
  container.innerHTML = '<div class="sky-mbti-view"><div class="mb-wrap"></div></div>';
  root().addEventListener('click', onClick);
  const m = /^type-([A-Z]{4})$/.exec(sub || '');
  if (m && RESULTS[m[1]]) renderDetail(m[1]);
  else if (sub === 'types') renderGallery();
  else renderScreen();
}

export function unmount() {
  clearTimeout(advanceTimer);
  containerEl = null;
}

function root() { return containerEl && containerEl.querySelector('.sky-mbti-view'); }
function wrap() { return containerEl && containerEl.querySelector('.mb-wrap'); }

function paint(html, focusSel) {
  const w = wrap();
  if (!w) return;
  w.innerHTML = html;
  window.scrollTo({ top: 0 });
  const f = focusSel && w.querySelector(focusSel);
  if (f) f.focus({ preventScroll: true });
}

function renderScreen() {
  if (session.screen === 'quiz') renderQuiz();
  else if (session.screen === 'result' && session.resultType) renderResult();
  else renderStart();
}

/* ── スタート ── */
function renderStart() {
  session.screen = 'start';
  const saved = loadSaved();
  const savedHtml = saved ? `
    <button type="button" class="mb-last" data-act="last">
      <span class="mb-last-label">${t('前回の結果', 'Your last result')}</span>
      <span class="mb-last-code">${saved.type}</span>
      <span class="mb-last-title">${escapeHtml(RESULTS[saved.type].title)}</span>
      ${icon('i-chevron-right', 16)}
    </button>` : '';
  paint(`
    <section class="mb-screen">
      <div class="mb-hero"><img src="${new URL('../../images/sky-mbti/hero.webp', import.meta.url).href}" alt="金色の光に包まれた雲海の上に、草原の浮島と小さな古代遺跡が静かに浮かぶ、柔らかくミニマルな空の風景" width="1200" height="800"></div>
      <div class="mb-intro">
        <p class="mb-eyebrow">FANMADE QUIZ</p>
        <h1 class="mb-h1" tabindex="-1">Sky MBTI診断</h1>
        <p class="mb-lead">もしあなたの性格が、Skyでの過ごし方に表れるとしたら？<br>キャンマラの回り方、野良さんとの距離感、原罪での立ち回り…いつもの飛び方から、あなたのMBTIを診断します。</p>
        <p class="mb-meta">${icon('i-candle', 14)}全16問 ・ 約2分 ・ 全16タイプ</p>
      </div>
      <div class="mb-how">
        <div>${icon('i-wing', 20)}<span>いつもの飛び方で<br>答えるだけ</span></div>
        <div>${icon('i-candle', 20)}<span>直感で選ぶのが<br>おすすめ</span></div>
        <div>${icon('i-star', 20)}<span>フレンド相性も<br>わかります</span></div>
      </div>
      ${savedHtml}
      <div class="mb-card mb-start-card">
        <p class="mb-start-note">深く考えず、「いつもの自分」に近い方を選んでね。<br>効率派もまったり派も、正解・不正解はありません。</p>
        <button type="button" class="mb-btn primary" data-act="start">診断をはじめる</button>
        <button type="button" class="mb-btn" data-act="gallery">全16タイプを先に見る</button>
      </div>
      <p class="mb-note">※ 本診断はファンメイドのエンタメ診断です。公式のMBTI®検査とは異なります。</p>
    </section>`, '.mb-h1');
}

/* ── 質問 ── */
function startQuiz() {
  session.idx = 0; session.answers = []; session.screen = 'quiz';
  renderQuiz();
}
function renderQuiz() {
  session.screen = 'quiz';
  const q = QUESTIONS[session.idx];
  const total = QUESTIONS.length;
  const pct = Math.round(session.idx / total * 100);
  const dots = QUESTIONS.map((_, i) => `<i class="${i < session.answers.length ? 'on' : ''}${i === session.idx ? ' now' : ''}"></i>`).join('');
  const choice = (c, key) => `
    <button type="button" class="mb-choice" data-act="answer" data-v="${c.v}" data-key="${key}">
      <span class="mb-choice-t">${escapeHtml(c.t)}</span>
      <small>${escapeHtml(c.s)}</small>
    </button>`;
  paint(`
    <section class="mb-screen">
      <div class="mb-card mb-quiz">
        <div class="mb-qhead"><span>Q${session.idx + 1} / ${total}</span><span>${pct}%</span></div>
        <div class="mb-dots" aria-hidden="true">${dots}</div>
        <div class="mb-progress" role="progressbar" aria-label="診断の進捗" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
        <div class="mb-q">
          <p class="mb-qarea">${escapeHtml(q.area)}</p>
          <p class="mb-qtext" tabindex="-1">${escapeHtml(q.text)}</p>
          <div class="mb-choices">${choice(q.a, 'a')}${choice(q.b, 'b')}</div>
        </div>
        <button type="button" class="mb-back" data-act="prev" ${session.idx > 0 ? '' : 'hidden'}>${icon('i-chevron-left', 15)}前の質問にもどる</button>
      </div>
      <p class="mb-note">迷ったら「いつもSkyでどうしてるかな？」を思い浮かべてね。</p>
    </section>`, '.mb-qtext');
}
function answer(btn) {
  if (advanceTimer) return; // 連打で2問進まないように
  btn.classList.add('picked');
  session.answers[session.idx] = btn.dataset.v;
  advanceTimer = setTimeout(() => {
    advanceTimer = 0;
    if (!containerEl) return;
    if (session.idx < QUESTIONS.length - 1) { session.idx++; renderQuiz(); return; }
    const scores = scoreAnswers(session.answers);
    session.resultType = typeOf(scores);
    session.resultScores = scores;
    saveResult(session.resultType, scores);
    renderResult();
  }, 180);
}

/* ── 結果・タイプの詳細（共通の中身） ── */
function typeBody(type, { scores = null } = {}) {
  const r = RESULTS[type];
  const g = RESULTS[r.good], c = RESULTS[r.clash];
  const axes = scores ? `
      <div class="mb-section">
        <h2 class="mb-h2">${icon('i-grid', 16)}4つのものさし</h2>
        ${AXES.map(ax => {
          const total = scores[ax.left] + scores[ax.right];
          const leftPct = total ? Math.round(scores[ax.left] / total * 100) : 50;
          const winLeft = scores[ax.left] >= scores[ax.right];
          return `<div class="mb-axis">
            <div class="mb-axis-top">
              <span class="${winLeft ? 'win' : ''}"><b>${ax.left}</b> ${escapeHtml(ax.leftName)} <span class="dim">${escapeHtml(ax.leftDesc)}</span></span>
              <span class="mb-axis-pct">${winLeft ? leftPct : 100 - leftPct}%</span>
              <span class="${winLeft ? '' : 'win'}"><b>${ax.right}</b> ${escapeHtml(ax.rightName)} <span class="dim">${escapeHtml(ax.rightDesc)}</span></span>
            </div>
            <div class="mb-bar"><i style="width:${leftPct}%"></i></div>
          </div>`;
        }).join('')}
      </div>` : '';
  const compat = (kind, code, other, reason) => `
      <button type="button" class="mb-compat ${kind}" data-act="type" data-type="${code}">
        <span class="mb-compat-label">${kind === 'good' ? '◎ 相性のいいタイプ' : '△ ちょっとぶつかるタイプ'}</span>
        <span class="mb-compat-code">${code}</span>
        <b>${escapeHtml(other.title + '｜' + other.catch)}</b>
        <span class="mb-compat-reason">${escapeHtml(reason)}</span>
      </button>`;
  return `
      <div class="mb-code" tabindex="-1">${type}</div>
      <div class="mb-title">${escapeHtml(r.title)}</div>
      <div class="mb-catch">${escapeHtml(r.catch)}</div>
      <div class="mb-tags">${r.tags.map(x => `<span>${escapeHtml(x)}</span>`).join('')}</div>
      <div class="mb-section">
        <h2 class="mb-h2">${icon('i-sparkle', 16)}${scores ? 'あなたの性格' : '性格'}</h2>
        <p>${escapeHtml(r.desc)}</p>
      </div>
      ${axes}
      <div class="mb-section">
        <h2 class="mb-h2">${icon('i-wing', 16)}おすすめの過ごし方</h2>
        <p>${escapeHtml(r.play)}</p>
        <p class="mb-area"><b>おすすめエリア：</b>${escapeHtml(r.area)}</p>
      </div>
      <div class="mb-section">
        <h2 class="mb-h2">${icon('i-heart', 16)}フレンドとの相性</h2>
        <div class="mb-compats">
          ${compat('good', r.good, g, GOOD_REASONS[type + '-' + r.good] || GOOD_REASON_FALLBACK)}
          ${compat('clash', r.clash, c, CLASH_REASONS[type + '-' + r.clash] || CLASH_REASON_FALLBACK)}
        </div>
        <p class="mb-hint">ぶつかるタイプは「相性が悪い」わけじゃなくて、キャンマラのペースや飛び方の違いで戸惑いやすい相手。違いを知ると、意外と良い相棒になります。</p>
      </div>`;
}

function renderResult() {
  session.screen = 'result';
  paint(`
    <section class="mb-screen">
      <div class="mb-card mb-result">
        <p class="mb-result-lead">あなたのタイプは…</p>
        ${typeBody(session.resultType, { scores: session.resultScores })}
        <div class="mb-actions">
          <button type="button" class="mb-btn primary" data-act="copy">${icon('i-copy', 16)}結果をコピーする</button>
          <button type="button" class="mb-btn" data-act="start">${icon('i-sync', 16)}もう一度診断する</button>
          <button type="button" class="mb-btn" data-act="gallery">${icon('i-grid', 16)}全16タイプを見る</button>
        </div>
      </div>
    </section>`, '.mb-code');
}

/* ── 図鑑・タイプの詳細 ── */
function renderGallery() {
  const mine = (loadSaved() || {}).type;
  paint(`
    <section class="mb-screen">
      <div class="mb-gallery-head">
        <button type="button" class="mb-back" data-act="home">${icon('i-chevron-left', 15)}診断にもどる</button>
        <h1 class="mb-h1 mb-h1-sm" tabindex="-1">全16タイプ図鑑</h1>
        <p class="mb-lead">気になるタイプをタップすると、詳しい性格と相性が見られます。</p>
      </div>
      <div class="mb-grid">
        ${TYPE_ORDER.map(code => {
          const r = RESULTS[code];
          return `<button type="button" class="mb-type${code === mine ? ' mine' : ''}" data-act="type" data-type="${code}">
            <b>${code}${code === mine ? icon('i-star', 13) : ''}</b>
            <span class="mb-type-title">${escapeHtml(r.title)}</span>
            <span class="mb-type-catch">${escapeHtml(r.catch)}</span>
          </button>`;
        }).join('')}
      </div>
    </section>`, '.mb-h1');
}
function renderDetail(type) {
  const mine = (loadSaved() || {}).type;
  paint(`
    <section class="mb-screen">
      <button type="button" class="mb-back" data-act="gallery-back">${icon('i-chevron-left', 15)}図鑑にもどる</button>
      <div class="mb-card mb-result">
        ${type === mine ? `<p class="mb-result-lead">${icon('i-star', 13)}あなたのタイプ</p>` : ''}
        ${typeBody(type)}
      </div>
    </section>`, '.mb-code');
}

/* ── 結果のコピー（元のページと同じ文面＋このページのURL） ── */
async function copyResult() {
  const type = session.resultType;
  if (!type) return;
  const r = RESULTS[type];
  const text = '🕯️ Sky MBTI診断 🕯️\n私は ' + type + '（' + r.title + '）でした！\n「' + r.catch + '」\nおすすめエリア：' + r.area
    + '\n相性のいいタイプ：' + r.good + '／ちょっとぶつかるタイプ：' + r.clash + '\n' + HUB_BASE_URL + '#/sky-mbti';
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    ta.remove();
  }
  toast(ok ? '結果をコピーしました' : 'コピーできませんでした');
}

function onClick(e) {
  const el = e.target.closest('[data-act]');
  if (!el || !root()?.contains(el)) return;
  const act = el.dataset.act;
  if (act === 'start') startQuiz();
  else if (act === 'answer') answer(el);
  else if (act === 'prev') {
    if (session.idx > 0 && !advanceTimer) { session.idx--; session.answers = session.answers.slice(0, session.idx); renderQuiz(); }
  } else if (act === 'gallery') location.hash = '#/sky-mbti/types';
  else if (act === 'type') location.hash = '#/sky-mbti/type-' + el.dataset.type;
  else if (act === 'gallery-back') location.hash = '#/sky-mbti/types';
  else if (act === 'home') location.hash = '#/sky-mbti';
  else if (act === 'last') {
    const saved = loadSaved();
    if (saved) { session.resultType = saved.type; session.resultScores = validScores(saved.scores); renderResult(); }
  } else if (act === 'copy') copyResult();
}

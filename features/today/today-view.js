/* ================================================================
   ☀️ デイリーチェックシートの画面（#/daily-check。以前の「今日やること」#/today も同じ画面）。
   チェックシートの上に、その日の要点をまとめて見せる（2026-11-06に「今日やること」をチェックシート側へまとめ、
   関連ツールの一覧からは外した。デイリーチェックシートはまだ非公開なので、どちらのルートも hidden）。
   - デイリーリセット（太平洋時間0時）までの時間・大キャンドル・クエストキャンドル・闇の破片・ウニ焼きなど
     （計算は features/shared/event-dashboard.js の getTodayBrief() に任せる）
   - デイリーチェックシート（features/daily-check）をそのまま埋め込む（シートの切替・編集・着せ替え・印刷もここでできる。
     シートの下には「試作中の機能」への入口も出す＝ labLinks: true）
   - 今日・明日のフレンドの記念日／今週のビンゴ／デイリーチェックシートの進み具合
   - 1日1回のおみくじ（今日のラッキーエリア・エモート・色・ひとこと）
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { getActiveProfileId } from '../../js/state.js';
import { navigate } from '../../js/router.js';
import { ptParts } from '../../js/pacific-time.js';
import { injectStylesheet } from '../bingo/bingo-view.js';
import { loadBingo, hasBingoData, weekKeyAt, countLines, FREE } from '../bingo/bingo-state.js';
import { loadFriendsDoc, upcomingAnniversaries } from '../friends/friends-state.js';
import { loadOmikuji, drawOmikuji, gameDayKey, mergeTodoIntoDailyCheck, FORTUNES, LUCKY_REALMS, LUCKY_COLORS, MESSAGES } from './today-state.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
const L = o => (CURRENT_LANG === 'en' ? o.en : o.ja);

let containerEl = null;
let brief = null;
let emotes = null;
let dc = null; // 埋め込んだデイリーチェックシートのモジュール
let tickTimer = null;
let lastDayKey = '';
let token = 0;

export function mount(container) {
  injectStylesheet();
  containerEl = container;
  lastDayKey = gameDayKey();
  mergeTodoIntoDailyCheck(CURRENT_LANG);
  // 上（要点・おみくじ）と下（ほかのツールから）だけを描き直し、間のチェックシートは一度だけ組み込む
  // （チェックシートは自分で描き直すので、ここで innerHTML ごと消すと入力中の内容が消えてしまう）
  container.innerHTML = `<div class="today-view fun-view"><div class="fun-wrap">
    <div class="td-top"><div class="rc-loading"><span class="rt-spinner"></span></div></div>
    <section class="fun-section td-sheet-sec"><h2 class="fun-h2">${t('チェックシート', 'Checklist')}</h2><div class="td-sheet"></div></section>
    <div class="td-after"></div>
  </div></div>`;
  const my = ++token;
  Promise.all([
    import('../shared/event-dashboard.js'),
    import('../emote/data/emotes.js').catch(() => ({ EMOTES: [] })),
    import('../daily-check/daily-check-view.js'),
  ]).then(([ed, em, dcMod]) => {
    if (my !== token || !containerEl) return;
    brief = ed.getTodayBrief;
    emotes = em.EMOTES || [];
    dc = dcMod;
    dc.mount(root().querySelector('.td-sheet'), { embedded: true, labLinks: true });
    render();
    root().querySelector('.td-top').addEventListener('click', onClick);
    root().querySelector('.td-after').addEventListener('click', onClick);
    tickTimer = setInterval(onTick, 1000);
  });
}

export function unmount() {
  token++;
  clearInterval(tickTimer); tickTimer = null;
  if (dc) { dc.unmount(); dc = null; }
  containerEl = null;
}

function root() { return containerEl && containerEl.querySelector('.today-view'); }

function cd(target) {
  const ms = Math.max(0, target - Date.now());
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const hms = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return d > 0 ? t(`${d}日 ${hms}`, `${d}d ${hms}`) : hms;
}
function hm(d) { return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }

function onTick() {
  if (!containerEl) return;
  if (gameDayKey() !== lastDayKey) { lastDayKey = gameDayKey(); render(); return; }
  // 数字だけ差し替える（入力中の欄を描き直さない）
  const b = brief();
  root().querySelectorAll('[data-cd]').forEach(el => {
    const key = el.dataset.cd;
    const target = key === 'reset' ? b.nextReset : key === 'eden' ? b.nextEden : key === 'geyser' ? b.nextGeyser : key === 'grandma' ? b.nextGrandma : key === 'turtle' ? b.nextTurtle : null;
    if (target) el.textContent = cd(target);
  });
  const shardEl = root().querySelector('[data-shard]');
  if (shardEl && Date.now() % 30000 < 1000) shardEl.innerHTML = shardHtml(b.shard);
}

function render() {
  const r = root();
  if (!r) return;
  const b = brief();
  const p = ptParts(Date.now());
  r.querySelector('.td-top').innerHTML = `
    <header class="fun-head">
      <h1 class="fun-h1"><svg class="inline-icon" width="22" height="22" aria-hidden="true"><use href="#i-sparkle"/></svg>${t('デイリーチェックシート', 'Daily Checklist')}<span class="lab-badge">${t('試作', 'Preview')}</span></h1>
      <p class="fun-lead">${t(`ゲームの日付で${p.month}月${p.day}日。デイリーリセットまで`, `Game day ${p.month}/${p.day}. Daily reset in`)} <b class="td-reset" data-cd="reset">${cd(b.nextReset)}</b></p>
    </header>

    <section class="td-grid">
      <div class="td-tile"><span class="td-tile-label">${t('大キャンドル', 'Big candle')}</span><span class="td-tile-value">${escapeHtml(L(b.grand))}</span></div>
      <div class="td-tile"><span class="td-tile-label">${t('クエスト・シーズンキャンドル', 'Quest & season candles')}</span><span class="td-tile-value">${escapeHtml(L(b.quest))}</span></div>
      <div class="td-tile td-wide" data-shard>${shardHtml(b.shard)}</div>
      <div class="td-tile td-wide td-events">
        <span><small>${t('ウニ焼き', 'Geyser')}</small><b data-cd="geyser">${cd(b.nextGeyser)}</b></span>
        <span><small>${t('パン焼き', 'Grandma')}</small><b data-cd="grandma">${cd(b.nextGrandma)}</b></span>
        <span><small>${t('亀闇', 'Turtle')}</small><b data-cd="turtle">${cd(b.nextTurtle)}</b></span>
        <span><small>${t('暴風域リセット', 'Eden reset')}</small><b data-cd="eden">${cd(b.nextEden)}</b></span>
      </div>
    </section>

    ${omikujiHtml()}`;
  r.querySelector('.td-after').innerHTML = extrasHtml();
}

function shardHtml(s) {
  const now = Date.now();
  if (!s.has) return `<span class="td-tile-label">${t('闇の破片', 'Shard eruption')}</span><span class="td-tile-value td-muted">${t('今日はありません', 'None today')}</span>`;
  const times = s.occurrences.map(o => {
    const cls = o.end <= now ? 'past' : (o.start <= now ? 'active' : '');
    return `<span class="td-shard-time ${cls}">${hm(o.start)}〜${hm(o.end)}${cls === 'active' ? `<em>${t('出現中', 'Now')}</em>` : ''}</span>`;
  }).join('');
  return `<span class="td-tile-label">${t('闇の破片', 'Shard eruption')}<span class="td-shard-dot${s.isRed ? ' red' : ''}"></span>${s.isRed ? t('赤闇', 'Red') : t('黒闇', 'Black')}</span>
    <span class="td-tile-value">${escapeHtml(L(s.realm))}・${escapeHtml(L(s.location))}</span><span class="td-shard-times">${times}</span>`;
}

function omikujiHtml() {
  const r = loadOmikuji().days[gameDayKey()];
  if (!r) {
    return `<section class="td-omikuji is-closed">
      <div class="td-omi-box" aria-hidden="true">${t('みくじ', 'Fortune')}</div>
      <div><div class="td-omi-title">${t('今日のおみくじ', 'Today’s fortune')}</div><p class="fun-hint">${t('1日1回引けます。今日のラッキーエリアやエモートが出ます。', 'Draw once a day for your lucky area and emote.')}</p></div>
      <button type="button" class="fun-btn primary" data-act="draw">${t('引く', 'Draw')}</button>
    </section>`;
  }
  const emote = (emotes || []).find(e => e.id === r.emoteId);
  const color = LUCKY_COLORS[r.color];
  return `<section class="td-omikuji f${r.f}">
    <div class="td-omi-paper">
      <div class="td-omi-fortune">${escapeHtml(L(FORTUNES[r.f]))}</div>
      <p class="td-omi-msg">${escapeHtml(L(MESSAGES[r.msg]))}</p>
      <dl class="td-omi-list">
        <div><dt>${t('ラッキーエリア', 'Lucky area')}</dt><dd>${escapeHtml(L(LUCKY_REALMS[r.realm]))}</dd></div>
        ${emote ? `<div><dt>${t('ラッキーエモート', 'Lucky emote')}</dt><dd>${escapeHtml(CURRENT_LANG === 'en' ? emote.nameEn : emote.name)}</dd></div>` : ''}
        <div><dt>${t('ラッキーカラー', 'Lucky color')}</dt><dd><span class="td-omi-swatch" style="background:${color.hex}"></span>${escapeHtml(L(color))}</dd></div>
      </dl>
    </div>
  </section>`;
}

function extrasHtml() {
  const parts = [];
  const soon = upcomingAnniversaries(loadFriendsDoc(), 1);
  if (soon.length) {
    parts.push(`<button type="button" class="td-link" data-go="friends"><svg class="inline-icon" width="18" height="18"><use href="#i-heart"/></svg><span>${soon.map(a => escapeHtml(annivTitle(a)) + (a.inDays === 0 ? t('（今日）', ' (today)') : t('（明日）', ' (tomorrow)'))).join('<br>')}</span><svg class="inline-icon td-link-chev" width="14" height="14"><use href="#i-chevron-right"/></svg></button>`);
  }
  if (hasBingoData()) {
    const bg = loadBingo();
    const cur = bg.week && bg.week.key === weekKeyAt();
    const filled = cur ? bg.week.marks.filter((m, i) => m && bg.week.cells[i] !== FREE).length : 0;
    const total = cur ? bg.week.cells.filter(c => c !== FREE).length : 0;
    const lines = cur ? countLines(bg.week.size, bg.week.marks) : 0;
    parts.push(`<button type="button" class="td-link" data-go="bingo"><svg class="inline-icon" width="18" height="18"><use href="#i-grid"/></svg><span>${cur ? t(`今週のビンゴ ${lines}ビンゴ・${filled}/${total}マス`, `Bingo: ${lines} lines · ${filled}/${total}`) : t('今週のビンゴが始まっています', 'A new bingo week has started')}</span><svg class="inline-icon td-link-chev" width="14" height="14"><use href="#i-chevron-right"/></svg></button>`);
  }
  if (!parts.length) return '';
  return `<section class="fun-section"><h2 class="fun-h2">${t('ほかのツールから', 'From other tools')}</h2><div class="td-links">${parts.join('')}</div></section>`;
}
function annivTitle(a) {
  const who = a.friend ? a.friend.name : '';
  if (a.kind === 'friend') return t(`${who}さんとフレンドになって${a.years}周年`, `${a.years} year(s) with ${who}`);
  if (a.kind === 'milestone') return t(`${who}さんとフレンドになって${a.count}日`, `${a.count} days with ${who}`);
  if (a.kind === 'birthday') return a.years ? t(`${who}さんの${a.years}歳の誕生日`, `${who}'s ${a.years}th birthday`) : t(`${who}さんの誕生日`, `${who}'s birthday`);
  return a.title;
}

function onClick(e) {
  const go = e.target.closest('[data-go]');
  if (go) { navigate(go.dataset.go, ''); return; }
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  if (act === 'draw') {
    drawOmikuji(emotes, getActiveProfileId());
    render();
    root().querySelector('.td-omikuji')?.classList.add('just-drawn');
    return;
  }
}

/* ================================================================
   💾 バックアップのリマインド（2026-11-12）。
   データは端末の中にしか無いので、しばらくバックアップしていない時だけ、ダッシュボード
   （features/shared/event-dashboard.js）の上に控えめな帯を出す。ポップアップは出さない。
   ・最後にバックアップした日時: 表示設定の「データのバックアップ > 書き出し」（js/chrome/settings-modal.js）で
     sky_hub_last_backup_at に記録する。データ引継ぎでコードを作った日時（dataTransferLastExportAt_v1）も
     バックアップとして数え、新しい方を使う。
   ・30日以上たっている時に出す。一度もバックアップしていない時は、使い始めてから7日たってから出す
     （初めて開いた日にいきなり出さないため。使い始めた日＝この判定を初めて行った日を sky_hub_backup_since に残す）。
   ・「あとで」で閉じると、7日間は出さない（sky_hub_backup_snooze_until）。
   ・どれも端末全体の設定（プロフィールごとには分けない。書き出しは全プロフィール分をまとめて保存するため）。
   ・開発中の確かめ方: localStorage の上の3つのキーの日時を書き換えてダッシュボードを開き直す。
   ================================================================ */
import { CURRENT_LANG } from './i18n.js';
import { nsKey } from './state.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
const LAST_KEY = 'sky_hub_last_backup_at';
const SINCE_KEY = 'sky_hub_backup_since';
const SNOOZE_KEY = 'sky_hub_backup_snooze_until';
const DAY = 86400000;
const REMIND_AFTER = 30 * DAY;
const FIRST_GRACE = 7 * DAY;
const SNOOZE = 7 * DAY;
const DONE_EVENT = 'hub-backup-done';

function readTime(key) {
  try { const v = Date.parse(localStorage.getItem(key) || ''); return Number.isFinite(v) ? v : 0; } catch (e) { return 0; }
}

/** 最後にバックアップした日時（ミリ秒。一度も無ければ 0） */
export function lastBackupAt() {
  return Math.max(readTime(LAST_KEY), readTime(nsKey('dataTransferLastExportAt_v1')));
}

/** バックアップを書き出した時に呼ぶ。出ている帯も消す */
export function recordBackup() {
  try {
    localStorage.setItem(LAST_KEY, new Date().toISOString());
    localStorage.removeItem(SNOOZE_KEY);
  } catch (e) { /* noop */ }
  document.dispatchEvent(new CustomEvent(DONE_EVENT));
}

/** 帯を出すかどうか */
export function shouldRemind(now = Date.now()) {
  if (readTime(SNOOZE_KEY) > now) return false;
  const last = lastBackupAt();
  if (last) return now - last >= REMIND_AFTER;
  let since = readTime(SINCE_KEY);
  if (!since) {
    try { localStorage.setItem(SINCE_KEY, new Date(now).toISOString()); } catch (e) { /* noop */ }
    since = now;
  }
  return now - since >= FIRST_GRACE;
}

function snooze() {
  try { localStorage.setItem(SNOOZE_KEY, new Date(Date.now() + SNOOZE).toISOString()); } catch (e) { /* noop */ }
}

const STYLE_ID = 'hub-backup-reminder-styles';
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement('style');
  st.id = STYLE_ID;
  st.textContent = `
.hub-backup-bar { margin: 0 0 16px; padding: 11px 12px; border-radius: var(--hub-r-sm, 10px); background: var(--hub-bg); border: 0.5px solid var(--hub-sep); font-size: 12.5px; line-height: 1.6; color: var(--hub-text); }
.hub-backup-bar p { margin: 0 0 8px; }
.hub-backup-actions { display: flex; gap: 8px; }
.hub-backup-btn { flex: 1; min-height: 36px; padding: 6px 10px; border: 0; border-radius: 9px; font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; }
.hub-backup-btn.is-go { background: var(--hub-accent); color: #fff; }
.hub-backup-btn.is-later { background: transparent; color: var(--hub-text-2); border: 0.5px solid var(--hub-sep); }
.hub-backup-btn:active { transform: scale(0.97); }
@media (prefers-reduced-motion: reduce) { .hub-backup-btn:active { transform: none; } }
@media (prefers-contrast: more) { .hub-backup-bar, .hub-backup-btn.is-later { border-color: var(--hub-text-2); } }
`;
  document.head.appendChild(st);
}

/** el の先頭に、必要な時だけ帯を出す（ダッシュボードを描くたびに呼んでよい） */
export function mountBackupReminder(el) {
  if (!el) return;
  el.querySelector(':scope > .hub-backup-bar')?.remove();
  if (!shouldRemind()) return;
  injectStyles();
  const last = lastBackupAt();
  const bar = document.createElement('div');
  bar.className = 'hub-backup-bar';
  bar.setAttribute('role', 'status');
  bar.innerHTML = `<p>${last
    ? t('データのバックアップから30日以上たっています。端末の故障やデータの消去に備えて、バックアップをおすすめします。', 'It has been 30+ days since your last backup. Back up your data in case your device breaks or data is cleared.')
    : t('データはこの端末の中にだけ保存されています。端末の故障やデータの消去に備えて、バックアップをおすすめします。', 'Your data is stored only on this device. Back it up in case your device breaks or data is cleared.')}</p>
    <div class="hub-backup-actions">
      <button type="button" class="hub-backup-btn is-go" data-backup="go">${t('バックアップする', 'Back up')}</button>
      <button type="button" class="hub-backup-btn is-later" data-backup="later">${t('あとで', 'Later')}</button>
    </div>`;
  bar.addEventListener('click', e => {
    const b = e.target.closest('[data-backup]');
    if (!b) return;
    if (b.dataset.backup === 'later') { snooze(); bar.remove(); return; }
    import('./chrome/settings-modal.js').then(m => m.open({ focus: 'backup' }));
  });
  el.prepend(bar);
}

// バックアップしたら、出ている帯をすべて消す
document.addEventListener(DONE_EVENT, () => document.querySelectorAll('.hub-backup-bar').forEach(b => b.remove()));

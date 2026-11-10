/* ================================================================
   🗂️ 季節・イベントの複数選択（2026-11-10）。
   アイテム所持管理の「季節・イベント」「イベント・登場元」の<select>を、チェックで複数選べる欄に差し替える。
   ・元の<select>は隠して残し、選び直した時はその<select>で change を起こす（今までの絞り込みの配線がそのまま動く）。
   ・選んでいる値は eventSet(selectEl) で受け取る（空の Set＝すべて）。
   ・<select>の中身（option・optgroup）を作り直した後は、もう一度 enhanceEventSelect() を呼ぶ（選択は引き継ぐ）。
   ・絞り込みの「リセット」（resetFilterPanel）はパネル内のチェックを全部外すので、それで「すべて」に戻る。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
const STYLE_ID = 'item-event-multi-styles';

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement('style');
  st.id = STYLE_ID;
  st.textContent = `
.evm { position: relative; flex: 1 1 200px; min-width: 0; }
.evm-btn {
  width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 8px 12px;
  border: 1px solid var(--hub-sep); border-radius: 10px; background: var(--hub-card); color: var(--hub-text);
  font: inherit; font-size: 13px; text-align: left; cursor: pointer;
}
.evm-btn .inline-icon { flex-shrink: 0; stroke: currentColor; color: var(--hub-text-2); transition: transform 0.2s ease; }
.evm.open .evm-btn .inline-icon { transform: rotate(180deg); }
.evm-btn span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.evm-btn.has-sel { border-color: var(--hub-accent); color: var(--hub-accent-ink); font-weight: 700; }
.evm-panel { display: none; margin-top: 6px; border: 1px solid var(--hub-sep); border-radius: 12px; background: var(--hub-card); overflow: hidden; }
.evm.open .evm-panel { display: block; animation: evmIn 0.18s ease-out; }
@keyframes evmIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
.evm-tools { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 10px; border-bottom: 1px solid var(--hub-sep); }
.evm-tool {
  padding: 4px 10px; border: 1px solid var(--hub-sep); border-radius: 999px; background: none; color: var(--hub-text);
  font: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
}
.evm-tool:active { transform: scale(0.95); }
.evm-list { max-height: 300px; overflow-y: auto; padding: 4px 0 6px; }
.evm-group { padding: 8px 12px 2px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; color: var(--hub-text-2); }
.evm-item { display: flex; align-items: center; gap: 8px; padding: 7px 12px; font-size: 13px; color: var(--hub-text); cursor: pointer; }
.evm-item:hover { background: var(--hub-accent-bg); }
.evm-item input { width: 16px; height: 16px; accent-color: var(--hub-accent); flex-shrink: 0; margin: 0; }
@media (prefers-reduced-motion: reduce) { .evm.open .evm-panel { animation: none; } .evm-btn .inline-icon { transition: none; } }
@media (prefers-contrast: more) { .evm-btn, .evm-panel, .evm-tool { border-color: var(--hub-text-2); } }
`;
  document.head.appendChild(st);
}

/** <select> を複数選択の欄に差し替える（すでに差し替え済みなら中身だけ作り直す） */
export function enhanceEventSelect(selectEl) {
  if (!selectEl) return;
  injectStyles();
  const prev = selectEl._evm ? new Set(selectEl._evm.values) : new Set();
  let box = selectEl._evm && selectEl._evm.box;
  if (!box) {
    box = document.createElement('div');
    box.className = 'evm';
    selectEl.insertAdjacentElement('afterend', box);
    selectEl.style.display = 'none';
    box.addEventListener('click', onBoxClick);
    box.addEventListener('change', e => { if (e.target.matches('.evm-item input')) commit(); });
    // 欄の外を押したら閉じる
    document.addEventListener('click', e => { if (box.isConnected && !box.contains(e.target)) box.classList.remove('open'); });
  }
  const allLabel = selectEl.options[0] ? selectEl.options[0].textContent : t('すべて', 'All');
  // option・optgroup から、グループごとの一覧を作る（先頭の「すべて」は除く）
  const groups = [];
  let loose = [];
  [...selectEl.children].forEach(ch => {
    if (ch.tagName === 'OPTGROUP') groups.push({ label: ch.label, opts: [...ch.children].map(o => ({ v: o.value, text: o.textContent })) });
    else if (ch.tagName === 'OPTION' && ch.value !== 'all') loose.push({ v: ch.value, text: ch.textContent });
  });
  if (loose.length) groups.unshift({ label: '', opts: loose });
  const valid = new Set(groups.flatMap(g => g.opts.map(o => o.v)));
  const keep = new Set([...prev].filter(v => valid.has(v)));

  box.innerHTML = `
    <button type="button" class="evm-btn" data-evm="toggle" aria-expanded="false"><span></span><svg class="inline-icon" width="14" height="14" aria-hidden="true"><use href="#i-chevron-down"/></svg></button>
    <div class="evm-panel">
      <div class="evm-tools">
        <button type="button" class="evm-tool" data-evm="clear">${t('選択を外す（すべて）', 'Clear (all)')}</button>
        ${groups.filter(g => g.label).map((g, i) => `<button type="button" class="evm-tool" data-evm="group" data-g="${i + (loose.length ? 1 : 0)}">${escapeHtml(t(`${g.label}をまとめて`, `All ${g.label}`))}</button>`).join('')}
      </div>
      <div class="evm-list">
        ${groups.map((g, gi) => `${g.label ? `<div class="evm-group">${escapeHtml(g.label)}</div>` : ''}${g.opts.map(o => `<label class="evm-item"><input type="checkbox" data-g="${gi}" value="${escapeHtml(o.v)}"${keep.has(o.v) ? ' checked' : ''}><span>${escapeHtml(o.text)}</span></label>`).join('')}`).join('')}
      </div>
    </div>`;
  selectEl._evm = { box, allLabel, values: keep };
  updateLabel(selectEl);

  function onBoxClick(e) {
    const btn = e.target.closest('[data-evm]');
    if (!btn) return;
    const act = btn.dataset.evm;
    if (act === 'toggle') {
      const open = !box.classList.contains('open');
      box.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
      return;
    }
    const inputs = [...box.querySelectorAll('.evm-item input')];
    if (act === 'clear') inputs.forEach(i => { i.checked = false; });
    if (act === 'group') {
      const g = inputs.filter(i => i.dataset.g === btn.dataset.g);
      const allOn = g.every(i => i.checked);
      g.forEach(i => { i.checked = !allOn; });
    }
    commit();
  }
  function commit() {
    selectEl._evm.values = new Set([...box.querySelectorAll('.evm-item input:checked')].map(i => i.value));
    updateLabel(selectEl);
    // 1つだけ選んだ時は<select>の値もそれにしておく（単一の値を見ている古い処理のため）
    const vals = [...selectEl._evm.values];
    selectEl.value = vals.length === 1 ? vals[0] : 'all';
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function updateLabel(selectEl) {
  const s = selectEl._evm;
  if (!s) return;
  const btn = s.box.querySelector('.evm-btn');
  const span = btn && btn.querySelector('span');
  if (!span) return;
  const vals = [...s.values];
  const nameOf = v => { const el = s.box.querySelector(`.evm-item input[value="${CSS.escape(v)}"]`); return el ? el.nextElementSibling.textContent : v; };
  span.textContent = !vals.length ? s.allLabel
    : vals.length === 1 ? nameOf(vals[0])
      : t(`${nameOf(vals[0])} ほか${vals.length - 1}件`, `${nameOf(vals[0])} +${vals.length - 1}`);
  btn.classList.toggle('has-sel', vals.length > 0);
}

/** 選んでいる季節・イベント（空の Set＝すべて）。リセットでチェックが外された時もここで追いつく */
export function eventSet(selectEl) {
  if (!selectEl) return new Set();
  const s = selectEl._evm;
  if (!s) return selectEl.value && selectEl.value !== 'all' ? new Set([selectEl.value]) : new Set();
  s.values = new Set([...s.box.querySelectorAll('.evm-item input:checked')].map(i => i.value));
  updateLabel(selectEl);
  return s.values;
}

/* ================================================================
   💐 フレンド記念日・フォト日記（#/friends）。
   Skyで出会ったフレンドと「フレンドになった日」、誕生日などの記念日、思い出の写真と一言を残す。
   近づいた記念日はドックの「お知らせ」でも知らせる（js/notices.js → friends-state.js の upcomingAnniversaries）。

   画面は3つのタブ: フレンド／記念日／フォト日記。日記の上には、過去の同じ日の思い出（「1年前の今日」）を出す。
   データの形は friends-state.js を参照（写真は IndexedDB、それ以外は localStorage）。
   ================================================================ */
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { notifyChanged } from '../../js/notices.js';
import { injectStylesheet } from '../bingo/bingo-view.js';
import { toast } from '../shared/share-image.js';
import {
  loadFriendsDoc, saveFriendsDoc, upcomingAnniversaries, daysSince, todayStr, putPhoto, getPhoto, deletePhoto,
} from './friends-state.js';

const t = (ja, en) => (CURRENT_LANG === 'en' ? en : ja);
// アイコンにすぐ選べる文字（Skyらしいもの）。自分で好きな文字・絵文字も入れられる
const AVATAR_PRESETS = ['⭐', '🌙', '☁️', '🕯️', '🦋', '🐳', '🦀', '🌸', '🎵', '💖', '🍵', '🌈'];
const COLORS = ['#E8679A', '#F59E0B', '#22A06B', '#3489D6', '#8574DB', '#A8646F', '#5F7F63', '#64748B'];
const TAB_KEY = 'sky_friends_tab';

let containerEl = null;
let doc = null;
let tab = 'friends';
let form = null; // 開いている入力欄 { kind: 'friend'|'day'|'diary', id?: 編集中のid }
let confirmId = null;
let confirmTimer = null;
const photoUrls = new Map(); // photoId -> objectURL（画面を離れる時に解放する）
let pendingPhoto = null; // 日記の入力中に選んだ写真（縮小済みBlob）
let pendingPhotoUrl = null;

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

export function mount(container) {
  injectStylesheet();
  containerEl = container;
  doc = loadFriendsDoc();
  try { tab = ['friends', 'days', 'diary'].includes(localStorage.getItem(TAB_KEY)) ? localStorage.getItem(TAB_KEY) : 'friends'; } catch (e) { tab = 'friends'; }
  form = null; confirmId = null;
  container.innerHTML = '<div class="friends-view fun-view"></div>';
  render();
  const r = root();
  r.addEventListener('click', onClick);
  r.addEventListener('change', onChange);
  r.addEventListener('submit', onSubmit);
  r.addEventListener('input', onInput);
}

export function unmount() {
  clearTimeout(confirmTimer);
  photoUrls.forEach(u => URL.revokeObjectURL(u));
  photoUrls.clear();
  clearPendingPhoto();
  containerEl = null;
}

function root() { return containerEl && containerEl.querySelector('.friends-view'); }
function save() {
  if (!saveFriendsDoc(doc)) toast(t('保存できませんでした（端末の空き容量を確かめてください）', 'Could not save (storage may be full)'));
  notifyChanged();
}
function friendById(id) { return doc.friends.find(f => f.id === id); }

function fmtDate(str) {
  if (!str) return '';
  const p = str.split('-').map(Number);
  if (p.length === 2) return t(`${p[0]}月${p[1]}日`, `${p[0]}/${p[1]}`);
  return t(`${p[0]}年${p[1]}月${p[2]}日`, `${p[1]}/${p[2]}/${p[0]}`);
}

function render() {
  const r = root();
  if (!r) return;
  const soon = upcomingAnniversaries(doc, 30);
  r.innerHTML = `
    <div class="fun-wrap">
      <header class="fun-head">
        <h1 class="fun-h1"><svg class="inline-icon" width="22" height="22" aria-hidden="true"><use href="#i-heart"/></svg>${t('フレンド記念日', 'Friend Anniversaries')}</h1>
        <p class="fun-lead">${t('フレンドになった日や誕生日を残しておくと、近づいた時に「お知らせ」でお知らせします。思い出の写真と一言はフォト日記へ。', 'Keep the days you became friends and other anniversaries — you’ll get a notice when they come around. Save memories in the photo diary.')}</p>
      </header>
      ${soon.length ? `<section class="fr-soon" aria-label="${t('もうすぐの記念日', 'Coming up')}">
        <h2 class="fun-h2">${t('もうすぐの記念日', 'Coming up')}</h2>
        <ul>${soon.slice(0, 5).map(soonHtml).join('')}</ul>
      </section>` : ''}
      <div class="fun-tabs" role="tablist">
        ${tabBtn('friends', t('フレンド', 'Friends'), doc.friends.length)}
        ${tabBtn('days', t('記念日', 'Days'), doc.days.length)}
        ${tabBtn('diary', t('フォト日記', 'Photo diary'), doc.diary.length)}
      </div>
      <div class="fr-panel" role="tabpanel">${tab === 'friends' ? friendsHtml() : tab === 'days' ? daysHtml() : diaryHtml()}</div>
    </div>`;
  loadVisiblePhotos();
}

function tabBtn(key, label, n) {
  return `<button type="button" class="fun-tab${tab === key ? ' on' : ''}" role="tab" aria-selected="${tab === key}" data-tab="${key}">${escapeHtml(label)}<span>${n}</span></button>`;
}

function soonHtml(a) {
  const who = a.friend ? (a.friend.name || t('フレンド', 'Friend')) : '';
  let title;
  if (a.kind === 'friend') title = t(`${who}さんとフレンドになって${a.years}周年`, `${a.years} year(s) with ${who}`);
  else if (a.kind === 'milestone') title = t(`${who}さんとフレンドになって${a.count}日`, `${a.count} days with ${who}`);
  else title = a.years ? t(`${a.title}（${a.years}年目）`, `${a.title} (year ${a.years})`) : a.title;
  const when = a.inDays === 0 ? t('今日', 'Today') : a.inDays === 1 ? t('明日', 'Tomorrow') : t(`${a.inDays}日後`, `in ${a.inDays} days`);
  const color = a.friend ? a.friend.color : 'var(--hub-accent)';
  const mark = a.friend ? avatarHtml(a.friend, 'is-small') : `<span class="fr-dot" style="background:${color}"></span>`;
  return `<li class="${a.inDays === 0 ? 'is-today' : ''}">${mark}<span class="fr-soon-title">${escapeHtml(title)}</span><span class="fr-soon-when">${when}<small>${a.date.getMonth() + 1}/${a.date.getDate()}</small></span></li>`;
}

/* ── アイコン（写真 → 文字・絵文字 → 名前の1文字目 の順に使う） ── */
// 見た目の1文字ずつに分ける（「👨‍👩‍👧」や「☁️」のような合成された絵文字も1文字として数える）
const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('ja', { granularity: 'grapheme' }) : null;
function graphemes(str) { return segmenter ? [...segmenter.segment(String(str || ''))].map(x => x.segment) : Array.from(String(str || '')); }
function firstChar(str) { return graphemes(str)[0] || '?'; }
function avatarText(f) { return f.avatar || firstChar(f.name); }
function avatarHtml(f, extraClass = '') {
  if (f.avatarPhotoId) {
    const url = photoUrls.get(f.avatarPhotoId);
    return `<span class="fr-avatar has-photo ${extraClass}" style="background:${f.color}" data-avatar-photo="${escapeHtml(f.avatarPhotoId)}">${url ? `<img src="${url}" alt="">` : escapeHtml(avatarText(f))}</span>`;
  }
  return `<span class="fr-avatar ${extraClass}${graphemes(avatarText(f)).length > 1 ? ' is-long' : ''}" style="background:${f.color}">${escapeHtml(avatarText(f))}</span>`;
}

/* ── フレンド ── */
function friendsHtml() {
  const editing = form && form.kind === 'friend';
  const list = [...doc.friends].sort((a, b) => (a.since || '9999').localeCompare(b.since || '9999'));
  return `
    ${editing ? friendFormHtml(form.id ? friendById(form.id) : null) : `<button type="button" class="fun-add" data-act="new-friend"><svg class="inline-icon" width="16" height="16"><use href="#i-plus"/></svg>${t('フレンドを追加', 'Add a friend')}</button>`}
    ${list.length ? `<ul class="fr-list">${list.map(friendRowHtml).join('')}</ul>` : (editing ? '' : emptyHtml(t('まだフレンドがいません。最初のフレンドを追加してみましょう', 'No friends yet. Add your first one.')))}`;
}
function friendRowHtml(f) {
  const days = daysSince(f.since);
  const photos = doc.diary.filter(d => d.friendIds.includes(f.id)).length;
  return `<li class="fr-row">
    ${avatarHtml(f)}
    <div class="fr-main">
      <div class="fr-name">${escapeHtml(f.name || t('（名前なし）', '(no name)'))}</div>
      <div class="fr-sub">${f.since ? `${t('フレンドになった日', 'Friends since')} ${fmtDate(f.since)}${days != null && days >= 0 ? `<b>${t(`${days.toLocaleString()}日`, `${days.toLocaleString()} days`)}</b>` : ''}` : t('フレンドになった日は未設定', 'No date set')}</div>
      ${f.memo ? `<div class="fr-memo">${escapeHtml(f.memo)}</div>` : ''}
      ${photos ? `<button type="button" class="fr-link" data-act="diary-of" data-id="${f.id}">${t(`日記 ${photos}件`, `${photos} diary entries`)}</button>` : ''}
    </div>
    <div class="fr-row-actions">
      <button type="button" class="fun-icon-btn" data-act="edit-friend" data-id="${f.id}" aria-label="${t('編集', 'Edit')}"><svg class="inline-icon" width="15" height="15"><use href="#i-edit"/></svg></button>
    </div>
  </li>`;
}
function friendFormHtml(f) {
  const color = f ? f.color : COLORS[doc.friends.length % COLORS.length];
  const hasPhoto = !!pendingPhotoUrl || (!!(f && f.avatarPhotoId) && !form.removePhoto);
  const photoUrl = pendingPhotoUrl || (f && f.avatarPhotoId && !form.removePhoto ? photoUrls.get(f.avatarPhotoId) : '');
  const txt = f ? f.avatar : '';
  return `<form class="fun-form" data-form="friend">
    <div class="fr-avatar-edit">
      <span class="fr-avatar is-large${hasPhoto ? ' has-photo' : ''}" id="frAvatarPreview" style="background:${color}"${hasPhoto && !photoUrl && f ? ` data-avatar-photo="${escapeHtml(f.avatarPhotoId)}"` : ''}>${photoUrl ? `<img src="${photoUrl}" alt="">` : escapeHtml(txt || firstChar(f ? f.name : '') )}</span>
      <div class="fr-avatar-tools">
        <span class="fun-label">${t('アイコン', 'Icon')}</span>
        <div class="fr-avatar-btns">
          <label class="fun-btn small fr-file-btn"><svg class="inline-icon" width="14" height="14"><use href="#i-camera"/></svg>${hasPhoto ? t('写真を変える', 'Change photo') : t('写真にする', 'Use a photo')}<input type="file" accept="image/*" name="avatarPhoto"></label>
          ${hasPhoto ? `<button type="button" class="fun-btn small" data-act="clear-photo">${t('写真をやめる', 'Remove photo')}</button>` : ''}
        </div>
      </div>
    </div>
    ${hasPhoto ? '' : `<div class="fun-field">
      <span class="fun-label">${t('アイコンの文字（2文字まで・絵文字もOK）', 'Icon text (up to 2 characters or an emoji)')}</span>
      <input class="fun-input" name="avatar" maxlength="16" value="${escapeHtml(txt)}" placeholder="${escapeHtml(firstChar(f ? f.name : '') === '?' ? '' : firstChar(f ? f.name : ''))}" autocomplete="off">
      <div class="fun-chips fr-avatar-presets">${AVATAR_PRESETS.map(ch => `<button type="button" class="fun-chip${txt === ch ? ' on' : ''}" data-act="avatar-preset" data-ch="${ch}">${ch}</button>`).join('')}</div>
    </div>`}
    <label class="fun-field"><span class="fun-label">${t('名前', 'Name')}</span><input class="fun-input" name="name" maxlength="40" required value="${escapeHtml(f ? f.name : '')}" placeholder="${t('ゲーム内で付けた名前など', 'The name you gave them')}"></label>
    <label class="fun-field"><span class="fun-label">${t('フレンドになった日', 'Friends since')}</span><input class="fun-input" type="date" name="since" max="${todayStr()}" value="${f ? f.since : ''}"></label>
    <div class="fun-field"><span class="fun-label">${t('色', 'Color')}</span><div class="fun-swatches">${COLORS.map(c => `<label class="fun-swatch" style="--sw:${c}"><input type="radio" name="color" value="${c}"${c === color ? ' checked' : ''}><span></span></label>`).join('')}</div></div>
    <label class="fun-field"><span class="fun-label">${t('メモ', 'Note')}</span><textarea class="fun-textarea" name="memo" rows="2" maxlength="400" placeholder="${t('出会った場所、好きなもの など', 'Where you met, what they like…')}">${escapeHtml(f ? f.memo : '')}</textarea></label>
    <div class="fun-form-actions">
      ${f ? `<button type="button" class="fun-btn danger${confirmId === f.id ? ' is-confirm' : ''}" data-act="del-friend" data-id="${f.id}">${confirmId === f.id ? t('もう一度押すと削除', 'Tap again to delete') : t('削除', 'Delete')}</button>` : ''}
      <span class="fun-spacer"></span>
      <button type="button" class="fun-btn" data-act="cancel">${t('やめる', 'Cancel')}</button>
      <button type="submit" class="fun-btn primary">${t('保存', 'Save')}</button>
    </div>
  </form>`;
}

/* ── 記念日 ── */
function daysHtml() {
  const editing = form && form.kind === 'day';
  const list = [...doc.days].sort((a, b) => a.date.slice(-5).localeCompare(b.date.slice(-5)));
  return `
    ${editing ? dayFormHtml(form.id ? doc.days.find(d => d.id === form.id) : null) : `<button type="button" class="fun-add" data-act="new-day"><svg class="inline-icon" width="16" height="16"><use href="#i-plus"/></svg>${t('記念日を追加', 'Add a day')}</button>`}
    <p class="fun-hint">${t('フレンドになった日の「◯周年」と「100日・1000日」などは、フレンドに日付を入れるだけで自動で数えます。ここには誕生日やSkyを始めた日など、それ以外の日を足せます。', 'Friend anniversaries and 100/1000-day milestones are counted automatically. Add other days here — birthdays, the day you started Sky…')}</p>
    ${list.length ? `<ul class="fr-list">${list.map(d => {
      const f = d.friendId ? friendById(d.friendId) : null;
      return `<li class="fr-row"><span class="fr-avatar is-icon" style="background:${f ? f.color : 'var(--hub-accent)'}"><svg class="inline-icon" width="16" height="16"><use href="#i-gift"/></svg></span>
        <div class="fr-main"><div class="fr-name">${escapeHtml(d.name)}</div><div class="fr-sub">${fmtDate(d.date)}${f ? `・${escapeHtml(f.name)}` : ''}</div></div>
        <div class="fr-row-actions"><button type="button" class="fun-icon-btn" data-act="edit-day" data-id="${d.id}" aria-label="${t('編集', 'Edit')}"><svg class="inline-icon" width="15" height="15"><use href="#i-edit"/></svg></button></div></li>`;
    }).join('')}</ul>` : ''}`;
}
function dayFormHtml(d) {
  const md = d ? d.date.slice(-5) : '';
  const year = d && d.date.length === 10 ? d.date.slice(0, 4) : '';
  return `<form class="fun-form" data-form="day">
    <label class="fun-field"><span class="fun-label">${t('名前', 'Name')}</span><input class="fun-input" name="name" maxlength="40" required value="${escapeHtml(d ? d.name : '')}" placeholder="${t('例: ◯◯さんの誕生日／Skyを始めた日', 'e.g. A’s birthday / Started Sky')}"></label>
    <div class="fun-field-row">
      <label class="fun-field"><span class="fun-label">${t('月日', 'Month & day')}</span><input class="fun-input" name="md" required value="${md ? md.replace('-', '/') : ''}" placeholder="${t('例: 7/6', 'e.g. 7/6')}" inputmode="numeric"></label>
      <label class="fun-field"><span class="fun-label">${t('年（あれば）', 'Year (optional)')}</span><input class="fun-input" name="year" inputmode="numeric" maxlength="4" value="${year}" placeholder="2019"></label>
    </div>
    <label class="fun-field"><span class="fun-label">${t('フレンド（あれば）', 'Friend (optional)')}</span>
      <select class="fun-input" name="friendId"><option value="">${t('なし', 'None')}</option>${doc.friends.map(f => `<option value="${f.id}"${d && d.friendId === f.id ? ' selected' : ''}>${escapeHtml(f.name)}</option>`).join('')}</select></label>
    <p class="fun-hint">${t('年を入れると「◯年目」も出ます。', 'With a year, the count of years is shown too.')}</p>
    <div class="fun-form-actions">
      ${d ? `<button type="button" class="fun-btn danger${confirmId === d.id ? ' is-confirm' : ''}" data-act="del-day" data-id="${d.id}">${confirmId === d.id ? t('もう一度押すと削除', 'Tap again to delete') : t('削除', 'Delete')}</button>` : ''}
      <span class="fun-spacer"></span>
      <button type="button" class="fun-btn" data-act="cancel">${t('やめる', 'Cancel')}</button>
      <button type="submit" class="fun-btn primary">${t('保存', 'Save')}</button>
    </div>
  </form>`;
}

/* ── フォト日記 ── */
let diaryFilter = '';
function diaryHtml() {
  const editing = form && form.kind === 'diary';
  const list = [...doc.diary].filter(d => !diaryFilter || d.friendIds.includes(diaryFilter)).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const today = todayStr();
  const onThisDay = doc.diary.filter(d => d.date.slice(5) === today.slice(5) && d.date < today).sort((a, b) => b.date.localeCompare(a.date));
  return `
    ${editing ? diaryFormHtml(form.id ? doc.diary.find(d => d.id === form.id) : null) : `<button type="button" class="fun-add" data-act="new-diary"><svg class="inline-icon" width="16" height="16"><use href="#i-camera"/></svg>${t('思い出を残す', 'Add a memory')}</button>`}
    ${!editing && onThisDay.length ? `<section class="fr-otd"><h2 class="fun-h2">${t('過去の今日', 'On this day')}</h2>${onThisDay.map(d => entryHtml(d, true)).join('')}</section>` : ''}
    ${doc.friends.length && doc.diary.length ? `<div class="fun-chips fr-filter">
      <button type="button" class="fun-chip${!diaryFilter ? ' on' : ''}" data-act="filter" data-id="">${t('すべて', 'All')}</button>
      ${doc.friends.filter(f => doc.diary.some(d => d.friendIds.includes(f.id))).map(f => `<button type="button" class="fun-chip${diaryFilter === f.id ? ' on' : ''}" data-act="filter" data-id="${f.id}">${avatarHtml(f, 'is-tiny')}${escapeHtml(f.name)}</button>`).join('')}
    </div>` : ''}
    ${list.length ? `<div class="fr-diary">${list.map(d => entryHtml(d, false)).join('')}</div>` : (editing ? '' : emptyHtml(t('写真や一言で、Skyでの思い出を残しましょう。写真はこの端末の中だけに保存されます', 'Save your Sky memories with a photo and a few words. Photos stay on this device.')))}`;
}
function entryHtml(d, compact) {
  const names = d.friendIds.map(friendById).filter(Boolean);
  const years = new Date().getFullYear() - Number(d.date.slice(0, 4));
  return `<article class="fr-entry${compact ? ' is-otd' : ''}">
    ${d.photoId ? `<div class="fr-photo" data-photo="${escapeHtml(d.photoId)}"><span class="fr-photo-ph"><svg class="inline-icon" width="22" height="22"><use href="#i-image"/></svg></span></div>` : ''}
    <div class="fr-entry-body">
      <div class="fr-entry-date">${fmtDate(d.date)}${compact && years > 0 ? `<span>${t(`${years}年前`, `${years} year(s) ago`)}</span>` : ''}</div>
      ${d.text ? `<p class="fr-entry-text">${escapeHtml(d.text).replace(/\n/g, '<br>')}</p>` : ''}
      ${names.length ? `<div class="fr-tags">${names.map(f => `<span class="fr-tag">${avatarHtml(f, 'is-tiny')}${escapeHtml(f.name)}</span>`).join('')}</div>` : ''}
    </div>
    ${compact ? '' : `<button type="button" class="fun-icon-btn fr-entry-edit" data-act="edit-diary" data-id="${d.id}" aria-label="${t('編集', 'Edit')}"><svg class="inline-icon" width="15" height="15"><use href="#i-edit"/></svg></button>`}
  </article>`;
}
function diaryFormHtml(d) {
  const ids = new Set(d ? d.friendIds : (diaryFilter ? [diaryFilter] : []));
  const preview = pendingPhotoUrl || (d && d.photoId && photoUrls.get(d.photoId)) || '';
  return `<form class="fun-form" data-form="diary">
    <div class="fr-photo-pick${preview ? ' has' : ''}">
      ${preview ? `<img src="${preview}" alt="">` : `<span><svg class="inline-icon" width="26" height="26"><use href="#i-camera"/></svg>${t('写真を選ぶ（なくてもOK）', 'Choose a photo (optional)')}</span>`}
      <input type="file" accept="image/*" name="photo" aria-label="${t('写真を選ぶ', 'Choose a photo')}">
    </div>
    ${preview ? `<button type="button" class="fun-btn small" data-act="clear-photo">${t('写真を外す', 'Remove photo')}</button>` : ''}
    <label class="fun-field"><span class="fun-label">${t('日付', 'Date')}</span><input class="fun-input" type="date" name="date" required max="${todayStr()}" value="${d ? d.date : todayStr()}"></label>
    <label class="fun-field"><span class="fun-label">${t('ひとこと', 'A few words')}</span><textarea class="fun-textarea" name="text" rows="3" maxlength="2000" placeholder="${t('今日あったこと、うれしかったこと', 'What happened today?')}">${escapeHtml(d ? d.text : '')}</textarea></label>
    ${doc.friends.length ? `<div class="fun-field"><span class="fun-label">${t('一緒にいたフレンド', 'With')}</span><div class="fun-chips">${doc.friends.map(f => `<label class="fun-chip fun-chip-check"><input type="checkbox" name="friendIds" value="${f.id}"${ids.has(f.id) ? ' checked' : ''}>${avatarHtml(f, 'is-tiny')}${escapeHtml(f.name)}</label>`).join('')}</div></div>` : ''}
    <div class="fun-form-actions">
      ${d ? `<button type="button" class="fun-btn danger${confirmId === d.id ? ' is-confirm' : ''}" data-act="del-diary" data-id="${d.id}">${confirmId === d.id ? t('もう一度押すと削除', 'Tap again to delete') : t('削除', 'Delete')}</button>` : ''}
      <span class="fun-spacer"></span>
      <button type="button" class="fun-btn" data-act="cancel">${t('やめる', 'Cancel')}</button>
      <button type="submit" class="fun-btn primary">${t('保存', 'Save')}</button>
    </div>
  </form>`;
}

function emptyHtml(msg) { return `<div class="fun-empty"><svg class="inline-icon" width="30" height="30"><use href="#i-heart"/></svg><p>${escapeHtml(msg)}</p></div>`; }

async function loadVisiblePhotos() {
  const slots = root() ? root().querySelectorAll('.fr-photo[data-photo], .fr-avatar[data-avatar-photo]') : [];
  for (const slot of slots) {
    const id = slot.dataset.photo || slot.dataset.avatarPhoto;
    let url = photoUrls.get(id);
    if (!url) {
      try {
        const blob = await getPhoto(id);
        if (!blob) continue;
        url = URL.createObjectURL(blob);
        photoUrls.set(id, url);
      } catch (e) { continue; }
    }
    if (!slot.isConnected) continue;
    if (slot.dataset.avatarPhoto && slot.querySelector('img')) continue;
    slot.innerHTML = `<img src="${url}" alt="" loading="lazy">`;
  }
}

/* ── 写真の縮小（長辺1280px・JPEG。IndexedDBの容量を節約する） ── */
async function shrinkImage(file) {
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = bitmapUrl; });
    const scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    return await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  } finally { URL.revokeObjectURL(bitmapUrl); }
}
// アイコン用: 真ん中を正方形に切り抜いて256px四方にする
async function squareImage(file) {
  const srcUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = srcUrl; });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2, sy = (img.naturalHeight - side) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, 256, 256);
    return await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
  } finally { URL.revokeObjectURL(srcUrl); }
}
function clearPendingPhoto() {
  if (pendingPhotoUrl) URL.revokeObjectURL(pendingPhotoUrl);
  pendingPhoto = null; pendingPhotoUrl = null;
}

/* ── 操作 ── */
function setConfirm(id) {
  confirmId = id;
  clearTimeout(confirmTimer);
  if (id) confirmTimer = setTimeout(() => { confirmId = null; if (containerEl) render(); }, 3500);
}
function openForm(kind, id) {
  form = { kind, id: id || null, removePhoto: false };
  setConfirm(null);
  clearPendingPhoto();
  render();
  const first = root().querySelector('.fun-form input:not([type=file]), .fun-form textarea');
  if (first && !id) first.focus();
  root().querySelector('.fun-form')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function onClick(e) {
  const tabBtnEl = e.target.closest('[data-tab]');
  if (tabBtnEl) {
    tab = tabBtnEl.dataset.tab; form = null; clearPendingPhoto();
    try { localStorage.setItem(TAB_KEY, tab); } catch (err) { /* noop */ }
    render();
    return;
  }
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const { act, id } = btn.dataset;
  switch (act) {
    case 'new-friend': openForm('friend'); break;
    case 'edit-friend': openForm('friend', id); break;
    case 'new-day': openForm('day'); break;
    case 'edit-day': openForm('day', id); break;
    case 'new-diary': openForm('diary'); break;
    case 'edit-diary': openForm('diary', id); break;
    case 'cancel': form = null; clearPendingPhoto(); setConfirm(null); render(); break;
    case 'filter': diaryFilter = id || ''; render(); break;
    case 'diary-of': tab = 'diary'; diaryFilter = id; form = null; render(); break;
    case 'clear-photo': {
      const keep = currentFormData();
      clearPendingPhoto(); if (form) form.removePhoto = true; render(); restoreForm(keep);
      break;
    }
    case 'avatar-preset': {
      const input = root().querySelector('.fun-form input[name=avatar]');
      if (input) { input.value = input.value === btn.dataset.ch ? '' : btn.dataset.ch; updateAvatarPreview(); }
      break;
    }
    case 'del-friend': {
      if (confirmId !== id) { setConfirm(id); render(); break; }
      const gone = friendById(id);
      if (gone && gone.avatarPhotoId) deletePhoto(gone.avatarPhotoId).catch(() => {});
      doc.friends = doc.friends.filter(f => f.id !== id);
      doc.days.forEach(d => { if (d.friendId === id) d.friendId = ''; });
      doc.diary.forEach(d => { d.friendIds = d.friendIds.filter(x => x !== id); });
      form = null; setConfirm(null); save(); render();
      break;
    }
    case 'del-day':
      if (confirmId !== id) { setConfirm(id); render(); break; }
      doc.days = doc.days.filter(d => d.id !== id);
      form = null; setConfirm(null); save(); render();
      break;
    case 'del-diary': {
      if (confirmId !== id) { setConfirm(id); render(); break; }
      const entry = doc.diary.find(d => d.id === id);
      doc.diary = doc.diary.filter(d => d.id !== id);
      if (entry && entry.photoId) deletePhoto(entry.photoId).catch(() => {});
      form = null; setConfirm(null); save(); render();
      break;
    }
    default: break;
  }
}

async function onChange(e) {
  const el = e.target;
  if (el.name === 'color') { updateAvatarPreview(); return; }
  if ((el.name === 'photo' || el.name === 'avatarPhoto') && el.files && el.files[0]) {
    try {
      const blob = el.name === 'avatarPhoto' ? await squareImage(el.files[0]) : await shrinkImage(el.files[0]);
      if (!blob) throw new Error('no blob');
      // 入力中の文字を残したまま、写真の見本だけ差し替える
      const formEl = el.closest('form');
      const keep = formEl ? new FormData(formEl) : null;
      clearPendingPhoto();
      pendingPhoto = blob; pendingPhotoUrl = URL.createObjectURL(blob);
      if (form) form.removePhoto = false;
      render();
      restoreForm(keep);
    } catch (err) { toast(t('この写真は読み込めませんでした', 'Could not read this photo')); }
  }
}
function currentFormData() {
  const formEl = root() && root().querySelector('.fun-form');
  return formEl ? new FormData(formEl) : null;
}
// 描き直した後のフォームへ、入力途中の値を戻す（写真を選んだ・外した時）
function restoreForm(fd) {
  const formEl = root() && root().querySelector('.fun-form');
  if (!formEl || !fd) return;
  ['date', 'text', 'name', 'since', 'memo', 'avatar'].forEach(k => { const v = fd.get(k); const input = formEl.elements[k]; if (input && v != null && input.type !== 'file') input.value = v; });
  const color = fd.get('color');
  if (color) formEl.querySelectorAll('input[name=color]').forEach(r => { r.checked = r.value === color; });
  const ids = new Set(fd.getAll('friendIds'));
  formEl.querySelectorAll('input[name=friendIds]').forEach(cb => { cb.checked = ids.has(cb.value); });
  updateAvatarPreview();
}

function onInput(e) {
  const n = e.target.name;
  if (n === 'avatar' || n === 'name') updateAvatarPreview();
}
// フレンドの入力中、アイコンの見本だけを差し替える（入力欄は描き直さない＝フォーカスが外れない）
function updateAvatarPreview() {
  const formEl = root() && root().querySelector('.fun-form[data-form=friend]');
  const pv = formEl && formEl.querySelector('#frAvatarPreview');
  if (!pv) return;
  const color = (formEl.querySelector('input[name=color]:checked') || {}).value;
  if (color) pv.style.background = color;
  const avatarInput = formEl.elements.avatar;
  if (avatarInput) {
    const v = avatarInput.value.trim();
    const shown = v || firstChar(formEl.elements.name.value);
    pv.textContent = shown;
    pv.classList.toggle('is-long', graphemes(shown).length > 1);
    avatarInput.placeholder = firstChar(formEl.elements.name.value) === '?' ? '' : firstChar(formEl.elements.name.value);
    formEl.querySelectorAll('[data-act=avatar-preset]').forEach(b => b.classList.toggle('on', b.dataset.ch === v));
  }
}

async function onSubmit(e) {
  e.preventDefault();
  const formEl = e.target;
  const fd = new FormData(formEl);
  const kind = formEl.dataset.form;
  if (kind === 'friend') {
    const data = { name: String(fd.get('name') || '').trim().slice(0, 40), since: String(fd.get('since') || ''), memo: String(fd.get('memo') || '').slice(0, 400), color: String(fd.get('color') || COLORS[0]) };
    if (!data.name) return;
    // アイコンの文字は2文字（絵文字は1つ＝合成された絵文字も1つ）まで
    if (fd.has('avatar')) data.avatar = graphemes(String(fd.get('avatar') || '').trim()).slice(0, 2).join('').slice(0, 16);
    const target = form.id ? friendById(form.id) : { id: genId(), avatar: '', avatarPhotoId: '' };
    const oldPhoto = target.avatarPhotoId;
    if (pendingPhoto) {
      const pid = 'a_' + genId();
      try {
        await putPhoto(pid, pendingPhoto);
        data.avatarPhotoId = pid;
        if (oldPhoto) deletePhoto(oldPhoto).catch(() => {});
      } catch (err) { toast(t('写真を保存できませんでした', 'Could not save the photo')); }
    } else if (form.removePhoto && oldPhoto) {
      data.avatarPhotoId = '';
      deletePhoto(oldPhoto).catch(() => {});
    }
    Object.assign(target, data);
    if (!form.id) doc.friends.push(target);
    clearPendingPhoto();
  } else if (kind === 'day') {
    const m = /^(\d{1,2})[-/](\d{1,2})$/.exec(String(fd.get('md') || '').trim());
    const year = String(fd.get('year') || '').trim();
    if (!m || +m[1] < 1 || +m[1] > 12 || +m[2] < 1 || +m[2] > 31) { toast(t('月日は「7/6」のように入れてください', 'Enter the date like 7/6')); return; }
    const md = `${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    const date = /^\d{4}$/.test(year) ? `${year}-${md}` : md;
    const data = { name: String(fd.get('name') || '').trim().slice(0, 40), date, friendId: String(fd.get('friendId') || '') };
    if (!data.name) return;
    if (form.id) Object.assign(doc.days.find(d => d.id === form.id), data);
    else doc.days.push({ id: genId(), ...data });
  } else if (kind === 'diary') {
    const entry = form.id ? doc.diary.find(d => d.id === form.id) : { id: genId(), photoId: '' };
    entry.date = String(fd.get('date') || todayStr());
    entry.text = String(fd.get('text') || '').slice(0, 2000);
    entry.friendIds = fd.getAll('friendIds').map(String).filter(id => friendById(id));
    const oldPhoto = entry.photoId;
    if (pendingPhoto) {
      const pid = 'p_' + genId();
      try {
        await putPhoto(pid, pendingPhoto);
        entry.photoId = pid;
        if (oldPhoto) deletePhoto(oldPhoto).catch(() => {});
      } catch (err) { toast(t('写真を保存できませんでした', 'Could not save the photo')); }
    } else if (form.removePhoto && oldPhoto) {
      entry.photoId = '';
      deletePhoto(oldPhoto).catch(() => {});
    }
    if (!entry.text && !entry.photoId) { toast(t('写真かひとことを入れてください', 'Add a photo or some words')); return; }
    if (!form.id) doc.diary.push(entry);
    clearPendingPhoto();
  }
  form = null; setConfirm(null);
  save();
  render();
  toast(t('保存しました', 'Saved'));
}

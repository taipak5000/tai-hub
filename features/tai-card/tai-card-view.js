/* ================================================================
   tai-card-view.js — 星紡ぎカードのtai-hub移植版。公開面は
   mount(container, sub)/unmount() の2関数のみ（js/router.js からマウント
   される。tai-cardはサブルートを持たないツールなのでsubは無視する）。

   移植元: tai-card/index.html（~4225行のスタンドアロンページ）のうち、
   共有chrome（site-dock/プロフィール切替/関連ツール/表示設定モーダル・
   nsKey/nsKeyFor等）を除いた「このツール自身」の部分：編集パネル
   （背景テーマ・プロフィール/背景画像・基本情報・旅の記録・SNS・よく
   遊ぶ時間帯の時計ダイヤル・カスタム欄・詳細プロフィール・フレンド
   コード・まとめて連携・ケープレベル・収集状況・称号・入手グラフ）と、
   プレビューカードのレンダリング・画像保存(html2canvas)/Xへ投稿。

   永続化・静的データ・クロスツール同期ロジックは tai-card-state.js に、
   TITLE_CATALOG（他ツールの称号定義ミラー）は data/title-catalog.js に、
   文言は data/i18n-tai-card.js に分けている。

   【意図的な簡略化・アダプテーション（元の挙動を変えない範囲の adaptation）】
   - プロフィール切替・関連ツール・表示設定の3モーダル、下部クイック
     メニュー(.site-dock)は移植していない——tai-hub共有chromeが既に同等
     の機能を提供する（プロフィール切替は js/chrome/pf-modal.js が
     duplicateProfile含め完全に上位互換）。
   - 元実装は自前のJA/EN切替（LANG変数＋再描画）を持っていたが、
     tai-hubのjs/i18n.js setLang()はページをリロードする設計（他の
     移植済みツールと同じ非リアクティブ方式）のため、ここでは
     CURRENT_LANG を固定値として読み、最初から正しい言語でDOMを
     組み立てる（LANG変更時の再描画関数群は不要になったため移植せず）。
   - ドラッグ/フリックの物理演算つきボトムシート・フォーカストラップは
     移植していない——tai-hubの新規モーダルは他の全ツール（emote/share/
     nomacan等）と同じくタップでの開閉のみ（chrome.cssの
     .modal-overlay.open + @keyframes sheetSlideUp）。
   - OSのダーク/ライト切り替えへのライブ追従（matchMedia('change')）は
     移植していない——tai-hub内の他のどのツールもこれを持たない
     （テーマは共有chromeのトグル操作でのみ変わる設計に統一されている）。
   ================================================================ */
import { nsKey, getActiveProfileId } from '../../js/state.js';
import { CURRENT_LANG, escapeHtml } from '../../js/i18n.js';
import { toolShareUrl } from '../../js/site-config.js';
import { t } from './data/i18n-tai-card.js';
import * as S from './tai-card-state.js';

const STYLE_LINK_ID = 'tai-card-view-styles';
const EN = CURRENT_LANG === 'en';

let containerEl = null;
let els = {};
let state = null;
let mountToken = 0;

// ECO_STATS/TREND_GRAPHSはtai-card-state.jsのfactory関数から毎回新しい配列を
// もらう（元実装は固定constだったが、mount()を跨いで使い回すと再マウント時に
// 古い値が残るため、mountのたびに新規生成してstate側の保存値をミラーし直す）
let ecoStats = [];
let trendGraphs = [];

let syncedTitlesCache = [];
let toastTimer = null;

// クロップドラッグの状態（アバター・背景画像で共通のロジックを使う）
let avatarDrag = null;
let bgDrag = null;
const bgNaturalSizeCache = {};

/* ================================================================
   公開API
   ================================================================ */
export function mount(container, _sub) {
  const myToken = ++mountToken;
  injectStylesheet();

  containerEl = container;
  els = {};
  syncedTitlesCache = [];
  ecoStats = S.ecoStatsDefaults();
  trendGraphs = S.trendGraphsDefaults();

  const saved = S.loadState();
  state = S.defaultState();
  if (saved) Object.assign(state, saved);
  if (saved && saved.vis && !('customNote' in saved.vis)) state.vis.customNote = true;
  if (state.ecoStats) {
    ecoStats.forEach(f => {
      const s = state.ecoStats[f.id];
      if (!s) return;
      if (typeof s.value === 'string') f.value = s.value;
      if (typeof s.visible === 'boolean') f.visible = s.visible;
    });
  }
  if (state.trendGraphs) {
    trendGraphs.forEach(g => {
      const s = state.trendGraphs[g.id];
      if (typeof s === 'boolean') g.visible = s;
    });
  }

  container.innerHTML = renderShell();
  cacheEls();
  wireEditor();

  if (state.autoSync) {
    runEcoStatsSync();
    runTitleSyncSilent();
    runWingSyncSilent();
  } else {
    syncedTitlesCache = S.syncEarnedTitles();
  }
  drawTitlePicker();
  renderCard();

  if (myToken !== mountToken) return;

  const cardEl = els.card;
  cardEl.classList.add('entrance');
  let entranceCleared = false;
  const clearEntrance = () => {
    if (entranceCleared) return;
    entranceCleared = true;
    cardEl.classList.remove('entrance');
  };
  cardEl.addEventListener('animationend', function onEnd(e) {
    if (e.animationName === 'tcCardEntrance') { clearEntrance(); cardEl.removeEventListener('animationend', onEnd); }
  });
  setTimeout(clearEntrance, 800);
}

export function unmount() {
  mountToken++;
  S.cancelScheduledSave();
  clearTimeout(toastTimer);
  document.getElementById('tcImagePreviewOverlay')?.remove();
  containerEl = null;
  els = {};
  state = null;
  avatarDrag = null;
  bgDrag = null;
}

function injectStylesheet() {
  if (document.getElementById(STYLE_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_LINK_ID;
  link.rel = 'stylesheet';
  link.href = new URL('../../css/tai-card.css', import.meta.url).href;
  document.head.appendChild(link);
}

/* ================================================================
   マークアップ（外枠）
   ================================================================ */
function renderShell() {
  return `
    <div class="tai-card-view">
      <div class="tc-page-head">
        <h1>${t('pageHeading')}</h1>
        <p class="tc-lede">${t('ledeHtml')}</p>
      </div>

      <div class="tc-board">
        <section class="tc-panel tc-editor-panel">
          <div class="tc-panel-head"><h2>${t('editorHeading')}</h2></div>
          <div class="tc-panel-body">

            <div class="tc-sec">
              <div class="tc-sec-head"><div class="tc-sec-title">${t('secThemeTitle')}</div></div>
              <div class="tc-theme-row" id="tcThemeRow"></div>
            </div>

            <div class="tc-sec">
              <div class="tc-sec-head"><div class="tc-sec-title">${t('secAvatarTitle')}</div></div>
              <label class="tc-upload-btn"><span>${t('uploadImageBtn')}</span><input type="file" accept="image/*" id="tcAvatarFileInput"></label>
              <div class="tc-crop-tool" id="tcCropTool" style="display:none;">
                <div class="tc-crop-box" id="tcCropBox"><img id="tcCropImg" src="" alt=""></div>
                <div class="tc-crop-controls">
                  <label>${t('zoomLabel')}</label>
                  <input type="range" id="tcZoomSlider" min="100" max="300" value="100">
                  <div class="tc-crop-hint">${t('cropHintAvatar')}</div>
                  <button type="button" class="tc-remove-img-btn" id="tcRemoveImgBtn">${t('removeImageBtn')}</button>
                </div>
              </div>
            </div>

            <div class="tc-sec">
              <div class="tc-sec-head"><div class="tc-sec-title">${t('secBgImageTitle')}</div></div>
              <label class="tc-upload-btn"><span>${t('uploadImageBtn')}</span><input type="file" accept="image/*" id="tcBgFileInput"></label>
              <div class="tc-crop-tool" id="tcBgCropTool" style="display:none;">
                <div class="tc-crop-box tc-crop-box-wide" id="tcBgCropBox"><img id="tcBgCropImg" src="" alt=""></div>
                <div class="tc-crop-controls">
                  <label>${t('zoomLabel')}</label>
                  <input type="range" id="tcBgZoomSlider" min="100" max="300" value="100">
                  <label>${t('opacityLabel')}</label>
                  <input type="range" id="tcBgOpacitySlider" min="0" max="100" value="35">
                  <div class="tc-crop-hint">${t('cropHintBg')}</div>
                  <button type="button" class="tc-remove-img-btn" id="tcRemoveBgImgBtn">${t('removeImageBtn')}</button>
                </div>
              </div>
            </div>

            <div class="tc-sec">
              <div class="tc-sec-head"><div class="tc-sec-title">${t('secBasicInfoTitle')}</div></div>
              <div class="tc-f"><label>${t('nameLabel')}</label><input type="text" id="tcInName" placeholder="${escapeHtml(t('namePlaceholder'))}"></div>
              <div class="tc-f"><label>${t('oneLinerLabel')}</label><input type="text" id="tcInOneLiner" placeholder="${escapeHtml(t('oneLinerPlaceholder'))}"></div>
            </div>

            <div class="tc-sec">
              <div class="tc-sec-head"><div class="tc-sec-title">${t('secJourneyTitle')}</div></div>
              <div class="tc-f"><label>${t('journeyYearLabel')}</label><input type="text" id="tcInJourneyYear" placeholder="${escapeHtml(t('journeyYearPlaceholder'))}"></div>
              <div id="tcFavRows"></div>
              <button type="button" class="tc-fav-add-btn" id="tcFavAddBtn">${t('favAddBtn')}</button>
            </div>

            <div class="tc-sec">
              <div class="tc-sec-head">
                <div class="tc-sec-title"><span>${t('secSnsTitle')}</span> <span class="tc-n">${t('snsHint')}</span></div>
                <label class="tc-switch"><input type="checkbox" id="tcVisSns"><span class="tc-track"></span><span class="tc-knob"></span></label>
              </div>
              <div id="tcSnsRows"></div>
              <button type="button" class="tc-fav-add-btn" id="tcSnsAddBtn">${t('snsAddBtn')}</button>
            </div>

            <div class="tc-sec">
              <div class="tc-sec-head">
                <div class="tc-sec-title">${t('secPlayTimeTitle')}</div>
                <label class="tc-switch"><input type="checkbox" id="tcVisPlayTime"><span class="tc-track"></span><span class="tc-knob"></span></label>
              </div>
              <div class="tc-clock-dial-wrap">
                <div class="tc-clock-dial" id="tcClockDial">
                  <span class="tc-clock-tick t0">🌙</span><span class="tc-clock-tick t6">🌅</span><span class="tc-clock-tick t12">☀️</span><span class="tc-clock-tick t18">🌆</span>
                  <div id="tcClockHourTicks" class="tc-clock-hour-ticks"></div>
                  <div id="tcClockArcCaps" class="tc-clock-arc-caps"></div>
                  <div class="tc-clock-dial-hole"><div class="tc-clock-center" id="tcClockCenter">${t('notSetLabel')}</div></div>
                </div>
                <p class="tc-clock-drag-hint">${t('clockDragHint')}</p>
                <div class="tc-clock-num-inputs" id="tcPlayTimeRangeRows"></div>
                <button type="button" class="tc-fav-add-btn" id="tcPlayTimeAddBtn">${t('playTimeAddBtn')}</button>
                <button type="button" class="tc-chip-opt" id="tcIrregularBtn">${t('irregularBtnLabel')}</button>
              </div>
            </div>

            <div class="tc-sec">
              <div class="tc-sec-head">
                <div class="tc-sec-title"><span>${t('secCustomNoteTitle')}</span> <span class="tc-n">${t('customNoteHint')}</span></div>
                <label class="tc-switch"><input type="checkbox" id="tcVisCustomNote"><span class="tc-track"></span><span class="tc-knob"></span></label>
              </div>
              <div class="tc-f"><label>${t('customNoteTitleLabel')}</label><input type="text" id="tcInCustomNoteTitle" maxlength="14" placeholder="${escapeHtml(t('customNoteTitlePlaceholder'))}"></div>
              <div class="tc-f"><textarea id="tcInCustomNoteText" rows="3" maxlength="200" placeholder="${escapeHtml(t('customNoteTextPlaceholder'))}"></textarea></div>
              <label class="tc-upload-btn"><span>${t('addImageBtn')}</span><input type="file" accept="image/*" id="tcCustomNoteFileInput"></label>
              <div class="tc-custom-note-preview" id="tcCustomNotePreview" style="display:none;">
                <img id="tcCustomNoteImgPreview" src="" alt="">
                <button type="button" class="tc-remove-img-btn" id="tcRemoveCustomNoteImgBtn">${t('removeImageBtn')}</button>
              </div>
            </div>

            <div class="tc-sec">
              <div class="tc-sec-head">
                <div class="tc-sec-title"><span>${t('secDetailsTitle')}</span> <span class="tc-n">${t('detailsHint')}</span></div>
                <label class="tc-switch"><input type="checkbox" id="tcVisDetails"><span class="tc-track"></span><span class="tc-knob"></span></label>
              </div>
              <div id="tcDetailGroups"></div>
            </div>

            <div class="tc-sec">
              <div class="tc-sec-head">
                <div class="tc-sec-title"><span>${t('secFriendCodeTitle')}</span> <span class="tc-n">${t('friendCodeHint')}</span></div>
                <label class="tc-switch"><input type="checkbox" id="tcVisFriendCode"><span class="tc-track"></span><span class="tc-knob"></span></label>
              </div>
              <div class="tc-f"><input type="text" id="tcInFriendCode" placeholder="${escapeHtml(t('optionalPlaceholder'))}"></div>
              <div class="tc-chips" id="tcFriendContactChips"></div>
            </div>

            <div class="tc-sec">
              <div class="tc-sec-head"><div class="tc-sec-title"><span>${t('secAllSyncTitle')}</span> <span class="tc-n">${t('allSyncHint')}</span></div></div>
              <div class="tc-eco-sync-row"><button type="button" class="tc-eco-sync-btn" id="tcAllSyncBtn">${t('allSyncBtn')}</button></div>
              <div class="tc-eco-field-head" style="margin-top:10px;">
                <label for="tcAutoSyncToggle">${t('autoSyncLabel')}</label>
                <label class="tc-switch tc-eco-vis-switch"><input type="checkbox" id="tcAutoSyncToggle"><span class="tc-track"></span><span class="tc-knob"></span></label>
              </div>
              <div class="tc-hint-box">${t('allSyncHintHtml')}</div>
            </div>

            <div class="tc-sec">
              <div class="tc-sec-head">
                <div class="tc-sec-title"><span>${t('secCapeTitle')}</span> <span class="tc-n">${t('capeArrowHint')}</span></div>
                <label class="tc-switch"><input type="checkbox" id="tcVisCape"><span class="tc-track"></span><span class="tc-knob"></span></label>
              </div>
              <div class="tc-eco-sync-row"><button type="button" class="tc-eco-sync-btn" id="tcWingSyncBtn">${t('wingSyncBtn')}</button></div>
              <div class="tc-f"><label>${t('wingTotalLabel')}</label><input type="text" inputmode="numeric" id="tcInWingTotal" placeholder="${escapeHtml(t('wingTotalPlaceholder'))}"></div>
              <div class="tc-hint-box">${t('wingSyncHintHtml')}</div>
            </div>

            <div class="tc-sec">
              <div class="tc-sec-head">
                <div class="tc-sec-title"><span>${t('secEcoStatsTitle')}</span> <span class="tc-n">${t('ecoStatsHint')}</span></div>
                <label class="tc-switch"><input type="checkbox" id="tcVisEcoStats"><span class="tc-track"></span><span class="tc-knob"></span></label>
              </div>
              <div class="tc-eco-sync-row"><button type="button" class="tc-eco-sync-btn" id="tcEcoSyncBtn">${t('ecoSyncBtn')}</button></div>
              <div id="tcEcoStatFields"></div>
              <div class="tc-hint-box">${t('ecoSyncHintHtml')}</div>
            </div>

            <div class="tc-sec">
              <div class="tc-sec-head">
                <div class="tc-sec-title"><span>${t('secTitlesTitle')}</span> <span class="tc-n">${t('titlesHint')}</span></div>
                <label class="tc-switch"><input type="checkbox" id="tcVisTitles"><span class="tc-track"></span><span class="tc-knob"></span></label>
              </div>
              <div class="tc-eco-sync-row"><button type="button" class="tc-eco-sync-btn" id="tcTitleSyncBtn">${t('titleSyncBtn')}</button></div>
              <div id="tcTitlePickerArea"></div>
              <div class="tc-hint-box">${t('titleSyncHintHtml')}</div>
            </div>

            <div class="tc-sec">
              <div class="tc-sec-head"><div class="tc-sec-title"><span>${t('secTrendTitle')}</span> <span class="tc-n">${t('trendHint')}</span></div></div>
              <div id="tcTrendGraphFields"></div>
              <div class="tc-hint-box">${t('trendHintBoxHtml')}</div>
            </div>

          </div>
        </section>

        <div class="tc-preview-col">
          <section class="tc-panel">
            <div class="tc-panel-head">
              <h2>${t('previewHeading')}</h2>
              <div class="tc-panel-head-actions">
                <button type="button" class="tc-share-btn" id="tcShareImageBtn">${t('shareImageBtn')}</button>
              </div>
            </div>
            <div class="tc-card-frame">
              <div class="tc-card" id="tcCard">
                <div class="tc-card-bg-wrap" id="tcCardBgWrap" style="display:none;"></div>
                <div class="tc-card-emblem">✦</div>
                <div class="tc-card-head">
                  <div class="tc-card-kicker">PROFILE</div>
                  <div class="tc-card-top">
                    <div class="tc-card-avatar" id="tcCardAvatar"></div>
                    <div>
                      <div class="tc-card-name-row">
                        <div class="tc-card-name" id="tcCardName">–</div>
                        <span class="tc-card-sns-inline" id="tcCardSnsInline"></span>
                      </div>
                      <div class="tc-card-oneliner" id="tcCardOneLiner"></div>
                    </div>
                  </div>
                </div>
                <div class="tc-card-grid">
                  <div class="tc-card-col-1">
                    <div id="tcCardJourney"></div>
                    <div id="tcCardPlayTimeWrap"></div>
                    <div id="tcCardCustomNoteWrap"></div>
                  </div>
                  <div class="tc-card-col-2">
                    <div id="tcCardDetailsWrap"></div>
                    <div id="tcCardFcWrap"></div>
                  </div>
                  <div class="tc-card-col-3">
                    <div id="tcCardTitlesWrap"></div>
                    <div id="tcCardCapeWrap"></div>
                    <div id="tcCardEcoWrap"></div>
                    <div id="tcCardTrendWrap"></div>
                  </div>
                </div>
                <div class="tc-card-foot">
                  <span>${t('cardWatermark')}</span>
                  <span class="tc-tag" id="tcCardDate"></span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <footer>
        <p>${escapeHtml(t('footerDisclaimer'))}</p>
        <p style="margin-top:10px;"><span>${escapeHtml(t('footerCreditLabel'))}</span><a href="https://x.com/Skyzztai" target="_blank" rel="noopener noreferrer" style="font-weight:bold;">@Skyzztai</a>　／　<a href="https://odaibako.net/u/Skyzztai" target="_blank" rel="noopener noreferrer" style="font-weight:bold;">${escapeHtml(t('footerRequestForm'))}</a></p>
        <p style="margin-top:10px;"><a href="#/tai-info">${escapeHtml(t('footerInfoLink'))}</a></p>
      </footer>
    </div>
    <div class="tc-toast" id="tcToast"></div>`;
}

function q(sel) { return containerEl.querySelector(sel); }
function cacheEls() {
  els.card = q('#tcCard');
}

/* ================================================================
   編集パネルの配線一式
   ================================================================ */
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }

function wireEditor() {
  wireThemeRow();
  wireAvatarCrop();
  wireBgCrop();
  wireCustomNote();
  bindText('#tcInName', 'name');
  bindText('#tcInOneLiner', 'oneLiner');
  bindText('#tcInJourneyYear', 'journeyYear');
  bindText('#tcInWingTotal', 'wingTotal');
  bindText('#tcInFriendCode', 'friendCode');
  wireFriendContactChips();
  wireVisibilityToggles();
  wireFavRows();
  wireSnsRows();
  wireClockDial();
  wireDetailGroups();
  wireEcoStats();
  wireTitles();
  wireTrendGraphs();
  wireAllSync();
  wireShareImage();
}

function bindText(sel, stateKey) {
  const inp = q(sel);
  inp.value = state[stateKey] || '';
  inp.addEventListener('input', e => { state[stateKey] = e.target.value; renderCard(); });
}

/* ── テーマ ── */
function wireThemeRow() {
  const row = q('#tcThemeRow');
  S.THEMES.forEach(th => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tc-theme-swatch' + (th.id === state.theme ? ' active' : '');
    b.style.background = th.grad;
    b.setAttribute('aria-label', (EN ? th.nameEn : th.name) + (EN ? ' theme' : 'テーマ'));
    b.addEventListener('click', () => {
      state.theme = th.id;
      row.querySelectorAll('.tc-theme-swatch').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      renderCard();
    });
    row.appendChild(b);
  });
}

/* ── アバター画像アップロード + クロップ ── */
function wireAvatarCrop() {
  const cropTool = q('#tcCropTool'), cropBox = q('#tcCropBox'), cropImg = q('#tcCropImg'), zoomSlider = q('#tcZoomSlider');

  function applyCropTransform() {
    const { zoom, offsetX, offsetY } = state.avatarImage;
    cropImg.style.transform = `scale(${zoom}) translate(${offsetX}%, ${offsetY}%)`;
  }

  q('#tcAvatarFileInput').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      state.avatarImage = { src: ev.target.result, zoom: 1, offsetX: 0, offsetY: 0 };
      cropImg.src = state.avatarImage.src;
      zoomSlider.value = 100;
      applyCropTransform();
      cropTool.style.display = 'flex';
      renderCard();
    };
    reader.readAsDataURL(file);
  });

  zoomSlider.addEventListener('input', e => {
    state.avatarImage.zoom = Number(e.target.value) / 100;
    applyCropTransform();
    renderCard();
  });

  cropBox.addEventListener('pointerdown', e => {
    avatarDrag = { start: { x: e.clientX, y: e.clientY }, origin: { x: state.avatarImage.offsetX, y: state.avatarImage.offsetY } };
    cropBox.setPointerCapture(e.pointerId);
  });
  cropBox.addEventListener('pointermove', e => {
    if (!avatarDrag) return;
    const rect = cropBox.getBoundingClientRect();
    const dxPct = ((e.clientX - avatarDrag.start.x) / rect.width) * 100;
    const dyPct = ((e.clientY - avatarDrag.start.y) / rect.height) * 100;
    state.avatarImage.offsetX = Math.max(-45, Math.min(45, avatarDrag.origin.x + dxPct));
    state.avatarImage.offsetY = Math.max(-45, Math.min(45, avatarDrag.origin.y + dyPct));
    applyCropTransform();
  });
  const endDrag = () => { if (avatarDrag) { avatarDrag = null; renderCard(); } };
  cropBox.addEventListener('pointerup', endDrag);
  cropBox.addEventListener('pointercancel', endDrag);

  q('#tcRemoveImgBtn').addEventListener('click', () => {
    state.avatarImage = { src: null, zoom: 1, offsetX: 0, offsetY: 0 };
    cropTool.style.display = 'none';
    renderCard();
  });

  if (state.avatarImage.src) {
    cropImg.src = state.avatarImage.src;
    zoomSlider.value = Math.round(state.avatarImage.zoom * 100);
    applyCropTransform();
    cropTool.style.display = 'flex';
  }
}

/* ── カード背景画像アップロード + クロップ + 不透明度 ── */
function wireBgCrop() {
  const bgCropTool = q('#tcBgCropTool'), bgCropBox = q('#tcBgCropBox'), bgCropImg = q('#tcBgCropImg');
  const bgZoomSlider = q('#tcBgZoomSlider'), bgOpacitySlider = q('#tcBgOpacitySlider');

  function applyBgCropTransform() {
    const { zoom, offsetX, offsetY } = state.cardBgImage;
    bgCropImg.style.transform = `scale(${zoom}) translate(${offsetX}%, ${offsetY}%)`;
  }

  q('#tcBgFileInput').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      resizeImageDataUrl(ev.target.result, 1280, 0.75).then(resized => {
        state.cardBgImage = { src: resized, zoom: 1, offsetX: 0, offsetY: 0, opacity: state.cardBgImage.opacity || 35 };
        bgCropImg.src = resized;
        bgZoomSlider.value = 100;
        bgOpacitySlider.value = state.cardBgImage.opacity;
        applyBgCropTransform();
        bgCropTool.style.display = 'flex';
        renderCard();
      });
    };
    reader.readAsDataURL(file);
  });

  bgZoomSlider.addEventListener('input', e => {
    state.cardBgImage.zoom = Number(e.target.value) / 100;
    applyBgCropTransform();
    renderCard();
  });
  bgOpacitySlider.addEventListener('input', e => {
    state.cardBgImage.opacity = Number(e.target.value);
    renderCard();
  });

  bgCropBox.addEventListener('pointerdown', e => {
    bgDrag = { start: { x: e.clientX, y: e.clientY }, origin: { x: state.cardBgImage.offsetX, y: state.cardBgImage.offsetY } };
    bgCropBox.setPointerCapture(e.pointerId);
  });
  bgCropBox.addEventListener('pointermove', e => {
    if (!bgDrag) return;
    const rect = bgCropBox.getBoundingClientRect();
    const dxPct = ((e.clientX - bgDrag.start.x) / rect.width) * 100;
    const dyPct = ((e.clientY - bgDrag.start.y) / rect.height) * 100;
    state.cardBgImage.offsetX = Math.max(-45, Math.min(45, bgDrag.origin.x + dxPct));
    state.cardBgImage.offsetY = Math.max(-45, Math.min(45, bgDrag.origin.y + dyPct));
    applyBgCropTransform();
    renderCard();
  });
  const endBgDrag = () => { if (bgDrag) { bgDrag = null; renderCard(); } };
  bgCropBox.addEventListener('pointerup', endBgDrag);
  bgCropBox.addEventListener('pointercancel', endBgDrag);

  q('#tcRemoveBgImgBtn').addEventListener('click', () => {
    state.cardBgImage = { src: null, zoom: 1, offsetX: 0, offsetY: 0, opacity: 35 };
    bgCropTool.style.display = 'none';
    renderCard();
  });

  if (state.cardBgImage.src) {
    bgCropImg.src = state.cardBgImage.src;
    bgZoomSlider.value = Math.round(state.cardBgImage.zoom * 100);
    bgOpacitySlider.value = state.cardBgImage.opacity;
    applyBgCropTransform();
    bgCropTool.style.display = 'flex';
  }
}

function resizeImageDataUrl(dataUrl, maxDim, quality) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
        else { width = Math.round(width * maxDim / height); height = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/* ── カスタム欄 ── */
function wireCustomNote() {
  const titleEl = q('#tcInCustomNoteTitle'), textEl = q('#tcInCustomNoteText');
  const previewEl = q('#tcCustomNotePreview'), imgPreviewEl = q('#tcCustomNoteImgPreview');

  titleEl.value = state.customNote.title || '';
  titleEl.addEventListener('input', e => { state.customNote.title = e.target.value; renderCard(); });
  textEl.value = state.customNote.text || '';
  textEl.addEventListener('input', e => { state.customNote.text = e.target.value; renderCard(); });

  function showPreview(src) { imgPreviewEl.src = src; previewEl.style.display = 'flex'; }
  if (state.customNote.image && state.customNote.image.src) showPreview(state.customNote.image.src);

  q('#tcCustomNoteFileInput').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      resizeImageDataUrl(ev.target.result, 800, 0.85).then(resized => {
        state.customNote.image = { src: resized };
        showPreview(resized);
        renderCard();
      });
    };
    reader.readAsDataURL(file);
  });
  q('#tcRemoveCustomNoteImgBtn').addEventListener('click', () => {
    state.customNote.image = null;
    previewEl.style.display = 'none';
    renderCard();
  });
}

/* ── フレンドコードの連絡方法 ── */
function translateFriendContactOption(ja) { return EN ? (S.FRIEND_CONTACT_OPTION_EN[ja] || ja) : ja; }
function wireFriendContactChips() {
  drawFriendContactChips();
}
function drawFriendContactChips() {
  const c = q('#tcFriendContactChips');
  c.innerHTML = '';
  S.FRIEND_CONTACT_OPTIONS.forEach(opt => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tc-chip-opt' + (state.friendCodeContact === opt ? ' selected' : '');
    b.textContent = translateFriendContactOption(opt);
    b.addEventListener('click', () => {
      state.friendCodeContact = (state.friendCodeContact === opt) ? null : opt;
      drawFriendContactChips();
      renderCard();
    });
    c.appendChild(b);
  });
}

/* ── 表示・非表示スイッチ ── */
function wireVisibilityToggles() {
  [['tcVisSns', 'sns'], ['tcVisPlayTime', 'playTime'], ['tcVisDetails', 'details'], ['tcVisFriendCode', 'friendCode'],
    ['tcVisEcoStats', 'ecoStats'], ['tcVisCape', 'cape'], ['tcVisTitles', 'titles'], ['tcVisCustomNote', 'customNote']].forEach(([elId, key]) => {
    const cb = q('#' + elId);
    cb.checked = state.vis[key];
    cb.addEventListener('change', e => { state.vis[key] = e.target.checked; renderCard(); });
  });
}

/* ── 好きな〇〇 ── */
function wireFavRows() {
  drawFavRows();
  q('#tcFavAddBtn').addEventListener('click', () => {
    state.favorites.push({ label: '', value: '' });
    drawFavRows();
    renderCard();
  });
}
function drawFavRows() {
  const favRowsEl = q('#tcFavRows');
  favRowsEl.innerHTML = '';
  state.favorites.forEach((f, idx) => {
    const row = el('div', 'tc-fav-row');
    row.innerHTML = `
      <span class="tc-fav-label-wrap">${t('favLabelPrefix')}</span>
      <input type="text" class="tc-fav-label" placeholder="${escapeHtml(t('favLabelPlaceholder'))}" value="${(f.label || '').replace(/"/g, '&quot;')}">
      <span class="tc-fav-label-wrap">:</span>
      <input type="text" class="tc-fav-value" placeholder="${escapeHtml(t('favValuePlaceholder'))}" value="${(f.value || '').replace(/"/g, '&quot;')}">
      <button type="button" class="tc-fav-remove" aria-label="${escapeHtml(t('removeItemAriaLabel'))}"><svg class="inline-icon" width="12" height="12"><use href="#i-close"/></svg></button>`;
    row.querySelector('.tc-fav-label').addEventListener('input', e => { f.label = e.target.value; renderCard(); });
    row.querySelector('.tc-fav-value').addEventListener('input', e => { f.value = e.target.value; renderCard(); });
    row.querySelector('.tc-fav-remove').addEventListener('click', () => { state.favorites.splice(idx, 1); drawFavRows(); renderCard(); });
    favRowsEl.appendChild(row);
  });
}

/* ── SNS ── */
const SNS_PLATFORMS = ['X', 'Discord', 'YouTube', 'TikTok', 'Instagram'];
function wireSnsRows() {
  drawSnsRows();
  q('#tcSnsAddBtn').addEventListener('click', () => {
    state.snsList.push({ platform: 'X', id: '' });
    drawSnsRows();
    renderCard();
  });
}
function drawSnsRows() {
  const snsRowsEl = q('#tcSnsRows');
  snsRowsEl.innerHTML = '';
  state.snsList.forEach((s, idx) => {
    const row = el('div', 'tc-fav-row tc-sns-row');
    const options = SNS_PLATFORMS.map(p => `<option value="${p}" ${s.platform === p ? 'selected' : ''}>${p}</option>`).join('');
    row.innerHTML = `
      <select class="tc-sns-platform">${options}</select>
      <input type="text" class="tc-fav-value" placeholder="${escapeHtml(t('snsIdPlaceholder'))}" value="${(s.id || '').replace(/"/g, '&quot;')}">
      <button type="button" class="tc-fav-remove" aria-label="${escapeHtml(t('removeSnsAriaLabel'))}"><svg class="inline-icon" width="12" height="12"><use href="#i-close"/></svg></button>`;
    row.querySelector('.tc-sns-platform').addEventListener('change', e => { s.platform = e.target.value; renderCard(); });
    row.querySelector('.tc-fav-value').addEventListener('input', e => { s.id = e.target.value; renderCard(); });
    row.querySelector('.tc-fav-remove').addEventListener('click', () => { state.snsList.splice(idx, 1); drawSnsRows(); renderCard(); });
    snsRowsEl.appendChild(row);
  });
}

/* ================================================================
   よく遊ぶ時間帯：時計ダイヤル
   ================================================================ */
function wireClockDial() {
  const clockDial = q('#tcClockDial'), clockCenter = q('#tcClockCenter'), clockArcCapsEl = q('#tcClockArcCaps');
  const irregularBtn = q('#tcIrregularBtn'), playTimeRowsEl = q('#tcPlayTimeRangeRows');

  (function drawHourTicks() {
    const ticksEl = q('#tcClockHourTicks');
    for (let h = 0; h < 24; h++) {
      const deg = S.hourToDeg(h);
      const isMajor = h % 6 === 0;
      const p = S.polarPoint(deg, 80, 94, 94);
      const tick = document.createElement('span');
      tick.className = 'tc-clock-hour-tick' + (isMajor ? ' major' : '');
      tick.style.left = p.x + 'px'; tick.style.top = p.y + 'px';
      tick.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
      ticksEl.appendChild(tick);
    }
  })();

  function angleFromPointer(clientX, clientY) {
    const rect = clockDial.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    let deg = Math.atan2(clientY - cy, clientX - cx) * 180 / Math.PI + 90;
    if (deg < 0) deg += 360;
    return deg;
  }

  function updateDialVisual() {
    if (state.playTimeIrregular) {
      clockDial.style.background = 'var(--tc-surface-2)';
      clockCenter.innerHTML = `<span class="tc-cc-icon">🌀</span>${t('irregularBtnLabel')}`;
    } else {
      const filled = state.playTimeRanges.filter(r => r.start != null && r.end != null);
      clockDial.style.background = S.buildDialBackground(filled);
      const label = !filled.length ? t('notSetLabel')
        : filled.length === 1 ? t('playTimeSingleRangeTemplate', { start: filled[0].start, end: filled[0].end })
        : t('playTimeMultiRangeTemplate', { n: filled.length });
      clockCenter.innerHTML = `<span class="tc-cc-icon">🕐</span>${label}`;
    }
    irregularBtn.classList.toggle('selected', state.playTimeIrregular);
  }

  function drawArcHandles() {
    clockArcCapsEl.innerHTML = '';
    if (state.playTimeIrregular) return;
    state.playTimeRanges.forEach((r, idx) => {
      ['start', 'end'].forEach(field => {
        const isSet = r[field] != null;
        const defaultHour = field === 'start' ? 9 : 17;
        const handle = document.createElement('span');
        handle.className = 'tc-clock-arc-handle' + (isSet ? '' : ' unset');
        handle.dataset.mark = field === 'start' ? 'S' : 'E';
        handle.title = t(field === 'start' ? 'startTimeHandleTitle' : 'endTimeHandleTitle');
        handle.setAttribute('role', 'slider');
        handle.setAttribute('tabindex', '0');
        handle.setAttribute('aria-label', handle.title);
        handle.setAttribute('aria-valuemin', '0');
        handle.setAttribute('aria-valuemax', field === 'start' ? '23' : '24');

        const place = h => {
          const p = S.polarPoint(S.hourToDeg(h % 24), 91, 94, 94);
          handle.style.left = p.x + 'px'; handle.style.top = p.y + 'px';
          handle.setAttribute('aria-valuenow', String(h));
        };
        place(isSet ? r[field] : defaultHour);

        let dragging = false;
        const applyHour = h => {
          r[field] = h;
          handle.classList.remove('unset');
          place(h);
          const row = playTimeRowsEl.children[idx];
          const inp = row && row.querySelector(`[data-field="${field}"]`);
          if (inp) inp.value = h;
          if (state.playTimeIrregular) clearIrregular();
          updateDialVisual();
          renderCard();
        };
        handle.addEventListener('pointerdown', ev => {
          ev.preventDefault();
          dragging = true;
          try { handle.setPointerCapture(ev.pointerId); } catch (err) {}
          handle.classList.add('dragging');
          const startHour = S.degToHour(angleFromPointer(ev.clientX, ev.clientY));
          if (!(field === 'end' && r.end === 24 && startHour === 0)) applyHour(startHour);
        });
        handle.addEventListener('pointermove', ev => {
          if (!dragging) return;
          applyHour(S.degToHour(angleFromPointer(ev.clientX, ev.clientY)));
        });
        const endDrag = ev => {
          if (!dragging) return;
          dragging = false;
          handle.classList.remove('dragging');
          try { handle.releasePointerCapture(ev.pointerId); } catch (err) {}
        };
        handle.addEventListener('pointerup', endDrag);
        handle.addEventListener('pointercancel', endDrag);
        handle.addEventListener('keydown', ev => {
          if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
          ev.preventDefault();
          const maxV = field === 'start' ? 23 : 24;
          const cur = r[field] != null ? r[field] : defaultHour;
          const delta = ev.key === 'ArrowRight' ? 1 : -1;
          applyHour(Math.max(0, Math.min(maxV, cur + delta)));
        });
        clockArcCapsEl.appendChild(handle);
      });
    });
  }

  function drawClockSelection() { updateDialVisual(); drawArcHandles(); }

  function clearIrregular() {
    if (!state.playTimeIrregular) return;
    state.playTimeIrregular = false;
    irregularBtn.classList.remove('selected');
  }

  function drawPlayTimeRanges() {
    playTimeRowsEl.innerHTML = '';
    state.playTimeRanges.forEach((r, idx) => {
      const row = el('div', 'tc-clock-range-row');
      row.innerHTML = `
        <div class="tc-clock-num-f-row"><input type="number" min="0" max="23" placeholder="20" value="${r.start ?? ''}" data-field="start"><span>${t('hourUnitLabel')}</span></div>
        <span class="tc-clock-num-sep">〜</span>
        <div class="tc-clock-num-f-row"><input type="number" min="0" max="24" placeholder="24" value="${r.end ?? ''}" data-field="end"><span>${t('hourUnitLabel')}</span></div>
        <button type="button" class="tc-clock-range-remove" aria-label="${escapeHtml(t('removeTimeRangeAriaLabel'))}"><svg class="inline-icon" width="12" height="12"><use href="#i-close"/></svg></button>`;
      row.querySelector('[data-field="start"]').addEventListener('input', e => {
        r.start = S.clampHour(e.target.value, 23);
        if (r.start != null && String(r.start) !== e.target.value) e.target.value = r.start;
        if (r.start != null) clearIrregular();
        drawClockSelection(); renderCard();
      });
      row.querySelector('[data-field="end"]').addEventListener('input', e => {
        r.end = S.clampHour(e.target.value, 24);
        if (r.end != null && String(r.end) !== e.target.value) e.target.value = r.end;
        if (r.end != null) clearIrregular();
        drawClockSelection(); renderCard();
      });
      row.querySelector('.tc-clock-range-remove').addEventListener('click', () => {
        state.playTimeRanges.splice(idx, 1);
        if (!state.playTimeRanges.length) state.playTimeRanges.push({ start: null, end: null });
        drawPlayTimeRanges();
        drawClockSelection(); renderCard();
      });
      playTimeRowsEl.appendChild(row);
    });
  }
  drawPlayTimeRanges();

  q('#tcPlayTimeAddBtn').addEventListener('click', () => {
    state.playTimeRanges.push({ start: null, end: null });
    drawPlayTimeRanges();
    drawClockSelection();
  });

  let playTimeRangesBackup = null;
  irregularBtn.addEventListener('click', () => {
    state.playTimeIrregular = !state.playTimeIrregular;
    if (state.playTimeIrregular) {
      playTimeRangesBackup = state.playTimeRanges;
      state.playTimeRanges = [{ start: null, end: null }];
      drawPlayTimeRanges();
    } else if (playTimeRangesBackup) {
      state.playTimeRanges = playTimeRangesBackup;
      playTimeRangesBackup = null;
      drawPlayTimeRanges();
    }
    drawClockSelection();
    renderCard();
  });

  drawClockSelection();
}

/* ================================================================
   詳細プロフィール（タップで複数選択・自由記述対応）
   ================================================================ */
function translateDetailOption(ja) { return EN ? (S.DETAIL_OPTION_EN[ja] || ja) : ja; }
function wireDetailGroups() {
  const detailGroupsEl = q('#tcDetailGroups');
  S.DETAIL_GROUPS.forEach(g => {
    const wrap = el('div', 'tc-chipgroup');
    const labelEl = el('div', 'tc-chip-label', `<span class="tc-ic">${g.icon}</span><span>${escapeHtml(EN ? g.labelEn : g.label)}</span>`);
    wrap.appendChild(labelEl);
    detailGroupsEl.appendChild(wrap);

    const chips = el('div', 'tc-chips');
    wrap.appendChild(chips);
    const freeTextWrap = el('div', 'tc-free-text-input');
    freeTextWrap.style.display = 'none';
    freeTextWrap.innerHTML = `<input type="text" placeholder="${escapeHtml(t('freeTextPlaceholder'))}">`;
    wrap.appendChild(freeTextWrap);
    freeTextWrap.querySelector('input').value = state.detailFreeText[g.id] || '';
    freeTextWrap.querySelector('input').addEventListener('input', e => { state.detailFreeText[g.id] = e.target.value; renderCard(); });

    function draw() {
      chips.innerHTML = '';
      const selected = state.detail[g.id] || [];
      g.options.forEach(opt => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tc-chip-opt' + (selected.includes(opt) ? ' selected' : '');
        b.textContent = translateDetailOption(opt);
        b.addEventListener('click', () => {
          const cur = state.detail[g.id] || [];
          state.detail[g.id] = cur.includes(opt) ? cur.filter(x => x !== opt) : [...cur, opt];
          draw();
          freeTextWrap.style.display = state.detail[g.id].includes(S.FREE_TEXT) ? 'block' : 'none';
          renderCard();
        });
        chips.appendChild(b);
      });
      freeTextWrap.style.display = selected.includes(S.FREE_TEXT) ? 'block' : 'none';
    }
    draw();
  });
}

/* ================================================================
   収集状況
   ================================================================ */
function wireEcoStats() {
  const ecoEl = q('#tcEcoStatFields');
  ecoStats.forEach(f => {
    const row = el('div', 'tc-f tc-eco-field-row');
    row.innerHTML = `
      <div class="tc-eco-field-head">
        <label>${f.icon} ${escapeHtml(EN ? f.labelEn : f.label)} <span style="color:var(--tc-teal-ink);font-family:'IBM Plex Mono',monospace;font-size:10px;">→ ${escapeHtml(EN ? f.sourceEn : f.source)}</span></label>
        <label class="tc-switch tc-eco-vis-switch"><input type="checkbox" ${f.visible ? 'checked' : ''} aria-label="${escapeHtml(t('makePublicAriaLabelTemplate', { label: EN ? f.labelEn : f.label }))}"><span class="tc-track"></span><span class="tc-knob"></span></label>
      </div>
      <input type="text" value="${escapeHtml(f.value || '')}" placeholder="${escapeHtml(EN ? f.placeholderEn : f.placeholder)}">`;
    ecoEl.appendChild(row);
    row.querySelector('input[type="text"]').addEventListener('input', e => { f.value = e.target.value; renderCard(); });
    row.querySelector('input[type="checkbox"]').addEventListener('change', e => { f.visible = e.target.checked; renderCard(); });
  });

  q('#tcEcoSyncBtn').addEventListener('click', () => {
    const syncedCount = runEcoStatsSync();
    renderCard();
    showToast(syncedCount > 0 ? t('ecoSyncedTemplate', { n: syncedCount }) : t('allSyncNotFoundMsg'));
  });
}
function runEcoStatsSync() {
  let syncedCount = 0;
  const ecoEl = q('#tcEcoStatFields');
  ecoStats.forEach((f, i) => {
    const fn = S.ECO_SYNC_FNS[f.id];
    if (!fn) return;
    const result = fn();
    if (result) {
      f.value = result;
      const row = ecoEl && ecoEl.children[i];
      const input = row && row.querySelector('input[type="text"]');
      if (input) input.value = result;
      syncedCount++;
    }
  });
  return syncedCount;
}

/* ================================================================
   称号
   ================================================================ */
function wireTitles() {
  q('#tcTitleSyncBtn').addEventListener('click', () => {
    const n = runTitleSync();
    renderCard();
    showToast(n > 0 ? t('titlesLoadedTemplate', { n }) : t('titlesNotFoundMsg'));
  });
}
function runTitleSyncSilent() { syncedTitlesCache = S.syncEarnedTitles(); state.titles.selected = state.titles.selected.filter(k => syncedTitlesCache.some(ti => ti.key === k)); }
function runTitleSync() { runTitleSyncSilent(); drawTitlePicker(); return syncedTitlesCache.length; }
function drawTitlePicker() {
  const titlePickerEl = q('#tcTitlePickerArea');
  if (!titlePickerEl) return;
  if (!syncedTitlesCache.length) {
    titlePickerEl.innerHTML = `<p class="tc-title-picker-empty">${escapeHtml(t('titlePickerEmptyMsg'))}</p>`;
    return;
  }
  const wrap = el('div', 'tc-chips');
  syncedTitlesCache.forEach(ti => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tc-chip-opt' + (state.titles.selected.includes(ti.key) ? ' selected' : '');
    const tiName = EN ? (ti.nameEn || ti.name) : ti.name;
    const tiDesc = EN ? ti.descEn : ti.desc;
    const tiSource = EN ? (ti.sourceEn || ti.source) : ti.source;
    b.title = tiDesc ? `${tiSource} — ${tiDesc}` : tiSource;
    b.innerHTML = `<span>${ti.icon}</span> ${escapeHtml(tiName)}`;
    b.addEventListener('click', () => {
      const idx = state.titles.selected.indexOf(ti.key);
      if (idx === -1) state.titles.selected.push(ti.key); else state.titles.selected.splice(idx, 1);
      drawTitlePicker();
      renderCard();
    });
    wrap.appendChild(b);
  });
  titlePickerEl.innerHTML = '';
  titlePickerEl.appendChild(wrap);
}

/* ================================================================
   入手グラフ
   ================================================================ */
function wireTrendGraphs() {
  const trendEditEl = q('#tcTrendGraphFields');
  trendGraphs.forEach(g => {
    const row = el('div', 'tc-f tc-eco-field-row');
    row.innerHTML = `
      <div class="tc-eco-field-head">
        <label>${g.icon} ${escapeHtml(EN ? g.labelEn : g.label)} <span style="color:var(--tc-teal-ink);font-family:'IBM Plex Mono',monospace;font-size:10px;">→ ${escapeHtml(EN ? g.sourceEn : g.source)}</span></label>
        <label class="tc-switch tc-eco-vis-switch"><input type="checkbox" ${g.visible ? 'checked' : ''} aria-label="${escapeHtml(t('reflectInProfileAriaLabelTemplate', { label: EN ? g.labelEn : g.label }))}"><span class="tc-track"></span><span class="tc-knob"></span></label>
      </div>`;
    trendEditEl.appendChild(row);
    row.querySelector('input[type="checkbox"]').addEventListener('change', e => { g.visible = e.target.checked; renderCard(); });
  });
}

/* ================================================================
   ケープレベル（羽トラッカー連携）
   ================================================================ */
function runWingSyncSilent() {
  const result = S.syncWingTotalStat();
  if (result === null) return false;
  state.wingTotal = result;
  return true;
}

/* ================================================================
   まとめて連携 / 自動連携
   ================================================================ */
function wireAllSync() {
  q('#tcWingSyncBtn').addEventListener('click', () => {
    const ok = runWingSyncSilent();
    const input = q('#tcInWingTotal');
    if (input) input.value = state.wingTotal;
    renderCard();
    showToast(ok ? t('wingSyncedTemplate', { n: state.wingTotal }) : t('wingSyncNotFoundMsg'));
  });

  q('#tcAllSyncBtn').addEventListener('click', runAllSyncWithToast);

  const autoSyncToggleEl = q('#tcAutoSyncToggle');
  autoSyncToggleEl.checked = !!state.autoSync;
  autoSyncToggleEl.addEventListener('change', e => {
    state.autoSync = e.target.checked;
    S.scheduleSaveState(state, showQuotaToast);
    if (state.autoSync) runAllSyncWithToast();
  });
}
function runAllSyncWithToast() {
  const ecoCount = runEcoStatsSync();
  const titleCount = runTitleSync();
  const wingOk = runWingSyncSilent();
  const wingInput = q('#tcInWingTotal');
  if (wingInput && wingOk) wingInput.value = state.wingTotal;
  renderCard();
  const parts = [];
  if (ecoCount > 0) parts.push(t('allSyncEcoPartTemplate', { n: ecoCount }));
  if (titleCount > 0) parts.push(t('allSyncTitlePartTemplate', { n: titleCount }));
  if (wingOk) parts.push(t('allSyncWingPart'));
  showToast(parts.length ? t('allSyncedTemplate', { parts: parts.join(EN ? ', ' : '・') }) : t('allSyncNotFoundMsg'));
}

/* ================================================================
   カードのレンダリング
   ================================================================ */
function splitNumUnit(str, numCls, unitCls) {
  const s = String(str);
  const m = /^(\d+(?:\.\d+)?)(.*)$/.exec(s);
  if (!m) return escapeHtml(s);
  const unit = m[2] ? `<span class="${unitCls}">${escapeHtml(m[2])}</span>` : '';
  return `<span class="${numCls}">${escapeHtml(m[1])}</span>${unit}`;
}
function staggerRows(container, selector) {
  container.querySelectorAll(selector).forEach((rowEl, i) => { rowEl.style.animationDelay = (i * 0.035) + 's'; });
}
function setSection(sectionEl, html) {
  sectionEl.innerHTML = html;
  sectionEl.style.display = html ? '' : 'none';
}
function hexToRgbString(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  if (!m) return '201,154,74';
  return [1, 2, 3].map(i => parseInt(m[i], 16)).join(',');
}

function renderCardClockHtml(theme) {
  const DIAL_SIZE = 84, dc = DIAL_SIZE / 2;
  const neutral = 'rgba(37,53,46,0.08)';
  let arcSvg, icon, filled = [];
  if (state.playTimeIrregular) {
    arcSvg = `<svg class="tc-card-clock-arc-svg" viewBox="0 0 ${DIAL_SIZE} ${DIAL_SIZE}"><circle cx="${dc}" cy="${dc}" r="${dc}" fill="${neutral}"></circle></svg>`;
    icon = '🌀';
  } else {
    filled = state.playTimeRanges.filter(r => r.start != null && r.end != null);
    arcSvg = S.buildDialArcSvg(filled, theme.ca, neutral, DIAL_SIZE);
    icon = '🕐';
  }
  let ticksHtml = '';
  for (let h = 0; h < 24; h++) {
    const deg = S.hourToDeg(h);
    const p = S.polarPoint(deg, dc - 5, dc, dc);
    ticksHtml += `<span class="tc-card-clock-tick${h % 6 === 0 ? ' major' : ''}" style="left:${p.x}px;top:${p.y}px;transform:translate(-50%,-50%) rotate(${deg}deg);"></span>`;
  }
  let capsHtml = '';
  filled.forEach(r => {
    [r.start, r.end].forEach(h => {
      const p = S.polarPoint(S.hourToDeg(h), dc - 1, dc, dc);
      capsHtml += `<span class="tc-card-clock-cap" style="left:${p.x}px;top:${p.y}px;"></span>`;
    });
  });
  return `<div class="tc-card-clock-dial">
    ${arcSvg}
    <span class="tc-card-clock-q q0">🌙</span>
    <span class="tc-card-clock-q q6">🌅</span>
    <span class="tc-card-clock-q q12">☀️</span>
    <span class="tc-card-clock-q q18">🌆</span>
    <div class="tc-card-clock-ticks">${ticksHtml}</div>
    <div class="tc-card-clock-caps">${capsHtml}</div>
    <div class="tc-card-clock-hole"><span class="tc-card-clock-center-icon">${icon}</span></div>
  </div>`;
}

const PLAY_TIME_QUARTERS = [
  { icon: '🌙', text: '夜ふかし型', textEn: 'Night Owl' },
  { icon: '🌅', text: '朝型', textEn: 'Early Bird' },
  { icon: '☀️', text: '昼型', textEn: 'Daytime Player' },
  { icon: '🌆', text: '夕方型', textEn: 'Evening Player' },
];
function playTimeVibeLabel(ranges) {
  if (!ranges.length) return null;
  const hoursByQuarter = [0, 0, 0, 0];
  const coveredHours = new Set();
  ranges.forEach(r => {
    let e = r.end;
    if (e < r.start) e += 24;
    for (let h = r.start; h < e; h++) coveredHours.add(h % 24);
  });
  coveredHours.forEach(h => { hoursByQuarter[Math.floor(h / 6)]++; });
  const totalHours = coveredHours.size;
  if (!totalHours) return null;
  if (totalHours >= 16) return { icon: '🌈', text: 'いつでも歓迎', textEn: 'Anytime Welcome' };
  let bestIdx = 0;
  hoursByQuarter.forEach((v, i) => { if (v > hoursByQuarter[bestIdx]) bestIdx = i; });
  return PLAY_TIME_QUARTERS[bestIdx];
}

function getBgImageNaturalSize(src, onReady) {
  if (bgNaturalSizeCache[src]) return bgNaturalSizeCache[src];
  const img = new Image();
  img.onload = () => { bgNaturalSizeCache[src] = { w: img.naturalWidth, h: img.naturalHeight }; onReady(); };
  img.src = src;
  return null;
}
function applyCardBgStyle(wrapEl, bg) {
  if (!bg.src) { wrapEl.style.display = 'none'; wrapEl.style.backgroundImage = ''; return; }
  wrapEl.style.display = 'block';
  wrapEl.style.opacity = bg.opacity / 100;
  const nat = getBgImageNaturalSize(bg.src, renderCard);
  wrapEl.style.backgroundImage = `url("${bg.src}")`;
  if (!nat) { wrapEl.style.backgroundSize = 'cover'; wrapEl.style.backgroundPosition = 'center'; return; }
  const rect = wrapEl.getBoundingClientRect();
  const cw = rect.width || 1, ch = rect.height || 1;
  const coverScale = Math.max(cw / nat.w, ch / nat.h);
  const ew = nat.w * coverScale * bg.zoom;
  const eh = nat.h * coverScale * bg.zoom;
  const bgX = (cw - ew) / 2 + (bg.offsetX / 100) * cw;
  const bgY = (ch - eh) / 2 + (bg.offsetY / 100) * ch;
  wrapEl.style.backgroundSize = `${ew}px ${eh}px`;
  wrapEl.style.backgroundPosition = `${bgX}px ${bgY}px`;
}

function renderTrendSparklineHtml(values) {
  if (values.length < 2) return '';
  const w = 300, h = 84, pad = 6;
  const min = Math.min(...values), max = Math.max(...values);
  const range = (max - min) || 1;
  const stepX = (w - pad * 2) / (values.length - 1);
  const points = values.map((v, i) => [pad + i * stepX, h - pad - ((v - min) / range) * (h - pad * 2)]);
  const linePath = points.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const last = points[points.length - 1], first = points[0];
  const areaPath = `${linePath} L${last[0].toFixed(1)} ${h - pad} L${first[0].toFixed(1)} ${h - pad} Z`;
  const dotLeftPct = (last[0] / w * 100).toFixed(2), dotTopPct = (last[1] / h * 100).toFixed(2);
  return `
    <div class="tc-trend-svg-wrap">
      <svg viewBox="0 0 ${w} ${h}" class="tc-trend-svg" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(t('acquisitionGraphAriaLabel'))}">
        <path d="${areaPath}" class="tc-trend-area"></path>
        <path d="${linePath}" class="tc-trend-line"></path>
      </svg>
      <div class="tc-trend-dot" style="left:${dotLeftPct}%; top:${dotTopPct}%;"></div>
    </div>`;
}

function renderCard() {
  if (!containerEl) return;
  const card = q('#tcCard');
  const theme = S.THEMES.find(th => th.id === state.theme) || S.THEMES[0];
  card.style.setProperty('--tc-card-grad', theme.grad);
  card.style.setProperty('--tc-ca', theme.ca);
  card.style.setProperty('--tc-ca2', theme.ca2);
  card.style.setProperty('--tc-ca-rgb', hexToRgbString(theme.ca));

  const avatarEl = q('#tcCardAvatar');
  avatarEl.innerHTML = state.avatarImage.src
    ? `<img src="${escapeHtml(state.avatarImage.src)}" style="transform: scale(${state.avatarImage.zoom}) translate(${state.avatarImage.offsetX}%, ${state.avatarImage.offsetY}%);">`
    : '';

  applyCardBgStyle(q('#tcCardBgWrap'), state.cardBgImage);

  q('#tcCardName').textContent = state.name || t('cardNameFallback');
  q('#tcCardOneLiner').textContent = state.oneLiner || '';

  const jEl = q('#tcCardJourney');
  let jItems = '';
  if (state.journeyYear) jItems += `<span class="tc-card-pill-badge">${t('bornPrefix')}${escapeHtml(state.journeyYear)}</span>`;
  const filledFavs = state.favorites.filter(f => f.label && f.value);
  jItems += filledFavs.map(f => `<span class="tc-jr-pill"><span class="tc-jr-fav-label">${t('favLabelPrefix')}${escapeHtml(f.label)}</span><span class="tc-jr-fav-value">${escapeHtml(f.value)}</span></span>`).join('');
  setSection(jEl, jItems ? `<div class="tc-card-journey-strip">${jItems}</div>` : '');
  staggerRows(jEl, '.tc-card-pill-badge, .tc-jr-pill');

  const snsInlineEl = q('#tcCardSnsInline');
  const filledSns = state.snsList.filter(s => s.id);
  snsInlineEl.innerHTML = (state.vis.sns && filledSns.length)
    ? filledSns.map(s => `<span class="tc-card-sns-chip" title="${escapeHtml(s.platform)}">@${escapeHtml(s.id)}</span>`).join('')
    : '';

  const ptEl = q('#tcCardPlayTimeWrap');
  if (state.vis.playTime) {
    const filledRanges = state.playTimeRanges.filter(r => r.start != null && r.end != null);
    const listHtml = state.playTimeIrregular
      ? `<div class="tc-card-clock-range">${t('irregularBtnLabel')}</div>`
      : filledRanges.length
        ? filledRanges.map(r => `<div class="tc-card-clock-range"><span class="tc-pt-num">${r.start}</span><span class="tc-pt-unit">${t('hourUnitLabel')}</span>〜<span class="tc-pt-num">${r.end}</span><span class="tc-pt-unit">${t('hourUnitLabel')}</span></div>`).join('')
        : `<div class="tc-card-clock-range na">${t('notConfiguredLabel')}</div>`;
    const vibe = !state.playTimeIrregular ? playTimeVibeLabel(filledRanges) : null;
    const vibeHtml = vibe ? `<div class="tc-card-clock-vibe"><span>${vibe.icon}</span>${EN ? vibe.textEn : vibe.text}</div>` : '';
    setSection(ptEl, `
      <div class="tc-card-sec-title">PLAY TIME</div>
      <div class="tc-card-sec-heading">${t('secPlayTimeTitle')}</div>
      <div class="tc-card-clock-module">
        ${renderCardClockHtml(theme)}
        <div class="tc-card-clock-list">${listHtml}${vibeHtml}</div>
      </div>`);
    staggerRows(ptEl, '.tc-card-clock-range');
  } else { setSection(ptEl, ''); }

  const noteEl = q('#tcCardCustomNoteWrap');
  const noteText = (state.customNote.text || '').trim();
  const noteImgSrc = state.customNote.image && state.customNote.image.src;
  if (state.vis.customNote && (noteText || noteImgSrc)) {
    const noteTitle = (state.customNote.title || '').trim() || t('secCustomNoteTitle');
    const imgHtml = noteImgSrc ? `<img class="tc-card-custom-note-img" src="${escapeHtml(noteImgSrc)}" alt="">` : '';
    const textHtml = noteText ? `<p class="tc-card-custom-note-text">${escapeHtml(noteText).replace(/\n/g, '<br>')}</p>` : '';
    setSection(noteEl, `
      <div class="tc-card-sec-title">CUSTOM</div>
      <div class="tc-card-sec-heading">${escapeHtml(noteTitle)}</div>
      <div class="tc-card-custom-note-box">${imgHtml}${textHtml}</div>`);
  } else { setSection(noteEl, ''); }

  const dtEl = q('#tcCardDetailsWrap');
  if (state.vis.details) {
    const chips = S.DETAIL_GROUPS.map(g => {
      const selected = state.detail[g.id] || [];
      const parts = selected.map(x => x === S.FREE_TEXT ? (state.detailFreeText[g.id] || S.FREE_TEXT) : x).filter(Boolean);
      if (!parts.length) return '';
      const valueHtml = parts.map((p, i) => (i > 0 ? '<span class="tc-dc-value-sep">・</span>' : '') + `<span class="tc-dc-value-part">${escapeHtml(translateDetailOption(p))}</span>`).join('');
      return `<div class="tc-detail-chip"><span class="tc-dc-icon">${g.icon}</span><div class="tc-dc-body"><span class="tc-dc-label">${escapeHtml(EN ? g.labelEn : g.label)}</span><span class="tc-dc-value">${valueHtml}</span></div></div>`;
    }).join('');
    if (chips) {
      setSection(dtEl, `
        <div class="tc-card-sec-title">DETAILS</div>
        <div class="tc-card-sec-heading">${t('secDetailsTitle')}</div>
        <div class="tc-card-detail-mosaic">${chips}</div>`);
      staggerRows(dtEl, '.tc-detail-chip');
    } else { setSection(dtEl, ''); }
  } else { setSection(dtEl, ''); }

  const titlesWrapEl = q('#tcCardTitlesWrap');
  const selectedTitles = syncedTitlesCache.filter(ti => state.titles.selected.includes(ti.key));
  if (state.vis.titles && selectedTitles.length) {
    const badges = selectedTitles.map(ti => `<span class="tc-card-title-badge"><span class="tc-ctb-icon">${ti.icon}</span>${escapeHtml(EN ? (ti.nameEn || ti.name) : ti.name)}</span>`).join('');
    setSection(titlesWrapEl, `
      <div class="tc-card-sec-title">TITLES</div>
      <div class="tc-card-sec-heading">${t('secTitlesTitle')}</div>
      <div class="tc-card-titles-strip">${badges}</div>`);
    staggerRows(titlesWrapEl, '.tc-card-title-badge');
  } else { setSection(titlesWrapEl, ''); }

  const capeEl = q('#tcCardCapeWrap');
  const wingTotalRaw = String(state.wingTotal).trim();
  const wingTotalNum = /[-.]/.test(wingTotalRaw) ? NaN : parseInt(wingTotalRaw.replace(/[^0-9]/g, ''), 10);
  if (state.vis.cape && !isNaN(wingTotalNum) && wingTotalNum >= 0) {
    const c = S.computeCape(wingTotalNum);
    const wingTotalLocalized = wingTotalNum.toLocaleString(EN ? 'en-US' : 'ja-JP');
    const sub = c.isMax
      ? t('capeMaxTemplate', { n: wingTotalLocalized, max: S.CAPE_LEVELS.length })
      : t('capeProgressTemplate', { n: wingTotalLocalized, level: c.reachedLevel + 1, remain: c.remain });
    setSection(capeEl, `
      <div class="tc-card-sec-title">CAPE LEVEL</div>
      <div class="tc-card-sec-heading">${t('secCapeTitle')}</div>
      <div class="tc-cape-widget">
        <div class="tc-cape-widget-title">✦ ${t('secCapeTitle')}</div>
        <div class="tc-cape-widget-sub">${sub}</div>
        <div class="tc-cape-level-label">Lv${c.reachedLevel}</div>
        <div class="tc-cape-pips">${renderCapePipsHtml(c.reachedLevel)}</div>
        <div class="tc-progress-bar"><div class="tc-progress-bar-fill" style="width:${c.pct}%"></div></div>
      </div>`);
  } else { setSection(capeEl, ''); }

  const ecoWrapEl = q('#tcCardEcoWrap');
  const hasAnyEco = ecoStats.some(f => f.value && f.visible);
  if (state.vis.ecoStats && hasAnyEco) {
    let html = `
      <div class="tc-card-sec-title">COLLECTION</div>
      <div class="tc-card-sec-heading">${t('secEcoStatsTitle')}</div>
      <div class="tc-card-eco-grid">`;
    ecoStats.forEach(f => {
      if (!f.value || !f.visible) return;
      const pctMatch = /^(\d{1,3}(?:\.\d+)?)%$/.exec((f.value || '').trim());
      const pct = pctMatch ? Math.max(0, Math.min(100, Number(pctMatch[1]))) : null;
      const bar = pct !== null ? `<div class="tc-progress-bar"><div class="tc-progress-bar-fill" style="width:${pct}%"></div></div>` : '';
      const valueHtml = `<div class="tc-soft-row-value ${f.value ? '' : 'na'}">${f.value ? splitNumUnit(f.value, 'tc-eco-val-num', 'tc-eco-val-unit') : t('notSetLabel')}</div>${bar}`;
      html += `<div class="tc-eco-tile tc-soft-row"><div class="tc-soft-row-icon">${f.icon}</div><div class="tc-soft-row-body"><div class="tc-soft-row-label">${escapeHtml(EN ? f.labelEn : f.label)}</div>${valueHtml}</div></div>`;
    });
    html += '</div>';
    setSection(ecoWrapEl, html);
    staggerRows(ecoWrapEl, '.tc-eco-tile');
  } else { setSection(ecoWrapEl, ''); }

  const trendWrapEl = q('#tcCardTrendWrap');
  const visibleTrends = trendGraphs.filter(g => g.visible);
  if (visibleTrends.length) {
    let html = `
      <div class="tc-card-sec-title">ACQUISITION</div>
      <div class="tc-card-sec-heading">${t('secTrendTitle')}</div>`;
    visibleTrends.forEach(g => {
      const series = S.getTrendSeriesFromTool(g.rawCurrentKey, g.rawHistoryKey);
      const body = series.length >= 2
        ? renderTrendSparklineHtml(series)
        : `<p class="tc-trend-empty">${escapeHtml(t('trendEmptyTemplate', { source: EN ? g.sourceEn : g.source }))}</p>`;
      html += `<div class="tc-trend-block">
        <div class="tc-trend-block-label">${g.icon} ${escapeHtml(EN ? g.labelEn : g.label)}</div>
        ${body}
      </div>`;
    });
    setSection(trendWrapEl, html);
  } else { setSection(trendWrapEl, ''); }

  const fcEl = q('#tcCardFcWrap');
  if (state.friendCode && state.vis.friendCode) {
    const contactTag = state.friendCodeContact ? `<span class="tc-fc-contact-tag">${escapeHtml(translateFriendContactOption(state.friendCodeContact))}</span>` : '';
    setSection(fcEl, `
      <div class="tc-card-sec-title">FRIEND CODE</div>
      <div class="tc-card-sec-heading">${t('secFriendCodeTitle')}</div>
      <div class="tc-card-fc"><span>${escapeHtml(state.friendCode)}</span>${contactTag}</div>`);
  } else { setSection(fcEl, ''); }

  const cardDateNow = new Date();
  const cardDateStr = cardDateNow.getFullYear() + '.' + String(cardDateNow.getMonth() + 1).padStart(2, '0') + '.' + String(cardDateNow.getDate()).padStart(2, '0');
  q('#tcCardDate').textContent = t('issueDateTemplate', { date: cardDateStr });

  ecoStats.forEach(f => { state.ecoStats[f.id] = { value: f.value, visible: f.visible }; });
  trendGraphs.forEach(g => { state.trendGraphs[g.id] = g.visible; });

  S.scheduleSaveState(state, showQuotaToast);
}

function renderCapePipsHtml(reachedLevel) {
  if (reachedLevel <= 0) return '';
  const pipCount = Math.min(reachedLevel, 5);
  const numSparkle = Math.max(0, Math.min(reachedLevel - 10, 5));
  const numOutlined = Math.max(0, Math.min(reachedLevel - 5, 5));
  return Array.from({ length: pipCount }, (_, i) => {
    const distFromTop = pipCount - 1 - i;
    if (distFromTop < numSparkle) {
      return `<div class="tc-cape-pip tier3"><span class="tc-cape-pip-inner"></span><span class="tc-cape-spark t"></span><span class="tc-cape-spark b"></span><span class="tc-cape-spark l"></span><span class="tc-cape-spark r"></span></div>`;
    }
    if (distFromTop < numOutlined) return `<div class="tc-cape-pip tier2"><span class="tc-cape-pip-inner"></span></div>`;
    return `<div class="tc-cape-pip"></div>`;
  }).join('');
}

function showQuotaToast(msgKey) { showToast(t(msgKey)); }

/* ================================================================
   画像を保存 / Xへ投稿（html2canvas。CDNから遅延読み込み）
   ================================================================ */
const SITE_URL = toolShareUrl('tai-card');
function buildShareText() { return t('shareTweetTemplate', { url: SITE_URL }); }

function showToast(msg) {
  const el2 = q('#tcToast');
  if (!el2) return;
  el2.textContent = msg;
  el2.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el2.classList.remove('show'), 2400);
}

function sanitizeFilename(str) {
  return String(str).replace(/[\\/:*?"<>|]/g, '_').trim() || 'hoshi-tsumugi-card';
}

let html2canvasLoading = null;
function ensureHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve();
  if (html2canvasLoading) return html2canvasLoading;
  html2canvasLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.onload = () => resolve();
    s.onerror = () => { html2canvasLoading = null; reject(new Error('html2canvas load failed')); };
    document.head.appendChild(s);
  });
  return html2canvasLoading;
}

function isMobileDevice() {
  if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') return navigator.userAgentData.mobile;
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPod|iPad/i.test(ua)) return true;
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return true;
  return false;
}

async function tryShareImage(canvas, filename, text) {
  if (!isMobileDevice()) return 'unsupported';
  if (!navigator.share || !navigator.canShare) return 'unsupported';
  try {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return 'unsupported';
    const file = new File([blob], filename, { type: 'image/png' });
    const shareData = text ? { files: [file], text } : { files: [file] };
    if (!navigator.canShare(shareData)) return 'unsupported';
    await navigator.share(shareData);
    return 'success';
  } catch (err) {
    if (err && err.name === 'AbortError') return 'cancelled';
    return 'unsupported';
  }
}

const clipboardImageSupported = !!(navigator.clipboard && typeof navigator.clipboard.write === 'function' && typeof window.ClipboardItem === 'function');
const PREVIEW_OVERLAY_ID = 'tcImagePreviewOverlay';
let currentPreviewCanvas = null;

function openImagePreview(dataUrl, filename, shareText, canvas) {
  document.getElementById(PREVIEW_OVERLAY_ID)?.remove();
  currentPreviewCanvas = canvas || null;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = PREVIEW_OVERLAY_ID;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeImagePreview(); });
  overlay.innerHTML = `
    <div class="modal-card">
      <button type="button" class="modal-close-btn" id="tcPreviewCloseBtn" aria-label="${escapeHtml(t('closeAriaLabel'))}"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      <div class="modal-title">${t('previewModalSaveTitle')}</div>
      <div class="tc-preview-hint">${escapeHtml(t('previewHintMsg'))}</div>
      <img class="tc-preview-img" src="${dataUrl}" alt="${escapeHtml(t('previewImgAlt'))}">
      <div class="tc-preview-action-row"><a class="tc-preview-action-btn primary" href="${dataUrl}" download="${escapeHtml(filename)}">${t('downloadBtn')}</a></div>
      ${clipboardImageSupported ? `<div class="tc-preview-action-row"><button type="button" class="tc-preview-action-btn copy" id="tcPreviewCopyBtn">${t('copyToClipboardBtn')}</button></div>` : ''}
      <div class="tc-preview-action-row"><a class="tc-preview-action-btn twitter" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}" target="_blank" rel="noopener noreferrer">${t('openXBtn')}</a></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#tcPreviewCloseBtn').addEventListener('click', closeImagePreview);
  const copyBtn = overlay.querySelector('#tcPreviewCopyBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      if (!currentPreviewCanvas) return;
      copyBtn.disabled = true;
      try {
        const blob = await new Promise(resolve => currentPreviewCanvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('toBlob failed');
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast(t('copiedToClipboardMsg'));
      } catch (err) {
        console.error(err);
        showToast(t('clipboardCopyFailedMsg'));
      } finally {
        copyBtn.disabled = false;
      }
    });
  }
  requestAnimationFrame(() => overlay.classList.add('open'));
}
function closeImagePreview() { document.getElementById(PREVIEW_OVERLAY_ID)?.classList.remove('open'); }

function wireShareImage() {
  const shareBtn = q('#tcShareImageBtn');
  shareBtn.addEventListener('click', async () => {
    shareBtn.disabled = true;
    showToast(t('generatingImageMsg'));
    const cardEl = q('#tcCard');
    const EXPORT_WIDTH_PX = 1200;
    const cloneWrap = document.createElement('div');
    cloneWrap.style.cssText = 'position:fixed; left:-99999px; top:0; pointer-events:none;';
    const clone = cardEl.cloneNode(true);
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(idEl => idEl.removeAttribute('id'));
    clone.style.width = EXPORT_WIDTH_PX + 'px';
    clone.style.maxWidth = 'none';
    clone.classList.add('exporting');
    cloneWrap.appendChild(clone);
    document.body.appendChild(cloneWrap);
    try {
      await ensureHtml2Canvas();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const cloneBgWrap = clone.querySelector('.tc-card-bg-wrap');
      if (cloneBgWrap) applyCardBgStyle(cloneBgWrap, state.cardBgImage);
      const canvas = await window.html2canvas(clone, { backgroundColor: null, scale: 2, useCORS: true });
      const filename = sanitizeFilename(t('cardFilenamePrefix') + (state.name || 'card')) + '.png';
      const shareText = buildShareText();

      const shareResult = await tryShareImage(canvas, filename, shareText);
      if (shareResult === 'success') {
        showToast(t('sharedMsg'));
      } else if (shareResult !== 'cancelled') {
        openImagePreview(canvas.toDataURL('image/png'), filename, shareText, canvas);
      }
    } catch (err) {
      console.error(err);
      showToast(t('imageGenerationFailedMsg'));
    } finally {
      cloneWrap.remove();
      shareBtn.disabled = false;
    }
  });
}

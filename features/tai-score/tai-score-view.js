/* ================================================================
   tai-score（楽譜づくり）のtai-hub移植版。公開面は mount(container, sub)/
   unmount() の2関数のみ（js/router-registry.js からマウントされる）。

   移植元: tai-score/index.html （~5979行のスタンドアロンページ）のうち、
   共有chrome（サイトドック・ツール引き出し・表示設定モーダル・プロフィール・
   独自nav・サイドバー）を除いた「このツール自身」の部分：ヒーローバナー・
   称号・ライブラリ・共有/読み込み/音声・画像・MIDIから作成/確認モーダル・
   フッター。作曲モード（エディタ）は tai-score-editor.js、演奏オーバーレイ
   （練習/試験/フリー演奏）は tai-score-perf.js に分けている。

   【意図的な簡略化・アダプテーション】
   - 独自のnav（タイトル+EN切替）・サイドバー（関連ツールドロワー）・
     独自のsite-dock・独自の表示設定モーダル（テーマ/言語/ショートカット
     有効化）は移植していない。tai-hubの共有chrome（js/chrome/tools-drawer.js・
     settings-modal.js・js/shortcuts.js）が同機能を既に提供しているため。
   - 独自の「バックアップ・復元」モーダル（曲データ(taiScoreSongs_v1)だけを
     対象にした書き出し/読み込み/全削除）は移植していない。tai-hubの共有
     設定モーダルが「全ツール共通のバックアップ・復元」（このツールの
     曲データを含む全localStorageキーが対象）を既に提供しており、狭い機能は
     重複するため。
   - 共有リンク（元は `#song=<code>` というページ自身のURLハッシュ）は、
     tai-hubのハッシュルーティング（#/tai-score）と衝突するため、ルーターの
     サブルートとして `#/tai-score/song=<code>` に載せ替えている
     （mount(container, sub)のsubを見て、'song='で始まっていれば共有コードとして
     デコードし、取り込んだあとlocation.hashを#/tai-scoreへ正規化する）。
   - モーダル（共有・保存/読み込み/音声・画像・MIDIから作成/確認/キー設定/
     作曲ツール）の開閉アニメーションは、tai-hubの共有.modal-overlay/
     .modal-cardのメカニクス（chrome.css。iosFade+sheetSlideUp、常にフルワイド
     ボトムシート）をそのまま流用する。独自のドラッグ&フリック物理演算
     （requestAnimationFrameのスプリング運動、~200行）は移植していない
     ──tai-hub全体でこの簡略化済みの「タップでの開閉のみ」方式に統一されて
     いるため足並みを揃えている（他の移植済みツールと同じ判断）。
   - inline onclick文字列ではなく、pf-modal.js等と同じ data-act 委譲方式で
     イベントを配線している（フレームストリップ・ライブラリ一覧など
     再描画されるDOMにも同じ委譲だけで対応できる）。
   ================================================================ */
import { CURRENT_LANG } from '../../js/i18n.js';
import { t } from './data/i18n-score.js';
import { PITCHES, INSTRUMENT_LABELS } from './data/constants.js';
import * as S from './tai-score-state.js';
import * as A from './tai-score-audio.js';
import {
  RT, escapeHtml, showToast, openModal, closeModal, closeOtherTopLevelOverlays,
  composeToolsSwitchTo, registerResetShareModalOutputs, showConfirm, closeConfirm,
  resetRuntimeForMount, teardownTrap, resetToastQueue,
} from './tai-score-runtime.js';
import * as E from './tai-score-editor.js';
import * as P from './tai-score-perf.js';
import * as AudioImport from './import/audio-import.js';
import * as ImageImport from './import/image-import.js';
import * as MidiImport from './import/midi-import.js';

const STYLE_LINK_ID = 'tai-score-view-styles';
const ICON_SPRITE_ID = 'tai-score-icon-sprite';

E.registerTitlesRenderer(() => renderTitles());
P.registerTitlesRenderer(() => renderTitles());

/* ================================================================
   公開API
   ================================================================ */
export function mount(container, sub) {
  injectStylesheet();
  injectLocalIconSprite();

  RT.containerEl = container;
  resetRuntimeForMount();
  RT.keyBindings = S.loadKeyBindings();
  RT.frameClipboard = S.loadFrameClipboard();
  RT.freePlayInstrument = S.getFreePlayInstrument();

  container.innerHTML = renderShell();
  registerResetShareModalOutputs(resetShareModalOutputs);

  E.populatePitchSelect();
  wireStaticEvents();
  wireDelegatedEvents();
  installGlobalKeydown();

  renderLibrary();
  renderTitles();

  if (sub && sub.startsWith('song=')) {
    // ⚠️ js/router.js の parseHashRoute() は `raw.split('/')` で toolKey/subの
    // 2要素しか取らないため、共有コード自体に"/"（標準Base64に頻出）が含まれると
    // subパラメータ側では途中で切れてしまう。router.js自体は編集対象外のため、
    // location.hashを自前で読み直し、"song="以降を"/"を保ったまま復元する。
    loadSharedSongFromSub(recoverFullSongCodeFromHash() || sub.slice('song='.length));
  }
}
// location.hash（例: "#/tai-score/song=G1:AbC/xYz=="）から、ルーターの2分割に
// よる欠落なしで "song=" 以降全体を取り出す。tai-score以外のルートや
// song=形式でない場合はnullを返す。
function recoverFullSongCodeFromHash() {
  // decodeURIComponent()はloadSharedSongFromSub()側で1回だけ行う（ここでは生のまま分割する）
  const raw = location.hash.replace(/^#\/?/, '');
  const parts = raw.split('/');
  if (parts[0] !== 'tai-score' || !parts[1] || !parts[1].startsWith('song=')) return null;
  return parts.slice(1).join('/').slice('song='.length);
}

export function unmount() {
  E.stopPlayback();
  A.cancelCountIn();
  resetToastQueue();
  teardownTrap();
  if (RT.boundKeydown) { document.removeEventListener('keydown', RT.boundKeydown); RT.boundKeydown = null; }
  RT.listenersAttached = false;
  RT.containerEl = null;
  RT.currentSong = null;
}

/* ================================================================
   スタイルシート・追加アイコンスプライトの注入（初回のみ）
   ================================================================ */
function injectStylesheet() {
  if (document.getElementById(STYLE_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_LINK_ID;
  link.rel = 'stylesheet';
  link.href = new URL('../../css/tai-score.css', import.meta.url).href;
  document.head.appendChild(link);
}
// tai-hub共有の#pf-icon-sprite(js/icon-sprite.js)にはこのツールでしか使わない
// アイコン(keyboard/lock/clock/medal/bolt/chevron-left/chevron-right/undo/redo/
// duplicate/download/stop/hammer)が含まれないため、衝突しない専用プレフィックス
// (ts-i-*)で少数だけ追加のスプライトを自前で持つ（共有ファイルは編集しない）。
// 中身は元のtai-score/index.html自身のスプライト定義そのまま。
const LOCAL_SPRITE_HTML = `<svg id="${ICON_SPRITE_ID}" style="position:absolute;width:0;height:0;overflow:hidden;" aria-hidden="true"><defs>
<symbol id="ts-i-keyboard" viewBox="0 0 24 24"><path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 18H5a1.5 1.5 0 0 1-1.5-1.5Z"/><path d="M6.5 9.5h.01M9.5 9.5h.01M12.5 9.5h.01M15.5 9.5h.01M17.5 9.5h.01M6.5 12.5h.01M9.5 12.5h.01M12.5 12.5h.01M15.5 12.5h.01M17.5 12.5h.01M8 15.5h8"/></symbol>
<symbol id="ts-i-lock" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.094) translate(-12 -12)"><path d="M6.5 11h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z"/><path d="M8 11V8a4 4 0 1 1 8 0v3"/></g></symbol>
<symbol id="ts-i-clock" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.167) translate(-12 -12)"><path d="M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Z"/><path d="M12 8.2V12.3l3 1.8"/></g></symbol>
<symbol id="ts-i-medal" viewBox="0 0 24 24"><path d="M8 3l3 8M16 3l-3 8"/><path d="M12 20a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Z"/><path d="M10 14.5l2-1.2 2 1.2"/></symbol>
<symbol id="ts-i-bolt" viewBox="0 0 24 24"><path d="M13 3L5 14h5l-1 7 9-12h-5Z"/></symbol>
<symbol id="ts-i-chevron-left" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.25) translate(-11.5 -12)"><path d="M15 5l-7 7 7 7"/></g></symbol>
<symbol id="ts-i-chevron-right" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.458) translate(-12 -12)"><path d="M9 6l6 6-6 6"/></g></symbol>
<symbol id="ts-i-undo" viewBox="0 0 24 24"><path d="M7 8H4V5"/><path d="M4 8c2-3 5.5-4 8.5-3a7 7 0 1 1-4.5 12.5"/></symbol>
<symbol id="ts-i-redo" viewBox="0 0 24 24"><path d="M17 8h3V5"/><path d="M20 8c-2-3-5.5-4-8.5-3a7 7 0 1 0 4.5 12.5"/></symbol>
<symbol id="ts-i-duplicate" viewBox="0 0 24 24"><path d="M8.5 8.5V5.5A1.5 1.5 0 0 1 10 4h8.5A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H15.5"/><path d="M4 9.5A1.5 1.5 0 0 1 5.5 8h8A1.5 1.5 0 0 1 15 9.5v9a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 4 18.5Z"/></symbol>
<symbol id="ts-i-download" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.094) translate(-12 -12)"><path d="M12 4v11M8 11l4 4 4-4"/><path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6"/></g></symbol>
<symbol id="ts-i-stop" viewBox="0 0 24 24"><path fill="currentColor" stroke="none" d="M6 6h12v12H6Z"/></symbol>
<symbol id="ts-i-hammer" viewBox="0 0 24 24"><g transform="translate(12 12) scale(1.389) translate(-11.5 -12.1)"><path d="M14.8 6.2l3 3-2.1 2.1-3-3Z"/><path d="M12.7 8.3l-7.5 7.5v2.2h2.2l7.5-7.5Z"/></g></symbol>
</defs></svg>`;
function injectLocalIconSprite() {
  if (document.getElementById(ICON_SPRITE_ID)) return;
  document.body.insertAdjacentHTML('afterbegin', LOCAL_SPRITE_HTML);
}

/* ================================================================
   マークアップ（外枠）
   ================================================================ */
function renderShell() {
  return `
  <div class="tai-score-view">
    <div class="app-layout">
      <div>
        <div class="page-head"><svg class="inline-icon" width="22" height="22"><use href="#i-music-note"/></svg> ${CURRENT_LANG === 'en' ? 'Sheet Music Maker' : '楽譜づくり'}</div>

        <div class="banner">
          <div class="banner-inner">
            <div class="banner-icon-wrap"><span class="banner-icon"><svg class="inline-icon" width="28" height="28"><use href="#i-sheet-music"/></svg></span></div>
            <div class="banner-text">
              <div class="banner-title">${escapeHtml(t('heroBannerTitle'))}</div>
              <div class="banner-nums">
                <div>
                  <div class="bnum-val" id="heroSongsVal">--</div>
                  <div class="bnum-lbl">${escapeHtml(t('heroSongsLabel'))}</div>
                </div>
                <div>
                  <div class="bnum-val" style="opacity:.72" id="heroPracticeVal">--</div>
                  <div class="bnum-lbl">${escapeHtml(t('heroPracticeLabel'))}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card" style="margin-top:14px;"><p>${t('introText')}</p></div>

        <div class="card titles-card">
          <div class="titles-card-head-row">
            <span class="titles-card-head">${escapeHtml(t('titlesSectionTitle'))}</span>
            <span class="titles-count" id="titlesCount">0 / 0</span>
          </div>
          <div class="titles-chip-row" id="titlesChipRow"></div>
        </div>

        <div class="view-tabs">
          <button type="button" class="view-tab active" id="tabLibraryBtn" data-act="switch-view" data-view="library">${escapeHtml(t('tabLibrary'))}</button>
          <button type="button" class="view-tab" id="tabEditorBtn" data-act="switch-view" data-view="editor">${escapeHtml(t('tabEditor'))}</button>
          <button type="button" class="view-tab" data-act="open-free-mode">${escapeHtml(t('tabFreePlay'))}</button>
        </div>

        <section class="view-section active" id="viewLibrary">
          <div class="lib-toolbar">
            <input type="search" class="lib-search" id="librarySearch" placeholder="${escapeHtml(t('librarySearchPlaceholder'))}">
            <button type="button" class="new-song-btn secondary" data-act="open-modal" data-modal="importModal">${escapeHtml(t('btnImport'))}</button>
            <button type="button" class="new-song-btn secondary" data-act="export-library-text">${escapeHtml(t('btnExportAllText'))}</button>
            <button type="button" class="new-song-btn" data-act="create-new-song">${escapeHtml(t('btnNewSong'))}</button>
          </div>
          <details class="test-feature-details">
            <summary class="test-feature-summary">${escapeHtml(t('testFeaturesLabel'))}</summary>
            <div class="test-feature-body">
              <button type="button" class="new-song-btn secondary" data-act="open-audio-import">${escapeHtml(t('btnAudioImport'))}</button>
              <button type="button" class="new-song-btn secondary" data-act="open-image-import">${escapeHtml(t('btnImageImport'))}</button>
              <button type="button" class="new-song-btn secondary" data-act="open-midi-import">${escapeHtml(t('btnMidiImport'))}</button>
            </div>
          </details>
          <div class="lib-sort-row">
            <label>${escapeHtml(t('librarySortLabel'))}</label>
            <select id="librarySortSelect">
              <option value="updated">${escapeHtml(t('sortUpdated'))}</option>
              <option value="name">${escapeHtml(t('sortName'))}</option>
              <option value="bpm">${escapeHtml(t('sortBpm'))}</option>
              <option value="notes">${escapeHtml(t('sortNotes'))}</option>
            </select>
            <button type="button" class="mini-btn" data-act="clear-library-filters">${escapeHtml(t('clearLibraryFiltersBtn'))}</button>
          </div>
          <div class="song-list" id="songList"></div>
        </section>

        <section class="view-section" id="viewEditor"></section>
      </div>
    </div>

    ${renderShareModal()}
    ${renderImportModal()}
    ${renderAudioImportModal()}
    ${renderImageImportModal()}
    ${renderMidiImportModal()}
    ${renderConfirmModal()}
    ${renderKeyBindModal()}
    ${renderPerfOverlay()}
    ${renderComposeOverlay()}
    ${renderComposeToolsModal()}

    <footer>
      <span>${escapeHtml(t('footerDisclaimer'))}</span><br>
      <span>${escapeHtml(t('footerAudioDisclaimer'))}</span><br>
      <span>${t('footerFormatCredit')}</span><br>
      <span>${escapeHtml(t('footerCreditLabel'))}</span> <a href="https://x.com/Skyzztai" target="_blank" rel="noopener noreferrer">@Skyzztai</a>　／
      <a href="https://odaibako.net/u/Skyzztai" target="_blank" rel="noopener noreferrer">${escapeHtml(t('footerRequestForm'))}</a><br>
      <span style="font-size:12px; margin-top:4px; display:inline-block;">
        <a href="#/tai-info">${escapeHtml(t('footerInfoLink'))}</a>
      </span>
    </footer>

    <button type="button" class="floating-stop-btn" id="floatingStopBtn" data-act="stop-playback" title="${escapeHtml(t('stopBtn'))}" aria-label="${escapeHtml(t('stopBtn'))}"><svg class="inline-icon" width="16" height="16"><use href="#ts-i-stop"/></svg></button>

    <div class="toast" id="toast"></div>
  </div>`;
}

function renderShareModal() {
  return `
  <div class="modal-overlay" id="shareModal">
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="shareModalTitle" tabindex="-1">
      <div class="modal-header">
        <span class="modal-title" id="shareModalTitle">${escapeHtml(t('shareModalTitle'))}</span>
        <button type="button" class="modal-close" data-act="close-modal" data-modal="shareModal"><span class="icon-chip" style="width:22px; height:22px;"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></span></button>
      </div>
      <div class="hint">${escapeHtml(t('shareHint1'))}</div>
      <button type="button" class="action-btn primary" data-act="generate-share-code">${escapeHtml(t('createShareCodeBtn'))}</button>
      <div id="shareOutputArea"></div>
      <div style="height:14px; border-top:1px solid var(--sep); margin-top:14px;"></div>
      <div class="hint" style="margin-top:14px;">${escapeHtml(t('shareHint2'))}</div>
      <button type="button" class="action-btn secondary" data-act="generate-text-sheet">${escapeHtml(t('createTextSheetBtn'))}</button>
      <div id="shareTextArea"></div>
      <div style="height:14px;"></div>
      <div class="hint">${escapeHtml(t('shareHint3'))}</div>
      <button type="button" class="action-btn secondary" data-act="download-native-file">${escapeHtml(t('downloadNativeBtn'))}</button>
      <button type="button" class="action-btn secondary" data-act="download-specy-file">${escapeHtml(t('downloadSpecyBtn'))}</button>
      <div id="shareStatus" class="status-msg"></div>
    </div>
  </div>`;
}
function renderImportModal() {
  return `
  <div class="modal-overlay" id="importModal">
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="importModalTitle" tabindex="-1">
      <div class="modal-header">
        <span class="modal-title" id="importModalTitle">${escapeHtml(t('importModalTitle'))}</span>
        <button type="button" class="modal-close" data-act="close-modal" data-modal="importModal"><span class="icon-chip" style="width:22px; height:22px;"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></span></button>
      </div>
      <div class="hint">${escapeHtml(t('importHint'))}</div>
      <textarea class="code-box" id="importCodeInput" placeholder="${escapeHtml(t('importCodePlaceholder'))}"></textarea>
      <button type="button" class="action-btn secondary" data-act="import-from-code">${escapeHtml(t('loadFromCodeBtn'))}</button>
      <input type="file" id="importFileInput" accept=".json,.txt" style="display:none">
      <button type="button" class="action-btn secondary" data-act="trigger-file-input" data-target="importFileInput">${escapeHtml(t('loadFromFileBtn'))}</button>
      <div id="importStatus" class="status-msg"></div>
    </div>
  </div>`;
}
function renderAudioImportModal() {
  return `
  <div class="modal-overlay" id="audioImportModal">
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="audioImportModalTitle" tabindex="-1">
      <div class="modal-header">
        <span class="modal-title" id="audioImportModalTitle">${escapeHtml(t('audioImportModalTitle'))}</span>
        <button type="button" class="modal-close" data-act="close-audio-import"><span class="icon-chip" style="width:22px; height:22px;"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></span></button>
      </div>
      <div class="hint">${escapeHtml(t('audioImportHint'))}</div>
      <div id="audioImportStep1">
        <input type="file" id="audioFileInput" accept="video/*,audio/*">
      </div>
      <div id="audioImportStep2" style="display:none;">
        <div class="hint" style="margin-top:10px;">${escapeHtml(t('audioDetectHint'))}</div>
        <div class="bpm-row" style="margin-top:8px;">
          <label>${escapeHtml(t('pitchLabel'))}</label>
          <select id="audioPitchSelect">${PITCHES.map(p => `<option value="${p}">${p}</option>`).join('')}</select>
        </div>
        <div class="sensitivity-row">
          <label>${escapeHtml(t('sensitivityLabel'))}</label>
          <input type="range" id="audioSensitivity" min="10" max="80" value="30">
        </div>
        <button type="button" class="action-btn primary" data-act="start-audio-analysis">${escapeHtml(t('startAudioAnalysisBtn'))}</button>
      </div>
      <div id="audioImportStep3" style="display:none;">
        <div class="hint">${escapeHtml(t('audioAnalyzingHint'))}</div>
        <div class="video-progress-bar"><div class="video-progress-fill" id="audioProgressFill"></div></div>
        <div id="audioProgressText" class="hint"></div>
        <button type="button" class="action-btn secondary" data-act="cancel-audio-analysis">${escapeHtml(t('cancelRetryBtn'))}</button>
      </div>
      <div id="audioImportStatus" class="status-msg"></div>
    </div>
  </div>`;
}
function renderImageImportModal() {
  return `
  <div class="modal-overlay" id="imageImportModal">
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="imageImportModalTitle" tabindex="-1">
      <div class="modal-header">
        <span class="modal-title" id="imageImportModalTitle">${escapeHtml(t('imageImportModalTitle'))}</span>
        <button type="button" class="modal-close" data-act="close-image-import"><span class="icon-chip" style="width:22px; height:22px;"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></span></button>
      </div>
      <div class="hint">${t('imageImportHint')}</div>
      <div id="imageImportStep1">
        <input type="file" id="imageFileInput" accept="image/*" multiple>
        <div id="imageImportFileList" class="hint" style="margin-top:8px;"></div>
        <button type="button" class="action-btn primary" data-act="start-image-analysis">${escapeHtml(t('startImageAnalysisBtn'))}</button>
      </div>
      <div id="imageImportStep2" style="display:none;">
        <div class="hint">${escapeHtml(t('imageAnalyzingHint'))}</div>
        <div class="video-progress-bar"><div class="video-progress-fill" id="imageProgressFill"></div></div>
        <div id="imageProgressText" class="hint"></div>
        <button type="button" class="action-btn secondary" data-act="cancel-image-analysis">${escapeHtml(t('cancelRetryBtn'))}</button>
      </div>
      <div id="imageImportStatus" class="status-msg"></div>
    </div>
  </div>`;
}
function renderMidiImportModal() {
  return `
  <div class="modal-overlay" id="midiImportModal">
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="midiImportModalTitle" tabindex="-1">
      <div class="modal-header">
        <span class="modal-title" id="midiImportModalTitle">${escapeHtml(t('midiImportModalTitle'))}</span>
        <button type="button" class="modal-close" data-act="close-midi-import"><span class="icon-chip" style="width:22px; height:22px;"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></span></button>
      </div>
      <div class="hint">${escapeHtml(t('midiImportHint'))}</div>
      <input type="file" id="midiFileInput" accept=".mid,.midi,audio/midi,audio/x-midi">
      <div id="midiImportStatus" class="status-msg"></div>
    </div>
  </div>`;
}
function renderConfirmModal() {
  return `
  <div class="modal-overlay" id="confirmModal">
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="confirmModalTitle" tabindex="-1">
      <div class="modal-header">
        <span class="modal-title" id="confirmModalTitle">${escapeHtml(t('confirmModalTitle'))}</span>
        <button type="button" class="modal-close" data-act="close-confirm"><span class="icon-chip" style="width:22px; height:22px;"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></span></button>
      </div>
      <div class="hint" id="confirmModalMessage"></div>
      <button type="button" class="action-btn secondary" id="confirmModalOkBtn" data-act="confirm-ok" style="background:var(--red-btn); color:#fff; border-color:var(--red-btn);"></button>
      <button type="button" class="action-btn secondary" data-act="close-confirm">${escapeHtml(t('cancelBtn'))}</button>
    </div>
  </div>`;
}
function renderKeyBindModal() {
  return `
  <div class="modal-overlay" id="keyBindModal">
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="keyBindModalTitle" tabindex="-1">
      <div class="modal-header">
        <span class="modal-title" id="keyBindModalTitle">${escapeHtml(t('keyBindModalTitle'))}</span>
        <button type="button" class="modal-close" data-act="close-key-bind-modal"><span class="icon-chip" style="width:22px; height:22px;"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></span></button>
      </div>
      <div class="hint">${escapeHtml(t('keyBindHint'))}</div>
      <div class="keybind-list" id="keyBindList"></div>
      <button type="button" class="action-btn secondary" data-act="reset-key-bindings">${escapeHtml(t('resetKeyBindingsBtn'))}</button>
    </div>
  </div>`;
}
function renderPerfOverlay() {
  return `
  <div class="perf-overlay" id="perfOverlay">
    <div class="perf-header">
      <div style="display:flex; gap:6px;">
        <button type="button" class="perf-close" id="perfCloseBtn" data-act="close-performance">${escapeHtml(t('perfCloseEnd'))}</button>
        <button type="button" class="perf-close" data-act="open-key-bind-modal" title="${escapeHtml(t('keySettingsBtn'))}"><svg class="inline-icon" width="16" height="16"><use href="#ts-i-keyboard"/></svg></button>
      </div>
      <div class="perf-title" id="perfTitle"></div>
      <div class="perf-progress" id="perfProgress"></div>
    </div>
    <div class="perf-instrument-row" id="perfInstrumentRow" style="display:none;"></div>
    <div class="perf-grid" id="perfGrid"></div>
    <div class="perf-footer" id="perfFooter"></div>
  </div>`;
}
function renderComposeOverlay() {
  return `
  <div class="compose-overlay" id="composeOverlay">
    <div class="compose-header">
      <button type="button" class="compose-close" data-act="switch-view" data-view="library" title="${escapeHtml(t('composeCloseTitle'))}" aria-label="${escapeHtml(t('composeCloseTitle'))}"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></button>
      <input type="text" id="songNameInput" class="compose-title-input" placeholder="${escapeHtml(t('songNamePlaceholder'))}">
      <div class="compose-header-actions">
        <button type="button" class="transport-btn primary" id="playBtn" data-act="toggle-playback">${escapeHtml(t('playBtn'))}</button>
        <button type="button" class="transport-btn" id="stopBtn" data-act="stop-playback" style="display:none;">${escapeHtml(t('stopBtn'))}</button>
        <button type="button" class="compose-tools-btn" data-act="open-modal" data-modal="composeToolsModal" title="${escapeHtml(t('composeToolsBtnTitle'))}" aria-label="${escapeHtml(t('composeToolsModalTitle'))}"><svg class="inline-icon" width="16" height="16"><use href="#ts-i-hammer"/></svg></button>
      </div>
    </div>

    <div class="last-result-row" id="lastResultRow"></div>

    <div class="compose-timeline-head">
      <span class="compose-timeline-label">${escapeHtml(t('frameSectionLabel'))}</span>
      <div class="compose-timeline-actions">
        <div class="timeline-view-tabs" role="group" aria-label="${escapeHtml(t('timelineViewGroupLabel'))}">
          <button type="button" class="timeline-view-tab" data-view="tile" data-act="set-timeline-view" title="${escapeHtml(t('timelineViewTileTitle'))}">${escapeHtml(t('timelineViewTile'))}</button>
          <button type="button" class="timeline-view-tab" data-view="column" data-act="set-timeline-view" title="${escapeHtml(t('timelineViewColumnTitle'))}">${escapeHtml(t('timelineViewColumn'))}</button>
        </div>
        <button type="button" class="mini-btn undo-edit-btn" data-act="undo-edit" disabled>${escapeHtml(t('undoEditBtn'))}</button>
      </div>
    </div>
    <div class="frame-strip compose-timeline view-tile" id="frameStrip"></div>

    <div class="compose-input-row compose-input-area">
      <div class="compose-side-rail rail-left">
        <button type="button" class="rail-btn" data-act="select-prev-frame" title="${escapeHtml(t('railPrevFrameTitle'))}" aria-label="${escapeHtml(t('railPrevFrameTitle'))}"><svg class="inline-icon" width="16" height="16"><use href="#ts-i-chevron-left"/></svg></button>
        <button type="button" class="rail-btn undo-edit-btn" data-act="undo-edit" disabled title="${escapeHtml(t('undoEditBtnTitle'))}" aria-label="${escapeHtml(t('undoEditBtnTitle'))}"><svg class="inline-icon" width="16" height="16"><use href="#ts-i-undo"/></svg></button>
        <button type="button" class="rail-btn danger" data-act="delete-frame-range" title="${escapeHtml(t('railDeleteRangeTitle'))}" aria-label="${escapeHtml(t('railDeleteRangeTitle'))}"><svg class="inline-icon" width="16" height="16"><use href="#i-trash"/></svg></button>
      </div>
      <div class="current-frame-card">
        <div class="current-frame-head">
          <div class="current-frame-label">${escapeHtml(t('currentFrameLabel'))}</div>
          <div class="current-frame-controls">
            <div class="input-mode-tabs">
              <button type="button" class="input-mode-tab" data-mode="grid" data-act="set-input-mode">${escapeHtml(t('inputModeGrid'))}</button>
              <button type="button" class="input-mode-tab" data-mode="piano" data-act="set-input-mode">${escapeHtml(t('inputModePiano'))}</button>
              <button type="button" class="input-mode-tab" data-mode="staff" data-act="set-input-mode">${escapeHtml(t('inputModeStaff'))}</button>
            </div>
          </div>
        </div>
        <div class="frame-bpm-row" id="frameBpmRow">
          <label class="frame-bpm-toggle">
            <input type="checkbox" id="frameBpmOverrideToggle">
            <span>${escapeHtml(t('frameBpmOverrideLabel'))}</span>
          </label>
          <input type="number" id="frameBpmOverrideValue" min="40" max="999" style="display:none;">
        </div>
        <div class="big-grid" id="bigGrid"></div>
        <div class="piano-keys-wrap" id="pianoKeysWrap" style="display:none;">
          <div class="piano-keys" id="pianoKeys"></div>
          <div class="piano-hint">${escapeHtml(t('pianoWhiteKeysHint'))}</div>
        </div>
        <div class="staff-wrap" id="staffWrap" style="display:none;">
          <svg id="staffSvg" class="staff-svg" viewBox="0 0 170 162"></svg>
          <div class="piano-hint">${escapeHtml(t('staffClickHint'))}</div>
        </div>
      </div>
      <div class="compose-side-rail rail-right">
        <button type="button" class="rail-btn" data-act="select-next-frame" title="${escapeHtml(t('railNextFrameTitle'))}" aria-label="${escapeHtml(t('railNextFrameTitle'))}"><svg class="inline-icon" width="16" height="16"><use href="#ts-i-chevron-right"/></svg></button>
        <button type="button" class="rail-btn redo-edit-btn" data-act="redo-edit" disabled title="${escapeHtml(t('redoEditBtnTitle'))}" aria-label="${escapeHtml(t('redoEditBtnTitle'))}"><svg class="inline-icon" width="16" height="16"><use href="#ts-i-redo"/></svg></button>
        <button type="button" class="rail-btn" data-act="copy-frame-range" title="${escapeHtml(t('railCopyRangeTitle'))}" aria-label="${escapeHtml(t('railCopyRangeTitle'))}"><svg class="inline-icon" width="16" height="16"><use href="#ts-i-duplicate"/></svg></button>
        <button type="button" class="rail-btn paste-frame-btn" data-act="paste-frame-range" disabled title="${escapeHtml(t('railPasteRangeTitle'))}" aria-label="${escapeHtml(t('railPasteRangeTitle'))}"><svg class="inline-icon" width="16" height="16"><use href="#ts-i-download"/></svg></button>
      </div>
    </div>

    <div class="compose-bpm-footer">
      <div class="compose-bpm-row bpm-row compact">
        <label>BPM</label>
        <input type="range" id="bpmSlider" min="40" max="999" value="150">
        <input type="number" id="bpmNumber" min="40" max="999" value="150">
      </div>
    </div>
  </div>`;
}
function renderComposeToolsModal() {
  return `
  <div class="modal-overlay" id="composeToolsModal">
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="composeToolsModalTitle" tabindex="-1">
      <div class="modal-header">
        <span class="modal-title" id="composeToolsModalTitle">${escapeHtml(t('composeToolsModalTitle'))}</span>
        <button type="button" class="modal-close" data-act="close-modal" data-modal="composeToolsModal" aria-label="${escapeHtml(t('cancelBtn'))}"><span class="icon-chip" style="width:22px; height:22px;"><svg class="inline-icon" width="16" height="16"><use href="#i-close"/></svg></span></button>
      </div>

      <div class="compose-tools-section">
        <div class="editor-top-row" style="margin-bottom:0;">
          <select id="songPitchInput"></select>
          <select id="songInstrumentInput">
            ${Object.keys(INSTRUMENT_LABELS).map(code => `<option value="${code}">${escapeHtml(t('instrument' + code))}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="compose-tools-section">
        <div class="tap-tempo-row" style="margin-bottom:10px;">
          <button type="button" class="tap-tempo-btn" id="tapTempoBtn" data-act="tap-tempo">${escapeHtml(t('tapTempoBtn'))}</button>
          <span class="tap-tempo-hint" id="tapTempoHint">${escapeHtml(t('tapTempoHint'))}</span>
        </div>
        <label class="metronome-row" style="margin-bottom:0;">
          <input type="checkbox" id="metronomeToggle">
          <span>${escapeHtml(t('metronomeToggleLabel'))}</span>
        </label>
      </div>

      <div class="compose-tools-section">
        <p class="compose-tools-section-label">${escapeHtml(t('practiceRangeLabel'))}</p>
        <div class="practice-range-row">
          <input type="number" id="practiceRangeStart" min="1" value="1">
          <span class="range-sep">〜</span>
          <input type="number" id="practiceRangeEnd" min="1" value="1">
          <span class="range-unit">${escapeHtml(t('rangeUnit'))}</span>
          <button type="button" class="mini-btn" data-act="copy-frame-range">${escapeHtml(t('copyFrameRangeBtn'))}</button>
        </div>
        <label class="metronome-row">
          <input type="checkbox" id="loopRangeToggle">
          <span>${escapeHtml(t('loopRangeToggleLabel'))}</span>
        </label>
        <label class="metronome-row" style="margin-bottom:0;">
          <input type="checkbox" id="noScrollToggle">
          <span>${escapeHtml(t('noScrollToggleLabel'))}</span>
        </label>
        <div class="frame-clipboard-row" style="margin-top:10px; margin-bottom:0;">
          <button type="button" class="mini-btn paste-frame-btn" data-act="paste-frame-range" disabled>${escapeHtml(t('pasteFrameRangeBtn'))}</button>
          <span class="frame-clipboard-hint" id="frameClipboardHint"></span>
        </div>
      </div>

      <div class="compose-tools-section" style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:0;">
        <button type="button" class="transport-btn" data-act="compose-tools-switch" data-target="practice">${escapeHtml(t('practiceModeBtn'))}</button>
        <button type="button" class="transport-btn" data-act="compose-tools-switch" data-target="test">${escapeHtml(t('testModeBtn'))}</button>
        <button type="button" class="transport-btn" data-act="compose-tools-switch" data-target="share">${escapeHtml(t('shareBtn'))}</button>
        <button type="button" class="transport-btn" data-act="compose-tools-switch" data-target="keybind">${escapeHtml(t('keySettingsBtn'))}</button>
      </div>
    </div>
  </div>`;
}

/* ================================================================
   称号（実績）の描画・ヒーローバナー更新
   ================================================================ */
function renderTitles() {
  const row = document.getElementById('titlesChipRow');
  const countEl = document.getElementById('titlesCount');
  if (!row) return;
  const d = S.loadTitlesData();
  const earnedIds = new Set(d.earned.map(e => e.id));
  if (countEl) countEl.textContent = t('titlesCountTemplate', { earned: earnedIds.size, total: S.TITLES.length });
  row.innerHTML = S.TITLES.map(ti => {
    if (!earnedIds.has(ti.id)) {
      return `<span class="title-chip locked" title="${escapeHtml(t('titleLockedHint'))}"><span class="title-chip-icon"><svg class="inline-icon" width="13" height="13"><use href="#ts-i-lock"/></svg></span>${escapeHtml(t('titleLockedName'))}</span>`;
    }
    return `<span class="title-chip" title="${escapeHtml(t(ti.descKey))}"><span class="title-chip-icon"><svg class="inline-icon" width="15" height="15"><use href="#${ti.icon}"/></svg></span>${escapeHtml(t(ti.nameKey))}</span>`;
  }).join('');
  const songsValEl = document.getElementById('heroSongsVal');
  const practiceValEl = document.getElementById('heroPracticeVal');
  if (songsValEl) songsValEl.textContent = d.songsCreatedTotal;
  if (practiceValEl) practiceValEl.textContent = d.practiceCountTotal;
}
function announceNewTitles(newlyEarned) {
  if (!newlyEarned || !newlyEarned.length) return;
  newlyEarned.forEach(ti => showToast(t('titleUnlockedToast', { name: t(ti.nameKey) })));
  renderTitles();
}

/* ================================================================
   ライブラリ
   ================================================================ */
let librarySort = S.loadLibrarySort();
function onLibrarySortChange(v) {
  librarySort = S.LIBRARY_SORT_MODES.includes(v) ? v : 'updated';
  S.saveLibrarySort(librarySort);
  renderLibrary();
}
function clearLibraryFilters() {
  const searchInput = document.getElementById('librarySearch');
  if (searchInput) searchInput.value = '';
  librarySort = 'updated';
  S.saveLibrarySort(librarySort);
  renderLibrary();
}
function getSortedFilteredSongs() {
  const q = (document.getElementById('librarySearch').value || '').trim().toLowerCase();
  let songs = S.sortSongs(S.loadSongs(), librarySort);
  if (q) songs = songs.filter(s => s.name.toLowerCase().includes(q));
  return songs;
}
function renderLibrary() {
  const sortSelect = document.getElementById('librarySortSelect');
  if (sortSelect) sortSelect.value = librarySort;
  const hasAnySongs = S.loadSongs().length > 0;
  const songs = getSortedFilteredSongs();
  const container = document.getElementById('songList');
  if (!container) return;
  if (songs.length === 0) {
    container.innerHTML = hasAnySongs
      ? `<div class="empty-state">${escapeHtml(t('noSearchResultsText'))}</div>`
      : `<div class="empty-state">${escapeHtml(t('emptyLibraryText'))}<br><br>
        <button type="button" class="mini-btn primary" data-act="open-modal" data-modal="importModal">${escapeHtml(t('importModalTitle'))}</button></div>`;
    return;
  }
  container.innerHTML = songs.map(s => {
    const noteCount = S.songNoteCount(s);
    const d = new Date(s.updatedAt);
    const dateStr = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    return `
      <div class="song-card" data-song-id="${s.id}">
        <div class="song-card-head">
          <div>
            <div class="song-card-name">${escapeHtml(s.name || t('untitledSong'))}</div>
            <div class="song-card-meta">${escapeHtml(t('songCardMeta', { frames: s.frames.length, notes: noteCount, bpm: s.bpm, date: dateStr }))}</div>
          </div>
        </div>
        <div class="song-card-btns">
          <button type="button" class="mini-btn primary" data-act="open-editor" data-id="${s.id}">${escapeHtml(t('openBtn'))}</button>
          <button type="button" class="mini-btn" data-act="duplicate-song" data-id="${s.id}">${escapeHtml(t('duplicateBtn'))}</button>
          <button type="button" class="mini-btn danger" data-act="delete-song" data-id="${s.id}">${escapeHtml(t('deleteBtn'))}</button>
        </div>
      </div>`;
  }).join('');
}
function exportLibraryAsTextSheets() {
  const songs = S.sortSongs(S.loadSongs(), librarySort);
  if (songs.length === 0) { showToast(t('noSongToast')); return; }
  const SEP = '\n\n' + '─'.repeat(32) + '\n\n';
  const text = songs.map(s => S.songToTextSheet(s)).join(SEP);
  const dateStr = new Date().toISOString().slice(0, 10);
  S.downloadBlob(text, `tai-score-library_${dateStr}.txt`, 'text/plain');
  showToast(t('downloadedToast'));
}

let creatingNewSongLock = false;
function createNewSong() {
  if (creatingNewSongLock) return;
  creatingNewSongLock = true;
  setTimeout(() => { creatingNewSongLock = false; }, 1500);

  RT.currentSong = {
    id: S.genId(), name: t('newSongName'), bpm: 150, pitch: 'C', instrument: 'Harp',
    frames: [[], [], [], [], [], [], [], []], updatedAt: Date.now(),
  };
  RT.selectedFrameIndex = 0;
  const songs = S.loadSongs();
  songs.unshift(RT.currentSong);
  S.saveSongs(songs);
  announceNewTitles(S.recordSongCreated());
  openEditor(RT.currentSong.id);
}
function openEditor(id) {
  const songs = S.loadSongs();
  const song = songs.find(s => s.id === id);
  if (!song) return;
  RT.currentSong = song;
  RT.selectedFrameIndex = 0;
  switchView('editor');
  E.renderEditor();
}
function focusLibraryFallback() {
  const first = document.querySelector('#songList .mini-btn') || document.getElementById('librarySearch');
  if (first) first.focus();
}
function focusLibraryRowNear(index) {
  const cards = document.querySelectorAll('#songList .song-card');
  if (cards.length === 0) { focusLibraryFallback(); return; }
  const card = cards[Math.max(0, Math.min(index, cards.length - 1))];
  const btn = card.querySelector('.mini-btn.danger') || card.querySelector('.mini-btn');
  if (btn) btn.focus(); else focusLibraryFallback();
}
function focusSongCardButton(songId, selector) {
  const card = document.querySelector(`#songList .song-card[data-song-id="${songId}"]`);
  const btn = card && card.querySelector(selector);
  if (btn) { btn.focus(); return true; }
  return false;
}
function deleteSong(id) {
  showConfirm(t('deleteSongConfirm'), () => {
    const idx = getSortedFilteredSongs().findIndex(s => s.id === id);
    S.saveSongs(S.loadSongs().filter(s => s.id !== id));
    if (RT.currentSong && RT.currentSong.id === id) RT.currentSong = null;
    renderLibrary();
    showToast(t('deletedToast'));
    focusLibraryRowNear(idx);
  }, t('deleteConfirmBtn'));
}
let duplicatingSongLock = false;
function duplicateSong(id) {
  if (duplicatingSongLock) return;
  duplicatingSongLock = true;
  setTimeout(() => { duplicatingSongLock = false; }, 1500);

  const songs = S.loadSongs();
  const song = songs.find(s => s.id === id);
  if (!song) return;
  const clone = JSON.parse(JSON.stringify(song));
  clone.id = S.genId();
  clone.name = song.name + t('duplicateSuffix');
  clone.updatedAt = Date.now();
  delete clone.lastPracticeResult;
  delete clone.lastTestResult;
  songs.unshift(clone);
  S.saveSongs(songs);
  announceNewTitles(S.recordSongCreated());
  announceNewTitles(S.recordNoteCount(S.songNoteCount(clone)));
  renderLibrary();
  showToast(t('duplicatedToast'));
  if (!focusSongCardButton(clone.id, '.mini-btn.primary')) focusLibraryFallback();
}

function switchView(view) {
  closeOtherTopLevelOverlays();
  document.getElementById('viewLibrary').classList.toggle('active', view === 'library');
  document.getElementById('viewEditor').classList.toggle('active', view === 'editor');
  document.getElementById('tabLibraryBtn').classList.toggle('active', view === 'library');
  document.getElementById('tabEditorBtn').classList.toggle('active', view === 'editor');
  if (view === 'library') { E.stopPlayback(); E.closeComposeMode(); RT.currentSong = null; renderLibrary(); return; }
  if (view === 'editor' && !RT.currentSong) {
    const songs = S.loadSongs();
    if (songs.length > 0) openEditor(S.sortSongs(songs, 'updated')[0].id);
    else createNewSong();
    return;
  }
  if (view === 'editor') { E.renderEditor(); E.openComposeMode(); }
}

/* ================================================================
   共有・保存モーダル
   ================================================================ */
function resetShareModalOutputs() {
  RT.lastShareCode = null;
  const outputEl = document.getElementById('shareOutputArea');
  const textEl = document.getElementById('shareTextArea');
  const statusEl = document.getElementById('shareStatus');
  if (outputEl) outputEl.innerHTML = '';
  if (textEl) textEl.innerHTML = '';
  if (statusEl) { statusEl.textContent = ''; statusEl.className = 'status-msg'; }
}
async function generateShareCode() {
  const statusEl = document.getElementById('shareStatus');
  const outputEl = document.getElementById('shareOutputArea');
  statusEl.textContent = '';
  try {
    RT.lastShareCode = await S.encodeShareCode({ kind: 'tai-score-song', v: 1, song: S.stripPersonalPracticeData(RT.currentSong) });
    outputEl.innerHTML = `
      <textarea class="code-box" id="shareCodeOutput" readonly data-act="select-all">${escapeHtml(RT.lastShareCode)}</textarea>
      <button type="button" class="action-btn secondary" data-act="copy-share-code">${escapeHtml(t('copyShareCodeBtn'))}</button>`;
  } catch (e) {
    statusEl.className = 'status-msg err';
    statusEl.textContent = t('codeGenFailed');
  }
}
async function copyShareCode() {
  const ta = document.getElementById('shareCodeOutput');
  if (!ta) return;
  ta.select();
  const statusEl = document.getElementById('shareStatus');
  try {
    await navigator.clipboard.writeText(ta.value);
    statusEl.className = 'status-msg ok';
    statusEl.textContent = t('copySuccessShare');
  } catch (e) {
    statusEl.className = 'status-msg err';
    statusEl.textContent = t('copyFailedShare');
  }
}
function generateTextSheet() {
  const text = S.songToTextSheet(RT.currentSong);
  document.getElementById('shareTextArea').innerHTML = `
    <textarea class="code-box" id="shareTextOutput" readonly data-act="select-all" style="min-height:130px; font-family:monospace;">${escapeHtml(text)}</textarea>
    <button type="button" class="action-btn secondary" data-act="copy-text-sheet">${escapeHtml(t('copyTextBtn'))}</button>
    <button type="button" class="action-btn secondary" data-act="download-text-sheet">${escapeHtml(t('downloadTextBtn'))}</button>`;
}
async function copyTextSheet() {
  const ta = document.getElementById('shareTextOutput');
  if (!ta) return;
  ta.select();
  const statusEl = document.getElementById('shareStatus');
  try {
    await navigator.clipboard.writeText(ta.value);
    statusEl.className = 'status-msg ok';
    statusEl.textContent = t('copySuccessText');
  } catch (e) {
    statusEl.className = 'status-msg err';
    statusEl.textContent = t('copyFailedText');
  }
}
function downloadTextSheet() {
  S.downloadBlob(S.songToTextSheet(RT.currentSong), `${S.sanitizeFilename(RT.currentSong.name || 'song')}.txt`, 'text/plain');
  showToast(t('downloadedToast'));
}
function downloadNativeFile() {
  S.downloadBlob(JSON.stringify({ kind: 'tai-score-song', v: 1, song: S.stripPersonalPracticeData(RT.currentSong) }, null, 1),
    `${S.sanitizeFilename(RT.currentSong.name || 'song')}.taiscore.json`, 'application/json');
  showToast(t('downloadedToast'));
}
function downloadSpecyFile() {
  S.downloadBlob(JSON.stringify(S.songToSpecyFormat(RT.currentSong), null, 1),
    `${S.sanitizeFilename(RT.currentSong.name || 'song')}.json`, 'application/json');
  showToast(t('downloadedToast'));
}

/* ================================================================
   インポート（共有コード・テキスト譜面・ファイル）
   ================================================================ */
async function importFromCode() {
  const statusEl = document.getElementById('importStatus');
  const code = document.getElementById('importCodeInput').value.trim();
  if (!code) return;
  try {
    if (S.isAbcTextSheet(code)) {
      finishImport(S.textSheetToSong(code), statusEl, '');
      return;
    }
    let payload;
    try {
      payload = await S.decodeShareCode(code);
    } catch (e) {
      payload = JSON.parse(code);
    }
    const { songs, extraNote } = S.pickImportableSongs(payload);
    finishImport(songs, statusEl, extraNote);
  } catch (e) {
    statusEl.className = 'status-msg err';
    statusEl.textContent = t('importFailedCode');
  }
}
function importFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById('importStatus');
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = S.decodeFileBuffer(reader.result);
      let songs, extraNote = '';
      if (S.isAbcTextSheet(text)) {
        songs = [S.textSheetToSong(text)];
      } else {
        const parsed = JSON.parse(text);
        ({ songs, extraNote } = S.pickImportableSongs(parsed));
      }
      finishImport(songs, statusEl, extraNote);
    } catch (e) {
      statusEl.className = 'status-msg err';
      statusEl.textContent = t('importFailedFile');
    }
  };
  reader.readAsArrayBuffer(file);
  event.target.value = '';
}
function finishImport(songOrSongs, statusEl, extraNote, modalId) {
  modalId = modalId || 'importModal';
  const newSongs = Array.isArray(songOrSongs) ? songOrSongs : [songOrSongs];
  newSongs.forEach(song => { if (!song.frames || song.frames.length === 0) song.frames = [[]]; });
  const songs = S.loadSongs();
  songs.unshift(...newSongs);
  S.saveSongs(songs);
  newSongs.forEach(song => {
    announceNewTitles(S.recordSongCreated());
    announceNewTitles(S.recordNoteCount(S.songNoteCount(song)));
  });
  statusEl.className = 'status-msg ok';
  statusEl.textContent = t('importedSongStatus', { name: newSongs[0].name, note: extraNote || '' });
  if (modalId === 'importModal') {
    const codeInput = document.getElementById('importCodeInput');
    if (codeInput) codeInput.value = '';
  }
  setTimeout(() => {
    closeModal(modalId);
    openEditor(newSongs[0].id);
    const nameInput = document.getElementById('songNameInput');
    if (nameInput) nameInput.focus();
  }, 700);
}

/* ================================================================
   音声から楽譜を作成
   ================================================================ */
function closeAudioImportModal() {
  RT.audioAnalysisCancelled = true;
  closeModal('audioImportModal');
}
function openAudioImportModal() {
  document.getElementById('audioImportStep1').style.display = 'block';
  document.getElementById('audioImportStep2').style.display = 'none';
  document.getElementById('audioImportStep3').style.display = 'none';
  const statusEl = document.getElementById('audioImportStatus');
  statusEl.textContent = '';
  statusEl.className = 'status-msg';
  openModal('audioImportModal');
}
function onAudioFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;
  RT.audioImportFile = file;
  document.getElementById('audioImportStep1').style.display = 'none';
  document.getElementById('audioImportStep2').style.display = 'block';
  event.target.value = '';
}
function cancelAudioAnalysis() {
  RT.audioAnalysisCancelled = true;
  document.getElementById('audioImportStep3').style.display = 'none';
  document.getElementById('audioImportStep2').style.display = 'block';
}
async function startAudioAnalysis() {
  RT.audioAnalysisCancelled = false;
  document.getElementById('audioImportStep2').style.display = 'none';
  document.getElementById('audioImportStep3').style.display = 'block';
  const progressFill = document.getElementById('audioProgressFill');
  const progressText = document.getElementById('audioProgressText');
  progressFill.style.width = '0%';
  progressText.textContent = t('audioLoadingText');
  const statusEl = document.getElementById('audioImportStatus');
  const backToStep2 = (message) => {
    document.getElementById('audioImportStep3').style.display = 'none';
    document.getElementById('audioImportStep2').style.display = 'block';
    statusEl.className = 'status-msg err';
    statusEl.textContent = message;
  };

  const pitch = document.getElementById('audioPitchSelect').value || 'C';
  const sensitivityValue = parseFloat(document.getElementById('audioSensitivity').value);

  let result;
  try {
    result = await AudioImport.analyzeAudioFile({
      file: RT.audioImportFile,
      pitch,
      sensitivityValue,
      onProgress: (pct, count) => {
        progressFill.style.width = pct + '%';
        progressText.textContent = pct < 100
          ? t('detectedCountProgress', { pct, count })
          : t('analysisCompleteCount', { count });
      },
      isCancelled: () => RT.audioAnalysisCancelled,
    });
  } catch (e) {
    backToStep2(t('audioExtractFailed'));
    return;
  }
  if (RT.audioAnalysisCancelled || !result) return;

  const song = {
    id: S.genId(),
    name: (RT.audioImportFile && RT.audioImportFile.name) ? RT.audioImportFile.name.replace(/\.[^.]+$/, '') : t('audioDefaultSongName'),
    bpm: result.bpm, pitch, instrument: 'Harp', frames: result.frames, updatedAt: Date.now(),
  };
  finishImport(song, statusEl, t('autoAnalysisNote'), 'audioImportModal');
}

/* ================================================================
   楽譜画像から楽譜を作成
   ================================================================ */
function closeImageImportModal() {
  RT.imageAnalysisCancelled = true;
  closeModal('imageImportModal');
}
function openImageImportModal() {
  RT.imageImportFiles = [];
  document.getElementById('imageFileInput').value = '';
  document.getElementById('imageImportFileList').textContent = '';
  document.getElementById('imageImportStep1').style.display = 'block';
  document.getElementById('imageImportStep2').style.display = 'none';
  const statusEl = document.getElementById('imageImportStatus');
  statusEl.textContent = '';
  statusEl.className = 'status-msg';
  openModal('imageImportModal');
}
function cancelImageAnalysis() {
  RT.imageAnalysisCancelled = true;
  document.getElementById('imageImportStep2').style.display = 'none';
  document.getElementById('imageImportStep1').style.display = 'block';
}
function onImageFilesSelected(event) {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;
  RT.imageImportFiles = files;
  const sep = CURRENT_LANG === 'en' ? ', ' : '、';
  document.getElementById('imageImportFileList').textContent =
    t('imageSelectedCount', { n: files.length, names: files.map(f => f.name).join(sep) });
}
async function startImageAnalysis() {
  RT.imageAnalysisCancelled = false;
  if (RT.imageImportFiles.length === 0) { showToast(t('noImageSelectedToast')); return; }
  document.getElementById('imageImportStep1').style.display = 'none';
  document.getElementById('imageImportStep2').style.display = 'block';
  const progressFill = document.getElementById('imageProgressFill');
  const progressText = document.getElementById('imageProgressText');
  const statusEl = document.getElementById('imageImportStatus');
  statusEl.textContent = '';
  statusEl.className = 'status-msg';
  progressFill.style.width = '0%';

  const result = await ImageImport.analyzeImageFiles({
    files: RT.imageImportFiles,
    onProgress: (page, total) => {
      progressText.textContent = t('imageAnalyzingProgress', { page, total });
      progressFill.style.width = `${Math.round((page - 1) / total * 90)}%`;
    },
    isCancelled: () => RT.imageAnalysisCancelled,
  });
  if (RT.imageAnalysisCancelled || !result) return;
  progressFill.style.width = '100%';

  if (!result.frames) {
    document.getElementById('imageImportStep2').style.display = 'none';
    document.getElementById('imageImportStep1').style.display = 'block';
    statusEl.className = 'status-msg err';
    statusEl.textContent = result.pagesOk === 0 ? t('imageLoadFailed') : t('staffNotDetected');
    return;
  }
  const song = {
    id: S.genId(),
    name: (result.firstFileName || t('imageDefaultSongName')).replace(/\.[^.]+$/, ''),
    bpm: result.bpm, pitch: 'C', instrument: 'Harp', frames: result.frames, updatedAt: Date.now(),
  };
  finishImport(song, statusEl, t('imageAutoAnalysisNote'), 'imageImportModal');
}

/* ================================================================
   MIDIファイルから楽譜を作成
   ================================================================ */
function closeMidiImportModal() { closeModal('midiImportModal'); }
function openMidiImportModal() {
  document.getElementById('midiFileInput').value = '';
  const statusEl = document.getElementById('midiImportStatus');
  statusEl.textContent = '';
  statusEl.className = 'status-msg';
  openModal('midiImportModal');
}
async function onMidiFileSelected(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  const statusEl = document.getElementById('midiImportStatus');
  statusEl.className = 'status-msg';
  statusEl.textContent = t('midiConvertingText');
  await new Promise(resolve => setTimeout(resolve, 0));

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const { song, tempoAdjusted } = await MidiImport.convertMidiFile(reader.result, file.name, t);
      const note = t('midiAutoAnalysisNote') + (tempoAdjusted ? t('midiTempoAdjustedNote') : '');
      finishImport(song, statusEl, note, 'midiImportModal');
    } catch (e) {
      statusEl.className = 'status-msg err';
      statusEl.textContent = t(e && e.midiUserMessage ? e.midiUserMessage : 'midiParseFailed');
    }
  };
  reader.onerror = () => {
    statusEl.className = 'status-msg err';
    statusEl.textContent = t('midiParseFailed');
  };
  reader.readAsArrayBuffer(file);
}

/* ================================================================
   共有された楽譜の読み込み（tai-hubのサブルート #/tai-score/song=<code> 経由）
   移植元は自サイトのURLハッシュ `#song=<code>` を直接読んでいたが、tai-hubの
   ハッシュルーティングと衝突するため、ルーターのサブルートとして受け取る形に
   変更している（挙動・トースト文言は同一）。
   ================================================================ */
async function loadSharedSongFromSub(encoded) {
  try {
    const payload = await S.decodeShareCode(decodeURIComponent(encoded));
    if (payload && payload.kind === 'tai-score-song' && payload.song) {
      const song = payload.song;
      song.id = S.genId();
      song.updatedAt = Date.now();
      const songs = S.loadSongs();
      songs.unshift(song);
      S.saveSongs(songs);
      announceNewTitles(S.recordSongCreated());
      announceNewTitles(S.recordNoteCount(S.songNoteCount(song)));
      openEditor(song.id);
      showToast(t('sharedSongLoadedToast', { name: song.name }));
      history.replaceState(null, '', location.pathname + location.search + '#/tai-score');
    }
  } catch (e) { /* 不正なリンクは無視 */ }
}

/* ================================================================
   イベント配線
   ================================================================ */
function wireStaticEvents() {
  const $ = id => document.getElementById(id);
  $('librarySearch').addEventListener('input', () => renderLibrary());
  $('librarySortSelect').addEventListener('change', e => onLibrarySortChange(e.target.value));
  $('importFileInput').addEventListener('change', importFromFile);
  $('audioFileInput').addEventListener('change', onAudioFileSelected);
  $('imageFileInput').addEventListener('change', onImageFilesSelected);
  $('midiFileInput').addEventListener('change', onMidiFileSelected);

  $('songNameInput').addEventListener('input', () => E.onSongMetaChange());
  $('songPitchInput').addEventListener('change', () => E.onSongMetaChange());
  $('songInstrumentInput').addEventListener('change', () => E.onSongMetaChange());
  $('bpmSlider').addEventListener('input', e => E.onBpmChange(e.target.value));
  $('bpmNumber').addEventListener('input', e => E.onBpmChange(e.target.value, 'number'));
  $('bpmNumber').addEventListener('change', e => E.onBpmChange(e.target.value));
  $('frameBpmOverrideToggle').addEventListener('change', e => E.onFrameBpmOverrideToggle(e.target.checked));
  $('frameBpmOverrideValue').addEventListener('change', e => E.onFrameBpmOverrideValueChange(e.target.value));
  $('metronomeToggle').addEventListener('change', e => S.setMetronomeEnabled(e.target.checked));
  $('loopRangeToggle').addEventListener('change', e => {
    if (!RT.currentSong) return;
    RT.currentSong.loopRangeEnabled = e.target.checked;
    E.persistCurrentSong();
  });
  $('noScrollToggle').addEventListener('change', e => S.setNoScrollDuringPlaybackEnabled(e.target.checked));
  $('practiceRangeStart').addEventListener('change', () => E.onPracticeRangeChange());
  $('practiceRangeEnd').addEventListener('change', () => E.onPracticeRangeChange());
}

const COMPOSE_TOOLS_TARGETS = {
  practice: () => composeToolsSwitchTo(P.openPractice),
  test: () => composeToolsSwitchTo(P.openTestMode),
  share: () => composeToolsSwitchTo(() => openModal('shareModal')),
  keybind: () => composeToolsSwitchTo(E.openKeyBindModal),
};

function wireDelegatedEvents() {
  RT.containerEl.addEventListener('click', onContainerClick);
}
// モーダルの背景（.modal-overlay自身。中の.modal-cardではない）をクリックしたら閉じる
// （移植元の each `onclick="if(event.target===this)closeXxx()"` に相当）。
const OVERLAY_BACKDROP_CLOSE = {
  audioImportModal: closeAudioImportModal,
  imageImportModal: closeImageImportModal,
  midiImportModal: closeMidiImportModal,
  confirmModal: closeConfirm,
  keyBindModal: () => E.closeKeyBindModal(),
};
function onContainerClick(e) {
  if (e.target.classList && e.target.classList.contains('modal-overlay') && e.target.id) {
    (OVERLAY_BACKDROP_CLOSE[e.target.id] || (() => closeModal(e.target.id)))();
    return;
  }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  switch (act) {
    case 'switch-view': switchView(el.dataset.view); break;
    case 'open-free-mode': P.openFreeMode(); break;
    case 'open-modal': openModal(el.dataset.modal); break;
    case 'close-modal': closeModal(el.dataset.modal); break;
    case 'export-library-text': exportLibraryAsTextSheets(); break;
    case 'create-new-song': createNewSong(); break;
    case 'open-audio-import': openAudioImportModal(); break;
    case 'open-image-import': openImageImportModal(); break;
    case 'open-midi-import': openMidiImportModal(); break;
    case 'close-audio-import': closeAudioImportModal(); break;
    case 'close-image-import': closeImageImportModal(); break;
    case 'close-midi-import': closeMidiImportModal(); break;
    case 'start-audio-analysis': startAudioAnalysis(); break;
    case 'cancel-audio-analysis': cancelAudioAnalysis(); break;
    case 'start-image-analysis': startImageAnalysis(); break;
    case 'cancel-image-analysis': cancelImageAnalysis(); break;
    case 'clear-library-filters': clearLibraryFilters(); break;
    case 'open-editor': openEditor(el.dataset.id); break;
    case 'duplicate-song': duplicateSong(el.dataset.id); break;
    case 'delete-song': deleteSong(el.dataset.id); break;
    case 'trigger-file-input': document.getElementById(el.dataset.target).click(); break;
    case 'generate-share-code': generateShareCode(); break;
    case 'copy-share-code': copyShareCode(); break;
    case 'generate-text-sheet': generateTextSheet(); break;
    case 'copy-text-sheet': copyTextSheet(); break;
    case 'download-text-sheet': downloadTextSheet(); break;
    case 'download-native-file': downloadNativeFile(); break;
    case 'download-specy-file': downloadSpecyFile(); break;
    case 'select-all': el.select(); break;
    case 'import-from-code': importFromCode(); break;
    case 'close-confirm': closeConfirm(); break;
    case 'confirm-ok': {
      const cb = RT.confirmModalCallback;
      closeModal('confirmModal');
      RT.confirmModalCallback = null;
      if (cb) cb();
      break;
    }
    case 'close-key-bind-modal': E.closeKeyBindModal(); break;
    case 'open-key-bind-modal': E.openKeyBindModal(); break;
    case 'reset-key-bindings': E.resetKeyBindings(); break;
    case 'start-key-capture': E.startKeyCapture(parseInt(el.dataset.idx, 10)); break;
    case 'close-performance': P.closePerformance(); break;
    case 'set-free-instrument': P.setFreePlayInstrument(el.dataset.code); break;
    case 'toggle-playback': E.togglePlayback(); break;
    case 'stop-playback': E.stopPlayback(); break;
    case 'undo-edit': E.undoEdit(); break;
    case 'redo-edit': E.redoEdit(); break;
    case 'set-timeline-view': E.setTimelineView(el.dataset.view); break;
    case 'set-input-mode': E.setInputMode(el.dataset.mode); break;
    case 'toggle-note': E.toggleNote(parseInt(el.dataset.note, 10)); break;
    case 'select-frame': E.selectFrame(parseInt(el.dataset.frame, 10)); break;
    case 'delete-frame': e.stopPropagation(); E.deleteFrame(parseInt(el.dataset.frame, 10)); break;
    case 'insert-frame-after': e.stopPropagation(); E.insertBlankFrameAfter(parseInt(el.dataset.frame, 10)); break;
    case 'add-frame': E.addFrame(); break;
    case 'select-prev-frame': E.selectPrevFrame(); break;
    case 'select-next-frame': E.selectNextFrame(); break;
    case 'delete-frame-range': E.deleteFrameRange(); break;
    case 'copy-frame-range': E.copyFrameRange(); break;
    case 'paste-frame-range': E.pasteFrameRange(); break;
    case 'tap-tempo': E.tapTempo(); break;
    case 'compose-tools-switch': {
      const fn = COMPOSE_TOOLS_TARGETS[el.dataset.target];
      if (fn) fn();
      break;
    }
    default: break;
  }
}

/* ================================================================
   キーボード操作の受付（音マスの演奏・編集、←→でのマス移動、
   キー割り当てのキャプチャ）。「?」（表示設定を開く）・Escape・d/D
   （テーマ切替）はtai-hubの共有ショートカット（js/shortcuts.js）が
   既に担当しているため、ここでは扱わない。
   ================================================================ */
const NON_TEXT_INPUT_TYPES = ['checkbox', 'radio', 'range', 'color', 'button', 'submit', 'reset', 'file', 'image', 'hidden'];
function handleGlobalKeydown(e) {
  if (e.repeat) return;
  if (E.captureKeyForBinding(e)) return; // キー割り当て待ち中

  const activeEl = document.activeElement;
  const activeTag = activeEl && activeEl.tagName;
  const isTextInput = activeTag === 'INPUT' && NON_TEXT_INPUT_TYPES.indexOf((activeEl.type || '').toLowerCase()) === -1;
  const isTyping = isTextInput || activeTag === 'TEXTAREA' || activeTag === 'SELECT';
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  const anyOverlayOpen = () => !!RT.containerEl.querySelector('.modal-overlay.open');
  if (!isTyping && !anyOverlayOpen()) {
    const idx = RT.keyBindings.indexOf(S.normalizeKeyEvent(e));
    if (idx >= 0) {
      if (RT.perfMode && document.getElementById('perfOverlay').classList.contains('open')) {
        P.onPerfKeyPress(idx);
        e.preventDefault();
      } else if (RT.currentSong && document.getElementById('viewEditor').classList.contains('active')) {
        E.toggleNote(idx);
        e.preventDefault();
      }
      return;
    }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && RT.currentSong && document.getElementById('viewEditor').classList.contains('active')) {
      e.preventDefault();
      if (e.key === 'ArrowLeft') E.selectPrevFrame(); else E.selectNextFrame();
    }
  }
}
function installGlobalKeydown() {
  if (RT.listenersAttached) return;
  RT.listenersAttached = true;
  RT.boundKeydown = handleGlobalKeydown;
  document.addEventListener('keydown', RT.boundKeydown);
}

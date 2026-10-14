/* ================================================================
   サイトのURL設定（共有文・書き出しファイルに入れるURLの唯一の定義）。

   ・HUB_BASE_URL: tai-hubの公開URL（リポジトリ名を tai-hub に改名した後のURL）。
   ・USE_HUB_SHARE_URLS: 完全に移行するまでは false のまま。false の間、共有文のURLは
     従来どおり各ツールの旧サイトのURLを出す（旧サイトがまだ生きているため）。
     移行する日にここを true にするだけで、全ツールの共有文が tai-hub のURL
     （例: https://taipak5000.github.io/tai-hub/#/emote）に切り替わる。
   ================================================================ */
export const HUB_BASE_URL = 'https://taipak5000.github.io/tai-hub/';
export const USE_HUB_SHARE_URLS = false;

// ツールID（ルート名）→ 旧サイトのURL
const LEGACY_URLS = {
  item: 'https://taipak5000.github.io/tai-item/',
  emote: 'https://taipak5000.github.io/tai-emote/',
  share: 'https://taipak5000.github.io/share/',
  'tai-nomacan': 'https://taipak5000.github.io/tai-nomacan/',
  'star-candle': 'https://taipak5000.github.io/star-candle/',
  companion: 'https://taipak5000.github.io/companion/',
  wings: 'https://taipak5000.github.io/wings/',
  'spirit-catalog': 'https://taipak5000.github.io/tai-catalog/',
  'tai-revisit': 'https://taipak5000.github.io/tai-revisit/',
  'tai-score': 'https://taipak5000.github.io/tai-score/',
  'tai-card': 'https://taipak5000.github.io/tai-card/',
  'data-transfer': 'https://taipak5000.github.io/tai-transfer/',
  'tai-info': 'https://taipak5000.github.io/tai-info/',
  profile: 'https://taipak5000.github.io/skyzztai-profile/',
};

/** 共有文・書き出しに入れる、そのツールのURL */
export function toolShareUrl(toolId) {
  if (USE_HUB_SHARE_URLS) return HUB_BASE_URL + '#/' + toolId;
  return LEGACY_URLS[toolId] || HUB_BASE_URL;
}

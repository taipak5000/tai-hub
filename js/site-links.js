/* ================================================================
   🧭 「関連ツール」一覧（「他のツール」引き出し）。
   一覧の元データは js/site-links-data.js（tai-hubが唯一の編集元）。以前は
   https://taipak5000.github.io/tai-item/site-links.json を起動のたびに取得していたが、
   独立サイトを閉じても動くよう同梱データに切り替えた（取得失敗で一覧が空になることが無い）。
   ※ルート名(#/<id>)はデータの id と一致させてある。ROUTESに無いidは旧サイトのURLへ
     フォールバックする。
   ================================================================ */
import { ROUTES } from './router-registry.js';
import { SITE_LINK_TOOLS } from './site-links-data.js';

// 非公開のため一覧データ(site-links-data.js)には載せていない、tai-hub内でだけ使うツール。
// afterId の直後に差し込む。
const HUB_ONLY_TOOLS = [
  { id: 'tai-nomacan-pro', afterId: 'tai-nomacan', icon: 'i-compass', ja: 'ノマキャン計算機プロ', en: 'Candle Calculator Pro', badgeTest: true },
];

let tools = null;

/** 起動時に呼ぶ（同梱データをそのまま使う） */
export function initSiteLinks() {
  tools = SITE_LINK_TOOLS;
}

/** 以前はネットワークから最新の一覧を取得していた。今は同梱データだけなので、常に「変化なし」 */
export async function refreshSiteLinks() {
  return false;
}

/** 描画用の一覧（ハブ専用ツール込み）。未取得ならnull。
    testの印が付いたツールは、作者プロフィールより下（一覧の最後）にまとめる（元の順番は保つ） */
export function getSiteLinks() {
  if (!tools) return null;
  const list = [];
  tools.forEach(t => {
    list.push(t);
    HUB_ONLY_TOOLS.filter(h => h.afterId === t.id).forEach(h => list.push(h));
  });
  return [...list.filter(t => !t.badgeTest), ...list.filter(t => t.badgeTest)];
}

/** リンク先: ハブ内ルートがあれば #/<id>、無ければ外部URL */
export function siteLinkHref(tool) {
  if (ROUTES[tool.id]) return { href: `#/${tool.id}`, hubRoute: `#/${tool.id}` };
  return { href: `https://taipak5000.github.io/${tool.path}/`, hubRoute: '' };
}

export function siteLinkName(tool, lang) {
  return tool[lang] || tool.en || tool.ja;
}

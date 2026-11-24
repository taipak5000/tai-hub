/* ================================================================
   精霊同行ツール ⇔ 精霊ツリー管理（→アイテム所持管理・エモート）の対応表

   精霊同行ツールの各枠（s1_it1 など。features/companion/data/tree-data.js）が、
   精霊ツリー管理のどのノード（features/spirit-catalog/data/spirit-tree-data.js の guid）に当たるか。
   ノード側には itemCatKey/itemCostId（アイテム所持管理）・emoteId/emoteLevel（エモート）が付いているので、
   ツリーのノードを解放すれば、そこからアイテム所持管理・エモートにも反映される（spirit-catalog-state.js）。

   ・季節が替わって tree-data.js を差し替えたら、この表も新しい季節の精霊に書き換える。
     season が tree-data.js の CURRENT_SEASON_NAME と食い違う間は、連動を止める（別の季節のアイテムを
     誤って入手にしないため）。
   ・各精霊の最初のエモート（_em1）は同行ツールでは最初から入手済みの扱いなので、対応に入れない
     （入れると、同行ツールを開いただけで全員のツリーに解放が付いてしまう）。
   ・コスト0で表示されない枠（_mag2 の無い精霊・_extra4）は書かない。
   ================================================================ */
import { nsKey, readCompanionDataRaw } from '../../../js/state.js';
import { CURRENT_SEASON_NAME } from './tree-data.js';

export const COMPANION_LINK = {
  season: '遥かなる真珠の季節',
  catalogSeason: 'Season of Pearl',
  spirits: {
    // 腕っぷし自慢の船乗り
    YITwEj1MrT: {
      s1_mag1: 'mTTqEGh5ra', s1_it1: 'sEsz6ZJiVx', s1_bonus2b: '76v-2bkMzc',
      s1_em2: 'y5O2scI-3u', s1_mag3: 'a89yFo9gSG', s1_bonus3: 'PG-TTNSmWE',
      s1_it2: 'p1faGcby42', s1_heart: 'f67uu4C9-S', s1_bonus4b: 'XFNTEqyFAv',
    },
    // 見せびらかしの商人
    'W5o3UBa-ls': {
      s2_mag1: 'NoShqLH4KS', s2_it1: '4Go4oP1kaV', s2_mag2: 'xb1SAsOqbN', s2_bonus2b: 'WjqM7Zu62C',
      s2_em2: 'Xwq3Ol0dfb', s2_mag3: 'bRlUwXkjAo', s2_bonus3: 'ufA3yn41J9',
      s2_it2: '0jQs89jw4v', s2_heart: 'odpnshEj2y', s2_bonus4b: 'SE8KrwyKIc',
    },
    // 老いた漁師
    HB7xbMAPKZ: {
      s3_mag1: 'dmI29cY24o', s3_it1: '88ZRykeLVQ', s3_mag2: 'pFQN9ZdGwX', s3_bonus2b: 'jBlobqdaU4',
      s3_em2: 'xi34Z8MXLd', s3_mag3: 'IX37b2ufll', s3_bonus3: 'faUfVCY5rQ',
      s3_it2: 'PJ6QcTGfWt', s3_heart: 'ZWMviVa5DS', s3_bonus4: 'SHb_PVo8Ty', s3_bonus4b: 'CaMEAohZOB',
    },
    // 転げまわる幼子
    '9aSW6TswEZ': {
      s4_mag1: '-iVAbtd_8-', s4_it1: '5VTdNvpa1c', s4_mag2: '0E6Y1Mu5ni', s4_bonus2b: 'BePPWWJ1IC',
      s4_em2: 'M-3lq41Pc6', s4_mag3: 'HIIK0NaKTR', s4_bonus3: 'MbGwJHU287',
      s4_it2: 'HnTg_LpzGk', s4_heart: 'lUMSYMuFLs', s4_bonus4: 'RRp_VIXqZb', s4_bonus4b: 'KEBOltroVk',
    },
  },
};

export function companionLinkActive() {
  return COMPANION_LINK.season === CURRENT_SEASON_NAME;
}

/** [{ companionId, spiritGuid, nodeGuid }] */
export function companionLinkEntries() {
  if (!companionLinkActive()) return [];
  const out = [];
  Object.entries(COMPANION_LINK.spirits).forEach(([spiritGuid, nodes]) => {
    Object.entries(nodes).forEach(([companionId, nodeGuid]) => out.push({ companionId, spiritGuid, nodeGuid }));
  });
  return out;
}

const COMPANION_DATA_KEY = 'sky_companion_v4_data';

/** 保存済みの同行ツールのデータから { 枠id: 入手済みか } を読む。データが無ければ null */
export function readCompanionChecks() {
  let data;
  try { data = JSON.parse(readCompanionDataRaw()); } catch (_) { data = null; }
  if (!data || !Array.isArray(data.spirits)) return null;
  const out = {};
  data.spirits.forEach((sp) => {
    if (!sp || !sp.treeData) return;
    Object.values(sp.treeData).forEach((tier) => {
      if (Array.isArray(tier)) tier.forEach((it) => { if (it && it.id) out[it.id] = !!it.checked; });
    });
  });
  return out;
}

/** 保存済みの同行ツールのデータの入手状態を書き換える（updates = { 枠id: true/false }）。
    同行ツールを一度も開いていない（データが無い）時は何もしない（開いた時に精霊ツリー側から合わせる） */
export function writeCompanionChecks(updates) {
  let data;
  try { data = JSON.parse(readCompanionDataRaw()); } catch (_) { data = null; }
  if (!data || !Array.isArray(data.spirits)) return false;
  let changed = false;
  data.spirits.forEach((sp) => {
    if (!sp || !sp.treeData) return;
    Object.values(sp.treeData).forEach((tier) => {
      if (!Array.isArray(tier)) return;
      tier.forEach((it) => {
        if (!it || !Object.prototype.hasOwnProperty.call(updates, it.id)) return;
        if (!!it.checked !== !!updates[it.id]) { it.checked = !!updates[it.id]; changed = true; }
      });
    });
  });
  if (changed) {
    try { localStorage.setItem(nsKey(COMPANION_DATA_KEY), JSON.stringify(data)); } catch (_) { return false; }
  }
  return changed;
}

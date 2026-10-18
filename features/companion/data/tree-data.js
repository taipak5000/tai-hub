/* ================================================================
   精霊同行ツール（companion）の精霊ツリーデータ。
   移植元: C:\Users\user\Downloads\skyツール\companion\index.html
   （createInitialTree/createDefaultSpiritsData/TIER_TOTAL_OVERRIDES/
   CURRENT_SEASON_NAME/SEASON_START/SEASON_END）と同じ内容。

   🌊 遥かなる真珠の季節（2026/10/16〜2027/1/1）の精霊ツリーを反映済み（Sky Wiki各精霊ページの精霊メニューより）。
   次の季節のツリーが判明したら、この1ファイルの中身（コスト表・精霊ごとの個別上書き・名前）を差し替えること
   （companion/index.html側の更新と同じ作業）。前シーズンのデータはGit履歴から復元できる。
   ================================================================ */

// 🕯️ costs は精霊ごとのキャンドルコスト表。
// ツリーは下から第1層→第4層の順（画像の一番下が第1層、一番上のハートが最終報酬）。
// em1/mag1=第1層, it1/mag2=第2層, em2/mag3=第3層, it2/extra4=第4層季節アイテム, heart=シーズンハートとの交換（要アドパス）
// ⚠️ 第1層のみ、他の層と違って「アドパス①」の枠が実在しない（3つ目に見える右のアイコンは
// 連れ歩きを開始するためのボタンであり、キャンドルを払って交換する枠ではないため）。
// ⚠️ 第3層のアドパス枠(bonus3)は初期ツリーには含めず、createDefaultSpiritsDataで末尾に追加する。
// 第4層のアドパス枠(bonus4/bonus4b)はハートの後ろに置き、heartのtier4[2]という位置参照を崩さないようにしている。
// 🎭 エモートはLv1〜Lv4まであるが、Lv2とLv4はキャンドル交換ではなくアドパス限定で入手
// （アドパスアイテムとは別枠の「アドパスエモートLv2/Lv4」として存在）。
// キャンドルを払って交換できるのはLv1(第1層,無料)とLv3(第3層,em2)のみ。
// em2は「歩き系アイテムの出現順」で自動採番すると2番目=Lv2になってしまうため、customLabelでLv3に固定している。
function createInitialTree(prefix, costs) {
  return {
    tier1: [
      { id: prefix + '_em1', type: 'walk', firstUnlock: true, name: 'エモートLv1 (初回解放)', points: 20, candles: costs.em1, checked: true, excluded: false },
      { id: prefix + '_mag1', type: 'magic', name: '魔法①', points: 20, candles: costs.mag1, checked: false, excluded: false },
    ],
    tier2: [
      { id: prefix + '_it1', type: 'seasonal', name: '季節アイテム①', points: 30, candles: costs.it1, checked: false, excluded: false },
      { id: prefix + '_mag2', type: 'magic', name: '魔法②', points: 30, candles: costs.mag2, checked: false, excluded: false },
      { id: prefix + '_bonus2b', name: 'アドパスエモートLv2', points: 0, candles: 0, noPoints: true, firstBonus: true, requiresSeasonPass: true, checked: false, excluded: false },
    ],
    tier3: [
      { id: prefix + '_em2', type: 'walk', name: 'エモートLv3', customLabel: 'エモートLv3', points: 40, candles: costs.em2, checked: false, excluded: false },
      { id: prefix + '_mag3', type: 'magic', name: '魔法③', points: 40, candles: costs.mag3, checked: false, excluded: false },
    ],
    tier4: [
      { id: prefix + '_it2', type: 'seasonal', name: '季節アイテム②', points: 100, candles: costs.it2, checked: false, excluded: false },
      { id: prefix + '_extra4', type: 'magic', name: '魔法④', points: 0, candles: costs.extra, checked: false, excluded: false },
      { id: prefix + '_heart', name: '♡ ハートと交換', points: 0, candles: costs.heart, requiresSeasonPass: true, isHeartGoal: true, firstBonus: true, checked: false, excluded: false },
      { id: prefix + '_bonus4', name: 'アドパスアイテム', points: 0, candles: 0, noPoints: true, firstBonus: true, requiresSeasonPass: true, wrapRow: true, checked: false, excluded: false },
      { id: prefix + '_bonus4b', name: 'アドパスエモートLv4', points: 0, candles: 0, noPoints: true, firstBonus: true, requiresSeasonPass: true, checked: false, excluded: false },
    ],
  };
}

// 🌊 遥かなる真珠の季節の精霊ツリー（旧サイト companion/index.html と同じ内容）。
// 📊 キャンドルコスト（Sky Wiki「遥かなる真珠の季節」各精霊ページの「精霊メニュー」より）。
// ツリー合計: 腕っぷし自慢の船乗り=75 / 見せびらかしの商人=100 / 老いた漁師=100 / 転げまわる幼子=96
// （いずれもシーズンハートとの交換 🕯️3・要アドパスを含む）。
// ※ キー名（mag1/it1など）はツリー内の「位置」を表す識別子であり、実際の種別(type)は下の
//   精霊ごとの個別上書きで変わる（例: 第3層のmag3は染料や季節アイテム）。コスト0の枠は実在しない枠（非表示）。
const SPIRIT_TREE_COSTS = {
  s1: { em1: 0, mag1: 4, it1: 18, mag2: 0, em2: 8, mag3: 10, it2: 32, extra: 0, heart: 3 }, // 合計75（第2層は季節アイテムのみ・第3層は青染料8+魔法10でエモートLv3なし）
  s2: { em1: 0, mag1: 4, it1: 18, mag2: 7, em2: 28, mag3: 8, it2: 32, extra: 0, heart: 3 }, // 合計100（第3層の魔法③は水色染料8）
  s3: { em1: 0, mag1: 4, it1: 18, mag2: 7, em2: 28, mag3: 8, it2: 32, extra: 0, heart: 3 }, // 合計100（第2層の季節アイテムは楽譜#47・第3層の魔法③は白染料8）
  s4: { em1: 0, mag1: 4, it1: 18, mag2: 7, em2: 28, mag3: 24, it2: 12, extra: 0, heart: 3 }, // 合計96（第3層の魔法③は季節アイテム(アウトフィット)24・第4層は青染料12）
};

// 🎨 実機アイコン画像（Sky Wikiの各精霊ページの精霊メニューの画像）。特定精霊の特定アイテム専用のため
// item.customImage で個別に割り当てる（getItemImageUrlで最優先される）。
// ※ 見せびらかしの商人のアドパス「ネックレス」は、Wiki側でも仮にエモートのアイコンが使われている。
const pearlImg = (path) => 'https://static.wikia.nocookie.net/sky-children-of-the-light/images/' + path + '/revision/latest/scale-to-width-down/51';
const PEARL_ART = {
  spell: pearlImg('2/28/Special-event-spell-icon.png'),
  dye_blue: pearlImg('0/0b/Blue-dye-container-icon.png'),
  dye_cyan: pearlImg('f/f5/Cyan-dye-container-icon.png'),
  dye_white: pearlImg('6/64/White-dye-container-icon.png'),
  s1: { emote: pearlImg('e/eb/Wrestling-Sailor-Emote-icon.png'), cape: pearlImg('e/ef/Wrestling-Sailor-Cape-icon.png'), hair: pearlImg('d/dc/Wrestling-Sailor-Hair-icon.png'), outfit: pearlImg('6/6d/Wrestling-Sailor-Outfit-icon.png') },
  s2: { emote: pearlImg('e/e5/Showy-Merchant-Emote-icon.png'), hair: pearlImg('c/c2/Showy-Merchant-Hair-icon.png'), outfit: pearlImg('0/0a/Showy-Merchant-Outfit-icon.png') },
  s3: { emote: pearlImg('c/c1/Old-Angler-Emote-icon.png'), sheet: pearlImg('4/4e/MusicSheet.png'), outfit: pearlImg('b/b6/Old-Angler-Outfit-icon.png'), mask: pearlImg('4/47/Old-Angler-Mask-icon.png'), hairAcc: pearlImg('7/73/Old-Angler-Hair-Accessory-icon.png') },
  s4: { emote: pearlImg('b/bc/Cuddly-Rolling-Child-Emote-icon.png'), mask: pearlImg('0/00/Cuddly-Rolling-Child-Mask-icon.png'), outfit: pearlImg('5/59/Cuddly-Rolling-Child-Outfit-icon.png'), hair: pearlImg('5/55/Cuddly-Rolling-Child-Hair-icon.png'), cape: pearlImg('a/a6/Cuddly-Rolling-Child-Cape-icon.png') },
};

// 🧬 精霊4体ぶんの初期データ（デフォルト状態）を毎回まっさらに生成するファクトリ関数。
// アイテムIDは s1〜s4 のまま（保存済みの記録のチェック状態を消さないため）。精霊名は保存データに含まれず、
// 復元時は常にここの名前が使われる。前シーズンの進捗が残る場合は、各精霊の「リセット」で戻せる。
export function createDefaultSpiritsData() {
  const SPIRIT_NAMES = ['腕っぷし自慢の船乗り', '見せびらかしの商人', '老いた漁師', '転げまわる幼子'];
  const data = [1, 2, 3, 4].map((n) => {
    const prefix = 's' + n;
    const treeData = createInitialTree(prefix, SPIRIT_TREE_COSTS[prefix]);
    // 4体とも、第3層の右端にアドパス専用枠がある（コスト0・ポイント外）
    treeData.tier3.push({ id: prefix + '_bonus3', name: 'アドパスアイテム', points: 0, candles: 0, noPoints: true, firstBonus: true, requiresSeasonPass: true, checked: false, excluded: false });
    return { id: n, name: SPIRIT_NAMES[n - 1], walkDays: 0, currentPreset: 'custom', treeData };
  });
  const art = (item, url) => { item.customImage = url; };

  // 🎨 実際に公開されたツリーに合わせた個別上書き。
  // 層ごとの獲得ポイント合計(第1層40/第2層60/第3層80/第4層100)は変えず、その層の実在する枠に配分する
  // （枠が1つだけの層はその1枠に層の合計ポイントを持たせ、存在しない枠はコスト0・ポイント0にして非表示にする）。
  // 種別(type)を変えると自動採番（①②③…）がズレるので、染料だけ customLabel で名前を固定している。

  // ── 腕っぷし自慢の船乗り: 第2層は季節アイテム(ケープ)のみ（右端はアドパスの魔法）。第3層はエモートLv3が無く、青染料8＋魔法10
  {
    const t = data[0].treeData, a = PEARL_ART.s1;
    t.tier2[0].points = 60;        // 季節アイテム①（ケープ）: 第2層の合計ポイントを1枠に集約
    t.tier2[1].points = 0;         // 魔法②の枠は存在しない（コスト0=非表示）
    t.tier2[2].name = 'アドパス魔法';
    t.tier3[0].type = 'dye'; t.tier3[0].name = '青染料'; t.tier3[0].customLabel = '青染料'; // エモートLv3ではなく青染料（🕯️8）
    t.tier4.splice(3, 1);          // 第4層上段のアドパス枠(bonus4)は無い
    t.tier4[3].name = 'アドパス魔法'; // 第4層右端(bonus4b)はエモートではなくアドパスの魔法
    art(t.tier1[0], a.emote); art(t.tier1[1], PEARL_ART.spell);
    art(t.tier2[0], a.cape); art(t.tier2[2], PEARL_ART.spell);
    art(t.tier3[0], PEARL_ART.dye_blue); art(t.tier3[1], PEARL_ART.spell); art(t.tier3[2], a.outfit);
    art(t.tier4[0], a.hair); art(t.tier4[3], PEARL_ART.spell);
  }

  // ── 見せびらかしの商人: 標準の形。第3層の魔法③は水色染料（🕯️8）、右端のアドパスはネックレス。第4層上段のアドパス枠は無い
  {
    const t = data[1].treeData, a = PEARL_ART.s2;
    t.tier3[1].type = 'dye'; t.tier3[1].name = '水色染料'; t.tier3[1].customLabel = '水色染料';
    t.tier4.splice(3, 1);          // 第4層上段のアドパス枠(bonus4)は無い
    art(t.tier1[0], a.emote); art(t.tier1[1], PEARL_ART.spell);
    art(t.tier2[0], a.hair); art(t.tier2[1], PEARL_ART.spell); art(t.tier2[2], a.emote);
    art(t.tier3[0], a.emote); art(t.tier3[1], PEARL_ART.dye_cyan); art(t.tier3[2], a.emote); // 右端=アドパスのネックレス（Wiki側の仮アイコン）
    art(t.tier4[0], a.outfit); art(t.tier4[3], a.emote);
  }

  // ── 老いた漁師: 標準の形。第2層の季節アイテムは楽譜(#47)、第3層の魔法③は白染料（🕯️8）。第4層上段にアドパスのヘアアクセサリー
  {
    const t = data[2].treeData, a = PEARL_ART.s3;
    t.tier3[1].type = 'dye'; t.tier3[1].name = '白染料'; t.tier3[1].customLabel = '白染料';
    art(t.tier1[0], a.emote); art(t.tier1[1], PEARL_ART.spell);
    art(t.tier2[0], a.sheet); art(t.tier2[1], PEARL_ART.spell); art(t.tier2[2], a.emote);
    art(t.tier3[0], a.emote); art(t.tier3[1], PEARL_ART.dye_white); art(t.tier3[2], a.mask); // 右端=アドパスのマスク
    art(t.tier4[0], a.outfit); art(t.tier4[3], a.hairAcc); art(t.tier4[4], a.emote);
  }

  // ── 転げまわる幼子: 第3層の魔法③は季節アイテム(アウトフィット)（🕯️24）、第4層は青染料（🕯️12）。第4層上段にアドパスのケープ
  {
    const t = data[3].treeData, a = PEARL_ART.s4;
    t.tier3[1].type = 'seasonal'; t.tier3[1].name = '季節アイテム'; // アウトフィット
    t.tier4[0].type = 'dye'; t.tier4[0].name = '青染料'; t.tier4[0].customLabel = '青染料';
    art(t.tier1[0], a.emote); art(t.tier1[1], PEARL_ART.spell);
    art(t.tier2[0], a.mask); art(t.tier2[1], PEARL_ART.spell); art(t.tier2[2], a.emote);
    art(t.tier3[0], a.emote); art(t.tier3[1], a.outfit); art(t.tier3[2], a.hair); // 右端=アドパスのヘアスタイル
    art(t.tier4[0], PEARL_ART.dye_blue); art(t.tier4[3], a.cape); art(t.tier4[4], a.emote);
  }
  return data;
}
// 🔓 各層の「完了時の累計ポイント」上書き。通常は100/180/280。ツリーの構成が違う精霊がいる場合だけ、
// 精霊idをキーに上書きする（例: { 4: { t2: 100, t3: 181, t4: 281 } }）。
// 遥かなる真珠の季節は4体とも各層の合計ポイントが同じ（100/180/280）なので上書きは無い。
export const TIER_TOTAL_OVERRIDES = {};
// 🌸 現在（次）のシーズン情報（ヘッダーのバナー表示用。開始日時まで必要なため、
// features/item/data/season-data.js の CURRENT_SEASON とは別にこの1ファイルへ
// 複製している——item側は終了日時しか持たない。次のイベントに切り替わったら
// season-data.js の更新と同じタイミングでこちらも手動更新すること）。
// 開始前は「開始までのカウントダウン」、開始後は「終了までのカウントダウン」を表示する。
// 日時はJSTを明示してあるので、どのタイムゾーンで開いても同じ瞬間になる。終了は太平洋標準時
// 12/31 23:59:59（＝日本時間 1/1 16:59:59。冬時間はデイリーリセットが日本時間17:00になる）。
export const CURRENT_SEASON_NAME = '遥かなる真珠の季節';
export const SEASON_START = new Date('2026-10-16T16:00:00+09:00');
export const SEASON_END = new Date('2027-01-01T16:59:59+09:00');
export const SEASON_START_TEXT = '2026/10/16 16:00';
export const SEASON_END_TEXT = '2027/1/1 16:59';

/* ================================================================
   精霊同行ツール（companion）の精霊ツリーデータ。
   移植元: C:\Users\user\Downloads\skyツール\companion\index.html
   （createInitialTree/createDefaultSpiritsData/TIER_TOTAL_OVERRIDES/
   CURRENT_SEASON_NAME/SEASON_START/SEASON_END）と同じ内容。

   ⚠️ 今は「次シーズンの精霊ツリー」の準備中の仮データ。次の季節の精霊ツリーが判明するまでの間、
   4体とも名前を「1〜4」にし、ツリーの形・獲得ポイント・必要キャンドルを前シーズン
   「親愛なるファン・ゴッホへ」の「素朴な思い出」と同じにしている。判明したら、この1ファイルの
   中身（コスト表・個別上書き）を次のツリーの内容に置き換えること（companion/index.html側の
   更新と同じ作業）。前シーズンの精霊別アイコン画像・個別上書きは削除した（Git履歴から復元できる）。
   ================================================================ */

// 🕯️ costs は精霊ごとのキャンドルコスト表。
// ツリーは下から第1層→第4層の順（画像の一番下が第1層、一番上のハートが最終報酬）。
// em1/mag1=第1層, it1/mag2=第2層, em2/mag3=第3層, it2/extra4=第4層季節アイテム, heart=シーズンハートとの交換（要アドパス）
// ⚠️ 第1層のみ、他の層と違って「アドパス①」の枠が実在しない（3つ目に見える右のアイコンは
// 連れ歩きを開始するためのボタンであり、キャンドルを払って交換する枠ではないため）。
// ⚠️ 第3層にはアドパスの枠が実在しない。代わりに第4層にアドパス④がある（ハートの後ろに追加し、
// heartのtier4[2]という位置参照を崩さないようにしている）。
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

// 🌱 次シーズンの精霊ツリー（準備中の仮データ）のキャンドルコスト。
// 前シーズンの「素朴な思い出」と同じ（合計89: 第2層の魔法②が染料🕯️8・第3層にアドパス枠あり・
// 第4層の魔法④は枠なし）。キー名（mag1/it1など）はツリー内の「位置」を表す識別子で、
// 実際の種別(type)は個別上書きで変わる場合がある（例: 第2層のmag2は染料）。
const PLACEHOLDER_TREE_COSTS = { em1: 0, mag1: 4, it1: 18, mag2: 8, em2: 22, mag3: 8, it2: 26, extra: 0, heart: 3 };

// 🧬 精霊4体ぶんの初期データ（デフォルト状態）を毎回まっさらに生成するファクトリ関数。
// 今は次シーズンの仮データ: 4体とも同じ形（前シーズンの「素朴な思い出」と同じ）で、名前は「1〜4」。
// アイテムIDは従来どおり s1〜s4 のまま（保存済みの記録のチェック状態を消さないため。
// 前シーズンの進捗が残る場合は、各精霊の「リセット」で戻せる）。
function createPlaceholderTree(prefix) {
  const tree = createInitialTree(prefix, PLACEHOLDER_TREE_COSTS);
  // 第2層の魔法② → 染料（🕯️8）。第4層の魔法④は枠自体が存在しないため非表示（コスト0）
  tree.tier2[1].type = 'dye';
  tree.tier3[1].customLabel = '魔法③'; // ↑の採番ズレ補正
  tree.tier4[1].customLabel = '魔法④'; // ↑の採番ズレ補正（コスト0のため実際は非表示）
  // 第3層に存在するアドパス専用枠（コスト0・ポイント外）
  tree.tier3.push({ id: prefix + '_bonus3', name: 'アドパスアイテム', points: 0, candles: 0, noPoints: true, firstBonus: true, requiresSeasonPass: true, checked: false, excluded: false });
  return tree;
}

export function createDefaultSpiritsData() {
  return [1, 2, 3, 4].map((n) => ({
    id: n, name: String(n), walkDays: 0, currentPreset: 'custom', treeData: createPlaceholderTree('s' + n),
  }));
}
// 🔓 各層の「完了時の累計ポイント」上書き。通常は100/180/280。ツリーの構成が違う精霊がいる場合だけ、
// 精霊idをキーに上書きする（例: { 4: { t2: 100, t3: 181, t4: 281 } }）。
// 今は4体とも同じ形の仮データなので上書きは無い。
export const TIER_TOTAL_OVERRIDES = {};
// 🌸 現在のシーズン情報（ヘッダーのバナー表示用。開始日時まで必要なため、
// features/item/data/season-data.js の CURRENT_SEASON とは別にこの1ファイルへ
// 複製している——item側は終了日時しか持たない。次のイベントに切り替わったら
// season-data.js の更新と同じタイミングでこちらも手動更新すること）
export const CURRENT_SEASON_NAME = '親愛なるファン・ゴッホへ';
export const SEASON_START = new Date('2026-07-17T16:00:00');
export const SEASON_END = new Date('2026-10-02T15:59:00');
export const SEASON_START_TEXT = '2026/7/17 16:00';
export const SEASON_END_TEXT = '2026/10/2 15:59';

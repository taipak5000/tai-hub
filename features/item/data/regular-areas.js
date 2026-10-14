/* ================================================================
   恒常精霊アイテムのエリア・大精霊の対応表（アイテム検索の「エリア」「大精霊のアイテムのみ」
   絞り込み用）。item/index.html の REGULAR_ITEM_AREA / REGULAR_ELDER_IDS /
   REGULAR_AREA_* の移植（内容は同一）。
   ================================================================ */

// 恒常精霊アイテム（cost-data.jsのsourceが「恒常」で始まるアイテム）専用のエリア絞り込み用データ。
// 姉妹サイトの精霊ツリーデータ（各精霊のarea・itemCatKey/itemCostId）を突き合わせて手動生成。
// 大精霊（旧称:長老）アイテムはエリア名が名前に直接含まれるため、それを解析して割り当てている。
// チャットテーブルのみ、特定の精霊のツリーではなくスペルショップでの購入品のため 'other' 扱い。
export const REGULAR_ITEM_AREA = {
  large_placeable_002: 'other', // チャットテーブル
  outfit_002: 'forest', outfit_003: 'forest', outfit_004: 'vault', outfit_005: 'isle',
  outfit_006: 'valley', outfit_007: 'vault', outfit_008: 'isle', outfit_009: 'prairie',
  hairstyle_004: 'isle', hairstyle_005: 'prairie', hairstyle_006: 'prairie', hairstyle_007: 'forest',
  hairstyle_008: 'forest', hairstyle_009: 'prairie', hairstyle_010: 'wasteland', hairstyle_011: 'isle',
  hairstyle_012: 'prairie', hairstyle_013: 'forest', hairstyle_014: 'forest', hairstyle_015: 'valley',
  hairstyle_016: 'forest', hairstyle_017: 'forest', hairstyle_018: 'wasteland', hairstyle_019: 'isle',
  hairstyle_020: 'forest', hairstyle_021: 'wasteland', hairstyle_022: 'wasteland', hairstyle_023: 'vault',
  hairstyle_024: 'vault', hairstyle_025: 'vault', hairstyle_026: 'valley', hairstyle_027: 'valley',
  hairstyle_028: 'valley', hairstyle_029: 'wasteland', hairstyle_030: 'prairie',
  hairstyle_031: 'isle', hairstyle_032: 'prairie', hairstyle_033: 'forest', hairstyle_034: 'valley',
  hairstyle_035: 'valley', hairstyle_036: 'wasteland', hairstyle_037: 'vault', hairstyle_183: 'vault',
  face_accessory_001: 'isle', face_accessory_002: 'prairie', face_accessory_003: 'forest',
  face_accessory_004: 'valley', face_accessory_005: 'valley', face_accessory_006: 'wasteland',
  face_accessory_007: 'vault', face_accessory_008: 'isle', face_accessory_009: 'prairie',
  face_accessory_010: 'forest', face_accessory_011: 'valley', face_accessory_012: 'valley',
  portable_item_001: 'prairie', portable_item_003: 'wasteland', portable_item_004: 'valley',
  portable_item_005: 'wasteland', portable_item_031: 'forest', portable_item_035: 'wasteland',
  mask_002: 'forest', mask_003: 'prairie', mask_004: 'wasteland', mask_113: 'valley',
  cape_005: 'prairie', cape_006: 'valley', cape_007: 'wasteland', cape_008: 'forest',
  cape_009: 'vault', cape_010: 'forest', cape_011: 'valley', cape_012: 'wasteland', cape_013: 'vault',
  cape_014: 'prairie', cape_015: 'valley', cape_016: 'wasteland', cape_017: 'forest',
  cape_018: 'vault', cape_019: 'forest', cape_020: 'valley', cape_021: 'wasteland', cape_022: 'vault'
};
// 大精霊（旧称:長老）アイテム。エリアはすべて選ぶが、この中だけをさらに絞り込みたい場合に使う。
export const REGULAR_ELDER_IDS = new Set([
  'hairstyle_031', 'hairstyle_032', 'hairstyle_033', 'hairstyle_034', 'hairstyle_035', 'hairstyle_036', 'hairstyle_037',
  'face_accessory_008', 'face_accessory_009', 'face_accessory_010', 'face_accessory_011', 'face_accessory_012'
]);
export const REGULAR_AREA_ORDER = ['isle', 'prairie', 'forest', 'valley', 'wasteland', 'vault', 'other'];
export const REGULAR_AREA_JA = { isle: '孤島', prairie: '草原', forest: '雨林', valley: '峡谷', wasteland: '捨てられた地', vault: '書庫', other: 'その他' };
export const REGULAR_AREA_EN = { isle: 'Isle of Dawn', prairie: 'Daylight Prairie', forest: 'Hidden Forest', valley: 'Valley of Triumph', wasteland: 'Golden Wasteland', vault: 'Vault of Knowledge', other: 'Other' };

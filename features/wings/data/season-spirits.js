/* ================================================================
   季節ごとの季節精霊リスト（実装順）。
   移植元: wings/index.html 内 SEASON_SPIRITS（1885-2085行目）を
   byte-for-byte（データ本体・コメントとも）そのまま抽出したもの。
   各精霊名は { ja, en } のペアで保持する。英語名は公式Sky Wikiの表記に
   合わせているが、一部（下記コメント参照）はWiki上で直接確認できず、
   文脈から推定した訳のため要確認。
   ================================================================ */
export const SEASON_SPIRITS = [
  { season: { ja: '感謝の季節', en: 'Season of Gratitude' }, spirits: [
    { ja: 'おませな漂流者', en: 'Sassy Drifter' },
    { ja: '屈伸する導師', en: 'Stretching Guru' },
    { ja: '挑戦的な表現者', en: 'Provoking Performer' },
    { ja: '飛び跳ねる舞踏家', en: 'Leaping Dancer' },
    { ja: '敬礼する守護者', en: 'Saluting Protector' },
    { ja: '礼を尽くす祈祷師', en: 'Greeting Shaman' },
  ] },
  { season: { ja: '光の探求者の季節', en: 'Season of Lightseekers' }, spirits: [
    { ja: 'おんぶする光探求者', en: 'Piggyback Lightseeker' },
    { ja: 'ダブルタッチの光採取者', en: 'Doublefive Light Catcher' },
    { ja: 'くつろぐ開拓者', en: 'Laidback Pioneer' },
    { ja: 'くるりと舞う優勝者', en: 'Twirling Champion' },
    { ja: '蟹の語り部', en: 'Crab Whisperer' },
    { ja: '静けさを望む光学者', en: 'Shushing Light Scholar' },
  ] },
  { season: { ja: '想いを編む季節', en: 'Season of Belonging' }, spirits: [
    { ja: '音と舞う幼子', en: 'Boogie Kid' },
    { ja: '紙ふぶき好きのいとこ', en: 'Confetti Cousin' },
    { ja: 'ぽんぽんする若者', en: 'Hairtousle Teen' },
    { ja: '煌きを放つ親', en: 'Sparkler Parent' },
    { ja: '訴えかける親', en: 'Pleaful Parent' },
    { ja: '祖たる賢者', en: 'Wise Grandparent' },
  ] },
  { season: { ja: 'リズムが弾ける季節', en: 'Season of Rhythm' }, spirits: [
    { ja: '一座の進行役', en: 'Troupe Greeter' }, // 未確認: 文脈からの推定訳
    { ja: '祝祭の旋舞家', en: 'Festival Whirling Dancer' }, // 未確認: 文脈からの推定訳
    { ja: 'うっとりするような旅役者', en: 'Admiring Actor' }, // 未確認: 文脈からの推定訳
    { ja: '一座の曲芸師', en: 'Troupe Juggler' },
    { ja: '敬意を表す楽師', en: 'Respectful Pianist' },
    { ja: '思慮深き座長', en: 'Thoughtful Director' },
  ] },
  { season: { ja: '魔法の季節', en: 'Season of Enchantment' }, spirits: [
    { ja: 'うなずく壁画師', en: 'Nodding Muralist' },
    { ja: '無頓着な錬金術師', en: 'Indifferent Alchemist' },
    { ja: '蟹歩きの名人', en: 'Crab Walker' },
    { ja: 'こけおどしの農家', en: 'Scarecrow Farmer' },
    { ja: '居眠りする大工', en: 'Snoozing Carpenter' },
    { ja: 'けんかごっこ好きの植物採集者', en: 'Playfighting Herbalist' },
  ] },
  { season: { ja: '楽園の季節', en: 'Season of Sanctuary' }, spirits: [
    { ja: '海月の語り部', en: 'Jellyfish Whisperer' }, // 未確認: 文脈からの推定訳
    { ja: '引っ込み思案な読書家', en: 'Timid Bookworm' }, // 未確認: 文脈からの推定訳
    { ja: '奮い立つ怖いもの知らず', en: 'Rallying Daredevil' }, // 未確認: 文脈からの推定訳
    { ja: 'ハイキングする気むずかし屋', en: 'Hiking Grouch' },
    { ja: '感謝する貝殻収集家', en: 'Grateful Shell Collector' },
    { ja: 'くつろぐ日光浴者', en: 'Chill Sunbather' },
  ] },
  { season: { ja: '預言者の季節', en: 'Season of Prophecy' }, spirits: [
    { ja: '水の預言者', en: 'Prophet of Water' },
    { ja: '地の預言者', en: 'Prophet of Earth' },
    { ja: '風の預言者', en: 'Prophet of Air' },
    { ja: '火の預言者', en: 'Prophet of Fire' },
  ] },
  { season: { ja: '夢かなう季節', en: 'Season of Dreams' }, spirits: [
    { ja: '舞い踊る表現者', en: 'Dancing Performer' }, // 未確認: 文脈からの推定訳
    { ja: '旋舞の師匠', en: 'Whirling Dance Master' }, // 未確認: 文脈からの推定訳
    { ja: 'そっと覗く郵便屋', en: 'Peeking Postman' },
    { ja: 'ハグ好きの隠者', en: 'Bearhug Hermit' },
  ] },
  { season: { ja: '大樹に集う季節', en: 'Season of Assembly' }, spirits: [
    { ja: 'とまどう植物学者', en: 'Baffled Botanist' },
    { ja: 'したり顔の生徒', en: 'Scolding Student' },
    { ja: '臆病な見習い士官', en: 'Scaredy Cadet' },
    { ja: '行進する冒険家', en: 'Marching Adventurer' },
    { ja: '含み笑いのスカウト', en: 'Chuckling Scout' },
    { ja: '夢見がちな森の民', en: 'Daydream Forester' },
  ] },
  { season: { ja: '星の王子さまの季節', en: 'Season of The Little Prince' }, spirits: [
    { ja: '手招く支配者', en: 'Beckoning Ruler' },
    { ja: 'ご満悦のうぬぼれ屋', en: 'Gloating Narcissist' },
    { ja: '体をほぐす点燈夫', en: 'Stretching Lamplighter' },
    { ja: 'うなだれる戦士', en: 'Slouching Soldier' },
    { ja: 'くしゃみする地理学者', en: 'Sneezing Geographer' },
    { ja: '星の収集家', en: 'Star Collector' },
  ] },
  { season: { ja: '羽ばたく季節', en: 'Season of Flight' }, spirits: [
    { ja: '快活な誘導手', en: 'Lively Navigator' },
    { ja: '光の語り部', en: 'Light Whisperer' }, // 未確認: 文脈からの推定訳
    { ja: '工夫好きの風鈴職人', en: 'Inventive Wind Chime Maker' }, // 未確認: 文脈からの推定訳
    { ja: '腕利きの工匠', en: 'Skilled Craftsman' }, // 未確認: 文脈からの推定訳
  ] },
  { season: { ja: '深淵の季節', en: 'Season of Abyss' }, spirits: [
    { ja: '繊細な漁師', en: 'Anxious Angler' }, // 一部推定: Wiki上でAnxious Anglerが本季節の精霊と確認できたが、このJA名との対応は推定
    { ja: '動じない提督', en: 'Unfazed Admiral' }, // 未確認: 文脈からの推定訳
    { ja: 'おっちょこちょいな水夫長', en: 'Clumsy Boatswain' }, // 未確認: 文脈からの推定訳
    { ja: '豪快に笑う砲手', en: 'Boisterous Gunner' }, // 未確認: 文脈からの推定訳
  ] },
  { season: { ja: '表現者たちの季節', en: 'Season of Performance' }, spirits: [
    { ja: '一生懸命な舞台美術家', en: 'Frantic Stagehand' },
    { ja: '忘れっぽい劇作家', en: 'Forgetful Storyteller' },
    { ja: 'のんびり屋の音楽家', en: 'Mellow Musician' },
    { ja: '慎み深い踊り手', en: 'Modest Dancer' },
  ] },
  { season: { ja: '砕ケル闇ノ季節', en: 'Season of Shattering' }, spirits: [
    { ja: '万古の光（海月）', en: 'Ancient Light (Jellyfish)' },
    { ja: '万古の光（マンタ）', en: 'Ancient Light (Manta)' },
    { ja: '万古の闇（暗黒竜）', en: 'Ancient Darkness (Dark Dragon)' },
    { ja: '万古の闇（蝕む闇）', en: 'Ancient Darkness (Plants)' },
  ] },
  { season: { ja: 'AURORAの季節', en: 'Season of AURORA' }, spirits: [
    { ja: '駆けゆく旅人', en: 'Running Wayfarer' },
    { ja: '覚醒の採掘者', en: 'Mindful Miner' },
    { ja: '慈愛の戦士', en: 'Warrior of Love' },
    { ja: '希望の君', en: 'Seed of Hope' },
  ] },
  { season: { ja: '追慕の季節', en: 'Season of Remembrance' }, spirits: [
    { ja: '喪失の初老', en: 'Bereft Veteran' },
    { ja: '懇願する幼子', en: 'Pleading Youngster' }, // 未確認: 文脈からの推定訳
    { ja: 'ぬき足の茶人', en: 'Tiptoeing Tea-Brewer' },
    { ja: '傷ついた戦士', en: 'Wounded Warrior' }, // 未確認: 文脈からの推定訳
  ] },
  { season: { ja: 'ならいの季節', en: 'Season of Passage' }, spirits: [
    { ja: '風変わりなひとり好き', en: 'Quirky Loner' }, // 未確認: 文脈からの推定訳
    { ja: 'ぐるぐる回るいたずらっ子', en: 'Spinning Prankster' }, // 未確認: 文脈からの推定訳
    { ja: '物憂げなとぼとぼ歩き', en: 'Melancholic Wanderer' }, // 未確認: 文脈からの推定訳
    { ja: '活発すぎる頑張り屋', en: 'Overeager Try-Hard' }, // 未確認: 文脈からの推定訳
  ] },
  { season: { ja: '瞬きの季節', en: 'Season of Moments' }, spirits: [
    { ja: '頼もしい自然保護官', en: 'Reassuring Ranger' },
    { ja: '上機嫌な地質学者', en: 'Jolly Geologist' },
    { ja: '節制の修行者', en: 'Ascetic Monk' },
    { ja: '夜鳥の語り部', en: 'Nightbird Whisperer' },
  ] },
  { season: { ja: '復古の季節', en: 'Season of Revival' }, spirits: [
    { ja: '見捨てられた隠れ家の残響', en: 'Echo of an Abandoned Refuge' },
    { ja: '忘れ去られた楽園のなごり', en: 'Remnant of a Forgotten Haven' },
    { ja: '寂れたオアシスの面影', en: 'Vestige of a Deserted Oasis' },
    { ja: '失われし村の記憶', en: 'Memory of a Lost Village' },
  ] },
  { season: { ja: '九色の鹿の季節', en: 'Season of the Nine-Colored Deer' }, spirits: [
    { ja: '薬草採集人', en: 'Herb Gatherer' },
    { ja: '狩人', en: 'Hunter' },
    { ja: '国王', en: 'Feudal Lord' },
    { ja: '王女', en: 'Princess' },
  ] },
  { season: { ja: '巣づくりの季節', en: 'Season of Nesting' }, spirits: [
    { ja: '巣づくりのサンルーム', en: 'Nesting Solarium' },
    { ja: '巣づくりのロフト', en: 'Nesting Loft' },
    { ja: '巣づくりの吹き抜け', en: 'Nesting Atrium' },
    { ja: '巣づくりの小部屋', en: 'Nesting Nook' },
  ] },
  { season: { ja: '重なる音色の季節', en: 'Season of Duets' }, spirits: [
    { ja: '駆けだしのピアニスト', en: 'Novice Pianist' }, // 未確認: 文脈からの推定訳
    { ja: '駆けだしのチェリスト', en: 'Novice Cellist' }, // 未確認: 文脈からの推定訳
    { ja: '音楽家たちの遺産', en: "Musicians' Legacy" }, // 未確認: 文脈からの推定訳
    { ja: '栄光のピアニスト', en: 'Glorious Pianist' }, // 未確認: 文脈からの推定訳
    { ja: '栄光のチェリスト', en: 'Glorious Cellist' }, // 未確認: 文脈からの推定訳
  ] },
  { season: { ja: 'ムーミンの季節', en: 'Season of Moomin' }, spirits: [
    { ja: '慈愛の安らぎ', en: 'Comfort of Compassion' }, // 未確認: 文脈からの推定訳
    { ja: '自己の確立', en: 'Discovery of Self' }, // 未確認: 文脈からの推定訳
    { ja: '冒険の心', en: 'Spirit of Adventure' },
    { ja: '包容力の源', en: 'Inspiration of Inclusion' },
  ] },
  { season: { ja: '光に染まる季節', en: 'Season of Radiance' }, spirits: [
    { ja: '光に染まる飛び跳ねる舞踏家', en: 'Radiance Leaping Dancer' },
    { ja: '光に染まる挑戦的な表現者', en: 'Radiance Provoking Performer' },
    { ja: '光に染まる礼を尽くす祈祷師', en: 'Radiance Greeting Shaman' },
  ] },
  { season: { ja: '青い鳥の季節', en: 'Season of the Blue Bird' }, spirits: [
    { ja: '神聖な祖たる賢者', en: 'Divining Wise Grandparent' },
    { ja: '衣装をまとう紙ふぶき好きのいとこ', en: 'Costumed Confetti Cousin' },
    { ja: '高貴なぽんぽんする若者', en: 'Royal Hairtousle Teen' },
    { ja: '懐かしむ煌きを放つ親', en: 'Nostalgic Sparkler Parent' },
    { ja: '木こりの訴えかける親', en: 'Woodcutting Pleaful Parent' },
  ] },
  { season: { ja: 'ふたつの灯火の季節　前編', en: 'Season of The Two Embers - Part 1' }, spirits: [
    { ja: '心優しき玩具職人', en: 'Tender Toymaker' },
    { ja: '機知に富む隠とん者', en: 'Resourceful Recluse' },
    { ja: '厳格なマナティ飼い', en: 'Strict Manatee Keeper' }, // 未確認: 文脈からの推定訳
    { ja: '手負いの巡回兵', en: 'Wounded Patrolman' }, // 未確認: 文脈からの推定訳
    { ja: '寄り添うお友だち', en: 'Snuggling Companion' }, // 未確認: 文脈からの推定訳
  ] },
  { season: { ja: '渡りの季節', en: 'Season of Migration' }, spirits: [
    { ja: '渡りの鐘職人', en: 'Migrating Bellmaker' },
    { ja: '渡りの鳥の語り部', en: 'Migrating Bird Whisperer' },
    { ja: '渡りのマンタの語り部', en: 'Migrating Manta Whisperer' },
    { ja: '渡りの蝶々使い', en: 'Migrating Butterfly Charmer' },
    { ja: '渡りの海月の語り部', en: 'Migrating Jelly Whisperer' },
  ] },
  { season: { ja: '光の修繕者の季節', en: 'Season of Lightmending' }, spirits: [
    { ja: '光修繕する優勝者', en: 'Lightmending Champion' }, // 一部推定: パターンからの推定（Season of Lightseekersの対応精霊名より）
    { ja: '光修繕する光採取者', en: 'Lightmending Light Catcher' },
    { ja: '光修繕する光学者', en: 'Lightmending Light Scholar' }, // 一部推定: パターンからの推定
    { ja: '光修繕する開拓者', en: 'Lightmending Pioneer' }, // 一部推定: パターンからの推定
  ] },
  { season: { ja: 'カーニバルの季節', en: 'Season of Carnival' }, spirits: [
    { ja: 'カーニバルの曲芸師', en: 'Carnival Juggler' },
    { ja: 'カーニバルの旋舞家', en: 'Carnival Athletic Dancer' },
    { ja: 'カーニバルの旅役者', en: 'Carnival Stunt Actor' },
    { ja: 'カーニバルの謎解き座長', en: 'Carnival Puzzle Director' },
  ] },
  { season: { ja: 'ゴッホの季節', en: 'Dear Van Gogh' }, spirits: [
    { ja: '芸術の思い出', en: 'Artistic Memory' },
    { ja: 'オランダの思い出', en: 'Dutch Memory' },
    { ja: '喜びの思い出', en: 'Joyful Memory' },
    { ja: '素朴な思い出', en: 'Rustic Memory' }, // 未確認: 文脈からの推定訳
  ] },
  { season: { ja: '遥かなる真珠の季節', en: 'Season of Pearl' }, spirits: [
    { ja: '腕っぷし自慢の船乗り', en: 'Wrestling Sailor' },
    { ja: '見せびらかしの商人', en: 'Showy Merchant' },
    { ja: '老いた漁師', en: 'Old Angler' },
    { ja: '転げまわる幼子', en: 'Cuddly Rolling Child' },
  ] },
];

/* ================================================================
   シーズン・イベント・アップデート予定・再訪精霊スケジュール。
   item/index.htmlの同名定数を実定数としてexportする（旧実装は
   index.htmlや各カテゴリページを自己fetch+正規表現で読み直して
   いたが、SPA化により直接importできるためその仕組みは廃止した）。

   ⚠️ 季節・イベントが切り替わったら、item/index.html側の更新と
   同じタイミングでここも手動更新すること（tai-hubは独立したデータ
   コピーであり、item本体の変更が自動反映されるわけではない）。
   ================================================================ */

// startDate（開始日時）は省略可能で、開始前の間だけ働く: まだ始まっていない季節は「開催中」とは
// 扱わず、ダッシュボードには「開始まで」の予定として出し、アイテム検索の「現在開催中」にも含めない
// （isSeasonStarted/seasonInProgress/scheduleWithUpcomingSeason参照）。開始日時を過ぎると自動で通常の表示へ切り替わる。
// 次の季節が発表済みなら、開始前でもここへ入れておいてよい（EVENT_SCHEDULEへ重複して入れないこと）。
export const CURRENT_SEASON = {
  name: '遥かなる真珠の季節',
  startDate: '2026-10-16T00:00:00-07:00', // 日本時間 2026/10/16 16:00（デイリーリセット）
  endDate: '2026-12-31T23:59:59-08:00',   // 日本時間 2027/1/1 16:59:59
};

// 名前に「季節」を含まない季節（親愛なるファン・ゴッホへ）。CURRENT_SEASONが次の季節に切り替わっても
// 季節扱いが外れないよう、名前で固定している（名前に「季節」を含まない季節が新しく登場したら追加する）
export const SEASON_LIKE_EVENTS_WITHOUT_KISETSU = ['親愛なるファン・ゴッホへ'];
// イベント名が「季節」系かどうか（item/index.htmlのisSeasonLikeEventと同一ロジック）
export function isSeasonLikeEvent(e) {
  return e.includes('季節') || e === CURRENT_SEASON.name || SEASON_LIKE_EVENTS_WITHOUT_KISETSU.includes(e);
}

// 季節が開始済みかどうか（startDateが無ければ開始済み扱い）
export function isSeasonStarted(season = CURRENT_SEASON) {
  return !season.startDate || Date.now() >= new Date(season.startDate).getTime();
}
// 「進行中の季節」として扱える季節だけを返す。開始前の季節は「進行中の季節なし」（終了済み扱い）にして、
// 代わりにscheduleWithUpcomingSeason()でEVENT_SCHEDULEの1件（開始前のイベント）として渡す。
export function seasonInProgress(season = CURRENT_SEASON) {
  if (!season || isSeasonStarted(season)) return season;
  return { name: season.name, endDate: '1970-01-01T00:00:00Z' };
}
export function scheduleWithUpcomingSeason(schedule = EVENT_SCHEDULE, season = CURRENT_SEASON) {
  const list = schedule || [];
  if (!season || isSeasonStarted(season)) return list;
  return list.filter(ev => ev.name !== season.name)
    .concat([{ name: season.name, start: season.startDate, end: season.endDate }]);
}

export const EVENT_SCHEDULE = [
  { name: '月灯りの日々', start: '2026-09-19T16:00:00+09:00', end: '2026-10-10T15:59:59+09:00' },
  { name: 'いたずらな日々', start: '2026-10-23T16:00:00+09:00', end: '2026-11-12T17:00:00+09:00' },
];

export const CANDLE_BONUS_SCHEDULE = [
  // 現在開催予定なし（終了したボーナスはこの配列から削除してよい）
];

export const NEXT_UPDATE = {
  date: null, // 次回アップデート日が未定（発表されたら '2026-XX-XXT00:00:00-07:00' の形式で設定）
};

export const REVISIT_SPIRIT_SCHEDULES = [
  {
    // 2週間おきに4日間だけ来る旅の精霊の再訪周期。来訪ごとに違う精霊が来るため、
    // 入れ替わるたびにitemsとanchorStart/anchorEndを直近の実際の来訪に合わせて更新する
    // （intervalDaysは周期そのものなので変更不要）。
    // 直近の来訪(2026-10-08〜10-12)は「腕利きの工匠」(necklace_032, outfit_080, hairstyle_083)。
    items: [
      { catKey: 'necklace', id: 'necklace_032' },
      { catKey: 'outfit', id: 'outfit_080' },
      { catKey: 'hairstyle', id: 'hairstyle_083' },
    ],
    anchorStart: '2026-09-24T16:00:00+09:00',
    anchorEnd: '2026-09-28T15:59:59+09:00',
    intervalDays: 14,
  },
  {
    items: [
      { catKey: 'mask', id: 'mask_077' },
      { catKey: 'mask', id: 'mask_078' },
      { catKey: 'head_accessory', id: 'head_accessory_008' },
      { catKey: 'cape', id: 'cape_095' },
    ],
    start: '2026-09-19T16:00:00+09:00',
    end: '2026-10-10T15:59:59+09:00',
  },
];

export function getCurrentEventNames() {
  const now = new Date();
  const names = [];
  if (CURRENT_SEASON.endDate && now < new Date(CURRENT_SEASON.endDate) && isSeasonStarted()) {
    names.push(CURRENT_SEASON.name);
  }
  EVENT_SCHEDULE.forEach(ev => {
    const end = new Date(ev.end);
    const start = ev.start ? new Date(ev.start) : null;
    if (now <= end && (!start || now >= start)) names.push(ev.name);
  });
  return names;
}

export function isRevisitScheduleActive(schedule) {
  const now = new Date();
  if (schedule.intervalDays) {
    const start0 = new Date(schedule.anchorStart);
    const end0 = new Date(schedule.anchorEnd);
    const intervalMs = schedule.intervalDays * 86400000;
    const k = Math.floor((now - start0) / intervalMs);
    const start = new Date(start0.getTime() + k * intervalMs);
    const end = new Date(start.getTime() + (end0 - start0));
    return start <= now && now <= end;
  }
  return new Date(schedule.start) <= now && now <= new Date(schedule.end);
}

export function isRevisitSpiritCurrentlyActive() {
  return REVISIT_SPIRIT_SCHEDULES.some(isRevisitScheduleActive);
}

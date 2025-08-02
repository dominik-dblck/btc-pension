import { getUsersWithExponentionalGrowth } from './getUsersWithExponentionalGrowth';
import { getUsersWithLinearGrowth } from './getUsersWithLinearGrowth';

enum GrowthType {
  Linear = 'linear',
  Exponential = 'exponential',
}

export interface PlatformUsersData {
  userStarts: number;
  userEnds: number;
  growthType: GrowthType;
  years: number;
}

export type PlatformUsersTimeline = {
  month: number;
  newUsers: number;
  totalUsers: number; //
}[];

export function getPlatformUsersTimeline(
  inputData: PlatformUsersData
): PlatformUsersTimeline {
  const { userStarts, userEnds, growthType, years } = inputData;

  if (!Number.isFinite(userStarts) || !Number.isFinite(userEnds)) {
    throw new Error('userStarts/userEnds muszą być liczbami.');
  }
  if (!(years > 0)) {
    throw new Error('years musi być > 0');
  }
  const months = Math.floor(years * 12);

  const newUsers: number[] =
    growthType === GrowthType.Linear
      ? getUsersWithLinearGrowth(userStarts, userEnds, months)
      : getUsersWithExponentionalGrowth(userStarts, userEnds, months);

  const timeline: PlatformUsersTimeline = new Array(months);
  let total = userStarts;
  for (let m = 0; m < months; m++) {
    total += newUsers[m];
    timeline[m] = {
      month: m, // 0-indexed: t(0) oznacza stan początkowy = userStarts
      newUsers: newUsers[m],
      totalUsers: total,
    };
  }
  // Domknięcie końca dla pewności (growth funkcje i tak powinny to dać):
  timeline[months - 1].totalUsers = userEnds;

  return timeline;
}

console.log(
  getPlatformUsersTimeline({
    userStarts: 100,
    userEnds: 1000,
    growthType: GrowthType.Linear,
    years: 1,
  })
);

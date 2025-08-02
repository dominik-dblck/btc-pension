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
      month: m + 1, // 1-indexed
      newUsers: newUsers[m],
      totalUsers: total,
    };
  }

  timeline[months - 1].totalUsers = userEnds;

  return timeline;
}

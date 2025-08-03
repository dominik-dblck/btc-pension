import {
  UserTreasuryGrowthInput,
  UserPensionSimulationSnapshot,
  simulateUserTreasuryGrowth,
} from '../simulateUserTreasuryGrowth';
import {
  getPlatformUsersTimeline,
  PlatformUsersData,
} from './getPlatformUsersTimeline';

export interface BuildCohortSimulationSetProps {
  platformUsersData: PlatformUsersData;
  userTreasuryGrowthInput: UserTreasuryGrowthInput;
}

// summary results of all users in each month
export function buildCohortSimulationSet(
  inputData: BuildCohortSimulationSetProps
) {
  const { platformUsersData, userTreasuryGrowthInput } = inputData;

  const marketUsersTimeline = getPlatformUsersTimeline({
    ...platformUsersData,
    years: userTreasuryGrowthInput.marketData.numberOfYears,
  });

  // user 0
  const fullSimulationUser = simulateUserTreasuryGrowth(
    userTreasuryGrowthInput
  );

  const rows = marketUsersTimeline.map(({ month, newUsers }) => {
    const userMarketData = simulateUserTreasuryGrowth({
      ...userTreasuryGrowthInput,
      userData: {
        ...userTreasuryGrowthInput.userData,
        startMonth: month,
      },
    });

    return {
      startMonth: month, // <─ NEW FIELD ───────────────────────────┐
      numberOfUsers: newUsers,
      userSimulationSnapshot: userMarketData,
    }; // ◄────────────────────────────────────┘
  });

  const totalPlatformArray: {
    startMonth: number; // <─ NEW FIELD W TYPACH ───────────────┐
    numberOfUsers: number;
    userSimulationSnapshot: UserPensionSimulationSnapshot[];
  }[] = [
    {
      startMonth: 0, // pierwsza kohorta startuje w miesiącu 0
      numberOfUsers: platformUsersData.userStarts,
      userSimulationSnapshot: fullSimulationUser,
    },
    ...rows,
  ];

  return totalPlatformArray;
}

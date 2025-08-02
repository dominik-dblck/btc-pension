import {
  getPlatformUsersTimeline,
  PlatformUsersData,
} from './getPlatformUsersTimeline';
import {
  SimulateUserInput,
  SimulationSnapshot,
  userMarketSimulation,
} from './userMarketSimulation';

interface PlatformOwnGrowthData {
  yearlyYieldPct: number;
}

interface PlatformAsUserMarketSimulationInput {
  platformUsersData: PlatformUsersData;
  simulateUserInput: SimulateUserInput;
  platformOwnGrowthData: PlatformOwnGrowthData;
}

export function platformAsUserMarketSimulation(
  inputData: PlatformAsUserMarketSimulationInput
) {
  const { platformUsersData, simulateUserInput, platformOwnGrowthData } =
    inputData;

  const marketUsersTimeline = getPlatformUsersTimeline({
    ...platformUsersData,
    years: simulateUserInput.userData.numberOfYears,
  });

  // user 0
  const fullSimulationUser = userMarketSimulation(simulateUserInput);

  const rows = marketUsersTimeline.map(({ month, newUsers }) => {
    const userMarketData = userMarketSimulation({
      ...simulateUserInput,
      userData: {
        ...simulateUserInput.userData,
        startMonth: month,
      },
    });

    return {
      numberOfUsers: newUsers,
      userSimulationSnapshot: userMarketData,
    };
  });

  const totalPlatformArray: {
    numberOfUsers: number;
    userSimulationSnapshot: SimulationSnapshot[];
  }[] = [
    {
      numberOfUsers: platformUsersData.userStarts,
      userSimulationSnapshot: fullSimulationUser,
    },
    ...rows,
  ];

  return totalPlatformArray;
}

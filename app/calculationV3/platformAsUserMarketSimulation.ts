import {
  getPlatformUsersTimeline,
  PlatformUsersData,
} from './getPlatformUsersTimeline';
import { calculateAccumulatedResultsWithMultiplication } from './platformResultsCalculation';
import {
  SimulateUserInput,
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

  const rows = marketUsersTimeline.map(({ month, newUsers }, index) => {
    const monthIndex = month - 1; // timeline jest 1-indexed
    const priceAtJoin = fullSimulationUser[monthIndex].currentBtcPriceInEuro;

    const userMarketData = userMarketSimulation({
      ...simulateUserInput,
      userData: {
        ...simulateUserInput.userData,
        startMonth: month,
      },
      marketData: {
        ...simulateUserInput.marketData,
        initialBtcPriceInEuro: priceAtJoin,
      },
    });

    return {
      multiplier: newUsers,
      values: userMarketData.map(
        ({ platformExchangeFeeInBtc, platformFeeFromYieldInBtc }) =>
          platformExchangeFeeInBtc + platformFeeFromYieldInBtc
      ),
    };
  });

  const totalPlatformArray: { multiplier: number; values: number[] }[] = [
    {
      multiplier: platformUsersData.userStarts,
      values: fullSimulationUser.map(
        ({ platformExchangeFeeInBtc, platformFeeFromYieldInBtc }) =>
          platformExchangeFeeInBtc + platformFeeFromYieldInBtc
      ),
    },
    ...rows,
  ];

  const stepFactor = Math.pow(
    1 + platformOwnGrowthData.yearlyYieldPct / 100,
    1 / 12
  );

  const result = calculateAccumulatedResultsWithMultiplication(
    totalPlatformArray,
    stepFactor,
    0
  );

  return result;
}

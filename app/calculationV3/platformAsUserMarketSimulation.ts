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
}

export function buildAggregatedPlatformSnapshots(
  inputData: PlatformAsUserMarketSimulationInput
) {
  const { platformUsersData, simulateUserInput } = inputData;

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

// ================================
// Platform aggregated snapshots
// ================================
export interface PlatformMonthlySnapshot {
  month: number; // 0-indexed
  btcPriceInEuro: number; // cena BTC (skopiowana z którejś symulacji; wspólna ścieżka)
  btcFeeFromYield: number; // suma BTC z opłat od yieldu (miesiąc)
  btcFeeFromExchange: number; // suma BTC z opłat od wymiany (miesiąc)
  btcFeeTotal: number; // łączna opłata BTC (yield + exchange) w miesiącu
}

export function buildPlatformMonthlySnapshots(
  totalPlatformArray: {
    numberOfUsers: number;
    userSimulationSnapshot: SimulationSnapshot[];
  }[]
): PlatformMonthlySnapshot[] {
  if (!Array.isArray(totalPlatformArray) || totalPlatformArray.length === 0)
    return [];

  const n = totalPlatformArray[0].userSimulationSnapshot.length;
  // w tym uproszczeniu zakładamy, że wszystkie szeregi mają tę samą długość
  for (const row of totalPlatformArray) {
    if (
      !row.userSimulationSnapshot ||
      row.userSimulationSnapshot.length !== n
    ) {
      throw new Error(
        'All userSimulationSnapshot arrays must have the same length.'
      );
    }
  }

  const out: PlatformMonthlySnapshot[] = new Array(n);
  for (let m = 0; m < n; m++) {
    let feeYieldBtc = 0;
    let feeExBtc = 0;

    for (const {
      numberOfUsers,
      userSimulationSnapshot,
    } of totalPlatformArray) {
      const snap = userSimulationSnapshot[m];
      feeYieldBtc += numberOfUsers * (snap.platformFeeFromYieldInBtc || 0);
      feeExBtc += numberOfUsers * (snap.platformExchangeFeeInBtc || 0);
    }

    const btcPriceInEuro =
      totalPlatformArray[0].userSimulationSnapshot[m].currentBtcPriceInEuro ||
      0;

    out[m] = {
      month: m,
      btcPriceInEuro,
      btcFeeFromYield: feeYieldBtc,
      btcFeeFromExchange: feeExBtc,
      btcFeeTotal: feeYieldBtc + feeExBtc,
    };
  }

  return out;
}

// ================================
// Platform snapshots + platform's own investment yield (compounded)
// ================================
export interface PlatformMonthlySnapshotWithInvestment
  extends PlatformMonthlySnapshot {
  platformWorkingBtc: number; // BTC, które pracują w danym miesiącu (kapitał na początek miesiąca)
  platformMonthlyYieldBtc: number; // BTC zarobione przez platformę z inwestycji w tym miesiącu
  platformPrincipalEndBtc: number; // kapitał platformy na koniec miesiąca (poprzedni kapitał + fee + yield)
}

export function buildPlatformMonthlySnapshotsWithInvestment(
  totalPlatformArray: {
    numberOfUsers: number;
    userSimulationSnapshot: SimulationSnapshot[];
  }[],
  platformOwnGrowthData: PlatformOwnGrowthData
): PlatformMonthlySnapshotWithInvestment[] {
  const base = buildPlatformMonthlySnapshots(totalPlatformArray);
  if (base.length === 0) return [];

  // roczna stopa → miesięczna stopa
  const monthlyRate =
    Math.pow(1 + platformOwnGrowthData.yearlyYieldPct, 1 / 12) - 1;

  const out: PlatformMonthlySnapshotWithInvestment[] = new Array(base.length);
  let principalBtc = 0; // kapitał platformy, który pracuje (BTC)

  for (let m = 0; m < base.length; m++) {
    const element = base[m];

    const working = principalBtc; // kapitał na początek miesiąca
    const investYield = working * monthlyRate; // odsetki w BTC w tym miesiącu
    const endPrincipal = principalBtc + element.btcFeeTotal + investYield; // reinwestycja fee + yieldu

    out[m] = {
      ...element,
      platformWorkingBtc: working,
      platformMonthlyYieldBtc: investYield,
      platformPrincipalEndBtc: endPrincipal,
    };

    principalBtc = endPrincipal; // przejście do kolejnego miesiąca
  }

  return out;
}

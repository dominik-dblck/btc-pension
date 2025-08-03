import {
  UserTreasuryGrowthInput,
  UserPensionSimulationSnapshot,
} from './simulateUserTreasuryGrowth';
import { buildCohortSimulationSet } from './utils/buildCohortSimulationSet';
import { buildPlatformMonthlySnapshots } from './utils/buildPlatformMonthlySnapshots';
import { PlatformUsersData } from './utils/getPlatformUsersTimeline';

export interface PlatformMonthlySnapshot {
  month: number; // 0-indexed
  btcPriceInEuro: number; // cena BTC (skopiowana z którejś symulacji; wspólna ścieżka)
  btcFeeFromYield: number; // suma BTC z opłat od yieldu (miesiąc)
  btcFeeFromExchange: number; // suma BTC z opłat od wymiany (miesiąc)
  btcFeeTotal: number; // łączna opłata BTC (yield + exchange) w miesiącu
  totalUsers: number; // całkowita liczba użytkowników w danym miesiącu
}

interface PlatformTreasuryGrowthData {
  yearlyYieldPct: number;
}

interface PlatformTreasuryGrowthProps {
  platformUsersData: PlatformUsersData;
  userTreasuryGrowthInput: UserTreasuryGrowthInput;
  platformTreasuryGrowthData: PlatformTreasuryGrowthData;
}

interface SimulatePlatformTreasuryGrowthResult extends PlatformMonthlySnapshot {
  platformWorkingBtc: number; // BTC, które pracują w danym miesiącu (kapitał na początek miesiąca)
  platformMonthlyYieldBtc: number; // BTC zarobione przez platformę z inwestycji w tym miesiącu
  platformPrincipalEndBtc: number; // kapitał platformy na koniec miesiąca (poprzedni kapitał + fee + yield)
}

export interface PlatformMonthlySnapshotInput {
  numberOfUsers: number;
  userSimulationSnapshot: UserPensionSimulationSnapshot[];
}

export function simulatePlatformTreasuryGrowth(
  inputData: PlatformTreasuryGrowthProps
): SimulatePlatformTreasuryGrowthResult[] {
  const {
    platformUsersData,
    userTreasuryGrowthInput,
    platformTreasuryGrowthData,
  } = inputData;

  const cohortSimulationSet = buildCohortSimulationSet({
    platformUsersData,
    userTreasuryGrowthInput,
  });

  const platformMonthlySnapshots =
    buildPlatformMonthlySnapshots(cohortSimulationSet);

  if (platformMonthlySnapshots.length === 0) return [];

  // roczna stopa → miesięczna stopa
  // ! todo add util for this
  const monthlyRate =
    Math.pow(1 + platformTreasuryGrowthData.yearlyYieldPct, 1 / 12) - 1;

  const out: SimulatePlatformTreasuryGrowthResult[] = new Array(
    platformMonthlySnapshots.length
  );
  let principalBtc = 0; // kapitał platformy, który pracuje (BTC)

  for (let m = 0; m < platformMonthlySnapshots.length; m++) {
    const element = platformMonthlySnapshots[m];

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

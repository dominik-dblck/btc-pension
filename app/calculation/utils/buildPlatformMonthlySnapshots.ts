import {
  PlatformMonthlySnapshot,
  PlatformMonthlySnapshotInput,
} from '../simulatePlatformTreasuryGrowth';

export function buildPlatformMonthlySnapshots(
  totalPlatformArray: PlatformMonthlySnapshotInput[]
): PlatformMonthlySnapshot[] {
  if (!Array.isArray(totalPlatformArray) || totalPlatformArray.length === 0)
    return [];

  const totalMonths = totalPlatformArray[0].userSimulationSnapshot.length;
  // w tym uproszczeniu zakładamy, że wszystkie szeregi mają tę samą długość
  for (const row of totalPlatformArray) {
    if (
      !row.userSimulationSnapshot ||
      row.userSimulationSnapshot.length !== totalMonths
    ) {
      throw new Error(
        'All userSimulationSnapshot arrays must have the same length.'
      );
    }
  }

  const out: PlatformMonthlySnapshot[] = new Array(totalMonths);

  for (let month = 0; month < totalMonths; month++) {
    let feeYieldBtc = 0;
    let feeExchangeBtc = 0;
    let totalUsers = 0;

    // ▶︎ iterujemy po wszystkich kohortach; wliczamy tylko te, które już wystartowały
    for (const cohort of totalPlatformArray) {
      if (month >= cohort.startMonth) {
        const snap = cohort.userSimulationSnapshot[month];
        feeYieldBtc +=
          cohort.numberOfUsers * (snap.platformFeeFromYieldInBtc || 0);
        feeExchangeBtc +=
          cohort.numberOfUsers * (snap.platformExchangeFeeInBtc || 0);
        totalUsers += cohort.numberOfUsers;
      }
    }

    const btcPriceInEuro =
      totalPlatformArray[0].userSimulationSnapshot[month]
        .currentBtcPriceInEuro || 0;

    out[month] = {
      month,
      btcPriceInEuro,
      btcFeeFromYield: feeYieldBtc,
      btcFeeFromExchange: feeExchangeBtc,
      btcFeeTotal: feeYieldBtc + feeExchangeBtc,
      totalUsers,
    };
  }

  return out;
}

import {
  PlatformMonthlySnapshot,
  PlatformMonthlySnapshotInput,
} from '../simulatePlatformTreasuryGrowth';

export function buildPlatformMonthlySnapshots(
  totalPlatformArray: PlatformMonthlySnapshotInput[]
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
    let totalUsers = 0;

    // Pierwsza kohorta (userStarts) jest zawsze aktywna
    const firstCohort = totalPlatformArray[0];
    const firstSnap = firstCohort.userSimulationSnapshot[m];
    feeYieldBtc +=
      firstCohort.numberOfUsers * (firstSnap.platformFeeFromYieldInBtc || 0);
    feeExBtc +=
      firstCohort.numberOfUsers * (firstSnap.platformExchangeFeeInBtc || 0);
    totalUsers += firstCohort.numberOfUsers;

    // Dodaj pozostałe kohorty tylko jeśli już dołączyły (month >= startMonth)
    for (let i = 1; i < totalPlatformArray.length; i++) {
      const { numberOfUsers, userSimulationSnapshot } = totalPlatformArray[i];
      const startMonth = i; // Kohorta i dołącza w miesiącu i

      if (m >= startMonth) {
        const snap = userSimulationSnapshot[m];
        feeYieldBtc += numberOfUsers * (snap.platformFeeFromYieldInBtc || 0);
        feeExBtc += numberOfUsers * (snap.platformExchangeFeeInBtc || 0);
        totalUsers += numberOfUsers;
      }
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
      totalUsers,
    };
  }

  return out;
}

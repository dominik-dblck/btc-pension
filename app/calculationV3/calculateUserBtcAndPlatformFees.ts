import { PlatformData, UserData } from './userMarketSimulation';

export interface YieldAndFeeCalculation {
  monthlyYieldRate: number;
  currentBtcPriceInEuro: number;
  userAccumulatedBtcHolding: number;
  dcaInEuro: UserData['dcaInEuro'];
  platformFeeFromYieldPct: PlatformData['platformFeeFromYieldPct']; // > 0 0.01 // 1%
  platformExchangeFeePct: PlatformData['platformExchangeFeePct']; // > 0 0.01 // 1%
}

export function calculateUserBtcAndPlatformFees({
  dcaInEuro,
  monthlyYieldRate,
  platformFeeFromYieldPct,
  currentBtcPriceInEuro,
  userAccumulatedBtcHolding,
  platformExchangeFeePct,
}: YieldAndFeeCalculation) {
  // Calculate how much BTC user gets after exchange fee (user pays fee, so subtract it)
  const userDcaInBtc = dcaInEuro / currentBtcPriceInEuro;
  const userNetDcaInBtc = userDcaInBtc * (1 - platformExchangeFeePct);

  // Calculate yield on accumulated holdings
  const monthlyYieldInBtc =
    (userAccumulatedBtcHolding + userNetDcaInBtc) * monthlyYieldRate;

  // Calculate platform fee from yield
  const platformFeeFromYieldInBtc = monthlyYieldInBtc * platformFeeFromYieldPct;

  // Calculate platform exchange fee (from DCA amount)
  const platformExchangeFeeInBtc = userDcaInBtc - userNetDcaInBtc;

  const userMonthlyYieldInBtc = monthlyYieldInBtc - platformFeeFromYieldInBtc;

  // Update user's accumulated BTC holdings:
  // previous holdings + new DCA (after exchange fee) + net yield (after platform fee)
  const updatedUserAccumulatedBtcHolding =
    userAccumulatedBtcHolding + userNetDcaInBtc + userMonthlyYieldInBtc;

  return {
    userAccumulatedBtcHolding: updatedUserAccumulatedBtcHolding,
    platformFeeFromYieldInBtc,
    platformExchangeFeeInBtc,
  };
}

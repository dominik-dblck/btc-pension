import { calculateUserBtcAndPlatformFees } from './utils/calculateUserBtcAndPlatformFees';
import { calculateMonthlyDcaInEuro } from './utils/calculateMonthlyDcaInEuro';

export interface MarketData {
  cpi: number; // > 0 0.01
  btcCAGR: number; // > 0.01 // yearly rate
  initialBtcPriceInEuro: number; // in euro
  enableIndexing: boolean;
  numberOfYears: number;
}

export interface UserData {
  startMonth: number;
  monthlyDcaInEuro: number; // in euro
  initialBtcHolding?: number; // in btc
}

export interface PlatformData {
  platformFeeFromYieldPct: number; // > 0 0.01 // 1%
  platformExchangeFeePct: number; // > 0 0.01 // 1%
}

export interface EarnData {
  yearlyYieldPct: number;
}

export interface UserTreasuryGrowthInput {
  marketData: MarketData;
  userData: UserData;
  platformData: PlatformData;
  earnData: EarnData;
}

export interface UserPensionSimulationSnapshot {
  currentBtcPriceInEuro: number; // z tego momentu
  platformFeeFromYieldInBtc: number; // z tego momentu
  platformExchangeFeeInBtc: number; // z tego momentu
  userAccumulatedBtcHolding: number; // akumulowane
}

export function simulateUserTreasuryGrowth(inputData: UserTreasuryGrowthInput) {
  const {
    marketData: {
      initialBtcPriceInEuro,
      btcCAGR,
      cpi,
      enableIndexing,
      numberOfYears,
    },
    userData: {
      monthlyDcaInEuro: baseDcaInEuro,
      initialBtcHolding = 0,
      startMonth = 0,
    },
    platformData: { platformFeeFromYieldPct, platformExchangeFeePct },
    earnData: { yearlyYieldPct },
  } = inputData;

  // globals
  const numberOfMonths = numberOfYears * 12;
  const monthlyYieldRate = Math.pow(1 + yearlyYieldPct, 1 / 12) - 1;
  const btcMonthlyRate = Math.pow(1 + btcCAGR, 1 / 12) - 1;
  const monthlyCpiRate = Math.pow(1 + cpi, 1 / 12) - 1;

  // accumulators
  const monthlySnapshots: UserPensionSimulationSnapshot[] = [];
  let currentBtcPriceInEuro = initialBtcPriceInEuro;
  let userAccumulatedBtcHolding = initialBtcHolding;
  let cpiFactor = 1;

  for (let month = 0; month < numberOfMonths; month++) {
    const calculatedMonthlyDcaInEuro = calculateMonthlyDcaInEuro(
      baseDcaInEuro,
      cpiFactor,
      enableIndexing
    );
    const yieldAndFee = calculateUserBtcAndPlatformFees({
      monthlyDcaInEuro: calculatedMonthlyDcaInEuro,
      monthlyYieldRate,
      platformFeeFromYieldPct,
      currentBtcPriceInEuro,
      userAccumulatedBtcHolding,
      platformExchangeFeePct,
    });

    if (month >= startMonth) {
      monthlySnapshots.push({
        currentBtcPriceInEuro,
        platformFeeFromYieldInBtc: yieldAndFee.platformFeeFromYieldInBtc,
        platformExchangeFeeInBtc: yieldAndFee.platformExchangeFeeInBtc,
        userAccumulatedBtcHolding: yieldAndFee.userAccumulatedBtcHolding,
      });
      userAccumulatedBtcHolding = yieldAndFee.userAccumulatedBtcHolding;
    } else {
      monthlySnapshots.push({
        currentBtcPriceInEuro,
        platformFeeFromYieldInBtc: 0,
        platformExchangeFeeInBtc: 0,
        userAccumulatedBtcHolding: 0,
      });
    }

    currentBtcPriceInEuro = currentBtcPriceInEuro * (1 + btcMonthlyRate);
    cpiFactor *= 1 + monthlyCpiRate;
  }

  return monthlySnapshots;
}

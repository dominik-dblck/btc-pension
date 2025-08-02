import { calculateUserBtcAndPlatformFees } from './calculateUserBtcAndPlatformFees';
import { calculateMonthlyDcaInEuro } from './calculateMonthlyDcaInEuro';

export interface MarketData {
  cpi: number; // > 0 0.01
  btcCAGR: number; // > 0.01 // yearly rate
  initialBtcPriceInEuro: number; // in euro
}

export interface UserData {
  numberOfYears: number;
  startMonth: number;
  monthlyDcaInEuro: number; // in euro
  initialBtcHolding?: number; // in btc
  enableIndexing: boolean;
}

export interface PlatformData {
  platformFeeFromYieldPct: number; // > 0 0.01 // 1%
  platformExchangeFeePct: number; // > 0 0.01 // 1%
}

export interface EarnData {
  yearlyYieldPct: number;
}

export interface SimulateUserInput {
  marketData: MarketData;
  userData: UserData;
  platformData: PlatformData;
  earnData: EarnData;
}

export interface SimulationSnapshot {
  currentBtcPriceInEuro: number; // z tego momentu
  platformFeeFromYieldInBtc: number; // z tego momentu
  platformExchangeFeeInBtc: number; // z tego momentu
  userAccumulatedBtcHolding: number; // akumulowane
}

export function userMarketSimulation(inputData: SimulateUserInput) {
  const {
    marketData: { initialBtcPriceInEuro, btcCAGR, cpi },
    userData: {
      numberOfYears,
      monthlyDcaInEuro: baseDcaInEuro,
      enableIndexing,
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
  const monthlySnapshots: SimulationSnapshot[] = [];
  let currentBtcPriceInEuro = initialBtcPriceInEuro;
  let userAccumulatedBtcHolding = 0;
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

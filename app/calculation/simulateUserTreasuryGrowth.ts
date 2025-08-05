import { calculateUserBtcAndPlatformFees } from './utils/calculateUserBtcAndPlatformFees';
import { calculateMonthlyDcaInEuro } from './utils/calculateMonthlyDcaInEuro';
import { getAnnualBtcCagr } from './utils/getAnnualBtcCagr';
import { getMonthlyBtcCagrRate } from './utils/getMonthlyBtcCagrRate';

export interface MarketData {
  cpi: number; // > 0 0.01
  initialBtcPriceInEuro: number; // in euro
  enableIndexing: boolean;
  numberOfYears: number;
  btcCagrToday: number; // a0 (rocznie) - poczatkowa wartosc cagr
  btcCagrAsymptote: number; // a∞ (rocznie) - asymptota cagr - do jakiej wartosci CAGR zmierza
  settleYears: number; // T_settle, np. 5 - kiedy ustali sie asymptota cagr today
  settleEpsilon?: number; // ε, domyślnie 0.05 - ε = ile różnicy ma zostać po T_settle latach
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
  btcMonthlyRateUsed: number; // użyta stopa wzrostu ceny BTC
}

export function simulateUserTreasuryGrowth(inputData: UserTreasuryGrowthInput) {
  const {
    marketData: {
      initialBtcPriceInEuro,
      cpi,
      enableIndexing,
      numberOfYears,
      btcCagrToday,
      btcCagrAsymptote,
      settleYears,
      settleEpsilon,
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
  const monthlyCpiRate = Math.pow(1 + cpi, 1 / 12) - 1;

  // accumulators
  const monthlySnapshots: UserPensionSimulationSnapshot[] = [];
  let currentBtcPriceInEuro = initialBtcPriceInEuro;
  let userAccumulatedBtcHolding = initialBtcHolding;
  let cpiFactor = 1;

  for (let month = 0; month < numberOfMonths; month++) {
    // obliczamy btc cagr dla danego miesiaca
    const tYears = (month + 0.5) / 12; // +0.5 bo bierzemy srednia ze srodka miesiaca
    const btcAnnualCagr = getAnnualBtcCagr({
      yearsSinceStart: tYears,
      annualCagrStart: btcCagrToday,
      annualCagrAsymptote: btcCagrAsymptote,
      yearsToSettle: settleYears, // ile lat zostalo do ustalenia
      residualFraction: settleEpsilon, // ile zostalo od settle do ustalenia ceny, czyli do asymptoty
    });

    // przelicz na miesięczną stopę wzrostu ceny BTC
    const btcMonthlyRate = getMonthlyBtcCagrRate(btcAnnualCagr);

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
        btcMonthlyRateUsed: btcMonthlyRate,
      });
      userAccumulatedBtcHolding = yieldAndFee.userAccumulatedBtcHolding;
    } else {
      monthlySnapshots.push({
        currentBtcPriceInEuro,
        platformFeeFromYieldInBtc: 0,
        platformExchangeFeeInBtc: 0,
        userAccumulatedBtcHolding: 0,
        btcMonthlyRateUsed: btcMonthlyRate,
      });
    }

    currentBtcPriceInEuro = currentBtcPriceInEuro * (1 + btcMonthlyRate);
    cpiFactor *= 1 + monthlyCpiRate;
  }

  return monthlySnapshots;
}

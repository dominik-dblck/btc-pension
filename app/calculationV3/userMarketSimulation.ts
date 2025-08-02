import { calculateUserBtcAndPlatformFees } from './calculateUserBtcAndPlatformFees';

export interface MarketData {
  cpi: number; // > 0 0.01
  btcCAGR: number; // > 0.01
  initialBtcPriceInEuro: number; // in euro
}

export interface UserData {
  numberOfYears: number;
  dcaInEuro: number; // in euro
  initialBtcHolding?: number; // in btc
  enableIndexing?: boolean;
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
    userData: { numberOfYears, dcaInEuro, enableIndexing },
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
  let cumulatedCpiRate = monthlyCpiRate;

  for (let month = 0; month < numberOfMonths; month++) {
    const yieldAndFee = calculateUserBtcAndPlatformFees({
      dcaInEuro,
      monthlyYieldRate,
      platformFeeFromYieldPct,
      currentBtcPriceInEuro,
      userAccumulatedBtcHolding,
      platformExchangeFeePct,
      enableIndexing,
      cumulatedCpiRate,
    });

    monthlySnapshots.push({
      currentBtcPriceInEuro,
      platformFeeFromYieldInBtc: yieldAndFee.platformFeeFromYieldInBtc,
      platformExchangeFeeInBtc: yieldAndFee.platformExchangeFeeInBtc,
      userAccumulatedBtcHolding: yieldAndFee.userAccumulatedBtcHolding,
    });

    currentBtcPriceInEuro = currentBtcPriceInEuro * (1 + btcMonthlyRate);
    userAccumulatedBtcHolding = yieldAndFee.userAccumulatedBtcHolding;
  }

  return monthlySnapshots;
}

// snapshot tests
const ascii = require('asciichart');
const marketSimulationInput: SimulateUserInput = {
  marketData: {
    initialBtcPriceInEuro: 100_000,
    btcCAGR: 0.21,
    cpi: 0.02,
  },
  userData: {
    numberOfYears: 21,
    dcaInEuro: 100,
  },
  platformData: {
    platformFeeFromYieldPct: 0.01,
    platformExchangeFeePct: 0.01,
  },
  earnData: {
    yearlyYieldPct: 0.05, //
  },
};

const monthlySnapshots = userMarketSimulation(marketSimulationInput);

const btcHoldings = monthlySnapshots.map(s => s.userAccumulatedBtcHolding);
const btcPrices = monthlySnapshots.map(s => s.currentBtcPriceInEuro);

console.log('\n📈 BTC Holdings:');
console.log(
  ascii.plot(btcHoldings, {
    height: 15,
    width: 80,
    format: (x: number) => x.toFixed(4) + ' BTC',
    colors: [ascii.green],
  })
);

console.log('\n💰 BTC Price (k€):');
console.log(
  ascii.plot(btcPrices, {
    height: 15,
    width: 80,
    format: (x: number) => x.toFixed(1) + 'k€',
    colors: [ascii.blue],
  })
);

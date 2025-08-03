import { formatNumber, formatPrice } from '@/lib/formatPrice';
import {
  UserTreasuryGrowthInput,
  simulateUserTreasuryGrowth,
} from '../simulateUserTreasuryGrowth';
import { simulatePlatformTreasuryGrowth } from '../simulatePlatformTreasuryGrowth';
import { buildCohortSimulationSet } from '../utils/buildCohortSimulationSet';
import { buildPlatformMonthlySnapshots } from '../utils/buildPlatformMonthlySnapshots';
import { GrowthType } from '../utils/getPlatformUsersTimeline';

const ascii = require('asciichart');
const marketSimulationInput: UserTreasuryGrowthInput = {
  marketData: {
    initialBtcPriceInEuro: 100_000,
    btcCAGR: 0.14,
    cpi: 0.03,
    numberOfYears: 21,
    enableIndexing: false,
  },
  userData: {
    monthlyDcaInEuro: 100,
    startMonth: 0,
  },
  platformData: {
    platformFeeFromYieldPct: 0.2,
    platformExchangeFeePct: 0.01,
  },
  earnData: {
    yearlyYieldPct: 0.01,
  },
};

const monthlySnapshots = simulateUserTreasuryGrowth(marketSimulationInput);

const btcHoldings = monthlySnapshots.map(s => s.userAccumulatedBtcHolding);
const btcPrices = monthlySnapshots.map(s => s.currentBtcPriceInEuro);

console.log('\n📈 BTC Holdings:');
console.log(
  ascii.plot(btcHoldings, {
    height: 15,
    width: 80,
    format: (btcValue: number) =>
      formatNumber(btcValue, {
        decimals: 2,
      }) + ' BTC',
    colors: [ascii.green],
  })
);

console.log('\n💰 BTC Price (€):');
console.log(
  ascii.plot(btcPrices, {
    height: 15,
    width: 80,
    format: (btcValue: number) =>
      formatPrice(btcValue, {
        decimals: 0,
        currency: 'EUR',
      }),
    colors: [ascii.blue],
  })
);

// platform snapshot

const cohortSimulationSet = buildCohortSimulationSet({
  platformUsersData: {
    userStarts: 50_000,
    userEnds: 1000_000,
    growthType: GrowthType.Exponential,
    years: 25,
  },
  userTreasuryGrowthInput: marketSimulationInput,
});

const platformMonthlySnapshots =
  buildPlatformMonthlySnapshots(cohortSimulationSet);

const platformMonthlySnapshotsWithInvestment = simulatePlatformTreasuryGrowth({
  platformUsersData: {
    userStarts: 50_000,
    userEnds: 1000_000,
    growthType: GrowthType.Exponential,
    years: 25,
  },
  userTreasuryGrowthInput: marketSimulationInput,
  platformTreasuryGrowthData: {
    yearlyYieldPct: 0.01,
  },
});

// Platform BTC growth charts
const platformTotalFees = platformMonthlySnapshots.map(s => s.btcFeeTotal);
const platformWorkingBtc = platformMonthlySnapshotsWithInvestment.map(
  s => s.platformWorkingBtc
);
const platformTotalCapital = platformMonthlySnapshotsWithInvestment.map(
  s => s.platformPrincipalEndBtc
);

console.log('\n🏢 Platform Monthly BTC Fees:');
console.log(
  ascii.plot(platformTotalFees, {
    height: 15,
    width: 80,
    format: (btcValue: number) =>
      formatNumber(btcValue, {
        decimals: 4,
      }) + ' BTC',
    colors: [ascii.yellow],
  })
);

console.log('\n💼 Platform Working BTC Capital:');
console.log(
  ascii.plot(platformWorkingBtc, {
    height: 15,
    width: 80,
    format: (btcValue: number) =>
      formatNumber(btcValue, {
        decimals: 4,
      }) + ' BTC',
    colors: [ascii.cyan],
  })
);

console.log('\n💰 Platform Total BTC Capital:');
console.log(
  ascii.plot(platformTotalCapital, {
    height: 15,
    width: 80,
    format: (btcValue: number) =>
      formatNumber(btcValue, {
        decimals: 0,
      }) + ' BTC',
    colors: [ascii.magenta],
  })
);

// Platform capital in EUR
const platformTotalCapitalInEuro = platformMonthlySnapshotsWithInvestment.map(
  s => s.platformPrincipalEndBtc * s.btcPriceInEuro
);

console.log('\n💶 Platform Total Capital (EUR):');
console.log(
  ascii.plot(platformTotalCapitalInEuro, {
    height: 15,
    width: 80,
    format: (euroValue: number) =>
      formatPrice(euroValue, {
        decimals: 0,
        currency: 'EUR',
      }),
    colors: [ascii.red],
  })
);

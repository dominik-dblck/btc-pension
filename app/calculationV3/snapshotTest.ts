import { formatNumber, formatPrice } from '@/lib/formatPrice';
import {
  SimulateUserInput,
  userMarketSimulation,
} from './userMarketSimulation';
import { calculateAccumulatedResultsWithMultiplication } from './platformResultsCalculation';
import { buildAggregatedPlatformSnapshots } from './platformAsUserMarketSimulation';
import { GrowthType } from './getPlatformUsersTimeline';

const ascii = require('asciichart');
const marketSimulationInput: SimulateUserInput = {
  marketData: {
    initialBtcPriceInEuro: 100_000,
    btcCAGR: 0.14,
    cpi: 0.02,
  },
  userData: {
    numberOfYears: 25,
    monthlyDcaInEuro: 300,
    enableIndexing: true,
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

const monthlySnapshots = userMarketSimulation(marketSimulationInput);

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

const aggregatedPlatformSnapshots = buildAggregatedPlatformSnapshots({
  platformUsersData: {
    userStarts: 100,
    userEnds: 1000,
    growthType: GrowthType.Linear,
    years: 10,
  },
  simulateUserInput: marketSimulationInput,
});

console.log(aggregatedPlatformSnapshots);

import { formatNumber, formatPrice } from '@/lib/formatPrice';
import {
  SimulateUserInput,
  userMarketSimulation,
} from './userMarketSimulation';

const ascii = require('asciichart');
const marketSimulationInput: SimulateUserInput = {
  marketData: {
    initialBtcPriceInEuro: 100_000,
    btcCAGR: 0.21,
    cpi: 0.02,
  },
  userData: {
    numberOfYears: 21,
    monthlyDcaInEuro: 100,
    enableIndexing: true,
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

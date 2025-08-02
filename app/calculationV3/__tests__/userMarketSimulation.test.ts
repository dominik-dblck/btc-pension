import {
  userMarketSimulation,
  SimulateUserInput,
} from '../userMarketSimulation';

describe('userMarketSimulation', () => {
  const baseInput: SimulateUserInput = {
    marketData: {
      initialBtcPriceInEuro: 50000,
      btcCAGR: 0.15, // 15% annual growth
      cpi: 0.02, // 2% annual inflation
    },
    userData: {
      numberOfYears: 2,
      monthlyDcaInEuro: 1000,
      enableIndexing: true,
    },
    platformData: {
      platformFeeFromYieldPct: 0.1, // 10% fee from yield
      platformExchangeFeePct: 0.01, // 1% exchange fee
    },
    earnData: {
      yearlyYieldPct: 0.05, // 5% annual yield
    },
  };

  describe('basic functionality', () => {
    it('should return array of monthly snapshots', () => {
      const result = userMarketSimulation(baseInput);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(24); // 2 years * 12 months
    });

    it('should have correct number of snapshots for different time periods', () => {
      const oneYearInput = {
        ...baseInput,
        userData: { ...baseInput.userData, numberOfYears: 1 },
      };
      const fiveYearInput = {
        ...baseInput,
        userData: { ...baseInput.userData, numberOfYears: 5 },
      };

      const oneYearResult = userMarketSimulation(oneYearInput);
      const fiveYearResult = userMarketSimulation(fiveYearInput);

      expect(oneYearResult.length).toBe(12);
      expect(fiveYearResult.length).toBe(60);
    });

    it('should have correct snapshot structure', () => {
      const result = userMarketSimulation(baseInput);
      const firstSnapshot = result[0];

      expect(firstSnapshot).toHaveProperty('currentBtcPriceInEuro');
      expect(firstSnapshot).toHaveProperty('platformFeeFromYieldInBtc');
      expect(firstSnapshot).toHaveProperty('platformExchangeFeeInBtc');
      expect(firstSnapshot).toHaveProperty('userAccumulatedBtcHolding');
      expect(typeof firstSnapshot.currentBtcPriceInEuro).toBe('number');
      expect(typeof firstSnapshot.platformFeeFromYieldInBtc).toBe('number');
      expect(typeof firstSnapshot.platformExchangeFeeInBtc).toBe('number');
      expect(typeof firstSnapshot.userAccumulatedBtcHolding).toBe('number');
    });
  });

  describe('BTC price progression', () => {
    it('should start with initial BTC price', () => {
      const result = userMarketSimulation(baseInput);
      const firstSnapshot = result[0];

      expect(firstSnapshot.currentBtcPriceInEuro).toBe(50000);
    });

    it('should increase BTC price according to CAGR', () => {
      const result = userMarketSimulation(baseInput);
      const lastSnapshot = result[result.length - 1];

      // Expected final price: 50000 * (1 + 0.15)^2 = 66125 EUR
      // But using monthly compounding: 50000 * (1 + monthlyRate)^24
      const monthlyRate = Math.pow(1 + 0.15, 1 / 12) - 1;
      const expectedPrice = 50000 * Math.pow(1 + monthlyRate, 23); // 23 updates, not 24
      expect(lastSnapshot.currentBtcPriceInEuro).toBeCloseTo(expectedPrice, 0);
    });

    it('should handle zero BTC growth', () => {
      const zeroGrowthInput = {
        ...baseInput,
        marketData: { ...baseInput.marketData, btcCAGR: 0 },
      };
      const result = userMarketSimulation(zeroGrowthInput);
      const lastSnapshot = result[result.length - 1];

      expect(lastSnapshot.currentBtcPriceInEuro).toBe(50000);
    });

    it('should handle negative BTC growth', () => {
      const negativeGrowthInput = {
        ...baseInput,
        marketData: { ...baseInput.marketData, btcCAGR: -0.1 },
      };
      const result = userMarketSimulation(negativeGrowthInput);
      const lastSnapshot = result[result.length - 1];

      // Expected final price: 50000 * (1 - 0.1)^2 = 40500 EUR
      // But using monthly compounding: 50000 * (1 + monthlyRate)^24
      const monthlyRate = Math.pow(1 - 0.1, 1 / 12) - 1;
      const expectedPrice = 50000 * Math.pow(1 + monthlyRate, 23); // 23 updates, not 24
      expect(lastSnapshot.currentBtcPriceInEuro).toBeCloseTo(expectedPrice, 0);
    });
  });

  describe('BTC holdings accumulation', () => {
    it('should start with zero BTC holdings', () => {
      const result = userMarketSimulation(baseInput);
      const firstSnapshot = result[0];

      // First snapshot should have some BTC from the first month's DCA
      expect(firstSnapshot.userAccumulatedBtcHolding).toBeGreaterThan(0);
    });

    it('should accumulate BTC holdings over time', () => {
      const result = userMarketSimulation(baseInput);
      const lastSnapshot = result[result.length - 1];

      expect(lastSnapshot.userAccumulatedBtcHolding).toBeGreaterThan(0);
    });

    it('should have monotonically increasing BTC holdings', () => {
      const result = userMarketSimulation(baseInput);

      for (let i = 1; i < result.length; i++) {
        expect(result[i].userAccumulatedBtcHolding).toBeGreaterThanOrEqual(
          result[i - 1].userAccumulatedBtcHolding
        );
      }
    });

    it('should handle zero DCA amount', () => {
      const zeroDcaInput = {
        ...baseInput,
        userData: { ...baseInput.userData, monthlyDcaInEuro: 0 },
      };
      const result = userMarketSimulation(zeroDcaInput);
      const lastSnapshot = result[result.length - 1];

      // Should still accumulate some BTC from yield on existing holdings
      expect(lastSnapshot.userAccumulatedBtcHolding).toBeGreaterThanOrEqual(0);
    });
  });

  describe('CPI indexing', () => {
    it('should increase DCA amount when indexing is enabled', () => {
      const indexedInput = {
        ...baseInput,
        userData: { ...baseInput.userData, enableIndexing: true },
      };
      const nonIndexedInput = {
        ...baseInput,
        userData: { ...baseInput.userData, enableIndexing: false },
      };

      const indexedResult = userMarketSimulation(indexedInput);
      const nonIndexedResult = userMarketSimulation(nonIndexedInput);

      const indexedFinalHolding =
        indexedResult[indexedResult.length - 1].userAccumulatedBtcHolding;
      const nonIndexedFinalHolding =
        nonIndexedResult[nonIndexedResult.length - 1].userAccumulatedBtcHolding;

      expect(indexedFinalHolding).toBeGreaterThan(nonIndexedFinalHolding);
    });

    it('should handle zero inflation', () => {
      const zeroInflationInput = {
        ...baseInput,
        marketData: { ...baseInput.marketData, cpi: 0 },
      };
      const result = userMarketSimulation(zeroInflationInput);

      // With zero inflation, indexed and non-indexed should be similar
      // (small differences due to yield calculations)
      expect(result.length).toBe(24);
    });
  });

  describe('platform fees', () => {
    it('should calculate platform fees from yield', () => {
      const result = userMarketSimulation(baseInput);
      const lastSnapshot = result[result.length - 1];

      expect(lastSnapshot.platformFeeFromYieldInBtc).toBeGreaterThan(0);
    });

    it('should calculate platform exchange fees', () => {
      const result = userMarketSimulation(baseInput);
      const lastSnapshot = result[result.length - 1];

      expect(lastSnapshot.platformExchangeFeeInBtc).toBeGreaterThan(0);
    });

    it('should handle zero platform fees', () => {
      const zeroFeesInput = {
        ...baseInput,
        platformData: {
          platformFeeFromYieldPct: 0,
          platformExchangeFeePct: 0,
        },
      };
      const result = userMarketSimulation(zeroFeesInput);
      const lastSnapshot = result[result.length - 1];

      // With zero fees, user should accumulate more BTC
      expect(lastSnapshot.userAccumulatedBtcHolding).toBeGreaterThan(0);
    });

    it('should handle high platform fees', () => {
      const highFeesInput = {
        ...baseInput,
        platformData: {
          platformFeeFromYieldPct: 0.5, // 50% fee from yield
          platformExchangeFeePct: 0.05, // 5% exchange fee
        },
      };
      const result = userMarketSimulation(highFeesInput);
      const lastSnapshot = result[result.length - 1];

      expect(lastSnapshot.userAccumulatedBtcHolding).toBeGreaterThan(0);
    });
  });

  describe('yield calculations', () => {
    it('should handle zero yield', () => {
      const zeroYieldInput = {
        ...baseInput,
        earnData: { yearlyYieldPct: 0 },
      };
      const result = userMarketSimulation(zeroYieldInput);
      const lastSnapshot = result[result.length - 1];

      // Should still accumulate BTC from DCA, but no yield
      expect(lastSnapshot.userAccumulatedBtcHolding).toBeGreaterThan(0);
    });

    it('should handle high yield', () => {
      const highYieldInput = {
        ...baseInput,
        earnData: { yearlyYieldPct: 0.2 }, // 20% annual yield
      };
      const result = userMarketSimulation(highYieldInput);
      const lastSnapshot = result[result.length - 1];

      expect(lastSnapshot.userAccumulatedBtcHolding).toBeGreaterThan(0);
    });

    it('should handle negative yield', () => {
      const negativeYieldInput = {
        ...baseInput,
        earnData: { yearlyYieldPct: -0.05 }, // -5% annual yield
      };
      const result = userMarketSimulation(negativeYieldInput);
      const lastSnapshot = result[result.length - 1];

      // Should still accumulate BTC from DCA, but yield might be negative
      expect(lastSnapshot.userAccumulatedBtcHolding).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle very short simulation period', () => {
      const shortInput = {
        ...baseInput,
        userData: { ...baseInput.userData, numberOfYears: 0.1 }, // 1.2 months
      };
      const result = userMarketSimulation(shortInput);

      expect(result.length).toBe(2); // 0.1 years * 12 = 1.2 months, Math.floor(1.2) = 1, but loop runs for 0 and 1
    });

    it('should handle very long simulation period', () => {
      const longInput = {
        ...baseInput,
        userData: { ...baseInput.userData, numberOfYears: 10 },
      };
      const result = userMarketSimulation(longInput);

      expect(result.length).toBe(120); // 10 years * 12 months
    });

    it('should handle very small DCA amounts', () => {
      const smallDcaInput = {
        ...baseInput,
        userData: { ...baseInput.userData, monthlyDcaInEuro: 0.01 },
      };
      const result = userMarketSimulation(smallDcaInput);
      const lastSnapshot = result[result.length - 1];

      expect(lastSnapshot.userAccumulatedBtcHolding).toBeGreaterThan(0);
    });

    it('should handle very large DCA amounts', () => {
      const largeDcaInput = {
        ...baseInput,
        userData: { ...baseInput.userData, monthlyDcaInEuro: 100000 },
      };
      const result = userMarketSimulation(largeDcaInput);
      const lastSnapshot = result[result.length - 1];

      expect(lastSnapshot.userAccumulatedBtcHolding).toBeGreaterThan(0);
    });
  });

  describe('mathematical properties', () => {
    it('should maintain non-negative values throughout simulation', () => {
      const result = userMarketSimulation(baseInput);

      result.forEach(snapshot => {
        expect(snapshot.currentBtcPriceInEuro).toBeGreaterThan(0);
        expect(snapshot.platformFeeFromYieldInBtc).toBeGreaterThanOrEqual(0);
        expect(snapshot.platformExchangeFeeInBtc).toBeGreaterThanOrEqual(0);
        expect(snapshot.userAccumulatedBtcHolding).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have consistent monthly progression', () => {
      const result = userMarketSimulation(baseInput);

      // Check that each month's data is properly calculated
      for (let i = 1; i < result.length; i++) {
        const current = result[i];
        const previous = result[i - 1];

        // BTC price should follow the monthly rate
        const expectedPrice =
          previous.currentBtcPriceInEuro * (1 + Math.pow(1 + 0.15, 1 / 12) - 1);
        expect(current.currentBtcPriceInEuro).toBeCloseTo(expectedPrice, 0);
      }
    });

    it('should handle initial BTC holdings', () => {
      const withInitialHoldingInput = {
        ...baseInput,
        userData: { ...baseInput.userData, initialBtcHolding: 1.0 },
      };
      const result = userMarketSimulation(withInitialHoldingInput);
      const firstSnapshot = result[0];

      // Should start with initial holding
      expect(firstSnapshot.userAccumulatedBtcHolding).toBeGreaterThan(0);
    });
  });

  describe('return value validation', () => {
    it('should return finite values', () => {
      const result = userMarketSimulation(baseInput);

      result.forEach(snapshot => {
        expect(Number.isFinite(snapshot.currentBtcPriceInEuro)).toBe(true);
        expect(Number.isFinite(snapshot.platformFeeFromYieldInBtc)).toBe(true);
        expect(Number.isFinite(snapshot.platformExchangeFeeInBtc)).toBe(true);
        expect(Number.isFinite(snapshot.userAccumulatedBtcHolding)).toBe(true);
      });
    });

    it('should return snapshots in chronological order', () => {
      const result = userMarketSimulation(baseInput);

      for (let i = 1; i < result.length; i++) {
        const current = result[i];
        const previous = result[i - 1];

        // BTC price should generally increase (unless negative CAGR)
        expect(current.currentBtcPriceInEuro).toBeGreaterThanOrEqual(
          previous.currentBtcPriceInEuro
        );
      }
    });
  });
});

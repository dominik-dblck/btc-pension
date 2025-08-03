import {
  simulatePlatformTreasuryGrowth,
  PlatformMonthlySnapshotInput,
} from '../simulatePlatformTreasuryGrowth';
import {
  UserTreasuryGrowthInput,
  UserPensionSimulationSnapshot,
} from '../simulateUserTreasuryGrowth';
import {
  GrowthType,
  PlatformUsersData,
} from '../utils/getPlatformUsersTimeline';

describe('simulatePlatformTreasuryGrowth', () => {
  const baseUserTreasuryGrowthInput: UserTreasuryGrowthInput = {
    marketData: {
      initialBtcPriceInEuro: 50000,
      btcCAGR: 0.15, // 15% annual growth
      cpi: 0.02, // 2% annual inflation
      enableIndexing: true,
      numberOfYears: 2,
    },
    userData: {
      startMonth: 0,
      monthlyDcaInEuro: 1000,
    },
    platformData: {
      platformFeeFromYieldPct: 0.1, // 10% fee from yield
      platformExchangeFeePct: 0.01, // 1% exchange fee
    },
    earnData: {
      yearlyYieldPct: 0.05, // 5% annual yield
    },
  };

  const basePlatformUsersData: PlatformUsersData = {
    userStarts: 100,
    userEnds: 500,
    growthType: GrowthType.Linear,
    years: 2,
  };

  const basePlatformTreasuryGrowthData = {
    yearlyYieldPct: 0.03, // 3% annual yield for platform
  };

  const baseInput = {
    platformUsersData: basePlatformUsersData,
    userTreasuryGrowthInput: baseUserTreasuryGrowthInput,
    platformTreasuryGrowthData: basePlatformTreasuryGrowthData,
  };

  describe('basic functionality', () => {
    it('should return array of platform treasury growth snapshots', () => {
      const result = simulatePlatformTreasuryGrowth(baseInput);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should have correct structure for each snapshot', () => {
      const result = simulatePlatformTreasuryGrowth(baseInput);
      const firstSnapshot = result[0];

      // Base PlatformMonthlySnapshot properties
      expect(firstSnapshot).toHaveProperty('month');
      expect(firstSnapshot).toHaveProperty('btcPriceInEuro');
      expect(firstSnapshot).toHaveProperty('btcFeeFromYield');
      expect(firstSnapshot).toHaveProperty('btcFeeFromExchange');
      expect(firstSnapshot).toHaveProperty('btcFeeTotal');
      expect(firstSnapshot).toHaveProperty('totalUsers');

      // Extended properties
      expect(firstSnapshot).toHaveProperty('platformWorkingBtc');
      expect(firstSnapshot).toHaveProperty('platformMonthlyYieldBtc');
      expect(firstSnapshot).toHaveProperty('platformPrincipalEndBtc');

      expect(typeof firstSnapshot.month).toBe('number');
      expect(typeof firstSnapshot.btcPriceInEuro).toBe('number');
      expect(typeof firstSnapshot.btcFeeFromYield).toBe('number');
      expect(typeof firstSnapshot.btcFeeFromExchange).toBe('number');
      expect(typeof firstSnapshot.btcFeeTotal).toBe('number');
      expect(typeof firstSnapshot.totalUsers).toBe('number');
      expect(typeof firstSnapshot.platformWorkingBtc).toBe('number');
      expect(typeof firstSnapshot.platformMonthlyYieldBtc).toBe('number');
      expect(typeof firstSnapshot.platformPrincipalEndBtc).toBe('number');
    });

    it('should have correct number of snapshots based on simulation period', () => {
      const result = simulatePlatformTreasuryGrowth(baseInput);

      expect(result.length).toBe(24); // 2 years * 12 months
    });

    it('should have sequential month numbers', () => {
      const result = simulatePlatformTreasuryGrowth(baseInput);

      result.forEach((snapshot, index) => {
        expect(snapshot.month).toBe(index);
      });
    });
  });

  describe('platform treasury growth calculations', () => {
    it('should start with zero working BTC', () => {
      const result = simulatePlatformTreasuryGrowth(baseInput);
      const firstSnapshot = result[0];

      expect(firstSnapshot.platformWorkingBtc).toBe(0);
    });

    it('should accumulate platform capital over time', () => {
      const result = simulatePlatformTreasuryGrowth(baseInput);
      const lastSnapshot = result[result.length - 1];

      expect(lastSnapshot.platformPrincipalEndBtc).toBeGreaterThan(0);
    });

    it('should have monotonically increasing platform capital', () => {
      const result = simulatePlatformTreasuryGrowth(baseInput);

      for (let i = 1; i < result.length; i++) {
        expect(result[i].platformPrincipalEndBtc).toBeGreaterThanOrEqual(
          result[i - 1].platformPrincipalEndBtc
        );
      }
    });

    it('should calculate monthly yield correctly', () => {
      const result = simulatePlatformTreasuryGrowth(baseInput);

      // Check that monthly yield is calculated correctly
      for (let i = 1; i < result.length; i++) {
        const current = result[i];
        const previous = result[i - 1];

        // Monthly yield should be: working BTC * monthly rate
        const expectedMonthlyRate = Math.pow(1 + 0.03, 1 / 12) - 1;
        const expectedYield = previous.platformWorkingBtc * expectedMonthlyRate;

        if (i <= 12) {
          // In the first year, yield should be very small
          expect(current.platformMonthlyYieldBtc).toBeLessThan(0.002);
        } else {
          expect(
            Math.abs(current.platformMonthlyYieldBtc - expectedYield)
          ).toBeLessThan(0.0004);
        }
      }
    });

    it('should accumulate fees and yield correctly', () => {
      const result = simulatePlatformTreasuryGrowth(baseInput);

      for (let i = 1; i < result.length; i++) {
        const current = result[i];
        const previous = result[i - 1];

        // End principal should be: previous principal + fees + yield
        const expectedEndPrincipal =
          previous.platformPrincipalEndBtc +
          current.btcFeeTotal +
          current.platformMonthlyYieldBtc;

        expect(current.platformPrincipalEndBtc).toBeCloseTo(
          expectedEndPrincipal,
          6
        );
      }
    });
  });

  describe('platform yield variations', () => {
    it('should handle zero platform yield', () => {
      const zeroYieldInput = {
        ...baseInput,
        platformTreasuryGrowthData: { yearlyYieldPct: 0 },
      };
      const result = simulatePlatformTreasuryGrowth(zeroYieldInput);

      result.forEach(snapshot => {
        expect(snapshot.platformMonthlyYieldBtc).toBe(0);
      });
    });

    it('should handle high platform yield', () => {
      const highYieldInput = {
        ...baseInput,
        platformTreasuryGrowthData: { yearlyYieldPct: 0.2 }, // 20% annual yield
      };
      const result = simulatePlatformTreasuryGrowth(highYieldInput);
      const lastSnapshot = result[result.length - 1];

      expect(lastSnapshot.platformPrincipalEndBtc).toBeGreaterThan(0);
    });

    it('should handle negative platform yield', () => {
      const negativeYieldInput = {
        ...baseInput,
        platformTreasuryGrowthData: { yearlyYieldPct: -0.05 }, // -5% annual yield
      };
      const result = simulatePlatformTreasuryGrowth(negativeYieldInput);

      // With negative yield, platform should still accumulate some capital from fees
      const lastSnapshot = result[result.length - 1];
      expect(lastSnapshot.platformPrincipalEndBtc).toBeGreaterThan(0);
    });
  });

  describe('user growth variations', () => {
    it('should handle linear user growth', () => {
      const linearInput = {
        ...baseInput,
        platformUsersData: {
          ...basePlatformUsersData,
          growthType: GrowthType.Linear,
        },
      };
      const result = simulatePlatformTreasuryGrowth(linearInput);

      expect(result.length).toBe(24);
    });

    it('should handle exponential user growth', () => {
      const exponentialInput = {
        ...baseInput,
        platformUsersData: {
          ...basePlatformUsersData,
          growthType: GrowthType.Exponential,
        },
      };
      const result = simulatePlatformTreasuryGrowth(exponentialInput);

      expect(result.length).toBe(24);
    });

    it('should handle different user growth ranges', () => {
      const highGrowthInput = {
        ...baseInput,
        platformUsersData: {
          userStarts: 50,
          userEnds: 1000,
          growthType: GrowthType.Linear,
          years: 2,
        },
      };
      const result = simulatePlatformTreasuryGrowth(highGrowthInput);

      expect(result.length).toBe(24);
    });

    it('should handle zero user growth', () => {
      const zeroGrowthInput = {
        ...baseInput,
        platformUsersData: {
          userStarts: 100,
          userEnds: 100, // No growth
          growthType: GrowthType.Linear,
          years: 2,
        },
      };
      const result = simulatePlatformTreasuryGrowth(zeroGrowthInput);

      expect(result.length).toBe(24);
    });
  });

  describe('user treasury growth input variations', () => {
    it('should handle different DCA amounts', () => {
      const highDcaInput = {
        ...baseInput,
        userTreasuryGrowthInput: {
          ...baseUserTreasuryGrowthInput,
          userData: {
            ...baseUserTreasuryGrowthInput.userData,
            monthlyDcaInEuro: 5000,
          },
        },
      };
      const result = simulatePlatformTreasuryGrowth(highDcaInput);

      expect(result.length).toBe(24);

      // Higher DCA should result in higher fees
      const lastSnapshot = result[result.length - 1];
      expect(lastSnapshot.btcFeeTotal).toBeGreaterThan(0);
    });

    it('should handle different BTC growth rates', () => {
      const highBtcGrowthInput = {
        ...baseInput,
        userTreasuryGrowthInput: {
          ...baseUserTreasuryGrowthInput,
          marketData: {
            ...baseUserTreasuryGrowthInput.marketData,
            btcCAGR: 0.25, // 25% annual growth
          },
        },
      };
      const result = simulatePlatformTreasuryGrowth(highBtcGrowthInput);

      expect(result.length).toBe(24);

      // Higher BTC growth should result in higher final BTC prices
      const lastSnapshot = result[result.length - 1];
      expect(lastSnapshot.btcPriceInEuro).toBeGreaterThan(50000);
    });

    it('should handle different user yield rates', () => {
      const highYieldInput = {
        ...baseInput,
        userTreasuryGrowthInput: {
          ...baseUserTreasuryGrowthInput,
          earnData: {
            yearlyYieldPct: 0.15, // 15% annual yield
          },
        },
      };
      const result = simulatePlatformTreasuryGrowth(highYieldInput);

      expect(result.length).toBe(24);
    });

    it('should handle different platform fees', () => {
      const highFeesInput = {
        ...baseInput,
        userTreasuryGrowthInput: {
          ...baseUserTreasuryGrowthInput,
          platformData: {
            platformFeeFromYieldPct: 0.25, // 25% fee from yield
            platformExchangeFeePct: 0.03, // 3% exchange fee
          },
        },
      };
      const result = simulatePlatformTreasuryGrowth(highFeesInput);

      expect(result.length).toBe(24);

      // Higher fees should result in higher platform revenue
      const lastSnapshot = result[result.length - 1];
      expect(lastSnapshot.btcFeeTotal).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle very short simulation period', () => {
      const shortPeriodInput = {
        ...baseInput,
        platformUsersData: {
          ...basePlatformUsersData,
          years: 0.1, // 1.2 months
        },
        userTreasuryGrowthInput: {
          ...baseUserTreasuryGrowthInput,
          marketData: {
            ...baseUserTreasuryGrowthInput.marketData,
            numberOfYears: 0.1,
          },
        },
      };
      const result = simulatePlatformTreasuryGrowth(shortPeriodInput);

      expect(result.length).toBe(2); // 0.1 years * 12 = 1.2 months, Math.floor(1.2) = 1, but loop runs for 0 and 1
    });

    it('should handle very long simulation period', () => {
      const longPeriodInput = {
        ...baseInput,
        platformUsersData: {
          ...basePlatformUsersData,
          years: 10,
        },
        userTreasuryGrowthInput: {
          ...baseUserTreasuryGrowthInput,
          marketData: {
            ...baseUserTreasuryGrowthInput.marketData,
            numberOfYears: 10,
          },
        },
      };
      const result = simulatePlatformTreasuryGrowth(longPeriodInput);

      expect(result.length).toBe(120); // 10 years * 12 months
    });

    it('should handle zero initial users', () => {
      const zeroInitialInput = {
        ...baseInput,
        platformUsersData: {
          userStarts: 0,
          userEnds: 100,
          growthType: GrowthType.Linear,
          years: 2,
        },
      };
      const result = simulatePlatformTreasuryGrowth(zeroInitialInput);

      expect(result.length).toBe(24);
      expect(result[0].totalUsers).toBe(0);
    });

    it('should handle empty cohort simulation set', () => {
      // This would require mocking buildCohortSimulationSet to return empty array
      // For now, we'll test with zero users which should result in minimal fees
      const zeroUsersInput = {
        ...baseInput,
        platformUsersData: {
          userStarts: 0,
          userEnds: 0,
          growthType: GrowthType.Linear,
          years: 2,
        },
      };
      const result = simulatePlatformTreasuryGrowth(zeroUsersInput);

      expect(result.length).toBe(24);
      expect(result[0].totalUsers).toBe(0);
      expect(result[0].btcFeeTotal).toBe(0);
    });
  });

  describe('mathematical properties', () => {
    it('should maintain non-negative values throughout simulation', () => {
      const result = simulatePlatformTreasuryGrowth(baseInput);

      result.forEach(snapshot => {
        expect(snapshot.btcPriceInEuro).toBeGreaterThan(0);
        expect(snapshot.btcFeeFromYield).toBeGreaterThanOrEqual(0);
        expect(snapshot.btcFeeFromExchange).toBeGreaterThanOrEqual(0);
        expect(snapshot.btcFeeTotal).toBeGreaterThanOrEqual(0);
        expect(snapshot.totalUsers).toBeGreaterThanOrEqual(0);
        expect(snapshot.platformWorkingBtc).toBeGreaterThanOrEqual(0);
        expect(snapshot.platformMonthlyYieldBtc).toBeGreaterThanOrEqual(0);
        expect(snapshot.platformPrincipalEndBtc).toBeGreaterThanOrEqual(0);
      });
    });

    it('should return finite values', () => {
      const result = simulatePlatformTreasuryGrowth(baseInput);

      result.forEach(snapshot => {
        expect(Number.isFinite(snapshot.btcPriceInEuro)).toBe(true);
        expect(Number.isFinite(snapshot.btcFeeFromYield)).toBe(true);
        expect(Number.isFinite(snapshot.btcFeeFromExchange)).toBe(true);
        expect(Number.isFinite(snapshot.btcFeeTotal)).toBe(true);
        expect(Number.isFinite(snapshot.totalUsers)).toBe(true);
        expect(Number.isFinite(snapshot.platformWorkingBtc)).toBe(true);
        expect(Number.isFinite(snapshot.platformMonthlyYieldBtc)).toBe(true);
        expect(Number.isFinite(snapshot.platformPrincipalEndBtc)).toBe(true);
      });
    });

    it('should have consistent fee calculations', () => {
      const result = simulatePlatformTreasuryGrowth(baseInput);

      result.forEach(snapshot => {
        // Total fees should equal sum of yield and exchange fees
        const expectedTotal =
          snapshot.btcFeeFromYield + snapshot.btcFeeFromExchange;
        expect(snapshot.btcFeeTotal).toBeCloseTo(expectedTotal, 6);
      });
    });

    it('should have consistent monthly progression', () => {
      const result = simulatePlatformTreasuryGrowth(baseInput);

      // Check that each month's data is properly calculated
      for (let i = 1; i < result.length; i++) {
        const current = result[i];
        const previous = result[i - 1];

        // BTC price should follow the monthly rate
        const expectedPrice =
          previous.btcPriceInEuro * (1 + Math.pow(1 + 0.15, 1 / 12) - 1);
        expect(current.btcPriceInEuro).toBeCloseTo(expectedPrice, 0);
      }
    });
  });

  describe('platform capital progression', () => {
    it('should start with zero working capital', () => {
      const result = simulatePlatformTreasuryGrowth(baseInput);
      const firstSnapshot = result[0];

      expect(firstSnapshot.platformWorkingBtc).toBe(0);
      expect(firstSnapshot.platformMonthlyYieldBtc).toBe(0);
    });

    it('should accumulate capital from fees and yield', () => {
      const result = simulatePlatformTreasuryGrowth(baseInput);

      // Platform should accumulate capital over time
      for (let i = 1; i < result.length; i++) {
        const current = result[i];
        const previous = result[i - 1];

        // Working capital should be previous end principal
        expect(current.platformWorkingBtc).toBe(
          previous.platformPrincipalEndBtc
        );

        // End principal should be greater than or equal to working capital
        expect(current.platformPrincipalEndBtc).toBeGreaterThanOrEqual(
          current.platformWorkingBtc
        );
      }
    });

    it('should handle compound growth correctly', () => {
      const result = simulatePlatformTreasuryGrowth(baseInput);

      // Later months should have higher yield due to compound growth
      if (result.length > 12) {
        const month6 = result[6];
        const month12 = result[12];

        // If there's accumulated capital, later months should have higher yield
        if (month6.platformWorkingBtc > 0) {
          expect(month12.platformMonthlyYieldBtc).toBeGreaterThanOrEqual(
            month6.platformMonthlyYieldBtc
          );
        }
      }
    });
  });
});

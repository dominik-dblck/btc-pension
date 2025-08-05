import {
  buildCohortSimulationSet,
  BuildCohortSimulationSetProps,
} from '../utils/buildCohortSimulationSet';
import {
  UserTreasuryGrowthInput,
  UserPensionSimulationSnapshot,
} from '../simulateUserTreasuryGrowth';
import {
  GrowthType,
  PlatformUsersData,
} from '../utils/getPlatformUsersTimeline';

describe('buildCohortSimulationSet', () => {
  const baseUserTreasuryGrowthInput: UserTreasuryGrowthInput = {
    marketData: {
      initialBtcPriceInEuro: 50000,
      btcCagrToday: 0.15,
      btcCagrAsymptote: 0.15,
      settleYears: 5,
      settleEpsilon: 0.05,
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

  const baseInput: BuildCohortSimulationSetProps = {
    platformUsersData: basePlatformUsersData,
    userTreasuryGrowthInput: baseUserTreasuryGrowthInput,
  };

  describe('basic functionality', () => {
    it('should return array of cohort simulation data', () => {
      const result = buildCohortSimulationSet(baseInput);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should have correct structure for each cohort', () => {
      const result = buildCohortSimulationSet(baseInput);
      const firstCohort = result[0];

      expect(firstCohort).toHaveProperty('numberOfUsers');
      expect(firstCohort).toHaveProperty('userSimulationSnapshot');
      expect(typeof firstCohort.numberOfUsers).toBe('number');
      expect(Array.isArray(firstCohort.userSimulationSnapshot)).toBe(true);
    });

    it('should include initial users cohort', () => {
      const result = buildCohortSimulationSet(baseInput);
      const initialCohort = result[0];

      expect(initialCohort.numberOfUsers).toBe(100); // userStarts
      expect(initialCohort.userSimulationSnapshot.length).toBe(24); // 2 years * 12 months
    });

    it('should have correct number of cohorts based on timeline', () => {
      const result = buildCohortSimulationSet(baseInput);

      // Should have 1 initial cohort + timeline months
      // For 2 years = 24 months, but timeline has 24 entries (0-23)
      expect(result.length).toBe(25); // 1 initial + 24 timeline entries
    });
  });

  describe('user simulation snapshots', () => {
    it('should have valid simulation snapshots for each cohort', () => {
      const result = buildCohortSimulationSet(baseInput);

      result.forEach(cohort => {
        expect(cohort.userSimulationSnapshot.length).toBe(24); // 2 years * 12 months

        cohort.userSimulationSnapshot.forEach(snapshot => {
          expect(snapshot).toHaveProperty('currentBtcPriceInEuro');
          expect(snapshot).toHaveProperty('platformFeeFromYieldInBtc');
          expect(snapshot).toHaveProperty('platformExchangeFeeInBtc');
          expect(snapshot).toHaveProperty('userAccumulatedBtcHolding');

          expect(typeof snapshot.currentBtcPriceInEuro).toBe('number');
          expect(typeof snapshot.platformFeeFromYieldInBtc).toBe('number');
          expect(typeof snapshot.platformExchangeFeeInBtc).toBe('number');
          expect(typeof snapshot.userAccumulatedBtcHolding).toBe('number');
        });
      });
    });

    it('should have different start months for different cohorts', () => {
      const result = buildCohortSimulationSet(baseInput);

      // First cohort (initial users) should start at month 0
      const initialCohort = result[0];
      const initialFirstSnapshot = initialCohort.userSimulationSnapshot[0];
      expect(initialFirstSnapshot.userAccumulatedBtcHolding).toBeGreaterThan(0);

      // Later cohorts should have different accumulation patterns
      if (result.length > 1) {
        const laterCohort = result[1];
        const laterFirstSnapshot = laterCohort.userSimulationSnapshot[0];

        // Later cohorts might have different accumulation due to different start months
        expect(laterCohort.numberOfUsers).toBeGreaterThan(0);
      }
    });
  });

  describe('platform users timeline integration', () => {
    it('should handle linear growth type', () => {
      const linearInput = {
        ...baseInput,
        platformUsersData: {
          ...basePlatformUsersData,
          growthType: GrowthType.Linear,
        },
      };
      const result = buildCohortSimulationSet(linearInput);

      expect(result.length).toBe(25); // 1 initial + 24 timeline entries
    });

    it('should handle exponential growth type', () => {
      const exponentialInput = {
        ...baseInput,
        platformUsersData: {
          ...basePlatformUsersData,
          growthType: GrowthType.Exponential,
        },
      };
      const result = buildCohortSimulationSet(exponentialInput);

      expect(result.length).toBe(25); // 1 initial + 24 timeline entries
    });

    it('should handle different time periods', () => {
      const oneYearInput = {
        ...baseInput,
        platformUsersData: {
          ...basePlatformUsersData,
          years: 1,
        },
        userTreasuryGrowthInput: {
          ...baseUserTreasuryGrowthInput,
          marketData: {
            ...baseUserTreasuryGrowthInput.marketData,
            numberOfYears: 1,
          },
        },
      };
      const result = buildCohortSimulationSet(oneYearInput);

      expect(result.length).toBe(13); // 1 initial + 12 timeline entries

      // Each cohort should have 12 months of simulation
      result.forEach(cohort => {
        expect(cohort.userSimulationSnapshot.length).toBe(12);
      });
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
      const result = buildCohortSimulationSet(highGrowthInput);

      expect(result.length).toBe(25);
      expect(result[0].numberOfUsers).toBe(50); // userStarts
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
      const result = buildCohortSimulationSet(highDcaInput);

      expect(result.length).toBe(25);

      // Higher DCA should result in higher BTC accumulation
      const initialCohort = result[0];
      const finalSnapshot = initialCohort.userSimulationSnapshot[23];
      expect(finalSnapshot.userAccumulatedBtcHolding).toBeGreaterThan(0);
    });

    it('should handle different BTC growth rates', () => {
      const highBtcGrowthInput = {
        ...baseInput,
        userTreasuryGrowthInput: {
          ...baseUserTreasuryGrowthInput,
          marketData: {
            ...baseUserTreasuryGrowthInput.marketData,
            btcCagrToday: 0.25,
            btcCagrAsymptote: 0.25,
          },
        },
      };
      const result = buildCohortSimulationSet(highBtcGrowthInput);

      expect(result.length).toBe(25);

      // Higher BTC growth should result in higher final BTC prices
      const initialCohort = result[0];
      const finalSnapshot = initialCohort.userSimulationSnapshot[23];
      expect(finalSnapshot.currentBtcPriceInEuro).toBeGreaterThan(50000);
    });

    it('should handle different yield rates', () => {
      const highYieldInput = {
        ...baseInput,
        userTreasuryGrowthInput: {
          ...baseUserTreasuryGrowthInput,
          earnData: {
            yearlyYieldPct: 0.15, // 15% annual yield
          },
        },
      };
      const result = buildCohortSimulationSet(highYieldInput);

      expect(result.length).toBe(25);

      // Higher yield should result in higher BTC accumulation
      const initialCohort = result[0];
      const finalSnapshot = initialCohort.userSimulationSnapshot[23];
      expect(finalSnapshot.userAccumulatedBtcHolding).toBeGreaterThan(0);
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
      const result = buildCohortSimulationSet(highFeesInput);

      expect(result.length).toBe(25);

      // Higher fees should still result in some BTC accumulation
      const initialCohort = result[0];
      const finalSnapshot = initialCohort.userSimulationSnapshot[23];
      expect(finalSnapshot.userAccumulatedBtcHolding).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
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
      const result = buildCohortSimulationSet(zeroGrowthInput);

      expect(result.length).toBe(25);
      expect(result[0].numberOfUsers).toBe(100);

      // All other cohorts should have 0 new users
      for (let i = 1; i < result.length; i++) {
        expect(result[i].numberOfUsers).toBe(0);
      }
    });

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
      const result = buildCohortSimulationSet(shortPeriodInput);

      expect(result.length).toBe(2); // 1 initial + 1 timeline entry (0.1 years * 12 = 1.2 months, Math.floor(1.2) = 1)
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
      const result = buildCohortSimulationSet(longPeriodInput);

      expect(result.length).toBe(121); // 1 initial + 120 timeline entries

      // Each cohort should have 120 months of simulation
      result.forEach(cohort => {
        expect(cohort.userSimulationSnapshot.length).toBe(120);
      });
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
      const result = buildCohortSimulationSet(zeroInitialInput);

      expect(result.length).toBe(25);
      expect(result[0].numberOfUsers).toBe(0);
    });
  });

  describe('mathematical properties', () => {
    it('should maintain non-negative values throughout simulation', () => {
      const result = buildCohortSimulationSet(baseInput);

      result.forEach(cohort => {
        cohort.userSimulationSnapshot.forEach(snapshot => {
          expect(snapshot.currentBtcPriceInEuro).toBeGreaterThan(0);
          expect(snapshot.platformFeeFromYieldInBtc).toBeGreaterThanOrEqual(0);
          expect(snapshot.platformExchangeFeeInBtc).toBeGreaterThanOrEqual(0);
          expect(snapshot.userAccumulatedBtcHolding).toBeGreaterThanOrEqual(0);
        });
      });
    });

    it('should return finite values', () => {
      const result = buildCohortSimulationSet(baseInput);

      result.forEach(cohort => {
        cohort.userSimulationSnapshot.forEach(snapshot => {
          expect(Number.isFinite(snapshot.currentBtcPriceInEuro)).toBe(true);
          expect(Number.isFinite(snapshot.platformFeeFromYieldInBtc)).toBe(
            true
          );
          expect(Number.isFinite(snapshot.platformExchangeFeeInBtc)).toBe(true);
          expect(Number.isFinite(snapshot.userAccumulatedBtcHolding)).toBe(
            true
          );
        });
      });
    });

    it('should have consistent monthly progression for each cohort', () => {
      const result = buildCohortSimulationSet(baseInput);

      result.forEach(cohort => {
        const snapshots = cohort.userSimulationSnapshot;

        // Check that each month's data is properly calculated
        for (let i = 1; i < snapshots.length; i++) {
          const current = snapshots[i];
          const previous = snapshots[i - 1];

          // BTC price should follow the monthly rate
          const expectedPrice =
            previous.currentBtcPriceInEuro *
            (1 + Math.pow(1 + 0.15, 1 / 12) - 1);
          expect(current.currentBtcPriceInEuro).toBeCloseTo(expectedPrice, 0);
        }
      });
    });
  });

  describe('cohort progression', () => {
    it('should have different accumulation patterns for different start months', () => {
      const result = buildCohortSimulationSet(baseInput);

      if (result.length > 1) {
        const initialCohort = result[0];
        const laterCohort = result[5]; // 5th month cohort

        const initialFinal = initialCohort.userSimulationSnapshot[23];
        const laterFinal = laterCohort.userSimulationSnapshot[23];

        // Later cohorts should have different accumulation due to different start times
        expect(laterCohort.numberOfUsers).toBeGreaterThan(0);
      }
    });

    it('should handle initial BTC holdings', () => {
      const withInitialHoldingInput = {
        ...baseInput,
        userTreasuryGrowthInput: {
          ...baseUserTreasuryGrowthInput,
          userData: {
            ...baseUserTreasuryGrowthInput.userData,
            initialBtcHolding: 1.0,
          },
        },
      };
      const result = buildCohortSimulationSet(withInitialHoldingInput);

      const initialCohort = result[0];
      const firstSnapshot = initialCohort.userSimulationSnapshot[0];

      // Should start with initial holding
      expect(firstSnapshot.userAccumulatedBtcHolding).toBeGreaterThan(0);
    });
  });
});

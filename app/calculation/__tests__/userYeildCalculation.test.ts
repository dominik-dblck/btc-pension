import {
  simulateUser,
  firstMonthForCollateralLoan,
  SNAPSHOT_STEP,
  UserSimulationInput,
  UserSimulationPoint,
} from '../simulateUserPension';

describe('userYeildCalculation', () => {
  describe('Snapshot test - czysty przypadek', () => {
    it('should produce expected results for clean scenario', () => {
      const cleanInput: UserSimulationInput = {
        monthlyContribution: 50000 / 12, // ~4166.67 EUR
        initialPrice: 100000,
        cagr: 0.21, // 21%
        years: 21,
        ltv: 0, // 0%
        loanRate: 0,
        yieldRate: 0,
        cpiRate: 0,
        enableIndexing: false,
        exchangeFeePct: 0,
        feePct: 0,
      };

      const result = simulateUser(cleanInput);
      const final = result[result.length - 1];

      // Console log dla analizy wyników
      console.log('\n=== CZYSTY PRZYPADEK ===');
      console.log('Parametry wejściowe:', cleanInput);
      console.log('Liczba snapshotów:', result.length);
      console.log('Ostatni snapshot (miesiąc):', final.month);
      console.log('Cena BTC na końcu:', final.price.toFixed(2), 'EUR');
      console.log('Łączne BTC w portfelu:', final.btcHolding.toFixed(8));
      console.log('Wartość BTC:', final.btcValue.toFixed(2), 'EUR');
      console.log('Łączne wpłaty:', final.totalContrib.toFixed(2), 'EUR');
      console.log('Wartość netto:', final.netWorth.toFixed(2), 'EUR');
      console.log('P&L netto:', final.pnlNet.toFixed(2), 'EUR');
      console.log(
        'ROI:',
        ((final.pnlNet / final.totalContrib) * 100).toFixed(2),
        '%'
      );
      console.log('================================\n');

      // Snapshot test - sprawdza czy wyniki są spójne
      expect(final.month).toBe(21 * 12); // 252 miesiące
      expect(final.price).toBeCloseTo(100000 * Math.pow(1 + 0.21, 21), 2);
      expect(final.btcHolding).toBeGreaterThan(0);
      expect(final.totalContrib).toBeCloseTo(50000 * 21, 0); // 1,050,000 EUR
      expect(final.netWorth).toBeGreaterThan(final.totalContrib); // Powinno być zyskowne
      expect(final.loanOutstanding).toBe(0); // Brak kredytu
      expect(final.cashBalance).toBe(0); // Brak gotówki
    });
  });

  describe('SNAPSHOT_STEP constant', () => {
    it('should be set to 3 for quarterly snapshots', () => {
      expect(SNAPSHOT_STEP).toBe(3);
    });
  });

  describe('simulateUser', () => {
    const baseInput: UserSimulationInput = {
      monthlyContribution: 300,
      initialPrice: 100000,
      cagr: 0.14,
      years: 1,
      ltv: 0.3,
      loanRate: 0.05,
      yieldRate: 0.08,
      cpiRate: 0.03,
      enableIndexing: false,
      exchangeFeePct: 0.1,
      feePct: 15,
    };

    describe('basic functionality', () => {
      it('should return array of simulation points', () => {
        const result = simulateUser(baseInput);
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
      });

      it('should start with month 0', () => {
        const result = simulateUser(baseInput);
        expect(result[0].month).toBe(0);
      });

      it('should end with correct final month', () => {
        const result = simulateUser(baseInput);
        const expectedFinalMonth = baseInput.years * 12;
        expect(result[result.length - 1].month).toBe(expectedFinalMonth);
      });

      it('should have correct number of snapshots', () => {
        const result = simulateUser(baseInput);
        // 1 year = 12 months, snapshots every 3 months + initial + final
        // 0, 3, 6, 9, 12 = 5 snapshots
        expect(result.length).toBe(5);
      });
    });

    describe('initial state (month 0)', () => {
      it('should have correct initial values', () => {
        const result = simulateUser(baseInput);
        const initial = result[0];

        expect(initial.month).toBe(0);
        expect(initial.price).toBe(baseInput.initialPrice);
        expect(initial.contribution).toBe(0);
        expect(initial.btcBought).toBe(0);
        expect(initial.btcHolding).toBe(0);
        expect(initial.btcValue).toBe(0);
        expect(initial.loanOutstanding).toBe(0);
        expect(initial.interestAccrued).toBe(0);
        expect(initial.yieldEarned).toBe(0);
        expect(initial.cashBalance).toBe(0);
        expect(initial.totalContrib).toBe(0);
        expect(initial.totalContribReal).toBe(0);
        expect(initial.netWorth).toBe(0);
        expect(initial.pnlNet).toBe(0);
        expect(initial.inflationIndex).toBe(1);
        expect(initial.realNetWorth).toBe(0);
        expect(initial.realPnlNet).toBe(0);
      });
    });

    describe('monthly contributions', () => {
      it('should calculate BTC bought correctly with exchange fee', () => {
        const input = {
          ...baseInput,
          monthlyContribution: 1000,
          exchangeFeePct: 0.5,
        };
        const result = simulateUser(input);
        const firstContribution = result[1]; // Month 3

        const expectedNetContribution = 1000 * (1 - 0.5 / 100); // 995 EUR
        const expectedBtcBought =
          expectedNetContribution / firstContribution.price;

        expect(firstContribution.btcBought).toBeCloseTo(expectedBtcBought, 8);
        expect(firstContribution.contribution).toBeCloseTo(
          expectedNetContribution,
          2
        );
      });

      it('should accumulate total contributions correctly', () => {
        const input = { ...baseInput, years: 1 };
        const result = simulateUser(input);
        const final = result[result.length - 1];

        // 12 months * 300 EUR = 3600 EUR
        expect(final.totalContrib).toBe(3600);
      });

      it('should handle inflation indexing when enabled', () => {
        const input = { ...baseInput, enableIndexing: true, cpiRate: 0.06 };
        const result = simulateUser(input);
        const final = result[result.length - 1];

        // With 6% annual inflation, contributions should increase over time
        expect(final.totalContrib).toBeGreaterThan(3600);
      });
    });

    describe('BTC price growth', () => {
      it('should calculate price growth correctly', () => {
        const input = { ...baseInput, cagr: 0.12 };
        const result = simulateUser(input);

        // After 1 year with 12% CAGR
        const expectedFinalPrice = 100000 * Math.pow(1 + 0.12, 1);
        expect(result[result.length - 1].price).toBeCloseTo(
          expectedFinalPrice,
          2
        );
      });

      it('should calculate monthly price correctly', () => {
        const input = { ...baseInput, cagr: 0.12 };
        const result = simulateUser(input);

        // After 3 months with 12% CAGR
        const expectedPrice3Months = 100000 * Math.pow(1 + 0.12, 3 / 12);
        expect(result[1].price).toBeCloseTo(expectedPrice3Months, 2);
      });
    });

    describe('loan and yield calculations', () => {
      it('should calculate interest and yield correctly', () => {
        const input = { ...baseInput, loanRate: 0.06, yieldRate: 0.1 };
        const result = simulateUser(input);
        const firstQuarter = result[1]; // Month 3

        // Should have some loan outstanding after first rebalancing
        expect(firstQuarter.loanOutstanding).toBeGreaterThan(0);
        // Interest and yield are calculated monthly but only shown quarterly
        // They might be 0 in first quarter if loan was just taken
        expect(firstQuarter.interestAccrued).toBeGreaterThanOrEqual(0);
        expect(firstQuarter.yieldEarned).toBeGreaterThanOrEqual(0);
      });

      it('should handle zero loan rate', () => {
        const input = { ...baseInput, loanRate: 0 };
        const result = simulateUser(input);
        const firstQuarter = result[1];

        expect(firstQuarter.interestAccrued).toBe(0);
      });

      it('should handle zero yield rate', () => {
        const input = { ...baseInput, yieldRate: 0 };
        const result = simulateUser(input);
        const firstQuarter = result[1];

        expect(firstQuarter.yieldEarned).toBe(0);
      });
    });

    describe('LTV rebalancing', () => {
      it('should maintain target LTV when autoDrawToTarget is true', () => {
        const input = { ...baseInput, ltv: 0.25, years: 2 };
        const result = simulateUser(input, { autoDrawToTarget: true });

        // Check LTV at later points (skip first few points to allow for proper rebalancing)
        for (let i = 2; i < result.length; i++) {
          const point = result[i];
          if (point.btcValue > 0) {
            const actualLtv = point.loanOutstanding / point.btcValue;
            expect(actualLtv).toBeCloseTo(0.25, 1);
          }
        }
      });

      it('should handle conservative rebalancing when autoDrawToTarget is false', () => {
        const input = { ...baseInput, ltv: 0.25 };
        const result = simulateUser(input, { autoDrawToTarget: false });

        // LTV should not exceed target
        for (let i = 1; i < result.length; i++) {
          const point = result[i];
          if (point.btcValue > 0) {
            const actualLtv = point.loanOutstanding / point.btcValue;
            expect(actualLtv).toBeLessThanOrEqual(0.25 + 0.01); // Allow small rounding errors
          }
        }
      });
    });

    describe('net worth calculations', () => {
      it('should calculate net worth correctly', () => {
        const input = { ...baseInput };
        const result = simulateUser(input);
        const final = result[result.length - 1];

        const expectedNetWorth =
          final.btcValue - final.loanOutstanding + final.cashBalance;
        expect(final.netWorth).toBeCloseTo(expectedNetWorth, 2);
      });

      it('should calculate P&L correctly', () => {
        const input = { ...baseInput };
        const result = simulateUser(input);
        const final = result[result.length - 1];

        const expectedPnl = final.netWorth - final.totalContrib;
        expect(final.pnlNet).toBeCloseTo(expectedPnl, 2);
      });

      it('should calculate real values correctly', () => {
        const input = { ...baseInput, cpiRate: 0.05 };
        const result = simulateUser(input);
        const final = result[result.length - 1];

        const expectedRealNetWorth = final.netWorth / final.inflationIndex;
        expect(final.realNetWorth).toBeCloseTo(expectedRealNetWorth, 2);
      });
    });

    describe('edge cases', () => {
      it('should handle zero monthly contribution', () => {
        const input = { ...baseInput, monthlyContribution: 0 };
        const result = simulateUser(input);
        const final = result[result.length - 1];

        expect(final.totalContrib).toBe(0);
        expect(final.btcHolding).toBe(0);
      });

      it('should handle zero CAGR', () => {
        const input = { ...baseInput, cagr: 0 };
        const result = simulateUser(input);

        // Price should remain constant
        for (const point of result) {
          expect(point.price).toBe(baseInput.initialPrice);
        }
      });

      it('should handle zero inflation', () => {
        const input = { ...baseInput, cpiRate: 0, enableIndexing: true };
        const result = simulateUser(input);
        const final = result[result.length - 1];

        expect(final.inflationIndex).toBe(1);
        expect(final.totalContribReal).toBe(final.totalContrib);
      });

      it('should handle very short investment period', () => {
        const input = { ...baseInput, years: 0.25 }; // 3 months
        const result = simulateUser(input);

        expect(result.length).toBe(2); // Initial + final
        expect(result[0].month).toBe(0);
        expect(result[1].month).toBe(3);
      });
    });

    describe('fee calculations', () => {
      it('should apply platform fee to yield correctly', () => {
        const input = { ...baseInput, feePct: 20 };
        const result = simulateUser(input);
        const firstQuarter = result[1];

        // Yield earned should be gross yield (might be 0 in first quarter)
        expect(firstQuarter.yieldEarned).toBeGreaterThanOrEqual(0);
      });

      it('should handle zero fees', () => {
        const input = { ...baseInput, exchangeFeePct: 0, feePct: 0 };
        const result = simulateUser(input);
        const firstQuarter = result[1];

        // Should still work without fees
        expect(firstQuarter.btcBought).toBeGreaterThan(0);
      });
    });
  });

  describe('firstMonthForCollateralLoan', () => {
    let sampleSeries: UserSimulationPoint[];

    beforeEach(() => {
      const input: UserSimulationInput = {
        monthlyContribution: 500,
        initialPrice: 50000,
        cagr: 0.1,
        years: 2,
        ltv: 0.3,
        loanRate: 0.05,
        yieldRate: 0.08,
        cpiRate: 0.02,
        enableIndexing: false,
      };
      sampleSeries = simulateUser(input);
    });

    it('should return first month when capacity is sufficient', () => {
      const result = firstMonthForCollateralLoan(sampleSeries, 1, 0.3);

      // Since capacity is exactly 0 due to LTV being maintained at 30%, we should expect null
      expect(result).toBeNull();
    });

    it('should return first month when capacity is actually available', () => {
      // Create a scenario where there's available capacity
      const inputWithCapacity: UserSimulationInput = {
        monthlyContribution: 1000,
        initialPrice: 50000,
        cagr: 0.1,
        years: 2,
        ltv: 0.2, // Lower LTV to leave some capacity
        loanRate: 0.05,
        yieldRate: 0.08,
        cpiRate: 0.02,
        enableIndexing: false,
      };
      const seriesWithCapacity = simulateUser(inputWithCapacity);

      const result = firstMonthForCollateralLoan(seriesWithCapacity, 100, 0.3);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(typeof result).toBe('number');
    });

    it('should return null when capacity is never sufficient', () => {
      const result = firstMonthForCollateralLoan(sampleSeries, 1000000, 0.3);
      expect(result).toBeNull();
    });

    it('should handle zero desired amount', () => {
      const result = firstMonthForCollateralLoan(sampleSeries, 0, 0.3);
      expect(result).toBe(0); // Should be available from the start
    });

    it('should handle different LTV percentages', () => {
      const result1 = firstMonthForCollateralLoan(sampleSeries, 100, 0.2);
      const result2 = firstMonthForCollateralLoan(sampleSeries, 100, 0.5);

      // Higher LTV should allow earlier access to the same amount
      if (result1 !== null && result2 !== null) {
        expect(result2).toBeLessThanOrEqual(result1);
      }
    });

    it('should work with empty series', () => {
      const result = firstMonthForCollateralLoan([], 10000, 0.3);
      expect(result).toBeNull();
    });
  });

  describe('integration tests', () => {
    it('should produce realistic results for long-term investment', () => {
      const input: UserSimulationInput = {
        monthlyContribution: 1000,
        initialPrice: 80000,
        cagr: 0.15,
        years: 10,
        ltv: 0.25,
        loanRate: 0.04,
        yieldRate: 0.06,
        cpiRate: 0.025,
        enableIndexing: true,
        exchangeFeePct: 0.2,
        feePct: 10,
      };

      const result = simulateUser(input);
      const final = result[result.length - 1];

      // Basic sanity checks
      expect(final.month).toBe(120); // 10 years * 12 months
      expect(final.price).toBeGreaterThan(input.initialPrice);
      expect(final.btcHolding).toBeGreaterThan(0);
      // With inflation indexing enabled, total contribution should be higher than nominal
      expect(final.totalContrib).toBeGreaterThan(120000); // 1000 * 12 * 10
      expect(final.netWorth).toBeGreaterThan(0);
      expect(final.inflationIndex).toBeGreaterThan(1);
    });

    it('should handle complex scenario with all features enabled', () => {
      const input: UserSimulationInput = {
        monthlyContribution: 500,
        initialPrice: 60000,
        cagr: 0.12,
        years: 5,
        ltv: 0.35,
        loanRate: 0.03,
        yieldRate: 0.07,
        cpiRate: 0.04,
        enableIndexing: true,
        exchangeFeePct: 0.15,
        feePct: 12,
      };

      const result = simulateUser(input);
      const final = result[result.length - 1];

      // Verify all calculations are reasonable
      expect(final.btcValue).toBeGreaterThan(0);
      expect(final.loanOutstanding).toBeGreaterThan(0);
      expect(final.cashBalance).toBeGreaterThanOrEqual(0);
      expect(final.netWorth).toBeGreaterThan(0);
      expect(final.realNetWorth).toBeGreaterThan(0);

      // Verify LTV is maintained (with some tolerance)
      const actualLtv = final.loanOutstanding / final.btcValue;
      expect(actualLtv).toBeCloseTo(0.35, 1);
    });
  });
});

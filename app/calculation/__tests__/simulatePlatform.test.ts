import {
  simulatePlatformAnnual,
  SimplePlatformConfig,
  PlatformAnnualPoint,
} from '../simulatePlatform';
import { UserSimulationInput } from '../simulateUserPension';

describe('simulatePlatform', () => {
  const baseUserInput: UserSimulationInput = {
    monthlyContribution: 1000,
    initialPrice: 50000,
    cagr: 0.12,
    years: 3,
    ltv: 0.3,
    loanRate: 0.05,
    yieldRate: 0.08,
    cpiRate: 0.02,
    enableIndexing: false,
    exchangeFeePct: 0.1,
    feePct: 15,
  };

  const basePlatformConfig: SimplePlatformConfig = {
    avgMonthly: 800,
    feePct: 12,
    exchangeFeePct: 0.15,
    enableIndexing: false,
    usersStart: 100,
    usersEnd: 500,
    usersGrowthMode: 'linear',
  };

  describe('basic functionality', () => {
    it('should return array of annual platform points', () => {
      const result = simulatePlatformAnnual(baseUserInput, basePlatformConfig);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('year');
      expect(result[0]).toHaveProperty('users');
      expect(result[0]).toHaveProperty('totalYieldFee');
      expect(result[0]).toHaveProperty('totalExchangeFee');
    });

    it('should start with year 1', () => {
      const result = simulatePlatformAnnual(baseUserInput, basePlatformConfig);
      expect(result[0].year).toBe(1);
    });

    it('should end with correct final year', () => {
      const result = simulatePlatformAnnual(baseUserInput, basePlatformConfig);
      expect(result[result.length - 1].year).toBe(baseUserInput.years);
    });

    it('should have correct number of years', () => {
      const result = simulatePlatformAnnual(baseUserInput, basePlatformConfig);
      expect(result.length).toBe(baseUserInput.years);
    });
  });

  describe('user growth calculations', () => {
    it('should calculate linear user growth correctly', () => {
      const config: SimplePlatformConfig = {
        ...basePlatformConfig,
        usersStart: 100,
        usersEnd: 400,
        usersGrowthMode: 'linear',
      };

      const result = simulatePlatformAnnual(baseUserInput, config);

      // The code uses usersSeries[Y-1] where Y starts from 1
      // So result[0] (year 1) uses usersSeries[0] = 100
      // result[1] (year 2) uses usersSeries[1] = 250
      // result[2] (year 3) uses usersSeries[2] = 400
      expect(result[0].users).toBe(100); // Year 1
      expect(result[1].users).toBe(250); // Year 2
      expect(result[2].users).toBe(400); // Year 3

      // New users: 100 in year 1, 150 in year 2, 150 in year 3
      expect(result[0].newUsers).toBe(100);
      expect(result[1].newUsers).toBe(150);
      expect(result[2].newUsers).toBe(150);
    });

    it('should calculate CAGR user growth correctly', () => {
      const config: SimplePlatformConfig = {
        ...basePlatformConfig,
        usersStart: 100,
        usersEnd: 400,
        usersGrowthMode: 'cagr',
      };

      const result = simulatePlatformAnnual(baseUserInput, config);

      // CAGR growth should be exponential
      expect(result[0].users).toBe(100); // Year 1 starts with usersStart
      expect(result[1].users).toBeGreaterThan(100);
      expect(result[1].users).toBeLessThan(400);
      expect(result[2].users).toBe(400);
    });

    it('should handle single year horizon', () => {
      const input = { ...baseUserInput, years: 1 };
      const config = { ...basePlatformConfig, usersStart: 100, usersEnd: 100 }; // Same start and end
      const result = simulatePlatformAnnual(input, config);

      expect(result.length).toBe(1);
      expect(result[0].year).toBe(1);
      expect(result[0].users).toBe(100); // Year 1 uses usersStart
    });
  });

  describe('fee calculations', () => {
    it('should calculate yield fees correctly', () => {
      const config: SimplePlatformConfig = {
        ...basePlatformConfig,
        feePct: 20,
        avgMonthly: 1000,
      };

      const result = simulatePlatformAnnual(baseUserInput, config);

      // Should have some yield fees
      for (const point of result) {
        expect(point.totalYieldFee).toBeGreaterThanOrEqual(0);
        expect(point.total).toBe(point.totalYieldFee + point.totalExchangeFee);
      }
    });

    it('should calculate exchange fees correctly', () => {
      const config: SimplePlatformConfig = {
        ...basePlatformConfig,
        exchangeFeePct: 0.5,
        avgMonthly: 1000,
      };

      const result = simulatePlatformAnnual(baseUserInput, config);

      // Should have some exchange fees
      for (const point of result) {
        expect(point.totalExchangeFee).toBeGreaterThanOrEqual(0);
        expect(point.total).toBe(point.totalYieldFee + point.totalExchangeFee);
      }
    });

    it('should handle zero fees', () => {
      const config: SimplePlatformConfig = {
        ...basePlatformConfig,
        feePct: 0,
        exchangeFeePct: 0,
      };

      const result = simulatePlatformAnnual(baseUserInput, config);

      // Should still work but with zero fees
      for (const point of result) {
        expect(point.totalYieldFee).toBe(0);
        expect(point.totalExchangeFee).toBe(0);
        expect(point.total).toBe(0);
        expect(point.avgPerUser).toBe(0);
      }
    });
  });

  describe('platform BTC holdings', () => {
    it('should accumulate platform BTC from fees', () => {
      const result = simulatePlatformAnnual(baseUserInput, basePlatformConfig);

      // Platform BTC should grow over time
      expect(result[0].platBtcHolding).toBeGreaterThan(0);
      expect(result[1].platBtcHolding).toBeGreaterThan(
        result[0].platBtcHolding
      );
      expect(result[2].platBtcHolding).toBeGreaterThan(
        result[1].platBtcHolding
      );
    });

    it('should calculate platform BTC value correctly', () => {
      const result = simulatePlatformAnnual(baseUserInput, basePlatformConfig);

      for (const point of result) {
        const expectedValue = point.platBtcHolding * point.priceBtcEur;
        expect(point.platBtcValue).toBeCloseTo(expectedValue, 2);
      }
    });

    it('should calculate users BTC value correctly', () => {
      const result = simulatePlatformAnnual(baseUserInput, basePlatformConfig);

      for (const point of result) {
        const expectedValue = point.totalBtcHeld * point.priceBtcEur;
        expect(point.usersBtcValue).toBeCloseTo(expectedValue, 2);
      }
    });
  });

  describe('AUM and metrics', () => {
    it('should calculate total AUM correctly', () => {
      const result = simulatePlatformAnnual(baseUserInput, basePlatformConfig);

      // AUM should grow over time as more users join
      expect(result[0].totalAum).toBeGreaterThan(0);
      expect(result[1].totalAum).toBeGreaterThan(result[0].totalAum);
      expect(result[2].totalAum).toBeGreaterThan(result[1].totalAum);
    });

    it('should calculate average per user correctly', () => {
      const result = simulatePlatformAnnual(baseUserInput, basePlatformConfig);

      for (const point of result) {
        if (point.users > 0) {
          const expectedAvg = point.total / point.users;
          expect(point.avgPerUser).toBeCloseTo(expectedAvg, 2);
        } else {
          expect(point.avgPerUser).toBe(0);
        }
      }
    });

    it('should track total BTC held by users', () => {
      const result = simulatePlatformAnnual(baseUserInput, basePlatformConfig);

      // Total BTC should grow over time
      expect(result[0].totalBtcHeld).toBeGreaterThan(0);
      expect(result[1].totalBtcHeld).toBeGreaterThan(result[0].totalBtcHeld);
      expect(result[2].totalBtcHeld).toBeGreaterThan(result[1].totalBtcHeld);
    });
  });

  describe('price calculations', () => {
    it('should calculate BTC price growth correctly', () => {
      const result = simulatePlatformAnnual(baseUserInput, basePlatformConfig);

      // Price should grow according to CAGR
      expect(result[0].priceBtcEur).toBeCloseTo(
        baseUserInput.initialPrice * Math.pow(1 + baseUserInput.cagr, 1),
        2
      );
      expect(result[1].priceBtcEur).toBeCloseTo(
        baseUserInput.initialPrice * Math.pow(1 + baseUserInput.cagr, 2),
        2
      );
      expect(result[2].priceBtcEur).toBeCloseTo(
        baseUserInput.initialPrice * Math.pow(1 + baseUserInput.cagr, 3),
        2
      );
    });
  });

  describe('inflation indexing', () => {
    it('should handle inflation indexing when enabled', () => {
      const config: SimplePlatformConfig = {
        ...basePlatformConfig,
        enableIndexing: true,
      };

      const result = simulatePlatformAnnual(baseUserInput, config);

      // Should still work with inflation indexing
      expect(result.length).toBe(baseUserInput.years);
      expect(result[0].total).toBeGreaterThan(0);
    });

    it('should handle inflation indexing when disabled', () => {
      const config: SimplePlatformConfig = {
        ...basePlatformConfig,
        enableIndexing: false,
      };

      const result = simulatePlatformAnnual(baseUserInput, config);

      // Should work without inflation indexing
      expect(result.length).toBe(baseUserInput.years);
      expect(result[0].total).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle zero users', () => {
      const config: SimplePlatformConfig = {
        ...basePlatformConfig,
        usersStart: 0,
        usersEnd: 0,
      };

      const result = simulatePlatformAnnual(baseUserInput, config);

      for (const point of result) {
        expect(point.users).toBe(0);
        expect(point.newUsers).toBe(0);
        expect(point.total).toBe(0);
        expect(point.avgPerUser).toBe(0);
      }
    });

    it('should handle zero monthly contribution', () => {
      const config: SimplePlatformConfig = {
        ...basePlatformConfig,
        avgMonthly: 0,
      };

      const result = simulatePlatformAnnual(baseUserInput, config);

      // Should still work but with minimal fees
      expect(result.length).toBe(baseUserInput.years);
    });

    it('should handle zero yield rate', () => {
      const input = { ...baseUserInput, yieldRate: 0 };
      const result = simulatePlatformAnnual(input, basePlatformConfig);

      // Should have no yield fees but still exchange fees
      for (const point of result) {
        expect(point.totalYieldFee).toBe(0);
        expect(point.totalExchangeFee).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle zero loan rate', () => {
      const input = { ...baseUserInput, loanRate: 0 };
      const result = simulatePlatformAnnual(input, basePlatformConfig);

      // Should still work with zero loan rate
      expect(result.length).toBe(baseUserInput.years);
    });
  });

  describe('snapshot test - realistic platform scenario', () => {
    it('should produce realistic results for platform business', () => {
      const userInput: UserSimulationInput = {
        monthlyContribution: 1500,
        initialPrice: 80000,
        cagr: 0.15,
        years: 5,
        ltv: 0.25,
        loanRate: 0.04,
        yieldRate: 0.1,
        cpiRate: 0.025,
        enableIndexing: true,
        exchangeFeePct: 0.2,
        feePct: 18,
      };

      const platformConfig: SimplePlatformConfig = {
        avgMonthly: 1200,
        feePct: 15,
        exchangeFeePct: 0.25,
        enableIndexing: true,
        usersStart: 50,
        usersEnd: 2000,
        usersGrowthMode: 'cagr',
      };

      const result = simulatePlatformAnnual(userInput, platformConfig);
      const final = result[result.length - 1];

      // Console log dla analizy wyników
      console.log('\n=== SCENARIUSZ PLATFORMY ===');
      console.log('Parametry użytkownika:', userInput);
      console.log('Parametry platformy:', platformConfig);
      console.log('Liczba lat:', result.length);
      console.log('Ostatni rok:', final.year);
      console.log('Liczba użytkowników na końcu:', final.users);
      console.log('Nowi użytkownicy w ostatnim roku:', final.newUsers);
      console.log('Cena BTC na końcu:', final.priceBtcEur.toFixed(2), 'EUR');
      console.log(
        'Przychód z fee od yield:',
        final.totalYieldFee.toFixed(2),
        'EUR'
      );
      console.log(
        'Przychód z fee od wymian:',
        final.totalExchangeFee.toFixed(2),
        'EUR'
      );
      console.log('Przychód łączny:', final.total.toFixed(2), 'EUR');
      console.log(
        'Średni przychód na użytkownika:',
        final.avgPerUser.toFixed(2),
        'EUR'
      );
      console.log('Total AUM:', final.totalAum.toFixed(2), 'EUR');
      console.log('BTC użytkowników:', final.totalBtcHeld.toFixed(8));
      console.log('BTC platformy:', final.platBtcHolding.toFixed(8));
      console.log(
        'Wartość BTC platformy:',
        final.platBtcValue.toFixed(2),
        'EUR'
      );
      console.log(
        'Wartość BTC użytkowników:',
        final.usersBtcValue.toFixed(2),
        'EUR'
      );
      console.log(
        'Stosunek BTC platformy do użytkowników:',
        ((final.platBtcHolding / final.totalBtcHeld) * 100).toFixed(2),
        '%'
      );
      console.log('================================\n');

      // Basic sanity checks
      expect(final.year).toBe(5);
      expect(final.users).toBe(2000);
      expect(final.priceBtcEur).toBeGreaterThan(userInput.initialPrice);
      expect(final.total).toBeGreaterThan(0);
      expect(final.totalAum).toBeGreaterThan(0);
      expect(final.platBtcHolding).toBeGreaterThan(0);
      expect(final.totalBtcHeld).toBeGreaterThan(0);
    });
  });

  describe('comparison scenarios', () => {
    it('should show different results for different growth modes', () => {
      const linearConfig: SimplePlatformConfig = {
        ...basePlatformConfig,
        usersStart: 100,
        usersEnd: 400,
        usersGrowthMode: 'linear',
      };

      const cagrConfig: SimplePlatformConfig = {
        ...basePlatformConfig,
        usersStart: 100,
        usersEnd: 400,
        usersGrowthMode: 'cagr',
      };

      const linearResult = simulatePlatformAnnual(baseUserInput, linearConfig);
      const cagrResult = simulatePlatformAnnual(baseUserInput, cagrConfig);

      // Both should start with usersStart, but year 2 should be different
      expect(linearResult[0].users).toBe(cagrResult[0].users); // Both start with 100
      expect(linearResult[1].users).not.toBe(cagrResult[1].users); // Different growth patterns
    });

    it('should show impact of different fee structures', () => {
      const lowFeeConfig: SimplePlatformConfig = {
        ...basePlatformConfig,
        feePct: 5,
        exchangeFeePct: 0.1,
      };

      const highFeeConfig: SimplePlatformConfig = {
        ...basePlatformConfig,
        feePct: 25,
        exchangeFeePct: 0.5,
      };

      const lowFeeResult = simulatePlatformAnnual(baseUserInput, lowFeeConfig);
      const highFeeResult = simulatePlatformAnnual(
        baseUserInput,
        highFeeConfig
      );

      // Higher fees should generate more revenue
      expect(highFeeResult[0].total).toBeGreaterThan(lowFeeResult[0].total);
      expect(highFeeResult[1].total).toBeGreaterThan(lowFeeResult[1].total);
    });
  });
});

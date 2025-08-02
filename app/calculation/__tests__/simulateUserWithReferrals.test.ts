import {
  simulateUserWithReferrals,
  ReferralSettings,
} from '../simulateUserWithReferrals';
import { UserSimulationInput } from '../simulateUserPension';

describe('simulateUserWithReferrals', () => {
  const baseUserInput: UserSimulationInput = {
    monthlyContribution: 1000,
    initialPrice: 50000,
    cagr: 0.12,
    years: 2,
    ltv: 0.3,
    loanRate: 0.05,
    yieldRate: 0.08,
    cpiRate: 0.02,
    enableIndexing: false,
    exchangeFeePct: 0.1,
    feePct: 15,
  };

  const baseReferralSettings: ReferralSettings = {
    count: 5,
    sharePct: 10,
    referralInput: {
      monthlyContribution: 500,
      initialPrice: 50000,
      cagr: 0.12,
      years: 2,
      ltv: 0.25,
      loanRate: 0.04,
      yieldRate: 0.06,
      cpiRate: 0.02,
      enableIndexing: false,
      exchangeFeePct: 0.1,
      feePct: 10,
    },
  };

  describe('basic functionality', () => {
    it('should return array of simulation points with referral data', () => {
      const result = simulateUserWithReferrals(
        baseUserInput,
        baseReferralSettings
      );
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('btcFromReferrals');
      expect(result[0]).toHaveProperty('eurFromReferrals');
    });

    it('should start with month 0 and correct initial values', () => {
      const result = simulateUserWithReferrals(
        baseUserInput,
        baseReferralSettings
      );
      const initial = result[0];

      expect(initial.month).toBe(0);
      expect(initial.btcFromReferrals).toBe(0);
      expect(initial.eurFromReferrals).toBe(0);
      expect(initial.btcHolding).toBe(0);
      expect(initial.loanOutstanding).toBe(0);
    });

    it('should end with correct final month', () => {
      const result = simulateUserWithReferrals(
        baseUserInput,
        baseReferralSettings
      );
      const expectedFinalMonth = baseUserInput.years * 12;
      expect(result[result.length - 1].month).toBe(expectedFinalMonth);
    });
  });

  describe('referral income calculations', () => {
    it('should accumulate referral income over time', () => {
      const result = simulateUserWithReferrals(
        baseUserInput,
        baseReferralSettings
      );
      const final = result[result.length - 1];

      expect(final.btcFromReferrals).toBeGreaterThan(0);
      expect(final.eurFromReferrals).toBeGreaterThan(0);
      expect(final.btcHolding).toBeGreaterThan(final.btcFromReferrals);
    });

    it('should calculate referral share correctly', () => {
      const settings: ReferralSettings = {
        count: 10,
        sharePct: 5,
        referralInput: {
          ...baseReferralSettings.referralInput,
          monthlyContribution: 1000,
          yieldRate: 0.1,
        },
      };

      const result = simulateUserWithReferrals(baseUserInput, settings);
      const final = result[result.length - 1];

      // Should have some referral income
      expect(final.eurFromReferrals).toBeGreaterThan(0);
      expect(final.btcFromReferrals).toBeGreaterThan(0);
    });

    it('should handle zero referrals', () => {
      const settings: ReferralSettings = {
        count: 0,
        sharePct: 10,
        referralInput: baseReferralSettings.referralInput,
      };

      const result = simulateUserWithReferrals(baseUserInput, settings);
      const final = result[result.length - 1];

      expect(final.btcFromReferrals).toBe(0);
      expect(final.eurFromReferrals).toBe(0);
    });

    it('should handle zero referral share', () => {
      const settings: ReferralSettings = {
        count: 5,
        sharePct: 0,
        referralInput: baseReferralSettings.referralInput,
      };

      const result = simulateUserWithReferrals(baseUserInput, settings);
      const final = result[result.length - 1];

      expect(final.btcFromReferrals).toBe(0);
      expect(final.eurFromReferrals).toBe(0);
    });
  });

  describe('integration with user simulation', () => {
    it('should combine user and referral income correctly', () => {
      const result = simulateUserWithReferrals(
        baseUserInput,
        baseReferralSettings
      );
      const final = result[result.length - 1];

      // Total BTC should be user's BTC + referral BTC
      const userBtc = final.btcHolding - final.btcFromReferrals;
      expect(userBtc).toBeGreaterThan(0);
      expect(final.btcFromReferrals).toBeGreaterThan(0);
      expect(final.btcHolding).toBe(userBtc + final.btcFromReferrals);
    });

    it('should maintain user original behavior', () => {
      const result = simulateUserWithReferrals(
        baseUserInput,
        baseReferralSettings
      );
      const final = result[result.length - 1];

      // User's own contributions should still be tracked
      expect(final.totalContrib).toBe(
        baseUserInput.monthlyContribution * baseUserInput.years * 12
      );
      // Net worth should be positive (not necessarily greater than contributions due to fees and loan costs)
      expect(final.netWorth).toBeGreaterThan(0);
    });
  });

  describe('different referral scenarios', () => {
    it('should handle high referral count', () => {
      const settings: ReferralSettings = {
        count: 100,
        sharePct: 1,
        referralInput: baseReferralSettings.referralInput,
      };

      const result = simulateUserWithReferrals(baseUserInput, settings);
      const final = result[result.length - 1];

      expect(final.eurFromReferrals).toBeGreaterThan(0);
      expect(final.btcFromReferrals).toBeGreaterThan(0);
    });

    it('should handle high referral share percentage', () => {
      const settings: ReferralSettings = {
        count: 1,
        sharePct: 50,
        referralInput: baseReferralSettings.referralInput,
      };

      const result = simulateUserWithReferrals(baseUserInput, settings);
      const final = result[result.length - 1];

      expect(final.eurFromReferrals).toBeGreaterThan(0);
      expect(final.btcFromReferrals).toBeGreaterThan(0);
    });

    it('should handle referrals with different parameters', () => {
      const settings: ReferralSettings = {
        count: 3,
        sharePct: 15,
        referralInput: {
          monthlyContribution: 2000,
          initialPrice: 60000,
          cagr: 0.15,
          years: 3,
          ltv: 0.4,
          loanRate: 0.03,
          yieldRate: 0.12,
          cpiRate: 0.03,
          enableIndexing: true,
          exchangeFeePct: 0.2,
          feePct: 20,
        },
      };

      const result = simulateUserWithReferrals(baseUserInput, settings);
      const final = result[result.length - 1];

      expect(final.btcFromReferrals).toBeGreaterThan(0);
      expect(final.eurFromReferrals).toBeGreaterThan(0);
    });
  });

  describe('LTV rebalancing with referrals', () => {
    it('should maintain target LTV with referral income', () => {
      const input = { ...baseUserInput, ltv: 0.25 };
      const result = simulateUserWithReferrals(input, baseReferralSettings, {
        autoDrawToTarget: true,
      });

      // Check LTV at later points (skip first few points to allow for proper rebalancing)
      for (let i = 2; i < result.length; i++) {
        const point = result[i];
        if (point.btcValue > 0) {
          const actualLtv = point.loanOutstanding / point.btcValue;
          expect(actualLtv).toBeCloseTo(0.25, 1);
        }
      }
    });

    it('should handle conservative rebalancing with referrals', () => {
      const input = { ...baseUserInput, ltv: 0.25 };
      const result = simulateUserWithReferrals(input, baseReferralSettings, {
        autoDrawToTarget: false,
      });

      // LTV should not exceed target
      for (let i = 1; i < result.length; i++) {
        const point = result[i];
        if (point.btcValue > 0) {
          const actualLtv = point.loanOutstanding / point.btcValue;
          expect(actualLtv).toBeLessThanOrEqual(0.25 + 0.01);
        }
      }
    });
  });

  describe('edge cases', () => {
    it('should handle zero user contribution', () => {
      const input = { ...baseUserInput, monthlyContribution: 0 };
      const result = simulateUserWithReferrals(input, baseReferralSettings);
      const final = result[result.length - 1];

      expect(final.totalContrib).toBe(0);
      expect(final.btcFromReferrals).toBeGreaterThan(0); // Should still get referral income
    });

    it('should handle zero yield rate for referrals', () => {
      const settings: ReferralSettings = {
        count: 5,
        sharePct: 10,
        referralInput: { ...baseReferralSettings.referralInput, yieldRate: 0 },
      };

      const result = simulateUserWithReferrals(baseUserInput, settings);
      const final = result[result.length - 1];

      expect(final.eurFromReferrals).toBe(0);
      expect(final.btcFromReferrals).toBe(0);
    });

    it('should handle very short investment period', () => {
      const input = { ...baseUserInput, years: 0.25 }; // 3 months
      const result = simulateUserWithReferrals(input, baseReferralSettings);

      expect(result.length).toBe(2); // Initial + final
      expect(result[0].month).toBe(0);
      expect(result[1].month).toBe(3);
    });
  });

  describe('snapshot test - realistic scenario', () => {
    it('should produce realistic results for referral program', () => {
      const userInput: UserSimulationInput = {
        monthlyContribution: 2000,
        initialPrice: 80000,
        cagr: 0.15,
        years: 5,
        ltv: 0.3,
        loanRate: 0.04,
        yieldRate: 0.08,
        cpiRate: 0.025,
        enableIndexing: true,
        exchangeFeePct: 0.15,
        feePct: 12,
      };

      const referralSettings: ReferralSettings = {
        count: 8,
        sharePct: 8,
        referralInput: {
          monthlyContribution: 1500,
          initialPrice: 80000,
          cagr: 0.15,
          years: 5,
          ltv: 0.25,
          loanRate: 0.04,
          yieldRate: 0.08,
          cpiRate: 0.025,
          enableIndexing: false,
          exchangeFeePct: 0.15,
          feePct: 12,
        },
      };

      const result = simulateUserWithReferrals(userInput, referralSettings);
      const final = result[result.length - 1];

      // Console log dla analizy wyników
      console.log('\n=== SCENARIUSZ Z REFERRALS ===');
      console.log('Parametry użytkownika:', userInput);
      console.log('Parametry referrals:', referralSettings);
      console.log('Liczba snapshotów:', result.length);
      console.log('Ostatni snapshot (miesiąc):', final.month);
      console.log('Cena BTC na końcu:', final.price.toFixed(2), 'EUR');
      console.log(
        'Łączne BTC użytkownika:',
        (final.btcHolding - final.btcFromReferrals).toFixed(8)
      );
      console.log('BTC z referrals:', final.btcFromReferrals.toFixed(8));
      console.log('Łączne BTC w portfelu:', final.btcHolding.toFixed(8));
      console.log('Wartość BTC:', final.btcValue.toFixed(2), 'EUR');
      console.log(
        'Łączne wpłaty użytkownika:',
        final.totalContrib.toFixed(2),
        'EUR'
      );
      console.log(
        'Przychód z referrals:',
        final.eurFromReferrals.toFixed(2),
        'EUR'
      );
      console.log('Wartość netto:', final.netWorth.toFixed(2), 'EUR');
      console.log('P&L netto:', final.pnlNet.toFixed(2), 'EUR');
      console.log(
        'ROI:',
        ((final.pnlNet / final.totalContrib) * 100).toFixed(2),
        '%'
      );
      console.log(
        'Udział referrals w portfelu:',
        ((final.btcFromReferrals / final.btcHolding) * 100).toFixed(2),
        '%'
      );
      console.log('================================\n');

      // Basic sanity checks
      expect(final.month).toBe(60); // 5 years * 12 months
      expect(final.price).toBeGreaterThan(userInput.initialPrice);
      expect(final.btcHolding).toBeGreaterThan(0);
      expect(final.btcFromReferrals).toBeGreaterThan(0);
      expect(final.eurFromReferrals).toBeGreaterThan(0);
      expect(final.netWorth).toBeGreaterThan(0);
      // With inflation indexing enabled, total contribution should be higher than nominal
      expect(final.totalContrib).toBeGreaterThan(2000 * 12 * 5); // 120,000 EUR
    });
  });

  describe('comparison with base simulation', () => {
    it('should show improved performance with referrals', () => {
      // Base simulation without referrals
      const baseResult = simulateUserWithReferrals(baseUserInput, {
        count: 0,
        sharePct: 10,
        referralInput: baseReferralSettings.referralInput,
      });
      const baseFinal = baseResult[baseResult.length - 1];

      // Simulation with referrals
      const refResult = simulateUserWithReferrals(
        baseUserInput,
        baseReferralSettings
      );
      const refFinal = refResult[refResult.length - 1];

      // With referrals should have better performance
      expect(refFinal.btcHolding).toBeGreaterThan(baseFinal.btcHolding);
      expect(refFinal.netWorth).toBeGreaterThan(baseFinal.netWorth);
      expect(refFinal.pnlNet).toBeGreaterThan(baseFinal.pnlNet);
    });
  });
});

import {
  calculateUserBtcAndPlatformFees,
  YieldAndFeeCalculation,
} from '../utils/calculateUserBtcAndPlatformFees';

describe('calculateUserBtcAndPlatformFees', () => {
  const baseInput: YieldAndFeeCalculation = {
    monthlyYieldRate: 0.02, // 2% monthly yield
    currentBtcPriceInEuro: 50000, // 50,000 EUR per BTC
    userAccumulatedBtcHolding: 1.0, // 1 BTC accumulated
    monthlyDcaInEuro: 1000, // 1,000 EUR DCA
    platformFeeFromYieldPct: 0.1, // 10% fee from yield
    platformExchangeFeePct: 0.01, // 1% exchange fee
  };

  describe('basic functionality', () => {
    it('should calculate correct BTC amounts and fees', () => {
      const result = calculateUserBtcAndPlatformFees(baseInput);

      // Expected calculations:
      // userDcaInBtc = 1000 / 50000 = 0.02 BTC
      // userNetDcaInBtc = 0.02 * (1 - 0.01) = 0.0198 BTC
      // monthlyYieldInBtc = (1.0 + 0.0198) * 0.02 = 0.020396 BTC
      // platformFeeFromYieldInBtc = 0.020396 * 0.1 = 0.0020396 BTC
      // platformExchangeFeeInBtc = 0.02 - 0.0198 = 0.0002 BTC
      // userMonthlyYieldInBtc = 0.020396 - 0.0020396 = 0.0183564 BTC
      // updatedUserAccumulatedBtcHolding = 1.0 + 0.0198 + 0.0183564 = 1.0381564 BTC

      expect(result.userAccumulatedBtcHolding).toBeCloseTo(1.0381564, 8);
      expect(result.platformFeeFromYieldInBtc).toBeCloseTo(0.0020396, 8);
      expect(result.platformExchangeFeeInBtc).toBeCloseTo(0.0002, 8);
    });

    it('should handle zero accumulated holdings', () => {
      const input = { ...baseInput, userAccumulatedBtcHolding: 0 };
      const result = calculateUserBtcAndPlatformFees(input);

      // userDcaInBtc = 1000 / 50000 = 0.02 BTC
      // userNetDcaInBtc = 0.02 * (1 - 0.01) = 0.0198 BTC
      // monthlyYieldInBtc = (0 + 0.0198) * 0.02 = 0.000396 BTC
      // platformFeeFromYieldInBtc = 0.000396 * 0.1 = 0.0000396 BTC
      // userMonthlyYieldInBtc = 0.000396 - 0.0000396 = 0.0003564 BTC
      // updatedUserAccumulatedBtcHolding = 0 + 0.0198 + 0.0003564 = 0.0201564 BTC

      expect(result.userAccumulatedBtcHolding).toBeCloseTo(0.0201564, 8);
      expect(result.platformFeeFromYieldInBtc).toBeCloseTo(0.0000396, 8);
      expect(result.platformExchangeFeeInBtc).toBeCloseTo(0.0002, 8);
    });

    it('should handle zero DCA amount', () => {
      const input = { ...baseInput, monthlyDcaInEuro: 0 };
      const result = calculateUserBtcAndPlatformFees(input);

      // userDcaInBtc = 0 / 50000 = 0 BTC
      // userNetDcaInBtc = 0 * (1 - 0.01) = 0 BTC
      // monthlyYieldInBtc = (1.0 + 0) * 0.02 = 0.02 BTC
      // platformFeeFromYieldInBtc = 0.02 * 0.1 = 0.002 BTC
      // userMonthlyYieldInBtc = 0.02 - 0.002 = 0.018 BTC
      // updatedUserAccumulatedBtcHolding = 1.0 + 0 + 0.018 = 1.018 BTC

      expect(result.userAccumulatedBtcHolding).toBeCloseTo(1.018, 8);
      expect(result.platformFeeFromYieldInBtc).toBeCloseTo(0.002, 8);
      expect(result.platformExchangeFeeInBtc).toBeCloseTo(0, 8);
    });
  });

  describe('fee calculations', () => {
    it('should handle zero platform fees', () => {
      const input = {
        ...baseInput,
        platformFeeFromYieldPct: 0,
        platformExchangeFeePct: 0,
      };
      const result = calculateUserBtcAndPlatformFees(input);

      // userDcaInBtc = 1000 / 50000 = 0.02 BTC
      // userNetDcaInBtc = 0.02 * (1 - 0) = 0.02 BTC
      // monthlyYieldInBtc = (1.0 + 0.02) * 0.02 = 0.0204 BTC
      // platformFeeFromYieldInBtc = 0.0204 * 0 = 0 BTC
      // userMonthlyYieldInBtc = 0.0204 - 0 = 0.0204 BTC
      // updatedUserAccumulatedBtcHolding = 1.0 + 0.02 + 0.0204 = 1.0404 BTC

      expect(result.userAccumulatedBtcHolding).toBeCloseTo(1.0404, 8);
      expect(result.platformFeeFromYieldInBtc).toBeCloseTo(0, 8);
      expect(result.platformExchangeFeeInBtc).toBeCloseTo(0, 8);
    });

    it('should handle high platform fees', () => {
      const input = {
        ...baseInput,
        platformFeeFromYieldPct: 0.5, // 50% fee from yield
        platformExchangeFeePct: 0.05, // 5% exchange fee
      };
      const result = calculateUserBtcAndPlatformFees(input);

      // userDcaInBtc = 1000 / 50000 = 0.02 BTC
      // userNetDcaInBtc = 0.02 * (1 - 0.05) = 0.019 BTC
      // monthlyYieldInBtc = (1.0 + 0.019) * 0.02 = 0.02038 BTC
      // platformFeeFromYieldInBtc = 0.02038 * 0.5 = 0.01019 BTC
      // platformExchangeFeeInBtc = 0.02 - 0.019 = 0.001 BTC
      // userMonthlyYieldInBtc = 0.02038 - 0.01019 = 0.01019 BTC
      // updatedUserAccumulatedBtcHolding = 1.0 + 0.019 + 0.01019 = 1.02919 BTC

      expect(result.userAccumulatedBtcHolding).toBeCloseTo(1.02919, 8);
      expect(result.platformFeeFromYieldInBtc).toBeCloseTo(0.01019, 8);
      expect(result.platformExchangeFeeInBtc).toBeCloseTo(0.001, 8);
    });
  });

  describe('yield rate variations', () => {
    it('should handle zero yield rate', () => {
      const input = { ...baseInput, monthlyYieldRate: 0 };
      const result = calculateUserBtcAndPlatformFees(input);

      // userDcaInBtc = 1000 / 50000 = 0.02 BTC
      // userNetDcaInBtc = 0.02 * (1 - 0.01) = 0.0198 BTC
      // monthlyYieldInBtc = (1.0 + 0.0198) * 0 = 0 BTC
      // platformFeeFromYieldInBtc = 0 * 0.1 = 0 BTC
      // userMonthlyYieldInBtc = 0 - 0 = 0 BTC
      // updatedUserAccumulatedBtcHolding = 1.0 + 0.0198 + 0 = 1.0198 BTC

      expect(result.userAccumulatedBtcHolding).toBeCloseTo(1.0198, 8);
      expect(result.platformFeeFromYieldInBtc).toBeCloseTo(0, 8);
      expect(result.platformExchangeFeeInBtc).toBeCloseTo(0.0002, 8);
    });

    it('should handle high yield rate', () => {
      const input = { ...baseInput, monthlyYieldRate: 0.1 }; // 10% monthly yield
      const result = calculateUserBtcAndPlatformFees(input);

      // userDcaInBtc = 1000 / 50000 = 0.02 BTC
      // userNetDcaInBtc = 0.02 * (1 - 0.01) = 0.0198 BTC
      // monthlyYieldInBtc = (1.0 + 0.0198) * 0.1 = 0.10198 BTC
      // platformFeeFromYieldInBtc = 0.10198 * 0.1 = 0.010198 BTC
      // userMonthlyYieldInBtc = 0.10198 - 0.010198 = 0.091782 BTC
      // updatedUserAccumulatedBtcHolding = 1.0 + 0.0198 + 0.091782 = 1.111582 BTC

      expect(result.userAccumulatedBtcHolding).toBeCloseTo(1.111582, 8);
      expect(result.platformFeeFromYieldInBtc).toBeCloseTo(0.010198, 8);
      expect(result.platformExchangeFeeInBtc).toBeCloseTo(0.0002, 8);
    });
  });

  describe('BTC price variations', () => {
    it('should handle high BTC price', () => {
      const input = { ...baseInput, currentBtcPriceInEuro: 100000 }; // 100,000 EUR per BTC
      const result = calculateUserBtcAndPlatformFees(input);

      // userDcaInBtc = 1000 / 100000 = 0.01 BTC
      // userNetDcaInBtc = 0.01 * (1 - 0.01) = 0.0099 BTC
      // monthlyYieldInBtc = (1.0 + 0.0099) * 0.02 = 0.020198 BTC
      // platformFeeFromYieldInBtc = 0.020198 * 0.1 = 0.0020198 BTC
      // userMonthlyYieldInBtc = 0.020198 - 0.0020198 = 0.0181782 BTC
      // updatedUserAccumulatedBtcHolding = 1.0 + 0.0099 + 0.0181782 = 1.0280782 BTC

      expect(result.userAccumulatedBtcHolding).toBeCloseTo(1.0280782, 8);
      expect(result.platformFeeFromYieldInBtc).toBeCloseTo(0.0020198, 8);
      expect(result.platformExchangeFeeInBtc).toBeCloseTo(0.0001, 8);
    });

    it('should handle low BTC price', () => {
      const input = { ...baseInput, currentBtcPriceInEuro: 10000 }; // 10,000 EUR per BTC
      const result = calculateUserBtcAndPlatformFees(input);

      // userDcaInBtc = 1000 / 10000 = 0.1 BTC
      // userNetDcaInBtc = 0.1 * (1 - 0.01) = 0.099 BTC
      // monthlyYieldInBtc = (1.0 + 0.099) * 0.02 = 0.02198 BTC
      // platformFeeFromYieldInBtc = 0.02198 * 0.1 = 0.002198 BTC
      // userMonthlyYieldInBtc = 0.02198 - 0.002198 = 0.019782 BTC
      // updatedUserAccumulatedBtcHolding = 1.0 + 0.099 + 0.019782 = 1.118782 BTC

      expect(result.userAccumulatedBtcHolding).toBeCloseTo(1.118782, 8);
      expect(result.platformFeeFromYieldInBtc).toBeCloseTo(0.002198, 8);
      expect(result.platformExchangeFeeInBtc).toBeCloseTo(0.001, 8);
    });
  });

  describe('edge cases', () => {
    it('should handle very small amounts', () => {
      const input = {
        ...baseInput,
        monthlyDcaInEuro: 1, // 1 EUR
        userAccumulatedBtcHolding: 0.0001, // 0.0001 BTC
      };
      const result = calculateUserBtcAndPlatformFees(input);

      // userDcaInBtc = 1 / 50000 = 0.00002 BTC
      // userNetDcaInBtc = 0.00002 * (1 - 0.01) = 0.0000198 BTC
      // monthlyYieldInBtc = (0.0001 + 0.0000198) * 0.02 = 0.000002396 BTC
      // platformFeeFromYieldInBtc = 0.000002396 * 0.1 = 0.0000002396 BTC
      // userMonthlyYieldInBtc = 0.000002396 - 0.0000002396 = 0.0000021564 BTC
      // updatedUserAccumulatedBtcHolding = 0.0001 + 0.0000198 + 0.0000021564 = 0.0001219564 BTC

      expect(result.userAccumulatedBtcHolding).toBeCloseTo(0.0001219564, 12);
      expect(result.platformFeeFromYieldInBtc).toBeCloseTo(0.0000002396, 12);
      expect(result.platformExchangeFeeInBtc).toBeCloseTo(0.0000002, 12);
    });

    it('should handle very large amounts', () => {
      const input = {
        ...baseInput,
        monthlyDcaInEuro: 100000, // 100,000 EUR
        userAccumulatedBtcHolding: 100, // 100 BTC
      };
      const result = calculateUserBtcAndPlatformFees(input);

      // userDcaInBtc = 100000 / 50000 = 2 BTC
      // userNetDcaInBtc = 2 * (1 - 0.01) = 1.98 BTC
      // monthlyYieldInBtc = (100 + 1.98) * 0.02 = 2.0396 BTC
      // platformFeeFromYieldInBtc = 2.0396 * 0.1 = 0.20396 BTC
      // userMonthlyYieldInBtc = 2.0396 - 0.20396 = 1.83564 BTC
      // updatedUserAccumulatedBtcHolding = 100 + 1.98 + 1.83564 = 103.81564 BTC

      expect(result.userAccumulatedBtcHolding).toBeCloseTo(103.81564, 8);
      expect(result.platformFeeFromYieldInBtc).toBeCloseTo(0.20396, 8);
      expect(result.platformExchangeFeeInBtc).toBeCloseTo(0.02, 8);
    });
  });

  describe('mathematical properties', () => {
    it('should ensure platform fees are always positive when yield is positive', () => {
      const input = { ...baseInput, monthlyYieldRate: 0.05 }; // 5% monthly yield
      const result = calculateUserBtcAndPlatformFees(input);

      expect(result.platformFeeFromYieldInBtc).toBeGreaterThan(0);
      expect(result.platformExchangeFeeInBtc).toBeGreaterThan(0);
    });

    it('should ensure user yield is always less than or equal to total yield', () => {
      const input = { ...baseInput, monthlyYieldRate: 0.03 }; // 3% monthly yield
      const result = calculateUserBtcAndPlatformFees(input);

      const userDcaInBtc = input.monthlyDcaInEuro / input.currentBtcPriceInEuro;
      const userNetDcaInBtc = userDcaInBtc * (1 - input.platformExchangeFeePct);
      const totalYieldInBtc =
        (input.userAccumulatedBtcHolding + userNetDcaInBtc) *
        input.monthlyYieldRate;
      const userYieldInBtc = totalYieldInBtc - result.platformFeeFromYieldInBtc;

      expect(userYieldInBtc).toBeLessThanOrEqual(totalYieldInBtc);
      expect(userYieldInBtc).toBeGreaterThan(0);
    });

    it('should ensure accumulated holdings always increase with positive DCA', () => {
      const input = { ...baseInput, monthlyDcaInEuro: 500 }; // 500 EUR DCA
      const result = calculateUserBtcAndPlatformFees(input);

      expect(result.userAccumulatedBtcHolding).toBeGreaterThan(
        input.userAccumulatedBtcHolding
      );
    });
  });

  describe('return value structure', () => {
    it('should return object with correct properties', () => {
      const result = calculateUserBtcAndPlatformFees(baseInput);

      expect(result).toHaveProperty('userAccumulatedBtcHolding');
      expect(result).toHaveProperty('platformFeeFromYieldInBtc');
      expect(result).toHaveProperty('platformExchangeFeeInBtc');
      expect(typeof result.userAccumulatedBtcHolding).toBe('number');
      expect(typeof result.platformFeeFromYieldInBtc).toBe('number');
      expect(typeof result.platformExchangeFeeInBtc).toBe('number');
    });

    it('should return non-negative values', () => {
      const result = calculateUserBtcAndPlatformFees(baseInput);

      expect(result.userAccumulatedBtcHolding).toBeGreaterThanOrEqual(0);
      expect(result.platformFeeFromYieldInBtc).toBeGreaterThanOrEqual(0);
      expect(result.platformExchangeFeeInBtc).toBeGreaterThanOrEqual(0);
    });
  });
});

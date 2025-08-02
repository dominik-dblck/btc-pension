import { calculateMonthlyDcaInEuro } from '../calculateMonthlyDcaInEuro';

describe('calculateMonthlyDcaInEuro', () => {
  describe('basic functionality', () => {
    it('should return base DCA when indexing is disabled', () => {
      const dcaBaseEuro = 1000;
      const cpiFactor = 1.5;
      const enableIndexing = false;

      const result = calculateMonthlyDcaInEuro(
        dcaBaseEuro,
        cpiFactor,
        enableIndexing
      );

      expect(result).toBe(1000);
    });

    it('should return indexed DCA when indexing is enabled', () => {
      const dcaBaseEuro = 1000;
      const cpiFactor = 1.5;
      const enableIndexing = true;

      const result = calculateMonthlyDcaInEuro(
        dcaBaseEuro,
        cpiFactor,
        enableIndexing
      );

      expect(result).toBe(1500);
    });
  });

  describe('CPI factor variations', () => {
    it('should handle CPI factor of 1.0 (no inflation)', () => {
      const dcaBaseEuro = 500;
      const cpiFactor = 1.0;
      const enableIndexing = true;

      const result = calculateMonthlyDcaInEuro(
        dcaBaseEuro,
        cpiFactor,
        enableIndexing
      );

      expect(result).toBe(500);
    });

    it('should handle CPI factor greater than 1.0 (inflation)', () => {
      const dcaBaseEuro = 2000;
      const cpiFactor = 2.5;
      const enableIndexing = true;

      const result = calculateMonthlyDcaInEuro(
        dcaBaseEuro,
        cpiFactor,
        enableIndexing
      );

      expect(result).toBe(5000);
    });

    it('should handle CPI factor less than 1.0 (deflation)', () => {
      const dcaBaseEuro = 1500;
      const cpiFactor = 0.8;
      const enableIndexing = true;

      const result = calculateMonthlyDcaInEuro(
        dcaBaseEuro,
        cpiFactor,
        enableIndexing
      );

      expect(result).toBe(1200);
    });

    it('should handle very high CPI factor', () => {
      const dcaBaseEuro = 100;
      const cpiFactor = 10.0;
      const enableIndexing = true;

      const result = calculateMonthlyDcaInEuro(
        dcaBaseEuro,
        cpiFactor,
        enableIndexing
      );

      expect(result).toBe(1000);
    });

    it('should handle very low CPI factor', () => {
      const dcaBaseEuro = 1000;
      const cpiFactor = 0.1;
      const enableIndexing = true;

      const result = calculateMonthlyDcaInEuro(
        dcaBaseEuro,
        cpiFactor,
        enableIndexing
      );

      expect(result).toBe(100);
    });
  });

  describe('DCA amount variations', () => {
    it('should handle zero DCA amount', () => {
      const dcaBaseEuro = 0;
      const cpiFactor = 1.5;
      const enableIndexing = true;

      const result = calculateMonthlyDcaInEuro(
        dcaBaseEuro,
        cpiFactor,
        enableIndexing
      );

      expect(result).toBe(0);
    });

    it('should handle very small DCA amount', () => {
      const dcaBaseEuro = 0.01;
      const cpiFactor = 1.2;
      const enableIndexing = true;

      const result = calculateMonthlyDcaInEuro(
        dcaBaseEuro,
        cpiFactor,
        enableIndexing
      );

      expect(result).toBeCloseTo(0.012, 3);
    });

    it('should handle very large DCA amount', () => {
      const dcaBaseEuro = 100000;
      const cpiFactor = 1.1;
      const enableIndexing = true;

      const result = calculateMonthlyDcaInEuro(
        dcaBaseEuro,
        cpiFactor,
        enableIndexing
      );

      expect(result).toBeCloseTo(110000, 0);
    });

    it('should handle decimal DCA amount', () => {
      const dcaBaseEuro = 1234.56;
      const cpiFactor = 1.25;
      const enableIndexing = true;

      const result = calculateMonthlyDcaInEuro(
        dcaBaseEuro,
        cpiFactor,
        enableIndexing
      );

      expect(result).toBeCloseTo(1543.2, 1);
    });
  });

  describe('indexing flag behavior', () => {
    it('should ignore CPI factor when indexing is disabled', () => {
      const dcaBaseEuro = 1000;
      const cpiFactor = 2.0;
      const enableIndexing = false;

      const result = calculateMonthlyDcaInEuro(
        dcaBaseEuro,
        cpiFactor,
        enableIndexing
      );

      expect(result).toBe(1000);
    });

    it('should apply CPI factor when indexing is enabled', () => {
      const dcaBaseEuro = 1000;
      const cpiFactor = 2.0;
      const enableIndexing = true;

      const result = calculateMonthlyDcaInEuro(
        dcaBaseEuro,
        cpiFactor,
        enableIndexing
      );

      expect(result).toBe(2000);
    });
  });

  describe('edge cases', () => {
    it('should handle negative DCA amount', () => {
      const dcaBaseEuro = -500;
      const cpiFactor = 1.5;
      const enableIndexing = true;

      const result = calculateMonthlyDcaInEuro(
        dcaBaseEuro,
        cpiFactor,
        enableIndexing
      );

      expect(result).toBe(-750);
    });

    it('should handle negative CPI factor', () => {
      const dcaBaseEuro = 1000;
      const cpiFactor = -0.5;
      const enableIndexing = true;

      const result = calculateMonthlyDcaInEuro(
        dcaBaseEuro,
        cpiFactor,
        enableIndexing
      );

      expect(result).toBe(-500);
    });

    it('should handle zero CPI factor', () => {
      const dcaBaseEuro = 1000;
      const cpiFactor = 0;
      const enableIndexing = true;

      const result = calculateMonthlyDcaInEuro(
        dcaBaseEuro,
        cpiFactor,
        enableIndexing
      );

      expect(result).toBe(0);
    });
  });

  describe('mathematical properties', () => {
    it('should maintain proportionality when indexing is enabled', () => {
      const dcaBaseEuro = 1000;
      const cpiFactor = 1.5;
      const enableIndexing = true;

      const result = calculateMonthlyDcaInEuro(
        dcaBaseEuro,
        cpiFactor,
        enableIndexing
      );

      expect(result / dcaBaseEuro).toBe(cpiFactor);
    });

    it('should maintain identity when CPI factor is 1.0', () => {
      const dcaBaseEuro = 1000;
      const cpiFactor = 1.0;
      const enableIndexing = true;

      const result = calculateMonthlyDcaInEuro(
        dcaBaseEuro,
        cpiFactor,
        enableIndexing
      );

      expect(result).toBe(dcaBaseEuro);
    });

    it('should maintain identity when indexing is disabled regardless of CPI factor', () => {
      const dcaBaseEuro = 1000;
      const cpiFactors = [0.5, 1.0, 1.5, 2.0, 10.0];

      cpiFactors.forEach(cpiFactor => {
        const result = calculateMonthlyDcaInEuro(dcaBaseEuro, cpiFactor, false);
        expect(result).toBe(dcaBaseEuro);
      });
    });
  });

  describe('return value properties', () => {
    it('should return a number', () => {
      const result = calculateMonthlyDcaInEuro(1000, 1.5, true);
      expect(typeof result).toBe('number');
    });

    it('should return finite values', () => {
      const result = calculateMonthlyDcaInEuro(1000, 1.5, true);
      expect(Number.isFinite(result)).toBe(true);
    });
  });
});

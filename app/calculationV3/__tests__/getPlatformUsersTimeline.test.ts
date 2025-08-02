import {
  getPlatformUsersTimeline,
  GrowthType,
  PlatformUsersData,
} from '../getPlatformUsersTimeline';

describe('getPlatformUsersTimeline', () => {
  describe('basic functionality', () => {
    it('should generate timeline with linear growth', () => {
      const input: PlatformUsersData = {
        userStarts: 100,
        userEnds: 400,
        growthType: GrowthType.Linear,
        years: 1,
      };

      const result = getPlatformUsersTimeline(input);

      expect(result).toHaveLength(12); // 12 months
      expect(result[0].month).toBe(0);
      expect(result[0].totalUsers).toBe(125); // 100 + 25 (first month growth)
      expect(result[11].month).toBe(11);
      expect(result[11].totalUsers).toBe(400); // final total should match userEnds
    });

    it('should generate timeline with exponential growth', () => {
      const input: PlatformUsersData = {
        userStarts: 100,
        userEnds: 1000,
        growthType: GrowthType.Exponential,
        years: 1,
      };

      const result = getPlatformUsersTimeline(input);

      expect(result).toHaveLength(12);
      expect(result[0].month).toBe(0);
      expect(result[0].totalUsers).toBeGreaterThan(100);
      expect(result[11].month).toBe(11);
      expect(result[11].totalUsers).toBe(1000); // final total should match userEnds
    });

    it('should handle multi-year timeline', () => {
      const input: PlatformUsersData = {
        userStarts: 50,
        userEnds: 200,
        growthType: GrowthType.Linear,
        years: 2,
      };

      const result = getPlatformUsersTimeline(input);

      expect(result).toHaveLength(24); // 24 months
      expect(result[0].totalUsers).toBe(57); // 50 + 7 (first month growth)
      expect(result[23].totalUsers).toBe(200);
    });
  });

  describe('growth patterns', () => {
    it('should have consistent totalUsers progression', () => {
      const input: PlatformUsersData = {
        userStarts: 100,
        userEnds: 300,
        growthType: GrowthType.Linear,
        years: 1,
      };

      const result = getPlatformUsersTimeline(input);

      // Check that totalUsers increases monotonically
      for (let i = 1; i < result.length; i++) {
        expect(result[i].totalUsers).toBeGreaterThanOrEqual(
          result[i - 1].totalUsers
        );
      }

      // Check that totalUsers starts at userStarts + first month growth
      expect(result[0].totalUsers).toBeGreaterThan(input.userStarts);

      // Check that totalUsers ends at userEnds
      expect(result[result.length - 1].totalUsers).toBe(input.userEnds);
    });

    it('should handle zero growth (same start and end)', () => {
      const input: PlatformUsersData = {
        userStarts: 100,
        userEnds: 100,
        growthType: GrowthType.Linear,
        years: 1,
      };

      const result = getPlatformUsersTimeline(input);

      expect(result).toHaveLength(12);
      // All months should have 0 new users and total should remain 100
      result.forEach(month => {
        expect(month.newUsers).toBe(0);
        expect(month.totalUsers).toBe(100);
      });
    });

    it('should handle negative growth (decreasing users)', () => {
      const input: PlatformUsersData = {
        userStarts: 1000,
        userEnds: 500,
        growthType: GrowthType.Linear,
        years: 1,
      };

      const result = getPlatformUsersTimeline(input);

      expect(result).toHaveLength(12);
      // Check that totalUsers decreases
      for (let i = 1; i < result.length; i++) {
        expect(result[i].totalUsers).toBeLessThanOrEqual(
          result[i - 1].totalUsers
        );
      }
      expect(result[11].totalUsers).toBe(500);
    });
  });

  describe('edge cases', () => {
    it('should handle fractional years', () => {
      const input: PlatformUsersData = {
        userStarts: 100,
        userEnds: 200,
        growthType: GrowthType.Linear,
        years: 0.5, // 6 months
      };

      const result = getPlatformUsersTimeline(input);

      expect(result).toHaveLength(6); // Math.floor(0.5 * 12) = 6
    });

    it('should handle very small time periods', () => {
      const input: PlatformUsersData = {
        userStarts: 100,
        userEnds: 101,
        growthType: GrowthType.Linear,
        years: 0.1, // 1.2 months, should floor to 1 month
      };

      const result = getPlatformUsersTimeline(input);

      expect(result).toHaveLength(1); // Math.floor(0.1 * 12) = 1
      expect(result[0].totalUsers).toBe(101);
    });

    it('should handle large numbers', () => {
      const input: PlatformUsersData = {
        userStarts: 1000000,
        userEnds: 2000000,
        growthType: GrowthType.Linear,
        years: 1,
      };

      const result = getPlatformUsersTimeline(input);

      expect(result).toHaveLength(12);
      expect(result[0].totalUsers).toBeGreaterThan(input.userStarts);
      expect(result[11].totalUsers).toBe(input.userEnds);
    });
  });

  describe('error handling', () => {
    it('should throw error for non-finite userStarts', () => {
      const input: PlatformUsersData = {
        userStarts: NaN,
        userEnds: 1000,
        growthType: GrowthType.Linear,
        years: 1,
      };

      expect(() => getPlatformUsersTimeline(input)).toThrow(
        'userStarts/userEnds muszą być liczbami.'
      );
    });

    it('should throw error for non-finite userEnds', () => {
      const input: PlatformUsersData = {
        userStarts: 100,
        userEnds: Infinity,
        growthType: GrowthType.Linear,
        years: 1,
      };

      expect(() => getPlatformUsersTimeline(input)).toThrow(
        'userStarts/userEnds muszą być liczbami.'
      );
    });

    it('should throw error for negative years', () => {
      const input: PlatformUsersData = {
        userStarts: 100,
        userEnds: 1000,
        growthType: GrowthType.Linear,
        years: -1,
      };

      expect(() => getPlatformUsersTimeline(input)).toThrow(
        'years musi być > 0'
      );
    });

    it('should throw error for zero years', () => {
      const input: PlatformUsersData = {
        userStarts: 100,
        userEnds: 1000,
        growthType: GrowthType.Linear,
        years: 0,
      };

      expect(() => getPlatformUsersTimeline(input)).toThrow(
        'years musi być > 0'
      );
    });
  });

  describe('data structure validation', () => {
    it('should return correct data structure', () => {
      const input: PlatformUsersData = {
        userStarts: 100,
        userEnds: 200,
        growthType: GrowthType.Linear,
        years: 1,
      };

      const result = getPlatformUsersTimeline(input);

      expect(Array.isArray(result)).toBe(true);
      result.forEach((month, index) => {
        expect(month).toHaveProperty('month');
        expect(month).toHaveProperty('newUsers');
        expect(month).toHaveProperty('totalUsers');
        expect(typeof month.month).toBe('number');
        expect(typeof month.newUsers).toBe('number');
        expect(typeof month.totalUsers).toBe('number');
        expect(month.month).toBe(index);
      });
    });

    it('should have correct month indexing', () => {
      const input: PlatformUsersData = {
        userStarts: 100,
        userEnds: 200,
        growthType: GrowthType.Linear,
        years: 1,
      };

      const result = getPlatformUsersTimeline(input);

      result.forEach((month, index) => {
        expect(month.month).toBe(index);
      });
    });
  });

  describe('exponential growth specific tests', () => {
    it('should handle exponential growth with positive start and end', () => {
      const input: PlatformUsersData = {
        userStarts: 10,
        userEnds: 100,
        growthType: GrowthType.Exponential,
        years: 1,
      };

      const result = getPlatformUsersTimeline(input);

      expect(result).toHaveLength(12);
      expect(result[0].totalUsers).toBeGreaterThan(input.userStarts);
      expect(result[11].totalUsers).toBe(input.userEnds);
    });

    it('should show exponential growth pattern', () => {
      const input: PlatformUsersData = {
        userStarts: 100,
        userEnds: 1000,
        growthType: GrowthType.Exponential,
        years: 1,
      };

      const result = getPlatformUsersTimeline(input);

      // In exponential growth, later months should have larger increases
      const firstHalfGrowth = result
        .slice(0, 6)
        .reduce((sum, month) => sum + month.newUsers, 0);
      const secondHalfGrowth = result
        .slice(6, 12)
        .reduce((sum, month) => sum + month.newUsers, 0);

      // Exponential growth should have more growth in later months
      expect(secondHalfGrowth).toBeGreaterThan(firstHalfGrowth);
    });
  });

  describe('linear growth specific tests', () => {
    it('should show linear growth pattern', () => {
      const input: PlatformUsersData = {
        userStarts: 100,
        userEnds: 400,
        growthType: GrowthType.Linear,
        years: 1,
      };

      const result = getPlatformUsersTimeline(input);

      // In linear growth, monthly increases should be roughly equal
      const monthlyIncreases = result.map(month => month.newUsers);
      const avgIncrease =
        monthlyIncreases.reduce((sum, val) => sum + val, 0) /
        monthlyIncreases.length;

      // Check that most months have similar increases (allowing for rounding differences)
      monthlyIncreases.forEach(increase => {
        expect(Math.abs(increase - avgIncrease)).toBeLessThanOrEqual(1);
      });
    });
  });
});

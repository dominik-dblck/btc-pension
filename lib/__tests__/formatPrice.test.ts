import { formatPrice, formatNumber, formatPercentage } from '../formatPrice';

describe('formatPrice', () => {
  it('should format EUR price with default options', () => {
    const result = formatPrice(1234.56);
    expect(result).toMatch(/1234,56\s*€/);
  });

  it('should format USD price', () => {
    const result = formatPrice(1234.56, { currency: 'USD', locale: 'en-US' });
    expect(result).toBe('$1,234.56');
  });

  it('should format price with custom decimals', () => {
    const result = formatPrice(1234.5678, { decimals: 4 });
    expect(result).toMatch(/1234,5678\s*€/);
  });

  it('should format price with compact notation', () => {
    const result = formatPrice(1234567, { options: { notation: 'compact' } });
    expect(result).toMatch(/1,2[0-9]\s*(M|mln)\s*€/);
  });

  it('should format zero price', () => {
    const result = formatPrice(0);
    expect(result).toMatch(/0,00\s*€/);
  });

  it('should format negative price', () => {
    const result = formatPrice(-1234.56);
    expect(result).toMatch(/-1234,56\s*€/);
  });
});

describe('formatNumber', () => {
  it('should format number with default options', () => {
    const result = formatNumber(1234.56);
    expect(result).toMatch(/1234,56/);
  });

  it('should format number with custom decimals', () => {
    const result = formatNumber(1234.5678, { decimals: 4 });
    expect(result).toMatch(/1234,5678/);
  });

  it('should format number with US locale', () => {
    const result = formatNumber(1234.56, { locale: 'en-US' });
    expect(result).toBe('1,234.56');
  });

  it('should format number with compact notation', () => {
    const result = formatNumber(1234567, { options: { notation: 'compact' } });
    expect(result).toMatch(/1,2[0-9]\s*(M|mln)/);
  });

  it('should format zero', () => {
    const result = formatNumber(0);
    expect(result).toMatch(/0,00/);
  });

  it('should format negative number', () => {
    const result = formatNumber(-1234.56);
    expect(result).toMatch(/-1234,56/);
  });
});

describe('formatPercentage', () => {
  it('should format percentage with default options', () => {
    const result = formatPercentage(0.1234);
    expect(result).toMatch(/12,34%/);
  });

  it('should format percentage with custom decimals', () => {
    const result = formatPercentage(0.123456, { decimals: 4 });
    expect(result).toMatch(/12,3456%/);
  });

  it('should format percentage with US locale', () => {
    const result = formatPercentage(0.1234, { locale: 'en-US' });
    expect(result).toBe('12.34%');
  });

  it('should format zero percentage', () => {
    const result = formatPercentage(0);
    expect(result).toMatch(/0,00%/);
  });

  it('should format 100%', () => {
    const result = formatPercentage(1);
    expect(result).toMatch(/100,00%/);
  });

  it('should format negative percentage', () => {
    const result = formatPercentage(-0.1234);
    expect(result).toMatch(/-12,34%/);
  });
});

describe('real-world examples', () => {
  it('should format typical BTC prices', () => {
    const btcPrice = 50000;
    const result = formatPrice(btcPrice);
    expect(result).toMatch(/50\s*000,00\s*€/);
  });

  it('should format typical DCA amounts', () => {
    const dcaAmount = 1000;
    const result = formatPrice(dcaAmount);
    expect(result).toMatch(/1000,00\s*€/);
  });

  it('should format yield percentages', () => {
    const yieldRate = 0.05; // 5%
    const result = formatPercentage(yieldRate);
    expect(result).toMatch(/5,00%/);
  });

  it('should format large portfolio values', () => {
    const portfolioValue = 1000000;
    const result = formatPrice(portfolioValue, {
      options: { notation: 'compact' },
    });
    expect(result).toMatch(/1,0[0-9]\s*(M|mln)\s*€/);
  });

  it('should format BTC amounts as numbers', () => {
    const btcAmount = 1.23456789;
    const result = formatNumber(btcAmount, { decimals: 8 });
    expect(result).toMatch(/1,23456789/);
  });
});

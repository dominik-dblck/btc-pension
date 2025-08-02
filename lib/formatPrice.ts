export interface FormatOptions {
  currency?: string;
  decimals?: number;
  locale?: string;
  options?: Intl.NumberFormatOptions;
}

/**
 * Formats a price with currency symbol
 * @param price - The price to format
 * @param config - Configuration object
 * @returns Formatted price string
 */
export function formatPrice(price: number, config: FormatOptions = {}): string {
  const {
    currency = 'EUR',
    decimals = 2,
    locale = 'pl-PL',
    options = {},
  } = config;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    ...options,
  }).format(price);
}

/**
 * Formats a number without currency symbol
 * @param number - The number to format
 * @param config - Configuration object
 * @returns Formatted number string
 */
export function formatNumber(
  number: number,
  config: FormatOptions = {}
): string {
  const { decimals = 2, locale = 'pl-PL', options = {} } = config;

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    ...options,
  }).format(number);
}

/**
 * Formats a percentage
 * @param value - The percentage value (0-1 for 0-100%)
 * @param config - Configuration object
 * @returns Formatted percentage string
 */
export function formatPercentage(
  value: number,
  config: FormatOptions = {}
): string {
  const { decimals = 2, locale = 'pl-PL', options = {} } = config;

  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    ...options,
  }).format(value);
}

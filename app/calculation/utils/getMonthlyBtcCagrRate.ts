export function getMonthlyBtcCagrRate(annualBtcCagr: number): number {
  // clamp aby uniknąć (1+annual) <= 0 przy bardzo ujemnych stopach
  const a = Math.max(annualBtcCagr, -0.999);
  return Math.pow(1 + a, 1 / 12) - 1;
}

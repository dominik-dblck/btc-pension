export function getAnnualBtcCagr({
  yearsSinceStart,
  annualCagrStart,
  annualCagrAsymptote,
  yearsToSettle,
  residualFraction = 0.05,
}: {
  yearsSinceStart: number;
  annualCagrStart: number;
  annualCagrAsymptote: number;
  yearsToSettle: number;
  residualFraction?: number;
}): number {
  const eps = Math.min(Math.max(residualFraction, 1e-6), 0.999999);
  if (yearsToSettle <= 0) return annualCagrAsymptote;
  const tau = -yearsToSettle / Math.log(eps);
  return (
    annualCagrAsymptote +
    (annualCagrStart - annualCagrAsymptote) * Math.exp(-yearsSinceStart / tau)
  );
}

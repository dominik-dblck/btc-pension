export function calculateMonthlyDcaInEuro(
  dcaBaseEuro: number,
  cpiFactor: number,
  enableIndexing: boolean
) {
  const dcaIndexed = enableIndexing ? dcaBaseEuro * cpiFactor : dcaBaseEuro;
  return dcaIndexed;
}

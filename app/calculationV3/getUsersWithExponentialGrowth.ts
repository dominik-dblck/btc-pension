export function getUsersWithExponentialGrowth(
  start: number,
  end: number,
  months: number
): number[] {
  if (months <= 0) return [];
  if (!(start > 0 && end > 0)) {
    throw new Error('exponential growth wymaga start>0 i end>0.');
  }
  // cel: po months miesiącach dojść z start do end w sensie stanu całkowitego T_m
  // T_m(real) = start * g^{m+1}; incrementsReal[m] = T_m(real) - T_{m-1}(real), T_{-1}=start
  const g = Math.pow(end / start, 1 / months); // miesięczny faktor wzrostu stanu

  const incrementsReal: number[] = new Array(months);
  let prevTotal = start;
  for (let m = 0; m < months; m++) {
    const totalReal = start * Math.pow(g, m + 1);
    incrementsReal[m] = totalReal - prevTotal;
    prevTotal = totalReal;
  }

  // Zaokrąglamy przyrosty do całkowitych zachowując sumę (largest remainder method)
  const targetDelta = end - start; // > 0
  const floors = incrementsReal.map(x => Math.floor(x));
  const sumFloors = floors.reduce((a, b) => a + b, 0);
  let need = targetDelta - sumFloors; // ile jednostek musimy jeszcze dodać

  const fracWithIndex = incrementsReal.map((x, i) => ({
    i,
    frac: x - Math.floor(x),
  }));
  fracWithIndex.sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < need; k++) floors[fracWithIndex[k].i] += 1;

  return floors; // to są finalne newUsers per miesiąc
}

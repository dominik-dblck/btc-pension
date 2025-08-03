export function getUsersWithLinearGrowth(
  start: number,
  end: number,
  months: number
): number[] {
  if (months <= 0) return [];
  const delta = end - start; // łączny przyrost (może być ujemny)
  const base = Math.trunc(delta / months); // część równomierna
  const remainder = delta - base * months; // pozostałe "jednostki" do rozdziału
  const sign = Math.sign(remainder);
  const absRem = Math.abs(remainder);

  const incs: number[] = new Array(months);
  for (let m = 0; m < months; m++) {
    // rozdzielamy resztę po 1 jednostce na pierwsze absRem miesięcy
    incs[m] = base + (m < absRem ? sign : 0);
  }
  return incs;
}

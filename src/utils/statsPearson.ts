// Wspólny silnik Pearsona (2026-10-05, audyt trzech niezsynchronizowanych "silników
// korelacji" dot. humoru — user: "rob to samo z humorem" po rundzie tagów/eksportu).
// Wcześniej `src/utils/dashboard/correlations.ts` i `src/utils/correlations.ts` miały
// DWIE własne, prawie identyczne implementacje tej samej matematyki (te same sumy,
// różne sygnatury/konwencje przy braku wariancji) — realne ryzyko driftu, gdyby ktoś
// poprawił jedną i zapomniał drugiej. Teraz obie wołają TĘ SAMĄ funkcję; progi MIN_N/
// MIN_R zostają osobne w każdym pliku (patrz komentarze tam) — to NIE jest ten sam bug,
// bo każdy silnik patrzy na inne okno dni i inny zestaw metryk.
export function pearsonCoeff(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n === 0 || n !== ys.length) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  const d = Math.sqrt(sxx * syy);
  return d === 0 ? null : sxy / d; // d=0 → płaska seria (brak wariancji), nie ma r
}

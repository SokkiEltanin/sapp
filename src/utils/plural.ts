// Polish plural declension. Picks one/few/many:
//   1            → one   ("1 zadanie")
//   2–4          → few   ("2 zadania")  — except 12–14
//   0, 5–21, 12–14 → many ("5 zadań", "12 zadań")
export function plPlural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  const lastTwo = abs % 100;
  const last = abs % 10;
  if (abs === 1) return one;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return few;
  return many;
}

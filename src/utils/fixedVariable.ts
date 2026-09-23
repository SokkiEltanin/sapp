import { Expense } from '@/types';
import { isSelfTransfer } from './statWidgets';
import { looksLikeBill } from './recurringBills';
import { getCategoryMeta } from './categories';
import { foodAmountOf } from './food';

// Fixed = committed monthly costs you can't easily cut (rent, utilities, internet,
// insurance, subscriptions). Everything else you spend is variable/discretionary.
// Self-transfers (savings/Revolut) aren't spending at all → excluded.
export function isFixedExpense(e: Expense): boolean {
  if (e.type === 'income') return false;
  if (isSelfTransfer(e)) return false;
  if (e.category === 'housing' || e.category === 'subscriptions') return true;
  return looksLikeBill(`${e.note ?? ''} ${(e.tags ?? []).join(' ')}`);
}

export type FvBucket = 'fixed' | 'variable' | 'food';
export interface FvSplit { fixed: number; variable: number; food: number }

// Rozbija JEDEN wydatek na wkłady do kubłów Stałe/Zmienne/Jedzenie (2026-09-13, user:
// "tak jak w jedzeniu mogę zaznaczyć że to nie jedzenie każdego produktu osobno (tak
// jest teraz)" — chce TEGO SAMEGO dla stałe/zmienne). Poprzednia wersja (`bucketOf`
// klasyfikujący CAŁY wydatek do JEDNEGO kubła po samej kategorii) była ślepa na to, że
// pojedynczy paragon (np. spożywczy) może mieć WYMIESZANE produkty — część faktycznie
// jedzeniem, część nie (chemia/higiena/"nie jedzenie" oznaczone RĘCZNIE per-produkt w
// edycji paragonu, patrz `toggleItemFood` w app/expenses/[id].tsx) — więc CAŁA kwota
// wpadała w jeden kubeł, myląc "ile realnie wydaję na jedzenie" vs "na resztę zakupów".
// `foodAmountOf()` (food.ts) już dokładnie to liczy PER PRODUKT — reużyte tutaj zamiast
// zgadywania z samej kategorii całego wydatku, więc oznaczenie produktu "nie jedzenie"
// automatycznie przesuwa jego udział z kubła Jedzenie do Zmienne, bez żadnego NOWEGO
// mechanizmu do budowania. `fvOverride` (ręczne przeklasyfikowanie CAŁEGO wydatku) i
// rozpoznany rachunek stały mają pierwszeństwo i idą w 100% do jednego kubła — rozbicie
// dotyczy tylko zwykłych zakupów.
export function fvSplitOf(e: Expense): FvSplit {
  if (e.fvOverride === 'fixed') return { fixed: e.amount, variable: 0, food: 0 };
  if (e.fvOverride === 'variable') return { fixed: 0, variable: e.amount, food: 0 };
  if (e.fvOverride === 'food') return { fixed: 0, variable: 0, food: e.amount };
  if (isFixedExpense(e)) return { fixed: e.amount, variable: 0, food: 0 };
  const food = Math.min(e.amount, Math.max(0, foodAmountOf(e)));
  return { fixed: 0, variable: Math.max(0, e.amount - food), food };
}

// Dominujący kubeł JEDNEGO wydatku — do widoków, które muszą pokazać JEDNĄ etykietę (np.
// odznaka na liście transakcji), pochodna `fvSplitOf` (ta sama prawda co reszta pliku,
// nie osobna heurystyka). Dla mieszanego paragonu (jedzenie+zmienne oba >0) UI wyżej
// (ExpenseItem.tsx) pokazuje OBIE etykiety wprost zamiast polegać na tym wyborze —
// `bucketOf` zostaje jako rozsądny fallback/pojedyncza wartość tam, gdzie mieszanie nie
// ma znaczenia (np. stare wywołania, testy).
export function bucketOf(e: Expense): FvBucket {
  const s = fvSplitOf(e);
  if (s.fixed > 0 && s.fixed >= s.variable && s.fixed >= s.food) return 'fixed';
  if (s.food > 0 && s.food >= s.variable) return 'food';
  return 'variable';
}

export interface FVMonth {
  month: string;   // YYYY-MM
  fixed: number;
  variable: number; // discretionary, EXCLUDING food (kept separate so it's clear)
  food: number;     // groceries — broken out so "jedzenie vs zmienne vs stałe" is explicit
}

// Fixed vs variable vs food spend for the last `n` months (oldest → newest).
export function fixedVariableMonths(expenses: Expense[], n = 4, now = new Date()): FVMonth[] {
  const out: FVMonth[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    let fixed = 0, variable = 0, food = 0;
    for (const e of expenses) {
      if (e.type === 'income') continue;
      if (isSelfTransfer(e)) continue;
      if ((e.date ?? '').slice(0, 7) !== key) continue;
      const s = fvSplitOf(e);
      fixed += s.fixed; food += s.food; variable += s.variable;
    }
    out.push({ month: key, fixed: Math.round(fixed), variable: Math.round(variable), food: Math.round(food) });
  }
  return out;
}

export interface FixedDeviation {
  label: string;
  amount: number;
  avgAmount: number;
  deltaPct: number; // (amount - avgAmount) / avgAmount, signed
}

// Compares this month's named fixed bills (grouped the same way as `fixedBreakdown`) against
// their OWN historical average over the preceding `lookback` months, so an unusually high (or
// low) recurring bill stands out instead of hiding inside the flat "Stałe" total (2026-09-10,
// user: "wydatków stałych (odchylen)"). Needs ≥1 prior month with the SAME label to compare
// against — a brand-new bill this month has nothing to deviate from, so it's skipped rather
// than flagged as a fake 100% spike. Threshold (≥15% AND ≥20 zł) filters normal month-to-month
// noise (e.g. usage-based electricity) from a deviation worth surfacing.
export function fixedDeviations(expenses: Expense[], month: string, lookback = 3): FixedDeviation[] {
  const cur = fixedBreakdown(expenses, month);
  if (cur.length === 0) return [];
  const [y, m] = month.split('-').map(Number);
  const history: Record<string, number[]> = {};
  for (let i = 1; i <= lookback; i++) {
    const d = new Date(y, m - 1 - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    for (const it of fixedBreakdown(expenses, key)) {
      (history[it.label] ??= []).push(it.amount);
    }
  }
  const out: FixedDeviation[] = [];
  for (const it of cur) {
    const hist = history[it.label];
    if (!hist || hist.length === 0) continue;
    const avgAmount = hist.reduce((a, b) => a + b, 0) / hist.length;
    if (avgAmount <= 0) continue;
    const deltaPct = (it.amount - avgAmount) / avgAmount;
    if (Math.abs(deltaPct) < 0.15 || Math.abs(it.amount - avgAmount) < 20) continue;
    out.push({ label: it.label, amount: it.amount, avgAmount: Math.round(avgAmount), deltaPct });
  }
  return out.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));
}

export interface VariableContributor { label: string; amount: number; }

// The single biggest non-fixed, non-food purchase(s) this month — when this month's variable
// total is running above its own average, this is "what tipped it" (user: "zmiennych
// pokazujących np co przeważyło np zakup wiatraka (z odniesieniem)"). Grouped by note/store
// like `fixedBreakdown` so repeat purchases at the same place sum together instead of listing
// every receipt line.
export function topVariableContributors(expenses: Expense[], month: string, n = 2): VariableContributor[] {
  const map: Record<string, number> = {};
  for (const e of expenses) {
    if (e.type === 'income' || isSelfTransfer(e)) continue;
    if ((e.date ?? '').slice(0, 7) !== month) continue;
    const variableAmt = fvSplitOf(e).variable;
    if (variableAmt <= 0) continue;
    const label = (e.note ?? '').trim() || (e.storeName ?? '').trim() || getCategoryMeta(e.category).label;
    map[label] = (map[label] ?? 0) + variableAmt;
  }
  return Object.entries(map)
    .map(([label, amount]) => ({ label, amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n);
}

export interface FixedProgress { target: number; filled: number; pct: number; above: number }

// "Stałe wydatki" dla widgetu Pracy — zarobek w tym miesiącu vs ile potrzeba na stałe
// (mieszkanie/prąd/internet), plus nadwyżka ponad to (2026-09-10, user: "jak zarabiam na ten
// moment... ile muszę uzbierać na stałych wydatkach"; zawężone 2026-09-23, user: "bym z pracy
// wywalił jednak te cele wszystkie i zostawił tylko STAŁE WYDATKI... i pokazywał ile
// zarobiłem do stałych a ile powyżej" — wcześniejsza wersja (`workBudgetProgress`) dzieliła
// zarobek na 3 „skarbonki" po kolei (stałe→jedzenie→zmienne); usera raziły jako „cele"; teraz
// TYLKO stałe). Cel = średnia z poprzednich (nie-zerowych) miesięcy `fvMonths`; bez historii
// cel = ten miesiąc, żeby pasek miał w ogóle jakiś mianownik zamiast dzielenia przez zero.
export function workFixedProgress(earnings: number, fvMonths: FVMonth[]): FixedProgress {
  const cur = fvMonths[fvMonths.length - 1];
  const prev = fvMonths.slice(0, -1).filter(m => m.fixed + m.variable + m.food > 0);
  const target = Math.round(prev.length ? prev.reduce((a, m) => a + m.fixed, 0) / prev.length : (cur ? cur.fixed : 0));
  const earned = Math.max(0, earnings);
  const filled = Math.round(Math.min(earned, target));
  return { target, filled, pct: target > 0 ? filled / target : 1, above: Math.round(Math.max(0, earned - target)) };
}

export interface FixedItem { label: string; amount: number; }

// The named fixed bills for a month (YYYY-MM), grouped by their note/store (else the
// category label) and summed — so the UI can say "Mieszkanie 1200 · Prąd 180 · PLAY 60".
export function fixedBreakdown(expenses: Expense[], month: string): FixedItem[] {
  const map: Record<string, number> = {};
  for (const e of expenses) {
    if (e.type === 'income' || isSelfTransfer(e)) continue;
    if ((e.date ?? '').slice(0, 7) !== month) continue;
    const fixedAmt = fvSplitOf(e).fixed;
    if (fixedAmt <= 0) continue;
    const label = (e.note ?? '').trim() || (e.storeName ?? '').trim() || getCategoryMeta(e.category).label;
    map[label] = (map[label] ?? 0) + fixedAmt;
  }
  return Object.entries(map)
    .map(([label, amount]) => ({ label, amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount);
}

export interface FvTransaction { id: string; label: string; amount: number; date: string; overridden: boolean; }

// Chronologiczna (najnowsze pierwsze) lista POJEDYNCZYCH transakcji faktycznie liczonych
// w danym kuble (fixed/variable/food) w danym miesiącu — do widoku rozbicia widgetu
// "Na co idą pieniądze" (2026-09-12, user: "muszą byc... wykresy stałych, zmiennych,
// jedzenie każdy osobno klikalny z pokazaniem co sie kiedy tam wlicza"). Celowo SUROWA
// lista, NIE grupowana jak `fixedBreakdown`/`topVariableContributors` — każda transakcja
// osobno, żeby dało się ją pojedynczo przeklasyfikować (`fvOverride`, `overridden` flaguje
// już ręcznie poprawione, żeby UI mógł je wyróżnić).
export function bucketTransactions(expenses: Expense[], month: string, bucket: FvBucket): FvTransaction[] {
  const out: FvTransaction[] = [];
  for (const e of expenses) {
    if (e.type === 'income' || isSelfTransfer(e)) continue;
    if ((e.date ?? '').slice(0, 7) !== month) continue;
    // Kwota = WKŁAD tego wydatku do TEGO kubła, nie zawsze cała `e.amount` — mieszany
    // paragon (jedzenie+chemia) może pojawić się w OBU zakładkach (Jedzenie i Zmienne)
    // naraz, każda z tylko swoją częścią kwoty, patrz `fvSplitOf`.
    const amt = fvSplitOf(e)[bucket];
    if (amt <= 0) continue;
    const label = (e.note ?? '').trim() || (e.storeName ?? '').trim() || getCategoryMeta(e.category).label;
    out.push({ id: e.id, label, amount: Math.round(amt), date: e.date, overridden: !!e.fvOverride });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

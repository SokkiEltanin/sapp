import { Expense } from '@/types';
import { isSelfTransfer } from './statWidgets';
import { looksLikeBill } from './recurringBills';
import { getCategoryMeta } from './categories';

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

// Klasyfikacja JEDNEGO wydatku do kubła Stałe/Zmienne/Jedzenie — CENTRALNA funkcja
// (2026-09-12, refaktor przy okazji `e.fvOverride`), używana teraz wszędzie zamiast
// osobno powtarzanego `isFixedExpense(e) ? ... : e.category === 'groceries' ? ...`
// w każdej funkcji niżej. `fvOverride` (ręczne przeklasyfikowanie z widoku rozbicia
// widgetu "Na co idą pieniądze" — user: "zebym mógł kliknąć ze np cos sie zle liczy...
// zeby sie uczyło") ma ZAWSZE pierwszeństwo przed heurystyką kategorii/tagów.
export function bucketOf(e: Expense): FvBucket {
  if (e.fvOverride === 'fixed' || e.fvOverride === 'variable' || e.fvOverride === 'food') return e.fvOverride;
  if (isFixedExpense(e)) return 'fixed';
  if (e.category === 'groceries') return 'food';
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
      const b = bucketOf(e);
      if (b === 'fixed') fixed += e.amount;
      else if (b === 'food') food += e.amount;
      else variable += e.amount;
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
    if (bucketOf(e) !== 'variable') continue;
    const label = (e.note ?? '').trim() || (e.storeName ?? '').trim() || getCategoryMeta(e.category).label;
    map[label] = (map[label] ?? 0) + e.amount;
  }
  return Object.entries(map)
    .map(([label, amount]) => ({ label, amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n);
}

export interface BudgetBucket { label: string; target: number; filled: number; pct: number; }

// "Skarbonki" dla widgetu Pracy — zarobek w tym miesiącu rozdzielony PO KOLEI (stałe → jedzenie
// → zmienne, priorytet od najpilniejszego) na 3 potrzeby, każda wypełniana do swojego celu
// zanim nadwyżka przechodzi do następnej (2026-09-10, user: "jak zarabiam na ten moment...
// ile muszę uzbierać... paski wypełniające się jakby skarbonki ile na mieszkanie+prąd+
// internet, a ile na jedzenie, a ile śr. na zmienne wydaje"). Cel = średnia z poprzednich
// (nie-zerowych) miesięcy `fvMonths`; bez historii cel = ten miesiąc, żeby pasek miał w ogóle
// jakiś mianownik zamiast dzielenia przez zero.
export function workBudgetProgress(earnings: number, fvMonths: FVMonth[]): BudgetBucket[] {
  const cur = fvMonths[fvMonths.length - 1];
  const prev = fvMonths.slice(0, -1).filter(m => m.fixed + m.variable + m.food > 0);
  const target = (sel: (m: FVMonth) => number) =>
    prev.length ? prev.reduce((a, m) => a + sel(m), 0) / prev.length : (cur ? sel(cur) : 0);
  const buckets = [
    { label: 'Stałe · mieszkanie/prąd/internet', target: Math.round(target(m => m.fixed)) },
    { label: 'Jedzenie', target: Math.round(target(m => m.food)) },
    { label: 'Zmienne', target: Math.round(target(m => m.variable)) },
  ];
  let left = Math.max(0, earnings);
  return buckets.map(b => {
    const filled = Math.min(left, b.target);
    left -= filled;
    return { ...b, filled: Math.round(filled), pct: b.target > 0 ? filled / b.target : 1 };
  });
}

export interface FixedItem { label: string; amount: number; }

// The named fixed bills for a month (YYYY-MM), grouped by their note/store (else the
// category label) and summed — so the UI can say "Mieszkanie 1200 · Prąd 180 · PLAY 60".
export function fixedBreakdown(expenses: Expense[], month: string): FixedItem[] {
  const map: Record<string, number> = {};
  for (const e of expenses) {
    if (e.type === 'income' || isSelfTransfer(e)) continue;
    if ((e.date ?? '').slice(0, 7) !== month) continue;
    if (bucketOf(e) !== 'fixed') continue;
    const label = (e.note ?? '').trim() || (e.storeName ?? '').trim() || getCategoryMeta(e.category).label;
    map[label] = (map[label] ?? 0) + e.amount;
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
    if (bucketOf(e) !== bucket) continue;
    const label = (e.note ?? '').trim() || (e.storeName ?? '').trim() || getCategoryMeta(e.category).label;
    out.push({ id: e.id, label, amount: Math.round(e.amount), date: e.date, overridden: !!e.fvOverride });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

import { useEffect, useMemo } from 'react';
import { useExpensesStore } from '@/store/expensesStore';
import { expensesService } from '@/services/expensesService';
import { Expense, ExpenseCategory } from '@/types';
import { CATEGORY_META } from '@/utils/categories';
import { isSelfTransfer } from '@/utils/statWidgets';
import { useDayKey } from '@/hooks/useDayKey';
import { startOfWeek, endOfWeek, subWeeks, parseISO, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';

export function useExpenses() {
  const { expenses, isLoading, error, setExpenses, setLoading, setError, addExpense, deleteExpense } =
    useExpensesStore();
  // `dayKey` (2026-09-26, agent-audyt logiki) — `stats` poniżej liczy granice
  // tydzień/miesiąc z `new Date()`, ale memoizowała się TYLKO na `[expenses]`. Ekran, który
  // trzyma ten hook zamontowany przez zmianę dnia/tygodnia/miesiąca (bez żadnej mutacji
  // `expenses`) pokazywał stare `thisWeek`/`monthExpenses`/`monthCategorySpend` — a to źródło,
  // z którego dashboard's `budgetRemaining`/`budgetAlertCard` już raz zostały poprawione, by
  // czytać JAKO "jedno źródło prawdy" (patrz `index.tsx` komentarz przy `budgetAlertCard`).
  const dayKey = useDayKey();

  useEffect(() => { loadExpenses(); }, []);

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const data = await expensesService.getAll();
      setExpenses(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const now = new Date();
    const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Self-transfery (przelew między WŁASNYMI kontami) nie liczą się jako wydatek ani
    // przychód — patrz isSelfTransfer w statWidgets.ts, ten sam wyjątek co reszta
    // statystyk finansowych w apce (2026-09-14, user: "inne statystyki tez powinny brać
    // pod uwagę ze to przelew własny a nie cos co mam / wydaje").
    const isExpense = (e: Expense) => (!e.type || e.type === 'expense') && !isSelfTransfer(e);
    const isIncome = (e: Expense) => e.type === 'income' && !isSelfTransfer(e);

    // Jeden przebieg po `expenses` zamiast 6 osobnych `.filter().reduce()` (2026-10-12,
    // audyt optymalizacji runda 4) — ta sama lista była skanowana od nowa dla
    // thisWeek/lastWeek/monthExpenses/monthIncome/allByCat/monthCategorySpend, w tym
    // `parseISO(e.date)` wołane po kilka razy NA TEN SAM wpis. Każdy wpis klasyfikowany
    // raz (exp/inc), data parsowana raz, i dokładana do wszystkich kubełków, do których
    // faktycznie pasuje — ten sam wynik, 1/6 przebiegów.
    let thisWeek = 0, lastWeek = 0, monthExpenses = 0, monthIncome = 0;
    const allByCat: Record<string, number> = {};
    const monthCategorySpend: Record<string, number> = {};
    for (const e of expenses) {
      const d = parseISO(e.date);
      if (isExpense(e)) {
        allByCat[e.category] = (allByCat[e.category] ?? 0) + e.amount;
        if (isWithinInterval(d, { start: thisWeekStart, end: thisWeekEnd })) thisWeek += e.amount;
        if (isWithinInterval(d, { start: lastWeekStart, end: lastWeekEnd })) lastWeek += e.amount;
        if (isWithinInterval(d, { start: monthStart, end: monthEnd })) {
          monthExpenses += e.amount;
          monthCategorySpend[e.category] = (monthCategorySpend[e.category] ?? 0) + e.amount;
        }
      } else if (isIncome(e) && isWithinInterval(d, { start: monthStart, end: monthEnd })) {
        monthIncome += e.amount;
      }
    }
    const topCatKey = Object.entries(allByCat).sort((a, b) => b[1] - a[1])[0]?.[0] as ExpenseCategory | undefined;
    const topCategory = topCatKey ? (CATEGORY_META as any)[topCatKey]?.label : undefined;

    return { thisWeek, lastWeek, monthExpenses, monthIncome, topCategory, monthCategorySpend };
  }, [expenses, dayKey]);

  const grouped = useMemo(() => {
    const map: Record<string, Expense[]> = {};
    for (const e of expenses) {
      const key = (e.date ?? '').split('T')[0] || 'brak-daty';
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [expenses]);

  const remove = async (id: string) => {
    deleteExpense(id);
    await expensesService.remove(id);
  };

  return { expenses, grouped, stats, isLoading, error, reload: loadExpenses, remove };
}

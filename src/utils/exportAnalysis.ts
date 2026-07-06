import { Expense, CalendarEvent, MoodEntry, Task, WorkSettings } from '@/types';
import { generateMonthlyReport } from '@/utils/monthlyReports';
import { buildMonthCards } from '@/utils/monthCards';
import { computePayMonths, payMonthsSummary } from '@/utils/workSummary';
import { isPaycheck } from '@/hooks/useWorkEarnings';
import { paycheckTargetMonth } from '@/utils/paycheck';
import { canonicalProductName, productGroupKey } from '@/utils/productMemory';
import { countsForConsumption } from '@/store/statsScope';
import { isWorkEvent, shiftHours } from '@/utils/workEvents';

// Builds a "derived analysis" block for the JSON export: instead of only dumping
// the raw records, it also runs the app's OWN computation functions over that data
// (paychecks, work rate, monthly reports, Wrapped cards, health rollups, product
// grouping) and includes a set of integrity checks. That lets a whole export be
// eyeballed to confirm the app's INTERPRETATION matches its RAW data.

export interface AnalysisInput {
  expenses: Expense[];
  events: CalendarEvent[];
  mood: MoodEntry[];
  tasks: Task[];
  workSettings: WorkSettings;
  healthDays: Record<string, { steps: number; sleepMinutes: number; weightKg: number | null }>;
  nameAliases: Record<string, string>;
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function round2(n: number) { return Math.round(n * 100) / 100; }

function monthsWithData(inp: AnalysisInput): string[] {
  const set = new Set<string>();
  for (const e of inp.expenses) { const m = (e.date ?? '').slice(0, 7); if (m) set.add(m); }
  for (const e of inp.mood) { const m = (e.date ?? '').slice(0, 7); if (m) set.add(m); }
  for (const d of Object.keys(inp.healthDays)) { const m = d.slice(0, 7); if (m) set.add(m); }
  return Array.from(set).sort().reverse();
}

export function buildDerivedAnalysis(inp: AnalysisInput) {
  const { expenses, events, mood, tasks, workSettings, healthDays, nameAliases } = inp;
  const warnings: string[] = [];

  // ── integrity: shape / sanity of the raw records ───────────────────────────
  const expDates = expenses.map(e => (e.date ?? '').slice(0, 10)).filter(Boolean).sort();
  const badDate = expenses.filter(e => !/^\d{4}-\d{2}-\d{2}/.test(e.date ?? '')).length;
  const negAmount = expenses.filter(e => (e.amount ?? 0) < 0).length;
  if (badDate) warnings.push(`${badDate} wydatków bez poprawnej daty (YYYY-MM-DD)`);
  if (negAmount) warnings.push(`${negAmount} wydatków z ujemną kwotą`);

  // receipt line-sum vs expense total (spots parser / edit drift)
  let receiptMismatch = 0;
  const mismatchSamples: { id: string; date: string; amount: number; itemsSum: number }[] = [];
  for (const e of expenses) {
    const items = e.receiptItems ?? [];
    if (items.length < 2) continue;
    const sum = items.reduce((s, it) => s + (it.price ?? 0), 0);
    if (e.amount > 0 && Math.abs(sum - e.amount) / e.amount > 0.12) {
      receiptMismatch++;
      if (mismatchSamples.length < 8) mismatchSamples.push({ id: e.id, date: (e.date ?? '').slice(0, 10), amount: round2(e.amount), itemsSum: round2(sum) });
    }
  }
  if (receiptMismatch) warnings.push(`${receiptMismatch} paragonów, gdzie suma pozycji ≠ kwota (>12%) — możliwy błąd parsera/edycji`);

  // ── work / paychecks ───────────────────────────────────────────────────────
  const wp = (workSettings.workPrefix ?? '').trim();
  const paychecks = expenses
    .filter(e => isPaycheck(e, workSettings.workPrefix))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(e => ({ id: e.id, date: (e.date ?? '').slice(0, 10), amount: round2(e.amount), note: e.note ?? null, targetMonth: paycheckTargetMonth(e) }));
  const dupMonths: Record<string, number> = {};
  for (const p of paychecks) dupMonths[p.targetMonth] = (dupMonths[p.targetMonth] ?? 0) + 1;
  const duplicated = Object.entries(dupMonths).filter(([, n]) => n > 1).map(([m, n]) => `${m}×${n}`);
  if (duplicated.length) warnings.push(`Wypłaty przypięte do tego samego miesiąca: ${duplicated.join(', ')}`);
  if (!wp && !workSettings.workColor) warnings.push('Brak workPrefix i workColor — wykrywanie pracy/wypłat może być niepełne');

  const payMonths = computePayMonths(expenses, events, workSettings);
  const paySummary = payMonthsSummary(payMonths);
  const payMonthsMissingHours = payMonths.filter(r => r.hours === 0).map(r => r.month);
  if (payMonthsMissingHours.length) warnings.push(`Wypłaty bez godzin z kalendarza (poza średnią zł/h): ${payMonthsMissingHours.join(', ')}`);

  // ── work hours per month (from calendar) ───────────────────────────────────
  const isWork = (e: CalendarEvent) => isWorkEvent(e, { workColor: workSettings.workColor, workPrefix: wp.toLowerCase() });
  const hoursByMonth: Record<string, number> = {};
  for (const e of events) { if (!isWork(e)) continue; const m = (e.date ?? '').slice(0, 7); if (m) hoursByMonth[m] = round2((hoursByMonth[m] ?? 0) + shiftHours(e)); }

  // ── monthly reports + Wrapped cards ────────────────────────────────────────
  const months = monthsWithData(inp);
  const monthly = months.map(month => generateMonthlyReport({ month, moodEntries: mood, tasks, expenses, events }));
  const monthCards = buildMonthCards({ expenses, moodEntries: mood, healthDays, payMonths, nameAliases });

  // ── health rollup per month ────────────────────────────────────────────────
  const healthByMonth: Record<string, { steps: number; stepDays: number; sleepAvgH: number | null; lastWeight: number | null }> = {};
  const sleepAcc: Record<string, number[]> = {};
  for (const [d, v] of Object.entries(healthDays)) {
    const m = d.slice(0, 7);
    const h = (healthByMonth[m] ??= { steps: 0, stepDays: 0, sleepAvgH: null, lastWeight: null });
    if (v.steps > 0) { h.steps += v.steps; h.stepDays++; }
    if (v.sleepMinutes > 0) (sleepAcc[m] ??= []).push(v.sleepMinutes);
    if (v.weightKg != null && v.weightKg > 0) h.lastWeight = v.weightKg;
  }
  for (const [m, arr] of Object.entries(sleepAcc)) if (arr.length) healthByMonth[m].sleepAvgH = round2(arr.reduce((s, x) => s + x, 0) / arr.length / 60);

  // ── product grouping (canonical, top 20) ───────────────────────────────────
  const pCount: Record<string, number> = {};
  const pSpend: Record<string, number> = {};
  for (const e of expenses) {
    if (e.type === 'income') continue;
    for (const it of (e.receiptItems ?? [])) {
      if (!countsForConsumption(it)) continue;
      const nm = it.name?.trim(); if (!nm) continue;
      const key = productGroupKey(canonicalProductName(nm, nameAliases)) || canonicalProductName(nm, nameAliases);
      if (!key) continue;
      pCount[key] = (pCount[key] ?? 0) + Math.max(1, Math.round(it.quantity || 1));
      pSpend[key] = round2((pSpend[key] ?? 0) + (it.price ?? 0));
    }
  }
  const topProducts = Object.keys(pCount)
    .map(k => ({ group: k, count: pCount[k], spend: pSpend[k] }))
    .sort((a, b) => b.count - a.count).slice(0, 20);

  return {
    generatedAt: new Date().toISOString(),
    warnings,
    integrity: {
      expenses: {
        total: expenses.length,
        income: expenses.filter(e => e.type === 'income').length,
        expense: expenses.filter(e => !e.type || e.type === 'expense').length,
        withReceiptItems: expenses.filter(e => (e.receiptItems?.length ?? 0) > 0).length,
        dateRange: expDates.length ? [expDates[0], expDates[expDates.length - 1]] : null,
        badDate, negAmount, receiptMismatch, mismatchSamples,
      },
      events: { total: events.length, work: events.filter(isWork).length, missingDate: events.filter(e => !e.date).length },
      mood: { total: mood.length, days: new Set(mood.map(e => e.date)).size },
      tasks: { total: tasks.length, done: tasks.filter(t => t.status === 'done').length },
      health: { days: Object.keys(healthDays).length, months: Object.keys(healthByMonth).length },
      monthsCovered: months.length,
    },
    work: {
      settings: { workPrefix: workSettings.workPrefix ?? null, workColor: workSettings.workColor ?? null, excludedPayMonths: workSettings.excludedPayMonths ?? [] },
      paychecksDetected: paychecks.length,
      paychecks,
      avgRatePerHour: paySummary.avgRate != null ? round2(paySummary.avgRate) : null,
      includedMonths: paySummary.includedCount,
      totalEarned: round2(paySummary.totalEarned),
      payMonths: payMonths.map(r => ({ ...r, amount: round2(r.amount), hours: round2(r.hours) })),
      hoursByMonth,
    },
    monthly,
    monthCards,
    healthByMonth,
    topProducts,
  };
}

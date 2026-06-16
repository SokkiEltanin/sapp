import { Expense, Vehicle } from '@/types';

// What "fuel" looks like (category transport + a fuel-ish tag/word) — used to
// split a vehicle's spend into fuel vs parts/other.
const FUEL_TAGS = ['paliwo', 'tankowanie', 'benzyna', 'diesel', 'lpg', 'olej napędowy'];
function looksLikeFuel(e: Expense): boolean {
  if ((e.tags ?? []).some(t => FUEL_TAGS.includes(t.toLowerCase()))) return true;
  const txt = `${e.note ?? ''} ${e.storeName ?? ''}`.toLowerCase();
  return /paliw|tankow|benzyn|diesel|\blpg\b|orlen|bp|shell|circle\s*k|moya|amic|lotos/.test(txt);
}

// Does an expense belong to a vehicle?
//  • a manual link (expense.vehicleId) is exclusive and always wins,
//  • else the vehicle's tag on the expense (top-level or a receipt item),
//  • else, when there's only ONE vehicle, anything in the Transport category.
export function expenseMatchesVehicle(e: Expense, v: Vehicle, soleVehicle: boolean): boolean {
  if (e.type === 'income') return false;
  if (e.vehicleId) return e.vehicleId === v.id;
  const tag = (v.tag ?? '').toLowerCase().trim();
  if (tag) {
    if ((e.tags ?? []).some(t => t.toLowerCase() === tag)) return true;
    if ((e.receiptItems ?? []).some(it => (it.tags ?? []).some(t => t.toLowerCase() === tag))) return true;
  }
  if (soleVehicle && e.category === 'transport') return true;
  return false;
}

export interface VehicleSummary {
  total: number;
  fuel: number;
  other: number;
  count: number;
  thisMonth: number;
  expenses: Expense[];   // newest first
}

export function summarizeVehicle(v: Vehicle, expenses: Expense[], soleVehicle: boolean): VehicleSummary {
  const ym = new Date().toISOString().slice(0, 7);
  const mine = expenses.filter(e => expenseMatchesVehicle(e, v, soleVehicle));
  let total = 0, fuel = 0, other = 0, thisMonth = 0;
  for (const e of mine) {
    total += e.amount;
    if (looksLikeFuel(e)) fuel += e.amount; else other += e.amount;
    if ((e.date ?? '').slice(0, 7) === ym) thisMonth += e.amount;
  }
  mine.sort((a, b) => (a.date < b.date ? 1 : -1));
  return { total, fuel, other, count: mine.length, thisMonth, expenses: mine };
}

// Months until the next oil change is due (negative = overdue). Null when not tracked.
export function oilDueMonths(v: Vehicle): number | null {
  if (!v.oilChangeDate || !v.oilIntervalMonths) return null;
  const last = new Date(v.oilChangeDate);
  const due = new Date(last); due.setMonth(due.getMonth() + v.oilIntervalMonths);
  return (due.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44);
}

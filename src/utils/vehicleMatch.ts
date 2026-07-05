import { Expense, Vehicle, VehicleMaintenance } from '@/types';
import { monthISO } from '@/utils/date';

// What "fuel" looks like (Transport + a fuel-ish tag/word). Only the MAIN car
// catches it; everything else is matched strictly by tag.
const FUEL_TAGS = ['paliwo', 'tankowanie', 'benzyna', 'diesel', 'lpg', 'olej napędowy'];
export function looksLikeFuel(e: Expense): boolean {
  if ((e.tags ?? []).some(t => FUEL_TAGS.includes(t.toLowerCase()))) return true;
  const txt = `${e.note ?? ''} ${e.storeName ?? ''}`.toLowerCase();
  return /paliw|tankow|benzyn|diesel|\blpg\b|orlen|\bbp\b|shell|circle\s*k|\bmoya\b|amic|lotos/.test(txt);
}
function isFuelExpense(e: Expense): boolean {
  return e.category === 'transport' && looksLikeFuel(e);
}

// Does an expense belong to a vehicle? STRICT — no "all Transport" catch-all:
//  • a manual link (expense.vehicleId) is exclusive and always wins,
//  • else the vehicle's tag on the expense / a receipt item, or a #tag / [X]
//    prefix in the note (e.g. "#rower", "[R]"),
//  • else fuel — but ONLY for the designated main car.
export function expenseMatchesVehicle(e: Expense, v: Vehicle, mainCarId?: string): boolean {
  if (e.type === 'income') return false;
  if (e.vehicleId) return e.vehicleId === v.id;
  const tag = (v.tag ?? '').toLowerCase().trim();
  if (tag) {
    if ((e.tags ?? []).some(t => t.toLowerCase() === tag)) return true;
    if ((e.receiptItems ?? []).some(it => (it.tags ?? []).some(t => t.toLowerCase() === tag))) return true;
    const txt = `${e.note ?? ''} ${e.storeName ?? ''}`.toLowerCase();
    if (txt.includes(`#${tag}`) || txt.includes(`[${tag[0]}]`)) return true;
  }
  if (v.id === mainCarId && v.kind === 'car' && isFuelExpense(e)) return true;
  return false;
}

// The car that catches fuel: the one flagged isMainCar, else the only car.
export function mainCarId(vehicles: Vehicle[]): string | undefined {
  const flagged = vehicles.find(v => v.isMainCar && v.kind === 'car');
  if (flagged) return flagged.id;
  const cars = vehicles.filter(v => v.kind === 'car');
  return cars.length === 1 ? cars[0].id : undefined;
}

export interface VehicleSummary {
  total: number;
  fuel: number;
  other: number;
  count: number;
  thisMonth: number;
  expenses: Expense[];   // newest first
}

export function summarizeVehicle(v: Vehicle, expenses: Expense[], mainId?: string): VehicleSummary {
  const ym = monthISO();
  const mine = expenses.filter(e => expenseMatchesVehicle(e, v, mainId));
  let total = 0, fuel = 0, other = 0, thisMonth = 0;
  for (const e of mine) {
    total += e.amount;
    if (looksLikeFuel(e)) fuel += e.amount; else other += e.amount;
    if ((e.date ?? '').slice(0, 7) === ym) thisMonth += e.amount;
  }
  mine.sort((a, b) => (a.date < b.date ? 1 : -1));
  return { total, fuel, other, count: mine.length, thisMonth, expenses: mine };
}

// Months until a maintenance entry is next due (negative = overdue). Null when
// no interval is set.
export function maintenanceDueMonths(m: VehicleMaintenance): number | null {
  if (!m.intervalMonths) return null;
  const due = new Date(m.date); due.setMonth(due.getMonth() + m.intervalMonths);
  return (due.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44);
}

// Kind-aware service presets (label + default interval in months).
export function maintenancePresets(kind: Vehicle['kind']): { label: string; intervalMonths?: number }[] {
  if (kind === 'bike') return [
    { label: 'Smarowanie łańcucha', intervalMonths: 1 },
    { label: 'Wymiana opony' },
    { label: 'Przegląd / serwis', intervalMonths: 12 },
    { label: 'Akcesoria' },
  ];
  if (kind === 'car') return [
    { label: 'Wymiana oleju', intervalMonths: 12 },
    { label: 'Płyn do spryskiwaczy' },
    { label: 'Klocki hamulcowe', intervalMonths: 24 },
    { label: 'Wymiana opon', intervalMonths: 6 },
    { label: 'Przegląd techniczny', intervalMonths: 12 },
  ];
  return [
    { label: 'Serwis', intervalMonths: 12 },
    { label: 'Części / akcesoria' },
  ];
}

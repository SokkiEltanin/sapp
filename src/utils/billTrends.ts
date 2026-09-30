import { Expense } from '@/types';
import { BILL_TYPES, billTagFor } from '@/utils/recurringBills';

// Wykres zmian stałych opłat (2026-09-30, user: "możemy dodać stałe opłaty mieszkanie/
// prąd/internet żeby był wykres który pokazuje czy są jakieś zmiany, głównie chodzi o
// prąd bo mieszkanie i internet raczej się nie zmienia") — czysta funkcja budująca
// chronologiczną historię kwot PER typ rachunku (`BILL_TYPES`, już istniejący, dzielony z
// filtrem "Rachunki" w finances.tsx i sugestią "stały rachunek" na dashboardzie — TA SAMA
// definicja "co liczy się jako prąd/czynsz/internet", nie druga, osobna kopia). Ogólna,
// NIE zahardkodowana na te trzy — user wymienił je jako przykład, appka śledzi WSZYSTKIE
// typy z BILL_TYPES które mają >=2 wpisy.

export interface BillTrendPoint {
  date: string;   // YYYY-MM-DD
  amount: number;
}

export interface BillTrend {
  tag: string;
  name: string;
  icon: string;
  points: BillTrendPoint[];  // chronologiczne, najstarsze pierwsze
  lastAmount: number;
  avgAmount: number;
  changePct: number | null;  // vs poprzedni wpis; null gdy < 2 punkty (nie powinno się zdarzyć, filtrowane niżej)
}

export function buildBillTrends(expenses: Expense[]): BillTrend[] {
  const byTag: Record<string, BillTrendPoint[]> = {};
  for (const e of expenses) {
    if (e.type === 'income') continue;
    const bt = billTagFor(e);
    if (!bt) continue;
    const date = (e.date ?? '').slice(0, 10);
    if (!date) continue;
    (byTag[bt.tag] ??= []).push({ date, amount: e.amount });
  }

  const out: BillTrend[] = [];
  for (const t of BILL_TYPES) {
    const pts = (byTag[t.tag] ?? []).sort((a, b) => a.date.localeCompare(b.date));
    if (pts.length < 2) continue; // potrzeba co najmniej dwóch punktów, żeby "zmiana" cokolwiek znaczyła
    const lastAmount = pts[pts.length - 1].amount;
    const prevAmount = pts[pts.length - 2].amount;
    const changePct = prevAmount > 0 ? Math.round(((lastAmount - prevAmount) / prevAmount) * 100) : null;
    const avgAmount = Math.round(pts.reduce((s, p) => s + p.amount, 0) / pts.length);
    out.push({ tag: t.tag, name: t.name, icon: t.icon, points: pts, lastAmount, avgAmount, changePct });
  }

  // Najbardziej zmienne (|changePct| największy) pierwsze — user explicite chce widzieć
  // GŁÓWNIE to, co się zmienia (prąd), nie czynsz/internet które zwykle stoją w miejscu.
  return out.sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0));
}

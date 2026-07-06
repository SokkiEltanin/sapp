import { MonthCard, MonthTier } from '@/utils/monthCards';

// A grand "Wrapped ROKU" card — the crown of the collection. Aggregated from the
// month cards of one calendar year so it stays consistent with them (steps,
// sweets, spend, earnings, and the rarity tiers the months earned).

export interface YearCard {
  year: number;
  months: number;             // month cards collected this year
  totalSteps: number;
  totalSpend: number;
  totalEarned: number;
  topSweet?: { name: string; emoji: string; count: number };
  bestStepsMonth?: { monthName: string; steps: number };
  tierCounts: Record<MonthTier, number>;
  legendaryCount: number;     // diamond + sapphire
  palette: [string, string, string];
  accent: string;
  headline: string;
}

const YEAR_PALETTE: [string, string, string] = ['#7C3AED', '#F59E0B', '#0B1020']; // regal violet→gold
const YEAR_ACCENT = '#FDE047';

function fmtSteps(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.0', '')}k`;
  return String(n);
}

export function buildYearCards(cards: MonthCard[]): YearCard[] {
  const byYear: Record<number, MonthCard[]> = {};
  for (const c of cards) (byYear[c.year] ??= []).push(c);

  const out: YearCard[] = [];
  for (const [yStr, list] of Object.entries(byYear)) {
    const year = Number(yStr);
    if (list.length < 2) continue; // a year card needs at least a couple of months

    let totalSteps = 0, totalSpend = 0, totalEarned = 0;
    const tierCounts: Record<MonthTier, number> = { miedziana: 0, srebrna: 0, zlota: 0, diamentowa: 0, szafirowa: 0 };
    const sweetAcc: Record<string, { count: number; emoji: string; name: string }> = {};
    let best: { monthName: string; steps: number } | undefined;

    for (const c of list) {
      totalSteps += c.steps;
      totalSpend += c.totalSpend;
      totalEarned += c.earned;
      tierCounts[c.tier]++;
      for (const s of c.sweets) {
        const key = s.name.toLowerCase();
        (sweetAcc[key] ??= { count: 0, emoji: s.emoji, name: s.name }).count += s.count;
      }
      if (c.steps > 0 && (!best || c.steps > best.steps)) best = { monthName: c.monthName, steps: c.steps };
    }

    const topSweet = Object.values(sweetAcc).sort((a, b) => b.count - a.count)[0];
    const legendaryCount = tierCounts.diamentowa + tierCounts.szafirowa;

    let headline: string;
    if (tierCounts.szafirowa > 0) headline = `Rok z legendą — ${tierCounts.szafirowa}× karta szafirowa! 🔷`;
    else if (topSweet && topSweet.count >= 6) headline = `Słodki król roku: ${topSweet.name} ×${topSweet.count} ${topSweet.emoji}`;
    else if (totalSteps > 0) headline = `${fmtSteps(totalSteps)} kroków przez cały rok 👣`;
    else if (totalEarned > 0) headline = `Zarobione ${Math.round(totalEarned).toLocaleString('pl-PL')} zł w ${year}`;
    else headline = `Twój ${year} w pigułce`;

    out.push({
      year, months: list.length, totalSteps, totalSpend, totalEarned,
      topSweet: topSweet ? { name: topSweet.name, emoji: topSweet.emoji, count: topSweet.count } : undefined,
      bestStepsMonth: best, tierCounts, legendaryCount,
      palette: YEAR_PALETTE, accent: YEAR_ACCENT, headline,
    });
  }
  return out.sort((a, b) => b.year - a.year);
}

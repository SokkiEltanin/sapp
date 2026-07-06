import { Expense } from '@/types';
import { countsForConsumption } from '@/store/statsScope';
import { attributedPrice } from '@/utils/tagBudgets';
import { canonicalProductName } from '@/utils/productMemory';
import { SWEET_TAGS, sweetEmoji } from '@/utils/monthCards';

// "Kto zjadł" — splits consumption between people (payers/eaters list) for a given
// month. Uses attributedPrice: an item's price is shared among the people who ate
// it (eaters); untagged items are split evenly among everyone. Answers "who ate
// how much of the sweets / food" even though one person pays.

export interface PersonRow {
  person: string;
  sweetsSpend: number;   // attributed zł on sweets/snacks
  sweetsCount: number;   // attributed count (fractional → rounded)
  foodSpend: number;     // attributed zł on all consumption items
  topSweet?: { name: string; emoji: string };
}

export interface PersonConsumption {
  people: PersonRow[];       // sorted by sweetsSpend desc
  sharedPct: number;         // 0..1 — share of sweets that was untagged (split evenly)
  anyTagged: boolean;        // any item actually has eaters set
  totalSweets: number;
}

function monthKeyNow(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function buildPersonConsumption(
  expenses: Expense[],
  persons: string[],
  nameAliases: Record<string, string>,
  month: string = monthKeyNow(),
): PersonConsumption {
  const rows: Record<string, PersonRow> = {};
  const topAcc: Record<string, Record<string, { count: number; name: string }>> = {};
  for (const p of persons) { rows[p] = { person: p, sweetsSpend: 0, sweetsCount: 0, foodSpend: 0 }; topAcc[p] = {}; }

  let totalSweets = 0, untaggedSweets = 0, anyTagged = false;

  for (const e of expenses) {
    if (e.type === 'income') continue;
    if (!(e.date ?? '').startsWith(month)) continue;
    for (const it of (e.receiptItems ?? [])) {
      if (!countsForConsumption(it)) continue;
      const isSweet = (it.tags ?? []).some(t => SWEET_TAGS.includes(t));
      const hasEaters = (it.eaters?.length ?? 0) > 0;
      if (isSweet) {
        totalSweets += it.price;
        if (!hasEaters) untaggedSweets += it.price; else anyTagged = true;
      } else if (hasEaters) {
        anyTagged = true;
      }
      for (const p of persons) {
        const share = attributedPrice(it, p, persons);
        if (share <= 0) continue;
        rows[p].foodSpend += share;
        if (isSweet) {
          rows[p].sweetsSpend += share;
          const eatersN = (it.eaters?.length ?? 0) || persons.length;
          rows[p].sweetsCount += (Math.max(1, Math.round(it.quantity || 1))) / eatersN;
          const canon = canonicalProductName(it.name ?? '', nameAliases) || (it.name ?? '').trim();
          if (canon) {
            const key = canon.toLowerCase();
            (topAcc[p][key] ??= { count: 0, name: canon }).count += share; // by spend share
          }
        }
      }
    }
  }

  const people = persons.map(p => {
    const top = Object.values(topAcc[p]).sort((a, b) => b.count - a.count)[0];
    return {
      ...rows[p],
      sweetsCount: Math.round(rows[p].sweetsCount),
      topSweet: top ? { name: top.name, emoji: sweetEmoji(top.name) } : undefined,
    };
  }).sort((a, b) => b.sweetsSpend - a.sweetsSpend);

  return {
    people,
    sharedPct: totalSweets > 0 ? untaggedSweets / totalSweets : 0,
    anyTagged,
    totalSweets,
  };
}

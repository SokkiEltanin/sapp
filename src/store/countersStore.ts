import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { throttledAsyncStorage } from '@/utils/throttledStorage';

export type CounterKind = 'until' | 'since';

export interface Counter {
  id: string;
  kind: CounterKind;
  name: string;
  date: string;       // until → target date; since → last-done date (YYYY-MM-DD)
  startDate: string;  // until → progress start (creation day); since → baseline for auto
  endDate?: string;   // until only → end of an event window (e.g. trip's last day)
  emoji?: string;     // until only → marker that hops along the bar instead of the walker
  icon?: string;      // optional lucide key (see counterIcons)
  mode?: 'auto';      // since only: 'days without X' auto-tracked
  keyword?: string;   // auto: '|'-separated keywords matched against expenses / meals
  track?: 'buy' | 'eat'; // auto: reset on BUYING (paragony) or EATING (Co zjadłem). Default 'eat'.
  onDashboard?: boolean; // show as a dashboard tile
  createdAt: string;
}

interface CountersState {
  counters: Counter[];
  add: (c: Omit<Counter, 'id' | 'createdAt'>) => void;
  update: (id: string, patch: Partial<Counter>) => void;
  remove: (id: string) => void;
  resetSince: (id: string) => void; // "zrobione dziś"
}

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const useCounters = create<CountersState>()(
  persist(
    (set) => ({
      counters: [],
      add: (c) => set((s) => ({
        counters: [{ ...c, id: `cnt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString() }, ...s.counters],
      })),
      update: (id, patch) => set((s) => ({ counters: s.counters.map(c => c.id === id ? { ...c, ...patch } : c) })),
      remove: (id) => set((s) => ({ counters: s.counters.filter(c => c.id !== id) })),
      resetSince: (id) => set((s) => ({ counters: s.counters.map(c => c.id === id ? { ...c, date: todayStr() } : c) })),
    }),
    { name: 'counters-v1', storage: createJSONStorage(() => throttledAsyncStorage()) },
  ),
);

// ── Derived helpers ─────────────────────────────────────────────────────────
const MS_DAY = 86400000;
const atMidnight = (iso: string) => { const d = new Date(iso + 'T00:00:00'); return d.getTime(); };

// since: whole days elapsed since the last-done date (0 = today).
export function daysSince(c: Counter, now = Date.now()): number {
  return Math.max(0, Math.floor((now - atMidnight(c.date)) / MS_DAY));
}

// until: whole days remaining to the target (0 = today, negative = passed).
export function daysUntil(c: Counter, now = Date.now()): number {
  return Math.ceil((atMidnight(c.date) - now) / MS_DAY);
}

// until: 0..1 fraction of the journey covered (startDate → target).
export function untilProgress(c: Counter, now = Date.now()): number {
  const start = atMidnight(c.startDate || c.createdAt.slice(0, 10));
  const end = atMidnight(c.date);
  if (end <= start) return 1;
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}

// ── Event window (a trip that lasts several days) ───────────────────────────
// today sits inside [date .. endDate] (both days inclusive).
export function isDuringEvent(c: Counter, now = Date.now()): boolean {
  if (!c.endDate) return false;
  return now >= atMidnight(c.date) && now < atMidnight(c.endDate) + MS_DAY;
}
// whole days left until the event ends (0 = ends today, negative = over).
export function daysUntilEnd(c: Counter, now = Date.now()): number {
  if (!c.endDate) return 0;
  return Math.ceil((atMidnight(c.endDate) - now) / MS_DAY);
}
// true once the event window (or plain target) is fully in the past.
export function isOver(c: Counter, now = Date.now()): boolean {
  return c.endDate ? now >= atMidnight(c.endDate) + MS_DAY : daysUntil(c, now) < 0;
}
// 0..1 progress through the event window (date → endDate) — the car drives along it.
export function eventProgress(c: Counter, now = Date.now()): number {
  if (!c.endDate) return 0;
  const start = atMidnight(c.date), end = atMidnight(c.endDate);
  if (end <= start) return 1;
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}

// ── Auto "days without X" — tracked from purchases ──────────────────────────
export const AVOID_PRESETS: { key: string; label: string; keyword: string }[] = [
  { key: 'sweets',   label: 'słodyczy',    keyword: 'słodycz|slodycz|czekolad|baton|cukier|żelk|zelk|oreo|jeżyk|jezyk|lody|ciast|chałw|chalw|pączek|paczek|toffi|chips|chrupk|paluszk' },
  { key: 'fastfood', label: 'fast foodów', keyword: 'mcdonald|kfc|pizza|burger|kebab|kebap|frytk|sushi|glovo|wolt|telepizza|bobby' },
  { key: 'alcohol',  label: 'alkoholu',    keyword: 'piwo|wino|wódka|wodka|whisky|drink|alkohol|browar|cydr|tyskie|żubr|zubr|lech ' },
  { key: 'energy',   label: 'energetyków', keyword: 'monster|red bull|redbull|tiger energy|energetyk|rockstar|burn ' },
];

type MatchExpense = { type?: string; date?: string; note?: string; tags?: string[]; storeName?: string; receiptItems?: { name?: string; tags?: string[] }[] };

export function matchesAvoid(text: string, keyword: string): boolean {
  const hay = text.toLowerCase();
  return keyword.split('|').some(k => { const t = k.trim(); return t && hay.includes(t); });
}

// Latest date a matching purchase happened (YYYY-MM-DD) or null if never.
export function autoLastDate(keyword: string, expenses: MatchExpense[]): string | null {
  let last: string | null = null;
  for (const e of expenses) {
    if (e.type === 'income') continue;
    const day = (e.date ?? '').slice(0, 10);
    if (!day) continue;
    // Include each receipt item's NAME *and* TAGS — a chocolate bar named "Milka"
    // won't match the keyword by name, but its "słodycze" tag will.
    const parts = [
      e.note, (e.tags ?? []).join(' '), e.storeName,
      ...(e.receiptItems ?? []).flatMap(it => [it?.name, ...(it?.tags ?? [])]),
    ].filter(Boolean).join(' ');
    if (matchesAvoid(parts, keyword) && (!last || day > last)) last = day;
  }
  return last;
}

// ── Match against the FOOD LOG (Co zjadłem) — reset on EATING, not buying ────
// User can buy sweets once and eat them over a month, or buy them as a gift — so a
// „bez słodyczy" streak should break when a matching food is LOGGED, not purchased.
type MatchMeal = { date?: string; items?: { name?: string; productId?: string; parts?: { name?: string; productId?: string }[] }[] };

// `catByProductId` (2026-08-31, user: "nie łapie ciastek Milka jako słodyczy i nie
// resetuje... zjem i mam nadal streak") — a logged item's NAME might not contain any
// avoid-keyword fragment (e.g. a chocolate bar literally named "Milka") even though its
// PRODUCT is categorized "słodycze". `autoLastDate` above (purchase-based) already folds
// a receipt item's `tags` into the match; this brings the food-log side to parity by
// resolving each item's `productId` to its product's category.
// Exported (not just used by `autoLastEatDate` below) — `useHabits.ts`'s `computeAvoidCounts`
// (habits.ts) and `habit-year.tsx`'s calendar view need the SAME "which days match" set, not
// just the latest one; before this consolidation each had its OWN copy of this loop (with the
// Milka bug fixed in only one of the three when this comment was written — one definition
// now, can't silently drift out of sync again).
export function matchedEatDays(keyword: string, meals: MatchMeal[], catByProductId: Record<string, string | undefined> = {}): Set<string> {
  const set = new Set<string>();
  for (const m of meals) {
    const day = (m.date ?? '').slice(0, 10);
    if (!day) continue;
    const leaves = (m.items ?? []).flatMap(it => [it, ...(it?.parts ?? [])]);
    const hay = leaves
      .flatMap(it => [it?.name, it?.productId ? catByProductId[it.productId] : undefined])
      .filter(Boolean).join(' ');
    if (matchesAvoid(hay, keyword)) set.add(day);
  }
  return set;
}

export function autoLastEatDate(keyword: string, meals: MatchMeal[], catByProductId: Record<string, string | undefined> = {}): string | null {
  let last: string | null = null;
  for (const day of matchedEatDays(keyword, meals, catByProductId)) if (!last || day > last) last = day;
  return last;
}

// Days "without" for an auto counter: since the last matching EAT (default) or BUY,
// or since the counter was created if there was never one.
export function autoDaysWithout(
  c: Counter, expenses: MatchExpense[], meals: MatchMeal[] = [],
  products: { id: string; cat?: string }[] = [], now = Date.now(),
): number {
  const track = c.track ?? 'eat';
  const catByProductId: Record<string, string | undefined> = {};
  for (const p of products) catByProductId[p.id] = p.cat;
  const last = c.keyword
    ? (track === 'buy' ? autoLastDate(c.keyword, expenses) : autoLastEatDate(c.keyword, meals, catByProductId))
    : null;
  const from = last ?? (c.startDate || c.createdAt.slice(0, 10));
  return Math.max(0, Math.floor((now - atMidnight(from)) / MS_DAY));
}

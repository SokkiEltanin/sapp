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
  presetKey?: string; // auto: if chosen from AVOID_PRESETS, its `key` — resolved LIVE at read
                       // time (see resolveAvoidKeyword) so future preset edits (new keywords)
                       // reach already-created counters instead of freezing `keyword` forever
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
  // 'drożdż'/'rogal'/'kroasan'/'croissant' (2026-09-02, user: "kupię drożdzówkę i ją
  // oflaguję że to pieczywo/słodycz - jak zaznaczę że zjadłem to trzeba żeby oflagowało") —
  // te słodkie wypieki są kategoryzowane jako 'pieczywo' w FOOD_TAG_MAP (finansowy podział
  // wydatków celowo NIE dubluje ich do słodyczy), więc kategoria produktu im nie pomoże;
  // złapane tu, po nazwie, tym samym wzorcem co już istniejące 'pączek'.
  //
  // Dobitka (2026-09-04, user: "zeby zaliczamy sie do słodyczy jak coś jest słodyczem") —
  // audyt CAŁEJ bazy `foodBase.ts` ujawnił, że sporo oczywistych, klasycznych polskich
  // słodyczy NIE łapało się w ogóle: krówki, ptasie mleczko, sernik, brownie, gofry,
  // delicje/biszkopt, michałki, kremówka, eklerka, faworki, beza, kasztanka, andruty,
  // herbatniki, muffinka, budyń, wafelek, + marki (Snickers/Kinder Bueno/Prince Polo/
  // Grześki). Każdy fragment ręcznie sprawdzony (node -e skrypt) pod kątem fałszywych
  // trafień na CAŁEJ bazie — 'tortik' (nie samo 'tort', bo złapałoby 'Tortilla'), 'wafel'
  // (nie 'wafl', bo złapałoby 'Wafle ryżowe' — inny, niesłodki produkt), 'bez'a'/'bez'y'
  // (nie samo 'bez', za krótkie/niebezpieczne jako podciąg). Diakrytyki zdublowane tym
  // samym wzorcem co reszta listy (kremówk/kremowk, michałk/michalk, krówk/krowk).
  // 'nutella' (2026-09-06, user: "zaznaczam Nutella to nie pokazuje i nie resetuje mi się
  // streak, nawet nie wiem czy jest tak otagowany") — sprawdzone: `foodBase.ts` NIE ma pola
  // `cat` w ogóle (BaseFood interface go nie ma), więc kategoria produktu nigdy by nie
  // pomogła; nazwa "Nutella" sama w sobie nie zawiera żadnego dotychczasowego fragmentu
  // (nie "czekolad", to krem orzechowo-kakaowy pod marką). Dodane po nazwie, jak reszta tej
  // listy — sprawdzone skryptem, że "nutella" nie trafia przypadkiem w nic innego w bazie.
  { key: 'sweets',   label: 'słodyczy',    keyword: 'słodycz|slodycz|czekolad|baton|cukier|żelk|zelk|oreo|jeżyk|jezyk|lody|ciast|chałw|chalw|pączek|paczek|drożdż|drozdz|rogal|kroasan|croissant|toffi|chips|chrupk|paluszk|tortik|kasztank|beza|bezy|eklerk|kremówk|kremowk|fawork|rurka z kremem|herbatnik|andrut|muffin|sernik|brownie|gofr|ptasie mleczko|michałk|michalk|krówk|krowk|delicj|biszkopt|budyn|budyń|snickers|kinder|bueno|prince polo|grzesk|grześk|wafelek|nutella' },
  { key: 'fastfood', label: 'fast foodów', keyword: 'mcdonald|kfc|pizza|burger|kebab|kebap|frytk|sushi|glovo|wolt|telepizza|bobby' },
  { key: 'alcohol',  label: 'alkoholu',    keyword: 'piwo|wino|wódka|wodka|whisky|drink|alkohol|browar|cydr|tyskie|żubr|zubr|lech ' },
  { key: 'energy',   label: 'energetyków', keyword: 'monster|red bull|redbull|tiger energy|energetyk|rockstar|burn ' },
];

// 2026-09-08, user: "w streak wgle nie łapie ze zjadłem dzisiaj nutelle i nadal mam 20 dni mimo
// ze juz ile razy jadłem coś" — root cause traced (background investigation): `Counter.keyword` /
// `Habit.avoidKeyword` is a ONE-TIME COPY of an `AVOID_PRESETS[].keyword` string taken the moment
// the user tapped a preset chip. Editing `AVOID_PRESETS` afterward (e.g. appending "nutella" on
// 09-06) never reaches an already-created counter/habit — matching always reads the frozen copy,
// so any tracker made before a keyword addition just silently stops catching the new word forever.
// Fix going forward: `presetKey`/`avoidPresetKey` is stored alongside the copy, and this resolver
// prefers the LIVE preset string over the frozen one whenever a presetKey is present.
// Fix for counters/habits created BEFORE this change (no presetKey stored, so nothing above helps
// them): if every term of the stored keyword is already contained in a CURRENT preset's term set
// (AVOID_PRESETS only ever grows — terms get appended, never removed), that tracker almost
// certainly originated from that preset at an older point in time; resolve it to the live string
// too. Guarded to >=2 terms so a deliberately narrow single-word custom keyword (rare, but
// possible) doesn't get silently widened by coincidence.
export function resolveAvoidKeyword(keyword: string | undefined, presetKey?: string): string | undefined {
  if (presetKey) {
    const preset = AVOID_PRESETS.find(p => p.key === presetKey);
    if (preset) return preset.keyword;
  }
  if (!keyword) return keyword;
  const terms = keyword.split('|').map(t => t.trim()).filter(Boolean);
  if (terms.length < 2) return keyword;
  for (const p of AVOID_PRESETS) {
    const liveTerms = new Set(p.keyword.split('|').map(t => t.trim()).filter(Boolean));
    if (terms.every(t => liveTerms.has(t))) return p.keyword;
  }
  return keyword;
}

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
  const kw = resolveAvoidKeyword(c.keyword, c.presetKey);
  const last = kw
    ? (track === 'buy' ? autoLastDate(kw, expenses) : autoLastEatDate(kw, meals, catByProductId))
    : null;
  const from = last ?? (c.startDate || c.createdAt.slice(0, 10));
  return Math.max(0, Math.floor((now - atMidnight(from)) / MS_DAY));
}

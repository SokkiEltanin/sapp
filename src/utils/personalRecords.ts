import { Expense, MoodEntry } from '@/types';
// `matchedEatDays`/`AVOID_PRESETS` (2026-10-04) — `longestSweetless` below needs the SAME live
// "sweets" keyword/eat-matcher as `quests.ts`'s `sweetlessDaysFrom`, see the comment there for
// why this record was purchase-only until now.
import { matchedEatDays, AVOID_PRESETS } from '@/store/countersStore';

// All-time personal bests, for the "Rekordy życiowe" collectible card. Pure functions of
// the data the dashboard already holds — no new tracking. Each record is compared against
// the previous best so the card can flag freshly-broken ones.

const SWEET_TAGS = ['słodycze', 'przekąski'];
const SWEETS_KEYWORD = AVOID_PRESETS.find(p => p.key === 'sweets')!.keyword;

export interface RecordItem {
  key: string;
  icon: string;   // lucide name, mapped in the card
  label: string;
  value: string;
  num: number;              // surowa wartość do porównań „pobity rekord"
  lowerIsBetter?: boolean;  // waga — mniej = lepiej
  // Data padnięcia rekordu (2026-09-29, audyt czytelności) — dotąd karta pokazywała
  // WARTOŚĆ bez żadnej daty, nie dało się ocenić czy rekord jest świeży czy sprzed lat.
  // 'YYYY-MM-DD', opcjonalne tylko dla bezpieczeństwa typu — w praktyce każdy z pięciu
  // rekordów niżej zawsze go ustawia.
  date?: string;
}

type HealthDays = Record<string, { steps: number; sleepMinutes: number; weightKg: number | null }>;

const MS_DAY = 86400000;
const dayDiff = (a: string, b: string) =>
  Math.round((new Date(a + 'T00:00:00').getTime() - new Date(b + 'T00:00:00').getTime()) / MS_DAY);
const addDays = (d: string, n: number) => {
  const dt = new Date(d + 'T00:00:00');
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// The longest run of days with NO sweet/snack — a tagged PURCHASE or a matching food LOGGED
// via „Co zjadłem" (2026-10-04, same eat-vs-buy fix as `quests.ts`'s `sweetlessDaysFrom`,
// which this record used to disagree with: a day you ATE a sweet without ever buying/scanning
// it broke the pet's streak but not this one). `endDate` = last day of the best run (day
// before the sweet that broke it, or today for the still-ongoing run).
function longestSweetless(
  expenses: Expense[],
  meals: { date?: string; items?: { name?: string; productId?: string; parts?: { name?: string; productId?: string }[] }[] }[] = [],
  products: { id: string; cat?: string }[] = [],
): { days: number; endDate: string } | null {
  const days = new Set<string>();
  for (const e of expenses) {
    if (e.type === 'income') continue;
    for (const it of (e.receiptItems ?? [])) {
      if (it?.excluded || it?.kind === 'deposit') continue;
      if ((it?.tags ?? []).some(t => SWEET_TAGS.includes(t))) {
        const d = (e.date ?? '').slice(0, 10);
        if (d) days.add(d);
      }
    }
  }
  const catByProductId: Record<string, string | undefined> = {};
  for (const p of products) catByProductId[p.id] = p.cat;
  for (const d of matchedEatDays(SWEETS_KEYWORD, meals, catByProductId)) days.add(d);
  const sorted = [...days].sort();
  if (!sorted.length) return null;
  let best = 0; let bestEnd = '';
  for (let i = 1; i < sorted.length; i++) {
    const gap = dayDiff(sorted[i], sorted[i - 1]) - 1;
    if (gap > best) { best = gap; bestEnd = addDays(sorted[i], -1); }
  }
  const currentRun = dayDiff(todayStr(), sorted[sorted.length - 1]);
  if (currentRun > best) { best = currentRun; bestEnd = todayStr(); }
  return best > 0 ? { days: best, endDate: bestEnd } : null;
}

// Best 7-day rolling average mood (needs at least 4 logged days in the window). `endDate` =
// last day of the best window. Two-pointer sliding window over the sorted distinct-day list
// — O(n) instead of the previous O(n²) (re-filtering the whole `days` array for every single
// day). Correct because `days` is sorted ascending and the 6-day window only ever grows
// forward, so the left edge never needs to step backward once advanced (2026-08-25, perf
// pass — this ran on every dashboard render via `records`/`buildRecords`, and scales with the
// SQUARE of how many days of mood history exist, so a year+ of logging made it real work).
function bestMoodWeek(moodEntries: MoodEntry[]): { avg: number; endDate: string } | null {
  const byDay = new Map<string, number[]>();
  for (const e of moodEntries) {
    const d = (e.date ?? '').slice(0, 10);
    if (!d || !(e.mood > 0)) continue;
    (byDay.get(d) ?? byDay.set(d, []).get(d)!).push(e.mood);
  }
  const days = [...byDay.keys()].sort();
  if (days.length < 4) return null;
  const avgOf = (d: string) => { const a = byDay.get(d)!; return a.reduce((s, v) => s + v, 0) / a.length; };
  const avgs = days.map(avgOf);
  let best = 0; let bestEnd = '';
  let left = 0;
  let windowSum = 0;
  for (let right = 0; right < days.length; right++) {
    windowSum += avgs[right];
    while (dayDiff(days[right], days[left]) > 6) {
      windowSum -= avgs[left];
      left++;
    }
    const windowLen = right - left + 1;
    if (windowLen >= 4) {
      const avg = windowSum / windowLen;
      if (avg > best) { best = avg; bestEnd = days[right]; }
    }
  }
  return best > 0 ? { avg: best, endDate: bestEnd } : null;
}

export function buildRecords(
  healthDays: HealthDays, expenses: Expense[], moodEntries: MoodEntry[],
  meals: { date?: string; items?: { name?: string; productId?: string; parts?: { name?: string; productId?: string }[] }[] }[] = [],
  products: { id: string; cat?: string }[] = [],
): RecordItem[] {
  const out: RecordItem[] = [];

  const stepEntries = Object.entries(healthDays).filter(([, d]) => d.steps > 0);
  if (stepEntries.length) {
    const [date, d] = stepEntries.reduce((best, cur) => (cur[1].steps > best[1].steps ? cur : best));
    out.push({ key: 'steps', icon: 'footprints', label: 'Najwięcej kroków w dniu', value: d.steps.toLocaleString('pl-PL'), num: d.steps, date });
  }

  const sleepEntries = Object.entries(healthDays).filter(([, d]) => d.sleepMinutes > 0);
  if (sleepEntries.length) {
    const [date, d] = sleepEntries.reduce((best, cur) => (cur[1].sleepMinutes > best[1].sleepMinutes ? cur : best));
    const m = d.sleepMinutes;
    out.push({ key: 'sleep', icon: 'moon', label: 'Najdłuższy sen', value: `${Math.floor(m / 60)}h ${m % 60}m`, num: m, date });
  }

  const sweetless = longestSweetless(expenses, meals, products);
  if (sweetless) out.push({ key: 'sweetless', icon: 'flame', label: 'Najdłużej bez słodyczy', value: `${sweetless.days} ${sweetless.days === 1 ? 'dzień' : 'dni'}`, num: sweetless.days, date: sweetless.endDate });

  const mood = bestMoodWeek(moodEntries);
  if (mood) out.push({ key: 'mood', icon: 'smile', label: 'Najlepszy tydzień nastroju', value: `${mood.avg.toFixed(1)}/5`, num: Math.round(mood.avg * 100) / 100, date: mood.endDate });

  const weightEntries = Object.entries(healthDays).filter((e): e is [string, HealthDays[string] & { weightKg: number }] => !!e[1].weightKg && e[1].weightKg > 0);
  if (weightEntries.length >= 2) {
    const [date, d] = weightEntries.reduce((best, cur) => (cur[1].weightKg < best[1].weightKg ? cur : best));
    out.push({ key: 'weight', icon: 'scale', label: 'Najniższa waga', value: `${d.weightKg.toFixed(1)} kg`, num: Math.round(d.weightKg * 10) / 10, lowerIsBetter: true, date });
  }

  return out;
}

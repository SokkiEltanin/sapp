import { Expense, MoodEntry } from '@/types';

// All-time personal bests, for the "Rekordy życiowe" collectible card. Pure functions of
// the data the dashboard already holds — no new tracking. Each record is compared against
// the previous best so the card can flag freshly-broken ones.

const SWEET_TAGS = ['słodycze', 'przekąski'];

export interface RecordItem {
  key: string;
  icon: string;   // lucide name, mapped in the card
  label: string;
  value: string;
}

type HealthDays = Record<string, { steps: number; sleepMinutes: number; weightKg: number | null }>;

const MS_DAY = 86400000;
const dayDiff = (a: string, b: string) =>
  Math.round((new Date(a + 'T00:00:00').getTime() - new Date(b + 'T00:00:00').getTime()) / MS_DAY);
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// The longest run of days with NO sweet/snack purchase, ever — the max gap between
// consecutive sweet-purchase days (plus the current run up to today).
function longestSweetless(expenses: Expense[]): number {
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
  const sorted = [...days].sort();
  if (!sorted.length) return 0;
  let best = 0;
  for (let i = 1; i < sorted.length; i++) best = Math.max(best, dayDiff(sorted[i], sorted[i - 1]) - 1);
  best = Math.max(best, dayDiff(todayStr(), sorted[sorted.length - 1]));   // current run
  return Math.max(0, best);
}

// Best 7-day rolling average mood (needs at least 4 logged days in the window).
function bestMoodWeek(moodEntries: MoodEntry[]): number {
  const byDay = new Map<string, number[]>();
  for (const e of moodEntries) {
    const d = (e.date ?? '').slice(0, 10);
    if (!d || !(e.mood > 0)) continue;
    (byDay.get(d) ?? byDay.set(d, []).get(d)!).push(e.mood);
  }
  const days = [...byDay.keys()].sort();
  if (days.length < 4) return 0;
  const avgOf = (d: string) => { const a = byDay.get(d)!; return a.reduce((s, v) => s + v, 0) / a.length; };
  let best = 0;
  for (let i = 0; i < days.length; i++) {
    const end = days[i];
    const start = new Date(new Date(end + 'T00:00:00').getTime() - 6 * MS_DAY);
    const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    const win = days.filter(d => d >= startStr && d <= end);
    if (win.length < 4) continue;
    best = Math.max(best, win.reduce((s, d) => s + avgOf(d), 0) / win.length);
  }
  return best;
}

export function buildRecords(healthDays: HealthDays, expenses: Expense[], moodEntries: MoodEntry[]): RecordItem[] {
  const out: RecordItem[] = [];

  const steps = Object.values(healthDays).map(d => d.steps).filter(s => s > 0);
  if (steps.length) out.push({ key: 'steps', icon: 'footprints', label: 'Najwięcej kroków w dniu', value: Math.max(...steps).toLocaleString('pl-PL') });

  const sleeps = Object.values(healthDays).map(d => d.sleepMinutes).filter(s => s > 0);
  if (sleeps.length) { const m = Math.max(...sleeps); out.push({ key: 'sleep', icon: 'moon', label: 'Najdłuższy sen', value: `${Math.floor(m / 60)}h ${m % 60}m` }); }

  const sweetless = longestSweetless(expenses);
  if (sweetless > 0) out.push({ key: 'sweetless', icon: 'flame', label: 'Najdłużej bez słodyczy', value: `${sweetless} ${sweetless === 1 ? 'dzień' : 'dni'}` });

  const mood = bestMoodWeek(moodEntries);
  if (mood > 0) out.push({ key: 'mood', icon: 'smile', label: 'Najlepszy tydzień nastroju', value: `${mood.toFixed(1)}/5` });

  const weights = Object.values(healthDays).map(d => d.weightKg).filter((w): w is number => !!w && w > 0);
  if (weights.length >= 2) out.push({ key: 'weight', icon: 'scale', label: 'Najniższa waga', value: `${Math.min(...weights).toFixed(1)} kg` });

  return out;
}

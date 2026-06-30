import AsyncStorage from '@react-native-async-storage/async-storage';
import { Expense, CalendarEvent } from '@/types';
import { isSelfTransfer } from './statWidgets';
import { isWorkEvent, shiftHours } from './workEvents';

// ── Context the achievements are evaluated against ──────────────────────────
// Assembled on the dashboard / gablota screen from the existing stores.
export interface AchCtx {
  habitBestStreak: number;   // longest current habit streak (days)
  allHabitsToday: boolean;   // every habit checked today
  noJunkStreak: number;      // consecutive days with no sweets/junk-tagged spend
  savingsTotal: number;      // cumulative self-transfers (zł put aside)
  receiptsCount: number;     // number of expense entries logged
  moodDays: number;          // distinct days with a mood entry
  workHoursTotal: number;    // all-time work hours
  paydayLogged: boolean;     // any salary income logged
  bestStepsDay: number;      // best single-day step count
  billTracked: boolean;      // at least one tracked recurring bill
}

export const EMPTY_ACH_CTX: AchCtx = {
  habitBestStreak: 0, allHabitsToday: false, noJunkStreak: 0, savingsTotal: 0,
  receiptsCount: 0, moodDays: 0, workHoursTotal: 0, paydayLogged: false,
  bestStepsDay: 0, billTracked: false,
};

// Junk/sweets keywords for the "no-junk streak" — shared so the dashboard and the
// gablota classify identically.
const JUNK = ['słodycz', 'slodycz', 'słodki', 'slodki', 'cukier', 'czekolad', 'baton', 'chips', 'fast', 'frytk', 'mcdonald', 'kfc', 'lody', 'ciast', 'żelk', 'zelk', 'oreo', 'jeżyk', 'jezyk', 'toffi', 'chałw', 'chalw', 'paluszk', 'chrupk'];
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Build the full context from raw data. The cheap habit/steps/bill bits are passed
// in (they come from hooks); the expense/work-derived bits are computed here so the
// dashboard and the gablota stay perfectly in sync.
export function buildAchCtx(args: {
  expenses: Expense[];
  moodEntries: { date?: string }[];
  workEvents: CalendarEvent[];
  workSettings: { workColor?: string; workPrefix?: string };
  habitBestStreak: number;
  allHabitsToday: boolean;
  bestStepsDay: number;
  billTracked: boolean;
}): AchCtx {
  const { expenses, moodEntries, workEvents, workSettings } = args;
  const wcol = workSettings.workColor;
  const wp = workSettings.workPrefix?.trim().toLowerCase();
  const workHoursTotal = workEvents
    .filter(e => isWorkEvent(e, { workColor: wcol, workPrefix: wp }))
    .reduce((sum, e) => sum + shiftHours(e), 0);

  let savingsTotal = 0, receiptsCount = 0;
  const junkDays = new Set<string>();
  for (const e of expenses) {
    const isInc = e.type === 'income';
    if (!isInc) receiptsCount++;
    if (!isInc && isSelfTransfer(e)) savingsTotal += e.amount;
    if (!isInc) {
      const hay = `${e.note ?? ''} ${(e.tags ?? []).join(' ')}`.toLowerCase();
      if (JUNK.some(k => hay.includes(k))) junkDays.add((e.date ?? '').slice(0, 10));
    }
  }
  let noJunkStreak = 0;
  const base = new Date();
  for (let i = 0; i < 400; i++) {
    const d = new Date(base); d.setDate(d.getDate() - i);
    if (junkDays.has(dayKey(d))) break;
    noJunkStreak++;
  }
  const moodDays = new Set(moodEntries.map(m => (m.date ?? '').slice(0, 10)).filter(Boolean)).size;
  const paydayLogged = expenses.some(e =>
    e.type === 'income' && (e.category === 'salary' || (!!wp && `${e.note ?? ''} ${(e.tags ?? []).join(' ')}`.toLowerCase().includes(wp))));

  return {
    habitBestStreak: args.habitBestStreak, allHabitsToday: args.allHabitsToday,
    noJunkStreak, savingsTotal, receiptsCount, moodDays, workHoursTotal,
    paydayLogged, bestStepsDay: args.bestStepsDay, billTracked: args.billTracked,
  };
}

export type AchGroup = 'Nawyki' | 'Jedzenie' | 'Oszczędzanie' | 'Praca' | 'Konsekwencja' | 'Zdrowie';

export interface Achievement {
  id: string;
  title: string;
  desc: string;            // how you earn it
  group: AchGroup;
  tier: 1 | 2 | 3;         // bronze / silver / gold ring
  target: number;
  unit?: string;           // for progress text ("dni", "zł", "h", "×")
  value: (c: AchCtx) => number;
}

// Tier ring colours (used by the gablota + as the lucide-placeholder accent).
export const TIER_COLOR: Record<1 | 2 | 3, string> = {
  1: '#CD7F32', // bronze
  2: '#C4CAD4', // silver
  3: '#FFC83D', // gold
};

export const ACHIEVEMENTS: Achievement[] = [
  // ── Nawyki ──
  { id: 'habit-streak-3',  title: 'Rozpęd',          desc: '3 dni nawyku z rzędu',          group: 'Nawyki', tier: 1, target: 3,  unit: 'dni', value: c => c.habitBestStreak },
  { id: 'habit-streak-7',  title: 'Tydzień mocy',    desc: '7 dni nawyku z rzędu',          group: 'Nawyki', tier: 2, target: 7,  unit: 'dni', value: c => c.habitBestStreak },
  { id: 'habit-streak-30', title: 'Żelazna wola',    desc: '30 dni nawyku z rzędu',         group: 'Nawyki', tier: 3, target: 30, unit: 'dni', value: c => c.habitBestStreak },
  { id: 'habit-all-day',   title: 'Czysty dzień',    desc: 'Wszystkie dzisiejsze nawyki odhaczone', group: 'Nawyki', tier: 1, target: 1, value: c => c.allHabitsToday ? 1 : 0 },

  // ── Jedzenie ──
  { id: 'no-junk-3',  title: 'Bez cukru ×3',  desc: '3 dni z rzędu bez słodyczy',  group: 'Jedzenie', tier: 1, target: 3,  unit: 'dni', value: c => c.noJunkStreak },
  { id: 'no-junk-7',  title: 'Tydzień fit',   desc: '7 dni z rzędu bez słodyczy',  group: 'Jedzenie', tier: 2, target: 7,  unit: 'dni', value: c => c.noJunkStreak },
  { id: 'no-junk-14', title: 'Dwa tygodnie',  desc: '14 dni z rzędu bez słodyczy', group: 'Jedzenie', tier: 3, target: 14, unit: 'dni', value: c => c.noJunkStreak },

  // ── Oszczędzanie ──
  { id: 'saver-first', title: 'Pierwszy grosz', desc: 'Pierwszy raz coś odłożone',     group: 'Oszczędzanie', tier: 1, target: 1,     unit: 'zł', value: c => c.savingsTotal },
  { id: 'saver-1000',  title: 'Tysiąc',         desc: 'Łącznie 1 000 zł odłożone',     group: 'Oszczędzanie', tier: 1, target: 1000,  unit: 'zł', value: c => c.savingsTotal },
  { id: 'saver-5000',  title: 'Poduszka',       desc: 'Łącznie 5 000 zł odłożone',     group: 'Oszczędzanie', tier: 2, target: 5000,  unit: 'zł', value: c => c.savingsTotal },
  { id: 'saver-10000', title: 'Forteca',        desc: 'Łącznie 10 000 zł odłożone',    group: 'Oszczędzanie', tier: 3, target: 10000, unit: 'zł', value: c => c.savingsTotal },

  // ── Praca ──
  { id: 'work-payday-first', title: 'Pierwsza wypłata', desc: 'Zalogowana pierwsza wypłata', group: 'Praca', tier: 1, target: 1,   value: c => c.paydayLogged ? 1 : 0 },
  { id: 'work-50h',  title: 'Robotnik',  desc: 'Łącznie 50 h pracy',  group: 'Praca', tier: 1, target: 50,  unit: 'h', value: c => c.workHoursTotal },
  { id: 'work-100h', title: 'Maszyna',   desc: 'Łącznie 100 h pracy', group: 'Praca', tier: 2, target: 100, unit: 'h', value: c => c.workHoursTotal },

  // ── Konsekwencja ──
  { id: 'receipts-25',  title: 'Skaner',     desc: '25 zalogowanych wydatków',  group: 'Konsekwencja', tier: 1, target: 25,  unit: '×', value: c => c.receiptsCount },
  { id: 'receipts-100', title: 'Księgowy',   desc: '100 zalogowanych wydatków', group: 'Konsekwencja', tier: 2, target: 100, unit: '×', value: c => c.receiptsCount },
  { id: 'mood-7',  title: 'Świadomy',  desc: '7 dni z wpisem nastroju',   group: 'Konsekwencja', tier: 1, target: 7,  unit: 'dni', value: c => c.moodDays },
  { id: 'mood-30', title: 'Introspekcja', desc: '30 dni z wpisem nastroju', group: 'Konsekwencja', tier: 3, target: 30, unit: 'dni', value: c => c.moodDays },

  // ── Zdrowie / Finanse ──
  { id: 'steps-10k',   title: 'Maraton dnia', desc: '10 000 kroków w jeden dzień', group: 'Zdrowie', tier: 1, target: 10000, unit: 'kroków', value: c => c.bestStepsDay },
  { id: 'bills-first', title: 'Ogarnięty',    desc: 'Pierwszy stały rachunek śledzony', group: 'Konsekwencja', tier: 1, target: 1, value: c => c.billTracked ? 1 : 0 },
];

export interface AchState {
  a: Achievement;
  value: number;
  unlocked: boolean;
  progress: number; // 0..1
}

export function evaluateAchievements(ctx: AchCtx): AchState[] {
  return ACHIEVEMENTS.map(a => {
    const value = a.value(ctx);
    return { a, value, unlocked: value >= a.target, progress: Math.min(1, a.target > 0 ? value / a.target : 0) };
  });
}

// ── Earned timestamps (so we can show the date + detect NEW unlocks) ────────
const K_EARNED = 'achievements_earned';
export type EarnedMap = Record<string, string>; // id -> ISO date first earned

export async function getEarned(): Promise<EarnedMap> {
  try { const raw = await AsyncStorage.getItem(K_EARNED); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

// Persist any newly-unlocked achievements; returns the ids that were NEW this run.
export async function syncEarned(states: AchState[]): Promise<string[]> {
  const earned = await getEarned();
  const now = new Date().toISOString();
  const fresh: string[] = [];
  for (const s of states) {
    if (s.unlocked && !earned[s.a.id]) { earned[s.a.id] = now; fresh.push(s.a.id); }
  }
  if (fresh.length) { try { await AsyncStorage.setItem(K_EARNED, JSON.stringify(earned)); } catch {} }
  return fresh;
}

export function fmtProgress(s: AchState): string {
  if (s.a.target === 1 && !s.a.unit) return s.unlocked ? 'Zdobyte' : 'Niezdobyte';
  const v = Math.min(s.value, s.a.target);
  const fmt = (n: number) => s.a.unit === 'zł' || s.a.unit === 'kroków' ? Math.round(n).toLocaleString('pl-PL') : String(Math.round(n));
  return `${fmt(v)} / ${fmt(s.a.target)}${s.a.unit ? ' ' + s.a.unit : ''}`;
}

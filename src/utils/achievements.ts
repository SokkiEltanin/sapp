import AsyncStorage from '@react-native-async-storage/async-storage';
import { Expense, CalendarEvent } from '@/types';
import { isSelfTransfer } from './statWidgets';
import { isWorkEvent, shiftHours } from './workEvents';

// ── Context the achievements are evaluated against ──────────────────────────
export interface AchCtx {
  habitBestStreak: number;
  noJunkStreak: number;
  savingsTotal: number;
  receiptsCount: number;
  moodDays: number;
  workHoursTotal: number;
  paydayLogged: boolean;
  bestStepsDay: number;
  billTracked: boolean;
  // richer signals (added for the custom-icon set)
  logStreak: number;         // consecutive days (→ today) with any expense/mood logged
  activeDays: number;        // distinct days with any activity
  goodMoodStreak: number;    // consecutive days (→ today) with mood ≥ 4
  moodLevelsSeen: number;    // distinct mood levels (1..5) ever logged
  balancedMonth: boolean;    // any month where income ≥ expenses
  hasBudget: boolean;        // a budget is set
  tasksDone: number;         // all-time completed tasks
  monthUnderBudget: boolean; // a completed month closed under the total budget
  // anti-achievement signals
  junkStreak: number;        // consecutive days (→ today) WITH a junk purchase
  badSleepStreak: number;    // consecutive nights (→ today) with sleep < 5 h
  overBudgetPct: number;     // this-month spend ÷ total budget (1 = exactly on budget)
  junkPurchasesMonth: number;// sweets purchases this month
  fastFoodCount: number;     // all-time fast-food purchases
  maxDaySpend: number;       // biggest single-day spend (zł)
}

export type AchGroup = 'Nawyki' | 'Jedzenie' | 'Oszczędzanie' | 'Praca' | 'Nastrój' | 'Zdrowie' | 'Konsekwencja' | 'Grzeszki';

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  group: AchGroup;
  tier: 1 | 2 | 3;
  target: number;
  unit?: string;
  kind?: 'good' | 'bad';   // bad = anti-achievement (red, "earned" by slipping up)
  value: (c: AchCtx) => number;
}

export const TIER_COLOR: Record<1 | 2 | 3, string> = { 1: '#CD7F32', 2: '#C4CAD4', 3: '#FFC83D' };
export const BAD_COLOR = '#E5484D';

export const ACHIEVEMENTS: Achievement[] = [
  // ── Start / Konsekwencja (custom icons) ──
  { id: 'first-key', title: 'Pierwszy klucz', desc: 'Pierwszy zalogowany wydatek', group: 'Konsekwencja', tier: 1, target: 1, value: c => c.receiptsCount >= 1 ? 1 : 0 },
  { id: 'scanner',   title: 'Skaner',         desc: '50 zalogowanych wydatków',     group: 'Konsekwencja', tier: 2, target: 50, unit: '×', value: c => c.receiptsCount },
  { id: 'groceries-100', title: 'Zakupowicz', desc: '100 zalogowanych wydatków',    group: 'Konsekwencja', tier: 3, target: 100, unit: '×', value: c => c.receiptsCount },
  { id: 'on-track',  title: 'Na kursie',      desc: '7 dni z rzędu coś zalogowane', group: 'Konsekwencja', tier: 2, target: 7, unit: 'dni', value: c => c.logStreak },
  { id: 'loyal',     title: 'Wierny',         desc: '30 aktywnych dni w aplikacji', group: 'Konsekwencja', tier: 3, target: 30, unit: 'dni', value: c => c.activeDays },
  { id: 'goal-set',  title: 'Wyznaczony cel', desc: 'Ustawiony pierwszy budżet',    group: 'Konsekwencja', tier: 1, target: 1, value: c => c.hasBudget ? 1 : 0 },

  // ── Nastrój (custom icons) ──
  { id: 'sunny-week', title: 'Słoneczny tydzień', desc: '7 dni z rzędu nastrój ≥ 4', group: 'Nastrój', tier: 2, target: 7, unit: 'dni', value: c => c.goodMoodStreak },
  { id: 'self-care',  title: 'Dbam o siebie',     desc: '30 dni z wpisem nastroju',  group: 'Nastrój', tier: 2, target: 30, unit: 'dni', value: c => c.moodDays },
  { id: 'full-range', title: 'Pełnia emocji',     desc: 'Zalogowane wszystkie nastroje 1–5', group: 'Nastrój', tier: 1, target: 5, unit: '/5', value: c => c.moodLevelsSeen },
  { id: 'chronicler', title: 'Kronikarz',         desc: '60 dni z wpisem nastroju',  group: 'Nastrój', tier: 3, target: 60, unit: 'dni', value: c => c.moodDays },

  // ── Zdrowie / Praca (custom icons) ──
  { id: 'marathon', title: 'Maraton dnia', desc: '10 000 kroków w jeden dzień', group: 'Zdrowie', tier: 1, target: 10000, unit: 'kroków', value: c => c.bestStepsDay },
  { id: 'doer',     title: 'Wykonawca',    desc: '25 ukończonych zadań',        group: 'Praca',   tier: 2, target: 25, unit: '×', value: c => c.tasksDone },

  // ── Oszczędzanie (justice-scale custom + lucide) ──
  { id: 'balanced',   title: 'W równowadze', desc: 'Miesiąc na plusie (przychód ≥ wydatki)', group: 'Oszczędzanie', tier: 2, target: 1, value: c => c.balancedMonth ? 1 : 0 },
  { id: 'under-limit', title: 'Pod limitem',  desc: 'Miesiąc zamknięty pod budżetem', group: 'Oszczędzanie', tier: 2, target: 1, value: c => c.monthUnderBudget ? 1 : 0 },
  { id: 'saver-1000', title: 'Tysiąc',       desc: 'Łącznie 1 000 zł odłożone',  group: 'Oszczędzanie', tier: 1, target: 1000,  unit: 'zł', value: c => c.savingsTotal },
  { id: 'saver-5000', title: 'Poduszka',     desc: 'Łącznie 5 000 zł odłożone',  group: 'Oszczędzanie', tier: 2, target: 5000,  unit: 'zł', value: c => c.savingsTotal },
  { id: 'saver-10000',title: 'Forteca',      desc: 'Łącznie 10 000 zł odłożone', group: 'Oszczędzanie', tier: 3, target: 10000, unit: 'zł', value: c => c.savingsTotal },

  // ── Loyalty / brand (custom) ──
  { id: 'loyal-heart', title: 'Z sercem', desc: '60 aktywnych dni — apka to nawyk', group: 'Konsekwencja', tier: 3, target: 60, unit: 'dni', value: c => c.activeDays },

  // ── Lucide-only (no custom icon yet) ──
  { id: 'habit-streak-7',  title: 'Tydzień mocy', desc: '7 dni nawyku z rzędu',  group: 'Nawyki', tier: 2, target: 7,  unit: 'dni', value: c => c.habitBestStreak },
  { id: 'habit-streak-30', title: 'Żelazna wola', desc: '30 dni nawyku z rzędu', group: 'Nawyki', tier: 3, target: 30, unit: 'dni', value: c => c.habitBestStreak },
  { id: 'no-junk-7',  title: 'Tydzień fit', desc: '7 dni z rzędu bez słodyczy', group: 'Jedzenie', tier: 2, target: 7, unit: 'dni', value: c => c.noJunkStreak },
  { id: 'work-100h',  title: 'Maszyna',     desc: 'Łącznie 100 h pracy',        group: 'Praca', tier: 2, target: 100, unit: 'h', value: c => c.workHoursTotal },
  { id: 'payday-first', title: 'Pierwsza wypłata', desc: 'Zalogowana pierwsza wypłata', group: 'Praca', tier: 1, target: 1, value: c => c.paydayLogged ? 1 : 0 },

  // ── Grzeszki (anti-achievements, custom icons) ──
  { id: 'crime-scene', title: 'Miejsce zbrodni',   desc: 'Budżet przekroczony o ponad 50%', group: 'Grzeszki', tier: 1, target: 150, unit: '%', kind: 'bad', value: c => Math.round(c.overBudgetPct * 100) },
  { id: 'undead',      title: 'Żywy trup',         desc: '3 noce z rzędu sen poniżej 5 h',  group: 'Grzeszki', tier: 1, target: 3, unit: 'noce', kind: 'bad', value: c => c.badSleepStreak },
  { id: 'bottomless',  title: 'Bezdenny żołądek',  desc: '5 dni z rzędu ze słodyczami',     group: 'Grzeszki', tier: 1, target: 5, unit: 'dni', kind: 'bad', value: c => c.junkStreak },
  { id: 'sweet-tooth', title: 'Słodki ząb',        desc: '15 zakupów słodyczy w miesiącu',  group: 'Grzeszki', tier: 1, target: 15, unit: '×', kind: 'bad', value: c => c.junkPurchasesMonth },
  { id: 'fast-food',   title: 'Fast food',         desc: '5 razy fast food / pizza',        group: 'Grzeszki', tier: 1, target: 5, unit: '×', kind: 'bad', value: c => c.fastFoodCount },
  { id: 'red-light',   title: 'Czerwone światło',  desc: 'Przekroczony budżet miesiąca',    group: 'Grzeszki', tier: 1, target: 100, unit: '%', kind: 'bad', value: c => Math.round(c.overBudgetPct * 100) },
  { id: 'panic',       title: 'Panikarz',          desc: 'Zakupy za 300+ zł w jeden dzień', group: 'Grzeszki', tier: 1, target: 300, unit: 'zł', kind: 'bad', value: c => c.maxDaySpend },
];

// ── Build context (single source of truth — dashboard + gablota call this) ───
const JUNK = ['słodycz', 'slodycz', 'słodki', 'slodki', 'cukier', 'czekolad', 'baton', 'chips', 'fast', 'frytk', 'mcdonald', 'kfc', 'lody', 'ciast', 'żelk', 'zelk', 'oreo', 'jeżyk', 'jezyk', 'toffi', 'chałw', 'chalw', 'paluszk', 'chrupk'];
const FASTFOOD = ['mcdonald', 'kfc', 'pizza', 'burger', 'kebab', 'kebap', 'sushi', 'dominos', 'telepizza', 'bobby', 'pyszne', 'glovo', 'wolt', 'fast food', 'frytk'];
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// walk back from today counting consecutive days for which pred(dayKey) holds
function streakBack(pred: (k: string) => boolean): number {
  let n = 0; const base = new Date();
  for (let i = 0; i < 400; i++) { const d = new Date(base); d.setDate(d.getDate() - i); if (!pred(dayKey(d))) break; n++; }
  return n;
}

export function buildAchCtx(args: {
  expenses: Expense[];
  moodEntries: { date?: string; mood?: number }[];
  workEvents: CalendarEvent[];
  workSettings: { workColor?: string; workPrefix?: string };
  habitBestStreak: number;
  healthDays: Record<string, { steps?: number; sleepMinutes?: number }>;
  tasksDone: number;
  budgetTotal: number;
  billTracked: boolean;
}): AchCtx {
  const { expenses, moodEntries, workEvents, workSettings, healthDays } = args;
  const wcol = workSettings.workColor;
  const wp = workSettings.workPrefix?.trim().toLowerCase();
  const workHoursTotal = workEvents
    .filter(e => isWorkEvent(e, { workColor: wcol, workPrefix: wp }))
    .reduce((sum, e) => sum + shiftHours(e), 0);

  let savingsTotal = 0, receiptsCount = 0, thisMonthExp = 0, junkPurchasesMonth = 0, fastFoodCount = 0;
  const thisMonth = dayKey(new Date()).slice(0, 7);
  const junkDays = new Set<string>();
  const loggedDays = new Set<string>();
  const daySpend: Record<string, number> = {};
  const monthAgg: Record<string, { inc: number; exp: number }> = {};
  for (const e of expenses) {
    const day = (e.date ?? '').slice(0, 10);
    if (day) loggedDays.add(day);
    const isInc = e.type === 'income';
    const m = (e.date ?? '').slice(0, 7);
    if (m) (monthAgg[m] ??= { inc: 0, exp: 0 });
    if (isInc) { if (m && !isSelfTransfer(e)) monthAgg[m].inc += e.amount; continue; }
    receiptsCount++;
    if (isSelfTransfer(e)) { savingsTotal += e.amount; continue; }
    if (m) monthAgg[m].exp += e.amount;
    if (m === thisMonth) thisMonthExp += e.amount;
    if (day) daySpend[day] = (daySpend[day] ?? 0) + e.amount;
    const hay = `${e.note ?? ''} ${(e.tags ?? []).join(' ')}`.toLowerCase();
    if (JUNK.some(k => hay.includes(k))) { junkDays.add(day); if (m === thisMonth) junkPurchasesMonth++; }
    if (FASTFOOD.some(k => hay.includes(k))) fastFoodCount++;
  }
  const maxDaySpend = Object.values(daySpend).reduce((mx, v) => Math.max(mx, v), 0);
  const monthUnderBudget = args.budgetTotal > 0 && Object.entries(monthAgg).some(([m, v]) => m !== thisMonth && v.exp > 0 && v.exp <= args.budgetTotal);

  // mood
  const moodByDay: Record<string, number> = {};
  const moodLevels = new Set<number>();
  for (const m of moodEntries) {
    const day = (m.date ?? '').slice(0, 10);
    if (day) { loggedDays.add(day); moodByDay[day] = Math.max(moodByDay[day] ?? 0, m.mood ?? 0); }
    if (m.mood) moodLevels.add(m.mood);
  }
  const moodDays = Object.keys(moodByDay).length;

  // sleep (best step + bad-sleep streak)
  let bestStepsDay = 0;
  for (const v of Object.values(healthDays)) bestStepsDay = Math.max(bestStepsDay, v.steps || 0);

  const balancedMonth = Object.values(monthAgg).some(m => m.exp > 0 && m.inc >= m.exp);

  return {
    habitBestStreak: args.habitBestStreak,
    noJunkStreak: streakBack(k => !junkDays.has(k)),
    savingsTotal, receiptsCount, moodDays, workHoursTotal,
    paydayLogged: expenses.some(e => e.type === 'income' && (e.category === 'salary' || (!!wp && `${e.note ?? ''} ${(e.tags ?? []).join(' ')}`.toLowerCase().includes(wp)))),
    bestStepsDay, billTracked: args.billTracked,
    logStreak: streakBack(k => loggedDays.has(k)),
    activeDays: loggedDays.size,
    goodMoodStreak: streakBack(k => (moodByDay[k] ?? 0) >= 4),
    moodLevelsSeen: moodLevels.size,
    balancedMonth, hasBudget: args.budgetTotal > 0, tasksDone: args.tasksDone,
    monthUnderBudget,
    junkStreak: streakBack(k => junkDays.has(k)),
    badSleepStreak: streakBack(k => { const s = healthDays[k]?.sleepMinutes; return !!s && s > 0 && s < 300; }),
    overBudgetPct: args.budgetTotal > 0 ? thisMonthExp / args.budgetTotal : 0,
    junkPurchasesMonth, fastFoodCount, maxDaySpend,
  };
}

export interface AchState { a: Achievement; value: number; unlocked: boolean; progress: number; }

export function evaluateAchievements(ctx: AchCtx): AchState[] {
  return ACHIEVEMENTS.map(a => {
    const value = a.value(ctx);
    return { a, value, unlocked: value >= a.target, progress: Math.min(1, a.target > 0 ? value / a.target : 0) };
  });
}

// ── Earned timestamps ───────────────────────────────────────────────────────
const K_EARNED = 'achievements_earned';
export type EarnedMap = Record<string, string>;

export async function getEarned(): Promise<EarnedMap> {
  try { const raw = await AsyncStorage.getItem(K_EARNED); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

export async function syncEarned(states: AchState[]): Promise<string[]> {
  const earned = await getEarned();
  const now = new Date().toISOString();
  const fresh: string[] = [];
  for (const s of states) if (s.unlocked && !earned[s.a.id]) { earned[s.a.id] = now; fresh.push(s.a.id); }
  if (fresh.length) { try { await AsyncStorage.setItem(K_EARNED, JSON.stringify(earned)); } catch {} }
  return fresh;
}

export function fmtProgress(s: AchState): string {
  if (s.a.target === 1 && !s.a.unit) return s.unlocked ? 'Zdobyte' : 'Niezdobyte';
  const v = Math.min(s.value, s.a.target);
  const fmt = (n: number) => (s.a.unit === 'zł' || s.a.unit === 'kroków') ? Math.round(n).toLocaleString('pl-PL') : String(Math.round(n));
  return `${fmt(v)} / ${fmt(s.a.target)}${s.a.unit ? ' ' + s.a.unit : ''}`;
}

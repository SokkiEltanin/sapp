import AsyncStorage from '@react-native-async-storage/async-storage';
import { MoodEntry, Task, CalendarEvent } from '@/types';
import { Expense } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonthlyReport {
  id: string;            // YYYY-MM
  month: string;         // YYYY-MM
  generatedAt: string;
  mood: {
    avgMood: number | null;
    avgEnergy: number | null;
    loggedDays: number;
    bestDay: string | null;   // YYYY-MM-DD
    worstDay: string | null;
  };
  tasks: {
    completed: number;
    total: number;
    rate: number;
  };
  finances: {
    totalSpend: number;
    totalIncome: number;
    balance: number;
    foodSpend: number;
    sweetsSpend: number;
    topCategory: string | null;
  };
  events: number;
  highlight: string;
}

export interface YearlyReport {
  id: string;            // YYYY
  year: number;
  generatedAt: string;
  mood: {
    avgMood: number | null;
    bestMonth: string | null;  // YYYY-MM
    worstMonth: string | null;
    loggedDays: number;
  };
  tasks: {
    completed: number;
    total: number;
    rate: number;
  };
  finances: {
    totalSpend: number;
    totalIncome: number;
    balance: number;
    avgMonthlySpend: number;
    topCategory: string | null;
  };
  events: number;
  highlight: string;
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const MONTHLY_KEY     = 'monthly_reports_v1';
const YEARLY_KEY      = 'yearly_reports_v1';
const MONTHLY_GEN_KEY = 'monthly_reports_last_gen';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0'); }

export function getMonthBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { start: `${month}-01`, end: `${month}-${pad(lastDay)}` };
}

function moodAvg(entries: MoodEntry[]) {
  if (!entries.length) return null;
  return {
    mood:   entries.reduce((a, b) => a + b.mood, 0)   / entries.length,
    energy: entries.reduce((a, b) => a + b.energy, 0) / entries.length,
  };
}

function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

// ─── Monthly Reports ──────────────────────────────────────────────────────────

export async function loadMonthlyReports(): Promise<MonthlyReport[]> {
  try {
    const raw = await AsyncStorage.getItem(MONTHLY_KEY);
    const reports: MonthlyReport[] = raw ? JSON.parse(raw) : [];
    return reports.sort((a, b) => b.month.localeCompare(a.month));
  } catch { return []; }
}

export async function saveMonthlyReport(report: MonthlyReport): Promise<void> {
  const reports = await loadMonthlyReports();
  const idx = reports.findIndex(r => r.month === report.month);
  if (idx >= 0) reports[idx] = report;
  else reports.unshift(report);
  await AsyncStorage.setItem(MONTHLY_KEY, JSON.stringify(reports.slice(0, 24)));
}

export function generateMonthlyReport(input: {
  month: string; // YYYY-MM
  moodEntries: MoodEntry[];
  tasks: Task[];
  expenses: Expense[];
  events: CalendarEvent[];
}): MonthlyReport {
  const { month, moodEntries, tasks, expenses, events } = input;
  const { start, end } = getMonthBounds(month);

  // ── Mood
  const moodInMonth = moodEntries.filter(e => e.date >= start && e.date <= end);
  const avgM = moodAvg(moodInMonth);
  const loggedDays = new Set(moodInMonth.map(e => e.date)).size;

  // Best/worst day by avg mood
  const dayMap: Record<string, number[]> = {};
  for (const e of moodInMonth) {
    if (!dayMap[e.date]) dayMap[e.date] = [];
    dayMap[e.date].push(e.mood);
  }
  const dayAvgs = Object.entries(dayMap).map(([date, vals]) => ({
    date,
    avg: vals.reduce((a, b) => a + b, 0) / vals.length,
  }));
  const bestDay  = dayAvgs.length ? dayAvgs.reduce((a, b) => b.avg > a.avg ? b : a).date : null;
  const worstDay = dayAvgs.length ? dayAvgs.reduce((a, b) => b.avg < a.avg ? b : a).date : null;

  // ── Tasks
  const monthTasks = tasks.filter(t => {
    const d = t.scheduledDate ?? t.deadline?.split('T')[0];
    return d && d >= start && d <= end;
  });
  const done     = monthTasks.filter(t => t.status === 'done').length;
  const taskRate = monthTasks.length > 0 ? done / monthTasks.length : 0;

  // ── Finances
  const exp = expenses.filter(e => (!e.type || e.type === 'expense') && e.date.slice(0, 7) === month);
  const inc = expenses.filter(e => e.type === 'income' && e.date.slice(0, 7) === month);
  const totalSpend  = exp.reduce((s, e) => s + e.amount, 0);
  const totalIncome = inc.reduce((s, e) => s + e.amount, 0);
  const foodSpend   = exp.filter(e => e.category === 'groceries').reduce((s, e) => s + e.amount, 0);
  let sweetsSpend = 0;
  for (const e of exp) {
    for (const it of (e.receiptItems ?? [])) {
      if (it.tags.includes('słodycze')) sweetsSpend += it.price;
    }
  }
  const byCat: Record<string, number> = {};
  for (const e of exp) byCat[e.category] = (byCat[e.category] ?? 0) + e.amount;
  const topCategory = Object.entries(byCat).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

  // ── Events
  const evCount = events.filter(e => e.date.slice(0, 7) === month).length;

  // ── Highlight
  const bal = totalIncome - totalSpend;
  let highlight: string;
  if (avgM?.mood && avgM.mood >= 4) {
    highlight = `Dobry miesiąc — śr. nastrój ${avgM.mood.toFixed(1)}/5 przez ${loggedDays} dni.`;
  } else if (done > 0 && taskRate >= 0.8) {
    highlight = `Produktywny miesiąc — ${done}/${monthTasks.length} zadań (${Math.round(taskRate * 100)}%). Brawo!`;
  } else if (bal > 0) {
    highlight = `Finanse na plusie: +${bal.toFixed(0)} zł. Dochód ${totalIncome.toFixed(0)} zł, wydatki ${totalSpend.toFixed(0)} zł.`;
  } else if (sweetsSpend > foodSpend * 0.3 && foodSpend > 0) {
    highlight = `Słodycze to ${Math.round(sweetsSpend / foodSpend * 100)}% wydatków na jedzenie — ${sweetsSpend.toFixed(0)} zł.`;
  } else if (loggedDays === 0) {
    highlight = `Brak wpisów nastroju w ${month}. Warto śledzić regularnie.`;
  } else {
    highlight = `${month}: ${loggedDays} dni z wpisem nastroju, ${totalSpend.toFixed(0)} zł wydatków.`;
  }

  return {
    id: month, month, generatedAt: new Date().toISOString(),
    mood: { avgMood: avgM?.mood ?? null, avgEnergy: avgM?.energy ?? null, loggedDays, bestDay, worstDay },
    tasks: { completed: done, total: monthTasks.length, rate: taskRate },
    finances: { totalSpend, totalIncome, balance: bal, foodSpend, sweetsSpend, topCategory },
    events: evCount,
    highlight,
  };
}

export async function shouldAutoGenerateMonthly(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(MONTHLY_GEN_KEY);
    const lastGen: string | null = raw ? JSON.parse(raw) : null;
    const today = new Date();
    if (today.getDate() > 3) return false; // only generate in first 3 days of month
    const prev = prevMonth(`${today.getFullYear()}-${pad(today.getMonth() + 1)}`);
    return lastGen !== prev;
  } catch { return false; }
}

export async function markMonthlyGenerated(month: string): Promise<void> {
  await AsyncStorage.setItem(MONTHLY_GEN_KEY, JSON.stringify(month));
}

export function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function getPrevMonth(): string {
  return prevMonth(getCurrentMonth());
}

// ─── Yearly Reports ───────────────────────────────────────────────────────────

export async function loadYearlyReports(): Promise<YearlyReport[]> {
  try {
    const raw = await AsyncStorage.getItem(YEARLY_KEY);
    const reports: YearlyReport[] = raw ? JSON.parse(raw) : [];
    return reports.sort((a, b) => b.year - a.year);
  } catch { return []; }
}

export async function saveYearlyReport(report: YearlyReport): Promise<void> {
  const reports = await loadYearlyReports();
  const idx = reports.findIndex(r => r.year === report.year);
  if (idx >= 0) reports[idx] = report;
  else reports.unshift(report);
  await AsyncStorage.setItem(YEARLY_KEY, JSON.stringify(reports.slice(0, 5)));
}

export function generateYearlyReport(input: {
  year: number;
  moodEntries: MoodEntry[];
  tasks: Task[];
  expenses: Expense[];
  events: CalendarEvent[];
}): YearlyReport {
  const { year, moodEntries, tasks, expenses, events } = input;
  const start = `${year}-01-01`;
  const end   = `${year}-12-31`;

  // ── Mood
  const yearMood = moodEntries.filter(e => e.date >= start && e.date <= end);
  const avgM = moodAvg(yearMood);
  const loggedDays = new Set(yearMood.map(e => e.date)).size;

  // Best/worst month by avg mood
  const monthMap: Record<string, number[]> = {};
  for (const e of yearMood) {
    const m = e.date.slice(0, 7);
    if (!monthMap[m]) monthMap[m] = [];
    monthMap[m].push(e.mood);
  }
  const monthAvgs = Object.entries(monthMap).map(([m, vals]) => ({
    m, avg: vals.reduce((a, b) => a + b, 0) / vals.length,
  }));
  const bestMonth  = monthAvgs.length ? monthAvgs.reduce((a, b) => b.avg > a.avg ? b : a).m : null;
  const worstMonth = monthAvgs.length ? monthAvgs.reduce((a, b) => b.avg < a.avg ? b : a).m : null;

  // ── Tasks
  const yearTasks = tasks.filter(t => {
    const d = t.scheduledDate ?? t.deadline?.split('T')[0];
    return d && d >= start && d <= end;
  });
  const done     = yearTasks.filter(t => t.status === 'done').length;
  const taskRate = yearTasks.length > 0 ? done / yearTasks.length : 0;

  // ── Finances
  const exp = expenses.filter(e => (!e.type || e.type === 'expense') && e.date.startsWith(`${year}`));
  const inc = expenses.filter(e => e.type === 'income' && e.date.startsWith(`${year}`));
  const totalSpend  = exp.reduce((s, e) => s + e.amount, 0);
  const totalIncome = inc.reduce((s, e) => s + e.amount, 0);
  const byCat: Record<string, number> = {};
  for (const e of exp) byCat[e.category] = (byCat[e.category] ?? 0) + e.amount;
  const topCategory = Object.entries(byCat).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

  // ── Events
  const evCount = events.filter(e => e.date.startsWith(`${year}`)).length;

  const bal = totalIncome - totalSpend;
  const monthCount = new Set(exp.map(e => e.date.slice(0, 7))).size || 12;
  const avgMonthlySpend = totalSpend / monthCount;

  // ── Highlight
  let highlight: string;
  if (avgM?.mood && avgM.mood >= 4) {
    highlight = `${year}: świetny rok — śr. nastrój ${avgM.mood.toFixed(1)}/5 przez ${loggedDays} dni.`;
  } else if (taskRate >= 0.75 && done > 10) {
    highlight = `${year}: ${done} zadań ukończonych (${Math.round(taskRate * 100)}%). Mega produktywny rok!`;
  } else if (bal > 0) {
    highlight = `${year}: finanse na plusie +${bal.toFixed(0)} zł. Śr. wydatki ${avgMonthlySpend.toFixed(0)} zł/mies.`;
  } else {
    highlight = `${year}: ${loggedDays} dni z wpisem nastroju, ${totalSpend.toFixed(0)} zł łącznych wydatków.`;
  }

  return {
    id: `${year}`, year, generatedAt: new Date().toISOString(),
    mood: { avgMood: avgM?.mood ?? null, bestMonth, worstMonth, loggedDays },
    tasks: { completed: done, total: yearTasks.length, rate: taskRate },
    finances: { totalSpend, totalIncome, balance: bal, avgMonthlySpend, topCategory },
    events: evCount,
    highlight,
  };
}

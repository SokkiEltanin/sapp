import AsyncStorage from '@react-native-async-storage/async-storage';
import { MoodEntry, MoodLevel, Task, CalendarEvent } from '@/types';
import { Expense } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeeklyReport {
  id: string;
  weekStart: string;  // YYYY-MM-DD (Monday)
  weekEnd: string;    // YYYY-MM-DD (Sunday)
  generatedAt: string;

  mood: {
    avgMood: number | null;
    avgEnergy: number | null;
    loggedDays: number;
    totalEntries: number;
    trend: 'up' | 'down' | 'stable' | null; // vs previous week
    topNote: string | null;
  };

  tasks: {
    completed: number;
    total: number;
    rate: number; // 0-1
  };

  finances: {
    totalSpend: number;
    foodSpend: number;
    sweetsSpend: number;
    income: number;
    topCategory: string | null;
  };

  events: number; // count of calendar events

  highlight: string; // auto-generated summary sentence
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const KEY = 'weekly_reports_v1';
const LAST_GEN_KEY = 'weekly_reports_last_gen';

export async function loadReports(): Promise<WeeklyReport[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const reports: WeeklyReport[] = raw ? JSON.parse(raw) : [];
    return reports.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  } catch {
    return [];
  }
}

export async function saveReport(report: WeeklyReport): Promise<void> {
  const reports = await loadReports();
  const idx = reports.findIndex(r => r.weekStart === report.weekStart);
  if (idx >= 0) reports[idx] = report;
  else reports.unshift(report);
  const trimmed = reports.slice(0, 52); // keep max 1 year
  await AsyncStorage.setItem(KEY, JSON.stringify(trimmed));
}

export async function deleteReport(id: string): Promise<void> {
  const reports = await loadReports();
  await AsyncStorage.setItem(KEY, JSON.stringify(reports.filter(r => r.id !== id)));
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0'); }
function toStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function getWeekBounds(weekStart: string): { start: string; end: string } {
  const d = new Date(weekStart);
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  return { start: weekStart, end: toStr(end) };
}

export function getCurrentWeekStart(): string {
  const today = new Date();
  const dow = today.getDay() === 0 ? 6 : today.getDay() - 1; // Mon = 0
  const mon = new Date(today);
  mon.setDate(today.getDate() - dow);
  return toStr(mon);
}

export function getPrevWeekStart(weekStart: string): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() - 7);
  return toStr(d);
}

// ─── Generator ────────────────────────────────────────────────────────────────

export interface ReportInput {
  weekStart: string;
  moodEntries: MoodEntry[];
  tasks: Task[];
  expenses: Expense[];
  events: CalendarEvent[];
  prevWeekMoodEntries: MoodEntry[]; // for trend
}

function moodAvg(entries: MoodEntry[]): { mood: number; energy: number } | null {
  if (!entries.length) return null;
  return {
    mood:   entries.reduce((a, b) => a + b.mood,   0) / entries.length,
    energy: entries.reduce((a, b) => a + b.energy, 0) / entries.length,
  };
}

function generateHighlight(report: Omit<WeeklyReport, 'id' | 'generatedAt' | 'highlight'>): string {
  const { mood, tasks, finances, events } = report;

  // Pick most notable fact
  if (mood.avgMood !== null && mood.avgMood >= 4.2) {
    return `Świetny nastrój — ${mood.avgMood.toFixed(1)}/5 przez cały tydzień. Tak trzymać!`;
  }
  if (tasks.total > 0 && tasks.rate >= 0.85) {
    return `Produktywny tydzień — ukończyłeś ${tasks.completed} z ${tasks.total} zadań (${Math.round(tasks.rate * 100)}%).`;
  }
  if (finances.sweetsSpend > 0 && finances.foodSpend > 0 && finances.sweetsSpend / finances.foodSpend > 0.35) {
    return `Słodycze to ${Math.round(finances.sweetsSpend / finances.foodSpend * 100)}% wydatków na jedzenie — ${finances.sweetsSpend.toFixed(0)} zł.`;
  }
  if (finances.income > 500) {
    return `Tydzień z wpływem ${finances.income.toFixed(0)} zł — finanse wyglądają nieźle.`;
  }
  if (mood.avgMood !== null && mood.avgMood < 2.5 && mood.loggedDays >= 3) {
    return `Ciężki tydzień nastrojowo (${mood.avgMood.toFixed(1)}/5). Przynajmniej jest zanotowane.`;
  }
  if (mood.trend === 'up' && mood.avgMood !== null) {
    return `Nastrój rośnie — ${mood.avgMood.toFixed(1)}/5, lepiej niż poprzedni tydzień.`;
  }
  if (tasks.total > 0 && tasks.rate < 0.4) {
    return `Trudny tydzień — tylko ${tasks.completed} z ${tasks.total} zadań ukończone. Nowy tydzień, nowa szansa.`;
  }
  if (events > 0) {
    return `${events} ${events === 1 ? 'event' : 'eventy'} w kalendarzu. Aktywny tydzień.`;
  }
  if (mood.loggedDays === 0) {
    return `Brak wpisów nastroju w tym tygodniu. Warto śledzić codziennie.`;
  }
  return `Tydzień ${report.weekStart.slice(5).replace('-', '.')} — ${mood.loggedDays}/7 dni z wpisem nastrojów.`;
}

export function generateReport(input: ReportInput): WeeklyReport {
  const { weekStart, moodEntries, tasks, expenses, events, prevWeekMoodEntries } = input;
  const { end: weekEnd } = getWeekBounds(weekStart);
  const dates = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    dates.add(toStr(d));
  }

  // ── Mood
  const weekMood   = moodEntries.filter(e => dates.has(e.date));
  const prevMood   = prevWeekMoodEntries;
  const moodDays   = new Set(weekMood.map(e => e.date)).size;
  const avg        = moodAvg(weekMood);
  const prevAvg    = moodAvg(prevMood);
  let trend: WeeklyReport['mood']['trend'] = null;
  if (avg && prevAvg) {
    const diff = avg.mood - prevAvg.mood;
    trend = diff > 0.3 ? 'up' : diff < -0.3 ? 'down' : 'stable';
  }
  const topNote = weekMood.find(e => e.note)?.note ?? null;

  // ── Tasks
  const weekTasks   = tasks.filter(t => {
    const d = t.scheduledDate ?? t.deadline?.split('T')[0];
    return d && dates.has(d);
  });
  const doneCount  = weekTasks.filter(t => t.status === 'done').length;
  const taskRate   = weekTasks.length > 0 ? doneCount / weekTasks.length : 0;

  // ── Finances
  const weekExp    = expenses.filter(e => (!e.type || e.type === 'expense') && dates.has(e.date.slice(0, 10)));
  const totalSpend = weekExp.reduce((s, e) => s + e.amount, 0);
  const foodSpend  = weekExp.filter(e => e.category === 'groceries').reduce((s, e) => s + e.amount, 0);
  const income     = expenses.filter(e => e.type === 'income' && dates.has(e.date.slice(0, 10))).reduce((s, e) => s + e.amount, 0);

  let sweetsSpend = 0;
  for (const e of weekExp) {
    for (const it of (e.receiptItems ?? [])) {
      if (it.tags.includes('słodycze')) sweetsSpend += it.price;
    }
  }

  const byCat: Record<string, number> = {};
  for (const e of weekExp) byCat[e.category] = (byCat[e.category] ?? 0) + e.amount;
  const topCategory = Object.entries(byCat).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

  // ── Events
  const weekEvents = events.filter(e => dates.has(e.date)).length;

  const partial: Omit<WeeklyReport, 'id' | 'generatedAt' | 'highlight'> = {
    weekStart,
    weekEnd,
    mood: {
      avgMood: avg?.mood ?? null,
      avgEnergy: avg?.energy ?? null,
      loggedDays: moodDays,
      totalEntries: weekMood.length,
      trend,
      topNote,
    },
    tasks: { completed: doneCount, total: weekTasks.length, rate: taskRate },
    finances: { totalSpend, foodSpend, sweetsSpend, income, topCategory },
    events: weekEvents,
  };

  return {
    ...partial,
    id: weekStart,
    generatedAt: new Date().toISOString(),
    highlight: generateHighlight(partial),
  };
}

// ─── Auto-generation check ────────────────────────────────────────────────────

export async function shouldAutoGenerate(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(LAST_GEN_KEY);
    const lastGen: string | null = raw ? JSON.parse(raw) : null;
    const currentWeek = getCurrentWeekStart();
    // Generate if we haven't generated for the PREVIOUS week yet
    const today = new Date();
    const dow = today.getDay(); // 0=Sun, 1=Mon
    // Only generate on Mon/Tue to catch the previous week
    if (dow !== 1 && dow !== 2) return false;
    const prevWeekStart = getPrevWeekStart(currentWeek);
    return lastGen !== prevWeekStart;
  } catch {
    return false;
  }
}

export async function markGenerated(weekStart: string): Promise<void> {
  await AsyncStorage.setItem(LAST_GEN_KEY, JSON.stringify(weekStart));
}

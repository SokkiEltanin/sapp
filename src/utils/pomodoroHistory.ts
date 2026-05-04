import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PomodoroSession {
  id: string;
  date: string;       // YYYY-MM-DD
  taskId?: string | null;
  taskTitle?: string | null;
  durationMins: number;
  completedAt: string; // ISO
}

const KEY = 'pomodoro_sessions_v1';

async function load(): Promise<PomodoroSession[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function logSession(
  taskId: string | null,
  taskTitle: string | null,
  durationMins: number,
): Promise<void> {
  const sessions = await load();
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  sessions.push({
    id: Date.now().toString(),
    date,
    taskId,
    taskTitle,
    durationMins,
    completedAt: now.toISOString(),
  });
  // keep only last 90 days worth
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutStr = `${cutoff.getFullYear()}-${pad(cutoff.getMonth() + 1)}-${pad(cutoff.getDate())}`;
  const trimmed = sessions.filter(s => s.date >= cutStr);
  await AsyncStorage.setItem(KEY, JSON.stringify(trimmed));
}

export async function getSessionsForDates(dates: string[]): Promise<Record<string, PomodoroSession[]>> {
  const sessions = await load();
  const result: Record<string, PomodoroSession[]> = {};
  for (const d of dates) result[d] = [];
  for (const s of sessions) {
    if (result[s.date] !== undefined) result[s.date].push(s);
  }
  return result;
}

export async function getTodaySessions(): Promise<PomodoroSession[]> {
  const sessions = await load();
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return sessions.filter(s => s.date === today);
}

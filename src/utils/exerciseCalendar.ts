import { ExerciseLogEntry } from '@/utils/personalQuests';

// Czyste helpery dla app/exercises-history.tsx (2026-10-15, user: "nie ma historii nie wiem
// ile wczoraj zrobiłem... jak wchodzę nie widzę postępu... np tego miesiąca") — ten sam
// podział co waterCalendar.ts (logika osobno od ekranu, bo ekran importuje
// react-native-svg/expo-router, nie da się go łatwo testować). `ymd`/`fmtDay`/`tierAlpha` z
// waterCalendar.ts są wystarczająco generyczne (biorą gołe stringi/liczby, nic wodnego) —
// reużyte wprost, nie duplikowane tutaj.
export interface ExerciseDayCell {
  ds: string;
  distinctCount: number;  // ile RÓŻNYCH ćwiczeń tego dnia (max sensowny punkt odniesienia: 6 kanonicznych)
  totalAmount: number;    // suma wszystkich ilości (różne jednostki się tu miesza — czysto orientacyjna liczba)
  entryCount: number;     // liczba wpisów (nie to samo co distinctCount — można zalogować to samo ćwiczenie kilka razy)
}

export function exerciseDayCell(logs: ExerciseLogEntry[], ds: string): ExerciseDayCell {
  const dayLogs = logs.filter(l => l.date === ds);
  return {
    ds,
    distinctCount: new Set(dayLogs.map(l => l.exercise)).size,
    totalAmount: dayLogs.reduce((sum, l) => sum + l.amount, 0),
    entryCount: dayLogs.length,
  };
}

export interface ExerciseMonthSummary {
  activeDays: number;
  totalEntries: number;
  totalAmount: number;
  distinctExercises: number;
}

// `monthKey` — 'YYYY-MM', dopasowywane przez prefiks `date` (który jest zawsze 'YYYY-MM-DD'),
// bez parsowania Date — prostsze i bez stref czasowych do pomylenia.
export function exerciseMonthSummary(logs: ExerciseLogEntry[], monthKey: string): ExerciseMonthSummary {
  const monthLogs = logs.filter(l => l.date.startsWith(monthKey));
  return {
    activeDays: new Set(monthLogs.map(l => l.date)).size,
    totalEntries: monthLogs.length,
    totalAmount: monthLogs.reduce((sum, l) => sum + l.amount, 0),
    distinctExercises: new Set(monthLogs.map(l => l.exercise)).size,
  };
}

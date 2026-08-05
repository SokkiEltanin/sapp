import { MOOD_COLORS } from '@/types';

// Czyste formatery/mapery dashboardu — wyniesione z app/(tabs)/index.tsx (krok 1 utwardzania).
// Bez zależności od store'ów/RN → testowalne w node.

// Kolor dla średniego nastroju (1..5).
export function moodColor(avg: number): string {
  if (avg >= 4.5) return MOOD_COLORS[5];
  if (avg >= 3.5) return MOOD_COLORS[4];
  if (avg >= 2.5) return MOOD_COLORS[3];
  if (avg >= 1.5) return MOOD_COLORS[2];
  return MOOD_COLORS[1];
}

// Polska odmiana rzeczownika „zadanie" (1 zadanie / 2–4 zadania / 5+ zadań, z wyjątkiem 12–14).
export function plTasks(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  if (n === 1) return 'zadanie';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'zadania';
  return 'zadań';
}

// Komunikat limitu tagu, eskalujący z wykorzystaniem (0..1+).
export function tagLimitMsg(pct: number): string {
  if (pct >= 1)    return 'Przekroczono limit';
  if (pct >= 0.85) return 'Hamuj! Limit prawie wyczerpany';
  if (pct >= 0.6)  return 'Robi się gorąco';
  if (pct >= 0.35) return 'Powoli, powoli';
  if (pct >= 0.15) return 'Kurde, raz Cię pokusiło';
  if (pct > 0)     return 'Na razie idzie dobrze';
  return 'Czysto, zero wydatków';
}

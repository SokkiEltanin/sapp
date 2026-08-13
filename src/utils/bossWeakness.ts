import { Habit } from '@/types';
import { WeaknessKey } from './bosses';
import { sweetlessDaysFrom } from './quests';

// Prawdziwe serie samoopieki → osłabiona obrona bossa (2026-08-13, user: "dodajmy bossom że
// jak mam streak np bez słodyczy to on ma osłabioną obronę... im większy tym mniej obrony i
// innych też niezależnie na co są słabi"). Świadomie NIE wraca to do modelu sprzed v5-pivotu
// (patrz komentarz na górze bosses.ts) — tamten liczył się z DZISIEJSZYCH danych (jeden zły
// dzień = od razu słabszy atak, źle się czuło). Tu wejściem jest wielodniowa SERIA (streakBack-
// style, stabilna, nie znika po jednym potknięciu) i wpływa na OBRONĘ (effective HP bossa),
// nie na Twój atak — czyli "osłabiona obrona", nie "wzmocniony cios".

export type WeaknessStreaks = Record<WeaknessKey, number>;

function pad(n: number) { return String(n).padStart(2, '0'); }
function dayKeyOf(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

// walk back from today counting consecutive days for which pred(dayKey) holds — sam wzorzec
// co streakBack w achievements.ts, celowo zduplikowany (mały, samodzielny plik bez importu
// achievements.ts, żeby nie ciągnąć jego dużego zestawu zależności tylko po tę jedną funkcję).
function streakBack(pred: (k: string) => boolean): number {
  let n = 0; const base = new Date();
  for (let i = 0; i < 400; i++) { const d = new Date(base); d.setDate(d.getDate() - i); if (!pred(dayKeyOf(d))) break; n++; }
  return n;
}

function isWaterHabit(h: Habit): boolean {
  return h.kind === 'water' || (h.type === 'count' && h.title.trim().toLowerCase() === 'woda');
}
function isStepsHabit(h: Habit): boolean {
  const t = h.title.trim().toLowerCase();
  return t === 'kroki' || t === 'kroków' || t === 'chodzenie' || t === 'spacer' || t === 'steps';
}

export function computeWeaknessStreaks(args: {
  habits: Habit[];
  getHabitStreak: (id: string) => number;
  expenses: { type?: string; date: string; receiptItems?: { tags?: string[]; excluded?: boolean; kind?: string }[] }[];
  moodEntries: { date?: string }[];
  healthDays: Record<string, { sleepMinutes?: number }>;
}): WeaknessStreaks {
  const { habits, getHabitStreak, expenses, moodEntries, healthDays } = args;
  const waterHabit = habits.find(isWaterHabit);
  const stepsHabit = habits.find(isStepsHabit);
  return {
    habits: habits.length ? Math.max(0, ...habits.map(h => getHabitStreak(h.id))) : 0,
    water: waterHabit ? getHabitStreak(waterHabit.id) : 0,
    steps: stepsHabit ? getHabitStreak(stepsHabit.id) : 0,
    sweetless: sweetlessDaysFrom(expenses),
    mood: streakBack(k => moodEntries.some(m => (m.date ?? '').slice(0, 10) === k)),
    sleep: streakBack(k => (healthDays[k]?.sleepMinutes ?? 0) >= 420),
  };
}

// -1%/dzień serii, max -35% przy 35+ dniach — obliczalny, nie "z czapy": 35 dni to niecałe
// 5 tygodni (pierwszy realny kamień milowy w StreakWallCard to już 7 dni), więc próg jest
// osiągalny przy realnym zaangażowaniu, ale nie w tydzień.
export function weaknessHpFactor(streakDays: number): number {
  return Math.max(0.65, 1 - Math.max(0, streakDays) * 0.01);
}

// Bez efektu = zwraca TEN SAM obiekt (nie kopię) — callerzy mogą liczyć na referencyjną
// stabilność gdy gracz nie ma jeszcze żadnej serii w danej kategorii.
export function weakenBoss<T extends { hp: number }>(boss: T, streakDays: number): T {
  const f = weaknessHpFactor(streakDays);
  if (f >= 1) return boss;
  return { ...boss, hp: Math.max(1, Math.round(boss.hp * f)) };
}

import { Gender, TrainingLevel } from '@/store/profileStore';

// Wiek w pełnych latach z daty urodzenia (YYYY-MM-DD), liczony wg DZISIEJSZEJ lokalnej
// daty — patrz memory date_local_iso.md, ale tu wystarczy zwykłe Date() bo porównujemy
// tylko rok/miesiąc/dzień, nie strefę.
export function ageFrom(birthdate: string | null, today: Date = new Date()): number | null {
  if (!birthdate) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdate);
  if (!m) return null;
  const [, y, mo, d] = m.map(Number) as unknown as [number, number, number, number];
  let age = today.getFullYear() - y;
  const hadBirthdayThisYear = today.getMonth() + 1 > mo || (today.getMonth() + 1 === mo && today.getDate() >= d);
  if (!hadBirthdayThisYear) age--;
  return age >= 0 && age < 130 ? age : null;
}

export interface PersonalQuestTargets {
  pushups: number;
  squats: number;
  situps: number;
  plankSeconds: number;
  stretchMinutes: number;
  bikeMinutes: number;
}

// Bazowe cele wg poziomu treningowego — resztę (wiek/płeć) dokłada targetsFor jako
// łagodny mnożnik, nie osobna tabela na każdą kombinację (za dużo niuansu jak na
// codzienny quest-flavour, patrz opis w quests.ts).
const BASE: Record<TrainingLevel, PersonalQuestTargets> = {
  poczatkujacy: { pushups: 5, squats: 10, situps: 10, plankSeconds: 20, stretchMinutes: 5, bikeMinutes: 15 },
  sredni: { pushups: 15, squats: 25, situps: 20, plankSeconds: 40, stretchMinutes: 8, bikeMinutes: 20 },
  zaawansowany: { pushups: 30, squats: 50, situps: 40, plankSeconds: 60, stretchMinutes: 12, bikeMinutes: 30 },
};

// Personalizowane cele questów treningowych. `level` domyślnie 'poczatkujacy' (ostrożny
// start), wiek >=40/50 łagodnie obniża liczbę powtórzeń/czas (poza rowerem — czas jazdy
// jest już z natury łagodniejszy niż powtórzenia, zostaje czysto poziom-zależny), płeć
// koryguje TYLKO pompki (jedyna z sześciu, gdzie typowe tabele norm faktycznie różnią się
// między płciami — reszta zostaje wspólna).
export function targetsFor(level: TrainingLevel | null, age: number | null, gender: Gender | null): PersonalQuestTargets {
  const base = BASE[level ?? 'poczatkujacy'];
  const ageMult = age != null && age >= 50 ? 0.6 : age != null && age >= 40 ? 0.8 : 1;
  const pushupMult = gender === 'kobieta' ? 0.7 : 1;
  return {
    pushups: Math.max(3, Math.round(base.pushups * ageMult * pushupMult)),
    squats: Math.max(5, Math.round(base.squats * ageMult)),
    situps: Math.max(5, Math.round(base.situps * ageMult)),
    plankSeconds: Math.max(10, Math.round(base.plankSeconds * ageMult)),
    stretchMinutes: Math.max(3, Math.round(base.stretchMinutes * ageMult)),
    bikeMinutes: base.bikeMinutes,
  };
}

// ── Rotacja puli (2026-08-11) — user po zbudowaniu stałej trójki pompki/przysiady/rower:
// "w stylu S&F lepiej działa pula z losowym podzbiorem dziennie — mniej znudzenia". Zamiast
// pokazywać WSZYSTKIE questy treningowe codziennie na zawsze, dzień wybiera DAILY_EXERCISE_
// COUNT z pełnej puli — deterministycznie (ten sam dzień = ten sam zestaw, nie tasuje się
// przy każdym re-renderze), różne dni = różne zestawy. Sam silnik questów (BONUS w quests.ts)
// się nie zmienia — rotację czyta pet.tsx, wypełniając tylko cele ćwiczeń z dzisiejszej puli.
export type TrainingExercise = 'pushups' | 'squats' | 'situps' | 'plank' | 'stretch' | 'bike';
export const TRAINING_EXERCISES: TrainingExercise[] = ['pushups', 'squats', 'situps', 'plank', 'stretch', 'bike'];
export const DAILY_EXERCISE_COUNT = 3;

function hashOf(s: string, mul: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * mul + s.charCodeAt(i)) >>> 0;
  return h;
}

// Deterministyczny podzbiór puli na dany dzień (YYYY-MM-DD) — ten sam wzorzec `hashOf` co
// raidForWeek w raid.ts, tylko sortujący całą pulę zamiast wybierający jeden indeks.
export function dailyExercisePool(date: string, count: number = DAILY_EXERCISE_COUNT): TrainingExercise[] {
  return [...TRAINING_EXERCISES]
    .sort((a, b) => hashOf(date + a, 31) - hashOf(date + b, 31))
    .slice(0, Math.max(0, Math.min(count, TRAINING_EXERCISES.length)));
}

function dateStr(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function offsetDate(from: string, days: number): string {
  const d = new Date(from + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return dateStr(d);
}

// Streak dni treningu — DOWOLNY quest z rotowanej puli tego dnia liczy się (nie jeden
// konkretny, bo "10 dni z rzędu pompek" dosłownie nie ma już sensu skoro pompki nie muszą
// wypaść codziennie). Ten sam wzorzec chodzenia wstecz co useHabits.ts getStreak, tylko
// szersze okno (364 dni) bo m_training w quests.ts ma próg aż do 200.
export function trainingStreakFrom(trainingDays: Record<string, true>, today: string): number {
  let streak = 0;
  const start = trainingDays[today] ? 0 : -1;
  for (let i = start; i >= -364; i--) {
    if (trainingDays[offsetDate(today, i)]) streak++; else break;
  }
  return streak;
}

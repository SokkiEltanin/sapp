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
  bikeMinutes: number;
}

// Bazowe cele wg poziomu treningowego — resztę (wiek/płeć) dokłada targetsFor jako
// łagodny mnożnik, nie osobna tabela na każdą kombinację (za dużo niuansu jak na
// codzienny quest-flavour, patrz opis w quests.ts).
const BASE: Record<TrainingLevel, PersonalQuestTargets> = {
  poczatkujacy: { pushups: 5, squats: 10, bikeMinutes: 15 },
  sredni: { pushups: 15, squats: 25, bikeMinutes: 20 },
  zaawansowany: { pushups: 30, squats: 50, bikeMinutes: 30 },
};

// Personalizowane cele questów treningowych. `level` domyślnie 'poczatkujacy' (ostrożny
// start), wiek >=40/50 łagodnie obniża liczbę powtórzeń, płeć koryguje TYLKO pompki
// (jedyna z trzech, gdzie typowe tabele norm faktycznie różnią się między płciami —
// przysiady/rower zostają wspólne).
export function targetsFor(level: TrainingLevel | null, age: number | null, gender: Gender | null): PersonalQuestTargets {
  const base = BASE[level ?? 'poczatkujacy'];
  const ageMult = age != null && age >= 50 ? 0.6 : age != null && age >= 40 ? 0.8 : 1;
  const pushupMult = gender === 'kobieta' ? 0.7 : 1;
  return {
    pushups: Math.max(3, Math.round(base.pushups * ageMult * pushupMult)),
    squats: Math.max(5, Math.round(base.squats * ageMult)),
    bikeMinutes: base.bikeMinutes,
  };
}

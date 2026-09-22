// Progi serii — wspólny język kolorów dla całej apki (płomienie + kafelki „Twoje serie").
// Im dłuższa seria, tym rzadszy „rarity" kolor kafelka: bordo → czerwień → pomarańcz →
// róż → ametyst → błękit → indygo → fiolet (legenda). Przekroczenie progu = celebracja
// (StreakWallCard). WYDZIELONE z StreakFlame.tsx (2026-09-22) — ten plik był poprzednio
// jedynym źródłem prawdy, ale importuje 'react-native' (komponenty), więc jest
// nietestowalne bezpośrednio w Jest (ten sam znany limit co np. notificationsService.ts —
// patrz __tests__/streakFlame.test.ts). Czysta logika progów żyje TU, StreakFlame.tsx
// re-eksportuje dla wstecznej zgodności (5 miejsc w apce importuje stąd).
//
// DWA NOWE PROGI (2026-09-22, user: "jestem zestresowany na różowym kolorze już [długo]...
// zaczyna dręczyć nie motywować") — pierwotne progi (1/7/14/30/60/100) rosły z coraz większym
// odstępem (6/7/16/30/40 dni MIĘDZY progami), więc róż (30 dni bez ŻADNEJ zmiany koloru) i
// błękit (40 dni) były drastycznie dłuższymi „ciszami wizualnymi" niż wcześniejsze progi,
// które zmieniały się mniej więcej co tydzień-dwa. Wstawiony PO JEDNYM dodatkowym progu w
// środku obu najgorszych odcinków (45 = geometryczny/wizualny środek 30-59, 80 = środek
// 60-99) — połowi maksymalną długość „ciszy" (30→15, 40→20) bez przebudowy reszty systemu.
// Kolory nowych progów (Ametyst/Indygo) SYSTEMATYCZNIE wyliczone jako RGB-środek dwóch
// sąsiadujących progów (róż↔błękit, błękit↔legenda) — nie zgadywane, płynne przejście barwy
// zamiast losowego dodatkowego koloru. Patrz też `renderTile` w StreakWallCard.tsx — nowy
// pasek postępu do następnego progu, żeby nawet W TRAKCIE długiego odcinka było widać
// codzienny mikroruch, nie tylko skok koloru raz na kilka tygodni.
export interface StreakTier { i: number; color: string; name: string; min: number; next: number | null }
export const STREAK_TIERS: { min: number; color: string; name: string }[] = [
  { min: 1,   color: '#9A3444', name: 'Bordo' },
  { min: 7,   color: '#DC2626', name: 'Czerwień' },
  { min: 14,  color: '#F97316', name: 'Pomarańcz' },
  { min: 30,  color: '#EC4899', name: 'Róż' },
  { min: 45,  color: '#9465C8', name: 'Ametyst' },
  { min: 60,  color: '#3B82F6', name: 'Błękit' },
  { min: 80,  color: '#636FF6', name: 'Indygo' },
  { min: 100, color: '#8B5CF6', name: 'Legenda' },
];

export function streakTier(days: number): StreakTier {
  let i = 0;
  for (let k = 0; k < STREAK_TIERS.length; k++) if (days >= STREAK_TIERS[k].min) i = k;
  const t = STREAK_TIERS[i];
  return { i, color: t.color, name: t.name, min: t.min, next: i + 1 < STREAK_TIERS.length ? STREAK_TIERS[i + 1].min : null };
}

// Duolingo-style streak flame: the day count sits inside a flickering flame whose
// colour "heats up" with the streak length (via the shared tier scheme above).
export function streakColor(days: number): string {
  if (days < 1) return '#8A93A8'; // cold grey (0 days)
  return streakTier(days).color;
}

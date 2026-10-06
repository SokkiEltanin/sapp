// Wydzielone z TopPill.tsx (2026-10-06, user: "ogarnij dynamic pilla... zeby nie byl taki
// hukowy zlagowany znikający") — żeby dało się przetestować bez ciągnięcia całego komponentu
// (RN/expo-router/lucide/zustand stores) do Jest, ta sama dyscyplina co `moodPatterns.ts`
// wcześniej w tej sesji.

// Stany „na żywo" (tykają co sekundę — pomodoro/zarobki z pracy) → pulsująca kropka.
export const isLive = (key: string) => key.startsWith('pom-') || key.startsWith('earn-');

// `animKey`: stabilna tożsamość KATEGORII pigułki, do WYZWALANIA animacji — oddzielona od
// surowego `item.key`. `item.key` dla stanów „na żywo" wplata tykającą wartość wprost
// (`pom-${sekundy pozostałe}`, `earn-${zarobek}`) — ZMIENIA SIĘ CO SEKUNDĘ (pomodoro/praca
// tykają co 1000ms, patrz pomodoroStore.ts/useWorkEarnings.ts). Używanie `item.key`
// bezpośrednio jako deps efektów animacji powodowało, że CAŁA animacja (crossfade + pętla
// pulsującej kropki) restartowała się co sekundę — stąd thumpnięcie/stutter/wrażenie
// migania. `animKeyFor` ścina tykający sufiks do jednej, stabilnej wartości kategorii — poza
// `pom`/`earn` zachowanie identyczne jak surowy klucz (rotacja luźnej puli/pilnych stanów
// nadal normalnie crossfade'uje przy realnej zmianie treści).
export function animKeyFor(key: string): string {
  if (key.startsWith('pom-')) return 'pom';
  if (key.startsWith('earn-')) return 'earn';
  return key;
}

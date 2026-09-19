import { MoodEntry } from '@/types';

// Sugerowane tagi check-inu humoru (`MoodCheckInModal.tsx`) — wydzielone tu (2026-09-10,
// user: "przyjrzyj się wpisywaniu humoru... żeby te tagi ulepszyć na bazie tego też ile mam
// energii lub połączenia że jestem szczęśliwy ale nie wyspany") — żeby dało się to
// jednostkowo przetestować (czysta funkcja, zero komponentu).
//
// Problem: `MoodEntry` ma OD DAWNA dwa niezależne pola — `mood` (nastrój) i `energy`
// (energia) — ale sortowanie podpowiedzi tagów patrzyło WYŁĄCZNIE na `mood` (pozytywne/
// negatywne wg sentymentu). Efekt: przy "szczęśliwy ale niewyspany" (mood wysoki, energy
// niski) tagi typu "zmęczony" — mimo że TRAFNIE opisujące stan — lądowały na końcu listy,
// bo sortowanie "dobry nastrój → pozytywne na górę" traktowało "zmęczony" jako czysto
// negatywny sentyment, ignorując że user ma akurat DOBRY nastrój i tylko niską energię.
//
// Naprawa: druga, NIEZALEŻNA oś trafności — `HIGH_ENERGY_TAGS`/`LOW_ENERGY_TAGS` — łączona
// addytywnie z istniejącą osią nastroju (`POSITIVE_TAGS`/`NEGATIVE_TAGS`). Tag pasujący do
// OBU aktualnych sygnałów (np. "szczęśliwy" przy dobrym nastroju, "zmęczony" przy niskiej
// energii) dostaje wysoką trafność NIEZALEŻNIE od drugiej osi — więc "szczęśliwy ale
// niewyspany" wypycha na górę OBA typy tagów naraz, zamiast zagrzebywać energetyczne pod
// nastrojowymi. `zmęczony` CELOWO wyleciał z `NEGATIVE_TAGS` (był tam wcześniej) — to
// przede wszystkim stan ENERGII, nie nastroju (można być zmęczonym i całkiem zadowolonym);
// zostawienie go w obu zbiorach ZEROWAŁOBY jego trafność w tej właśnie kombinacji (-1 z
// nastroju × +1 sygnał dobrego nastroju = -1, +(-1 energia × -1 sygnał niskiej energii) =
// +1, suma 0 — dokładnie ten bug, który user zgłosił).
export const PRESET_TAGS = [
  'skupiony', 'zmęczony', 'niespokojny', 'radosny', 'smutny',
  'produktywny', 'rozproszony', 'spokojny', 'motywowany', 'przytłoczony',
  'wdzięczny', 'zestresowany', 'szczęśliwy', 'sfrustrowany', 'zrelaksowany',
  'podekscytowany', 'samotny', 'pełen energii', 'bez motywacji', 'zadowolony',
  'przygnębiony', 'towarzyski', 'twórczy', 'zaniepokojony', 'pewny siebie',
  'niewyspany',
];

// Oś NASTROJU (sentyment) — `zmęczony` świadomie NIE tu, patrz komentarz wyżej.
export const POSITIVE_TAGS = new Set([
  'skupiony', 'radosny', 'produktywny', 'spokojny', 'motywowany',
  'wdzięczny', 'szczęśliwy', 'zrelaksowany', 'podekscytowany',
  'pełen energii', 'zadowolony', 'towarzyski', 'twórczy', 'pewny siebie',
]);
export const NEGATIVE_TAGS = new Set([
  'niespokojny', 'smutny', 'rozproszony', 'przytłoczony',
  'zestresowany', 'sfrustrowany', 'samotny', 'bez motywacji', 'przygnębiony',
  'zaniepokojony',
]);

// Oś ENERGII — niezależna od nastroju. `niewyspany` to nowy tag (user go nazwał wprost
// jako przykład) — brak snu ≠ ogólne zmęczenie (np. z wysiłku), więc osobny, konkretniejszy
// wybór zamiast przeciążania jednego "zmęczony".
export const HIGH_ENERGY_TAGS = new Set([
  'pełen energii', 'skupiony', 'produktywny', 'motywowany', 'podekscytowany',
]);
export const LOW_ENERGY_TAGS = new Set([
  'zmęczony', 'niewyspany', 'bez motywacji', 'rozproszony',
]);

// -1/0/+1 — jak bardzo dany poziom (nastroju LUB energii) ciągnie w stronę "źle"/"dobrze".
// 3 (środek skali) i brak wyboru (`undefined`) to NEUTRALNE — zanim user w ogóle wybierze
// nastrój/energię, sortowanie zostaje czystym kontekstem+recency (patrz `sortMoodTags` niżej).
function levelSignal(level: number | undefined): -1 | 0 | 1 {
  if (level == null) return 0;
  if (level <= 2) return -1;
  if (level >= 4) return 1;
  return 0;
}

// Trafność tagu dla AKTUALNEJ kombinacji nastrój+energia — addytywna suma dwóch
// niezależnych osi, patrz komentarz na górze pliku po pełne wyjaśnienie "dlaczego".
export function tagRelevance(tag: string, moodSignal: -1 | 0 | 1, energySignal: -1 | 0 | 1): number {
  const moodScore = POSITIVE_TAGS.has(tag) ? 1 : NEGATIVE_TAGS.has(tag) ? -1 : 0;
  const energyScore = HIGH_ENERGY_TAGS.has(tag) ? 1 : LOW_ENERGY_TAGS.has(tag) ? -1 : 0;
  return moodScore * moodSignal + energyScore * energySignal;
}

// ── "Logiczne polecanie tagów" (2026-09-19, user: redesign check-inu humoru, drugi kawałek
// obok siatki nastrój×energia w MoodEnergyGrid.tsx) — dwa NOWE, niezależne sygnały ponad samo
// dopasowanie mood/energy z `tagRelevance` wyżej. User poprosił wprost o (1) porę dnia/dzień
// tygodnia i (3) ostatnio używane/powtarzalność — (2) dane z innych ekranów (sen/kroki/
// wydatki) ŚWIADOMIE NIE tutaj: `MoodEntry` nie ma żadnego z tych sygnałów, doprowadzenie ich
// tu oznaczałoby albo duplikowanie całego pipeline'u syncu Health Connect z health.tsx (async,
// stateful, nie ma go jako prostego selektora), albo czytanie na twardo jego prywatnego
// klucza AsyncStorage z zewnątrz — obie ścieżki to hack, nie fix, i żadnej nie da się
// zweryfikować bez fizycznego urządzenia z realnymi danymi Health Connect. Odłożone świadomie,
// nie przez przeoczenie — wymaga najpierw wydzielenia współdzielonego selektora "dzisiejszy
// sen/kroki", osobne zadanie.

// Recency-ważona częstość — tag użyty NIEDAWNO liczy się mocniej niż taki sam użyty dawno,
// half-life 14 dni (`Math.pow(0.5, dni/14)`: użycie sprzed 14 dni waży połowę świeżego, sprzed
// 28 dni ćwierć, itd.) — zamiast surowej sumy WSZYSTKICH wpisów w historii (co dawało tagowi
// użytemu 20× rok temu przewagę nad takim użytym 3× w tym tygodniu). Osobna funkcja od tego co
// pokazuje się jako liczba na chipie w `MoodCheckInModal.tsx` (`count={tagFrequency.get(tag)}`,
// tam CELOWO surowa suma — user chce widzieć realną liczbę "ile razy w ogóle", nie wagę).
function recencyWeight(entries: MoodEntry[], now: Date): Map<string, number> {
  const map = new Map<string, number>();
  const nowMs = now.getTime();
  for (const e of entries) {
    const entryMs = new Date(`${e.date}T12:00:00`).getTime();
    const daysAgo = Math.max(0, (nowMs - entryMs) / 86400000);
    const w = Math.pow(0.5, daysAgo / 14);
    for (const t of e.tags) map.set(t, (map.get(t) ?? 0) + w);
  }
  return map;
}

// Pora dnia (±2h od `now`) / dzień tygodnia — np. "niewyspany" zwykle rano, "zrelaksowany"
// zwykle w weekend. Dla każdego tagu liczy UDZIAŁ jego wystąpień w tym kontekście spośród
// WSZYSTKICH jego wystąpień (0..1 na sygnał, 0..2 łącznie) — nie surową liczbę trafień, żeby
// popularny tag nie wygrywał tylko dlatego że ma więcej wpisów w ogóle, niezależnie od pory.
function contextAffinity(entries: MoodEntry[], now: Date): Map<string, number> {
  const curHour = now.getHours();
  const curDow = now.getDay();
  const hourHits = new Map<string, number>();
  const dowHits  = new Map<string, number>();
  const total    = new Map<string, number>();
  for (const e of entries) {
    const created = new Date(e.createdAt);
    const rawDiff = Math.abs(created.getHours() - curHour);
    const hourDiff = Math.min(rawDiff, 24 - rawDiff);
    const entryDow = new Date(`${e.date}T12:00:00`).getDay();
    for (const t of e.tags) {
      total.set(t, (total.get(t) ?? 0) + 1);
      if (hourDiff <= 2) hourHits.set(t, (hourHits.get(t) ?? 0) + 1);
      if (entryDow === curDow) dowHits.set(t, (dowHits.get(t) ?? 0) + 1);
    }
  }
  const result = new Map<string, number>();
  for (const [tag, n] of total) {
    result.set(tag, (hourHits.get(tag) ?? 0) / n + (dowHits.get(tag) ?? 0) / n);
  }
  return result;
}

// Sortuje `PRESET_TAGS` dla wybranego nastroju/energii w check-inie — trzy sygnały,
// malejącej wagi: (1) `tagRelevance` ×10 — dopasowanie do WYBRANEGO teraz nastroju/energii,
// dominujący sygnał (różnica o 1 punkt relevance = 10, więcej niż realny zakres (2) i (3)
// razem); (2) `contextAffinity` ×2 (zakres 0..4) — pora dnia/dzień tygodnia; (3) `recencyWeight`
// (bez mnożnika, zwykle <5, tie-break) — ostatnio używane. Bez wybranego mood/energy
// `tagRelevance` daje 0 dla każdego tagu (levelSignal(undefined)=0), więc formuła naturalnie
// redukuje się do samego kontekstu+recency, bez osobnej gałęzi na ten przypadek.
export function sortMoodTags(
  mood: number | undefined, energy: number | undefined, entries: MoodEntry[], now: Date = new Date(),
): string[] {
  const moodSignal = levelSignal(mood);
  const energySignal = levelSignal(energy);
  const recency = recencyWeight(entries, now);
  const context = contextAffinity(entries, now);
  const score = (tag: string) =>
    tagRelevance(tag, moodSignal, energySignal) * 10
    + (context.get(tag) ?? 0) * 2
    + (recency.get(tag) ?? 0);
  return [...PRESET_TAGS].sort((a, b) => score(b) - score(a));
}

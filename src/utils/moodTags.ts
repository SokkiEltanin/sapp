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
// nastrój/energię, sortowanie zostaje czystą frekwencją (patrz `sortMoodTags` niżej).
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

// Sortuje `PRESET_TAGS` (malejąco trafność, remisy po częstości użycia) dla wybranego
// nastroju/energii w check-inie. `tagFrequency` = Map<tag, ile razy użyty w przeszłości>.
export function sortMoodTags(
  mood: number | undefined, energy: number | undefined, tagFrequency: Map<string, number>,
): string[] {
  const byFreq = (a: string, b: string) => (tagFrequency.get(b) ?? 0) - (tagFrequency.get(a) ?? 0);
  const moodSignal = levelSignal(mood);
  const energySignal = levelSignal(energy);
  if (moodSignal === 0 && energySignal === 0) {
    return [...PRESET_TAGS].sort(byFreq);
  }
  return [...PRESET_TAGS].sort((a, b) => (tagRelevance(b, moodSignal, energySignal) - tagRelevance(a, moodSignal, energySignal)) || byFreq(a, b));
}

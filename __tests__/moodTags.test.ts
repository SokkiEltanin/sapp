import { sortMoodTags, tagRelevance, PRESET_TAGS, POSITIVE_TAGS, NEGATIVE_TAGS } from '@/utils/moodTags';
import { MoodEntry } from '@/types';

// 2026-09-10, user: "przyjrzyj się wpisywaniu humoru... żeby te tagi ulepszyć na bazie tego
// też ile mam energii lub połączenia że jestem szczęśliwy ale nie wyspany" — dotąd sortowanie
// podpowiedzi tagów patrzyło WYŁĄCZNIE na `mood`, ignorując `energy` (osobne, od dawna
// istniejące pole `MoodEntry.energy`). Te testy pinują NOWE zachowanie: dwie niezależne osie
// (nastrój + energia) łączone addytywnie.
//
// 2026-09-19, redesign check-inu humoru — user: "logiczne polecanie tagów" dołożyło DWA
// kolejne sygnały (pora dnia/dzień tygodnia, recency-ważona częstość) NA WIERZCHU tego samego
// mood/energy-relevance — patrz nagłówek `sortMoodTags` w moodTags.ts. `sortMoodTags` bierze
// teraz `MoodEntry[]` zamiast gołej `Map<tag, count>`, więc wszystkie testy dostają jawne `now`
// (inaczej recency-decay zależałby od realnego `Date.now()` w chwili odpalenia testu — patrz
// komentarz przy `NOW` niżej).
const NOW = new Date('2026-09-19T18:00:00'); // ustalony punkt odniesienia — testy deterministyczne niezależnie OD KIEDY faktycznie się odpalą
const empty: MoodEntry[] = [];

let seq = 0;
const entry = (tags: string[], o: Partial<MoodEntry> = {}): MoodEntry => ({
  id: `e${seq++}`, date: '2026-09-01', mood: 3, energy: 3, tags,
  createdAt: '2026-09-01T12:00:00', updatedAt: '2026-09-01T12:00:00',
  ...o,
});

describe('moodTags — sortMoodTags/tagRelevance', () => {
  test('bez wybranego nastroju/energii, bez historii → kolejność PRESET_TAGS bez zmian', () => {
    expect(sortMoodTags(undefined, undefined, empty, NOW)).toEqual(PRESET_TAGS);
  });

  test('bez wybranego nastroju/energii → częściej i świeżej używany tag wyżej', () => {
    const entries = [
      ...Array.from({ length: 5 }, () => entry(['smutny'], { date: '2026-09-18', createdAt: '2026-09-18T12:00:00' })),
      entry(['radosny'], { date: '2026-01-01', createdAt: '2026-01-01T12:00:00' }),
    ];
    const sorted = sortMoodTags(undefined, undefined, entries, NOW);
    expect(sorted.indexOf('smutny')).toBeLessThan(sorted.indexOf('radosny'));
  });

  test('dobry nastrój (mood=5) → tagi pozytywne wyżej niż negatywne', () => {
    const sorted = sortMoodTags(5, undefined, empty, NOW);
    expect(sorted.indexOf('szczęśliwy')).toBeLessThan(sorted.indexOf('smutny'));
  });

  test('zły nastrój (mood=1) → tagi negatywne wyżej niż pozytywne', () => {
    const sorted = sortMoodTags(1, undefined, empty, NOW);
    expect(sorted.indexOf('smutny')).toBeLessThan(sorted.indexOf('szczęśliwy'));
  });

  test('niska energia (energy=1) → "zmęczony"/"niewyspany" wyżej niż tag niezwiązany z energią', () => {
    const sorted = sortMoodTags(undefined, 1, empty, NOW);
    expect(sorted.indexOf('zmęczony')).toBeLessThan(sorted.indexOf('towarzyski'));
    expect(sorted.indexOf('niewyspany')).toBeLessThan(sorted.indexOf('towarzyski'));
  });

  test('wysoka energia (energy=5) → "pełen energii" wyżej niż "zmęczony"', () => {
    const sorted = sortMoodTags(undefined, 5, empty, NOW);
    expect(sorted.indexOf('pełen energii')).toBeLessThan(sorted.indexOf('zmęczony'));
  });

  // Dokładnie przykład usera: dobry nastrój + niska energia jednocześnie. Punkt odniesienia
  // to "smutny" (czysto negatywny nastrojowo, zero związku z energią) — jedyny w tym zestawie
  // presetów, który NIE pasuje do żadnej z dwóch aktualnych osi (mood=dobry, energy=niska).
  test('"szczęśliwy ale niewyspany" (mood=5, energy=1) → OBIE osie na górze, nie tylko nastrój', () => {
    const sorted = sortMoodTags(5, 1, empty, NOW);
    const badFitIdx = sorted.indexOf('smutny');
    expect(sorted.indexOf('szczęśliwy')).toBeLessThan(badFitIdx);
    expect(sorted.indexOf('niewyspany')).toBeLessThan(badFitIdx);
    expect(sorted.indexOf('zmęczony')).toBeLessThan(badFitIdx);
    // "pełen energii" (pozytywny NASTROJOWO, ale nie pasuje do niskiej energii) NIE powinien
    // bić czysto energetycznego "zmęczony" w tej kombinacji — patrz komentarz w moodTags.ts.
    expect(tagRelevance('zmęczony', 1, -1)).toBeGreaterThanOrEqual(tagRelevance('pełen energii', 1, -1));
  });

  test('"zmęczony" NIE jest już w NEGATIVE_TAGS (regresja naprawionego buga)', () => {
    expect(NEGATIVE_TAGS.has('zmęczony')).toBe(false);
    expect(POSITIVE_TAGS.has('zmęczony')).toBe(false);
  });

  test('"niewyspany" jest realnym presetem (user nazwał go wprost)', () => {
    expect(PRESET_TAGS).toContain('niewyspany');
  });

  test('sortMoodTags zawsze zwraca dokładnie te same tagi co PRESET_TAGS (żaden nie ginie/duplikuje)', () => {
    const sorted = sortMoodTags(3, 3, empty, NOW);
    expect([...sorted].sort()).toEqual([...PRESET_TAGS].sort());
  });

  // 2026-09-19, user: "logiczne polecanie tagów" — pora dnia jako dodatkowy sygnał ponad samo
  // dopasowanie nastrój/energia (ani "niewyspany" ani "zestresowany" nie pasują silniej do
  // mood/energy TUTAJ — oba neutralne, sortowanie musi więc oprzeć się na kontekście).
  test('tag używany zwykle o TEJ porze dnia (±2h) wyżej niż równie częsty, ale o innej porze', () => {
    // Te same daty dla obu grup → wkład dnia-tygodnia identyczny dla obu, jedyna różnica to
    // godzina — izoluje dokładnie to, co ten test sprawdza.
    const dates = ['2026-01-10', '2026-02-10', '2026-03-10', '2026-04-10', '2026-05-10'];
    const entries = [
      ...dates.map(d => entry(['niewyspany'],  { date: d, createdAt: `${d}T08:00:00` })), // zawsze rano
      ...dates.map(d => entry(['zestresowany'], { date: d, createdAt: `${d}T20:00:00` })), // zawsze wieczorem
    ];
    const morning = new Date('2026-09-19T08:30:00');
    const sorted = sortMoodTags(undefined, undefined, entries, morning);
    expect(sorted.indexOf('niewyspany')).toBeLessThan(sorted.indexOf('zestresowany'));
  });

  test('recency: tag użyty niedawno wyżej niż równie trafny, ale nieużywany od miesięcy', () => {
    const entries = [
      entry(['radosny'],   { date: '2026-09-17', createdAt: '2026-09-17T18:00:00' }), // 2 dni temu
      entry(['szczęśliwy'], { date: '2026-03-01', createdAt: '2026-03-01T18:00:00' }), // pół roku temu
    ];
    const sorted = sortMoodTags(undefined, undefined, entries, NOW);
    expect(sorted.indexOf('radosny')).toBeLessThan(sorted.indexOf('szczęśliwy'));
  });
});

import { sortMoodTags, tagRelevance, PRESET_TAGS, POSITIVE_TAGS, NEGATIVE_TAGS } from '@/utils/moodTags';

// 2026-09-10, user: "przyjrzyj się wpisywaniu humoru... żeby te tagi ulepszyć na bazie tego
// też ile mam energii lub połączenia że jestem szczęśliwy ale nie wyspany" — dotąd sortowanie
// podpowiedzi tagów patrzyło WYŁĄCZNIE na `mood`, ignorując `energy` (osobne, od dawna
// istniejące pole `MoodEntry.energy`). Te testy pinują NOWE zachowanie: dwie niezależne osie
// (nastrój + energia) łączone addytywnie.
const emptyFreq = new Map<string, number>();

describe('moodTags — sortMoodTags/tagRelevance', () => {
  test('bez wybranego nastroju/energii → czysta frekwencja (bez zgadywania trafności)', () => {
    const freq = new Map([['smutny', 5], ['radosny', 1]]);
    const sorted = sortMoodTags(undefined, undefined, freq);
    expect(sorted.indexOf('smutny')).toBeLessThan(sorted.indexOf('radosny'));
  });

  test('dobry nastrój (mood=5) → tagi pozytywne wyżej niż negatywne', () => {
    const sorted = sortMoodTags(5, undefined, emptyFreq);
    expect(sorted.indexOf('szczęśliwy')).toBeLessThan(sorted.indexOf('smutny'));
  });

  test('zły nastrój (mood=1) → tagi negatywne wyżej niż pozytywne', () => {
    const sorted = sortMoodTags(1, undefined, emptyFreq);
    expect(sorted.indexOf('smutny')).toBeLessThan(sorted.indexOf('szczęśliwy'));
  });

  test('niska energia (energy=1) → "zmęczony"/"niewyspany" wyżej niż tag niezwiązany z energią', () => {
    const sorted = sortMoodTags(undefined, 1, emptyFreq);
    expect(sorted.indexOf('zmęczony')).toBeLessThan(sorted.indexOf('towarzyski'));
    expect(sorted.indexOf('niewyspany')).toBeLessThan(sorted.indexOf('towarzyski'));
  });

  test('wysoka energia (energy=5) → "pełen energii" wyżej niż "zmęczony"', () => {
    const sorted = sortMoodTags(undefined, 5, emptyFreq);
    expect(sorted.indexOf('pełen energii')).toBeLessThan(sorted.indexOf('zmęczony'));
  });

  // Dokładnie przykład usera: dobry nastrój + niska energia jednocześnie. Punkt odniesienia
  // to "smutny" (czysto negatywny nastrojowo, zero związku z energią) — jedyny w tym zestawie
  // presetów, który NIE pasuje do żadnej z dwóch aktualnych osi (mood=dobry, energy=niska).
  test('"szczęśliwy ale niewyspany" (mood=5, energy=1) → OBIE osie na górze, nie tylko nastrój', () => {
    const sorted = sortMoodTags(5, 1, emptyFreq);
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
    const sorted = sortMoodTags(3, 3, emptyFreq);
    expect([...sorted].sort()).toEqual([...PRESET_TAGS].sort());
  });
});

import { parsePastedNutrition } from '@/utils/foodNutritionParser';

const FITATU_TEXT = `Ile kalorii ma 1× opakowanie
20 ml
112 kcal
Ile kalorii ma 2× opakowanie
40 ml
224 kcal
Ile kalorii ma 3× opakowanie
60 ml
337 kcal
Ile kalorii ma 0.5× opakowanie
10 ml
56 kcal
1

opakowanie
112 kcal
Śledź kalorie codziennie
Google PlayApp Store
Wartości odżywcze w Kinder Niespodzianka Pusta figurka z mlecznej czekolady z niespodzianką 20 g na 100g:
Wartość energetyczna561
Białka8.40Zwierzęceb.d.Roślinneb.d.
Tłuszcze34.90Nasycone22.90Jednonienasyconeb.d.Wielonienasyconeb.d.
Węglowodany52.60Węglowodany netto52.60Cukry52.30
Cholesterolb.d.
Błonnikb.d.`;

const AI_TEXT = `Jedno standardowe jajko Kinder Niespodzianka (20 g) ma 110–112 kcal.
Wartości odżywcze
W 1 jajku (20 g): ok. 110–112 kcal, w tym ok. 6,8 g tłuszczu i 10,4 g cukru (według oficjalnych danych Kinder Polska).
W 100 g produktu: ok. 552–560 kcal (tłuszcz: ok. 34 g, węglowodany: ok. 52 g).`;

describe('parsePastedNutrition — fitatu.com', () => {
  const r = parsePastedNutrition(FITATU_TEXT);
  it('wyłapuje nazwę produktu', () => {
    expect(r?.name).toBe('Kinder Niespodzianka Pusta figurka z mlecznej czekolady z niespodzianką');
  });
  it('wyłapuje kcal/100g z "Wartość energetyczna"', () => {
    expect(r?.kcalPer100g).toBe(561);
  });
  it('wyłapuje białko/tłuszcz/węglowodany/cukry na 100g, ignorując "netto"', () => {
    expect(r?.protein100).toBe(8.4);
    expect(r?.fat100).toBe(34.9);
    expect(r?.carbs100).toBe(52.6);
    expect(r?.sugar100).toBe(52.3);
  });
  it('wyłapuje porcję "1×" (nie 2×/3×/0.5×)', () => {
    expect(r?.servingGrams).toBe(20);
    expect(r?.servingUnit).toBe('ml');
    expect(r?.kcalPerServing).toBe(112);
  });
});

describe('parsePastedNutrition — podsumowanie AI (Gemini/Google AI search)', () => {
  const r = parsePastedNutrition(AI_TEXT);
  it('wyłapuje kcal/100g z linii "W 100 g produktu" (średnia zakresu)', () => {
    expect(r?.kcalPer100g).toBe(556);
  });
  it('wyłapuje tłuszcz/węglowodany z linii "100 g produktu", nie z linii porcji', () => {
    expect(r?.fat100).toBe(34);
    expect(r?.carbs100).toBe(52);
  });
  it('dolicza cukier z porcji (10,4g/20g), bo nie ma go w linii "100 g produktu"', () => {
    expect(r?.sugar100).toBe(52);
  });
  it('białko zostaje nieznane — AI go nie wymienił w żadnej linii', () => {
    expect(r?.protein100).toBeUndefined();
  });
  it('wyłapuje porcję "W 1 jajku (20 g)"', () => {
    expect(r?.servingGrams).toBe(20);
    expect(r?.servingUnit).toBe('g');
    expect(r?.kcalPerServing).toBe(111);
  });
  it('nie wyłapuje nazwy (AI nie podaje jej w rozpoznawalnym formacie)', () => {
    expect(r?.name).toBeUndefined();
  });
});

describe('parsePastedNutrition — przypadki brzegowe', () => {
  it('zwraca null dla tekstu bez żadnych rozpoznawalnych danych', () => {
    expect(parsePastedNutrition('losowy tekst bez kalorii')).toBeNull();
  });
  it('zwraca null dla pustego tekstu', () => {
    expect(parsePastedNutrition('')).toBeNull();
  });
  it('dolicza kcal/100g z samej porcji, gdy brak wprost wartości na 100g', () => {
    const r = parsePastedNutrition('W 1 kostce (10 g): ok. 55 kcal.');
    expect(r?.kcalPer100g).toBe(550);
    expect(r?.servingGrams).toBe(10);
    expect(r?.kcalPerServing).toBe(55);
  });
});

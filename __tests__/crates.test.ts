import { rollCrate, CRATE_META, COMBAT_ITEM_DROP_CHANCE } from '@/utils/crates';

// rollCrate używa Math.random() bezpośrednio (brak wstrzykiwalnego generatora) — zamiast
// próbkowania statystycznego, kontrolujemy go deterministycznie przez mock, sekwencyjnie
// (pierwsze wywołanie = tier, drugie = zakres monet w tierze). Granice zweryfikowane ręcznie
// (node -e) przed napisaniem asercji — szczególnie że r=próg jest WYŁĄCZONY z niższego tieru
// (< nie <=), więc np. r=0.02 to już epic, nie legendary.
describe('crates — rollCrate (progi tierów, r=próg należy do WYŻSZEGO przedziału)', () => {
  afterEach(() => jest.restoreAllMocks());

  test('r tuż poniżej 0.02 → legendary, stałe 100 monet', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.019);
    expect(rollCrate()).toEqual({ tier: 'legendary', coins: 100 });
  });
  test('r DOKŁADNIE 0.02 → epic, NIE legendary (próg wyłączny)', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.02).mockReturnValueOnce(0);
    expect(rollCrate().tier).toBe('epic');
  });
  test('r DOKŁADNIE 0.12 → rare, NIE epic', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.12).mockReturnValueOnce(0);
    expect(rollCrate().tier).toBe('rare');
  });
  test('r DOKŁADNIE 0.40 → basic, NIE rare', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.40).mockReturnValueOnce(0);
    expect(rollCrate().tier).toBe('basic');
  });

  test('epic: monety w zakresie 20–35 (skrajne wartości drugiego rzutu)', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.05).mockReturnValueOnce(0);
    expect(rollCrate().coins).toBe(20);
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.05).mockReturnValueOnce(0.999);
    expect(rollCrate().coins).toBe(35);
  });
  test('rare: monety w zakresie 5–10', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.20).mockReturnValueOnce(0);
    expect(rollCrate().coins).toBe(5);
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.20).mockReturnValueOnce(0.999);
    expect(rollCrate().coins).toBe(10);
  });
  test('basic: monety w zakresie 1–2', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.50).mockReturnValueOnce(0);
    expect(rollCrate().coins).toBe(1);
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.50).mockReturnValueOnce(0.999);
    expect(rollCrate().coins).toBe(2);
  });
});

describe('crates — stałe', () => {
  test('CRATE_META ma wpis dla każdego tieru z etykietą i kolorem', () => {
    for (const tier of ['basic', 'rare', 'epic', 'legendary'] as const) {
      expect(CRATE_META[tier].label).toBeTruthy();
      expect(CRATE_META[tier].color).toMatch(/^#/);
    }
  });
  test('szansa dropu itemu bojowego jest niewielka (celowo rzadka)', () => {
    expect(COMBAT_ITEM_DROP_CHANCE).toBeGreaterThan(0);
    expect(COMBAT_ITEM_DROP_CHANCE).toBeLessThan(0.05);
  });
});

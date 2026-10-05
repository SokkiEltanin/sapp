import { rollCrate, CRATE_META, COMBAT_ITEM_DROP_CHANCE_BY_TIER } from '@/utils/crates';
import { questRewardMult } from '@/utils/quests';

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

// 2026-10-04, user: "glaskanie pupila tez powinno iść z levelem i dawać więcej... bo teraz
// dropi 1 manetka na 26 lvl bez sensu" — dawniej `rollCrate()` bez parametru levela zawsze
// dawało te same bazowe kwoty niezależnie od poziomu gracza, jedyna nagroda w grze bez
// żadnego skalowania. Teraz mnoży przez ten sam `questRewardMult` co zwykłe questy.
describe('crates — rollCrate(level) skaluje coiny tym samym questRewardMult co questy', () => {
  afterEach(() => jest.restoreAllMocks());

  test('level domyślny (brak argumentu) = 1, identyczne jak stare, nieskalowane wywołania', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.019);
    expect(rollCrate()).toEqual({ tier: 'legendary', coins: 100 });
  });

  test('level jawnie 1 → mult 1×, też bez zmian', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.019);
    expect(rollCrate(1)).toEqual({ tier: 'legendary', coins: 100 });
  });

  test('wyższy level → proporcjonalnie więcej coinów w TYM SAMYM tierze (legendary, stała bazowa kwota ułatwia asercję)', () => {
    const mult26 = questRewardMult(26); // 1 + 25*0.045 = 2.125
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.019);
    const roll = rollCrate(26);
    expect(roll).toEqual({ tier: 'legendary', coins: Math.round(100 * mult26) });
    expect(roll.coins).toBeGreaterThan(100); // realnie więcej niż bazowe 100
  });

  test('tiery (odds) NIE zmieniają się z levelem — tylko kwota w obrębie wylosowanego tieru', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.12).mockReturnValueOnce(0);
    expect(rollCrate(200).tier).toBe('rare'); // ten sam próg co bez levela
  });
});

describe('crates — stałe', () => {
  test('CRATE_META ma wpis dla każdego tieru z etykietą i kolorem', () => {
    for (const tier of ['basic', 'rare', 'epic', 'legendary'] as const) {
      expect(CRATE_META[tier].label).toBeTruthy();
      expect(CRATE_META[tier].color).toMatch(/^#/);
    }
  });
  // 2026-08-18 — user: "itemy z bossów [mają] większy droprate... najsłabsze [zdobycie] na
  // niższych gorszych boksach, lepsze poziomy [ulepszenia] na trudniejszych" — tierowane,
  // rosnące z tierem skrzynki. `basic` PODBITE z 0 na małą, ale niezerową szansę (2026-09-08,
  // patrz komentarz przy stałej — user: "nie mogę dropnąć", zbadane: `basic`=0% dominowało
  // całą łączną szansę, bo to 60% wszystkich otwarć).
  test('szansa dropu itemu bojowego rośnie z tierem skrzynki, basic niezerowa ale najniższa', () => {
    expect(COMBAT_ITEM_DROP_CHANCE_BY_TIER.basic).toBeGreaterThan(0);
    expect(COMBAT_ITEM_DROP_CHANCE_BY_TIER.rare).toBeGreaterThan(COMBAT_ITEM_DROP_CHANCE_BY_TIER.basic);
    expect(COMBAT_ITEM_DROP_CHANCE_BY_TIER.epic).toBeGreaterThan(COMBAT_ITEM_DROP_CHANCE_BY_TIER.rare);
    expect(COMBAT_ITEM_DROP_CHANCE_BY_TIER.legendary).toBeGreaterThan(COMBAT_ITEM_DROP_CHANCE_BY_TIER.epic);
    expect(COMBAT_ITEM_DROP_CHANCE_BY_TIER.legendary).toBeLessThan(0.5); // wciąż rzadkie, nie gwarantowane
  });
  test('łączna szansa na dowolne otwarcie (ważona rozkładem tierów z rollCrate) jest wyraźnie odczuwalna', () => {
    // Wagi z rollCrate(): legendary 2%, epic 10%, rare 28%, basic 60%.
    const combined =
      0.60 * COMBAT_ITEM_DROP_CHANCE_BY_TIER.basic +
      0.28 * COMBAT_ITEM_DROP_CHANCE_BY_TIER.rare +
      0.10 * COMBAT_ITEM_DROP_CHANCE_BY_TIER.epic +
      0.02 * COMBAT_ITEM_DROP_CHANCE_BY_TIER.legendary;
    expect(combined).toBeGreaterThan(0.03); // > co 33. otwarcie średnio, nie co 50.
  });
});

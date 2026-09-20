import { usePetStore } from '@/store/petStore';

// 2026-09-20, audyt logika/optymalizacja (runda 3) — `raidMaxHp` (denominator paska/% raidu w
// bosses.tsx/boss-fight.tsx) dawniej liczyło się NA ŻYWO z aktualnego poziomu przy każdym
// renderze (`raidHpFor(level, weekKey)`), więc level-up W TRAKCIE tygodnia raidu podbijał
// mianownik bez podbicia licznika (`raidHp`, realny postęp) — pasek/% "cofał się" mimo że
// gracz nic nie stracił. `raidEnsure` teraz bankuje `raidMaxHp` RAZEM z `raidHp` na start
// tygodnia (`raidWeek !== weekKey`), i to zbankowane pole ma być czytane do wyświetlania,
// nie przeliczane ponownie — te testy pilnują samej akcji store'a.
function resetStore() {
  usePetStore.setState({ raidWeek: null, raidHp: 0, raidMaxHp: 0 });
}

describe('petStore.raidEnsure — raidMaxHp zbankowane RAZEM z raidHp, nie przeliczane ponownie', () => {
  beforeEach(resetStore);

  test('pierwsze zbankowanie tygodnia ustawia OBA pola na tę samą wartość', () => {
    usePetStore.getState().raidEnsure('2026-W38', 3400);
    const s = usePetStore.getState();
    expect(s.raidWeek).toBe('2026-W38');
    expect(s.raidHp).toBe(3400);
    expect(s.raidMaxHp).toBe(3400);
  });

  test('kolejne wywołanie w TYM SAMYM tygodniu (np. po level-upie, z inną "żywą" wartością) jest no-opem — raidMaxHp NIE dryfuje', () => {
    usePetStore.getState().raidEnsure('2026-W38', 3400);
    usePetStore.getState().raidAttack(1700); // symulacja postępu w walce — raidHp: 3400→1700
    // Level-up podbiłby "żywe" raidHpFor(level, weekKey) na np. 3700 — ale to wciąż TEN SAM
    // tydzień, więc raidEnsure musi być no-opem, nie nadpisywać ani raidHp ani raidMaxHp.
    usePetStore.getState().raidEnsure('2026-W38', 3700);
    const s = usePetStore.getState();
    expect(s.raidMaxHp).toBe(3400); // NIE 3700 — zamrożone z pierwszego zbankowania
    expect(s.raidHp).toBe(1700);    // realny postęp nietknięty
  });

  test('nowy tydzień → nowe zbankowanie, raidMaxHp aktualizuje się na nową wartość', () => {
    usePetStore.getState().raidEnsure('2026-W38', 3400);
    usePetStore.getState().raidEnsure('2026-W39', 3800);
    const s = usePetStore.getState();
    expect(s.raidWeek).toBe('2026-W39');
    expect(s.raidHp).toBe(3800);
    expect(s.raidMaxHp).toBe(3800);
  });
});

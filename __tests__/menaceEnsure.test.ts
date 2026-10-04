import { usePetStore } from '@/store/petStore';

// 2026-10-04, audyt walki — `menaceMaxHp` (denominator paska/% nemesis w bosses.tsx/
// boss-fight.tsx) liczyło się NA ŻYWO z aktualnego poziomu przy każdym renderze
// (`menaceHpFor(level)`), więc level-up W TRAKCIE klepania tego samego nemesis podbijał
// mianownik bez podbicia licznika (`menaceHp`, realny postęp) — pasek/% "cofał się" mimo że
// gracz nic nie stracił. Ten sam bug i fix co `raidMaxHp` (patrz raidEnsure.test.ts) —
// `menaceEnsure` teraz bankuje `menaceMaxHp` RAZEM z `menaceHp` na start starcia z danym
// nemesis (`menaceId` się zmienia), i to zbankowane pole ma być czytane do wyświetlania.
function resetStore() {
  usePetStore.setState({ menaceId: null, menaceHp: 0, menaceMaxHp: 0 });
}

describe('petStore.menaceEnsure — menaceMaxHp zbankowane RAZEM z menaceHp, nie przeliczane ponownie', () => {
  beforeEach(resetStore);

  test('pierwsze zbankowanie starcia ustawia OBA pola na tę samą wartość', () => {
    usePetStore.getState().menaceEnsure('overtime', 5700);
    const s = usePetStore.getState();
    expect(s.menaceId).toBe('overtime');
    expect(s.menaceHp).toBe(5700);
    expect(s.menaceMaxHp).toBe(5700);
  });

  test('kolejne wywołanie z TYM SAMYM id (np. po level-upie, z inną "żywą" wartością) jest no-opem — menaceMaxHp NIE dryfuje', () => {
    usePetStore.getState().menaceEnsure('overtime', 5700);
    usePetStore.getState().menaceAttack(2000); // symulacja postępu w walce — menaceHp: 5700→3700
    // Level-up podbiłby "żywe" menaceHpFor(level) na np. 6400 — ale to wciąż TEN SAM nemesis,
    // więc menaceEnsure musi być no-opem, nie nadpisywać ani menaceHp ani menaceMaxHp.
    usePetStore.getState().menaceEnsure('overtime', 6400);
    const s = usePetStore.getState();
    expect(s.menaceMaxHp).toBe(5700); // NIE 6400 — zamrożone z pierwszego zbankowania
    expect(s.menaceHp).toBe(3700);    // realny postęp nietknięty
  });

  test('nowy nemesis → nowe zbankowanie, menaceMaxHp aktualizuje się na nową wartość', () => {
    usePetStore.getState().menaceEnsure('overtime', 5700);
    usePetStore.getState().menaceEnsure('sweettooth', 6100);
    const s = usePetStore.getState();
    expect(s.menaceId).toBe('sweettooth');
    expect(s.menaceHp).toBe(6100);
    expect(s.menaceMaxHp).toBe(6100);
  });
});

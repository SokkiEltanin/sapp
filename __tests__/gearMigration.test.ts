import { usePetStore } from '@/store/petStore';

// Self-review §124 (2026-09-18) — subagent-audyt znalazł realny bug w migracji instancji
// (petStore.ts `onRehydrateStorage`): przy "częściowym rehydrate" (user ma JUŻ zmigrowaną
// instancję `itemId:001` ORAZ stary goły wpis `itemId` dla TEGO SAMEGO itemu — realny
// scenariusz przy starym APK z GitHuba bez wymuszonej auto-aktualizacji, patrz CLAUDE.md
// "APK z GitHub") naiwna wersja mapowała stary wpis na `${itemId}:001` NA OŚLEP, kolidując z
// już zajętym kluczem i po cichu nadpisując jedną z dwóch instancji bez żadnego śladu. Fix:
// migracja szuka pierwszego WOLNEGO seq dla danego itemu, nie zawsze `:001`.
//
// `onRehydrateStorage` nie jest eksportowane wprost — wołane przez zustand `persist`
// middleware przy starcie apki z realnym storage. Testowalny seam: zustand v5 udostępnia
// `store.persist.getOptions().onRehydrateStorage`, które wywołane raz zwraca REALNY handler
// migracji, dokładnie ten sam co produkcyjnie odpala się na starcie — wołamy go tu wprost na
// ręcznie skonstruowanym `state`, bez potrzeby mockowania AsyncStorage.
function runMigration(state: any) {
  const outer = usePetStore.persist.getOptions().onRehydrateStorage!;
  const handler = outer(state as any);
  handler!(state as any, undefined);
  return state;
}

describe('petStore onRehydrateStorage — migracja instancji gearu', () => {
  test('kolizja: stary goły wpis + już zmigrowana instancja tego samego itemu — obie zachowane, żadna nie nadpisana', () => {
    const state: any = {
      ownedGear: {
        helm_slomiany: { rarity: 'common', value: 3 }, // stary format, goły klucz
        'helm_slomiany:001': { itemId: 'helm_slomiany', seq: 1, rarity: 'rare', value: 8 }, // już zmigrowana
      },
      equippedGear: { helm: 'helm_slomiany:001' },
    };
    runMigration(state);

    // Już zmigrowana instancja NIETKNIĘTA — to był realny bug (nadpisywana po cichu).
    expect(state.ownedGear['helm_slomiany:001']).toEqual({ itemId: 'helm_slomiany', seq: 1, rarity: 'rare', value: 8 });
    // Stary wpis dostaje pierwszy WOLNY seq (:002), nie kolidujący :001.
    expect(state.ownedGear['helm_slomiany:002']).toEqual({ itemId: 'helm_slomiany', seq: 2, rarity: 'common', value: 3 });
    // equippedGear dalej wskazuje na tę samą, poprawną instancję.
    expect(state.equippedGear.helm).toBe('helm_slomiany:001');
    expect(Object.keys(state.ownedGear)).toHaveLength(2);
  });

  test('brak kolizji (świeży stary zapis, zero instancji jeszcze) — dalej migruje pod :001 jak dawniej', () => {
    const state: any = {
      ownedGear: { helm_slomiany: { rarity: 'epic', value: 12 } },
      equippedGear: { helm: 'helm_slomiany' },
    };
    runMigration(state);
    expect(state.ownedGear['helm_slomiany:001']).toEqual({ itemId: 'helm_slomiany', seq: 1, rarity: 'epic', value: 12 });
    expect(state.equippedGear.helm).toBe('helm_slomiany:001');
  });

  test('już w pełni zmigrowany zapis — idempotentne, nic się nie zmienia', () => {
    const state: any = {
      ownedGear: { 'helm_slomiany:001': { itemId: 'helm_slomiany', seq: 1, rarity: 'rare', value: 8 } },
      equippedGear: { helm: 'helm_slomiany:001' },
    };
    runMigration(state);
    expect(state.ownedGear).toEqual({ 'helm_slomiany:001': { itemId: 'helm_slomiany', seq: 1, rarity: 'rare', value: 8 } });
    expect(state.equippedGear).toEqual({ helm: 'helm_slomiany:001' });
  });
});

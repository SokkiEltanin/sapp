import { usePetStore, levelFromXp } from '@/store/petStore';
import { questRewardMult } from '@/utils/quests';

// 2026-10-04, user: "glaskanie pupila tez powinno iść z levelem i dawać więcej" — dawne
// petCat() dawało STAŁE +8 XP za wypełnienie paska afekcji, niezależnie od poziomu gracza —
// jedyna nagroda w całej grze bez żadnego skalowania levelem (patrz identyczny fix dla
// coinów `rollCrate()` w crates.test.ts). Teraz mnoży bazowe 8 XP przez ten sam
// `questRewardMult(level)` co zwykłe questy, PRZED ewentualnym mnożnikiem potki
// (`xpWithPotion`) — oba mnożniki się składają, nie wykluczają.
function resetStore() {
  usePetStore.setState({
    xp: 0, affection: 0, affectionDay: null, affectionRewardDay: null,
    pendingCrates: 0, activePotion: null,
  });
}

describe('petStore.petCat — XP za pełny pasek afekcji skaluje się z poziomem', () => {
  beforeEach(resetStore);

  test('poziom 1 (xp=0): dokładnie stare +8 XP, bez zmiany zachowania', () => {
    usePetStore.getState().petCat(100); // od razu pełny pasek
    expect(usePetStore.getState().xp).toBe(8);
  });

  test('wyższy poziom → proporcjonalnie więcej XP, tym samym mnożnikiem co questy', () => {
    usePetStore.setState({ xp: 50000, affection: 0, affectionDay: null, affectionRewardDay: null });
    const levelBefore = levelFromXp(50000).level;
    const expectedGain = Math.round(8 * questRewardMult(levelBefore));
    usePetStore.getState().petCat(100);
    expect(usePetStore.getState().xp).toBe(50000 + expectedGain);
    expect(expectedGain).toBeGreaterThan(8); // realnie więcej niż bazowe +8 na wyższym poziomie
  });

  test('wypełnienie paska DRUGI raz tego samego dnia nie przyznaje XP ponownie', () => {
    usePetStore.getState().petCat(100);
    const xpAfterFirst = usePetStore.getState().xp;
    usePetStore.getState().petCat(100); // pasek już pełny, ten sam dzień
    expect(usePetStore.getState().xp).toBe(xpAfterFirst);
  });

  test('pendingCrates rośnie RAZEM z XP przy wypełnieniu paska, niezależnie od poziomu', () => {
    usePetStore.getState().petCat(100);
    expect(usePetStore.getState().pendingCrates).toBe(1);
  });
});

import { useStreakFreezeStore } from '@/store/streakFreezeStore';

// grantMilestone (2026-09-29, user zaakceptował pomysł z researchu: Duolingo przyznaje
// streak freeze automatycznie na kamieniach milowych, zanim są potrzebne). Testowane
// bezpośrednio na store (Zustand, AsyncStorage zmockowane globalnie w jest.setup.js) —
// _hydrated ustawiane ręcznie, bo prawdziwa rehydracja jest asynchroniczna.
beforeEach(() => {
  useStreakFreezeStore.setState({ freezes: 0, frozen: {}, grantedMilestones: {}, _hydrated: true });
});

describe('streakFreezeStore — grantMilestone', () => {
  test('nic nie przyznaje poniżej progu 7', () => {
    const ok = useStreakFreezeStore.getState().grantMilestone('h1', 6);
    expect(ok).toBe(false);
    expect(useStreakFreezeStore.getState().freezes).toBe(0);
  });

  test('przyznaje +1 przy dokładnie 7-dniowej serii', () => {
    const ok = useStreakFreezeStore.getState().grantMilestone('h1', 7);
    expect(ok).toBe(true);
    expect(useStreakFreezeStore.getState().freezes).toBe(1);
    expect(useStreakFreezeStore.getState().grantedMilestones['h1']).toBe(7);
  });

  test('nie przyznaje drugi raz za TEN SAM próg (idempotentne)', () => {
    useStreakFreezeStore.getState().grantMilestone('h1', 7);
    const ok = useStreakFreezeStore.getState().grantMilestone('h1', 7);
    expect(ok).toBe(false);
    expect(useStreakFreezeStore.getState().freezes).toBe(1);
  });

  test('nie przyznaje drugi raz gdy seria rośnie ale wciąż w tym samym progu 7-13', () => {
    useStreakFreezeStore.getState().grantMilestone('h1', 7);
    const ok = useStreakFreezeStore.getState().grantMilestone('h1', 10);
    expect(ok).toBe(false);
    expect(useStreakFreezeStore.getState().freezes).toBe(1);
  });

  test('przyznaje kolejne +1 gdy seria przekracza następny próg (14)', () => {
    useStreakFreezeStore.getState().grantMilestone('h1', 7);
    const ok = useStreakFreezeStore.getState().grantMilestone('h1', 14);
    expect(ok).toBe(true);
    expect(useStreakFreezeStore.getState().freezes).toBe(2);
    expect(useStreakFreezeStore.getState().grantedMilestones['h1']).toBe(14);
  });

  test('progi liczone NIEZALEŻNIE per nawyk', () => {
    useStreakFreezeStore.getState().grantMilestone('h1', 7);
    const ok = useStreakFreezeStore.getState().grantMilestone('h2', 7);
    expect(ok).toBe(true);
    expect(useStreakFreezeStore.getState().freezes).toBe(2);
  });

  test('przeskok od razu na wysoki próg (np. import starych danych) przyznaje tylko 1 zamrożenie', () => {
    const ok = useStreakFreezeStore.getState().grantMilestone('h1', 30);
    expect(ok).toBe(true);
    expect(useStreakFreezeStore.getState().freezes).toBe(1);
    expect(useStreakFreezeStore.getState().grantedMilestones['h1']).toBe(28);
  });
});

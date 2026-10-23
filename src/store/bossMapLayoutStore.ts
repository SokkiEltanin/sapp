import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';

// Ręcznie ułożony layout mapy bossów — PRZEBUDOWA OD ZERA #3 (2026-10-23, §412) — user, po
// trzeciej rundzie tego samego buga ("mapa rozjechana"): "musimy ją chyba wywalić i zbudować
// od zera". Poprzedni model (`positions: Record<string, {x,y}>`, swobodny x/y drag) ŚWIADOMIE
// PORZUCONY — bez względu na łatki (§403/§410) wciąż dawał możliwość złamania "Y ściśle rośnie
// z indeksem", na której opiera się CAŁA gwarancja braku samoprzecięć trasy. Nowy model:
// KAŻDY boss może dostać TYLKO numer toru (0..LANES-1, patrz `bossMapLayout.ts`'s `LANES`) —
// Y jest TERAZ ZAWSZE proceduralne, nigdzie w kodzie nie da się go już nadpisać. Klucz =
// BAZOWE id bossa (bez `mad_` prefixu — ten sam fizyczny układ obsługuje kampanię I MAD,
// patrz `baseBossId` w madBosses.ts). Brak nadpisania dla danego id = ten boss używa
// proceduralnego toru z `layoutBossMap` (więc nowo dodani bossowie od razu mają sensowną
// pozycję, zanim user zdąży ich ręcznie poustawiać).
//
// Klucz persystencji podbity na `-v2` (ŚWIADOMIE, nie migracja) — stary `positions: {x,y}`
// kształt danych jest niekompatybilny z nowym `lanes: number`, a dane pod starym kluczem i tak
// mogły być źródłem zgłaszanego buga (złamana kolejność Y) — czysty start jest tu bezpieczniejszy
// niż próba konwersji potencjalnie uszkodzonych pozycji na tory.
interface BossMapLayoutState {
  lanes: Record<string, number>;
  _hydrated: boolean;
  setLane: (id: string, lane: number) => void;
  resetLane: (id: string) => void;
  resetAll: () => void;
}

export const useBossMapLayoutStore = create<BossMapLayoutState>()(
  persist(
    (set) => ({
      lanes: {},
      _hydrated: false,
      setLane: (id, lane) => set((s) => ({ lanes: { ...s.lanes, [id]: lane } })),
      resetLane: (id) => set((s) => {
        const { [id]: _removed, ...rest } = s.lanes;
        return { lanes: rest };
      }),
      resetAll: () => set({ lanes: {} }),
    }),
    {
      name: 'boss-map-layout-v2',
      storage: throttledPersistStorage(),
      onRehydrateStorage: () => (state) => { if (state) state._hydrated = true; },
    },
  ),
);

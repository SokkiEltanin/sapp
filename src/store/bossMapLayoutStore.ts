import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';

export interface MapPosition { x: number; y: number }

// Ręcznie ułożony layout mapy bossów (2026-10-14, user: "Moze zrobisz edytor ja sam ustawie
// wszystko mapę ścieżkę" — po pięciu rundach prób na procedural-generowanym układzie, user
// chciał po prostu sam rozstawić bossów palcem w appce). Klucz = BAZOWE id bossa (bez
// `mad_` prefixu — ten sam fizyczny układ obsługuje kampanię I MAD, patrz `baseBossId` w
// madBosses.ts i jego użycie w CampaignMap.tsx). Brak nadpisania dla danego id = ten boss
// dalej używa proceduralnego zygzaka z `layoutBossMap` (§321) — więc nowo dodani bossowie
// (user dopisuje ich "kilka dziennie", patrz NEXT_STEPS.md) od razu mają SENSOWNĄ pozycję
// zanim user zdąży ich ręcznie poustawiać, zamiast (0,0) albo błędu.
interface BossMapLayoutState {
  positions: Record<string, MapPosition>;
  _hydrated: boolean;
  setPosition: (id: string, x: number, y: number) => void;
  resetPosition: (id: string) => void;
  resetAll: () => void;
}

export const useBossMapLayoutStore = create<BossMapLayoutState>()(
  persist(
    (set) => ({
      positions: {},
      _hydrated: false,
      setPosition: (id, x, y) => set((s) => ({ positions: { ...s.positions, [id]: { x, y } } })),
      resetPosition: (id) => set((s) => {
        const { [id]: _removed, ...rest } = s.positions;
        return { positions: rest };
      }),
      resetAll: () => set({ positions: {} }),
    }),
    {
      name: 'boss-map-layout-v1',
      storage: throttledPersistStorage(),
      onRehydrateStorage: () => (state) => { if (state) state._hydrated = true; },
    },
  ),
);

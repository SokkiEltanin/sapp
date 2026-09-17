import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';

// Draft dla /battle-layout-lab (2026-09-17, user: "Daj mi mozliwosc zmienic sam obrazek tla
// walk żebym dostosował i moze tez wielkość i pozycje pupila, bossa i ich pasków HP, wtedy
// wyeksportować i zrobisz dla wszystkich") — realny ekran walki (`app/boss-fight.tsx`) NIE MA
// dziś żadnego per-element pozycjonowania: `PORTRAIT_SIZE`/`CAT_PORTRAIT_SIZE` to globalne
// stałe, a `SPRITE_GROUND_SHIFT` to WSPÓLNY przesunięcie dla obu sprite'ów (kotek/boss), paski
// HP nie mają żadnego offsetu — po prostu flex-children pod portretem. Ten store trzyma
// NIEZALEŻNE wartości dla kotka/bossa/obu pasków HP, każda domyślnie = 0 (offset) albo =
// aktualna stała z boss-fight.tsx (size) — więc "wartości domyślne" tego draftu renderują się
// DOKŁADNIE jak dzisiejsza realna arena, zero wizualnej różnicy, dopóki user czegoś nie ruszy.
export type ArenaBgKey = 'gorskislas' | 'lodowa' | 'jungla' | 'kampania';

export interface BattleLayoutDraft {
  bg: ArenaBgKey;
  catSize: number;
  bossSize: number;
  catOffsetX: number; catOffsetY: number;
  bossOffsetX: number; bossOffsetY: number;
  catHpOffsetX: number; catHpOffsetY: number;
  bossHpOffsetX: number; bossHpOffsetY: number;
}

// Musi zgadzać się 1:1 z realnymi stałymi w app/boss-fight.tsx (PORTRAIT_SIZE=130,
// CAT_PORTRAIT_SIZE=175, bg domyślne = GORSKILAS) — offsety=0 bo dziś nic takiego nie istnieje.
export const BATTLE_LAYOUT_DEFAULT: BattleLayoutDraft = {
  bg: 'gorskislas',
  catSize: 175,
  bossSize: 130,
  catOffsetX: 0, catOffsetY: 0,
  bossOffsetX: 0, bossOffsetY: 0,
  catHpOffsetX: 0, catHpOffsetY: 0,
  bossHpOffsetX: 0, bossHpOffsetY: 0,
};

interface BattleLayoutDraftState {
  draft: BattleLayoutDraft;
  set: (patch: Partial<BattleLayoutDraft>) => void;
  reset: () => void;
}

export const useBattleLayoutDraft = create<BattleLayoutDraftState>()(
  persist(
    (set) => ({
      draft: BATTLE_LAYOUT_DEFAULT,
      set: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
      reset: () => set({ draft: BATTLE_LAYOUT_DEFAULT }),
    }),
    {
      name: 'battle-layout-draft-v1',
      storage: throttledPersistStorage(),
    },
  ),
);

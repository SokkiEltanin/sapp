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
  // Cień (2026-09-20, user: "cienie nie pasują skali") — dotąd `GroundShadow` liczył swój
  // width/height jako STAŁY ułamek (0.62/0.18) rozmiaru portretu, ten sam dla kotka i bossa.
  // To działa dobrze dla bossa (PNG przycięty ciasno do sylwetki), ale kotek to SVG z dużym
  // pustym marginesem wokół (patrz komentarz przy CAT_PORTRAIT_SIZE w boss-fight.tsx) — jego
  // realna sylwetka jest węższa niż 62% pudełka, więc cień wychodzi za szeroki. Niezależne
  // skale X/Y + offsetY per sprite, żeby user mógł dostroić wizualnie, nie zgadywać ułamkiem.
  catShadowScaleX: number; catShadowScaleY: number; catShadowOffsetY: number;
  bossShadowScaleX: number; bossShadowScaleY: number; bossShadowOffsetY: number;
}

// Musi zgadzać się 1:1 z realnymi stałymi w app/boss-fight.tsx (PORTRAIT_SIZE=150,
// CAT_PORTRAIT_SIZE=205, oba offsetY sprite'ów=45, oba offsetY pasków HP=10, bg domyślne =
// GORSKILAS, cień bossa=0.62/0.18, cień kotka=0.45/0.13 — patrz CAT_SHADOW_SCALE_X/Y w
// boss-fight.tsx dla wyliczenia) — żeby otwarcie Edytora renderowało DOKŁADNIE to co widać w
// realnej walce, zero wizualnej różnicy, dopóki user czegoś nie ruszy.
//
// GDY ZMIENIASZ TĘ STAŁĄ (po każdym eksporcie z Edytora wklejonym do boss-fight.tsx) —
// ZBUMPUJ TEŻ `PERSIST_VERSION` niżej. Bez tego stary, już zapisany na urządzeniu draft
// (z poprzedniego eksportu) NIE dogania nowego defaultu sam — Edytor cicho pokazywałby
// nieaktualne liczby na starcie (2026-09-20/09-23, dwa niezależne zgłoszenia tego samego
// objawu: "Edytor otwiera się z innym layoutem niż realna arena").
export const BATTLE_LAYOUT_DEFAULT: BattleLayoutDraft = {
  bg: 'gorskislas',
  catSize: 205,
  bossSize: 150,
  catOffsetX: 0, catOffsetY: 45,
  bossOffsetX: 0, bossOffsetY: 45,
  catHpOffsetX: 0, catHpOffsetY: 10,
  bossHpOffsetX: 0, bossHpOffsetY: 10,
  catShadowScaleX: 0.45, catShadowScaleY: 0.13, catShadowOffsetY: 0,
  bossShadowScaleX: 0.62, bossShadowScaleY: 0.18, bossShadowOffsetY: 0,
};

interface BattleLayoutDraftState {
  draft: BattleLayoutDraft;
  set: (patch: Partial<BattleLayoutDraft>) => void;
  reset: () => void;
}

// ROOT CAUSE ustalony 2026-09-23 (user #7: "ten edytor dziwny i chyba nie jeden do jeden") —
// `BATTLE_LAYOUT_DEFAULT` bywał aktualizowany po każdym eksporcie z Edytora (ostatnio 09-18/
// 09-20), żeby DOGONIĆ realne stałe w boss-fight.tsx (patrz komentarz nad stałą wyżej). Ale
// zustand `persist` NIE nadpisuje sam z siebie już zapisanego na urządzeniu drafta nowym
// defaultem — jedynym ratunkiem był user PAMIĘTAJĄCY, żeby ręcznie wcisnąć "Reset" po każdej
// takiej zmianie (stary komentarz to nawet instruował). Nikt o tym nie pamięta — Edytor cicho
// pokazywał STARE liczby z poprzedniego eksportu, więc jego "podgląd 1:1" sam sobie zaprzeczał.
// Fix: `PERSIST_VERSION` + `migrate` — gdy ta stała rośnie (BUMPUJ JĄ przy KAŻDEJ zmianie
// `BATTLE_LAYOUT_DEFAULT`, czyli przy każdym ręcznym zsynchronizowaniu z boss-fight.tsx),
// zustand automatycznie PORZUCA przeterminowany persisted draft i startuje od świeżego
// defaultu — bez czekania aż user się zorientuje i wciśnie Reset sam.
const PERSIST_VERSION = 1;

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
      version: PERSIST_VERSION,
      migrate: () => ({ draft: BATTLE_LAYOUT_DEFAULT }),
      // Domyślny (shallow) merge zostawiałby stary, zapisany `draft` BEZ nowych pól cienia
      // jako `undefined` (merguje tylko klucze top-level stanu, nie zagnieżdżone pola
      // `draft`) — dopisanie defaultów tutaj sprawia, że stary zapis dostaje sensowne
      // wartości startowe dla pól, których jeszcze nie miał, zamiast NaN w SVG.
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<BattleLayoutDraftState> | undefined),
        draft: { ...BATTLE_LAYOUT_DEFAULT, ...(persisted as { draft?: Partial<BattleLayoutDraft> } | undefined)?.draft },
      }),
    },
  ),
);

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
//
// 2026-10-10 (user: "dawaj edytor lepszy pod każdego bosa możesz dać inny i pod kazde tlo inny
// i dodaj możliwość mi zmiany jasności tla... i modyfikacje typu Odbicie lustrzane i opcje
// cofnij") — rozszerzone z JEDNEGO globalnego draftu na: bazowy `draft` (fallback dla bossa bez
// własnego dostrojenia) + `perBoss` (pozycja/rozmiar/cień/odbicie NIEZALEŻNE per boss.id) +
// `perBg` (jasność/ściemnienie NIEZALEŻNE per tło) + stos `history` pod "Cofnij". Realna walka
// WCIĄŻ nie czyta nic z tego store'u (patrz komentarz w battle-layout-lab.tsx) — to dalej
// poligon do wypracowania liczb PRZED podpięciem per-boss pozycjonowania/teł do boss-fight.tsx,
// które dziś go nie ma (żaden z tych dwóch kroków nie jest zrobiony w TEJ zmianie).
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
  // Odbicie lustrzane (2026-10-10, user: "modyfikacje typu Odbicie lustrzane") — niektóre
  // boss/pupil grafiki mogą "patrzeć" w złą stronę względem przeciwnika; `scaleX:-1` na
  // wrapperze sprite'a w JSX (battle-layout-lab.tsx/boss-fight.tsx, gdy kiedyś podpięte).
  catFlipped: boolean;
  bossFlipped: boolean;
}

// Jasność/ściemnienie TŁA (2026-10-10, user: "dodaj możliwość mi zmiany jasności tla jakby lub
// ścinki czarnej pomiędzy") — jeden dodatkowy, czarny `View` absolutnie wypełniający scenę NAD
// tłem/gradientem/mgiełką, z regulowaną nieprzezroczystością (0 = bez zmian, wyżej = ciemniej).
// Osobna mapa per `ArenaBgKey`, nie pole `BattleLayoutDraft` — jasność to cecha KONKRETNEGO
// obrazka tła, nie konkretnego bossa (ten sam las może być użyty w wielu walkach).
export interface BgExtra {
  darken: number; // 0..0.85
}
export const BG_EXTRA_DEFAULT: BgExtra = { darken: 0 };

// Musi zgadzać się 1:1 z realnymi stałymi w app/boss-fight.tsx (PORTRAIT_SIZE=150,
// CAT_PORTRAIT_SIZE=205, oba offsetY sprite'ów=45, oba offsetY pasków HP=10, bg domyślne =
// GORSKILAS, cień bossa=0.62/0.18, cień kotka=0.45/0.13, bez odbicia — patrz
// CAT_SHADOW_SCALE_X/Y w boss-fight.tsx dla wyliczenia) — żeby otwarcie Edytora renderowało
// DOKŁADNIE to co widać w realnej walce, zero wizualnej różnicy, dopóki user czegoś nie ruszy
// (albo dopóki dany boss nie dostanie własnego wpisu w `perBoss` niżej).
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
  catFlipped: false, bossFlipped: false,
};

// Głębokość stosu "Cofnij" (2026-10-10) — snapshot CAŁEGO stanu (draft+perBoss+perBg) pchany
// PRZED każdą mutującą akcją (patrz `pushHistory` w `set`/`setBgExtra`/`reset`/`toggleFlip`
// niżej). Przeciąganie pcha JEDEN snapshot na GEST (na `onPanResponderGrant`, nie na każdy
// `onDrag`), inaczej jeden przeciąg generowałby dziesiątki nieużytecznych, jednopikselowych
// kroków cofania — patrz `Draggable`'s `onGrab` w battle-layout-lab.tsx.
const MAX_HISTORY = 40;

interface Snapshot {
  draft: BattleLayoutDraft;
  perBoss: Record<string, Partial<BattleLayoutDraft>>;
  perBg: Record<string, Partial<BgExtra>>;
}

interface BattleLayoutDraftState extends Snapshot {
  history: Snapshot[];
  // `set`/`setBgExtra` TERAZ kierują zapis do `perBoss[bossId]`/`perBg[bgKey]` (patcz łączony
  // na WIERZCHU `draft`/`BG_EXTRA_DEFAULT` przy odczycie — patrz `effectiveDraft`/
  // `effectiveBgExtra` w battle-layout-lab.tsx), nie do samego `draft` — każdy boss/tło dostaje
  // NIEZALEŻNY, osobno zapamiętany zestaw wartości.
  set: (bossId: string, patch: Partial<BattleLayoutDraft>) => void;
  setBgExtra: (bgKey: ArenaBgKey, patch: Partial<BgExtra>) => void;
  // Czysty push na stos cofania — ŚWIADOMIE nie dotyka `perBoss`/`perBg` (w odróżnieniu od
  // dawnego `set(bossId, {}, true)`, które jako SKUTEK UBOCZNY potrafiło stworzyć pusty wpis
  // `perBoss[bossId] = {}` przy samym dotknięciu bossa bez realnej zmiany — np. tap na
  // przeciąganym sprite bez ruchu palca — fałszywie oznaczając go jako "ma własny układ").
  // Wołane PRZED realną zmianą (Stepper's `onCommit`, `Draggable`'s `onGrab`, toggle odbicia).
  pushUndoSnapshot: () => void;
  // Które tło jest aktualnie OGLĄDANE w podglądzie — osobna akcja (zamiast component'u
  // sięgającego po `useBattleLayoutDraft.setState` wprost) TYLKO po to, żeby przełączenie tła
  // też trafiało na stos cofania tym samym, jednolitym mechanizmem co reszta akcji.
  setBg: (bg: ArenaBgKey) => void;
  reset: () => void;
  resetBoss: (bossId: string) => void;
  undo: () => void;
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
// 1→2 (2026-10-10) — schemat się zmienił (perBoss/perBg/catFlipped/bossFlipped), stary
// pojedynczy draft bez tych pól i tak nie da się sensownie zmigrować. (Komentarz tu błędnie
// mówił "2→3" aż do 2026-10-11 — sama liczba w kodzie była poprawna od razu, patrz commit
// ebdd716, tylko opisujący ją komentarz miał literówkę o jeden numer w przód.)
const PERSIST_VERSION = 2;

const snapshotOf = (s: Snapshot): Snapshot => ({
  draft: s.draft,
  perBoss: s.perBoss,
  perBg: s.perBg,
});

export const useBattleLayoutDraft = create<BattleLayoutDraftState>()(
  persist(
    (set, get) => ({
      draft: BATTLE_LAYOUT_DEFAULT,
      perBoss: {},
      perBg: {},
      history: [],
      set: (bossId, patch) => set((s) => ({
        perBoss: { ...s.perBoss, [bossId]: { ...s.perBoss[bossId], ...patch } },
      })),
      pushUndoSnapshot: () => set((s) => ({ history: [...s.history, snapshotOf(s)].slice(-MAX_HISTORY) })),
      setBgExtra: (bgKey, patch) => set((s) => ({
        history: [...s.history, snapshotOf(s)].slice(-MAX_HISTORY),
        perBg: { ...s.perBg, [bgKey]: { ...s.perBg[bgKey], ...patch } },
      })),
      setBg: (bg) => set((s) => ({
        history: [...s.history, snapshotOf(s)].slice(-MAX_HISTORY),
        draft: { ...s.draft, bg },
      })),
      reset: () => set((s) => ({
        history: [...s.history, snapshotOf(s)].slice(-MAX_HISTORY),
        draft: BATTLE_LAYOUT_DEFAULT, perBoss: {}, perBg: {},
      })),
      resetBoss: (bossId) => set((s) => {
        const perBoss = { ...s.perBoss };
        delete perBoss[bossId];
        return { history: [...s.history, snapshotOf(s)].slice(-MAX_HISTORY), perBoss };
      }),
      undo: () => {
        const { history } = get();
        if (history.length === 0) return;
        const prev = history[history.length - 1];
        set({ draft: prev.draft, perBoss: prev.perBoss, perBg: prev.perBg, history: history.slice(0, -1) });
      },
    }),
    {
      name: 'battle-layout-draft-v1',
      storage: throttledPersistStorage(),
      version: PERSIST_VERSION,
      migrate: () => ({ draft: BATTLE_LAYOUT_DEFAULT, perBoss: {}, perBg: {}, history: [] }),
      // Domyślny (shallow) merge zostawiałby stary, zapisany `draft` BEZ nowych pól cienia/
      // odbicia jako `undefined` (merguje tylko klucze top-level stanu, nie zagnieżdżone pola
      // `draft`) — dopisanie defaultów tutaj sprawia, że stary zapis dostaje sensowne wartości
      // startowe dla pól, których jeszcze nie miał, zamiast NaN/undefined w SVG. `history` NIE
      // jest persystowane (`perBoss`/`perBg` są, patrz state kształt wyżej) — nie ma sensu
      // odtwarzać stosu "Cofnij" z poprzedniej sesji, zaczyna się zawsze pusty.
      partialize: (s) => ({ draft: s.draft, perBoss: s.perBoss, perBg: s.perBg }),
      merge: (persisted, current) => {
        const p = persisted as Partial<Pick<BattleLayoutDraftState, 'draft' | 'perBoss' | 'perBg'>> | undefined;
        return {
          ...current,
          draft: { ...BATTLE_LAYOUT_DEFAULT, ...p?.draft },
          perBoss: p?.perBoss ?? {},
          perBg: p?.perBg ?? {},
        };
      },
    },
  ),
);

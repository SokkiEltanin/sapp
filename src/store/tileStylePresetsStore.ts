import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';

// Biblioteka presetów stylu (§370, user: "sprawdzaj te edytory... rob korelacje miedzy nimi
// biblioteki"). Ten sam wzorzec co `colorLibraryStore.ts` (§354) — JEDEN, wspólny store, ale
// tu preset to CAŁY obiekt stylu kafla (nie jeden hex), więc presety są podzielone na
// `family` (treść kafla różni się za dużo między typami żeby mieszać je w jednej liście —
// zapisany styl Serii nie ma sensu zaaplikowany do Odliczania). Trzy rodziny odpowiadają
// DOKŁADNIE tym typom kafli, które istnieją PO OBU STRONACH (Kreator — `dashboard-tile-
// creator.tsx` — ORAZ płótno — `CanvasComponentType` w `canvasComponentsStore.ts`): 'streak'
// (`StreakTileStyle`, identyczny typ w obu miejscach), 'countdown' (`CountdownTileStyle` na
// płótnie / `CountdownsTileStyle` w Kreatorze — różne typy, ale `layoutPreset` to ten sam
// `CountdownLayoutPreset`, a Kreator ma jedno dodatkowe pole `maxVisible` bez odpowiednika na
// płótnie), 'notes' (`NotesTileStyle` / `PinnedNotesTileStyle`, analogicznie). Rekordy i
// Liczniki (since) żyją TYLKO w Kreatorze (brak `CanvasComponentType` dla nich), dataField i
// kształty TYLKO na płótnie (brak zakładki w Kreatorze) — więc te pięć NIE dostają presetów,
// nie ma drugiej strony do korelacji.
//
// `style` jest przechowywany jako `Record<string, unknown>` (nie jeden konkretny typ) właśnie
// bo preset z Kreatora (z `maxVisible`) i z płótna (bez `maxVisible`) dla tej samej `family`
// mają nieco różne pola — `setDraft`/`onChange` w obu miejscach robią PARTIAL merge
// (`{...current, ...patch}`), więc brakujące pole po jednej stronie po prostu zostaje
// nietknięte, a nieznane dodatkowe pole po drugiej stronie to martwy, nieszkodliwy nadmiar
// (ten sam, świadomy wzorzec co `StreakTileStyle`'s pola "zostają w typie, nic się nie zeruje
// przy przełączaniu" — patrz komentarz tam). Zastosowanie presetu zawsze castuje przez
// `as Partial<KonkretnyTyp>` w miejscu wołania, ten sam, wielokrotnie użyty w tej sesji wzorzec
// co przy "TS union-spread" castach (§355/§363) — NIE przez discriminated union czy walidację
// w runtime.
export type StylePresetFamily = 'streak' | 'countdown' | 'notes';

export interface TileStylePreset {
  id: string;
  family: StylePresetFamily;
  name: string;
  style: Record<string, unknown>;
}

interface TileStylePresetsState {
  presets: TileStylePreset[];
  _hydrated: boolean;
  addPreset: (family: StylePresetFamily, name: string, style: Record<string, unknown>) => string;
  removePreset: (id: string) => void;
  renamePreset: (id: string, name: string) => void;
}

export const useTileStylePresetsStore = create<TileStylePresetsState>()(
  persist(
    (set) => ({
      presets: [],
      _hydrated: false,
      addPreset: (family, name, style) => {
        const id = `preset:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        set((s) => ({ presets: [...s.presets, { id, family, name, style }] }));
        return id;
      },
      removePreset: (id) => set((s) => ({ presets: s.presets.filter(p => p.id !== id) })),
      renamePreset: (id, name) => set((s) => ({
        presets: s.presets.map(p => (p.id === id ? { ...p, name } : p)),
      })),
    }),
    {
      name: 'tile-style-presets-v1',
      storage: throttledPersistStorage(),
      partialize: (s) => ({ presets: s.presets }),
      onRehydrateStorage: () => (state) => { if (state) state._hydrated = true; },
    },
  ),
);

// Czysty filtr wydzielony dla czytelności wywołań w UI (`useTileStylePresetsStore(st =>
// presetsForFamily(st.presets, family))`) — ten sam powód co inne małe, czyste helpery
// wydzielone tej sesji (testowalność + jeden punkt prawdy dla filtra).
export function presetsForFamily(presets: TileStylePreset[], family: StylePresetFamily): TileStylePreset[] {
  return presets.filter(p => p.family === family);
}

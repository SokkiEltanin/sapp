// Typ/default stylu kafla notatki na wolnym płótnie — system kopiowania komponentów, Faza 21
// (2026-10-17, §350), trzeci `componentType` po `streakTile`/`countdownTile`. Osobny od
// `PinnedNotesTileStyle` (dashboard, `pinnedNotesTileStyleStore.ts`) celowo — tamten ma
// `maxVisible` (lista wielu notatek w jednej karcie), tu instancja wiąże się z JEDNĄ, konkretną
// notatką po `id`, więc `maxVisible` nie ma zastosowania. Zero RN-importów (ta sama lekcja co
// §349 — `countdownTileStyleDefaults.ts`), żeby `canvasComponentsStore.ts` zostało testowalne.
// Warianty kształtu (Faza 31, 2026-10-17, §363) — NEXT_STEPS.md flagowało od §355: "Rekordy/
// Liczniki/Notatki dalej mają TYLKO suwaki liczbowe". `NotesTile` jest WSPÓLNY dla płótna I
// `PinnedNotesCard` (dashboard) — jeden typ/jeden komponent obsługuje OBA miejsca na raz (w
// przeciwieństwie do Liczników z §362, gdzie `SinceCountersTileStyle`/`PinnedNotesTileStyle`
// zostają OSOBNE typy jak dotąd — dublowanie `layoutPreset` tam, nie tutaj). 3 WŁASNE warianty
// dopasowane do kształtu notatki (tytuł+treść+tagi, nie liczba+próg jak liczniki/odliczania):
// `'row'` = dokładny dotychczasowy wygląd (default, ikona+kolumna tekstu w rzędzie). `'compact'`
// = jedna linijka "Tytuł — podgląd treści", bez ikony, najgęstszy. `'card'` = większy tytuł +
// dłuższy podgląd treści (4 linijki, nie 2) + tagi pod spodem, bez ikony — myślany pod SAMOTNĄ
// instancję na płótnie (wygląda jak osobna "karta notatki"), nie wiersz w liście.
export type NotesLayoutPreset = 'row' | 'compact' | 'card';

export interface NotesTileStyle {
  layoutPreset: NotesLayoutPreset;
  cornerRadius: number;
  showBody: boolean;
  showTags: boolean;
}

export const DEFAULT_NOTES_TILE_STYLE: NotesTileStyle = {
  layoutPreset: 'row',
  cornerRadius: 16,
  showBody: true,
  showTags: true,
};

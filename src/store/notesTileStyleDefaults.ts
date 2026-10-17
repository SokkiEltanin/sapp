// Typ/default stylu kafla notatki na wolnym płótnie — system kopiowania komponentów, Faza 21
// (2026-10-17, §350), trzeci `componentType` po `streakTile`/`countdownTile`. Osobny od
// `PinnedNotesTileStyle` (dashboard, `pinnedNotesTileStyleStore.ts`) celowo — tamten ma
// `maxVisible` (lista wielu notatek w jednej karcie), tu instancja wiąże się z JEDNĄ, konkretną
// notatką po `id`, więc `maxVisible` nie ma zastosowania. Zero RN-importów (ta sama lekcja co
// §349 — `countdownTileStyleDefaults.ts`), żeby `canvasComponentsStore.ts` zostało testowalne.
export interface NotesTileStyle {
  cornerRadius: number;
  showBody: boolean;
  showTags: boolean;
}

export const DEFAULT_NOTES_TILE_STYLE: NotesTileStyle = {
  cornerRadius: 16,
  showBody: true,
  showTags: true,
};

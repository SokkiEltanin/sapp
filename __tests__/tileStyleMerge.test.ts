import { mergeTileStyleState } from '@/store/tileStyleMerge';

// Reprodukcja realnego crasha usera (2026-10-17, zrzuty ekranu: "Coś się wykrzaczyło... Cannot
// convert undefined value to object" na dashboardzie i w Kreatorze kafelków) — persystowany
// `live`/`draft` z telefonu, zapisany ZANIM `tierColorOverrides`/`habitCalendarOverrides`
// istniały w `StreakTileStyle`, podmieniał cały świeży default zamiast scalić się z nim
// pole-po-polu. `mergeTileStyleState` to naprawia — ten test pilnuje, żeby się nie cofnęło.
describe('mergeTileStyleState', () => {
  const current = {
    live: { layoutPreset: 'classic', tierColorOverrides: {}, habitCalendarOverrides: {}, tileGap: 8 },
    draft: { layoutPreset: 'classic', tierColorOverrides: {}, habitCalendarOverrides: {}, tileGap: 8 },
    _hydrated: false,
  };

  it('backfills fields missing from stale persisted live/draft with current defaults', () => {
    const persisted = {
      live: { layoutPreset: 'ring', cornerRadius: 20 }, // brak tierColorOverrides/habitCalendarOverrides/tileGap
      draft: { layoutPreset: 'stripe' },
    };
    const merged = mergeTileStyleState(persisted, current);
    expect(merged.live.tierColorOverrides).toEqual({});
    expect(merged.live.habitCalendarOverrides).toEqual({});
    expect((merged.live as any).cornerRadius).toBe(20);
    expect(merged.live.layoutPreset).toBe('ring');
    expect(merged.draft.tierColorOverrides).toEqual({});
    expect(merged.draft.layoutPreset).toBe('stripe');
  });

  it('keeps persisted values when fields are present', () => {
    const persisted = {
      live: { layoutPreset: 'classic', tierColorOverrides: { 0: '#ABCDEF' }, habitCalendarOverrides: { h1: 'water' }, tileGap: 12 },
      draft: current.draft,
    };
    const merged = mergeTileStyleState(persisted, current);
    expect(merged.live.tierColorOverrides).toEqual({ 0: '#ABCDEF' });
    expect(merged.live.habitCalendarOverrides).toEqual({ h1: 'water' });
    expect(merged.live.tileGap).toBe(12);
  });

  it('falls back entirely to current defaults when nothing was persisted yet', () => {
    expect(mergeTileStyleState(undefined, current)).toEqual(current);
    expect(mergeTileStyleState(null, current)).toEqual(current);
    expect(mergeTileStyleState({}, current)).toEqual(current);
  });
});

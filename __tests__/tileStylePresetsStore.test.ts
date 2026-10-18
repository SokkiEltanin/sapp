import { useTileStylePresetsStore, presetsForFamily } from '@/store/tileStylePresetsStore';

// Biblioteka presetów stylu (§370). Testowane bezpośrednio na store (ten sam wzorzec co
// colorLibraryStore.test.ts) — AsyncStorage zmockowane globalnie w jest.setup.js.
beforeEach(() => {
  useTileStylePresetsStore.setState({ presets: [] });
});

describe('tileStylePresetsStore', () => {
  test('addPreset dodaje preset i zwraca jego id', () => {
    const id = useTileStylePresetsStore.getState().addPreset('streak', 'Moje serie', { layoutPreset: 'ring' });
    const presets = useTileStylePresetsStore.getState().presets;
    expect(presets).toHaveLength(1);
    expect(presets[0]).toEqual({ id, family: 'streak', name: 'Moje serie', style: { layoutPreset: 'ring' } });
  });

  test('removePreset usuwa tylko wskazany preset', () => {
    const id1 = useTileStylePresetsStore.getState().addPreset('streak', 'A', {});
    const id2 = useTileStylePresetsStore.getState().addPreset('notes', 'B', {});
    useTileStylePresetsStore.getState().removePreset(id1);
    const presets = useTileStylePresetsStore.getState().presets;
    expect(presets).toHaveLength(1);
    expect(presets[0].id).toBe(id2);
  });

  test('renamePreset zmienia tylko name, zostawia family/style/id', () => {
    const id = useTileStylePresetsStore.getState().addPreset('countdown', 'Stare', { ringSize: 64 });
    useTileStylePresetsStore.getState().renamePreset(id, 'Nowe');
    const p = useTileStylePresetsStore.getState().presets[0];
    expect(p.id).toBe(id);
    expect(p.family).toBe('countdown');
    expect(p.style).toEqual({ ringSize: 64 });
    expect(p.name).toBe('Nowe');
  });

  test('dwa dodania tego samego stylu NIE są deduplikowane — osobne wpisy', () => {
    useTileStylePresetsStore.getState().addPreset('notes', 'A', { layoutPreset: 'card' });
    useTileStylePresetsStore.getState().addPreset('notes', 'B', { layoutPreset: 'card' });
    expect(useTileStylePresetsStore.getState().presets).toHaveLength(2);
  });
});

describe('presetsForFamily', () => {
  test('filtruje presety po family, zostawia kolejność', () => {
    const all = [
      { id: '1', family: 'streak' as const, name: 'S1', style: {} },
      { id: '2', family: 'notes' as const, name: 'N1', style: {} },
      { id: '3', family: 'streak' as const, name: 'S2', style: {} },
    ];
    expect(presetsForFamily(all, 'streak').map(p => p.id)).toEqual(['1', '3']);
    expect(presetsForFamily(all, 'notes').map(p => p.id)).toEqual(['2']);
    expect(presetsForFamily(all, 'countdown')).toEqual([]);
  });
});

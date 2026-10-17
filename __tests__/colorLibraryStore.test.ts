import { useColorLibraryStore } from '@/store/colorLibraryStore';

// Biblioteka kolorów (Faza 23, 2026-10-17, §354) — user: "dodaj bibliotekę kolorów gdzi moge
// dodawac kolory". Testowane bezpośrednio na store (ten sam wzorzec co
// battleLayoutDraftStore.test.ts) — AsyncStorage zmockowane globalnie w jest.setup.js.
beforeEach(() => {
  useColorLibraryStore.setState({ colors: [] });
});

describe('colorLibraryStore', () => {
  test('addColor dodaje kolor i zwraca jego id', () => {
    const id = useColorLibraryStore.getState().addColor('#FF8800', 'Pomarańcz');
    const colors = useColorLibraryStore.getState().colors;
    expect(colors).toHaveLength(1);
    expect(colors[0]).toEqual({ id, hex: '#FF8800', name: 'Pomarańcz' });
  });

  test('addColor bez nazwy — pole name jest undefined, nie wymagane', () => {
    useColorLibraryStore.getState().addColor('#38BDF8');
    expect(useColorLibraryStore.getState().colors[0].name).toBeUndefined();
  });

  test('dwa dodania tego samego hex NIE są deduplikowane — osobne wpisy', () => {
    useColorLibraryStore.getState().addColor('#FF8800', 'A');
    useColorLibraryStore.getState().addColor('#FF8800', 'B');
    expect(useColorLibraryStore.getState().colors).toHaveLength(2);
  });

  test('removeColor usuwa tylko wskazany kolor', () => {
    const id1 = useColorLibraryStore.getState().addColor('#FF8800');
    const id2 = useColorLibraryStore.getState().addColor('#38BDF8');
    useColorLibraryStore.getState().removeColor(id1);
    const colors = useColorLibraryStore.getState().colors;
    expect(colors).toHaveLength(1);
    expect(colors[0].id).toBe(id2);
  });

  test('renameColor zmienia tylko name, zostawia hex/id', () => {
    const id = useColorLibraryStore.getState().addColor('#FF8800');
    useColorLibraryStore.getState().renameColor(id, 'Nowa nazwa');
    const c = useColorLibraryStore.getState().colors[0];
    expect(c.id).toBe(id);
    expect(c.hex).toBe('#FF8800');
    expect(c.name).toBe('Nowa nazwa');
  });
});

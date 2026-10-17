import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';

// Biblioteka kolorów (Faza 23, 2026-10-17, §354) — user: "dodaj bibliotekę kolorów gdzi moge
// dodawac kolory zeby miec do nich dostęp projektują inne kafelki". JEDEN, WSPÓLNY store dla
// WSZYSTKICH miejsc w kreatorze z wyborem koloru (paleta progów serii, akcent Rekordów, i
// cokolwiek dojdzie później) — kolor dodany przy stylowaniu jednego kafla jest od razu
// dostępny przy stylowaniu KAŻDEGO innego, bez osobnych, nie-komunikujących się ze sobą
// "biblioteczek" per typ kafla. `id` niezależne od `hex` (user może dodać ten sam hex dwa razy
// pod różną nazwą — świadomie nie deduplikowane, to jego wybór).
export interface LibraryColor { id: string; hex: string; name?: string }

interface ColorLibraryState {
  colors: LibraryColor[];
  _hydrated: boolean;
  addColor: (hex: string, name?: string) => string;
  removeColor: (id: string) => void;
  renameColor: (id: string, name: string) => void;
}

export const useColorLibraryStore = create<ColorLibraryState>()(
  persist(
    (set) => ({
      colors: [],
      _hydrated: false,
      addColor: (hex, name) => {
        const id = `color:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        set((s) => ({ colors: [...s.colors, { id, hex, name }] }));
        return id;
      },
      removeColor: (id) => set((s) => ({ colors: s.colors.filter(c => c.id !== id) })),
      renameColor: (id, name) => set((s) => ({
        colors: s.colors.map(c => c.id === id ? { ...c, name } : c),
      })),
    }),
    {
      name: 'color-library-v1',
      storage: throttledPersistStorage(),
      partialize: (s) => ({ colors: s.colors }),
      onRehydrateStorage: () => (state) => { if (state) state._hydrated = true; },
    },
  ),
);

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';
import { ExerciseLogEntry } from '@/utils/personalQuests';

// Log ćwiczeń (2026-10-14) — fundament pod nowy ekran "Ćwiczenia" w Zdrowiu, patrz obszerny
// komentarz w personalQuests.ts przy `ExerciseLogEntry`. Osobny, lekki store (nie dokładane do
// petStore.ts, który już jest ogromny i współdzielony z walką/gearem/streakami — ten sam powód
// co `profileStore.ts` dostał własny plik) — append-only log, bez limitu historii (ten sam
// wzorzec co `moodStore`/`foodStore`, nie `petStore`'s pojedyncze "dzień ostatniego zrobienia").
const todayISO = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

interface ExercisesState {
  logs: ExerciseLogEntry[];
  _hydrated: boolean;
  // `exercise: string` (nie `TrainingExercise`) — patrz komentarz przy `ExerciseLogEntry` w
  // personalQuests.ts (2026-10-14, poszerzone pod dowolne nazwy ćwiczeń z buildera planów).
  addLog: (exercise: string, amount: number, date?: string) => void;
  removeLog: (id: string) => void;
  // Edycja wpisu (2026-10-14, user: "nawet nie mają edycji klikną źle i pizda") — do tej pory
  // jedyna droga poprawienia pomyłki była `removeLog` + ponowne wpisanie, bez UI które by to
  // w ogóle umożliwiało (martwa akcja store'u, nigdzie nie wołana). `updateLog` dokłada
  // możliwość poprawienia SAMEJ ILOŚCI bez usuwania i tworzenia nowego wpisu (zachowuje
  // oryginalny `createdAt`, więc kolejność historii dnia się nie zmienia).
  updateLog: (id: string, amount: number) => void;
}

export const useExercisesStore = create<ExercisesState>()(
  persist(
    (set) => ({
      logs: [],
      _hydrated: false,
      addLog: (exercise, amount, date) => set((s) => ({
        logs: [...s.logs, {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          exercise, amount, date: date ?? todayISO(), createdAt: new Date().toISOString(),
        }],
      })),
      removeLog: (id) => set((s) => ({ logs: s.logs.filter((l) => l.id !== id) })),
      updateLog: (id, amount) => set((s) => ({
        logs: s.logs.map((l) => (l.id === id ? { ...l, amount } : l)),
      })),
    }),
    {
      name: 'exercises-v1',
      storage: throttledPersistStorage(),
      onRehydrateStorage: () => (state) => { if (state) state._hydrated = true; },
    },
  ),
);

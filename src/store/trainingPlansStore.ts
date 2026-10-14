import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';
import { TrainingPlan, TrainingPlanItem, genId } from '@/utils/trainingPlans';

// Store planów treningowych (2026-10-14) — osobny plik, ten sam powód co `exercisesStore.ts`
// (nie dokładać do petStore.ts). Kopiowanie planu NIE jest osobną akcją store'u — ten sam
// wzorzec co `MealPreset` w foodStore.ts (grep potwierdza: brak `duplicatePreset`, kopiowanie
// dzieje się na poziomie ekranu, `app/training-plan-builder.tsx?dupId=<id>` ładuje pozycje do
// draftu z wyczyszczonym id i nazwą "(kopia)", `addPlan` przy zapisie tworzy nowy byt) — jedna
// spójna konwencja kopiowania w całej apce, nie druga obok.
interface TrainingPlansState {
  plans: TrainingPlan[];
  _hydrated: boolean;
  addPlan: (name: string, items: TrainingPlanItem[]) => void;
  updatePlan: (id: string, name: string, items: TrainingPlanItem[]) => void;
  removePlan: (id: string) => void;
}

export const useTrainingPlansStore = create<TrainingPlansState>()(
  persist(
    (set) => ({
      plans: [],
      _hydrated: false,
      addPlan: (name, items) => set((s) => ({
        plans: [...s.plans, { id: genId(), name, items, createdAt: new Date().toISOString() }],
      })),
      updatePlan: (id, name, items) => set((s) => ({
        plans: s.plans.map((p) => (p.id === id ? { ...p, name, items } : p)),
      })),
      removePlan: (id) => set((s) => ({ plans: s.plans.filter((p) => p.id !== id) })),
    }),
    {
      name: 'training-plans-v1',
      storage: throttledPersistStorage(),
      onRehydrateStorage: () => (state) => { if (state) state._hydrated = true; },
    },
  ),
);

import { create } from 'zustand';

interface UiActionsState {
  tasksSortTrigger: number;
  triggerTasksSort: () => void;
  workPanelOpen: boolean;         // single source of truth — dashboard modal reads this
  openWorkPanel: () => void;
  setWorkPanelOpen: (v: boolean) => void;
  paydayTrigger: number;          // bump → dashboard opens the "add paycheck" modal
  openPaydayPrompt: () => void;
}

export const useUiActions = create<UiActionsState>((set) => ({
  tasksSortTrigger: 0,
  triggerTasksSort: () => set(s => ({ tasksSortTrigger: s.tasksSortTrigger + 1 })),
  // Boolean (nie licznik-trigger) → otwarcie jest idempotentne: brak wyścigu efektu,
  // który potrafił otworzyć panel dwa razy.
  workPanelOpen: false,
  openWorkPanel: () => set({ workPanelOpen: true }),
  setWorkPanelOpen: (v) => set({ workPanelOpen: v }),
  paydayTrigger: 0,
  openPaydayPrompt: () => set(s => ({ paydayTrigger: s.paydayTrigger + 1 })),
}));

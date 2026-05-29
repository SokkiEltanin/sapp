import { create } from 'zustand';

interface UiActionsState {
  tasksSortTrigger: number;
  triggerTasksSort: () => void;
}

export const useUiActions = create<UiActionsState>((set) => ({
  tasksSortTrigger: 0,
  triggerTasksSort: () => set(s => ({ tasksSortTrigger: s.tasksSortTrigger + 1 })),
}));

import { create } from 'zustand';

interface UiActionsState {
  tasksSortTrigger: number;
  triggerTasksSort: () => void;
  workPanelTrigger: number;   // bump → dashboard opens the work panel
  openWorkPanel: () => void;
}

export const useUiActions = create<UiActionsState>((set) => ({
  tasksSortTrigger: 0,
  triggerTasksSort: () => set(s => ({ tasksSortTrigger: s.tasksSortTrigger + 1 })),
  workPanelTrigger: 0,
  openWorkPanel: () => set(s => ({ workPanelTrigger: s.workPanelTrigger + 1 })),
}));

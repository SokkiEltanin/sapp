import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';

export interface CampaignMapStyle {
  nodeSize: number;
  pathWidth: number;
  ringWidth: number;
  gridOpacity: number;
  popupRadius: number;
}

// Odtwarza dokładnie dotychczasowy, zaszyty na sztywno wygląd CampaignMap.tsx (`NODE=60`,
// strokeWidth=7 na ścieżce, currentRing borderWidth=2.5, siatka tła rgba(255,255,255,0.08),
// popup borderRadius=radius.lg=16) — bez wdrożenia nic się wizualnie nie zmienia.
export const DEFAULT_CAMPAIGN_MAP_STYLE: CampaignMapStyle = {
  nodeSize: 60,
  pathWidth: 7,
  ringWidth: 2.5,
  gridOpacity: 0.08,
  popupRadius: 16,
};

// Kreator ekranów — Faza 6 (2026-10-15, ARCHITECTURE.md §332), PIERWSZY ekran poza
// dashboardem (user: "nie chce budować samych kafelków tylko wszystko ekrany itp" — ten sam
// mechanizm, drugi obszar appki). Mapa bossów wybrana jako cel: najdojrzalszy, najbardziej
// dopracowany ekran tej sesji (§314→§326, siedem rund poprawek), już ma infrastrukturę
// edytora POZYCJI węzłów (`bossMapLayoutStore.ts`, §322) — kreator STYLU to naturalne
// rozszerzenie, nie nowy obszar od zera. ŚWIADOMIE bez koloru akcentu (różnica niebieski/
// czerwony kampania/MAD jest semantyczna — "oszalały wariant" = niebezpieczeństwo — nadpisanie
// jednym wspólnym kolorem zgubiłoby to rozróżnienie, ta sama zasada co przy kolorze progu serii
// w §330).
interface CampaignMapStyleState {
  live: CampaignMapStyle;
  draft: CampaignMapStyle;
  _hydrated: boolean;
  setDraft: (patch: Partial<CampaignMapStyle>) => void;
  publish: () => void;
  discardDraft: () => void;
  resetDraftToDefault: () => void;
}

export const useCampaignMapStyleStore = create<CampaignMapStyleState>()(
  persist(
    (set, get) => ({
      live: DEFAULT_CAMPAIGN_MAP_STYLE,
      draft: DEFAULT_CAMPAIGN_MAP_STYLE,
      _hydrated: false,
      setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
      publish: () => set((s) => ({ live: s.draft })),
      discardDraft: () => set((s) => ({ draft: s.live })),
      resetDraftToDefault: () => set({ draft: DEFAULT_CAMPAIGN_MAP_STYLE }),
    }),
    {
      name: 'campaign-map-style-v1',
      storage: throttledPersistStorage(),
      onRehydrateStorage: () => (state) => { if (state) state._hydrated = true; },
    },
  ),
);

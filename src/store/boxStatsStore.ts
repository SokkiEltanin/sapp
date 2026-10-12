import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';
import { BoxId } from '@/utils/petBoxes';

// Log otwarć skrzynek Rynku, CAŁKOWICIE lokalny (2026-09-15) — user: "niech mi tez da
// statystyki tam otwierania skrzynek (procentowe, zysk,strata itp itd zeby balansować
// trochę pozniej... ale to nic nie zmieniaj ja pootwieram ze statystykami podzielonym
// per skrzynka zeby wiedzieć jak balansować nie q ciemno". Czysto addytywna
// instrumentacja — ŻADNA wartość ekonomii w petBoxes.ts (koszt/szanse/zakresy monet) się
// tu nie zmienia, ten store tylko OBSERWUJE wyniki `rollBox()` z dwóch istniejących
// miejsc wywołania (`onBuyBox` w pet-shop.tsx, `onDailyBox` w pet.tsx). Ten sam capped-log
// wzorzec co `usageStatsStore.events`/`bankQueueStore.history` — cap 3000, nie rośnie bez
// końca. `daily: true` odróżnia darmową Skrzynkę dnia (cost 0, ten sam `BoxId: 'sardine'`
// co płatna Drewniana skrzynka!) od płatnych otwarć — inaczej ich zysk/strata i statystyki
// per-skrzynka by się myliły pod tym samym kluczem.
export interface BoxOpenEvent {
  at: number; // Date.now()
  boxId: BoxId;
  daily: boolean; // true = darmowa Skrzynka dnia (DAILY_BOX), false = kupiona z LOOT_BOXES
  cost: number; // monety zapłacone (0 dla daily)
  rewardType: 'coins' | 'gear' | 'combatItem';
  coins?: number; // gdy rewardType === 'coins'
  rarity?: string; // coins/combatItem: CrateTier; gear: GearRarity
  // `itemId` (2026-10-12, user: "musze widzieć czy skrzynka jest opłacalna jak kupię za 35 a
  // dropnę item wart 69 to jestem na plusie") — gdy rewardType === 'gear', pozwala
  // `computeBoxStats` policzyć POTENCJALNĄ wartość dropu (`gearSellValue(gearById(itemId),
  // rarity)`, ta sama cena co przycisk "Sprzedaj" na odsłonie) zamiast liczyć go jako zero w
  // bilansie — dotąd ekwipunek w ogóle nie wchodził do "zysk/strata", tylko surowe nagrody
  // monetowe, więc bilans wyglądał na stratę nawet przy dropach wartych więcej niż koszt.
  itemId?: string;
}

const EVENTS_MAX = 3000;

interface BoxStatsState {
  events: BoxOpenEvent[];
  recordOpen: (e: BoxOpenEvent) => void;
  reset: () => void;
}

export const useBoxStats = create<BoxStatsState>()(
  persist(
    (set) => ({
      events: [],
      recordOpen: (e) => set((state) => ({ events: [...state.events, e].slice(-EVENTS_MAX) })),
      reset: () => set({ events: [] }),
    }),
    {
      name: 'box-stats-v1',
      storage: throttledPersistStorage(),
    },
  ),
);

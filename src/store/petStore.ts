import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// The companion blob's PERSISTED state: identity, growth (xp), the coin wallet,
// owned/equipped cosmetics and which quest milestones have already paid out. Its
// live mood/needs are DERIVED from your real self-care data (see petState.ts) and
// are not stored here.

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface PetState {
  name: string;
  createdAt: string;            // ISO
  xp: number;                   // drives level/growth
  coins: number;                // spent in the shop
  lastCareTick: string | null;  // YYYY-MM-DD — one passive care-XP grant per day
  ownedItems: string[];         // cosmetic ids owned
  equipped: Record<string, string>; // slot → itemId (e.g. { hat: 'hat_party' })
  claimedQuests: string[];      // milestone tier ids already rewarded (one-time)
  dailyClaims: Record<string, string>; // dailyQuestId → YYYY-MM-DD last claimed
  _hydrated: boolean;

  setName: (name: string) => void;
  addXp: (n: number) => void;
  addCoins: (n: number) => void;
  spendCoins: (n: number) => boolean;   // false if not enough
  buyItem: (id: string, cost: number) => boolean;
  equip: (slot: string, id: string | null) => void;
  claimQuest: (id: string, coins: number, xp: number) => void;       // milestone (one-time)
  claimDaily: (id: string, coins: number, xp: number) => boolean;    // daily (once/day)
  careTick: (xp: number) => void;        // once/day passive growth from good care
  reset: () => void;
}

export const usePetStore = create<PetState>()(
  persist(
    (set, get) => ({
      name: 'Blobek',
      createdAt: new Date().toISOString(),
      xp: 0,
      coins: 0,
      lastCareTick: null,
      ownedItems: [],
      equipped: {},
      claimedQuests: [],
      dailyClaims: {},
      _hydrated: false,

      setName: (name) => set({ name: name.trim() || 'Blobek' }),
      addXp: (n) => set((s) => ({ xp: Math.max(0, s.xp + n) })),
      addCoins: (n) => set((s) => ({ coins: Math.max(0, s.coins + n) })),
      spendCoins: (n) => {
        if (get().coins < n) return false;
        set((s) => ({ coins: s.coins - n }));
        return true;
      },
      buyItem: (id, cost) => {
        const s = get();
        if (s.ownedItems.includes(id)) return true;
        if (s.coins < cost) return false;
        set({ coins: s.coins - cost, ownedItems: [...s.ownedItems, id] });
        return true;
      },
      equip: (slot, id) => set((s) => {
        const eq = { ...s.equipped };
        if (id == null) delete eq[slot]; else eq[slot] = id;
        return { equipped: eq };
      }),
      claimQuest: (id, coins, xp) => set((s) => s.claimedQuests.includes(id) ? s : ({
        claimedQuests: [...s.claimedQuests, id],
        coins: s.coins + coins,
        xp: s.xp + xp,
      })),
      claimDaily: (id, coins, xp) => {
        const t = todayISO();
        if (get().dailyClaims[id] === t) return false;
        set((s) => ({ dailyClaims: { ...s.dailyClaims, [id]: t }, coins: s.coins + coins, xp: s.xp + xp }));
        return true;
      },
      careTick: (xp) => {
        const t = todayISO();
        if (get().lastCareTick === t) return;
        set((s) => ({ xp: s.xp + xp, lastCareTick: t }));
      },
      reset: () => set({ xp: 0, coins: 0, lastCareTick: null, ownedItems: [], equipped: {}, claimedQuests: [], dailyClaims: {} }),
    }),
    {
      name: 'pet-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        name: s.name, createdAt: s.createdAt, xp: s.xp, coins: s.coins,
        lastCareTick: s.lastCareTick, ownedItems: s.ownedItems, equipped: s.equipped,
        claimedQuests: s.claimedQuests, dailyClaims: s.dailyClaims,
      }),
      onRehydrateStorage: () => (state) => { if (state) state._hydrated = true; },
    },
  ),
);

// ─── Level / growth from xp ─────────────────────────────────────────────────────
// Gentle curve: each level costs a bit more. Growth stage drives the blob's size
// and features on the pet page.
export function levelFromXp(xp: number): { level: number; inLevel: number; needed: number; progress: number } {
  let level = 1, need = 100, acc = 0;
  while (xp >= acc + need) { acc += need; level++; need = 100 + (level - 1) * 40; }
  const inLevel = xp - acc;
  return { level, inLevel, needed: need, progress: need > 0 ? inLevel / need : 0 };
}

export type GrowthStage = 'baby' | 'kid' | 'teen' | 'adult';
export function growthStage(level: number): GrowthStage {
  if (level >= 12) return 'adult';
  if (level >= 6) return 'teen';
  if (level >= 3) return 'kid';
  return 'baby';
}

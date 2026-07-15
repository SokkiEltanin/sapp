import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { weekKeyOf } from '@/utils/quests';
import { rollCrate, CrateTier } from '@/utils/crates';

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
  roomAddons: Record<string, string[]>; // roomId → active add-on ids (extra scene elements)
  claimedQuests: string[];      // milestone tier ids already rewarded (one-time)
  dailyClaims: Record<string, string>; // dailyQuestId → YYYY-MM-DD last claimed
  weeklyClaims: Record<string, string>; // weeklyQuestId → week key (Monday) claimed
  monthlyClaims: Record<string, string>; // monthlyQuestId → YYYY-MM claimed
  // ── petting / affection (fills as you tap the cat; resets daily) ──
  affection: number;            // 0..100 for today
  affectionDay: string | null;  // day the current affection belongs to
  affectionRewardDay: string | null; // day the "full affection" bonus was paid
  pendingCrates: number;        // unopened sardine crates earned from full affection
  // ── boss battles ──
  energy: number;               // banked attack energy
  energyDate: string | null;    // day the top-up counter belongs to
  energyToday: number;          // energy already granted today (for daily top-up)
  defeatedBosses: string[];
  bossHp: Record<string, number>; // bossId → remaining hp (absent = full)
  _hydrated: boolean;

  setName: (name: string) => void;
  addXp: (n: number) => void;
  addCoins: (n: number) => void;
  spendCoins: (n: number) => boolean;   // false if not enough
  buyItem: (id: string, cost: number) => boolean;
  equip: (slot: string, id: string | null) => void;
  buyRoomAddon: (roomId: string, id: string, cost: number) => boolean; // false if not enough coins
  toggleRoomAddon: (roomId: string, id: string) => void;               // owned add-on on/off in a room
  claimQuest: (id: string, coins: number, xp: number) => void;       // milestone (one-time)
  claimDaily: (id: string, coins: number, xp: number) => boolean;    // daily (once/day)
  claimDailyFor: (id: string, date: string, coins: number, xp: number) => boolean; // catch-up claim for a past day
  claimWeekly: (id: string, coins: number, xp: number) => boolean;   // weekly (once/week)
  claimMonthly: (id: string, coins: number, xp: number) => boolean;  // monthly (once/month)
  careTick: (xp: number) => void;        // once/day passive growth from good care
  petCat: (inc: number) => { value: number; justFull: boolean }; // tap-to-pet; full bar → a crate
  openCrate: () => { tier: CrateTier; coins: number } | null;    // open one pending crate
  // boss battles
  syncEnergy: (todayEnergy: number, mult: number) => void;  // top up the bank from today's self-care
  attackBoss: (bossId: string, maxHp: number, damage: number, dodge: number) => { remaining: number; defeated: boolean };
  defeatBoss: (bossId: string, lootId: string, coins: number, xp: number) => void;
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
      roomAddons: {},
      equipped: {},
      claimedQuests: [],
      dailyClaims: {},
      weeklyClaims: {},
      monthlyClaims: {},
      affection: 0,
      affectionDay: null,
      affectionRewardDay: null,
      pendingCrates: 0,
      energy: 0,
      energyDate: null,
      energyToday: 0,
      defeatedBosses: [],
      bossHp: {},
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
      // Buy a room add-on: pay once, own it (in ownedItems) AND switch it on in that
      // room. Re-buying an owned add-on is free and just turns it back on.
      buyRoomAddon: (roomId, id, cost) => {
        const s = get();
        const active = s.roomAddons[roomId] ?? [];
        if (active.includes(id)) return true;
        const owns = s.ownedItems.includes(id);
        if (!owns && s.coins < cost) return false;
        set({
          coins: owns ? s.coins : s.coins - cost,
          ownedItems: owns ? s.ownedItems : [...s.ownedItems, id],
          roomAddons: { ...s.roomAddons, [roomId]: [...active, id] },
        });
        return true;
      },
      toggleRoomAddon: (roomId, id) => set((s) => {
        const active = s.roomAddons[roomId] ?? [];
        const next = active.includes(id) ? active.filter(x => x !== id) : [...active, id];
        return { roomAddons: { ...s.roomAddons, [roomId]: next } };
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
      // Claim a daily for a PAST date (the "nieodebrane z wczoraj" catch-up). Same
      // once-per-day guard, just keyed to that date instead of today.
      claimDailyFor: (id, date, coins, xp) => {
        if (get().dailyClaims[id] === date) return false;
        set((s) => ({ dailyClaims: { ...s.dailyClaims, [id]: date }, coins: s.coins + coins, xp: s.xp + xp }));
        return true;
      },
      claimWeekly: (id, coins, xp) => {
        const w = weekKeyOf();
        if (get().weeklyClaims[id] === w) return false;
        set((s) => ({ weeklyClaims: { ...s.weeklyClaims, [id]: w }, coins: s.coins + coins, xp: s.xp + xp }));
        return true;
      },
      claimMonthly: (id, coins, xp) => {
        const m = todayISO().slice(0, 7);
        if (get().monthlyClaims[id] === m) return false;
        set((s) => ({ monthlyClaims: { ...s.monthlyClaims, [id]: m }, coins: s.coins + coins, xp: s.xp + xp }));
        return true;
      },
      careTick: (xp) => {
        const t = todayISO();
        if (get().lastCareTick === t) return;
        set((s) => ({ xp: s.xp + xp, lastCareTick: t }));
      },
      // Tap-to-pet: fills the daily affection bar; the first time it hits 100 today
      // it grants a sardine crate to open (+ a little XP). Returns the new value +
      // whether the crate just dropped.
      petCat: (inc) => {
        const t = todayISO();
        const s = get();
        const base = s.affectionDay === t ? s.affection : 0; // reset on a new day
        const value = Math.min(100, base + inc);
        const justFull = value >= 100 && s.affectionRewardDay !== t;
        set({
          affection: value,
          affectionDay: t,
          ...(justFull ? { affectionRewardDay: t, xp: s.xp + 8, pendingCrates: (s.pendingCrates ?? 0) + 1 } : {}),
        });
        return { value, justFull };
      },
      openCrate: () => {
        const s = get();
        if ((s.pendingCrates ?? 0) <= 0) return null;
        const roll = rollCrate();
        set({ pendingCrates: s.pendingCrates - 1, coins: s.coins + roll.coins });
        return roll;
      },
      // Top up the energy bank with today's self-care output (once per amount, tops
      // up as the day's data grows). energyMult from loot boosts the gain.
      syncEnergy: (todayEnergy, mult) => {
        const t = todayISO();
        const s = get();
        const grantedToday = s.energyDate === t ? s.energyToday : 0;
        const target = Math.round(todayEnergy * (1 + mult));
        const delta = target - grantedToday;
        if (delta <= 0 && s.energyDate === t) return;
        set({
          energy: s.energy + Math.max(0, delta),
          energyDate: t,
          energyToday: Math.max(grantedToday, target),
        });
      },
      attackBoss: (bossId, maxHp, damage, dodge) => {
        const s = get();
        const cur = s.bossHp[bossId] ?? maxHp;
        let remaining = Math.max(0, cur - damage);
        const defeated = remaining <= 0;
        // spend all banked energy on the hit; if the boss survives it may regen a
        // little (dodge from loot reduces that comeback).
        if (!defeated) {
          const regen = Math.round(maxHp * 0.04 * (1 - Math.min(0.9, dodge)));
          remaining = Math.min(maxHp, remaining + regen);
        }
        set({ energy: 0, bossHp: { ...s.bossHp, [bossId]: remaining } });
        return { remaining, defeated };
      },
      defeatBoss: (bossId, lootId, coins, xp) => set((s) => s.defeatedBosses.includes(bossId) ? s : ({
        defeatedBosses: [...s.defeatedBosses, bossId],
        ownedItems: s.ownedItems.includes(lootId) ? s.ownedItems : [...s.ownedItems, lootId],
        coins: s.coins + coins,
        xp: s.xp + xp,
      })),
      reset: () => set({ xp: 0, coins: 0, lastCareTick: null, ownedItems: [], equipped: {}, roomAddons: {}, claimedQuests: [], dailyClaims: {}, weeklyClaims: {}, monthlyClaims: {}, affection: 0, affectionDay: null, affectionRewardDay: null, pendingCrates: 0, energy: 0, energyDate: null, energyToday: 0, defeatedBosses: [], bossHp: {} }),
    }),
    {
      name: 'pet-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        name: s.name, createdAt: s.createdAt, xp: s.xp, coins: s.coins,
        lastCareTick: s.lastCareTick, ownedItems: s.ownedItems, equipped: s.equipped, roomAddons: s.roomAddons,
        claimedQuests: s.claimedQuests, dailyClaims: s.dailyClaims, weeklyClaims: s.weeklyClaims, monthlyClaims: s.monthlyClaims,
        affection: s.affection, affectionDay: s.affectionDay, affectionRewardDay: s.affectionRewardDay, pendingCrates: s.pendingCrates,
        energy: s.energy, energyDate: s.energyDate, energyToday: s.energyToday,
        defeatedBosses: s.defeatedBosses, bossHp: s.bossHp,
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

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
function yesterdayISO(): string {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Rosnący bonus monet za kolejne dni z rzędu (cap na 7. dniu). Nowe źródło monet obok
// skrzynki dnia / questów / głaskania.
export function loginBonusCoins(streak: number): number {
  const table = [0, 3, 4, 6, 8, 10, 12, 15];
  return table[Math.min(Math.max(1, streak), 7)];
}

interface PetState {
  name: string;
  createdAt: string;            // ISO
  xp: number;                   // drives level/growth
  coins: number;                // spent in the shop
  lastCareTick: string | null;  // YYYY-MM-DD — one passive care-XP grant per day
  ownedItems: string[];         // owned ids — now just coat colours + 'stripes'
  // Rooms / hats / glasses / collars / held items were all removed; the shop only sells
  // the coat colour and the tail stripes now. `equipped`/`roomAddons` stay ONLY so old
  // persisted state still parses — nothing reads them.
  equipped: Record<string, string>;
  roomAddons: Record<string, string[]>;
  catColor: string;             // palette id from catPalettes
  catStripes: boolean;          // tail stripes on/off
  catEyeColor: string;          // hex koloru oczu; '' = domyślny (PUPIL)
  catNoseColor: string;         // hex koloru noska; '' = domyślny (p.ink)
  catWhiskers: boolean;         // wąsy on/off
  catLegStripes: boolean;       // pręgi na łapkach on/off
  equippedStartup: string;      // id kosmetyku ekranu ładowania (splash); 'default' = darmowy
  // ── login streak (bonus monet za kolejne dni z rzędu) ──
  loginStreak: number;          // dni z rzędu z otwarciem apki
  lastLoginDay: string | null;  // YYYY-MM-DD ostatniego dnia z bonusem
  loginBonusDay: string | null; // YYYY-MM-DD dnia w którym bonus już przyznano
  claimedQuests: string[];      // milestone tier ids already rewarded (one-time)
  dailyClaims: Record<string, string>; // dailyQuestId → YYYY-MM-DD last claimed
  // dailyClaims can only remember ONE date per quest, so claiming yesterday's catch-up
  // and today's quest kept overwriting each other — each claim made the other look
  // unclaimed again, and the pair could be farmed forever. dayClaims is the real record:
  // one key per (quest, day), `${id}:${YYYY-MM-DD}` → true. Nothing can clobber it.
  dayClaims: Record<string, true>;
  weeklyClaims: Record<string, string>; // weeklyQuestId → week key (Monday) claimed
  monthlyClaims: Record<string, string>; // monthlyQuestId → YYYY-MM claimed
  // ── petting / affection (fills as you tap the cat; resets daily) ──
  affection: number;            // 0..100 for today
  affectionDay: string | null;  // day the current affection belongs to
  affectionRewardDay: string | null; // day the "full affection" bonus was paid
  pendingCrates: number;        // unopened sardine crates earned from full affection
  // ── boss battles ──
  energy: number;               // banked attack energy (kampania bossów)
  energyDate: string | null;    // day the top-up counter belongs to
  energyToday: number;          // energy already granted today (for daily top-up)
  defeatedBosses: string[];
  bossHp: Record<string, number>; // bossId → remaining hp (absent = full)
  // ── raid tygodniowy ──
  // WŁASNA pula energii — atak bossa i atak raidu NIE dzielą jednego zasobu (dawniej
  // dzieliły `energy`, więc trzeba było wybierać, w co uderzyć). Zasilana tym samym
  // wzorem co energia bossa (ta sama codzienna samo-opieka napędza obie), ale osobno.
  raidEnergy: number;
  raidEnergyDate: string | null;
  raidEnergyToday: number;
  raidWeek: string | null;      // klucz tygodnia, dla którego raidHp jest aktualne
  raidHp: number;               // pozostałe HP raidu tego tygodnia
  raidWon: string[];            // klucze tygodni pokonanych (kolekcjonerskie medale)
  _hydrated: boolean;

  setName: (name: string) => void;
  addXp: (n: number) => void;
  addCoins: (n: number) => void;
  spendCoins: (n: number) => boolean;   // false if not enough
  buyItem: (id: string, cost: number) => boolean;
  buyColor: (id: string, cost: number) => boolean;  // false if not enough coins
  setColor: (id: string) => void;
  buyStripes: (cost: number) => boolean;            // buys, or toggles once owned
  buyEyeColor: (id: string, hex: string, cost: number) => boolean; // kolor oczu: kup+ustaw / ustaw jeśli masz
  buyNoseColor: (id: string, hex: string, cost: number) => boolean; // kolor noska: kup+ustaw / ustaw jeśli masz
  buyWhiskers: (cost: number) => boolean;           // wąsy: buys, or toggles once owned
  buyLegStripes: (cost: number) => boolean;         // pręgi na łapkach: buys, or toggles once owned
  buyStartup: (id: string, cost: number) => boolean; // splash cosmetic: buy+equip, or just equip if owned
  grantStartup: (id: string) => void;               // gacha: own a splash cosmetic for free + wear it
  claimDailyBox: () => boolean;                     // free daily chest: marks today claimed (false if already)
  registerLogin: () => { streak: number; coins: number } | null; // once/day login-streak coin bonus
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
  syncRaidEnergy: (todayEnergy: number, mult: number) => void; // jak syncEnergy, ale osobna pula raidu
  attackBoss: (bossId: string, maxHp: number, damage: number, dodge: number) => { remaining: number; defeated: boolean };
  defeatBoss: (bossId: string, lootId: string, coins: number, xp: number) => void;
  healBoss: (bossId: string, amount: number, maxHp: number) => void;   // mechanika: boss leczy się gdy go zaniedbasz
  raidEnsure: (weekKey: string, hp: number) => void;                   // ustaw HP raidu na nowy tydzień (raz)
  raidAttack: (damage: number) => { remaining: number; defeated: boolean };
  raidClaim: (weekKey: string, coins: number, xp: number) => void;     // pokonany raid → medal + nagroda (raz/tydzień)
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
      catColor: 'blue',
      catStripes: false,
      catEyeColor: '',
      catNoseColor: '',
      catWhiskers: false,
      catLegStripes: false,
      equippedStartup: 'default',
      loginStreak: 0,
      lastLoginDay: null,
      loginBonusDay: null,
      roomAddons: {},
      equipped: {},
      claimedQuests: [],
      dailyClaims: {},
      dayClaims: {},
      weeklyClaims: {},
      monthlyClaims: {},
      affection: 0,
      affectionDay: null,
      affectionRewardDay: null,
      pendingCrates: 0,
      energy: 0,
      energyDate: null,
      energyToday: 0,
      raidEnergy: 0,
      raidEnergyDate: null,
      raidEnergyToday: 0,
      raidWeek: null,
      raidHp: 0,
      raidWon: [],
      defeatedBosses: [],
      bossHp: {},
      _hydrated: false,

      setName: (name) => set({ name: name.trim() || 'Blobek' }),
      addXp: (n) => set((s) => ({ xp: Math.max(0, s.xp + n) })),
      addCoins: (n) => set((s) => ({ coins: Math.max(0, s.coins + n) })),
      spendCoins: (n) => {
        if (!get()._hydrated) return false;            // nie wydawaj zanim portfel się wczyta
        if (get().coins < n) return false;
        set((s) => ({ coins: s.coins - n }));
        return true;
      },
      buyItem: (id, cost) => {
        const s = get();
        if (!s._hydrated) return false;                // patrz spendCoins — anty-clobber
        if (s.ownedItems.includes(id)) return true;
        if (s.coins < cost) return false;
        set({ coins: s.coins - cost, ownedItems: [...s.ownedItems, id] });
        return true;
      },
      // Buy a coat colour (free if already owned) and wear it immediately.
      buyColor: (id, cost) => {
        const s = get();
        if (!s._hydrated) return false;
        if (s.ownedItems.includes(id) || cost === 0) { set({ catColor: id }); return true; }
        if (s.coins < cost) return false;
        set({ coins: s.coins - cost, ownedItems: [...s.ownedItems, id], catColor: id });
        return true;
      },
      setColor: (id) => set({ catColor: id }),
      buyStripes: (cost) => {
        const s = get();
        if (!s._hydrated) return false;
        if (s.ownedItems.includes('stripes')) { set({ catStripes: !s.catStripes }); return true; }
        if (s.coins < cost) return false;
        set({ coins: s.coins - cost, ownedItems: [...s.ownedItems, 'stripes'], catStripes: true });
        return true;
      },
      // Kolor oczu: posiadany (klucz `eye:<id>`) lub darmowy → tylko ustaw hex; inaczej kup+ustaw.
      buyEyeColor: (id, hex, cost) => {
        const s = get();
        if (!s._hydrated) return false;
        const key = `eye:${id}`;
        if (s.ownedItems.includes(key) || cost === 0) { set({ catEyeColor: hex }); return true; }
        if (s.coins < cost) return false;
        set({ coins: s.coins - cost, ownedItems: [...s.ownedItems, key], catEyeColor: hex });
        return true;
      },
      buyNoseColor: (id, hex, cost) => {
        const s = get();
        if (!s._hydrated) return false;
        const key = `nose:${id}`;
        if (s.ownedItems.includes(key) || cost === 0) { set({ catNoseColor: hex }); return true; }
        if (s.coins < cost) return false;
        set({ coins: s.coins - cost, ownedItems: [...s.ownedItems, key], catNoseColor: hex });
        return true;
      },
      buyWhiskers: (cost) => {
        const s = get();
        if (!s._hydrated) return false;
        if (s.ownedItems.includes('whiskers')) { set({ catWhiskers: !s.catWhiskers }); return true; }
        if (s.coins < cost) return false;
        set({ coins: s.coins - cost, ownedItems: [...s.ownedItems, 'whiskers'], catWhiskers: true });
        return true;
      },
      buyLegStripes: (cost) => {
        const s = get();
        if (!s._hydrated) return false;
        if (s.ownedItems.includes('legstripes')) { set({ catLegStripes: !s.catLegStripes }); return true; }
        if (s.coins < cost) return false;
        set({ coins: s.coins - cost, ownedItems: [...s.ownedItems, 'legstripes'], catLegStripes: true });
        return true;
      },
      // Splash cosmetic: free (owned or cost 0) → just equip; otherwise buy (deduct +
      // remember under `startup:<id>` in ownedItems) and equip. Mirrors buyColor.
      buyStartup: (id, cost) => {
        const s = get();
        if (!s._hydrated) return false;
        const key = `startup:${id}`;
        if (s.ownedItems.includes(key) || cost === 0) { set({ equippedStartup: id }); return true; }
        if (s.coins < cost) return false;
        set({ coins: s.coins - cost, ownedItems: [...s.ownedItems, key], equippedStartup: id });
        return true;
      },
      grantStartup: (id) => {
        const s = get();
        const key = `startup:${id}`;
        if (s.ownedItems.includes(key)) { set({ equippedStartup: id }); return; }
        set({ ownedItems: [...s.ownedItems, key], equippedStartup: id });
      },
      // Login-streak coin bonus: once per day. Consecutive days (yesterday → +1) grow the
      // streak (cap 7); a gap resets to 1. Grants coins immediately, returns the amount so
      // the dashboard can toast it. Null if already granted today or wallet not hydrated.
      registerLogin: () => {
        if (!get()._hydrated) return null;
        const t = todayISO();
        const s = get();
        if (s.loginBonusDay === t) return null;
        const streak = s.lastLoginDay === yesterdayISO() ? (s.loginStreak || 0) + 1 : 1;
        const coins = loginBonusCoins(streak);
        set({ loginStreak: streak, lastLoginDay: t, loginBonusDay: t, coins: s.coins + coins });
        return { streak, coins };
      },
      // Free daily chest: one claim per day. Records the day in dayClaims (same anti-clobber
      // store the daily quests use); the caller rolls + grants the reward on a `true`.
      claimDailyBox: () => {
        const t = todayISO();
        const s = get();
        const key = `dailybox:${t}`;
        if (s.dayClaims[key]) return false;
        set({ dayClaims: { ...s.dayClaims, [key]: true } });
        return true;
      },
      claimQuest: (id, coins, xp) => set((s) => s.claimedQuests.includes(id) ? s : ({
        claimedQuests: [...s.claimedQuests, id],
        coins: s.coins + coins,
        xp: s.xp + xp,
      })),
      claimDaily: (id, coins, xp) => {
        const t = todayISO();
        const st = get();
        if (st.dailyClaims[id] === t || st.dayClaims[`${id}:${t}`]) return false;
        set((s) => ({
          dailyClaims: { ...s.dailyClaims, [id]: t },
          dayClaims: { ...s.dayClaims, [`${id}:${t}`]: true },
          coins: s.coins + coins, xp: s.xp + xp,
        }));
        return true;
      },
      // Claim a daily for a PAST date (the "nieodebrane z wczoraj" catch-up). Writes ONLY
      // to dayClaims — touching dailyClaims would overwrite today's claim and make the
      // pair farmable (that was the bug).
      claimDailyFor: (id, date, coins, xp) => {
        const st = get();
        if (st.dayClaims[`${id}:${date}`] || st.dailyClaims[id] === date) return false;
        set((s) => ({
          dayClaims: { ...s.dayClaims, [`${id}:${date}`]: true },
          coins: s.coins + coins, xp: s.xp + xp,
        }));
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
      // Identical shape to syncEnergy, targeting the raid's own bank — see the
      // raidEnergy comment above for why this is separate from `energy`.
      syncRaidEnergy: (todayEnergy, mult) => {
        const t = todayISO();
        const s = get();
        const grantedToday = s.raidEnergyDate === t ? s.raidEnergyToday : 0;
        const target = Math.round(todayEnergy * (1 + mult));
        const delta = target - grantedToday;
        if (delta <= 0 && s.raidEnergyDate === t) return;
        set({
          raidEnergy: s.raidEnergy + Math.max(0, delta),
          raidEnergyDate: t,
          raidEnergyToday: Math.max(grantedToday, target),
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
      healBoss: (bossId, amount, maxHp) => set((s) => ({ bossHp: { ...s.bossHp, [bossId]: Math.min(maxHp, (s.bossHp[bossId] ?? maxHp) + Math.max(0, amount)) } })),
      raidEnsure: (weekKey, hp) => set((s) => (s.raidWeek === weekKey ? s : { raidWeek: weekKey, raidHp: hp })),
      raidAttack: (damage) => {
        const s = get();
        const remaining = Math.max(0, s.raidHp - damage);
        set({ raidEnergy: 0, raidHp: remaining });
        return { remaining, defeated: remaining <= 0 };
      },
      raidClaim: (weekKey, coins, xp) => set((s) => (s.raidWon.includes(weekKey) ? s : { raidWon: [...s.raidWon, weekKey], coins: s.coins + coins, xp: s.xp + xp })),
      reset: () => set({ xp: 0, coins: 0, lastCareTick: null, ownedItems: [], catColor: 'blue', catStripes: false, catEyeColor: '', catNoseColor: '', catWhiskers: false, catLegStripes: false, equippedStartup: 'default', loginStreak: 0, lastLoginDay: null, loginBonusDay: null, equipped: {}, roomAddons: {}, claimedQuests: [], dailyClaims: {}, dayClaims: {}, weeklyClaims: {}, monthlyClaims: {}, affection: 0, affectionDay: null, affectionRewardDay: null, pendingCrates: 0, energy: 0, energyDate: null, energyToday: 0, defeatedBosses: [], bossHp: {}, raidEnergy: 0, raidEnergyDate: null, raidEnergyToday: 0, raidWeek: null, raidHp: 0, raidWon: [] }),
    }),
    {
      name: 'pet-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        name: s.name, createdAt: s.createdAt, xp: s.xp, coins: s.coins,
        lastCareTick: s.lastCareTick, ownedItems: s.ownedItems, catColor: s.catColor, catStripes: s.catStripes,
        catEyeColor: s.catEyeColor, catNoseColor: s.catNoseColor, catWhiskers: s.catWhiskers, catLegStripes: s.catLegStripes,
        equippedStartup: s.equippedStartup,
        loginStreak: s.loginStreak, lastLoginDay: s.lastLoginDay, loginBonusDay: s.loginBonusDay,
        claimedQuests: s.claimedQuests, dailyClaims: s.dailyClaims, dayClaims: s.dayClaims,
        weeklyClaims: s.weeklyClaims, monthlyClaims: s.monthlyClaims,
        affection: s.affection, affectionDay: s.affectionDay, affectionRewardDay: s.affectionRewardDay, pendingCrates: s.pendingCrates,
        energy: s.energy, energyDate: s.energyDate, energyToday: s.energyToday,
        defeatedBosses: s.defeatedBosses, bossHp: s.bossHp,
        raidEnergy: s.raidEnergy, raidEnergyDate: s.raidEnergyDate, raidEnergyToday: s.raidEnergyToday,
        raidWeek: s.raidWeek, raidHp: s.raidHp, raidWon: s.raidWon,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) { usePetStore.setState({ _hydrated: true }); return; }   // błąd hydratacji → i tak otwórz bramkę (defaulty)
        state._hydrated = true;
        state.equippedStartup = state.equippedStartup ?? 'default';   // stary stan bez pola → domyślny splash
        state.loginStreak = state.loginStreak ?? 0;
        state.lastLoginDay = state.lastLoginDay ?? null;
        state.loginBonusDay = state.loginBonusDay ?? null;
        // Migrate: seed dayClaims from the single date dailyClaims still remembers, so a
        // quest claimed on the OLD build isn't offered again as "missed" after this update.
        state.dayClaims = state.dayClaims ?? {};
        for (const [id, date] of Object.entries(state.dailyClaims ?? {})) {
          if (date) state.dayClaims[`${id}:${date}`] = true;
        }
      },
    },
  ),
);

// Fail-safe: if hydration somehow never fires (storage error / very slow disk), open
// the wallet gate after a moment so the shop is never blocked forever. Normal
// hydration wins in <100 ms and makes this a no-op.
setTimeout(() => { if (!usePetStore.getState()._hydrated) usePetStore.setState({ _hydrated: true }); }, 4000);

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

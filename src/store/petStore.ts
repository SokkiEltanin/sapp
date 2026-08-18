import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { weekKeyOf } from '@/utils/quests';
import { rollCrate, CrateTier, COMBAT_ITEM_DROP_CHANCE } from '@/utils/crates';
import { CombatItemId, COMBAT_ITEMS } from '@/utils/combatItems';
import { COMBAT_ITEM_SLOTS, combatItemSlotsFor } from '@/utils/bosses';
import { missionMinutesFor, MissionProfile } from '@/utils/missions';
// `notificationsService` NIE importowane statycznie tutaj (2026-08-15) — ciągnie za sobą
// expo-notifications, którego Jest nie potrafi sparsować z poziomu plików czysto logicznych
// importowanych przez testy (bossProgressReport.ts importuje stąd BossLogEntry/levelFromXp/
// catMaxHp, więc jakikolwiek top-level import tutaj wysadzał CAŁY jego test). Ten sam problem
// i to samo rozwiązanie co lucide-react-native w raid.ts/minibosses.ts/seasonalEvents.ts —
// lazy require() wewnątrz akcji, które faktycznie planują powiadomienie, więc moduł ładuje
// się dopiero gdy realnie wywołany (nigdy podczas samego parsowania pliku przez testy).

export { COMBAT_ITEM_SLOTS, combatItemSlotsFor };

// Bazowe max HP kotka w walkach (v4 redesign, patrz memory boss_design.md) — przed
// trwałymi ulepszeniami za monety (`catMaxHpBonus`). Osobna stała, nie magic number
// w kodzie, żeby balans był w jednym miejscu.
export const CAT_BASE_MAX_HP = 100;
export function catMaxHp(bonus: number): number { return CAT_BASE_MAX_HP + Math.max(0, bonus); }

// The companion blob's PERSISTED state: identity, growth (xp), the coin wallet,
// owned/equipped cosmetics and which quest milestones have already paid out. Its
// live mood/needs are DERIVED from your real self-care data (see petState.ts) and
// are not stored here.

export function todayISO(): string {
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

// Log każdej pokonanej walki (kampania/raid/wydarzenie) — do balance-testowania nowej
// krzywej bossów (2026-08-14, user chce eksportować to i wklejać do analizy). Osobno od
// defeatedBosses/raidWon/eventWon (te trzymają tylko "czy pokonany raz", bez historii) —
// bossLog rośnie bez limitu w czasie, więc UI eksportu tnie do ostatnich N wpisów.
// Przebieg JEDNEJ rundy walki, do logowania (2026-08-17, patrz komentarz przy BossFightDetail
// niżej) — celowo krótkie klucze (p/c/bhp/chp), bo tych obiektów jest po jednym na rundę i
// bossLog rośnie bez limitu w AsyncStorage.
export interface BossLogRound {
  p: number;    // Twój dmg tej rundy (na bossa)
  c: number;    // kontratak bossa tej rundy (na kotka)
  bhp: number;  // hp bossa PO tej rundzie
  chp: number;  // hp kotka PO tej rundzie
}

// 2026-08-17 (user: "nie zapisujesz do logowania z pupila dokładnie walk z ilością HP w
// czasie i dmg zadanego mi i którego zadał bossowi przez to nie wiesz jak bardzo łatwo
// pokonuje bossy i jakie muszą być") — dotąd bossLog trzymał TYLKO podsumowanie nagrody
// (coins/xp) z WYGRANYCH walk; nie dało się z eksportu ocenić jak blisko/łatwo poszła
// walka. `logFight`/`logFightAttempt` (akcje niżej) dopisują to KAŻDEJ próbie (wygranej I
// przegranej), więc export (bossProgressReport.ts) może pokazać realny przebieg, nie tylko
// wynik końcowy.
export interface BossFightDetail {
  won: boolean;           // dla raid: wynik TEJ sesji, nie stanu tygodniowej puli
  catFainted: boolean;
  bossMaxHp: number;      // hp bossa/sesji na start tej próby — kontekst dla rounds[].bhp
  catMaxHpAtFight: number; // max hp kotka na start tej próby — kontekst dla rounds[].chp
  rounds: BossLogRound[];
}

export interface BossLogEntry {
  kind: 'campaign' | 'raid' | 'event' | 'quest' | 'mad' | 'mission';
  id: string;          // bossId / weekKey / eventKey
  name: string;         // nazwa bossa/raidu/wydarzenia w chwili walki (nazwy się zmieniają)
  at: string;            // ISO timestamp
  level: number;         // poziom kotka w chwili pokonania
  coins: number;
  xp: number;
  // Opcjonalne — wpisy sprzed 2026-08-17 (i próby z jakiegoś powodu bez danych walki) ich
  // nie mają. Patrz BossFightDetail wyżej.
  won?: boolean;
  catFainted?: boolean;
  bossMaxHp?: number;
  catMaxHpAtFight?: number;
  rounds?: BossLogRound[];
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
  // ── personalized training quests (self-reported — no sensor can count reps) ──
  pushupsDay: string | null;    // day today's pushup quest was marked done (null = not yet)
  squatsDay: string | null;     // day today's squat quest was marked done
  situpsDay: string | null;
  plankDay: string | null;
  stretchDay: string | null;
  // day → true for any day a training quest (any of the 6) was CLAIMED — feeds the
  // m_training milestone streak (quests.ts trainingStreakFrom). Keyed by day, not by
  // quest, because the streak is "did ANY training happen today", not per-exercise
  // (the daily pool rotates, so no single exercise is guaranteed to appear every day).
  trainingDays: Record<string, true>;
  // ── boss battles ──
  energy: number;               // pozostałe dzienne próby ataku (kampania bossów, v5 = flat count)
  energyDate: string | null;    // day the top-up counter belongs to
  energyToday: number;          // energy already granted today (for daily top-up)
  defeatedBosses: string[];
  // Data (todayISO) ostatniego NOWEGO pokonania bossa kampanii — gate na "1 nowy boss
  // kampanii dziennie" (2026-08-17, user: "zdecydowanie za szybko to poszło pokonałem 3
  // bossy od zera nie mając nic praktycznie" — pełny eksport z czystego resetu pokazał
  // że 3 dzienne próby ataku + odblokowanie czysto sekwencyjne, bez progu poziomu,
  // NIC nie stało na przeszkodzie zbiciu 3 różnych bossów w jednej krótkiej sesji.
  // Bossy same w sobie (hp/ciosy) zostały świadomo NIETKNIĘTE w tym fixie — to
  // OSOBNA oś: nie "boss za łatwy", tylko "zbyt wiele różnych bossów naraz w jeden
  // dzień". Ustawiane w defeatBoss() PO wygranej; blokuje attackRoundBased() dla
  // kind==='campaign', dopóki data się nie zmieni — retry na TYM SAMYM (jeszcze
  // niepokonanym) bossie po przegranej zostaje darmowe, bo nie zmienia tej daty.
  lastCampaignDefeatDate: string | null;
  defeatedMadBosses: string[];    // 'MAD' warianty (madBosses.ts, 2026-08-15) — osobna lista,
                                   // celowo nie miesza się z defeatedBosses (zwykła kampania)
  bossHp: Record<string, number>; // bossId → remaining hp (absent = full)
  bossLog: BossLogEntry[];        // historia pokonanych walk (kampania/raid/event) — patrz typ wyżej
  // Numer "rundy testowej" (2026-08-17, user: "niech reset pupila tworzy nowy log danych
  // żeby było wiadomo które od czego") — `reset()` czyści bossLog/staty do zera (nowy,
  // pusty log), ale ROŚNIE z każdym resetem zamiast wracać do 1, więc kolejne eksporty po
  // kolejnych resetach są jednoznacznie odróżnialne w rozmowie (numer + data resetu w
  // nagłówku raportu, patrz bossProgressReport.ts) zamiast wszystkie wyglądać identycznie
  // jako "Poziom 1, log pusty". CELOWO poza partialize-resetem (patrz reset() niżej) — to
  // metadane O resetach, muszą PRZEŻYĆ sam reset, nie być przez niego zerowane.
  resetGeneration: number;
  lastResetAt: string | null;     // ISO timestamp ostatniego resetu; null = nigdy nie resetowano
  // ── Misja pupila (utils/missions.ts, 2026-08-15) — jeden aktywny slot, bez limitu
  // dziennego. null/null = brak aktywnej misji (można wysłać). Czas trwania (missionMinutesFor)
  // liczony RAZ przy wysyłce z ówczesnego poziomu i zapisany jako missionEndsAt — nie
  // przeliczamy go ponownie, żeby awans levelu W TRAKCIE misji nie zmieniał już obiecanego czasu.
  missionStartedAt: string | null;
  missionEndsAt: string | null;
  // Profil wybrany PRZY WYSYŁCE (2026-08-18, user: "trzeba zrobić że mam jak w sfgame że mogę
  // wybrać misję czy pod złoto czy pod XP" — patrz MissionProfile w missions.ts). Zapamiętany
  // (nie tylko wybór "na moment"), żeby claimMission po powrocie liczyło nagrodę z TYM SAMYM
  // profilem co user wybrał wysyłając, niezależnie kiedy realnie odbierze.
  missionProfile: MissionProfile | null;
  // ── HP kotka (fundament pod v4 walk — S&F-owy redesign, patrz memory boss_design.md) ──
  // NIC jeszcze tego nie czyta/zapisuje poza akcjami niżej — czysto dodatkowy stan, żeby
  // dodanie go było zero-ryzykowne dla działających walk. catMaxHpBonus = TRWAŁE ulepszenia
  // za monety; realny max = CAT_BASE_MAX_HP + catMaxHpBonus (patrz helper poniżej store'u).
  catHp: number;
  catMaxHpBonus: number;
  // v5 pivot (2026-08-07, patrz memory boss_design.md): jedyne źródło mocy ataku poza
  // poziomem/łupem/itemami — TRWAŁE ulepszenie za monety, mirror catMaxHpBonus.
  atkStatBonus: number;
  // ── ekwipunek itemów bojowych (v4.1 — patrz memory boss_design.md „ITEMY BOJOWE") ──
  // Klucz nieobecny = nieposiadany. Wartość = aktualny poziom (1..maxLevel z combatItems.ts).
  // NIC jeszcze tego nie czyta w walce — czysto dodatkowy stan, jak catHp wcześniej.
  ownedCombatItems: Partial<Record<CombatItemId, number>>;
  equippedCombatItems: CombatItemId[];   // max COMBAT_ITEM_SLOTS
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
  // ── wydarzenia (sezonowe święta / nemesis miesiąca) ──
  // TRZECIA niezależna pula energii — patrz raidEnergy wyżej, ten sam powód.
  eventEnergy: number;
  eventEnergyDate: string | null;
  eventEnergyToday: number;
  // eventHp (bank trwałego HP per eventKey) USUNIĘTY 2026-08-12 — wydarzenia walczą teraz
  // IDENTYCZNIE jak kampania (simulateFight, HP resetuje się do pełna co próbę), nie ma już
  // czego trzymać między próbami. eventWon zostaje — to wciąż "czy TEN okres pokonany".
  eventWon: string[];               // eventKeys pokonane (kolekcjonerskie medale)
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
  markPushupsDone: () => void;           // self-report today's pushup quest (no sensor can count reps)
  markSquatsDone: () => void;            // self-report today's squat quest
  markSitupsDone: () => void;
  markPlankDone: () => void;
  markStretchDone: () => void;
  markTrainingDay: () => void;   // called once per claimed training quest — feeds m_training streak
  openCrate: () => { tier: CrateTier; coins: number; itemDropped: CombatItemId | null } | null; // open one pending crate
  // boss battles
  syncEnergy: (todayEnergy: number, mult: number) => void;  // top up the bank from today's self-care
  syncRaidEnergy: (todayEnergy: number, mult: number) => void; // jak syncEnergy, ale osobna pula raidu
  attackBoss: (bossId: string, maxHp: number, damage: number, dodge: number) => { remaining: number; defeated: boolean };
  spendEnergy: () => void;   // v5: -1 próba za attempt (energy to teraz flat dzienny licznik, nie bank)
  defeatBoss: (bossId: string, lootId: string, coins: number, xp: number, name: string, level: number, fight: BossFightDetail) => void;
  defeatMadBoss: (baseBossId: string, coins: number, xp: number, name: string, level: number, fight: BossFightDetail) => void;
  startMission: (level: number, profile: MissionProfile) => void;
  claimMission: (coins: number, xp: number, name: string, level: number, fight: BossFightDetail) => void;
  healBoss: (bossId: string, amount: number, maxHp: number) => void;   // mechanika: boss leczy się gdy go zaniedbasz
  raidEnsure: (weekKey: string, hp: number) => void;                   // ustaw HP raidu na nowy tydzień (raz)
  raidAttack: (damage: number) => { remaining: number; defeated: boolean };
  raidClaim: (weekKey: string, coins: number, xp: number, name: string, level: number, fight: BossFightDetail) => void;     // pokonany raid → medal + nagroda (raz/tydzień)
  // wydarzenia
  syncEventEnergy: (todayEnergy: number, mult: number) => void;
  spendEventEnergy: () => void;         // -1 próba (round-based fight jak kampania, patrz spendEnergy)
  eventClaim: (eventKey: string, coins: number, xp: number, name: string, level: number, fight: BossFightDetail) => void;
  // Questy jako walki (2026-08-14 v2, patrz src/utils/minibosses.ts) — wygrana walka z
  // minibossem PRZYPISANYM do danego questu zastępuje zwykły claim. Ten sam day-guard co
  // claimDaily (dailyClaims+dayClaims, żeby buildQuests widział quest jako odebrany
  // identycznie jak przy zwykłym claimie), plus wpis do bossLog (inne tory walki go mają).
  claimQuestFight: (questId: string, coins: number, xp: number, name: string, level: number, fight: BossFightDetail) => boolean;
  // Log KAŻDEJ próby walki BEZ nagrody (przegrana, lub raid-sesja która nie domknęła
  // tygodniowej puli) — patrz komentarz przy BossFightDetail. Nagrodowe akcje wyżej
  // (defeatBoss itd.) logują wygrane sam; ta akcja pokrywa resztę, żeby bossLog miał
  // KOMPLETNY obraz prób, nie tylko sukcesy.
  logFightAttempt: (kind: BossLogEntry['kind'], id: string, name: string, level: number, fight: BossFightDetail) => void;
  // HP kotka — fundament v4 (patrz komentarz przy polach wyżej)
  buyMaxHp: (cost: number, amount: number) => boolean;         // trwałe ulepszenie za monety
  buyAtkStat: (cost: number, amount: number) => boolean;       // trwałe ulepszenie ATK za monety (v5)
  damageCat: (amount: number) => number;                       // -HP (floor 0), zwraca nowe HP
  healCat: (amount: number) => number;                          // +HP (cap max), zwraca nowe HP
  resetCatHp: () => void;                                       // pełne HP (start/retry walki)
  // ekwipunek itemów bojowych
  grantCombatItem: (id: CombatItemId) => void;                                  // z dropu skrzynki — poziom 1 (no-op jeśli już posiadany)
  upgradeCombatItem: (id: CombatItemId, cost: number, maxLevel: number) => boolean; // +1 poziom za monety, cap maxLevel
  equipCombatItem: (id: CombatItemId) => boolean;                               // false = brak slotu lub nieposiadany
  unequipCombatItem: (id: CombatItemId) => void;
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
      pushupsDay: null,
      squatsDay: null,
      situpsDay: null,
      plankDay: null,
      stretchDay: null,
      trainingDays: {},
      energy: 0,
      energyDate: null,
      energyToday: 0,
      raidEnergy: 0,
      raidEnergyDate: null,
      raidEnergyToday: 0,
      raidWeek: null,
      raidHp: 0,
      raidWon: [],
      eventEnergy: 0,
      eventEnergyDate: null,
      eventEnergyToday: 0,
      eventWon: [],
      defeatedBosses: [],
      lastCampaignDefeatDate: null,
      defeatedMadBosses: [],
      missionStartedAt: null,
      missionEndsAt: null,
      missionProfile: null,
      bossHp: {},
      bossLog: [],
      resetGeneration: 1,
      lastResetAt: null,
      catHp: CAT_BASE_MAX_HP,
      catMaxHpBonus: 0,
      atkStatBonus: 0,
      ownedCombatItems: {},
      equippedCombatItems: [],
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
      markPushupsDone: () => set({ pushupsDay: todayISO() }),
      markSquatsDone: () => set({ squatsDay: todayISO() }),
      markSitupsDone: () => set({ situpsDay: todayISO() }),
      markPlankDone: () => set({ plankDay: todayISO() }),
      markStretchDone: () => set({ stretchDay: todayISO() }),
      markTrainingDay: () => set((s) => ({ trainingDays: { ...s.trainingDays, [todayISO()]: true } })),
      openCrate: () => {
        const s = get();
        if ((s.pendingCrates ?? 0) <= 0) return null;
        const roll = rollCrate();
        // Rzadka, niezależna szansa na item bojowy (v4.1) — tylko spośród jeszcze
        // nieposiadanych, żeby nie "marnować" dropu na duplikat (merge nie istnieje jeszcze).
        let itemDropped: CombatItemId | null = null;
        if (Math.random() < COMBAT_ITEM_DROP_CHANCE) {
          const candidates = (Object.keys(COMBAT_ITEMS) as CombatItemId[]).filter(id => !s.ownedCombatItems[id]);
          if (candidates.length > 0) itemDropped = candidates[Math.floor(Math.random() * candidates.length)];
        }
        set({
          pendingCrates: s.pendingCrates - 1,
          coins: s.coins + roll.coins,
          ...(itemDropped ? { ownedCombatItems: { ...s.ownedCombatItems, [itemDropped]: 1 } } : {}),
        });
        return { ...roll, itemDropped };
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
      spendEnergy: () => set((s) => ({ energy: Math.max(0, s.energy - 1) })),
      defeatBoss: (bossId, lootId, coins, xp, name, level, fight) => set((s) => s.defeatedBosses.includes(bossId) ? s : ({
        defeatedBosses: [...s.defeatedBosses, bossId],
        lastCampaignDefeatDate: todayISO(),
        ownedItems: s.ownedItems.includes(lootId) ? s.ownedItems : [...s.ownedItems, lootId],
        coins: s.coins + coins,
        xp: s.xp + xp,
        bossLog: [...s.bossLog, { kind: 'campaign', id: bossId, name, at: new Date().toISOString(), level, coins, xp, ...fight }],
      })),
      // Osobna lista od defeatedBosses (madBosses.ts) — bez loot-regrantu, ten item już masz
      // z pokonania zwykłej wersji tego bossa (madBossFor go tylko powiela).
      defeatMadBoss: (baseBossId, coins, xp, name, level, fight) => set((s) => s.defeatedMadBosses.includes(baseBossId) ? s : ({
        defeatedMadBosses: [...s.defeatedMadBosses, baseBossId],
        coins: s.coins + coins,
        xp: s.xp + xp,
        bossLog: [...s.bossLog, { kind: 'mad', id: baseBossId, name, at: new Date().toISOString(), level, coins, xp, ...fight }],
      })),
      // Misja (utils/missions.ts) — guard: no-op jeśli już jest aktywna misja (missionEndsAt
      // ustawione), żeby nie dało się nadpisać trwającej misji nowym, krótszym czasem.
      startMission: (level, profile) => set((s) => {
        if (s.missionEndsAt) return s;
        const startedAt = new Date();
        const endsAt = new Date(startedAt.getTime() + missionMinutesFor(level) * 60000);
        require('@/services/notificationsService').notificationsService.scheduleMissionReady(endsAt.toISOString()).catch(() => {});
        return { missionStartedAt: startedAt.toISOString(), missionEndsAt: endsAt.toISOString(), missionProfile: profile };
      }),
      // Zeruje slot (kolejną misję można wysłać od razu, user: "można po misji na kolejną") —
      // bez dedupu po id/dacie jak questy, bo misja to jeden aktywny stan, nie coś liczonego
      // per dzień.
      claimMission: (coins, xp, name, level, fight) => set((s) => {
        require('@/services/notificationsService').notificationsService.cancelMissionReady().catch(() => {});
        return {
          missionStartedAt: null, missionEndsAt: null, missionProfile: null,
          coins: s.coins + coins, xp: s.xp + xp,
          bossLog: [...s.bossLog, { kind: 'mission', id: 'mission', name, at: new Date().toISOString(), level, coins, xp, ...fight }],
        };
      }),
      healBoss: (bossId, amount, maxHp) => set((s) => ({ bossHp: { ...s.bossHp, [bossId]: Math.min(maxHp, (s.bossHp[bossId] ?? maxHp) + Math.max(0, amount)) } })),
      raidEnsure: (weekKey, hp) => set((s) => (s.raidWeek === weekKey ? s : { raidWeek: weekKey, raidHp: hp })),
      raidAttack: (damage) => {
        const s = get();
        const remaining = Math.max(0, s.raidHp - damage);
        set({ raidEnergy: Math.max(0, s.raidEnergy - 1), raidHp: remaining });
        return { remaining, defeated: remaining <= 0 };
      },
      raidClaim: (weekKey, coins, xp, name, level, fight) => set((s) => (s.raidWon.includes(weekKey) ? s : {
        raidWon: [...s.raidWon, weekKey], coins: s.coins + coins, xp: s.xp + xp,
        bossLog: [...s.bossLog, { kind: 'raid', id: weekKey, name, at: new Date().toISOString(), level, coins, xp, ...fight }],
      })),
      // Identical shape to syncEnergy/syncRaidEnergy, targeting the event's own bank.
      syncEventEnergy: (todayEnergy, mult) => {
        const t = todayISO();
        const s = get();
        const grantedToday = s.eventEnergyDate === t ? s.eventEnergyToday : 0;
        const target = Math.round(todayEnergy * (1 + mult));
        const delta = target - grantedToday;
        if (delta <= 0 && s.eventEnergyDate === t) return;
        set({
          eventEnergy: s.eventEnergy + Math.max(0, delta),
          eventEnergyDate: t,
          eventEnergyToday: Math.max(grantedToday, target),
        });
      },
      spendEventEnergy: () => set((s) => ({ eventEnergy: Math.max(0, s.eventEnergy - 1) })),
      eventClaim: (eventKey, coins, xp, name, level, fight) => set((s) => (s.eventWon.includes(eventKey) ? s : {
        eventWon: [...s.eventWon, eventKey], coins: s.coins + coins, xp: s.xp + xp,
        bossLog: [...s.bossLog, { kind: 'event', id: eventKey, name, at: new Date().toISOString(), level, coins, xp, ...fight }],
      })),
      claimQuestFight: (questId, coins, xp, name, level, fight) => {
        const t = todayISO();
        const st = get();
        if (st.dailyClaims[questId] === t || st.dayClaims[`${questId}:${t}`]) return false;
        set((s) => ({
          dailyClaims: { ...s.dailyClaims, [questId]: t },
          dayClaims: { ...s.dayClaims, [`${questId}:${t}`]: true },
          coins: s.coins + coins, xp: s.xp + xp,
          bossLog: [...s.bossLog, { kind: 'quest', id: questId, name, at: new Date().toISOString(), level, coins, xp, ...fight }],
        }));
        return true;
      },
      logFightAttempt: (kind, id, name, level, fight) => set((s) => ({
        bossLog: [...s.bossLog, { kind, id, name, at: new Date().toISOString(), level, coins: 0, xp: 0, ...fight }],
      })),
      buyMaxHp: (cost, amount) => {
        const s = get();
        if (!s._hydrated) return false;
        if (s.coins < cost) return false;
        set({ coins: s.coins - cost, catMaxHpBonus: s.catMaxHpBonus + Math.max(0, amount) });
        return true;
      },
      buyAtkStat: (cost, amount) => {
        const s = get();
        if (!s._hydrated) return false;
        if (s.coins < cost) return false;
        set({ coins: s.coins - cost, atkStatBonus: s.atkStatBonus + Math.max(0, amount) });
        return true;
      },
      damageCat: (amount) => {
        const s = get();
        const next = Math.max(0, s.catHp - Math.max(0, amount));
        set({ catHp: next });
        return next;
      },
      healCat: (amount) => {
        const s = get();
        const max = CAT_BASE_MAX_HP + s.catMaxHpBonus;
        const next = Math.min(max, s.catHp + Math.max(0, amount));
        set({ catHp: next });
        return next;
      },
      resetCatHp: () => set((s) => ({ catHp: CAT_BASE_MAX_HP + s.catMaxHpBonus })),
      grantCombatItem: (id) => set((s) => s.ownedCombatItems[id] ? s : { ownedCombatItems: { ...s.ownedCombatItems, [id]: 1 } }),
      upgradeCombatItem: (id, cost, maxLevel) => {
        const s = get();
        if (!s._hydrated) return false;
        const cur = s.ownedCombatItems[id];
        if (!cur || cur >= maxLevel) return false;
        if (s.coins < cost) return false;
        set({ coins: s.coins - cost, ownedCombatItems: { ...s.ownedCombatItems, [id]: cur + 1 } });
        return true;
      },
      equipCombatItem: (id) => {
        const s = get();
        if (!s.ownedCombatItems[id]) return false;
        if (s.equippedCombatItems.includes(id)) return true;
        if (s.equippedCombatItems.length >= combatItemSlotsFor(levelFromXp(s.xp).level)) return false;
        set({ equippedCombatItems: [...s.equippedCombatItems, id] });
        return true;
      },
      unequipCombatItem: (id) => set((s) => ({ equippedCombatItems: s.equippedCombatItems.filter(x => x !== id) })),
      // resetGeneration/lastResetAt CELOWO liczone z `get()` i INKREMENTOWANE, nie
      // zerowane — to metadane o samych resetach (patrz komentarz przy polu w interfejsie),
      // muszą przetrwać "nowy log danych" żeby kolejne rundy testowe dało się odróżnić.
      reset: () => set((s) => ({ xp: 0, coins: 0, lastCareTick: null, ownedItems: [], catColor: 'blue', catStripes: false, catEyeColor: '', catNoseColor: '', catWhiskers: false, catLegStripes: false, equippedStartup: 'default', loginStreak: 0, lastLoginDay: null, loginBonusDay: null, equipped: {}, roomAddons: {}, claimedQuests: [], dailyClaims: {}, dayClaims: {}, weeklyClaims: {}, monthlyClaims: {}, affection: 0, affectionDay: null, affectionRewardDay: null, pendingCrates: 0, pushupsDay: null, squatsDay: null, situpsDay: null, plankDay: null, stretchDay: null, trainingDays: {}, energy: 0, energyDate: null, energyToday: 0, defeatedBosses: [], lastCampaignDefeatDate: null, defeatedMadBosses: [], missionStartedAt: null, missionEndsAt: null, missionProfile: null, bossHp: {}, bossLog: [], resetGeneration: s.resetGeneration + 1, lastResetAt: new Date().toISOString(), raidEnergy: 0, raidEnergyDate: null, raidEnergyToday: 0, raidWeek: null, raidHp: 0, raidWon: [], eventEnergy: 0, eventEnergyDate: null, eventEnergyToday: 0, eventWon: [], catHp: CAT_BASE_MAX_HP, catMaxHpBonus: 0, atkStatBonus: 0, ownedCombatItems: {}, equippedCombatItems: [] })),
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
        pushupsDay: s.pushupsDay, squatsDay: s.squatsDay,
        situpsDay: s.situpsDay, plankDay: s.plankDay, stretchDay: s.stretchDay, trainingDays: s.trainingDays,
        energy: s.energy, energyDate: s.energyDate, energyToday: s.energyToday,
        defeatedBosses: s.defeatedBosses, lastCampaignDefeatDate: s.lastCampaignDefeatDate, defeatedMadBosses: s.defeatedMadBosses,
        missionStartedAt: s.missionStartedAt, missionEndsAt: s.missionEndsAt, missionProfile: s.missionProfile,
        bossHp: s.bossHp, bossLog: s.bossLog,
        resetGeneration: s.resetGeneration, lastResetAt: s.lastResetAt,
        raidEnergy: s.raidEnergy, raidEnergyDate: s.raidEnergyDate, raidEnergyToday: s.raidEnergyToday,
        raidWeek: s.raidWeek, raidHp: s.raidHp, raidWon: s.raidWon,
        eventEnergy: s.eventEnergy, eventEnergyDate: s.eventEnergyDate, eventEnergyToday: s.eventEnergyToday,
        eventWon: s.eventWon,
        catHp: s.catHp, catMaxHpBonus: s.catMaxHpBonus, atkStatBonus: s.atkStatBonus,
        ownedCombatItems: s.ownedCombatItems, equippedCombatItems: s.equippedCombatItems,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) { usePetStore.setState({ _hydrated: true }); return; }   // błąd hydratacji → i tak otwórz bramkę (defaulty)
        state._hydrated = true;
        state.equippedStartup = state.equippedStartup ?? 'default';   // stary stan bez pola → domyślny splash
        state.loginStreak = state.loginStreak ?? 0;
        state.lastLoginDay = state.lastLoginDay ?? null;
        state.loginBonusDay = state.loginBonusDay ?? null;
        state.bossLog = state.bossLog ?? [];   // stary stan sprzed 2026-08-14 nie miał logu walk
        state.lastCampaignDefeatDate = state.lastCampaignDefeatDate ?? null;   // stary stan sprzed 2026-08-17 nie miał gate'u 1 boss/dzień
        // Stary stan sprzed 2026-08-18 nie miał wyboru profilu misji — jeśli akurat trwała
        // aktywna misja (missionEndsAt ustawione), traktuj ją jako 'balanced' (stare wartości
        // nagrody, dokładnie to co wtedy dostałaby), inaczej null (brak aktywnej misji).
        state.missionProfile = state.missionProfile ?? (state.missionEndsAt ? 'balanced' : null);
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

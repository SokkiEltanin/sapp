import { ImageSourcePropType } from 'react-native';

// Katalog EKWIPUNKU pupila — 6 slotów, 5 itemów/slot × 5 rarity = pasywne staty założone
// na stałe (w odróżnieniu od `combatItems.ts` = aktywne zdolności w walce, osobny system).
// Grafiki w assets/ekwipunek/<slot>/ — jedna na item, RARITY pokazujemy jako kolorowa
// obwódka w UI, nie osobna grafika (patrz assets/ekwipunek/README.md). Na razie placeholdery
// (kolorowy prostokąt + "T{n}"), user podmieni na docelowe rysunki pod te same nazwy plików.
//
// Krok 1/2 wdrożenia (patrz NEXT_STEPS.md "SYSTEM EKWIPUNKU"): CZYSTO DEKLARATYWNY plik —
// samo posiadanie/zakładanie w petStore, staty JESZCZE nie wpięte w simulateFight/atkPower/
// ekonomię (krok 2, świadomie osobny — jak combatItems.ts na start).

export type GearSlot = 'helm' | 'zbroja' | 'buty' | 'obroza' | 'talizman' | 'kolczyki';
export type GearRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export const GEAR_SLOTS: GearSlot[] = ['helm', 'zbroja', 'buty', 'obroza', 'talizman', 'kolczyki'];

// Mnożnik bazowej wartości statu wg rarity. Zakotwiczone na przykładzie usera (pancerz
// T1: common +1hp, rare +5hp, mythic +15hp → ×1/×5/×15); epic/legendary dointerpolowane.
// TODO-balance: brak danych z playtestów dla epic/legendary.
export const RARITY_MULT: Record<GearRarity, number> = {
  common: 1, rare: 5, epic: 8, legendary: 11, mythic: 15,
};

export const RARITY_META: Record<GearRarity, { label: string; color: string; gradient?: [string, string, string] }> = {
  common:    { label: 'Zwykły',      color: '#9AA6B2' },
  rare:      { label: 'Rzadki',      color: '#2ECC71' },
  epic:      { label: 'Epicki',      color: '#4DA8FF' },
  legendary: { label: 'Legendarny',  color: '#FF6FB5' },
  mythic:    { label: 'Mityczny',    color: '#B061FF', gradient: ['#4DA8FF', '#FF9FE0', '#B061FF'] },
};

// Który stat gracza dana kategoria slotu podbija — jeden slot = jeden stat, bez nakładania.
export type GearStat = 'critPct' | 'flatHp' | 'dodgePct' | 'atkPct' | 'energyMultPct' | 'coinsPct';

export const SLOT_STAT: Record<GearSlot, GearStat> = {
  helm: 'critPct', zbroja: 'flatHp', buty: 'dodgePct',
  obroza: 'atkPct', talizman: 'energyMultPct', kolczyki: 'coinsPct',
};

export const SLOT_META: Record<GearSlot, { label: string; icon: string }> = {
  helm:     { label: 'Hełm',     icon: '⛑️' },
  zbroja:   { label: 'Zbroja',   icon: '🛡️' },
  buty:     { label: 'Buty',     icon: '👢' },
  obroza:   { label: 'Obroża',   icon: '🔗' },
  talizman: { label: 'Talizman', icon: '🔮' },
  kolczyki: { label: 'Kolczyki', icon: '💰' },
};

export interface GearItemDef {
  id: string;
  slot: GearSlot;
  name: string;
  unlockLevel: number;   // poziom pupila wymagany żeby item mógł się w ogóle wylosować
  baseValue: number;     // wartość statu (common rarity) — × RARITY_MULT[rarity] daje finalną
  icon: ImageSourcePropType;
}

// Metro wymaga statycznych require() (nie da się zbudować ścieżki dynamicznie w runtime),
// stąd jawna mapa item→plik zamiast generowania z szablonu.
const ICONS: Record<string, ImageSourcePropType> = {
  helm_slomiany: require('../../assets/ekwipunek/helm/helm_slomiany.png'),
  helm_skorzany: require('../../assets/ekwipunek/helm/helm_skorzany.png'),
  helm_zelazny: require('../../assets/ekwipunek/helm/helm_zelazny.png'),
  helm_krucza: require('../../assets/ekwipunek/helm/helm_krucza.png'),
  helm_koronaBurzy: require('../../assets/ekwipunek/helm/helm_koronaBurzy.png'),

  zbroja_szmaciana: require('../../assets/ekwipunek/zbroja/zbroja_szmaciana.png'),
  zbroja_skorzana: require('../../assets/ekwipunek/zbroja/zbroja_skorzana.png'),
  zbroja_kolczuga: require('../../assets/ekwipunek/zbroja/zbroja_kolczuga.png'),
  zbroja_smoczaLuska: require('../../assets/ekwipunek/zbroja/zbroja_smoczaLuska.png'),
  zbroja_aegis: require('../../assets/ekwipunek/zbroja/zbroja_aegis.png'),

  buty_znoszone: require('../../assets/ekwipunek/buty/buty_znoszone.png'),
  buty_skorzane: require('../../assets/ekwipunek/buty/buty_skorzane.png'),
  buty_wiatr: require('../../assets/ekwipunek/buty/buty_wiatr.png'),
  buty_cien: require('../../assets/ekwipunek/buty/buty_cien.png'),
  buty_kometa: require('../../assets/ekwipunek/buty/buty_kometa.png'),

  obroza_sznurek: require('../../assets/ekwipunek/obroza/obroza_sznurek.png'),
  obroza_kolce: require('../../assets/ekwipunek/obroza/obroza_kolce.png'),
  obroza_wilcza: require('../../assets/ekwipunek/obroza/obroza_wilcza.png'),
  obroza_plomien: require('../../assets/ekwipunek/obroza/obroza_plomien.png'),
  obroza_tytan: require('../../assets/ekwipunek/obroza/obroza_tytan.png'),

  talizman_kamyk: require('../../assets/ekwipunek/talizman/talizman_kamyk.png'),
  talizman_piorko: require('../../assets/ekwipunek/talizman/talizman_piorko.png'),
  talizman_ksiezyc: require('../../assets/ekwipunek/talizman/talizman_ksiezyc.png'),
  talizman_gwiazda: require('../../assets/ekwipunek/talizman/talizman_gwiazda.png'),
  talizman_nieskonczonosc: require('../../assets/ekwipunek/talizman/talizman_nieskonczonosc.png'),

  kolczyki_drewniane: require('../../assets/ekwipunek/kolczyki/kolczyki_drewniane.png'),
  kolczyki_miedziane: require('../../assets/ekwipunek/kolczyki/kolczyki_miedziane.png'),
  kolczyki_srebrne: require('../../assets/ekwipunek/kolczyki/kolczyki_srebrne.png'),
  kolczyki_zlote: require('../../assets/ekwipunek/kolczyki/kolczyki_zlote.png'),
  kolczyki_krezus: require('../../assets/ekwipunek/kolczyki/kolczyki_krezus.png'),
};

// TODO-balance: wciąż brak danych z realnych playtestów — do wyregulowania po rozgrywce,
// ale PRZEBALANSOWANE RAZ już (2026-08-19, krok 8 — wpięcie w realne formuły). Pierwsze przejście
// baseValue dla itemów procentowych dałoby przy mythic T5 (×15): crit/dodge do 45%, atk do
// 52%, energyMult do 90% — Z JEDNEGO ITEMU. Dla porównania CAŁA kampania (22 bossy, suma
// wszystkich loot bonusów) daje łącznie: atk +92%, dodge +72%, crit +36%, energyMult +75%
// (policzone node'em z bosses.ts). Jeden mityczny gear-item przebijający całą kampanię to
// jawnie zepsuty balans — dotychczasowe tuningi bossów (COUNTER_PCT, MAD_HITS_MULT) zakładają
// tę pulę jako sufit. Stąd niżej: baseValue dobrane tak, żeby mythic T5 (najlepszy możliwy
// pojedynczy item) lądował w okolicach 20-30% TEJ sumy — zauważalny, ale nie dominujący
// dodatek. zbroja (flatHp) T1 ZOSTAJE dokładnie jak podał user (common+1/rare+5/mythic+15) —
// tylko T2-T5 dointerpolowane tak, żeby mythic T5 nie przekraczał ~50% CAT_BASE_MAX_HP (100).
export const GEAR_ITEMS: GearItemDef[] = [
  // ── Hełm (crit%) — mythic T5 = 0.008×15 = 12% (kampania: suma 36%) ──
  { id: 'helm_slomiany', slot: 'helm', name: 'Słomiany Kapelusz', unlockLevel: 1, baseValue: 0.0015, icon: ICONS.helm_slomiany },
  { id: 'helm_skorzany', slot: 'helm', name: 'Skórzany Kaptur', unlockLevel: 20, baseValue: 0.003, icon: ICONS.helm_skorzany },
  { id: 'helm_zelazny', slot: 'helm', name: 'Żelazny Hełm Zwiadowcy', unlockLevel: 40, baseValue: 0.0045, icon: ICONS.helm_zelazny },
  { id: 'helm_krucza', slot: 'helm', name: 'Kruczy Diadem', unlockLevel: 65, baseValue: 0.006, icon: ICONS.helm_krucza },
  { id: 'helm_koronaBurzy', slot: 'helm', name: 'Korona Burzy', unlockLevel: 90, baseValue: 0.008, icon: ICONS.helm_koronaBurzy },

  // ── Zbroja (flat HP) — T1 anchor od usera, mythic T5 = 3.3×15 ≈ 50 HP (~50% base 100) ──
  { id: 'zbroja_szmaciana', slot: 'zbroja', name: 'Szmaciana Kamizelka', unlockLevel: 1, baseValue: 1, icon: ICONS.zbroja_szmaciana },
  { id: 'zbroja_skorzana', slot: 'zbroja', name: 'Wzmacniana Kamizelka', unlockLevel: 20, baseValue: 1.5, icon: ICONS.zbroja_skorzana },
  { id: 'zbroja_kolczuga', slot: 'zbroja', name: 'Kolczuga Strażnika', unlockLevel: 40, baseValue: 2, icon: ICONS.zbroja_kolczuga },
  { id: 'zbroja_smoczaLuska', slot: 'zbroja', name: 'Pancerz ze Smoczej Łuski', unlockLevel: 65, baseValue: 2.7, icon: ICONS.zbroja_smoczaLuska },
  { id: 'zbroja_aegis', slot: 'zbroja', name: 'Aegis Świtu', unlockLevel: 90, baseValue: 3.3, icon: ICONS.zbroja_aegis },

  // ── Buty (dodge%) — mythic T5 = 0.013×15 = 19.5% (kampania: suma 72%, ale counterDamage
  // capuje redukcję na 90% niezależnie od źródła, więc endgame i tak zbliża się do sufitu) ──
  { id: 'buty_znoszone', slot: 'buty', name: 'Znoszone Sandały', unlockLevel: 1, baseValue: 0.002, icon: ICONS.buty_znoszone },
  { id: 'buty_skorzane', slot: 'buty', name: 'Zwinne Buty Skauta', unlockLevel: 20, baseValue: 0.004, icon: ICONS.buty_skorzane },
  { id: 'buty_wiatr', slot: 'buty', name: 'Buty Wiatrołaza', unlockLevel: 40, baseValue: 0.007, icon: ICONS.buty_wiatr },
  { id: 'buty_cien', slot: 'buty', name: 'Sandały Cienia', unlockLevel: 65, baseValue: 0.009, icon: ICONS.buty_cien },
  { id: 'buty_kometa', slot: 'buty', name: 'Buty Komety', unlockLevel: 90, baseValue: 0.013, icon: ICONS.buty_kometa },

  // ── Obroża (atk%) — mythic T5 = 0.0167×15 ≈ 25% (kampania: suma 92%) ──
  { id: 'obroza_sznurek', slot: 'obroza', name: 'Sznurkowa Obroża', unlockLevel: 1, baseValue: 0.0025, icon: ICONS.obroza_sznurek },
  { id: 'obroza_kolce', slot: 'obroza', name: 'Nabijana Obroża', unlockLevel: 20, baseValue: 0.005, icon: ICONS.obroza_kolce },
  { id: 'obroza_wilcza', slot: 'obroza', name: 'Wilczy Kieł', unlockLevel: 40, baseValue: 0.0085, icon: ICONS.obroza_wilcza },
  { id: 'obroza_plomien', slot: 'obroza', name: 'Płonący Naszyjnik', unlockLevel: 65, baseValue: 0.012, icon: ICONS.obroza_plomien },
  { id: 'obroza_tytan', slot: 'obroza', name: 'Obroża Tytana', unlockLevel: 90, baseValue: 0.0167, icon: ICONS.obroza_tytan },

  // ── Talizman (energyMult%) — mythic T5 = 0.0133×15 ≈ 20% (kampania: suma 75%) ──
  { id: 'talizman_kamyk', slot: 'talizman', name: 'Talizman z Kamyka', unlockLevel: 1, baseValue: 0.002, icon: ICONS.talizman_kamyk },
  { id: 'talizman_piorko', slot: 'talizman', name: 'Talizman z Piórka', unlockLevel: 20, baseValue: 0.004, icon: ICONS.talizman_piorko },
  { id: 'talizman_ksiezyc', slot: 'talizman', name: 'Talizman Półksiężyca', unlockLevel: 40, baseValue: 0.007, icon: ICONS.talizman_ksiezyc },
  { id: 'talizman_gwiazda', slot: 'talizman', name: 'Talizman Spadającej Gwiazdy', unlockLevel: 65, baseValue: 0.009, icon: ICONS.talizman_gwiazda },
  { id: 'talizman_nieskonczonosc', slot: 'talizman', name: 'Talizman Nieskończoności', unlockLevel: 90, baseValue: 0.0133, icon: ICONS.talizman_nieskonczonosc },

  // ── Kolczyki (coins% bonus) — brak precedensu w istniejącym balansie (nowy stat), ale
  // ta sama ostrożna skala co reszta: mythic T5 = 0.0167×15 ≈ 25% więcej złota z walk ──
  { id: 'kolczyki_drewniane', slot: 'kolczyki', name: 'Drewniane Kolczyki', unlockLevel: 1, baseValue: 0.002, icon: ICONS.kolczyki_drewniane },
  { id: 'kolczyki_miedziane', slot: 'kolczyki', name: 'Miedziane Kolczyki', unlockLevel: 20, baseValue: 0.004, icon: ICONS.kolczyki_miedziane },
  { id: 'kolczyki_srebrne', slot: 'kolczyki', name: 'Srebrne Kolczyki', unlockLevel: 40, baseValue: 0.006, icon: ICONS.kolczyki_srebrne },
  { id: 'kolczyki_zlote', slot: 'kolczyki', name: 'Złote Kolczyki z Monetą', unlockLevel: 65, baseValue: 0.010, icon: ICONS.kolczyki_zlote },
  { id: 'kolczyki_krezus', slot: 'kolczyki', name: 'Kolczyki Krezusa', unlockLevel: 90, baseValue: 0.0167, icon: ICONS.kolczyki_krezus },
];

export function gearById(id: string): GearItemDef | undefined {
  return GEAR_ITEMS.find(g => g.id === id);
}

export function gearBySlot(slot: GearSlot): GearItemDef[] {
  return GEAR_ITEMS.filter(g => g.slot === slot);
}

// Finalna wartość statu itemu w danej rzadkości.
export function gearStatValue(item: GearItemDef, rarity: GearRarity): number {
  return item.baseValue * RARITY_MULT[rarity];
}

// Formatowanie statów do UI — WYDZIELONE z GearPanel.tsx (2026-08-22, user: "jak klikam w
// sklepiku... żeby po kliknięciu w item pokazywało jego staty i porównanie z itemem
// założonym") — dawniej żyły TYLKO tam (jedyny konsument), teraz potrzebne też w
// pet-shop.tsx (podgląd przed zakupem w Sklepie dnia), więc jedna wspólna definicja
// zamiast dwóch kopii tej samej mapy/formatu.
export const GEAR_STAT_LABEL: Record<GearStat, string> = {
  critPct: 'krytyk', flatHp: 'HP', dodgePct: 'unik', atkPct: 'atak', energyMultPct: 'energia', coinsPct: 'monety',
};
export function fmtGearStat(stat: GearStat, v: number): string {
  return stat === 'flatHp' ? `+${Math.round(v)}` : `+${(v * 100).toFixed(1)}%`;
}

// Itemy odblokowane (możliwe do wylosowania) dla danego poziomu pupila, per slot.
export function unlockedGearFor(slot: GearSlot, level: number): GearItemDef[] {
  return gearBySlot(slot).filter(g => g.unlockLevel <= level);
}

// ── Sklep dnia — 3 konkretne itemy do kupienia za gold, roluje się raz dziennie ────────
// (2026-08-19, user: "3 itemy daily do kupienia za złoto roluje się codziennie"). Ten sam
// deterministyczny wzorzec `hashOf` co `dailyExercisePool` (personalQuests.ts) i
// `raidForWeek` (raid.ts) — ten sam dzień zawsze daje ten sam zestaw (nie tasuje się przy
// re-renderze), inny dzień = inny zestaw. Gwarantowany zakup (nie loteria jak skrzynki),
// więc rzadkości są mocno przechylone w stronę common/rare — mythic/legendary tu rzadkość
// TODO-balance, brak danych z playtestów, jak reszta cenników w tym pliku.
function hashOf(s: string, mul: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * mul + s.charCodeAt(i)) >>> 0;
  return h;
}
function pseudoRandom01(seed: string): number {
  return (hashOf(seed, 31) % 100000) / 100000;
}

const TIER_LEVELS = [1, 20, 40, 65, 90];
const TIER_BASE_COST = [40, 90, 160, 260, 400];
const DAILY_RARITY_COST_MULT: Record<GearRarity, number> = {
  common: 1, rare: 1.6, epic: 2.2, legendary: 3, mythic: 4.2,
};
const DAILY_RARITY_WEIGHT: Record<GearRarity, number> = {
  common: 55, rare: 30, epic: 11, legendary: 3.5, mythic: 0.5,
};

function dailyRarityFor(seed: string): GearRarity {
  const order: GearRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];
  const total = order.reduce((s2, r) => s2 + DAILY_RARITY_WEIGHT[r], 0);
  let r = pseudoRandom01(seed + '|rarity') * total;
  for (const rarity of order) { r -= DAILY_RARITY_WEIGHT[rarity]; if (r <= 0) return rarity; }
  return 'common';
}

export interface DailyShopSlot { item: GearItemDef; rarity: GearRarity; cost: number }

export function dailyShopSlots(date: string, level: number, count = 3): DailyShopSlot[] {
  const unlocked = GEAR_SLOTS.flatMap(slot => unlockedGearFor(slot, level));
  if (unlocked.length === 0) return [];
  const picked = [...unlocked]
    .sort((a, b) => hashOf(date + a.id, 31) - hashOf(date + b.id, 31))
    .slice(0, Math.min(count, unlocked.length));
  return picked.map(item => {
    const rarity = dailyRarityFor(date + item.id);
    const tierIdx = Math.max(0, TIER_LEVELS.indexOf(item.unlockLevel));
    const cost = Math.round(TIER_BASE_COST[tierIdx] * DAILY_RARITY_COST_MULT[rarity]);
    return { item, rarity, cost };
  });
}

// Sprzedaż zbędnego/słabszego itemu za monety (2026-08-20, user: "co robimy z itemami co sa
// słabsze ale je mamy w eq? mozna je sprzedać?"). Wartość = 40% tego co ten sam tier/rarity
// kosztowałby w sklepie dnia (`TIER_BASE_COST`/`DAILY_RARITY_COST_MULT` wyżej) — celowo MNIEJ
// niż cena kupna, żeby kup-i-sprzedaj nie było darmowym arbitrażem, ale wciąż realna wartość
// za coś czego już nie używasz (np. słabszy duplikat po lepszym dropie ze skrzynki). Działa
// dla WSZYSTKICH itemów niezależnie od tego skąd przyszły (skrzynka/sklep dnia) — cena to
// wewnętrzna wartość tier+rarity, nie historia zakupu.
const SELL_FRACTION = 0.4;
export function gearSellValue(item: GearItemDef, rarity: GearRarity): number {
  const tierIdx = Math.max(0, TIER_LEVELS.indexOf(item.unlockLevel));
  return Math.max(1, Math.round(TIER_BASE_COST[tierIdx] * DAILY_RARITY_COST_MULT[rarity] * SELL_FRACTION));
}

// ── Krok 8 — wpięcie w realne formuły walki/ekonomii ──────────────────────────────────
// Cztery sloty (helm/buty/obroza/talizman) mapują 1:1 na `Bonuses{atk,dodge,crit,
// energyMult}` z bosses.ts (ten sam kształt co bonusy z lootu kampanii, patrz
// `bossBonuses()` tam) — jeden slot = jeden stat, więc SUMOWANIE tu to zawsze co najwyżej
// jeden składnik (gracz ma max 1 item założony na slot). zbroja (flatHp) i kolczyki
// (coinsPct) nie pasują do tego kształtu, stąd osobne funkcje niżej.
export interface GearCombatBonuses { atk: number; dodge: number; crit: number; energyMult: number }

export function gearCombatBonuses(
  equippedGear: Partial<Record<GearSlot, string>>,
  ownedGear: Partial<Record<string, GearRarity>>,
): GearCombatBonuses {
  const out: GearCombatBonuses = { atk: 0, dodge: 0, crit: 0, energyMult: 0 };
  for (const slot of GEAR_SLOTS) {
    const itemId = equippedGear[slot];
    if (!itemId) continue;
    const item = gearById(itemId);
    const rarity = ownedGear[itemId];
    if (!item || !rarity) continue;
    const val = gearStatValue(item, rarity);
    const stat = SLOT_STAT[slot];
    if (stat === 'critPct') out.crit += val;
    else if (stat === 'dodgePct') out.dodge += val;
    else if (stat === 'atkPct') out.atk += val;
    else if (stat === 'energyMultPct') out.energyMult += val;
  }
  return out;
}

// Doda się do CAT_BASE_MAX_HP + catMaxHpBonus (petStore.ts) — wołane WSZĘDZIE gdzie liczy
// się realny sufit HP kotka (wyświetlanie ORAZ damageCat/healCat/resetCatHp), inaczej gear
// pokazywałby się w statach ale nie chroniłby kotka naprawdę w walce.
export function gearFlatHp(
  equippedGear: Partial<Record<GearSlot, string>>,
  ownedGear: Partial<Record<string, GearRarity>>,
): number {
  const itemId = equippedGear.zbroja;
  if (!itemId) return 0;
  const item = gearById(itemId);
  const rarity = ownedGear[itemId];
  if (!item || !rarity) return 0;
  return gearStatValue(item, rarity);
}

// Mnożnik do nagrody monet z walki (1 = bez bonusu). Wołane w JEDNYM miejscu —
// app/boss-fight.tsx, tam gdzie liczy się finalna wypłata za zwycięstwo (wspólne dla
// wszystkich 6 trybów walki), żeby nie trzeba było mnożyć w wielu rozrzuconych miejscach.
export function gearCoinsMult(
  equippedGear: Partial<Record<GearSlot, string>>,
  ownedGear: Partial<Record<string, GearRarity>>,
): number {
  const itemId = equippedGear.kolczyki;
  if (!itemId) return 1;
  const item = gearById(itemId);
  const rarity = ownedGear[itemId];
  if (!item || !rarity) return 1;
  return 1 + gearStatValue(item, rarity);
}

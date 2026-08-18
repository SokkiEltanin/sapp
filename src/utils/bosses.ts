// Boss battles (etap 4, v5 pivot 2026-08-07 — patrz memory boss_design.md). Damage
// comes ONLY from purchased/leveled stats (ATK bought with coins, pet level, loot,
// equipped items) — NOT from today's self-care data. That data still earns you coins/
// XP/crates through the existing quest economy, it just no longer scales a hit or
// gates a weakness bonus. "Energia" stays as a simple DAILY ATTEMPT COUNT (how many
// times you can fight today), refilled flat each day — not computed from steps/sleep/
// mood/sweets like before. `guard`/`regenPct` on a Boss are now INNATE traits (some
// bosses are just tankier/regenerate), not conditional on "did you do X today".
//
// 2026-08-13→2026-08-18: for a while a boss's `weakness` category ALSO weakened its
// effective HP based on a real multi-day self-care streak (bossWeakness.ts). REMOVED
// (2026-08-18, user: "wywalić chyba musimy osłabienia bossów na nawyki itp, bo problemem
// jest to że wtedy bardzo ciężko balansować je będzie za dużo zmiennych") — hp already
// depends on level/order/loot/items; adding a THIRD, real-world-streak-driven axis made the
// difficulty curve impossible to reason about (every balance pass would need to account for
// "what if the player also has a 30-day streak"). `weakness`/`weaknessLabel` stay on Boss
// PURELY as flavor/theme (art aura color, "Motyw: X" label) — no mechanical effect any more.

import {
  CombatItemId, HEADSHOT_CHANCE, HEAL_ONCE_PCT, dodgeChanceAt, reflectPctAt,
  executeThresholdAt, fireProcChanceAt, FIRE_DOT_PCT, MIND_CONTROL_CHANCE,
  SHIELD_REDUCTION_PCT, THORN_PCT,
} from '@/utils/combatItems';
// UWAGA: żadnych importów z lucide-react-native w tym pliku — ciągnie za sobą
// react-native-svg, którego Jest nie potrafi sparsować z poziomu pliku importowanego
// bezpośrednio przez testy (bosses.test.ts importuje bosses.ts). Ikony (loot/raid/
// wydarzenia) żyją osobno w src/utils/bossUiIcons.ts, importowane tylko przez ekrany.

// Temat/flavor bossa (art/aura, kolor aury w bosses.tsx, "Motyw: X" na hero card/ekranie
// walki) — v5 pivot (2026-08-07) odłączył to od DZISIEJSZYCH danych samoopieki. Między
// 2026-08-13 a 2026-08-18 ta sama etykieta NA CHWILĘ dostała mechaniczny efekt (osłabiała
// effective HP przez wielodniową serię), usunięte — patrz komentarz na górze pliku. Zostaje
// czystym flavorem: computeDamage/atkPower/simulateFight nigdy o tym nic nie wiedziały.
export type WeaknessKey = 'steps' | 'sweetless' | 'habits' | 'mood' | 'sleep' | 'water';

export interface BossLoot {
  id: string;
  name: string;
  emoji: string;
  desc: string;                 // what the bonus does, in words
  bonus: Partial<{ atk: number; dodge: number; crit: number; energyMult: number }>;
}

// Unikatowy atak kontrataku bossa (2026-08-17, user: "planuję żeby bossy miały unikatowe
// ataki — drapieżniki drapnięcie pazurami, magowie kulę magiczną, miecze slash mieczem, a ci
// którzy nie mają to pięść"). Derywowane wprost z istniejącej konwencji nazewnictwa plików w
// bossIcons.ts (BOSS_<atak>_<nazwa>.png — sam user tak je nazwał, patrz komentarz tam) —
// TYLKO bossy z jednoznacznym pazur/magia/miecz atakiem w nazwie pliku dostają wpis, reszta
// (hand/bite/fire/axe/club/bone/scythe/soundwave — nie pasują jednoznacznie do żadnej z 3
// kategorii) zostaje `undefined` → fallback pięść w BossArt/boss-fight.tsx, zgodnie z
// dokładnym życzeniem "ci którzy nie mają to mamy pięść".
export type AttackKind = 'claw' | 'magic' | 'sword';

export interface Boss {
  id: string;
  name: string;
  emoji: string;
  order: number;
  unlockLevel: number;
  hp: number;
  weakness: WeaknessKey;        // temat + (od 2026-08-13) kategoria realnej serii, patrz bossWeakness.ts
  weaknessLabel: string;
  loot: BossLoot;
  coins: number;
  xp: number;
  taunt: string;
  // ── mechaniki WRODZONE (opcjonalne) — stała cecha bossa, nie zależy już od
  // dzisiejszych danych samo-opieki ──
  guard?: boolean;    // OSŁONA: ten boss zawsze redukuje Twój cios ×0.5 (tankowy typ)
  regenPct?: number;  // REGENERACJA: ten boss zawsze leczy ten % max HP co przeżytą rundę (enrage)
  attackKind?: AttackKind; // wizualny typ kontrataku — patrz komentarz nad AttackKind
}

// BALANCE REVIEW (2026-08-13, patrz memory boss_design.md „balance review") — `hp` wartości
// niżej PRZEPISANE z powrotem do rozsądnej krzywej. Stara krzywa (300→368000→500000, ~×1.4
// na bossa złożone przez 22 bossy) w połączeniu z fixem counterDamage() (liczy się teraz od
// AKTUALNEGO HP bossa, nie stałego max — patrz komentarz przy COUNTER_PCT niżej) dawała
// bossom-endgame setki-tysiące ciosów do zabicia (ponad MAX_FIGHT_ROUNDS=200) — matematycznie
// niewygrywalne niezależnie od inwestycji. Nowe `hp` = atkPower(0, unlockLevel) × docelowa
// liczba realnych ciosów (rośnie łagodnie 6→14 przez roster, NIE wykładniczo), więc trudność
// skaluje się RAZEM z tym jak rośnie moc gracza z poziomem, zamiast go wyprzedzać. Każdy boss
// killowalny w ≤~31 rundach przy ZEROWEJ inwestycji (node -e verified) — z zakupionym
// catMaxHpBonus/atkStatBonus (do tego służy ekonomia monet) jest łatwiej, to oczekiwana
// ścieżka, nie wymóg. Przy okazji: żaden boss już nie łączy `guard` + `regenPct` naraz
// (insomnia/devourer/wizard miały oba) — ta kombinacja potrafiła zrobić z bossa dosłownie
// niezabijalnego, gdy `0.5×atkPower < regenPct×hp` (kotek zadaje mniej niż boss leczy,
// każda runda). Nadal PIERWSZA WERSJA tej krzywej — niesprawdzona na urządzeniu.
//
// FIX 2026-08-17 (user: "walki są zbyt łatwe") — throwaway-symulacją (profil "lekkiej"
// stopniowej inwestycji rosnącej z `order`, ta sama dyscyplina co przy MAD/quest wcześniej)
// znaleziono DWA osobne problemy:
// 1) **realny bug, nie kwestia trudności**: `guard` (Twój cios ×0.5) w połączeniu z
//    `counterDamage()` liczonym od AKTUALNEGO hp bossa podwaja SKUMULOWANY kontratak wobec
//    bossa bez guard o tym samym hp (2× rund ekspozycji × ten sam % za rundę) — bossy #22
//    (Iluzja Kontroli, FINAŁ KAMPANII) i #14/#15 były w praktyce nie do wygrania nawet przy
//    realistycznej inwestycji. Fix: `counterDamage` bierze teraz `guard`, ucina kontratak
//    o połowę gdy aktywny — przywraca parytet z bossami bez guard przy tym samym hp/hits.
// 2) **za łatwe wczesne/środkowe bossy** (order 1-13, Lv2-46) — docelowe 6→10.6 ciosów w tym
//    zakresie dawało 100% winrate nawet przy zerowej inwestycji. Podbite do 9→12 ciosów (patrz
//    hp niżej) — nadal 100% winrate w symulacji przy LEKKIEJ inwestycji, ale wyraźnie dłuższe/
//    trudniejsze walki. Bossy #14-22 (Lv52-116, "elite" tier) ŚWIADOMIE NIETKNIĘTE — audyt
//    14.08 ("Balans ekonomii vs bossy" w NEXT_STEPS.md) już wcześniej znalazł że ten sam
//    zakres jest szczególnie wrażliwy na rozjazd między prostym modelem a REALNYM tempem
//    ekonomii gracza; podbijanie go dalej bez tej samej rygorystycznej, pełnej symulacji
//    ryzykowałoby powtórzenie DOKŁADNIE tego samego "6 z 22 bossów praktycznie nieosiągalnych"
//    problemu, który już raz naprawiono (wtedy stroną ekonomii, nie hp bossów). Odłożone do
//    osobnego, pełnego audytu — patrz NEXT_STEPS.md.
export const BOSSES: Boss[] = [
  {
    id: 'sloth', name: 'Kanapowy Leniwiec', emoji: '🦥', order: 1, unlockLevel: 2, hp: 382,
    attackKind: 'claw', // atakpazury_frog.png
    weakness: 'steps', weaknessLabel: 'kroki',
    // id zostaje 'loot_pillow' mimo zmiany nazwy/emoji (2026-08-12, gablota trofeów
    // wywalona z pupila) — to trwały klucz w ownedItems, zmiana złamałaby już zdobyty
    // przedmiot. Sama poduszka jako trofeum za pokonanie LENIWCA była tematycznie
    // odwrotna (nagroda-symbol lenistwa za POKONANIE lenistwa) — tylko reflavor.
    loot: { id: 'loot_pillow', name: 'Iskra Poranka', emoji: '⚡', desc: '+6% energii z dbania o siebie', bonus: { energyMult: 0.06 } },
    coins: 8, xp: 60, taunt: 'Po co dziś wstawać…',
  },
  {
    id: 'sugar', name: 'Cukrowy Potwór', emoji: '🍬', order: 2, unlockLevel: 4, hp: 414,
    weakness: 'sweetless', weaknessLabel: 'dni bez słodyczy',
    loot: { id: 'loot_sugarcrystal', name: 'Kryształ Cukru', emoji: '💎', desc: '+3% siły ataku', bonus: { atk: 0.03 } },
    coins: 12, xp: 100, taunt: 'Zjedz jeszcze jednego batonika…', guard: true,
  },
  {
    id: 'snake', name: 'Wąż Kusiciel', emoji: '🐍', order: 3, unlockLevel: 6, hp: 448,
    weakness: 'habits', weaknessLabel: 'nawyki',
    loot: { id: 'loot_snakefig', name: 'Figurka Węża', emoji: '🐍', desc: '+5% szansy na cios krytyczny', bonus: { crit: 0.05 } },
    coins: 18, xp: 160, taunt: 'Odpuść dziś nawyki…',
  },
  {
    id: 'dragon', name: 'Smok Chaosu', emoji: '🐲', order: 4, unlockLevel: 9, hp: 495,
    weakness: 'mood', weaknessLabel: 'wpisy nastroju',
    loot: { id: 'loot_dragon', name: 'Trofeum Smoka', emoji: '🐲', desc: '+5% uniku, +3% siły ataku', bonus: { dodge: 0.05, atk: 0.03 } },
    coins: 30, xp: 300, taunt: 'Nie zapisuj dziś nastroju…', regenPct: 0.03,
  },
  {
    id: 'scroll', name: 'Złodziej Czasu', emoji: '📱', order: 5, unlockLevel: 12, hp: 544,
    weakness: 'habits', weaknessLabel: 'nawyki',
    loot: { id: 'loot_hourglass', name: 'Klepsydra Skupienia', emoji: '⏳', desc: '+7% energii z dbania o siebie', bonus: { energyMult: 0.07 } },
    coins: 45, xp: 450, taunt: 'Jeszcze tylko jeden filmik…',
  },
  {
    id: 'stress', name: 'Potwór Stresu', emoji: '😰', order: 6, unlockLevel: 15, hp: 595,
    weakness: 'mood', weaknessLabel: 'wpisy nastroju',
    loot: { id: 'loot_calm', name: 'Amulet Spokoju', emoji: '🧿', desc: '+6% uniku', bonus: { dodge: 0.06 } },
    coins: 60, xp: 600, taunt: 'Martw się wszystkim naraz…',
  },
  {
    id: 'junk', name: 'Król Fast Foodu', emoji: '🍔', order: 7, unlockLevel: 18, hp: 647,
    weakness: 'sweetless', weaknessLabel: 'dni bez słodyczy',
    loot: { id: 'loot_veg', name: 'Korona Warzyw', emoji: '🥦', desc: '+5% siły ataku, +2% kryt', bonus: { atk: 0.05, crit: 0.02 } },
    coins: 80, xp: 800, taunt: 'Dorzuć duże frytki…', guard: true,
  },
  {
    id: 'burnout', name: 'Pustka Wypalenia', emoji: '🌑', order: 8, unlockLevel: 22, hp: 714,
    weakness: 'steps', weaknessLabel: 'kroki',
    loot: { id: 'loot_spark', name: 'Iskra Życia', emoji: '⭐', desc: '+5% atak, +5% unik, +5% energii', bonus: { atk: 0.05, dodge: 0.05, energyMult: 0.05 } },
    coins: 120, xp: 1200, taunt: 'Nic już nie ma sensu…', regenPct: 0.03,
  },
  // ── endgame (dłuższy cel; łup coraz mocniejszy, żeby dało się dogonić rosnące HP) ──
  {
    id: 'insomnia', name: 'Zmora Bezsenności', emoji: '🌙', order: 9, unlockLevel: 26, hp: 783,
    weakness: 'sleep', weaknessLabel: 'sen (7h+)',
    loot: { id: 'loot_moon', name: 'Amulet Księżyca', emoji: '🌙', desc: '+8% energii z dbania o siebie', bonus: { energyMult: 0.08 } },
    coins: 150, xp: 1500, taunt: 'Jeszcze tylko jeden odcinek o 2 w nocy…', guard: true,
  },
  {
    id: 'compare', name: 'Widmo Porównań', emoji: '👻', order: 10, unlockLevel: 30, hp: 855,
    attackKind: 'magic', // atakmagicrod_magician.png
    weakness: 'mood', weaknessLabel: 'wpisy nastroju',
    loot: { id: 'loot_mirror', name: 'Lustro Prawdy', emoji: '🪞', desc: '+7% uniku, +3% atak', bonus: { dodge: 0.07, atk: 0.03 } },
    coins: 200, xp: 2000, taunt: 'Zobacz, o ile innym lepiej…', regenPct: 0.03,
  },
  {
    id: 'drought', name: 'Hydra Odwodnienia', emoji: '🐙', order: 11, unlockLevel: 35, hp: 943,
    weakness: 'water', weaknessLabel: 'woda (cel dnia)',
    loot: { id: 'loot_spring', name: 'Fiolka Źródła', emoji: '💧', desc: '+6% atak, +4% kryt', bonus: { atk: 0.06, crit: 0.04 } },
    coins: 280, xp: 2800, taunt: 'Kawa liczy się jako woda, nie?', regenPct: 0.03,
  },
  {
    id: 'procrast', name: 'Tytan Prokrastynacji', emoji: '⏳', order: 12, unlockLevel: 40, hp: 1034,
    attackKind: 'magic', // BOLTATTACK_zeus.png (piorun — elementarny/magiczny, nie fizyczny cios)
    weakness: 'habits', weaknessLabel: 'nawyki',
    loot: { id: 'loot_gear', name: 'Mechanizm Czasu', emoji: '⚙️', desc: '+9% energii, +3% atak', bonus: { energyMult: 0.09, atk: 0.03 } },
    coins: 380, xp: 3800, taunt: 'Zrobisz to jutro… na pewno…',
  },
  {
    id: 'doubt', name: 'Cień Zwątpienia', emoji: '🌫️', order: 13, unlockLevel: 46, hp: 1142,
    attackKind: 'claw', // pazurattack_cerberus.png
    weakness: 'mood', weaknessLabel: 'wpisy nastroju',
    loot: { id: 'loot_lantern', name: 'Latarnia Wiary', emoji: '🏮', desc: '+8% atak, +6% uniku', bonus: { atk: 0.08, dodge: 0.06 } },
    coins: 550, xp: 5500, taunt: 'I tak ci się nie uda…', regenPct: 0.04,
  },
  {
    id: 'devourer', name: 'Pożeracz Nawyków', emoji: '👹', order: 14, unlockLevel: 52, hp: 1230,
    weakness: 'sweetless', weaknessLabel: 'dni bez słodyczy',
    loot: { id: 'loot_crown', name: 'Korona Mistrza', emoji: '👑', desc: '+10% atak, +8% uniku, +8% energii, +5% kryt', bonus: { atk: 0.10, dodge: 0.08, energyMult: 0.08, crit: 0.05 } },
    coins: 900, xp: 9000, taunt: 'Wróć do starych nawyków, będzie łatwiej…', guard: true,
  },
  // ── prestiż (2026-08-09) — 8 nowych, z zapasowych portretów w assets/ikonybosów/;
  // HP już NIE kontynuuje starej krzywej devourera (~×1.4/krok) — patrz balance-review
  // komentarz nad BOSSES.
  {
    id: 'samurai', name: 'Duch Perfekcjonizmu', emoji: '🥷', order: 15, unlockLevel: 58, hp: 1320,
    attackKind: 'sword', // atakkatana_samurai.png
    weakness: 'mood', weaknessLabel: 'wpisy nastroju',
    loot: { id: 'loot_katana', name: 'Katana Honoru', emoji: '🗡️', desc: '+9% siły ataku', bonus: { atk: 0.09 } },
    coins: 1300, xp: 13500, taunt: 'Musisz zrobić to idealnie, inaczej się nie liczy…', guard: true,
  },
  {
    id: 'jaguar', name: 'Cień Impulsu', emoji: '🐆', order: 16, unlockLevel: 65, hp: 1420,
    attackKind: 'claw', // atakpazurty_jaguar.png
    weakness: 'habits', weaknessLabel: 'nawyki',
    loot: { id: 'loot_clawreflex', name: 'Pazur Refleksu', emoji: '🐾', desc: '+9% uniku', bonus: { dodge: 0.09 } },
    coins: 2000, xp: 20000, taunt: 'Kup to teraz, pomyślisz później…',
  },
  {
    id: 'dinosaur', name: 'Skamieniały Nawyk', emoji: '🦖', order: 17, unlockLevel: 72, hp: 1640,
    attackKind: 'claw', // atakpazury_dinosaur.png
    weakness: 'steps', weaknessLabel: 'kroki',
    loot: { id: 'loot_fossil', name: 'Skamielina Mocy', emoji: '🦴', desc: '+10% atak, +3% kryt', bonus: { atk: 0.10, crit: 0.03 } },
    coins: 3000, xp: 30000, taunt: 'Zawsze tak robiłeś, po co coś zmieniać…',
  },
  {
    id: 'piratecapitan', name: 'Kapitan Zachłanności', emoji: '🏴‍☠️', order: 18, unlockLevel: 80, hp: 1770,
    attackKind: 'sword', // attaksword_piratecapitan.png
    weakness: 'sweetless', weaknessLabel: 'dni bez słodyczy',
    loot: { id: 'loot_treasuremap', name: 'Mapa Skarbów', emoji: '🗺️', desc: '+10% energii, +4% atak', bonus: { energyMult: 0.10, atk: 0.04 } },
    coins: 4500, xp: 45000, taunt: 'Jeszcze jedno, jeszcze trochę więcej…',
  },
  {
    id: 'hades', name: 'Władca Katastrof', emoji: '🔥', order: 19, unlockLevel: 88, hp: 2040,
    weakness: 'sleep', weaknessLabel: 'sen (7h+)',
    loot: { id: 'loot_hadesscepter', name: 'Berło Podziemi', emoji: '⚱️', desc: '+11% uniku, +4% atak', bonus: { dodge: 0.11, atk: 0.04 } },
    coins: 6800, xp: 68000, taunt: 'Wszystko na pewno się posypie…', regenPct: 0.04,
  },
  {
    id: 'clown', name: 'Maska Uśmiechu', emoji: '🤡', order: 20, unlockLevel: 97, hp: 2190,
    weakness: 'mood', weaknessLabel: 'wpisy nastroju',
    loot: { id: 'loot_truthmask', name: 'Maska Prawdy', emoji: '🎭', desc: '+9% kryt, +5% atak', bonus: { crit: 0.09, atk: 0.05 } },
    coins: 10000, xp: 100000, taunt: 'Uśmiechnij się, nikt nie musi wiedzieć…',
  },
  {
    id: 'princess', name: 'Czekanie Na Ratunek', emoji: '👸', order: 21, unlockLevel: 106, hp: 2340,
    weakness: 'habits', weaknessLabel: 'nawyki',
    loot: { id: 'loot_crownindep', name: 'Korona Niezależności', emoji: '👑', desc: '+12% energii, +5% uniku', bonus: { energyMult: 0.12, dodge: 0.05 } },
    coins: 15000, xp: 150000, taunt: 'Ktoś w końcu to za ciebie naprawi…',
  },
  {
    id: 'wizard', name: 'Iluzja Kontroli', emoji: '🧙', order: 22, unlockLevel: 116, hp: 2690,
    attackKind: 'magic', // magicattack_wizard.png
    weakness: 'water', weaknessLabel: 'woda (cel dnia)',
    loot: { id: 'loot_clarity', name: 'Różdżka Jasności', emoji: '🪄', desc: '+14% atak, +10% uniku, +10% energii, +8% kryt', bonus: { atk: 0.14, dodge: 0.10, energyMult: 0.10, crit: 0.08 } },
    coins: 22000, xp: 225000, taunt: 'Machniesz różdżką jutro i będzie dobrze, prawda…', guard: true,
  },
];

export function bossById(id: string): Boss | undefined { return BOSSES.find(b => b.id === id); }

// Placeholder "nazwa" dla bossa kampanii dalej w kolejności, jeszcze nie odblokowanego
// (2026-08-18, user: "musimy zrobić że mają znaki zapytania i ciemne kształty... a ich nazwy
// to jakieś mityczne znaki, że nie wiadomo o co chodzi... dopóki nie pokonasz wcześniejszego").
// Świadomie NIE custom font (user zaproponował "pobrać czcionkę ze specjalnymi znakami", ale
// to nowy asset do dociągnięcia + licencja + expo-font setup dla czegoś czysto kosmetycznego)
// — gotowy, uniwersalnie renderowalny Unicode (bloki Misc Symbols/Dingbats/Alchemical, szeroko
// wspierane na Androidzie) daje TEN SAM efekt "mistycznych znaków" bez nowego assetu.
// Deterministyczne po `id` (ten sam hash-wzorzec co `raidForWeek` w raid.ts) — TEN SAM boss
// zawsze pokazuje TEN SAM placeholder, nie migocze losowo między odświeżeniami ekranu.
const MYSTERY_GLYPHS = ['✦', '✧', '☽', '☾', '⚝', '✵', '⟁', '⌬', '⚚', '✴', '⛧', '❖', '◈', '⚶'];
export function mysteryBossName(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const a = MYSTERY_GLYPHS[h % MYSTERY_GLYPHS.length];
  const b = MYSTERY_GLYPHS[(h >> 4) % MYSTERY_GLYPHS.length];
  const c = MYSTERY_GLYPHS[(h >> 8) % MYSTERY_GLYPHS.length];
  return `${a}${b}${c}`;
}

// Ranga bossa kampanii — DERYWOWANA z unlockLevel, nie osobne pole do ręcznego tagowania
// (mniej okazji do pomyłki, nowe bossy klasyfikują się same). Granica 26 = już istniejący
// komentarz „endgame" przy insomnia niżej. Podstawa pod przyszłą pasywkę „blokuj % ataków
// common bossów" — raid/wydarzenia mają OSOBNE typy (Raid/EventBoss), więc są „event" z
// definicji, bez potrzeby dodatkowego pola.
export type BossTier = 'common' | 'elite';
export function bossTier(boss: Boss): BossTier {
  return boss.unlockLevel >= 26 ? 'elite' : 'common';
}

export interface Bonuses { atk: number; dodge: number; crit: number; energyMult: number }

export function bossBonuses(ownedItems: string[]): Bonuses {
  const b: Bonuses = { atk: 0, dodge: 0, crit: 0, energyMult: 0 };
  for (const boss of BOSSES) {
    if (!ownedItems.includes(boss.loot.id)) continue;
    const { atk, dodge, crit, energyMult } = boss.loot.bonus;
    b.atk += atk ?? 0; b.dodge += dodge ?? 0; b.crit += crit ?? 0; b.energyMult += energyMult ?? 0;
  }
  return b;
}

export function atkMultiplier(level: number, bonuses: Bonuses): number {
  return 1 + level * 0.03 + bonuses.atk;
}

// Ile itemów bojowych naraz w ekwipunku (v4 — patrz memory boss_design.md). Bazowo 3
// (mieści headshot+jedną obronę+jedną ofensywę). Od 2026-08-13 (user: "co jakiś lvl kotek
// upgraduje ilość slotów itemów") rośnie z poziomem — +1 co 6 poziomów, cap 6 przy Lv18
// (pokrywa się z growthStage 'adult' od Lv12 w petStore.ts, więc dorosły kotek jest już
// w połowie drogi do maksa). Żyje tu (nie w petStore.ts) — czysta funkcja poziom→liczba,
// ten sam wzorzec co atkMultiplier/dailyAttempts wyżej/niżej, łatwa do testowania bez
// odpalania całego Zustand store.
export const COMBAT_ITEM_SLOTS = 3;
export function combatItemSlotsFor(level: number): number {
  return Math.min(6, COMBAT_ITEM_SLOTS + Math.floor(Math.max(1, level) / 6));
}

// Bazowa moc ataku, ZANIM doliczysz poziom/staty/łup — jedna stała, żeby balans żył
// w jednym miejscu. Realna moc = (BASE_ATK + atkStatBonus-za-monety) × atkMultiplier.
export const BASE_ATK = 40;
export function atkPower(atkStatBonus: number, level: number, bonuses: Bonuses): number {
  return (BASE_ATK + Math.max(0, atkStatBonus)) * atkMultiplier(level, bonuses);
}

// Ile prób walki dziennie — FLAT, nie liczone z danych zdrowia (v5 pivot). Loot z
// energyMult daje WIĘCEJ prób, nie większą siłę ciosu (siła to już atkPower). Od 2026-08-18
// używane TYLKO przez raid (`raidEnergy`/`syncRaidEnergy`) — kampania/MAD dostały OSOBNY,
// regenerujący się w czasie model, patrz ENERGY_MAX/ENERGY_REGEN_HOURS niżej.
export const BASE_DAILY_ATTEMPTS = 3;
export function dailyAttempts(energyMult: number): number {
  return Math.max(1, Math.round(BASE_DAILY_ATTEMPTS * (1 + Math.max(0, energyMult))));
}

// Energia kampanii/MAD — regeneruje się w CZASIE RZECZYWISTYM, nie flat raz dziennie
// (2026-08-18, user po odrzuceniu wcześniejszego gate'u "1 nowy boss dziennie": "wolałem
// zamiast jeden dziennie raz na 3h atak może? i maksymalnie regeneruje się do 2 energii").
// Zamierzony efekt TEN SAM co odrzucony gate (nie da się zblitzować kampanii w jednej
// sesji), ale przez organiczny mechanizm regeneracji zamiast sztywnej ściany "wróć jutro" —
// można wydać oba punkty naraz, ale trzeba poczekać (realnie, nie do północy) na kolejne.
// Świadomie FLAT, bez skalowania energyMult z łupu (user podał konkretne liczby bez
// wspominania o skalowaniu) — energyMult dalej ma sens dla raidu/eventu, po prostu przestał
// wpływać na energię kampanii.
export const ENERGY_MAX = 2;
export const ENERGY_REGEN_HOURS = 3;

// Czyste, testowalne jądro regeneracji — petStore.ts woła je z realnym `Date.now()`, testy
// wołają z ustalonym `now`. `regenAt` = ISO czas kiedy dotrze NASTĘPNY punkt (null = bank
// pełny, nic nie tyka).
export interface EnergyState { energy: number; regenAt: string | null }

// Doganianie tyknięć które minęły (np. offline) — PĘTLA, nie jedno odejmowanie różnicy
// czasu, żeby zwrócony `regenAt` zawsze wskazywał REALNY, przyszły moment, nigdy przeszły.
export function energyRegenTick(energy: number, regenAt: string | null, now: number = Date.now()): EnergyState {
  if (energy >= ENERGY_MAX) return { energy: ENERGY_MAX, regenAt: null };
  if (!regenAt) return { energy, regenAt: new Date(now + ENERGY_REGEN_HOURS * 3600000).toISOString() };
  let e = energy;
  let nextAt = new Date(regenAt).getTime();
  while (nextAt <= now && e < ENERGY_MAX) {
    e++;
    nextAt += ENERGY_REGEN_HOURS * 3600000;
  }
  if (e >= ENERGY_MAX) return { energy: ENERGY_MAX, regenAt: null };
  return { energy: e, regenAt: new Date(nextAt).toISOString() };
}

// -1 z banku. Zegar startuje TYLKO przy przejściu pełny→niepełny — jeśli już tykał (bank był
// już niepełny), zostaje bez zmian, żeby wydanie drugiego punktu nie zresetowało postępu w
// stronę pierwszego.
export function energySpendTick(energy: number, regenAt: string | null, now: number = Date.now()): EnergyState {
  const wasFull = energy >= ENERGY_MAX;
  const next = Math.max(0, energy - 1);
  const nextRegenAt = wasFull ? new Date(now + ENERGY_REGEN_HOURS * 3600000).toISOString() : regenAt;
  return { energy: next, regenAt: nextRegenAt };
}

// Wydarzenia (2026-08-12): user — "musimy zrobić żeby walki eventowe były identyczne [do
// kampanii]... wtedy mamy jedno podejście eventowe dziennie [UWAGA: zwykłe bossy zostają
// przy 3/dzień]". Była FLAT stała, celowo NIE rosnąca z energyMult z łupu, żeby "jedna
// próba" zostawało jedną próbą niezależnie od inwestycji.
//
// Fix 2026-08-17 (user: "mam tam 7 energii a nie mogę walczyć dodatkowo... jak mam energię
// na bossy to energia na bossy, a mam drugą inną energię łącznie na bossy eventowe") —
// event ma FLAT 1 próbę/dzień niezależnie od tego, ile energyMult gracz uzbierał, a event ma
// twardy termin (patrz eventEndsAt/eventDaysLeft w seasonalEvents.ts) — leftover inwestycja
// w energyMult była bezużyteczna tam, gdzie najbardziej mogłaby pomóc zdążyć przed terminem.
// `eventDailyAttempts` skaluje SŁABIEJ niż kampania (dailyAttempts wyżej) i ma twardy cap —
// event ma zostać wyraźnie rzadszy niż kampania nawet przy maksymalnej inwestycji (przy
// obecnym maksymalnym sumarycznym energyMult z całego łupu kampanii, ~0.75, kampania daje
// round(3×1.75)=5 prób, event capuje na 3) — inwestycja się liczy, ale event nie trywializuje
// się tak jak kampania.
export const EVENT_BASE_DAILY_ATTEMPTS = 1;
export const EVENT_MAX_DAILY_ATTEMPTS = 3;
export function eventDailyAttempts(energyMult: number): number {
  const bonus = Math.round(Math.max(0, energyMult) * 2);
  return Math.min(EVENT_MAX_DAILY_ATTEMPTS, EVENT_BASE_DAILY_ATTEMPTS + bonus);
}

// ── Kontratak bossa (v4 redesign, fundament — patrz memory boss_design.md) ────────
// Skaluje z HP bossa, nie z poziomem gracza — tak jak walka z bossem samym w sobie już
// skaluje trudność. `dodge` z Bonuses redukuje obrażenia (0 = pełny cios, 0.9 = maks.
// redukcja — ten sam cap co przy regen bossa).
//
// FIX (2026-08-13, patrz memory boss_design.md „balance review"): pierwotnie liczyło się
// od STAŁEGO `boss.hp` (max), więc KAŻDY kontratak w całej walce był tej samej wielkości —
// bez znaczenia ile bossowi już zostało. Połączone z tym, że „ciosów potrzeba" TEŻ rośnie z
// boss.hp, całkowite obrażenia na kotka w jednej walce rosły z KWADRATEM HP bossa. Przy
// rozstępie HP bossów kampanii 300→368000 (×1200) to była gwarantowana śmierć od jednego
// kontrataku już od ok. połowy roster'a, niezależnie od inwestycji. Teraz bierze AKTUALNE,
// nie maksymalne HP — słabnie w miarę jak bossa zbijasz, więc nie eksploduje kwadratowo.
// Nie jest to jeszcze pełne rozwiązanie „endgame jest zbyt trudny" (to osobna decyzja o
// krzywej HP bossów / mocy ataku — patrz memory), ale usuwa patologiczne, niewygrywalne
// przypadki i sprawia że kontratak faktycznie reaguje na przebieg walki, nie tylko na to
// KTÓRY to boss.
const COUNTER_PCT = 0.04; // ułamek AKTUALNEGO hp bossa zadawany kotkowi na kontratak
//
// FIX 2026-08-17 (throwaway-symulacją, znalezione przy audycie "za łatwe walki" — patrz
// komentarz nad BOSSES): `guard` (Twój cios ×0.5) BEZ zmiany tutaj podwaja skumulowany
// kontratak w całej walce względem bossa bez guard o tym samym hp — potrzeba ~2× rund
// (bo każdy Twój cios słabszy), a każda z tych rund nadal liczy kontratak jako 4% AKTUALNEGO
// hp bossa, które przy guard maleje WOLNIEJ (mniej dmg/rundę), więc suma kontrataków rośnie,
// nie tylko liczba rund. Symulacja: bez tego fixu boss #22 (finał kampanii, Iluzja Kontroli)
// był praktycznie niewygrywalny (0% winrate) nawet przy realistycznej inwestycji. `guard`
// tnie kontratak o połowę tutaj — przywraca parytet: guard boss z tym samym hp/docelową
// liczbą ciosów daje w sumie TYLE SAMO skumulowanych obrażeń na kotka co odpowiednik bez
// guard, zamiast dwa razy tyle. Guard nadal robi swoje (2× dłuższa walka, tankowy typ), tylko
// przestaje BEZ ZAMIERZENIA mnożyć całkowite ryzyko.
export function counterDamage(currentBossHp: number, dodge: number, guard = false): number {
  const base = Math.max(0, currentBossHp) * COUNTER_PCT * (guard ? 0.5 : 1);
  return Math.round(base * (1 - Math.min(0.9, Math.max(0, dodge))));
}

// One hit: pełna moc ataku (staty+poziom+łup), lekka losowa wariancja (0.85–1.15) żeby
// nie było matematycznie identyczne co runda, kryt dubluje. ZERO wpływu danych zdrowia.
export function computeDamage(atkStatBonus: number, level: number, bonuses: Bonuses): { damage: number; crit: boolean } {
  const variance = 0.85 + Math.random() * 0.3;
  const crit = Math.random() < bonuses.crit;
  return { damage: Math.round(atkPower(atkStatBonus, level, bonuses) * variance * (crit ? 2 : 1)), crit };
}

// ── Symulacja walki 1v1 (v4 redesign, S&F-style — patrz memory boss_design.md) ────
// Czysta funkcja, NIC jeszcze jej nie wywołuje w grze (bezpieczny krok przygotowawczy,
// jak counterDamage wyżej). Cała walka rozstrzyga się w jednym wywołaniu — RUNDY
// wymiany ciosów aż KTOŚ padnie, nie sztywna liczba: Twój cios (z szansą kryt) → jeśli
// boss przeżył → jego kontratak na kotka, i tak w kółko. Walka kończy się NATYCHMIAST
// gdy któraś strona spadnie do 0 HP — trafienie w bossa zawsze rozstrzyga się PRZED
// jego kontratakiem, więc nie ma martwego remisu „oboje padli w tej samej rundzie".
// User (2026-08-11), po tym jak walka kończyła się „PRZEGRANA" mimo połowy HP kotka:
// "chcialem do końca na hp kto ma zero ten przegrywa a nie na 3 rundy" — poprzednio
// walka NIEZALEŻNIE od wyniku ucinała się po 3 wymianach ciosów (a nawet boss #1 miał
// za dużo HP żeby zabić go w 3 ciosach bez zakupionych statów, więc w praktyce prawie
// zawsze kończyło się „wyczerpaniem rund", nie realną wygraną/porażką). Teraz limit to
// czysto DEFENSYWNY sufit (nigdy nie powinien być osiągnięty w normalnej grze — trafia
// się tylko w skrajnym teoretycznym remisie regen+guard), nie normalny wynik walki.
// PRZEGRANA (catHp=0) LUB (skrajnie rzadkie) wyczerpanie sufitu bez zabicia = to samo
// dla bossa kampanii: jego HP resetuje się do pełna na następną próbę (karczma S&F) —
// `won` to jedyny wynik, który się liczy trwale; `catFainted` jest tylko do komunikatu w UI.
export const MAX_FIGHT_ROUNDS = 200;

export interface FightRound {
  playerDmg: number;
  playerCrit: boolean;
  bossHpAfter: number;
  healed: number;       // REGENERACJA bossa tej rundy (0 = brak)
  counterDmg: number;
  catHealed: number;    // item „heal" zadziałał tej rundy (0 = brak)
  catHpAfter: number;
  thornDmg: number;     // item „cierń" zadziałał tej rundy (0 = brak) — było liczone w bossHpAfter
                         // bez własnego pola, więc UI nie miało jak pokazać że w ogóle coś zrobił
}

export interface FightResult {
  rounds: FightRound[];
  won: boolean;         // HP bossa spadło do 0
  catFainted: boolean;  // HP kotka spadło do 0 (walka przegrana, nie wygrana)
  guarded: boolean;      // ten boss ma wrodzoną osłonę — Twoje ciosy ×0.5 (nie zależy już od dziś)
  bossHpLeft: number;
  catHpLeft: number;
}

export interface EquippedItem { id: CombatItemId; level: number }

// `items` DOMYŚLNIE PUSTA — dopóki nie ma UI do zakładania (ekwipunek w petStore już
// istnieje, ale nic go jeszcze nie ustawia), każde dotychczasowe wywołanie zachowuje
// się DOKŁADNIE jak przed tym commitem dla graczy bez itemów. `atkStatBonus` = trwały
// stat kupiony za monety (v5 pivot) — jedyne źródło mocy poza poziomem/łupem/itemami.
export function simulateFight(
  atkStatBonus: number, level: number, bonuses: Bonuses, boss: Boss,
  catHpStart: number, roundCount: number = MAX_FIGHT_ROUNDS, items: EquippedItem[] = [],
): FightResult {
  const guarded = !!boss.guard;         // wrodzona cecha, nie zależy od wc
  const willRegen = !!boss.regenPct;    // wrodzona cecha (enrage), nie zależy od wc
  const levelOf = (id: CombatItemId) => items.find(it => it.id === id)?.level ?? 0;
  const has = (id: CombatItemId) => levelOf(id) > 0;

  let bossHp = boss.hp;
  let catHp = catHpStart;
  let ignited = false;   // item 'fire' — raz podpalony, DoT do końca walki
  let healUsed = false;  // item 'heal' — jednorazowe w całej walce
  const rounds: FightRound[] = [];

  for (let i = 0; i < roundCount; i++) {
    if (bossHp <= 0 || catHp <= 0) break;
    let { damage, crit } = computeDamage(atkStatBonus, level, bonuses);
    if (guarded) damage = Math.round(damage * 0.5);
    if (has('headshot') && Math.random() < HEADSHOT_CHANCE) damage = Math.round(damage * 2);
    bossHp = Math.max(0, bossHp - damage);

    // 'fire' — szansa na podpalenie (raz), potem gwarantowany DoT co rundę do końca walki
    if (has('fire') && !ignited && bossHp > 0 && Math.random() < fireProcChanceAt(levelOf('fire'))) ignited = true;
    if (ignited && bossHp > 0) bossHp = Math.max(0, bossHp - Math.round(boss.hp * FIRE_DOT_PCT));

    let counterDmg = 0;
    let healed = 0;
    let thornDmg = 0;
    if (bossHp > 0) {
      // 'execute' — HP bossa poniżej progu → instakill (sprawdzone PRZED regeneracją,
      // żeby regen nie mógł "uratować" bossa z progu egzekucji tej samej rundy)
      if (has('execute') && bossHp / boss.hp < executeThresholdAt(levelOf('execute'))) {
        bossHp = 0;
      } else {
        if (willRegen) {
          healed = Math.round(boss.hp * boss.regenPct!);
          bossHp = Math.min(boss.hp, bossHp + healed);
        }
        // 'mindcontrol' — szansa, że boss w ogóle nie kontratakuje tej rundy
        const controlled = has('mindcontrol') && Math.random() < MIND_CONTROL_CHANCE;
        if (!controlled) {
          counterDmg = counterDamage(bossHp, bonuses.dodge, guarded);
          // 'dodge' — całkowity unik kontrataku
          if (counterDmg > 0 && has('dodge') && Math.random() < dodgeChanceAt(levelOf('dodge'))) counterDmg = 0;
          // 'reflect' — szansa odbić kontratak na bossa zamiast na kotka
          if (counterDmg > 0 && has('reflect') && Math.random() < reflectPctAt(levelOf('reflect'))) {
            bossHp = Math.max(0, bossHp - counterDmg);
            counterDmg = 0;
          }
          // 'shield' — stała redukcja tego co faktycznie dolatuje do kotka
          if (counterDmg > 0 && has('shield')) counterDmg = Math.round(counterDmg * (1 - SHIELD_REDUCTION_PCT));
          if (counterDmg > 0) catHp = Math.max(0, catHp - counterDmg);
          // 'thorn' — gwarantowane małe odbicie, bez szansy, niezależnie od 'reflect'. Osobne
          // pole (nie tylko wliczone w bossHpAfter) — inaczej UI nie miało jak pokazać że w
          // ogóle coś zrobił, user: "nie widzę żeby był aktywny jakoś podczas walki realnie".
          if (has('thorn') && bossHp > 0) {
            thornDmg = Math.min(bossHp, Math.round(boss.hp * THORN_PCT));
            bossHp = Math.max(0, bossHp - thornDmg);
          }
        }
      }
    }

    // 'heal' — pierwszy raz w tej walce, gdy HP kotka spadnie <50%
    let catHealed = 0;
    if (has('heal') && !healUsed && catHp > 0 && catHp / catHpStart < 0.5) {
      catHealed = Math.round(catHpStart * HEAL_ONCE_PCT);
      catHp = Math.min(catHpStart, catHp + catHealed);
      healUsed = true;
    }

    rounds.push({ playerDmg: damage, playerCrit: crit, bossHpAfter: bossHp, healed, counterDmg, catHealed, catHpAfter: catHp, thornDmg });
  }
  return { rounds, won: bossHp <= 0, catFainted: catHp <= 0 && bossHp > 0, guarded, bossHpLeft: bossHp, catHpLeft: catHp };
}

export type BossStatus = 'locked' | 'active' | 'defeated';
export function bossStatus(boss: Boss, level: number, defeated: string[]): BossStatus {
  if (defeated.includes(boss.id)) return 'defeated';
  if (level < boss.unlockLevel) return 'locked';
  return 'active';
}

// Remaining HP for a boss (full until damaged).
export function bossRemaining(boss: Boss, bossHp: Record<string, number>): number {
  return bossHp[boss.id] ?? boss.hp;
}

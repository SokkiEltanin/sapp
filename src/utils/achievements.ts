import AsyncStorage from '@react-native-async-storage/async-storage';
import { Expense, CalendarEvent } from '@/types';
import { isSelfTransfer } from './statWidgets';
import { isWorkEvent, shiftHours } from './workEvents';

// ── Context the achievements are evaluated against ──────────────────────────
export interface AchCtx {
  habitBestStreak: number;
  noJunkStreak: number;
  savingsTotal: number;
  receiptsCount: number;
  moodDays: number;
  workHoursTotal: number;
  paydayLogged: boolean;
  bestStepsDay: number;
  billTracked: boolean;
  // richer signals (added for the custom-icon set)
  logStreak: number;         // consecutive days (→ today) with any expense/mood logged
  activeDays: number;        // distinct days with any activity
  goodMoodStreak: number;    // consecutive days (→ today) with mood ≥ 4
  moodLevelsSeen: number;    // distinct mood levels (1..5) ever logged
  balancedMonth: boolean;    // any month where income ≥ expenses
  hasBudget: boolean;        // a budget is set
  tasksDone: number;         // all-time completed tasks
  goodSleepStreak: number;   // consecutive nights (→ today) with sleep ≥ 7 h
  lowMoodStreak: number;     // consecutive days (→ today) with mood ≤ 2 (anti)
  neutralMoodStreak: number; // consecutive days (→ today) with mood exactly 3
  moodSwing7: boolean;       // last 7 days mood spanned ≤2 and ≥4 (big swing)
  noSpendStreak: number;     // consecutive days (→ today) with zero spending
  trainTrips: number;        // train-ticket purchases (PKP/Intercity/Koleo…)
  japanItems: number;        // Japanese products bought (matcha/mochi/sushi…)
  drinkPurchasesMonth: number; // sugary/other drinks bought this month
  meatWeekMaxKg: number;     // most kg of meat in any rolling 7-day window
  cutElectricity: boolean;   // latest electricity bill well below the average
  maxSinglePurchase: number; // biggest single expense (zł)
  bettingBought: boolean;    // lottery/betting/casino purchase
  maxTxPerDay: number;       // most separate transactions in one day
  distinctCategories: number;// distinct expense categories ever used
  cardBalancePeak: number;   // highest card balance ever reached
  monthUnderBudget: boolean; // a completed month closed under the total budget
  // anti-achievement signals
  junkStreak: number;        // consecutive days (→ today) WITH a junk purchase
  badSleepStreak: number;    // consecutive nights (→ today) with sleep < 5 h
  overBudgetPct: number;     // this-month spend ÷ total budget (1 = exactly on budget)
  junkPurchasesMonth: number;// sweets purchases this month
  fastFoodCount: number;     // all-time fast-food purchases
  maxDaySpend: number;       // biggest single-day spend (zł)
}

export type AchGroup = 'Nawyki' | 'Jedzenie' | 'Oszczędzanie' | 'Praca' | 'Nastrój' | 'Zdrowie' | 'Konsekwencja' | 'Życie' | 'Legendy' | 'Grzeszki';
export type Tier = 1 | 2 | 3 | 4; // 4 = legendary

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  group: AchGroup;
  tier: Tier;
  target: number;
  unit?: string;
  kind?: 'good' | 'bad';   // bad = anti-achievement (red, "earned" by slipping up)
  lore?: string;           // flavour — why THIS icon fits THIS achievement
  value: (c: AchCtx) => number;
}

export const TIER_COLOR: Record<Tier, string> = { 1: '#CD7F32', 2: '#C4CAD4', 3: '#FFC83D', 4: '#A855F7' };
export const BAD_COLOR = '#E5484D';

export const ACHIEVEMENTS: Achievement[] = [
  // ── Start / Konsekwencja (custom icons) ──
  { id: 'first-key', title: 'Pierwszy klucz', desc: 'Pierwszy zalogowany wydatek', group: 'Konsekwencja', tier: 1, target: 1,
    lore: 'Klucz do skarbca Twoich finansów. Pierwszy wpis go przekręca — bez niego cała reszta statystyk pozostaje zamknięta na głucho.', value: c => c.receiptsCount >= 1 ? 1 : 0 },
  { id: 'scanner',   title: 'Skaner',         desc: '50 zalogowanych wydatków',     group: 'Konsekwencja', tier: 2, target: 50, unit: '×',
    lore: 'Odcisk palca jest niepowtarzalny — jak Twój wzorzec wydatków. Po 50 paragonach apka rozpoznaje Twoje nawyki na pierwszy „skan".', value: c => c.receiptsCount },
  { id: 'groceries-100', title: 'Zakupowicz', desc: '100 zalogowanych wydatków',    group: 'Konsekwencja', tier: 3, target: 100, unit: '×',
    lore: 'Ta torba już się nie domyka. 100 wpisów dźwiganych jak weteran działu spożywczego — znasz każdą alejkę na pamięć.', value: c => c.receiptsCount },
  { id: 'on-track',  title: 'Na kursie',      desc: '7 dni z rzędu coś zalogowane', group: 'Konsekwencja', tier: 2, target: 7, unit: 'dni',
    lore: 'Kompas nie gubi północy. Tydzień bez ani jednego pominiętego dnia — trzymasz kurs nawet, gdy łatwiej byłoby zboczyć.', value: c => c.logStreak },
  { id: 'loyal',     title: 'Wierny',         desc: '30 aktywnych dni w aplikacji', group: 'Konsekwencja', tier: 3, target: 30, unit: 'dni',
    lore: 'Inne apki dawno skamieniały na ekranie jak ta prehistoryczna czaszka. Ty zostałeś — okaz wytrwałości godny muzeum.', value: c => c.activeDays },
  { id: 'goal-set',  title: 'Wyznaczony cel', desc: 'Ustawiony pierwszy budżet',    group: 'Konsekwencja', tier: 1, target: 1,
    lore: 'Drogowskaz na finansowym rozstaju. Ustawiłeś budżet — od teraz wiadomo, dokąd naprawdę zmierzają Twoje pieniądze.', value: c => c.hasBudget ? 1 : 0 },
  { id: 'first-week', title: 'Świeżo wyklute', desc: '7 aktywnych dni w aplikacji', group: 'Konsekwencja', tier: 1, target: 7, unit: 'dni',
    lore: 'Coś się właśnie wykluło z jaja. Pierwszy tydzień za Tobą — Twoja przygoda z apką dopiero rozprostowuje łapki.', value: c => c.activeDays },

  // ── Nastrój (custom icons) ──
  { id: 'sunny-week', title: 'Słoneczny tydzień', desc: '7 dni z rzędu nastrój ≥ 4', group: 'Nastrój', tier: 2, target: 7, unit: 'dni',
    lore: 'Wewnętrzne słońce nie zaszło ani razu przez cały tydzień. Siedem dni pogody ducha — świeć dalej.', value: c => c.goodMoodStreak },
  { id: 'self-care',  title: 'Dbam o siebie',     desc: '30 dni z wpisem nastroju',  group: 'Nastrój', tier: 2, target: 30, unit: 'dni',
    lore: 'Serce nie tylko bije — Ty go słuchasz. Przez 30 dni sprawdzałeś, jak naprawdę się czujesz. To jest troska.', value: c => c.moodDays },
  { id: 'full-range', title: 'Pełnia emocji',     desc: 'Zalogowane wszystkie nastroje 1–5', group: 'Nastrój', tier: 1, target: 5, unit: '/5',
    lore: 'Komedia i tragedia, i wszystko pomiędzy. Zagrałeś pełną gamę masek — prawdziwy teatr jednego aktora.', value: c => c.moodLevelsSeen },
  { id: 'chronicler', title: 'Kronikarz',         desc: '60 dni z wpisem nastroju',  group: 'Nastrój', tier: 3, target: 60, unit: 'dni',
    lore: 'Twój nastrój ma już własny zwój kroniki. 60 wpisów spisanych jak starożytny papirus — historia jednej duszy.', value: c => c.moodDays },
  { id: 'zen', title: 'Rozkwit', desc: '14 dni z rzędu nastrój ≥ 4', group: 'Nastrój', tier: 3, target: 14, unit: 'dni',
    lore: 'Dwa tygodnie pogody ducha i wewnętrzna róża rozkwitła. Nawet kolce zamieniły się w płatki.', value: c => c.goodMoodStreak },
  { id: 'poker-face', title: 'Poker Face', desc: '7 dni z rzędu nastrój dokładnie 3', group: 'Nastrój', tier: 1, target: 7, unit: 'dni',
    lore: 'Ani wzlotów, ani upadków — kamienna twarz przez cały tydzień. Krupier nie odczytałby z niej nic. Może czas coś poczuć?', value: c => c.neutralMoodStreak },

  // ── Zdrowie / Praca (custom icons) ──
  { id: 'marathon', title: 'Maraton dnia', desc: '10 000 kroków w jeden dzień', group: 'Zdrowie', tier: 1, target: 10000, unit: 'kroków',
    lore: 'Te trekkingowe buty dziś zarobiły na odpoczynek. 10 000 kroków — Twój prywatny maraton bez mety.', value: c => c.bestStepsDay },
  { id: 'well-rested', title: 'Wyspany', desc: '7 nocy z rzędu snu ≥ 7 h', group: 'Zdrowie', tier: 2, target: 7, unit: 'nocy',
    lore: 'Siedem nocy pod miękką kołdrą, każda po pełne 7 godzin. Zzz… Twój mózg dziękuje za regenerację.', value: c => c.goodSleepStreak },
  { id: 'doer',     title: 'Wykonawca',    desc: '25 ukończonych zadań',        group: 'Praca',   tier: 2, target: 25, unit: '×',
    lore: 'Nie odkładasz — naciskasz przycisk i robisz. Klik. Zrobione. 25 razy palec wylądował na „wykonaj".', value: c => c.tasksDone },
  { id: 'tasks-50', title: 'Listoholik',   desc: '50 ukończonych zadań',        group: 'Praca',   tier: 3, target: 50, unit: '×',
    lore: 'Odhaczasz szybciej, niż zdążysz dopisać. 50 zadań przekreślonych na liście — ptaszek za ptaszkiem.', value: c => c.tasksDone },

  // ── Oszczędzanie (justice-scale custom + lucide) ──
  { id: 'balanced',   title: 'W równowadze', desc: 'Miesiąc na plusie (przychód ≥ wydatki)', group: 'Oszczędzanie', tier: 2, target: 1,
    lore: 'Szala przychodów przeważyła wydatki. Waga sprawiedliwości tym razem po Twojej stronie — miesiąc na plusie.', value: c => c.balancedMonth ? 1 : 0 },
  { id: 'under-limit', title: 'Pod limitem',  desc: 'Miesiąc zamknięty pod budżetem', group: 'Oszczędzanie', tier: 2, target: 1,
    lore: 'Znak ograniczenia był po Twojej stronie. Zwolniłeś w porę i zmieściłeś się w budżecie — zero mandatu.', value: c => c.monthUnderBudget ? 1 : 0 },
  { id: 'power-saver', title: 'Oszczędny prąd', desc: 'Rachunek za prąd ≥20% pod średnią', group: 'Oszczędzanie', tier: 2, target: 1,
    lore: 'Zgaszone światła, wyłączone czuwanie. Twój ostatni rachunek za prąd spadł grubo pod średnią — licznik zwolnił, portfel odetchnął.', value: c => c.cutElectricity ? 1 : 0 },
  { id: 'fat-wallet', title: 'Gruby portfel', desc: 'Saldo karty przekroczyło 5 000 zł (rekord)', group: 'Oszczędzanie', tier: 3, target: 5000, unit: 'zł',
    lore: 'Worek pełen po brzegi. Na koncie zabłysło ponad 5 000 zł — a licznik pokazuje Twój życiowy rekord grubości portfela.', value: c => c.cardBalancePeak },
  { id: 'saver-1000', title: 'Tysiąc',       desc: 'Łącznie 1 000 zł odłożone',  group: 'Oszczędzanie', tier: 1, target: 1000,  unit: 'zł',
    lore: 'Pierwszy tysiąc odłożony do koperty. Banknot z sercem — bo odkładanie na siebie to najczystsza forma dbania o przyszłość.', value: c => c.savingsTotal },
  { id: 'saver-5000', title: 'Poduszka',     desc: 'Łącznie 5 000 zł odłożone',  group: 'Oszczędzanie', tier: 2, target: 5000,  unit: 'zł',
    lore: 'Stos monet urósł w miękką poduszkę bezpieczeństwa. 5 000 zł — na takiej poduszce śpi się spokojniej.', value: c => c.savingsTotal },
  { id: 'saver-10000',title: 'Forteca',      desc: 'Łącznie 10 000 zł odłożone', group: 'Oszczędzanie', tier: 3, target: 10000, unit: 'zł',
    lore: 'Szlachetny kamień w Twoim skarbcu. 10 000 zł — twarde jak rubin i tak samo trudne do skruszenia.', value: c => c.savingsTotal },

  // ── Loyalty / brand (custom) ──
  { id: 'loyal-heart', title: 'Z sercem', desc: '60 aktywnych dni — apka to nawyk', group: 'Konsekwencja', tier: 3, target: 60, unit: 'dni',
    lore: 'Medal z sercem w środku. Nie chodzi już o obowiązek — wracasz z sentymentu. Wy dwoje: związek na medal.', value: c => c.activeDays },

  // ── Lucide-only (no custom icon yet) ──
  { id: 'habit-streak-7',  title: 'Tydzień mocy', desc: '7 dni nawyku z rzędu',  group: 'Nawyki', tier: 2, target: 7,  unit: 'dni',
    lore: 'Kaktus nie potrzebuje wiele, by przetrwać i rosnąć każdego dnia. Tydzień nawyku — Ty też kwitniesz na uporze.', value: c => c.habitBestStreak },
  { id: 'habit-streak-30', title: 'Żelazna wola', desc: '30 dni nawyku z rzędu', group: 'Nawyki', tier: 3, target: 30, unit: 'dni',
    lore: 'Z małego pnia wystrzelił pęd. 30 dni i nawyk zakorzenił się na dobre — teraz to część Ciebie.', value: c => c.habitBestStreak },
  { id: 'no-junk-7',  title: 'Tydzień fit', desc: '7 dni z rzędu bez słodyczy', group: 'Jedzenie', tier: 2, target: 7, unit: 'dni',
    lore: 'Siedem dni i ani jednego cukrowego poślizgu. Twój organizm przybija Ci piątkę.', value: c => c.noJunkStreak },
  { id: 'work-100h',  title: 'Maszyna',     desc: 'Łącznie 100 h pracy',        group: 'Praca', tier: 2, target: 100, unit: 'h',
    lore: 'Pracujesz jak dobrze naoliwiony mechanizm — bez zacięć, bez postoju. 100 godzin na liczniku maszyny.', value: c => c.workHoursTotal },
  { id: 'payday-first', title: 'Pierwsza wypłata', desc: 'Zalogowana pierwsza wypłata', group: 'Praca', tier: 1, target: 1,
    lore: 'Pierwszy banknot wpadł do systemu. Od teraz apka wie, ile realnie zarabiasz — i pilnuje reszty.', value: c => c.paydayLogged ? 1 : 0 },

  // ── Życie (styl życia, konsumpcja) ──
  { id: 'traveler', title: 'Podróżnik', desc: '5 przejazdów pociągiem', group: 'Życie', tier: 2, target: 5, unit: '×',
    lore: 'Bilet skasowany, peron za peronem. PKP, Intercity, Koleo — świat jest Twoją siecią połączeń, a Ty jej stałym pasażerem.', value: c => c.trainTrips },
  { id: 'otaku', title: 'Otaku', desc: 'Kupiony japoński produkt (matcha, mochi, sushi…)', group: 'Życie', tier: 1, target: 1,
    lore: 'Matcha, mochi, kawałek sushi. Wpuściłeś do koszyka kawałek Kraju Kwitnącej Wiśni — 日本 na Twoim paragonie.', value: c => c.japanItems },
  { id: 'carnivore', title: 'Drapieżnik', desc: '3 kg mięsa w jednym tygodniu', group: 'Życie', tier: 2, target: 3, unit: 'kg',
    lore: 'Kły wyszczerzone, karta w dłoni. 3 kg mięsa w tydzień — dział mięsny drży, gdy wchodzisz do sklepu.', value: c => c.meatWeekMaxKg },
  { id: 'butcher', title: 'Rzeźnik', desc: '5 kg mięsa w jednym tygodniu', group: 'Życie', tier: 3, target: 5, unit: 'kg',
    lore: 'Nóż naostrzony, apetyt nienasycony. 5 kg mięsa w siedem dni — to już nie dieta, to rzeźnia domowa.', value: c => c.meatWeekMaxKg },
  { id: 'alchemist', title: 'Alchemik', desc: 'Wydatki w 8 różnych kategoriach', group: 'Życie', tier: 2, target: 8, unit: '/8',
    lore: 'Miksujesz kategorie jak eliksiry w kotle. Osiem różnych żywiołów wydatków — prawdziwy mistrz finansowej magii.', value: c => c.distinctCategories },
  { id: 'unplugged', title: 'Wyluzowany', desc: '3 dni z rzędu bez żadnego wydatku', group: 'Życie', tier: 2, target: 3, unit: 'dni',
    lore: 'Telefon w kieszeni, portfel zamknięty. Trzy dni bez ani jednego wydatku — cyfrowy i finansowy detoks w jednym.', value: c => c.noSpendStreak },

  // ── Legendy (tier 4 — rzadkie, trudne) ──
  { id: 'legend-saver', title: 'Legenda oszczędzania', desc: '25 000 zł odłożone',        group: 'Legendy', tier: 4, target: 25000, unit: 'zł',
    lore: 'To już nie poduszka — to skarbiec pełen klejnotów. 25 000 zł, na które smoki patrzą z zazdrością.', value: c => c.savingsTotal },
  { id: 'centurion',    title: 'Centurion',            desc: '100 dni z rzędu w aplikacji', group: 'Legendy', tier: 4, target: 100, unit: 'dni',
    lore: 'Sto dni w szyku bez jednej wyrwy. Rzymski legionista salutuje — dyscyplina godna dowódcy setki.', value: c => c.logStreak },
  { id: 'unbreakable',  title: 'Nieugięty',            desc: '100 dni nawyku z rzędu',      group: 'Legendy', tier: 4, target: 100, unit: 'dni',
    lore: 'Sto dni tego samego nawyku. Nie ma siły, która to złamie — diament ukuty pod presją czasu.', value: c => c.habitBestStreak },
  { id: 'year-one',     title: 'Rok z aplikacją',      desc: '365 aktywnych dni',           group: 'Legendy', tier: 4, target: 365, unit: 'dni',
    lore: 'Pełne okrążenie Słońca razem. 365 dni — rocznica, na którą zasłużyliście oboje.', value: c => c.activeDays },
  { id: 'clean-month',  title: 'Czysty miesiąc',       desc: '30 dni z rzędu bez słodyczy', group: 'Legendy', tier: 4, target: 30, unit: 'dni',
    lore: 'Trzydzieści dni bez grama cukru. Detoks zaliczony — organizm lśni jak nowy.', value: c => c.noJunkStreak },
  { id: 'ultra-walk',   title: 'Ultramaraton',         desc: '20 000 kroków w jeden dzień', group: 'Legendy', tier: 4, target: 20000, unit: 'kroków',
    lore: '20 000 kroków w jeden dzień. Nogi mają pełne prawo złożyć wypowiedzenie — a Ty i tak idziesz dalej.', value: c => c.bestStepsDay },
  { id: 'titan',        title: 'Tytan pracy',          desc: '500 h pracy łącznie',         group: 'Legendy', tier: 4, target: 500, unit: 'h',
    lore: 'Atlas dźwigał niebo, Ty dźwigasz grafik. 500 godzin — praca godna tytana.', value: c => c.workHoursTotal },

  // ── Grzeszki (anti-achievements, custom icons) ──
  { id: 'crime-scene', title: 'Miejsce zbrodni',   desc: 'Budżet przekroczony o ponad 50%', group: 'Grzeszki', tier: 1, target: 150, unit: '%', kind: 'bad',
    lore: 'Kredowy obrys, taśma policyjna i portfel w roli ofiary. Budżet padł, a wszyscy wiemy, kto pociągnął za spust.', value: c => Math.round(c.overBudgetPct * 100) },
  { id: 'undead',      title: 'Żywy trup',         desc: '3 noce z rzędu sen poniżej 5 h',  group: 'Grzeszki', tier: 1, target: 3, unit: 'noce', kind: 'bad',
    lore: 'Trzy noce po niecałe 5 h snu. Chodzisz, mrugasz, mówisz — ale to już nie życie, to tryb zombie. Idź spać.', value: c => c.badSleepStreak },
  { id: 'bottomless',  title: 'Bezdenny żołądek',  desc: '5 dni z rzędu ze słodyczami',     group: 'Grzeszki', tier: 1, target: 5, unit: 'dni', kind: 'bad',
    lore: 'Pięć dni cukru z rzędu. Twój żołądek to czarna dziura na słodycze — nic z niej nie ucieka.', value: c => c.junkStreak },
  { id: 'sweet-tooth', title: 'Słodki ząb',        desc: '15 zakupów słodyczy w miesiącu',  group: 'Grzeszki', tier: 1, target: 15, unit: '×', kind: 'bad',
    lore: 'Piętnasty słodki zakup w miesiącu. Ten pączek ma już Twoje imię wygrawerowane na lukrze.', value: c => c.junkPurchasesMonth },
  { id: 'fast-food',   title: 'Fast food',         desc: '5 razy fast food / pizza',        group: 'Grzeszki', tier: 1, target: 5, unit: '×', kind: 'bad',
    lore: 'Piąta pizza w drodze. Kurier zna Twój adres lepiej niż listonosz — i macha Ci już na dzień dobry.', value: c => c.fastFoodCount },
  { id: 'red-light',   title: 'Czerwone światło',  desc: 'Przekroczony budżet miesiąca',    group: 'Grzeszki', tier: 1, target: 100, unit: '%', kind: 'bad',
    lore: 'Budżet krzyczał STOP, Ty wcisnąłeś gaz do dechy. Mandat wystawiony — płaci portfel.', value: c => Math.round(c.overBudgetPct * 100) },
  { id: 'panic',       title: 'Panikarz',          desc: 'Zakupy za 300+ zł w jeden dzień', group: 'Grzeszki', tier: 1, target: 300, unit: 'zł', kind: 'bad',
    lore: 'Ponad 300 zł w jeden dzień. Tryb pandemicznego chomika włączony — brakuje już tylko wieży z papieru toaletowego.', value: c => c.maxDaySpend },
  { id: 'grumpy',      title: 'Zrzęda',            desc: '3 dni z rzędu nastrój ≤ 2',       group: 'Grzeszki', tier: 1, target: 3, unit: 'dni', kind: 'bad',
    lore: 'Trzy dni z tą samą naburmuszoną miną. Chmura gradowa zawisła nad głową — może pora coś z tym zrobić?', value: c => c.lowMoodStreak },
  { id: 'rollercoaster', title: 'Rollercoaster',  desc: 'W tygodniu nastrój od ≤2 do ≥4',   group: 'Grzeszki', tier: 1, target: 1, kind: 'bad',
    lore: 'W jednym tygodniu z piekła w niebo i z powrotem. Emocjonalny rollercoaster bez pasów — trzymaj się, robi się wyboiście.', value: c => c.moodSwing7 ? 1 : 0 },
  { id: 'chemist',     title: 'Chemik',            desc: '10 słodkich napojów w miesiącu',   group: 'Grzeszki', tier: 1, target: 10, unit: '×', kind: 'bad',
    lore: 'Kolorowe mikstury zamiast wody z filtra. 10 dziwnych napojów w miesiąc — Twój organizm zasługuje na coś prostszego niż H₂O++.', value: c => c.drinkPurchasesMonth },
  { id: 'high-roller', title: 'Hazardzista',       desc: 'Pojedynczy zakup za 1000+ zł',     group: 'Grzeszki', tier: 1, target: 1000, unit: 'zł', kind: 'bad',
    lore: 'Postawiłeś wszystko na jedną kartę — jeden zakup za ponad tysiaka. Va banque! Miejmy nadzieję, że było warto.', value: c => c.maxSinglePurchase },
  { id: 'va-banque',   title: 'Va banque',         desc: 'Zakup u bukmachera / na lotto',    group: 'Grzeszki', tier: 1, target: 1, kind: 'bad',
    lore: 'Kości rzucone, los kupiony. Fortuna kołem się toczy — a Ty właśnie oddałeś jej stery nad swoim portfelem.', value: c => c.bettingBought ? 1 : 0 },
  { id: 'jester',      title: 'Błazen',            desc: '8 osobnych zakupów w jeden dzień', group: 'Grzeszki', tier: 1, target: 8, unit: '×', kind: 'bad',
    lore: 'Osiem transakcji w jeden dzień — kup tu, kliknij tam, żonglujesz paragonami jak dworski błazen piłeczkami.', value: c => c.maxTxPerDay },
];

// ── Build context (single source of truth — dashboard + gablota call this) ───
const JUNK = ['słodycz', 'slodycz', 'słodki', 'slodki', 'cukier', 'czekolad', 'baton', 'chips', 'fast', 'frytk', 'mcdonald', 'kfc', 'lody', 'ciast', 'żelk', 'zelk', 'oreo', 'jeżyk', 'jezyk', 'toffi', 'chałw', 'chalw', 'paluszk', 'chrupk'];
const FASTFOOD = ['mcdonald', 'kfc', 'pizza', 'burger', 'kebab', 'kebap', 'sushi', 'dominos', 'telepizza', 'bobby', 'pyszne', 'glovo', 'wolt', 'fast food', 'frytk'];
const TRAIN = ['pkp', 'intercity', 'koleo', 'polregio', 'pociąg', 'pociag', 'kolej', 'e-podroznik', 'przewozy region'];
const JAPAN = ['matcha', 'mochi', 'sushi', 'ramen', 'wasabi', 'nori', 'miso', 'sake', 'teriyaki', 'udon', 'sashimi', 'edamame', 'wakame', 'dango', 'takoyaki', 'onigiri', 'yakisoba'];
const DRINKS = ['sok ', 'napój', 'napoj', 'cola', 'pepsi', 'sprite', 'fanta', 'oranżad', 'oranzad', 'lemoniad', 'energetyk', 'monster', 'red bull', 'redbull', 'tymbark', 'kubuś', 'kubus', 'ice tea', 'lipton', 'powerade', 'nestea', 'mirinda', '7up', 'mirinda', 'hoop', 'żywiec zdrój smak', 'frugo', 'toma', 'caprio'];
const MEAT = ['mięso', 'mieso', 'kurczak', 'wołowin', 'wolowin', 'schab', 'karków', 'karkow', 'boczek', 'kiełbas', 'kielbas', 'szynk', 'mielone', 'indyk', 'żeberk', 'zeberk', 'parów', 'parow', 'pierś', 'piers', 'wieprz', 'polędwic', 'poledwic', 'filet z'];
const BETTING = ['lotto', 'zakład', 'zaklad', 'totalizator', 'kasyno', 'lottomat', 'obstaw', 'betclic', 'betfan', 'fortuna zakład', 'sts '];
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// walk back from today counting consecutive days for which pred(dayKey) holds
function streakBack(pred: (k: string) => boolean): number {
  let n = 0; const base = new Date();
  for (let i = 0; i < 400; i++) { const d = new Date(base); d.setDate(d.getDate() - i); if (!pred(dayKey(d))) break; n++; }
  return n;
}

export function buildAchCtx(args: {
  expenses: Expense[];
  moodEntries: { date?: string; mood?: number }[];
  workEvents: CalendarEvent[];
  workSettings: { workColor?: string; workPrefix?: string };
  habitBestStreak: number;
  healthDays: Record<string, { steps?: number; sleepMinutes?: number }>;
  tasksDone: number;
  budgetTotal: number;
  billTracked: boolean;
  cardBalancePeak?: number;
}): AchCtx {
  const { expenses, moodEntries, workEvents, workSettings, healthDays } = args;
  const wcol = workSettings.workColor;
  const wp = workSettings.workPrefix?.trim().toLowerCase();
  const workHoursTotal = workEvents
    .filter(e => isWorkEvent(e, { workColor: wcol, workPrefix: wp }))
    .reduce((sum, e) => sum + shiftHours(e), 0);

  let savingsTotal = 0, receiptsCount = 0, thisMonthExp = 0, junkPurchasesMonth = 0, fastFoodCount = 0;
  let trainTrips = 0, japanItems = 0, drinkPurchasesMonth = 0, maxSinglePurchase = 0, bettingBought = false;
  const thisMonth = dayKey(new Date()).slice(0, 7);
  const junkDays = new Set<string>();
  const loggedDays = new Set<string>();
  const daySpend: Record<string, number> = {};
  const txByDay: Record<string, number> = {};
  const meatByDay: Record<string, number> = {};
  const elecByMonth: Record<string, number> = {};
  const catSet = new Set<string>();
  const monthAgg: Record<string, { inc: number; exp: number }> = {};
  for (const e of expenses) {
    const day = (e.date ?? '').slice(0, 10);
    if (day) loggedDays.add(day);
    const isInc = e.type === 'income';
    const m = (e.date ?? '').slice(0, 7);
    if (m) (monthAgg[m] ??= { inc: 0, exp: 0 });
    if (isInc) { if (m && !isSelfTransfer(e)) monthAgg[m].inc += e.amount; continue; }
    receiptsCount++;
    if (isSelfTransfer(e)) { savingsTotal += e.amount; continue; }
    if (m) monthAgg[m].exp += e.amount;
    if (m === thisMonth) thisMonthExp += e.amount;
    if (day) { daySpend[day] = (daySpend[day] ?? 0) + e.amount; txByDay[day] = (txByDay[day] ?? 0) + 1; }
    if (e.amount > maxSinglePurchase) maxSinglePurchase = e.amount;
    if (e.category) catSet.add(e.category);
    const hay = `${e.note ?? ''} ${(e.tags ?? []).join(' ')} ${e.storeName ?? ''}`.toLowerCase();
    if (JUNK.some(k => hay.includes(k))) { junkDays.add(day); if (m === thisMonth) junkPurchasesMonth++; }
    if (FASTFOOD.some(k => hay.includes(k))) fastFoodCount++;
    if (TRAIN.some(k => hay.includes(k))) trainTrips++;
    if (BETTING.some(k => hay.includes(k))) bettingBought = true;
    if (/prąd|prad|\bpge\b|tauron|energa|\benea\b/.test(hay) && m) elecByMonth[m] = (elecByMonth[m] ?? 0) + e.amount;
    // product-level detection (meat kg / japan / drinks)
    for (const it of e.receiptItems ?? []) {
      if (it.kind === 'deposit') continue;
      const nm = (it.name ?? '').toLowerCase();
      const isMeat = (it.tags ?? []).includes('mięso') || MEAT.some(k => nm.includes(k));
      if (isMeat && day) meatByDay[day] = (meatByDay[day] ?? 0) + (it.weightKg && it.weightKg > 0 ? it.weightKg : (it.quantity || 1));
      if (JAPAN.some(k => nm.includes(k))) japanItems++;
      if (m === thisMonth && !nm.includes('woda') && DRINKS.some(k => nm.includes(k))) drinkPurchasesMonth++;
    }
  }
  const maxDaySpend = Object.values(daySpend).reduce((mx, v) => Math.max(mx, v), 0);
  const maxTxPerDay = Object.values(txByDay).reduce((mx, v) => Math.max(mx, v), 0);
  const monthUnderBudget = args.budgetTotal > 0 && Object.entries(monthAgg).some(([m, v]) => m !== thisMonth && v.exp > 0 && v.exp <= args.budgetTotal);

  // meat: most kg in any rolling 7-day window
  let meatWeekMaxKg = 0;
  const meatDays = Object.keys(meatByDay);
  for (const d of meatDays) {
    const end = new Date(d + 'T00:00:00').getTime();
    let sum = 0;
    for (const d2 of meatDays) {
      const t2 = new Date(d2 + 'T00:00:00').getTime();
      if (t2 <= end && t2 > end - 7 * 86400000) sum += meatByDay[d2];
    }
    if (sum > meatWeekMaxKg) meatWeekMaxKg = sum;
  }

  // electricity: latest month with a bill well under the average of the earlier ones
  const elecMonths = Object.keys(elecByMonth).sort();
  let cutElectricity = false;
  if (elecMonths.length >= 3) {
    const latest = elecByMonth[elecMonths[elecMonths.length - 1]];
    const prior = elecMonths.slice(0, -1).map(mm => elecByMonth[mm]);
    const avg = prior.reduce((a, b) => a + b, 0) / prior.length;
    cutElectricity = avg > 0 && latest <= avg * 0.8;
  }

  // mood
  const moodByDay: Record<string, number> = {};
  const moodMinByDay: Record<string, number> = {};
  const moodLevels = new Set<number>();
  for (const m of moodEntries) {
    const day = (m.date ?? '').slice(0, 10);
    if (day) { loggedDays.add(day); moodByDay[day] = Math.max(moodByDay[day] ?? 0, m.mood ?? 0); }
    if (day && m.mood) moodMinByDay[day] = Math.min(moodMinByDay[day] ?? 99, m.mood);
    if (m.mood) moodLevels.add(m.mood);
  }
  const moodDays = Object.keys(moodByDay).length;
  // big mood swing within the last 7 days (spanned ≤2 and ≥4)
  let swLo = 99, swHi = 0;
  { const base = new Date();
    for (let i = 0; i < 7; i++) { const d = new Date(base); d.setDate(d.getDate() - i); const k = dayKey(d);
      if (moodByDay[k] != null) swHi = Math.max(swHi, moodByDay[k]);
      if (moodMinByDay[k] != null) swLo = Math.min(swLo, moodMinByDay[k]); } }
  const moodSwing7 = swHi >= 4 && swLo <= 2;

  // sleep (best step + bad-sleep streak)
  let bestStepsDay = 0;
  for (const v of Object.values(healthDays)) bestStepsDay = Math.max(bestStepsDay, v.steps || 0);

  const balancedMonth = Object.values(monthAgg).some(m => m.exp > 0 && m.inc >= m.exp);

  return {
    habitBestStreak: args.habitBestStreak,
    noJunkStreak: streakBack(k => !junkDays.has(k)),
    savingsTotal, receiptsCount, moodDays, workHoursTotal,
    paydayLogged: expenses.some(e => e.type === 'income' && (e.category === 'salary' || (!!wp && `${e.note ?? ''} ${(e.tags ?? []).join(' ')}`.toLowerCase().includes(wp)))),
    bestStepsDay, billTracked: args.billTracked,
    logStreak: streakBack(k => loggedDays.has(k)),
    activeDays: loggedDays.size,
    goodMoodStreak: streakBack(k => (moodByDay[k] ?? 0) >= 4),
    moodLevelsSeen: moodLevels.size,
    balancedMonth, hasBudget: args.budgetTotal > 0, tasksDone: args.tasksDone,
    goodSleepStreak: streakBack(k => { const sl = healthDays[k]?.sleepMinutes; return !!sl && sl >= 420; }),
    lowMoodStreak: streakBack(k => { const mn = moodMinByDay[k]; return mn != null && mn <= 2; }),
    neutralMoodStreak: streakBack(k => moodByDay[k] === 3 && moodMinByDay[k] === 3),
    moodSwing7,
    noSpendStreak: streakBack(k => !daySpend[k]),
    trainTrips, japanItems, drinkPurchasesMonth, meatWeekMaxKg, cutElectricity,
    maxSinglePurchase, bettingBought, maxTxPerDay, distinctCategories: catSet.size,
    cardBalancePeak: args.cardBalancePeak ?? 0,
    monthUnderBudget,
    junkStreak: streakBack(k => junkDays.has(k)),
    badSleepStreak: streakBack(k => { const s = healthDays[k]?.sleepMinutes; return !!s && s > 0 && s < 300; }),
    overBudgetPct: args.budgetTotal > 0 ? thisMonthExp / args.budgetTotal : 0,
    junkPurchasesMonth, fastFoodCount, maxDaySpend,
  };
}

export interface AchState { a: Achievement; value: number; unlocked: boolean; progress: number; }

export function evaluateAchievements(ctx: AchCtx): AchState[] {
  return ACHIEVEMENTS.map(a => {
    const value = a.value(ctx);
    return { a, value, unlocked: value >= a.target, progress: Math.min(1, a.target > 0 ? value / a.target : 0) };
  });
}

// ── Earned timestamps ───────────────────────────────────────────────────────
const K_EARNED = 'achievements_earned';
export type EarnedMap = Record<string, string>;

export async function getEarned(): Promise<EarnedMap> {
  try { const raw = await AsyncStorage.getItem(K_EARNED); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

export async function syncEarned(states: AchState[]): Promise<string[]> {
  const earned = await getEarned();
  const now = new Date().toISOString();
  const fresh: string[] = [];
  for (const s of states) if (s.unlocked && !earned[s.a.id]) { earned[s.a.id] = now; fresh.push(s.a.id); }
  if (fresh.length) { try { await AsyncStorage.setItem(K_EARNED, JSON.stringify(earned)); } catch {} }
  return fresh;
}

export function fmtProgress(s: AchState): string {
  if (s.a.target === 1 && !s.a.unit) return s.unlocked ? 'Zdobyte' : 'Niezdobyte';
  const v = Math.min(s.value, s.a.target);
  const fmt = (n: number) => (s.a.unit === 'zł' || s.a.unit === 'kroków') ? Math.round(n).toLocaleString('pl-PL') : String(Math.round(n));
  return `${fmt(v)} / ${fmt(s.a.target)}${s.a.unit ? ' ' + s.a.unit : ''}`;
}

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

  // ── Liczenie kalorii (Jedzenie) ──
  mealsLogged: number;       // all-time meals logged in the calorie counter
  foodDaysLogged: number;    // distinct days with ≥1 meal logged
  foodLogStreak: number;     // consecutive days (→ today) with a meal logged
  dishesCreated: number;     // own dishes/recipes saved to the library

  // ── bagesv2 batch (2026-08-09) — see memory backlog_2026-08-07 ──
  distinctProduceAllTime: number;  // distinct fruit/veg KINDS ever bought (by keyword, not raw name)
  maxDailyProduceVariety: number;  // most distinct fruit/veg kinds bought in one day
  produceVarietyStreak: number;    // consecutive days (→ today) with ≥5 distinct fruit/veg kinds
  fishItems: number;               // fish/seafood purchases (occurrences, like japanItems)
  fishWeekMaxKg: number;           // most kg of fish in any rolling 7-day window
  monthsUnderBudgetStreak: number; // consecutive CLOSED months under budget (trailing)
  monthWithinBudgetBand: boolean;  // any closed month landed within ±5% of budget
  selfTransferCount: number;       // COUNT of self-transfer transactions (not their sum)
  depositItemsReturned: number;    // receipt items with kind 'deposit' (kaucja)
  pirateTreasure: boolean;         // saver-1000 + fat-wallet + under-limit all true at once
  moodMastery: boolean;            // chronicler + full-range + statue(30) + moodBounceBack all true
  moodBounceBack: boolean;         // a day with mood ≤2 immediately followed by a day with mood ≥4
  bankCorrections: number;         // times you fixed the bank-notification parser's category guess
  autoMerchantReached: boolean;    // at least one merchant graduated to bank auto-accept
  scannedReceipts: number;         // expenses added via "Wklej paragon" (parsed), not typed
  statsVisits: number;             // app-session visits to the stats/calendar tab
  backupDone: boolean;             // a cloud backup or restore has ever succeeded
  selfTestClean: boolean;          // Ustawienia → self-test passed with 0 errors, at least once
  loginStreak: number;             // consecutive days (→ today) the app was opened (petStore)
  agsDayEver: boolean;             // ANY day ever with >2 distinct non-staple purchases ("AGŚ")
  agsEdgeDayEver: boolean;         // ANY day ever with EXACTLY 2 distinct non-staple purchases
  agsDaysThisMonthMax: number;     // most AGŚ-days seen within any single month
  agsMonthStreak: number;          // consecutive months (trailing) with ≥1 AGŚ-day
  cleanMonthNoAgs: boolean;        // any CLOSED month with zero AGŚ-days
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
  // ══════════════════════════════════════════════════════════════════════════
  // LEGENDY (tier 4 — rzadkie, trudne)
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'year-one', title: 'Rok z Aplikacją', desc: '365 aktywnych dni', group: 'Legendy', tier: 4, target: 365, unit: 'dni',
    lore: 'Pełne okrążenie Słońca razem. 365 dni — rocznica, na którą zasłużyliście oboje.', value: c => c.activeDays },
  { id: 'fossil-300', title: 'Skamielina', desc: '300 aktywnych dni w aplikacji', group: 'Legendy', tier: 4, target: 300, unit: 'dni',
    lore: 'Inne apki dawno skamieniały na ekranie — ta przetrwała.', value: c => c.activeDays },
  { id: 'legend-saver', title: 'Legenda Oszczędzania', desc: '25 000 zł odłożone', group: 'Legendy', tier: 4, target: 25000, unit: 'zł',
    lore: 'Miecz, na który smoki patrzą z zazdrością.', value: c => c.savingsTotal },
  { id: 'unbreakable', title: 'Nieugięty', desc: '100 dni tego samego nawyku z rzędu', group: 'Legendy', tier: 4, target: 100, unit: 'dni',
    lore: 'Nie ma siły, która by to złamała.', value: c => c.habitBestStreak },
  { id: 'centurion', title: 'Centurion', desc: '100 dni z rzędu w aplikacji', group: 'Legendy', tier: 4, target: 100, unit: 'dni',
    lore: 'Legionista salutuje — dyscyplina godna dowódcy setki.', value: c => c.logStreak },
  { id: 'clean-month', title: 'Czysty Miesiąc', desc: '30 dni z rzędu bez słodyczy', group: 'Legendy', tier: 4, target: 30, unit: 'dni',
    lore: 'Cytrusowy detoks zaliczony — organizm lśni jak nowy.', value: c => c.noJunkStreak },
  { id: 'cyborg-365', title: 'To Już Nie Człowiek To Maszyna', desc: '365 dni tego samego nawyku z rzędu', group: 'Legendy', tier: 4, target: 365, unit: 'dni',
    lore: 'Gratulacje człowieku... maszyno? Za rok wytrwałości.', value: c => c.habitBestStreak },

  // ══════════════════════════════════════════════════════════════════════════
  // NAWYKI
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'habit-streak-30', title: 'Dyscyplina Miecza', desc: '30 dni nawyku z rzędu', group: 'Nawyki', tier: 3, target: 30, unit: 'dni',
    lore: 'Codzienna praktyka, bez wyjątków.', value: c => c.habitBestStreak },
  { id: 'habit-streak-7', title: 'Tydzień Mocy', desc: '7 dni nawyku z rzędu', group: 'Nawyki', tier: 2, target: 7, unit: 'dni',
    lore: 'Tydzień nawyku — kwitniesz na uporze.', value: c => c.habitBestStreak },

  // ══════════════════════════════════════════════════════════════════════════
  // JEDZENIE
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'first-bite', title: 'Pierwszy Kęs', desc: 'Zalogowany pierwszy posiłek', group: 'Jedzenie', tier: 1, target: 1,
    lore: 'Liczenie kalorii właśnie się zaczęło.', value: c => c.mealsLogged >= 1 ? 1 : 0 },
  { id: 'kcal-week', title: 'Tydzień Pod Kontrolą', desc: '7 dni z rzędu z zapisanym jedzeniem', group: 'Jedzenie', tier: 2, target: 7, unit: 'dni',
    lore: 'Siedem dni bez luki w dzienniku jedzenia. Wiesz dokładnie, co wjechało na talerz.', value: c => c.foodLogStreak },
  { id: 'kcal-month', title: 'Miesiąc Świadomości', desc: '30 dni z zapisanym jedzeniem', group: 'Jedzenie', tier: 3, target: 30, unit: 'dni',
    lore: 'Jedzenie nie ma już przed Tobą tajemnic.', value: c => c.foodDaysLogged },
  { id: 'meals-100', title: 'Setka Posiłków', desc: '100 zapisanych posiłków', group: 'Jedzenie', tier: 2, target: 100, unit: '×',
    lore: 'Talerz za talerzem złożyły się w solidny nawyk — apka zna już Twój apetyt na pamięć.', value: c => c.mealsLogged },
  { id: 'meal-prepper', title: 'Meal Prep', desc: '5 własnych dań w bibliotece', group: 'Jedzenie', tier: 2, target: 5, unit: 'dań',
    lore: 'Masz już własną książkę kucharską z kaloriami w komplecie.', value: c => c.dishesCreated },
  { id: 'home-chef', title: 'Domowy Kucharz', desc: 'Zapisany pierwszy własny przepis', group: 'Jedzenie', tier: 1, target: 1,
    lore: 'Gotujesz po swojemu — i wiesz dokładnie, ile to ma.', value: c => c.dishesCreated >= 1 ? 1 : 0 },
  { id: 'no-junk-7', title: 'Cierpliwość Bonsai', desc: '7 dni z rzędu bez słodyczy', group: 'Jedzenie', tier: 2, target: 7, unit: 'dni',
    lore: 'Małe, systematyczne przycinanie nawyku.', value: c => c.noJunkStreak },
  { id: 'veg-variety', title: 'Warzywniak', desc: '20 różnych warzyw i owoców zalogowanych', group: 'Jedzenie', tier: 3, target: 20, unit: 'rodzajów',
    lore: 'Tęczowy talerz, nie tylko ziemniaki.', value: c => c.distinctProduceAllTime },
  { id: 'five-a-day', title: 'Pięć Porcji', desc: '5 różnych warzyw/owoców jednego dnia', group: 'Jedzenie', tier: 1, target: 5, unit: '/dzień',
    lore: 'Talerz, który dietetyk by przybił piątką.', value: c => c.maxDailyProduceVariety },
  { id: 'produce-week', title: 'Owocowy Tydzień', desc: '„5 porcji dziennie" 7 dni z rzędu', group: 'Jedzenie', tier: 3, target: 7, unit: 'dni',
    lore: 'Nie jednorazowo — tydzień w tydzień.', value: c => c.produceVarietyStreak },
  { id: 'fish-menu', title: 'Rybne Menu', desc: 'Pierwszy zalogowany produkt rybny', group: 'Jedzenie', tier: 1, target: 1,
    lore: 'Coś innego niż kurczak dla odmiany.', value: c => c.fishItems >= 1 ? 1 : 0 },
  { id: 'fish-master', title: 'Mistrz Wędki', desc: '5 kg ryb w jednym tygodniu', group: 'Jedzenie', tier: 2, target: 5, unit: 'kg',
    lore: 'Dział rybny zna Cię z imienia.', value: c => c.fishWeekMaxKg },

  // ══════════════════════════════════════════════════════════════════════════
  // OSZCZĘDZANIE
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'saver-5000', title: 'Poduszka', desc: 'Łącznie 5 000 zł odłożone', group: 'Oszczędzanie', tier: 2, target: 5000, unit: 'zł',
    lore: 'Na takiej poduszce śpi się spokojniej.', value: c => c.savingsTotal },
  { id: 'saver-10000', title: 'Forteca', desc: 'Łącznie 10 000 zł odłożone', group: 'Oszczędzanie', tier: 3, target: 10000, unit: 'zł',
    lore: 'Twardo jak rubin i tak samo trudne do skruszenia.', value: c => c.savingsTotal },
  { id: 'saver-1000', title: 'Tysiąc', desc: 'Łącznie 1 000 zł odłożone', group: 'Oszczędzanie', tier: 1, target: 1000, unit: 'zł',
    lore: 'Najczystsza forma dbania o przyszłość.', value: c => c.savingsTotal },
  { id: 'fat-wallet', title: 'Gruby Portfel', desc: 'Saldo karty przekroczyło 5 000 zł', group: 'Oszczędzanie', tier: 3, target: 5000, unit: 'zł',
    lore: 'Twój rekord grubości portfela.', value: c => c.cardBalancePeak },
  { id: 'under-limit', title: 'Pod Limitem', desc: 'Miesiąc zamknięty pod budżetem', group: 'Oszczędzanie', tier: 2, target: 1,
    lore: 'Zero mandatu, pełna ochrona.', value: c => c.monthUnderBudget ? 1 : 0 },
  { id: 'balanced', title: 'Kapitan Swojego Budżetu', desc: 'Miesiąc na plusie (przychód ≥ wydatki)', group: 'Oszczędzanie', tier: 2, target: 1,
    lore: 'Ster mocno w Twoich rękach.', value: c => c.balancedMonth ? 1 : 0 },
  { id: 'power-saver', title: 'Oszczędny Prąd', desc: 'Rachunek za prąd ≥20% pod średnią', group: 'Oszczędzanie', tier: 2, target: 1,
    lore: 'Piorąc oszczędnie, licznik zwalnia.', value: c => c.cutElectricity ? 1 : 0 },
  { id: 'bill-tracked', title: 'Ster We Własne Ręce', desc: 'Pierwszy dodany rachunek cykliczny', group: 'Oszczędzanie', tier: 1, target: 1,
    lore: 'Wiesz teraz dokładnie, co odpływa co miesiąc.', value: c => c.billTracked ? 1 : 0 },
  { id: 'budget-streak-3', title: 'Pancerz Budżetu', desc: '3 miesiące z rzędu pod budżetem', group: 'Oszczędzanie', tier: 3, target: 3, unit: 'msc',
    lore: 'Nic dziś nie przebije tej obrony.', value: c => c.monthsUnderBudgetStreak },
  { id: 'budget-precision', title: 'W Dziesiątkę', desc: 'Miesiąc w granicach ±5% budżetu', group: 'Oszczędzanie', tier: 3, target: 1,
    lore: 'Ani grosza za dużo, ani za mało.', value: c => c.monthWithinBudgetBand ? 1 : 0 },
  { id: 'slow-saver', title: 'Żółwik', desc: '20 małych, regularnych „odłożeń"', group: 'Oszczędzanie', tier: 2, target: 20, unit: '×',
    lore: 'Powoli, ale systematycznie.', value: c => c.selfTransferCount },
  { id: 'deposit-collector', title: 'Zbieracz Kaucji', desc: '20 butelek/puszek z kaucją zwróconych', group: 'Oszczędzanie', tier: 1, target: 20, unit: 'szt',
    lore: 'Grosz do grosza, a jednak coś z tego jest.', value: c => c.depositItemsReturned },
  { id: 'pirate-treasure', title: 'Piracki Skarbiec', desc: 'Tysiąc + Gruby Portfel + Pod Limitem naraz', group: 'Oszczędzanie', tier: 3, target: 1,
    lore: 'Cała mapa skarbów odkryta.', value: c => c.pirateTreasure ? 1 : 0 },
  { id: 'bank-detective', title: 'Prostuję Zeznania', desc: '10 poprawionych wpisów z banku', group: 'Oszczędzanie', tier: 2, target: 10, unit: '×',
    lore: 'Automat się myli — Ty to łapiesz.', value: c => c.bankCorrections },
  { id: 'auto-merchant', title: 'Zautomatyzowany', desc: 'Sklep osiągnął status automatu', group: 'Oszczędzanie', tier: 1, target: 1,
    lore: 'Twoje wydatki księgują się już same.', value: c => c.autoMerchantReached ? 1 : 0 },

  // ══════════════════════════════════════════════════════════════════════════
  // PRACA
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'doer', title: 'Wykonawca', desc: '25 ukończonych zadań', group: 'Praca', tier: 2, target: 25, unit: '×',
    lore: 'Nie odkładasz — słyszysz sygnał i działasz.', value: c => c.tasksDone },
  { id: 'tasks-50', title: 'Celny Strzał', desc: '50 ukończonych zadań', group: 'Praca', tier: 3, target: 50, unit: '×',
    lore: 'Odhaczasz szybciej, niż zdążysz dopisać kolejne.', value: c => c.tasksDone },
  { id: 'tasks-200', title: 'Mędrzec', desc: '200 ukończonych zadań', group: 'Praca', tier: 3, target: 200, unit: '×',
    lore: 'Lista rzeczy-do-zrobienia nie ma już przed Tobą tajemnic.', value: c => c.tasksDone },
  { id: 'work-100h', title: 'Maszyna', desc: 'Łącznie 100 h pracy', group: 'Praca', tier: 2, target: 100, unit: 'h',
    lore: 'Pracujesz jak dobrze naoliwiony mechanizm.', value: c => c.workHoursTotal },
  { id: 'work-1000h', title: 'Pilot Weteran', desc: 'Łącznie 1 000 h pracy', group: 'Praca', tier: 3, target: 1000, unit: 'h',
    lore: 'Grafik nie ma już przed Tobą tajemnic.', value: c => c.workHoursTotal },
  { id: 'payday-first', title: 'Pierwsza Wypłata', desc: 'Zalogowana pierwsza wypłata', group: 'Praca', tier: 1, target: 1,
    lore: 'Od teraz apka wie, ile realnie zarabiasz.', value: c => c.paydayLogged ? 1 : 0 },

  // ══════════════════════════════════════════════════════════════════════════
  // NASTRÓJ
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'self-care', title: 'Serce Na Dłoni', desc: '30 dni z wpisem nastroju', group: 'Nastrój', tier: 2, target: 30, unit: 'dni',
    lore: 'Nie tylko czujesz — sprawdzasz, jak naprawdę Ci jest.', value: c => c.moodDays },
  { id: 'full-range', title: 'Teatr Jednego Aktora', desc: 'Zalogowane wszystkie nastroje 1–5', group: 'Nastrój', tier: 1, target: 5, unit: '/5',
    lore: 'Komedia, tragedia i wszystko pomiędzy — pełen repertuar.', value: c => c.moodLevelsSeen },
  { id: 'chronicler', title: 'Analityk Nastroju', desc: '60 dni z wpisem nastroju', group: 'Nastrój', tier: 3, target: 60, unit: 'dni',
    lore: 'Twój mózg ma już własny zwój notatek o sobie samym.', value: c => c.moodDays },
  { id: 'sunny-week', title: 'Słoneczny Tydzień', desc: '7 dni z rzędu nastrój ≥4', group: 'Nastrój', tier: 2, target: 7, unit: 'dni',
    lore: 'Wewnętrzne ognisko nie zgasło ani razu przez cały tydzień.', value: c => c.goodMoodStreak },
  { id: 'zen', title: 'Ulga', desc: '14 dni z rzędu nastrój ≥4', group: 'Nastrój', tier: 3, target: 14, unit: 'dni',
    lore: 'Można było w końcu odetchnąć.', value: c => c.goodMoodStreak },
  { id: 'stoic-30', title: 'Stoicki Spokój', desc: '30 dni z rzędu nastrój ≥4', group: 'Nastrój', tier: 4, target: 30, unit: 'dni',
    lore: 'Niewzruszony jak posąg — nic dziś Cię nie rusza (w dobrym sensie).', value: c => c.goodMoodStreak },
  { id: 'mood-bounce', title: 'Pierwsza Pomoc', desc: 'Zły dzień, a zaraz potem dobry', group: 'Nastrój', tier: 1, target: 1,
    lore: 'Upadłeś i wstałeś — to się liczy bardziej niż brak upadku.', value: c => c.moodBounceBack ? 1 : 0 },
  { id: 'mood-mastery', title: 'Nagroda Akademii', desc: 'Zdobyte wszystkie odznaki w grupie Nastrój', group: 'Nastrój', tier: 4, target: 1,
    lore: 'Pełna, nagrodzona rola.', value: c => c.moodMastery ? 1 : 0 },
  { id: 'poker-face', title: 'Poker Face', desc: '7 dni z rzędu nastrój dokładnie 3', group: 'Nastrój', tier: 1, target: 7, unit: 'dni',
    lore: 'Ani wzlotów, ani upadków — kamienna twarz przez cały tydzień. Może czas coś poczuć?', value: c => c.neutralMoodStreak },

  // ══════════════════════════════════════════════════════════════════════════
  // ZDROWIE
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'marathon', title: 'Odcisk Stopy', desc: '10 000 kroków w jeden dzień', group: 'Zdrowie', tier: 1, target: 10000, unit: 'kroków',
    lore: 'Ten odcisk dziś naprawdę zapracował.', value: c => c.bestStepsDay },
  { id: 'step-beast', title: 'Bestia Formy', desc: '15 000 kroków w jeden dzień', group: 'Zdrowie', tier: 2, target: 15000, unit: 'kroków',
    lore: 'Między maratonem a ultramaratonem — środkowy stopień siły.', value: c => c.bestStepsDay },
  { id: 'ultra-walk', title: 'Ultramaraton', desc: '20 000 kroków w jeden dzień', group: 'Legendy', tier: 4, target: 20000, unit: 'kroków',
    lore: 'Nogi mają pełne prawo złożyć wypowiedzenie — a Ty i tak idziesz dalej.', value: c => c.bestStepsDay },
  { id: 'well-rested', title: 'Latarnia w Ciemności', desc: '7 nocy z rzędu snu ≥7h', group: 'Zdrowie', tier: 2, target: 7, unit: 'nocy',
    lore: 'Ktoś tu wreszcie gasi światło na czas.', value: c => c.goodSleepStreak },
  { id: 'titan', title: 'Tytan Pracy', desc: '5 000 h pracy łącznie', group: 'Legendy', tier: 4, target: 5000, unit: 'h',
    lore: 'Atlas dźwigał niebo, Ty dźwigasz grafik.', value: c => c.workHoursTotal },

  // ══════════════════════════════════════════════════════════════════════════
  // ŻYCIE
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'traveler', title: 'Podróżnik', desc: '5 przejazdów pociągiem', group: 'Życie', tier: 2, target: 5, unit: '×',
    lore: 'Świat to Twoja sieć połączeń.', value: c => c.trainTrips },
  { id: 'carnivore', title: 'Drapieżnik', desc: '3 kg mięsa w jednym tygodniu', group: 'Życie', tier: 2, target: 3, unit: 'kg',
    lore: 'Dział mięsny drży, gdy wchodzisz do sklepu.', value: c => c.meatWeekMaxKg },
  { id: 'butcher', title: 'Rzeźnik', desc: '5 kg mięsa w jednym tygodniu', group: 'Życie', tier: 3, target: 5, unit: 'kg',
    lore: 'To już nie dieta, to rzeźnia domowa.', value: c => c.meatWeekMaxKg },
  { id: 'alchemist', title: 'Alchemik', desc: 'Wydatki w 6 różnych kategoriach', group: 'Życie', tier: 2, target: 6, unit: '/6',
    lore: 'Mieszasz kategorie jak eliksiry w kotle.', value: c => c.distinctCategories },
  { id: 'unplugged', title: 'Wyluzowany', desc: '3 dni z rzędu bez żadnego wydatku', group: 'Życie', tier: 2, target: 3, unit: 'dni',
    lore: 'Telefon w kieszeni, portfel zamknięty — cyfrowy i finansowy detoks w jednym.', value: c => c.noSpendStreak },
  { id: 'unplugged-7', title: 'Kręgosłup', desc: '7 dni z rzędu bez żadnego wydatku', group: 'Życie', tier: 3, target: 7, unit: 'dni',
    lore: 'Tydzień cyfrowego i finansowego detoksu.', value: c => c.noSpendStreak },
  { id: 'otaku', title: 'Sakura', desc: 'Pierwszy japoński produkt w koszyku', group: 'Życie', tier: 1, target: 1,
    lore: '日本 na Twoim paragonie.', value: c => c.japanItems },
  { id: 'otaku-koi', title: 'Karp Koi', desc: '7 japońskich produktów kupionych', group: 'Życie', tier: 2, target: 7, unit: '×',
    lore: 'Płyniesz pod prąd jak koi — z uporem i stylem.', value: c => c.japanItems },
  { id: 'otaku-samurai', title: 'Droga Samuraja', desc: '25 japońskich produktów kupionych', group: 'Życie', tier: 3, target: 25, unit: '×',
    lore: 'Bushido w wersji „matcha i mochi co tydzień".', value: c => c.japanItems },
  { id: 'eco-warrior', title: 'Eko Wojownik', desc: 'Miesiąc bez ani jednego dnia AGŚ', group: 'Życie', tier: 2, target: 1,
    lore: 'Zero śmieci, czyste sumienie.', value: c => c.cleanMonthNoAgs ? 1 : 0 },

  // ══════════════════════════════════════════════════════════════════════════
  // KONSEKWENCJA
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'first-key', title: 'Pierwszy Klucz', desc: 'Pierwszy zalogowany wydatek', group: 'Konsekwencja', tier: 1, target: 1,
    lore: 'Klucz do skarbca Twoich finansów. Bez niego cała reszta statystyk pozostaje zamknięta na głucho.', value: c => c.receiptsCount >= 1 ? 1 : 0 },
  { id: 'scanner', title: 'Sokole Oko', desc: '50 zalogowanych wydatków', group: 'Konsekwencja', tier: 2, target: 50, unit: '×',
    lore: 'Nic Ci nie umknie.', value: c => c.receiptsCount },
  { id: 'groceries-100', title: 'Zakupowicz', desc: '100 zalogowanych wydatków', group: 'Konsekwencja', tier: 3, target: 100, unit: '×',
    lore: 'Ta torba już się nie domyka — znasz każdą alejkę na pamięć.', value: c => c.receiptsCount },
  { id: 'first-week', title: 'Pierwszy Tydzień', desc: '7 aktywnych dni w aplikacji', group: 'Konsekwencja', tier: 1, target: 7, unit: 'dni',
    lore: 'Krok pierwszy z wielu — dopiero się rozkręcasz.', value: c => c.activeDays },
  { id: 'loyal', title: 'Świeżo Wyklute', desc: '30 aktywnych dni w aplikacji', group: 'Konsekwencja', tier: 3, target: 30, unit: 'dni',
    lore: 'Pierwszy miesiąc za Tobą — Twoja przygoda z apką dopiero raczkuje.', value: c => c.activeDays },
  { id: 'goal-set', title: 'Mapa Skarbów', desc: 'Ustawiony pierwszy budżet', group: 'Konsekwencja', tier: 1, target: 1,
    lore: 'Od teraz wiadomo, dokąd zmierzają pieniądze.', value: c => c.hasBudget ? 1 : 0 },
  { id: 'on-track', title: 'Kurs Wyznaczony', desc: '7 dni z rzędu coś zalogowane', group: 'Konsekwencja', tier: 2, target: 7, unit: 'dni',
    lore: 'Kompas nie gubi północy.', value: c => c.logStreak },
  { id: 'loyal-heart', title: 'Z Sercem', desc: '60 aktywnych dni — apka to nawyk', group: 'Konsekwencja', tier: 3, target: 60, unit: 'dni',
    lore: 'Apka to już nie obowiązek, to nawyk z sentymentu.', value: c => c.activeDays },
  { id: 'backup-done', title: 'Papierologia Ogarnięta', desc: 'Wykonany eksport/backup danych', group: 'Konsekwencja', tier: 1, target: 1,
    lore: 'Nawet jak telefon umrze, historia przeżyje.', value: c => c.backupDone ? 1 : 0 },
  { id: 'login-streak-14', title: 'Wierny Piesek', desc: '14 dni z rzędu z otwartą apką', group: 'Konsekwencja', tier: 2, target: 14, unit: 'dni',
    lore: 'Nieważne co, zawsze wracasz sprawdzić pupila.', value: c => c.loginStreak },
  { id: 'selftest-clean', title: 'Bez Skazy', desc: 'Self-test bez błędów', group: 'Konsekwencja', tier: 1, target: 1,
    lore: 'Kruche, ale nienaruszone.', value: c => c.selfTestClean ? 1 : 0 },
  { id: 'stats-watcher', title: 'Cichy Obserwator', desc: '20 wizyt na ekranie statystyk', group: 'Konsekwencja', tier: 1, target: 20, unit: '×',
    lore: 'Nikt Cię nie widzi, ale Ty widzisz wszystko.', value: c => c.statsVisits },
  { id: 'scan-master', title: 'Za Kulisami', desc: '20 paragonów dodanych przez wklejenie', group: 'Konsekwencja', tier: 2, target: 20, unit: '×',
    lore: 'Wklejasz i parsujesz — nie przepisujesz linijka po linijce.', value: c => c.scannedReceipts },

  // ══════════════════════════════════════════════════════════════════════════
  // GRZESZKI (antyodznaki)
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'undead', title: 'Żywy Trup', desc: '3 noce z rzędu sen poniżej 5h', group: 'Grzeszki', tier: 1, target: 3, unit: 'noce', kind: 'bad',
    lore: 'Chodzisz, mówisz — ale to już tryb zombie.', value: c => c.badSleepStreak },
  { id: 'undead-7', title: 'Do Szpiku Zmęczony', desc: '7 nocy z rzędu sen poniżej 5h', group: 'Grzeszki', tier: 3, target: 7, unit: 'noce', kind: 'bad',
    lore: 'To już nie zmęczenie, to stan chroniczny.', value: c => c.badSleepStreak },
  { id: 'bottomless', title: 'Bezdenny Żołądek', desc: '5 dni z rzędu ze słodyczami', group: 'Grzeszki', tier: 1, target: 5, unit: 'dni', kind: 'bad',
    lore: 'Czarna dziura na cukier — nic z niej nie ucieka.', value: c => c.junkStreak },
  { id: 'fast-food', title: 'Ostre Combo', desc: '5 razy fast food / pizza', group: 'Grzeszki', tier: 1, target: 5, unit: '×', kind: 'bad',
    lore: 'Kurier zna Twój adres lepiej niż listonosz.', value: c => c.fastFoodCount },
  { id: 'sweet-tooth', title: 'Słodki Ząb', desc: '15 zakupów słodyczy w miesiącu', group: 'Grzeszki', tier: 1, target: 15, unit: '×', kind: 'bad',
    lore: 'Ten pączek ma już Twoje imię wygrawerowane na lukrze.', value: c => c.junkPurchasesMonth },
  { id: 'chemist', title: 'Chemik', desc: '10 słodkich napojów w miesiącu', group: 'Grzeszki', tier: 1, target: 10, unit: '×', kind: 'bad',
    lore: 'Kolorowe mikstury zamiast wody z filtra.', value: c => c.drinkPurchasesMonth },
  { id: 'panic', title: 'Panikarz', desc: 'Zakupy za 300+ zł w jeden dzień', group: 'Grzeszki', tier: 1, target: 300, unit: 'zł', kind: 'bad',
    lore: 'Tryb pandemicznego chomika: włączony.', value: c => c.maxDaySpend },
  { id: 'kraken', title: 'Pożarty Przez Kraken', desc: 'Pojedynczy zakup za 3000+ zł', group: 'Grzeszki', tier: 3, target: 3000, unit: 'zł', kind: 'bad',
    lore: 'Coś wielkiego wciągnęło Twój budżet pod wodę.', value: c => c.maxSinglePurchase },
  { id: 'red-light', title: 'Czerwone Światło', desc: 'Przekroczony budżet miesiąca', group: 'Grzeszki', tier: 1, target: 100, unit: '%', kind: 'bad',
    lore: 'Portfel dosłownie płonie.', value: c => Math.round(c.overBudgetPct * 100) },
  { id: 'crime-scene', title: 'Miejsce Zbrodni', desc: 'Budżet przekroczony o ponad 50%', group: 'Grzeszki', tier: 1, target: 150, unit: '%', kind: 'bad',
    lore: 'Kredowy obrys, taśma policyjna i portfel w roli ofiary. Wszyscy wiemy, kto pociągnął za spust.', value: c => Math.round(c.overBudgetPct * 100) },
  { id: 'meltdown', title: 'Katastrofa Nuklearna', desc: 'Budżet przekroczony o ponad 250%', group: 'Grzeszki', tier: 4, target: 250, unit: '%', kind: 'bad',
    lore: 'Rdzeń stopiony, portfel w strefie skażenia.', value: c => Math.round(c.overBudgetPct * 100) },
  { id: 'rollercoaster', title: 'Rollercoaster', desc: 'W tygodniu nastrój od ≤2 do ≥4', group: 'Grzeszki', tier: 1, target: 1, kind: 'bad',
    lore: 'Emocjonalny rollercoaster bez pasów.', value: c => c.moodSwing7 ? 1 : 0 },
  { id: 'grumpy', title: 'Zrzęda', desc: '3 dni z rzędu nastrój ≤2', group: 'Grzeszki', tier: 1, target: 3, unit: 'dni', kind: 'bad',
    lore: 'Chmura gradowa zawisła nad głową — może pora coś z tym zrobić?', value: c => c.lowMoodStreak },
  { id: 'high-roller', title: 'Hazardzista', desc: 'Pojedynczy zakup za 1000+ zł', group: 'Grzeszki', tier: 1, target: 1000, unit: 'zł', kind: 'bad',
    lore: 'Postawiłeś wszystko na jedną kartę.', value: c => c.maxSinglePurchase },
  { id: 'va-banque', title: 'Va Banque', desc: 'Zakup u bukmachera / na lotto', group: 'Grzeszki', tier: 1, target: 1, kind: 'bad',
    lore: 'Fortuna właśnie przejęła stery Twojego portfela.', value: c => c.bettingBought ? 1 : 0 },
  { id: 'jester', title: 'Błazen', desc: '8 osobnych zakupów w jeden dzień', group: 'Grzeszki', tier: 1, target: 8, unit: '×', kind: 'bad',
    lore: 'Kup tu, kliknij tam — żonglujesz paragonami jak dworski błazen piłeczkami.', value: c => c.maxTxPerDay },
  { id: 'ags-edge', title: 'Kaszlnięcie Ostrzegawcze', desc: 'Dzień z dokładnie 2 różnymi niestałymi zakupami', group: 'Grzeszki', tier: 1, target: 1, kind: 'bad',
    lore: 'Jeszcze nic, ale już warto uważać.', value: c => c.agsEdgeDayEver ? 1 : 0 },
  { id: 'ags-month', title: 'Uczulenie Na Promocje', desc: '5 dni AGŚ w jednym miesiącu', group: 'Grzeszki', tier: 2, target: 5, unit: 'dni', kind: 'bad',
    lore: 'Coś tu regularnie wpada do koszyka bez planu.', value: c => c.agsDaysThisMonthMax },
  { id: 'ags-streak', title: 'Alarm Smogowy', desc: 'AGŚ 3 miesiące z rzędu', group: 'Grzeszki', tier: 3, target: 3, unit: 'msc', kind: 'bad',
    lore: 'To już nie wypadek, to styl życia.', value: c => c.agsMonthStreak },
  { id: 'ags-trash', title: 'AGŚ', desc: 'Automatyczny Generator Śmieci', group: 'Grzeszki', tier: 1, target: 1, kind: 'bad',
    lore: 'Niby mem, ale efekt zakupocholizmu jest prawdziwy.', value: c => c.agsDayEver ? 1 : 0 },
];

// ── Build context (single source of truth — dashboard + gablota call this) ───
const JUNK = ['słodycz', 'slodycz', 'słodki', 'slodki', 'cukier', 'czekolad', 'baton', 'chips', 'fast', 'frytk', 'mcdonald', 'kfc', 'lody', 'ciast', 'żelk', 'zelk', 'oreo', 'jeżyk', 'jezyk', 'toffi', 'chałw', 'chalw', 'paluszk', 'chrupk'];
const FASTFOOD = ['mcdonald', 'kfc', 'pizza', 'burger', 'kebab', 'kebap', 'sushi', 'dominos', 'telepizza', 'bobby', 'pyszne', 'glovo', 'wolt', 'fast food', 'frytk'];
const TRAIN = ['pkp', 'intercity', 'koleo', 'polregio', 'pociąg', 'pociag', 'kolej', 'e-podroznik', 'przewozy region'];
const JAPAN = ['matcha', 'mochi', 'sushi', 'ramen', 'wasabi', 'nori', 'miso', 'sake', 'teriyaki', 'udon', 'sashimi', 'edamame', 'wakame', 'dango', 'takoyaki', 'onigiri', 'yakisoba'];
const DRINKS = ['sok ', 'napój', 'napoj', 'cola', 'pepsi', 'sprite', 'fanta', 'oranżad', 'oranzad', 'lemoniad', 'energetyk', 'monster', 'red bull', 'redbull', 'tymbark', 'kubuś', 'kubus', 'ice tea', 'lipton', 'powerade', 'nestea', 'mirinda', '7up', 'mirinda', 'hoop', 'żywiec zdrój smak', 'frugo', 'toma', 'caprio'];
const MEAT = ['mięso', 'mieso', 'kurczak', 'wołowin', 'wolowin', 'schab', 'karków', 'karkow', 'boczek', 'kiełbas', 'kielbas', 'szynk', 'mielone', 'indyk', 'żeberk', 'zeberk', 'parów', 'parow', 'pierś', 'piers', 'wieprz', 'polędwic', 'poledwic', 'filet z'];
const BETTING = ['lotto', 'zakład', 'zaklad', 'totalizator', 'kasyno', 'lottomat', 'obstaw', 'betclic', 'betfan', 'fortuna zakład', 'sts '];
// bagesv2 batch — fruit/veg and fish keyword lists, same "keyword hit on item name" pattern as MEAT/JAPAN/DRINKS.
const VEG_FRUIT = ['ziemniak', 'marchew', 'pomidor', 'ogórek', 'ogorek', 'cebul', 'czosnek', 'sałat', 'salat', 'brokuł', 'brokul', 'kalafior', 'papryk', 'cukini', 'bakłażan', 'baklazan', 'burak', 'rzodkiew', 'szpinak', 'kapust', 'por ', 'fasol', 'groch', 'dynia', 'jabłk', 'jablk', 'banan', 'pomarańcz', 'pomaranc', 'cytryn', 'gruszk', 'winogron', 'truskaw', 'malin', 'jagod', 'śliwk', 'sliwk', 'brzoskwi', 'arbuz', 'melon', 'kiwi', 'mandarynk', 'grejpfrut'];
const FISH = ['łosoś', 'losos', 'tuńczyk', 'tunczyk', 'dorsz', 'makrel', 'śledź', 'sledz', 'pstrąg', 'pstrag', 'sandacz', 'karp', 'sardynk', 'krewet', 'małż', 'malz', 'kalmar', 'ryba', 'ryby', 'flądra', 'fladra', 'morszczuk', 'mintaj', 'halibut'];
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// walk back from today counting consecutive days for which pred(dayKey) holds
function streakBack(pred: (k: string) => boolean): number {
  let n = 0; const base = new Date();
  for (let i = 0; i < 400; i++) { const d = new Date(base); d.setDate(d.getDate() - i); if (!pred(dayKey(d))) break; n++; }
  return n;
}
// same walk, but for "streak of days WITHOUT X" (no junk, no spending…): pred is
// vacuously true on any day with zero data, so the walk stops at `floorDay` (the
// earliest day tracking exists) instead of running to the 400-day cap — otherwise a
// brand-new user with an empty ctx would show a multi-hundred-day "clean" streak.
function absenceStreakBack(pred: (k: string) => boolean, floorDay: string | null): number {
  if (!floorDay) return 0;
  return streakBack(k => k >= floorDay && pred(k));
}
// same walk, but months instead of days — for AGŚ month-streaks / budget-streaks
function monthStreakBack(sortedMonthKeys: string[], thisMonth: string, pred: (m: string) => boolean): number {
  const closed = sortedMonthKeys.filter(m => m !== thisMonth).sort();
  let n = 0;
  for (let i = closed.length - 1; i >= 0; i--) { if (!pred(closed[i])) break; n++; }
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
  foodMeals?: { date?: string }[];   // calorie-counter meals
  dishesCreated?: number;            // own dishes/recipes in the library
  // bagesv2 batch — all optional, all default to "not yet" so old callers keep working.
  bankCorrections?: number;
  autoMerchantReached?: boolean;
  scannedReceipts?: number;
  statsVisits?: number;
  backupDone?: boolean;
  selfTestClean?: boolean;
  loginStreak?: number;
}): AchCtx {
  const { expenses, moodEntries, workEvents, workSettings, healthDays } = args;
  const foodMeals = args.foodMeals ?? [];
  const foodDays = new Set<string>();
  for (const m of foodMeals) { const d = (m.date ?? '').slice(0, 10); if (d) foodDays.add(d); }
  const wcol = workSettings.workColor;
  const wp = workSettings.workPrefix?.trim().toLowerCase();
  const workHoursTotal = workEvents
    .filter(e => isWorkEvent(e, { workColor: wcol, workPrefix: wp }))
    .reduce((sum, e) => sum + shiftHours(e), 0);

  let savingsTotal = 0, receiptsCount = 0, thisMonthExp = 0, junkPurchasesMonth = 0, fastFoodCount = 0;
  let trainTrips = 0, japanItems = 0, drinkPurchasesMonth = 0, maxSinglePurchase = 0, bettingBought = false;
  let fishItems = 0, selfTransferCount = 0, depositItemsReturned = 0;
  const thisMonth = dayKey(new Date()).slice(0, 7);
  const junkDays = new Set<string>();
  const loggedDays = new Set<string>();
  const expenseDays = new Set<string>(); // days with a real (non-income, non-transfer) expense —
  // bounds the "clean streak" walks below so a day BEFORE tracking started never counts as "clean".
  const daySpend: Record<string, number> = {};
  const txByDay: Record<string, number> = {};
  const meatByDay: Record<string, number> = {};
  const fishByDay: Record<string, number> = {};
  const elecByMonth: Record<string, number> = {};
  const catSet = new Set<string>();
  const monthAgg: Record<string, { inc: number; exp: number }> = {};
  const produceByDay: Record<string, Set<string>> = {};
  const allProduce = new Set<string>();
  const purchaseNamesByDay: Record<string, Set<string>> = {};
  for (const e of expenses) {
    const day = (e.date ?? '').slice(0, 10);
    if (day) loggedDays.add(day);
    const isInc = e.type === 'income';
    const m = (e.date ?? '').slice(0, 7);
    if (m) (monthAgg[m] ??= { inc: 0, exp: 0 });
    if (isInc) { if (m && !isSelfTransfer(e)) monthAgg[m].inc += e.amount; continue; }
    receiptsCount++;
    if (day) expenseDays.add(day);
    if (isSelfTransfer(e)) { savingsTotal += e.amount; selfTransferCount++; continue; }
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
    // "AGŚ" — distinct non-staple item names bought that day (every receipt item counts;
    // recurring bills aren't receipt items in this app, so nothing to exclude further).
    // Falls back to the expense's own note when there's no item breakdown (quick-add).
    const items = e.receiptItems ?? [];
    for (const it of items) {
      if (it.kind === 'deposit') { depositItemsReturned++; continue; }
      const inm = (it.name ?? '').trim().toLowerCase();
      if (inm && day) (purchaseNamesByDay[day] ??= new Set()).add(inm);
    }
    if (items.length === 0 && day && e.note) (purchaseNamesByDay[day] ??= new Set()).add(e.note.trim().toLowerCase());
    // product-level detection (meat/fish/produce kg, japan, drinks)
    for (const it of items) {
      if (it.kind === 'deposit') continue;
      const nm = (it.name ?? '').toLowerCase();
      const isMeat = (it.tags ?? []).includes('mięso') || MEAT.some(k => nm.includes(k));
      if (isMeat && day) meatByDay[day] = (meatByDay[day] ?? 0) + (it.weightKg && it.weightKg > 0 ? it.weightKg : (it.quantity || 1));
      const isFish = FISH.some(k => nm.includes(k));
      if (isFish) { fishItems++; if (day) fishByDay[day] = (fishByDay[day] ?? 0) + (it.weightKg && it.weightKg > 0 ? it.weightKg : (it.quantity || 1)); }
      const produceHit = VEG_FRUIT.find(k => nm.includes(k));
      if (produceHit && day) { (produceByDay[day] ??= new Set()).add(produceHit); allProduce.add(produceHit); }
      if (JAPAN.some(k => nm.includes(k))) japanItems++;
      if (m === thisMonth && !nm.includes('woda') && DRINKS.some(k => nm.includes(k))) drinkPurchasesMonth++;
    }
  }
  const maxDaySpend = Object.values(daySpend).reduce((mx, v) => Math.max(mx, v), 0);
  const maxTxPerDay = Object.values(txByDay).reduce((mx, v) => Math.max(mx, v), 0);
  const monthUnderBudget = args.budgetTotal > 0 && Object.entries(monthAgg).some(([m, v]) => m !== thisMonth && v.exp > 0 && v.exp <= args.budgetTotal);
  const firstExpenseDay = expenseDays.size ? [...expenseDays].sort()[0] : null;

  // meat/fish: most kg in any rolling 7-day window
  const rollingMaxKg = (byDay: Record<string, number>): number => {
    let max = 0;
    const days = Object.keys(byDay);
    for (const d of days) {
      const end = new Date(d + 'T00:00:00').getTime();
      let sum = 0;
      for (const d2 of days) {
        const t2 = new Date(d2 + 'T00:00:00').getTime();
        if (t2 <= end && t2 > end - 7 * 86400000) sum += byDay[d2];
      }
      if (sum > max) max = sum;
    }
    return max;
  };
  const meatWeekMaxKg = rollingMaxKg(meatByDay);
  const fishWeekMaxKg = rollingMaxKg(fishByDay);

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
  // a day with mood ≤2 immediately followed (next calendar day) by a day with mood ≥4
  let moodBounceBack = false;
  { const sortedDays = Object.keys(moodByDay).sort();
    for (let i = 0; i < sortedDays.length - 1; i++) {
      const a = new Date(sortedDays[i] + 'T00:00:00'); a.setDate(a.getDate() + 1);
      if (dayKey(a) === sortedDays[i + 1] && (moodMinByDay[sortedDays[i]] ?? 99) <= 2 && moodByDay[sortedDays[i + 1]] >= 4) { moodBounceBack = true; break; }
    } }

  // sleep (best step + bad-sleep streak)
  let bestStepsDay = 0;
  for (const v of Object.values(healthDays)) bestStepsDay = Math.max(bestStepsDay, v.steps || 0);

  const balancedMonth = Object.values(monthAgg).some(m => m.exp > 0 && m.inc >= m.exp);

  // budget streaks/precision — walk CLOSED months (excludes the still-open current one)
  const closedMonthKeys = Object.keys(monthAgg).filter(m => m !== thisMonth && monthAgg[m].exp > 0);
  const monthsUnderBudgetStreak = args.budgetTotal > 0
    ? monthStreakBack(closedMonthKeys, thisMonth, m => monthAgg[m].exp <= args.budgetTotal) : 0;
  const monthWithinBudgetBand = args.budgetTotal > 0
    && closedMonthKeys.some(m => Math.abs(monthAgg[m].exp - args.budgetTotal) <= args.budgetTotal * 0.05);

  // AGŚ — day/month/streak views over the same purchaseNamesByDay accumulator
  const agsDay = (k: string) => (purchaseNamesByDay[k]?.size ?? 0) > 2;
  const agsEdgeDay = (k: string) => (purchaseNamesByDay[k]?.size ?? 0) === 2;
  const agsDayEver = Object.keys(purchaseNamesByDay).some(agsDay);
  const agsEdgeDayEver = Object.keys(purchaseNamesByDay).some(agsEdgeDay);
  const agsDaysByMonth: Record<string, number> = {};
  for (const k of Object.keys(purchaseNamesByDay)) if (agsDay(k)) { const mm = k.slice(0, 7); agsDaysByMonth[mm] = (agsDaysByMonth[mm] ?? 0) + 1; }
  const agsDaysThisMonthMax = Object.values(agsDaysByMonth).reduce((mx, v) => Math.max(mx, v), 0);
  const agsMonthStreak = monthStreakBack(closedMonthKeys.length ? closedMonthKeys : Object.keys(agsDaysByMonth), thisMonth, m => (agsDaysByMonth[m] ?? 0) > 0);
  const cleanMonthNoAgs = closedMonthKeys.some(m => !(agsDaysByMonth[m] > 0));

  const savingsTotalFinal = savingsTotal > 0 ? savingsTotal : (args.cardBalancePeak ?? 0);
  const cardBalancePeakFinal = args.cardBalancePeak ?? 0;
  const scannedReceipts = args.scannedReceipts ?? expenses.filter(e => e.viaScan).length;

  return {
    habitBestStreak: args.habitBestStreak,
    noJunkStreak: absenceStreakBack(k => !junkDays.has(k), firstExpenseDay),
    // "Odłożone" = tagged self-transfers if you use them; otherwise fall back to the
    // highest balance you ever reached, so the saver badges reflect real money even
    // without a separate savings account.
    savingsTotal: savingsTotalFinal,
    receiptsCount, moodDays, workHoursTotal,
    paydayLogged: expenses.some(e => e.type === 'income' && (e.category === 'salary' || (!!wp && `${e.note ?? ''} ${(e.tags ?? []).join(' ')}`.toLowerCase().includes(wp)))),
    bestStepsDay, billTracked: args.billTracked,
    logStreak: streakBack(k => loggedDays.has(k)),
    activeDays: loggedDays.size,
    mealsLogged: foodMeals.length,
    foodDaysLogged: foodDays.size,
    foodLogStreak: streakBack(k => foodDays.has(k)),
    dishesCreated: args.dishesCreated ?? 0,
    goodMoodStreak: streakBack(k => (moodByDay[k] ?? 0) >= 4),
    moodLevelsSeen: moodLevels.size,
    balancedMonth, hasBudget: args.budgetTotal > 0, tasksDone: args.tasksDone,
    goodSleepStreak: streakBack(k => { const sl = healthDays[k]?.sleepMinutes; return !!sl && sl >= 420; }),
    lowMoodStreak: streakBack(k => { const mn = moodMinByDay[k]; return mn != null && mn <= 2; }),
    neutralMoodStreak: streakBack(k => moodByDay[k] === 3 && moodMinByDay[k] === 3),
    moodSwing7,
    noSpendStreak: absenceStreakBack(k => !daySpend[k], firstExpenseDay),
    trainTrips, japanItems, drinkPurchasesMonth, meatWeekMaxKg, cutElectricity,
    maxSinglePurchase, bettingBought, maxTxPerDay, distinctCategories: catSet.size,
    cardBalancePeak: cardBalancePeakFinal,
    monthUnderBudget,
    junkStreak: streakBack(k => junkDays.has(k)),
    badSleepStreak: streakBack(k => { const s = healthDays[k]?.sleepMinutes; return !!s && s > 0 && s < 300; }),
    overBudgetPct: args.budgetTotal > 0 ? thisMonthExp / args.budgetTotal : 0,
    junkPurchasesMonth, fastFoodCount, maxDaySpend,
    distinctProduceAllTime: allProduce.size,
    maxDailyProduceVariety: Object.values(produceByDay).reduce((mx, s) => Math.max(mx, s.size), 0),
    produceVarietyStreak: streakBack(k => (produceByDay[k]?.size ?? 0) >= 5),
    fishItems, fishWeekMaxKg,
    monthsUnderBudgetStreak, monthWithinBudgetBand,
    selfTransferCount, depositItemsReturned,
    pirateTreasure: savingsTotalFinal >= 1000 && cardBalancePeakFinal >= 5000 && monthUnderBudget,
    moodMastery: moodDays >= 60 && moodLevels.size >= 5 && streakBack(k => (moodByDay[k] ?? 0) >= 4) >= 30 && moodBounceBack,
    moodBounceBack,
    bankCorrections: args.bankCorrections ?? 0,
    autoMerchantReached: args.autoMerchantReached ?? false,
    scannedReceipts,
    statsVisits: args.statsVisits ?? 0,
    backupDone: args.backupDone ?? false,
    selfTestClean: args.selfTestClean ?? false,
    loginStreak: args.loginStreak ?? 0,
    agsDayEver, agsEdgeDayEver, agsDaysThisMonthMax, agsMonthStreak, cleanMonthNoAgs,
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

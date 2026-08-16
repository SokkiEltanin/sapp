# Sapp — mapa architektury i połączeń

> Żywy dokument. **Czytaj to PRZED dodaniem/zmianą funkcji** — pokazuje, gdzie co żyje,
> jak rzeczy są ze sobą powiązane i jakie konwencje trzymać, żeby nie psuć działających
> rzeczy (i nie latać na 10 buildów). Aktualizuj go, gdy dodajesz nową sekcję, metrykę,
> store albo subsystem.

Aplikacja: **Sapp** — jednoosobowy tracker na Androida (Expo SDK 54, RN 0.81 New Arch,
TypeScript, expo-router v6, Zustand, Firestore + AsyncStorage, react-native-svg,
react-native-reanimated v4). Paczka `com.sokki.sapp`, scheme `sapp://`, UI po polsku,
ciemny motyw. APK budowany przez GitHub Actions/Releases. Dystrybucja: jeden użytkownik.

---

## 1. Punkty wejścia

- **`app/_layout.tsx`** — root. Ładuje czcionki, migracje, obsługę crashy, **animowany
  splash** (`AnimatedSplash`), deep-linki z powiadomień (`Notifications.addNotificationResponseReceivedListener`
  → `screen` w `data` → router), drenaż powiadomień bankowych na starcie/foreground.
  Cały drzewo appki jest bramkowane na `authReady`; splash nakłada się aż do `splashGone`.
- **`app/(tabs)/_layout.tsx`** — nawigator zakładek. **KLUCZOWE flagi:** `lazy:false`,
  `detachInactiveScreens:false`, `freezeOnBlur:true` → wszystkie ekrany zostają
  zamontowane, nieaktywne są „zamrożone". Zakładki (6): `/` (Dziś), `/tasks`, `/stats`
  (to KALENDARZ), `/finances`, `/health` (Zdrowie = zegarek/ciało), `/food` (Jedzenie =
  kalorie/produkty/waga/woda). Ekrany `href:null` (poza paskiem): `calendar`, `mood`.
  **Dodając zakładkę:** `TABS` w `(tabs)/_layout.tsx` + `<Tabs.Screen>` ORAZ `TAB_PATHS`
  / `TABS` / `TAB_ACCENTS` (+ ewentualnie `ACTIONS`) w `TabBar.tsx` — inaczej pasek i
  swipe się rozjadą.
- Pasek zakładek: `src/components/ui/TabBar.tsx` (własny, nie natywny). Górna pigułka:
  `TopPill`. „+” = overlay w drzewie (NIE natywny Modal).

## 2. Mapa katalogów (co gdzie żyje)

```
app/                    ekrany (expo-router). (tabs)/ = 4 zakładki; reszta to pushowane trasy
  (tabs)/index.tsx      DASHBOARD — najważniejszy, ~2600+ linii (patrz §4)
  (tabs)/finances.tsx   lista transakcji + karta "TEN MIESIĄC" + filtry
  (tabs)/stats.tsx      KALENDARZ (CalendarGrid/WeekStrip/DayTimeline), nie "statystyki"
  (tabs)/health.tsx     Zdrowie (Health Connect), (tabs)/mood.tsx nastrój
  expenses/[id].tsx     szczegóły transakcji (read-mode chip + Edytuj → formularz)
  expenses/scan.tsx     skaner paragonów (OCR + edycja produktów)
  widget-builder.tsx    kreator customowych kafelków statystyk
  pet.tsx, pet-shop.tsx pupil (kot) + sklep na kolory/prążki
src/store/              Zustand. Persist przez AsyncStorage; wiele jest w backupie
src/services/           I/O: Firestore, bank, powiadomienia, health, kalendarz, pogoda
src/utils/              czysta logika/obliczenia (statWidgets, productMemory, payday, …)
src/components/         dashboard/ pet/ ui/ expenses/ mood/ achievements/ calendar/ …
src/hooks/              useExpenses, useTasks, useHabits, useWorkEarnings, …
src/theme/              themedStyles, useColors, colors/lightColors, spacing, radius
src/types/index.ts      MODEL DANYCH (Expense, ReceiptItem, Subscription, Debt, …)
plugins/                config-plugins natywne (bank listener, shortcuts, health, crash)
app.json                ikona/splash/uprawnienia/scheme/plugins
```

## 3. Motyw i style — ZAWSZE tak

- `useColors()` zwraca **stabilny** obiekt palety (darkColors/lightColors z modułu).
- Style: **`themedStyles((c) => StyleSheet.create({...}))`** — cache’uje jeden arkusz na
  paletę. **NIGDY per-komponent `makeStyles(c)` wołane w renderze** — to był powód
  ~30 s zwiechy edytora ORAZ black-screena po zapisie paragonu (11000+ obiektów stylu
  na paragon = ANR). Patrz `src/theme/themedStyles.ts`.
- Kolory z palety: `c.bg.primary`, `c.bg.card`, `c.bg.elevated`, `c.text.primary/secondary/muted`,
  `c.border.default/subtle`, `c.accent.blue/green/red`.
- **Android New Arch:** NIGDY nie dawaj `shadow*` w `style` `LinearGradient` — owijaj w
  `View` i cień na wrapperze (inaczej crash „Cannot set prop 'colors'").

## 4. DASHBOARD (`app/(tabs)/index.tsx`) — jak to działa

Ogromny komponent renderujący sekcje w kolejności z układu użytkownika.

**Sekcje** rejestrowane w `src/store/dashboardLayout.ts`:
- `DEFAULT_DASHBOARD_SECTIONS` (lista id w domyślnej kolejności),
- `SECTION_TITLES` (nazwa w edytorze), `SECTION_DESC` (opis), `SECTION_GROUP` (grupa w
  puli „dodaj sekcję"), `SECTION_GROUP_ORDER`.
- `AUTO_SECTIONS` = alerty kontekstowe (payday/debt/bill/sub/bank-queue/budget/habits-nudge)
  — **ukryte w edytorze**, pojawiają się same, gdy jest co powiedzieć.
- `effectiveOrder(order, customTiles)` — scala zapisany układ z katalogiem: **nowe
  domyślne sekcje wskakują automatycznie** na naturalną pozycję (po najbliższej wcześniejszej
  obecnej). Dzięki temu dodanie sekcji do DEFAULT_… pokazuje ją istniejącym użytkownikom.

**Render:** budowany jest obiekt `nodes: Record<id, ReactNode|false>`; pętla
`orderedSections.map(id => nodes[id])` renderuje je (pomijając hidden + przypięte
payday/bill/bank-queue). Node ustawiony na `false` (gdy brak danych) = nic się nie renderuje.

**Snapshot statystyk (WYDAJNOŚĆ — pamiętaj o tym):** widgety czytają lokalny snapshot
`expenses` (`useState`), **nie** żywy store `liveExpenses`. Snapshot odświeża się TYLKO na
triggerach, każdy odroczony przez `InteractionManager.runAfterInteractions`: (A) wejście na
dashboard (`useFocusEffect`), (B) zmiana `liveExpenses` gdy `screenFocused` (debounce 300 ms),
(C) powrót appki z tła. Powód: store „tętni" (bank, inne ekrany), a `freezeOnBlur` kumulował
przeliczanie ~84 memo na „odmrożenie" = 4-6 s zwiechy przy przełączaniu zakładek.
**Handler, który czyta ORAZ zapisuje expenses (`removeTagItem`) MUSI używać
`useExpensesStore.getState().expenses`** — mapowanie starego snapshotu do `setExpenses`
gubiłoby wpisy dodane od ostatniego odświeżenia.

**Customowe kafelki** (`renderStatTile` w index.tsx): viz `number | wave | list | donut |
compare | pixels`. Każdy nagłówek ma plakietkę jednostki (`unitChip`), a wykresy podpis
okresu (`periodCaption`). Szczegóły po tapnięciu = modal `statDetail` z przełącznikiem
Tydzień/Miesiąc (`detailPeriod`).

## 5. Customowe widgety / metryki — `src/utils/statWidgets.ts`

- **`WIDGET_METRICS`**: lista `{ id, label, group, unit, viz[], periodic, needsTag? }`.
  Grupy: Finanse / Konsumpcja / Nastrój i zdrowie / Praca i zadania.
- **`metricNumber` / `metricSeries` / `metricList`** — liczą wartość/serię/ranking dla
  metryki z `StatCtx` (expenses, scope, moodEntries, healthDays, workEvents, tasks, …).
  Etykiety osi z `predsFor` → `monthLabel` (nazwa miesiąca) / `weekLabel` ("DD.MM" =
  poniedziałek tygodnia).
- **Kreator** `app/widget-builder.tsx` ma podgląd na PRAWDZIWYCH danych (buduje własny
  `StatCtx` ze storów). Zapisuje `CustomTile` do `dashboardLayout` (`addCustomTile`).
- `isSelfTransfer(e)` (statWidgets) = przelew własny (kategoria `transfer` lub tag
  oszczednosci/przelew/revolut) — wykluczany ze spend I z przychodów, liczony w `savings`.

## 6. Finanse / model pieniędzy

- **`src/types/index.ts`**: `Expense` (type 'expense'|'income', amount, category, tags[],
  date, paymentMethod 'card'|'cash', payer, receiptItems[], bankMatched, storeName…).
  `ReceiptItem` (name, **price = już po rabatach**, quantity, unitPrice, discount?,
  kind?'deposit', excluded?, weightKg?, tags[], eaters[]).
- Store: **`expensesStore`** (`useExpensesStore`), serwis **`expensesService`** (Firestore
  `expenses` + `strip()` undefined przed zapisem). Hook `useExpenses` (grouped/stats).
- Scope: **`statsScope`** — `scope: 'mine'|'all'` = kto PŁACI (pieniądze) i kto JE
  (konsumpcja). `inScope`/`isMine`/`consumesInScope` niosą to przez statystyki.
- Grupowanie produktów: `productMemory.ts` — `canonicalProductName` + `productGroupKey` +
  `productGroupLabel` (warianty typu „serek wiejski *" łączą się w „serek"). Ceny:
  `PriceStat {n,mean,min,max,last}` (`product_price_memory`).
- **Saldo = JEDNA liczba** „NA KARCIE" = `balanceOffset + all income − all spending`
  (2026-07-20: cash/gotówka WYCIĘTE — user nie używa; usunięto pigułki Gotówka/Razem G+K
  z hero i pola gotówki z Ustawień `getCashOffset`/`setCashOffset`; `paymentMethod` na
  Expense zostaje). Offset ustawiasz w Ustawieniach → „Saldo konta".
- Karta „TEN MIESIĄC" w finances.tsx (`monthPulse`): paski Przychody/Wydatki + „Zostało",
  potem DWIE czytelne linie (tempo vs ten sam dzień zeszłego miesiąca; ile/dzień zostało).
  Odchudzona z zabałaganionej siatki 2×2. Lista transakcji domyślnie ostatnie 31 dni +
  „Pokaż starsze" (`capTx`/`showAllTx`).

## 7. Bank → wydatek (pipeline) — patrz też memory [[bank_auto_expenses]]

`bankNotification.ts` (parse) → `bankIngest.ts` (kategoria/pewność/kolejka) →
`bankQueueStore.ts` (`pending[]`, `autoAll`) → `bankCommit.ts` (commit, dedupe, dopasowanie
do paragonu). Natywny nasłuch: `plugins/withBankNotificationListener.js` (Kotlin
`NotificationListenerService` → plik) → `bankNotificationDrain.ts` czyta na starcie/foreground.
Auto-akceptacja zaufanych sklepów: `bankAutoProcess.ts` + `merchantMemory.ts`.
**REGUŁA: „nie łapie" ≠ bug parsera.** Najpierw test parsera na dokładnym stringu
(heredoc w bashu ZJADA backslashe — pisz test do pliku). Kierunek in/out: uwaga na „na
konto" (cel) vs „z konta *cyfry"/„wykonano przelew" (wychodzący). Przelew na własne
konto → `selfTransfer` → kategoria `transfer` + tag `revolut`.

## 8. Zdrowie / Health Connect

- `healthConnectService.ts` (natywny odczyt), `healthAutoSync.ts` (`autoSyncHealth(days,
  force)` — cache per-dzień `health_YYYY-MM-DD`; `force` omija throttle 10 min).
  Dashboard forsuje TYLKO na wejściu do appki (cold start + resume), nie na każdy tab-focus.
- `healthHistory.ts` `getHealthHistory(n)` = jeden `multiGet` (sen/waga/kroki/**burn**).
  `dailyBurnFromHc(hc)` = dzienne całkowite spalanie (total ≥1200, inaczej BMR+aktywne) —
  wspólne dla karty energii w Zdrowiu i kafelka kalorii w Jedzeniu. Zegarek = źródło
  prawdy; tylko wagę można nadpisać ręcznie. Uprawnienia w app.json (patrz §11).

## 8b. Jedzenie / liczenie kalorii — MANUALNE, ODDZIELNE od paragonów

- **Zasada:** apka NIGDY nie zakłada „kupione=zjedzone", nie odejmuje spiżarni, nie zgaduje.
  Paragony i kalorie to osobne światy; paragon co najwyżej PODbija świeżo kupiony produkt w
  podpowiedziach (`fresh`). **Tylko user dodaje/zatwierdza produkt liczony.**
- `src/store/foodStore.ts` (persist `food-store-v1`, w backupie): `products` (FoodProduct —
  kcalPer100g LUB kcalPerPortion „na oko" + uczone `unitGrams`), `meals` (MealEntry: date,
  type, items z ROZWIĄZANYMI grams+kcal), `presets` (MealPreset — UI w Etapie 2), `goalMode`.
  Helpery: `unitToGrams`, `computeItemKcal`, `targetIntake(burn,mode,manual)`, `UNIT_META`
  (jednostki domowe: plaster/kromka/łyżka/garść/szklanka/porcja z domyślnymi gramami).
- `src/data/foodBase.ts` — wbudowana OFFLINE baza kcal/100g (~150 polskich produktów) +
  porcje domowe; `searchFoodBase(q)`. Startowa — to co user doda/zweryfikuje w foodStore wygrywa.
- `app/(tabs)/food.tsx` — kafelek pierścienia (zjedzone vs cel + spalone + zostało), wybór
  celu (redukcja/utrzymanie/masa), lista posiłków dnia wg typu — **posiłki ROZWIJANE**
  (`expanded` Set, tap=rozwiń → rozpis pozycji: nazwa/gramy/kcal + godzina `hhmm(ts)`; edycja/kosz
  osobno). FAB „Co zjadłem" = `ACTIONS[5]` w TabBar → `app/food/add.tsx`. **Przeglądanie w
  SEGMENTACH (jedno naraz):** `browseTab` Dania / Produkty / Ostatnie (chipy) — akcje „utwórz"
  wewnątrz segmentu (Nowy przepis w Daniach, Wpisz ręcznie w Produktach). Wyszukiwarka (z wpisem)
  = szybkie znajdowanie: dania+kompozycje (`libMatches`) + pojedyncze produkty (`candidates` bez
  isRecipe) + „Dodaj nowy". Helpery `renderLibRow`/`renderSingle` reużyte. Picker jednostki+ilości: ilość EDYTOWALNA
  (ułamki 0,5/1,5 — `qtyText`+`bumpQty`), podgląd kcal, override gram UCZY porcję; „Wpisz
  ręcznie" = produkt kcalPerPortion. Reużywa `productMemory` + `normalizeProductName`.
- **Bilans kalorii:** `getHealthHistory` niesie `burn` per dzień → karta „Bilans tygodnia"
  na zakładce Jedzenie (7 słupków deficyt/nadwyżka + ≈kg) ORAZ sekcja dashboardu
  `calorie-balance` (memo `calorieBalance`; StatCtx.healthDays ma teraz `burn?`). Deficyt
  liczony tylko z dni, w które faktycznie logowano jedzenie.
- **Produkty liczone + makra:** `FoodProduct` ma kcal/100g + makra `protein100/carbs100/
  fat100` (B/W/T) + `cat` (FOOD_SUBCATS) + `linkedName` (powiązanie z kupionym). Formularz
  `app/food/product.tsx` (kategoria/nazwa/waga/kcal/makra/link), lista `app/food/products.tsx`
  („Moje produkty"), wejścia = druga akcja FAB przy zakładce (Apple). **Kalorie edytuje się
  TYLKO tu** — w `app/products.tsx` zostało samo matchowanie/scalanie + tagi/waga/kategoria.
  MealItem niesie rozwiązane makra; presety/dania je sumują; zakładka pokazuje dzienne B/W/T.
- **Zapotrzebowanie:** `bmrMifflin(kg,cm,age,sex)` (profil w `health_goals`: heightCm/ageYears/
  sex + `activityLevel`, modal Profil na zakładce) → spalanie = BMR (spoczynek) + active (ruch).
  **Ruch = MAX(aktywne z zegarka, oszac. z kroków, podłoga `activityFloor(bmr,level)` =
  BMR×factor).** Podłoga (sed 0.15 / light 0.30 / mod 0.45 / high 0.62) łapie rower i aktywność
  której kroki nie widzą — bez niej cel bywał za niski. `dailyBurnFromHc(...,floorFrac)` i
  `getHealthHistory(...,floorFrac)` niosą factor; dashboard i zakładka czytają `activityLevel`
  z `health_goals` (spójny cel). Domyślnie `mod`.
  `foodBase.ts` = warzywa+owoce + **podstawy do wypieków** (jajko 55 g/szt, mąka 130 g/szkl,
  olej 13 g/łyżkę…) — kluczowe są poprawne gramy na jednostkę, by PRZEPISY liczyły się od razu.
- **Biblioteka: PRODUKTY vs KOMPOZYCJE I DANIA.** Dwa ekrany-siostry z przełącznikiem u góry:
  `app/food/products.tsx` (Produkty = surowe składniki; dania odfiltrowane) ↔ `app/food/library.tsx`
  (Kompozycje i dania = presety + dania-z-przepisu, grupowane wg `PRESET_CATS`, ULUBIONE na górze,
  wyszukiwarka, przytrzymaj=usuń). Przełącznik = `router.replace` między nimi. FAB zakładki (index 5):
  Apple→products, ChefHat→library, UtensilsCrossed→add.
- **PRZEPIS = PRODUKT (ważysz ugotowane).** `app/food/recipe.tsx`: składniki w dowolnych jednostkach
  (reużywa picker z add), **typ przygotowania** `RecipeMeta.prep`: **raw** (mieszanka — waga = suma
  składników, auto/edytowalna) · **cooked** (wpisz wagę gotowego) · **fried** (waga + `fryFat`: na czym
  smażone, w łyżkach → +kcal, bardziej tłuste). `recipeDensity(ings, weight, extraKcal, extraFatG)` →
  `kcalPer100g = (Σkcal+tłuszcz)/waga·100`. `saveRecipeProduct({name, ingredients, weight, cat?, id?,
  prep?, fryFat?, addons?})` → `FoodProduct.recipe`. **Dodatki** (`recipe.addons`, nutella/banan) =
  jedzone RAZEM, liczone OSOBNO (nie w gęstości); w kreatorze rola Składnik/Dodatek w pickerze; przy
  logowaniu w „Co zjadłem" doklejają się jako osobne pozycje (usuwasz niezjedzone). Danie ma ChefHat w
  wyszukiwarce; edycja `/food/recipe?edit=<id>`, dup `?dup=`; presety przez `/food/add?preset=<id>`.
  `FoodProduct.pinned` + `togglePinProduct`.
- **Data jedzenia + wstecz:** `app/food/add.tsx` ma wybór dnia (DatePickerField, skrót „Dziś");
  `updateMeal(id,type,items,note?,date?)` — edycja może przenieść posiłek. Kroki double-count fix:
  `stepsBySourceMax` w healthConnectService (MAX ze źródeł, nie suma).
- **Widget „Zaoszczędzone":** `computeSavings(expenses)` (utils/savings.ts) sumuje `ReceiptItem.discount`
  (parser łapie RABAT/LIDL PLUS/KUPON/BON); sekcja dashboardu `savings` (grupa Finanse) — łącznie/mies./Lidl.
- **Perf:** `uiPrefs.liteMode` („Ogranicz animacje", Ustawienia→Interfejs) → `AnimatedCardBg` zwraca null
  (animowane rozmyte SVG chmury/cząsteczki = najdroższy efekt na Androidzie). Self-test zdrowia:
  `runHealthSelfTest()` + `app/health-test.tsx` (Ustawienia→Diagnostyka), kroki WG ŹRÓDŁA.
- **Splash:** `AnimatedSplash` bez kota/SVG (wordmark + pasek + kropki); app.json splash = samo navy.
- **Biblioteka presetów:** `MealPreset.cat` (PRESET_CATS: kanapki/naleśniki/dania/wypieki/sałatki/
  napoje/przekąski/inne) + `pinned` + `togglePinPreset`; okno presetu: Przypnij/Edytuj/Kopia/Usuń
  + pomijanie składników.
- **Duplikowanie (warianty):** „Kopia" wczytuje danie/kompozycję jako NOWĄ (zmień bułkę/składnik →
  zapisz). Presety: `/food/add?dupPreset=<id>` (efekt ładuje items, `editPresetId=null`, nazwa
  „ (kopia)", baner `dupNotice`); dania: `/food/recipe?dup=<id>` (editId puste → save tworzy nowe).
  Wejścia: library long-press→menu (Duplikuj/Przypnij/Usuń) + ikona Copy w wierszu, okno presetu
  „Kopia", nagłówek recipe (Copy→router.replace dup).
- **Szukanie PO SKŁADNIKU:** `presetIngredientNames(p)` (z częściami composite) + `recipe.ingredients`
  → `ingHay`. W add.tsx (`libMatches`) i library.tsx filtr trafia po nazwie/kategorii LUB składniku
  (multi-słowo = wszystkie tokeny); przy trafieniu tylko po składniku pokazuje „zawiera X".
- **TODO (etapy):** przeniesienie EDYCJI wagi z Zdrowia (Krok B — jeden zapisujący),
  prognoza wagi z realnego jedzenia, jednoprzyciskowa PODMIANA sosu w daniu (dziś: pomiń + dodaj nowy).

## 9. Pupil (kot) — patrz memory [[pet_blob_design]]

- `components/pet/CatArt.tsx` (wektorowy kot, prezentacyjny — bierze `palette` prop, BEZ
  storu) + `CatTail.tsx` (ogon; prążki przez obrócony `<Pattern>`). `catPalettes.ts` —
  `DEFAULT_PALETTE` = niebieski (to samo co logo/splash). `petStore` (xp/coins/kolor/prążki),
  `petState.ts` (nastrój z danych), `quests.ts`, `petShop.ts`.
- **Sklep (`app/pet-shop.tsx`):** zamrożenie serii PRZYPIĘTE na górze; reszta w kategoriach
  (chipy Skrzynki/Kolory/Dodatki), kolory grupowane wg rzadkości. **Skrzynki (gacha)** =
  `petBoxes.ts` (`LOOT_BOXES` + `rollBox`): losują kolor (ważony rzadkością, tylko nieposiadane) /
  zamrożenie / monety; droższa = lepsze szanse. Odsłona `components/pet/BoxRevealModal.tsx`
  (❄ zamrożenia lecą z boków). Reużywa `spendCoins`/`buyItem(id,0)`/`addCoins`/`addFreezes` — bez zmian w petStore.
- **Ograniczenie RN:** animować tylko transformy wrappera `Animated.View` (native driver);
  animacja propów SVG stutteruje. RN nie ma transform-origin → piwot = translate→rotate→translate.
- **AnimatedSplash** używa CatArt (nie PNG) — te same ID/rozmiar co natywny splash, start
  na pełnej widoczności (bez fade-in), żeby statyczny obrazek płynnie „ożył".
- **Bossy — SZEŚĆ trybów walki (`?kind=campaign|raid|event|quest|mad|mission`), wszystkie
  przez `simulateFight` w `utils/bosses.ts`
  (round-based, prawdziwy kontratak, można przegrać):**
  - **Kampania** (`BOSSES` w `bosses.ts`, sekwencyjna, 22 bossów) i **wydarzenia**
    (`seasonalEvents.ts`, sezonowe/nemesis miesiąca) walczą na `app/boss-fight.tsx`
    (`?kind=campaign|event`), pełna animacja pocisk/łapa. **Raid** (`raid.ts`, tygodniowy)
    tam samo, ale HP to trwały bank na tydzień, nie resetuje się co próbę.
  - **Odliczanie do końca eventu** (2026-08-16, `eventEndsAt`/`eventDaysLeft` w
    `seasonalEvents.ts`) — user: "żeby realnie móc go wygrać" — walka eventowa ma FLAT
    1 próbę/dzień (`EVENT_DAILY_ATTEMPTS`), więc "ile dni zostało" to wprost "ile jeszcze
    podejść dostanę" zanim boss zniknie. `eventEndsAt` to per-id lustro okien z `isActive`
    (SEASONAL) — nie da się wyciągnąć granicy z samego predykatu true/false, więc każdy z
    6 sezonowych ma jawny koniec (Wielkanoc liczona z `easterSunday`+1 dzień). `menace`
    (nemesis miesiąca) nie ma stałego okna — jego koniec to koniec BIEŻĄCEGO miesiąca
    kalendarzowego. Pokazywane w `app/bosses.tsx` (mini-karta) i `boss-fight.tsx` (ekran
    walki), kolor eskaluje czerwono/żółto przy ≤1/≤3 dniach.
  - **Art rajdowych bossów (2026-08-15, dwie fazy)** — 6 bossów `raid.ts` startowały bez
    własnych rysunków. Faza 1: `bossIcons.ts` POŻYCZAŁ PNG z kampanii pod tymi samymi id +
    `BossArt` (`components/bosses/BossArt.tsx`) dostał `powered` prop — czerwona `RadialGlow`
    + powiększona czerwona sylwetka (`tintColor`) za obrazkiem, sticker-halo trick jak
    `StreakFlameGlow`, żeby nie wyglądały identycznie jak kampanijny odpowiednik. Faza 2
    (tego samego dnia): user dorysował WŁASNY dedykowany art dla 3 z nich — `golem`/`kraken`/
    `phantom` (plik `BOSS_UPIOR.png`) dostały prawdziwe pliki w `BOSS_PNG` (zamiast
    pożyczonych cyclops/cerberus/reaper), PLUS osobne `MADBOSS_*.png` dla ich "powered"
    wariantu (`POWERED_BOSS_PNG` w `bossIcons.ts`, `poweredBossPng(id)`) — `BossArt` sprawdza
    to NAJPIERW, i jeśli istnieje, renderuje dedykowany rysunek (z lekką czerwoną poświatą w
    tle) zamiast programowego tinta. `behemoth`/`wyrm`/`siren` wciąż pożyczają
    (behemoth/sugar dzielą `weakness` sweetless, wyrm/dragon to ten sam gatunek, siren/drought
    dzielą motyw wody) i nadal dostają programowy tint-fallback dopóki nie dostaną własnego
    artu — `POWERED_BOSS_PNG` to CELOWO osobna mapa od `mad_<id>` w `madBosses.ts` (dwa
    niepowiązane pojęcia "mad/powered": tam druga fala kampanii, tu wariant wizualny raidu).
    Włączone tam gdzie renderuje się raid: karta w `app/bosses.tsx`, portret walki i modal
    zwycięstwa w `boss-fight.tsx` (`kind==='raid'`/`victory.kind==='raid'`). Zero zmian w
    `raid.ts` — id/logika/nazwy bez zmian, to czysto wizualne.
  - **Questy-jako-walki** (2026-08-14 v2, `utils/minibosses.ts`) — CZWARTY tor, `?kind=quest`
    w `boss-fight.tsx` (pełna animacja, TA SAMA co kampania/wydarzenie — user chciał S&F-styl
    wszędzie). ⚠️ Pierwsza wersja (osobny ekran `app/minibosses.tsx`, tory woda/kroki, DODANA
    nad questami) była źle zrozumianym pomysłem — usunięta tego samego dnia. Poprawny kształt:
    **każdy** quest dzienny/bonusowy (`quests.ts` DAILY/BONUS) po wykonaniu pokazuje w
    `app/pet.tsx` przycisk **"Walcz"** zamiast zwykłego "Odbierz" — standardowe monety za te
    questy ZNIKNĘŁY, jedyna droga do nagrody to wygrana walka z minibossem PRZYPISANYM do
    tego questu na ten dzień (`minibossForQuest(date, questId)`, deterministyczne, roster
    8 zwierząt z `assets/minibosses/`, art dopisany do WSPÓLNEJ mapy `bossIcons.ts` — BossArt
    działa 1:1, bez osobnego komponentu, jak sezonowe wydarzenia). HP rośnie z poziomem
    (`questBossHpFor`); nagroda = bazowa stawka questu (już po `questRewardMult` w
    `quests.ts`) × `FIGHT_BONUS` (1.6×) — WIĘCEJ niż dawał zwykły claim. Rozliczenie na
    ekranie walki przez nową akcję `petStore.claimQuestFight(questId,...)` — MUSI pisać do
    `dailyClaims` (nie tylko `dayClaims`), bo `buildQuests()` czyta `dailyClaims[id]===today`
    żeby uznać quest za odebrany. Bez puli prób/energii — quest już wykonany realnie, retry
    po przegranej jest darmowy. Missed/catch-up questy (zaległe z wczoraj) ZOSTAJĄ instant-
    claimem w `pet.tsx` (`claimMissed`/`claimDailyFor`) — walka z minibossem losowanym na
    DZISIEJSZĄ datę za coś zrobionego wczoraj byłaby myląca. HP (`questBossHpFor`, fix
    2026-08-15) NIE jest osobną liniową krzywą — liczone jako `atkPower(level) × 4` (target
    4 ciosy), więc trudność skaluje się 1:1 z realną mocą ataku kotka na KAŻDYM poziomie
    (stara stała `50+level×5` rosła wolniej niż moc ataku, więc walki stawały się trywialne
    od ok. level 10 — user: "dają 1hp dmg... wale ich na 2 hity"); bez ryzyka endgame'owego
    przesunięcia jak w `raid.ts` (`raidHpFor`), bo obie strony formuły rosną z tym samym
    czynnikiem. **Fix #2 tego samego dnia** (user ponownie: "ja im ponad 100, oni mi ledwo
    1%") — `atkPower(level)` powyżej użyty był z ZEREM zamiast realnego `atkStatBonus`/
    `bonuses` gracza (te same argumenty, których używa jego faktyczny cios w
    `computeDamage`). Gracz z realną inwestycją (kupiony atkStatBonus, bonusy z łupu) zadawał
    znacznie więcej niż formuła zakładała, więc bossy padały w 1-2 ciosy niezależnie od
    docelowych 4. `questBossHpFor`/`minibossAsBoss` biorą teraz `atkStatBonus`/`bonuses` jak
    reszta walki — ten sam fix zastosowany od razu profilaktycznie do `madBossHpFor`/
    `madBossFor` (madBosses.ts), bo to identyczna formuła z identyczną luką, tylko jeszcze
    nie zgłoszona (MAD jest zbyt świeże, żeby user zdążył to zauważyć).
  - **MAD bossy** (2026-08-15, `utils/madBosses.ts`) — PIĄTY tor, `?kind=mad` w
    `boss-fight.tsx`. User: "trzeba przemyśleć hp bossów" → zamiast rozciągać jedną krzywą
    HP w nieskończoność (dokładnie problem raidu wyżej), druga fala TYCH SAMYCH 22 bossów
    kampanii jako trwały endgame cel. User explicite wybrał: zwykła kampania BEZ zmian
    (`unlockLevel` 2→116 zostaje), MAD to dodatkowa warstwa odblokowywana hurtem na
    **lvl 50** (`MAD_UNLOCK_LEVEL`) i TYLKO per-boss PO pokonaniu jego zwykłej wersji
    (`defeatedBosses.includes`) — nie da się przeskoczyć kampanii. Wybór "aktualnego" MAD
    celu (`madCandidate`) lustrzanie kopiuje `campaignBoss` (`BOSSES.find(b =>
    !defeated.includes(b.id))`) — jeden wspólny cel po `order`, osobna lista
    `defeatedMadBosses`/`defeatMadBoss` w `petStore.ts` (bez loot-regrantu — ten item już
    masz z pokonania zwykłej wersji). Art: POŻYCZONY z kampanii pod `mad_<id>` (prefiks
    ściągany w `bossPng`/`bossAttackFx`, nie duplikowane require()) + ta sama czerwona
    `powered` aura co raid.
    - **HP dynamiczne** (`madBossHpFor(level, order)` = `atkPower(level) × hits(order)`,
      hits 6→8 przez roster) — liczone z AKTUALNEGO poziomu gracza (jak `questBossHpFor`),
      nie zamrożone przy `unlockLevel` jak zwykła kampania — MAD nigdy nie robi się
      przestarzały niezależnie jak wysoko urośnie level (dokładnie unika pułapki raidu).
    - ⚠️ **Metodologiczna pułapka znaleziona throwaway-symulacją, warta zapamiętania na
      przyszłość**: pierwsza wersja celowała w 14-25 ciosów (start od góry zakresu kampanii,
      "dużo silniejsza") — symulacja pokazała że to matematycznie NIEWYGRYWALNE (0% win-rate)
      już od ok. 8-10 ciosów. Powód: `counterDamage()` liczy % od AKTUALNEGO hp bossa, hp
      bossa rośnie z `atkPower(level)`, ale pula HP kotka (`catMaxHp`) NIE rośnie automatycznie
      z levelem (tylko z zakupionym `catMaxHpBonus`) — skumulowany kontratak w całej walce
      rośnie z KWADRATEM liczby ciosów, nie liniowo. Bezpieczny zakres przy umiarkowanej
      inwestycji: ~6-8 ciosów (empirycznie, nie zgadywane). Druga pułapka: `guard`/`regenPct`
      (kilka bossów kampanii, np. wizard) NIE są dziedziczone przez `madBossFor` — odziedziczony
      `guard` (×0.5 dmg gracza) efektywnie PODWAJA ciosy potrzebne bez podwojenia hits-budżetu
      formuły, co samo w sobie zawyżało kontratak poza bezpieczny zakres dla tego jednego
      bossa. Każda przyszła zmiana formuły trudności bossów MUSI przejść przez tę samą
      throwaway-symulację (jak audyt 14.08/dzisiejsze fixy quest/raid) — papierowe zgadywanie
      liczby ciosów nie wystarcza, bo `counterDamage` nie skaluje się liniowo.
  - **Misja pupila** (2026-08-15, `utils/missions.ts`) — SZÓSTY tor, `?kind=mission` w
    `boss-fight.tsx`. User: "wyślij pupila na misję... idzie np 5h... można zawalczyć i
    zdobywa się trochę więcej xp i coinow jak za daily questa". Doprecyzowane: BEZ dziennego
    limitu (można wysłać kolejną od razu po odebraniu nagrody) — jedyny hamulec to sam czas
    trwania, który rośnie z levelem (`missionMinutesFor`: 10 min na lvl 1 → liniowo, ~5h przy
    lvl 50, twardy sufit 8h). Stan to JEDEN globalny slot w `petStore` (`missionStartedAt`/
    `missionEndsAt`, ISO timestampy) — czas trwania liczony RAZ przy wysyłce z ówczesnego
    poziomu (nie przelicza się ponownie, gdyby level wzrósł W TRAKCIE misji). Po upłynięciu
    czasu ekran Pupil pokazuje przycisk "Walcz" (`app/pet.tsx`, licznik tika co 30s żeby
    UI czuł się żywy bez ciągłego rerenderu) — walka to zwykły miniboss z rostera
    `MINIBOSSES` (minibosses.ts), ale WYBRANY po DOKŁADNYM znaczniku czasu wysłania
    (`minibossForMission`, nie po dacie jak questy — misje mogą lecieć kilka razy dziennie,
    data dałaby tego samego zwierzaka za każdym razem). Gotowość/tożsamość miniboss'a
    czytane wprost ze store'u w `boss-fight.tsx`, NIE z parametrów URL — nie da się "oszukać"
    walką przed czasem przez ręczną nawigację. Nagroda (`missionRewardFor`) skaluje się
    TYM SAMYM `questRewardMult` co reszta questów (jedno źródło prawdy dla ekonomii), baza
    wyraźnie wyższa niż typowy daily quest. **Powiadomienie push** przy zakończeniu misji
    (`notificationsService.scheduleMissionReady`, deep-link do `pet`) — ⚠️ `notificationsService`
    NIE jest importowany statycznie w `petStore.ts` (ciągnie `expo-notifications`, którego
    Jest nie parsuje z poziomu plików czysto-logicznych importowanych przez testy — dokładnie
    ten sam problem co `lucide-react-native` w `raid.ts`/`minibosses.ts`, ten sam fix: `require()`
    leniwie WEWNĄTRZ akcji `startMission`/`claimMission`, nie na górze pliku). Pasek postępu
    (2026-08-15, drugi tego dnia) w `app/pet.tsx` — elapsed/total liczone z `missionStartedAt`/
    `missionEndsAt`, capowane 0..1.
  - **Sesja treningowa self-report** (2026-08-15, `components/pet/TrainingSessionModal.tsx`)
    — pompki/przysiady/brzuszki/deska/rozciąganie (`b_pushups`/`b_squats`/`b_situps`/
    `b_plank`/`b_stretch` w `quests.ts`) nie mają czujnika (rower ma, przez Health Connect).
    Dawniej jedno tapnięcie "Zrobione"; teraz przycisk **"Rozpocznij"** w `pet.tsx` otwiera
    modal: dla deski/rozciągania realny ODLICZANY timer (`setInterval`, jak `pomodoroStore`)
    od celu z `personalQuests.ts` (`plankSeconds`/`stretchMinutes`), dla pompek/przysiadów/
    brzuszków ekran z docelową liczbą powtórzeń + przycisk "UKOŃCZYŁEM" (bez czujnika liczyć
    się nie da). Po ukończeniu woła to samo `mark*Done` z `petStore` co wcześniej — quest
    staje się `done`, dalej idzie przez tor "Questy-jako-walki" wyżej (przycisk "Walcz").
  - **`petStore.bossLog`** (2026-08-14) — historia KAŻDEJ pokonanej walki (wszystkich 4
    torów wyżej), do eksportu/balance-testowania: `utils/bossProgressReport.ts` buduje
    czytelny tekstowy raport (poziom/staty/pokonani bossowie/log), Ustawienia →
    Diagnostyka → „Eksportuj postęp pupila" (`Share.share`) / „Zresetuj postęp pupila"
    (`petStore.reset()`, wcześniej martwa funkcja, teraz podpięta).

## 10. Inne subsystemy (entry files)

- **Payday/bills/debts**: `utils/payday.ts` (okno `PAYDAY_WINDOW_DAYS`), `recurringBills.ts`,
  `debtsService.ts`; prompty jako AUTO_SECTIONS na dashboardzie. Powiadomienie payday w
  `notificationsService.refreshPaydayReminder` (nudguje tylko w oknie, potem następny miesiąc).
- **Backup**: `backupService.ts` — chunkowane snapshoty do Firestore + restore z Ustawień
  (reinstall-proof po zalogowaniu Google).
- **Wrapped/kolekcje**: `monthCards.ts`/`yearCards.ts` + `MonthWrappedCard`/`YearWrappedCard`
  (BEZ emotek — „wyglądało tanio"). `YearPixels` = rok w pikselach (viz `pixels`).
- **Nawyki/liczniki**: `utils/habits.ts` + `useHabits`, `countersStore` (dni bez / odliczania).
  `app/habit-year.tsx` = jeden ekran pixeli dla NAWYKU (`?id=`) **i** LICZNIKA (`?counter=`):
  MIESIĄC = kalendarz (Pn..Nd + numery dni), ROK = rolka GitHub. Nawyk: done=kolor nawyku,
  frozen=ICE; licznik „bez X": dzień czysto=zielony, wpadka (kupiłeś)=czerwony (z paragonów przez
  `matchesAvoid`). Seria licznika liczona OD DZIŚ; nawyku jak `getStreak` (od wczoraj gdy dziś
  jeszcze nie zrobione). Wejścia: kafle „Twoje serie" (dashboard) + ikona siatki w `/counters`.
- **Powiadomienia**: `notificationsService.ts` — master `notif_enabled` + per-typ flagi;
  deep-linki obsługiwane w `_layout.tsx`.
- **Ustawienia (`app/settings.tsx`)**: data-driven, nie flat JSX. Typy `SettingsSectionDef`/
  `SettingsItem` w `src/types/settings.ts`; generyczny render `SettingsRow`/`SettingsSectionView`
  w `src/components/settings/`; wyszukiwarka (pasek + AND-match po słowach kluczowych,
  diakrytyki-insensitive) w `src/utils/settingsSearch.ts` (`normalizeSearch`/`filterSections`,
  testy w `__tests__/settingsSearch.test.ts`). Każdy wiersz ma `title`/`subtitle`/`keywords` w
  JEDNYM miejscu (manifest w `settings.tsx`) — to jest zamierzony punkt pod przyszłe języki:
  string do zmiany żyje w jednym polu, nie trzeba go szukać w JSX. `BackupSection` jest
  wyjątkiem — zawsze widoczna, nie przechodzi przez filtr wyszukiwania (ma własny nagłówek).

## 11. Pułapki, które psują build (CZYTAJ ZANIM COŚ ZMIENISZ)

- **`app.json` `android.permissions` ZASTĘPUJE domyślne Expo.** Brak uprawnienia = cichy
  no-op (ugryzło nas VIBRATE + READ_HYDRATION). Dodając funkcję wymagającą uprawnienia —
  dopisz je tu.
- **Ikona/splash/uprawnienia/plugins = NATYWNE** — wchodzą tylko przez NOWY build APK,
  nie przez OTA update. Logika JS wchodzi OTA.
- **`freezeOnBlur`** → ekrany nie odświeżają się w tle; dane załadowane gdzie indziej są
  nieświeże po powrocie → dodaj cichy `useFocusEffect` refetch (wzór jest w stats/finances).
- **RN nie ma transform-origin** — piwot przez translate/rotate/translate; przelicz
  współrzędne przez `unit = size/2000` (nie zgaduj „reference size").
- **Commit message w bashu:** backticki w `-m "..."` odpalają się jako komenda i znikają.
  Używaj heredoc `git commit -F - <<'EOF'`.
- **String w single-quote (`'...'`) w TS:** apostrof w treści (np. `Can't`) łamie plik —
  escape `\'` albo unikaj.
- Push może wisieć na Git Credential Manager (brak tokenu) — puszczaj w tle; zwykle
  dochodzi. Nigdy nie commituj tego samego snapshotu z nieświeżych danych.

## 12. Playbooki — „jak dodać X" (rób wg wzorca, bez dead-endów)

**Nowa sekcja dashboardu** (patrz jak zrobiono `price-watch`/`year-ago`):
1. `dashboardLayout.ts`: dodaj id do `DEFAULT_DASHBOARD_SECTIONS`, `SECTION_TITLES`,
   `SECTION_DESC`, `SECTION_GROUP`.
2. `index.tsx`: policz dane w `useMemo` (czyta snapshot `expenses`, `moodByDay`,
   `healthDays`, `scope` — wszystko już w scope). Ustaw `nodes['id'] = warunek && (<View
   style={[s.card,{backgroundColor:cardBgDark}]}>…</View>)`. Style w `themedStyles`.
3. Renderuje się sama (pętla `nodes[id]`), pojawia w edytorze, `effectiveOrder` wstawia ją
   istniejącym użytkownikom. Node = `false` gdy brak danych → sekcja się chowa.

**Nowa metryka customowa**: dopisz do `WIDGET_METRICS` (statWidgets.ts) + obsłuż jej `id`
w `bucketValue`/`metricList`. Wtedy działa w kreatorze i we wszystkich viz.

**Nowy store**: `src/store/xxx.ts` (Zustand + persist AsyncStorage). Jeśli dane mają
przetrwać reinstall — dopisz do backupu (`backupService.ts` CLOUD_COLS / local snapshot).

**Nowy serwis Firestore**: wzór z `expensesService.ts` — ZAWSZE `strip()` undefined przed
zapisem; dopisz kolekcję do backupu.

**Zasada „bez dead-endów":** rozszerzając funkcję, podłącz ją WSZĘDZIE, gdzie pasuje
(lista, statystyki, filtry, edycja, dashboard, powiadomienia, backup) — nie zostawiaj
połowicznie podpiętej.

**Nowa pozycja/sekcja w Ustawieniach** (`app/settings.tsx`) — NIE dopisuj gołego JSX:
1. Prosty wiersz (switch/text/link/wartość) → dodaj obiekt `SettingsItem` do `items[]`
   właściwej sekcji: `title`, opcjonalnie `subtitle`/`icon`/`accentColor`, `keywords`
   (synonimy po polsku, żeby wyszukiwarka trafiała), `control` (`switch`/`text`/`link`/`value`).
2. Coś bardziej złożonego (lista, kreator, box diagnostyczny) → `control: { kind: 'custom',
   render: () => (...) }` z własnym JSX (korzysta z `styles`/`colors` z domknięcia) — nadal
   wymaga `title`+`keywords`, żeby wyszukiwarka go znalazła, mimo że nie renderuje ich sama.
3. Nowa sekcja → dopisz wpis do tablicy `sections` (id/title/icon/color/keywords/items) —
   pojawi się automatycznie w liście i w wyszukiwarce, nic więcej nie trzeba podpinać.

---

*Powiązane notatki (prywatna pamięć asystenta): codebase_map, project_sapp,
dashboard_nav_internals, bank_auto_expenses, pet_blob_design, perf_stylesheets,
theme_system, consumption_scope.*

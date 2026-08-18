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
  - **Odliczanie do końca eventu — TYLKO sezonowe od 2026-08-18** (2026-08-16, `eventEndsAt`/
    `eventDaysLeft` w `seasonalEvents.ts`) — user: "żeby realnie móc go wygrać" — walka
    eventowa ma co najmniej 1 próbę/dzień (patrz `eventDailyAttempts` niżej), więc "ile dni
    zostało" to DOLNA GRANICA "ile jeszcze podejść dostanę" zanim boss zniknie (realnie może
    być więcej, patrz osobna pula energii poniżej). `eventEndsAt` to per-id lustro okien z
    `isActive` (SEASONAL) — nie da się wyciągnąć granicy z samego predykatu true/false, więc
    każdy z 6 sezonowych ma jawny koniec (Wielkanoc liczona z `easterSunday`+1 dzień). UWAGA
    (2026-08-18) — `menace` (nemesis) stracił timer CAŁKOWICIE (patrz osobny, duży wpis niżej
    przy "Nemesis... przebudowany na TRWAŁY bank HP") — `eventEndsAt`/`eventDaysLeft` dla
    `kind='menace'` WCIĄŻ liczy koniec-miesiąca (funkcja nietknięta, testy ją pilnują), ale UI
    (`bosses.tsx`/`boss-fight.tsx`) już jej nie woła dla menace, tylko dla sezonowych — martwy
    kod z punktu widzenia nemesis, zachowany bo nieszkodliwy i test go dokumentuje.
  - **Druga, osobna pula energii na bossy eventowe** (2026-08-17, `eventDailyAttempts` w
    `bosses.ts`) — user: "jak mam energię na bossy to energia na bossy, a mam drugą inną
    energię łącznie na bossy eventowe" — wcześniej event miał FLAT `EVENT_DAILY_ATTEMPTS=1`
    niezależnie od `energyMult` z łupu kampanii, co znaczyło że leftover inwestycja w energię
    (kampania/raid już skalują się z `dailyAttempts`) była bezużyteczna DOKŁADNIE tam, gdzie
    twardy termin eventu (patrz wyżej) najbardziej by się przydał. `eventDailyAttempts(mult)
    = min(EVENT_MAX_DAILY_ATTEMPTS=3, 1 + round(mult×2))` — skaluje się WYRAŹNIE słabiej niż
    `dailyAttempts` (kampania, `round(3×(1+mult))`) i ma twardy cap na 3, żeby event zostawał
    rzadszy niż kampania nawet przy maksymalnej inwestycji (przy obecnym maksymalnym sumie
    `energyMult` z całego łupu kampanii ~0.75, kampania daje 5 prób, event capuje na 3) —
    inwestycja się liczy, ale event się nie trywializuje. Pule dalej NIEZALEŻNE (`eventEnergy`
    w `petStore.ts`, osobny od `energy`/`raidEnergy`) — zmieniła się tylko formuła dziennego
    top-upu w `reload()` (`app/bosses.tsx`), zero zmian w mechanice samej walki/HP.
  - **Trudność kampanii podbita + fix realnego bugu z `guard`** (2026-08-17, user: "walki są
    zbyt łatwe") — throwaway-symulacją (ta sama dyscyplina co przy MAD/quest wcześniej, profil
    "lekkiej" stopniowej inwestycji rosnącej z `order`) znaleziono, że `guard` (Twój cios ×0.5)
    w połączeniu z `counterDamage()` liczonym od AKTUALNEGO hp bossa **podwaja** skumulowany
    kontratak wobec bossa bez guard o tym samym hp — boss #22 (FINAŁ KAMPANII, Iluzja
    Kontroli) był w praktyce niewygrywalny nawet przy realistycznej inwestycji, nie tylko
    "za łatwy". `counterDamage(hp, dodge, guard?)` tnie teraz kontratak o połowę gdy `guard`
    aktywny — przywraca parytet z bossami bez guard przy tym samym hp/docelowej liczbie
    ciosów. NIEZALEŻNIE: docelowa liczba ciosów dla bossów #1-13 (Lv2-46) podbita z 6→10.6 do
    9→12 (nowe `hp` w `BOSSES`) — w symulacji nadal 100% winrate przy lekkiej inwestycji, ale
    wyraźnie dłuższe walki. Bossy #14-22 (Lv52-116, "elite") ŚWIADOMIE NIETKNIĘTE — audyt
    14.08 ("Balans ekonomii vs bossy" w NEXT_STEPS.md) już wcześniej znalazł że ten zakres jest
    szczególnie wrażliwy na rozjazd między prostym modelem inwestycji a REALNYM tempem
    ekonomii gracza; dalsze podbijanie bez pełnego audytu ryzykowałoby powtórzenie DOKŁADNIE
    tego samego "6 z 22 bossów praktycznie nieosiągalnych" problemu, już raz naprawionego
    (wtedy stroną ekonomii). Odłożone do osobnego, pełnego audytu.
  - **Odblokowanie kampanii = tylko pokonanie poprzedniego, NIE poziom** (2026-08-17, user
    testował świeżo podbitą trudność wyżej: "musimy dać że odblokowanie jest po pokonaniu
    wcześniejszego... ciężko jest za dużo muszę xp żeby sprawdzić nawet inne bossy") —
    `unlockLevel` na każdym Boss był DODATKOWYM progiem ponad kolejność, mimo że kolejność
    (`BOSSES.find(b => !defeatedBosses.includes(b.id))`) i tak już wymusza sekwencję —
    poziom nic ekstra nie chronił poza spowolnieniem, nie dawał się realnie ominąć/oszukać
    (żeby dojść do późnego bossa trzeba i tak pokonać wszystkich wcześniejszych, a atak gracza
    i tak skaluje się z REALNYM poziomem via `atkMultiplier`, więc niski poziom przeciw
    późnemu bossowi po prostu przegrywa, nie "cheesuje"). Usunięte w dwóch miejscach: `app/
    bosses.tsx` (`unlocked = !!current`, hero card WALCZ! bezwarunkowe gdy jest `current`;
    lista kampanii: `lock` = "nie pokonany i nie current", tekst "Pokonaj poprzednich" zamiast
    numeru poziomu) i `app/boss-fight.tsx` (`target.unlocked: true` dla `kind==='campaign'`,
    ten sam ekran liczy `campaignBoss` niezależnie od bosses.tsx, więc wymagał osobnego fixu).
    `unlockLevel` ZOSTAJE w danych `Boss` (referencyjny poziom pod jaki historycznie wyważono
    hp/atak tego bossa, `madBossFor` go też czyta) — przestał być tylko BRAMKĄ dostępu. Raid
    (`level>=3`)/event (`level>=2`)/MAD (`level>=MAD_UNLOCK_LEVEL`, 50→15 od 2026-08-18) CELOWO nietknięte —
    to osobne, deliberatne progi niezwiązane z sekwencją "pokonaj poprzedniego", user pytał
    konkretnie o kampanię.
    - **Fix eksportu** (`utils/bossProgressReport.ts`, ten sam dzień, user: "zebrać dane pod
      eksport... oparte na poziomie ulepszenia") — status-ikona listy bossów w raporcie
      ("Eksportuj postęp pupila", Ustawienia → Diagnostyka) ciągle liczyła 🔒 z `lvl.level >=
      b.unlockLevel`, czyli obiecywała próg, który właśnie zniknął z UI. Nowe stany: `✓`
      pokonany, `▶` aktualny cel (`BOSSES.find(b => !defeatedSet.has(b.id))`), `·` reszta.
      PRZY OKAZJI każdy wiersz dostał `~N ciosów przy Twoich statach` — `Math.ceil(b.hp /
      (power × (guard?0.5:1)))` z REALNYM `atkStatBonus`/`bonuses` gracza (ten sam `power` już
      liczony wyżej w raporcie dla linii ATK), nie goły `b.hp`. To dokładnie liczba, którą do
      tej pory liczyłem ręcznie throwaway-symulacjami przy każdej zmianie balansu — teraz
      wychodzi wprost z eksportu, bez pytania o dodatkowe dane.
    - **Numer rundy testowej** (ten sam dzień, user: "niech reset pupila tworzy nowy log
      danych żeby było wiadomo które od czego") — `petStore.reset()` czyści `bossLog`/staty
      do zera (dosłownie nowy, pusty log), ale nowe pola `resetGeneration`/`lastResetAt`
      ROSNĄ z każdym resetem zamiast wracać do 1 — CELOWO POZA `reset()`-em i POZA
      partialize-usuwaniem (to metadane O resetach, muszą przetrwać sam reset, żeby liczyć).
      `bossProgressReport.ts` pokazuje je w nagłówku: `Runda testowa: #3 (ostatni reset:
      ...)`. Efekt: dwa eksporty po dwóch różnych resetach, wcześniej nierozróżnialne
      ("Poziom 1, log pusty" za każdym razem), teraz jednoznacznie oznaczone numerem — można
      wkleić kilka kolejnych rund testowych do rozmowy i wiadomo która jest która.
  - **Unikatowe ataki bossów wg typu** (2026-08-17, user: "planuję żeby bossy miały unikatowe
    ataki — drapieżniki drapnięcie pazurami, magowie kulę magiczną, miecze slash mieczem, ci
    którzy nie mają to pięść") — nowy opcjonalny `attackKind?: 'claw'|'magic'|'sword'` na
    `Boss` (`bosses.ts`) + lustrzane pole na `Raid` (`raid.ts`), `EventBoss`
    (`seasonalEvents.ts`) i `MiniBoss` (`minibosses.ts`) — `undefined` = fallback pięść
    (`HandFist`, bez zmian dla większości rosteru). Przypisania DERYWOWANE wprost z istniejącej
    konwencji nazw plików w `bossIcons.ts` (`BOSS_<atak>_<nazwa>.png` — sam user tak je
    nazwał) — tylko bossy z jednoznacznym pazur/magia/miecz atakiem w nazwie pliku dostają
    wpis (kampania: sloth/doubt/jaguar/dinosaur=claw, compare/procrast/wizard=magic,
    samurai/piratecapitan=sword; raid: kraken=claw, phantom=magic; event: wiosna/jesień/
    zima/overtime=magic (mitologiczne boginie/widmo), sweettooth=claw (demon); minibossy:
    tylko harpia=claw). `minibossAsBoss`/`eventAsBoss` (budują `Boss` z `MiniBoss`/`EventBoss`
    ręcznie, nie przez spread) dostały jawne przekazanie `attackKind` — `madBossFor` dostaje
    je AUTOMATYCZNIE (spreaduje `...boss` z kampanii). W `boss-fight.tsx`: `Target` niesie
    `attackKind`, kontratak (`boltFlying` pocisk) wybiera ikonę/kolor z małej mapy
    (`HandGrab`/czerwony=claw, `Sparkles`/fioletowy=magic, `Sword`/szary=sword, `HandFist`/
    czerwony=fallback) zamiast zawsze tej samej pięści — sam mechanizm lotu/animacji BEZ
    zmian, tylko dobór ikony.
    - **Fix pazurów** (ten sam dzień, user: "jak są pazury to nie mają lecieć tylko pojawiać
      się na pupila") — pazury NIE dostają latającego pocisku wcale (jedyny wyjątek z 3
      kategorii) — zamiast tego `s.clawFx` (`HandGrab`, ten sam trigger `boltFlying`/
      `boltOp`/`boltScale`) błyska bezpośrednio NA portrecie kotka, mirror `attackFx` (burst
      na bossie przy Twoim ciosie), tylko po drugiej stronie areny. Magia/miecz/pięść nadal
      lecą jak wcześniej.
  - **Raid dostał pełną rundową walkę** (2026-08-17, user: "ten eventowy [na pozycji raidu —
    patrz niżej] jakby kafelek jest zbudowany a nie zwykła walka... miała być zwykła tylko
    taka która nie restartuje jego HP jak z tym drugim [event]") — raid był JEDYNYM trybem bez
    pełnej animacji: `attackSimple()` w `boss-fight.tsx` robił jedną wymianę ciosów na próbę
    (kliknięcie → wynik), nie prawdziwą wielorundową walkę jak kampania/event. USUNIĘTA,
    scalona w `attackRoundBased()` (teraz WSZYSTKIE 6 trybów przez jedną wspólną funkcję).
    Kluczowy problem do rozwiązania: `raidHpFor` (prawdziwa, trwała pula na cały tydzień) jest
    z założenia OGROMNA — podać ją bezpośrednio jako `boss.hp` do `simulateFight` zabiłoby
    kotka jednym kontratakiem (`counterDamage()` liczy % od AKTUALNEGO hp bossa). Rozwiązanie:
    `raidSessionHpFor(atkStatBonus, level, bonuses)` w `raid.ts` — DOKŁADNIE ten sam,
    zwalidowany wzorzec co `questBossHpFor`/`madBossHpFor` (`atkPower × mała stała`,
    `RAID_SESSION_HITS=6`) — każda próba to osobna, bezpiecznie skalowana "sesja" wobec
    `raidAsBoss(raid, sessionHp)`, NIE wobec surowej tygodniowej puli. Realny postęp sesji
    (`sessionHp - result.bossHpLeft`) dopisuje się do PRAWDZIWEJ, trwałej puli JEDNYM
    wywołaniem `raidAttack()` po zakończeniu sesji (nie per rundę — dalej dokładnie 1
    raidEnergy = 1 próba, jak reszta trybów). `targetRemaining`/pasek HP w arenie ZAWSZE
    pokazuje prawdziwą skalę tygodniową (nie sesyjną) — `liveBossHp` podczas animacji jest
    przeliczany z sesyjnej skali na prawdziwą (`raidRealStart - (raidSessionHp -
    round.bossHpAfter)`). Raid dalej BEZ stanu porażki (user o to nie prosił) — `finish()`
    dla `kind==='raid'` całkowicie ignoruje `result.won`/`result.catFainted`, liczy się TYLKO
    czy `raidAttack()` zwróci `defeated:true` (prawdziwa pula = 0). Throwaway-symulacją
    (`__tests__/raid.test.ts`) zweryfikowane: sesja bezpieczna (kontratak sesji nigdy nie
    zabija w 1 rundzie, kontrastowo surowa pula na wyższych poziomach BY zabiła — to dowód że
    fix jest potrzebny, nie kosmetyczny), zawsze robi realny postęp. UWAGA: kotek MOŻE
    zemdleć w środku pojedynczej sesji przy pechu (wariancja) — to NIE bug, po prostu ta próba
    dobija mniej HP, spróbuj ponownie następnym razem (energia i tak już zużyta, jak przy
    każdym innym trybie).
  - **Kampania: gate "1 nowy boss dziennie" — WPROWADZONY 2026-08-17, ZASTĄPIONY 2026-08-18**
    (patrz "Energia kampanii/MAD — regeneracja w czasie" niżej dla aktualnego mechanizmu) —
    user przysłał pełny eksport z czystego resetu (3/3 bossów w ~4 minuty, "zdecydowanie za
    szybko to poszło") i pierwotny fix był sztywną ścianą: `lastCampaignDefeatDate` w
    `petStore.ts`, blokująca przejście do KOLEJNEGO bossa do następnego dnia po każdym
    zwycięstwie. Dzień później user doprecyzował root cause ("uznałem wtedy że szybko poszło
    bo bossy zaczynałem od resetu i od razu pokonałem wszystkie z samych nagród bez
    jakichkolwiek wymagań") i wolał inny mechanizm: "wolałem zamiast jeden dziennie raz na 3h
    atak może? i maksymalnie regeneruje się do 2 energii" — sztywna ściana "wróć jutro"
    zastąpiona organiczną regeneracją energii w czasie (ten sam efekt: nie da się zblitzować
    kampanii w jednej sesji, ale bez arbitralnego dziennego resetu). `lastCampaignDefeatDate`/
    `campaignDailyCapped`/`dailyCapped` na `Target` CAŁKOWICIE usunięte z kodu.
  - **Fix: podwójne stuknięcie WALCZ! odpalało dwie równoległe walki naraz** (2026-08-17,
    znalezione dzięki świeżo dodanemu przebiegowi runda-po-rundzie wyżej — user opisał
    "kotek nie schodzi do zera HP... czasami walka przerywa zanim jedna ze stron zejdzie do
    zera... boss ma mało HP [i wygląda jakby] pomija rundę") — `attackRoundBased()`
    (`boss-fight.tsx`) gate'ował się TYLKO stanem `fighting`, czytanym z domknięcia
    POPRZEDNIEGO renderu. Przycisk WALCZ! wizualnie gasł (`opacity` przy `fighting`), ale
    `PressableScale` NIE dostawał `disabled` — Pressable dalej realnie odpalał `onPress`.
    Szybkie podwójne stuknięcie (zanim React zdąży przerenderować z `fighting=true`)
    odpalało DWA niezależne łańcuchy `setTimeout` (`playerBeat`/`counterBeat`) naraz, każdy
    ze swoim `result`/lokalnym `i`, oba manipulujące tym samym, współdzielonym
    `catHp`/`liveBossHp` w `petStore` — stąd pozorne "pomijanie" rund (dwa `counterBeat`
    przeplatające się), HP kotka nie lądujące dokładnie na 0 (dwa RÓŻNE `result` obiekty, nie
    jeden spójny przebieg), i jedna z walk "kończąca się" wcześniej (drugi, niewidoczny
    łańcuch dogrywał się w tle po tym jak pierwszy `finish()` już zresetował `fighting`/
    `liveBossHp`). Fix, DWIE warstwy: `fightingRef` (`useRef`, sprawdzany/ustawiany
    SYNCHRONICZNIE w tej samej funkcji, więc odporny na timing renderu — żadne dwa
    wywołania `attackRoundBased()` nie mogą przejść guardu naraz niezależnie od tego kiedy
    React skomituje `fighting`) jako właściwy fix race'u, plus `disabled={target.energy<=0
    || fighting}` na `PressableScale` (Pressable przestaje w ogóle odpalać `onPress`) jako
    druga warstwa UX. NIEsprawdzone na urządzeniu — czysto statyczna analiza kodu (nie dało
    się namierzyć przez symulację jak balans, to timing/race, nie matematyka walki).
  - **Skrzynka dnia przeniesiona do headera jako kwadratowy przycisk** (2026-08-18, user:
    "skrzynka daily powinna być jako square button przy overlayu bo ona ginie w tych
    taskach") — była pełnoszerokościowym wierszem w `app/pet.tsx` MIĘDZY questami
    (treningi/samoraport), więc wyglądała jak kolejny task do przewinięcia, nie osobna
    rzecz. Przeniesiona do `s.header` (pasek NAD `ScrollView`, zawsze widoczny, nie trzeba
    scrollować) jako 40×40 kwadratowy `dailyBoxIconBtn` obok `coinPill`, renderowany TYLKO
    gdy `dailyBoxReady` (po odebraniu znika całkiem — żaden wygaszony przycisk nie zaśmieca
    headera resztę dnia, inaczej niż poprzedni wariant który zostawał widoczny jako "Skrzynka
    odebrana — wróć jutro"). Mała czerwona kropka-`dailyBoxDot` w rogu (dawniej inline obok
    tekstu, teraz `position:'absolute'` badge) sygnalizuje że jest coś do odebrania. Logika
    (`onDailyBox`/`claimDailyBox`/dedup po `dayClaims['dailybox:'+dzień]`) bez zmian — to
    czysto przeniesienie UI.
  - **`bossAttackFx`/`BOSS_ATTACK_FX` USUNIĘTE permanentnie** (2026-08-18, user: "te
    bomby/pociski hujowe pojawiały się tylko na sobie samym, robiły scaling up i znikały,
    zadając dmg na odległość dziwnie xd, wywalmy je wgle zamieńmy ten atak wgle i usuń plik
    ten permanentnie") — `src/utils/bossAttackFx.ts` (mapa `Boss.id → burst PNG z
    assets/ikonybosów/BOSSATTACK_*`, 22 wpisy, po jednym na każdego bossa kampanii)
    USUNIĘTY plikiem, razem z całym jego użyciem w `boss-fight.tsx`: import, `attackFx`/
    `fxScale` (interpolacja z `bPop`), sam `bPop` `Animated.Value` (był używany WYŁĄCZNIE
    pod `fxScale`, nic innego go nie czytało — usunięty też z `playBossHitFx`), JSX-block
    renderujący `<Image source={attackFx}>` na kaflu bossa, i style `attackFx`. User
    dokładnie zdiagnozował problem porównując dwa DZIAŁAJĄCE wzorce animacji z tym
    zepsutym: podróżujący pocisk (łapka kota / kontratak magia — "wygląda i działa
    dobrze") i burst-na-celu (pazury — "wyglądały i działały dobrze"), kontra statyczny
    scale+fade w miejscu (bomby sugar) — "jakby animacja skanowania i znikania i tyle".
    Efekt usunięcia: "Twój cios ląduje na bossie" wygląda teraz TAK SAMO we WSZYSTKICH 6
    trybach (flash + shake + liczba obrażeń) — kampania traci per-bossowy akcent, ale
    zyskuje spójność z raid/event/quest/mad/misją, które nigdy nie miały `attackFx` (ich
    `bossAttackFx(id)` zawsze zwracał `undefined` — mapa miała wpisy tylko dla 22 id
    kampanii). `assets/ikonybosów/BOSSATTACK_*.png` (same pliki graficzne) NIE usunięte —
    user prosił o usunięcie PLIKU KODU (`ten plik`, liczba pojedyncza), nie assetów;
    zostają osierocone na dysku, do ewentualnego sprzątnięcia osobno jeśli kiedyś okaże się
    że nic ich więcej nie używa. NIEsprawdzone na urządzeniu.
  - **Osłabianie bossów realnymi seriami USUNIĘTE** (2026-08-18, user: "wywalić chyba musimy
    osłabienia bossów na nawyki itp, bo problemem jest to że wtedy bardzo ciężko balansować
    je będzie za dużo zmiennych") — mechanika z 2026-08-13 (`src/utils/bossWeakness.ts`,
    `computeWeaknessStreaks`/`weaknessHpFactor`/`weakenBoss`, -1%/dzień realnej serii samo-
    opieki w kategorii słabości bossa, max -35%) dodawała TRZECI wymiar do balansu (obok
    poziomu i łupu) — throwaway-symulacje przez całą tę sesję już i tak z trudem ogarniały
    dwa wymiary (patrz "Balans ekonomii vs bossy" niżej), trzeci realno-życiowy (nieznany z
    góry, różny per gracz) czynił pełną symulację praktycznie niemożliwą. `bossWeakness.ts` +
    `__tests__/bossWeakness.test.ts` USUNIĘTE plikami. `boss-fight.tsx`: `campaignBoss`/
    `raidMaxHp`/`eventMaxHp`/`madBoss`/`roundBoss` (event branch w `attackRoundBased`) nie
    przechodzą już przez `weakenBoss()` — surowe hp z `bosses.ts`/`raid.ts`/`seasonalEvents.ts`/
    `madBosses.ts` bez modyfikacji. Usunięte też: `weaknessStreaks` `useMemo` i WSZYSTKIE hooki
    które istniały WYŁĄCZNIE po to by je zasilić (`useMoodStore`, `useHabits`, lokalny
    `sleepHealthDays`/`getHealthHistory` efekt) — `useExpensesStore` ZOSTAJE (nadal potrzebny
    dla `sweetsByMonth` w wyzwalaniu wydarzeń, osobny system). UI-notka "Osłabiony: X dni serii
    → -Y% HP bossa" (`targetWeaknessStreak`/`targetWeakenFactor`) zniknęła całkiem. `weakness`/
    `weaknessLabel` na `Boss`/`Raid`/`EventBoss` ZOSTAJĄ jako pole — teraz PURE flavor (kolor
    aury, etykieta "Motyw: X"), zero efektu mechanicznego; `WeaknessKey` w `bosses.ts` też
    zostaje, tylko komentarz nad nim zaktualizowany. NIEsprawdzone na urządzeniu.
  - **Bossy dalej w kolejności = mystery (portret-sylwetka + placeholder nazwa)** (2026-08-18,
    user: "musimy zrobić że mają znaki zapytania i ciemne kształty... a ich nazwy to jakieś
    mityczne znaki, że nie wiadomo o co chodzi... dopóki nie pokonasz wcześniejszego") — lista
    kampanii (`app/bosses.tsx`) dotąd pokazywała PRAWDZIWY portret+nazwę+emoji dla KAŻDEGO
    bossa niezależnie od `lock` (tylko HP/temat/próg były ukryte pod "Pokonaj poprzednich").
    Teraz `lock` (jeszcze nie `current`, nie pokonany) dostaje pełny mystery-treatment:
    `BossArt` (`components/bosses/BossArt.tsx`) — nowy prop `mystery?: boolean` — renderuje
    PRAWDZIWY png bossa z `tintColor: '#000000'` (ta sama technika `Image` tint co istniejący
    `powered`-aura silhouette-trick, więc kod się nie duplikuje) zamiast normalnego obrazka:
    rozpoznawalny KSZTAŁT sylwetki (każdy boss ma inny), ale bez koloru/detalu — "coś tu jest",
    nie "kto to". Emoji-fallback (gdyby jakiś boss go nie miał) dostaje analogiczne czarne
    kółko. Nazwa: `mysteryBossName(id)` (`bosses.ts`) — deterministyczny (hash po `id`, SAM
    wzorzec co `raidForWeek` w `raid.ts`) 3-znakowy placeholder z puli gotowych Unicode symboli
    (`✦✧☽☾⚝✵⟁⌬⚚✴⛧❖◈⚶` — bloki Misc Symbols/Dingbats/Alchemical, szeroko wspierane na
    Androidzie BEZ ładowania własnej czcionki) — user zaproponował "pobrać czcionkę ze
    specjalnymi znakami", ale to nowy asset+licencja+expo-font setup dla czysto kosmetycznego
    efektu, który gotowy Unicode już daje. Ten sam boss zawsze pokazuje TEN SAM placeholder
    (nie miga losowo między odświeżeniami). Hero card ("current" boss, gotowy do walki) i
    ekran walki (`boss-fight.tsx`, zawsze pokazuje TYLKO `current`) bez zmian — user
    potwierdził że tam już działało dobrze.
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
    - **Fix 2026-08-16** (audyt "ogarnij bossy do końca"): modal PRZEGRANEJ w `boss-fight.tsx`
      przekazywał `powered={kind==='mad'}` — bez `kind==='raid'`, jedyne miejsce z tą luką
      (tile walki i modal zwycięstwa już miały oba). Rajdowy boss tracił czerwoną aurę
      dokładnie na ekranie przegranej. Naprawione (`powered={kind==='raid'||kind==='mad'}`).
      Sprawdzone WSZYSTKIE call site'y `BossArt` w repo (tylko `bosses.tsx`/`boss-fight.tsx`,
      6 wystąpień) — reszta poprawna. `behemoth`/`wyrm`/`siren` (raid) i Zły Mikołaj/
      Czekoladowy Zajączek/Widmo Nadgodzin/Demon Słodyczy (event) DALEJ czekają na własny
      art — to nie coś do naprawienia kodem, blokuje na nowych plikach PNG od usera.
    - **Łapka koloru kotka** (2026-08-16, user: "kotek w walkach niech rzuca swoją łapką
      zależną od koloru") — pocisk `PawPrint` w `boss-fight.tsx` miał na sztywno wpisany
      różowy `#F4A6A6` niezależnie od `catColor`. Teraz `color/fill={palette.coat}` (ta sama
      `palette = paletteById(catColor)` co portret kota na tym samym ekranie).
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
    **lvl 15** (`MAD_UNLOCK_LEVEL`, przesunięte z pierwotnego 50 — patrz wpis 2026-08-18
    "Trudność bossów podbita" niżej) i TYLKO per-boss PO pokonaniu jego zwykłej wersji
    (`defeatedBosses.includes`) — nie da się przeskoczyć kampanii. Wybór "aktualnego" MAD
    celu (`madCandidate`) lustrzanie kopiuje `campaignBoss` (`BOSSES.find(b =>
    !defeated.includes(b.id))`) — jeden wspólny cel po `order`, osobna lista
    `defeatedMadBosses`/`defeatMadBoss` w `petStore.ts` (bez loot-regrantu — ten item już
    masz z pokonania zwykłej wersji). Art: POŻYCZONY z kampanii pod `mad_<id>` (prefiks
    ściągany w `bossPng`, nie duplikowane require()) + ta sama czerwona `powered` aura co
    raid.
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
    - **Kotek "w podróży" na pasku** (2026-08-18, user: "musi przeskalowywać się na pasek
      podróży... pasek kotek wskakuje i tak jakby porusza się z progressem misji") —
      zaproponował export osobnych ikon kotków per kolor, ale `CatArt` to już komponent SVG
      parametryzowany paletą/dodatkami (nie bitmapa), więc renderujemy TEGO SAMEGO kotka co
      reszta ekranu, po prostu `size={22}` i `animate={false}` — zero nowych assetów. Pozycja
      `left: {progress}%` wewnątrz `missionProgWrap` (NOWY wrapper, BEZ `overflow:'hidden'` w
      przeciwieństwie do `missionProgTrack` pod spodem — inaczej kotek wystający nad cienki
      pasek zostałby przycięty), offset `missionCatWrap` (`top:-9, marginLeft:-11`) centruje
      22px ikonę dokładnie na punkcie postępu — ta sama technika co `pawX`/`boltX` w
      `boss-fight.tsx`.
      - **Fix (ten sam dzień, screenshot + "tylko on miał tam podskakiwać jak w tych paskach
        na dashboardzie xd, i miał znikać z ekranu że niby jest w misji czaisz???")** — dwa
        braki z pierwszej wersji: (1) kotek na pasku stał nieruchomo (`animate={false}`
        wyłączał WSZYSTKIE efekty CatArt, łącznie z ewentualnym bounce) — dodany NOWY, prosty
        `Animated.loop` na WRAPPERZE wokół mini-CatArt (`missionBounce`, translateY 0→-6→0,
        320ms w każdą stronę), start/stop w `useEffect` bramkowanym `missionEndsAt &&
        !missionReady` — CELOWO nie próbowano włączyć wewnętrznego `animate` CatArt (ten
        system jest zbudowany pod interakcje/idle GŁÓWNEGO portretu — mrugnięcia, spojrzenia,
        pogłaskanie — nie pod proste ciągłe "chodzenie w miejscu" 22px ikony, dużo cięższe niż
        potrzeba). (2) GŁÓWNY portret kotka na scenie (`s.stage`) siedział normalnie nawet
        gdy karta Misja mówiła że go nie ma — teraz `missionEndsAt && !missionReady` podmienia
        całą scenę na placeholder (`Compass` + "Pupil poszedł na misję…"), zamiast renderować
        `<CatArt>`. `missionReady` (wrócił, czeka walka) CELOWO nie liczy się jako "away" —
        jest już z powrotem.
    - **Misja blokuje pozostałe tory walki** (2026-08-18, user: "wtedy nie może walczyć w
      innych z bossem zanim nie wróci a zamiast niego jest napis w trakcie misji") — dotąd
      misja była całkiem niezależna od kampanii/raidu/eventu/questów/MAD (osobna pula, osobny
      stan) — można było grindować normalnie mimo aktywnej misji. Teraz `missionAway` (`!!
      missionEndsAt && Date.now() < missionEndsAt`) w `boss-fight.tsx` blokuje `attackRoundBased()`
      (toast) i podmienia arenę na `lockBox` ("Pupil jest w trakcie misji — wróć jak dotrze")
      dla KAŻDEGO `kind !== 'mission'` — `kind==='mission'` to jedyny wyjątek (to właśnie
      ekran na powrót). Świadomie NIE zmieniane w `app/bosses.tsx` (lista/hero card/mini-karty
      raid+event) — nawigacja do `boss-fight.tsx` i tak poprawnie pokaże blokadę, więc to nie
      dead-end, tylko brakuje wizualnego podglądu PRZED nawigacją (drobny polish do rozważenia
      osobno, nie zrobiony w tym przejściu ze względu na 4 osobne przyciski do ogarnięcia).
    - **Wybór profilu misji (balanced/gold/xp)** (2026-08-18, user: "trzeba zrobić że mam jak
      w sfgame że mogę wybrać misję czy pod złoto czy pod XP że jedna ma trochę więcej gold a
      druga XP i mogą być 3 do wyboru") — `MissionProfile = 'balanced'|'gold'|'xp'`
      (`missions.ts`). TA SAMA długość dla wszystkich trzech (user nie prosił o różny czas) —
      `MISSION_PROFILE_MULT` przesuwa TYLKO coins↔xp: `balanced` = dokładnie stare wartości
      (×1/×1, nikt kto już wysyłał misje nie dostaje nagle gorszej nagrody przy domyślnym
      wyborze), `gold` = ×1.5 coins/×0.6 xp, `xp` = ×0.6 coins/×1.5 xp — świadomie NIE ±50/±50
      (suma identyczna zrobiłaby z wyboru czysty kosmetyk, +50%/-40% daje realny trade-off bez
      jednego profilu strictly dominującego). `missionRewardFor(level, profile='balanced')` —
      domyślny param, więc STARE wywołania (1 argument) działają bez zmian. Zapamiętane PRZY
      WYSYŁCE w nowym `missionProfile: MissionProfile | null` w `petStore` (obok
      `missionStartedAt`/`missionEndsAt`, ten sam cykl życia — `claimMission` czyści wszystkie
      trzy naraz) — `boss-fight.tsx` liczy nagrodę CLAIM-em z zapamiętanego profilu, nie z
      domyślnego, żeby wybór z wysyłki realnie się liczył niezależnie kiedy user wróci
      odebrać. `app/pet.tsx`: `!missionEndsAt` (nic nie wysłano) renderuje NOWĄ
      `missionChooseCard` (kolumna: head + `MISSION_PROFILE_ORDER.map` — 3 wiersze, każdy z
      podglądem `+X🪙 +Y XP` i własnym przyciskiem Wyślij) zamiast starej `missionCard`
      (`flexDirection:'row'`, źle pasująca do 3 przycisków) — stan w-trakcie/gotowa dalej
      używa starej `missionCard`, bez zmian. Migracja: stary zapisany stan bez `missionProfile`
      dostaje `'balanced'` JEŚLI akurat trwała aktywna misja (dokładnie to co wtedy dostałaby),
      inaczej `null`.
  - **Energia kampanii/MAD — regeneracja w czasie rzeczywistym** (2026-08-18, ZASTĘPUJE gate
    "1 nowy boss dziennie" z 2026-08-17, patrz wpis wyżej — user: "wolałem zamiast jeden
    dziennie raz na 3h atak może? i maksymalnie regeneruje się do 2 energii") — dotąd `energy`
    był FLAT dziennym grantem (`dailyAttempts(energyMult)`, ~3 bazowo, skalujący z łupem,
    resetowany raz/dzień przez `syncEnergy`). Teraz bank 0..`ENERGY_MAX` (=2, `bosses.ts`),
    +1 co `ENERGY_REGEN_HOURS` (=3) w czasie RZECZYWISTYM, nie o północy. Świadomie FLAT, BEZ
    skalowania energyMult z łupu (user podał konkretne liczby bez wspominania o skalowaniu —
    energyMult dalej ma sens dla raidu/eventu, tylko przestał wpływać na energię kampanii).
    - **Jądro** — dwie CZYSTE, testowane funkcje w `bosses.ts` (nie w store, żeby dało się
      testować bez Zustand/AsyncStorage — `__tests__/bosses.test.ts`, 10 nowych testów):
      `energyRegenTick(energy, regenAt, now)` dogania tyknięcia PĘTLĄ (nie jednym odejmowaniem
      różnicy czasu — inaczej `regenAt` mógłby wskazywać moment w PRZESZŁOŚCI po długim
      offline, UI pokazywałoby ujemny odliczany czas), capuje na `ENERGY_MAX`, zwraca
      `regenAt: null` gdy bank pełny (nic nie tyka). `energySpendTick(energy, regenAt, now)`
      startuje zegar TYLKO przy przejściu pełny→niepełny — jeśli już tykał (bank był już
      niepełny), zostaje bez zmian, żeby wydanie DRUGIEGO punktu energii nie zresetowało
      postępu w stronę PIERWSZEGO (user nie traci częściowo odliczonego czasu).
    - **Store** (`petStore.ts`) — `energyDate`/`energyToday` (stary model) zastąpione jednym
      `energyRegenAt: string | null`. `syncEnergyRegen()` (nowa akcja, zero argumentów, w
      przeciwieństwie do starego `syncEnergy(todayEnergy, mult)`) woła `energyRegenTick` z
      realnym `Date.now()`; `spendEnergy()` woła `energySpendTick`. Migracja starego stanu:
      `energy` przycięte do `ENERGY_MAX` (stary flat model mógł dawać więcej przy dużym
      energyMult z łupu), `energyRegenAt` zawsze `null` po migracji (pierwsze
      `syncEnergyRegen()` po starcie samo wystartuje zegar jeśli bank niepełny).
    - **UI** — `app/bosses.tsx`'s `reload()` woła `syncEnergyRegen()` zamiast starego
      `syncEnergy(attempts, 0)` (raid ZOSTAJE przy `syncRaidEnergy`+`dailyAttempts`, bez
      zmian — to TYLKO energia kampanii). Hero card dostał nowy odliczany napis "Kolejna
      energia za Xh Ymin" (`fmtEnergyCountdown`, statyczny w chwili renderu jak
      `fmtMissionDuration` w `pet.tsx`, nie żywy tiker) gdy bank niepełny — user widzi KIEDY
      wróci, nie tylko suchą liczbę "0 energii".
  - **Nemesis (`kind='menace'` w `seasonalEvents.ts`) przebudowany na TRWAŁY bank HP, bez
    timera/limitu prób** (2026-08-18, user: "wyłączyć czas tym eventowym i zostawić tylko
    sezonowe bossy że mają dużo HP, wspólną energię... a ten drugi [nemesis] niech nie ma
    timera tylko pasek zdrowia większy, ma nielimitowany czas i próby podejścia ale ma wpizdu
    HP żeby go długo klepać... dobre nagrody, szansa na item kilka prc, XP sporo i golda") —
    SEZONOWE (Mikołaj/Wielkanoc/Wakacje/4×mitologiczne) BEZ ZMIAN w mechanice: dalej pełny
    reset HP co próbę (`eventAsBoss`/`eventHpFor`), dalej mają timer (`eventEndsAt`/
    `eventDaysLeft`) i współdzieloną `eventEnergy` — tylko HP podbite +50% (`eventHpFor` = `300
    + level×9`, było `200 + level×6`). NEMESIS dostał ODWROTNY model, DOKŁADNIE lustrzany
    względem raidu (`raid.ts`/`raidHpFor`/`raidSessionHpFor`), bo z tych samych powodów:
    - **Store** (`petStore.ts`) — nowe `menaceId: string | null`, `menaceHp: number` (trwały
      bank, jak `raidWeek`/`raidHp`), akcje `menaceEnsure(id, hp)` (no-op jeśli `id` się nie
      zmienił), `menaceAttack(damage)` (odejmuje od banku, BEZ zużywania `eventEnergy` —
      nemesis ma nielimitowane próby), `menaceClaim(key, coins, xp, name, level, fight)`
      (dopisuje nagrodę + rzuca `MENACE_ITEM_DROP_CHANCE=0.08` szansą na przedmiot bojowy
      spośród jeszcze nieposiadanych, ten sam wzorzec co `openCrate`, zwraca `itemDropped`
      do UI). `eventWon` (bez zmian jako tablica) dalej znaczy "który klucz pokonany" —
      wspólna z sezonowymi.
    - **Klucz identyfikacji BEZ daty** (`eventPeriodKey` w `seasonalEvents.ts`) — sezonowy
      dalej `<id>-<rok>` (wraca co rok). Nemesis DOTĄD miał `<id>-<rok>-<miesiąc>` (reset co
      miesiąc, bo `pickMenace` przelicza się od zerowych statystyk miesiąca) — TERAZ goły
      `boss.id`, bez sufiksu: skoro nie ma już timera/resetu, tożsamość i trwały bank/medal
      muszą przetrwać zmianę miesiąca kalendarzowego. `pickMenace` dalej przelicza się co
      render/reload na bieżących statystykach MIESIĄCA (który axis "overtime" vs "sweettooth"
      najbardziej odstaje TERAZ) — jeśli axis się zmieni w trakcie niedobitego grindu, stary
      bank (`menaceId`/`menaceHp`) po prostu czeka nietknięty, aż `pickMenace` znowu na niego
      wskaże (bank per-id, nie per-"aktualnie wybrany"). Stare zapisane klucze sprzed tej
      zmiany (np. `overtime-2026-08`) zostają w `eventWon` jako nieszkodliwe martwe wpisy,
      `eventBossFromKey` rozpoznaje OBA formaty (`eventKey === b.id || eventKey.startsWith(...)`).
    - **Sesja-wobec-trwałej-puli** (`menaceSessionHpFor`/`menaceAsBoss`, `seasonalEvents.ts`)
      — TA SAMA sztuczka co raid: surowa `menaceHpFor` (baza `5000 + level×700`, WYŻSZA niż
      raidowa `1000 + level×210` — skoro próby są nielimitowane, jedynym hamulcem jest sama
      skala HP, musi starczyć na wiele sesji rozłożonych na dni/tygodnie) jest za duża, żeby
      wrzucić bezpośrednio do `simulateFight` (`counterDamage()` liczy % od AKTUALNEGO hp
      bossa — przy tysiącach HP jeden kontratak zabiłby kotka). Każda próba to mała sesja
      (`menaceSessionHpFor`, `atkPower × MENACE_SESSION_HITS(=6)`, identyczny kształt co
      `raidSessionHpFor`/`questBossHpFor`/`madBossHpFor`), realny postęp (sesyjne hp przed
      minus po) dopisuje się do prawdziwego banku przez `menaceAttack()`.
    - **`boss-fight.tsx`** — `attackRoundBased()` rozgałęziony na `kind==='event' && isMenace`
      DOKŁADNIE tam gdzie wcześniej `kind==='raid'`: bez sprawdzania puli energii przed atakiem
      (nielimitowane próby), `roundBoss` z `menaceAsBoss`, `menaceAttack` zamiast
      `spendEventEnergy`, `finish()` liczy TYLKO czy `menaceOutcome.defeated` (bank spadł do
      zera) — BEZ stanu porażki, jak raid, sesja która nie domknęła banku i tak dostaje wpis
      `logFightAttempt`. `target.energy` dla menace = stała `1` (zawsze "ma próbę"). Pasek HP
      areny pokazuje PRAWDZIWĄ skalę (`menaceRemaining`/`menaceMaxHp`), nie sesyjną — ten sam
      przelicznik co raid w `playerBeat`. Victory modal: "NEMESIS POKONANY!" + osobny napis
      "🎁 Nowy item bojowy: ..." gdy `itemDropped` (ten sam string co `CrateModal.tsx`).
    - **`app/bosses.tsx`/mini-karta** — dla `isMenace`: bez pigułki energii (nielimitowane),
      pasek HP zamiast statycznego "X HP" (jak raid — `menaceRemaining/menaceMaxHp`), bez
      odliczania dni. Sezonowe bez zmian (energia + statyczne HP + odliczanie).
  - **Trudność bossów podbita: `COUNTER_PCT` 0.04→0.05 + victory modal bez "trofeów" + MAD od
    Lv15** (2026-08-18, user przesłał świeży log walk: kotek kończył KAŻDĄ walkę na 45-70%
    pełnego HP, nigdy realnie blisko zemdlenia — "bossy muszą być trudniejsze, zobacz na log i
    pomyśl"):
    - **`COUNTER_PCT` w `bosses.ts`** (stała współdzielona przez WSZYSTKIE 6 trybów walki, bo
      `counterDamage()` jest jednym, wspólnym silnikiem) podbita 0.04→0.05. Throwaway-
      symulacją (nie zgadywane — ten sam rygor co poprzednie audyty) PEŁNEGO rosteru 22 bossów
      kampanii, profil inwestycji kalibrowany WPROST na realnych danych z przesłanego logu
      (Lv9/order4: atkStatBonus=20, catMaxHpBonus=40, ekstrapolowane liniowo przez `order`)
      sprawdzono: 0.05 daje 100% winrate na CAŁYM rosterze przy tej realnej inwestycji, ale
      podnosi avgLoss z ~35-60% do ~45-75% (worstLoss 70-92%) — realna, odczuwalna trudność i
      szansa na zemdlenie przy niedoinwestowaniu. 0.06 już WALI boss #19 (regen 0.04) do 0%
      winrate nawet przy lżejszej inwestycji (regen bossy są nieproporcjonalnie wrażliwe — więcej
      rund ekspozycji = kwadratowo więcej skumulowanego kontrataku) — 0.05 to sprawdzony,
      bezpieczny sufit, NIE powtarza historycznego "6 z 22 bossów niewygrywalnych" (patrz
      komentarz nad `BOSSES` w bosses.ts). Per-boss `hp` (22 wartości) świadomie NIETKNIĘTE —
      jeden global knob jest łatwiejszy do zweryfikowania niż ręczne przestrajanie każdego bossa
      z osobna, ten sam ostrożny wzorzec co przy poprzednich audytach.
    - **MAD bossy** dziedziczą TEN SAM `counterDamage()`, więc automatycznie też stają się
      trudniejsze — ŚWIADOMIE bez ręcznego podbijania `madHitsFor` (6→8 ciosów, `madBosses.ts`)
      mimo że user chciał "bardzo trudne": throwaway-symulacją sprawdzono że MAD hp liczy się z
      AKTUALNEJ, żywej mocy gracza (nie zamrożonej jak kampania), więc podbijanie hits tam jest
      DUŻO bardziej wrażliwe — kwadratowy, nie liniowy wzrost skumulowanego kontrataku
      (dokładnie problem z historycznego komentarza w `madBosses.ts`: "8-10 ciosów już
      matematycznie niewygrywalne"). Zamiast tego: `MAD_UNLOCK_LEVEL` 50→15 (user: "dajmy je od
      15 lvl jednak") — gracz spotyka MAD dużo wcześniej, z naturalnie mniejszą inwestycją, co
      samo w sobie robi go subiektywnie "bardzo trudnym" względem punktu w grze w którym się
      pojawia, bez ryzyka matematycznego niewygrywalnego stanu na wyższych poziomach.
    - **Victory modal bez "trofeów" dla nie-kampanijnych wygranych** (`app/boss-fight.tsx`) —
      user: "z bossów nagrody wypierdzielaj trofea, cały czas pisze że coś dostałem xd". Box z
      ikoną+nazwą (`s.vLoot`, wcześniej `Trophy` fallback + "Medal tygodnia"/"Nagroda questu"/
      itd. gdy `victory.loot` nieustawione) renderuje się TERAZ tylko gdy `victory.loot`
      istnieje (kampania — prawdziwy item ze statem). Raid/event/quest/mad/misja (bardzo częste
      walki, patrz log — misje/questy lecą wielokrotnie dziennie) nie dają realnego przedmiotu,
      więc pokazywanie pustego "zdobyłeś trofeum" placeholdera przy KAŻDEJ z nich czytało się
      jak spam — coins/XP rewardRow niżej i tak pokazuje realną nagrodę. `itemDropped`
      (nemesis) ma własny, osobny napis, zostaje bez zmian.
  - **Sesja treningowa self-report** (2026-08-15, `components/pet/TrainingSessionModal.tsx`)
    — pompki/przysiady/brzuszki/deska/rozciąganie (`b_pushups`/`b_squats`/`b_situps`/
    `b_plank`/`b_stretch` w `quests.ts`) nie mają czujnika (rower ma, przez Health Connect).
    Dawniej jedno tapnięcie "Zrobione"; teraz przycisk **"Rozpocznij"** w `pet.tsx` otwiera
    modal: dla deski/rozciągania realny ODLICZANY timer (`setInterval`, jak `pomodoroStore`)
    od celu z `personalQuests.ts` (`plankSeconds`/`stretchMinutes`), dla pompek/przysiadów/
    brzuszków ekran z docelową liczbą powtórzeń + przycisk "UKOŃCZYŁEM" (bez czujnika liczyć
    się nie da). Po ukończeniu woła to samo `mark*Done` z `petStore` co wcześniej — quest
    staje się `done`, dalej idzie przez tor "Questy-jako-walki" wyżej (przycisk "Walcz").
    **Fix 2026-08-17** (user: "wywal emotki z tych treningów, zostaw tylko nazwy ćwiczeń") —
    duży emoji na górze `TrainingSessionModal` usunięty (samo `META` bez pola `emoji`), plus
    emoji-sufiksy w `quests.ts` (`note: 'zrobione 💪'` itd. dla `b_pushups/squats/situps/
    plank/stretch`) ścięte do gołego `'zrobione'` — sama nazwa ćwiczenia (label questu)
    bez zmian.
  - **Layout `app/pet.tsx` (2026-08-16)** — user: "zadania i ta walka jest za nisko, wywalić
    potrzeby bo nic nie mówi, zrobić głaskanie, nazwę zbić bo nad pupilem zajmuje w pizdu
    miejsca". Nowa kolejność sekcji w ScrollView: nazwa/nastrój (skurczone — `name` 24→16px,
    ciaśniejsze marginesy nad kotem) → CatArt → pasek afekcji → **przycisk "Pogłaskaj pupila"**
    (jawne CTA na `handlePet`, zamiast dotychczasowego wyłącznie ukrytego tap-on-sprite) →
    **Misja / Nieodebrane z wczoraj / Codzienne / Bonusowe dziś** (wszystkie z przyciskiem
    "Walcz" — PRZENIESIONE wyżej, od razu pod głaskaniem, żeby były widoczne bez przewijania)
    → skrzynka dnia / skrzynka sardynek / karta poziomu (przesunięte NIŻEJ, mniej akcyjne niż
    questy) → tygodniowe/miesięczne/cele. Sekcja "Potrzeby dziś" (paski `pet.needs` z
    `computePetState`) USUNIĘTA CAŁKOWICIE z UI — user: nic nie mówiła, była martwym
    wypełniaczem; `computePetState`/`PetInput` bez zmian (nadal karmi `pet.color`/`label`/
    `expression`/`wellbeing` gdzie indziej na ekranie), tylko render `.needs` zniknął.
    - **Nagłówek v2 (2026-08-16, tego samego dnia)** — user doprecyzował dalej: "nazwa po
      lewej, samopoczucie pod nim, po prawej ta sama linijka pasek lvl oraz pasek pogłaskania,
      wywal przycisk pogłaskaj". Przycisk "Pogłaskaj pupila" z wersji wyżej ZNIKNĄŁ (tap na
      kota, `handlePet`/`handleCuddle` na `<CatArt onPress/onLongPress>`, zostaje jedynym
      sposobem głaskania — jak przed 2026-08-16). Osobne karty `levelCard` i `affRow` też
      zniknęły — zastąpione dwukolumnowym `topHeader` (`topLeft`: nazwa+edycja+`moodChip`;
      `topRight`: dwa cienkie `miniBarRow` — poziom (fiolet `#A78BFA`, `Lv {level}` +
      `lvl.progress`) i głaskanie (róż `#F472B6`, serce-emoji + `affToday`%)) — te same dane co
      poprzednio, bez osobnych kart, więc reszta ekranu (Misja/Codzienne/...) zaczyna się
      wcześniej. `tip` (`petStatusLine`) zostaje jako osobna linia POD nagłówkiem, na całą
      szerokość.
  - **`petStore.bossLog`** (2026-08-14) — historia KAŻDEJ pokonanej walki (wszystkich 6
    torów), do eksportu/balance-testowania: `utils/bossProgressReport.ts` buduje
    czytelny tekstowy raport (poziom/staty/pokonani bossowie/log), Ustawienia →
    Diagnostyka → „Eksportuj postęp pupila" (`Share.share`) / „Zresetuj postęp pupila"
    (`petStore.reset()`, wcześniej martwa funkcja, teraz podpięta).
    - **Przebieg runda-po-rundzie w bossLog** (2026-08-17, user: "nie zapisujesz do
      logowania z pupila dokładnie walk z ilością HP w czasie i dmg zadanego mi i którego
      zadał bossowi przez to nie wiesz jak bardzo łatwo pokonuje bossy") — DOTĄD `bossLog`
      trzymał TYLKO podsumowanie nagrody (`coins`/`xp`) z WYGRANYCH walk; nie dało się z
      eksportu ocenić jak blisko/łatwo poszła walka, a przegrane w ogóle nie zostawiały
      śladu. `BossFightDetail` (`petStore.ts`) — `{won, catFainted, bossMaxHp,
      catMaxHpAtFight, rounds: BossLogRound[]}`, gdzie `BossLogRound = {p, c, bhp, chp}`
      (Twój dmg / kontratak / hp bossa po rundzie / hp kotka po rundzie, celowo krótkie
      klucze — te obiekty rosną bez limitu w AsyncStorage) — budowany RAZ w
      `attackRoundBased()` (`boss-fight.tsx`) wprost z surowego `result.rounds`
      (`simulateFight`), NIEZALEŻNIE od wyniku. Nagrodowe akcje (`defeatBoss`,
      `defeatMadBoss`, `eventClaim`, `claimQuestFight`, `claimMission`, `raidClaim`)
      dostały 7. parametr `fight: BossFightDetail`, spreadowany do wpisu `bossLog` przy
      WYGRANEJ. Nowa akcja `logFightAttempt(kind, id, name, level, fight)` pokrywa resztę
      (przegrana dowolnego trybu poza raid; sesja raidu która nie domknęła tygodniowej
      puli) z `coins:0, xp:0` — dzięki temu `bossLog` ma teraz KOMPLETNY obraz prób, nie
      tylko sukcesy. WAŻNE: `id`/`name` w gałęzi przegranej MUSZĄ się zgadzać z tym co
      wpisuje odpowiednia akcja-nagroda przy wygranej tego samego trybu (event loguje pod
      `eventKey`, nie `eventBoss.id`; mission pod stałym `'mission'`; mad pod id
      BAZOWEGO bossa (`madBase.id`), nie wariantu (`madBoss.id` ma inny, prefiksowany
      id) — inaczej ta sama walka wyglądałaby w logu jak dwóch różnych przeciwników
      zależnie od wyniku. `bossProgressReport.ts`: wpis z `rounds` renderuje
      `WYGRANA/PRZEGRANA (N rund)` + trajektorię `boss HP: max→...→...` /
      `kotek HP: max→...→...` + listy `Twój dmg/rundę`/`kontratak/rundę`; wpisy sprzed
      tego fixu (bez `rounds`, opcjonalne pole) renderują starą, samą linię z nagrodą —
      pełna wsteczna kompatybilność, żadnej migracji AsyncStorage.

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

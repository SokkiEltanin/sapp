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
  zamontowane, nieaktywne są „zamrożone". Zakładki: `/` (Dziś), `/tasks`, `/stats`
  (to KALENDARZ), `/finances`, plus `href:null`: `calendar`, `mood`, `health`.
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
- Karta „TEN MIESIĄC" w finances.tsx: tempo vs ten sam dzień zeszłego miesiąca, prognoza,
  ile/dzień zostało, największa kategoria (`monthPulse`). Lista transakcji domyślnie
  ostatnie 31 dni + „Pokaż starsze" (`capTx`/`showAllTx`).

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
- `healthHistory.ts` `getHealthHistory(n)` = jeden `multiGet`. Zegarek = źródło prawdy;
  tylko wagę można nadpisać ręcznie. Uprawnienia w app.json (patrz §11).

## 9. Pupil (kot) — patrz memory [[pet_blob_design]]

- `components/pet/CatArt.tsx` (wektorowy kot, prezentacyjny — bierze `palette` prop, BEZ
  storu) + `CatTail.tsx` (ogon; prążki przez obrócony `<Pattern>`). `catPalettes.ts` —
  `DEFAULT_PALETTE` = niebieski (to samo co logo/splash). `petStore` (xp/coins/kolor/prążki),
  `petState.ts` (nastrój z danych), `quests.ts`, `petShop.ts`.
- **Ograniczenie RN:** animować tylko transformy wrappera `Animated.View` (native driver);
  animacja propów SVG stutteruje. RN nie ma transform-origin → piwot = translate→rotate→translate.
- **AnimatedSplash** używa CatArt (nie PNG) — te same ID/rozmiar co natywny splash, start
  na pełnej widoczności (bez fade-in), żeby statyczny obrazek płynnie „ożył".

## 10. Inne subsystemy (entry files)

- **Payday/bills/debts**: `utils/payday.ts` (okno `PAYDAY_WINDOW_DAYS`), `recurringBills.ts`,
  `debtsService.ts`; prompty jako AUTO_SECTIONS na dashboardzie. Powiadomienie payday w
  `notificationsService.refreshPaydayReminder` (nudguje tylko w oknie, potem następny miesiąc).
- **Backup**: `backupService.ts` — chunkowane snapshoty do Firestore + restore z Ustawień
  (reinstall-proof po zalogowaniu Google).
- **Wrapped/kolekcje**: `monthCards.ts`/`yearCards.ts` + `MonthWrappedCard`/`YearWrappedCard`
  (BEZ emotek — „wyglądało tanio"). `YearPixels` = rok w pikselach (viz `pixels`).
- **Nawyki/liczniki**: `utils/habits.ts` + `useHabits`, `countersStore` (dni bez / odliczania).
- **Powiadomienia**: `notificationsService.ts` — master `notif_enabled` + per-typ flagi;
  deep-linki obsługiwane w `_layout.tsx`.

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

---

*Powiązane notatki (prywatna pamięć asystenta): codebase_map, project_sapp,
dashboard_nav_internals, bank_auto_expenses, pet_blob_design, perf_stylesheets,
theme_system, consumption_scope.*

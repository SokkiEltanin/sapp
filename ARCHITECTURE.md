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
  - **`TopPill.tsx` — priorytet 1-7 PILNE (sztywne, pierwsze pasujące wygrywa) + rotacja
    LUŹNEJ puli (2026-08-23)** — user: "żeby nie pokazywało się miesiąc ten sam że mam
    jedno zadanie tylko żeby trochę tego trochę tamtego". Dawniej stany 8-10 (streak
    zagrożony/brak nastroju/zadania w toku/"wszystko ogarnięte") miały TEN SAM sztywny
    priorytet co 1-7 — jeśli user miał tylko np. "1 zadanie w toku" i nic pilniejszego, pill
    pokazywał DOKŁADNIE ten sam napis tygodniami. Teraz: pilne stany 1-7 (pomodoro/praca/
    zaległe/dziś/budżet/kalendarz/deadline) bez zmian, sztywny priorytet, przerywają
    natychmiast. Gdy żaden nie pasuje, WSZYSCY luźni kandydaci (streak/misja pupila/energia
    bossów/nastrój/zadania w toku/all-clear) trafiają do jednej listy `calmCandidates` i
    pokazują się PO KOLEI, zmieniając się co 8s (`calmTick`, `setInterval` w komponencie) —
    `calmCandidates[calmTick % calmCandidates.length]`. Dwaj NOWI kandydaci: **pupil na
    misji** (`missionEndsAt` z `petStore`, tekst różni się gotowa/w drodze, `fmtMissionDuration`
    jako badge) i **energia bossów gotowa do walki** (`energy` z `petStore`, badge = liczba,
    tylko gdy >0) — user: "dodać pupila że jak jest na misji to też pokazuje... tak samo z
    energią do bossa".

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
**`nodes[id]`'s truthiness NIE jest tylko o renderze** — edytor dashboardu (drag-to-reorder)
czyta ją WPROST (`empty={!nodes[id]}`, `{!nodes[id] ? '  · brak danych' : ''}`) żeby oznaczyć
puste sekcje. Więc gdy sekcja wyciągnięta jest do osobnego komponentu (patrz "Rozbicie
index.tsx" niżej), guard `pinnedNotes.length > 0 &&` (czy jakikolwiek inny warunek "czy jest co
pokazać") MUSI zostać w `index.tsx`, na zewnątrz komponentu — jeśli komponent sam połyka pusty
stan (`if (empty) return null`) i `nodes[id]` dostaje zawsze-prawdziwy element JSX, edytor
przestaje poprawnie oznaczać "brak danych", cicho i bez błędu kompilacji/testu (2026-08-25,
złapane PRZED shipowaniem przy pierwszym wyciąganiu sekcji — patrz niżej).

**Rozbicie `index.tsx` na mniejsze komponenty (2026-08-25, w toku)** — user: "a okiem
specjalisty co byś jeszcze zoptymalizował?" → trzecia, najbardziej ryzykowna z trzech rzeczy
(większy render = mniejsze granice re-renderu, ale bez testów renderu komponentów w tym
projekcie łatwo coś cicho zepsuć). Krok 1 (mały, celowo): `nodes['pinned-notes']` wyciągnięte
1:1 do `src/components/dashboard/PinnedNotesCard.tsx` (mechaniczne przeniesienie JSX + style
`pinNoteRow`/`Title`/`Tags`/`More` skopiowane tam, `pinNoteBody` zostaje w `index.tsx` bo wciąż
używane przez detal kafla custom "note"; `card`/`cardHeader`/`cardTitle` skopiowane verbatim,
nie wyciągnięte współdzielone — te dwie rzeczy to osobna, większa zmiana). Guard
`pinnedNotes.length > 0 &&` ZOSTAŁ w `index.tsx` (patrz akapit wyżej — inaczej edytor by się
zepsuł). Wzorzec do powielenia dla kolejnych sekcji: (1) sprawdź czy sekcja ma `nodes[id] =
warunek && (...)` — jeśli tak, warunek zostaje NA ZEWNĄTRZ nowego komponentu, (2) sprawdź czy
używane style są dzielone z innymi sekcjami (`grep 's\.xxx'` w całym pliku) — dzielone zostają
verbatim-skopiowane (duplikat), nie-dzielone przenoszą się w całości, (3) `tsc`/`jest` jako
bar (nie łapią regresji WIZUALNYCH — stąd **każdy krok wymaga potwierdzenia na urządzeniu**
zanim kolejny krok, nie robić hurtowo naraz). `tsc`/`jest` zielone (60/730, bez nowych testów —
to czysto strukturalna zmiana pliku, nie logiki).
**Krok 2**: `nodes['countdowns']` → `CountdownsCard.tsx`, ten sam wzorzec. Tu dodatkowo: `cn`
helpery (`isDuringEvent`/`daysUntil`/`daysUntilEnd`/`eventProgress`/`untilProgress`) to CZYSTE
funkcje z `countersStore.ts`, nie domknięcia komponentu — bezpieczne do importu wprost w nowym
pliku. Styl `cdName` był używany TYLKO w tej sekcji (sprawdzone `grep`iem) → przeniesiony w
CAŁOŚCI, nie duplikowany jak `card`/`cardHeader`/`cardTitle`/`workToggleText`/`cdDays`
(współdzielone gdzie indziej, zostają w `index.tsx`). Martwe importy po ekstrakcji usunięte
(`daysUntilEnd`/`eventProgress`/`untilProgress`/`WalkProgress` — zweryfikowane `grep`iem że
liczba wystąpień spadła do 1, czyli tylko sam import, przed usunięciem).

**Krok 3**: `nodes['counters-since']` → `SinceCountersCard.tsx`, ten sam wzorzec.
`sinceGrid`/`sinceTile`/`sinceTileUnit`/`sinceTileName` używane TYLKO tu → przeniesione w
całości; `card`/`cardHeader`/`cardTitle`/`workToggleText` (współdzielone) skopiowane verbatim.
Przy okazji usunięty `sinceTileDays` — był martwy JUŻ PRZED tą zmianą (`grep`iem
potwierdzone że nigdzie się nie renderował — `StreakFlame` sam pokazuje liczbę dni w środku
płomienia, nie dotyczy tej ekstrakcji, ale trafił się przy okazji sąsiadujących linijek).
Martwe importy usunięte: `StreakCard` (całość), `StreakFlame` (domyślny) i `streakTier` z
`@/components/counters/StreakFlame` (`streakColor`/`StreakFlameGlow` z tego samego modułu
zostają — wciąż używane gdzie indziej w pliku).

**Krok 4**: `nodes['gcal']` → `GCalCard.tsx`, ten sam wzorzec. `gcalDayLabel`/`gcalRow`/
`gcalDot`/`gcalTime`/`gcalTitle` używane TYLKO tu → przeniesione w całości. Typ zdarzeń
(`CalendarEvent`) importowany z `@/types`, nie z `googleCalendarService.ts` (tam prywatny
`GCalEvent` się nie eksportuje — `fetchEvents()` zwraca już zmapowane `CalendarEvent[]`).
Martwy import `CalendarDays` (ikona) usunięty z dużego bloku importów lucide na górze pliku.

**Krok 5**: `nodes['sleep-chart']` → `SleepChartCard.tsx`. RÓŻNI SIĘ od kroków 1-4: to
`warunek ? (...) : (...)` (ternary), nie `warunek && (...)` — więc `nodes['sleep-chart']`
NIGDY nie było `false` (zawsze wykres ALBO pusty stan), więc guard NIE zostaje w `index.tsx`
— cała logika (oba branche) przeniesiona do komponentu, wołany bezwarunkowo. Sekcja "Sen" jest
ESENCJALNA (nie w `DEFERRED_SECTIONS`), bez zmian w tym zakresie. Stan `sleepDashRange`
(toggle Tydzień/Miesiąc) ZOSTAJE w `index.tsx` (jedyny stan tej sekcji, przekazany jako
`sleepDashRange` + callback `onToggleRange`, nie surowy setState). Style `card`/`cardHeader`/
`cardTitle`/`cdDays`/`workToggle`/`workToggleText`/`factText` skopiowane verbatim (WSZYSTKIE
zweryfikowane `grep`iem że mają usage GDZIE INDZIEJ w `index.tsx`, np. `workToggle`/
`workToggleText` też w sekcji finanse/praca); `sleepEmptyIcon`/`sleepEmptyTitle`/
`sleepEmptyBtn`/`sleepEmptyBtnText` używane TYLKO tu → przeniesione w całości. Martwe importy
usunięte: `Alert` (react-native) i `Search` (lucide) — oba miały już zero innych usage w pliku.

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
Tydzień/Miesiąc (`detailPeriod`). Patrz §5 — cały system USUNIĘTY poza `viz==='pixels'`,
przywróconym punktowo 2026-08-24.

**Zmiany 2026-08-24** — user: (1) "widget oszczędzone z tych lidlowskich usuń mi... i możesz
posprzątać po nim bo nie używam go wgle", (2) "żeby ta nie jedzenie słodyczy było jakby tam
gdzie nawyki bo tam gdzie odliczania to bez sensu". (1): sekcja `savings` ("Zaoszczędzone
(kupony)" — suma rabatów/kuponów z paragonów, w tym osobno Lidl) CAŁKOWICIE usunięta: node w
index.tsx, wpisy w `DEFAULT_DASHBOARD_SECTIONS`/`SECTION_TITLES`/`SECTION_DESC`/
`SECTION_GROUP` (dashboardLayout.ts), komponent `SavingsSection.tsx`, util `utils/savings.ts`
(`computeSavings`) i jego test `savings.test.ts` — usunięte w całości, nie tylko ukryte
(zero pozostałych konsumentów po sprawdzeniu). NIE mylić z metryką custom-kafelków `savings`
("Odłożone — przelewy własne", statWidgets.ts) — inna, NIEPOWIĄZANA rzecz, ten sam
identyfikator to przypadek, zostaje bez zmian. (2): `streak-wall` ("Twoje serie" — nawyki +
liczniki "dni bez", w tym "bez słodyczy") był w grupie edytora "Nastrój i liczniki" razem z
`countdowns` (odliczania DO wydarzeń — koncepcyjnie coś zupełnie innego). Przeniesiony do
"Zadania i nawyki" (`SECTION_GROUP` w dashboardLayout.ts) — ta sama rodzina co `habits-today`/
`daily-rings`.

**Seria logowań sklejona z kaflem pupila (2026-08-24)** — user: "zróbmy te ilość seri jako
łączny kafelek z pupilem po prostu po prawej stronie oke??" (screenshot: karta "Twoje serie"
tuż nad kaflem pupila). PIERWSZA próba omyłkowo dokleiła `streakWall` (ogólne serie
nawyków/liczników, np. "bez wody") zamiast serii LOGOWAŃ do pupila — user: "ty zjebałeś,
miałeś mi serię logowań pupila z nim połączyć a połączyłeś serię picia wody itp??". Naprawione:
sekcja `streak-wall`/`StreakWallCard.tsx` w CAŁOŚCI przywrócone do stanu sprzed tej zmiany
(osobna, przesuwalna karta dashboardu — nietknięta). Zamiast tego kafel pupila (`index.tsx
nodes['pet']`) łączy się z `petLoginStreak` (`usePetStore(s => s.loginStreak)`) — dawniej pasek
`loginStrip` POD kaflem pupila (`loginStrip`/`loginStripTxt`/`loginStripNext` — style USUNIĘTE,
zastąpione przez `petLoginTile`/`petLoginFlame`/`petLoginNum`/`petLoginLabel`/`petLoginNext`).
Gdy `petLoginStreak > 0`: JEDNA `TouchableOpacity` (`s.petCombined`) → `/pet` (bez podziału na
dwie połówki jak w pierwszej, błędnej wersji — seria logowań i pupil to ta sama rzecz, więc
jeden wspólny tap-target wystarczy), lewa strona = `<PetTile bare />` (prop zostaje — nadal
użyteczny), prawa = mały kafelek z `StreakFlameGlow`, liczbą dni i "jutro +N" (ta sama
informacja co dawny pasek, tylko przeniesiona do kolumny). Gdy `petLoginStreak === 0`: stary,
samodzielny `<PetTile />` (bez `bare`) — nie ma czego dokleić.

**Kolor kafla serii + głowa kotka powiększona (2026-08-25)** — user ze screenshotem: "popraw
kolory bo sa pierdolniete na tym streaku" + "zeby ten pupil jakby był w kafelku większy
praktycznie sama głowa i tak dorobić mu łapki zeby lekko wyglądały jakby sie opierał o krawędź
kafelka". Dwa fixy:
1. `petLoginTile`/`petLoginNum` (`index.tsx`) miały NA SZTYWNO pomarańcz (`#FB923C`) niezależnie
   od realnego progu serii — przy np. 3 dniach `StreakFlameGlow` poprawnie rysował płomień w
   kolorze "Bordo" (patrz `STREAK_TIERS`/`streakColor()` w `StreakFlame.tsx`), ale tło/liczba
   kafla i tak świeciły pomarańczem, więc kolory się gryzły. Naprawione: tło/ramka/liczba teraz
   liczone z `streakColor(petLoginStreak)` inline w miejscu użycia (`loginStreakColor + '1E'`/
   `'3A'` alpha-suffix, ten sam wzorzec co reszta apki), stylesheet trzyma tylko layout.
2. `PetTile.tsx`: kotek renderowany jako "wystawiona głowa" zamiast pełnej sylwetki. `CatArt`
   rysuje CAŁEGO kota w stałym `viewBox 0 0 2000 2000` (patrz sekcja CatArt w tym pliku / komentarz
   na górze `CatArt.tsx`) — nie da się wyrenderować samej głowy bez rozbierania SVG, więc
   zamiast tego: `CatArt` renderowany W WIĘKSZYM rozmiarze (`CROP_SIZE=135`) niż widoczny
   kontener (`CROP_W×CROP_H = 54×78`, `overflow:'hidden'`), przesunięty (`CROP_TOP`/`CROP_LEFT`)
   tak żeby okno łapało dokładnie od czubka uszu (viewBox y≈430, wyliczone z transformu
   macierzy `Ear` R) do dołu łapek (`Paw` cy=1541 ry=48 → y=1589) — łapki lądują dokładnie na
   dole kontenera = "opierają się o krawędź". Liczby wyliczone z geometrii SVG (macierze
   transformacji w `CatArt.tsx`), nie zgadywane, ale BEZ wizualnej weryfikacji na urządzeniu —
   jeśli kadr jest za ciasny/za luźny, to tylko cztery stałe `CROP_*` na górze `PetTile.tsx`.
   Dotyczy WYŁĄCZNIE `PetTile.tsx` (jedyne miejsce użycia — `index.tsx` dashboard, oba warianty
   `bare`/pełny) — pełny ekran `/pet` ma własny, dużo większy `CatArt` i tego nie dotyczy.
   **Powiększone ~1.8× (2026-08-25)** — user przesłał screenshot z odręcznym szkicem
   (narysowanym NA screenshocie) znacznie większej głowy na kaflu: "o tak o chciałem ten
   kafelek". `CROP_H` 78→140 (reszta stałych przeliczona z zachowaniem tych samych proporcji/
   kadru — uszy→łapki, ta sama matematyka co wyżej, tylko większe okno). BEZ wizualnej
   weryfikacji na urządzeniu jeszcze — jeśli nadal za małe/za duże, to znowu tylko `CROP_*`.
   **BUG: przycinanie w ogóle nie działało — kotek renderował się CAŁY (2026-08-26)** — user
   ze screenshotem na buildzie #842 (potwierdzone najnowszy, nie stary build): pełna sylwetka
   siedzącego kotka Z OGONEM, nie przycięta głowa+łapki. Matematyka kadru (viewBox→px)
   zweryfikowana DWUKROTNIE, poprawna — a mimo to OGON (który leży daleko poza oknem x:560–
   1340) był widoczny, co jest silnym dowodem że `overflow:'hidden'` na `headCrop`
   NIE PRZYCINAŁ WCALE, niezależnie od liczb w oknie. Podejrzenie: znany Android/RN gotcha —
   zwykły `View` istniejący tylko dla stylu bywa "spłaszczany" (view flattening, optymalizacja
   natywna) i traci wtedy `overflow:'hidden'`. Fix: `collapsable={false}` na OBU `View`ach
   kadru (`headCrop`/`headCropInner`) — wymusza pozostanie prawdziwym natywnym widokiem.
   **Hipoteza NIE pomogła — technika crop porzucona całkowicie, nowy dedykowany komponent
   (2026-08-27)** — user: "kafelek nadal nie jest dobrze nadal jest za duzy wróć go do tego
   jaki był... kotka możesz zrobic wersje osobna... po prostu głowa lekko tułów dwie łapki
   trzymające krawędź kafelka jakby jak pokazywałem i animacje samych oczu zrobimy i uszka i
   tyle". Dokładnie fallback przewidziany wyżej, tylko lepszy niż "zwykły większy CatArt" —
   zamiast crop-hacka ALBO rezygnacji z pozy "łapki na krawędzi", nowy
   `src/components/pet/PetTileCat.tsx`: osobny, celowo prosty komponent z WŁASNYM małym
   viewBoxem (220×250, nie 2000×2000 CatArt) — głowa (dominujący element) + tułów-hint +
   dwie łapy schodzące do owalnych łapek na SAMYM DOLE viewBoxu (dolna krawędź komponentu =
   krawędź kafelka, bez żadnej matematyki kadru/przycinania). Ta sama personalizacja co
   CatArt (`palette`/`eyeColor`/`noseColor`/`whiskers`/`legStripes`; `stripes` przyjęte dla
   spójności API ale nieużywane — w CatArt renderuje się tylko na ogonie, którego tu nie ma).
   Animacja WYŁĄCZNIE oczu (`blink` — state toggle otwarte/zamknięte, ta sama technika co
   CatArt, nie tweenowanie SVG-prop) i uszu (mała `Animated.View` nakładka z rotacją wokół
   podstawy ucha, ten sam wzorzec co `Ear` w CatArt.tsx, przeliczony na własny viewBox) — ŻADNE
   z reszty aparatu CatArt (głaskanie/pazur/ogon/mruganie-z-podwójnym-mrugnięciem) nie zostało
   przeniesione, user wyraźnie chciał tylko te dwa efekty. `PetTile.tsx` renderuje
   `<PetTileCat size={72} .../>` bezpośrednio w wierszu (bez `overflow:hidden`, bez
   `collapsable={false}`, bez `headCrop`/`headCropInner` — CAŁY crop-aparat usunięty), `size=72`
   ≈ rozmiar sprzed całej serii eksperymentów z kadrowaniem (oryginalne `size={70}` pełnego
   CatArt, commit 584d86d).
   **`PetTileCat` PORZUCONY CAŁKOWICIE, plik USUNIĘTY (2026-08-27, ten sam dzień)** — user ze
   screenshotem: "co ty z tym pupilem odjebałem teraz jak pulpet wygląda ja pierdółek".
   Ręcznie rysowane ścieżki SVG (głowa/uszy/łapy/oczy, bez żadnego prawdziwego artu/referencji
   jako podkładu — czysto wymyślone współrzędne) wizualnie nie do przyjęcia — mała, płaska,
   nieczytelna bryła zamiast rozpoznawalnego kota. Wniosek: hand-coded SVG od zera na tym
   poziomie detalu (twarz maskotki) nie działa bez prawdziwego rysunku jako punktu wyjścia —
   `CatArt.tsx` sam siebie opisuje jako "1:1 port zatwierdzonego designu z HTML lab", nie coś
   wymyślonego w locie, więc TA metoda nigdy nie miała działać. `PetTile.tsx` WRÓCONY do
   DOKŁADNIE oryginalnego renderu sprzed CAŁEJ serii eksperymentów (PR #84→#88→#89→#98): zwykły
   pełny `<CatArt expression={pet.expression} size={70} animate={false} .../>`, te same
   proporcje co commit 584d86d. `PetTileCat.tsx` skasowany całkowicie (dead code po nieudanym
   eksperymencie, nie zostawiony "na potem"). Jeśli temat wróci, potrzebny realny art/screenshot
   jako referencja — nie kolejna próba zgadywania SVG.

## 4b. Google Calendar sync + Praca (`googleCalendarService.ts`, `workEvents.ts`, `useWorkEarnings.ts`)

- **BUG: eventy z kalendarza pracy przestawały się synchronizować NA ZAWSZE, ciche, bez
  żadnego feedbacku (2026-08-28, user ze screenshotami: "juz minęło kilka minut i nadal nie
  dodały mi sie eventy z kalendarza z pracy do aplikacji nawet jak odświeżam").** Trzy osobne
  miejsca (dashboard mount, dashboard `refreshOnResume` — główny hook odświeżający po
  powrocie appki na pierwszy plan, I zakładka Kalendarz własny `load()`/przycisk odśwież)
  gate'owały CAŁY fetch Google Calendar za `googleCalendarService.getStoredToken()`:
  `if (token) { fetchEvents()... }`. Problem: `fetchEvents()` MA WŁASNY fallback ("brak
  tokena w AsyncStorage → spróbuj cichego `GoogleSignin.getTokens()` → dopiero wtedy się
  poddaj") — ale zewnętrzny `if (token)` w tych trzech miejscach nigdy nie DAWAŁ mu szansy
  się uruchomić, bo w ogóle nie wołał `fetchEvents()` gdy `getStoredToken()` zwróciło `null`.
  Skoro raz (np. przez chwilowy problem sieciowy) `fetchEvents()`'s WEWNĘTRZNA obsługa 401
  (`refreshToken()` → jeśli i to zawiedzie, `clearToken()`) skasowała zapisany token — KAŻDE
  kolejne odświeżenie w CAŁEJ appce (dashboard przy starcie, dashboard przy powrocie z tła,
  zakładka Kalendarz) stawało się TRWAŁYM no-opem, bez żadnego komunikatu — jedyny sposób
  naprawy to nieoczywiste ponowne zalogowanie przez Google w Ustawieniach. Fix: wszystkie
  trzy miejsca wołają teraz `googleCalendarService.fetchEvents()` BEZWARUNKOWO — sama funkcja
  poprawnie obsługuje "brak tokena" (próbuje cichego odświeżenia, potem po prostu zwraca `[]`
  gdy naprawdę nie ma zalogowanego konta), więc zewnętrzny gate był czystą, szkodliwą
  duplikacją logiki którą sama funkcja już miała.
- **Praca — panel (`workPanel` modal) i kompaktowy kafelek dashboardu**: liczby (godziny/
  zarobek/stawka) liczone w `workMonthly` (`useMemo` w `index.tsx`) z `allEvents` (kalendarz
  lokalny + gcal), filtrowanych `isWorkEvent()` (kolor LUB prefiks tytułu, `workEvents.ts`).
  Osobno: `workPayMonths` (`computePayMonths`, `workSummary.ts`) — realne wypłaty (`Expense`
  typu `income` z tagiem/notatką prefiksu) połączone z godzinami kalendarza tego miesiąca,
  jedna wypłata = jeden miesiąc, wykluczalne w Ustawieniach → Praca.
  - **BUG: dzisiejsza zmiana liczyła się jako w CAŁOŚCI przepracowana od PÓŁNOCY, nawet
    godziny przed jej rozpoczęciem (2026-08-28, user: "jak dzisiaj mam pracę i jest przed
    pracą to jest jeszcze nie przepracowane jakby nie?")** — `workMonthly`'s pętla dzieląca
    `workedH`/`plannedH` sprawdzała tylko `day <= today` (data zmiany ≤ dzisiaj), bez
    względu na AKTUALNY czas zegarowy — zmiana "13:00-21:00" datowana dziś wpadała CAŁA do
    `workedH` już o 00:01, mimo że jeszcze się nie zaczęła. Fix: nowa `elapsedShiftHours(ev,
    now)` w `workEvents.ts` (czysta, testowana funkcja) — dla zmiany datowanej DOKŁADNIE
    dzisiaj liczy TYLKO część która faktycznie minęła (`clamp(now - start, 0, duration)`,
    ta sama matematyka co licznik "NA ŻYWO W PRACY" w `useWorkEarnings`, tylko podsumowana
    na cały dzień zamiast jednej aktywnej zmiany), zamiast całej długości. Dni PRZED dziś
    nadal liczą się w całości (bezpieczne — to przeszłość), dni PO dziś nadal w całości do
    `plannedH` (bez zmian). Obsługuje nocne zmiany (koniec przepychany za północ, jak
    `titleTimeRange`) — PRECONDITION: `now` musi być tego samego dnia kalendarzowego co
    start zmiany (zawsze prawda dla jedynego wołającego, `day === today` gate wyżej). Zmiana
    bez parsowalnego zakresu godzin w tytule (ani "HH:MM-HH:MM", ani znacznika "(Nh)") nie
    pozwala ocenić postępu → liczy się w całości (stare zachowanie, bezpieczny fallback).
    Testy: `__tests__/workEvents.test.ts`.
  - **Kolory — Praca to JAWNY wyjątek od monochromatycznego akcentu appki (2026-08-28,
    user: "teraz nawet tamtej zakladce chaos troche możesz więcej kolorów tam użyć")** —
    `WORK_ACCENT` był dawniej dosłownie `colors.text.primary` (czyli NIE kolor, tylko zwykły
    biały tekst) — cała karta (kafelek + duży panel) czytała się płasko, bez wizualnego
    rozróżnienia między "już przepracowane" / "zaplanowane" / "stawka". Reszta dashboardu
    ZOSTAJE monochromatyczna (świadoma decyzja usera z wcześniejszej sesji, komentarz przy
    stałej) — to WYŁĄCZNIE lokalny wyjątek dla Pracy. Trzy stałe, TYLKO w sekcjach Pracy:
    `WORK_ACCENT` (niebieski `#38BDF8`, tożsamość karty + "jeszcze przed nami"),
    `WORK_WORKED` (zielony `#34D399`, godziny już przepracowane/zarabiane — pasuje do
    istniejącej zielonej kropki "NA ŻYWO"), `WORK_MONEY` (złoty `#FBBF24`, stawka/zarobek —
    ten sam kolor co reszta appki na pieniądze, np. budżet dnia). Podział paska
    `workSplitBar` w kompaktowym kafelku: zielony = przepracowane, niebieski (PEŁNY kolor,
    nie wyblakła wersja tego samego odcienia jak wcześniej) = zaplanowane.
  - **Nowość: "zł/h ogółem" vs "zł/h ostatni miesiąc", BEZ zaokrąglenia (2026-08-28, user:
    "ile średnio na godzinę ogólnie ile średnio ze ostatniego miesiąca, bez zaokrąglone")**
    — `wm.rate` (główna liczba w `wpRateCard`) to JEDNA już-wybrana stawka (priorytet: ręczne
    nadpisanie > wypłaty > potwierdzone miesiące > kalendarz, patrz `useWorkEarnings`), user
    chciał zobaczyć OBA składowe osobno. Nowy wiersz pod `wpRateCard` (reużywa styl
    `wpLeftCard`/`wpLeftItem` z sekcji "ile zostało" — bez nowych styli w StyleSheet):
    `workAvg.avgRate` (Σzł ÷ Σh po wszystkich uwzględnionych miesiącach, `payMonthsSummary`
    w `workSummary.ts`, JUŻ było liczone, tylko nigdzie nie wyświetlane wprost) i realna
    stawka z NAJNOWSZEJ wypłaty (`workPayMonths[0].amount / .hours`) — obie do 2 miejsc po
    przecinku (`.toFixed(2)`, nie zaokrąglone do całości jak reszta karty).

## 5. Customowe widgety / metryki — `src/utils/statWidgets.ts`

- **`WIDGET_METRICS`**: lista `{ id, label, group, unit, viz[], periodic, needsTag? }`.
  Grupy: Finanse / Konsumpcja / Nastrój i zdrowie / Praca i zadania.
- **`metricNumber` / `metricSeries` / `metricList`** — liczą wartość/serię/ranking dla
  metryki z `StatCtx` (expenses, scope, moodEntries, healthDays, workEvents, tasks, …).
  Etykiety osi z `predsFor` → `monthLabel` (nazwa miesiąca) / `weekLabel` ("DD.MM" =
  poniedziałek tygodnia).
- **CAŁY system customowych kafelków 'stat' USUNIĘTY (data nieznana, przed tą sesją)** —
  user: "wywal system custom widgetów" (były "niedopracowane"). Dawny kreator
  `app/widget-builder.tsx` skasowany, `customTiles.filter(t => t.type !== 'stat')`
  wszędzie — renderer (`renderStatTile`) i cały silnik metryk w `statWidgets.ts` ZOSTAŁY
  (kompletne, działające), tylko martwe — nie było skąd stworzyć taki kafelek.
  - **WYJĄTEK: "Rok w pikselach" PRZYWRÓCONY, tylko TEN JEDEN viz (2026-08-24)** — user:
    "dodaj mi pixel year widget z możliwością wybrania czego". Nie przywrócono całego
    systemu (liczby/wave/donut/porównania zostają wywalone, zgodnie z pierwotną decyzją) —
    tylko `viz==='pixels'` (`YearPixels.tsx`, `PIXEL_METRICS`/`dailyValue`/`pixelTiers`
    poniżej). `isVisibleCustomTile` (`app/(tabs)/index.tsx`) zastąpił blankietowy
    `type !== 'stat'` filtrem `type !== 'stat' || viz === 'pixels'` we WSZYSTKICH miejscach
    (`orderedSections`, `reorderVisible`, `moveVisible`, pętla `nodes[t.id]`). Nowy picker
    (`pixelPickerOpen` state, modal mirror notatek-pickera, te same style `np*`) w edytorze
    dashboardu — przycisk "Dodaj kafelek: Rok w pikselach" listuje `PIXEL_METRICS` (spend/
    food/sweets/income/moodAvg/energyAvg/steps/sleepAvg/weight/tasksDone), tap tworzy
    `addCustomTile({ type:'stat', viz:'pixels', metric, title })`. To JEDYNE miejsce
    tworzące kafelki 'stat' — żaden inny wariant nie może już powstać.
  - **Zmiana roku na kafelku (2026-08-24)** — user: "w ustawieniach w personalizacji nie
    dałeś mi możliwości zmiany roku xdd" (picker przy tworzeniu wybierał tylko metrykę, rok
    był na sztywno `new Date().getFullYear()`). `CustomTile.year?: number` (opcjonalne,
    brak = bieżący rok — istniejące kafelki bez migracji). W `renderStatTile` strzałki
    ‹/› obok podpisu "Rok {year}" wywołują `updateCustomTile(t.id, { year: year ± 1 })`
    (pierwsze realne użycie tej akcji store'a — istniała, ale nigdzie nie była wołana).
    Strzałka w przód disabled przy `year >= currentYear` (nie da się zobaczyć przyszłości).
    `dailyValue()` jest w pełni datowana (filtruje po YYYY-MM-DD z już załadowanej pełnej
    historii) — zmiana roku nie wymagała żadnej zmiany w warstwie danych.
  - **Cache raz-na-dzień, w tle (2026-08-24)** — user: "ogólnie na wejście apki laguje", potem
    doprecyzował priorytety: EVENTY/KALENDARZ/ZADANIA/PUPIL/NAWYKI/KROKI/SEN/FINANSE +
    sprawdzenie z powiadomień bankowych mają zostać żywe, ale "widgety które mają np PIXEL
    YEAR kafelek [powinny] dziennie ładować raz na dzień w tle, tak samo inne nieistotne".
    Zdiagnozowane: `dailyValue()` skanuje CAŁĄ historię (expenses/tasks/health) DLA KAŻDEGO
    z 365 dni osobno — O(365×n) — i `YearPixels.tsx` MIAŁ już własny `useMemo` na to, ale był
    permanentnie zdefektowany, bo `valueFor` w `renderStatTile` to była ŚWIEŻA funkcja-domknięcie
    tworzona na KAŻDYM renderze (nowa referencja → `useMemo`'owy dep `[year, valueFor]` nigdy
    się nie zgadzał, więc 365-dniowy skan przeliczał się przy KAŻDYM, nawet niezwiązanym
    re-renderze dashboardu — jedyny prawdziwy "policz to na każdej klatce" hotspot w całym
    ~1400-liniowym bloku `nodes`; reszta sekcji już konsumowała POPRAWNIE zmemoizowane
    wartości typu `records`/`correlations`/`fvMonths`, więc problem był punktowy, nie
    wszechobecny). Fix: nowy `src/utils/dailyTileCache.ts` (`getDailyCached`/`setDailyCached`,
    AsyncStorage, klucz z dzisiejszą datą lokalną — przeżywa restart appki w tym samym dniu).
    `index.tsx`: `pixelTilesSig` (stabilny "odcisk palca" widocznych kafli pixels:
    id:rok:metryka) + `useEffect` na `[isLoading, pixelTilesSig]` (CELOWO BEZ `statCtx` w
    deps — inaczej odpalałby się przy każdym dodanym wydatku/zadaniu, dokładnie czego user
    chciał uniknąć; `eslint-disable-next-line react-hooks/exhaustive-deps`, ten sam wzorzec
    co istniejący przy `achStates`). 3s opóźnienia po `!isLoading` (finanse+zadania gotowe) —
    zdrowie/nastrój ładują się z osobnych efektów bez własnej flagi `isLoading`, więc bufor
    czasu zamiast dokładnego trackingu gotowości WSZYSTKICH źródeł dla WSZYSTKICH metryk.
    Wynik trafia do `pixelDayCache` (stan) — `renderStatTile`'s `viz==='pixels'` czyta stamtąd
    (`pixelCached[d] ?? 0`), z fallbackiem na żywe `dailyValue()` dopóki cache się nie wypełni
    (świeżo dodany kafel / pierwsze sekundy po starcie) — zmiana roku strzałkami (wyżej)
    zostaje INSTANT jak dawniej, bo trafia dokładnie w ten fallback zanim cache dogoni nowy
    rok. Testy: `__tests__/dailyTileCache.test.ts`. Świadomie NIE rozszerzone na pozostałe
    viz (`wave`/`donut`/`compare`, `metricSeries`/`metricList`) — te skanują ~6 kubełków
    zamiast 365 dni (~60× tańsze), więc ten sam mechanizm dałby dużo mniejszy zysk za dodaną
    złożoność; jeśli w przyszłości okażą się realnym problemem, ten sam wzorzec (klucz +
    `getDailyCached`/`setDailyCached`) da się powielić.
  - **Staged render — "nieistotne" sekcje czekają na drugą klatkę (2026-08-24)** — kontynuacja
    tego samego zgłoszenia lagu na wejściu. Nowy moduł-level `DEFERRED_SECTIONS: Set<string>`
    (góra `index.tsx`, przed komponentem) — ~24 sekcje historyczne/statystyczne/kolekcjonerskie
    (month-summary, weekly-insights, maintenance-reminders, pinned-notes, personal-records,
    trivia, reflections, time-capsule, year-ago, food-breakdown, shops-collection,
    gablota-card, sweets-vs-food, who-ate, fixed-variable, spend-by-day, work-hours,
    top-products, fun-facts, correlations, insights-web, mood-cal, mood-wave, month-tasks) +
    WSZYSTKIE kafle custom (id zaczyna się `custom:`, patrz `addCustomTile` w
    dashboardLayout.ts) — bez znaczenia "co dziś muszę zrobić" wg user'a. Reszta (payday/debt/
    bank-queue/bill/sub-confirm, pet, tag-limits/budget-warning/finances, tasks-work-row/
    today-tasks/countdowns, sleep-chart, counters-since/streak-wall/habits-nudge/habits-today,
    calorie-balance/daily-rings, stats-scope, gcal) renderuje się NATYCHMIAST jak dawniej.
    Nowy stan `deferredReady` (domyślnie `false`) ustawiany przez
    `InteractionManager.runAfterInteractions(() => setDeferredReady(true))` w efekcie na
    mount — odpala się zaraz po ewentualnych trwających animacjach/gestach, więc PIERWSZA
    klatka dashboardu buduje tylko "ważne" sekcje, reszta doskakuje milisekundy później.
    Gating w PUNKCIE KONSUMPCJI (`orderedSections.map` w normalnym trybie renderowania), NIE
    przy każdym z osobna `nodes[id] = ...` — jedna, łatwa do zweryfikowania zmiana zamiast
    24 rozrzuconych po całym bloku (edytor dashboardu — tryb drag-to-reorder — nietknięty,
    czyta tylko `SECTION_TITLES`, nie `nodes[id]`, więc pokazuje WSZYSTKIE sekcje zawsze).
    `deferredReady` ustawiany RAZ na całą sesję (nie resetuje się) — dotyczy tylko pierwszej
    klatki po starcie/wejściu na dashboard, nie kolejnych interakcji. Klasyfikacja część/
    część subiektywna (np. `pinned-notes`, `mood-cal`/`mood-wave`) — nic nie znika na stałe,
    tylko pojawia się chwilę później, więc błędna klasyfikacja to kosmetyka do poprawienia
    (edycja jednego `Set` literału), nie regresja. Bez dedykowanego testu — to zmiana
    zachowania renderu ekranu, nie logiki w `utils/` (ten sam wzorzec co inne zmiany
    layoutu w tej sesji: pełny `tsc`/`jest` jako bar, bez component-render testów, których
    ten projekt w ogóle nie ma).
  - **bestMoodWeek O(n²)→O(n) (2026-08-25)** — dalszy ciąg optymalizacji ("okej tylko teraz
    optymalizuj dalej"). Audyt pozostałych ~15 `useMemo` karmiących sekcje z
    `DEFERRED_SECTIONS` (funFacts/correlations/weightFacts/yearAgo/insightLinks/
    foodBreakdown/topProducts/shopsCollection) — wszystkie to pojedynczy przebieg O(n) po
    `expenses`, nie hotspot (celowo bez zmian, patrz NEXT_STEPS.md dla pełnego uzasadnienia).
    Realny hotspot: `bestMoodWeek()` w `src/utils/personalRecords.ts` (karmi `records` →
    kafel "Rekordy życiowe", sekcja `personal-records`) — dla KAŻDEGO zalogowanego dnia
    nastroju od nowa filtrowała CAŁĄ posortowaną listę dni (`days.filter(...)` w pętli po
    `days`), czyli O(n²); dla roku+ codziennych wpisów to setki tysięcy operacji, na
    KAŻDYM renderze dashboardu (memo zależy od `moodEntries`). Przepisane na dwuwskaźnikowe
    okno przesuwne (`left`/`right` po posortowanej liście, `windowSum` przyrostowo) — O(n),
    poprawne bo `days` jest posortowane rosnąco więc lewa krawędź 7-dniowego okna nigdy nie
    musi się cofać. Testy: `__tests__/personalRecords.test.ts` porównują wynik z naiwną
    referencyjną implementacją oryginalnej logiki (gęste dni, dni z lukami >6 dni, 15×
    losowe zestawy) — pilnują że algorytm daje TEN SAM wynik, nie tylko że działa.
- `isSelfTransfer(e)` (statWidgets) = przelew własny (kategoria `transfer` lub tag
  oszczednosci/przelew/revolut) — wykluczany ze spend I z przychodów, liczony w metryce
  `savings` ("Odłożone (przelewy własne)" — TO NIE TO SAMO co usunięty dashboardowy kafel
  "Zaoszczędzone (kupony)" niżej, tylko przypadkowo ten sam angielski identyfikator).

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
- **Liczenie „ile razy kupione" MUSI sumować `it.quantity`, nie +1 za linię paragonu**
  (2026-08-26, user: „liczy ile razy coś kupiłem ale nie bierze pod uwagę ile sztuk na
  paragonie" — realny bug w 3 miejscach jednocześnie: dashboardowe `topProducts`
  w `app/(tabs)/index.tsx`, `metricList('topProducts'|'favSweets')` w `statWidgets.ts`
  i katalog `app/products.tsx`. Poprawny wzorzec już istniał w `exportAnalysis.ts`:
  `Math.max(1, Math.round(it.quantity || 1))`. Test regresji: `topProductsQuantity.test.ts`.
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

- **Auto-tagowanie rozpoznanych sprzedawców (2026-08-24)** — user: "jak mi dodało autopłatność
  z banku to chciałbym móc jej nadać że to jest opłata za internet, żeby mi łapało jak z
  wypłatą — hej jak widzisz tę automatyczną płatność od tego odbiorcy o tym tytule to [otaguj]"
  (screenshot: bank-matched wydatek "P4 Sp. o.o. Warszawa" bez tagów). `MerchantInfo` (w
  `merchantMemory.ts`, ten sam store co uczenie kategorii) dostał opcjonalne `tags?: string[]`
  + nowa funkcja `saveMerchantTags(storeKey, tags, name?)` — NADPISUJE (nie dokleja) tagi,
  NIE rusza liczników zaufania kategorii (`cleanAccepts`/`auto`), zero okresu "nauki" (w
  przeciwieństwie do kategorii, która potrzebuje `AUTO_THRESHOLD` czystych akceptacji zanim
  zacznie księgować automatycznie — tagi to jednorazowa, świadoma decyzja z ekranu wydatku,
  działa od NASTĘPNEJ pasującej płatności). `app/expenses/[id].tsx handleSave()`: obok
  istniejącego "ucz kategorii" (linia z `saveMerchant`, odpala się gdy kategoria się zmieniła)
  analogiczny blok dla tagów — odpala się gdy `tags` różni się od `expense.tags`, zapisuje pod
  tym samym `storeKey` (pierwsze słowo `storeName`, lowercase — identyczny klucz co parser
  powiadomień). `bankIngest.ts`: w gałęzi wychodzącej (`tx.direction !== 'in'`) po
  `merchantFor(tx.storeKey, mem)` doklejone `...(learned?.tags?.length ? { tags: learned.tags
  } : {})` do `store.enqueue()` — `PendingBankTx.tags` już istniało (self-transfer → `
  ['revolut']`) i już płynęło do końca przez `bankCommit.ts` (`tags: p.tags ?? []` przy
  tworzeniu wydatku) — WYSTARCZYŁO wypełnić je z pamięci sprzedawcy, żadnej nowej ścieżki
  danych. Test: `__tests__/merchantMemory.test.ts` (nowe opisy `saveMerchantTags`).

## 7b. Paragon → wydatek (skan/wklej) — `src/utils/receiptParser.ts`, `app/expenses/scan.tsx`

`parseReceiptText(text)` routuje po `storeKeyFromText` do `parseKaufland`/`parseBiedronka`/
`parseGeneric` (Lidl i reszta lecą przez `parseGeneric` — Lidl NIE ma osobnej gałęzi w
switchu). Każdy zwraca `{products[], subtotal, total, totalDiscount, paymentMethod}` —
`scan.tsx` pokazuje `Razem: {total}` i ostrzega (`mismatchBadge`) gdy `|subtotal-total|>0.05`
("Suma produktów X zł < kwota na paragonie — mogły zostać pominięte pozycje" itp.).

- **Zwrot kaucji** (`DEPOSIT_RETURN_RE`) trafia do `products` jako pozycja `kind:'deposit'` z
  UJEMNĄ `finalPrice` — poprawnie odejmuje się od `subtotal`. Linie-nagłówki sekcji
  ("Opakowania zwrotne przyjęcia"/"...suma", `DEPOSIT_SECTION_TOTAL_RE`) są POMIJANE, żeby nie
  policzyć zwrotu podwójnie.
- **BUG + FIX (2026-08-20, user przesłał realny paragon Lidl): `total` mógł być WYŻSZY niż
  realnie zapłacona kwota, gdy paragon miał zwrot kaucji.** Lidl (i inne) drukują "SUMA PLN"
  jako sumę towarów PRZED odjęciem zwrotu kaucji, a finalną, po korekcie kwotę (ta sama co
  przy "Płatność ... Karta płatnicza") jako OSOBNĄ, PÓŹNIEJSZĄ linijkę "Suma". Stare
  `totalPatterns` (w `detectTotal()` i osobno, prawie identyczne, w `parseGeneric()`) łapały
  PIERWSZE dopasowanie w całym tekście przez `text.match()` — "SUMA PLN" wygrywało, dając
  `total` zawyżony o dokładnie kwotę zwrotu kaucji (np. 29,66 zamiast realnych 23,66), co
  fałszywie odpalało "mogły zostać pominięte pozycje" mimo że WSZYSTKIE pozycje były poprawnie
  wykryte. Fix: nowy `detectPaymentTotal()` — linia "Płatność ... <kwota>" (metoda płatności +
  kwota) to zawsze NAJBARDZIEJ wiarygodna, finalna kwota (dosłownie ile zapłacono, uwzględnia
  KAŻDĄ korektę z paragonu) — sprawdzana PRZED resztą wzorców w obu miejscach
  (`detectTotal`/`parseGeneric`), z fallbackiem do starych wzorców gdy nie znajdzie linii
  "Płatność" (np. wyblakły/nietypowy paragon). Testy: `__tests__/receiptParser.test.ts`
  (pełny tekst realnego paragonu Lidl usera jako fixture).
- **Kaufland app "Receipt copy" — DRUGI, osobny format obok OCR-ze-zdjęcia (2026-08-27,
  user: "mamy że wykrywa Kaufland to niech łapie taki paragon" + wklejony tekst z ekranu
  Kaufland app paragon → "..." → "Receipt copy").** Byte-exact tekst z apki, NIE OCR — inny
  layout niż stary `parseKaufland` (tam: NAZWA w linii, CENA w następnej). Tu: nagłówki
  kategorii ("Beauty / Zdrowie / Dziecko", "Lada z obsługą") przeplatają się z pozycjami;
  pozycja to "NAZWA ... CENA LITERA" w jednej linii, albo NAZWA osobno + "ilość * cena ...
  suma LITERA" (multi-buy) / "waga KG ... suma LITERA" (towar luzem) w następnej linii —
  odróżnione od nagłówka kategorii przez lookahead (nagłówek nigdy nie ma po sobie samej
  kontynuacji ceny). Nowa gałąź `parseKauflandReceiptCopy()`, wykrywana po unikalnym
  nagłówku kolumny "Cena PLN" (`isKauflandReceiptCopy()`), wywoływana z góry `parseKaufland()`
  — stary OCR-owy branch zostaje nietknięty jako fallback. Promocje na kasie ("Kup 2 płać za 1
  -11,97" + "Pozycje:3,4") dotyczą kilku pozycji naraz przez referencje indeksów (1-indexed,
  kolejność na paragonie) — rozdzielane proporcjonalnie do BIEŻĄCEJ ceny na produkty, które
  wskazują (patrz bug niżej, 2026-08-28, dlaczego to MUSI trafiać na konkretne pozycje a nie
  do osobnego pola).
  - **BUG PRZY OKAZJI: wykrywanie sklepu potrafiło w ogóle nie złapać "Kaufland"** — apka
    wstawia własne kody drukarki sklejone BEZ SPACJI wprost przed nazwą ("&1Kaufland Polska
    Markety..."), co psuje granicę słowa `\bkaufland\b` (cyfra "1" i litera "K" to oba znaki
    "słowa" — bez separatora `\b` między nimi nie ma). Na pełnym paragonie zwykle i tak
    wychodziło na swoje (inne, poprawnie oddzielone wystąpienia "Kaufland" niżej w tekście —
    "Kaufland Card XTRA", stopka), ale na krótszej wklejce (np. bez stopki) zawodziło całkiem,
    cicho lądując w `parseGeneric`. Fix: nowa `stripPrintMarkup()` ścina WSZYSTKIE `&N` na
    samym wejściu do `parseReceiptText()`, przed routingiem — no-op dla każdego innego
    formatu/sklepu (nikt inny tej notacji nie używa). Testy: `__tests__/receiptParser.test.ts`
    (pełny tekst realnego paragonu Kaufland usera jako fixture, 7 nowych testów).
  - **BUG DRUGI, dzień później: "źle mi złapało produkty" (2026-08-28, user ze screenshotem
    ekranu skanowania)** — banner "Suma produktów (197,94 zł) > kwota na paragonie — brakuje
    rabatów lub produktów", mimo że WSZYSTKIE 10 pozycji i `total` (159,97) były poprawne.
    Przyczyna: pierwsza wersja tego parsera (wpis wyżej) liczyła `subtotal` wprost z "Suma
    cząstkowa" (197,94, PRZED rabatami) i sumowała promocje TYLKO do osobnego pola
    `totalDiscount` (37,97) — ale `app/expenses/scan.tsx` (mismatch banner ORAZ live suma
    "Zaznaczone" na dole ekranu) nie zna `totalDiscount` w ogóle, tylko sumuje
    `products[].finalPrice` i porównuje z `total` — DOKŁADNIE tak samo jak reszta parserów w
    tym pliku (`parseGeneric` odejmuje rabat WPROST od `lastProduct.finalPrice`, nigdy do
    osobnego pola — patrz też zwrot kaucji na Lidlu, ten sam wzorzec: `subtotal` MUSI już mieć
    korekty wliczone w poszczególne pozycje). Fix: nowa pętla po "Pozycje:N,M" — każdą
    promocję rozdziela PROPORCJONALNIE do BIEŻĄCEJ ceny referowanych produktów (ważne przy
    kilku promocjach na tym samym produkcie — kolejne liczą się od ceny PO poprzedniej), z
    resztą zaokrąglenia (grosze) dokładaną do OSTATNIEJ referowanej pozycji żeby suma była
    zawsze dokładna; ustawia `finalPrice`/`discount`/`promotion` per-produkt (ten sam kształt
    co `parseGeneric`). `subtotal` liczony TERAZ z sumy (już poobniżanych) `finalPrice`,
    matematycznie równy `total`. Na fixture usera: "Rabat -12,00"→Pozycje:2 (Papier ksero,
    pojedyncza pozycja, cała kwota) / "Cena z kartą -12,00"→Pozycje:7,8 (dwa CifSpray o równej
    cenie, po 6,00) / "Kup 2 płać za 1 -11,97"→Pozycje:3,4 (teczki w proporcji 2:1 wg ceny,
    7,98/3,99) / "Kupon XTRA -2,00"→Pozycje:10 (Kiwi, cała kwota) — sumuje się dokładnie do
    159,97. Testy rozszerzone o osobne przypadki dla alokacji 1-do-1 i rozłożonej na kilka
    pozycji (`__tests__/receiptParser.test.ts`, 16 testów w tym pliku łącznie teraz).

- **Tagi produktów — pamięć per-nazwa + wspólna częstość (`productMemory.ts`: `loadTagMemory`/
  `saveTagMemory`/`getTagFrequency`).** `TagMemory` = `Record<nazwa produktu, tags[]>` — po
  zapisaniu paragonu tagi każdego produktu zapamiętują się POD JEGO NAZWĄ (`saveTagMemory`),
  więc następnym razem ten sam produkt ("Papier ksero") dostaje swoje tagi automatycznie
  (`applyTagMemory`, przy wczytaniu nowego paragonu). `getTagFrequency()` liczy Σ wystąpień
  KAŻDEGO tagu po całej pamięci (nie per-produkt) → to właśnie ten zbiór, posortowany po
  częstości, wypełnia listę do wyboru w `TagPicker` (obok wbudowanych `ITEM_TAGS`) — czyli
  własny tag użyty RAZ na jakimkolwiek produkcie staje się wybieralny dla KAŻDEGO innego
  produktu przy KOLEJNYM skanowaniu.
  - **BUG: własny tag się duplikował (2026-08-28, user ze screenshotem "Wydatek": "art.
    biurowe" x2 na jednej pozycji — "jak dodaje wlasny tag na paragonie to on sie duplikuje
    nie wiem czemu").** Ten sam bug w DWÓCH osobnych implementacjach — `TagPicker` w
    `scan.tsx` (ekran PRZED zapisem) i `ItemEditor` w `app/expenses/[id].tsx` (edycja
    pozycji PO zapisie, ekran ze screenshota) — obie miały `TextInput` z `onSubmitEditing`
    ORAZ `onBlur` spiętymi z tą samą funkcją dodającą tag. Naciśnięcie "gotowe" odpala
    `onSubmitEditing`, a zamknięcie klawiatury zaraz po tym odpala `onBlur` — OBA domykają
    się nad TĄ SAMĄ, jeszcze nie wyczyszczoną wartością pola (React nie zdążył jeszcze
    przerenderować z `setCustom('')` z pierwszego wywołania), więc oba wołają dodanie tego
    samego tagu → dublet. Fix: `addingRef` (ref, nie state — musi być SYNCHRONICZNY w
    obrębie jednego ticka) blokuje drugie wywołanie w tej samej "turze"; reset przez
    `setTimeout(...,0)` na następny tick, żeby kolejny, GENUINE nowy tag dało się dodać
    normalnie. Zastosowane w OBU miejscach (dwa niezależne komponenty, nie da się
    wydzielić bez większego refaktoru UI). Dodatkowo, żeby istniejące już zduplikowane dane
    (jak na screenshocie usera) wyglądały czysto BEZ ręcznej edycji: stan `tags` w
    `ItemEditor`/edytorze całego wydatku inicjalizowany przez `[...new Set(...)]`, a
    read-only lista tagów produktu w `[id].tsx` (`it.tags.map`) renderowana przez
    `[...new Set(it.tags)].map`.
  - **Druga część tej samej wiadomości: "nie mam opcji oddania go na stałe, żebym mógł sobie
    dodac tag na inne kategorie"** — nowy własny tag BYŁ już trwale zapisywany (przez
    `saveTagMemory` przy zapisie paragonu), ale `tagFreq` w `scan.tsx` ładował się TYLKO RAZ
    przy montowaniu ekranu (`useEffect(() => { getTagFrequency().then(setTagFreq) }, [])`) —
    więc nowy tag dodany do produktu A w TRAKCIE tego samego skanowania nie pojawiał się
    jako opcja dla produktu B na TYM SAMYM ekranie, dopiero po ponownym otwarciu skanera.
    Fix: nowy callback `onNewCustomTag` przekazywany w dół przez `ProductRow`/
    `CustomProductRow` do `TagPicker` — gdy `addCustom()` doda GENUINE nowy tag (nie
    wbudowany, jeszcze nie w `freq`), od razu dopisuje go do `tagFreq` w rodzicu
    (`setTagFreq(prev => ({...prev, [tag]: (prev[tag]??0)+1}))`), więc staje się wybieralny
    dla wszystkich pozostałych produktów NATYCHMIAST, w tej samej sesji skanowania.

## 8. Zdrowie / Health Connect

- `healthConnectService.ts` (natywny odczyt), `healthAutoSync.ts` (`autoSyncHealth(days,
  force)` — cache per-dzień `health_YYYY-MM-DD`; `force` omija throttle 10 min).
  Dashboard forsuje TYLKO na wejściu do appki (cold start + resume), nie na każdy tab-focus.
- `healthHistory.ts` `getHealthHistory(n)` = jeden `multiGet` (sen/waga/kroki/**burn**).
  `dailyBurnFromHc(hc)` = dzienne całkowite spalanie (total ≥1200, inaczej BMR+aktywne) —
  wspólne dla karty energii w Zdrowiu i kafelka kalorii w Jedzeniu. Zegarek = źródło
  prawdy; tylko wagę można nadpisać ręcznie. Uprawnienia w app.json (patrz §11).
- **`leanMassKg` etykietowane "masa mięśniowa" — BŁĘDNIE (2026-08-21, user zauważył sumę
  60.2kg+44.1kg=104.3kg > jego wagi 71.2kg: "przecież tam jest 60kg mięśni wpisane plus 40kg
  wody co wychodzi ponad 100kg jak ja ważę 72")** — dane były poprawne, tylko etykieta. Health
  Connect's `LeanBodyMassRecord` (czytane w `readHealthDay()`, `healthConnectService.ts`) to
  masa BEZTŁUSZCZOWA (waga MINUS tłuszcz — mięśnie+kości+narządy+woda RAZEM), NIE osobne
  "skeletal muscle mass" które Samsung Health pokazuje we własnym UI (32.9kg w screenshocie
  usera vs 60.2kg z Health Connect — Health Connect nie ma osobnego typu rekordu na samo
  mięśnie). Etykieta "masa mięśniowa" sugerowała że to coś ROZŁĄCZNEGO z wodą (stąd próba
  zsumowania obu i wyjście ponad realną wagę) — poprawione na "masa beztłuszczowa" w 3
  miejscach `health.tsx` (kafel w karcie CIAŁO, tile w rozwiniętym dniu, etykieta ręcznego
  wpisu). Sam `leanMassKg` (nazwa pola, komentarz w interfejsie) i logika odczytu BEZ ZMIAN —
  to czysto etykietowy fix, dane z Health Connect są tym czym zawsze były.
- **Odkrywalność sync + kolorowe kafelki + zbity widget wody (2026-08-24)** — user: (1)
  "dodaj ze tam ukryty jest ten przeciągnij w dół aby zsynchronizować", (2) "te małe
  kafelki dodaj im tło odpowiadające ikonie, ikony daj wypełnione", (3) "ten widget wody
  zrob ładniejszy i mniejszy bardziej zbity tylko z dodaj, a po kliknięciu otwiera sie z
  edycja cupsize lub cofnij dodanie". (1): sama funkcja (`RefreshControl`) już istniała,
  ale wskazówka pod headerem była gołym 11px wyciszonym tekstem z ujemnym marginesem —
  łatwo przegapić. Dołożona ikona `ChevronDown` + pigułkowy layout (`s.syncHint`), treść/
  akcja bez zmian. (2): 5 kafelków "Today at a glance" (`summaryRow`) miało jednolite szare
  tło niezależnie od koloru ikony i ikony bez `fill` — każdy kafelek dostał własny
  `backgroundColor`/`borderColor` = kolor ikony przy niskiej krycie (wzorzec `color+'18'`/
  `'40'` z reszty apki) + `fill={kolor}` na ikonie. Kroki dostały WŁASNY niebieski akcent
  (`#38BDF8`) zamiast prawie-białego `T.accent` (biały na 18% wyszedłby jako szarość, nie
  kolor). (3): dawny widget wody miał 158px `WaterGauge` + osobne przyciski minus/plus +
  osobną pigułkę "cel". Nowy: mały 52px gauge BEZ wewnętrznego tekstu (`WaterGauge` dostał
  nowy `showText?: boolean` prop, domyślnie `true` — jedyne inne wywołanie zostaje bez
  zmian), JEDEN wyraźny przycisk "Dodaj". Nagłówek (osobny `TouchableOpacity`, SIBLING
  względem przycisku Dodaj, nie zagnieżdżony — nested Touchable-w-Touchable w tym repo już
  wymagał `stopPropagation` gdzie indziej, index.tsx) otwiera TEN SAM `waterCfgOpen` sheet
  co wcześniej (edycja celu/rozmiaru kubka), który dostał NOWY przycisk "Cofnij ostatnie
  dodanie" (`bumpWater(-1)`, ukryty gdy `water<=0`) — realizuje "edycja cupsize LUB cofnij
  dodanie" w jednym miejscu zamiast osobnego stałego przycisku minus na głównym ekranie.
  Osierocone przez redesign: `Minus` import, style `waterBody`/`weightBtn`/`waterSub`
  (jedyne miejsca użycia usunięte) — sprzątnięte w tym samym ruchu.

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
  zamrożenie / ekwipunek / perki bossów (najrzadsze, patrz "Przemianowane na perki..." niżej w
  tej sekcji) / monety (50-300% kosztu skrzynki); droższa = lepsze szanse. Odsłona `components/pet/BoxRevealModal.tsx`
  (❄ zamrożenia lecą z boków). Reużywa `spendCoins`/`buyItem(id,0)`/`addCoins`/`addFreezes` — bez zmian w petStore.
- **Ograniczenie RN:** animować tylko transformy wrappera `Animated.View` (native driver);
  animacja propów SVG stutteruje. RN nie ma transform-origin → piwot = translate→rotate→translate.
- **AnimatedSplash** używa CatArt (nie PNG) — te same ID/rozmiar co natywny splash, start
  na pełnej widoczności (bez fade-in), żeby statyczny obrazek płynnie „ożył".
- **Pręgi na łapkach znikały podczas animacji liźnięcia/swata (2026-08-21, user: "jak liże
  łapkę to jak mam paski na łapkach to one z jednej łapki znikają na czas animacji a po niej
  wracają")** — uniesiona lewa łapka (lick/swat) renderuje się w OSOBNYM overlay'u POZA
  głównym `<Svg>` (patrz komentarz "The raised foreleg lives OUTSIDE the SVG" w pliku, RN-owy
  pivot-trick translate→rotate→translate), bo tylko tak da się ją animować native-driverem.
  Statyczna łapka w spoczynku (główny SVG) chowa się pod `!armOut` na czas animacji — poprawnie,
  żeby nie renderować dwóch łap naraz — ale jej `legStripes` (3 poziome `Rect`) nigdy nie były
  skopiowane do overlay'u z uniesioną łapką, więc przez czas animacji łapka była bez pasków.
  Fix: te same 3 `Rect` (ten sam lokalny układ współrzędnych, x=779) dodane do overlay'u,
  warunkowo pod `legStripes`.
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
    - **PNG zamiast generycznych ikon lucide + 4. typ `'fire'` + więcej bossów z pazurami**
      (2026-08-26, user: "ta pięść jest zdecydowanie za często... atak pięścią nie rób
      własnej masz tam w BOSSATTACK... to te pazury co masz zrobić bo nie wiem czy to
      wykorzystujesz... tutaj masz customowe typowo pod pirata, ale można też pod samuraja").
      `assets/ikonybosów/BOSSATTACK_*.png` (fist/claw-marks/magicspell/pirateattack_blade/
      FIRE) leżały w repo od 13.08 NIEUŻYWANE — kontratak renderował zamiast nich generyczne,
      kolorowane ikony lucide (`HandFist`/`HandGrab`/`Sparkles`/`Sword`, `COUNTER_ICON`/
      `COUNTER_COLOR` w `boss-fight.tsx`). Nowy `ATTACK_PNG`/`FIST_PNG`/`attackPng()` w
      `bossIcons.ts` (ten sam plik/wzorzec co `BOSS_PNG` dla portretów, PNG require() —
      screen-only, nigdy importowane przez testy) — `boss-fight.tsx` renderuje teraz
      `<Image source={attackPng(target?.attackKind)} .../>` w OBU miejscach (latający pocisk
      i burst pazurów na portrecie kotka), `COUNTER_ICON`/`COUNTER_COLOR`/`CounterIcon`/
      `counterColor` i importy `HandFist`/`HandGrab`/`Sparkles`/`Sword` z lucide USUNIĘTE
      całkowicie — bez tintowania kolorem, PNG to już gotowa, narysowana grafika. Sword
      (jedyni dwaj bossy: piratecapitan/samurai) dzieli JEDEN plik
      `BOSSATTACK_priateattack_blade.png`, zgodnie z sugestią usera. Nowy CZWARTY
      `AttackKind` = `'fire'` (`BOSSATTACK_FIRE.png`) — TYLKO smok (`dragon`, user: "SMOK
      niech ogniem lub kulą ognia rzuca"), reszta rosteru NIE dostała fire automatycznie.
      Dodatkowo przypisane `claw` tam gdzie wcześniej była fallbackowa pięść: wąż kampanii
      (`snake`), ara (`mb_macaws`) i wąż questowy (`mb_snake`) w minibossach — user explicite
      wymienił te dwa zwierzaki po komentarzu że pięść wypada za często.
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
    - **Raid przeszedł na wspólną czerwoną pulę z wydarzeniami (2026-08-22)** — user: "ogarnąłeś
      zeby raid ten korzystał z czerwonej energii?", zapytany o zakres wybrał "realne
      połączenie z pulą eventów" (nie tylko kosmetyczny kolor ikony). Dawna, własna
      `raidEnergy`/`raidEnergyDate`/`raidEnergyToday` w `petStore.ts` (interfejs, initial
      state, `reset()`, `persist` partialize) oraz akcja `syncRaidEnergy` — CAŁKOWICIE
      USUNIĘTE. `raidAttack()` teraz dekrementuje `eventEnergy` zamiast `raidEnergy`;
      `app/bosses.tsx`'s `reload()` już nie woła `syncRaidEnergy` (jeden `syncEventEnergy`
      zasila obie); `app/boss-fight.tsx`'s `pool` (gate "czy stać mnie na próbę") scalone —
      `kind==='raid'` spada teraz do tej samej gałęzi co `kind==='event'`. Mini-karta raidu w
      `bosses.tsx` (ikona `Zap` + liczba) przefarbowana z niebieskiego `#38BDF8` (kolor
      kampanii — mylące, sugerowało błędnie że raid dzieli pulę z kampanią) na czerwony
      `#F87171` (kolor wydarzeń), pokazuje teraz `eventEnergy` zamiast (usuniętej) `raidEnergy`.
      **Świadomy kompromis balansu, NIE dociążony**: `eventDailyAttempts()` (dzienny grant tej
      puli) NIE został podniesiony żeby zrekompensować nowego konsumenta — user poprosił o
      połączenie pul, nie o zmianę ich wielkości, więc gracz grający regularnie w OBA (raid +
      wydarzenie) będzie miał łącznie mniej prób dziennie niż wcześniej (dawniej dwie osobne
      pule, teraz jedna dzielona). Do obserwacji po świeżym teście — patrz NEXT_STEPS.md.
    - **Raid: DRUGI redesign — prawdziwa walka wobec REALNEJ puli zamiast sesji-proxy
      (2026-08-25)** — user zagrał sesyjny model wyżej realnie i zgłosił: "realnie zagrałem i
      mi mimo połowy ponad HP przerwało". Sesja-proxy DZIAŁAŁA jak zaprojektowano (kończyła się
      po ~`RAID_SESSION_HITS`=6 ciosach niezależnie od realnej wielkości pozostałej puli), ale
      to zaprojektowanie nie pasowało do zamiaru usera: "chciałem żeby RAIDY... miały dużo hp
      względem poziomu kotka (resetuje się co tydzień)... kotek walczy do końca, tyle ile mu
      zostawi tyle zostawi, ale kotek nawet jak przegra to HP bossa zostaje tyle ile po
      ostatnim ciosie". Rozwiązanie PROBLEMU U ŹRÓDŁA (nie kolejny hack sesji): `Boss.
      counterHp?: number` (nowe, opcjonalne pole w `bosses.ts`) — `counterDamage()` woła
      `boss.counterHp ?? boss.hp` zamiast zawsze `boss.hp`, ROZDZIELAJĄC "ile HP ma boss" (do
      zbijania, win-condition) od "jaka skala % liczy kontratak" (dawniej ten sam argument
      wymuszał sesję-proxy, żeby surowa, wielotysięczna pula nie zabijała kotka jednym
      kontratakiem). `raidAsBoss(raid, hp, counterHp)` (nowa sygnatura, trzeci argument) —
      `hp` = `raidRemaining` WPROST (realna pula, nie proxy), `counterHp` =
      `raidCounterHpFor()` (przemianowane z `raidSessionHpFor` — ta sama formuła `atkPower ×
      RAID_COUNTER_HITS`, już nie "sesja"). Efekt: walka realnie zbija prawdziwy pasek rajdu
      KAŻDĄ rundą (`liveBossHp` w `boss-fight.tsx` to teraz WPROST `round.bossHpAfter`, ŻADNEGO
      przeliczania sesja→realna skala — usunięty cały `raidRealHp`/`realDead` hack, który
      wcześniej istniał specjalnie po to, żeby ucinać "fikcyjne" rundy sesji po realnym
      zabiciu), kończy się naturalnie przez `simulateFight`'s `if (bossHp<=0 || catHp<=0)
      break` (jak kampania), NIE przez sztywny limit rund. `raidAttack()` w `finish()` woła się
      TERAZ ZAWSZE (win/loss/wyczerpanie sufitu rund) z realną deltą
      (`raidRealStart - result.bossHpLeft`) — w `petStore.ts` `raidAttack()` po prostu odejmuje
      realne obrażenia od `raidHp`, niezależnie od wyniku, więc PRZEGRANA NIE ZERUJE POSTĘPU
      (w odróżnieniu od kampanii, gdzie przegrana resetuje HP bossa do pełna). Raid dostał
      PIERWSZY RAZ realny stan porażki: `defeatTarget` (dawniej pomijał `kind==='raid'`
      całkowicie — modal przegranej otwierałby się kompletnie PUSTY, `defeatTarget &&`
      warunkuje całą wewnętrzną treść) teraz go zawiera; komunikat przegranej dla raidu jest
      INNY niż reszta trybów ("obrażenia zostają, pasek nie wraca do pełna" zamiast "HP
      resetuje się") — świadoma rozbieżność z resztą UI, bo semantyka faktycznie inna. Koszt
      energii podniesiony do `RAID_ENERGY_COST=2` (było 1, user: "zmieńmy licznik czerwonej
      energii na 2 zamiast 1" — dłuższa, prawdziwa walka niż dawna krótka sesja), stała
      wyeksportowana z `raid.ts` i zaimportowana w `petStore.ts`/`boss-fight.tsx`/`bosses.tsx`
      (mini-karta rajdu: przycisk WALCZ wyszarzony już przy `eventEnergy < 2`, nie dopiero przy
      `<= 0`). **Nemesis (event `kind==='menace'`) ŚWIADOMIE NIE DOSTAŁ tego samego fixu** —
      ma identyczną architekturę (`menaceSessionHpFor`/`menaceAsBoss`, ten sam problem z
      `counterDamage()` od surowego hp), ale user zgłosił problem tylko dla raidu; ten sam
      `counterHp`-wzorzec da się powielić 1:1 gdyby zgłosił analogiczny problem tam. Testy:
      `__tests__/raid.test.ts` przepisany pod nowe API — w tym test że mała, prawie wyczerpana
      pula da się realnie dobić do zera w JEDNEJ próbie (dawniej niemożliwe do sensownego
      przetestowania, bo sesja nigdy nie widziała realnej puli).
      - **BUG: pełny ekran walki (`boss-fight.tsx`) NIE dostał tego samego fixu co mini-karta
        wyżej (2026-08-28, user ze screenshotem: "mimo że mam energię nie mogę zawalczyć" —
        pigułka u góry pokazywała "1", przycisk WALCZ! wyglądał w pełni aktywny).** `attack()`
        już POPRAWNIE blokował próbę (`pool < cost`, `cost = RAID_ENERGY_COST` dla raidu) i
        pokazywał toast — ale wyłącznie mini-karta w `bosses.tsx` dostała wizualny fix z
        akapitu wyżej; sam ekran walki nadal liczył `target.energy <= 0` zarówno na przycisku
        (`disabled`/`opacity`) JAK I na pigułce energii w headerze — czyli z 1⚡ (< kosztu 2)
        WALCZ! wyglądał normalnie klikalny, a po kliknięciu nic się nie działo poza łatwym-do-
        przegapienia toastem. Fix: `Target` (unia typu w `boss-fight.tsx` opisująca cel walki
        niezależnie od trybu) dostał nowe pole `energyCost` (1 domyślnie, `RAID_ENERGY_COST`
        dla raidu) — JEDNO źródło prawdy używane w trzech miejscach: `attack()`'s `cost`
        (usuwa zduplikowane `kind === 'raid' ? RAID_ENERGY_COST : 1`), przycisk WALCZ!
        (`disabled`/`opacity` na `energy < energyCost`, nie `<= 0`), i pigułka energii w
        headerze (pokazuje "1/2" zamiast samego "1" gdy koszt > 1). Dodatkowo nowy tekst pod
        przyciskiem ("Potrzeba 2⚡, masz 1") i doprecyzowany toast przy próbie ataku z
        niewystarczającą (ale niezerową) energią — zamiast mylącego "brak prób, wróć jutro"
        (które sugerowało zero, nie "za mało na TĘ walkę").
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
    - **BUG: 8 z 22 bossów pokazywało "undefinedundefined"** (2026-08-19, user przesłał
      screenshot listy kampanii) — `h` w `mysteryBossName` jest wymuszone na unsigned 32-bit
      przez `>>> 0` w pętli hasha, ale `(h >> 4)`/`(h >> 8)` (SIGNED shift, nie unsigned) z
      powrotem przeliczały go na signed int32 (ToInt32) przed przesunięciem — dla ~połowy
      wartości hash (gdy bit 31 ustawiony) wynik wychodził UJEMNY (arytmetyczny shift
      rozciąga znak), a `(ujemna) % 14` w JS zostaje ujemne (JS zachowuje znak dzielnej, nie
      zawija jak Python) — `MYSTERY_GLYPHS[ujemny_indeks]` w JS zwraca `undefined`, nie
      zawija się na koniec tablicy. Fix: `>>>` (unsigned shift) zamiast `>>` na obu liniach —
      zweryfikowane node'em, że dokładnie te same 8 bossów z zepsutego kodu (dragon/scroll/
      stress/procrast/jaguar/piratecapitan/princess/wizard) teraz daje poprawne 3 symbole.
      Nowy test w `bosses.test.ts` przechodzi CAŁY roster + 200 syntetycznych id, sprawdzając
      brak `"undefined"` w wyniku — stare testy (tylko `sloth`/deterministyczność/brak
      prawdziwej nazwy) przypadkiem NIE łapały tego, bo nie sprawdzały treści wyniku wprost.
    - **Pokonani bossowie zwijani domyślnie** (2026-08-20, user: "bossy te pokonane sa
      zwinięte w liscie") — kampania rośnie do 22 bossów, im dalej user zajdzie, tym dłuższa
      lista identycznych pełnowymiarowych "Pokonany ✓" wierszy PRZED aktualnym/zablokowanymi
      (user właśnie doszedł do 10/22, lista scrollowała się bez końca zanim dotarłeś do
      "current"). Bossy pokonane są ZAWSZE ciągłym prefiksem `BOSSES` (kampania leci
      sekwencyjnie, `current = BOSSES.find(b => !defeatedBosses.includes(b.id))`), więc lista
      dzieli się RAZ na `defeatedList`/`restList` przez `currentIdx`, zamiast filtrować/gałęzić
      w pętli renderującej jak wcześniej. `defeatedList` chowa się pod jeden nagłówek
      "Pokonani bossowie (N)" (`s.collapseRow`, zielona obwódka jak `rowBadge`, `ChevronDown`/
      `ChevronUp` wg stanu) — nowy `useState defeatedCollapsed`, domyślnie `true` (zwinięte),
      tap toggle'uje. `restList` (current + locked) renderuje się bez zmian, zawsze widoczne —
      to one są tym co user faktycznie chce widzieć od razu po wejściu na ekran. Edge case:
      gdy `current===null` (cała kampania pokonana), `currentIdx=BOSSES.length`, więc
      `defeatedList` to WSZYSTKIE 22 a `restList` puste — nagłówek zwinięcia nadal działa,
      po prostu nic nie zostaje do pokazania pod nim.
    - **Re-zgłoszone jako "nadal nie ma" (2026-08-21)** — user: "bossy pokonane nadal nie mają
      zwijane zakładki". Kod z powyższego opisu jest NIETKNIĘTY od merge'a (git log potwierdza
      `app/bosses.tsx` ostatnio zmieniany TYLKO w tym PR-ze), więc `defeatedList.length > 0` /
      `s.collapseRow` istnieją dokładnie jak opisano — najbardziej prawdopodobne wyjaśnienie to
      stary zainstalowany APK (build sprzed tego mergea) ALBO świeży reset postępu pupila (jeśli
      `defeatedBosses` jest akurat puste w tej rundzie testowej, nagłówek słusznie się nie
      pokazuje — nie ma czego zwijać). Nie dotknięte ponownie w tym przejściu — brak
      potwierdzonego buga w kodzie do naprawienia; jeśli po świeżym buildzie z pokonanym co
      najmniej jednym bossem nadal nie widać nagłówka, to realny bug do dalszego śledztwa.
  - **Przełącznik Kampania/MAD + pigułki energii "X/max" + odliczanie w headerze** (2026-08-21,
    user: (2) "dodaj zeby byl przełącznik pomiędzy mad bosami a kampanijnymi" (3) "dodaj zeby
    bylo widać w prawym górnym licznik do następnej energii oraz ile na ile mam np 0/5"). (2):
    dawniej sekcje "Kampania" (do 22 wierszy) i "MAD bossy" stały jedna pod drugą na tym samym
    scrollu — dotarcie do MAD wymagało przewinięcia całej listy kampanii. Nowy `useState
    bossView: 'campaign'|'mad'` + segmented control (`s.modeToggle`, dwa `PressableScale` pół-
    na-pół) TUŻ NAD obiema sekcjami — każda owinięta w `{bossView === '...' && (<>...</>)}`,
    domyślnie `'campaign'`. Raid/wydarzenie (osobne tory, mini-karty na górze) i ściany medali
    NIE są częścią przełącznika — zostają zawsze widoczne, przełącznik dotyczy TYLKO dwóch
    heroCard+lista bloków kampanii/MAD. (3): pigułki w prawym górnym rogu pokazywały dotąd
    SUROWĄ liczbę energii bez sufitu (user: "widać... ile na ile mam np 0/5") — dołożony
    `eventEnergyMax = eventDailyAttempts(bonuses.energyMult)` (TA SAMA formuła co
    `syncEventEnergy` w `reload()`, jak `campaignEnergyMax` już wcześniej dla drugiej pigułki),
    obie pigułki renderują teraz `{energy}/{max}`. Odliczanie do kolejnego punktu energii
    kampanii (`fmtEnergyCountdown`, dotąd widoczne TYLKO w karcie bohatera kampanii — trzeba
    było przewinąć) dostało DRUGĄ kopię pod niebieską pigułką w headerze (nowy `s.
    energyCountdown`, mały wyciszony tekst), widoczną bez scrollowania. Kopia w karcie
    bohatera ZOSTAJE — redundancja celowa, ten sam wzorzec co "Wróć natychmiast"/pasek misji
    w `pet.tsx` (kontekstowo przydatna w obu miejscach, nie duplikat-do-wycięcia).
    - **Fix kształtu podświetlenia (2026-08-22)** — user: "podświetlenie przełącznika przycisku
      mad bossy / kampania ma niedopracowany kształt". Przyczyna: kontener `s.modeToggle` miał
      `radius.lg` (16), a aktywna pigułka `s.modeBtnActive` w środku `radius.md` (10) —
      niepełne, "ni to kwadratowe ni to pigułkowe" zaokrąglenie, bez obrysu definiującego
      krawędź. Naprawione na pełny pill-w-pillu jak reszta apki (`PupilNavbar` island,
      `qClaim`/`claimBadge`/`coinPill`) — oba `radius.full`, `modeBtnActive` dostał też
      `borderColor` (ten sam wzorzec co chipy filtrów w `finances.tsx`: fill + obrys w tym
      samym akcencie), `gap` między przyciskami zmniejszony `spacing[2]→spacing[1]` żeby tor
      czytał się jako jedna spójna kapsuła, nie dwa oddzielne kafle.
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
    - **USUNIĘTA walka z questów-jako-walk (2026-08-22)** — user: "questy bez walk spoko ale
      z walkami nie chociaż zastanawiam sie i chyba questy zrobimy bez walk, wtedy będzie
      szybciej odbierać bo to nic nie zmienia... zostawimy tylko odbierz." Wynik walki
      questowej był zawsze w 100% przesądzony w momencie kliknięcia "Walcz" (deterministyczny
      miniboss, brak realnej interakcji poza animacją), więc powyższy cały tor `?kind=quest`
      w `boss-fight.tsx` przestał być NAWIGOWALNY z UI — `app/pet-quests.tsx` (patrz "Nawigacja
      Pupila" niżej) teraz od razu odbiera nagrodę przyciskiem "Odbierz" zamiast pushować do
      ekranu walki. Formuła nagrody BEZ ZMIAN — nowy handler `onClaimQuest` w
      `pet-quests.tsx` liczy DOKŁADNIE to samo co dawniej liczył `boss-fight.tsx`
      (`questFightCoins(base) × gearCoinsMult`, `questFightXp(base)`), tylko przez ożywioną,
      wcześniej martwą akcję `petStore.claimDaily(id, coins, xp)` zamiast `claimQuestFight`
      (ta sama para map `dailyClaims`+`dayClaims`, bez wpisu do `bossLog` — questowa walka i
      tak nigdy nie miała realnego przeciwnika do zalogowania). `TRAINING_QUEST_IDS` side-effect
      (`markTrainingDay()`) zachowany. **`boss-fight.tsx`'s `kind==='quest'` branch pozostaje w
      kodzie jako nieosiągalny z UI** — celowo NIE usunięty w tym samym PR (ryzyko przy dużym
      pliku walki na rzecz szybkiego, bezpiecznego shipu; kandydat do sprzątnięcia osobno,
      patrz NEXT_STEPS.md). Dodatkowo: nowy "ping" badge na zakładce Zadania we
      `PupilNavbar.tsx` (user: "dodaj ping na zakladce questów ze coś jest tam do odebrania")
      — kropka przy ikonie `quests`, widoczna z KTÓREGOKOLWIEK z 4 ekranów Pupila (nie tylko
      po wejściu na sam ekran Zadań), bo navbar montuje się niezależnie na wszystkich 4.
      Logika questCtx/quests/missed WYDZIELONA do nowego `src/hooks/usePetQuests.ts` (ten sam
      wzorzec co `usePetHealthSync`) — jedno źródło prawdy zamiast duplikowania obliczeń
      między pełnym ekranem Zadań a badge'em w navbarze.
    - **Roster odświeżony: koza/wieloryb usunięte, wilk/grizzly/osa dodane** (2026-08-26, user:
      "chciałem ich jako bossów więcej do questów żeby nie były takie stałe że koza jest, koza
      wywalamy, wieloryba też" — plus screenshot z gotowym artem: `BOSS_atakpazury_wilk.png`,
      `BOSS_atakpazury_grizly.png`, `osa_BOSSYuntitled.png`). `mb_goat`/`mb_whale` USUNIĘTE z
      `MINIBOSSES` (`minibosses.ts`) i z `BOSS_PNG` (`bossIcons.ts`) — czyste skasowanie, bez
      martwych `require()`. Wilk (`mb_wilk`, "Wilk Głodu") i grizzly (`mb_grizzly`, "Grizzly
      Ospałości") dostają `attackKind: 'claw'` — user narysował ich art w TEJ SAMEJ konwencji
      co pazurzaste bossy kampanii (`BOSS_atakpazury_<zwierzę>.png`, patrz komentarz nad
      `AttackKind` w `bosses.ts` — to właśnie ten atak eliminuje fallbackową czerwoną pięść
      `HandFist` z `boss-fight.tsx`, o którą user pytał osobno: "czemu ten czerwona ręka
      dziwna"). Osa (`mb_osa`, "Osa Rozproszenia") zostaje BEZ `attackKind` — plik dostarczony
      bez jednoznacznego typu ataku w nazwie, user nie sprecyzował gdy dopytany, więc zgodnie
      ze standardową zasadą (niejednoznaczny atak = pięść) zostaje na fallbacku, tak jak reszta
      rosteru bez pazur/miecza/magii w charakterze. Pliki wrzucone przez usera bezpośrednio na
      branch (GitHub web upload) do `assets/ikonybosów/` (NIE `assets/minibosses/` jak reszta
      minibossów — require() nie wymaga jednolitego folderu, ważne że ścieżka się zgadza;
      `osa_BOSSYuntitled.png` zostaje pod dokładnie tą nazwą) — `bossIcons.ts` dostosowany do
      RZECZYWISTYCH ścieżek zamiast planowanych `assets/minibosses/...`. Tego samego uploadu:
      nowy art `helm_slomiany.png`/`helm_skorzany.png` (podmienił stare pliki 1:1, bez zmian w
      kodzie — te dwie ścieżki już istniały). Talizmany (gwiazda/księżyc/piórko/nieskończoność)
      z tego samego screenshota usera NIE zostały jeszcze wrzucone — nieblokujące, do zrobienia
      kiedy wygodnie.
    - **"Nieodebrane z wczoraj" → wielodniowy catch-up (2026-08-27)** — user: "problem z
      odbiorem questów nieodebranych z dnia wcześniejszego jakby czy co tam". `missed`
      liczyło się TYLKO z jednego dnia wstecz (`yData` w `usePetHealthSync.ts` — pojedynczy
      snapshot "wczoraj") — przerwa dłuższa niż doba w otwieraniu apki bezpowrotnie gubiła
      nagrody za dni starsze niż wczoraj, mimo że komentarz nad `buildMissedDaily`
      (`quests.ts`) od początku ostrzegał dokładnie przed tym scenariuszem. `yData` zastąpione
      `recentDays: RecentDay[]` (`{date, steps, sleep, water}[]`, nowa stała
      `RECENT_DAYS_BACK=6` — tydzień razem z dziś, bufor bez nieograniczonego wstecznego
      przeliczania), budowane RÓWNOLEGLE (`Promise.all` po `getWaterGlasses` na 6 dni, kroki/
      sen z już i tak wczytanej `getHealthHistory(200)` mapy — zero dodatkowych odczytów poza
      wodą). `usePetQuests.missed` woła teraz `buildMissedDaily` RAZ NA KAŻDY dzień okna i
      spłaszcza wyniki (`flatMap`) zamiast raz dla samego wczoraj. `DailyQuestState` dostało
      opcjonalne pole `date` (ustawiane TYLKO przez `buildMissedDaily`) — bez niego UI nie
      wiedziałoby za KTÓRY dzień klaimować (`claimDailyFor(id, date, …)` w `petStore.ts` już
      brało dowolną datę — jedynym ograniczeniem był hardkodowany `yesterdayISO()` w
      `pet-quests.tsx`, nie sam store). `pet-quests.tsx`: `key={q.id}` → `key={`${q.id}:
      ${q.date}`}` (ten sam quest zaległy z DWÓCH różnych dni ma teraz różne klucze —
      wcześniej kolidowałyby), każdy wiersz dostał etykietę względnego dnia (`relDayLabel` —
      "wczoraj"/"N dni temu") żeby dwa te same questy z różnych dni nie wyglądały jak
      duplikat, nagłówek sekcji zmieniony z "Nieodebrane z wczoraj" na "Nieodebrane z
      poprzednich dni".
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
      **[HISTORYCZNY OPIS — ODWRÓCONE 2026-08-21, patrz niżej]**
    - **PRZEBUDOWANE Z DYNAMICZNEGO NA STAŁE, "POJEBANE" (2026-08-21)** — user, po zobaczeniu
      że MAD hp rośnie z KAŻDYM levelem: "Czekaj, ty zrobiles ze im większy level tym większe
      HP mad bossów?????". Wyjaśnione że to nietknięty, oryginalny design z 2026-08-15 (patrz
      wyżej — "MAD nigdy nie robi się przestarzały"), nie coś zmienionego w dzisiejszej
      rekalibracji kampanii. User świadomie zdecydował się to ODWRÓCIĆ: "nie chce stałe ale
      pojebanae wartości tak zeby mad bossy byly 10x silniejsze od kampanijnych odzwierciedleń
      ale stałe, i z większym o wiele atakiem". `madBossHpFor`/`madHitsFor`/`MAD_HITS_MULT`
      USUNIĘTE CAŁKOWICIE — MAD hp jest teraz WPROST `boss.hp (kampania) × MAD_HP_MULT` (=10),
      STAŁE, niezależne od poziomu/statów gracza w momencie walki (dokładnie jak zwykli
      bossowie kampanii — zamrożone raz, nie przeliczane). `madBossFor(boss)` stracił
      parametry `atkStatBonus/level/bonuses` (już niepotrzebne), oba call site'y (`app/
      bosses.tsx`, `app/boss-fight.tsx`) zaktualizowane. DODATKOWO nowe pole `counterMult?:
      number` na `Boss` (bosses.ts, domyślnie brak=×1) — `counterDamage()` bierze je jako 4.
      opcjonalny argument, mnoży bazowy `hp × COUNTER_PCT` PONAD to co już naturalnie wynika
      z 10× hp. `madBossFor` ustawia `counterMult: MAD_COUNTER_MULT` (=3) — user chciał "z
      większym o wiele atakiem" jako OSOBNY lever, nie tylko efekt uboczny większego hp.
      Konkretne liczby (przykład: Kanapowy Leniwiec, kampanijne hp=540 po dzisiejszej
      rekalibracji): MAD hp=5400, kontratak na trafienie = 5400×0.025×3 = **405 obrażeń PRZED
      redukcją uniku** — przy typowym HP kotka na Lv15 (MAD_UNLOCK_LEVEL, ~100-150) to
      praktycznie jednorazowy nokaut bez solidnej inwestycji w HP/unik. Świadomie EKSTREMALNE —
      user explicite poprosił o "pojebane" wartości, to celowy superboss/prestiżowy tor, NIE
      kalibrowany pod normalną wygrywalność jak reszta trybów walki w tej sesji (kampania/
      quest/raid/event nadal mają swoje zwykłe, zbalansowane krzywe).
    - **Nagrody MAD przebudowane — start od finału kampanii, łagodny wzrost** (2026-08-22, user
      po zobaczeniu logu walk ze starego builda: "mad bossy mają być nagrody z nich kontynuacja
      jak po ostatnim busie kampanii") — stary `MAD_REWARD_MULT` (×3 na WŁASNĄ, oryginalną
      nagrodę bazowego bossa kampanii) dawał absurdalnie mało dla wczesnych bossów: MAD Cukrowy
      Potwór (boss #2, coins:12/xp:100 bazowo) dawał tylko 36 monet/300 XP, mimo że PO
      przebudowie wyżej (hp×10 + counterMult×3) jest teraz trudniejszy niż nawet finałowy boss
      kampanii — kompletny rozjazd trudność-vs-nagroda. Zapytany wprost (AskUserQuestion) o
      dokładny kształt wzrostu, bo dosłowna kontynuacja krzywej kampanii (~1.48×/krok,
      ekstrapolowana z 22 istniejących wartości `coins`) dałaby przy MAD order 22 **~88
      MILIONÓW monet** za jedną walkę — user wybrał "start od końca kampanii, łagodny wzrost"
      zamiast pełnej eksplozji wykładniczej. `MAD_REWARD_MULT` USUNIĘTY, zastąpiony
      `madRewardMultFor(order) = 1 + max(0,order-1)×0.15` — `madBossFor` liczy `coins`/`xp` z
      `BOSSES[BOSSES.length-1]` (Iluzja Kontroli, floor niezależny od tego jak mało dawał
      WŁASNY bazowy boss) × ten mnożnik. MAD order1 (Kanapowy Leniwiec) = dokładnie nagroda
      finału kampanii; order22 (Iluzja Kontroli Oszalała, najtrudniejszy MAD) = ×4.15 tego —
      wyraźnie więcej, liniowo, bez eksplozji. `madBosses.test.ts` przepisany pod nowy model.
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
      - **Placeholder rozbudowany na duży, animowany kafelek + anulowanie misji** (2026-08-19,
        user: "zrobić jednak większy ten kafelek jakby z paskiem ładowania podróży animowanym
        ładnym kotka zrobić jakby tak na boki się lekko gibał jakby szedł, i z przyciskiem
        wróć natychmiast z potwierdzeniem") — mały `Compass`+tekst placeholder zastąpiony
        DUŻYM kafelkiem: pełny `CatArt` (`animate` ŻYWE — mrugnięcia/ogon jak normalny
        portret, w przeciwieństwie do mini-ikony na pasku niżej) owinięty w DODATKOWY
        `Animated.View` z `rotate` (`missionSway`, wolne wahadło -7°→7°→-7°, `Easing.
        inOut(Easing.sin)`, 480/960/480ms — WOLNIEJSZE i na ROTACJI, nie `translateY` jak
        `missionBounce` — to "chód" dużego kotka, nie podskakiwanie 22px ikony), ten sam
        `missionProgress` co karta Misja niżej (NIE usunięta — zostaje jako kompaktowe
        odniesienie, redundancja celowa, nie duplikat-do-wycięcia), i tekst "Wraca za...".
        `s.stage` (stały `height:300`) dostaje `height:undefined, minHeight:300` TYLKO w tym
        stanie — duży kotek+tekst+pasek+przycisk nie mieszczą się w stałej wysokości.
        **Anulowanie misji** — NOWA akcja `cancelMission()` w `petStore.ts` (zeruje
        `missionStartedAt`/`missionEndsAt`/`missionProfile` BEZ nagrody, no-op jeśli misja już
        `missionReady` — nie ma czego anulować, powinieneś wtedy walczyć), za przyciskiem
        "Wróć natychmiast" + `Alert.alert` potwierdzenie (user: "JEŻELI CHCESZ ANULOWAĆ NIE
        OTRZYMASZ NAGRODY ZA MISJĘ", `style:'destructive'`, ten sam wzorzec co reset postępu
        pupila w `settings.tsx`).
      - **`missionReady`: kotek na scenie przygaszony + pulsujący prompt "zawalcz" (2026-08-25)**
        — user: "chciałbym żeby to że muszę zawalczyć było bardziej widoczne żeby zakończyć
        misję" → doprecyzował konkretny pomysł: "po tym jak pasek znika i pojawia się przycisk
        walcz w kafelku misji, DODAĆ na tym kocie że on WRACA do NORMALNEGO ROZMIARU ale cały
        jest w CIENIU (jak nieznane bossy) z napisem NACIŚNIJ ABY ZAWALCZYĆ W CELU ZAKOŃCZENIA
        MISJI". Wcześniej (patrz akapit wyżej, "`missionReady` CELOWO nie liczy się jako away")
        po ukończeniu misji scena po prostu wracała do zwykłego, w pełni kolorowego kotka —
        jedyny sygnał że trzeba jeszcze zawalczyć to mały przycisk "Walcz" w kaflu misji w
        gridzie niżej, łatwy do przegapienia (brak jakiegokolwiek sygnału PUSH-notification-
        poziomu w samej scenie). Trzeci branch w warunku sceny (`missionEndsAt && !missionReady`
        / `missionReady` / normalny stan) — zwykły `<CatArt>` w `STAGE_SIZE[stage]+90` (ten sam
        rozmiar co stan normalny — user explicit "wraca do normalnego rozmiaru"), owinięty w
        `<View style={{opacity:0.3}}>` (przygaszenie — CAŁY czas, nie migające, żeby nie
        wyglądało jak błąd renderu) + `Swords` ikona i napis "Naciśnij, aby zawalczyć i
        zakończyć misję" NAD kotkiem (`position:absolute`, `pointerEvents:'none'`), którego
        TYLKO opacity pulsuje (`missionReadyPulse`, 0.7↔1, 900ms, ten sam `Easing.inOut(Easing.
        sin)` co inne animacje misji w tym pliku) — pulsuje sam prompt, żeby przyciągał wzrok,
        nie cały kotek. Cały blok to JEDEN `TouchableOpacity` → `onFightMission()` (ta sama
        akcja co istniejący przycisk "Walcz" w kaflu misji — DODATKOWY, nie zastępczy,
        tap-target, kafel niżej zostaje bez zmian). Prawdziwej maski/sylwetki SVG (dokładnego
        kształtu kotka jak "nieznane bossy" mogłyby sugerować) świadomie NIE zrobiono — `CatArt`
        to wielowarstwowy SVG (patrz `CatArt.tsx`), prosta `opacity` na całym renderze daje ten
        sam czytelny efekt "przygaszenia" dużo mniejszym kosztem/ryzykiem niż maskowanie
        kształtu. Dashboardowy licznik "X nagród do odbioru" (kafel pupila, `index.tsx`) NIE
        liczy jeszcze gotowej misji — zaproponowane jako osobny, dodatkowy krok widoczności,
        NIE zaakceptowane/zrobione jeszcze, patrz NEXT_STEPS.md.
        - **BUG: dotyk kotka NIE wywoływał walki — tylko głaskanie (2026-08-27)** — user: "jak
          klikam to tylko go głaska... trzeba kliknąć walcz w kafelku misji". Przyczyna: "cały
          blok to JEDEN TouchableOpacity" wyżej to NIE cała prawda — `CatArt` opakowuje SIĘ
          WEWNĘTRZNIE we własny `<Pressable onPress={onTap} onLongPress={doCuddle} .../>`
          (patrz `CatArt.tsx`) BEZWARUNKOWO, niezależnie od tego czy dostał `onPress` z
          zewnątrz — `onTap` zawsze robi swoje (haptyka, hop, cząsteczki) i dopiero na końcu
          warunkowo woła `onPress?.()`. Ten wewnętrzny `Pressable` PRZECHWYTUJE dotyk, zanim
          zdąży wybąblować do zewnętrznej `TouchableOpacity` — więc w praktyce cały widoczny
          obszar kotka był "martwy" dla `onFightMission`, działał tylko wąski margines wokół
          (tekst ma `pointerEvents:'none'`, więc i tak nic tam nie łapał). Fix: `CatArt` w tym
          konkretnym miejscu dostaje `onPress={onFightMission}` WPROST — `onTap`'s wewnętrzna
          reakcja "pogłaskania" (hop/iskra) leci przy okazji, nieszkodliwie, bo ekran i tak
          natychmiast nawiguje do `boss-fight.tsx`. Zewnętrzna `TouchableOpacity` zostaje jako
          dodatkowy, szerszy tap-target.
        - **BUG: "prześwity" na czole przygaszonego kotka (2026-08-27)** — user ze
          screenshotem: "pupil dziwnie wygląda jak ma tą misję jakby miał jakieś prześwity na
          czole". Przyczyna: TA SAMA rodzina Androidowych bugów co saga PetTileCat (patrz
          §4/8.x wyżej) — `opacity:0.3` na `<View>` wokół `<CatArt>` renderuje na Androidzie
          nachodzące na siebie warstwy (główna głowa w `<Svg>` + osobne `<Ear/>` overlaye —
          patrz "ears are drawn as separate animated overlays" w `CatArt.tsx` — nachodzące na
          krąg głowy przy nasadzie) jako NIEZALEŻNE półprzezroczyste elementy zamiast jednej
          scalonej warstwy, więc miejsce zachodzenia dostaje PODWÓJNĄ przezroczystość i świeci
          jaśniej niż reszta futra — czyta się jako pasek/zygzak "prześwitu" na czole. Fix:
          `needsOffscreenAlphaCompositing` na tym konkretnym `<View>` — natywny prop RN dokładnie
          na ten przypadek ("Use this if your view contains overlapping semi-transparent children
          which produce artifacts when composited normally"), wymusza render dzieci do bufora
          off-screen jako JEDNA warstwa PRZED nałożeniem `opacity`. Zero zmian w `CatArt.tsx`
          samym — dużo tańszy/bezpieczniejszy fix niż kolejna próba maskowania kształtu (patrz
          ostrzeżenie o PetTileCat: nie zgaduj wizualnie bez realnego zrozumienia przyczyny).
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
    - **Czas trwania + nagroda przepisane na wprost-liniowy wzór** (2026-08-21, user: "misje
      wyprawy sa absurdalnie długie i dają mało... co level zmieniaj dodając +1minuta, +1coin,
      +1xp") — stary `MISSION_MIN_PER_LEVEL=6` dawał na Lv67 misję 406 min (6h46m), podczas gdy
      nagroda skalowała się `questRewardMult` (~+0.045×poziom na MNOŻNIKU, czyli ułamek
      monety/XP za poziom) — czas rósł DUŻO szybciej niż nagroda, więc "opłacalność za minutę
      czekania" malała właśnie w środkowej fazie gry (Lv30-150), zanim znów rosła bliżej sufitu
      480 min. Fix: `MISSION_MIN_PER_LEVEL` 6→1 (misja rośnie WOLNIEJ, Lv67 teraz 76 min zamiast
      406) I `missionRewardFor` przepisane z `questRewardMult` na WŁASNY, prosty wzór —
      `MISSION_COIN_PER_LEVEL`/`MISSION_XP_PER_LEVEL` = +1/+1 za KAŻDY poziom, dokładnie w parze
      z +1 minutą wyżej (Lv67: 16 monet/40 XP → 70 monet/76 XP). Czas i nagroda rosną teraz TĄ
      SAMĄ jednostką (poziom), więc opłacalność-za-minutę nigdy nie zapada się w środku gry.
      `questRewardMult` import usunięty z `missions.ts` (misja ma teraz własną krzywą, nie
      dzieli już jej z resztą questów). Sufit 480 min (8h) osiągany dopiero ~Lv470 zamiast ~Lv79.
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
    - **CAP ODWRÓCONY z FLAT na skalujący (2026-08-20)** — powyższy opis "świadomie FLAT, BEZ
      skalowania energyMult" był celowy w momencie napisania, ale user po zobaczeniu ekranu
      statów: "niech maksymalna energia się nakłada do tych walk bo teraz mam napisane 4 a
      maksymalnie ładuje mi się do 2 i tak czy siak" — "Prób dziennie" na ekranie Siła bojowa
      ZAWSZE liczyło `dailyAttempts(energyMult)` (z bonusów łupu+gear), ale realny bank
      kampanii ignorował to i zostawał na sztywnym `ENERGY_MAX=2` — dwie różne liczby dla tej
      samej rzeczy. `ENERGY_MAX` USUNIĘTE z `bosses.ts`; `energyRegenTick`/`energySpendTick`
      biorą teraz WYMAGANY parametr `max` (bez domyślnej wartości, celowo — żeby nikt
      przypadkiem nie wrócił do sztywnego capu) zamiast czytać stałą modułu. `petStore.ts`
      dostał `campaignEnergyMax(ownedItems, equippedGear, ownedGear)` — łączy `bossBonuses`
      (łup) + `gearCombatBonuses` (gear) i woła `dailyAttempts()`, TĘ SAMĄ funkcję co
      wyświetlacz — jedna prawda, cap bankowy i "Prób dziennie" nigdy się już nie rozjadą.
      Wołane przy `syncEnergyRegen`/`spendEnergy`/`reset()`/initial state/migracji (migracja
      liczy z `state.ownedItems ?? []`/`equippedGear ?? {}`/`ownedGear ?? {}` bezpośrednio,
      NIE polegając na kolejności z późniejszymi migracja-guardami tych pól w tym samym
      `onRehydrateStorage` — inline fallback jest odporny na kolejność). `app/bosses.tsx`
      liczy `campaignEnergyMax = dailyAttempts(bonuses.energyMult)` z tego samego
      już-połączonego `bonuses` co krok 8 (loot+gear).
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
    - **MAD HP dodatkowo +15%** (osobny PR tego samego dnia, user: "mad wtedy niech będą 2x
      trudniejsze od podstaw albo 4razy trudniejsze nie wiem jeszcze na pewno daj im o +30% HP
      więcej niż teraz jest") — user poprosił o +30%, throwaway-symulacją sprawdzono że
      DOSŁOWNE +30% łamie winnability dokładnie tam gdzie boli najbardziej: świeżo Lv15 gracz
      (MAD_UNLOCK_LEVEL) próbujący order6 kończy na ~45% winrate/55% faintRate. `MAD_HITS_MULT
      = 1.15` w `madBosses.ts` (mnożnik na całą `madHitsFor(order)`) to sprawdzony bezpieczny
      sufit — order1-6 przy Lv15-20 zostaje 100% winrate, wyraźnie trudniejsze (avgLoss
      54-86% zamiast 48-64%). Świadomie NIE dano usera dokładnie tego o co prosił — jawnie
      wyjaśnione w PR-ie, nie po cichu ucięte.
    - **Kampania: HP podbite hp×√2 (common, order 1-8) / hp×√3 (elite, order 9-22)** (2026-08-21,
      user po świeżym teście: "boss sa za latwe zdecydowanie... utrudnij bym je minimum 2x HP i
      2x dmg każdy a te dalsze nawet po 3x wszystko") — TEN SAM wzorzec ostrożności co reszta
      tej sekcji: user zapytany wprost (AskUserQuestion) po throwaway-symulacji pokazującej że
      NAIWNE hp×2/hp×3 daje ~4x/~9x ŁĄCZNYCH obrażeń w walce (nie 2x/3x) — `counterDamage()` =
      `COUNTER_PCT × boss.hp`, więc podwojenie hp jednocześnie podwaja LICZBĘ ciosów potrzebnych
      I obrażenia z KAŻDEGO kontrataku, total ~ hits × dmgPerHit ~ hp² (ten sam kwadratowy
      mechanizm co historyczny bug z 2026-08-13). Przy tym naiwnym mnożniku i realistycznej
      rosnącej inwestycji symulacja dała 0-2% winrate na WIĘKSZOŚCI rostera — praktyczna ściana.
      User wybrał "Przelicz na realny 2x/3x" (rekomendowane) zamiast dosłownego mnożnika: żeby
      ŁĄCZNE ryzyko (nie surowe hp) rosło faktycznie ~2x/~3x, hp skaluje się PIERWIASTKIEM
      (√2≈1.41 / √3≈1.73, bo total ryzyko ~ hp²). Zweryfikowane throwaway-symulacją (profil
      inwestycji rosnący z `order`, jak poprzednie audyty): przy lekkiej inwestycji avgLoss
      rośnie z 9-62% (stare, trywialne) do 30-100% (wyraźnie trudniej), 100% winrate prawie
      wszędzie; przy umiarkowanej inwestycji czysto 100% winrate z avgLoss 6-91%. **Wyjątek:
      boss #1 (Kanapowy Leniwiec, Lv2, pierwsza walka w grze)** zostaje ryzykowny nawet po
      przeskalowaniu — 0% winrate przy lekkiej inwestycji (naturalne, zero czasu na zakupy tak
      wcześnie), 96% przy umiarkowanej. Świadomie zostawione tak jak user wybrał (nie ma dobrego
      kompromisu między "trudniej wszędzie" a "pierwsza walka musi być łatwo dostępna") — WARTO
      obserwować na urządzeniu, patrz NEXT_STEPS.md. 22 wartości `hp` w `BOSSES` (bosses.ts)
      przepisane bezpośrednio (nie runtime-owy mnożnik — ten sam styl co poprzednie balance-
      review'e, łatwiej grepować/tunować pojedynczy numer niż śledzić warstwę mnożników).
      Raid/quest/mad/event/menace (osobne rostery, `raidSessionHpFor`/`questBossHpFor`/
      `madBossHpFor`/`eventHpFor`/`menaceSessionHpFor`) ŚWIADOMIE NIETKNIĘTE w tym PR-ze — user
      pytany konkretnie o kampanię (miał przed oczami raport z jej postępu), inne tory mają
      WŁASNE, udokumentowane historie wrażliwości (zwłaszcza MAD, patrz wyżej) i wymagałyby
      osobnego audytu, nie tego samego mnożnika "na hurra".
    - **Skumulowany unik z łupu przepołowiony + ostatni "Trofeum" w nazwie itemu usunięty**
      (2026-08-21, user: (1) "musimy uwzględnić ze 47% uniku to kurewsko duzo lepiej z bossów
      zeby nie dostawać takich statystyk" (2) "nadal nie usunąłeś chyba ze wszystkich bossów
      trofeow?"). (1): zsumowane WSZYSTKIE `dodge` z `BOSSES[].loot.bonus` dawały przy pełnej
      (22/22) kampanii **72% uniku** — user zgłosił 47% przy 17/22 (zgadza się, brakowało mu
      jeszcze hades+princess+wizard, razem +25 punktów). `counterDamage()` tnie kontratak wg
      `1 - min(0.9, dodge)`, więc 72% oznaczało że kontratak spadał do niecałej 1/3 swojej
      wartości na KAŻDY hit po ukończeniu kampanii — bezpośrednio podkopuje sens dopiero co
      zrobionej rekalibracji trudności wyżej (ta liczyła z lekką-umiarkowaną inwestycją, nie z
      72% uniku z samego lootu). Wszystkie 10 wartości `dodge` w `BOSSES` przycięte ~×0.4,
      zaokrąglone do równych punktów procentowych, z zachowaniem WZGLĘDNEJ kolejności/wag
      między bossami (dragon/burnout/princess/stress 0.05-0.06→0.02, compare/doubt/devourer
      0.06-0.08→0.03, jaguar/wizard 0.09-0.10→0.04, hades 0.11→0.05 — najwyższy) — nowa suma
      pełnej kampanii to **30% uniku**, wciąż realna nagroda za progres, ale nie neutralizuje
      całej mechaniki kontrataku. `desc` string każdego zmienionego lootu zaktualizowany w
      parze z liczbą (user-facing tekst, nie tylko dane). (2): `loot_dragon` (Smok Chaosu,
      order 4) wciąż nosił nazwę **"Trofeum Smoka"** mimo że gablota trofeów i cała reszta
      nazewnictwa lootu zostały zdetrofeizowane 2026-08-12 (patrz komentarz przy `loot_pillow`
      wyżej — TEN item akurat przeoczono wtedy). Zmienione na "Łuska Chaosu" (fizyczny
      przedmiot z pokonanego smoka, ten sam styl co "Figurka Węża"/"Pazur Refleksu") — `id`
      ZOSTAJE `loot_dragon` (klucz w `ownedItems`, zmiana złamałaby już zdobyty przedmiot,
      dokładnie ten sam wzorzec co przy `loot_pillow`). Grep całego repo po "trofe"
      (case-insensitive) potwierdza że to było JEDYNE pozostałe wystąpienie w nazwie itemu —
      reszta trafień to komentarze/klucze wyszukiwania ustawień, nie user-facing tekst lootu.
  - **Kontratak bossa ODWRÓCONY z powrotem na STAŁY (nie malejący z HP bossa)** (2026-08-20,
    user przejrzał świeży log walk: "boss atakują coraz mniej o co chodzi to błąd?? ... zrob
    mu stały dmg xd wszystkim"). Malejący kontratak (fix z 2026-08-13, patrz wyżej) był
    świadomym mechanizmem — kontratak/rundę w logu maleje w lockstep z HP bossa (np.
    31,26,22,...,2,0), co user zinterpretował jako bug, nie feature. Rozwiązanie: `counterDamage()`
    woła się teraz WSZĘDZIE (jedyne miejsce wywołania — `simulateFight`) z `boss.hp` (STAŁE
    max) zamiast malejącego `bossHp` — sygnatura funkcji niezmieniona (dalej bierze jeden
    argument hp-podobny), tylko CO się do niej przekazuje. Żeby nie wrócić do historycznego
    "kwadratowego" problemu z 2026-08-13 (wtedy: rozstęp HP bossów kampanii 300→368000, ×1200
    — dziś krzywa HP już przepisana, rozstęp tylko 382→2690, ×7, patrz komentarz nad `BOSSES`),
    `COUNTER_PCT` przepołowiony 0.05→0.025: throwaway-symulacją CAŁEGO rosteru 22 bossów
    (profil inwestycji z DWOMA realnymi punktami kalibracji — stary anchor order4/Lv9 z
    audytu 0.04→0.05 I świeży log tego usera order10/Lv20 — interpolowane liniowo przez
    `order`) sprawdzono że 0.025 przy stałym liczeniu daje PRAKTYCZNIE IDENTYCZNY profil
    ryzyka co 0.05 przy malejącym (realistyczna inwestycja: 100% winrate/avgLoss ~51% vs
    dawne ~48%; ×1.5 inwestycji: 100%/~25% vs dawne ~23%) — usunięcie decaya z grubsza
    PODWAJA sumę kontrataków w jednej walce, połowa procentu odtwarza tę samą całkowitą
    trudność. Raid/nemesis/MAD/quest/misja NIE wymagały zmian poza samą stałą — ich `boss.hp`
    w `simulateFight` to już wcześniej deliberatnie MAŁA, sesyjna wartość (`raidSessionHpFor`/
    `menaceSessionHpFor`/`madBossHpFor`/`questBossHpFor`, nie surowa trwała pula), więc
    liczenie kontrataku od `boss.hp` zamiast malejącego `bossHp` było dla nich BEZPIECZNE z
    założenia (te tryby już nigdy nie liczyły od "prawdziwej" ogromnej puli). Stare komentarze
    dokumentujące "counterDamage liczy % od AKTUALNEGO hp bossa" w `raid.ts`/`madBosses.ts`/
    `seasonalEvents.ts`/`boss-fight.tsx` zaktualizowane żeby nie kłamać o aktualnym zachowaniu
    — historyczna narracja fixu z 2026-08-13 w `bosses.ts` ZOSTAJE nietknięta (opisuje co było
    prawdą WTEDY), nowy wpis nad `COUNTER_PCT` jasno oznacza odwrócenie jako aktualny stan.
  - **Itemy bojowe — droprate tierowany wg skrzynki + darmowy level-up z epic/legendary**
    (2026-08-18, user: "zrob zeby itemy z bossów miały większy droprate... że te itemy mają
    poziomy, najsłabsze niech lecą na niższych gorszych boksach a lepsze poziomy czyli
    ulepszanie itemów na trudniejszych") — "itemy z bossów" = itemy bojowe (9 typów, część z
    `maxLevel`>1: dodge/fire/execute/reflect), NIE loot kampanii (gwarantowany, bez poziomów,
    bez zmian). "Boksy" = tiery skrzynki sardynek (`CrateTier` w `crates.ts` — `basic`/`rare`/
    `epic`/`legendary`, TA SAMA skrzynka co codzienne głaskanie do pełnej afekcji, więc
    osiągalne bez realnego grindu, zgodnie z życzeniem):
    - **`COMBAT_ITEM_DROP_CHANCE_BY_TIER`** (zastąpił flat `COMBAT_ITEM_DROP_CHANCE=0.01`) —
      `basic: 0` (zbyt częsta, zabiłaby rzadkość), `rare: 0.03`, `epic: 0.08`,
      `legendary: 0.18` — WYRAŹNIE wyższe niż stare 1% na wyższych tierach ("większy
      droprate"), zero na najsłabszym ("niższe gorsze boksy" dalej dają MNIEJ, nie więcej).
    - **`openCrate()` w `petStore.ts`** — gałąź decyzji: `basic`/`rare` dają TYLKO nowy
      nieposiadany item na poziomie 1 ("najsłabszy poziom" — pierwsze zdobycie). `epic`/
      `legendary` PREFERUJĄ ulepszenie już posiadanego, jeszcze nie na `maxLevel` itemu o +1
      (`itemLeveledUp`, NOWA gałąź) — nowy item to tam fallback TYLKO gdy nie ma czego
      ulepszyć (nic jeszcze nie posiadasz na < max). Level-up jest DARMOWY (bez kosztu monet)
      — DRUGI, RÓWNOLEGŁY tor obok istniejącego `upgradeCombatItem` (koszt monet,
      `combatItemUpgradeCost`), nie zastępuje go, oba prowadzą do tego samego capu.
    - **`CrateModal.tsx`** — nowy napis "⬆️ {nazwa} +1 poziom (LvN)!" obok istniejącego "🎁
      Nowy item bojowy", zależnie od tego która gałąź trafiła.
  - **Przemianowane na "perki"/"UMIEJĘTNOŚCI" + drop ze skrzynek SKLEPOWYCH, nie tylko
    darmowej skrzynki głaskania (2026-08-29)** — user: "te itemy bossów co miały być te
    pierwsze pierwsze co są w assets/itemybossy to wgle ich nie da się dropnąć... to są
    perki... które ogólnie nie są itemami tylko bardziej UMIEJĘTNOŚCIAMI więc tak bym je
    nazwał. te kupowane skrzynki zrobiłbym tak że można dropnąć BASIC ITEMY > STREAK FREEZE
    > COINY 50-300% skrzynki > i TE ITEMY BOSSÓW". Do tej pory `openCrate()` (petCat
    głaskanie) i `menaceClaim()` (pokonanie nemesis) już dropowały te itemy — ale
    `petBoxes.ts`'s `rollBox()` (skrzynki KUPOWANE w sklepie: drewniana/srebrna/złota +
    darmowa skrzynka dnia) w OGÓLE nie miał gałęzi dla nich, dokładnie ta luka co user
    zgłosił. Nowe `LootBox.combatItemChance` (opcjonalne, brak/0 = niedostępne — tak zostaje
    dla `DAILY_BOX`, koszt 0 nie da się przełożyć na "% kosztu skrzynki") — NAJRZADSZA z
    czterech kategorii w każdej z 3 płatnych skrzynek: sardine 0.02, silver 0.05, gold 0.08,
    każda CELOWO < `freezeChance` tej samej skrzynki (0.05/0.10/0.10) i rzecz jasna
    dużo < `gearChance` (0.15/0.28/0.38) — realizuje żądaną kolejność BASIC ITEMY (gear) >
    STREAK FREEZE > ... > PERKI wprost przez WIELKOŚĆ progu, nie kolejność sprawdzania (ta
    ostatnia i tak by nie wystarczyła — patrz jak `coins` jest fallbackiem na końcu funkcji,
    a mimo to najczęstszy realny wynik po wyczerpaniu kosmetyk). Gałąź w `rollBox()` (nowy,
    opcjonalny 5. parametr `ownedCombatItems`) kopiuje wzorzec `openCrate()`: `sardine`/
    `silver` dają TYLKO nowy nieposiadany perk na poziomie 1, `gold` PREFERUJE darmowy
    level-up już posiadanego (nie na max), nowy perk to tam fallback. Gdy nic nie da się
    przyznać (wszystko posiadane i na maksie) branch nic nie zwraca i spada do monet — bez
    potrzeby systemu kompensacji dubli jak przy gearze (nigdy nie "marnuje" rzutu na coś już
    posiadanego skoro upgrade zawsze jest realną korzyścią). Nowa akcja w petStore
    `grantOrLevelCombatItem(id, level)` — bezwarunkowy setter (w przeciwieństwie do
    `grantCombatItem`, no-op na duplikat), bo `rollBox()` już podjął decyzję nowy-vs-upgrade
    na snapshocie w momencie losowania. `BoxReward` ma nowy wariant `{ type: 'combatItem' }`;
    `BoxRevealModal.tsx` renderuje ikonę z `COMBAT_ITEMS[id].icons[level-1]`, napis "NOWY
    PERK BOSSA!"/"PERK ULEPSZONY!" zależnie od `isUpgrade`. **Monety kupowanych skrzynek**
    (sardine/silver/gold — NIE `DAILY_BOX`) zmienione z płaskich zakresów (były 3-12/10-30/
    25-70, realnie 8-34% kosztu) na DOKŁADNIE 50%-300% WŁASNEGO `cost` skrzynki jak
    zażądano (18-105/45-270/100-600) — czysto zmiana DANYCH w `LOOT_BOXES`, `rollBox()`'s
    logika monet się nie zmienia, dalej czyta te same pola `coins.min/max`. UI: sekcja w
    `app/pet.tsx` przemianowana z "Ekwipunek bojowy" na "Umiejętności bossów", napis w
    victory modalu bossów (`boss-fight.tsx`, drop z nemesis) z "Nowy item bojowy" na "Nowa
    umiejętność" — `combatItems.ts`'s wewnętrzny typ `CombatItemId`/nazwa pliku NIE
    zmienione (zbyt szeroki refaktor na samą kosmetykę nazewnictwa UI). **Świadomie NIE
    zrobione w tym PR**: drop z walki ze zwykłymi bossami kampanii/eventowymi (poza już
    istniejącym `menaceClaim()` dla nemesis) — user wspomniał to tylko luźno ("czy coś
    tam"), w przeciwieństwie do w pełni wyspecyfikowanej hierarchii skrzynek; wymaga osobnej
    decyzji o stałych drop-rate i czy dotyczy WSZYSTKICH bossów kampanii (24) czy tylko
    eventowych — flagowane w NEXT_STEPS.md do potwierdzenia zamiast zgadywania zakresu.
    Testy: `petBoxes.test.ts` (5 nowych — strefa perków dla sardine/gold, preferUpgrade z
    fallbackiem gdy nic do ulepszenia, brak-nic-do-przyznania spada do monet, domyślny
    piąty parametr).
  - **Doszlifowanie: `menaceClaim()` (nemesis) dostał ten sam fallback-na-upgrade co
    `openCrate()`/`rollBox()` (2026-08-29, user: "dokończmy te perki żeby były
    doszlifowane" — po pytaniu o rozszerzenie źródeł dropu user wybrał "zostaw jak jest",
    więc to NIE nowe źródło, tylko naprawa istniejącego)** — `menaceClaim()` (pokonanie
    nemesis, `MENACE_ITEM_DROP_CHANCE=0.08`) miał TYLKO gałąź "nowy nieposiadany perk",
    bez upgrade'u. Gdy gracz posiada już WSZYSTKIE 9 perków (nawet na poziomie 1),
    `candidates` (nieposiadane) jest zawsze puste — cała 8% szansa staje się TRWALE martwa
    w późnej grze, mimo że nemesis to POWTARZALNY, regularny boss (nie jednorazowy jak
    kampania). Fix: gdy nie ma nic nowego do przyznania, losuje jeszcze-nie-maksowy
    posiadany perk i ulepsza go o +1 — dokładnie ten sam `upgradeable`-filter co
    `openCrate()` już miał. Zmieniony kontrakt `menaceClaim()`: było `CombatItemId | null`
    (sam dropnięty item), teraz `{ itemDropped, itemLeveledUp } | null` (`null` = już
    odebrane wcześniej dla tego klucza; oba pola mogą być `null` razem = trafienie bez
    czego przyznać, np. roll poniżej szansy). `boss-fight.tsx`'s `VictoryInfo` dostał
    `itemLeveledUp?`, victory modal renderuje "⬆️ {nazwa} +1 poziom (LvN)!" obok
    istniejącego "🎁 Nowa umiejętność" — ten sam wzorzec tekstu co `CrateModal.tsx`.
    Przy okazji doczyszczone przeoczone miejsca z rename na "perki"/"umiejętności":
    `CrateModal.tsx` (reveal darmowej skrzynki z głaskania — dalej mówił "Nowy item
    bojowy"), `bossProgressReport.ts` (eksportowalny raport stanu — "Sloty na itemy
    bojowe"/"ITEMY BOJOWE" → "Sloty na umiejętności bossów"/"UMIEJĘTNOŚCI BOSSÓW"). Brak
    nowego testu — `openCrate()` (identyczny kształt fallbacku) też nie ma bezpośredniego
    testu w tym repo (store actions nietestowane wprost, tylko wydzielone czyste funkcje —
    ten sam brak pokrycia, nie nowy).
  - **Wydajność ekranu walki (`boss-fight.tsx`) — statyczny kotek + mniej animowanych
    obiektów + stabilny layout (2026-08-30, user: "laguja mi walki i te z questów i te z
    bossem")** — quest/misja-minibossy fightują się na TYM SAMYM `boss-fight.tsx` (`?kind=
    quest|mission`) co kampania/raid/event/mad, więc jeden zestaw fixów łapie "walki
    questów" i "walki z bossem" naraz, dokładnie jak user zgłosił oba naraz.
    - **Statyczny kotek**: `<CatArt animate={false} attack={attackPulse} .../>` zamiast
      domyślnego `animate=true`. Bez tego portret kotka w walce uruchamiał WSZYSTKIE idle
      pętle z `/pet` (oddech co 2.1s, mruganie, losowe spojrzenia, strzepywanie uszu, i
      okresowe auto-liźnięcie łapki co 12-22s — pełny Animated.sequence z rotacją ramienia,
      językiem, chowaniem/pokazywaniem nogi) — user: "kotek żeby był tam statyczny... bo
      teraz jest w pełni z głaskaniem animacjami lizania co pewnie laguje". User sugerował
      export do PNG, ale kotek jest wektorowy i BIERZE `palette`/kolory/pręgi/oczy usera
      (CatArt.tsx nie ma storu, ale jest w pełni parametryzowany) — osobny PNG per paleta
      byłby niewykonalny (i utraciłby personalizację w walce). Zamiast tego: `CatArt.tsx`'s
      istniejący `animate` prop już wyłącza dokładnie te pętle (patrz komentarze przy każdym
      `useEffect` tam) — tylko boss-fight.tsx go nie ustawiał. JEDYNA pułapka: atak
      (`attack` prop, +1 co rundę, wywołuje swat+battleFace) był PRZYPADKOWO zagated pod tym
      samym `!animate` co idle-pętle — `animate={false}` wyłączyłby więc TEŻ wizualny cios
      kotka, czego user nie chciał (skarżył się tylko na petting/lizanie, nie na atak).
      Fix: ten `useEffect` (attack) już NIE sprawdza `animate`, tylko `asleep` — atak działa
      niezależnie od stanu idle-animacji.
    - **Czerwone kółka-flash USUNIĘTE, zastąpione statycznym `RadialGlow` za ikoną ataku**
      (user: "jak są obrażenia te takie kółka czerwone je wypierdalamy niech ataki jak łapka
      pięść itp będą miały po prostu z tyłu cień czerwony gradient... mniej do animowania i
      mniej obiektów") — `tileFlash` (osobny `Animated.Value` `bFlash`/`kFlash`, płaskie
      czerwone/żółte koło 96×96 pulsujące NA PORTRECIE trafionego, TRZECI równoległy
      animowany obiekt obok shake+liczby obrażeń) całkowicie usunięty z obu stron (kot i
      boss) — mniej Animated.Value na trafienie, jak user chciał. `RadialGlow.tsx`
      (`components/ui/RadialGlow.tsx`, już istniał — używany w `BossArt`/`BadgeCelebration`/
      `TabBar`) dodany jako STATYCZNE (bez własnego `Animated.Value`) SVG dziecko WEWNĄTRZ
      już-animowanych wrapperów pocisku (łapka/pięść lecąca między kafelkami) i burstu
      pazurów na portrecie — dziedziczy opacity/scale/pozycję z TEGO SAMEGO
      `Animated.Value` co ikona (`pawTravel`/`boltTravel`), więc "hit" wciąż czytelnie się
      podświetla, ale zero NOWYCH animowanych obiektów.
    - **Stabilny layout przycisku WALCZ! (2026-08-30)** — user: "po kliknięciu walcz
      przycisk się przesuwa bo pojawiają się napisy że boss ma osłonę... czy nie lepiej
      było by zrobić żeby kampania miała statyczny UiUx (wgle mieliśmy to wywalić, ale
      pomysł że niektóre bossy mają kryta, niektóre więcej pancerza ma sens i to mi się
      podoba)". Cztery reaktywne linijki mechaniki (`lastHit?.guarded`/`lastHit?.healed`/
      `catHit?.healed`/`lastHit?.thornDmg` — osłona/regen bossa/uzdrowienie kotka/cierń), 0
      do 4 z nich niezależnie widoczne per runda, renderowały się MIĘDZY "Motyw" a
      przyciskiem — każde pojawienie/zniknięcie fizycznie przesuwało WSZYSTKO poniżej,
      łącznie z przyciskiem. User explicite chce ZATRZYMAĆ samą mechanikę (zróżnicowani
      bossy — kryt/pancerz), tylko nie chce SKUTKU (skaczący przycisk) — więc to NIE
      usunięcie mechaniki, tylko przeniesienie tych 4 linijek POD przycisk WALCZ! (i pod
      "Pomiń walkę"), gdzie ich pojawienie/zniknięcie już nic nie przesuwa nad sobą.
      Uwaga: user wspomniał też "redukuje obrażenia bo sen&lt;7" jako coś do usunięcia —
      przeszukane `boss-fight.tsx`, `bosses.ts` i cały `src/` pod kątem mechaniki "mało snu
      → mniejsze obrażenia", NIE znaleziono takiej w kodzie (jedyna istniejąca mechanika
      zależna od snu to inne, niezwiązane z walką miejsca — np. quest "Prześpij 7 godzin").
      Nietknięte — nie ma czego usuwać bez wskazania przez usera GDZIE dokładnie to widzi.
    - **Odłożone na później (user: "z czasem")**: tła wypraw/lochów kampanii — user chce to
      dodać, ale wyraźnie nie teraz, nie w tym PR.
    Bez nowych testów — czysto UI/wydajnościowy fix bez wydzielonych czystych funkcji
    (`tsc`/`jest` zielone, bez regresji w istniejących 791). **Priorytet testu na
    urządzeniu**: wejdź w dowolną walkę (kampania/raid/event/quest/mad/misja) — kotek
    powinien stać nieruchomo poza momentem ataku (bez oddechu/mrugania/lizania), trafienia
    powinny pokazywać ikonę z czerwonym poświatą zamiast pełnego kółka, a przycisk WALCZ!
    NIE powinien się przesuwać niezależnie od tego jakie napisy mechaniki się pojawiają.
  - **Większe portrety areny + eksport szablonu SVG pod przyszłe tła wypraw/lochów
    (2026-08-30, user: "boss i pupil był większy bo są tacy malutcy tutaj... przygotujmy
    to pod customowe grafiki, jak mi wyeksportujesz identyczną templatkę w SVG to ja
    przygotuje tło")** — `PORTRAIT_SIZE` (nowa, JEDNA stała u góry `boss-fight.tsx`) 104→130
    dla `CatArt`/`BossArt` w arenie (TYLKO tam — portrety w modalu wygranej/porażki, size=78,
    nietknięte, user o nich nie mówił). Żeby portret zmieścił się bez wychodzenia poza
    kafelek: `arena` padding spacing[4]→[3] (16→12), `vsRow` gap spacing[3]→[2] (12→8),
    `tile` padding spacing[3]→[2] (12→8) — odzyskane w ten sposób ~24dp szerokości idzie
    wprost na portret. `tilePortrait.height` = `PORTRAIT_SIZE + 18` (zamiast osobnej stałej
    116) — jeden punkt prawdy, zmiana `PORTRAIT_SIZE` automatycznie przelicza wysokość
    kafelka. `s.projectile`'s `top` (pozycja pionowa lecącej łapki/pięści między kafelkami,
    NIEZALEŻNA geometria od `tilePortrait` — inny rodzic) przeliczony 96→108 czystą DELTĄ
    `(nowy_padding - stary_padding) + (nowa_wysokość - stara_wysokość)/2 = (8-12)+(148-116)/2
    = 12`, żeby pocisk dalej leciał przez wizualny środek portretu, a nie przez pasek HP nad
    nim — nie zweryfikowane na żywym urządzeniu (obliczone z geometrii stylów, nie z
    faktycznych zmierzonych wysokości linii tekstu RN, więc może wymagać drobnej korekty).
    **Szablon SVG** (`arena-template.svg`, wysłany userowi, NIE w repo — to zewnętrzny plik
    referencyjny dla narzędzia graficznego, nie asset apki) — dokładna geometria karty areny
    w dp (1 SVG unit = 1dp): karta 328×243 (radius 24), dwa kafelki 148×219 (radius 16, gap
    8) z oznaczonymi strefami: etykieta/pasek HP (muszą zostać czytelne nad dowolnym tłem) i
    okrąg Ø130 = bezpieczna strefa portretu kotka/bossa (nie zasłaniać). Świadomie NIE
    zawiera toru lotu pocisku (nieistotne dla tła, ryzyko niedokładności z powodu przybliżonych
    wysokości linii). **Ważne ograniczenie NIE rozwiązane w tym PR**: `tile`
    (`c.bg.elevated`) i `arena` (`c.bg.card`) mają dziś NIEPRZEZROCZYSTE tła — podpięcie
    faktycznego obrazka tła (np. `ImageBackground` za całą areną) pokazałoby się TYLKO w
    12dp marginesie areny i 8dp szczelinie między kafelkami, nie jako pełna "scena" za
    portretami. Żeby tło realnie działało jak scena wyprawy/lochu, `tile`/`arena`
    background trzeba będzie zmienić na półprzezroczyste RÓWNOLEGLE z wpięciem obrazka —
    świadomie odłożone (user: "to z czasem"), flagowane w NEXT_STEPS.md.
  - **SYSTEM EKWIPUNKU — `src/utils/gear.ts` (2026-08-19, W TRAKCIE, pełny plan +
    checklista kroków w `NEXT_STEPS.md` "SYSTEM EKWIPUNKU")** — TRZECI, osobny system
    itemów obok loot kampanii (`ownedItems`) i itemów bojowych (`combatItems.ts` powyżej):
    6 slotów PASYWNYCH statów wokół kotka (hełm→crit%, zbroja→flat HP, buty→dodge%,
    obroża→atk%, talizman→energyMult%, kolczyki→coins%), 30 itemów (5/slot, progresja
    odblokowania wg poziomu pupila T1=Lv1..T5=Lv90, NIEZALEŻNA od rzadkości), 5 rarity
    (common/rare/epic/legendary/mythic, mnożnik ×1/×5/×8/×11/×15 na `baseValue` —
    ×1/×5/×15 zakotwiczone na przykładzie usera, ×8/×11 dointerpolowane TODO-balance).
    Grafiki w `assets/ekwipunek/<slot>/` (README tam ma pełną listę nazw plików) — obecnie
    PLACEHOLDERY (kolorowy prostokąt + "T{n}"), user podmieni pod te same nazwy, zero
    zmian w kodzie potrzebnych. **Krok 1/2 świadomie ograniczony do stanu, jak
    `combatItems.ts` na start**: `petStore.ownedGear` (item id → najlepsza zdobyta
    rzadkość, dubel w gorszej rzadkości nic nie zmienia) + `equippedGear` (slot → id) +
    `grantGear`/`equipGear`/`unequipGear` — **staty JESZCZE nic nie robią w
    `simulateFight`/`atkPower`/ekonomii, to świadomie osobny późniejszy krok, nie
    zapomnieć** (patrz NEXT_STEPS.md krok 8). Drop: REUSE istniejącego `petBoxes.ts`
    (`LOOT_BOXES` sardine/silver/gold, id BEZ ZMIAN żeby nie migrować zapisów, tylko
    `name`→"Drewniana/Srebrna/Złota") — nowy `gearChance`+`gearRarityWeight` branch w
    `rollBox()` (4. parametr `level` filtruje pulę do `unlockedGearFor`), DODANY obok
    istniejących cosmetics branchy (colorChance/startupChance zostają — user przenosi
    tylko RĘCZNE kupno kolorów do modala imienia, skrzynki nadal mogą je losowo dawać).
    `BoxReward` ma nowy wariant `{ type: 'gear' }`; `BoxRevealModal.tsx` liczy `meta` z
    `RARITY_META` (gear.ts, 5 tierów) zamiast `CRATE_META` (crates.ts, 4 tiery) gdy
    `reward.type === 'gear'` — DWIE różne skale rzadkości w tym samym pliku, nie pomylić.
  - **Restrukturyzacja nawigacji Pupila — staty+itemy scalone do `/pet`, questy do
    NOWEJ `/pet-quests`** (2026-08-19, krok 2 planu z NEXT_STEPS.md "SYSTEM EKWIPUNKU",
    user: "statystyki były w zakładce z kotkiem i itemami... reszta zadań w osobnej
    zakładce"). `PupilNavbar.tsx`'s 4 taby to teraz `pet`/`bosses`/`shop`/`quests` (był
    `stats` zamiast `quests`, ikona `BarChart3`→`ClipboardList`) — **`app/pet-stats.tsx`
    USUNIĘTY**, jego JSX (Siła bojowa + Ekwipunek bojowy: statCard grid, itemRow lista z
    equip/upgrade) wklejony 1:1 do `app/pet.tsx` (własne handlery `onBuyMaxHp/onBuyAtk/
    onToggleEquip/onUpgradeItem`, `pendingUpgrade`+`ConfirmDialog` state — kopia, nie
    reużyty komponent, bo oba ekrany i tak się nie renderują jednocześnie). Cała lista
    questów (dzienne/bonusowe/tygodniowe/miesięczne/cele/zaległe-z-wczoraj) wyjechała do
    **nowego `app/pet-quests.tsx`**.
    - **Pułapka, którą trzeba było rozwiązać**: `questCtx` (co questy widzą) i pupilowy
      `input`/`pet` (status/nastrój na `/pet`) obie zależały od TEJ SAMEJ delikatnej
      logiki odświeżania zdrowia/wody/budżetu (3 osobne, historycznie ubugowane fixy:
      focus/AppState/północ-podczas-aktywnego-ekranu — patrz komentarze w kodzie). Zamiast
      duplikować ją w dwóch plikach (ryzyko rozjazdu), wydzielona do
      **`src/hooks/usePetHealthSync.ts`** — obie zakładki wołają ten sam hook niezależnie
      (osobne mounty, lekko podwojony odczyt przy przełączaniu tabów, ale to nic wobec
      ryzyka dwóch kopii tego samego kodu z czasem rozjeżdżających się poprawek).
      `/pet` bierze z niego tylko `health/stepGoal/budgets` (do `input`/`overBudget`);
      `/pet-quests` bierze `health/waterGoal/waterToday/yData/cardsCollected` (do
      `questCtx`/`missed`) — **żadnego nakładania się pól, czysty podział**.
    - `celebrate` (animacja świętowania na kotku przy odbiorze nagrody) świadomie NIE
      przeniesiony do `pet-quests.tsx` — quest-claim tam już nie animuje kotka (nie ma go
      na tym ekranie), to oczekiwana konsekwencja rozdzielenia ekranów, nie regresja.
  - **`PetCustomizeModal.tsx` (imię+kosmetyka) + onboarding + przebudowa sklepu** —
    krok 5-6 planu (NEXT_STEPS.md "SYSTEM EKWIPUNKU"). User: "nie przecież kliknięciem
    głaskam kotka to nie może... lepiej dać przy edycji imienia kosmetyki".
    - **`src/components/pet/PetCustomizeModal.tsx`** (nowy, pełnoekranowy `Modal`) —
      wchłania sekcje Kolory+Dodatki (oczy/nosek/pasy/wąsy/pręgi łapek) 1:1 z dawnego
      `pet-shop.tsx` (te same `onColor/onStripes/onEye/onNose/onToggleExtra` handlery,
      ten sam preview-przed-kupnem wzorzec), PLUS pole imienia na górze. Startupy (kosmetyk
      EKRANU ŁADOWANIA apki) zostały w sklepie — to nie "kotek", user o nich nie mówił.
      Dwa tryby: `mode="edit"` (tap w wiersz imienia na `/pet` — zastąpił dawny inline
      `TextInput`, X zamyka) i `mode="onboarding"` (pierwsze uruchomienie, brak X, wymusza
      niepuste imię pod przyciskiem "Gotowe").
    - **Onboarding** — nowe pole `petStore.onboarded: boolean` (initial state `false`,
      ale migracja w `onRehydrateStorage` ustawia `true` dla ISTNIEJĄCYCH zapisów — inaczej
      wszyscy obecni userzy dostaliby wymuszony onboarding przy update, ta sama pułapka co
      bug `energyRegenAt` wcześniej w tej sesji, patrz komentarz tam). `app/pet.tsx`:
      `useEffect(() => { if (!onboarded) setCustomizeOpen(true); }, [onboarded])`.
    - **`app/pet-shop.tsx` przebudowany** — kategorie teraz Skrzynki/Sklep dnia/Startupy/
      Posiadane (było: Skrzynki/Kolory/Startupy/Dodatki/Posiadane — Kolory+Dodatki
      usunięte, Posiadane pokazuje już tylko startupy). **Sklep dnia** (nowa kategoria) —
      3 KONKRETNE itemy ekwipunku, gwarantowany zakup (nie loteria jak skrzynki), roluje
      się raz dziennie: `dailyShopSlots(date, level)` w `gear.ts`, ten sam deterministyczny
      `hashOf` wzorzec co `dailyExercisePool`/`raidForWeek` (ten sam dzień = ten sam
      zestaw). Cennik `TIER_BASE_COST` × `DAILY_RARITY_COST_MULT` — TODO-balance, brak
      danych z playtestów. Zakup przez nową akcję `petStore.buyDailyGear(dayKey, itemId,
      rarity, cost)` — reużywa ISTNIEJĄCY `dayClaims` (ten sam mechanizm co odbiór
      questów) z kluczem `gearDaily:${date}:${itemId}`, żeby nie dało się kupić tego
      samego slotu dwa razy tego samego dnia — zero nowego pola w store potrzebne.
    - **Skrzynki + Sklep dnia SCALONE w jedną zakładkę "Rynek" (2026-08-27)** — user: "w
      sklepie połączmy SKLEP DNIA oraz SKRZYNKI, nazywając to ogólnie RYNEK LUB BAZAR... ja
      moze zrobię grafikę pod ten bazarek potem, ale to potem — na razie połączmy [je] żeby
      były razem jak jedna zakładka". `Cat` (typ zakładek) `'boxes'|'daily'|'startups'|
      'owned'` → `'market'|'startups'|'owned'` — zawartość obu (skrzynki gacha + sklep dnia)
      renderuje się jedna pod drugą w JEDNYM `{cat === 'market' && (...)}` bloku, każda pod
      własnym mini-nagłówkiem (`s.subSection`, ten sam styl co już istniał dla nagłówków
      rzadkości w `startups`) — "Skrzynki" / "Sklep dnia". Ikona zakładki: `Store` (neutralna,
      user planuje własną grafikę bazarku później, nie przesądzamy motywu teraz). Żadna
      logika zakupu/renderowania wewnątrz obu sekcji NIE zmieniona — czysto połączenie dwóch
      zakładek w jedną, `Sparkles` (dawna ikona "Sklep dnia") usunięta z importów jako martwa.
  - **`GearPanel.tsx` — 6 slotów przy kotku + porównanie itemów** (krok 7). Rząd 6
    przycisków (`GEAR_SLOTS`) wstawiony w `app/pet.tsx` między sceną kotka a kartą Misji.
    Tap w slot → `GearSlotModal` (bottom sheet): lista POSIADANYCH itemów danego slotu z
    `RARITY_META` kolorem, `gearStatValue(item, rarity)`, i deltą vs aktualnie założony
    (`▲`/`▼`/`=`, zielony/czerwony/szary). Equip/unequip przez istniejące
    `petStore.equipGear/unequipGear`. Brak osobnego "plecaka" — S&F-owy przepływ przez
    kliknięcie slotu, nie osobna lista wszystkich itemów.
    - **Podgląd statów + porównanie w Sklepie dnia (2026-08-22)** — user: "jak klikam w
      sklepiku to żeby po kliknięciu w item pokazywało jego staty i porównanie z itemem
      założonym". Dawniej tap na kafelku w `pet-shop.tsx`'s "Sklep dnia" szedł OD RAZU do
      `ConfirmDialog` zakupu, bez pokazania CO faktycznie się kupuje. Nowy `GearPreviewModal`
      (lokalny do `pet-shop.tsx`, ten sam wzorzec co `GearSlotModal` w `GearPanel.tsx` — bottom
      sheet, nie osobny plik) — tap na kafelku otwiera podgląd: ikona/nazwa/rarity, wartość
      statu, i delta vs to co JEST ZAŁOŻONE W TYM SLOCIE TERAZ (▲/▼/=, zielony/czerwony/szary),
      dopiero stamtąd przycisk "Kup" (dalej przechodzi przez ten sam `onBuyDaily`/
      `ConfirmDialog` co wcześniej — druga warstwa potwierdzenia zostaje, ten podgląd tylko
      POPRZEDZA ją informacją). Różni się od `GearSlotModal`: tu item NIE jest jeszcze
      własnością gracza, więc porównanie idzie do aktualnie założonego (`equippedGear[item.
      slot]`), nie do listy posiadanych wariantów. Skrzynki (losowe nagrody) i Startupy
      (kosmetyka ekranu ładowania, bez statów bojowych) NIE dostały tego podglądu — nie mają
      z góry znanego, konkretnego itemu do pokazania. Formatowanie statów (`GEAR_STAT_LABEL`/
      `fmtGearStat`) WYDZIELONE z `GearPanel.tsx` (dawniej lokalne `STAT_LABEL`/`fmtStat`,
      jedyny konsument) do `utils/gear.ts` — jedna definicja dla obu ekranów zamiast kopii.
      `fmtGearStat` ZAWSZE pokazywał 0.1% precyzję (`.toFixed(1)`), ale AGREGATY na ekranie
      Pupila (Unik/Kryt/energyMult z sumy założonego ekwipunku, `pet.tsx`) zaokrąglały do
      pełnego procenta (`Math.round(...*100)`) — po zsumowaniu kilku itemów z ułamkowymi
      statami suma mogła nie zgadzać się z tym co widać per-item. Naprawione (2026-08-26,
      user: "te statystyki jak atak unik itp musimy pokazywać 0.1 dokladnosci") — te same
      3 miejsca w `pet.tsx` (dodge/crit/energyMult) i `bossProgressReport.ts` (tekstowy
      raport diagnostyczny) przepisane na `.toFixed(1)`.
    - **BUG: zakup posiadanego itemu zabierał monety i nic nie dawał (2026-08-26)** — user:
      "kupiłem item który już miałem przez co zniknęły mi pieniądze i nic nie dostałem".
      `petStore.buyDailyGear()` ZAWSZE odejmowało `cost` i zużywało dzienny slot zakupu
      (`dayClaims[dayKey]`), nawet gdy posiadana rzadkość była już równa/lepsza od oferowanej
      — `better`/`alreadyHave` wtedy tylko pomijało AKTUALIZACJĘ `ownedGear` (słusznie, żeby
      nie zdegradować lepszego itemu), ale monety i tak znikały za literalnie nic. Fix w
      store: `alreadyHave` teraz odrzuca CAŁY zakup PRZED jakąkolwiek zmianą stanu (`return
      false`), analogicznie do istniejącego guardu na `dayClaims[dayKey]`/`coins < cost`.
      Drugi fix, UI (`pet-shop.tsx`): `bought` (czy KONKRETNIE dziś kupiony ten slot) i
      `alreadyHave`/`owned` (czy w ogóle POSIADANY, niezależnie od dnia — z crate'a, z
      wcześniejszego dnia sklepu) to były dwa OSOBNE, nigdzie wcześniej nie sprawdzane stany —
      lista "Sklep dnia" i `GearPreviewModal` sprawdzały tylko `bought`, więc posiadany z
      wcześniej item pokazywał się jako normalny, kupowalny "Kup za X" (myląco, skoro zakup
      by faktycznie nic nie dał). Teraz oba miejsca liczą `alreadyHave`
      (`RARITY_MULT[ownedGear[item.id]] >= RARITY_MULT[rarity]`) osobno: lista pokazuje
      ✓ zamiast przycisku "Kup" (tak samo jak dla `bought`), a `GearPreviewModal` rozróżnia
      trzy stany tekstem: "Już kupione dziś" / "Posiadasz ten przedmiot" / przycisk "Kup za
      X". `onBuyDaily()` też odrzuca wcześniej (przed nawet otwarciem `ConfirmDialog`) z
      dedykowanym toastem "Masz już ten przedmiot (lub lepszy)". Testy:
      `__tests__/buyDailyGear.test.ts` (nowy plik — pierwsze testy bezpośrednio wołające
      `usePetStore.getState()`'s akcje, nie tylko czyste funkcje z `utils/`).
    - **BUG DRUGI, w SKRZYNKACH (nie w sklepie dnia) — dropnięty duplikat po prostu znikał
      (2026-08-27, user: "jak w skrzynce daily wydropiłem to mi zniknął po prostu nic nie
      dostałem bo chyba miałem podobny albo wgle zniknął").** Powyższy fix (26-go) dotyczył
      TYLKO `buyDailyGear` (gwarantowany zakup w Sklepie dnia); `grantGear` (wołane przez
      `onBuyBox`/`onDailyBox` w `pet-shop.tsx` I `pet.tsx` po wylosowaniu nagrody ze skrzynki)
      miało DOKŁADNIE tę samą klasę buga, nietkniętą — cichy no-op gdy duplikat (item już
      posiadany w ≥ tej rzadkości), ale `BoxRevealModal` i tak POKAZYWAŁ kartę "EKWIPUNEK!
      &lt;nazwa&gt;" jakby user właśnie dostał nową kopię, mimo że `ownedGear` się nie
      zmieniało — realnie dostawał nic, wyglądało jak zjadło drop. Fix: `grantGear` teraz
      KOMPENSUJE duplikat monetami (`gearSellValue`, ta sama stawka co ręczna sprzedaż w
      `sellGear` — spójna wewnętrzna wartość itemu) zamiast wyrzucać go w próżnię, i zwraca
      skompensowaną kwotę (`number`, 0 = normalny przyznany item, sygnatura w store zmieniona
      z `void`). Wszystkie TRZY miejsca wołające (`onBuyBox`/`onDailyBox` w `pet-shop.tsx`,
      `onDailyBox` w `pet.tsx`) przekazują tę kwotę do nowego propa `BoxRevealModal`'s
      `dupeCoins` — modal wtedy pokazuje UCZCIWĄ kartę ("MASZ JUŻ TEN PRZEDMIOT" + monety
      zamiast ikony/nazwy itemu, cząstki 🪙 zamiast ✨) zamiast udawać że gracz dostał nową
      kopię czegoś czego nie ma. `sklep dnia` (gwarantowany zakup, nie dotyczy tego buga —
      tam duplikat całkiem BLOKUJE zakup, bo user sam wybiera co kupić, patrz wyżej) i
      skrzynki (losowe, user nie ma kontroli co wypadnie) świadomie różne traktowanie:
      zablokowany zakup vs. kompensata, bo w skrzynce zablokowanie nie ma sensu (nie było
      wyboru co się wylosuje). Testy: `__tests__/grantGear.test.ts` (nowy plik, analogiczny do
      `buyDailyGear.test.ts`). **Podobny gap, NIEnaprawiony, celowo poza zakresem tej zmiany**:
      `grantCombatItem` (itemy bojowe, `combatItems.ts`) ma dokładnie tę samą klasę no-opa na
      duplikacie ze skrzynki — inny system, inna decyzja projektowa potrzebna (auto-upgrade
      poziomu zamiast kompensaty monetami?), patrz NEXT_STEPS.md.
    - **Sklep dnia: 3→4 itemy + siatka TYLKO-ikona zamiast pełnych wierszy (2026-08-31)** —
      user: "zwiększymy do 4 itemów... zrobić grafikę bazarku i ustawić itemy po 4 obok
      siebie tylko z ikoną, mi po kliknięciu pokazuje się popup ze statystykami i formularzem
      zakupu i porównania z założonym". `dailyShopSlots(date, level, count=4)` — domyślny
      `count` 3→4 (jedyny call site w `pet-shop.tsx` nie podawał argumentu, więc automatycznie
      przeszedł na 4; `dailyShopSlots` z ograniczoną pulą unlocked itemów i tak zawsze
      przycina do `Math.min(count, unlocked.length)`, więc niski poziom pupila nie crashuje).
      UI: nowa `s.dailyGrid` (4 kwadratowe kafelki, `width:'23%'` + `justifyContent:
      'space-between'` zamiast `gap` — odstępy wynikają z rozłożenia reszty szerokości,
      działa identycznie na dowolnej szerokości ekranu) ZASTĘPUJE dawne pełnoszerokościowe
      wiersze (`s.boxRow`, ZOSTAJE nietknięty — dalej używany przez sekcję Skrzynek). Kafelek
      pokazuje TYLKO ikonę (+ mały ✓ overlay jeśli posiadane/kupione dziś) — żadnej nazwy/
      rzadkości/ceny wprost na liście. To NIE utrata informacji: `GearPreviewModal` (już
      istniejący od 2026-08-22, patrz wyżej — nazwa/ikona/rzadkość/stat/delta-vs-założony/
      przycisk kup) był i JEST jedynym miejscem pokazującym te dane — zmienia się tylko
      TRIGGER (mały kafelek zamiast pełnego wiersza), nie treść popupu. Test
      `gear.test.ts`'s "poziom 1: 3 sloty" zaktualizowany na 4 (był hardkodowany na stary
      domyślny `count`).
    - **Sloty powiększone (2026-08-27)** — user: "te sloty na itemy musimy powiększyć bo sa
      za malutkie przy kotku". `s.slot` 40×40 → 50×50 (+25%), `slotImg` 26→34, ikona kategorii
      (pusty slot) 18→22, `slotDot` (kropka "posiadasz, nie założone") 7→8px, `flankCol`
      (kolumna 3 slotów po jednej stronie kotka) 46→56 szerokości żeby sloty się nie stykały.
    - **Kolor "+N" na przyciskach ulepszeń dopasowany do stata, nie żółty (2026-08-27)** —
      user: "+5 na ataku niech będzie czerwone, +20 przy zdrowiu na zielono, resztę czyli
      ilość coinów zostawiamy żółtą". `s.buyPillTxt` (`app/pet.tsx`, karty "Siła bojowa") ma
      domyślnie żółty kolor (tak samo jak cena w monetach obok) — ikona `Swords`/`Heart` na
      przycisku ulepszenia była już poprawnie czerwona/zielona, ale sam tekst "+5"/"+20"
      dziedziczył żółty niezależnie od kontekstu. Fix: inline override `{color:'#F87171'}`/
      `{color:'#2AC68F'}` na "+N" (ten sam wzorzec co istniejący `Walcz` przycisk niżej w tym
      samym pliku, który już nadpisywał `buyPillTxt` na zielono). Cena w monetach (druga
      ikona+tekst w TYM SAMYM przycisku) BEZ ZMIAN — zostaje żółta.
  - **Krok 8 (OSTATNI z planu) — wpięcie gear w realne formuły walki/ekonomii, SYSTEM
    KOMPLETNY** (2026-08-19). PRZED wpięciem: rebalans `GEAR_ITEMS` baseValue w gear.ts —
    pierwsze przejście dałoby mythic T5 do 45-90% z JEDNEGO itemu, node-owe policzenie
    sumy bonusów z CAŁEJ kampanii (22 bossy, bosses.ts) dało tylko atk+92%/dodge+72%/
    crit+36%/energyMult+75% ŁĄCZNIE — jeden mityczny item przebijający całą kampanię byłby
    jawnie zepsutym balansem (istniejące tuningi bossów, COUNTER_PCT/MAD_HITS_MULT, zakładają
    tę pulę jako sufit). Wszystkie baseValue przeliczone pod mythic T5 ≈ 20-30% sumy
    kampanijnej; zbroja T1 zostaje dokładnie jak user podał (+1/+5/+15), tylko T2-T5
    dointerpolowane pod nowy sufit (~50 HP mythic T5, ~50% CAT_BASE_MAX_HP).
    - **`gearCombatBonuses()`** (gear.ts) — sumuje helm/buty/obroza/talizman na kształt
      `Bonuses{atk,dodge,crit,energyMult}`, TEN SAM kształt co `bossBonuses()` z lootu
      kampanii → proste dodanie w KAŻDYM miejscu gdzie dotąd liczono `bossBonuses`:
      `boss-fight.tsx` (realna walka), `pet.tsx` (wyświetlanie Siły bojowej), `bosses.tsx`
      (feed do `syncRaidEnergy`/`syncEventEnergy`), `bossProgressReport.ts` (eksport, pola
      opcjonalne dla starych testów/wywołań — ten sam wzorzec co `resetGeneration` tam).
    - **`gearFlatHp()`** (zbroja) — wpięte WSZĘDZIE gdzie liczy się realny sufit HP kotka,
      w tym `petStore.healCat/resetCatHp` (REALNA walka, nie tylko ekran statów — bez tego
      gear HP byłby czysto kosmetyczny, nie chroniłby kotka naprawdę).
    - **`gearCoinsMult()`** (kolczyki) — jedyny stat gear bez odpowiednika w `Bonuses`.
      JEDEN choke point: `boss-fight.tsx`'s `finish()`, wszystkie 7 gałęzi nagrody (raid/
      menace/campaign/event/quest/mad/mission) mnożą `Math.round(coins * coinsMult)` przed
      zapisem do store I do victory modala (spójna liczba w obu miejscach).
    - 8 nowych testów w `gear.test.ts`, w tym test kalibracji: pełny mityczny loadout na
      wszystkich 4 slotach walki musi zostać `toBeLessThan` sumy bonusów z całej kampanii —
      złapie regresję, jeśli ktoś kiedyś zmieni baseValue bez przeliczenia sufitu.
  - **Layout slotów przebudowany na 3 lewo/3 prawo flankujące kotka + konsolidacja UI
    misji** (2026-08-20, user screenshot `/pet`: "itemy będą 3 z prawej i 3 z lewej kotka...
    kafelek misji jest jakby podwojony... napis zachodzi na ramki itemów"). Dawny pojedynczy
    rząd 6 przycisków POD kotkiem (opis wyżej) zastąpiony: `GearPanel` bierze teraz `children`
    (kotek, przekazany przez `app/pet.tsx`) i renderuje go w środkowej kolumnie `catCol`
    (`flex:1`), flankowanej dwiema stałej-szerokości kolumnami `flankCol` po 3 sloty
    (`GEAR_SLOTS.slice(0,3)`/`.slice(3)`). Ikony emoji (`SLOT_META.icon`, zostaje bez zmian
    dla `pet-shop.tsx`/`BoxRevealModal.tsx`) zastąpione w `GearPanel.tsx` nowym
    `SLOT_ICON: Record<GearSlot, LucideIcon>` (HardHat/Shield/Footprints/Link2/Gem/Coins) —
    kolor `meta.color` (rarity) gdy założone, `c.text.muted` + cieńszy `strokeWidth` gdy
    slot pusty ("bez koloru jakby były puste"). Nazwa itemu pod ikoną USUNIĘTA (nie mieściła
    się w wąskiej kolumnie obok kotka) — szczegóły zostają w `GearSlotModal` po tapnięciu.
    - **Mission UI**: dawny duży `stageAway` kafelek (kotek znikał ze sceny, zastępowany
      wymachującym dużym CatArt) USUNIĘTY — kolidował wizualnie z osobną kartą "Misja" niżej
      (to samo pokazane dwa razy) i zachodził tekstem na ramki gear slotów. Osobna sekcja
      "Misja" (inline lista 3 profili) USUNIĘTA — zastąpiona (1) `MissionSendModal` w
      `app/pet.tsx` (nowy komponent, bottom-sheet identyczny wzorcem do `GearSlotModal`, 3
      wiersze `MISSION_PROFILE_ORDER`) i (2) małym kaflem misji w gridzie "Siła bojowa", który
      zastąpił dawną kartę "Doświadczenie" (Lv+XP) — 3 stany: brak misji → ikona Compass +
      przycisk "Wyślij" (otwiera modal), w drodze → ikona Hourglass + odliczanie, gotowa →
      ikona Swords + przycisk "Walcz" (nawiguje do `boss-fight?kind=mission`). Header
      `topRight`'s pasek Lv POWIĘKSZONY (`lvlBarRow`/`lvlBarTrack`, szerszy i grubszy niż
      affection `miniBarRow`, który zostaje bez zmian) + nowa linijka `{lvl.inLevel}/
      {lvl.needed} XP` pod paskiem — jedyny wskaźnik poziomu na ekranie odkąd karta
      "Doświadczenie" zniknęła z grida.
    - **Runda 2 — kotek na scenie w trakcie misji dalej był PODWOJONY** (2026-08-20, user po
      teście na urządzeniu: "kotek jest podwojony chce tylko animacje jak on wchodzi na pasek
      zmniejsza sie w trakcie wchodzenia i sobie tak idzie z paskiem"). Pierwsza wersja tylko
      ZMNIEJSZYŁA duży portret (`MISSION_STAGE_SIZE`), ale zostawiła go RENDEROWANY RAZEM z
      osobnym małym kotkiem na pasku — dwa elementy naraz, dokładnie ten sam typ duplikatu co
      dawny `stageAway` vs karta Misja. `MISSION_STAGE_SIZE` USUNIĘTE — duży portret w trakcie
      misji zniknął CAŁKOWICIE, jedyny kotek to ten na pasku. Dostaje jednorazową animację
      wejścia `missionEnter` (`Animated.Value` 0→1, 550ms `Easing.out(cubic)`, odtwarzana przy
      każdym zamontowaniu ekranu w trakcie aktywnej misji, nie tylko raz globalnie — prostsze
      niż śledzenie "czy user już widział"): dwa zagnieżdżone `Animated.View`, zewnętrzny
      interpoluje `scale` 3.2→1 i `translateY` -90→0 (start "duży i wysoko", tam gdzie siedział
      dawny portret), wewnętrzny to NIEZMIENIONY `missionBounce`/`missionSwayRotate` (bounce +
      lekkie wahadło, amplituda wahadła zmniejszona z ±7° do ±4° pod mały rozmiar). Pasek
      (`missionBarTrack`) przebudowany z cienkich 4px na grubą pigułkę 30px, pełna szerokość
      `catCol` (było sztywne 140px) — wypełnienie to `LinearGradient` + zapętlona "fala"
      (`missionBarWave`, jasny ukośny pasek przesuwający się `translateX`, przycięty
      `overflow:hidden`-em `missionBarFillWrap`-a do aktualnej szerokości wypełnienia, nie
      trzeba znać jej w px). Nad paskiem nowy `missionHeadRow`: nazwa miejsca podróży (lewo) +
      odliczanie (prawo) zamiast osobnej linijki tekstu pod spodem. Nazwy miejsc = nowe pole
      `MiniBoss.destination` w `minibosses.ts` (8 nazw dopasowanych tematycznie do zwierzaka,
      np. Kapibara Chillu → "Leniwe Bajoro", Harpia Wichru → "Wichrowy Szczyt") — odczytywane
      przez `missionMb = minibossForMission(missionStartedAt)`, TĘ SAMĄ deterministyczną
      funkcję którą `boss-fight.tsx` już wołał do wyboru przeciwnika PO powrocie — nazwa
      miejsca na scenie i przeciwnik w walce są więc ZAWSZE tym samym zwierzakiem (zero
      nowego stanu, tylko wcześniejszy odczyt istniejącej czystej funkcji). "Wróć natychmiast"
      (anulowanie bez nagrody, `onCancelMission`) zostaje małym podkreślonym linkiem pod
      paskiem — patrz Runda 3 niżej za design potwierdzenia.
    - **Bez emoji przy nazwie miejsca (2026-08-24)** — user: "wyrzucić emotkę z nazwy tych, nie
      lubię emotek" (screenshot: "🐳 Otchłań Oceanu" na pasku misji). Oba miejsca renderujące
      `${missionMb.emoji} ${missionMb.destination}` (`app/pet.tsx` pasek misji na scenie i
      `app/boss-fight.tsx` popup "Pupil w trakcie podróży") pokazują TERAZ samo
      `missionMb.destination`, bez prefiksu emoji. `MiniBoss.emoji` w `minibosses.ts` ZOSTAJE
      nietknięte — to osobne pole, dalej używane jako avatar zwierzaka W WALCE
      (`minibossAsBoss`), user prosił o usunięcie emoji z NAZWY miejsca, nie z pola emoji w ogóle.
    - **Runda 3 — brak designu na potwierdzeniu + pełnoekranowy blok zamiast popupu**
      (2026-08-20, user: "komunikat wróć natychmiast z potwierdzeniem nie ma designu, i tak
      samo zamiast full screen powiadomien jak pupil jest w misji to zrób mini popup window").
      Dwa osobne fixy: (1) `onCancelMission` w `app/pet.tsx` wołał gołego `Alert.alert`
      (systemowa, nieostylowana skrzynka) zamiast istniejącego `ConfirmDialog.tsx` — komponent
      zbudowany DOKŁADNIE po to (2026-08-11, patrz komentarz w pliku: "potwierdzenia przed
      usunięciem nie są customowe, są jakimiś kwadratami bez naszego stylu"), po prostu
      przeoczony przy dodawaniu anulowania misji (2026-08-19). Zamienione na stan
      `cancelMissionConfirm` + `<ConfirmDialog destructive .../>`, ten sam wzorzec co
      potwierdzenia ulepszeń HP/ATK na tym samym ekranie; nieużywany już import `Alert`
      usunięty. (2) `app/boss-fight.tsx` — próba wejścia w walkę KTÓREGOKOLWIEK trybu
      (kampania/raid/event/mad, też bezpośrednio `?kind=mission`) podczas gdy pupil jest w
      drodze (`missionAway`) renderowała statyczny tekstowy blok wypełniający całą treść
      ekranu (`s.done`/`s.lockBox`). Zastąpione małym wyśrodkowanym `Modal`-em
      (`missionAwayOverlay`/`missionAwayCard`, ta sama karta-na-przyciemnionym-tle stylistyka
      co `ConfirmDialog`) z nazwą miejsca podróży (`missionMb.destination`, TERAZ czytane
      niezależnie od `missionReady` — patrz zmiana w gatingu niżej), cienkim paskiem postępu,
      odliczaniem, przyciskiem "Wróć do ekranu" (`router.back()`) i CZERWONYM "Wróć
      natychmiast" (otwiera TEN SAM `ConfirmDialog` wzorzec, osobny stan
      `missionCancelConfirm` lokalny dla tego ekranu). Treść scrolla za popupem to teraz
      pusty `<View style={s.done} />` — cała reszta (kod bossa/itemów/ataku) i tak jest
      niedostępna dopóki `missionAway`. Gating: `missionMb` (surowe dane zwierzaka/miejsca)
      odczytywane teraz ZAWSZE gdy `missionStartedAt` istnieje (gotowa LUB w drodze), ale
      `missionBoss`/`target` (realny cel do ataku) zostają gated WYŁĄCZNIE na `missionReady`
      — rozdzielenie żeby popup mógł pokazać nazwę miejsca przed powrotem, bez ryzyka że dałoby
      się zaatakować przedwcześnie. `fmtMissionDuration` (było lokalną, niewyeksportowaną
      funkcją w `app/pet.tsx`) przeniesione do `utils/missions.ts` jako eksport — `boss-fight.
      tsx` potrzebował identycznej logiki formatowania, duplikowanie zamiast reużycia byłoby
      dokładnie tym czego CLAUDE.md zabrania.
    - **Runda 4 — per-item grafiki NIGDY nie były renderowane + sprzedaż itemów** (2026-08-20,
      user: (1) "dodałeś ze ikony te które dodam wyświetlają sie jako w tych kafelkach u
      pupila?" (2) "co robimy z itemami co sa słabsze ale je mamy w eq? mozna je sprzedać?
      jak tak dodaj przycisk sprzedaj z potwierdzeniem"). (1): `GearItemDef.icon`
      (`ImageSourcePropType`, `require()` per plik w `assets/ekwipunek/<slot>/`) istniało w
      `gear.ts` od kroku 1 dla WSZYSTKICH 30 itemów, ale ŻADNE miejsce w apce go faktycznie
      nie renderowało — flankujące sloty (obie rundy), sklep dnia (`pet-shop.tsx`) i reveal
      skrzynki (`BoxRevealModal.tsx`) wszystkie leciały na `SLOT_META[slot].icon` (generyczna
      emoji/ikona KATEGORII slotu, nie konkretnego itemu) — README w `assets/ekwipunek/`
      obiecywało "wrzuć plik o tej nazwie, apka go od razu podłapie", co było FAŁSZYWE aż do
      tego commitu. Fix (scope: `GearPanel.tsx`, tam gdzie user pyta o "kafelki u pupila"):
      flankujący `slotButton` renderuje TERAZ `<Image source={equippedItem.icon}>` gdy slot
      ma coś założonego (puste sloty ZOSTAJĄ na `SLOT_ICON` — nie ma czego pokazać), a każdy
      wiersz w `GearSlotModal` dostał `itemImg` (44×44, obwódka koloru rarity) przed
      nazwą/statem. `pet-shop.tsx`/`BoxRevealModal.tsx` NIE dotknięte w tym PR-ze (dalej
      emoji kategorii) — user pytał konkretnie o kafelki Pupila, rozszerzenie na
      shop/reveal to świadomie odłożony follow-up, patrz NEXT_STEPS.md. (2): nowy
      `gearSellValue(item, rarity)` w `gear.ts` — 40% tego co ten sam tier/rarity kosztowałby
      w sklepie dnia (`TIER_BASE_COST`/`DAILY_RARITY_COST_MULT`, też słuszące `dailyShopSlots`)
      — celowo MNIEJ niż cena kupna (kup-i-sprzedaj nie może być darmowym arbitrażem), ale
      realna wartość za coś czego już nie używasz. Nowa akcja `petStore.sellGear(itemId)` —
      usuwa z `ownedGear`, AUTO-zdejmuje ze slotu jeśli akurat założony (`equippedGear`), dodaje
      monety, zwraca zarobioną kwotę. UI: mały podkreślony link "Sprzedaj +X 🪙" pod
      przyciskiem Załóż w każdym wierszu `GearSlotModal`, otwiera ISTNIEJĄCY `ConfirmDialog`
      (destructive, wzorzec z Rundy 3 wyżej) z komunikatem ostrzegającym jeśli item jest akurat
      założony ("Zostanie zdjęty ze slotu"). Testy: `__tests__/gear.test.ts` (4 nowe, formuła
      `gearSellValue` — 40% T1 common, monotoniczność wg rarity, minimum 1 moneta, tier5 >
      tier1) — `sellGear` w petStore.ts NIE testowany bezpośrednio (żaden test w tym repo nie
      importuje `petStore.ts` wprost, wymagałoby mockowania AsyncStorage/zustand persist —
      ten sam brak co reszta store'owych akcji, konsekwentne z istniejącą konwencją).
    - **Runda 5 — skrzynki sardynek (głaskanie) nie dropiły ekwipunku + follow-up sklepu z
      Rundy 4** (2026-08-21, user: (1) "ze skrzynek kupowany w sklepie nie dropi ekwipunek"
      (2) "dodaj w sklepie te same ikony co w slotach i dodaj za ile odświeża sie sklep,
      codziennie o 6:00"). (1): user mylił DWA równolegle istniejące, podobnie nazwane
      systemy skrzynek — `crates.ts`'s `rollCrate()`/`CrateTier` (`pendingCrates`,
      przyznawane za głaskanie, otwierane `CrateModal.tsx`) miało TYLKO monety+itemy bojowe,
      NIGDY nie losowało gear; `petBoxes.ts`'s `LOOT_BOXES`/`rollBox()` (kupowane w
      `pet-shop.tsx`, otwierane `BoxRevealModal.tsx`) miało gear-drop poprawnie podpięty od
      kroku 1. Fix mostkuje `openCrate()` w `petStore.ts` do REUŻYCIA gotowych, dostrojonych
      szans `boxById('sardine').gearChance`/`gearRarityWeight` z `petBoxes.ts` (żadnej nowej
      tabeli tierów) — losuje item z `unlockedGearFor` dla wszystkich `GEAR_SLOTS`, przyznaje
      TYLKO jeśli rzucona rzadkość jest LEPSZA niż to co user już ma w tym slocie (żeby
      głaskanie nie zaśmiecało ekwipunku gorszymi duplikatami). `pickWeighted<T>` w
      `petBoxes.ts` wyeksportowane (było prywatne) do reużycia zamiast duplikowania ważonego
      losowania. `CrateModal.tsx` — nowy blok reveal z `<Image source={gearById(id).icon}>` +
      etykietą rzadkości, ten sam wzorzec co Runda 4 dla `GearSlotModal`. (2): follow-up z
      Rundy 4 wyżej ("`pet-shop.tsx`/`BoxRevealModal.tsx` NIE dotknięte... świadomie odłożony
      follow-up") — teraz zrobiony: `pet-shop.tsx`'s wiersze Sklepu dnia i
      `BoxRevealModal.tsx`'s karta nagrody dostały `<Image source={item.icon}>` zamiast
      `SLOT_META[slot].icon` (generyczna emoji kategorii). Licznik odświeżenia: nowy
      `SHOP_REFRESH_HOUR = 6` + `shopDayKey()`/`fmtShopRefresh()` w `pet-shop.tsx` — rolluje
      się o 6:00 rano zamiast o północy jak zwykłe `todayKey()`, bo user chciał konkretnie
      "sklep dnia" żeby trzymał zestaw przez noc do rana, nie znikał o północy. CELOWO wąski
      zasięg — TYLKO 3 call site'y `dailyShopSlots`/`onBuyDaily`/render tied do gwarantowanego
      sklepu dostały `shopDayKey()`; `dailybox:${todayKey()}` (darmowa skrzynka dnia,
      niepowiązana) i globalne serie/nawyki zostają na kalendarzowej północy — to samo
      "static-at-render-time" co `fmtEnergyCountdown`/`fmtMissionDuration`, licznik NIE tyka
      co sekundę (user i tak wraca na ekran co jakiś czas).
    - **Runda 6 — unik/kryt jako kafelki, nie tekst** (2026-08-21, user: "tam te statystyki
      unik+ kryt dodaj jako kafelki pod spodem bo dziwnie wyglądają jako tekst") — `app/pet.tsx`'s
      grid "Siła bojowa" (`s.statGrid`, `flexWrap`, kafle `width:48%`) kończył się ATK/HP/Prób
      dziennie/Misja, a łup bossów (dodge/crit z `bossBonuses`) dostawał osobny wolnostojący
      `Text` (`s.blurb`) POD gridem — jedyny tekstowy element wśród samych kafli. Zamienione na
      2 kolejne `statCard` WEWNĄTRZ tego samego `s.statGrid` (dorabiają 3. wiersz dzięki
      `flexWrap`) — `Wind` (cyan `#22D3EE`) dla uniku, `Target` (fiolet `#C084FC`) dla krytu,
      ten sam layout co reszta gridu (ikona/wartość/etykieta/podpis), każdy renderowany TYLKO
      gdy odpowiedni bonus > 0 (jak stary warunkowy tekst).
    - **Runda 7 — kotek na pasku misji: chód zamiast skoku, większy, jasna otoczka na
      ciemnym futrze + kwadratowy fluid** (2026-08-21, user: (1) "kotka skaczące lekko na
      boki jakby szedł na prawdę a nie skakał", (2) "większego o 15-20% zeby byl w tym pasku
      realnie", (3) "jeżeli jest wybrany ciemny kolor to dawaj mu chyba jasna otoczkę zeby go
      było jakis widać", (4, osobna wiadomość ze screenshotem) "ten pasek ładowania niech sie
      ładuje w kształcie a nie randomowo bo ładujący sie fluid jest w postaci kwadratu a sam
      pasek [jest] zaokrąglone". (1): dawny PIONOWY `missionBounce` (hop ±6px co 320ms)
      USUNIĘTY CAŁKOWICIE — czytał się jak podskakiwanie. Chód to teraz JEDEN wzorzec: to samo
      wahadło `missionSway` napędza RÓWNOCZEŚNIE `missionSwayRotate` (obrót, bez zmian) I nowy
      `missionSwayX` (przesunięcie ±3px W TĘ SAMĄ STRONĘ co przechył) — przenoszenie ciężaru w
      bok jak przy prawdziwym chodzie, zamiast pionowego hopu. (2): nowa stała
      `MISSION_CAT_SIZE=26` (było zaszyte inline `22`, +18%, środek żądanego 15-20%) —
      `missionBarCatWrap`'s `top`/`marginLeft` doliczone pod nowy rozmiar. (3): `luma()` z
      `catPalettes.ts` WYEKSPORTOWANE (był private) — `catCoatIsDark = luma(palette.coat) <=
      0.55`, TEN SAM próg co `markFor()` już używa do jasne/ciemne pręgi (jedna prawda, nie
      druga zgadywana granica). Gdy ciemne — nowy `s.missionCatHalo` (biały okrąg
      `rgba(255,255,255,0.55)`, 10px większy niż kotek, wyśrodkowany) renderuje się ZA kotkiem
      (sibling przed `Animated.View` w drzewie, `pointerEvents="none"`) — ciemny kotek (czarny/
      szary/brązowy) wtapiał się w ciemne tło paska (`c.bg.elevated`, ciemny motyw apki) bez
      tego. (4): `missionBarFillWrap` miało jednolite `borderRadius:15` na WSZYSTKICH 4 rogach
      — przy małym postępie (wąskie wypełnienie, mniej niż 2×15px) dawało zdegenerowany,
      kwadratowo wyglądający kształt zamiast pigułki (widoczne na screenshocie usera: mały
      niebieski "klocek" zamiast zaokrąglonego skrawka). Fix: TYLKO lewe rogi zaokrąglone
      (`borderTopLeftRadius`/`borderBottomLeftRadius: 15`, prawe = 0) — semantycznie POPRAWNE
      niezależnie od tego (rosnąca prawa krawędź wypełnienia POWINNA być prosta, nie
      zaokrąglona — zaokrąglenie ma sens tylko tam gdzie wypełnienie styka się z zaokrąglonym
      lewym kapslem `missionBarTrack`), więc naprawia problem przy KAŻDEJ szerokości, nie tylko
      przy małym postępie.
    - **Fix: kotek wystawał za dużo poza pasek (2026-08-24)** — user ze screenshotem: "kotek
      musi być bardziej w tym pasku... wystaje za dużo". Pasek (`missionBarTrack`) miał tylko
      30px wysokości dla 26px kotka — realnie wyrenderowana sylwetka SVG (naturalny "oddech"
      wokół właściwego kształtu w viewBoxie) wizualnie przekraczała krawędzie przy tak małym
      marginesie. Rozwiązanie: powiększony pasek (nowa stała `MISSION_BAR_HEIGHT=34`) zamiast
      pomniejszenia kotka z powrotem — user WCZEŚNIEJ explicit prosił o większego kotka (Runda
      7 wyżej), więc cofnięcie tamtej zmiany byłoby sprzeczne z jego własną prośbą; więcej
      miejsca w pasku daje oddech obu stronom naraz. `missionBarCatWrap`'s `top`/`marginLeft`
      przepisane z zaszytych liczb na FORMUŁĘ (`(MISSION_BAR_HEIGHT - MISSION_CAT_SIZE) / 2`
      / `-MISSION_CAT_SIZE / 2`) — przeżyje kolejną zmianę rozmiaru bez ręcznego przeliczania
      magicznych liczb, ten sam wzorzec co inne stałe-sterowane style w tym pliku.
    - **ODWRÓCONE: kotek stoi w miejscu tam gdzie był timer, pasek dostaje dokładny licznik
      M:SS** (2026-08-26, user: "zróbmy na odwrót jego spacerujacego w miejscu tam gdzie jest
      czas teraz, i on będzie miał te animacje tyle że w miejscu, a zamiast niego w pasku będzie
      dokładny czas w minutach i sekundach jakiś ładny licznik"). `missionBarCatWrap` (kotek
      jeżdżący `left: {progress}%` po pasku) USUNIĘTY — kotek przeniesiony do `missionHeadRow`
      (prawa strona, tam gdzie dawniej siedział statyczny `missionTimerTxt`, teraz USUNIĘTY),
      nowy `missionHeadCatWrap` (stały rozmiar `MISSION_CAT_SIZE`, bez `left`-owej matematyki).
      Zachowane BEZ ZMIAN te same dwie animacje co dawniej na pasku: `missionEnter` (wejście
      duży→mały) i `missionSway` (translateX+rotate = "chód w miejscu", nigdy nie zależał od
      pozycji na pasku, więc przeniósł się 1:1). `missionEnterY` outputRange zmniejszony z -90
      na -40 — krótszy dystans wejścia, bo cel (`missionHeadRow`) leży bliżej góry
      `stageMissionWrap` niż dawny pasek. `missionCatHalo` (jasna otoczka na ciemnym futrze)
      zostaje, po prostu renderowana w nowym miejscu. Sam pasek (`missionBarTrack`) NIE stracił
      wizualizacji postępu — wypełnienie + fala `missionBarWave` zostają BEZ ZMIAN, tylko
      centralnie na całym pasku doszedł nowy `missionBarCountdownWrap`/`missionBarCountdownTxt`:
      biały tekst z cieniem (czytelny i na ciemnym torze, i na niebieskim wypełnieniu),
      `fontVariant:['tabular-nums']` żeby cyfry nie "skakały" szerokością co sekundę. Nowa
      funkcja `fmtMissionCountdown(ms)` w `missions.ts` (M:SS / H:MM:SS, zaokrągla do pełnej
      sekundy) — CELOWO osobna od `fmtMissionDuration` (ta zaokrągla do minut, używana tam gdzie
      licznik NIE tyka co sekundę: staty pod spodem, `boss-fight.tsx`, `TopPill`). Żeby licznik
      faktycznie miał sekundy, `missionTick`'s `setInterval` przyspieszony z 30s na 1s (był
      wystarczający gdy pokazywał tylko minuty) — z nowym auto-stopem: interval sam się czyści
      w momencie gdy `missionEndsAt` mija (misja staje się gotowa), więc nie tyka bez sensu co
      sekundę w nieskończoność, dopóki user nie wróci stoczyć walki.
    - **BUG: wypełnienie paska wychodziło poza zaokrąglony kształt przy małym progresie
      (2026-08-27)** — user ze screenshotem: "pasek misji w trakcie wychodzi poza [ramkę],
      dziwnie się rozciąga zamiast wypełniać". Przyczyna: `missionBarFillWrap`'s wypełnienie
      liczone w PROCENTACH (`width: {progress*100}%`), a lewy zaokrąglony kapsel paska
      (`borderTopLeftRadius`/`borderBottomLeftRadius = MISSION_BAR_HEIGHT/2` = 17px) potrzebuje
      co najmniej 17px szerokości żeby poprawnie się wyrenderować. Przy świeżo zaczętej/długiej
      misji `missionProgress` bywa ułamkiem procenta — przeliczony na px dawał węższe
      wypełnienie niż promień zaokrąglenia, a Android nie przycinał tego poprawnie (ta sama
      rodzina co dawny bug z przycinaniem kotka na kaflu dashboardu — `overflow:hidden` +
      geometria mniejsza niż promień, gdzieś się gubi). Cienki, kwadratowy pasek gradientu
      wystawał poza zaokrąglony kształt zamiast być w nim zamknięty. Fix: nowa
      `missionBarFillPx(progress, trackWidthPx, minPx)` w `missions.ts` — liczy wypełnienie w
      PX (nie %) z twardym minimum `MISSION_BAR_HEIGHT`, dokładnie tyle ile trzeba żeby lewy
      kapsel zawsze miał miejsce na poprawne zaokrąglenie; `progress<=0` daje 0 (pusty pasek,
      żeby nie sugerować fałszywego postępu — podłoga działa TYLKO gdy progres realnie > 0).
      `missionBarTrack` dostał `onLayout` mierzący jego rzeczywistą szerokość w px
      (`missionBarWidthPx` state) — przed pierwszym layoutem fallback na starą wersję
      procentową (jedna klatka, nieszkodliwe). Test regresji w `fmtMissionCountdown.test.ts`.
  - **Jasna otoczka za ciemnym kotkiem na pasku misji USUNIĘTA (2026-08-30)** — dodana
    2026-08-21 (user: "jeżeli jest wybrany ciemny kolor to dawaj mu chyba jasną otoczkę żeby
    było jakoś widać"), ale user teraz (ze screenshotem czarnego kota "Fafik"): "czemu jak
    mam czarnego kota to jakieś kółko się pojawia pod nim, wywal je xd" — w praniu wyglądała
    jak nieproszony szary krążek za malutkim (`MISSION_CAT_SIZE`) kotkiem, nie jako subtelny
    kontrast. `catCoatIsDark`/`missionCatHalo`/`luma` import CAŁKOWICIE usunięte z `pet.tsx`
    (nieużywane nigdzie indziej w pliku) — kotek na pasku misji renderuje się teraz zawsze
    bez halo, niezależnie od koloru futra.
  - **Seria logowań przeniesiona na dashboard + usunięty tip "Smacznie śpi"** (2026-08-21,
    user: (3) "serię logowan przenieśmy na główny pulpit" (4) "wywalmy te dodatkowy napis
    obok kotka co pisze smacznie śpi"). (3): `loginStrip` (Flame + "Seria logowań: X dni" +
    podgląd jutrzejszego bonusu `loginBonusCoins`) PRZENIESIONY z `app/pet-shop.tsx` do
    `app/(tabs)/index.tsx`'s `nodes['pet']`, tuż pod kaflem `PetTile` — user prosił o
    "przenieś", nie duplikat, więc pasek + jego style (`loginStrip`/`loginTxt`/`loginNext`)
    i destrukturyzacja `loginStreak`/import `loginBonusCoins` USUNIĘTE ze sklepu całkowicie.
    Sensowne miejsce i tak, skoro `registerLogin()` jest wołane właśnie z mount `useEffect`
    w `index.tsx` (bonus przyznawany "przy wejściu na pulpit", zgodnie z dawnym komentarzem
    przy starym miejscu w sklepie). (4): `PetTile.tsx` (kafel pupila na dashboardzie) — pod
    statusem (`pet.label`, np. "Zadowolony") renderował dodatkową linię `petStatusLine(pet)`
    (np. "Smacznie śpi 💤" po 22:00), user uznał ją za zbędną. Linia USUNIĘTA CAŁKOWICIE (nie
    zamieniona na nic) — kafel z `claimable > 0` dalej pokazuje pasek "X nagród do odbioru",
    tylko brakuje mu teraz fallbacku gdy nic nie ma do odebrania. `petStatusLine`/
    `computePetState` w `utils/petState.ts` BEZ zmian (dalej używane w `app/pet.tsx`'s
    pełnym ekranie Pupila, tam user nic nie zgłaszał).
  - **Level-up celebration** (2026-08-19, user: "musimy dodac info o levelup pupila...
    powiadomienie z confetti albo fajna animacja") — baner spadający z góry na 3,2s +
    `Confetti` (reużyty z `achievements/Confetti.tsx`), LŻEJSZY niż `BadgeCelebration.tsx`
    (ta jest pełnoekranowym blokującym `Modal` dla osiągnięć; level-up to zwykły
    absolutnie-pozycjonowany `View` jak `Toast.tsx`, nie blokuje interakcji).
    - **`petStore.lastSeenLevel`** — ostatni poziom, dla którego POKAZANO celebrację.
      Migracja dla starych zapisów ustawia go na AKTUALNY poziom (nie 1!) — inaczej
      istniejący gracz na Lv20 dostałby lawinę "Poziom 2! 3! ... 20!" przy najbliższym
      zdobyciu XP (ta sama pułapka co `onboarded` opisana wyżej).
    - **Wykrywanie w `app/_layout.tsx`** (nie w żadnym ekranie Pupila) — `useEffect`
      porównujący `levelFromXp(xp).level` z `lastSeenLevel` na KAŻDĄ zmianę `xp`. xp rośnie
      z wielu miejsc (walki/questy/careTick), a `_layout.tsx` to jedyny komponent
      zamontowany przez całą sesję niezależnie od aktualnego ekranu — inaczej level-up
      zdobyty np. w `boss-fight.tsx` mógłby przepaść, gdyby user od razu wyszedł z apki.
    - **`src/store/petLevelUpStore.ts`** — kolejka `number[]` (ten sam wzorzec co
      `celebrationStore.ts` dla osiągnięć, osobny bo inny kształt danych/komponent).
      `ackPetLevel()` (petStore) PRZESUWA `lastSeenLevel` dopiero PO faktycznym
      zamknięciu banera (`LevelUpCelebration.tsx`, tap albo auto-timer), nie w momencie
      wykrycia — zabity proces w trakcie animacji nie "zjada" level-upu bezpowrotnie,
      wróci przy następnym starcie.
    - Baner dodatkowo podkreśla przejście progu wzrostu (`STAGE_START_LEVEL`: 3→kid,
      6→teen, 12→adult, lustro `growthStage()`) — "Pupil urósł — teraz to nastolatek!"
      zamiast generycznego tekstu, gdy level-up akurat trafia na próg.
    - **Runda 2 — sam emoji + confetti niewystarczające** (2026-08-20, user po zobaczeniu na
      żywo: "ten toast powiadomienie levelupu pupila zrob lepiej teraz jest tylko emotka i
      confetii i nie wiadomo o co chodzi xd") — 🎉 obok numeru poziomu wizualnie ginęło przy
      confetti, banner niósł mało informacji poza samym numerem. Emoji zastąpione kolorową
      odznaką (`st.badge`, koło #FBBF24) z ikoną lucide `ChevronsUp` — jednoznaczny motyw
      "awansu", nie ozdobnik. Dodany kicker "AWANS POZIOMU" (`st.kicker`, mały, wielka litera,
      letter-spacing) NAD numerem poziomu, TEN SAM wzorzec co `vKicker` w victory modalu
      bossów (`boss-fight.tsx`) — spójny język "to jest DUŻA wygrana" w obu miejscach. Nowy
      mini pasek XP pod tekstem (`st.xpRow`/`xpTrack`/`xpFill`) pokazujący "{lvl.inLevel}/
      {lvl.needed} XP" — liczone `levelFromXp(xp)` z ŻYWEGO `xp` w `petStore` (nie
      zamrożonego na moment wykrycia level-upu), więc jeśli w międzyczasie doszło więcej XP
      zanim baner się pokazał, pasek pokazuje PRAWDZIWY aktualny stan, nie stary snapshot.
      `AUTO_DISMISS_MS` wydłużony 3200→4200ms — więcej treści do przeczytania niż sam numer.
    - **BUG: cały tekst z Rundy 2 znikał, widać było TYLKO odznakę z ikoną (2026-08-22)** —
      user ze screenshotem: "jak dostaje lewel to nic [tekstu] oprócz [ikonki] nie jest
      napisane". Przyczyna: `card` (Pressable, `flexDirection:'row'`) miał tylko
      `maxWidth: 360`, NIGDY realny `width`. `wrap` centruje przez `alignItems:'center'`, co
      daje `Animated.View`/`card` szerokość "po zawartości" (hug-content), nie stałą — a RN
      `flex:1` to skrót na `flexBasis:'0%'` ("zacznij od zera, rośnij w DOSTĘPNĄ przestrzeń").
      Bez definitywnej szerokości rodzica kolumna tekstu (`flex:1`, kicker+tytuł+opis+pasek
      XP) nie ma w co rosnąć i zapada się do 0px — sąsiadująca sztywna 44px odznaka z ikoną
      renderuje się normalnie, cały tekst realnie się renderuje, tylko o szerokości zero.
      Fix: `useWindowDimensions()` liczy REALNĄ szerokość karty (`Math.min(screenW-40, 360)`)
      i podaje ją jako jawny `width` na `card` zamiast samej górnej granicy — to daje
      wewnętrznemu `flex:1` definitywną podstawę do policzenia dostępnej przestrzeni. Ten sam
      wzorzec-pułapka (centrujący rodzic + `flex:1` dziecko bez width) do zapamiętania przy
      innych wyśrodkowanych bannerach/toastach w apce — zwykłe karty w listach (np. `qCard` w
      `pet-quests.tsx`) tego nie mają, bo żyją w kontenerach z jawnym `width:'100%'`.
  - **"Pomiń walkę" — przycisk pomijający animację walki, wszystkie 6 trybów naraz**
    (2026-08-20, user: "możesz dodać przycisk jak walka jakakoliwek pomiń walke?"). Kluczowa
    obserwacja umożliwiająca prosty, bezpieczny fix: wynik walki jest w 100% ROZSTRZYGNIĘTY
    w momencie kliknięcia WALCZ! — `simulateFight()` i (dla raid/nemesis) `raidAttack()`/
    `menaceAttack()`, a dla reszty trybów `spendEnergy()`, wołane SYNCHRONICZNIE w
    `attackRoundBased()` PRZED odtworzeniem animacji (`playerBeat`/`counterBeat` łańcuch
    `setTimeout`). Cała animacja to więc czysto KOSMETYCZNE odtworzenie już gotowego
    `result` — skip nie może "zepsuć" ani zmienić wyniku, bo wynik już istnieje. Implementacja:
    nowy `skipFightRef` (`useRef<(() => void) | null>`, bo `finish()`/`roundTimer` żyją w
    domknięciu `attackRoundBased()`, ustawiane na nowo przy KAŻDYM ataku) — ustawiany tuż
    przed pierwszym `playerBeat()`, czyszczony w `finish()`. `skipFight()` (przycisk) czyści
    pending `roundTimer`, resetuje stan lotu łap/pazurów (`pawFlying`/`boltFlying`) i ostatnich
    trafień (`catHit`/`lastHit`) żeby nic nie zostało "w locie" pod modalem wygranej/przegranej,
    i woła `finish()` wprost. Przycisk (mały, podkreślony tekst pod głównym "WALCZ!") widoczny
    TYLKO gdy `fighting===true` — jedna wspólna implementacja dla kampanii/raidu/wydarzenia/
    questa/MAD/misji, bo `attackRoundBased()` to już jedna wspólna funkcja dla wszystkich 6.
  - **BUG: energia kampanii nigdy realnie się nie ładowała** (2026-08-19, user: "energia nie
    ładuje się wcale, pisze ciągle że za 3h odnowienie... czekam od wczoraj i nic") —
    `onRehydrateStorage` (`petStore.ts`) odpala się przy KAŻDYM starcie apki (nie tylko raz po
    update). Migracja energii z 2026-08-18 zerowała `energyRegenAt` BEZ WARUNKU przy każdej
    hydratacji, więc już tykający zegar (np. "zostało 40 min") dostawał reset do pełnych 3h za
    każdym razem gdy user zamknął i otworzył apkę — na telefonie to prawie ZAWSZE między
    sprawdzeniami, więc licznik nigdy realnie nie mógł dojść do zera. Fix: migracja teraz
    gated za `state.energyRegenAt === undefined` (naprawdę stary stan sprzed wprowadzenia tego
    pola) — jeśli pole już istnieje (`null` po migracji, albo prawdziwa tykająca data), zostaje
    NIETKNIĘTE. Przy okazji: prawy górny róg `app/bosses.tsx` dostał DRUGĄ pigułkę energii
    (czerwoną, `eventEnergy` — user: "timer z ładowaniem energii niebieskiej kampanijnej i
    czerwonej na bossy eventowe wspólnej"), obok niebieskiej kampanijnej; mini-karta wydarzenia
    dostała ten sam czerwony kolor (było błędnie niebieskie, jak kampania/raid).
  - **BUG: kotek atakował "dodatkowo" martwego bossa w raid/nemesis** (2026-08-19, user:
    "często w walce pod koniec kotek atakuje 2 raz jakby czasami nawet jak przeciwnik ma zero
    HP") — sesja raid/nemesis (patrz "sesja-wobec-trwałej-puli" wyżej) ZAWSZE animuje pełną
    długość `result.rounds` (liczoną wobec MAŁEGO sesyjnego celu), ale PRAWDZIWA, trwała pula
    mogła mieć MNIEJ HP niż cała sesja — przeliczona na realną skalę `liveBossHp` dochodziła
    wtedy do 0 W ŚRODKU sesji, a animacja mimo to grała dalej wszystkie pozostałe rundy
    (fikcyjne dodatkowe ciosy w już martwego bossa, czasem z fikcyjnym kontratakiem od trupa).
    Prawdziwy wynik (`raidOutcome`/`menaceOutcome`) jest już policzony RAZ, PRZED animacją
    (`raidAttack`/`menaceAttack`) — `attackRoundBased()` w `boss-fight.tsx` teraz sprawdza w
    `playerBeat()`, czy przeliczona realna skala właśnie spadła do 0 (`realDead`), i jeśli tak,
    skacze prosto do `finish()` zamiast kontynuować fikcyjne rundy — pomija też kontratak TEJ
    rundy (martwy boss nie kontratakuje, tak samo jak `simulateFight` już robi wewnętrznie).
    - **Kampania/questy NIE miały tego buga** (dochodzenie 2026-08-19, user pytał "a w
      kampanii i w daily/questach?") — przejrzany świeży log walk questowych nie pokazał ANI
      JEDNEJ fikcyjnej rundy; to co wyglądało jak "atak na martwego bossa" to boss przy 1-20
      HP (żywy, ale wizualnie prawie pusty pasek) + kontratak zaokrąglony do 0 (patrz bug
      niżej) — myląca kombinacja, nie realny duplikat. Diagnoza PRZEZ dane (nie zgadywanie)
      potwierdziła że rescaling z powyższego buga jest UNIKALNY dla raid/nemesis.
  - **BUG: kontratak zaokrąglał się do 0 przy niskim HP bossa, mimo że boss żył** (2026-08-19,
    user po przejrzeniu logu: boss przy 1 HP miał kontratak "0", co wyglądało jak dodatkowy,
    niewywołany cios w kolejnej rundzie) — `counterDamage()` (`bosses.ts`) liczyła
    `Math.round(currentBossHp × COUNTER_PCT × ...)`, a przy bardzo niskim HP (np. 1 HP ×
    0.05 = 0.05) to się zaokrąglało w dół do gołego zera — boss TECHNICZNIE żywy, ale
    wizualnie "nie kontratakuje", myląco sugerując że już padł. Żywy boss (`hp > 0`) zadaje
    TERAZ zawsze `Math.max(1, ...)` — co najmniej 1 obrażenie na kontratak, niezależnie jak
    mało HP mu zostało. Martwy boss (`hp <= 0`) dalej zwraca 0 bez zmian. Osobny mechanizm
    CAŁKOWITEGO uniku (item `dodge`) nadal potrafi wyzerować to PO FAKCIE w `simulateFight` —
    ta zmiana dotyczy tylko bazowego wyliczenia, nie efektów itemów. Drobny, ograniczony wpływ
    na całkowity dmg w walce (+1 max w ostatnich 1-2 rundach każdej walki) — nie wymagało
    ponownej pełnej symulacji balansu z audytu `COUNTER_PCT` wyżej.
  - **Energia: pigułki w prawym górnym rogu W KOLUMNIE, nie w rzędzie** (2026-08-19, user:
    "energia eventowych ma być czerwona i wspólna dla obu w prawym górnym, i pod nią energia
    zwykła niebieska pod kampanię") — `app/bosses.tsx` header: czerwona pigułka (`eventEnergy`)
    NA GÓRZE, niebieska (`energy`, kampania/MAD) POD NIĄ (`s.energyPillCol`,
    `flexDirection:'column'`, było `energyPillRow`/`row`).
    - **Odliczanie przeniesione na LEWO od każdej pigułki + nowe dla czerwonej (2026-08-22)**
      — user: "to odliczanie do następnej energii... możesz dodać po lewej od energii i
      dodać dla czerwonej też taki licznik?". Dawniej JEDEN wspólny tekst odliczania
      (`s.energyCountdown`) żył POD obiema pigułkami (ostatni element kolumny) i dotyczył
      TYLKO niebieskiej (`energyRegenAt`) — czerwona nie miała żadnego licznika. Teraz każda
      pigułka ma WŁASNY wiersz (`s.energyRow`, `flexDirection:'row'`) z tekstem odliczania
      jako lewym sąsiadem, zamiast jednego zbitego napisu pod spodem całości. Czerwona
      (event+raid, wspólna pula od 2026-08-22, patrz komentarz przy `raidWeek` w
      `petStore.ts`) dostała analogiczny licznik, ale liczy do NAJBLIŻSZEJ LOKALNEJ PÓŁNOCY
      (`nextLocalMidnightIso()`), nie do zapisanego `energyRegenAt` jak kampania — czerwona
      pula to płaski dzienny grant (`syncEventEnergy`), nie regenerujący się w czasie bank,
      więc "kolejny punkt" realnie przychodzi o północy, nie po X godzinach od ostatniego
      ataku. Pokazywana tylko gdy `eventEnergy < eventEnergyMax` (ten sam wzorzec warunku co
      niebieska, choć czerwona formalnie nie ma twardego sufitu — może się bankować ponad
      `eventEnergyMax` z nieużytych dni, licznik wtedy i tak by nic nie wnosił).
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
    - **Nazwa ćwiczenia w trakcie + "Pomiń" na czasowych (2026-08-22)** — user: "z nazwą
      ćwiczenia w trakcie wykonywania i jak jest czasowe jakieś np plank lub rozciąganie
      przycisk pomiń z potwierdzeniem tak wykonałem ćwiczenie nie kontynuuj". Dwie zmiany:
      (1) faza `active` (i timed, i reps) dostała `meta.label` jako tytuł NAD timerem/celem —
      wcześniej nazwa ćwiczenia znikała po wciśnięciu "Rozpocznij" (widoczna tylko w fazie
      `ready`), więc w trakcie robienia serii nie było widać CO się właśnie robi. (2) deska/
      rozciąganie (`TIMED`) dostały przycisk "Pomiń" pod paskiem odliczania — dotąd
      `setInterval` MUSIAŁ dobiec do zera, nie było jak zamknąć timera wcześniej, jeśli user
      faktycznie skończył ćwiczenie przed czasem. Pomiń otwiera `ConfirmDialog` (NIE
      `Alert.alert` — ten sam wzorzec co "Wróć natychmiast" w `pet.tsx`, gdzie user explicit
      odrzucił goły systemowy Alert jako "bez designu"), `destructive={false}` (to nie
      niebezpieczna akcja, zwykły plain-styl przycisk potwierdzenia) — dopiero po
      potwierdzeniu `skip()` czyści interval i przechodzi od razu do `finish()`/fazy `done`,
      dokładnie jak naturalne dobicie timera do zera. Pompki/przysiady/brzuszki (nie-timed)
      NIE dostały tego przycisku — tam nie ma na co czekać, "UKOŃCZYŁEM" już jest natychmiastowe.
    - **Przegapiony emoji w questach (2026-08-22)** — user: "jak nazwałeś te questy te miejsca
      to wywal z nich te emotki xdd". Fix 2026-08-17 wyżej ściął emoji-sufiksy tylko z
      questów TRENINGOWYCH (`b_pushups/squats/situps/plank/stretch`) — `d_pet` (DZIENNY quest
      "Pogłaszcz pupila do pełna", `note: 'zrobione ❤️'`) był poza jego zasięgiem (inna
      kategoria, dzienny nie bonusowy) i został przeoczony. Ścięty do gołego `'zrobione'`, ten
      sam wzorzec. Przy okazji: hint na dole `app/pet-quests.tsx` ("Wydaj je w sklepie 🛍️, a
      energią z nawyków walcz z bossami ⚔️") też miał dekoracyjne emoji — usunięte, sam tekst
      zostaje. Pełny skan `quests.ts`/`pet-quests.tsx` pod kątem pozostałych emoji (2026-08-22)
      nie znalazł nic więcej — 🪙 (moneta) w toastach/pigułkach nagród ZOSTAJE, to pervazywny
      wzorzec w CAŁEJ apce (dziesiątki plików), nie coś specyficznego dla questów do wycięcia
      w tym samym ruchu.
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
- **Zustand persist THROTTLED (`utils/throttledStorage.ts`, 2026-08-25)** — user: "a okiem
  specjalisty co byś jeszcze zoptymalizował?" → "zapisz wszystko i wszystko rob". Zustand's
  `persist` woła `storage.setItem()` przy KAŻDEJ zmianie stanu — dla store'a z dużym/często
  mutowanym slice'em (wydatki, kalendarz, walki pupila — kilka `set()` na rundę) to pełny
  JSON.stringify + zapis AsyncStorage przy KAŻDEJ pojedynczej akcji, nie tylko na starcie apki
  (inna klasa hotspotu niż wcześniej naprawione bugi memo). Fix: `throttledAsyncStorage()`
  (drop-in zamiennik `AsyncStorage` w `createJSONStorage(() => ...)`, wszystkie 18 store'ów w
  `src/store/`) koalescuje zapisy do TEGO SAMEGO klucza — przeżywa tylko OSTATNIA wartość po
  ~600ms bez kolejnego zapisu do tego klucza; różne store'y (różne klucze) throttlują
  niezależnie. Trade-off: do 600ms najnowszego LOKALNEGO zapisu może przepaść przy force-kill
  apki — ograniczone dwoma zabezpieczeniami: (1) `backupService.gatherSnapshot()` woła
  `await flushThrottledStorage()` ZANIM czyta surowe klucze `AsyncStorage.getAllKeys()/
  multiGet()` (backup NIGDY nie zobaczy nieaktualnej wartości), (2) `_layout.tsx` flushuje przy
  KAŻDYM przejściu `AppState` w background/inactive (nie tylko force-kill — normalne wyjście z
  apki też nie zostawia zaległego zapisu). Testy: `__tests__/throttledStorage.test.ts`.
- **Cold-start perf log (`utils/perfLog.ts`, 2026-08-25)** — ten sam wątek co wyżej: bez
  zdalnego profilera (Flipper) na urządzeniu, więc zamiast zgadywać dalsze optymalizacje "na
  oko", to REALNE liczby z telefonu usera, porównywalne build-do-buildu. `JS_START` = czas
  ewaluacji modułu (import jako PIERWSZY w `_layout.tsx`, żeby był jak najbliżej realnego
  startu apki — nie łapie natywnego czasu ładowania bundla sprzed JS, ale to i tak jedyne co
  widać z tej strony). `markDashboardFirstFrame()` (index.tsx, `useEffect` bez zależności —
  najbliższy JS-owy odpowiednik "first paint") i `recordDashboardReady()` (w tym samym
  `InteractionManager.runAfterInteractions` co `deferredReady`, patrz §4 "Staged render") razem
  dają `msToFirstFrame`/`msToReady` jednego wpisu, bufor 20 ostatnich w AsyncStorage. WAŻNE:
  `recordDashboardReady()` samo w sobie NIE jest one-shot (proste, zawsze-dopisuje, łatwe do
  testowania) — politykę "tylko raz na sesję JS, ignoruj ponowne mounty przy przełączaniu
  zakładek" pilnuje WOŁAJĄCY (`index.tsx`'s modułowa flaga `dashboardPerfLogged`, obok
  `DEFERRED_SECTIONS`), bo inaczej każdy powrót na dashboard zalogowałby myląco duży czas
  (liczony od stałego, dawnego `JS_START`). Odczyt: Ustawienia → Diagnostyka → "Wydajność
  startu apki" (ostatni start + średnia + historia, opcja wyczyszczenia). Testy:
  `__tests__/perfLog.test.ts`.
- **Wrapped/kolekcje**: `monthCards.ts`/`yearCards.ts` + `MonthWrappedCard`/`YearWrappedCard`
  (BEZ emotek — „wyglądało tanio"). `YearPixels` = rok w pikselach (viz `pixels`).
- **Nawyki/liczniki**: `utils/habits.ts` + `useHabits`, `countersStore` (dni bez / odliczania).
  `app/habit-year.tsx` = jeden ekran pixeli dla NAWYKU (`?id=`) **i** LICZNIKA (`?counter=`):
  MIESIĄC = kalendarz (Pn..Nd + numery dni), ROK = rolka GitHub. Nawyk: done=kolor nawyku,
  frozen=ICE; licznik „bez X": dzień czysto=zielony, wpadka (kupiłeś)=czerwony (z paragonów przez
  `matchesAvoid`). Seria licznika liczona OD DZIŚ; nawyku jak `getStreak` (od wczoraj gdy dziś
  jeszcze nie zrobione). Wejścia: kafle „Twoje serie" (dashboard) + ikona siatki w `/counters`.
  - **BUG: `getStreak()` (dashboard, `useHabits.ts`) tracił 1 dzień z ogona serii, gdy dziś
    jeszcze nie zaliczone (2026-08-24)** — user ze screenshotem: "jak wchodzę [w habit-year]
    jest napisane 30 dni a na kafelku [dashboard] wczoraj tez było 30, a dzisiaj jest 29".
    Pętla liczyła `for (i = start; i >= -29; i--)` — dolna granica `-29` była STAŁA, nie
    zależną od `start`. Gdy dziś zaliczone, `start=0`, pętla sprawdza `0..-29` = 30 dni
    (poprawnie). Gdy dziś JESZCZE nie zaliczone (celowo `start=-1` — dziś nie liczy się do
    serii dopóki nie zrobione), pętla dalej kończyła na `-29`, czyli sprawdzała TYLKO
    `-1..-29` = 29 dni — realna, nieprzerwana 30-dniowa seria (licząc wstecz od wczoraj)
    traciła jeden dzień z ogona i undercountowała do 29, dokładnie do momentu zaliczenia
    dzisiejszego dnia (kiedy `start` wracał na 0 i seria "cudownie" odzyskiwała 30).
    `app/habit-year.tsx` liczy TĘ SAMĄ serię NIEZALEŻNIE, bez analogicznego capu (idzie po
    pełnej sekwencji `seq`, bez sztywnej dolnej granicy) — stąd rozjazd 30 (habit-year,
    poprawnie) vs 29 (dashboard, buggy) TEGO SAMEGO dnia, nie tylko spadek dzień-do-dnia.
    Fix: dolna granica pętli WZGLĘDNA do `start` (`start - 29`) zamiast bezwzględnej `-29` —
    pętla ZAWSZE sprawdza dokładnie 30 kalendarzowych dni niezależnie od tego czy dziś już
    zaliczone. Throwaway-symulacją w node zweryfikowane: stary kod dawał 29 na dokładnym
    scenariuszu usera (30 dni z rzędu kończących się wczoraj, dziś jeszcze puste), nowy
    poprawnie daje 30.
  - **BUG #2, TA SAMA funkcja: sztywny limit 30 dni, nie tylko zła krawędź (2026-08-25)** —
    user: "wiem czym problem — na dashboardzie 29, na habit-year 31, bo tam liczy bez streak
    freeze" (screenshot habit-year: 31 dni z rzędu, kilka zamrożonych). Hipoteza usera
    BŁĘDNA — obie funkcje liczą freeze (`isDoneOrFrozen`/`frozen[...]`) — ale objaw realny:
    fix #1 wyżej poprawił TYLKO krawędź pętli w obrębie 30-dniowego okna, nie sam fakt że
    okno jest sztywno 30-dniowe (`i >= start - 29`). `habit-year.tsx`'s `stats.current` liczy
    BEZ takiego limitu — cofa się przez CAŁĄ widoczną sekwencję (35 dni widok miesiąca / 365
    widok roku). Każda realna, nieprzerwana seria >30 dni była więc ZAWSZE ucinana do
    (co najwyżej) 30 na dashboardzie — niezależnie od freezów, sama długość serii to
    przekraczała. Fix: `MAX_STREAK_LOOKBACK_DAYS = 3650` (10 lat) zamiast sztywnego `29` —
    to bezpiecznik przed nieskończoną pętlą przy zepsutych danych, NIE realny limit serii.
    Throwaway-symulacją zweryfikowane: 31-dniowa nieprzerwana seria (dziś jeszcze nie
    zrobione) — stary kod daje 30 (ucięte), nowy poprawnie daje 31.
  - **BUG #3, TA SAMA rodzina, INNE miejsce: pętla bez limitu, ale DANE dalej ucięte na 30
    dni (2026-08-27)** — user ze screenshotem: "dashboard pokazuje 29 mimo że mam 33 jak
    wejdę [w habit-year]". Fix #2 wyżej naprawił pętlę `getStreak()` (już bez sztywnego
    limitu), ale `useHabits.ts`'s `load()` wczytywało do stanu `completions` TYLKO ostatnie
    30 dni (`Array.from({length:30}, ...)`) — dla KAŻDEGO dnia starszego `completions[d]`
    było `undefined`, więc `isDoneOrFrozen` fałszywie zwracał `false` i pętla urywała się na
    granicy 30 dni, NIEZALEŻNIE od tego że sama logika liczenia już nie miała limitu. To była
    różnica w DANYCH wczytanych do pamięci, nie w logice liczenia — `habit-year.tsx` (WINDOW=
    371, czyta bezpośrednio z AsyncStorage przez `multiGet`) widziało prawdziwą, dłuższą
    serię, bo miało do niej dostęp. Fix: nowa stała `LOAD_WINDOW_DAYS=371` w `useHabits.ts`
    (ten sam rok co `habit-year.tsx`'s `WINDOW`, żeby te dwa miejsca fizycznie nie mogły się
    już rozjechać) + nowy `getCountsRange(dates)` w `habits.ts` — batchowany
    `AsyncStorage.multiGet` (jedno wywołanie natywne zamiast 371 pojedynczych `getCounts()`,
    z drugą rundą `multiGet` po legacy klucze TYLKO dla dni bez nowego formatu) zamiast
    `Promise.all(dates.map(getCounts))`, żeby szersze okno nie kosztowało 371 sekwencyjnych
    odczytów AsyncStorage przy każdym mouncie hooka. Testy w `habits.test.ts`
    (`getCountsRange`) pokrywają batch/legacy-fallback/okno >30 dni.
  - **Nawyk `kind: 'avoid'` — auto-śledzony z dziennika jedzenia, jak licznik „bez X" ale ze
    streakiem/kalendarzem (2026-08-29)** — user: "żeby w nawyku dodać że chcę nie jeść
    słodyczy (bo było w odliczaniu... a prosiłem)". Zamiast osobnej ścieżki liczenia (co
    znaczyłoby dotykanie `getStreak`/`isDoneOrFrozen`/`dayState` — 3x już pękały, patrz bugi
    wyżej), feature jest CAŁKOWICIE PRZEZROCZYSTY dla istniejącej logiki: po prostu zapisuje
    poprawną wartość do TEGO SAMEGO storage (`habits_cnt_<date>`) co każdy inny nawyk, więc
    streak/freeze/tygodniowy cel/`habit-year.tsx` (czyta AsyncStorage bezpośrednio, nie przez
    hook) działają bez ŻADNEJ zmiany. `Habit.kind='avoid'` + `avoidKeyword` (ten sam format co
    `Counter.keyword`, `AVOID_PRESETS` w `countersStore.ts`) → `computeAvoidCounts` (PURE,
    `habits.ts`) liczy dla każdego dnia w oknie: dzień = done(1) chyba że w `foodStore.meals`
    tego dnia jest pozycja pasująca do `matchesAvoid` (nazwa dania LUB nazwa `parts` —
    składnika) → wtedy broke(0), CZYLI dzień staje się nieodznaczony/przerywa serię, dokładnie
    jak licznik „bez X" w Odliczaniu. `persistAvoidCounts` zapisuje TYLKO dni, które faktycznie
    się zmieniły (nie całe okno na każdy render) przez batchowy `AsyncStorage.multiSet`.
    `useHabits.ts`'s `load()` woła to po każdym odczycie `getCountsRange`, i cały efekt jest
    keyowany na `meals` z `useFoodStore` — więc zalogowanie/edycja/usunięcie posiłku odświeża
    nawyk NATYCHMIAST, nie dopiero przy następnym wejściu na ekran. `app/habits.tsx`: preset
    „Bez {słodyczy/fast foodów/...}" w formularzu tworzenia (z `AVOID_PRESETS`), typ zawsze
    wymuszony na `check` (avoid nie ma sensu jako licznik), notatka zamiast przełącznika
    Tak/Nie↔Licznik ("Śledzone automatycznie..."); w liście `HabitRow` avoid-nawyk renderuje
    kropkowany, NIEklikalny checkbox + odznakę "auto" zamiast normalnego tap-to-toggle — ręczne
    odznaczenie i tak zostałoby nadpisane przy następnym auto-sync. Testy: `habits.test.ts`
    (`computeAvoidCounts` — done/broke/parts-match/nie nadpisuje innych nawyków/no-op gdy
    wartość już poprawna).
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

**Nowy store**: `src/store/xxx.ts` (Zustand + persist, `storage: createJSONStorage(() =>
throttledAsyncStorage())` — patrz §10 "Zustand persist THROTTLED", WSZYSTKIE store'y tak mają,
nie goły `AsyncStorage`). Jeśli dane mają przetrwać reinstall — dopisz do backupu
(`backupService.ts` CLOUD_COLS / local snapshot).

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

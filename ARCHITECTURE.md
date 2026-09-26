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
- **Filtr „Rachunki" (prąd/czynsz/internet…) + suma po filtrach (2026-08-31)** — user:
  „dodaj mi filtry po tagach np pge itp żeby wiedzieć ile płacę za prąd". Zwykły filtr
  „Tag" (istniejący od dawna) wymaga RĘCZNIE dodanego tagu na wydatku — większość
  rachunków (paragon/ręczny wpis za prąd) nie ma żadnego tagu, tylko `storeName` typu
  „PGE"/„Tauron". Nowy `billTagFor(e)` w `recurringBills.ts` (eksportowany razem z
  `BILL_TYPES`, którego wcześniej używał TYLKO `detectRecurringBills` dla dashboardowej
  „Propozycji stałego rachunku") dopasowuje `note` + `storeName` + `tags` do tej SAMEJ
  listy rachunków (prąd/czynsz/internet/gaz/woda/ogrzewanie/ubezpieczenie/telefon) —
  jedna definicja „co liczy się jako rachunek za prąd" zamiast dwóch, które mogłyby się
  rozjechać. `finances.tsx`: nowy `activeBillFilter` (niezależny od `activeTagFilter`,
  oba mogą być aktywne naraz — AND), `billsInData` (tylko rachunki faktycznie obecne w
  danych, dedup po tagu), chipy w sekcji „Rachunki" filtra POD „Płatność" a NAD „Tag".
  Przy każdym aktywnym filtrze filtry i tak przeszukują CAŁĄ historię (nie tylko
  ostatnie 31 dni — `capTx` wyłącza się gdy `activeFilterCount > 0`), więc "Prąd" łapie
  wszystko od zawsze. Nowa linia „N transakcji · razem X PLN" pod paskiem filtrów
  (widoczna TYLKO gdy `activeFilterCount > 0`) sumuje `sections[].total` — bez tego
  „ile płacę za prąd" wymagałoby ręcznego dodawania kwot z nagłówków dni. Testy:
  `billTagFor` w `financePredicates.test.ts` (storeName-only, note-only, brak dopasowania).

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

- **Szablony powiadomień — ucz PRZED pierwszą płatnością (2026-09-08)** — user przesłał
  realną obcowalutową płatność subskrypcji ("Zapłacono kwotę 22,14 EUR ... w ANTHROPIC*
  CLAUDE SUB ... Bank Pekao S.A.") i poprosił: "kiedyś robiliśmy jak łapanie z powiadomien
  z banku że jak wykryje to to zeby mnie zapytało o subskrypcję claudie... zeby dodac co
  jest wyplata co subskrypcję jaka itp... tak samo opłaty za pge, opłaty za przejazdy że
  mogę dodać ile chce takich wkleić takie templatki jak na górze on sam zrozumie". Do tej
  pory pierwsza płatność od nieznanego nadawcy ZAWSZE zgadywała kategorię przez sztywny
  słownik `STORE_CAT` w `merchantMemory.ts` (nie zna "anthropic"/"pge" itp. → domyślnie
  `groceries`), a dopiero PO ręcznej korekcie w `bank-review.tsx` `merchantMemory` uczyła
  się na przyszłość — czyli pierwszy raz zawsze wychodził źle.
  Nowy store `src/store/bankRulesStore.ts` (`BankRule { pattern, name, category, tags? }`,
  zustand+persist jak `bankQueueStore`) + `matchBankRule(store, raw, rules)` — dopasowanie
  substring (case-insensitive) do nazwy sklepu ORAZ surowego tekstu powiadomienia. Wpięty w
  `bankIngest.ts` między nauczonym `merchantMemory` (najwyższy priorytet — pochodzi z
  realnie zaakceptowanej płatności) a sztywnym `guessCategory()` (ostatni fallback) — więc
  szablon wypełnia dokładnie tę lukę: nieznany JESZCZE nadawca, ale user już zadeklarował z
  góry co to jest. Ustawienia → "Auto-wydatki z banku" → nowa sekcja "Szablony powiadomień":
  wklej przykład powiadomienia (live-preview przez ten sam `parseBankNotification` co test
  odczytu wyżej) → prefill fragmentu-do-rozpoznania i nazwy z tego, co parser wyciągnął
  (edytowalne) → wybór kategorii (chipy z `CATEGORY_META`, ten sam słownik co wszędzie
  indziej w apce) → zapis. Lista zapisanych szablonów z usuwaniem pod formularzem.
  Obca waluta (EUR) i tak zawsze wymusza ręczne wpisanie kwoty w PLN w `bank-review.tsx` —
  szablon zmienia TYLKO kategorię/nazwę/tagi, nie omija tego bezpiecznika (i tak nie ma
  żadnego "salda" w klasycznym sensie do popsucia — `accountBalance.ts` liczy je jako
  offset + suma(przychód−wydatek) z już zaksięgowanych kwot w PLN, więc poprawna kategoria
  na starcie nie zmienia mechaniki salda, tylko to, co widać w statystykach kategorii).
  Testy: `__tests__/bankRules.test.ts` (dopasowanie, normalizacja, usuwanie, oraz pełny
  `ingestBankNotification` na dokładnie tej płatności Claude — z szablonem trafia w
  `subscriptions`, bez niego nie).

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
    - **Powiadomienie/UI mówią SKĄD kotek wrócił (2026-08-31)** — user: "jak jest powiadomienie
      że pupil wrócił z misji to niech będzie napisane z jakiego miejsca wrócił". Miejsce
      (`MiniBoss.destination`, minibosses.ts) już istniało — było widoczne TYLKO na pasku "w
      drodze" (`missionDestTxt`), znikało z ekranu i z push powiadomienia w chwili gdy misja
      faktycznie się kończyła, czyli DOKŁADNIE gdy user najbardziej chciał wiedzieć skąd kotek
      wraca. `notificationsService.scheduleMissionReady(endsAtIso, destination?)` dostał nowy,
      opcjonalny 2. argument — `startMission` w petStore.ts liczy go RAZ przy wysyłce
      (`minibossForMission(startedAt.toISOString()).destination`, ten sam deterministyczny
      dobór co reszta systemu misji) i przekazuje dalej; tytuł powiadomienia zamiast
      generycznego "Pupil wrócił z misji! 🎒" pokazuje "Pupil wrócił z misji: <miejsce>! 🎒".
      Żeby ekran `/pet` i pigułka `TopPill.tsx` NIE przeczyły temu co właśnie powiedziało
      powiadomienie (dead-end, patrz zasada #7 w CLAUDE.md), obie strony dostały TĘ SAMĄ
      informację: `missionReady` prompt na scenie (`app/pet.tsx`) pokazuje nową linię "Wrócił
      z: <miejsce>" nad "Naciśnij, aby zawalczyć" (czyta `missionMb` — już istniejący, liczony
      z `missionStartedAt`, ten sam co pasek "w drodze"); `TopPill.tsx`'s "PUPIL WRÓCIŁ Z MISJI"
      → "PUPIL WRÓCIŁ Z: <MIEJSCE>" (nowy `missionStartedAt` selector, bo pill dotąd czytał
      tylko `missionEndsAt`). Wszystkie trzy miejsca liczą destination z TEGO SAMEGO
      `minibossForMission(missionStartedAt)` — deterministyczne, więc zawsze zgodne ze sobą bez
      przekazywania go w danych powiadomienia.
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
    - **`synced` — blokada "Odbierz" dopóki dzisiejszy sync się nie skończył (2026-09-01)**
      — user: "dane w pupilu powinny czekać na załadowanie aktualnych kroków, snu itp z dnia
      danego bo bez aktualizacji pobiera z wczoraj i można odebrać". `usePetHealthSync`'s
      `reload()` już wcześniej pokazywało CACHE natychmiast (`readHealth()`), a DOPIERO
      potem woła `autoSyncHealth` i odświeża ponownie — w tej luce quest oparty o kroki/sen
      (`questCtx.stepsToday`/`sleepMinutes`, oba z `health`) mógł pokazać się jako "do
      odebrania" na podstawie nieświeżych danych sprzed sync'u. Nowy `synced: boolean`
      (start `false`, `true` PO pierwszym zakończonym `autoSyncHealth` tej sesji ekranu —
      albo od razu `true` przy błędzie sync'u, żeby offline nie blokowało odbioru na stałe)
      zwracany z `usePetHealthSync`, przekazany przez `usePetQuests`. `app/pet-quests.tsx`
      blokuje przyciski "Odbierz" (`q.done && synced` zamiast samego `q.done`) dla
      dziennych/bonusowych/tygodniowych/miesięcznych questów — pokazuje "Ładuję…" zamiast
      aktywnego przycisku, plus podpowiedź "ładowanie danych z dziś…" w nagłówku sekcji
      Codzienne dopóki `!synced`. **NIE dotyczy** `missed` (zaległe questy z poprzednich dni
      — te czytają JUŻ ROZLICZONE dane historyczne z `recentDays`, nie mają tego wyścigu) ani
      `quests.milestones` (rekordy życiowe typu "najlepszy dzień kroków" — osiągnięte dawno,
      świeży sync dzisiejszego dnia i tak by ich nie cofnął).
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
    - **Roll wartości statu w przedziale zamiast stałej wartości na rzadkość (2026-08-31)** —
      user (Sklep dnia, część B tej samej wiadomości co "3→4 itemy" wyżej): "itemy od teraz
      mogą dropić w przedziałach czyli od 0.5-2% dmg dodatkowego i się losują itp ogarniesz
      to?". Duża zmiana ekonomii/kształtu danych, więc PRZED implementacją 3 pytania
      doprecyzowujące (AskUserQuestion), user wybrał rekomendowane za każdym razem: (1) roll
      Sklepu dnia zostaje DETERMINISTYCZNY per dzień (spójne z "gwarantowany zakup, nie
      loteria" — patrz komentarz przy `dailyShopSlots`), (2) lepszy roll w TEJ SAMEJ rzadkości
      liczy się jako realny upgrade (ARPG-style min-maxing), (3) mechanika dotyczy WSZYSTKICH
      6 slotów, nie tylko obroży/atkPct, dla spójności.
      `GEAR_ROLL_SPREAD: [0.7, 1.3]` (gear.ts) — ±30% wokół ISTNIEJĄCEGO `gearStatValue`
      (baseValue × RARITY_MULT), który zostaje ŚRODKIEM nowego przedziału — cały dotychczasowy,
      ręcznie tuningowany balans (komentarz przy `GEAR_ITEMS` o mitycznym T5 ~20-30% loot
      totalu) przechodzi bez zmian, roluje się TYLKO rozstrzał wokół niego.
      `gearValueRange(item, rarity)` → `[min, max]`; `rollGearValue(item, rarity, rand =
      Math.random)` → wartość w tym przedziale, `rand` wstrzykiwalny — Sklep dnia woła z
      `pseudoRandom01(date + item.id + '|value')` (NOWY seed suffix, osobny od istniejącego
      `'|rarity'` — dwa rollе nie kolidują), skrzynki (`petBoxes.ts`'s `rollBox`, `petStore.ts`'s
      `openCrate`) wołają BEZ seeda (`Math.random` domyślny) — prawdziwa loteria, spójne z tym
      że skrzynki nigdy nie obiecywały determinizmu.
      `OwnedGear { rarity, value }` ZASTĘPUJE samą `GearRarity` jako typ wartości w
      `petStore.ownedGear` (był `Partial<Record<string, GearRarity>>`, jest
      `Partial<Record<string, OwnedGear>>`) — WSZYSCY konsumenci zaktualizowani:
      `gearCombatBonuses`/`gearFlatHp`/`gearCoinsMult` czytają `.value` BEZPOŚREDNIO (już nie
      wołają `gearStatValue` — ten roll JEST już policzoną wartością, nie trzeba przeliczać z
      rzadkości); `grantGear`/`buyDailyGear` przyjmują nowy argument `value: number` (kolejno 3.
      i 5.); `sellGear` czyta `owned.rarity` (sprzedaż zostaje CELOWO rarity-only, nie
      value-aware — "cena skupu" to nieprecyzyjna wewnętrzna abstrakcja, nie potrzebuje
      granularności per-roll, poza zakresem tej zmiany).
      `isGearUpgrade(next: OwnedGear, cur: OwnedGear | undefined): boolean` (gear.ts) —
      JEDYNE źródło prawdy "czy to ulepszenie" wszędzie (`openCrate`, `grantGear`,
      `buyDailyGear`, `alreadyOwnGear`/`GearPreviewModal` w pet-shop.tsx) ZASTĘPUJE dawne
      porównanie `RARITY_MULT[a] >= RARITY_MULT[b]`: rzadkość wygrywa najpierw, przy REMISIE
      rzadkości wygrywa wyższy `value` (odpowiedź user #2 wyżej).
      **Migracja** (`onRehydrateStorage` w petStore.ts) — stare zapisy mają `ownedGear[id]`
      jako SAM string rzadkości; backfill do `{rarity, value}` liczy `value` STARYM
      deterministycznym `gearStatValue` (środek dzisiejszego przedziału) — gracz zachowuje
      DOKŁADNIE tę samą moc co przed migracją, żaden roll nic nie odbiera/dodaje z zaskoczenia
      przy update'cie apki. Brakujący `gearById` (item usunięty z katalogu) pomija wpis zamiast
      crashować migrację.
      Testy zaktualizowane pod nowy kształt (`gear.test.ts`, `grantGear.test.ts`,
      `buyDailyGear.test.ts`, `petBoxes.test.ts`) + nowy test explicit na "lepszy roll w TEJ
      SAMEJ rzadkości = upgrade" w obu `grantGear.test.ts` i `buyDailyGear.test.ts`.
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
  - **Trzy poprawki po audycie realnego eksportu danych (2026-08-31)** — user: "ulepsz karty
    miesięcy... sporo zaokrąglone powtórzeń ze te kroki sa z Rzeszowa do Lublina bez sensu,
    duzo pomyłek kategorii słodycze przekąski" + wybrał (z AskUserQuestion) "odetnij puste
    miesiące" jako priorytet. Przeanalizowany prawdziwy eksport JSON (AsyncStorage dump)
    ujawnił KONKRETNE, mierzalne przyczyny obu skarg, nie zgadywane na ślepo:
    1. **Karta miesiąca powstaje TYLKO przy realnym sygnale apki (wydatek/nastrój/wypłata),
       nie samych krokach z zegarka** — `buildMonthCards()` w `monthCards.ts` budowało zbiór
       „miesięcy" z UNII expenses+moodEntries+healthDays+payMonths; u tego usera `healthDays`
       (backfill Health Connect) sięgał do 2022, ale expenses/mood dopiero od grudnia 2025 —
       więc 39 z ~48 kandydujących kart było prawie puste (same kroki, bez wydatków/nastroju/
       słodyczy), rozwadniając kolekcję. Fix: `months` liczy się TERAZ tylko z
       expenses/moodEntries/payMonths; `healthDays` dalej WZBOGACA już kwalifikujący się
       miesiąc (hero-stat kroków, dystans-ciekawostka) — po prostu nie może być JEDYNYM
       powodem istnienia karty. Testy: `monthCards.test.ts` (nowy plik).
    2. **`stepsToDistanceFact` (funComparisons.ts) — zagęszczona tabela landmarków 90-650 km**
       — user dosłownie: kroki "z Rzeszowa do Lublina" powtarzały się bez sensu. Realny audyt:
       typowy aktywny miesiąc tego usera (~150k-350k kroków ≈ 115-265 km) trafiał w TYLKO
       DWA landmarki (90 km "z Rzeszowa do Krakowa" / 150 km "z Lublina do Rzeszowa") w 48/48
       policzonych miesiącach — ogromna dziura między 150 km a 300 km w starej tabeli.
       Dodane: 60 km (Tarnów), 120 km (Zamość), 180 km (Katowice), 220 km (Częstochowa),
       480 km (Poznań) — u TEGO usera realnie rozbija rozkład na 5 różnych landmarków
       zamiast 2 (zweryfikowane przeliczeniem jego prawdziwych 48 miesięcy kroków). Test
       regresji w `funComparisons.test.ts` pilnuje, że kilka typowych sum miesięcznych
       faktycznie trafia w różne landmarki.
    3. **`getFoodTags` (receiptParser.ts) — realne luki w słowach-kluczach słodycze/przekąski**
       — audyt WSZYSTKICH `receiptItems` z eksportu (nie zgadywanie): `'ciastk'` (stem z 'k')
       nie łapał paragonowego skrótu "Ciast" (bez 'k' — realny przykład: "ŁowiczDesRyżKruCiast
       Śliw100g"), rozszerzone na `'ciast'`. Dodane marki/nazwy widoczne w danych, których
       dotąd NIE było w liście: `balconi`, `jelly`, `miętówk`/`miętow`, `grylaż`/`grylaz`,
       `mieszanka studencka`. (Odrzucone jako NIE-bug po weryfikacji: większość „niezłapanych"
       itemów w eksporcie to STARE dane sprzed rozszerzenia listy z 2026-08 — tagi liczą się
       RAZ przy skanowaniu, nie przeliczają retroaktywnie; re-skan złapałby je już teraz.
       Jeden dwuitemowy przypadek sklejenia nagłówka adresu sklepu z nazwą pierwszego produktu
       na paragonie — osobny, wąski bug parsera, niezbadany, zanotowany w NEXT_STEPS.md.)
       Testy w `receiptParser.test.ts`.
    4. **Sen + zmiana wagi jako nowe staty karty (2026-09-01)** — user: "dodałeś do tych kart
       więcej danych żeby nie były takie nudne???". `MonthCardCtx.healthDays` niosło
       `sleepMinutes`/`weightKg` PER DZIEŃ od samego początku, ale `buildMonthCards()` czytało
       z niego TYLKO `steps` — reszta siedziała nieużywana. Dodane do `MonthCard`: `avgSleepH`
       (średnia z dni które MAJĄ dane snu — dzień z `sleepMinutes:0` liczy się jako "brak
       danych", nie "spał 0h"), `weightStartKg`/`weightEndKg`/`weightChangeKg` (pierwszy i
       ostatni zapisany pomiar wagi W KOLEJNOŚCI DAT tego miesiąca — iteracja po
       `Object.keys(healthDays).sort()`, nie po `Object.entries()`, bo kolejność wstawiania do
       obiektu nie gwarantuje kolejności dat; `weightChangeKg` wymaga **≥2 ODRĘBNYCH pomiarów**
       tego miesiąca, nie samego `!= null` — z JEDNYM pomiarem `first===last` dałoby mylące
       "0,0 kg zmiany" zamiast uczciwego braku danych). `MonthWrappedCard.tsx`: sen jako trzeci
       hero-stat obok kroków/zarobku (ikona `Moon`, tylko gdy `avgSleepH != null`), zmiana wagi
       jako chip w istniejącym rzędzie porównań (ikona `Scale`, próg ±0,3 kg żeby odciąć szum
       pomiarowy, `tone:'star'` NEUTRALNY — apka nie zna celu usera (schudnąć/przytyć), więc nie
       zgaduje czy wzrost/spadek to zielone czy czerwone). Testy w `monthCards.test.ts`.
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
    - **Dopasowanie po KATEGORII produktu, nie tylko po nazwie itemu (2026-08-31)** — user:
      "nie łapie ciastek Milka jako słodyczy i nie resetuje... zjem i mam nadal streak
      słodyczy xdd". Realny bug: `matchesAvoid` dopasowuje tylko tekst NAZWY zjedzonego
      itemu do `avoidKeyword` — produkt nazwany dosłownie "Milka" (bez "czekolad"/"słodycz"
      w nazwie) nigdy nie trafiał, mimo że user otagował go kategorią "Słodycze" przy
      dodawaniu produktu (`FoodProduct.cat`). `countersStore.ts`'s `autoLastDate` (śledzenie
      po ZAKUPIE, nie zjedzeniu) miał TEN SAM fix już wcześniej dla itemów paragonu (dopasowuje
      `it.tags` obok nazwy) — strona "zjedzenia" (ta, która faktycznie resetuje TEN streak,
      patrz akapit wyżej) go nie miała. Fix + konsolidacja: nowa `matchedEatDays(keyword,
      meals, catByProductId)` w `countersStore.ts` — JEDNA implementacja zamiast TRZECH
      niezależnych kopii tej samej pętli, które istniały wcześniej w `habits.ts`
      (`brokenDaysFor`, teraz usunięte, woła `matchedEatDays` wprost), `countersStore.ts`'s
      `autoLastEatDate` (teraz cienki wrapper) i `habit-year.tsx`'s inline `matchDays`
      useMemo (miał WŁASNĄ, trzecią kopię tej samej buggy pętli dla kalendarza rocznego —
      naprawiona przy okazji, żeby nie było czwartego miejsca z tym samym bugiem). Każdy
      `MealItem` (i jego `parts`) niesie `productId` — `matchedEatDays` rozwiązuje go do
      `FoodProduct.cat` przez mapę `catByProductId` budowaną przez wywołującego (`products`
      z `useFoodStore`) i dokłada kategorię do tego samego haystacka co nazwa. `computeAvoidCounts`
      dostał nowy, opcjonalny 5. param `products`; `autoDaysWithout` (countersStore.ts) dostał
      nowy `products` param WSTAWIONY PRZED `now` (żaden caller nie przekazywał `now` wprost,
      więc kolejność dało się zmienić bez `undefined`-placeholderów na wywołaniach).
      `useHabits.ts`, `app/counters.tsx`, `app/counters/[id].tsx`, `app/(tabs)/index.tsx`
      (×2 miejsca) i `app/habit-year.tsx` zaktualizowane — wszystkie już miały `products`
      dostępne przez `useFoodStore`, tylko brakowało przekazania dalej. Testy: 3 nowe w
      `habits.test.ts` (dopasowanie po kategorii bez słowa w nazwie, to samo w `parts`,
      productId na kategorię BEZ dopasowania dalej liczy się jako "done").
- **Powiadomienia**: `notificationsService.ts` — master `notif_enabled` + per-typ flagi;
  deep-linki obsługiwane w `_layout.tsx`.
- **Ustawienia (`app/settings.tsx`)**: data-driven, nie flat JSX. Typy `SettingsSectionDef`/
  `SettingsItem` w `src/types/settings.ts`; generyczny render `SettingsRow` w
  `src/components/settings/`; wyszukiwarka (pasek + AND-match po słowach kluczowych,
  diakrytyki-insensitive) w `src/utils/settingsSearch.ts` (`normalizeSearch`/`filterSections`,
  testy w `__tests__/settingsSearch.test.ts`). Każdy wiersz ma `title`/`subtitle`/`keywords` w
  JEDNYM miejscu (manifest w `settings.tsx`) — to jest zamierzony punkt pod przyszłe języki:
  string do zmiany żyje w jednym polu, nie trzeba go szukać w JSX. **Nawigacja (§100,
  2026-09-15)**: bez wyszukiwania ekran to menu kategorii (`SettingsCategoryRow`, jeden
  wiersz na sekcję) — kliknięcie otwiera PEŁNĄ podstronę tej sekcji (`activeSectionId`
  state, sprzętowy „wstecz" na Androidzie wraca do menu zamiast wyjść z Ustawień), nie
  akordeon rozwijany w miejscu. `SettingsSectionView` (akordeon) żyje dalej, ale tylko
  jako renderer WYNIKÓW WYSZUKIWANIA (zawsze `forceOpen`) — poza tym nieużywany.
  `BackupSection`/`UsageStatsSection` nie są już zawsze-widoczne — mieszkają na końcu
  podstrony sekcji `'dane'`.

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
   pojawi się automatycznie jako wiersz w menu głównym Ustawień I w wyszukiwarce, nic
   więcej nie trzeba podpinać (patrz §100 — menu→podstrona, nie akordeon). `defaultOpen`
   nie ma już praktycznego znaczenia poza wynikami wyszukiwania (zawsze wymuszone otwarte)
   — można go pominąć w nowych sekcjach.

## 13. Optymalizacja wydajności — 2026-09-02

User poprosił ogólnie o "dalszą optymalizację apki" (bez konkretnego zgłoszenia). Zamiast
zgadywać, zrobiony statyczny audyt kodu (nie profiler na urządzeniu — brak dostępu) pod kątem
realnych, ewidencjonowanych problemów. Cztery fixy:

1. **`app/notes.tsx` — `NoteCard` re-renderował się cały przy KAŻDEJ zmianie stanu ekranu**
   (wpisywanie w search, przełączanie folderu), nawet jeśli konkretna notatka się nie
   zmieniła — `.map()` przekazywał NOWE closures (`onPress={() => openEdit(note)}`) do
   każdej karty przy każdym renderze, więc samo opakowanie w `React.memo` nic by nie dało
   (props i tak zawsze "inne"). Naprawione właściwie: `openEdit`/`handlePin`/`handleDelete`/
   `handleConvert` (już przyjmowały `note` jako argument) owinięte w `useCallback` ze
   stabilnymi zależnościami, nowy `openCounterNote` (też `useCallback`), `NoteCard` wywoływany
   z gołymi referencjami (`onPress={openEdit}` zamiast `onPress={() => openEdit(note)}`) —
   sam komponent bierze `note` i woła `onPress(note)` wewnątrz. Dopiero to + `memo(NoteCard)`
   realnie ogranicza re-render do notatek, których dane faktycznie się zmieniły.
2. **`app/food/add.tsx` — wyszukiwarka jedzenia przeliczała CAŁĄ bibliotekę produktów na
   każde naciśnięcie klawisza** — `candidates` (`useMemo`) miał deps `[products, query]` i za
   każdym razem od nowa budował listę `curated` (mapa po `products`, `normalizeProductName`
   per produkt) ZANIM w ogóle zaczął filtrować po `query`. Rozdzielone na dwa `useMemo`:
   `curated` (deps `[products]` — liczy się tylko gdy zmienia się biblioteka produktów,
   od razu z prekalkulowanym `_norm`) i `candidates` (deps `[curated, query]` — per klawisz
   tylko filtruje/sortuje gotowe dane, żadnego ponownego `normalizeProductName`). Uwaga:
   `curated` jest teraz WSPÓLNYM, memoizowanym obiektem między renderami — gałąź pustego
   query musi robić `[...curated].sort(...)` (kopia), nie `curated.sort(...)` w miejscu, bo
   mutacja rozjechałaby kolejność przy następnym renderze z niepustym `query`.
3. **`app/(tabs)/health.tsx` — sprawdzone, ŚWIADOMIE NIE ruszone.** Detale steps/sleep liczą
   filter/reduce/max inline w JSX (IIFE) zamiast `useMemo`, ale działają WYŁĄCZNIE gdy
   odpowiedni modal szczegółów jest otwarty, na max ~30 elementach (`monthData`) — realny
   koszt znikomy, a przepisanie tych bloków na `useMemo` (dużo zmiennych domknięcia:
   `sleepH`/`sleepM`/`sleepRange`/`hcExtra`/`healthStats`) niosło większe ryzyko
   stale-closure bugów niż realna korzyść. Zostawione jak jest.
4. **Duże PNG-i ekwipunku/bossów renderowane jako miniaturki** — `assets/ekwipunek/**`
   (hełmy/talizmany, źródła do 3095×3095/1,8MB) wyświetlane max 44×44px
   (`GearPanel.tsx`/`BoxRevealModal.tsx`/`pet-shop.tsx`), `assets/ikonybosów/**` (źródła do
   3095×3095/1,7MB) wyświetlane max 130×130px (`BossArt.tsx` w `boss-fight.tsx`,
   `PORTRAIT_SIZE`). Każde otwarcie sklepu/ekwipunku/walki dekodowało kilka pełnorozdzielczych
   PNG-ów tylko po to, żeby pokazać miniaturkę — realny koszt otwarcia ekranu + pamięć/bateria
   na słabszych telefonach. Za zgodą usera (AskUserQuestion) przeskalowane proporcjonalnie w
   dół (Pillow, LANCZOS, alfa zachowana): ekwipunek do maks. 300px na dłuższym boku, bossy do
   maks. 600px (spory zapas ponad 3× gęstość pikseli przy realnym rozmiarze wyświetlania —
   VALUE nie zmienia się wizualnie). 18 z 72 plików w tych dwóch folderach było większych niż
   docelowy rozmiar; łącznie `assets/ekwipunek/` + `assets/ikonybosów/`: **17,4 MB → 4,4 MB**.
   Ikony appki/splash (`icon.png`/`splash-icon.png`/`adaptive-icon.png`/`logoSapp.png`) CELOWO
   NIE tknięte — to natywne assety pod konkretne wymagane rozmiary (App Store/Play Store),
   zmieniane tylko przez `app.json` + nowy build (patrz §11).

`tsc`/`jest` zielone (65 suit/812 testów, bez zmian w testach — czysto wydajnościowe fixy,
brak nowej logiki biznesowej do przetestowania). **Priorytet testu na urządzeniu**: (a) Notatki
— wpisuj coś w wyszukiwarkę mając sporo notatek, ekran powinien reagować płynniej niż
wcześniej (zero funkcjonalnej zmiany — pin/usuń/konwertuj/otwórz nadal działają tak samo);
(b) Co zjadłem → dodaj → pisz w polu szukania mając sporo własnych produktów — powinno czuć
się responsywniej przy dłuższej bibliotece; (c) Sklep/Ekwipunek/dowolna walka z bossem —
ikony hełmów/talizmanów/bossów powinny wyglądać IDENTYCZNIE jak przed zmianą (to czysty
downscale, nie redesign) — jeśli coś wygląda rozmyte/przycięte, to regresja do zgłoszenia.

## 14. Połączenie "co kupuję" → "co zjadłem" (kategoria/streak) + tło areny — 2026-09-02

User: "Musimy ogarnąć lepszy connect pomiędzy CO ZJADŁEM a produktami które kupuję żeby jak
kupię drożdżówkę i ją oflaguję że to pieczywo/słodycz - to jak zaznaczę że ją zjadłem to
trzeba żeby oflagowało to że zjadłem słodycz i tracę streak".

**Diagnoza**: `ReceiptItem.tags` (wydatki/paragony, np. `['słodycze']` z `FOOD_TAG_MAP` w
`receiptParser.ts`) i `FoodProduct.cat` (dziennik jedzenia, `FOOD_SUBCATS` w `food.ts`) dzielą
DOKŁADNIE ten sam słownik tagów, ale były dwoma zupełnie niepowiązanymi systemami — żaden kod
nie przenosił jednego w drugie. Avoid-habit/streak matching (`matchedEatDays` w
`countersStore.ts`, konsolidacja z 2026-08-31) już CZYTA `FoodProduct.cat` przez
`catByProductId`, ale nic nigdy go nie USTAWIAŁO przy tworzeniu nowego produktu w Co zjadłem
— stąd realna luka.

**Fix — `purchasedCatForName(name, expenses)`** (nowa, `src/utils/food.ts`): szuka po
znormalizowanej nazwie NAJNOWSZEGO paragonowego itemu z tym samym imieniem i zwraca jego
`foodSubcat()` (pomijając `'inne'`). Podpięta w trzech miejscach:
1. `app/food/add.tsx` — `confirmPicker`/`confirmManual` (tworzenie NOWEGO produktu wprost z
   wyszukiwarki "Co zjadłem", najczęstsza ścieżka) — seed `cat` tylko gdy produkt jeszcze go
   nie ma (sprawdzone przez `findProductByName` PRZED wywołaniem `upsertProductByName`, żeby
   nigdy nie wysłać jawnego `cat: undefined`, które nadpisałoby istniejącą kategorię —
   `upsertProductByName` na ISTNIEJĄCYM produkcie spreaduje cały seed wprost jako patch).
2. `app/food/product.tsx` (pełny formularz) — `useEffect` na `name`, auto-uzupełnia `cat`
   TYLKO dla nowego produktu (`!editing`) bez jeszcze wybranej kategorii — nigdy nie nadpisuje
   edytowanego produktu ani świadomego wyboru usera.
3. `foodStore.markFreshMany` (wołane z `app/expenses/scan.tsx` po zapisie paragonu) —
   backfill `cat` na już-śledzonych produktach, które go jeszcze nie mają, z tagu PRAWDZIWIE
   wtedy przypisanego na tym paragonie (`foodSubcat(it)`) — sygnatura zmieniona z `string[]`
   (same nazwy) na `{name, cat?}[]`.

**Osobny, równie realny fix — `AVOID_PRESETS.sweets` keyword** (`countersStore.ts`):
konkretny przykład usera (drożdżówka) NIE jest złapany przez powyższy mechanizm wcale —
`FOOD_TAG_MAP` celowo kategoryzuje drożdżówkę/rogal/croissant jako `'pieczywo'`, nie
`'słodycze'` (żeby nie dublować wydatków na słodycze w podziale finansowym), więc
`purchasedCatForName` zwróciłby `'pieczywo'`, co NIE pasuje do keyworda słodyczy. Naprawione
tak samo jak istniejący precedens `'pączek'` w tym samym keywordzie — dopisane
`drożdż|rogal|kroasan|croissant` jako dopasowanie PO NAZWIE (niezależne od kategorii).
Świadomie NIE dotknięte: `FOOD_TAG_MAP` samo (dublowanie kategorii zmieniłoby podział
wydatków na innych ekranach, poza zakresem tego zgłoszenia).

**Sprawdzone i NIE zmienione** (już działało poprawnie): "streak sprawdza ile dni temu
ostatnio zjadłem... chyba że edytuję bo było przez przypadek dodane" — `autoLastEatDate`/
`autoDaysWithout` to CZYSTE funkcje liczące na żywo z bieżącego `meals`, nie persystowany
stan — edycja/usunięcie błędnego wpisu w Co zjadłem automatycznie naprawia policzony streak
przy następnym odczycie, bez żadnej dodatkowej logiki "cofnięcia".

**Tło areny walki** — user dostarczył `LOKACJA_KAMPANIA.png` (pchnięte bezpośrednio na
`master`, wymagało zmergowania do branża roboczego; PRZY OKAZJI user wgrał też PEŁNOROZDZIELCZE
zbroja/buty PNG-i zastępujące stare placeholdery — 1,5-2MB/plik, ten sam wzorzec co §13,
przeskalowane tym samym skryptem do max 300px). Wpięte w `boss-fight.tsx` jako
`CAMPAIGN_ARENA_BG` (nowy export w `bossIcons.ts`) — user: "wypierdolić ramki że bosy stoją na
tym... hp jest podspodem". Scoped do NOWEGO `arenaScene` (`ImageBackground`, STAŁEJ wysokości,
tylko kafelki/portrety/HP) zamiast całego `arena` (który ma zmienną wysokość — motyw/przycisk/
mechaniki pod spodem rosną/kurczą się z rundy na rundę; naciąganie obrazka na całość
wyglądałoby źle). `tile` stracił własne tło/ramkę (`c.bg.elevated`+border) — bossy/kotek stoją
bezpośrednio na scenie; `tileLabel`/`tileHpTxt` dostały stały biały kolor + text-shadow
(zamiast zależnego od motywu `c.text.primary`/`muted`) pod czytelność na zmiennym tle obrazka;
`tileHpTrack` półprzezroczysty czarny zamiast płaskiego koloru motywu. Geometria WEWNĄTRZ
`arenaScene` (padding kafelka, `tilePortrait`, `projectile.top`) celowo NIE zmieniona — sama
tylko zmieniła nośnik tła. Plik tła przeskalowany 1536×1024/2MB → 1200×800/1,2MB (Pillow,
alfa zachowana — obrazek ma ok. 20% przezroczystych, zaokrąglonych narożników w stylu
"naklejki", `resizeMode="cover"` przycina/skaluje resztę).

`tsc`/`jest` zielone (67 suit/822 testy — nowe `food.test.ts`/`countersStore.test.ts`).
**Priorytet testu na urządzeniu**: (a) Co zjadłem → dodaj NOWY produkt o nazwie identycznej
jak coś wcześniej kupione i otagowane jako słodycze/przekąski na paragonie — sprawdź że
streak "Bez X" łapie to bez ręcznego tagowania; (b) zeskanuj paragon z drożdżówką/rogalem/
croissantem, zjedz, sprawdź że łamie streak słodyczy; (c) dowolna walka bossa — arena powinna
mieć widoczne tło (loch/arena), kafelki BEZ ramek, portrety stoją "na scenie", HP pod spodem
czytelne; sprawdź że pocisk (łapka/broń bossa) dalej trafia w środek portretu, nie w pasek HP.

## 15. Optymalizacja wydajności, runda 2 — 2026-09-02

Kontynuacja §13 (user: "optymalizuj dalej" po ogarnięciu poprzedniej listy). Statyczny audyt
(bez profilera na urządzeniu) skupiony na obszarach NIE pokrytych w §13.

**Realny fix — dashboard "deferred" sekcje liczyły się mimo stagingu.** `DEFERRED_SECTIONS`
(§ „Snapshot statystyk"/dashboard, `app/(tabs)/index.tsx`) + `deferredReady` (flip via
`InteractionManager.runAfterInteractions`, 2026-08-24) gatują TYLKO co zwraca JSX
(`if (!deferredReady && (DEFERRED_SECTIONS.has(id) ...)) return null` przy budowie `nodes`) —
ale hooki Reacta lecą ZAWSZE, niezależnie od tego co komponent finalnie zwraca. Siedem
`useMemo` karmiących wyłącznie te sekcje — `funFacts`/`weightFacts` (→'fun-facts'),
`correlations` (→'correlations'), `insightLinks` (→'insights-web'), `foodBreakdown`
(→'food-breakdown'), `shopsCollection` (→'shops-collection'), `topProducts`
(→'top-products') — i tak skanowały CAŁĄ historię `expenses` (część z zagnieżdżoną pętlą po
`receiptItems`) na KAŻDYM renderze, w tym na samej pierwszej, "ważnej" klatce, którą staging
miał odciążyć. Naprawione: każdy dostał `if (!deferredReady) return <pusty stub>;` jako
pierwszą linię ciała + `deferredReady` w tablicy zależności — realne przeliczenie odpala się
DOPIERO gdy `InteractionManager` faktycznie da znać, dokładnie tak jak zamierzał oryginalny
staging. Zero zmiany w tym KIEDY user widzi te sekcje (i tak nie renderowały się przed
`deferredReady`) — usunięty tylko marnowany CPU na liczenie czegoś, co i tak było odrzucane.
Jedna subtelność: `foodBreakdown`'s stub ma puste `display: {}`, a `foodSelYm`/`foodSel`
(pochodne, liczone bezwarunkowo zaraz pod memo) czytają z niego bez opcjonalnego chainingu —
bezpieczne mimo to, bo jedyne miejsce, które realnie się w nie wgryza (modal `{foodCat && …}`)
nie może się otworzyć zanim karta „Jedzenie — rozkład" (sama zagatowana) w ogóle wyrenderuje
przycisk do jego otwarcia (`foodCat` startuje jako `null`).

**Sprawdzone, dead end (już OK)**: start apki (`_layout.tsx` — żaden z ~15 `useEffect` nie
blokuje pierwszej klatki, `onRehydrateStorage` hooki robią tylko małe, ograniczone fixupy);
inne listy poza notatkami (subscriptions/templates/vehicles/pet-quests/achievements/
notifications/bosses-codex — wszystkie naturalnie małe lub ograniczone katalogiem, nie rosną
bez ograniczeń z historią usera); nowo wgrane PNG-i bossów (wilk/osa/kraken/upior) — FAŁSZYWY
alarm pierwszej rundy audytu, to już MOJE własne przeskalowane 600×600 wersje z §13, nie
ponowny upload oryginałów (zweryfikowane bajt-po-bajcie).

**🔴 ZNALEZIONE, NIE naprawione — czeka na decyzję usera** (patrz NEXT_STEPS.md): zustand
`persist` re-serializuje (`JSON.stringify`) CAŁY rosnący blob `expenses`/`meals`/`products`
przy KAŻDEJ pojedynczej mutacji (dodanie jednego wydatku/posiłku), zanim trafi do throttlingu
częstotliwości zapisu (`throttledStorage.ts` — ten koalescuje TYLE zapisów, nie ich ROZMIAR).
Symetrycznie: cold-start rehydracja parsuje ten sam, rosnący blob przy każdym starcie apki.
Koszt rośnie z wiekiem konta (setki wydatków/posiłków u aktywnych userów), nie jest to bug
tylko architektura — realna naprawa (archiwizacja starych wpisów / podział na klucze/paginacja
w AsyncStorage) to spory, ryzykowny redesign warstwy danych, nie coś do zrobienia po cichu przy
okazji audytu wydajności.

`tsc`/`jest` zielone (67 suit/822 testy — bez nowych testów, czysto wydajnościowy fix bez nowej
logiki biznesowej). **Priorytet testu na urządzeniu**: otwórz dashboard po dłuższej przerwie
(zimny start) — sekcje z `DEFERRED_SECTIONS` powinny pojawić się tak samo jak wcześniej (delikatnie
później niż "ważne" sekcje), ale sam dashboard powinien poczuć się responsywniej na pierwszej
klatce, zwłaszcza na koncie z dużą historią wydatków.

## 16. Optymalizacja wydajności, runda 3 — 2026-09-02

Kontynuacja §13/§15 (user: "dawaj dalej"). Dwa realne fixy z trzeciego przebiegu audytu.

**`app/pet.tsx` — pełne pętle idle CatArt leciały dalej pod ekranem walki misji.**
`onFightMission` robi `router.push('/boss-fight?...')` — `/pet` zostaje ZAMONTOWANY pod spodem
(brak `freezeOnBlur` w `_layout.tsx`). Główny, w pełni animowany `<CatArt>` (linia z
normalnym stanem pupila, BEZ `animate={false}` — w przeciwieństwie do dwóch INNYCH instancji
na tym samym ekranie, misja-w-drodze/misja-gotowa, które już miały `animate={false}` od
dawna) nie miał żadnego gatingu po widoczności ekranu — wszystkie 5 pętli idle w `CatArt.tsx`
(oddech/mruganie/spojrzenie/uszy/auto-liźnięcie) dalej biły w tle PODCZAS walki, obciążając
ten sam wątek JS co animacje `boss-fight.tsx` (ten sam ekran, który §-audyt z 2026-08-30
świadomie odchudził z animacji kotka pod wydajność). Fix: nowy `focused` (`useFocusEffect`
z `expo-router`, ten sam wzorzec co `reload()` na innych ekranach apki — `true` na fokus,
`false` w cleanupie przy zejściu z ekranu) → `animate={focused}` na tym jednym CatArt. Każdy
idle-`useEffect` w `CatArt.tsx` już miał `animate` w tablicy zależności + poprawny cleanup
(`loop.stop()`/`clearTimeout`), więc zmiana propa czysto zatrzymuje/wznawia pętle bez zmian
w `CatArt.tsx` samym.

**`app/(tabs)/mood.tsx` — analityka nastroju liczyła się od nowa przy każdym renderze.**
W przeciwieństwie do `expenses/stats.tsx` (wszystko w `useMemo`), sześć subkomponentów
(`KeywordInsights`/`MoodInsights`/`MoodDistribution`/`WeekdayPattern`/`TimeOfDayPattern`/
`MonthHeatmap`) liczyło filter/reduce/zagnieżdżone pętle po CAŁEJ historii `entries` WPROST
w ciele renderu, bez `useMemo` — dokładnie ten sam wzorzec co dashboard w §15, tylko jeszcze
nie przeniesiony tutaj. Pierwotna przyczyna WIELU zbędnych re-renderów: `useMoodStore()`
wołany BEZ selektora (`const { entries, setEntries, setLoading, deleteEntry } =
useMoodStore()`) — store niesie też `isLoading`/`todayEntry`, których ten ekran nigdzie nie
czyta, ale bez selektora KAŻDA ich zmiana i tak przerenderowywała cały ekran. `load()`
(mount/pull-to-refresh/po dodaniu-edycji-usunięciu wpisu) robi `setLoading(true)` → await →
`setEntries(...)` → `setLoading(false)` = 3 re-rendery, z czego TYLKO JEDEN realnie zmienia
`entries` — bez selektora i bez `useMemo` w subkomponentach wszystkie 3 na nowo liczyły
WSZYSTKO. Fix dwuwarstwowy: (1) wąskie selektory (`useMoodStore(st => st.entries)` itd. —
akcje są stabilnymi referencjami w zustand, więc same w sobie nie wywołują re-renderu);
(2) każdy z sześciu subkomponentów dostał `useMemo(() => {...}, [entries])` wokół swojej
derywowanej logiki (early-returny na podstawie wyniku memo przeniesione ZA wywołanie hooka,
nie przed — zgodnie z rules-of-hooks), JSX niżej nietknięty (memo zwraca ten sam kształt
obiektu, który wcześniej istniał jako luźne zmienne lokalne). `MonthHeatmap`'s `byDate` już
było memoizowane wcześniej — dołożone tylko brakujące `hasMonthEntries` (i zamienione z
`.filter().length===0` na `.some()`, żeby nie budować całej tablicy tylko po to, by sprawdzić
czy jest pusta).

`tsc`/`jest` zielone (67 suit/822 testy — bez nowych testów, czysto wydajnościowe fixy bez
nowej logiki biznesowej; ten sam brak jednostkowego pokrycia UI-komponentów co reszta apki).
**Priorytet testu na urządzeniu**: (a) wyślij pupila na misję, poczekaj aż będzie gotowa,
wejdź w walkę — kotek na ekranie Pupil (pod spodem) nie powinien już animować się w tle
podczas walki (subtelne, głównie kwestia zużycia baterii/CPU, nie coś widocznego wprost);
(b) zakładka Nastrój z dłuższą historią wpisów — dodaj/edytuj/usuń wpis, pociągnij do
odświeżenia — ekran powinien czuć się responsywniej, bez zmiany w TYM co pokazują karty
analityczne (liczby identyczne, tylko szybciej liczone).

## 17. Optymalizacja wydajności, runda 4 — i podsumowanie kampanii — 2026-09-02

User: "nie zatrzymuj się, optymalizuj dopóki nie stwierdzisz że jest zajebiście". Czwarty
przebieg audytu wydajności, celowo szukający NOWEGO terytorium (Animated/Reanimated w całej
apce, lazy-loading ekranów przez expo-router, synchronizacja z Firestore w tle, konfiguracja
FlatList/SectionList, powtarzające się odczyty AsyncStorage, ekrany pojazdów/osiągnięć).

**Jeden realny fix — `app/vehicles.tsx`.** `summarizeVehicle(v, expenses, mainId)` (skanuje
CAŁĄ historię `expenses` przez `expenseMatchesVehicle` per pojazd) był wołany bezpośrednio w
`vehicles.map(...)` w ciele renderu, bez `useMemo` — dokładnie ten sam wzorzec co
`mood.tsx` w §16, tylko na ekranie Pojazdy. Ponieważ `expanded` (rozwinięcie karty) to lokalny
stan w TYM SAMYM komponencie, samo tapnięcie w kartę pojazdu (żeby ją rozwinąć/zwinąć)
przerenderowywało cały ekran i na nowo skanowało pełną historię wydatków dla KAŻDEGO pojazdu.
Naprawione: `summaries: Record<string, VehicleSummary>` liczony raz w `useMemo([vehicles,
expenses, mainId])`, render czyta gotowy wynik (`summaries[v.id]`) zamiast wołać funkcję
wprost.

**Reszta czwartej rundy — same dead endy** (dokładnie sprawdzone, nic do zrobienia):
Animated/Reanimated w CAŁEJ apce (TopPill/AnimatedCardBg/TabBar/StreakFlame/CatArt/Confetti/
BadgeArt/YearWrappedCard/MonthWrappedCard i więcej) już poprawnie ma `useNativeDriver: true`
wszędzie gdzie to możliwe (jedyne dwa `useNativeDriver: false` w `boss-fight.tsx` są jawnie
skomentowane jako wymagane — animują `left`, właściwość layoutu, nie kwalifikującą się do
native drivera) i każda pętla ma poprawny `.stop()` w cleanupie; `expo-router` już ma
świadomy code-splitting przez dynamiczny `import()` dla serwisów pobocznych (powiadomienia,
kalendarz, sync zdrowia, przetwarzanie banku) w kilku ekranach; `react-native-chart-kit` to
jedyna "ciężka" biblioteka w `package.json`, ale ZERO importów nigdzie (koszt na dysku, nie w
runtime); serwisy Firestore/backup (`maybeAutoBackup`, `flushPendingExpenseWrites`,
`drainBankNotifications`, `autoSyncHealth`) są już throttlowane/dedup-gated; `finances.tsx`'s
`SectionList` już capuje się do ostatniego miesiąca; ~113 miejsc czytających `AsyncStorage`
wszystkie effect-gated, żadne w ciele renderu; `achievements.tsx` już memoizuje kontekst/stany.

`tsc`/`jest` zielone (67 suit/822 testy). **Priorytet testu na urządzeniu**: zakładka
Pojazdy — rozwijanie/zwijanie karty pojazdu powinno czuć się płynniej przy dłuższej historii
wydatków; liczby (suma/ten miesiąc/paliwo) identyczne jak wcześniej.

**Podsumowanie kampanii (4 rundy, ta sama sesja)**: notatki (memoizacja listy), wyszukiwarka
jedzenia (re-normalizacja na klawisz), assety ekwipunku/bossów ×2 (17MB→4MB, potem kolejne
nowo wgrane pliki), dashboard (7 "deferred" widgetów liczonych mimo stagingu), pupil (animacje
w tle podczas walki), Nastrój (6 kart analitycznych bez memoizacji + zły selektor store'a),
Pojazdy (ta sama luka co Nastrój). Świadomie NIE ruszone (udokumentowane, czekają na decyzję):
rosnący koszt pełnego re-serialize blobu w zustand persist (§15) — duży redesign warstwy
danych, nie coś do zrobienia po cichu. Zdrowie (`health.tsx`) sprawdzone i świadomie
zostawione — koszt realnie znikomy. Czwarta runda znalazła jeden, coraz mniejszy fix (klasyczny
malejący zwrot z kolejnych przebiegów tego samego audytu) — dalsze rundy w tym samym stylu
zaczęłyby produkować teoretyczne nitpicki zamiast realnych, odczuwalnych problemów.

## 18. Startupy przeniesione do PetCustomizeModal + tła areny per typ walki (przygotowanie) — 2026-09-02

**Startupy (kosmetyk ekranu ładowania) — pełna migracja z `pet-shop.tsx` do `PetCustomizeModal.tsx`.**
User: "przeniosłeś z rynku pupila startupy na [modal], gdzie ma edycję nazwy i kolory?" →
"tak ogarnij to". Pierwotnie (2026-08-19) Startupy świadomie ZOSTAŁY w sklepie przy migracji
Kolorów+Dodatków do `PetCustomizeModal` — uzasadnienie brzmiało "to nie 'kotek'" (startup to
kosmetyka APKI, nie zwierzaka). User po czasie chciał jednak WSZYSTKĄ kosmetykę w jednym
miejscu. Zmiana:
- **`PetCustomizeModal.tsx`** dostał nową sekcję "Startup (ekran ładowania)" — ten sam
  wzorzec kup/ustaw co Kolor/Oczy/Nosek (`onStartup`/`renderStartupCell`, reużywają
  `s.cell`/`s.cellName`/`s.cellState`/`s.costTxt`/`s.grid`/`confirmBuy` — wszystko już
  istniało w tym pliku). Grupowanie po `TIER_ORDER` (basic/rare/epic, z kolorowym `tierDot` +
  nagłówkiem) — `TIER_ORDER` był już zadeklarowany w tym pliku, ale nieużywany (martwy
  leftover po jakiejś wcześniejszej próbie) — teraz ma zastosowanie.
- **`app/pet-shop.tsx`** — cała zakładka "Startupy" i "Posiadane" (która i tak pokazywała
  TYLKO startupy) USUNIĘTE razem z przełącznikiem kategorii `CATS`/`Cat` (przy jednej
  pozostałej kategorii "Rynek" przełącznik byłby martwym UI) — ekran renderuje teraz Rynek
  (skrzynki+sklep dnia) bezpośrednio, bez zakładek. `grantStartup` (nagroda ze skrzynki gacha)
  ZOSTAJE — startupy dalej dropują z loot boxów, tylko wybór/zakup przeniósł się do modala.
  Martwe importy/style po usunięciu (Rocket/Backpack ikony, StartupPreview, petStartups,
  TIER_META/CosmeticTier, style `chips`/`chip*`/`subHead`/`tierDot`/`grid`/`cell`/`cost*`/
  `startup*`/`animTag`/`emptyOwned*`) posprzątane.

**Tła areny walki PER TYP — przygotowanie architektury, bez nowej grafiki.** User
(mid-turn): "Questy będą miały oddzielne tło, kampania bosów to co jest, a eventowe będą
miały osobne a MAD bossy będą miały jeszcze inne — ogarniasz? Ale to na razie może zostać,
sprawdzę to co mamy, a potem jak będę miał nowe tła to napiszę — możesz przygotować pod to
najwyżej." Zrobione TYLKO przygotowanie (user nie ma jeszcze plików dla quest/event/mad):
`bossIcons.ts` dostał `ARENA_BG_BY_KIND: Partial<Record<ArenaKind, ImageSourcePropType>>`
(dziś tylko `campaign: CAMPAIGN_ARENA_BG`, reszta zakomentowana jako gotowe miejsca na
przyszłe `require()`) + `arenaBgFor(kind)` (fallback na `CAMPAIGN_ARENA_BG` dla `kind` bez
własnego wpisu). `boss-fight.tsx` woła teraz `arenaBgFor(kind)` zamiast stałego
`CAMPAIGN_ARENA_BG` — wizualnie DZIŚ nic się nie zmienia (wszystkie tryby dalej widzą to samo
tło kampanii), ale dodanie kolejnej grafiki w przyszłości to JEDNA linia w mapie w
`bossIcons.ts`, zero zmian w `boss-fight.tsx`.

`tsc`/`jest` zielone (67 suit/822 testy, bez zmian w testach — czysto UI-owa migracja +
architektoniczne przygotowanie, bez nowej logiki biznesowej do przetestowania jednostkowo).
**Priorytet testu na urządzeniu**: (a) `/pet` → tap w imię → sekcja "Startup" na dole modala —
kup/ustaw działa tak samo jak wcześniej w sklepie, podgląd animacji na górze się aktualizuje;
(b) Rynek (`/pet-shop`) — bez zakładek, od razu widać Skrzynki+Sklep dnia, otwarcie skrzynki
z wylosowanym startupem dalej działa (modal "NOWY STARTUP!"); (c) dowolna walka — tło areny
wygląda identycznie jak przed tą zmianą (to czysto przygotowanie pod przyszłość, nie redesign).

## 19. Foldery assetów bossów/lokalizacji — posegregowane jak ekwipunek — 2026-09-02

User zapowiedział nową grafikę Rynku (2 warstwy + sklepikarz między nimi) i poprosił NA RAZIE
o dwie rzeczy: (1) posegregować foldery assetów jak `assets/ekwipunek/<slot>/`, (2)
zaprojektować "sklepikarza" (kotek w przebraniu za ladą). Ten wpis dotyczy (1) — (2) osobno,
patrz niżej / kolejny PR.

**`assets/ikonybosów/` (43 pliki, mieszanka wszystkiego) + `assets/minibosses/` (8 plików)
→ `assets/bossy/{kampania,questy,eventy-rajdy,umiejetnosci}/` + `assets/lokalizacje/`.**
Wszystkie pliki przeniesione przez `git mv` (historia gita zachowana, widoczne jako
`renamed` nie `deleted+added`). Podział wg REALNEGO id/mechaniki (nie nazwy pliku):
- **`kampania/`** — 22 bossów kampanii (`sloth`...`wizard`) + `BOSS_atakfire_adventure.png`
  (martwy plik bez odpowiadającego id w `BOSSES` — zostawiony, może się przyda na przyszłego
  bossa).
- **`questy/`** — minibossy questowe: `mb_capybara/duck/shark/harpy/macaws/snake` (dawne
  `assets/minibosses/`) + `mb_wilk/grizzly/osa` (dawniej luzem w `ikonybosów/`) +
  `MINIBOSS_goat.png`/`MINIBOSS_whale.png` (martwe, wycofane z rotacji 2026-08-26 — zostawione
  na wypadek powrotu do puli).
- **`eventy-rajdy/`** — user połączył sezonowe eventy (`wakacje/wiosna/jesien/zima`) I raid
  (`kraken/golem/phantom` + ich warianty `MADBOSS_*`) w JEDNĄ zakładkę, więc jeden folder.
- **`umiejetnosci/`** — ikony ataku bossów (`BOSSATTACK_*`, pocisk kontrataku w
  `boss-fight.tsx`) + `BOSSATTACK_bomb.png` (martwy, po usuniętym efekcie z 2026-08-18).
- **`assets/lokalizacje/`** — `LOKACJA_KAMPANIA.png` (tło areny, patrz §18's `arenaBgFor`) —
  przyszłe `LOKACJA_QUEST/EVENT/MAD.png` też tu trafią.

3 bossy raidu (`behemoth`/`wyrm`/`siren`) POŻYCZAJĄ art z folderu `kampania/` (dzielą motyw z
`sugar`/`dragon`/`drought`, patrz istniejący komentarz w `bossIcons.ts`) — ich `require()`
wskazuje przez folder, to nie błąd, po prostu pożyczony plik mieszka gdzie indziej niż
własny id boss'a. Wszystkie `require()` w `src/utils/bossIcons.ts` zaktualizowane (jedyne
miejsce w kodzie, gdzie te ścieżki żyją — reszta plików ma tylko historyczne komentarze
wspominające starą nazwę folderu, celowo nietknięte, to opis PRZESZŁYCH wydarzeń).

`tsc`/`jest` zielone (67 suit/822 testy, bez zmian w testach — czysty przenos plików + zmiana
ścieżek). Zweryfikowane skryptem: każdy `require()` w `bossIcons.ts` wskazuje na realnie
istniejący plik pod nową ścieżką. **Priorytet testu na urządzeniu**: dowolny ekran z bossami
(kampania/raid/event/quest/MAD/misja) i dowolna walka — WSZYSTKIE portrety/ikony ataku/tło
areny powinny wyglądać DOKŁADNIE tak jak przed tą zmianą (to czysty przenos plików, zero
zmiany w tym co się renderuje).

## 20. "Sklepikarz" — CatArt w przebraniu za ladą — 2026-09-03

Część 2 zapowiedzianego Rynku (§19 to część 1). User: "sklepikarz to będzie nasz ten
kotek tylko go ubierzemy w wąsy takie (jakby byl inkognito) kapelusik przez który będą mu
uszka wystawały, wyłączymy mu animacje lizania i głaskanie... rozgladanie mu zostaje tylko
zeby nie byl zbyt statyczny... zeby go odróżnić będzie on miał kolor specyficzny". Zero
nowego komponentu — to jest `CatArt` z nowym propem.

**`CatArt.tsx` — nowy prop `shopkeeper?: boolean` (domyślnie `false`):**
- Renderuje wąsy (fałszywy handlebar-mustache, stały kolor `#241A10`, niezależny od
  `palette` — to kostium, nie futro) + kapelusz (rondo/daszek/pasek/klamra, odcienie brązu)
  jako nowe elementy WEWNĄTRZ `<Svg>`, narysowane na samym końcu (po oczach/ustach/wąsach/
  ikonach chorego-smutnego) — więc leżą na wierzchu twarzy.
- **Uszy automatycznie wychodzą na wierzch kapelusza za darmo** — `<Ear>` to osobny
  overlay renderowany PO zamknięciu `<Svg>` (już taki był layer order, patrz komentarz przy
  `<Ear side="R">`/`<Ear side="L">` ~L610), więc kapelusz narysowany WEWNĄTRZ Svg zawsze
  będzie pod uszami bez żadnej dodatkowej maski/cutout.
- Wyłącza auto-lizanie: idle-lick `useEffect` (był gated `[animate, asleep, angry,
  licking]`) ma teraz `|| shopkeeper` w warunku wyjścia + w deps.
- Wyłącza reakcje na dotyk/przytulanie: `onTap`/`doCuddle` (wewnętrzne handlery
  `Pressable`, odpalają się ZAWSZE niezależnie od tego czy caller podał `onPress`) mają
  teraz `|| shopkeeper` w guard-clause — więc tap na sklepikarza nie odpala hop/wiggle/
  serduszek/purr-wibracji/half-lid oczu.
- **Świadomie NIE dotknięte**: breathe/blink/idle-glance/idle-ear-flutter — user explicit:
  "rozgladanie mu zostaje tylko zeby nie byl zbyt statyczny". Sklepikarz oddycha, mruga,
  łypie okiem i strzyże uchem tak samo jak zwykły kotek — tylko nie liże się i nie reaguje
  na tapnięcia.

**`catPalettes.ts` — nowy `SHOPKEEPER_PALETTE` (poza `CAT_PALETTES`, gracz go nie kupuje/
zakłada):** stały ciepły tan (`#C9A876`), dobrany żeby wizualnie różnić się od wszystkich
10 kupowalnych presetów (najbliżsi sąsiedzi: ginger `#EDA968`, brown `#A97B54` — ten jest
jaśniejszy/bardziej wyszarzony niż oba) — niezależnie jaki kolor gracz wybrał SWOJEMU
kotkowi, sklepikarz zawsze będzie inny. `shade()` wyeksportowane z `catPalettes.ts` (było
prywatne) żeby policzyć `shade`/`ear` tej palety tym samym wzorem co reszta presetów.

Weryfikacja wizualna: zbudowana statyczna replika SVG (te same ścieżki co w `CatArt.tsx`)
wyrenderowana przez `playwright screenshot` — zanim cokolwiek trafiło do prawdziwego
komponentu, zobaczyłem jak mustache/hat/ears-on-top wygląda naprawdę, iterując kształt
wąsów (draft 1 → wyraźniejszy handlebar z zawiniętymi końcówkami) i głębię kapelusza
(dodany highlight + klamra na pasku) zanim wkleiłem finalne ścieżki do `CatArt.tsx`.

**Priorytet testu na urządzeniu**: `<CatArt shopkeeper palette={SHOPKEEPER_PALETTE} .../>`
gdziekolwiek zostanie użyty (przyszły ekran Rynku, jeszcze nie podpięty — user ma dopiero
przysłać grafikę tła/slotów) — sprawdzić że wąsy/kapelusz/uszy wyglądają dobrze w
rzeczywistej skali `size` (SVG-owe ścieżki liczone ręcznie z viewBox 2000×2000, nie testowane
w RN, tylko w przeglądarce) i że tap na niego faktycznie nic nie robi (brak serduszek/hop).

**Draft 2 (2026-09-03)** — user zobaczył zrzut ekranu draftu 1: "to musimy go dopracować
uszy mają wystawać ale naturalnie i wąsy podkreślone bardziej". Dwie poprawki, ZERO zmian w
geometrii samych uszu (`<Ear>` to współdzielony komponent używany wszędzie indziej w
aplikacji — poprawka dotyczy WYŁĄCZNIE kapelusza/wąsów wokół nich):
- **Wąsy** — z cienkiego wypełnionego kształtu na GRUBE łuki (`strokeWidth=24`,
  `strokeLinecap="round"`) z małymi kółkami na końcówkach (zawinięty handlebar) + cienki,
  jaśniejszy highlight wzdłuż górnej krawędzi. Dużo czytelniejsze w skali portretu niż
  poprzedni cienki filled-blob.
- **Kapelusz** — korona zwężona (760-1160 zamiast 700-1220), więc jej skos nie wchodzi
  tak głęboko w sylwetkę każdego ucha — odsłania WIĘCEJ obu uszu symetrycznie (wcześniej
  prawe ucho ledwo było widoczne, bo korona je prawie całkiem zasłaniała). Dodana mała,
  ciemna elipsa "gather" (fałda materiału) u podstawy każdego ucha, narysowana NA
  kapeluszu, ale POD uchem (uszy renderują się już po zamknięciu całej tej grupy) — czyta
  się jako "ucho wychodzi PRZEZ dziurę w materiale", nie "coś leży obok kapelusza".

Zweryfikowane tym samym `playwright screenshot` na statycznej replice (zoom 1000×1000 do
sprawdzenia symetrii uszu z bliska) przed wklejeniem do `CatArt.tsx`.

## 21. Walka bossów — HP pod portretem, "ground shadow", większy kotek — 2026-09-03

User (patrząc na zrzut ekranu areny): "w bossach w walkach zdrowie musi byc pod spodem I
musimy jakoś wyróżnić cieniem te bossy i kotka (oraz kotka powiększyć bo jest teraz mniejszy
od wroga znacznie)". Trzy zmiany w `app/boss-fight.tsx`, ten sam ekran co §19/§20 dotyczyły
tła.

- **HP pod portretem, nie nad nim.** W obu kolumnach (`s.tile`) portret (`s.tilePortrait`)
  jest teraz PIERWSZYM dzieckiem, etykieta+pasek HP+tekst HP idą PO nim. To odwraca
  dotychczasową kolejność (etykieta/HP/portret) — wizualnie kotek/boss stoją na scenie, a HP
  czyta się jak podpis pod nimi, nie nagłówek nad.
- **`s.projectile.top` przeliczony deterministycznie.** Wcześniej ta stała była wyliczona z
  wysokości linijek tekstu NAD portretem (nieprecyzyjne, zależne od domyślnego line-height
  fontu). Teraz portret jest pierwszym elementem, więc jego pionowy środek to czysta suma:
  `tile.padding-top (8) + tilePortrait.height/2 (193/2) - połowa ikony pocisku (14) = 91`.
  Zero zgadywania metryk fontu.
- **`GroundShadow` (nowy `src/components/ui/GroundShadow.tsx`)** — miękki, spłaszczony cień
  pod stopami sprite'a, ta sama technika co `RadialGlow` (prawdziwy SVG radial-gradient, bo
  RN Views go nie mają), tylko rozciągnięty nierównomiernie (`preserveAspectRatio="none"`) w
  elipsę zamiast koła. Renderowany jako PIERWSZE dziecko nowego, DOKŁADNIE-rozmiaru-sprite'a
  wrappera (`s.spriteBoxCat`/`s.spriteBoxBoss`, osadzonego wewnątrz wspólnej, wyższej
  `tilePortrait`) — `bottom:0` względem TEGO ciasnego boxa, więc cień trafia pod faktyczne
  łapki, nie pod pusty margines wspólnego kafelka.
- **Kotek większy niż boss przy tym samym `PORTRAIT_SIZE`.** Nowa stała
  `CAT_PORTRAIT_SIZE = 175` (boss zostaje `PORTRAIT_SIZE = 130`) — CatArt to SVG z viewBox
  2000×2000, ale sam kotek zajmuje w nim wyraźnie mniej niż całą ramkę (spory margines wokół),
  podczas gdy PNG bossów (`BossArt`) są przycięte ciasno do sylwetki — przy identycznym
  `size` boss zawsze wyglądał wyraźnie większy. `tilePortrait.height` liczone z WIĘKSZEGO z
  dwóch rozmiarów (`Math.max(PORTRAIT_SIZE, CAT_PORTRAIT_SIZE) + 18`), żeby obie kolumny
  dzieliły tę samą wysokość kafelka i etykiety/HP wyrównywały się w tym samym rzędzie mimo
  różnych rozmiarów portretów.

Geometria zweryfikowana offline: schematyczny HTML mockup (kolorowe sylwetki zamiast
prawdziwego SVG/PNG, te same px co w kodzie: 175/130/193/91/0.62/0.18) wyrenderowany przez
`playwright screenshot` — czerwona linia na wysokości `projectile.top=91` przechodzi
dokładnie przez środek obu portretów, cień siada pod "stopami" obu sylwetek, HP wyrównuje
się w tym samym rzędzie po obu stronach mimo różnych rozmiarów boxów.

`tsc`/`jest` zielone (67 suit/822 testy, brak zmian w testowalnej logice — czysto layout).
**Priorytet testu na urządzeniu**: dowolna walka — (a) HP pod portretem czytelne, nie
nachodzi na nic; (b) cień widoczny pod kotkiem i bossem, nie "pływa" oderwany od sprite'a;
(c) kotek wyraźnie większy niż wcześniej, ale NIE ucięty przez `overflow:'hidden'` sceny
areny na węższych telefonach (to jedyne ryzyko tej zmiany — `CAT_PORTRAIT_SIZE=175` dobrany
z zapasem, ale nie zmierzony na prawdziwym, wąskim ekranie); (d) lecący pocisk/łapka dalej
trafia wizualnie w środek portretu, nie w pasek HP.

## 22. Quest "rower" — z czujnika na self-report, sekcja "Trening" na górze Zadań — 2026-09-03

User: "te questów ze jeździć rowerem 20 min dziwnie łapie bo zawsze nawet jak nie robię to
zawsze jest do odebrania zaliczone... moze zrobmy inne ćwiczenia czy coś... i te zadania
muszą byc na samej górze jako ekstra i byc za więcej coinow i XP (musi byc zachęta by to
robić) zrob ładniejszy ekran cwiczen... i skaluje to z lvl kotka pupila".

**Przyczyna false-positive (nie bug w naszym kodzie)**: `b_bikeride` był JEDYNYM z 6 questów
treningowych opartym o czujnik — `ExerciseSession` z Health Connect, filtrowane po
`exerciseType` BIKING/BIKING_STATIONARY (`healthConnectService.ts`). Telefon/zegarek czasem
auto-klasyfikuje jazdę samochodem albo szybki spacer jako "biking" — znany fałszywy-pozytyw
wykrywania aktywności, Health Connect nie udostępnia confidence score do odfiltrowania tego.
Stąd "zawsze zaliczone nawet jak nie jeżdżę".

**Naprawa — rower dołączył do self-reportu, jak pozostałe 5:**
- `quests.ts`: `QuestCtx.bikeMinutesToday` (Health Connect) → `bikeToday?: boolean`
  (self-report, jak `pushupsToday` itd). `b_bikeride.done` = `!!c.bikeToday`, `note` = "zrobione"
  / "stuknij po zrobieniu" (ten sam wzorzec co reszta piątki, bez paska postępu — self-report
  jest binarny, nie ma czego pokazać jako ułamek).
- `petStore.ts`: nowe pole `bikeDay: string | null` + akcja `markBikeDone()`, dokładnie ten
  sam wzorzec co `pushupsDay`/`markPushupsDone` itd (persist partialize zaktualizowany).
- `TrainingSessionModal.tsx`: `SelfReportExercise` był `Exclude<TrainingExercise, 'bike'>` —
  teraz pełny `TrainingExercise` (bike włączony). Rower dołączył do `TIMED` (jak
  deska/rozciąganie — realnie odliczany timer na `bikeTarget` minut, z przyciskiem "Pomiń"
  jeśli user faktycznie już przejechał się wcześniej), `META.bike = { label: 'Rower', unit:
  'minutes' }`.
- `usePetQuests.ts`: czyta `bikeDay` ze store'a zamiast `health.cyclingMinutesToday` do
  zbudowania `bikeToday`. `cyclingMinutesToday`/Health Connect biking-sensing SAM W SOBIE
  zostaje nietknięty (nadal zasila wykres w `app/(tabs)/health.tsx` — to inny, niezależny
  odbiorca tych samych surowych danych, nie ma powodu go ruszać).

**Wyższe nagrody + zachęta (2× flat bump, `quests.ts` BONUS)**: pushups/squats/situps/plank
4→8 monet, 10→20 XP; stretch 4→8 / 9→18; bike (nadal najwyższy z szóstki — największy
wymagany czas) 5→10 / 13→26. Wszystkie 6 dalej skalują się z poziomem pupila przez ISTNIEJĄCY
wspólny `questRewardMult(level)` w `buildQuests` — user chciał skalowania z lvl, a to już
działało dla WSZYSTKICH questów (nie tylko treningowych); świadomie NIE dodana druga,
osobna krzywa tylko dla treningu — jedna, wspólna, już przetestowana wystarcza.

**`app/pet-quests.tsx` — nowa sekcja "Trening" na SAMEJ GÓRZE ekranu** (przed nawet
"Nieodebrane z poprzednich dni"): wyciąga wszystkie 6 questów treningowych
(`TRAINING_QUEST_IDS`) z ogólnej puli `bonusDaily` do własnej, wizualnie odrębnej karty —
pomarańczowy akcent (`#FB923C`, plakietka "EKSTRA"), ikona per ćwiczenie (Dumbbell/Flame/
Activity/Timer/Sparkles/Bike z lucide — czysto orientacyjny placeholder, user obiecał
docelową grafikę później: "moge potem wygenerować grafiki pod to"), pigułka nagrody pokazuje
TERAZ TEŻ XP (nie tylko monety jak reszta list) — podkreśla że to wyższy tier. Reszta
`bonusDaily` (stepbeat/water/sleep) zostaje w zwykłej sekcji "Bonusowe dziś" niżej, filtrowana
osobno (`otherBonus`). `selfReport` mapa (exercise→target→action) podniesiona z lokalnej
zmiennej wewnątrz JSX do jednego wspólnego miejsca w komponencie — używana teraz przez OBIE
sekcje (trening na górze, ewentualny fallback niżej), zero duplikacji.

`tsc`/`jest` zielone (67 suit/822 testy, żaden test nie odwoływał się do starych wartości
nagród/`bikeMinutesToday` — nic do aktualizacji w testach). **Priorytet testu na
urządzeniu**: (a) sekcja "Trening" faktycznie na samej górze, nad zaległymi/codziennymi;
(b) rower NIE zalicza się sam — trzeba przejść przez "Rozpocznij" → timer → potwierdzenie,
jak deska/rozciąganie; (c) nagrody widoczne w pigułce (monety+XP) zgadzają się z tym co
faktycznie dopisuje się po "Odbierz"; (d) `markBikeDone`/`bikeDay` persystują między
sesjami (zamknij i otwórz apkę tego samego dnia — rower powinien zostać "zrobione").

## 23. Black screen w "Co zjadłem" — `purchasedCatForName` resortowała CAŁĄ historię wydatków co klawisz — 2026-09-04

User: "jak dodałem ciastka wczorajsze ze zjadłem na testa to znowu mam black screena, z
dzisiejszymi nie ma problemu z wczorajszymi jest" — "znowu" bo TO SAMO zgłoszenie ("Co
zjadłem → Produkty → ciastka → Zapisz") padło już 2026-08-31, wtedy przeszukane statycznie
bez znalezienia przyczyny i odhaczone jako "user: nie wywala już, nie wiem o co chodzi" —
czyli NIGDY realnie nie naprawione, po prostu przestało się powtarzać, aż wróciło.

**Root cause** (znaleziony przez Explore-agenta, potwierdzony ręcznie): `purchasedCatForName()`
(`src/utils/food.ts`, dodana w §14 — most kategorii "co kupuję"→"co zjadłem") robiła
`[...expenses].sort(...)` — pełny klon+sort CAŁEJ historii wydatków — PRZY KAŻDYM WYWOŁANIU.
`app/food/product.tsx` woła ją z `useEffect` zależnego od `name` — czyli TEKSTU wpisywanego w
polu nazwy nowego produktu — więc każdy pojedynczy znak wpisany przy tworzeniu nowego produktu
(np. "ciastka") odpalał pełny re-sort historii paragonów. Dla usera z dłuższą historią
(setki wydatków, patrz §15 "rosnący blob") to realny freeze JS threada = black screen,
dokładnie przy pisaniu nazwy — nie przy samej dacie posiłku. Wyjaśnia "dzisiejszymi nie ma
problemu": produkt "ciastka" najpewniej istniał już jako ZNANY produkt z kategorią
(`cat` ustawione) z wcześniejszego testu, więc dla "dzisiaj" ten `useEffect` bailował
natychmiast (`if (editing || cat || ...) return`) — "wczoraj" najwyraźniej trafiło na
tworzenie GENUINE NOWEGO produktu, ten sam kosztowny per-znak path.

**Fix**: `purchasedCatForName(name, expenses)` rozdzielona na `buildPurchasedCatIndex(expenses)`
(sort+scan RAZ, buduje `Map<znormalizowana nazwa, subcat>`) + `purchasedCatForName(name, index)`
(już tylko `Map.get`, O(1)). Semantyka zachowana 1:1 (nowy test w `food.test.ts` to sprawdza) —
najnowszy zakup wygrywa, ale jeśli najnowszy nie ma użytecznego tagu (samo "inne"), indeks
patrzy dalej wstecz zamiast się poddawać. Obaj callerzy (`app/food/product.tsx` — per-klawisz,
`app/food/add.tsx` — per-zapis nowego produktu, 2 miejsca) budują indeks RAZ przez
`useMemo(() => buildPurchasedCatIndex(expenses), [expenses])` zamiast wołać starą funkcję
bezpośrednio.

`tsc`/`jest` zielone (67 suit/823 testy — nowy test w `food.test.ts` na semantykę "najnowszy
bez tagu nie blokuje starszego z tagiem"). **Priorytet testu na urządzeniu**: Co zjadłem →
Produkty → wpisz nazwę CAŁKOWICIE nowego produktu (nieużywanego wcześniej) — pisanie powinno
być płynne, zero laga/zawieszenia, nawet z długą historią paragonów.

## 24. Baza jedzenia: duża dobitka produktów + naprawa dziur w wykrywaniu słodyczy — 2026-09-04

User: "dodaj więcej o wiele produktow z kaloriami realnym, i dodatkowo zeby zaliczamy sie do
słodyczy jak coś jest sldyxzem [słodyczem]" — dwie osobne rzeczy w `src/data/foodBase.ts` i
`src/store/countersStore.ts`.

**1. ~65 nowych produktów** (`foodBase.ts`, obok dobitki słodyczy z §23-poprzedzającej sesji)
— wypełnia największe dziury: mięso SUROWE do gotowania (nie tylko wędliny — schab, wołowina
mielona, żeberka, karkówka, golonka, kaszanka…), więcej ryb (dorsz, pstrąg, krewetki, paluszki
rybne…), rośliny strączkowe/białko roślinne (soczewica, ciecierzyca, tofu, tempeh, edamame),
owoce suszone, orzechy/nasiona (pistacje, chia, siemię lniane…), napoje, kasze śniadaniowe
(kuskus, quinoa, manna), sporo dań obiadowych (bigos, żurek, gulasz, gołąbki, risotto, curry…)
i fast foodowych (cheeseburger, nachos, falafel, gyros…). Zweryfikowane skryptem, że ŻADNA
nowa nazwa nie duplikuje istniejącej (baza ma 19 PRZEDWCZEŚNIEJSZYCH duplikatów z
wcześniejszych rund — świadomie NIE ruszone, poza zakresem tej prośby).

**2. Naprawiona realna dziura w `AVOID_PRESETS.sweets`** (`countersStore.ts`) — audyt CAŁEJ
bazy `foodBase.ts` (nie tylko nowo dodanych produktów) ujawnił, że sporo KLASYCZNYCH polskich
słodyczy w ogóle nie łapało się jako "słodycze" dla streaka "bez słodyczy": **krówki, ptasie
mleczko, sernik, brownie, gofry, delicje/biszkopt, michałki, kremówka, eklerka, faworki,
beza, kasztanka, andruty, herbatniki, muffinka, budyń, wafelek** + marki (Snickers/Kinder
Bueno/Prince Polo/Grześki). Zjedzenie krówki czy ptasiego mleczka NIE psuło streaka mimo że
to oczywiste słodycze — czysty przeoczony gap w keyword-liście, nie architektoniczny problem.

Każdy nowy fragment keyword ręcznie sprawdzony (node -e skrypt na CAŁEJ bazie) pod kątem
fałszywych trafień: `tortik` zamiast samego `tort` (żeby nie złapać "Tortilla pszenna"),
`wafel` zamiast `wafl` (żeby nie złapać "Wafle ryżowe" — inny, niesłodki produkt), `beza`/
`bezy` zamiast gołego `bez` (za krótki/niebezpieczny podciąg). Diakrytyki zdublowane tym
samym wzorcem co reszta listy (kremówk/kremowk, michałk/michalk, krówk/krowk).

`tsc`/`jest` zielone (67 suit/837 testów — 14 nowych w `countersStore.test.ts`: 12 nowo
łapanych słodyczy + 2 celowe non-matche na Tortilla/Wafle ryżowe, dowodzące że fix nie
wprowadził fałszywych trafień). **Priorytet testu na urządzeniu**: (a) Co zjadłem → wyszukaj
kilka nowych produktów (np. "Soczewica", "Krewetki", "Bigos") — powinny się znaleźć z
sensownymi kaloriami; (b) zjedz "Krówki" lub "Ptasie mleczko" mając aktywny nawyk "bez
słodyczy" — streak powinien się zresetować (wcześniej NIE resetował się).

## 25. Ekran Pupil: większe sloty ekwipunku, zbita siatka staty, powiększony pasek Lv — 2026-09-04

User: "I te sloty na ekwipunku pupila jeszcze powiększyć trochę bo teraz itemy nadal sa
trochę malo widoczne plus zbić bardziej te statystyki i wydłużyć i powiększyć lvl zeby byl
czytelniejszy i bardziej widoczny kosztem nawet wywalenia tego paska głaskania z serduszkiem".
Trzy zmiany czysto wizualne, zero logiki ruszonej.

**1. Sloty ekwipunku** (`GearPanel.tsx`) — DRUGIE powiększenie (pierwsze było 2026-08-27,
40→50px). Teraz 50→62px slot, ikona obrazka itemu 34→44px, kolumna flank 56→68px, pusty-slot
lucide-icon 22→27px, kropka-wskaźnik 8→9px.

**2. Siatka "Siła bojowa"** (`app/pet.tsx`, `statGrid`/`statCard`) — zbita: padding karty
12→9, gap siatki 8→6, `statVal` 20→17, `statLabel` 11→10, `statSub` 9.5→9, wszystkie 8 ikon
w kartach (Swords/Heart/Zap/Compass/Swords/Hourglass/Wind/Target) 18→15px, `buyPill`
marginTop 6→4 (3 miejsca: atak/HP/wyślij misję).

**3. Pasek Lv powiększony kosztem paska głaskania** — usunięty `miniBarRow` (ikona serca +
różowy progress-bar głaskania) z `topRight` w headerze. **WAŻNE**: to usunęło tylko wizualny
pasek — `affToday` (`affectionDay === todayISO() ? affection : 0`) nadal liczone i nadal
przekazywane jako prop `affection` do `<CatArt>` (steruje intensywnością animacji głaskania
przy tapnięciu), a mechanika "100 głaskań dziennie → `r.justFull` → toast '❤️ {imię} daje Ci
skrzynkę sardynek!' + przycisk `pendingCrates`" działa dokładnie tak samo jak wcześniej —
zniknął tylko wskaźnik postępu w headerze, nie sama funkcja. Zwolnione miejsce poszło na Lv:
`topRight`/`lvlBarRow` width 132→176, `lvlBarLabel` font 11.5→14.5 (width 34→42),
`lvlBarTrack` height 8→13 (borderRadius 4→6.5 też na fill), `lvlXpTxt` font 9.5→11.5 (usunięty
stary hack `marginTop:-4`). Style `miniBarRow/miniBarLabel/miniBarTrack/miniBarFill/affHeart`
skasowane.

`tsc`/`jest` zielone (67 suit/837 testów — bez zmian w testach, to czyste UI). **Priorytet
testu na urządzeniu**: ekran Pupil → sprawdź czy itemy w slotach ekwipunku są teraz wyraźnie
widoczne, czy pasek Lv jest czytelny i nie ucieka poza header na wąskim ekranie (obok imienia
+ chipa nastroju), czy siatka staty nadal się mieści bez dziwnego zawijania, i czy tapnięcie
kotka nadal daje normalną reakcję głaskania mimo braku widocznego paska.

## 26. Ekran Rynku (Sklep) dostał prawdziwą grafikę zamiast plain-kart — 2026-09-05

Kontynuacja wątku z poprzedniej sesji (spec artefakt "Rynek", user wysłał referencyjny
`LOKACJA_KAMPANIA.png` do ChatGPT + prompt) — user wygenerował i wgrał 3 pliki bezpośrednio
przez GitHub UI na `master` (`assets/lokalizacje/LADAGORA.png`, `LADADOL.png`,
`TLOSKLEPIKARZ.png`, wszystkie RGBA z realną przezroczystością, nie białym tłem).

**Odkrycie nazw wbrew intuicji**: mimo nazw, `LADAGORA.png` ("lada góra") to MAŁA tablica z
TYLKO 4 oknami (zawieszona jak szyld), a `LADADOL.png` ("lada dół") to WŁAŚCIWA lada — cały
kontuar z workiem/sejfem na blacie, godłem-koszykiem i 8 oknami (2×4), zakotwiczona przy
DOLE swojej kanwy. `TLOSKLEPIKARZ.png` to tło wnętrza sklepu (regały, okno, skrzynie).
Wszystkie trzy oryginalnie 1080×1920 z dużym marginesem przezroczystości — `LADAGORA`/
`LADADOL` PRZYCIĘTE (Pillow, bbox nieprzezroczystych pikseli + 24px marginesu) żeby nie
marnować wysokości ekranu; `TLOSKLEPIKARZ` zostaje w oryginalnym rozmiarze (pełnoekranowe
tło, `resizeMode="cover"` i tak przycina brzegi). Współrzędne okien (bbox przezroczystych
"dziur" wewnątrz nieprzezroczystego obrysu) zmierzone RAZ skryptem Python na kanale alfa,
zapisane jako procenty w `src/utils/rynekArt.ts` — jeśli obrazek zostanie kiedyś podmieniony,
trzeba przeliczyć od nowa tym samym skryptem (nie ma go w repo, jednorazowy).

**Mapowanie na istniejącą logikę `app/pet-shop.tsx`** (bez zmian w mechanice/ekonomii,
czysto wizualne przeniesienie): tablica (4 okna) = skrzynka dnia (za darmo) + 3 skrzynki
(`LOOT_BOXES`, sardine/silver/gold rosnąco kosztem) — dawny pełnoszerokościowy hero-wiersz +
lista 3 wierszy ZASTĄPIONE. Górny rząd lady (4 z 8 okien) = Sklep dnia (`dailyShopSlots`,
zawsze ≤4 pozycji) — dawna siatka `dailyGrid` ZASTĄPIONA. Dolny rząd lady (4 okna)
NIEUŻYWANY na razie — Sklep dnia ma tylko 4 pozycje, nie 8; okna po prostu pokazują tło
przez otwór (jak niewypełniona gablota), zero zmiany w danych/ekonomii. Skrzynki straciły
widoczny blurb+odds z listy (za mało miejsca w małym oknie) — ta informacja WCALE nie
zniknęła, przeniosła się do `ConfirmDialog` (nowe pole `extra` na `pendingBuy`, drugi
wiersz wiadomości) — user dalej widzi opis + szanse PRZED zakupem, tylko nie na liście.

Cały ekran dostał pełnoekranowe tło (`ImageBackground` z `RYNEK_BG`, position:absolute pod
headerem i scrollem — oba renderują się z przezroczystym tłem teraz) + półprzezroczysty
scrim za headerem (`c.bg.primary + 'CC'`, zwykłe rgba — ŚWIADOMIE bez `BlurView`, ta sama
decyzja co przy `TabBar` "czyściej + płynniej na Androidzie"). Freeze-streak zostaje jako
zwykła karta (nie pasuje do metafory "okna na kontuarze", to akcja, nie przedmiot).

Wyrównanie okien zweryfikowane PRZED wpięciem do RN — szybki statyczny HTML z prawdziwymi
przyciętymi PNG-ami + kolorowe boxy na policzonych procentach, screenshot playwright,
potwierdzone piksel-w-piksel zanim przełożone na `pctStyle()` w kodzie.

`tsc`/`jest` zielone (67 suit/837 testów, bez zmian w testach — czysto wizualne wpięcie
istniejącej logiki, zero nowej logiki do testowania). **Priorytet testu na urządzeniu**:
otwórz Sklep → sprawdź czy tło + oba kawałki grafiki wyglądają spójnie (bez przesunięcia
okien względem grafiki, różne rozmiary ekranu/DPI mogą się zachować inaczej niż w
statycznym podglądzie na PC), czy header jest czytelny na tle ruchliwej grafiki, czy
tapnięcie każdego z 4+4 okien robi to co powinno (skrzynka dnia/skrzynki/podgląd itemu przed
zakupem), i czy ConfirmDialog dla skrzynek pokazuje teraz blurb+szanse w drugiej linijce.

## 27. Rynek: kontrast slotów, gradient rzadkości, sklepikarz w scenie + kwadratowy pasek misji — 2026-09-05

User zobaczył realny zrzut ekranu Rynku (PR #140 na urządzeniu) i dorzucił trzy uwagi w jednej
wiadomości: "Sloty muszą mieć trochę jaśniejsze lub ciemniejsze lepiej ciemniejsze TŁO żeby
zwiększyć kontrast itemów... co to jest za SKLEPIK... gdzie sklepikarz", plus osobno "rzadkość
itemów to niech będzie kolor gradientu za nimi + gradientowo kolorowy schludny pod nazwę
itemu", plus (inny wątek, ten sam batch wiadomości) pasek misji ma być przygotowany pod
przyszłą tematyczną grafikę.

**1. Kontrast slotów** (`app/pet-shop.tsx`) — nowy `s.artSlotBg` (ciemny zaokrąglony
prostokąt, `rgba(0,0,0,0.5)`, 4% inset od krawędzi okna) pod ikoną/emoji w KAŻDYM z 8 slotów
(skrzynka dnia, 3 skrzynki, 4 itemy Sklepu dnia) — okno na grafice samo w sobie jest
przezroczyste (przebija ruchliwe tło sklepu), bez ciemnego podkładu ikony ledwo było widać.

**2. Gradient rzadkości** (2. wiadomość) — Sklep dnia (4 itemy) dostał `LinearGradient`
(`rgba(0,0,0,0.55)` → `meta.color+'77'`, ten sam `RARITY_META[rarity].color` co wszędzie
indziej) ZAMIAST płaskiego `artSlotBg` — łączy kontrast (ciemny róg) z sygnałem rzadkości
(kolorowy róg) w jednym elemencie. W `GearPreviewModal` pod nazwą itemu doszła cienka
(`height:3`) gradientowa kreska `meta.color → meta.color+'00'` — ten sam kolor rzadkości
czyta się teraz spójnie: plakietka ✓, pigułka, i teraz też kreska pod nazwą.

**3. Sklepikarz nareszcie stoi w scenie** — `shopkeeper` prop na `CatArt` (zaprojektowany
2026-09-03, §20) czekał na SAM ekran Rynku, żeby mieć gdzie stanąć; teraz gdy ekran istnieje
(§26), user zauważył że kotek nigdy nie został faktycznie wstawiony — czysty dead-end, nie
nowy request. Naprawione: `<CatArt size={140} palette={SHOPKEEPER_PALETTE} shopkeeper />`
wyśrodkowany w widocznej luce MIĘDZY tablicą (LADAGORA) a ladą (LADADOL) — dokładnie tam,
gdzie `TLOSKLEPIKARZ` (scena wnętrza, okno/regały) przebija między dwoma kawałkami grafiki.
Bez `onPress` — `shopkeeper` i tak wygasza tap/cuddle-reakcje wewnątrz komponentu.

**4. Pasek misji przygotowany pod tematyczną grafikę** (`app/pet.tsx`) — user zapowiedział że
KAŻDY quest dostanie kiedyś osobną grafikę tła pod walkę, i wtedy wypełnienie paska ma
przechodzić "z czarnego w tę grafikę" zamiast płaskiego niebieskiego gradientu. Sama grafika
NIE ISTNIEJE jeszcze (ten sam wzorzec przygotowania co `arenaBgFor(kind)` dla quest/event/MAD
w §18 — miejsce gotowe, fallback dopóki plików nie ma) — na razie zrobione TYLKO to, o co user
prosił wprost: `missionBarTrack`/`missionBarFillWrap` borderRadius `MISSION_BAR_HEIGHT/2`
(pigułka) → `radius.sm` (kwadratowy), żeby pasek zaczął wyglądać jak "okno" na przyszłą
grafikę miejsca, nie jak abstrakcyjny loading-bar. Wypełnienie samo (niebieski gradient +
fala) NIETKNIĘTE — podmiana na "ciemność→tło lokacji" czeka na realne pliki per quest.

**5. Scena Rynku odklejała się od tła przy scrollu** (znalezione PRZED wysłaniem PR #141 na
urządzenie, user zdążył zobaczyć tylko stan sprzed tego PR-a i pomylił to z "zjebałeś" —
realny bug istniał już w PR #140, po prostu jeszcze niewidoczny bo tablica/lada nie miały
się wtedy z czym rozjeżdżać). Przyczyna: `RYNEK_BG` był `position:absolute` PRZYPIĘTY DO
EKRANU jako sibling `ScrollView`, podczas gdy tablica/sklepikarz/lada scrollowały NORMALNIE w
środku `ScrollView` — przy przewijaniu tło zostawało w miejscu, a grafiki nad nim jechały,
więc kontuar (mający "stać na podłodze" sceny) i tablica (mająca "wisieć u sufitu") odjeżdżały
od tła i wyglądały jak wklejone w złym miejscu/skali, mimo że każdy z 3 plików osobno miał
poprawny rozmiar. Naprawa: nowy `s.scene` wrapper (`position:relative`) wokół tablicy+kotka+
lady — `RYNEK_BG` teraz PIERWSZE DZIECKO w środku TEGO wrappera (nie ekranu), więc scrolluje
RAZEM z resztą sceny, zawsze w idealnej rejestracji niezależnie od pozycji scrolla. Freeze-
card (nad sceną) i `hint` (pod nią) świadomie ZOSTAJĄ POZA wrapperem — nigdy nie miały wymogu
piksel-w-piksel wyrównania z konkretnym miejscem na obrazku, to zwykłe karty UI.

`tsc`/`jest` zielone (67 suit/837 testów, zero zmian w testach — czysto wizualne). **Priorytet
testu na urządzeniu**: (a) Sklep — sloty czytelniejsze na busy tle, Sklep dnia ma kolorowy
gradient zależny od rzadkości (szary/niebieski/fioletowy/złoty zależnie co wylosowało), popup
po tapnięciu itemu ma kolorową kreskę pod nazwą; (b) sklepikarz widoczny między tablicą a ladą,
rozgląda się (nie jest statyczny), NIE reaguje na tapnięcie (brak lizania/serduszek); (c) pasek
misji w trakcie — teraz kwadratowy zamiast pigułki, wypełnienie/countdown/fala działają jak
wcześniej (czysta zmiana kształtu, zero zmiany logiki timera); (d) **NAJWAŻNIEJSZE** — przewiń
ekran Sklepu w górę/dół, sprawdź czy tablica/sklepikarz/lada PRZEWIJAJĄ SIĘ RAZEM z tłem
(cała scena rusza się jako jedna sztywna całość), a nie osobno od siebie jak wcześniej.

## 28. Ciekawostka dnia: usunięta kategoria "z książki", rozwijalny opis + źródło, dużo nowej treści — 2026-09-06

User: "rozbuduj ciekawostki widget, teraz skrót sentencja ciekawostki jest tak jak jest ale
więcej ciekawostek (nie wiem czy masz wgląd do tych co już kliknąłem żeby nie pokazywały się
albo to znam (z książek fragmenty są useless, wywalamy je) i jak kliknę w ciekawostkę to
rozwija mi ją więcej jest ładnie opisane i jest źródło na dole podane". Dotyczy `TriviaCard`
(dashboard) + `src/data/trivia.ts` — NIE dotyczy osobnego, podobnie nazwanego widgetu
"Ciekawostki z Twoich danych" (`FunFactsSection.tsx`/`funComparisons.ts`, personalizowane
porównania z liczb usera typu kroki→km) — ten zostaje bez zmian.

**1. Kategoria `ksiazka` USUNIĘTA CAŁKOWICIE** — 69 wpisów (parafrazy idei z książek
samorozwojowych/popularnonaukowych z przypisanym źródłem) skasowane, `TriviaCat` zwężony do
`'nauka' | 'rozwoj' | 'swiat'`, ikona/etykieta „Z książki" usunięta z `META` w `TriviaCard.tsx`
(dead code inaczej). Wpisy te były w praktyce już same w sobie długie (2-3 zdania), więc nie
dawały się sensownie skrócić do wzorca "krótki teaser + rozwinięcie po tapnięciu" jak reszta
kategorii — user ocenił całą kategorię jako nudną i kazał usunąć, nie tylko skrócić.

**2. Nowe pole `detail: string` — WYMAGANE na każdym wpisie** (nie opcjonalne, żeby żadna
ciekawostka nie brakowała rozwinięcia po dodaniu). `text` zostaje krótkim teaserem bez zmian
w stylu; `detail` to 1-3 zdania rozwinięcia — mechanizm/kontekst/dlaczego tak jest, czasem z
realnym źródłem (`src`, opcjonalne — konkretna instytucja/badacz/eksperyment, NIGDY zmyślone;
część wpisów świadomie go nie ma). Napisany `detail` dla WSZYSTKICH 150 zachowanych wpisów
(58 nauka + 39 rozwój + 47 świat sprzed tej zmiany, minus dwie wcześniej niechcący pominięte
przy pierwszym szkicu tego pliku — `Rów Mariański`/`Jeanne Calment` — odzyskane, sprawdzone
skryptem porównującym stary/nowy plik fragment-po-fragmencie) + dla nowych wpisów.

**3. Dużo nowej treści** — dodano netto: +5 nauka, +3 rozwój, +2 świat wprost, ale głównym
przyrostem jest sam `detail` na każdym z 150 zachowanych faktów (dawniej same suche
jednozdaniowe teasery bez żadnego rozwinięcia). Finalnie **152 wpisy** (63 nauka / 42 rozwój /
47 świat) — mniej niż 213 sprzed usunięcia `ksiazka`, ale każdy z realnym rozwinięciem, część
z cytowalnym źródłem, zero fragmentów-z-książek.

**4. UI (`TriviaCard.tsx`)** — cały tekst (`text`+opcjonalnie `detail`+`src`) owinięty w
`TouchableOpacity` z lokalnym `useState<boolean> expanded` (`useEffect` resetuje go do
`false` przy zmianie `st?.currentKey`, żeby nowy dzień/nowy fakt po "To znam" zawsze startował
zwinięty). Rozwinięty stan pokazuje `detail` (kolor `text.secondary`, mniejszy font niż
teaser) i DOPIERO wtedy `src` (dawniej `src` był widoczny ZAWSZE, teraz przeniósł się pod
rozwinięcie — user chciał "źródło na dole", czyli na dole ROZWINIĘTEGO widoku, nie na dole
zwiniętego teasera). Wiersz `ChevronDown/ChevronUp` + "Czytaj więcej"/"Zwiń" (ten sam wzorzec
co istniejący `bosses.tsx` — pokonani bossowie collapse/expand). Mechanizm "seen/dismissed"
(`dismissed`, `counts`, `REPEAT_GAP_DAYS`, hash `keyOf(text)`) NIETKNIĘTY — usunięcie `ksiazka`
i dodanie nowych wpisów jest dla niego przezroczyste (orphanowane klucze usuniętych faktów są
po prostu nieszkodliwe, nowe wpisy wchodzą do puli normalnie od zera).

`tsc`/`jest` zielone (67 suit/837 testów, zero zmian w testach — trivia.ts nie ma własnych
testów jednostkowych, ten sam brak pokrycia co przed zmianą, dane statyczne). **Priorytet
testu na urządzeniu**: (a) dashboard → karta "Ciekawostka dnia" → tapnij tekst — rozwija się,
pokazuje dłuższy opis i (czasem) źródło na dole, drugi tap zwija; (b) żadna ciekawostka nie
ma już etykiety „Z książki"; (c) "To znam — nie pokazuj" dalej działa identycznie (dismissed
state nietknięty); (d) po pokazaniu nowej ciekawostki karta startuje ZAWSZE zwinięta, nie
zapamiętuje rozwinięcia z poprzedniego dnia.

## 29. Assety Rynku odchudzone (16-bit → 8-bit, dead waga bez zmiany wyglądu) — 2026-09-06

User zobaczył zrzut ekranu Rynku po PR #141 (sklepikarz widoczny, kontrast slotów lepszy —
te fixy zadziałały) i spytał wprost: "poprawiłeś mi tutaj te zdjęcia wszystkie, żeby nie były
takie duże". Odpowiedź: częściowo — `LADAGORA.png`/`LADADOL.png` były już przycięte (§26,
usunięty margines przezroczystości) i miały rozsądny rozmiar, ale `TLOSKLEPIKARZ.png` (tło
sceny) zostało wtedy PRZEOCZONE — zostało w oryginalnym 16-bitowym kodowaniu koloru, którego
PNG w praktyce nigdy realnie nie potrzebuje dla zwykłej ilustracji (8 bitów/kanał daje 16,7
mln kolorów, więcej niż oko rozróżnia).

Naprawa (Pillow, `im.convert('RGBA').save(path, optimize=True)` — ten sam, bezstratny wobec
WYGLĄDU zabieg co poprzednie rundy odchudzania assetów w §11/§13): `TLOSKLEPIKARZ.png`
**1076 KB → 418 KB** (61% mniej, sam 16-bit→8-bit + optymalizacja kompresji PNG, te same
1080×1920 px, zero zmiany w wyglądzie — zweryfikowane wizualnie). `LADAGORA.png`/`LADADOL.png`
dostały tylko drobną domiarkę (`optimize=True`, 53→51 KB i 159→153 KB) — były już w 8-bit.
Łącznie folder `assets/lokalizacje/` dla samego Rynku: ~1,29 MB → ~0,62 MB. `LOKACJA_KAMPANIA.png`
(niepowiązane, osobny ekran walki bossów, już 8-bit) świadomie NIETKNIĘTE — poza zakresem tego
pytania.

Zero zmian w kodzie — czysto binarna podmiana plików assetów, `tsc` zielony (nic do
przetestowania jednostkowo, dane wizualne). **Priorytet testu na urządzeniu**: ekran Sklepu —
tło sceny powinno wyglądać IDENTYCZNIE jak przed tą zmianą (czysty re-encode, nie redesign);
jeśli coś wygląda gorzej/bardziej „spłaszczone", to realna regresja do zgłoszenia (nie
powinno, ale 8-bit banding na bardzo płynnych gradientach teoretycznie mógłby się ujawnić na
niektórych ekranach).

## 30. Ciekawostki: masowy dolew treści (152 → 237 wpisów) — 2026-09-06

User po §28 (usunięcie kategorii "z książki" + rozwijalny opis): "żeby tych ciekawostek było
mnóstwo" + pytanie, czy warto przysłać listę tych, które są nieaktualne/nudne, żebym nie
pisał podobnych — odpowiedź: tak, wpisz konkretne teksty (albo zrzut ekranu) tego, co jest
błędne/przestarzałe/powtarzalne, poprawię i będę pilnował podobnych błędów na przyszłość;
sam mechanizm "To znam" (opisany w §28) już automatycznie wyklucza z rotacji to, co user
oznaczy jako znane — osobna lista jest potrzebna TYLKO dla realnych błędów merytorycznych,
nie dla "już widziałem".

Dodano **85 nowych wpisów** (+30 nauka, +25 rozwój, +30 świat) do `src/data/trivia.ts`,
każdy od razu z `text` (krótki teaser) + `detail` (1-3 zdania rozwinięcia) w tym samym stylu
co reszta pliku — zero wpisów bez rozwinięcia. Zweryfikowane skryptem: **zero duplikatów**
`text` w całym pliku (237/237 unikalnych) i zero nakładania się tematów z istniejącymi 152.
Rozwój (kategoria `rozwoj`) dostał nowe koncepcje z psychologii behawioralnej BEZ przypisania
do konkretnej książki (np. reguła szczytu i końca, węzeł Odyseusza, łączenie pokus, efekt
Ovsiankiny) — świadomie neutralne, żeby nie zbliżyć się z powrotem do usuniętej w §28
kategorii "z książki". Finalnie **237 wpisów** (93 nauka / 67 rozwój / 77 świat).

`tsc`/`jest` zielone (67 suit/837 testów, zero zmian w testach — dane statyczne bez własnego
pokrycia, jak przed zmianą). **Priorytet testu na urządzeniu**: dashboard → "Ciekawostka
dnia" przez kilka dni z rzędu — nowe fakty powinny wchodzić do rotacji naturalnie (mechanizm
`advance()` z §-wcześniejszych sesji nie wymagał zmian), każdy z działającym rozwinięciem.

## 31. Ciekawostki: trzeci dolew (237 → 310 wpisów) — 2026-09-06

User, jednym zdaniem po §30: "dawaj więcej ciekawostek". Dodano kolejne **73 wpisy** do
`src/data/trivia.ts` (+24 nauka, +22 rozwój, +27 świat), ten sam wzorzec co §30: każdy od
razu z `text` + `detail`, część z realnym `src`. Zweryfikowane skryptem: zero duplikatów
`text` w całym pliku (310/310 unikalnych) po raz drugi z rzędu, dobrana tematyka celowo
NIE nakładająca się z 237 wcześniejszymi (m.in. nowe wątki fizyki kwantowej/antymaterii,
dodatkowe zjawiska psychologii behawioralnej bez odwołań do książek — kotwiczenie, domyślne
opcje, technika stopy w drzwiach, efekt aureoli/Pigmaliona/Baader-Meinhof — i nowa geografia/
historia świata). Finalnie **310 wpisów** (117 nauka / 89 rozwój / 104 świat).

`tsc`/`jest` zielone (67 suit/837 testów, bez zmian w testach). **Priorytet testu na
urządzeniu**: jak w §30 — nowe fakty powinny naturalnie wchodzić do rotacji "Ciekawostki
dnia" przez kolejne dni, z działającym rozwinięciem.

## 32. Rynek: grafiki wychodziły poza ekran — piksele zamiast aspectRatio+% w gap-kontenerze — 2026-09-06

User ze zrzutem ekranu: "zobacz jak grafiki wychodzą poza ekran, weź je wyśrodkuj, zmniejsz do
wielkości ekranu, dopasuj względem miejsc slotów (one jak będą takie same w skali to powinny
idealnie nachodzić i tylko kwestia wysokości później)". Realny bug na urządzeniu — tablica/
lada renderowały się SZERSZE niż ekran, wychodząc częściowo poza widoczny obszar.

**Przyczyna** (najbardziej prawdopodobna, kod na pierwszy rzut oka był poprawny): oba
`artPiece` miały `width:'100%'` + `aspectRatio: RYNEK_TOP/BOTTOM_ASPECT` jako DZIECKO
`s.scene`, wrappera który ma `gap: spacing[3]` (dodany w §27 przy okazji fixu scrollowania
sceny). Kombinacja `aspectRatio` na elemencie z procentową szerokością WEWNĄTRZ
gap-kontenera to znany, kruchy przypadek w silnikach layoutu opartych o Yogę — na części
urządzeń/wersji RN potrafi policzyć szerokość PRZED uwzględnieniem `gap`, dając zawyżoną
podstawę, od której `resizeMode="contain"` skaluje obrazek w górę, wychodząc poza realny
ekran. Nie dało się tego złapać czytaniem kodu na PC — potrzebny był realny zrzut z
urządzenia.

**Naprawa**: `s.artPiece` przestał polegać na `aspectRatio`/`width:'100%'` w ogóle — szerokość
i wysokość liczone WPROST w pikselach z `Dimensions.get('window').width - spacing[4]*2` (ten
sam wzorzec jawnej matematyki co `missionBarFillPx` w `app/pet.tsx` — zero zaufania do
CSS-owego aspectRatio w newralgicznym miejscu). `ART_CONTENT_W` liczone raz, na starcie
modułu. Oba `<View style={[s.artPiece, {width, height, alignSelf:'center'}]}>` dostają teraz
DOKŁADNIE tę samą, jawnie wyliczoną szerokość co reszta contentu w `s.scroll`
(`paddingHorizontal: spacing[4]`), więc obraz i sloty (`pctStyle`, procent WZGLĘDEM TEGO
SAMEGO kontenera) automatycznie wracają do idealnej rejestracji — nie trzeba było osobno
poprawiać współrzędnych slotów, one już były poprawne WZGLĘDEM kontenera, tylko sam kontener
miał złą szerokość.

`tsc`/`jest` zielone (67 suit/837 testów, zero zmian w testach — czysto layoutowy fix).
**Priorytet testu na urządzeniu (KRYTYCZNY, to jedyny sposób weryfikacji tej klasy buga)**:
ekran Sklepu — tablica i lada powinny teraz mieścić się CAŁKOWICIE w szerokości ekranu, bez
wystawania poza prawą/lewą krawędź, wyśrodkowane, a sloty (skrzynki/itemy) powinny nachodzić
dokładnie na narysowane okienka na grafice.

**Zgłoszone, ŚWIADOMIE NIE zrobione teraz** (user: "tego sklepikarza ogarniemy zaraz") —
kotek-sklepikarz ma być większy, ma "siedzieć za ladą" (obecnie stoi w luce MIĘDZY tablicą a
ladą, nie fizycznie za kontuarem), i wąsy/czapka wymagają poprawy. Czeka na osobne zlecenie.

## 33. Rynek: odchudzenie z instruktażowych podpisów (Skrzynki/Sklep dnia/Zamrożenie) — 2026-09-06

User: "wtedy wypierdol te napisy wszystkie na razie SKLEP DNIA i co tam pod spodem i wgle
przebuduj żeby było dobrze tak samo zamrożenie". Cel: scena Rynku miała nałożone WPROST na
grafikę zwykłe, jednorazowo-instruktażowe zdania ("Pierwsze okno: skrzynka dnia za darmo...",
"4 konkretne itemy ekwipunku na dziś — gwarantowany zakup, nie loteria.") — potrzebne raz dla
nowego usera, ale zaśmiecające ekran przy każdej kolejnej wizycie i wizualnie kłócące się z
malowaną sceną.

**Usunięte całkowicie**: etykiety sekcji "Skrzynki"/"Sklep dnia" (`s.subSection`) i oba
instruktażowe akapity (`s.blurbTop`) — teraz zniknęły z DOM-u, nie tylko wizualnie ukryte.
Informacja NIE zniknęła bezpowrotnie: opis+szanse skrzynek dalej wyskakują w `ConfirmDialog`
przy próbie zakupu (`odds` w `onBuyBox`, wpięte w §27), a Sklep dnia i tak tłumaczy się sam
przez `GearPreviewModal` po tapnięciu itemu.

**Zostało, ale przeprojektowane**: licznik odświeżenia Sklepu dnia ("Nowy zestaw za...") i
komunikat pustego stanu ("Brak itemów...") to ŻYWA, funkcjonalna informacja (nie instrukcja),
więc zostały — ale jako małe, eleganckie pigułki (`refreshPill`, wzorem `coinPill` z
headera) pływające NAD ladą, zamiast pełnych zdań tekstu pod nagłówkiem. Wzorzec "niewidoczny
pełnoszerokościowy wiersz-pozycjoner (`refreshRow`/`emptyRow`, `alignItems:'center'`) +
przylegająca do treści pigułka w środku" — bo `alignSelf` na elemencie `position:absolute` w
RN bywa niepewny, więc zamiast na to liczyć, wrapper jawnie centruje przez flex.

**Karta "Zamrożenie serii"** dostała ten sam zabieg: podpis "ratuje serię za 1 pominięty
dzień" usunięty (powracający user wie, co robi zamrożenie — sama nazwa + `masz: {freezes}`
wystarczy), plus lekki wizualny lifting — subtelny lodowy `LinearGradient` w tle zamiast
płaskiego koloru, żeby karta nie wyglądała jak generyczny wiersz listy, tylko dopracowany
element sklepu.

`tsc`/`jest` zielone (67 suit/837 testów, zero zmian w testach — czysto wizualne). Zero
martwych stylów po usunięciu (`subSection`/`blurbTop`/`refreshTxt` skasowane, nie zostawione
jako nieużywane). **Priorytet testu na urządzeniu**: ekran Sklepu powinien wyglądać czyściej
— bez tekstowych nagłówków/opisów na scenie, z małą pigułką licznika nad ladą i uproszczoną
kartą zamrożenia; wszystkie interakcje (zakup skrzynki, podgląd itemu, zamrożenie) powinny
działać identycznie jak wcześniej.

## 34. Ciekawostki: czwarty dolew, celowo "lepszej jakości" (310 → 369 wpisów) — 2026-09-06

Kontynuacja kolejki zadań usera z §33 ("potem ja będę testował a ty ogarnij więcej
ciekawostek LEPSZYCH i wgle rozbuduj resztę"). Dodano **59 nowych wpisów** (+21 nauka, +20
rozwój, +18 świat). Nacisk na "lepszych" (nie tylko "więcej") — dobrane tematy z realnie
zaskakującym, rzadziej powtarzanym kątem: fizyka kwantowa/kosmologia (efekt Casimira, Wielki
Wybuch jako rozciąganie przestrzeni a nie eksplozja W przestrzeni, neutrina), konkretne
nazwane zjawiska psychologiczne bez odwołań do książek (dysonans poznawczy, efekt Diderota,
efekt Barnuma, błąd przetrwałych/samolotów z II wojny, hipoteza sprawiedliwego świata),
i nietypowa geopolityka/geografia (Bir Tawil — ziemia niczyja, wojna Australii z emu,
Kiribati we wszystkich 4 półkulach naraz, Liechtenstein podwójnie śródlądowy).

Zweryfikowane skryptem jak poprzednio: zero duplikatów `text` (369/369 unikalnych), zero
znaków cyrylicy (powtarzalny błąd literówki z poprzednich dwóch rund — tym razem czysto od
razu). Finalnie **369 wpisów** (138 nauka / 109 rozwój / 122 świat).

`tsc`/`jest` zielone (67 suit/837 testów, bez zmian w testach). **Priorytet testu na
urządzeniu**: jak w §30-31 — nowe fakty powinny naturalnie wchodzić do rotacji "Ciekawostki
dnia" przez kolejne dni.

## 35. Rynek: czarne pasy po bokach sceny — TLOSKLEPIKARZ.png przycięty do bbox alfa — 2026-09-06

User przysłał zrzut ekranu Sklepu z komentarzem "zobacz nadal [źle], musisz poprawić" — po
naprawie z §32 (grafiki mieściły się już w ekranie, bez wychodzenia poza krawędź), ale scena
wyglądała na "połamaną": grube czarne pasy ciągnące się po OBU stronach całej sceny (tablicy,
kotka-sklepikarza, lady), sprawiające wrażenie że tło w ogóle się nie wczytało.

**Realna przyczyna** (zweryfikowana lokalnie przez zmierzenie bbox kanału alfa i symulację
renderu Pillow — nie zgadywanie): `TLOSKLEPIKARZ.png` (tło `RYNEK_BG`) zostało w §29 tylko
odchudzone z 16-bit na 8-bit, ale NIGDY nie przycięte z transparentnego marginesu jak
`RYNEK_TOP`/`RYNEK_BOTTOM` — miało ~12% przezroczystego marginesu po KAŻDEJ stronie (bbox
alfa: x 126-939 z 1080 szerokości). Założenie z komentarza w `rynekArt.ts` ("`resizeMode=
cover` i tak przytnie brzegi") było błędne w praktyce: `cover` dopasowuje się do WYSOKOŚCI
całej sceny (tablica+kotek+lada, ~1279px), a przy takiej wysokości i pionowym obrazku
1080×1920 `cover` przycinał tylko ~15px z każdej strony — zostawiając ~75px CZYSTEGO
marginesu przezroczystości (czyli czarnego tła apki spod spodu) po OBU stronach na realnym
ekranie. Fałszywy alarm pierwszego wrażenia: to NIE regresja overflow z §32 (który naprawiał
co innego — obrazek wychodzący POZA ekran, nie za wąski margines wewnątrz).

**Naprawa**: `TLOSKLEPIKARZ.png` przycięty do bbox kanału alfa (+8px marginesu, ten sam
skrypt/wzorzec co `RYNEK_TOP`/`RYNEK_BOTTOM` w ich własnym przycinaniu) — 1080×1920 → 829×1881.
Zero zmian w kodzie `pet-shop.tsx` — `resizeMode="cover"` teraz przycina rzeczywistą treść
(odrobinę dachu u góry / podłogi u dołu, bez znaczenia wizualnego) zamiast pustego marginesu,
więc scena wypełnia całą szerokość ekranu bez czarnych pasów. Zweryfikowane symulacją Pillow
całego łańcucha renderowania (dokładna matematyka z `pet-shop.tsx`: `ART_CONTENT_W`, wysokości
per-aspect, `cover`-crop) — PRZED i PO przycięciu, różnica widoczna i jednoznaczna.

`tsc`/`jest` zielone (67 suit/837 testów, czysto binarna zmiana pliku). **Priorytet testu na
urządzeniu (jedyny pewny sposób weryfikacji na realnym ekranie)**: ekran Sklepu — scena
(tablica/luka ze sklepikarzem/lada) powinna wypełniać całą szerokość ekranu bez czarnych
pasów po bokach; sklepikarz (większy, za ladą, poprawione wąsy/czapka) dalej czeka na osobne
zlecenie — NIE ruszony w tym PR-cie.

## 36. Rynek: ręczny "edytor sceny" na urządzeniu — koniec zgadywania współrzędnych na ślepo — 2026-09-06

Po dwóch rundach naprawiania sceny Rynku na ślepo z samych zrzutów ekranu (§32, §35) user
zaproponował inne podejście: "dasz mi opcje żebym zmienił ręcznie położenie/skalę itp, ja to
dostosuję, a potem [...] wrzucę dane, jakiś przycisk eksportuj [...] i tak zakodujesz, nie
będziesz zgadywał". Sensowne — testowanie idzie w jedną stronę (user na telefonie, ja bez
dostępu do urządzenia), więc lepiej dać mu narzędzie do dostrojenia NA ŻYWO niż kolejne rundy
zrzut→zgadywanie→PR→zrzut.

**Nowość w `app/pet-shop.tsx`**: ikona (`SlidersHorizontal`) w headerze Sklepu otwiera modal
"Edytor sceny" z 7 suwakami (+/− steppery, nie drag — prościej i pewniej niż gesty na
telefonie): skala tablicy/lady, przesunięcie X całej sceny, odstęp tablica→kotek, odstęp
kotek→lada, rozmiar sklepikarza, przesunięcie X sklepikarza, oraz **punkt zaczepienia tła w
pionie** (który fragment `TLOSKLEPIKARZ.png` widać — dach czy podłoga; własna matematyka
"cover" z ręcznym `focusY`, bo zwykły `resizeMode="cover"` zawsze centruje i nie da się nim
tego wybrać). Wartości (`ArtAdjust`) persystują w AsyncStorage (`rynek_art_adjust_v1`), więc
dostrajanie przetrwa między sesjami. Przycisk "Eksportuj" pokazuje aktualne wartości jako
zaznaczalny JSON — user kopiuje i wkleja mi w czacie, ja wpisuję je na sztywno jako nowe
wartości domyślne (`DEFAULT_ADJUST`) i mogę usunąć/zostawić sam edytor.

Refaktor przy okazji: `s.scene` stracił wspólny `gap` (niezależne odstępy górny/dolny wymagały
osobnych `marginTop`/`marginBottom` na wrapperze kotka), a tło `RYNEK_BG` przeszło z prostego
`resizeMode="cover"` na ręcznie pozycjonowany `<Image>` (jawne `width`/`height`/`left`/`top`
liczone z `Image.resolveAssetSource` + tym samym wzorem co algorytm "cover", plus `focusY`).

**Osobno**: user poprosił też o plik do samodzielnej edycji wąsów/czapki sklepikarza ("tylko
mi svg plik... ja go edytuję") — wyjaśnione mu, że `CatArt.tsx` to NIE gotowy plik .svg, tylko
programistyczny komponent (react-native-svg, animowany stanem), więc nie ma jednego pliku do
podania wprost. Zamiast tego wyeksportowany STATYCZNY `.svg` (spoczynkowa poza sklepikarza,
te same współrzędne co `CatArt.tsx` viewBox 0 0 2000) do edycji w dowolnym edytorze
wektorowym — po zmianach user odsyła plik albo opisuje co zmienił, a ja przenoszę to na
sztywno do bloku `shopkeeper` w `CatArt.tsx` (linie ~541-561).

`tsc`/`jest` zielone (67 suit/837 testów). **Priorytet testu na urządzeniu**: otwórz ikonę
suwaków w Sklepie, pokręć wartościami — scena powinna zmieniać się na żywo bez przeładowania
ekranu; "Eksportuj" pokazuje poprawny JSON do skopiowania; wartości przetrwają zamknięcie i
ponowne otwarcie ekranu.

## 37. Edytor sceny, draft 2 — jednolite X/Y/skala PER GRAFIKA zamiast pomieszanych pokręteł — 2026-09-06

User zobaczył draft 1 (§36, 7 pól: wspólna skala tablicy+lady, jeden `offsetX` na całą scenę,
`gapTop`/`gapBottom`, rozmiar+X kotka, `bgFocusY` jako ułamek 0-1) i poprosił wprost: "daj mi
to modyfikowane dla każdej grafiki osobno i jasne instrukcje typu położenie XYZ, skalowanie
itp i tyle". Draft 1 mieszał różne jednostki/znaczenia (gap ≠ pozycja, ułamek ≠ piksel, jedna
skala na dwie różne grafiki) — nieintuicyjne. Przebudowane na **jeden jednolity model**: każda
z 4 grafik (Tło / Tablica / Sklepikarz / Lada) dostaje TEN SAM zestaw 3 pokręteł — `x`, `y`
(px, przesunięcie od domyślnej pozycji), `scale` (% — 100% = dzisiejszy domyślny rozmiar).

`ArtAdjust` zmienione z płaskiej struktury na `{ bg, top, cat, bottom }`, każde pole typu
`ImgAdjust = { x, y, scale }`. Dla tablicy/lady/kotka: `scale` zmienia rozmiar (i miejsce
zarezerwowane w layoucie, licząc wysokość sceny), `x`/`y` to czysty `transform` (wizualne
przesunięcie, nie przelicza layoutu — więc np. `cat.y` ujemne "podciąga" kotka bliżej tablicy,
przejmując rolę dawnego `gapTop`/`gapBottom` z draftu 1, ale jako bardziej ogólne narzędzie).
Dla tła: `scale` to mnożnik NAD minimalną skalą wymaganą przez algorytm "cover" (1.0 = dziś,
pełne pokrycie bez przycinania na sztywno; >1 daje margines na przesuwanie kadru), `x`/`y`
przesuwają wykadrowany fragment od wyśrodkowanej pozycji — zastąpiło osobny, mniej intuicyjny
`bgFocusY` (ułamek pionowy) z draftu 1 tym samym modelem co reszta grafik. Klucz AsyncStorage
podbity na `rynek_art_adjust_v2` (draft 1 i 2 mają niekompatybilne kształty — stary zapis po
prostu zostaje zignorowany, żadnej migracji, wartość i tak jeszcze nieużywana produkcyjnie).

Panel edytora pogrupowany nagłówkami per grafika (12 pól razem, 4×3), reszta mechaniki
(persist w AsyncStorage, przycisk Eksportuj z zaznaczalnym JSON-em) bez zmian względem §36.

`tsc`/`jest` zielone (67 suit/837 testów). **Priorytet testu na urządzeniu**: jak w §36 —
zweryfikuj że X/Y/skala per grafika faktycznie przesuwają/skalują TYLKO tę jedną grafikę,
reszta sceny się nie przelicza w dziwny sposób.

## 38. Sklepikarz, draft 4 — user sam dopracował kapelusz+wąsy w zewnętrznym edytorze — 2026-09-06

Zamknięcie wątku z §20/§36: user dostał statyczny `.svg`-eksport sklepikarza (ten sam viewBox
0 0 2000 co `CatArt.tsx`), edytował go sam w zewnętrznym edytorze wektorowym i odesłał gotowy
plik (`assets/Gotowysklepikarz.svg`, zostaje w repo jako referencja/źródło tych współrzędnych).

Zmiany względem draftu 3, przeniesione 1:1 (dokładna transformacja macierzy z pliku rozpisana
na sztywno w kodzie, nie przybliżenie „na oko"):
- **Kapelusz WIĘKSZY** — rondo/korona przeskalowane ~1.67× (rondo 604-1274 vs dawne 760-1160),
  wyśrodkowane tak, żeby środek zostać w tym samym miejscu nad głową. Uszy dalej ładnie
  wystają symetrycznie po obu stronach (geometria uszu nietknięta, `<Ear>` bez zmian).
- **"Gather"-elipsy przy nasadzie uszu USUNIĘTE** — przy szerszym rondzie nie były już
  potrzebne (rondo samo w sobie daje wystarczający kontrast).
- **Cała "handlebar mustache" USUNIĘTA** — user zdecydował, że sam uśmiech (`mouthFor`,
  niezmieniony, wspólny dla wszystkich kotków) wystarczy, bez doklejonych wąsów. Usunięte:
  obie krzywe wąsów, 2 kropki na końcówkach zawijasów, jaśniejsze podkreślenie.
- **Nowy akcent**: mała bliznowata "błyskawica" (`#87714E`) na prawym policzku — jedyny
  zupełnie nowy element, którego nie było w żadnym poprzednim drafcie.

Zweryfikowane wizualnie (nie tylko `tsc`) — statyczna symulacja pełnego kotka z nowymi
współrzędnymi porównana obok-obok z podglądem przysłanego pliku, wygląd identyczny.
`tsc`/`jest` zielone (67 suit/837 testów, czysto wizualna zmiana SVG-geometrii).

**Priorytet testu na urządzeniu**: ekran Sklepu — sklepikarz z większym kapeluszem (uszy dalej
widoczne po bokach), bez wąsów, z małą błyskawicą na policzku. Rozmiar/pozycja SAMEGO
sklepikarza w scenie (czy jest "wystarczająco duży", czy "siedzi za ladą") to osobna sprawa —
edytor sceny z §36-37 (`cat.scale`/`cat.x`/`cat.y`) służy właśnie do tego dostrojenia.

## 39. Dwie realne poprawki po ostrej informacji zwrotnej — edytor draft 3 + uszy 1:1 — 2026-09-06

User, wprost: "zjebałeś?" — dwie osobne, konkretne rzeczy, obie naprawione tego samego dnia:

**1. Edytor sceny (draft 2 → 3, patrz §36-37).** Dwa realne problemy, nie kosmetyka:
   - **"Klikam i nie widzę"** — panel edytora był pełnoekranowym `<Modal>`, więc dosłownie
     ZASŁANIAŁ scenę, którą user miał dostrajać. Naprawa: `editScene` renderuje teraz
     pływający, półprzezroczysty pasek PRZYKLEJONY DO DOŁU ekranu (`s.editorPanel`,
     `position:'absolute', bottom:0, height:'46%'`, chowa `PupilNavbar` na czas edycji) —
     NIE modal. Górna część sceny zostaje odsłonięta i przescrollowywalna pod panelem.
   - **"Steruję slotami i skaluję sloty razem z tą grafiką"** — jeden wspólny `x/y/scale`
     dla tablicy/lady poruszał RAZEM obrazek i siatkę klikalnych okien (slotów), więc nie dało
     się skorygować niedopasowania MIĘDZY nimi (to było źródłem realnej frustracji — user
     próbował naprawić rozjazd obrazek↔sloty, a wspólny transform przesuwał oba na raz,
     zerując różnicę). Naprawa: `ArtAdjust` dostał DWIE niezależne warstwy na tablicę/ladę —
     `top`/`bottom` (obrazek) i `topSlots`/`bottomSlots` (siatka slotów) — każda z własnym
     x/y/scale, renderowane jako dwa osobne `position:'absolute'` layery tej samej wielkości
     nad sobą. Klucz AsyncStorage podbity na `rynek_art_adjust_v3`.

**2. Sklepikarz nie 1:1 (poprawka do §38).** User: "uszy specjalnie ukryłem za czapką, a ty
je znowu wyjąłeś". Błąd w §38: przeniosłem hat+cheek-mark 1:1, ale ZOSTAWIŁEM standardowy,
pełnowymiarowy `<Ear>`-overlay (ten sam co zwykły kotek) zamiast custom, schowanych kształtów
z przysłanego pliku — więc uszy dalej wystawały wyraźnie ponad rondo, dokładnie tak jak user
NIE chciał. Realna przyczyna: plik miał grupę `id="ear-right"` PUSTĄ i `id="ear-left"` z
bespoke bezier-paths (NIE prostym trójkątem jak `<Ear>`) — ale MIMO nazwy "ear-left" ta grupa
zawierała kształty dla OBU stron (dwie pary coat+ear-inner path, jedna przy lewej krawędzi
kapelusza, jedna przy prawej), więc user faktycznie zaprojektował małe, RÓŻNE (nie
symetryczny trójkąt) "prześwity" ucha z każdej strony, w większości schowane pod rondem.
Naprawa: dla `shopkeeper` wyłączony `<Ear>`-overlay CAŁKOWICIE (`{!shopkeeper && <Ear .../>}`),
a 4 nowe `<Path>` (współrzędne z pliku przepuszczone przez skrypt Python odtwarzający dokładną
macierz transformacji, nie ręczne przepisywanie) dorysowane WEWNĄTRZ głównego `<Svg>` sklepikarza
(w tej samej grupie co kapelusz) — chowają się pod rondem zamiast wystawać nad nim.

Zweryfikowane wizualnie oba razy (nie tylko `tsc`) — statyczna symulacja Pillow/cairosvg
porównana obok-obok z przysłanym plikiem PRZED napisaniem kodu, żeby nie powtórzyć tego
samego błędu "wygląda inaczej niż miało". `tsc`/`jest` zielone (67 suit/837 testów).

**Priorytet testu na urządzeniu**: (a) edytor sceny — panel NIE zasłania sceny, widać zmiany
na żywo, `top`/`topSlots` (i analogicznie `bottom`/`bottomSlots`) da się przesuwać NIEZALEŻNIE
od siebie; (b) sklepikarz — uszy NIE wystają ponad rondo kapelusza, tylko mały prześwit z
każdej strony jak w przysłanym pliku.

## 40. Walka: winieta + poświata za sprite'ami — "high-end fight scene" zamiast płaskiej sceny — 2026-09-06

User ze zrzutem areny walki: "postacie są niewidoczne, arena za jasna, wygląda tanio, zrób z
tego high-end fight scene — możemy tę grafikę [`LOKACJA_KAMPANIA.png`] wywalić zupełnie i
zrobię inną, ale żeby to dobrze leżało". Dwie rzeczy, obie NIEZALEŻNE od tego, jaka grafika
areny akurat jest podpięta — zostają nawet po podmianie na nową grafikę usera:

1. **Winieta** — 3-stopniowy pionowy `LinearGradient` (góra/dół sceny przyciemnione ~50%,
   środek tylko ~8%) narysowany NA obrazku areny, PRZED sprite'ami. Dodaje głębię i kontrast
   niezależnie od tego, jak jasne/zgiełkliwe jest samo źródłowe zdjęcie — klasyczny zabieg z
   gier, żeby scena nie czytała się jak płaskie zdjęcie w tle.
2. **Poświata za sprite'ami** (`RadialGlow`, już istniejący komponent z `BossArt.tsx`/
   `StreakFlame.tsx`) — miękka, kolorowa "aura" WIĘKSZA niż sam sprite, wyśrodkowana za nim
   (ten sam wzorzec auto-centrowania co w `BossArt`: `position:'absolute'` dziecko
   `alignItems/justifyContent:'center'` rodzica). Kotek dostaje poświatę w kolorze WŁASNEGO
   futra (`palette.coat`), boss w kolorze swojej "słabości" (`WEAK_COLOR[target.weakness]`,
   już używanym przy etykiecie/motywie — poświata więc nie jest przypadkowa, czyta się jak
   sygnatura elementu). To DODATEK do istniejącego `GroundShadow` (cień pod łapkami), nie
   zamiennik — dwie różne, uzupełniające się poprawki czytelności sylwetki.

Zweryfikowane wizualnie symulacją Pillow (`LOKACJA_KAMPANIA.png` przycięty dokładnie tak jak
robi to `resizeMode="cover"` w realnym boksie sceny, potem ta sama winieta nałożona w
Pythonie) — widoczny, ale niebrutalny wzrost kontrastu/głębi. `tsc`/`jest` zielone.

**Dla usera projektującego nową grafikę areny**: obecny box sceny to ok. **2.5:1** (szeroki,
niski baner — źródłowy `LOKACJA_KAMPANIA.png` to 1200×800 czyli 1.5:1, więc `cover` i tak
mocno przycinał górę/dół). Nowa grafika najlepiej leży w podobnych proporcjach (np. 1600×640)
— `cover` i tak przytnie brzegi jeśli proporcje się nie zgadzają dokładnie, ale bliżej 2.5:1
= mniej przypadkowego kadrowania.

**Priorytet testu na urządzeniu**: ekran Walki — winieta widoczna (góra/dół sceny ciemniejsze
niż środek), kotek i boss mają subtelną kolorową poświatę za sobą, sylwetki czytelniejsze na
tle nawet przy busy/jasnym fragmencie areny.

## 41. Co zjadłem: "bez słodyczy" nie łapało Nutelli — dopisana po nazwie — 2026-09-06

User: "zaznaczam Nutella to nie pokazuje i nie resetuje mi się streak, słabo bo musi
sprawdzać czy to słodycz czy nie, a nawet nie wiem czy jest tak otagowany". Sprawdzone —
miał rację na oba pytania: `BaseFood` (`foodBase.ts`) w ogóle NIE MA pola `cat` (żaden wpis z
wbudowanej bazy nie jest otagowany kategorią), a sama nazwa "Nutella" nie zawiera żadnego
dotychczasowego fragmentu keyworda `sweets` w `countersStore.ts` (to krem orzechowo-kakaowy
pod marką, nie zawiera "czekolad"). `matchesAvoid` sprawdza nazwę + kategorię produktu — oba
zawiodły, więc zjedzenie Nutelli nigdy nie łamało streaka "bez słodyczy".

Naprawa: `nutella` dopisane do listy keywordów `sweets` (ten sam wzorzec co Snickers/Kinder/
Krówki z poprzednich dobitek, §24/wcześniej). Sprawdzone skryptem po całej `foodBase.ts`
(310 produktów) — "nutella" trafia WYŁĄCZNIE w sam produkt "Nutella", zero fałszywych trafień
(w szczególności "Masło orzechowe" nadal NIE jest słodyczem, mimo że oba mają "orzech" —
dlatego generyczne "orzech" NIE zostało dodane jako keyword, tylko konkretna nazwa marki).
Nowy test w `countersStore.test.ts` pokrywa oba przypadki.

`tsc`/`jest` zielone (67 suit/839 testów — 2 nowe). **Priorytet testu na urządzeniu**: Co
zjadłem → zjedz "Nutella" mając aktywny nawyk "bez słodyczy" → streak powinien pęknąć.

## 42. Rynek: skala grafiki przeliczała CAŁĄ scenę + Walka: myląca pigułka energii — 2026-09-07

Dwie osobne poprawki z jednej wiadomości usera.

**1. Edytor sceny, realny bug (nie subiektywne wrażenie)** — user: "jak klikam skala to
skaluje mi cały page Rynku, a miało tylko grafikę każdą osobno". W draft 3 (§37) `scale`
tablicy/lady/kotka ZMIENIAŁ rzeczywisty rozmiar zarezerwowanego boksu (`topW`/`topH`/
`catSize`) — a te wchodzą wprost do `sceneH` (sumy wysokości całej sceny), więc skalowanie
JEDNEJ grafiki przeliczało wysokość CAŁEJ sceny: tło (`RYNEK_BG`, dopasowane przez `cover` do
`sceneH`) przeskalowywało się razem z nią, a pozostałe elementy (lada pod tablicą, kotek
pomiędzy) przesuwały się w pionie. Dokładnie to, przed czym user ostrzegał w §37 ("dla każdej
grafiki osobno") — draft 3 to zrobił dla x/y (czysty `transform`, nie wpływa na layout), ale
NIE dla scale (który wciąż zmieniał realny rozmiar).

Naprawa: `topW`/`topH`/`botW`/`botH`/`catSize` (i `sceneH` z nich liczone) są teraz STAŁE,
całkowicie niezależne od `adjust` — `scale` każdej z tych trzech grafik to teraz WYŁĄCZNIE
`transform: [{scale}]` na warstwie obrazka/kotka, dokładający się do istniejącego
`translateX`/`translateY` w tym samym tablicy transformacji. Zoom jednej grafiki zostaje
czysto wizualny i lokalny — zero wpływu na scenę dookoła. Tło (`bg.scale`) NIE wymagało tej
samej poprawki — jego skala od początku była niezależna od `sceneH` (mnożnik NAD minimalną
skalą `cover`, patrz §37), tylko `top`/`bottom`/`cat` miały ten bug.

**2. Walka: myląca pigułka energii** — user: "energia bossów pokazywała mi 5/2, znaczy że się
przeładowywała jakby". Zbadane: pigułka w headerze POKAZYWAŁA CELOWO format "masz/koszt"
(np. "5/2") gdy koszt ataku > 1 (raid kosztuje 2⚡) — dodane 2026-08-28, żeby tłumaczyć
DLACZEGO "WALCZ!" nic nie robi gdy masz energię, ale za mało na TĘ walkę. Problem: ten format
pokazywał się ZAWSZE gdy koszt > 1, NIE TYLKO gdy energii brakowało — "5/2" z pełną, obfitą
pulą wygląda jak przepełniony/zepsuty ułamek, nie jak informacja. Naprawa: pigułka pokazuje
teraz SAM stan puli (`5`), bez sufiksu kosztu — wyjaśnienie kosztu zostaje WYŁĄCZNIE w
`energyShortTxt` pod przyciskiem WALCZ, który i tak już istniał i pokazuje się TYLKO gdy
energii faktycznie brakuje ("Potrzeba 2⚡, masz 1") — ten sam problem z 2026-08-28 dalej
pokryty, bez fałszywego alarmu przy pełnej puli.

**Zbadane, ale NIE znalezione** — user opisał, że dzięki temu (mylnie odczytanemu jako
"przeładowanie") stoczył 3 walki z rzędu z bossem tygodniowym (raid) i go pokonał. Przejrzana
cała ścieżka `attackRoundBased()`/`raidAttack()`: sprawdzenie `pool < cost` dzieje się
SYNCHRONICZNIE, `fightingRef` (ref, nie state) blokuje ponowne wejście, a cała sekwencja
sprawdzenie→`simulateFight`→`raidAttack()` wykonuje się w JEDNYM wątku JS bez żadnego `await`
pomiędzy — nie znaleziono realnej ścieżki do podwójnego wydania energii. Najbardziej
prawdopodobne wyjaśnienie: `eventEnergy` legalnie kumuluje się przez nieodwiedzane dni (user
miał 5, nie 2), a KAŻDE pojedyncze naciśnięcie WALCZ! symuluje PEŁNĄ, wielorundową walkę
(`simulateFight`, nie jeden cios) — więc 2 realne naciśnięcia (4⚡ z 5) mogły dobić bossa,
którego tygodniowa pula HP była już nadszarpnięta z wcześniejszych dni. To zachowanie zgodne
z projektem, nie bug — ale zapisane tu na wypadek gdyby user przesłał konkretniejszy dowód
(zrzut z ujemną energią, dokładna liczba naciśnięć vs energia) w przyszłości.

`tsc`/`jest` zielone (67 suit/839 testów, czysto UI + layout). **Priorytet testu na
urządzeniu**: (a) edytor sceny — zmiana `scale` JEDNEJ grafiki (tablica/lada/kotek) NIE rusza
pozostałych ani tła; (b) ekran Walki (raid, koszt 2⚡) — pigułka pokazuje samą liczbę energii,
bez mylącego "/2" gdy energii jest dużo, komunikat o brakującej energii dalej pojawia się pod
przyciskiem gdy realnie jej brakuje.

## 43. Rynek edytor — dolny limit skali 60% za wysoki przy sklepikarzu — 2026-09-07

User (od razu po §42): "Dodaj mi opcję, żebym mógł skalować obrazek poniżej 60%, bo aktualnie
nie mogę na tym rynku przy sklepikarzu." Po draft-4 (§42) `scale` każdej grafiki (`top`/
`bottom`/`cat`) jest już CZYSTO wizualny (`transform:[{scale}]`, zero wpływu na `sceneH`/
layout reszty sceny) — więc nie było już żadnego architektonicznego powodu trzymać dolny limit
suwaka na `0.6`. Limit `min: 0.6` w `IMG_FIELDS` (`app/pet-shop.tsx`) był reliktem sprzed
draft-4, kiedy `scale` jeszcze zmieniał realne wymiary `topW`/`botW`/`catSize` i zbyt mały
scale groził spłaszczeniem/zniknięciem boxa. Naprawa: `min: 0.6` → `min: 0.2` (krok suwaka
bez zmian, `step: 0.02`) — pozwala zmniejszyć grafikę sklepikarza (lub tablicy/lady) nawet do
20% bez wpływu na resztę sceny.

## 44. Audyt specjalistyczny: parser paragonów / kategoryzacja — 2026-09-07

User: "okiem specjalisty posprawdzaj po kolei rzeczy typu parser paragonów itp i powiedz czy
można coś ulepszyc / zmienic zoptymalizowac bez utraty funkcji." Przeczytany cały
`src/utils/receiptParser.ts` (1229 linii). Znalezione i naprawione (bez utraty funkcji,
zweryfikowane pełnym `tsc`/`jest`):

**1. Realny bug kategoryzacji — `getFoodTags()` łapało krótkie trzony jako czysty substring
bez ochrony granic słowa.** `categorize()` (używane ZARÓWNO przy parsowaniu paragonów, jak i
przy ręcznym dodawaniu wydatku — `app/expenses/manual.tsx`, `app/expenses/add.tsx`) sprawdza
`getFoodTags()` NAJPIERW, przed właściwą kategoryzacją przez `CATEGORY_KEYWORDS`/`keywordHit`
(która MA ochronę granic słowa z obu stron). `getFoodTags` używało gołego `.includes()` —
zero ochrony. Systematyczny audyt krzyżowy wszystkich 579 keywordów spoza `groceries`
przeciw `FOOD_TAG_MAP` znalazł 29 realnych kolizji: krótkie trzony jedzenia typu `'ser'`
(nabiał), `'por'` (warzywa), `'tost'` (pieczywo), `'rum'`/`'gin'` (napoje), `'karp'` (ryby),
`'lays'` (przekąski) fałszywie łapały się WEWNĄTRZ zupełnie niepowiązanych słów: "Serwis
samochodowy"/"Laser"/"Reserved"/"Bokserki" → nabiał, "Sport"/"Emporio" → warzywa,
"Autostrada" → pieczywo, "PlayStation" → przekąski, "Serum"/"Pyralgina" → napoje. Ponieważ
`categorize()` woła `getFoodTags()` NAJPIERW, każdy z tych przypadków fałszywie lądował jako
`'groceries'` zamiast realnej kategorii — a to dotyczy też RĘCZNIE wpisywanych wydatków, nie
tylko OCR paragonów.

Naprawa: nowa funkcja `foodKeywordHit()` — trzony **≤4 znaki** wymagają teraz granicy z LEWEJ
strony słowa (regex, ta sama klasa znaków `KW_LETTER` co `keywordHit`); trzony **≥5 znaków**
zostają czystym substringiem BEZ ŻADNEJ ochrony, bo część z nich (np. `'ciast'`) celowo musi
łapać obcięte/posklejane przez OCR nazwy bez spacji wcale — patrz istniejący test
`getFoodTags('ŁowiczDesRyżKruCiastŚliw100g')` musi dalej łapać 'ciast' w środku słowa.
Prawa strona pozostaje bez ochrony u WSZYSTKICH długości celowo — krótkie trzony jak `'ser'`
mają łapać polskie końcówki fleksyjne (`serek`/`sery`/`serwatka`, nie tylko samo słowo "ser").

Naprawa usuwa **26 z 29** znalezionych kolizji. **Świadomie NIEnaprawione (udokumentowane, nie
przemilczane)**: trzon na SAMYM POCZĄTKU słowa jest mechanicznie nieodróżnialny od prawdziwego
jedzenia zaczynającego się tak samo — "Ser-wis" vs "Ser-ek", "Tost-er" vs "Tost-y", "Por-tfel"/
"Por-adnia" vs "Por-y", "jedno-razow-y" (bilet) vs "razow-y" (chleb) — naprawienie
wymagałoby ręcznej listy wyjątków per-słowo (realny koszt utrzymania, ryzyko nowych bugów) za
marginalny zysk. Zamiast zgadywać/ukrywać, to ograniczenie ma teraz DEDYKOWANE testy w
`receiptParser.test.ts` ("znany, nienaprawiony przypadek..."), żeby nikt przypadkiem nie
"naprawił" tego inaczej bez zauważenia całego kompromisu.

**2. `categorize()` fallback na sztywno `'groceries'` zamiast `'other'`.** Gdy NIC nie pasowało
(ani `getFoodTags`, ani żadna kategoria), funkcja zwracała `'groceries'` — mimo że `'other'`
("Inne") to REALNA, zdefiniowana, wszędzie indziej w apce używana kategoria właśnie na "nie
wiadomo co". Pętla `for (const cat of order)` miała nawet `if (cat === 'other') continue;`
(no-op, bo `'other'` i tak nigdy nie było w `order`), czyniąc `'other'` strukturalnie
nieosiągalnym z tej funkcji. Naprawa: fallback `'groceries'` → `'other'`. Brak istniejących
testów asercji na fallback (sprawdzone grepem) — bezpieczna zmiana.

**3. Martwy kod + duplikacja z driftem.** `TOTAL_RE` (moduł-level regex) było zdefiniowane, ale
NIGDZIE nie używane (sprawdzone grepem) — usunięte. `parseGeneric()` miało WŁASNĄ, inline
skopiowaną listę wzorców total-detection niemal identyczną z współdzielonym helperem
`detectTotal()`, ale ze SŁABSZYM parsowaniem (`\d+[.,]\d{2}` zamiast tolerującego spacje z OCR
`\d+\s*[.,]\s*\d{2}`, i `parseFloat` zamiast tolerancyjnego `parsePrice`). Naprawa: `parseGeneric`
woła teraz wprost `detectTotal(text)` zamiast duplikować logikę — usuwa drift, ZYSKUJE
tolerancję na luźne spacje z OCR (czysta poprawa, zero regresji, bo `detectTotal` robi
dokładnie to samo + trochę więcej).

Nowe testy w `receiptParser.test.ts` (10 nowych, w tym udokumentowane znane ograniczenia).
`tsc`/`jest` zielone (67 suit/849 testów). **Priorytet testu**: ręczne dodawanie wydatku →
wpisz "Serwis samochodowy" (wciąż źle, znany kompromis) i "Toster"/"Laser"/"Sport"/
"PlayStation"/"Autostrada" (powinny już NIE sugerować "Spożywcze").

## 45. Szablony powiadomień banku — ucz kategorię PRZED pierwszą płatnością — 2026-09-08

Pełny opis (kod, priorytet dopasowania, testy) w §7 wyżej — to wpis w kolejności
chronologicznej. User przesłał realną obcowalutową płatność subskrypcji Claude ("Zapłacono
kwotę 22,14 EUR ... w ANTHROPIC* CLAUDE SUB ... Bank Pekao S.A.") i poprosił o możliwość z
góry nauczenia apki takich nadawców (subskrypcje w walucie obcej, PGE, bilety komunikacji)
w Ustawieniach, żeby pierwsza realna płatność nie lądowała ze zgadniętą złą kategorią.

Nowy `src/store/bankRulesStore.ts` (`BankRule`, zustand+persist) + `matchBankRule()` — wpięte
w `bankIngest.ts` między nauczonym `merchantMemory` (najwyższy priorytet) a sztywnym
`guessCategory()` (fallback). Nowa sekcja Ustawienia → "Auto-wydatki z banku" → "Szablony
powiadomień": wklej przykład → live-preview (`parseBankNotification`) → prefill
fragmentu/nazwy → kategoria z `CATEGORY_META` → zapis, lista z usuwaniem.

Foreign-currency bezpiecznik (ręczne wpisanie kwoty w PLN w `bank-review.tsx`) NIEtknięty —
szablon zmienia tylko kategorię/nazwę/tagi, nigdy kwotę. Saldo (`accountBalance.ts`, offset +
suma z już zaksięgowanych PLN) też nietknięte — poprawna kategoria z góry zmienia tylko
statystyki kategorii, nie mechanikę salda.

`tsc`/`jest` zielone (68 suit/856 testów, +7 nowych w `bankRules.test.ts`). **Priorytet testu
na urządzeniu**: Ustawienia → Auto-wydatki z banku → Szablony powiadomień → wklej dokładnie tę
płatność Claude → kategoria "Subskrypcje", nazwa "Subskrypcja Claude" → Zapisz → Test odczytu
powiadomień (ten sam ekran) → wklej tę samą treść jeszcze raz → powinno wpaść do kolejki z
kategorią Subskrypcje od razu, bez ręcznej korekty.

## 46. Rynek — finalne wartości edytora sceny + 3 poprawki wizualne — 2026-09-08

User przesłał zrzut ekranu ze sklepem i cztery drobne poprawki naraz:

1. **Finalne `DEFAULT_ADJUST`** — user dostroił scenę w edytorze (§42-43) i wkleił
   wyeksportowany JSON na stałe jako nowe wartości domyślne (`app/pet-shop.tsx`):
   `bg{x:0,y:0,scale:1.02}`, `top{x:-116,y:44,scale:0.5}`, `topSlots{x:-4,y:100,scale:1.08}`,
   `cat{x:0,y:104,scale:1.6}`, `bottom{x:-112,y:-144,scale:0.46}`,
   `bottomSlots{x:4,y:-16,scale:1.1}`. Nie zmienia niczego dla użytkownika samego (miał to
   już zapisane w AsyncStorage z wcześniejszego dostrajania) — koduje to jako bazowy stan
   "zerowy" na przyszłość (świeża instalacja, reset edytora).
2. **Pigułka "Nowy zestaw za..." przeniesiona pod ladę** — user: "napis... żeby był pod
   itemami i bardziej w stylu sklepiku samego". Dawniej siedziała WEWNĄTRZ warstwy
   `bottomSlots` (nakładała się na obrazek lady, position:absolute, top:-13). Teraz to zwykły
   element w normalnym przepływie POD `s.artPiece` (lady) — zawsze "pod itemami" niezależnie
   od `adjust`. Restylowana jako drewniana tabliczka szyldu (`shopSignPill`: ciepły brąz
   `#2A1C10E6` + złota ramka `#B8863599`, tekst kremowo-złoty `#E8C88A`) zamiast neutralnej
   ciemnej etykiety — pasuje do reszty sceny sklepu. Stare `refreshRow`/`refreshPill`
   usunięte, `emptyRow` ("brak itemów na Twoim poziomie") zostaje nad ladą (ma sens tylko
   nałożona na pustą siatkę slotów) i też używa nowego stylu tabliczki.
3. **Efekt głębi za sklepikarzem** — user: "ten sklepikarz nie był tak płasko z tym
   obrazkiem". Ten sam duet co sprite'y w `boss-fight.tsx` ("high-end fight scene",
   2026-09-06, §40): `RadialGlow` (miękka poświata w kolorze futra, `SHOPKEEPER_PALETTE.coat`,
   `size=catSize*1.5, opacity=0.2`) ZA kotkiem — odcina sylwetkę od ruchliwego tła sceny —
   plus `GroundShadow` (eliptyczny cień pod łapkami, `width=catSize*0.62, height=catSize*0.18,
   opacity=0.45`) — kotek wygląda jak STOI na ladzie zamiast być wklejony płasko. Oba
   komponenty już istniały (`src/components/ui/RadialGlow.tsx`/`GroundShadow.tsx`), zero
   nowego kodu wizualnego, czysty reużyty wzorzec.
4. **Tło slotów: zostaje na tablicy, znika przy itemach na ladzie** — user: "za obrazkami
   musisz jednak dać tam gdzie miejsce slotów tło pod nie, a pod itemami w sklepiku wywalamy
   tło". Tablica (skrzynka dnia + 3 loot-boxy, generyczne ikony/emoji) ZATRZYMUJE ciemne
   `artSlotBg` pod każdym oknem (kontrast dla prostych ikon na busy tle) — bez zmian, już tam
   był. Lada (Sklep dnia, 4 konkretne itemy ekwipunku z własną, szczegółową ikoną) TRACI
   gradientowy blok rzadkości pod spodem (`LinearGradient` usunięty z `s.artSlotBg` w tym
   miejscu) — item ma wystarczająco szczegółową ikonę, dodatkowy blok tylko zaśmiecał ladę;
   rzadkość dalej czytelna z plakietki ✓ i modala podglądu.

`tsc`/`jest` zielone (68 suit/856 testów, bez zmian w liczbie testów — czysto UI/layout).
**Priorytet testu na urządzeniu**: scena Rynku wygląda jak w edytorze usera od razu po
świeżym uruchomieniu; licznik "Nowy zestaw za..." widoczny POD ladą jako drewniana
tabliczka; sklepikarz ma widoczny cień pod łapkami + delikatną poświatę; itemy na ladzie
BEZ kolorowego bloku pod spodem, skrzynki na tablicy DALEJ z ciemnym tłem.

## 47. Rynek — potki czasowe (HP/ATK/XP) + przebudowa slotów tablica/lada — 2026-09-08

User (screenshot + wiadomość): górne 4 sloty tablicy = Zamrożenie serii + 3 potki (HP/ATK/XP
na 24h, ze wskaźnikiem aktywnej potki na `/pet`); dolne sloty lady rozszerzone z 4 na **8** (2
rzędy po 4) — górny rząd to DZISIEJSZE 4 itemy Sklepu dnia (bez zmian, tylko przeniesione
niżej), dolny rząd to 4 rodzaje skrzynek (darmowa dzienna + drewniana/srebrna/złota — bez
nowego, piątego tieru: "4 pierwsze itemy daily > 4 ostatnie skrzynki"). Przed implementacją
zbadano dokładnie (bez zgadywania), gdzie podpiąć mnożniki w istniejących obliczeniach walki —
raport w skrócie:

**Nowy `src/utils/potions.ts`** — katalog 3 potek (`POTIONS: Record<PotionKind, PotionDef>`),
świadomie umiarkowany balans (do skorygowania po teście): `hp` +20 max HP (flat, jak
`gearFlatHp`), `atk` +15% (ułamkowy dodatek do `bonuses.atk`, stackuje się DOKŁADNIE jak
loot/gear — addytywnie, nie osobny mnożnik), `xp` +25% (mnoży KAŻDE przyznane XP). Wzorzec
timera: `ActivePotion{kind, endsAt}` — ISO timestamp sprawdzany LENIWIE (`isPotionActive`)
wszędzie gdzie efekt jest czytany, ten sam styl co `missionEndsAt`/`energyRegenAt`, żadnego
osobnego tickera czyszczącego stan w tle. **Tylko jedna potka aktywna naraz** — kupienie
nowej PODMIENIA poprzednią (bez zwrotu monet za niewykorzystany czas), user ostrzegany o tym
w ConfirmDialog PRZED zakupem.

**`petStore.ts`**: nowe pole `activePotion` (persystowane) + akcje `buyPotion(kind)`/
`syncPotionExpiry()`. Nowy eksportowany helper `effectiveCatMaxHp(catMaxHpBonus, equippedGear,
ownedGear, activePotion)` KONSOLIDUJE formułę `catMaxHp(bonus) + gearFlatHp(...)`, która była
ZDUPLIKOWANA w 4 miejscach (boss-fight.tsx, pet.tsx, `damageCat`/`resetCatHp` w petStore) —
teraz jedno źródło prawdy, potka HP dodana w jednym miejscu zamiast czterech. XP: `addXp` NIE
było jedynym chokepointem — 14 osobnych akcji (`claimQuest`/`claimDaily`/`defeatBoss`/
`raidClaim`/`menaceClaim`/`careTick`/`petCat` itd.) robiło `xp: s.xp + xp` WPROST w swoim
`set()`. Zamiast refaktoru na wspólną funkcję wywoływaną przez wszystkich, dodano mały
helper `xpWithPotion(s, amount)` i przepisano WSZYSTKIE 14 miejsc (+`addXp`) na
`xp: s.xp + xpWithPotion(s, xp)` — mechaniczna, ale kompletna zmiana w jednym pliku.

**`boss-fight.tsx`/`pet.tsx`**: `bonuses.atk` (useMemo łączący loot+gear) dostał trzeci
addytywny składnik `potionAtkBonus(activePotion)`; `catMax`/`maxHp` liczone teraz przez
`effectiveCatMaxHp(...)` zamiast lokalnej kopii formuły. `pet.tsx` dostał też badge aktywnej
potki (ten sam wzorzec co `moodChip` przy imieniu — kolor tintowany kolorem konkretnej potki,
te same barwy co istniejące etykiety ATK/HP na kartach "Siła bojowa": zielony HP, czerwony
ATK, fioletowy XP) + `syncPotionExpiry()` na mount (sprzątanie kosmetyczne, odczyty i tak są
leniwe).

**`app/pet-shop.tsx`**: przypięta karta "Zamrożenie serii" nad sceną USUNIĘTA (przeniosła się
do slotu 0 tablicy — dwie ścieżki zakupu tej samej rzeczy byłyby zbędne). Tablica: slot 0 =
Zamrożenie (licznik posiadanych w rogu + cena na dole), sloty 1-3 = potki (ikona lucide
placeholder — `HeartPulse`/`Swords`/`Sparkles`, user dostarczy własne grafiki później; aktywna
potka pokazuje odliczanie zamiast ceny). Lada: górny rząd (`RYNEK_BOTTOM_SLOTS[0..3]`) = Sklep
dnia BEZ ZMIAN, dolny rząd (`[4..7]`) = skrzynka dnia + 3 LOOT_BOXES, PRZENIESIONE z tablicy
z niezmienioną logiką (`onDailyBox`/`onBuyBox`).

**`src/utils/rynekArt.ts`**: `RYNEK_BOTTOM_SLOTS` rozszerzone z 4 do 8 wpisów — górny rząd
BEZ ZMIAN (zmierzony realnie skryptem alfa), dolny rząd to EKSTRAPOLACJA (te same kolumny
`left`/`width`, `top` przesunięty o wysokość rzędu + szacowany odstęp) — LADADOL.png fizycznie
ma 8 okien narysowanych (2×4), ale tylko górny rząd był kiedykolwiek zmierzony. **Do
zweryfikowania na urządzeniu** — edytor sceny skaluje/przesuwa CAŁĄ warstwę `bottomSlots`
naraz, nie da się nim poprawić TYLKO dolnego rzędu; jeśli źle trafione, `rynekArt.ts` trzeba
będzie poprawić ręcznie po tym jak user zobaczy realny rezultat.

Testy: `__tests__/potions.test.ts` (17 nowych — funkcje czyste + `buyPotion`/
`syncPotionExpiry` + potwierdzenie że XP faktycznie mnoży się przez `claimQuest`/`addXp`).
`tsc`/`jest` zielone (69 suit/873 testy). **Priorytet testu na urządzeniu**: (a) czy dolny
rząd lady faktycznie trafia w okna LADADOL.png (patrz zastrzeżenie wyżej — realny test
pokaże, czy ekstrapolacja trafiła); (b) kupno każdej z 3 potek → badge na `/pet` pokazuje
poprawny kolor/nazwę/odliczanie; (c) walka z bossem z aktywną potką ATK/HP → widoczna różnica
w "Siła bojowa"; (d) potka XP aktywna → quest/walka faktycznie daje więcej XP niż zwykle.

## 48. Rynek — tło slotów: JEDEN duży prostokąt, nie kwadraciki per slot (korekta §46 pkt 4) — 2026-09-08

User, natychmiast po PR #158: "no to hujowo bo nie tak chciałem... miałeś zrobic wypełnienie
pod slotami czyli pod grafika dać jeden większy prostokąt pod tym co mamy teraz zeby sloty nie
byly przezroczyste". §46 pkt 4 źle zinterpretowany — "tło pod slotami" NIE znaczyło "osobny
mały kwadracik pod każdą ikoną" (`artSlotBg`, wciąż tam zostawiony na tablicy), tylko JEDNO
duże tło za CAŁĄ grafiką tablicy/lady.

Naprawa (`app/pet-shop.tsx`): `artSlotBg` (per-slot, `top/left/right/bottom: 4%` wewnątrz
KAŻDEGO `s.artSlot`) usunięty ZE WSZYSTKICH miejsc gdzie jeszcze był (tablica: Zamrożenie +
3 potki; lada: skrzynka dnia + 3 LOOT_BOXES w dolnym rzędzie — Sklep dnia w górnym rzędzie już
wcześniej nie miał tła, zgodnie z §46 pkt 4 drugą połową). Zamiast tego nowy `s.boardBg` —
JEDEN prostokąt (`top/left/right/bottom: 2%`, `rgba(0,0,0,0.4)`, zaokrąglone rogi) jako
PIERWSZE dziecko `s.artPiece` (czyli pod obrazkiem i slotami w z-order), rozmiaru niemal
całego kontenera tablicy/lady — renderowany RAZ per plansza, nie osiem razy per slot. Stary,
teraz martwy styl `artSlotBg` usunięty z arkusza.

`tsc`/`jest` bez zmian w liczbie testów (69 suit/873, czysto wizualna korekta stylu).

## 49. Rynek — trzy poprawki po realnym teście na urządzeniu (tło/głębia/skrzynie) — 2026-09-08

User przesłał zrzut ekranu ze sklepem PO PR #158 z trzema konkretnymi zastrzeżeniami:

**1. `boardBg` czytał się jako przezroczysty, nie jako "stałe brązowe".** §48 dodało jedno
wspólne tło (dobry kierunek, potwierdzony), ale kolor `rgba(0,0,0,0.4)` — półprzezroczysta
czerń — user: "to tło jest nadal przezroczyste a miało być stałe brązowe, a ikonki mają nie
mieć tła, tylko lekki cień z tyłu". Naprawa: `boardBg` → `#2A1B0EF0` (prawie nieprzezroczysty
ciepły brąz, pasujący do drewna sklepiku). Dodatkowo: każda ikona/emoji slotu (Zamrożenie, 3
potki, 4 skrzynie) dostała miękki cień ZA SOBĄ przez `<RadialGlow color="#000" opacity={0.4}
.../>` — CELOWO nie natywny `shadowColor`/`elevation` (SVG bez tła + `elevation` na
Androidzie liczy cień z PROSTOKĄTA layoutu, nie z kształtu ikony — wyszedłby brzydki
kwadratowy cień), tylko ten sam radial-gradient trik co reszta "głębi" w apce.

**2. Efekt głębi za sklepikarzem wyglądał jak "jakiś prostokąt", nie jak cień.** §46 pkt 3
skopiowało 1:1 duet z `boss-fight.tsx`: `RadialGlow` (poświata) + `GroundShadow` (eliptyczny
cień POD ŁAPKAMI). Problem znaleziony po realnym teście: `GroundShadow` ma sens TYLKO gdy
sprite stoi W CAŁOŚCI widoczny na podłodze (jak boss/kotek w arenie walki) — sklepikarz jest
wycięty W POŁOWIE (widać go tylko od klatki piersiowej w górę, wystającego zza lady), więc nie
ma żadnych łap/podłogi do których cień miałby się odnosić — renderował się mniej więcej na
wysokości lady, czytając się jako losowy ciemny kształt zamiast realnego cienia. Naprawa:
`GroundShadow` CAŁKOWICIE USUNIĘTY z tej sceny (import też, był tam martwy), zostaje
wyłącznie `RadialGlow` (poświata w kolorze futra, opacity podbite 0.2→0.28, size 1.5x→1.6x) —
jedyny z pary, który faktycznie pasuje do kompozycji "wystający zza lady".

**3. Dolny rząd lady miał być 4 PŁATNE skrzynie, nie darmowa skrzynka dnia + 3 skrzynki.**
§47 zostawiło starą darmową "skrzynkę dnia" jako jeden z 4 slotów dolnego rzędu — user: "i
tam zostawiłeś skrzynkę dnia miała być ta nowa, DREWNIANA, ZELAZNA, ZLOTA, BOSKA". Naprawa
dwuwarstwowa:
- `src/utils/petBoxes.ts`: `BoxId` rozszerzone o realny 4. tier — `'sardine' | 'iron' | 'gold'
  | 'divine'` (dawne `'silver'` PRZEMIANOWANE na `'iron'`/"Żelazna skrzynka", te same liczby,
  tylko nazwa/emoji/kolor — sprawdzone grepem, id nigdzie nie jest persystowane w danych
  usera, więc rename jest bezpieczny). Nowy `'divine'`/"Boska skrzynka" (koszt 450, najlepsze
  szanse, `gearRarityWeight` mocno w legendary/mythic) — z UWAGĄ w komentarzu: jej
  `gearChance` świadomie NIE jest najwyższa z czterech, bo `rollBox()` zwraca przy PIERWSZYM
  trafionym progu kaskady (kolor→startup→zamrożenie→EKWIPUNEK→PERKI→monety) — zbyt wysoki
  próg PRZED perkami zjadłby całą przestrzeń [0,1) i uczyniłby `combatItemChance`
  praktycznie nieosiągalną (już się to dzieje z monetami przy gold, świadomie zaakceptowane
  tam, ale przy boskiej user wyraźnie chce realną szansę na perk bossa, nie tylko wyższe
  liczby na papierze). Nowy `BOX_RANK: Record<BoxId, number>` zastąpił trzy twarde
  porównania `box.id === 'gold'`/`'silver'` w `rollBox()` (rzadkość zamrożenia, preferUpgrade,
  perkRarity) — porównania rang zamiast konkretnych id, więc kolejny (5.) tier w przyszłości
  nie wymaga szukania po całym pliku.
- `app/pet-shop.tsx`: darmowa skrzynka dnia (`onDailyBox`/`dailyReady`/`Gift`-ikona) USUNIĘTA
  z dolnego rzędu lady — dolny rząd to teraz DOKŁADNIE `LOOT_BOXES` (4 wpisy). Sama mechanika
  darmowej skrzynki (`claimDailyBox`/`DAILY_BOX`/`dayClaims`) ŻYJE DALEJ niedotknięta — to był
  tylko DRUGI, zduplikowany trigger do tej samej akcji; nadal odbierana z hero-karty na
  `/pet` i pokazywana jako wskaźnik na dashboardzie (`app/(tabs)/index.tsx`), więc żadna
  funkcja nie zniknęła z apki, tylko zbędny duplikat z Rynku.

Nowe testy w `__tests__/petBoxes.test.ts` (4 nowe: dokładnie 4 skrzynie we właściwej
kolejności, rosnący koszt, `divine` PREFERUJE ulepszenie tak jak `gold`, monety w 50%-300%
własnego kosztu). `tsc`/`jest` zielone (69 suit/877 testów).

**Priorytet testu na urządzeniu**: (a) tablica/lada mają wyraźnie brązowe, nieprzezroczyste
tło pod oknami, ikonki mają miękki cień, nie kwadratową ramkę; (b) sklepikarz ma widoczną,
kolistą poświatę za sobą, żaden prostokąt/blok; (c) dolny rząd lady pokazuje 4 emoji skrzyń
(🪵⚙️🥇👑) w cenach 35/90/200/450, bez darmowego prezentu; (d) darmowa skrzynka dnia dalej
działa z `/pet` i pokazuje się na dashboardzie jak wcześniej.

## 50. Trzy niezależne poprawki: trudność bossów, droprate perków, szablony banku — 2026-09-08

Jedna wiadomość, trzy osobne prośby:

**1. Bossy od Hydry Odwodnienia za łatwe** — user: "od bossa Hydra Odwodnienia jest za łatwo,
zwiększ im każdemu minimum 2x HP i 2x dmg dosłownie". `hp` PODWOJONE dla bossów order 11-22
(Hydra Odwodnienia → Iluzja Kontroli, finał kampanii) w `BOSSES` (`src/utils/bosses.ts`),
order 1-10 świadomie nietknięte (user wskazał konkretnie "OD Hydry"). W odróżnieniu od
poprzedniej korekty trudności (2026-08-21, hp×√2/√3, KALIBROWANE żeby uniknąć kwadratowego
narastania trudności — `counterDamage()` liczy obrażenia jako `boss.hp × COUNTER_PCT`, więc
naiwne hp×2 daje ~4x łącznego ryzyka, nie 2x) — user tym razem wyraźnie chciał SUROWE hp×2,
nie skalibrowaną wersję ("dosłownie" + "MINIMUM 2x", czyli więcej też OK). Ponieważ nie ma
osobnego pola "dmg" na bossie, podwojenie `hp` automatycznie realizuje "2x HP i 2x dmg" naraz
(dmg pochodzi z hp). MAD bossy (`madBosses.ts`, `hp: boss.hp × MAD_HP_MULT`) dziedziczą
podwyżkę automatycznie, bez osobnej zmiany. Testy bossów/MAD (`bosses.test.ts`,
`madBosses.test.ts`) przeszły bez zmian (nie hardkodują konkretnych `hp`).

**2. "Nie mogę dropnąć umiejętności"** — zbadane, to NIE był bug. `COMBAT_ITEM_DROP_CHANCE_BY_TIER`
(`src/utils/crates.ts`) miało `basic: 0` (celowo, z 2026-08-18: "zbyt częsta, zabiłaby
rzadkość"), a `basic` to AŻ 60% wszystkich otwarć wg `rollCrate()` (legendary 2%/epic 10%/
rare 28%/basic 60%). Łączna szansa na drop ważona tym rozkładem: `0.60×0 + 0.28×0.03 +
0.10×0.08 + 0.02×0.18 ≈ 2.0%` na otwarcie — przy takiej rzadkości >50% szans na ZERO dropów
nawet po 30 otwarciach, statystycznie zgodne z frustracją usera, nie błąd w kodzie (droga
`openCrate()`/`rollBox()`/`menaceClaim()` w `petStore.ts`/`petBoxes.ts` poprawnie wołają tę
stałą, sprawdzone czytaniem). Naprawa (balans, nie bugfix): `basic` dostało małą, ale
NIEZEROWĄ szansę (0.01), reszta podbita proporcjonalnie (`rare` 0.03→0.05, `epic` 0.08→0.12,
`legendary` 0.18→0.25) — nowa łączna szansa ≈3.7%, prawie 2× więcej. Test w
`__tests__/crates.test.ts` zaktualizowany (`basic=0` → `basic>0`) + nowy test na ŁĄCZNĄ,
ważoną szansę (>3%), żeby przyszła zmiana pojedynczego tieru nie zepsuła całości po cichu.

**3. Szablony powiadomień banku — rozszerzone** — user: "chce miec opcje do słownego
polaczenia tego że subskrypcja oraz np że to jest wyplata i zeby targował automatycznie lub
że za prąd bo tam nie mam takich tagow wgle. I zeby mocy edytowac te szablony". Trzy realne
braki w pierwszej wersji (§7/§45):
- **Brak rodzaju "wypłata"** — szablon mógł oznaczyć TYLKO wydatek (kategorię). Nowy
  `BankRule.kind: 'expense' | 'income'` (`bankRulesStore.ts`). `kind='income'` dopasowywany w
  GAŁĘZI PRZYCHODZĄCEJ `bankIngest.ts` (nie wydatkowej) — ustawia `jd=true` (jak
  `isKnownPaycheckSender`, ale to user'a WŁASNA, natychmiastowa deklaracja, nie coś czego
  apka musi się dopiero nauczyć) I `auto: true` BEZWARUNKOWO (pomija globalny przełącznik
  "dodawaj automatycznie" — user explicite powiedział czym jest ten nadawca, to najwyższy
  możliwy poziom pewności). Starsze zapisane szablony (sprzed `kind`) nie mają tego pola —
  `ruleKind(r)` (eksportowana funkcja) traktuje brak jak `'expense'`, jedyny rodzaj jaki
  wcześniej istniał — bez migracji danych.
- **Brak pola tagów w formularzu** — `BankRule.tags` istniało w store OD POCZĄTKU (PR #157),
  ale Ustawienia NIGDY nie pytały o nie — czysto brakujący input, nie logika (`bankIngest.ts`
  już czytał `rule?.tags` poprawnie). Dodane pole tekstowe "Tagi (po przecinku)" — widoczne
  tylko dla `kind='expense'` (dla wypłaty nic by nie robiły — `bankIngest.ts`'s gałąź
  przychodząca nie czyta tagów, tylko `jd`/`auto`/nazwę).
- **Brak edycji** — tylko dodaj/usuń. Nowy `updateRule(id, patch)` w store + tryb edycji w
  Ustawieniach (tap na wiersz szablonu → wypełnia formularz, przycisk "Zapisz zmiany" zamiast
  "Zapisz szablon", "Anuluj edycję" obok).

Testy: `__tests__/bankRules.test.ts` (+6 nowych — tagi normalizowane, `kind` fallback na
starych danych, `income` → `jd`+`auto` nawet przy `autoAll=false`, `income` nie miesza się z
kategoryzacją wydatków, `updateRule` zmienia pola, `updateRule` przełącza `kind`).

`tsc`/`jest` zielone (69 suit/884 testy). **Priorytet testu na urządzeniu**: (a) walka z
bossem #11+ wyraźnie trudniejsza niż wcześniej; (b) kilkanaście otwarć skrzynek — perk bojowy
powinien wypaść zauważalnie częściej niż wcześniej (statystycznie, nie gwarantowane za 1
próbę); (c) Ustawienia → Szablony powiadomień → dodaj szablon "Wypłata" dla realnego nadawcy
pensji → kolejny przelew od niego powinien wpaść jako [JD] bez zatwierdzania; (d) dodaj tag
"prąd" do szablonu PGE, zobacz czy Finanse → filtr rachunków go łapie; (e) edytuj istniejący
szablon, sprawdź że zmiany się zapisały.

## 51. "Czasami nie łapie powiadomienia" (wypłata) — zbadane, parser działa poprawnie — 2026-09-08

User: "czasami mi nie łapie z powiadomienia np tego ze wypłaty" + realny przykład (tytuł
"Wpływ", treść "Wpłynęło 3752,78 PLN na konto *6332 od MARKETING INVESTMENT GROUP SA. Bank
Pekao S.A."). Zgodnie z REGUŁĄ z §7 ("nie łapie" ≠ bug parsera — najpierw test na dokładnym
stringu) — napisany i uruchomiony realny test na TĘ DOKŁADNĄ parę tytuł/treść: `parseBankNotification`
zwraca poprawny wynik (`amount: 3752.78`, `direction: 'in'`, `store: 'MARKETING INVESTMENT
GROUP SA'`) — **parser NIE jest tu winny**. Sprawdzone też: pakiet Pekao/PeoPay jest już na
liście `BANK_PACKAGES` (natywny nasłuch łapie po samej nazwie pakietu, `looksLikeBankPayment`
to tylko fallback dla NIEznanych pakietów, więc nie blokuje).

Najbardziej prawdopodobne wyjaśnienie (nie zweryfikowane bez dostępu do urządzenia): natywny
`NotificationListenerService` bywa usypiany/odłączany przez system (Android OEM battery
management) i traci pojedyncze powiadomienia zanim `bankNotificationDrain.ts` zdąży je
odczytać — DOKŁADNIE to, co istniejąca diagnostyka w Ustawieniach ("Sprawdź teraz
(diagnostyka)", `peekBankCapture()`) już próbuje wykryć (czy nasłuch w ogóle coś odbiera).
Alternatywnie: powiadomienie MOGŁO trafić do kolejki, ale jako "niepewne" (duży, nieznany
nadawca przychodzący, `amount > 1500` → `uncertain: true` → wymaga ręcznego zatwierdzenia w
"Płatności do zatwierdzenia", nie księguje się samo) — to nie jest "nie złapało", tylko
"czeka na potwierdzenie", łatwe do pomylenia.

Zamiast zgadywać fix bez dowodu, dodany trwały test regresyjny (`__tests__/bankNotification.test.ts`,
dokładnie ten string user'a) — chroni przed przyszłą regresją w tej konkretnej ścieżce
(tytuł "Wpływ" jako osobne pole + wieloczłonowy nadawca-spółka z kropką na końcu, "SA."). Jeśli
user zauważy to znowu, priorytet: sprawdzić diagnostykę w Ustawieniach W MOMENCIE gdy się to
zdarzy (czy nasłuch w ogóle coś widział) ORAZ sprawdzić kolejkę "Płatności do zatwierdzenia"
zanim założymy że to nowy bug parsera.

`tsc`/`jest` zielone (69 suit/885 testów, +1 nowy).

## 52. Finanse: czytelniejsze ikony per typ rachunku + czerwony/zielony wg wydatek/przychód — 2026-09-08

User: "i możemy dodać czytelniejsze ikony ze to jest za internet ze tamto jest wyplata... w
finansach natychmiast kafelkach jak sa ikonki przy nich tam zrobic ikonkę i kolor względem
czy wydatek czy przychod czerwony i zielony". Dwa realne braki znalezione (nie zgadywane —
przeczytany cały `ExpenseItem.tsx` i `recurringBills.ts` przed zmianą):

**1. `BILL_TYPES` (`src/utils/recurringBills.ts`) nie miało ŻADNEGO pola ikony** — tylko
`match`/`name`/`tag`. Każdy rachunek (prąd/internet/czynsz/gaz/woda/ogrzewanie/ubezpieczenie/
telefon) dziedziczył WYŁĄCZNIE ikonę swojej `ExpenseCategory` (prawie zawsze `'housing'` →
`Home`), więc wszystkie wyglądały identycznie. Dodane `icon: string` per wpis (Zap/Wifi/
Flame/Droplet/Thermometer/Shield/Phone/Home), zwracane teraz też z `billTagFor()`.

**2. `ExpenseItem.tsx` (główny wiersz listy transakcji w Finansach) miał TWARDO wpisany
3-drożny switch ikony** (`isIncome ? TrendingUp : isReceipt ? ShoppingCart : TrendingDown`)
— `meta` (z `getCategoryMeta`) było liczone, ale NIGDY nieużywane do ikony/koloru, tylko do
tekstu etykiety. Efekt: KAŻDY wydatek (spożywcze/transport/zdrowie/internet/wszystko) miał
identyczną szarą strzałkę w dół, a KAŻDY przychód (pensja/freelance/prezent/przelew)
identyczną zieloną strzałkę w górę — mimo że `INCOME_CATEGORY_META.salary` już miało własną
ikonę `Briefcase` (wypłata jako pełnoprawna `IncomeCategory`, nie tylko flaga — patrz
`bankIngest.ts`/`bankCommit.ts`, `[JD]` ustawia `category:'salary'` przy commit), po prostu
nigdy niepodłączoną do tego wiersza.

Naprawa: dynamiczne rozwiązywanie ikony jak WSZĘDZIE indziej w apce (`(LucideIcons as
any)[iconName]`, ten sam wzorzec co `app/expenses/[id].tsx`/`add.tsx`/`manual.tsx`/
`subscriptions.tsx`/`stats.tsx`/`settings.tsx`) — `iconName = bill?.icon ?? meta.icon`
(rachunek wygrywa, bo jest bardziej specyficzny niż kategoria). Kolor CAŁEGO wiersza (pasek z
lewej, tło+glif ikony, kwota) to teraz prosta reguła `isIncome ? colors.accent.green :
colors.accent.red` (`#2AC68F`/`#E43434`, TA SAMA para co karta "TEN MIESIĄC" wyżej w tym
samym ekranie i cała reszta apki — nie wymyślone nowe kolory), tło ikony `colors.tint.green/
red` (miękki 12% odcień, już istniejący w `theme/colors.ts` dokładnie do tego). Wcześniej
wydatek nie miał ŻADNEGO koloru (neutralny szary/biały) — tylko przychód był zielony, więc
para nie czytała się symetrycznie; teraz oba mają kolor.

Przy okazji: "Rachunki" filtr w `finances.tsx` (chipy "Prąd"/"Internet"/itd.) dostał te same
ikony (wcześniej same napisy, zero ikon) — `billsInData` przebudowane z ręcznej `Map`
(kolejność "pierwszy napotkany") na filtrowanie `BILL_TYPES` (kolejność priorytetu, zgodnie z
tym co komentarz w kodzie już zresztą TWIERDZIŁ, ale nie robił).

Testy: `__tests__/financePredicates.test.ts` (istniejące 2 zaktualizowane pod nowe pole
`icon`, +1 nowy sprawdzający że wszystkie 8 typów rachunków ma RÓŻNE ikony).

`tsc`/`jest` zielone (69 suit/886 testów). **Priorytet testu na urządzeniu**: Finanse → lista
transakcji → wydatek za internet/prąd/telefon pokazuje właściwą ikonę (nie dom), cała reszta
wydatków ma czerwony akcent, przychody (zwłaszcza wypłata → `Briefcase`) zielony; filtr
"Rachunki" pokazuje ikony przy chipach.

---

## 53. Stale-keyword bug w streaku "bez słodyczy" + dashboard znowu laguje (1Hz tick) — 2026-09-08

User: *"I musisz mi poprawić zeby jak jem cos zeby wiedziało co to czy warzywa czy slodycze
czy co to bo w streak wgle nie łapie ze zjadłem dzisiaj nutelle i nadal mam 20 dni mimo ze juz
ile razy jadłem coś xdd I musimy zoptymalizowac apke bo znowu laguje nie wiem index znowu ma
5k linijek??? 👀😭"* — dwa niezależne zgłoszenia, oba RECYDYWY (Nutella: naprawiona §51-ish
09-06 keyword-fix; lag: po kilku wcześniejszych przejściach memoizacji).

**1. Streak "bez słodyczy" — prawdziwa przyczyna (zbadana agentem, nie zgadywana)**

`matchesAvoid`/`AVOID_PRESETS` (poprawione 09-06 o "nutella") były cały czas poprawne w
IZOLACJI — testy to potwierdzały. Prawdziwy bug: `Counter.keyword` / `Habit.avoidKeyword` to
JEDNORAZOWA KOPIA stringa presetu, wzięta w momencie kliknięcia chipsa w `counters.tsx`/
`habits.tsx` i zapisana na stałe do AsyncStorage. Edycja `AVOID_PRESETS` w kodzie (dodanie
"nutella") NIGDY nie dociera do już istniejącego licznika/nawyku — dopasowanie zawsze czyta
zamrożoną kopię (`autoDaysWithout`→`autoLastEatDate`/`autoLastDate`, `computeAvoidCounts`,
`habit-year.tsx`), nie źródłowy `AVOID_PRESETS`. Każdy tracker założony PRZED jakąkolwiek
zmianą listy słów (09-02 drożdżówka, 09-04 wielki audyt, 09-06 nutella) ma swoją WŁASNĄ, węższą
kopię zamrożoną na zawsze.

Naprawa (`countersStore.ts`): nowe pole `Counter.presetKey?` / `Habit.avoidPresetKey?` —
zapisywane przy wyborze presetu w UI (`counters.tsx`, `habits.tsx`), czyszczone gdy user
ręcznie edytuje keyword (przestaje być "z presetu"). Nowy `resolveAvoidKeyword(keyword,
presetKey)`: jeśli jest `presetKey`, zwraca ŻYWY string z `AVOID_PRESETS` (nie zamrożoną
kopię). **Migracja dla już istniejących trackerów bez `presetKey`** (w tym realnego licznika
usera): jeśli WSZYSTKIE słowa zapisanego keyword są podzbiorem AKTUALNEGO presetu (a lista
tylko rośnie, nigdy nic nie usunięto), traktuje to jako starą kopię tego presetu i też
rozwiązuje na żywo — bez wymagania od usera usunięcia/dodania licznika na nowo. Zabezpieczone
progiem ≥2 słów (pojedyncze słowo nie jest migrowane — mogło być celowo wąskie). Podpięte we
WSZYSTKICH miejscach czytających keyword: `autoDaysWithout` (counters.tsx, counters/[id].tsx),
`computeAvoidCounts` (habits.ts), `habit-year.tsx`'s `matchDays`.

Testy: `__tests__/countersStore.test.ts` (+4, w tym end-to-end regresja dokładnie odtwarzająca
zgłoszenie: stary Counter bez presetKey, dzisiejszy posiłek "Nutella" → `autoDaysWithout`
zwraca 0), `__tests__/habits.test.ts` (istniejące 12 nadal zielone — custom keyword w tych
testach też jest podzbiorem presetu, migracja nie psuje ich założeń).

**2. Dashboard "znowu laguje" — 1Hz timer wymuszający rerender całego 5420-liniowego pliku**

Agent-audyt (nie zgadywanie): `src/hooks/useWorkEarnings.ts` miał `setInterval(() =>
setTick(t=>t+1), 1000)` BEZ ŻADNEGO gate'a na `isWorking` — leciał co sekundę, zawsze, od
momentu zamontowania hooka, bo `tick` jest zależnością finalnego `useMemo` zwracanego z hooka.
`index.tsx:743` wywołuje ten hook wewnątrz `DashboardScreen` → `setTick` wymuszał pełny
rerender CAŁEGO komponentu (5420 linii) RAZ NA SEKUNDĘ, bezwarunkowo — także gdy Dashboard
siedział zamrożony w tle na innej zakładce (`index.tsx`'s własny komentarz o "stays
mounted-but-frozen" to potwierdza) i nawet gdy żadna zmiana ("shift") w ogóle nie trwała.
Osobno: ~1040-liniowy blok budujący `nodes` (rejestr sekcji dashboardu, linie ~2789-3827) nie
ma ŻADNEJ memoizacji — odtwarzany od zera na każdym renderze, więc ten sam 1Hz tick uderzał w
cały ten blok co sekundę.

Naprawa zastosowana (bezpieczna, w pełni zweryfikowana): `useWorkEarnings.ts` dostał
`isWorkingNow` — tani, PODOBNY do już istniejącej logiki `colorMode`/`activeShift`, ale liczony
bez zależności od `tick` — sprawdzający "czy JAKAŚ zmiana/wydarzenie pokrywa TERAZ". Interval
skalowany dynamicznie: 1s gdy faktycznie się pracuje (bez zmian — licznik zarobków nadal żywy
co sekundę, jak było), 60s gdy nie (nadal łapie start zmiany w ciągu maks. minuty, przy ~1.7%
poprzedniego kosztu renderów). Dodatkowo `index.tsx`: `gotPaidThisMonth` (pełny `.some()` po
CAŁEJ historii wydatków, liczony inline przy KAŻDYM renderze sekcji payday-prompt) wyniesiony
do osobnego `useMemo([expenses, workSettings.workPrefix])`.

**Świadomie NIE ruszone w tym przebiegu** (udokumentowane, nie zapomniane — patrz
NEXT_STEPS.md): memoizacja całego ~1040-liniowego `nodes` IIFE i wydzielenie `renderStatTile`/
`renderCustomTile` (~520 linii, `index.tsx:1246-1767`) do osobnego zmemoizowanego komponentu.
Agent-audyt wskazał to jako drugi/trzeci co do wielkości hotspot (custom stat tiles = 8 pełnych
skanów historii wydatków × N kafelków, na każdym renderze), ale ręczne dopisanie POPRAWNEJ
tablicy zależności do bloku tej wielkości bez realnego testu na urządzeniu (nie da się
sensownie zweryfikować w headless CLI) to realne ryzyko cichego "stale closure" — sekcja
przestaje się aktualizować i nikt tego długo nie zauważy. 1Hz-timer był jednoznacznie
NAJWIĘKSZYM, najbezpieczniejszym do naprawienia hotspotem (jedna przyczyna, jeden mechanizm,
łatwa do zweryfikowania `tsc`/`jest`-em) — zrobiony teraz; reszta jako świadomie odłożony
kolejny krok wymagający testu na urządzeniu.

`tsc`/`jest` zielone (69 suit/891 testów). **Priorytet testu na urządzeniu**: (1) Odliczanie →
"Bez słodyczy" → zjedz coś z Nutellą dziś → streak powinien spaść do 0 dni od razu (bez
usuwania/dodawania licznika na nowo); (2) Dashboard → zostaw ekran otwarty na innej zakładce
przez kilka minut bez aktywnej zmiany w pracy → wróć, sprawdź płynność/brak spadku FPS,
zwłaszcza jeśli masz skonfigurowane custom stat tiles.

## 54. Rynek — trzy poprawki po kolejnym realnym teście (sloty/tło/cień) — 2026-09-08

User przesłał zrzut ekranu sklepu po §46-49 z trzema konkretnymi uwagami: *"1. ten najbardziej
dolne 4 sloty podnieś w górę o 4-5 px żeby były w slotach dobrze dopasowane, 2. popraw tła pod
kafelki te brązowe (zobacz grafikę) tam jest ten na górze za wysoko wystaje wgle, i przez to
nie pokrywa nawet kafelków, a poza tym ten na dole tez wystaje przez co zakrywa sklepikarza, 3.
dodaj itemom w sklepie cień mocniejszy ewentualnie słabo ich widac i możesz te brązowe tło
jaśniejsze zrobić dla kontrastu"*.

**1. Dolne 4 sloty (skrzynki, `RYNEK_BOTTOM_SLOTS[4..7]`)** — te współrzędne były jawnie
oznaczone w `rynekArt.ts` jako EKSTRAPOLACJA czekająca na test na urządzeniu (§ komentarz
"real real real coordinates czekają na test"). Podniesione o 1.2% wysokości kontenera (`top`
72.04→70.84), co przy typowej szerokości telefonu odpowiada requested 4-5px. Górny rząd
(Sklep dnia) bez zmian — user wskazał tylko dolny.

**2. `s.boardBg` wystawał poza grafikę tablicy/lady — prawdziwa przyczyna (nie tylko "za
wysoko").** `boardBg` był renderowany jako SIBLING warstwy obrazka (`adjust.top`/`adjust.bottom`
transform), NIE jej dzieckiem — więc kompletnie ignorował skalowanie/przesunięcie obrazka
(`top.scale: 0.5`, `bottom.scale: 0.46` w `DEFAULT_ADJUST`). Efekt: stały prostokąt "2% inset
całego `artPiece`" bez związku z tym, gdzie faktycznie narysowana jest tablica/lada — przy
skali 0.5/0.46 znacznie WIĘKSZY niż widoczna grafika, stąd "wystaje" u góry i zakrywa
sklepikarza u dołu jednocześnie z niedopasowaniem do kafelków. Naprawa: `boardBg` przeniesiony
DO ŚRODKA tej samej transformowanej warstwy co `<Image>` (pierwsze dziecko, przed obrazkiem w
z-order) — dostaje dokładnie ten sam `transform`, więc zawsze pokrywa się z narysowaną tablicą/
ladą niezależnie od dostrojenia w edytorze sceny, raz a porządnie (nie osobna korekta per-
wartość, tylko strukturalna naprawa niepoprawnego zagnieżdżenia).

**3. Cień itemów + jaśniejszy brąz.** `boardBg` kolor `#2A1B0EF0` (niemal czarny) → `#4A3420F0`
(ten sam ciepły odcień, wyraźnie jaśniejszy, dla kontrastu z ikonami). Wszystkie istniejące
`RadialGlow` (zamrożenie/potki/skrzynki) `opacity` 0.4→0.55 (mocniejszy cień, jak proszone).
Odkryta przy okazji realna luka: 4 itemy Sklepu dnia (górny rząd lady, `dailySlots.map`) nie
miały ŻADNEGO `RadialGlow` — jedyne sloty bez cienia w ogóle (świadomie usunięte płaskie tło w
§49, ale cień nigdy nie dodany w zamian) — stąd "słabo widać" dotyczyło ich najbardziej. Dodany
`<RadialGlow size={40} color="#000" opacity={0.55}/>` przed ikoną, tym samym wzorcem co reszta.

`tsc`/`jest` zielone (69 suit/891 testów — czysto wizualna/koordynatowa zmiana, bez pokrycia
testowego). **Priorytet testu na urządzeniu**: Rynek → sprawdź czy 4 skrzynki na dole trafiają
teraz w narysowane okna; czy brązowe tło NIE wystaje ponad tablicę ani nie zasłania
sklepikarza; czy itemy Sklepu dnia (górny rząd lady) mają teraz widoczny cień i są czytelniejsze
na jaśniejszym tle. Jeśli 4-5px okaże się za mało/za dużo — łatwa poprawka `top` w
`RYNEK_BOTTOM_SLOTS[4..7]` (`rynekArt.ts`).

## 55. Dashboard perf, runda 2 — `<StatTile>` wydzielony i zmemoizowany — 2026-09-08

User: *"okej teraz musimy zająć sie optymalizacja.."* — kontynuacja §53 (1Hz-timer w
`useWorkEarnings` już naprawiony w PR #163). Agent-audyt z §53 wskazał drugi/trzeci co do
wielkości hotspot jako świadomie NIEnaprawiony wtedy: custom stat tiles (`renderStatTile`,
~430 linii w `app/(tabs)/index.tsx`) — każdy kafelek robił do 8 pełnych skanów historii
wydatków (`metricSeries`/`metricList`/`metricNumber` → `bucketValue` w `statWidgets.ts`), i to
NA KAŻDYM renderze całego dashboardu, bo `renderStatTile` był plain function odtwarzaną
wewnątrz niezmemoizowanego bloku `nodes`. Im więcej kafelków user skonfigurował, tym drożej.

**Dlaczego NIE zmemoizowano całego bloku `nodes` (~1040 linii) tym razem też** — bez
`eslint-plugin-react-hooks`/`exhaustive-deps` DZIAŁAJĄCEGO w tym repo (sprawdzone: `npx eslint`
nie znajduje w ogóle pliku konfiguracyjnego — osobny, niezwiązany z tą pracą problem) ręczne
wypisanie POPRAWNEJ tablicy zależności `useMemo` do bloku tej wielkości, z dziesiątkami
domknięć nad stanem komponentu, to realne ryzyko cichego "stale closure" bez możliwości
zweryfikowania inaczej niż testem na urządzeniu. Zamiast tego: **ekstrakcja + `React.memo`**
— sprawdzony, już wcześniej używany w tym pliku wzorzec (`SweetsVsFoodSection`,
`SpendByDaySection`, itd. — patrz "Dashboard nav internals"), dużo bezpieczniejszy niż ręczna
tablica zależności, bo React sam porównuje propsy zamiast polegać na ręcznie wypisanej liście.

**Co zrobione:**
1. `fmtStat`/`fmtWave`/`unitChip`/`periodCaption` (czyste funkcje, zero domknięć nad stanem
   komponentu) wyniesione z `index.tsx` do `src/utils/dashboard/format.ts` — obok już tam
   istniejących `metricTagLabel`/`fmtChartPt`. Reużywane teraz zarówno przez nowy `<StatTile>`
   jak i modal szczegółów kafelka (który dawniej miał dostęp do nich przez współdzielone
   domknięcie komponentu — teraz przez zwykły import). +4 nowe testy w
   `__tests__/dashboardFormat.test.ts` (wcześniej ZERO pokrycia — to były prywatne funkcje
   komponentu, mimo używania w KAŻDYM custom stat tile na dashboardzie).
2. `metricIcon`/`STAT_METRIC_ICON`/`STAT_GROUP_ICON` przeniesione do nowego pliku (były już
   module-level, więc czysty przenos + eksport — index.tsx importuje `metricIcon` z powrotem
   dla modala szczegółów).
3. Nowy `src/components/dashboard/StatTile.tsx` — logika `renderStatTile` skopiowana 1:1 (zero
   zmian w zachowaniu), owinięta w `React.memo`. Propsy: `tile`/`statCtx`/`accentColor`/
   `cardBgDark`/`colors`/`s` (współdzielony arkusz stylów, przekazywany jak jest)/
   `updateCustomTile`/`pixelDayCache` — WSZYSTKIE zweryfikowane jako stabilne referencje
   między renderami (przed ekstrakcją, ręcznie, po jednym): `statCtx` ma już realny `useMemo`
   z dependency array w index.tsx, `colors` to jeden z dwóch stałych obiektów modułu
   (`useColors()`), `s` cache'owany per motyw, `updateCustomTile` to stabilna referencja akcji
   zustand, `pixelDayCache` to state odświeżany "raz na dzień" w tle — bez tego `React.memo`
   byłby bezużyteczny (nowa referencja obiektu na każdym renderze = zawsze re-render).
4. `index.tsx`'s `renderCustomTile` (`'stat'` branch) renderuje teraz `<StatTile .../>` zamiast
   wołać starą funkcję — stara `renderStatTile` USUNIĘTA całkowicie (nie zduplikowana).

**Efekt**: renderowanie custom stat tile'a (i jego 8 skanów historii wydatków) odpala się
TERAZ TYLKO gdy realnie zmienił się `tile`/`statCtx`/motyw — nie na każdym renderze dashboardu
(np. otwarcie modala gdzieś indziej na ekranie, toggle nawyku, cokolwiek niezwiązanego).
Największa dźwignia dla userów z kilkoma custom stat tiles skonfigurowanymi.

**Świadomie NIE ruszone**: pozostałe ~35 gałęzi bloku `nodes` (payday/finanse/habits/tasks/
itd.) — pojedynczo dużo tańsze niż stat tiles (proste odczyty/małe filtry na małych tablicach),
więc krańcowa korzyść z pełnej memoizacji reszty bloku jest teraz dużo mniejsza względem
ryzyka. Jeśli lag wróci mimo tej rundy — kolejny krok to albo naprawa `eslint-plugin-
react-hooks` w tym repo (żeby `exhaustive-deps` dało się w ogóle bezpiecznie użyć), albo
wydzielenie kolejnych pojedynczych sekcji `nodes[...]` jako osobnych `React.memo` komponentów,
tym samym sprawdzonym wzorcem co `<StatTile>` tutaj.

`tsc`/`jest` zielone (69 suit/895 testów, +4 nowe w `dashboardFormat.test.ts`). **Priorytet
testu na urządzeniu**: dashboard z kilkoma skonfigurowanymi custom stat tiles (zwłaszcza
`viz==='pixels'`/`'wave'`/`'compare'`) — sprawdź że każdy typ wykresu wygląda identycznie jak
przed zmianą (0 zmian w logice renderowania, czysta ekstrakcja) i że strzałki zmiany roku na
kafelku pixels dalej działają (`updateCustomTile`).

## 56. Duplikat wydatku z powtórzonego powiadomienia banku — postTime dedup — 2026-09-09

User przesłał zrzut ekranu Finansów: ta sama płatność za internet (P4/Play, -60 zł) zalogowana
DWA razy — "wczoraj" i "dziś" — *"nie wiem czemu zdublowało mi wczorajszy wyciąg mimo że go
nie mam już w powiadomieniach jakby na telefonie. Może niech on sobie zapisuje datę kiedy
dostał co żeby jak dostanie to sprawdzi czas powiadomienia"* i drugi raz: *"powinno wykryć że
to to samo przecież nie płacę za internet dwa razy tak samo i jeszcze w jednym miesiącu"*.

**Prawdziwa przyczyna (zbadana, nie zgadywana)**: Androidowy `NotificationListenerService`
(`plugins/withBankNotificationListener.js`) ma DWIE ścieżki dostawy: `onNotificationPosted`
normalnie, ale też `onListenerConnected` — gdy system re-bind'uje usługę (np. po tym jak OEM
battery-saver ją zabił, co na realnych urządzeniach zdarza się regularnie), ten callback
ZAMIATA wszystkie wciąż widoczne powiadomienia w zasobniku. Jeśli bankowa apka nie skasowała
swojego powiadomienia od razu (zostaje widoczne, dopóki user go nie odrzuci lub bank go nie
zastąpi), TEN SAM realny event potrafi zostać dostarczony PONOWNIE dni później — z tym samym
`postTime` (oryginalny czas wysłania), ale w zupełnie innej sesji apki.

Dwie ISTNIEJĄCE warstwy dedupu obie zawodzą w tym dokładnym scenariuszu:
1. Natywny dedup w Kotlinowym `append()` (`SappNotificationListener.kt`) porównuje
   `(time, title, text)` — ale TYLKO w ramach jednego, jeszcze nie wyczyszczonego pliku
   przechwytu. `bankNotificationDrain.ts` czyści ten plik od razu po każdym odczycie, więc ta
   pamięć znika, zanim reconnect-sweep miałby szansę coś w niej znaleźć.
2. `bankQueueStore.enqueue`'s dedup (amount+storeKey w oknie 3 minut) patrzy TYLKO w aktualną
   `pending` — ale do czasu ponownej dostawy oryginalny wpis jest już dawno zaakceptowany i
   USUNIĘTY z kolejki (stał się prawdziwym `Expense`), więc nie ma z czym porównać.

Rezultat: `parseBankNotification`'s `dateISO` domyślnie bierze `localISO()` (czas WŁASNEGO
ingestu, nie czas z treści powiadomienia, gdy notification nie ma go w treści) — druga
dostawa dostaje DZISIEJSZĄ datę, stąd user widzi dokładnie "ten sam wydatek, wczoraj i dziś".

**Naprawa (dokładnie w duchu propozycji usera — "zapisuje datę kiedy dostał")**: `pkg:postTime`
(natywny `n.postTime` już był zbierany i zapisywany przez Kotlin od dawna — `append()` go ma,
tylko `bankNotificationDrain.ts` go dotąd IGNOROWAŁ przy przekazywaniu do `ingestBankNotification`)
jako trwały, MIĘDZYSESYJNY klucz w nowym `bankQueueStore.seenNotifications: string[]`
(ograniczony do 500 wpisów, `wasNotificationSeen`/`markNotificationSeen`). `ingestBankNotification`
sprawdza to PRZED parsowaniem — dokładnie ten sam event nie trafi do kolejki drugi raz,
niezależnie ile dni minęło między dostawami. Zmiana WYŁĄCZNIE JS/TS (`bankQueueStore.ts`,
`bankIngest.ts`, `bankNotificationDrain.ts`) — natywny Kotlin już dawno zbierał `postTime`,
tylko nikt go dotąd nie czytał po stronie JS — więc **żadnego nowego builda APK nie trzeba**,
naprawa wchodzi zwykłą aktualizacją JS (w przeciwieństwie do CLAUDE.md punkt 2 o
uprawnieniach/pluginach, które WYMAGAJĄ nowego APK).

Świadomie NIE dodany drugi heuristic z propozycji usera ("nie płacę za internet dwa razy w
jednym miesiącu") — twardy blok "ten sam sklep+kwota w tym samym miesiącu" miałby realne
ryzyko fałszywych trafień (user MOŻE legalnie zapłacić temu samemu sprzedawcy tę samą kwotę
dwa razy w miesiącu — rata + dopłata, dwa różne prawdziwe zakupy o zbieżnej cenie) i cicho
gubiłby prawdziwe transakcje. Naprawa po `postTime` jest PRECYZYJNA (identyfikuje dokładnie
TEN SAM event powiadomienia, nie zgaduje po treści biznesowej) i w pełni rozwiązuje realnie
opisany scenariusz bez tego ryzyka.

Testy: nowy `__tests__/bankNotificationDedup.test.ts` (5 testów) — odtwarza dokładnie
zgłoszony scenariusz (notifKey raz, wpis usunięty z kolejki jak po akceptacji, ten sam
notifKey drugi raz → odrzucony), plus dwie realnie różne płatności o tej samej treści ale
innym czasie NIE są blokowane, nieparsowalne powiadomienie nie zaśmieca pamięci "widzianych",
i limit rozmiaru `seenNotifications`.

`tsc`/`jest` zielone (70 suit/902 testy, +5 nowych). **Priorytet testu na urządzeniu**: nie da
się tego łatwo wymusić ręcznie (zależy od realnego reconnect Androida) — obserwować, czy
problem się powtórzy; jeśli tak, sprawdzić czy to inny wektor duplikacji niż zdiagnozowany tu.

## 57. Rynek — własne grafiki skrzynek (4 tiery) zamiast emoji — 2026-09-09

User: *"dodałem CI skrzynki grafiki: assets/chests/skrzynka_zlota.png itp, dodaj je do rynku
naszego, zaraz przygotuje te pod POTKI"* — cztery PNG (drewniana/zelazna/zlota/boska,
odpowiadające `LOOT_BOXES` z `petBoxes.ts`) wgrane przez usera bezpośrednio na `master`
(commit "Add files via upload", 1536×1024 każdy, ChatGPT-owy rozmiar, ~1.5-2.4MB/szt).

**Downscale przed użyciem** (ten sam skrypt/parametry co assety ekwipunku, §13/§30) — PIL
LANCZOS do 300×200 (docelowy rozmiar ikon-slotów już ustalony w `assets/ekwipunek/`), RGBA
zachowana: 7.5MB → ~322KB łącznie.

**Podpięcie**: `LootBox.icon?: any` (nowe, opcjonalne pole) + `BOX_ICON: Record<BoxId, any>`
mapujący `sardine/iron/gold/divine` na `require()` odpowiedniego pliku — dodane w
`petBoxes.ts` obok istniejącego `emoji` (zostaje jako fallback, nie usunięty: `BoxRevealModal`
i `DAILY_BOX`, żadne z nich nie było częścią tego zgłoszenia, dalej używają samego emoji).
`app/pet-shop.tsx`'s dolny rząd lady (4 sloty skrzynek) renderuje teraz `<Image
source={box.icon}>` gdy dostępne, z fallbackiem na stary `<Text>{box.emoji}</Text>` — więc
DAILY_BOX (gdyby kiedyś tu wrócił) i przyszłe tiery bez własnej grafiki nadal działają.
Nowy styl `s.boxSlotImg` (68% slotu, `resizeMode="contain"`) — NIE nazwany `boxIcon`, bo ta
nazwa była już zajęta przez inny, niepowiązany styl (chip w podglądzie zakupu, 46×46 z
obwódką) — kolizja złapana od razu przez `tsc` (duplicate object literal property).

Świadomie NIE ruszony `BoxRevealModal`'s duży emoji przy otwieraniu skrzynki (`app/pet-shop.tsx`,
`app/pet.tsx`) — user poprosił konkretnie o Rynek/sloty, nie o cały cykl otwierania; zostaje
jako osobna, przyszła decyzja jeśli user zechce.

`tsc`/`jest` zielone (70 suit/900 testów — czysto wizualna zmiana, bez nowej logiki biznesowej
poza opcjonalnym polem). **Priorytet testu na urządzeniu**: Rynek → dolny rząd lady → 4
skrzynki mają teraz własne grafiki zamiast emoji drewna/zębatki/medalu/korony, czytelne na
nowym, jaśniejszym `boardBg` (§54).

**Zapowiedź od usera**: analogiczne grafiki pod POTKI (górne sloty tablicy — zamrożenie +
HP/ATK/XP) w przygotowaniu, jeszcze nie dostarczone — osobne zadanie gdy nadejdą.

## 58. throttledStorage: `JSON.stringify` przeniesiony do debounce'a (wszystkie 19 store'ów) — 2026-09-09

User: *"dawaj w takim razie ty tu rządzisz działaj (jak będzie źle wrócimy do tego miejsca
najwyżej i tyle xd)"* — zgoda na ruszenie punktu 1 z listy "co byś jeszcze zoptymalizował"
(§55-follow-up): rosnący koszt `JSON.stringify` całego bloba w zustand `persist`.

**Realny zakres (węższy i bezpieczniejszy niż pełny redesign warstwy danych z §15)**:
`throttledAsyncStorage` (2026-08-25) throttlował TYLKO zapis na dysk — `createJSONStorage()`
(helper zustanda, dotąd owijający ten plik) stringifyuje `value` PRZED wywołaniem naszego
`setItem`, więc `JSON.stringify` całego persystowanego stanu (rosnącego z historią —
`expenses`/`meals`/`products` w szczególności, ale też każdy inny store) leciał SYNCHRONICZNIE
na KAŻDYM pojedynczym `set()`, blokując wątek JS w TEJ SAMEJ klatce co akcja usera — throttling
dysku uruchamiał się dopiero PO tym koszcie, nie przed nim. Przy walce bossa (kilka `set()` na
rundę) czy szybkiej edycji paragonu to kilka pełnych stringify zamiast jednego.

**Naprawa**: `throttledStorage.ts` implementuje teraz `PersistStorage<S>` BEZPOŚREDNIO (surowe
`{state, version}` obiekty, nie wcześniej-zstringifikowany tekst) zamiast być owinięty przez
`createJSONStorage` — `JSON.stringify` przeniesiony DO ŚRODKA debounced `setTimeout` (ten sam
mechanizm co dotychczasowy throttling zapisu, 600ms). Efekt: seria szybkich `set()` do tego
samego klucza kosztuje TERAZ jeden `JSON.stringify`, nie jeden na wywołanie — i ten jeden
koszt leci OFF interakcji usera (macrotask 600ms później), nie w tej samej klatce co tap/save.
`getItem` teraz sam parsuje JSON (wcześniej robił to `createJSONStorage`). Wszystkie 19
store'ów (nie tylko expenses/food — zmiana jest jednolita, mechaniczna, bez zmiany semantyki
per store) przełączone z `storage: createJSONStorage(() => throttledAsyncStorage())` na
`storage: throttledPersistStorage()` — stary `throttledAsyncStorage` (string-based) USUNIĘTY
całkowicie (zero pozostałych wywołań po migracji, nie zostawiony jako martwy kod).

**Świadomie NIE ruszone**: koszt REHYDRACJI (parsowanie całego blobu przy zimnym starcie) —
to osobny, dużo rzadszy koszt (raz na uruchomienie apki, nie raz na mutację) niż ten
naprawiony tu. Prawdziwa naprawa TEGO połowy problemu (chunkowanie/paginacja AsyncStorage per
kolekcja, albo SQLite) to dalej ten sam "duży, ryzykowny redesign warstwy danych" z §15 — nie
coś do wciśnięcia przy okazji. Ryzyko tej zmiany oceniam jako niskie: zachowanie identyczne
(te same bajty ostatecznie trafiają na dysk, ten sam debounce), zmienia się WYŁĄCZNIE KIEDY
stringify się odpala — nic co test jednostkowy inny niż "kolejność/czas wewnętrznego
stringify" mógłby wykryć jako regresję, a takiego testu nikt nie miał.

**Uboczna korekta po drodze**: przy scalaniu z PR #166 (duplikat wydatku z banku) okazało się,
że `bankQueueStore.ts` był już lokalnie zmigrowany na `throttledPersistStorage()` ZANIM tamten
PR trafił na CI — CI złapało to od razu (`error TS2305: Module has no exported member`), bo
scommitowany stan brakował definicji tej funkcji. Naprawione osobnym fix-commitem na #166
(przywrócony do starego wzorca na czas tamtego PR), migracja `bankQueueStore.ts` wraca tutaj,
razem z resztą 18 store'ów, w jednym spójnym kroku.

Testy: `__tests__/throttledStorage.test.ts` przepisany pod nowy interfejs (`StorageValue`
zamiast gołych stringów) — te same przypadki co dawniej (koalescencja, niezależne klucze,
`removeItem` anuluje, `flush` wymusza) + nowe (`getItem` na uszkodzonym JSON → `null`, nie
rzuca).

`tsc`/`jest` zielone (70 suit/902 testów). **Priorytet testu na urządzeniu**: walka z bossem
(kilka szybkich zmian HP/coinów pod rząd) i szybka edycja/dodawanie kilku wydatków pod rząd —
nie powinno być zauważalnego zacinania się UI; żadne dane nie giną (to samo okno utraty przy
force-kill co wcześniej, 600ms, zaakceptowane od dawna w §10).

## 59. Ręczny paragon: autouzupełnianie znanych produktów z historii zakupów — 2026-09-09

User: *"jeszcze taki pomysł luźny żeby paragony jak dodaje ręcznie to żeby produkty które już
istnieją jak wpisuje żeby się pokazywały szybciej bo od razu tag cena i wgle wskoczy"*.

**Prawdziwa luka**: `productMemory.ts` ma OD DAWNA trzy magazyny pamięci per produkt —
`ProductMemory` (kategoria), `TagMemory` (tagi), `PriceMemory` (`{n, mean, min, max, last}`
typowej ceny) — ZAPISYWANE po każdym zeskanowanym paragonie (`scan.tsx`'s `saveProductCategories`/
`saveTagMemory`/`savePriceMemory` na zapisie) i CZYTANE tam samo (`applyProductMemory`/
`applyTagMemory`/`priceFor` przy parsowaniu OCR). Ręczny paragon (`app/expenses/manual.tsx`)
nigdy z TEGO SAMEGO magazynu nie korzystał — miał tylko statyczny `categorize(name)` (zgadywanie
po słowach-kluczach, tap-to-apply chip), zero pamięci o KONKRETNYCH, już kupowanych produktach.

**Naprawa — podpięcie istniejącej infrastruktury, nie nowy system**: `ManualReceiptScreen`
ładuje wszystkie trzy magazyny raz przy wejściu na ekran. `ItemRow`'s `handleNameChange`
(już miał debounce 300ms dla `categorize()`) rozszerzony: PO debounce najpierw sprawdza pamięć
(`applyProductMemory`/`applyTagMemory`/`priceFor` z 1-elementową tablicą `[{name}]`) — jeśli
trafienie, automatycznie wypełnia kategorię/tagi/cenę (bez tapnięcia, bo to konkretny,
rozpoznany produkt, mocniejszy sygnał niż zgadywanie po słowach) i pokazuje zielony, WYŁĄCZNIE
informacyjny chip "Rozpoznano: {kategoria} · ostatnio {cena} zł" — statyczny `categorize()`
fallback zostaje bez zmian dla NOWYCH produktów bez historii.

**Nie nadpisuje świadomych wyborów usera**: nowe pola `Item.catTouched`/`tagsTouched`/
`priceTouched` — ustawiane w handlerach `CategoryPicker`/`toggleTag`/custom-tag/cena — jeśli
user już RĘCZNIE dotknął pole, auto-uzupełnienie z pamięci go nie nadpisze nawet gdy nazwa
później dopasuje się do czegoś w magazynie (np. user zmienia kategorię, PÓŹNIEJ dopisuje resztę
nazwy produktu).

**Druga połowa — zamknięcie pętli**: ręczne paragony dotąd w OGÓLE nie uczyły tej pamięci (tylko
zeskanowane) — user musiałby najpierw zeskanować produkt, żeby przyszły ręczny wpis go rozpoznał.
Na `save()` dodane te same trzy wywołania co `scan.tsx` (`saveProductCategories`/`saveTagMemory`/
`savePriceMemory`) na WSZYSTKICH pozycjach paragonu — teraz ręczne wpisywanie też uczy, nie tylko
korzysta z tego czego nauczył skan.

`tsc`/`jest` zielone (70 suit/902 testy — bez nowych testów: ten sam brak jednostkowego
pokrycia UI-ekranów co reszta apki, `productMemory.ts`'s funkcje same w sobie niezmienione,
tylko nowe miejsce ich wywołania). **Priorytet testu na urządzeniu**: Wydatki → dodaj ręcznie
→ wpisz nazwę produktu, który już kiedyś kupiłeś (zeskanowany LUB wcześniej wpisany ręcznie po
tej zmianie) → kategoria/tagi/cena powinny wskoczyć same, z zielonym potwierdzeniem pod nazwą;
zupełnie nowy produkt dalej dostaje starą, statyczną podpowiedź kategorii (tap-to-apply).

## 60. `expo-image` zamiast RN `Image` w Rynku/Pupilu/Walce — cache grafik — 2026-09-09

User: *"dawaj dalej optymalizacje"* + wybór z listy dwóch kandydatów ("wszystko po kolei co
możesz dawaj bez przerwy dziel to na osobne pushe"). Kandydat 1 z dwóch zaproponowanych.

**Problem**: `pet-shop.tsx`, `pet.tsx`, `boss-fight.tsx` — trzy ekrany, które w tej sesji
dostały najwięcej nowej grafiki (skrzynki, gear, bossy) — renderowały ją przez RN-owy core
`Image`, który na Androidzie NIE ma domyślnego cache dysk+pamięć: te same, wielokrotnie
pokazywane PNG-i (ikony itemów w sklepie, portrety w walce, tło Rynku) są dekodowane od nowa
za każdym razem, gdy komponent się mountuje.

**Naprawa**: `expo-image` (`~3.0.11`, dociągnięty przez `npx expo install` pod SDK 54) —
drop-in zamiennik z automatycznym cache dysk+pamięć i dekodowaniem po stronie GPU. Podmienione
WSZYSTKIE renderowane `<Image>`/`<ImageBackground>` w tych trzech plikach (`resizeMode` →
`contentFit`, `"stretch"` → `"fill"` bo `expo-image` inaczej nazywa ten tryb). Jeden wyjątek
świadomie zostawiony na RN-owym `Image`: `pet-shop.tsx`'s `Image.resolveAssetSource(RYNEK_BG)`
(synchroniczny odczyt szerokości/wysokości `require()`'owanego assetu, do przeliczenia skali
tła) — `expo-image` tej statycznej metody nie ma, więc import RN `Image` zostaje pod aliasem
`RNImage` WYŁĄCZNIE do tego jednego wywołania.

**Świadomie NIE dotknięte**: żaden inny ekran w apce nie używał `Image` na tyle intensywnie
(powtarzalne ikony w wielu miejscach), żeby cache dawał realny zysk — reszta zostaje na RN
`Image`, nie ma sensu migrować całą apkę na raz pod jeden, niepewny zysk.

**Ważne — to NIE jest zmiana czysto JS-owa**: `expo-image` to natywny moduł (jak
`android.permissions` w `app.json`, patrz zasada #2 w CLAUDE.md) — efekt zobaczysz DOPIERO po
nowym buildzie APK, nie przez OTA. Do czasu nowego builda apka dalej używa starego, wbudowanego
binarnie kodu i wygląda/działa identycznie (brak cache'u, nie regresja — po prostu nowy kod
jeszcze nieaktywny).

`tsc`/`jest` zielone (70 suit/902 testy — bez nowych testów, żaden test nie renderuje tych
ekranów). **Priorytet testu na urządzeniu (WYMAGA nowego builda APK, nie samego OTA)**: Rynek
(przewijanie sklepu skrzynek/itemów), Pupil (poziomy pupila), Walka z bossem (kilka rund) —
płynniejsze pierwsze wejście na ekran po restarcie apki (mniej "popcornu" przy ładowaniu ikon),
zero wizualnych regresji (proporcje/aspect ratio identyczne jak przed zmianą).

## 61. Pomiar rozmiaru zapisywanych blobów — bezpieczny wariant zamiast ryzykownej partycji — 2026-09-09

User: *"dawaj dalej optymalizacje"* → kandydat #2 z listy ("partycja expensesStore/foodStore").
Po głębszym sprawdzeniu okazało się, że `foodStore` (posiłki/produkty) NIE ma kopii w Firestore
(w przeciwieństwie do `expensesStore` — tylko lokalny AsyncStorage), więc błąd w migracji formatu
zapisu mógłby namieszać w historii jedzenia bez łatwego auto-odzysku z chmury — zaproponowałem
usera wybór, wybrał **bezpieczny wariant**: zmierzyć rzeczywistą skalę, zanim cokolwiek ryzykownego
się przepisze, zamiast zgadywać czy chunking po latach w ogóle jest wart tego ryzyka.

**Co dodane**: `throttledStorage.ts`'s `stringifyTimed()` — owija każdy faktyczny zapis
(debounced timer ORAZ `flushThrottledStorage`) pomiarem bajtów (`JSON.stringify(...).length`)
i czasu tego stringify, trzymanym w pamięci (`Map<key, StorageWriteStat>`, `getStorageWriteStats()`)
— **zero nowego zapisu na dysk**, reset co cold start, zero ryzyka dla persystowanych danych.
Widoczne w Ustawienia → Diagnostyka → "Rozmiar zapisywanych danych" (największy blob + najdłuższy
stringify + licznik zapisów, per store, posortowane malejąco po rozmiarze).

**Decyzja o partycjonowaniu ODŁOŻONA do czasu realnych liczb z tego panelu** — jeśli po dniach
zwykłego użytku żaden store (najbardziej podejrzane: `expenses-store-v1`, `food-store-v1`) nie
zbliża się do rozmiaru, przy którym stringify robi się odczuwalny (dziesiątki ms), chunking per
rok zostaje odłożony jako niepotrzebny — to dokładnie ten pomiar ma o tym zdecydować, nie kolejne
zgadywanie (jak w §35/§58).

`tsc`/`jest` zielone (70 suit/905 testów, +3 nowe dla `getStorageWriteStats`). **Priorytet testu
na urządzeniu**: poużywaj apki chwilę (kilka wydatków, posiłków, walka z bossem), potem
Ustawienia → Diagnostyka → "Rozmiar zapisywanych danych" — sprawdź czy któryś store ma
niepokojący rozmiar/czas; jeśli tak, wróć do tematu partycjonowania z konkretnymi liczbami.

## 62. `usePetStore()` bez selektora — `useShallow` w Pupilu/Rynku/Walce — 2026-09-09

User: *"rob dopóki nie będziesz zadowolony po kolei rozbijają optymalizuj rozbijaj optymalizuj
i w kółko"* — kontynuacja, znaleziona przy przeglądzie zustand-owych subskrypcji pod kątem
klasycznego antywzorca: `const { ... } = useXStore()` (bez selektora) subskrybuje CAŁY store —
komponent re-renderuje się na KAŻDĄ zmianę DOWOLNEGO pola, nie tylko tych faktycznie użytych.

**Skala problemu**: `petStore.ts` (1149 linii) to WSPÓLNY store dla całego systemu pupila —
questy, ekwipunek, customizacja, streaki, walka, misje, skrzynki — dziesiątki pól. `boss-fight.tsx`
(walka — HP/coiny/XP zmieniają się CO RUNDĘ, na ekranie z ciężką animacją kotka/pocisków/portretów),
`pet.tsx` i `pet-shop.tsx` wołały `usePetStore()` bez selektora — KAŻDA zmiana w petStore, nawet
zupełnie niezwiązana z tym co dany ekran wyświetla (np. tick questa gdzieś indziej w tle),
re-renderowała cały, ciężki komponent.

**Naprawa**: `usePetStore(useShallow((s) => ({ pole1: s.pole1, ... })))` — `useShallow` z
`zustand/react/shallow` (zustand v5, już w projekcie). Selektor wymienia WYŁĄCZNIE pola faktycznie
użyte w danym pliku (boss-fight.tsx: 48, pet.tsx: 40, pet-shop.tsx: 16) — re-render triggeruje
się teraz tylko gdy jedna z TYCH konkretnych wartości faktycznie się zmieni (shallow compare),
nie na dowolną mutację gdziekolwiek w store. Akcje (`defeatBoss`, `damageCat` itp.) mają stabilne
referencje w zustand, więc ich obecność w selektorze nie psuje shallow-compare.

**Świadomie NIE dotknięte**: dziesiątki innych `useXStore()` bez selektora w apce (grep: ~30
miejsc) — większość to ekrany renderowane raz (ustawienia, formularze dodawania), gdzie koszt
jest pomijalny; fix skupiony na TRZECH faktycznie hot-path ekranach pupila, nie ślepy sweep
całej bazy kodu.

`tsc`/`jest` zielone (70 suit/905 testów — bez nowych testów: to czysto renderowa optymalizacja,
zero zmiany zachowania/logiki, `tsc` sam w sobie zweryfikował poprawność wszystkich nazw pól
przez typowanie selektora). **Priorytet testu na urządzeniu**: kilka rund walki z bossem pod
rząd (HP/coiny/XP migają szybko) — sprawdź czy mniej "szarpania"/lagów niż wcześniej, oraz że
WSZYSTKO nadal działa identycznie (customizacja kotka, sklep, ekwipunek, misje) — to czysta
optymalizacja re-renderów, zero zmiany w danych/logice.

## 63. Rynek — wypełnienia brązowe i itemy jako WŁASNE, niezależne warstwy w edytorze sceny — 2026-09-09

User: *"w rynku daj mi opcje ustawienia tez indywidualnie tych wypełnień brązowych bo
zjebałeś znowu, i itemow tez możesz"*.

**Prawdziwa przyczyna "zjebałeś znowu"**: `s.boardBg` (brązowe wypełnienie pod tablicą/ladą,
§49) nigdy nie miało WŁASNEGO wpisu w `ArtAdjust` — renderowało się jako dziecko TEGO SAMEGO
transformu co obrazek tablicy/lady (`adjust.top`/`adjust.bottom`). Efekt: dostrojenie obrazka
(żeby pasował do sceny) siłą rzeczy przesuwało/skalowało RAZEM wypełnienie — nie dało się
poprawić jednego bez zepsucia drugiego, więc każda kolejna korekta obrazka od nowa rozjeżdżała
wypełnienie względem okien. Analogicznie ikony itemów Sklepu dnia (`s.artSlotImg`) miały
sztywne 62%/62%, zero regulacji w ogóle.

**Naprawa**: `ArtAdjust` dostał trzy nowe, NIEZALEŻNE grupy — `boardBgTop`, `boardBgBottom`
(wypełnienie tablicy/lady, rozprzęgnięte od `top`/`bottom`) i `items` (ikony 4 itemów Sklepu
dnia, jeden wspólny suwak, nie per-item — user poprosił o regulację "itemów" jako grupy).
JSX: `<View style={s.boardBg}/>` wyszedł z transformu obrazka do WŁASNEGO wrappera z
`adjust.boardBgTop`/`adjust.boardBgBottom`; `item.icon`'s `<Image>` dostał inline `transform`
z `adjust.items`. Domyślne wartości nowych grup = TAKIE SAME jak `top`/`bottom` miały w chwili
tej zmiany (dla wypełnień) / identyczność (`{0,0,1}`) dla itemów — wygląd na urządzeniu
zostaje IDENTYCZNY zaraz po wdrożeniu, tylko od teraz wszystkie trzy warstwy dają się kręcić
NIEZALEŻNIE w edytorze sceny (ikona ⚙️ w headerze Rynku).

**Migracja stanu zapisanego**: `ADJUST_KEY` BEZ ZMIAN (`rynek_art_adjust_v3`) — loader już
robił `{ ...DEFAULT_ADJUST, ...JSON.parse(raw) }`, więc stare, już dostrojone przez usera na
urządzeniu wartości (`bg`/`top`/`topSlots`/`cat`/`bottom`/`bottomSlots`) zostają nietknięte,
a trzy nowe klucze (nieobecne w starym zapisie) po prostu spadają na nowe defaulty — brak
potrzeby bump'owania wersji klucza / czyszczenia dostrojenia usera.

`tsc`/`jest` zielone (70 suit/905 testów — bez nowych testów, to czysto wizualna zmiana
struktury transformów, `stepImgAdjust`/edytor już były generyczne po `keyof ArtAdjust`, zero
nowej logiki do przetestowania). **Priorytet testu na urządzeniu**: Rynek → ikona edytora sceny
→ nowe trzy pozycje ("Tablica — wypełnienie", "Lada — wypełnienie", "Itemy sklepu dnia — ikony")
— sprawdź że dają się kręcić NIEZALEŻNIE od obrazka/slotów bez rozjeżdżania reszty sceny.

## 64. Ustawienia, runda 1 — duplikat id, kolizja nazw "eksport", finanse rozrzucone + rok w kalendarzu

User: *"jest sporo danych i wgle zakładki ale one są chaotyczne... w ustawieniach bym też
uklarował wszystko, eksport danych mamy w kilku miejscach a dobrze by było te ustawienia
dobrze połączyć umiejscowić, gdzie skróty do zakładek tam skróty, gdzie eksport tam eksport"* +
osobno, przy okazji przeglądu "Dane osobowe": *"jak klikam datę urodzenia to mam tylko opcje
przeklikiwania miesięcy a nie mam roku przez co muszę przeklinać milion razy"*.

Duży, wieloczęściowy temat (user: "musimy ogarniać to po kolei") — TA runda to Ustawienia,
Praca (przebudowa "jak w banku", z obsługą zmiany pracodawcy/prefiksu) zostaje jako osobny,
kolejny front, świadomie NIE ruszony tutaj.

**Prawdziwe, sprawdzone w kodzie problemy (nie zgadywanie)**:
1. **Duplikat `id: 'personalizacja'`** — DWIE różne sekcje ustawień (dane osobowe: wiek/płeć/
   poziom treningowy; i faktyczna personalizacja: motyw/dashboard) dzieliły DOKŁADNIE ten sam
   `id`. Realny bug, nie tylko nazewnictwo — duplikat `id` w liście renderowanej z `key={id}`
   psuje reconciliation Reacta, a każde ewentualne `sections.find(id === 'personalizacja')`
   zawsze trafiało w PIERWSZĄ z nich. Naprawa: pierwsza sekcja dostała własny
   `id: 'dane-osobowe'`/`title: 'Dane osobowe'`.
2. **Kolizja nazwy "Eksportuj"** — prawdziwy eksport danych (sekcja "Dane" → `BackupSection`,
   backup/przywracanie/plik) i "Eksportuj postęp pupila" w Diagnostyce (raport balansu bossów
   do wysłania mi na czacie — zupełnie inna rzecz) nazywały się TAK SAMO. Naprawa: zmiana
   nazwy na "Udostępnij raport postępu pupila" — narzędzie ZOSTAJE w Diagnostyce (tam
   pasuje — to debug/balans, nie dane usera), tylko nazwa przestała kolidować.
3. **Finanse rozrzucone** — Saldo/Wypłata były obok siebie, ale Budżet miesięczny/Limity na
   tagi siedziały PO Powiadomieniach, rozbijając logiczny blok finansowy na dwie części.
   Naprawa: kolejność sekcji teraz Saldo → Wypłata → Budżet → Limity na tagi → Powiadomienia —
   cały klaster finansowy razem, Powiadomienia (temat niezwiązany) po nim, nie w środku.
4. **`DatePickerField` bez skoku po latach** (`src/components/ui/DatePickerField.tsx`, 19 miejsc
   użycia w apce) — tylko strzałki miesiąc-po-miesiącu; cofnięcie się o dekady (np. do roku
   urodzenia) wymagało dziesiątek tapnięć. Naprawa: nagłówek miesiąca/roku jest teraz TAPPABLE —
   przełącza na siatkę lat (`CURRENT_YEAR-100`…`CURRENT_YEAR+15`, malejąco), wybór roku wraca
   do siatki dni z tym samym miesiącem. Strzałki miesiąca bez zmian — to DODATEK, nie
   zastąpienie istniejącej nawigacji. Współdzielony komponent — poprawka działa wszędzie
   (Ustawienia, paragony, długi, zadania, pojazdy...), nie tylko w dacie urodzenia.

**Świadomie NIE zrobione w tej rundzie**: żadna WIZUALNA przebudowa layoutu ustawień (karty/
zakładki/nested-grouping) — to był ASK o KOLEJNOŚĆ i NAZEWNICTWO ("gdzie eksport tam eksport"),
nie o nowy system nawigacji; sekcje zostają płaską listą collapsible-paneli jak dotąd, tylko
lepiej poukładaną. Praca (redesign "jak w banku") — osobny, następny front.

`tsc`/`jest` zielone (70 suit/905 testów — bez nowych testów: to reorganizacja istniejących
sekcji + jedna, czysto UI-owa funkcja w współdzielonym komponencie, żadna z tych zmian nie
dotyka logiki wartej jednostkowego pokrycia). **Priorytet testu na urządzeniu**: Ustawienia →
sprawdź nową kolejność (Saldo/Wypłata/Budżet/Tagi razem) i że "Dane osobowe"/"Personalizacja"
to teraz dwie WYRAŹNIE różne sekcje; DatePickerField → dowolne pole daty (np. data urodzenia)
→ tapnij nagłówek miesiąca → siatka lat → wybierz → wraca do dni z wybranym rokiem.

---

## 65. Rynek — finalne ustawienie sceny zablokowane, edytor wyłączony z UI, ciemniejsza lada

User: *"to już jest finalne ustawienie pupilowego rynku dodaj i wywal mi opcje zmiany, ale
zostaw w kodzie na wszelki... zmień na pewno sam kolor wypełnień za ladą na bardziej
pasujący do obrazka i ciemniejszy"* + wkleił finalny eksport z edytora (wszystkie 9 warstw:
`bg`/`top`/`topSlots`/`cat`/`bottom`/`bottomSlots`/`boardBgTop`/`boardBgBottom`/`items`).

**Zmiana**:
- `DEFAULT_ADJUST` w `pet-shop.tsx` zastąpiony 1:1 wklejonym eksportem usera — to nowa,
  finalna geometria sceny Rynku.
- Trigger edytora (ikona `SlidersHorizontal` w headerze, `setEditScene(true)`) USUNIĘTY z
  JSX — `editScene` nigdy nie ustawia się na `true`, więc cały blok edytora (`{editScene &&
  (...)}`, panel z suwakami, `stepImgAdjust`, eksport) jest teraz martwym, ale NIENARUSZONYM
  kodem — dokładnie "zostaw w kodzie na wszelki". Żeby przywrócić: odkomentować
  `TouchableOpacity` w headerze.
- Wypełnienie POD LADĄ (`boardBgBottom`) dostało WŁASNY, ciemniejszy kolor
  (`boardBgBottomFill`, `#2E2114F5` — próbka z najciemniejszych cieni drewna na
  `LADADOL.png`, wcześniej dzielone `#4A3420F0` z tablicą). Tablica (`boardBgTop`) zostaje
  na starym, jaśniejszym kolorze — user poprosił konkretnie o ladę, nie o obie warstwy.

`tsc`/`jest` zielone (70 suit/905 testów — czysto wizualna zmiana, bez nowej logiki).
**Priorytet testu na urządzeniu**: Rynek → sprawdź że scena wygląda zgodnie z finalnym
układem (żadnej ikony edytora w headerze), lada wyraźnie ciemniejsza niż tablica.

---

## 66. Praca, front 1 — fundament "Pracodawcy" (wiele prac, zmiana zatrudnienia, filtr widoczności)

User: *"praca zakładkę bym od nowa zbudował... żeby dało się zmienić prefiks w razie czego i
działał jak zmienię pracę"* + *"żebym mógł sprawdzić i wyłączyć stare żeby one były ale
widzieć np tylko z nowej pracy jak będę chciał"*. Duży, wieloczęściowy front (user: "musimy
ogarniać to po kolei") — dopytałem trzema pytaniami: gdzie ma żyć nowy ekran (osobny ekran
spod dashboardu/ustawień, NIE nowa zakładka w pasku), jak obsłużyć zmianę pracy (lista
pracodawców z historią + możliwość schowania starych z łącznych statystyk bez kasowania),
i co ma pokazywać główny widget (średnia zarobków + stawka zł/h, historia miesięcy klikalna →
szczegóły z mini-kalendarzem dni roboczych). **TA runda to WYŁĄCZNIE fundament danych** — nowy
ekran "Praca" (widgety, historia, mini-kalendarz) to ŚWIADOMIE OSOBNY, kolejny front.

**Problem**: `WorkSettings` (types/index.ts) zakładał JEDNĄ, globalną pracę na zawsze — jeden
`workPrefix`/`monthlySalary`/`hoursPerMonth`. Zmiana pracodawcy nadpisywała te pola bezpowrotnie
— stare miesiące dalej liczyłyby się poprawnie w historii (paragony/eventy mają swój `date`),
ale NIE dało się już pokazać "ile zarabiałem w starej pracy" osobno, ani wyłączyć starej pracy
z łącznej średniej bez utraty danych.

**Naprawa — nowy typ `Employer`** (types/index.ts): pełna lista prac w historii, KAŻDA ze
SWOIM prefiksem/stawką i własnymi nadpisaniami (mirror pól `WorkSettings` istotnych per-praca).
Jedna jest "aktywna" — `workService.setActiveEmployer(id)` zwierciadli JEJ dane do globalnego
`WorkSettings`, więc WSZYSTKIE istniejące miejsca czytające `workSettings.workPrefix` (dashboard,
auto-wydatki z banku, osiągnięcia, eksport analizy — **19 plików, ZERO zmian w nich**) automatycznie
zaczynają liczyć nową pracę. To właśnie rozwiązuje "działał jak zmienię pracę".

**Filtr widoczności** (nie usuwanie): `Employer.hidden` — `workService.toggleEmployerHidden(id)`
wyłącza pracodawcę z ŁĄCZNYCH statystyk (nowy `employerPayMonthsSummary`), dane zostają w 100%
nietknięte, można odkryć z powrotem w każdej chwili. Usuwanie pracodawcy z danymi świadomie
NIE zaimplementowane — zbyt ryzykowne dla realnych zarobków bez wyraźnego asku.

**Migracja**: `workService.getEmployers()` — pierwsze wywołanie bez zapisanej listy migruje
jednorazowo, idempotentnie z istniejącego `WorkSettings` (jeśli user go w ogóle skonfigurował;
pusty prefiks + domyślne wartości = nic do migrowania). Migracja NIE kasuje/zmienia
`WorkSettings` — zostaje jako zwierciadło aktywnej pracy.

**Generalizacja obliczeń** (`workSummary.ts`): `computePayMonthsForEmployers` woła ISTNIEJĄCĄ
`computePayMonths` per pracodawca (bez zmian w jej wnętrzu — `Employer` ma te same nazwy pól co
`WorkSettings` dla prefiksu/nadpisań, więc przechodzi strukturalnie) i łączy w jedną, otagowaną
(`employerId`/`employerName`/`employerHidden`) listę, posortowaną malejąco po miesiącu.
`employerPayMonthsSummary` domyślnie liczy tylko widocznych pracodawców, `includeHidden: true`
pokazuje wszystko na żądanie.

**Ustawienia → Praca**: nowa sekcja "Pracodawcy" NAD istniejącymi polami (prefiks/tryb/godziny/
wypłata) — lista z odznaką "AKTYWNA", przełącznik widoczności (oko), dodawanie nowego (od razu
aktywuje). Istniejące pola ZOSTAJĄ bez zmian wizualnych — edytują `WorkSettings` jak dawniej,
tylko KAŻDY z 4 handlerów zapisu dogrywa teraz tę samą zmianę do aktywnego pracodawcy
(`syncActiveEmployerFromSettings`), żeby lista się nie rozjechała z tym co faktycznie w użyciu.

`tsc`/`jest` zielone (70 suit/907 testów, +2 nowe dla `computePayMonthsForEmployers`/
`employerPayMonthsSummary`, weryfikujące multi-pracodawcę i filtr `hidden`). **Priorytet testu
na urządzeniu**: Ustawienia → Praca → dodaj drugiego pracodawcę z innym prefiksem, sprawdź że
staje się aktywny i pola prefiksu/stawki się zmieniają, że dashboard/auto-wydatki z banku
zaczynają liczyć NOWY prefiks, i że schowanie starego pracodawcy (oko) nie kasuje jego danych.

---

## 67. Praca, front 2 — ekran "Historia pracy" (miesiąc-po-miesiącu + mini-kalendarz)

User (dopytany wcześniej o §66): *"historia ostatnich miesięcy z wypłatami i średnia gdzie
mogę kliknąć na każdy miesiąc sprawdzić szczegóły i czy dobrze złapało dni jak pracowałem
taki mini kalendarz pokazujący jak pracowałem i ile zarobiłem"* — główny widget: "wydaje mi
się że średnia zarobków, a tak to reszta to godziny per zarobek".

**Nowy ekran** `app/work/history.tsx` — osobny (user: "osobny ekran spod dashboardu/ustawień",
NIE nowa zakładka w pasku), dostępny z dwóch miejsc: Ustawienia → Praca (nowy link "Historia
pracy", obok listy pracodawców z §66) i z panelu "Praca" na dashboardzie (`workPanel` modal w
`(tabs)/index.tsx` — nowy link "Zobacz pełną historię i mini-kalendarz →" na dole, ZAMYKA
panel i nawiguje, żeby nie zostawić dwóch nałożonych warstw modal/ekran).

**Czysto widok, zero nowej logiki liczenia** — buduje na fundamencie §66:
- Hero: średnia zarobków/miesiąc (główny widget, jak user poprosił) + średnia stawka zł/h +
  suma łączna, liczone TYLKO z widocznych (nie `hidden`) pracodawców.
- Filtr chipsów pracodawców (tylko gdy user ma więcej niż jednego — u jednego pracodawcy
  chipsy byłyby martwym UI) + przełącznik "pokaż schowanych" (patrz §66 `hidden`).
- Lista miesięcy (`computePayMonthsForEmployers`, malejąco) — kwota, godziny, stawka, nazwa
  pracodawcy (gdy >1). Tap → modal szczegółów.
- **Modal szczegółów miesiąca** — nowa `shiftsForEmployerInMonth` (workSummary.ts, generalizacja
  identycznego `shiftsIn` z Ustawień → Praca, tylko sparametryzowana po `Employer` zamiast
  globalnego `WorkSettings`) + `MiniCalendar` (lokalny komponent w tym samym pliku) — siatka
  dni miesiąca, dni z dopasowaną zmianą podświetlone i podpisane liczbą godzin. To wprost
  odpowiada na "czy dobrze złapało dni jak pracowałem" — user widzi na oko, bez przeklikiwania
  każdego eventu z osobna. Pod spodem lista pojedynczych zmian (tytuł/godziny), tap → edycja w
  `/calendar/[id]` (istniejąca funkcja, bez zmian).

`tsc`/`jest` zielone (70 suit/909 testów, +2 nowe dla `shiftsForEmployerInMonth`).
**Priorytet testu na urządzeniu**: Ustawienia → Praca → "Historia pracy" ORAZ dashboard →
panel "Praca" → link na dole — oba wejścia działają; kliknij miesiąc → mini-kalendarz
pokazuje faktycznie przepracowane dni zgodnie z kalendarzem; z wieloma pracodawcami (dodaj
drugiego w §66) sprawdź filtr chipsów i "pokaż schowanych".

---

## 68. Runda code-review PR #163–#177 — dwa realne bugi znalezione i naprawione

User: *"pozniej posprawdzaj błędy możesz rundę wszystko co się da"* — poproszony przegląd
całej pracy z tej sesji (dashboard perf, bank dedup, Rynek, throttledStorage, expo-image,
useShallow, Ustawienia, DatePickerField, fundament Pracodawców + Historia pracy). Dwa realne,
potwierdzone (nie zgadywane — odtworzone w kodzie) bugi:

**1. `app/expenses/manual.tsx` — niedotknięta domyślna kategoria zanieczyszczała pamięć
produktów.** `save()` wołał `saveProductCategories(receiptItems, catPatch, {})` — pusty
`parsed` oznaczał, że KAŻDA kategoria (nawet niedotknięta, wciąż na domyślnym `'groceries'`
z `makeItem()`) była traktowana jako "świadomie inna od rozpoznanej" (`cat !== parsedCat`,
`parsed[idx]` zawsze `undefined`) i zapisywana do WSPÓLNEJO magazynu (czytanego też przez
`scan.tsx`). Efekt: wpisanie nazwy nowego produktu i zapisanie paragonu BEZ dotknięcia
kategorii uczyło pamięć błędnego `'groceries'` na stałe — kolejne wystąpienia tej nazwy (skan
LUB kolejny ręczny wpis) dostawały fałszywą auto-podpowiedź. Naprawa: nowa równoległa tablica
`catTouchedFlags[]` (śledzi `Item.catTouched` przez grupowanie/dzielenie cen wspólnych, gdzie
`receiptItems[i]` nie odpowiada 1:1 `items[i]`) — `parsedCat[i] = it.category` dla KAŻDEJ
NIEDOTKNIĘTEJ pozycji (czyli "parsed == cat", zapis pomijany), zapisuje się tylko to, co user
faktycznie wybrał albo co przyszło z rozpoznania po nazwie (a to już I TAK jest w pamięci,
zapis no-opem).

**2. `workService.ts`/`settings.tsx` — wyścig przy pierwszej migracji pracodawców.**
`loadEmployers()` wołał `Promise.all([getEmployers(), getActiveEmployerId()])`. Na urządzeniu
bez zapisanej listy `getEmployers()` migruje WEWNĄTRZ siebie z legacy `WorkSettings`
(getItem→miss→getSettings→saveEmployers→setItem ACTIVE_EMPLOYER_KEY — kilka awaitowanych
kroków), podczas gdy `getActiveEmployerId()` to POJEDYNCZY `getItem`, który w równoległym
wyścigu kończył się ZANIM migracja zdążyła zapisać klucz aktywnego pracodawcy. Efekt: świeżo
zmigrowany (jedyny) pracodawca renderował się BEZ odznaki "AKTYWNA" i pozwalał tapnąć
"aktywuj" coś, co już było aktywne — do czasu ponownego otwarcia ekranu (drugie wywołanie
czyta już zapisany klucz). Naprawa: sekwencyjne `await` zamiast `Promise.all` — `getEmployers()`
(z ewentualną migracją) kończy się PRZED odczytem aktywnego id.

`tsc`/`jest` zielone (70 suit/909 testów — bez nowych testów: oba bugi żyją w UI-ekranach
bez istniejącego pokrycia komponentowego, ten sam brak co reszta apki; podstawowa logika
`saveProductCategories`/`workService` sama w sobie niezmieniona, tylko poprawione dane
wejściowe od wywołujących). **Priorytet testu na urządzeniu**: (1) dodaj ręcznie produkt o
NOWEJ nazwie, NIE dotykaj kategorii, zapisz paragon → wpisz tę samą nazwę ponownie (ręcznie
lub przez skan) → NIE powinna wskoczyć fałszywa kategoria; (2) świeża instalacja/wyczyszczone
dane Pracy → Ustawienia → Praca → sprawdź że jedyny (zmigrowany) pracodawca ma odznakę
"AKTYWNA" od razu, bez konieczności ponownego wejścia na ekran.

---

## 69. Check-in humoru — tagi sortowane też po energii, nie tylko nastroju

User: *"przyjrzyj się wpisywaniu humoru dokładnie żeby te tagi ulepszyć na bazie tego też ile
mam energii lub połączenia że jestem szczęśliwy ale nie wyspany"*.

**Prawdziwa luka**: `MoodEntry` ma OD DAWNA dwa niezależne pola — `mood` i `energy` — oba
zbierane w `MoodCheckInModal` (`MoodPicker` dla każdego z osobna). Ale sortowanie podpowiedzi
tagów (`sortedPresetTags`) patrzyło WYŁĄCZNIE na `mood` (pozytywne/negatywne wg sentymentu) —
`energy` był zbierany i zapisywany, ale nigdy nie wpływał na to, JAKIE tagi user widzi na
górze listy. Efekt: przy "szczęśliwy ale niewyspany" (dobry `mood`, niska `energy`) tag
"zmęczony" — mimo że trafnie opisujący stan — lądował na końcu, bo sortowanie "dobry nastrój
→ pozytywne na górę" traktowało go jako czysto negatywny sentyment, ignorując że user ma
akurat dobry nastrój i tylko niską energię.

**Naprawa** — nowy `src/utils/moodTags.ts` (wydzielony z `MoodCheckInModal.tsx`, żeby dało
się jednostkowo przetestować): druga, NIEZALEŻNA oś trafności (`HIGH_ENERGY_TAGS`/
`LOW_ENERGY_TAGS`), łączona ADDYTYWNIE z istniejącą osią nastroju (`tagRelevance = moodScore
× moodSignal + energyScore × energySignal`). Tag pasujący do KTÓREJKOLWIEK z dwóch aktualnych
sygnałów dostaje wysoką trafność — więc "szczęśliwy ale niewyspany" wypycha na górę OBA typy
tagów naraz (`szczęśliwy` z osi nastroju, `zmęczony`/`niewyspany` z osi energii), zamiast
zagrzebywać energetyczne pod nastrojowymi.

**`zmęczony` świadomie WYLECIAŁ z `NEGATIVE_TAGS`** (był tam wcześniej) — to przede wszystkim
stan ENERGII, nie nastroju (można być zmęczonym i całkiem zadowolonym); zostawienie go w obu
zbiorach ZEROWAŁOBY jego trafność dokładnie w tej kombinacji (-1 nastrój × +1 sygnał dobrego
nastroju = -1, +1 energia (bo w LOW_ENERGY) × -1 sygnał niskiej energii = +1, suma = 0) —
dokładnie ten bug, który user zgłosił.

**Nowy tag `niewyspany`** dodany do `PRESET_TAGS` — user nazwał go wprost jako przykład, a
brak snu to inny, konkretniejszy stan niż ogólne "zmęczony" (może być z wysiłku, nie tylko
niewyspania).

`tsc`/`jest` zielone (71 suit/918 testów, +9 nowych dla `sortMoodTags`/`tagRelevance` w
`__tests__/moodTags.test.ts` — w tym test dokładnie odtwarzający przykład usera). Świadomie
NIE ruszony ekran statystyk (`app/(tabs)/mood.tsx`) — ask dotyczył WPISYWANIA (check-in), nie
analizy historycznej; korelacje typu "częściej zmęczony mimo dobrego nastroju" to osobny,
większy temat (widget/insight), nie coś do wciśnięcia przy okazji sortowania tagów.

**Priorytet testu na urządzeniu**: Check-in humoru → wybierz Nastrój=Świetnie, Energia=Wyczerpany
→ sprawdź że zarówno "szczęśliwy"/"radosny" JAK I "zmęczony"/"niewyspany" siedzą blisko góry
listy tagów, nie tylko nastrojowe.

---

## 70. Usuń widget snu z dashboardu + rozbuduj "Na co idą pieniądze" (odchylenia/atrybucja) + skarbonki w Pracy

User (dwuczęściowy ask): *"I potrzebuje wywalić z dashboardu śr.sen ten co ma tydzień/miesiąc
bo tam nie ma danych tylko dni tyg. bez sensu mam to w zakladce zdrowie, natomiast potrzebuje
rozbudowanego widgetu który. Edzie pokazywał dane miesięcy porównania wydatków stałych
(odchylen) jedzenia, i zmiennych pokazujacych np co przeważyło np zakup wiatraka (z
odniesieniem) I tez w pracy dodac zeby byl widget jak zarabiam na ten moment ile w miesiącu to
zeby pokazywalo na stałych wydatkach i na sr jedzenia ile muszę uzbierać i pokazuje sie takie
paski wypełniając sie moze jakby takie skarbonki ile na mieszkanie+prad+internet, a ile na
jedzenie a ile sr na zmienne wydaje"*.

### 70a. Usunięcie `sleep-chart`

Sprawdzone PRZED ruszeniem kodu: `sleepAvg` (custom stat-tile z `statWidgets.ts`) to NIE ten
widget — to była ślepa uliczka we wstępnej hipotezie. Prawdziwy winowajca: `nodes['sleep-chart']`
/ `SleepChartCard.tsx` — SEKCJA DOMYŚLNA (żywa, w `DEFAULT_DASHBOARD_SECTIONS`), z dokładnie
opisanym przez usera przełącznikiem Tydzień/Miesiąc. Usunięta CAŁKOWICIE:
- `'sleep-chart'` wyleciał z `DEFAULT_DASHBOARD_SECTIONS` + `SECTION_TITLES`/`SECTION_DESC`/
  `SECTION_GROUP` w `dashboardLayout.ts`.
- `nodes['sleep-chart']`, `sleepDays30`/`sleepDaysShown`/`sleepMaxMin`/`sleepNights`/
  `sleepAvgMin` (lokalne, nigdzie indziej nieużywane — zweryfikowane grepem) i stan
  `sleepDashRange` USUNIĘTE z `app/(tabs)/index.tsx`.
- `src/components/dashboard/SleepChartCard.tsx` USUNIĘTY (był używany WYŁĄCZNIE tu).

Stare, już zapisane layouty userów (`useDashboardLayout.order`) NIE wymagają migracji ręcznej —
`effectiveOrder()` w `dashboardLayout.ts` filtruje `order` po `known(id)` (`DEFAULTS.includes(id)
|| customIds.has(id)`), więc zniknięty z `DEFAULT_DASHBOARD_SECTIONS` id po prostu wypada przy
najbliższym odczycie, bez żadnego dodatkowego kodu migracyjnego.

### 70b. "Na co idą pieniądze" — odchylenia stałych + atrybucja zmiennych

Widget ("Na co idą pieniądze", `FixedVariableSection.tsx`) już ISTNIAŁ w dojrzałej formie
(miesiąc bieżący, top-4 stałe, trend 4 mies. + średnia) — user chciał go ROZBUDOWAĆ, nie
zbudować od zera. Dwie nowe czyste funkcje w `src/utils/fixedVariable.ts`:

- `fixedDeviations(expenses, month, lookback=3)` — porównuje nazwane rachunki stałe tego
  miesiąca (to samo grupowanie co `fixedBreakdown`) z ich WŁASNĄ historyczną średnią z
  poprzednich miesięcy. Próg ≥15% ORAZ ≥20 zł (odcina szum typu zużyciowy prąd), rachunek bez
  ŻADNEJ historii pomijany (nie fałszywy 100%-owy skok). Zwraca posortowane malejąco po
  `|deltaPct|`.
- `topVariableContributors(expenses, month, n=2)` — największe pojedyncze zakupy zmienne
  (bez stałych/jedzenia) tego miesiąca, zgrupowane po nazwie/sklepie jak `fixedBreakdown` (żeby
  powtórzone zakupy w tym samym miejscu się sumowały). To jest "co przeważyło np zakup wiatraka".

W `FixedVariableSection.tsx`: nowy blok "odchylenia" (do 3, ikona trend + kolor: pomarańcz =
wyżej niż zwykle, zielony = niżej) pod itemizacją stałych; nowa linia "Zmienne wyżej niż zwykle
(śr. X zł) — głównie: Y zł" POD warunkiem że bieżące zmienne > 1.15× średniej ORAZ jest co
pokazać (`fvTopVariable.length > 0`) — inaczej cisza (żaden fałszywy alarm gdy nic nie
przeważyło). Nowe propy (`fvDeviations`, `fvTopVariable`) liczone w `index.tsx` obok istniejącego
`fvMonths`/`fvFixedItems`, zero nowego fetchowania danych (te same `expenses`).

### 70c. "Skarbonki" w Pracy — zarobek do teraz vs potrzeby

Nowa czysta funkcja `workBudgetProgress(earnings, fvMonths)` w `fixedVariable.ts` — rozdziela
podany zarobek PO KOLEI (waterfall, priorytet: stałe → jedzenie → zmienne) na 3 "skarbonki",
każda wypełniana do swojego celu (śr. z poprzednich nie-zerowych miesięcy `fvMonths`, bez
historii cel = ten miesiąc) zanim nadwyżka przechodzi dalej — DOKŁADNIE model "ile muszę
uzbierać" z prośby usera (najpierw pokryj czynsz+prąd+internet, potem jedzenie, reszta to
"wolne" zmienne).

`earnings` = `workMonthly.workedEarnings` — JUŻ istniejąca, dojrzała liczba w `index.tsx`
(godziny przepracowane DO TERAZ w tym miesiącu × stawka, ten sam wzór co "≈ do teraz" w
istniejącym panelu Pracy) — zero nowej logiki liczenia zarobku, tylko nowe zestawienie z
`fvMonths`. Widget wstawiony do ISTNIEJĄCEGO modala "Praca" (`workPanel` w `index.tsx`), zaraz
po bloku "przepracowane w tym miesiącu", przed "ile zostało do przepracowania" — 3 paski
(`s.wbBarTrack`/wypełnienie proporcjonalne do `pct`, kolor zielony gdy `pct>=1` inaczej
niebieski jak reszta karty Pracy), każdy z etykietą "wypełniono / cel zł". Guard: `hasRate &&
workBudget.some(b => b.target > 0)` — bez stawki lub bez żadnej historii wydatków sekcja się
nie renderuje (nie ma czym wypełnić pasków).

Świadomie NIE zrobione: osobny ekran/kafelek na dashboardzie dla skarbonek (user powiedział
"w pracy", istniejący panel Pracy to najbliższe miejsce koncepcyjnie — `app/work/history.tsx`
zostaje ekranem stricte historycznym/miesiąc-po-miesiącu, niezmieniony); próg/model odchyleń to
prosta heurystyka (mediana z `fixedCosts.ts`/`detectFixedCosts` byłaby bardziej wyrafinowana,
ale operuje na INNYM zbiorze — auto-wykrytych rachunkach z całej historii, nie na już
skategoryzowanych `isFixedExpense` z bieżącego miesiąca — zostawione jako odrębne narzędzie,
nie zmieszane).

`tsc`/`jest` zielone (71 suit/926 testów, +9 nowych w `__tests__/fixedVariable.test.ts` dla
`fixedDeviations`/`topVariableContributors`/`workBudgetProgress`, w tym waterfall-alokacja i
brak-historii guard).

**Priorytet testu na urządzeniu**: (1) dashboard → sprawdź że sekcji "Sen" już nie ma (ani w
liście, ani w edytorze dashboardu) — sen zostaje w Zdrowiu; (2) "Na co idą pieniądze" → jeśli
jakiś stały rachunek (np. Prąd) wyraźnie odbiega od poprzednich miesięcy, powinna pojawić się
linia odchylenia; jeśli zmienne w tym miesiącu są wyraźnie wyższe niż średnia, powinna pojawić
się linia "głównie: ..." wskazująca największy zakup; (3) panel Pracy (stuknij kafelek/sekcję
Praca) → sprawdź że 3 paski "skarbonek" wypełniają się sensownie względem zarobku do teraz i że
suma wypełnień nie przekracza zarobku (waterfall, nie 3× ten sam zarobek).

---

## 71. Edycja pozycji paragonu (post-save) — podpowiedzi tagów po nazwie, nie płaska lista

User (ekran `app/expenses/[id].tsx`, edycja pozycji "Makaron bez glutenu", screenshot): *"jak
tak edytuje to jak mam w nazwie makaron to niech poleca taki tag, albo pasujące jakby bo
zobacz poleca mi wszystko jak nie zna to okej ale jak zna podobne produkty czy uczył sie na
targach"* (= "uczył się na paragonach" — czy korzysta z historii zeskanowanych/wpisanych
paragonów).

**Prawdziwa luka**: `ItemEditor` w `[id].tsx` (edycja pozycji JUŻ ZAPISANEGO wydatku — inny
ekran niż `manual.tsx`/`scan.tsx`) ZAPISYWAŁ tagi do pamięci przy zapisie
(`saveCustomTagsToMemory`), ale NIGDY jej nie CZYTAŁ z powrotem przy edycji nazwy — lista tagów
to zawsze był płaski, statyczny `[...new Set([...ITEM_TAGS, ...tags])]`, bez żadnego
rozróżnienia "to pasuje" vs "to nie pasuje". `manual.tsx` i `scan.tsx` MIAŁY już taką logikę
(`applyTagMemory` przy zmianie nazwy / zaraz po OCR) — `[id].tsx` był jedynym z trzech edytorów
pozycji bez niej.

**Naprawa** — dwie nowe czyste funkcje w `src/utils/productMemory.ts`:
- `allKnownTags(memory)` — unia WSZYSTKICH tagów, jakich user kiedykolwiek użył (nie tylko
  domyślna lista `ITEM_TAGS` — też własne, ręcznie dopisane jak "makaron").
- `tagsMatchingWords(name, knownTags)` — który ze znanych tagów pojawia się jako CAŁE
  słowo/fraza (nie podciąg) w bieżącej nazwie. To osobny, SŁABSZY sygnał niż pełne
  dopasowanie nazwy w `applyTagMemory` (które wymaga ≥60% podobieństwa CAŁEGO stringa przez
  trigramy) — "Lubella Makaron 5jaj" (skąd user dodał tag "makaron") NIE łapie fuzzy-podobne
  "Makaron bez glutenu" (za dużo różnicy w reszcie nazwy), ale słowo "makaron" pasuje wprost.

W `ItemEditor`: `suggestedTags` = unia (a) trafień `applyTagMemory` na CAŁĄ nazwę i (b)
`tagsMatchingWords`, przeliczane z 250ms debounce przy zmianie `name` (ten sam wzorzec co
`manual.tsx`'s `handleNameChange`). Świadomie TYLKO podpowiada (wyróżnienie — przerywana
zielona ramka, pierwszeństwo w kolejności listy) zamiast auto-ustawiać tagi: to edycja JUŻ
otagowanej, zapisanej pozycji, więc cicha zmiana danych przy samym wpisywaniu nazwy byłaby
zaskakująca (inaczej niż w `manual.tsx`, gdzie auto-apply dotyczy świeżo wpisywanej, jeszcze
nieotagowanej pozycji i jest zablokowane flagą `tagsTouched`).

Świadomie NIE ruszone: `scan.tsx` (już ma `applyTagMemory` bulk przy OCR + sortowanie
`TagPicker` po frekwencji — inny mechanizm, ale już adresuje ten sam problem) i `manual.tsx`
(już ma pełną logikę `handleNameChange`, patrz kod z wcześniejszej sesji) — `[id].tsx` był
jedynym brakującym ogniwem.

`tsc`/`jest` zielone (71 suit/933 testy, +7 nowych w `productMemory.test.ts` dla
`allKnownTags`/`tagsMatchingWords`, w tym granica słowa — "nabiał" nie łapie "nabiałowy").

**Priorytet testu na urządzeniu**: Otwórz istniejący wydatek z pozycjami → edytuj pozycję,
wpisz nazwę zawierającą słowo, które jest znanym tagiem (np. zmień nazwę na coś z "makaron" w
środku, o ile ten tag był kiedyś użyty) → tag powinien wyskoczyć na początek listy z przerywaną
zieloną ramką, gotowy do jednego tapnięcia (nie ustawiony automatycznie).

---

## 72. Panel "Praca" na dashboardzie — przeprojektowanie wizualne (spójne karty, skrócona lista wypłat)

User (3 screenshoty panelu Praca): *"I dawaj upieksz te zakladek pracy bo teraz zobacz taka
zbyt niejasna nie?? i nie dopasowana"*.

**Diagnoza (bez pytania o zakres — user: "sam zdecyduj")**: `workPanel` (Modal w
`app/(tabs)/index.tsx`, otwierany z kafelka "Praca") narósł przez WIELE osobnych sesji/próśb
(live zarobek, "ile zostało", "zaplanowane naprzód", stawka, PEŁNA lista wypłat, wykres 6 mies.,
"rok/porównania", a najnowsze — skarbonki §70c) — każda sekcja dostała styl pasujący do
ówczesnego "pilotu", bez wspólnego języka wizualnego: raz goła Text bez karty (`wpBig`/`wpSub`),
raz osobno obramowana karta (`wpRateCard`, `wpLeftCard` — DWIE prawie identyczne, tylko różne
nazwy), raz lista surowych wierszy (`wmRow` — jeden wiersz NA KAŻDY miesiąc wypłaty, bez
paginacji). Ten OSTATNI punkt to też CZYSTA DUPLIKACJA — pełna lista wypłat miesiąc-po-miesiącu
to dokładnie to, co robi ekran „Historia pracy" (`/work/history`, §67), tylko bez mini-kalendarza
i bez ładnego stylu — więc było to jednocześnie najbardziej "niejasne" (screenshot 2 usera) I
zbędne (ten sam widok już istnieje gdzie indziej, lepiej zrobiony).

**Naprawa**:
- JEDEN wspólny wrapper `s.wpCard` (bg `fill.subtle`, `radius.xl`, border, padding) +
  `s.wpCardLabel` (jednolita etykieta sekcji, uppercase) — zastępuje dawne `wpRateCard`,
  jeden z dwóch `wpLeftCard` (drugi, `wpLeftCard`-jako-row-statystyk, żyje dalej jako
  `s.wpStatsRow`, ale TERAZ zagnieżdżony WEWNĄTRZ `wpCard` zamiast być własną, osobno
  obramowaną kartą — łączy np. "Ten miesiąc" + "ile zostało/prognoza" w JEDNĄ kartę zamiast
  dwóch stackowanych osobno).
- `wpAheadCard` ("Zaplanowane naprzód") ŚWIADOMIE zostaje jedyną INNĄ, akcentowaną (kolor
  `WORK_ACCENT`) kartą — to jedyna sekcja z akcją ("sprawdź czy grafik się zgadza"), reszta to
  czyste fakty, więc wyróżnienie ma sens i nie jest przypadkowe niedopasowanie.
- Pełna lista `workPayMonths.map(...)` (jeden wiersz NA KAŻDĄ wypłatę) USUNIĘTA z panelu —
  zastąpiona dwoma liniami: "Ostatnia · {miesiąc} → {kwota} zł · {stawka} zł/h" i "Łącznie
  ({prefiks}) · N wypł. → {suma} zł". Cała reszta (przeglądalna historia, mini-kalendarz,
  filtr pracodawców) zostaje TAM gdzie już jest — `/work/history`.
- Link do historii podniesiony z gołego tekstu (`wpHistoryLink`/`Txt`) do pełnego,
  obramowanego przycisku (`wpHistoryBtn`/`Txt`, tinted `WORK_ACCENT`, z `ChevronRight`) — to
  teraz JEDYNE miejsce dotarcia do pełnej listy wypłat z tego panelu, więc musi być wyraźnie
  klikalne.
- Skarbonki (§70c) zostają wizualnym WZORCEM dla reszty — to ich karta (bg/radius/border) stała
  się `s.wpCard`, bo to najnowsza i najlepiej przyjęta sekcja ("bankowy" wygląd, o który user
  prosił wielokrotnie w tej sesji Pracy).
- Usunięte martwe style: `wpLeftCard` (stary, row-only wariant), `wpRateCard`, `wpHistoryLink`/
  `Txt`, `wmRow`/`Month`/`H`/`Zl`, `wpTotalRow` (wszystkie 0 użyć po refaktorze, zweryfikowane
  grepem PRZED usunięciem).

Świadomie NIE ruszone: `/work/history` (ekran docelowy dla pełnej historii — to on ma zostać
jedynym miejscem z pełną listą, nie kopiować jej z powrotem tutaj), logika liczenia
(`workMonthly`/`workEarnings`/`workBudget`/`workAvg`/`workPayMonths` — zero zmian, czysto
wizualny refaktor JSX/stylów).

`tsc`/`jest` zielone (71 suit/933 testy — bez nowych testów, to czysto wizualna zmiana
istniejącego, niezmienionego stanu/logiki; brak pokrycia komponentowego dla tego ekranu jak
reszty dashboardu). **Nie zweryfikowane wizualnie na urządzeniu/emulatorze** (RN, brak
łatwego podglądu w tym środowisku) — tylko przez czytanie kodu/struktury JSX.

**Priorytet testu na urządzeniu**: Otwórz panel "Praca" z dashboardu → sprawdź że wszystkie
sekcje (Ten miesiąc, Skarbonki, Stawka, Zaplanowane naprzód, Godziny, W liczbach, Wypłaty)
wyglądają SPÓJNIE (ten sam kolor tła/obramowania kart, ta sama etykieta sekcji) — jedynym
wyjątkiem celowo powinno być "Zaplanowane naprzód" (niebieski akcent); sprawdź że przycisk
"Pełna historia i mini-kalendarz" na dole jest wyraźnie widoczny i prowadzi do `/work/history`.

---

## 73. Walka: pupil/boss "niżej" + cień; Rynek: cena przed kliknięciem + spójny kolor tablicy/lady; Pupil: dokładne staty umiejętności; naprawiony ucięty tytuł w podglądzie sklepu

Seria mniejszych poprawek zgłoszonych naraz (screenshoty):

**73a. Arena walki — sprite'y "lewitowały"**. User: *"podczas walki żeby pupil i boss byli
troszeczkę niżej bo jakby lewitowali teraz w powietrzu... realistyczny zbudowany cień"*.
`GroundShadow` (miękki, eliptyczny cień) już ISTNIAŁ pod obydwoma sprite'ami — prawdziwy
problem: oba są WYŚRODKOWANE w `tilePortrait` (wspólna wysokość obu kolumn, gwarantuje ten sam
pionowy środek niezależnie od różnicy rozmiarów kotek/boss), co zostawia sporo pustej
przestrzeni PONIŻEJ (zwłaszcza bossa, mniejszego niż `CAT_PORTRAIT_SIZE`) — para sprite+cień
floatuje wysoko nad wizualną "podłogą" (blisko paska HP). Naprawa: nowa stała
`SPRITE_GROUND_SHIFT = 14`, `transform: translateY` na `spriteBoxCat`/`spriteBoxBoss` (przesuwa
sprite RAZEM z jego `GroundShadow`, bo oba są w tym samym boxie) — czysto wizualny `transform`,
NIE dotyka layoutu/`tilePortrait.height`, więc `projectile.top` (pozycja lecącego pocisku
między sprite'ami, liczona z pionowego środka `tilePortrait`) dostał dokładnie taką samą
poprawkę (+14), żeby cios dalej trafiał w realny, teraz niższy środek obu sprite'ów. Cień
(`GroundShadow`) dostał `opacity={0.5}` (z domyślnych 0.4) dla mocniejszego kontaktu z podłożem.

**73b. Rynek — spójny kolor tablicy/lady**. User: *"ogarnij kolor wypełnienia tego pod potkami
na taki sam jak na dole jest teraz"*. `boardBg` (wypełnienie POD potkami/zamrożeniem na
tablicy) miało jaśniejszy `#4A3420F0`, podczas gdy `boardBgBottomFill` (lada, ekwipunek+
skrzynki) dostała ciemniejszy `#2E2114F5` w poprzedniej sesji (§65). Ujednolicone — `boardBg`
dzieli teraz DOKŁADNIE ten sam kolor co lada.

**73c. Rynek — cena itemów Sklepu dnia przed kliknięciem**. User: *"dodaj zeby bylo widac ceny
przedmiotów, przed kliknięciem"*. 4 itemy ekwipunku w "Sklepie dnia" (na ladzie) jako JEDYNE
(zamrożenie/potki/skrzynki już to miały, `artCostPill`) nie pokazywały ceny bez otwierania
`GearPreviewModal`. Dodana ta sama plakietka `artCostPill` (przyciemniona gdy nie stać) —
ukryta, gdy item już kupiony/posiadany (checkmark zamiast tego, cena do zapłaty nie ma sensu).

**73d. Pupil — dokładne staty umiejętności bossów**. User: *"jak są te umiejętności... żeby
pokazywało co one robią lepiej ze statystykami dokładnie ile czego"*. `def.desc` (opis w
`COMBAT_ITEMS`) był generyczny i STAŁY niezależnie od poziomu itemu, mimo że mechanika realnie
skaluje się z poziomem (np. Unik: 5% na lvl1 → 17% na lvl4, `dodgeChanceAt`). Nowa funkcja
`combatItemStatText(id, level)` w `combatItems.ts` — liczy i formatuje DOKŁADNĄ, aktualną
wartość z istniejących formuł (`dodgeChanceAt`/`reflectPctAt`/`executeThresholdAt`/
`fireProcChanceAt`/stałe procentowe) zamiast generycznego opisu. Użyta w `app/pet.tsx` w
miejscu `def.desc` dla POSIADANYCH itemów (nieznane/`???` zostają bez zmian).

**73e. Sklep — ucięty tytuł itemu w podglądzie**. User (zbliżenie): *"zobacz jak od dołu
przycina napis Kamizelka ten pasek widac ledwie połowę napisu jakby byl za horyzontem"*. Root
cause: `title2` (tytuł w `GearPreviewModal`) nie miał jawnego `lineHeight` — pogrubiony (800)
tekst na Androidzie czasem realnie maluje się WYŻEJ niż jego wyliczony box (metryki fontu przy
dużej wadze liter), więc kolejny element w tej samej kolumnie (`rarityUnderline`, malowany PO
tytule = na wierzchu w z-order) zaczynał się WEWNĄTRZ realnych, za dużych liter i wizualnie
ucinał ich dolną połowę — dokładnie efekt "za horyzontem" ze zrzutu. Naprawa: jawny, hojny
`lineHeight: 22` na `title2`, gwarantujący boxowi dość miejsca niezależnie od metryk fontu.

Świadomie NIE naprawione w tej rundzie: punkt 3 z oryginalnej listy usera ("nazwy po
kliknięciu w item ucina na dole") okazał się TYM SAMYM zgłoszeniem co 73e (to samo zbliżenie) —
połączone w jedną naprawę, nie osobny punkt.

`tsc`/`jest` zielone (71 suit/938 testów, +5 nowych w `combatItems.test.ts` dla
`combatItemStatText`, w tym sprawdzenie że tekst faktycznie zmienia się z poziomem).
**73a/73b/73c/73e nie zweryfikowane wizualnie na urządzeniu** (środowisko bez podglądu RN).

**Priorytet testu na urządzeniu**: (1) walka z bossem/questem → sprite'y pupila i przeciwnika
powinny wyglądać zauważalnie bardziej "na ziemi", cień wyraźniejszy; (2) Rynek → tablica z
potkami i lada z ekwipunkiem powinny mieć TEN SAM odcień brązu; 4 itemy Sklepu dnia powinny
pokazywać cenę na slocie, zanim się w nie stuknie; (3) Pupil → "Umiejętności bossów" → opis
każdej posiadanej umiejętności powinien zawierać konkretną liczbę (%), nie ogólnik; dla Uniku/
Odbicia/Podpalenia/Egzekucji liczba powinna się różnić między poziomami po ulepszeniu; (4)
Sklep → kliknij dowolny item Sklepu dnia (zwłaszcza z dłuższą nazwą) → tytuł w popupie powinien
być w pełni czytelny, bez ucięcia dołu liter przez pasek rzadkości pod spodem.

---

## 74. Skrzynki na Rynku — usunięcie koloru/startupu/zamrożenia z puli dropów

User: *"ze skrzynek na rynku wywalmy zamrożenie serii oraz kolory i startupy, zostaje sam
ekwipunek do dropnięcia oraz te ulepszenia ogólne"*.

**Zakres**: WYŁĄCZNIE `rollBox()` (`petBoxes.ts`) — czyli skrzynki KUPOWANE (`LOOT_BOXES`:
sardine/iron/gold/divine, sklep Rynku) i darmowa `DAILY_BOX` (skrzynka dnia, odbierana z hero
na `/pet`). Świadomie NIE ruszone: `openCrate()`/`menaceClaim()` w `petStore.ts` — te mają
CAŁKOWICIE NIEZALEŻNĄ, własną pulę (gear+combatItem+coins, zweryfikowane przed zmianą — nigdy
nie dawały koloru/startupu/zamrożenia), więc "ze skrzynek na rynku" ich nie dotyczyło; kupno
zamrożenia WPROST za monety (`FREEZE_COST`, osobny przycisk w Rynku obok potek) też zostaje —
to nie jest skrzynka/losowanie, tylko bezpośredni zakup, poza zakresem prośby.

**Naprawa**: `colorChance`/`startupChance`/`freezeChance`/`tierWeight` usunięte z `LootBox`
(interfejs + wszystkie 4 wpisy `LOOT_BOXES` + `DAILY_BOX`), `'color'`/`'startup'`/`'freeze'`
usunięte z `BoxReward`. `rollBox()` stracił parametry `colors`/`ownedIds` (potrzebne WYŁĄCZNIE
do tamtych dwóch gałęzi) — sygnatura teraz `rollBox(box, level, ownedCombatItems?)`, oba call
site'y (`pet-shop.tsx`, `pet.tsx`) zaktualizowane, martwe importy/bindingi (`SHOP_COLORS`,
`buyItem`, `grantStartup`, w `pet.tsx` też `addFreezes`/`useStreakFreezeStore`) usunięte.
`BoxRevealModal.tsx` stracił odpowiadające gałęzie renderu (swatch koloru, "startup mark",
płatek ❄) + martwe style.

**`gearChance` KAŻDEJ skrzynki podniesiona** o DOKŁADNIE tyle, ile zabierały usunięte
kategorie (colorChance+startupChance+freezeChance) — np. sardine 0.15→0.40, gold 0.38→0.96.
Świadomy wybór zamiast wymyślania nowych liczb: CAŁKOWITA szansa "coś ciekawego wypadło"
(gear+combatItem) per skrzynka jest DOKŁADNIE taka sama jak przed zmianą, tylko cała idzie
teraz w ekwipunek zamiast być dzielona z usuniętymi kategoriami. `combatItemChance`
("ulepszenia ogólne"/umiejętności bossów) celowo NIETKNIĘTA — user nie prosił o zmianę jej
rzadkości, tylko o usunięcie trzech innych kategorii.

**Świadomie NIE zrobione w tej rundzie** (druga połowa tej samej prośby usera): nowa animacja
otwierania skrzynki. User zaproponował DWA alternatywne kierunki: (a) "rozpadanie się"
skrzynki jak w chestach Boom Beach/Clash-style, (b) reel jak w case'ach CS — przelatujące
itemy zwalniające i zatrzymujące się na WYLOSOWANYM (już ustalonym przez `rollBox()`) itemie,
z osobnym przyciskiem "Otwórz" uruchamiającym losowanie. To osobna, większa robota
projektowo-implementacyjna (wybór stylu, fizyka animacji, dopasowanie do już-wylosowanej
nagrody) — zapisana w NEXT_STEPS.md jako gotowa do podjęcia w kolejnej sesji, nie zgadywana na
szybko przy okazji trymowania puli dropów.

`tsc`/`jest` zielone (71 suit/934 testy — `__tests__/petBoxes.test.ts` przepisany pod nową
sygnaturę `rollBox()` i nowe progi, testy koloru/startupu/zamrożenia usunięte jako
nierelewantne, reszta zachowana 1:1). **Nie zweryfikowane wizualnie na urządzeniu.**

**Priorytet testu na urządzeniu**: Otwórz dowolną skrzynkę na Rynku (i skrzynkę dnia z /pet)
kilka razy → upewnij się że NIGDY nie wypada kolor/startup/zamrożenie, tylko ekwipunek, perk
bossa albo monety; sprawdź że modal `BoxRevealModal` wciąż wygląda poprawnie (bez połamanych
gałęzi po usunięciu koloru/startupu/zamrożenia).

---

## 75. Nowa animacja otwierania skrzynki — reel jak w case-openingach (BoxRevealModal)

User (druga połowa §74, dokończona teraz): *"możesz zrobic lepsza animacje wtedy ze jest to
zdjęcie skrzynki co mamy aktualne otwieranej zrobic animacje jakby jej rozpadania (jak w bloon
monkey city chesty)... lub zrobic jak w ceesie tez z animacja tylko jeszcze dodać przycisk
otwórz i wtedy losuje sie jak w ceesie) ze przelatują te itemy tak i zatrzymuje sie na
jednym"*. Wybrany kierunek (bez dopytywania — kontynuacja "sam zdecyduj" z §72/§74): styl
CS-case (reel), bo to WYRAŹNIEJSZA zmiana wizualna niż wariant "rozpad skrzynki" (obecny
`BoxRevealModal` już miał shake→burst, blisko konceptu "rozpadania" — reel to coś realnie
nowego, nie tylko dopieszczenie istniejącego).

**Mechanika** (`BoxRevealModal.tsx`, 3 fazy zamiast dawnych 2 — `closed → spinning →
revealed`):
- `closed`: skrzynka (bez zmian wizualnych — bujająca się `bob`), ALE zamiast "stuknij żeby
  otworzyć" na samej skrzynce — osobny przycisk **"Otwórz"** pod spodem (user: "dodać przycisk
  otwórz"), zgodnie z dosłowną prośbą.
- `spinning`: pasek ~40 ikon (`buildReel()`) przelatuje poziomo w oknie stałej szerokości
  (`overflow:'hidden'`), zwalniając (`Easing.bezier(0.1, 0.7, 0.2, 1)`, 3.4s) i zatrzymując się
  DOKŁADNIE na już-wylosowanej (przez `rollBox()`, PRZED tą animacją — nic się tu nie losuje
  na nowo, to czysto wizualna celebracja) nagrodzie pod wskaźnikiem (trójkąt+pionowy pasek) na
  środku okna. Reszta paska to "wypełniacze" (`FILLER_ICONS` — losowa mieszanka ikon
  `GEAR_ITEMS`/`COMBAT_ITEMS`/monety, KOSMETYCZNE obwódki losowej rzadkości, zero związku z
  realnym prawdopodobieństwem) — dokładnie jak w case-openingach: pasek NIE reprezentuje puli
  dropów, tylko robi wrażenie "mogło wypaść cokolwiek".
- `revealed`: BEZ ZMIAN — istniejąca karta+burst+cząstki (`Fly`), ten sam kod co przed zmianą,
  tylko trigger przeniesiony z końca sekwencji shake na koniec animacji reela.

**Matematyka przesunięcia** (`finalX` w `doOpen`): `REEL_ITEM_W` = pełny "pitch" komórki
(szerokość + miejsce na odstęp, NIE sam widoczny box — box jest węższy, wycentrowany w środku
przez `reelCellOuter`/`reelCell`), więc `finalX = windowCenter − (targetIndex×itemW +
itemW/2) + jitter`. `REEL_TARGET_INDEX=34` z `REEL_LENGTH=40` (5 komórek zapasu PO celu) —
losowy `jitter` (±30% szerokości komórki) sprawia że pasek nie zatrzymuje się co do piksela w
tym samym miejscu za każdym razem, bezpiecznie w granicach zapasu.

**Usunięty stary `shake` (trzęsienie skrzynki przy tapnięciu)** — zastąpiony CAŁKOWICIE przez
fazę `spinning`; `Animated.Value` `shake`/`rot` martwe, usunięte.

Świadomie NIE zrobione: haptyczne "tiki" przy przelatywaniu kolejnych komórek reela (dodatkowa
złożoność — nasłuchiwanie `Animated.Value` z częstymi wywołaniami — pominięte, `haptic.medium()`
na start + `haptic.success()` na koniec wystarczają); wariant "rozpad skrzynki" (user dał
wybór, wybrany drugi kierunek — jeśli user wolałby jednak pierwszy, to osobna, przyszła zmiana,
nie strata pracy, bo faza `revealed` i tak zostaje wspólna dla obu stylów).

`tsc`/`jest` zielone (71 suit/934 testy — bez nowych, `BoxRevealModal.tsx` nie ma dotąd
pokrycia komponentowego jak reszta warstwy animacji/UI w tej apce). **Nie zweryfikowane
wizualnie na urządzeniu** — to czysto animacyjna zmiana, priorytet #1 do oceny "czy faktycznie
wygląda jak case-opening" na telefonie.

**Priorytet testu na urządzeniu**: Otwórz dowolną skrzynkę (Rynek lub skrzynka dnia) →
sprawdź: (1) przycisk "Otwórz" pojawia się pod bujającą się skrzynką; (2) po tapnięciu pasek
ikon przelatuje i PŁYNNIE zwalnia (bez szarpnięć), zatrzymując się pod żółtym
wskaźnikiem/trójkątem na środku; (3) ikona pod wskaźnikiem PO ZATRZYMANIU zgadza się z tym co
faktycznie dostałeś na następnej karcie (to ta sama nagroda, reel jej nie zmienia); (4) cała
sekwencja (spin + reveal) nie trwa absurdalnie długo ani nie ucina się w połowie.

## 76. Grafika Skrzynki dnia (DAILY_BOX_ICON) — punkt 8 z serii

User: *"wrzuciłem ci tam jeszcze daily skrzynkę, a dawaj dalej wszystko"* — dostarczony
`assets/chests/chest_daily.png` (bezpośredni upload na `master`, ten sam wzorzec co reszta
grafik skrzynek w §49/167: ChatGPT-owy rozmiar 1536×1024, ~2.2MB). Skrzynka dnia (`DAILY_BOX`
w `petBoxes.ts`) jako jedyna z pięciu (4×`LOOT_BOXES` + ta) nie miała własnej grafiki —
`icon` pole było `undefined`, wszędzie fallback na `emoji: '🎁'`.

**Fix**:
- Przeskalowane do 300×200 (PIL LANCZOS, ten sam przepis co `skrzynka_*.png` w §49) →
  92KB, w linii z resztą (65-110KB/szt).
- Nowa stała `DAILY_BOX_ICON` w `petBoxes.ts` (osobna od `BOX_ICON: Record<BoxId, any>`, bo
  `DAILY_BOX` NIE jest w `LOOT_BOXES` — nie jest na sprzedaż, patrz istniejący komentarz przy
  `DAILY_BOX`) → przypięta jako `DAILY_BOX.icon`.
- **`BoxRevealModal.tsx` dostał nowy prop `boxIcon?: any`** — dotąd faza `closed` ZAWSZE
  renderowała emoji (`boxEmoji`) w środku skrzynki-ikony, NIEZALEŻNIE od tego czy dana
  `LootBox` miała własną grafikę na Rynku (`box.icon`) czy nie — modal po prostu nigdy nie
  dostawał tego propa. Teraz: gdy `boxIcon` podane, `Image` wypełnia całą `st.box` (zastępuje
  `boxLid`+`boxEmoji` warstwy), inaczej stary fallback emoji bez zmian. Dotyczy WSZYSTKICH
  skrzynek (4×Rynek + dnia), nie tylko nowej grafiki — do tej pory żadna skrzynka nie
  pokazywała swojej prawdziwej ikony w momencie otwierania, tylko na Rynku PRZED kliknięciem.
- Oba wołania (`app/pet-shop.tsx` — skrzynki Rynku, `app/pet.tsx` — skrzynka dnia) przekazują
  teraz `boxIcon={reveal?.box.icon}` / `boxIcon={boxReveal?.box.icon}`.

Explicite NIE zrobione: dodatkowe warianty animacji dla skrzynki dnia (reel z §75 już
uniwersalny, działa identycznie dla wszystkich 5 skrzynek bez zmian).

`tsc`/`jest` zielone (71 suit/934 testy, bez nowych — czysto wizualna zmiana, brak nowej
logiki do przetestowania jednostkowo). **Nie zweryfikowane wizualnie na urządzeniu.**

**Priorytet testu na urządzeniu**: Odbierz Skrzynkę dnia (przycisk Gift w headerze /pet) →
sprawdź że w fazie "zamknięta" (przed "Otwórz") widać prawdziwą grafikę skrzynki zamiast 🎁;
przy okazji sprawdź też jedną skrzynkę z Rynku (np. drewnianą) — jej `closed`-faza w modalu też
powinna teraz pokazywać obrazek skrzynki (wcześniej była tam emoji nawet dla skrzynek z
grafiką na Rynku).

## 77. Finanse: wyszukiwarka własnego tagu w filtrach + przebudowa widgetu "Na co idą pieniądze" (fvOverride)

User: *"1. W finansach na stronie głównej w filtrach możliwość wpisania tagu własnego (taka
wyszukiwarka jakby) 2. Ten widget na dashboardzie NA CO IDA PIENIADZE, musimy rozbudowac
/edytowac, bo teraz jest spoko koncept ale wykonanie [słabe]... muszą byc stale zmienne w tym
miesiacu pokazane wzgledem średniej to na głównym tle, pod nim muszą byc wykresy stałych,
zmiennych, jedzenie każdy osobno klikalny z pokazaniem co sie kiedy tam wlicza zebym mógł
kliknąć ze np cos sie zle liczy itp itd zeby sie uczyło"*.

### 1. Filtr po tagu — wyszukiwarka (`app/(tabs)/finances.tsx`)

Dotąd filtr "Tag" w modalu Filtry pokazywał TYLKO `availableTags` — top 12 tagów wg
częstości w całej historii. Tag spoza top 12 (rzadszy, dopiero co dodany) był
niefiltrowalny bez ręcznego przewijania. Dodane pole tekstowe (`Search` ikona + `X` do
czyszczenia) NAD chipami, dzielące ten sam stan `activeTagFilter` — wpisanie dokładnej
nazwy podświetla odpowiadający chip, kliknięcie chipa wypełnia pole. Dopasowanie w
`matches()` zmienione z `===` (ścisła równość) na `.toLowerCase().includes()`
(case-insensitive substring) — obsługuje zarówno kliknięcie chipa (nadal działa, bo
`tag.includes(tag)` jest zawsze `true`), jak i częściową frazę wpisaną ręcznie.

### 2. "Na co idą pieniądze" — przebudowa (`FixedVariableSection.tsx`, `FvBreakdownModal.tsx` NOWY, `fixedVariable.ts`)

**Nowa centralna funkcja `bucketOf(e): 'fixed'|'variable'|'food'`** w `fixedVariable.ts` —
zastępuje powtarzany wszędzie `isFixedExpense(e) ? ... : e.category==='groceries' ? ...`.
Sprawdza `e.fvOverride` PRZED heurystyką kategorii/tagów. Użyta teraz we WSZYSTKICH
funkcjach: `fixedVariableMonths`, `fixedBreakdown`, `topVariableContributors`, oraz nowej
`bucketTransactions(expenses, month, bucket): FvTransaction[]` — surowa (NIE grupowana),
chronologiczna lista pojedynczych transakcji danego kubła w danym miesiącu, z flagą
`overridden`.

**Nowe pole `Expense.fvOverride?: 'fixed'|'variable'|'food'|null`** (`src/types/index.ts`) —
ręczne, TRWAŁE przeklasyfikowanie JEDNEJ transakcji. `null` = jawnie wyczyszczone (wróć do
automatu). Ten sam wzorzec co istniejące `vehicleId` (ręczny link nadpisujący auto-match).

**UI — `FixedVariableSection.tsx` (przebudowany)**:
- Wiersze hero (Stałe/Zmienne/Jedzenie) teraz DWULINIOWE i KLIKALNE: górna linia
  dot+etykieta+kwota+chevron, DOLNA pokazuje `śr. X zł` + deltę (`↑/↓ N% vs śr.`, kolor
  pomarańczowy/zielony, próg ±3% żeby nie migotało przy szumie) — user: "muszą byc...
  pokazane wzgledem średniej to na głównym tle" — dotąd średnia była tylko w jednej,
  wspólnej stopce na samym dole karty, ŁATWO przeoczana.
- **Trzy OSOBNE, klikalne mini-wykresy trendu** (`fvBucketChartsRow`) — Stałe/Zmienne/
  Jedzenie, każdy WŁASNYM kolorem i WŁASNĄ skalą (lokalny max, nie globalny) —
  ZASTĘPUJĄ dawny jeden wspólny stackowany `fvTrend` (3 kolory w jednym słupku, trudno
  ocenić trend pojedynczej kategorii, i NIEKLIKALNY).
- Kliknięcie DOWOLNEGO wiersza hero LUB dowolnego mini-wykresu otwiera
  `FvBreakdownModal` dla tego kubła.
- Usunięte: `fvFixBox` ("Stałe — składniki", top-4 nazwanych rachunków) — zastąpione
  pełnym, klikalnym rozbiciem w modalu; stary wspólny `fvTrend`+`fvAvg` (stopka
  "śr. N mies...") — zastąpione deltą wprost w wierszu hero. Zostają bez zmian:
  `fvBar` (proporcja), `fvDevBox` (odchylenia POJEDYNCZYCH rachunków, §70), `fvTip`
  ("co przeważyło" w zmiennych, §70) — dalej różne, komplementarne widoki.

**Nowy `FvBreakdownModal.tsx`** — rozbicie jednego kubła: nagłówek (kolor+nazwa+miesiąc),
suma+liczba transakcji, przewijalna lista (data, nazwa, kwota, ✏️ jeśli `overridden`).
Tap na transakcję rozwija chipy pozostałych DWÓCH kubłów (+ "Auto" gdy już
`overridden`) — wybór woła `onReclassify(id, bucket|null)`.

**"Uczenie się" = `fvOverride`, nie ML** — user: "zebym mógł kliknąć ze np cos sie zle
liczy... zeby sie uczyło". To NIE jest model uczący się wzorców — to DETERMINISTYCZNE,
per-transakcyjne nadpisanie zapamiętane na stałe (jak ręczne tagowanie). Świadomie
NIE zrobione: sugerowanie podobnych transakcji do przeklasyfikowania na bazie jednej
poprawki (prawdziwe "uczenie się" na wzorcach) — poza zakresem tej zmiany, do rozważenia
jeśli user zgłosi że ręczne poprawianie KAŻDEJ podobnej transakcji z osobna jest zbyt
żmudne.

**`reclassifyFvExpense` w `index.tsx`** — TEN SAM wzorzec co istniejący `removeTagItem`
(patrz §48/ARCHITECTURE §4 "Snapshot statystyk"): czyta/zapisuje LIVE store
(`useExpensesStore.getState()`), NIE zamrożony snapshot `expenses` — snapshot dogania się
sam (~300ms) przez istniejący efekt nasłuchujący `liveExpenses`. Zapis też do Firestore
przez `expensesService.update(id, { fvOverride })` (ten sam call co przy `vehicleId` w
`app/vehicles.tsx`) — `strip()` w `expensesService` filtruje TYLKO `undefined`, więc
`fvOverride: null` (czyszczenie) DOCIERA do Firestore poprawnie.

`tsc`/`jest` zielone (71 suit/940 testów, +6 nowych: `bucketOf` z override w obie strony,
`fixedVariableMonths` respektujące override, `bucketTransactions` — chronologia +
`overridden` flag). **Nie zweryfikowane wizualnie na urządzeniu.**

**Priorytet testu na urządzeniu**:
1. Finanse → Filtry → wpisz w polu "Szukaj tagu" fragment tagu SPOZA widocznych chipów →
   sprawdź że lista transakcji faktycznie filtruje się po substring, nie tylko po
   dokładnym dopasowaniu.
2. Dashboard → "Na co idą pieniądze" → sprawdź czytelność 2-liniowych wierszy hero na
   wąskim telefonie (czy tekst się nie ucina/nie zawija brzydko) + czy trzy mini-wykresy
   mieszczą się w rzędzie bez ściskania.
3. Kliknij dowolny wiersz LUB mini-wykres → modal otwiera się z prawidłową listą
   transakcji tego miesiąca (daty + kwoty + suma zgadzają się z kwotą w widgecie).
4. W modalu przeklasyfikuj jedną transakcję (np. Stałe→Zmienne) → zamknij modal →
   sprawdź że po ~1s (odśwież ręcznie jeśli trzeba) kwoty w widgecie i wykresach faktycznie
   się przeliczyły, a ponowne otwarcie modala dla nowego kubła pokazuje tę transakcję z
   ikoną ✏️ (overridden) i opcją "Auto" do cofnięcia.

## 78. Praca: jeden stonowany żółty akcent (cofnięcie 3-kolorowego schematu) + usunięty widget "Kto zjadł słodycze"

### 1. Kolory panelu Praca — z powrotem "monochrom + jeden akcent" (`app/(tabs)/index.tsx`)

User: *"Te kolory w zakladce praca mi sie jednak nie podobają za duże zamieszanie
wprowadzają dajmy jakiś soft pasujacy kolor np żółty ale stonowany nie [rażący] bo zolty
wybrałem w ustawieniach bo jdsport ma żółte barwy [z] moja praca [logo]"*.

2026-08-28 (patrz komentarz w kodzie sprzed zmiany) user PROSIŁ o odejście od appowego
"akcent czarno-biały" na rzecz TRZECH kolorów w Pracy: niebieski `WORK_ACCENT` (tożsamość),
zielony `WORK_WORKED` (przepracowane), złoty `WORK_MONEY` (pieniądze). Teraz ta decyzja
COFNIĘTA — trzy nasycone barwy razem czytały się jako chaos, nie jako czytelne
rozróżnienie. Fix: WSZYSTKIE trzy stałe scalone w JEDNĄ `WORK_ACCENT = '#D8B45C'`
(stonowane, musztardowe złoto — świadomie NIE czysty `#FBBF24` używany gdzie indziej na
pieniądze, bo user chciał "stonowany", nie kolejny jaskrawy odcień) i podstawione we
wszystkich ~13 miejscach, gdzie poprzednio wybierano między trzema. Panel Praca wraca do
tego samego wzorca co reszta dashboardu (monochrom + jeden akcent), tylko z INNYM
odcieniem akcentu niż appowy domyślny biały — bo to jedyna sekcja, gdzie user chce
skojarzenia z żółtymi barwami pracodawcy.

Świadomie NIE ruszone: zielona kropka "NA ŻYWO" (`#2AC68F`, `wpLiveDot`/`wpLiveTag`) i
zielono/czerwony wskaźnik "ten mies. vs średnia" (`#34D399`/`#F87171`) — to uniwersalne,
SEMANTYCZNE kolory (żywy stan / lepiej-gorzej niż zwykle) używane tak samo gdzie indziej w
apce, nie część skrytykowanego trio tożsamości Pracy.

### 2. Usunięty widget dashboardu "Kto zjadł słodycze"

User: *"wywalamy widget kto zjadl slodycze z zakładki dashbordu (nie używam go i chyba
usunelismy funkcje tez z paragonow nie? A jak nie to usuń)"*.

Widget (`WhoAteCard.tsx`, sekcja `who-ate`) usunięty w pełni wg playbooku z §12 (ARCHITECTURE
§12): `DEFAULT_DASHBOARD_SECTIONS`/`SECTION_TITLES`/`SECTION_DESC`/`SECTION_GROUP` w
`dashboardLayout.ts`, node + import + `DEFERRED_SECTIONS` wpis w `index.tsx`. Jego dedykowana
warstwa danych `src/utils/personConsumption.ts` (`buildPersonConsumption`) była używana
WYŁĄCZNIE przez ten jeden widget (zweryfikowane grepem) — usunięta razem z
`__tests__/personConsumption.test.ts` (11 testów).

**WAŻNE — założenie usera było błędne, NIE usunięto szerszego mechanizmu**: funkcja
"kto jadł" per pozycję paragonu (`ReceiptItem.eaters`) NADAL ISTNIEJE i jest aktywnie
używana w kilku miejscach niezwiązanych z tym widgetem:
- `app/expenses/[id].tsx` i `app/expenses/scan.tsx` — sekcja "Kto jadł" przy edycji pozycji
  paragonu (UI do zaznaczania).
- `src/store/statsScope.ts` (`itemInScope`/`consumesInScope`) — NAPĘDZA przełącznik
  "mine"/"wszyscy" (household scope) używany w Finansach i statystykach konsumpcji.
- `src/utils/tagBudgets.ts` (`attributedPrice`) — dzieli koszt pozycji między jedzących,
  używane przez limity na tagi (per-person limit bars).

Usunięcie CAŁEGO mechanizmu `eaters` (nie tylko tego widgetu) zepsułoby te trzy inne,
aktywnie działające funkcje — user prawdopodobnie mylił "widget na dashboardzie" z
"funkcją w paragonach" myśląc że oba już zniknęły. Świadomie NIE ruszone bez
dopytania — to byłaby destrukcyjna zmiana szerszego zakresu niż prośba.

`tsc`/`jest` zielone (70 suit/929 testów — spadek z 940 to WYŁĄCZNIE usunięcie
`personConsumption.test.ts`, żadnych regresji). **Nie zweryfikowane wizualnie na
urządzeniu** — priorytet: czy nowy stonowany żółty rzeczywiście czyta się jako "spójny",
nie "monotonny".

**Priorytet testu na urządzeniu**: Otwórz panel Praca (kafel na dashboardzie) → sprawdź
że WSZYSTKIE liczby/paski (zarobek na żywo, godziny, stawka, skarbonki, historia wypłat)
używają TEGO SAMEGO stonowanego złota, bez niebieskiego/zielonego jak wcześniej; sprawdź
że widget "Kto zjadł słodycze" faktycznie zniknął z dashboardu (i z listy sekcji w
edytorze układu); sprawdź że "Kto jadł" przy edycji pozycji paragonu DALEJ działa (to
CELOWO zostało).

## 79. Eksport wydatków do CSV (Ustawienia → Kopia zapasowa)

Kontekst: po rundzie sugestii ulepszeń (globalna wyszukiwarka / widget na ekran główny /
eksport CSV) user doprecyzował: *"A) Globalne wyszukiwanie super,, ale nie mamy już tego w
ustawieniach? B) czy widget nie generował by energochlonnosci większej lagow itp? C)
eksport wydatkow spoko możemy dodac w ustawieniach"*.

**A i B — wyjaśnione, NIE zaimplementowane** (odpowiedzi w rozmowie, nie w kodzie):
- Wyszukiwarka w Ustawieniach (`settingsSearch.ts`/`filterSections`) przeszukuje TYLKO
  opcje/przełączniki ustawień — nie dane usera (transakcje/notatki/zadania). Prawdziwe
  "globalne wyszukiwanie po danych" to inny, nowy zakres pracy, nie zrobiony.
- Widget na ekran główny: żyje w OSOBNYM natywnym procesie (WidgetKit/App Widget), więc
  NIE generuje lagów w samej apce podczas jej działania — ale realnie kosztuje baterię
  przez cykliczne odświeżanie w tle i jest sporą dawką natywnej złożoności (a projekt
  już ma historię kruchych buildów Androida przy zmianach natywnych, patrz CLAUDE.md
  zasada #2). Odłożone, nie odrzucone.

**C — zaimplementowane**: nowy przycisk "Eksportuj wydatki (CSV)" w `BackupSection.tsx`
(Ustawienia → sekcja "Kopia zapasowa"), OBOK istniejącego eksportu pełnego JSON-a
(`exportSnapshotToFile`) — to dwa różne eksporty, nie zastąpienie: JSON to techniczny
snapshot do backupu/analizy (z sekcją `derived`), CSV to czytelna, jedna-transakcja-na-
wiersz tabela do otwarcia w Excelu/Sheets (np. na podatki, przegląd historii poza apką).

**Warstwa danych** — nowy `src/utils/expensesCsv.ts` (`expensesToCsv`, czysta funkcja,
testowalna): kolumny Data/Typ/Kwota/Waluta/Kategoria/Tagi/Notatka/Sklep/Płatnik/Metoda
płatności, posortowane rosnąco po dacie. Separator PRZECINEK + kwota z KROPKĄ dziesiętną
(RFC4180/Sheets-style) — ŚWIADOMIE NIE polski format (średnik + przecinek dziesiętny), żeby
plik otwierał się poprawnie od razu w Google Sheets I Excelu bez zmiany ustawień
regionalnych przy imporcie. BOM (`﻿`) na początku pliku — bez tego Excel na Windows
pokazuje polskie znaki jako krzaki. Pola z przecinkiem/cudzysłowem/nową linią poprawnie
cudzysłowione (RFC4180 escaping).

**`exportExpensesToCsv()`** w `backupService.ts` — analogiczny wzorzec do
`exportSnapshotToFile`: `expensesService.getAll()` → `expensesToCsv()` →
`FileSystem.writeAsStringAsync` do cache dir → `Sharing.shareAsync` (mimeType `text/csv`).

`tsc`/`jest` zielone (71 suit/934 testy, +5 nowych: nagłówek+BOM, sortowanie+format kwoty,
przychód/wydatek, gotówka/karta, RFC4180 escaping, tagi łączone średnikiem). **Nie
zweryfikowane wizualnie na urządzeniu.**

**Priorytet testu na urządzeniu**: Ustawienia → Kopia zapasowa → "Eksportuj wydatki (CSV)"
→ wybierz "Otwórz w..."/zapisz plik → sprawdź że otwiera się poprawnie w Google Sheets/
Excelu z polskimi znakami (nie krzakami) i że kwoty/kolumny są w dobrych miejscach.

## 80. Globalna wyszukiwarka podpięta (dead-end fix) + lokalny licznik użycia ekranów

User: *"Wyszukiwanie ogarnij na ten moment... Pixel tylko w apce nigdzie nie wysyłać tego
chce zupełnie obieg zamknięty ogarniaj teraz to"* (kody kreskowe świadomie odłożone —
"olewamy" — patrz NEXT_STEPS.md).

### 1. Globalna wyszukiwarka — była już ZBUDOWANA, tylko osierocona

Zanim zacząłem cokolwiek pisać, sprawdziłem kod i **`app/search.tsx` już istniał** — pełny,
498-liniowy ekran przeszukujący zadania/wydarzenia/transakcje/notatki/nawyki naraz, z
podświetlaniem dopasowań, sekcją "ostatnie" przy pustym zapytaniu i poprawną nawigacją do
każdego wyniku (`/expenses/:id`, `/tasks/:id`, `/calendar/:id`, `/notes?noteId=`, `/habits`).
`git log` pokazuje że powstał przy refaktorze wydzielającym kawałki z `index.tsx` — ale
**żaden przycisk nigdzie w apce do niego nie prowadził** (zgrepowane: zero wystąpień
`'/search'` poza samym plikiem). Klasyczny dead-end z CLAUDE.md zasady #7.

**Fix**: jeden przycisk (ikona `Search`) w istniejącym rzędzie ikon nagłówka dashboardu
(`s.headerMinRow` w `index.tsx`, obok Smile/Hourglass/Layers/Trophy) → `router.push('/search')`.
Zero zmian w samym ekranie search — był już kompletny i poprawny.

Odpowiedź na pytanie usera "nie mamy już tego w ustawieniach?": wyszukiwarka W Ustawieniach
(`settingsSearch.ts`) i ta globalna to DWIE różne rzeczy — tamta szuka tylko opcji/przełączników,
ta nowa szuka w danych usera. Nie kolidują.

### 2. Lokalny licznik użycia ekranów ("statystyki apki")

User chciał coś "ala meta pixel" ale **zamkniętego obiegu — zero wysyłki gdziekolwiek**.
Zaimplementowana wersja jest ŚWIADOMIE lżejsza niż pełny click-stream (patrz rozmowa: pełne
śledzenie KAŻDEGO tapnięcia wymagałoby ręcznej instrumentacji ~35 ekranów, łatwo o dziury,
niewspółmierny koszt do zysku) — liczy **otwarcia ekranów**, nie pojedyncze kliknięcia.

**`src/utils/screenStats.ts`** — `screenInfoFor(pathname)`: normalizuje surowy pathname z
expo-router do stabilnego `screenId` + polskiej etykiety. Dynamiczne segmenty (id wydatku/
zadania/notatki) są ZWIJANE do `:id` (heurystyka: czysto liczbowy ≥6 znaków LUB alfanumeryczny
≥15 znaków) — inaczej store rósłby JEDNYM WPISEM NA KAŻDY otwarty rekord zamiast zostać
płaskim zbiorem dziesiątek ekranów. Nieznany segment dostaje fallback (capitalize +
myślnik→spacja), więc nowy ekran dodany później automatycznie ma sensowną etykietę bez
zmiany tego pliku — brak ryzyka kolejnego dead-endu.

**`src/store/usageStatsStore.ts`** — `{ screens: Record<screenId, { count, lastOpenedAt }> }`,
persist przez istniejący `throttledPersistStorage()`. Zapisywany z **JEDNEGO miejsca**:
`app/_layout.tsx`, `RootLayout` (komponent zamontowany przez całą sesję niezależnie od
ekranu) — `usePathname()` + `useEffect` wołający `recordOpen()` przy każdej zmianie
pathname. To (nie per-ekranowa instrumentacja) gwarantuje że KAŻDY obecny i przyszły ekran
jest liczony automatycznie.

**`src/components/settings/UsageStatsSection.tsx`** — nowa karta w Ustawienia → zaraz po
`BackupSection`, lista ekranów posortowana malejąco po liczbie otwarć + "ostatnio otwarty"
+ przycisk "Wyczyść statystyki". Jawny tekst w UI: dane TYLKO lokalnie, nigdzie nie
wysyłane; jeśli user chce mi je podesłać do analizy, jedzie to razem z resztą przez
ISTNIEJĄCY eksport JSON (`exportSnapshotToFile` już zbiera WSZYSTKIE klucze AsyncStorage,
więc `usage-stats-v1` ląduje w `config` automatycznie — zero dodatkowego eksportu do zrobienia).

**Zamknięty obieg, zweryfikowany**: żadna nowa zależność sieciowa, żaden nowy request —
tylko lokalny AsyncStorage. Koszt wydajnościowy: jeden throttlowany zapis PRZY NAWIGACJI
(rzadkie zdarzenie), nie przy każdym gescie — nieodczuwalne.

**Świadomie odłożone (z tej samej rozmowy, NIE zaczęte)**:
- Kody kreskowe/skaner produktów — user: "olewamy kody kreskowe" — odłożone całkowicie.
- Pytanie usera o "martwe/nieużywane skanowanie paragonów do usunięcia albo przebudowy" —
  NIE zinterpretowane i NIE ruszone — zbyt niejednoznaczne żeby zgadywać przy tak
  destrukcyjnej operacji (istniejący OCR-skan paragonów wygląda na aktywnie używaną,
  rozbudowaną funkcję wg całej historii ARCHITECTURE.md, nie na dead code) — do
  doprecyzowania z userem.

`tsc`/`jest` zielone (72 suit/940 testów, +6 nowych dla `screenInfoFor`). **Nie
zweryfikowane wizualnie na urządzeniu.**

**Priorytet testu na urządzeniu**: (1) Dashboard → ikona lupy w nagłówku → sprawdź że
`/search` się otwiera i faktycznie znajduje rzeczy po wpisaniu zapytania; (2) Ustawienia →
przewiń do nowej karty "Statystyki apki" → sprawdź że liczby rosną po odwiedzeniu kilku
zakładek i restarcie apki (persystencja); (3) sprawdź że apka NIE zwalnia zauważalnie przy
nawigacji (throttled zapis nie powinien być odczuwalny).

## 81. Usunięty martwy pipeline OCR paragonów (kamera + Google Vision) — potwierdzone jako dead code

User doprecyzował poprzednie pytanie: *"Aktualnie mamy parser txt, OCR nie jest podłączone
bo jest do dupy zle łapie tekst i produkty i będzie trzeba płacić i przechowywać zdjęcia
poza tym crahuje często"*. Sprawdzone grepem PRZED usunięciem, żeby nie zgadywać przy
destrukcyjnej operacji (patrz §80, gdzie odłożyłem to bez doprecyzowania):

- `src/services/ocrService.ts` (`extractTextFromImage`, wołanie Google Cloud Vision API,
  PŁATNE za request) miało **ZERO wywołań** gdziekolwiek w `app`/`src` — całkowicie
  osierocone, dokładnie jak user opisał.
- `app/expenses/scan.tsx` (jedyny AKTYWNY, używany flow dodawania paragonu) to WYŁĄCZNIE
  "Wklej paragon" — `TextInput` na wklejony tekst (np. z aplikacji Lidl/Biedronka), parsowany
  przez `receiptParser.ts`. Zero `expo-camera`/`ImagePicker`/przechwytywania zdjęcia
  gdziekolwiek w tym pliku ani w całej apce.
- `expo-camera` i `expo-image-picker` (biblioteki) miały ZERO importów w `app`/`src` —
  martwe zależności, prawdopodobnie zostawione po porzuceniu tej samej funkcji.
- `Expense.receiptImageUrl` (pole typu) nie było nigdzie ani ustawiane, ani czytane.
- `android.permission.CAMERA` i `android.permission.READ_MEDIA_IMAGES` w `app.json` nie
  miały już żadnego konsumenta — apka prosiła o dostęp do aparatu/galerii dla funkcji, która
  nie miała nawet przycisku w UI.

**Usunięte całkowicie** (nie przebudowane — user nie prosił o naprawę, tylko o
usunięcie/decyzję, a wersja z płatnym, zawodnym OCR i tak nie była tym czego chce):
`src/services/ocrService.ts`, `expo-camera`+`expo-image-picker` z `package.json` (+
`npm install` zaktualizował `package-lock.json`, usunięte 3 pakiety), `receiptImageUrl` z
`Expense`, oba permissiony z `app.json`.

**⚠️ Permissiony w `app.json` wymagają NOWEGO BUILDU APK, nie OTA** (CLAUDE.md zasada #2)
— usunięcie `CAMERA`/`READ_MEDIA_IMAGES` z manifestu nie zadziała przez zwykły update JS.
Do czasu nowego builda apka na telefonie nadal ma te uprawnienia zadeklarowane (nieszkodliwe,
po prostu nieużywane) — to nie jest pilne, ale warto uwzględnić przy najbliższym buildzie.

Świadomie NIE ruszone: `receiptParser.ts` i cały flow wklejania tekstu w `scan.tsx` —
DOKŁADNIE ta funkcja, o którą userowi chodziło jako "działająca", zero zmian.

`tsc`/`jest` zielone (72 suit/940 testów — bez zmian w liczbie, żaden test nie odnosił się
do usuniętego martwego kodu). **Nie zweryfikowane wizualnie na urządzeniu** (i tak nic
widocznego się nie zmienia poza usuniętym promptem o dostęp do aparatu przy NASTĘPNYM
buildzie APK).

**Priorytet testu na urządzeniu**: po najbliższym nowym buildzie APK — sprawdź że apka NIE
prosi już o dostęp do aparatu/galerii przy pierwszym uruchomieniu, i że wklejanie paragonu
(`/expenses/scan`) dalej działa bez zmian (to jedyna ścieżka, która ma teraz znaczenie).

## 82. Kotek nie nachodzi już na sloty ekwipunku + większa, epicka animacja otwierania skrzynki

### 1. Obszar głaskania pupila wchodził na sloty ekwipunku (`app/pet.tsx`)

User: *"Zrob zeb obszar głaskania pupila nie wchodził na itemy jakby albo itemy dajmy nad
nim jakby"*. Root cause zweryfikowany matematycznie przed poprawką: `CatArt` w `GearPanel`
dostawał STAŁY `size = STAGE_SIZE[stage] + 90` (150-214 + 90 = 240-304px, niezależnie od
szerokości ekranu), a `GearPanel.tsx` renderuje kotka w środkowej kolumnie (`catCol`,
`flex: 1`) MIĘDZY dwiema stałymi 68px kolumnami slotów (`flankCol`) — na typowym 360-412px
telefonie po odjęciu paddingu scrolla (`spacing[4]*2`=32) i obu `flankCol` (2×68=136)
zostaje ok. 190-245px na kotka, czyli WYRAŹNIE mniej niż 304px przy adult stage. `CatArt`
(i jego `Pressable`, czyli realny "obszar głaskania") nachodził więc fizycznie na oba
sąsiednie sloty.

**Fix u źródła** (nie łatanie z-indexem): nowy `catSize = Math.min(STAGE_SIZE[stage] + 90,
windowWidth - spacing[4]*2 - 68*2)` (`useWindowDimensions()`) — kotek nigdy nie może być
szerszy niż realnie dostępna przestrzeń w `catCol`, więc PO KONSTRUKCJI nie ma jak nachodzić
na flankujące sloty. Podstawiony w obu miejscach wołania `CatArt` w tym pliku (zwykły widok +
przyciemniony wariant gdy misja gotowa).

Świadomie NIE ruszone: `GearPanel.tsx` sam w sobie — layout (`flankRow`/`flankCol`/`catCol`)
był już poprawny (flex, nie absolute overlap); problem był WYŁĄCZNIE w nieograniczonym
`size` przekazywanym z `pet.tsx`.

### 2. Animacja otwierania skrzynki — powiększona + epickie przejście (`BoxRevealModal.tsx`)

User: *"Animacja otwierania skrzynki możemy ja powiększyć bo jest malutka i zrobic takie
epickie przejście po kliknięciu otworz do tego cesowego otwierania"*.

- **Skrzynka powiększona** 128×104 → 192×156 (+50%), emoji-fallback 48→68px, przycisk
  "Otwórz" proporcjonalnie większy.
- **Nowa faza `opening`** między `closed` i `spinning` (dotąd `doOpen()` przechodziło
  closed→spinning natychmiast, zero przejścia — user: "malutka"/"epickie przejście" to
  dokładnie ten brak przejścia). Dwuetapowa animacja (~480ms razem):
  1. Skrzynka trzęsie się (`shake`, oscylujący `translateX`) i "puchnie" (`openScale`→1.18)
     przez 260ms — ładowanie energii.
  2. Biały błysk (`flash`, rosnące koło 140px, opacity 0→1→0) NAKŁADA SIĘ z zapadaniem się
     skrzynki (`openScale`→0) przez 220ms — DOPIERO na końcu tego kroku buduje się reel i
     następuje `setPhase('spinning')`, więc reel "wyskakuje" z błysku zamiast się po prostu
     podmieniać. Dodatkowy `haptic.medium()` DOKŁADNIE na granicy trzęsienie→błysk (osobne
     wyczuwalne "uderzenie" w środku sekwencji, nie tylko na starcie).

`tsc`/`jest` zielone (72 suit/940 testów — bez nowych, czysto wizualne zmiany). **Nie
zweryfikowane wizualnie na urządzeniu** — priorytet #1 dla obu zmian w tym paragrafie.

**Priorytet testu na urządzeniu**: (1) Otwórz /pet na WĄSKIM telefonie z pupilem w
zaawansowanym stadium (adult) → sprawdź że dotyk blisko krawędzi kotka NIE trafia już w
slot ekwipunku i odwrotnie; (2) otwórz dowolną skrzynkę → sprawdź że skrzynka realnie
wygląda większa, i że kliknięcie "Otwórz" daje wyraźne poczucie "trzęsie się → błysk →
reel", nie nagłą podmianę.

## 83. Przegląd kondycji apki (na życzenie: "ogarniaj dalej szukaj optymalizuj i zapisuj")

User: *"Jak skończysz to ogarniaj dalej szukaj optymalizuj i zapisuj co mamy jak itp żebyś
potem jak poproszę o analizę itp co dodac to będziesz wiedział"*. Samodzielny przegląd bez
konkretnego zgłoszenia — poniżej co znalezione i (gdzie bezpieczne/jednoznaczne) od razu
naprawione, resztę zapisane do NEXT_STEPS.md jako materiał pod przyszłe "co dodać".

**Sprawdzone i CZYSTE** (żadna akcja nie potrzebna):
- Martwe pliki w `src/services/*` — zero (wszystkie mają importerów).
- Osierocone komponenty w `src/components/**/*.tsx` (poza `ui/`) — zero.
- Wzorzec ANR z CLAUDE.md #1 (`StyleSheet.create`/`makeStyles(c)` świeże w renderze, bez
  `useMemo` ani `themedStyles()`) — zero wystąpień. Style poza `useMemo`-em (kilka plików w
  `src/components/dashboard/`, `settings/`) są BEZPIECZNE — `themedStyles()` cache'uje
  wewnętrznie po referencji palety (`Map<Colors, T>`), więc `const s = makeS(c)` bez
  `useMemo` to tani lookup, nie świeży `StyleSheet.create`. Stylistyczna niespójność
  (część plików owija w `useMemo`, część nie), ale FUNKCJONALNIE nieszkodliwa — nic do
  poprawy.

**Znalezione i NAPRAWIONE od razu** (bezpieczne, ten sam sprawdzony przepis co wcześniejsze
downscale'e w tej sesji, zero zmian w kodzie — tylko binarki):
- **15 assetów ekwipunku/poitek nigdy nie przepuszczonych przez downscale** — 12 plików w
  `assets/ekwipunek/{obroza,kolczyki,talizman,helm}/` (1536×1024/1024×1536, oryginalny
  ChatGPT-owy rozmiar) + 3 w `assets/potki/` (1254×1254, jeszcze NIEWPIĘTE do kodu — potions
  używają emoji, nie PNG, na razie). Wszystkie renderowane (albo docelowo renderowane) jako
  małe ikony slotów (44-62px) — 1-2.5MB na plik było czystym marnotrawstwem. Przeskalowane
  tym samym przepisem co reszta `assets/ekwipunek/*` (PIL LANCZOS, dłuższy bok→300px,
  zachowany aspect ratio) — **27.0MB → 1.3MB (−25.8MB, −95.3%)**. Same nazwy plików/ścieżki
  (`require()` w kodzie bez zmian) — zero ryzyka regresji funkcjonalnej.

**Znalezione, ŚWIADOMIE NIE ruszone teraz** (zapisane do NEXT_STEPS.md, do decyzji z
userem):
- `src/utils/weeklyReports.ts` (247 linii, generator "raportu tygodniowego" — mood/tasks/
  expenses) ma **zero importerów** w całym `app`/`src`/`__tests__` — wygląda na porzuconą,
  wcześniejszą wersję tego co dziś robi `monthlyReports.ts` (TEN jest realnie używany, przez
  `exportAnalysis.ts` w eksporcie JSON). Nie usunięty teraz — w odróżnieniu od `ocrService.ts`
  (§81, user explicite potwierdził że to martwe), tu NIKT nie potwierdził że to naprawdę
  niepotrzebne — mogło czekać na dokończenie (własny ekran "Tydzień"?), nie tylko być
  zapomniane. Do zapytania: dokończyć (jaki UI?) czy usunąć.
- `assets/lokalizacje/LOKACJA_KAMPANIA.png` (1.25MB) i `assets/lokalizacje/TLOSKLEPIKARZ.png`
  (411KB) — też spore, ale to PEŁNOEKRANOWE tła (nie ikony), więc NIE zastosowany ten sam
  agresywny downscale (ryzyko widocznej utraty jakości na dużym tle). Gdyby jednak chcieć
  przyciąć — te dwa są kandydatami, ale wymagają osobnej, ostrożniejszej kalibracji (jaki
  docelowy rozmiar wystarczy na największy obsługiwany ekran) niż ikony.
- `assets/bossy/questy/osa_BOSSYuntitled.png` (321KB) i `BOSS_atakpazury_wilk.png` (373KB) —
  PIKSELOWO w normie (600×600/600×500, zgodnie z resztą folderu), tylko cięższe od sąsiadów
  o podobnym rozmiarze (najpewniej gorsza kompresja przy eksporcie). Próba re-save przez PIL
  `optimize=True` (bez resize) dała **0 bajtów oszczędności** — PIL-owy `optimize` to za
  mało, potrzebny byłby `pngquant`/`oxipng` (niedostępne w tym środowisku). Pominięte —
  niewielki potencjalny zysk (kilkaset KB) nie uzasadnia dociągania zewnętrznych narzędzi bez
  proszenia.

`tsc` czyste. Testy bez zmian (940, żadna z tych zmian nie dotyka logiki testowanej
jednostkowo — same binarki assetów). **Priorytet testu na urządzeniu**: NISKI — te ikony i
tak jeszcze się nie renderowały w rozmiarze który by pokazał różnicę jakości (44-62px), ale
warto rzucić okiem na ekwipunek w Rynku/Pupilu przy najbliższej sesji na telefonie, czy
któryś z przeskalowanych obrazków nie wygląda gorzej niż przed zmianą.

## 84. Sufit czerwonej energii per poziom pupila + podbita trudność raidu/eventu + niższe sprite'y w walce

User (odpowiedź na status-check z §82/§83, zrzut ekranu Bossów z "15/2"): *"Czerwona energia
raidowa (15/2) — bankuje się bez sufitu... tutaj zróbmy per level pupila po prostu
zaczynając od 1/1, kończąc na maksymalnie 4 stakach (w tym bosy te czerwone energii muszą
być o wiele trudniejsze względem realnych danych)"* oraz *"Obniżyć w sensie ich pozycje w
trakcie walki w wartości Y (bez ruszania ich paska zdrowaia ani tła) możemy na ten moiment
sróbować tak o 7px czy coś w dół"*.

**Root cause (energia).** `eventDailyAttempts` (sufit `eventEnergy`, czyli "czerwonej"
puli event/raid) był skalowany `energyMult` z łupu/gear — TRWAŁĄ inwestycją, nie progresją —
a `syncEventEnergy` w petStore.ts dolicza dzienną deltę do tej puli BEZ przycinania jej do
maxa (w odróżnieniu od energii kampanii, którą `energyRegenTick` twardo capuje). Efekt: bank
rósł tygodniami nieużywany, a wyświetlany "sufit" (z inwestycji w gear) nie miał z realnym
bankiem żadnego związku — stąd myląca pigułka "15/2".

**Fix.** `eventDailyAttempts` w `src/utils/bosses.ts` przyjmuje teraz `level` zamiast
`energyMult`, tierowane: Lv1-2→1, Lv3-5→2, Lv6-14→3, Lv15+→4 (`EVENT_MAX_DAILY_ATTEMPTS=4`,
usunięty `EVENT_BASE_DAILY_ATTEMPTS`). Progi reużywają JUŻ ISTNIEJĄCYCH kamieni milowych gry
(granica baby/kid `growthStage`=Lv3, kid/teen=Lv6, odblokowanie MAD=Lv15), żeby nie wymyślać
nowych. Oba wywołania w `app/bosses.tsx` (`eventEnergyMax` w headerze, `syncEventEnergy(...)`
w `reload()`) przełączone z `bonuses.energyMult` na `level` (już był w scope). `energyMult` z
łupu/gear NIE wpływa już na tę pulę (dalej wpływa na `dailyAttempts` kampanii, patrz
`campaignEnergyMax`) — świadome uproszczenie na życzenie usera, nie przeoczenie. Bank wciąż
jest TRWAŁY (nie resetuje się codziennie, patrz `syncEventEnergy`) — samo capowanie na maxie
to osobna sprawa, NIE zmieniona tutaj (user wybrał "zróbmy per level", nie "capuj nadmiar" —
implicit: sufit rośnie z levelem, więc problem "sufit nie ma związku z bankiem" znika sam
przez to że teraz sufit ZAWSZE odpowiada realnej progresji, nie inwestycji).

**Fix (trudność raidu/eventu).** Ponieważ Lv15+ dostaje teraz TWARDY sufit 4 prób/dzień
(wcześniej: miękki, zależny od inwestycji w gear, realnie rzadko maksowany), zaangażowany
gracz mógł kończyć tygodniowy raid/event szybciej niż zamierzone — stąd użytkownik zażądał
znacznie wyższej trudności obu torów zasilanych z tej puli:
- `raidHpFor` (raid.ts): `1000+level×210` → `1500+level×315` (×1.5). Bezpieczne dla balansu
  na kotku — to TYLKO rozmiar trwałej, tygodniowej puli (ile ciosów w SUMIE w ciągu tygodnia),
  a kontratak liczy się od OSOBNEGO, bezpiecznie skalowanego `raidCounterHpFor` (patrz
  komentarz w raid.ts) — podniesienie tej stałej wydłuża grind, nie podbija ryzyka na rundę.
  Znany, wcześniej udokumentowany kompromis (HP tylko od `level`, nie od
  `defeatedBosses.length`) zostaje bez zmian — osobna, większa naprawa, wciąż odłożona.
- `eventHpFor` (seasonalEvents.ts): `300+level×9` → `480+level×14` (×1.6). W ODRÓŻNIENIU od
  raidu, ta HP idzie WPROST do `counterDamage()` (walka round-based do 0 HP, jak kampania) —
  podbicie jej podbija RÓWNOCZEŚNIE liczbę potrzebnych ciosów I obrażenia z każdego
  kontrataku (ten sam kwadratowy mechanizm co przy `BOSSES`, patrz komentarz tam), więc ×1.6
  hp to realnie bliżej ~×2.5 całkowitego ryzyka walki — faktycznie "o wiele trudniejsze", nie
  kosmetyczna zmiana. Test-strażnik (`hitsNeeded` w `__tests__/seasonalEvents.test.ts`)
  zaktualizowany: górny próg 10→13, wciąż skończona, jednosesyjna walka. `menaceHpFor`
  (nemesis) NIE ruszony — nie korzysta z tej puli (nielimitowane próby, bez timera).

**Fix (pozycja sprite'ów).** `SPRITE_GROUND_SHIFT` w `app/boss-fight.tsx`: `14→21` (+7px,
dokładnie tyle ile user poprosił). Ta jedna stała przesuwa OBA sprite'y (kotek+boss) razem z
ich `GroundShadow` (transform na wspólnym boxie) — pasek HP i tło architektonicznie
odizolowane od tego transformu (osobne elementy poza `spriteBoxCat`/`spriteBoxBoss`), więc
"bez ruszania paska zdrowia ani tła" spełnione automatycznie. `projectile.top` już liczony
jako `91 + SPRITE_GROUND_SHIFT` (dynamicznie), więc podąża za zmianą bez osobnej edycji.
Cień pod łapkami (`GroundShadow.tsx`, czarna elipsa z miękkim blurem przez SVG
`RadialGradient`) już wcześniej pasował do specu usera ("cień w postaci kółka elipsy na
podłodze... w kol. czarnym z lekkim blurem") — zero zmian potrzebnych w samym komponencie.

**Explicite NIE zrobione**: pełna naprawa "raid/event HP powinno skalować się z REALNĄ mocą
gracza (defeatedBosses.length/bonuses), nie tylko `level`" — to głębsza, architektoniczna
zmiana (druga, niezależna oś progresji), już wcześniej świadomie odłożona (patrz komentarz
przy `raidHpFor` w raid.ts) i tu też pozostaje odłożona — user poprosił o "o wiele
trudniejsze", nie o pełny redesign formuły; ×1.5/×1.6 to wprost zmierzony, udokumentowany
bump, nie próba naprawienia znanego kompromisu przy okazji. `weeklyReports.ts` — user
explicite odpowiedział "raczej nie wiem", zostaje nietknięty.

`tsc --noEmit` czyste. `jest`: 72 suity/942 testy zielone (przepisany `eventDailyAttempts`
suite w `__tests__/bosses.test.ts` pod nowe tiery poziomowe, podniesiony próg w
`__tests__/seasonalEvents.test.ts`, `raid.test.ts` bez zmian — testował tylko relacje
względne, nie dokładne stałe).

**Priorytet testu na urządzeniu**: (1) Bossy → sprawdź że pigułka czerwonej energii w
headerze pokazuje sensowny "X/Y" zgodny z aktualnym poziomem pupila (1/1 na niskim
poziomie, do 4/4 po Lv15), nie znów rozjechane; (2) stocz raid/event na aktualnym poziomie i
oceń czy trudność faktycznie odczuwalnie wzrosła, ale wciąż wygrywalna; (3) dowolna walka
bossa (kampania/raid/event) → sprawdź czy kotek/boss stoją wizualnie niżej niż wcześniej
(bliżej cienia/podłogi), pasek HP i tło bez zmian pozycji.

## 85. Usunięto martwy `weeklyReports.ts`

User (szybka decyzja po pytaniu z §84): *"szybką decyzja wywalamy to weekly reports"*.

`src/utils/weeklyReports.ts` (247 linii, generator "raportu tygodniowego" — mood/tasks/
expenses, patrz §83) miał **zero importerów** w `app`/`src`/`__tests__` — porzucona,
wcześniejsza wersja tego co dziś realnie robi `monthlyReports.ts` (używany przez
`exportAnalysis.ts`). Usunięty w całości + wpis w tabeli Utilities w `SAPP_OVERVIEW.md`.
Zero konsumentów do zaktualizowania (stąd brak zmian poza samym plikiem i dokumentacją).

`tsc --noEmit`/`jest` czyste (72 suity/942 testy — bez zmian w testach, plik nie miał
własnego test suite). **Priorytet testu na urządzeniu**: brak — czysto martwy kod, zero
powierzchni do sprawdzenia.

## 86. Odznaka Stałe/Zmienne/Jedzenie na KAŻDYM wydatku (audyt klasyfikacji z listy)

User: *"ulepsz oznaczanie żebym mógł jano widzieć na wydatkach co jest jedzeniem co jest
nie jedzeniem co stałym wydatkiem a co zmiennym zeby widzieć czy dobrze łapie"*.

**Root cause.** `bucketOf()` (`fixedVariable.ts`, patrz §77) i ręczna korekta `fvOverride`
już istniały, ale były dostępne WYŁĄCZNIE przez rozbicie miesięczne widgetu "Na co idą
pieniądze" na dashboardzie (`FvBreakdownModal`) — audyt "czy dobrze łapie" wymagał
otwierania osobnego modala per miesiąc/kubeł zamiast po prostu przewijania głównej listy
transakcji w Finansach.

**Fix.** `ExpenseItem.tsx` — nowa odznaka pod tytułem/podtytułem KAŻDEGO wydatku (nie
przychodu, nie self-transferu — patrz niżej): kropka + etykieta ("Stałe"/"Zmienne"/
"Jedzenie") w tych samych kolorach co pasek widgetu (`fixedC`=#8893A8/`foodC`=#4CA96B z
`FixedVariableSection.tsx`, `variable` dostaje nowy fiolet #BF80FF, żaden inny akcent na
liście go dziś nie zajmuje). Ikonka ołówka obok odznaki gdy `fvOverride` jest ustawiony
(ten sam symbol co w `FvBreakdownModal`). Odznaka jest TAPPABLE — otwiera inline 2
pozostałe kubły + "Auto" (reset override, tylko gdy nadpisany) bez opuszczania listy ani
otwierania modala — ten sam wzorzec korekty co dashboard (`onReclassify` → optymistyczny
local update przez `useExpensesStore.setExpenses` + `expensesService.update(id,
{fvOverride})` w tle, błąd → toast + haptic, bez rollbacku UI bo Firestore i tak nie
został nadpisany). Handler `reclassifyExpense` w `finances.tsx` to niemal 1:1 kopia
`reclassifyFvExpense` z dashboardu (index.tsx) — świadomie NIE wydzielony do wspólnego
helpera (mała, self-contained logika w 2 miejscach; ekstrakcja na żądanie gdy pojawi się
trzecie miejsce, zgodnie z zasadą "trzy podobne linijki > przedwczesna abstrakcja").

**Self-transfer guard.** `bucket = null` dla przychodów (bucketOf() nie ma dla nich sensu)
ORAZ dla self-transferów (`isSelfTransfer()`, oszczędności/Revolut) — te są jawnie
wykluczone ze WSZYSTKICH trzech kubłów w każdej funkcji `fixedVariable.ts`, więc pokazanie
im gołego wyniku `bucketOf()` (zawsze 'variable' przez fallback, bo self-transfer nie jest
ani `isFixedExpense` ani `groceries`) wyglądałoby jak dokładnie ten błąd klasyfikacji,
który ta odznaka ma pomóc wyłapać — pominięta zamiast mylić.

**Explicite NIE zrobione**: żadna zmiana w samej heurystyce `bucketOf()`/`isFixedExpense()`
— to czysto interfejs do AUDYTU istniejącej logiki, nie jej przeprojektowanie. Jeśli po
przejrzeniu listy user znajdzie systematyczny błąd heurystyki (nie pojedynczy wyjątek do
`fvOverride`), to osobna, następna zmiana.

`tsc --noEmit`/`jest` czyste (72 suity/942 testy — `bucketOf()` ma już własne pokrycie w
`fixedVariable.test.ts`, nowy UI nie ma testów jednostkowych — projekt nie testuje
komponentów RN, tylko czystą logikę, zgodnie z ustalonym wzorcem). **Priorytet testu na
urządzeniu**: przewiń listę Finansów i sprawdź (1) czy odznaki faktycznie zgadzają się z
oczekiwaniami (to właśnie audyt, którego chciał user), (2) czy tap na odznakę poprawnie
otwiera/zamyka inline wybór bez przypadkowego odpalenia nawigacji do szczegółów wydatku
(zagnieżdżony `TouchableOpacity` w `PressableScale` — ten sam, już działający wzorzec co
istniejący `chevronBtn` w tym samym komponencie, ale warto potwierdzić na żywym telefonie).

## 87. Sklep: gradientowa nazwa itemu (naprawa realnie ucinanego tytułu) + aura rzadkości + większe itemy + podpięte potki + usunięty nietrafiony podpis

User (zrzut ekranu podglądu "Zwinne Buty Skauta"): *"Tutaj nadal nie zrobiłeś zeby ten
gradient nie przykrywał nazwy :( i sam kolor nazwy miał byc gradientem i rzadkość itemow
miała miec w sklepie tez gradient dookoła blurowany"*, plus (mid-turn, zrzut całego ekranu
Sklepu): *"2. Potem powiekszmy itemy w sklepie troche bo sa za małe... sprawdz czy nie
wrzuciłem potek do assets bossy pamiętam ze dodawałem a nie ma. 3. Usuń ten napis pod
grafika tam pod sklepem calym bez sensu tam on"*.

**Root cause (gradient przykrywa nazwę — POWRÓT buga z §73e).** §73e (2026-08-?) diagnozował
DOKŁADNIE ten sam objaw ("Kamizelka... jakby był za horyzontem") jako pogrubiony RN `<Text>`
malujący się na Androidzie POZA swoim wyliczonym boxem (metryki fontu przy wadze 800), i
"naprawił" go samym `lineHeight: 22` — **nie zweryfikowane wtedy na urządzeniu** (środowisko
bez podglądu RN). Ten zrzut dowodzi, że `lineHeight` na zwykłym `<Text>` NIE rozwiązuje
problemu — Android nadal maluje tekst z nieprzewidywalnym realnym boxem niezależnie od
deklarowanego `lineHeight`, więc `rarityUnderline` (kolejny element w tej samej kolumnie,
malowany PO tytule) nadal zaczynał się wewnątrz realnych liter.

**Fix — realny, nie łatka na objaw.** Nazwa itemu przeniesiona z RN `<Text>` na PRAWDZIWE
SVG (`src/components/ui/GradientText.tsx`, nowy, generyczny komponent, ten sam wzorzec co
już istniejący `GradientGreeting.tsx` z dashboardu — `Svg`/`Defs`/`LinearGradient`/`Text`
z `react-native-svg`, ZERO nowej natywnej zależności). SVG `<Text>` ma JAWNY, przewidywalny
atrybut `y` (baseline) — żadnych ukrytych metryk fontu specyficznych dla platformy jak przy
RN `<Text>`, więc box faktycznie odpowiada temu co się rysuje i `rarityUnderline` (dalej
zwykły `<LinearGradient>` z expo, `marginTop` podbite 5→8 na dodatkowy oddech) ma
gwarantowane miejsce. Fit-scale dla długich nazw (>22 znaków, np. "Talizman Spadającej
Gwiazdy" — 28 znaków, najdłuższa w `gear.ts`) — SVG text nie zawija/nie skraca się jak RN
`numberOfLines`, więc bez tego długie nazwy wystawałyby poza dostępną szerokość.

**Fix — gradientowy KOLOR nazwy** (drugi, osobny punkt tej samej wiadomości): `GradientText`
przyjmuje `color` (tu `meta.color`, kolor rzadkości) i renderuje gradient kolor→biel, ten
sam kierunek/koncept co istniejąca kreska pod spodem — nazwa i kreska teraz spójnie "świecą"
w kolorze rzadkości.

**Fix — aura rzadkości w siatce Sklepu dnia** (trzeci punkt): drugi, WIĘKSZY `RadialGlow`
(już istniejący komponent — prawdziwy SVG radial-gradient, dokładnie "gradient dookoła
blurowany") w `meta.color`, renderowany PRZED (czyli POD w z-order) istniejącym czarnym
cieniem kontrastowym każdego z 4 itemów Sklepu dnia (`size={64}, opacity={0.4}` vs czarny
`size={40}, opacity={0.55}`) — czarny cień zostaje na wierzchu blisko ikony (kontrast na tle
lady), kolorowa poświata rzadkości rozlewa się szerzej dookoła. Zero nowego komponentu —
`RadialGlow` już dokładnie to robi (użyty tak wcześniej za bossami/sklepikarzem/skrzynkami).

**Fix — powiększone itemy**: `artSlotImg` 62%→74%, `boxSlotImg` 68%→78%. Sam `artSlot`
(procentowy prostokąt z `rynekArt.ts`, przypięty do okien narysowanych na obrazku lady/
tablicy) BEZ ZMIAN — rośnie tylko ikona W ŚRODKU, więc hitbox/pozycja slotu względem
grafiki tła nie rusza się.

**Fix — potki wreszcie podpięte**: user pytał czy wrzucił grafiki potek do `assets/bossy` —
NIE (sprawdzone: `assets/bossy/*` to wyłącznie art bossów, zero plików potek) — grafiki
(`potka_atak.png`/`potka_xp.png`/`potka_zdrowie.png`) faktycznie leżą w `assets/potki/`
(poprawne miejsce, już przeskalowane 1254²→300² w §83), tylko NIGDY nie zostały podpięte do
UI (`POTION_ICON` w `pet-shop.tsx` był świadomym lucide-placeholderem z 2026-09-08, "user sam
dostarczy grafiki... na razie lucide"). Nowy `POTION_ICON` (teraz w `src/utils/potions.ts`,
`require()`) zastępuje placeholder — 3 sloty potek na tablicy renderują teraz własne grafiki
zamiast ikon lucide (HeartPulse/Swords/Sparkles, usunięte z importów).

**Fix — usunięty nietrafiony podpis**: `<Text style={s.hint}>Monety: questy...</Text>` pod
całą sceną Sklepu usunięty razem z martwym stylem `hint` — user: "bez sensu tam on", żadnej
dalszej logiki nie dotyczy (czysto opisowy tekst).

`tsc --noEmit`/`jest` czyste (72 suity/942 testy — czysto wizualne zmiany + podpięcie
istniejących assetów, zero nowej logiki do testowania jednostkowo).

**Priorytet testu na urządzeniu — NAJWYŻSZY z całej sesji** (to DRUGA próba naprawy tego
samego buga z gradientem, pierwsza nie przeszła realnego testu): (1) otwórz podgląd
DOWOLNEGO itemu w Sklepie dnia → sprawdź że gradient POD nazwą faktycznie NIE dotyka liter,
zwłaszcza przy NAJDŁUŻSZYCH nazwach (Talizman Spadającej Gwiazdy, Talizman
Nieskończoności) — fit-scale może potrzebować dostrojenia progu/współczynnika; (2) sprawdź
że sama nazwa czytelnie przechodzi z koloru rzadkości w biel, nie wygląda na "zepsutą"
czcionkę (SVG font-family może domyślnie różnić się nieznacznie od RN Text — brak jawnego
`fontFamily` w `GradientText`, dziedziczy systemowy default); (3) zerknij na 4 itemy Sklepu
dnia — kolorowa poświata rzadkości powinna być widoczna, ale NIE przytłaczać czarnego cienia
kontrastowego; (4) sprawdź że powiększone ikony (74%/78%) nie wystają poza narysowane okna
na obrazku lady na węższych telefonach; (5) potki na tablicy — własne grafiki zamiast
ikon lucide.

## 88. Stałe/Zmienne/Jedzenie: rozbicie mieszanego paragonu PER PRODUKT (reużycie mechanizmu "nie jedzenie")

User: *"A co do stałych zmiennych muszę miec opcje zaznaczenia edytowania co jest stała a
co zmienna, tak jak w jedzeniu moge zaznaczyć ze to nie jedzenie każdego produktu osobno
(tak jest teraz)"*.

**Root cause.** `bucketOf(e)` (§77/§86) klasyfikował CAŁY wydatek do JEDNEGO kubła po
samej kategorii (`e.category === 'groceries' → 'food'`) — ślepy na to, że pojedynczy
paragon spożywczy realnie bywa MIESZANY (chleb + proszek do prania + kosmetyki), a
dokładnie TA sama sytuacja dla "jedzenie/nie jedzenie" ma już od dawna precyzyjne,
PER-PRODUKTOWE rozwiązanie: `toggleItemFood`/pigułka "jedzenie / nie jedz." na każdej
pozycji paragonu (`app/expenses/[id].tsx`) + `foodAmountOf()` (`food.ts`), które sumuje
TYLKO linie oznaczone jako jedzenie. Kubły Stałe/Zmienne/Jedzenie po prostu z tego nie
korzystały — całość paragonu wpadała w jeden kubeł, myląc "ile realnie wydaję na
jedzenie" vs "na resztę zakupów przy okazji".

**Fix — reużycie istniejącego mechanizmu, ZERO nowego UI do budowania.** Nowa
`fvSplitOf(e): {fixed, variable, food}` w `fixedVariable.ts` — dla zwykłych zakupów
(bez `fvOverride`, nie rozpoznany rachunek stały) liczy `food = foodAmountOf(e)` (już
istniejące, per-produktowe) i resztę (`e.amount - food`) wrzuca do `variable`. Efekt:
oznaczenie POJEDYNCZEGO produktu jako "nie jedzenie" w edytorze paragonu (mechanizm z
pytania usera — "tak jest teraz") TERAZ AUTOMATYCZNIE przesuwa jego udział z kubła
Jedzenie do Zmienne we WSZYSTKICH miejscach liczących te kubły — dokładnie ta sama
kontrola co user już zna i używa, żadnego nowego przełącznika do nauczenia się.
`fvOverride` (ręczna korekta CAŁEGO wydatku, badge na liście z §86) i rozpoznany rachunek
stały (`isFixedExpense`) mają pierwszeństwo i idą w 100% do jednego kubła — rozbicie
dotyczy tylko zwykłych zakupów.

**Zaktualizowane funkcje** (wszystkie w `fixedVariable.ts`, wszystkie teraz przez
`fvSplitOf` zamiast `bucketOf`+całe `e.amount`): `fixedVariableMonths` (sumuje OBA kubły
z jednego mieszanego wydatku naraz), `fixedBreakdown`, `topVariableContributors`,
`bucketTransactions` (mieszany paragon może teraz pojawić się w OBU zakładkach rozbicia
widgetu "Na co idą pieniądze" — Jedzenie i Zmienne — każda tylko ze SWOJĄ częścią kwoty,
nie z całą). `bucketOf(e)` (pojedyncza etykieta, dalej używana tam gdzie nie ma miejsca na
dwie) zostaje jako POCHODNA `fvSplitOf` — dla mieszanego wydatku zwraca dominujący
(większy udziałem) kubeł, nie osobną heurystykę.

**Odznaka na liście (`ExpenseItem.tsx`, §86)** — dla mieszanego paragonu (jedzenie I
zmienne oba >0) pokazuje TERAZ OBIE etykiety naraz ("● Jedzenie + ● Zmienne") zamiast
jednej potencjalnie mylącej. Tap dalej otwiera inline korektę `fvOverride` (kolapsuje
naturalny podział w JEDEN wybrany kubeł — świadomy wyjątek "chcę to policzyć inaczej",
nie próba budowania osobnego per-produktowego edytora dla stałe/zmienne, bo taki JUŻ
ISTNIEJE dla jedzenia i został tu podłączony zamiast duplikowany).

**Explicite NIE zrobione**: żaden nowy przełącznik/UI per-produktowy dla stałe/zmienne —
to była literalna prośba usera ("muszę mieć opcje zaznaczenia"), ale okazało się że
DOKŁADNIE ten mechanizm już istnieje (food/nie-jedzenie) i wystarczyło go PODŁĄCZYĆ do
klasyfikacji fv zamiast budować drugi, równoległy. "Stałe" per-produkt nie ma sensu
(rachunki nie mają pozycji paragonu) — rozbicie dotyczy wyłącznie jedzenie↔zmienne.

`tsc --noEmit` czyste. `jest`: 72 suity/950 testów (+8 nowych w `fixedVariable.test.ts`:
paragon bez pozycji zachowuje stare zachowanie, mieszany paragon dzieli proporcjonalnie,
oznaczenie "nie jedzenie" przesuwa udział, `fvOverride` wygrywa nawet z mieszanym
paragonem, rachunek stały ignoruje pozycje, `bucketOf` na mieszanym zwraca dominujący,
`fixedVariableMonths`/`bucketTransactions` poprawnie dzielą JEDEN wydatek na dwa kubły).

**Priorytet testu na urządzeniu**: (1) paragon spożywczy z produktem oznaczonym "nie
jedzenie" → sprawdź że lista pokazuje odznakę "Jedzenie + Zmienne" zamiast samego
"Jedzenie"; (2) widget "Na co idą pieniądze" → rozbicie miesięczne → sprawdź że TEN SAM
paragon pojawia się w obu zakładkach (Jedzenie/Zmienne) z podzieloną kwotą, sumującą się
do pełnej kwoty paragonu; (3) oznacz produkt "nie jedzenie"/z powrotem "jedzenie" w
edytorze paragonu → sprawdź że kwoty w widgecie i na liście przeliczają się od razu po
zapisie (bez potrzeby zamykania/otwierania ekranu).

## 89. Naprawiony nierozokraglony Max HP + powiększony reel skrzynki (min. +50%)

User (zrzut ekranu Pupila): *"Zdrowie buguje sie jakby kiedyś HP i sie nie zaokragla"*
(pokazane: "Max HP kotka: 397.9813491557909"), plus (zrzut sklepu z reelem otwierania
skrzynki): *"Tak animacja jest za mała powieksz ja o 50 prc minimum"*.

**Fix 1 — nierozokraglone Max HP.** `gearFlatHp()` (`gear.ts`) zwraca `owned.value` —
WYLOSOWANY roll zbroi ze skrzynki (ciągły ułamek, nigdy nie był całkowity). `effectiveCatMaxHp`
(`petStore.ts`) — JEDYNE wspólne miejsce liczące sufit HP dla wyświetlania ORAZ walki
(damageCat/healCat/resetCatHp) — sumowało ten ułamek z resztą bez zaokrąglenia wyniku,
więc "397.9813491557909" wyciekało wprost na ekran Pupila. Naprawa: `Math.round()` na
KOŃCU `effectiveCatMaxHp` — jedno miejsce, wszyscy konsumenci (wyświetlanie w pet.tsx,
walka w boss-fight.tsx) dostają teraz spójną liczbę całkowitą, bez dotykania samych
wylosowanych `owned.value` w `ownedGear` (i tak tylko surowe wejście do tej formuły).

**Fix 2 — reel otwierania skrzynki za mały.** `BoxRevealModal.tsx`'s reel (case-opening
pasek ikon z §82) — `REEL_ITEM_W` (rozmiar komórki) 78→120 (+54%), wysokość okna 92→138
(+50%), obrazek ikony 44→66, emoji-fallback 30→45, grot/pasek wskaźnika proporcjonalnie
większe. `REEL_WINDOW_W` (widoczne okno, dawniej sztywna stała 264) przestało być stałą —
sztywne ×1.5 (396) przelewałoby się poza wąskie telefony (Xiaomi/starsze Samsungi ~360dp
szerokości, temat portabilności zapowiedziany wcześniej w tej rozmowie), więc TERAZ liczone
z `useWindowDimensions()` wewnątrz komponentu (`Math.min(400, winW - 48)`) — ten sam wzorzec
co `catSize` w `pet.tsx` (§82). Matematyka lądowania (`finalX` w `doOpen()`) przeliczona na
tę zmienną zamiast stałej — reszta (REEL_LENGTH/REEL_TARGET_INDEX, indeksy komórek) bez
zmian, bo nie zależy od pikseli.

**Explicite NIE zrobione**: żadna migracja/przeliczenie już zapisanych `owned.value` w
istniejących save'ach userów — ułamkowe rolle zostają jak są w danych, tylko WYŚWIETLANY/
BOJOWY sufit HP jest teraz zawsze całkowity niezależnie od tego jak "brzydki" jest surowy roll.

`tsc --noEmit` czyste. `jest`: 72 suity/952 testy (+2 nowe w `potions.test.ts`:
`effectiveCatMaxHp` zaokrągla ułamkowy roll zbroi, i regresja że całkowite wartości
zostają całkowite). Reel: brak testów jednostkowych (czysto wizualna zmiana rozmiaru/
responsywności, bez nowej logiki liczącej co innego niż wcześniej).

**Priorytet testu na urządzeniu**: (1) ekran Pupil → Max HP kotka pokazuje teraz liczbę
całkowitą, bez dziesiętnych; (2) otwórz dowolną skrzynkę → reel wyraźnie większy (ikony
czytelne w locie, nie tylko po zatrzymaniu), i NIE wystaje poza ekran na węższym telefonie
(jeśli user ma dostęp do węższego urządzenia do testu — na szerszym telefonie okno
osiągnie pełny sufit 400px).

## 90. TopPill: zadania bez terminu przestają wiecznie świecić + kanał "flash" na powiadomienia (seria logowań, auto-płatność z banku)

User: *"za często tam sie pokazuje ze mam zadanie wiem ze mam zadanie jedno ale ono nie ma
terminu i świeci mi sie na dole bez sensu jeszcze w pillu to, a dodatkowo niech moze tam si
epokazuja te powiadomienia ze sie pill lekko rozszerza i jest napisane ze seria logowan,
albo ze dodano płatność automatyczna czy cos nie wiem"*.

**Fix 1 — zadanie bez terminu wiecznie w rotacji.** Ostatni fallback kandydat LUŹNEJ puli
(`TopPill.tsx`) liczył WSZYSTKIE `status !== 'done'` zadania, niezależnie czy mają termin.
Zadanie bez `deadline`/`scheduledDate` nie ma ŻADNEGO mechanizmu który by je "rozwiązał"
(priorytety 4/4b/7 wyżej już WYMAGAJĄ terminu z tego samego powodu), więc taki kandydat
istniał w puli NA ZAWSZE, pojawiając się co `CALM_ROTATE_MS` (8s) w nieskończoność — dokładnie
"bez sensu świeci się" ze zgłoszenia. Filtr `t.deadline || t.scheduledDate` ujednolica ten
fallback z resztą pliku; zadanie bez terminu po prostu nigdy nie trafia do pilla (co jest OK
— brak terminu = brak pilności z definicji), reszta kandydatów (misja/energia bossów/
nastrój/"wszystko ogarnięte") przejmuje slot normalnie.

**Fix 2 — kanał "flash" na powiadomienia.** Drugi punkt zgłoszenia opisywał DOKŁADNIE dwa
JUŻ ISTNIEJĄCE `toast.success(...)` w kodzie (potwierdzone grep-em, nie zgadywane): "seria
logowań" = `registerLogin()` w `app/(tabs)/index.tsx` ("Seria logowań: X dni 🔥 +Y monet"),
"dodano płatność automatyczna" = `processAutoBankQueue()` w `bankAutoProcess.ts` ("Auto-
dodano płatność z banku..."). Toast znika po ~2.6s (`Toast.tsx`) i łatwo go przegapić —
`TopPill` żyje na stałe w tab-barze, więc jest dużo bardziej "na oku". Nowy
`pillFlashStore.ts` — mały, generyczny Zustand store (`show(text, {badge, color,
durationMs})` / `clear()`), NIE zastępuje toastu (oba kanały strzelają naraz, świadomie —
mniej ryzykowne niż usuwanie istniejącego, sprawdzonego UX) tylko go DUBLUJE w pillu.
`TopPill.tsx` sprawdza aktywny flash jako priorytet 0 — PRZED pomodoro/live-earnings, bo to
"rzeczy które user chce zobaczyć od razu", z auto-zniknięciem DOKŁADNIE po `expiresAt`
(osobny `setTimeout`, nie czeka na `calmTick` który i tak tyka niezależnie co 8s). Tap na
flash = zamknij od razu (`usePillFlash.getState().clear()`) — brak naturalnego miejsca
docelowego dla czysto informacyjnego komunikatu. Animacja "pill lekko rozszerza się" =
ISTNIEJĄCY "pop" na zmianę `key` (shrink-out → spring-in), żadnej nowej animacji do
budowania — flash to po prostu kolejny `PillItem` z inną `key`.

**Explicite NIE zrobione**: żadnych innych zdarzeń NIE podłączonych do flasha poza tymi
dwoma dokładnie wymienionymi przez usera (np. odblokowanie osiągnięcia ma już własny,
dedykowany modal `BadgeCelebration.tsx` — dublowanie go w pillu byłoby nadmiarowe, nie
dołożone). `pillFlashStore` jest generyczny i gotowy na więcej wywołań `show(...)` w
przyszłości, jeśli user zechce rozszerzyć listę po zobaczeniu jak to działa.

`tsc --noEmit` czyste. `jest`: 72 suity/952 testy (bez nowych — `pillFlashStore.ts` to
trywialny store bez własnej logiki do testowania, ten sam brak testów co istniejący
`toastStore.ts`; `TopPill.tsx` nie ma testów jednostkowych, projekt nie testuje komponentów
RN, patrz ustalony wzorzec).

**Priorytet testu na urządzeniu**: (1) zadanie bez terminu → pill NIE powinien już go
pokazywać w ogóle (sprawdź że reszta rotacji — luz/misja/etc. — normalnie działa zamiast
tego); (2) otwórz apkę pierwszy raz danego dnia → pigułka "SERIA LOGOWAŃ" powinna mignąć
na kilka sekund NAD czymkolwiek innym, potem wrócić do normalnej rotacji; (3) jeśli masz
zaufany automat bankowy — poczekaj na auto-dodaną płatność i sprawdź czy flash się pojawia
razem z toastem, nie zamiast niego.

## 91. Pill bez "bouncy ball", przelew własny po imieniu+nazwisku, plakietki Stałe/Zmienne przeniesione do szczegółów

User (2026-09-13, trzy punkty jednym zgłoszeniem): *"I zeby ta animacja przejścia pomiędzy
wiadomościami byla płynnym rozszerzeniem i zmiana tekstu z fajna animacja, bo tak to wygląda
jak bouncy ball hujnia xd"*, *"W stalch / zmiennych jak mi dałeś wybór zaznaczenia co to jest
za wydatek to tez trzeba dodać kategorie przelew własny jak jest do Wiktor Rudziński...
to znaczy ze to przelew wewnętrzny do mnie samego i to nie zalicza sie do wydatków lub
przychodów"*, *"I te stale /zmienne tagi w finansach na głównej możesz dać dopiero po
kliknieciu w szczegóły (bo dzwinie zaburza mi to bez sensu tam kafelki)"*.

**Część 1 — pill bez odbicia.** `Animated.spring(scale, {damping, stiffness, mass})` w
`TopPill.tsx` (3 miejsca: item→null, zmiana `key`, idle-refresh tego samego `key`) z natury
PRZESTRZELIWUJE cel przed ustabilizowaniem — to dokładnie "bouncy ball" ze zgłoszenia.
Zamienione wszystkie trzy na `Animated.timing(..., {easing: Easing.out(Easing.cubic)})` —
monotoniczne dojście do wartości docelowej, bez przestrzelenia; skala "wciśnięcia" złagodzona
0.88/0.9 → 0.94 (mniej agresywny "schowaj się" przy przejściu).

**Część 2 — przelew własny po imieniu.** Dotychczasowy `selfTransfer` w
`bankNotification.ts` łapał tylko słowa-klucze (`revolut|oszczędno|własne|savings`) — nie
łapał przelewu na DRUGIE własne konto zwykłym przelewem krajowym, bo tam `odbiorca:` to po
prostu imię+nazwisko właściciela, bez żadnego słowa-klucza. Nowy moduł `ownName.ts`
(dokładnie wzorzec cache'u `food.ts`/`userNonFood`: `loadOwnName()` raz w `app/_layout.tsx`,
potem czysty synchroniczny `getOwnName()`) trzyma zadeklarowane w Ustawieniach imię+nazwisko
(`AsyncStorage`, pole tekstowe w sekcji "Auto-wydatki z banku", widoczne tylko gdy
`bankEnabled`). `parseBankNotification(title, text, ownName?)` dostał trzeci, opcjonalny
argument — `selfTransfer` teraz dodatkowo prawdziwy gdy znormalizowany `odbiorca` ZAWIERA
znormalizowane `ownName` (diakrytyki i wielkość liter ignorowane, helper zduplikowany
LOKALNIE w `bankNotification.ts` zamiast importu z `ownName.ts`, bo ten plik musi zostać
wolny od `AsyncStorage` — patrz zasada "lean" dla plików testowanych bezpośrednio przez
Jest). `bankIngest.ts` przekazuje `getOwnName()` jako trzeci argument; downstream (booking
jako `category: 'transfer', tags: ['revolut']`, rozpoznawanie przez `isSelfTransfer()`) bez
zmian — to ten sam istniejący pipeline co dla Revolut/oszczędności. Przykład "Wiktor
Rudziński" z prośby usera NIE jest przypadkowy — dokładnie ten string już wcześniej istniał
jako realny przykład w komentarzu dokumentującym regex `odbiorca:` w `bankNotification.ts`,
co potwierdziło wykonalność PRZED napisaniem kodu.

**Część 3 — plakietki Stałe/Zmienne/Jedzenie z listy do szczegółów.** Plakietka (kropka +
etykieta, tap → chipsy do ręcznej zmiany kubełka) wyekstrahowana z `ExpenseItem.tsx` do
samodzielnego `FvBadge.tsx` (jeden konsument na razie — `app/expenses/[id].tsx` — ale
ekstrakcja i tak uzasadniona jasnością: inny layout kolorystyczny na gradiencie karty-hero
niż wcześniej na tle listy). `ExpenseItem.tsx`/`finances.tsx` wrócone funkcjonalnie do stanu
sprzed §77/§?? (żadnej plakietki w wierszu listy — usera "dzwinie zaburza" chodziło o
migotanie/przeskakiwanie wysokości kafelków przy re-renderach listy). Ekran szczegółów
liczy `fvSplitOf`/`bucketOf` raz przy renderze (pomijając przelewy własne i przychody —
te nie mają sensownego kubełka Stałe/Zmienne) i renderuje `FvBadge` w karcie kwoty, pod
datą, z tym samym handlerem `reclassifyFv` co poprzednio (`updateExpense` lokalnie +
`expensesService.update` do trwałego zapisu).

**Explicite NIE zrobione**: (2) UI podglądu "na żywo" pokazującego dopasowanie w Ustawieniach
podczas wpisywania imienia — `matchesOwnName`/`normalizeName` z `ownName.ts` zostają
eksportowane i gotowe, ale niewykorzystane poza samym parserem; (2) obsługa wielu własnych
kont pod różnymi nazwiskami (np. konto współmałżonka) — jedno pole, jedna nazwa; (3) żadna
migracja/inny UI dla kubełka na liście — usunięty całkowicie, widoczny wyłącznie po wejściu
w szczegóły, zgodnie z dosłowną prośbą.

`tsc --noEmit` czyste. `jest`: 72 suity/955 testów (+3 nowe w `bankNotification.test.ts`:
przelew do osoby o Twoim imieniu BEZ skonfigurowanego `ownName` → nie selfTransfer; z
pasującym `ownName` → selfTransfer; z niepasującym `ownName` → nadal nie selfTransfer, czyli
brak zgadywania na siłę). `TopPill.tsx`/`FvBadge.tsx`/ekran szczegółów bez testów
jednostkowych — czysto wizualne zmiany animacji/layoutu, projekt nie testuje komponentów RN
(ustalony wzorzec).

**Priorytet testu na urządzeniu**: (1) obserwuj pill przy zmianie komunikatu (np. flash z
§90 → normalna rotacja) — powinno wyglądać jak płynne rozszerzenie z podmianą tekstu, bez
"odbicia"; (2) Ustawienia → Auto-wydatki z banku → wpisz swoje imię+nazwisko, potem zrób
(albo poczekaj na) przelew na drugie własne konto zwykłym przelewem (nie Revolut) → powinien
wejść do kolejki jako "odłożone", nie jako wydatek; (3) otwórz dowolny wydatek → plakietka
Stałe/Zmienne/Jedzenie widoczna w karcie kwoty, tap otwiera chipsy do zmiany; sprawdź że w
głównej liście Finansów żadnej plakietki już nie ma i kafelki nie migają wysokością.

## 92. Ręczny przełącznik "Przelew własny" na ekranie szczegółów wydatku/przychodu

User (po pytaniu czy działa auto-wykrywanie z §91): *"mam opcje dosac własną kategorie
jakby?? Czyli właśnie ten przelew wlasny? Który sie nie wlicza bo to do siebie na inne
konto wysyłam"*.

**Problem.** Do tej pory JEDYNA droga do oznaczenia transakcji jako self-transfer to
auto-wykrycie w `parseBankNotification` (słowa-klucze Revolut/oszczędności, albo — od §91 —
dopasowanie zadeklarowanego imienia+nazwiska). Ręcznie dodany wydatek/przychód (nie z banku)
albo taki, gdzie parser się nie złapał, nie miał ŻADNEJ opcji — user pytał wprost o
możliwość ręcznego oznaczenia.

**Fix — zero nowej logiki klasyfikującej, tylko brakujący manualny dostęp.**
`isSelfTransfer()` (statWidgets.ts) już rozpoznaje tag `'przelew'` (jest w
`SELF_TRANSFER_TAGS` od dawna — używany dotąd tylko jako quick-tag dla PRZYCHODÓW). Nowa
karta "Przelew własny" na `app/expenses/[id].tsx` (między Kategorią a Tagami, widoczna i
dla wydatków, i dla przychodów) to zwykły `Switch`, który w trybie edycji dodaje/usuwa
DOKŁADNIE ten sam tag przez istniejący `toggleTag('przelew')` — żaden nowy stan, żadna
nowa reguła w `fixedVariable.ts`/`statWidgets.ts`. W trybie odczytu karta pokazuje
Tak/Nie na podstawie `isSelfTransfer(expense)`. Dodatkowo w karcie kwoty (hero) — obok
miejsca gdzie normalnie siedzi plakietka Stałe/Zmienne (§91) — pojawia się czytelny
badge "Przelew własny — nie liczy się do wydatków/przychodów" gdy `isSelfTransfer`
zwraca prawdę, żeby było od razu widać status bez wchodzenia w edycję.

**Explicite NIE zrobione**: żadna migracja istniejących transakcji (jeśli user chce oznaczyć
starą transakcję, robi to teraz ręcznie tym przełącznikiem); przełącznik NIE jest osobną
kategorią w `ExpenseCategory`/`CATEGORY_META` (celowo — dodanie nowej kategorii do enuma
wymagałoby dotknięcia każdego miejsca, które iteruje po kategoriach — wykresy, budżety,
merchant memory — a tag na istniejącym, już wszędzie honorowanym mechanizmie `isSelfTransfer`
daje dokładnie to samo zachowanie zero-effort).

`tsc --noEmit` czyste. `jest`: 72 suity/955 testów (bez nowych — czysty UI-toggle na
istniejącym, już przetestowanym pośrednio mechanizmie tagów; `[id].tsx` nie ma testów
jednostkowych, projekt nie testuje komponentów RN).

**Priorytet testu na urządzeniu**: (1) otwórz dowolny wydatek → edytuj → włącz "Przelew
własny" → zapisz → wróć na listę Finansów i sprawdź że kwota zniknęła z sumy
wydatków/przychodów tego miesiąca; (2) ten sam wydatek ponownie w szczegółach (bez edycji)
pokazuje badge "Przelew własny" w karcie kwoty i "Tak" w karcie niżej; (3) wyłącz przełącznik
z powrotem → transakcja wraca do normalnych sum.

## 93. Self-transfer wyciekał do statystyk poza głównym bilansem — domknięcie po całej apce

User po §92: *"przelew własny nadal sie liczy do sumy na finansach nie?"*, a po
doprecyzowaniu (bilans NA KARCIE ma zostać jak jest — realnie liczy główne konto): *"inne
statystyki tez powinny brać pod uwagę ze to przelew własny a nie cos co mam / wydaje"*.

**Problem.** `isSelfTransfer()` (statWidgets.ts) istnieje od dawna i JEST honorowany w
kluczowych miejscach (monthTotals w finances.tsx, widgety dashboardu w statWidgets.ts,
fixedVariable.ts, monthCards.ts) — ale wykluczanie self-transferu NIE było spójnie
zastosowane wszędzie tam, gdzie apka liczy sumy wydatków/przychodów. Audyt (grep
`reduce((s, e) => s + e.amount`) znalazł osiem miejsc, gdzie self-transfer nadal wpadał
do sumy jak zwykły wydatek/przychód:

1. `app/(tabs)/finances.tsx` — suma PER DZIEŃ przy nagłówku daty w liście transakcji.
2. `app/(tabs)/stats.tsx` — suma dnia w widoku Kalendarz (drill-down po kliknięciu dnia).
3. `src/hooks/useExpenses.ts` — `stats.monthExpenses`/`monthIncome` (m.in. napędza widget
   "Budżet" na Dashboardzie — `budgetRemaining` w `app/(tabs)/index.tsx`).
4. `src/utils/dashboard/spend.ts` — `allSpend`/`weekIncome` (widgety tygodniowe
   dashboardu).
5. `src/utils/monthlyReports.ts` — `totalSpend`/`totalIncome` w raporcie MIESIĘCZNYM i
   ROCZNYM (ekran Podsumowania).
6. `src/utils/statWidgets.ts` — widget `'food'` (ile wydaję na jedzenie).
7. `app/weekly.tsx` — cały ekran "Tydzień" (suma tygodnia, porównanie z poprzednim,
   wykres dzienny) — lokalne `isExpense`/`isIncome` bez wykluczenia.
8. `app/expenses/stats.tsx` — cały ekran "Statystyki wydatków" (trend 6-mies., wykres
   30-dniowy, rozbicie po kategoriach/tagach, drill-down transakcji per kategoria/dzień) —
   też lokalne `isExpense`/`isIncome` bez wykluczenia; NAJBARDZIEJ prawdopodobne miejsce,
   gdzie user faktycznie zauważył wyciek.

**Fix.** Wszędzie, gdzie plik miał WŁASNĄ lokalną definicję `isExpense`/`isIncome`
(`weekly.tsx`, `expenses/stats.tsx`, `useExpenses.ts`), wykluczenie `!isSelfTransfer(e)`
wbudowane BEZPOŚREDNIO w te predykaty — jeden punkt zmiany na plik, automatycznie
poprawia WSZYSTKIE pochodne agregacje (wykresy, rozbicia kategorii, drill-downy), zamiast
łatać każde wywołanie `.reduce()` osobno. Gdzie nie było lokalnego predykatu (`spend.ts`,
`monthlyReports.ts`, `stats.tsx`, `finances.tsx` sekcja-total, `statWidgets.ts`) — dodane
`&& !isSelfTransfer(e)` bezpośrednio w filtrze. **Świadomie NIE dotknięte**: `allExp`/
`allInc` w `finances.tsx` (bilans "NA KARCIE") — user explicite potwierdził że TEN ma
zostać jak jest, bo self-transfer realnie rusza stanem głównego konta; `tagBudgets.ts`
(budżet per-tag — self-transfer musiałby mieć JEDNOCZEŚNIE tag budżetu i tag `przelew`,
skrajnie mało prawdopodobne, pominięte celowo żeby nie komplikować); running-totale przy
DODAWANIU nowego paragonu (`expenses/add.tsx`/`manual.tsx` — sumują pozycje WPROWADZANE
teraz, nie historię).

**Explicite NIE zrobione**: pełna migracja/retest WSZYSTKICH widgetów dashboardu (ponad 20
w rejestrze `statWidgets.ts`) — audyt objął tylko te faktycznie sumujące kwoty
(`reduce(...amount)`), nie liczniki/inne metryki niepieniężne.

`tsc --noEmit` czyste. `jest`: 72 suity/958 testów (+3 nowe: `dashboardSpend.test.ts` —
`allSpend`/`weekIncome` pomijają self-transfer; `monthlyReports.test.ts` — self-transfer
out+in jednocześnie nie zmienia `totalSpend`/`totalIncome`).

**Priorytet testu na urządzeniu**: (1) oznacz dowolny wydatek jako "Przelew własny" (§92)
→ sprawdź, że znika z: sumy dnia na liście Finansów, "Statystyki wydatków" (kategoria,
tydzień, miesiąc, wykres 30-dniowy), ekranu "Tydzień", drill-downu dnia w Kalendarzu,
widgetu Budżet na Dashboardzie; (2) bilans "NA KARCIE" u góry Finansów NIE powinien się
zmienić — to jedyne miejsce, które celowo dalej liczy self-transfer.

## 94. Nowy miniboss "Lodowy Królik" + system teł lokacji misji (gradient/mgiełka) + własna grafika zamrożenia serii

User: *"będziemy robić od nowa te co mamy OSA, GRIZZLY, WILK zostawiamy ogarnę pod nich
JUNGLĘ (osa), GRIZLI TO BĘDZIE LEŚNE POLANY PRZY WODZIE, a WILK środek lasu. teraz dodaję
MBOSS_LODOWYKROLIK do bossów questów i do niego jest lokalizacja LOKALIZACJA_LODOWA (tylko
musisz nałożyć między każdą lokalizację jakiś gradient low opacity chyba czarny bo będzie
zbyt zlewało się kolorystycznie i efekt zamglenia lekko... a i dodałem też
freeze_streakCoin.png i możesz pozmieniać gdzie był używany"*. Trzy pliki wgrane wprost na
`master` (GitHub upload, wymagało zmergowania do brancha roboczego, ten sam tryb co
`LOKACJA_KAMPANIA.png` w §14): `MBOSS_LODOWYKROLIK.png`, `LOKALIZACJA_LODOWA.png`,
`freeze_streakCoin.png`.

**Część 1 — nowy miniboss + retematyzowane destynacje trójki, która zostaje.**
`minibosses.ts`: dodany `mb_lodowykrolik` (🐇, bez `attackKind` — brak jednoznacznego
pazura w art, domyślna pięść jak reszta rosteru bez wpisu), `destination: 'Lodowa Kraina'`.
Destynacje OSA/GRIZZLY/WILK zmienione pod zapowiedziane środowiska: `mb_osa` → "Gęstwina
Dżungli" (dawniej "Osie Gniazdo"), `mb_grizzly` → "Polana nad Strumieniem" (dawniej
"Niedźwiedzia Gawra"), `mb_wilk` → "Głąb Puszczy" (dawniej "Mroźna Ostoja" — PORZUCONA
świadomie, bo temat lodu przejmuje teraz `mb_lodowykrolik`, dwie lokacje o tym samym
motywie kolidowałyby). `bossIcons.ts`: `mb_lodowykrolik` dopisany do `BOSS_PNG` (walka).

**Część 2 — system teł lokacji misji (nowy, wcześniej NIE istniał).** Scena "W drodze"/
"wrócił z" na `app/pet.tsx` (`s.stage`, `missionMb.destination` jako sam TEKST) nigdy
wcześniej nie miała żadnego obrazka w tle — tylko nazwę. Nowy `MISSION_LOCATION_BG`
(`bossIcons.ts`, `Partial<Record<minibossId, ImageSourcePropType>>`) + `missionLocationBg()`
— DOKŁADNIE ten sam wzorzec gracefully-missing co `bossPng`/`arenaBgFor`: miniboss bez wpisu
(9 z 10 na razie) po prostu nie dostaje tła, zero zmian w wyglądzie; dodanie kolejnego pliku
(user zapowiedział jungla/polana-nad-wodą/las, gdy dostarczy) to jedna linia w tej mapie,
zero zmian w `pet.tsx`. Renderowane jako `Image` (absolutnie, wypełnia `s.stage`,
`contentFit="cover"`) + **scrim** — 3-stopniowy czarny gradient (identyczny przepis co arena
walki w `boss-fight.tsx`: ciemniej góra/dół, jaśniej środek) — **PLUS jednolita jasnoszara
"mgiełka"** (`rgba(160,165,175,0.16)`, płaska warstwa NAD gradientem) — to jest odpowiedź na
"efekt zamglenia... jakby przejście w szarość" z prośby: różne lokacje (lód/dżungla/las)
będą mieć BARDZO różne palety, więc stały overlay ujednolica kontrast i czytelność tekstu
NIEZALEŻNIE od tego, jak jaskrawe/ciemne jest źródłowe zdjęcie — nie animowane
przejście MIĘDZY dwoma konkretnymi obrazkami (nic takiego nie istnieje — lokacja zmienia się
raz na misję), tylko stały "filtr" na KAŻDYM z nich, żeby całość apki czuła się spójnie mimo
skrajnie różnych źródłowych kolorów. `missionDestTxt`/`missionReadyDest` dostały text-shadow
(ta sama przyczyna co `tileLabel` w boss-fight.tsx) — nieszkodliwe też bez tła. `s.stage`
dostał `position:relative, overflow:hidden, borderRadius` pod przycięcie nowych warstw.

**Część 3 — grafika zamrożenia serii.** `freeze_streakCoin.png` trafia w DOKŁADNIE to samo
miejsce co user się domyślił ("możesz pozmieniać gdzie był używany") — jedyny lucide
placeholder zostały w 4-slotowej tablicy Rynku (`Snowflake` ikona, `onBuyFreeze` slot w
`pet-shop.tsx`) obok 3 potek, które własną grafikę dostały dzień wcześniej (2026-09-13).
Nowy `FREEZE_COIN_ICON` (`potions.ts`, obok `POTION_ICON` — nie `PotionKind`, bo zamrożenie
to osobna mechanika w `streakFreezeStore.ts`, stąd osobny eksport) podmienia `<Snowflake>`
na `<Image>` z tym samym stylem co potki (`s.potionImg`, `contentFit="contain"`) — teraz
wszystkie 4 sloty tablicy mają spójną, własną grafikę.

**Przeskalowanie źródłowych plików** (Pillow LANCZOS, alfa zachowana — ten sam skrypt/próg co
§13/§14, bez pytania o zgodę tym razem: to NOWE, jeszcze nigdzie nie wyświetlane uploady, nie
istniejące assety na których cokolwiek już polegało): `MBOSS_LODOWYKROLIK.png` 1536×1024/2MB
→ 600×400/290KB (próg "bossy" z §13); `freeze_streakCoin.png` 1536×1024/1,5MB → 300×200/58KB
(próg "potki" z §83); `LOKALIZACJA_LODOWA.png` 940×1672/2,1MB → 675×1200/1,18MB (próg "arena
bg, cover-fit" z §14).

**Explicite NIE zrobione**: tła dla osy/grizzly/wilka (user je ZAPOWIEDZIAŁ, ale jeszcze nie
dostarczył plików — `MISSION_LOCATION_BG` ma tylko `mb_lodowykrolik`, reszta czeka); żadna
migracja istniejących zapisanych misji (jeśli akurat trwa misja z minibossem BEZ tła, po
prostu nic się nie zmienia do końca tej misji).

`tsc --noEmit` czyste. `jest`: 72 suity/958 testów (bez nowych — czysto treściowa/wizualna
zmiana, `minibosses.test.ts` już nie asercjonuje długości rostera ani konkretnych nazw
destynacji, więc rozrost do 10 pozycji przeszedł bez modyfikacji testów).

**Priorytet testu na urządzeniu**: (1) wyślij pupila na misję kilka razy (albo poczekaj na
naturalną rotację) aż trafi się Lodowy Królik → scena "W drodze" powinna pokazać lodowe tło
z przyciemnieniem góra/dół i czytelnym tekstem "Lodowa Kraina"; (2) dla pozostałych 9
minibossów scena powinna wyglądać DOKŁADNIE jak wcześniej (brak tła — regresja jeśli coś się
zmieniło); (3) Rynek → slot Zamrożenia (lewy górny w tablicy) powinien pokazywać nową
monetę zamiast płatka śniegu; (4) walka z Lodowym Królikiem (quest/misja) → sprawdź że jego
własny portret ładuje się poprawnie.

## 95. Ekran walki: pełnoekranowe tło lokacji + przycisk WALCZ dokowany na dole jak navbar

User dostarczył 2 kolejne pełnoekranowe tła (`LOKALIZACJA_JUNGLA.png`, wgrana ze spacją w
nazwie — zmienione na `LOKALIZACJA_JUNGLA.png` pod konwencję; `LOKALIZACJA_GORKISLAS.png`) i
napisał: *"dodałem Ci całoekranowe lokacje GORSKILAS oraz JUNGLA, one są na cały ekran nie
tak jak robiliśmy, więc trzeba je ładnie zrobić. przycisk walki od teraz będzie lewitował na
dole jak navbar jakby obok niego dane, a paski zdrowia pod nimi cienie zostają"*. W trakcie
pracy, mid-turn: *"ja będę robił w trakcie kolejne grafiki pod inne kampanie, na razie możesz
zostawić ten GORSKILAS jako domyślną [lokację]"*. Doprecyzowanie zakresu (AskUserQuestion):
user potwierdził że pełnoekranowe tło + dokowany dół mają dotyczyć **wszystkich 6 trybów
walki** (kampania/raid/event/quest/MAD/misja), nie tylko questowych minibossów.

**Część 1 — GORSKILAS jako nowy domyślny fallback.** `bossIcons.ts`: nowy
`DEFAULT_ARENA_BG` (= `LOKALIZACJA_GORKISLAS.png`) ZASTĘPUJE `CAMPAIGN_ARENA_BG` jako
fallback w `arenaBgFor()` dla trybów bez własnego, dedykowanego tła (raid/event/MAD — dotąd
pożyczały dungeon-owy art kampanii, co nie miało tematycznego sensu). Kampania SAMA zostaje
przy swoim `CAMPAIGN_ARENA_BG` (jawny wpis w `ARENA_BG_BY_KIND` wygrywa z fallbackiem).
`MISSION_LOCATION_BG` (§94) dostał 2 nowe wpisy: `mb_osa` → JUNGLA, `mb_wilk` → GORKISLAS —
pasują do retematyzowanych destynacji z §94 (Gęstwina Dżungli/Głąb Puszczy). `mb_grizzly`
(Polana nad Strumieniem) wciąż BEZ pliku — czeka, user zapowiedział dosyłanie stopniowo.
Nowa `fightArenaBg(kind, targetId)` — JEDNA funkcja zamiast duplikowania fallback-chain w
`boss-fight.tsx`: dla quest/misja sprawdza NAJPIERW `MISSION_LOCATION_BG[targetId]` (per
KONKRETNY miniboss, bo te dwa `kind` dzielą jeden fight-tryb ale 10 różnych zwierząt/lokacji),
dopiero potem spada na `arenaBgFor(kind)` (per-typ-walki fallback) — dla pozostałych 4 trybów
idzie prosto do `arenaBgFor`.

**Część 2 — pełnoekranowe tło ekranu walki (`app/boss-fight.tsx`).** Dotąd tło (`LOKACJA_
KAMPANIA.png`) było ograniczone do MAŁEJ, stałej wysokości "sceny" (`arenaScene`,
`ImageBackground`) obejmującej TYLKO portrety+paski HP — reszta karty (taunt/motyw/przycisk/
mechaniki) stała na płaskim `c.bg.card`. Teraz `Image` (absolutnie, `contentFit="cover"`)
renderuje się RAZ na poziomie `SafeAreaView`, POD headerem/scrollem/dokowanym paskiem —
naprawdę cały ekran. Scrim (identyczny 3-stopniowy czarny gradient co dawna winieta areny) +
jasnoszara "mgiełka" (ten sam przepis co tło lokacji misji w `pet.tsx`, §94 — TA SAMA lokacja
wygląda teraz spójnie w OBU miejscach, gdzie się pojawia: w drodze i w walce) renderują się
też raz, na całym ekranie. `arenaScene` (dawny `ImageBackground`+lokalny gradient) to teraz
zwykły pozycjonujący `View` (`position:'relative'`) — BEZ zmian w geometrii wewnątrz
(`projectile.top`, kafelki, portrety) — ryzykowna część (matematyka lecących pocisków) została
NIETKNIĘTA, zmieniła się tylko WARSTWA pod spodem. `s.arena` stracił własne tło/ramkę
(`c.bg.card`/border) — karta stoi teraz bezpośrednio na pełnoekranowym obrazku. Wszystkie
teksty, które wcześniej siedziały na płaskiej karcie motywu (header, taunt, motyw, "Pokonany
✓", stany "brak celu"/"zablokowane", ikony Swords/Lock) dostały STAŁY jasny kolor +
text-shadow zamiast zależnego-od-motywu `c.text.*` — ten sam powód, dla którego `tileLabel`/
`tileHpTxt` (etykiety NA portretach) już dawno miały ten zabieg: tekst musi być czytelny
NIEZALEŻNIE od tego, jak jasne/ciemne jest źródłowe zdjęcie lokacji, nie od motywu apki.
**Paski HP (`tileHpTrack`/`tileHpTxt`/`tileHpFill`) świadomie NIETKNIĘTE** — user explicite:
"paski zdrowia pod nimi cienie zostają".

**Część 3 — przycisk WALCZ dokowany na dole jak navbar.** Nowy `s.floatingBar` —
`position:'absolute', bottom:0`, ten sam wizualny język co `TabBar.tsx` (pill nad contentem,
bottom scrim żeby treść płynnie "znika" pod spód zamiast twardo się urywać,
`useSafeAreaInsets` pod padding). Wyciągnięty z przewijanej treści: przycisk WALCZ!/stan
"Pokonany ✓"/ostrzeżenie o brakującej energii/"Pomiń walkę" — wszystko co wcześniej żyło NA
DOLE karty `arena` w scrollu. "Dane obok przycisku" (dosłowna prośba usera) = pigułka energii
(koszt/stan puli), PRZENIESIONA z headera (gdzie żyła osobno, daleko nad treścią) — teraz stoi
BEZPOŚREDNIO obok przycisku którego dotyczy; quest/misja nadal jej nie mają (brak puli
energii, jak dotąd), więc przycisk zajmuje wtedy całą szerokość paska. Reaktywne linijki
mechaniki (osłona/regen/uzdrowienie/cierń — informacyjne, nie akcja) ZOSTAJĄ w przewijanej
treści pod "Motywem", nie w dokowanym pasku. `s.scroll` dostał +110px rezerwy na dole, żeby
domyślnie nic nie chowało się na stałe pod pływającym paskiem (content da się i tak
doscrollować dalej).

**Świadomie NIE zrobione**: dedykowane tła dla raid/event/MAD (wciąż na `DEFAULT_ARENA_BG`);
tło dla `mb_grizzly` (czeka na plik); żadna zmiana w SAMEJ logice walki/animacji pocisków —
to czysto prezentacyjny refaktor renderowanej WARSTWY, `attackRoundBased`/`simulateFight`/
cała reszta silnika nietknięte.

`tsc --noEmit` czyste. `jest`: 72 suity/958 testów (bez nowych — czysto wizualny refaktor
ekranu bez testów jednostkowych, projekt nie testuje komponentów RN; `minibosses.ts`/
`bossIcons.ts` bez zmian logiki, tylko nowe/przemianowane require()'y i jedna funkcja
kompozytowa).

**Priorytet testu na urządzeniu**: (1) wejdź w KAŻDY z 6 trybów walki (kampania/raid/
event/quest/MAD/misja) → tło powinno wypełniać CAŁY ekran, nie tylko małe pole portretów;
(2) trafiwszy na osę/wilka w queście/misji → JUNGLA/GORKISLAS jako tło zamiast domyślnego
GORSKILAS; (3) przycisk WALCZ powinien być ZAWSZE widoczny u dołu ekranu, niezależnie od
przewinięcia treści, z pigułką energii obok niego (poza questem/misją); (4) sprawdź czytelność
całego tekstu (nazwa bossa, motyw, "Pomiń walkę") na różnych tłach — nic nie powinno "znikać"
na jasnych fragmentach zdjęcia; (5) paski HP pod portretami wyglądają DOKŁADNIE jak wcześniej
(regresja jeśli coś się zmieniło — user explicite chciał ich BEZ zmian).

## 96. Ekran walki: kotek/boss "unosili się" nad tłem + stara arena kampanii odpięta

User zrzutem ekranu (kampania, "Skamieniały Nawyk"): *"muszą być niżej żeby wyglądali jakby
byli, i wywal te stara arenę i daj ten las górski, te usuniemy wgle pewnie"*.

**Diagnoza 1 — puste miejsce pod kartą walki.** `<ScrollView contentContainerStyle={s.scroll}>`
z `s.scroll: {flexGrow:1, justifyContent:'center'}` na SAMEJ `contentContainerStyle` NIE
centruje krótkiej treści, jeśli `ScrollView` sam nie dostał `style={{flex:1}}` — bez tego
ScrollView dopasowuje WŁASNY rozmiar do treści (shrink-wrap), więc `flexGrow`/`justifyContent`
wewnątrz nie mają się w czym rozłożyć. Dokładnie to widać na zrzucie: karta walki przyklejona
pod headerem, ogromna pusta przestrzeń między "Motyw" a przyciskiem WALCZ. Fix: `style={{flex:
1}}` na `<ScrollView>`.

**Diagnoza 2 — portrety w złym miejscu kadru mimo naprawy centrowania.** Wszystkie 3 tła
lokacji (GORSKILAS/JUNGLA/LODOWA) mają tę samą kompozycję: niebo/góry/korony drzew w górnych
~55-60% kadru, "ziemia" (ścieżka/polana) TYLKO w dolnych ~40%. Wycentrowana karta (środek
DOSTĘPNEJ przestrzeni scrolla, nie środek całego ekranu) i tak lądowała zbyt wysoko względem
tej "ziemi". `s.scroll.justifyContent` zmienione `'center'` → `'flex-end'` — karta walki
zakotwicza się do DOŁU dostępnej przestrzeni (tuż nad `s.floatingBar`), więc portrety trafiają
w dolną, "naziemną" część KAŻDEGO z tych teł, nie tylko przypadkiem tego jednego testowanego —
uniwersalny fix pasujący do wspólnej kompozycji wszystkich obecnych i przyszłych lokacji, nie
pojedyncza poprawka pikselowa pod jeden obrazek.

**Stara arena kampanii odpięta.** `bossIcons.ts`: `campaign` USUNIĘTY z `ARENA_BG_BY_KIND` —
kampania teraz TEŻ pożycza `DEFAULT_ARENA_BG` (GORSKILAS) przez fallback w `arenaBgFor()`,
zamiast swojego dawnego dedykowanego `CAMPAIGN_ARENA_BG` (dungeon/łańcuchy/pochodnie z
zrzutu). Plik i eksport ZOSTAJĄ (user: "usuniemy wgle **pewnie**" — niepewne, nie stanowcze) —
ten sam wzorzec co porzucone `mb_goat`/`mb_whale` w minibosses.ts, nic już tego nie czyta, ale
nie kasuję dopóki user wprost nie potwierdzi.

`tsc --noEmit` czyste. `jest`: 72 suity/958 testów (bez nowych — czysto layoutowy fix, zero
nowej logiki).

**Priorytet testu na urządzeniu**: (1) wejdź w Kampanię → tło powinno być teraz GORSKILAS
(las/góry), NIE stary dungeon z łańcuchami; (2) w KAŻDYM trybie walki (kampania/raid/event/
quest/MAD/misja) kotek i boss powinni stać wyraźnie NIŻEJ, w dolnej części ekranu, blisko
"ziemi" widocznej na obrazku, nie unosić się na środku/górze; (3) sprawdź że nic nie chowa się
pod dokowanym paskiem WALCZ na dole przy krótkiej ORAZ długiej treści (dużo linijek
mechaniki naraz).

## 97. Cold start: cały ekran przestał czekać na Firebase auth przed pierwszym renderem

User: *"nadal aplikacja bardzo laguje na wejściu, wszystko zoptymalizowaliśmy... co trzeba
zrobić?"* — po wcześniejszych rundach optymalizacji dashboardu (staged render §4, cache
"Roku w pikselach" §5, kilka fixów O(n²)) subiektywny lag na wejściu WCIĄŻ był odczuwalny.
Zamiast zgadywać kolejną optymalizację, sprawdzony **realny** licznik cold-startu
(`perfLog.ts`, Ustawienia → Diagnostyka) — user przesłał zrzut: średnia z 20 uruchomień
**1508ms do 1. klatki dashboardu, 1793ms w pełni gotowy**. Różnica między tymi dwiema
liczbami to tylko ~285ms — czyli staged/deferred rendering z §4 realnie działa, cały problem
siedział PRZED pierwszą klatką, nie w niej.

**Diagnoza.** `app/_layout.tsx` owijał CAŁY `<Stack>` (czyli KAŻDY ekran apki) w
`{authReady && (...)}` — `authReady` czekał na pełny round-trip `onAuthStateChanged`/
`signInAnonymously` przez Firebase Auth SDK (odczyt sesji z AsyncStorage + ewentualny
network call dla świeżego anonimowego konta), z fallbackiem do 4s jeśli się zatnie. Dopóki
to się nie skończyło, żaden ekran — nawet dashboard — nie mógł się w ogóle zamontować,
niezależnie od tego jak szybko renderowałby się sam w sobie. `AnimatedSplash` (czysto
kosmetyczny, "lag-proof by design", bez własnej zależności od danych) tylko WIZUALNIE
maskował ten czas — realny powód czekania to Firebase, nie sam splash.

**Fix — przenieś czekanie z "blokuje render" na "blokuje konkretne zapytanie".**
`src/services/firebase.ts`: nowa, memoizowana `whenAuthReady(): Promise<void>` (dokładnie
ta sama logika `onAuthStateChanged`/`signInAnonymously`/4s-fallback co dawniej w
`_layout.tsx`, przeniesiona tu jako jedno, dzielone źródło prawdy). `uid()` — dawniej
SYNCHRONICZNA funkcja rzucająca `'Not authenticated'` jeśli `auth.currentUser` jeszcze nie
istniał (co wymuszało zewnętrzny gate, żeby cokolwiek jej używające nigdy nie odpaliło się
za wcześnie) — jest teraz `async`, `await whenAuthReady()` PRZED odczytem
`auth.currentUser`. `userCol`/`userDoc`/`userSubcol`/`userSubdoc` (budują referencje
Firestore z `uid()`) są teraz też `async` — każde dotychczasowe wywołanie (zawsze już
wewnątrz funkcji `async`, zawsze już przekazywane prosto do `query()`/`addDoc()`/
`updateDoc()`/`deleteDoc()`/`getDoc()`/`getDocs()`/`setDoc()`/`batch.set()`, które i tak są
`await`owane) dostało `await` przed sobą — **mechaniczna, zweryfikowana przez `tsc`
zmiana**: przepuszczenie kompilatora przez cały projekt po zmianie typu na `Promise<...>`
wyłapało WSZYSTKIE 60 miejsc do poprawki w 10 plikach serwisów (`backupService`/
`calendarService`/`debtsService`/`expensesService`/`maintenanceService`/`moodService`/
`subscriptionsService`/`templatesService`/`vehiclesService`/`workService`) +
`selfTest.ts` — żadne nie zostało pominięte ręcznym grep-em, kompilator by nie pozwolił.
Efekt: każdy odczyt/zapis do Firestore teraz PO PROSTU CZEKA na auth tyle ile potrzeba,
zamiast rzucać błąd jeśli odpali się za wcześnie — więc zdjęcie zewnętrznego gate'u jest
bezpieczne, żadnego wyścigu do przegrania.

**Wyjątek — `expensesService.newId()` ZOSTAJE synchroniczna.** Ta funkcja celowo generuje
offline-safe id BEZ dotykania sieci (żeby dało się zaktualizować lokalny store i
nawigować dalej bez czekania na `add()`, patrz oryginalny komentarz o "czarnym ekranie"
przy skanowaniu paragonu). Zrobienie jej `async` (żeby zaczekać na `userCol`) zmusiłoby OBA
miejsca wywołania (`expenses/scan.tsx`/`manual.tsx`) do `await`owania jej, dokładnie
niwecząc ten cel. Zamiast tego: `doc(collection(db, COL)).id` — throwaway referencja BEZ
prawdziwego `uid()`, bo losowe id Firestore i tak nie zależy od ścieżki kolekcji. Bezpieczne
i BARDZIEJ odseparowane od auth niż wcześniej, nie mniej.

**`app/_layout.tsx`**: `<Stack>` renderuje się teraz BEZWARUNKOWO (usunięty
`{authReady && (...)}`). `AnimatedSplash` odpięty od `authReady` — znika po samym,
stałym `minSplashDone` (1500ms brandingu), niezależnie od tego jak długo trwa auth w tle;
`authReady` state zostaje TYLKO dla dwóch efektów które jawnie na niego czekają (auto-backup,
prompt przywrócenia kopii) i koloru StatusBar podczas splasha.

**Explicite NIE zrobione**: żadna próba przyspieszenia SAMEGO Firebase SDK (poza zakresem —
to należy do biblioteki, nie do tego kodu); żadna migracja na inny auth provider; deferred
sections z §4 (już działały dobrze, nietknięte).

`tsc --noEmit` czyste (zero błędów po całym przepisaniu — dowód że żadne wywołanie
`userCol`/`userDoc`/`userSubcol`/`userSubdoc` nie zostało pominięte). `jest`: 72 suity/958
testów (bez nowych — projekt nie mockuje Firestore, żaden test nie dotyka tych serwisów
bezpośrednio; poprawność zweryfikowana przez wyczerpujące przejście kompilatora + ręczny
przegląd wszystkich 60 zmienionych miejsc).

**Priorytet testu na urządzeniu — TO JEST GŁÓWNA ZMIANA DO SPRAWDZENIA**: (1) zamknij i
otwórz apkę od zera kilka razy → Ustawienia → Diagnostyka → licznik startu powinien pokazać
WYRAŹNIE niższe `msToFirstFrame` niż dotychczasowa średnia ~1508ms; (2) sprawdź że dane
(wydatki/zadania/eventy/nastrój/itd.) NADAL poprawnie się ładują na każdym z ekranów mimo że
teraz montują się wcześniej — powinny po prostu pojawić się chwilę po pierwszym renderze,
nie zniknąć/zostać puste na stałe; (3) dodaj nowy wydatek/zadanie zaraz po otwarciu apki
(zanim auth na pewno się rozwiąże) → sprawdź że zapis faktycznie trafia do chmury (nie tylko
lokalnie) — to jest DOKŁADNIE scenariusz który ta zmiana miała zabezpieczyć; (4) słaby/
wyłączony internet przy starcie → apka powinna pokazać się i działać lokalnie normalnie
(offline-first), auth/sync dogoni później jak zawsze.

## 98. Sprzątanie Ustawień, runda 1: wypłata domyślnie off, martwy "Ogranicz animacje", "Więcej"→"Skróty"

User dał naraz 7 zgłoszeń do Ustawień (screenshot + lista). Ta runda — trzy najmniejsze,
bezpieczne do zrobienia od razu; pozostałe (nowy panel Statystyk, przebudowa nawigacji
Ustawień/Kopii zapasowej, overhaul sekcji banku z historią odczytów, ulepszenie zarządzania
powiadomieniami) idą w kolejnych PR-ach — za duże/zbyt różne żeby robić je razem.

**1. "Pytaj o wypłatę" domyślnie WYŁĄCZONE.** User: *"teraz to już nie ma sensu skoro
daliśmy szablon — jak wykryje powiadomienie... automatycznie miało przypisać że to
praca"*. Bank rule templates (`bankRulesStore.ts`, sekcja "Auto-wydatki z banku") już
rozpoznają nadawcę jako "Wypłata/przychód" i księgują automatycznie — ręczny prompt na
dashboardzie ("Dostałeś wypłatę?") dubluje to dla userów z skonfigurowanym szablonem.
Doprecyzowane (AskUserQuestion): kod ZOSTAJE (przydatny bez auto-wykrywania z banku),
tylko domyślnie wyłączony. Nowa jednorazowa migracja `migratePaydayDefaultOff()`
(`payday.ts`, ten sam wzorzec co `migrateBalanceModel`) wymusza `enabled: false` RAZ dla
istniejących userów którzy mieli to włączone z dawnych czasów (nowi userzy i tak dostają
`false` domyślnie). Podpięta w `_layout.tsx` obok innych jednorazowych migracji.
Zaktualizowany podpis przełącznika w Ustawieniach, tłumaczący kiedy jest zbędny.

**2. "Ogranicz animacje (płynność)" — martwy przełącznik USUNIĘTY.** User: *"chyba już
jest nie używany... to było do animacji hero kiedyś teraz useless zajmuje miejsce"* —
zgadł trafnie. `liteMode` (`uiPrefs.ts`) sterował WYŁĄCZNIE `AnimatedCardBg.tsx`
(animowane niebo/gwiazdy/chmury za kartą hero), ale `app/(tabs)/index.tsx` miał już tylko
MARTWY `import AnimatedCardBg` — bez ŻADNEGO użycia w JSX (redesign hero w którymś
momencie porzucił ten komponent, import i setting zostały osierocone). Usunięte: cały
plik `AnimatedCardBg.tsx`, `liteMode`/`setLiteMode` z `uiPrefs.ts` (zostaje `tabSlide` —
osobny, wciąż żywy pref), przełącznik + jego state w `settings.tsx`, martwy import w
`index.tsx`.

**3. Sekcja "Więcej" → "Skróty".** User: *"bo to realnie skróty do liczników pupila
itp"*. Sekcja zawsze zawierała tylko 3 linki (Gablota osiągnięć/Liczniki i odliczania/
Pupil) — "Więcej" nic nie mówiło co w środku. Samo `title` zmienione (`id` zostaje
`'wiecej'` — stabilność wewnętrzna, `'więcej'` zostaje też w `keywords` pod starą nazwę
w wyszukiwarce Ustawień).

**Explicite NIE zrobione w tej rundzie**: pozostałe 4 zgłoszenia z tej samej wiadomości
usera — nowy dedykowany ekran "Statystyki" z wykresami w czasie (obecny
`usageStatsStore.ts` ma tylko agregat count+lastOpenedAt, bez historii — wymaga nowego
modelu danych); przebudowa "Kopia zapasowa" (dziś zawsze rozwinięta, poza mechanizmem
akordeonu Ustawień) w kolejną, zwijalną/osobną podstronę; overhaul całej sekcji "Auto-
wydatki z banku" (czytelność, historia odczytanych powiadomień, jaśniejszy związek
szablon→kategoria/tagi — user przesłał zrzut z konkretnymi uwagami); ulepszenie
zarządzania powiadomieniami w apce (kiedy/personalizacja wyglądu każdego typu).

`tsc --noEmit` czyste. `jest`: 72 suity/958 testów (bez nowych — `payday.ts` nie ma
dedykowanych testów jednostkowych, `paycheck.test.ts` to coś innego — rozpoznawanie
nadawcy w `bankNotification.ts`, nietknięte).

**Priorytet testu na urządzeniu**: (1) świeży install (albo user z już włączonym "Pytaj o
wypłatę") → po aktualizacji przełącznik powinien być WYŁĄCZONY (chyba że świadomie
włączysz go z powrotem — migracja działa RAZ, ponowne włączenie zostaje); (2) Ustawienia
→ Personalizacja → "Ogranicz animacje" powinno całkowicie zniknąć z listy; (3) sekcja
dawniej "Więcej" pokazuje się teraz jako "Skróty" z tymi samymi 3 linkami.

---

## 99. Sprzątanie Ustawień, runda 2: historia odczytów banku + czytelność sekcji "Auto-wydatki z banku"

User (dwukrotnie, z tym samym zrzutem "Auto-wydatki z banku (PeoPay)"): *"realnie
usprawnijmy i ulepszmy wizualnie te zakładkę na screenie, duzo tutaj tekstu informacji
malo czytelnosci i czy wszystko działa, dodajmy historie zczytywania tutaj, dodajmy
informacje itp zeby szablony przepisywała do kategorii i tagow i wgle okie specjalisty
zerknij"* — czwarte z pięciu dużych zgłoszeń odłożonych w §98.

**1. Historia odczytów (nowość).** Dotąd JEDYNYM śladem odczytanego powiadomienia był
`pending` (znika po zatwierdzeniu/odrzuceniu w `/bank-review`) i `seenNotifications`
(gołe klucze dedup `pkg:postTime`, bez żadnych metadanych — patrz §-komentarz w
`bankQueueStore.ts`). Dodano `history: BankIngestHistoryEntry[]` (capped na 150, ten sam
wzorzec co `seenNotifications`) + akcję `clearHistory()` w `bankQueueStore.ts`. Zapis
dzieje się w JEDNYM miejscu — wewnątrz `enqueue()`, tuż obok wstawienia do `pending` — nie
w `bankIngest.ts` przy każdym z 3 call-site'ów, żeby nie dublować logiki i mieć
gwarancję że historia i `pending` nigdy się nie rozjadą. Wpis: sklep, kwota+waluta,
kierunek, kategoria (albo `'transfer'` dla przelewu własnego), tagi, `auto`/`flagReason`,
`jd` (czy oznaczone jako wypłata) i nowe pole `matchedSource`.

**2. `matchedSource` — skąd wzięła się kategoria (odpowiedź na "żeby szablony
przepisywała do kategorii i tagów").** Nowe opcjonalne pole na `PendingBankTx`:
`'template' | 'learned' | 'guess'`. Ustawiane w `bankIngest.ts` w dwóch miejscach, gdzie
kategoria/`jd` faktycznie się rozstrzyga: przychód → `'template'` gdy trafił
`incomeRule` (szablon "Wypłata"), inaczej brak (zwykły przelew, nic nie dopasowało);
wydatek → `'learned'` (nauczony sklep z `merchantMemory.ts`, wygrywa zawsze) →
`'template'` (dopasowany `bankRulesStore` rule) → `'guess'` (sztywny słownik-zgadywacz w
`guessCategory`). Self-transfer nie ustawia nic — zawsze jednoznacznie "przelew własny",
nie trzeba tłumaczyć skąd.

**3. UI: `BankHistorySection.tsx`** (nowy, `src/components/settings/`, wzorowany 1:1 na
istniejącym `UsageStatsSection.tsx` — `themedStyles` + `useMemo`, top-6 z "pokaż
wszystkie", `ConfirmDialog` na czyszczenie). Każdy wiersz: kolorowa ikonka wg kategorii
(`CATEGORY_META`, dynamiczny lookup `(LucideIcons as any)[meta.icon]` — ten sam wzorzec co
`ExpenseItem.tsx`) albo specjalny wygląd dla przychodu/wypłaty/przelewu własnego, nazwa
sklepu, druga linia = kategoria/tagi + etykieta źródła ("wg szablonu" / "nauczony sklep" /
"zgadywane" — właśnie ten fragment odpowiada na "informacje żeby szablony przepisywała do
kategorii i tagów"), kwota ze znakiem +/−, znacznik czasu + "auto" jeśli zaksięgowano bez
przeglądu. Podpięte jako nowy `custom` item `'bank-history'` na końcu sekcji `'bank'` w
`settings.tsx`, widoczny tylko gdy `bankEnabled` (jak reszta sekcji).

**4. Czytelność sekcji ("dużo tekstu, mało czytelności").** Sekcja była jedną ścianą
kolejnych `TextInput`/przycisków bez żadnego wizualnego grupowania poza pojedynczymi
`borderTopWidth`. Dodane trzy male-caps etykiety-nagłówki (nowy styl `bankGroupLabel`,
custom itemy bez własnej ramki, żeby nie dublować obramowania z itemem który po nich
następuje): "Rozwiązywanie problemów i test" (przed dostępem do powiadomień/testem
odczytu), "Szablony i dopasowania" (przed formularzem szablonów), "Historia" (przed nowym
logiem). Włączenie/własne imię/auto-księgowanie zostają bez nagłówka — to rdzeń sekcji,
zawsze pierwsze. Same formularze (szablony, test) NIE zmienione strukturalnie — user prosił
o czytelność przez grupowanie, nie przez usuwanie pól.

**5. "Czy wszystko działa" — przegląd kodu (bez dostępu do urządzenia).** Przeczytany od
nowa cały pipeline: `bankNotificationDrain.ts` → `bankIngest.ts` → `bankQueueStore.ts` →
`bankAutoProcess.ts`/`/bank-review`. Bez znalezionych błędów — dedup (`seenNotifications`
+ 3-minutowe okno w `enqueue`), kolejność `learned` → `rule` → `guessCategory`, i
próg "nietypowo wysoka kwota" (>1500 zł) trzymający się konsekwentnie działają zgodnie z
komentarzami w kodzie. To przegląd czytelności kodu, NIE test na żywym urządzeniu z
prawdziwymi powiadomieniami z banku — patrz checklist testu niżej.

**Explicite NIE zrobione w tej rundzie**: `matchedSource` nie jest pokazywany NIGDZIE poza
nową historią (np. `/bank-review` review screen go nie czyta — mógłby, ale user prosił o
to konkretnie "tutaj", w Ustawieniach); pozostałe 3 duże zgłoszenia z §98 (panel
Statystyk, przebudowa nawigacji Ustawień/Kopii zapasowej, zarządzanie powiadomieniami w
apce) wciąż czekają, każde jako osobny PR.

`tsc --noEmit` czyste. `jest`: 72 suity/958 testów (bez nowych — `bankQueueStore.ts` i
`bankIngest.ts` nie mają dedykowanych testów jednostkowych; istniejące `paycheck.test.ts`
testuje rozpoznawanie nadawcy w `bankNotification.ts`, nietknięte tą zmianą).

**Priorytet testu na urządzeniu**: (1) wklej testowe powiadomienie w "Test odczytu
powiadomień" → sprawdź że nowa "Historia odczytów" niżej w sekcji pokaże wpis z poprawną
kategorią/kwotą i etykietą źródła; (2) zapisz nowy szablon (Szablony i dopasowania),
wywołaj pasujące powiadomienie testowe → wpis w historii powinien pokazać "wg szablonu";
(3) realna płatność kartą od nieznanego sklepu → wpis powinien pokazać "zgadywane"; (4) ta
sama płatność po kilku akceptacjach (sklep "nauczony") → kolejny wpis "nauczony sklep";
(5) sprawdź że nagłówki grup ("Rozwiązywanie problemów i test" / "Szablony i dopasowania"
/ "Historia") wizualnie rozdzielają sekcję i nie ma podwójnych linii/dziwnych odstępów;
(6) "Wyczyść historię" faktycznie czyści listę i nie rusza zapisanych szablonów/wydatków.

---

## 100. Sprzątanie Ustawień, runda 3: menu → podstrona zamiast akordeonu (nawigacja jak na Androidzie)

User (item #5 z tej samej wiadomości co §98/§99), dosłownie dał dwie opcje: *"w
USTAWIENIACH > KOPIA ZAPASOWA CHMURA (zakłądka się nie chowa zawsze jest otawrta może
sie zwijać do zakładki DANE) albo wgle ustawienia zrobmy że po kliknięciu dane przenosi
nas jak na androidzie do kolejnej storny z ustawieniami gdzie o bedzie bo rozwijane
rzeczy tez wprowadzaja chaossu troche"*. Zapytany (AskUserQuestion: A = zwiń tylko
backup do akordeonu Dane / B = pełny redesign nawigacji / C = hybryda) — user wybrał
**B: pełny redesign**.

**Co się zmieniło.** `app/settings.tsx` bez wyszukiwania renderował płaską listę
akordeonów (`SettingsSectionView`, każda sekcja rozwijana w miejscu) + `BackupSection`
zawsze rozwinięta między sekcją "Dane" a "Konto". Teraz: ekran główny to MENU —
jeden wiersz na sekcję (`SettingsCategoryRow`: ikona, tytuł, liczba opcji, chevron),
kliknięcie otwiera PEŁNĄ podstronę tej JEDNEJ sekcji (nagłówek zmienia się na jej
tytuł, treść to jej `items` renderowane przez `SettingsRow` w zwykłej, nieskładanej
karcie). Sprzętowy przycisk "wstecz" na Androidzie (`BackHandler`) w trybie podstrony
wraca do menu zamiast wyjść z Ustawień; wraca też przycisk `‹` w nagłówku (ten sam
element UI, dwie role zależnie od stanu). `BackupSection`/`UsageStatsSection`
przeniesione na koniec podstrony `'dane'` — dokładnie rozwiązuje to pierwszą,
mniejszą opcję usera (backup już nie stoi zawsze otwarty, zajmując miejsce), przy
okazji zrealizowaną w ramach wybranej dużej.

**Jak to zaimplementowane — BEZ ekstrakcji hooków do osobnych plików.** Rozważona
była "prawdziwa" wersja: osobne trasy `app/settings/index.tsx` + `app/settings/[id].tsx`
z całą logiką (~150 hooków: work settings, pracodawcy, bank rules, budżety, Google
sign-in…) wyciągniętą do współdzielonego hooka. Odrzucona — zamontowanie DWÓCH
instancji tego hooka jednocześnie (menu + podstrona, gdy nawigujesz w sekcję) uruchamia
KAŻDY efekt dwa razy równolegle, w tym realny precedens buga w tym samym pliku
(wyścig przy pierwszym ładowaniu pracodawców, `workService.ts`/`settings.tsx` — patrz
wpis w spisie błędów) oraz co najmniej jeden efekt z jednorazowym `Alert.alert` po
AsyncStorage-guard (`work_confirm_asked`), który przy podwójnym mount mógłby pokazać
się dwa razy. Zamiast tego: **jeden komponent, jeden mount, przełącznik widoku**.
Cała tablica `sections` (linie ~740–2160) zostaje DOKŁADNIE jak była — wszystkie hooki,
cały stan, wszystkie handlery, bez zmian. Zmieniony jest WYŁĄCZNIE render na końcu
(`return (...)`): nowy stan `activeSectionId` (`null` = menu, `id` = podstrona),
`openSection`/`closeSection` (haptyka + `LayoutAnimation` fade, ten sam wzorzec co
istniejący toggle akordeonu w `SettingsSectionView`) + `scrollRef.current?.scrollTo({y:0})`
przy każdym przełączeniu (bez tego stary scroll offset menu zostawał, podstrona
renderowała się "wjechana" w środek ekranu). To realna, świadoma różnica względem
prawdziwych, natywnych podstron: BRAK gestu "swipe z krawędzi żeby wrócić" (tylko
przycisk `‹`/sprzętowy wstecz) — react-navigation daje to za darmo tylko prawdziwym
ekranom w stosie, nie ręcznemu przełącznikowi widoku w jednym komponencie. Ryzyko
uznane za akceptowalne: user prosił o "kliknięcie → osobna strona" (wygląd/strukturę),
nie explicité o gest swipe'a.

**Wyszukiwanie nietknięte.** Gdy `query` niepuste, ekran nadal renderuje
`SettingsSectionView` per dopasowana sekcja z `forceOpen` (jak dotąd) — spłaszczona
lista trafień, nie menu kategorii do przeklikania. `SettingsSectionView` (akordeon)
żyje dalej wyłącznie w tej roli; poza nią już nieużywany (`defaultOpen` na sekcjach
stał się kosmetycznie martwy — akceptowalne, nie usunięte z typu).

**`headerRight` (przycisk "Zapisz" w sekcji budżetu) przeniesiony** z nagłówka
akordeonu na osobny wiersz nad kartą itemów podstrony — jedyna sekcja która go
używała (`'budzet'`), zachowanie identyczne, tylko inne miejsce.

**Explicite NIE zrobione**: prawdziwy natywny swipe-back gest (patrz wyżej); żadna
sekcja nie dostała dedykowanej trasy `expo-router` — to wciąż jeden plik, jeden
komponent. Panel "Statystyki" (item #3) i zarządzanie powiadomieniami (item #4) wciąż
czekają — teraz łatwiej się w nie wpina (każda nowa/duża sekcja od razu dostaje pełną
podstronę za darmo, bez osobnej decyzji o UI).

`tsc --noEmit` czyste. `jest`: 72 suity/958 testów bez zmian (czysto UI/nawigacja —
`settingsSearch.test.ts` w tym bez zmian, bo `filterSections` nietknięty).

**Priorytet testu na urządzeniu** (to jest największa zmiana UX tej sesji — testuj
uważnie): (1) ekran główny Ustawień pokazuje listę kategorii, nie rozwinięte sekcje;
(2) kliknięcie kategorii otwiera pełną podstronę z poprawnym tytułem w nagłówku;
(3) sprzętowy przycisk wstecz na Androidzie z otwartej podstrony wraca do MENU, nie
wychodzi z Ustawień — dopiero drugie wciśnięcie (już w menu) wychodzi; (4) przycisk
`‹` w nagłówku robi to samo co sprzętowy wstecz; (5) "Dane" pokazuje 4 liczniki +
Kopię zapasową + Statystyki apki pod spodem, wszystko działa (utwórz/przywróć kopię,
eksport JSON/CSV); (6) "Budżet miesięczny" — przycisk "Zapisz" nad listą kategorii
nadal zapisuje budżety; (7) wyszukiwarka (wpisz cokolwiek w polu na głównym ekranie)
nadal pokazuje spłaszczone trafienia jak dawniej, nie menu kategorii; (8) scroll nie
"skacze" dziwnie przy wejściu/wyjściu z podstrony.

---

## 101. Sprzątanie Ustawień, runda 4: powiadomienia — dwa nachodzące ekrany scalone, prawdziwe bugi naprawione

User (item #4 z batcha §98-100): *"POWIADOMIENIA W APCE są nie jasne w USTAWIENIACH musimy
je ulepszyć pod kątem ustawiania kiedy takie będzie (oraz dodać personalizacje że mogę
zmienić jak wygląda każde powiadomienie ręcznie)"*. Śledztwo pokazało, że "niejasne" to nie
tylko wrażenie — to były REALNE, sprawdzalne bugi wynikające z DWÓCH osobnych, częściowo
nachodzących na siebie ekranów zarządzania powiadomieniami.

**Co było zepsute (znalezione, nie tylko podejrzewane):**
1. **Zły przełącznik pod złą etykietą.** Item `'notif-mood-enabled'` w Ustawieniach →
   Powiadomienia nazywał się "Przypomnienie nastroju" / "Codzienne powiadomienie
   wieczorne", ale realnie był podpięty pod `toggleNotifications` — GLOBALNY master
   (`notif_enabled` + `notificationsService.cancelAll()`, kasujący WSZYSTKIE typy, nie
   tylko Humor). User wyłączający "tylko przypomnienie nastroju" po cichu wyłączał
   WSZYSTKO (budżet, subskrypcje, zmiany w pracy…). Prawdziwy, poprawnie nazwany master
   ("Wszystkie powiadomienia") istniał — ale na OSOBNYM ekranie `/notifications`,
   osiągalnym tylko przez link "Zarządzaj powiadomieniami" schowany NIŻEJ w tej samej
   sekcji.
2. **Stan "Poranne"/"Lista zadań"/"Nawyki" resetował się do OFF przy każdym wejściu w
   Ustawienia.** `morningEnabled`/`briefingEnabled`/`habitNotifEnabled` to były lokalne
   `useState(false)` BEZ żadnego odczytu z AsyncStorage przy montowaniu — user włączający
   je i zapisujący widział je z powrotem jako wyłączone przy następnym otwarciu ekranu
   (mimo że realnie zaplanowane powiadomienie wciąż działało w tle, aż do następnego
   "Zapisz przypomnienia", które by je po cichu ANULOWAŁO, bo UI kłamało że są off).
3. **`notif_habits_enabled` nigdy nie było zapisywane.** `notificationsService.
   scheduleDailyHabitReminder` CZYTA tę flagę jako bramę (`=== 'false'` → nie planuj), ale
   `saveReminders()` w Ustawieniach nigdy jej nie zapisywało — sterowało tylko przez
   bezpośrednie `schedule`/`cancel`. Martwa flaga, żadnego realnego efektu, ale mylące dla
   każdego kto by ją odczytał licząc że coś znaczy.
4. **Ekran `/notifications` (osobna trasa) miał WŁASNĄ listę 8 typów on/off**
   (`notif_mood_enabled`/`notif_todo_enabled`/`notif_habits_enabled`/`notif_maintenance_
   enabled`/`notif_budget_enabled`/`notif_work_enabled`/`notif_subs_enabled`/`notif_
   weekly_enabled`) — częściowo dublującą to co Ustawienia już miały (mood/todo/habits, z
   INNYM, niesynchronizowanym stanem — patrz #2), częściowo unikalną (maintenance/budget/
   work/subs/weekly — te w Ustawieniach w ogóle nie miały włącznika, budżet miał tylko
   próg %).

**Fix — jedna podstrona zamiast dwóch ekranów.** `app/notifications.tsx` USUNIĘTY (jedyna
referencja do `/notifications` żyła w linku "Zarządzaj powiadomieniami", teraz też
usuniętym). Jego 5 "prostych" typów bez własnego edytora godziny (maintenance/budget/
work/subs/weekly) przeniesione do `src/utils/notificationTypes.ts`
(`SIMPLE_NOTIF_TYPES`/`cancelNotifType` — ta sama struktura/logika co było, tylko
wydzielona jako reużywalna tabela zamiast żyć w skasowanym ekranie) i renderowane
generycznie (`.flatMap`) jako pozycje w sekcji `'powiadomienia'` w `settings.tsx`.
Budżet dostał WŁASNY przełącznik on/off (`notif_budget_enabled`, dawniej niedostępny z
Ustawień) — próg % pokazuje się tylko gdy włączony. Sekcja ma teraz DWA nagłówki-grupy
(`styles.groupLabel` — przemianowany z `bankGroupLabel`, wzorzec z §99, teraz reużywalny
poza sekcją banku): "Codzienne przypomnienia" (Humor/Poranne/Lista zadań/Nawyki, każdy z
własnym edytorem godziny) i "Zdarzenia i limity" (5 prostych typów). Master
("Wszystkie powiadomienia", poprawnie nazwany i przeniesiony na sam wierzch, POZA
wszystkimi typami) korzysta z NIETKNIĘTEJ logiki `toggleNotifications` — poprawiona tylko
etykieta/pozycja, nie działanie. Humor dostał WŁASNY, osobny od mastera przełącznik
(`moodEnabled`/`toggleMoodNotif`, nowy stan + nowa funkcja, czyta/pisze `notif_mood_
enabled` który już istniał w AsyncStorage, tylko Ustawienia go nigdy nie odczytywały) —
edytor godziny wieczornej pokazuje się teraz TYLKO gdy Humor jest włączony, nie zawsze
(dawniej pokazywał się zawsze gdy master był on, niezależnie od tego co user by chciał).
Poranne/Lista zadań/Nawyki dostały brakujący odczyt stanu na mount (`AsyncStorage.
multiGet(['notif_morning_enabled','notif_todo_enabled','notif_habits_enabled'])`,
nowa flaga `notif_morning_enabled` dopisana symetrycznie do istniejącego wzorca `notif_
todo_enabled`) + `saveReminders()` teraz faktycznie zapisuje `notif_habits_enabled`
(fix #3 wyżej). `notificationsService.ts` dostał brakujący `cancelDailyMoodReminder()`
(symetryczny do `cancelMorningReminder`/`cancelDailyTodoList`/`cancelDailyHabitReminder`,
których wzorca dotąd nie miał Humor).

**Explicite NIE zrobione — personalizacja WYGLĄDU powiadomień** (druga połowa
zgłoszenia usera: *"dodać personalizacje że mogę zmienić jak wygląda każde powiadomienie
ręcznie"*). Treść (tytuł/body) każdego typu jest dziś zaszyta w kodzie
`notificationsService.ts` (osobna funkcja per typ, np. `scheduleDailyMoodReminder`
zawsze `'Nie zapisałeś dziś humoru'`). Zrobienie tego wymaga osobnej decyzji projektowej:
co dokładnie edytowalne (sam tekst? placeholdery na dynamiczne wartości jak kwoty/
liczby zadań?), gdzie to trzymać (nowy per-typ store z override'ami czytany przy każdym
`schedule*`), jak to się ma do typów z dynamiczną treścią (budget/todo/weekly budują
treść z aktualnych danych, nie da się tam wstawić gołego stringa 1:1) — świadomie
odłożone jako osobny, przyszły PR, żeby nie robić pochopnego designu w tej samej rundzie
co fix bugów.

Dodatkowo znaleziona, ale NIE naprawiona (świadomie, poza zakresem tej rundy): `pet-daily`
i `boss-ready` mają skonfigurowalne godziny (`notif_pet_hour`/`notif_pet_min`,
`notif_boss_hour`/`notif_boss_min`) w kodzie `notificationsService.ts`, ale ŻADNEGO UI do
ich ustawienia — zawsze biorą hardkodowany default (19:00/18:30). Osierocony punkt
rozszerzenia, nie bug (działają, tylko nieedytowalne) — zanotowane w NEXT_STEPS.

`tsc --noEmit` czyste. `jest`: 72 suity/958 testów bez zmian (bez dedykowanych testów
jednostkowych dla tego ekranu/serwisu — nietestowalne bez mocka `expo-notifications` i
zegara, zgodnie z istniejącą konwencją repo).

**Priorytet testu na urządzeniu** (realne bugi behawioralne, nie tylko UI — testuj
uważnie): (1) włącz "Poranne"/"Lista zadań"/"Nawyki", zapisz, ZAMKNIJ i otwórz ponownie
Ustawienia → Powiadomienia — wszystkie trzy powinny wciąż pokazywać się jako WŁĄCZONE
(dawniej resetowały się na OFF); (2) wyłącz WYŁĄCZNIE "Humor" (nie master) — reszta typów
ma zostać aktywna; (3) wyłącz "Wszystkie powiadomienia" (master) — WSZYSTKO znika z listy,
`cancelAll()` faktycznie kasuje zaplanowane; włącz z powrotem — Humor wraca; (4) Budżet ma
teraz własny przełącznik, próg % pokazuje się tylko gdy włączony; (5) Serwis/Subskrypcje/
Zmiany w pracy/Podsumowanie tygodniowe — przełączniki działają (sprawdź że wyłączenie
faktycznie anuluje zaplanowane powiadomienie danego typu, `getAllScheduledNotificationsAsync`
w debugu jeśli trzeba); (6) `/notifications` już nie istnieje — nawigacja do niego (gdyby
gdzieś jeszcze była w pamięci podręcznej routera) nie powinna się zdarzać, bo link usunięty.

---

## 102. Sprzątanie Ustawień, runda 5 (ostatnia): pełny panel "Statystyki apki"

User (item #3 z batcha §98-101, ostatni z siedmiu): *"Te statystyki apki lokalnie
chciałem mieć w USTAWIENIACH > STATYSTYKI PANEL cały żebym mógł wejść w niego i mieć
dużo dokładnych danych jak korzystam w co wchodzę kiedy dokładnie itp (wykresy z czasem
itp co po kolei (może się ładować chwilkę po wejscu to nie main)"*.

**Model danych rozszerzony.** `usageStatsStore.ts` miał tylko `screens: Record<id,
{count, lastOpenedAt}>` — agregat bez historii, za mało na "wykresy z czasem". Dodany
`events: ScreenOpenEvent[]` (`{screenId, at: number}`, `at` jako epoch ms nie ISO — mniejszy
JSON, tania arytmetyka Date przy bucketowaniu), capped na 3000 (jak `seenNotifications`/
bank `history` w innych store'ach tej sesji — rolling window, nie pełny audit trail; przy
typowym użyciu to wciąż wiele miesięcy). Zapisywany w TYM SAMYM `recordOpen()` co `screens`
(jedno miejsce, `app/_layout.tsx`, bez zmian w call site) — nie da się rozjechać.
Istniejącym userom `events` domyślnie `[]` przez standardowy merge zustand-persist (brak
klucza w starym zapisie = zostaje initial state), bez osobnej migracji.

**Nowa trasa `app/usage-stats.tsx`** (nie zakładka Ustawień — osobny pełny ekran, zgodnie
z tym co user opisał: "wejść w niego"). Agregacje wydzielone jako czyste, testowalne
funkcje w `src/utils/usageStatsAnalysis.ts` (`bucketByDay`/`bucketByHour`/
`oldestEventDate`, testy w `__tests__/usageStatsAnalysis.test.ts`) — ekran sam tylko je
woła w `useMemo` i renderuje. Trzy karty: (1) słupkowy wykres otwarć dziennie z ostatnich
14 dni (ten sam wzorzec gołych `View`-i co `WeekBars` w `weekly.tsx` — bez zewnętrznej
biblioteki wykresów, spójnie z resztą apki), dni bez otwarcia dostają `count: 0` (nie są
pomijane — luki w używaniu widoczne jako puste słupki, nie zniekształcają skali); (2)
rozkład godzinowy (24 cienkie słupki, "o której porze dnia") — odpowiada wprost na "kiedy
dokładnie"; (3) pełny, nieucięty ranking ekranów (poprzednio w Ustawieniach ucięty do
top-6 z "pokaż wszystkie"). Dostęp: nowy przycisk "Zobacz pełny panel" w istniejącym
`UsageStatsSection.tsx` (karcie w podstronie "Dane"), która zostaje jako szybki podgląd
na miejscu — pełny ekran to osobna, bogatsza warstwa, nie zamiennik.

**"Może się ładować chwilkę, to nie main"** — user świadomie zaakceptował że to nie musi
być błyskawiczne. W praktyce niepotrzebne: nawet przy pełnym capie 3000 zdarzeń,
bucketowanie to pojedyncza pętla po tablicy — liczone synchronicznie w `useMemo` przy
wejściu na ekran, bez zauważalnego opóźnienia nawet na słabszym telefonie. Brak sztucznego
stanu ładowania.

**To ostatni z 7 zgłoszeń z jednej wiadomości usera (§98-102)** — cała runda "Sprzątanie
Ustawień" zamknięta.

`tsc --noEmit` czyste. `jest`: 73 suity/964 testy (+1 nowa suita, +6 testów —
`usageStatsAnalysis.test.ts`, czyste funkcje bez potrzeby mockowania Zustand/AsyncStorage).

**Priorytet testu na urządzeniu**: (1) Ustawienia → Dane → "Statystyki apki" → "Zobacz
pełny panel" otwiera nowy ekran; (2) wykres dzienny pokazuje realny wzorzec ostatnich 14
dni (słupek "dziś" wyróżniony kolorem); (3) rozkład godzinowy ma sensowny kształt (szczyt
w porach faktycznego używania apki); (4) ranking pokazuje WSZYSTKIE odwiedzone ekrany, nie
tylko top 6; (5) "Wyczyść statystyki" na nowym ekranie faktycznie zeruje też kartę w
Ustawieniach (ten sam store).

---

## 103. Optymalizacja wydajności, runda 2 — audyt statyczny (2026-09-15)

User: "dawaj dalej... a potem optymalizacja ta co mówiłeś" — odniesienie do §13
(2026-09-02), gdzie na ogólną prośbę o "dalszą optymalizację apki" zrobiony był statyczny
audyt kodu (brak dostępu do profilera na urządzeniu) pod kątem realnych, ewidencjonowanych
problemów zamiast zgadywania. Ta runda to to samo podejście, po tygodniu nowego kodu
(overhaul Ustawień §98-102). Audyt zrobiony agentem Explore, każde znalezisko zweryfikowane
ręcznie przed poprawką (żadne nie przyjęte "na słowo").

Trzy potwierdzone, naprawione:

1. **`app/(tabs)/finances.tsx` — wyszukiwarka tagu przeliczała WSZYSTKO nad CAŁĄ historią
   na każdy klawisz, gorzej niż oryginalny bug z §13.** Pole "Szukaj tagu" (dodane
   2026-09-12) pisze do `activeTagFilter` per klawisz. Dotąd JEDEN `useMemo` (`sections`)
   miał `activeTagFilter` w deps razem z filtrami strukturalnymi (typ/płatnik/płatność/
   kwota/rachunek) — i ponieważ `capTx` (cięcie do 31 dni) świadomie spada do `false` gdy
   JAKIKOLWIEK filtr jest aktywny (w tym tag — "filtry zawsze przeszukują całą historię"),
   pierwszy wpisany znak porzucał cięcie i KAŻDY kolejny klawisz przeliczał filtr
   strukturalny + zagnieżdżony skan `receiptItems` nad CAŁĄ, nieograniczoną historią
   transakcji. Fix (ten sam kształt co §13 fix #2): rozbite na `structuralFiltered`
   (filtry rzadko zmieniające się — deps bez `activeTagFilter`, `capTx` jako boolean
   zmienia się tylko RAZ na sesję wpisywania, nie per klawisz) i `sections` (dokłada
   WYŁĄCZNIE dopasowanie tagu, na już przefiltrowanym wejściu). Semantyka "tag szuka całej
   historii" zachowana bez zmian — poprawiony jest tylko koszt, nie zachowanie.
2. **`app/achievements.tsx` — 99 odznak bez memoizacji.** Każdy wiersz to był goły
   `TouchableOpacity` w `.map()` z inline `onPress={() => { haptic.tap(); setDetail(st); }}`
   — nowa closure na wiersz przy KAŻDYM renderze rodzica, więc samo otwarcie/zamknięcie
   modala szczegółów (`setDetail`) przerysowywało wszystkie 99 komórek (w tym `BadgeArt` —
   Image + halo/pulse animacja dla legendarnych). Fix (ten sam kształt co §13 fix #1,
   `notes.tsx`): nowy `AchievementCell` (`React.memo`), stabilny `onSelect`
   (`useCallback` puste deps) z rodzica, `s`/`c` (style/kolory) jako propsy zamiast
   osobnego `useColors()`/`useMemo` w każdej z 99 instancji.
3. **`app/expenses/manual.tsx` — `ItemRow` (edytor pozycji paragonu) bez memoizacji.**
   Ten sam kształt buga co #2, aplikowany do multi-item skanów paragonów (20-40+ pozycji
   realistyczne). `updateItem`/`deleteItem`/`toggleGroup` w rodzicu owinięte
   `useCallback` (puste deps — bezpieczne, bo używają WYŁĄCZNIE funkcyjnej formy
   `setItems(prev => ...)`, nigdy nie czytają `items` z domknięcia) i przekazywane
   BEZPOŚREDNIO (nie `u => updateItem(item.id, u)`); `ItemRow` sam binduje je do
   `item.id` lokalnym `useCallback` na starcie, więc reszta ciała funkcji (11 miejsc
   wołających `onUpdate({...})`) zostaje nietknięta — zmienia się tylko sygnatura
   propsów + `React.memo` na całym komponencie.

**Sprawdzone, bez regresji** (agent zweryfikował, nie znaleziono nowych wystąpień): żadne
nowe `StyleSheet.create` poza `themedStyles()`/modułowym scope (reguła #1 CLAUDE.md nadal
przestrzegana wszędzie); żadne nowe przewymiarowane assety (tła lokacji/portrety bossów są
już świadomie przyciosane, patrz §13 fix #4 i komentarze w `bossIcons.ts`);
`app/products.tsx`/`app/search.tsx` (oba dotąd naprawione w §13) wciąż poprawnie rozbite na
base/filtered `useMemo`.

`tsc --noEmit` czyste. `jest`: 73 suity/964 testy bez zmian (czysto wydajnościowe fixy,
identyczna logika biznesowa — żadna nowa/zmieniona logika do przetestowania).

**Priorytet testu na urządzeniu**: (1) Finanse → wpisz coś w "Szukaj tagu" mając sporo
transakcji — powinno czuć się responsywniej niż wcześniej, wyniki nadal obejmują CAŁĄ
historię (nie tylko ostatnie 31 dni); (2) Gablota (Osiągnięcia) — otwórz/zamknij szczegóły
odznaki kilka razy, scrolluj listę — zero zmiany funkcjonalnej (te same odznaki, te same
paski postępu), tylko powinno czuć się płynniej przy 99 pozycjach; (3) Dodaj ręczny
paragon z kilkunastoma pozycjami, edytuj nazwę/cenę/tagi w jednej z nich — reszta pozycji
nie powinna "migać"/przerysowywać się, funkcjonalnie identycznie jak wcześniej (grupowanie
cen, sugestie z pamięci, tagi).

---

## 104. Audyt poprawności — 3 realne bugi znalezione i naprawione (2026-09-15)

User: "dawaj dalej... i analiza" — po dwóch rundach optymalizacji wydajności (§13, §103),
ten sam statyczny audyt, tym razem szukający realnych bugów logicznych, nie wolnej pracy.
Agent Explore znalazł kandydatów, każdy zweryfikowany ręcznie przed poprawką (jeden
kandydat — wyścig przy migracji `migratePaydayDefaultOff`/`getPaydayConfig` — świadomie
NIE naprawiony, agent sam ocenił go jako niepewny i niskiego wpływu: najgorszy scenariusz
to jeden nieaktualny prompt "dostałeś wypłatę?" przy pierwszym starcie po migracji).

**1. Przełącznik "Przelew własny" w edycji transakcji nie odzwierciedlał ani nie
zmieniał prawdziwego stanu dla przelewów wykrytych z banku.** `app/expenses/[id].tsx`.
`isSelfTransfer()` (statWidgets.ts) uznaje za self-transfer `category === 'transfer'`
ORAZ tagi oszczednosci/oszczędnościowe/przelew/revolut — ale przełącznik w trybie edycji
patrzył WYŁĄCZNIE na tag `'przelew'`. Auto-wykryte przelewy własne z banku zapisują się z
`category: 'transfer', tags: ['revolut']` (bankIngest.ts) — NIGDY z tagiem `'przelew'`.
Efekt: otwórz do edycji auto-wykryty przelew Revolut → tryb odczytu (ten sam ekran, kawałek
wyżej) poprawnie pokazuje "Tak", ale przełącznik w edycji pokazuje WYŁĄCZONY; próba
"wyłączenia" (dodanie tagu przelew) nic nie zmienia bo `category` zostaje 'transfer' —
user nie ma ŻADNEJ drogi, żeby z tego ekranu faktycznie cofnąć klasyfikację self-transfer
takiej transakcji. Fix: przełącznik czyta/pisze pełną semantykę `isSelfTransfer` (nowy
`toggleSelfTransfer` — włączenie dodaje tag 'przelew' jak dotąd; wyłączenie czyści
WSZYSTKIE tagi self-transferowe I resetuje kategorię z 'transfer' na neutralny fallback
— 'other' dla wydatku, 'other_income' dla przychodu). `SELF_TRANSFER_TAGS` wyeksportowany
ze statWidgets.ts zamiast duplikować listę tagów w drugim miejscu.

**2. "Zapisz przypomnienia" po cichu z powrotem włączało Humor nawet gdy user go jawnie
wyłączył.** `app/settings.tsx`, `saveReminders()`. Bezwarunkowe wywołanie
`scheduleDailyMoodReminder` (które samo zapisuje `notif_mood_enabled: 'true'` przy okazji
planowania) — user wyłącza Humor osobnym przełącznikiem (§101, `moodEnabled=false`,
powiadomienie anulowane, flaga 'false'), potem edytuje i zapisuje NIEZWIĄZANE ustawienie
(Poranne/Lista zadań/Nawyki) przez ten sam przycisk "Zapisz przypomnienia" — co po cichu
re-planuje Humor i nadpisuje flagę z powrotem na 'true', mimo że przełącznik na ekranie
wciąż pokazuje WYŁĄCZONY (aż do przeładowania). Ten sam kształt buga co dwa już naprawione
w §101 (etykieta/stan przełącznika niezgodny z jego realnym efektem). Fix: `if (moodEnabled)
schedule else cancel`; walidacja godziny wieczornej też przeniesiona pod `moodEnabled`
(pole jest wtedy w ogóle niewidoczne — nie ma powodu blokować zapisu reszty błędem o
niewidocznym polu).

**3. Self-transfer wyciekał do jedzenia/słodyczy/rozbicia "wg kategorii" w statWidgets.ts
— ten sam kształt buga co §93 (8 miejsc), teraz 3 kolejne.** Niespójność WEWNĄTRZ
pojedynczych funkcji: `bucketValue`'s `case 'food'` wykluczał self-transfer, `case
'sweets'` tuż niżej — nie; `dailyValue`'s `case 'spend'`/`'income'` wykluczały,
`case 'food'`/`'sweets'` — nie; `metricList`'s `byCategory` w ogóle nie sprawdzał. Fix:
`isSelfTransfer(e)` dodane do wszystkich czterech brakujących miejsc — identyczny
warunek co już działający w sąsiednich `case`'ach w tych samych funkcjach. Nowe testy
regresyjne w `__tests__/financePredicates.test.ts` (3 nowe, sprawdzają że self-transfer
faktycznie nie wlicza się, a prawdziwe wydatki dalej się liczą poprawnie).

`tsc --noEmit` czyste. `jest`: 73 suity/967 testów (+3 nowe, regresja na fix #3).

**Priorytet testu na urządzeniu**: (1) otwórz auto-wykryty przelew Revolut → edytuj →
przełącznik "Przelew własny" pokazuje WŁĄCZONY (zgodnie z trybem odczytu), wyłącz go i
zapisz → transakcja powinna zacząć liczyć się jako normalny wydatek/przychód (kategoria
"Inne"); (2) wyłącz Humor, potem zmień i zapisz Poranne/Listę zadań/Nawyki → Humor MA
zostać wyłączony (nie wraca po cichu); (3) sprawdź "Statystyki wydatków"/rok w pixelach
dla jedzenia i słodyczy — self-transfer (np. przelew na Revolut) nie powinien pojawiać się
w tych liczbach; sprawdź rozbicie "wg kategorii" na dashboardzie tak samo.

---

## 105. Audyt bezpieczeństwa (2026-09-15)

Trzecia runda tego samego statycznego audytu tej sesji (§13/§103 wydajność, §104
poprawność), tym razem bezpieczeństwo. Repo jest PUBLICZNE (github.com/SokkiEltanin/sapp).
Dwa bezpieczne, techniczne fixy w tym PR; dwa poważniejsze znaleziska przekazane
bezpośrednio userowi w czacie (wymagają decyzji poza repo, nie coś co można po cichu
"naprawić" edycją kodu) — patrz NEXT_STEPS.md.

**1. Token OAuth Kalendarza Google wyciekał w eksporcie/kopii danych.**
`backupService.ts`'s `gatherSnapshot()` bierze KAŻDY klucz AsyncStorage poza tymi
zaczynającymi się od `firebase:` i własnym znacznikiem throttle — nie wykluczał
`gcal_access_token` (googleCalendarService.ts). Eksport JSON (przycisk w Ustawieniach →
Dane) ląduje w systemowym share-sheecie (mail/chmura/komunikator) — żywy token OAuth
(krótkotrwały, ~1h, ale bez powodu żeby w ogóle tam być) leciał w czystym tekście razem z
resztą danych. Fix: `EXCLUDED_LOCAL_KEYS` (nowa lista, dziś jeden wpis) filtrowana obok
istniejących wykluczeń. Bez wpływu na restore — token i tak odtwarza się na nowo z
bezpiecznie przechowywanej sesji natywnego Google Sign-In SDK.

**2. `.gitignore` mylący wpis dla `google-services.json`.** Plik jest CELOWO
commitowany (publiczna konfiguracja klienta Firebase — `apiKey`/`appId` dla apki mobilnej
NIE są sekretem, bezpieczeństwo egzekwują reguły Firestore po stronie serwera) i wymagany
przez `build.yml` (`cp google-services.json android/app/`), ale `.gitignore` oznaczał go
jako "sensitive" — nigdy realnie nic nie chował (plik był już śledzony PRZED dodaniem tej
reguły), tylko mylił co do intencji. Usunięty wpis, zastąpiony komentarzem wyjaśniającym.

**Przekazane bezpośrednio userowi (NIE naprawione w tym PR)**:
- **Hasło do keystore'a podpisującego release Androida jest hardkodowane w czystym
  tekście w `build.yml` (3 miejsca), w publicznym repo.** Sam plik keystore trzymany
  poprawnie (`KEYSTORE_BASE64` to prawdziwy GitHub Secret), ale hasło który go chroni —
  nie. To jest permanentnie w historii gita. Prawdziwa naprawa wymaga ROTACJI (nowy
  keystore + nowe hasło jako GitHub Secret) — konsekwencyjna, potencjalnie łamiąca
  publikowanie aktualizacji na Play Store jeśli apka już tam jest (wymaga TEGO SAMEGO
  klucza podpisującego dla update'ów, chyba że używane jest Play App Signing) — decyzja
  usera, nie coś do zrobienia bez pytania.
- **Reguły bezpieczeństwa Firestore nie istnieją nigdzie w repo** — żyją w konsoli
  Firebase, poza zasięgiem tego audytu. Zalecenie: sprawdzić w konsoli że każda ścieżka
  `users/{uid}/...` wymaga `request.auth.uid == uid`, nie tylko `request.auth != null`
  (klient loguje się anonimowo jeśli normalny auth nie rozwiąże się w 4s —
  `firebase.ts`, `signInAnonymously()` — anonimowe logowanie jest trywialnie dostępne
  dla każdego kto ma publiczny `apiKey` projektu).

**Sprawdzone, świadomie NIE zmienione (niski priorytet)**: fallback "wygląda jak
powiadomienie z banku" w natywnym listenerze (`withBankNotificationListener.js`) łapie
też treść spoza 3 dopuszczonych paczek bankowych po słowach-kluczach — teoretycznie
dowolna apka mogłaby wysłać spreparowane powiadomienie, ale wymaga to (a) usera który już
przyznał szeroki dostęp "Dostęp do powiadomień", (b) usera z włączonym "Dodawaj
automatycznie" — a najgorszy scenariusz to błędnie dodany wydatek do poprawienia, nie
wyciek danych. Token Kalendarza Google w zwykłym AsyncStorage zamiast
`expo-secure-store` — też niski priorytet, token krótkotrwały, re-derywowany z
bezpiecznej sesji SDK.

`tsc --noEmit` czyste. `jest`: 73 suity/967 testów bez zmian (czysto naprawcze fixy, nic
nowego do przetestowania jednostkowo).

**Priorytet testu na urządzeniu**: wyeksportuj dane (Ustawienia → Dane → eksport JSON) —
plik NIE powinien zawierać `gcal_access_token`; reszta eksportu (wydatki/nastrój/itd.)
bez zmian.

## 106. Rotacja keystore'a podpisującego — domknięcie §105 (2026-09-15)

User potwierdził: apka NIE jest publikowana na Google Play (tylko GitHub Releases +
własne urządzenie) — usuwa to główne ryzyko rotacji (łamanie aktualizacji istniejącej
publikacji na Play, bo Play wymaga tego samego klucza podpisującego dla update'ów).

**Co zrobione.** Nowy keystore (`keytool -genkeypair`, RSA 2048, alias `sapp` — bez
zmian, `build.yml` go oczekuje) + nowe, losowe 32-znakowe hasło wygenerowane lokalnie w
sesji, wysłane userowi (`SendUserFile`, nie wklejone gołym tekstem na czacie) razem z
instrukcją krok po kroku. User zapisał: `KEYSTORE_BASE64` (istniejący sekret,
zaktualizowany) i `ANDROID_KEYSTORE_PASSWORD` (nowy sekret). `build.yml`
zaktualizowany — 3 miejsca z `sapp123release` wpisanym na sztywno zastąpione odczytem z
`${{ secrets.ANDROID_KEYSTORE_PASSWORD }}` przez `env:` na każdym kroku (GitHub Actions
automatycznie maskuje w logach każdy string pasujący do użytego sekretu — także w kroku
`tail gradle.properties`, który wcześniej wypisywał zawartość pliku z hasłem w środku).

**Świadomie NIE zrobione**: przepisanie historii gita żeby usunąć stare
`sapp123release` — technicznie możliwe (`git filter-repo`), ale dużo bardziej
ryzykowne/destrukcyjne niż warte tego problemu, skoro stare hasło już nic nie chroni
(stary keystore przestał być używany). Zostaje trwale w historii, ale to martwy sekret.

**Priorytet po następnym buildzie z GitHub Actions**: nowy APK ma INNY podpis — Android
odmówi zainstalowania go jako aktualizacji nad obecną apką. User musi: (1) opcjonalnie
zrobić kopię zapasową w apce (Ustawienia → Dane → Kopia zapasowa — dane i tak są w
chmurze Firestore, więc to tylko dodatkowe zabezpieczenie); (2) odinstalować obecną
apkę; (3) zainstalować nowy APK, zalogować się tym samym kontem Google.

## 107. Fix: tło lokacji misji (§na 2026-09-14) trafiało za GearPanel zamiast do paska ładowania

User (ze screenshotem ekranu Pupila w trakcie misji "Lodowa Kraina"): *"I te obrazy miały
być tylko w tym pasku ładowania jakby że się ładuje lodowa kraina a nie w tle xd"*.

**Bug.** `LOKALIZACJA_LODOWA.png` (dodany 2026-09-14, §wpis w tym pliku wyżej) renderował
się jako `StyleSheet.absoluteFillObject` na CAŁYM `s.stage` (300px, cała scena z kotkiem
+ 6 slotami `GearPanel`) — czyli tło zalewało też ekwipunek, mimo że miało być tylko
dekoracją paska postępu misji ("ładuje się kraina X").

**Fix** (`app/pet.tsx`): przeniesiony art + scrim z `s.stage` do wnętrza
`s.missionBarTrack` (sam pasek postępu, ma już `overflow:'hidden'` + zaokrąglone rogi —
idealny kontener bez dodatkowych stylów). Renderuje się tam jako tekstura toru, pod
niebieskim `missionBarFillWrap` — wypełnienie "odsłania" resztę paska w miarę postępu,
dokładnie efekt "ładowania krainy" o który chodziło. Scena z kotkiem/gearem wróciła do
czystego wyglądu sprzed 2026-09-14 (bez tła za sobą), niezależnie od tego czy dla danego
minibossa istnieje dedykowany art (`missionLocationBg` dalej może zwrócić `undefined` —
wtedy pasek wygląda jak zawsze, `c.bg.elevated`). Zero zmian w `minibosses.ts` czy w
logice doboru arta — tylko przeniesienie renderowania.

## 108. Statystyki otwierania skrzynek Rynku (per typ skrzynki, do balansowania) — 2026-09-15

User: *"niech mi tez da statystyki tam otwierania skrzynek (procentowe, zysk,strata itp
itd zeby balansować trochę pozniej - bo teraz najtańsza skrzynka kosztuje 35 a co raz
dropie po 60, 80 monet z niej jako common i dodatkowo nie wiem czemu legendarne coiny to
tylko 40 xd , ale to nic nie zmieniaj ja pootwieram ze statystykami podzielonym per
skrzynka zeby wiedzieć jak balansować nie q ciemno"*.

**Zakres: czysta instrumentacja, ZERO zmian w ekonomii.** Nic w `petBoxes.ts`
(`LOOT_BOXES`, koszty, `gearChance`/`combatItemChance`/`gearRarityWeight`, zakresy monet,
`rollBox()`) nie zostało ruszone — user świadomie chce najpierw nazbierać danych, dopiero
potem (osobne zadanie) decydować o rebalansie.

**Store** (`src/store/boxStatsStore.ts`) — capped event-log, ten sam wzorzec co
`usageStatsStore.events`/`bankQueueStore.history` (cap 3000, `persist` + AsyncStorage,
WYŁĄCZNIE lokalnie, nigdzie nie wysyłane). Każdy wpis: `{at, boxId, daily, cost,
rewardType, coins?, rarity?}`. `daily` jest kluczowy — DAILY_BOX i "Drewniana skrzynka"
(pierwsza z `LOOT_BOXES`) mają TEN SAM `BoxId: 'sardine'` w `petBoxes.ts` (różny obiekt,
ten sam identyfikator), więc bez tej flagi darmowe otwarcia (cost 0) mieszałyby się z
płatnymi w tej samej grupie statystyk i fałszowały bilans monet.

**Punkty logowania** (dokładnie 2, jedyne miejsca w apce wołające `rollBox()`):
`onBuyBox` w `app/pet-shop.tsx` (płatne, `daily:false`, `cost:box.cost`) i `onDailyBox` w
`app/pet.tsx` (darmowa, `daily:true`, `cost:0`). Log pisany PO rozstrzygnięciu nagrody
(ten sam `reward` obiekt co idzie do `BoxRevealModal`), więc żadnego dodatkowego losowania
ani ryzyka rozjazdu z tym co user faktycznie dostał.

**Analiza** (`src/utils/boxStatsAnalysis.ts`, `computeBoxStats()`) — grupuje po
`(boxId, daily)`, per grupa liczy: `opens`, `totalCost`, `totalCoinsWon`, `netCoins`
(= wygrane − wydane, dodatnie = skrzynka "opłaca się" w samych monetach), rozkład %
typu nagrody (monety/ekwipunek/umiejętność), rozkład rzadkości NAGRÓD MONETOWYCH
(`basic` vs `legendary` czyli jackpot — DOKŁADNIE to, o co user pyta: "common" 60-80 vs
"legendarne" 40) ze średnią kwotą per rzadkość, i rozkład rzadkości ekwipunku
(common/rare/epic/legendary/mythic). Pokryte testem (`__tests__/boxStatsAnalysis.test.ts`)
— w tym explicit test na rozdzielenie darmowej/płatnej skrzynki o tym samym `boxId`.

**UI**: pełny panel `app/box-stats.tsx` (karta per typ skrzynki: pasek segmentowy typu
nagrody + listy rzadkości + bilans monet) + skrócona karta `BoxStatsSection.tsx` w
Ustawienia → Dane, sąsiad `UsageStatsSection` (§102) — identyczny layout/wzorzec
("Zobacz pełny panel" + reset), tylko inne dane. Wpięta w `app/settings.tsx` obok
`<UsageStatsSection />`.

**Świadomie NIE zrobione**: rozbicie rzadkości `combatItem` (umiejętności) — próg
`combatItemChance` jest mały (2-16%) i user pytał głównie o monety/ekwipunek; % udziału
tego typu nagrody jest widoczny w pasku segmentowym, samego rozkładu rzadkości brak. Można
dodać identycznym wzorcem co `coinRarityBreakdown`/`gearRarityBreakdown`, jeśli user
zapyta.

## 109. Fix: parser powiadomień bankowych mylił płatność BLIK z przelewem wychodzącym

User (test na dokładnym stringu, zgodnie z zasadą #5 w CLAUDE.md): *"a czy takie złapie
dobrze ze to płatność kartą (bo BLik) i ze to z decathlon?"* — `"Zapłacono BLIK-iem na
kwotę 59,98 PLN z konta *6332 w DECATHLON SP. Z O.O.. Bank Pekao S.A."`.

**Bug** (`src/utils/bankNotification.ts`, `isTransferOut`, linia ~96): regex miał trzeci
alternatyw `z\s+konta\s+\*?\d`, myślany jako fallback dla prawdziwych przelewów, ale Pekao
używa DOKŁADNIE tej samej frazy ("z konta *XXXX" = konto obciążone) w powiadomieniach
BLIK/kartowych. Efekt: ta konkretna notyfikacja BLIK trafiała w gałąź "Outgoing TRANSFER"
zamiast "Outgoing card payment" — kwota i kierunek (`out`) wychodziły poprawnie, ale sklep
gubił się na rzecz generycznego `"Przelew wychodzący"` i `method` było `'transfer'`
zamiast `'blik'`. Potwierdzone REALNYM URUCHOMIENIEM parsera (jednorazowy plik testowy w
`__tests__/`, usunięty po weryfikacji), nie samym czytaniem regexów.

**Fix**: `z\s+konta\s+\*?\d` usunięty z `isTransferOut` (zostaje w `paidOut` wyżej — tam
tylko ustala kierunek out/in, nieszkodliwe). Prawdziwe przelewy Pekao zawsze zaczynają się
od "Wykonano przelew"/"Zlecono przelew" — te dwa alternatywy już wystarczają, jak pokazują
istniejące testy `SELF_OUT`/`SELF_OUT_BY_NAME`. Nowy test regresyjny w
`__tests__/bankNotification.test.ts` (`BLIK_DECATHLON`) pilnuje że się nie powtórzy —
`tsc`/`jest` czyste (972/972).

## 110. Fix: "Saldo (na karcie)" na dashboardzie finansów liczyło też gotówkę

User: *"czy naprawione jest ze jak place gotowka to naprawdę nie liczy sie do sumy calej
(bo ta wyświetlana to Suma na karcie mojej [to nie ma byc kartą + gotowka]"*.

**Bug** (`app/(tabs)/finances.tsx`, `monthTotals` useMemo): `allExp`/`allInc` (jedyny
konsument: `balance` = "Saldo", etykieta "NA KARCIE" wprost w komentarzu w kodzie)
sumowały KAŻDY wydatek/przychód `mine`, bez filtra po `paymentMethod` — gotówka wchodziła
do tej samej sumy co karta. `cashExp`/`cashInc` obok były liczone POPRAWNIE osobno (dla
przyszłego rozbicia kartowego/gotówkowego), ale nigdy nie zostały odjęte od
`allExp`/`allInc` przy liczeniu `balance` — czysto martwy kod, nic go nie czytało.

**Fix**: `allExp`/`allInc` teraz WYKLUCZAJĄ `paymentMethod === 'cash'` już przy akumulacji
(ten sam filtr co `updateCardBalancePeak()` w `accountBalance.ts`:
`e.paymentMethod !== 'cash'` — dwa niezależne miejsca w kodzie implementujące "saldo karty"
były niespójne, teraz jedno z nich naprawione do zgodności z drugim). `cashExp`/`cashInc`
zostają bez zmian (dalej liczone, dalej niewykorzystywane nigdzie indziej — nie w zakresie
tego zgłoszenia, żeby to naprawić/dodać osobny widok gotówki). `tsc` czyste — logika jest
inline w komponencie (`useMemo`, nie eksportowana czysta funkcja), więc bez jednostkowego
testu; zweryfikowane ręcznie czytaniem jedynego konsumenta (`balance` w linii ~262).

## 111. Rozbudowa kategorii jedzenia (8 nowych) + fix brakujących słów kluczowych "sosy"

User: *"na dashbordzie jak mamy wydatki per kategoria z jedzeniem proponuję lekko
rozbudowac o inne kategorie bo ciężko dopasować i sporo jest w inne"* — lista: Inne
jedzenie, Nabiał, Pieczywo, Owoce, Sosy, Mięso, Słodycze, Przekąski, Warzywa, Ryby, Napoje,
Jajka, Makarony, Ryż i kasze, Konserwy i przetwory, Mąka i produkty sypkie, Oleje i
tłuszcze, Przyprawy, Mrożonki, Gotowe dania.

**Dwa systemy, jeden słownik tagów** (patrz też §14): `FOOD_SUBCATS` (`src/utils/food.ts`)
= label+kolor+KOLEJNOŚĆ PRIORYTETU dla `foodSubcat()`; `FOOD_TAG_MAP`
(`src/utils/receiptParser.ts`) = realne słowa kluczowe dla `getFoodTags()`, które
auto-tagują pozycje paragonu. Oba muszą się zgadzać string-for-string.

**Real bug znaleziony przy okazji**: tag `sosy` ISTNIAŁ już w `FOOD_SUBCATS`, ale miał
**ZERO** słów kluczowych w `FOOD_TAG_MAP` — żaden sos/ketchup/majonez nigdy się pod niego
nie podpinał, zawsze lądował w "Inne". Dokładnie ta "ciężko dopasować" luka, o którą user
pytał — nie tylko subiektywne wrażenie, realna dziura w danych.

**8 nowych tagów**: jajka (wydzielone z nabiału, wcześniej 'jaj'/'jajca' siedziały tam),
makarony, ryż i kasze, mąka i produkty sypkie, oleje i tłuszcze, przyprawy, konserwy i
przetwory, mrożonki (wydzielone z 'dania gotowe' — bare 'mrożon' tam łapało też np.
"Warzywa mrożone mix", nie tylko gotowe dania).

**Kolejność w `FOOD_SUBCATS` = priorytet rozstrzygania** (pierwszy pasujący tag wygrywa,
`foodSubcat()`) — zweryfikowane URUCHOMIENIEM testów na realnych nazwach, nie samym
czytaniem list (zgodnie z zasadą #5 w CLAUDE.md), bo pierwsza wersja miała 2 realne
kolizje: "Dżem truskawkowy" łapał się jako 'owoce' (przez "truskawk"), "Sos pomidorowy"
jako 'warzywa' (przez "pomidor"). Fix: `sosy`/`przyprawy`/`konserwy i przetwory` (kategorie
"stanu przetworzenia") przesunięte WYSOKO, zaraz po `mięso`, PRZED
warzywa/owoce/nabiał/ryby — te trzy łapią się WEWNĄTRZ nazw zawierających też surowy
składnik i muszą wygrywać. `mrożonki` zostaje NISKO (po `dania gotowe`) — fallback tylko
gdy nic konkretniejszego nie pasuje ("Mrożony łosoś" nadal → ryby, "Pizza mrożona" → dania
gotowe, tylko goły "Mrożonki mix" bez nic innego → mrożonki). Kolejność ISTNIEJĄCYCH tagów
między sobą (nabiał→ryby→warzywa→owoce→pieczywo→słodycze→napoje→przekąski→dania gotowe)
CELOWO nietknięta — nic co wcześniej działało poprawnie się nie zmienia.

**Świadomie NIE naprawione** (udokumentowana granica, nie bug): "Przyprawa do kurczaka"
łapie się jako `mięso` (przez "kurczak"), nie `przyprawy` — odwrócenie kolejności
naprawiłoby to, ale zepsułoby "Pieprzowa kiełbasa" (prawdziwy produkt mięsny, musi zostać
`mięso`). Nie da się rozstrzygnąć obu poprawnie samym dopasowaniem podciągów bez analizy
kolejności słów w nazwie — test w `receiptParser.test.ts` dokumentuje to jako znane
zachowanie, nie próbuje "naprawić" kosztem czegoś innego.

**UI**: oba miejsca czytające `FOOD_SUBCATS`/`FOOD_SUBCAT_META` (chip-picker kategorii w
`app/food/product.tsx` — `flexWrap:'wrap'`, i lista rozkładu wydatków w
`app/(tabs)/index.tsx` — zwykła pionowa lista wierszy) skalują się do więcej kategorii bez
żadnej zmiany kodu — sprawdzone czytaniem stylów (`catWrap: {flexWrap:'wrap'}`), nie
zgadywaniem.

Nowe testy w `__tests__/receiptParser.test.ts` (8 nowych kategorii + fix sosów + 2
kolizje-teraz-naprawione + 1 udokumentowana granica) — `tsc`/`jest` czyste (74 suity/978
testów).

**Świadomie NIE zrobione**: przy okazji "Kto jadł" na paragonach — user pytał czy to
usunięte. NIE — to inny, celowo zachowany feature z §78 (widget DASHBOARDU "Kto zjadł
słodycze" usunięty na życzenie 2026-09-08, ale per-pozycji "Kto jadł" w edycji paragonu
(`app/expenses/[id].tsx`) zostało celowo, sprawdzone że dalej działa w bieżącym kodzie).

## 112. Fix: edycja tagów/kategorii w Finanse → Produkty nic wizualnie nie zmieniała

User (opisując dokładny scenariusz, caps-lock z frustracji): *"FINANSE>PRODUKTY>WYSZUKAJ>
JAJA WPISAŁEM > KLIKNĄŁEM ZMIENIŁEM TAG NA "JAJA" KLIKNĄŁEM ZAPISZ > WRÓCIŁO MI DO
PRODUKTY (Z TYM WYSZUKANYM JAJA) ALE NIE ZAPISAŁO MI PRODUKTU I MUSZĘ MIEĆ TAM ODNOŚNIK
GDZIE W FINANSACH JEST TEN PRODUKT I KIEDY DO PARAGONU ORAZ LEPSZĄ EDYCJĘ TAM TYCH TAGÓW
MOŻE"*.

**Bug** (`app/products.tsx`, `saveEdit()`): tag/kategoria trafiały WYŁĄCZNIE do
`productMemory`'s `saveCustomTagsToMemory`/`saveCustomProductsToMemory` — podpowiedź na
PRZYSZŁOŚĆ (następny skan/edycja produktu o tej nazwie), nigdy nie zapisywane WSTECZ na
już istniejących pozycjach paragonów. Sam ekran "Produkty" wyświetla tagi CZYTAJĄC WPROST
z historycznych `expenses.receiptItems` (`products` useMemo, linia ~89-104) — więc
"Zapisz" faktycznie coś zapisywało (do memory), ale ekran, na który user wracał, nigdy
tego nie odzwierciedlał. Dokładnie ta "wróciło do Produkty, ale nie zapisało" obserwacja.

**Fix**: `saveEdit()` teraz DODATKOWO retroaktywnie nadpisuje `tags`/`category` na KAŻDEJ
pozycji paragonu pasującej do tego produktu (ta sama normalizacja nazwy —
`normalizeProductName(canonicalProductName(...))` — co przy grupowaniu w `products`),
przez `expensesService.update(id, { receiptItems: newItems })` na każdym pasującym
wydatku, potem `reload()`. `productMemory` zostaje bez zmian (dalej karmi podpowiedzi przy
przyszłych skanach) — to dodatek, nie zamiennik.

**Dwie dodatkowe rzeczy z tego samego zgłoszenia**:
1. **"Odnośnik gdzie i kiedy"** — nowa sekcja "Historia zakupów" w modalu edycji: lista
   {data, sklep, cena} dla każdego wystąpienia produktu, tap → prosto do tego konkretnego
   `/expenses/[id]` (ten sam wzorzec nawigacji co `search.tsx`/`vehicles.tsx`).
2. **"Lepsza edycja tagów"** — zamiast surowego pola tekstowego (przecinki, żadnej
   podpowiedzi, łatwo o literówkę rozjeżdżającą się z resztą słownika), teraz chip-picker
   identyczny z już istniejącym w `app/expenses/[id].tsx` (`ITEM_TAGS` + `allKnownTags`
   z pamięci tagów + pole "własny") — ta sama, sprawdzona konwencja UI, nie nowy wzorzec.

`tsc`/`jest` czyste (74 suity/978 testów, logika ekranu nie jest wydzielona do czystej
funkcji więc bez nowego testu jednostkowego — zweryfikowane czytaniem, ten sam wzorzec co
§110). **Priorytet testu na urządzeniu**: Finanse → Produkty → znajdź produkt → zmień tag
→ Zapisz → sprawdź że lista NATYCHMIAST pokazuje nowy tag (nie tylko przy następnym
skanie) i że "Historia zakupów" faktycznie prowadzi do właściwego paragonu.

## 113. Redesign szczegółów transakcji (`app/expenses/[id].tsx`) + historia zmian + long-press

User przysłał 3 screeny (przychód/paragon/wydatek) z pytaniem: *"moze zrobimy ładniej w
końcu czytelniej i wgle te szczegolowe podglądy finansow i paragonów?"*. Po propozycji
(skondensować rozdrobnione karty w jedną, "Przelew własny" nie zasługuje na całą kartę,
duplikat kategorii w hero+karcie) user: *"Okej zrob ufam ci... tylko to ze edytowania sie
pokazują tez spoko ale moze byc gdzieś szczegóły i tam każdorazowo co edytowano i np co
nauczono lub zapisano do pamięci, I wtedy na głównej finansow możemy dodać ze jak
przytrzymuje kafelek z tranzakcja jakaś od razu sie przenosi na panel edycji tak samo jak
wchodzę na podgląd i klikam na kategorie daje mi mozliwosc edycji a przycis zapisz zeby
byl nad klawiatura zawsze czy cos bo boli wracać w prawy górny"*.

**1. Skonsolidowany tryb odczytu.** Kategoria/Przelew własny/Tagi/Kto zapłacił+Płatność+
Pojazd — dawniej 4-5 osobnych pełnowymiarowych kart — teraz JEDNA karta "Szczegóły" ze
zwartymi wierszami etykieta→wartość (model: sekcja PRODUKTY, która już tak wyglądała).
Tryb EDYCJI zostaje NIETKNIĘTY (te same duże pickery/gridy co wcześniej — edycja
potrzebuje miejsca na interakcję, konsolidacja miała sens tylko dla biernego odczytu).

**2. Tap-to-edit.** Każdy wiersz w "Szczegóły" jest teraz `TouchableOpacity` →
`setEditing(true)` — dotknięcie Kategorii (albo dowolnego innego pola) od razu otwiera
pełny tryb edycji, bez szukania ołówka w prawym górnym rogu. Ołówek w nagłówku ZOSTAJE
(druga, równoległa droga).

**3. Sticky pasek Zapisz/Anuluj nad klawiaturą.** Nowy `stickyBar` — POZA `ScrollView`,
ale WEWNĄTRZ tego samego `KeyboardAvoidingView` co reszta ekranu, więc unosi się razem z
klawiaturą zamiast chować się pod nią. Ikona Zapisz w nagłówku zostaje jako druga,
szybsza droga (bez klawiatury). **"Anuluj" naprawia realny bug, który by inaczej
wprowadził**: tryb odczytu czyta z TYCH SAMYCH zmiennych stanu co edycja (`tags`/`payer`/
`paymentMethod`/...) — samo `setEditing(false)` bez przywrócenia stanu z `expense`
zostawiłoby niezapisane zmiany "wiszące" w widoku odczytu. Nowa `cancelEdit()` odtwarza
dokładnie tę samą logikę synchronizacji co `useEffect` przy `[expense?.id,
expense?.updatedAt]` (linia ~365), tylko wywołaną ręcznie.

**4. Historia zmian** (`src/store/editHistoryStore.ts`, nowy store) — capped log (500,
ten sam wzorzec co `usageStatsStore`/`bankQueueStore`/`boxStatsStore`), WYŁĄCZNIE lokalny.
Jeden wpis PER ZAPIS (nie per pole, jak commit message) — `summarizeChanges()` porównuje
GOTOWE, już sformatowane stringi (etykiety kategorii, "Karta"/"Gotówka", nazwa pojazdu —
nie surowe klucze) między stanem `expense` sprzed edycji a nowymi wartościami, składa w
`"Kategoria: Zakupy → Jedzenie; Tagi: — → słodycze"`. Osobne wpisy z `handleItemSave()`
(edycja pojedynczej pozycji paragonu). Pole `learned` osobno notuje gdy coś TRAFIŁO do
pamięci (kategoria/tagi sprzedawcy w `merchantMemory`, kategoria/tagi produktu w
`productMemory`) — user chciał widzieć nie tylko CO się zmieniło, ale i CO apka
"zapamiętała" na przyszłość. Wyświetlane w rozwijanej sekcji "Historia zmian" pod kartą
Szczegóły, tylko wpisy dla TEJ transakcji (patrz §114 — filtrowanie PRZENIESIONE ze
store'u do `useMemo` w komponencie).

**5. Long-press na kafelku listy → od razu tryb edycji.** `ExpenseItem.tsx` miał prop
`onLongPress` od dawna zadeklarowany, ale NIGDY niepodpięty w `app/(tabs)/finances.tsx`
(martwy kod — long-press był fizycznym no-opem). Podpięty: `onLongPress` →
`router.navigate('/expenses/${id}?edit=1')`; `[id].tsx` czyta `?edit=1` i inicjalizuje
`editing` stan od razu na `true`.

**Świadomie NIE zrobione**: prawdziwe pole-po-polu inline editing bez globalnego trybu
edycji (np. tap na Kategorię pokazujący TYLKO grid kategorii w miejscu, bez przechodzenia
w pełny tryb edycji reszty pól) — to byłby dużo większy przepis architektury tego ekranu
(1300+ linii, wiele współzależnych pól: kwota/data/typ/kategoria/tagi/płatnik). Obecne
rozwiązanie (tap → pełny tryb edycji) daje 90% wygody przy ułamku ryzyka.

`tsc`/`jest` czyste (74 suity/978 testów — brak nowych testów jednostkowych, logika w
komponencie ekranu, ten sam wzorzec co §110/§112). **Priorytet testu na urządzeniu**: (a)
otwórz dowolną transakcję, sprawdź że karta "Szczegóły" jest czytelna i dotknięcie
dowolnego wiersza otwiera edycję; (b) w edycji sprawdź że pasek Zapisz/Anuluj jest
widoczny NAD klawiaturą po dotknięciu pola tekstowego; (c) zmień coś, kliknij Anuluj,
sprawdź że wróciło do STARYCH wartości (nie tylko trybu odczytu); (d) zapisz zmianę,
rozwiń "Historia zmian", sprawdź że opisuje faktycznie to co zmieniono; (e) na liście w
Finansach przytrzymaj dowolny kafelek — powinno otworzyć transakcję OD RAZU w trybie
edycji.

## 114. Self-review §113 przed testem na urządzeniu — 2 realne bugi znalezione i naprawione

User: *"DAWAJ DALEJ"* (bez konkretnego zgłoszenia) — po zamknięciu §113 (świeży, duży
redesign, wysokie ryzyko) druga runda własna: przeczytać na nowo to co się właśnie
wysłało, zanim user zdąży to złapać na urządzeniu. Ten sam odruch co audyty §103/§104 w
tej sesji.

**Bug 1 — `?edit=1` długo-naciśnięty deep-link mógł otworzyć PUSTY formularz edycji.**
Efekt synchronizujący lokalny stan z `expense` (`useEffect` przy `[expense?.id,
expense?.updatedAt]`, linia ~386) był chroniony `if (!expense || editing) return` — co
było BEZPIECZNE zanim `editing` mogło być `true` już na PIERWSZYM renderze (wcześniej
`editing` zawsze startował jako `false`, flip na `true` następował dopiero po tym, jak ten
efekt już raz zdążył wypełnić stan). §113 dodał `useState(editParam === '1')` — `editing`
może być `true` od razu przy pierwszym renderze (long-press na liście), a jeśli `expense`
nie był jeszcze w store (cold start przez deep-link, świeże uruchomienie apki) — TEN SAM
efekt, którego własny komentarz mówi wprost "deep-linked / cold start", nigdy by nie
wypełnił stanu, bo `editing` było już `true`. Efekt: formularz edycji pokazujący puste/
domyślne wartości zamiast prawdziwej transakcji. Fix: `hydratedOnce` ref przepuszcza
PIERWSZE udane wypełnienie niezależnie od `editing`, chroniąc tylko KOLEJNE (prawdziwe
"nie nadpisuj mnie w trakcie edycji").

**Bug 2 — niestabilny selektor Zustand.** `useEditHistory(st => st.forExpense(id))` —
`forExpense()` budował NOWĄ przefiltrowaną+posortowaną tablicę przy KAŻDYM wywołaniu.
Jako selektor Reacta to niestabilna referencja (ten sam kształt problemu co "niestabilne
closures" z audytu wydajności §103) — nie zawiesza apki, ale niepotrzebne rerendery przy
KAŻDEJ zmianie store'u (nawet innej transakcji). Fix: `forExpense()` USUNIĘTE ze store'u;
komponent czyta surowe, stabilne `st.entries` i filtruje przez `useMemo` — dokładnie ten
sam wzorzec co `useBankQueue(st => st.history)` w `BankHistorySection.tsx`.

`tsc`/`jest` czyste (74/978, bez zmian w liczbie testów — obie poprawki to logika
komponentu/store'u bez nowych czystych funkcji do przetestowania jednostkowo).
**Priorytet testu na urządzeniu**: wymuś zimny start (force-stop apki) → otwórz link do
konkretnej transakcji z `?edit=1` (albo: zamknij apkę całkowicie, otwórz Finanse, od razu
przytrzymaj kafelek) → formularz edycji powinien pokazać PRAWDZIWE wartości tej
transakcji, nie puste pola.

## 115. Self-review #224 — 1 realny bug w logu "Historia zmian" (2026-09-17)

User: *"dawaj dalej"* po zmergowaniu #224 (self-review §113/§114) — trzecia runda tego
samego odruchu: przeczytać na nowo `handleSave()` w `app/expenses/[id].tsx`, zamiast
czekać na kolejne zgłoszenie.

**Bug — diff pojazdu w "Historia zmian" mógł pokazać STARĄ nazwę pojazdu w kolumnie "po",
mimo że faktycznie zapisany `vehicleId` był `undefined`.** `updates.vehicleId` (to, co
faktycznie idzie do `expensesService.update()`) poprawnie czyści pojazd, gdy `editIsIncome`
jest `true` (`vehicleId: editIsIncome ? undefined : (vehicleId || undefined)`, linia 674)
— bo pojazd nie ma sensu na przychodzie. Ale `after.vehicle` (string budowany do logu
`summarizeChanges`) liczył się z SUROWEGO lokalnego stanu `vehicleId`, które NIE jest
czyszczone przy przełączeniu typu na Przychód (`setVehicleId` nigdzie na to nie reaguje —
patrz linia 443/1177-1183). Efekt: user edytuje wydatek z przypisanym pojazdem, w tym samym
zapisie przełącza typ na "Przychód" → dane zapisują się poprawnie (bez pojazdu), ale log
Historii zmian pokazuje `Pojazd: Toyota → Toyota` (żadnej zmiany) zamiast `Pojazd: Toyota →
—`, czyli log mówi coś innego niż to, co faktycznie trafiło do bazy. Rzadki przypadek
(zmiana typu I zapisanego pojazdu w jednym zapisie), ale skoro cały sens Historii zmian to
"co się NAPRAWDĘ zmieniło", warto miał być zgodny z `updates`. Fix: `after.vehicle` czyta
teraz `updates.vehicleId` (to samo pole co realny zapis), nie surowe `vehicleId`.

`tsc`/`jest` czyste (74/978, bez zmian w liczbie testów — poprawka jednej linijki w
komponencie, nie osobna czysta funkcja do testu jednostkowego).
**Priorytet testu na urządzeniu**: niski — edytuj wydatek z pojazdem, w tym samym zapisie
przełącz na Przychód i zapisz, sprawdź w "Historia zmian" że linijka Pojazd (jeśli się
pojawi) pokazuje `→ —`, nie starą nazwę pojazdu.

## 116. Redesign ekwipunku pupila — pasek zakładek, tap-outside, sprzedaż zbiorcza (2026-09-17)

User: *"redesign ekwipunku pupila zeby o kliknięciu w sloty otwierał sie ekwipunek
pelnoprawny jednak bo klikanie w te ikonki małe to ból dupy potem zeby trafić w sprzedaj
albo doczytać sie co robi item i wgle, zeby wyjść z eq chciałem kliknąć poza niego ale nie
traf w malutki x zeby wyjść a potem sprzedawanie podobnych itemow z gorszym floatem to tez
masakra"*. Cztery zmiany w `src/components/pet/GearPanel.tsx`, w JEDNYM modalu (nie osobny
full-screen route — mniej ryzyka w nawigacji, ten sam bottom-sheet co dotąd):

1. **Pasek zakładek WSZYSTKICH 6 slotów** u góry modala (ikony z istniejącej `SLOT_ICON`
   mapy) — to jest "ekwipunek pełnoprawny": przełączanie między slotami BEZ zamykania i
   ponownego trafiania w malutką ikonkę na kotku. Żółta kropka na zakładce = są tam
   nie-założone itemy do przejrzenia (ten sam sygnał co dawna `slotDot`).
2. **Tap na tło ZA arkuszem zamyka** — dawniej `overlay`/`sheet` to gołe `View`, jedyna
   droga wyjścia to mały `X` (20px + hitSlop 10). Teraz `overlay` to `Pressable` z
   `onPress={onClose}`, `sheet` to ZAGNIEŻDŻONY `Pressable` z no-op `onPress={() => {}}` —
   standardowy RN wzorzec "backdrop zamyka, zawartość arkusza nie" (touch trafia w
   najgłębszy odpowiadający responder, więc tap wewnątrz arkusza nie bąbelkuje do
   `overlay`). `X` i tak zostaje, powiększony (22px, hitSlop 16, dodatkowy padding).
3. **Przycisk Sprzedaj z realnym hit-targetem** — dawny `sellLink` to był goły podkreślony
   `Text` bez paddingu w ogóle (user: "ciężko trafić w sprzedaż"). Teraz `sellBtn` z tym
   samym paddingiem/kształtem co `equipBtn` obok, plus ikona `Trash2` dla jasności.
4. **Sprzedaż zbiorcza "niezałożonych"** — przycisk nad listą itemów danego slotu
   (widoczny gdy jest ≥1 nie-założony item), JEDNO potwierdzenie sprzedaje WSZYSTKIE
   nie-założone itemy tego slotu naraz (suma monet policzona z góry i pokazana w
   potwierdzeniu), zamiast N razy osobno przez pojedynczy `sellTarget`. Ważne rozróżnienie
   znalezione przy czytaniu `gear.ts`/`petStore.ts`: "podobne itemy z gorszym floatem" NIE
   są duplikatami TEGO SAMEGO itemu (te są auto-kompensowane monetami przy zdobyciu,
   `grantGear`/`isGearUpgrade`, `ownedGear` trzyma jedną najlepszą kopię per id) — to są
   INNE itemy tego samego slotu (np. 3 różne hełmy odblokowane na różnych poziomach),
   każdy pod własnym id, więc trzeba je sprzedawać ręcznie. Stąd zbiorczy przycisk per slot.

`tsc`/`jest` czyste (74/978, bez zmian w liczbie testów — czysto UI, logika sprzedaży
nadal przez istniejący `sellGear()` w `petStore.ts`, tylko wołany w pętli).
**Priorytet testu na urządzeniu**: otwórz Ekwipunek z kotka → przełącz kilka zakładek bez
zamykania → tapnij w tło (nie w X) żeby zamknąć → jeśli slot ma nie-założone itemy, użyj
"Sprzedaj X niezałożonych" i sprawdź że policzone monety się zgadzają i że założony item
ZOSTAJE.

## 117. Audyt self-transfer, runda 3 — 2 kolejne miejsca naprawione (2026-09-17)

Kontynuacja audytu z §93 (2026-08, 8 miejsc)/§104 (2026-09-15, 3 miejsca) — agent-audyt
szukał TEGO SAMEGO kształtu buga (siostrzana funkcja/case w tym samym pliku już wyklucza
`isSelfTransfer`, druga nie) w miejscach jeszcze nie sprawdzonych. Dwa realne trafienia:

1. **`src/utils/dashboard/spend.ts` — `groceryTotal` i `sweetsTotal`** nie wykluczały
   self-transferu, mimo że siostrzane `allSpend`/`weekIncome` w TYM SAMYM pliku robią to od
   2026-09-14. Wpływ: karta dashboardu w `app/(tabs)/index.tsx` pokazuje `weekTotal`/
   `monthTotal` (przez `allSpend`, bez self-transferu) RAZEM z `weekFood`/`monthFood`
   (przez `groceryTotal`) i `weekSweets`/`monthSweets` (przez `sweetsTotal`) — te dwie
   ostatnie mogły zawyżać się o przelew własny mimo że sąsiedni total na tej samej karcie
   już go wykluczał. `sweetsTotal` feeduje też `menaceStats.ts` (trigger "nemesis
   miesiąca").
2. **`src/utils/statWidgets.ts` — `bucketValue`'s `case 'tagSpend'`** (widget "Wydatki na
   tag…") nie wykluczał self-transferu, mimo że siostrzany `case 'sweets'` PIĘĆ linii niżej
   ma dokładnie tę samą strukturę (receiptItems po tagu, fallback e.tags/e.amount) i już to
   robi od §104.

Naprawione oba (dopisane `!isSelfTransfer(e)`/`isSelfTransfer(e) continue`), + 3 nowe
testy regresyjne (`__tests__/dashboardSpend.test.ts` ×2, `__tests__/financePredicates.test.ts`
×1) — każdy faktycznie failował przed poprawką, potwierdzenie że to nie false-positive
audytu. `tsc`/`jest` czyste (981 testów, +3).
**Priorytet testu na urządzeniu**: niski (numerycznie drobna korekta) — jeśli masz jakiś
przelew własny otagowany 'słodycze'/'przekąski' albo w kategorii 'groceries', sprawdź że
karta jedzenia/słodyczy na dashboardzie już go nie liczy.

## 118. Audyt wydajności, runda 3 — memo scope + React.memo + themedStyles (2026-09-17)

Trzecia część background-audytu z tego samego "optymalizuj szukaj bugów" zgłoszenia —
kontynuacja §13 (2026-09-02)/§103 (2026-09-15). Cztery realne, potwierdzone i naprawione:

1. **`app/food/products.tsx` — `entries` (Kompozycje i dania) miał ten sam kształt buga co
   dawna wyszukiwarka tagu w `finances.tsx` (§103)**: budowa `fromPresets`/`fromRecipes`
   (mapowanie WSZYSTKICH presetów/dań, `presetIngredientNames`/`presetKcal`, join+normalize
   każdej listy składników) NIE zależy od `query`, ale żyła w JEDNYM `useMemo` z filtrem po
   `query` — więc przeliczała się na KAŻDY klawisz w wyszukiwarce zakładki "Kompozycje i
   dania", nie tylko przy zmianie presetów/produktów. Rozdzielone na `entriesBase`
   (deps: `[presets, products]`) + `entries` (deps: `[entriesBase, query]`), ten sam wzorzec
   co finalny fix w `finances.tsx`.
2. **`src/components/expenses/ExpenseItem.tsx` bez `React.memo`** — rendered przez
   `SectionList` w `app/(tabs)/finances.tsx`, ten sam kształt co Gablota/99-odznak (§103):
   KAŻDY render listy (scroll-tracking, zmiana filtra) przeliczał `getCategoryMeta`/ikonę/
   `billTagFor` dla wszystkich widocznych wierszy. Owinięte `memo(...)`. Wymagało DRUGIEJ
   zmiany w `finances.tsx` — `onPress`/`onLongPress` były gołymi strzałkami zdefiniowanymi
   WEWNĄTRZ `renderItem`, więc nawet z `React.memo` child i tak by się przerenderowywał
   (nowa referencja funkcji za każdym razem) — wyniesione do `handleExpensePress`/
   `handleExpenseLongPress` przez `useCallback` na poziomie komponentu ekranu.
3. **`app/habits.tsx` — `HabitRow`'s `makeHr`** i **`app/notes.tsx` — `NoteCard`'s `makeNc`**
   to były gołe `(c: any) => StyleSheet.create(...)`, NIE przez `themedStyles()` — dokładnie
   reguła #1 z CLAUDE.md ("nigdy per-komponent makeStyles(c)"). `themedStyles.ts` (patrz
   jego własny komentarz) dokumentuje TEN SAM wzorzec jako źródło realnych ANR (receipt
   scanner 30 produktów, dashboard editor 20 wierszy) — `useMemo(() => makeHr(colors), ...)`
   jest PER KOMPONENT, więc N wierszy nawyków/notatek = N osobnych kopii tego samego
   stylesheetu zamiast jednej współdzielonej (cache `themedStyles` po obiekcie `colors`).
   `NoteCard` był już `React.memo` — to NIE zwalnia z tej reguły, memo chroni przed
   nadmiarowym renderem, nie przed N-krotną budową tego samego stylesheetu przy mount.
   Prosty mechaniczny fix — owinięcie `themedStyles(...)`, zero zmian w logice/wygladzie.

Świadomie NIE naprawione (odłożone, wyższy koszt/ryzyko niż wart w tej rundzie):
`app/expenses/scan.tsx`'s `ProductRow`/`CustomProductRow` — te same braki memoizacji, ale
~15 wzajemnie zależnych callbacków per wiersz (onToggle/onCategoryPress/onPriceChange/
onNameChange/onMerge/onTagsChange/onWeightChange/onQuantityChange/onEatersChange...)
tworzonych inline w `.map()` w miejscu wołania — memoizacja samego komponentu bez
ustabilizowania WSZYSTKICH tych callbacków (przez id-keyed stabilne referencje) nie dałaby
żadnej korzyści, a zrobienie tego źle groziłoby stale closures. Do zrobienia w osobnej,
dedykowanej rundzie.

`tsc`/`jest` czyste (981 testów, bez zmian w liczbie — czysto strukturalne zmiany, brak
nowej logiki do testowania jednostkowo).
**Priorytet testu na urządzeniu**: niski/średni — Finanse (scroll długiej listy powinien
być gładszy, tap/long-press na kafelku wciąż działa jak wcześniej), zakładka Jedzenie →
Kompozycje i dania (wpisywanie w szukajkę powinno być bez zacinania na większej liczbie
presetów), Nawyki i Notatki (wizualnie bez zmian, tylko wewnętrzna budowa stylów).

## 119. Self-review §118 — martwy `index` prop unieważniał świeży `React.memo` (2026-09-17)

User: *"dawaj dalej"* — self-review właśnie zmergowanego §118 (`ExpenseItem` memo).
Znalazłem: `index: number` w `Props` interfejsie `ExpenseItem.tsx` był MARTWY już PRZED
§118 (zadeklarowany, nigdy nie destrukturowany/używany w ciele komponentu) — nieszkodliwy
dopóki komponent nie był memoizowany. Domyślny `React.memo` porównuje WSZYSTKIE propsy
płytko, niezależnie od tego czy komponent faktycznie z nich korzysta — a `index` zmienia
się dla wielu wierszy w danej sekcji przy KAŻDYM dodaniu/usunięciu transakcji (przesunięcie
pozycji). Efekt: memo dodane w §118 byłoby cicho unieważniane dla sąsiadujących wierszy w
dokładnie tym scenariuszu, w którym miało dać najwięcej (dodanie jednej transakcji nie
powinno przemalowywać całej reszty listy poniżej). Fix: `index` USUNIĘTE z `Props` i z
wywołania w `finances.tsx` (`renderItem={({ item }) => ...}`, `index={index}` skasowane).
Przy okazji zweryfikowane (nie tylko przeczytane): `structuralFiltered`/`sections` w
`finances.tsx` budują `items` przez `.filter()` na już istniejącej tablicy transakcji —
zachowuje referencje obiektów `Expense` bez ich klonowania, więc `expense` prop faktycznie
zostaje STABILNY między renderami gdy dana transakcja się nie zmieniła (warunek konieczny
żeby memo cokolwiek dawało).

`tsc`/`jest` czyste (981 testów, bez zmian — usunięcie nieużywanego propsu, nie nowa logika).
**Priorytet testu na urządzeniu**: brak — czysto wewnętrzna optymalizacja, zero zmian
widocznych/funkcjonalnych.

## 120. Edytor układu walki — poligon do wyklikania pozycji/rozmiarów przed podpięciem (2026-09-17)

User: *"Daj mi mozliwosc zmienic sam obrazek tla walk żebym dostosował i moze tez wielkość i
pozycje pupila, bossa i ich pasków HP, wtedy wyeksportować i zrobisz dla wszystkich"*.

**Stan przed**: `app/boss-fight.tsx` nie ma ŻADNEGO per-elementowego pozycjonowania —
`PORTRAIT_SIZE`/`CAT_PORTRAIT_SIZE` to globalne stałe rozmiaru, `SPRITE_GROUND_SHIFT` to
JEDEN, WSPÓLNY offset Y dla obu sprite'ów, paski HP to zwykłe flex-children pod portretem,
bez własnego offsetu. Tło areny idzie przez `fightArenaBg`/`arenaBgFor`/`MISSION_LOCATION_BG`
w `bossIcons.ts` — jedyne miejsce, gdzie coś JEST już konfigurowalne per tryb/miniboss.

**Decyzja architektoniczna**: NIE zastąpiłem tego flex-layoutu absolutnym pozycjonowaniem
(co dałoby "prawdziwie niezależne X/Y od zera") — istniejąca geometria ma sporo
POWIĄZANYCH, starannie wyliczonych zależności (`projectile.top` liczony wprost z wysokości
`tilePortrait`, `GroundShadow`/`RadialGlow` skalowane względem `PORTRAIT_SIZE`, wspólny
`SPRITE_GROUND_SHIFT` na obu sprite'ach) — zastąpienie tego całkiem nowym systemem byłoby
ryzykownym, dużym rewrite'em rdzenia ekranu walki. Zamiast tego: DODATKOWY offset
(`translateX`/`translateY`) NA WIERZCHU istniejącego flex-layoutu, niezależny dla każdego z
4 elementów (pupil/boss/pasek HP pupila/pasek HP bossa) — przy offsetach=0 (domyślne)
wynik jest PIKSEL-W-PIKSEL identyczny z dzisiejszą realną areną.

**Co zbudowane** (poligon, NIE dotyka `app/boss-fight.tsx`):
- `src/store/battleLayoutDraftStore.ts` — persisted draft (`bg`, `catSize`, `bossSize`, 4×
  `offsetX/Y` par), domyślne wartości = dzisiejsze realne stałe.
- `app/battle-layout-lab.tsx` — pełny podgląd używający TYCH SAMYCH komponentów co realna
  walka (`CatArt`/`BossArt`/`RadialGlow`/`GroundShadow`, ten sam palette usera przez
  `usePetStore`+`paletteById`, ta sama grafika tła+scrim+mgiełka). Pupil/boss/oba paski HP
  są przeciągalne dotykiem (`Draggable` — `PanResponder` z `posRef`/`onDragRef` żeby uniknąć
  stale closure, bo `PanResponder.create` woła się RAZ przez `useRef`); rozmiar pupila/bossa
  przez steppery +/−; wybór tła z 4 istniejących plików w `assets/lokalizacje/`; boss
  podglądu cyklowany przyciskiem (czysto kosmetyczne, nie wpływa na eksport). Pozycje mają
  też zapasową drogę liczbową (te same steppery) dla precyzyjnych korekt o 1px.
- Eksport: `JSON.stringify(draft, null, 2)` w NIEEDYTOWALNYM, zaznaczalnym `TextInput`
  (`selectTextOnFocus`) + przycisk „Udostępnij" (`Share.share()`, wbudowane w RN, zero
  nowych zależności) — świadomie NIE `expo-clipboard`: to nowy natywny moduł, wymagałby
  świeżego builda APK zamiast działać od razu przez OTA (CLAUDE.md #2), za dużo kosztu na
  wygodę "kopiuj-wklej" w jednorazowym narzędziu tuningowym.
- Link w Ustawienia → Dane (`BattleLayoutLabSection.tsx`, ten sam wzorzec karty co
  `BoxStatsSection`).
- Fix po drodze: pierwsza wersja czytała `usePetStore` gołym obiektem-literałem jako
  selektor (`usePetStore(st => ({...}))`) — TEN SAM anti-pattern niestabilnej referencji,
  który naprawiałem gdzie indziej w tej sesji (§115 i inne). Złapane i poprawione na
  `useShallow` PRZED zmergowaniem, nie po.

**Świadomie NIE zrobione teraz**: podpięcie wyeksportowanych wartości do
`app/boss-fight.tsx` — to następny, ODDZIELNY krok, PO tym jak user wytunuje układ na
urządzeniu i wklei mi wynikowy JSON. Wtedy `PORTRAIT_SIZE`/`CAT_PORTRAIT_SIZE` zostaną
zastąpione wartościami z `catSize`/`bossSize`, a 4 nowe stałe offsetu dodadzą się do
istniejących transformów sprite'ów/pasków HP — global, dla WSZYSTKICH trybów walki (user:
"zrobisz dla wszystkich"), bo tak już działa dzisiejszy layout (jeden wspólny dla
kampanii/raidu/eventu/questu/mad/misji).

`tsc`/`jest` czyste (981 testów, bez zmian w liczbie — czysto nowy ekran/store, brak nowej
logiki biznesowej do testowania jednostkowo).
**Priorytet testu na urządzeniu**: Ustawienia → Dane → „Edytor układu walki (beta)" → Otwórz
edytor → przeciągnij pupila/bossa/oba paski HP, zmień rozmiary i tło, sprawdź że eksport
pokazuje poprawne, zaokrąglone liczby i że wartości PRZETRWAJĄ zamknięcie i ponowne
otwarcie ekranu (persisted draft).

## 121. Audyt dat, runda 2 — Podsumowanie tygodnia liczyło praktycznie zera (2026-09-18)

User: *"szukaj dalej błędów logicznych ewentualnie optymalizuj"* — background-audyt
szukający TEGO SAMEGO kształtu buga co reguła CLAUDE.md #5 (data porównywana bez
`.slice(0,10)`), w miejscach jeszcze nie sprawdzonych. Audyt combat-logiki (6 trybów walki)
wyszedł czysty — nic do naprawy. Audyt dat znalazł jeden, ale poważny, realny bug.

**`app/weekly.tsx` — Finanse tydzień: suma wydatków/przychodów i dzienny wykres liczyły
praktycznie SAME ZERA.** `Expense.date` to PEŁNY lokalny timestamp (`localISO()`, np.
`"2026-09-20T16:45:00"`), a `dates`/`prevDates` (z `getWeekDates()`) to gołe
`"YYYY-MM-DD"`. Cztery porównania stringów BEZ obcięcia:
- `weekExp`/`weekInc` (linia 290/295): `e.date <= dates[6]` — string z dopisanym czasem i
  tym samym prefiksem sortuje się jako WIĘKSZY niż goła data (`"...T16:45:00" > "2026-09-20"`
  w porównaniu leksykograficznym — zweryfikowane realnie w Node, nie tylko wyczytane), więc
  KAŻDY wydatek/przychód z OSTATNIEGO dnia tygodnia wypadał z sumy.
- `prevExp` (linia 300): to samo, dla tygodnia poprzedniego.
- `expDailyV` (linia 306, dzienny wykres słupkowy) — `e.date === d`: pełny timestamp
  praktycznie NIGDY nie jest bajt-w-bajt równy gołej dacie (chyba że transakcja padła
  DOKŁADNIE o północy), więc ten wykres renderował się jako praktycznie same zera na
  KAŻDY dzień, nie tylko ostatni.
- Dolna granica (`>= dates[0]`) działała PRZYPADKIEM poprawnie (dłuższy string z tym samym
  prefiksem i tak sortuje się ≥ gołej daty tego dnia) — dlatego bug był niewidoczny przy
  pobieżnym teście "czy suma w ogóle coś pokazuje", tylko przy realnej weryfikacji
  konkretnych dni.
- Ten sam plik/funkcja ma siostrzany filtr nastroju (linia 224, `mood.filter(e => e.date >=
  dates[0] && e.date <= dates[6])`) — TAM to bezpieczne, bo `MoodEntry.date` jest już gołą
  datą, nie timestampem. Ten sam kształt "jeden sąsiad bezpieczny, drugi nie" co reszta
  audytów tej sesji, tylko międzytypowy (Expense vs MoodEntry), nie międzyfunkcyjny.

Fix: `.slice(0, 10)` na `e.date` we wszystkich 4 porównaniach z gołą datą. Zweryfikowane
realnie w Node (`"2026-09-20T16:45:00" <= "2026-09-20"` → `false`, `... === "2026-09-20"` →
`false`), nie tylko wyczytane z kodu.

Resztę audytu dat (toISOString()-day-boundary, siostrzana niekonsekwencja, matematyka
streak/cooldown) sprawdzone szerzej — WSZĘDZIE INDZIEJ już bezpieczne wzorce (`ymd()`/
`todayStr()` przez getFullYear/getMonth/getDate, `atMidnight` kotwiczony na lokalnym
`T00:00:00`, streak liczony przez `dashboard/dates.ts`) — nic więcej do naprawy.

`tsc`/`jest` czyste (981 testów, bez zmian — poprawka inline w komponencie ekranu, nie
osobna czysta funkcja do testu jednostkowego, ten sam wzorzec co wcześniejszy fix Saldo w
finances.tsx).
**Priorytet testu na urządzeniu**: średni-wysoki (widoczny, realny bug UI) — otwórz Finanse
→ Tydzień, sprawdź że suma wydatków/przychodów tygodnia uwzględnia transakcje z NIEDZIELI
(ostatni dzień), i że dzienny wykres słupkowy pokazuje realne kwoty na WSZYSTKIE dni, nie
same zera.

## 122. Fix: 4 rozjeżdżające się listy tagów jedzenia w UI (2026-09-18)

User: *"po targach [czyt. tagach] musi łapać tez jak sa jaja, Jajka (bo mi nie lapie jak sa
jaja xd)... nadal nie pokazuje sie kategoria produkty sypkie... i na kategorie makarony i
ryżem kasze. I jak dodasz to zeby jak bedzie cos miało makarony ryżem w nazwie to zeby ten
tag byl tam do kliknięcia jakby albo wogloqle zeby tam byly tagi jaja tez i przyprawy"*.

**Zweryfikowane najpierw, nie samo czytanie** (CLAUDE.md #5) — napisany tymczasowy test
wołający realny `getFoodTags`/`categorize`/`foodSubcat` na "Jaja M", "Mąka pszenna",
"Makaron spaghetti", "Ryż biały" itd.: WSZYSTKIE poprawnie zwracają właściwy tag (`jajka`,
`mąka i produkty sypkie`, `makarony`, `ryż i kasze`). Auto-wykrywanie (§111) działa
poprawnie — więc user NIE mówił o parserze.

**Prawdziwa przyczyna**: 4 OSOBNE, plik-lokalne kopie `ITEM_TAGS` (chip-picker do
RĘCZNEGO wybierania tagów) — `app/expenses/scan.tsx`, `app/expenses/manual.tsx`,
`app/products.tsx`, `app/expenses/[id].tsx` — każda z własną, ręcznie wypisaną listą,
żadna nie dostała 8 nowych kategorii z §111 (jajka/sosy/przyprawy/konserwy i przetwory/
makarony/ryż i kasze/mąka i produkty sypkie/oleje i tłuszcze/mrożonki), a `scan.tsx`/
`manual.tsx` brakowało nawet starszego `sosy`. Stary komentarz w `products.tsx` mówił
wprost: *"celowo nie wydzielona współdzielona (mała, stała lista domenowa)"* — ta decyzja
przestała się sprawdzać w miarę jak rosła liczba kategorii: user nie miał jak RĘCZNIE
kliknąć żadnej z nowych, ani poprawić STARY paragon zeskanowany PRZED §111 (którego
pozycje zostały z dawnym tagiem/bez tagu na stałe — nic nie re-tagguje wstecznie samo z
siebie, stąd "nadal nie pokazuje się").

**Fix**: `FOOD_ITEM_TAGS: string[] = FOOD_SUBCATS.map(s => s.tag)` — nowy eksport w
`food.ts`, JEDNO źródło prawdy. Wszystkie 4 pliki teraz budują swój `ITEM_TAGS` jako
`[...FOOD_ITEM_TAGS, ...własne-nie-jedzeniowe]` (każdy zachowuje swój dotychczasowy zestaw
tagów nie-jedzeniowych — `chemia`/`higiena`/`nie jedzenie` — różny w każdym pliku, nie
ujednolicony na siłę). Dodanie KOLEJNEJ kategorii do `FOOD_SUBCATS` w przyszłości
automatycznie pokaże się we wszystkich 4 picker-ach, bez pamiętania o rozrzuconych
miejscach — ten sam "jedno źródło prawdy" wzorzec co `FOOD_SUBCAT_META`.

`tsc`/`jest` czyste (981 testów, bez zmian — czysto UI-owa lista, logika kategoryzacji
niedotknięta, już przetestowana w §111).
**Priorytet testu na urządzeniu**: Finanse → Produkty (albo edycja pozycji paragonu) →
sprawdź że w pickerze tagów widać teraz jajka/sosy/przyprawy/konserwy i przetwory/
makarony/ryż i kasze/mąka i produkty sypkie/oleje i tłuszcze/mrożonki jako klikalne chipy,
i że kliknięcie ich na STARYM produkcie faktycznie retagguje go (widoczne w statystykach).

## 123. Audyt Gabloty — zdobyta odznaka mogła "wrócić do zablokowanej" (2026-09-18)

User: *"rzuć okiem na gablote wszystko po kolei co jest podłączone z tych osiągnięć co nie
jest itp, czy to wgle dziala i liczy dobrze"*. Przeczytany cały `achievements.ts` (99
odznak) + delegowany agent-audyt na dane wejściowe (`AchCtx`), które wymagały sprawdzenia w
INNYCH plikach.

**Znalezione i naprawione — 1 realny bug, poważny w skutkach**: `habitBestStreak` (mimo
nazwy) to AKTUALNA seria nawyku (`useHabits().getStreak()` liczy wstecz od dziś do
pierwszego zerwanego dnia — patrz `useHabits.ts:212-242`, brak jakiegokolwiek zapisanego
rekordu wszech czasów), nie najlepsza-kiedykolwiek. Siatka gabloty (`app/achievements.tsx`)
i licznik trofeów na dashboardzie (`app/(tabs)/index.tsx`) renderowały `unlocked`/sortowanie
z SUROWEGO, ŻYWEGO `evaluateAchievements()` — NIE z trwałej mapy `earned` (która istnieje
właśnie po to, żeby pamiętać "kiedy pierwszy raz zdobyte", i której `syncEarned` TYLKO
dopisuje, nigdy nie usuwa). Efekt: user zdobywa "Nieugięty" (100 dni tego samego nawyku z
rzędu) albo "cyborg-365" (365 dni), opuszcza JEDEN dzień, `habitBestStreak` spada blisko
zera — odznaka wizualnie WRACA DO ZABLOKOWANEJ w siatce (wyszarzona, spada w sortowaniu,
znika z licznika "X/Y zdobyte"), mimo że `earned[id]` cały czas trzyma oryginalną datę
zdobycia. Dotyczy KAŻDEJ odznaki opartej o streak, który z natury może się zresetować —
nie tylko habitBestStreak: logStreak/goodMoodStreak/goodSleepStreak/noJunkStreak/
noSpendStreak/produceVarietyStreak/foodLogStreak/loginStreak/monthsUnderBudgetStreak/
neutralMoodStreak — to co najmniej kilkanaście z 99 odznak.

Fix: nowa `applyEarnedFloor(states, earned)` w `achievements.ts` — raz odznaka w
persisted `earned`, ZOSTAJE pokazywana jako zdobyta na zawsze (progress=1), niezależnie od
tego co się dzieje z żywymi danymi później (Gablota to gablota TROFEÓW, nie żywy podgląd
bieżącego stanu). Podpięte w OBU miejscach, które renderują/liczą odznaki
(`app/achievements.tsx`'s siatka/licznik/sortowanie, `app/(tabs)/index.tsx`'s karta
"Gablota" + `earnedBadges` licznik) — `syncEarned` nadal dostaje SUROWE stany (musi widzieć
realne przekroczenie progu, żeby wykryć NOWO zdobyte). 3 nowe testy regresyjne.

**Sprawdzone i potwierdzone CZYSTE** (agent-audyt + moja weryfikacja): `loginStreak`
(petStore.ts) — poprawna semantyka kalendarzowa, bezpiecznie liczy dalej ponad tabelę
wypłat monet (capowaną na 7). `cardBalancePeak` (accountBalance.ts) — prawdziwe
monotoniczne maximum, replay CAŁEJ historii wydatków, persisted, nigdy nie się nie cofa.
`dishesCreated`/`isRecipeProduct` (foodStore.ts) — liczy WYŁĄCZNIE dania z `recipe.ingredients`
zapisane przez usera w kreatorze przepisu, brak danych seed które by zawyżały licznik.
Wszystkie 79 pól `AchCtx` faktycznie ustawiane w `buildAchCtx` (żadne martwe/zahardkodowane).
`neutralMoodStreak`/`poker-face` — `MoodLevel` to `1|2|3|4|5`, `mood: 0` nigdy nie jest
realną wartością, strażnik `if (day && m.mood)` nigdy nie pomija prawdziwego wpisu.

**Pokrycie ikon (art, nie logika)** — 17 z 99 odznak nie ma własnej grafiki PNG (fallback
na generyczną ikonę lucide, UDOKUMENTOWANE i celowe w komentarzu `badgeIcons.ts`), z czego
10 nie ma nawet dedykowanego fallbacku (goły Award/Skull): `fat-wallet`, `poker-face`,
`unplugged`, `first-key`, `groceries-100`, `first-week`, `sweet-tooth`, `crime-scene`,
`grumpy`, `jester`. Nic nie jest zepsute (fallback renderuje się poprawnie), tylko wizualnie
mniej rozpoznawalne — zostawione userowi do decyzji (dorysować, czy zostawić).

`tsc`/`jest` czyste (984 testy, +3 nowe regresyjne).
**Priorytet testu na urządzeniu**: wysoki dla kogoś ze zdobytymi streak-owymi odznakami —
otwórz Gablotę, sprawdź że WSZYSTKIE wcześniej zdobyte trofea (zwłaszcza streak-owe:
Nieugięty/cyborg-365/centurion/zen/stoic-30 itp.) dalej pokazują się jako odznaczone,
niezależnie od aktualnego stanu streaków.

## 124. Redesign ekwipunku pupila — każdy drop to trwała instancja, nie "1 slot per item" (2026-09-18)

User (ze screenshotem zakładki Buty): *"musimy operować inaczej z itemami bo w eq sie nie
mieszczą, i jak dropie je np te same to czasami mi mówi masz trzymaj voiny ale czasami mi
znika jakby sie łączył i nie mam ani itemu ani coinow, moze każdy item bedzie miał id swoje
np id itemi to 1222 a po dwukropku numer od resetu który raz drapałem czyli np 1222:001,
1233:035 co sadzisz?"*. Doradziłem OSTROŻNIEJ (lżejszą alternatywę), user explicit
odrzucił i potwierdził pełny redesign: *"Zrob tak jak pisalem ale jak sa takie same te
pierwsze kody to pokazuje ze mam kilka xd i jak kliknę pokazuje float ich i jakie mają
wartości a jak sa dosłownie takie same moge je sprzedac i wtedy wybieram ile xd a eq
możemy w górę i usun z niego emotki"*.

**Zanim zaimplementowano — znaleziony realny, wcześniej nieodkryty bug** dokładnie
matchujący skargę usera ("czasami mi znika... nie mam ani itemu ani coinow"): trzy
NIEZALEŻNE ścieżki dropu gearu (`grantGear`, `buyDailyGear` w petStore.ts, i `openCrate()`
tamże — skrzynka sardynek za głaskanie) miały TRZY osobne kopie logiki
"czy to ulepszenie" (dawne `isGearUpgrade`). `grantGear`/`buyDailyGear` przy gorszym dropie
KOMPENSOWAŁY monetami; `openCrate()` miała WŁASNĄ, nieskopiowaną wersję tej logiki, która
przy gorszym dropie PO CICHU GO ODRZUCAŁA BEZ ŻADNEJ KOMPENSATY (ani item, ani coins) —
a `CrateModal.tsx`'s reveal UI bezwarunkowo wypisywało "🎁 Ekwipunek: {name}" niezależnie od
tego, czy drop faktycznie został zachowany. Modal aktywnie okłamywał usera.

**Nowy model — każdy drop = własna, trwała instancja** (`GearInstance extends OwnedGear {
itemId, seq }`, `gearInstanceId`/`parseGearInstanceId` w gear.ts konwertują między parą
(itemId, seq) a złożonym kluczem `itemId:seq`, np. `helm_slomiany:001`). `ownedGear` w
petStore.ts zmienia typ z `Partial<Record<string, OwnedGear>>` (jeden slot per item) na
`Partial<Record<string, GearInstance>>` (flat mapa KAŻDEJ posiadanej kopii, kluczowana
złożonym id). `equippedGear` zostaje typem `Partial<Record<GearSlot, string>>`, ale
wartości to teraz id INSTANCJI, nie itemu. `isGearUpgrade()` USUNIĘTE CAŁKOWICIE — nic już
nie ocenia "czy lepsze", nic nie jest odrzucane/kompensowane automatycznie, user sam
decyduje w Ekwipunku co zatrzymać/sprzedać. `grantGear`/`buyDailyGear`/`openCrate()`
przepisane na wspólny wzorzec: `nextGearSeq()` liczy kolejny numer PO MAX dotychczasowym
sequ danego itemu (nie po liczbie wpisów — sprzedanie środkowej instancji nie powtarza jej
numeru), zawsze tworzą NOWĄ instancję, nigdy nie czytają/nie wołają starej logiki
porównującej. `sellGear(instanceId)` usuwa jedną konkretną kopię. Migracja w
`onRehydrateStorage` (idempotentna — działa na KAŻDYM starcie apki, nie tylko raz;
rozpoznaje stary format przez brak `.itemId`) remapuje istniejące `ownedGear` na
`itemId:001` per stary wpis i przepisuje `equippedGear` przez tę samą tabelę id.

**GearPanel.tsx przepisany pod nowy model** — dawne `ownedGear[g.id]`/`gearById(equippedId)`
(bezpośrednie lookupy po bare item id) były złamane po zmianie klucza na złożone id; teraz
grupuje instancje po `itemId` (`groupOwnedBySlot`), pokazuje kartę per item z odznaką
"×N" gdy user ma kilka kopii (user: "pokazuje ze mam kilka"), rozwijalną listę
POJEDYNCZYCH kopii z ich realnym rzadkość+wartość ("float" usera) i osobnymi przyciskami
Załóż/Sprzedaj na KAŻDĄ instancję, plus "Sprzedaj kilka…" per grupa — stepper +/- wybiera
ile najsłabszych niezałożonych kopii sprzedać za jednym potwierdzeniem (user: "moge je
sprzedac i wtedy wybieram ile"). Emoji usunięte z etykiety slotu w tym modalu
(`SLOT_META[slot].label` bez `.icon` — user: "usun z niego emotki"; `.icon` ZOSTAJE
używane w pet-shop.tsx/BoxRevealModal.tsx, to celowe). `app/pet.tsx`: `GearPanel`
przeniesiony PRZED `s.tip` (linijkę statusu pupila) — renderuje się teraz bezpośrednio pod
nagłówkiem nazwa/lvl (user: "eq możemy w górę").

**Konsekwencja usunięcia kompensaty**: `BoxRevealModal.tsx`/`pet-shop.tsx`/`app/pet.tsx`
straciły cały koncept `dupeCoins` ("masz już ten przedmiot, +N monet") — gear box reveal
zawsze pokazuje realnie zdobyty item, bo zawsze jest realnie zachowany. `pet-shop.tsx`'s
`alreadyOwnGear()` (blokada "już masz (lub lepszy), nie kupuj") USUNIĘTA — zakup dnia
zawsze się udaje przy wystarczających monetach i wolnym slocie dnia, tworzy nową instancję
obok starych.

`tsc`/`jest` czyste (980 testów — `grantGear.test.ts`/`buyDailyGear.test.ts` przepisane pod
nowe API, resztę bez zmian).

**Explicite NIE zrobione**: brak UI do PORÓWNANIA dwóch konkretnych instancji side-by-side
(tylko delta vs założona); brak sortowania/filtrowania listy instancji poza "najlepsza
pierwsza"; combat-bonus funkcje (`gearCombatBonuses`/`gearFlatHp`/`gearCoinsMult`,
`effectiveCatMaxHp`/`campaignEnergyMax`) NIE dotknięte — czytają `equippedGear[slot] →
ownedGear[tegoKlucza].value/.rarity`, co działa identycznie z instance-id jak wcześniej z
bare item id, bez zmian.

**Priorytet testu na urządzeniu**: wysoki. (1) Zdropuj/kup 2+ kopie tego samego itemu —
sprawdź że OBIE zostają widoczne (nie zlewają się, nie znikają), badge "×2" się pojawia;
(2) rozwiń grupę, sprawdź że każda kopia pokazuje własną rzadkość/wartość; (3) "Sprzedaj
kilka…" ze stepperem — zmień ilość, sprawdź że suma monet się przelicza, potwierdź, sprawdź
że zostały sprzedane NAJSŁABSZE (nie losowe); (4) załóż jedną kopię, sprawdź że reszta
niezałożonych kopii tego samego itemu dalej jest sprzedawalna niezależnie; (5) otwórz
skrzynkę sardynek (głaskanie do pełna) kilka razy pod rząd, sprawdź że KAŻDY drop gearu
faktycznie się pojawia w Ekwipunku (dawny bug: cichy zanik bez kompensaty); (6) apka z
istniejącym starym zapisem ownedGear — po starcie sprawdź że stare itemy dalej są
założone/widoczne pod nowymi id (migracja).

## 125. Self-review §124 — kolizja w migracji instancji mogła po cichu nadpisać gear (2026-09-18)

Ten sam "self-review dużej zmiany przed testem na urządzeniu" wzorzec co §114/§119/§123 —
delegowany agent-audyt na sam redesign z §124 (bo type-checker łapie tylko kształt, nie
logikę). Znalezione 1 realne, wąskie, ale realne miejsce: migracja instancji w
`onRehydrateStorage` (petStore.ts) mapowała KAŻDY stary goły wpis (`ownedGear['helm_
slomiany']`) na `${itemId}:001` NA OŚLEP, bez sprawdzenia czy ten klucz docelowy już istnieje.
Przy "częściowym rehydrate" — user ma JUŻ zmigrowaną instancję `helm_slomiany:001` ORAZ
wciąż stary goły wpis dla TEGO SAMEGO itemu (realny scenariusz: stary APK z GitHuba trzyma
starszy build, który wciąż zapisuje gołym kluczem, na tym samym AsyncStorage co nowszy build
— CLAUDE.md "APK z GitHub", brak wymuszonej auto-aktualizacji OTA) — obie wartości kolidowały
na TYM SAMYM kluczu docelowym, druga po cichu nadpisywała pierwszą. Zero błędu, zero logu,
po prostu jedna z dwóch posiadanych kopii (czasem założona) traciła swoje realne
rarity/value albo cała jedna instancja znikała bez śladu — dokładnie ten sam rodzaj "cichej
utraty gearu bez kompensaty", który był oryginalną skargą usera i powodem całego redesignu.

Fix: `usedIds` śledzi WSZYSTKIE już zajęte klucze docelowe (już-nowe wpisy + nowo przydzielone
w tej samej migracji), każdy stary wpis dostaje pierwszy WOLNY seq dla swojego itemu (nie
zawsze `:001`) — poprawiona też migracja `nextOwned`, która wcześniej hardkodowała `seq: 1`
w zapisanej instancji niezależnie od realnie przydzielonego klucza (drugi, mniejszy bug w tym
samym miejscu, złapany przy naprawianiu pierwszego). 3 nowe testy regresyjne w
`__tests__/gearMigration.test.ts` — testują `onRehydrateStorage` NAPRAWDĘ (nie przez mock
AsyncStorage), przez testowalny seam zustand v5: `store.persist.getOptions()
.onRehydrateStorage()` zwraca realny handler migracji, wołany tu wprost na ręcznie
skonstruowanym stanie.

**Sprawdzone i potwierdzone CZYSTE** (agent-audyt): `nextGearSeq` na pustym `ownedGear`;
brak wyścigu między `grantGear`/`buyDailyGear`/`openCrate` (synchroniczne `get()`/`set()`,
zero gapu na async); `equipGear`/`unequipGear`/`sellGear` nigdy nie zostawiają `equippedGear`
wskazującego na usunięty klucz; sell-dialogi w GearPanel.tsx (blokujący natywny `Modal`,
zero szansy na zmianę stanu między otwarciem a potwierdzeniem); cały repo zgrepowany pod
`ownedGear[`/`equippedGear[` — brak zapomnianych lookupów po gołym item id.

`tsc`/`jest` czyste (983 testy, +3 nowe).
**Priorytet testu na urządzeniu**: niski-średni — dotyczy wąskiego scenariusza (mieszany
stary+nowy format tego samego itemu naraz), ale jeśli user ma STARY zapis z przed §124 i
zauważy że po aktualizacji jakiś item/rzadkość się "zmieniła" albo zniknęła, to jest to
miejsce do sprawdzenia jako pierwsze.

## 126. Audyt logika/optymalizacja, runda — nocna zmiana w powiadomieniach + 3 dziury self-transfer (2026-09-18)

User: *"dawaj dalej logika i optymalizacja"* (kontynuacja tej samej otwartej prośby z
początku sesji). Delegowany agent-audyt na budżety/stałe koszty/wypłatę/powiadomienia
(obszary jeszcze nieprzetestowane w tej sesji — combat/daty/tagi jedzenia/gablota/
self-transfer×3/gear już pokryte wcześniej). Znalezione i naprawione 2 realne bugi klasy
"self-transfer" (kolejna, 4. runda tego samego powtarzającego się typu buga w tym repo) +
1 realny bug w powiadomieniach pracy:

**1. Powiadomienia o zmianie pracy liczyły nocną zmianę na opak** (`src/services/
notificationsService.ts`, `scheduleWorkShiftNotifications`) — `fireEnd` liczone na TYM
SAMYM dniu co `fireStart`, bez rollover na następny dzień dla zmiany kończącej się po
północy (np. 22:00-06:00). Efekt: powiadomienie "koniec zmiany" leciało GODZINY PRZED jej
początkiem, a `durationSecs` (odjęcie minut bez rollover) wychodził ujemny → capowany do 0
→ "zarobiłeś ok. 0.00 zł" niezależnie od realnej zmiany. Ten sam rodzaj rollover już istnieje
i działa poprawnie w `workEvents.ts` (`titleTimeRange`/`shiftMinutes`), tylko
`notificationsService.ts` reimplementowało zakres godzin OD ZERA, bez importu. Fix:
wyniesione do nowej, testowalnej `shiftFireTimes(ev, dateBase)` w `workEvents.ts` (zwraca
`{fireStart, fireEnd, durationSecs}` jako `Date`/liczba, z poprawnym przesunięciem daty
`fireEnd` gdy koniec≤początek) — `notificationsService.ts` teraz tylko konsumuje ten wynik,
zero duplikowanej logiki dat. 5 nowych testów w `workEvents.test.ts` (dzienna/nocna zmiana,
brak endTime, fallback bez tytułu).

**2. "Podsumowanie tygodnia" (Sunday-evening recap) liczyło przelew własny jako wydatek**
(`app/(tabs)/index.tsx`, `weeklySummary`) — jedyny agregator wydatków w tym pliku bez
`isSelfTransfer()`, mimo że KAŻDY sąsiedni (dashboard/spend.ts, useExpenses.ts) go już
wyklucza. Przykład: realne wydatki tygodnia 300 zł, user przelewa 500 zł na Revolut w
środku tygodnia (auto-zaksięgowane przez `bankIngest.ts` jako `category:'transfer'`) →
powiadomienie mówi "Wydatki: 800 zł".

**3. Alert przekroczenia budżetu per-kategoria liczył się od zera, bez self-transfer**
(`app/(tabs)/index.tsx`, `budgetAlertCard`) — TA SAMA liczba jest już poprawnie liczona w
`useExpenses.ts` (`stats.monthCategorySpend`, filtr `isExpense = ... && !isSelfTransfer`)
i dostępna na tym samym ekranie (`stats` już zaimportowane), ale `budgetAlertCard` miała
własną, nieodfiltrowaną kopię. `'transfer'` to prawdziwa, budżetowalna kategoria (Ustawienia
pozwalają jej ustawić limit) — ręczna zmiana kategorii przelewu własnego albo limit
ustawiony wprost na "Przelew" mógł wywołać fałszywy alarm "70%+ budżetu". Fix: `budgetAlertCard`
teraz czyta `stats.monthCategorySpend` (jedna liczba, jedno źródło prawdy) zamiast
przeliczać własną kopię.

**4. Tag-limit bary (`#słodycze` itp.) i ich historia (`tagLimits`/`tagHistory`, ten sam
plik) też nie wykluczały self-transferu** — dopisane, dla zgodności z resztą pliku (wąski
realny scenariusz: self-transfer musiałby dodatkowo nosić śledzony tag, ale to ten sam
powtarzający się gap co #2/#3, więc naprawione tą samą okazją).

**Sprawdzone i potwierdzone CZYSTE** (agent-audyt, ręczne prześledzenie konkretnych dat/
liczb, nie tylko czytanie): `paycheck.ts`'s core arrears/rollover roku (kilka przykładów na
granicy roku); `accountBalance.ts` (poza `cardBalancePeak`, już potwierdzone w §123);
`dashboard/spend.ts` (wszystkie funkcje konsekwentnie wykluczają self-transfer);
`finances.tsx`'s `monthTotals`/`monthPulse` (poprawny cap dni na granicy krótszych
miesięcy); `refreshPaydayReminder`/`refreshWeeklySummary` w notificationsService.ts.

**Explicite NIE naprawione (niska priorytetowość, brak realnej szkody)**: `computeTagSpend`
w `tagBudgets.ts` — martwy kod (wołany tylko z własnego testu, realny dashboard reimplementuje
logikę inline), ma te same dwie dziury (self-transfer + liczy całe paragony zamiast per-item)
ale nic ich realnie nie woła; `monthIndexFromText` w `paycheck.ts` — teoretyczna, niepotwierdzona
niejednoznaczność przy notatce wymieniającej DWA miesiące naraz, brak realnego formatu notatki w
kodzie który by to wywołał; `detectFixedCosts` w `fixedCosts.ts` — nigdy nie "wygasza" starej,
odwołanej subskrypcji (tylko wyświetlana karta, nie liczone do żadnego budżetu, więc UX-owa
niedokładność, nie liczbowy bug).

`tsc`/`jest` czyste (988 testów, +5 nowych dla `shiftFireTimes`). Fixy #2-4 (inline w
`app/(tabs)/index.tsx`) nie mają dedykowanych testów — ten sam wzorzec co
`topProductsQuantity.test.ts` (komentarz tam: testowalna jest tylko wyeksportowana logika,
nie logika zamknięta w komponencie ekranu bez renderowania), a bazowy predykat
`isSelfTransfer` ma już własne testy w `financePredicates.test.ts`.

**Priorytet testu na urządzeniu**: średni — (1) jeśli masz zmianę nocną w kalendarzu/pracy,
sprawdź że powiadomienie "koniec zmiany" przychodzi PO jej końcu z realną kwotą zarobku, nie
0 zł; (2) jeśli robisz przelewy własne (Revolut/oszczędności), sprawdź że "Podsumowanie
tygodnia" i alert budżetu per-kategoria ich NIE liczą jako wydatku.

## 127. Audyt logika/optymalizacja, runda 2 — streak tygodniowy z hard-capem, self-transfer #5, wydajność runda 4 (2026-09-18)

User: "dawaj dalej logika i optymalizacja" (kolejna kontynuacja). Dwa równoległe
agent-audyty: (1) świeże obszary logiki — streak nawyków + health sync/correlations;
(2) wydajność, runda 4 (dokończenie odłożonego w §118 `scan.tsx`, świeży sweep pod te same
2 klasy błędów co poprzednie rundy).

**1. Streak nawyku z celem TYGODNIOWYM miał sztywny limit `w<=3` (max 4) — ta sama klasa
buga co udokumentowany "BUG FIX #2" w tym samym pliku, nigdy nie naprawiona dla gałęzi
tygodniowej.** (`src/hooks/useHabits.ts`, `getStreak()`). Realny, wielomiesięczny nawyk
"3×/tydzień" pokazywałby płomyk "4" NA ZAWSZE, niezależnie jak długo user dotrzymuje celu.

**2. `app/habit-year.tsx` w ogóle nie znało `weeklyTarget` — jawna sprzeczność liczb dla
TEGO SAMEGO nawyku między dwoma ekranami.** `stateFor`/`stats.current` liczyły surowy
dzienny streak (goal-hit per dzień), ignorując cel tygodniowy całkowicie. Zweryfikowany
konkretny scenariusz (nawyk "3×/tydzień", dziś=niedziela, zrobiony pon/śr/pt — cel
dotrzymany): lista Nawyków pokazuje płomyk **4** i badge **3/3 (zielony)**, habit-year (po
wejściu w SZCZEGÓŁY tego samego nawyku) pokazuje **"0 dni z rzędu"**.

Fix (oba naraz, jeden algorytm): `weeklyTargetStreak()` — WYDZIELONA, czysta funkcja (bez
sztywnego limitu, tylko bezpiecznik `MAX_STREAK_LOOKBACK_DAYS` jak gałąź dzienna) —
przeniesiona do `src/utils/habits.ts` (nie zostaje w `useHabits.ts`, bo ten transitively
importuje `notificationsService.ts` → `expo-notifications`, natywny ESM moduł którego jest
node-environment nie potrafi sparsować — `utils/habits.ts` jest czysty, testowalny wprost).
`getStreak()` (dashboard) i `habit-year.tsx`'s `stats.current`/`stats.longest` (dla nawyku z
`weeklyTarget`) wołają TERAZ DOKŁADNIE tę samą funkcję — jedno źródło prawdy, fizycznie nie
mogą się już rozjechać. Dzienna gałąź i kolorowanie siatki dni (per-dzień goal-hit) ZOSTAJĄ
nietknięte — to inny, legalny wskaźnik ("czy user coś zrobił tego dnia"), niezwiązany z
kontrastem który spowodował bug. 5 nowych testów w `__tests__/habitStreak.test.ts`
(bezpośrednio na wyeksportowanej funkcji — pierwszy raz cokolwiek z tej domeny logiki jest
testowalne, `habitsDoneOn` też nigdy wcześniej nie miało testu z tego samego powodu).

**3. Self-transfer leak #5 (piąta runda tego samego, powtarzającego się typu buga)** —
`app/(tabs)/index.tsx`'s karta korelacji "Zależności" (sen/kroki/nastrój ↔ wydatek dnia),
`spendByDay` w `correlations` useMemo, brakowało `isSelfTransfer`/`inScope` mimo że każdy
sąsiedni agregator w tym samym pliku (część naprawiona w §126, ta sama runda audytu co ten
wpis) już je ma. Przelew własny (np. na Revolut) zawyżał "wydatek dnia" wchodzący
BEZPOŚREDNIO w korelacje Pearsona sen↔wydatki i nastrój↔wydatki pokazywane userowi.
Naprawione (ten sam filtr co reszta pliku).

**4. Wydajność, runda 4** — trzy fixy: (a) `app/(tabs)/tasks.tsx`'s `SwipeRow` (realny
FlatList `renderItem`, callbacki już stabilne przez `useCallback`) owinięte `React.memo` —
ten sam wzorzec/klasa co `ExpenseItem.tsx` (§118), po prostu nigdy nie dostał tego samego
traktowania; (b) `src/components/pet/GearPanel.tsx`/`GearSlotModal` — gołe `usePetStore()`
zamienione na `useShallow` z jawnym wyborem pól, mimo że `app/pet.tsx` (rodzic, permanentnie
montujący ten panel na ekranie pupila) ma tę optymalizację od 2026-09-09 — `GearPanel` po
prostu nigdy jej nie dostał, więc re-renderował się na KAŻDĄ zmianę w petStore (tick energii,
quest gdzie indziej), nie tylko przy zmianie ekwipunku; (c) `app/pet.tsx`'s własne gołe
`useExpensesStore()` (tuż obok już zoptymalizowanego `usePetStore`) zamienione na selektor
pojedynczego pola.

**Explicite NIE zrobione (odłożone, priorytety niżej lub wymagają decyzji)**:
- `app/expenses/scan.tsx`'s `ProductRow`/`CustomProductRow` — POTWIERDZONY, wysoki-impact
  bug wydajnościowy (jedna literka w polu jednego produktu re-renderuje WSZYSTKIE ~20-30
  wierszy paragonu), ale wymaga większego refaktoru (~15 callbacków × 2 komponenty na
  stabilne, indeksowane referencje + customowy comparator `React.memo`, bo kilka propsów to
  świeże tablice per render). Odłożone DRUGI RAZ (pierwszy raz w §118) — świadomie, nie
  przez przeoczenie, ze względu na skalę zmiany bez siatki testów dla ekranów RN.
- Trzy NIEZGODNE definicje "tygodnia" w trzech miejscach (rolujące okno `getStreak`/
  `weeklyTargetStreak` vs. kalendarzowy tydzień pon-nd w badge'u "X/Y tydz." na karcie
  nawyku w `app/habits.tsx`) — to wymaga decyzji produktowej (który tydzień user chce
  widzieć), nie samego bugfixa; obecny fix eliminuje SPRZECZNOŚĆ liczb dashboard↔habit-year,
  ale nie ujednolica z trzecią definicją.
- Zachowanie streaka tygodniowego W TRAKCIE bieżącego tygodnia (czy "jeszcze żywy, czas
  zostaje" czy już liczy się jako przerwany) — flagowane przez audyt jako niejednoznaczne,
  nie potwierdzone jako błędne.
- Asymetria okna sprawdzania snu nocnego w `readHealthDay` (30h lookback) vs
  `readHealthRange` (brak) w `healthConnectService.ts` — niska pewność, wymaga
  zweryfikowania na urządzeniu z Health Connect.
- ~18 pozostałych gołych `useExpensesStore()` (poza `app/pet.tsx`, już naprawione) — realne,
  ale niższy impact (ekrany rzadziej re-renderowane niż permanentnie zamontowany `GearPanel`).

`tsc`/`jest` czyste (993 testy, +5 nowych).
**Priorytet testu na urządzeniu**: średni. (1) Nawyk z celem tygodniowym — sprawdź że lista
Nawyków i habit-year (szczegóły tego nawyku) pokazują TĘ SAMĄ liczbę dni z rzędu; (2) karta
"Zależności" na dashboardzie po przelewie własnym — sprawdź że korelacja sen/nastrój↔wydatki
nie skacze; (3) ekran Zadania — przewiń długą listę, sprawdź że scroll/interakcje są płynne
(regresja niemożliwa do zaobserwować wprost, tylko brak nowych problemów).

## 128. Rozbudowa panelu "Statystyki apki" — okresy, trendy, kolejność ekranów, odbicia (2026-09-18)

User: *"rozbuduje mi panel statystyk więcej szczegółów bo mam o której porze dnia i nie ma
pory dnia nie ma otwiarc dzisiaj łącznie, w tym tygodniu i miesiącu łącznie, i Porównań
otwarc, Porównań ekrnwo, jakie ekrany po sobie, czy się jakieś zacinają pomiędzy sobie
itp"*. Panel (`app/usage-stats.tsx`, §102) miał już wykres dzienny (14 dni) i "o której
porze dnia" — user potwierdza że TE zostają, brakowało reszty. Cztery nowe czyste funkcje w
`src/utils/usageStatsAnalysis.ts` (testowalne bez renderowania ekranu, ten sam wzorzec co
`bucketByDay`/`bucketByHour` obok):

1. **`periodCounts(events, now)`** — otwarcia dziś/w tym tygodniu/w tym miesiącu ŁĄCZNIE +
   poprzedni okres każdego (wczoraj/zeszły tydzień/zeszły miesiąc), liczone NIEZALEŻNIE (nie
   jedna gałąź warunków — dzień może być jednocześnie w "tym tygodniu" i "tym miesiącu").
   Tydzień = poniedziałek-start, ten sam wzorzec co reszta apki (`getWeekDates`/`weekly.tsx`).
2. **`screenTrends(events, now)`** — "Porównań ekranów": które ekrany zyskały/straciły
   otwarcia między tym a zeszłym tygodniem, sortowane po `|delta|` (duży spadek tak samo
   widoczny jak duży wzrost), nie po samej wartości bieżącej.
3. **`screenTransitions(events, maxGapMs=30min)`** — "jakie ekrany po sobie": z jakiego
   ekranu na jaki user NAJCZĘŚCIEJ przechodzi (kolejne wpisy w logu `events`, w oknie 30 min
   — dłuższa przerwa między otwarciami to NIE przejście w ramach jednej sesji, np. ostatni
   ekran wczoraj wieczorem → pierwszy dziś rano). Przejście "sam do siebie" wykluczone.
4. **`bouncePairs(transitions, minEach=3)`** — "czy się jakieś zacinają pomiędzy sobie": pary
   ekranów gdzie user odbija się w OBIE strony często (A→B I B→A, nie tylko jedna
   kierunkowa ścieżka) — sygnał że coś nie jest wygodnie dostępne z jednego miejsca.

UI (`app/usage-stats.tsx`): nowa karta "Otwarcia" (3 kafelki dziś/tydzień/miesiąc, każdy z
deltą vs poprzedni okres — ikona trend-up/trend-down/minus + kolor), "Trendy ekranów" (lista
z badge'em delty), "Najczęstsza kolejność ekranów" (top 6 par "A → B ×n"), "Ekrany na
przemian" (bounce pairs, z reassuring empty-state gdy brak wzorca zamiast ukrywania karty).
Wszystkie 4 nowe funkcje mają testy w `usageStatsAnalysis.test.ts` (13 nowych łącznie).

`tsc`/`jest` czyste (1000 testów).
**Priorytet testu na urządzeniu**: niski-średni — Ustawienia → Dane → Statystyki apki →
Zobacz pełny panel; sprawdź że liczby w "Otwarcia" zgadzają się z ranking/wykresem dziennym
(np. suma słupków dzisiejszego dnia = "dziś" w nowej karcie), i że "Najczęstsza kolejność"/
"Ekrany na przemian" pokazują sensowne, rozpoznawalne pary ekranów.

## 129. Podpięcie eksportu z Edytora układu walki — niezależne offsety pupil/boss/paski HP (2026-09-18)

User wyeksportował z `/battle-layout-lab` (§120) i wkleił w rozmowie: `{ bg:'gorskislas',
catSize:205, bossSize:150, catOffsetX:0, catOffsetY:45, bossOffsetX:0, bossOffsetY:45,
catHpOffsetX:0, catHpOffsetY:10, bossHpOffsetX:0, bossHpOffsetY:10 }`. `bg` = już domyślne
(`DEFAULT_ARENA_BG`), zero zmian tam. Podpięte do `app/boss-fight.tsx`, GLOBALNIE dla
wszystkich 6 trybów walki (dzielą tę samą arenę):

- `PORTRAIT_SIZE` 130→150, `CAT_PORTRAIT_SIZE` 175→205.
- Dawne WSPÓLNE `SPRITE_GROUND_SHIFT` (jeden przesunięcie dla obu sprite'ów, 2026-09-11/12)
  ZASTĄPIONE czterema NIEZALEŻNYMI stałymi: `CAT_OFFSET_X/Y`, `BOSS_OFFSET_X/Y` (na
  `spriteBoxCat`/`spriteBoxBoss`) — dokładnie to, czego brakowało wg komentarza w
  `battleLayoutDraftStore.ts` ("realny ekran walki NIE MA dziś żadnego per-element
  pozycjonowania").
- NOWE `CAT_HP_OFFSET_X/Y`, `BOSS_HP_OFFSET_X/Y` — paski HP wcześniej nie miały ŻADNEGO
  offsetu (gołe dzieci `tile`). Wydzielone do nowych stylów `tileHpBlockCat`/`tileHpBlockBoss`
  (owijają `tileHpTrack`+`tileHpTxt`, `gap:6` = ten sam odstęp co dawniej dawał `tile.gap`
  między tymi elementami bezpośrednio — zero wizualnej różnicy przy offsecie {0,0}).
- `projectile.top` (pozycja pocisku między sprite'ami) PRZEPISANY z ręcznie przeliczanego
  magicznego numerka (`91 + SPRITE_GROUND_SHIFT`) na wzór z nazwanych stałych (`spacing[2] +
  TILE_PORTRAIT_HEIGHT/2 - 14 + SPRITE_OFFSET_Y_AVG`) — ten dawny wzór wymagał RĘCZNEGO
  przeliczenia przy każdej zmianie `PORTRAIT_SIZE`/`CAT_PORTRAIT_SIZE` (komentarz w kodzie
  sam dokumentował 3 takie przeliczenia w historii), realne ryzyko rozjazdu przy tej samej
  zmianie gdybym to przeoczył. `SPRITE_OFFSET_Y_AVG` = średnia `CAT_OFFSET_Y`/`BOSS_OFFSET_Y`
  (oba akurat równe w tym eksporcie — 45/45), zostaje sensowna gdyby user kiedyś
  wyeksportował różne wartości dla obu.
- `TILE_PORTRAIT_HEIGHT` (nowa stała, `Math.max(PORTRAIT_SIZE, CAT_PORTRAIT_SIZE) + 18`) —
  wydzielona z inline wyrażenia w `tilePortrait.height`, bo `projectile.top` też jej
  potrzebuje; jedna definicja zamiast dwóch kopii do ręcznej synchronizacji.

**Nie ruszane w tej zmianie** (user wspomniał, ale bez konkretnej specyfikacji do wdrożenia):
przemianowanie/wywalenie starych bossów, przesunięcie cienia bliżej, usunięcie lodowej areny
("zła perspektywa") — to brzmiało jak myślenie na głos, nie gotowa specyfikacja; czeka na
konkretniejszą instrukcję. Etykiety "Pupil"/nazwa bossa nad portretami ZOSTAJĄ — to te same
etykiety co już były w realnej walce PRZED edytorem, nie artefakt samego edytora.

`tsc`/`jest` czyste (1000 testów, bez zmian w logice — czysto geometria/stałe).
**Priorytet testu na urządzeniu**: wysoki — to zmiana wizualna w KAŻDYM trybie walki. Sprawdź
że pupil/boss są większe i niżej (bliżej paska HP, mniej "lewitują"), paski HP też lekko
niżej, a pocisk między nimi leci PRZEZ sprite'y (nie nad/pod), we wszystkich 6 trybach
(kampania/raid/event/quest/mad/misja).

## 130. Fix: nieopisany pasek "% celu snu" na karcie Sen (2026-09-18)

User: "zakładka zdrowie jest mało czytelna" → doprecyzowane przez `AskUserQuestion`: "Chodzi o
sen jest duzo kresek i slupkow ale malo danych i szzegolow nic prawie nie opisane nie
wiadomo". Zbadana karta Sen (`app/(tabs)/health.tsx`) — okazało się że ma DWA paski jeden pod
drugim: `stageBar` (fazy głęboki/REM/lekki) ma pełny legend z dokładnymi minutami pod spodem
(już dobrze opisany), ale `microBar` TUŻ NAD nim — kolorowy pasek pokazujący `sleepPct =
min(1, sleepSecs / 9h)` (% z 9-godzinnego "celu") — miał ZERO tekstu obok siebie, nigdzie w
pliku. User widział samą kolorową kreskę bez żadnej wskazówki co ona znaczy ani jaka jest jej
skala — dokładnie pasuje do skargi "kreski i słupki, nic nie opisane".

Fix: dodany podpis pod paskiem (`{pct}% celu (9h) · {h}h {m}m`) — jedna linia, ten sam
wzorzec typografii co `sleepInsightSub` obok. Przy okazji doprecyzowane "wahania ±X min" →
"wahania noc do nocy ±X min" (był to std.dev wg `sleepConsistency`, bez żadnego kontekstu co
"wahania" mierzy). Reszta karty (legenda faz snu, tygodniowy wykres z liczbami pod słupkami,
sekcja "szczegóły" z tile'ami/etykietami) już była dobrze opisana — nietknięta.

**Świadomie NIE zrobione**: user w `AskUserQuestion` odrzucił opcję "pigułka ZADANIE W TOKU
zasłania górny rząd kafelków" (wybrał "co innego") — mimo że na screenie wyglądało to jak
realny overlap (`TopPill` w `app/(tabs)/_layout.tsx` to `position:'absolute', zIndex:50`
floating nad każdą zakładką) — NIE ruszane, bo user explicit powiedział że nie o to chodzi.

`tsc`/`jest` czyste (1000 testów, czysto UI-tekst, bez zmian w logice).
**Priorytet testu na urządzeniu**: niski — Zdrowie → karta Sen → sprawdź że pod kolorowym
paskiem pojawia się teraz podpis z %/godzinami.

## 131. Fix: "nagród do odbioru" nie odmieniało się przez liczbę + audyt tej samej klasy buga (2026-09-19)

User: *"jak na dashboardzie pokazuje się że mam do odebrania nagrody u pupila to nie odmienia
sieę przez liczbę chyba posrpawdzaj tam i wszędzie takie rzeczy logiczne"*. `PetTile.tsx`
(kafel pupila na dashboardzie, `nodes['pet']` w `index.tsx`) miał na sztywno `{claimable}
nagród do odbioru` — zawsze dopełniacz l.mn. ("1 nagród", "2 nagród"), niezależnie od
liczby, zamiast "1 nagroda"/"2 nagrody"/"5 nagród". Fix: użyty istniejący, ale wcześniej
NIEUŻYTY tutaj `plPlural(n, one, few, many)` z `src/utils/plural.ts` (poprawna polska
odmiana: 1→one, 2-4→few poza 12-14, 0/5-21/12-14→many — ten sam helper już poprawnie użyty
w `TopPill.tsx`). Dodany pierwszy test dla samego `plPlural` (nigdy wcześniej nietestowany
mimo istniejących zastosowań) — `__tests__/plural.test.ts`, 5 przypadków w tym pułapkę
112-114 (kończą się na 12-14, ale to "many" nie "few").

Delegowany agent-audyt na TĘ SAMĄ klasę buga w całej apce (user: "sprawdzaj tam i wszędzie") —
w toku, wynik w kolejnym wpisie po zakończeniu.

`tsc`/`jest` czyste (1005 testów, +5 nowych).
**Priorytet testu na urządzeniu**: niski — dashboard, kafel pupila z 1/2/5+ nagrodami do
odebrania, sprawdź poprawną odmianę.

## 132. Wynik agent-audytu §131 — 26 miejsc bez poprawnej odmiany przez liczbę, naprawione (2026-09-19)

Kontynuacja §131 (user: "sprawdzaj tam i wszędzie takie rzeczy logiczne"). Agent-audyt
przeszukał `app/`+`src/` pod kątem `{count} rzeczownik` z rzeczownikiem który powinien się
odmieniać (1/2-4/5+), znalazł 29 kandydatów. Po weryfikacji: 26 realnych bugów naprawionych
`plPlural()`, 3 świadomie NIE ruszone (były już poprawne — patrz niżej).

**Dwie klasy buga**, oba dają złą liczbę mnogą:
1. **Rzeczownik na sztywno** — najczęstsza: `${n} rekordów`/`${n} produktów`/`${n} zadań`
   niezależnie od `n`, poprawne tylko dla 5+/0.
2. **Dwuwariantowy ternary zamiast trójwariantowego** — user/wcześniejszy kod zauważył
   problem l.poj./l.mn., ale polski ma TRZY formy (1 / 2-4 / 5+), nie dwie: `n===1 ?
   'nawyk' : 'nawyki'` jest błędne dla n≥5 (powinno być "nawyków"); `n===1 ? 'odznaka' :
   'odznak'` jest błędne dla n=2-4 (powinno być "odznaki") — zależnie który wariant ktoś
   scalił, błąd wychodzi w innym kierunku.

**Naprawione (26 miejsc, pełna lista w PR)**: `notificationsService.ts` (tytuł/treść
powiadomień — realny push, wysoki priorytet), `dashboard/format.ts`'s `fmtStat()` (dzielona
funkcja, szeroki zasięg), dashboard (`index.tsx`: seria logowań/monety, nawyk(i) wieczorem,
odznaki, pozycje tagu), `habit-year.tsx` (najdłuższa seria), `finances.tsx` (dzień
miesiąca — "dnia"→"dni", bo `daysInMonth` to ZAWSZE 28-31, nigdy l.poj.), `weekly.tsx`
(wpisy), `ExpenseItem.tsx`/`products.tsx`/`manual.tsx`/`audit.tsx`/`stats.tsx` (produkty/
pozycje/wpisy/kategorie), `items.tsx`/`subscriptions.tsx` (dni do terminu/interwał),
`box-stats.tsx` (otwarcia), `GearPanel.tsx` (itemy przy zbiorczej sprzedaży),
`monthlyReports.ts` (dni zalogowane — 2 miejsca miesięczne + 2 roczne), `focus.tsx`
(kroki podzadań — zobacz "NIE ruszone" niżej, pominięte celowo w jednym miejscu),
`bossProgressReport.ts` (rundy walki — **+ naprawiony test, który asercją zamrażał złą
odmianę "2 rund"**), `MonthWrappedCard.tsx` (dni kroków, rekordy miesiąca),
`settings.tsx`/`BackupSection.tsx` (dni backfillu Samsung Health, rekordy kopii zapasowej),
`health.tsx`/`healthConnectService.ts` (diagnostyka Health Connect — najniższy priorytet,
za przyciskiem debug).

**Świadomie NIE ruszone — 3 przypadki, gdzie audyt/pierwsza wersja fixa BYŁYBY błędem**:
konstrukcja ułamkowa "X/Y rzeczownik" (np. "3/5 zadań", "2/7 sesji") bierze dopełniacz l.mn.
ZAWSZE, niezależnie od Y — to nie jest bezpośrednie liczebnik+rzeczownik (few/many), tylko
"X z Y" (jak po przyimku "z"), a dopełniacz l.mn. ma JEDNĄ formę dla wszystkich liczb ≥2.
Podmiana na `plPlural(Y,...)` w `monthlyReports.ts`'s "${done}/${monthTasks.length} zadań"
i `healthConnectService.ts`'s "${sessionsWithStages}/${sessions} sesji" BYŁABY nową,
subtelniejszą wersją tego samego buga (wypisano to jako komentarz w kodzie, żeby nikt tego
nie "naprawił" ponownie w złą stronę). `focus.tsx`'s "{done}/{total} kroków" to ta sama
konstrukcja ułamkowa — zostawione bez zmian z tego samego powodu.

`tsc`/`jest` czyste (1005 testów — jeden istniejący test w `monthlyReports.test.ts`
zaktualizowany, bo asercja sprawdzała STARĄ, błędną odmianę "1 dni" zamiast "1 dzień").
**Priorytet testu na urządzeniu**: niski-średni — rozproszone po całej apce, żaden pojedynczy
ekran nie jest krytyczny, ale warto rzucić okiem na dashboard (kafel pupila/nawyki wieczorem/
gablota) i powiadomienia push (jeśli akurat trafi się 3-4 zadania jutro).

---

## 133. Fix: ekran Bossy domyślnie wracał na "Kampania" mimo skończonej kampanii (2026-09-19)

User: "jak pokonałem wszystkie bossy kampanii to główna zakładka musi być wtedy madbossy".
Przełącznik Kampania/MAD na ekranie `app/bosses.tsx` (§ z 2026-08-21, `bossView` state) miał
`useState('campaign')` na stałe — z kampanią w 100% skończoną (`current` == null, wszyscy 22
bossowie pokonani) zakładka "Kampania" pokazywała tylko martwy ekran "Wszyscy bossowie
pokonani! Kolejni wkrótce." (linia `s.done`), a jedyny realny cel na tym etapie (MAD bossy)
wymagał ręcznego przełączenia PRZY KAŻDYM wejściu na ekran, bo ekran się odmontowuje między
wizytami (nie jest jednym z 6 zakładek w `(tabs)/_layout.tsx`, tylko osobny stack screen pod
`router.push`) — `useState` initial value resetuje się do `'campaign'` na nowo za każdym
razem.

**Fix**: `bossViewOverride` (`'campaign' | 'mad' | null`, domyślnie `null`) + wyprowadzone
`const bossView = bossViewOverride ?? (current ? 'campaign' : 'mad')`. Bez ręcznego kliknięcia
przełącznika w danej sesji ekranu, domyślna zakładka podąża za postępem: "Kampania" dopóki
jest niepokonany boss (`current` istnieje), "MAD bossy" gdy kampania skończona. Kliknięcie
przełącznika ustawia `bossViewOverride` na wybraną wartość i to trzyma się do opuszczenia
ekranu — user może np. świadomie wrócić na "Kampania" (ściany medali, przegląd pokonanych),
bez wciąż naprowadzania go z powrotem na "MAD" po każdej interakcji.

`tsc`/`jest` czyste (1005 testów — bez zmian w testach, czysto UI-default). **Priorytet testu
na urządzeniu**: niski — pokonaj (albo symuluj przez dev tools) wszystkich 22 bossów kampanii,
wejdź na ekran Bossy z innej zakładki → powinien od razu otworzyć się na "MAD bossy", nie
"Kampania"; ręczne przełączenie na "Kampania" powinno trzymać wybór do wyjścia z ekranu.

---

## 134. Wydajność `scan.tsx` — literka w jednym produkcie re-renderowała CAŁY paragon (2026-09-19)

Dokończenie DRUGI RAZ odłożonego fixa (§118 pierwsze odłożenie, §127 "explicite NIE
zrobione" drugie) — potwierdzony, wysoki-impact bug wydajnościowy: `ProductRow`/
`CustomProductRow` (ekran skanowania paragonu) re-renderowały się WSZYSTKIE (~20-30 wierszy)
na każdą zmianę w polu JEDNEGO produktu — nazwa, cena, waga, ilość, tag, wykluczenie z
podziału, wybór "kto jadł". Przy dużych paragonach (Biedronka/Lidl z 20+ pozycjami) to realny,
odczuwalny lag przy wpisywaniu w dowolnym polu.

**Przyczyna**: `ProductRow` był zwykłą funkcją (bez `React.memo`), a KAŻDY z ~15 callback
propsów (`onToggle`, `onCategoryPress`, `onPriceChange`, `onNameChange`, `onTagsChange`, ...)
był tworzony jako `() => handler(i)` NA NOWO przy każdym renderze rodzica (czyli po KAŻDEJ
zmianie stanu — w tym stanu ZUPEŁNIE INNEGO wiersza). Nawet z gołym `React.memo` to by nic nie
dało — nowa referencja funkcji na propsie = memo zawsze widzi "coś się zmieniło", więc re-
renderuje. Ten sam wzorzec (i ten sam bug) w `CustomProductRow`.

**Fix, dwuczęściowy** (dokładnie jak przewidziano w §127 — "stabilne, indeksowane referencje +
customowy comparator"):
1. **Wszystkie ~15+8 callbacków przeniesione do rodzica jako `useCallback` z PUSTYMI deps**,
   biorące `index`/`idx` jako PIERWSZY argument (np. `onPriceChange(i, v)` zamiast domykania
   `i` w closure na miejscu wywołania). Bezpieczne z pustymi deps, bo każdy już używał
   funkcyjnego `setState(prev => ...)` — żaden nie domykał się na zewnętrznym stanie poza
   nullowaniem innych pickerów (co jest bezwarunkowe, nie potrzebuje aktualnej wartości).
   W JSX (`groups.map`/`displayItems.map`/`customProducts.map`) callbacki przekazywane teraz
   WPROST (`onToggle={toggleProduct}`, nie `onToggle={() => toggleProduct(i)}`) — ta sama
   referencja funkcji na każdy render rodzica.
2. **`ProductRow`/`CustomProductRow` owinięte `React.memo` z WŁASNYM comparatorem**
   (`productRowPropsEqual`/`customProductRowPropsEqual`), nie domyślnym shallow-compare —
   trzy propsy (`productTags`, `eaters`, `priceFlag`) bywają NOWĄ wartością o TEJ SAMEJ treści
   nawet dla niezmienionego wiersza (auto-detekcja tagów z nazwy i `priceAnomaly()` liczą się
   na nowo z surowych danych przy każdym renderze rodzica, nie są zapamiętane w stanie), więc
   `sameStrings`/`samePriceFlag` porównują WARTOŚĆ dla tych trzech, reszta to już stabilne
   prymitywy/referencje po (1) — `===` wystarcza.

Efekt: edycja jednego pola re-renderuje TYLKO ten jeden wiersz (plus max. 1-2 inne, jeśli
zmiana zamyka/otwiera picker gdzie indziej) — nie całą listę.

`tsc`/`jest` czyste (1005 testów, bez zmian w testach — czysto wydajnościowy refaktor, brak
siatki testów dla ekranów RN jak flagowano w §127, więc weryfikacja na urządzeniu jest tu
WYŻSZYM priorytetem niż zwykle). **Priorytet testu na urządzeniu — średni-wysoki**: (1)
zeskanuj/wklej długi paragon (20+ pozycji), edytuj nazwę/cenę/wagę/ilość w JEDNYM wierszu —
powinno być płynne, bez lagu; (2) sprawdź że otwieranie kategorii/tagów na jednym wierszu
poprawnie ZAMYKA picker na innym (współdzielony `catPickerFor`/`tagPickerFor` — regresja
możliwa, jeśli `useCallback` coś przeoczył); (3) "kto jadł" (2+ płatników), merge-sugestia
("To samo co...?"), wykluczenie "nie moje", ręcznie dodane produkty (`CustomProductRow`) —
wszystkie ścieżki edycji przetestowane logicznie, ale bez testów RN wymagają realnego kliku;
(4) zapis paragonu na końcu — upewnić się że `saveSelected` wciąż widzi wszystkie edycje
(nie powinno się zmienić, `editedX` stany nietknięte, tylko sposób przekazania do wierszy).

---

## 135. Redesign check-inu humoru — siatka nastrój×energia, notatka opcjonalna, logiczniejsze tagi (2026-09-19)

User (ze screenem "Jak się czujesz?"): *"nie wiadomo co zaznaczam za bardzo nie zawsze da sie
szybko kliknąć potem jeszcze tag i potem opisywać dawaj pomysly"*. Po burzy mózgów (patrz
transkrypt) user doprecyzował przez `AskUserQuestion`: notatka opcjonalnie OK, statyczne
podpisy pod każdą buźką "słabe" (niska priorytet) — chce **zbicia liczby kroków** (połączyć
nastrój+energię w jedną siatkę 2D) i **logicznego polecania tagów** (pora dnia/dzień tygodnia
+ dane z innych ekranów + ostatnio używane, NA WIERZCHU istniejącej logiki mood/energy).

**1. Notatka dnia opcjonalna** (`MoodCheckInModal.tsx`) — `handleSave` blokował zapis Alertem
bez tekstu notatki; usunięte, `AnimatedButton`'s `disabled` już nie sprawdza `!note.trim()`.
Placeholder/label doprecyzowane ("Notatka dnia (opcjonalnie)"). To była realnie największa
przyczyna "nie da się szybko kliknąć" — 4 wymuszone kroki (nastrój+energia+tag+notatka)
zmniejszone do 2 (nastrój+energia), reszta zostaje ale nie blokuje.

**2. Nowy `MoodEnergyGrid.tsx`, zamiast dwóch osobnych `MoodPicker` (usunięty, był orphaned po
podmianie — nigdzie indziej nie używany, sprawdzone grepem).** Siatka 5×5 (oś X = nastrój,
lewo→prawo gorzej→lepiej; oś Y = energia, dół→góra mniej→więcej — układ jak "circumplex model
of affect" z psychologii, nie wymyślony od zera) — jedno tapnięcie LUB przeciągnięcie ustawia
OBA wymiary naraz, `Gesture.Pan().minDistance(0)` (żeby zwykły tap i drag obsłużyć jednym
gestem, bez osobnego Tap+Pan). Zamiast statycznych podpisów pod KAŻDĄ z 25 komórek (user:
"słabe", świadomie pominięte — więcej szumu, nie mniej) jest jeden ŻYWY odczyt pod siatką
("{emoji} {etykieta} · {emoji} {etykieta}"), aktualizujący się na bieżąco podczas
przeciągania — mocniej odpowiada na "nie wiadomo co zaznaczam" niż 25 małych napisów naraz.
Tło siatki to subtelny diagonalny `LinearGradient` (już zależność apki) jako wizualna
podpowiedź kierunku, bez dodatkowych podpisów osi. Wskaźnik-kropka animowany klasycznym
`Animated` (react-native, nie reanimated) w PIKSELACH, spójnie ze starym `MoodPicker.tsx`.
Worklet `.onUpdate` liczy col/row z `evt.x`/`evt.y`, `lastKey` (reanimated `useSharedValue`)
pilnuje żeby `runOnJS`/haptyka odpaliły się TYLKO przy faktycznej zmianie komórki, nie na
każdą klatkę ruchu palca.

**RYZYKO DO SPRAWDZENIA NA URZĄDZENIU (zaflagowane w kodzie)**: siatka siedzi w zwykłym
`ScrollView` (react-native) w `MoodCheckInModal.tsx`, nie gesture-handler. `minDistance(0)`
powinno dać jej priorytet nad scrollem rodzica dla dotknięć zaczynających się NA siatce
(wzorzec "samodzielnej kontrolki", jak suwak) — jeśli w praktyce gubi dotknięcia albo blokuje
scroll modala, prosty fix to zamiana importu `ScrollView` w `MoodCheckInModal.tsx` z
'react-native' na 'react-native-gesture-handler' (drop-in, ten sam props API).

**3. `sortMoodTags` (moodTags.ts) — DWA nowe sygnały ponad istniejące mood/energy-relevance**:
(a) `contextAffinity` — pora dnia (±2h) / dzień tygodnia, jako UDZIAŁ wystąpień tagu w tym
kontekście spośród WSZYSTKICH jego wystąpień (nie surowa liczba, żeby popularny tag nie
wygrywał tylko dlatego że ma więcej wpisów w ogóle); (b) `recencyWeight` — częstość z
half-life 14 dni (`Math.pow(0.5, dni/14)`), więc świeżo używany tag bije taki sam użyty pół
roku temu. Finalny wzór: `tagRelevance×10 + contextAffinity×2 + recencyWeight` — mnożniki tak
dobrane, że wybrany TERAZ nastrój/energia zawsze dominuje (różnica o 1 punkt relevance = 10,
więcej niż realny zakres pozostałych dwóch razem), kontekst/recency to tie-break przy remisie
trafności, nie nadpisanie jej. Bez wybranego mood/energy `tagRelevance` daje 0 dla każdego
tagu, więc formuła naturalnie redukuje się do samego kontekstu+recency — bez osobnej gałęzi.
Sygnatura `sortMoodTags` zmieniona z `(mood, energy, tagFrequency: Map)` na `(mood, energy,
entries: MoodEntry[], now?)` — call site (`MoodCheckInModal.tsx`) przekazuje teraz
`allEntries` zamiast `tagFrequency`; `tagFrequency` (Map) ZOSTAJE w modalu, ale już TYLKO do
liczby na chipie (`count={tagFrequency.get(tag)}`) — osobny cel (surowa suma "ile razy w
ogóle" ma pozostać surowa, nie recency-ważona).

**Świadomie NIE zrobione**: sygnał z innych ekranów apki (sen/kroki/wydatki) — user wybrał tę
opcję w `AskUserQuestion`, ale `MoodEntry` nie przechowuje żadnego z tych sygnałów, a jedyne
źródło (np. sen) żyje w statefulnym, async pipeline'ie synchronizacji Health Connect w
`health.tsx` (nie ma go jako prostego selektora) — doprowadzenie go tu oznaczałoby albo
duplikację całego syncu, albo czytanie na twardo jego prywatnego klucza AsyncStorage z
zewnątrz, obu nie da się zweryfikować bez fizycznego urządzenia z realnymi danymi Health
Connect. Odłożone świadomie — wymaga najpierw wydzielenia współdzielonego selektora
"dzisiejszy sen/kroki", osobne zadanie.

`tsc`/`jest` czyste (1008 testów, +3 nowe w `moodTags.test.ts` — testy przepisane pod nową
sygnaturę `sortMoodTags`, z jawnym `now` żeby recency-decay nie zależał od realnego czasu
odpalenia testu). **Priorytet testu na urządzeniu — wysoki, bez siatki testów dla gestów RN**:
(1) dotknij/przeciągnij po siatce — sprawdź płynność, brak "gubienia" dotknięć, i że scroll
modala wciąż działa POZA siatką (patrz ryzyko wyżej); (2) zapisz check-in BEZ notatki —
powinno przejść; (3) sortowanie tagów po ustawieniu nastroju/energii wciąż stawia trafne wyżej
(regresja niemożliwa do zaobserwowania wprost, tylko czy kolejność "czuje się" sensownie);
(4) edycja istniejącego wpisu (`existingEntry`) — kropka na siatce startuje w poprawnej
komórce.

---

## 136. Fix: eksport postępu pupila tracił starsze walki zamiast je skracać (2026-09-19)

User: *"zrob potem pełna historie eksportu pupila bo pozniej te bossy stają sie tak wiele XP i
coinow w pizdu z dnia na dzień wbiłem z 51 lvl na 270 xddd pojebane ja eksportuje i jeszcze
bardziej to ulepszyć"* — czyli: (1) chce PEŁNEJ historii w eksporcie "Udostępnij raport
postępu pupila" (Ustawienia → Pupil/Diagnostyka, `buildBossProgressReport`), bo zauważył
podejrzanie stromy skok (51→270 poziom w jeden dzień) i chce mi wysłać realne dane do dalszego
balansowania nagród bossów; (2) to zadanie "na potem" (nie pilna gameplay-owa zmiana).

**Realny bug**: `buildBossProgressReport`'s `logLimit` (domyślnie 30) nie SKRACAŁ raportu —
UCINAŁ go. Wpisy starsze niż 30. najnowszych znikały z eksportu CAŁKOWICIE, niewidoczne w
ogóle, nie tylko bez szczegółów. Przy skoku 51→270 poziomów w jeden dzień (setki walk,
zwłaszcza MAD bossy — 10× hp kampanii, patrz `madBosses.ts`) to oznaczało że >90% realnej
historii nigdy nie trafiało do eksportu — dokładnie odwrotność tego czego user potrzebuje do
analizy tego skoku.

**Fix** (`bossProgressReport.ts`): `logLimit` → `detailLimit` — kontroluje TERAZ tylko ile
NAJNOWSZYCH walk dostaje pełny przebieg runda-po-rundzie (HP bossa/kotka w czasie, dmg/rundę —
jak dotąd, potrzebne do oceny trudności KONKRETNEJ walki). Wszystkie STARSZE wpisy trafiają do
nowej sekcji "STARSZE WALKI, skrót" — jedna linia każda (kiedy/rodzaj/nazwa/poziom/wynik/
nagroda, bez rund/HP) — nic już nie znika, tylko szczegółowość spada ze zamierzchłością. To
wystarcza żeby odtworzyć krzywą XP/monet w czasie (cel usera), bez rozdymania eksportu do
nieudostępnialnego rozmiaru pełnym przebiegiem KAŻDEJ z potencjalnie setek walk. Domyślny
`detailLimit` zostaje 30 — nie było potrzeby go zmieniać, problem był w UCINANIU, nie w samej
liczbie.

`tsc`/`jest` czyste (1008 testów — jeden istniejący test zaktualizowany pod nowe zachowanie,
z komentarzem wyjaśniającym że stare `logLimit` gubiło dane, nowe `detailLimit` tylko obniża
szczegółowość). Priorytet testu na urządzeniu: niski (czysto narzędzie diagnostyczne, nie
gameplay) — user: idź do Ustawienia → Pupil → "Udostępnij raport postępu pupila" i wyślij mi
pełny eksport, żebym mógł faktycznie zobaczyć krzywą 51→270 i zaproponować konkretny fix
balansu (bez realnych liczb nie da się ocenić czy to bug w `madRewardMultFor`/`MAD_HP_MULT`
czy coś innego — ta sama zasada co przy każdej wcześniejszej kalibracji bossów w tej sesji:
throwaway-symulacja na realnych danych, nie zgadywanie).

---

## 137. Fix: kamień milowy w tasku nie skreślał się na żywo, tylko po wyjściu/wejściu (2026-09-19)

User (ze screenem modala "Umyć brodzik prysznicowy"): *"jak klikam milestony w taskach to
dziala tylko nie zaznacza sie na żywo muszę wyjść i wejść z taska zeby sie skreslilo z
listy"*.

**Przyczyna**: `TaskDetailModal` w `app/(tabs)/tasks.tsx` renderuje kamienie milowe wprost z
propa `task.subtasks`. Rodzic (`TasksScreen`) trzymał ten task w `detailTask` —
zwykły `useState<Task | null>`, ustawiany RAZ w `handleEditPress` (`setDetailTask(task)`) w
chwili otwarcia modala. `onToggleSubtask` (kliknięcie checkboxa) poprawnie aktualizował listę
`tasks` w `calendarStore.ts` (nowa referencja, `updateTask` mapuje niemutowalnie — sprawdzone),
ale `detailTask` był ZAMROŻONĄ kopią z chwili otwarcia i nic go nie synchronizowało z żywym
stanem — modal renderował dalej starą wersję (checkbox bez ✓, tekst bez przekreślenia) dopóki
nie zamknięto i otworzono go ponownie (co na nowo wołało `handleEditPress` ze świeżym taskiem).

**Fix**: `detailTask` (obiekt) → `detailTaskId` (samo id) + `useMemo` wyliczający właściwy
task z aktualnej listy `tasks` (`tasks.find(t => t.id === detailTaskId)`). Modal automatycznie
widzi zmianę zaraz po `onToggleSubtask`, bo `detailTask` przelicza się z KAŻDĄ zmianą `tasks`,
nie tylko przy otwarciu. Sprawdzone czy ten sam wzorzec (checklist z live-toggle wewnątrz
modala karmionego zamrożonym snapshotem) występuje gdzie indziej — `habits.tsx`/`mood.tsx`'s
`editingHabit`/`editingEntry`/`confirmDelete*` to zwykłe formularze edycji (kopiują pola do
własnego stanu formularza, submit/close, nic zewnętrznego nie mutuje obiektu W TRAKCIE gdy
formularz jest otwarty) i `habit-year.tsx`'s `habit` to statyczny widok statystyk (ładowany
raz, bez interaktywnego checklisty) — żaden nie ma tego samego kształtu buga, izolowany
przypadek.

`tsc`/`jest` czyste (1008 testów, bez zmian w testach — czysto UI-sync, nie ma dla tego
sensownego testu bez renderowania komponentu). Priorytet testu na urządzeniu: niski — otwórz
task z kamieniami milowymi, zaznacz jeden bez zamykania modala — powinien przekreślić się
OD RAZU, nie dopiero po zamknięciu/otwarciu.

---

## 138. Audyt logika/optymalizacja — kalendarz/questy/subskrypcje, 4 znaleziska (2026-09-20)

User: "co teraz? dalej testy logiki o optymalizacja?" — kolejna runda tego samego typu co
poprzednie w tej sesji (§126/§127 itd.), tym razem na świeżych obszarach: kalendarz, questy
pupila, pomodoro/focus, subskrypcje, jedzenie. Delegowany agent-audyt (bez edycji kodu, tylko
rozpoznanie z konkretnym repro na każde znalezisko) znalazł 4 potwierdzone bugi, wszystkie
zweryfikowane osobiście przed fixem (throwaway-repro w Node dla obu miejsc z datami).

**1+2. TA SAMA klasa buga w DWÓCH miejscach — `setMonth`/`setFullYear` na dzień
nieistniejący w docelowym miesiącu PRZEWIJA (day overflow), nie przycina.**
- `useTasks.ts`'s `nextDeadline()` — zadanie cykliczne "monthly" z deadline'em 31. dnia
  miesiąca po ukończeniu skakało DWA miesiące dalej na 3. dnia (luty całkowicie pomijany;
  zweryfikowane w Node: `new Date('2026-01-31').setMonth(+1)` → 2026-03-03), seria trwale
  dryfowała od tego momentu.
- `subscriptions.tsx`'s `advanceNextBillingDate`/`isDurationExpired` — TEN SAM bug w cichym
  auto-rollu zaległej `nextBillingDate` (bez pytania usera) i w liczeniu końca subskrypcji z
  `durationMonths`. Subskrypcja z dniem 29-31 traciła po cichu jeden cykl płatności z
  prognozy przy każdym auto-rollu.

Fix: `date-fns`'s `addMonths`/`addQuarters`/`addYears` (już zależność apki) zamiast ręcznej
arytmetyki — poprawnie PRZYCINAJĄ do ostatniego dnia miesiąca (Jan 31 + 1mies. = Feb 28, nie
Mar 3; zweryfikowane w Node przed użyciem). `nextDeadline` wydzielone z `useTasks.ts` do
`utils/date.ts` (dla testowalności — `useTasks.ts` transitively importuje
`notificationsService.ts`→`expo-notifications`, node-environment jest.config nie potrafi tego
sparsować, ten sam problem co `useHabits.ts` z §127). `advanceNextBillingDate`/
`isDurationExpired` przeniesione z `subscriptions.tsx` do `utils/recurringBills.ts` z tego
samego powodu (screeny pod `app/` nigdy nie są importowane bezpośrednio w testach —
sprawdzone grepem po całym `__tests__/`). `nextBillingDate` (INNA funkcja w tym samym pliku,
używana do sugerowania NOWEGO rachunku) sprawdzona i POTWIERDZONA bezpieczna — jej
`dayOfMonth` jest już przycięty do 1-28 wcześniej w pipeline, więc `setMonth` tam nigdy nie
przewija (każdy miesiąc ma ≥28 dni).

**3. `googleCalendarService.ts`'s `mapEvent` — sync z Google Calendar gubił wielodniowe
eventy poza pierwszym dniem.** `CalendarEvent.endDate` (pole na którym opiera się
`eventCoversDay`/`isMultiDay`, types/index.ts) nigdy nie było ustawiane przy mapowaniu eventu
z Google — `mapEvent` czytał tylko datę startu. Wielodniowy event utworzony WPROST w Google
Calendar (nie w tej apce — np. urlop/wyjazd zaimportowany z synchronizacji) pokazywał się w
kalendarzu TYLKO w dniu startu. Fix: `mapEvent` liczy teraz `endDate` z `e.end.date`/
`e.end.dateTime` — Google's `end.date` dla eventów całodniowych jest EXCLUSIVE (1-dniowy
event ma end=start+1, 3-dniowy 20→23 ma end=24), nasze `endDate` jest INCLUSIVE, więc trzeba
odjąć 1 dzień (dokładnie odwrotność tego co `createEvent`/`updateEvent` w tym samym pliku już
poprawnie ROBIĄ +1 dzień przy zapisie w drugą stronę). Dla eventów z godziną (nie całodniowych)
`end.dateTime` jest już precyzyjnym momentem, bez odejmowania. Wydzielone do nowego
`utils/googleCalendarMap.ts` (dla testowalności — `googleCalendarService.ts` importuje
`@react-native-google-signin/google-signin`, natywny ESM moduł którego jest.config
(`testEnvironment: 'node'`, brak whitelisty w `transformIgnorePatterns`) nie potrafi
sparsować — zweryfikowane bezpośrednio: import wywalał się `SyntaxError: Unexpected token
'export'` zanim to wydzielono).

**4. Wydajność — `usePetQuests.ts`/`pet-quests.tsx`, gołe `usePetStore()`/`useExpensesStore()`
bez selektora, ten sam wzorzec co już naprawiony w `pet.tsx`/`GearPanel.tsx` (audyt wydajności
runda 2/4).** Impact wyższy niż zwykły ekran: `usePetQuests()` zasila TEŻ ping-badge na
`PupilNavbar`, widoczny na WSZYSTKICH 4 ekranach Pupila (nie tylko `pet-quests.tsx`) — każda
niepowiązana zmiana w `petStore`/`expensesStore` (tick energii, walka, gear gdzie indziej)
re-renderowała badge na każdym z 4 ekranów. Fix: `usePetStore(useShallow(s => ({...})))` +
`useExpensesStore(s => s.expenses)`, dokładnie wzorzec z `pet.tsx`.

**Sprawdzone przez agenta — czyste, bez zmian**: Pomodoro (hardcoded 5/15 min break —
odrzucone jako false-positive, store nie ma settera do zmiany tych pól, brak realnej ścieżki
do rozjazdu); Questy pupila (`quests.ts`/`usePetQuests.ts` — claim-race niemożliwy, zustand
synchroniczny; niższa nagroda za zaległe questy to udokumentowany design, nie bug); Jedzenie/
kalorie (liczenie przez lokalne `Date`, bez parsowania stringów — brak TZ-bugów; dwa systemy
liczenia kalorii celowo rozdzielone).

`tsc`/`jest` czyste (1026 testów, +18 nowych: 4 w `date.test.ts` dla `nextDeadline`, 8 w
nowym `recurringBills.test.ts` — w tym 2 z `jest.useFakeTimers()` na granicy przyciętej vs.
przewiniętej daty, żeby test faktycznie ROZSTRZYGAŁ które zachowanie działa, nie tylko
sprawdzał typ zwrotu — i 6 w nowym `googleCalendarMap.test.ts`). **Priorytet testu na
urządzeniu**: średni — (1) dodaj zadanie cykliczne "co miesiąc" z deadline'em 29-31, ukończ
je, sprawdź że nowy deadline TRZYMA się końca miesiąca zamiast dryfować; (2) subskrypcja z
dniem rozliczenia 29-31 i przynajmniej jednym zaległym cyklem — sprawdź `nextBillingDate` po
auto-rollu; (3) jeśli masz podłączony Google Calendar — zaimportuj/sprawdź wielodniowy event
utworzony wprost w Google (nie w tej apce), powinien teraz pokazywać się na WSZYSTKICH swoich
dniach w kalendarzu/DayTimeline, nie tylko pierwszym; (4) ping-badge Pupila (4 ekrany) —
regresja niemożliwa do zaobserwowania wprost, tylko brak nowych problemów.

---

## 139. Przebudowa nagród MAD bossów — drugi raz, na podstawie realnego eksportu (2026-09-20)

Kontynuacja §136/NEXT_STEPS.md "czekam na dane usera". User przysłał pełny (na tyle ile
stara wersja apki eksportowała) raport postępu pupila po skoku 51→270 poziomów w jeden
dzień. Analiza logu walk potwierdziła dokładnie to podejrzenie: MAD order1 (Kanapowy
Leniwiec, unlockLevel 15, najłatwiejszy MAD boss) dawał **1:1 tyle samo** co legalne
pokonanie fabularnego finału kampanii (Iluzja Kontroli, unlockLevel 116) — `+24244 monet,
+225000 XP` widoczne w logu identycznie dla obu. Pięć walk MAD w jeden dzień dało ~1,46 mln
XP, kolejne cztery następnego dnia ~1,78 mln XP — **łącznie ~82% CAŁEGO XP na koncie usera z
zaledwie 9 walk**. Przyczyna: model z §~64 (2026-08-22, `MAD_REWARD_GROWTH_PER_ORDER`) miał
floor = 100% nagrody finału JUŻ OD order1, rosnący +15%/order dalej — user sam wtedy o to
poprosił ("nagrody z nich kontynuacja jak po ostatnim busie kampanii"), ale po realnym
zagraniu okazało się że to za dużo.

**Nowy kształt, zaproponowany i wybrany przez usera (`AskUserQuestion`)**: order1 = własna
nagroda bossa z kampanii (mała, adekwatna do Lv15), order22 (Iluzja Kontroli = sam finał) =
nagroda finału, bez skoku na granicy. Pierwsza, naiwna implementacja czystej interpolacji
własna→finał okazała się jednak płacić śmiesznie mało na dole skali (order1: 8 monet za
pokonanie 5400-HP bossa z 3× kontratakiem, MNIEJ niż pojedynczy quest ~42-125 monet) — MAD ma
STAŁE 10× hp (`MAD_HP_MULT`)/3× kontratak (`MAD_COUNTER_MULT`) NIEZALEŻNIE od order, więc
nawet najlżejszy MAD jest realnie trudniejszy niż swój kampanijny odpowiednik.

**Finalny wzór** (`madRewardFor` w `madBosses.ts`): dolna kotwica dostaje mnożnik trudności
malejący liniowo `REWARD_BOOST_AT_ORDER_1=20` (order1) → `1` (order finale, gdzie mnożnik by
już nic nie zmieniał — wartość jest tam i tak sama finałem). Bez dodatkowego zabezpieczenia
ten podbity mnożnik dla orderów ~15-21 PRZEKRACZAŁBY finał (np. order19: 6800×~3.7≈25000 >
finał 22000), co w interpolacji dawałoby NIE-MONOTONICZNĄ krzywą — nagroda rosłaby POWYŻEJ
finału w środku skali, po czym SPADAŁABY z powrotem do finału na order22 (późniejszy,
trudniejszy MAD dawałby MNIEJ niż wcześniejszy — dokładnie odwrotność zamierzonego efektu).
Znalezione throwaway-symulacją w Node (przeliczenie wszystkich 22 kroków dla czterech
kandydackich wartości capu 0.5-0.8× finału) PRZED wdrożeniem, nie po fakcie —
`REWARD_ANCHOR_CAP_OF_FINALE=0.6` (środek sprawdzonego, monotonicznego zakresu) przycina
dolną kotwicę tak, żeby nigdy nie przekroczyła 60% finału, co eliminuje problem przy
zachowaniu tego samego kształtu na obu końcach skali.

Przykładowe wartości po fixie (coins/xp): order1 (Kanapowy Leniwiec) 160/1200 (było
24244/225000 — spadek ~150×), order5 (Złodziej Czasu) 4787/48824 (było 38790/360000), order10
(Hydra Odwodnienia) 10784/109980, order22 (Iluzja Kontroli, finał) bez zmian.

`tsc`/`jest` czyste (1026 testów — 3 stare testy w `madBosses.test.ts` zastąpione nowymi:
order1 wyraźnie mniej niż finał ale wyraźnie więcej niż własna nagroda, order22 dokładnie
finał bez skoku, i test monotoniczności na WSZYSTKICH 22 orderach naraz — ten ostatni
bezpośrednio pilnuje właściwości, którą złamała pierwsza, nieprzetestowana wersja fixu,
żeby nikt nie usunął `REWARD_ANCHOR_CAP_OF_FINALE` bez ponownej weryfikacji). **Priorytet
testu na urządzeniu**: średni — user ma świadomie zaobserwować że wczesne MAD bossy dają
teraz WYRAŹNIE mniej niż wcześniej (to zamierzone, nie regresja) i że progresja od order1 do
order22 czuje się płynna, bez dziwnych skoków w żadną stronę.

---

## 140. Audyt logika/optymalizacja, runda 3 — pojazdy/raid/wydajność, 3 znaleziska (2026-09-20)

User: "dawaj dalej". Trzecia runda audytu w tej sesji, świeże obszary: raid tygodniowy,
wydarzenia sezonowe/Nemesis, ekonomia sklepu/gearu, pojazdy, liczniki. Agent-audyt (bez
edycji kodu) znalazł 3 potwierdzone znaleziska, wszystkie zweryfikowane osobiście (repro w
Node dla obu buga z datami) przed fixem.

**1. `vehicleMatch.ts`'s `maintenanceDueMonths` — TA SAMA klasa buga co §138, przeoczona przy
tamtej rundzie w nowym pliku.** Gołe `setMonth` bez przycięcia — serwis z datą 31. dnia
miesiąca + interwał 6 mies. liczył termin jako 3 dni PO końcu docelowego miesiąca (31.08+6mies.
→ 3.03 zamiast 28.02), więc przypomnienie (`app/vehicles.tsx`) pojawiało się PÓŹNIEJ niż
powinno. Fix: `date-fns`'s `addMonths` (ten sam wzorzec z §138). Test z `jest.useFakeTimers()`
na granicy przyciętej vs. przewiniętej daty (ten sam wzorzec co w `recurringBills.test.ts`).

**2. Raid tygodniowy — desync paska HP/% przy level-upie W TRAKCIE tygodnia (kosmetyczny, nie
blokuje ukończenia).** `raidMaxHp` (mianownik paska w `bosses.tsx`/`boss-fight.tsx`) liczył
się NA ŻYWO z aktualnego poziomu (`raidHpFor(level, weekKey)`) przy KAŻDYM renderze, podczas
gdy `raidHp` (licznik, realny postęp) bankuje się RAZ na tydzień (`raidEnsure`, no-op jeśli
`raidWeek===weekKey`). Level-up w środku tygodnia podbijał mianownik bez podbicia licznika —
pasek/% "cofał się" mimo że nic realnie się nie zmieniło (warunek zwycięstwa liczy się od
`raidHp===0`, niezależny od tego pola — czysto wizualny bug). Zweryfikowane w Node: gracz na
Lv5 zadający 50% obrażeń realnej puli → po levelupie do Lv10 (bez żadnej nowej walki) pasek
pokazuje 33.3%.

Fix: nowe pole `raidMaxHp` w `petStore.ts`, bankowane RAZEM z `raidHp` w `raidEnsure`
(`raidWeek !== weekKey`), migracja `onRehydrateStorage` dla starego stanu (trwający tydzień
raidu dostaje jednorazowo wartość policzoną z aktualnego poziomu w chwili migracji — zachowuje
ciągłość, dalsze level-upy tego tygodnia już nie dryfują). `bosses.tsx`/`boss-fight.tsx`
czytają teraz zbankowane pole do WYŚWIETLANIA (`raidWeek===weekKey ? raidMaxHpBanked : ...`),
z fallbackiem na żywe liczenie tylko zanim tydzień w ogóle się zbankował — `boss-fight.tsx`
osobno trzyma `liveRaidMaxHp` do zasiania `raidEnsure` (musi być aktualne przy PIERWSZYM
zbankowaniu tygodnia). Nowy `__tests__/raidEnsure.test.ts` (wzorzec z `grantGear.test.ts` —
bezpośrednie wywołania akcji store'a) pilnuje że drugie wywołanie `raidEnsure` w TYM SAMYM
tygodniu jest no-opem dla `raidMaxHp`, nawet z inną "żywą" wartością.

**3. Wydajność — `app/bosses.tsx` wołało `usePetStore()` CAŁKOWICIE bez selektora (nie tylko
bez pól — bez `useShallow` w ogóle).** Re-renderowało ekran Bossy na każdą zmianę w petStore
(~50+ pól: potki, dayClaims, customizacja kotka z innych ekranów...), nie tylko 20 pól
faktycznie użytych. Ten sam anty-wzorzec już naprawiony w `pet.tsx`/`boss-fight.tsx`/
`pet-shop.tsx`/`usePetQuests.ts` — `bosses.tsx` (siostrzany ekran do `boss-fight.tsx`) został
przeoczony przy tamtych rundach. Fix: `useShallow` z 20 nazwanymi polami (ten sam wzorzec).
Przy okazji naprawione: `app/counters.tsx`/`app/counters/[id].tsx` miały gołe
`useExpensesStore()` mimo używania TYLKO pola `expenses` — selektor pojedynczego pola.

**Sprawdzone przez agenta — czyste, bez zmian**: wydarzenia sezonowe/Nemesis (okna dat nie
nakładają się, brak `setMonth`-overflow — tylko `setDate`/`setHours`), ekonomia gear/sklepu
(ceny kupna/sprzedaży konsekwentne wszędzie, przebalansowane wcześniej), liczniki (logika
streaków/resetów konsystentna na granicach dni), reszta raidu (`weekKeyOf`/`raidAttack`/
`raidClaim` bez błędów).

`tsc`/`jest` czyste (1030 testów, +4 nowe: 1 w `vehicleMatch.test.ts`, 3 w nowym
`raidEnsure.test.ts`). **Priorytet testu na urządzeniu**: niski-średni — (1) serwis pojazdu z
datą 29-31 dnia miesiąca, sprawdź termin po interwale; (2) rozegraj kawałek raidu, zdobądź
kilka poziomów, sprawdź że pasek/% raidu nie "cofa się"; (3) regresja wydajności
niemożliwa do zaobserwowania wprost na ekranie Bossy/Licznikach.

---

## 141. Konsolidacja duplikatów `setMonth`-overflow + dokończenie sweepu selektorów (2026-09-20)

User: "ogarnij wszystko te techniczne bugi" — nawiązanie do własnej propozycji (§1 "wspólny
`addMonthsClamped`, ten sam bug wyszedł 3 razy" i §2 "sweep selektorów store'ów"). Zamiast
pisać nową funkcję "addMonthsClamped" (niepotrzebne — `date-fns`'s `addMonths`/`addQuarters`/
`addYears` już to robi poprawnie, używane od §138), zrobiony REPO-WIDE grep za wzorcem
`setMonth(...getMonth() + ...)` — wynik: bug był zduplikowany w **3 KOLEJNYCH** plikach,
których żadna z poprzednich 3 rund (§138/§140) nie dotknęła:

**1. `src/utils/dashboard/subs.ts`** — LITERALNA kopia `advanceNextBillingDate`/
`isDurationExpired` (te same nazwy funkcji!) z tego co już naprawiono w `recurringBills.ts`,
używana przez dashboard (`app/(tabs)/index.tsx`) do liczenia zaległych/wygasłych subskrypcji.
Miał nawet WŁASNY test (`dashboardSubs.test.ts`) który PINOWAŁ buggy zachowanie jako
"zachowanie JS Date" wprost w komentarzu — dokładnie ten wzorzec z tej sesji, gdzie stary test
zamraża zły wynik jako "prawidłowy".

**2. `src/utils/subscriptionAuto.ts`'s `advanceBillingDate`** — TRZECI niezależny wariant tej
samej funkcji, używany w `src/services/bankCommit.ts` do AUTOMATYCZNEGO (bez interakcji usera)
dopasowywania płatności bankowych do subskrypcji i cichego przesuwania `nextBillingDate` —
najpoważniejszy z trzech, bo drift byłby całkowicie niewidoczny (żadnego ekranu, żadnego
kliknięcia, po prostu cichy błąd w tle przy każdej synchronizacji banku).

**3. `src/utils/maintenanceCalendar.ts`** — WŁASNA, ręczna kopia "dodaj miesiące" (nie
duplikat nazwy funkcji, ale duplikat BUGA) do generowania wydarzeń kalendarza "wymiana oleju"/
"serwis pojazdu" — osobny kod-path od `vehicleMatch.ts` (ten dawał chip "za ~X mies." na
ekranie Pojazdów, ten tu generuje właściwe wydarzenie w Kalendarzu), więc §140 go nie objęło.

**Fix**: `dashboard/subs.ts` i jego test USUNIĘTE CAŁKOWICIE (dashboard woła teraz wprost
`advanceNextBillingDate`/`isDurationExpired` z `recurringBills.ts` — JEDNO źródło prawdy
zamiast trzech). `subscriptionAuto.ts`'s `advanceBillingDate` USUNIĘTA (wołający kod,
`bankCommit.ts`/`index.tsx`, woła teraz też wprost `recurringBills.ts`). `maintenanceCalendar.ts`
przepisany na `date-fns`'s `addMonths` (lokalna nazwa `addMonthsIso` żeby nie kolidować z
importem). Nowe testy: `maintenanceCalendar.test.ts` (4 testy, w tym wymiana oleju 31.08+6mies.
→ 28.02 nie 3.03).

**Dokończony sweep selektorów store'ów** (§140 "runda 3" zaczęła, to ją kończy dla
uzasadnionych przypadków): `PetCustomizeModal.tsx` (ZAWSZE zamontowany na `/pet` — Modal's
`visible` chowa go wizualnie, nie odmontowuje — miał CAŁKOWICIE goły `usePetStore()`, teraz
`useShallow`), `bosses.tsx`/`boss-fight.tsx` (resztki gołego `useExpensesStore()`, `boss-
fight.tsx` to ekran walki — hot path). ŚWIADOMIE NIE dotknięte pozostałe 12 miejsc z gołym
`useExpensesStore()` (`vehicles.tsx`, `month-cards.tsx`, `weekly.tsx`, `search.tsx`,
`achievements.tsx`, `settings.tsx`, `expenses/[id].tsx`, `expenses/stats.tsx`,
`expenses/audit.tsx`, `work/history.tsx`, `(tabs)/stats.tsx`, `(tabs)/finances.tsx`) — to albo
ekrany analizy wydatków które i tak potrzebują szerokiego dostępu do `expenses` (selektor by
nic nie dał), albo rzadko odwiedzane ekrany ze stosu nawigacji (nie stale zamontowane, nie hot
path) — fix tam byłby czystym boilerplate'em bez realnej korzyści, dokładnie to czego CLAUDE.md
każe unikać ("nie dodawaj ponad to czego wymaga zadanie").

`tsc`/`jest` czyste (1030 testów — sam count bez zmian netto: -4 z usuniętego
`dashboardSubs.test.ts`, +4 z nowego `maintenanceCalendar.test.ts`). **Priorytet testu na
urządzeniu**: średni — (1) subskrypcja z dniem rozliczenia 29-31, wpłać "płatność bankową" (albo
poczekaj na realną synchronizację) która ją dopasuje, sprawdź że `nextBillingDate` po
automatycznym przesunięciu jest poprawny, nie przewinięty; (2) pojazd z datą oleju 29-31 dnia
miesiąca — sprawdź wydarzenie w Kalendarzu, nie tylko chip na ekranie Pojazdów (już
zweryfikowany w §140).

---

## 142. Pierwszy etap "inteligentnych powiadomień" — przypomnienie o nawykach żywe, fix persystencji godzin (2026-09-20)

User: "zrob inteligentne powiadomienia" (część większego wieloetapowego żądania — bugi
techniczne §141 zrobione jako pierwsze, to drugi etap; trzeci etap, kategoryzacja produktów w
finansach, w toku osobno). Research `notificationsService.ts` (778 linii, ~38 metod)
pokazał, że 3 z 4 typów przypomnień w Ustawieniach (`refreshMoodReminder`/`refreshPetReminder`/
`refreshBossReminder`) już SĄ "inteligentne" — one-off DATE trigger re-armowany na żywym
stanie (zalogowany nastrój / gotowa skrzynka / bijalny boss), a treść i skip-today są
przeliczane na nowo przy każdym otwarciu apki. **Przypomnienie o nawykach było jedynym
wyjątkiem** — ślepy `DAILY` alarm zaplanowany RAZ przy zapisie Ustawień, bez żadnego związku z
realnym stanem: trąbił "Nie odhaczyłeś dziś nawyków" nawet gdy user WŁAŚNIE wszystkie odhaczył
(albo nie ma żadnego nawyku wcale).

**Fix — `scheduleDailyHabitReminder`/nowe `refreshDailyHabitReminder`** (mirror
`refreshMoodReminder`): DAILY → one-off DATE (`nextFireDate(hour, minute, allDoneToday)`),
`allDoneToday` przeskakuje na jutro miast nagabywać dzisiaj, treść dostaje realną liczbę
nieodhaczonych (`remaining`, przez `plPlural`). `refreshDailyHabitReminder` czyta
`notif_habits_hour/min` z AsyncStorage i re-planuje — wołane z nowego `useEffect` w
`useHabits()` na każdą zmianę `habits.length`/`todayDone.length` (ten hook jest zamontowany i
na ekranie Nawyków, i na kafelku dashboardu, więc łapie stan przy każdym otwarciu apki/
odhaczeniu, tak jak `refreshMoodReminder` w `moodStore.ts`).

**Znaleziony przy tym drugi bug (ta sama okazja, ten sam plik ustawień)**: `app/settings.tsx`
ZAPISYWAŁO godziny wszystkich 4 przypomnień (nastrój wieczorny/poranny, lista zadań, nawyki) do
AsyncStorage przy "Zapisz przypomnienia", ale NIGDY nie WCZYTYWAŁO ich z powrotem przy
otwarciu ekranu — pola zawsze wracały do sztywnych domyślnych (20:00/8:00/8:00/21:00), mimo że
powiadomienie realnie leciało o zapisanej wcześniej godzinie (rozjazd UI ↔ realny stan, user
widziałby "8:00" a przypomnienie i tak przyjdzie o godzinie ustawionej wcześniej). Przy tym też
`scheduleMorningMoodReminder` nigdy nie zapisywało swojej godziny WCALE (żadne miejsce w ogóle
tego nie robiło) — dodane `notif_morning_hour`/`notif_morning_min` w `settings.tsx` obok
`notif_morning_enabled`. Habit reminder teraz samo-persystuje `notif_habits_hour/min`
(multiSet w `scheduleDailyHabitReminder`, jak mood). Wszystkie 4 godziny wczytywane na mount
Ustawień jednym `multiGet`.

`tsc`/`jest` czyste (1030 testów, bez zmiany — logika `notificationsService.ts` importuje
`expo-notifications`, więc nie da się jej testować bez wydzielenia do osobnego pliku jak
`googleCalendarMap.ts` w §138; ten plik nigdy nie miał testów, więc nie jest to regresja, ale
kandydat na przyszłe wydzielenie `nextFireDate`/treści do testowalnego modułu).

**Priorytet testu na urządzeniu — wysoki** (nowe zachowanie, nie tylko fix persystencji):
(1) włącz przypomnienie o nawykach w Ustawieniach, ustaw bliską godzinę, poczekaj — powinno
przyjść z treścią "Zostało Ci N nawyków..."; (2) odhacz WSZYSTKIE nawyki na dziś PRZED tą
godziną — przypomnienie nie powinno przyjść dzisiaj; (3) zamknij i otwórz Ustawienia — godziny
wszystkich 4 przypomnień powinny pokazywać wcześniej zapisane wartości, nie domyślne.

**Kolejny etap**: kategoryzacja produktów w Finanse/Produkty. Research `app/products.tsx` +
`productMemory.ts` (poniżej, §143) pokazał, że większość tego co user opisał JUŻ istnieje
(historia zakupów z linkiem do paragonu, tagi, scalanie duplikatów) — brakuje głównie
hierarchii tag→podtag i widoku grupowanego. Konkretna propozycja w §143.

---

## 143. Audyt reszty powiadomień + research kategoryzacji produktów (2026-09-20)

User: "Ogólnie wszystkie powiadomienia możesz poulepszać bo teraz trochę lipią" — zielone
światło na kontynuację §142 dla RESZTY typów powiadomień, nie tylko zbiorczego przypomnienia o
nawykach.

**Przegląd całego `notificationsService.ts` (~38 metod)**: `refreshMaintenanceReminder`/
`refreshPaydayReminder`/`refreshBudgetReminder`/`refreshWeeklySummary`/`refreshMonthCardReminder`
już SĄ stanowe (one-off DATE, re-armowane na żywym stanie, cancel gdy nic nie wymaga uwagi) —
nic do zrobienia. `scheduleSubscriptionReminder`/`scheduleRenewalHeadsUp`/`scheduleEventReminder`/
`scheduleWorkShiftNotifications`/`scheduleSnoozeReminder`/`scheduleMissionReady` są z natury
jednorazowe, powiązane z konkretnym zdarzeniem (data płatności/wydarzenia/koniec zmiany) —
też nic do poprawy, "dumbness" nie miało tu gdzie się ukryć.

**Znaleziska, które NAPRAWIONO**:
1. **`scheduleHabitReminder`/`cancelHabitReminder`** (przypomnienie PER-NAWYK, `Habit.
   reminderTime` — osobne od zbiorczego z §142) — TA SAMA dziura co zbiorcze przed §142: ślepy
   `DAILY`, trąbił o konkretnym nawyku nawet po jego zaznaczeniu. Przerobiony identycznie
   (DATE + `nextFireDate(hour, minute, doneToday)`). Nowy `useEffect` w `useHabits()` re-armuje
   PER NAWYK z ustawioną godziną na każdą zmianę `habits`/`todayDone`.
2. **`scheduleDailyTaskBriefing`/`cancelDailyTaskBriefing` — MARTWY KOD, usunięty całkowicie.**
   Zero wywołań w całym repo (sprawdzone grepem) — zastąpiony dawno przez `scheduleDailyTodoList`
   (grupowanie dziś/jutro/bezterminowe), ale stara wersja nigdy nie została odpięta.

**Research kategoryzacji produktów (Finanse/Produkty, kolejny etap żądania usera)** —
`app/products.tsx` (484 linii) + `src/utils/productMemory.ts` (630 linii) okazały się dużo
bogatsze niż user zakładał pisząc "sosy>ketchupy>(Pudliszki 250g, Kotlin 980g, Heinz 500g)":

- **"Po kliknięciu pokazywalo jaki paragon" — JUŻ ISTNIEJE.** `purchaseHistory` w
  `products.tsx` (linia ~186) pod edycją produktu: lista dat/cen/sklepów, tap → prosto do
  `/expenses/[id]` (dodane 2026-09-17, user: "muszę mieć tam odnośnik gdzie w finansach jest
  ten produkt i kiedy do paragonu").
- **"Gdzie na paragonie" (pozycja/miejsce w tekście)** — NIE istnieje i nie jest łatwe do
  dodania: scanner (`expenses/scan.tsx`) parsuje TEKST paragonu, nie zapisuje współrzędnych/
  pozycji OCR (bounding box) — wymagałoby przebudowy pipeline'u skanowania, żeby zapisywać
  POZYCJĘ każdej pozycji, nie tylko jej treść. Poza zasięgiem tego etapu.
- **Warianty rozmiaru osobno ("Pudliszki 250g" ≠ "Heinz 500g")** — JUŻ DZIAŁA:
  `normalizeProductName`/`canonicalProductName` świadomie ZACHOWUJĄ rozmiar w nazwie (komentarz
  w kodzie: "Sizes are KEPT — user wants different sizes counted separately in top-stats"),
  więc każdy wariant to już osobny wpis w `products` z własną historią/tagami/wagą.
- **Realnie BRAKUJE**: (1) hierarchii tag→podtag — tagi w `productMemory.ts`/`products.tsx` są
  PŁASKIE (`ITEM_TAGS`, jedna lista, wielokrotny wybór, bez rodzic/dziecko); (2) grupowania W
  UI — lista w `products.tsx` jest jedną płaską listą sortowaną po liczbie zakupów + filtr
  tekstowy, bez sekcji/nagłówków per kategoria — nie da się "wejść w sosy" i zobaczyć tylko
  ketchupy.

**Propozycja (do potwierdzenia z userem przed implementacją — zmiana modelu danych + UI,
nie mechaniczny fix)**: dwupoziomowy tag — top-level ("sosy") + subtag ("ketchupy"), zapisywany
w `tagMemory`/`ReceiptItem.tags` jako dodatkowy, osobny poziom (nie zamiast płaskich tagów —
obok), plus widok `products.tsx` grupowany po top-level tagu (zwijane sekcje) gdy user nie
szuka tekstem. Nie zaczęte — czeka na potwierdzenie kierunku.

`tsc`/`jest` czyste (1030 testów, bez zmiany netto — usunięty martwy kod nie miał testów, nowa
logika w `notificationsService.ts` jak zawsze nietestowalna bez wydzielenia).

---

## 144. TopPill — rotacja przez WSZYSTKIE zaległe/dzisiejsze zadania, nie tylko jedno (2026-09-20)

User: "co z pillem? Animacja przejściami lepszymi odmianami zadań itp?" — po §91 (fix
"bouncy ball" animacji przejścia) i luźnej puli z rotacją (2026-08-23, komentarz przy
`calmTick` w `TopPill.tsx`), sam mechanizm PRZEJŚCIA (`Animated.timing`, płynne bez odbicia)
był już dobry — problem był gdzie indziej: **4 z 7 "pilnych" stanów (1-7) NIGDY go nie
używały**, bo zawsze wybierały TEN SAM element z listy kandydatów niezależnie od `calmTick`:

- **Zaległe zadania** (tier 4) — zawsze `overdue.sort(...)[0]` (najstarsze), `key` liczony z
  `overdue.length`, nie z id zadania. User z 3 zaległymi widział WIECZNIE jedno, resztę tylko
  po wejściu w Zadania — i nawet ta jedna pozycja nigdy się nie animowała (key nie zmieniał się
  między tickami mimo że `calmTick` tykał).
- **Zadania na dziś** (tier 4b) — analogicznie, zawsze `todayTasks[0]`.
- **Alerty budżetowe** (tier 5) — zawsze najgorsza kategoria, reszta bliskich limitu niewidoczna.
- **Wydarzenia z Kalendarza Google na dziś** (tier 6) — zawsze najbliższe wydarzenie.

Fix: wszystkie cztery teraz wybierają `arr[calmTick % arr.length]` (ten sam `calmTick` co pula
luźna niżej, więc jeden, spójny rytm rotacji ~8s w całym pillu) — sortowanie/priorytet
zostaje (najpilniejsze wciąż pierwsze w kolejności rotacji), ale gdy jest więcej niż jeden
kandydat, user zobaczy WSZYSTKIE po kolei, nie jeden zamrożony. `key` dla zaległych/dzisiejszych
zadań przepisany z `${arr.length}` na `${item.id}`, żeby zmiana w puli faktycznie odpalała
animację przejścia (przy stałym key pill nigdy się nie animował, mimo że treść pod spodem się
zmieniała między renderami) — to naprawia też "animacja" część zgłoszenia: dotąd przejście było
widoczne głównie w luźnej puli (mission/boss/mood/all-clear), teraz też w pilnych stanach.

`tsc`/`jest` czyste (1030 testów, bez zmiany — `TopPill.tsx` nigdy nie miało testów, logika
mocno wpleciona w komponent/animacje).

**Priorytet testu na urządzeniu — średni**: dodaj 2-3 zaległe zadania (deadline w przeszłości),
sprawdź że pill pokazuje je PO KOLEI co ~8s (nie zawsze to samo), z płynnym przejściem między
każdym. To samo dla 2+ zadań na dziś i 2+ kategorii blisko limitu budżetu (jeśli łatwo
odtworzyć).

**Osobno w toku**: przegląd scen walki pupila (`boss-fight.tsx`) — user zgłosił, że cienie nie
pasują do skali sprite'ów; ma to być dopracowane tak, żeby dało się łatwiej dostosować pozycje
i skalę. Kontynuacja w §145.

---

## 145. Edytor układu walki — niezależna skala/pozycja cienia + naprawa STARYCH domyślnych (2026-09-20)

User: "co z pupilem/pillem [chodziło o walkę]... żebym mógł dostosować lepiej te pozycje w
końcu i skale (teraz nadal Cienie nie pasują skale itp)".

**Przyczyna "cienie nie pasują skali"**: `GroundShadow` w realnej walce (`boss-fight.tsx`)
liczy swój `width`/`height` jako JEDEN, wspólny, STAŁY ułamek rozmiaru portretu (0.62/0.18),
identyczny dla kotka i bossa. Działa dobrze dla bossa — `BossArt` to PNG przycięte ciasno do
sylwetki, ułamek pudełka ≈ ułamek faktycznej sylwetki. Kotek (`CatArt`) to SVG z viewBox
2000×2000 z DUŻYM pustym marginesem wokół (stąd `CAT_PORTRAIT_SIZE` jest ~35% większe niż
`PORTRAIT_SIZE` bossa, żeby oba portrety wizualnie wyszły podobnej wielkości — patrz komentarz
w `boss-fight.tsx`) — więc ten sam ułamek 0.62 liczony od SZTUCZNIE powiększonego pudełka daje
cień SZERSZY niż realna sylwetka kotka. Jeden wspólny ułamek nie mógł tego pogodzić.

**Fix — Edytor układu walki (`battle-layout-lab.tsx`/`battleLayoutDraftStore.ts`) dostał
niezależną skalę cienia PER SPRITE**: `catShadowScaleX/Y`, `bossShadowScaleX/Y` (zamiast
sztywnego `* 0.62`/`* 0.18` w JSX) + `catShadowOffsetY`/`bossShadowOffsetY` (cień może się
przesunąć niezależnie od sprite'a — np. gdy "łapki" na sylwetce nie są dokładnie na dole
pudełka). Domyślne wartości = dzisiejszy ułamek (0.62/0.18/0) dla OBU, więc otwarcie Edytora
na starcie renderuje się identycznie jak dziś — user dostroi kotka osobno wizualnie (dotyk +
Steppery z krokiem 0.02), wyeksportuje, wklei mi w rozmowie, ja podepnę nowe stałe do
`boss-fight.tsx` (`GroundShadow` tam nadal ma STAŁE liczby, jak `PORTRAIT_SIZE`/offsety —
Edytor świadomie NIE czyta się live z ekranu walki, to tylko poligon, patrz komentarz w
`battle-layout-lab.tsx`).

**Przy tym naprawiony bug w samym Edytorze**: `BATTLE_LAYOUT_DEFAULT` w
`battleLayoutDraftStore.ts` (katSize=175/bossSize=130, offsety=0) NIE zostało zaktualizowane
po poprzednim eksporcie z 2026-09-18 (który podbił realne stałe w `boss-fight.tsx` do
205/150 + offsetY 45/45/10/10) — plik miał wprost w komentarzu "musi zgadzać się 1:1 z
realnymi stałymi", ale się nie zgadzał. Efekt: otwarcie Edytora pokazywało INNY layout niż
realna walka — najpierw trzeba by zgadnąć, że to nie jest "1:1 podgląd" jak obiecuje własny
komentarz w kodzie. Domyślne wartości przywrócone do zgodności z `boss-fight.tsx`.

**Migracja starego zapisu**: dodane pola cienia wymagały niestandardowego `merge` w
`persist()` — domyślny (shallow) merge zostawiałby zagnieżdżone `draft` bez nowych pól jako
`undefined` u kogoś z już zapisanym draftem (NaN w SVG). `merge` teraz dogrywa
`BATTLE_LAYOUT_DEFAULT` do zagnieżdżonego `draft`, nie tylko do stanu top-level.

`tsc`/`jest` czyste (1030 testów — bez zmiany, `battle-layout-lab.tsx`/`battleLayoutDraftStore.ts`
to dev-tylko poligon bez testów, jak dotąd).

**Priorytet testu na urządzeniu — wysoki (nowa funkcja + fix defaultów)**: (1) otwórz Edytor —
layout powinien wyglądać IDENTYCZNIE jak w realnej walce (rozmiar/pozycja portretów), nie jak
przed fixem; (2) w nowej sekcji "Cień" dostosuj szerokość/wysokość/pozycję Y cienia kotka
osobno od bossa, sprawdź że sylwetka+cień zaczynają wizualnie się zgadzać; (3) eksport JSON
zawiera nowe pola `catShadowScaleX/Y`, `bossShadowScaleX/Y`, `*ShadowOffsetY`.

---

## 146. Rejestr lagu wątku JS na starcie + mapa efektów `_layout.tsx` (2026-09-20)

User: "zawsze te startupy animacje lagują bardzo, nigdy nie widziałem płynnej animacji... jak
wchodzę do apki i próbuję kliknąć to jest impossible bo jest lag. Jak chcesz zrób rejestr
żebyś miał realne dane. Potem optymalizacja i logika lub mapa tego co mamy żebyś lepiej
rozumiał." — trzy rzeczy: (1) instrumentacja PRZED optymalizacją (ta sama dyscyplina co
`perfLog.ts` z 2026-08-25), (2) sama optymalizacja później, na podstawie realnych danych, (3)
mapa tego repo dla mnie. Ten wpis robi (1) i (3); (2) czeka na dane z realnego urządzenia.

**Diagnoza na czytaniu kodu (przed danymi)**: `AnimatedSplash.tsx` (sam ekran startowy) jest
już "lag-proof by design" — WSZYSTKIE jego animacje idą przez `useNativeDriver: true`
(transformy/opacity), nigdy nie dotykają wątku JS. Ale user nie skarży się na TĘ animację
samą w sobie, tylko na wrażenie ogólnego zawieszenia + niedziałające dotyki od razu po
wejściu — a to wskazuje na `app/_layout.tsx`, gdzie `RootLayout` montuje **kilkanaście
równoległych `useEffect`ów** naraz, część od razu, część przez `setTimeout` (rozłożone w
czasie, ale i tak wszystkie na tym samym wątku JS co obsługa dotyku w RN):

| Efekt | Kiedy | Co robi |
|---|---|---|
| `startColdStartLagSampling()` | natychmiast | NOWY — próbkowanie lagu, patrz niżej |
| crash-check (native+JS) | natychmiast (async IIFE) | `FileSystem.getInfoAsync`/AsyncStorage read + ew. `Alert` z 1400ms delay |
| dangling-scan-check | natychmiast (async IIFE) | AsyncStorage read + ew. `Alert` z 1800ms delay |
| `ensureAndroidChannel()` | natychmiast | natywne API powiadomień |
| `whenAuthReady()` | natychmiast | AsyncStorage read (persisted sesja) + ew. sieć (anon sign-in) |
| notification response listener + `getLastNotificationResponseAsync()` | natychmiast | rejestracja listenera + async read |
| `appSettings.loadAll()` / `migrateBalanceModel()` / `migratePaydayDefaultOff()` / `loadNonFood()` / `loadOwnName()` | natychmiast (5 osobnych efektów) | po AsyncStorage read każdy |
| autobackup | +8000ms (po `authReady`) | throttlowany, nie powinien kolidować |
| health autosync | +2000ms | Health Connect read (może być kosztowne) |
| bank notification drain + auto-commit | +1500ms | AsyncStorage + ew. Firestore |
| flush pending expense writes | +2500ms | ew. Firestore |
| level-up detect, usage-stats record | natychmiast | proste, tanie |

Efekty z `setTimeout` (1500-8000ms) są rozłożone w czasie ŚWIADOMIE, ale **wszystkie
natychmiastowe efekty (crash-check, dangling-scan, auth, 5× migracja/loader, notification
listener) odpalają się w jednym burście przy pierwszym render-cycle** — każdy to co najmniej
jedno round-tripowe wywołanie AsyncStorage (bridge call), a kilkanaście naraz to realny
kandydat na "wątek JS zajęty tuż po starcie", czyli okno w którym dotyk może się nie
zarejestrować. Nie naprawiane w tym PR — to hipoteza do zweryfikowania danymi, nie fix.

**Fix — nowy rejestr w `perfLog.ts`**: `startColdStartLagSampling()` (wołane raz z pierwszego
`useEffect` w `RootLayout`, NIE na poziomie modułu — to zapętliłoby prawdziwe `setTimeout`y w
Jest, patrz komentarz w kodzie) próbkuje wątek JS co 50ms przez 8s od `JS_START`: `setTimeout`
zaplanowany na 50ms, który faktycznie odpala się później, mówi o ile wątek JS był zajęty czymś
innym w tym czasie — to ten sam wątek, który obsługuje dotyk w RN, więc lag tutaj = "nie mogę
kliknąć". `PerfEntry` dostał `maxLagMs`/`totalLagMs`/`lagSamples`, zapisywane przy
`recordDashboardReady()` jak dotychczasowe `msToFirstFrame`/`msToReady`. Ustawienia →
Diagnostyka → "Wydajność startu apki" pokazuje teraz też te liczby + nowy przycisk
"Udostępnij" (dotąd tylko `Alert`, nieczytelny do skopiowania) — user używa apki normalnie
kilka dni, potem eksportuje i wkleja mi w rozmowie, TA SAMA metoda co eksport postępu pupila/
pamięci cen.

`tsc`/`jest` czyste (1031 testów, +1 nowy — pola lagu domyślnie zerowe gdy sampler nigdy nie
odpalony, sampler sam NIE jest testowany bezpośrednio z opisanego wyżej powodu).

**Priorytet testu na urządzeniu — wysoki, ale to zbieranie danych, nie fix**: użyj apki
normalnie kilka dni (kilka cold startów), potem Ustawienia → Diagnostyka → Wydajność startu
apki → Udostępnij, wyślij mi wynik. `maxLagMs`/`totalLagMs` wysokie = potwierdzona hipoteza
wyżej (burst efektów na starcie) → następny krok to faktyczna optymalizacja (rozłożenie w
czasie/`InteractionManager`/przeniesienie części do `requestIdleCallback`-podobnego wzorca).

---

## 147. Cień kotka w walce — wyliczony (nie zmierzony) szacunek zamiast wspólnego ułamka bossa (2026-09-21)

User: "dawaj 1 i 2" (kontynuacja §143/§145 — kategoryzacja produktów i dostrojenie cieni).
Zamiast czekać na wizualne dostrojenie w Edytorze (`battle-layout-lab.tsx`, wymaga urządzenia),
policzony szacunek z tego co JUŻ wiadomo o geometrii sprite'ów: `CAT_PORTRAIT_SIZE` (205) jest
celowo ~35% większe od `PORTRAIT_SIZE` bossa (150) TYLKO po to, żeby skompensować pusty
margines SVG kotka i wyjść na TĘ SAMĄ apparentną wielkość (patrz komentarz przy
`CAT_PORTRAIT_SIZE` w `boss-fight.tsx`, §145). Skoro oba portrety mają wyglądać tak samo duże,
realna sylwetka kotka w jego (większym) pudełku zajmuje z grubsza ten sam ułamek co boss w
SWOIM (mniejszym, ciasno przyciętym) pudełku, przeskalowany o odwrotność tego samego
współczynnika: `0.62 × (150/205) ≈ 0.45`, `0.18 × (150/205) ≈ 0.13`.

Nowe stałe `CAT_SHADOW_SCALE_X/Y` (0.45/0.13, boss zostaje przy 0.62/0.18) w `boss-fight.tsx`
+ zaktualizowany `BATTLE_LAYOUT_DEFAULT` w `battleLayoutDraftStore.ts` (utrzymuje "podgląd 1:1"
z §145 — jeśli masz już otwarty Edytor z wcześniejszym stanem, wciśnij Reset, bo persisted
draft nie nadpisuje się sam nowym defaultem). **To szacunek, NIE pomiar** — Edytor wciąż jest
źródłem prawdy do wizualnego dostrojenia, gdyby to nie pasowało na oko.

`tsc`/`jest` czyste (1033 testy). **Priorytet testu na urządzeniu — wysoki**: otwórz walkę,
sprawdź czy cień kotka teraz wygląda proporcjonalnie do jego sylwetki (węższy/płytszy niż
wcześniej); jeśli nadal nie pasuje, popraw w Edytorze i wyślij eksport.

---

## 148. Kategoryzacja produktów — dwupoziomowy tag + grupowany widok + sortowanie po dacie (2026-09-21)

Pełny opis propozycji w §143. User: "dawaj 1" — implementacja bez dalszego potwierdzania
szczegółów (kierunek już zaakceptowany).

**Model danych**: `ReceiptItem` dostał `subTag?: string` — JEDNA podkategoria (nie lista jak
`tags`), zawsze rozumiana jako WEWNĄTRZ pierwszego z `tags` (np. `tags:['sosy']`,
`subTag:'ketchupy'`). Osobne pole, nie kolejny wpis w `tags` — żeby nie mylić z resztą
maszynerii opartej na płaskich tagach (avoid-tracking nawyków w `habits.ts`, dopasowanie
kategorii jedzenia w `calories.ts`/`food.ts`), które nigdy nie widzą `subTag` i działają
dokładnie jak wcześniej. Warianty rozmiaru (Pudliszki 250g / Heinz 500g) NIE wymagały żadnej
zmiany — `canonicalProductName`/`normalizeProductName` już od dawna trzymają je jako osobne
wpisy (§143), więc trzeci poziom hierarchii usera już istniał.

**Pamięć podkategorii** (`productMemory.ts`): `loadSubTagMemory`/`saveSubTagToMemory`/
`allKnownSubTags` — TEN SAM wzorzec co `loadTagMemory`/`saveCustomTagsToMemory`/`allKnownTags`
dla zwykłych tagów, osobny klucz AsyncStorage (`product_subtag_memory`), osobna, prostsza
pamięć (jeden string, nie tablica).

**`app/products.tsx`**:
- `Product` dostał `subTag`/`lastPurchasedAt` (max data zakupu wśród pasujących pozycji
  paragonów, liczona w tej samej pętli co `count`).
- **Sortowanie** (user: "zeby sortowanie można bylo lepiej edytowac kiedy zalupiono") — dwa
  chipsy nad listą: "Najczęściej kupowane" (dotychczasowe, po `count`) / "Ostatnio kupione"
  (po `lastPurchasedAt`). W trybie "Ostatnio" wiersz produktu pokazuje też datę.
- **Widok grupowany** (TYLKO gdy nie szukamy — szukanie zostaje płaską, szybką listą jak
  dotąd): sekcje top-level tag (`tags[0]`, "Bez kategorii" gdy brak) → zwijane, wewnątrz
  opcjonalne podsekcje po `subTag` ("Inne" gdy brak) — POMIJANE gdy kategoria NIGDY nie
  używała podtagów (unika fałszywego "Inne" wszędzie). Sortowanie sekcji: top-level po sumie
  `count` w grupie malejąco, "Bez kategorii" zawsze na końcu; to samo wewnątrz sekcji dla
  podtagów.
- Edytor produktu dostał pole "Podkategoria" (wolny tekst + chipsy podpowiedzi z historii,
  jak istniejący "własny tag") — zapis retroaktywnie nadpisuje `subTag` na KAŻDEJ pasującej
  pozycji paragonu, ten sam mechanizm co tagi/kategoria (§143, fix "wroclo mi do produkty ale
  nie zapisalo").

**Świadomie NIE zrobione (poza zasięgiem, jak ustalono w §143)**: "gdzie na paragonie"
(pozycja OCR) — scanner nie zapisuje współrzędnych, wymagałoby przebudowy pipeline'u
skanowania.

`tsc`/`jest` czyste (1033 testy, +2 nowe dla `allKnownSubTags`). **Priorytet testu na
urządzeniu — wysoki (nowa funkcja)**: (1) otwórz Produkty bez wyszukiwania — lista powinna być
teraz grupowana sekcjami zamiast płaska; (2) wejdź w produkt, ustaw podkategorię, zapisz,
sprawdź że trafił do właściwej podsekcji; (3) przełącz sortowanie na "Ostatnio kupione",
sprawdź kolejność i widoczną datę.

---

## 149. Zapis humoru wisiał wiecznie na "Zapisuję..." — brak timeoutu na zapis Firestore (2026-09-21)

User przysłał screenshot: przycisk zapisu check-inu humoru zamrożony na "Zapisuję..."
(disabled), nic się nie dzieje. Przyczyna: `initializeFirestore` w `firebase.ts` NIE włącza
offline persistence/`localCache` (tylko `ignoreUndefinedProperties`) — bez tego `addDoc`/
`updateDoc`/`deleteDoc` na słabym/zerwanym połączeniu NIE rzucają błędu i NIE hangują z
timeoutem, tylko cicho czekają w nieskończoność na faktyczny round-trip do serwera. `handleSave`
w `MoodCheckInModal.tsx` ma poprawny try/catch/finally (`setSaving(false)` w finally, Alert w
catch) — ale skoro Promise z `addDoc()` sam nigdy się nie rozstrzyga, żadna z tych gałęzi nigdy
nie odpala. `whenAuthReady()` (§ z 2026-09-15) ma WŁASNY 4s ceiling, ale to pokrywa tylko fazę
autoryzacji, nie sam zapis sieciowy.

**Fix**: nowy `withTimeout()` w `firebase.ts` — `Promise.race` przeciw `setTimeout` (10s
domyślnie), rzuca czytelny błąd ("Zapis trwa zbyt długo — sprawdź połączenie...") zamiast
wiecznie wisieć. Zastosowany w `moodService.ts` (`add`/`update`/`remove`) — reszta kodu
(`handleSave` w modalu) działa bez zmian, bo teraz Promise faktycznie się rozstrzyga (reject),
więc catch/finally wreszcie się odpalają. Notatka/tagi/mood NIE giną przy błędzie — modal
zamyka się TYLKO przy sukcesie (`onClose()` po `await`), więc user po prostu klika Zapisz
jeszcze raz.

**Świadomie NIE zrobione teraz — systemowy zakres, nie tylko mood**: TEN SAM brak timeoutu
istnieje we WSZYSTKICH serwisach piszących bezpośrednio do Firestore: `expensesService.ts`
(najważniejszy — wydatki/paragony), `calendarService.ts`, `debtsService.ts`,
`maintenanceService.ts`, `subscriptionsService.ts`, `templatesService.ts`,
`vehiclesService.ts`, `workService.ts`, `backupService.ts`. `withTimeout()` jest już
wyeksportowany z `firebase.ts` gotowy do ponownego użycia — kandydat na osobny, dedykowany PR
(sweep przez wszystkie serwisy), jeśli user zgłosi to samo zawieszenie gdzie indziej albo
zdecyduje się prewencyjnie ochronić resztę zapisów. Patrz NEXT_STEPS.md.

`tsc`/`jest` czyste (1033 testy, bez zmiany — `firebase.ts`/`moodService.ts` nigdy nie miały
testów, żaden test nie importuje modułu firebase, `withTimeout` sam jest zbyt trywialny/
generyczny żeby uzasadniać osobny test bez realnego Firestore).

**Priorytet testu na urządzeniu — wysoki**: zapisz check-in humoru przy dobrym połączeniu
(powinno zadziałać normalnie), potem spróbuj przy wyłączonym internecie — po ~10s powinien
pokazać się Alert z błędem zamiast wiecznego "Zapisuję...", a notatka/wybory zostają w modalu
do ponownej próby.

---

## 150. Humor local-first — zapis offline + auto-sync po powrocie sieci (2026-09-21)

User, po §149 (timeout zamiast wiecznego zawieszenia): "może zapisywać offline i wysłać jak
będzie wifi" — timeout to bezpiecznik, nie to o co naprawdę chodziło. Okazało się, że apka JUŻ
MA dokładnie ten wzorzec, tylko dla wydatków/paragonów, nie dla humoru: `expensesStore.ts`'s
`pendingSync`/`addPending`/`confirmSync` + `expenseSync.ts`'s `flushPendingExpenseWrites()` +
`expensesService.newId()`/`addWithId()` — `expenses/manual.tsx` zapisuje NATYCHMIAST lokalnie
(`addPending`, synchroniczne, przetrwa restart), nawiguje dalej OD RAZU, a Firestore leci w
tle fire-and-forget (`.then(confirmSync).catch(() => {})`) — user NIGDY nie czeka na sieć
(komentarz w kodzie: naprawione już raz jako "receipt-save black screen" na słabym sygnale).
`moodService.add()`/`.update()` tego nie miały — stąd zawieszenie z §149.

**Przeniesiony ten sam wzorzec 1:1 na humor**:
- `moodStore.ts` — dodane `pendingSync: string[]`, `addPending`/`markPending`/`confirmSync`,
  `setEntries` merge-aware (zachowuje niezsynchronizowane wpisy przy odświeżeniu z chmury) —
  identyczny kształt co `expensesStore.ts`.
- `moodService.ts` — `add()`/`update()` (blokujące, `await`) USUNIĘTE, zastąpione
  `newId()` (synchroniczne, offline, mintuje id bez sieci) + `addWithId()` (upsert przez
  `setDoc`, bezpieczny zarówno dla nowego wpisu jak i edycji istniejącego — ten sam trik co
  `expensesService`, jedna funkcja zamiast osobnych add/update). `getAll`/`getByDate`/`remove`
  bez zmian.
- `moodSync.ts` (NOWY plik) — `flushPendingMoodWrites()`, kopia `flushPendingExpenseWrites()`.
  Wpięty w `_layout.tsx` (cold start + każdy foreground), obok istniejącego flusha wydatków.
- `MoodCheckInModal.tsx`'s `handleSave` — już NIE `async`/`await`. Zapisz lokalnie
  (`addPending`/`updateEntry`+`markPending`) → `haptic.success()` → `onClose()`, WSZYSTKO
  natychmiast, synchronicznie. Firestore-write leci fire-and-forget PO zamknięciu modala.
  `saving`/"Zapisuję..." zostaje jako guard przeciw double-tapowi, ale realnie migocze przez
  ułamek klatki (nic już nie czeka na sieć) — w praktyce user nigdy go nie zobaczy.
- `app/(tabs)/index.tsx`'s `handleQuickMood` (szybki wybór nastroju na dashboardzie) —
  ten sam local-first, ten sam powód (był drugim, mniejszym `moodService.add()` z tą samą
  luką).

Efekt: zapis humoru offline działa jak zapis paragonu offline od dawna — user widzi wynik od
razu, dane nie giną (persisted lokalnie + `pendingSync` przetrwa restart), a chmura dogania w
tle bez żadnej interakcji, gdy sieć wróci. `withTimeout` z §149 zostaje w `addWithId` — chroni
teraz kolejkę retry (`flushPendingMoodWrites`), nie UI (które już nigdy nie czeka).

`tsc`/`jest` czyste (1033 testy, bez zmiany netto — `moodStore.ts` importuje
`notificationsService`→`expo-notifications`, więc jak zawsze nietestowalne bezpośrednio w
Jest; zweryfikowane probe-testem że import faktycznie się wywala, jak przy `googleCalendarMap.ts`
w §138).

**Priorytet testu na urządzeniu — wysoki**: (1) zapisz humor przy dobrym połączeniu —
powinno działać jak dotąd, bez zauważalnej zmiany; (2) włącz tryb samolotowy, zapisz humor —
modal powinien zamknąć się NATYCHMIAST (nie czekać), wpis widoczny na liście; (3) wyłącz tryb
samolotowy, poczekaj na kolejny foreground apki (albo wróć z tła) — wpis powinien
zsynchronizować się w tle bez żadnej dodatkowej akcji.

---

## 151. Fix: eksport postępu pupila pokazywał brzydki, niezaokrąglony float HP kotka (2026-09-21)

User przysłał czwarty eksport testowej rundy (poziom 617, 7.6M XP total, prośba: "ogarnij
pupila i bossy... dostosowanie musimy implementowalne zrobić"). W eksporcie: `HP kotka:
6558.331368923098` — realna liczba dziesiętna, nie zaokrąglona jak wszędzie indziej w apce.

**Przyczyna**: `rollGearValue()` (gear.ts) świadomie losuje `OwnedGear.value` jako SUROWY
float (`min + rand()*(max-min)`, nigdy nie zaokrąglany — inne miejsca liczą na tej precyzji
przy sumowaniu wielu bonusów). Realna walka/ekran Pupila zawsze pokazuje HP przez
`effectiveCatMaxHp()`, która na końcu robi `Math.round(...)` — ale `bossProgressReport.ts`
liczyło `maxHp` RĘCZNIE (`catMaxHp(s.catMaxHpBonus) + gearFlatHp(...)`), pomijając zarówno to
zaokrąglenie, JAK I `potionFlatHp` (aktywna mikstura HP w ogóle nie była wliczana — `Progress
ReportInput` nie miało nawet pola `activePotion`). Dwa bugi w jednym miejscu: brzydki output +
zła wartość gdy user ma aktywną miksturę.

**Fix**: `bossProgressReport.ts` woła teraz `effectiveCatMaxHp()` wprost zamiast reimplementować
wzór — jedno źródło prawdy, ten sam co w realnej walce. `ProgressReportInput` dostał opcjonalne
`activePotion?: ActivePotion | null` (caller w `settings.tsx` przekazuje CAŁY stan
`usePetStore.getState()`, więc żadnej zmiany w call site nie trzeba było robić — strukturalne
typowanie).

**Reszta danych z eksportu przejrzana bez znalezienia dalszych anomalii**: krzywa nagród MAD
(§139) nadal ściśle rosnąca na widocznym zakresie orderów (24k→75k monet w kolejności bossów,
zgodne z projektem); kampania w pełni pokonana ~1 ciosem na bossa przy tych statach — oczekiwane
na tak ekstremalnym poziomie testowym (kampania to early-game content). Nic więcej nie
naprawiane bez konkretnego sygnału co user uważa za "nie tak" — zgadywanie dalszych zmian
balansu bez wskazówki ryzykowałoby zepsucie czegoś działającego poprawnie.

`tsc`/`jest` czyste (1035 testów, +2 nowe — float z gearu zaokrąglony w raporcie, mikstura HP
wliczona).

**Priorytet testu na urządzeniu — niski** (kosmetyczny fix eksportu, nie zmienia żadnej
realnej mechaniki walki/HP w grze — to zawsze było poprawnie liczone, zły był tylko tekst
raportu).

---

## 152. Krzywa XP/poziom przyspiesza po kampanii — tłumienie skoków levelu z MAD (2026-09-22)

User zresetował pupila (5. runda testowa) i zgłosił rdzeń problemu jeszcze raz: "z tymi
bossami jest popierdolone za dużo tego się dostaje przez co jest skok mnóstwo w górę lvl".
Realny przykład z eksportu poziomu 617: jedna walka MAD dała 697500 XP = ~28-29 poziomów W
JEDNEJ WALCE pod starą, czysto liniową krzywą (`need = 100+(level-1)*40` dla KAŻDEGO poziomu,
bez końca). Krzywa nagród MAD (`madRewardFor`, §139) jest sama w sobie poprawnie skalibrowana
i ściśle rosnąca po orderze bossa — problem nie w nagrodzie, tylko w tym że próg XP/poziom
rośnie tylko LINIOWO, więc przy bardzo dużych zastrzykach XP z endgame'u (MAD/raid) jeden
fight zawsze zjada dziesiątki poziomów, niezależnie jak wysoko user już jest.

**Rozważana alternatywa (odrzucona przez usera)**: przeskalować nagrodę MAD zależnie od
aktualnego poziomu gracza (analogicznie do raidu). User: "a może po prostu zamiast skakać
level tak bardzo to zwiększymy XP później per level" — czyli zostawić już skalibrowaną
nagrodę MAD w spokoju i zamiast tego stromić krzywą wymagań po stronie poziomu.

**Fix** (`petStore.ts`'s `levelFromXp`): krzywa **identyczna do poziomu 116** (`unlockLevel`
finałowego bossa kampanii — cała wcześniejsza kalibracja questów/kampanii/raidu poniżej tego
progu nietknięta). Od poziomu 117 wzwyż krok XP/poziom rośnie DODATKOWO o
`POST_CAMPAIGN_LEVEL_STEP_GROWTH(20) * (level-116)` ponad poprzedni krok — krzywa robi się
kwadratowa w `(level-116)` dla ogona endgame'u. Efekt: te same duże zastrzyki XP z
MAD/raidu dają MNIEJ poziomów, nie mniej XP (progresja total-XP nietknięta, tylko przelicznik
na poziom).

Stała `m=20` wybrana z przetestowanego zakresu `m=5..100` (throwaway `/tmp/level_curve_check
.mjs` na realnych liczbach z eksportu usera) — sprowadza przykładowy skok 697500 XP z ~29
poziomów do ~4. **Pierwsze podejście, do docalibrowania na świeżych danych z 5. rundy** —
identyczny tryb pracy jak krzywa nagród MAD, która też przeszła 2 iteracje (§136→§139) zanim
osiadła.

`__tests__/levelFromXp.test.ts` (nowy plik, `levelFromXp` jest bezpośrednio testowalne w
Jest — `petStore.ts`, w przeciwieństwie do `moodStore.ts`, nie importuje `notificationsService`
→ `expo-notifications`): poziom 116 identyczny co pod starą formułą (needed=4700), suma XP
do poziomu 200 wyraźnie wyższa niż pod czysto liniową krzywą, realny scenariusz 697500 XP
daje skok w rozsądnym zakresie (0 < skok < 10). `tsc`/`jest` czyste (1040 testów, +5).

**Priorytet testu na urządzeniu — wysoki**: to bezpośrednia odpowiedź na powtarzający się
zgłoszony problem, ale kalibracja `m=20` jest szacunkiem, nie zmierzonym optimum — user ma
obserwować 5. rundę testową i zgłosić czy skoki levelu przy dużych walkach MAD są teraz
sensowne, czy nadal za duże/za małe.

---

## 153. Siatka nastrój×energia w check-inie humoru nie łapała dotknięć — ScrollView z RN zamiast RNGH (2026-09-22)

User: "Nie dziala" + zrzut ekranu — kropka-wskaźnik siedziała na środku siatki, tekst pod
nią cały czas pokazywał "Jeszcze nie zaznaczono" mimo przeciągania/tapania, przycisk "Zapisz"
zostawał zablokowany (`disabled={saving || !mood || !energy}`).

**Przyczyna — dokładnie ten scenariusz, który poprzedni autor sam przewidział w komentarzu
przy `MoodEnergyGrid.tsx`'s `Gesture.Pan()`** (redesign siatki z §"Siatka nastrój×energia",
2026-09-19): siatka (RNGH `GestureDetector`/`Gesture.Pan().minDistance(0)`) siedzi wewnątrz
`ScrollView` w `MoodCheckInModal.tsx`, który był importowany z gołego `'react-native'`, nie z
`'react-native-gesture-handler'`. Zwykły RN ScrollView ma własny responder system, niezależny
od RNGH — wygrywał odpowiedź na dotyk zanim `Gesture.Pan()` siatki zdążył się odpalić, więc
`onChange`/`commit()` nigdy nie były wołane. `minDistance(0)` (rozwiązanie dla tap-vs-pan
wewnątrz samej siatki) nie miało wpływu na TEN konflikt (rodzic kontra dziecko, różne
biblioteki gestów).

**Fix**: `ScrollView` w `MoodCheckInModal.tsx` przełączony na import z
`'react-native-gesture-handler'` (drop-in, identyczne API) — poprawnie koordynuje zagnieżdżone
gesty tej samej biblioteki (siatka wygrywa dotyk zaczęty na sobie, scroll modala działa
normalnie poza nią, zgodnie z pierwotnym zamysłem). Import zmieniony raz na górze pliku —
obejmuje też drugi, poziomy `ScrollView` z tagami (`tagsScrollRef`), bez osobnej zmiany.

**Wzorzec do zapamiętania**: gdziekolwiek `GestureDetector`/`Gesture.*` z RNGH żyje wewnątrz
scrollowalnego rodzica, ten rodzic MUSI być `ScrollView`/`FlatList` z
`'react-native-gesture-handler'`, nie z gołego `'react-native'` — inaczej gest dziecka może
nigdy nie dostać dotyku. `tsc`/`jest` czyste (1040 testów, bez zmiany — czysto interakcyjny
fix, nic nie testowalne w Jest bez symulacji gestów).

**Priorytet testu na urządzeniu — wysoki**: to bezpośrednia naprawa zgłoszonego "Nie działa",
sprawdź czy przeciąganie/tapanie siatki teraz normalnie ustawia nastrój+energię i odblokowuje
"Zapisz", oraz że scroll modala (w tym scroll poziomy tagów) nadal działa płynnie poza siatką.

---

## 154. Przebalans ekonomii skrzynek — bug przepełnienia progów + box-tier cap na puli itemów (2026-09-22)

User przysłał zrzut ekranu "Statystyki skrzynek" (log realnych otwarć na urządzeniu, patrz
`boxStatsAnalysis.ts`): "skrzynka najtańsza ma albo bug albo jest zbyt op, względem żelaznej i
złotej... bo teraz z tej najtańszej średnio wypada koło 40 monet i cały czas jest się na plus
bo te informacje o sprzedaży itemów nie bierze tylko same Monety". Zrzut pokazywał REALNE
dane: Drewniana (35/otwarcie) — 180 otwarć, bilans monet -1276 (blisko zera W SAMYCH monetach,
zgodnie z projektem coins.min/max), ale 50% otwarć dało ekwipunek (nieliczony w bilansie
ekranu). Boska (450/otwarcie) — 40 otwarć, bilans -18000, **dokładnie 0% monet**.

**Zweryfikowano node'ową symulacją EV przed dotknięciem liczb** (`/tmp/box_ev*.mjs`, coins
branch + gear branch liczony przez `gearSellValue()` — realną, choć niższą niż `rollGearValue`,
wartość odsprzedaży itemu — nie samą deklarowaną `gearStatValue`) — dwa NIEZALEŻNE problemy:

1. **Prawdziwy bug**: `gearChance + combatItemChance` PRZEKRACZAŁO 100% dla gold (0.96+0.08=
   1.04) i divine (0.92+0.16=1.08). `rollBox()`'s branch monet (`r < combatItemCut` zawsze
   prawda skoro `combatItemCut>1` i `r<1`) był matematycznie NIEOSIĄGALNY — dokładnie
   potwierdzone przez zrzut usera (0% monet na 40 otwarć boskiej). Efekt uboczny: deklarowane
   `combatItemChance` gold/divine w praktyce działało jak POŁOWA wartości (reszta zabrana przez
   przepełnienie, np. divine realnie ~0.08 zamiast deklarowanych 0.16).

2. **Strukturalna wada balansu**: pula itemów w `rollBox()` (`unlockedGearFor(slot, level)`)
   była capowana WYŁĄCZNIE poziomem PUPILA, nigdy tierem SKRZYNKI — przy wysokim poziomie
   drewniana miała dokładnie ten sam dostęp do itemów co boska, różniły się tylko wagami
   rzadkości (śr. mnożnik rzadkości: drewniana ×1.2 → boska ×2.6, ledwie 2.1× różnicy), a cena
   rosła 35→450 (12.9× różnicy) — płacenie 12.9× więcej dawało tylko 2.1× lepszą jakość.

**Fix** (`src/utils/petBoxes.ts`, `src/utils/gear.ts`):
- `TIER_LEVELS` w `gear.ts` wyeksportowane (było lokalną stałą).
- Nowy `BOX_MAX_GEAR_TIER: Record<BoxId, number>` — PRAWDZIWY cap puli itemów per skrzynka
  (indeks w `TIER_LEVELS`): sardine≤20 (T1-T2), iron≤40 (T1-T3), gold≤65 (T1-T4), divine≤90
  (pełny katalog). `rollBox()` woła `unlockedGearFor(slot, Math.min(level, TIER_LEVELS[cap]))`
  zamiast gołego `level` — drewniana/żelazna fizycznie nie mogą wylosować topowych itemów
  niezależnie jak wysoko jest pupil.
- `gearChance` przycięte tak, żeby suma z `combatItemChance` ZAWSZE < 1 (monety realnie
  osiągalne wszędzie): iron 0.76→0.65, gold 0.96→0.70, divine 0.92→0.65 (sardine bez zmian,
  nigdy nie było tu buga).
- Zasięg monet drewnianej przycięty (18-105→12-70, jackpot 40→30) — była najbardziej
  dysproporcjonalna. Iron/gold/divine BEZ ZMIAN w zasięgu monet (było zawsze poprawnie
  zaprojektowane 50-300% własnego kosztu, tylko nieosiągalne przez bug #1).

**Wynik symulacji EV (poziom pupila 90+, pełny katalog odblokowany)**: ROI (coins EV + gear
EV via `gearSellValue`, względem kosztu skrzynki) spadło z drewnianej ~207%/nigdy-ujemne do
~104% (break-even, zgodnie z życzeniem usera), iron ~96%, gold ~79%, divine ~62% (dawniej
skrajnie -6%/0% monet — teraz solidnie dodatnie, coins branch znów działa). ROI nie rośnie
ściśle z tierem — świadomie zaakceptowane: `gearSellValue` = 40% wartości (`SELL_FRACTION`),
więc czysta symulacja "sprzedaj wszystko" NIEDOSZACOWUJE prawdziwą wartość wyższych tierów
(gracz zwykle ZAKŁADA mitycznego dropa zamiast go sprzedawać — realna moc bojowa nieliniowo
wyższa niż cena odsprzedaży). Kluczowe: żadna skrzynka już nie jest "oczywistym" wyborem
kosztem innych, i żadna nie jest matematycznie martwa.

User w rozmowie zdecydował (2 pytania): (1) przebuduj istniejące 4 tiery zamiast dodawać nowy
5. tier "Legendarna" za ~2k (był floated jako "albo jakoś tak", tentative) — (2) ściągnij
drewnianą do break-even zamiast dociągać drogie w górę do jej poziomu.

`__tests__/petBoxes.test.ts` zaktualizowane (stare progi r-values w mockach `Math.random`
odzwierciedlały STARE, przepełnione granice — poprawione na nowe) + 3 nowe testy: suma
gearChance+combatItemChance<1 dla każdej skrzynki (regresja na bug #1), drewniana NIE MOŻE
wylosować itemu >T2 nawet przy poziomie 999 (regresja na problem #2), boska WCIĄŻ MA pełny
katalog przy wysokim poziomie. `tsc`/`jest` czyste (1043 testy, +3).

**Priorytet testu na urządzeniu — wysoki**: otwórz kilka skrzynek każdego tieru, sprawdź że
złota/boska teraz realnie dają monety (nie tylko ekwipunek/umiejętności), i że drewniana przy
wysokim poziomie pupila nie losuje już topowego ekwipunku. Pierwsze podejście do kalibracji —
do docalibrowania na świeżych danych z "Statystyki skrzynek" po dłuższym graniu.

---

## 155. Obroża przebudowana z % na flat — jedyny slot gearu który gasł do zera na wysokim poziomie (2026-09-22)

User: "ogarnij ekwipunek — patrz jak teraz stoi z bossami" (po wcześniejszej zapowiedzi
"musiał być jako profesjonalista looknąć, pomyśleć, potem zrobić"). Zmierzone node'em
(nie zgadywane) jak KAŻDY z 6 slotów gearu wpływa realnie na walkę na różnych poziomach —
5 z 6 slotów trzyma wartość zawsze (hełm/buty/talizman/kolczyki to płaskie %, level-
niezależne; zbroja to płaska liczba HP), ale **obroża (atak%) matematycznie gasła do zera**:
`atkMultiplier(level, bonuses) = 1 + level×0.03 + bonuses.atk` — poziom BEZ SUFITU dominuje
mnożnik coraz mocniej, więc mityczna T5 obroża dawała ~9% CAŁEGO mnożnika na Lv20, ~4.4% na
Lv116 (koniec kampanii), ~1.2% na Lv617 (realna runda testowa usera) — w praktyce 0 ciosów
różnicy w walce na tak wysokim poziomie. Już zauważalne przy normalnym końcu kampanii, nie
tylko w ekstremalnych testach.

**Przyczyna strukturalna**: `atkStatBonus` (kupowany za monety, TRWAŁY stat) siedzi PRZED
mnożnikiem (`(BASE_ATK+atkStatBonus) × mult`) i rośnie razem z poziomem/gearem, podczas gdy
loot/gear-% siedzi W ŚRODKU mnożnika, konkurując wprost z nieograniczonym członem poziomu —
z góry skazane na asymptotyczne wygaszenie. Loot kampanii ma ten sam problem, ale jest
jednorazowy (kampania kończy się na Lv116) — gear to jedyny STALE dokupowalny/dropowalny
%-atak, więc jego wygaszanie jest bardziej dotkliwe.

**Fix (user wybrał, AskUserQuestion, z dwóch opcji)**: obroża przestała dawać `bonuses.atk`
(%), zaczęła dawać PŁASKIE punkty ataku — dokładnie jak kupiony `atkStatBonus`, PRZED
mnożnikiem, przez nową `gearAtkFlat()` w `gear.ts` (ten sam wzorzec co istniejące
`gearFlatHp()` dla zbroi). Efekt: % boost z obroży jest teraz TEN SAM na każdym poziomie
(zweryfikowane node'em: +10.1% na Lv20 I Lv617, identycznie) zamiast gasnąć. `baseValue`
obroży przeliczone na nową skalę (0.08→0.27 na tierach T1-T5, ×RARITY_MULT jak reszta) —
mityczna T5 = 0.27×15=4.05 flat atk ≈ +10% mocy, ten sam rząd wielkości co stary system
dawał na Lv20 (start normalnej gry), tylko trzymany na TYM poziomie zamiast gasnąć.

**Dotknięte miejsca** (wszędzie gdzie liczy się realna moc ataku): `gear.ts` (`GearStat`
`'atkPct'`→`'atkFlat'`, `gearCombatBonuses()` już nie zbiera atk z obroży, nowa
`gearAtkFlat()`, `fmtGearStat`/`GEAR_STAT_LABEL` zaktualizowane), `app/boss-fight.tsx`
(nowy `effectiveAtkStat = atkStatBonus + gearAtkFlat(...)`, użyty we WSZYSTKICH torach walki:
quest/misja/raid/nemesis/walka właściwa), `app/pet.tsx` (ekran "Siła bojowa" pokazuje
dokładnie to co realnie liczy się w walce, w tym w rozbiciu `(baza+kupione+gear)×mnożnik`),
`src/utils/bossProgressReport.ts` (eksport tekstowy pokazuje gear osobno w linii ATK).
`GearCombatBonuses.atk` ZOSTAJE w interfejsie (zgodność kształtu z `Bonuses`), ale zawsze
zwraca 0 — żaden slot już na niego nie mapuje.

**Testy**: `__tests__/gear.test.ts` — kalibracja "T5 loadout poniżej sumy kampanii"
przepisana na 3 sloty-% (bez obroży), nowy `describe` dla `gearAtkFlat` (brak obroży→0,
mityczna T5≈10% BASE_ATK, i KLUCZOWY test: % boost identyczny na Lv20/116/617 — istota
fixu). `tsc`/`jest` czyste (1046 testów, +3).

**Priorytet testu na urządzeniu — średni**: sprawdź ekran Ekwipunku (obroża pokazuje teraz
płaską liczbę "+N", nie "%"), i ekran Pupila → Siła bojowa (rozbicie mocy ataku uwzględnia
gear). Efekt bojowy realnie widoczny dopiero z equipped mityczną/legendarną obrożą.

---

## 156. Streaki: 2 nowe progi koloru + pasek postępu — najdłuższe "ciche" odcinki przycięte o połowę (2026-09-22)

User: "zapisz że jestem zestresowany na różowym kolorze już [długo]... zaczyna dręczyć nie
motywować" — utknięcie na jednym kolorze kafelka streaka przez długi czas zaczęło działać
odwrotnie do zamierzonego (Duolingo-style) efektu motywacyjnego.

**Diagnoza (policzona, nie zgadywana)**: progi kolorów (`STREAK_TIERS`) rosły z coraz
większym odstępem — 1→7→14→30→60→100 dni, czyli odcinki BEZ ŻADNEJ zmiany koloru: 6, 7, 16,
**30**, **40** dni. Różowy (Róż, 30-59 dni) to ponad dwa razy dłuższy odcinek ciszy wizualnej
niż wszystkie trzy wcześniejsze progi razem wzięte (29 dni), a błękit (60-99) jeszcze dłuższy
(40 dni) — dokładnie w miejscu gdzie user utknął. Wcześniejsze progi zmieniały się mniej
więcej co tydzień-dwa, dając ciągłe poczucie progresu; potem nagle miesiąc+ ciszy.

**Fix (user wybrał, AskUserQuestion, oba na raz)**:
1. **Dwa nowe progi** wstawione w środku obu najgorszych odcinków: Ametyst (45 dni, między
   Róż i Błękit) i Indygo (80 dni, między Błękit i Legenda) — przycina maksymalną długość
   "ciszy" z 30/40 dni do ~15/20. Kolory SYSTEMATYCZNIE wyliczone jako RGB-środek sąsiednich
   progów (róż↔błękit, błękit↔legenda), nie zgadywane — płynne przejście barwy. `FLAME_PALETTE`
   (trzy-tonowa paleta dla dużego płomienia-naklejki) dostała analogicznie wyliczone wpisy dla
   obu nowych progów (blend sąsiednich flame/halo/core tonów).
2. **Pasek postępu do następnego progu** na każdym kafelku `StreakWallCard` — cienki biały
   pasek u dołu, wypełnienie = `(days-tier.min)/(tier.next-tier.min)`. Daje codzienny,
   widoczny mikroruch NAWET w trakcie długiego odcinka między progami, nie tylko skok koloru
   raz na kilka tygodni. Brak paska dla złamanej serii i dla tieru terminalnego (Legenda,
   `next===null` — to już "wygrane", nic do czego dążyć).

**Refaktor przy okazji**: `STREAK_TIERS`/`streakTier()`/`streakColor()` WYDZIELONE z
`StreakFlame.tsx` do nowego `src/utils/streakTiers.ts` — `StreakFlame.tsx` importuje
`'react-native'` (komponenty), więc był nietestowalny bezpośrednio w Jest (ten sam znany limit
co np. `notificationsService.ts`). `StreakFlame.tsx` re-eksportuje dla wstecznej zgodności (5
miejsc w apce importowało stamtąd) — zero zmian w call site'ach.

**Testy**: nowy `__tests__/streakTiers.test.ts` (7 testów) — granice każdego progu (dokładnie
na/tuż przed), `next` poprawny (null tylko na Legendzie), **regresja pilnująca że żaden
odcinek między progami nie przekracza 20 dni** (bezpośrednia obrona przed powrotem tego
konkretnego problemu), monotoniczność indeksów. `tsc`/`jest` czyste (1053 testy, +7).

**Priorytet testu na urządzeniu — wysoki**: to bezpośrednia odpowiedź na zgłoszony dyskomfort.
Sprawdź czy pasek postępu jest widoczny i czytelny na kafelkach (szczególnie przy długiej
serii w środku odcinka Ametyst/Błękit/Indygo), i czy nowe kolory (Ametyst, Indygo) wyglądają
dobrze obok reszty palety.

---

## 157. Plan zajęć [PUR] — magazyn prefiksu w Ustawieniach, reszta świadomie odłożona (2026-09-22)

User (student UR) ustalił finalny format tytułu eventów w Google Kalendarzu:
`[PUR] Angielski techniczny - 203 B3` (prefiks + spacja + nazwa przedmiotu + " - " + sala),
i poprosił: "dodaj mi w ustawieniach możliwość edytowania go w razie czego" (np. zmiana
uczelni/kierunku w przyszłości).

**Nowy `src/store/classScheduleStore.ts`** — minimalny, jednopolowy Zustand store
(`prefix: string`, domyślnie `[PUR]`) z `persist`, ten sam wzorzec co `profileStore.ts`/
`streakFreezeStore.ts` (mały, jednoznaczny cel, bez rozbudowanej logiki). ŚWIADOMIE prostszy
niż `workPrefix`/`Employer` (praca ma wielu "pracodawców" do przełączania w historii — plan
zajęć to JEDEN, globalny prefiks, nie ma odpowiednika "zmiany uczelni w trakcie" do
zarządzania).

**Ustawienia** — nowa sekcja "Plan zajęć" (między "Praca" a "Saldo konta"), jeden wiersz
"Prefiks eventów planu zajęć" — dokładnie ten sam UI-wzorzec (`control: {kind:'text',
onBlur: save}`) co istniejący wiersz "Prefix eventów pracy" w sekcji Praca.

**Świadomie NIE zbudowane w tym samym kroku** (patrz pełny opis w NEXT_STEPS.md):
rozpoznawanie `[PUR]`-prefiksowanych `gcalEvents`, wyciąganie sali z tytułu, kafelek/widget,
powiadomienie X minut przed. User dopiero zaczyna wpisywać realne eventy do Kalendarza —
ta sama dyscyplina "najpierw dane, potem kod" co przy MAD reward curve/ekonomii skrzynek w
tej sesji. Gdy user potwierdzi że ma realne `[PUR]`-eventy w Kalendarzu: zbudować
`src/utils/classSchedule.ts` analogicznie do `workEvents.ts`'s `isWorkEvent()` (prefiks-match
na `title`), ale PROŚCIEJ — bez parsera godzin z tytułu (`titleTimeRange`/`HOUR_RANGE_RE` w
`workEvents.ts` istnieją bo zmiany pracy mają realne godziny WPISANE w tytuł, przy stałym
czasie eventu w Kalendarzu; zajęcia to zwykłe w pełni czasowe eventy — start/koniec z
WŁASNYCH czasów `CalendarEvent`, nie z tekstu) — tylko regex na sufiks `" - <sala>"`.

`tsc`/`jest` czyste (1053 testów, bez zmiany netto — czysty getter/setter store, nic
złożonego do testowania na tym etapie).

**Priorytet testu na urządzeniu — niski**: kosmetyczna zmiana w Ustawieniach, żadna
istniejąca funkcja się nie zmieniła. Sprawdź że nowa sekcja "Plan zajęć" pokazuje się i
zapisuje prefiks poprawnie.

---

## 158. Plan zajęć [PUR] — rozpoznawanie eventów + kafelek dashboardu (2026-09-22)

Kontynuacja §157 (magazyn prefiksu). User przesłał zarządzenie Rektora UR o organizacji roku
akademickiego 2026/2027 + zrzut swojego planu zajęć (2 Inżynieria Materiałowa, sem. 2, z
podziałem tydz. A/B) — na tej podstawie w ROZMOWIE (nie w apce) wygenerowany gotowy plik
`.ics` na semestr zimowy (format `[PUR] TYP - NAZWA - SALA`, TYP ∈ {W,C,L,P}, weryfikowany
node'em względem zarządzenia — święta wypadające w trakcie zajęć wycięte, tydzień
przesunięty 21-23.12 z powodu krótkiego startu semestru obsłużony poprawnie). User poprosił
o realną funkcję w apce, mając już prawdziwe dane do zweryfikowania — dokładnie ten moment,
na który czekaliśmy (patrz §157: "świadomie odłożone do czasu aż user wpisze realne eventy").

**Nowy `src/utils/classSchedule.ts`** — `isClassEvent()`/`parseClassEvent()`, analogiczne do
`isWorkEvent()` w `workEvents.ts`, ale PROŚCIEJ: zero parsera godzin z tytułu (zajęcia to
zwykłe w pełni czasowe eventy Google Kalendarza, `startTime`/`endTime` z samego `CalendarEvent`,
nie z tekstu — w przeciwieństwie do zmian pracy, które mają godziny WPISANE w tytuł przy
stałym czasie eventu). `parseClassEvent()` rozbija `"[PUR] W - Nazwa - Sala"` na
`{type, subject, room}` przez split po `" - "` — pierwszy segment to litera typu (W/C/L/P),
ostatni to sala, środek to nazwa (join z powrotem przez `" - "`, gdyby nazwa sama miała ten
separator — nie miała w realnych danych usera, ale bezpieczne na przyszłość). Fallback dla
nierozpoznanego formatu (2 segmenty → subject+room bez type; 1 segment → cały tekst jako
subject) — event PRZESZŁY `isClassEvent()` nigdy nie znika po cichu, zawsze się pokazuje,
nawet gorzej sformatowany.

**Typ "P" (Projekt) dodany do trio W/C/L** — user w trakcie ustalania formatu zgłosił sesje
oznaczone w realnym planie jako "pr." (np. "KMSiWM-pr"), które nie mieściły się w
pierwotnych trzech literach.

**Nowa sekcja dashboardu `class-schedule`** (playbook §12) — `ClassScheduleCard.tsx`,
skopiowany layout z `GCalCard.tsx` (dziś/jutro, kropka+godzina+tytuł) rozszerzony o odznakę
typu (W/C/L/P, fioletowy akcent #A78BFA — spójny z sekcją "Plan zajęć" w Ustawieniach z §157)
i salę. Filtr "dziś, ale jeszcze się nie skończyło" (`shiftClockRange` z `workEvents.ts` —
reużyty WPROST, bo dla eventu bez godzin-w-tytule to po prostu `ev.startTime`/`ev.endTime`)
skopiowany z istniejącego `gcalToday` — identyczna logika, dodatkowo zawężona
`isClassEvent()`-em. Grupa w edytorze: "Zadania i nawyki" (nie "Inne" jak `gcal` — to
codzienny, nawykowy sygnał "gdzie dziś idę", bliżej `today-tasks`/`habits-today` niż ogólna
przeglądarka kalendarza), priorytet renderowania: NIE w `DEFERRED_SECTIONS` (ładuje się w
pierwszej, synchronicznej klatce jak `gcal`/`today-tasks` — "co dziś muszę zrobić").

**Testy**: `__tests__/classSchedule.test.ts` (14 testów) — fixtures to REALNE tytuły z planu
usera (nie wymyślone), w tym przypadek "sala z myślnikiem w środku" (`135-136 B1`) który
mógłby pomylić naiwny parser liczący segmenty. `tsc`/`jest` czyste (1067 testów, +14).

**Świadomie NIE zbudowane jeszcze**: powiadomienie X minut przed z salą (osobny przełącznik
w Ustawieniach) — kafelek dashboardu odpowiada na "co dziś/jutro", ale nie ma jeszcze
proaktywnego push. Do zrobienia jako osobny krok, ten sam wzorzec co powiadomienia o
zmianach pracy w `notificationsService.ts`.

**Priorytet testu na urządzeniu — wysoki**: zaimportuj plik `.ics` (osobny kalendarz Google,
łatwy do usunięcia jednym klikiem jeśli coś nie gra), poczekaj na sync `gcalEvents`, sprawdź
czy kafelek "Plan zajęć" pokazuje dzisiejsze/jutrzejsze zajęcia z poprawnym typem i salą.

---

## 159. Fix: licznik wody potrafił cofnąć się po synchronizacji z zegarka (2026-09-22)

User: "na zegarku kliknąłem z 5/8 szklanek 3 razy na 8/8, to w aplikacji po odświeżeniu
zestuckowało się na 7/8 jakbym nie wykonał celu" — realny bug, nie zgłoszenie bez przyczyny.

**Przyczyna**: `useWaterTracker.ts`'s `persist()` (odroczony 350ms zapis po tapnięciu +/- w
`app/(tabs)/food.tsx`) nadpisywał storage GOŁYM `counts[id] = ref.current` — lokalną wartością
z pamięci hooka, bez sprawdzenia czy coś zmieniło storage w międzyczasie. Health Connect
synchronizuje wodę z zegarka w tle (`healthAutoSync.ts` → `feedWaterHabit()` w `habits.ts`,
TEN SAM plik, już poprawnie z MAX-merge — komentarz tam: "w ciągu dnia liczba tylko rośnie").
Wyścig: gdy `feedWaterHabit()` woła `bump()` DOKŁADNIE w oknie, w którym w
`useWaterTracker`'s hooku wisi jeszcze odroczony zapis (`timer.current` niepuste),
`load()`'s istniejący guard (`if (timer.current) return` — celowo pomija przeładowanie, żeby
nie zgubić optymistycznego tapnięcia) sprawia że `ref.current` NIGDY nie dowiaduje się o
świeższej wartości z zegarka. Gdy debounce w końcu odpala, `persist()` nadpisuje storage
STARĄ lokalną liczbą — realnie KASUJE wodę zalogowaną z zegarka w tym oknie, nie tylko
opóźnia UI.

**Fix**: `persist()` odczytuje FRESH storage tuż przed zapisem i ustala finalną wartość jako
`Math.max(fresh, ref.current)` — dokładnie ten sam "w ciągu dnia liczba tylko rośnie" wzorzec
co `feedWaterHabit()`, teraz spójny dla OBU ścieżek zapisu tego samego licznika (ręczny tap w
apce i sync z zegarka), nie tylko jednej. Jeśli finalna wartość różni się od tego co hook
lokalnie myślał (czyli storage było świeższe), UI też się aktualizuje (`ref.current`/
`setGlasses`), żeby nie pokazywać stale liczby po zapisie.

**Nie napisano automatycznego testu** — `useWaterTracker.ts` to hook (React state + timery +
`expo-router`), nietestowalny bezpośrednio w obecnym Jest setupie (brak
`@testing-library/react-hooks` w projekcie, ten sam znany limit co pliki importujące RN-owe
moduły gdzie indziej w tej sesji). Logika reużyta z `feedWaterHabit()`, która MA pokrycie
testami (`__tests__/habits.test.ts`, "feedWaterHabit — MAX-merge, nigdy nie cofa ręcznego
zapisu"). `tsc`/`jest` czyste (1067 testów, bez zmiany — plik i tak poza zasięgiem testów).

**Priorytet testu na urządzeniu — wysoki**: bezpośrednia odpowiedź na zgłoszony bug. Trudno
odtworzyć idealnie (wymaga realnego wyścigu czasowego z synchronizacją zegarka), ale fix
usuwa mechanizm który mógł to powodować — obserwuj czy licznik wody jeszcze kiedyś "cofnie
się" po synchronizacji.

---

## 160. Plan zajęć w TopPillu — wydzielone z generycznej puli gcal, priorytet jak zmiana pracy (2026-09-22)

User: "żeby też łapało że mam zajęcia w pillu". Zajęcia `[PUR]` technicznie JUŻ trafiały do
pilla — jako zwykłe eventy Google Kalendarza w priorytecie 6 ("gcal event today") — ale w
BRZYDKIEJ formie: surowy tytuł z nawiasami (`"[PUR] W - KOMP. MODEL. STRUKTUR..."`), bez
wyciągniętego typu/sali. Ten sam problem co zmiany pracy miałyby, gdyby NIE zostały wydzielone
do własnego priorytetu 3 — więc ten sam fix: nowy priorytet **3b**, między "zmiana pracy jutro"
a "zaległe zadania", pozycjonowany jak zmiana pracy (rozumowanie: "musisz gdzieś fizycznie być
o konkretnej godzinie" to ta sama pilność co zmiana w pracy, wyższa niż generyczny event w
kalendarzu).

Filtr "jeszcze trwa/się nie zaczęło" TEN SAM co priorytet 6 (gcalToday), ale patrzy na
`endTime` nie `startTime` (event nadal aktualny dopóki się nie skończy, nie tylko dopóki nie
wystartuje — inaczej 90-minutowe zajęcia znikałyby z pilla po 45 min mimo trwania). Rotacja
przez WSZYSTKIE dzisiejsze zajęcia via `calmTick`, jak reszta multi-item priorytetów w tym
pliku (overdue/today-tasks/budget/gcal). Format: `"{TYP}: {PRZEDMIOT} · {SALA}"` (np. "WYKŁAD:
KOMP. MODEL. STRUKTUR I WŁ. MAT. · 203 B3"), fioletowy akcent `#A78BFA` — spójny z sekcją
"Plan zajęć" w Ustawieniach (§157) i dashboardowym kafelkiem (§158). Priorytet 6 (generyczny
gcal) dostał `!isClassEvent(...)` filtr, żeby `[PUR]`-eventy NIGDY nie pokazały się tam w
brzydkiej, surowej formie jako "zapasowa" ścieżka — jeden, przewidywalny format zawsze.

`tsc`/`jest` czyste (1067 testów, bez zmiany — `TopPill.tsx` bez istniejącego pokrycia testami,
ten plik nigdy go nie miał, nowy priorytet nie łamie tego wzorca).

**Priorytet testu na urządzeniu — średni**: po imporcie `.ics` z §158, sprawdź czy pill
pokazuje dzisiejsze zajęcia z ładnym formatem (typ+przedmiot+sala), rotuje przez wszystkie
jeśli jest ich kilka danego dnia, i znika dopiero po zakończeniu ostatnich (nie po starcie).

---

## 161. Plan zajęć — wirtualny podgląd tygodnia, nowy ekran (2026-09-22)

Ostatni kawałek rozbudowy planu zajęć z tej sesji (kontynuacja §157-160). User potwierdził
przez AskUserQuestion: dashboardowy kafelek (§158) wystarcza jako "widget" (bez zmian), ale
chce "wirtualny podgląd" — siatkę jak w oryginalnym planie z UR, który przysłał jako zrzut.

**Nowy `app/class-schedule.tsx`** — kolumny = dni tygodnia (Pon-Nie, poziomy scroll), w
każdej kolumnie chronologiczna lista tego dnia. ŚWIADOMIE NIE ściśle proporcjonalna do
godziny (1px = 1min zrobiłoby albo gigantyczny ekran, albo nieczytelnie małe bloki dla
90-minutowych zajęć na telefonie) — bloki mają kolor wg typu (W/C/L/P, ta sama paleta co
`ClassScheduleCard`), czas/typ/przedmiot/salę. Nawigacja tydzień wstecz/naprzód +
szybki powrót ("wróć do dziś" gdy `weekOffset !== 0`). Dane = te same `gcalEvents` +
`isClassEvent`/`parseClassEvent` co dashboardowy kafelek (§158) i TopPill (§160) — WSZYSTKIE
TRZY miejsca zawsze pokazują to samo, zero duplikacji logiki.

**Nowy `src/utils/weekGrid.ts`** — `mondayOf()`/`fmtWeekRange()`/`toYMD()` WYDZIELONE z
`class-schedule.tsx` (importuje `react-native`, nietestowalny bezpośrednio — ten sam wzorzec
co `streakTiers.ts` w §156). Warto było: `mondayOf()` ma nietrywialny przypadek — `Date.
getDay()` zwraca 0 dla NIEDZIELI (nie 7), więc naiwne `1 - dow` cofnęłoby niedzielę o -6 dni
(do poniedziałku NASTĘPNEGO tygodnia) zamiast o -1 dzień (do poniedziałku tygodnia który się
właśnie kończy) — jawny `dow === 0 ? -6 : 1 - dow` obsługuje to poprawnie, pokryte testem.

**Dostęp**: link w Ustawieniach → Plan zajęć → "Podgląd tygodnia", ORAZ tapnięcie w
dashboardowy kafelek `ClassScheduleCard` (wcześniej niekliknięty — `GCalCard`, na którym był
wzorowany, też nie jest klikalny, ale tu dodanie nawigacji miało oczywisty cel: pełny tydzień
zamiast tylko dziś/jutro).

**Testy**: `__tests__/weekGrid.test.ts` (8 testów) — w tym granica niedzieli i granica
miesiąca. `tsc`/`jest` czyste (1075 testów, +8).

**Priorytet testu na urządzeniu — średni**: sprawdź ekran (Ustawienia → Plan zajęć → Podgląd
tygodnia, lub tapnij kafelek dashboardu), nawigację tydzień wstecz/naprzód, i czy poziomy
scroll do dalszych dni tygodnia działa płynnie na telefonie.

---

## 162. Siatka nastrój×energia — DRUGI, prawdziwy powód niełapania dotknięć: brak GestureHandlerRootView wewnątrz Modala (2026-09-23)

User po §153 (fix ScrollView z RN→RNGH): "Nadal nie mogę dotknąć tam i wpisac humoru" + ten sam
zrzut co poprzednio (kropka na środku, "Jeszcze nie zaznaczono"). §153 był realną poprawką
właściwego problemu, ale NIE JEDYNEGO — dwie niezależne przyczyny nakładały się na ten sam
objaw, więc naprawienie tylko jednej nie dało żadnej widocznej zmiany.

**Druga przyczyna**: `MoodCheckInModal.tsx` renderuje siatkę wewnątrz natywnego `Modal` z
`'react-native'`. `Modal` **portuje swoją zawartość do OSOBNEJ natywnej hierarchii** — nowe
okno (`Window`) na Androidzie, osobny `UIViewController` na iOS — POZA drzewem widoków, w
którym żyje reszta apki. Jedyny `GestureHandlerRootView` w całej apce jest w `app/_layout.tsx`,
opakowuje root nawigacji — ale Modal, jako osobna hierarchia natywna, nie jest jego potomkiem
w SENSIE NATYWNYM (mimo że jest nim w drzewie React). RNGH potrzebuje `GestureHandlerRootView`
jako faktycznego natywnego przodka żeby poprawnie przechwytywać/routować touch events —
bez niego `Gesture.Pan()` siatki (nawet po fixie ScrollView z §153) nigdy nie dostawał
poprawnie zroutowanych dotknięć. To udokumentowane ograniczenie RNGH przy `Modal`/`Portal`
(swmansion docs: "placing gesture handler" — modale/portale potrzebują WŁASNEGO roota).

**Fix**: `MoodCheckInModal.tsx` — zagnieżdżony `<GestureHandlerRootView style={{flex:1}}>`
dodany TUŻ WEWNĄTRZ `<Modal>`, opakowujący całą zawartość (overlay + sheet + scroll + siatkę).
Import `GestureHandlerRootView` z `'react-native-gesture-handler'` obok istniejącego importu
`ScrollView` z tej samej biblioteki.

**Wzorzec do zapamiętania (rozszerza wzorzec z §153)**: `GestureDetector`/`Gesture.*` z RNGH
wewnątrz JAKIEGOKOLWIEK natywnego `Modal` (RN `Modal`, i prawdopodobnie każdy inny komponent
portujący do osobnego natywnego okna/kontrolera) wymaga WŁASNEGO `GestureHandlerRootView`
wewnątrz tego Modala — root w `_layout.tsx` go nie obejmuje, niezależnie od poprawności
`ScrollView`-parenta. Jeśli w przyszłości pojawi się kolejny Modal z gestem RNGH w środku
(dziś jedyny taki to `MoodCheckInModal` — `DashEditRow.tsx`'s `GestureDetector` żyje INLINE na
dashboardzie, nie w Modalu, więc korzysta z roota w `_layout.tsx` bez problemu), potrzebuje tej
samej łaty od razu, nie po zgłoszeniu identycznego buga.

**Weryfikacja**: `tsc`/`jest` czyste (1075 testów, bez zmiany — czysto interakcyjny fix,
nic nowego do testowania w Jest bez symulacji natywnych gestów w Modalu).

**Priorytet testu na urządzeniu — wysoki**: to DRUGA próba naprawy tego samego zgłoszonego
"Nie działa"/"Nadal nie mogę dotknąć" — sprawdź czy przeciąganie/tapanie siatki TERAZ faktycznie
ustawia nastrój+energię (kropka się przesuwa, tekst pod siatką zmienia się z "Jeszcze nie
zaznaczono"), przycisk "Zapisz" się odblokowuje, i że reszta modala (scroll, poziomy scroll
tagów, TextInput notatki, przycisk zamknięcia) nadal działa normalnie z nowym zagnieżdżonym
`GestureHandlerRootView`.

---

## 163. Plan zajęć — kafelek dashboardu pokazuje najbliższy dzień, nie znika w weekendy/przerwy (2026-09-23)

User: kafelek "musi pokazywać aktualny plan... następny dzień jaki będę miał z datą i za ile
dni" — dotychczas `ClassScheduleCard` (§158) renderował tylko dziś/jutro i CAŁKOWICIE znikał
(`return null`), gdy oba były puste (weekend, przerwa międzysemestralna, dzień wolny z
zarządzenia Rektora UR) — w praktyce kafelek był niewidoczny większość tygodnia dla planu z
zajęciami tylko pon/wt/śr.

**Fix**: nowy `classNextDay` memo w `index.tsx` (liczony TYLKO gdy `classToday`/`classTomorrow`
oba puste — w normalny dzień szkolny się nie odpala) — szuka od pojutrza najbliższej daty z
choć jednym `[PUR]`-eventem, zwraca `{date, daysAway, events}`. `ClassScheduleCard` dostaje
nowy opcjonalny prop `nextDay` i renderuje go jako trzeci wariant (po dziś/jutro), z etykietą
z nowej `fmtNextClassLabel(dateYMD, daysAway)` w `classSchedule.ts` — "Śr 24 wrz · za 2 dni",
odmiana "dzień/dni" przez `plPlural` (ten sam wzorzec co `za ${d} dni` gdzie indziej w
`index.tsx`). Ręczne tablice dni/miesięcy zamiast `toLocaleDateString` — ten sam powód co
`weekGrid.ts`'s `fmtWeekRange()` (§161): pewna testowalność bez zależności od locale ICU pod
Jest/Hermes. Guard w `index.tsx` rozszerzony o `|| !!classNextDay`. Tap na kafelku ZAWSZE
prowadzi do pełnego widoku tygodnia (`/class-schedule`, §161) niezależnie od wariantu.

**Testy**: `__tests__/classSchedule.test.ts` +4 (`fmtNextClassLabel`: odmiana 1/3/12,
poprawny dzień tygodnia z samego YMD dla niedzieli). `tsc`/`jest` czyste (1079 testów, +4).

**Priorytet testu na urządzeniu — średni**: sprawdź kafelek w weekend albo w dniu bez zajęć —
powinien pokazać najbliższy przyszły dzień z datą i "za X dni", tap nadal otwiera pełny tydzień.

---

## 164. Taski — kolor rodzaju (quick/deep/waiting) z powrotem na KAŻDEJ karcie, nie tylko w nagłówku grupy (2026-09-23)

User: "ulepsz kolorystycznie taski tylko tak rozsądnie" — przy okazji innej pracy nad ekranem.
`app/(tabs)/tasks.tsx` przeszedł wcześniej świadomy "mono redesign" (komentarz w pliku: "chrome
zadań = biel; overdue ZOSTAJE czerwony") — pasek/tło aktywnego zadania było na sztywno zielone
(`G.green`) NIEZALEŻNIE od rodzaju (`KIND_META`: quick=zielony/deep=niebieski/waiting=bursztyn).
Te 3 kolory już istniały i były używane — ale TYLKO w nagłówku sekcji widoku "wg rodzaju" i w
podglądzie chipa przy szybkim dodawaniu; sama karta zadania na liście nie dawała żadnej
wskazówki jakiego jest rodzaju.

**Fix — rozsądny, nie chaotyczny**: żadnych nowych kolorów, TYLKO reużycie istniejących 3 z
`KIND_META`, i tylko w dwóch, wąsko dobranych miejscach:
1. Lewy pasek + delikatny wash tła aktywnej karty (`accentBar`/`greenWash`) — kolor rodzaju
   zamiast sztywnego zielonego, ta sama intensywność/alpha co wcześniej (0.06/0.11 wash,
   0.55/pełny pasek), tylko przemalowane.
2. Mała ikonka rodzaju (Zap/Target/Hourglass, te same co w KIND_ICON) przy tytule —
   `titleRow` nowy wrapper, `cardTitleFlex` żeby tekst nadal zawijał się do 2 linii.

**Hierarchia kolorów, żeby nic się nie gryzło**: overdue (czerwony) i done/snoozed (neutralny/
wyciszony) dalej WYGRYWAJĄ nad kolorem rodzaju — te gałęzie logiki bez zmian, kolor rodzaju
wchodzi wyłącznie tam, gdzie wcześniej był sztywny zielony dla aktywnych zadań. Kolor pilności
(`subColor` — dziś/jutro na zielono) zostaje osobną osią, NIE zmieniony — rodzaj≠pilność, dwie
różne informacje nie powinny dzielić jednego koloru. Priorytet "wysoki" nadal podbija tylko
kolor TYTUŁU (biel/accent), bez zmian. Wynik: 4 niezależne, nieprzecinające się sygnały —
rodzaj (pasek+ikonka), pilność (podtytuł), priorytet (tytuł), status (całość karty overdue/done).

Przy okazji usunięte 2 martwe pola (`G.activeBorder`/`G.greenStrong`, w module-level `G` i w
`gFor()`) i `greenWashStrong`/twardy kolor w `accentBarStrong` — wszystkie zastąpione inline
kolorem rodzaju, więc już nieużywane.

**Testy**: brak nowych (czysto wizualny redesign karty, `tasks.tsx` bez istniejącego pokrycia
testami — jak reszta ekranów RN w projekcie). `tsc`/`jest` czyste (1079 testów, bez zmiany).

**Priorytet testu na urządzeniu — średni**: sprawdź listę zadań — każda aktywna karta powinna
mieć cienki kolorowy pasek z lewej + małą ikonkę przy tytule (zielony=Szybkie,
niebieski=Do skupienia, bursztynowy=Poczekalnia), overdue nadal czerwone, done/snoozed nadal
wyciszone/białe. Sprawdź też oba tryby grupowania (wg terminu i wg rodzaju) — kolor karty i
kolor nagłówka grupy powinny się teraz zgadzać.

---

## 165. Widget pulpitu Androida "Zadania" — pierwszy natywny bridge module w projekcie (2026-09-23)

User: "bardzo lubiłem mieć na ekranie co muszę zrobić/kupić" — home-screen widget (Android
App Widget), NIE dashboardowy kafelek w apce. To inna klasa zmiany niż cokolwiek innego w tej
sesji: natywny surface, nie JS — wymaga nowego builda APK (nie poleci przez OTA), i to
PIERWSZY w tym projekcie natywny moduł z callable bridge (JS→Kotlin), nie tylko pasywny
kod jak dotychczasowe pluginy.

**Decyzja architektoniczna — własny Kotlin, NIE `react-native-android-widget`**: ten projekt
już raz oberwał za third-party natywny pakiet (`withBankNotificationListener.js`'s komentarz:
"avoids the stale module's AGP-8 `namespace` build break on SDK 54"). AppWidgetProvider/
RemoteViews to stabilne, udokumentowane od lat natywne API Androida — pisanie własnego Kotlina
przez config-plugin (jak `withBankNotificationListener.js`/`withNativeCrashCatcher.js`) było
mniej ryzykowne niż kolejna zewnętrzna zależność z niepewnym stanem utrzymania. User potwierdził
zakres przez AskUserQuestion: v1 = tylko podgląd (tap otwiera apkę, BEZ odznaczania na
widgecie — odłożone jako v2, bo headless JS na klik bez otwartej apki jest dużo bardziej
zawodny), budować teraz.

**Przepływ (JS → plik → natywny Kotlin, NIE bezpośrednie wywołanie z danymi)**:
1. `src/utils/widgetTasks.ts` (`pickWidgetTasks`, czyste, testowalne) — filtruje do
   `status==='pending'`, sortuje zaległe→dziś→jutro→reszta wg terminu→bez terminu na końcu
   (spłaszczona wersja `sortTasks(...,'deadline')` z tasks.tsx, bez nagłówków sekcji — widget
   ma miejsce na płaską listę), limit 6 (RemoteViews nie wspiera scrolla/listy bez
   `RemoteViewsService` — 6 stałych slotów to świadomy, prostszy odpowiednik). Kolor rodzaju =
   `KIND_META[resolveKind(t)].color` (§164 — te same 3 kolory, teraz i na widgecie).
2. `src/services/widgetSync.ts` (`syncTasksWidget`) — pisze JSON do
   `${FileSystem.documentDirectory}widget_tasks.json` (TA SAMA konwencja ścieżki co
   `bankNotificationDrain.ts` — `documentDirectory` === Android `context.filesDir`, tylko
   kierunek odwrotny: tu JS pisze, natywne czyta), potem woła
   `NativeModules.TasksWidget?.requestUpdate?.()`. Dedup: nie pisze/nie budzi widgetu gdy JSON
   identyczny jak ostatnio. `Platform.OS!=='android'` i brak `documentDirectory` → cichy no-op
   (bezpieczne wołać zawsze, bez feature-flagi) — **kluczowe**: `NativeModules.TasksWidget` nie
   istnieje dopóki nie powstanie NOWY build APK z tym pluginem, więc `?.` na każdym wywołaniu
   jest obowiązkowe, nie kosmetyczne.
3. `app/_layout.tsx` — nowy `useEffect`: `useCalendarStore.subscribe()` na zmianę `tasks`
   (debounce 600ms, jak `throttledStorage.ts`), plus wywołanie na `AppState` active/background
   (łapie cold start i przypadki poza samym store). Aktualizacja więc: na żywo przy zmianie
   listy zadań w otwartej apce, i przy każdym wejściu/wyjściu z apki.

**Natywna strona — `plugins/withTasksWidget.js`** (nowy config plugin, zarejestrowany w
`app.json`, ten sam `withDangerousMod`/Kotlin-do-wygenerowanego-projektu wzorzec co pozostałe
`plugins/with*.js`):
- `TasksWidgetProvider.kt` (`AppWidgetProvider`) — `updateAll()` (companion, wołane z
  `onUpdate()` I z modułu bridge) czyta `widget_tasks.json`, buduje `RemoteViews` z do 6 wierszy
  (`setViewVisibility`/`setTextViewText`/`setInt(...,"setColorFilter",...)` na kropce —
  reflection-safe RemoteViews trick do tintowania `ImageView`), `PendingIntent` na cały widget
  otwiera `sapp://tasks` (istniejący scheme z app.json, `expo-router` mapuje na
  `app/(tabs)/tasks.tsx`). Pusta lista → komunikat "Brak zaległych zadań 🎉" zamiast pustych
  wierszy.
- `TasksWidgetModule.kt` (`ReactContextBaseJavaModule`, nazwa mostu `"TasksWidget"`) — JEDNA
  metoda `requestUpdate()`, woła `TasksWidgetProvider.updateAll()` (DRY: ten sam kod renderujący
  co okresowy `onUpdate()`, moduł tylko go budzi na żądanie).
- `TasksWidgetPackage.kt` (`ReactPackage`) — rejestruje moduł. Wpięcie w `MainApplication.kt`
  przez `withMainApplication`+`mergeContents` (oficjalna technika Expo, idempotentna między
  prebuildami) zaczepione o wygenerowany podpowiadający komentarz
  (`// add(MyReactNativePackage())` wewnątrz `PackageList(this).packages.apply { }` —
  **zweryfikowane realnym `npx expo prebuild` na SDK 54**, nie zgadywane: pierwsza wersja
  anchora zakładała starszy wzorzec `packages.add(new MyReactNativePackage());` z e2e fixture
  innego pakietu i faktycznie nie trafiła przy pierwszym dry-runie — poprawione po zobaczeniu
  prawdziwego wygenerowanego pliku).
- `res/layout/tasks_widget.xml` + `res/drawable/widget_bg.xml`/`widget_dot_circle.xml` +
  `res/xml/tasks_widget_info.xml` (`updatePeriodMillis=1800000` — 30 min, Android minimum,
  fallback dla przypadków poza AppState/subscribe powyżej, np. gdy urządzenie ubija JS w tle).
- `<receiver>` w `AndroidManifest.xml` (przez `withAndroidManifest`) z
  `android.appwidget.action.APPWIDGET_UPDATE` + `meta-data` na `tasks_widget_info.xml`. Zero
  nowych `android.permissions` (App Widget provider ich nie wymaga).

**Weryfikacja bez Android SDK w tym środowisku**: pełny `npx expo prebuild --platform android`
uruchomiony naprawdę (nie tylko przeczytany kod) — złapał realny błąd anchora przy pierwszym
dry-runie (patrz wyżej), po fixie przeszedł czysto; wygenerowany `MainApplication.kt`/
`AndroidManifest.xml`/wszystkie XMLe zweryfikowane ręcznie + `xmllint --noout` (wszystkie
poprawne). Prawdziwa kompilacja Kotlina nastąpi dopiero w CI (`.github/workflows/build.yml`,
`./gradlew assembleRelease` — **osobny workflow od zwykłego `ci.yml`**, odpala się
AUTOMATYCZNIE na każdy push do `master` i publikuje APK jako GitHub Release). To JEDYNE
miejsce gdzie ten Kotlin faktycznie się skompiluje — po merge'u tego PR-a trzeba dopilnować
TEGO workflow (nie tylko zwykłego "check" CI), bo błąd kompilacji Kotlina pojawi się TYLKO tam.
`tsc`/`jest` czyste (1085 testów, +6 — `pickWidgetTasks`).

**Priorytet testu na urządzeniu — wysoki, wymaga NOWEGO APK** (nie poleci przez OTA — plugin/
natywny kod): po zbudowaniu, dodaj widget "Sapp — Zadania" na pulpit, sprawdź że pokazuje
realne zadania z kolorami rodzaju, że tap otwiera apkę na zakładce Zadań, że lista aktualizuje
się po zmianach w apce (bez konieczności ręcznego usuwania/dodawania widgetu ponownie), i że
pusta lista pokazuje komunikat zamiast pustych wierszy.

---

## 166. Widget "Zadania" — potwierdzony działający na urządzeniu + resize/przezroczyste tło (2026-09-23)

User potwierdził zrzutem ekranu (S22 Ultra, One UI): widget realnie pokazuje zadania z datami/
kolorami rodzaju, tap działa. Dwie prośby z tego samego zgłoszenia: (1) "żebym mógł go
skalować... żeby był na wysokość mniejszy jak się da", (2) "żebym mógł edytować żeby np zrobić
przezroczyste tło".

**(1) Mniejszy resize**: `tasks_widget_info.xml` miał tylko `minWidth`/`minHeight` (180dp) —
Android/One UI używa TYCH do limitu resize gdy `minResizeWidth`/`minResizeHeight` nie są
podane, więc widget nie dawał się skurczyć poniżej ~3 komórek siatki. Fix: jawne
`minResizeHeight="70dp"` (nagłówek "ZADANIA" + ok. 1 wiersz — najmniejszy sensowny rozmiar),
`minResizeWidth="140dp"`, `minHeight` domyślne obniżone do 140dp, `targetCellHeight` 3→2.
Przy okazji: outer padding 12dp→10dp, nagłówek 11sp→10sp, wiersze 4dp→3dp pionowego paddingu —
ogólnie bardziej kompaktowy domyślny wygląd, nie tylko wyższy limit resize.

**(2) Przezroczyste tło — nowy ekran configu**: dodany `TasksWidgetConfigActivity.kt` (natywny
Kotlin, zero JS/RN — zwykła `Activity` z przełącznikiem `Switch`), wpięty jako
`android:configure` w `tasks_widget_info.xml` + `<activity>` w manifeście z intent-filterem
`APPWIDGET_CONFIGURE` (`exported="true"` — WYMAGANE, launcher/widget-host to inny proces/UID,
bez tego nie mógłby go odpalić). Ustawienie trzymane per `appWidgetId` w
`SharedPreferences("TasksWidgetPrefs")`, czyszczone w nowym `onDeleted()` override (żeby nie
zostawiać martwych kluczy po usunięciu widgetu). `TasksWidgetProvider` przebudowany z
"jeden `RemoteViews` dla wszystkich instancji" na `updateOne(context, appWidgetId)` per-instancja
(`buildViews` czyta teraz `appWidgetId`-specyficzny wpis prefs) — `updateAll()`/`onUpdate()`
oba pętlą się i wołają `updateOne()`, `TasksWidgetConfigActivity` woła je też po zapisaniu.
Przezroczystość realizowana `views.setInt(R.id.widget_root, "setBackgroundColor", Color.
TRANSPARENT)` (reflection-safe RemoteViews call, nadpisuje drawable z XML) vs
`"setBackgroundResource", R.drawable.widget_bg` gdy wyłączone.

**Ograniczenie kontraktu Androida (ważne, powiedziane userowi wprost)**: `android:configure`
odpala się TYLKO przy DODAWANIU widgetu (bind), nie da się go inaczej ponownie otworzyć dla
już umieszczonej instancji. Widget z buildu #1045 (już na pulpicie usera) NIE dostanie configu
retroaktywnie — user musi go usunąć i dodać ponownie, żeby zobaczyć ekran ustawień. Sam resize
(mniejszy rozmiar) działa na już umieszczonym widgecie bez re-dodawania — to inna, niezależna
mechanika (`minResizeWidth/Height`, czytane przy każdym przeciągnięciu uchwytu).

**Weryfikacja**: pełny `expo prebuild` uruchomiony ponownie po zmianach — przeszedł czysto za
pierwszym razem (manifest/`<activity>`/`configure`-atrybut/nowy layout wszystko poprawnie
wygenerowane, zweryfikowane ręcznie + `xmllint`). `tsc`/`jest` bez zmiany (1085 testów — czysto
natywna zmiana, JS-owa strona nietknięta). Prawdziwa kompilacja Kotlina znowu tylko w
`build.yml` po merge'u (jak w §165).

**Priorytet testu na urządzeniu — wysoki, wymaga NOWEGO APK + usunięcia i ponownego dodania
widgetu** (żeby zobaczyć ekran configu — patrz ograniczenie wyżej): sprawdź że widget daje się
skurczyć niżej niż poprzednio, że po dodaniu pokazuje się ekran "Widget — Zadania" z
przełącznikiem, że włączenie przezroczystości faktycznie usuwa ciemne tło (widać tapetę pod
spodem), i że reszta (dane/tap/kolory) nadal działa jak wcześniej.

---

## 167. Plan zajęć — dashboardowy kafelek na fioletowo + ekran dzień/tydzień/miesiąc zamiast samej siatki tygodnia (2026-09-23)

User: "plan zajęć musi być bardziej widocznym kafelkiem z odróżnieniem zajęć... tam zrobiłeś
przesuwaną listę, dajmy stabilną, domyślnie dzienna i można włączyć widok tygodniowy i
miesięczny". Dwie osobne zmiany na bazie tego zgłoszenia.

**Kafelek dashboardu (`ClassScheduleCard.tsx`)** — ginął wśród innych neutralnych kart (biały
tekst/szara ikonka jak wszystkie inne). Fioletowy akcent (`#A78BFA`) już był marką tej funkcji
(typ W, `dayColToday` w widoku tygodnia) — teraz też na samym kafelku: lewy pasek + delikatny
wash tła (`#A78BFA14`) + fioletowy border/ikonka/tytuł. TEN SAM przepis co kolor rodzaju na
kartach zadań (§164) — inny akcent koloru, nie neutralne chrome. Przy okazji usunięty martwy
prop `cardBg` (kafelek już nie bierze koloru tła z zewnątrz, ma własny stały fioletowy wash).

**Ekran `/class-schedule` — przebudowa z "tylko siatka tygodnia" na 3 tryby**: poprzednia
wersja (§161) miała WYŁĄCZNIE poziomy `ScrollView` z 7 kolumnami dni (swipe/przesuwanie). User
chciał to zastąpić spokojniejszym domyślnym widokiem + możliwością włączenia szerszych. Nowe:
- **Dzień (domyślny)** — jedna kolumna na całą szerokość ekranu (dużo więcej miejsca niż
  148px kolumna tygodnia), pionowa lista zajęć tego dnia.
- **Tydzień** — PIONOWE sekcje dni (Pon→Nie, jedna pod drugą, zwykły scroll w dół) zamiast
  poziomego swipe'a — to jest "stabilna" z prośby usera: nawigacja strzałkami/tapem, nie
  gestem który trzeba było odkryć.
- **Miesiąc (nowy)** — siatka kalendarza (`monthGrid()` z `weekGrid.ts`, 5 lub 6 pełnych
  tygodni Pon-Nie z doklejonymi dniami sąsiednich miesięcy wyszarzonymi), kropka pod dniami z
  zajęciami, tap dnia → przeskakuje do widoku Dzień na tej dacie.

Trzy taby (segmented control, fioletowy akcent na aktywnym) nad wspólnym paskiem nawigacji
(strzałki + tap-by-wrócić-do-dziś, jak wcześniej). JEDEN wspólny `selectedDate` jako kotwica
dla wszystkich trybów (nie osobne offsety per tryb) — przełączenie trybu NIE resetuje pozycji
(oglądasz dzień X, włączasz "Tydzień", widzisz tydzień zawierający X). `eventsByDate`
(`Map<YMD, CalendarEvent[]>`) zbudowana RAZ, reużywana przez wszystkie 3 tryby zamiast
filtrować `gcalEvents` osobno w każdym. `renderEventRow()` reużyty między widokiem dnia i
tygodnia (ten sam wygląd wiersza, DRY).

**`src/utils/weekGrid.ts` rozszerzony** (ten sam powód testowalności co §161 — matematyka dat
poza plikiem importującym `react-native`): `addDays()`, `fmtDayLabel()` ("Środa, 23 września" —
DOPEŁNIACZ miesiąca, inna odmiana niż `fmtMonthLabel()`'s mianownik "Wrzesień 2026" — polski
nie ma jednej wspólnej formy), `monthGrid()` (siatka kalendarza, zaczyna/kończy na pełnych
tygodniach Pon-Nie, `inMonth: false` dla dni doklejonych z sąsiednich miesięcy).

**Testy**: `__tests__/weekGrid.test.ts` +9 — w tym miesiąc wymagający 5 tygodni (wrzesień 2026)
i miesiąc wymagający 6 (listopad 2026, bo 1. wypada w niedzielę — brzegowy przypadek gdzie
siatka jest największa). `tsc`/`jest` czyste (1094 testy, +9).

**Priorytet testu na urządzeniu — wysoki**: to bezpośrednia realizacja zgłoszenia — sprawdź
wszystkie 3 taby, nawigację strzałkami w każdym trybie, tap dnia w widoku miesiąca (czy
przeskakuje poprawnie do Dzień), i czy kafelek na dashboardzie faktycznie wyróżnia się teraz
kolorem na tle reszty.

---

## 168. Fix: skanowanie paragonu mogło dodać ten sam paragon kilka razy pod rząd (2026-09-23)

User: zrzut ekranu z CZTEREMA identycznymi wpisami "Lidl · 8 produktów · -62.72 zł" tego
samego dnia. "znowu sie kopiują... z powiadomienia musi sprawdzać czy taki dodał przecież już".

**Przyczyna** — NIE bank-notification pipeline (ten ma już dedup, `commitBankTx.ts` sprawdza
`already`/`findMatchingExpense` przed dodaniem, a bank-owe wpisy i tak nigdy nie mają
`receiptItems` — te 4 wpisy MIAŁY po 8 produktów, więc każdy pochodził z ekranu skanowania
paragonu, `app/expenses/scan.tsx`). `saveSelected()` w gałęzi "nie dołączaj do istniejącej
płatności" ZAWSZE tworzyło nowy `Expense` z `receiptItems` — zero sprawdzenia czy identyczny
paragon już nie istnieje. Ten ekran ma UDOKUMENTOWANĄ historię zawieszania się w trakcie
zapisu (stąd cały `scanBreadcrumb.ts` — marker "zapis w toku", czytany po restarcie apki, żeby
zamienić niewidoczne zawieszenie w coś zgłaszalnego). Przycisk "Zapisz" blokuje się dopiero
PO re-renderze (`disabled={saving || ...}`) — jeśli wątek JS akurat przycinał (to samo
zjawisko co ta udokumentowana historia zawieszeń), kilka tapnięć w pozornie martwy ekran mogło
przejść ZANIM `disabled` zdążyło zadziałać, każde tworząc osobny, pełny paragon.

**Fix**: nowy guard w `saveSelected()` (gałąź "nie dołączaj") — przed dodaniem nowego paragonu
sprawdź czy w `useExpensesStore` już istnieje wpis z `receiptItems`, tą samą kwotą (±0.011),
tym samym dniem, tym samym sklepem, utworzony w ciągu OSTATNICH 3 MINUT. Jeśli tak — traktuj
jako przypadkowy duplikat (toast "Ten paragon już dodałeś przed chwilą — pomijam duplikat"),
NIE dodawaj kolejnego. Świadomie WĄSKIE okno czasowe (3 min) — nie blokuje dwóch prawdziwych,
niezależnych zakupów w tym samym sklepie tego samego dnia (rzadkie, ale możliwe), tylko łapie
szybkie powtórzone zapisy tej samej sesji skanowania. Gałąź "dołącz do istniejącej płatności"
(`attachToId`) nie wymaga analogicznej poprawki — ona AKTUALIZUJE istniejący wpis
(`updateExpense`), więc powtórny zapis nadpisuje te same dane, nie duplikuje.

**UWAGA — cztery istniejące duplikaty w danych usera NIE zostały automatycznie usunięte**
(brak bezpośredniego dostępu do jego danych z tej sesji) — trzeba je ręcznie skasować przez
ekran szczegółów wydatku (§113: `app/expenses/[id].tsx`, usuń 3 z 4 identycznych wpisów
Lidl). Fix zapobiega TYLKO przyszłym powtórkom.

**Testy**: brak nowych (logika dopasowania w tym pliku od zawsze inline, nie wydzielona do
`bankNotification.ts` — ten sam poziom złożoności co sąsiedni istniejący kod reverse-merge w
tej samej funkcji, który też nie jest wydzielony; wydzielanie tylko TEJ jednej funkcji
byłoby niespójne). `tsc`/`jest` czyste (1094 testy, bez zmiany).

**Priorytet testu na urządzeniu — wysoki**: to bezpośrednia odpowiedź na zgłoszony bug —
spróbuj kilka razy szybko tapnąć "Zapisz" przy skanowaniu paragonu i sprawdź czy pojawia się
tylko JEDEN wpis + toast o pominiętym duplikacie przy kolejnych tapnięciach.

---

## 169. Dwie korekty po pierwszym realnym teście: widget przestał się dodawać + zły kolor tasków (2026-09-23)

User przetestował wczorajsze zmiany i zgłosił dwa realne problemy.

**(1) Widget przestał się dawać dodać na pulpit** — regresja z §166 (ekran configu z
przełącznikiem przezroczystości). Android WYMAGA, żeby `android:configure`-Activity zwróciła
`RESULT_OK` zanim W OGÓLE dokończy dodawanie widgetu — jeśli user nie tapnął jawnie "Zapisz"
(np. spodziewając się, że widget po prostu się pojawi jak wcześniej, zanim doszedł ekran
configu), Android po cichu ANULOWAŁ całe dodanie. **Fix**: `TasksWidgetConfigActivity.kt` i
cały mechanizm `android:configure` USUNIĘTE — przezroczystość teraz zwykły przełącznik w
Ustawieniach (`app/settings.tsx`, nowa sekcja "Widget pulpitu — Zadania"), który NICZEGO nie
gate'uje. Zmiana architektury: ustawienie przezroczystości z per-`appWidgetId` (SharedPreferences
kluczowane po id instancji) na JEDNĄ GLOBALNĄ wartość (`TasksWidgetProvider.PREF_TRANSPARENT`,
bez sufiksu) — prostsze, i tak w praktyce jedna instancja widgetu na urządzenie. Nowy
`TasksWidgetModule.setTransparent(Boolean)` (JS→natywny most) pisze do SharedPreferences +
budzi `updateAll()`. Nowy `src/store/widgetSettingsStore.ts` (JS-side tylko do pokazania stanu
przełącznika w UI — prawda leży w natywnym SharedPreferences). `onDeleted()`
per-instance-cleanup w providerze też usunięty (nic już nie ma do sprzątania per-id).

**(2) Zły kolor kart zadań** — user po zobaczeniu §164 (kolor wg RODZAJU: quick=zielony/
deep=niebieski/waiting=bursztyn): "Zadania nadal mają zielony kolor, powinny być raczej
zrobione pod neutralny a kolor być znaczeniem TERMINOWOŚCI (czy aktualnie jest — NIEBIESKI
kafelek cały | czy zaległe — CZERWONY | czy odłożone na później — CIEMNY)". Całkowite
cofnięcie osi koloru z §164 na inną: **zaległe** (bez zmian, było już wcześniej) = czerwony;
**"aktualnie"** (termin dziś LUB w toku pomodoro) = NIEBIESKI (`#6C9EFF`, ten sam co
`KIND_META.deep` — reużyty, nie nowy kolor), CAŁY kafelek (pasek+wash+border), bez gradacji
priorytetem (user chciał jeden spójny niebieski, nie warianty mocy); **wszystko inne**
(jutro/tydzień/później/bez terminu) = zwykły ciemny/neutralny, ZERO akcentu. Ikonka rodzaju
(Zap/Target/Hourglass) ZOSTAJE jako czysto informacyjny kształt, ale przemalowana na
neutralny szary — kolor rodzaju już nigdzie nie steruje wyglądem KARTY (wciąż steruje
nagłówkami sekcji widoku "wg rodzaju" i podglądem chipa przy szybkim dodawaniu — TE miejsca
mają sens kolorowane wg rodzaju, bo ich JEDYNY cel to pokazać rodzaj). Martwe pole `G.green`
(już niewykorzystywane po tej zmianie) usunięte z obu palet w pliku.

**Testy**: brak nowych (oba czysto wizualne/natywne poprawki). `tsc`/`jest` czyste (1094
testy, bez zmiany). `expo prebuild` uruchomiony ponownie po usunięciu configu — potwierdzone
że `TasksWidgetConfigActivity`/`tasks_widget_config.xml`/atrybut `configure` całkowicie znikły
z wygenerowanego projektu.

**Priorytet testu na urządzeniu — wysoki, wymaga NOWEGO APK**: (1) spróbuj dodać widget na
pulpit — powinien pojawić się od razu, bez żadnego ekranu pośredniego; sprawdź przełącznik
przezroczystości w Ustawieniach osobno. (2) sprawdź kartę zadania z terminem dziś (niebieska
cała) vs jutro/później (neutralna) vs zaległe (czerwona) vs w toku pomodoro (niebieska).

---

## 170. Redesign widgetów Liczników: gruby pasek-donacja + duża kolorowana liczba (2026-09-23)

User (item #13 z batcha feedbacku): "Musimy ulepszyć LICZNIKI... jak odliczanie do, to od
dzisiaj wypełnia się pasek... gruby napis w pasku wypełniając się jak donate na Twitch...
ikonki wywalamy... A ile dni temu musi być liczba jak na streak ale nie w kafelku tylko
jakąś ciekawszą — sama liczba gruba... w barwie im więcej dni jak w streaku." Delegowany
kierunek kreatywny ("Nie wiem, wymyślisz coś").

**"Odliczania" (`kind: 'until'`) — nowy `src/components/counters/DonationBar.tsx`** zastąpił
usunięty `WalkProgress.tsx` (cienki 10px pasek + chodzik/samochodzik/emoji skaczące nad nim,
3 miejsca użycia). Gruby pasek (domyślnie 44px), tekst BIAŁY+cień ZAWSZE na wierzchu (ten sam
trik czytelności co liczba na `StreakFlame`), animowane wypełnienie `Animated.timing`. Brak
figurki/emoji jadącej po pasku — cały ruch niesie sam pasek, styl celu-donacji na Twitch.
Nowe pola na `Counter` (`countersStore.ts`): `barColor?: string` (wybór z tej samej palety
`BAR_COLORS` co swatche w `items.tsx`) i `fillStyle?: 'smooth' | 'stepped'` (domyślnie
`smooth` = `untilProgress()` płynie co renderowanie; `stepped` = nowa `untilProgressStepped()`
zaokrągla w dół do granicy pełnego dnia, więc pasek skacze RAZ dziennie o północy zamiast
płynąć — testy w `__tests__/countersStore.test.ts`). Pole `emoji` na `Counter` zostaje jako
LEGACY (stare liczniki mogą je jeszcze mieć w AsyncStorage, `DonationBar` go po prostu nie
rysuje; `counters/[id].tsx`'s nagłówek nadal je czyta dla wstecznej kompatybilności starych
wpisów). Podpięte we WSZYSTKICH 3 miejscach (żeby nie zostawić dead-enda — zasada #7 z
CLAUDE.md): `CountdownsCard.tsx` (widget dashboardu), `app/counters.tsx` (pełna lista +
formularz dodawania/edycji — sekcja "Ikonka na pasku" zastąpiona wyborem koloru + przełącznikiem
płynnie/co dzień), `app/counters/[id].tsx` (ekran szczegółów).

**"Ile dni temu" (`kind: 'since'`) — `SinceCountersCard.tsx`** (widget dashboardu): kwadratowa
siatka kafelków (`sinceGrid`/`sinceTile`, 31.5% szerokości, mała liczba w środku) zastąpiona
pionową listą wierszy — każdy z chipem-płomieniem (16px `Flame`, kolorowany przez
`streakTier(days).color`, ten sam system eskalacji co `StreakFlame`/`StreakCard`) + nazwą +
DUŻĄ pogrubioną liczbą dni (`fontFamily: fonts.display, fontSize: 22`, kolorowaną tym samym
tierem). NAJDŁUŻSZY licznik nadal dostaje bogatą `StreakCard` (płomień + pasek tygodnia/
miesiąca/półrocza) bez zmian — user to explicite pochwalił wcześniej ("Panel na dashboardzie
spoko"). Pełna lista w `app/counters.tsx`'s sekcji "Ile dni temu" NIE była w kafelkach (już
pełnej szerokości karty z `StreakFlame`+`WeekStrip`) — zostawiona bez zmian, adresowany
problem dotyczył wyłącznie widgetu dashboardu.

**Testy**: 5 nowych w `__tests__/countersStore.test.ts` dla `untilProgressStepped()` (start=0,
płaskie w trakcie dnia, skok dokładnie o północy, meta=1, start=cel tego samego dnia →
od razu 1 bez dzielenia przez zero). `tsc --noEmit` czyste, pełny `jest` czysty (1099 testów).

**Priorytet testu na urządzeniu — średni**: sprawdź nowy pasek-donację na widgecie dashboardu
i na `/counters` (płynnie vs co dzień, wybór koloru w formularzu), oraz nową listę "ile dni
temu" na dashboardzie (kolor eskalujący z dniami, jak flame na streaku).

---

## 171. Panel Praca: usunięte "cele"-skarbonki, zostają tylko stałe wydatki (2026-09-23)

User (item #11 z batcha feedbacku): "Panel na dashboardzie spoko ale bym z pracy wywalił
jednak te cele wszystkie i zostawił tylko STAŁE WYDATKI tam jakby i pokazywał ile zarobiłem
do stałych a ile powyżej." Sekcja "Skarbonki" w panelu Pracy (otwieranym z kafelka dashboardu)
dzieliła zarobek DO TERAZ po kolei na 3 "potrzeby" (stałe → jedzenie → zmienne, każda ze swoim
paskiem/celem) — user odebrał to jako 3 osobne "cele". Zredukowane do JEDNEJ karty: ile
zarobione vs ile trzeba na stałe (mieszkanie/prąd/internet, cel = średnia poprzednich
miesięcy jak wcześniej), plus zdanie "+X zł powyżej stałych wydatków" gdy zarobek przekracza
cel. `workBudgetProgress()` (zwracał `BudgetBucket[]`, 3 elementy) zastąpiony przez
`workFixedProgress()` w `fixedVariable.ts` — zwraca JEDEN obiekt `{ target, filled, pct,
above }` zamiast tablicy, bo nie ma już po co iterować po kubełkach. Sekcje "Zaplanowane
naprzód"/"Stawka"/"Godziny — ostatnie 6 miesięcy"/"W liczbach"/"Wypłaty" w tym samym panelu
BEZ zmian — user je explicite pochwalił ("Panel na dashboardzie spoko"), adresowana wyłącznie
sekcja skarbonek. Kolejna rozbudowa panelu Pracy o nowe widgety ("brakuje mi czegoś w tej
zakładce PRACA... do pomyślenia jeszcze") zostaje otwartym pytaniem do usera — konkretnych
pomysłów jeszcze nie było.

**Testy**: `__tests__/fixedVariable.test.ts`'s `workBudgetProgress` describe-block przepisany
na `workFixedProgress` (4 testy: cel+filled+above z historią, zarobek poniżej celu, zarobek
pokrywający wszystko, brak historii). `tsc --noEmit` czyste, pełny `jest` czysty (1100 testów).

**Priorytet testu na urządzeniu — niski**: otwórz panel Pracy (tap kafelka na dashboardzie) i
sprawdź nową kartę "Zarobek do teraz vs stałe wydatki" — jeden pasek + ew. zdanie o nadwyżce
zamiast dawnych 3 skarbonek.

---

## 172. Ekwipunek: ostatnie emotki monet wywalone, item'y i sloty większe (2026-09-23)

User (item #5 z batcha feedbacku): "Sloty spoko tylko ekwipunek ma EMOTKI które chciałem
wywalić i przy okazji trochę go zmienić że lepiej się pokazują te rzeczy... możemy zrobić to
eq większe ogólniej bardziej czytelne czy coś." Sloty (`SLOT_ICON`) już nie miały emotek od
§154-ish (2026-09-18, patrz istniejący komentarz w pliku) — zostały TYLKO monetowe "🪙" w
tekstach `GearPanel.tsx` (przyciski sprzedaży, licznik "sprzedaj wszystkie", stepper ilości,
3 toasty po sprzedaży). Zamienione na `<Coins size={11} color="#FBBF24" />` (ten sam
komponent+kolor co reszta apki, np. `pet.tsx`) wszędzie gdzie renderuje się jako JSX (przyciski
sprzedaży, "Otrzymasz: N" w stepperze); w 3 stringach `toast.success(...)` (plain-text, nie da
się osadzić ikonki) zamienione na słowo "monet" — ten sam zwrot co już istniejące
`ConfirmDialog` w tym pliku ("otrzymasz X monet"), więc spójne wewnątrz ekranu. Rozmiary
podniesione dla czytelności: sloty ekwipunku 62→70px (grafika 44→52px), miniaturki itemów w
liście 44→56px, nazwa itemu 13.5→15px, padding karty grupy itemu spacing[3]→spacing[4].

**Wciąż otwarte**: user chciał też "łatwiej sprzedawać" jako szerszy cel — na razie tylko
rozmiar/czytelność, bez zmiany samego flow sprzedaży (grupowanie/bulk-sell/qty-picker już
istniały i zostają). Jeśli user chce więcej (np. przeprojektowanie samego flow), wróci z
konkretami po zobaczeniu tej wersji.

**Testy**: brak nowych (czysto wizualna zmiana, bez logiki). `tsc --noEmit` czyste, `jest`
czysty (1100 testów, bez zmiany).

**Priorytet testu na urządzeniu — niski**: otwórz Ekwipunek z ekranu pupila, sprawdź że nigdzie
nie ma już "🪙" (ikonka monety zamiast), i że itemy/sloty są wyraźnie większe niż wcześniej.

---

## 173. Edytor układu walki: znaleziony i naprawiony realny "nie 1:1" bug (2026-09-23)

User (item #7 z batcha feedbacku): "tutaj nie wiem jakby się nic nie zmieniło bo ten edytor
dziwny i chyba nie jeden do jeden." Bez nowych bossów/plików od usera — to akurat dało się
zdiagnozować z samego kodu, więc zrobione od razu (nie czekało na #7's drugą część, nowe
custom bossy, którą wciąż czeka).

Znalezione DWA realne, mierzalne rozjechania między `app/battle-layout-lab.tsx` (edytor) i
`app/boss-fight.tsx` (realna arena), oba geometrii, nie tylko "wygląda inaczej":

1. **Wysokość kolumny portretu** — edytor miał `tilePortrait: { height: 200 }` na sztywno;
   realna arena liczy `TILE_PORTRAIT_HEIGHT = Math.max(PORTRAIT_SIZE, CAT_PORTRAIT_SIZE) + 18`
   (=223 przy domyślnych 150/205). Skoro oba boksy centrują zawartość (`justifyContent:
   'center'`), 23px różnicy wysokości przesuwało PIONOWY ŚRODEK (punkt zerowy dla offsetu Y)
   o ~11px między edytorem a realną walką — pozycja wytunowana w edytorze nie lądowała 1:1 w
   grze. Fix: `portraitColHeight = Math.max(draft.catSize, draft.bossSize) + 18`, liczone
   dynamicznie z aktualnych rozmiarów draftu, tak jak robi to realna arena.
2. **Nadmiarowy `paddingBottom`** — edytorowy `vsRow` miał własny `paddingBottom: spacing[4]`
   (16px) na wierzchu `paddingHorizontal: spacing[3]`; realna arena ma TYLKO jednolite
   `padding: spacing[3]` (12px) na wrapperze `arena`, bez dodatkowego bottom. Fix: zrównane do
   `spacing[3]` (12px) po obu stronach.

**Root cause DRUGIEGO, poważniejszego zjawiska** (nie geometria, tylko "stare liczby") —
`BATTLE_LAYOUT_DEFAULT` (w `battleLayoutDraftStore.ts`) bywa ręcznie synchronizowany z realnymi
stałymi w `boss-fight.tsx` po każdym eksporcie (ostatnio 09-18/09-20), ale zustand `persist`
NIE nadpisuje samo z siebie już zapisanego na urządzeniu drafta nowym defaultem — jedynym
ratunkiem był user PAMIĘTAJĄCY, żeby ręcznie wcisnąć "Reset" (stary komentarz w kodzie to nawet
instruował, ale nikt o tym nie pamięta w praktyce). Efekt: Edytor mógł cicho pokazywać STARE
liczby z poprzedniego eksportu, sam sobie przecząc jako "podgląd 1:1" — dokładnie ten sam objaw
co zgłoszenie usera, i już RAZ udokumentowany w komentarzu 09-20 jako powracający problem. Fix:
`PERSIST_VERSION` + `migrate` w zustand `persist` — gdy `BATTLE_LAYOUT_DEFAULT` się zmienia,
`PERSIST_VERSION` musi teraz rosnąć razem z nim (komentarz nad stałą to teraz jawnie
przypomina), a `migrate()` wtedy AUTOMATYCZNIE porzuca przeterminowany persisted draft i
startuje od świeżego defaultu — zero polegania na pamięci usera.

**Testy**: brak nowych (mockowanie zustand `persist`+AsyncStorage dla `migrate` byłoby
nieproporcjonalnie ciężkie względem prostoty fixu; poprawność `migrate: () => ({ draft:
BATTLE_LAYOUT_DEFAULT })` czytelna wprost z kodu). `tsc --noEmit` czyste, `jest` czysty (1100
testów, bez zmiany).

**Priorytet testu na urządzeniu — średni**: otwórz Edytor układu walki (`/battle-layout-lab`),
wciśnij Reset, sprawdź że pozycja pupila/bossa/pasków HP wygląda TAK SAMO jak w realnej walce z
tym samym bossem. Druga część #7 (nowe custom bossy, zamiast starych z neta) wciąż czeka na
przesłanie plików przez usera — patrz NEXT_STEPS.md.

---

## 174. Woda: znaleziony DRUGI wyścig (health.tsx) + diagnostyka per-rekordowa + w Ustawieniach (2026-09-23)

User (item #14): "Możliwe że źle łapie wodę z zegarka... możesz mi dać gdzie w ustawieniach
dosłownie co łapie kiedy i ile ml? Żebym potwierdził, bo zaznaczam który raz mam tak, że
wypiłem 8 szklanek a pokazuje mniej." Dwie osobne prace, obie dały się zrobić z samego kodu:

**(1) Znaleziony DRUGI, nienaprawiony wyścig wody — dokładnie ten sam objaw co #7's cousin
z 09-22.** `useWaterTracker.ts` (hook) dostał wtedy fix: `persist()` bierze `Math.max(fresh-z-
magazynu, lokalny)` zamiast ślepo nadpisywać, bo Health Connect w tle (`autoSyncHealth` →
`feedWaterHabit`) może zapisać WYŻSZĄ wartość z zegarka DOKŁADNIE w oknie debounce'u. Ale
`app/(tabs)/health.tsx` ma WŁASNĄ, CAŁKOWICIE OSOBNĄ implementację licznika wody
(`persistWater`/`loadWater`/`waterRef`/`bumpWater`) — 09-22 jej nie dotknął, bo hook i ekran
Zdrowie to dwa niezależne, zdublowane byty czytające/piszące ten sam `habits_cnt_YYYY-MM-DD`.
Health.tsx miał TEN SAM bug w DWÓCH miejscach: `persistWater()` robił goły `counts[id] =
waterRef.current` (fix: `Math.max` jak w hooku), a `loadWater()` NIE MIAŁA guardu „nie
przeładowuj gdy wisi odroczony zapis" (fix: `if (waterPersistTimer.current) return;`, ten sam
wzorzec co hook). To bardzo prawdopodobnie REALNA przyczyna zgłoszenia usera — Zdrowie to
ekran, na którym faktycznie taponuje szklanki.

**(2) Diagnostyka wody rozszerzona o listę per-rekordową + druga lokalizacja w Ustawieniach.**
Istniejący `probeHydration()` (healthConnectService.ts) liczył dotąd TYLKO sumę za 7 dni —
nie dało się zweryfikować POJEDYNCZYCH wpisów. `WaterProbe` dostał nowe pole `entries:
{time, ml, source}[]` (per-rekord, najnowsze pierwsze). Formatowanie werdyktu wydzielone do
`formatWaterDiagnostic()` (współdzielone, nie duplikowane) — teraz dopisuje listę "kiedy — ile
ml (źródło)" (do 20 wpisów + licznik reszty). Przycisk "Diagnostyka wody z zegarka" ISTNIAŁ
już wcześniej, ale TYLKO wewnątrz sheeta edycji rozmiaru kubka na zakładce Zdrowie — user
szukał go w Ustawieniach i nie znalazł. Dodany DRUGI punkt wejścia: Ustawienia → Diagnostyka →
"Diagnostyka wody z zegarka" (ten sam `probeHydration`+`formatWaterDiagnostic`, zero
duplikacji logiki).

**Testy**: 5 nowych w `__tests__/waterDiagnostic.test.ts` dla `formatWaterDiagnostic()` (pure
function, testowalna bez mockowania natywnego Health Connect) — rekordy obecne+lista wpisów,
Nutrition-fallback, brak dostępu, zero rekordów wszędzie, ucinanie listy do 20+licznik. `tsc
--noEmit` czyste, pełny `jest` czysty (1105 testów, +5).

**Priorytet testu na urządzeniu — wysoki**: (1) sprawdź `Ustawienia → Diagnostyka →
Diagnostyka wody z zegarka` istnieje i pokazuje listę wpisów kiedy/ile ml; (2) na Zdrowie
taponuj szklanki szybko kilka razy pod rząd, poczekaj na sync z zegarka w tle, sprawdź że
liczba się NIE cofa.

---

## 175. Trzy nowe custom bossy podpięte + kaczka wywalona z rotacji questowej (2026-09-23)

User (druga część item #7): "Wysłałem 3 nowe... 2 do kampanii pod zmianę tych starych, i
jeden pod quest, możesz wywalić kaczkę czy coś." User wypchnął 3 pliki bezpośrednio do
`assets/bossy/` (commity `c3ab853`/`9e43d19`, poza tą sesją) — podpięcie do rosteru zrobione
teraz, w całości z samego kodu, bez dalszych pytań.

**Kampania — 2 nowe grafiki, WYBÓR którego bossa podmienić zrobiony przez dopasowanie
tematyczne** (user nie sprecyzował którego z 22, więc dopasowane po NAZWIE/koncepcie, nie po
kolejności): `BOSS_DYMNYNIEDZWIEDZ.png` (niedźwiedź z dymu/pustki, pazury) →
**`burnout`/"Pustka Wypalenia"** (dosłowne dopasowanie: bestia zrobiona z pustki/dymu =
koncept wypalenia), `BOSS_MROCZNYKRUK.png` (widmowy kruk, szpony) →
**`doubt`/"Cień Zwątpienia"** (kruk = klasyczny symbol złego omenu/wątpliwości, "Cień" już
pasuje). Oba dostały `attackKind: 'claw'` (wyraźne pazury/szpony w nowym arcie — `doubt` je
już miał, `burnout` wcześniej był bez `attackKind`, teraz jawnie). Dawne pożyczone pliki
(`BOSS_reaperatack_reaper.png`/`BOSS_pazurattack_cerberus.png`) zostają na dysku nieużywane —
ten sam wzorzec co pozostałe "martwe" pliki w folderze (żadne id już ich nie czyta, ale nic
nie kasujemy na wypadek przyszłego użycia).

**Quest — nowy `mb_ropucha`/"Ropucha Bagna"** (`MINIBOSS_ROPUCHA.png`), zastąpił USUNIĘTY
`mb_duck`/"Kaczka Kałuży" (user: "możesz wywalić kaczkę") w `minibosses.ts`. Bez dedykowanego
tła lokacji jeszcze — spada na `DEFAULT_ARENA_BG`, dokładnie jak `mb_grizzly` dziś, nic się
nie psuje (ten sam fallback-chain co reszta rosteru). `mb_duck`'s stare id nie było czytane
NIGDZIE indziej w kodzie (żadnego stanu/postępu keyowanego po nim) — usunięcie w pełni
bezpieczne, `minibossForQuest`'s deterministyczny hash po prostu wybiera z 10 wpisów zamiast
poprzednich 10 (ta sama długość tablicy, inny skład).

**Rozmiar plików** — źródłowe pliki od usera to 1536×1024/~1.9-2MB każdy (surowy eksport z
generatora obrazów), znacznie ponad próg reszty folderu `bossy/`. Przeskalowane (Pillow
LANCZOS, alfa RGBA zachowana) do 600×400/~280-300KB — DOKŁADNIE ten sam próg co
`MBOSS_LODOWYKROLIK.png` (§94, ustalony wcześniej jako standard dla tego folderu), żeby nie
napompować APK ~6MB trzema nowymi plikami.

**Testy**: brak nowych (czyste podpięcie assetów przez istniejący `bossPng(id)`
lookup-by-id — ten sam mechanizm co cała reszta rosteru, zero nowej logiki do przetestowania).
`tsc --noEmit` czyste, `jest` czysty (1105 testów, bez zmiany).

**Priorytet testu na urządzeniu — wysoki**: (1) pokonaj/zobacz bossa "Pustka Wypalenia"
(poziom 22+) i "Cień Zwątpienia" (poziom 46+) w kampanii — sprawdź czy nowy art się pokazuje;
(2) zrób kilka questów dziennych, sprawdź czy "Ropucha Bagna" pojawia się w rotacji zamiast
kaczki. Jeśli user chciał INNYCH 2 bossów kampanii podmienionych (dopasowanie zrobione bez
jego potwierdzenia) — łatwo zmienić, to tylko 2 linie w `bossIcons.ts`.

---

## 176. Liczniki runda 2: pierścień zamiast paska + poświata zamiast kafelka (2026-09-24)

User po zobaczeniu §170's DonationBar/rows na żywo: "te liczniki zjebałeś, wygląda ten pasek
na za gruby, tanio wgle bez sensu, tak samo... ten stary chujowy look, przerób ten kafelek na
highend, posiedz nad tym trochę, przemyśl całe to odliczanie, sprawdź opcje." Zamiast
zgadywać trzeci raz z rzędu — zamockowałem 3 kierunki dla "odliczań" i 2 dla "ile dni temu" w
osobnym Artifact (Design canvas, dark theme 1:1 z apki — kolory z `colors.ts`, Archivo
Black/Oswald z Google Fonts jako zamiennik bundlowanych TTF-ów). User wybrał **pierścień**
(odliczania) i **poświatę pod całym kafelkiem** (ile dni temu, z jedną poprawką: gradient miał
być pod CAŁYM wierszem, nie tylko za liczbą — poprawione w mockupie przed wdrożeniem).

**Odliczania — nowy `src/components/counters/RingCountdown.tsx`** zastąpił `DonationBar.tsx`
(usunięty — gruby pasek z tekstem wpisanym w środek, jedyny konsument). Kołowy progress
(react-native-svg `Circle` + `strokeDasharray`/`strokeDashoffset`, animowane przez
`Animated.timing` — `useNativeDriver: false`, bo `strokeDashoffset` nie jest transform/opacity,
ten sam kompromis co DonationBar miał dla `width`), liczba dni w środku (Archivo Black),
gradient na obwodzie (LinearGradient 65%→100% opacity tego samego koloru, nie wymyślony nowy
odcień). Podpięty we wszystkich 3 miejscach (żeby nie zostawić dead-enda): `CountdownsCard.tsx`
(widget dashboardu, wiersz: pierścień | nazwa+status+cel | —), `app/counters.tsx` (pełna
lista, wiersz: pierścień | nazwa+status+meta | edycja/usuń), `app/counters/[id].tsx` (ekran
szczegółów, większy pierścień 72px). Formularz dodawania/edycji: "Kolor paska"/"Wypełnianie
paska" → "Kolor pierścienia"/"Wypełnianie pierścienia" (sam mechanizm `barColor`/`fillStyle`
w `countersStore.ts` bez zmian — to wciąż te same pola, zmienia się tylko jak są
zwizualizowane).

**Ile dni temu — `SinceCountersCard.tsx` runda 2**: mała ikonka-chip płomienia zdjęta, liczba
dni jest teraz hero-elementem (30px Archivo Black) po lewej, z delikatną poświatą tierowego
koloru rozlaną z lewej strony CAŁEGO wiersza (reużyty `RadialGlow` z `battle-layout-lab.tsx` —
SVG radial-gradient trick, nie CSS/View, bo RN nie ma natywnego radial gradientu) zamiast
localised za samą liczbą. Meta zmieniona z gołej jednostki ("dni") na kontekstową informację
o progu (`"Pomarańcz · próg za N dni"`, z `streakTier().next`) — więcej sensu niż powtarzanie
oczywistego "dni" obok liczby, która i tak ma jednostkę w kontekście. Najdłuższy licznik nadal
dostaje bogatą `StreakCard` bez zmian (user to pochwalił wcześniej, nieadresowane).

**Testy**: brak nowych (czysto wizualna runda 2, logika `countersStore.ts`/`streakTiers.ts`
bez zmian — oba już przetestowane w §170/istniejących testach). `tsc --noEmit` czyste, `jest`
czysty (1105 testów, bez zmiany).

**Wzorzec do zapamiętania**: przy subiektywnej/wizualnej pracy z HISTORIĄ nietrafionych prób
na tym samym komponencie (2 nieudane rundy z rzędu) — zamockować kilka kierunków w Artifact
(Design canvas typu, dark theme + fonty 1:1 z apką) i dać userowi wybrać, zamiast zgadywać
kolejny raz "na ślepo" i ryzykować trzecią porażkę. User to docenił ("sprawdź opcje" było
dosłowną prośbą o to).

**Priorytet testu na urządzeniu — wysoki**: zobacz oba widgety na dashboardzie (Odliczania z
pierścieniami, Liczniki z poświatą), i `/counters` pełną listę z tymi samymi pierścieniami.

---

## 177. Boss-fight: zły kolor pigułki energii + myląca atrapa energii dla nemesis (2026-09-24)

User (zrzutem): "w pomiń walkę nie zużywa energii, przez co przy DEMON SŁODYCZY mogę w
nieskończoność walczyć... energia tam pokazuje się niebieska zamiast czerwonej." Zbadane —
"Pomiń walkę" jest bez winy (wynik walki jest w 100% rozstrzygnięty PRZED animacją, patrz
komentarz przy `skipFightRef`, skip tylko przyspiesza kosmetykę, §127-ish). Prawdziwa
przyczyna to DWA osobne, realne buggi w `app/boss-fight.tsx`:

**(1) Nielimitowane próby dla nemesis to ŚWIADOMY design, nie bug** — `petStore.ts`'s
`menaceAttack` komentarz: "bez energii... nielimitowane próby, jedynym hamulcem jest sama
skala HP" (lustrzane wobec raidu). Ale `target.energy` dla nemesis to SZTYWNA atrapa `1`
(`isMenace ? 1 : eventEnergy`) tylko po to, żeby przycisk WALCZ! nigdy się nie wygaszał —
`bosses.tsx` (lista bossów) już to rozumie i CAŁKOWICIE chowa pigułkę energii dla nemesis
("to już nie ma sensu jako ile mi zostało dziś", komentarz tam) — ale `boss-fight.tsx` (ekran
samej walki) tej atrapy NIE chował, pokazując fałszywe "1", które user zasadnie odczytał jako
"bug: nie zużywa energii". Fix: zamiast kopiować ukrycie z listy (na ekranie walki zniknięcie
pigułki bez wyjaśnienia wyglądałoby na usterkę), pigułka dla nemesis pokazuje wprost "∞ prób".

**(2) Zły kolor pigułki dla raid/wydarzenie** — `bosses.tsx` ma ustalony kod kolorów: kampania/
MAD (`energy`) = niebieski `#38BDF8`, raid/wydarzenie (`eventEnergy`) = czerwony `#F87171`
(świadomy wybór, osobne pule). `boss-fight.tsx`'s dokowana pigułka energii miała kolor na
sztywno niebieski dla WSZYSTKICH trybów walki — raid i zwykłe (nie-nemesis) wydarzenie
pokazywały złą, niespójną z listą bossów barwę. Nowy `energyColor` liczony z `kind`/`isMenace`,
zastosowany do ikony/tekstu/tła/obwódki pigułki (ten sam wzorzec inline-override co
`bosses.tsx` już stosuje).

**Testy**: brak nowych (czysto wizualne/UI poprawki, logika `menaceAttack`/energii bez
zmian). `tsc --noEmit` czyste, `jest` czysty (1105 testów, bez zmiany).

**Priorytet testu na urządzeniu — średni**: otwórz walkę z Demon Słodyczy (nemesis) — pigułka
powinna pokazywać "∞ prób" na czerwono, nie fałszywe "1" na niebiesko. Otwórz walkę raid i
zwykłe wydarzenie sezonowe — pigułka energii powinna być czerwona, kampania/MAD nadal
niebieska.

---

## 178. Nemesis kosztuje TERAZ energię (cofnięty design z §177) + legendarne dropy x5 (2026-09-24)

User na §177's "∞ prób": "Czemu tam niby jest infinity, przecież ma zużywać energię jak
walczę xd" — jasne odrzucenie. §177 zdiagnozował "nielimitowane próby" jako ŚWIADOMY design
(2026-08-18) i naprawił tylko myślącą UI (fałszywe "1" → "∞ prób"). User chce coś innego:
prawdziwe zużycie energii, nie tylko czytelniejszą etykietę. Ten wpis COFA tę część designu.

**Co się zmieniło (`app/boss-fight.tsx`, `petStore.ts`, `bosses.tsx`)**:
- `target.energy` dla nemesis to już nie sztywna atrapa `1` — dzieli TERAZ prawdziwą
  `eventEnergy` z raid/wydarzeniem (`energy: eventEnergy`, bez `isMenace` rozgałęzienia).
- Bramka sprawdzania puli w `attackRoundBased()` nie ma już wyjątku dla `event && isMenace`
  — nemesis przechodzi ten sam check co raid/event.
- Win/loss spend-logic: obok `menaceAttack(...)` (który nadal śledzi TRWAŁĄ pulę HP bossa,
  bez zmian) wołane jest teraz też `spendEventEnergy()` — każda próba realnie kosztuje.
- Pigułka energii na ekranie walki: jeden, wspólny render (bez specjalnego przypadku dla
  nemesis) — pokazuje `target.energy` jak reszta trybów. `energyColor` też bez wyjątku
  `!isMenace` — nemesis czerwona jak reszta event/raid puli (inaczej po zmianie wyżej
  renderowałaby się błędnie na niebiesko, odtwarzając wariant tego samego bugu z §177).
- `bosses.tsx` (lista bossów): pigułka energii dla nemesis już nie jest chowana
  (`{!isMenace && ...}` zdjęte) — pokazuje prawdziwy stan `eventEnergy`, spójnie z ekranem
  walki. Przycisk WALCZ przygasza się też dla nemesis przy `eventEnergy <= 0` (dawniej
  wyjątek `!isMenace` to wykluczał).
- `petStore.ts`: komentarz przy `menaceEnsure`/`menaceAttack` zaktualizowany (dawny "bez
  energii... nielimitowane próby" był fałszywy po tej zmianie) — funkcja `menaceAttack`
  SAMA nie zmieniła logiki (nadal tylko odejmuje HP), zmienił się tylko WYWOŁUJĄCY w
  `boss-fight.tsx`, który teraz obok niej woła `spendEventEnergy()`.
- **Co ZOSTAJE bez zmian z designu 2026-08-18**: brak deadline'u (`eventDaysLeftN` = 0 dla
  menace nadal, nemesis nie ma "kończy się za X dni") i TRWAŁY bank HP (nie resetuje się
  między próbami, w przeciwieństwie do zwykłego wydarzenia).

**Legendarne dropy x5** (`src/utils/petBoxes.ts`, `LOOT_BOXES[].coins.jackpot`) — user
zrzutem (Sklep, box-reveal): "LEGENDARNA +30 monety" z ceną skrzynki 35 — dosłownie
potwierdzone: najrzadszy możliwy drop z najtańszej skrzynki wychodził NA MINUS względem
własnej ceny skrzynki. User: "legendarne dropy muszą byc op bo sa zupełnie rzadkie... dawaj
te dropy coin zwiększ tak o 5x". Zmienione WYŁĄCZNIE `jackpot` (nie `min`/`max`/`jackpotChance`,
nie `gearRarityWeight`) w `LOOT_BOXES` (płatne skrzynki Sklepu — dokładnie ten system, którego
dotyczył zrzut):
- sardine (koszt 35): 30 → 150
- iron (koszt 90): 90 → 450
- gold (koszt 200): 200 → 1000
- divine (koszt 450): 900 → 4500

Celowo NIE dotknięte: `DAILY_BOX` (darmowa, `petBoxes.ts`) i `crates.ts`'s `rollCrate()`
(darmowe "sardynki" petting-crate) — obie darmowe, poza zakresem skargi (która dotyczyła
konkretnie PŁATNEJ skrzynki Sklepu).

**Testy**: `tsc --noEmit` czyste, `jest` czysty (1105 testów, bez regresji — `petBoxes.test.ts`
i `menaceStats.test.ts` przeszły bez zmian w assercjach, bo nie asertują dokładnych wartości
jackpot/energii).

**Priorytet testu na urządzeniu — wysoki**: otwórz walkę z Demon Słodyczy (nemesis) — pigułka
energii powinna być czerwona i realnie SPADAĆ z każdą próbą (dzieli pulę z raid/wydarzeniem —
sprawdź, czy przy 0 energii przycisk WALCZ faktycznie się blokuje/przygasza). Otwórz kilka
skrzynek Sklepu (dowolny tier) i sprawdź, czy trafienie LEGENDARNEJ pokazuje nową, wyższą
kwotę monet (x5 względem starych wartości).

---

---

## 179. Cold-start diagnostyka: "0 próbek" to dowód zapchania wątku JS, nie braku lagu (2026-09-24)

User w końcu przesłał realny export z Ustawienia → Diagnostyka → "Wydajność startu apki"
(20 startów, 2026-09-14 do 2026-09-24, blokowane od §"Wciąż otwarte z batcha 12-punktowego").
Liczby: `1. klatka` 586-1680ms, `gotowy` 771-1967ms — ale **`lag JS max 0ms / suma 0ms (0
próbek)` przy WSZYSTKICH 20 startach, bez wyjątku**.

**To NIE znaczy "brak lagu"** — `startColdStartLagSampling()` (perfLog.ts) odpala co 50ms
`setTimeout` i mierzy, o ile się spóźnił. Przy oknie 600ms-1,9s powinno zdążyć się odpalić
kilkanaście-kilkadziesiąt próbek. Zero — przy KAŻDYM starcie — oznacza, że nawet WŁASNY timer
próbnika ani razu nie dostał szansy się odpalić: `setTimeout` (makrotask) czeka, aż stos
wywołań/kolejka mikrozadań się opróżni, więc "0 próbek" = wątek JS był NIEPRZERWANIE zajęty
przez całe okno startu. To dokładnie ten sam mechanizm co pierwotna skarga usera (2026-09-20):
"jak wchodzę i próbuję kliknąć to jest impossible" — dotyk w RN jest obsługiwany na TYM SAMYM
wątku JS, więc jeśli nawet 50ms timer nie ma szansy się wcisnąć, dotyki też nie mają.

**Root cause namierzony z kodu `app/_layout.tsx`** (bez zgadywania — sprawdzone, które efekty
faktycznie startują NATYCHMIAST, bez `setTimeout`): duże rzeczy (auto-backup, sync zdrowia,
bank, mood-sync) są już opóźnione (`setTimeout` 1500-8000ms w kodzie), więc to nie one — w
typowym oknie 600-900ms jeszcze się nie odpaliły. Winowajca to klaster **~8 efektów bez
żadnego opóźnienia**, wszystkie startujące w TYM SAMYM ticku co pierwsza klatka dashboardu:
`appSettings.loadAll()`, `migrateBalanceModel()`, `migratePaydayDefaultOff()`, `loadNonFood()`,
`loadOwnName()`, dwa sprawdzenia crash-loga (native JVM + JS, każde robi FileSystem+AsyncStorage
odczyt), `notificationsService.ensureAndroidChannel()`, natychmiastowy `flush()` widgetu
"Zadania" (`syncTasksWidget`).

**Fix**: nowy helper `afterInteractions(fn)` w `RootLayout` (owija
`InteractionManager.runAfterInteractions`, zwraca funkcję czyszczącą do cleanupu efektu) —
wszystkie 8 powyższych efektów przepisane, żeby odpalać się PRZEZ ten helper zamiast
bezpośrednio, więc nie walczą już o wątek JS w dokładnie tym samym momencie co render. Żadne
z nich nie jest potrzebne SYNCHRONICZNIE pierwszej klatce: `appSettings` ma cache w pamięci z
domyślną wartością (`_hapticsEnabled = true`) zanim `loadAll()` się skończy, migracje/
`loadNonFood`/`loadOwnName` dotyczą flow'ów używanych PÓŹNIEJ (dodawanie wydatków, wykrywanie
przelewów), nie startowego ekranu. Widget-sync: owinięty tylko POCZĄTKOWY `flush()` — sam
`subscribe()`/`AppState` listener zostaje podpięty natychmiast, żeby nie przegapić zmian.

**Testy**: brak nowych (czysto sequencing/timing zmiana, logika efektów bez zmian).
`tsc --noEmit` czyste, `jest` czysty (1105 testów, bez zmiany).

**Priorytet testu na urządzeniu — wysoki**: Ustawienia → Diagnostyka → "Wydajność startu
apki" po kilku kolejnych cold-startach — sprawdź, czy `(N próbek)` jest teraz > 0 (dowód że
wątek JS zdążył złapać choć jeden oddech), i czy dotyk zaraz po starcie faktycznie działa
płynniej. Jeśli nadal `0 próbek` — oznacza to, że kongestia siedzi GDZIE INDZIEJ (np. w
natywnym moście/JSI podczas równoległych wywołań), nie w tych 8 efektach — wróć z nowym
exportem.

---

---

## 180. Ściana serii: ręczne liczniki "ile dni temu" wpadały tam razem z auto-streakami (2026-09-25)

User: "Nie pokazuje mi się teraz jak mam odliczanie, jak dodaje kolejne, mimo że mam zaznaczone
pokaż na dashboardzie" — po śledztwie (zrzut dashboardu) okazało się, że odliczanie ("Wracasz
na Uniwersytet") **pokazywało się poprawnie** w sekcji "Odliczania" — false alarm co do samego
zniknięcia. Po drodze znaleziony i naprawiony REALNY, osobny bug (rule #7, dead-end):
`activeCountdowns` w `app/(tabs)/index.tsx` sprawdzał TYLKO `kind==='until' && !isOver &&
daysUntil>=0` — checkbox "Pokaż na dashboardzie" z formularza (`app/counters.tsx`) był
ZAPISYWANY, ale nigdy nie czytany dla liczników typu Odliczanie (dla `dashSince`/"ile dni temu"
ten sam checkbox DZIAŁAŁ poprawnie — asymetria). Naprawione: dodany identyczny warunek do
`activeCountdowns`.

**Prawdziwa skarga, po zrzucie dashboardu**: "Jadłem jeżyki" (ręczny licznik "ile dni temu",
`kind==='since'` BEZ `mode:'auto'`) pokazywał się w widgecie "Twoje Serie" (`streak-wall`)
RAZEM z Wodą i "Bez Słodyczy" — user: "słodycze spoko i woda ale bez sensu ile dni temu jadłem
tam się pojawia". Root cause: `streakWall` w `index.tsx` zbierał WSZYSTKIE liczniki
`kind==='since'` bez rozróżnienia trybu — auto-śledzone avoid-liczniki (np. "bez słodyczy",
`mode:'auto'`, faktycznie są streakiem: dni bez zakupu czegoś) i ręczne "ile dni temu"
liczniki (user tapuje "Zrobione dziś" ręcznie) trafiały do TEGO SAMEGO flame-tile widgetu.
Ręczne liczniki mają WŁASNY, dedykowany kafelek niżej na dashboardzie (`counters-since` /
`SinceCountersCard.tsx`, §176/§178's redesign pierścień+poświata) — duplikat w "Twoje Serie"
mylił, bo wyglądał jak stary, nieredesignowany flame-tile zamiast nowego looku.

**Fix**: `streakWall`'s `fromCounters` filtruje teraz `cn.kind === 'since' && cn.mode ===
'auto'` (tylko avoid-liczniki) — ręczne since-liczniki zostają WYŁĄCZNIE w
`counters-since`/`SinceCountersCard`, nie duplikują się już w "Twoje Serie".

**Testy**: `tsc --noEmit` czyste, `jest` czysty (1105 testów, bez zmiany — czysto filtrująca
zmiana, brak testu na `streakWall` w izolacji).

**Priorytet testu na urządzeniu — wysoki**: sprawdź "Twoje Serie" — powinny zostać tylko
Woda/Bez Słodyczy (auto-streaki), "Jadłem jeżyki" ma zniknąć stamtąd i pokazywać się TYLKO w
kafelku "Liczniki" (ten z pierścieniem/poświatą) niżej na dashboardzie.

---

## 181. Ile dni temu: usunięty CAŁY "streak" look (flame+kalendarz) z 3 miejsc naraz (2026-09-25)

User zrzutem po §180 (kafelek "Liczniki" na dashboardzie): "to ma być ile dni temu coś
robiłem, a to wygląda i teraz pokazuje jak seria jakaś, i jak klikam tez pokazuje jak serię...
weź to przemyśl i napraw raz a dobrze".

**Root cause namierzony precyzyjnie**: `SinceCountersCard.tsx`'s runda 2 (§176/§178) przerobiła
TYLKO wiersze `since.slice(1,7)` na duża-liczba+poświata — ale PIERWSZY (najdłuższy) wpis
zawsze renderował się przez `<StreakCard>` (flame-chip + pasek dni tygodnia/miesiąca,
dosłowny komponent "streak"). Z JEDNYM licznikiem na koncie (typowy start) ten wpis to
ZAWSZE "najdłuższy" — user nigdy nie widział nowego designu, tylko starą, dosłowną "serię".
To samo `StreakFlame`+`WeekStrip` (kalendarz dni tygodnia/miesiąca) siedziało jeszcze w DWÓCH
innych miejscach dla TEGO SAMEGO typu licznika: `/counters` (lista, sekcja "Ile dni temu/
bez…") i `/counters/[id]` (ekran szczegółów, do którego prowadzi tap z dashboardu — stąd
"jak klikam też pokazuje jak serię").

**Fix — wszystkie 3 miejsca naraz, jednolity wygląd**: `StreakCard`/`StreakFlame`/`WeekStrip`
usunięte z `SinceCountersCard.tsx`, `app/counters.tsx`, `app/counters/[id].tsx` — zastąpione
wszędzie tym samym wzorcem: duża kolorowana liczba (`fonts.display`, kolor z `streakColor()`)
+ tekst progu tieru (`streakTier()`, "TIER · próg za N dni"), bez ikony płomienia i bez
kalendarza-paska dni. `StreakCard.tsx` (plik) USUNIĘTY całkowicie — po tej zmianie nic go już
nie importowało (`StreakStrip`/`WeekStrip`/default `StreakCard` — martwy kod). `StreakFlame`/
`streakColor`/`streakTier` (z `StreakFlame.tsx`) ZOSTAJĄ — używane w `StreakWallCard.tsx`
("Twoje Serie"), gdzie flame+kalendarz jest właściwym designem dla PRAWDZIWYCH auto-streaków
(Woda/Bez Słodyczy), których to zgłoszenie NIE dotyczyło.

**Testy**: `tsc --noEmit` czyste, `jest` czysty (1105 testów, bez zmiany — czysto wizualna
zmiana, brak testów renderujących te komponenty w izolacji).

**Priorytet testu na urządzeniu — wysoki**: "Jadłem jeżyki" (albo dowolny ręczny licznik "ile
dni temu") — sprawdź WSZĘDZIE naraz: kafelek "Liczniki" na dashboardzie, `/counters` lista,
i ekran szczegółów po tapnięciu — żadne z tych trzech miejsc nie powinno już pokazywać ikony
płomienia ani kalendarza dni tygodnia/miesiąca, tylko dużą liczbę + tekst progu.

---

## 182. Serwis/wymiana pojazdu: powiadomienie i etykiety gubiły "za ile dni" (2026-09-25)

User: "I tak samo jak jest serwis wymiana to niech powiadomi, musi mieć za ile dni wymiana".

**Dwa realne, osobne bugi znalezione w `src/utils/vehicleMatch.ts`'s `maintenanceDueMonths()`
konsumentach** (funkcja sama, licząca UŁAMEK miesięcy do terminu, jest poprawna — problem był
we WSZYSTKICH trzech miejscach, które ją renderowały):

**(1) `Math.round()` na miesiącach gubił bliskie terminy.** Serwis za 6 dni to `due≈0.2`
miesiąca — `Math.round(0.2)` = 0, więc etykieta brzmiała dosłownie "za ~0 mies." (bez sensu,
akurat gdy to najważniejsze). Dotyczyło TRZECH miejsc: dashboard (`maintReminders` w
`index.tsx`), `/vehicles`'s listy przypomnień per-pojazd (`remindText`), i `/vehicles`'s pełnej
listy serwisów (`mMeta`). Fix: nowy, jeden `maintenanceDueLabel(due)` w `vehicleMatch.ts` —
przełącza się na precyzyjne DNI poniżej 1 miesiąca (`za 6 dni`), miesiące zostają dla
dalszych terminów (`za ~11 mies.`) — wszystkie trzy miejsca wołają teraz TĘ SAMĄ funkcję,
zamiast trzech kopii tej samej logiki (i tego samego buga) osobno.

**(2) Prawdziwe powiadomienie push "Serwis / wymiana" (`notificationsService.ts`'s
`refreshMaintenanceReminder`) NIGDY nie zawierało informacji "za ile dni".** Treść budowała
się z `maintReminders.map(r => `${r.label}${r.overdue ? ' (zaległe)' : ''}`)` — WYŁĄCZNIE
`r.label` (np. "Moje Auto: Wymiana oleju") + opcjonalny "(zaległe)", `r.sub` (gdzie faktycznie
liczba dni/miesięcy siedziała, liczona dla dashboardu) nigdy nie trafiał do treści samego
powiadomienia. User nie miał jak zobaczyć ile dni zostało bez otwierania apki — dokładnie to,
o co prosił. Fix: `labels` w `index.tsx` budują się teraz z `${r.label} — ${r.sub}` (np. "Moje
Auto: Wymiana oleju — za 6 dni").

**Testy**: nowy `describe('vehicleMatch — maintenanceDueLabel')` w `vehicleMatch.test.ts` (3
testy: zaległe/dni/miesiące). `tsc --noEmit` czyste, `jest` czysty (1108 testów, +3).

**Priorytet testu na urządzeniu — średni**: dodaj/edytuj serwis pojazdu z terminem za kilka dni
— sprawdź (a) dashboard/`/vehicles` pokazują "za N dni" zamiast "za ~0 mies.", (b) treść
powiadomienia "Serwis / wymiana" (Ustawienia → wyślij testowe, albo poczekaj na naturalne
odpalenie) zawiera "— za N dni"/"— zaległe", nie samą nazwę serwisu.

---

## 183. Widget "Zadania": przezroczystość-stopniowana + kolor tła + wielkość tekstu (2026-09-25)

User: "Dodajmy modyfikacje tego widgetu. Slider przezroczystości może, koloru w razie czego.
Dodajmy możliwość zmiany wielkości tekstu żeby dostosować sobie do preferencji wyświetlania".

**Binarny `PREF_TRANSPARENT` (on/off) zastąpiony trzema wartościami** w
`plugins/withTasksWidget.js` (natywny Kotlin, `TasksWidgetProvider`/`TasksWidgetModule`):
`bg_opacity` (Int 0-100, nie sam wł/wył), `bg_color` (dowolny hex, nie tylko sztywny ciemny),
`text_scale` (small/medium/large). Jedno wywołanie z JS (`setAppearance()`) zamiast trzech
osobnych — jeden zapis SharedPreferences + jedno przemalowanie.

**Tło renderuje się teraz jako BITMAPA** (`bgBitmap()` w `TasksWidgetProvider.kt`, Canvas +
`drawRoundRect`, zaokrąglony prostokąt z subtelną obwódką jak dawny statyczny
`widget_bg.xml` — TEN plik teraz usunięty, nieużywany) zamiast statycznego drawable/koloru na
sztywno — jedyny sposób połączyć DOWOLNY kolor+alpha z zachowanymi zaokrąglonymi rogami przez
RemoteViews (który nie potrafi dynamicznie pokolorować zasobu-drawable). Layout przebudowany z
płaskiego `LinearLayout` na `FrameLayout` (`widget_bg_image` ImageView pod treścią,
`widget_content` LinearLayout na wierzchu) — `widget_root` (klik + tap target) teraz na samym
FrameLayout. Wielkość tekstu: `applyTextScale()` woła `RemoteViews.setTextViewTextSize()` na
nagłówku/pustym-stanie/każdym z 6 wierszy, mnożnik 0.85x/1x/1.2x względem bazowych rozmiarów
(10sp/13sp).

**Ustawienia** (`app/settings.tsx`'s sekcja "Widget pulpitu — Zadania"): switch zastąpiony
TRZEMA kontrolkami tego samego "stopniowany wybór" wzorca co reszta pliku (np. "Płeć"/"Poziom
treningowy") — stopniowany 5-krokowy "slider" przezroczystości (0/25/50/75/100%, nie
prawdziwy przeciągany suwak — w projekcie brak zależności na ciągły slider, stopniowane
przyciski to świadomy, spójny z resztą apki wybór), swatche koloru (8: domyślny ciemny +
paleta z `counters.tsx`'s `BAR_COLORS`), segmentowany wybór wielkości tekstu (Mały/Średni/
Duży).

**`widgetSettingsStore.ts`**: `transparentBg: boolean` → `bgOpacity`/`bgColor`/`textScale`, z
migracją `version: 2` (stary `transparentBg: true` → `bgOpacity: 0`, zachowuje wybór usera
zamiast go ciche resetować).

**Testy**: brak nowych (czysto UI/natywna zmiana wyglądu, bez nowej logiki do testowania w
Jest). `tsc --noEmit` czyste, `jest` czysty (1108 testów, bez zmiany).

**WYMAGA NOWEGO APK** (natywny Kotlin/layout) — ale, w przeciwieństwie do §166 (przezroczystość
runda 1), NIE wymaga re-dodania widgetu: mechanizm SharedPreferences-czytanych-przy-update jest
ten sam co dawny `PREF_TRANSPARENT`, tylko bogatszy — istniejący, już umieszczony widget
podchwyci nowe wartości przy najbliższym `updateAll()` (np. po otwarciu Ustawień i zmianie
którejkolwiek kontrolki).

**Priorytet testu na urządzeniu — wysoki**: Ustawienia → Widget pulpitu — Zadania → przetestuj
wszystkie 3 kontrolki (przezroczystość 0/25/50/75/100%, kilka kolorów, 3 wielkości tekstu) i
sprawdź że widget na pulpicie faktycznie się zmienia po każdej — zaokrąglone rogi/obwódka mają
zostać widoczne przy każdej kombinacji koloru+przezroczystości (nie kwadratowe rogi).

---

---

## 184. Kotek w walkach: naprawdę statyczny bliźniak CatArt, nie tylko `animate={false}` (2026-09-26)

User: "Dlaczego nadal w walkach nie bierze udziału wyeksportować statyczna wersja kotka (bez
animacji głaskania itp jak bossy) żeby nie lagowały tak walki" — po §"kotek żeby był
statyczny" (2026-08-30) user doprecyzował: "miał być mój kotek, tylko jego svg 1:1 z kolorami,
tyle że statyczny/nieanimowany bez animacji w walce — nie możesz zapisać wersji svg bez
animacji i po prostu zmieniać mu kolor adekwatnie do naszego jak mu zmieniam?".

**Co było nie tak z 2026-08-30's `animate={false}`**: ten prop na `CatArt` wyłączał TYLKO
pętle bezczynności (oddech/mruganie/spojrzenie/uszy/auto-liźnięcie) — ale `CatArt.tsx` samo w
sobie NADAL alokowało przy każdym mouncie/renderze 8 `Animated.Value` (breathe/hop/wiggle/
shake/arm/swat/earL/earR), kilka `useState` (blink/look/petting/angry/battleFace/licking/
swatting/particles) i cały mechanizm ataku/swata (który celowo NIE był gaszony przez
`!animate`, tylko przez `asleep` — żeby cios w walce dalej działał). To NIE jest to samo co
"statyczny SVG" — to animowany komponent z wyłączonymi TYLKO niektórymi animacjami.

**Fix — nowy `src/components/pet/CatArtStatic.tsx`**: osobny komponent, ZERO
`Animated.Value`/`useState`/`useEffect` — czysta funkcja koloru/wyglądu. Bierze TE SAME propsy
personalizacji (`palette`/`stripes`/`eyeColor`/`noseColor`/`whiskers`/`legStripes`/
`expression`) co `CatArt`, renderuje WYŁĄCZNIE spoczynkową pozę (obie łapki na ziemi, oczy
otwarte wg `expression`, uszy w stałej pozycji bez overlay'a-do-flutteru, ogon bez wrappera
Animated) — 1:1 wygląd/kolor, zero maszynerii animacji. Duplikuje TYLKO markup, nie logikę:
stałe/funkcje pomocnicze (`mouthFor`, `Paw`, `LX`/`RX`/`EYY`/`CHEEK_L` z `CatArt.tsx`,
`TAIL_D`/`TAIL_AXIS_DEG` z `CatTail.tsx`) są WYEKSPORTOWANE i zaimportowane, nie przepisane —
zmiana kształtu w oryginale nie może po cichu rozjechać wyglądu bliźniaka.

**Atak/swat NIE ma odpowiednika w CatArtStatic** — świadomie pominięty (nie tylko "za trudne do
przeniesienia"): `boss-fight.tsx` ma już OSOBNY, niezależny sygnał trafienia (latająca łapa-
pocisk `pawTravel` + `playBossHitFx` flash bossa) — kotek dublujący to własnym swatem był
zbędny. Martwy po tej zmianie `attackPulse` (stan istniejący TYLKO po to, żeby przekazać
`attack` do `CatArt`) USUNIĘTY z `boss-fight.tsx` — nic już go nie czytało.

**Podłączone WSZĘDZIE, nie zostawione dead-endem**: `app/boss-fight.tsx` (prawdziwa walka —
campaign/raid/event/quest/mission/mad, WSZYSTKIE przez jeden ekran) ORAZ `app/battle-layout-
lab.tsx` (edytor układu areny, który z założenia ma pokazywać DOKŁADNIE to co realna walka —
zostawienie tam starego animowanego `CatArt` rozjechałoby podgląd edytora względem
rzeczywistości).

**Testy**: brak nowych (czysto wizualna/strukturalna zmiana, bez nowej logiki policzalnej w
Jest). `tsc --noEmit` czyste, `jest` czysty (1108 testów, bez zmiany).

**Priorytet testu na urządzeniu — wysoki**: stocz walkę (dowolny typ) — kotek ma wyglądać
identycznie jak wcześniej (te same kolory/pręgi/oczy/wąsy z Twojej personalizacji), ale bez
ŻADNEGO ruchu — brak oddechu/mrugania/spoglądania/machania uszami/swata na trafienie. Subiektywnie
oceń czy walki realnie mniej lagują — jeśli NIE, lag ma inne źródło (profilować głębiej: re-
rendery `usePetStore`, efekty cząsteczek/pocisków, coś w samym ekranie walki), nie kotka.

---

## 185. Plan zajęć: ta sama poświata co kafelek "Liczniki" (2026-09-26)

User zrzutem kafelka "Liczniki" ("16 Jadłem jeżyki", pomarańczowa poświata z lewej —
`SinceCountersCard.tsx`'s `RadialGlow`, §176): "zrób identyczny gradient jak na kafelku z
licznikiem ile dni temu, podoba mi się taki" — doprecyzowane po dopytaniu: chodziło o kafelek
"Plan zajęć" (`ClassScheduleCard.tsx`, fioletowy akcent `#A78BFA`), nie o inny kafelek
odliczania.

**Fix**: dodany `RadialGlow` (`size=170`, `color="#A78BFA"`, `opacity=0.18` — TE SAME wartości
co `SinceCountersCard.tsx`'s wiersze, tylko w kolorze akcentu tej karty zamiast koloru tieru
streaka) jako PIERWSZE dziecko karty (renderuje się POD resztą treści), pozycjonowany
`position:'absolute', left:-40, top:'50%', marginTop:-85` — ten sam przepis co
`sinceGlowWrap` w `SinceCountersCard.tsx`, przeskalowany pod wyższą, wielowierszową kartę
planu zajęć zamiast kompaktowego wiersza. Karta już miała `overflow:'hidden'` (z poprzedniej
rundy kolorystycznej, §167) — poświata bleedująca poza lewą krawędź jest więc czysto
przycinana przez zaokrąglone rogi, bez dodatkowych zmian.

**Testy**: brak nowych (czysto wizualna zmiana). `tsc --noEmit` czyste, `jest` czysty (1108
testów, bez zmiany).

**Priorytet testu na urządzeniu — niski**: sprawdź kafelek "Plan zajęć" na dashboardzie —
fioletowa poświata z lewej strony, w tym samym stylu co kafelek "Liczniki" (ile dni temu).

---

## 186. Ekwipunek: `atkFlat` gubił się do "+0" przy małych wartościach (2026-09-26)

User zrzutem Ekwipunku: "Sznurkowa Obroża... niektóre pokazują że +0, o co chodzi, to bez
sensu". Root cause w `gear.ts`'s `fmtGearStat()`: obroża (`atkFlat`, przebudowana z % na FLAT
2026-09-22) ma `baseValue` rzędu 0.08 (Sznurkowa Obroża, T1) — przy common/rare rzadkości
realna wartość WYLOSOWANEJ kopii (`GEAR_ROLL_SPREAD` ±30% wokół środka) ląduje CAŁA poniżej 1
(np. rare: 0.28-0.52). `fmtGearStat` używała `Math.round()` dla `atkFlat` (ten sam kod co
`flatHp`) — zerowało to wyświetlaną wartość, mimo że item REALNIE coś dawał w walce (surowa,
nie zaokrąglona wartość idzie do `atkMultiplier`/`gearAtkFlat`, samo `Math.round()` było tylko
w warstwie WYŚWIETLANIA).

**Fix**: `fmtGearStat('atkFlat', v)` pokazuje teraz jedno miejsce po przecinku (`+0.4` zamiast
`+0`) zamiast pełnej liczby. `flatHp` BEZ ZMIAN — jego `baseValue` (1-3.3 × mnożnik rzadkości)
nigdy nie schodzi blisko zera, całkowite HP ma sens jako jednostka wyświetlania. Delta
("▲ +0.2 vs założony") była już liczona z SUROWYCH wartości (`inst.value - equippedVal`), nie
z zaokrąglonych — ten fix jest czysto kosmetyczny/informacyjny, żadna logika porównania się
nie zmieniła.

**Testy**: nowy `describe('gear — fmtGearStat')` w `gear.test.ts` (3 testy: atkFlat<1 pokazuje
dziesiętne, flatHp zostaje całkowite, staty % bez zmian). `tsc --noEmit` czyste, `jest` czysty
(1111 testów, +3).

**Priorytet testu na urządzeniu — niski**: Ekwipunek → obroża niskiej rzadkości (common/rare)
— staty mają pokazywać ułamkową wartość ataku (np. "+0.4") zamiast "+0".

---

*Powiązane notatki (prywatna pamięć asystenta): codebase_map, project_sapp,
dashboard_nav_internals, bank_auto_expenses, pet_blob_design, perf_stylesheets,
theme_system, consumption_scope.*

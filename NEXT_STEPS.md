# Co dalej — stan na 2026-08-14

Ten plik to zrzut z sesji na PC przed przejściem na zdalną pracę z telefonu (claude.ai/code).
Aktualizuj/kasuj pozycje w miarę ogarniania, nie zostawiaj martwych wpisów.

## ✅ Setup zdalnego dostępu (claude.ai/code z telefonu) — DZIAŁA

Ta sesja jest dowodem że dostęp działa (repo `sapp` dostępne z claude.ai/code). Jeśli kiedyś
znów przestanie działać, punkt startowy diagnozy: github.com → avatar → Settings →
Applications → Installed GitHub Apps → apka Claude/Anthropic → Configure → Repository access.

## 🆕 Kafel pupila: kolor serii + większa głowa kotka (opiera się o krawędź) — NIEsprawdzone (2026-08-25)

User ze screenshotem (kafel "Fafik lvl 8" + kolumna serii logowań): "popraw kolory bo sa
pierdolniete na tym streaku" + "zeby ten pupil jakby był w kafelku większy praktycznie sama
głowa i tak dorobić mu łapki zeby lekko wyglądały jakby sie opierał o krawędź kafelka". Dwa
fixy, pełny opis w ARCHITECTURE.md (sekcja "Kolor kafla serii + głowa kotka powiększona"):
(1) kolor kafla serii logowań (tło/ramka/liczba) był na sztywno pomarańczowy niezależnie od
realnego progu serii — teraz liczony z `streakColor()`, tak jak płomień obok niego już był;
(2) kotek w kaflu pupila (`PetTile.tsx`) renderowany jako powiększona, przycięta "wystawiona
głowa" (czubek uszu do dołu łapek) zamiast pełnej małej sylwetki — liczby kadru wyliczone z
geometrii SVG (macierze transformacji w `CatArt.tsx`), ale **BEZ wizualnej weryfikacji na
urządzeniu** (nie da się tu wyrenderować RN-SVG żeby zobaczyć wynik). `tsc`/`jest` zielone
(nie testuje wyglądu — to zmiana czysto wizualna). **Priorytet testu na urządzeniu** (to
najważniejszy test tej zmiany):
(a) kafel pupila na dashboardzie (ten z kolumną serii logowań po prawej) — sprawdź czy KOLOR
tła/liczby kafla serii teraz PASUJE do koloru płomienia obok (oba powinny być tym samym
odcieniem progu, np. bordo przy niskiej serii),
(b) sprawdź kadr kotka po lewej: czy widać wyraźnie głowę + uszy u góry i łapki na dole,
skadrowane sensownie (nie ucięte za mocno/za słabo, nie puste marginesy po bokach) — jeśli
kadr jest zły, powiedz W KTÓRĄ STRONĘ (za dużo pustego u góry? uszy ucięte? łapki nie widać?)
— to jednolinijkowa poprawka jednej z czterech stałych `CROP_SIZE`/`CROP_W`/`CROP_H`/
`CROP_TOP`/`CROP_LEFT` na górze `PetTile.tsx`,
(c) sprawdź że reszta kafla (imię/poziom/status/nagrody) nie rozjechała się przez węższy
kontener kotka (54px zamiast dawnych 70px).

## 🆕 Optymalizacja: bestMoodWeek (rekordy życiowe) O(n²)→O(n) — NIEsprawdzone (2026-08-25)

Kontynuacja optymalizacji wejścia do apki po "okej tylko teraz optymalizuj dalej". Audyt
pozostałych ~15 `useMemo` karmiących sekcje z `DEFERRED_SECTIONS` (funFacts/correlations/
weightFacts/yearAgo/insightLinks/foodBreakdown/topProducts/shopsCollection) — wszystkie to
pojedynczy przebieg O(n) po `expenses` (setki-tysiące pozycji, nie 365×historia jak dawny bug
pikseli), więc NIE są realnym hotspotem i celowo zostawione bez zmian (dalsze "gate za
`deferredReady`" tych ~15 miejsc byłoby rozproszonym ryzykiem podobnym do odrzuconego pomysłu
"jeden wielki useMemo" — bez korzyści proporcjonalnej do ryzyka niewidocznego bez profilowania
na urządzeniu). Znaleziony realny hotspot: `bestMoodWeek()` w `personalRecords.ts` (karmi kafel
"Rekordy życiowe") była O(n²) — dla KAŻDEGO zalogowanego dnia nastroju filtrowała CAŁĄ listę dni
od nowa. Dla usera z rokiem+ codziennych wpisów nastroju to ~500k+ operacji, licząc się na
KAŻDYM renderze dashboardu (memo zależne od `moodEntries`, które zmienia się często). Przepisane
na dwuwskaźnikowe okno przesuwne — O(n). Poprawność zweryfikowana testami porównującymi z
naiwną referencyjną implementacją (gęste dni, dni z lukami >6 dni, 15× losowe zestawy).
`tsc`/`jest` zielone (58/716, +3 nowe testy w `personalRecords.test.ts`). **Priorytet testu na
urządzeniu**: kafel "Rekordy życiowe" na dashboardzie pokazuje IDENTYCZNĄ wartość "najlepszego
tygodnia nastroju" co przed zmianą (liczba, nie tylko że się pokazuje) — to czysto algorytmiczna
zmiana, wynik nie powinien się różnić.

## 🆕 Optymalizacja: "nieistotne" sekcje dashboardu doskakują w drugiej klatce — NIEsprawdzone (2026-08-24)

User: "ogólnie na wejście apki laguje" → doprecyzował: EVENTY/KALENDARZ/ZADANIA/PUPIL/NAWYKI/
KROKI/SEN/FINANSE + sprawdzenie powiadomień bankowych żywe, "nieistotne" widgety mogą ładować
się w tle. Kontynuacja poprzedniego wpisu (cache pikseli) — ~24 historyczne/statystyczne/
kolekcjonerskie sekcje (Wrapped, przegląd tygodnia, rekordy, ciekawostki, rozkłady wydatków,
korelacje, nastrój-wykresy, kolekcje sklepów, itd.) + WSZYSTKIE własne kafle ("widgety")
NIE renderują się w pierwszej klatce dashboardu — doskakują milisekundy później
(`InteractionManager.runAfterInteractions`), żeby ważne sekcje zdążyły się zbudować i
zamontować pierwsze. Pełny opis + pełna lista sekcji w ARCHITECTURE.md §4 (sub-punkt
"Staged render"). `tsc`/`jest` zielone (58/711, bez nowych testów — zmiana renderu ekranu,
nie logiki w `utils/`). **Priorytet testu na urządzeniu** (to jest subiektywne odczucie, więc
najważniejszy test to Twoje wrażenie, nie konkretna liczba):
(a) zamknij i otwórz apkę od zera (nie tylko przełącz zakładkę) — czy wejście na dashboard
czuje się WYRAŹNIE szybsze/płynniejsze niż wcześniej,
(b) sprawdź czy WSZYSTKIE sekcje w końcu się pojawiają (nawet te "nieistotne") — powinny
doskoczyć ułamek sekundy po ważnych, nie zniknąć na stałe,
(c) jeśli któraś sekcja z Twojej perspektywy jest WAŻNA a wylądowała w grupie "nieistotnych"
(deferred) — powiedz którą, to jednolinijkowa poprawka (edycja `DEFERRED_SECTIONS` w
`index.tsx`), lista klasyfikacji w pełni w ARCHITECTURE.md,
(d) sprawdź edytor dashboardu (ołówek) — powinien pokazywać WSZYSTKIE sekcje jak dawniej,
bez zmian (ta zmiana go nie dotyka).

## 🆕 Optymalizacja: "Rok w pikselach" liczony raz dziennie w tle — NIEsprawdzone (2026-08-24)

User: "ogólnie na wejście apki laguje" → doprecyzował: EVENTY/KALENDARZ/ZADANIA/PUPIL/NAWYKI/
KROKI/SEN/FINANSE + sprawdzenie powiadomień bankowych mają zostać żywe, "widgety które mają np
PIXEL YEAR kafelek [powinny] dziennie ładować raz na dzień w tle, tak samo inne nieistotne".
Znaleziony i naprawiony konkretny bug: kafel "Rok w pikselach" skanował CAŁĄ historię wydatków/
zadań/zdrowia DLA KAŻDEGO z 365 dni, i robił to przy KAŻDYM (nawet niezwiązanym) renderze
dashboardu — bo memo w `YearPixels.tsx` było zdefektowane przez świeżą funkcję-domknięcie z
`index.tsx` tworzoną na nowo za każdym razem. Naprawione cache'em raz-na-dzień (AsyncStorage).
Pełny opis w ARCHITECTURE.md §5 (sub-punkt "Cache raz-na-dzień, w tle"). `tsc`/`jest` zielone
(58/711, +5 nowych testów `dailyTileCache`). Reszta widgetów (correlations/personal-records/
food-breakdown/itd.) już była poprawnie zmemoizowana (nie miała tego samego buga) — dalsze
kroki optymalizacji (staged/deferred render mniej istotnych sekcji) w toku, osobny wpis niżej
jak się pojawi. **Priorytet testu na urządzeniu**:
(a) otwórz apkę, przejdź do kafelka "Rok w pikselach" na dashboardzie — sprawdź że siatka
pokazuje POPRAWNE dane (te same co przed zmianą, nie zera/puste),
(b) stuknij strzałkę zmiany roku — powinno zmienić się OD RAZU, bez zauważalnego opóźnienia
(fallback na żywe liczenie, zanim cache dogoni nowy rok w tle),
(c) dodaj nowy wydatek/zadanie DZIŚ — sprawdź że kafelek pikseli NIE aktualizuje się od razu
(to ŚWIADOME zachowanie — cache odświeży się dopiero jutro; jeśli to przeszkadza, powiedz,
można skrócić okno cache'u lub wymusić odświeżenie przy pull-to-refresh),
(d) subiektywnie: czy wejście na dashboard (szczególnie z kilkoma kaflami "Rok w pikselach")
czuje się szybsze niż wcześniej?

## 🆕 Raid przebudowany: prawdziwa walka wobec REALNEJ puli, nie krótka sesja — NIEsprawdzone (2026-08-25)

Kontynuacja poprzedniego zgłoszenia ("walka czasem się przerywa przedwcześnie"). User zagrał
realnie i sprecyzował: "realnie zagrałem i mi mimo połowy ponad HP przerwało" — dawny design
(`raidSessionHpFor`, ~6-ciosowa "sesja" wobec MAŁEJ podstawki, realny postęp dopisywany do
prawdziwej puli DOPIERO po sesji) faktycznie DZIAŁAŁ jak zaprojektowano, ale to zaprojektowanie
nie pasowało do tego czego user chciał: "chciałem żeby RAIDY... miały dużo hp względem poziomu
kotka (resetuje się co tydzień)... kotek walczy do końca, tyle ile mu zostawi tyle zostawi, ale
kotek nawet jak przegra to HP bossa zostaje tyle ile po ostatnim ciosie". Czyli: prawdziwa,
ciągła walka wobec REALNEJ, pozostałej puli (nie proxy), z prawdziwym stanem porażki, ale BEZ
resetu postępu na przegranej (w odróżnieniu od kampanii). Przy okazji: "zmieńmy licznik czerwonej
energii na 2 zamiast 1" — koszt próby podniesiony.

**Zmiana architektury**: `Boss.counterHp?: number` (nowe, opcjonalne pole w `bosses.ts`) —
`counterDamage()` woła TERAZ `boss.counterHp ?? boss.hp` zamiast zawsze `boss.hp`. To
ROZDZIELIŁO "ile HP ma boss" (do zbijania / win-condition) od "jaka skala % liczy kontratak" —
dawniej te dwie role dzielił jeden argument, co wymuszało sesję-proxy żeby uniknąć zabicia kotka
jednym kontratakiem od surowej, wielotysięcznej puli. `raidAsBoss(raid, hp, counterHp)` (nowa
sygnatura, trzeci argument) — `hp` = `raidRemaining` WPROST (realna pula), `counterHp` =
`raidCounterHpFor()` (przemianowane z `raidSessionHpFor`, ta sama formuła `atkPower × stała`,
tylko już nie "sesja"). Efekt: walka realnie zbija prawdziwy pasek rajdu każdą rundą, kończy się
naturalnie przez `simulateFight`'s `if (bossHp<=0 || catHp<=0) break` (jak kampania), NIE przez
sztuczny limit rund. `raidAttack()` w `finish()` (boss-fight.tsx) woła się TERAZ zawsze (win,
loss, wyczerpanie sufitu rund) z realną deltą (`raidRealStart - result.bossHpLeft`) — przegrana
NIE zeruje postępu (w petStore `raidAttack` po prostu odejmuje realne obrażenia od `raidHp`,
niezależnie od wyniku). Nowy stan porażki dla raidu (`defeat.fainted`) z osobnym komunikatem
("obrażenia zostają, pasek nie wraca do pełna") — inny niż reszta trybów (tam HP bossa faktycznie
resetuje się na przegranej). `defeatTarget` (dawniej pomijał `kind==='raid'` całkowicie — modal
przegranej otwierałby się PUSTY) teraz go zawiera. Koszt energii: `RAID_ENERGY_COST=2` (było 1,
zaimportowane w `petStore.ts`/`boss-fight.tsx`/`bosses.tsx`, przycisk WALCZ na mini-karcie rajdu
wyszarzony już przy `eventEnergy < 2`, nie dopiero przy 0). Nemesis (event kind='menace') MA TĘ
SAMĄ, starą sesję-proxy — user zgłosił problem tylko dla raidu, świadomie NIE dotknięte (ten sam
wzorzec `counterHp` da się powielić, gdyby okazało się że nemesis ma identyczny problem).
Testy: `__tests__/raid.test.ts` przepisany pod nowe API (`raidCounterHpFor`/`raidAsBoss(raid, hp,
counterHp)`/`RAID_ENERGY_COST`), w tym test że mała, prawie wyczerpana pula da się realnie dobić
do zera w JEDNEJ próbie. Pełny opis w ARCHITECTURE.md (sekcja bossów/rajdu, sub-punkt "Raid:
prawdziwa walka..."). `tsc`/`jest` zielone (58/713).
**Priorytet testu na urządzeniu** (WAŻNE — to zmiana balansu bojowego, warto sprawdzić realnie):
(a) walka z rajdem powinna teraz trwać WIELE rund (nie kończyć się po ~6 ciosach) i pasek HP
Krakena/etc. w arenie powinien realnie, widocznie spadać z każdym trafieniem,
(b) jeśli kotek zemdleje w trakcie — powinien pokazać się ekran PRZEGRANEJ (nowość — dawniej
raid nigdy nie pokazywał przegranej), z komunikatem że obrażenia i tak zostały zapisane,
(c) po przegranej wróć na ekran Raid — pasek HP powinien być NIŻSZY niż przed walką (postęp
zbankowany), NIE zresetowany do pełna,
(d) sprawdź że jedna próba zużywa TERAZ 2 ⚡ (czerwonej energii), nie 1 — przycisk WALCZ na
mini-karcie rajdu powinien być wyszarzony już przy dokładnie 1 energii,
(e) jeśli pozostała pula jest już mała (np. blisko końca tygodnia) — sprawdź czy da się ją
realnie dobić do zera w jednej próbie i dostać nagrodę (ekran zwycięstwa, medal).

## 🆕 Auto-tagowanie rozpoznanych sprzedawców z banku — NIEsprawdzone (2026-08-24)

User: "jak mi dodało autopłatność z banku to chciałbym móc jej nadać że to jest opłata za
internet, żeby mi łapało jak z wypłatą — hej jak widzisz tę automatyczną płatność od tego
odbiorcy o tym tytule to [otaguj]" (screenshot: wydatek "P4 Sp. o.o. Warszawa" bez tagów).
Rozszerzone istniejące uczenie się kategorii sprzedawcy (`merchantMemory.ts`) o tagi —
dotknij tagów na wydatku z rozpoznanym sprzedawcą, kolejne auto-złapane płatności od TEGO
SAMEGO odbiorcy dostają te same tagi bez pytania. Pełny opis w ARCHITECTURE.md §7 (nowy
sub-punkt "Auto-tagowanie rozpoznanych sprzedawców"). `tsc`/`jest` zielone (57/706 — 5 nowych
testów `saveMerchantTags`). **Priorytet testu na urządzeniu** (wymaga realnej auto-płatności
z banku, więc trudniej przetestować niż zwykłą zmianę UI):
(a) na wydatku z rozpoznanym sprzedawcą (bank-matched, ma `storeName`) dodaj tag np.
"internet" i zapisz,
(b) poczekaj na KOLEJNĄ automatyczną płatność od TEGO SAMEGO odbiorcy (ten sam pierwszy człon
nazwy, np. "P4") — sprawdź czy nowo dodany wydatek ma już ten tag BEZ ręcznego dodawania,
(c) sprawdź że kategoria tego sprzedawcy i jego licznik zaufania (`cleanAccepts`/`auto`) NIE
zmieniły się przez samo dodanie taga,
(d) usuń tag z wydatku i zapisz — sprawdź czy kolejna płatność od tego sprzedawcy PRZESTAJE
dostawać ten tag (nadpisanie pustą listą, nie tylko dodawanie).

## 🆕 Seria logowań sklejona z kaflem pupila (poprawka po błędnej wersji) — NIEsprawdzone (2026-08-24)

User: "zróbmy te ilość seri jako łączny kafelek z pupilem po prostu po prawej stronie oke??"
— PIERWSZA wersja omyłkowo dokleiła ogólne "Twoje serie" (streakWall — nawyki/liczniki typu
"bez wody") zamiast serii LOGOWAŃ pupila. User złapał błąd: "ty zjebałeś, miałeś mi serię
logowań pupila z nim połączyć a połączyłeś serię picia wody itp??". Naprawione: "Twoje serie"
w CAŁOŚCI z powrotem osobną, przesuwalną sekcją dashboardu (bez zmian względem stanu sprzed tej
sesji) — zamiast niej kafel pupila łączy się z `petLoginStreak` (dawny pasek "Seria logowań"
POD kaflem, teraz kolumna PO PRAWEJ WEWNĄTRZ tej samej ramki). Pełny opis w ARCHITECTURE.md §4
(sub-punkt "Seria logowań sklejona z kaflem pupila"). `tsc`/`jest` zielone (57/706, bez zmian
w testach). **Priorytet testu na urządzeniu**:
(a) na dashboardzie sprawdź czy "Twoje serie" jest z powrotem osobną kartą (nie wewnątrz kafla
pupila) — powinna wyglądać dokładnie jak przed tą sesją,
(b) sprawdź czy kafel pupila (kotek + imię/lvl) ma teraz DOKLEJONY z prawej strony mały
kafelek z płomieniem, liczbą dni serii LOGOWAŃ i podpisem "jutro +N", w JEDNEJ wspólnej ramce,
(c) stuknij GDZIEKOLWIEK na tej połączonej karcie (lewa LUB prawa strona) — całość powinna
otworzyć `/pet`,
(d) w edytorze dashboardu sprawdź że "Twoje serie" jest z powrotem na liście osobnych sekcji,
da się ją ukryć/przesunąć niezależnie od kafla pupila,
(e) jeśli akurat seria logowań spadła do zera (nie logowałeś się dziś) — kafel pupila powinien
wyglądać jak dawniej (bez doklejonej kolumny, z powrotem samodzielny chevron).

## 🆕 "Rok w pikselach": zmiana roku strzałkami — NIEsprawdzone (2026-08-24)

User: "w ustawieniach w personalizacji nie dałeś mi możliwości zmiany roku xdd" — kafelek
"Rok w pikselach" (dodany chwilę wcześniej, patrz wpis niżej) pokazywał na sztywno bieżący
rok, picker przy tworzeniu wybierał tylko metrykę. `CustomTile.year?: number` (nowe pole,
opcjonalne, brak = bieżący rok). W `app/(tabs)/index.tsx` strzałki ‹/› przy podpisie
"Rok {year}" wołają `updateCustomTile(t.id, { year: year ± 1 })`, w przód zablokowane na
bieżącym roku. Pełny opis w ARCHITECTURE.md §5 (nowy sub-punkt "Zmiana roku na kafelku").
`tsc`/`jest` zielone (57/701, bez zmian w testach — czysto UI). **Priorytet testu na
urządzeniu**:
(a) na istniejącym kafelku "Rok w pikselach" sprawdź czy obok napisu "Rok 2026" widać teraz
strzałki w lewo/prawo,
(b) stuknij strzałkę w lewo — siatka powinna przeładować się na dane z 2025 roku (mniej/inne
zapełnione kwadraciki niż 2026),
(c) sprawdź że strzałka w prawo jest wyszarzona/nieaktywna gdy jesteś na bieżącym roku
(nie da się "zobaczyć przyszłości"),
(d) zmień rok, zamknij i otwórz apkę ponownie — sprawdź czy wybrany rok został zapamiętany
(persist).

## 🆕 Zdrowie: odkrywalny sync + kolorowe kafelki + zbity widget wody — NIEsprawdzone (2026-08-24)

User: (1) "dodaj ze tam ukryty jest ten przeciągnij w dół aby zsynchronizować", (2) "te małe
kafelki dodaj im tło odpowiadające ikonie, ikony daj wypełnione", (3) "ten widget wody zrob
ładniejszy i mniejszy bardziej zbity tylko z dodaj, a po kliknięciu otwiera sie z edycja
cupsize lub cofnij dodanie". Trzy niezależne zmiany na `app/(tabs)/health.tsx` — pełny opis w
ARCHITECTURE.md, sekcja 8 (nowy sub-punkt "Odkrywalność sync..."). `tsc`/`jest` zielone
(57/701 suites — brak nowych testów, czysto UI/interakcja bez logiki liczbowej wartej testu
jednostkowego). **Priorytet testu na urządzeniu**:
(a) zakładka Zdrowie → sprawdź czy pod headerem widać wyraźniejszą wskazówkę "pociągnij w dół"
z ikonką strzałki, i czy pociągnięcie w dół faktycznie synchronizuje (bez zmian funkcjonalnie,
tylko wizualnie),
(b) sprawdź czy 5 małych kafelków (kroki/sen/tętno/kcal/waga) ma teraz kolorowe tło pod kolor
własnej ikony, i czy ikony wyglądają na wypełnione (nie tylko obrys),
(c) widget "NAWODNIENIE" powinien być mniejszy/bardziej zbity, z jednym wyraźnym przyciskiem
"Dodaj" — stuknij Dodaj kilka razy, sprawdź czy liczba szklanek realnie rośnie,
(d) stuknij w NAGŁÓWEK widgetu wody (nie przycisk Dodaj) — powinien otworzyć się sheet z
edycją celu/rozmiaru kubka ORAZ (jeśli water>0) nowym przyciskiem "Cofnij ostatnie dodanie" —
sprawdź czy cofnięcie faktycznie zmniejsza liczbę szklanek o 1 i zamyka sheet.

## 🆕 Dashboard: usunięty "Zaoszczędzone", przeniesione "Twoje serie", nowy widget "Rok w pikselach" — NIEsprawdzone (2026-08-24)

User: (1) "widget oszczędzone z tych lidlowskich usuń mi... i możesz posprzątać po nim bo nie
używam go wgle", (2) "żeby ta nie jedzenie słodyczy było jakby tam gdzie nawyki bo tam gdzie
odliczania to bez sensu", (3) "dodaj mi pixel year widget z możliwością wybrania czego".
(1) sekcja "Zaoszczędzone (kupony)" usunięta całkowicie z dashboardu (kod + komponent + util +
test, nie tylko ukryta). (2) "Twoje serie" przeniesione w edytorze dashboardu z grupy "Nastrój
i liczniki" do "Zadania i nawyki". (3) NOWY przycisk w edytorze dashboardu "Dodaj kafelek: Rok
w pikselach" — otwiera picker metryki (kroki/nastrój/sen/waga/wydatki/słodycze/itd.), tworzy
kafelek z rocznym gridem pikseli jak GitHub-contributions. To ożywienie JEDNEGO viz z dawno
wywalonego systemu custom-widgetów (reszta — liczby/wave/donut — zostaje wywalona zgodnie z
wcześniejszą decyzją usera). Pełny opis w ARCHITECTURE.md, §4 "Zmiany 2026-08-24" i §5 (nowy
sub-punkt "WYJĄTEK"). `tsc`/`jest` zielone (701/701 — 8 mniej niż poprzednio, bo usunięty
`savings.test.ts` razem z testowanym plikiem). **Priorytet testu na urządzeniu**:
(a) sprawdź że dashboard NIE pokazuje już karty "Zaoszczędzone" (nawet jeśli masz paragony z
rabatami/kuponami Lidl),
(b) w edytorze dashboardu (ołówek/edycja) sprawdź że "Twoje serie" jest teraz w grupie "Zadania
i nawyki" w puli "dodaj sekcję", nie w "Nastrój i liczniki",
(c) w edytorze dashboardu stuknij "Dodaj kafelek: Rok w pikselach", wybierz metrykę (np.
kroki) — sprawdź czy kafelek się tworzy, pokazuje siatkę 365 kwadracików kolorowanych wg
wartości dnia, i czy tapnięcie w niego otwiera sensowny szczegółowy widok (tydzień/miesiąc),
(d) sprawdź czy kafelek pikseli przetrwa przełączenie zakładek i restart apki (persist).

## 🐛 Fix ×2: dashboard undercountował serie nawyków (off-by-one, POTEM sztywny limit 30 dni) — NIEsprawdzone (2026-08-24 → 25)

User ze screenshotem (2026-08-24): "jak wchodzę [w habit-year] jest napisane 30 dni a na
kafelku [dashboard] wczoraj tez było 30, a dzisiaj jest 29 xddd". Fix #1: off-by-one w
`getStreak()` (`useHabits.ts`) — pętla miała stałą dolną granicę (`-29`) niezależną od tego
czy dziś już zaliczone. Wydawało się skończone, ALE user wrócił nazajutrz (2026-08-25) z
kolejnym screenshotem: "wiem czym problem — na dashboardzie 29, na habit-year 31, bo tam
liczy bez streak freeze" — hipoteza usera o freezach błędna (obie funkcje je liczą), ale
objaw realny: fix #1 poprawił TYLKO krawędź w obrębie 30-dniowego okna, nie sam fakt że okno
było sztywno 30-dniowe. Każda realna seria >30 dni była ucinana, niezależnie od freezów. Fix
#2: `MAX_STREAK_LOOKBACK_DAYS = 3650` (10 lat, bezpiecznik przed nieskończoną pętlą, NIE
realny limit) zamiast sztywnego `29`. Throwaway-symulacją w node zweryfikowane oba razy (fix
#1: stary→29, nowy→30 na 30-dniowym scenariuszu; fix #2: stary→30 ucięte, nowy→31 na
31-dniowym scenariuszu). Pełny opis w ARCHITECTURE.md, sekcja "Nawyki/liczniki" (dwa
sub-punkty "BUG #1"/"BUG #2" pod `getStreak()`). `tsc`/`jest` zielone (711/711 — brak
dedykowanego testu, `getStreak` żyje w hooku bez infrastruktury do testowania hooków w tym
repo; poprawność zweryfikowana throwaway-symulacją oba razy, nie testem jednostkowym).
**Priorytet testu na urządzeniu** (KLUCZOWE — poprzedni fix już raz wyglądał na gotowy a nie
był): znajdź nawyk/serię DŁUŻSZĄ niż 30 dni (jak "Woda" na screenshocie, 31 dni) — sprawdź
czy kafelek "Twoje serie" na dashboardzie pokazuje TĘ SAMĄ liczbę co ekran szczegółów serii
(habit-year), włącznie z seriami znacznie dłuższymi niż 31 (np. 40-60+ dni, jeśli masz taki
nawyk) — nie tylko blisko granicy 30/31.

## 🆕 TopPill: rotacja luźnej puli + pupil na misji/energia bossów — NIEsprawdzone (2026-08-23)

User: "żeby nie pokazywało się miesiąc ten sam że mam jedno zadanie tylko żeby trochę tego
trochę tamtego i dodać pupila że jak jest na misji to też pokazuje że jest... tak samo z
energią do bossa". Pilne stany pigułki (pomodoro/praca/zaległe/dziś/budżet/kalendarz/
deadline) bez zmian — pierwsze pasujące nadal wygrywa natychmiast. Reszta (streak zagrożony/
nastrój/zadania w toku/all-clear) + dwaj NOWI kandydaci (pupil na misji, energia bossów >0)
zbierani do jednej puli i pokazywani PO KOLEI co 8s zamiast zawsze tego samego. Pełny opis w
ARCHITECTURE.md, sekcja "TopPill.tsx". `tsc`/`jest` zielone (709/709 — logika czysto
UI/rotacyjna, brak nowej logiki liczbowej wartej osobnego testu jednostkowego).
**Priorytet testu na urządzeniu** (to dotyka GLOBALNEJ pigułki widocznej z każdego ekranu —
warto przetestować dokładnie):
(a) gdy nic pilnego się nie dzieje (brak pomodoro/pracy/zaległych/dziś/budżetu/kalendarza),
obserwuj pigułkę przez >30s — powinna zmieniać treść co ~8s, nie stać w miejscu,
(b) wyślij pupila na misję, sprawdź czy pigułka w rotacji pokazuje "PUPIL NA MISJI" z
odliczaniem, i "PUPIL WRÓCIŁ Z MISJI" gdy misja gotowa,
(c) miej energię bossów >0 (np. świeży start/po regeneracji) — sprawdź czy w rotacji pojawia
się "MOŻESZ WALCZYĆ Z BOSSEM" z liczbą energii jako badge,
(d) sprawdź czy pilne stany (np. rozpocznij pomodoro) NADAL natychmiast przerywają rotację i
przejmują pigułkę, tak jak wcześniej — to nie powinno się zmienić.

## 🆕 Podgląd statów + porównanie przed zakupem w Sklepie dnia — NIEsprawdzone (2026-08-22)

User: "jak klikam w sklepiku to żeby po kliknięciu w item pokazywało jego staty i porównanie z
itemem założonym". `pet-shop.tsx` → zakładka "Sklep dnia" (jedyna sprzedająca konkretne itemy
ekwipunku o znanym staty) — tap na kafelku otwiera teraz podgląd (`GearPreviewModal`): stat
itemu + delta vs to co jest ZAŁOŻONE W TYM SLOCIE teraz (▲/▼/=), dopiero stamtąd przycisk
"Kup" (dalej idzie przez to samo potwierdzenie zakupu co wcześniej). Skrzynki i Startupy tego
nie dostały — brak z góry znanego konkretnego itemu do pokazania. Pełny opis w ARCHITECTURE.md,
sekcja "GearPanel.tsx" (nowy sub-punkt). `tsc`/`jest` zielone (709/709 — czysto UI, logika
porównania to ta sama, przetestowana wcześniej formuła co `GearSlotModal`). **Priorytet testu
na urządzeniu**:
(a) w Sklepie dnia stuknij dowolny item — powinien pokazać się podgląd ze statem i porównaniem
(nie od razu okno potwierdzenia zakupu),
(b) sprawdź czy porównanie jest sensowne: załóż coś w danym slocie na ekranie Pupil, wróć do
sklepu — delta powinna pokazywać różnicę względem TEGO konkretnego założonego itemu,
(c) pusty slot (nic założone) → tekst "Nic nie masz założone w tym slocie" zamiast delty,
(d) przycisk "Kup" w podglądzie działa identycznie jak wcześniej (to samo potwierdzenie,
zakup trafia na konto).

## 🆕 Odliczanie energii przeniesione na lewo + nowy licznik dla czerwonej — NIEsprawdzone (2026-08-22)

User: "to odliczanie do następnej energii dodałeś na dole, tam możesz dodać po lewej od
energii i dodać dla czerwonej też taki licznik?" — ekran Bossy, pigułki w prawym górnym rogu.
Odliczanie do kolejnego punktu energii kampanijnej (niebieska) przeniesione z tekstu POD
obiema pigułkami na osobny wiersz PO LEWEJ od SWOJEJ pigułki. Czerwona (event+raid, wspólna
pula) dostała analogiczny licznik — liczy do najbliższej lokalnej północy (płaski dzienny
grant, nie regenerujący się bank jak kampania). Pełny opis w ARCHITECTURE.md, sekcja "Energia:
pigułki w prawym górnym rogu" (nowy sub-punkt). `tsc`/`jest` zielone (709/709 — czysto UI).
**Priorytet testu na urządzeniu**: ekran Bossy → sprawdź czy (a) niebieska pigułka ma teraz
odliczanie PO LEWEJ (nie pod spodem), (b) czerwona pigułka (widoczna od level 2) TEŻ ma
odliczanie po lewej, licząca w dół do najbliższej północy, (c) oba liczniki znikają gdy pula
jest pełna/zbankowana ponad limit dnia.

## 🆕 Sesja treningowa: nazwa ćwiczenia w trakcie + "Pomiń" na czasowych — NIEsprawdzone (2026-08-22)

User: "z nazwą ćwiczenia w trakcie wykonywania i jak jest czasowe jakieś np plank lub
rozciąganie przycisk pomiń z potwierdzeniem tak wykonałem ćwiczenie nie kontynuuj" —
`TrainingSessionModal.tsx` (pompki/przysiady/brzuszki/deska/rozciąganie). (1) Nazwa ćwiczenia
(`meta.label`) teraz widoczna jako tytuł RÓWNIEŻ w trakcie wykonywania (fazę `active`), nie
tylko na ekranie startowym. (2) Deska/rozciąganie (czasowe, `TIMED`) dostały przycisk "Pomiń"
pod paskiem odliczania — z potwierdzeniem przez `ConfirmDialog` (nie goły `Alert.alert`),
kończy timer wcześniej i przechodzi do zaliczenia, tak jakby odliczanie dobiło do zera. Pełny
opis w ARCHITECTURE.md, sekcja "Sesja treningowa self-report" (nowy sub-punkt). `tsc`/`jest`
zielone (709/709 — czysto UI, bez logiki wartej osobnego testu). **Priorytet testu na
urządzeniu** (pet-quests.tsx → dowolny quest bonusowy z self-reportem):
(a) wciśnij "Rozpocznij" na pompkach/przysiadach/brzuszkach — nazwa ćwiczenia powinna być
widoczna nad liczbą powtórzeń, nie tylko na ekranie startowym,
(b) wciśnij "Rozpocznij" na desce/rozciąganiu — nazwa nad timerem + przycisk "Pomiń" pod
paskiem odliczania,
(c) wciśnij "Pomiń" w trakcie odliczania — powinno pokazać potwierdzenie w stylu apki (nie
systemowy szary Alert), "Kontynuuj" wraca do TRWAJĄCEGO odliczania (nie resetuje go),
"Tak, wykonałem" od razu kończy ćwiczenie i zalicza quest.

## 🐛 Level-up celebration: tekst znikał, widać było TYLKO odznakę z ikoną — NIEsprawdzone (2026-08-22)

User ze screenshotem: "jak dostaje lewel to nic [tekstu] oprócz [ikonki] nie jest napisane,
poprawisz?" — baner level-upu (`LevelUpCelebration.tsx`) pokazywał samą żółtą odznakę z ikoną
`ChevronsUp`, cały tekst ("AWANS POZIOMU"/"Poziom N!"/opis/pasek XP) był niewidoczny. Przyczyna:
klasyczna RN-owa pułapka `flex:1` w rzędzie bez definitywnej szerokości rodzica (`card` miał
tylko `maxWidth`, nigdy realny `width`; wyśrodkowujący `wrap` daje mu szerokość "po
zawartości") — kolumna tekstu z `flex:1` zapadała się do 0px, sąsiadująca sztywna odznaka
44px renderowała się normalnie. Fix: `useWindowDimensions()` liczy realną szerokość karty i
podaje ją jako jawny `width`. Pełny opis w ARCHITECTURE.md, sekcja "Level-up celebration"
(nowy sub-punkt "BUG: cały tekst..."). `tsc`/`jest` zielone (709/709 — czysto layoutowa
zmiana w jednym komponencie, bez logiki wartej osobnego testu). **Priorytet testu na
urządzeniu**: zdobądź poziom (albo poczekaj na kolejny naturalny level-up) i sprawdź czy baner
pokazuje PEŁNY tekst — kicker "AWANS POZIOMU", "Poziom N!", opis, mini pasek XP — nie samą
odznakę z ikoną.

## 🆕 Raid dzieli teraz czerwoną pulę energii z wydarzeniami — NIEsprawdzone (2026-08-22)

User: "ogarnąłeś zeby raid ten korzystał z czerwonej energii?" — zapytany o zakres wybrał
"realne połączenie z pulą eventów" (nie tylko zmianę koloru ikony). Dawna własna pula
`raidEnergy` w `petStore.ts` USUNIĘTA — raid zużywa teraz `eventEnergy` (tę samą czerwoną
pulę co sezonowe wydarzenia), mini-karta raidu na ekranie Bossy pokazuje ją na czerwono
zamiast dawnego niebieskiego (który mylnie sugerował że raid dzieli pulę z kampanią). Pełny
opis w ARCHITECTURE.md, sekcja "Raid dostał pełną rundową walkę" (nowy sub-punkt). `tsc`/
`jest` zielone (709/709). **Świadomo NIEdociążony balans** — dzienny grant tej puli
(`eventDailyAttempts`) nie został podniesiony żeby zrekompensować nowego konsumenta, więc
grający regularnie w OBA (raid + wydarzenie) będzie miał łącznie mniej prób dziennie niż
wcześniej (dawniej dwie osobne pule). **Priorytet testu na urządzeniu**:
(a) na ekranie Bossy sprawdź czy mini-karta RAID pokazuje teraz czerwoną (nie niebieską)
liczbę energii, tę samą co pigułka WYDARZENIA w prawym górnym rogu,
(b) stoczyć walkę raidową i sprawdzić czy liczba w obu miejscach (pigułka nagłówka + mini-karta
raidu) spada o tyle samo (to jedna, wspólna pula),
(c) obserwuj czy łączna liczba prób raid+event dziennie faktycznie wystarcza — jeśli za mało
przy regularnym korzystaniu z obu, rozważyć podniesienie `eventDailyAttempts`.

## 🆕 Questy bez walki (samo "Odbierz") + ping na zakładce Zadania — NIEsprawdzone (2026-08-22)

User: "obok przycisku walcz pokazuje sie ile dostanę monet, a to bez sensu... questy zrobimy
bez walk, wtedy będzie szybciej odbierać bo to nic nie zmienia... zostawimy tylko odbierz" +
"dodaj ping na zakladce questów ze coś jest tam do odebrania". Dotyczy TYLKO questów
dziennych/bonusowych (`app/pet-quests.tsx`, sekcje "Codzienne"/"Bonusowe dziś") — misje
(system wypraw kota) i kampania/raid/event/MAD walki NIE ruszone, zostają jak były. Przycisk
"Walcz" → "Odbierz" (bez przejścia do ekranu walki), nagroda liczona identycznie jak wcześniej
(`questFightCoins × gearCoinsMult`, `questFightXp`), przez ożywioną wcześniej martwą akcję
`petStore.claimDaily`. Nowy hook `src/hooks/usePetQuests.ts` (questCtx/quests/missed, dzielony
z `PupilNavbar.tsx`) zasila nową żółtą kropkę-ping przy ikonie zakładki "Zadania" widoczną z
KTÓREGOKOLWIEK z 4 ekranów Pupila. Pełny opis w ARCHITECTURE.md, sekcja "Questy-jako-walki"
(nowy sub-punkt "USUNIĘTA walka..."). `tsc`/`jest` zielone (709/709 — brak nowych testów, to
czysto UI/flow zmiana bez nowej logiki liczbowej wartej osobnego testu). **Priorytet testu na
urządzeniu**:
(a) wykonaj dowolny quest dzienny (np. kroki) i sprawdź czy zamiast "Walcz" pokazuje się od
razu zielone "Odbierz", klik daje nagrodę natychmiast bez ekranu walki,
(b) sprawdź czy pigułka z monetami przy quest'cie pokazuje TĘ SAMĄ liczbę co realnie dostajesz
po kliknięciu (nie samą bazową stawkę sprzed mnożnika),
(c) zrób quest treningowy (pompki/przysiady/itd.) — sprawdź czy seria treningowa
("m_training") dalej się liczy mimo braku ekranu walki,
(d) z zakładki Bossy albo Sklep (NIE Zadania) sprawdź czy przy ikonie "Zadania" na dolnym pasku
pojawia się żółta kropka gdy jest coś do odebrania, i znika po odebraniu wszystkiego.

**Do rozważenia osobno (niepilne)**: `boss-fight.tsx`'s `kind==='quest'` branch (dawny ekran
walki questowej) jest teraz nieosiągalny z UI, zostawiony celowo bez sprzątania w tym PR —
kandydat do usunięcia jako martwy kod przy najbliższej okazji dotykania tego pliku.

## 🆕 Nagrody MAD przebudowane — start od finału kampanii, łagodny wzrost — NIEsprawdzone (2026-08-22)

User po zobaczeniu logu walk ze starego builda (Runda testowa #3, Lv183): "mad bossy mają być
nagrody z nich kontynuacja jak po ostatnim busie kampanii". Log pokazał że MAD Cukrowy Potwór
(boss #2) dawał tylko 36 monet/300 XP mimo bycia trudniejszym niż finał kampanii (po
przebudowie z poprzedniej sesji: hp×10 + counterMult×3). Zapytany o dokładny kształt wzrostu —
dosłowna kontynuacja krzywej kampanii dałaby ~88 mln monet na order22, user wybrał "start od
końca kampanii, łagodny wzrost". Pełny opis w ARCHITECTURE.md, sekcja MAD (nowy sub-punkt).
`tsc`/`jest` zielone (709/709, `madBosses.test.ts` przepisany pod nowy model nagród — 3 nowe
testy). **Priorytet testu na urządzeniu (po restarcie na najnowszym buildzie)**:
(a) pokonaj DOWOLNEGO wczesnego MAD bossa (np. mad_sloth, mad_sugar) i sprawdź czy nagroda jest
teraz na poziomie finału kampanii (rzędu dziesiątek tysięcy monet/setek tysięcy XP), nie
kilkudziesięciu monet jak wcześniej,
(b) porównaj nagrodę z wczesnego MAD bossa vs późnego (np. mad_wizard) — późniejszy powinien
dawać wyraźnie więcej (~4x), ale nie astronomicznie więcej.

## ⚠️ Stary build: kampania daje płaski XP/monety niezależnie od realnej trudności walki — DO OBSERWACJI po świeżym reset-teście (2026-08-22)

User z logu Runda testowa #3 (Lv183, przed dzisiejszym MAD-fixem): "zobacz jak bardzo nie był
zoptymalizowany, jakie bugi ile XP wgle jak spory lewej jak na kilka dni raptem xdddd bez
sensu". Zaobserwowany wzorzec: kampania jest SEKWENCYJNA (trzeba pokonać poprzedniego bossa),
ale gracz levelował się SZYBCIEJ z innych źródeł (questy/misje/MAD) niż postępował przez
kampanię — więc dotarł do późnych bossów kampanii (np. Iluzja Kontroli, docelowo Lv116) już
jako Lv150+, miażdżąc je w 2-4 rundy. Kampania daje PŁASKĄ nagrodę per boss (`coins`/`xp` w
`BOSSES`, niezależnie jak trywialna była walka) — więc trywialne zwycięstwa i tak dawały pełne,
duże nagrody (Iluzja Kontroli: +22088 monet/+225000 XP w 4 rundach), co samo nakręcało jeszcze
szybsze lewelowanie (runaway feedback loop). User zdecydował: poczekać na świeży reset na
najnowszym buildzie (z już wdrożoną rekalibracją hp×√2/√3 z poprzedniej sesji) zanim
diagnozować dalej — NIE naprawiane w tym przejściu, bo dane są ze STAREGO builda sprzed
rekalibracji trudności. **Jeśli po świeżym teście problem się powtórzy** (kampania dalej
trywialna mimo hp×√2/√3, bo tempo lewelowania z questów/misji/MAD i tak wyprzedza sekwencyjny
postęp kampanii), rozważyć: (a) skalowanie nagrody kampanii w DÓŁ gdy walka była trywialnie
łatwa (np. <3 rundy), (b) jakiś soft-cap na tempo XP z questów/misji względem postępu kampanii,
(c) coś innego — do przedyskutowania z userem po jego raporcie.

## 🆕 Kotek na pasku misji: chód zamiast skoku, +18% rozmiar, jasna otoczka, kwadratowy fluid — NIEsprawdzone (2026-08-21)

User (2 wiadomości, druga ze screenshotem): (1) "kotka skaczące lekko na boki jakby szedł na
prawdę a nie skakał", (2) "większego o 15-20% zeby byl w tym pasku realnie", (3) "jeżeli jest
wybrany ciemny kolor to dawaj mu chyba jasna otoczkę", (4) "ten pasek ładowania niech sie
ładuje w kształcie a nie randomowo bo ładujący sie fluid jest w postaci kwadratu a sam pasek
[jest] zaokrąglone". Pełny opis w ARCHITECTURE.md §9, "SYSTEM EKWIPUNKU" Runda 7. `tsc`/`jest`
zielone (707/707 — czysto wizualne zmiany w `pet.tsx`/`CatArt` na pasku misji, bez logiki
biznesowej wartej testu). **Priorytet testu na urządzeniu**:
(a) wyślij misję, patrz na kotka na pasku przez pełny cykl wahadła (~2s) — powinien przechylać
się I przesuwać w bok RAZEM (chód), bez pionowego podskakiwania,
(b) sprawdź czy kotek na pasku jest wyraźnie większy niż wcześniej pamiętasz (26px zamiast 22),
(c) ustaw kotkowi ciemny kolor (czarny/szary/brązowy) i sprawdź czy na pasku misji ma teraz
jasną poświatę za sobą — powinien być wyraźnie widoczny na ciemnym tle paska, zamiast wtapiać
się w nie,
(d) sprawdź kształt wypełnienia paska przy RÓŻNYCH poziomach postępu (świeżo wysłana misja =
mały procent, prawie gotowa = duży) — lewa krawędź wypełnienia powinna być zaokrąglona pod
kapsel paska, bez kwadratowego "klocka" na starcie jak na screenshocie usera.

## 🐛 Pręgi na uniesionej łapce (animacja liźnięcia/swata) — NIEsprawdzone (2026-08-21)

User: "jak liże łapkę to jak mam paski na łapkach to one z jednej łapki znikają na czas
animacji a po niej wracają". Przyczyna: uniesiona łapka renderuje się w osobnym overlay'u POZA
głównym SVG (musi być animowana native-driverem), a ten overlay nigdy nie miał dorysowanych
pasków — miał tylko gołą łapkę. Dodane te same 3 `Rect` co na statycznej łapce. Pełny opis w
ARCHITECTURE.md §9. `tsc`/`jest` zielone (707/707 — `CatArt.tsx` to czysto wizualny SVG
komponent, bez testów jednostkowych, jak reszta wizualnych komponentów w tym repo). **Priorytet
testu na urządzeniu**: ustaw kotkowi pręgi na łapkach (personalizacja), poczekaj aż sam zacznie
się lizać (albo przytrzymaj kotka — long press = przytulenie, też odpala liźnięcie) i sprawdź
czy paski na uniesionej łapce widoczne są PRZEZ CAŁĄ animację, nie tylko przed/po niej. To samo
przy swatnięciu (tap reakcja).

## 🆕 MAD bossy: hp STAŁE = kampania×10 (było: dynamiczne, rosło z levelem) — NIEsprawdzone (2026-08-21)

User: "Czekaj, ty zrobiles ze im większy level tym większe HP mad bossów?????" → wyjaśnione że
to oryginalny design z 2026-08-15 (MAD ma NIGDY nie być przestarzały), nie zmiana z tej sesji.
User świadomie zdecydował się odwrócić: "nie chce stałe ale pojebanae wartości tak zeby mad
bossy byly 10x silniejsze od kampanijnych odzwierciedleń ale stałe, i z większym o wiele
atakiem". Pełny opis w ARCHITECTURE.md, sekcja MAD (przebudowany sub-punkt). **TO JEST CELOWO
EKSTREMALNE** — MAD hp = kampanijne hp × 10 (STAŁE, nie zależy już od poziomu gracza) + nowy
mnożnik kontrataku ×3 PONAD to co wynika z 10× hp. Przykład: Kanapowy Leniwiec ma teraz MAD hp
5400 (kampania: 540), kontratak ~405 obrażeń PRZED redukcją uniku — przy typowym HP kotka na
Lv15 (~100-150) to realnie jednorazowy nokaut bez solidnej inwestycji w HP/unik. `tsc`/`jest`
zielone (707/707, `madBosses.test.ts` przepisany pod nowy model — stare testy dynamicznego hp
usunięte, nowe pilnują `hp = boss.hp × MAD_HP_MULT` i `counterMult = MAD_COUNTER_MULT`).
**Priorytet testu na urządzeniu**: (a) wejdź w MAD (przełącznik Kampania/MAD na ekranie
Bossy) i sprawdź czy HP faktycznie jest teraz dużo wyższe niż wcześniej pamiętasz, (b) stoczy
walkę i sprawdź czy kontratak faktycznie zadaje drastycznie więcej niż w kampanii — to jest
oczekiwane, nie bug, chyba że wyjdzie że jest DOSŁOWNIE niemożliwe do wygrania nawet przy
maksymalnej inwestycji (wtedy warto rozważyć złagodzenie `MAD_COUNTER_MULT`/`MAD_HP_MULT`).

## 🐛 Etykieta "masa mięśniowa" w Zdrowiu poprawiona na "masa beztłuszczowa" — NIEsprawdzone (2026-08-21)

User zauważył (screenshot karty CIAŁO): "przecież tam jest 60kg mięśni wpisane plus 40kg wody
co wychodzi ponad 100kg jak ja ważę 72 xdddddd". Dane były poprawne — `leanMassKg` z Health
Connect to masa BEZTŁUSZCZOWA (waga minus tłuszcz, już ZAWIERA wodę/kości/narządy), nie samo
"skeletal muscle" które Samsung Health pokazuje we własnym UI (32.9kg, screenshot usera) —
Health Connect nie eksponuje osobnego typu rekordu na samą tkankę mięśniową. Etykieta zmieniona
z "masa mięśniowa"/"mięśnie"/"Mięśnie kg" na "masa beztłuszczowa"/"beztłuszczowa"/
"Beztłuszczowa kg" w 3 miejscach `health.tsx`. Pełny opis w ARCHITECTURE.md §8. `tsc`/`jest`
zielone (707/707, czysto etykietowa zmiana, zero logiki). **Priorytet testu na urządzeniu**:
otwórz zakładkę Zdrowie → karta CIAŁO — sprawdź czy kafel pokazuje teraz "masa beztłuszczowa"
zamiast "masa mięśniowa" (ta sama liczba, 60.2kg, tylko poprawna nazwa) — to samo w rozwiniętym
widoku dnia i w polu ręcznego wpisu.

## 🆕 Skumulowany unik z łupu bossów przycięty 72%→30% + usunięty ostatni "Trofeum" w nazwie — NIEsprawdzone (2026-08-21)

User: (1) "musimy uwzględnić ze 47% uniku to kurewsko duzo lepiej z bossów zeby nie dostawać
takich statystyk" (2) "nadal nie usunąłeś chyba ze wszystkich bossów trofeow?". Pełny opis w
ARCHITECTURE.md, nowy sub-punkt zaraz po HP×√2/√3 rekalibracji. `tsc`/`jest` zielone (707/707,
bez nowych testów — czyste dane liczbowe w `BOSSES`, żaden test nie sumował dotąd
`bossBonuses` na pełnym rosterze). **Priorytet testu na urządzeniu**:
(a) sprawdź ekran Pupila → kafel "Unik" (dodany w poprzednim batchu) — powinien pokazywać
NIŻSZĄ wartość niż przed tą zmianą, jeśli masz pokonanych bossów z dodge w łupie (dragon/
stress/burnout/compare/doubt/devourer/jaguar/hades/princess/wizard),
(b) pokonaj Smoka Chaosu (jeśli jeszcze go nie masz w tej rundzie) i sprawdź czy victory modal
pokazuje "Łuska Chaosu" zamiast starego "Trofeum Smoka",
(c) subiektywnie: czy walki z bossami PÓŹNIEJ w kampanii (gdzie skumulowany unik był
największy) czują się teraz bardziej ryzykowne/napięte niż wcześniej, zamiast prawie
całkowicie neutralizować kontratak.

## 🐛 "Zwijana zakładka pokonanych" wciąż niepotwierdzona przez usera — SPRAWDŹ NA ŚWIEŻYM BUILDZIE (2026-08-21)

User zgłosił drugi raz (po PR #53): "bossy pokonane nadal nie mają zwijane zakładki". Kod
zweryfikowany — `app/bosses.tsx` ma poprawnie działający `defeatedList`/`s.collapseRow`/
`defeatedCollapsed`, plik nietknięty od merge'a #53 (git log potwierdza). Najbardziej
prawdopodobne wyjaśnienie: (a) user testował na APK sprzed tego mergea, ALBO (b) świeży reset
postępu pupila (nowa runda testowa) z zerem pokonanych bossów — wtedy nagłówek SŁUSZNIE się nie
pokazuje (nie ma czego zwijać), to nie bug. **Priorytet**: po instalacji NAJNOWSZEGO APK, pokonaj
przynajmniej jednego bossa kampanii i sprawdź czy nagłówek "Pokonani bossowie (N)" faktycznie się
pojawia i zwija/rozwija po tapnięciu. Jeśli NIE pojawia się mimo pokonanego bossa na świeżym
buildzie — to realny bug wymagający dalszego śledztwa (podejrzany kandydat: `defeatedBosses` w
`petStore` nie synchronizuje się z listą na tym ekranie, albo `useFocusEffect`/`reload()` nie
odświeża stanu po powrocie z walki).

## 🆕 Przełącznik Kampania/MAD + pigułki energii "X/max" z odliczaniem — NIEsprawdzone (2026-08-21)

User: (2) "dodaj zeby byl przełącznik pomiędzy mad bosami a kampanijnymi" (3) "dodaj zeby bylo
widać w prawym górnym licznik do następnej energii oraz ile na ile mam np 0/5". Pełny opis w
ARCHITECTURE.md, sekcja bossów (nowy sub-punkt po "Pokonani bossowie zwijani domyślnie"). `tsc`/
`jest` zielone (707/707, bez nowych testów — czysto UI/lokalny stan, `bossView` toggle i format
stringa w pigułkach nie mają logiki biznesowej wartej testu). **Priorytet testu na urządzeniu**:
(a) wejdź na ekran Bossy — sprawdź czy nad kartą aktualnego bossa jest segmented control
"Kampania | MAD", domyślnie na Kampanii,
(b) tapnij "MAD bossy" — czy lista kampanii znika i pokazuje się TYLKO karta MAD (bez
przewijania), i odwrotnie po powrocie na "Kampania",
(c) sprawdź obie pigułki energii w prawym górnym rogu — czy pokazują format "X/max" (np. "2/5"),
nie samą surową liczbę jak dawniej,
(d) gdy niebieska (kampania) pigułka jest niepełna, sprawdź czy pod nią pojawia się mały
wyciszony tekst "za Xh Ymin" z odliczaniem do kolejnego punktu — powinien zniknąć gdy bank się
napełni.

## 🆕 Bossowie kampanii trudniejsi (hp×√2/√3) + kafle uniku/krytu + misje krótsze i bardziej opłacalne — NIEsprawdzone (2026-08-21)

Batch 3 rzeczy z jednej wiadomości po przejrzeniu raportu postępu (Lv67, 17/22 kampanii, test
runda #3): (1) "boss sa za latwe zdecydowanie... utrudnij bym je minimum 2x HP i 2x dmg każdy a
te dalsze nawet po 3x wszystko", (2) "tam te statystyki unik+ kryt dodaj jako kafelki pod
spodem bo dziwnie wyglądają jako tekst", (3) "misje wyprawy sa absurdalnie długie i dają mało...
co level zmieniaj dodając +1minuta, +1coin, +1xp". Pełny opis w ARCHITECTURE.md "Trudność
bossów podbita" (nowy sub-punkt), "SYSTEM EKWIPUNKU" Runda 6, "Misja pupila" (nowy sub-punkt).
`tsc`/`jest` zielone (707/707 — testy `bosses.test.ts` używają lokalnego `boss()` helpera z
własnymi hp, nie odczytują `BOSSES[]` wprost poza jednym testem nieczułym na dokładną wartość
hp; `missions.test.ts`'s "lvl 50 ~5h" zaktualizowany na nową rzeczywistość "lvl 50 ~1h").
**WAŻNE — (1) wymagało throwaway-symulacji i jednego AskUserQuestion do usera** (dosłowne
hp×2/×3 dawało ~4x/~9x łącznych obrażeń przez kwadratową interakcję hp×counterDamage, prawie
ściana nie do przejścia — user wybrał "przelicz na realny 2x/3x", więc hp skaluje się
PIERWIASTKIEM: ×√2≈1.41 dla common (order 1-8), ×√3≈1.73 dla elite (order 9-22). **Priorytet
testu na urządzeniu**:
(a) stocz walkę z bossem którego JUŻ pokonałeś dawniej w rundzie testowej (jeśli robisz reset)
i sprawdź czy faktycznie czuje się WYRAŹNIE trudniej niż poprzednio, ale wciąż wygrywalnie przy
Twojej aktualnej inwestycji,
(b) **zwróć szczególną uwagę na bossa #1 (Kanapowy Leniwiec, Lv2)** — symulacja pokazała że
nawet po przeskalowaniu może być zaskakująco trudny dla świeżo startującego gracza (0% winrate
przy zerowej-lekkiej inwestycji w symulacji) — jeśli faktycznie czuje się jak ściana od
pierwszej walki w grze, zgłoś, to kandydat na osobny wyjątek,
(c) sprawdź ekran Pupila → grid "Siła bojowa" — czy unik/kryt pokazują się teraz jako osobne
kafelki (Wind/cyan i Target/fiolet) w nowym wierszu pod ATK/HP/Prób/Misja, zamiast dawnego
tekstu pod gridem,
(d) wyślij nową misję i sprawdź czas trwania — powinien być WYRAŹNIE krótszy niż wcześniej na
Twoim poziomie (Lv67: było ~6h46m, teraz ~1h16m), i sprawdź nagrodę po powrocie — powinna być
zauważalnie wyższa niż przed zmianą (Lv67: było ~16 monet/40 XP, teraz ~70 monet/76 XP).

## 🆕 Skrzynki sardynek dropią gear + ikony/licznik sklepu + seria logowań na dashboard — NIEsprawdzone (2026-08-21)

Batch 4 rzeczy z jednej wiadomości: (1) "ze skrzynek kupowany w sklepie nie dropi ekwipunek",
(2) "dodaj w sklepie te same ikony co w slotach i dodaj za ile odświeża sie sklep, codziennie o
6:00", (3) "serię logowan przenieśmy na główny pulpit", (4) "wywalmy te dodatkowy napis obok
kotka co pisze smacznie śpi". Pełny opis w ARCHITECTURE §"SYSTEM EKWIPUNKU" Runda 5 + nowy
bullet "Seria logowań przeniesiona na dashboard". `tsc`/`jest` zielone (707/707, bez nowych
testów — (1) reużywa już przetestowaną `rollBox`/`pickWeighted` logikę z `petBoxes.ts`, (2)-(4)
czysto UI/przenosiny). **Priorytet testu na urządzeniu**:
(a) głaszcz kotka aż dostaniesz skrzynkę sardynek (`pendingCrates`), otwórz kilka — sprawdź czy
w reveal pojawia się czasem karta "🎁 Ekwipunek: ... (rzadkość)" z grafiką itemu, nie tylko
monety/itemy bojowe,
(b) w Sklepie → Sklep dnia sprawdź czy 3 wiersze pokazują RÓŻNE grafiki itemów (nie tę samą
emoji kategorii co wcześniej), to samo w reveal skrzynki kupionej w Skrzynkach,
(c) sprawdź licznik "Nowy zestaw za Xh Ym (codziennie o 6:00)" pod Sklepem dnia — czy liczba
maleje sensownie między wejściami i czy zestaw NIE zmienia się o północy, tylko dopiero o 6:00
rano,
(d) wejdź na główny pulpit — sprawdź czy pasek "Seria logowań: X dni" (płomyk) pokazuje się pod
kafelkiem pupila (jeśli masz streak > 0) i czy zniknął ze Sklepu,
(e) sprawdź kafelek pupila na pulpicie wieczorem/w nocy (po 22:00) — nie powinno już być napisu
"Smacznie śpi 💤" pod statusem, tylko sam status (np. "Śpi") i ew. pasek nagród do odbioru.

## 🆕 Pokonani bossowie zwijani w liście kampanii — NIEsprawdzone (2026-08-20)

User: "i dodałeś ze bossy te pokonane sa zwinięte w liscie." — nie było, teraz jest. Lista
kampanii (`app/bosses.tsx`) pokazywała KAŻDEGO z 22 bossów jako pełny wiersz niezależnie od
statusu — im dalej user zajdzie (obecnie 10/22), tym dłużej trzeba przewijać przez identyczne
"Pokonany ✓" zanim dotrze się do aktualnego/zablokowanych. Pokonani bossowie (zawsze ciągły
prefiks listy, kampania leci sekwencyjnie) chowają się teraz pod jeden nagłówek "Pokonani
bossowie (N)" z chevronem, domyślnie ZWINIĘTE — tap rozwija/zwija. Pełny opis w ARCHITECTURE
§9. `tsc`/`jest` zielone (707/707, bez nowych testów — czysto UI/lokalny stan, logika
`defeatedList`/`restList` to proste dzielenie tablicy bez nowej logiki biznesowej wartej
testu). **Priorytet testu na urządzeniu**: (a) sprawdź czy nagłówek zwinięcia pokazuje
poprawną liczbę (powinno być 10 przy Twoim obecnym postępie), (b) tap rozwija listę pokonanych
bossów — sprawdź czy każdy ma poprawną nazwę/loot, (c) tap ponownie zwija z powrotem, (d) po
pokonaniu KOLEJNEGO bossa sprawdź czy liczba w nagłówku rośnie i nowy boss trafia do zwiniętej
sekcji zamiast zostać jako osobny wiersz.

## 🆕 Per-item grafiki w kafelkach gearu + sprzedaż itemów — NIEsprawdzone (2026-08-20)

User: (1) "dodałeś ze ikony te które dodam wyświetlają sie jako w tych kafelkach u pupila?"
(2) "co robimy z itemami co sa słabsze ale je mamy w eq? mozna je sprzedać? jak tak dodaj
przycisk sprzedaj z potwierdzeniem". Odkryte przy okazji: `GearItemDef.icon` (grafika per
item, `assets/ekwipunek/`) istniało w danych od kroku 1, ale NIC go nigdzie nie renderowało —
flankujące sloty i modal pokazywały tylko generyczną ikonę/emoji KATEGORII slotu. Fix: (1)
`GearPanel.tsx` — flankujący slot z założonym itemem pokazuje TERAZ jego własną grafikę
(`equippedItem.icon`), puste sloty zostają na lucide ikonie kategorii; `GearSlotModal` dostał
`itemImg` przy każdym wierszu. **`pet-shop.tsx`/`BoxRevealModal.tsx` NIE zrobione w tym PR-ze
— dalej pokazują emoji kategorii zamiast grafiki konkretnego itemu, świadomie odłożone
(user pytał konkretnie o "kafelki u pupila").** (2) Nowy `gearSellValue()` (40% ceny sklepu
dnia dla tier/rarity) + `petStore.sellGear(itemId)` (auto-zdejmuje jeśli założony, dodaje
monety) + mały link "Sprzedaj +X 🪙" w każdym wierszu modala, otwiera `ConfirmDialog`. `tsc`/
`jest` zielone (707/707, +4 nowe testy `gearSellValue` w `gear.test.ts` — `sellGear` w
petStore NIE testowany, konsekwentnie z resztą store'u). **Priorytet testu na urządzeniu**:
(a) załóż dowolny item — sprawdź czy jego GRAFIKA (nie generyczna ikonka) pokazuje się w
kafelku obok kotka i w wierszu modala, (b) sprawdź czy różne itemy tego samego slotu mają
WIDOCZNIE różne grafiki, (c) sprzedaj założony item — sprawdź że zdejmuje się ze slotu, dodaje
monety, i znika z listy w modalu, (d) sprzedaj NIEzałożony item — sprawdź że nie rusza
aktualnie założonego, (e) rozważ czy dodać per-item grafiki też do `pet-shop.tsx`/
`BoxRevealModal.tsx` (świadomie pominięte, patrz wyżej) jeśli user tego oczekuje.

## 🆕 "Pomiń walkę" — przycisk pomijający animację, wszystkie 6 trybów — NIEsprawdzone (2026-08-20)

User: "możesz dodać przycisk jak walka jakakoliwek pomiń walke?". Wynik walki jest już w 100%
rozstrzygnięty w momencie WALCZ! (`simulateFight`/`raidAttack`/`menaceAttack`/`spendEnergy`
wołane synchronicznie PRZED animacją) — animacja to czysto kosmetyczne odtworzenie gotowego
wyniku, więc skip jest bezpieczny i nie może zmienić rezultatu. Nowy `skipFightRef` w
`app/boss-fight.tsx`, mały podkreślony przycisk "Pomiń walkę" pod głównym WALCZ!, widoczny
tylko w trakcie animacji (`fighting===true`) — jedna implementacja dla wszystkich 6 trybów
(kampania/raid/event/quest/mad/misja), bo dzielą jedną `attackRoundBased()`. Pełny opis w
ARCHITECTURE §9. `tsc`/`jest` zielone (703/703, bez nowych testów — czysto UI/timing, logika
wyniku niezmieniona). **Priorytet testu na urządzeniu**: (a) rozpocznij walkę (dowolny tryb)
i kliknij "Pomiń walkę" w trakcie animacji — sprawdź czy od razu pokazuje się modal
wygranej/przegranej z PRAWIDŁOWĄ nagrodą (tą samą co gdyby animacja doleciała do końca),
(b) sprawdź że po skipie nic nie zostaje "w locie" (paw/bolt) widoczne pod modalem po jego
zamknięciu, (c) sprawdź raid/nemesis (sesja wobec trwałej puli) — skip powinien poprawnie
domknąć/nie domknąć prawdziwą pulę zależnie od realnego wyniku, tak samo jak bez skipu.

## 🐛 Paragon: "Razem" liczył sumę PRZED zwrotem kaucji, nie realnie zapłaconą kwotę — NIEsprawdzone (2026-08-20)

User przesłał realny paragon Lidl ze zwrotem kaucji za butelki (-6 zł) — ekran "Wklej paragon"
pokazywał "Razem: 29,66 zł" i fałszywy warning "mogły zostać pominięte pozycje", mimo że
WSZYSTKIE pozycje (w tym zwrot kaucji) były poprawnie wykryte, tylko realnie zapłacono 23,66 zł
(zgodnie z linijką "Płatność Karta płatnicza" na paragonie). Przyczyna: `detectTotal()`/
`parseGeneric()` w `receiptParser.ts` łapały "SUMA PLN" (suma towarów PRZED zwrotem kaucji)
jako pierwsze dopasowanie w tekście, ignorując że to nie finalna kwota. Fix: nowy
`detectPaymentTotal()` — linia "Płatność ... <kwota>" sprawdzana NAJPIERW (zawsze finalna,
uwzględnia każdą korektę), fallback do starych wzorców gdy jej brak. Pełny opis w
ARCHITECTURE §7b. `tsc`/`jest` zielone (703/703, +3 nowe testy z pełnym tekstem paragonu
usera jako fixture). **Priorytet testu na urządzeniu**: (a) wklej dokładnie ten paragon Lidl
(albo dowolny inny ze zwrotem kaucji) i sprawdź czy "Razem" pokazuje realnie zapłaconą kwotę
bez fałszywego warningu, (b) sprawdź paragony BEZ zwrotu kaucji (Lidl/inne) — total dalej
powinien się zgadzać (fallback do starych wzorców gdy brak linii "Płatność" nie powinien nic
popsuć), (c) sprawdź czy dopasowanie do transakcji bankowej (bankCommit.ts) nadal działa
poprawnie z nową, niższą kwotą total.

## 🆕 Kontratak bossa STAŁY (nie malejący z HP) + przepołowiony COUNTER_PCT — NIEsprawdzone (2026-08-20)

User przejrzał świeży log walk (30+ walk, Lv20): "boss atakują coraz mniej o co chodzi to błąd??"
— kontratak/rundę w logu malał razem z malejącym HP bossa (świadomy mechanizm z 2026-08-13,
patrz ARCHITECTURE §9), user to zinterpretował jako bug i poprosił o odwrócenie: "zrob mu
stały dmg xd wszystkim". `counterDamage()` woła się teraz z `boss.hp` (stały max) zamiast
malejącego `bossHp`; `COUNTER_PCT` przepołowiony 0.05→0.025 (throwaway-symulacja całego
rosteru 22 bossów potwierdziła praktycznie IDENTYCZNY profil ryzyka co wcześniej — patrz
ARCHITECTURE §9 pełny opis). `tsc`/`jest` zielone (700/700, kilka testów przepisanych pod
nowe zachowanie/wartości). **Priorytet testu na urządzeniu**: (a) stocz kilka wielorundowych
walk (kampania, najlepiej boss z regen albo guard) i sprawdź w logu że "kontratak/rundę" jest
teraz STAŁY (ta sama liczba w każdej rundzie, nie malejąca), (b) subiektywnie oceń czy
trudność/ryzyko zemdlenia "czuje się" podobnie jak wcześniej (nie drastycznie łatwiej/trudniej)
— symulacja mówi że tak powinno być, ale to warto potwierdzić realną grą, (c) sprawdź boss z
guard (np. Cukrowy Potwór, Duch Perfekcjonizmu) i regen (np. Widmo Porównań) — to kombinacje
najbardziej wrażliwe na tę zmianę.

## 🆕 Level-up celebration — baner + confetti + pasek XP — NIEsprawdzone (2026-08-20, runda 2)

User: "musimy dodac info o levelup pupila jakby albo animacje xd nie wiem chyba
powiadomienie wystarczy z confetti albo z fajna animacja XP czy cos". Baner spadający
z góry ekranu (nie blokujący, jak `Toast.tsx`) + `Confetti`, auto-znika (albo tap).
Wykrywanie w `app/_layout.tsx` (jedyny komponent żywy przez całą sesję, xp rośnie z wielu
miejsc — walki/questy/careTick), nowe `petStore.lastSeenLevel` (migracja dla starych
zapisów = aktualny poziom, NIE 1, żeby nie zalać istniejącego gracza lawiną poziomów).
Dodatkowy tekst gdy level-up trafia na próg wzrostu (Lv3/6/12 → kid/teen/adult).

Runda 2 (2026-08-20, user po zobaczeniu bannera na żywo: "ten toast powiadomienie levelupu
pupila zrob lepiej teraz jest tylko emotka i confetii i nie wiadomo o co chodzi xd") —
pojedyncza emotka 🎉 obok numeru poziomu ginęła wizualnie przy confetti, mało informacji.
Emoji zastąpione kolorową odznaką z ikoną `ChevronsUp` (jednoznaczny motyw "poszedłeś w
górę") + nowy kicker "AWANS POZIOMU" NAD numerem (ten sam wzorzec co `vKicker` w victory
modalu bossów) + nowy mini pasek XP pod spodem ("X/Y XP" w nowym poziomie, liczone z
ŻYWEGO `xp` w store przez `levelFromXp`, nie zamrożone na moment level-upu). Auto-dismiss
wydłużony 3,2s→4,2s (więcej do przeczytania). Pełny opis w ARCHITECTURE §9. **Priorytet
testu na urządzeniu**: (a) zdobądź XP tak żeby przejść na kolejny poziom, sprawdź czy nowy
baner (odznaka+kicker+pasek XP) jest czytelny i nie ginie przy confetti, (b) zamknij apkę
W TRAKCIE animacji i otwórz ponownie — level-up powinien wrócić, (c) zdobądź duży skok XP
przez kilka poziomów naraz — JEDEN baner z finalnym poziomem, (d) sprawdź tekst progu
wzrostu przy Lv3/6/12, (e) sprawdź czy pasek XP pokazuje sensowną liczbę (nie 0/0 ani ujemną).

## 🆕 Cap energii kampanii skaluje się z energyMult — NIEsprawdzone (2026-08-20)

User po zobaczeniu ekranu Siła bojowa: "niech maksymalna energia się nakłada do tych walk bo
teraz mam napisane 4 a maksymalnie ładuje mi się do 2 i tak czy siak". Bug: "Prób dziennie"
liczyło `dailyAttempts(energyMult)` (z bonusów łupu+gear), ale realny bank energii kampanii
był sztywnym `ENERGY_MAX=2` (wcześniejsza, teraz odwrócona decyzja — patrz ARCHITECTURE §9
"CAP ODWRÓCONY z FLAT na skalujący"). Fix: `ENERGY_MAX` usunięte, `energyRegenTick`/
`energySpendTick` biorą wymagany `max`, nowy `campaignEnergyMax()` w `petStore.ts` woła TĘ
SAMĄ `dailyAttempts()` co wyświetlacz. `tsc`/`jest` zielone (700/700, +1 nowy test). **Priorytet
testu na urządzeniu**: (a) sprawdź czy liczba w "Prób dziennie" na Siła bojowa TERAZ zgadza
się z tym do ilu realnie ładuje się pasek energii kampanii na ekranie bossów, (b) jeśli masz
gear/loot z `energyMult` bonusem, sprawdź czy cap poszedł w górę (np. z 2 na 3-4), (c) wydaj
całą energię, sprawdź czy regeneracja nadal działa co `ENERGY_REGEN_HOURS` i zatrzymuje się na
nowym, wyższym capie, nie na starym 2.

## 🆕🏗️ Gear layout (3 lewo/3 prawo) + konsolidacja UI misji — NIEsprawdzone (2026-08-20, runda 2)

User (screenshot `/pet`): itemy ekwipunku mają być 3 po LEWEJ i 3 po PRAWEJ stronie kotka, z
lepszymi ikonami lucide (puste sloty bezbarwne) — **zrobione w rundzie 1, na urządzeniu OK**.
Kafelek misji był PODWÓJNY (duży + osobna sekcja) — **zrobione w rundzie 1, ALE** po teście na
urządzeniu user zgłosił NOWY duplikat: skurczony duży kotek NA scenie i mały kotek na pasku
renderowały się RAZEM naraz ("kotek jest podwojony") — pierwsza wersja nie usunęła w pełni
dużego portretu, tylko go zmniejszyła, a osobny mały na pasku został.

Runda 2 (ten commit): kotek na pasku to TERAZ JEDEN element, nie dwa. Duży portret w trakcie
misji USUNIĘTY CAŁKOWICIE — jedyny kotek to ten na pasku, który "wchodzi" na niego
jednorazową animacją `missionEnter` (Animated.Value 0→1, 550ms, `Easing.out(cubic)`): startuje
DUŻY (scale ×3.2) i WYSOKO (translateY -90, tam gdzie siedział dawny portret), potem kurczy
się i opada dokładnie na pasek. Sam pasek: był 4px, teraz GRUBY (30px, pigułka) i SZERSZY (pełna
szerokość `catCol` w GearPanel zamiast sztywnych 140px) — `LinearGradient` wypełnienie +
przesuwająca się w pętli "fala" (`missionWave`, jasny ukośny pasek, przycięty
`overflow:hidden`-em wypełnienia). NAD paskiem: nazwa miejsca podróży (lewo) + odliczanie
(prawo) zamiast osobnej linijki tekstu pod spodem. Miejsca podróży = NOWE pole
`MiniBoss.destination` w `minibosses.ts` (8 nazw dopasowanych tematycznie do zwierzaka, np.
Kapibara → "Leniwe Bajoro") — pokazywane przez `minibossForMission(missionStartedAt)`, TA SAMA
deterministyczna funkcja co `boss-fight.tsx` już wołał do wyboru przeciwnika, więc nazwa na
scenie i przeciwnik po powrocie ZAWSZE się zgadzają (zero nowego stanu, tylko odczyt istniejącej
funkcji wcześniej niż dawniej). `tsc`/`jest` zielone (700/700, bez nowych testów — czysto UI,
`destination` nieużywane przez żadną logikę testowaną jednostkowo). **Priorytet testu na
urządzeniu**: (a) NAJWAŻNIEJSZE — sprawdź że kotek NIE jest już podwojony, tylko jeden element
na pasku, (b) wyślij misję i sprawdź animację wejścia (duży→mały, z góry na pasek) wygląda
płynnie, nie migocze, (c) fala na wypełnieniu widoczna i nie wystaje poza pasek, (d) nazwa
miejsca + odliczanie czytelne nad paskiem na różnych szerokościach ekranu, (e) po powrocie z
misji walka faktycznie toczy się z tym SAMYM zwierzakiem co pokazywała nazwa miejsca w trakcie
podróży, (f) 3+3 sloty ekwipunku dalej mieszczą się obok kotka w stanie spoczynku (bez zmian
w tej rundzie, ale sprawdź czy nic się nie rozjechało).

## 🆕 Design potwierdzenia misji + mini popup zamiast pełnoekranowego bloku — NIEsprawdzone (2026-08-20, runda 3)

Dwie rzeczy user zgłosił po teście: (1) "komunikat wróć natychmiast z potwierdzeniem nie ma
designu" — potwierdzenie anulowania misji leciało przez gołego `Alert.alert` (systemowa,
nieostylowana skrzynka), mimo że apka MA już własny `ConfirmDialog` (dokładnie do tego
zbudowany w 2026-08-11 po identycznej skardze gdzie indziej) — po prostu przeoczony przy
dodawaniu anulowania misji. (2) "zamiast full screen powiadomień jak pupil jest w misji to
zrób mini popup window... pasek ładowania... czerwony przycisk" — próba wejścia w walkę
KTÓREGOKOLWIEK trybu (kampania/raid/event/mad, oraz bezpośrednio `?kind=mission`) podczas gdy
pupil jest w drodze pokazywała statyczny tekstowy blok wypełniający całą treść ekranu walki.

Zrobione: (1) `app/pet.tsx`'s `onCancelMission` zamieniony z `Alert.alert` na stan
`cancelMissionConfirm` + istniejący `<ConfirmDialog destructive .../>` (ten sam wzorzec co
potwierdzenia ulepszeń HP/ATK na tym samym ekranie) — usunięty nieużywany już import `Alert`.
(2) `app/boss-fight.tsx`: `missionAway` (pupil w drodze) teraz renderuje malutki wyśrodkowany
popup (`missionAwayOverlay`/`missionAwayCard`, ta sama stylistyka co `ConfirmDialog` — karta
na przyciemnionym tle, NIE pełny ekran) z nazwą miejsca podróży, cienkim paskiem postępu,
odliczaniem, przyciskiem "Wróć do ekranu" (`router.back()`) i CZERWONYM "Wróć natychmiast"
(otwiera TEN SAM `ConfirmDialog` co w `pet.tsx`, osobna instancja/stan `missionCancelConfirm`
w tym pliku). Treść scrolla za popupem zostaje pustym `<View style={s.done} />` (placeholder,
popup i tak zasłania wszystko). `fmtMissionDuration` wyniesione z `app/pet.tsx` do
`utils/missions.ts` (eksportowane) żeby nie duplikować identycznej funkcji w drugim pliku,
który teraz też jej potrzebuje. `tsc`/`jest` zielone (700/700, bez nowych testów — czysto UI).
**Priorytet testu na urządzeniu**: (a) anuluj misję ze sceny `/pet` — potwierdzenie powinno
wyglądać jak reszta apki (ciemna karta), nie jak systemowy alert, (b) spróbuj zaatakować
bossa kampanii/raidu/eventu/MAD podczas gdy pupil jest w drodze — powinien pojawić się mały
popup (nie pełny ekran) z paskiem/nazwą miejsca/odliczaniem, (c) w popupie sprawdź "Wróć do
ekranu" (wraca bez akcji) i "Wróć natychmiast" → potwierdzenie → misja faktycznie anulowana
bez nagrody i ekran wraca.

User zaakceptował pełen plan ("Tak git zapisz wszystko i lecimy wszystko po kolei bez
przerwy") po kilku turach dopracowywania. To jest ŹRÓDŁO PRAWDY dla całej funkcji —
aktualizuj listę kroków poniżej po każdym PR, nie zaczynaj od zera w nowej sesji.

### Spec (ustalone z userem)

**6 slotów wokół kotka**, każdy steruje JEDNĄ statystyką:
1. Hełm/czapka → crit%
2. Zbroja/napierśnik → flat HP
3. Buty → dodge%
4. Obroża → atk%
5. Talizman → energyMult%
6. Kolczyki → coins% bonus (NOWA statystyka, nie istniała wcześniej)

**30 itemów** = 5 per slot × 6 slotów. Każdy item ma JEDNĄ grafikę (rarity = kolorowa
obwódka w apce, NIE osobna grafika na rarity — patrz `assets/ekwipunek/README.md` z pełną
listą nazw plików i opisów, wysłaną userowi do skopiowania). 5 itemów w slocie = progresja
odblokowania wg poziomu pupila (T1=Lv1, T2=Lv20, T3=Lv40, T4=Lv65, T5=Lv90) — to NIEZALEŻNE
od rarity.

**5 rarity per item** (item można wylosować w dowolnej rzadkości niezależnie od tego jak
"wysoki tier" to jest): common (szara obwódka) ×1, rare (zielona) ×5, epic (niebieska) ×8,
legendary (różowa) ×11, mythic (gradient niebiesko-jasnoróżowo-fioletowy) ×15 — mnożnik do
bazowej wartości statu itemu. Zakotwiczone na przykładzie usera: pancerz T1 common=+1hp,
rare=+5hp (1×5), mythic=+15hp (1×15) — pasuje idealnie do ×1/×5/×15, epic/legendary (×8/×11)
dointerpolowane, TODO-balance jeśli się nie sprawdzą w praniu.

**Skrzynki — REUSE istniejącego `petBoxes.ts` (`LOOT_BOXES`: sardine/silver/gold, koszt
35/90/200), NIE nowy system.** User chciał "3 skrzynki drewniana/srebrna/złota" — to
dokładnie te same 3 skrzynki co już są w sklepie (id zostają sardine/silver/gold żeby nie
migrować zapisanych danych, zmienia się tylko `name` na "Drewniana/Srebrna/Złota"). Dodajemy
DO nich (nie zamiast) branch na drop gear — `gearChance` + `gearTierWeight` per skrzynka,
różne tylko w szansach na wyższe rarity (jak user chciał: "jedyne co się różni to szansa na
lepsze statystyki"). Cosmetics (colorChance/startupChance) w skrzynkach ZOSTAJĄ bez zmian —
user przenosi TYLKO ręczne kupno kolorów z shopu do modala imienia, skrzynki nadal mogą je
losowo dawać jako bonus.

**Nawigacja** — scalić staty + itemy w zakładkę Pupil (`/pet`), questy do OSOBNEJ nowej
zakładki. PupilNavbar.tsx ma dziś 4 taby (pet/bosses/shop/stats) — trzeba dodać/przenieść.

**Sklep (`/pet-shop.tsx`)** — traci sekcję kosmetyki całkowicie (przenosi się do modala
imienia, patrz niżej). Zostają: skrzynki (LOOT_BOXES) + NOWE 3 sloty daily-reroll (konkretny
item+rarity wylosowany raz dziennie, kupowany za gold, reset co 24h jak inne dailies).

**Kosmetyka kotka → modal edycji imienia.** User pierwotnie chciał "klik w kotka", potem
sam to odrzucił: "nie przecież kliknięciem głaskam kotka to nie może... lepiej dać przy
edycji imienia". Dziś tap w wiersz z imieniem (`app/pet.tsx:437`, `nameRow`) przełącza
inline `TextInput` (linia 430). Ma się stać modalem `PetCustomizeModal` (imię na górze +
CAŁA siatka kosmetyki 1:1 przeniesiona z `pet-shop.tsx` — kolor futra/pasy/oczy/nos/wąsy/
pręgi na łapach, te same `buyColor/buyStripes/buyEyeColor/buyNoseColor/buyWhiskers/
buyLegStripes` z petStore, tylko UI przeniesione). TEN SAM modal użyty też jako
**jednorazowy onboarding przy pierwszym uruchomieniu** — dziś pupil startuje z twardym
defaultem `name: 'Blobek'` i domyślnymi kolorami, zero pytania usera. Potrzebna nowa flaga
`onboarded: boolean` w petStore.

**Backup — NIC nie trzeba robić.** Sprawdzone: `backupService.ts` → `gatherSnapshot()`
bierze WSZYSTKIE klucze AsyncStorage poza `firebase:*`, więc `pet-v1` (persist key
petStore) leci do backupu automatycznie, cały nowy stan ekwipunku wejdzie z automatu, zero
zmian potrzebnych.

**Porównanie itemów** — karta itemu w plecaku pokazuje deltę względem aktualnie założonego
w tym samym slocie (+3 HP / -2% crit itp.), reużywalny komponent `ItemCompareCard`, użyty
w plecaku i w podglądzie po otwarciu skrzynki.

### Kroki implementacji (patrz TaskList tego repo dla live statusu)

1. [x] `src/utils/gear.ts` — 30 itemów, typy `GearSlot`/`GearRarity`, `gearStatValue(item, rarity)`.
   12 testów w `__tests__/gear.test.ts`. Ikony na razie PLACEHOLDERY w `assets/ekwipunek/`.
2. [x] petStore: `ownedGear`, `equippedGear` (per slot), `onboarded` + `grantGear`/`equipGear`/
   `unequipGear`/`setOnboarded`. Dodane do `partialize` (persist) i migracji w
   `onRehydrateStorage` (`onboarded` domyślnie `true` na migracji starych zapisów, `false`
   tylko dla NOWYCH pupili — inaczej onboarding pokazałby się wszystkim istniejącym userom).
   **UWAGA — WCIĄŻ NIE ZROBIONE: staty NIC jeszcze nie robią w `simulateFight`/`atkPower`/
   ekonomii — to świadomie osobny, późniejszy krok 8. Nie zapomnieć — inaczej ekwipunek to
   tylko kolekcjonowanie bez efektu.**
3. [x] `petBoxes.ts` — `gearChance`/`gearRarityWeight` branch w `rollBox()` (4. param `level`),
   rename sardine `name`→"Drewniana skrzynka". Zaktualizowane 3 call site'y (`pet-shop.tsx` ×2,
   `pet.tsx` ×1 dla skrzynki dnia przy kocie) + `BoxRevealModal.tsx` (osobna `RARITY_META` dla
   gear vs `CRATE_META` dla reszty — 2 różne skale rzadkości w jednym pliku).
4. [x] Nawigacja: scal staty+itemy do `/pet`, questy do nowej zakładki (`/pet-quests`).
   `app/pet-stats.tsx` USUNIĘTY, treść wklejona do `pet.tsx`. Wspólna health/water/budget
   logika (3 delikatne fixy odświeżania) wydzielona do `src/hooks/usePetHealthSync.ts`,
   żeby nie duplikować jej między `/pet` i `/pet-quests`. `PupilNavbar` tab `stats`→`quests`.
   **Priorytet testu na urządzeniu**: (a) `/pet` pokazuje kotka+misję+staty+ekwipunek
   bojowy bez błędów, (b) nowa zakładka `/pet-quests` (ikona listy) pokazuje wszystkie
   questy tak jak wcześniej, (c) odbieranie nagród/questów działa identycznie jak przed
   zmianą, (d) status/nastrój kotka na `/pet` dalej reaguje na kroki/nawyki/nastrój.
5. [x] `pet-shop.tsx`: kosmetyka (kolory/dodatki) usunięta, nowa kategoria "Sklep dnia"
   (3 konkretne itemy ekwipunku, gwarantowany zakup, `dailyShopSlots()` w gear.ts,
   deterministyczne wg daty). Startupy (kosmetyk splasha) ZOSTAŁY w sklepie — to nie "kotek".
6. [x] `PetCustomizeModal` (imię+kosmetyka) — pełnoekranowy modal, `mode="edit"` (tap w
   imię na `/pet`) i `mode="onboarding"` (pierwsze uruchomienie, `petStore.onboarded`,
   migracja `true` dla starych zapisów żeby nie zaskoczyć istniejących userów).
   **Priorytet testu na urządzeniu**: (a) tap w imię otwiera modal z kolorami/dodatkami i
   działa jak dawny sklep, (b) reset pupila (jeśli dostępny w dev) pokazuje wymuszony
   onboarding przy starcie, (c) sklep dnia sprzedaje 3 różne itemy, kupno działa i nie da
   się kupić drugi raz tego samego dnia, (d) stare zapisy (przed tym patchem) NIE dostają
   wymuszonego onboardingu przy pierwszym otwarciu po update.
7. [x] UI slotów przy kotku + porównanie itemów — `src/components/pet/GearPanel.tsx`, nowy
   rząd 6 przycisków slotów pod sceną kotka na `/pet` (między kotkiem a kartą Misji). Tap w
   slot → modal z listą POSIADANYCH itemów tego slotu (rzadkość, wartość statu, delta vs
   aktualnie założony — kolor zielony/czerwony/szary), przycisk Załóż/Zdejmij. Pusty slot z
   kropką = masz coś nieposiadanego w tym slocie ale nic nie założone. Brak osobnego
   "plecaka" — wszystko przez sloty (S&F-owy przepływ, nie osobna lista itemów).
   **Priorytet testu na urządzeniu**: (a) po zdobyciu itemu ze skrzynki/sklepu dnia slot
   pokazuje kropkę, (b) tap w slot z pustą listą pokazuje sensowny komunikat, (c) equip/
   unequip działa i widać to od razu w UI slotu, (d) porównanie liczy się poprawnie (▲/▼).
8. [x] **Wpięcie bonusów gear w realne formuły walki/ekonomii** — SYSTEM KOMPLETNY.
   - **Rebalans PRZED wpięciem** (krytyczne): pierwsze przejście baseValue dla itemów
     procentowych dałoby mythic T5 do 45-90% z JEDNEGO itemu — dla porównania CAŁA kampania
     (22 bossy, node-owe policzenie sumy z bosses.ts) daje łącznie tylko atk+92%/dodge+72%/
     crit+36%/energyMult+75%. Jeden mityczny item przebijający całą kampanię to zepsuty
     balans (istniejące tuningi bossów zakładają TĘ pulę jako sufit). Wszystkie baseValue w
     `GEAR_ITEMS` (gear.ts) PRZELICZONE tak, żeby mythic T5 lądował na ~20-30% sumy
     kampanijnej — zauważalny dodatek, nie dominujący. zbroja T1 zostaje dokładnie jak user
     podał (+1/+5/+15), tylko T2-T5 dointerpolowane pod nowy sufit (~50 HP na mythic T5,
     ~50% z CAT_BASE_MAX_HP=100).
   - **`gearCombatBonuses()`** (gear.ts) — sumuje 4 sloty (helm/buty/obroza/talizman) na
     kształt `Bonuses{atk,dodge,crit,energyMult}` — TEN SAM kształt co `bossBonuses()` z
     lootu kampanii, więc wpięcie to proste dodanie w KAŻDYM miejscu gdzie dotąd liczono
     `bossBonuses(ownedItems)`: `app/boss-fight.tsx` (realna walka), `app/pet.tsx` (Siła
     bojowa), `app/bosses.tsx` (feed do syncRaidEnergy/syncEventEnergy), `bossProgressReport.ts`
     (eksport diagnostyczny, pola opcjonalne dla starych wywołań/testów).
   - **`gearFlatHp()`** (zbroja) — wpięte WSZĘDZIE gdzie liczy się realny sufit HP kotka:
     `petStore.healCat/resetCatHp` (realna walka, nie tylko wyświetlanie!), `boss-fight.tsx`
     (`catMax` do symulacji), `pet.tsx`/`bossProgressReport.ts` (wyświetlanie).
   - **`gearCoinsMult()`** (kolczyki) — JEDEN choke point: `boss-fight.tsx`'s `finish()`,
     wszystkie 7 gałęzi nagrody (raid/menace/campaign/event/quest/mad/mission) mnożą
     `Math.round(coins * coinsMult)` przed zapisem DO store i DO victory modala (żeby
     modal nie pokazywał innej liczby niż faktycznie przyznana).
   - 8 nowych testów w `gear.test.ts` (`gearCombatBonuses`/`gearFlatHp`/`gearCoinsMult`),
     w tym test kalibracji: pełny mityczny loadout musi zostać `toBeLessThan` sumy z całej
     kampanii — złapie regresję, jeśli ktoś kiedyś zmieni baseValue bez przeliczenia.
   **Priorytet testu na urządzeniu**: (a) Siła bojowa na `/pet` rośnie po założeniu itemu,
   (b) max HP kotka w walce faktycznie rośnie (nie tylko na ekranie stat), (c) nagroda
   monet po wygranej faktycznie większa z założonymi kolczykami, (d) żadna walka nie stała
   się "za łatwa" na oko (subiektywna ocena, symulacja node'em to tylko dolna granica).

## 🆕 Duży animowany kafelek misji + anulowanie z potwierdzeniem — NIEsprawdzone (2026-08-19)

User: "jak pupil jest w trakcie misji to może zrobić jednak większy ten kafelek jakby z
paskiem ładowania podróży animowanym ładnym kotka zrobić jakby tak na boki się lekko gibał
jakby szedł, i z przyciskiem wróć natychmiast z potwierdzeniem (JEŻELI CHCESZ ANULOWAĆ NIE
OTRZYMASZ NAGRODY ZA MISJĘ)". Mały placeholder ("Pupil poszedł na misję…" + ikonka kompasu) na
scenie Pupila zastąpiony dużym kafelkiem:

1. **Duży, animowany kotek** — pełny `CatArt` (żywe idle: mrugnięcia, ogon) owinięty w wolne
   wahadło rotacji (-7°→7°, ~1s w każdą stronę) — wygląda jak chodzenie, nie podskakiwanie.
2. **Pasek postępu + odliczanie** — ten sam postęp co mała karta Misja niżej (ta zostaje,
   nie usunięta).
3. **"Wróć natychmiast"** — przycisk z potwierdzeniem (Alert): jeśli anulujesz, misja się
   kończy natychmiast, ale BEZ nagrody (nowa akcja `cancelMission()` w `petStore.ts`).

Pełny opis w ARCHITECTURE §9 (szukaj "Placeholder rozbudowany na duży"). **Priorytet testu:**
(a) wyślij misję, sprawdź czy kotek na scenie realnie kołysze się na boki (nie tylko mruga);
(b) sprawdź czy pasek postępu na dużym kafelku i ten na małej karcie Misja pokazują to samo;
(c) w trakcie misji dotknij "Wróć natychmiast", potwierdź w dialogu — misja powinna się
natychmiast zakończyć BEZ żadnej nagrody (można od razu wysłać kolejną).

## 🐛 8 z 22 bossów kampanii pokazywało "undefinedundefined" zamiast symboli — NIEsprawdzone (2026-08-19)

User przesłał screenshot listy Bossy — część zablokowanych (jeszcze nie odblokowanych) bossów
pokazywała np. "◆undefinedundefined" zamiast trzech mistycznych symboli. Realny bug w
`mysteryBossName()` (`bosses.ts`): `>>` (signed shift) zamiast `>>>` (unsigned) na hashu który
mógł mieć bit 31 ustawiony — dla ~połowy bossów wychodził ujemny indeks tablicy, co w JS daje
`undefined` zamiast zawinięcia. Zweryfikowane node'em że dokładnie 8 bossów (dragon, scroll,
stress, procrast, jaguar, piratecapitan, princess, wizard) miało ten problem — wszystkie
naprawione. Dodany też mocniejszy test (cały roster + 200 syntetycznych id, sprawdza brak
"undefined" w wyniku) — stare testy przypadkiem nie łapały tego bugu.

Pełny opis w ARCHITECTURE §9 (szukaj "8 z 22 bossów"). **Priorytet testu:** wejdź na listę
kampanii, przewiń przez wszystkich zablokowanych bossów — każdy powinien pokazywać dokładnie 3
symbole (np. "✦✧☽"), żaden nie powinien zawierać słowa "undefined".

## 🐛 Kontratak zaokrąglał się do 0 przy niskim HP + pigułki energii w kolumnie — NIEsprawdzone (2026-08-19)

Follow-up po poprzednim fixie ("kotek atakuje 2 raz"). User zapytał czy to samo dotyczy
kampanii/questów — przejrzałem świeży log walk questowych na jego prośbę i NIE znalazłem tam
żadnej fikcyjnej rundy (potwierdzone przez dane, nie zgadywanie: rescaling z buga raid/nemesis
jest unikalny dla tamtych trybów). Ale znalazłem PRAWDZIWY, mniejszy bug w tych samych danych:
boss przy 1-20 HP (żywy!) miał kontratak zaokrąglony w dół do "0" (`Math.round(1×0.05)=0`), co
wyglądało jak "boss już martwy, ale dostaje kolejny cios" — myląca kombinacja, nie duplikat.

1. **Kontratak nie zaokrągla już do zera** — żywy boss (`hp>0`) zadaje teraz zawsze co najmniej
   1 obrażenie na kontratak (`Math.max(1, ...)` w `counterDamage()`, `bosses.ts`), niezależnie
   jak mało HP mu zostało. Martwy boss dalej nie kontratakuje.
2. **Pigułki energii w kolumnie, nie w rzędzie** — user doprecyzował layout: czerwona
   (wydarzenia) NA GÓRZE, niebieska (kampania) POD NIĄ, obie w prawym górnym rogu.

Pełny opis w ARCHITECTURE §9. **Priorytet testu:** stocz walkę do samego końca przy niskim HP
bossa (kampania/quest/misja), sprawdź czy kontratak w przedostatniej rundzie NIE pokazuje "0"
mimo że boss jeszcze żyje — oraz czy prawy górny róg ekranu Bossy pokazuje czerwoną pigułkę NAD
niebieską (kolumna), nie obok siebie.

## 🐛 Energia kampanii nigdy się nie ładowała + kotek atakował martwego bossa w raid/nemesis — NIEsprawdzone (2026-08-19)

User: "energia nie ładuje się wgle pisze ciągle ze za 3h odnowienie xdd ale czekam od wczoraj i
nic" + "często w walce pod koniec kotek atakuje 2 raz jakby czasami nawet jak przeciwnik ma zero
HP". Dwa realne bugi, oba naprawione:

1. **Energia nigdy realnie się nie ładowała** — `onRehydrateStorage` (odpala się przy KAŻDYM
   starcie apki, nie tylko raz) zerowało `energyRegenAt` BEZ WARUNKU za każdym razem, więc
   zamknięcie i otwarcie apki resetowało tykający zegar z powrotem do pełnych 3h — licznik
   nigdy nie mógł dojść do zera przy normalnym korzystaniu. Migracja teraz gated (tylko dla
   naprawdę starego stanu). Przy okazji: prawy górny róg ekranu Bossy dostał DRUGĄ (czerwoną)
   pigułkę energii wydarzeń obok niebieskiej kampanijnej.
2. **Kotek atakował już martwego bossa w raid/nemesis** — animacja sesji zawsze grała pełną
   długość rund, nawet gdy prawdziwa (trwała) pula HP już dawno spadła do zera w środku sesji —
   widoczne jako "dodatkowe ciosy" pod koniec walki. Teraz animacja zatrzymuje się dokładnie w
   momencie gdy realna pula wyzerowuje się, zamiast kontynuować fikcyjne rundy.

Pełny opis w ARCHITECTURE §9 (szukaj "BUG: energia kampanii" i "BUG: kotek atakował"). **Priorytet
testu:** (a) wydaj energię kampanii do zera, ZAMKNIJ i otwórz apkę kilka razy w trakcie
oczekiwania (nie zostawiaj jej cały czas otwartej) — sprawdź czy licznik "Kolejna energia za..."
realnie maleje między sprawdzeniami, nie resetuje się do 3h za każdym razem, i czy punkt energii
faktycznie dochodzi po ~3h; (b) stocz kilka sesji raidu/nemesis blisko dobicia trwałej puli do
zera, sprawdź czy walka kończy się DOKŁADNIE na ostatnim realnym ciosie, bez dodatkowych "pustych"
ataków po tym jak pasek HP już pokazuje 0.

## 🆕 MAD +15% HP (nie +30%) + itemy bojowe: droprate tierowany wg skrzynki — NIEsprawdzone (2026-08-18)

Dwie osobne, ale tego samego dnia zmiany:

1. **MAD +15% HP** — user chciał +30% ("2x-4x trudniejsze, nie wiem jeszcze na pewno"), ale
   throwaway-symulacja pokazała że dosłowne +30% łamie winnability świeżo po odblokowaniu (Lv15,
   ~45% winrate/55% faintRate na order6). +15% (`MAD_HITS_MULT` w `madBosses.ts`) to sprawdzony
   bezpieczny sufit — jawnie NIE dano usera dokładnie tego o co prosił, wyjaśnione w PR-ie.
2. **Itemy bojowe — większy droprate, tierowany wg skrzynki** (user: "najsłabsze [zdobycie]
   niech lecą na niższych gorszych boksach, lepsze poziomy [ulepszenia] na trudniejszych") —
   `COMBAT_ITEM_DROP_CHANCE_BY_TIER` w `crates.ts` zastąpił flat 1%: `basic=0`, `rare=3%`,
   `epic=8%`, `legendary=18%`. `basic`/`rare` dają tylko NOWY nieposiadany item (poziom 1).
   `epic`/`legendary` PREFERUJĄ darmowy +1 poziom już posiadanemu itemowi (nowa gałąź w
   `openCrate()`, `petStore.ts`) — nowy item to tam fallback. To DRUGI, równoległy tor obok
   istniejącego płatnego (monety) `upgradeCombatItem`, nie zastępuje go.

Pełny opis w ARCHITECTURE §9. **Priorytet testu:** (a) pokonaj kilka MAD bossów tuż po Lv15,
sprawdź czy realnie trudniejsze ale wygrywalne; (b) otwórz kilka skrzynek sardynek różnych
tierów (głaskanie do pełnej afekcji), sprawdź czy epic/legendary faktycznie czasem dają "⬆️
poziom" zamiast/obok "🎁 nowy item", a basic/rare nigdy nic nie dają z itemów.

## 🆕 Bossy trudniejsze (COUNTER_PCT 0.05) + bez "trofeów" + MAD od Lv15 — NIEsprawdzone (2026-08-18)

User przesłał świeży log walk (kotek kończył KAŻDĄ walkę na 45-70% pełnego HP, nigdy realnie
blisko zemdlenia) z komentarzem: "1. z bossów nagrody wypierdzielaj trofea cały czas pisze że
coś dostałem xd wywalmy te trofea, 2. bossy muszą być trudniejsze zobacz na log i pomyśl, 3. tak
samo bosy mad wersje muszą być bardzo trudne i dajmy je od 15 lvl jednak". Trzy zmiany:

1. **Trudniejsze bossy** — `COUNTER_PCT` (kontratak jako % AKTUALNEGO hp bossa, `bosses.ts`)
   podbite 0.04→0.05, WSPÓLNE dla wszystkich 6 trybów walki (kampania/raid/event/quest/mad/
   misja — jeden silnik). Zwalidowane throwaway-symulacją PEŁNEGO rosteru 22 bossów kampanii z
   profilem inwestycji skalibrowanym wprost na realnych danych z logu (Lv9, atkStatBonus=20,
   catMaxHpBonus=40) — 100% winrate przy takiej inwestycji na CAŁYM rosterze, ale realnie
   odczuwalna trudność (avgLoss ~45-75% zamiast ~35-60%, worstLoss do 90%+). 0.06 już WALI
   kilku bossów do 0% winrate przy lżejszej inwestycji, więc 0.05 to sprawdzony bezpieczny sufit.
2. **MAD bossy od Lv15 zamiast Lv50** (`MAD_UNLOCK_LEVEL` w `madBosses.ts`) — dostępne dużo
   wcześniej, gdy gracz ma naturalnie mniej inwestycji, co samo w sobie robi je "bardzo trudne"
   względem punktu w grze. `madHitsFor` (liczba ciosów do zabicia) ŚWIADOMIE nietknięte —
   symulacją sprawdzono że MAD hp liczy się z ŻYWEJ, aktualnej mocy gracza (nie zamrożonej jak
   kampania), więc podbijanie hits tam jest dużo bardziej ryzykowne (kwadratowy wzrost
   skumulowanego kontrataku) niż w kampanii.
3. **Victory modal bez "trofeów"** (`app/boss-fight.tsx`) — box z ikoną+"Medal tygodnia"/
   "Nagroda questu"/itd. (bez prawdziwego itemu) renderuje się TERAZ tylko dla kampanii
   (prawdziwy przedmiot ze statem). Raid/event/quest/mad/misja pokazują tylko monety+XP,
   bez fałszywego "zdobyłeś trofeum" przy każdej (bardzo częstej) walce.

Pełny opis w ARCHITECTURE §9 ("Trudność bossów podbita"). **Priorytet testu:** (a) stocz kilka
walk kampanii/raid/questa/misji, sprawdź czy kotek realnie kończy bliżej zera HP niż wcześniej
(nie musi ginąć, ale powinno czuć się bardziej "na styk"); (b) sprawdź że victory modal dla
questa/misji/raidu NIE pokazuje już żadnego boxa z ikoną/nazwą "medalu", tylko monety+XP; (c)
jeśli masz Lv15+, sprawdź czy MAD jest już dostępny (wcześniej wymagał Lv50) i czy faktycznie
czuje się zauważalnie trudniejszy niż zwykła kampania na tym samym poziomie.

## 🆕 Nemesis: trwały bank HP bez timera/limitu prób, sezonowe z podbitym HP — NIEsprawdzone (2026-08-18)

User (po ustaleniu podziału na sezonowe vs nemesis w rozmowie o balansie ekonomii): "wyłączyć
czas tym eventowym i zostawić tylko sezonowe bossy że mają dużo HP, wspólną energię... a ten
drugi [nemesis] niech nie ma timera tylko pasek zdrowia większy, ma nielimitowany czas i próby
podejścia ale ma wpizdu HP żeby go długo klepać... dobre nagrody, szansa na item kilka prc, XP
sporo i golda". Sezonowe (Mikołaj/Wielkanoc/Wakacje/4×mitologiczne) BEZ zmian w mechanice —
tylko HP podbite +50%. Nemesis (`kind='menace'`, Widmo Nadgodzin / Demon Słodyczy) przebudowany
na TRWAŁY bank HP dokładnie jak raid: sesyjne ataki (bez zużywania energii — nielimitowane
próby), pasek zdrowia zamiast statycznego "X HP", bez timera/odliczania, nagroda przy pokonaniu
= coins/xp (wyższe niż raid) + `MENACE_ITEM_DROP_CHANCE=8%` szansa na przedmiot bojowy. Klucz
identyfikacji zmieniony z `<id>-<rok>-<miesiąc>` (reset co miesiąc) na goły `boss.id` (trwały,
przetrwa zmianę miesiąca). Pełny opis w ARCHITECTURE §9 (szukaj "Nemesis... przebudowany na
TRWAŁY bank HP"). **Priorytet testu:** (a) wejdź w nemesis (musisz mieć realną przewagę
work-hours/sweets-spend nad swoją średnią żeby się pojawił — jeśli nie widzisz karty, to
normalne, `pickMenace` zwraca `null` przy braku danych/w normie), sprawdź czy karta pokazuje
PASEK HP (nie liczbę + energię) i BRAK odliczania dni; (b) zaatakuj kilka razy pod rząd —
sprawdź że NIE ma komunikatu "brak prób" (nielimitowane), pasek realnie spada między próbami i
PRZETRWA zamknięcie/otwarcie ekranu; (c) jeśli masz cierpliwość dobić bank do zera — sprawdź
ekran "NEMESIS POKONANY!" i czy czasem pokazuje się "🎁 Nowy item bojowy"; (d) osobno sprawdź że
sezonowy event (jeśli akurat trwa jakiś sezon w kalendarzu) dalej ma odliczanie dni i pigułkę
energii, niezmieniony poza wyższym HP.

## 🆕 Kotek na pasku misji podskakuje + znika ze sceny gdy w misji — NIEsprawdzone (2026-08-18)

User ze screenshotem: "tylko on miał tam podskakiwać jak w tych paskach na dashboardzie xd, i
miał znikać z ekranu że niby jest w misji czaisz???". Dwa fixy do wcześniejszego "kotka na
pasku": (1) mini-kotek na pasku misji teraz PODSKAKUJE (prosta pętla bounce, nie próbowaliśmy
włączać wewnętrznego systemu animacji CatArt — zbudowany pod co innego); (2) GŁÓWNY portret
kotka na scenie Pupila ZNIKA i zastępuje go placeholder "Pupil poszedł na misję…" dopóki
misja trwa (wraca gdy `missionReady`). Pełny opis w ARCHITECTURE §9. **Priorytet testu:**
wyślij misję, sprawdź czy główny kotek na scenie znika (placeholder z kompasem zamiast
niego), i czy mini-kotek na pasku misji realnie podskakuje w miejscu.

## 🆕 Energia kampanii: regeneracja w czasie (2/bank, +1 co 3h) zamiast "1 boss dziennie" — NIEsprawdzone (2026-08-18)

User, po pytaniu o gate "1 boss dziennie" (wprowadzony 2026-08-17): "uznałem wtedy że szybko
poszło bo bossy zaczynałem od resetu i od razu pokonałem wszystkie z samych nagród bez
jakichkolwiek wymagań... wolałem zamiast jeden dziennie raz na 3h atak może? i maksymalnie
regeneruje się do 2 energii". Sztywny dzienny gate (`lastCampaignDefeatDate`) CAŁKOWICIE
usunięty, zastąpiony organiczną regeneracją: bank energii kampanii/MAD 0..2, +1 co 3h w
czasie rzeczywistym (nie o północy). Pełny opis w ARCHITECTURE §9. Raid/wydarzenie BEZ zmian
— to tylko energia kampanii. **Priorytet testu:** wydaj oba punkty energii, sprawdź czy hero
card na liście bossów pokazuje "Kolejna energia za Xh Ymin", poczekaj/zmień czas systemowy
telefonu żeby sprawdzić czy realnie dochodzi punkt po ~3h (albo zrób export/import stanu z
przesuniętym `energyRegenAt` jeśli wolisz nie czekać naprawdę).

## 🆕 Misja: kotek na pasku + blokuje inne walki + wybór profilu (balanced/gold/xp) — NIEsprawdzone (2026-08-18)

User (z opisem screenshota): "jak kto jest w podróży to musi przeskalowywać się na pasek
podróży... pasek kotek wskakuje i tak jakby porusza się z progresem misji i wtedy nie może
walczyć w innych z bossem zanim nie wróci a zamiast niego jest napis w trakcie misji... i
trzeba zrobić że mam jak w sfgame że mogę wybrać misję czy pod złoto czy pod XP że jedna ma
trochę więcej gold a druga XP i mogą być 3 do wyboru". Trzy części, wszystkie zrobione:

1. **Kotek "w podróży" na pasku misji** — mały `CatArt` (dokładnie Twoja kolorystyka/dodatki,
   bez nowych assetów) jeździ po pasku postępu zgodnie z % ukończenia misji.
2. **Misja blokuje pozostałe tory walki** — dopóki pupil jest w misji, kampania/raid/event/
   quest/MAD pokazują "Pupil jest w trakcie misji — wróć jak dotrze" zamiast pozwolić walczyć.
3. **Wybór profilu misji** — ekran Pupila pokazuje TERAZ 3 opcje wysyłki (Zbalansowana/Więcej
   złota/Więcej XP), każda z własnym podglądem nagrody i przyciskiem Wyślij. Ten sam czas
   trwania dla wszystkich, tylko coins↔xp się przesuwa.

Pełny opis w ARCHITECTURE §9. **Priorytet testu:** (a) wyślij misję, sprawdź czy kotek na
pasku wygląda jak Twój prawdziwy kotek i realnie się porusza z upływem czasu; (b) w trakcie
misji spróbuj wejść w kampanię/raid/event — powinno pokazać blokadę, nie pozwolić walczyć;
(c) na ekranie wysyłki sprawdź czy widać 3 opcje z różnymi nagrodami, i czy po powrocie
dostajesz nagrodę zgodną z tym co WYBRAŁEŚ przy wysyłce (nie zawsze balanced).

## 🆕 Bossy dalej w kolejności = mystery (czarna sylwetka + symbole zamiast nazwy) — NIEsprawdzone (2026-08-18)

User: "musimy zrobić że mają znaki zapytania i ciemne kształty... a ich nazwy to jakieś
mityczne znaki, że nie wiadomo o co chodzi i co to dopóki nie pokonasz wcześniejszego".
Lista bossów kampanii dotąd zdradzała prawdziwy portret+nazwę KAŻDEGO bossa, nawet tych
daleko w kolejności (tylko HP/temat były ukryte). Teraz zablokowane pozycje (`lock`) pokazują
czarną sylwetkę (prawdziwy kształt bossa, ale bez koloru/detalu — `BossArt mystery` prop) i
placeholder-nazwę z 3 mistycznych symboli (`mysteryBossName(id)`, deterministyczne — ten sam
boss zawsze ten sam placeholder). Bez custom fontu — gotowy Unicode wystarczył. Pełny opis w
ARCHITECTURE §9. **Priorytet testu:** otwórz listę bossów kampanii, sprawdź że pokonany ✓ i
aktualny ▶ boss wyglądają normalnie (pełny portret+nazwa), a WSZYSTKIE dalsze pozycje mają
czarną sylwetkę + dziwne symbole zamiast nazwy, nie prawdziwy portret/imię.

## 🆕 Skrzynka dnia = kwadratowy przycisk w headerze — NIEsprawdzone (2026-08-18)

User: "skrzynka daily powinna być jako square button chyba przy overlayu bo ona ginie w
tych taskach". Przeniesiona z pełnoszerokościowego wiersza między questami do `s.header`
(pasek nad `ScrollView`, zawsze widoczny) jako 40×40 przycisk obok `coinPill`, widoczny
TYLKO gdy jest coś do odebrania. Pełny opis w ARCHITECTURE §9. **Priorytet testu:** otwórz
Pupila, sprawdź czy widać kwadratowy przycisk z prezentem w headerze (gdy skrzynka nieodebrana
dziś) i czy znika po odebraniu.

## 🆕 Osłabianie bossów realnymi seriami USUNIĘTE — NIEsprawdzone (2026-08-18)

User: "wywalić chyba musimy osłabienia bossów na nawyki itp, bo problemem jest to że wtedy
bardzo ciężko balansować je będzie za dużo zmiennych". Mechanika z `src/utils/bossWeakness.ts`
(2026-08-13, patrz historia niżej) obniżała effective HP bossa o -1%/dzień realnej serii w
jego kategorii słabości (max -35% przy 35+ dniach) — dodawała TRZECI, poza-kontrolny wymiar
do balansu (obok poziomu i łupu), przez co żaden balance-pass throwaway-symulacją (patrz cała
historia tej sesji z bossami) nie mógł uwzględnić "a co jeśli gracz ma jeszcze 30-dniową
serię" bez eksplozji liczby scenariuszy do sprawdzenia.

**Usunięte:** `src/utils/bossWeakness.ts` + `__tests__/bossWeakness.test.ts` skasowane,
`boss-fight.tsx` nie liczy już `weaknessStreaks`/nie wywołuje `weakenBoss()` na żadnym
celu (campaign/raid/event/mad), UI-notka "Osłabiony: X dni serii → -Y% HP" zniknęła, razem
z martwymi po tym hookami (`useMoodStore`/`useHabits`/`getHealthHistory` w tym pliku były
używane WYŁĄCZNIE pod tę mechanikę). `weakness`/`weaknessLabel` na `Boss` ZOSTAJĄ — to teraz
CZYSTY flavor/temat (kolor aury, "Motyw: X" na hero card), bez żadnego efektu na hp. **Boss
hp wraca do CZYSTEGO wzoru** level+order+loot+items, bez trzeciego, realno-życiowego wymiaru
— dokładnie to o co prosił user, powinno realnie ułatwić kolejne balance-passy.
**Priorytet testu:** walka z dowolnym bossem NIE powinna już pokazywać notki "Osłabiony: X
dni serii" niezależnie od realnych serii w grze.

## 🆕 bossAttackFx USUNIĘTE permanentnie (bomby/ogień/etc. na kaflu bossa) — NIEsprawdzone (2026-08-18)

User po doprecyzowaniu (patrz sekcja niżej, punkty 3-4): "z nie działających to właśnie te
bomby/pociski one hujowe pojawiały się tylko na sobie samym robiły skaling up i znikały
zadając dmg na odległość dziwnie xd wywalmy je wgle zamieńmy ten atak wgle (i usuń plik ten
permanentnie)". Zestawił to z DZIAŁAJĄCYMI wzorcami: pocisk lecący (łapka kota, magia) i
burst-na-celu (pazury) — oba zostają bez zmian. `src/utils/bossAttackFx.ts` usunięty
plikiem, cały jego import/użycie wyczyszczone z `boss-fight.tsx` (włącznie z martwym
`bPop` — był używany wyłącznie pod ten efekt). Pełny opis w ARCHITECTURE §9. Efekt: "Twój
cios ląduje na bossie" wygląda teraz identycznie we wszystkich 6 trybach (flash+shake+dmg),
tak jak raid/event/quest/mad/misja miały od zawsze. **Priorytet testu:** stocz kilka walk
kampanii (w tym z Cukrowym Potworem) i potwierdź że nie ma już żadnego "bombowego"
błysku/skanowania na bossie — tylko czerwony/żółty flash + trzęsienie + liczba obrażeń.

## 🐛 Zgłoszenia z eksportu #3 (2026-08-18) — częściowo wyjaśnione, jedno wymaga doprecyzowania

User przysłał kolejny eksport + opis trzech obserwacji w jednej wiadomości:

1. **"boss eventowy szedł poniżej zera i dalej się z nim napierdalałem, dopiero wtedy
   widziałem poprawnie jego animację ataku"** — timestampy tamtych walk (17.08, 22:22-22:26)
   są SPRZED merge fixu podwójnego stuknięcia WALCZ! (patrz sekcja niżej, zmergowane
   ~22:39 tego samego dnia) — najpewniej to DOKŁADNIE ten sam, już naprawiony race (dwie
   równoległe walki nadpisujące ten sam HP tłumaczą i HP<0, i "dopiero wtedy" pełniejszą
   animację — de facto dwie nakładające się sekwencje). **Nie zakładać naprawione bez
   potwierdzenia** — priorytet: powtórz świadomie na NAJNOWSZYM buildzie (po PR #23) i
   sprawdź czy nadal się zdarza.
2. **"nie wiem czy resetuje go reset"** — TAK, potwierdzone w kodzie: `petStore.reset()`
   czyści `eventWon`/`eventEnergy*` razem z resztą postępu (patrz linia z `reset:` w
   `petStore.ts`). Nie wymaga fixu, tylko odpowiedzi.
3.–4. **"cukrowypotwór te bomby... animacja skanowania i znikania i tyle" / "nadal nie
   naprawiłeś tej animacji wtedy wychodzi"** — DOPRECYZOWANE i NAPRAWIONE (patrz sekcja
   "bossAttackFx USUNIĘTE" niżej): user nie mylił która strona dostaje dmg (to zrozumiał) —
   chodziło o samą JAKOŚĆ animacji, statyczny scale+fade w miejscu czytał się jako płaskie
   "skanowanie", nie realny cios ("wychodzi" = obrazek bomby "wychodzi"/pojawia się i znika,
   nie crash aplikacji jak wcześniej podejrzewałem). User porównał to do DZIAŁAJĄCYCH
   wzorców (łapka/magia lecące, pazury pojawiające się na celu) i kazał usunąć per-bossowy
   burst CAŁKOWICIE — zrobione, `bossAttackFx.ts` usunięty permanentnie.

## 🐛 Podwójne stuknięcie WALCZ! = dwie walki naraz (przez to "przerywa"/"kotek nie do zera") — NIEsprawdzone (2026-08-17)

User (po pierwszym eksporcie z nowym przebiegiem runda-po-rundzie — patrz sekcja niżej):
"zdarza się że walka jak boss ma mało HP jakiś to nie atakuje jakby pomija jego rundę i
atakuje pupila i go zabija, a w tym eventowym gościu problem że kotek nie schodzi do zera
HP, czasami walka przerywa zanim jedna ze stron zejdzie do zera". Znalezione statycznie
(bez możliwości odtworzenia na urządzeniu): `attackRoundBased()` gate'ował się TYLKO stanem
`fighting` z domknięcia poprzedniego renderu, a przycisk WALCZ! wyglądał na wygaszony ale
NIE był realnie `disabled` w `PressableScale` — szybkie podwójne stuknięcie mogło odpalić
DWA równoległe łańcuchy animacji walki naraz, każdy ze swoim wynikiem symulacji, oba
nadpisujące ten sam, współdzielony `catHp`/`liveBossHp`. Dokładny opis fixu (dwie warstwy:
`fightingRef` + prawdziwy `disabled`) w ARCHITECTURE §9 przy boss-fight.

**Priorytet testu:** spróbuj świadomie zrobić szybkie podwójne stuknięcie WALCZ! (np. dwa
szybkie tapy pod rząd) i sprawdź, czy walka wygląda spójnie (jedna sekwencja rund, HP obu
stron kończy dokładnie na 0 lub na wartości zgodnej z logiem). Jeśli po tym fixie ZNÓW
zobaczysz te same objawy mimo NIE podwójnego stukania — to znaczy że hipoteza była błędna i
trzeba szukać dalej (nowy eksport z przebiegiem runda-po-rundzie z tamtej konkretnej walki
bardzo pomoże zdiagnozować, dokładnie jak tym razem).

## 🆕 bossLog: przebieg walki runda po rundzie (HP w czasie + dmg) — NIEsprawdzone (2026-08-17)

User (po zobaczeniu gate'u "1 boss/dzień" wyżej): "ty nie zapisujesz do logowania z pupila
dokładnie walk z ilością HP w czasie i dmg zadanego mi i którego zadał bossowi przez to nie
wiesz jak bardzo łatwo pokonuje bossy i jakie muszą być, zrob to ja zrestartuje i spróbujemy
ponownie". Trafna uwaga — dotąd `bossLog` (eksport "STAN PUPILA") trzymał TYLKO nagrodę z
WYGRANYCH walk (coins/xp), bez śladu jak blisko poszła walka i bez przegranych w ogóle.

**Zrobione:** każda próba walki (wygrana I przegrana, wszystkie 6 torów) loguje teraz pełny
przebieg runda-po-rundzie — `BossFightDetail`/`BossLogRound` w `petStore.ts`, pełny opis w
ARCHITECTURE §9 przy `petStore.bossLog`. Export pokazuje na próbę: wynik + liczbę rund,
trajektorię HP bossa i kotka rundę-po-rundzie, oraz listy zadanego dmg/kontrataku per rundę.

**Priorytet testu:** user zresetuje postęp (Diagnostyka → Zresetuj postęp pupila) i spróbuje
ponownie z nowym gate'em "1 boss/dzień" (patrz sekcja niżej) — jak wyeksportuje "STAN PUPILA"
tym razem, log powinien pokazać pełne dane per walkę (nie tylko podsumowanie), co pozwoli
ocenić trudność precyzyjnie zamiast na wyczucie/szacunku "~N ciosów". Stare wpisy sprzed tego
fixu (jeśli jakieś przetrwały do tego eksportu) dalej pokażą starą, krótką linię — to
oczekiwane, nie brakujące dane.

## 🆕 Raid: pełna rundowa walka + pazury nie latają + dane z rundy #2 (2026-08-17)

Trzy rzeczy z jednej wiadomości usera (wysłał realny eksport z rundy testowej #2):

1. **Pazury już nie latają jako pocisk** — user: "jak są pazury to nie mają lecieć tylko
   pojawiać się na pupila". Naprawione — teraz błyskają bezpośrednio na portrecie kotka,
   magia/miecz/pięść dalej lecą jak wcześniej. **Priorytet testu:** stocz walkę z bossem
   claw (jaguar/dinozaur/sloth/cerberus w kampanii, kraken w raidzie, demon w nemesis) —
   kontratak powinien błysnąć NA kotku, nie lecieć przez arenę.

2. **Raid dostał pełną rundową walkę** — user: "miała być zwykła walka tylko taka która nie
   restartuje jego HP jak z tym drugim [event]... ale tamta jest jakaś za łatwa". Raid był
   jedynym trybem z jedną wymianą ciosów na próbę zamiast prawdziwej wieloroundowej walki.
   Teraz: pełna animacja jak kampania, KAŻDA próba to bezpiecznie skalowana "sesja"
   (`raidSessionHpFor`, ten sam wzorzec co quest/MAD), realny postęp dopisuje się do
   PRAWDZIWEJ, trwałej puli tygodniowej (bez zmian w tym, że NIE restartuje się między
   próbami). Pełny opis + throwaway-symulacja w ARCHITECTURE §"Bossy". **Priorytet testu:**
   stocz próbę raidu, sprawdź czy widzisz kilka rund wymiany ciosów (nie jedno kliknięcie),
   czy pasek HP w arenie faktycznie się rusza, i czy po zakończeniu próby PRAWDZIWY tygodniowy
   pasek na liście bossów (`app/bosses.tsx`) zmniejszył się o tyle ile widziałeś w walce.
   Uwaga: kotek może czasem "zemdleć" w środku sesji przy pechu (wariancja) — to nie bug,
   próba i tak dopisuje częściowy postęp, spróbuj ponownie.

3. **Dane z rundy testowej #2** (eksport usera, Lv6, atkStatBonus 10, 0 itemów bojowych): 3/3
   wygrane walki kampanii (sloth ~7 ciosów, sugar guard ~14, snake ~8) w ~4 minuty od czystego
   resetu — user: "zdecydowanie za szybko to poszło, pokonałem 3 bossy od zera nie mając nic
   praktycznie". Per-walka trudność PASUJE do zwalidowanego projektu (9-12 ciosów, ~100%
   winrate przy lekkiej inwestycji dla bossów #1-13) — root cause NIE był hp/dmg pojedynczej
   walki, tylko PACING: odblokowanie czysto sekwencyjne (bez progu poziomu, fix z
   2026-08-17 wcześniej tego dnia) + 3 dzienne próby ataku = nic nie stało na przeszkodzie
   zbiciu 3 różnych bossów w jednej sesji, gdy XP akurat starczyło na Lv6 (realny gracz
   który wypełni cały dzień questów/nawyków też może to osiągnąć pierwszego dnia).
   **Naprawione** (ten sam dzień, kolejny fix): kampania dostała gate "1 NOWY boss dziennie"
   — `lastCampaignDefeatDate` w petStore, ustawiane w `defeatBoss()`. Retry na TYM SAMYM,
   jeszcze niepokonanym bossie po przegranej zostaje darmowe (nie zmienia tej daty) —
   ograniczone jest tylko przejście do KOLEJNEGO bossa tego samego dnia. UI: `app/boss-fight.tsx`
   pokazuje lockBox z komunikatem zamiast areny, `app/bosses.tsx` wygasza przycisk WALCZ! +
   subtitle pod hero card. MAD (druga fala, endgame) świadomie NIE objęty tym gate'em — to
   osobna oś progresji. **Priorytet testu:** pokonaj bossa kampanii, sprawdź że KOLEJNY boss
   pokazuje lockBox "wróć jutro" zamiast dać się zaatakować, mimo zostałych prób ataku.

## 🆕 Reset pupila = nowa numerowana runda testowa — NIEsprawdzone na urządzeniu (2026-08-17)

User: "niech reset pupila tworzy nowy log danych jakby żeby było wiadomo które od czego" —
"Zresetuj postęp pupila" (Ustawienia → Diagnostyka) już czyścił `bossLog`/staty do zera, ale
DWA różne resety wyglądały identycznie w eksporcie ("Poziom 1, log pusty"), nie dało się ich
odróżnić przy wklejaniu kolejnych rund testowych do rozmowy. Nowe `resetGeneration`/
`lastResetAt` w `petStore.ts` rosną z każdym resetem (celowo POZA samym resetem/partialize —
to metadane o resetach, muszą przetrwać) — eksport pokazuje teraz w nagłówku `Runda testowa:
#3 (ostatni reset: ...)`. **Priorytet testu:** zrób eksport, zresetuj postęp pupila (Diagnostyka),
zrób eksport ponownie — numer rundy powinien wzrosnąć o 1, log/staty powinny być czyste.

## 🆕 Eksport pupila: ciosy przy Twoich statach + fix ikon po zmianie odblokowania (2026-08-17)

User: "ulepszyłeś te statystyki żebyśmy zebrali dane pod eksport pupila odnośnie levela walk
upgradów itp opartych na poziomie ulepszenia?" — nie było zrobione, i przy okazji poprzednia
zmiana (odblokowanie kampanii bez progu poziomu, wpis wyżej) zostawiła w eksporcie martwy
🔒 liczony ze starego progu. Naprawione + ulepszone w `utils/bossProgressReport.ts`:
- Status-ikony bossów: `✓` pokonany, `▶` aktualny cel, `·` reszta (bez 🔒/poziomu).
- Każdy wiersz bossa dostał `~N ciosów przy Twoich statach` — liczone z REALNEGO
  `atkStatBonus`/łupu gracza (nie gołe `b.hp`), z uwzględnieniem `guard` (×0.5 dmg). To
  dokładnie ta liczba, którą do tej pory liczyłem ręcznie throwaway-symulacjami przy każdej
  zmianie balansu — teraz wychodzi wprost z eksportu (Ustawienia → Diagnostyka → "Eksportuj
  postęp pupila").

**Priorytet testu:** zrób eksport, sprawdź czy `~N ciosów` przy wcześniej pokonanych bossach
z grubsza zgadza się z tym jak faktycznie poszła walka (jeśli realnie było zauważalnie więcej
rund niż `N` — sygnał że coś w formule nie łapie wariancji/krytów wystarczająco).

## 🆕 Odblokowanie kampanii bez progu poziomu — NIEsprawdzone na urządzeniu (2026-08-17)

User (testując świeżo podbitą trudność wyżej): "odblokowanie jest po pokonaniu wcześniejszego
jednak nie odświeżyło lvl pupila... ciężko jest za dużo muszę xp żeby sprawdzić nawet inne
bossy". Kampania wymagała DWÓCH warunków na kolejnego bossa: pokonać poprzedniego (i tak już
wymuszone przez kolejność) ORAZ osiągnąć jego `unlockLevel` — drugi warunek tylko spowalniał,
nie chronił przed niczym realnym (atak i tak skaluje się z prawdziwym poziomem, więc zbyt
niski poziom przeciw dalekiemu bossowi po prostu przegrywa fight, nie omija progresji).
Usunięty w `app/bosses.tsx` i `app/boss-fight.tsx` — WALCZ! na aktualnym bossie kampanii jest
teraz zawsze aktywne, jedyny warunek to energia dzienna. Raid/event/MAD progi bez zmian
(osobne, deliberatne). **Priorytet testu:** dokładnie to o co prosił user — spróbuj przejść
przez kilku kolejnych bossów kampanii bez martwienia się o poziom, sprawdź czy faktycznie nic
już nie blokuje poza energią dzienną.

**Nie zbadane** (za mało informacji do samodzielnej diagnozy): "nie odświeżyło lvl pupila" —
jeśli to nadal problem PO wgraniu tego builda, potrzebne dokładniejsze kroki odtworzenia
(gdzie dokładnie poziom wyglądał na nieaktualny — ekran Bossy? Pupil? po jakiej akcji?).

## 🆕 Trudność walk + unikatowe ataki bossów + emoji z treningów — NIEsprawdzone (2026-08-17)

User (jedna wiadomość, 2 punkty + zapowiedź trzeciego odłożonego na później):
1. **Emoji z treningów usunięte** — `TrainingSessionModal.tsx` (duży emoji na górze) i notki
   questów treningowych w `quests.ts` ("zrobione 💪" → "zrobione"). Same nazwy ćwiczeń zostają.
2. **"Walki są zbyt łatwe"** — throwaway-symulacja znalazła coś WAŻNIEJSZEGO niż "za łatwe":
   `guard` (ciosy ×0.5) w połączeniu z liczeniem kontrataku od aktualnego hp bossa PODWAJAŁ
   skumulowane obrażenia na kotka — **boss #22, finał kampanii (Iluzja Kontroli), był w
   praktyce niewygrywalny** nawet z realną inwestycją, nie tylko trudny. Naprawione
   (`counterDamage` tnie kontratak o połowę gdy `guard`). Do tego bossy #1-13 (Lv2-46)
   dostały wyraźnie więcej HP (docelowe 9-12 ciosów zamiast 6-10.6) — zwalidowane symulacją,
   dalej 100% winrate przy realistycznej (nie zerowej) inwestycji, ale trudniejsze. Bossy
   #14-22 (Lv52+, "elite") CELOWO nietknięte — to już raz było znanym problemem (audyt 14.08),
   podbijanie dalej bez pełnego audytu groziłoby powtórką. **Priorytet testu:** stocz walkę z
   wczesnym bossem (powinna trwać wyraźnie dłużej niż wcześniej, ale wygrywalna), i jeśli masz
   pokonanego bossa #22 (Iluzja Kontroli) na koncie z gorszym wynikiem niż się spodziewałeś —
   to była właśnie ta luka.
3. **Unikatowe ataki bossów wg typu** — drapieżniki (sloth/doubt/jaguar/dinosaur) drapią
   pazurami (różowa `HandGrab`), magowie (compare/procrast/wizard + mitologiczne event-bossy
   wiosna/jesień/zima/overtime) rzucają kulą magiczną (fioletowe `Sparkles`), wojownicy z
   mieczem (samurai/piratecapitan) tną mieczem (szary `Sword`) — reszta rosteru (kampania/
   raid/event/MAD/questy/misje) zostaje przy uniwersalnej czerwonej pięści, DOKŁADNIE jak
   user chciał. **Priorytet testu:** stocz walkę z jaguarem/dinozaurem (pazur), magiem/
   wizardem (kula magiczna), samurajem/kapitanem (miecz) — sprawdź czy kontratak faktycznie
   zmienia ikonę/kolor między nimi i wygląda sensownie w locie.

**Odłożone na później, wprost na życzenie usera** ("dawaj naprawiaj, potem zajmiemy się
optymalizacją"): walki lagują, kotek ma być trochę większy, i/lub animacje uproszczone/
statyczne żeby nie obciążały ekranu walki. NIE dotknięte w tym przejściu.

**Do przekazania do optymalizacji**: Ustawienia → Diagnostyka → **"Eksportuj postęp pupila"**
(`bossProgressReport.ts`, `Share.share`) — tekstowy raport (poziom/staty/pokonani bossowie/
log walk), już istniejący, gotowy do wyeksportowania i przesłania.

## 🆕 Druga pula energii na bossy eventowe — NIEsprawdzone na urządzeniu (2026-08-17)

User: "mam tam 7 energii a nie mogę walczyć dodatkowo, może zróbmy że jak mam energię na
bossy to energia na bossy, a mam drugą inną energię łącznie na bossy eventowe" — event miał
FLAT 1 próbę/dzień niezależnie od `energyMult` z łupu kampanii, czyli inwestycja w energyMult
nic nie dawała TAM gdzie ma teraz twardy termin (odliczanie z wczoraj). Nowa funkcja
`eventDailyAttempts` w `bosses.ts` — skaluje się z energyMult jak kampania, ale wyraźnie
słabiej i z twardym capem na 3 (kampania przy pełnej inwestycji daje 5). Pełny opis w
ARCHITECTURE §"Bossy". **Priorytet testu:** zbierz trochę energyMult z łupu (pokonaj kilku
bossów kampanii dających `bonus.energyMult`), sprawdź czy licznik energii eventowej w
mini-karcie (`app/bosses.tsx`) pokazuje więcej niż 1, i czy realnie idzie stoczyć więcej niż
jedną walkę eventową danego dnia.

## 🆕 Nagłówek Pupila v2 + łapka koloru kotka + fix aury raidu — NIEsprawdzone (2026-08-16)

Trzy rzeczy z jednej wiadomości usera:
1. **Nagłówek Pupila przebudowany drugi raz tego dnia** — teraz dwukolumnowy: nazwa+edycja
   i "samopoczucie" (moodChip) po lewej, cienki pasek poziomu i pasek głaskania po prawej
   (ta sama linijka co nazwa). Przycisk "Pogłaskaj pupila" z poprzedniej wersji USUNIĘTY —
   user: "po co on xd" — tap na kota zostaje jedynym sposobem głaskania. **Priorytet testu:**
   otwórz Pupila, sprawdź czy nagłówek czyta się dobrze (nazwa nie ucieka pod długi pasek
   przy wąskim ekranie), czy tap na kota dalej napełnia pasek w prawej kolumnie.
2. **Łapka-pocisk w walce koloru kotka** — była na sztywno różowa, teraz `palette.coat` (ten
   sam kolor co portret). **Priorytet testu:** stocz dowolną walkę z kotkiem NIE-niebieskim
   (domyślny kolor), sprawdź czy lecąca łapka ma jego prawdziwy kolor sierści.
3. **Fix: rajdowy boss tracił czerwoną aurę na ekranie przegranej** — `powered` prop nie był
   przekazywany w modalu przegranej dla `kind==='raid'` (tylko dla `mad`). Naprawione.
   **Priorytet testu:** przegraj walkę rajdową (celowo, np. bez leczenia kotka), sprawdź czy
   modal przegranej pokazuje bossa z czerwoną poświatą tak jak modal zwycięstwa.

**Nadal blokowane na nowym arcie od usera** (nie coś do naprawienia kodem): `behemoth`/
`wyrm`/`siren` (raid) i Zły Mikołaj/Czekoladowy Zajączek/Widmo Nadgodzin/Demon Słodyczy
(event) wciąż bez dedykowanego PNG — patrz sekcja niżej "Rajdowe bossy" / "4 portrety
event-bossów".

## 🆕 Przebudowa layoutu zakładki Pupila — NIEsprawdzone na urządzeniu (2026-08-16)

User: "zadania i ta walka jest za nisko, może lepiej wywalić potrzeby jego bo to nic nie
mówi i głaskanie zrobić, i nazwę zbić bo tam nad pupilem zajmuje w pizdu miejsca." Zmiany w
`app/pet.tsx` (pełny opis w ARCHITECTURE §9):
1. Sekcja "Potrzeby dziś" (paski needs) **usunięta całkowicie** z ekranu.
2. W jej miejscu — jawny przycisk **"Pogłaskaj pupila"** (ikonka serca, wcześniej głaskanie
   działało tylko przez ukryty tap na sprite'a kota).
3. **Misja / Nieodebrane z wczoraj / Codzienne / Bonusowe dziś** (wszystkie z "Walcz")
   przeniesione WYŻEJ — zaraz pod głaskaniem, przed skrzynką dnia/poziomem.
4. Nazwa kotka nad postacią zmniejszona (24px→16px) + ciaśniejsze marginesy, żeby cała góra
   ekranu zajmowała mniej miejsca.
**Priorytet testu:** otwórz Pupila, sprawdź czy questy/misja/walka są widoczne bez (albo z
minimalnym) przewijaniem, czy przycisk głaskania faktycznie napełnia pasek afekcji tak samo
jak tap na kota, i czy nic się wizualnie nie rozjechało (skrzynka dnia/poziom/tygodniowe dalej
działają, tylko niżej).

## 🆕 Odliczanie do końca eventu — NIEsprawdzone na urządzeniu (2026-08-16)

User: "dodajmy terminy z odliczaniem za ile kończy się event boss, żeby realnie móc go
wygrać" — mini-karta w `app/bosses.tsx` i ekran walki (`boss-fight.tsx`, kind=event) pokazują
teraz "Kończy się za X dni" (czerwony ≤1 dzień, żółty ≤3 dni). Pełny opis w ARCHITECTURE
§"Bossy". **Priorytet testu:** otwórz Bossy podczas aktywnego eventu/nemesis, sprawdź czy
liczba dni wygląda sensownie (np. w środku okna Mikołaja powinno pokazać kilkanaście dni).

## 🐛 5 zgłoszeń usera w jednej wiadomości — naprawione, NIEsprawdzone na urządzeniu (2026-08-15)

1. **Kolor/dodatki kotka nie zgadzały się w walce** — `boss-fight.tsx`'s `<CatArt>` w ogóle
   nie dostawał `palette`/`stripes`/`eyeColor`/`noseColor`/`whiskers`/`legStripes` (jedyne
   takie miejsce w kodzie — pet.tsx/pet-shop.tsx/PetTile/AnimatedSplash/StartupPreview
   wszystkie już to robiły poprawnie). Naprawione — walka pokazuje TEGO SAMEGO kotka co
   Pupil. **Priorytet testu:** otwórz walkę (dowolny tryb), sprawdź czy kolor/prążki/oczy/
   nosek/wąsy się zgadzają z ekranem Pupil.
2. **Questowe/MAD bossy trywialne mimo "poprawki" z wcześniej dziś** — user: "ja im ponad
   100, oni mi ledwo 1%". Przyczyna: `questBossHpFor`/`madBossHpFor` liczyły się z ZEREM
   zamiast realnego `atkStatBonus`/`bonuses` gracza — im więcej zainwestował w staty, tym
   bardziej trywializował te walki, bo hp bossa nie rosło razem z jego prawdziwą mocą.
   Naprawione (pełny opis w ARCHITECTURE §"Bossy"). **Priorytet testu:** stocz walkę
   questową/MAD, sprawdź czy trwa realnie kilka ciosów i czy kontratak coś faktycznie ujmuje
   (nie <2% jak wcześniej).
3. **Pasek postępu przy misji** — dodany pod tekstem odliczania w `app/pet.tsx`
   (`missionProgTrack`/`missionProgFill`), elapsed/total od `missionStartedAt`/`missionEndsAt`.
4. **Bug z nieodświeżającymi się questami** (user: rower z wczoraj pokazał się jako zrobiony
   dziś rano, przypadkowo odebrał) — zbadane: dwa istniejące triggery (`useFocusEffect` +
   `AppState` resume) łapią powrót na ekran i powrót z tła, ale NIE łapią północy mijającej
   gdy telefon stał CAŁY CZAS aktywny na ekranie Pupila (np. na ładowarce przez noc, appka
   nigdy nie zeszła do tła). Dodany trzeci trigger: poller co 60s porównujący `todayISO()` z
   dniem ostatniego odświeżenia, wymusza `reload()` przy realnej zmianie. **Priorytet testu:**
   trudny do zweryfikować bez zostawienia telefonu na ekranie Pupila przez północ — jeśli
   user ma sposób żeby to odtworzyć, warto potwierdzić.
5. **Kodeks Bossów (artefakt) v2** — więcej/rozwinięte ciekawostki z konkretnymi liczbami/
   datami, usunięte cytaty-z-książek jako lead faktu, dodane rozwijane "Czytaj więcej" z
   drugim faktem + nazwą hasła do sprawdzenia (bez generowanych URL-i — zasada sesji: nie
   zgadywać linków spoza kontekstu programistycznego). Ten sam link co poprzednio (republish).

## 🐛 "Zgubione" itemy z bossów — WYJAŚNIONE, nie bug (2026-08-14)

User pytał czemu nie ma Kryształu Cukru / Poduszki Leniwca po pokonaniu pierwszych bossów.
Odpowiedź: dane są całe (id itemu trwały w `ownedItems`, bonus liczony po id w `bossBonuses()`),
tylko **ekran gabloty trofeów został wywalony 12 sierpnia** (razem z pokojem pupila), więc nie
było już gdzie zobaczyć co się ma po nazwie. Dodatkowo "Poduszka Leniwca" (łup z Kanapowego
Leniwca) tego samego dnia dostała reflavor na "Iskra Poranka" ⚡ — id (`loot_pillow`) zostało,
tylko nazwa się zmieniła (patrz komentarz w `src/utils/bosses.ts` przy definicji bossa `sloth`).

## 🆕 MAD bossy — nowy, PIĄTY tor walki (2026-08-15, NIEsprawdzone na urządzeniu)

User: "trzeba przemyśleć hp bossów dmg ich itp itd" → po doprecyzowaniu (2 pytania
AskUserQuestion) skończyło się jako: druga, silniejsza fala tych samych 22 bossów kampanii,
odblokowywana hurtem na **lvl 50**, ale TYLKO per-boss po pokonaniu jego zwykłej wersji.
Zwykła kampania bez zmian. Pełny opis mechaniki w ARCHITECTURE §"Bossy" → "MAD bossy".

**Priorytet testowania:**
1. Pokonaj dowolnego bossa kampanii (albo sprawdź na koncie które już masz pokonane) →
   otwórz Bossy → sekcja "MAD bossy" powinna pokazać tego bossa jako cel (jeśli lvl<50:
   zablokowany z "Odblokujesz na poziomie 50"; jeśli lvl≥50: przycisk WALCZ).
2. Stocz walkę MAD — sprawdź czy art ma czerwoną aurę (jak rajdowe bossy), czy nagroda
   (coins/xp) jest wyraźnie wyższa niż standardowy boss tego samego id, czy po wygranej
   znika z sekcji MAD i pojawia się KOLEJNY pokonany-ale-nie-MAD boss (jeśli jest).
3. Balans sprawdzony throwaway-symulacją z UMIARKOWANYM profilem inwestycji (nie zero, nie
   full-endgame) — jeśli w realnej grze okaże się za łatwe/trudne, kręcić `madHitsFor` w
   `madBosses.ts` (obecnie 6→8 ciosów przez roster), NIE zgadywać — powtórzyć symulację
   (metoda opisana w ARCHITECTURE, pułapka z `guard`/kwadratowym kontratakiem już
   udokumentowana, nie trzeba jej odkrywać drugi raz).

## 🆕 Misja pupila — nowy, SZÓSTY tor walki (2026-08-15, NIEsprawdzone na urządzeniu)

User: "wyślij pupila na misję... idzie np 5h, i wtedy za to jak dojdzie można zawalczyć i
zdobywa się trochę więcej xp i coinow jak za daily questa". Doprecyzowane (2 pytania): BEZ
dziennego limitu (można wysłać kolejną od razu po odebraniu nagrody), czas trwania rośnie z
levelem od 10 min (nie sztywne 5h) + powiadomienie push przy zakończeniu. Pełny opis mechaniki
w ARCHITECTURE §"Bossy" → "Misja pupila".

**Priorytet testowania:**
1. Otwórz Pupila → sekcja "Misja" powinna pokazać przycisk "Wyślij" z podglądem czasu
   (~10 min na niskim levelu) i nagrody.
2. Wyślij misję → sprawdź czy karta pokazuje "Pupil w misji… wraca za Xmin" i czy licznik
   faktycznie odlicza (odśwież ekran po minucie).
3. **Najważniejsze do sprawdzenia realnie** (nie da się zasymulować bez urządzenia): czy
   powiadomienie push faktycznie przychodzi gdy misja się kończy Z ZAMKNIĘTĄ appką — to
   jedyny kawałek tej funkcji którego CI/testy jednostkowe nie mogą zweryfikować.
4. Po zakończeniu → przycisk "Walcz", stocz walkę, sprawdź czy nagroda wyraźnie wyższa niż
   zwykły daily quest i czy od razu można wysłać kolejną misję (bez czekania).
5. Jeśli po realnym graniu czas/nagroda poczuje się źle skalibrowane, kręcić stałe w
   `src/utils/missions.ts` (`MISSION_BASE_MIN`/`MISSION_MIN_PER_LEVEL`/`MISSION_MAX_MIN`,
   `MISSION_BASE_COINS`/`MISSION_BASE_XP`) — to proste stałe, nie wymagają throwaway-symulacji
   jak walka (misja sama w sobie nie ma nowej mechaniki bojowej, reużywa miniboss-fight z quest).

## 🧪 Balans ekonomii vs bossy — audyt + naprawy (2026-08-14, NIEsprawdzone na urządzeniu)

User poprosił o sprawdzenie czy tempo ekonomii questów nadąża za krzywą trudności bossów.
Zamiast zgadywać na papierze, napisano tymczasowy skrypt symulujący w pełni zaangażowanego
gracza (wszystkie dailies/bonusy/weekly/monthly/login codziennie, monety wydawane natychmiast
na ATK/HP) i przepuszczono przez PRAWDZIWY `simulateFight`/`buildQuests`/`raidHpFor` (skrypt
skasowany po użyciu, nie ma go w repo — wyniki niżej).

**Znalezione i naprawione:**
- **Questy dzienne/bonusowe/tygodniowe/miesięczne były PŁASKIE niezależnie od poziomu**
  (`quests.ts`), mimo że koszt poziomu (`levelFromXp`, 100+(lvl-1)×40) rośnie z każdym
  levelem. Efekt: nawet maksymalnie zaangażowany gracz nie dochodził do Lv72 w >1,5 roku
  symulowanego grania — **6 z 22 bossów kampanii (Lv72–116) było praktycznie nieosiągalnych**.
  Naprawione: `questRewardMult(level)` w `quests.ts` — mnożnik rosnący z poziomem, ten sam
  wzorzec co już istniejący w `raidCoins`/`eventCoins`/`minibossCoins`. Po zmianie Lv116
  osiągalny w symulacji w ~441 dni (wcześniej: nigdy w 600). `buildQuests`/`buildMissedDaily`
  dostały 3./4. opcjonalny param `level` (domyślnie 1 = brak zmiany, więc stare testy i
  wywołania bez poziomu zachowują się identycznie).
- **Kampania**: zawsze 100% win-rate na osiągalnych poziomach (bez zmian, to jest OK), ale
  nierówna — kilku bossów (Widmo Porównań, Hydra Odwodnienia, Tytan Prokrastynacji, Cień
  Zwątpienia, Cień Impulsu) pada w <3 rundy. Kosmetyczne, NIE naprawione w tej sesji.
- **Raid**: przy starym `raidHpFor` (2000+level×220) gracz zabijał tylko 34-60% HP w tydzień
  na Lv3-20 — **matematycznie NIEUKOŃCZALNY przez pierwsze ~25-30 poziomów**, mimo że
  odblokowuje się na Lv3. Obniżono base do 1000+level×210.

**⚠️ ŚWIADOMIE NIEROZWIĄZANE — raid endgame:** audyt pokazał że output gracza rośnie SZYBCIEJ
niż jakikolwiek gładki wzór od samego `level` potrafi nadążyć, bo output zależy też od TEGO ILE
bossów kampanii już pokonanych (kumulujące się % z łupu) — druga, niezależna oś progresji.
Próbowano kilku wariantów z komponentem `level^1.7-1.8` żeby złapać to zakrzywienie — poprawiały
mid-game, ale endgame (Lv70+) i tak wychodził z nadwyżką rzędu 400-800% (a bez tego komponentu
mid-game był z kolei za trudny). Zamiast wymuszać przeforsowany wzór bez pewności że jest
dobry, zostawiono raid PROSTY (liniowy, tylko naprawiony wczesny zakres) — pełna naprawa
wymaga policzenia HP też od `defeatedBosses.length`, nie tylko `level` (osobny parametr,
większa zmiana). Do zrobienia w kolejnej sesji, jeśli user po realnym graniu potwierdzi że
endgame faktycznie jest za łatwy (nie tylko w symulacji).

## 🧪 Balans bossów — narzędzia do testowania dodane (2026-08-14, NIEsprawdzone na urządzeniu)

Cała krzywa HP bossów (patrz sekcja niżej) jest pierwszą wersją po przepisaniu — user chce
metodycznie sprawdzać czy nie jest za trudna/za łatwa. Dodane w tej sesji (Ustawienia →
Diagnostyka):

- **"Eksportuj postęp pupila"** — generuje czytelny tekstowy raport (poziom, staty ATK/HP,
  sloty itemów, pokonani bossowie z ✓/🔒, raid/event, posiadane itemy bojowe z poziomem,
  log ostatnich 30 walk z datą/poziomem/nagrodą) i otwiera natywny share sheet (`Share.share`,
  bez nowej zależności) — kopiujesz/wysyłasz do wklejenia w rozmowie z Claude do analizy.
  Kod: `src/utils/bossProgressReport.ts` (+ test `__tests__/bossProgressReport.test.ts`).
- **"Zresetuj postęp pupila"** — podpina pod przycisk istniejącą (wcześniej martwą, nigdzie
  niewywoływaną) funkcję `usePetStore().reset()`. Podwójne potwierdzenie (Alert × 2, destrukcyjne).
  Czyści WSZYSTKO poza imieniem/datą stworzenia: poziom/XP, monety, itemy (też kolory sierści —
  `ownedItems` trzyma oba naraz), pokonanych bossów, staty ATK/HP, log walk, serie logowania,
  odebrane questy. Dotyka WYŁĄCZNIE store'u `pet-v1` (AsyncStorage) — nie rusza wydatków,
  nawyków, kalendarza ani żadnego innego store'a w appce.
- Nowy log walk `bossLog` w `petStore.ts` (persystowany, rośnie z każdą pokonaną walką
  kampanii/raidu/wydarzenia — bossId/nazwa/timestamp/poziom/coins/xp) — to źródło danych dla
  eksportu, wcześniej nic takiego nie istniało.

**Plan testowania:** user gra kilka walk, po ~5 poziomach robi eksport i wkleja raport w czacie
do sprawdzenia czy krzywa się broni. Alternatywnie może zresetować postęp i zacząć od zera na
świeżo przetestowanej krzywej.

## ✅ Questy jako walki — v2, POTWIERDZONE na urządzeniu (2026-08-14→15)

User zagrał walkę za quest na telefonie: "walka wygladała super". Od tej pory ten podsystem
liczy się jako sprawdzony, nie "świeże/nietestowane" — dwie dalsze iteracje na jego bazie:

- **Trudność podniesiona (2026-08-15)** — user: "dają 1hp dmg dla mnie a ja ich wale na 2
  hity". `questBossHpFor` przepisane z płaskiej krzywej (`50+level×5`) na `atkPower(level)×4`
  (target 4 ciosy) — skaluje się 1:1 z realną mocą ataku na każdym poziomie, więc nie robi
  się trywialne w mid-game jak poprzednio. Sprawdzone symulacją (throwaway test, skasowany):
  teraz stabilnie ~4-4.6 ciosu i 10-45% obrażeń na kotku (rosnące z poziomem) na całym
  zakresie Lv1-120, zamiast 2 ciosów/<1% już od Lv10. **Priorytet testowania:** stoczyć
  kilka walk questowych na różnych poziomach, potwierdzić że faktycznie czuć różnicę.
- **Sesja treningowa self-report (2026-08-15)** — pompki/przysiady/brzuszki/deska/
  rozciąganie (`b_pushups`/`b_squats`/`b_situps`/`b_plank`/`b_stretch`) miały jedno tapnięcie
  "Zrobione" (bez czujnika, rower ma osobno przez Health Connect). Teraz przycisk
  "Rozpocznij" → `TrainingSessionModal` (`components/pet/TrainingSessionModal.tsx`): deska/
  rozciąganie dostają realnie odliczany timer do celu z `personalQuests.ts`, pompki/
  przysiady/brzuszki ekran z docelową liczbą powtórzeń + przycisk "UKOŃCZYŁEM". Po
  ukończeniu quest staje się `done` i wchodzi w ten sam tor "Walcz" co reszta. **NIEsprawdzone
  na urządzeniu** — priorytet: rozpocznij deskę, sprawdź czy timer faktycznie liczy do zera i
  quest odblokowuje "Walcz"; rozpocznij pompki, sprawdź ekran licznika + UKOŃCZYŁEM.

## Historia — jak to powstało (2026-08-14, zaimplementowane w jednej sesji)

⚠️ Pierwsza wersja tego dnia (osobny ekran `app/minibosses.tsx`, tory woda/kroki, DODANA jako
bonus nad questami) była **źle zrozumianym pomysłem usera** — usunięta tego samego dnia, zanim
trafiła na urządzenie. Poprawiona wersja (v2):

- **Każdy quest dzienny/bonusowy** (`quests.ts` DAILY+BONUS, w `app/pet.tsx`) po wykonaniu
  pokazuje przycisk **"Walcz"** zamiast zwykłego "Odbierz". Standardowe monety za te questy
  ZNIKNĘŁY — jedyna droga do nagrody to wygrana walka.
- Walka to `?kind=quest` w `boss-fight.tsx` — **PEŁNA animacja jak kampania** (łapka/pociski/
  kontratak, można przegrać, retry darmowy — user explicite wybrał to nad uproszczonym
  ekranem z pierwszej wersji).
- Miniboss losowany deterministycznie na dzień+quest (`minibossForQuest`, roster 8 zwierząt z
  `assets/minibosses/`, art teraz w WSPÓLNEJ mapie `bossIcons.ts`, nie osobnym pliku).
- HP rośnie z poziomem kotka (`questBossHpFor`); nagroda = bazowa stawka questu (już
  przeskalowana `questRewardMult` z poprzedniego commita) × 1.6 (`FIGHT_BONUS`) — WIĘCEJ niż
  dawał zwykły claim, zgodnie z życzeniem usera.
- Nowa akcja store'u `claimQuestFight` (zastąpiła `claimMiniboss`) — pisze do `dailyClaims`
  (nie tylko `dayClaims`), bo inaczej `buildQuests()` nie uznałby questu za odebrany.
- Missed/catch-up questy (zaległe z wczoraj) ZOSTAJĄ instant-claimem — walka z minibossem
  losowanym na dzisiejszą datę za coś z wczoraj byłaby myląca.

**Priorytet testowania:** wykonaj dowolny quest dzienny (np. wpisz humor), sprawdź czy pojawia
się "Walcz", czy walka wygląda jak kampania, czy po wygranej quest znika z listy aktywnych i
nagroda się zgadza (powinna być widoczna 60% wyższa niż liczba pokazana na liście przed walką).

**Odłożone od usera (jego własny pomysł, nie zbudowane, "czy coś" — sam niepewny kształtu):**
mapa oparta o kroki ALL-TIME prowadząca do dodatkowych "MEGABOSSÓW" — osobna, większa
kampania. Do zaprojektowania w kolejnej sesji, nie zgadywane teraz.

## 🔴 Do przetestowania na urządzeniu (świeże, pierwsza wersja, NIEsprawdzone)

Wszystko poniżej przeszło tsc + pełny test suite (592 testy), ale żadna z tych zmian nie była
jeszcze widziana na realnym telefonie:

- **Cała krzywa HP bossów kampanii przepisana** (commit `4faa498`) — była matematycznie
  niewygrywalna od bossa #7 wzwyż (kontratak = % z max HP bossa liczony CO RUNDĘ, rosło
  kwadratowo). Teraz każdy z 22 bossów killowalny w ≤31 rundach przy zerowej inwestycji.
- **Kontratak bossa naprawiony** (commit `5379694`) — liczy się od aktualnego HP bossa, nie
  stałego maksimum.
- **Raid (Golem i inni) ma realny kontratak** (commit `2416d58`) — wcześniej czysto poglądowy.
- **Osłabianie bossów realnymi seriami** (commit `c7d67e4`) — np. streak "bez słodyczy"
  obniża HP bossa słabego na słodycze, do -35% przy 35+ dniach. Nowy plik
  `src/utils/bossWeakness.ts`.
- **Sloty na itemy bojowe rosną z poziomem** (commit `c7d67e4`) — było sztywne 3, teraz
  +1 co 6 poziomów, cap 6.
- **Ekonomia questów pupila** (commit `259ae59`) — nagrody coins/xp podniesione ~1.5x.
- **Animacja ataku bossa + ikona łapki** (commit `2416d58`) — leciała w miejscu zamiast do
  celu (`useNativeDriver` bug), łapka była żółta zamiast czytelna.
- **Kafelki "Twoje serie"** — Duolingo-style redesign (`3bc70a6`), potem skurczone
  (`4faa498`) bo były za długie.
- **Odświeżanie po wznowieniu z tła — WSZYSTKIE 12 ekranów** (commit `eb591aa` dla pet.tsx,
  `59b5e7d` dla reszty) — `useFocusEffect` nie łapało powrotu z tła, przez co apka dawała np.
  nagrody za wczorajsze nawyki. `mood.tsx` świadomie pominięty (nie ma tam czego odświeżać,
  dane idą live z Zustand). Sekcja "znany bug" niżej — USUNIĘTA, bo załatane.

**Priorytet testowania:** zagraj walkę kampanii/raid/event, sprawdź czy sloty/osłabianie
bossów widać w UI, i czy dashboard streak-tiles wyglądają dobrze (grubość liczby, rozmiar).

## 🟡 Wymaga Twojej akcji, nie kodu

- **Diagnostyka faz snu**: Zdrowie → przycisk "Diagnostyka faz snu z zegarka" (`probeSleep`).
  Wykres faz snu na dashboardzie jest pusty od kilku zgłoszeń — cały pipeline sprawdzony w
  kodzie, jest CZYSTY, więc dalsze zgadywanie w kodzie nic nie da. Odpal przycisk i wyślij co
  pokazuje (permission / liczba sesji / jakie stage'y) — to determinuje czy da się w ogóle
  zbudować wykres faz z tego zegarka/eksportu Samsung Health.

## 🟢 Mniejsze, odłożone rzeczy

- **Powiadomienia bankowe** działają tylko dla Pekao. Plan (nie zbudowany): user wybiera swoją
  appkę bankową z listy zainstalowanych (generalizacja `BANK_PACKAGES`), generyczne heurystyki
  (kwota+waluta, słowa kluczowe), ekran "naucz mnie" gdy niepewne.
- `app/habits.tsx` (~linia 577-585) ma stary stepper ±1h/±5min do godziny przypomnienia —
  `TimePickerField`/`WheelPicker` już istnieją i są używane w zadaniach, tylko trzeba podmienić.
- Tryb ręczny godzin pracy (Ustawienia→Praca→Ręcznie) nie ma odpowiednika na dashboardzie —
  kafelek "work-hours" działa tylko w trybie kalendarzowym.
- **Rajdowe bossy — 3 z 6 mają teraz DEDYKOWANY art** (2026-08-15, user dorysował
  `BOSS_GOLEM/KRAKEN/UPIOR.png` + `MADBOSS_GOLEM/KRAKEN/UPIOR.png`) — golem/kraken/phantom
  wyszły z prowizorki. `behemoth`/`wyrm`/`siren` WCIĄŻ pożyczają PNG z kampanii + programowy
  czerwony tint (`powered` w `BossArt`), patrz ARCHITECTURE §"Art rajdowych bossów". Jeśli
  ktoś dorysuje resztę: dopisać `BOSS_<NAZWA>.png` do `BOSS_PNG` (zastępuje pożyczony wpis)
  i opcjonalnie `MADBOSS_<NAZWA>.png` do `POWERED_BOSS_PNG` w `bossIcons.ts` — zero zmian w
  komponencie. **NIEsprawdzone na urządzeniu** — priorytet: otwórz Bossy, sprawdź golem
  (dedykowany art) i behemoth (wciąż pożyczony + tint) obok siebie, potwierdź że oba czytają
  się dobrze mimo różnego pochodzenia artu.
- **4 portrety event-bossów bez prawdziwego artu** (nie 1, jak wcześniej tu napisane —
  poprawione po sprawdzeniu kodu 2026-08-15): Zły Mikołaj (`mikolaj`), Czekoladowy Zajączek
  (`wielkanoc`), Widmo Nadgodzin (`overtime`), Demon Słodyczy (`sweettooth`) — tylko 4 z 8
  eventowych bossów mają PNG w `BOSS_PNG` (wakacje/wiosna/jesień/zima).
- Odznaki czekające w `assets/bagesv2/` bez wpięcia: `gnome.png` (brak pomysłu),
  `radar.png` (wykrywanie ominiętych przypomnień — złożone), `4th-of-july.png` (wymaga
  nowego pola daty urodzenia w Ustawieniach — większy prerequisite).
- Martwy plik `app/widget-builder.tsx` — custom widgety stat zostały usunięte razem z
  wejściem do niego, sam plik zostawiony, bezpieczny do skasowania.
- `src/utils/monthlyReports.ts` (`generateYearlyReport` i inne) — nieużywane, ale gotowe
  hooki pod przyszłe funkcje (np. inny model Yearly Wrapped niż obecny `yearCards.ts`).

## Konwencje / gdzie szukać

Zacznij od [`CLAUDE.md`](./CLAUDE.md) → [`ARCHITECTURE.md`](./ARCHITECTURE.md) — tam są
twarde zasady (style tylko przez `themedStyles`, permissions w app.json zastępują domyślne
Expo, snapshot statystyk, itd.) i mapa "jak dodać X". Workflow commitów: `tsc --noEmit` →
`npx jest --silent` → `git add <konkretne pliki>` (nigdy `-A`) → commit z heredoc → push.

# Co dalej — stan na 2026-08-14

Ten plik to zrzut z sesji na PC przed przejściem na zdalną pracę z telefonu (claude.ai/code).
Aktualizuj/kasuj pozycje w miarę ogarniania, nie zostawiaj martwych wpisów.

## ✅ Nemesis kosztuje TERAZ energię (cofnięty §177 design) + legendarne dropy x5 (2026-09-24)

Pełny opis w ARCHITECTURE.md §178 — SUPERSEDUJE poniższy §177 co do nemesis. User na "∞ prób"
z §177: "Czemu tam niby jest infinity, przecież ma zużywać energię jak walczę xd" — jasne
odrzucenie diagnozy "nielimitowane próby to świadomy design". Cofnięte: `target.energy` dla
nemesis dzieli TERAZ prawdziwą `eventEnergy` z raid/wydarzeniem (nie sztywna atrapa), bramka
sprawdzania puli i `spendEventEnergy()` wywoływane jak dla reszty trybów, pigułka na ekranie
walki i liście bossów (`bosses.tsx`) pokazuje realny stan bez ukrywania/wyjątku dla nemesis.
Co ZOSTAJE z oryginalnego designu: brak deadline'u i TRWAŁY bank HP (nie resetuje się).

Też: "I dawaj te dropy coin zwiększ tak o 5x xddd dawaj" — `LOOT_BOXES[].coins.jackpot` w
`src/utils/petBoxes.ts` pomnożone x5 (sardine 30→150, iron 90→450, gold 200→1000, divine
900→4500) — dawna wartość (30 przy koszcie skrzynki 35) była GORSZA niż cena własnej skrzynki
nawet przy najrzadszym trafieniu, potwierdzone zrzutem usera. `DAILY_BOX`/`crates.ts` (darmowe)
celowo NIETKNIĘTE — poza zakresem skargi. `tsc`/`jest` czyste (1105 testów, bez regresji).

**🆕 Priorytet testu na urządzeniu — wysoki**: walka z Demon Słodyczy (nemesis) — pigułka
czerwona, realnie SPADA z każdą próbą, WALCZ blokuje się przy 0 energii. Otwórz kilka skrzynek
Sklepu — trafienie LEGENDARNEJ pokazuje nową, 5x wyższą kwotę monet.

## ✅ Boss-fight: zły kolor pigułki energii + myląca atrapa dla nemesis (2026-09-24)

Pełny opis w ARCHITECTURE.md §177 — **UWAGA: część o "nielimitowane próby to świadomy design"
COFNIĘTA w §178 wyżej**, ten wpis zostaje tylko dla historii koloru pigułki. User (zrzutem):
"w pomiń walkę nie zużywa energii, przez co przy DEMON SŁODYCZY mogę w nieskończoność
walczyć... energia pokazuje się niebieska zamiast czerwonej." "Pomiń walkę" bez winy — wynik
walki jest rozstrzygnięty przed animacją. Kolor pigułki był na sztywno niebieski dla
wszystkich trybów, gdy `bosses.tsx` ma ustalony kod: kampania/MAD niebieski, raid/wydarzenie
(w tym TERAZ nemesis, po §178) czerwony — teraz zgodne. `tsc`/`jest` czyste.

## ✅ Liczniki runda 2 — pierścień zamiast paska + poświata (2026-09-24)

Pełny opis w ARCHITECTURE.md §176. User: "te liczniki zjebałeś, pasek za gruby, tanio, stary
chujowy look, przerób na highend, sprawdź opcje". Zamockowałem 3+2 kierunki w osobnym
Artifact (dark theme 1:1 z apką) zamiast zgadywać trzeci raz — user wybrał pierścień
(odliczania) i poświatę pod całym wierszem (ile dni temu). Nowy
`src/components/counters/RingCountdown.tsx` (kołowy progress, react-native-svg) zastąpił
usunięty `DonationBar.tsx` we wszystkich 3 miejscach (dashboard/`counters.tsx`/`counters/
[id].tsx`). `SinceCountersCard.tsx` runda 2 — ikonka-chip zdjęta, duża liczba + `RadialGlow`
(reużyty z battle-layout-lab.tsx) rozlany z lewej po całym wierszu zamiast za samą liczbą,
meta pokazuje próg następnego tieru zamiast gołego "dni". `tsc`/`jest` czyste (1105 testów,
bez zmiany).

**🆕 Priorytet testu na urządzeniu — wysoki**: zobacz oba widgety na dashboardzie (Odliczania
z pierścieniami, Liczniki z poświatą) i `/counters` pełną listę.

## ✅ Trzy nowe custom bossy podpięte + kaczka wywalona (2026-09-23)

Pełny opis w ARCHITECTURE.md §175. Druga część item #7: user wypchnął 3 pliki bezpośrednio
(`assets/bossy/kampania/BOSS_DYMNYNIEDZWIEDZ.png`+`BOSS_MROCZNYKRUK.png`,
`assets/bossy/questy/MINIBOSS_ROPUCHA.png`) — podpięte w całości z kodu. Niedźwiedź z
dymu/pustki → `burnout`/"Pustka Wypalenia" (dopasowanie tematyczne — user NIE sprecyzował
którego z 22 bossów kampanii podmienić, wybrane po koncepcie), mroczny kruk → `doubt`/"Cień
Zwątpienia". Nowy quest-miniboss `mb_ropucha`/"Ropucha Bagna" zastąpił USUNIĘTY
`mb_duck`/"Kaczka Kałuży" (user: "możesz wywalić kaczkę"). Wszystkie 3 źródłowe pliki
(1536×1024/~2MB każdy) przeskalowane do 600×400/~290KB (ten sam próg co reszta folderu
`bossy/`), żeby nie napompować APK. `tsc`/`jest` czyste (1105 testów, bez zmiany).

**🆕 Priorytet testu na urządzeniu — wysoki**: zobacz "Pustka Wypalenia" (poz. 22+) i "Cień
Zwątpienia" (poz. 46+) w kampanii, i "Ropucha Bagna" w rotacji questów dziennych (zamiast
kaczki).

**🆕 Otwarte**: który-boss-dostał-który-art był MOJĄ decyzją (dopasowanie tematyczne, user nie
wskazał konkretnie) — jeśli user chciał inaczej, to tylko 2 linie w `bossIcons.ts` do zmiany.

## ✅ Woda — znaleziony DRUGI wyścig (health.tsx) + diagnostyka per-rekordowa w Ustawieniach (2026-09-23)

Pełny opis w ARCHITECTURE.md §174. User (item #14): "wypiłem 8 szklanek a pokazuje mniej...
gdzie w ustawieniach dosłownie co łapie kiedy i ile ml, żebym potwierdził". Dwie rzeczy:
(1) znaleziony DRUGI, nienaprawiony wyścig wody — `app/(tabs)/health.tsx` ma WŁASNĄ, osobną od
`useWaterTracker.ts` implementację licznika wody, którą fix z 09-22 pominął. `persistWater()`
robił goły `counts[id] = waterRef.current` (naprawione: `Math.max` z fresh-z-magazynu), a
`loadWater()` nie miała guardu "nie przeładowuj gdy wisi odroczony zapis" (naprawione). To
bardzo prawdopodobnie REALNA przyczyna zgłoszenia — Zdrowie to ekran gdzie user faktycznie
taponuje szklanki. (2) `probeHydration()` dostał per-rekordową listę wpisów (kiedy/ile ml/
źródło, nie tylko sumę), i "Diagnostyka wody z zegarka" jest teraz DOSTĘPNA W USTAWIENIACH
(Diagnostyka), nie tylko schowana w sheecie edycji kubka na Zdrowiu. `tsc`/`jest` czyste (1105
testów, +5).

**🆕 Priorytet testu na urządzeniu — wysoki**: (1) `Ustawienia → Diagnostyka → Diagnostyka
wody z zegarka` — sprawdź listę wpisów kiedy/ile ml; (2) na Zdrowie taponuj szklanki szybko
kilka razy, poczekaj na sync z zegarka w tle, sprawdź że liczba się NIE cofa.

## ✅ Edytor układu walki — znaleziony i naprawiony realny "nie 1:1" bug (2026-09-23)

Pełny opis w ARCHITECTURE.md §173. User (item #7 feedbacku): "ten edytor dziwny i chyba nie
jeden do jeden" — bez nowych plików dało się to zdiagnozować z samego kodu. Dwa realne
rozjechania geometrii między edytorem (`battle-layout-lab.tsx`) a realną areną
(`boss-fight.tsx`): (1) wysokość kolumny portretu była na sztywno 200px zamiast liczonej jak w
realnej arenie (`Math.max(catSize,bossSize)+18`, =223 domyślnie) — 23px różnicy przesuwało
pionowy środek o ~11px; (2) edytorowy `vsRow` miał dodatkowe 16px `paddingBottom` zamiast
jednolitych 12px jak w realnej `arena`. Do tego root cause DRUGIEGO zjawiska: `persist`
zustanda nie nadpisywał sam z siebie przestarzałego drafta na urządzeniu po każdej aktualizacji
`BATTLE_LAYOUT_DEFAULT` — user musiał PAMIĘTAĆ o ręcznym Reset. Dodany `PERSIST_VERSION` +
`migrate()` — teraz automatyczny. `tsc`/`jest` czyste (1100 testów, bez zmiany).

**🆕 Priorytet testu na urządzeniu — średni**: otwórz `/battle-layout-lab`, wciśnij Reset,
porównaj z realną walką tego samego bossa — powinno wyglądać identycznie.

**🆕 Otwarte**: druga część #7 — user zapowiedział wgranie NOWYCH customowych bossów w miejsce
starych z neta — wciąż czeka na przesłanie plików.

## ✅ Ekwipunek — ostatnie emotki monet wywalone, itemy/sloty większe (2026-09-23)

Pełny opis w ARCHITECTURE.md §172. User (item #5 feedbacku): "ekwipunek ma EMOTKI które
chciałem wywalić... zrobić to eq większe ogólniej bardziej czytelne". Sloty już były bez
emotek (wcześniejsza sesja); zostały tylko "🪙" w `GearPanel.tsx` (przyciski sprzedaży, stepper
ilości, 3 toasty) — zamienione na `<Coins/>` ikonkę (JSX) albo słowo "monet" (stringi
toastów, gdzie ikonki nie da się osadzić). Rozmiary podniesione: sloty 62→70px, miniaturki
itemów 44→56px, nazwa itemu 13.5→15px. `tsc`/`jest` czyste (1100 testów, bez zmiany).

**🆕 Priorytet testu na urządzeniu — niski**: otwórz Ekwipunek, sprawdź brak "🪙" i większe
itemy/sloty.

**🆕 Otwarte**: user chciał też szerzej "łatwiej sprzedawać" — na razie tylko rozmiar/
czytelność, sam flow sprzedaży (grupowanie/bulk/qty-picker) bez zmian. Czeka na konkrety od
usera jeśli chce więcej.

## ✅ Panel Praca — usunięte "cele"-skarbonki, zostają tylko stałe wydatki (2026-09-23)

Pełny opis w ARCHITECTURE.md §171. User (item #11 feedbacku): "bym z pracy wywalił jednak te
cele wszystkie i zostawił tylko STAŁE WYDATKI tam jakby i pokazywał ile zarobiłem do stałych a
ile powyżej". Sekcja "Skarbonki" (3 paski: stałe/jedzenie/zmienne) zredukowana do JEDNEJ karty
— zarobek vs stałe wydatki + zdanie o nadwyżce ponad nie. `workBudgetProgress()` →
`workFixedProgress()` w `fixedVariable.ts` (zwraca jeden obiekt zamiast tablicy 3 kubełków).
Reszta panelu (Stawka/Zaplanowane naprzód/Godziny/W liczbach/Wypłaty) BEZ zmian — user je
pochwalił. `tsc`/`jest` czyste (1100 testów, +1).

**🆕 Priorytet testu na urządzeniu — niski**: otwórz panel Pracy z dashboardu, sprawdź nową
kartę "Zarobek do teraz vs stałe wydatki".

**🆕 Otwarte**: user chciał też "rozbudować więcej widgetów... do pomyślenia jeszcze bo nie
wiem czego, ale brakuje mi czegoś w tej zakładce PRACA" — brak konkretnego pomysłu na razie,
czeka na usera.

## ✅ Liczniki — gruby pasek-donacja + duża kolorowana liczba zamiast kafelków (2026-09-23)

Pełny opis w ARCHITECTURE.md §170. User (item #13 feedbacku): "musimy ulepszyć LICZNIKI...
gruby napis w pasku wypełniając się jak donate na Twitch... ikonki wywalamy" + "ile dni temu
musi być liczba jak na streak ale nie w kafelku tylko jakąś ciekawszą, sama liczba gruba... w
barwie im więcej dni jak w streaku". Nowy `DonationBar.tsx` (zastąpił `WalkProgress.tsx`,
usunięty) na widgecie dashboardu + `/counters` + `/counters/[id]`, z wyborem koloru paska i
płynnym/skokowym (co dzień) wypełnianiem. `SinceCountersCard.tsx`'s kwadratowa siatka kafelków
zastąpiona pionową listą wierszy z dużą pogrubioną liczbą kolorowaną tierem streaka. `tsc`/
`jest` czyste (1099 testów, +5).

**🆕 Priorytet testu na urządzeniu — średni**: sprawdź nowy pasek na dashboardzie i `/counters`
(oba tryby wypełniania, wybór koloru w formularzu dodawania/edycji), i nową listę "ile dni
temu" na dashboardzie.

## ✅ #12 Cold start lag — rozwiązane (2026-09-24)

Ostatni punkt z batcha 12-punktowego. Pełny opis w ARCHITECTURE.md §179. User w końcu przesłał
export z Diagnostyki (20 startów) — kluczowy sygnał: `lag JS max 0ms / suma 0ms (0 próbek)`
przy WSZYSTKICH 20, mimo że start trwał 600ms-1,9s. To NIE "brak lagu" — to dowód, że nawet
WŁASNY 50ms timer próbnika ani razu się nie odpalił, czyli wątek JS był nieprzerwanie zajęty
przez całe okno startu (ten sam mechanizm co "dotyk nie działa zaraz po starcie"). Namierzony
w kodzie klaster ~8 efektów w `app/_layout.tsx` startujących RAZEM, bez opóźnienia, w tym samym
ticku co pierwsza klatka dashboardu (appSettings/migracje/loadNonFood/loadOwnName/crash-log
x2/kanał powiadomień/widget-flush) — owinięte nowym helperem `afterInteractions()`
(`InteractionManager.runAfterInteractions`), więc nie walczą już o wątek JS z renderem.
`tsc`/`jest` czyste (1105 testów, bez zmiany).

**🆕 Priorytet testu na urządzeniu — wysoki**: kilka cold-startów → Diagnostyka → sprawdź czy
`(N próbek)` jest teraz > 0, i czy dotyk zaraz po starcie realnie działa płynniej. Jeśli nadal
0 próbek, kongestia jest gdzie indziej (np. natywny most) — wróć z nowym exportem.

## ✅ Dwie korekty po realnym teście: widget przestał się dodawać + zły kolor tasków (2026-09-23)

Pełny opis w ARCHITECTURE.md §169. User przetestował §165/§166/§164 i zgłosił: (1) widget
przestał się dawać dodać na pulpit — regresja z ekranu configu, USUNIĘTY na rzecz zwykłego
przełącznika w Ustawieniach (nie gate'uje dodawania); (2) kolor kart zadań miał być wg
terminowości (dziś=niebieski cały kafelek/zaległe=czerwony/reszta=neutralne), nie wg rodzaju
zadania jak zrobiłem wcześniej — cofnięte i przerobione. `tsc`/`jest` czyste (1094 testy, bez
zmiany), `expo prebuild` zweryfikowany ponownie.

**🆕 Priorytet testu na urządzeniu — wysoki, wymaga NOWEGO APK**: dodaj widget od zera
(powinien pojawić się bez ekranu pośredniego), sprawdź przełącznik przezroczystości w
Ustawieniach, sprawdź kolory kart zadań (dziś=niebieski, zaległe=czerwone, reszta=neutralne).

## ✅ Fix: skanowanie paragonu mogło dodać ten sam paragon kilka razy pod rząd (2026-09-23)

Pełny opis w ARCHITECTURE.md §168. User: zrzut z 4 identycznymi paragonami Lidl (8 produktów,
62.72 zł) tego samego dnia. Przyczyna: `scan.tsx`'s `saveSelected()` zawsze dodawał nowy
paragon bez sprawdzenia czy identyczny już nie istnieje — w połączeniu z UDOKUMENTOWANĄ
historią zawieszania się tego ekranu w trakcie zapisu, kilka tapnięć "Zapisz" w pozornie
martwy ekran mogło przejść zanim przycisk zdążył się zablokować. Fix: guard sprawdzający
identyczny paragon (kwota+dzień+sklep) utworzony w ciągu ostatnich 3 minut — pomija jako
przypadkowy duplikat zamiast dodawać kolejny. `tsc`/`jest` czyste (1094 testy, bez zmiany).

**🆕 WAŻNE**: 4 istniejące duplikaty w danych usera NIE zostały automatycznie usunięte (brak
dostępu do jego danych z tej sesji) — user musi ręcznie skasować 3 z 4 identycznych wpisów
Lidl przez ekran szczegółów wydatku. Fix zapobiega tylko przyszłym powtórkom.

**🆕 Priorytet testu na urządzeniu — wysoki**: kilka szybkich tapnięć "Zapisz" przy skanowaniu
— powinien powstać tylko 1 wpis + toast o pominiętym duplikacie.

## ✅ Plan zajęć — kafelek na fioletowo + ekran dzień/tydzień/miesiąc (2026-09-23)

Pełny opis w ARCHITECTURE.md §167. User: kafelek "musi być bardziej widocznym... z
odróżnieniem", i ekran zamiast "przesuwanej listy" ma być "stabilny, domyślnie dzienna i można
włączyć widok tygodniowy i miesięczny". Kafelek dostał fioletowy akcent (pasek+wash+ikonka,
ten sam przepis co kolor rodzaju na taskach §164). Ekran `/class-schedule` przebudowany z
samej siatki tygodnia (poziomy swipe) na 3 taby: Dzień (domyślny, jedna kolumna pełnej
szerokości)/Tydzień (pionowe sekcje dni, bez gestu)/Miesiąc (nowa siatka kalendarza, tap dnia
→ widok Dzień). `tsc`/`jest` czyste (1094 testy, +9).

**🆕 Priorytet testu na urządzeniu — wysoki**: sprawdź wszystkie 3 taby + nawigację + kolor
kafelka na dashboardzie.

## ✅ Widget pulpitu Androida "Zadania" — v1 podstawowy, potwierdzony działający (2026-09-23)

Pełny opis w ARCHITECTURE.md §165. User: "bardzo lubiłem mieć na ekranie co muszę zrobić/
kupić". Pierwszy natywny bridge module w projekcie (własny Kotlin przez
`plugins/withTasksWidget.js`, NIE zewnętrzna biblioteka). Build #1045 skompilował się za
pierwszym razem, user **potwierdził zrzutem ekranu na S22 Ultra**: realne dane, kolory rodzaju,
działa.

## 🆕 Widget "Zadania" — resize mniejszy + przezroczyste tło, WYMAGA NOWEGO APK + re-dodania widgetu (2026-09-23)

Pełny opis w ARCHITECTURE.md §166. Dwie prośby po pierwszym teście: (1) mniejszy resize w
pionie — dodane jawne `minResizeWidth/Height` (wcześniej brakowało, więc Android brał
`minWidth/Height`=180dp jako limit), plus ogólnie ciaśniejsze paddingi; (2) nowy ekran configu
(`TasksWidgetConfigActivity`, natywny, zero JS) z przełącznikiem "Przezroczyste tło", per-
widget-instancja w `SharedPreferences`.

**🆕 WAŻNE**: `android:configure` odpala się TYLKO przy dodawaniu widgetu — już umieszczony
widget z buildu #1045 NIE dostanie ekranu configu retroaktywnie. Po zainstalowaniu nowego APK
**usuń obecny widget z pulpitu i dodaj go ponownie** żeby zobaczyć ustawienia przezroczystości.
Sam mniejszy resize działa na już umieszczonym widgecie bez re-dodawania.

**🆕 Priorytet testu na urządzeniu — wysoki, wymaga nowego APK + re-dodania widgetu**: sprawdź
że widget daje się skurczyć mocniej niż poprzednio, że po ponownym dodaniu pokazuje się ekran
"Widget — Zadania" z przełącznikiem, że włączenie przezroczystości realnie chowa ciemne tło
(widać tapetę), i że reszta (dane/tap/kolory) nadal działa.

## ✅ Taski — kolor rodzaju z powrotem na każdej karcie, nie tylko w nagłówku grupy (2026-09-23)

Pełny opis w ARCHITECTURE.md §164. User: "ulepsz kolorystycznie taski tylko tak rozsądnie".
Reużyte istniejące 3 kolory `KIND_META` (quick/deep/waiting) na pasku+wash aktywnej karty
(zamiast sztywnego zielonego) + mała ikonka rodzaju przy tytule. Overdue/done nadal wygrywają,
pilność/priorytet zostają osobną osią — 4 sygnały się nie gryzą. `tsc`/`jest` czyste (1079
testów, bez zmiany — czysto wizualny redesign).

**🆕 Priorytet testu na urządzeniu — średni**: sprawdź kolory kart na liście zadań (oba tryby
grupowania — wg terminu i wg rodzaju).

## ✅ Plan zajęć — kafelek dashboardu pokazuje najbliższy dzień zamiast znikać (2026-09-23)

Pełny opis w ARCHITECTURE.md §163. User: kafelek "musi pokazywać... następny dzień jaki będę
miał z datą i za ile dni". Wcześniej kafelek całkowicie znikał gdy dziś/jutro puste (weekend,
przerwa międzysemestralna) — dodany fallback `classNextDay` (index.tsx) + nowa
`fmtNextClassLabel()` w `classSchedule.ts` ("Śr 24 wrz · za 2 dni"). Tap nadal prowadzi do
pełnego tygodnia. `tsc`/`jest` czyste (1079 testów, +4).

**🆕 Priorytet testu na urządzeniu — średni**: sprawdź kafelek w dniu/weekendzie bez zajęć.

## ✅ Siatka nastrój×energia — DRUGI fix, brakujący GestureHandlerRootView w Modalu (2026-09-23)

Pełny opis w ARCHITECTURE.md §162. Po fixie ScrollView (§153) user zgłosił że nadal "Nie mogę
dotknąć tam i wpisac humoru" — ten sam zrzut co poprzednio. Prawdziwa, DRUGA przyczyna: siatka
żyje wewnątrz natywnego `Modal` z `'react-native'`, który portuje zawartość do osobnej natywnej
hierarchii (nowe okno/kontroler) poza jedynym `GestureHandlerRootView` z `app/_layout.tsx` —
RNGH nigdy nie dostawał poprawnie zroutowanych dotknięć niezależnie od poprawki ScrollView.
Fix: zagnieżdżony `GestureHandlerRootView` dodany tuż wewnątrz `<Modal>` w
`MoodCheckInModal.tsx`. `tsc`/`jest` czyste (1075 testów, bez zmiany — interakcyjny fix).

**🆕 Priorytet testu na urządzeniu — wysoki**: DRUGA próba naprawy tego samego zgłoszenia —
sprawdź czy przeciąganie/tapanie siatki teraz faktycznie ustawia nastrój+energię, "Zapisz" się
odblokowuje, a reszta modala (scroll, tagi, notatka) nadal działa normalnie.

## ✅ Plan zajęć — wirtualny podgląd tygodnia, ostatni kawałek (2026-09-22)

Pełny opis w ARCHITECTURE.md §161 (kontynuacja §157-160, KOMPLET rozbudowy planu zajęć z tej
sesji). User potwierdził (AskUserQuestion): dashboardowy kafelek wystarcza jako "widget" bez
zmian; chciał "wirtualny podgląd" — nowy ekran `app/class-schedule.tsx`, siatka dni
(kolumny=Pon-Nie, poziomy scroll), chronologiczna lista zajęć per dzień, nawigacja tydzień
wstecz/naprzód. Dostęp: Ustawienia → Plan zajęć → "Podgląd tygodnia" + tapnięcie w
dashboardowy kafelek. Nowy `src/utils/weekGrid.ts` (`mondayOf`/`fmtWeekRange`, wydzielone dla
testowalności — uwaga na przypadek niedzieli w `Date.getDay()`, pokryte testem).
`tsc`/`jest` czyste (1075 testów, +8).

**🆕 Priorytet testu na urządzeniu — średni**: nowy ekran, nawigacja tygodni, scroll dni.

## ✅ Plan zajęć w TopPillu (2026-09-22)

Pełny opis w ARCHITECTURE.md §160. User: "żeby też łapało że mam zajęcia w pillu" —
`[PUR]`-eventy już trafiały do pilla (generyczny gcal-priorytet), ale brzydko (surowy tytuł z
nawiasami). Nowy priorytet 3b, pozycjonowany jak zmiana pracy, format "TYP: PRZEDMIOT · SALA",
fioletowy akcent spójny z resztą funkcji planu zajęć. `tsc`/`jest` czyste (1067 testów, bez
zmiany — `TopPill.tsx` bez istniejącego pokrycia testami).

## ✅ Fix: licznik wody potrafił cofnąć się po synchronizacji z zegarka (2026-09-22)

Pełny opis w ARCHITECTURE.md §159. User: "na zegarku kliknąłem z 5/8 na 8/8, w apce po
odświeżeniu zestuckowało się na 7/8". Przyczyna: `useWaterTracker.ts`'s odroczony (350ms)
zapis po tapnięciu w `food.tsx` nadpisywał storage gołą lokalną wartością bez sprawdzenia
czy Health Connect w tle nie zaktualizował licznika świeższą wartością z zegarka (wyścig z
`feedWaterHabit()` w `habits.ts`, który już ma poprawny MAX-merge). Fix: `persist()` odczytuje
fresh storage tuż przed zapisem, finalna wartość = `Math.max(fresh, lokalna)` — spójne z
`feedWaterHabit()`'s "w ciągu dnia liczba tylko rośnie". Brak automatycznego testu (hook,
nietestowalny w obecnym Jest setupie), logika reużyta z już przetestowanego
`feedWaterHabit()`. `tsc`/`jest` czyste.

**🆕 Priorytet testu na urządzeniu — wysoki**: bezpośrednia odpowiedź na zgłoszony bug, trudno
idealnie odtworzyć (wymaga realnego wyścigu z synchronizacją zegarka) — obserwuj czy licznik
wody jeszcze kiedyś "cofnie się" po synchronizacji.

## ✅ Streaki: 2 nowe progi koloru + pasek postępu — najdłuższe "ciche" odcinki przycięte o połowę (2026-09-22)

Pełny opis w ARCHITECTURE.md §156. User: "jestem zestresowany na różowym kolorze już
[długo]... zaczyna dręczyć nie motywować". Policzone: progi koloru rosły z coraz większym
odstępem (1/7/14/30/60/100), więc różowy (30-59 dni) i błękit (60-99 dni) były 30/40-dniowymi
odcinkami BEZ ŻADNEJ zmiany koloru — dużo dłuższymi niż wcześniejsze progi (co tydzień-dwa).
Fix (user wybrał oba na raz): (1) dwa nowe progi wstawione w środku obu najgorszych odcinków
(Ametyst=45, Indygo=80, kolory systematycznie wyliczone jako RGB-środek sąsiednich progów),
przycina max "ciszę" z 30/40 do ~15/20 dni; (2) pasek postępu do następnego progu na
kafelkach `StreakWallCard` — codzienny mikroruch nawet w trakcie długiego odcinka. Przy okazji
`STREAK_TIERS`/`streakTier`/`streakColor` wydzielone do nowego `src/utils/streakTiers.ts`
(testowalność — `StreakFlame.tsx` importuje RN, było nietestowalne). `tsc`/`jest` czyste
(1053 testy, +7, w tym regresja pilnująca że żaden odcinek nie przekracza 20 dni).

**🆕 Priorytet testu na urządzeniu — wysoki**: to bezpośrednia odpowiedź na zgłoszony
dyskomfort. Sprawdź pasek postępu na kafelkach i czy nowe kolory (Ametyst, Indygo) pasują do
reszty palety.

## ✅ Obroża przebudowana z % na flat — jedyny slot gearu gasnący do zera na wysokim poziomie (2026-09-22)

Pełny opis w ARCHITECTURE.md §155. User: "ogarnij ekwipunek — patrz jak teraz stoi z
bossami". Zmierzone node'em: 5 z 6 slotów gearu (hełm/buty/talizman/kolczyki/zbroja) trzyma
wartość na każdym poziomie, ale obroża (atak%) matematycznie gasła — `atkMultiplier =
1+level×0.03+bonuses.atk`, poziom bez sufitu dominuje mnożnik, więc mityczna T5 obroża dawała
~9% mnożnika na Lv20, ~1.2% na Lv617 (realna runda testowa usera) = 0 ciosów różnicy w
walce. User wybrał (AskUserQuestion): przerobić obroża na PŁASKIE punkty ataku (jak kupiony
`atkStatBonus`, PRZED mnożnikiem) zamiast %. Nowa `gearAtkFlat()` w `gear.ts`, wpięta we
WSZYSTKIE tory walki (`app/boss-fight.tsx`, `app/pet.tsx`, `bossProgressReport.ts`). Efekt
zweryfikowany node'em: % boost z mitycznej T5 obroży TERAZ identyczny na Lv20 i Lv617
(+10.1% oba), zamiast gasnąć. `tsc`/`jest` czyste (1046 testów, +3).

**🆕 Priorytet testu na urządzeniu — średni**: ekran Ekwipunku (obroża pokazuje teraz płaską
liczbę "+N" zamiast "%"), ekran Pupila → Siła bojowa (rozbicie mocy ataku pokazuje gear
osobno). Efekt realnie widoczny dopiero z mityczną/legendarną obrożą założoną.

## ✅ Fix: siatka nastrój×energia w check-inie humoru nie łapała dotknięć (2026-09-22)

Pełny opis w ARCHITECTURE.md §153. User: "Nie dziala" + zrzut — kropka zostawała na środku,
"Jeszcze nie zaznaczono" mimo przeciągania, "Zapisz" zablokowany. Przyczyna: `ScrollView` w
`MoodCheckInModal.tsx` importowany z gołego `'react-native'`, nie `'react-native-gesture-
handler'` — konfliktował z `Gesture.Pan()` siatki (`MoodEnergyGrid.tsx`) i wygrywał dotyk
zanim gest siatki się odpalił. Dokładnie ten scenariusz poprzedni autor przewidział w
komentarzu przy siatce (2026-09-19), ale nie był jeszcze potwierdzony na urządzeniu. Fix:
zmiana importu na RNGH-owy `ScrollView` (drop-in). **Priorytet testu — wysoki**, sprawdź czy
przeciąganie/tapanie siatki teraz działa i odblokowuje Zapisz.

**🆕 Wzorzec do pilnowania na przyszłość**: każdy `GestureDetector`/`Gesture.*` (RNGH) wewnątrz
scrollowalnego rodzica wymaga `ScrollView`/`FlatList` TEŻ z `'react-native-gesture-handler'`,
nie z gołego `'react-native'` — inaczej rodzic może "zjadać" dotyk dziecka bez żadnego błędu
w konsoli (cichy, mylący objaw).

## ✅ Krzywa XP/poziom przyspiesza po kampanii — tłumienie skoków levelu z MAD (2026-09-22)

Pełny opis w ARCHITECTURE.md §152. User (5. runda testowa, po resecie): "z tymi bossami jest
popierdolone za dużo tego się dostaje przez co jest skok mnóstwo w górę lvl" — realny przykład
z 4. rundy: jedna walka MAD = ~28-29 poziomów w jednej walce. User sam zaproponował kierunek
zamiast przeskalowania nagrody MAD: "a może po prostu zamiast skakać level tak bardzo to
zwiększymy XP później per level". Fix w `petStore.ts`'s `levelFromXp`: krzywa identyczna do
poziomu 116 (koniec kampanii, cała wcześniejsza kalibracja nietknięta), od 117 wzwyż krok
XP/poziom rośnie dodatkowo `20*(level-116)` ponad poprzedni krok. Stała `m=20` wybrana z
przetestowanego zakresu na realnych danych usera — sprowadza przykładowy skok 697500 XP z ~29
do ~4 poziomów. `tsc`/`jest` czyste (1040 testów, +5, nowy plik `levelFromXp.test.ts`).

**🆕 Priorytet testu na urządzeniu — WYSOKI**: to pierwsze podejście, `m=20` to szacunek nie
zmierzone optimum. User ma obserwować 5. rundę testową i zgłosić czy skoki levelu przy dużych
walkach MAD są teraz sensowne (analogicznie do krzywej nagród MAD, która przeszła 2 iteracje
zanim osiadła).

## ✅ Przebalans ekonomii skrzynek — bug przepełnienia progów + box-tier cap na puli itemów (2026-09-22)

Pełny opis w ARCHITECTURE.md §154. User przysłał zrzut "Statystyki skrzynek" — drewniana
(najtańsza) cały czas mocno na plus, boska (najdroższa) dokładnie 0% monet na 40 otwarć.
Symulacja EV (`gearSellValue` + coins branch, przed dotknięciem liczb) ujawniła DWA problemy:
(1) prawdziwy bug — `gearChance+combatItemChance` przekraczało 100% dla gold/divine, branch
monet matematycznie nieosiągalny; (2) strukturalna wada — pula itemów capowana tylko
poziomem gracza, nie tierem skrzynki, więc tania miała dostęp do tych samych itemów co droga.
Fix: nowy `BOX_MAX_GEAR_TIER` (prawdziwy cap puli per skrzynka), `gearChance` przycięte żeby
suma z `combatItemChance` zawsze <1, zasięg monet drewnianej przycięty. User zdecydował:
przebuduj 4 istniejące tiery (nie dodawaj 5. za ~2k), ściągnij drewnianą do break-even. ROI
(symulacja, poziom 90+): drewniana ~104% (było ~207%), iron ~96%, gold ~79%, divine ~62%
(było -6%/0%-monet-bug). `tsc`/`jest` czyste (1043 testy, +3 regresyjne na oba bugi).

**🆕 Priorytet testu na urządzeniu — wysoki**: otwórz po kilka skrzynek każdego tieru,
sprawdź że złota/boska realnie dają monety, i że drewniana przy wysokim poziomie pupila nie
losuje już topowego ekwipunku. Pierwsze podejście do kalibracji — do docalibrowania na
świeżych danych z "Statystyki skrzynek" po dłuższym graniu (analogicznie jak krzywa nagród
MAD i krzywa levelu wyżej — obie przeszły iteracje po realnych danych).

## ✅ Plan zajęć [PUR] — rozpoznawanie eventów + kafelek dashboardu (2026-09-22)

Pełny opis w ARCHITECTURE.md §158 (kontynuacja §157). User (student UR) przesłał zarządzenie
Rektora UR o organizacji roku 2026/2027 + zrzut swojego planu zajęć — w rozmowie (nie w apce)
wygenerowany gotowy plik `.ics` na semestr zimowy, finalny format tytułu:
`[PUR] TYP - NAZWA - SALA` (TYP ∈ W/C/L/P — Wykład/Ćwiczenia/Laboratorium/Projekt). Mając już
realne dane do zweryfikowania, user poprosił o prawdziwą funkcję w apce (nie tylko prefiks).

**Zrobione**: `src/utils/classSchedule.ts` (`isClassEvent`/`parseClassEvent`, analogiczne do
`isWorkEvent()` ale bez parsera godzin z tytułu — zajęcia mają godziny WPROST z
`CalendarEvent`), nowa sekcja dashboardu `class-schedule` (`ClassScheduleCard.tsx`, layout
skopiowany z `GCalCard.tsx` + odznaka typu + sala, grupa "Zadania i nawyki", ładuje się w
pierwszej klatce jak `gcal`). `__tests__/classSchedule.test.ts` — fixtures to REALNE tytuły z
planu usera. `tsc`/`jest` czyste (1067 testów, +14).

**🆕 Świadomie NIE zrobione jeszcze**: powiadomienie X minut przed z salą (osobny przełącznik
w Ustawieniach, dziś synchronizowane wydarzenia z Google w ogóle nie mają push-powiadomień,
tylko bierny kafelek gdy apka otwarta) — ten sam wzorzec co powiadomienia o zmianach pracy w
`notificationsService.ts`, do zrobienia jako osobny krok.

**Priorytet testu na urządzeniu — wysoki**: zaimportuj plik `.ics` (osobny kalendarz Google,
łatwy do usunięcia jednym klikiem jeśli coś nie gra), poczekaj na sync, sprawdź kafelek
"Plan zajęć" na dashboardzie.

## ✅ Fix: eksport postępu pupila pokazywał niezaokrąglony float HP kotka (2026-09-21)

Pełny opis w ARCHITECTURE.md §151. User przysłał 4. eksport testowej rundy (poziom 617) —
"HP kotka: 6558.331368923098" zamiast czystej liczby. Przyczyna: `rollGearValue()` świadomie
losuje surowy float (inne miejsca liczą na tej precyzji), a `bossProgressReport.ts` liczyło
max HP RĘCZNIE zamiast wołać `effectiveCatMaxHp()` (tej samej funkcji co realna walka) —
pomijając zarówno zaokrąglenie, jak i `potionFlatHp` (aktywna mikstura HP w ogóle nie była
wliczana). Fix: raport woła `effectiveCatMaxHp()` wprost. Reszta eksportu przejrzana bez
dalszych anomalii — krzywa nagród MAD (§139) nadal ściśle rosnąca, kampania w pełni pokonana
~1 ciosem na bossa (oczekiwane na tak ekstremalnym poziomie testowym). `tsc`/`jest` czyste
(1035 testów, +2). Priorytet testu na urządzeniu: niski — kosmetyczny fix eksportu, żadna
realna mechanika walki się nie zmieniła.

## ✅ Humor local-first — zapis offline + auto-sync po powrocie sieci (2026-09-21)

Pełny opis w ARCHITECTURE.md §149 (fix nr 1: timeout, bezpiecznik) i §150 (fix nr 2: PRAWDZIWY
local-first, to o co userowi chodziło: "może zapisywać offline i wysłać jak będzie wifi").
Okazało się, że apka JUŻ MIAŁA ten dokładny wzorzec dla wydatków/paragonów
(`expensesStore.ts`'s `pendingSync`/`expenseSync.ts`'s `flushPendingExpenseWrites`/
`expensesService.newId()`+`addWithId()`) — `expenses/manual.tsx` zapisuje natychmiast lokalnie,
nawiguje dalej OD RAZU, Firestore leci w tle fire-and-forget. Humor tego nie miał. Przeniesiony
ten sam wzorzec 1:1: `moodStore.ts` dostał `pendingSync`/`addPending`/`markPending`/
`confirmSync` + merge-aware `setEntries`, `moodService.ts`'s blokujące `add`/`update` zastąpione
`newId()`+`addWithId()` (upsert), nowy `moodSync.ts` (`flushPendingMoodWrites`, wpięty w
`_layout.tsx` obok flusha wydatków), `MoodCheckInModal.tsx`'s `handleSave` i dashboardowy
`handleQuickMood` już nie `async`/`await` — zapis lokalny + zamknięcie modala natychmiastowe,
sieć w tle. `tsc`/`jest` czyste (1033 testy, bez zmiany netto — `moodStore.ts` nietestowalne
bezpośrednio, importuje `notificationsService`→`expo-notifications`).

**🆕 Systemowy zakres, NIE zrobiony teraz**: `expensesService.ts` już MA ten wzorzec (był
źródłem, nie brakiem) — reszta serwisów piszących do Firestore NADAL nie ma ani local-first
ani nawet samego `withTimeout()` z §149: `calendarService.ts`, `debtsService.ts`,
`maintenanceService.ts`, `subscriptionsService.ts`, `templatesService.ts`, `vehiclesService.ts`,
`workService.ts`, `backupService.ts`. Kandydat na dedykowany PR (sweep), jeśli to samo
zawieszenie wystąpi gdzie indziej albo user zdecyduje się ochronić resztę zapisów prewencyjnie.

**Priorytet testu na urządzeniu — wysoki**: (1) zapisz humor normalnie — bez zauważalnej
zmiany; (2) tryb samolotowy → zapisz humor → modal zamyka się NATYCHMIAST, wpis widoczny; (3)
wyłącz tryb samolotowy, wróć z tła apki — wpis synchronizuje się sam, bez żadnej akcji.

## 🆕 Rejestr lagu wątku JS na starcie — czeka na REALNE dane z urządzenia (2026-09-20)

Pełny opis w ARCHITECTURE.md §146. User: "zawsze te startupy animacje lagują... nie mogę
kliknąć, zrób rejestr żebyś miał realne dane". `AnimatedSplash.tsx` sam jest już w 100%
native-driver (nie może być przyczyną), więc podejrzenie pada na ~15 równoległych
`useEffect`ów w `_layout.tsx` odpalających się w jednym burście na starcie (crash-check,
auth, 5× migracja/loader, notification listener) — każdy to AsyncStorage round-trip, razem
realny kandydat na zajęty wątek JS = niedziałające dotyki. Dodany `startColdStartLagSampling()`
w `perfLog.ts` (próbkuje wątek JS co 50ms/8s od startu), nowe pola w Ustawienia → Diagnostyka →
Wydajność startu apki + przycisk "Udostępnij".

**NIE jest to fix — to zbieranie danych.** Priorytet: użyj apki normalnie kilka dni, potem
wyślij eksport z Diagnostyki. Wysoki `maxLagMs`/`totalLagMs` potwierdzi hipotezę burst-efektów
→ dalej faktyczna optymalizacja (rozłożenie w czasie). `tsc`/`jest` czyste (1031 testów, +1).

## ✅ Kategoryzacja produktów + cień kotka wyliczony (2026-09-21)

Pełne opisy w ARCHITECTURE.md §147 (cień) i §148 (kategoryzacja). User: "dawaj 1 i 2".

**Cień kotka** (§147): zamiast czekać na wizualne dostrojenie w Edytorze, policzony szacunek
z geometrii sprite'ów (`CAT_SHADOW_SCALE_X/Y = 0.45/0.13`, wyliczone z tego samego ~35%
współczynnika, który już wcześniej powiększał `CAT_PORTRAIT_SIZE`). **To szacunek, nie
pomiar** — priorytet testu na urządzeniu wysoki, jeśli nie pasuje popraw w Edytorze.

**Kategoryzacja produktów** (§148): `ReceiptItem.subTag` (jedna podkategoria, wewnątrz
pierwszego z `tags`) + pamięć w `productMemory.ts` (ten sam wzorzec co zwykłe tagi). Ekran
Produktów: widok grupowany top-level tag → podtag (tylko gdy nie szukamy), sortowanie
"Najczęściej kupowane" / "Ostatnio kupione", edytor produktu z nowym polem Podkategoria.
"Gdzie na paragonie" świadomie NIE zrobione (wymaga przebudowy skanera, poza zasięgiem).

`tsc`/`jest` czyste (1033 testy, +2). Priorytet testu na urządzeniu — wysoki dla obu (nowe
funkcje): (1) cień kotka wizualnie; (2) grupowany widok Produktów + zapis podkategorii +
sortowanie po dacie.

## ✅ TopPill — rotacja przez wszystkie zaległe/dzisiejsze zadania, nie jedno (2026-09-20)

Pełny opis w ARCHITECTURE.md §144. User: "co z pillem? Animacja przejściami lepszymi
odmianami zadań?". 4 z 7 pilnych stanów pilla (zaległe/dziś-zadania/budżet/gcal-wydarzenia)
zawsze wybierały TEN SAM element z listy kandydatów (najstarszy/najbliższy), ignorując
istniejący `calmTick` — user z wieloma zaległymi widział wiecznie jedno zadanie, a `key`
oparty o `.length` zamiast o id sprawiał, że animacja przejścia (§91) nigdy się nie odpalała w
tych stanach. Naprawione: `arr[calmTick % arr.length]` + `key` po id — rotacja przez
wszystkich kandydatów co ~8s, z płynną animacją przy każdej zmianie. `tsc`/`jest` czyste (1030
testów). Priorytet testu na urządzeniu: średni — dodaj 2+ zaległe zadania, sprawdź rotację.

## ✅ Edytor układu walki — niezależna skala/pozycja cienia + fix STARYCH domyślnych (2026-09-20)

Pełny opis w ARCHITECTURE.md §145. Przyczyna "cienie nie pasują skali": `GroundShadow` w
realnej walce liczył width/height jako JEDEN wspólny ułamek (0.62/0.18) rozmiaru portretu dla
kotka i bossa — działa dla bossa (PNG przycięte do sylwetki), nie dla kotka (SVG z dużym
pustym marginesem, stąd `CAT_PORTRAIT_SIZE` jest sztucznie ~35% większe od `PORTRAIT_SIZE`
bossa). Edytor (`battle-layout-lab.tsx`) dostał niezależną skalę X/Y + offsetY cienia PER
SPRITE (domyślnie = dzisiejszy ułamek, więc start Edytora nic nie zmienia wizualnie) — user
dostroi kotka osobno od bossa dotykiem/Stepperami, wyeksportuje, ja podepnę do
`boss-fight.tsx` (Edytor świadomie NIE czyta się live z ekranu walki).

**Przy tym naprawiony bug**: `BATTLE_LAYOUT_DEFAULT` (175/130, offsety=0) nie było
zaktualizowane po eksporcie z 2026-09-18 (realne stałe w `boss-fight.tsx` to już 205/150 +
offsety 45/45/10/10) — Edytor otwierał się z INNYM layoutem niż realna walka, mimo komentarza
w kodzie obiecującego "1:1 podgląd". Przywrócone do zgodności + bezpieczny `merge` dla starych
zapisanych draftów bez nowych pól cienia.

`tsc`/`jest` czyste (1030 testów, bez zmiany — dev-tylko poligon bez testów).
**Priorytet testu na urządzeniu — wysoki**: (1) otwórz Edytor, sprawdź że wygląda jak realna
walka; (2) sekcja "Cień" — dostosuj kotka osobno od bossa; (3) eksport zawiera nowe pola.

## ✅ Pierwszy etap "inteligentnych powiadomień" — nawyki żywe, fix persystencji godzin (2026-09-20)

Pełny opis w ARCHITECTURE.md §142. Drugi etap wieloczęściowego żądania usera (po §141
"techniczne bugi"; trzeci etap — kategoryzacja produktów — w toku, patrz niżej). Przypomnienie
o nawykach było jedynym z 4 typów przypomnień, które NIE było "inteligentne" — ślepy `DAILY`
alarm zaplanowany raz, ignorujący realny stan (trąbił "nie odhaczyłeś" nawet po odhaczeniu
wszystkiego). Przerobione na one-off DATE trigger re-armowany z `useHabits()` na każdą zmianę
stanu (mirror `refreshMoodReminder`/`refreshPetReminder`/`refreshBossReminder`) — skip-today
gdy wszystko zaliczone, treść z realną liczbą zostałych nawyków. Przy tej samej okazji
naprawiony osobny bug: godziny wszystkich 4 przypomnień w Ustawieniach zapisywały się, ale
NIGDY nie wczytywały z powrotem (pola zawsze resetowały się do domyślnych po zamknięciu
ekranu) — `notif_morning_hour/min` w ogóle nigdy nie było zapisywane. `tsc`/`jest` czyste (1030
testów, bez zmiany — plik notificationsService.ts nigdy nie miał testów, importuje
expo-notifications). **Priorytet testu na urządzeniu: wysoki** (nowe zachowanie) — patrz §142.

## ✅ Audyt reszty powiadomień + research kategoryzacji produktów (2026-09-20)

Pełny opis w ARCHITECTURE.md §143. User: "wszystkie powiadomienia możesz poulepszać, teraz
trochę lipią" — kontynuacja §142 na resztę typów. Reszta `refresh*` (serwis/wypłata/budżet/
podsumowanie tygodnia/karta miesiąca) już stanowa, nic do zmiany. Naprawione: (1) przypomnienie
PER-NAWYK (`Habit.reminderTime`) miało TĘ SAMĄ dziurę co zbiorcze z §142 — ślepy `DAILY`,
przerobione identycznie (DATE + `doneToday`, re-arm z `useHabits()`); (2)
`scheduleDailyTaskBriefing`/`cancelDailyTaskBriefing` — martwy kod, zero wywołań w repo,
zastąpiony dawno przez `scheduleDailyTodoList` ale nigdy nieodpięty — usunięty.

**Research trzeciego etapu (kategoryzacja produktów)**: `app/products.tsx`/`productMemory.ts`
już mają WIĘCEJ niż user zakładał — historia zakupów z linkiem do konkretnego paragonu (klik
→ `/expenses/[id]`), warianty rozmiaru osobno w statystykach, scalanie duplikatów. Realnie
brakuje: (1) hierarchii tag→podtag (dziś płaskie tagi, jedna lista); (2) grupowanego widoku w
UI (dziś jedna płaska lista sortowana po liczbie zakupów). "Gdzie na paragonie" (pozycja OCR)
NIE jest wykonalne bez przebudowy skanera — poza zasięgiem. **Konkretna propozycja czeka na
potwierdzenie usera przed implementacją** (zmiana modelu danych, nie mechaniczny fix) — patrz
§143 dla szczegółów.

`tsc`/`jest` czyste (1030 testów). Priorytet testu na urządzeniu: średni (przypomnienie
per-nawyk — ustaw godzinę na konkretnym nawyku, zaznacz go przed tą godziną, sprawdź że nie
przypomni dzisiaj).

## ✅ Konsolidacja duplikatów setMonth-overflow + dokończenie sweepu selektorów (2026-09-20)

Pełny opis w ARCHITECTURE.md §141. User: "ogarnij wszystko te techniczne bugi". Repo-wide
grep za wzorcem `setMonth(...getMonth()+...)` znalazł bug ZDUPLIKOWANY w 3 kolejnych plikach
(`dashboard/subs.ts` — literalna kopia funkcji z recurringBills.ts, z własnym testem
pinującym buggy zachowanie; `subscriptionAuto.ts`'s `advanceBillingDate` — używana w
AUTOMATYCZNYM dopasowywaniu płatności bankowych, bankCommit.ts — najpoważniejszy przypadek,
cichy drift bez żadnej interakcji usera; `maintenanceCalendar.ts` — osobna kopia dla wydarzeń
kalendarza "wymiana oleju"). Skonsolidowane do JEDNEGO źródła (`recurringBills.ts`) zamiast
3 niezależnych kopii, `maintenanceCalendar.ts` przepisany na `date-fns`. Dokończony sweep
selektorów store'ów: `PetCustomizeModal.tsx` (zawsze zamontowany na /pet, miał całkowicie
goły `usePetStore()`), reszta `useExpensesStore()` w `bosses.tsx`/`boss-fight.tsx`. Świadomie
NIE dotknięte pozostałe 12 miejsc — albo ekrany analizy wydatków potrzebujące szerokiego
dostępu, albo rzadko odwiedzane ekrany ze stosu, selektor by nic nie dał. `tsc`/`jest` czyste
(1030 testów). Priorytet testu na urządzeniu: średni.

## ✅ Audyt logika/optymalizacja, runda 3 — pojazdy/raid/wydajność (2026-09-20)

Pełny opis w ARCHITECTURE.md §140. Trzecia runda audytu, świeże obszary (raid/wydarzenia
sezonowe/gear-shop/pojazdy/liczniki). 3 znaleziska: (1) `maintenanceDueMonths` w
`vehicleMatch.ts` — ta sama klasa `setMonth`-overflow co §138, przeoczona w nowym pliku,
naprawiona `addMonths`; (2) raid tygodniowy — pasek/% "cofał się" po level-upie w trakcie
tygodnia (mianownik liczony na żywo, licznik zbankowany raz) — naprawione nowym polem
`raidMaxHp` w petStore, bankowanym razem z `raidHp`; (3) `bosses.tsx` miało CAŁKOWICIE goły
`usePetStore()` (bez `useShallow` w ogóle) — przeoczone przy wcześniejszych audytach
wydajności, plus `counters.tsx`/`counters/[id].tsx` dostały selektor `expenses`. Sprawdzone i
czyste: wydarzenia sezonowe, ekonomia gear/sklepu, liczniki, reszta raidu. `tsc`/`jest` czyste
(1030 testów, +4 nowe). Priorytet testu na urządzeniu: niski-średni.

## ✅ Przebudowa nagród MAD bossów — na podstawie realnego eksportu usera (2026-09-20)

Pełny opis w ARCHITECTURE.md §139. User przysłał realny eksport po skoku 51→270 poziomów w
dzień — potwierdzone: MAD order1 dawał 1:1 tyle co finał kampanii, 9 walk MAD = ~82% CAŁEGO
XP na koncie. Nowy wzór: order1 = własna nagroda bossa × malejący mnożnik trudności (20→1),
order22 (=finał) = nagroda finału bez skoku. Pierwsza wersja fixu (czysta interpolacja
własna→finał) była sprawdzona throwaway-symulacją w Node PRZED wdrożeniem i okazała się
niemonotoniczna (nagroda w środku skali przekraczała finał, potem spadała z powrotem) —
naprawione capem `REWARD_ANCHOR_CAP_OF_FINALE=0.6`, zweryfikowanym na wszystkich 22 orderach.
`tsc`/`jest` czyste (1026 testów, w tym test monotoniczności na całej skali). Priorytet testu
na urządzeniu: średni — wczesne MAD bossy dają teraz WYRAŹNIE mniej niż wcześniej, to
zamierzone.

## ✅ Audyt logika/optymalizacja — kalendarz/questy/subskrypcje, 4 znaleziska (2026-09-20)

Pełny opis w ARCHITECTURE.md §138. Kolejna runda audytu (jak §126/§127), świeże obszary:
kalendarz, questy pupila, pomodoro, subskrypcje, jedzenie. Naprawione: (1+2) `setMonth` bez
przycięcia w DWÓCH miejscach — `nextDeadline` (zadania cykliczne) i `advanceNextBillingDate`/
`isDurationExpired` (subskrypcje) gubiły/dryfowały przy dniu 29-31, fix przez `date-fns`'s
`addMonths`/`addQuarters`/`addYears`; (3) `mapEvent` w sync Google Calendar nigdy nie
ustawiało `endDate` — wielodniowe eventy z Google widoczne tylko w dniu startu; (4) wydajność
`usePetQuests.ts`/`pet-quests.tsx` — gołe store bez selektora (wpływa na ping-badge widoczny
na 4 ekranach Pupila naraz). Sprawdzone i czyste: Pomodoro, questy (claim-race/nagroda za
zaległe), jedzenie/kalorie. `tsc`/`jest` czyste (1026 testów, +18 nowych). Priorytet testu na
urządzeniu: średni — patrz checklist w §138 (zadanie cykliczne 29-31, subskrypcja z dniem
29-31, import wielodniowego eventu z Google jeśli podłączony).

## ✅ Fix: kamień milowy w tasku nie skreślał się na żywo (2026-09-19)

Pełny opis w ARCHITECTURE.md §137. User: "jak klikam milestony w taskach... nie zaznacza sie
na żywo muszę wyjść i wejść z taska". `TaskDetailModal`'s task pochodził z zamrożonego
`useState` snapshotu ustawianego raz przy otwarciu — `onToggleSubtask` poprawnie update'ował
store, ale modal tego nie widział. Naprawione: state trzyma tylko id, obiekt liczy się
`useMemo` z żywej listy `tasks`. Sprawdzone że ten sam wzorzec nie występuje w innych modalach
(habits.tsx/mood.tsx/habit-year.tsx — żaden nie ma live-toggle checklisty w zamrożonym
snapshocie). `tsc`/`jest` czyste (1008 testów). Priorytet testu: niski.

## ✅ Fix: eksport postępu pupila tracił starsze walki + 🆕 CZEKAM na dane usera (2026-09-19)

Pełny opis w ARCHITECTURE.md §136. User: "pełna historie eksportu pupila... z dnia na dzień
wbiłem z 51 lvl na 270 xddd pojebane". Bug: `buildBossProgressReport`'s `logLimit` (30) nie
skracał raportu, UCINAŁ go — wpisy starsze niż 30 najnowszych znikały CAŁKOWICIE. Naprawione:
`detailLimit` teraz kontroluje tylko szczegółowość (pełny przebieg walki vs. jednolinijkowy
skrót), nic już nie znika z eksportu. `tsc`/`jest` czyste (1008 testów).

**DO ZROBIENIA (czeka na usera, nie na mnie)**: user ma pójść do Ustawienia → Pupil →
"Udostępnij raport postępu pupila" i wysłać mi PEŁNY eksport (teraz faktycznie pełny) — chce
zbadać czy skok 51→270 poziomów w jeden dzień to bug w balansie nagród MAD bossów
(`madRewardMultFor`/`MAD_HP_MULT` w `madBosses.ts`) czy coś innego. Bez realnych liczb nie da
się tego ocenić — ta sama zasada co przy każdej wcześniejszej kalibracji bossów w tej sesji
(throwaway-symulacja na realnych danych, nigdy zgadywanie).

## 🆕 Redesign check-inu humoru — siatka nastrój×energia, notatka opcjonalna (2026-09-19)

Pełny opis w ARCHITECTURE.md §135. User: "nie wiadomo co zaznaczam... nie zawsze da się
szybko kliknąć... dawaj pomysły". Trzy zmiany: (1) notatka dnia opcjonalna (był to głowny
powód "za wolno" — 4 wymuszone kroki → 2); (2) dwa osobne rzędy nastrój/energia zamienione
na jedną siatkę 2D 5×5 (`MoodEnergyGrid.tsx`, NOWY plik) — tap lub przeciągnięcie ustawia oba
naraz; (3) `sortMoodTags` dostał dwa nowe sygnały (pora dnia/dzień tygodnia, recency-ważona
częstość) ponad istniejące dopasowanie mood/energy. **PRIORYTET TESTU NA URZĄDZENIU —
WYSOKI**: to gest RN (react-native-gesture-handler) zagnieżdżony w zwykłym ScrollView, bez
możliwości przetestowania bez fizycznego urządzenia — sprawdź czy siatka łapie dotknięcia
płynnie i czy scroll modala nadal działa POZA siatką. Jeśli nie — fix jest udokumentowany w
kodzie (`MoodEnergyGrid.tsx`, komentarz przy `pan`): zamienić import `ScrollView` w
`MoodCheckInModal.tsx` z 'react-native' na 'react-native-gesture-handler'. Świadomie NIE
zrobione: sygnał sen/kroki z innych ekranów (wymaga najpierw współdzielonego selektora
"dzisiejszy sen", którego dziś nie ma — patrz §135). `tsc`/`jest` czyste (1008 testów).

## ✅ Wydajność scan.tsx — literka w produkcie re-renderowała cały paragon (2026-09-19)

Pełny opis w ARCHITECTURE.md §134. Dokończenie DRUGI RAZ odłożonego fixa (§118, §127) —
`ProductRow`/`CustomProductRow` re-renderowały WSZYSTKIE ~20-30 wierszy paragonu na każdą
zmianę w jednym polu (nazwa/cena/waga/ilość/tag/...), bo każdy z ~15+8 callbacków był
tworzony na nowo przy każdym renderze rodzica. Fix: callbacki przeniesione do `useCallback`
z pustymi deps + biorą `index` jako argument (stabilna referencja), `React.memo` z własnym
comparatorem (bo `productTags`/`eaters`/`priceFlag` bywają nową wartością o tej samej
treści). `tsc`/`jest` czyste (1005 testów, bez zmian w testach — czysto wydajnościowy
refaktor). Priorytet testu na urządzeniu: średni-wysoki — patrz checklist w §134 (długi
paragon, edycja pól, pickery kategorii/tagów na różnych wierszach, "kto jadł", zapis).

## ✅ Fix: ekran Bossy domyślnie wracał na "Kampania" mimo skończonej kampanii (2026-09-19)

Pełny opis w ARCHITECTURE.md §133. User: "jak pokonałem wszystkie bossy kampanii to główna
zakładka musi być wtedy madbossy". Przełącznik Kampania/MAD (`app/bosses.tsx`) miał zakodowany
domyślny widok "Kampania", który resetował się przy każdym wejściu na ekran (ekran się
odmontowuje między wizytami) — z kampanią skończoną to zawsze pokazywało martwy ekran
"Wszyscy bossowie pokonani!" zamiast realnego celu (MAD). Teraz domyślna zakładka podąża za
postępem (mad gdy kampania 100% skończona), ręczne przełączenie trzyma wybór do wyjścia z
ekranu. `tsc`/`jest` czyste (1005 testów, bez zmian w testach). Priorytet testu: niski.

## ✅ Fix: 26 miejsc bez poprawnej odmiany przez liczbę w całej apce (2026-09-19)

Pełny opis w ARCHITECTURE.md §131 (kafel pupila, pierwszy fix) i §132 (wynik agent-audytu —
26 kolejnych naprawionych). User: "nagrody u pupila nie odmieniają się przez liczbę...
sprawdzaj tam i wszędzie". Naprawione `plPlural()`: powiadomienia push, dashboard (seria
logowań/monety, nawyki wieczorem, gablota odznak), habit-year, finanse, tydzień, paragony/
produkty/audyt finansów, przedmioty domowe/subskrypcje (dni do terminu), statystyki skrzynek,
ekwipunek pupila, roczne/miesięczne podsumowania, karta Wrapped miesiąca, backfill Samsung
Health, kopia zapasowa, diagnostyka Health Connect. Po drodze naprawiony test, który
asercją zamrażał złą odmianę ("2 rund" zamiast "2 rundy"). Świadomie NIE ruszone: konstrukcje
ułamkowe "X/Y rzeczownik" (np. "3/5 zadań") — te ZAWSZE biorą dopełniacz l.mn., podmiana na
`plPlural` byłaby NOWYM bugiem, nie fixem (szczegóły w §132). `tsc`/`jest` czyste (1005
testów). Priorytet testu na urządzeniu: niski-średni, rozproszone po całej apce.

## ✅ Fix: nieopisany pasek "% celu snu" na karcie Sen w Zdrowie (2026-09-18)

Pełny opis w ARCHITECTURE.md §130. User: "zdrowie mało czytelne" → doprecyzowane: chodzi o
kartę Sen, "duzo kresek i slupkow ale malo danych... nic prawie nie opisane". Znaleziony
realny gap: `microBar` (pasek % z 9h "celu" snu) nie miał ŻADNEGO tekstu opisującego co
pokazuje — dodany podpis. Doprecyzowane też "wahania ±X min" → "wahania noc do nocy ±X min".
`tsc`/`jest` czyste. Priorytet testu: niski, czysto tekst.

**Nie ruszane**: user w pytaniu doprecyzowującym ODRZUCIŁ opcję "pigułka ZADANIE W TOKU
zasłania górny rząd kafelków na dashboardzie/zdrowiu" (`TopPill`, `app/(tabs)/_layout.tsx`,
`position:absolute` floating nad każdą zakładką) — mimo że na screenie wyglądało jak realny
overlap, user wybrał "co innego". Jeśli to jednak realny problem, wróci jako osobne zgłoszenie.

## ✅ Rozbudowa panelu "Statystyki apki" — okresy, trendy, kolejność ekranów, odbicia (2026-09-18)

Pełny opis w ARCHITECTURE.md §128. User: brakowało w panelu (Ustawienia → Dane →
Statystyki apki) sum otwarć dziś/tydzień/miesiąc, porównań do poprzedniego okresu, trendów
per-ekran i tego "jakie ekrany po sobie"/"czy się jakieś zacinają pomiędzy sobie". Dodane 4
nowe karty: "Otwarcia" (dziś/tydzień/miesiąc + delta vs poprzedni okres), "Trendy ekranów"
(które zyskały/straciły otwarcia tydzień do tygodnia), "Najczęstsza kolejność ekranów" (z
jakiego na jaki najczęściej), "Ekrany na przemian" (pary gdzie user odbija się w obie
strony — sygnał że coś nie jest wygodnie dostępne z jednego miejsca). Wszystko czyste,
testowalne funkcje w `usageStatsAnalysis.ts` (+13 testów). `tsc`/`jest` czyste (1000
testów). Priorytet testu na urządzeniu: niski-średni — otwórz panel, sprawdź że liczby się
zgadzają i że nowe karty (zwłaszcza kolejność/odbicia) pokazują sensowne pary ekranów.

## ✅ Audyt logika/optymalizacja, runda 2 — streak tygodniowy + self-transfer #5 + wydajność (2026-09-18)

Pełny opis w ARCHITECTURE.md §127. User: "dawaj dalej logika i optymalizacja". Znalezione i
naprawione: (1) streak nawyku z celem TYGODNIOWYM miał sztywny limit "max 4 tygodnie" —
realny, wielomiesięczny nawyk 3×/tydzień pokazywałby "4" na zawsze; (2) `habit-year.tsx` w
ogóle nie znało celu tygodniowego, więc dla TEGO SAMEGO nawyku lista Nawyków i habit-year
pokazywały RÓŻNE liczby dni z rzędu (np. "4" vs "0 dni z rzędu") — oba miejsca teraz wołają
jedną, wyeksportowaną i przetestowaną funkcję (`weeklyTargetStreak`, `src/utils/habits.ts`);
(3) self-transfer leak #5 (piąta runda) — karta "Zależności" na dashboardzie liczyła przelew
własny jako wydatek w korelacjach sen/nastrój↔wydatki; (4) wydajność runda 4 — `TaskCard`/
`SwipeRow` (Zadania) dostały `React.memo`, `GearPanel`/`GearSlotModal` i `app/pet.tsx`
przestały subskrybować całe store'y bez selektora. `tsc`/`jest` czyste (993 testy, +5
nowych). Priorytet testu na urządzeniu: średni — patrz checklist w §127.

**Odłożone świadomie (patrz §127 "explicite NIE zrobione")**: `scan.tsx`'s `ProductRow`/
`CustomProductRow` — potwierdzony, wysoki-impact bug wydajnościowy (literka w jednym produkcie
re-renderuje CAŁY paragon), ale duży refaktor (~15 callbacków × 2 komponenty), odłożony DRUGI
raz świadomie. Kandydat na kolejną rundę, jeśli user zauważy lag przy skanowaniu długich
paragonów.

## ✅ Audyt logika/optymalizacja — nocna zmiana w powiadomieniach + 3 dziury self-transfer (2026-09-18)

Pełny opis w ARCHITECTURE.md §126. User: "dawaj dalej logika i optymalizacja". Fresh audyt
(budżety/stałe koszty/wypłata/powiadomienia — obszary jeszcze nietknięte w tej sesji) znalazł
i naprawił: (1) powiadomienie "koniec zmiany" dla nocnej zmiany pracy (np. 22:00-06:00)
leciało PRZED jej początkiem z "zarobiłeś 0.00 zł" — brak rollover daty, wyniesione do
testowalnej `shiftFireTimes()` w workEvents.ts; (2) "Podsumowanie tygodnia" liczyło przelew
własny jako wydatek (jedyny agregator w index.tsx bez `isSelfTransfer`); (3) alert budżetu
per-kategoria miał własną, nieodfiltrowaną kopię tej samej liczby co `stats.
monthCategorySpend` (już poprawna) — teraz czyta tamtą; (4) tag-limit bary też dostały
brakujący filtr, dla zgodności. To już 4. runda tego samego powtarzającego się typu buga
(self-transfer leak) w tym repo. `tsc`/`jest` czyste (988 testów, +5 nowych). Priorytet
testu na urządzeniu: średni — sprawdź powiadomienie końca nocnej zmiany (realna kwota, nie
0 zł po czasie) i że przelewy własne nie liczą się do "Podsumowania tygodnia"/alertu budżetu.

## ✅ Self-review §124 — kolizja w migracji instancji mogła po cichu nadpisać gear (2026-09-18)

Pełny opis w ARCHITECTURE.md §125. Delegowany agent-audyt na redesign z §124 znalazł 1
realny bug: migracja starych zapisów gearu mapowała KAŻDY stary wpis na `:001` na oślep,
bez sprawdzenia czy ten klucz już zajęty — przy mieszanym stanie (stary goły wpis + już
zmigrowana instancja tego samego itemu, realny scenariusz przy starym APK z GitHuba)
jedna z dwóch kopii po cichu nadpisywała drugą, bez błędu/logu. Naprawione (migracja
szuka pierwszego wolnego seq, nie zawsze `:001`) + 3 nowe testy regresyjne, które testują
`onRehydrateStorage` naprawdę (przez zustand v5 `persist.getOptions()` seam, bez mocka
AsyncStorage). `tsc`/`jest` czyste (983 testy). Priorytet testu na urządzeniu: niski-średni
— tylko jeśli masz STARY zapis z przed §124 i coś w ekwipunku po aktualizacji wygląda
nieoczekiwanie.

## 🆕 Redesign ekwipunku pupila — każdy drop = trwała instancja z własnym id (2026-09-18)

Pełny opis w ARCHITECTURE.md §124. User (ze screenshotem Butów): duplikaty gearu czasem
"łączyły się" i user nie dostawał ani itemu ani monet. Zaproponowałem lżejszą alternatywę,
user explicit odrzucił i potwierdził pełny redesign: każdy drop dostaje trwałe id
`itemId:seq` (np. `helm_slomiany:001`), user widzi ile kopii ma ("×N"), rozwija żeby
zobaczyć float/wartość każdej z osobna, sprzedaje wybraną ILOŚĆ duplikatów naraz, ekwipunek
wyżej na ekranie, bez emoji w etykiecie slotu. Po drodze znaleziony i naprawiony REALNY bug
dokładnie matchujący skargę usera: `openCrate()` (skrzynka sardynek za głaskanie) miała
własną, nieskopiowaną kopię starej logiki "czy to ulepszenie", która przy gorszym dropie
PO CICHU go odrzucała bez ŻADNEJ kompensaty (inne dwie ścieżki dropu przynajmniej dawały
monety) — `CrateModal.tsx` mimo to zawsze pisało "🎁 Ekwipunek: {name}". `ownedGear` zmienia
kształt (flat mapa instancji, nie 1 slot per item), `isGearUpgrade()`/`dupeCoins`/
`alreadyOwnGear()` USUNIĘTE — nic już nie ocenia automatycznie "lepsze/gorsze", user sam
decyduje. Migracja stalych zapisów jest idempotentna (bezpieczna na każdym starcie apki).
`GearPanel.tsx` przepisany pod grupowanie po itemie + stepper ilości do sprzedaży.
`tsc`/`jest` czyste (980 testów, 2 pliki testowe przepisane pod nowe API). **Priorytet
testu na urządzeniu — wysoki, patrz pełna lista w ARCHITECTURE §124**: (1) 2+ kopie tego
samego itemu zostają WIDOCZNE osobno, nie zlewają się; (2) rozwinięcie grupy pokazuje
realny float każdej kopii; (3) "Sprzedaj kilka…" ze stepperem liczy monety poprawnie i
sprzedaje najsłabsze; (4) skrzynka sardynek kilka razy pod rząd — KAŻDY drop gearu
faktycznie się pojawia (dawny bug); (5) stary zapis (przed update) migruje się poprawnie
przy pierwszym starcie po aktualizacji.

## ✅ Audyt Gabloty — zdobyta odznaka mogła "wrócić do zablokowanej" (2026-09-18)

Pełny opis w ARCHITECTURE.md §123. User: "rzuć okiem na gablotę... czy to wgle dziala i
liczy dobrze". Znaleziony i naprawiony 1 poważny bug: `habitBestStreak` i inne
streak-owe pola (loginStreak/goodMoodStreak/noJunkStreak/...) to AKTUALNE serie, nie
rekordy wszech czasów — Gablota renderowała `unlocked` z żywych danych, więc raz zdobyta
streak-owa odznaka (np. "Nieugięty" 100 dni) wizualnie WRACAŁA DO ZABLOKOWANEJ po
zresetowaniu streaka, mimo że była trwale zapisana w `earned`. Naprawione (`applyEarnedFloor`
— raz zdobyte, zostaje pokazywane jako zdobyte na zawsze). Reszta systemu (loginStreak,
cardBalancePeak, dishesCreated, wszystkie pola AchCtx, neutralMoodStreak) sprawdzona i
czysta. Osobno: 17/99 odznak nie ma własnej grafiki (fallback na generyczną ikonę,
udokumentowane, nie zepsute — do decyzji usera czy dorysować). `tsc`/`jest` czyste (+3
testy). Do zrobienia (user, na urządzeniu, wysoki priorytet jeśli masz zdobyte streak-owe
trofea): otwórz Gablotę, sprawdź że wszystkie wcześniej zdobyte odznaki nadal pokazują się
jako zdobyte.

## ✅ Fix: brakujące kategorie jedzenia w pickerze tagów (jajka/przyprawy/makarony/...) (2026-09-18)

Pełny opis w ARCHITECTURE.md §122. User: auto-wykrywanie "jaja" i kategorii
makarony/ryż i kasze/mąka i produkty sypkie "nie działa" — zweryfikowane, DZIAŁA
poprawnie (test na realnych nazwach). Prawdziwa przyczyna: 4 osobne, rozjeżdżające się
kopie `ITEM_TAGS` (picker do ręcznego tagowania) nigdy nie dostały 8 nowych kategorii z
§111 — user nie miał jak kliknąć ich ręcznie ani poprawić starego paragonu. Naprawione:
jedno źródło prawdy (`FOOD_ITEM_TAGS` w food.ts). `tsc`/`jest` czyste. Do zrobienia (user,
na urządzeniu): sprawdź picker tagów w Produktach/edycji paragonu — nowe kategorie powinny
być teraz klikalne, w tym na starych, wcześniej zeskanowanych pozycjach.

## ✅ Fix: Podsumowanie tygodnia (Finanse) liczyło praktycznie same zera (2026-09-18)

Pełny opis w ARCHITECTURE.md §121. Background-audyt dat znalazł: `app/weekly.tsx` porównywał
pełny timestamp `Expense.date` z gołą datą `dates[6]`/`d` BEZ `.slice(0,10)` — suma wydatków/
przychodów tygodnia gubiła KAŻDĄ transakcję z ostatniego dnia (niedziela), a dzienny wykres
słupkowy renderował praktycznie same zera na wszystkie dni (nie tylko ostatni). Zweryfikowane
realnie w Node, nie tylko wyczytane. Naprawione (4 miejsca). `tsc`/`jest` czyste. Do
zrobienia (user, na urządzeniu, średni-wysoki priorytet): Finanse → Tydzień, sprawdź że suma
uwzględnia niedzielne transakcje i że dzienny wykres pokazuje realne kwoty.

## ✅ Edytor układu walki — eksport podpięty do realnej walki (2026-09-17 → 2026-09-18)

Pełny opis w ARCHITECTURE.md §120 (edytor) i §129 (podpięcie). User wytunował układ w
`/battle-layout-lab`, wkleił eksport w rozmowie — podpięte do `app/boss-fight.tsx` dla
WSZYSTKICH 6 trybów walki: pupil/boss większe (150/205), oba mają NIEZALEŻNE offsety pozycji
(zastąpiły dawne wspólne `SPRITE_GROUND_SHIFT`), paski HP dostały WŁASNY offset (wcześniej
nie miały żadnego). `tsc`/`jest` czyste. **Priorytet testu na urządzeniu: wysoki** — sprawdź
wszystkie 6 trybów (kampania/raid/event/quest/mad/misja), zwłaszcza że pocisk leci PRZEZ
sprite'y, nie nad/pod nimi.

**Odłożone (user wspomniał, bez konkretnej specyfikacji)**: przemianowanie/wywalenie starych
bossów, przesunięcie cienia bliżej, usunięcie lodowej areny (zła perspektywa) — czeka na
konkretniejszą instrukcję co dokładnie i jak.

## ✅ Self-review §118 — martwy `index` prop unieważniał React.memo (2026-09-17)

Pełny opis w ARCHITECTURE.md §119. `ExpenseItem.tsx`'s `index: number` w `Props` był
martwy (nigdy nie użyty w ciele komponentu) już przed poprzednim fixem — nieszkodliwe,
dopóki komponent nie był memoizowany. Świeżo dodany `React.memo` (§118) porównuje WSZYSTKIE
propsy płytko, więc zmieniający się `index` przy każdym dodaniu/usunięciu transakcji cicho
unieważniał memo dla sąsiadujących wierszy. Usunięty z Props i z wywołania w
`finances.tsx`. `tsc`/`jest` czyste. Do zrobienia: brak — czysto wewnętrzne.

## ✅ Audyt wydajności, runda 3 — memo scope + React.memo + themedStyles (2026-09-17)

Pełny opis w ARCHITECTURE.md §118. Kontynuacja tego samego background-audytu: memo scope
w `app/food/products.tsx` (wyszukiwarka "Kompozycje i dania" przeliczała drogą część na
każdy klawisz), `ExpenseItem.tsx` bez `React.memo` (+ wyniesienie `onPress`/`onLongPress`
w `finances.tsx` do `useCallback`), i DWA prawdziwe naruszenia reguły #1 z CLAUDE.md —
`HabitRow`/`NoteCard` budowały style gołym `StyleSheet.create` a nie przez `themedStyles()`.
Wszystko naprawione, `tsc`/`jest` czyste. Świadomie NIE zrobione: `scan.tsx`'s
`ProductRow`/`CustomProductRow` — ta sama brakująca memoizacja, ale ~15 zależnych
callbacków per wiersz, wyższe ryzyko/koszt, odłożone na osobną rundę. Do zrobienia (user,
na urządzeniu, niski/średni priorytet): scroll długiej listy w Finansach, szukajka w
Jedzenie → Kompozycje i dania, wizualna kontrola Nawyków/Notatek (bez zmian, tylko
wewnętrzna budowa stylów).

## ✅ Audyt self-transfer, runda 3 — 2 kolejne miejsca (2026-09-17)

Pełny opis w ARCHITECTURE.md §117. Agent-audyt (background, "optymalizuj szukaj bugów")
znalazł kolejne 2 miejsca z tym samym powtarzającym się kształtem buga co §93/§104:
`groceryTotal`/`sweetsTotal` w `dashboard/spend.ts` i `case 'tagSpend'` w
`statWidgets.ts` nie wykluczały self-transferu, mimo że sąsiednie funkcje/case w tych
samych plikach już to robią. Naprawione + 3 nowe testy regresyjne. `tsc`/`jest` czyste
(981 testów). Do zrobienia (user, niski priorytet): brak — poprawka dotyczy tylko rzadkiej
kombinacji (przelew własny z tagiem słodycze/przekąski lub kategorią groceries).

## ✅ Redesign ekwipunku pupila — zakładki, tap-outside, sprzedaż zbiorcza (2026-09-17)

Pełny opis w ARCHITECTURE.md §116. User: skarga na 4 rzeczy w `GearPanel.tsx` — malutkie
ikonki slotów wymuszające zamykanie/otwieranie modala dla każdego slotu, brak tap-outside
(tylko malutki X), goły `sellLink` bez paddingu (ciężko trafić), i brak zbiorczej sprzedaży
"podobnych itemów z gorszym floatem". Naprawione wszystkie 4: pasek zakładek wszystkich 6
slotów, tap na tło zamyka, przycisk Sprzedaj z realnym paddingiem+ikoną, "Sprzedaj X
niezałożonych" per slot. **Pasek zakładek/tap-outside ZOSTAJĄ** w §124 (2026-09-18) redesign
instancji — tamten wpis to kolejny krok na tym samym pliku, nie zamiana tego.

## ✅ Self-review #224: bug w logu "Historia zmian" dla pojazdu (2026-09-17)

Pełny opis w ARCHITECTURE.md §115. Kolejna runda po "dawaj dalej" — `after.vehicle` w
`summarizeChanges()` (`app/expenses/[id].tsx`) liczył się z surowego `vehicleId`, nie z
`updates.vehicleId` (to, co faktycznie zapisuje `editIsIncome ? undefined : vehicleId`) —
przy przełączeniu typu na Przychód w tym samym zapisie log Historii zmian mógł pokazać
brak zmiany pojazdu, mimo że pojazd faktycznie został wyczyszczony. Naprawione — jedna
linijka. `tsc`/`jest` czyste. Do zrobienia (user, na urządzeniu, niski priorytet): edytuj
wydatek z pojazdem, przełącz na Przychód w tym samym zapisie, sprawdź log.

## ✅ Self-review §113: 2 bugi znalezione i naprawione przed testem na urządzeniu (2026-09-17)

Pełny opis w ARCHITECTURE.md §114. Po "DAWAJ DALEJ" (bez konkretnego zgłoszenia) zrobiłem
przegląd właśnie zmergowanego #223 zamiast czekać na zgłoszenie buga. Znalazłem: (1) hydracja
formularza edycji w `app/expenses/[id].tsx` mogła zwrócić PUSTY formularz przy cold-starcie
przez deep-link `?edit=1` (lub long-press zaraz po otwarciu apki), jeśli `expense` z store'a
jeszcze się nie załadował na pierwszym renderze — naprawione flagiem `hydratedOnce`. (2)
`editHistoryStore.ts` miał niestabilny selektor Zustand (`forExpense(id)` budował nową
tablicę przy każdym wywołaniu) — usunięty, `app/expenses/[id].tsx` teraz filtruje przez
`useMemo` na surowym `st.entries` (wzorzec jak `useBankQueue`). `tsc`/`jest` czyste (978
testów, bez zmiany liczby). Do zrobienia (user, na urządzeniu): force-stop apki → deep-link
do transakcji z `?edit=1` (albo od razu long-press kafelka w Finansach po świeżym starcie) →
sprawdzić że formularz pokazuje REALNE dane transakcji, nie puste pola.

## 🆕 Redesign szczegółów transakcji + historia zmian + long-press na liście (2026-09-17)

Pełny opis w ARCHITECTURE.md §113. Skonsolidowany tryb odczytu (jedna karta "Szczegóły"
zamiast 4-5), tap na dowolny wiersz → od razu edycja, sticky pasek Zapisz/Anuluj nad
klawiaturą, nowa "Historia zmian" per transakcja (co edytowano + co nauczono/zapisano do
pamięci — `src/store/editHistoryStore.ts`), i long-press na kafelku w Finansach → od razu
tryb edycji (prop `onLongPress` istniał w `ExpenseItem.tsx` od dawna, ale nigdy nie był
podpięty).

**✅ Long-press na liście — potwierdzone działa (2026-09-23)**. Reszta (czytelność Szczegółów,
sticky pasek nad klawiaturą, Anuluj faktycznie cofa zmiany, Historia zmian pokazuje sensowny
opis) nadal do przetestowania.

## ✅ Fix: edycja tagów/kategorii w Finanse → Produkty nic nie zapisywała wstecz (2026-09-17)

Pełny opis w ARCHITECTURE.md §112. Tag/kategoria trafiały tylko do `productMemory`
(podpowiedź na przyszłość), nigdy nie były zapisywane wstecz na już istniejących pozycjach
paragonów, a ekran Produkty czyta tagi wprost z historii — więc "Zapisz" wizualnie nic nie
zmieniało. Naprawione: teraz retroaktywnie nadpisuje wszystkie pasujące pozycje. Przy
okazji: dodana "Historia zakupów" (gdzie/kiedy, tap → do paragonu) + lepszy chip-picker
tagów (ten sam wzorzec co w edycji pojedynczego paragonu). Do zrobienia (user, na
urządzeniu): zmień tag produktu w Finanse → Produkty, sprawdź że lista NATYCHMIAST to
pokazuje, i że link do "Historia zakupów" prowadzi do właściwego paragonu.

## ✅ Fix: Saldo dashboardu liczyło gotówkę mimo etykiety "na karcie" + 8 nowych kategorii jedzenia (2026-09-16)

Pełny opis w ARCHITECTURE.md §110-111. Dwa osobne zgłoszenia: (1) "Saldo" na dashboardzie
finansów (`app/(tabs)/finances.tsx`) sumowało kartę I gotówkę mimo etykiety "NA KARCIE" —
`allExp`/`allInc` nie filtrowały `paymentMethod`, `cashExp`/`cashInc` liczone osobno ale
nigdy nie odjęte. Naprawione. (2) Rozbudowa kategorii jedzenia w rozkładzie wydatków — 8
nowych (jajka/makarony/ryż i kasze/mąka i produkty sypkie/oleje i tłuszcze/przyprawy/
konserwy i przetwory/mrożonki) + realny fix brakujących słów kluczowych dla "sosy" (tag
istniał, ale nigdy nic się pod niego nie łapało). Do zrobienia (user, na urządzeniu):
sprawdzić parę realnych paragonów pod kątem czy nowe kategorie sensownie się przypisują, i
czy Saldo teraz faktycznie nie rusza się przy płatnościach gotówką.

## ✅ Fix: tło lokacji misji trafiało za GearPanel zamiast tylko do paska ładowania (2026-09-15)

Pełny opis w ARCHITECTURE.md §107. Art `LOKALIZACJA_LODOWA.png` (i przyszłe lokacje pod
kolejnych minibossów) renderował się jako tło CAŁEJ sceny Pupila (za kotkiem + 6 slotami
ekwipunku) zamiast tylko wewnątrz paska postępu misji, jak zamierzone ("ładuje się
kraina X"). Przeniesione do `s.missionBarTrack` w `app/pet.tsx` — `tsc`/`jest` czyste.
Do zrobienia (przez usera, na urządzeniu): otworzyć misję do Lodowej Krainy, sprawdzić że
tło widać TYLKO w pasku "1:XX:XX", a scena z kotkiem/ekwipunkiem jest znów czysta.

## ✅ Statystyki otwierania skrzynek (Rynek/pet-shop) per typ skrzynki (2026-09-15)

Pełny opis w ARCHITECTURE.md §108. User: *"niech mi tez da statystyki tam otwierania
skrzynek (procentowe, zysk,strata itp itd zeby balansować trochę pozniej... ale to nic nie
zmieniaj ja pootwieram ze statystykami podzielonym per skrzynka zeby wiedzieć jak
balansować nie q ciemno"*. Zaimplementowane: `boxStatsStore.ts` (capped log, wzorzec jak
`usageStatsStore`) + `boxStatsAnalysis.ts` (per-skrzynka % typu nagrody, rozkład rzadkości
monet basic/legendary z avg, rozkład rzadkości ekwipunku, bilans monet) + panel
`app/box-stats.tsx` + skrócona karta w Ustawienia → Dane. Logowanie wpięte w oba miejsca
wołające `rollBox()` (`onBuyBox` w pet-shop.tsx, `onDailyBox` w pet.tsx), darmowa
Skrzynka dnia rozdzielona od płatnej Drewnianej mimo tego samego `BoxId`. **Zero zmian
w wartościach ekonomii** — `tsc`/`jest` czyste (+ nowy test `boxStatsAnalysis.test.ts`).
Do zrobienia (user): pootwierać sporo skrzynek na urządzeniu, sprawdzić czy panel
faktycznie pokazuje to zniekształcenie (common 60-80 vs legendary jackpot 40) o którym
wspomniał — dopiero potem osobna rozmowa o rebalansie.

## ✅ Audyt bezpieczeństwa — keystore zrotowany, 1 punkt zostaje (2026-09-15)

Pełny opis w ARCHITECTURE.md §105. User potwierdził: apka NIE jest na Play Store (tylko
GitHub + własne urządzenie), więc rotacja klucza podpisującego była bezpieczna —
zrobiona. Nowy keystore + nowe losowe hasło wygenerowane, user zapisał je jako sekrety
GitHub (`KEYSTORE_BASE64` zaktualizowany, nowy `ANDROID_KEYSTORE_PASSWORD` dodany),
`build.yml` zaktualizowany żeby czytać hasło z sekretu zamiast mieć je wpisane na
sztywno (3 miejsca). Stare hasło `sapp123release` zostaje trwale w historii gita (nie do
wymazania bez dużo bardziej ryzykownego przepisania całej historii repo), ale nic już nim
nie chroni — stary keystore przestał być używany.

**PRIORYTET po następnym buildzie z GitHub Actions**: nowy APK ma INNY podpis niż
obecnie zainstalowany na telefonie — Android nie pozwoli zainstalować go jako
"aktualizacji" w miejscu. Trzeba: (1) zrobić kopię zapasową w apce (Ustawienia → Dane →
Kopia zapasowa) na wszelki wypadek, choć dane i tak są w chmurze Firestore; (2)
odinstalować obecną apkę; (3) zainstalować nowy APK i zalogować się ponownie tym samym
kontem Google.

**Zostaje (osobny temat, nie blokuje niczego pilnie)**: **Reguły bezpieczeństwa
Firestore nie istnieją w tym repo** (żyją w konsoli Firebase) — nie dało się
zweryfikować czy realnie ograniczają dostęp do `users/{uid}/...` po stronie serwera.
Warto kiedyś sprawdzić w konsoli Firebase, że każda taka ścieżka wymaga
`request.auth.uid == uid`, nie tylko `request.auth != null` (apka loguje się anonimowo
jeśli normalny login nie zdąży w 4s, a to jest trywialnie dostępne dla każdego z
publicznym `apiKey` projektu).

## 🆕 Audyt poprawności — 3 realne bugi naprawione, priorytet testu (2026-09-15)

Po dwóch rundach optymalizacji (§13, §103) ten sam agent-audyt, tym razem szukający
bugów logicznych zamiast wolnej pracy. Pełny opis w ARCHITECTURE.md §104:
1. **Przełącznik "Przelew własny" w edycji transakcji** nie działał dla przelewów
   wykrytych automatycznie z banku (patrzył tylko na tag 'przelew', a bank zapisuje
   `category: 'transfer'` + tag 'revolut') — user nie miał jak cofnąć klasyfikacji z tego
   ekranu. Naprawione: przełącznik czyta/pisze pełną semantykę `isSelfTransfer`.
2. **"Zapisz przypomnienia" po cichu z powrotem włączało Humor**, nawet gdy user go
   jawnie wyłączył osobnym przełącznikiem — zapis DOWOLNEGO innego ustawienia na tym
   ekranie cofał tę decyzję. Ten sam kształt buga co dwa już naprawione w §101.
3. **Self-transfer wyciekał do jedzenia/słodyczy/rozbicia "wg kategorii"** w
   `statWidgets.ts` — niespójność WEWNĄTRZ tych samych funkcji (siostrzane `case`
   'spend'/'income' już wykluczały, 'food'/'sweets'/'byCategory' nie). Ten sam kształt
   buga co §93 (wtedy 8 miejsc), teraz 3 kolejne + 3 nowe testy regresyjne.

Jeden kandydat (wyścig przy migracji `migratePaydayDefaultOff`) świadomie NIE naprawiony
— niepewny, niski wpływ (najwyżej jeden nieaktualny prompt "dostałeś wypłatę?" raz).

**PRIORYTET testu na urządzeniu** (realne bugi funkcjonalne, nie kosmetyka): (1) auto-
wykryty przelew Revolut → edytuj → przełącznik pokazuje WŁĄCZONY, wyłącz+zapisz →
transakcja liczy się normalnie; (2) wyłącz Humor, zapisz coś innego na tym ekranie → Humor
MA zostać wyłączony; (3) statystyki jedzenia/słodyczy i rozbicie "wg kategorii" nie
uwzględniają przelewów własnych.

## 🆕 Optymalizacja wydajności — runda 2, statyczny audyt (2026-09-15)

Kontynuacja §13 (2026-09-02) po tygodniu nowego kodu. Agent Explore przeskanował
kodobazę pod kątem trzech znanych klas bugów (niestabilne closures w długich listach,
drogie przeliczenia per-klawisz, przewymiarowane assety) + `StyleSheet.create` poza
`themedStyles()`. Trzy realne, potwierdzone i naprawione — pełny opis w §103:
1. Finanse — wyszukiwarka tagu przeliczała filtr + zagnieżdżony skan `receiptItems` nad
   CAŁĄ historią transakcji na KAŻDY klawisz (gorszy wariant buga z §13).
2. Gablota (Osiągnięcia) — 99 odznak bez memoizacji, każdy render rodzica przerysowywał
   wszystkie.
3. Ręczny paragon — edytor pozycji (`ItemRow`) bez memoizacji, ten sam kształt.

Assety graficzne i `StyleSheet.create` sprawdzone — bez regresji, nic do poprawy.
`tsc`/`jest` czyste, zero zmian logiki biznesowej.

**Priorytet testu na urządzeniu**: patrz checklist w §103 (wyszukiwarka tagu w Finansach,
scroll/klik w Gablocie, edycja wieloproduktowego ręcznego paragonu).

## ✅ Sprzątanie Ustawień — WSZYSTKIE 5 rund zrobione, batch zamknięty (2026-09-15)

User w jednej wiadomości dał 7 zgłoszeń do Ustawień (+ zrzut ekranu sekcji banku,
przesłany dwukrotnie) — teraz wszystkie zaadresowane, każde osobnym PR-em:
- Runda 1 (§98): "Pytaj o wypłatę" domyślnie wyłączone, martwy przełącznik "Ogranicz
  animacje" usunięty, sekcja "Więcej" → "Skróty".
- Runda 2 (§99): overhaul sekcji "Auto-wydatki z banku" — historia odczytów, czytelność.
- Runda 3 (§100): pełny redesign nawigacji Ustawień — menu kategorii zamiast akordeonu,
  kliknięcie otwiera podstronę.
- Runda 4 (§101): powiadomienia — 4 realne bugi naprawione (mylący master, resetujący
  się stan, martwa flaga), dwa nachodzące na siebie ekrany scalone w jeden.
- **Runda 5 (§102, ta sesja) — ostatnia**: pełny panel "Statystyki apki"
  (`app/usage-stats.tsx`), osobna trasa z linkiem z Ustawienia → Dane. Model danych
  rozszerzony o `usageStatsStore.events` (capped log zdarzeń z timestampem — dotąd był
  tylko agregat count+lastOpenedAt). Trzy wykresy: dziennie (14 dni, gołe `View`-bary jak
  w `weekly.tsx`, bez biblioteki wykresów), rozkład godzinowy ("o której porze dnia"),
  pełny nieucięty ranking ekranów. Agregacje w testowalnym
  `src/utils/usageStatsAnalysis.ts` (+6 nowych testów).

**Explicite NIE zrobione, każde jako osobny przyszły temat (nie część tej rundy)**:
personalizacja WYGLĄDU/treści każdego powiadomienia (§101 — wymaga własnej decyzji
projektowej: co edytowalne, jak to się ma do typów z dynamiczną treścią); UI do godzin
`pet-daily`/`boss-ready` (istnieją w kodzie, zero UI, nie bug — osierocony punkt
rozszerzenia).

## 🆕 Cold start: Stack nie czeka już na Firebase auth — PRIORYTET testu (2026-09-15)

User: *"nadal aplikacja bardzo laguje na wejściu... czy trzeba co zrobić?"* — Diagnostyka
(licznik startu w Ustawieniach) pokazała REALNĄ przyczynę: średnio ~1508ms do 1. klatki
dashboardu, z czego dosłownie WSZYSTKO to czekanie na `_layout.tsx`, które blokowało CAŁY
`<Stack>` (każdy ekran) za rozwiązaniem Firebase auth, zanim cokolwiek mogło się w ogóle
zamontować. Pełny opis w ARCHITECTURE.md §97. Skrót: auth resolution przeniesione do
`firebase.ts` jako `whenAuthReady()`, `uid()`/`userCol`/`userDoc`/`userSubcol`/`userSubdoc`
są teraz `async` i CZEKAJĄ na auth WEWNĄTRZ siebie zamiast rzucać błąd jeśli odpalą się za
wcześnie — więc `<Stack>` może renderować się natychmiast, bez zewnętrznego gate'u. 60
miejsc w 10 plikach serwisów zaktualizowanych, wszystkie zweryfikowane przez `tsc` (zero
błędów po zmianie).

**PRIORYTET testu na urządzeniu — to duża zmiana architektoniczna, sprawdź dokładnie**:
(1) Ustawienia → Diagnostyka → nowy czas startu powinien być WYRAŹNIE niższy niż stara
średnia ~1508ms; (2) każdy ekran (Finanse/Kalendarz/Zadania/Nastrój/Pojazdy/itd.) nadal
poprawnie ładuje dane z chmury, tylko chwilę PO pierwszym renderze zamiast przed nim; (3)
dodaj coś zaraz po otwarciu apki (zanim auth na pewno się rozwiąże) → sprawdź że realnie
zapisało się w chmurze, nie tylko lokalnie; (4) offline przy starcie → apka działa normalnie
lokalnie, sync dogania później jak zawsze.

## 🆕 Ekran walki: kotek/boss niżej + stara arena kampanii odpięta — NIEsprawdzone (2026-09-14)

User zrzutem: *"muszą być niżej żeby wyglądali jakby byli, i wywal te stara arenę i daj ten
las górski"*. Pełny opis w ARCHITECTURE.md §96. Skrót: (1) `ScrollView` nie miał `style=
{{flex:1}}`, więc karta walki nie centrowała się wcale — teraz zakotwicza się do DOŁU
dostępnej przestrzeni (`justifyContent:'flex-end'`), żeby portrety trafiały w "naziemną"
dolną część zdjęcia lokacji, jak na wszystkich 3 obecnych tłach (GORSKILAS/JUNGLA/LODOWA);
(2) Kampania straciła swoje stare, dedykowane tło (dungeon) — teraz też dostaje GORSKILAS
jak reszta trybów bez własnej lokacji.

**NIE zweryfikowane na urządzeniu** — priorytet: (1) Kampania pokazuje GORSKILAS, nie stary
dungeon; (2) kotek/boss wyraźnie niżej, blisko "ziemi" na obrazku, w KAŻDYM trybie walki.

## 🆕 Ekran walki: pełnoekranowe tło + WALCZ dokowany na dole jak navbar — NIEsprawdzone (2026-09-14)

User dostarczył 2 kolejne pełnoekranowe tła (JUNGLA pod osę, GORKISLAS pod wilka — i jako
NOWY domyślny fallback dla trybów bez własnego tła) i poprosił o przebudowę ekranu walki:
*"przycisk walki od teraz będzie lewitował na dole jak navbar jakby obok niego dane, a paski
zdrowia pod nimi cienie zostają"*. Pełny opis w ARCHITECTURE.md §95. Skrót: tło teraz
wypełnia CAŁY ekran walki (wszystkie 6 trybów — kampania/raid/event/quest/MAD/misja, nie
tylko questowe minibossy), przycisk WALCZ + pigułka energii + "Pomiń walkę" przeniesione do
dokowanego paska na dole (ten sam wzorzec co TabBar.tsx), zawsze widocznego niezależnie od
scrolla. Paski HP pod portretami CELOWO nietknięte.

**NIE zweryfikowane na urządzeniu** — priorytet: (1) każdy z 6 trybów walki ma pełnoekranowe
tło; (2) osa/wilk w queście/misji pokazują swoje dedykowane lokacje; (3) przycisk WALCZ
zawsze widoczny na dole, czytelny na różnych tłach; (4) paski HP wyglądają jak wcześniej.

## 🆕 Miniboss "Lodowy Królik" + tła lokacji misji + grafika zamrożenia serii — NIEsprawdzone (2026-09-14)

User dostarczył 3 pliki wprost na GitHub (`MBOSS_LODOWYKROLIK.png`, `LOKALIZACJA_LODOWA.png`,
`freeze_streakCoin.png`) i poprosił o retematyzowanie destynacji OSA/GRIZZLY/WILK (jungla/
polana nad wodą/środek lasu). Pełny opis w ARCHITECTURE.md §94. Skrót: nowy miniboss
`mb_lodowykrolik` w rosterze questów/misji, NOWY system teł lokacji na scenie "W drodze"
(`app/pet.tsx`) — scrim + jasnoszara "mgiełka" nad każdym tłem, żeby różne palety (lód/
dżungla/las) nie gryzły się kolorystycznie — na razie tylko lodowa lokacja ma plik, reszta
(osa/grizzly/wilk) czeka aż user dostarczy grafiki (dodanie = jedna linia w
`MISSION_LOCATION_BG`, bossIcons.ts). Zamrożenie serii w Rynku dostało własną monetę zamiast
lucide płatka śniegu.

**NIE zweryfikowane na urządzeniu** — priorytet: (1) trafić na Lodowego Królika w misji →
sprawdzić tło + czytelność tekstu; (2) sprawdzić że pozostałe 9 minibossów wygląda BEZ ZMIAN
(brak tła — nic nie powinno się różnić od wcześniej); (3) slot Zamrożenia w Rynku pokazuje
nową grafikę.

## 🆕 Self-transfer wyciekał do statystyk poza bilansem — domknięcie (2026-09-14)

User po włączeniu przełącznika z poprzedniego wpisu: *"przelew własny nadal sie liczy do
sumy na finansach nie?"*, potem: *"inne statystyki tez powinny brać pod uwagę ze to
przelew własny a nie cos co mam / wydaje"* (bilans NA KARCIE ma zostać jak jest — to
potwierdzone). Pełny opis w ARCHITECTURE.md §93. Skrót: `isSelfTransfer()` był
honorowany tylko częściowo — audyt znalazł 8 miejsc (dzienny total w Finansach, drill-down
w Kalendarzu, widget Budżet na Dashboardzie, tygodniowe widgety dashboardu, raport
miesięczny/roczny, widget "ile na jedzenie", cały ekran "Tydzień", cały ekran "Statystyki
wydatków"), gdzie self-transfer nadal liczył się jak zwykły wydatek/przychód. Wszystkie
poprawione.

**NIE zweryfikowane na urządzeniu** — priorytet: oznacz wydatek jako "Przelew własny",
sprawdź że znika z KAŻDEGO miejsca wymienionego wyżej, ale bilans NA KARCIE u góry
Finansów się NIE zmienia (to jedyne celowe wyjątkowe miejsce).

## 🆕 Ręczny przełącznik "Przelew własny" na szczegółach transakcji — NIEsprawdzone (2026-09-13)

User dopytał po poprzednim wpisie: *"mam opcje dosac własną kategorie jakby?? Czyli
właśnie ten przelew wlasny? Który sie nie wlicza"*. Pełny opis w ARCHITECTURE.md §92.
Skrót: dotąd self-transfer dało się oznaczyć TYLKO auto-wykryciem z banku — teraz na
ekranie szczegółów wydatku/przychodu jest ręczny `Switch` "Przelew własny" (między
Kategorią a Tagami), który dodaje/usuwa istniejący tag `przelew` (już rozpoznawany przez
`isSelfTransfer`). W karcie kwoty pojawia się też czytelny badge, gdy transakcja jest
self-transferem.

**NIE zweryfikowane na urządzeniu** — priorytet: włącz przełącznik na dowolnej transakcji,
zapisz, sprawdź że kwota znika z sum wydatków/przychodów na liście Finansów i wraca po
wyłączeniu.

## 🆕 Pill bez odbicia + przelew własny po imieniu + plakietki FV do szczegółów — NIEsprawdzone (2026-09-13)

Trzy prośby jednym zgłoszeniem, pełny opis w ARCHITECTURE.md §91: (1) *"animacja przejścia
pomiędzy wiadomościami... wygląda jak bouncy ball"* — `TopPill.tsx` przepisany ze
`Animated.spring` na `Animated.timing` + `Easing.out(Easing.cubic)`, bez przestrzelenia;
(2) *"trzeba dodać kategorie przelew własny jak jest do Wiktor Rudziński... to przelew
wewnętrzny do mnie samego"* — nowe pole "Twoje imię i nazwisko" w Ustawieniach →
Auto-wydatki z banku (`ownName.ts`), `parseBankNotification` rozpoznaje teraz `selfTransfer`
też po dopasowaniu `odbiorca` do tego imienia, nie tylko po słowach-kluczach
Revolut/oszczędności; (3) *"stale/zmienne tagi w finansach na głównej... dzwinie zaburza mi
to... kafelki"* — plakietka Stałe/Zmienne/Jedzenie (`FvBadge.tsx`) usunięta z listy wydatków,
widoczna wyłącznie po wejściu w szczegóły wydatku.

**NIE zweryfikowane na urządzeniu** — priorytet: (1) pill przy zmianie treści wygląda płynnie,
bez odbicia; (2) przelew na drugie własne konto (bez Revolut w treści) po wpisaniu
imienia+nazwiska w Ustawieniach ląduje jako "odłożone", nie wydatek/przychód; (3) lista
Finansów bez plakietek, plakietka widoczna i działająca w szczegółach wydatku.

## 🆕 TopPill: zadanie bez terminu przestaje wiecznie świecić + kanał "flash" — NIEsprawdzone (2026-09-13)

User: *"za często tam sie pokazuje ze mam zadanie... ono nie ma terminu i świeci mi sie na
dole bez sensu... a dodatkowo niech moze tam si epokazuja te powiadomienia ze sie pill lekko
rozszerza... seria logowan, albo ze dodano płatność automatyczna"*. Pełny opis w
ARCHITECTURE.md §90. Skrót: fallback "N zadań w toku" w TopPill teraz wymaga terminu
(deadline/scheduledDate), tak jak reszta priorytetów — zadanie bez terminu już nigdy nie
zapala pilla. Nowy `pillFlashStore.ts` (generyczny, `show()`/`clear()`) daje drugi kanał dla
ważnych powiadomień — podpięty do dwóch ISTNIEJĄCYCH toastów usera dokładnie opisanych
(seria logowań, auto-dodana płatność z banku), pokazuje się w pillu z najwyższym
priorytetem na kilka sekund, NIE zastępując toastu (oba naraz).

**NIE zweryfikowane na urządzeniu** — priorytet: (1) zadanie bez terminu faktycznie znika
z pilla, (2) flash mignie przy logowaniu/auto-płatności bankowej i sam zniknie po ~6s.

## 🆕 Naprawiony nierozokraglony Max HP + powiększony reel skrzynki — NIEsprawdzone (2026-09-13)

User zrzutem: "Max HP kotka: 397.9813491557909" (nierozokraglone) + "animacja [reela
skrzynki] jest za mała powieksz ja o 50 prc minimum". Pełny opis w ARCHITECTURE.md §89.
Skrót: `effectiveCatMaxHp` (petStore.ts) teraz zaokrągla wynik — ułamkowy roll zbroi ze
skrzynki już nie wycieka na ekran ani do walki. Reel otwierania skrzynki (BoxRevealModal.tsx)
powiększony min. +50% (komórki, ikony, wskaźnik), okno reela RESPONSYWNE (useWindowDimensions,
sufit 400px) zamiast sztywnej stałej, żeby nie przelewało się na wąskich telefonach.

**NIE zweryfikowane na urządzeniu** — priorytet: (1) Max HP bez dziesiętnych, (2) reel
wyraźnie większy i mieści się na ekranie.

## 🆕 Stałe/Zmienne: rozbicie mieszanego paragonu per produkt (reużyty mechanizm food) — NIEsprawdzone (2026-09-13)

User: *"muszę miec opcje zaznaczenia edytowania co jest stała a co zmienna, tak jak w
jedzeniu moge zaznaczyć ze to nie jedzenie każdego produktu osobno (tak jest teraz)"*.
Pełny opis w ARCHITECTURE.md §88. Zamiast budować NOWY przełącznik per-produkt, podłączony
JUŻ ISTNIEJĄCY mechanizm "nie jedzenie" (`toggleItemFood`/`foodAmountOf`) do klasyfikacji
Stałe/Zmienne/Jedzenie (`fvSplitOf` w `fixedVariable.ts`) — mieszany paragon (jedzenie +
chemia) dzieli się teraz PROPORCJONALNIE zamiast wpadać w cały jeden kubeł. Odznaka na
liście wydatków pokazuje obie etykiety naraz dla mieszanych paragonów ("Jedzenie +
Zmienne").

**NIE zweryfikowane na urządzeniu** — priorytet: sprawdź na realnym paragonie z mieszaną
zawartością, że kwoty w widgecie "Na co idą pieniądze" i na liście się zgadzają i sumują
do całości.

## 🆕 Sklep: gradientowa nazwa + aura rzadkości + większe itemy + potki — PRIORYTET testu (2026-09-13)

**DRUGA próba naprawy tego samego buga** (pierwsza, §73e, "naprawiona" samym `lineHeight`
na zwykłym `<Text>`, NIE przeszła realnego testu na urządzeniu — user zrzutem dowiódł że
gradient nadal ucina nazwę). Tym razem nazwa itemu przeniesiona na prawdziwe SVG
(`GradientText.tsx`, nowy generyczny komponent) — jawny baseline zamiast RN Text/Android
font-metric loterii. Pełny opis w ARCHITECTURE.md §87. W tym samym batchu: nazwa jako
gradient koloru rzadkości, kolorowa poświata (`RadialGlow`) dookoła 4 itemów Sklepu dnia,
powiększone ikony (74%/78%), podpięte własne grafiki potek (były w `assets/potki/`, nie
`assets/bossy/` jak user pamiętał — tylko nigdy nie podłączone do UI), usunięty nietrafiony
podpis pod sceną Sklepu.

**NIE zweryfikowane wizualnie na urządzeniu — to jest TERAZ priorytet #1**, zwłaszcza samo
"czy gradient faktycznie już nie ucina nazwy" (patrz checklist w ARCHITECTURE.md §87). Jeśli
nadal się powtórzy — SVG-owy `GradientText` eliminuje teoretyczny root cause (font-metric
niezgodność RN Text/Android), więc trzeci błąd wskazywałby na coś innego (np. font systemowy
w SVG realnie inny niż w RN Text, złe dobranie `fontSize`/`maxChars` w fit-scale) — nie
próbować czwarty raz "na oko", tylko poprosić o świeży zrzut z konkretnym itemem i długością
nazwy.

## 🆕 Odznaka Stałe/Zmienne/Jedzenie na liście wydatków (audyt) — NIEsprawdzone (2026-09-12)

User: *"ulepsz oznaczanie żebym mógł jano widzieć na wydatkach co jest jedzeniem co jest
nie jedzeniem co stałym wydatkiem a co zmiennym zeby widzieć czy dobrze łapie"*. Pełny opis
w ARCHITECTURE.md §86. Skrót: każdy wydatek na liście w Finansach ma teraz małą kolorową
odznakę (Stałe/Zmienne/Jedzenie, kolory jak w widgecie dashboardu) — tap otwiera inline
korektę (fvOverride) bez wchodzenia w osobny modal. Przychody i self-transfery (oszczędności)
celowo bez odznaki.

**NIE zweryfikowane wizualnie na urządzeniu** — priorytet: (1) czy klasyfikacja faktycznie
zgadza się z oczekiwaniami usera (to jest właśnie cel tej zmiany — jeśli okaże się że
heurystyka `bucketOf()`/`isFixedExpense()` się myli systematycznie, to osobna naprawa, nie
tylko `fvOverride` per transakcja), (2) czy tap na odznakę w liście nie koliduje z
nawigacją do szczegółów wydatku.

## 🆕 Usunięto martwy weeklyReports.ts (2026-09-12)

User: *"szybką decyzja wywalamy to weekly reports"*. Zero importerów, martwy generator
raportu tygodniowego (przed `monthlyReports.ts`, który jest realnie używany) — usunięty w
całości, `tsc`/`jest` zielone. Pełny opis w ARCHITECTURE.md §85. **Zamknięte, nic więcej do
zrobienia.**

## 🆕 Sufit czerwonej energii per poziom pupila + podbita trudność raidu/eventu + niższe sprite'y (2026-09-12)

User odpowiedział na 3 otwarte pytania z poprzedniej rundy (§82/§83). Pełny opis w
ARCHITECTURE.md §84. Skrót:
- `eventDailyAttempts` (sufit "czerwonej" puli event/raid) przebudowany z `energyMult` (z
  łupu/gear) na `level` pupila: Lv1-2→1, Lv3-5→2, Lv6-14→3, Lv15+→4 — reużywa istniejących
  kamieni milowych gry. Naprawia mylącą pigułkę "15/2" (sufit z inwestycji nie miał związku
  z realnym, trwałym bankiem).
- `raidHpFor` ×1.5, `eventHpFor` ×1.6 — bo Lv15+ dostaje teraz twardy sufit 4 prób/dzień,
  user zażądał "o wiele trudniejsze względem realnych danych". Raid: tylko dłuższy grind
  (counterHp osobno skalowany, bez zmiany ryzyka/rundę). Event: realnie ~×2.5 ryzyka walki
  (hp idzie wprost do counterDamage, mechanizm kwadratowy).
- `SPRITE_GROUND_SHIFT` w boss-fight.tsx: 14→21 (+7px w dół), pasek HP/tło nietknięte.

**Świadomie odłożone, jak poprzednio**: pełne skalowanie HP raidu/eventu od REALNEJ mocy
gracza (`defeatedBosses.length`/bonuses), nie tylko `level` — głębsza zmiana, nie to o co
user prosił teraz (prosił o bump trudności, nie redesign formuły). `weeklyReports.ts` — user
odpowiedział "raczej nie wiem", zostaje nietknięty, NIE dotykać bez nowej prośby.

`tsc`/`jest` zielone (72 suit/942 testy). **NIE zweryfikowane wizualnie na urządzeniu** —
patrz checklist w ARCHITECTURE.md §84.

## 🆕 Samodzielny przegląd kondycji apki — downscale 15 assetów (−25.8MB) — (2026-09-12)

User: *"ogarniaj dalej szukaj optymalizuj i zapisuj co mamy"*. Pełny opis w
ARCHITECTURE.md §83. Skrót:
- 15 nieprzepuszczonych przez downscale assetów ekwipunku/potek (1-2.5MB/szt, renderowane
  jako 44-62px ikony) przeskalowanych tym samym przepisem co reszta — 27.0MB → 1.3MB.
- `src/services/*` i `src/components/**` (poza `ui/`) — bez martwych plików.
- Wzorzec ANR ze `StyleSheet.create` w renderze — zero wystąpień, healthy.

**Do decyzji z userem, nie ruszone**:
- `src/utils/weeklyReports.ts` (247 linii, generator raportu tygodniowego) — ZERO importerów
  w całej apce. Dokończyć (jaki ekran?) czy usunąć jak `ocrService.ts` w §81?
- `assets/lokalizacje/LOKACJA_KAMPANIA.png`(1.25MB)/`TLOSKLEPIKARZ.png`(411KB) — spore, ale
  to pełnoekranowe tła, nie ikony — potrzebują ostrożniejszej kalibracji rozmiaru niż proste
  "300px długi bok" jak ikony. Kandydat do przycięcia PRZY OKAZJI, nie pilne.

**Kandydaci pod przyszłe "co dodać"** (z wcześniejszych rund sugestii w tej rozmowie, wciąż
odłożone, patrz historia wyżej w tym pliku): eksport CSV — ZROBIONE; globalna wyszukiwarka —
ZROBIONE (podpięta); natywny widget na ekran główny — odłożony (koszt baterii + złożoność
natywna); skaner kodów kreskowych — odłożony explicite przez usera ("olewamy").

## 🆕 Kotek nie nachodzi na itemy + większa/epicka animacja skrzynki — NIEsprawdzone (2026-09-12)

User (3 różne, w tej samej rozmowie): *"1. red energy 15/2 bez sensu — ODŁOŻONE, pytanie do
usera 2. mieliśmy obniżyć trochę podczas walki pupila i bossa — ODŁOŻONE, niejasne co
konkretnie 3. obszar głaskania pupila nie wchodził na itemy — ZROBIONE 4. animacja
skrzynki: powiększyć + epickie przejście — ZROBIONE"*. Pełny opis (3+4) w ARCHITECTURE.md §82.

1. `pet.tsx`: `catSize` teraz ograniczony realną szerokością ekranu (`useWindowDimensions`),
   nie stałą wartością — kotek nie może już fizycznie nachodzić na flankujące sloty.
2. `BoxRevealModal.tsx`: skrzynka +50% większa, nowa faza `opening` (trzęsie się → błysk →
   reel) zamiast natychmiastowego cięcia closed→spinning.

`tsc`/`jest` zielone (72 suit/940 testów, bez nowych). **NIE zweryfikowane wizualnie na
urządzeniu.**

**⚠️ DWA PUNKTY ODŁOŻONE do wyjaśnienia z userem (NIE zgadywane)**:
- "Czerwona energia 15/2 bez sensu" — `eventEnergy` (raid/event) BANKUJE się bez sufitu
  (celowo, w odróżnieniu od `energy` kampanii które jest twardo capped) — user widział 15
  wobec dziennego limitu 2-4. Do ustalenia: capować bank (jak kampania, tracisz nadmiar) czy
  zmienić TYLKO wyświetlanie (bank rośnie dalej, ale bez mylącego "X/Y")?
- "Mieliśmy obniżyć trochę podczas walki pupila i bossa" — niejasne CO obniżyć (pozycję
  sprite'ów niżej na ekranie — jak w §73a? trudność/obrażenia? coś innego?). Zapytać wprost.

## 🆕 Usunięty martwy OCR paragonów (kamera) — wymaga NOWEGO BUILDU APK (2026-09-12)

User potwierdził: OCR (Google Vision, kamera) był całkowicie odłączony (zero wywołań),
zawodny, płatny i crashujący — usunięty kompletnie. Pełny opis w ARCHITECTURE.md §81.

Usunięte: `ocrService.ts`, `expo-camera`+`expo-image-picker` (npm), `Expense.receiptImageUrl`,
`android.permission.CAMERA`+`READ_MEDIA_IMAGES` z `app.json`. Aktywny flow "Wklej paragon"
(`app/expenses/scan.tsx` + `receiptParser.ts`) — ZERO zmian, dalej działa jak działał.

`tsc`/`jest` zielone (72 suit/940 testów, bez zmian w liczbie).

**⚠️ WYMAGA NOWEGO BUILDU APK** (nie OTA) żeby usunięcie permissionów faktycznie zadziałało
na telefonie — patrz CLAUDE.md zasada #2. Do tego czasu apka ma je zadeklarowane ale
nieużywane (nieszkodliwe). Priorytet testu PO builda: apka nie prosi już o dostęp do
aparatu/galerii przy starcie.

## 🆕 Globalna wyszukiwarka podpięta + lokalne statystyki użycia — NIEsprawdzone (2026-09-12)

User: *"Wyszukiwanie ogarnij na ten moment... Pixel tylko w apce nigdzie nie wysyłać tego
chce zupełnie obieg zamknięty ogarniaj teraz to"*. Pełny opis w ARCHITECTURE.md §80.

1. `app/search.tsx` był już w pełni zbudowany (z wcześniejszego refaktoru dashboardu), ale
   BEZ żadnego przycisku do niego — martwy dead-end. Naprawione: ikona lupy w nagłówku
   dashboardu → `/search`. Zero zmian w samym ekranie search.
2. Nowy lokalny, zamknięty-obiegowy licznik otwarć ekranów (`usageStatsStore.ts` +
   `screenStats.ts`) — jedno miejsce zapisu w `app/_layout.tsx`, widoczny w Ustawienia →
   "Statystyki apki". Zero sieci, dane jadą tylko przez istniejący eksport JSON jeśli user
   zechce je podesłać.

`tsc`/`jest` zielone (72 suit/940 testów, +6 nowych). **NIE zweryfikowane wizualnie na
urządzeniu.**

**⚠️ OTWARTE PYTANIE do usera (NIE zgadywane, patrz ARCHITECTURE §80)**: user napisał
"tamto skanowanie paragonów nieużywane jest martwe do usunięcia kompletnie albo przebudowa
pod to później" przy okazji odkładania kodów kreskowych — niejasne czy chodzi o CAŁY
istniejący OCR-skan paragonów (`app/expenses/scan.tsx`, `ocrService.ts` — wygląda na
aktywnie używaną, rozbudowaną funkcję wg historii ARCHITECTURE.md) czy o coś węższego.
NIE ruszone — zbyt destrukcyjne żeby zgadywać. Dopytać zanim cokolwiek się tam usunie.

**Priorytet testu na urządzeniu**: patrz checklist w ARCHITECTURE.md §80.

## 🆕 Eksport wydatków do CSV (Ustawienia) — NIEsprawdzone (2026-09-12)

User: *"eksport wydatkow spoko możemy dodac w ustawieniach"*. Pełny opis w
ARCHITECTURE.md §79.

Nowy przycisk "Eksportuj wydatki (CSV)" w Ustawienia → Kopia zapasowa, obok istniejącego
eksportu JSON (inny cel: JSON = techniczny backup, CSV = czytelna tabela do Excela/Sheets).

`tsc`/`jest` zielone (71 suit/934 testy, +5 nowych). **NIE zweryfikowane wizualnie na
urządzeniu** — priorytet: czy plik faktycznie otwiera się poprawnie (polskie znaki, kwoty)
w Google Sheets i Excelu.

**Odłożone (NIE zaczęte), z tej samej rozmowy**:
- Globalne wyszukiwanie PO DANYCH (transakcje/notatki/zadania) — user zapytał, czy to nie
  to samo co wyszukiwarka w Ustawieniach; NIE jest to samo (ta w Ustawieniach szuka tylko
  opcji ustawień), ale prawdziwe globalne wyszukiwanie to osobna, nowa funkcja.
- Natywny widget na ekran główny — user zapytał o koszt energii/lagi; wyjaśnione (osobny
  proces, nie laguje apki, ale kosztuje baterię + duża złożoność natywna), odłożone.

## 🆕 Praca: jeden stonowany żółty akcent + usunięty widget "Kto zjadł słodycze" — NIEsprawdzone (2026-09-12)

User: *"3. Te kolory w zakladce praca mi sie jednak nie podobają... dajmy jakiś soft
pasujacy kolor np żółty ale stonowany... bo zolty wybrałem w ustawieniach bo jdsport ma
żółte barwy [z] moja praca [logo] 4. wywalamy widget kto zjadl slodycze z zakładki
dashbordu"*. Pełny opis w ARCHITECTURE.md §78.

1. Trzy-kolorowy schemat Pracy (niebieski/zielony/złoty, dodany 2026-08-28 na WYRAŹNĄ
   prośbę usera) COFNIĘTY — teraz jeden stonowany musztardowy żółty (`#D8B45C`) wszędzie.
2. Widget "Kto zjadł słodycze" usunięty z dashboardu w pełni (sekcja + dane + testy).
   **UWAGA**: mechanizm "kto jadł" (`eaters`) w PARAGONACH zostaje — NIE usunięty, bo
   napędza też przełącznik mine/wszyscy i limity na tagi. User zakładał że to już
   usunięte — nieprawda, wyjaśnione w ARCHITECTURE §78, świadomie nie tknięte bez
   dopytania (destrukcyjne, szerszy zakres niż prośba).

`tsc`/`jest` zielone (70 suit/929 testów — ubytek to tylko usunięty test widgetu, zero
regresji). **NIE zweryfikowane wizualnie na urządzeniu** — priorytet: czy nowy żółty
faktycznie wygląda "spójnie" a nie "monotonnie" w panelu Pracy.

**Priorytet testu na urządzeniu**: patrz checklist w ARCHITECTURE.md §78.

## ✅ Finanse: wyszukiwarka tagu + przebudowa "Na co idą pieniądze" (fvOverride) — potwierdzone OK (2026-09-23: "nie ma szału i dupy nie urywa ale git")

User: *"1. tag własny (wyszukiwarka) w filtrach Finansów 2. widget Na co idą pieniądze —
koncept spoko, wykonanie [słabe]... stałe/zmienne wzgledem średniej NA GŁÓWNYM TLE, pod nim
wykresy stałych/zmiennych/jedzenia OSOBNO KLIKALNE z pokazaniem co i kiedy się liczy, żebym
mógł kliknąć że coś się źle liczy, żeby się uczyło"*. Pełny opis w ARCHITECTURE.md §77.

1. Finanse → Filtry → Tag: nowe pole tekstowe (substring, case-insensitive) NAD chipami top-12
   — łapie tagi spoza top 12, nie tylko dokładne dopasowania.
2. Widget dashboardu przebudowany: wiersze hero teraz 2-liniowe (kwota + `śr. X zł` + delta
   %) i KLIKALNE; 3 osobne mini-wykresy trendu (Stałe/Zmienne/Jedzenie) zastąpiły jeden
   wspólny stackowany; kliknięcie OTWIERA `FvBreakdownModal` — pełna lista transakcji tego
   miesiąca w danym kuble, KAŻDĄ da się przeklasyfikować (nowe pole `Expense.fvOverride`,
   trwałe, ma pierwszeństwo przed heurystyką kategorii — to jest "uczenie się", NIE ML).

`tsc`/`jest` zielone (71 suit/940 testów, +6 nowych). **NIE zweryfikowane wizualnie na
urządzeniu** — priorytet #1, zwłaszcza czy 2-liniowe wiersze hero + 3 mini-wykresy w rzędzie
mieszczą się czytelnie na wąskim telefonie.

**Priorytet testu na urządzeniu**: patrz checklist w ARCHITECTURE.md §77 (4 punkty: substring
search w filtrach, czytelność nowego layoutu widgetu, poprawność modala rozbicia, i że
przeklasyfikowanie transakcji faktycznie przelicza widget + zapamiętuje się między sesjami).

## 🆕 Grafika Skrzynki dnia (DAILY_BOX_ICON) + globalny fix BoxRevealModal — NIEsprawdzone (2026-09-11)

User: *"wrzuciłem ci tam jeszcze daily skrzynkę, a dawaj dalej wszystko"* — dostarczony
`assets/chests/chest_daily.png` przeskalowany 1536×1024→300×200 (jak reszta chest PNG-ów).
Pełny opis w ARCHITECTURE.md §76.

Skrzynka dnia dostała własną grafikę (`DAILY_BOX_ICON`, przypięta do `DAILY_BOX.icon` w
`petBoxes.ts`). Przy okazji naprawiony szerszy bug: `BoxRevealModal` (faza `closed`, ekran
przed kliknięciem "Otwórz") NIGDY nie pokazywał żadnej z 5 grafik skrzynek, zawsze samo emoji
— nowy prop `boxIcon` to naprawia dla WSZYSTKICH skrzynek (4×Rynek + dnia), nie tylko nowej.

`tsc`/`jest` zielone (71 suit/934 testy, bez nowych — czysto wizualne). **NIE zweryfikowane
wizualnie na urządzeniu.**

**Priorytet testu na urządzeniu**: Otwórz Skrzynkę dnia z /pet ORAZ jedną skrzynkę z Rynku →
w obu, faza "zamknięta" (przed "Otwórz") powinna pokazywać prawdziwy obrazek skrzynki, nie 🎁
ani inne emoji.

## 🆕 Skrzynki Rynku: usunięty kolor/startup/zamrożenie z dropów — NIEsprawdzone (2026-09-11)

User: *"ze skrzynek na rynku wywalmy zamrożenie serii oraz kolory i startupy, zostaje sam
ekwipunek do dropnięcia oraz te ulepszenia ogólne"*. Pełny opis w ARCHITECTURE.md §74.

`rollBox()`/`LOOT_BOXES`/`DAILY_BOX` (jedyne dwa miejsca korzystające z tej puli — NIE
`openCrate()`/`menaceClaim()`, te mają zupełnie inną, niezależną pulę) tracą kolor/startup/
zamrożenie z dropów. `gearChance` każdej skrzynki podniesiona o dokładnie tyle ile zabierały —
identyczna CAŁKOWITA szansa "coś wypadło" co przed zmianą.

`tsc`/`jest` zielone (71 suit/934 testy). NIE zweryfikowane wizualnie na urządzeniu.

**DRUGA połowa tej samej prośby — ZROBIONA teraz (2026-09-11)**: nowa animacja otwierania
skrzynki, styl reel jak w case-openingach (wybrany z 2 opcji usera bez dopytywania — "sam
zdecyduj"). Pełny opis w ARCHITECTURE.md §75. `BoxRevealModal.tsx`: nowa faza `spinning` —
przycisk "Otwórz" → pasek ~40 ikon przelatuje i zwalnia, zatrzymując się DOKŁADNIE na
już-wylosowanej (przez `rollBox()`, przed animacją) nagrodzie pod wskaźnikiem na środku. Stary
`shake` (trzęsienie skrzynki) usunięty, zastąpiony reelem. Faza `revealed` (karta+burst+
cząstki) bez zmian.

`tsc`/`jest` zielone (71 suit/934 testy — bez nowych, brak pokrycia komponentowego jak reszta
warstwy animacji). **NIE zweryfikowane wizualnie na urządzeniu** — priorytet #1.

**Priorytet testu na urządzeniu**: Otwórz kilka skrzynek (różne tiery) na Rynku i skrzynkę
dnia z /pet → sprawdź że NIGDY nie wypada kolor/startup/zamrożenie; sprawdź że reel płynnie
zwalnia i zatrzymuje się pod wskaźnikiem na TEJ SAMEJ ikonie, którą dostajesz na karcie zaraz
po nim (reel jej nie zmienia, tylko celebruje).

## 🆕 5 mniejszych poprawek (walka/Rynek/Pupil/Sklep) — NIEsprawdzone/częściowo NIEzweryfikowane wizualnie (2026-09-11)

User zgłosił naraz kilka rzeczy ze screenshotami. Pełny opis w ARCHITECTURE.md §73:
1. Arena walki: pupil/boss przesunięci niżej (`SPRITE_GROUND_SHIFT`) + mocniejszy cień pod
   nimi (`GroundShadow` opacity 0.4→0.5).
2. Rynek: `boardBg` (tablica, pod potkami) ujednolicony kolorem z `boardBgBottomFill` (lada).
3. Rynek: 4 itemy Sklepu dnia pokazują teraz cenę NA slocie, przed kliknięciem.
4. Pupil → Umiejętności bossów: opisy mają teraz DOKŁADNĄ, aktualną wartość (%) zależną od
   poziomu (`combatItemStatText`), nie generyczny opis.
5. Sklep: naprawiony ucięty tytuł itemu w podglądzie (`title2` dostał `lineHeight: 22`) —
   Android czasem maluje pogrubiony tekst wyżej niż jego box, więc pasek rzadkości pod spodem
   ucinał dół liter.

`tsc`/`jest` zielone (71 suit/938 testów, +5 nowych). Punkty 1/2/3/5 NIE zweryfikowane
wizualnie na urządzeniu (środowisko bez podglądu RN) — priorytet #1 do sprawdzenia.

**Odłożone, jeszcze niezrobione z tej samej serii próśb usera** (kolejność jak podał):
- Rynek/skrzynki: wywalić z puli dropów zamrożenie serii + kolory + startupy, zostawić SAM
  ekwipunek + ulepszenia ogólne; nowa animacja otwierania (rozpad skrzynki jak w Boom Beach/
  Clash-style chestach, LUB "przelatujące itemy zatrzymujące się na jednym" jak w CS-case
  + przycisk "otwórz"). To NAJWIĘKSZY, osobny kawałek roboty — jeszcze nie zaczęty.
- Duże pytanie (nr 3/7 w oryginalnej numeracji usera, ale okazało się TYM SAMYM co punkt 5
  powyżej — connected/rozwiązane razem, patrz §73e) — jeśli po fixie user pokaże, że to jednak
  COŚ INNEGO, wróć tu.

**Priorytet testu na urządzeniu**: patrz ARCHITECTURE.md §73, sekcja "Priorytet testu".

## 🆕 Panel "Praca" na dashboardzie — spójne karty, skrócona lista wypłat — NIEsprawdzone/NIEzweryfikowane wizualnie (2026-09-11)

User (3 screenshoty): *"dawaj upieksz te zakladek pracy bo teraz zobacz taka zbyt niejasna
nie?? i nie dopasowana"*. Pełny opis w ARCHITECTURE.md §72.

Panel narósł przez wiele sesji do sterty niespójnych stylów kart + pełnej listy wypłat 1:1
dublującej `/work/history`. Ujednolicone pod jeden wrapper `s.wpCard`/`s.wpCardLabel`, pełna
lista wypłat ścięta do "ostatnia + łącznie" (reszta = przycisk do `/work/history`).

`tsc`/`jest` zielone (71 suit/933 testy, bez nowych — czysto wizualny refaktor).
**WAŻNE: nie zweryfikowane wizualnie na urządzeniu** (środowisko bez podglądu RN) — tylko
przez czytanie kodu/JSX. Priorytet #1 do sprawdzenia na telefonie.

**Priorytet testu na urządzeniu**: Otwórz panel Praca z dashboardu → oceń czy faktycznie
wygląda spójniej/jaśniej niż wcześniej (to była subiektywna ocena usera, więc to on ostatecznie
weryfikuje czy trafiło) → sprawdź przycisk "Pełna historia i mini-kalendarz" na dole.

## 🆕 Edycja pozycji paragonu — podpowiedzi tagów po nazwie ("makaron" → tag "makaron") — NIEsprawdzone (2026-09-10)

User (screenshot, edycja "Makaron bez glutenu" w `[id].tsx`): *"jak mam w nazwie makaron to
niech poleca taki tag... jak zna podobne produkty czy uczył sie na targach [paragonach]"*.
Pełny opis w ARCHITECTURE.md §71.

Ten ekran zapisywał tagi do pamięci, ale nigdy jej nie czytał przy edycji — zawsze płaska
lista. Teraz: znany tag, którego SŁOWO pojawia się w nazwie (lub które trafia w
`applyTagMemory` na całą nazwę), wyskakuje na początek listy z przerywaną zieloną ramką —
tylko podpowiada, nie ustawia automatycznie (to edycja już otagowanej pozycji).

`tsc`/`jest` zielone (71 suit/933 testy, +7 nowych).

**Priorytet testu na urządzeniu**: Wydatki → otwórz istniejący paragon z pozycjami → edytuj
nazwę pozycji tak, żeby zawierała słowo będące znanym tagiem → sprawdź że ten tag wyskakuje na
początek z zieloną przerywaną ramką (nie zaznacza się sam).

## 🆕 Dashboard: usunięty sleep-chart + rozbudowa "Na co idą pieniądze" + skarbonki w Pracy — NIEsprawdzone (2026-09-10)

User: *"wywalić z dashboardu śr.sen ten co ma tydzień/miesiąc... rozbudowanego widgetu który
pokazywał dane miesięcy porównania wydatków stałych (odchylen) jedzenia, i zmiennych...co
przeważyło np zakup wiatraka (z odniesieniem)... w pracy dodać widget jak zarabiam na ten
moment... skarbonki ile na mieszkanie+prąd+internet, a ile na jedzenie, a ile śr. na zmienne"*.
Pełny opis w ARCHITECTURE.md §70.

- Usunięty `sleep-chart` (sekcja + `SleepChartCard.tsx`, w całości) z dashboardu — sen zostaje
  wyłącznie w zakładce Zdrowie.
- "Na co idą pieniądze" (`FixedVariableSection.tsx`) rozbudowany o `fixedDeviations()`
  (odchylenia rachunków stałych vs własna historia) i `topVariableContributors()` ("co
  przeważyło" zmienne).
- Nowy widget "skarbonek" w panelu Pracy (`workPanel` modal, `index.tsx`) —
  `workBudgetProgress()` rozdziela zarobek do-teraz waterfallem na stałe → jedzenie → zmienne.

`tsc`/`jest` zielone (71 suit/926 testów, +9 nowych w `fixedVariable.test.ts`).

**Priorytet testu na urządzeniu**: (1) dashboard → sekcji "Sen" już nie ma, ani w edytorze
dashboardu; (2) jeśli masz stały rachunek wyraźnie wyższy niż zwykle (np. Prąd) — powinna się
pojawić linia odchylenia w "Na co idą pieniądze"; jeśli zmienne > zwykłej średniej — linia "co
przeważyło"; (3) panel Pracy → 3 paski skarbonek wypełniają się sensownie względem zarobku do
teraz (suma wypełnień ≤ zarobek, nie 3×).

## 📌 Potki: pozwolić na 2 naraz, 3. wymaga anulowania (albo auto-anuluje najstarszą) — ODŁOŻONE (2026-09-10)

User: *"na później zapisz ogarnąć żeby można było mieć 2 eliksiry na raz i jak chcesz 3 kupić
to możesz ale anulować musisz jakiś albo anuluje się pierwszy kupiony"*. NIE zaimplementowane
teraz — świadomie odłożone na przyszłą sesję, tylko zapisane żeby nie zgubić.

**Stan obecny** (`petStore.ts`'s `buyPotion`, linia ~1002): `activePotion: ActivePotion | null`
— JEDEN slot na cały pupil. Kupienie nowej potki (`POTIONS.hp`/`atk`/`xp`, `src/utils/potions.ts`)
CICHO PODMIENIA poprzednią, bez potwierdzenia i bez zwrotu monet za niewykorzystany czas
(komentarz w kodzie to już dziś jawnie stwierdza — user chce to zmienić).

**Do zrobienia, w skrócie**: `activePotion` → `activePotions: ActivePotion[]` (limit 2).
Kupno 1./2. potki — po prostu dokłada do listy (jeśli innego `kind` niż już aktywne — czy
DUPLIKAT tego samego `kind` ma się liczyć jako "2 naraz" czy nadpisywać swój odpowiednik, do
ustalenia z userem przy realizacji). Kupno 3. — user musi ręcznie anulować jedną AKTYWNĄ
(nowy UI wyboru) LUB auto-anuluje się najstarsza (`endsAt`/czas zakupu najwcześniejszy) — user
podał OBIE opcje jako akceptowalne, dopytać przy realizacji którą wybiera jako domyślną.

**Miejsca do dotknięcia** (nie kompletna lista, do zweryfikowania przy realizacji):
`isPotionActive`/`potionFlatHp`/`potionAtkBonus`/`potionXpMult` (potions.ts, dziś biorą
pojedynczy `ActivePotion | null`), `effectiveCatMaxHp`/`xpWithPotion` (petStore.ts, call sites
`s.activePotion`), `syncPotionExpiry` (dziś zeruje jedno pole, musi filtrować listę), UI w
`pet-shop.tsx`/`pet.tsx`/`boss-fight.tsx` (badge odliczania na slocie potki — dziś zakłada
JEDNĄ aktywną).

## 🆕 Check-in humoru — tagi po energii, nie tylko nastroju — NIEsprawdzone (2026-09-10)

User: "te tagi ulepszyć na bazie tego też ile mam energii lub połączenia że jestem szczęśliwy
ale nie wyspany". Pełny opis w ARCHITECTURE.md §69. Nowy `src/utils/moodTags.ts` — sortowanie
podpowiedzi tagów w check-inie teraz łączy DWIE niezależne osie (nastrój + energia)
addytywnie, zamiast patrzeć wyłącznie na nastrój. Nowy tag `niewyspany`. `zmęczony` wyleciał z
`NEGATIVE_TAGS` (to stan energii, nie nastroju — zostawienie w obu zerowało jego trafność
dokładnie w kombinacji "szczęśliwy ale zmęczony").

`tsc`/`jest` zielone (71 suit/918 testów, +9 nowych).

**Priorytet testu na urządzeniu**: Check-in humoru → Nastrój=Świetnie, Energia=Wyczerpany →
sprawdź że "szczęśliwy" I "zmęczony"/"niewyspany" oba są blisko góry listy tagów.

## 🆕 Code-review runda (PR #163–#177) — dwa bugi naprawione — NIEsprawdzone (2026-09-10)

User poprosił o rundę sprawdzenia błędów w całej pracy z sesji. Znalezione i naprawione:
(1) `app/expenses/manual.tsx` — niedotknięta domyślna kategoria ('groceries') zapisywała się
do wspólnej pamięci produktów tak samo jak świadomy wybór, zanieczyszczając przyszłe
auto-podpowiedzi (skan + ręczne); (2) `settings.tsx`/`workService.ts` — wyścig przy pierwszej
migracji pracodawców, świeżo zmigrowany pracodawca renderował się bez odznaki "AKTYWNA" do
czasu ponownego wejścia na ekran. Pełny opis w ARCHITECTURE.md §68.

`tsc`/`jest` zielone (70 suit/909 testów).

**Priorytet testu na urządzeniu**: (1) dodaj ręcznie NOWY produkt bez dotykania kategorii,
zapisz, wpisz tę samą nazwę ponownie — nie powinna wskoczyć fałszywa kategoria; (2) świeża
Praca (jeden zmigrowany pracodawca) — Ustawienia → Praca pokazuje "AKTYWNA" od razu.

## 🆕 Praca front 2: ekran "Historia pracy" — NIEsprawdzone (2026-09-10)

User: "historia ostatnich miesięcy z wypłatami i średnia gdzie mogę kliknąć na każdy miesiąc
sprawdzić szczegóły i czy dobrze złapało dni jak pracowałem taki mini kalendarz". Pełny opis w
ARCHITECTURE.md §67. Nowy `app/work/history.tsx` — hero (średnia zarobków/mies. + stawka +
suma), filtr pracodawców, lista miesięcy klikalna → modal ze `MiniCalendar` (dni z dopasowaną
zmianą podświetlone + godziny) i listą zmian (tap → edycja w kalendarzu). Linki z Ustawienia →
Praca i z panelu "Praca" na dashboardzie. Czysto widok — zero nowej logiki liczenia, buduje na
§66 (`computePayMonthsForEmployers`).

**To zamyka przebudowę Pracy z obu frontów** (fundament + ekran) — kolejne prośby o tę
zakładkę to już finetuning/UI-polish, nie nowa architektura.

`tsc`/`jest` zielone (70 suit/909 testów, +2 nowe dla `shiftsForEmployerInMonth`).

**Priorytet testu na urządzeniu**: Ustawienia → Praca → "Historia pracy" i dashboard → panel
"Praca" → link na dole — oba wejścia; kliknij miesiąc → sprawdź czy mini-kalendarz zgadza się
z realnym grafikiem; z >1 pracodawcą sprawdź filtr chipsów i "pokaż schowanych".

## 🆕 Praca front 1: fundament "Pracodawcy" — NIEsprawdzone (2026-09-10)

User: "praca zakładkę bym od nowa zbudował... żeby dało się zmienić prefiks i działał jak
zmienię pracę" + "wyłączyć stare żeby były ale widzieć tylko z nowej pracy". Pełny opis w
ARCHITECTURE.md §66. TA runda to fundament danych: nowy `Employer` (types/index.ts) — pełna
lista prac, każda ze swoim prefiksem/stawką, jedna "aktywna" (zwierciadlona do `WorkSettings`,
zero zmian w 19 plikach które go czytają). `Employer.hidden` filtruje z łącznych statystyk bez
kasowania. Migracja z istniejącego `WorkSettings` jednorazowa, idempotentna. Ustawienia → Praca
ma teraz listę pracodawców (dodaj/aktywuj/schowaj) nad istniejącymi polami.

**Następny front**: nowy ekran "Praca" (widgety średniej/stawki, historia miesięcy klikalna,
mini-kalendarz dni roboczych per miesiąc) — osobny ekran spod dashboardu/ustawień, NIE nowa
zakładka w pasku. NIE zaczęte.

`tsc`/`jest` zielone (70 suit/907 testów, +2 nowe).

**Priorytet testu na urządzeniu**: Ustawienia → Praca → dodaj drugiego pracodawcę z innym
prefiksem → sprawdź że aktywuje się sam i dashboard/bank zaczynają liczyć nowy prefiks;
schowanie starego (oko) nie kasuje danych.

## ✅ Rynek — finalna scena zablokowana, edytor wyłączony, ciemniejsza lada — NIEsprawdzone (2026-09-10)

User wkleił finalny eksport z edytora sceny + poprosił o usunięcie triggera edytora z UI
(kod zostaje, "na wszelki") i ciemniejszy kolor wypełnienia POD LADĄ konkretnie (tablica
zostaje jaśniejsza). Pełny opis w ARCHITECTURE.md §65.

`tsc`/`jest` zielone (70 suit/905 testów).

**Priorytet testu na urządzeniu**: Rynek → brak ikony edytora w headerze, scena zgodna z
finalnym układem, lada wyraźnie ciemniejsza niż tablica.

## 🆕 Ustawienia runda 1 + rok w DatePickerField — NIEsprawdzone (2026-09-09)

User: "chaotyczne... w ustawieniach bym też uklarował, eksport danych mamy w kilku miejscach"
+ "przy dacie urodzenia nie mam roku, muszę przeklinać milion razy". Pełny opis w
ARCHITECTURE.md §64. Naprawione: (1) duplikat `id: 'personalizacja'` (dwie różne sekcje!),
(2) kolizja nazwy "Eksportuj" między prawdziwym eksportem danych a raportem pupila w
Diagnostyce (przemianowany), (3) Budżet/Limity na tagi przeniesione obok Saldo/Wypłata (klaster
finansowy razem, nie rozbity Powiadomieniami), (4) `DatePickerField` (19 miejsc użycia w apce) —
nagłówek tappable → siatka lat, koniec z przeklikiwaniem miesięcy o dekady.

**Następny front (osobno, user: "musimy ogarniać to po kolei")**: zakładka Praca —
przebudowa "jak w banku", z obsługą zmiany pracodawcy/prefiksu. NIE zaczęte.

`tsc`/`jest` zielone (70 suit/905 testów).

**Priorytet testu na urządzeniu**: Ustawienia → sprawdź kolejność sekcji i że "Dane osobowe"/
"Personalizacja" są wyraźnie rozdzielone; dowolna data (np. urodzenia) → tapnij nagłówek
miesiąca → wybierz rok z siatki.

## ✅ Rynek — wypełnienia brązowe/itemy jako niezależne warstwy edytora — NIEsprawdzone (2026-09-09)

User: "daj mi opcje ustawienia tez indywidualnie tych wypełnień brązowych bo zjebałeś znowu,
i itemow tez możesz". Pełny opis w ARCHITECTURE.md §63. `s.boardBg` dzieliło transform z
obrazkiem tablicy/lady — dostrojenie jednego psuło drugie. Naprawione: `boardBgTop`/
`boardBgBottom`/`items` to teraz osobne grupy w edytorze sceny (ikona ⚙️ w headerze Rynku),
domyślne wartości = identyczny wygląd jak przed zmianą.

`tsc`/`jest` zielone (70 suit/905 testów).

**Priorytet testu na urządzeniu**: Rynek → edytor sceny → trzy nowe pozycje — sprawdź że
wypełnienie/itemy dają się kręcić NIEZALEŻNIE od obrazka bez rozjeżdżania reszty.

## 🆕 `useShallow` w Pupilu/Rynku/Walce — mniej zbędnych re-renderów — NIEsprawdzone (2026-09-09)

Pełny opis w ARCHITECTURE.md §62. `boss-fight.tsx`/`pet.tsx`/`pet-shop.tsx` woływały
`usePetStore()` bez selektora — każda zmiana w tym wspólnym, dużym store (questy/ekwipunek/
streaki/walka razem) re-renderowała cały ciężki komponent, nie tylko na zmiany faktycznie
użytych pól. Naprawione przez `useShallow` z jawnie wymienionymi polami per plik.

`tsc`/`jest` zielone (70 suit/905 testów, bez zmiany logiki — czysta optymalizacja renderów).

**Priorytet testu na urządzeniu**: kilka rund walki z bossem pod rząd — mniej szarpania/lagów;
sprawdź że WSZYSTKO działa identycznie (customizacja, sklep, ekwipunek, misje) — zero zmiany
w danych/logice, tylko re-render.

## 🆕 Pomiar rozmiaru zapisywanych blobów (Diagnostyka) — NIEsprawdzone (2026-09-09)

User wybrał bezpieczny wariant zamiast ryzykownej migracji na partycje per rok (`foodStore` nie
ma kopii w Firestore — błąd w migracji mógłby namieszać w historii jedzenia bez auto-odzysku).
Pełny opis w ARCHITECTURE.md §61. Dodane: `throttledStorage.ts` mierzy bajty + czas stringify
per store, w pamięci (zero nowego zapisu na dysk), widoczne w Ustawienia → Diagnostyka →
"Rozmiar zapisywanych danych". **Do zrobienia**: poużywać apkę kilka dni, sprawdzić panel —
jeśli `expenses-store-v1`/`food-store-v1` faktycznie rosną do rozmiaru z odczuwalnym stringify
(dziesiątki ms), wrócić do tematu partycjonowania z konkretnymi liczbami; jeśli nie, zamknąć
temat jako niepotrzebny.

`tsc`/`jest` zielone (70 suit/905 testów, +3 nowe).

## 🆕 `expo-image` w Rynku/Pupilu/Walce — cache grafik — NIEsprawdzone, WYMAGA nowego builda APK (2026-09-09)

User: "dawaj dalej optymalizacje" → wybrał oba zaproponowane kandydaty. Pełny opis w
ARCHITECTURE.md §60. RN core `Image` (`pet-shop.tsx`/`pet.tsx`/`boss-fight.tsx` — ekrany
z najwięcej nowej grafiki w tej sesji) nie miał cache dysk+pamięć na Androidzie. Podmienione
na `expo-image` (`~3.0.11`) — drop-in, `resizeMode`→`contentFit`. Jeden RN `Image` (alias
`RNImage`) zostaje w `pet-shop.tsx` tylko po `resolveAssetSource` (statyczna metoda, brak
odpowiednika w `expo-image`).

**WAŻNE**: to natywny moduł — zero efektu przez OTA, działa dopiero po nowym buildzie APK.

`tsc`/`jest` zielone (70 suit/902 testy). **Priorytet testu na urządzeniu (po nowym APK)**:
Rynek/Pupil/Walka — płynniejsze pierwsze wejście, zero regresji proporcji obrazków.

## 🆕 Ręczny paragon: autouzupełnianie znanych produktów z historii — NIEsprawdzone (2026-09-09)

User: "produkty które już istnieją jak wpisuje żeby się pokazywały szybciej bo od razu tag
cena i wgle wskoczy". Pełny opis w ARCHITECTURE.md §59. `productMemory.ts` miał od dawna
3 magazyny (kategoria/tagi/cena per produkt), zapisywane/czytane TYLKO przez zeskanowany
paragon (`scan.tsx`) — ręczny (`manual.tsx`) nigdy z nich nie korzystał. Podpięte: wpisując
znaną nazwę, kategoria/tagi/cena wskakują same (zielony chip "Rozpoznano: ..."), bez
nadpisywania pól które user już ręcznie dotknął. Zamknięta pętla: ręczne paragony TERAZ też
uczą tę samą pamięć na zapisie (dotąd uczył tylko skan).

`tsc`/`jest` zielone (70 suit/902 testy — bez nowych, brak pokrycia UI-ekranów jak reszta apki).

**Priorytet testu na urządzeniu**: Wydatki → dodaj ręcznie → wpisz nazwę produktu już
kiedyś kupionego (zeskanowanego lub wcześniej wpisanego ręcznie) → kategoria/tagi/cena
powinny wskoczyć same; nowy produkt bez historii dalej dostaje starą, statyczną podpowiedź
kategorii (tap-to-apply, bez zmian).

## 🆕 throttledStorage: JSON.stringify przeniesiony do debounce'a (wszystkie 19 store'ów) — NIEsprawdzone (2026-09-09)

User dał zielone światło na punkt 1 z listy "co byś jeszcze zoptymalizował" (§55). Pełny opis
w ARCHITECTURE.md §58. `throttledAsyncStorage` throttlował TYLKO zapis na dysk —
`JSON.stringify` całego persystowanego stanu leciał SYNCHRONICZNIE na każdym `set()`, bo
`createJSONStorage()` stringifyuje przed naszym `setItem`. Naprawione: `throttledStorage.ts`
implementuje teraz `PersistStorage<S>` bezpośrednio (bez `createJSONStorage`), stringify
przeniesiony DO ŚRODKA debounced timera — seria szybkich `set()` kosztuje jeden stringify,
nie jeden na wywołanie, i leci off głównej interakcji usera. Wszystkie 19 store'ów
zmigrowane jednolicie na `throttledPersistStorage()`; stary `throttledAsyncStorage` usunięty.

Świadomie NIE ruszony koszt REHYDRACJI (parsowanie całego blobu przy starcie apki) — osobny,
dużo rzadszy koszt; prawdziwa naprawa TEJ połowy to dalej "duży redesign warstwy danych" z
§15, nie coś na przy okazji.

`tsc`/`jest` zielone (70 suit/902 testów, `throttledStorage.test.ts` przepisany pod nowy
interfejs). **Priorytet testu na urządzeniu**: walka z bossem (kilka szybkich zmian HP/coinów)
i szybkie dodawanie/edycja kilku wydatków pod rząd — brak zauważalnego zacinania UI, żadne
dane nie giną.

## ✅ Rynek: własne grafiki 4 skrzynek zamiast emoji — NIEsprawdzone (2026-09-09)

User dostarczył `assets/chests/skrzynka_{drewniana,zelazna,zlota,boska}.png` (uploadowane
bezpośrednio na master) — "dodaj je do rynku naszego". Pełny opis w ARCHITECTURE.md §57.
Downscale 1536×1024→300×200 (ten sam wzorzec co ekwipunek), podpięte przez nowe `LootBox.icon`
+ `BOX_ICON` w `petBoxes.ts`, `pet-shop.tsx`'s dolny rząd lady renderuje `<Image>` z
fallbackiem na stary `emoji` (dla `BoxRevealModal`/`DAILY_BOX`, świadomie nieruszonych — user
prosił konkretnie o Rynek).

`tsc`/`jest` zielone (70 suit/900 testów — czysto wizualna zmiana).

**Priorytet testu na urządzeniu**: Rynek → dolny rząd lady → 4 skrzynki mają własne grafiki,
czytelne na `boardBg`. **User zapowiedział**: analogiczne grafiki pod POTKI (górne sloty
tablicy) w przygotowaniu — osobne zadanie gdy dostarczy.

## 🆕 Duplikat wydatku z powtórzonego powiadomienia banku — postTime dedup — NIEsprawdzone (2026-09-09)

User: zdublowana płatność za internet (P4/Play, -60 zł) — wczoraj i dziś, ta sama. Pełny opis
w ARCHITECTURE.md §56. Root cause: Android `onListenerConnected` (reconnect po np. OEM
battery-saver) potrafi dostarczyć TĘ SAMĄ, wciąż-niewidoczną w zasobniku notyfikację ponownie
dni później — dotychczasowy dedup (natywny per-plik + `enqueue`'s 3-minutowe okno w kolejce)
oba zawodzą, bo oryginał jest już dawno zaakceptowany i usunięty z `pending`. Naprawa: trwały,
międzysesyjny dedup po `pkg:postTime` (`bankQueueStore.seenNotifications`) — Kotlin już zbierał
`postTime`, tylko JS strona go ignorowała. **Zmiana WYŁĄCZNIE JS — nie wymaga nowego builda
APK**, wchodzi zwykłą aktualizacją.

`tsc`/`jest` zielone (70 suit/902 testy, +5 nowych w `bankNotificationDedup.test.ts`).

**Priorytet obserwacji**: nie da się tego łatwo wymusić ręcznie (zależy od realnego reconnectu
Androida, OEM battery-saver itp.) — obserwuj czy duplikat się powtórzy. Jeśli tak mimo tej
naprawy, to inny wektor duplikacji niż zdiagnozowany (np. dwa RÓŻNE bank-app powiadomienia o
tej samej transakcji z różnym `postTime` — do zbadania osobno, jeśli się pojawi).

## 🆕 Dashboard perf runda 2 — `<StatTile>` wydzielony i zmemoizowany — NIEsprawdzone (2026-09-08)

User: "teraz musimy zająć się optymalizacją". Kontynuacja poprzedniego wpisu (1Hz-timer, PR
#163) — audyt z tamtej rundy wskazał custom stat tiles jako drugi/trzeci co do wielkości
hotspot, świadomie wtedy odłożony. Pełny opis w ARCHITECTURE.md §55.

`renderStatTile` (~430 linii, każdy kafelek do 8 pełnych skanów historii wydatków) wydzielony
do `src/components/dashboard/StatTile.tsx`, owinięty w `React.memo` — teraz odpala się TYLKO
gdy realnie zmienił się kafelek/statCtx/motyw, nie na każdym renderze dashboardu. Świadomie NIE
zmemoizowano całego bloku `nodes` (~1040 linii) ręcznym `useMemo` — bez działającego
`eslint-plugin-react-hooks` w tym repo (sprawdzone, brak configu) ręczna tablica zależności do
bloku tej wielkości to realne ryzyko cichego "stale closure" bez możliwości zweryfikowania bez
urządzenia. `React.memo` na wydzielonym komponencie jest bezpieczniejszy (React porównuje
propsy sam) i to sprawdzony wzorzec już użyty gdzie indziej w tym pliku.

`tsc`/`jest` zielone (69 suit/895 testów, +4 nowe w `dashboardFormat.test.ts` — `fmtStat`/
`fmtWave`/`unitChip`/`periodCaption` wcześniej miały ZERO pokrycia mimo używania w każdym
custom stat tile).

**Priorytet testu na urządzeniu**: (a) dashboard z kilkoma custom stat tiles skonfigurowanymi
(zwłaszcza pixels/wave/compare) — każdy typ ma wyglądać identycznie jak przed zmianą, zero
zmian w logice, czysta ekstrakcja; (b) strzałki zmiany roku na kafelku pixels dalej działają;
(c) ogólne odczucie płynności dashboardu z kilkoma kafelkami skonfigurowanymi. **Jeśli lag
wróci mimo tego**: kolejny krok to albo naprawa `eslint-plugin-react-hooks` w repo (osobny,
niezwiązany problem — `npx eslint` w ogóle nie znajduje configu), żeby dało się bezpiecznie
memoizować resztę `nodes`, albo wydzielenie kolejnych pojedynczych sekcji tym samym wzorcem co
`<StatTile>`.

## ✅ Rynek: sloty skrzynek wyżej + naprawa wystającego tła + mocniejszy cień itemów — NIEsprawdzone (2026-09-08)

User przesłał kolejny zrzut ekranu po §46-49, trzy uwagi naraz. Pełny opis w ARCHITECTURE.md
§54.
1. **4 dolne sloty (skrzynki)** podniesione o 1.2% wysokości (`RYNEK_BOTTOM_SLOTS[4..7].top`
   72.04→70.84, ~4-5px przy typowej szerokości telefonu) — te współrzędne były jawnie
   oznaczone jako ekstrapolacja czekająca na test.
2. **`s.boardBg` (brązowe tło pod tablicą/ladą) NAPRAWIONE STRUKTURALNIE** — był renderowany
   jako sibling transformowanej warstwy obrazka, więc ignorował `scale`/`x`/`y` z
   `DEFAULT_ADJUST` (0.5/0.46!) i wystawał daleko poza faktyczną grafikę (stąd "wystaje u
   góry" ORAZ "zakrywa sklepikarza u dołu" jednocześnie z "nie pokrywa kafelków"). Przeniesiony
   do środka tej samej transformowanej warstwy co `<Image>` — teraz zawsze dokładnie pokrywa
   się z narysowaną tablicą/ladą.
3. **Cień + kontrast**: `boardBg` kolor rozjaśniony (`#2A1B0EF0`→`#4A3420F0`), wszystkie
   `RadialGlow` 0.4→0.55, i dodany BRAKUJĄCY `RadialGlow` na 4 itemach Sklepu dnia (jedyne
   sloty bez żadnego cienia w ogóle — stąd "słabo widać" ich dotyczyło najbardziej).

`tsc`/`jest` zielone (69 suit/891 testów — czysto wizualna zmiana, bez pokrycia testowego).

**Priorytet testu na urządzeniu**: (a) 4 skrzynki na dole trafiają w narysowane okna; (b)
brązowe tło NIE wystaje ponad tablicę ani nie zasłania sklepikarza; (c) itemy Sklepu dnia mają
teraz widoczny cień i są czytelniejsze; (d) jeśli podniesienie o 4-5px okaże się za mało/za
dużo, łatwa poprawka `top` w `RYNEK_BOTTOM_SLOTS[4..7]` (`src/utils/rynekArt.ts`).

## 🆕 Streak "bez słodyczy" (stale-keyword) + dashboard 1Hz-tick lag — NIEsprawdzone (2026-09-08)

User: "w streak wgle nie łapie ze zjadłem dzisiaj nutelle i nadal mam 20 dni... I musimy
zoptymalizowac apke bo znowu laguje". Dwie recydywy, obie zbadane background-agentem PRZED
naprawą (root cause potwierdzony, nie zgadywany). Pełny opis w ARCHITECTURE.md §53.

1. **Streak-bug: prawdziwa przyczyna to NIE keyword-matching (ten jest OK od 09-06)** — to
   `Counter.keyword`/`Habit.avoidKeyword` będące jednorazową, zamrożoną KOPIĄ presetu z
   momentu utworzenia licznika/nawyku. Edycja `AVOID_PRESETS` (np. dodanie "nutella") nigdy
   nie dociera do już istniejących trackerów. Naprawa: `presetKey`/`avoidPresetKey` +
   `resolveAvoidKeyword()` rozwiązujący ŻYWY string presetu przy odczycie, plus migracja dla
   już istniejących trackerów bez presetKey (subset-heuristic — jeśli stary keyword jest
   podzbiorem aktualnego presetu, traktuj jak jego starą kopię).
2. **Dashboard lag: `useWorkEarnings.ts` tykał co sekundę BEZ gate'a na `isWorking`**,
   wymuszając pełny rerender całego 5420-liniowego `index.tsx` co sekundę, zawsze — nawet w
   tle na innej zakładce, nawet bez aktywnej zmiany w pracy. Naprawione: interval skalowany
   1s (pracujesz, jak było) / 60s (nie pracujesz). Osobno wyniesiony do `useMemo`
   `gotPaidThisMonth` (pełny skan historii wydatków liczony inline na każdym renderze).
   **NIE naprawione świadomie** (zbyt ryzykowne bez testu na urządzeniu): memoizacja całego
   ~1040-liniowego bloku `nodes` (rejestr sekcji dashboardu) i wydzielenie
   `renderStatTile`/`renderCustomTile` (~520 linii) do osobnego zmemoizowanego komponentu —
   agent-audyt wskazał to jako kolejny co do wielkości hotspot (custom stat tiles = 8 pełnych
   skanów historii wydatków × N kafelków na renderze), ale ręczna tablica zależności do bloku
   tej wielkości bez realnego testu = realne ryzyko cichego "stale closure" bug. **Zrobić w
   kolejnej sesji, z testem na urządzeniu pod ręką.**

`tsc`/`jest` zielone (69 suit/891 testów, +5 nowych w `countersStore.test.ts`).

**Priorytet testu na urządzeniu**: (a) Odliczanie → "Bez słodyczy" (jeśli jest starszy niż
09-06) → zjedz coś z Nutellą → streak powinien spaść do 0 OD RAZU, bez usuwania licznika; (b)
to samo dla nawyku "Bez słodyczy" jeśli masz taki w Nawykach; (c) zostaw Dashboard otwarty (na
innej zakładce lub w tle) kilka minut bez aktywnej zmiany w pracy → wróć, sprawdź płynność —
zwłaszcza jeśli masz skonfigurowane custom stat tiles na dashboardzie.

## 🆕 Finanse: ikony per typ rachunku + czerwony/zielony wg wydatek/przychód — NIEsprawdzone (2026-09-08)

User: "czytelniejsze ikony ze to jest za internet ze tamto jest wyplata... w finansach na
kafelkach jak sa ikonki przy nich zrobic ikonkę i kolor względem czy wydatek czy przychod
czerwony i zielony". Pełny opis w ARCHITECTURE.md §52. Dwa realne braki naprawione:
1. `BILL_TYPES` (`recurringBills.ts`) — dodane `icon` per typ rachunku (Zap/Wifi/Flame/
   Droplet/Thermometer/Shield/Phone/Home), wcześniej wszystkie dziedziczyły wspólną ikonę
   kategorii (dom).
2. `ExpenseItem.tsx` (główny wiersz listy w Finansach) — ikona rozwiązywana dynamicznie
   (rachunek > kategoria, ten sam wzorzec co reszta apki), zamiast twardego 3-drożnego
   switcha ignorującego kategorię. Kolor całego wiersza (pasek/tło ikony/glif/kwota) to teraz
   `isIncome ? colors.accent.green : colors.accent.red` — wcześniej wydatek nie miał żadnego
   koloru, tylko przychód był zielony.
3. Filtr "Rachunki" w Finansach dostał te same ikony przy chipach (wcześniej same napisy).

`tsc`/`jest` zielone (69 suit/886 testów, +1 nowy w `financePredicates.test.ts`).

**Priorytet testu na urządzeniu**: Finanse → lista transakcji → wydatek za internet/prąd/
telefon pokazuje właściwą ikonę (nie dom); wszystkie wydatki mają czerwony akcent, przychody
(zwłaszcza wypłata → teczka/Briefcase) zielony; filtr "Rachunki" pokazuje ikony przy chipach.

## 🆕 "Czasami nie łapie powiadomienia z banku" — zbadane, parser OK, przyczyna gdzie indziej — NIEsprawdzone (2026-09-08)

User: "czasami mi nie łapie z powiadomienia np tego ze wypłaty" + realny przykład (tytuł
"Wpływ", "Wpłynęło 3752,78 PLN na konto *6332 od MARKETING INVESTMENT GROUP SA. Bank Pekao
S.A."). Pełny opis w ARCHITECTURE.md §51. Napisany realny test na TĘ DOKŁADNĄ treść —
`parseBankNotification` parsuje ją poprawnie (amount/direction/store), więc to NIE bug
parsera. Dwa najbardziej prawdopodobne wyjaśnienia (żadne niezweryfikowane bez urządzenia w
danym momencie): (a) natywny nasłuch powiadomień bywa usypiany przez Androida (OEM battery
management) i gubi pojedyncze powiadomienia zanim apka je odczyta — ISTNIEJĄCA diagnostyka w
Ustawieniach ("Sprawdź teraz") to sprawdza; (b) powiadomienie MOGŁO trafić do kolejki, ale
jako "niepewne" (duży, nieznany nadawca przychodzący → wymaga ręcznego zatwierdzenia w
"Płatności do zatwierdzenia"), co łatwo pomylić z "w ogóle nie złapało".

Dodany trwały test regresyjny (`__tests__/bankNotification.test.ts`) na dokładnie ten
przypadek (tytuł "Wpływ" jako osobne pole + wieloczłonowy nadawca-spółka z kropką, "SA.").

**Priorytet, jeśli się powtórzy**: w MOMENCIE gdy user zauważy że czegoś brakuje — sprawdzić
Ustawienia → Auto-wydatki z banku → "Sprawdź teraz (diagnostyka)" (czy nasłuch cokolwiek
widział) ORAZ kolejkę "Płatności do zatwierdzenia" (czy tam czeka, tylko niepotwierdzona),
zanim założymy nowy bug parsera.

## 🆕 Trudność bossów #11+ ×2, droprate perków podbity, szablony banku rozszerzone — NIEsprawdzone (2026-09-08)

Trzy niezależne prośby w jednej wiadomości. Pełny opis w ARCHITECTURE.md §50.
1. **Bossy od Hydry Odwodnienia (order 11) do finału (order 22, Iluzja Kontroli) — `hp`
   PODWOJONE**, dosłownie ×2 (nie skalibrowane hp×√2 jak przy poprzedniej korekcie trudności)
   — user wyraźnie chciał surowe 2x tym razem. Ponieważ obrażenia kontrataku liczą się jako
   `boss.hp × COUNTER_PCT`, podwojenie hp automatycznie podwaja też dmg — jedna zmiana
   realizuje oba żądania. Realny efekt łącznego ryzyka będzie bliżej ~4x (ten sam mechanizm co
   przy poprzedniej korekcie), ale user powiedział "minimum 2x", więc to mieści się w
   żądaniu — **warto obserwować na urządzeniu, czy nie za dużo, łatwo cofnąć**.
2. **"Nie mogę dropnąć umiejętności" — zbadane, nie był to bug.** `basic` (60% wszystkich
   otwarć skrzynek) miało twarde 0% szansy na perk — łączna szansa na otwarcie wynosiła tylko
   ~2%. Podbite: `basic` 0→0.01, `rare` 0.03→0.05, `epic` 0.08→0.12, `legendary` 0.18→0.25 —
   nowa łączna szansa ≈3.7%.
3. **Szablony powiadomień banku rozszerzone** — nowy rodzaj `kind: 'income'` ("Wypłata") obok
   dotychczasowego `'expense'` (kategoria) — dopasowanie w gałęzi przychodzącej `bankIngest.ts`
   ustawia `jd`+auto-księgowanie bezwarunkowo. Dodane brakujące pole "Tagi" w formularzu (store
   je miał od początku, formularz nigdy nie pytał). Dodana edycja istniejących szablonów (tap
   na wiersz → wypełnia formularz, "Zapisz zmiany").

`tsc`/`jest` zielone (69 suit/884 testy, +6 w `bankRules.test.ts`, `crates.test.ts`
zaktualizowany).

**Priorytet testu na urządzeniu**: (a) walka z bossem #11+ wyraźnie trudniejsza — jeśli ZA
trudna, można zejść z ×2 na coś łagodniejszego; (b) kilkanaście otwarć skrzynek → perk bojowy
powinien wypaść zauważalnie częściej; (c) dodaj szablon "Wypłata" dla realnego nadawcy pensji
→ kolejny przelew powinien wpaść jako [JD] bez zatwierdzania; (d) dodaj tag "prąd" do szablonu
PGE, sprawdź w Finansach; (e) edytuj istniejący szablon, sprawdź że zmiany się zapisały.

## ✅ Rynek: finalne wartości edytora + potki czasowe + 3 poprawki po teście na urządzeniu — NIEsprawdzone (2026-09-08)

User przesłał zrzut ekranu sklepu z pięcioma prośbami naraz, potem — po realnym teście na
telefonie — trzy kolejne poprawki. Pełny opis w ARCHITECTURE.md §46-49. Aktualny stan:
1. `DEFAULT_ADJUST` w `app/pet-shop.tsx` ustawione na finalne, wyeksportowane przez usera
   wartości.
2. Pigułka "Nowy zestaw za..." POD ladą, restylowana jako drewniana tabliczka szyldu.
3. Sklepikarz: **poprawione DWA RAZY**. `RadialGlow`+`GroundShadow` (kopia z boss-fight.tsx)
   wyglądało jak "jakiś prostokąt" — `GroundShadow` (cień POD łapkami) nie ma sensu dla
   sklepikarza wystającego W POŁOWIE zza lady (brak widocznych łap/podłogi). Finalnie:
   `GroundShadow` CAŁKOWICIE USUNIĘTY, zostaje tylko `RadialGlow` (poświata, podbita
   opacity/size).
4. Tło slotów — **poprawione DWA RAZY**. Finalnie: JEDNO duże, PRAWIE NIEPRZEZROCZYSTE
   brązowe tło (`s.boardBg`, `#2A1B0EF0`) za CAŁĄ grafiką tablicy/lady (pierwsze dziecko
   `s.artPiece`) — pierwsza próba (`rgba(0,0,0,0.4)`) czytała się jako przezroczysta, nie
   jako "stałe brązowe". Dodatkowo każda ikona/emoji dostała miękki cień ZA SOBĄ
   (`<RadialGlow color="#000".../>`, nie natywny `elevation` — dałby brzydki kwadratowy
   cień na przezroczystym SVG).
5. **Potki czasowe** — nowy system: górne 4 sloty tablicy = Zamrożenie serii + 3 potki
   (HP +20 flat/24h, ATK +15%/24h, XP +25%/24h — świadomie umiarkowany balans, DO
   SKORYGOWANIA po realnym teście). Badge aktywnej potki na `/pet`. Nowy `src/utils/
   potions.ts` + `activePotion` w petStore + `effectiveCatMaxHp()` + `xpWithPotion()`
   (wpięty we WSZYSTKIE 14 miejsc przyznających XP w petStore).
6. **Dolny rząd lady — poprawiony**: miały być DOKŁADNIE 4 PŁATNE skrzynie (user: "miała być
   ta nowa, DREWNIANA, ZELAZNA, ZLOTA, BOSKA"), nie darmowa skrzynka dnia + 3 LOOT_BOXES.
   `petBoxes.ts`: dawna "silver" przemianowana na "iron"/Żelazna (te same liczby), dodany
   nowy 4. tier "divine"/Boska (koszt 450, najlepsze szanse — `gearChance` świadomie NIEjest
   najwyższa z czterech, patrz komentarz w kodzie o kaskadzie progów `rollBox()`). Nowy
   `BOX_RANK` zastąpił twarde `box.id === 'gold'`. Darmowa skrzynka dnia USUNIĘTA z Rynku
   (mechanika żyje dalej — `/pet` + wskaźnik na dashboardzie, to był zduplikowany trigger).

**Do zweryfikowania na urządzeniu, priorytetowo**: (a) dolny rząd lady (`RYNEK_BOTTOM_SLOTS[4..7]`
w `rynekArt.ts`) ma EKSTRAPOLOWANE, nie zmierzone współrzędne — LADADOL.png fizycznie ma 8 okien
(2×4), ale tylko górny rząd był kiedykolwiek zmierzony realnym skryptem. Jeśli skrzynki nie
trafiają w narysowane okna, trzeba będzie ręcznie poprawić `top` w `RYNEK_BOTTOM_SLOTS[4..7]`
(edytor sceny nie potrafi poprawić TYLKO dolnego rzędu, skaluje/przesuwa całą warstwę naraz);
(b) tło tablicy/lady faktycznie wygląda brązowo/nieprzezroczyście, nie kwadraciki; (c) cień
sklepikarza to teraz poświata, nie prostokąt; (d) dolny rząd lady pokazuje 4 skrzynie
(🪵⚙️🥇👑) w cenach 35/90/200/450.

`tsc`/`jest` zielone (69 suit/873 testy, +17 nowych w `potions.test.ts`).

## 🆕 Szablony powiadomień banku — ucz kategorię PRZED pierwszą płatnością — NIEsprawdzone (2026-09-08)

User przesłał realną obcowalutową płatność subskrypcji ("Zapłacono kwotę 22,14 EUR ... w
ANTHROPIC* CLAUDE SUB ... Bank Pekao S.A.") i poprosił o możliwość z góry zadeklarowania w
Ustawieniach, co dana płatność oznacza (subskrypcja/kategoria/nazwa) — tak samo dla PGE,
przejazdów itp. — zamiast czekać, aż pierwsza realna płatność wyląduje ze zgadniętą (często
złą) kategorią. Pełny opis w ARCHITECTURE.md §7/§45.

Nowy `src/store/bankRulesStore.ts` (lista `BankRule{pattern,name,category,tags?}`) wpięty w
`bankIngest.ts` — nieznany nadawca sprawdzany najpierw przeciw user'a szablonom, dopiero
potem przeciw sztywnemu `guessCategory()`. Ustawienia → "Auto-wydatki z banku" → nowa sekcja
"Szablony powiadomień": wklej przykład powiadomienia → live-preview (ten sam parser co "Test
odczytu") → prefill fragmentu-do-rozpoznania i nazwy → wybór kategorii → zapis, z listą i
usuwaniem zapisanych szablonów.

Obca waluta dalej wymusza ręczne wpisanie kwoty w PLN (bezpiecznik nietknięty) — szablon
zmienia TYLKO kategorię/nazwę/tagi. `tsc`/`jest` zielone (68 suit/856 testów, +7 nowych w
`bankRules.test.ts`).

**Priorytet testu na urządzeniu**: Ustawienia → Auto-wydatki z banku → Szablony powiadomień →
wklej dokładnie tę płatność Claude z EUR → kategoria Subskrypcje, nazwa "Subskrypcja Claude" →
Zapisz → wklej tę samą treść jeszcze raz w "Test odczytu powiadomień" → powinna wpaść do
kolejki z kategorią Subskrypcje bez ręcznej korekty (kwota PLN i tak trzeba wpisać ręcznie —
to osobny, celowy bezpiecznik dla kursu karty). Warto też przetestować PGE i bilet
komunikacji (transport) tym samym mechanizmem.

## 🆕 Audyt specjalistyczny: parser paragonów / kategoryzacja wydatków — NIEsprawdzone (2026-09-07)

User: "okiem specjalisty posprawdzaj po kolei rzeczy typu parser paragonów itp i powiedz czy
można coś ulepszyc / zmienic zoptymalizowac bez utraty funkcji." Pełny opis w ARCHITECTURE.md
§44. Trzy poprawki w `src/utils/receiptParser.ts`:
1. **Realny bug**: `getFoodTags()` łapało krótkie trzony jedzenia ('ser','por','tost','rum',
   'gin','karp','lays') jako czysty substring bez ochrony granic słowa — fałszywie
   kategoryzowało np. "Serwis samochodowy"/"Sport"/"Autostrada"/"PlayStation" jako spożywcze
   (dotyczy TAKŻE ręcznie wpisywanych wydatków, nie tylko OCR paragonów). Naprawione dla
   trzonów ≤4 znaki (granica z lewej strony słowa) — usuwa 26 z 29 znalezionych kolizji.
   **Znany, świadomie NIEnaprawiony kompromis**: trzon na samym POCZĄTKU słowa ("Ser-wis" vs
   "Ser-ek", "Tost-er" vs "Tost-y") jest mechanicznie nieodróżnialny bez ręcznej listy
   wyjątków — udokumentowane testami "znany, nienaprawiony przypadek" w
   `receiptParser.test.ts`, więc nikt nie "naprawi" tego przez przypadek inaczej.
2. `categorize()` fallback (gdy nic nie pasuje) zmieniony z `'groceries'` na `'other'` —
   `'other'` było strukturalnie nieosiągalne mimo że istnieje i jest używane wszędzie indziej.
3. Usunięty martwy kod (`TOTAL_RE`, nieużywany) + `parseGeneric()` teraz woła współdzielony
   `detectTotal()` zamiast duplikować słabszą (mniej tolerancyjną na OCR) kopię inline.

`tsc`/`jest` zielone (67 suit/849 testów, +10 nowych w `receiptParser.test.ts`). **Priorytet
testu na urządzeniu**: ręczne dodawanie wydatku → wpisz "Toster"/"Laser"/"Sport"/
"PlayStation"/"Autostrada" (powinny już NIE sugerować "Spożywcze"); "Serwis samochodowy"
dalej się myli (znany kompromis, patrz wyżej) — jeśli to realnie przeszkadza w codziennym
użyciu, wrócić do tego z gotowym przykładem.

## ✅ Rynek: skala grafiki przeliczała CAŁĄ scenę + dolny limit skali za wysoki + Walka: myląca pigułka energii — NIEsprawdzone (2026-09-07)

User: "jak klikam skala to skaluje mi cały page Rynku, a miało tylko grafikę każdą osobno" +
"energia bossów pokazywała mi 5/2, jakby się przeładowywała", potem dodatkowo "Dodaj mi
opcję, żebym mógł skalować obrazek poniżej 60%, bo aktualnie nie mogę na tym rynku przy
sklepikarzu". Pełny opis w ARCHITECTURE.md §42-43. Trzy rzeczy:
1. **Realny bug w edytorze sceny** — `scale` tablicy/lady/kotka ZMIENIAŁ rzeczywisty rozmiar
   zarezerwowanego boksu, który wchodzi do `sceneH` — skalowanie JEDNEJ grafiki przeliczało
   wysokość CAŁEJ sceny (tło się przeskalowywało, reszta się przesuwała). Naprawione: rozmiar
   boksów teraz STAŁY, `scale` to czysty `transform` jak x/y — zero wpływu na resztę sceny.
2. **Dolny limit suwaka skali (0.6) za wysoki dla sklepikarza** — relikt sprzed powyższej
   naprawy (kiedy mały `scale` groził spłaszczeniem realnego boksa). Naprawione: `min: 0.6` →
   `min: 0.2` w `IMG_FIELDS` (`app/pet-shop.tsx`).
3. **Pigułka energii w Walce** — pokazywała "masz/koszt" (np. "5/2") ZAWSZE gdy koszt > 1
   (raid), nie tylko gdy energii brakowało — wyglądało jak zepsuty ułamek przy pełnej puli.
   Naprawione: pigułka pokazuje samą liczbę, wyjaśnienie kosztu zostaje w istniejącym
   komunikacie pod przyciskiem WALCZ (pokazuje się TYLKO gdy realnie brakuje).

**Zbadane, nie znalezione**: user opisał 3 walki z rzędu z raid-bossem po tym "przeładowaniu"
— przejrzana cała ścieżka ataku, nie znaleziono realnej ścieżki do podwójnego wydania
energii (synchroniczne sprawdzenie, `fightingRef` blokuje ponowne wejście). Najbardziej
prawdopodobne: `eventEnergy` legalnie kumuluje się przez nieodwiedzane dni, a jedno
naciśnięcie WALCZ! to PEŁNA symulowana walka (nie jeden cios) — zgodne z projektem. Jeśli
user prześle konkretniejszy dowód (zrzut z ujemną energią itp.) w przyszłości, wrócić do tego.

`tsc`/`jest` zielone. **Priorytet testu na urządzeniu**: (a) edytor sceny — scale jednej
grafiki nie rusza reszty, da się zejść poniżej 60% aż do 20%; (b) pigułka energii w Walce
(raid) pokazuje samą liczbę.

## 🆕 Co zjadłem: Nutella nie łamała streaka "bez słodyczy" — NIEsprawdzone (2026-09-06)

User: "zaznaczam Nutella to nie resetuje streaka, nawet nie wiem czy jest tak otagowany" —
miał rację: `foodBase.ts` w ogóle nie ma pola `cat`, a nazwa "Nutella" nie zawierała żadnego
fragmentu keyworda `sweets`. Pełny opis w ARCHITECTURE.md §41. Naprawa: `nutella` dopisane do
keyworda (sprawdzone skryptem — zero fałszywych trafień w całej bazie, w tym "Masło
orzechowe" nadal NIE łapie się mimo wspólnego "orzech"). Nowy test w `countersStore.test.ts`.
`tsc`/`jest` zielone (67 suit/839 testów).

**Priorytet testu na urządzeniu**: Co zjadłem → zjedz "Nutella" z aktywnym nawykiem "bez
słodyczy" → streak powinien pęknąć.

## 🆕 Walka: winieta + poświata za sprite'ami ("high-end fight scene") — NIEsprawdzone (2026-09-06)

User ze zrzutem: "postacie są niewidoczne, arena za jasna, wygląda tanio... możemy tę grafikę
wywalić zupełnie i zrobię inną, ale żeby to dobrze leżało". Pełny opis w ARCHITECTURE.md §40.
Dwie poprawki NIEZALEŻNE od konkretnej grafiki areny (zostają po ewentualnej podmianie usera):
1. Winieta — pionowy gradient przyciemniający górę/dół sceny, środek jaśniejszy.
2. Poświata (`RadialGlow`) za kotkiem (kolor futra) i bossem (kolor "słabości") — sylwetki
   czytelniejsze niezależnie od tła.

**Jeśli/gdy user przyśle nową grafikę areny**: obecny box sceny to ok. 2.5:1 (szeroki, niski
baner) — stary `LOKACJA_KAMPANIA.png` był 1.5:1 i mocno się przycinał przez `resizeMode=
"cover"`. Nowa grafika najlepiej ok. 1600×640 albo podobne proporcje.

`tsc`/`jest` zielone. **Priorytet testu na urządzeniu**: ekran Walki — winieta widoczna,
kotek/boss mają subtelną kolorową poświatę, sylwetki czytelniejsze na tle.

## 🆕 Dwie poprawki po ostrej informacji zwrotnej: edytor draft 3 + uszy sklepikarza 1:1 — NIEsprawdzone (2026-09-06)

User: "zjebałeś?" — poprzedni wpis (edytor draft 2, sklepikarz §38) miał DWA realne błędy,
oba naprawione. Pełny opis w ARCHITECTURE.md §39.
1. **Edytor sceny** — panel był pełnoekranowym `<Modal>` (user: "klikam i nie widzę" — bo
   modal zasłaniał scenę, którą miał dostrajać), i jeden wspólny `x/y/scale` na tablicę/ladę
   poruszał RAZEM obrazek i sloty (user chciał naprawić rozjazd MIĘDZY nimi, a wspólny
   transform to uniemożliwiał). Naprawa: panel to teraz pływający pasek przyklejony do dołu
   (NIE modal, scena zostaje widoczna nad nim), a tablica/lada dostały NIEZALEŻNE warstwy —
   `top`/`bottom` (obrazek) osobno od `topSlots`/`bottomSlots` (siatka klikalnych okien).
   Klucz AsyncStorage: `rynek_art_adjust_v3`.
2. **Uszy sklepikarza** — poprzednia poprawka przeniosła kapelusz 1:1, ale zostawiła
   standardowy, w pełni widoczny `<Ear>`, dokładnie to czego user NIE chciał (miał je
   specjalnie schować pod rondem). Naprawa: `<Ear>` wyłączony dla `shopkeeper`, zastąpiony
   4 custom kształtami z przysłanego pliku (małe prześwity z obu stron, w większości
   schowane pod rondem) — współrzędne przepuszczone przez skrypt, nie ręcznie przepisane.

Zweryfikowane wizualnie OBA razy PRZED napisaniem kodu (symulacja porównana z przysłanym
plikiem), żeby nie powtórzyć błędu "wygląda inaczej niż miało". `tsc`/`jest` zielone.

**Priorytet testu na urządzeniu**: ekran Sklepu — sklepikarz z większym kapeluszem, bez wąsów,
z błyskawicą na policzku. Sam ROZMIAR/POZYCJA sklepikarza w scenie (czy "wystarczająco duży",
"siedzi za ladą") to osobna sprawa — do tego służy edytor sceny (`cat.scale`/`x`/`y`) z wpisu
niżej.

## ✅ Rynek: czarne pasy po bokach sceny naprawione (TLOSKLEPIKARZ.png przycięty) — NIEsprawdzone (2026-09-06)

User ze zrzutem po fixie z §32: "zobacz nadal [źle], musisz poprawić". Realna przyczyna
(zmierzona lokalnie, nie zgadywana) — `TLOSKLEPIKARZ.png` (tło całej sceny) miało ~12%
przezroczystego marginesu po KAŻDEJ stronie, nigdy nie przycięte jak `RYNEK_TOP`/
`RYNEK_BOTTOM`; `resizeMode="cover"` dopasowywał się do WYSOKOŚCI sceny i przycinał tylko
~15px z brzegu, zostawiając ~75px czystego czarnego marginesu po OBU stronach na realnym
ekranie — wyglądało jak niewczytane tło. Pełny opis w ARCHITECTURE.md §35. Naprawa: obrazek
przycięty do bbox alfa (+8px), zero zmian w kodzie. Zweryfikowane symulacją Pillow całego
łańcucha renderu przed/po (nie samo "powinno działać") — różnica jednoznaczna. `tsc`/`jest`
zielone.

**Priorytet testu na urządzeniu**: ekran Sklepu — scena powinna wypełniać całą szerokość
ekranu, bez czarnych pasów po bokach tablicy/luki/lady. Wygląd sklepikarza (kapelusz/wąsy)
ZROBIONY osobno (patrz wpis wyżej) — jego rozmiar/pozycja w scenie to wciąż osobna sprawa,
dostrajana edytorem sceny.

## ✅ Rynek: edytor sceny na urządzeniu (X/Y/skala PER GRAFIKA + eksport) + statyczny .svg sklepikarza — NIEsprawdzone (2026-09-06)

User: "dasz mi opcje żebym zmienił ręcznie położenie/skalę, ja dostosuję, potem przycisk
eksportuj — nie będziesz zgadywał; a sklepikarza sam zrobię, tylko daj mi plik svg", potem po
zobaczeniu draftu 1: "daj mi to modyfikowane dla każdej grafiki osobno i jasne instrukcje typu
położenie XYZ, skalowanie itp i tyle". Pełny opis w ARCHITECTURE.md §36-37. Dwie rzeczy:
1. **Edytor sceny** — ikona suwaków w headerze Sklepu (`app/pet-shop.tsx`) otwiera panel z 4
   grupami (Tło / Tablica / Sklepikarz / Lada), KAŻDA z jednolitym zestawem 3 pól: pozycja X,
   pozycja Y (px), skala (% — 100% = dzisiejszy domyślny rozmiar/pozycja tej JEDNEJ grafiki).
   Wartości (`rynek_art_adjust_v2`) persystują w AsyncStorage. Przycisk "Eksportuj" pokazuje
   JSON do skopiowania i przysłania mi w czacie — wpiszę te wartości na sztywno jako nowe
   domyślne (i mogę wtedy usunąć sam edytor albo zostawić na przyszłość).
2. **Statyczny `.svg` sklepikarza** wysłany userowi osobno (nie w repo — plik roboczy do
   edycji zewnętrznej) — CatArt.tsx to programistyczny komponent, nie gotowy plik, więc to
   wierny STATYCZNY zrzut spoczynkowej pozy do edycji w Inkscape/Figmie/etc. Po zmianach user
   odsyła plik albo opis zmian, ja przenoszę na sztywno do `shopkeeper` bloku w `CatArt.tsx`.

`tsc`/`jest` zielone (67 suit/837 testów). **Priorytet testu na urządzeniu**: ikona suwaków w
Sklepie → panel się otwiera, 4 sekcje po 3 pola → zmiana X/Y/skali JEDNEJ grafiki nie rusza
pozostałych w dziwny sposób → "Eksportuj" daje poprawny JSON → wartości przetrwają zamknięcie
ekranu. Docelowo: user dostraja suwakami aż scena wygląda dobrze, wysyła mi wyeksportowany
JSON, ja hardkoduję i (opcjonalnie) usuwam edytor.

## 🆕 Ciekawostki: masowy dolew treści, 152 → 237 → 310 → 369 wpisów — NIEsprawdzone (2026-09-06)

User: "żeby tych ciekawostek było mnóstwo", potem "dawaj więcej ciekawostek", potem "ogarnij
więcej ciekawostek LEPSZYCH" — trzy dolewy z rzędu (§30: +85, §31: +73, §34: +59), każdy
nowy wpis od razu z pełnym `detail` (rozwinięciem), czwarta runda celowo z naciskiem na
jakość/rzadszy kąt tematu, nie tylko liczbę. Pełny opis w ARCHITECTURE.md §30-31, §34. Zero
duplikatów w całym pliku (zweryfikowane skryptem po każdym dolewie), rozwój bez odwołań do
konkretnych książek (żeby nie wrócić do usuniętej w §28 kategorii "z książki"). `tsc`/`jest`
zielone. Finalnie **369 wpisów** (138 nauka / 109 rozwój / 122 świat).

**Jeśli user przyśle listę konkretnych faktów uznanych za błędne/przestarzałe/nudne** — to
osobna sprawa od "To znam" (które już automatycznie wyklucza z rotacji): poprawić/usunąć
wskazane wpisy w `trivia.ts` i zanotować tu wzorzec błędu (żeby nie powtórzyć go w kolejnych
partiach). **Priorytet testu na urządzeniu**: kilka dni z rzędu na dashboardzie — nowe fakty
powinny naturalnie wchodzić do rotacji, każdy z działającym rozwinięciem po tapnięciu.

## ✅ Rynek: odchudzenie z instruktażowych podpisów — NIEsprawdzone (2026-09-06)

User: "wypierdol te napisy wszystkie... i wgle przebuduj żeby było dobrze tak samo
zamrożenie". Pełny opis w ARCHITECTURE.md §33. Usunięte całkowicie: etykiety "Skrzynki"/
"Sklep dnia" + oba instruktażowe akapity opisu (info o skrzynkach dalej w ConfirmDialog przy
zakupie, o Sklepie dnia w GearPreviewModal po tapnięciu — nic nie zniknęło funkcjonalnie).
Licznik odświeżenia + komunikat pustego stanu ZOSTAŁY, ale jako małe pigułki nad ladą zamiast
zdań tekstu. Karta "Zamrożenie serii" straciła instruktażowy podpis + dostała subtelny lodowy
gradient w tle. Zero martwych stylów. `tsc`/`jest` zielone.

**Priorytet testu na urządzeniu**: ekran Sklepu — czyściej bez tekstu na scenie, pigułka
licznika czytelna nad ladą, karta zamrożenia wygląda dopracowanie, wszystkie interakcje
(zakup skrzynki, podgląd itemu, kupno zamrożenia) działają jak wcześniej.

**Zgłoszone przez usera, czeka w kolejce** (jego słowa: "potem ja będę testował a ty ogarnij
więcej ciekawostek lepszych i wgle rozbuduj resztę i wgle potem możesz optymalizować, nie
przestawaj robić") — po tym PR-cie: (1) więcej/lepsze ciekawostki (kontynuacja §30-31), (2)
"rozbuduj resztę" — bez konkretów, do sprecyzowania albo do rozsądnej własnej inicjatywy po
przejrzeniu reszty tego pliku, (3) runda optymalizacji na końcu. Sklepikarz (większy, za
ladą, poprawione wąsy/czapka) osobno — czeka aż user da znać że gotowy.

## ✅ Rynek: grafiki wychodziły poza ekran — fix na piksele zamiast aspectRatio — NIEsprawdzone (2026-09-06)

User ze zrzutem: "grafiki wychodzą poza ekran, wyśrodkuj, zmniejsz do wielkości ekranu,
dopasuj względem slotów". Realny bug widoczny tylko na urządzeniu (kod na pierwszy rzut oka
wyglądał poprawnie) — `aspectRatio`+`width:'100%'` na dziecku `gap`-kontenera (`s.scene`,
dodany w §27) to kruchy przypadek w Yodze, który na części urządzeń dawał zawyżoną szerokość.
Pełny opis w ARCHITECTURE.md §32. Naprawa: `s.artPiece` liczy szerokość/wysokość WPROST z
`Dimensions.get('window').width`, bez żadnego `aspectRatio`. Sloty (`pctStyle`) NIE wymagały
osobnej poprawki — były poprawne względem kontenera, tylko kontener miał złą szerokość.
`tsc`/`jest` zielone.

**Priorytet testu na urządzeniu (KRYTYCZNY — jedyny sposób weryfikacji)**: ekran Sklepu —
tablica i lada powinny mieścić się CAŁKOWICIE w szerokości ekranu, wyśrodkowane, bez
wystawania poza krawędzie, a sloty powinny nachodzić dokładnie na okienka narysowane na
grafice.

**Zgłoszone, czeka na osobne zlecenie** (user: "tego sklepikarza ogarniemy zaraz") —
sklepikarz ma być większy, ma faktycznie "siedzieć za ladą" (dziś stoi w luce między tablicą
a ladą, nie za kontuarem), wąsy i czapka wymagają poprawy rysunku.


## ✅ Assety Rynku odchudzone — TLOSKLEPIKARZ.png 16-bit→8-bit (2026-09-06)

User zobaczył zrzut ekranu Rynku (sklepikarz+kontrast już działają, PR #141) i spytał "poprawiłeś
mi te zdjęcia, żeby nie były takie duże". Pełny opis w ARCHITECTURE.md §29 — skrót:
`TLOSKLEPIKARZ.png` zostało przez przeoczenie w 16-bit kolorze (PNG nigdy tego realnie nie
potrzebuje), przekonwertowane na 8-bit: **1076 KB → 418 KB** (61% mniej, zero zmiany w
wyglądzie, zweryfikowane wizualnie). `LADAGORA.png`/`LADADOL.png` dostały tylko drobną
domiarkę (już były 8-bit z §26). Czysto binarna zmiana plików, `tsc` zielony. **Priorytet
testu na urządzeniu**: tło sceny Sklepu powinno wyglądać identycznie jak wcześniej.

## 🆕 Ciekawostka dnia: bez kategorii "z książki", rozwijalny opis + źródło — NIEsprawdzone (2026-09-06)

User: "rozbuduj ciekawostki widget... więcej ciekawostek (z książek fragmenty są useless,
wywalamy je) i jak kliknę w ciekawostkę to rozwija mi ją więcej jest ładnie opisane i jest
źródło na dole podane". Pełny opis w ARCHITECTURE.md §28. Skrót: kategoria `ksiazka` (69
wpisów) skasowana całkowicie; każdy z 152 pozostałych wpisów (`src/data/trivia.ts`) dostał
nowe, wymagane pole `detail` (1-3 zdania rozwinięcia, czasem z realnym źródłem) — tap na
ciekawostkę w `TriviaCard` teraz rozwija ją, pokazując `detail` i dopiero pod nim `src` (jeśli
jest). Dodano też netto kilka nowych faktów w każdej kategorii. Mechanizm "To znam"/nie-
powtarzania (dismissed/counts) NIETKNIĘTY. `tsc`/`jest` zielone (67 suit/837 testów).

**Priorytet testu na urządzeniu**: dashboard → "Ciekawostka dnia" → tap na tekst rozwija
(dłuższy opis + czasem źródło na dole), drugi tap zwija; żadna ciekawostka nie ma już etykiety
„Z książki"; "To znam" dalej działa jak wcześniej; nowa ciekawostka zawsze startuje zwinięta
(nie pamięta rozwinięcia z poprzedniego dnia).

## 🆕 Pasek misji: kwadratowy, przygotowany pod przyszłą tematyczną grafikę — NIEsprawdzone (2026-09-05)

User: "pasek ładowania questa zróbmy tematyczny... każdy quest będzie miał osobną grafikę tła
pod walkę i wtedy część to będzie wypełniało pasek ładujący się jakby że z czarnego przechodzi
w tę grafikę, na razie przygotujmy pasek, zróbmy go kwadratowym". Pełny opis w
ARCHITECTURE.md §27 (punkt 4). Zrobione TERAZ tylko to o co user prosił wprost:
`missionBarTrack`/`missionBarFillWrap` w `app/pet.tsx` — pigułka (`borderRadius =
MISSION_BAR_HEIGHT/2`) → kwadratowy (`radius.sm`). Wypełnienie (niebieski gradient+fala)
NIETKNIĘTE — podmiana na "ciemność→grafika lokacji" czeka na realne pliki per quest (jeszcze
nie istnieją), ten sam wzorzec przygotowania co `arenaBgFor(kind)` w bossIcons.ts.
`tsc`/`jest` zielone (67 suit/837 testów). **Priorytet testu na urządzeniu**: pasek misji w
trakcie (kotek w drodze) — teraz kwadratowy zamiast pigułki, countdown/fala/wypełnienie
działają identycznie jak wcześniej.

## 🆕 Sklep (Rynek): kontrast slotów, gradient rzadkości, sklepikarz w scenie — NIEsprawdzone (2026-09-05)

Follow-up na poprzedni wpis (prawdziwa grafika Rynku, ARCHITECTURE.md §26) — user zobaczył
realny zrzut ekranu i dorzucił: "Sloty muszą mieć... ciemniejsze TŁO żeby zwiększyć kontrast
itemów", "co to jest za SKLEPIK... gdzie sklepikarz", i osobno "rzadkość itemów to niech
będzie kolor gradientu za nimi + gradientowo kolorowy schludny pod nazwę itemu". Pełny opis
w ARCHITECTURE.md §27. Trzy fixy:
1. Ciemny kontrastowy podkład (`artSlotBg`) pod ikoną w KAŻDYM z 8 slotów (skrzynka dnia, 3
   skrzynki, 4 itemy Sklepu dnia) — okno na grafice samo w sobie przezroczyste, ikony ledwo
   było widać na busy tle.
2. Sklep dnia (4 itemy) dostał `LinearGradient` (ciemny róg → kolor rzadkości) ZAMIAST płaskiego
   tła — łączy kontrast z sygnałem rzadkości. `GearPreviewModal` dostał cienką gradientową
   kreskę pod nazwą itemu (ten sam kolor rzadkości).
3. **Sklepikarz nareszcie stoi w scenie** — `shopkeeper` prop na `CatArt` istniał od
   2026-09-03 (§20), ale czekał na sam ekran Rynku i NIGDY nie został faktycznie wstawiony
   nawet po tym jak ekran powstał (§26) — czysty dead-end złapany przez usera, nie nowy
   request. Teraz `<CatArt shopkeeper palette={SHOPKEEPER_PALETTE}>` stoi wyśrodkowany w
   widocznej luce między tablicą a ladą.
4. **Scena odklejała się od tła przy scrollu** (user, patrząc na PR #140 zanim ten PR
   zdążył dojechać: "grafiki wstawione nie na miejscu... rusza się a miało być statyczne
   jakby ze sobą") — realny bug od PR #140, tło było przypięte do EKRANU podczas gdy
   tablica/lada scrollowały w środku ScrollView, więc przy przewijaniu rozjeżdżały się od
   tła. Naprawione: `RYNEK_BG` teraz wewnątrz nowego `s.scene` wrappera razem z tablicą/
   kotkiem/ladą — scrolluje jako jedna sztywna całość, zawsze w rejestracji.

`tsc`/`jest` zielone (67 suit/837 testów, zero zmian w testach — czysto wizualne).
**Priorytet testu na urządzeniu**: Sklep → sloty czytelniejsze na busy tle? Sklep dnia ma
kolorowy gradient zależny od rzadkości wylosowanego itemu? Popup po tapnięciu ma kolorową
kreskę pod nazwą? Sklepikarz widoczny między tablicą a ladą, rozgląda się (nie statyczny),
NIE reaguje na tapnięcie? **Najważniejsze**: przewiń ekran w górę/dół — tablica/sklepikarz/
lada powinny przewijać się RAZEM z tłem jako jedna scena, nie osobno od siebie.

Wciąż otwarte z poprzedniego wpisu: dolny rząd 8-okiennej lady (Sklep dnia ma tylko 4
pozycje) pokazuje tło przez otwór — poszerzenie do 8 itemów to zmiana ekonomii, czeka na
Twoje "tak, rób".

## 🆕 Pupil: większe sloty ekwipunku, zbita siatka staty, powiększony pasek Lv — NIEsprawdzone (2026-09-04)

User: "I te sloty na ekwipunku pupila jeszcze powiększyć trochę bo teraz itemy nadal sa
trochę malo widoczne plus zbić bardziej te statystyki i wydłużyć i powiększyć lvl zeby byl
czytelniejszy i bardziej widoczny kosztem nawet wywalenia tego paska głaskania z serduszkiem".
Pełny opis w ARCHITECTURE.md §25. Sloty ekwipunku 50→62px (drugie powiększenie), siatka "Siła
bojowa" zbita (mniejsze karty/fonty/ikony), pasek głaskania z sercem USUNIĘTY z headera
(mechanika działa dalej, zniknął tylko widoczny pasek), miejsce poszło na większy/szerszy
pasek Lv. `tsc`/`jest` zielone (67 suit/837 testów, czyste UI, zero zmian w testach).
**Priorytet testu na urządzeniu**: ekran Pupil → itemy w slotach wyraźnie widoczne? Pasek Lv
czytelny i nie ucieka poza header obok imienia na wąskim telefonie? Siatka staty mieści się
bez dziwnego zawijania? Tapnięcie kotka nadal daje reakcję głaskania mimo braku paska?

## 🆕 Baza jedzenia: ~65 nowych produktów + naprawa dziur w wykrywaniu słodyczy — NIEsprawdzone (2026-09-04)

User: "dodaj więcej o wiele produktow z kaloriami realnym, i dodatkowo zeby zaliczamy sie do
słodyczy jak coś jest słodyczem". Dwie rzeczy, pełny opis w ARCHITECTURE.md §24:
1. ~65 nowych produktów w `foodBase.ts` — mięso surowe, więcej ryb, strączki/tofu, owoce
   suszone, orzechy/nasiona, napoje, kasze śniadaniowe, dania obiadowe, fast food.
2. **Naprawiona realna dziura**: krówki, ptasie mleczko, sernik, brownie, gofry, delicje,
   michałki, kremówka, eklerka, faworki i kilkanaście innych klasycznych słodyczy w ogóle
   NIE łapało się jako "słodycze" w streaku "bez słodyczy" — czysty przeoczony gap w
   `AVOID_PRESETS.sweets` (countersStore.ts), teraz naprawiony i pokryty testami.

`tsc`/`jest` zielone (67 suit/837 testów). **Priorytet testu na urządzeniu**: (a) wyszukaj w
Co zjadłem kilka nowych produktów — sensowne kalorie; (b) zjedz "Krówki" mając aktywny nawyk
"bez słodyczy" — streak powinien pęknąć (wcześniej nie pękał).

## ✅ Black screen w "Co zjadłem" — TERAZ NAPRAWIONY (2026-09-04)

To samo zgłoszenie co "Grey screen w Co zjadłem" niżej (2026-08-31) wróciło: "jak dodałem
ciastka wczorajsze ze zjadłem na testa to znowu mam black screena, z dzisiejszymi nie ma
problemu z wczorajszymi jest". Tym razem znaleziona i naprawiona REALNA przyczyna (Explore-
agent + ręczna weryfikacja): `purchasedCatForName()` (`src/utils/food.ts`) sortowała CAŁĄ
historię wydatków przy każdym wywołaniu, a `app/food/product.tsx` wołało ją z `useEffect`
zależnego od tekstu w polu nazwy — czyli PRZY KAŻDYM ZNAKU wpisywanym przy tworzeniu nowego
produktu. Nie chodziło o datę posiłku (stąd myląca korelacja usera) — chodziło o to, czy
"ciastka" było już ZNANYM produktem (bailuje szybko) czy tworzone od zera (kosztowny path).
Naprawa: `buildPurchasedCatIndex()` sortuje RAZ (memoized per `expenses`), lookup potem to
O(1) `Map.get`. Pełny opis w ARCHITECTURE.md §23. `tsc`/`jest` zielone (67 suit/823 testy,
nowy test w `food.test.ts`). **Priorytet testu na urządzeniu**: Co zjadłem → Produkty →
wpisz CAŁKOWICIE nową nazwę produktu — pisanie płynne, zero laga, nawet z długą historią
paragonów. Stary wpis "Grey screen..." niżej zostaje jako historia (opisywał TĘ SAMĄ ścieżkę
repro, ale bez znalezienia przyczyny wtedy).

## 🆕 Quest rowerowy → self-report + sekcja "Trening" na górze Zadań — NIEsprawdzone (2026-09-03)

User: "rower... dziwnie łapie bo zawsze nawet jak nie robię to zawsze jest do odebrania
zaliczone" — przyczyna: JEDYNY z 6 questów treningowych oparty o czujnik (Health Connect
ExerciseSession), a telefon/zegarek czasem myli jazdę samochodem/szybki spacer z rowerem
(nie da się tego odfiltrować po naszej stronie, HC nie ma confidence score). **Naprawa**:
rower przerobiony na self-report jak pozostała piątka (`TrainingSessionModal`, timer na
`bikeTarget` min) — nowy `petStore.bikeDay`/`markBikeDone()`, `QuestCtx.bikeToday` zamiast
`bikeMinutesToday`. Do tego: nagrody questów treningowych **2× w górę** (4/10→8/20 itd, rower
5/13→10/26 — user: "musi byc zachęta by to robić") + nowa sekcja **"Trening" na samej górze**
`app/pet-quests.tsx` (przed nawet zaległymi/codziennymi), pomarańczowy akcent + plakietka
EKSTRA + ikona per ćwiczenie (lucide, placeholder — user później doda grafiki) + pigułka
nagrody pokazuje teraz też XP. Skalowanie z poziomem pupila — już istniało dla wszystkich
questów (`questRewardMult`), świadomie nie dodana druga krzywa tylko dla treningu.

Pełny opis w ARCHITECTURE.md §22. `tsc`/`jest` zielone (67 suit/822 testy). **Priorytet
testu na urządzeniu**: (a) sekcja "Trening" faktycznie na samej górze ekranu Zadań; (b) rower
NIE zalicza się sam — wymaga przejścia przez "Rozpocznij"→timer→potwierdzenie; (c) nagrody w
pigułce (monety+XP) zgadzają się z tym co faktycznie dopisuje "Odbierz"; (d) `bikeDay`
persystuje między sesjami tego samego dnia.

## 🆕 Walka bossów: HP pod portretem, cień, większy kotek — NIEsprawdzone (2026-09-03)

User pokazał zrzut ekranu areny: "zdrowie musi byc pod spodem I musimy jakoś wyróżnić
cieniem te bossy i kotka (oraz kotka powiększyć bo jest teraz mniejszy od wroga znacznie)".
`app/boss-fight.tsx` — pełny opis w ARCHITECTURE.md §21. Skrót: portret teraz NAD etykietą+
paskiem HP (było odwrotnie); nowy `GroundShadow` (miękki elipsowy cień, SVG radial-gradient)
pod stopami obu sprite'ów; kotek dostał `CAT_PORTRAIT_SIZE=175` (boss zostaje 130) — SVG
kotka ma spory pusty margines w viewBox, więc przy identycznym `size` zawsze wyglądał
mniejszy niż ciasno przycięte PNG bossów. `tsc`/`jest` zielone. **Priorytet testu na
urządzeniu**: (a) HP czytelne pod portretem; (b) cień widoczny, "przyklejony" do sprite'a,
nie oderwany; (c) kotek zauważalnie większy ale NIE ucięty przez zaokrągloną scenę areny na
węższych telefonach — jedyne realne ryzyko tej zmiany, niezmierzone na prawdziwym ekranie;
(d) lecący pocisk/łapka dalej trafia w środek portretu.

## 🆕 "Sklepikarz" (CatArt w przebraniu) — czeka na ekran Rynku — NIEsprawdzone (2026-09-03)

Część 2 (część 1 = foldery, patrz wpis niżej). User: kotek za ladą, wąsy-inkognito +
kapelusik z uszami wystającymi na wierzchu, bez lizania/reakcji-na-głaskanie, ale z
rozglądaniem (żeby nie był statyczny), inny kolor niż kotek gracza. **Zrobione**: nowy prop
`shopkeeper?: boolean` na `CatArt` (wąsy+kapelusz rysowane w SVG, uszy automatycznie na
wierzchu bo to już osobny późniejszy layer; wyłącza auto-lick i tap/cuddle-reakcje; NIE
rusza breathe/blink/glance/ear-flutter) + `SHOPKEEPER_PALETTE` w `catPalettes.ts` (poza
kupowalną listą, stały ciepły tan). **Draft 2 (2026-09-03)** — user zobaczył zrzut: "uszy
mają wystawać ale naturalnie i wąsy podkreślone bardziej" → wąsy z cienkiego blobu na
grube łuki z zawiniętymi końcówkami, korona kapelusza zwężona (odsłania OBA ucha
symetrycznie, wcześniej prawe ledwo było widać) + cień-fałda u podstawy każdego ucha.
Geometria samych uszu nietknięta. Pełny opis w ARCHITECTURE.md §20. `tsc`/`jest` zielone.

**Nie zrobione / czeka**: sam ekran Rynku (2 warstwy grafiki + sklepikarz między nimi +
sloty na skrzynki/freeze/itemy dnia) — user obiecał przysłać grafikę tła/rynku, dopiero
wtedy komponować `<CatArt shopkeeper palette={SHOPKEEPER_PALETTE}>` na realnym ekranie.
**Priorytet testu na urządzeniu**: na razie brak — `shopkeeper` prop nigdzie jeszcze nie
jest użyty w żadnym ekranie, więc zero widocznej zmiany dopóki nie powstanie ekran Rynku.

## ✅ Foldery bossów/lokalizacji posegregowane jak ekwipunek (2026-09-02)

User zapowiedział nową grafikę Rynku (2 warstwy + sklepikarz) i poprosił o dwie rzeczy: (1)
posegregować foldery — ZROBIONE (patrz ARCHITECTURE.md §19): `assets/ikonybosów/` (mieszanka
43 plików) + `assets/minibosses/` → `assets/bossy/{kampania,questy,eventy-rajdy,umiejetnosci}/`
+ `assets/lokalizacje/`, wszystkie `require()` w `bossIcons.ts` zaktualizowane, czysty przenos
bez zmiany czegokolwiek widocznego. (2) Zaprojektować "sklepikarza" — patrz wpis wyżej,
ZROBIONE. `tsc`/`jest` zielone (67 suit/822 testy). **Priorytet testu na urządzeniu**: dowolna
walka z dowolnym bossem — wszystko powinno wyglądać identycznie jak wcześniej (czysty przenos
plików).

## 🆕 Startupy → PetCustomizeModal + przygotowanie teł areny per typ — NIEsprawdzone (2026-09-02)

User: "przeniosłeś z rynku pupila startupy na [modal z edycją imienia/kolorów]?" → "tak ogarnij
to" + (mid-turn) "Questy będą miały oddzielne tło... eventowe osobne... MAD bossy jeszcze
inne... na razie może zostać... możesz przygotować pod to najwyżej". Dwie rzeczy:
1. **Startupy przeniesione** z `pet-shop.tsx` do `PetCustomizeModal.tsx` (nowa sekcja obok
   koloru/oczu/nosa/dodatków). Rynek stracił przełącznik zakładek (Rynek/Startupy/Posiadane →
   tylko Rynek, bez tabów — reszta i tak pokazywała startupy). `grantStartup` (nagroda ze
   skrzynki) bez zmian.
2. **Tła areny per typ walki — SAMO PRZYGOTOWANIE, bez nowej grafiki.** `arenaBgFor(kind)` +
   `ARENA_BG_BY_KIND` w `bossIcons.ts` — dziś wszystko dalej pokazuje `CAMPAIGN_ARENA_BG`
   (fallback), ale dodanie tła dla quest/event/mad w przyszłości to jedna linia w tej mapie,
   zero zmian w `boss-fight.tsx`. **Czeka na usera** — obiecał dosłać grafiki dla
   questów/eventów/MAD później, wtedy trzeba je tylko wrzucić do `assets/ikonybosów/` i
   odkomentować/dopisać wpis w `ARENA_BG_BY_KIND`.

Pełny opis w ARCHITECTURE.md §18. `tsc`/`jest` zielone (67 suit/822 testy). **Priorytet testu
na urządzeniu**: (a) `/pet` → edytuj imię → sekcja Startup na dole — kup/ustaw działa jak
wcześniej w sklepie; (b) Rynek bez zakładek, skrzynka ze startupem w nagrodzie dalej działa;
(c) walka — tło areny identyczne jak przed tą zmianą (czysto przygotowanie, nie redesign).

## ✅ Kampania optymalizacji wydajności ZAKOŃCZONA — 4 rundy, malejące zwroty (2026-09-02)

User: "nie zatrzymuj się, optymalizuj dopóki nie stwierdzisz że jest zajebiście". Runda 4:
jeden fix (`app/vehicles.tsx` — `summarizeVehicle()` bez `useMemo`, dokładnie ta sama luka co
Nastrój w rundzie 3), reszta sprawdzonych kątów (Animated/Reanimated w całej apce, lazy-loading
przez expo-router, sync z Firestore w tle, konfiguracja list, powtarzające się odczyty
AsyncStorage) to same dead endy — apka jest już w tym dobrym stanie. Pełne podsumowanie
wszystkich 4 rund w ARCHITECTURE.md §17. **Mój wniosek: kampania optymalizacyjna skończona —
kolejne rundy w tym samym stylu zaczęłyby produkować teoretyczne nitpicki, nie realne,
odczuwalne problemy.** Jeśli coś konkretnego zacznie znowu lagować, wróć do tego z konkretnym
opisem (który ekran, kiedy) zamiast kolejnego ogólnego audytu.
`tsc`/`jest` zielone (67 suit/822 testy). **Priorytet testu na urządzeniu**: zakładka Pojazdy
— rozwijanie karty pojazdu powinno być płynniejsze przy dłuższej historii wydatków.

## 🆕 Optymalizacja wydajności, runda 3 — pupil w tle walki + Nastrój — NIEsprawdzone (2026-09-02)

User: "dawaj dalej" (kontynuacja poprzednich rund). Dwa fixy: (1) `app/pet.tsx` — pełne pętle
idle CatArt (oddech/mruganie/spojrzenie/uszy/liźnięcie) leciały dalej w tle PODCZAS walki
misji, bo `/pet` zostaje zamontowany pod ekranem walki (brak `freezeOnBlur`) — naprawione
przez `focused` (`useFocusEffect`) → `animate={focused}`; (2) `app/(tabs)/mood.tsx` — sześć
kart analitycznych (słowa kluczowe/wzorce/rozkład/dni tygodnia/pora dnia/kalendarz miesiąca)
liczyło pełną historię wpisów przy KAŻDYM renderze, spotęgowane przez `useMoodStore()` bez
selektora (3 zbędne re-renderi na każde `load()`) — naprawione `useMemo` + wąskie selektory.
Pełny opis w ARCHITECTURE.md §16. `tsc`/`jest` zielone (67 suit/822 testy). **Priorytet testu
na urządzeniu**: (a) misja gotowa → wejdź w walkę — kotek na Pupilu pod spodem nie powinien
animować się podczas walki; (b) zakładka Nastrój, dłuższa historia — dodaj/edytuj/usuń wpis,
pull-to-refresh — powinno czuć się responsywniej, liczby na kartach identyczne jak wcześniej.

## 🔴 ZNALEZIONE (architektoniczne, czeka na decyzję) — rosnący blob storage expenses/foodStore (2026-09-02)

Runda 2 audytu wydajności (user: "optymalizuj dalej"). Zustand `persist` re-serializuje
(`JSON.stringify`) CAŁY rosnący blob `expenses`/`meals`/`products` przy KAŻDEJ pojedynczej
mutacji (dodanie jednego wydatku/posiłku) — `throttledStorage.ts` koalescuje CZĘSTOTLIWOŚĆ
zapisów, nie ich ROZMIAR. Symetrycznie: cold-start rehydracja parsuje ten sam, rosnący blob
przy każdym starcie apki. To NIE bug, to architektura — koszt rośnie z wiekiem konta (setki
wydatków/posiłków u aktywnych userów, realnie potwierdzone w eksportach danych z tej sesji).
Pełny opis w ARCHITECTURE.md §15. **Realna naprawa to spory redesign** (archiwizacja starych
wpisów, podział na klucze/paginacja w AsyncStorage) — NIE zrobione świadomie, wymaga Twojej
decyzji czy warto (koszt/ryzyko migracji vs realny odczuwalny zysk, który rośnie dopiero po
latach użytkowania). Daj znać jeśli chcesz to ruszyć.

## 🆕 Optymalizacja wydajności, runda 2 — dashboard deferred fix — NIEsprawdzone (2026-09-02)

User: "optymalizuj dalej" (kontynuacja poprzedniej rundy). Realny fix: 7 `useMemo` na
dashboardzie (funFacts/weightFacts/correlations/insightLinks/foodBreakdown/shopsCollection/
topProducts) skanowały CAŁĄ historię `expenses` na KAŻDYM renderze mimo że ich JSX i tak było
zagatowane za `deferredReady`/`InteractionManager` (staging z 2026-08-24) — hooki Reacta lecą
zawsze, niezależnie co komponent finalnie zwraca. Naprawione: wczesny return pustego stuba
dopóki `!deferredReady`. Zero zmiany w TYM KIEDY user widzi te sekcje — usunięty tylko
marnowany CPU na pierwszej klatce. Pełny opis w ARCHITECTURE.md §15. `tsc`/`jest` zielone
(67 suit/822 testy). **Priorytet testu na urządzeniu**: otwórz dashboard po dłuższej przerwie
(zimny start) — sekcje powinny pojawić się tak samo jak wcześniej, ale sam dashboard powinien
poczuć się responsywniej na pierwszej klatce, zwłaszcza z dużą historią wydatków.

**Przy okazji sprawdzone, dead end**: nowo wgrane PNG-i bossów (wilk/osa/kraken/upior) — to
były FAŁSZYWY alarm pierwszego przebiegu audytu, już moje własne przeskalowane wersje z
poprzedniej rundy, nie ponowny upload oryginałów.

## 🆕 Connect zakupy→streak w Co zjadłem + tło areny walki — NIEsprawdzone (2026-09-02)

User: "Musimy ogarnąć lepszy connect pomiędzy CO ZJADŁEM a produktami które kupuję żeby jak
kupię drożdżówkę i ją oflaguję że to pieczywo/słodycz - to jak zaznaczę że ją zjadłem to
trzeba żeby oflagowało to że zjadłem słodycz i tracę streak" + "Dodałem ekwipunek/zbroję oraz
ekwipunek/buty, i dodałem LOKACJA_KAMPANIA.png w bosach żebyś wrzucił jako tło do bosów".
Pełny opis w ARCHITECTURE.md §14. Trzy części:
1. **Nowa `purchasedCatForName()`** (`src/utils/food.ts`) łączy `ReceiptItem.tags` (paragony)
   z `FoodProduct.cat` (dziennik jedzenia) — dotąd dwa niepowiązane systemy mimo wspólnego
   słownika tagów. Podpięta przy tworzeniu NOWEGO produktu w `food/add.tsx`/`food/product.tsx`
   i przy backfillu w `markFreshMany` (skan paragonu) — nigdy nie nadpisuje już ustawionej
   kategorii.
2. **`AVOID_PRESETS.sweets` keyword** (`countersStore.ts`) — konkretny przykład usera
   (drożdżówka) i tak NIE łapałby się przez powyższe, bo `FOOD_TAG_MAP` celowo kategoryzuje
   słodkie wypieki jako `'pieczywo'`, nie `'słodycze'` (dla podziału finansowego). Naprawione
   po nazwie, wzorem istniejącego `'pączek'` — dopisane `drożdż|rogal|kroasan|croissant`.
3. **Tło areny walki** — `LOKACJA_KAMPANIA.png` (user wgrał bezpośrednio na `master`, razem z
   PEŁNOROZDZIELCZYMI zbroja/buty PNG-ami zastępującymi stare placeholdery — przeskalowane
   tym samym skryptem co PR optymalizacyjny, §13). Wpięte jako tło TYLKO w scenie portretów/HP
   (`boss-fight.tsx`), nie całej karty walki (zmienna wysokość niżej). Kafelki straciły
   ramki/tło — bossy/kotek stoją bezpośrednio na scenie (user: "wypierdolić ramki... hp jest
   podspodem"), etykiety dostały text-shadow pod czytelność.

`tsc`/`jest` zielone (67 suit/822 testy — nowe `food.test.ts`/`countersStore.test.ts`).
**Priorytet testu na urządzeniu**: (a) Co zjadłem → nowy produkt o nazwie = coś wcześniej
kupione+otagowane jako słodycze/przekąski → streak "Bez X" powinien złapać bez ręcznego
tagowania; (b) zeskanuj paragon z drożdżówką/rogalem/croissantem, zjedz — streak słodyczy
powinien pęknąć; (c) walka z dowolnym bossem — widoczne tło areny, kafelki bez ramek, portrety
"na scenie", HP czytelne pod spodem, pocisk dalej trafia portret (nie pasek HP nad nim).

## 🆕 Optymalizacja wydajności — audyt + 4 fixy — NIEsprawdzone (2026-09-02)

User: "jak skończysz od razu weź się za optymalizację dalszą apki" (ogólne, bez konkretnego
zgłoszenia). Statyczny audyt kodu (nie profiler na urządzeniu) znalazł i naprawił:
1. `app/notes.tsx` — `NoteCard` re-renderował się CAŁY przy każdej zmianie stanu ekranu
   (wpisywanie w search itp.), mimo że dane notatki się nie zmieniały — handlery
   przepięte na `useCallback` + `React.memo(NoteCard)` + wywołania bez inline-closures.
2. `app/food/add.tsx` — wyszukiwarka jedzenia przeliczała CAŁĄ bibliotekę produktów
   (`normalizeProductName` per produkt) na każde naciśnięcie klawisza. Rozdzielone na
   `curated` (liczy się tylko gdy zmienia się `products`) i `candidates` (per-klawisz tylko
   filtruje gotowe dane).
3. `app/(tabs)/health.tsx` — sprawdzone, ŚWIADOMIE NIE ruszone (koszt znikomy, ryzyko
   stale-closure > korzyść — pełne uzasadnienie w ARCHITECTURE.md §13).
4. **Duże PNG-i ekwipunku/bossów przeskalowane w dół** (za zgodą usera) — źródła do
   3095×3095/1,8MB wyświetlane jako miniaturki 40-130px. `assets/ekwipunek/` +
   `assets/ikonybosów/`: **17,4 MB → 4,4 MB** (Pillow/LANCZOS, alfa zachowana, sam wygląd
   BEZ zmian — tylko rozdzielczość). Ikony appki/splash celowo nietknięte (natywne, przez
   `app.json`+build, patrz ARCHITECTURE.md §11).

Pełny opis w ARCHITECTURE.md §13. `tsc`/`jest` zielone (65 suit/812 testów, bez nowych testów
— czysto wydajnościowe fixy). **Priorytet testu na urządzeniu**: (a) Notatki — wpisywanie w
wyszukiwarkę przy sporej liczbie notatek powinno być płynniejsze, funkcjonalnie bez zmian;
(b) Co zjadłem → dodaj — pisanie w polu szukania przy dużej bibliotece produktów powinno być
responsywniejsze; (c) Sklep/Ekwipunek/dowolna walka — ikony hełmów/talizmanów/bossów powinny
wyglądać IDENTYCZNIE jak wcześniej (czysty downscale) — jeśli coś rozmyte/przycięte, to
regresja do zgłoszenia.

## 🔴 ZNALEZIONE (nie naprawione, user: "zostaw, ja się wygrindnę") — realny bossLog pokazuje ścianę na "Widmo Porównań" (2026-09-01)

Analiza REALNEGO `pet-v1.bossLog` z eksportu (101 walk) — nie symulacja: **win-rate kampanii
tego usera to tylko 23%** (39 walk, 30× kotek zemdlał). Największy winowajca: boss `compare`
("Widmo Porównań", `unlockLevel: 30`, hp 1481) — user trafił na niego na poziomie **21** (9
poziomów PONIŻEJ jego `unlockLevel`) i przegrał 4/4 razy, KAŻDA walka identyczna: kontratak
stały 35 dmg/rundę (0% wariancji w 32 rundach!), kotek pada dokładnie w rundzie 8 (260 HP /
35 = 7,4), boss ledwo drapnięty (1481→~470 HP, ~32% zdjęte). To NIE przypadek — sekwencyjne
odblokowanie kampanii (2026-08-17, "bez progu poziomu... pokonaj poprzedniego") pozwala
dotrzeć do bossa zbalansowanego pod dużo wyższy poziom niż ten, na którym realnie jest gracz,
jeśli tempo levelowania (questy/misje) nie nadąża za tempem pokonywania bossów. Podobny wzorzec
widać wcześniej w logu: `dragon` (unlockLevel 9) zajął 10 prób (level 8→10), `insomnia`
(unlockLevel 26) zajęło 13 prób (level 18→19) — user dosłownie "grindował" lewelami W
TRAKCIE utykania na tych samych bossach, dokładnie problem który tu opisuję.
**User świadomie wybrał NIE naprawiać teraz** (AskUserQuestion: "Zostaw jak jest, ja się
wygrindnę" zamiast "zbalansuj krzywą" lub "dodaj ostrzeżenie przed walką nad poziomem") — ale
to POTWIERDZA na realnych danych wcześniejszą hipotezę „ŚWIADOMIE NIEROZWIĄZANE — raid
endgame" (patrz niżej w pliku) i prawdopodobnie wyjaśnia user'a wcześniejszą, niejasną skargę
o bossach kampanii które „są silniejsze, mają pancerz/kryt/dmg większy" — może nie chodzić o
żaden zepsuty tekst UI, tylko o to DOKŁADNIE zjawisko (level gracza vs `unlockLevel` bossa).
Jeśli user wróci do tego tematu: opcje z pytania to (a) przebalansować krzywą HP/regen
bossów, (b) dodać ostrzeżenie w UI przed walką z bossem znacznie powyżej poziomu gracza,
zanim wejdzie w walkę na ślepo.

## 🆕 Pupil: "Odbierz" czeka na dzisiejszy sync + karty miesięcy dostały sen/wagę — NIEsprawdzone (2026-09-01)

User: "dane w pupilu powinny czekać na załadowanie aktualnych kroków, snu itp z dnia danego bo
bez aktualizacji pobiera z wczoraj i można odebrać" + "dodałeś do tych kart więcej danych żeby
nie były takie nudne???". Dwie osobne rzeczy z tej samej wiadomości, pełny opis w
ARCHITECTURE.md:
1. **Nowy `synced` z `usePetHealthSync`** — `reload()` pokazuje cache NATYCHMIAST, dopiero
   POTEM woła prawdziwy sync z zegarka; w tej luce quest oparty o kroki/sen mógł wyglądać na
   "do odebrania" na nieświeżych danych. `app/pet-quests.tsx` blokuje teraz "Odbierz"
   (dzienne/bonusowe/tygodniowe/miesięczne) dopóki `!synced`, pokazując "Ładuję…".
2. **`avgSleepH`/`weightStartKg`/`weightEndKg`/`weightChangeKg`** dołączone do kart miesięcy —
   dane (`healthDays`) już tam były, po prostu nieużywane. Sen jako 3. hero-stat, zmiana wagi
   jako chip (próg ±0,3 kg, neutralny kolor — apka nie zna celu usera).

`tsc`/`jest` zielone (65 suit/812 testów — nowe testy w `monthCards.test.ts`; `synced` w
`usePetHealthSync`/`usePetQuests` to hooki z I/O, ten sam brak jednostkowego pokrycia co reszta
tego zestawu, spójne z istniejącym wzorcem w repo). **Priorytet testu na urządzeniu**:
(a) otwórz `/pet-quests` zaraz po starcie apki (najlepiej z zablokowanym/wolnym internetem,
żeby złapać okno przed sync'em) — przyciski "Odbierz" powinny być zablokowane z napisem
"Ładuję…" dopóki dane z zegarka się nie zsynchronizują, NIE powinno dać się kliknąć na
podstawie starych danych; (b) Kolekcja miesięcy — miesiące z danymi o śnie/wadze z zegarka
powinny pokazywać nowy hero-stat snu i/lub chip zmiany wagi.

**Wciąż otwarte, świadomie NIE ruszone w tej sesji (user: "jutro ci wyeksportuję dane moje z
pupila i zerkniemy")**: user opisał, że w walkach kampanii nadal widnieje tekst o "redukcji
obrażeń przez nawyki/sen", mimo że (jak sam zauważył) taka mechanika NIE jest realnie
podłączona — bossy są po prostu silniejsze (pancerz/kryt/większy dmg), nie ma żadnego realnego
wpływu nawyków/snu na obrażenia. Przeszukane PONOWNIE (drugi raz w tej sesji, po wcześniejszym
sprawdzeniu z 2026-08-30 — patrz niżej) `boss-fight.tsx`, `bosses.ts`, `combatItems.ts`,
`gear.ts` pod kątem "redukcj"/"nawyk"/"sen" — nic nie znalezione. User świadomie odłożył
dalsze grzebanie do jutra, kiedy dostarczy eksport danych z pupila (podobny do tego użytego w
audycie kart miesięcy) — **nie zgadywać, czekać na ten eksport / dokładniejsze wskazanie GDZIE
w UI ten tekst faktycznie widać** (przyda się zrzut ekranu z konkretnym miejscem, nie tylko
surowe dane).

## 🆕 Karty miesięcy: odcięcie pustych miesięcy + mniej powtórzeń + poprawki tagów — NIEsprawdzone (2026-08-31)

User: "ulepsz karty miesięcy podsyłam eksport danych do wglądu" → potem screenshot pytania z
3 opcjami (odetnij puste miesiące / więcej stat / redesign wizualny), user zaznaczył WSZYSTKIE
+ dopisał konkretne skargi: "sporo zaokrąglone powtórzeń ze te kroki sa z Rzeszowa do Lublina
bez sensu, duzo pomyłek kategorii słodycze przekąski". Ta sesja zrobiła TRZY konkretne fixy
(zweryfikowane na PRAWDZIWYM eksporcie JSON usera, nie na ślepo — pełny opis w ARCHITECTURE.md
sekcja "Wrapped/kolekcje"):
1. Karta miesiąca wymaga TERAZ realnego sygnału apki (wydatek/nastrój/wypłata) — same
   zsynchronizowane kroki z zegarka (Health Connect backfill sięgał u tego usera do 2022,
   3 lata przed użyciem reszty apki) już nie tworzą pustej karty.
2. `stepsToDistanceFact` — zagęszczona tabela landmarków 90-650 km (było tylko 2 landmarki
   w typowym miesięcznym zakresie tego usera, teraz 5).
3. `getFoodTags` — kilka realnych luk w słowach-kluczach słodycze/przekąski (skrócone
   paragonowe "Ciast" bez 'k', brakujące marki Balconi/Jelly/miętówki/grylaż).

`tsc`/`jest` zielone (65 suit/808 testów — nowe pliki `monthCards.test.ts`, rozszerzone
`funComparisons.test.ts`/`receiptParser.test.ts`). **Priorytet testu na urządzeniu**: Kolekcja
miesięcy — sprawdź czy liczba kart spadła (bez pustych "same kroki" kart sprzed używania
apki), czy ciekawostka o dystansie różni się między kartami różnych miesięcy, i czy nowo
zeskanowane paragony ze słodyczami/przekąskami/miętówkami/grylażem łapią właściwy tag.

**NIE zrobione w tej sesji, wciąż otwarte z tej samej rozmowy:**
- **Więcej stat/ciekawostek na karcie** i **redesign wizualny** — user zaznaczył OBA jako
  chciane w AskUserQuestion, ale nie sprecyzował KONKRETNIE co (jaki stat, jaki nowy layout).
  Czeka na doprecyzowanie / konkretny przykład zanim zacznę zgadywać design.
- **"Sporo zaokrąglone bez sensu w całej apce"** — user napisał to ogólnikowo o CAŁEJ apce,
  nie tylko kartach miesięcy. Zbyt szerokie żeby ruszać bez konkretnych przykładów (które
  ekrany/liczby) — czeka na wskazanie GDZIE dokładnie widzi zaokrąglenia, które nie mają sensu.
- **Sklejony nagłówek adresu sklepu z nazwą pierwszego produktu na paragonie** — w eksporcie
  usera 2 itemy z JEDNEGO paragonu miały dosłownie "Kaufland Rzeszów-Nowe Miasto ul. Rejtana
  40 Rzeszów <nazwa produktu>" jako nazwę itemu (adres sklepu wleciał w linijkę pierwszego
  produktu). Osobny, wąski bug w `receiptParser.ts`'s parsowaniu linii — niezbadany (za mało
  przykładów żeby bezpiecznie zdiagnozować regex/logikę bez ryzyka zepsucia innych paragonów),
  niski priorytet (2 itemy na setki), ale wart odnotowania jeśli user zgłosi więcej podobnych.

## ✅ Grey screen w "Co zjadłem" (2026-08-31) — WRÓCIŁO 2026-09-04, TERAZ NAPRAWIONE NA REAL

Zgłoszony wcześniej tego dnia (Co zjadłem → Produkty → ciastka → Zapisz). Przeszukane
statycznie (kod + eslint pod kątem hooków) bez znalezienia przyczyny; user następnie
zgłosił że dodanie na "wczoraj" nie crashuje (możliwa wskazówka: coś specyficznego dla
DZISIEJSZEJ daty), ale finalnie user: "nie wywala już grey screena nie wiem o co chodzi
narazie odhaczony problem" — NIE naprawiony wtedy, po prostu przestał się powtarzać, i
wrócił 2026-09-04 (patrz nowy wpis na samej górze tego pliku + ARCHITECTURE.md §23) — tym
razem znaleziona i naprawiona REALNA przyczyna (`purchasedCatForName` resortująca całą
historię wydatków co klawisz w polu nazwy nowego produktu, `app/food/product.tsx`). Data
posiłku nigdy nie miała znaczenia — myląca korelacja usera, prawdziwy czynnik to "czy
produkt jest już znany (cat ustawione) czy tworzony od zera".

## 🆕 Nawyk "Bez słodyczy" nie łapał produktu bez słowa-klucza w NAZWIE (tylko w kategorii) — NIEsprawdzone (2026-08-31)

User: "nie łapie ciastek Milka jako słodyczy i nie resetuje to problem niech flaguje takie
rzeczy bo to bez sensu zjem i mam nadal streak słodyczy xdd". Realny bug: dopasowanie do
`avoidKeyword` sprawdzało TYLKO nazwę zjedzonego itemu — produkt nazwany dosłownie "Milka"
nigdy nie trafiał, mimo otagowania kategorią "Słodycze" przy dodawaniu produktu. Naprawione
+ skonsolidowane: nowa `matchedEatDays()` w `countersStore.ts` zastępuje TRZY niezależne
kopie tej samej (buggy) pętli, które istniały osobno w `habits.ts`, `countersStore.ts` i
`habit-year.tsx` — teraz wszystkie trzy dopasowują nazwę ORAZ kategorię produktu (przez
`productId` → `FoodProduct.cat`). Pełny opis w ARCHITECTURE.md (sekcja Nawyki). `tsc`/`jest`
zielone (64 suity/799 testów, 3 nowe testy w `habits.test.ts`). **Priorytet testu na
urządzeniu**: (a) zjedz coś otagowane "Słodycze" ale nazwane bez słowa typu
"czekolad/słodycz/ciast/..." (np. dosłownie "Milka") — streak nawyku "Bez słodyczy" powinien
pęknąć tego dnia; (b) sprawdź kalendarz roczny (`habit-year.tsx`, długie przytrzymanie
nawyku/licznika) pokazuje ten sam dzień jako "wpadkę".

## 🆕 Powiadomienie/UI misji mówią SKĄD kotek wrócił — NIEsprawdzone (2026-08-31)

User: "jak jest powiadomienie że pupil wrócił z misji to niech będzie napisane z jakiego
miejsca wrócił". `MiniBoss.destination` już istniało (widoczne na pasku "w drodze"), teraz
dociągnięte do WSZYSTKICH trzech miejsc, które mówią "wrócił": push powiadomienie
(`notificationsService.scheduleMissionReady`, tytuł "Pupil wrócił z misji: <miejsce>! 🎒"),
scena `/pet` w stanie `missionReady` (nowa linia "Wrócił z: <miejsce>" nad przyciskiem walki),
i `TopPill.tsx` ("PUPIL WRÓCIŁ Z: <MIEJSCE>" zamiast generycznego "Z MISJI"). Pełny opis w
ARCHITECTURE.md (sekcja Misja pupila). `tsc`/`jest` zielone (64 suity/796 testów — logika
`minibossForMission`/`destination` była już testowana, nic nowego do przetestowania jednostkowo
w samym wiring). **Priorytet testu na urządzeniu**: wyślij pupila na misję, zaczekaj (albo
skróć czas testowo) aż będzie gotowa — sprawdź czy (a) push powiadomienie pokazuje nazwę
miejsca, (b) po wejściu w `/pet` napis "Wrócił z: X" nad kotkiem zgadza się z tym co było w
powiadomieniu, (c) pigułka na górze ekranu (jeśli akurat rotuje na misję) też pokazuje to samo
miejsce — wszystkie trzy powinny być IDENTYCZNE (ten sam deterministyczny dobór po
`missionStartedAt`).

## 🆕 Finanse: filtr „Rachunki" (prąd/czynsz/…) + suma po filtrach — NIEsprawdzone (2026-08-31)

User: "dodaj mi filtry po tagach np pge itp żeby wiedzieć ile płacę za prąd, albo na
dashboardzie wykres płatności prądu" — zaimplementowana PIERWSZA opcja (filtr), bo działa na
danych które już istnieją (`storeName`/`note` na wydatku) bez ręcznego tagowania i bez
budowania nowej sekcji dashboardu (playbook w §12 — DEFAULT_DASHBOARD_SECTIONS +
SECTION_TITLES/DESC/GROUP + node w index.tsx — większy koszt niż filtr, który dawał to samo
"ile płacę za prąd" szybciej). **Wykres płatności prądu na dashboardzie NIE zrobiony —
jeśli sam filtr w Finansach nie wystarcza (np. user chce trend miesiąc-do-miesiąca bez
ręcznego przełączania filtra), to osobna, większa zmiana do zrobienia później.**
Szczegóły w ARCHITECTURE.md §6 (finances.tsx). `billTagFor()` w `recurringBills.ts`
(eksportowany razem z `BILL_TYPES`) — ta sama lista rachunków co dashboardowa "Propozycja
stałego rachunku", teraz reużyta w filtrze Finansów zamiast duplikowanej logiki. `tsc`/`jest`
zielone (64 suity/796 testów — nowe testy `billTagFor` w `financePredicates.test.ts`).
**Priorytet testu na urządzeniu**: Finanse → Filtry → sekcja "Rachunki" (widoczna tylko gdy
w danych jest coś rozpoznane jako rachunek) → wybierz "Prąd" → sprawdź czy lista pokazuje
WSZYSTKIE płatności PGE/Tauron/etc. (nawet sprzed 31 dni — filtr przeszukuje całą historię)
i czy licznik "N transakcji · razem X PLN" pod paskiem filtrów pokazuje poprawną sumę.

## 🆕 UI: Sklep dnia — 4 itemy, siatka tylko-ikona zamiast pełnych wierszy — NIEsprawdzone (2026-08-31)

User: "zrób ładniej ten sklep, zwiększymy do 4 itemów... ustawić itemy po 4 obok siebie tylko
z ikoną, mi po kliknięciu pokazuje się popup ze statystykami i formularzem zakupu i
porównania z założonym". `dailyShopSlots` 3→4 (domyślny `count`), nowa `s.dailyGrid` (4
kwadratowe kafelki tylko-ikona + ✓ jeśli posiadane) zastępuje pełnoszerokościowe wiersze
(które ZOSTAJĄ dla Skrzynek — nietknięte). Popup ze statystykami/porównaniem/zakupem to
`GearPreviewModal`, który JUŻ ISTNIAŁ od 2026-08-22 — tylko trigger się zmienił, nie treść.
Pełny opis w ARCHITECTURE.md. `tsc`/`jest` zielone (64/791, jeden test w `gear.test.ts`
zaktualizowany na nowy domyślny count 4). **Priorytet testu na urządzeniu**: zakładka
Rynek → Sklep dnia — 4 kafelki obok siebie, tap otwiera popup ze statystykami/porównaniem,
zakup działa tak jak wcześniej.

## 🆕 Roll wartości statu w przedziale zamiast stałej wartości na rzadkość — NIEsprawdzone (2026-08-31)

Druga część tej samej wiadomości co punkt wyżej ("itemy od teraz mogą dropić w przedziałach
czyli od 0.5-2% dmg dodatkowego i się losują"). Przed implementacją 3 pytania doprecyzowujące
(AskUserQuestion, duża/nieodwracalna zmiana ekonomii+danych graczy) — user wybrał
rekomendowane za każdym razem: (1) roll Sklepu dnia zostaje DETERMINISTYCZNY per dzień, (2)
lepszy roll w TEJ SAMEJ rzadkości LICZY SIĘ jako realny upgrade, (3) mechanika na WSZYSTKICH
6 slotach, nie tylko obroży/atkPct.
`GEAR_ROLL_SPREAD: [0.7, 1.3]` w `gear.ts` — ±30% wokół ISTNIEJĄCEGO `gearStatValue` (środek
przedziału, cały dotychczasowy balans zostaje nietknięty). `gearValueRange`/`rollGearValue`
(seedable, domyślnie `Math.random`); Sklep dnia seeduje `pseudoRandom01(date+id+'|value')`
(deterministyczne), skrzynki (`petBoxes.ts`, `petStore.openCrate`) BEZ seeda (prawdziwa
loteria). `petStore.ownedGear` zmienił kształt: `Partial<Record<string, GearRarity>>` →
`Partial<Record<string, OwnedGear>>` (`{rarity, value}`) — z migracją w `onRehydrateStorage`
(stary string-rarity → `{rarity, value: gearStatValue(item, rarity)}`, gracz zachowuje
DOKŁADNIE tę samą moc, żaden roll nic nie zabiera/dodaje z zaskoczenia przy update apki).
`isGearUpgrade(next, cur)` (gear.ts) — JEDYNE źródło prawdy "czy to ulepszenie" wszędzie
(`openCrate`, `grantGear`, `buyDailyGear`, `GearPreviewModal`): rzadkość wygrywa najpierw, przy
remisie wyższy `value`. `sellGear` CELOWO zostaje rarity-only (poza zakresem — "cena skupu" to
nieprecyzyjna wewnętrzna abstrakcja). Pełny opis w ARCHITECTURE.md. `tsc`/`jest` zielone
(64 suity/793 testy) — zaktualizowane `gear.test.ts`, `grantGear.test.ts`,
`buyDailyGear.test.ts`, `petBoxes.test.ts` + nowe testy na "lepszy roll w tej samej rzadkości =
upgrade". **Priorytet testu na urządzeniu**: (a) otwórz kilka skrzynek/Sklep dnia, sprawdź że
wyświetlana wartość statu w `GearPreviewModal`/`GearSlotModal` różni się między kopiami tego
samego itemu+rzadkości (nie jest już sztywna); (b) Sklep dnia — ten sam zestaw+wartości
powinien być identyczny cały dzień (deterministyczne), nowy zestaw dopiero o 6:00; (c) stary
zapis (jeśli jest urządzenie z danymi sprzed tej zmiany) po aktualizacji nie traci mocy
ekwipunku — staty bojowe przed/po migracji powinny wyjść identyczne.

## 🆕 BUG/UX: usunięta jasna "otoczka" za czarnym kotkiem na pasku misji — NIEsprawdzone (2026-08-30)

User ze screenshotem ekranu Pupil (czarny kot "Fafik"): "czemu jak mam czarnego kota to
jakieś kółko się pojawia pod nim wtedy, wywal je xd". To był `missionCatHalo` — świadomie
dodany 2026-08-21 jasny okrąg za kotkiem na ciemnym pasku misji (żeby ciemne futro nie
wtapiało się w tło), ale w praktyce przy małym rozmiarze kotka na pasku (`MISSION_CAT_SIZE`)
wyglądał po prostu jak losowe szare kółko, nie jak subtelny kontrast. Usunięty całkowicie
(`catCoatIsDark`/`missionCatHalo`/import `luma` z `pet.tsx`) — kotek na pasku misji renderuje
się teraz zawsze bez halo. `tsc`/`jest` zielone (64/791, bez regresji — czysto usunięcie UI
elementu, bez logiki do przetestowania). **Priorytet testu na urządzeniu**: pupil z ciemnym
kolorem futra (czarny/szary/brązowy) w trakcie misji — pasek misji NIE powinien mieć żadnego
kółka za kotkiem.

## 🆕 UI: portrety areny powiększone + wysłany szablon SVG pod przyszłe tła — NIEsprawdzone (2026-08-30)

User: "boss i pupil był większy bo są tacy malutcy tutaj" (ze screenshotem ekranu walki) +
"musimy przygotować je pod customowe grafiki... jak mi wyeksportujesz identyczną templatkę w
svg... to ja przygotuje tło (tak samo jak przy sklep/rynek)". Zrobione: `PORTRAIT_SIZE`
104→130 dla `CatArt`/`BossArt` w arenie walki, plus ścieśnione paddingi areny/kafelków żeby
portret zmieścił się bez wychodzenia poza kartę (pełny opis geometrii w ARCHITECTURE.md).
Wysłany plik `arena-template.svg` — dokładna geometria karty areny w dp (kafelki/pasek HP/
bezpieczna strefa portretu Ø130), do zaimportowania w narzędziu graficznym.

**NIE zweryfikowane na urządzeniu**: pozycja pionowa lecącego pocisku (łapka/pięść) między
kafelkami (`s.projectile`'s `top`, 96→108) przeliczona MATEMATYCZNIE z delty paddingów/
wysokości, nie zmierzona na żywym renderze — sprawdź czy pocisk faktycznie leci przez środek
portretu, nie przez pasek HP nad nim; jeśli nie, drobna korekta `top` w `boss-fight.tsx`.

**Świadomie NIE zrobione w tym PR (odłożone przez usera, "z czasem")**: samo wpięcie
obrazka tła. `tile`/`arena` mają dziś nieprzezroczyste tła (`c.bg.elevated`/`c.bg.card`) —
obrazek za całą areną pokazałby się TYLKO w wąskim marginesie/szczelinie między kafelkami,
nie jako pełna scena za portretami kotka/bossa. Żeby tło realnie robiło wrażenie "wyprawy/
lochu", trzeba będzie RÓWNOLEGLE z wpięciem gotowej grafiki zmienić `tile`/`arena` na
półprzezroczyste — nie robić tego teraz, czekać aż user dostarczy gotową grafikę i poprosi
o wpięcie.

## 🆕 PERF/UX: walki lagują — statyczny kotek, mniej animacji na trafienie, stabilny WALCZ! — NIEsprawdzone (2026-08-30)

User: "laguja mi walki i te z questów i te z bossem" — trzy konkretne fixy na `boss-fight.tsx`
(quest/misja fightują na TYM SAMYM ekranie co kampania/raid/event/mad, jeden fix łapie oba
zgłoszenia):
1. **Kotek statyczny w walce** — `<CatArt animate={false} .../>` wyłącza idle-pętle (oddech/
   mruganie/spojrzenia/uszy/auto-liźnięcie łapki), które dotąd biegły PEŁNE, tak jak na `/pet`.
   Atak (swat kotka co rundę) dalej działa — `CatArt.tsx`'s efekt ataku już NIE jest zagated
   pod `animate`, tylko pod `asleep`. User sugerował export do PNG, ale zostało jako
   wektorowa `animate={false}` (żeby nie stracić personalizacji koloru/pręg/oczu w walce —
   PNG per paleta byłby niewykonalny).
2. **Czerwone kółka-flash usunięte** — zastąpione statycznym `RadialGlow` (już istniejący
   komponent, `components/ui/RadialGlow.tsx`) za ikoną ataku (łapka/pięść/pazur), dziedziczy
   animację z TEGO SAMEGO `Animated.Value` co ikona — zero nowych animowanych obiektów.
3. **Przycisk WALCZ! nie skacze już** — 4 reaktywne linijki mechaniki (osłona/regen/
   uzdrowienie/cierń) przeniesione POD przycisk (i pod "Pomiń walkę") zamiast MIĘDZY "Motyw"
   a przyciskiem — ich pojawianie/znikanie już nic nad sobą nie przesuwa. Sama mechanika
   (zróżnicowani bossy: kryt/pancerz) ZOSTAJE — user explicite to lubi, chciał tylko naprawić
   skaczący przycisk, nie usuwać mechaniki.

**NIE znalezione w kodzie, mimo przeszukania**: user wspomniał "redukuje obrażenia bo sen<7"
jako coś do wywalenia — sprawdziłem `boss-fight.tsx`, `bosses.ts` i cały `src/`, nie ma
mechaniki "mało snu → mniejsze obrażenia w walce" nigdzie w repo. Możliwe że to coś ustalone
w rozmowie/pamięci, do której nie mam tu dostępu, albo pomyłka z inną funkcją (np. quest
"Prześpij 7 godzin", niezwiązany z walką). **Nietknięte — potrzeba wskazania GDZIE dokładnie
user to widzi**, zanim cokolwiek usunę (żeby nie wyciąć czegoś innego przez pomyłkę).

**Odłożone przez samego usera ("z czasem")**: tła wypraw/lochów kampanii.

Pełny opis w ARCHITECTURE.md (sekcja Bossy, "Wydajność ekranu walki"). `tsc`/`jest` zielone
(64/791, bez regresji — czysto UI/wydajnościowy fix, brak nowych czystych funkcji do
przetestowania). **Priorytet testu na urządzeniu**: wejdź w dowolną walkę — kotek powinien
stać spokojnie (bez oddechu/mrugania/lizania) poza momentem własnego ataku, trafienia powinny
mieć czerwoną poświatę zamiast pełnego kółka, i WALCZ! nie powinien się przesuwać niezależnie
od tego czy pojawia się info o osłonie/regeneracji/uzdrowieniu/cierniu. Zwróć uwagę czy walka
realnie mniej laguje niż wcześniej — jeśli nie, to znaczy że lag ma INNE źródło niż animacje
kotka/flash, i trzeba będzie profilować głębiej (Flipper/React DevTools) zamiast dalej zgadywać.

## 🆕 POLISH: nemesis (`menaceClaim`) dostał fallback-na-upgrade jak reszta systemu perków — NIEsprawdzone (2026-08-29)

User: "dokończmy te perki (co były itemybossow) żeby były doszlifowane" — zapytany czy
rozszerzyć drop na zwykłych/eventowych bossów kampanii, wybrał **zostaw jak jest** (tylko
skrzynki + nemesis, bez zmian zakresu). Zamiast tego doszlifowana ISTNIEJĄCA ścieżka: pokonanie
nemesis (`menaceClaim()`, `MENACE_ITEM_DROP_CHANCE=8%`) miało TYLKO gałąź "nowy nieposiadany
perk" — po skompletowaniu wszystkich 9 perków (nawet na poziomie 1) ta szansa była TRWALE
martwa, mimo że nemesis to powtarzalny boss (nie jednorazowy jak kampania). Teraz fallback na
darmowy +1 poziom już posiadanego, nie-na-maksie perku — ten sam wzorzec co `openCrate()`
(skrzynka z głaskania) już miał. Zmieniony kontrakt `menaceClaim()` (zwraca teraz
`{itemDropped, itemLeveledUp} | null` zamiast samego `CombatItemId | null`), victory modal
bossów dostał napis "⬆️ {nazwa} +1 poziom" obok "🎁 Nowa umiejętność". Przy okazji doczyszczone
przeoczone miejsca z rename na "perki"/"umiejętności" (poprzedni PR #112 nie złapał wszystkiego):
`CrateModal.tsx` (reveal darmowej skrzynki) i `bossProgressReport.ts` (eksportowalny raport
stanu) dalej mówiły "item(y) bojowy/e". Pełny opis w ARCHITECTURE.md §9. `tsc`/`jest` zielone
(64/791, bez nowych testów — `menaceClaim`/`openCrate` to store actions, w tym repo testowane
tylko wydzielone czyste funkcje, ten sam brak pokrycia co reszta zestawu). **Priorytet testu na
urządzeniu**: jeśli masz już wszystkie 9 perków (albo da się to szybko osiągnąć w dev/testowym
stanie) — pokonaj nemesis kilka razy, sprawdź że czasem pokazuje się "⬆️ ... +1 poziom" zamiast
zawsze braku nagrody bonusowej.

**Przy okazji zweryfikowane (user pytał, czy działa) — zaległe questy z poprzednich dni**:
`usePetQuests().missed` (fix z 2026-08-27) jest w pełni podpięte: renderuje się w
`app/pet-quests.tsx` (osobna sekcja z żółtą ramką, `missed.length > 0`), da się odebrać
(`claimDailyFor(q.id, q.date, ...)`), i zasila "ping" badge na `PupilNavbar.tsx`
(`hasClaimable = quests.claimableCount > 0 || missed.length > 0`) na wszystkich 4 zakładkach
Pupila, nie tylko na ekranie Zadań. Sięga 6 dni wstecz (`RECENT_DAYS_BACK` w
`usePetHealthSync.ts`), więc dłuższa przerwa w otwieraniu apki nie gubi bezpowrotnie nagród.
Dane (`health.steps` itd.) odświeżają się przy każdym wejściu na ekran (`useFocusEffect`),
powrocie z tła (`AppState` listener) I co 60s gdy ekran zostaje aktywny przez północ (3 osobno
udokumentowane, wcześniej naprawione dziury odświeżania — patrz komentarze w
`usePetHealthSync.ts`) — więc claim "za kroki z wczoraj" widoczny rano to ZAMIERZONY
mechanizm nadrabiania zaległości, nie bug. User zapytany o prawdziwe odświeżanie W TLE (nawet
przy zabitej apce) wybrał **zostaw jak jest** — true background execution na iOS
(`BGTaskScheduler`) jest oportunistyczne i mocno tłumione przez system (brak gwarancji
kiedy/czy się odpali), wymagałoby customowego dev clienta (nie Expo Go) i nowego natywnego
builda za cenę niepewnej korzyści, skoro istniejący system (focus/AppState/interval +
catch-up zaległych questów) już nic nie gubi.

## 🆕 FEATURE: perki bossów (dawniej "itemy bojowe") dropowalne ze skrzynek sklepowych — NIEsprawdzone (2026-08-29)

Część 2 tej samej wiadomości usera co nawyk auto-śledzony "Bez słodyczy" (patrz osobny PR/
osobny wpis, ta sama wiadomość usera, ale zupełnie inna część kodu — brak nakładania się
plików, oddzielone celowo na dwa PR-y): "te itemy bossów co miały
być te pierwsze pierwsze co są w assets/itemybossy to wgle ich nie da się dropnąć... to są
perki... które ogólnie nie są itemami tylko bardziej UMIEJĘTNOŚCIAMI więc tak bym je nazwał.
te kupowane skrzynki zrobiłbym tak że można dropnąć BASIC ITEMY > STREAK FREEZE > COINY
50-300%skrzynki > i TE ITEMY BOSSÓW". Pełny opis mechanizmu w ARCHITECTURE.md §9 ("Przemianowane
na perki..."). W skrócie: `petBoxes.ts`'s `rollBox()` (skrzynki KUPOWANE w sklepie — drewniana/
srebrna/złota + darmowa skrzynka dnia) w ogóle nie miał gałęzi na te itemy, mimo że dwie INNE,
niezależne ścieżki (`openCrate()` z głaskania kotka, `menaceClaim()` z pokonania nemesis) już
je dropowały — to dokładnie ta luka co user zgłosił. Nowe `combatItemChance` per skrzynka
(sardine 0.02/silver 0.05/gold 0.08 — każde < `freezeChance` tej samej skrzynki), monety
zmienione z płaskich zakresów na 50-300% kosztu skrzynki (18-105/45-270/100-600 zamiast starych
3-12/10-30/25-70). UI: sekcja w `/pet` przemianowana z "Ekwipunek bojowy" na "Umiejętności
bossów", napis w victory modalu bossów z "Nowy item bojowy" na "Nowa umiejętność". `tsc`/`jest`
zielone (64/791 — 5 nowych testów strefy perków w `petBoxes.test.ts`). **Priorytet testu na
urządzeniu**: Sklep → kup dowolną skrzynkę kilka razy (zwłaszcza złotą, ma najwyższy
`combatItemChance`) — sprawdź że da się wylosować perk bossa (modal "NOWY PERK BOSSA!"/"PERK
ULEPSZONY!"), i że pojawia się w `/pet` pod "Umiejętności bossów". Sprawdź też że kwoty monet
ze skrzynek realnie mieszczą się w nowym, dużo wyższym zakresie (50-300% ceny skrzynki), nie w
starym niskim.

**Świadomie NIE zrobione — flagowane do potwierdzenia, nie zgadywane**: user wspomniał drop
perków z walki ze zwykłymi bossami kampanii/eventowymi tylko luźno ("czy coś tam"), w
przeciwieństwie do w pełni wyspecyfikowanej hierarchii skrzynek. Nemesis (`menaceClaim()`) już
to ma od dawna (`MENACE_ITEM_DROP_CHANCE=0.08` w `seasonalEvents.ts`, niezmienione w tym PR) —
ale zwykłe bossy kampanii (`claimQuestFight`, 22 bossów) i literalne "eventy" (`eventClaim`,
`seasonalEvents.ts`) NIE dropują perków wcale. Zanim to dodać, trzeba ustalić z userem: czy
dotyczy WSZYSTKICH bossów kampanii czy tylko trudniejszych/końcowych, jaki drop-rate (brak
liczb od usera, jak przy dodge/mindcontrol/shield/thorn), i czy potrzebny osobny UI w
`boss-fight.tsx`'s victory modalu dla tej ścieżki (dziś ten modal ma napis TYLKO dla
`victory.itemDropped`, czyli nemesis) — realny, ale osobny kawałek pracy, nie doklejać
milcząco do tego PR.

## 🆕 FEATURE: nawyk "Bez słodyczy" (i innych `AVOID_PRESETS`) — auto-śledzony w Nawykach — NIEsprawdzone (2026-08-29)

User: "żeby w nawyku dodać że chcę nie jeść słodyczy (bo było w odliczaniu nie wiem czy
przeniosłeś bo nie dałeś znać a prosiłem)". Zapytany czy ma to być zwykły ręczny nawyk czy
auto-śledzony jak licznik w Odliczaniu — wybrał **auto-śledzony**. Nowy `Habit.kind='avoid'` +
`avoidKeyword` (ten sam format co `Counter.keyword`); dzień = done chyba że w dzienniku
jedzenia (`useFoodStore.meals`) tego dnia jest pozycja pasująca do `matchesAvoid` (nazwa dania
LUB nazwa składnika/`parts`) — wtedy broke, seria pęka, dokładnie jak licznik „bez X". Presety
w formularzu tworzenia nawyku: "Bez słodyczy/fast foodów/alkoholu/energetyków" (z
`AVOID_PRESETS` w `countersStore.ts` — te SAME cztery co w Odliczaniu, więc user dostaje od
razu wszystkie cztery, nie tylko słodycze). W liście nawyków taki wpis jest NIEklikalny
(kropkowany checkbox + odznaka "auto") — ręczne odznaczenie i tak zostałoby nadpisane przy
najbliższym auto-sync (po każdej zmianie `meals`, natychmiast, nie dopiero przy wejściu na
ekran). Pełny opis mechanizmu w ARCHITECTURE.md (sekcja "Nawyki/liczniki"). `tsc`/`jest`
zielone (64/786 — 7 nowych testów `computeAvoidCounts` w `habits.test.ts`). **Priorytet testu
na urządzeniu**: Nawyki → dodaj → wybierz preset "Bez słodyczy" → zjedz i zaloguj coś
pasującego (np. "czekolada") w Co zjadłem → wróć do Nawyków, dzień powinien pokazać się jako
NIE zaliczony (czerwony/przerwana seria) BEZ ręcznego dotykania. Sprawdź też że stary licznik
"bez słodyczy" w Odliczaniu (jeśli user go ma) dalej działa niezależnie — to jest DODATKOWA
ścieżka, nie migracja/usunięcie starej.

**Część 2 tej samej wiadomości usera** — itemy bossów jako dropowalne "perki"/"umiejętności"
ze skrzynek sklepowych — patrz osobny wpis "🆕 FEATURE: perki bossów..." wyżej (osobny PR,
`claude/boss-perks-crates`, żeby nie mieszać dwóch niezależnych zmian w jednym PR).

## 🆕 BUG: własny tag na paragonie się duplikował + nie był od razu wybieralny gdzie indziej — NIEsprawdzone (2026-08-28)

User ze screenshotem ekranu "Wydatek": "jak dodaje wlasny tag na paragonie ie to om soe
duplikuje nie wiem czemu i nie mam opcji oddania go na stałe, żebym mógł sobie dodac tag na
inne kategorie". Dwie rzeczy w jednej wiadomości:
1. **Duplikat naprawiony** — `TextInput` do własnego tagu (w `scan.tsx`'s `TagPicker` I w
   `app/expenses/[id].tsx`'s `ItemEditor`, ta sama para komponentów co zwykle) miał
   `onSubmitEditing` I `onBlur` spięte z tą samą funkcją dodającą — oba potrafiły odpalić się
   dla jednego "gotowe" i dodać ten sam tag dwa razy. Nowy `addingRef` blokuje drugie
   wywołanie w tym samym ticku. Istniejące już zduplikowane dane (jak na screenshocie usera)
   czyszczą się same przy ponownym otwarciu (bez ręcznej edycji).
2. **"Na stałe" — było już trwałe, ale niewidoczne w tej samej sesji** — nowy tag zapisywał
   się poprawnie (`saveTagMemory` przy zapisie paragonu) i STAWAŁ się wybieralny dla innych
   produktów... dopiero przy NASTĘPNYM otwarciu skanera. Teraz pojawia się jako opcja dla
   WSZYSTKICH pozostałych produktów natychmiast, w tej samej sesji skanowania.

Pełny opis w ARCHITECTURE.md §7b. `tsc`/`jest` zielone (64/779, bez nowych testów — czysto
UI-owy fix w komponentach ekranów, logika bez wydzielonych czystych funkcji do
przetestowania). **Priorytet testu na urządzeniu**: Wydatki → skanuj paragon → dodaj własny
tag na produkcie (spróbuj i "gotowe" na klawiaturze, i stuknięcie gdzie indziej) — sprawdź że
pojawia się RAZ, nie dwa razy, i że jest od razu wybieralny w pickerze INNEGO produktu na tym
samym ekranie. Sprawdź też edycję już zapisanego wydatku (ekran "Wydatek" → dotknij pozycję)
tym samym sposobem.

## 🆕 BUG: WALCZ! na raidzie nic nie robił mimo widocznej energii — NIEsprawdzone (2026-08-28)

User ze screenshotem ekranu Raid (Kraken Chaosu): "mimo że mam energię nie mogę zawalczyć o
co chodzi?" — pigułka u góry pokazywała "1", przycisk WALCZ! wyglądał normalnie aktywny.
Przyczyna: raid kosztuje `RAID_ENERGY_COST=2` (nie 1), a `attack()` w `boss-fight.tsx`
POPRAWNIE blokował próbę z komunikatem-toastem — ale sam PRZYCISK (i pigułka energii w
headerze) liczyły tylko `energy <= 0`, nie `energy < energyCost`. Mini-karta rajdu w
`bosses.tsx` dostała ten fix już 2026-08-25, pełny ekran walki (osiągany zarówno z tej karty
jak i bezpośrednio) — nie. Fix: nowe pole `energyCost` na `Target` (1 domyślnie,
`RAID_ENERGY_COST` dla raidu), jedno źródło prawdy dla przycisku/pigułki/`attack()`. Pigułka
teraz pokazuje "1/2" zamiast samego "1" gdy koszt > 1, pod przyciskiem nowy tekst "Potrzeba
2⚡, masz 1", toast doprecyzowany (nie mylące "brak prób, wróć jutro" gdy user MA jakąś
energię, tylko za mało na TĘ walkę). Pełny opis w ARCHITECTURE.md. `tsc`/`jest` zielone
(64/779, bez nowych testów — czysto UI-owy fix widoczności/komunikatu, logika blokady już
była poprawna i przetestowana). **Priorytet testu na urządzeniu**: ekran Raid z energią < 2
(np. 1⚡ jak na screenshocie usera) — przycisk WALCZ! powinien być wygaszony, pigułka
pokazywać "1/2", i widoczny tekst tłumaczący ile brakuje.

**Znaleziony przy okazji, celowo NIE naprawiony (ten sam gap co u usera, ale nikt go nie
zgłosił)**: Nemesis (event `kind==='menace'`) ma identyczną architekturę co raid przed
fixem z 2026-08-25 — user zgłosił problem tylko dla raidu wtedy. Nemesis ma jednak zawsze
`energy=1`/`energyCost=1` (nielimitowane próby, patrz komentarz w kodzie), więc TEN
konkretny bug (koszt > energia mimo widocznej energii) go nie dotyczy — nic do zrobienia.

## 🆕 BUG: kalendarz pracy przestawał się synchronizować NA ZAWSZE — NIEsprawdzone (2026-08-28)

User ze screenshotami (kafelek dashboardu vs realny Google Kalendarz): "juz minęło kilka
minut i nadal nie dodały mi sie eventy z kalendarza z pracy do aplikacji nawet jak
odświeżam". Trzy miejsca (dashboard mount, dashboard `refreshOnResume`, zakładka Kalendarz)
gate'owały fetch Google Calendar za `getStoredToken()` PRZED wywołaniem `fetchEvents()` —
gdy token raz zostanie skasowany (np. po jednym nieudanym cichym odświeżeniu), KAŻDE
kolejne odświeżenie w całej appce staje się trwałym, cichym no-opem, bez żadnego komunikatu.
Fix: wszystkie trzy miejsca wołają `fetchEvents()` bezwarunkowo — funkcja MA WŁASNY fallback
(spróbuj tokena → cichy refresh → dopiero wtedy `[]`), zewnętrzny gate tylko go blokował.
Pełny opis w ARCHITECTURE.md §4b. `tsc` czysty (logika bez nowych czystych funkcji do
testowania — czysto sieciowy fix). **Priorytet testu na urządzeniu**: dashboard + zakładka
Kalendarz po dłuższej przerwie w używaniu appki (token miał szansę wygasnąć) — sprawdź że
eventy z kalendarza pracy (np. dzisiejsza/jutrzejsza zmiana) faktycznie się pojawiają po
otwarciu appki, bez ręcznego grzebania w Ustawieniach.

## 🆕 Praca: naprawiona logika "przed zmianą" + więcej kolorów + stawka ogółem/ost. miesiąc — NIEsprawdzone (2026-08-28)

User: "ile przepracowałem juz w miesiącu względem tyle ile muszę przepracować (tylko niech
sprawdza np jak dzisiaj mam pracę i jest przed pracą to jest jeszcze nie przepracowane jakby
nie?)" + "ile średnio na godzinę ogólnie ile średnio ze ostatniego miesiąca, bez
zaokrąglone" + "teraz nawet tamtej zakladce chaos troche możesz więcej kolorów tam użyć".
Trzy części:
1. **BUG naprawiony**: dzisiejsza zmiana liczyła się jako w CAŁOŚCI przepracowana od
   północy, nawet przed jej rozpoczęciem. Nowa `elapsedShiftHours()` (`workEvents.ts`,
   testowana) liczy tylko faktycznie miniony fragment zmiany.
2. **Nowe liczby**: "zł/h ogółem" (Σzł ÷ Σh po wszystkich uwzględnionych miesiącach) i
   "zł/h ostatni miesiąc" (z najnowszej wypłaty) obok siebie, do 2 miejsc po przecinku, bez
   zaokrąglania do całości jak reszta karty.
3. **Kolory**: Praca to teraz jawny, LOKALNY wyjątek od monochromatycznego akcentu appki —
   zielony (przepracowane), niebieski (zaplanowane/nadchodzące), złoty (stawka/pieniądze),
   zamiast wszystkiego w jednym płaskim, białym `WORK_ACCENT`.

Pełny opis w ARCHITECTURE.md §4b. `tsc`/`jest` zielone (64/779, +6 nowych testów
`elapsedShiftHours` w `__tests__/workEvents.test.ts`). **Priorytet testu na urządzeniu**:
kafelek Praca na dashboardzie I panel po kliknięciu weń — sprawdź że kolory się czytają
dobrze (jasny i ciemny motyw), że "przepracowane dziś" NIE liczy godzin przed rozpoczęciem
dzisiejszej zmiany (najlepiej sprawdzić rano, przed pracą), i że nowe "zł/h ogółem"/"zł/h
ostatni miesiąc" pokazują sensowne liczby.

## 🆕 BUG: dropnięty duplikat ekwipunku ze skrzynki znikał bez kompensaty — NIEsprawdzone (2026-08-27)

User: "jak w skrzynce daily wydropiłem to mi zniknął po prostu nic nie dostałem bo chyba
miałem podobny albo wgle zniknął". Ten sam bug co fix z 2026-08-26 (kupno w Sklepie dnia
itemu który już masz) — ale w SKRZYNKACH (`grantGear`, wołane po `onBuyBox`/`onDailyBox` w
`pet-shop.tsx` i `pet.tsx`), gdzie nikt tego nie naprawił przy okazji tamtego fixa. Duplikat
(już posiadany w ≥ tej rzadkości) był cichym no-opem — `BoxRevealModal` i tak pokazywał
"wygraną" kartę, ale `ownedGear` się nie zmieniało, user dostawał faktycznie nic. Fix:
`grantGear` kompensuje duplikat monetami (`gearSellValue`, jak ręczna sprzedaż) zamiast
wyrzucać w próżnię, zwraca skompensowaną kwotę; `BoxRevealModal` dostał nowy prop `dupeCoins`
— pokazuje wtedy uczciwą kartę "MASZ JUŻ TEN PRZEDMIOT" + monety zamiast udawanej nowej
kopii itemu. Pełny opis w ARCHITECTURE.md. `tsc`/`jest` zielone (64/770, +4 nowe testy w
`__tests__/grantGear.test.ts`). **Priorytet testu na urządzeniu**: Sklep → otwórz skrzynkę
(albo skrzynkę dnia) aż wypadnie duplikat itemu który już masz — sprawdź że dostajesz monety
i modal wyraźnie mówi że to duplikat, zamiast pokazywać zwykłą kartę "EKWIPUNEK!".

**Znaleziony przy okazji, NIEnaprawiony gap tej samej klasy**: `grantCombatItem` (itemy
bojowe, `src/utils/combatItems.ts` + `petStore.ts`) ma dokładnie ten sam cichy no-op na
duplikacie ze skrzynki — inny system (levels/upgrade zamiast rarity), więc potrzebna osobna
decyzja projektowa (auto-upgrade poziomu zamiast kompensaty monetami? sama kompensata?) zanim
to naprawić — celowo NIE tknięte w tej zmianie.

## 🆕 Skaner paragonów łapie teraz Kaufland app "Receipt copy" — NIEsprawdzone (2026-08-27, poprawione 2026-08-28)

User: "mamy że wykrywa Kaufland to niech łapie taki paragon z parteru" + wklejony tekst z
ekranu Kaufland app (paragon → "..." → "Receipt copy") — inny, byte-exact format niż stary
OCR-ze-zdjęcia parser obsługiwał (kategorie-nagłówki, "NAZWA ... CENA LITERA" w jednej linii
lub NAZWA + kontynuacja "ilość*cena"/"waga KG" w następnej, promocje na kasie z referencjami
"Pozycje:N,M"). Nowa gałąź `parseKauflandReceiptCopy()` w `receiptParser.ts`, wykrywana po
nagłówku "Cena PLN". Przy okazji fix ogólniejszego bugu: apka wstawia kody drukarki sklejone
bez spacji przed nazwą sklepu ("&1Kaufland..."), co na krótszej wklejce potrafiło całkiem
zgubić wykrycie sklepu (`\bkaufland\b` bez granicy słowa) — teraz `stripPrintMarkup()` ścina
to na wejściu do `parseReceiptText()`, no-op dla innych sklepów/formatów.

**DZIEŃ PÓŹNIEJ user ze screenshotem: "źle mi złapało produkty"** — banner "Suma produktów
(197,94 zł) > kwota na paragonie" mimo że total i wszystkie 10 pozycji były poprawne.
Pierwsza wersja liczyła `subtotal` PRZED rabatami i sumowała promocje TYLKO do osobnego pola
`totalDiscount`, ale `scan.tsx` tego pola nie zna — sumuje wprost `products[].finalPrice`.
Fix: promocje ("Pozycje:N,M") rozdzielane proporcjonalnie na KONKRETNE produkty (`finalPrice`/
`discount`/`promotion` per pozycja, ten sam wzorzec co reszta parserów w pliku), `subtotal`
liczony z sumy już-poobniżanych cen. Pełny opis obu bugów w ARCHITECTURE.md. `tsc`/`jest`
zielone (64/773, 16 testów łącznie na fixture z realnego paragonu Kaufland usera).
**Priorytet testu na urządzeniu**: Wydatki → Skanuj/wklej paragon → wklej tekst z Kaufland
app "Receipt copy" (dowolny paragon Kaufland z tej apki, nie tylko ten konkretny) — sprawdź
że sklep, wszystkie pozycje i suma łapią się poprawnie, W TYM że banner "brakuje rabatów" się
NIE pojawia gdy paragon ma promocje na kasie (nie tylko multi-buy/waga jak poprzednio).

## 🆕 BUG: "prześwity" na czole przygaszonego kotka po misji — NIEsprawdzone (2026-08-27)

User ze screenshotem: "pupil dziwnie wygląda jak ma tą misję jakby miał jakieś prześwity na
czole". Ta sama rodzina Androidowych bugów co saga PetTileCat — `opacity:0.3` na `<View>`
wokół `<CatArt>` (ekran misji ukończonej, "NACIŚNIJ ABY ZAWALCZYĆ") renderował na Androidzie
nachodzące na siebie warstwy (głowa + osobne `<Ear/>` overlaye z `CatArt.tsx`) jako niezależne
półprzezroczyste elementy zamiast jednej scalonej warstwy — miejsce zachodzenia świeciło
jaśniej niż reszta futra. Fix: `needsOffscreenAlphaCompositing` na tym `<View>` (`app/pet.tsx`)
— natywny RN prop dokładnie na ten przypadek, zero zmian w `CatArt.tsx`. Pełny opis w
ARCHITECTURE.md. `tsc`/`jest` zielone (63/759, bez nowych testów — czysto renderowy fix
propa). **Priorytet testu na urządzeniu**: pupil po powrocie z misji, jeszcze nieodebranej
("NACIŚNIJ ABY ZAWALCZYĆ") — czoło przygaszonego kotka powinno być jednolicie przyciemnione,
bez jaśniejszego paska/zygzaka.

## 🆕 Trzy drobne poprawki: sloty ekwipunku, "Rynek" scalony, kolory +N — NIEsprawdzone (2026-08-27)

Trzy niezależne prośby usera w jednej wiadomości:
1. **Sloty ekwipunku powiększone** ("za malutkie przy kotku") — 40×40→50×50 (+25%),
   `GearPanel.tsx`.
2. **"Skrzynki"+"Sklep dnia" scalone w jedną zakładkę "Rynek"** ("połączmy... nazywając to
   ogólnie RYNEK LUB BAZAR, ja moze zrobię grafikę pod ten bazarek potem") — na razie tylko
   scalenie zakładek (ikona `Store`, neutralna), bez własnej grafiki — user zapowiedział że
   dorzuci grafikę bazarku osobno później.
3. **Kolor "+5"/"+20" na przyciskach ulepszeń** dopasowany do stata (czerwony/zielony) zamiast
   domyślnego żółtego — cena w monetach zostaje żółta.

Pełny opis w ARCHITECTURE.md. `tsc`/`jest` zielone (63/759, bez nowych testów — trzy czysto
UI-owe zmiany, nic do przetestowania jednostkowo). **Priorytet testu na urządzeniu**: ekran
Pupila (sloty większe, kolory +5/+20) i Sklep → zakładka "Rynek" (skrzynki + sklep dnia razem,
sprawdź że oba działają jak wcześniej — zakup skrzynki i zakup z dziennego sklepu).

## 🆕 BUG: wypełnienie paska misji wystawało poza zaokrąglony kształt — NIEsprawdzone (2026-08-27)

User ze screenshotem: "pasek misji w trakcie wychodzi poza [ramkę], dziwnie się rozciąga
zamiast wypełniać". Wypełnienie liczone w % przy małym progresie (świeżo zaczęta/długa misja)
przeliczało się na węższą szerokość niż promień lewego zaokrąglonego kapsla (17px) — Android
nie przycinał tego poprawnie, cienki kwadratowy pasek gradientu wystawał poza zaokrąglony
kształt. Fix: nowa `missionBarFillPx()` (`missions.ts`) liczy wypełnienie w PX z twardym
minimum `MISSION_BAR_HEIGHT`, `missionBarTrack` mierzy się przez `onLayout`. Pełny opis w
ARCHITECTURE.md. Nowe testy w `fmtMissionCountdown.test.ts`. `tsc`/`jest` zielone (63/759).
**Priorytet testu na urządzeniu**: pupil w trakcie świeżo zaczętej (albo bardzo długiej,
niedawno wysłanej) misji — pasek powinien mieć czysty, zaokrąglony lewy kapsel bez cienkiego
paska wystającego poza krawędź, nawet przy minimalnym progresie.

## 🆕 BUG: dotyk kotka po powrocie z misji tylko głaskał, nie zaczynał walki — NIEsprawdzone (2026-08-27)

User: "jak pupil wraca z misji to musisz zrobić zeby wtedy kliknięcie na kotka rzeczywiście
przenosilo do walki bo teraz i tak trzeba kliknąć walcz w kafelku misji". Przyczyna: `CatArt`
opakowuje się wewnętrznie we własny `Pressable`, który ZAWSZE przechwytywał dotyk, zanim zdążył
wybąblować do zewnętrznej `TouchableOpacity` z `onFightMission` — więc w praktyce cały widoczny
obszar kotka był dla tego martwy. Fix: `onPress={onFightMission}` wprost na `CatArt` w tym
miejscu. Pełny opis w ARCHITECTURE.md ("BUG: dotyk kotka NIE wywoływał walki"). `tsc`/`jest`
zielone (63/754, bez nowych testów — czysto UI-owy fix wiązania dotyku, nic do przetestowania
jednostkowo w tym projekcie). **Priorytet testu na urządzeniu**: dokończ misję pupila, wróć na
ekran Pupil (przygaszony kotek + pulsujący napis "Naciśnij, aby zawalczyć") — dotknięcie
BEZPOŚREDNIO kotka powinno teraz przenosić od razu do walki, bez konieczności scrollowania do
przycisku "Walcz" w kaflu misji niżej.

## 🆕 Kafel pupila: PetTileCat PORZUCONY, wrócony do zwykłego CatArt — NIEsprawdzone (2026-08-27)

User ze screenshotem: "co ty z tym pupilem odjebałem teraz jak pulpet wygląda ja pierdółek".
`PetTileCat.tsx` (nowy dedykowany komponent z ręcznie rysowanym SVG, wprowadzony ten sam dzień
wcześniej) wyglądał źle — ręcznie wymyślone współrzędne bez prawdziwego artu jako punktu
wyjścia nigdy nie miały prawa dać dobrego rezultatu na poziomie detalu "twarz maskotki". Plik
USUNIĘTY, `PetTile.tsx` wrócony do DOKŁADNIE oryginalnego renderu sprzed CAŁEJ serii
eksperymentów (PR #84→#88→#89→#98): zwykły pełny `<CatArt size={70} animate={false} .../>`.
Pełny opis w ARCHITECTURE.md. **Priorytet testu na urządzeniu**: dashboard → kafel pupila
wygląda jak przed 2026-08-25 (mały, pełna sylwetka kota, nie przycięty). Jeśli user kiedyś
zechce wrócić do pomysłu "łapki na krawędzi kafelka" — potrzebny realny art/screenshot jako
referencja, nie kolejna próba rysowania SVG od zera.

## 🆕 Streak BUG FIX #3: dashboard 29 vs habit-year 33 — NIEsprawdzone (2026-08-27)

User ze screenshotem: "streak znowu odwala gówno, pokazuje mi na dashboardzie 29 dni mimo że
mam 33 jak wejdę". TRZECI fix w tej samej rodzinie bugów (patrz ARCHITECTURE.md "BUG:
`getStreak()`..." #1/#2/#3) — tym razem `getStreak()`'s pętla była już poprawna (bez sztywnego
limitu, fix #2), ale `useHabits.ts`'s `load()` wczytywało do pamięci TYLKO 30 dni danych, więc
seria dłuższa niż 30 dni fizycznie nie miała skąd się wziąć. Fix: `LOAD_WINDOW_DAYS=371`
(ten sam rok co `habit-year.tsx`) + nowy batchowany `getCountsRange()` (jeden `AsyncStorage.
multiGet` zamiast 371 pojedynczych odczytów, żeby szersze okno nie kosztowało wydajnościowo).
Nowe testy w `habits.test.ts`. `tsc`/`jest` zielone. **Priorytet testu na urządzeniu** (wysoki
— to już TRZECIA naprawa tego samego bugu): dashboard "Twoje serie" → "Woda" powinno pokazywać
DOKŁADNIE tę samą liczbę co ekran szczegółów nawyku (habit-year), nawet dla serii >30 dni.

## 🆕 "Nieodebrane z wczoraj" rozszerzone na kilka dni wstecz — NIEsprawdzone (2026-08-27)

User: "problem z odbiorem questów nieodebranych z dnia wcześniejszego jakby czy co tam".
Znaleziony realny gap: catch-up questów sięgał TYLKO jeden dzień wstecz (wczoraj) — przerwa
dłuższa niż doba w otwieraniu apki bezpowrotnie gubiła zapracowane nagrody. Teraz sięga 6 dni
wstecz (`RECENT_DAYS_BACK` w `usePetHealthSync.ts`). Pełny opis w ARCHITECTURE.md (sekcja
`"Nieodebrane z wczoraj" → wielodniowy catch-up`). Nowy test w `quests.test.ts`. `tsc`/`jest`
zielone (63/750). **Priorytet testu na urządzeniu**: zakładka Zadania — jeśli masz zaległy
quest sprzed >1 dnia (np. nie otwierałeś apki 2-3 dni), powinien pojawić się w "Nieodebrane z
poprzednich dni" z etykietą "N dni temu", nie tylko wczorajsze.

## 🔴 NIEROZWIĄZANE: woda z zegarka czasem nie liczy się do questu — czeka na diagnostykę usera (2026-08-27)

User: "problem z tymi questami od kotka, że woda sie nie ładuje mimo ze na zegarku mam 2l juz
ogarniete". Zbadane: `waterToday`/`getWaterGlasses()` NIE czyta bezpośrednio z zegarka — czyta
z lokalnego habitu "Woda", który jest KARMIONY z Health Connect (`feedWaterHabit`, w
`healthAutoSync.ts`) TYLKO jeśli Health Connect ma rekordy typu `Hydration` (albo, jako
fallback, `Nutrition`). Komentarz w `healthAutoSync.ts` (sprzed tej sesji) już to
dokumentował: "Watch dostarcza wodę tylko jeśli logujesz ją w Samsung Health — bez tego nie ma
czego leczyć". To może NIE być bug w tej apce, tylko upstream ograniczenie Health Connect/
Samsung Health (nie każdy sposób logowania wody na zegarku faktycznie eksportuje `Hydration`
do Health Connect). Apka ma już GOTOWE narzędzie diagnostyczne dokładnie pod ten problem:
Zdrowie → stuknij licznik wody → "Diagnostyka wody z zegarka" (`probeHydration`,
`app/(tabs)/health.tsx`) — sprawdza permission + realne rekordy Hydration/Nutrition i daje
konkretny werdykt (brak dostępu / dane są ale w Nutrition nie Hydration / Samsung w ogóle nie
eksportuje). User poproszony o odpalenie tego i przesłanie wyniku — DOPIERO wtedy da się
wiedzieć czy jest coś do naprawienia w kodzie, i co dokładnie (np. jeśli dane siedzą w
Nutrition, trzeba podłączyć czytanie stamtąd — kod diagnostyczny już to przewiduje w
komentarzu werdyktu). "Problem z zaczynaniem apki" (user) niezweryfikowany — może być tym samym
(pierwszy render przed dociągnięciem synchronizacji pokazuje stary/pusty stan, ale
`usePetHealthSync.reload()` i tak re-czyta po zakończeniu `autoSyncHealth` — brak dowodu że to
osobny bug, na razie zakładamy że to ten sam efekt braku danych Hydration).

## 🆕 Kafel pupila: NOWY dedykowany komponent (PetTileCat) zamiast crop-hacka — NIEsprawdzone (2026-08-27)

User: "kafelek nadal nie jest dobrze nadal jest za duzy wróć go do tego jaki był... kotka
możesz zrobic wersje osobna... po prostu głowa lekko tułów dwie łapki trzymające krawędź
kafelka jakby jak pokazywałem i animacje samych oczu zrobimy i uszka i tyle". Cała technika
"przytnij pełny CatArt przez overflow:hidden" (PR #84/#88/#89) PORZUCONA — Android
view-flattening gubił przycinanie mimo `collapsable={false}`, a nawet gdyby działało, wynik
był za duży. Nowy `src/components/pet/PetTileCat.tsx` — osobny, prosty komponent z WŁASNYM
małym viewBoxem (nie crop 2000×2000 CatArt), głowa+tułów+łapy na krawędzi, animowane TYLKO oczy
(mrugnięcie) i uszy (delikatny ruch), reszta CatArt (głaskanie/pazur/ogon) świadomie pominięta.
`PetTile.tsx` renderuje `<PetTileCat size={72} .../>` bez żadnego `overflow:hidden`/
`collapsable`. Pełny opis w ARCHITECTURE.md. `tsc`/`jest` zielone (brak testów komponentów w
tym projekcie — nie da się przetestować renderu automatycznie). **Priorytet testu na
urządzeniu** (wysoki — to już TRZECIA próba tego kafla): dashboard → kafel pupila —
(a) rozmiar rozsądny, nie dominuje wiersza obok tekstu, (b) widać głowę+łapki na krawędzi (nie
crop-artefakty jak poprzednio), (c) oczy mrugają, uszy od czasu do czasu drgają.

## 🆕 Precyzja 0.1% na statach bojowych (unik/kryt/energyMult) — NIEsprawdzone (2026-08-26)

User: "te statystyki jak atak unik itp musimy pokazywać 0.1 dokladnosci". `pet.tsx` (Unik/Kryt/
Prób dziennie z łupu) i `bossProgressReport.ts` zaokrąglały do pełnego procenta mimo że
`fmtGearStat` (per-item w GearPanel/podglądzie) już pokazywał 0.1% — teraz spójne wszędzie.
`tsc`/`jest` zielone.

## 🆕 Miniboss roster odświeżony: koza/wieloryb→wilk/grizzly/osa — NIEsprawdzone (2026-08-26)

Koza/wieloryb usunięte z `MINIBOSSES` (user chciał świeżości w rotacji questowej — "koza jest,
koza wywalamy"), wilk (`mb_wilk`) i grizzly (`mb_grizzly`) dodane z `attackKind:'claw'` (naprawia
fallbackową czerwoną pięść `HandFist` o którą user pytał osobno), osa (`mb_osa`) dodana bez
attackKind (plik bez jednoznacznego typu ataku, user nie sprecyzował). User wrzucił własny art
bezpośrednio na branch (GitHub web upload) do `assets/ikonybosów/` — `bossIcons.ts` wskazuje
tam, NIE na `assets/minibosses/` jak reszta minibossów. Tym samym uploadem podmienił
`helm_slomiany.png`/`helm_skorzany.png` na nowy art (bez zmian w kodzie, te ścieżki już
istniały). `tsc`/`jest` zielone (+2 testy na roster). **Priorytet testu na urządzeniu**: quest
dzienny "Walcz" i misja pupila — wilk/grizzly/osa powinny się teraz pojawiać w rotacji zamiast
kozy/wieloryba, wilk i grizzly powinny mieć w kontrataku ikonę pazura (`HandGrab`), nie
czerwoną pięść.

Talizmany (gwiazda/księżyc/piórko/nieskończoność) z tego samego screenshota usera NIE zostały
jeszcze wrzucone — nieblokujące, tylko PODMIENIAJĄ już istniejące pliki w
`assets/ekwipunek/talizman/`, do zrobienia kiedy wygodnie (⚠️ `talizman_nieskonczonosci.png` →
zmień na `talizman_nieskonczonosc.png`, bez "i" na końcu, kod czyta dokładnie tę nazwę).

## 🆕 Kontratak: prawdziwe PNG zamiast lucide + nowy typ 'fire' + więcej pazurów — NIEsprawdzone (2026-08-26)

User odpowiedział na listę bossów: "ta pięść jest zdecydowanie za często" + konkretne
przypisania. Zrobione: (1) `assets/ikonybosów/BOSSATTACK_*.png` (leżały nieużywane od 13.08)
podłączone jako PRAWDZIWY kontratak zamiast generycznych, kolorowanych ikon lucide — nowy
`attackPng()`/`ATTACK_PNG`/`FIST_PNG` w `bossIcons.ts`, `boss-fight.tsx` renderuje `<Image>`
zamiast `HandFist`/`HandGrab`/`Sparkles`/`Sword`; (2) nowy 4. `AttackKind = 'fire'`
(`BOSSATTACK_FIRE.png`) — TYLKO smok (`dragon`); (3) `claw` dodane do węża kampanii (`snake`),
ary (`mb_macaws`) i węża questowego (`mb_snake`); sword (pirat+samuraj) dzieli JEDEN plik
`BOSSATTACK_priateattack_blade.png`, zgodnie z sugestią usera. Pełny opis w ARCHITECTURE.md
(sekcja "PNG zamiast generycznych ikon lucide..."). Nowe testy (+3: `bosses.test.ts` wąż/smok,
`minibosses.test.ts` ara/wąż). `tsc`/`jest` zielone (63/749). **Priorytet testu na urządzeniu**:
walka z wężem/smokiem/arą (kampania/miniboss) — kontratak powinien pokazywać RYSOWANĄ grafikę
(pazury/ognista kula), nie kolorową ikonę-kreskę; smoczy kontratak lecący jako pocisk (fire NIE
jest wyjątkiem jak claw, więc leci tak jak magia/miecz/pięść, nie pojawia się burstem na kotku).

User zapowiedział, że resztę rosteru (kampania: sugar/scroll/stress/junk/burnout/insomnia/
compare/drought/procrast/devourer; raid: behemoth/wyrm/siren; sezonowe: wszystkie 8;
pozostałe minibossy: capybara/duck/shark/osa) będzie dorzucał STOPNIOWO w kolejnych turach —
minibossy poza wilkiem/grizzly/osą uważa za TYMCZASOWE i sam je podmieni własnym artem.

## 🆕 Pasek misji ODWRÓCONY: kotek w miejscu, dokładny licznik M:SS na pasku — NIEsprawdzone (2026-08-26)

User: "zróbmy na odwrót jego spacerujacego w miejscu tam gdzie jest czas teraz, i on będzie
miał te animacje tyle że w miejscu, a zamiast niego w pasku będzie dokładny czas w minutach i
sekundach jakiś ładny licznik". Kotek przestał jeździć po pasku (`left: progress%`) — teraz stoi
w `missionHeadRow` (prawa strona, gdzie dawniej był statyczny tekstowy timer), z tymi samymi
animacjami wejścia (`missionEnter`) i chodu-w-miejscu (`missionSway`). Pasek pokazuje nowy
`fmtMissionCountdown` (M:SS/H:MM:SS, tyka co sekundę — `missionTick`'s interval przyspieszony z
30s na 1s, z auto-stopem po ready). Pełny opis w ARCHITECTURE.md (sekcja "ODWRÓCONE: kotek stoi
w miejscu..."). Nowy test `__tests__/fmtMissionCountdown.test.ts` (+5). `tsc`/`jest` zielone
(62/744). **Priorytet testu na urządzeniu**: pupil w trakcie misji — (a) kotek w prawym rogu
nad paskiem powinien "chodzić w miejscu" (przechył + krok w bok, ta sama animacja co dawniej),
NIE jeździć po pasku, (b) na samym pasku licznik powinien realnie tykać co sekundę (M:SS, a przy
misjach >1h w formacie H:MM:SS), (c) wypełnienie paska + fala "ładowania" nadal wizualizują
postęp jak wcześniej.

## 🆕 BUG: "NAJCZĘŚCIEJ KUPOWANE" liczyło linie paragonu, nie sztuki — NIEsprawdzone (2026-08-26)

User: "wydaje mi się ze liczy ile razy coś kupiłem ale nie bierze pod uwagę ile sztuk na
każdym paragonie tego kupilem". Potwierdzony bug — `count[key] += 1` za każdą linię
`receiptItems`, ignorując `it.quantity`. Kupno 5 mlek na jednym paragonie liczyło się jako 1,
nie 5. Naprawiony wzorzec (już istniejący w `exportAnalysis.ts`, teraz też tu):
`Math.max(1, Math.round(it.quantity || 1))`. Naprawione w 3 miejscach: dashboardowe
`topProducts` (`app/(tabs)/index.tsx`, karta "Najczęściej kupowane"), `metricList` w
`statWidgets.ts` (widget "Top produkty"/"Ulubione słodycze" w kreatorze statystyk) i katalog
`app/products.tsx`. Nowy test regresji `__tests__/topProductsQuantity.test.ts` (+3). `tsc`/
`jest` zielone (62/739). **Priorytet testu na urządzeniu**: dashboard → karta "Najczęściej
kupowane" — jeśli kupujesz np. 3-5 sztuk tego samego produktu na jednym paragonie, licznik
powinien teraz pokazywać sumę sztuk ze wszystkich paragonów, nie liczbę paragonów na których
się pojawił.

## ✅ Setup zdalnego dostępu (claude.ai/code z telefonu) — DZIAŁA

Ta sesja jest dowodem że dostęp działa (repo `sapp` dostępne z claude.ai/code). Jeśli kiedyś
znów przestanie działać, punkt startowy diagnozy: github.com → avatar → Settings →
Applications → Installed GitHub Apps → apka Claude/Anthropic → Configure → Repository access.

## 🆕 Rozbicie index.tsx: krok 5/wiele — SleepChartCard wyciągnięte — NIEsprawdzone (2026-08-26)

Kontynuacja po "dawaj dalej optymalizować". Różni się od kroków 1-4: `nodes['sleep-chart']`
było ternary (`warunek ? x : y`), nie `warunek && (...)`, więc NIGDY nie było `false` —
guard NIE zostaje w `index.tsx`, cała logika (wykres + pusty stan) przeniesiona do
`SleepChartCard.tsx`, wołana bezwarunkowo. Stan `sleepDashRange` (toggle Tydzień/Miesiąc)
zostaje w `index.tsx`. Pełny opis w ARCHITECTURE.md §4. `tsc`/`jest` zielone (61/736).
**Priorytet testu na urządzeniu** (razem z krokami 1-4): karta "Sen" na dashboardzie —
wykres słupkowy (przełącznik Tydzień/Miesiąc działa), oraz pusty stan (jeśli akurat brak
danych o śnie z zegarka) wyglądają identycznie jak przed zmianą.

## 🆕 BUG: zakup posiadanego itemu w Sklepie dnia zabierał monety za nic — NIEsprawdzone (2026-08-26)

User: "kupiłem item w sklepie który już miałem przez co zniknęły mi pieniądze i nic nie
dostałem" + "powinno pokazywać że mam i po naciśnięciu powinny byc staty itemu porównanie z
innymi i pod spodem przycisk kup, lub jak mam posiadasz ten przedmiot". Znaleziony realny bug:
`petStore.buyDailyGear()` zawsze pobierało monety i zużywało dzienny slot zakupu nawet gdy
gracz JUŻ posiadał ten item w tej samej lub lepszej rzadkości (aktualizacja `ownedGear` była
wtedy pomijana, ale zapłata NIE). Podgląd statów+porównania+przycisku kup w `GearPreviewModal`
JUŻ ISTNIAŁ (dodany 2026-08-22) — ale nie sprawdzał ogólnego posiadania, tylko "czy kupione
DZIŚ", więc item posiadany z wcześniejszego dnia/skrzynki wyglądał jak normalny do kupienia.
Fix: (1) `buyDailyGear` odrzuca zakup PRZED zmianą stanu gdy `alreadyHave`, (2) lista + modal
pokazują ✓/"Posiadasz ten przedmiot" zamiast przycisku "Kup" w tym stanie. Pełny opis w
ARCHITECTURE.md (sekcja "BUG: zakup posiadanego itemu..."). `tsc`/`jest` zielone (61/736, +6
nowych testów `buyDailyGear.test.ts` — bezpośrednio na akcji store'u, nie tylko czystej
logice). **Priorytet testu na urządzeniu**:
(a) sklep pupila → Sklep dnia — jeśli któryś z 3 dzisiejszych itemów już posiadasz (z wcześniej
albo ze skrzynki), powinien pokazywać ✓ zamiast przycisku "Kup" na liście,
(b) stuknij w taki posiadany item — podgląd powinien pokazać "Posiadasz ten przedmiot" zamiast
przycisku "Kup za X",
(c) spróbuj kupić coś co NIE jest posiadane — normalny zakup dalej powinien działać (monety
znikają, item się pojawia w ekwipunku),
(d) jeśli masz jakiś stary zapis gdzie monety już zniknęły przez ten bug — przepraszam, nie da
się tego cofnąć retroaktywnie (nie wiadomo ile razy/kiedy to się stało), ale od teraz nie
powinno się już powtórzyć.

## 🆕 Rozbicie index.tsx: krok 4/wiele — GCalCard wyciągnięte — NIEsprawdzone (2026-08-26)

Kontynuacja tym samym wzorcem: `nodes['gcal']` → `GCalCard.tsx`. Pełny opis w
ARCHITECTURE.md §4. `tsc`/`jest` zielone (60/730). **Priorytet testu na urządzeniu** (razem z
krokami 1-3 — jeden komunikat wystarczy jeśli wszystkie wyglądają dobrze): kafel "Google
Kalendarz" na dashboardzie (jeśli masz połączone konto Google) wygląda identycznie jak przed
zmianą — sekcje "Dziś"/"Jutro" z kropką koloru wydarzenia, godziną, tytułem; w edytorze
dashboardu, bez wydarzeń, sekcja pokazuje "brak danych".

## 🆕 Rozbicie index.tsx: krok 3/wiele — SinceCountersCard wyciągnięte — NIEsprawdzone (2026-08-26)

Kontynuacja po "możesz dalej optymalizować". Ten sam wzorzec co kroki 1-2:
`nodes['counters-since']` → `SinceCountersCard.tsx`. Przy okazji usunięty pre-istniejący,
niezwiązany martwy styl `sinceTileDays` (nigdzie się nie renderował nawet przed tą zmianą).
Pełny opis w ARCHITECTURE.md §4. `tsc`/`jest` zielone (60/730). **Priorytet testu na
urządzeniu** (razem z krokami 1-2 — jeden komunikat wystarczy jeśli wszystkie 3 wyglądają
dobrze): kafel "Liczniki" na dashboardzie (jeśli masz jakieś liczniki typu "bez X") wygląda
identycznie jak przed zmianą — największa seria jako bogata karta (płomień + pasek Pn-Nd),
reszta jako siatka mniejszych kafelków z płomieniem; w edytorze dashboardu, bez liczników,
sekcja pokazuje "brak danych".

## 🆕 BUG: przycinanie kotka na kaflu pupila NIE DZIAŁAŁO — próba fixu, NIEpotwierdzona (2026-08-26)

User na buildzie #842 (potwierdzone: najnowszy build, nie stary) zgłosił że kotek na kaflu
pupila renderuje się jako PEŁNA sylwetka (z ogonem!), nie przycięta głowa+łapki — mimo że
poprzedni wpis (niżej, "Powiększone ~1.8×") miał poprawną matematykę kadru. Ogon leżący daleko
poza zamierzonym oknem był mocnym dowodem że `overflow:'hidden'` na kontenerze przycinającym
w ogóle nie działał — nie błąd w liczbach, tylko w mechanizmie przycinania. Prawdopodobna
przyczyna: znany Android/RN gotcha — zwykły `View` tylko-do-stylu bywa "spłaszczany" przez
natywną optymalizację i traci wtedy `overflow:hidden`. Fix: `collapsable={false}` na obu
`View`ach kadru w `PetTile.tsx`. Pełny opis w ARCHITECTURE.md §4. **To hipoteza, NIE
potwierdzona jeszcze na urządzeniu** — `tsc`/`jest` nie może tego zweryfikować (czysto
natywny problem renderowania). **Priorytet testu na urządzeniu** (kluczowe, to DRUGA
nieudana próba z rzędu):
(a) kafel pupila na dashboardzie — czy TERAZ kotek jest faktycznie przycięty do
głowy+uszu+łapek (bez ogona, bez pełnego ciała), czy nadal renderuje się cały,
(b) jeśli TO DALEJ NIE DZIAŁA — nie próbuję trzeciej blindowej poprawki tej samej techniki.
Następny krok to porzucenie "przytnij przez overflow:hidden" na rzecz zwykłego,
nieprzyciętego (ale większego) kotka — gwarantowanie działający wzorzec używany wszędzie
indziej w apce, kosztem rezygnacji z efektu "sama głowa nad krawędzią". Powiedz jeśli tak
wolisz zamiast dalszego dłubania w przycinaniu.

## 🆕 Kafel pupila: głowa kotka powiększona ~1.8× — NIEsprawdzone (2026-08-25)

User przesłał screenshot dashboardu z odręcznym szkicem (narysowanym NA screenshocie) znacznie
większej, bardziej "chudnej"/wypełniającej kafel głowy kotka obok imienia: "o tak o chciałem
ten kafelek". Poprzednia wersja (patrz wpis PR #84 wyżej w historii) miała kadr `CROP_W×CROP_H
= 54×78` — teraz powiększone do `97×140` (~1.8× liniowo), te same proporcje/matematyka kadru
(uszy→łapki), tylko większe okno. Pełny opis w ARCHITECTURE.md §4 (sekcja "Kolor kafla serii +
głowa kotka powiększona"). `tsc`/`jest` zielone (czysto wizualna zmiana). **Priorytet testu na
urządzeniu**: kafel pupila na dashboardzie — czy rozmiar kotka TERAZ pasuje do tego co
narysowałeś (znacznie większy, bardziej dominujący w kaflu)? Jeśli dalej za mały/za duży albo
zły kadr — powiedz w którą stronę, to znowu tylko cztery liczby (`CROP_SIZE`/`CROP_W`/
`CROP_H`/`CROP_TOP`/`CROP_LEFT` w `PetTile.tsx`) do doregulowania, szybka poprawka.

## 🆕 Misja: przygaszony kotek na scenie + prompt "zawalcz" (widoczność) — NIEsprawdzone (2026-08-25)

User: "chciałbym żeby to że muszę zawalczyć było bardziej widoczne żeby zakończyć misję" →
doprecyzował konkretny pomysł ("kotek WRACA do NORMALNEGO ROZMIARU ale cały jest w CIENIU (jak
nieznane bossy) z napisem NACIŚNIJ ABY ZAWALCZYĆ") — zaimplementowane dokładnie tak. Po
ukończeniu misji (`missionReady`) kotek na scenie `/pet` wraca do normalnego rozmiaru,
przygaszony (`opacity: 0.3`) + pulsujący napis "Naciśnij, aby zawalczyć i zakończyć misję" nad
nim, cały blok jest jednym tap-targetem do walki (dodatkowy do istniejącego przycisku "Walcz" w
kaflu misji, ten drugi zostaje bez zmian). Pełny opis w ARCHITECTURE.md §9 (sekcja "Misja
pupila"). `tsc`/`jest` zielone (to czysto wizualna zmiana, bez nowych testów jednostkowych).
**Priorytet testu na urządzeniu**:
(a) wyślij pupila na krótką misję (albo poczekaj aż zakończy trwającą) — po powrocie kotek na
scenie powinien być normalnego rozmiaru, ale wyraźnie przygaszony, z pulsującym napisem nad nim,
(b) stuknij w przygaszonego kotka (gdziekolwiek na nim) — powinno przenieść do walki z
minibossem misji (`/boss-fight?kind=mission`), tak samo jak przycisk "Walcz" w kaflu niżej,
(c) subiektywnie: czy TERAZ jest wystarczająco widoczne że trzeba zawalczyć, czy nadal łatwo
przegapić? Jeśli nadal za mało widoczne — na stole jest jeszcze pomysł dopisania gotowej misji
do licznika "X nagród do odbioru" na kaflu pupila na DASHBOARDZIE (widoczne bez wchodzenia w
`/pet` w ogóle) — zaproponowany, nie zrobiony, powiedz jeśli chcesz żebym to dodał.

## 🆕 Rozbicie index.tsx: krok 2/wiele — CountdownsCard wyciągnięte — NIEsprawdzone (2026-08-25)

Kontynuacja kroku 1 (niżej) po "dawaj dalej". Ten sam wzorzec, druga sekcja:
`nodes['countdowns']` → `CountdownsCard.tsx`. Guard `.length > 0 &&` znów zostawiony w
`index.tsx`. Pełny opis w ARCHITECTURE.md §4. `tsc`/`jest` zielone (60/730). **Priorytet testu
na urządzeniu** (razem z krokiem 1 — nie trzeba osobno potwierdzać, jeśli oba wyglądają dobrze
naraz, to jeden komunikat wystarczy):
(a) kafel "Odliczania" na dashboardzie (jeśli masz jakieś aktywne liczniki/odliczania) wygląda
identycznie jak przed zmianą — nazwa, "za N dni"/"dziś!"/"jutro!"/"koniec za..." dla
wydarzeń w trakcie, pasek postępu (WalkProgress) z emoji,
(b) edytor dashboardu: bez aktywnych odliczań sekcja pokazuje "brak danych" (ten sam gotcha co
przy kroku 1).

## 🆕 Rozbicie index.tsx: krok 1/wiele — PinnedNotesCard wyciągnięte — NIEsprawdzone (2026-08-25)

Trzecia (i najbardziej ryzykowna) z trzech rzeczy z "co byś jeszcze zoptymalizował?" →
"zapisz wszystko i wszystko rob". `index.tsx` (~5400 linii) rozbijane na mniejsze komponenty —
większy potencjalny zysk niż pozostałe dwie zmiany, ale też największe ryzyko: bez testów
renderu komponentów w tym projekcie, subtelna regresja wizualna przejdzie przez `tsc`/`jest`
bezobjawowo. Dlatego **celowo mały, pojedynczy krok**, nie hurtowy refaktor: `nodes['pinned-
notes']` wyciągnięte 1:1 do `PinnedNotesCard.tsx`, guard `.length > 0 &&` ZOSTAŁ w `index.tsx`
(złapany PRZED shipowaniem realny gotcha: edytor dashboardu czyta `nodes[id]`'s truthiness
żeby oznaczyć "brak danych" — pełny opis w ARCHITECTURE.md §4). `tsc`/`jest` zielone, ale to
NIE dowodzi że wygląda tak samo — **priorytet testu na urządzeniu, i to zanim pójdę dalej z
kolejnymi sekcjami**:
(a) kafel "Przypięte notatki" na dashboardzie wygląda DOKŁADNIE tak samo jak przed zmianą
(odstępy, kolory, tap na notatkę → `/notes?noteId=`, "Wszystkie notatki →" na dole),
(b) edytor dashboardu (ołówek): usuń wszystkie przypięte notatki, wejdź w edytor — sekcja
"Przypięte notatki" powinna pokazać "brak danych" tak jak inne puste sekcje (to konkretnie ten
gotcha, który złapałem przed wysłaniem — ale warto potwierdzić na żywo),
(c) jeśli (a) i (b) są OK — daj znać, to zielone światło żeby kontynuować rozbijanie kolejnych
sekcji tym samym wzorcem (opisanym w ARCHITECTURE.md, do powielenia); jeśli coś nie gra, lepiej
się dowiedzieć teraz, na JEDNEJ małej sekcji, niż po rozbiciu dziesięciu.

## 🆕 Optymalizacja: throttled zapis Zustand→AsyncStorage (18 store'ów) — NIEsprawdzone (2026-08-25)

User: "a okiem specjalisty co byś jeszcze zoptymalizował?" → dałem 3 rzeczy → "zapisz wszystko
i wszystko rob". Pierwsza (i najbardziej konkretna): `persist` Zustanda zapisywał do
AsyncStorage przy KAŻDEJ zmianie stanu (pełny JSON.stringify + zapis), nie tylko na starcie —
np. podczas walki z bossem/raidem to kilka zapisów na rundę. Naprawione: wszystkie 18 store'ów
(`src/store/*.ts`) przez nowy `throttledAsyncStorage()` (`utils/throttledStorage.ts`) —
koalescuje zapisy do tego samego klucza, przeżywa tylko ostatnia wartość po ~600ms ciszy.
Zabezpieczone dwiema stronami: backup (`backupService.gatherSnapshot`) flushuje PRZED
odczytem surowych kluczy, `_layout.tsx` flushuje przy każdym wyjściu apki w tło. Pełny opis w
ARCHITECTURE.md §10. `tsc`/`jest` zielone (60/730, +6 nowych testów `throttledStorage.test.ts`
symulujących fake timers). **Priorytet testu na urządzeniu** (to jest zmiana infrastrukturalna,
subtelny bug tu byłby UTRATĄ DANYCH, więc test jest ważny):
(a) normalne używanie apki (dodaj wydatek, zaznacz nawyk, zmień coś w ustawieniach) — czy
WSZYSTKO nadal się zapisuje i przeżywa zamknięcie+ponowne otwarcie apki (nie tylko przełączenie
zakładki — realne zamknięcie),
(b) zrób coś, poczekaj WYRAŹNIE ponad sekundę, dopiero wtedy zamknij apkę (swipe z listy
ostatnich) — sprawdź że ta zmiana przetrwała,
(c) zrób backup (Ustawienia → kopia zapasowa) zaraz po jakiejś zmianie — sprawdź że backup ma
najświeższe dane, nie sprzed chwili,
(d) walka z bossem/raidem — subiektywnie: czy w trakcie walki czuje się płynniej niż wcześniej
(to był główny cel tej zmiany — dużo zapisów na rundę).

## 🆕 Optymalizacja: log wydajności startu apki (Diagnostyka) — NIEsprawdzone (2026-08-25)

Druga z trzech rzeczy z tej samej rozmowy o dalszej optymalizacji — zamiast zdalnego profilera
(niedostępny tutaj), prosty licznik czasu startu na SAMYM urządzeniu, żeby dało się porównać
build-do-buildu czy zmiany faktycznie coś dają, zamiast zgadywać. Nowy `utils/perfLog.ts`
loguje `msToFirstFrame`/`msToReady` (czas od startu JS do pierwszej klatki dashboardu / do
pełnego załadowania ze wszystkimi widgetami) przy KAŻDYM cold-starcie, bufor ostatnich 20.
Odczyt: Ustawienia → Diagnostyka → "Wydajność startu apki". Pełny opis w ARCHITECTURE.md §10.
`tsc`/`jest` zielone (+6 nowych testów `perfLog.test.ts`). **Priorytet testu na urządzeniu**:
(a) otwórz apkę od zera (nie przełącz zakładkę) kilka razy w różnych sytuacjach (np. zaraz po
restarcie telefonu vs. apka już "rozgrzana" w tle systemu) — sprawdź w Diagnostyce że liczby
się zapisują i wyglądają sensownie (nie zera, nie absurdalnie duże),
(b) PO TYM jak zbierzesz kilka realnych startów — prześlij mi zrzut z Diagnostyki (albo po
prostu liczby) żebym miał punkt odniesienia do dalszych optymalizacji zamiast zgadywać.

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

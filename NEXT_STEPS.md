# Co dalej — stan na 2026-08-14

Ten plik to zrzut z sesji na PC przed przejściem na zdalną pracę z telefonu (claude.ai/code).
Aktualizuj/kasuj pozycje w miarę ogarniania, nie zostawiaj martwych wpisów.

## ✅ Setup zdalnego dostępu (claude.ai/code z telefonu) — DZIAŁA

Ta sesja jest dowodem że dostęp działa (repo `sapp` dostępne z claude.ai/code). Jeśli kiedyś
znów przestanie działać, punkt startowy diagnozy: github.com → avatar → Settings →
Applications → Installed GitHub Apps → apka Claude/Anthropic → Configure → Repository access.

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
   wygrane walki kampanii (sloth ~7 ciosów, sugar guard ~14, snake ~8) — user: "zdecydowanie
   za szybko to poszło, pokonałem 3 bossy od zera nie mając nic praktycznie". To PASUJE do
   zwalidowanego projektu (9-12 ciosów, ~100% winrate przy lekkiej inwestycji dla bossów
   #1-13) — nie jest to bug, ale user nadal odczuwa to jako za łatwe. NIE dotknięte w tym
   przejściu (kolejny fix guard-bugu + podbicie HP dopiero co wylądowały, dawanie im chwili
   przed kolejną rundą podbijania) — jeśli po zagraniu z pełną rundową walką raidu/nowymi
   pazurami user nadal chce mocniej podbić wczesną kampanię, kolejny krok: zwiększyć
   `earlyHits` docelowy zakres w `BOSSES` (obecnie 9→12) i przewalidować throwaway-symulacją
   jak poprzednio (patrz komentarz nad `BOSSES` w bosses.ts).

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

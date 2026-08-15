# Co dalej — stan na 2026-08-14

Ten plik to zrzut z sesji na PC przed przejściem na zdalną pracę z telefonu (claude.ai/code).
Aktualizuj/kasuj pozycje w miarę ogarniania, nie zostawiaj martwych wpisów.

## ✅ Setup zdalnego dostępu (claude.ai/code z telefonu) — DZIAŁA

Ta sesja jest dowodem że dostęp działa (repo `sapp` dostępne z claude.ai/code). Jeśli kiedyś
znów przestanie działać, punkt startowy diagnozy: github.com → avatar → Settings →
Applications → Installed GitHub Apps → apka Claude/Anthropic → Configure → Repository access.

## 🐛 "Zgubione" itemy z bossów — WYJAŚNIONE, nie bug (2026-08-14)

User pytał czemu nie ma Kryształu Cukru / Poduszki Leniwca po pokonaniu pierwszych bossów.
Odpowiedź: dane są całe (id itemu trwały w `ownedItems`, bonus liczony po id w `bossBonuses()`),
tylko **ekran gabloty trofeów został wywalony 12 sierpnia** (razem z pokojem pupila), więc nie
było już gdzie zobaczyć co się ma po nazwie. Dodatkowo "Poduszka Leniwca" (łup z Kanapowego
Leniwca) tego samego dnia dostała reflavor na "Iskra Poranka" ⚡ — id (`loot_pillow`) zostało,
tylko nazwa się zmieniła (patrz komentarz w `src/utils/bosses.ts` przy definicji bossa `sloth`).

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
- ~~6 bossów rajdowych bez artu~~ — 2026-08-15: pożyczają PNG z kampanii + czerwona aura
  (`powered` prop w `BossArt`), patrz ARCHITECTURE §"Art rajdowych bossów". Kosmetyczny
  stopgap, nie docelowy dedykowany art — jeśli kiedyś ktoś narysuje 6 unikalnych bossów,
  wystarczy dopisać je do `BOSS_PNG` pod tymi samymi id i usunąć `powered` z 3 wywołań
  `BossArt`. **NIEsprawdzone na urządzeniu** — priorytet: otwórz Bossy, sprawdź czy karta
  RAID ma czerwoną poświatę i nie wygląda jak zwykły recolor bez sensu.
- 1 portret event-bossa wciąż bez prawdziwego artu (placeholder/emoji).
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

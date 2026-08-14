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

## 💡 Pomysł: questy jako travel-pointy z minibossami (2026-08-14, NIE zaimplementowane)

User: kroki → "idziesz" do punktu na mapie, tam miniboss. User doda grafiki zwierząt do
folderu `MINIBOSSY` w repo — do podjęcia w kolejnej sesji jak grafiki będą wgrane.

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
- 6 bossów rajdowych + 1 portret event-bossa wciąż bez prawdziwego artu (placeholder/emoji).
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

// Curated "ciekawostki" for the trivia widget — the user loves interesting facts, book
// insights and popular-science tidbits. Category drives a lucide icon in the card (we
// keep the UI emoji-free; the pet/cards are the only emoji exceptions).
//
// Book items paraphrase an IDEA and attribute the book — not verbatim quotes.

export type TriviaCat = 'nauka' | 'ksiazka' | 'rozwoj' | 'swiat';

export interface Trivia { cat: TriviaCat; text: string; src?: string }

export const TRIVIA: Trivia[] = [
  // ── nauka ──
  { cat: 'nauka', text: 'Ośmiornica ma trzy serca i niebieską krew — dwa serca pompują krew do skrzeli, a jedno do reszty ciała.' },
  { cat: 'nauka', text: 'Miód nigdy się nie psuje. W egipskich grobowcach znaleziono słoje sprzed 3000 lat, wciąż jadalne.' },
  { cat: 'nauka', text: 'Twoje ciało ma w sobie więcej komórek bakteryjnych niż własnych — mniej więcej po równo, ale bakterie prowadzą.' },
  { cat: 'nauka', text: 'Banany są lekko promieniotwórcze — zawierają potas-40. Dawkę od jednego banana nazywa się „banana equivalent dose".' },
  { cat: 'nauka', text: 'Woda może wrzeć i zamarzać jednocześnie — w tzw. punkcie potrójnym, przy odpowiednim ciśnieniu i temperaturze.' },
  { cat: 'nauka', text: 'Serce błękitnego wieloryba jest wielkości małego samochodu, a jego bicie słychać z 3 km.' },
  { cat: 'nauka', text: 'Gdyby zwinąć wszystkie naczynia krwionośne człowieka w jedną linię, miałaby ok. 100 000 km — 2,5× dookoła Ziemi.' },
  { cat: 'nauka', text: 'Rekiny istniały przed drzewami. Pierwsze rekiny pojawiły się ok. 400 mln lat temu, drzewa ok. 350 mln.' },
  { cat: 'nauka', text: 'Dzień na Wenus trwa dłużej niż jej rok — planeta obraca się wolniej, niż okrąża Słońce.' },
  { cat: 'nauka', text: 'Twój mózg zużywa ok. 20% energii ciała, choć waży tylko ok. 2% masy.' },
  { cat: 'nauka', text: 'Niedźwiedzie polarne mają czarną skórę i przezroczyste futro — biel to złudzenie rozproszonego światła.' },
  { cat: 'nauka', text: 'Błyskawica jest ok. 5× gorętsza od powierzchni Słońca — nawet 30 000°C.' },
  { cat: 'nauka', text: 'Ślimak może spać nawet trzy lata z rzędu, jeśli warunki są niesprzyjające.' },
  { cat: 'nauka', text: 'Około 60% ludzkiego ciała to woda, ale w płucach jest jej aż ~83%.' },

  // ── książki (popular science / self-dev) ──
  { cat: 'ksiazka', text: 'Nie stajesz na wysokości swoich celów — spadasz do poziomu swoich systemów. Liczą się codzienne procesy, nie same postanowienia.', src: 'Atomowe nawyki, J. Clear' },
  { cat: 'ksiazka', text: 'Poprawa o 1% dziennie to po roku wynik ~37× lepszy. Małe zmiany kumulują się jak procent składany.', src: 'Atomowe nawyki, J. Clear' },
  { cat: 'ksiazka', text: 'Mamy dwa tryby myślenia: szybki i intuicyjny (System 1) oraz wolny i analityczny (System 2). Większość błędów bierze się z ufania temu pierwszemu.', src: 'Pułapki myślenia, D. Kahneman' },
  { cat: 'ksiazka', text: 'Ból straty boli ok. 2× mocniej, niż cieszy zysk tej samej wielkości — to awersja do straty.', src: 'Pułapki myślenia, D. Kahneman' },
  { cat: 'ksiazka', text: 'Homo sapiens zapanował nad światem nie siłą, lecz zdolnością do współpracy w wielkich grupach wokół wspólnych „fikcji" — pieniędzy, państw, religii.', src: 'Sapiens, Y. N. Harari' },
  { cat: 'ksiazka', text: 'Motywacja rzadko poprzedza działanie — częściej działanie tworzy motywację. Zacznij, a chęć często dogoni.', src: 'idea z psychologii działania' },
  { cat: 'ksiazka', text: 'Ludzie w „niebieskich strefach" (najdłużej żyjący) rzadko ćwiczą na siłowni — ruch mają wpleciony w codzienność: ogród, spacery, schody.', src: 'Blue Zones, D. Buettner' },
  { cat: 'ksiazka', text: 'Stan „flow" pojawia się, gdy trudność zadania idealnie równoważy Twoje umiejętności — za łatwe nudzi, za trudne stresuje.', src: 'Przepływ, M. Csikszentmihalyi' },
  { cat: 'ksiazka', text: 'Sila woli działa jak mięsień — męczy się w ciągu dnia. Dlatego ważne decyzje lepiej podejmować rano.', src: 'Siła woli, R. Baumeister' },
  { cat: 'ksiazka', text: 'Odraczanie gratyfikacji w dzieciństwie (test pianki marshmallow) korelowało później z lepszymi wynikami w życiu — choć środowisko liczy się równie mocno.', src: 'psychologia, W. Mischel' },
  { cat: 'ksiazka', text: 'Ekspertem w dziedzinie nie robią same godziny, lecz „świadoma praktyka" — trening na granicy możliwości z natychmiastową informacją zwrotną.', src: 'Peak, A. Ericsson' },
  { cat: 'ksiazka', text: 'Nawyk to pętla: wyzwalacz → rutyna → nagroda. Żeby go zmienić, zwykle łatwiej podmienić rutynę niż walczyć z wyzwalaczem.', src: 'Siła nawyku, C. Duhigg' },

  // ── rozwój ──
  { cat: 'rozwoj', text: 'Zasada dwóch minut: jeśli coś zajmie mniej niż 2 minuty, zrób to od razu — nie odkładaj na listę.' },
  { cat: 'rozwoj', text: 'Chcesz zbudować nawyk? Przyczep go do istniejącego: „po umyciu zębów zrobię 10 pompek". To „habit stacking".' },
  { cat: 'rozwoj', text: 'Nie musisz mieć motywacji, żeby zacząć — wystarczy obniżyć próg wejścia. Załóż buty, a bieg często przyjdzie sam.' },
  { cat: 'rozwoj', text: 'Zapisywanie celów odręcznie zwiększa szansę ich realizacji — akt pisania angażuje mózg mocniej niż klikanie.' },
  { cat: 'rozwoj', text: 'Krótkie przerwy w nauce (technika Pomodoro, 25/5) pomagają utrwalać wiedzę lepiej niż jedna długa sesja.' },
  { cat: 'rozwoj', text: 'Wdzięczność działa: zapisywanie 3 dobrych rzeczy dziennie po kilku tygodniach zauważalnie poprawia nastrój w badaniach.' },
  { cat: 'rozwoj', text: 'Sen to nie strata czasu, tylko konserwacja mózgu — w nocy „sprząta" on produkty przemiany materii i utrwala pamięć.' },
  { cat: 'rozwoj', text: 'Efekt świeżego startu: łatwiej zmienić nawyk w „nowy" dzień — poniedziałek, 1. dnia miesiąca, po urodzinach.' },

  // ── świat ──
  { cat: 'swiat', text: 'W Japonii jest więcej domowych zwierząt niż dzieci.' },
  { cat: 'swiat', text: 'Najkrótsza wojna w historii — Wielka Brytania vs Zanzibar (1896) — trwała ok. 38 minut.' },
  { cat: 'swiat', text: 'Wieża Eiffla rośnie latem o ok. 15 cm — metal rozszerza się w upale.' },
  { cat: 'swiat', text: 'Na Antarktydzie jest bankomat — a nawet dwa, w stacji McMurdo.' },
  { cat: 'swiat', text: 'Wenecja stoi na milionach drewnianych pali wbitych w dno laguny ponad 1000 lat temu — w wodzie bez tlenu drewno skamieniało zamiast zgnić.' },
  { cat: 'swiat', text: 'Miód, ketchup i szkło to ciecze o ekstremalnej lepkości — szyby w starych katedrach są u dołu grubsze… choć to akurat mit, szkło nie „spływa".' },
  { cat: 'swiat', text: 'Ludzki nos rozróżnia ok. biliona zapachów — znacznie więcej, niż długo sądzono.' },
  { cat: 'swiat', text: 'Klawiatura QWERTY powstała, by… spowolnić pisanie — dawne maszyny zacinały się przy szybkim stukaniu sąsiednich klawiszy.' },
  { cat: 'swiat', text: 'Pierwszy alarm budzikowy w telefonie i tak Cię nie obudzi lepiej niż stałe pory snu — regularność bije godzinę pobudki.' },

  // ═══ druga porcja ═══

  // ── nauka ──
  { cat: 'nauka', text: 'Niesporczaki (tardigrady) przetrwają próżnię kosmosu, ekstremalny mróz, ukrop i dawki promieniowania zabójcze dla człowieka. Wysuszone potrafią „ożyć" po latach, gdy trafi na nie kropla wody.' },
  { cat: 'nauka', text: 'Łyżeczka materii z gwiazdy neutronowej ważyłaby na Ziemi około miliarda ton — tyle, co spora góra.' },
  { cat: 'nauka', text: 'Kolory nie istnieją „na zewnątrz" — to interpretacja mózgu. Fala światła nie ma barwy; czerwień powstaje dopiero w Twojej głowie.' },
  { cat: 'nauka', text: 'Największym organizmem na Ziemi jest grzybnia opieńki w Oregonie — rozciąga się pod ziemią na ~9 km² i ma tysiące lat.' },
  { cat: 'nauka', text: 'Dzielisz ~50% genów z bananem, ~60% z muszką owocową i ~99% z szympansem. Życie korzysta z tego samego zestawu klocków.' },
  { cat: 'nauka', text: 'Serce kolibra bije nawet ~1200 razy na minutę w locie, a w nocy ptak zapada w odrętwienie i zwalnia metabolizm, by przetrwać.' },
  { cat: 'nauka', text: 'Gdyby Słońce zgasło, dowiedzielibyśmy się o tym dopiero po ~8 minutach — tyle leci do nas jego światło.' },
  { cat: 'nauka', text: 'Twoje kości są mocniejsze od betonu na ściskanie, a jednocześnie lżejsze i elastyczniejsze — natura zoptymalizowała je lepiej niż inżynierowie.' },
  { cat: 'nauka', text: 'Atomy są niemal puste — gdyby jądro atomu powiększyć do wielkości piłki na środku stadionu, elektrony krążyłyby gdzieś przy trybunach.' },
  { cat: 'nauka', text: 'Krewetka boksująca (raki modliszkowe) uderza tak szybko, że w wodzie powstaje na moment bąbel gorętszy niż powierzchnia Słońca.' },
  { cat: 'nauka', text: 'Efekt placebo działa nawet gdy pacjent WIE, że dostaje placebo — samo „leczenie się" uruchamia realne procesy w mózgu.' },
  { cat: 'nauka', text: 'Sekwoje mogą żyć ponad 3000 lat i rosnąć wyżej niż 100 m. Woda pokonuje w ich pniu drogę w górę bez żadnej pompy.' },

  // ── książki (dłuższe fragmenty / idee) ──
  { cat: 'ksiazka', text: 'Między bodźcem a reakcją jest przestrzeń. W tej przestrzeni leży nasza wolność i moc wyboru reakcji. A w naszej reakcji leży nasz rozwój i wolność. Frankl przeżył obóz, obserwując, że nawet gdy odbierze się człowiekowi wszystko, zostaje mu ostatnia ludzka wolność — wybór własnej postawy.', src: 'Człowiek w poszukiwaniu sensu, V. Frankl' },
  { cat: 'ksiazka', text: 'Ludzie o „nastawieniu na rozwój" wierzą, że zdolności można wytrenować, więc porażkę traktują jak informację zwrotną, a nie wyrok. Ci o „nastawieniu stałym" unikają wyzwań, bo każda trudność zagraża ich obrazowi „zdolnego". Ta jedna różnica przekłada się na całe życie.', src: 'Nowa psychologia sukcesu, C. Dweck' },
  { cat: 'ksiazka', text: 'Głęboka praca — skupienie bez rozproszeń nad wymagającym zadaniem — staje się coraz rzadsza i coraz cenniejsza. Kto potrafi ją regularnie osiągać, wygrywa w gospodarce, w której płytkie, ciągle przerywane zajęcia robi już każdy.', src: 'Praca głęboka, C. Newport' },
  { cat: 'ksiazka', text: 'Wynik decyzji to nie to samo co jej jakość. Możesz podjąć świetną decyzję i przegrać (pech), albo fatalną i wygrać (szczęście). Oceniaj proces, nie tylko rezultat — inaczej uczysz się złych lekcji.', src: 'Myślenie w zakładach, A. Duke' },
  { cat: 'ksiazka', text: 'Rzeczy antykruche nie tylko znoszą wstrząsy — one na nich zyskują. Mięsień rośnie pod obciążeniem, odporność po chorobie. Zbyt „bezpieczne", wygładzone życie osłabia; trochę stresu i zmienności wzmacnia.', src: 'Antykruchość, N. Taleb' },
  { cat: 'ksiazka', text: 'W złożonym, zmiennym świecie często wygrywają generaliści — ludzie o szerokich zainteresowaniach, którzy próbowali wielu rzeczy — a nie wąscy specjaliści od jednego. Późny start i „błądzenie" bywają przewagą, nie stratą.', src: 'Zakres, D. Epstein' },
  { cat: 'ksiazka', text: 'O sukcesie w dłuższej perspektywie decyduje bardziej upór i konsekwencja (grit) niż sam talent. Talent bez wytrwałości to niewykorzystany potencjał; liczy się to, co robisz z nim przez lata.', src: 'Upór, A. Duckworth' },
  { cat: 'ksiazka', text: 'Nie da się „nadrobić" snu w weekend jak długu w banku. Jedna nieprzespana noc obniża zdolność uczenia się nawet o ~40%, a chroniczny niedobór snu podkopuje odporność, pamięć i nastrój.', src: 'Dlaczego śpimy, M. Walker' },
  { cat: 'ksiazka', text: 'Nie możesz kontrolować, co Cię spotyka — możesz kontrolować, jak to zinterpretujesz i co z tym zrobisz. Stoicy 2000 lat temu radzili: rozdziel to, co od Ciebie zależy, od tego, co nie, i skup energię tylko na pierwszym.', src: 'Rozmyślania, Marek Aureliusz' },
  { cat: 'ksiazka', text: 'Twoja uwaga jest ograniczona, więc powiedzieć „tak" jednej rzeczy to powiedzieć „nie" wielu innym. Esencjalizm to zdyscyplinowane robienie mniej, ale lepiej — nie chodzi o to, jak zrobić wszystko, tylko jak zrobić właściwe rzeczy.', src: 'Esencjalizm, G. McKeown' },
  { cat: 'ksiazka', text: 'Umysł służy do myślenia, nie do przechowywania. Każda niedokończona sprawa trzymana „w głowie" zżera uwagę. Zapisz wszystko poza głową w zaufanym systemie, a odzyskasz spokój i moc skupienia.', src: 'Getting Things Done, D. Allen' },
  { cat: 'ksiazka', text: 'Nie chodzi o to, żeby o nic się nie martwić, tylko żeby dobrze wybrać, o co warto. Nasza energia jest skończona — mądrość to świadomy wybór problemów, które chcemy w życiu rozwiązywać.', src: 'Subtelna sztuka olewania, M. Manson' },

  // ── rozwój ──
  { cat: 'rozwoj', text: 'Prawo Parkinsona: praca rozszerza się tak, by wypełnić cały czas, jaki jej damy. Daj sobie na coś 3 godziny zamiast całego dnia, a często zrobisz to w 3 godziny.' },
  { cat: 'rozwoj', text: 'Efekt Zeigarnik: niedokończone zadania „wiszą" w głowie mocniej niż skończone. Dlatego samo ZACZĘCIE czegoś tworzy napięcie, które ciągnie Cię do dokończenia.' },
  { cat: 'rozwoj', text: 'Paradoks wyboru: więcej opcji nie znaczy więcej szczęścia — często odwrotnie. Ograniczaj wybory (np. gotowy plan dnia), a zostanie Ci więcej energii na to, co ważne.' },
  { cat: 'rozwoj', text: 'Reguła 20 sekund: żeby robić dobry nawyk, skróć drogę do niego o 20 sekund (buty przy łóżku); żeby porzucić zły, wydłuż ją (pilot w innym pokoju). Tarcie decyduje.' },
  { cat: 'rozwoj', text: 'Ucz się „z przypominania", nie z odczytywania: zamknij notatki i spróbuj odtworzyć z pamięci. Wysiłek przypominania utrwala wiedzę o wiele mocniej niż bierne czytanie.' },
  { cat: 'rozwoj', text: 'Ludzie przeceniają, co zrobią w rok, a nie doceniają, co zrobią w 10 lat. Konsekwencja w małych krokach wygrywa z zrywami.' },
  { cat: 'rozwoj', text: 'Chcesz coś zrozumieć naprawdę? Wytłumacz to prostymi słowami, jakbyś uczył dziecko (technika Feynmana). Miejsca, gdzie się zacinasz, to Twoje luki w wiedzy.' },

  // ── świat ──
  { cat: 'swiat', text: 'Liczba Dunbara: człowiek jest w stanie utrzymać ok. 150 stabilnych relacji społecznych. Powyżej tego grupy zwykle się dzielą — tyle „mieści się" w naszym mózgu.' },
  { cat: 'swiat', text: 'Krowy mają najlepsze przyjaciółki i stresują się, gdy się je rozdzieli — tętno im wtedy rośnie.' },
  { cat: 'swiat', text: 'Grenlandzki rekin polarny może żyć ponad 300 lat — to najdłużej żyjący kręgowiec. Dojrzałość płciową osiąga dopiero po ~150 latach.' },
  { cat: 'swiat', text: 'Znaczek „@" ma w różnych językach zabawne nazwy: po polsku „małpa", po włosku „ślimak", po duńsku „trąba słonia", a po hebrajsku „strudel".' },
  { cat: 'swiat', text: 'W kosmosie astronauci rosną nawet o kilka centymetrów — bez grawitacji kręgosłup się rozciąga. Po powrocie na Ziemię wracają do dawnego wzrostu.' },
  { cat: 'swiat', text: 'Pierwsza kamera internetowa na świecie podglądała… ekspres do kawy w Cambridge, żeby naukowcy nie chodzili na próżno, gdy dzbanek był pusty.' },
  { cat: 'swiat', text: 'Ludzie i banany mają wspólnego przodka sprzed setek milionów lat — dlatego mimo pozorów dzielimy z nimi sporą część genów.' },
  { cat: 'swiat', text: 'W średniowieczu ludzie spali „na dwie tury": kładli się po zmroku, budzili w środku nocy na godzinę-dwie (czuwanie, modlitwa, rozmowy), po czym spali dalej do rana.' },
];

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
];

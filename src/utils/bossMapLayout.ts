// Układ mapy bossów — PRZEBUDOWA OD ZERA #2 (2026-10-14, po PR #419/#424/#425, user dalej
// zgłaszał zepsutą mapę: "boss niektóre sa porozrzucane zle... nie widać zupełnie tego
// aktualnego... linią wgle przerwa sie kolorem... przybliżenie słabo działa... Możesz zrobic
// to nawet od zera???"). Diagnoza statyczna (bez urządzenia, ale zweryfikowana BEZPOŚREDNIM
// odpaleniem kodu w jest, nie zgadywaniem) poprzedniego układu (losowy spacer 2D, ±49°/krok)
// potwierdziła że matematyka kamery/ID-matching była poprawna dla sprawdzonych scenariuszy —
// ale sam losowy spacer wciąż mógł (dla innych seedów/rosterów niż akurat sprawdzone) dawać
// samoprzecinającą się trasę (świadomie nieunikane w poprzedniej wersji, patrz historia PR),
// co przy DOWOLNYM kolejnym błędzie w renderze (z-order, kamera) robi się dużo trudniejsze do
// zdiagnozowania i wygląda jak chaos ("porozrzucane"). Zamiast łatać kolejny raz tę samą
// nieprzewidywalną geometrię, ten układ jest teraz MATEMATYCZNIE GWARANTOWANY bez
// samoprzecięć: Y rośnie ściśle monotonicznie z indeksem (każdy kolejny boss jest NIŻEJ,
// nigdy nie wraca w górę), X jest ograniczony do wąskiego pasma "torów" MIESZCZĄCEGO SIĘ W
// PODANEJ SZEROKOŚCI (deterministyczny spacer po torach, max jeden tor w lewo/prawo na krok)
// — wygląda jak wijąca się ścieżka, ale nigdy nie może się zapętlić na siebie, bo każdy
// wiersz jest o jeden niżej niż poprzedni. Ta sama własność eliminuje PRZY OKAZJI potrzebę
// swobodnego pan+zoom w obie strony — mapa mieści się dokładnie w szerokości ekranu i
// przewija się TYLKO pionowo (patrz CampaignMap.tsx, zwykły `ScrollView` zamiast własnej
// matematyki gestów/kamery — usunięta CAŁA klasa bugów z PR #417/#424/#425, nie tylko
// kolejny jej objaw).
export interface MapNode { x: number; y: number }
export interface MapLayout { nodes: MapNode[]; width: number; height: number }

export const LANES = 5; // liczba "torów" w poziomie — wąski zygzak, nie swobodny spacer
const ROW_GAP = 170;    // odstęp pionowy między kolejnymi bossami
const PAD_Y = 100;      // margines góra/dół na portret+etykietę+popup

function hash01(n: number): number {
  let h = (n * 2654435761) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function clampLane(lane: number): number {
  return Math.max(0, Math.min(LANES - 1, lane));
}

// Środek toru `lane` w pikselach X, dla danej szerokości płótna — JEDNA definicja "gdzie jest
// tor N", współdzielona przez bazowy proceduralny układ (`layoutBossMap` niżej) i ręczne
// nadpisania (`applyLaneOverrides`, §412) — oba muszą się zgadzać co do piksela, inaczej węzeł
// przesunięty na tor przez edytor wylądowałby w innym miejscu niż ten sam tor liczony
// proceduralnie.
export function laneX(lane: number, areaWidth: number): number {
  const laneWidth = Math.max(1, areaWidth) / LANES;
  return clampLane(lane) * laneWidth + laneWidth / 2;
}

// Odwrotność `laneX` — z piksela X na numer toru (§412, edytor: panel wybranego bossa pokazuje
// AKTUALNY tor, także dla bossów bez ręcznego nadpisania, czyli tych na proceduralnym zygzaku —
// stąd potrzeba odwrócenia, nie tylko odczytania zapisanej wartości z override'u).
export function xToLane(x: number, areaWidth: number): number {
  const laneWidth = Math.max(1, areaWidth) / LANES;
  return clampLane(Math.round((x - laneWidth / 2) / laneWidth));
}

// `areaWidth` — szerokość dostępnego viewportu (CampaignMap.tsx mierzy ją przez `onLayout` i
// przekazuje tu, żeby płótno ZAWSZE dokładnie mieściło się na ekranie, na każdym rozmiarze
// telefonu, bez poziomego przycinania). Domyślne 340 to bezpieczny placeholder na pierwszy
// render / użycie w testach, zanim realny rozmiar jest znany.
//
// Zygzak po torach — każdy krok przesuwa się o co najwyżej JEDEN tor w lewo/w prawo/na
// miejscu (deterministycznie, seedowane indeksem), więc trasa nigdy nie "skacze" gwałtownie
// w poziomie, ale wciąż realnie się wije (nie jest to sztywna siatka — `hash01` daje
// nieokresowy wzór, nie powtarzającą się co N kroków sinusoidę jak najstarsza wersja tej
// mapy). Y jest ŚCIŚLE funkcją indeksu (i*ROW_GAP) — brak jitteru pionowego, żeby wiersze
// NIGDY się nie zamieniały kolejnością (gwarancja braku samoprzecięć niezależnie od tego co
// robi X).
export function layoutBossMap(count: number, areaWidth: number = 340): MapLayout {
  if (count <= 0) return { nodes: [], width: areaWidth, height: PAD_Y * 2 };
  let lane = Math.floor(LANES / 2);
  const nodes: MapNode[] = [];
  for (let i = 0; i < count; i++) {
    if (i > 0) {
      const step = Math.floor(hash01(i) * 3) - 1; // -1, 0 albo +1
      lane = clampLane(lane + step);
    }
    nodes.push({ x: laneX(lane, areaWidth), y: PAD_Y + i * ROW_GAP });
  }
  const height = PAD_Y * 2 + (count - 1) * ROW_GAP;
  return { nodes, width: areaWidth, height };
}

// Edytor mapy bossów — PRZEBUDOWA OD ZERA #3 (2026-10-23, §412) — user, po TRZECH rundach
// prób na tym samym systemie swobodnego x/y drag (§322 pierwsza wersja, §403 "key={d}" fix,
// §410 cascade-klamrowanie Y): "musimy ją chyba wywalić i zbudować od zera", potwierdzone że
// §410 NIE wystarczyło (retestowane po OTA, dalej źle). §410 ZAŁATAŁO jeden konkretny sposób
// łamania "Y ściśle rośnie z indeksem" (nadpisanie Y > sąsiad), ale NIE usunęło samej
// MOŻLIWOŚCI — user wciąż mógł przeciągnąć węzeł na dowolny X *i* Y, drag-gest w edytorze
// wciąż walczył o gest ze ScrollView (udokumentowany, nigdy w pełni naprawiony "nic nie mogę
// zrobić" bug), a SVG `<Path>` na Androidzie ma HISTORIĘ problemów ze świeżością `d` propu
// (§403) — zbyt wiele ruchomych części, żeby ufać kolejnej łatce.
//
// Nowy model: Y jest TERAZ WYŁĄCZNIE f(indeks) — `layoutBossMap`'owe `PAD_Y + i*ROW_GAP`,
// BEZ ŻADNEGO sposobu go nadpisać, nigdzie w kodzie. X nadal da się dostosować ręcznie, ale
// TYLKO przez wybór jednego z `LANES` (5) DYSKRETNYCH torów (tap, nie drag) — dokładnie tych
// samych torów, po których i tak porusza się proceduralny zygzak (`laneX()` wyżej, JEDNO
// źródło prawdy współdzielone z `layoutBossMap`). Stan, w którym kolejność Y jest złamana,
// jest TERAZ STRUKTURALNIE NIEOSIĄGALNY — nie ma już kodu, który potrafiłby go wytworzyć,
// więc nie trzeba go ani walidować, ani klamrować po fakcie. Nadpisania kluczowane BAZOWYM id
// bossa (patrz `baseBossId` w madBosses.ts) — bez nadpisania węzeł zostaje na swoim
// proceduralnym torze (nowo dodani bossowie od razu mają sensowną pozycję).
export function applyLaneOverrides(
  base: MapNode[], ids: string[], laneOverrides: Record<string, number>, areaWidth: number,
): MapLayout {
  const nodes = base.map((n, i) => {
    const lane = laneOverrides[ids[i]];
    const x = lane != null ? laneX(lane, areaWidth) : n.x;
    return { x, y: n.y };
  });
  const maxY = nodes.reduce((m, n) => Math.max(m, n.y), 0);
  return { nodes, width: areaWidth, height: maxY + PAD_Y };
}

// Wygładzona ścieżka przez węzły w kolejności — krzywa Catmull-Rom przeliczona na odcinki
// Beziera (standardowa konwersja, dzielnik/6 = "uniform" Catmull-Rom), żeby ręcznie ułożona
// trasa (edytor) nie wyglądała jak połamana linia prosto-w-prosto (user: "ścieżka połączy się
// sama z jakąś tam modyfikacją smooth"). Współdzielona przez CampaignMap.tsx (prawdziwa mapa)
// i edytor — JEDNA definicja "jak wygląda ścieżka", nie dwie które mogłyby się rozjechać.
export function catmullRomPath(points: MapNode[]): string {
  if (points.length < 2) return '';
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  let d = `M ${points[0].x} ${points[0].y} `;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y} `;
  }
  return d;
}

// Pozycja scrolla żeby węzeł `idx` wylądował wycentrowany w viewporcie o wysokości
// `viewportH` (2026-10-16, BUG #6 — "nie widzę zupełnie bossa aktualnego... jest poza
// ekranem"). Wyniesione jako czysta funkcja z `CampaignMap.tsx` właśnie żeby dało się ją
// przetestować w jest — sama LICZBA była zawsze poprawna (zweryfikowane tu), problem był
// wyłącznie w SPOSOBIE dostarczenia jej do natywnego ScrollView (patrz komentarz przy
// `contentOffset`/`key` w CampaignMap.tsx — to już nie jest testowalne w jest, bo zależy od
// natywnego cyklu montażu). Klamrowane do 0 z dołu — ujemny scroll nie istnieje; górne
// klamrowanie (koniec treści) zostaje natywnemu ScrollView, tak jak przy zwykłym `scrollTo`.
export function centerScrollY(nodes: MapNode[], idx: number, viewportH: number): number {
  if (nodes.length === 0 || viewportH <= 0) return 0;
  const clampedIdx = Math.max(0, Math.min(idx, nodes.length - 1));
  return Math.max(0, nodes[clampedIdx].y - viewportH / 2);
}

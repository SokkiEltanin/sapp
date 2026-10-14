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

const LANES = 5;       // liczba "torów" w poziomie — wąski zygzak, nie swobodny spacer
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
  const laneWidth = Math.max(1, areaWidth) / LANES;
  if (count <= 0) return { nodes: [], width: areaWidth, height: PAD_Y * 2 };
  let lane = Math.floor(LANES / 2);
  const nodes: MapNode[] = [];
  for (let i = 0; i < count; i++) {
    if (i > 0) {
      const step = Math.floor(hash01(i) * 3) - 1; // -1, 0 albo +1
      lane = clampLane(lane + step);
    }
    nodes.push({ x: lane * laneWidth + laneWidth / 2, y: PAD_Y + i * ROW_GAP });
  }
  const height = PAD_Y * 2 + (count - 1) * ROW_GAP;
  return { nodes, width: areaWidth, height };
}

// Edytor mapy bossów (2026-10-14, ARCHITECTURE.md §322 — user: "zrobisz edytor ja sam
// ustawie wszystko mapę ścieżkę") — ręcznie przeciągnięta pozycja (kluczowana BAZOWYM id
// bossa, patrz `baseBossId` w madBosses.ts) NADPISUJE proceduralny zygzak dla tego jednego
// węzła. Brak nadpisania = ten węzeł zostaje na swojej zygzakowej pozycji (więc nowo dodani
// bossowie, zanim user zdąży ich poustawiać, od razu mają sensowną pozycję zamiast (0,0)).
// `x` jest przycinane do `[0, areaWidth]` (obrona przed pozycją zapisaną na innym rozmiarze
// ekranu niż ten na którym mapa jest teraz oglądana) — `y` nie jest ograniczane, bo płótno i
// tak rośnie w pionie żeby pomieścić najniżej przeciągnięty węzeł.
export function applyLayoutOverrides(
  base: MapNode[], ids: string[], overrides: Record<string, MapNode>, areaWidth: number,
): MapLayout {
  const nodes = base.map((n, i) => {
    const o = overrides[ids[i]];
    if (!o) return n;
    return { x: Math.max(0, Math.min(areaWidth, o.x)), y: Math.max(0, o.y) };
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

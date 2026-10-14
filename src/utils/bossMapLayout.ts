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

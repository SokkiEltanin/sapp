// Proceduralny układ 2D mapy bossów (2026-10-14, przebudowa zakładki Bossy od zera — user:
// "zrob calosekranowa te mape... rozmieścić bosy na koordynatach potem polacz sciezkami po
// kolei jak w dragon mania legends"). Każdy boss dostaje punkt (x,y) na płaszczyźnie —
// połączony z poprzednim STAŁYM krokiem (STEP) w kierunku, który z każdym krokiem skręca o
// deterministyczny, ograniczony kąt (seedowany indeksem, NIE Math.random() — ten sam układ
// mapy przy każdym renderze/sesji, nie przetasowuje się pod userem). Bez kolizji/odgałęzień —
// kampania jest ściśle sekwencyjna (patrz `current = BOSSES.find(...)` w bosses.tsx), więc to
// NIE jest graf, tylko jedna wijąca się linia — tylko teraz NAPRAWDĘ w 2D (oś X i Y obie się
// zmieniają), w przeciwieństwie do starej mapy (tylko Y rosło liniowo, X tylko kołysał się
// sinusoidą — stąd "duplikuje się" wrażenie usera: okresowa sinusoida dawała ten sam
// powtarzający się kształt co kilka bossów).
export interface MapNode { x: number; y: number }
export interface MapLayout { nodes: MapNode[]; width: number; height: number }

const STEP = 170;      // stały dystans między kolejnymi bossami
const MAX_TURN = 0.85; // maks. zmiana kierunku (radiany, ~49°) na krok — łagodne, nie ostre zakręty
const PAD = 220;       // margines dookoła skrajnych punktów — miejsce na portret+etykietę+popup

// Deterministyczny hash → 0..1 (mnożnikowy hash, ten sam rodzaj co `hashOf` w raid.ts/
// personalQuests.ts) — NIE Math.random(), żeby układ mapy był identyczny za każdym razem, nie
// losowany na nowo przy każdym wejściu na ekran.
function hash01(n: number): number {
  let h = (n * 2654435761) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Celowo NIE unikane: samoprzecięcia ścieżki przy bardzo dużej liczbie bossów (losowy spacer
// bez "ciągnięcia" z powrotem do środka może zawinąć się na siebie). Akceptowalne dla mapy
// eksploracyjnej — nie jest to graf nawigacyjny z realnym pathfindingiem, tylko dekoracyjna
// wizualizacja postępu. Jeśli to kiedyś realnie przeszkadza (bardzo duży roster, ~100+ bossów
// per NEXT_STEPS.md), rozwiązanie to osobna, większa zmiana (np. odpychanie od wcześniejszych
// punktów), nie coś do zgadywania teraz bez dowodu że faktycznie przeszkadza.
export function layoutBossMap(count: number): MapLayout {
  if (count <= 0) return { nodes: [], width: PAD * 2, height: PAD * 2 };
  const raw: MapNode[] = [{ x: 0, y: 0 }];
  let heading = -Math.PI / 2; // start: "w górę" — czysto umowny kierunek początkowy
  for (let i = 1; i < count; i++) {
    const turn = (hash01(i) * 2 - 1) * MAX_TURN;
    heading += turn;
    const prev = raw[i - 1];
    raw.push({ x: prev.x + Math.cos(heading) * STEP, y: prev.y + Math.sin(heading) * STEP });
  }
  const xs = raw.map(n => n.x);
  const ys = raw.map(n => n.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const offX = PAD - minX;
  const offY = PAD - minY;
  const nodes = raw.map(n => ({ x: n.x + offX, y: n.y + offY }));
  const width = Math.max(...xs) - minX + PAD * 2;
  const height = Math.max(...ys) - minY + PAD * 2;
  return { nodes, width, height };
}

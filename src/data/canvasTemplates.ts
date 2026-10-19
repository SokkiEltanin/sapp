import type { CanvasComponentType } from '@/store/canvasComponentsStore';

// Szablony projektów (Faza §395, 2026-10-19) — ostatni, czwarty kawałek wiadomości usera o
// KWGT ("dodaj... szablony"). Z §390: "tam wybierasz szablon czy pusty canvas" przy tworzeniu
// projektu w Ustawieniach — ŚWIADOMIE v1 = kilka ZASZYTYCH NA STAŁE, gotowych układów
// (prostsze, szybsze niż trwała biblioteka zapisywalnych-przez-usera szablonów — ta druga
// wersja czeka na doprecyzowanie, patrz NEXT_STEPS.md).
//
// Wszystkie itemy są BEZ podpięcia danych (kształty/tekst/pasek progresu niepodpięty) —
// ŚWIADOMIE: dostępne bindingi różnią się między 14 ekranami (streak/countdown/notes/dataField
// mają inny sens na Zdrowiu niż na Jedzeniu), więc szablon nie może sensownie z góry wybrać
// konkretnych danych — user dopina je sam po zastosowaniu szablonu (ten sam krok co przy
// ręcznym dodaniu dowolnego typu z danymi).
export interface CanvasTemplateItemSpec {
  componentType: CanvasComponentType;
  x: number; y: number; width: number; height: number;
  style?: Record<string, unknown>; // scalane z DEFAULT_STYLE tego typu w applyTemplate
}

export interface CanvasTemplate {
  id: string;
  label: string;
  description: string;
  items: CanvasTemplateItemSpec[];
}

// Współrzędne liczone pod ~320-340px szerokości płótna (typowy telefon) — nie idealnie
// wypełnią szersze ekrany, ale wszystko zostaje przeciągalne/resizowalne po zastosowaniu, tak
// jak każdy ręcznie dodany item.
export const CANVAS_TEMPLATES: CanvasTemplate[] = [
  {
    id: 'header-divider',
    label: 'Nagłówek + separator',
    description: 'Tekst tytułowy i linia pod nim — prosty start do dalszego budowania.',
    items: [
      { componentType: 'textShape', x: 12, y: 12, width: 296, height: 40, style: { text: 'Nagłówek', fontSize: 20, bold: true, align: 'left' } },
      { componentType: 'lineShape', x: 12, y: 60, width: 296, height: 4 },
    ],
  },
  {
    id: 'two-cards',
    label: 'Dwie karty w rzędzie',
    description: 'Dwa zaokrąglone tła-karty obok siebie — podkładka pod kafle z danymi.',
    items: [
      { componentType: 'rectShape', x: 12, y: 12, width: 142, height: 100, style: { cornerRadius: 16 } },
      { componentType: 'rectShape', x: 166, y: 12, width: 142, height: 100, style: { cornerRadius: 16 } },
    ],
  },
  {
    id: 'progress-card',
    label: 'Karta z paskiem progresu',
    description: 'Tło + podpis + pasek progresu (podepnij licznik po zastosowaniu) — jak w KWGT.',
    items: [
      { componentType: 'rectShape', x: 12, y: 12, width: 296, height: 90, style: { cornerRadius: 16, fill: '#1E293B' } },
      { componentType: 'textShape', x: 28, y: 24, width: 200, height: 24, style: { text: 'Cel', fontSize: 14 } },
      { componentType: 'progressBar', x: 28, y: 56, width: 264, height: 20 },
    ],
  },
];

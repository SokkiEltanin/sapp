// The cat's coat colours — the ONLY thing the shop sells now (rooms, hats, held items
// and accessories were all removed; see [[pet_blob_design]]).
//
// `mark` (tail stripes) is DERIVED from the coat, never hand-picked: light coats get a
// darker tone, dark coats a lighter one. Same hue, small step. Hand-picking meant every
// new colour was a fresh chance to look wrong — white markings on brown fur read as a
// sticker, and a white nose on a black cat read as a marker.
//
// `ink` (nose / mouth / closed eyes) is per-palette for the same reason: dark line-work
// vanishes on a dark coat, so the black cat carries a muted grey-blue instead. PUPIL is
// deliberately NOT tied to ink — it sits on the white sclera and must always stay dark.

export const PUPIL = '#2A2B36';

export interface CatPalette {
  id: string;
  name: string;
  coat: string;   // main fur
  shade: string;  // chest / front panel
  ear: string;    // inner ear
  ink: string;    // nose, mouth, closed-eye arcs
  mark: string;   // tail stripes (derived — see markFor)
  cost: number;   // coins; the starting coat is free
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt > 0 ? c + (255 - c) * amt : c * (1 + amt))));
  return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
}
// Wyeksportowane (2026-08-21) — app/pet.tsx reużywa tego samego progu do decyzji "czy ciemny
// kolor kotka potrzebuje jasnej otoczki na pasku misji" (patrz komentarz przy missionCatHalo).
export function luma(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}
export function markFor(coat: string): string {
  return luma(coat) > 0.55 ? shade(coat, -0.19) : shade(coat, 0.27);
}

// Natural coats only — the user rejected pink/mint/violet as "too weird". Shade/ear are
// derived tones of the coat (same hue, darker steps) so new coats can't look wrong.
const dark = (hex: string, a: number) => shade(hex, -a);
const nat = (id: string, name: string, coat: string, ink: string, cost: number): Omit<CatPalette, 'mark'> =>
  ({ id, name, coat, shade: dark(coat, 0.07), ear: dark(coat, 0.16), ink, cost });

// Przycięte 19→10 (2026-08-10, user: "wywal niektóre kolory kota, są bez sensu powtarzają
// się i są super podobne"). Usunięte jako niemal-duplikaty tych, co zostały: silver/slate/
// smoke (3 dodatkowe odcienie szarości — grey już jest), honey/caramel/sand (3 dodatkowe
// ciepłe beże — ginger+cream+brown już pokrywają tę przestrzeń), snow (prawie identyczny
// z white), coffee (prawie identyczny z chocolate), charcoal/platinum (prawie identyczne
// z midnight/grey). Zostają TYLKO wizualnie odróżnialne kolory. Wycofane id-ki NIE są nigdzie
// indziej używane (tylko tu), więc jeśli miałeś któryś z nich kupiony/założony, `paletteById`
// po prostu wróci do domyślnego niebieskiego (nie crashuje, patrz DEFAULT_PALETTE fallback).
//
// Wszystkie zwykłe, jednolite kolory to teraz CENA „common"/basic (<60) — user: "to będą
// common wydatki nie epickie". Epicki tier zostaje wolny na coś co faktycznie na niego
// zasługuje (gradient/mieszanka kolorów — PROPOZYCJA do zaprezentowania, jeszcze nie budowane).
const BASE: Omit<CatPalette, 'mark'>[] = [
  { id: 'blue',   name: 'Niebieski', coat: '#A7CCF5', shade: '#93C1F4', ear: '#8AB5E7', ink: '#3B3C4E', cost: 0 },
  { id: 'grey',   name: 'Szary',     coat: '#B9BFC7', shade: '#A7AEB7', ear: '#8F97A1', ink: '#3B3C4E', cost: 25 },
  { id: 'cream',  name: 'Kremowy',   coat: '#F0DFC2', shade: '#E6D2AF', ear: '#D4BE97', ink: '#4A3E2A', cost: 30 },
  { id: 'ginger', name: 'Rudy',      coat: '#EDA968', shade: '#E39A55', ear: '#CE8544', ink: '#4A3524', cost: 35 },
  { id: 'brown',  name: 'Brązowy',   coat: '#A97B54', shade: '#986C48', ear: '#85593A', ink: '#38281B', cost: 40 },
  { id: 'white',  name: 'Biały',     coat: '#F1F3F6', shade: '#E3E7EC', ear: '#CFD6DE', ink: '#3B3C4E', cost: 45 },
  { id: 'black',  name: 'Czarny',    coat: '#4A4F5C', shade: '#40444F', ear: '#363A44', ink: '#9BA3B4', cost: 50 },
  nat('chocolate','Czekoladowy',   '#6E4B34', '#E7D8CC', 55),
  nat('midnight', 'Nocny',        '#2C3140', '#9FB0D0', 55),
  nat('rose',     'Różany szary', '#C9AEB0', '#4A3A3C', 55),
];

export const CAT_PALETTES: CatPalette[] = BASE.map(p => ({ ...p, mark: markFor(p.coat) }));

export const DEFAULT_PALETTE = CAT_PALETTES[0];

export function paletteById(id?: string): CatPalette {
  return CAT_PALETTES.find(p => p.id === id) ?? DEFAULT_PALETTE;
}

// Tail stripes — the one marking that survived review (flat blotches on a flat body just
// read as stickers; stripes work because they run ACROSS the shape).
export const STRIPES_ID = 'stripes';
export const STRIPES_COST = 45;

// "Sklepikarz" (2026-09-03) — the market-stall NPC cat (see CatArt's `shopkeeper` prop:
// mustache + hat, no lick/petting reactions). Deliberately OUTSIDE `CAT_PALETTES` — the
// player never buys or equips it — so it stays a fixed, un-purchasable identity that reads
// as visually distinct from whatever coat the player picked for their own cat. A muted warm
// tan, chosen to sit clearly apart from all 10 purchasable presets (nearest neighbours are
// ginger #EDA968 and brown #A97B54 — this sits between them but is lighter/greyer than both).
const SHOPKEEPER_COAT = '#C9A876';
export const SHOPKEEPER_PALETTE: CatPalette = {
  id: 'shopkeeper', name: 'Sklepikarz',
  coat: SHOPKEEPER_COAT, shade: shade(SHOPKEEPER_COAT, -0.07), ear: shade(SHOPKEEPER_COAT, -0.16),
  ink: '#4A3E2A', mark: markFor(SHOPKEEPER_COAT), cost: 0,
};

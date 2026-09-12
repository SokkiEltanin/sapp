// Normalizuje surowy pathname z expo-router do stabilnego "screenId" + czytelnej polskiej
// etykiety, do lokalnego licznika użycia (`usageStatsStore.ts`). Dynamiczne segmenty
// (`/expenses/AbC123XyZ`) są ZWIJANE do `:id` — inaczej store rósłby jednym wpisem NA
// KAŻDY otwarty wydatek/zadanie/notatkę zamiast zostać płaskim, ograniczonym zbiorem
// (dziesiątki ekranów, nie tysiące rekordów).

// Segment "wygląda jak id" — czysto liczbowy (Date.now()-owe id) LUB długi alfanumeryczny
// (Firestore auto-id ma 20 znaków) — w obu przypadkach nie jest to nazwa realnego ekranu.
function looksLikeId(seg: string): boolean {
  if (/^\d{6,}$/.test(seg)) return true;
  if (seg.length >= 15 && /^[a-zA-Z0-9_-]+$/.test(seg)) return true;
  return false;
}

// Etykiety dla znanych, statycznych segmentów — TYLKO do ładnego wyświetlenia w
// Ustawieniach; nieznany segment dostaje fallback (capitalize + myślniki→spacje), więc
// nowy ekran dodany później i tak dostanie sensowną nazwę bez zmiany tego pliku.
const LABELS: Record<string, string> = {
  '': 'Dashboard',
  tasks: 'Zadania',
  stats: 'Przegląd',
  finances: 'Finanse',
  health: 'Zdrowie',
  food: 'Jedzenie',
  mood: 'Nastrój',
  calendar: 'Kalendarz',
  settings: 'Ustawienia',
  notes: 'Notatki',
  habits: 'Nawyki',
  'habit-year': 'Rok nawyków',
  pet: 'Pupil',
  'pet-shop': 'Rynek (Pupil)',
  'pet-quests': 'Questy Pupila',
  bosses: 'Bossowie',
  'boss-fight': 'Walka z bossem',
  vehicles: 'Pojazdy',
  counters: 'Liczniki',
  search: 'Wyszukiwanie',
  achievements: 'Osiągnięcia',
  'month-cards': 'Karty miesiąca',
  pomodoro: 'Pomodoro',
  debts: 'Długi',
  products: 'Produkty',
  weekly: 'Tydzień',
  skins: 'Skiny',
  items: 'Przedmioty',
  notifications: 'Powiadomienia',
  focus: 'Skupienie',
  'health-test': 'Test zdrowia',
  'bank-review': 'Przegląd banku',
  expenses: 'Wydatki',
  work: 'Praca',
};

const SUB_LABELS: Record<string, string> = {
  scan: 'skan', manual: 'ręcznie', add: 'dodaj', history: 'historia', product: 'produkt', ':id': 'szczegóły',
};

function prettify(seg: string): string {
  return seg.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export interface ScreenInfo { id: string; label: string }

export function screenInfoFor(pathname: string): ScreenInfo | null {
  const clean = pathname.split('?')[0];
  const segs = clean.split('/').filter(Boolean).map(s => (looksLikeId(s) ? ':id' : s));
  if (segs.length === 0) return { id: '/', label: LABELS[''] };
  const id = '/' + segs.join('/');
  const top = segs[0];
  const topLabel = LABELS[top] ?? prettify(top);
  if (segs.length === 1) return { id, label: topLabel };
  const sub = segs[1];
  const subLabel = SUB_LABELS[sub] ?? prettify(sub);
  return { id, label: `${topLabel} — ${subLabel}` };
}

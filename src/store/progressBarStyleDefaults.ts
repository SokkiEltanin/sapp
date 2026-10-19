import { Fill } from '@/store/gradientFill';

// Pasek progresu na wolnym płótnie (Faza §393, 2026-10-19) — user: "dodaj... paski progresu
// itp... żeby podczas projektowania mógł wrzucić pasek, zmienić mu wygląd... jak kiedyś w
// KWGT Widgets" (Kustom Widget — Android, dokładnie ten model: gotowy "pasek progresu" jako
// osobny element, podpięty do dowolnych danych, w pełni stylowalny). Podpięcie (`bindingKey`)
// idzie do TEGO SAMEGO rejestru co `countdownTile` (`allCountdownItems`/`Counter`, WYŁĄCZNIE
// kind='until' — `useAllCountdownItems()` już filtruje 'since', patrz tam) — procent wypełnienia
// liczy się z JUŻ ISTNIEJĄCYCH, sprawdzonych funkcji `countersStore.ts` (`untilProgress`/
// `eventProgress`/`untilProgressStepped`, TE SAME co `CountdownTile.tsx`'s `RingCountdown`),
// zero nowej matematyki zakresu — zakres liczника to jego własny start/koniec, ustawiony już
// przy tworzeniu licznika w Licznikach, nie coś co trzeba konfigurować osobno na pasku.
// `fillColor: Fill` (Faza §394, 2026-10-19, user: "dodaj gradienty na pewno") — POSZERZENIE typu
// (`string | GradientFill`, `gradientFill.ts`), nie rename/migracja. `trackColor` ZOSTAJE
// `string` (zawsze płaski) — gradient na torze/tle paska jest rzadki, świadomie poza zakresem.
export interface ProgressBarStyle {
  fillColor: Fill;
  trackColor: string;
  cornerRadius: number; // realne piksele (zwykły RN `borderRadius`, nie SVG — bez pułapki §387)
  orientation: 'horizontal' | 'vertical';
}

export const DEFAULT_PROGRESS_BAR_STYLE: ProgressBarStyle = {
  fillColor: '#3B82F6',
  trackColor: '#1E293B',
  cornerRadius: 10,
  orientation: 'horizontal',
};

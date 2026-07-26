import { Redirect } from 'expo-router';

// Merged into the unified "Baza jedzenia" screen (app/food/products.tsx) — Produkty and
// Kompozycje i dania are now internal tabs there. This route stays as a redirect so any
// old links / deep links land on the right tab.
export default function FoodLibraryRedirect() {
  return <Redirect href={'/food/products?tab=kompozycje' as any} />;
}

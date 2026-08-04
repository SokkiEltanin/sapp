import { CosmeticTier } from '@/utils/petShop';

// CUSTOMOWE STARTUPY z folderu assets/startups/ (patrz assets/startups/README.md).
// Wrzucasz plik NAZWA_CENA.webp (np. IDEALNIAK_130.webp) — Metro `require.context` wylistuje
// go przy buildzie, a my parsujemy nazwę → startup. Renderowane przez <Image> (animowany
// WebP zapętla się natywnie na Androidzie), więc BEZ nowych natywnych zależności.
//
// UWAGA: pliki są WBUDOWANE przy kompilacji APK (jak ikona/splash) → nowy plik = nowy build,
// nie wskoczy przez OTA.

export interface CustomStartup {
  id: string;      // 'custom:IDEALNIAK'
  rawId: string;   // 'IDEALNIAK'
  name: string;    // 'Idealniak'
  cost: number;    // 130 (0 = darmowy)
  asset: number;   // wynik require() → <Image source>
  tier: CosmeticTier;
}

function titleCase(s: string): string {
  const t = s.replace(/_+/g, ' ').trim().toLowerCase();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

// "IDEALNIAK_130" → { rawId:'IDEALNIAK', name:'Idealniak', cost:130 }.
// Cena = OSTATNI człon, jeśli jest liczbą; inaczej darmowy.
function parseName(base: string): { rawId: string; name: string; cost: number } {
  const parts = base.split('_');
  let cost = 0;
  if (parts.length > 1 && /^\d+$/.test(parts[parts.length - 1])) {
    cost = parseInt(parts.pop() as string, 10);
  }
  const rawId = parts.join('_') || base;
  return { rawId, name: titleCase(rawId), cost };
}

export const CUSTOM_STARTUPS: CustomStartup[] = (() => {
  try {
    // Metro require.context — auto-detekcja plików z folderu przy buildzie.
    const ctx = (require as any).context('../../assets/startups', false, /\.(webp|gif)$/);
    return (ctx.keys() as string[]).map((k) => {
      const base = k.replace(/^.*[\\/]/, '').replace(/\.(webp|gif)$/i, '');
      const { rawId, name, cost } = parseName(base);
      return { id: `custom:${rawId}`, rawId, name, cost, asset: ctx(k) as number, tier: 'epic' as CosmeticTier };
    });
  } catch {
    return [];   // brak folderu / brak wsparcia require.context → po prostu zero customów
  }
})();

export function customById(id: string): CustomStartup | undefined {
  return CUSTOM_STARTUPS.find(c => c.id === id);
}

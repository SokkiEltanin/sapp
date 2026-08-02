import { CosmeticTier } from '@/utils/petShop';

// "Customowe startupy" — kosmetyki EKRANU ŁADOWANIA (splash), kupowane monetami pupila.
// Wszystkie trzymają CIEMNE tło apki (#1A1C1C) → bezszwowy handoff z natywnym splashem;
// różnią się KOLOREM napisu (ink), rodzajem ANIMACJI i opcjonalną poświatą. Domyślny
// 'default' = obecna biała fala, darmowy. Odczytywane przez AnimatedSplash (pole
// equippedStartup w petStore). Kupno przez usePetStore.buyStartup (owned w ownedItems
// pod kluczem `startup:<id>` → trafia do backupu jak reszta ekonomii).

export type SplashAnim = 'wave' | 'pulse' | 'sweep';

export interface Startup {
  id: string;
  name: string;
  tier: CosmeticTier;   // basic / rare / epic — spójnie z kolorami w sklepie
  cost: number;         // 0 = darmowy (default)
  ink: string;          // kolor napisu "Sapp"
  anim: SplashAnim;     // rodzaj animacji
  glow?: boolean;       // subtelna poświata (akcent epicki)
  blurb: string;
}

export const SPLASH_BG = '#1A1C1C';   // = tło apki + app.json splash → seamless handoff

export const ANIM_LABEL: Record<SplashAnim, string> = {
  wave: 'fala', pulse: 'oddech', sweep: 'błysk',
};

export const STARTUPS: Startup[] = [
  { id: 'default',  name: 'Fala',     tier: 'basic', cost: 0,   ink: '#F2F3F3', anim: 'wave',              blurb: 'Domyślny — biała fala po literach' },
  { id: 'oddech',   name: 'Oddech',   tier: 'basic', cost: 45,  ink: '#F2F3F3', anim: 'pulse',            blurb: 'Spokojne pulsowanie napisu' },
  { id: 'blysk',    name: 'Błysk',    tier: 'basic', cost: 70,  ink: '#F2F3F3', anim: 'sweep',            blurb: 'Smuga światła pod napisem' },
  { id: 'bursztyn', name: 'Bursztyn', tier: 'rare',  cost: 130, ink: '#FBBF24', anim: 'wave',             blurb: 'Bursztynowa fala' },
  { id: 'mieta',    name: 'Mięta',    tier: 'rare',  cost: 130, ink: '#7CF3C8', anim: 'pulse',            blurb: 'Miętowy oddech' },
  { id: 'lazur',    name: 'Lazur',    tier: 'rare',  cost: 150, ink: '#7DD3FC', anim: 'sweep',            blurb: 'Lazurowa smuga' },
  { id: 'neon',     name: 'Neon',     tier: 'epic',  cost: 240, ink: '#C084FC', anim: 'sweep', glow: true, blurb: 'Fioletowy neon z poświatą' },
  { id: 'zloto',    name: 'Złoto',    tier: 'epic',  cost: 280, ink: '#FFD57A', anim: 'wave',  glow: true, blurb: 'Złota fala z poświatą' },
];

export function startupById(id: string): Startup {
  return STARTUPS.find(s => s.id === id) ?? STARTUPS[0];
}

import { CosmeticTier } from '@/utils/petShop';

// "Customowe startupy" — kosmetyki EKRANU ŁADOWANIA (splash), kupowane monetami pupila.
// Wszystkie na CZARNYM tle (#000) → mocny, spójny look. Różnią się KOLOREM (ink),
// rodzajem ANIMACJI i poświatą. Domyślny 'default' = płynny pasek ładowania, darmowy.
// Odczytywane przez AnimatedSplash (equippedStartup w petStore). Kupno przez
// usePetStore.buyStartup (owned w ownedItems pod `startup:<id>` → trafia do backupu).

export type SplashAnim = 'bar' | 'wave' | 'pulse' | 'sweep' | 'cateyes';

export interface Startup {
  id: string;
  name: string;
  tier: CosmeticTier;   // basic / rare / epic — spójnie z kolorami w sklepie
  cost: number;         // 0 = darmowy (default)
  ink: string;          // kolor akcentu (pasek / napis / ślepia)
  anim: SplashAnim;     // rodzaj animacji
  glow?: boolean;       // poświata (akcent epicki)
  blurb: string;
}

export const SPLASH_BG = '#000000';   // czarne tło (= app.json splash) → seamless handoff

export const ANIM_LABEL: Record<SplashAnim, string> = {
  bar: 'płynny pasek', wave: 'fala', pulse: 'oddech', sweep: 'błysk', cateyes: 'kocie ślepia',
};

export const STARTUPS: Startup[] = [
  { id: 'default',  name: 'Płynny pasek', tier: 'basic', cost: 0,   ink: '#F2F3F3', anim: 'bar',                 blurb: 'Domyślny — płynny pasek ładowania' },
  { id: 'fala',     name: 'Fala',         tier: 'basic', cost: 45,  ink: '#F2F3F3', anim: 'wave',                blurb: 'Fala światła po literach' },
  { id: 'oddech',   name: 'Oddech',       tier: 'basic', cost: 60,  ink: '#F2F3F3', anim: 'pulse',               blurb: 'Spokojne pulsowanie napisu' },
  { id: 'blysk',    name: 'Błysk',        tier: 'basic', cost: 70,  ink: '#F2F3F3', anim: 'sweep',               blurb: 'Smuga światła pod napisem' },
  { id: 'bursztyn', name: 'Bursztyn',     tier: 'rare',  cost: 130, ink: '#FBBF24', anim: 'bar',                 blurb: 'Bursztynowy płynny pasek' },
  { id: 'mieta',    name: 'Mięta',        tier: 'rare',  cost: 130, ink: '#7CF3C8', anim: 'wave',                blurb: 'Miętowa fala' },
  { id: 'lazur',    name: 'Lazur',        tier: 'rare',  cost: 150, ink: '#7DD3FC', anim: 'sweep',               blurb: 'Lazurowa smuga' },
  { id: 'slepia',   name: 'Kocie ślepia', tier: 'epic',  cost: 260, ink: '#86EFAC', anim: 'cateyes', glow: true, blurb: 'Ślepia kota odpalają się w ciemności' },
  { id: 'neon',     name: 'Neon',         tier: 'epic',  cost: 240, ink: '#C084FC', anim: 'sweep',   glow: true, blurb: 'Fioletowy neon z poświatą' },
  { id: 'zloto',    name: 'Złoto',        tier: 'epic',  cost: 280, ink: '#FFD57A', anim: 'bar',     glow: true, blurb: 'Złoty pasek z poświatą' },
];

export function startupById(id: string): Startup {
  return STARTUPS.find(s => s.id === id) ?? STARTUPS[0];
}

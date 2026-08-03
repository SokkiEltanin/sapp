import { CosmeticTier } from '@/utils/petShop';

// "Customowe startupy" — kosmetyki EKRANU ŁADOWANIA (splash), kupowane monetami pupila.
// Wszystkie na CZARNYM tle (#000) → mocny, spójny look. Różnią się KOLOREM (ink),
// rodzajem ANIMACJI i poświatą. Domyślny 'default' = płynny pasek ładowania, darmowy.
// Odczytywane przez AnimatedSplash (equippedStartup w petStore). Kupno przez
// usePetStore.buyStartup (owned w ownedItems pod `startup:<id>` → trafia do backupu).

export type SplashAnim = 'bar' | 'wave' | 'pulse' | 'sweep' | 'ring' | 'cateyes' | 'cat';

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
  bar: 'płynny pasek', wave: 'fala', pulse: 'oddech', sweep: 'błysk', ring: 'orbita', cateyes: 'kocie ślepia', cat: 'twój kot',
};

// Kuracja po feedbacku: koniec z „ten sam ruch, inny kolor za 280". Każdy tier ma sens:
//  • BASIC = czyste, białe, tanie (pasek / fala / oddech / błysk),
//  • RARE  = kolor + jeden wyróżniający ruch (m.in. ORBITA — obracający się pierścień, nie tekst),
//  • EPIC  = pokazówki: prawdziwe KOCIE ŚLEPIA (SVG), złota ORBITA, neon, i TWÓJ KOT na splashu.
export const STARTUPS: Startup[] = [
  { id: 'default',  name: 'Płynny pasek', tier: 'basic', cost: 0,   ink: '#F2F3F3', anim: 'bar',                 blurb: 'Domyślny — płynny pasek ładowania' },
  { id: 'fala',     name: 'Fala',         tier: 'basic', cost: 40,  ink: '#F2F3F3', anim: 'wave',                blurb: 'Fala światła po literach' },
  { id: 'oddech',   name: 'Oddech',       tier: 'basic', cost: 45,  ink: '#F2F3F3', anim: 'pulse',               blurb: 'Spokojne pulsowanie napisu' },
  { id: 'blysk',    name: 'Błysk',        tier: 'basic', cost: 55,  ink: '#F2F3F3', anim: 'sweep',               blurb: 'Smuga światła pod napisem' },
  { id: 'bursztyn', name: 'Bursztyn',     tier: 'rare',  cost: 90,  ink: '#FBBF24', anim: 'bar',                 blurb: 'Bursztynowy płynny pasek' },
  { id: 'mieta',    name: 'Mięta',        tier: 'rare',  cost: 95,  ink: '#7CF3C8', anim: 'wave',                blurb: 'Miętowa fala' },
  { id: 'lazur',    name: 'Orbita',       tier: 'rare',  cost: 120, ink: '#7DD3FC', anim: 'ring',                blurb: 'Obracający się pierścień ładowania' },
  { id: 'slepia',   name: 'Kocie ślepia', tier: 'epic',  cost: 220, ink: '#86EFAC', anim: 'cateyes', glow: true, blurb: 'Prawdziwe kocie oczy odpalają się w ciemności' },
  { id: 'neon',     name: 'Neon',         tier: 'epic',  cost: 190, ink: '#C084FC', anim: 'sweep',   glow: true, blurb: 'Fioletowy neon z poświatą' },
  { id: 'zloto',    name: 'Złota orbita', tier: 'epic',  cost: 230, ink: '#FFD57A', anim: 'ring',    glow: true, blurb: 'Złoty pierścień z poświatą' },
  { id: 'kot',      name: 'Twój kot',     tier: 'epic',  cost: 300, ink: '#F2F3F3', anim: 'cat',     glow: true, blurb: 'Twój kot wita Cię przy starcie — w Twoim kolorze i z pręgami' },
];

export function startupById(id: string): Startup {
  return STARTUPS.find(s => s.id === id) ?? STARTUPS[0];
}

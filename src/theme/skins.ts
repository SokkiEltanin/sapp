// Unlockable dashboard "skins". A skin overrides the time-of-day accent + hero
// wash colours (keeping the time-based greeting), so the whole dashboard, tab bar
// and animated card backgrounds re-tint when you equip one. Unlocked by collecting
// month cards (and the legendary one by owning a sapphire card) — ties the
// collectible loop to a tangible reward.

export interface SkinColors {
  color: string;        // accent
  gradientTop: string;  // hero wash top
  cardBg: string;       // elevated card bg
  cardBgDark: string;   // darker card bg
}

export type SkinUnlock = { kind: 'free' } | { kind: 'cards'; n: number } | { kind: 'legendary' };

export interface Skin {
  id: string;
  name: string;
  emoji: string;
  preview: [string, string];   // swatch gradient [from, to]
  colors: SkinColors | null;   // null = follow the time-of-day default
  unlock: SkinUnlock;
}

export const SKINS: Skin[] = [
  { id: 'auto',   name: 'Dzień i noc',   emoji: '🌗', preview: ['#46B0DE', '#5B7BE3'], colors: null, unlock: { kind: 'free' } },
  { id: 'ocean',  name: 'Ocean',         emoji: '🌊', preview: ['#22D3EE', '#0E3A44'], colors: { color: '#22D3EE', gradientTop: '#071E26', cardBg: '#0E3A44', cardBgDark: '#0A2A31' }, unlock: { kind: 'free' } },
  { id: 'grape',  name: 'Winogrono',     emoji: '🍇', preview: ['#A78BFA', '#2A1E44'], colors: { color: '#A78BFA', gradientTop: '#140B26', cardBg: '#2A1E44', cardBgDark: '#1F1733' }, unlock: { kind: 'free' } },
  { id: 'mono',   name: 'Grafit',        emoji: '🖤', preview: ['#94A3B8', '#1E252E'], colors: { color: '#94A3B8', gradientTop: '#0B0F14', cardBg: '#1E252E', cardBgDark: '#161C24' }, unlock: { kind: 'cards', n: 2 } },
  { id: 'sakura', name: 'Sakura',        emoji: '🌸', preview: ['#F472B6', '#3B1A2A'], colors: { color: '#F472B6', gradientTop: '#240A18', cardBg: '#3B1A2A', cardBgDark: '#2E1422' }, unlock: { kind: 'cards', n: 3 } },
  { id: 'forest', name: 'Las',           emoji: '🌲', preview: ['#34D399', '#123A2C'], colors: { color: '#34D399', gradientTop: '#06231A', cardBg: '#123A2C', cardBgDark: '#0D2A20' }, unlock: { kind: 'cards', n: 5 } },
  { id: 'sunset', name: 'Zachód słońca', emoji: '🌅', preview: ['#FB923C', '#3B1E12'], colors: { color: '#FB923C', gradientTop: '#2A0E06', cardBg: '#3B1E12', cardBgDark: '#2E1509' }, unlock: { kind: 'cards', n: 8 } },
  { id: 'gold',   name: 'Złoto',         emoji: '👑', preview: ['#FBBF24', '#3B2E0F'], colors: { color: '#FBBF24', gradientTop: '#241A05', cardBg: '#3B2E0F', cardBgDark: '#2E2409' }, unlock: { kind: 'cards', n: 12 } },
  { id: 'sapphire', name: 'Szafir',      emoji: '🔷', preview: ['#3B82F6', '#172554'], colors: { color: '#3B82F6', gradientTop: '#0A1533', cardBg: '#172554', cardBgDark: '#101B3D' }, unlock: { kind: 'legendary' } },
];

export interface SkinProgress { cards: number; legendary: boolean }

export const EMPTY_PROGRESS: SkinProgress = { cards: 0, legendary: false };

export function isSkinUnlocked(skin: Skin, p: SkinProgress): boolean {
  switch (skin.unlock.kind) {
    case 'free':      return true;
    case 'cards':     return p.cards >= skin.unlock.n;
    case 'legendary': return p.legendary;
  }
}

export function skinUnlockHint(skin: Skin): string {
  switch (skin.unlock.kind) {
    case 'free':      return 'Dostępna';
    case 'cards':     return `Zbierz ${skin.unlock.n} ${skin.unlock.n === 1 ? 'kartę' : skin.unlock.n <= 4 ? 'karty' : 'kart'} miesiąca`;
    case 'legendary': return 'Zdobądź legendarną kartę (szafir)';
  }
}

export function skinById(id: string): Skin | undefined {
  return SKINS.find(s => s.id === id);
}

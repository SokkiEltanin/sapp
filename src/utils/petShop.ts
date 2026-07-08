// Shop catalogue: things you buy for the blob with coins earned from quests.
// Wearables (hat / face / held) render as emoji "stickers" on the blob; room items
// swap the pet-page backdrop. Emoji here are intentional design pieces.

export type CosmeticSlot = 'hat' | 'face' | 'held' | 'room';

// Rarity tiers — the more polished / desirable the item, the higher the tier and
// the price. Basic bits are cheap impulse buys; legendary pieces (crown, cosmos
// backdrop) are long-term goals you save coins toward.
export type CosmeticTier = 'basic' | 'rare' | 'epic' | 'legendary';

export const TIER_META: Record<CosmeticTier, { label: string; color: string }> = {
  basic:     { label: 'Zwykły',     color: '#8A94A6' },
  rare:      { label: 'Rzadki',     color: '#4DA8FF' },
  epic:      { label: 'Epicki',     color: '#B061FF' },
  legendary: { label: 'Legendarny', color: '#FBBF24' },
};

export interface Cosmetic {
  id: string;
  name: string;
  slot: CosmeticSlot;
  tier: CosmeticTier;
  cost: number;
  emoji?: string;              // wearable sticker
  colors?: [string, string];   // room backdrop gradient
  decor?: string[];            // room corner decorations
}

export const COSMETICS: Cosmetic[] = [
  // ── Czapki ──
  { id: 'hat_cap',    name: 'Czapka',      slot: 'hat', tier: 'basic',     cost: 25,  emoji: '🧢' },
  { id: 'hat_bow',    name: 'Kokarda',     slot: 'hat', tier: 'basic',     cost: 30,  emoji: '🎀' },
  { id: 'hat_top',    name: 'Cylinder',    slot: 'hat', tier: 'rare',      cost: 55,  emoji: '🎩' },
  { id: 'hat_grad',   name: 'Biret',       slot: 'hat', tier: 'rare',      cost: 60,  emoji: '🎓' },
  { id: 'hat_crown',  name: 'Korona',      slot: 'hat', tier: 'legendary', cost: 180, emoji: '👑' },

  // ── Twarz ──
  { id: 'face_glass', name: 'Okularki',    slot: 'face', tier: 'basic',    cost: 25,  emoji: '👓' },
  { id: 'face_shade', name: 'Słoneczne',   slot: 'face', tier: 'rare',     cost: 50,  emoji: '🕶️' },
  { id: 'face_dis',   name: 'Przebranie',  slot: 'face', tier: 'epic',     cost: 90,  emoji: '🥸' },

  // ── Trzymane ──
  { id: 'held_balloon', name: 'Balonik',   slot: 'held', tier: 'basic',    cost: 18,  emoji: '🎈' },
  { id: 'held_lolly',   name: 'Lizak',     slot: 'held', tier: 'basic',    cost: 22,  emoji: '🍭' },
  { id: 'held_flower',  name: 'Kwiatek',   slot: 'held', tier: 'basic',    cost: 22,  emoji: '🌸' },
  { id: 'held_guitar',  name: 'Gitara',    slot: 'held', tier: 'epic',     cost: 85,  emoji: '🎸' },
  { id: 'held_sword',   name: 'Miecz',     slot: 'held', tier: 'epic',     cost: 100, emoji: '⚔️' },

  // ── Pokój (tło) — the polished backdrops are the premium tier ──
  { id: 'room_night',  name: 'Noc',        slot: 'room', tier: 'rare',      cost: 50,  colors: ['#1E2A52', '#0B1024'], decor: ['⭐', '🌙'] },
  { id: 'room_meadow', name: 'Łąka',       slot: 'room', tier: 'rare',      cost: 55,  colors: ['#2E5A3A', '#14301F'], decor: ['🌼', '🌿'] },
  { id: 'room_beach',  name: 'Plaża',      slot: 'room', tier: 'epic',      cost: 90,  colors: ['#2F6270', '#153038'], decor: ['🐚', '🌴'] },
  { id: 'room_candy',  name: 'Cukierkowo', slot: 'room', tier: 'epic',      cost: 110, colors: ['#6B2A52', '#2E1226'], decor: ['🍬', '🧁'] },
  { id: 'room_space',  name: 'Kosmos',     slot: 'room', tier: 'legendary', cost: 200, colors: ['#2A1E52', '#0E0A24'], decor: ['🚀', '✨'] },
];

export const SLOT_LABEL: Record<CosmeticSlot, string> = {
  hat: 'Czapki', face: 'Twarz', held: 'Trzymane', room: 'Pokój',
};
export const SLOT_ORDER: CosmeticSlot[] = ['hat', 'face', 'held', 'room'];

export function cosmeticById(id?: string): Cosmetic | undefined {
  return id ? COSMETICS.find(c => c.id === id) : undefined;
}

// Emoji stickers to draw on the blob for the currently-equipped wearables.
export function equippedStickers(equipped: Record<string, string>): { hat?: string; face?: string; held?: string } {
  return {
    hat: cosmeticById(equipped.hat)?.emoji,
    face: cosmeticById(equipped.face)?.emoji,
    held: cosmeticById(equipped.held)?.emoji,
  };
}

export function equippedRoom(equipped: Record<string, string>): Cosmetic | undefined {
  return cosmeticById(equipped.room);
}

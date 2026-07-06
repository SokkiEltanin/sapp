// Shop catalogue: things you buy for the blob with coins earned from quests.
// Wearables (hat / face / held) render as emoji "stickers" on the blob; room items
// swap the pet-page backdrop. Emoji here are intentional design pieces.

export type CosmeticSlot = 'hat' | 'face' | 'held' | 'room';

export interface Cosmetic {
  id: string;
  name: string;
  slot: CosmeticSlot;
  cost: number;
  emoji?: string;              // wearable sticker
  colors?: [string, string];   // room backdrop gradient
  decor?: string[];            // room corner decorations
}

export const COSMETICS: Cosmetic[] = [
  // ── Czapki ──
  { id: 'hat_cap',    name: 'Czapka',      slot: 'hat', cost: 10, emoji: '🧢' },
  { id: 'hat_bow',    name: 'Kokarda',     slot: 'hat', cost: 12, emoji: '🎀' },
  { id: 'hat_top',    name: 'Cylinder',    slot: 'hat', cost: 16, emoji: '🎩' },
  { id: 'hat_grad',   name: 'Biret',       slot: 'hat', cost: 18, emoji: '🎓' },
  { id: 'hat_crown',  name: 'Korona',      slot: 'hat', cost: 30, emoji: '👑' },

  // ── Twarz ──
  { id: 'face_glass', name: 'Okularki',    slot: 'face', cost: 10, emoji: '👓' },
  { id: 'face_shade', name: 'Słoneczne',   slot: 'face', cost: 14, emoji: '🕶️' },
  { id: 'face_dis',   name: 'Przebranie',  slot: 'face', cost: 20, emoji: '🥸' },

  // ── Trzymane ──
  { id: 'held_balloon', name: 'Balonik',   slot: 'held', cost: 6,  emoji: '🎈' },
  { id: 'held_lolly',   name: 'Lizak',     slot: 'held', cost: 8,  emoji: '🍭' },
  { id: 'held_flower',  name: 'Kwiatek',   slot: 'held', cost: 8,  emoji: '🌸' },
  { id: 'held_guitar',  name: 'Gitara',    slot: 'held', cost: 20, emoji: '🎸' },
  { id: 'held_sword',   name: 'Miecz',     slot: 'held', cost: 25, emoji: '⚔️' },

  // ── Pokój (tło) ──
  { id: 'room_night',  name: 'Noc',        slot: 'room', cost: 12, colors: ['#1E2A52', '#0B1024'], decor: ['⭐', '🌙'] },
  { id: 'room_meadow', name: 'Łąka',       slot: 'room', cost: 14, colors: ['#2E5A3A', '#14301F'], decor: ['🌼', '🌿'] },
  { id: 'room_beach',  name: 'Plaża',      slot: 'room', cost: 18, colors: ['#2F6270', '#153038'], decor: ['🐚', '🌴'] },
  { id: 'room_candy',  name: 'Cukierkowo', slot: 'room', cost: 22, colors: ['#6B2A52', '#2E1226'], decor: ['🍬', '🧁'] },
  { id: 'room_space',  name: 'Kosmos',     slot: 'room', cost: 26, colors: ['#2A1E52', '#0E0A24'], decor: ['🚀', '✨'] },
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

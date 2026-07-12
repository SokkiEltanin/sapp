// Shop catalogue: things you buy for the cat with coins earned from quests + tasks.
// Hat / face / neck are custom vector accessories drawn to fit the cat (see
// CatAccessories). Held items render as emoji "stickers"; room items swap the
// pet-page backdrop. Emoji here are intentional design pieces.

export type CosmeticSlot = 'hat' | 'face' | 'neck' | 'held' | 'room';

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
  // ── Czapki (custom, fitted to the cat) ──
  { id: 'hat_beanie', name: 'Czapka zimowa',      slot: 'hat', tier: 'basic',     cost: 30,  emoji: '🧢' },
  { id: 'hat_party',  name: 'Czapka urodzinowa',  slot: 'hat', tier: 'rare',      cost: 50,  emoji: '🎉' },
  { id: 'hat_beret',  name: 'Beret',              slot: 'hat', tier: 'rare',      cost: 60,  emoji: '🎨' },
  { id: 'hat_flower', name: 'Wianek z kwiatów',   slot: 'hat', tier: 'rare',      cost: 55,  emoji: '🌸' },
  { id: 'hat_wizard', name: 'Kapelusz czarodzieja', slot: 'hat', tier: 'epic',   cost: 95,  emoji: '🧙' },
  { id: 'hat_crown',  name: 'Korona',             slot: 'hat', tier: 'legendary', cost: 180, emoji: '👑' },

  // ── Twarz (custom) ──
  { id: 'face_round',   name: 'Okrągłe okulary',   slot: 'face', tier: 'basic',   cost: 28,  emoji: '👓' },
  { id: 'face_shades',  name: 'Okulary słoneczne', slot: 'face', tier: 'rare',    cost: 55,  emoji: '🕶️' },
  { id: 'face_monocle', name: 'Monokl',            slot: 'face', tier: 'epic',    cost: 75,  emoji: '🧐' },

  // ── Szyja (custom) ──
  { id: 'neck_collar', name: 'Obroża z dzwonkiem', slot: 'neck', tier: 'basic',   cost: 35,  emoji: '🔔' },
  { id: 'neck_bow',    name: 'Muszka',             slot: 'neck', tier: 'rare',    cost: 48,  emoji: '🎀' },
  { id: 'neck_scarf',  name: 'Szalik',             slot: 'neck', tier: 'rare',    cost: 45,  emoji: '🧣' },

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

// ── Room upgrades: extra elements you buy with coins and add INTO a room's scene
// (a boat on the beach, a satellite in space…). Owned + toggled per room; rendered
// by PetScene's AddonLayer. Emoji here is just the shop-chip icon.
export interface RoomAddon {
  id: string;
  room: string;      // room cosmetic id it decorates
  name: string;
  tier: CosmeticTier;
  cost: number;
  emoji: string;     // shop chip icon
}

export const ROOM_ADDONS: RoomAddon[] = [
  // Plaża
  { id: 'beach_ship',       room: 'room_beach',  name: 'Żaglówka',        tier: 'rare',  cost: 45, emoji: '⛵' },
  { id: 'beach_lighthouse', room: 'room_beach',  name: 'Latarnia morska', tier: 'epic',  cost: 75, emoji: '🗼' },
  { id: 'beach_gulls',      room: 'room_beach',  name: 'Więcej mew',      tier: 'basic', cost: 25, emoji: '🕊️' },
  // Noc
  { id: 'night_shooting',   room: 'room_night',  name: 'Spadające gwiazdy', tier: 'rare',  cost: 40, emoji: '💫' },
  { id: 'night_owl',        room: 'room_night',  name: 'Sowa na wzgórzu', tier: 'rare',  cost: 45, emoji: '🦉' },
  // Łąka
  { id: 'meadow_rainbow',   room: 'room_meadow', name: 'Tęcza',           tier: 'rare',  cost: 45, emoji: '🌈' },
  { id: 'meadow_balloon',   room: 'room_meadow', name: 'Balon',           tier: 'epic',  cost: 60, emoji: '🎈' },
  // Cukierkowo
  { id: 'candy_extra',      room: 'room_candy',  name: 'Więcej lizaków',  tier: 'basic', cost: 30, emoji: '🍭' },
  { id: 'candy_cupcake',    room: 'room_candy',  name: 'Babeczka',        tier: 'rare',  cost: 42, emoji: '🧁' },
  // Kosmos
  { id: 'space_planet2',    room: 'room_space',  name: 'Druga planeta',   tier: 'epic',  cost: 75, emoji: '🪐' },
  { id: 'space_satellite',  room: 'room_space',  name: 'Satelita',        tier: 'rare',  cost: 50, emoji: '🛰️' },
  { id: 'space_ufo',        room: 'room_space',  name: 'UFO',             tier: 'epic',  cost: 85, emoji: '🛸' },
];

export function roomAddonsFor(roomId?: string): RoomAddon[] {
  return roomId ? ROOM_ADDONS.filter(a => a.room === roomId) : [];
}
export function roomAddonById(id?: string): RoomAddon | undefined {
  return id ? ROOM_ADDONS.find(a => a.id === id) : undefined;
}

export const SLOT_LABEL: Record<CosmeticSlot, string> = {
  hat: 'Czapki', face: 'Twarz', neck: 'Szyja', held: 'Trzymane', room: 'Pokój',
};
export const SLOT_ORDER: CosmeticSlot[] = ['hat', 'face', 'neck', 'held', 'room'];

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

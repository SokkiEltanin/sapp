// Quests = how you earn coins (and a little XP) for the companion, by doing things
// that are good for YOU. Two kinds:
//  • daily quests — repeatable, reset every day (log mood, hit 10k/20k steps, all habits)
//  • milestone quests — one-time tiered payouts as a cumulative stat crosses thresholds
//    (sweetless-days ladder, step-day record, habit streak, cards collected)

export interface QuestCtx {
  stepsToday: number;
  moodLoggedToday: boolean;
  habitsDone: number;
  habitsTotal: number;
  sweetlessDays: number;   // days since the last sweet/snack purchase
  bestStepDay: number;     // all-time best single-day step count on record
  habitBestStreak: number;
  cardsCollected: number;
}

export interface ClaimState {
  claimedMilestones: string[];         // tier ids already claimed
  dailyClaims: Record<string, string>; // dailyId → YYYY-MM-DD
  today: string;                       // YYYY-MM-DD
}

// ─── Daily quests ───────────────────────────────────────────────────────────
interface DailyDef { id: string; label: string; coins: number; xp: number; done: (c: QuestCtx) => boolean; note?: (c: QuestCtx) => string }
const DAILY: DailyDef[] = [
  { id: 'd_mood',    label: 'Wpisz humor dziś',      coins: 1, xp: 3, done: c => c.moodLoggedToday },
  { id: 'd_steps10', label: '10 000 kroków',          coins: 1, xp: 3, done: c => c.stepsToday >= 10000, note: c => `${c.stepsToday}/10000` },
  { id: 'd_steps20', label: '20 000 kroków',          coins: 1, xp: 4, done: c => c.stepsToday >= 20000, note: c => `${c.stepsToday}/20000` },
  { id: 'd_habits',  label: 'Wszystkie nawyki',       coins: 1, xp: 3, done: c => c.habitsTotal > 0 && c.habitsDone >= c.habitsTotal, note: c => c.habitsTotal > 0 ? `${c.habitsDone}/${c.habitsTotal}` : 'brak nawyków' },
];

export interface DailyQuestState { id: string; label: string; coins: number; xp: number; done: boolean; claimed: boolean; note?: string }

// ─── Milestone quests ───────────────────────────────────────────────────────
interface Tier { at: number; coins: number }
interface MilestoneDef { id: string; label: string; unit: string; value: (c: QuestCtx) => number; tiers: Tier[] }
const MILESTONES: MilestoneDef[] = [
  { id: 'm_sweetless', label: 'Bez słodyczy', unit: 'dni', value: c => c.sweetlessDays,
    tiers: [{ at: 10, coins: 1 }, { at: 30, coins: 3 }, { at: 50, coins: 5 }, { at: 100, coins: 12 }] },
  { id: 'm_steprec', label: 'Rekord kroków w dniu', unit: 'kroków', value: c => c.bestStepDay,
    tiers: [{ at: 10000, coins: 1 }, { at: 15000, coins: 2 }, { at: 20000, coins: 3 }] },
  { id: 'm_streak', label: 'Seria nawyku', unit: 'dni', value: c => c.habitBestStreak,
    tiers: [{ at: 7, coins: 2 }, { at: 30, coins: 5 }, { at: 100, coins: 15 }] },
  { id: 'm_cards', label: 'Karty miesiąca', unit: 'kart', value: c => c.cardsCollected,
    tiers: [{ at: 3, coins: 2 }, { at: 6, coins: 3 }, { at: 12, coins: 6 }] },
];

export interface MilestoneTierState { id: string; at: number; coins: number; xp: number; reached: boolean; claimed: boolean }
export interface MilestoneQuestState { id: string; label: string; unit: string; value: number; tiers: MilestoneTierState[]; nextAt: number | null }

export interface QuestsResult {
  daily: DailyQuestState[];
  milestones: MilestoneQuestState[];
  claimableCount: number;   // daily ready + milestone tiers reached-but-unclaimed
}

const milestoneXp = (coins: number) => coins * 10;

export function buildQuests(ctx: QuestCtx, claim: ClaimState): QuestsResult {
  let claimable = 0;

  const daily: DailyQuestState[] = DAILY.map(d => {
    const done = d.done(ctx);
    const claimed = claim.dailyClaims[d.id] === claim.today;
    if (done && !claimed) claimable++;
    return { id: d.id, label: d.label, coins: d.coins, xp: d.xp, done, claimed, note: d.note?.(ctx) };
  });

  const milestones: MilestoneQuestState[] = MILESTONES.map(m => {
    const value = m.value(ctx);
    const tiers: MilestoneTierState[] = m.tiers.map(t => {
      const id = `${m.id}:${t.at}`;
      const reached = value >= t.at;
      const claimed = claim.claimedMilestones.includes(id);
      if (reached && !claimed) claimable++;
      return { id, at: t.at, coins: t.coins, xp: milestoneXp(t.coins), reached, claimed };
    });
    const next = m.tiers.find(t => value < t.at);
    return { id: m.id, label: m.label, unit: m.unit, value, tiers, nextAt: next?.at ?? null };
  });

  return { daily, milestones, claimableCount: claimable };
}

// Days since the most recent sweet/snack receipt item (for the sweetless ladder).
export function sweetlessDaysFrom(expenses: { type?: string; date: string; receiptItems?: { tags?: string[]; excluded?: boolean; kind?: string }[] }[]): number {
  let last = '';
  for (const e of expenses) {
    if (e.type === 'income') continue;
    for (const it of (e.receiptItems ?? [])) {
      if (it.excluded || it.kind === 'deposit') continue;
      if ((it.tags ?? []).some(t => t === 'słodycze' || t === 'przekąski')) {
        const d = (e.date ?? '').slice(0, 10);
        if (d > last) last = d;
      }
    }
  }
  if (!last) return 0;
  const ms = Date.now() - new Date(last + 'T00:00:00').getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

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
  // ── optional (drives dynamic daily + weekly + monthly quests when provided) ──
  boughtSweetToday?: boolean;
  stepTarget?: number;         // adaptive "beat your form" step goal
  waterToday?: number;         // glasses drunk today
  waterGoal?: number;          // daily water goal (glasses)
  sleepMinutes?: number;       // last night's sleep (0 = unknown)
  affectionFull?: boolean;     // petted the cat to a full affection bar today
  moodDaysThisWeek?: number;   // distinct mood days this (Mon-based) week
  stepsThisWeek?: number;      // total steps this week
  habitDaysThisWeek?: number;  // days this week with ALL habits done
  moodDaysThisMonth?: number;  // distinct days with a mood entry this month
  stepsThisMonth?: number;     // total steps this month
}

export interface ClaimState {
  claimedMilestones: string[];         // tier ids already claimed
  dailyClaims: Record<string, string>; // dailyId → YYYY-MM-DD
  weeklyClaims?: Record<string, string>;  // weeklyId → week key (Monday YYYY-MM-DD)
  monthlyClaims?: Record<string, string>; // monthlyId → YYYY-MM
  today: string;                       // YYYY-MM-DD
  week?: string;                       // Monday of this week, YYYY-MM-DD
  month?: string;                      // YYYY-MM
}

// ─── Daily quests ───────────────────────────────────────────────────────────
interface DailyDef { id: string; label: string; coins: number; xp: number; done: (c: QuestCtx) => boolean; note?: (c: QuestCtx) => string }
const DAILY: DailyDef[] = [
  { id: 'd_mood',    label: 'Wpisz humor dziś',      coins: 1, xp: 3, done: c => c.moodLoggedToday },
  { id: 'd_steps10', label: '10 000 kroków',          coins: 1, xp: 3, done: c => c.stepsToday >= 10000, note: c => `${c.stepsToday}/10000` },
  { id: 'd_steps20', label: '20 000 kroków',          coins: 1, xp: 4, done: c => c.stepsToday >= 20000, note: c => `${c.stepsToday}/20000` },
  { id: 'd_habits',  label: 'Wszystkie nawyki',       coins: 1, xp: 3, done: c => c.habitsTotal > 0 && c.habitsDone >= c.habitsTotal, note: c => c.habitsTotal > 0 ? `${c.habitsDone}/${c.habitsTotal}` : 'brak nawyków' },
  { id: 'd_pet',     label: 'Pogłaszcz pupila do pełna', coins: 1, xp: 3, done: c => !!c.affectionFull, note: c => c.affectionFull ? 'zrobione ❤️' : 'stuknij kota' },
];

export interface DailyQuestState { id: string; label: string; coins: number; xp: number; done: boolean; claimed: boolean; note?: string }

// ─── Milestone quests ───────────────────────────────────────────────────────
interface Tier { at: number; coins: number }
interface MilestoneDef { id: string; label: string; unit: string; value: (c: QuestCtx) => number; tiers: Tier[] }
const MILESTONES: MilestoneDef[] = [
  { id: 'm_sweetless', label: 'Bez słodyczy', unit: 'dni', value: c => c.sweetlessDays,
    tiers: [{ at: 10, coins: 1 }, { at: 30, coins: 3 }, { at: 50, coins: 5 }, { at: 100, coins: 12 }, { at: 200, coins: 25 }] },
  { id: 'm_steprec', label: 'Rekord kroków w dniu', unit: 'kroków', value: c => c.bestStepDay,
    tiers: [{ at: 10000, coins: 1 }, { at: 15000, coins: 2 }, { at: 20000, coins: 3 }, { at: 25000, coins: 5 }, { at: 30000, coins: 8 }] },
  { id: 'm_streak', label: 'Seria nawyku', unit: 'dni', value: c => c.habitBestStreak,
    tiers: [{ at: 7, coins: 2 }, { at: 30, coins: 5 }, { at: 100, coins: 15 }, { at: 200, coins: 30 }] },
  { id: 'm_cards', label: 'Karty miesiąca', unit: 'kart', value: c => c.cardsCollected,
    tiers: [{ at: 3, coins: 2 }, { at: 6, coins: 3 }, { at: 12, coins: 6 }, { at: 24, coins: 12 }] },
];

export interface MilestoneTierState { id: string; at: number; coins: number; xp: number; reached: boolean; claimed: boolean }
export interface MilestoneQuestState { id: string; label: string; unit: string; value: number; tiers: MilestoneTierState[]; nextAt: number | null }

// ─── Dynamic bonus dailies (higher reward, adaptive to you) ─────────────────
interface BonusDef { id: string; coins: number; xp: number; available: (c: QuestCtx) => boolean; label: (c: QuestCtx) => string; note?: (c: QuestCtx) => string; done: (c: QuestCtx) => boolean }
const BONUS: BonusDef[] = [
  { id: 'b_stepbeat', coins: 2, xp: 6, available: c => (c.stepTarget ?? 0) > 0,
    label: c => `Pobij formę: ${c.stepTarget!.toLocaleString('pl-PL')} kroków`, note: c => `${c.stepsToday}/${c.stepTarget}`, done: c => c.stepsToday >= (c.stepTarget ?? Infinity) },
  { id: 'b_water', coins: 2, xp: 6, available: c => (c.waterGoal ?? 0) > 0,
    label: c => `Wypij ${c.waterGoal} szklanek wody`, note: c => `${c.waterToday ?? 0}/${c.waterGoal}`, done: c => (c.waterToday ?? 0) >= (c.waterGoal ?? Infinity) },
  { id: 'b_sleep', coins: 2, xp: 6, available: c => (c.sleepMinutes ?? 0) > 0,
    label: () => 'Prześpij 7 godzin', note: c => `${((c.sleepMinutes ?? 0) / 60).toFixed(1)}h / 7h`, done: c => (c.sleepMinutes ?? 0) >= 420 },
];

// ─── Monthly challenges (claim once per month) ──────────────────────────────
interface MonthlyDef { id: string; label: string; unit: string; coins: number; xp: number; target: number; value: (c: QuestCtx) => number | undefined }
const MONTHLY: MonthlyDef[] = [
  { id: 'mo_mood',    label: 'Nastrój przez 20 dni',       unit: 'dni',    coins: 15, xp: 120, target: 20,     value: c => c.moodDaysThisMonth },
  { id: 'mo_steps',   label: '150 000 kroków w miesiącu',  unit: 'kroków', coins: 12, xp: 100, target: 150000, value: c => c.stepsThisMonth },
  { id: 'mo_nosweet', label: '7 dni bez słodyczy z rzędu', unit: 'dni',    coins: 10, xp: 90,  target: 7,      value: c => c.sweetlessDays },
];

export interface MonthlyQuestState { id: string; label: string; unit: string; value: number; target: number; coins: number; xp: number; done: boolean; claimed: boolean; progress: number }

// ─── Weekly challenges (claim once per Mon-based week) ──────────────────────
interface WeeklyDef { id: string; label: string; unit: string; coins: number; xp: number; target: number; value: (c: QuestCtx) => number | undefined }
const WEEKLY: WeeklyDef[] = [
  { id: 'w_mood',   label: 'Nastrój przez 5 dni w tygodniu', unit: 'dni',    coins: 5, xp: 40, target: 5,     value: c => c.moodDaysThisWeek },
  { id: 'w_steps',  label: '70 000 kroków w tygodniu',       unit: 'kroków', coins: 6, xp: 45, target: 70000, value: c => c.stepsThisWeek },
  { id: 'w_habits', label: 'Wszystkie nawyki przez 4 dni',   unit: 'dni',    coins: 5, xp: 40, target: 4,     value: c => c.habitDaysThisWeek },
];
export interface WeeklyQuestState { id: string; label: string; unit: string; value: number; target: number; coins: number; xp: number; done: boolean; claimed: boolean; progress: number }

export interface QuestsResult {
  daily: DailyQuestState[];
  bonusDaily: DailyQuestState[];
  weekly: WeeklyQuestState[];
  milestones: MilestoneQuestState[];
  monthly: MonthlyQuestState[];
  claimableCount: number;   // everything ready-but-unclaimed
}

const milestoneXp = (coins: number) => coins * 10;

export function buildQuests(ctx: QuestCtx, claim: ClaimState): QuestsResult {
  let claimable = 0;
  const month = claim.month ?? claim.today.slice(0, 7);
  const monthlyClaims = claim.monthlyClaims ?? {};
  const week = claim.week ?? claim.today;
  const weeklyClaims = claim.weeklyClaims ?? {};

  const daily: DailyQuestState[] = DAILY.map(d => {
    const done = d.done(ctx);
    const claimed = claim.dailyClaims[d.id] === claim.today;
    if (done && !claimed) claimable++;
    return { id: d.id, label: d.label, coins: d.coins, xp: d.xp, done, claimed, note: d.note?.(ctx) };
  });

  const bonusDaily: DailyQuestState[] = BONUS.filter(b => b.available(ctx)).map(b => {
    const done = b.done(ctx);
    const claimed = claim.dailyClaims[b.id] === claim.today;
    if (done && !claimed) claimable++;
    return { id: b.id, label: b.label(ctx), coins: b.coins, xp: b.xp, done, claimed, note: b.note?.(ctx) };
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

  const monthly: MonthlyQuestState[] = MONTHLY.map(m => {
    const raw = m.value(ctx);
    return { def: m, raw };
  }).filter(x => x.raw !== undefined).map(({ def, raw }) => {
    const value = raw as number;
    const done = value >= def.target;
    const claimed = monthlyClaims[def.id] === month;
    if (done && !claimed) claimable++;
    return { id: def.id, label: def.label, unit: def.unit, value, target: def.target, coins: def.coins, xp: def.xp, done, claimed, progress: Math.min(1, value / def.target) };
  });

  const weekly: WeeklyQuestState[] = WEEKLY.map(w => ({ def: w, raw: w.value(ctx) }))
    .filter(x => x.raw !== undefined)
    .map(({ def, raw }) => {
      const value = raw as number;
      const done = value >= def.target;
      const claimed = weeklyClaims[def.id] === week;
      if (done && !claimed) claimable++;
      return { id: def.id, label: def.label, unit: def.unit, value, target: def.target, coins: def.coins, xp: def.xp, done, claimed, progress: Math.min(1, value / def.target) };
    });

  return { daily, bonusDaily, weekly, milestones, monthly, claimableCount: claimable };
}

// Monday (YYYY-MM-DD) of the week a date falls in — the weekly-claim key.
export function weekKeyOf(d = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // Mon=0 … Sun=6
  x.setDate(x.getDate() - dow);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
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

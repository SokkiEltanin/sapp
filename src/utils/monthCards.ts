import { Expense, MoodEntry } from '@/types';
import { consumesInScope, StatsScope } from '@/store/statsScope';
import { canonicalProductName } from '@/utils/productMemory';
import { PayMonthRow } from '@/utils/workSummary';
import { isFixedExpense } from '@/utils/fixedVariable';
import { isSelfTransfer } from '@/utils/statWidgets';

// ─────────────────────────────────────────────────────────────────────────────
// "Wrapped"-style COLLECTIBLE month cards. Each completed month becomes one card
// added to the collection — a Spotify-Wrapped-for-this-app: favourite sweets,
// step count, spend/earn, and how the month stacks up against the others.
// Emoji here are intentional design "stickers" (decorative only, on the card).
// ─────────────────────────────────────────────────────────────────────────────

export const SWEET_TAGS = ['słodycze', 'przekąski'];

const MONTH_NAMES = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];

// RARITY TIERS — the card's colour communicates how special the month is, like a
// graded collectible. Colour-graded (not metals): graphite (common) → emerald →
// azure → indigo → amethyst (legendary), drawn from the app's own palette so the
// cards sit in the dark theme instead of the old glaring copper/gold foil.
// [top, mid, bottom] gradient + accent + sticker + label.
export type MonthTier = 'grafitowa' | 'szmaragdowa' | 'lazurowa' | 'indygowa' | 'ametystowa';

const TIER_THEME: Record<MonthTier, { rank: number; palette: [string, string, string]; accent: string; emoji: string; label: string }> = {
  grafitowa:   { rank: 0, palette: ['#39424A', '#5A6873', '#161A1D'], accent: '#B6C2CC', emoji: '🪨', label: 'GRAFITOWA' },
  szmaragdowa: { rank: 1, palette: ['#14614C', '#2AC68F', '#0A241C'], accent: '#7CF3C8', emoji: '🟩', label: 'SZMARAGDOWA' },
  lazurowa:    { rank: 2, palette: ['#155A7E', '#46B0DE', '#0A2430'], accent: '#A5DEF5', emoji: '🟦', label: 'LAZUROWA' },
  indygowa:    { rank: 3, palette: ['#31408A', '#5B7BE3', '#141A33'], accent: '#B4C4FF', emoji: '🟪', label: 'INDYGOWA' },
  ametystowa:  { rank: 4, palette: ['#5B2E86', '#A855F7', '#1B1030'], accent: '#E4CCFF', emoji: '💠', label: 'LEGENDARNA · AMETYST' },
};

// notable = how many "records" the month holds → its tier on the ladder.
function tierFor(notable: number): MonthTier {
  if (notable >= 4) return 'ametystowa';
  if (notable === 3) return 'indygowa';
  if (notable === 2) return 'lazurowa';
  if (notable === 1) return 'szmaragdowa';
  return 'grafitowa';
}

const SWEET_EMOJI: [RegExp, string][] = [
  [/lod(y|ów)|ice/i, '🍦'],
  [/czekolad|chocolate|milka|wedel|alpen/i, '🍫'],
  [/baton|snickers|mars|twix|kinder|bounty/i, '🍫'],
  [/ciast(k|o|a)|herbatnik|krakers|oreo|cookie/i, '🍪'],
  [/pącz|donut|oponk/i, '🍩'],
  [/tort|sernik|brownie|muffin|babecz/i, '🍰'],
  [/wafel|wafl|prince|grze[sś]/i, '🧇'],
  [/lizak|lollipop/i, '🍭'],
  [/guma|orbit|mentos|tic.?tac/i, '🍬'],
  [/[żz]el(k|ki)|haribo|winne|misie|owocow.*[żz]el/i, '🐻'],
  [/miód|honey/i, '🍯'],
  [/chips|chrup|prażyn|nacho|tortill|paluszk|snack|przek[ąa]sk/i, '🥨'],
  [/napó?j|cola|pepsi|sok|energ|monster|redbull|red.?bull/i, '🥤'],
  [/cukier|cukr|dropsy|krów|toffi|karmel/i, '🍬'],
];

export function sweetEmoji(name: string): string {
  for (const [re, e] of SWEET_EMOJI) if (re.test(name)) return e;
  return '🍬';
}

export interface MonthCardSweet { name: string; count: number; spend: number; emoji: string }

export interface MonthCard {
  month: string;          // YYYY-MM
  monthName: string;      // "Grudzień"
  year: number;
  label: string;          // "Grudzień 2025"
  index: number;          // collection number (1 = oldest card)
  inProgress: boolean;    // current month, not yet "sealed"

  // headline stats
  totalSpend: number;
  totalIncome: number;
  balance: number;
  steps: number;          // total steps that month
  stepsDays: number;      // days with step data
  avgSteps: number;       // steps / stepsDays
  avgMood: number | null;
  earned: number;         // paycheck FOR that month (0 if unknown)
  sweetsSpend: number;
  sweets: MonthCardSweet[];   // top favourites, most-bought first

  // comparisons vs the whole collection
  spendRank: number;      // 1 = highest-spending month on record
  monthsTracked: number;
  stepsVsAvgPct: number | null;   // vs average tracked month
  spendVsPrevPct: number | null;  // vs the month before
  isTopMood: boolean;
  isTopSteps: boolean;
  isTopSweets: boolean;

  // presentation
  tier: MonthTier;        // rarity tier (drives the colour)
  tierRank: number;       // 0 (grafitowa) … 4 (ametystowa)
  tierLabel: string;      // "LAZUROWA" etc.
  tierEmoji: string;      // 🪨🟩🟦🟪💠
  palette: [string, string, string];
  accent: string;
  stickers: string[];     // decorative emoji
  headline: string;       // the one-line "wrapped" punchline
}

export interface MonthCardCtx {
  expenses: Expense[];
  moodEntries: MoodEntry[];
  healthDays: Record<string, { steps: number; sleepMinutes: number; weightKg: number | null }>;
  payMonths: PayMonthRow[];         // from computePayMonths — earnings per month
  nameAliases: Record<string, string>;
  scope?: StatsScope;               // 'mine' → only sweets I ate (eaters); default 'all'
  maxMonths?: number;               // cap (default 24)
}

function pad(n: number) { return String(n).padStart(2, '0'); }

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function prevKey(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

// ─── Month-to-date pace ─────────────────────────────────────────────────────
// "How am I doing this month vs last month AT THE SAME POINT?" — on the 15th this
// compares days 1–15 of this month against days 1–15 of last month, so a half-finished
// month isn't measured against a whole one (which always looked like a collapse).
export interface PaceRow {
  key: string; label: string; now: number; prev: number;
  pct: number | null;          // null when there's no previous baseline to compare to
  unit: string;
  lowerIsBetter?: boolean;     // spending down = good; steps down = bad
}
export interface MonthPace { day: number; prevLabel: string; rows: PaceRow[] }

export function buildMonthPace(ctx: MonthCardCtx): MonthPace | null {
  const day = new Date().getDate();
  const cur = currentMonthKey();
  const prev = prevKey(cur);
  const inRange = (iso: string, ym: string) =>
    iso.startsWith(ym) && Number(iso.slice(8, 10)) <= day;

  const steps = (ym: string) => Object.entries(ctx.healthDays)
    .filter(([d]) => inRange(d, ym))
    .reduce((s, [, v]) => s + (v.steps ?? 0), 0);

  const spend = (ym: string, pick: (e: Expense) => boolean) => ctx.expenses
    .filter(e => (e.type === 'expense' || !e.type) && !isSelfTransfer(e)
      && inRange((e.date ?? '').slice(0, 10), ym) && pick(e))
    .reduce((s, e) => s + e.amount, 0);

  const variable = (ym: string) => spend(ym, e => !isFixedExpense(e) && e.category !== 'groceries');
  const food = (ym: string) => spend(ym, e => !isFixedExpense(e) && e.category === 'groceries');

  const mk = (key: string, label: string, n: number, p: number, unit: string, lowerIsBetter?: boolean): PaceRow => ({
    key, label, now: Math.round(n), prev: Math.round(p),
    pct: p > 0 ? Math.round(((n - p) / p) * 100) : null, unit, lowerIsBetter,
  });

  const rows = [
    mk('steps', 'Kroki', steps(cur), steps(prev), ''),
    mk('variable', 'Wydatki zmienne', variable(cur), variable(prev), 'zł', true),
    mk('food', 'Jedzenie', food(cur), food(prev), 'zł', true),
  ].filter(r => r.now > 0 || r.prev > 0);
  if (!rows.length) return null;

  const pm = Number(prev.split('-')[1]);
  return { day, prevLabel: MONTH_NAMES[pm - 1], rows };
}

// Build the full collection, newest month first.
export function buildMonthCards(ctx: MonthCardCtx): MonthCard[] {
  const { expenses, moodEntries, healthDays, payMonths, nameAliases } = ctx;
  const scope = ctx.scope ?? 'all';
  const cap = ctx.maxMonths ?? 24;
  const nowKey = currentMonthKey();

  // ── which months exist at all (any signal) ────────────────────────────────
  const months = new Set<string>();
  for (const e of expenses) { const m = (e.date ?? '').slice(0, 7); if (m) months.add(m); }
  for (const e of moodEntries) { const m = (e.date ?? '').slice(0, 7); if (m) months.add(m); }
  for (const d of Object.keys(healthDays)) { const m = d.slice(0, 7); if (m) months.add(m); }
  for (const r of payMonths) if (r.month) months.add(r.month);
  const ordered = Array.from(months).filter(Boolean).sort();   // asc for indexing
  if (!ordered.length) return [];

  // ── per-month aggregates (spend / steps / mood / sweets / earnings) ────────
  type Agg = {
    spend: number; income: number; steps: number; stepDays: number;
    moodSum: number; moodN: number; sweetsSpend: number;
    sweets: Record<string, { count: number; spend: number; raw: string }>;
  };
  const agg: Record<string, Agg> = {};
  const ensure = (m: string) => (agg[m] ??= { spend: 0, income: 0, steps: 0, stepDays: 0, moodSum: 0, moodN: 0, sweetsSpend: 0, sweets: {} });

  for (const e of expenses) {
    const m = (e.date ?? '').slice(0, 7);
    if (!m) continue;
    const a = ensure(m);
    if (e.type === 'income') { a.income += e.amount; continue; }
    a.spend += e.amount;
    for (const it of (e.receiptItems ?? [])) {
      if (!consumesInScope(it, scope)) continue;
      if (!(it.tags ?? []).some(t => SWEET_TAGS.includes(t))) continue;
      a.sweetsSpend += it.price;
      const canon = canonicalProductName(it.name ?? '', nameAliases) || (it.name ?? '').trim();
      if (!canon) continue;
      const key = canon.toLowerCase();
      const s = (a.sweets[key] ??= { count: 0, spend: 0, raw: canon });
      s.count += Math.max(1, Math.round(it.quantity || 1));
      s.spend += it.price;
    }
  }
  for (const e of moodEntries) {
    const m = (e.date ?? '').slice(0, 7);
    if (!m) continue;
    const a = ensure(m); a.moodSum += e.mood; a.moodN++;
  }
  for (const [d, v] of Object.entries(healthDays)) {
    const m = d.slice(0, 7);
    if (!m || !v) continue;
    const a = ensure(m);
    if (v.steps > 0) { a.steps += v.steps; a.stepDays++; }
  }
  const earnedByMonth: Record<string, number> = {};
  for (const r of payMonths) earnedByMonth[r.month] = (earnedByMonth[r.month] ?? 0) + r.amount;

  // ── cross-month reference points for the comparisons ───────────────────────
  const spendByMonth = ordered.map(m => ({ m, v: agg[m]?.spend ?? 0 }));
  const spendRankList = [...spendByMonth].sort((a, b) => b.v - a.v).map(x => x.m);
  const avgMonthAvgSteps = (() => {
    const per = ordered.map(m => { const a = agg[m]; return a && a.stepDays > 0 ? a.steps / a.stepDays : null; })
      .filter((x): x is number => x != null);
    return per.length ? per.reduce((s, x) => s + x, 0) / per.length : 0;
  })();
  // REKORDY liczymy tylko wśród ZAMKNIĘTYCH miesięcy — miesiąc w trakcie (mało dni danych)
  // nie może zdobyć „najbardziej ruchliwy/najlepszy nastrój" (to fałszowało odznaki).
  const sealed = ordered.filter(m => m !== nowKey);
  const bestMoodMonth = sealed
    .map(m => ({ m, v: agg[m] && agg[m].moodN ? agg[m].moodSum / agg[m].moodN : -1 }))
    .sort((a, b) => b.v - a.v)[0]?.m ?? null;
  // „Najbardziej ruchliwy" = najwięcej kroków ŁĄCZNIE (spójne z liczbą na karcie), a nie
  // najwyższa średnia/dzień (którą wygrywał miesiąc z 1–2 dniami danych, np. bieżący).
  const bestStepsMonth = sealed
    .map(m => ({ m, v: agg[m]?.steps ?? -1 }))
    .sort((a, b) => b.v - a.v)[0]?.m ?? null;
  const bestSweetsMonth = sealed
    .map(m => ({ m, v: agg[m]?.sweetsSpend ?? 0 }))
    .sort((a, b) => b.v - a.v)[0]?.m ?? null;

  // ── assemble one card per month ────────────────────────────────────────────
  const cards: MonthCard[] = ordered.map((month, i) => {
    const a = ensure(month);
    const [y, mo] = month.split('-').map(Number);
    const avgMood = a.moodN ? a.moodSum / a.moodN : null;
    const avgSteps = a.stepDays ? a.steps / a.stepDays : 0;
    const earned = earnedByMonth[month] ?? 0;

    const sweets: MonthCardSweet[] = Object.values(a.sweets)
      .sort((x, y2) => y2.count - x.count || y2.spend - x.spend)
      .slice(0, 3)
      .map(s => ({ name: s.raw, count: s.count, spend: s.spend, emoji: sweetEmoji(s.raw) }));

    const prev = agg[prevKey(month)];
    const spendVsPrevPct = prev && prev.spend > 0 ? Math.round((a.spend - prev.spend) / prev.spend * 100) : null;
    const stepsVsAvgPct = avgSteps > 0 && avgMonthAvgSteps > 0
      ? Math.round((avgSteps - avgMonthAvgSteps) / avgMonthAvgSteps * 100) : null;

    const isTopMood = bestMoodMonth === month && a.moodN > 0 && ordered.length >= 2;
    const isTopSteps = bestStepsMonth === month && a.stepDays > 0 && ordered.length >= 2;
    const isTopSweets = bestSweetsMonth === month && a.sweetsSpend > 0 && ordered.length >= 2;
    const isTopSpendMonth = isTopSpend(spendRankList, month) && month !== nowKey;

    // rarity ladder: how many collection RECORDS this month holds → its metal
    // tier. Copper = a normal month; each record it dominates bumps it up; holding
    // all four (steps + mood + sweets + spend) makes it legendary sapphire.
    const notable = [isTopSteps, isTopMood, isTopSweets, isTopSpendMonth].filter(Boolean).length;
    const tier = tierFor(notable);
    const th = TIER_THEME[tier];

    // decorative stickers: the top sweet, plus badges the month earned
    const stickers: string[] = [];
    if (sweets[0]) stickers.push(sweets[0].emoji);
    if (isTopSteps) stickers.push('👟');
    else if (a.steps > 0) stickers.push('👣');
    if (isTopMood) stickers.push('😄');
    if (earned > 0) stickers.push('💰');
    if (isTopSpendMonth) stickers.push('🔥');

    const headline = buildHeadline({ sweets, steps: a.steps, isTopSteps, isTopMood, isTopSweets, earned, spendVsPrevPct, avgMood });

    return {
      month, monthName: MONTH_NAMES[(mo - 1) % 12], year: y,
      label: `${MONTH_NAMES[(mo - 1) % 12]} ${y}`,
      index: i + 1,
      inProgress: month === nowKey,
      totalSpend: a.spend, totalIncome: a.income, balance: a.income - a.spend,
      steps: a.steps, stepsDays: a.stepDays, avgSteps,
      avgMood, earned, sweetsSpend: a.sweetsSpend, sweets,
      spendRank: spendRankList.indexOf(month) + 1,
      monthsTracked: ordered.length,
      stepsVsAvgPct, spendVsPrevPct,
      isTopMood, isTopSteps, isTopSweets,
      tier, tierRank: th.rank, tierLabel: th.label, tierEmoji: th.emoji,
      palette: th.palette, accent: th.accent,
      stickers, headline,
    };
  });

  // newest first, capped
  return cards.reverse().slice(0, cap);
}

function isTopSpend(rankList: string[], month: string): boolean {
  return rankList.length >= 2 && rankList[0] === month;
}

function buildHeadline(x: {
  sweets: MonthCardSweet[]; steps: number; isTopSteps: boolean; isTopMood: boolean;
  isTopSweets: boolean; earned: number; spendVsPrevPct: number | null; avgMood: number | null;
}): string {
  if (x.isTopSteps && x.steps > 0) return `Twój najbardziej ruchliwy miesiąc — ${fmtSteps(x.steps)} kroków!`;
  if (x.sweets[0] && x.sweets[0].count >= 3) return `Król słodyczy: ${x.sweets[0].name} ×${x.sweets[0].count}`;
  if (x.isTopMood && x.avgMood != null) return `Najlepszy nastrój na koncie — śr. ${x.avgMood.toFixed(1)}/5`;
  if (x.isTopSweets) return `Miesiąc na słodko — najwięcej łakoci w historii`;
  if (x.earned > 0) return `Zarobione ${Math.round(x.earned)} zł`;
  if (x.steps > 0) return `${fmtSteps(x.steps)} kroków w tym miesiącu`;
  if (x.spendVsPrevPct != null && x.spendVsPrevPct < -5) return `O ${-x.spendVsPrevPct}% oszczędniej niż miesiąc wcześniej`;
  return `Twoja karta miesiąca`;
}

function fmtSteps(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.0', '')}k`;
  return String(n);
}

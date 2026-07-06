import { Expense, MoodEntry } from '@/types';
import { consumesInScope, StatsScope } from '@/store/statsScope';
import { canonicalProductName } from '@/utils/productMemory';
import { PayMonthRow } from '@/utils/workSummary';

// ─────────────────────────────────────────────────────────────────────────────
// "Wrapped"-style COLLECTIBLE month cards. Each completed month becomes one card
// added to the collection — a Spotify-Wrapped-for-this-app: favourite sweets,
// step count, spend/earn, and how the month stacks up against the others.
// Emoji here are intentional design "stickers" (decorative only, on the card).
// ─────────────────────────────────────────────────────────────────────────────

const SWEET_TAGS = ['słodycze', 'przekąski'];

const MONTH_NAMES = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];

// RARITY TIERS — the card's colour communicates how special the month is, like a
// graded collectible: copper (common) → silver → gold → diamond → sapphire
// (legendary). [top, mid, bottom] gradient + accent + medal emoji + label.
export type MonthTier = 'miedziana' | 'srebrna' | 'zlota' | 'diamentowa' | 'szafirowa';

const TIER_THEME: Record<MonthTier, { rank: number; palette: [string, string, string]; accent: string; emoji: string; label: string }> = {
  miedziana:  { rank: 0, palette: ['#8A4B24', '#C87A3C', '#2E1A0D'], accent: '#F0B27A', emoji: '🥉', label: 'MIEDZIANA' },
  srebrna:    { rank: 1, palette: ['#5B6472', '#AEB7C4', '#23282F'], accent: '#EAF0F7', emoji: '🥈', label: 'SREBRNA' },
  zlota:      { rank: 2, palette: ['#9A6B08', '#F2B90C', '#2E2205'], accent: '#FDE047', emoji: '🥇', label: 'ZŁOTA' },
  diamentowa: { rank: 3, palette: ['#2C6E7C', '#68D8E6', '#0B2A31'], accent: '#CFFAFE', emoji: '💎', label: 'DIAMENTOWA' },
  szafirowa:  { rank: 4, palette: ['#1E3A8A', '#3B6FE0', '#0C1636'], accent: '#93C5FD', emoji: '🔷', label: 'LEGENDARNA · SZAFIR' },
};

// notable = how many "records" the month holds → its tier on the ladder.
function tierFor(notable: number): MonthTier {
  if (notable >= 4) return 'szafirowa';
  if (notable === 3) return 'diamentowa';
  if (notable === 2) return 'zlota';
  if (notable === 1) return 'srebrna';
  return 'miedziana';
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

function sweetEmoji(name: string): string {
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
  tierRank: number;       // 0 (miedziana) … 4 (szafirowa)
  tierLabel: string;      // "ZŁOTA" etc.
  tierEmoji: string;      // 🥉🥈🥇💎🔷
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
  const bestMoodMonth = ordered
    .map(m => ({ m, v: agg[m] && agg[m].moodN ? agg[m].moodSum / agg[m].moodN : -1 }))
    .sort((a, b) => b.v - a.v)[0]?.m ?? null;
  const bestStepsMonth = ordered
    .map(m => ({ m, v: agg[m] && agg[m].stepDays ? agg[m].steps / agg[m].stepDays : -1 }))
    .sort((a, b) => b.v - a.v)[0]?.m ?? null;
  const bestSweetsMonth = ordered
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
    const isTopSpendMonth = isTopSpend(spendRankList, month);

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
  if (x.sweets[0] && x.sweets[0].count >= 3) return `Król słodyczy: ${x.sweets[0].name} ×${x.sweets[0].count} ${x.sweets[0].emoji}`;
  if (x.isTopMood && x.avgMood != null) return `Najlepszy nastrój na koncie — śr. ${x.avgMood.toFixed(1)}/5 😄`;
  if (x.isTopSweets) return `Miesiąc na słodko 🍬 — najwięcej łakoci w historii`;
  if (x.earned > 0) return `Zarobione ${Math.round(x.earned)} zł 💰`;
  if (x.steps > 0) return `${fmtSteps(x.steps)} kroków w tym miesiącu 👣`;
  if (x.spendVsPrevPct != null && x.spendVsPrevPct < -5) return `O ${-x.spendVsPrevPct}% oszczędniej niż miesiąc wcześniej`;
  return `Twoja karta miesiąca`;
}

function fmtSteps(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.0', '')}k`;
  return String(n);
}

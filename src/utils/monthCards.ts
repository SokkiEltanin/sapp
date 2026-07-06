import { Expense, MoodEntry } from '@/types';
import { countsForConsumption } from '@/store/statsScope';
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

// One themed gradient per calendar month → the collection reads as a matched set,
// each month recognisable by its own "season" colour. [top, mid, bottom, accent].
const MONTH_THEME: [string, string, string, string][] = [
  ['#1E3A8A', '#2563EB', '#0F172A', '#93C5FD'], // Sty — mroźny błękit
  ['#4C1D95', '#7C3AED', '#1E1B4B', '#C4B5FD'], // Lut — fiolet
  ['#065F46', '#10B981', '#0B2E22', '#6EE7B7'], // Mar — wiosenna zieleń
  ['#9D174D', '#EC4899', '#3B0A24', '#F9A8D4'], // Kwi — róż kwiatów
  ['#166534', '#22C55E', '#0B2E17', '#86EFAC'], // Maj — soczysta zieleń
  ['#B45309', '#F59E0B', '#3B240A', '#FCD34D'], // Cze — złote lato
  ['#C2410C', '#FB923C', '#3B1206', '#FDBA74'], // Lip — upalny pomarańcz
  ['#B91C1C', '#F87171', '#3B0A0A', '#FCA5A5'], // Sie — czerwień
  ['#A16207', '#EAB308', '#332107', '#FDE047'], // Wrz — bursztyn
  ['#9A3412', '#EA580C', '#331206', '#FDBA74'], // Paź — jesień
  ['#3730A3', '#6366F1', '#191833', '#A5B4FC'], // Lis — chłodny indygo
  ['#155E75', '#06B6D4', '#082F36', '#67E8F9'], // Gru — lodowy cyjan
];

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
      if (!countsForConsumption(it)) continue;
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
    const theme = MONTH_THEME[(mo - 1) % 12];
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

    // decorative stickers: the top sweet, plus badges the month earned
    const stickers: string[] = [];
    if (sweets[0]) stickers.push(sweets[0].emoji);
    if (isTopSteps) stickers.push('👟');
    else if (a.steps > 0) stickers.push('👣');
    if (isTopMood) stickers.push('😄');
    if (earned > 0) stickers.push('💰');
    if (isTopSpend(spendRankList, month)) stickers.push('🔥');

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
      palette: [theme[0], theme[1], theme[2]], accent: theme[3],
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

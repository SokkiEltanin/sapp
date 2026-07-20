import { Expense, MoodEntry, CalendarEvent, WorkSettings, Task } from '@/types';
import { countsForConsumption, inScope, StatsScope } from '@/store/statsScope';
import { canonicalProductName, productGroupKey, productGroupLabel, weightFor, WeightMemory } from '@/utils/productMemory';
import { isWorkEvent, shiftHours } from '@/utils/workEvents';
import { foodAmountOf } from '@/utils/food';
import { WidgetViz } from '@/store/dashboardLayout';

// A "self-transfer" is moving your own money (to savings / Revolut / another
// account). It changes the account balance but is NOT real spending or income, so
// stats exclude it. Detected by the transfer category or a savings/transfer tag.
const SELF_TRANSFER_TAGS = ['oszczednosci', 'oszczędnościowe', 'przelew', 'revolut'];
export function isSelfTransfer(e: Expense): boolean {
  return (e.category as string) === 'transfer'
    || (e.tags ?? []).some(t => SELF_TRANSFER_TAGS.includes(t.toLowerCase()));
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export type MetricGroup = 'Finanse' | 'Konsumpcja' | 'Nastrój i zdrowie' | 'Praca i zadania';

export interface MetricDef {
  id: string;
  label: string;
  group: MetricGroup;
  unit: string;             // 'zł' | 'kg' | 'h' | '' | '/5'
  viz: WidgetViz[];         // supported visualizations
  periodic: boolean;        // supports week/month + wave series
  needsTag?: boolean;       // requires a tag to be chosen in the builder
}

// Curated tags offered in the builder for tag-based metrics.
export const WIDGET_TAGS = [
  'słodycze', 'nabiał', 'mięso', 'ryby', 'owoce', 'warzywa', 'pieczywo',
  'napoje', 'przekąski', 'chemia', 'higiena', 'dania gotowe',
];

export const WIDGET_METRICS: MetricDef[] = [
  // Finanse
  { id: 'spend',      label: 'Wydatki',            group: 'Finanse', unit: 'zł', viz: ['number', 'wave', 'compare'], periodic: true },
  { id: 'food',       label: 'Jedzenie',           group: 'Finanse', unit: 'zł', viz: ['number', 'wave', 'compare'], periodic: true },
  { id: 'sweets',     label: 'Słodycze (wydatki)', group: 'Finanse', unit: 'zł', viz: ['number', 'wave', 'compare'], periodic: true },
  { id: 'income',     label: 'Przychody',          group: 'Finanse', unit: 'zł', viz: ['number', 'wave', 'compare'], periodic: true },
  { id: 'net',        label: 'Bilans (przych.−wyd.)', group: 'Finanse', unit: 'zł', viz: ['number', 'wave', 'compare'], periodic: true },
  { id: 'savings',    label: 'Odłożone (przelewy własne)', group: 'Finanse', unit: 'zł', viz: ['number', 'wave', 'compare'], periodic: true },
  { id: 'avgExpense', label: 'Średni wydatek',     group: 'Finanse', unit: 'zł', viz: ['number', 'wave', 'compare'], periodic: true },
  { id: 'expenseCount', label: 'Liczba transakcji', group: 'Finanse', unit: '×', viz: ['number', 'wave', 'compare'], periodic: true },
  { id: 'biggestExpense', label: 'Największy wydatek', group: 'Finanse', unit: 'zł', viz: ['number', 'wave'], periodic: true },
  { id: 'byCategory', label: 'Wydatki per kategoria', group: 'Finanse', unit: 'zł', viz: ['list', 'donut'], periodic: false },
  // Konsumpcja
  { id: 'cheeseKg',   label: 'Nabiał / ser (kg)',  group: 'Konsumpcja', unit: 'kg', viz: ['number', 'compare'], periodic: true },
  { id: 'meatKg',     label: 'Mięso (kg)',         group: 'Konsumpcja', unit: 'kg', viz: ['number', 'compare'], periodic: true },
  { id: 'fruitKg',    label: 'Owoce (kg)',         group: 'Konsumpcja', unit: 'kg', viz: ['number', 'compare'], periodic: true },
  { id: 'vegKg',      label: 'Warzywa (kg)',       group: 'Konsumpcja', unit: 'kg', viz: ['number', 'compare'], periodic: true },
  { id: 'topProducts', label: 'Top produkty',      group: 'Konsumpcja', unit: '×',  viz: ['list', 'donut'], periodic: false },
  { id: 'favSweets',  label: 'Ulubione słodycze / przekąski',  group: 'Konsumpcja', unit: '×',  viz: ['list', 'donut'], periodic: false },
  { id: 'itemsCount', label: 'Liczba produktów',   group: 'Konsumpcja', unit: 'szt.', viz: ['number', 'wave'], periodic: true },
  { id: 'tagSpend',   label: 'Wydatki na tag…',    group: 'Konsumpcja', unit: 'zł',   viz: ['number', 'wave', 'compare'], periodic: true, needsTag: true },
  { id: 'tagCount',   label: 'Sztuk z tagiem…',    group: 'Konsumpcja', unit: 'szt.', viz: ['number', 'wave'], periodic: true, needsTag: true },
  { id: 'tagKg',      label: 'Kg z tagiem…',       group: 'Konsumpcja', unit: 'kg',   viz: ['number', 'compare'], periodic: true, needsTag: true },
  // Nastrój i zdrowie
  { id: 'moodAvg',    label: 'Średni nastrój',     group: 'Nastrój i zdrowie', unit: '/5', viz: ['number', 'wave', 'compare'], periodic: true },
  { id: 'energyAvg',  label: 'Średnia energia',    group: 'Nastrój i zdrowie', unit: '/5', viz: ['number', 'wave', 'compare'], periodic: true },
  { id: 'moodStreak', label: 'Seria check-inów',   group: 'Nastrój i zdrowie', unit: 'dni', viz: ['number'], periodic: false },
  { id: 'steps',      label: 'Kroki (śr/dzień)',   group: 'Nastrój i zdrowie', unit: 'kroki', viz: ['number', 'wave', 'compare'], periodic: true },
  { id: 'sleepAvg',   label: 'Sen (śr)',           group: 'Nastrój i zdrowie', unit: 'h',  viz: ['number', 'wave', 'compare'], periodic: true },
  { id: 'weight',     label: 'Waga',               group: 'Nastrój i zdrowie', unit: 'kg', viz: ['number', 'wave', 'compare'], periodic: true },
  // Praca i zadania
  { id: 'workHours',  label: 'Godziny pracy',      group: 'Praca i zadania', unit: 'h',  viz: ['number', 'wave', 'compare'], periodic: true },
  { id: 'earnings',   label: 'Zarobek (szac.)',    group: 'Praca i zadania', unit: 'zł', viz: ['number', 'wave'], periodic: true },
  { id: 'lastShift',  label: 'Ostatnia zmiana (szac.)', group: 'Praca i zadania', unit: 'zł', viz: ['number'], periodic: false },
  { id: 'tasksDone',  label: 'Ukończone zadania',  group: 'Praca i zadania', unit: '',   viz: ['number', 'wave', 'compare'], periodic: true },
  { id: 'habitsToday', label: 'Nawyki dziś',       group: 'Praca i zadania', unit: '',   viz: ['number'], periodic: false },
];

export function metricById(id?: string): MetricDef | undefined {
  return WIDGET_METRICS.find(m => m.id === id);
}

// ─── Context ──────────────────────────────────────────────────────────────────

export interface StatCtx {
  expenses: Expense[];
  scope: StatsScope;
  moodEntries: MoodEntry[];
  workEvents: CalendarEvent[];      // all events (local + gcal)
  workSettings: WorkSettings;
  ratePerHour: number;              // effective zł/h for earnings
  tasks: Task[];
  habitsTotal: number;
  habitsDone: number;
  nameAliases: Record<string, string>;
  weightMemory: WeightMemory;
  healthDays: Record<string, { steps: number; sleepMinutes: number; weightKg: number | null }>; // date → watch metrics
  paycheckByMonth?: Record<string, number>; // YYYY-MM (target month) → actual [JD] paycheck total
}

type Period = 'week' | 'month';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0'); }
const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

// YYYY-MM for a month `offset` back (0 = current).
function monthKey(offset: number): string {
  const d = new Date(); const x = new Date(d.getFullYear(), d.getMonth() - offset, 1);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}`;
}
function monthLabel(offset: number): string {
  const d = new Date(); const x = new Date(d.getFullYear(), d.getMonth() - offset, 1);
  return MONTHS[x.getMonth()];
}
// 7 date strings (Mon..Sun) for the week `offset` back.
function weekDates(offset: number): string[] {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7; // Mon=0
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow - offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
}
function weekLabel(offset: number): string {
  const ds = weekDates(offset);
  return ds[0].slice(8) + '.' + ds[0].slice(5, 7);
}

// Does an expense fall in a given period bucket?
function inMonth(e: Expense, ym: string) { return (e.date ?? '').slice(0, 7) === ym; }
function inWeek(e: Expense, dates: string[]) { const s = new Set(dates); return s.has((e.date ?? '').slice(0, 10)); }

const GROUP_TAG: Record<string, string> = { cheeseKg: 'nabiał', meatKg: 'mięso', fruitKg: 'owoce', vegKg: 'warzywa' };
const SWEETS_TAGS = ['słodycze'];

// Weight of a receipt item in kg:
//  1. explicit weightKg on the item wins,
//  2. a fractional quantity is treated as kg (weighed goods),
//  3. otherwise the per-product LEARNED weight × the piece count — so once you've
//     set a product's weight, all its entries (past & future) count with it.
function itemKg(it: { name?: string; weightKg?: number; quantity?: number }, wmem: WeightMemory): number {
  if (it.weightKg && it.weightKg > 0) return it.weightKg;
  const q = it.quantity ?? 0;
  if (q > 0 && q < 50 && !Number.isInteger(q)) return q;          // weighed (kg)
  const learned = it.name ? weightFor(it.name, wmem) : undefined;  // kg per piece
  if (learned && q > 0 && q < 50) return learned * (Number.isInteger(q) ? q : 1);
  return 0;
}

// ─── Core numeric metric for one period bucket ────────────────────────────────

function bucketValue(metric: string, ctx: StatCtx, pred: (e: Expense) => boolean,
                     moodPred: (d: string) => boolean, tag?: string, periodYm?: string): number {
  const exp = ctx.expenses;
  switch (metric) {
    case 'tagSpend': {
      if (!tag) return 0;
      let total = 0;
      for (const e of exp) {
        if (e.type && e.type !== 'expense') continue;
        if (!inScope(e, ctx.scope) || !pred(e)) continue;
        // A receipt counts ONLY its matching items, never the whole shop.
        const items = e.receiptItems ?? [];
        if (items.length > 0) {
          for (const it of items) if (countsForConsumption(it) && (it.tags ?? []).includes(tag)) total += it.price;
        } else if (e.tags?.includes(tag)) {
          total += e.amount;
        }
      }
      return total;
    }
    case 'tagCount': {
      if (!tag) return 0;
      let n = 0;
      for (const e of exp) {
        if (e.type === 'income' || !inScope(e, ctx.scope) || !pred(e)) continue;
        for (const it of (e.receiptItems ?? [])) {
          if (countsForConsumption(it) && (it.tags ?? []).includes(tag)) n++;
        }
      }
      return n;
    }
    case 'tagKg': {
      if (!tag) return 0;
      let kg = 0;
      for (const e of exp) {
        if (e.type === 'income' || !inScope(e, ctx.scope) || !pred(e)) continue;
        for (const it of (e.receiptItems ?? [])) {
          if (!countsForConsumption(it)) continue;
          if (!(it.tags ?? []).includes(tag)) continue;
          kg += itemKg(it, ctx.weightMemory);
        }
      }
      return kg;
    }
    case 'spend':
      return exp.filter(e => (!e.type || e.type === 'expense') && !isSelfTransfer(e) && inScope(e, ctx.scope) && pred(e))
        .reduce((s, e) => s + e.amount, 0);
    case 'income':
      return exp.filter(e => e.type === 'income' && !isSelfTransfer(e) && pred(e)).reduce((s, e) => s + e.amount, 0);
    case 'net': {
      let inc = 0, out = 0;
      for (const e of exp) {
        if (isSelfTransfer(e) || !pred(e)) continue;
        if (e.type === 'income') inc += e.amount;
        else if (inScope(e, ctx.scope)) out += e.amount;
      }
      return Math.round((inc - out) * 100) / 100;
    }
    case 'savings':
      return exp.filter(e => isSelfTransfer(e) && inScope(e, ctx.scope) && pred(e)).reduce((s, e) => s + e.amount, 0);
    case 'avgExpense': {
      const rows = exp.filter(e => (!e.type || e.type === 'expense') && !isSelfTransfer(e) && inScope(e, ctx.scope) && pred(e));
      if (!rows.length) return 0;
      return Math.round(rows.reduce((s, e) => s + e.amount, 0) / rows.length * 100) / 100;
    }
    case 'expenseCount':
      return exp.filter(e => (!e.type || e.type === 'expense') && !isSelfTransfer(e) && inScope(e, ctx.scope) && pred(e)).length;
    case 'biggestExpense':
      return exp.filter(e => (!e.type || e.type === 'expense') && !isSelfTransfer(e) && inScope(e, ctx.scope) && pred(e))
        .reduce((m, e) => Math.max(m, e.amount), 0);
    case 'food':
      // FOOD ONLY — sum food receipt lines, not the whole grocery receipt (papier
      // toaletowy / chemia z Lidla nie liczy się do jedzenia). foodAmountOf handles the
      // no-items fallback (a plain groceries entry counts whole).
      return exp.filter(e => (!e.type || e.type === 'expense') && inScope(e, ctx.scope) && pred(e))
        .reduce((s, e) => s + foodAmountOf(e), 0);
    case 'sweets': {
      let total = 0;
      for (const e of exp) {
        if (e.type && e.type !== 'expense') continue;
        if (!inScope(e, ctx.scope) || !pred(e)) continue;
        const items = e.receiptItems ?? [];
        if (items.length > 0) {
          for (const it of items) if (countsForConsumption(it) && (it.tags ?? []).some(t => SWEETS_TAGS.includes(t))) total += it.price;
        } else if (e.tags?.includes('słodycze')) {
          total += e.amount;
        }
      }
      return total;
    }
    case 'itemsCount': {
      let n = 0;
      for (const e of exp) {
        if (e.type && e.type !== 'expense') continue;
        if (!inScope(e, ctx.scope) || !pred(e)) continue;
        for (const it of (e.receiptItems ?? [])) if (countsForConsumption(it)) n++;
      }
      return n;
    }
    case 'cheeseKg': case 'meatKg': case 'fruitKg': case 'vegKg': {
      const tag = GROUP_TAG[metric]; let kg = 0;
      for (const e of exp) {
        if (e.type === 'income' || !inScope(e, ctx.scope) || !pred(e)) continue;
        for (const it of (e.receiptItems ?? [])) {
          if (!countsForConsumption(it)) continue;
          if (!(it.tags ?? []).includes(tag)) continue;
          kg += itemKg(it, ctx.weightMemory);
        }
      }
      return kg;
    }
    case 'moodAvg': case 'energyAvg': {
      const rows = ctx.moodEntries.filter(m => moodPred(m.date));
      if (!rows.length) return 0;
      const key = metric === 'moodAvg' ? 'mood' : 'energy';
      return rows.reduce((s, m) => s + (m as any)[key], 0) / rows.length;
    }
    case 'workHours': {
      // ALL [JD] calendar hours in the bucket month (worked + still-scheduled) — the
      // widget projects the whole month from the calendar; the Praca panel is where
      // worked-so-far facts live.
      const wp = ctx.workSettings.workPrefix, wc = ctx.workSettings.workColor;
      return ctx.workEvents
        .filter(e => isWorkEvent(e, { workColor: wc, workPrefix: wp }) && moodPred((e.date ?? '').slice(0, 10)))
        .reduce((s, e) => s + shiftHours(e), 0);
    }
    case 'earnings': {
      // Past months show the REAL [JD] paycheck for that month. Otherwise ESTIMATE from
      // ALL calendar hours that month (worked + scheduled) × rate — it's a "(szac.)"
      // projection of the whole month, not a worked-so-far partial.
      if (periodYm && ctx.paycheckByMonth && ctx.paycheckByMonth[periodYm] > 0) return ctx.paycheckByMonth[periodYm];
      const wp = ctx.workSettings.workPrefix, wc = ctx.workSettings.workColor;
      const h = ctx.workEvents
        .filter(e => isWorkEvent(e, { workColor: wc, workPrefix: wp }) && moodPred((e.date ?? '').slice(0, 10)))
        .reduce((s, e) => s + shiftHours(e), 0);
      return h * ctx.ratePerHour;
    }
    case 'tasksDone':
      return ctx.tasks.filter(t => t.status === 'done' && moodPred((t.updatedAt ?? '').slice(0, 10))).length;
    case 'steps': {
      const rows = Object.entries(ctx.healthDays).filter(([d, v]) => moodPred(d) && v.steps > 0);
      if (!rows.length) return 0;
      return Math.round(rows.reduce((s, [, v]) => s + v.steps, 0) / rows.length);
    }
    case 'sleepAvg': {
      const rows = Object.entries(ctx.healthDays).filter(([d, v]) => moodPred(d) && v.sleepMinutes > 0);
      if (!rows.length) return 0;
      const min = rows.reduce((s, [, v]) => s + v.sleepMinutes, 0) / rows.length;
      return Math.round((min / 60) * 10) / 10; // hours, 1 dp
    }
    case 'weight': {
      // latest logged weight within the bucket
      const rows = Object.entries(ctx.healthDays)
        .filter(([d, v]) => moodPred(d) && v.weightKg != null)
        .sort((a, b) => (a[0] < b[0] ? 1 : -1));
      return rows.length ? (rows[0][1].weightKg as number) : 0;
    }
    default:
      return 0;
  }
}

// Build predicates for a period bucket (offset back).
function predsFor(period: Period, offset: number): { exp: (e: Expense) => boolean; day: (d: string) => boolean; label: string; ym?: string } {
  if (period === 'month') {
    const ym = monthKey(offset);
    return { exp: e => inMonth(e, ym), day: d => d.slice(0, 7) === ym, label: monthLabel(offset), ym };
  }
  const ds = weekDates(offset); const set = new Set(ds);
  return { exp: e => inWeek(e, ds), day: d => set.has(d.slice(0, 10)), label: weekLabel(offset), ym: undefined };
}

// ─── Public compute ───────────────────────────────────────────────────────────

export interface NumberResult { value: number; unit: string; sub?: string }
export interface SeriesResult { values: number[]; labels: string[]; unit: string }
export interface ListRow { label: string; value: number; unit: string }

export function metricNumber(metric: string, ctx: StatCtx, period: Period, tag?: string): NumberResult {
  const def = metricById(metric);
  const unit = def?.unit ?? '';
  if (metric === 'moodStreak') {
    const set = new Set(ctx.moodEntries.map(m => m.date));
    let streak = 0; const d = new Date();
    for (;;) { const s = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; if (!set.has(s)) break; streak++; d.setDate(d.getDate() - 1); }
    return { value: streak, unit };
  }
  if (metric === 'habitsToday') return { value: ctx.habitsDone, unit: `/ ${ctx.habitsTotal}` };
  if (metric === 'lastShift') {
    const today = `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}-${pad(new Date().getDate())}`;
    const past = ctx.workEvents
      .filter(e => isWorkEvent(e, { workColor: ctx.workSettings.workColor, workPrefix: ctx.workSettings.workPrefix }) && e.date.slice(0, 10) <= today)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    const last = past[0];
    const hrs = last ? shiftHours(last) : 0;
    return {
      value: Math.round(hrs * ctx.ratePerHour),
      unit,
      sub: last ? `${new Date(last.date).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short' })} · ${hrs.toFixed(1)} h` : 'brak zmian',
    };
  }
  const p = predsFor(period, 0);
  const value = bucketValue(metric, ctx, p.exp, p.day, tag, p.ym);
  return { value, unit, sub: period === 'month' ? 'ten miesiąc' : 'ten tydzień' };
}

export function metricSeries(metric: string, ctx: StatCtx, period: Period, n = 6, tag?: string): SeriesResult {
  const def = metricById(metric);
  const values: number[] = []; const labels: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const p = predsFor(period, i);
    values.push(bucketValue(metric, ctx, p.exp, p.day, tag, p.ym));
    labels.push(p.label);
  }
  return { values, labels, unit: def?.unit ?? '' };
}

export function metricList(metric: string, ctx: StatCtx, limit = 5): ListRow[] {
  const exp = ctx.expenses;
  if (metric === 'byCategory') {
    const now = new Date(); const ym = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    const sums: Record<string, number> = {};
    for (const e of exp) {
      if (e.type === 'income' || !inScope(e, ctx.scope) || !inMonth(e, ym)) continue;
      sums[e.category] = (sums[e.category] ?? 0) + e.amount;
    }
    return Object.entries(sums).sort((a, b) => b[1] - a[1]).slice(0, limit)
      .map(([label, value]) => ({ label, value: Math.round(value), unit: 'zł' }));
  }
  // topProducts / favSweets — by count, grouped by product (variants collapse),
  // consumption-only. Same grouping as the dashboard's "najczęściej kupowane".
  const count: Record<string, number> = {}; const names: Record<string, string[]> = {};
  const sweetsOnly = metric === 'favSweets';
  for (const e of exp) {
    if (e.type === 'income' || !inScope(e, ctx.scope)) continue;
    for (const it of (e.receiptItems ?? [])) {
      if (!countsForConsumption(it)) continue;
      if (sweetsOnly && !(it.tags ?? []).some(t => SWEETS_TAGS.includes(t))) continue;
      const name = it.name?.trim(); if (!name) continue;
      const canon = canonicalProductName(name, ctx.nameAliases);
      const key = productGroupKey(canon);
      if (!key) continue;
      count[key] = (count[key] ?? 0) + 1;
      (names[key] ??= []).push(canon);
    }
  }
  return Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, limit)
    .filter(([, c]) => c >= 1)
    .map(([key, c]) => ({ label: productGroupLabel(names[key] ?? [key]), value: c, unit: '×' }));
}

// ─── Year-in-pixels (per-day value for the calendar grid) ───────────────────────

// Metrics meaningful as a per-DAY value → offered with the 'pixels' viz in the builder.
export const PIXEL_METRICS = new Set([
  'spend', 'food', 'sweets', 'income', 'moodAvg', 'energyAvg', 'steps', 'sleepAvg', 'weight', 'tasksDone',
]);

// ABSOLUTE colour-tier thresholds for the year-in-pixels grid, per metric. N thresholds
// → N distinguishable shade levels (0..N-1) + a LEGENDARY top tier (value ≥ last
// threshold). Gives the grid real meaning (a 20k-step day always looks the same, not
// relative to your max) with clearly separable steps instead of a smooth ramp. Metrics
// with no natural absolute scale (money, weight) return undefined → the grid falls back
// to a discretised relative ramp.
export function pixelTiers(metric: string): number[] | undefined {
  switch (metric) {
    case 'steps':     return [5000, 10000, 15000, 20000, 25000, 30000];  // 30k+ = legendary
    case 'sleepAvg':  return [4, 5.5, 6.5, 7.5, 8.5];                     // ≥8.5 h = legendary
    case 'tasksDone': return [1, 2, 3, 5, 8];                             // ≥8 done = legendary
    default:          return undefined;                                   // money/weight → relative
  }
}

// One metric's value for a single calendar day (YYYY-MM-DD). Feeds the year grid.
export function dailyValue(metric: string, ctx: StatCtx, day: string): number {
  const onDay = (d?: string) => (d ?? '').slice(0, 10) === day;
  switch (metric) {
    case 'spend':
      return ctx.expenses.filter(e => (!e.type || e.type === 'expense') && !isSelfTransfer(e) && inScope(e, ctx.scope) && onDay(e.date)).reduce((s, e) => s + e.amount, 0);
    case 'food':
      return ctx.expenses.filter(e => (!e.type || e.type === 'expense') && inScope(e, ctx.scope) && onDay(e.date)).reduce((s, e) => s + foodAmountOf(e), 0);
    case 'income':
      return ctx.expenses.filter(e => e.type === 'income' && !isSelfTransfer(e) && onDay(e.date)).reduce((s, e) => s + e.amount, 0);
    case 'sweets': {
      let total = 0;
      for (const e of ctx.expenses) {
        if ((e.type && e.type !== 'expense') || !inScope(e, ctx.scope) || !onDay(e.date)) continue;
        const items = e.receiptItems ?? [];
        if (items.length > 0) { for (const it of items) if (countsForConsumption(it) && (it.tags ?? []).some(t => SWEETS_TAGS.includes(t))) total += it.price; }
        else if (e.tags?.includes('słodycze')) total += e.amount;
      }
      return total;
    }
    case 'moodAvg': case 'energyAvg': {
      const rows = ctx.moodEntries.filter(m => m.date === day);
      if (!rows.length) return 0;
      const key = metric === 'moodAvg' ? 'mood' : 'energy';
      return rows.reduce((s, m) => s + (m as any)[key], 0) / rows.length;
    }
    case 'steps':     return ctx.healthDays[day]?.steps ?? 0;
    case 'sleepAvg':  return (ctx.healthDays[day]?.sleepMinutes ?? 0) / 60;
    case 'weight':    return ctx.healthDays[day]?.weightKg ?? 0;
    case 'tasksDone': return ctx.tasks.filter(t => t.status === 'done' && onDay(t.updatedAt)).length;
    default: return 0;
  }
}

// Is this metric mood-like (discrete 1–5 colour) vs a quantity (intensity ramp)?
export function isMoodPixelMetric(metric: string): boolean {
  return metric === 'moodAvg' || metric === 'energyAvg';
}

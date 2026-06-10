import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Smile, Zap, Flame, BookOpen, Plus, TrendingUp, TrendingDown, Tag, CalendarDays, Clock, BarChart3, Sunrise, Sun, Sunset, Moon, Sparkles } from 'lucide-react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, LinearGradient as SvgGrad, Stop, Circle } from 'react-native-svg';

import ScreenHeader from '@/components/ui/ScreenHeader';
import PressableScale from '@/components/ui/PressableScale';
import MoodCheckInModal from '@/components/mood/MoodCheckInModal';

const P = {
  card:       '#170810',
  cardBorder: 'rgba(244,114,182,0.18)',
  accent:     '#F472B6',
  accentDim:  'rgba(244,114,182,0.12)',
  muted:      'rgba(244,114,182,0.45)',
};
import { useMoodStore } from '@/store/moodStore';
import { useCalendarStore } from '@/store/calendarStore';
import { useWorkStore } from '@/store/workStore';
import { isWorkEvent, shiftHours } from '@/utils/workEvents';
import { moodService } from '@/services/moodService';
import { MoodEntry, MOOD_LABELS, MOOD_COLORS, MoodLevel, ENERGY_COLORS } from '@/types';
import { colors, spacing, radius, typography } from '@/theme';
import { toast } from '@/store/toastStore';
import { haptic } from '@/utils/haptics';

// ─── Keyword analysis from free-text notes ────────────────────────────────────

const DOW_FULL = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];

const PL_STOPWORDS = new Set([
  'i','w','z','do','na','że','się','jest','to','nie','ale','jak','też','już',
  'ten','ta','tam','tak','bo','po','przy','przez','od','dla','go','mu','ich',
  'jej','tego','temu','mnie','mi','ja','ty','on','ona','my','wy','oni','co',
  'kto','czy','ani','by','być','mieć','mam','masz','mają','mamy','bardzo',
  'jeszcze','tylko','właśnie','jednak','teraz','tutaj','trochę','dużo','więc',
  'może','chyba','dzisiaj','dziś','wczoraj','jutro','czasem','zawsze','nigdy',
  'każdy','coś','nic','tej','jest','są','był','była','było','będzie','będę',
  'sobie','swój','swoją','jego','jej','nam','nas','was','was','tego','tych',
  'było','który','która','które','tego','przy','nad','pod','przed','między',
  'żeby','kiedy','gdzie','skąd','wtedy','potem','zaraz','już','znowu','chyba',
]);

interface KeywordStat {
  word: string;
  goodCount: number;
  badCount: number;
  totalCount: number;
  sentiment: number; // -1..+1
}

function extractKeywords(entries: MoodEntry[]): { positive: KeywordStat[]; negative: KeywordStat[] } {
  const stats: Record<string, { good: number; bad: number }> = {};

  for (const entry of entries) {
    if (!entry.note?.trim()) continue;
    const isGood = entry.mood >= 4;
    const isBad  = entry.mood <= 2;
    if (!isGood && !isBad) continue; // skip neutral entries (mood 3)

    const words = entry.note
      .toLowerCase()
      .replace(/[^a-ząćęłńóśźżA-ZĄĆĘŁŃÓŚŹŻ\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 4 && !PL_STOPWORDS.has(w) && !/^\d+$/.test(w));

    for (const word of words) {
      if (!stats[word]) stats[word] = { good: 0, bad: 0 };
      if (isGood) stats[word].good++;
      if (isBad)  stats[word].bad++;
    }
  }

  const all: KeywordStat[] = Object.entries(stats)
    .map(([word, s]) => ({
      word,
      goodCount: s.good,
      badCount: s.bad,
      totalCount: s.good + s.bad,
      sentiment: (s.good - s.bad) / (s.good + s.bad),
    }))
    .filter(k => k.totalCount >= 2);

  const positive = all
    .filter(k => k.sentiment > 0.2)
    .sort((a, b) => b.sentiment * Math.log(b.totalCount + 1) - a.sentiment * Math.log(a.totalCount + 1))
    .slice(0, 8);

  const negative = all
    .filter(k => k.sentiment < -0.2)
    .sort((a, b) => a.sentiment * Math.log(b.totalCount + 1) - b.sentiment * Math.log(a.totalCount + 1))
    .slice(0, 8);

  return { positive, negative };
}

function KeywordInsights({ entries }: { entries: MoodEntry[] }) {
  const withNotes = entries.filter(e => e.note?.trim() && (e.mood >= 4 || e.mood <= 2));
  if (withNotes.length < 4) return null;

  const { positive, negative } = extractKeywords(entries);
  if (positive.length === 0 && negative.length === 0) return null;

  return (
    <View style={kw.card}>
      <View style={kw.header}>
        <Tag size={13} color={colors.text.muted} />
        <Text style={kw.title}>Twoje słowa kluczowe</Text>
      </View>
      <Text style={kw.subtitle}>Na podstawie Twoich notatek i nastroju</Text>

      {positive.length > 0 && (
        <View style={kw.section}>
          <Text style={[kw.sectionLabel, { color: P.accent }]}>Co Cię cieszy</Text>
          <View style={kw.chips}>
            {positive.map(k => (
              <View key={k.word} style={[kw.chip, { backgroundColor: P.accent + '20', borderColor: P.accent + '55' }]}>
                <Text style={[kw.chipWord, { color: P.accent }]}>{k.word}</Text>
                {k.totalCount > 2 && (
                  <Text style={[kw.chipCount, { color: P.accent + 'AA' }]}>{k.totalCount}×</Text>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {negative.length > 0 && (
        <View style={kw.section}>
          <Text style={[kw.sectionLabel, { color: colors.text.muted }]}>Co Cię stresuje</Text>
          <View style={kw.chips}>
            {negative.map(k => (
              <View key={k.word} style={[kw.chip, { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.18)' }]}>
                <Text style={[kw.chipWord, { color: colors.text.secondary }]}>{k.word}</Text>
                {k.totalCount > 2 && (
                  <Text style={[kw.chipCount, { color: colors.text.muted }]}>{k.totalCount}×</Text>
                )}
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const kw = StyleSheet.create({
  card: {
    backgroundColor: P.card, borderRadius: radius.xl, padding: spacing[4],
    gap: spacing[3], borderWidth: 1, borderColor: P.cardBorder,
  },
  header:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: {
    fontSize: 10, fontWeight: '700', color: colors.text.muted,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  subtitle: { fontSize: 11, color: colors.text.muted, marginTop: -spacing[1] },
  section:  { gap: spacing[2] },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[3], paddingVertical: 5,
    borderRadius: radius.full, borderWidth: 1,
  },
  chipWord:  { fontSize: 12, fontWeight: '600' },
  chipCount: { fontSize: 10, fontWeight: '500' },
});

const MOOD_EMOJIS: Record<MoodLevel, string> = { 1: '😩', 2: '😕', 3: '😐', 4: '😊', 5: '🤩' };
const ENERGY_EMOJIS: Record<MoodLevel, string> = { 1: '😴', 2: '😌', 3: '⚡', 4: '✨', 5: '🚀' };

function MoodInsights({ entries }: { entries: MoodEntry[] }) {
  if (entries.length < 5) return null;

  const now = new Date();
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const thisMonthStart = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`;
  const lastMonthDate  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStart = `${lastMonthDate.getFullYear()}-${pad2(lastMonthDate.getMonth() + 1)}-01`;

  const thisMonth = entries.filter(e => e.date >= thisMonthStart);
  const lastMonth = entries.filter(e => e.date >= lastMonthStart && e.date < thisMonthStart);
  const thisAvg = thisMonth.length
    ? thisMonth.reduce((a, b) => a + b.mood, 0) / thisMonth.length : null;
  const lastAvg = lastMonth.length
    ? lastMonth.reduce((a, b) => a + b.mood, 0) / lastMonth.length : null;

  const dowData = Array(7).fill(null).map(() => ({ total: 0, count: 0 }));
  for (const e of entries) {
    const dow = new Date(e.date).getDay();
    dowData[dow].total += e.mood;
    dowData[dow].count++;
  }
  const bestDow = dowData.reduce<{ total: number; count: number; i: number }>((best, curr, i) => {
    const avg = curr.count >= 2 ? curr.total / curr.count : -1;
    const bestAvg = best.count >= 2 ? best.total / best.count : -1;
    return avg > bestAvg ? { ...curr, i } : best;
  }, { total: 0, count: 0, i: -1 });

  const goodTagCounts: Record<string, number> = {};
  const badTagCounts:  Record<string, number> = {};
  for (const e of entries) {
    for (const tag of e.tags ?? []) {
      if (e.mood >= 4) goodTagCounts[tag] = (goodTagCounts[tag] ?? 0) + 1;
      if (e.mood <= 2) badTagCounts[tag]  = (badTagCounts[tag]  ?? 0) + 1;
    }
  }
  const topGoodTags = Object.entries(goodTagCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);
  const topBadTags  = Object.entries(badTagCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);

  const hasTrend  = thisAvg != null && lastAvg != null;
  const trendDiff = hasTrend ? thisAvg! - lastAvg! : 0;
  const trendUp   = trendDiff >= 0;

  const hasBestDow = bestDow.i >= 0 && bestDow.count >= 2;
  const hasTagInsights = topGoodTags.length > 0 || topBadTags.length > 0;

  if (!hasTrend && !hasBestDow && !hasTagInsights) return null;

  return (
    <View style={ins.card}>
      <View style={ins.header}>
        <TrendingUp size={13} color={colors.text.muted} />
        <Text style={ins.title}>Twoje wzorce</Text>
      </View>

      {(hasTrend || hasBestDow) && (
        <View style={ins.grid}>
          {hasTrend && (
            <View style={ins.tile}>
              <Text style={ins.tileLabel}>Ten miesiąc</Text>
              <View style={ins.tileRow}>
                {trendUp
                  ? <TrendingUp size={13} color={P.accent} />
                  : <TrendingDown size={13} color={colors.text.muted} />
                }
                <Text style={[ins.tileVal, { color: trendUp ? P.accent : colors.text.secondary }]}>
                  {thisAvg!.toFixed(1)}
                </Text>
              </View>
              <Text style={ins.tileSub}>
                {Math.abs(trendDiff) >= 0.1
                  ? `${trendUp ? '+' : ''}${trendDiff.toFixed(1)} vs ub. mies.`
                  : 'bez zmian'}
              </Text>
            </View>
          )}
          {hasBestDow && (
            <View style={ins.tile}>
              <Text style={ins.tileLabel}>Najlepszy dzień</Text>
              <Text style={[ins.tileVal, { color: P.accent }]} numberOfLines={1}>
                {DOW_FULL[bestDow.i]}
              </Text>
              <Text style={ins.tileSub}>
                śr. {(bestDow.total / bestDow.count).toFixed(1)} nastroju
              </Text>
            </View>
          )}
        </View>
      )}

      {topGoodTags.length > 0 && (
        <View style={ins.tagSection}>
          <View style={ins.tagHeader}>
            <Tag size={11} color={P.accent} />
            <Text style={[ins.tagSectionLabel, { color: P.accent }]}>Dobry nastrój</Text>
          </View>
          <View style={ins.tagRow}>
            {topGoodTags.map(tag => (
              <View key={tag} style={[ins.tagChip, { backgroundColor: P.accent + '20', borderColor: P.accent + '50' }]}>
                <Text style={[ins.tagText, { color: P.accent }]}>#{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {topBadTags.length > 0 && (
        <View style={ins.tagSection}>
          <View style={ins.tagHeader}>
            <Tag size={11} color={colors.text.muted} />
            <Text style={[ins.tagSectionLabel, { color: colors.text.muted }]}>Niski nastrój</Text>
          </View>
          <View style={ins.tagRow}>
            {topBadTags.map(tag => (
              <View key={tag} style={[ins.tagChip, { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.18)' }]}>
                <Text style={[ins.tagText, { color: colors.text.secondary }]}>#{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const ins = StyleSheet.create({
  card: {
    backgroundColor: P.card, borderRadius: radius.xl, padding: spacing[4],
    gap: spacing[3], borderWidth: 1, borderColor: P.cardBorder,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: {
    fontSize: 10, fontWeight: '700', color: colors.text.muted,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  grid: { flexDirection: 'row', gap: spacing[3] },
  tile: {
    flex: 1, backgroundColor: colors.bg.elevated, borderRadius: radius.lg,
    padding: spacing[3], gap: 3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  tileLabel: { fontSize: 9, fontWeight: '600', color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  tileRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tileVal: { fontSize: 18, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.5 },
  tileSub: { fontSize: 10, color: colors.text.muted },
  tagSection: { gap: spacing[2] },
  tagHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tagSectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  tagChip: {
    paddingHorizontal: spacing[2], paddingVertical: 4,
    borderRadius: radius.full, borderWidth: 1,
  },
  tagText: { fontSize: 11, fontWeight: '600' },
});

// ─── Shared mood helpers ──────────────────────────────────────────────────────

const MOOD_EMO: Record<MoodLevel, string> = { 1: '😩', 2: '😕', 3: '😐', 4: '😊', 5: '🤩' };
const WEEKDAYS_SHORT = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

function moodColorFor(avg: number): string {
  const lvl = Math.max(1, Math.min(5, Math.round(avg))) as MoodLevel;
  return MOOD_COLORS[lvl];
}

// ─── Mood + Energy wave (SVG, last 30 days) ───────────────────────────────────

const WAVE_W = 320;
const WAVE_H = 92;

function buildSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function MoodEnergyWave({ entries }: { entries: MoodEntry[] }) {
  const days = useMemo(() => {
    const byDate: Record<string, MoodEntry> = {};
    for (const e of entries) byDate[e.date] = e;
    return Array.from({ length: 30 }, (_, i) => {
      const d = dateMinusDays(29 - i);
      return { date: d, entry: byDate[d] ?? null };
    });
  }, [entries]);

  const present = days.map((d, i) => ({ ...d, i })).filter(d => d.entry);
  if (present.length < 3) return null;

  const n = days.length;
  const xOf = (i: number) => (i / (n - 1)) * WAVE_W;
  const yOf = (v: number) => { const pad = 10; return pad + (1 - (v - 1) / 4) * (WAVE_H - 2 * pad); };

  const moodPts   = present.map(d => ({ x: xOf(d.i), y: yOf(d.entry!.mood) }));
  const energyPts = present.map(d => ({ x: xOf(d.i), y: yOf(d.entry!.energy) }));
  const moodPath  = buildSmoothPath(moodPts);
  const enPath    = buildSmoothPath(energyPts);
  const fillPath  = `${moodPath} L ${moodPts[moodPts.length - 1].x.toFixed(1)} ${WAVE_H} L ${moodPts[0].x.toFixed(1)} ${WAVE_H} Z`;

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <TrendingUp size={13} color={P.accent} />
        <Text style={styles.cardLabel}>Nastrój i energia — 30 dni</Text>
      </View>
      <Svg width="100%" height={WAVE_H} viewBox={`0 0 ${WAVE_W} ${WAVE_H}`}>
        <Defs>
          <SvgGrad id="moodFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={P.accent} stopOpacity="0.30" />
            <Stop offset="1" stopColor={P.accent} stopOpacity="0" />
          </SvgGrad>
        </Defs>
        <Path d={fillPath} fill="url(#moodFill)" />
        <Path d={enPath} stroke="rgba(255,255,255,0.6)" strokeWidth={1.8} fill="none" strokeDasharray="4 4" strokeLinecap="round" opacity={0.8} />
        <Path d={moodPath} stroke={P.accent} strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {moodPts.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={2.6} fill={MOOD_COLORS[present[i].entry!.mood]} />
        ))}
      </Svg>
      <View style={wv.legend}>
        <View style={wv.legendItem}><View style={[wv.dot, { backgroundColor: P.accent }]} /><Text style={wv.legendText}>Nastrój</Text></View>
        <View style={wv.legendItem}><View style={[wv.dash, { backgroundColor: 'rgba(255,255,255,0.6)' }]} /><Text style={wv.legendText}>Energia</Text></View>
      </View>
    </View>
  );
}

const wv = StyleSheet.create({
  legend: { flexDirection: 'row', gap: spacing[4], justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dash: { width: 14, height: 3, borderRadius: 2 },
  legendText: { fontSize: 10, color: colors.text.muted, fontWeight: '600' },
});

// ─── Mood distribution (how often each level, last 30d) ───────────────────────

function MoodDistribution({ entries }: { entries: MoodEntry[] }) {
  const recent = entries.filter(e => e.date >= dateMinusDays(30));
  if (recent.length < 4) return null;
  const counts: Record<MoodLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const e of recent) counts[e.mood]++;
  const total = recent.length;
  const levels: MoodLevel[] = [5, 4, 3, 2, 1];

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <BarChart3 size={13} color={P.accent} />
        <Text style={styles.cardLabel}>Rozkład nastroju — 30 dni</Text>
      </View>
      {/* Stacked proportion bar */}
      <View style={dist.bar}>
        {([1, 2, 3, 4, 5] as MoodLevel[]).map(lvl => counts[lvl] > 0 ? (
          <View key={lvl} style={{ flex: counts[lvl], backgroundColor: MOOD_COLORS[lvl] }} />
        ) : null)}
      </View>
      {/* Per-level rows */}
      <View style={{ gap: 6 }}>
        {levels.map(lvl => {
          const pct = total ? Math.round((counts[lvl] / total) * 100) : 0;
          return (
            <View key={lvl} style={dist.row}>
              <Text style={dist.emo}>{MOOD_EMO[lvl]}</Text>
              <Text style={[dist.lvlLabel, { color: MOOD_COLORS[lvl] }]}>{MOOD_LABELS[lvl]}</Text>
              <View style={dist.track}>
                <View style={[dist.fill, { width: `${pct}%`, backgroundColor: MOOD_COLORS[lvl] }]} />
              </View>
              <Text style={dist.pct}>{pct}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const dist = StyleSheet.create({
  bar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  emo: { fontSize: 14, width: 20 },
  lvlLabel: { fontSize: 11, fontWeight: '700', width: 64 },
  track: { flex: 1, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  fill: { height: 7, borderRadius: 4 },
  pct: { fontSize: 11, fontWeight: '700', color: colors.text.secondary, width: 34, textAlign: 'right' },
});

// ─── Weekday pattern (avg mood per weekday) ───────────────────────────────────

function WeekdayPattern({ entries }: { entries: MoodEntry[] }) {
  if (entries.length < 5) return null;
  const buckets = Array.from({ length: 7 }, () => ({ total: 0, count: 0 })); // Mon..Sun
  for (const e of entries) {
    const dow = (new Date(e.date).getDay() + 6) % 7; // Mon=0
    buckets[dow].total += e.mood;
    buckets[dow].count++;
  }
  const avgs = buckets.map(b => b.count ? b.total / b.count : null);
  const valid = avgs.filter((v): v is number => v != null);
  if (valid.length < 3) return null;
  const best = Math.max(...valid);

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <CalendarDays size={13} color={P.accent} />
        <Text style={styles.cardLabel}>Nastrój wg dnia tygodnia</Text>
      </View>
      <View style={wd.row}>
        {avgs.map((a, i) => (
          <View key={i} style={wd.col}>
            <View style={[
              wd.cell,
              { backgroundColor: a != null ? moodColorFor(a) + 'E6' : 'rgba(255,255,255,0.05)' },
              a != null && a === best ? wd.cellBest : null,
            ]}>
              <Text style={[wd.cellVal, { color: a != null ? '#0B0B0B' : colors.text.muted }]}>
                {a != null ? a.toFixed(1) : '–'}
              </Text>
            </View>
            <Text style={wd.dow}>{WEEKDAYS_SHORT[i]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const wd = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5 },
  col: { flex: 1, alignItems: 'center', gap: 5 },
  cell: { width: '100%', aspectRatio: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  cellBest: { borderWidth: 2, borderColor: '#FFFFFF' },
  cellVal: { fontSize: 13, fontWeight: '800' },
  dow: { fontSize: 9, fontWeight: '700', color: colors.text.muted },
});

// ─── Time-of-day pattern (from createdAt) ─────────────────────────────────────

const TOD_BUCKETS = [
  { key: 'rano',       label: 'Rano',       Icon: Sunrise, from: 6,  to: 12 },
  { key: 'popoludnie', label: 'Popołudnie', Icon: Sun,     from: 12, to: 18 },
  { key: 'wieczor',    label: 'Wieczór',    Icon: Sunset,  from: 18, to: 24 },
  { key: 'noc',        label: 'Noc',        Icon: Moon,    from: 0,  to: 6  },
];

function TimeOfDayPattern({ entries }: { entries: MoodEntry[] }) {
  const withTime = entries.filter(e => e.createdAt);
  if (withTime.length < 5) return null;
  const stats = TOD_BUCKETS.map(b => {
    const inBucket = withTime.filter(e => {
      const h = new Date(e.createdAt).getHours();
      return h >= b.from && h < b.to;
    });
    const avg = inBucket.length ? inBucket.reduce((a, c) => a + c.mood, 0) / inBucket.length : null;
    return { ...b, avg, count: inBucket.length };
  });
  if (stats.every(s => s.count === 0)) return null;

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Clock size={13} color={P.accent} />
        <Text style={styles.cardLabel}>Nastrój wg pory dnia</Text>
      </View>
      <View style={tod.row}>
        {stats.map(s => {
          const c = s.avg != null ? moodColorFor(s.avg) : colors.text.muted;
          return (
            <View key={s.key} style={tod.tile}>
              <s.Icon size={15} color={c} />
              <Text style={[tod.val, { color: s.avg != null ? c : colors.text.muted }]}>
                {s.avg != null ? s.avg.toFixed(1) : '–'}
              </Text>
              <Text style={tod.label}>{s.label}</Text>
              <Text style={tod.count}>{s.count > 0 ? `${s.count}×` : ''}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const tod = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing[2] },
  tile: {
    flex: 1, backgroundColor: colors.bg.elevated, borderRadius: radius.lg,
    paddingVertical: spacing[3], gap: 3, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  val: { fontSize: 17, fontWeight: '800', letterSpacing: -0.5 },
  label: { fontSize: 9, fontWeight: '600', color: colors.text.muted },
  count: { fontSize: 9, color: colors.text.muted, opacity: 0.7 },
});

// ─── Month heatmap (calendar of mood colours) ─────────────────────────────────

function MonthHeatmap({ entries }: { entries: MoodEntry[] }) {
  const byDate = useMemo(() => {
    const m: Record<string, MoodEntry> = {};
    for (const e of entries) m[e.date] = e;
    return m;
  }, [entries]);

  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayD = now.getDate();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const p2 = (n: number) => String(n).padStart(2, '0');

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const monthEntries = entries.filter(e => e.date.startsWith(`${year}-${p2(month + 1)}`));
  if (monthEntries.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <CalendarDays size={13} color={P.accent} />
        <Text style={styles.cardLabel}>Ten miesiąc</Text>
      </View>
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row' }}>
          {WEEKDAYS_SHORT.map(d => (
            <View key={d} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={hm.dow}>{d}</Text>
            </View>
          ))}
        </View>
        {rows.map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row' }}>
            {row.map((day, ci) => {
              if (!day) return <View key={ci} style={{ flex: 1 }} />;
              const dateStr = `${year}-${p2(month + 1)}-${p2(day)}`;
              const entry = byDate[dateStr];
              const mc = entry ? MOOD_COLORS[entry.mood] : null;
              const isT = day === todayD;
              return (
                <View key={ci} style={hm.cellWrap}>
                  <View style={[
                    hm.cell,
                    { backgroundColor: mc ? mc + 'E6' : 'rgba(255,255,255,0.05)' },
                    isT ? hm.cellToday : null,
                  ]}>
                    <Text style={[hm.cellDay, { color: mc ? '#0B0B0B' : colors.text.muted }]}>{day}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const hm = StyleSheet.create({
  dow: { fontSize: 8, fontWeight: '700', color: colors.text.muted, letterSpacing: 0.4 },
  cellWrap: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  cell: { width: '88%', aspectRatio: 1, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  cellToday: { borderWidth: 1.5, borderColor: '#FFFFFF' },
  cellDay: { fontSize: 10, fontWeight: '700' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function dateMinusDays(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtShort(dateStr: string) {
  const [, m, d] = dateStr.split('-');
  return `${parseInt(d)}.${parseInt(m)}`;
}
function calcStreak(entries: MoodEntry[]): number {
  const byDate = new Set(entries.map(e => e.date));
  let streak = 0, i = 0;
  while (byDate.has(dateMinusDays(i))) { streak++; i++; }
  return streak;
}
function avg(vals: number[]) {
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

// ─── Patterns / conclusions (mood ↔ work / day type / keywords) ───────────────

function dayBeforeStr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d - 1);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function buildPatterns(entries: MoodEntry[], workByDate: Record<string, number>): string[] {
  const out: string[] = [];
  const mean = (a: number[]) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;

  // Work days vs days off
  const workMood: number[] = [], offMood: number[] = [];
  for (const e of entries) ((workByDate[e.date] ?? 0) > 0 ? workMood : offMood).push(e.mood);
  const wM = mean(workMood), oM = mean(offMood);
  if (wM != null && oM != null && workMood.length >= 3 && offMood.length >= 3 && Math.abs(oM - wM) >= 0.35) {
    out.push(oM > wM
      ? `W dni wolne masz lepszy humor (${oM.toFixed(1)}) niż w dni pracy (${wM.toFixed(1)}).`
      : `W dni pracy masz lepszy humor (${wM.toFixed(1)}) niż w wolne (${oM.toFixed(1)}).`);
  }

  // Energy the day AFTER a work day
  const afterWork: number[] = [], afterRest: number[] = [];
  for (const e of entries) ((workByDate[dayBeforeStr(e.date)] ?? 0) > 0 ? afterWork : afterRest).push(e.energy);
  const aw = mean(afterWork), ar = mean(afterRest);
  if (aw != null && ar != null && afterWork.length >= 3 && afterRest.length >= 3 && Math.abs(ar - aw) >= 0.35) {
    out.push(ar > aw
      ? `Dzień po pracy masz zwykle mniej energii (${aw.toFixed(1)} vs ${ar.toFixed(1)}).`
      : `Dzień po pracy masz zwykle więcej energii (${aw.toFixed(1)} vs ${ar.toFixed(1)}).`);
  }

  // Longer shifts → next-day mood
  const afterLong: number[] = [], afterShort: number[] = [];
  for (const e of entries) {
    const h = workByDate[dayBeforeStr(e.date)] ?? 0;
    if (h > 0) (h >= 9 ? afterLong : afterShort).push(e.mood);
  }
  const al = mean(afterLong), as = mean(afterShort);
  if (al != null && as != null && afterLong.length >= 3 && afterShort.length >= 3 && Math.abs(as - al) >= 0.4) {
    out.push(`Po dłuższych zmianach (9h+) masz nazajutrz ${al < as ? 'gorszy' : 'lepszy'} humor (${al.toFixed(1)} vs ${as.toFixed(1)}).`);
  }

  // Weekend vs weekday
  const wknd: number[] = [], wkdy: number[] = [];
  for (const e of entries) { const dow = new Date(e.date).getDay(); ((dow === 0 || dow === 6) ? wknd : wkdy).push(e.mood); }
  const we = mean(wknd), wd = mean(wkdy);
  if (we != null && wd != null && wknd.length >= 3 && wkdy.length >= 3 && Math.abs(we - wd) >= 0.35) {
    out.push(we > wd
      ? `W weekendy masz lepszy humor (${we.toFixed(1)}) niż w tygodniu (${wd.toFixed(1)}).`
      : `W tygodniu masz lepszy humor (${wd.toFixed(1)}) niż w weekendy (${we.toFixed(1)}).`);
  }

  // Most common stress keyword
  const { negative, positive } = extractKeywords(entries);
  if (negative.length > 0) out.push(`Najczęściej stresują Cię: ${negative.slice(0, 2).map(k => k.word).join(', ')}.`);
  if (positive.length > 0 && out.length < 5) out.push(`Najlepiej działają na Ciebie: ${positive.slice(0, 2).map(k => k.word).join(', ')}.`);

  return out.slice(0, 5);
}

function MoodPatterns({ entries, workByDate }: { entries: MoodEntry[]; workByDate: Record<string, number> }) {
  const lines = useMemo(() => buildPatterns(entries, workByDate), [entries, workByDate]);
  if (entries.length < 6 || lines.length === 0) return null;
  return (
    <View style={pat.card}>
      <View style={pat.header}>
        <Sparkles size={13} color={P.accent} />
        <Text style={pat.title}>Wnioski</Text>
      </View>
      <View style={{ gap: spacing[2] }}>
        {lines.map((l, i) => (
          <View key={i} style={pat.row}>
            <View style={pat.dot} />
            <Text style={pat.text}>{l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const pat = StyleSheet.create({
  card: { backgroundColor: P.card, borderRadius: radius.xl, padding: spacing[4], gap: spacing[3], borderWidth: 1, borderColor: P.cardBorder },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { fontSize: 10, fontWeight: '700', color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  row: { flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: P.accent, marginTop: 6 },
  text: { flex: 1, fontSize: 12.5, color: colors.text.secondary, lineHeight: 18 },
});

export default function MoodScreen() {
  const { entries, setEntries, setLoading, deleteEntry } = useMoodStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MoodEntry | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { openCheckIn } = useLocalSearchParams<{ openCheckIn?: string }>();

  const today = todayStr();
  const todayEntry = useMemo(() => entries.find(e => e.date === today) ?? null, [entries, today]);

  // Auto-open check-in modal when navigated from notification.
  useFocusEffect(
    useCallback(() => {
      if (openCheckIn === 'true') {
        setEditingEntry(todayEntry);
        setModalOpen(true);
      }
    }, [openCheckIn, todayEntry]),
  );

  useEffect(() => { load(); }, []);
  const load = async () => {
    try { setLoading(true); setEntries(await moodService.getAll()); }
    catch (_) {} finally { setLoading(false); }
  };
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const last30 = useMemo(() => entries.filter(e => e.date >= dateMinusDays(30)), [entries]);
  const avgMood = avg(last30.map(e => e.mood));
  const avgEnergy = avg(last30.map(e => e.energy));

  // Work hours per day (local + Google), for the mood↔work correlations.
  const calEvents = useCalendarStore(s => s.events);
  const gcalEvents = useCalendarStore(s => s.gcalEvents);
  const workSettings = useWorkStore(s => s.settings);
  const workByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of [...calEvents, ...gcalEvents]) {
      if (!isWorkEvent(e, { workColor: workSettings.workColor, workPrefix: workSettings.workPrefix })) continue;
      const d = (e.date ?? '').slice(0, 10);
      if (d) map[d] = (map[d] ?? 0) + shiftHours(e);
    }
    return map;
  }, [calEvents, gcalEvents, workSettings.workColor, workSettings.workPrefix]);
  const streak = useMemo(() => calcStreak(entries), [entries]);
  const recent = useMemo(() => entries.slice(0, 14), [entries]);

  const todayColor = todayEntry ? MOOD_COLORS[todayEntry.mood] : colors.text.muted;

  const openCheckin = (entry?: MoodEntry | null) => {
    setEditingEntry(entry ?? null);
    setModalOpen(true);
  };

  const handleDeleteEntry = (entry: MoodEntry) => {
    Alert.alert('Usuń wpis', 'Na pewno usunąć ten check-in?', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń', style: 'destructive', onPress: async () => {
          haptic.medium();
          deleteEntry(entry.id);
          await moodService.remove(entry.id).catch(() => {});
          toast.info('Usunięto');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScreenHeader
        title="Nastrój"
        subtitle="Twoje samopoczucie"
        accentColor={P.accent}
        rightSlot={
          <PressableScale onPress={() => { haptic.tap(); setModalOpen(true); }} style={styles.addBtn}>
            <Plus size={17} color={colors.bg.primary} />
          </PressableScale>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.text.muted} />}
      >
        {/* Today hero */}
        <View>
          <PressableScale onPress={() => { haptic.tap(); openCheckin(todayEntry); }}>
            <View style={styles.heroCard}>
              <View style={styles.heroRow}>
                <View style={[styles.moodBubble, { borderColor: todayColor + '44' }]}>
                  {todayEntry
                    ? <Text style={[styles.moodNum, { color: todayColor }]}>{MOOD_EMOJIS[todayEntry.mood]}</Text>
                    : <Smile size={20} color={colors.text.muted} />
                  }
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroMeta}>
                    {todayEntry ? 'Dzisiaj' : 'Check-in'}
                  </Text>
                  <Text style={[styles.heroMood, { color: todayEntry ? todayColor : colors.text.secondary }]}>
                    {todayEntry ? MOOD_LABELS[todayEntry.mood] : 'Jak się czujesz?'}
                  </Text>
                </View>
                {todayEntry && (
                  <View style={styles.energyBadge}>
                    <Text style={styles.energyEmoji}>{ENERGY_EMOJIS[todayEntry.energy]}</Text>
                    <Text style={styles.energyText}>{todayEntry.energy}/5</Text>
                  </View>
                )}
              </View>
              {todayEntry?.note ? (
                <Text style={styles.heroNote} numberOfLines={2}>{todayEntry.note}</Text>
              ) : !todayEntry ? (
                <Text style={styles.cta}>Zaloguj nastrój — zajmie 10 sekund</Text>
              ) : null}
            </View>
          </PressableScale>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {[
            { icon: <Smile size={13} color={colors.text.muted} />, label: 'Śr. nastrój', val: avgMood > 0 ? avgMood.toFixed(1) : '—' },
            { icon: <Zap size={13} color={colors.text.muted} />, val: avgEnergy > 0 ? avgEnergy.toFixed(1) : '—', label: 'Śr. energia' },
            { icon: <Flame size={13} color={colors.text.muted} />, val: streak > 0 ? `${streak}d` : '0d', label: 'Seria' },
            { icon: <BookOpen size={13} color={colors.text.muted} />, val: String(entries.length), label: 'Łącznie' },
          ].map((s, i) => (
            <View key={i} style={styles.statCard}>
              {s.icon}
              <Text style={styles.statVal}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Mood + energy wave (30 days) */}
        <MoodEnergyWave entries={entries} />

        {/* Conclusions from notes + work/day context */}
        <MoodPatterns entries={entries} workByDate={workByDate} />

        {/* Rich statistics */}
        <MoodDistribution entries={entries} />
        <WeekdayPattern entries={entries} />
        <TimeOfDayPattern entries={entries} />
        <MonthHeatmap entries={entries} />

        {/* Insights */}
        <MoodInsights entries={entries} />
        <KeywordInsights entries={entries} />

        {/* Recent entries */}
        {recent.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <BookOpen size={13} color={colors.text.muted} />
              <Text style={styles.cardLabel}>Historia</Text>
            </View>
            {recent.map((entry) => {
              const mc = MOOD_COLORS[entry.mood];
              return (
                <TouchableOpacity
                  key={entry.id}
                  onPress={() => { haptic.tap(); openCheckin(entry); }}
                  onLongPress={() => { haptic.medium(); handleDeleteEntry(entry); }}
                  activeOpacity={0.75}
                >
                  <View style={styles.entryRow}>
                    <View style={[styles.entryDot, { backgroundColor: mc }]} />
                    <View style={styles.entryInfo}>
                      <View style={styles.entryTop}>
                        <Text style={[styles.entryMoodLabel, { color: mc }]}>{MOOD_LABELS[entry.mood]}</Text>
                        <View style={styles.entryEnergy}>
                          <Text style={styles.entryEnergyEmoji}>{ENERGY_EMOJIS[entry.energy]}</Text>
                        </View>
                        <Text style={styles.entryDate}>{fmtShort(entry.date)}</Text>
                      </View>
                      {entry.note ? <Text style={styles.entryNote} numberOfLines={1}>{entry.note}</Text> : null}
                      {(entry.tags ?? []).length > 0 && (
                        <View style={styles.entryTagRow}>
                          {(entry.tags ?? []).map(tag => (
                            <View key={tag} style={styles.entryTagChip}>
                              <Text style={styles.entryTagText}>#{tag}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {entries.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Brak wpisów</Text>
            <Text style={styles.emptySub}>Zaloguj swój pierwszy nastrój powyżej</Text>
          </View>
        )}
      </ScrollView>

      <MoodCheckInModal
        visible={modalOpen}
        onClose={() => { setModalOpen(false); setEditingEntry(null); }}
        existingEntry={editingEntry}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  scroll: { padding: spacing[4], gap: spacing[3], paddingBottom: 180 },
  addBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: P.accent, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: P.accent,
  },
  heroCard: {
    backgroundColor: P.card, borderRadius: radius.xl, padding: spacing[4],
    gap: spacing[3], borderWidth: 1, borderColor: P.cardBorder,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  moodBubble: {
    width: 48, height: 48, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  moodNum: { fontSize: 22, fontWeight: '900' },
  heroMeta: { ...typography.caption, color: colors.text.muted, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' },
  heroMood: { ...typography.h3, fontWeight: '700', marginTop: 2 },
  energyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: P.accent + '18',
    paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: radius.sm,
  },
  energyEmoji: { fontSize: 14 },
  energyText: { ...typography.caption, color: P.accent, fontWeight: '700', fontSize: 11 },
  heroNote: { ...typography.bodySmall, color: colors.text.secondary, lineHeight: 18 },
  cta: { ...typography.caption, color: colors.text.muted },

  statsRow: { flexDirection: 'row', gap: spacing[2] },
  statCard: {
    flex: 1, backgroundColor: P.card, borderRadius: radius.lg,
    padding: spacing[3], gap: 4, alignItems: 'center',
    borderWidth: 1, borderColor: P.cardBorder,
  },
  statVal: { fontSize: 18, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.5 },
  statLabel: { ...typography.caption, color: colors.text.muted, fontSize: 9, textAlign: 'center' },

  card: {
    backgroundColor: P.card, borderRadius: radius.xl, padding: spacing[4], gap: spacing[3],
    borderWidth: 1, borderColor: P.cardBorder,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  cardLabel: { ...typography.label, color: P.muted, fontWeight: '600' },

  chartWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  chartCol: { flex: 1, alignItems: 'center', gap: 3 },
  chartBarWrap: { height: 60, justifyContent: 'flex-end' },
  chartBar: { borderRadius: 3 },
  chartLabel: { ...typography.caption, color: colors.text.muted, fontSize: 8, textAlign: 'center' },

  entryRow: {
    flexDirection: 'row', gap: spacing[3], alignItems: 'flex-start',
    paddingVertical: spacing[2],
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  entryDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  entryInfo: { flex: 1, gap: 3 },
  entryTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  entryMoodLabel: { ...typography.label, fontWeight: '700', fontSize: 13 },
  entryEnergy: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  entryEnergyText: { ...typography.caption, color: colors.text.muted, fontSize: 10 },
  entryEnergyEmoji: { fontSize: 12 },
  entryDate: { ...typography.caption, color: colors.text.muted, marginLeft: 'auto' },
  entryNote: { ...typography.caption, color: colors.text.secondary, lineHeight: 16 },

  entryTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 2 },
  entryTagChip: {
    paddingHorizontal: 5, paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: 'rgba(244,114,182,0.08)',
    borderWidth: 1, borderColor: 'rgba(244,114,182,0.22)',
  },
  entryTagText: { fontSize: 9, fontWeight: '600', color: P.muted },

  empty: { alignItems: 'center', paddingVertical: spacing[12], gap: spacing[2] },
  emptyTitle: { ...typography.h3, color: colors.text.secondary },
  emptySub: { ...typography.body, color: colors.text.muted, textAlign: 'center' },
});

import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Smile, Zap, Flame, BookOpen, Plus, TrendingUp, TrendingDown, Tag } from 'lucide-react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';

import ScreenHeader from '@/components/ui/ScreenHeader';
import PressableScale from '@/components/ui/PressableScale';
import MoodCheckInModal from '@/components/mood/MoodCheckInModal';
import { useMoodStore } from '@/store/moodStore';
import { moodService } from '@/services/moodService';
import { MoodEntry, MOOD_LABELS, MOOD_COLORS, MoodLevel } from '@/types';
import { colors, spacing, radius, typography } from '@/theme';
import { toast } from '@/store/toastStore';

// ─── Mood Insights ────────────────────────────────────────────────────────────

const DOW_FULL = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];

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
                  ? <TrendingUp size={13} color={colors.accent.green} />
                  : <TrendingDown size={13} color={colors.accent.red} />
                }
                <Text style={[ins.tileVal, { color: trendUp ? colors.accent.green : colors.accent.red }]}>
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
              <Text style={[ins.tileVal, { color: colors.accent.purple }]} numberOfLines={1}>
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
            <Tag size={11} color={colors.accent.green} />
            <Text style={[ins.tagSectionLabel, { color: colors.accent.green }]}>Dobry nastrój</Text>
          </View>
          <View style={ins.tagRow}>
            {topGoodTags.map(tag => (
              <View key={tag} style={[ins.tagChip, { backgroundColor: colors.accent.green + '18', borderColor: colors.accent.green + '35' }]}>
                <Text style={[ins.tagText, { color: colors.accent.green }]}>#{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {topBadTags.length > 0 && (
        <View style={ins.tagSection}>
          <View style={ins.tagHeader}>
            <Tag size={11} color={colors.accent.red} />
            <Text style={[ins.tagSectionLabel, { color: colors.accent.red }]}>Niski nastrój</Text>
          </View>
          <View style={ins.tagRow}>
            {topBadTags.map(tag => (
              <View key={tag} style={[ins.tagChip, { backgroundColor: colors.accent.red + '18', borderColor: colors.accent.red + '35' }]}>
                <Text style={[ins.tagText, { color: colors.accent.red }]}>#{tag}</Text>
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
    backgroundColor: colors.bg.card, borderRadius: radius.xl, padding: spacing[4],
    gap: spacing[3], borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
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

const CHART_DAYS = 28;

export default function MoodScreen() {
  const { entries, setEntries, setLoading, deleteEntry } = useMoodStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MoodEntry | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { openCheckIn } = useLocalSearchParams<{ openCheckIn?: string }>();

  // Auto-open check-in modal when navigated from notification.
  // If there's already a today entry, open it in edit mode; otherwise new.
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

  const today = todayStr();
  const todayEntry = useMemo(() => entries.find(e => e.date === today) ?? null, [entries, today]);
  const last30 = useMemo(() => entries.filter(e => e.date >= dateMinusDays(30)), [entries]);
  const avgMood = avg(last30.map(e => e.mood));
  const avgEnergy = avg(last30.map(e => e.energy));
  const streak = useMemo(() => calcStreak(entries), [entries]);
  const recent = useMemo(() => entries.slice(0, 14), [entries]);

  const chartDays = useMemo(() => {
    const byDate: Record<string, MoodEntry> = {};
    for (const e of entries) byDate[e.date] = e;
    return Array.from({ length: CHART_DAYS }, (_, i) => {
      const d = dateMinusDays(CHART_DAYS - 1 - i);
      return { date: d, entry: byDate[d] ?? null };
    });
  }, [entries]);

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
          deleteEntry(entry.id);
          await moodService.remove(entry.id).catch(() => {});
          toast.info('Usunięto');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Nastrój"
        subtitle="Twoje samopoczucie"
        accentColor={colors.text.primary}
        rightSlot={
          <PressableScale onPress={() => setModalOpen(true)} style={styles.addBtn}>
            <Plus size={17} color={colors.text.secondary} />
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
          <PressableScale onPress={() => openCheckin(todayEntry)}>
            <View style={styles.heroCard}>
              <View style={styles.heroRow}>
                <View style={[styles.moodBubble, { borderColor: todayColor + '44' }]}>
                  {todayEntry
                    ? <Text style={[styles.moodNum, { color: todayColor }]}>{todayEntry.mood}</Text>
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
                    <Zap size={11} color={colors.accent.warning} />
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

        {/* 28-day chart */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <TrendingUp size={13} color={colors.text.muted} />
            <Text style={styles.cardLabel}>Ostatnie 28 dni</Text>
          </View>
          <View style={styles.chartWrap}>
            {chartDays.map(({ date, entry }, i) => {
              const isToday = date === today;
              const barH = entry ? Math.max(6, (entry.mood / 5) * 56) : 3;
              const barColor = entry ? MOOD_COLORS[entry.mood] : 'rgba(255,255,255,0.07)';
              return (
                <View key={i} style={styles.chartCol}>
                  <View style={styles.chartBarWrap}>
                    <View style={[styles.chartBar, {
                      height: barH, width: isToday ? 10 : 6,
                      backgroundColor: barColor,
                      opacity: entry ? 1 : 0.5,
                    }]} />
                  </View>
                  {(i === 0 || i === 6 || i === 13 || i === 20 || i === 27) && (
                    <Text style={[styles.chartLabel, isToday && { color: colors.text.secondary }]}>
                      {isToday ? 'dziś' : fmtShort(date)}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Insights */}
        <MoodInsights entries={entries} />

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
                  onPress={() => openCheckin(entry)}
                  onLongPress={() => handleDeleteEntry(entry)}
                  activeOpacity={0.75}
                >
                  <View style={styles.entryRow}>
                    <View style={[styles.entryDot, { backgroundColor: mc }]} />
                    <View style={styles.entryInfo}>
                      <View style={styles.entryTop}>
                        <Text style={[styles.entryMoodLabel, { color: mc }]}>{MOOD_LABELS[entry.mood]}</Text>
                        <View style={styles.entryEnergy}>
                          <Zap size={9} color={colors.text.muted} />
                          <Text style={styles.entryEnergyText}>{entry.energy}</Text>
                        </View>
                        <Text style={styles.entryDate}>{fmtShort(entry.date)}</Text>
                      </View>
                      {entry.note ? <Text style={styles.entryNote} numberOfLines={1}>{entry.note}</Text> : null}
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
  scroll: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[10] },
  addBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.bg.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  heroCard: {
    backgroundColor: colors.bg.card, borderRadius: radius.xl, padding: spacing[4],
    gap: spacing[3], borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
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
    backgroundColor: colors.accent.warning + '18',
    paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: radius.sm,
  },
  energyText: { ...typography.caption, color: colors.accent.warning, fontWeight: '700', fontSize: 11 },
  heroNote: { ...typography.bodySmall, color: colors.text.secondary, lineHeight: 18 },
  cta: { ...typography.caption, color: colors.text.muted },

  statsRow: { flexDirection: 'row', gap: spacing[2] },
  statCard: {
    flex: 1, backgroundColor: colors.bg.card, borderRadius: radius.lg,
    padding: spacing[3], gap: 4, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  statVal: { fontSize: 18, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.5 },
  statLabel: { ...typography.caption, color: colors.text.muted, fontSize: 9, textAlign: 'center' },

  card: {
    backgroundColor: colors.bg.card, borderRadius: radius.xl, padding: spacing[4], gap: spacing[3],
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  cardLabel: { ...typography.label, color: colors.text.secondary, fontWeight: '600' },

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
  entryDate: { ...typography.caption, color: colors.text.muted, marginLeft: 'auto' },
  entryNote: { ...typography.caption, color: colors.text.secondary, lineHeight: 16 },

  empty: { alignItems: 'center', paddingVertical: spacing[12], gap: spacing[2] },
  emptyTitle: { ...typography.h3, color: colors.text.secondary },
  emptySub: { ...typography.body, color: colors.text.muted, textAlign: 'center' },
});

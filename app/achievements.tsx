import { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Trophy, X } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import BadgeArt from '@/components/achievements/BadgeArt';
import { useExpensesStore } from '@/store/expensesStore';
import { useMoodStore } from '@/store/moodStore';
import { useCalendarStore } from '@/store/calendarStore';
import { useWorkStore } from '@/store/workStore';
import { useHabits } from '@/hooks/useHabits';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { getHealthHistory } from '@/utils/healthHistory';
import {
  AchCtx, buildAchCtx, evaluateAchievements, syncEarned, getEarned, EarnedMap,
  fmtProgress, AchState, AchGroup, TIER_COLOR,
} from '@/utils/achievements';
import { spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { haptic } from '@/utils/haptics';

const GROUP_ORDER: AchGroup[] = ['Nawyki', 'Jedzenie', 'Oszczędzanie', 'Praca', 'Konsekwencja', 'Zdrowie'];

export default function Achievements() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);

  const { expenses } = useExpensesStore();
  const { entries: moodEntries } = useMoodStore();
  const { events, gcalEvents } = useCalendarStore();
  const { settings: workSettings } = useWorkStore();
  const { habits, todayDone, getStreak } = useHabits();
  const { subscriptions } = useSubscriptions();
  const [bestSteps, setBestSteps] = useState(0);
  const [earned, setEarnedMap] = useState<EarnedMap>({});
  const [detail, setDetail] = useState<AchState | null>(null);

  useEffect(() => { getEarned().then(setEarnedMap).catch(() => {}); }, []);
  useEffect(() => {
    getHealthHistory(180).then(h => {
      let m = 0; for (const v of Object.values(h)) m = Math.max(m, v.steps || 0);
      setBestSteps(m);
    }).catch(() => {});
  }, []);

  const ctx = useMemo<AchCtx>(() => buildAchCtx({
    expenses, moodEntries, workEvents: [...events, ...gcalEvents], workSettings,
    habitBestStreak: habits.length ? Math.max(0, ...habits.map(h => getStreak(h.id))) : 0,
    allHabitsToday: habits.length > 0 && todayDone.length >= habits.length,
    bestStepsDay: bestSteps, billTracked: subscriptions.some(sub => sub.active),
  }), [expenses, moodEntries, events, gcalEvents, workSettings, habits, todayDone, getStreak, bestSteps, subscriptions]);

  const states = useMemo(() => evaluateAchievements(ctx), [ctx]);
  useEffect(() => {
    syncEarned(states).then(fresh => { if (fresh.length) getEarned().then(setEarnedMap); }).catch(() => {});
  }, [states]);

  const unlockedCount = states.filter(st => st.unlocked).length;
  const pct = states.length ? unlockedCount / states.length : 0;

  const byGroup = useMemo(() => {
    const map = {} as Record<AchGroup, AchState[]>;
    for (const g of GROUP_ORDER) map[g] = [];
    for (const st of states) (map[st.a.group] ??= []).push(st);
    // unlocked first, then by progress desc
    for (const g of GROUP_ORDER) map[g].sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || b.progress - a.progress);
    return map;
  }, [states]);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}>
          <ChevronLeft size={22} color={c.text.primary} />
        </PressableScale>
        <Text style={s.headerTitle}>Gablota</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <View style={s.summary}>
          <View style={[s.trophyWrap, { backgroundColor: TIER_COLOR[3] + '22', borderColor: TIER_COLOR[3] + '66' }]}>
            <Trophy size={26} color={TIER_COLOR[3]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.summaryBig}>{unlockedCount} <Text style={s.summarySmall}>/ {states.length} zdobyte</Text></Text>
            <View style={s.sumBar}>
              <View style={{ width: `${Math.round(pct * 100)}%`, height: '100%', backgroundColor: TIER_COLOR[3], borderRadius: 5 }} />
            </View>
          </View>
        </View>

        {GROUP_ORDER.filter(g => byGroup[g]?.length).map(g => (
          <View key={g} style={{ marginTop: spacing[4] }}>
            <Text style={s.groupTitle}>{g}</Text>
            <View style={s.grid}>
              {byGroup[g].map(st => (
                <TouchableOpacity key={st.a.id} style={s.cell} activeOpacity={0.8}
                  onPress={() => { haptic.tap(); setDetail(st); }}>
                  <BadgeArt id={st.a.id} tier={st.a.tier} unlocked={st.unlocked} size={72} />
                  <Text style={[s.cellTitle, !st.unlocked && { color: c.text.muted }]} numberOfLines={1}>{st.a.title}</Text>
                  {!st.unlocked && st.a.target > 1 && (
                    <View style={s.cellBar}>
                      <View style={{ width: `${Math.round(st.progress * 100)}%`, height: '100%', backgroundColor: TIER_COLOR[st.a.tier], borderRadius: 2 }} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Detail */}
      <Modal visible={!!detail} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setDetail(null)}>
        <View style={s.overlay}>
          <View style={s.detailCard}>
            <TouchableOpacity style={s.detailClose} onPress={() => setDetail(null)} hitSlop={10}>
              <X size={18} color={c.text.muted} />
            </TouchableOpacity>
            {detail && (
              <>
                <BadgeArt id={detail.a.id} tier={detail.a.tier} unlocked={detail.unlocked} size={104} />
                <Text style={s.detailTitle}>{detail.a.title}</Text>
                <Text style={s.detailDesc}>{detail.a.desc}</Text>
                <View style={s.detailBar}>
                  <View style={{ width: `${Math.round(detail.progress * 100)}%`, height: '100%', backgroundColor: TIER_COLOR[detail.a.tier], borderRadius: 4 }} />
                </View>
                <Text style={s.detailProg}>{fmtProgress(detail)}</Text>
                {detail.unlocked && earned[detail.a.id] && (
                  <Text style={s.detailDate}>Zdobyte {new Date(earned[detail.a.id]).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeS = (c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: c.text.primary },
  scroll: { padding: spacing[4], paddingTop: spacing[2] },

  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[4] },
  trophyWrap: { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  summaryBig: { fontSize: 26, fontWeight: '900', color: c.text.primary, letterSpacing: -0.5 },
  summarySmall: { fontSize: 14, fontWeight: '700', color: c.text.muted },
  sumBar: { height: 9, borderRadius: 5, backgroundColor: c.fill.subtle, marginTop: 8, overflow: 'hidden' },

  groupTitle: { fontSize: 12, fontWeight: '800', color: c.text.secondary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: spacing[2] },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '33.33%', alignItems: 'center', paddingVertical: spacing[2], gap: 6 },
  cellTitle: { fontSize: 11.5, fontWeight: '700', color: c.text.primary, textAlign: 'center', maxWidth: '92%' },
  cellBar: { width: '64%', height: 4, borderRadius: 2, backgroundColor: c.fill.subtle, overflow: 'hidden' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing[5] },
  detailCard: { width: '100%', maxWidth: 320, backgroundColor: c.bg.card, borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default, padding: spacing[5], alignItems: 'center', gap: spacing[2] },
  detailClose: { position: 'absolute', top: 12, right: 12, padding: 4, zIndex: 2 },
  detailTitle: { fontSize: 19, fontWeight: '900', color: c.text.primary, marginTop: spacing[2], textAlign: 'center' },
  detailDesc: { fontSize: 13, color: c.text.secondary, textAlign: 'center', lineHeight: 18 },
  detailBar: { width: '80%', height: 8, borderRadius: 4, backgroundColor: c.fill.subtle, marginTop: spacing[2], overflow: 'hidden' },
  detailProg: { fontSize: 12.5, fontWeight: '700', color: c.text.muted },
  detailDate: { fontSize: 11.5, fontWeight: '600', color: c.text.muted, marginTop: 2 },
});

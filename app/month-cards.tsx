import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Layers } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import MonthWrappedCard from '@/components/dashboard/MonthWrappedCard';
import { buildMonthCards } from '@/utils/monthCards';
import { computePayMonths } from '@/utils/workSummary';
import { useExpensesStore } from '@/store/expensesStore';
import { useMoodStore } from '@/store/moodStore';
import { useCalendarStore } from '@/store/calendarStore';
import { useWorkStore } from '@/store/workStore';
import { useStatsScope } from '@/store/statsScope';
import { getHealthHistory } from '@/utils/healthHistory';
import { loadNameAliases } from '@/utils/productMemory';
import { spacing, typography } from '@/theme';
import { useColors } from '@/theme/useColors';

const ACCENT = '#7C3AED';

export default function MonthCards() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);

  const { expenses } = useExpensesStore();
  const { entries: moodEntries } = useMoodStore();
  const { events, gcalEvents } = useCalendarStore();
  const { settings: workSettings } = useWorkStore();
  const scope = useStatsScope(st => st.scope);

  const [healthDays, setHealthDays] = useState<Record<string, { steps: number; sleepMinutes: number; weightKg: number | null }>>({});
  const [nameAliases, setNameAliases] = useState<Record<string, string>>({});

  useEffect(() => {
    getHealthHistory(400).then(h => {
      const m: Record<string, { steps: number; sleepMinutes: number; weightKg: number | null }> = {};
      for (const [d, v] of Object.entries(h)) m[d] = { steps: v.steps, sleepMinutes: v.sleepMinutes, weightKg: v.weight > 0 ? v.weight : null };
      setHealthDays(m);
    }).catch(() => {});
    loadNameAliases().then(setNameAliases).catch(() => {});
  }, []);

  const allEvents = useMemo(() => [...events, ...gcalEvents], [events, gcalEvents]);
  const payMonths = useMemo(() => computePayMonths(expenses, allEvents, workSettings), [expenses, allEvents, workSettings]);
  const cards = useMemo(
    () => buildMonthCards({ expenses, moodEntries, healthDays, payMonths, nameAliases, scope }),
    [expenses, moodEntries, healthDays, payMonths, nameAliases, scope],
  );

  const sealed = cards.filter(c2 => !c2.inProgress).length;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}>
          <ChevronLeft size={22} color={c.text.primary} />
        </PressableScale>
        <Text style={s.headerTitle}>Kolekcja miesięcy</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {cards.length === 0 ? (
          <View style={s.empty}>
            <Layers size={32} color={c.text.muted} />
            <Text style={s.emptyText}>
              Tu wylądują Twoje karty miesięcy — jak Wrapped. Zbieraj dane (paragony, kroki, nastrój), a co miesiąc dostaniesz nową kartę do kolekcji.
            </Text>
          </View>
        ) : (
          <>
            <View style={s.intro}>
              <View style={s.introBadge}><Layers size={15} color={ACCENT} /></View>
              <Text style={s.introText}>
                <Text style={s.introNum}>{sealed}</Text> {sealed === 1 ? 'zebrana karta' : 'zebranych kart'}
                {cards.some(c2 => c2.inProgress) ? '  ·  1 w trakcie' : ''}
              </Text>
            </View>
            <View style={{ gap: spacing[4] }}>
              {cards.map((card, i) => <MonthWrappedCard key={card.month} card={card} delay={Math.min(i, 6) * 70} />)}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = (c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: c.text.primary },
  scroll: { padding: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[8] },

  empty: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[8] },
  emptyText: { fontSize: 13, color: c.text.muted, textAlign: 'center', maxWidth: 280, lineHeight: 20 },

  intro: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing[4] },
  introBadge: { width: 30, height: 30, borderRadius: 9, backgroundColor: ACCENT + '22', alignItems: 'center', justifyContent: 'center' },
  introText: { fontSize: 14, color: c.text.secondary, fontWeight: '600' },
  introNum: { color: c.text.primary, fontWeight: '900', fontSize: 16 },
});

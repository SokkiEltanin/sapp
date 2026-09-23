import { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Hourglass, Flame } from 'lucide-react-native';
import { router } from 'expo-router';
import { Counter } from '@/store/countersStore';
import StreakCard from '@/components/counters/StreakCard';
import { streakTier } from '@/components/counters/StreakFlame';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';
import { haptic } from '@/utils/haptics';

// Wyciągnięte 1:1 z `app/(tabs)/index.tsx` `nodes['counters-since']` (2026-08-26, kolejny
// mały krok rozbicia dashboardu — patrz NEXT_STEPS.md/ARCHITECTURE.md §4 dla wzorca i
// historii). Guard `.length > 0 &&` ZOSTAJE w `index.tsx` (edytor dashboardu czyta
// `nodes[id]`'s truthiness). Style `card`/`cardHeader`/`cardTitle`/`workToggleText`
// skopiowane verbatim (współdzielone z innymi sekcjami).
//
// Kwadratowa siatka kafelków (2026-09-23, user: "nie w kafelku tylko jakąś ciekawsza ze
// sama liczba gruba... w barwie im więcej dni jak w streaku") zastąpiona pionową listą
// wierszy — ta sama kolorystyka eskalacji co StreakFlame/streakTier, ale liczba dni jest
// teraz duża/gruba i wiersz nie jest ściśnięty w kwadrat.
export interface SinceCounterEntry { cn: Counter; days: number }

export interface SinceCountersCardProps {
  since: SinceCounterEntry[];
  cardBg: string;
  accentColor: string;
}

function SinceCountersCard({ since, cardBg, accentColor }: SinceCountersCardProps) {
  const c = useColors();
  const s = makeS(c);
  if (since.length === 0) return null;
  const top = since[0];
  const topName = top.cn.mode === 'auto' ? `bez ${top.cn.name}` : top.cn.name;
  return (
    <View style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.cardHeader}>
        <Hourglass size={13} color={accentColor} />
        <Text style={s.cardTitle}>Liczniki</Text>
        <TouchableOpacity onPress={() => { haptic.tap(); router.navigate('/counters' as any); }} style={{ marginLeft: 'auto' }} activeOpacity={0.7}>
          <Text style={[s.workToggleText, { color: accentColor }]}>Wszystkie</Text>
        </TouchableOpacity>
      </View>
      {/* The longest streak gets the rich card (flame + Mon–Sun strip); the rest stay in
          the compact flame grid below it. */}
      <StreakCard name={topName} days={top.days} />
      {since.length > 1 && (
        <View style={{ gap: spacing[2], marginTop: spacing[3] }}>
          {since.slice(1, 7).map(({ cn, days }) => {
            const tc = streakTier(days).color;
            const label = cn.mode === 'auto' ? `bez ${cn.name}` : cn.name;
            return (
              <TouchableOpacity key={cn.id} style={[s.sinceRow, { backgroundColor: tc + '14', borderColor: tc + '30' }]}
                onPress={() => { haptic.tap(); router.push(`/counters/${cn.id}` as any); }} activeOpacity={0.75}>
                <View style={[s.sinceChip, { backgroundColor: tc + '22', borderColor: tc + '55' }]}>
                  <Flame size={16} color={tc} fill={days >= 1 ? tc : 'transparent'} />
                </View>
                <Text style={s.sinceName} numberOfLines={1}>{label}</Text>
                <Text style={[s.sinceNum, { color: tc }]}>{days}</Text>
                <Text style={s.sinceUnit}>{days === 1 ? 'dzień' : 'dni'}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  card: {
    backgroundColor: c.bg.card,
    borderRadius: radius.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: c.border.card,
    gap: spacing[3],
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
  cardTitle: { fontFamily: fonts.label, fontSize: 11, color: c.text.secondary, textTransform: 'uppercase', letterSpacing: 0.9, flexShrink: 1 },
  workToggleText: { fontSize: 10, fontWeight: '700' },
  sinceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], borderRadius: radius.md, borderWidth: 1, paddingVertical: spacing[2], paddingHorizontal: spacing[2] },
  sinceChip: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  sinceName: { flex: 1, fontSize: 12.5, fontWeight: '600', color: c.text.secondary },
  sinceNum: { fontFamily: fonts.display, fontSize: 22, letterSpacing: -0.5 },
  sinceUnit: { fontSize: 11, fontWeight: '700', color: c.text.muted },
}));

export default memo(SinceCountersCard);

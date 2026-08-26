import { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Hourglass } from 'lucide-react-native';
import { router } from 'expo-router';
import { Counter } from '@/store/countersStore';
import StreakCard from '@/components/counters/StreakCard';
import StreakFlame, { streakTier } from '@/components/counters/StreakFlame';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';
import { haptic } from '@/utils/haptics';

// Wyciągnięte 1:1 z `app/(tabs)/index.tsx` `nodes['counters-since']` (2026-08-26, kolejny
// mały krok rozbicia dashboardu — patrz NEXT_STEPS.md/ARCHITECTURE.md §4 dla wzorca i
// historii). Guard `.length > 0 &&` ZOSTAJE w `index.tsx` (edytor dashboardu czyta
// `nodes[id]`'s truthiness). Style `card`/`cardHeader`/`cardTitle`/`workToggleText`
// skopiowane verbatim (współdzielone z innymi sekcjami); `sinceGrid`/`sinceTile`/
// `sinceTileUnit`/`sinceTileName` były używane TYLKO tutaj — przeniesione w całości.
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
        <View style={[s.sinceGrid, { marginTop: spacing[3] }]}>
          {since.slice(1, 7).map(({ cn, days }) => {
            const tc = streakTier(days).color;
            return (
              <View key={cn.id} style={[s.sinceTile, { backgroundColor: tc + '1A', borderWidth: 1, borderColor: tc + '3A' }]}>
                <StreakFlame days={days} size={46} />
                <Text style={s.sinceTileUnit}>{days === 1 ? 'dzień' : 'dni'}</Text>
                <Text style={s.sinceTileName} numberOfLines={1}>{cn.mode === 'auto' ? `bez ${cn.name}` : cn.name}</Text>
              </View>
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
  sinceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] },
  sinceTile: { width: '31.5%', flexGrow: 1, backgroundColor: c.fill.subtle, borderRadius: radius.md, paddingVertical: spacing[3], paddingHorizontal: spacing[2], alignItems: 'center' },
  sinceTileUnit: { fontSize: 10, fontWeight: '700', color: c.text.muted, marginTop: -2 },
  sinceTileName: { fontSize: 11, fontWeight: '600', color: c.text.secondary, marginTop: 3, textAlign: 'center', maxWidth: '100%' },
}));

export default memo(SinceCountersCard);

import { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Hourglass } from 'lucide-react-native';
import { router } from 'expo-router';
import { Counter } from '@/store/countersStore';
import StreakCard from '@/components/counters/StreakCard';
import { streakTier } from '@/components/counters/StreakFlame';
import RadialGlow from '@/components/ui/RadialGlow';
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
// Runda 2 (2026-09-24, user: "tak samo kiedy ostatnio coś było, też słabo wygląda, stary
// chujowy look... przerób na highend" — zamockowałem, user zaakceptował z jedną poprawką:
// poświata pod całym kafelkiem, nie tylko pod liczbą). Ikonka-chip zdjęta, `RadialGlow`
// (reużyty z battle-layout-lab.tsx, ten sam SVG radial-gradient trick) daje delikatną,
// tierowo kolorowaną poświatę rozlaną z lewej strony całego wiersza — liczba dni jest teraz
// hero elementem, nie mały tekst obok ikonki.
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
            const tier = streakTier(days);
            const tc = tier.color;
            const label = cn.mode === 'auto' ? `bez ${cn.name}` : cn.name;
            const metaTxt = tier.next != null ? `${tier.name} · próg za ${tier.next - days} dni` : `${tier.name} · najwyższy próg`;
            return (
              <TouchableOpacity key={cn.id} style={[s.sinceRow, { backgroundColor: tc + '0F', borderColor: tc + '26' }]}
                onPress={() => { haptic.tap(); router.push(`/counters/${cn.id}` as any); }} activeOpacity={0.75}>
                <View style={s.sinceGlowWrap} pointerEvents="none">
                  <RadialGlow size={110} color={tc} opacity={0.18} />
                </View>
                <Text style={[s.sinceNum, { color: tc }]}>{days}</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.sinceName} numberOfLines={1}>{label}</Text>
                  <Text style={s.sinceMeta} numberOfLines={1}>{metaTxt}</Text>
                </View>
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
  sinceRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3], borderRadius: radius.lg, borderWidth: 1,
    paddingVertical: spacing[3], paddingHorizontal: spacing[3], overflow: 'hidden', position: 'relative',
  },
  sinceGlowWrap: { position: 'absolute', left: -26, top: '50%', marginTop: -55 },
  sinceNum: { fontFamily: fonts.display, fontSize: 30, letterSpacing: -1, minWidth: 46 },
  sinceName: { fontSize: 14, fontWeight: '700', color: c.text.primary },
  sinceMeta: { fontSize: 11, fontWeight: '600', color: c.text.muted, marginTop: 1 },
}));

export default memo(SinceCountersCard);

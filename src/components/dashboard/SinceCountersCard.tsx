import { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Hourglass } from 'lucide-react-native';
import { router } from 'expo-router';
import { Counter } from '@/store/countersStore';
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
// Runda 3 (2026-09-25, user zrzutem: "to ma być ile dni temu coś robiłem, a to wygląda i
// pokazuje jak seria jakaś... napraw raz a dobrze") — runda 2 (2026-09-24, "przerób na
// highend") przerobiła TYLKO wiersze `since.slice(1,7)` na duża-liczba+poświata, ale
// zostawiła PIERWSZY (najdłuższy) wpis renderowany przez `<StreakCard>` (flame-chip + pasek
// dni tygodnia/miesiąca) — dokładnie komponent "Ściana serii" z osobnego widgetu. Z JEDNYM
// licznikiem na koncie (typowy przypadek na start) TEN wpis to ZAWSZE "najdłuższy", więc user
// nigdy nie widział nowego designu, tylko starą, dosłowną "serię" — to dokładnie to, czego
// user NIE chciał (ręczny licznik "ile dni temu X" nie jest habitem do "utrzymania passy").
// Fix: WSZYSTKIE wpisy (włącznie z pierwszym) renderują się TERAZ jednolicie przez ten sam
// wiersz duża-liczba+poświata — żadnego specjalnego "hero" traktowania dla najdłuższego,
// `StreakCard` (import usunięty stąd) zostaje wyłącznie w §widget "Ściana serii"
// (`nodes['streak-wall']`/`StreakWallCard`), gdzie faktyczne auto-streaki należą.
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
  return (
    <View style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.cardHeader}>
        <Hourglass size={13} color={accentColor} />
        <Text style={s.cardTitle}>Liczniki</Text>
        <TouchableOpacity onPress={() => { haptic.tap(); router.navigate('/counters' as any); }} style={{ marginLeft: 'auto' }} activeOpacity={0.7}>
          <Text style={[s.workToggleText, { color: accentColor }]}>Wszystkie</Text>
        </TouchableOpacity>
      </View>
      <View style={{ gap: spacing[2] }}>
        {since.slice(0, 7).map(({ cn, days }) => {
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

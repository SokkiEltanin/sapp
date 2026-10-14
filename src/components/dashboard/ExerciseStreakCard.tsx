import { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Dumbbell } from 'lucide-react-native';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';
import { StreakFlameGlow, streakColor } from '@/components/counters/StreakFlame';
import { shade } from '@/utils/catPalettes';
import DisplayText from '@/components/ui/DisplayText';
import { haptic } from '@/utils/haptics';

// Kafelek "Ćwiczenia" na dashboardzie (2026-10-14, patrz ARCHITECTURE.md §313) — user:
// "damy kafelek na dashbordzie przypięty w streaku nowy serial cwiczen". Ten sam wizualny
// przepis co pojedynczy kafelek w `StreakWallCard.tsx` (gradient koloru progu →
// `StreakFlameGlow` w rogu → duża liczba), tylko PEŁNA szerokość sekcji (nie kwadrat w
// siatce) i osobna sekcja dashboardu, nie wpis wewnątrz "Twoje serie" — user chciał WŁASNY,
// widoczny kafelek nawigujący wprost do `/exercises`, nie kolejny kwadracik wmieszany między
// nawyki/liczniki.
function ExerciseStreakCard({ streak, cardBg }: { streak: number; cardBg: string }) {
  const c = useColors();
  const s = makeS(c);
  const color = streakColor(streak);
  const isZero = streak < 1;

  const content = (
    <>
      <View style={s.flameWrap} pointerEvents="none">
        <StreakFlameGlow days={streak} size={72} />
      </View>
      <View style={s.head}>
        <Dumbbell size={13} color={isZero ? c.text.secondary : 'rgba(255,255,255,0.85)'} />
        <Text style={[s.title, { color: isZero ? c.text.secondary : 'rgba(255,255,255,0.85)' }]}>ĆWICZENIA</Text>
      </View>
      <DisplayText style={[s.num, { color: isZero ? c.text.muted : '#FFFFFF' }]}>{streak}</DisplayText>
      <Text style={[s.label, { color: isZero ? c.text.muted : 'rgba(255,255,255,0.88)' }]}>
        {streak === 1 ? 'dzień z rzędu' : 'dni z rzędu'}
      </Text>
    </>
  );

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={() => { haptic.tap(); router.push('/exercises' as any); }}>
      {isZero ? (
        <View style={[s.card, { backgroundColor: cardBg, borderWidth: 1, borderColor: c.border.card }]}>{content}</View>
      ) : (
        <LinearGradient colors={[color, shade(color, -0.16)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.card}>
          {content}
        </LinearGradient>
      )}
    </TouchableOpacity>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  card: { borderRadius: radius.xl, padding: spacing[4], overflow: 'hidden', position: 'relative', minHeight: 96 },
  flameWrap: { position: 'absolute', right: -14, bottom: -14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontFamily: fonts.label, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  num: { fontSize: 32, letterSpacing: -0.5, lineHeight: 34, marginTop: spacing[1] },
  label: { fontFamily: fonts.label, fontSize: 10, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase', marginTop: 1 },
}));

export default memo(ExerciseStreakCard);

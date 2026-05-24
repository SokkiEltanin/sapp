import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Animated } from 'react-native';
import { BarChart2 } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';
import { useTabSwipe } from '@/hooks/useTabSwipe';

export default function AnalyticsScreen() {
  const { panHandlers, animatedStyle } = useTabSwipe();
  return (
    <SafeAreaView style={s.root} edges={['top']} {...panHandlers}>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Statystyki</Text>
        </View>
        <View style={s.center}>
          <View style={s.iconWrap}>
            <BarChart2 size={32} color={colors.tabs.analytics} strokeWidth={1.5} />
          </View>
          <Text style={s.title}>W budowie</Text>
          <Text style={s.sub}>Tu pojawią się wykresy i analizy ze wszystkich zakładek — nastrój, finanse, zadania, nawyki</Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg.primary },
  header: {
    paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[2],
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.5 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4], padding: spacing[6] },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.tabs.analytics + '15',
    borderWidth: 1, borderColor: colors.tabs.analytics + '30',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text.primary },
  sub:   { ...typography.body, color: colors.text.muted, textAlign: 'center', lineHeight: 22 },
});

import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart2 } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';

export default function AnalyticsScreen() {
  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.center}>
        <BarChart2 size={40} color={colors.text.muted} strokeWidth={1.5} />
        <Text style={s.title}>Statystyki</Text>
        <Text style={s.sub}>Wkrótce — tu pojawią się wykresy ze wszystkich zakładek</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3], padding: spacing[6] },
  title:  { ...typography.h2, color: colors.text.primary },
  sub:    { ...typography.body, color: colors.text.muted, textAlign: 'center' },
});

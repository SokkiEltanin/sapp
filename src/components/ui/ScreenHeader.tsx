import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, typography, spacing } from '@/theme';

interface Props {
  title: string;
  subtitle?: string;
  accentColor?: string;
  rightSlot?: React.ReactNode;
  style?: ViewStyle;
}

export default function ScreenHeader({ title, subtitle, rightSlot, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.left}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {rightSlot && <View>{rightSlot}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  left: { flex: 1, gap: 2 },
  title: { ...typography.h2, color: colors.text.primary, fontWeight: '700' },
  subtitle: { ...typography.caption, color: colors.text.muted, marginTop: 1 },
});

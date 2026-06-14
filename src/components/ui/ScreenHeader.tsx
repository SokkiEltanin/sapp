import { View, Text, ViewStyle } from 'react-native';
import { typography, spacing } from '@/theme';
import { useColors } from '@/theme/useColors';

interface Props {
  title: string;
  subtitle?: string;
  accentColor?: string;
  rightSlot?: React.ReactNode;
  style?: ViewStyle;
}

export default function ScreenHeader({ title, subtitle, rightSlot, style }: Props) {
  const c = useColors();
  return (
    <View style={[{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[3],
      borderBottomWidth: 1, borderBottomColor: c.border.subtle,
    }, style]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typography.h2, { color: c.text.primary, fontWeight: '700' }]}>{title}</Text>
        {subtitle && <Text style={[typography.caption, { color: c.text.muted, marginTop: 1 }]}>{subtitle}</Text>}
      </View>
      {rightSlot && <View>{rightSlot}</View>}
    </View>
  );
}

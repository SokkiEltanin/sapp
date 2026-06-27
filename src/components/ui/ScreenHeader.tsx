import { View, Text, ViewStyle } from 'react-native';
import { spacing } from '@/theme';
import { useColors } from '@/theme/useColors';

interface Props {
  title: string;
  subtitle?: string;
  accentColor?: string;
  rightSlot?: React.ReactNode;
  style?: ViewStyle;
}

// Minimal screen header. The big tab-name title is gone (the nav bar already
// tells you where you are) — only the contextual subtitle (month / date /
// "dzisiaj") shows as a small label, plus any actions. Theme-adaptive.
export default function ScreenHeader({ title, subtitle, rightSlot, style }: Props) {
  const c = useColors();
  const label = subtitle || title;
  return (
    <View style={[{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing[4], paddingTop: spacing[3], paddingBottom: spacing[3],
      minHeight: 48,
    }, style]}>
      {!!label && (
        <Text
          style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.8, color: c.text.muted, textTransform: 'uppercase', flex: 1 }}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
      {rightSlot && <View>{rightSlot}</View>}
    </View>
  );
}

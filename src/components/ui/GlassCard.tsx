import { View, ViewStyle } from 'react-native';
import { radius } from '@/theme';
import { useColors } from '@/theme/useColors';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  accentColor?: string;
  padding?: number;
  intensity?: number; // kept for API compat, unused
}

// Theme-reactive surface (was a fixed white-translucent frost — invisible on a
// light background). Now a solid palette surface + hairline, so it works in both
// dark and light.
export default function GlassCard({ children, style, accentColor, padding }: Props) {
  const c = useColors();
  return (
    <View style={[{
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.border.card,
      backgroundColor: c.bg.card,
      overflow: 'hidden',
    }, style]}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: c.border.glass }} />
      {accentColor && <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, backgroundColor: accentColor }} />}
      <View style={padding !== undefined ? { padding } : undefined}>{children}</View>
    </View>
  );
}

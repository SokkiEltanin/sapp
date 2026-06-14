import { View, ViewStyle, StyleProp } from 'react-native';
import { ReactNode } from 'react';
import { useColors } from '@/theme/useColors';
import { spacing, radius } from '@/theme';

// Theme-reactive surface. Flips with light/dark because it reads useColors().
// `elevated` uses the higher surface tone; `padded` toggles the standard inset.
export default function Card({
  children, style, padded = true, elevated = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  elevated?: boolean;
}) {
  const c = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: elevated ? c.bg.elevated : c.bg.card,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: c.border.card,
          padding: padded ? spacing[4] : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

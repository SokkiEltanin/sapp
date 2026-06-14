import { View, Text } from 'react-native';
import { ReactNode } from 'react';
import { useColors } from '@/theme/useColors';
import { spacing, radius, typography } from '@/theme';

// Compact metric tile: icon + big value + unit + label. Theme-reactive.
export default function StatTile({
  icon, value, unit, label, accent,
}: {
  icon?: ReactNode;
  value: string | number;
  unit?: string;
  label: string;
  accent?: string;
}) {
  const c = useColors();
  return (
    <View style={{
      flex: 1, gap: 4, padding: spacing[3], borderRadius: radius.lg,
      backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.card,
    }}>
      {icon}
      <Text style={{ ...typography.h2, color: accent ?? c.text.primary }}>
        {value}
        {unit ? <Text style={{ fontSize: 12, fontWeight: '600', color: c.text.muted }}> {unit}</Text> : null}
      </Text>
      <Text style={{ fontSize: 11, color: c.text.muted }}>{label}</Text>
    </View>
  );
}

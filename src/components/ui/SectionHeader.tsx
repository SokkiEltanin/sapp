import { View, Text } from 'react-native';
import { ReactNode } from 'react';
import { useColors } from '@/theme/useColors';
import { typography, spacing } from '@/theme';

// Uppercase eyebrow + optional right slot — gives the dashboard clear "chapters".
export default function SectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[2], paddingHorizontal: 2 }}>
      <Text style={[typography.eyebrow, { color: c.text.muted }]}>{title}</Text>
      {right}
    </View>
  );
}

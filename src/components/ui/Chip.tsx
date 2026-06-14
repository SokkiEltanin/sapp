import { useRef } from 'react';
import { Pressable, Text, View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { radius, typography, spacing } from '@/theme';
import { useColors } from '@/theme/useColors';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  style?: ViewStyle;
  count?: number; // usage frequency badge (shows when >= 2)
}

export default function Chip({ label, selected = false, onPress, color, style, count }: Props) {
  const c = useColors();
  const accent = color ?? c.text.primary;
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <AnimatedPressable
      onPressIn={() => Animated.timing(scale, { toValue: 0.93, duration: 70, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 20, stiffness: 300 } as any).start()}
      onPress={onPress}
      style={[
        { transform: [{ scale }] },
        styles.chip,
        selected
          ? { backgroundColor: accent + '33', borderColor: accent }
          : { backgroundColor: c.bg.card, borderColor: c.border.default },
        style,
      ]}
    >
      <Text style={[styles.label, { color: selected ? accent : c.text.secondary }]}>{label}</Text>
      {count != null && count >= 2 && (
        <View style={[styles.badge, { backgroundColor: c.border.glass }, selected && { backgroundColor: accent + '44' }]}>
          <Text style={[styles.badgeText, { color: selected ? accent : c.text.muted }]}>{count}</Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1],
    borderRadius: radius.full, borderWidth: 1, alignSelf: 'flex-start',
  },
  label: { ...typography.label, fontSize: 12 },
  badge: { borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1 },
  badgeText: { fontSize: 9, fontWeight: '700' },
});

import { useRef } from 'react';
import { Pressable, Text, View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { colors, radius, typography, spacing } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  style?: ViewStyle;
  count?: number; // usage frequency badge (shows when >= 2)
}

export default function Chip({ label, selected = false, onPress, color = colors.text.primary, style, count }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <AnimatedPressable
      onPressIn={() => Animated.timing(scale, { toValue: 0.93, duration: 70, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 20, stiffness: 300 } as any).start()}
      onPress={onPress}
      style={[
        { transform: [{ scale }] },
        styles.chip,
        selected ? { backgroundColor: color + '33', borderColor: color } : styles.unselected,
        style,
      ]}
    >
      <Text style={[styles.label, selected ? { color } : styles.unselectedLabel]}>{label}</Text>
      {count != null && count >= 2 && (
        <View style={[styles.badge, selected && { backgroundColor: color + '44' }]}>
          <Text style={[styles.badgeText, selected && { color }]}>{count}</Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  unselected: {
    backgroundColor: colors.bg.card,
    borderColor: colors.border.default,
  },
  label: {
    ...typography.label,
    fontSize: 12,
  },
  unselectedLabel: {
    color: colors.text.secondary,
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.text.muted,
  },
});

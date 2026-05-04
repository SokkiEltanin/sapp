import { useRef } from 'react';
import { Pressable, Text, StyleSheet, Animated, ViewStyle } from 'react-native';
import { colors, radius, typography, spacing } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  style?: ViewStyle;
}

export default function Chip({ label, selected = false, onPress, color = colors.text.primary, style }: Props) {
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
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
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
});

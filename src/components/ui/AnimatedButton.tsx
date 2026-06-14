import { useRef } from 'react';
import { Pressable, StyleSheet, View, Text, Animated } from 'react-native';
import { radius, typography, spacing } from '@/theme';
import { useColors } from '@/theme/useColors';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  onPress: () => void;
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  disabled?: boolean;
  style?: object;
  fullWidth?: boolean;
}

const SIZES = {
  sm: { paddingVertical: spacing[2],  paddingHorizontal: spacing[3],  fontSize: 13 },
  md: { paddingVertical: spacing[3],  paddingHorizontal: spacing[5],  fontSize: 15 },
  lg: { paddingVertical: spacing[4],  paddingHorizontal: spacing[6],  fontSize: 15 },
};

export default function AnimatedButton({
  onPress, label, variant = 'primary', size = 'md',
  icon, disabled = false, style, fullWidth = false,
}: Props) {
  const c = useColors();
  const scale   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const CONFIG = {
    primary:   { bg: c.text.primary,    text: c.bg.primary,     border: 'transparent' },
    secondary: { bg: c.bg.card,         text: c.text.primary,   border: c.border.default },
    ghost:     { bg: 'transparent',     text: c.text.secondary, border: c.border.glass },
    danger:    { bg: c.accent.danger,   text: '#FFFFFF',        border: 'transparent' },
  };
  const cfg = CONFIG[variant];
  const s   = SIZES[size];

  return (
    <AnimatedPressable
      onPressIn={() => {
        Animated.parallel([
          Animated.timing(scale,   { toValue: 0.96, duration: 70, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.88, duration: 70, useNativeDriver: true }),
        ]).start();
      }}
      onPressOut={() => {
        Animated.parallel([
          Animated.spring(scale,   { toValue: 1, useNativeDriver: true, damping: 20, stiffness: 300 } as any),
          Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        ]).start();
      }}
      onPress={onPress}
      disabled={disabled}
      style={[{ transform: [{ scale }], opacity }, fullWidth && { width: '100%' }, style]}
    >
      <View style={[
        styles.inner,
        { paddingVertical: s.paddingVertical, paddingHorizontal: s.paddingHorizontal },
        { backgroundColor: cfg.bg, borderColor: cfg.border, borderWidth: 1 },
        disabled && styles.disabled,
        fullWidth && { justifyContent: 'center' },
      ]}>
        {icon && <>{icon}</>}
        <Text style={[styles.label, { fontSize: s.fontSize, color: cfg.text }]}>
          {label}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  inner: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing[2], borderRadius: radius.md,
  },
  label: { ...typography.label, fontWeight: '600' },
  disabled: { opacity: 0.4 },
});

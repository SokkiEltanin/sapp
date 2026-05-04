import { useRef } from 'react';
import { Pressable, Animated, StyleProp, ViewStyle } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  onPress?: () => void;
  onLongPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  disabled?: boolean;
}

export default function PressableScale({ onPress, onLongPress, children, style, scaleTo = 0.96, disabled = false }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <AnimatedPressable
      onPressIn={() => { if (!disabled) Animated.timing(scale, { toValue: scaleTo, duration: 80, useNativeDriver: true }).start(); }}
      onPressOut={() => { if (!disabled) Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 20, stiffness: 300 } as any).start(); }}
      onPress={disabled ? undefined : onPress}
      onLongPress={disabled ? undefined : onLongPress}
      style={[{ transform: [{ scale }] }, disabled && { opacity: 0.4 }, style]}
    >
      {children}
    </AnimatedPressable>
  );
}

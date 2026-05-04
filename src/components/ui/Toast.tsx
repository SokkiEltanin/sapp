import { useEffect, useRef } from 'react';
import { Text, StyleSheet, View, Animated } from 'react-native';
import { Check, X, Info } from 'lucide-react-native';
import { useToastStore, ToastType } from '@/store/toastStore';
import { colors, spacing, radius, typography } from '@/theme';

const ICON: Record<ToastType, { icon: any; color: string }> = {
  success: { icon: Check, color: colors.accent.success },
  error:   { icon: X,    color: colors.accent.danger  },
  info:    { icon: Info, color: colors.text.secondary },
};

export default function Toast() {
  const { message, type, hide } = useToastStore();
  const translateY = useRef(new Animated.Value(80)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (message) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.delay(2000),
          Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      ]).start();
      const t = setTimeout(hide, 2600);
      return () => clearTimeout(t);
    } else {
      translateY.setValue(80);
      opacity.setValue(0);
    }
  }, [message]);

  if (!message) return null;

  const { icon: Icon, color } = ICON[type];

  return (
    <Animated.View
      style={[styles.wrap, { transform: [{ translateY }], opacity }]}
      pointerEvents="none"
    >
      <View style={styles.card}>
        <View style={[styles.iconWrap, { backgroundColor: color + '18' }]}>
          <Icon size={14} color={color} strokeWidth={2.5} />
        </View>
        <Text style={styles.text} numberOfLines={2}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 100,
    left: spacing[4],
    right: spacing[4],
    alignItems: 'center',
    zIndex: 9999,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: 'rgba(28,28,28,0.96)',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    maxWidth: 340,
  },
  iconWrap: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  text: { ...typography.body, color: colors.text.primary, fontSize: 14, flex: 1 },
});

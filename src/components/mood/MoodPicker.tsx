import { useRef, useMemo, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { MoodLevel, MOOD_LABELS, MOOD_COLORS, ENERGY_LABELS, ENERGY_COLORS } from '@/types';
import { colors, spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';

const MOOD_EMOJIS: Record<MoodLevel, string> = {
  1: '😩',
  2: '😕',
  3: '😐',
  4: '😊',
  5: '🤩',
};

const ENERGY_EMOJIS: Record<MoodLevel, string> = {
  1: '😴',
  2: '😌',
  3: '⚡',
  4: '✨',
  5: '🚀',
};


interface Props {
  value?: MoodLevel;
  onChange: (val: MoodLevel) => void;
  label?: string;
  mode?: 'mood' | 'energy';
}

function MoodOption({ level, selected, onSelect, color, emoji }: {
  level: MoodLevel; selected: boolean; onSelect: () => void; color: string; emoji: string;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.88, duration: 70, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 280 } as any),
    ]).start();
    haptic.medium();
    onSelect();
  };

  return (
    <Animated.View style={[styles.optionWrap, { transform: [{ scale }] }]}>
      <Pressable onPress={handlePress} style={{ flex: 1 }}>
        <View style={[
          styles.pill,
          selected ? { backgroundColor: color, borderColor: color } : styles.pillIdle,
        ]}>
          <Text style={styles.emoji}>{emoji}</Text>
          {selected && (
            <View style={[styles.selDot, { backgroundColor: '#FFFFFF' }]} />
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function MoodPicker({ value, onChange, label = 'Jak się czujesz?', mode = 'mood' }: Props) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const moodColors = mode === 'energy' ? ENERGY_COLORS : MOOD_COLORS;
  const moodLabels = mode === 'energy' ? ENERGY_LABELS : MOOD_LABELS;
  const moodEmojis = mode === 'energy' ? ENERGY_EMOJIS : MOOD_EMOJIS;

  // Fade + lift the selected label in place (no layout jump, no sudden pop).
  const labelAnim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(labelAnim, {
      toValue: value ? 1 : 0, duration: 220, useNativeDriver: true,
    }).start();
  }, [value]);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.row}>
        {([1, 2, 3, 4, 5] as MoodLevel[]).map((level) => (
          <MoodOption
            key={level}
            level={level}
            emoji={moodEmojis[level]}
            color={moodColors[level]}
            selected={value === level}
            onSelect={() => onChange(level)}
          />
        ))}
      </View>
      {/* Always rendered with reserved height so picking a mood doesn't shove the
          layout — the label just fades + lifts in place. */}
      <Animated.Text
        numberOfLines={1}
        style={[
          styles.selectedLabel,
          {
            color: value ? moodColors[value] : 'transparent',
            opacity: labelAnim,
            transform: [{ translateY: labelAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
          },
        ]}
      >
        {value ? moodLabels[value] : '·'}
      </Animated.Text>
    </View>
  );
}

const makeStyles = themedStyles((c: typeof colors) => StyleSheet.create({
  container: { gap: spacing[2] },
  sectionLabel: {
    ...typography.label, color: c.text.muted,
    textTransform: 'uppercase', letterSpacing: 1, fontSize: 10,
  },
  row: { flexDirection: 'row', gap: spacing[2] },
  optionWrap: { flex: 1, borderRadius: radius.md },
  pill: {
    height: 54, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
    gap: 3,
  },
  pillIdle: {
    backgroundColor: c.fill.subtle,
    borderColor: c.border.default,
  },
  emoji: { fontSize: 24 },
  selDot: { width: 5, height: 5, borderRadius: 3 },
  selectedLabel: { ...typography.label, fontWeight: '600', textAlign: 'center', fontSize: 13 },
}));

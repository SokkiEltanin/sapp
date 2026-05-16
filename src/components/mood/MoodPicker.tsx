import { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { MoodLevel, MOOD_LABELS, MOOD_COLORS, ENERGY_LABELS } from '@/types';
import { colors, spacing, radius, typography } from '@/theme';
import { haptic } from '@/utils/haptics';

const ENERGY_COLORS: Record<MoodLevel, string> = {
  1: '#6B7280',
  2: '#55B4FF',
  3: '#43D98F',
  4: '#FFBE55',
  5: '#FF6584',
};

interface Props {
  value?: MoodLevel;
  onChange: (val: MoodLevel) => void;
  label?: string;
  mode?: 'mood' | 'energy';
}

function MoodOption({ level, selected, onSelect, color }: {
  level: MoodLevel; selected: boolean; onSelect: () => void; color: string; label: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.94, duration: 60, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 20, stiffness: 280 } as any),
    ]).start();
    haptic.medium();
    onSelect();
  };

  return (
    <Animated.View style={[styles.optionWrap, { transform: [{ scale }] }]}>
      <Pressable onPress={handlePress} style={{ flex: 1 }}>
        {selected ? (
          <View style={[styles.pill, { backgroundColor: color }]}>
            <Text style={styles.pillTextSelected}>{level}</Text>
          </View>
        ) : (
          <View style={[styles.pill, styles.pillIdle]}>
            <Text style={styles.pillText}>{level}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function MoodPicker({ value, onChange, label = 'Jak się czujesz?', mode = 'mood' }: Props) {
  const moodColors = mode === 'energy' ? ENERGY_COLORS : MOOD_COLORS;
  const moodLabels = mode === 'energy' ? ENERGY_LABELS : MOOD_LABELS;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.row}>
        {([1, 2, 3, 4, 5] as MoodLevel[]).map((level) => (
          <MoodOption
            key={level}
            level={level}
            label={moodLabels[level]}
            color={moodColors[level]}
            selected={value === level}
            onSelect={() => onChange(level)}
          />
        ))}
      </View>
      {value && (
        <Text style={[styles.selectedLabel, { color: moodColors[value] }]}>
          {moodLabels[value]}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing[2] },
  sectionLabel: {
    ...typography.label, color: colors.text.muted,
    textTransform: 'uppercase', letterSpacing: 1, fontSize: 10,
  },
  row: { flexDirection: 'row', gap: spacing[2] },
  optionWrap: { flex: 1, borderRadius: radius.md },
  pill: {
    height: 48, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  pillIdle: {
    backgroundColor: colors.bg.elevated,
    borderWidth: 1, borderColor: colors.border.default,
  },
  pillText:         { ...typography.h4, color: colors.text.muted, fontWeight: '700' },
  pillTextSelected: { ...typography.h4, color: colors.white, fontWeight: '800' },
  selectedLabel:    { ...typography.label, fontWeight: '600', textAlign: 'center', fontSize: 12 },
});

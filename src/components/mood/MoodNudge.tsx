import { View, Text, StyleSheet } from 'react-native';
import { ChevronRight, Zap, X } from 'lucide-react-native';
import { useState } from 'react';
import PressableScale from '@/components/ui/PressableScale';
import { MoodEntry, MOOD_COLORS, MOOD_LABELS } from '@/types';
import { colors, spacing, radius, typography } from '@/theme';
import { haptic } from '@/utils/haptics';

interface Props {
  todayEntry?: MoodEntry | null;
  onOpen: () => void;
}

export default function MoodNudge({ todayEntry, onOpen }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  if (todayEntry) {
    const mc = MOOD_COLORS[todayEntry.mood];
    return (
      <View style={styles.wrapper}>
        <PressableScale onPress={() => { haptic.tap(); onOpen(); }}>
          <View style={styles.doneRow}>
            <View style={[styles.dot, { backgroundColor: mc }]} />
            <Text style={styles.doneLabel}>{MOOD_LABELS[todayEntry.mood]}</Text>
            {todayEntry.energy != null && (
              <View style={styles.energyBit}>
                <Zap size={9} color={colors.text.muted} />
                <Text style={styles.energyText}>{todayEntry.energy}/5</Text>
              </View>
            )}
            <ChevronRight size={12} color={colors.text.muted} style={{ marginLeft: 'auto' }} />
          </View>
        </PressableScale>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.nudgeRow}>
        <PressableScale onPress={() => { haptic.tap(); onOpen(); }} style={{ flex: 1 }}>
          <View style={styles.nudgeInner}>
            <Text style={styles.nudgeText}>Jak się dziś czujesz?</Text>
            <Text style={styles.nudgeSub}>Zaloguj nastrój — 10 sekund</Text>
          </View>
        </PressableScale>
        <PressableScale onPress={() => { haptic.tap(); setDismissed(true); }} style={styles.dismissBtn}>
          <X size={12} color={colors.text.muted} />
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[3],
  },
  doneRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[3], paddingVertical: 10,
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  doneLabel: { ...typography.label, color: colors.text.secondary, fontWeight: '600' },
  energyBit: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: spacing[1] },
  energyText: { ...typography.caption, color: colors.text.muted, fontSize: 10 },

  nudgeRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  nudgeInner: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
  },
  nudgeText: { ...typography.label, color: colors.text.secondary, fontWeight: '600' },
  nudgeSub: { ...typography.caption, color: colors.text.muted, marginTop: 2 },
  dismissBtn: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
    alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center',
  },
});

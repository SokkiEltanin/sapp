import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import { MoodLevel, MOOD_COLORS, MOOD_LABELS } from '@/types';
import { colors, spacing, radius, typography } from '@/theme';

interface Props {
  visible: boolean;
  taskTitle: string;
  onSelect: (mood: MoodLevel) => void;
  onDismiss: () => void;
}

const OPTIONS: MoodLevel[] = [1, 2, 3, 4, 5];

export default function CompletionMoodModal({ visible, taskTitle, onSelect, onDismiss }: Props) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onDismiss, 8000);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <View style={styles.sheet}>
          <View style={styles.iconWrap}>
            <CheckCircle2 size={28} color={colors.accent.green} />
          </View>

          <Text style={styles.headline}>Zadanie ukończone!</Text>
          <Text style={styles.taskName} numberOfLines={2}>{taskTitle}</Text>
          <Text style={styles.question}>Jak się czujesz po ukończeniu?</Text>

          <View style={styles.optionsRow}>
            {OPTIONS.map((level) => {
              const col = MOOD_COLORS[level];
              return (
                <TouchableOpacity
                  key={level}
                  style={[styles.optBtn, { borderColor: col + '50', backgroundColor: col + '15' }]}
                  onPress={() => onSelect(level)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.optNum, { color: col }]}>{level}</Text>
                  <Text style={styles.optLabel}>{MOOD_LABELS[level].slice(0, 6)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity onPress={onDismiss} style={styles.skipBtn}>
            <Text style={styles.skipText}>Pomiń</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: colors.bg.elevated,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border.default,
    padding: spacing[6],
    gap: spacing[3],
    alignItems: 'center',
    paddingBottom: spacing[8],
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.accent.green + '18',
    borderWidth: 1, borderColor: colors.accent.green + '35',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[1],
  },
  headline: { fontSize: 20, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.3 },
  taskName: {
    fontSize: 14, color: colors.text.secondary, textAlign: 'center',
    lineHeight: 20, paddingHorizontal: spacing[4],
  },
  question: { fontSize: 13, color: colors.text.muted, marginTop: spacing[1] },
  optionsRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] },
  optBtn: {
    flex: 1, alignItems: 'center', gap: 4,
    paddingVertical: spacing[3],
    borderRadius: radius.lg, borderWidth: 1,
  },
  optNum: { fontSize: 20, fontWeight: '800' },
  optLabel: { fontSize: 9, color: colors.text.muted, textAlign: 'center' },
  skipBtn: { paddingVertical: spacing[2], paddingHorizontal: spacing[4] },
  skipText: { fontSize: 13, color: colors.text.muted },
});

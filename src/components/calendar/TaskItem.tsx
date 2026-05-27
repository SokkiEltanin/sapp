import { View, Text, StyleSheet } from 'react-native';
import { Check, Clock, Flame } from 'lucide-react-native';
import PressableScale from '@/components/ui/PressableScale';
import { Task } from '@/types';
import { colors, spacing, radius, typography } from '@/theme';
import { haptic } from '@/utils/haptics';

function fmtDeadline(iso: string): string {
  const [, m, day] = iso.split('T')[0].split('-');
  return `${parseInt(day)}.${parseInt(m)}`;
}

interface Props {
  task: Task;
  index: number;
  onToggle: (id: string) => void;
  onPress?: (id: string) => void;
}

export default function TaskItem({ task, index, onToggle, onPress }: Props) {
  const done = task.status === 'done';
  const high = task.priority === 'high';

  return (
    <View style={styles.wrap}>
      <View style={[styles.row, done && styles.rowDone]}>
        <View style={[styles.bar, { backgroundColor: high && !done ? colors.accent.danger : 'rgba(255,255,255,0.06)' }]} />
        <PressableScale
          onPress={() => { done ? haptic.tap() : haptic.success(); onToggle(task.id); }}
          style={[styles.checkbox, done && styles.checkboxDone]}
        >
          {done && <Check size={11} color={colors.white} strokeWidth={3} />}
        </PressableScale>
        <PressableScale style={styles.info} onPress={onPress ? () => { haptic.tap(); onPress(task.id); } : undefined}>
          <Text style={[styles.title, done && styles.titleDone]} numberOfLines={1}>
            {task.title}
          </Text>
          {task.deadline && (
            <View style={styles.meta}>
              <Clock size={10} color={colors.text.muted} />
              <Text style={styles.metaText}>{fmtDeadline(task.deadline)}</Text>
              {high && !done && (
                <View style={styles.urgentBadge}>
                  <Flame size={8} color={colors.accent.danger} />
                  <Text style={styles.urgentText}>pilne</Text>
                </View>
              )}
            </View>
          )}
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing[2] },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderRadius: radius.md, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden', minHeight: 52,
  },
  rowDone: { opacity: 0.4 },
  bar: { width: 2, alignSelf: 'stretch' },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: spacing[3],
  },
  checkboxDone: { backgroundColor: colors.accent.success, borderColor: colors.accent.success },
  info: { flex: 1, gap: 3, paddingVertical: spacing[3], paddingRight: spacing[3] },
  title: { ...typography.bodySmall, color: colors.text.primary, fontWeight: '500' },
  titleDone: { textDecorationLine: 'line-through', color: colors.text.muted },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  metaText: { ...typography.caption, color: colors.text.muted },
  urgentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.accent.danger + '20',
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4,
  },
  urgentText: { ...typography.caption, color: colors.accent.danger, fontWeight: '700', fontSize: 9 },
});

import { View, Text, StyleSheet } from 'react-native';
import { TrendingUp, TrendingDown } from 'lucide-react-native';
import PressableScale from '@/components/ui/PressableScale';
import { Expense } from '@/types';
import { getCategoryMeta } from '@/utils/categories';
import { colors, spacing, radius, typography } from '@/theme';

function timeStr(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch { return ''; }
}

interface Props {
  expense: Expense;
  index: number;
  onPress?: (expense: Expense) => void;
  onLongPress?: (expense: Expense) => void;
}

export default function ExpenseItem({ expense, onPress, onLongPress }: Props) {
  const isIncome = expense.type === 'income';
  const meta = getCategoryMeta(expense.category);
  const amountColor = isIncome ? colors.accent.success : colors.text.primary;

  return (
    <PressableScale
      onPress={() => onPress?.(expense)}
      onLongPress={() => onLongPress?.(expense)}
      style={styles.row}
    >
      <View style={[styles.bar, { backgroundColor: isIncome ? colors.accent.success : 'rgba(255,255,255,0.07)' }]} />

      <View style={styles.iconWrap}>
        {isIncome
          ? <TrendingUp size={16} color={colors.accent.success} />
          : <TrendingDown size={16} color={colors.text.muted} />
        }
      </View>

      <View style={styles.info}>
        <Text style={styles.note} numberOfLines={1}>
          {expense.note || meta.label}
        </Text>
        <Text style={styles.meta}>
          {timeStr(expense.date)}
          {expense.tags.length > 0 && ` · ${expense.tags.slice(0, 2).join(', ')}`}
          {!isIncome && ` · ${meta.label}`}
        </Text>
      </View>

      <Text style={[styles.amount, { color: amountColor }]}>
        {isIncome ? '+' : '-'}{expense.amount.toFixed(2)} zł
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingRight: spacing[4], paddingVertical: spacing[3],
    backgroundColor: colors.bg.card,
    borderRadius: radius.md, marginBottom: spacing[2],
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  bar: { width: 2, alignSelf: 'stretch' },
  iconWrap: {
    width: 32, height: 32, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  info: { flex: 1, gap: 2 },
  note: { ...typography.bodySmall, color: colors.text.primary, fontWeight: '500' },
  meta: { ...typography.caption, color: colors.text.muted },
  amount: { ...typography.label, fontWeight: '700', fontSize: 14 },
});

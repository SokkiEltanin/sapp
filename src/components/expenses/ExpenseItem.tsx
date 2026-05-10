import { View, Text, StyleSheet } from 'react-native';
import { TrendingUp, TrendingDown, ShoppingCart } from 'lucide-react-native';
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
  const isIncome  = expense.type === 'income';
  const isReceipt = !isIncome && (expense.receiptItems?.length ?? 0) > 0;
  const meta      = getCategoryMeta(expense.category);
  const accentColor = isIncome ? colors.accent.green : isReceipt ? colors.accent.blue : 'rgba(255,255,255,0.07)';

  const title = expense.storeName || expense.note || meta.label;
  const subtitle = isReceipt
    ? `${expense.receiptItems!.length} produktów · ${timeStr(expense.date)}`
    : `${timeStr(expense.date)}${expense.tags.length > 0 ? ` · ${expense.tags.slice(0, 2).join(', ')}` : ''}${!isIncome ? ` · ${meta.label}` : ''}`;

  return (
    <PressableScale
      onPress={() => onPress?.(expense)}
      onLongPress={() => onLongPress?.(expense)}
      style={[styles.row, isReceipt && styles.rowReceipt]}
    >
      <View style={[styles.bar, { backgroundColor: accentColor }]} />

      <View style={[styles.iconWrap, isReceipt && { backgroundColor: colors.accent.blue + '15' }]}>
        {isIncome
          ? <TrendingUp size={16} color={colors.accent.green} />
          : isReceipt
            ? <ShoppingCart size={16} color={colors.accent.blue} />
            : <TrendingDown size={16} color={colors.text.muted} />
        }
      </View>

      <View style={styles.info}>
        <Text style={styles.note} numberOfLines={1}>{title}</Text>
        <Text style={styles.meta}>{subtitle}</Text>
        {isReceipt && expense.receiptItems!.length > 0 && (
          <View style={styles.itemPreview}>
            {expense.receiptItems!.slice(0, 3).map((it, i) => (
              <Text key={i} style={styles.itemChip} numberOfLines={1}>{it.name}</Text>
            ))}
            {expense.receiptItems!.length > 3 && (
              <Text style={styles.itemMore}>+{expense.receiptItems!.length - 3}</Text>
            )}
          </View>
        )}
      </View>

      <Text style={[styles.amount, { color: isIncome ? colors.accent.green : colors.text.primary }]}>
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
    borderWidth: 1, borderColor: colors.border.default,
    overflow: 'hidden',
  },
  rowReceipt: {
    borderColor: colors.accent.blue + '20',
    paddingVertical: spacing[3],
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
  itemPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  itemChip: {
    fontSize: 10, color: colors.text.secondary,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, overflow: 'hidden',
  },
  itemMore: { fontSize: 10, color: colors.text.muted, alignSelf: 'center' },
  amount: { ...typography.label, fontWeight: '700', fontSize: 14 },
});

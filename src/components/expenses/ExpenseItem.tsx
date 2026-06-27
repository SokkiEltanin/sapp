import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useColors } from '@/theme/useColors';
import { TrendingUp, TrendingDown, ShoppingCart, ChevronDown, ChevronUp } from 'lucide-react-native';
import PressableScale from '@/components/ui/PressableScale';
import { Expense } from '@/types';
import { getCategoryMeta } from '@/utils/categories';
import { estimateItemKcal } from '@/utils/calories';
import { colors, spacing, radius, typography } from '@/theme';
import { haptic } from '@/utils/haptics';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

interface Props {
  expense: Expense;
  index: number;
  onPress?: (expense: Expense) => void;
  onLongPress?: (expense: Expense) => void;
}

export default function ExpenseItem({ expense, onPress, onLongPress }: Props) {
  const [expanded, setExpanded] = useState(false);
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const isIncome  = expense.type === 'income';
  const isReceipt = !isIncome && (expense.receiptItems?.length ?? 0) > 0;
  const meta      = getCategoryMeta(expense.category);
  const accentColor = isIncome ? colors.accent.green : isReceipt ? colors.accent.blue : colors.border.default;

  const title = expense.storeName || expense.note || meta.label;
  // No time in the list — every entry defaults to noon, so "12:00" was just noise.
  // Subtitle = the meaningful parts (products / tags / category / cash).
  const subParts: string[] = [];
  if (isReceipt) subParts.push(`${expense.receiptItems!.length} produktów`);
  if (!isIncome) {
    if (expense.tags.length > 0) subParts.push(expense.tags.slice(0, 2).join(', '));
    if (!isReceipt) subParts.push(meta.label);
  }
  if (expense.paymentMethod === 'cash') subParts.push('gotówka');
  const subtitle = subParts.join('  ·  ');

  const toggle = () => {
    haptic.tap();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(v => !v);
  };

  return (
    <View style={[styles.wrap, isReceipt && styles.wrapReceipt]}>
      {/* Main row */}
      <PressableScale
        onPress={() => { haptic.tap(); onPress?.(expense); }}
        onLongPress={() => { haptic.medium(); onLongPress?.(expense); }}
        style={styles.row}
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
          {!!subtitle && <Text style={styles.meta} numberOfLines={1}>{subtitle}</Text>}
        </View>

        <Text style={[styles.amount, { color: isIncome ? colors.accent.green : colors.text.primary }]}>
          {isIncome ? '+' : '-'}{expense.amount.toFixed(2)} zł
        </Text>

        {/* Expand toggle for receipts. Non-receipts render an equal-width spacer so
            every amount lines up at the same right edge (no indented prices). */}
        {isReceipt ? (
          <TouchableOpacity
            onPress={toggle}
            hitSlop={12}
            style={styles.chevronBtn}
            activeOpacity={0.6}
          >
            {expanded
              ? <ChevronUp size={15} color={colors.accent.blue} />
              : <ChevronDown size={15} color={colors.text.muted} />
            }
          </TouchableOpacity>
        ) : (
          <View style={styles.chevronBtn} />
        )}
      </PressableScale>

      {/* Expanded receipt items */}
      {isReceipt && expanded && (
        <View style={styles.itemList}>
          {expense.receiptItems!.map((it, i) => {
            const itMeta = getCategoryMeta(it.category);
            const kcal = estimateItemKcal(it);
            return (
              <View key={i} style={[styles.itemRow, i === 0 && styles.itemRowFirst]}>
                <View style={[styles.itemDot, { backgroundColor: itMeta.color + '30', borderColor: itMeta.color + '50' }]} />
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
                  {it.tags?.length > 0 && (
                    <View style={styles.itemTagsRow}>
                      {it.tags.slice(0, 3).map(tag => (
                        <View key={tag} style={styles.itemTag}>
                          <Text style={styles.itemTagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                <View style={styles.itemAmtCol}>
                  {it.quantity !== 1 && (
                    <Text style={styles.itemQty}>{it.quantity}×</Text>
                  )}
                  <Text style={styles.itemPrice}>{it.price.toFixed(2)} zł</Text>
                  {kcal > 0 && <Text style={styles.itemKcal}>~{kcal} kcal</Text>}
                </View>
              </View>
            );
          })}
          <TouchableOpacity
            style={styles.detailBtn}
            onPress={() => { haptic.tap(); onPress?.(expense); }}
            activeOpacity={0.75}
          >
            <Text style={styles.detailBtnText}>Edytuj / szczegóły →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
  wrap: {
    backgroundColor: c.bg.card,
    borderRadius: radius.md, marginBottom: spacing[2],
    borderWidth: 1, borderColor: c.border.default,
    overflow: 'hidden',
  },
  wrapReceipt: {
    borderColor: c.accent.blue + '25',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingRight: spacing[2], paddingVertical: spacing[3],
  },
  bar: { width: 2, alignSelf: 'stretch' },
  iconWrap: {
    width: 32, height: 32, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.border.subtle,
  },
  info: { flex: 1, gap: 2 },
  note: { ...typography.bodySmall, color: c.text.primary, fontWeight: '500' },
  meta: { ...typography.caption, color: c.text.muted },
  amount: { ...typography.label, fontWeight: '700', fontSize: 14 },
  chevronBtn: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
  },

  // Expanded items list
  itemList: {
    borderTopWidth: 1, borderTopColor: c.border.subtle,
    paddingBottom: spacing[1],
  },
  itemRowFirst: {
    borderTopWidth: 0,
  },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    borderTopWidth: 1, borderTopColor: c.border.subtle,
  },
  itemDot: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 12, color: c.text.secondary, fontWeight: '500' },
  itemTagsRow: { flexDirection: 'row', gap: 4, marginTop: 2 },
  itemTag: {
    paddingHorizontal: 5, paddingVertical: 1,
    backgroundColor: c.accent.blue + '15',
    borderRadius: radius.full,
    borderWidth: 1, borderColor: c.accent.blue + '25',
  },
  itemTagText: { fontSize: 8, color: c.accent.blue, fontWeight: '600' },
  itemAmtCol: { alignItems: 'flex-end', gap: 1 },
  itemQty: { fontSize: 9, color: c.text.muted },
  itemPrice: { fontSize: 12, fontWeight: '700', color: c.text.primary },
  itemKcal: { fontSize: 9, color: c.text.muted, marginTop: 1 },

  detailBtn: {
    marginHorizontal: spacing[4], marginTop: spacing[1], marginBottom: spacing[3],
    paddingVertical: spacing[2],
    backgroundColor: c.accent.blue + '12',
    borderRadius: radius.md,
    borderWidth: 1, borderColor: c.accent.blue + '30',
    alignItems: 'center',
  },
  detailBtnText: { fontSize: 11, fontWeight: '600', color: c.accent.blue },
});

import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { ChevronDown, ChevronUp, Wallet, Pencil } from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';
import PressableScale from '@/components/ui/PressableScale';
import { Expense } from '@/types';
import { getCategoryMeta } from '@/utils/categories';
import { billTagFor } from '@/utils/recurringBills';
import { estimateItemKcal } from '@/utils/calories';
import { isMine } from '@/store/statsScope';
import { isSelfTransfer } from '@/utils/statWidgets';
import { bucketOf, FvBucket } from '@/utils/fixedVariable';
import { colors, spacing, radius, typography } from '@/theme';
import { haptic } from '@/utils/haptics';

// Warm amber marks a transaction someone ELSE paid (payer ≠ "Ja"): it shows in the
// list but does NOT count toward your spend/balance, so it needs an at-a-glance tell.
const PAYER_ACCENT = '#E0A33A';

// Stałe/Zmienne/Jedzenie na KAŻDYM wydatku (2026-09-12, user: "ulepsz oznaczanie żebym
// mógł jano widzieć na wydatkach co jest jedzeniem co jest nie jedzeniem co stałym
// wydatkiem a co zmiennym zeby widzieć czy dobrze łapie") — dotąd `bucketOf()` (patrz
// fixedVariable.ts) był widoczny TYLKO w rozbiciu miesięcznym widgetu "Na co idą
// pieniądze" na dashboardzie, więc audyt "czy dobrze łapie" wymagał otwierania osobnego
// modala miesiąc po miesiącu zamiast po prostu przewinięcia listy transakcji. Te same
// kolory co pasek widgetu (FixedVariableSection.tsx: `fixedC`/`foodC`) dla spójności —
// `variable` dostaje fiolet (nowy, żaden inny akcent w liście go dziś nie używa).
const BUCKET_META: Record<FvBucket, { label: string; color: string }> = {
  fixed:    { label: 'Stałe',    color: '#8893A8' },
  variable: { label: 'Zmienne',  color: '#BF80FF' },
  food:     { label: 'Jedzenie', color: '#4CA96B' },
};

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

interface Props {
  expense: Expense;
  index: number;
  onPress?: (expense: Expense) => void;
  onLongPress?: (expense: Expense) => void;
  onReclassify?: (expenseId: string, bucket: FvBucket | null) => void;
}

export default function ExpenseItem({ expense, onPress, onLongPress, onReclassify }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [bucketEditOpen, setBucketEditOpen] = useState(false);
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const isIncome  = expense.type === 'income';
  const isReceipt = !isIncome && (expense.receiptItems?.length ?? 0) > 0;
  const meta      = getCategoryMeta(expense.category);
  // Rozpoznany rachunek cykliczny (prąd/internet/czynsz…) dostaje WŁASNĄ ikonę zamiast
  // ikony swojej kategorii (prawie zawsze 'housing' → dom dla wszystkich) — 2026-09-08,
  // user: "czytelniejsze ikony ze to jest za internet ze tamto jest wyplata". Kolor całego
  // wiersza (pasek/tło ikony/glif/kwota) to teraz PROSTA reguła wydatek=czerwony,
  // przychód=zielony (`colors.accent.red/green`, ten sam konwencja co karta "TEN MIESIĄC"
  // wyżej w Finansach i dashboard) — wcześniej wydatek nie miał ŻADNEGO koloru (neutralny
  // szary/biały), tylko przychód był zielony, więc para nie czytała się symetrycznie.
  const bill = !isIncome ? billTagFor(expense) : null;
  const iconName = bill?.icon ?? meta.icon;
  const IconComp: any = (LucideIcons as any)[iconName];
  const rowColor = isIncome ? colors.accent.green : colors.accent.red;
  const accentColor = rowColor;
  // Paid by someone else (partner) → excluded from YOUR totals. Flag it visually.
  const mine = isMine(expense);
  // Widoczny na KAŻDYM wydatku (patrz komentarz przy BUCKET_META) — audyt "czy dobrze
  // łapie" bez otwierania osobnego widgetu. `null` dla przychodów (bucketOf() nie ma dla
  // nich sensu — zawsze wpadłyby w 'variable' przez fallback) i dla self-transferów
  // (oszczędności/Revolut) — te są wykluczone ze WSZYSTKICH kubłów w fixedVariable.ts,
  // więc pokazanie im "Zmienne" wyglądałoby jak dokładnie ten błąd klasyfikacji, który
  // ten badge ma pomóc wyłapać.
  const bucket: FvBucket | null = (isIncome || isSelfTransfer(expense)) ? null : bucketOf(expense);

  const title = expense.storeName || expense.note || meta.label;
  // No time in the list — every entry defaults to noon, so "12:00" was just noise.
  // Subtitle = the meaningful parts (products / tags / category / cash).
  const subParts: string[] = [];
  if (isReceipt) subParts.push(`${expense.receiptItems!.length} produktów`);
  if (!isIncome) {
    if ((expense.tags?.length ?? 0) > 0) subParts.push(expense.tags!.slice(0, 2).join(', '));
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
    <View style={[styles.wrap, isReceipt && styles.wrapReceipt, !mine && styles.wrapNotMine]}>
      {/* Main row */}
      <PressableScale
        onPress={() => { haptic.tap(); onPress?.(expense); }}
        onLongPress={() => { haptic.medium(); onLongPress?.(expense); }}
        style={styles.row}
      >
        <View style={[styles.bar, { backgroundColor: accentColor }]} />

        <View style={[styles.iconWrap, { backgroundColor: isIncome ? colors.tint.green : colors.tint.red }]}>
          {IconComp && <IconComp size={16} color={rowColor} />}
        </View>

        <View style={styles.info}>
          <Text style={styles.note} numberOfLines={1}>{title}</Text>
          {!!subtitle && <Text style={styles.meta} numberOfLines={1}>{subtitle}</Text>}
          {!!bucket && (
            <TouchableOpacity
              onPress={() => { haptic.tap(); setBucketEditOpen(v => !v); }}
              hitSlop={6}
              style={styles.bucketBadge}
              activeOpacity={0.7}
            >
              <View style={[styles.bucketDot, { backgroundColor: BUCKET_META[bucket].color }]} />
              <Text style={[styles.bucketText, { color: BUCKET_META[bucket].color }]}>{BUCKET_META[bucket].label}</Text>
              {!!expense.fvOverride && <Pencil size={9} color={colors.text.muted} />}
            </TouchableOpacity>
          )}
          {!!bucket && bucketEditOpen && (
            <View style={styles.bucketEditRow}>
              {(['fixed', 'variable', 'food'] as FvBucket[]).filter(b => b !== bucket).map(b => (
                <TouchableOpacity
                  key={b}
                  onPress={() => { haptic.medium(); onReclassify?.(expense.id, b); setBucketEditOpen(false); }}
                  style={styles.bucketEditChip}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.bucketEditChipText, { color: BUCKET_META[b].color }]}>{BUCKET_META[b].label}</Text>
                </TouchableOpacity>
              ))}
              {!!expense.fvOverride && (
                <TouchableOpacity
                  onPress={() => { haptic.medium(); onReclassify?.(expense.id, null); setBucketEditOpen(false); }}
                  style={styles.bucketEditChipAuto}
                  activeOpacity={0.8}
                >
                  <Text style={styles.bucketEditChipAutoText}>Auto</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          {!mine && !!expense.payer && (
            <View style={styles.payerBadge}>
              <Wallet size={10} color={PAYER_ACCENT} />
              <Text style={styles.payerBadgeText} numberOfLines={1}>Płaci: {expense.payer}</Text>
            </View>
          )}
        </View>

        <View style={styles.amountCol}>
          <Text style={[
            styles.amount,
            { color: rowColor },
            !mine && styles.amountNotMine,
          ]}>
            {isIncome ? '+' : '-'}{expense.amount.toFixed(2)} zł
          </Text>
          {!mine && <Text style={styles.notMineTag}>nie wlicza się</Text>}
        </View>

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

const makeStyles = themedStyles((c: any) => StyleSheet.create({
  wrap: {
    backgroundColor: c.bg.card,
    borderRadius: radius.md, marginBottom: spacing[2],
    borderWidth: 1, borderColor: c.border.default,
    overflow: 'hidden',
  },
  wrapReceipt: {
    borderColor: c.accent.blue + '25',
  },
  // Paid by someone else — warm border so the whole row reads "not counted toward me".
  wrapNotMine: {
    borderColor: PAYER_ACCENT + '55',
    backgroundColor: PAYER_ACCENT + '0C',
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
  bucketBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4,
    marginTop: 1,
  },
  bucketDot: { width: 6, height: 6, borderRadius: 3 },
  bucketText: { fontSize: 10, fontWeight: '700' },
  bucketEditRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6,
    marginTop: 3, paddingTop: 4, borderTopWidth: 1, borderTopColor: c.border.subtle,
  },
  bucketEditChip: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full,
    backgroundColor: c.fill.subtle,
  },
  bucketEditChipText: { fontSize: 10, fontWeight: '700' },
  bucketEditChipAuto: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full,
    borderWidth: 1, borderColor: c.border.default,
  },
  bucketEditChipAutoText: { fontSize: 10, fontWeight: '600', color: c.text.muted },
  amount: { ...typography.label, fontWeight: '700', fontSize: 14 },
  amountCol: { alignItems: 'flex-end', justifyContent: 'center' },
  // Struck-through + muted = "this amount is NOT in your total" at a glance.
  amountNotMine: { color: c.text.muted, textDecorationLine: 'line-through' },
  notMineTag: {
    fontSize: 8, fontWeight: '800', color: PAYER_ACCENT,
    letterSpacing: 0.3, textTransform: 'uppercase', marginTop: 1,
  },
  payerBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 3,
    marginTop: 3, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: radius.full, borderWidth: 1,
    borderColor: PAYER_ACCENT + '55', backgroundColor: PAYER_ACCENT + '18',
  },
  payerBadgeText: { fontSize: 9, fontWeight: '700', color: PAYER_ACCENT, maxWidth: 150 },
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
}));

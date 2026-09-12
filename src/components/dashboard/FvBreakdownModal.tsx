import { memo, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { X, Pencil, RotateCcw } from 'lucide-react-native';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius } from '@/theme';
import { haptic } from '@/utils/haptics';
import { FvBucket, FvTransaction } from '@/utils/fixedVariable';

const BUCKET_LABEL: Record<FvBucket, string> = { fixed: 'Stałe', variable: 'Zmienne', food: 'Jedzenie' };

// Rozbicie jednego kubła (Stałe/Zmienne/Jedzenie) widgetu "Na co idą pieniądze" — pokazuje
// DOKŁADNIE co i kiedy się w danym miesiącu do niego liczy (2026-09-12, user: "wykresy
// stałych, zmiennych, jedzenie każdy osobno klikalny z pokazaniem co sie kiedy tam wlicza
// zebym mógł kliknąć ze np cos sie zle liczy... zeby sie uczyło"). Tap na transakcję
// rozwija chipy pozostałych dwóch kubłów — wybór zapisuje `fvOverride` na TEJ JEDNEJ
// transakcji NA STAŁE (przez `onReclassify`, patrz index.tsx), więc to nie jest podpowiedź
// tylko trwała korekta: raz poprawiona transakcja już zawsze liczy się tam gdzie user chce,
// niezależnie co zrobi z nią heurystyka kategorii/tagów później.
export interface FvBreakdownModalProps {
  visible: boolean;
  bucket: FvBucket | null;
  color: string;
  monthLabel: string;
  transactions: FvTransaction[];
  onReclassify: (id: string, bucket: FvBucket | null) => void;
  onClose: () => void;
}

function FvBreakdownModal({ visible, bucket, color, monthLabel, transactions, onReclassify, onClose }: FvBreakdownModalProps) {
  const c = useColors();
  const s = makeS(c);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!bucket) return null;
  const total = transactions.reduce((a, t) => a + t.amount, 0);
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={s.head}>
            <View style={[s.dot, { backgroundColor: color }]} />
            <Text style={s.title}>{BUCKET_LABEL[bucket]}</Text>
            <Text style={s.sub}>· {monthLabel}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} style={{ marginLeft: 'auto' }}>
              <X size={18} color={c.text.muted} />
            </TouchableOpacity>
          </View>
          <Text style={s.total}>
            {total.toLocaleString('pl-PL')} zł · {transactions.length} {transactions.length === 1 ? 'transakcja' : transactions.length < 5 ? 'transakcje' : 'transakcji'}
          </Text>
          <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
            {transactions.length === 0 && <Text style={s.empty}>Brak transakcji w tym miesiącu.</Text>}
            {transactions.map(t => (
              <View key={t.id}>
                <TouchableOpacity style={s.row} onPress={() => { haptic.tap(); setEditingId(editingId === t.id ? null : t.id); }} activeOpacity={0.7}>
                  <Text style={s.rowDate}>{fmtDate(t.date)}</Text>
                  <Text style={s.rowLbl} numberOfLines={1}>{t.label}</Text>
                  {t.overridden && <Pencil size={11} color={c.text.muted} />}
                  <Text style={s.rowAmt}>{t.amount.toLocaleString('pl-PL')} zł</Text>
                </TouchableOpacity>
                {editingId === t.id && (
                  <View style={s.editRow}>
                    <Text style={s.editLbl}>To jest:</Text>
                    {(['fixed', 'variable', 'food'] as FvBucket[]).filter(b => b !== bucket).map(b => (
                      <TouchableOpacity key={b} onPress={() => { haptic.medium(); onReclassify(t.id, b); setEditingId(null); }} style={s.editChip} activeOpacity={0.8}>
                        <Text style={s.editChipTxt}>{BUCKET_LABEL[b]}</Text>
                      </TouchableOpacity>
                    ))}
                    {t.overridden && (
                      <TouchableOpacity onPress={() => { haptic.medium(); onReclassify(t.id, null); setEditingId(null); }} style={s.editChipAuto} activeOpacity={0.8}>
                        <RotateCcw size={11} color={c.text.muted} />
                        <Text style={s.editChipAutoTxt}>Auto</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
          <Text style={s.hint}>Kliknij transakcję, żeby przenieść ją do innej kategorii — zmiana zostaje zapamiętana.</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default memo(FvBreakdownModal);

const makeS = themedStyles((c: any) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing[4] },
  sheet: { backgroundColor: c.bg.primary, borderRadius: radius.xl, padding: spacing[4], maxHeight: '80%' },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { fontSize: 16, fontWeight: '800', color: c.text.primary },
  sub: { fontSize: 12, color: c.text.muted },
  total: { fontSize: 13, color: c.text.secondary, marginBottom: spacing[3] },
  scroll: { maxHeight: 360 },
  empty: { fontSize: 13, color: c.text.muted, textAlign: 'center', paddingVertical: spacing[4] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: c.border.subtle },
  rowDate: { fontSize: 11, color: c.text.muted, width: 34 },
  rowLbl: { flex: 1, fontSize: 13.5, color: c.text.primary, fontWeight: '600' },
  rowAmt: { fontSize: 13.5, fontWeight: '700', color: c.text.primary },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 8, paddingLeft: 34 },
  editLbl: { fontSize: 11, color: c.text.muted },
  editChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.md, backgroundColor: c.fill.subtle },
  editChipTxt: { fontSize: 11.5, fontWeight: '700', color: c.text.primary },
  editChipAuto: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  editChipAutoTxt: { fontSize: 11, color: c.text.muted, fontWeight: '600' },
  hint: { fontSize: 10.5, color: c.text.muted, marginTop: spacing[3], textAlign: 'center' },
}));

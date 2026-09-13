import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Pencil } from 'lucide-react-native';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { radius } from '@/theme';
import { haptic } from '@/utils/haptics';
import { FvBucket } from '@/utils/fixedVariable';

// Stałe/Zmienne/Jedzenie — PRZENIESIONE z listy wydatków (ExpenseItem.tsx) na ekran
// szczegółów (2026-09-13, user: "te stale/zmienne tagi w finansach na głównej możesz dać
// dopiero po kliknieciu w szczegóły bo dziwnie zaburza mi to bez sensu tam kafelki") —
// wydzielone do osobnego komponentu żeby nie duplikować JSX/style w dwóch miejscach, choć
// dziś ma tylko jednego konsumenta (`app/expenses/[id].tsx`).
export const BUCKET_META: Record<FvBucket, { label: string; color: string }> = {
  fixed:    { label: 'Stałe',    color: '#8893A8' },
  variable: { label: 'Zmienne',  color: '#BF80FF' },
  food:     { label: 'Jedzenie', color: '#4CA96B' },
};

export default function FvBadge({ bucket, mixedBuckets, isMixed, overridden, onReclassify }: {
  bucket: FvBucket;
  mixedBuckets: FvBucket[];
  isMixed: boolean;
  overridden: boolean;
  onReclassify: (bucket: FvBucket | null) => void;
}) {
  const c = useColors();
  const s = makeS(c);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <View>
      <TouchableOpacity
        onPress={() => { haptic.tap(); setEditOpen(v => !v); }}
        style={s.badge}
        activeOpacity={0.7}
      >
        {isMixed ? mixedBuckets.map((b, i) => (
          <View key={b} style={s.badgePart}>
            {i > 0 && <Text style={s.plus}>+</Text>}
            <View style={[s.dot, { backgroundColor: BUCKET_META[b].color }]} />
            <Text style={[s.text, { color: BUCKET_META[b].color }]}>{BUCKET_META[b].label}</Text>
          </View>
        )) : (
          <>
            <View style={[s.dot, { backgroundColor: BUCKET_META[bucket].color }]} />
            <Text style={[s.text, { color: BUCKET_META[bucket].color }]}>{BUCKET_META[bucket].label}</Text>
          </>
        )}
        {overridden && <Pencil size={10} color={c.text.muted} />}
      </TouchableOpacity>
      {editOpen && (
        <View style={s.editRow}>
          {(['fixed', 'variable', 'food'] as FvBucket[]).filter(b => b !== bucket).map(b => (
            <TouchableOpacity
              key={b}
              onPress={() => { haptic.medium(); onReclassify(b); setEditOpen(false); }}
              style={s.editChip}
              activeOpacity={0.8}
            >
              <Text style={[s.editChipText, { color: BUCKET_META[b].color }]}>{BUCKET_META[b].label}</Text>
            </TouchableOpacity>
          ))}
          {overridden && (
            <TouchableOpacity
              onPress={() => { haptic.medium(); onReclassify(null); setEditOpen(false); }}
              style={s.editChipAuto}
              activeOpacity={0.8}
            >
              <Text style={s.editChipAutoText}>Auto</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5 },
  badgePart: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  plus: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.5)', marginRight: 5 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  text: { fontSize: 12.5, fontWeight: '700' },
  editRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  editChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.1)' },
  editChipText: { fontSize: 11.5, fontWeight: '700' },
  editChipAuto: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  editChipAutoText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
}));

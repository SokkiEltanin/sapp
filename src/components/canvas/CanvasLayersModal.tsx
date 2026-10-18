import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { X, Layers, ArrowUp, ArrowDown } from 'lucide-react-native';
import { useColors } from '@/theme/useColors';
import { spacing, radius } from '@/theme';
import { haptic } from '@/utils/haptics';

export interface LayerRow {
  id: string;
  label: string;
  grouped: boolean;
}

// Lista warstw z krokowym reorderem (Faza 33, 2026-10-17, §365) — pośredni krok między "na
// wierzch"/"na spód" (§359, jedno-krokowy skok na szczyt/spód) a pełnym drag-and-drop (§359
// "Świadomie NIE zrobione" — osobny, większy fix, jeśli user zgłosi potrzebę). Lista pokazuje
// PEŁNY porządek warstw na raz (czego "na wierzch"/"na spód" nie dawało), ↑/↓ zamienia z
// NAJBLIŻSZYM sąsiadem — bez nowego systemu gestów przeciągania (ten sam, już udokumentowany
// powód co `moveLayer` w `canvasComponentsStore.ts`: realne ryzyko regresji za minimalną
// korzyść).
//
// `rows` PRZYCHODZI już posortowane TOP-FIRST (warstwa na wierzchu jako pierwsza na liście —
// tak user intuicyjnie myśli o "co jest na wierzchu"), `ArrowUp` na pierwszym wierszu i
// `ArrowDown` na ostatnim są disabled.
export default function CanvasLayersModal({ visible, rows, onMoveUp, onMoveDown, onClose }: {
  visible: boolean;
  rows: LayerRow[];
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onClose: () => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <View style={s.head}>
            <Layers size={16} color={c.accent.blue} />
            <Text style={s.title}>Warstwy</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><X size={18} color={c.text.muted} /></TouchableOpacity>
          </View>
          <Text style={s.hint}>Góra listy = na wierzchu. Zamień kolejność strzałkami.</Text>
          <ScrollView contentContainerStyle={{ gap: spacing[2] }}>
            {rows.map((r, i) => (
              <View key={r.id} style={[s.row, { borderColor: r.grouped ? c.accent.purple : c.border.default }]}>
                <Text style={s.rowLabel} numberOfLines={1}>{r.label}</Text>
                <TouchableOpacity onPress={() => { haptic.tap(); onMoveUp(r.id); }} disabled={i === 0} style={s.arrowBtn} hitSlop={8}>
                  <ArrowUp size={14} color={i === 0 ? c.text.muted : c.text.secondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { haptic.tap(); onMoveDown(r.id); }} disabled={i === rows.length - 1} style={s.arrowBtn} hitSlop={8}>
                  <ArrowDown size={14} color={i === rows.length - 1 ? c.text.muted : c.text.secondary} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeS = (c: any) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[5], paddingVertical: spacing[6] },
  card: {
    width: '100%', maxWidth: 420, maxHeight: '80%', backgroundColor: c.bg.secondary,
    borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default, padding: spacing[4], gap: spacing[2],
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { flex: 1, fontSize: 15, fontWeight: '800', color: c.text.primary },
  hint: { fontSize: 11, color: c.text.muted },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  rowLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: c.text.primary },
  arrowBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.bg.elevated, alignItems: 'center', justifyContent: 'center' },
});

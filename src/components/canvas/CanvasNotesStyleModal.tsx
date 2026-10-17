import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView, Switch } from 'react-native';
import { X, Palette } from 'lucide-react-native';
import { NotesTileStyle } from '@/components/dashboard/NotesTile';
import { useColors } from '@/theme/useColors';
import { spacing, radius } from '@/theme';
import { haptic } from '@/utils/haptics';
import Stepper from '@/components/ui/Stepper';

// Edycja stylu PER-INSTANCJA notatki na płótnie (Faza 21, 2026-10-17, §350) — tak samo prosty
// jak `CanvasCountdownStyleModal` (§344): `NotesTileStyle` ma tylko 3 pola, zero presetów
// layoutu — kafel notatki ma JEDEN kształt (ikona+tytuł+podgląd treści+tagi w rzędzie).
export default function CanvasNotesStyleModal({ visible, style, onChange, onClose }: {
  visible: boolean;
  style: NotesTileStyle;
  onChange: (patch: Partial<NotesTileStyle>) => void;
  onClose: () => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <View style={s.head}>
            <Palette size={16} color={c.accent.blue} />
            <Text style={s.title}>Styl notatki</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><X size={18} color={c.text.muted} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ gap: spacing[2] }}>
            <View style={s.innerCard}>
              <Stepper label="Zaokrąglenie rogów" value={style.cornerRadius} min={0} max={32} step={2}
                onChange={v => onChange({ cornerRadius: v })} />
              <View style={s.divider} />
              <View style={s.row}>
                <Text style={s.rowLabel}>Podgląd treści</Text>
                <Switch value={style.showBody} onValueChange={v => { haptic.tap(); onChange({ showBody: v }); }}
                  trackColor={{ false: c.border.default, true: c.accent.blue }} />
              </View>
              <View style={s.divider} />
              <View style={s.row}>
                <Text style={s.rowLabel}>Tagi</Text>
                <Switch value={style.showTags} onValueChange={v => { haptic.tap(); onChange({ showTags: v }); }}
                  trackColor={{ false: c.border.default, true: c.accent.blue }} />
              </View>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeS = (c: any) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[5], paddingVertical: spacing[6] },
  card: {
    width: '100%', maxWidth: 420, maxHeight: '88%', backgroundColor: c.bg.secondary,
    borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default, padding: spacing[4], gap: spacing[2],
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { flex: 1, fontSize: 15, fontWeight: '800', color: c.text.primary },
  innerCard: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.card, padding: spacing[3] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing[2] },
  rowLabel: { fontSize: 13, fontWeight: '600', color: c.text.primary, flex: 1 },
  divider: { height: 1, backgroundColor: c.border.subtle },
});

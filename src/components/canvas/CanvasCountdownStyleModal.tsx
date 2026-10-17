import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { X, Palette } from 'lucide-react-native';
import { CountdownTileStyle } from '@/components/dashboard/CountdownTile';
import { useColors } from '@/theme/useColors';
import { spacing, radius } from '@/theme';
import Stepper from '@/components/ui/Stepper';

// Edycja stylu PER-INSTANCJA odliczania na płótnie (Faza 17, 2026-10-17) — dużo prostsza niż
// `CanvasStreakStyleModal` (§342), bo `CountdownTileStyle` ma tylko 3 pola, zero presetów
// layoutu/palety progów — kafel odliczania ma JEDEN kształt (pierścień+tekst w rzędzie), nie 4
// alternatywne jak seria.
export default function CanvasCountdownStyleModal({ visible, style, onChange, onClose }: {
  visible: boolean;
  style: CountdownTileStyle;
  onChange: (patch: Partial<CountdownTileStyle>) => void;
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
            <Text style={s.title}>Styl odliczania</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><X size={18} color={c.text.muted} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ gap: spacing[2] }}>
            <View style={s.innerCard}>
              <Stepper label="Zaokrąglenie rogów" value={style.cornerRadius} min={0} max={32} step={2}
                onChange={v => onChange({ cornerRadius: v })} />
              <View style={s.divider} />
              <Stepper label="Rozmiar pierścienia" value={style.ringSize} min={36} max={84} step={4}
                onChange={v => onChange({ ringSize: v })} />
              <View style={s.divider} />
              <Stepper label="Grubość pierścienia" value={style.ringStrokeWidth} min={2} max={12} step={1}
                onChange={v => onChange({ ringStrokeWidth: v })} />
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
  divider: { height: 1, backgroundColor: c.border.subtle },
});

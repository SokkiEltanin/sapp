import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView, Switch } from 'react-native';
import { X, Palette } from 'lucide-react-native';
import { DataFieldTileStyle } from '@/store/dataFieldTileStyleDefaults';
import { SHAPE_COLOR_PRESETS } from '@/store/shapeStyleDefaults';
import { useColors } from '@/theme/useColors';
import { spacing, radius } from '@/theme';
import { haptic } from '@/utils/haptics';
import Stepper from '@/components/ui/Stepper';
import ColorSwatchPicker from '@/components/ui/ColorSwatchPicker';

// Styl instancji "pola danych" (Faza 27, 2026-10-17, §358) — ten sam wzorzec co
// `CanvasNotesStyleModal`/`CanvasShapeStyleModal` (prosty, bez presetów layoutu — jeden kształt
// treści: opcjonalna etykieta + wartość).
export default function CanvasDataFieldStyleModal({ visible, style, onChange, onClose }: {
  visible: boolean;
  style: DataFieldTileStyle;
  onChange: (patch: Partial<DataFieldTileStyle>) => void;
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
            <Text style={s.title}>Styl pola danych</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><X size={18} color={c.text.muted} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ gap: spacing[3] }}>
            <View>
              <Text style={s.sectionLabel}>Kolor wartości</Text>
              <ColorSwatchPicker presets={SHAPE_COLOR_PRESETS} current={style.color} onSelect={(hex) => onChange({ color: hex })} />
            </View>

            <Text style={s.sectionLabel}>Wyrównanie</Text>
            <View style={s.segmented}>
              {([['left', 'Do lewej'], ['center', 'Środek'], ['right', 'Do prawej']] as [DataFieldTileStyle['align'], string][]).map(([m, lbl]) => {
                const on = style.align === m;
                return (
                  <TouchableOpacity key={m} onPress={() => { haptic.tap(); onChange({ align: m }); }}
                    style={[s.segBtn, { flex: 1, alignItems: 'center' }, on && { backgroundColor: c.accent.blue + '22', borderColor: c.accent.blue }]}>
                    <Text style={[s.segTxt, on && { color: c.accent.blue }]}>{lbl}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={s.innerCard}>
              <Stepper label="Rozmiar wartości" value={style.fontSize} min={12} max={40} step={2}
                onChange={v => onChange({ fontSize: v })} />
              <View style={s.divider} />
              <Stepper label="Zaokrąglenie rogów" value={style.cornerRadius} min={0} max={32} step={2}
                onChange={v => onChange({ cornerRadius: v })} />
              <View style={s.divider} />
              <View style={s.row}>
                <Text style={s.rowLabel}>Pogrubienie</Text>
                <Switch value={style.bold} onValueChange={v => { haptic.tap(); onChange({ bold: v }); }}
                  trackColor={{ false: c.border.default, true: c.accent.blue }} />
              </View>
              <View style={s.divider} />
              <View style={s.row}>
                <Text style={s.rowLabel}>Pokaż etykietę pola</Text>
                <Switch value={style.showLabel} onValueChange={v => { haptic.tap(); onChange({ showLabel: v }); }}
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
  sectionLabel: { fontSize: 11, fontWeight: '800', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing[1] },
  innerCard: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.card, padding: spacing[3] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing[2] },
  rowLabel: { fontSize: 13, fontWeight: '600', color: c.text.primary, flex: 1 },
  divider: { height: 1, backgroundColor: c.border.subtle },
  segmented: { flexDirection: 'row', gap: 6 },
  segBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  segTxt: { fontSize: 11, fontWeight: '700', color: c.text.secondary },
});

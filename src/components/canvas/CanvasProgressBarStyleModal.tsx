import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { X, GaugeCircle } from 'lucide-react-native';
import { ProgressBarStyle } from '@/store/progressBarStyleDefaults';
import { SHAPE_COLOR_PRESETS } from '@/store/shapeStyleDefaults';
import { useColors } from '@/theme/useColors';
import { spacing, radius } from '@/theme';
import { haptic } from '@/utils/haptics';
import Stepper from '@/components/ui/Stepper';
import ColorSwatchPicker from '@/components/ui/ColorSwatchPicker';

// Styl paska progresu (Faza §393) — ten sam wzorzec co `CanvasShapeStyleModal.tsx` (kolor
// wypełnienia/tła + zaokrąglenie), plus orientacja. Który LICZNIK pokazać to podpięcie
// (`bindingKey` → `MetricPickerModal`, reużywa `countdownOptions`), nie styl.
export default function CanvasProgressBarStyleModal({ visible, style, onChange, onClose }: {
  visible: boolean;
  style: ProgressBarStyle;
  onChange: (patch: Partial<ProgressBarStyle>) => void;
  onClose: () => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <View style={s.head}>
            <GaugeCircle size={16} color={c.accent.blue} />
            <Text style={s.title}>Styl paska progresu</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><X size={18} color={c.text.muted} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ gap: spacing[3] }}>
            <View>
              <Text style={s.sectionLabel}>Wypełnienie</Text>
              <ColorSwatchPicker presets={SHAPE_COLOR_PRESETS} current={style.fillColor} onSelect={(hex) => onChange({ fillColor: hex })} />
            </View>
            <View>
              <Text style={s.sectionLabel}>Tło (tor)</Text>
              <ColorSwatchPicker presets={SHAPE_COLOR_PRESETS} current={style.trackColor} onSelect={(hex) => onChange({ trackColor: hex })} />
            </View>

            <Text style={s.sectionLabel}>Orientacja</Text>
            <View style={s.segmented}>
              {([['horizontal', 'Pozioma'], ['vertical', 'Pionowa']] as [ProgressBarStyle['orientation'], string][]).map(([m, lbl]) => {
                const on = style.orientation === m;
                return (
                  <TouchableOpacity key={m} onPress={() => { haptic.tap(); onChange({ orientation: m }); }}
                    style={[s.segBtn, { flex: 1, alignItems: 'center' }, on && { backgroundColor: c.accent.blue + '22', borderColor: c.accent.blue }]}>
                    <Text style={[s.segTxt, on && { color: c.accent.blue }]}>{lbl}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={s.innerCard}>
              <Stepper label="Zaokrąglenie" value={style.cornerRadius} min={0} max={30} step={2}
                onChange={v => onChange({ cornerRadius: v })} />
            </View>
            <Text style={s.hint}>Tapnij kafel na płótnie, żeby wybrać/zmienić licznik. Procent wypełnienia liczy się z jego własnego zakresu dat (Licznik → data początkowa/docelowa).</Text>
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
  segmented: { flexDirection: 'row', gap: 6 },
  segBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  segTxt: { fontSize: 11, fontWeight: '700', color: c.text.secondary },
  innerCard: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.card, padding: spacing[3] },
  hint: { fontSize: 11, color: c.text.muted, lineHeight: 15 },
});

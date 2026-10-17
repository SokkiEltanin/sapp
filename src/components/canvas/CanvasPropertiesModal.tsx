import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { X, SlidersHorizontal, ArrowUpToLine, ArrowDownToLine, Link2Off } from 'lucide-react-native';
import { MIN_ITEM_WIDTH, MIN_ITEM_HEIGHT } from '@/store/canvasComponentsStore';
import { useColors } from '@/theme/useColors';
import { spacing, radius } from '@/theme';
import { haptic } from '@/utils/haptics';
import Stepper from '@/components/ui/Stepper';

// Panel właściwości (Faza 28, 2026-10-17, §359) — faza 3/3 przebudowy w kierunku pełnego
// edytora (po §357 kształty, §358 data-binding). User, zbadane wcześniej jako plan: "panel
// właściwości (numeryczne X/Y/W/H, nie tylko gest), warstwy, rozszerzone grupowanie". JEDEN
// wspólny panel dla WSZYSTKICH typów komponentów (w przeciwieństwie do 🎨 stylu, który jest
// per-typ — pozycja/rozmiar/warstwa/grupa to uniwersalne właściwości, nie treść).
//
// `onUngroup` tu, NIE jako osobny przycisk w chrome `CanvasPlacedItem.tsx` (gdzie żył do §359)
// — skupia WSZYSTKIE "układowe" akcje (pozycja/rozmiar/warstwa/grupa) w jednym miejscu,
// jednocześnie zwalniając miejsce w ciasnym rogu kafla (3 przyciski max, nie 4).
export default function CanvasPropertiesModal({ visible, x, y, width, height, canvasWidth, grouped, onChange, onBringToFront, onSendToBack, onUngroup, onClose }: {
  visible: boolean;
  x: number; y: number; width: number; height: number;
  canvasWidth: number;
  grouped: boolean;
  onChange: (patch: Partial<{ x: number; y: number; width: number; height: number }>) => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onUngroup: () => void;
  onClose: () => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const maxX = Math.max(0, canvasWidth - width);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <View style={s.head}>
            <SlidersHorizontal size={16} color={c.accent.blue} />
            <Text style={s.title}>Właściwości</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><X size={18} color={c.text.muted} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ gap: spacing[3] }}>
            <Text style={s.sectionLabel}>Pozycja i rozmiar</Text>
            <View style={s.innerCard}>
              <Stepper label="Pozycja X" value={x} min={0} max={maxX} step={8}
                onChange={v => onChange({ x: v })} />
              <View style={s.divider} />
              <Stepper label="Pozycja Y" value={y} min={0} max={4000} step={8}
                onChange={v => onChange({ y: v })} />
              <View style={s.divider} />
              <Stepper label="Szerokość" value={width} min={MIN_ITEM_WIDTH} max={canvasWidth} step={8}
                onChange={v => onChange({ width: v })} />
              <View style={s.divider} />
              <Stepper label="Wysokość" value={height} min={MIN_ITEM_HEIGHT} max={2000} step={8}
                onChange={v => onChange({ height: v })} />
            </View>

            <Text style={s.sectionLabel}>Warstwa</Text>
            <View style={{ flexDirection: 'row', gap: spacing[2] }}>
              <TouchableOpacity onPress={() => { haptic.tap(); onSendToBack(); }} style={[s.layerBtn, { flex: 1 }]} activeOpacity={0.85}>
                <ArrowDownToLine size={14} color={c.text.secondary} />
                <Text style={s.layerBtnTxt}>Na spód</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { haptic.tap(); onBringToFront(); }} style={[s.layerBtn, { flex: 1 }]} activeOpacity={0.85}>
                <ArrowUpToLine size={14} color={c.text.secondary} />
                <Text style={s.layerBtnTxt}>Na wierzch</Text>
              </TouchableOpacity>
            </View>

            {grouped && (
              <>
                <Text style={s.sectionLabel}>Grupa</Text>
                <TouchableOpacity onPress={() => { haptic.tap(); onUngroup(); onClose(); }} style={[s.layerBtn, { backgroundColor: c.accent.purple + '18', borderColor: c.accent.purple }]} activeOpacity={0.85}>
                  <Link2Off size={14} color={c.accent.purple} />
                  <Text style={[s.layerBtnTxt, { color: c.accent.purple }]}>Rozgrupuj</Text>
                </TouchableOpacity>
              </>
            )}
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
  sectionLabel: { fontSize: 11, fontWeight: '800', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  innerCard: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.card, padding: spacing[3] },
  divider: { height: 1, backgroundColor: c.border.subtle },
  layerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
  },
  layerBtnTxt: { fontSize: 12.5, fontWeight: '700', color: c.text.secondary },
});

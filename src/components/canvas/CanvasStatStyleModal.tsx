import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { X, Palette } from 'lucide-react-native';
import { StatTileCanvasStyle } from '@/store/statTileStyleDefaults';
import { useColors } from '@/theme/useColors';
import { spacing, radius } from '@/theme';
import { haptic } from '@/utils/haptics';

// Styl instancji "Wykres" (Faza 4, §386) — najprostszy modal w rodzinie (tylko dwa
// przełączniki, period/viz — żadnych kolorów/fontów, kolor akcentu idzie z czasu dnia jak
// reszta appki, patrz `ScreenCanvas.tsx`'s `timeAccentColor`). Który METRYK pokazać to
// podpięcie (`bindingKey` → `MetricPickerModal`), nie styl — ten sam podział co
// streakTile/countdownTile/notesTile/dataField.
export default function CanvasStatStyleModal({ visible, style, onChange, onClose }: {
  visible: boolean;
  style: StatTileCanvasStyle;
  onChange: (patch: Partial<StatTileCanvasStyle>) => void;
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
            <Text style={s.title}>Styl wykresu</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><X size={18} color={c.text.muted} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ gap: spacing[3] }}>
            <Text style={s.sectionLabel}>Okres</Text>
            <View style={s.segmented}>
              {([['week', 'Tydzień'], ['month', 'Miesiąc']] as [StatTileCanvasStyle['period'], string][]).map(([m, lbl]) => {
                const on = style.period === m;
                return (
                  <TouchableOpacity key={m} onPress={() => { haptic.tap(); onChange({ period: m }); }}
                    style={[s.segBtn, { flex: 1, alignItems: 'center' }, on && { backgroundColor: c.accent.blue + '22', borderColor: c.accent.blue }]}>
                    <Text style={[s.segTxt, on && { color: c.accent.blue }]}>{lbl}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.sectionLabel}>Wygląd</Text>
            <View style={s.segmented}>
              {([['number', 'Liczba'], ['wave', 'Wykres fali']] as [StatTileCanvasStyle['viz'], string][]).map(([m, lbl]) => {
                const on = style.viz === m;
                return (
                  <TouchableOpacity key={m} onPress={() => { haptic.tap(); onChange({ viz: m }); }}
                    style={[s.segBtn, { flex: 1, alignItems: 'center' }, on && { backgroundColor: c.accent.blue + '22', borderColor: c.accent.blue }]}>
                    <Text style={[s.segTxt, on && { color: c.accent.blue }]}>{lbl}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={s.hint}>Tapnij kafel na płótnie, żeby wybrać/zmienić metrykę.</Text>
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
  hint: { fontSize: 11, color: c.text.muted, lineHeight: 15 },
});

import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView, Switch } from 'react-native';
import { X, Palette } from 'lucide-react-native';
import { IconTileStyle, ICON_TILE_ICONS, ICON_COLOR_PRESETS, DEFAULT_ICON_TILE_STYLE } from '@/store/iconTileStyleDefaults';
import { ICON_TILE_MAP } from './IconTile';
import { useColors } from '@/theme/useColors';
import { spacing, radius } from '@/theme';
import { haptic } from '@/utils/haptics';
import Stepper from '@/components/ui/Stepper';
import ColorSwatchPicker from '@/components/ui/ColorSwatchPicker';

// Styl instancji "Ikona" na płótnie (§371, user: "możesz też do edytora pododawać IKONKI...
// moge je dodawac wtedy bezposrednio skalować justować"). Ten sam wzorzec co
// `CanvasDataFieldStyleModal`/`CanvasShapeStyleModal` — bez podpięcia danych, same ustawienia
// wizualne. Jedyny nowy element UI: siatka wyboru ikony (`ICON_TILE_ICONS`), ten sam wzorzec co
// `habits.tsx`'s `iconRow`/`iconBtn`, tylko szersza pula (45 vs 8 — ten komponent jest
// ogólnego przeznaczenia, nie tylko nawyki).
export default function CanvasIconStyleModal({ visible, style, onChange, onClose }: {
  visible: boolean;
  style: IconTileStyle;
  onChange: (patch: Partial<IconTileStyle>) => void;
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
            <Text style={s.title}>Styl ikony</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><X size={18} color={c.text.muted} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ gap: spacing[3] }}>
            <View>
              <Text style={s.sectionLabel}>Ikona</Text>
              <View style={s.iconGrid}>
                {ICON_TILE_ICONS.map(key => {
                  const Icon = ICON_TILE_MAP[key];
                  const on = style.iconKey === key;
                  return (
                    <TouchableOpacity key={key} onPress={() => { haptic.tap(); onChange({ iconKey: key }); }}
                      style={[s.iconBtn, on && { backgroundColor: style.color + '22', borderColor: style.color }]}>
                      <Icon size={18} color={on ? style.color : c.text.muted} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View>
              <Text style={s.sectionLabel}>Kolor ikony</Text>
              <ColorSwatchPicker presets={ICON_COLOR_PRESETS} current={style.color} onSelect={(hex) => onChange({ color: hex })} />
            </View>

            <Text style={s.sectionLabel}>Wyrównanie</Text>
            <View style={s.segmented}>
              {([['left', 'Do lewej'], ['center', 'Środek'], ['right', 'Do prawej']] as [IconTileStyle['align'], string][]).map(([m, lbl]) => {
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
              <Stepper label="Rozmiar ikony" value={style.size} min={16} max={128} step={4}
                onChange={v => onChange({ size: v })} />
              <View style={s.divider} />
              <View style={s.row}>
                <Text style={s.rowLabel}>Tło pod ikoną</Text>
                <Switch value={style.backgroundColor != null} onValueChange={v => { haptic.tap(); onChange({ backgroundColor: v ? (DEFAULT_ICON_TILE_STYLE.backgroundColor ?? '#1E293B') : null }); }}
                  trackColor={{ false: c.border.default, true: c.accent.blue }} />
              </View>
              {style.backgroundColor != null && (
                <>
                  <View style={s.divider} />
                  <ColorSwatchPicker presets={ICON_COLOR_PRESETS} current={style.backgroundColor} onSelect={(hex) => onChange({ backgroundColor: hex })} />
                  <View style={s.divider} />
                  <Stepper label="Zaokrąglenie rogów" value={style.cornerRadius} min={0} max={32} step={2}
                    onChange={v => onChange({ cornerRadius: v })} />
                </>
              )}
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
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  iconBtn: {
    width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated,
  },
});

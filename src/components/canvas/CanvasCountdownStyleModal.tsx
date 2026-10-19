import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { X, Palette } from 'lucide-react-native';
import { CountdownTileStyle, CountdownLayoutPreset } from '@/components/dashboard/CountdownTile';
import { useColors } from '@/theme/useColors';
import { spacing, radius } from '@/theme';
import { haptic } from '@/utils/haptics';
import Stepper from '@/components/ui/Stepper';
import StylePresetBar from '@/components/ui/StylePresetBar';

// Edycja stylu PER-INSTANCJA odliczania na płótnie (Faza 17, 2026-10-17) — rozszerzone w
// Fazie 24 (§355, user: "nie ma możliwości wyboru własnego kształtu od zera") o 4 warianty
// kształtu (`CountdownLayoutPreset`), ten sam wzorzec segmented-control co "Styl kafelka" w
// `CanvasStreakStyleModal`. `ringSize`/`ringStrokeWidth` mają sens TYLKO dla `'ring'`,
// `numberScale` TYLKO dla `'hero'` — pokazywane warunkowo.
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
            {/* Presety stylu (§370) — korelacja z zakładką "Odliczania" w dashboard-tile-
                creator.tsx: `CountdownTileStyle` (tu) vs `CountdownsTileStyle` (tam) różnią
                się jednym polem (`maxVisible`, tylko w Kreatorze) — partial-merge przez
                `onChange`/`setDraft` ignoruje brakujące/nieznane pole po drugiej stronie. */}
            <Text style={s.sectionLabel}>Presety</Text>
            <StylePresetBar family="countdown" style={style as unknown as Record<string, unknown>} onApply={(p) => onChange(p as Partial<CountdownTileStyle>)} />

            <Text style={s.sectionLabel}>Styl</Text>
            <View style={s.segmented}>
              {([['ring', 'Pierścień'], ['bar', 'Pasek'], ['compact', 'Kompaktowy'], ['hero', 'Duża liczba']] as [CountdownLayoutPreset, string][]).map(([m, lbl]) => {
                const on = style.layoutPreset === m;
                return (
                  <TouchableOpacity key={m} onPress={() => { haptic.tap(); onChange({ layoutPreset: m }); }}
                    style={[s.segBtn, { flex: 1, alignItems: 'center' }, on && { backgroundColor: c.accent.blue + '22', borderColor: c.accent.blue }]}>
                    <Text style={[s.segTxt, on && { color: c.accent.blue }]}>{lbl}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.sectionLabel}>Kształt</Text>
            <View style={s.innerCard}>
              <Stepper label="Zaokrąglenie rogów" value={style.cornerRadius} min={0} max={32} step={2}
                onChange={v => onChange({ cornerRadius: v })} />
              {style.layoutPreset === 'ring' && (
                <>
                  <View style={s.divider} />
                  <Stepper label="Rozmiar pierścienia" value={style.ringSize} min={36} max={84} step={4}
                    onChange={v => onChange({ ringSize: v })} />
                  <View style={s.divider} />
                  <Stepper label="Grubość pierścienia" value={style.ringStrokeWidth} min={2} max={12} step={1}
                    onChange={v => onChange({ ringStrokeWidth: v })} />
                </>
              )}
              {style.layoutPreset === 'hero' && (
                <>
                  <View style={s.divider} />
                  <Stepper label="Skala liczby" value={style.numberScale} min={0.7} max={1.8} step={0.1} decimals={1}
                    onChange={v => onChange({ numberScale: v })} />
                </>
              )}
            </View>

            {/* Tło (§402) — user: "daj żeby edycja kafelka była z jego transparentością...
                nie ma wielu opcji edycji". Ten sam wzorzec co `CanvasDataFieldStyleModal`. */}
            <Text style={s.sectionLabel}>Tło</Text>
            <View style={s.segmented}>
              {([['card', 'Karta'], ['none', 'Brak']] as [NonNullable<CountdownTileStyle['background']>, string][]).map(([m, lbl]) => {
                const on = (style.background ?? 'card') === m;
                return (
                  <TouchableOpacity key={m} onPress={() => { haptic.tap(); onChange({ background: m }); }}
                    style={[s.segBtn, { flex: 1, alignItems: 'center' }, on && { backgroundColor: c.accent.blue + '22', borderColor: c.accent.blue }]}>
                    <Text style={[s.segTxt, on && { color: c.accent.blue }]}>{lbl}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {(style.background ?? 'card') === 'card' && (
              <View style={s.innerCard}>
                <Stepper label="Przezroczystość tła" value={Math.round((style.opacity ?? 1) * 100)} min={10} max={100} step={10}
                  onChange={v => onChange({ opacity: v / 100 })} />
              </View>
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
  sectionLabel: { fontSize: 11, fontWeight: '800', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing[2] },
  innerCard: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.card, padding: spacing[3] },
  divider: { height: 1, backgroundColor: c.border.subtle },
  segmented: { flexDirection: 'row', gap: 6 },
  segBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  segTxt: { fontSize: 11, fontWeight: '700', color: c.text.secondary },
});

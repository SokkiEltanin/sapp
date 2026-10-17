import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView, Switch } from 'react-native';
import { X, Palette, RotateCcw } from 'lucide-react-native';
import { StreakTileStyle, FlameCorner, StreakLayoutPreset } from '@/store/streakTileStyleStore';
import { STREAK_TIERS, TIER_COLOR_PRESETS } from '@/utils/streakTiers';
import { useColors } from '@/theme/useColors';
import { spacing, radius } from '@/theme';
import { haptic } from '@/utils/haptics';
import Stepper from '@/components/ui/Stepper';

// Edycja stylu PER-INSTANCJA na wolnym płótnie (system kopiowania komponentów, Faza 16,
// §342) — dotychczas (Faza 15) nowa instancja miała tylko `DEFAULT_STREAK_TILE_STYLE`, bez
// ŻADNEGO UI do zmiany. Treść 1:1 odpowiada zakładce "Twoje serie" w
// `dashboard-tile-creator.tsx` (Styl kafelka/Kształt/Tło i warstwy/Pozycja i warstwy/Paleta
// progów) — ten sam zestaw kontrolek, tylko bez draft/live (instancja na płótnie jest
// JEDNA, edytowana na żywo, nie globalnym stylem całego dashboardu — nie ma czego "wdrażać").
// ŚWIADOMIE bez "Odstęp między kafelkami" (pojęcie siatki, nie pojedynczej instancji) i bez
// "Cel po kliknięciu" (przepinanie nawigacji pozostaje odłożone dla instancji na płótnie —
// patrz NEXT_STEPS.md).
export default function CanvasStreakStyleModal({ visible, style, onChange, onSetTierColor, onClose }: {
  visible: boolean;
  style: StreakTileStyle;
  onChange: (patch: Partial<StreakTileStyle>) => void;
  onSetTierColor: (tierIndex: number, color: string | null) => void;
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
            <Text style={s.title}>Styl kafelka</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><X size={18} color={c.text.muted} /></TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ gap: spacing[2] }}>
            <Text style={s.sectionLabel}>Styl</Text>
            <View style={s.segmented}>
              {([['classic', 'Klasyczny'], ['ring', 'Pierścień'], ['stripe', 'Pasek'], ['compact', 'Kompaktowy']] as [StreakLayoutPreset, string][]).map(([m, lbl]) => {
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
              <View style={s.divider} />
              <Stepper label="Proporcje kafelka" value={style.aspectRatio} min={1.1} max={2.6} step={0.1} decimals={1}
                onChange={v => onChange({ aspectRatio: v })} />
              {style.layoutPreset !== 'ring' && (
                <>
                  <View style={s.divider} />
                  <Stepper label="Skala liczby" value={style.numberScale} min={0.7} max={1.5} step={0.1} decimals={1}
                    onChange={v => onChange({ numberScale: v })} />
                </>
              )}
            </View>

            {style.layoutPreset === 'classic' && (
              <>
                <Text style={s.sectionLabel}>Tło i warstwy</Text>
                <View style={s.innerCard}>
                  <View style={s.row}>
                    <Text style={s.rowLabel}>Tło</Text>
                    <View style={s.segmented}>
                      {([['gradient', 'Gradient'], ['flat', 'Płasko']] as [StreakTileStyle['gradientMode'], string][]).map(([m, lbl]) => {
                        const on = style.gradientMode === m;
                        return (
                          <TouchableOpacity key={m} onPress={() => { haptic.tap(); onChange({ gradientMode: m }); }}
                            style={[s.segBtn, on && { backgroundColor: c.accent.blue + '22', borderColor: c.accent.blue }]}>
                            <Text style={[s.segTxt, on && { color: c.accent.blue }]}>{lbl}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                  <View style={s.divider} />
                  <View style={s.row}>
                    <Text style={s.rowLabel}>Pasek postępu</Text>
                    <Switch value={style.showProgressBar} onValueChange={v => { haptic.tap(); onChange({ showProgressBar: v }); }}
                      trackColor={{ false: c.border.default, true: c.accent.blue }} />
                  </View>
                  <View style={s.divider} />
                  <View style={s.row}>
                    <Text style={s.rowLabel}>Płomień w tle</Text>
                    <Switch value={style.showFlame} onValueChange={v => { haptic.tap(); onChange({ showFlame: v }); }}
                      trackColor={{ false: c.border.default, true: c.accent.blue }} />
                  </View>
                </View>

                <Text style={s.sectionLabel}>Pozycja i warstwy</Text>
                <View style={s.innerCard}>
                  <View style={[s.row, { alignItems: 'flex-start' }]}>
                    <Text style={s.rowLabel}>Róg płomienia</Text>
                    <View style={s.cornerGrid}>
                      {([['tl', '↖'], ['tr', '↗'], ['bl', '↙'], ['br', '↘']] as [FlameCorner, string][]).map(([m, sym]) => {
                        const on = style.flameCorner === m;
                        return (
                          <TouchableOpacity key={m} onPress={() => { haptic.tap(); onChange({ flameCorner: m }); }}
                            style={[s.cornerBtn, on && { backgroundColor: c.accent.blue + '22', borderColor: c.accent.blue }]}>
                            <Text style={[s.segTxt, on && { color: c.accent.blue }]}>{sym}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                  <View style={s.divider} />
                  <View style={s.row}>
                    <Text style={s.rowLabel}>Płomień na wierzchu</Text>
                    <Switch value={style.flameOnTop} onValueChange={v => { haptic.tap(); onChange({ flameOnTop: v }); }}
                      trackColor={{ false: c.border.default, true: c.accent.blue }} />
                  </View>
                  <View style={s.divider} />
                  <View style={s.row}>
                    <Text style={s.rowLabel}>Wyrównanie treści</Text>
                    <View style={s.segmented}>
                      {([['left', 'Do lewej'], ['center', 'Środek']] as [StreakTileStyle['contentAlign'], string][]).map(([m, lbl]) => {
                        const on = style.contentAlign === m;
                        return (
                          <TouchableOpacity key={m} onPress={() => { haptic.tap(); onChange({ contentAlign: m }); }}
                            style={[s.segBtn, on && { backgroundColor: c.accent.blue + '22', borderColor: c.accent.blue }]}>
                            <Text style={[s.segTxt, on && { color: c.accent.blue }]}>{lbl}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>
              </>
            )}

            <Text style={s.sectionLabel}>Paleta progów</Text>
            <View style={s.innerCard}>
              {STREAK_TIERS.map((tier, i) => {
                const current = style.tierColorOverrides?.[i] ?? tier.color;
                return (
                  <View key={tier.name}>
                    {i > 0 && <View style={s.divider} />}
                    <View style={[s.row, { alignItems: 'flex-start' }]}>
                      <Text style={s.rowLabel}>{tier.name} <Text style={{ color: c.text.muted, fontWeight: '400' }}>od {tier.min} dni</Text></Text>
                      <View style={s.swatchRow}>
                        {TIER_COLOR_PRESETS.map(hex => (
                          <TouchableOpacity key={hex} onPress={() => { haptic.tap(); onSetTierColor(i, hex); }}
                            style={[s.swatch, { backgroundColor: hex }, current === hex && s.swatchOn]} />
                        ))}
                        <TouchableOpacity onPress={() => { haptic.tap(); onSetTierColor(i, null); }} style={s.swatchReset}>
                          <RotateCcw size={12} color={c.text.secondary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
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
  sectionLabel: { fontSize: 11, fontWeight: '800', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing[2] },
  innerCard: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.card, padding: spacing[3] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing[2] },
  rowLabel: { fontSize: 13, fontWeight: '600', color: c.text.primary, flex: 1 },
  divider: { height: 1, backgroundColor: c.border.subtle },
  segmented: { flexDirection: 'row', gap: 6 },
  segBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  segTxt: { fontSize: 12, fontWeight: '700', color: c.text.secondary },
  cornerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, width: 76, justifyContent: 'flex-end' },
  cornerBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, flex: 1, justifyContent: 'flex-end' },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: c.text.primary },
  swatchReset: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg.elevated },
});

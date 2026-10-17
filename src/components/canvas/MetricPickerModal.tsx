import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { X, Check, Ban, LucideIcon } from 'lucide-react-native';
import { spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { haptic } from '@/utils/haptics';

// Generyczna opcja pickera — ŚWIADOMIE nie `StreakItem` (Faza 17, 2026-10-17, drugi typ
// komponentu do kopiowania: odliczania) — `meta` to już SFORMATOWANY tekst drugiej linii
// ("4 dni" / "za 12 dni"), liczy go WOŁAJĄCY (`ScreenCanvas.tsx`, znający realny typ listy:
// `StreakItem[]` ma `.days`, `Counter[]` ma `.date`/`daysUntil()` — różne sposoby liczenia tej
// samej "drugiej linijki"), nie ten modal.
export interface PickerOption { key: string; label: string; meta: string }

// Picker podpięcia dla wolnego płótna (system kopiowania komponentów, §341) — user: "tapnięcie
// kafelka otwiera picker metryki". Ten sam wzorzec modala co `ClassLinkPicker.tsx` (overlay +
// karta + przewijana lista) — teraz współdzielony przez WSZYSTKIE typy komponentów płótna,
// `icon`/`title` jako propy, bo "metryka" (seria) i "odliczanie" to różne słowa/ikony mimo
// identycznego mechanizmu wyboru.
interface Props {
  visible: boolean;
  title: string;
  icon: LucideIcon;
  options: PickerOption[];
  currentKey: string | null;
  emptyHint: string;
  onSelect: (key: string | null) => void;
  onClose: () => void;
}

export default function MetricPickerModal({ visible, title, icon: Icon, options, currentKey, emptyHint, onSelect, onClose }: Props) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const sorted = useMemo(() => [...options].sort((a, b) => a.label.localeCompare(b.label, 'pl')), [options]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <View style={s.head}>
            <Icon size={16} color={c.accent.blue} />
            <Text style={s.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><X size={18} color={c.text.muted} /></TouchableOpacity>
          </View>
          {sorted.length === 0 ? (
            <Text style={s.empty}>{emptyHint}</Text>
          ) : (
            <ScrollView style={s.list} contentContainerStyle={{ gap: spacing[1] }}>
              {/* "Brak (wyczyść)" (2026-10-16, Faza 16) — bez tego raz podpięty kafel nie mógł
                  już wrócić do stanu "niepodpięty", tylko przeskoczyć na INNĄ opcję z listy. */}
              {currentKey != null && (
                <TouchableOpacity style={s.row} onPress={() => { haptic.tap(); onSelect(null); }} activeOpacity={0.75}>
                  <Ban size={15} color={c.text.muted} />
                  <Text style={[s.rowName, { color: c.text.muted, flex: 1 }]}>Brak (wyczyść)</Text>
                </TouchableOpacity>
              )}
              {sorted.map(opt => {
                const on = opt.key === currentKey;
                return (
                  <TouchableOpacity key={opt.key} style={[s.row, on && s.rowOn]}
                    onPress={() => { haptic.tap(); onSelect(opt.key); }} activeOpacity={0.75}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.rowName} numberOfLines={1}>{opt.label}</Text>
                      <Text style={s.rowMeta}>{opt.meta}</Text>
                    </View>
                    {on && <Check size={16} color={c.accent.blue} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeS = (c: any) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[5] },
  card: {
    width: '100%', maxWidth: 400, maxHeight: '75%', backgroundColor: c.bg.secondary,
    borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default, padding: spacing[4], gap: spacing[2],
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { flex: 1, fontSize: 15, fontWeight: '800', color: c.text.primary },
  empty: { fontSize: 12.5, color: c.text.muted, lineHeight: 18, paddingVertical: spacing[3] },
  list: { marginTop: spacing[1] },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2], borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderWidth: 1, borderColor: 'transparent',
  },
  rowOn: { backgroundColor: c.accent.blue + '18', borderColor: c.accent.blue },
  rowName: { fontSize: 13.5, fontWeight: '700', color: c.text.primary },
  rowMeta: { fontSize: 11, color: c.text.muted, marginTop: 1 },
});

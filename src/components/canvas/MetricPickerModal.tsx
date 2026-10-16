import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { X, Flame, Check } from 'lucide-react-native';
import { StreakItem } from '@/components/dashboard/StreakWallCard';
import { spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { haptic } from '@/utils/haptics';

// Picker metryki dla wolnego płótna (system kopiowania komponentów, §341) — user: "tapnięcie
// kafelka otwiera picker metryki" (żeby zmienić, Z CZYM kafel jest połączony). Ten sam wzorzec
// modala co `ClassLinkPicker.tsx` (overlay + karta + przewijana lista), lista = WSZYSTKIE
// `StreakItem`y z `useAllStreakItems()` — ten sam zestaw, co pokazuje się w "Twoje serie" na
// dashboardzie, więc user wybiera z czegoś znanego, nie nowego słownika.
interface Props {
  visible: boolean;
  options: StreakItem[];
  currentKey: string | null;
  onSelect: (key: string) => void;
  onClose: () => void;
}

export default function MetricPickerModal({ visible, options, currentKey, onSelect, onClose }: Props) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const sorted = useMemo(() => [...options].sort((a, b) => a.name.localeCompare(b.name, 'pl')), [options]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <View style={s.head}>
            <Flame size={16} color={c.accent.blue} />
            <Text style={s.title}>Wybierz metrykę</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><X size={18} color={c.text.muted} /></TouchableOpacity>
          </View>
          {sorted.length === 0 ? (
            <Text style={s.empty}>Brak nawyków/liczników/ćwiczeń z serią na koncie — dodaj jeden w Nawykach albo Licznikach.</Text>
          ) : (
            <ScrollView style={s.list} contentContainerStyle={{ gap: spacing[1] }}>
              {sorted.map(item => {
                const on = item.key === currentKey;
                return (
                  <TouchableOpacity key={item.key} style={[s.row, on && s.rowOn]}
                    onPress={() => { haptic.tap(); onSelect(item.key); }} activeOpacity={0.75}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
                      <Text style={s.rowMeta}>{item.days} {item.days === 1 ? 'dzień' : 'dni'}</Text>
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

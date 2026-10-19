import { View, Text, TouchableOpacity, StyleProp, ViewStyle, StyleSheet } from 'react-native';
import { Database } from 'lucide-react-native';
import { DataFieldTileStyle } from '@/store/dataFieldTileStyleDefaults';
import { DataFieldValue } from '@/hooks/useDataFieldRegistry';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';

// Kafel generycznego "pola danych" (Faza 27, 2026-10-17, §358) — siostrzany `StreakTile`/
// `CountdownTile`/`NotesTile` (ta sama sygnatura, `item: X | null` dla stanu niepodpiętego).
// Różnica: `field` NIE jest surowym obiektem domenowym (jak `Counter`/`StreakItem`) — to już
// WYLICZONA etykieta+wartość z `useDataFieldRegistry()`, bo "pole danych" może pochodzić z
// zupełnie różnych store'ów (pupil/zadania/data) i nie ma jednego wspólnego typu domenowego do
// przekazania — rejestr ujednolica to PRZED dotarciem tutaj.
export function DataFieldTile({ field, tileStyle, onPress, sizeStyle, boxed = false }: {
  field: DataFieldValue | null;
  tileStyle: DataFieldTileStyle;
  onPress: () => void;
  sizeStyle?: StyleProp<ViewStyle>;
  boxed?: boolean;
}) {
  const c = useColors();
  const s = makeS(c);
  // Tło karty (§401) — `boxed` (prop od wołającego, dziś zawsze `true` w `ScreenCanvas.tsx`)
  // mówi "ten kontekst W OGÓLE pozwala na kartę"; `tileStyle.background` (per-instancja,
  // user-konfigurowalne w `CanvasDataFieldStyleModal.tsx`) mówi czy TA KONKRETNA instancja jej
  // chce. `'none'` = czysty tekst — zero tła, zero paddingu, dokładnie to o co user prosił dla
  // pola daty. Przezroczystość (`opacity`, domyślnie 1 = pełna) wmieszana w HEX tła, nie w RN
  // `opacity` (który przyciemniłby TEKST razem z tłem) — ten sam wzorzec co `c.accent.blue +
  // '18'` wszędzie indziej w appce.
  const hasBg = boxed && (tileStyle.background ?? 'card') === 'card';
  const bgAlphaHex = Math.round(Math.max(0, Math.min(1, tileStyle.opacity ?? 1)) * 255).toString(16).padStart(2, '0');

  if (!field) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={sizeStyle}>
        <View style={[s.tile, boxed && s.tileBoxed, s.tileEmpty, { borderRadius: tileStyle.cornerRadius }]}>
          <Database size={18} color={c.text.muted} />
          <Text style={s.emptyLabel} numberOfLines={1}>Wybierz pole danych</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={sizeStyle}>
      <View style={[s.tile, hasBg && { backgroundColor: c.bg.elevated + bgAlphaHex, padding: 12 }, { borderRadius: tileStyle.cornerRadius }]}>
        {tileStyle.showLabel && (
          <Text style={[s.label, { textAlign: tileStyle.align }]} numberOfLines={1}>{field.label}</Text>
        )}
        <Text
          style={{ color: tileStyle.color, fontSize: tileStyle.fontSize, fontWeight: tileStyle.bold ? '800' : '600', textAlign: tileStyle.align }}
          numberOfLines={2}
        >
          {field.value}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  tile: { flex: 1, justifyContent: 'center', gap: 2 },
  tileBoxed: { backgroundColor: c.bg.elevated, padding: 12 },
  tileEmpty: {
    alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center',
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.border.subtle, backgroundColor: 'transparent',
  },
  emptyLabel: { fontSize: 11.5, fontWeight: '700', color: c.text.muted },
  label: { fontSize: 10.5, fontWeight: '800', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
}));

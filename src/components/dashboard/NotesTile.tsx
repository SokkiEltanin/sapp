import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { FileText } from 'lucide-react-native';
import { Note } from '@/utils/notesStorage';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';
import { NotesTileStyle, NotesLayoutPreset, DEFAULT_NOTES_TILE_STYLE } from '@/store/notesTileStyleDefaults';

export type { NotesTileStyle, NotesLayoutPreset };
export { DEFAULT_NOTES_TILE_STYLE };

// Wyekstrahowane z `PinnedNotesCard.tsx`'s per-wiersz renderu (system kopiowania komponentów,
// trzeci `componentType`, Faza 21, 2026-10-17, §350) — ten sam zabieg co `CountdownTile` z
// `CountdownsCard` (§344). Różnica od serii/odliczań: dashboard pokazuje LISTĘ przypiętych
// notatek naraz, kafel na płótnie wiąże się z JEDNĄ, konkretną notatką po `id` (dowolną, nie
// tylko przypiętą — user może chcieć "skopiować" dowolną notatkę jako osobny widget, nie tylko
// te oznaczone pinezką na dashboardzie). `item: null` — ten sam wzorzec co `CountdownTile`
// (zamiast fabrykować sztuczną `Note`).
export function NotesTile({ note, tileStyle, accentColor, onPress, sizeStyle, boxed = false }: {
  note: Note | null;
  tileStyle: NotesTileStyle;
  accentColor: string;
  onPress: () => void;
  sizeStyle?: StyleProp<ViewStyle>;
  boxed?: boolean;
}) {
  const c = useColors();
  const s = makeS(c);
  // Tło/przezroczystość (§402) — JEDNO miejsce liczące dynamiczne tło-kartę, reużyte we
  // wszystkich 3 gałęziach renderu niżej (ten sam zabieg co `CountdownTile.tsx`).
  const hasBg = boxed && (tileStyle.background ?? 'card') === 'card';
  const bgAlphaHex = Math.round(Math.max(0, Math.min(1, tileStyle.opacity ?? 1)) * 255).toString(16).padStart(2, '0');
  const boxedStyle = hasBg ? { backgroundColor: c.bg.elevated + bgAlphaHex, padding: spacing[3], borderWidth: 1, borderColor: c.border.subtle } : null;

  if (!note) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={sizeStyle}>
        <View style={[s.placeholder, { borderRadius: tileStyle.cornerRadius }]}>
          <FileText size={16} color={c.text.muted} />
          <Text style={s.placeholderTxt}>Wybierz notatkę</Text>
        </View>
      </TouchableOpacity>
    );
  }

  const preset: NotesLayoutPreset = tileStyle.layoutPreset ?? 'row';

  if (preset === 'compact') {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={sizeStyle}>
        <View style={[s.compactRow, boxedStyle, { borderRadius: tileStyle.cornerRadius }]}>
          <Text numberOfLines={1} style={s.compactTxt}>
            <Text style={s.compactTitle}>{note.title || 'Bez tytułu'}</Text>
            {tileStyle.showBody && !!note.body?.trim() && <Text style={s.compactBody}> — {note.body.trim()}</Text>}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (preset === 'card') {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={sizeStyle}>
        <View style={[s.cardRow, boxedStyle, { borderRadius: tileStyle.cornerRadius }]}>
          <Text style={s.cardTitle} numberOfLines={1}>{note.title || 'Bez tytułu'}</Text>
          {tileStyle.showBody && !!note.body?.trim() && (
            <Text style={s.cardBody} numberOfLines={4}>{note.body.trim()}</Text>
          )}
          {tileStyle.showTags && (note.tags ?? []).length > 0 && (
            <Text style={s.tags} numberOfLines={1}>{note.tags.map(t => `#${t}`).join(' ')}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={sizeStyle}>
      <View style={[s.row, boxedStyle, { borderRadius: tileStyle.cornerRadius }]}>
        <FileText size={13} color={accentColor} style={{ marginTop: 1 }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.title} numberOfLines={1}>{note.title || 'Bez tytułu'}</Text>
          {tileStyle.showBody && !!note.body?.trim() && (
            <Text style={s.body} numberOfLines={2}>{note.body.trim()}</Text>
          )}
          {tileStyle.showTags && (note.tags ?? []).length > 0 && (
            <Text style={s.tags} numberOfLines={1}>{note.tags.map(t => `#${t}`).join(' ')}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start' },
  boxed: { backgroundColor: c.bg.elevated, padding: spacing[3], borderWidth: 1, borderColor: c.border.subtle },
  title: { fontSize: 13, fontWeight: '700', color: c.text.primary },
  body: { fontSize: 11.5, color: c.text.secondary, lineHeight: 16, marginTop: 1 },
  tags: { fontSize: 10, color: c.text.muted, marginTop: 2 },

  // 'compact' (§363) — jedna linijka, zero ikony.
  compactRow: { flex: 1, justifyContent: 'center' },
  compactTxt: { fontSize: 12.5 },
  compactTitle: { fontWeight: '800', color: c.text.primary },
  compactBody: { color: c.text.secondary },

  // 'card' (§363) — większy tytuł + dłuższy podgląd, myślane pod samotną instancję na płótnie.
  cardRow: { flex: 1, gap: 4, justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: c.text.primary },
  cardBody: { fontSize: 12.5, color: c.text.secondary, lineHeight: 17 },

  placeholder: {
    flex: 1, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.border.subtle,
    backgroundColor: c.bg.elevated, alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  placeholderTxt: { fontFamily: fonts.label, fontSize: 10, fontWeight: '700', color: c.text.muted },
}));

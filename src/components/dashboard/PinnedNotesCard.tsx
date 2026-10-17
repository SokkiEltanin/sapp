import { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Pin } from 'lucide-react-native';
import { router } from 'expo-router';
import { Note } from '@/utils/notesStorage';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';
import { haptic } from '@/utils/haptics';
import { usePinnedNotesTileStyleStore, PinnedNotesTileStyle } from '@/store/pinnedNotesTileStyleStore';
import { NotesTile } from './NotesTile';

// Wyciągnięte 1:1 z `app/(tabs)/index.tsx` `nodes['pinned-notes']` (2026-08-25, pierwszy,
// celowo mały krok w stronę rozbicia ~5400-liniowego dashboardu na mniejsze komponenty — patrz
// NEXT_STEPS.md "Rozbicie index.tsx" dla pełnego kontekstu/planu). Mechaniczne przeniesienie
// JSX bez zmiany logiki/wyglądu — style `card`/`cardHeader`/`cardTitle`/`pinNote*` skopiowane
// verbatim z dashboardowego `buildStyles` (te są tam współdzielone przez DZIESIĄTKI innych
// sekcji, więc zostają duplikatem tutaj zamiast wyciągania w osobny wspólny plik — to osobna,
// większa zmiana, nie część tego kroku).
export interface PinnedNotesCardProps {
  notes: Note[];
  cardBg: string;
  accentColor: string;
  // Kreator dashboardu, Faza 12 (§338) — ten sam zero-footprint wzorzec co inne karty.
  styleOverride?: PinnedNotesTileStyle;
}

function PinnedNotesCard({ notes, cardBg, accentColor, styleOverride }: PinnedNotesCardProps) {
  const c = useColors();
  const s = makeS(c);
  const liveStyle = usePinnedNotesTileStyleStore(st => st.live);
  const tileStyle = styleOverride ?? liveStyle;
  if (notes.length === 0) return null;
  return (
    <View style={[s.card, { backgroundColor: cardBg, gap: spacing[2] }]}>
      <View style={s.cardHeader}>
        <Pin size={13} color={accentColor} />
        <Text style={s.cardTitle}>Przypięte notatki</Text>
      </View>
      {notes.slice(0, tileStyle.maxVisible).map(n => (
        <NotesTile
          key={n.id}
          note={n}
          tileStyle={{ cornerRadius: 0, showBody: tileStyle.showBody, showTags: tileStyle.showTags }}
          accentColor={accentColor}
          onPress={() => { haptic.tap(); router.navigate(`/notes?noteId=${n.id}` as any); }}
          sizeStyle={s.pinNoteRow}
        />
      ))}
      <TouchableOpacity onPress={() => { haptic.tap(); router.navigate('/notes' as any); }} activeOpacity={0.7}>
        <Text style={[s.pinNoteMore, { color: accentColor }]}>Wszystkie notatki →</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  card: {
    backgroundColor: c.bg.card,
    borderRadius: radius.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: c.border.card,
    gap: spacing[3],
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
  cardTitle: { fontFamily: fonts.label, fontSize: 11, color: c.text.secondary, textTransform: 'uppercase', letterSpacing: 0.9, flexShrink: 1 },
  pinNoteRow: { paddingVertical: 4 },
  pinNoteMore: { fontSize: 11, fontWeight: '700', marginTop: 2 },
}));

export default memo(PinnedNotesCard);

import { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Pin, FileText } from 'lucide-react-native';
import { router } from 'expo-router';
import { Note } from '@/utils/notesStorage';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';
import { haptic } from '@/utils/haptics';

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
}

function PinnedNotesCard({ notes, cardBg, accentColor }: PinnedNotesCardProps) {
  const c = useColors();
  const s = makeS(c);
  if (notes.length === 0) return null;
  return (
    <View style={[s.card, { backgroundColor: cardBg, gap: spacing[2] }]}>
      <View style={s.cardHeader}>
        <Pin size={13} color={accentColor} />
        <Text style={s.cardTitle}>Przypięte notatki</Text>
      </View>
      {notes.slice(0, 4).map(n => (
        <TouchableOpacity
          key={n.id}
          style={s.pinNoteRow}
          onPress={() => { haptic.tap(); router.navigate(`/notes?noteId=${n.id}` as any); }}
          activeOpacity={0.8}
        >
          <FileText size={13} color={accentColor} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={s.pinNoteTitle} numberOfLines={1}>{n.title || 'Bez tytułu'}</Text>
            {!!n.body?.trim() && <Text style={s.pinNoteBody} numberOfLines={2}>{n.body.trim()}</Text>}
            {(n.tags ?? []).length > 0 && (
              <Text style={s.pinNoteTags} numberOfLines={1}>{n.tags.map(t => `#${t}`).join(' ')}</Text>
            )}
          </View>
        </TouchableOpacity>
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
  pinNoteRow: { flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start', paddingVertical: 4 },
  pinNoteTitle: { fontSize: 13, fontWeight: '700', color: c.text.primary },
  pinNoteBody: { fontSize: 11.5, color: c.text.secondary, lineHeight: 16, marginTop: 1 },
  pinNoteTags: { fontSize: 10, color: c.text.muted, marginTop: 2 },
  pinNoteMore: { fontSize: 11, fontWeight: '700', marginTop: 2 },
}));

export default memo(PinnedNotesCard);

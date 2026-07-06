import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Users, Info } from 'lucide-react-native';
import { spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { PersonConsumption } from '@/utils/personConsumption';

// "Kto zjadł słodycze" — per-person split of sweets consumption this month, with a
// share bar + each person's favourite. Makes the eaters tagging visible/useful.

const PERSON_COLORS = ['#2AC68F', '#EC4899', '#46B0DE', '#FBBF24', '#A78BFA', '#F87171'];

export default function WhoAteCard({ data, monthLabel }: { data: PersonConsumption; monthLabel: string }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  const people = data.people.filter(p => p.sweetsSpend > 0);
  if (people.length === 0) return null;
  const total = people.reduce((sum, p) => sum + p.sweetsSpend, 0) || 1;
  const colorFor = (i: number) => PERSON_COLORS[i % PERSON_COLORS.length];

  return (
    <View style={[s.card, { backgroundColor: c.bg.card }]}>
      <View style={s.header}>
        <Users size={14} color="#EC4899" />
        <Text style={s.title}>Kto zjadł słodycze</Text>
        <Text style={s.month}>{monthLabel}</Text>
      </View>

      {/* share bar */}
      <View style={s.bar}>
        {people.map((p, i) => (
          <View key={p.person} style={{ flex: Math.max(0.02, p.sweetsSpend / total), backgroundColor: colorFor(i) }} />
        ))}
      </View>

      {/* per-person rows */}
      <View style={{ gap: spacing[2], marginTop: spacing[3] }}>
        {people.map((p, i) => (
          <View key={p.person} style={s.row}>
            <View style={[s.dot, { backgroundColor: colorFor(i) }]} />
            <Text style={s.name} numberOfLines={1}>{p.person}</Text>
            {p.topSweet && (
              <View style={s.fav}>
                <Text style={s.favEmoji}>{p.topSweet.emoji}</Text>
                <Text style={s.favName} numberOfLines={1}>{p.topSweet.name}</Text>
              </View>
            )}
            <Text style={s.spend}>{Math.round(p.sweetsSpend)} zł</Text>
            <Text style={s.pct}>{Math.round(p.sweetsSpend / total * 100)}%</Text>
          </View>
        ))}
      </View>

      {data.sharedPct >= 0.6 && (
        <View style={s.note}>
          <Info size={12} color={c.text.muted} />
          <Text style={s.noteTxt}>
            {data.anyTagged ? 'Część nieoznaczona — dzielona po równo.' : 'Nieoznaczone — dzielone po równo.'} Zaznacz „kto zjadł" na pozycji paragonu, żeby rozdzielić dokładnie.
          </Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
  card: { borderRadius: radius.xl, padding: spacing[4], borderWidth: 1, borderColor: c.border.default },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] },
  title: { fontSize: 14, fontWeight: '700', color: c.text.primary },
  month: { marginLeft: 'auto', fontSize: 11, fontWeight: '700', color: c.text.muted },
  bar: { flexDirection: 'row', height: 10, borderRadius: 6, overflow: 'hidden', gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  name: { fontSize: 13.5, fontWeight: '700', color: c.text.primary, minWidth: 64 },
  fav: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 },
  favEmoji: { fontSize: 14 },
  favName: { fontSize: 12, color: c.text.secondary, flexShrink: 1 },
  spend: { fontSize: 13, fontWeight: '800', color: c.text.primary, marginLeft: 'auto' },
  pct: { fontSize: 11, fontWeight: '700', color: c.text.muted, minWidth: 30, textAlign: 'right' },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: spacing[3], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: c.border.subtle },
  noteTxt: { flex: 1, fontSize: 11, color: c.text.muted, lineHeight: 15 },
});

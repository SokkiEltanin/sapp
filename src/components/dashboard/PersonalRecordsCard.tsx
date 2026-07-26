import { View, Text, StyleSheet } from 'react-native';
import { Trophy, Footprints, Moon, Flame, Smile, Scale } from 'lucide-react-native';
import { RecordItem } from '@/utils/personalRecords';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius } from '@/theme';

const ICONS: Record<string, any> = { footprints: Footprints, moon: Moon, flame: Flame, smile: Smile, scale: Scale };
const GOLD = '#FBBF24';

// „Rekordy życiowe" — kolekcjonerska półka all-time bestów. Duolingo-style: każdy rekord
// to KWADRAT z grubą wartością + podpisem + lekko widoczną ikoną w tle. Mono (wartość
// biała), a złoto to jedyny „dodatek" (trofeum w nagłówku + subtelne tło-ikonki) — bo to
// półka trofeów. Liczby z buildRecords (personalRecords.ts).
export default function PersonalRecordsCard({ records, cardBg }: { records: RecordItem[]; cardBg: string }) {
  const c = useColors();
  const s = makeS(c);
  if (records.length === 0) return null;
  return (
    <View style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.head}>
        <Trophy size={13} color={GOLD} />
        <Text style={s.title}>Rekordy życiowe</Text>
      </View>
      <View style={s.grid}>
        {records.map(r => {
          const Ic = ICONS[r.icon] ?? Trophy;
          return (
            <View key={r.key} style={s.tile}>
              <Ic size={74} color={GOLD} strokeWidth={1.4} style={s.bgIcon} />
              <Text style={s.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{r.value}</Text>
              <Text style={s.label} numberOfLines={2}>{r.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  card: { borderRadius: radius.xl, padding: spacing[4], borderWidth: 1, borderColor: c.border.card, gap: spacing[3] },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { fontSize: 11.5, fontWeight: '700', color: c.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  tile: {
    flexBasis: '47%', flexGrow: 1, minWidth: 130, aspectRatio: 1.5,
    backgroundColor: c.fill.subtle, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.subtle,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
    justifyContent: 'flex-end', overflow: 'hidden',
  },
  bgIcon: { position: 'absolute', top: -8, right: -6, opacity: 0.08 },
  value: { fontSize: 30, fontWeight: '900', color: c.text.primary, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  label: { fontSize: 11.5, fontWeight: '600', color: c.text.secondary, marginTop: 3, lineHeight: 15 },
}));

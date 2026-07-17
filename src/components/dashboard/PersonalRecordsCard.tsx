import { View, Text, StyleSheet } from 'react-native';
import { Trophy, Footprints, Moon, Flame, Smile, Scale } from 'lucide-react-native';
import { RecordItem } from '@/utils/personalRecords';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius } from '@/theme';

const ICONS: Record<string, any> = { footprints: Footprints, moon: Moon, flame: Flame, smile: Smile, scale: Scale };
const GOLD = '#FBBF24';

// "Rekordy życiowe" — a collectible shelf of all-time bests. Pure display; the numbers
// come from buildRecords (personalRecords.ts).
export default function PersonalRecordsCard({ records, cardBg }: { records: RecordItem[]; cardBg: string }) {
  const c = useColors();
  const s = makeS(c);
  if (records.length === 0) return null;
  return (
    <View style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.head}>
        <Trophy size={14} color={GOLD} />
        <Text style={s.title}>Rekordy życiowe</Text>
      </View>
      <View style={{ gap: spacing[2] }}>
        {records.map(r => {
          const Ic = ICONS[r.icon] ?? Trophy;
          return (
            <View key={r.key} style={s.row}>
              <View style={s.iconChip}><Ic size={15} color={GOLD} /></View>
              <Text style={s.label} numberOfLines={1}>{r.label}</Text>
              <Text style={s.value}>{r.value}</Text>
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
  title: { fontSize: 12, fontWeight: '800', color: c.text.primary, textTransform: 'uppercase', letterSpacing: 0.8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  iconChip: { width: 32, height: 32, borderRadius: 10, backgroundColor: GOLD + '18', borderWidth: 1, borderColor: GOLD + '3A', alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 13, fontWeight: '600', color: c.text.secondary },
  value: { fontSize: 15, fontWeight: '900', color: c.text.primary, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
}));

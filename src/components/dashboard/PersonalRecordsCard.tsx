import { View, Text, StyleSheet } from 'react-native';
import { Trophy, Footprints, Moon, Flame, Smile, Scale, Medal } from 'lucide-react-native';
import { RecordItem } from '@/utils/personalRecords';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius } from '@/theme';

const ICONS: Record<string, any> = { footprints: Footprints, moon: Moon, flame: Flame, smile: Smile, scale: Scale };
const GOLD = '#FBBF24';

// „Rekordy życiowe" — kolekcjonerska hala sław. Flagowy rekord (pierwszy z buildRecords)
// dostaje HERO na pełną szerokość ze złotym medalem i wielką wartością; reszta to siatka
// kwadratów z tłem-ikoną. Mono (wartości białe), złoto = jedyny „dodatek" (to półka
// trofeów). Liczby z buildRecords (personalRecords.ts).
export default function PersonalRecordsCard({ records, cardBg }: { records: RecordItem[]; cardBg: string }) {
  const c = useColors();
  const s = makeS(c);
  if (records.length === 0) return null;
  return (
    <View style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.head}>
        <Trophy size={13} color={GOLD} />
        <Text style={s.title}>Rekordy życiowe</Text>
        <View style={{ flex: 1 }} />
        <Text style={s.headCount}>{records.length}</Text>
      </View>

      {/* HERO — flagowy rekord ze złotym medalem */}
      {renderRec(records[0], true)}

      {records.length > 1 && (
        <View style={s.grid}>
          {records.slice(1).map(r => renderRec(r, false))}
        </View>
      )}
    </View>
  );

  function renderRec(r: RecordItem, hero: boolean) {
    const Ic = ICONS[r.icon] ?? Trophy;
    if (hero) {
      return (
        <View key={r.key} style={s.hero}>
          <Ic size={110} color={GOLD} strokeWidth={1.3} style={s.heroBgIcon} />
          <View style={s.medal}><Medal size={20} color="#12100F" strokeWidth={2.4} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.heroEyebrow}>NAJLEPSZY WYNIK</Text>
            <Text style={s.heroValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{r.value}</Text>
            <Text style={s.heroLabel} numberOfLines={2}>{r.label}</Text>
          </View>
        </View>
      );
    }
    return (
      <View key={r.key} style={s.tile}>
        <Ic size={74} color={GOLD} strokeWidth={1.4} style={s.bgIcon} />
        <Text style={s.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{r.value}</Text>
        <Text style={s.label} numberOfLines={2}>{r.label}</Text>
      </View>
    );
  }
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  card: { borderRadius: radius.xl, padding: spacing[4], borderWidth: 1, borderColor: c.border.card, gap: spacing[3] },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { fontSize: 11.5, fontWeight: '700', color: c.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  headCount: { fontSize: 12, fontWeight: '800', color: c.text.muted, fontVariant: ['tabular-nums'] },

  // HERO — flagowy rekord
  hero: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: GOLD + '14', borderRadius: radius.lg,
    borderWidth: 1, borderColor: GOLD + '3A',
    paddingHorizontal: spacing[4], paddingVertical: spacing[4],
    overflow: 'hidden',
  },
  heroBgIcon: { position: 'absolute', top: -14, right: -12, opacity: 0.14 },
  medal: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center',
  },
  heroEyebrow: { fontSize: 9.5, fontWeight: '800', color: GOLD, letterSpacing: 1, textTransform: 'uppercase' },
  heroValue: { fontSize: 32, fontWeight: '900', color: c.text.primary, letterSpacing: -1, fontVariant: ['tabular-nums'], marginTop: 1 },
  heroLabel: { fontSize: 12, fontWeight: '600', color: c.text.secondary, marginTop: 1, lineHeight: 16 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  tile: {
    flexBasis: '47%', flexGrow: 1, minWidth: 130, aspectRatio: 1.5,
    backgroundColor: c.fill.subtle, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.subtle,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
    justifyContent: 'flex-end', overflow: 'hidden',
  },
  bgIcon: { position: 'absolute', top: -8, right: -6, opacity: 0.15 },
  value: { fontSize: 30, fontWeight: '900', color: c.text.primary, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  label: { fontSize: 11.5, fontWeight: '600', color: c.text.secondary, marginTop: 3, lineHeight: 15 },
}));

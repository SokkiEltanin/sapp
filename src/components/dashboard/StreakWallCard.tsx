import { View, Text, StyleSheet } from 'react-native';
import { Flame, Droplets, Candy, Dumbbell, BookOpen, Moon, Cigarette, Wine, Footprints } from 'lucide-react-native';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius } from '@/theme';

export interface StreakItem { key: string; name: string; days: number }

// Faint background icon per streak — reads the name and picks something recognisable
// (a glass for water, a candy for sweets, a cigarette for a quit-smoking counter…).
function iconFor(name: string) {
  const n = name.toLowerCase();
  if (/wod|nawodn|szklan|hydr/.test(n)) return Droplets;
  if (/słodycz|slodycz|cukr|cukier|deser|baton|ciast/.test(n)) return Candy;
  if (/pap(ie)?ros|nikot|pali|fajk|vape|e-pap/.test(n)) return Cigarette;
  if (/alko|piw|wino|wódk|wodk|drink|browar/.test(n)) return Wine;
  if (/trening|siłown|silown|ćwicz|cwicz|gym|fit/.test(n)) return Dumbbell;
  if (/bieg|spacer|krok|chodz/.test(n)) return Footprints;
  if (/czyt|książk|ksiazk|nauk|lekcj/.test(n)) return BookOpen;
  if (/sen|spa|budz|wstawa/.test(n)) return Moon;
  return Flame;
}

// „Twoje serie" — Duolingo-style: każda seria to KWADRAT z grubą liczbą dni, podpisem
// pod spodem i lekko widoczną ikoną w tle. Mono (liczba biała, podpis stonowany) — kolor
// tylko przez subtelną ikonę-tło. Turbo minimalistyczne.
export default function StreakWallCard({ streaks, cardBg }: { streaks: StreakItem[]; cardBg: string }) {
  const c = useColors();
  const s = makeS(c);
  const rows = streaks.filter(x => x.days > 0).sort((a, b) => b.days - a.days).slice(0, 6);
  if (rows.length === 0) return null;
  return (
    <View style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.head}>
        <Flame size={13} color={c.text.secondary} />
        <Text style={s.title}>Twoje serie</Text>
      </View>
      <View style={s.grid}>
        {rows.map(r => {
          const Icon = iconFor(r.name);
          return (
            <View key={r.key} style={s.tile}>
              <Icon size={78} color={c.text.primary} strokeWidth={1.4} style={s.bgIcon} />
              <View style={s.numRow}>
                <Text style={s.num}>{r.days}</Text>
                <Text style={s.unit}>{r.days === 1 ? 'dzień' : 'dni'}</Text>
              </View>
              <Text style={s.label} numberOfLines={1}>{r.name}</Text>
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
  // 2 na rząd, lekko prostokątne — dużo miejsca na grubą liczbę + podpis.
  tile: {
    flexBasis: '47%', flexGrow: 1, minWidth: 130, aspectRatio: 1.5,
    backgroundColor: c.fill.subtle, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.subtle,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
    justifyContent: 'flex-end', overflow: 'hidden',
  },
  // lekko widoczna „rzecz" w tle — duża, w prawym górnym rogu, ledwo widoczna
  bgIcon: { position: 'absolute', top: -10, right: -8, opacity: 0.07 },
  numRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  num: { fontSize: 36, fontWeight: '900', color: c.text.primary, letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 12, fontWeight: '700', color: c.text.muted },
  label: { fontSize: 11.5, fontWeight: '600', color: c.text.secondary, marginTop: 3 },
}));

import { View, Text, StyleSheet } from 'react-native';
import { Flame } from 'lucide-react-native';
import { streakColor } from '@/components/counters/StreakFlame';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius } from '@/theme';

export interface StreakItem { key: string; name: string; days: number }

// "Twoje serie" — every active streak (habits + 'dni bez' counters) in one ranked wall,
// each with a flame whose colour heats up with the streak and a bar relative to the top
// streak. Rivalry with yourself.
export default function StreakWallCard({ streaks, cardBg }: { streaks: StreakItem[]; cardBg: string }) {
  const c = useColors();
  const s = makeS(c);
  const rows = streaks.filter(x => x.days > 0).sort((a, b) => b.days - a.days).slice(0, 6);
  if (rows.length === 0) return null;
  const max = rows[0].days;
  return (
    <View style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.head}>
        <Flame size={14} color="#FF6A00" fill="#FF6A00" />
        <Text style={s.title}>Twoje serie</Text>
      </View>
      <View style={{ gap: spacing[2] }}>
        {rows.map(r => {
          const col = streakColor(r.days);
          return (
            <View key={r.key} style={s.row}>
              <Flame size={16} color={col} fill={col} />
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <View style={s.top}>
                  <Text style={s.name} numberOfLines={1}>{r.name}</Text>
                  <Text style={[s.days, { color: col }]}>{r.days} {r.days === 1 ? 'dzień' : 'dni'}</Text>
                </View>
                <View style={s.track}><View style={[s.fill, { width: `${Math.max(6, (r.days / max) * 100)}%`, backgroundColor: col }]} /></View>
              </View>
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
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  name: { flex: 1, fontSize: 13, fontWeight: '700', color: c.text.primary },
  days: { fontSize: 12.5, fontWeight: '900', fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, backgroundColor: c.fill.subtle, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
}));

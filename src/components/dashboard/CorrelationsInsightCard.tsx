import { View, Text, StyleSheet } from 'react-native';
import { Network } from 'lucide-react-native';
import { Link, MetricKey } from '@/utils/dashboard/correlations';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';

const META: Record<MetricKey, { emoji: string; label: string }> = {
  sleep:  { emoji: '😴', label: 'Sen' },
  energy: { emoji: '⚡', label: 'Energia' },
  mood:   { emoji: '🙂', label: 'Humor' },
  sweets: { emoji: '🍬', label: 'Słodycze' },
  work:   { emoji: '💼', label: 'Praca' },
  steps:  { emoji: '👟', label: 'Kroki' },
};

function verdict(l: Link): string {
  const A = META[l.a].label.toLowerCase(), B = META[l.b].label.toLowerCase();
  return l.positive ? `więcej ${A} → więcej ${B}` : `więcej ${A} → mniej ${B}`;
}

// „Co na Ciebie wpływa" — najsilniejsze powiązania między metrykami self-care (Pearson).
export default function CorrelationsInsightCard({ links, cardBg }: { links: Link[]; cardBg: string }) {
  const s = makeS(useColors());
  return (
    <View style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.head}>
        <Network size={13} color="#A78BFA" />
        <Text style={s.title}>Co na Ciebie wpływa · 30 dni</Text>
      </View>

      {links.length === 0 ? (
        <Text style={s.empty}>Za mało danych. Loguj nastrój, sen i jedzenie kilka dni — pokażę, co z czym chodzi w parze.</Text>
      ) : links.map((l, i) => {
        const col = l.positive ? '#2AC68F' : '#F87171';
        return (
          <View key={i} style={s.row}>
            <Text style={s.emoji}>{META[l.a].emoji}</Text>
            <Text style={[s.arrow, { color: col }]}>{l.positive ? '→' : '⇥'}</Text>
            <Text style={s.emoji}>{META[l.b].emoji}</Text>
            <View style={s.mid}>
              <Text style={s.verdict} numberOfLines={1}>{verdict(l)}</Text>
              <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${Math.round(Math.abs(l.r) * 100)}%`, backgroundColor: col }]} />
              </View>
            </View>
            <Text style={[s.strength, { color: col }]}>{l.strength === 'silna' ? 'silne' : 'wyraźne'}</Text>
          </View>
        );
      })}

      {links.length > 0 && <Text style={s.note}>To korelacje, nie dowód przyczyny — ale dobry trop.</Text>}
    </View>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  card: { borderRadius: radius.xl, padding: spacing[4], borderWidth: 1, borderColor: c.border.card, gap: spacing[2] },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { flex: 1, fontFamily: fonts.label, fontSize: 11, color: c.text.primary, textTransform: 'uppercase', letterSpacing: 0.9 },
  empty: { fontSize: 12.5, color: c.text.muted, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  emoji: { fontSize: 18 },
  arrow: { fontSize: 16, fontWeight: '900', width: 16, textAlign: 'center' },
  mid: { flex: 1, minWidth: 0, gap: 3, marginLeft: 2 },
  verdict: { fontSize: 12.5, fontWeight: '700', color: c.text.primary },
  barTrack: { height: 5, borderRadius: 3, backgroundColor: c.bg.elevated, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  strength: { fontSize: 10.5, fontWeight: '800' },
  note: { fontSize: 10.5, color: c.text.muted, fontStyle: 'italic', marginTop: 2 },
}));

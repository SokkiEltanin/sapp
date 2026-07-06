import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Footprints, TrendingUp, TrendingDown, Trophy, Coins, Smile, Sparkles, ChevronRight } from 'lucide-react-native';
import { MonthCard } from '@/utils/monthCards';

// A Spotify-Wrapped-style COLLECTIBLE card for one month. The gradient + emoji
// stickers are deliberate decoration; the stats are real (sweets, steps, spend,
// and how the month ranks against the rest of the collection).

function fmt(n: number): string {
  return Math.round(n).toLocaleString('pl-PL');
}
function fmtSteps(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.0', '')}k`;
  return String(n);
}

export default function MonthWrappedCard({
  card, compact = false, onPress,
}: { card: MonthCard; compact?: boolean; onPress?: () => void }) {
  const chips: { icon: any; text: string; tone?: 'up' | 'down' | 'gold' }[] = [];
  if (card.spendRank === 1 && card.monthsTracked >= 2)
    chips.push({ icon: Trophy, text: 'Rekord wydatków', tone: 'gold' });
  else if (card.monthsTracked >= 3)
    chips.push({ icon: card.spendRank <= card.monthsTracked / 2 ? TrendingUp : TrendingDown,
      text: `${card.spendRank}. z ${card.monthsTracked} miesięcy`, tone: card.spendRank <= card.monthsTracked / 2 ? 'up' : 'down' });
  if (card.stepsVsAvgPct != null && Math.abs(card.stepsVsAvgPct) >= 5)
    chips.push({ icon: card.stepsVsAvgPct > 0 ? TrendingUp : TrendingDown,
      text: `Kroki ${card.stepsVsAvgPct > 0 ? '+' : ''}${card.stepsVsAvgPct}% vs śr.`,
      tone: card.stepsVsAvgPct > 0 ? 'up' : 'down' });
  if (card.isTopMood && card.avgMood != null)
    chips.push({ icon: Smile, text: `Najlepszy nastrój`, tone: 'gold' });
  if (card.spendVsPrevPct != null && Math.abs(card.spendVsPrevPct) >= 5 && chips.length < 3)
    chips.push({ icon: card.spendVsPrevPct < 0 ? TrendingDown : TrendingUp,
      text: `${card.spendVsPrevPct > 0 ? '+' : ''}${card.spendVsPrevPct}% vs poprz.`,
      tone: card.spendVsPrevPct < 0 ? 'up' : 'down' });

  const Body = (
    <LinearGradient
      colors={card.palette}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[st.card, compact && st.cardCompact, { borderColor: card.accent + '55' }]}
    >
      {/* faint oversized sticker as a watermark, top-right */}
      {card.stickers[0] ? <Text style={st.watermark}>{card.stickers[0]}</Text> : null}

      {/* header */}
      <View style={st.head}>
        <View style={{ flex: 1 }}>
          <View style={st.kicker}>
            <Sparkles size={12} color={card.accent} />
            <Text style={[st.kickerTxt, { color: card.accent }]}>
              {card.inProgress ? 'Karta w trakcie' : 'Karta miesiąca'} · #{card.index}
            </Text>
          </View>
          <Text style={st.month}>{card.monthName}</Text>
          <Text style={st.year}>{card.year}</Text>
        </View>
        <View style={st.stickerCol}>
          {card.stickers.slice(0, 4).map((s, i) => (
            <Text key={i} style={[st.sticker, { transform: [{ rotate: `${(i % 2 ? 8 : -8)}deg` }] }]}>{s}</Text>
          ))}
        </View>
      </View>

      {/* hero: steps */}
      <View style={st.heroRow}>
        <View style={st.heroStat}>
          <View style={st.heroIcon}><Footprints size={16} color="#fff" /></View>
          <View>
            <Text style={st.heroVal}>{fmtSteps(card.steps)}</Text>
            <Text style={st.heroKey}>kroków{card.stepsDays > 0 ? ` · ${card.stepsDays} dni` : ''}</Text>
          </View>
        </View>
        {card.earned > 0 && (
          <View style={st.heroStat}>
            <View style={st.heroIcon}><Coins size={16} color="#fff" /></View>
            <View>
              <Text style={st.heroVal}>{fmt(card.earned)}</Text>
              <Text style={st.heroKey}>zł zarobku</Text>
            </View>
          </View>
        )}
      </View>

      {/* favourite sweets */}
      {card.sweets.length > 0 && (
        <View style={st.sweets}>
          <Text style={st.sectionLabel}>Ulubione słodycze</Text>
          {card.sweets.map((s, i) => (
            <View key={i} style={st.sweetRow}>
              <Text style={st.sweetEmoji}>{s.emoji}</Text>
              <Text style={st.sweetName} numberOfLines={1}>{s.name}</Text>
              <Text style={st.sweetCount}>×{s.count}</Text>
            </View>
          ))}
        </View>
      )}

      {/* comparison chips */}
      {chips.length > 0 && (
        <View style={st.chips}>
          {chips.slice(0, 3).map((c, i) => {
            const C = c.icon;
            const tint = c.tone === 'gold' ? '#FDE047' : c.tone === 'down' ? '#FCA5A5' : '#86EFAC';
            return (
              <View key={i} style={[st.chip, { borderColor: tint + '66' }]}>
                <C size={11} color={tint} />
                <Text style={[st.chipTxt, { color: tint }]}>{c.text}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* headline + spend footer */}
      <View style={st.foot}>
        <Text style={st.headline} numberOfLines={2}>{card.headline}</Text>
        <View style={st.footBar}>
          <Text style={st.footSpend}>{fmt(card.totalSpend)} zł wydane</Text>
          {onPress && <View style={st.footLink}><Text style={st.footLinkTxt}>Kolekcja</Text><ChevronRight size={13} color="#fff" /></View>}
        </View>
      </View>
    </LinearGradient>
  );

  if (onPress) return <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.92, transform: [{ scale: 0.995 }] }}>{Body}</Pressable>;
  return Body;
}

const shadow = { textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 } as const;

const st = StyleSheet.create({
  card: {
    borderRadius: 22, padding: 18, borderWidth: 1, overflow: 'hidden',
  },
  cardCompact: { padding: 16 },
  watermark: { position: 'absolute', top: -18, right: -6, fontSize: 96, opacity: 0.14 },

  head: { flexDirection: 'row', alignItems: 'flex-start' },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  kickerTxt: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  month: { color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: -1, ...shadow },
  year: { color: 'rgba(255,255,255,0.75)', fontSize: 15, fontWeight: '700', marginTop: -2, ...shadow },
  stickerCol: { alignItems: 'flex-end', maxWidth: 84, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 2 },
  sticker: { fontSize: 24 },

  heroRow: { flexDirection: 'row', gap: 20, marginTop: 14 },
  heroStat: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  heroIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  heroVal: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.5, ...shadow },
  heroKey: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600', marginTop: -1 },

  sweets: { marginTop: 15, gap: 6 },
  sectionLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 1 },
  sweetRow: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 11, paddingVertical: 6, paddingHorizontal: 10 },
  sweetEmoji: { fontSize: 18 },
  sweetName: { color: '#fff', fontSize: 13.5, fontWeight: '700', flex: 1, ...shadow },
  sweetCount: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '800' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 20, paddingVertical: 4, paddingHorizontal: 9, backgroundColor: 'rgba(0,0,0,0.18)' },
  chipTxt: { fontSize: 11, fontWeight: '800' },

  foot: { marginTop: 16 },
  headline: { color: '#fff', fontSize: 14.5, fontWeight: '800', lineHeight: 19, ...shadow },
  footBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  footSpend: { color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '700' },
  footLink: { flexDirection: 'row', alignItems: 'center', gap: 1, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 20, paddingLeft: 11, paddingRight: 7, paddingVertical: 4 },
  footLinkTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
});

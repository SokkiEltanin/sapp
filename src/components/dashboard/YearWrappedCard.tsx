import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Footprints, Coins, Wallet, Crown, Sparkles } from 'lucide-react-native';
import { YearCard } from '@/utils/yearCards';
import { stepsToDistanceFact } from '@/utils/funComparisons';

// The crown of the collection: one grand card summarising a whole year, built from
// its month cards. Tier chips recap the rarity tiers the year's months earned —
// coloured dots, not emoji (emoji cheapened the wrapped cards).

const TIER_MEDALS: [keyof YearCard['tierCounts'], string][] = [
  ['grafitowa', '#B6C2CC'], ['szmaragdowa', '#7CF3C8'], ['lazurowa', '#A5DEF5'], ['indygowa', '#B4C4FF'], ['ametystowa', '#E4CCFF'],
];

function fmt(n: number): string { return Math.round(n).toLocaleString('pl-PL'); }
function fmtSteps(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.0', '')}k`;
  return String(n);
}

export default function YearWrappedCard({ card }: { card: YearCard }) {
  const enter = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(600),
      Animated.timing(shine, { toValue: 1, duration: 1050, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(shine, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.delay(2600),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  const shineX = shine.interpolate({ inputRange: [0, 1], outputRange: [-320, 470] });

  const medals = TIER_MEDALS.filter(([k]) => card.tierCounts[k] > 0);

  return (
    <Animated.View style={{
      opacity: enter,
      transform: [
        { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
        { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
      ],
    }}>
      <LinearGradient colors={card.palette} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.card, { borderColor: card.accent + 'AA' }]}>
        <View style={st.watermark} pointerEvents="none"><Crown size={104} color={card.accent} /></View>

        {/* a filled "ROK" pill + the big year number make this unmistakably the yearly
            summary, not one of the monthly cards stacked below it */}
        <View style={st.kicker}>
          <View style={[st.typePill, { backgroundColor: card.accent }]}>
            <Crown size={11} color="#1a1030" />
            <Text style={st.typePillTxt}>PODSUMOWANIE ROKU</Text>
          </View>
          <Text style={[st.kickerTxt, { color: card.accent }]}>{card.months} kart</Text>
        </View>
        <Text style={st.year}>{card.year}</Text>

        <View style={st.stats}>
          <Stat icon={<Footprints size={15} color="#fff" />} val={fmtSteps(card.totalSteps)} key1="kroków" />
          {card.totalEarned > 0 && <Stat icon={<Coins size={15} color="#fff" />} val={fmt(card.totalEarned)} key1="zł zarobku" />}
          <Stat icon={<Wallet size={15} color="#fff" />} val={fmt(card.totalSpend)} key1="zł wydane" />
        </View>

        {stepsToDistanceFact(card.totalSteps) ? (
          <View style={st.factRow}>
            <Sparkles size={12} color={card.accent} />
            <Text style={st.factTxt} numberOfLines={2}>{stepsToDistanceFact(card.totalSteps)}</Text>
          </View>
        ) : null}

        {card.topSweet && (
          <View style={st.sweetRow}>
            <Text style={st.sweetLabel}>Słodycz roku</Text>
            <Text style={st.sweetName} numberOfLines={1}>{card.topSweet.name}</Text>
            <Text style={st.sweetCount}>×{card.topSweet.count}</Text>
          </View>
        )}

        {medals.length > 0 && (
          <View style={st.medals}>
            {medals.map(([k, color]) => (
              <View key={k} style={st.medal}>
                <View style={[st.medalDot, { backgroundColor: color }]} />
                <Text style={st.medalCount}>×{card.tierCounts[k]}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={st.headline} numberOfLines={2}>{card.headline}</Text>

        <Animated.View pointerEvents="none" style={[st.sheen, { transform: [{ translateX: shineX }, { rotate: '18deg' }] }]}>
          <LinearGradient colors={['transparent', 'rgba(255,255,255,0.28)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}

function Stat({ icon, val, key1 }: { icon: React.ReactNode; val: string; key1: string }) {
  return (
    <View style={st.stat}>
      <View style={st.statIcon}>{icon}</View>
      <View>
        <Text style={st.statVal}>{val}</Text>
        <Text style={st.statKey}>{key1}</Text>
      </View>
    </View>
  );
}

const shadow = { textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 } as const;

const st = StyleSheet.create({
  card: { borderRadius: 22, padding: 18, borderWidth: 1, overflow: 'hidden' },
  watermark: { position: 'absolute', top: -14, right: -8, opacity: 0.16 },
  sheen: { position: 'absolute', top: -60, bottom: -60, width: 130 },

  kicker: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  kickerTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' },
  typePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  typePillTxt: { fontSize: 10, fontWeight: '900', color: '#1a1030', letterSpacing: 0.7 },
  year: { color: '#fff', fontSize: 44, fontWeight: '900', letterSpacing: -1.5, ...shadow },

  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 12 },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: 'rgba(255,255,255,0.11)', borderRadius: 12, paddingVertical: 7, paddingHorizontal: 11 },
  factTxt: { flex: 1, color: '#fff', fontSize: 12, fontWeight: '600', ...shadow },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  statVal: { color: '#fff', fontSize: 19, fontWeight: '900', letterSpacing: -0.5, ...shadow },
  statKey: { color: 'rgba(255,255,255,0.75)', fontSize: 10.5, fontWeight: '600', marginTop: -1 },

  sweetRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: 12, paddingVertical: 7, paddingHorizontal: 11, marginTop: 14 },
  sweetLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  sweetName: { color: '#fff', fontSize: 13.5, fontWeight: '700', flex: 1, textAlign: 'right', ...shadow },
  sweetCount: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '800' },

  medals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13 },
  medal: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 20, paddingVertical: 3, paddingHorizontal: 8 },
  medalDot: { width: 9, height: 9, borderRadius: 5 },
  medalCount: { color: '#fff', fontSize: 12, fontWeight: '800' },

  headline: { color: '#fff', fontSize: 14.5, fontWeight: '800', lineHeight: 19, marginTop: 15, ...shadow },
});

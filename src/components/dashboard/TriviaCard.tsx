import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FlaskConical, BookOpen, Lightbulb, Globe, Sparkles, RefreshCw } from 'lucide-react-native';
import { TRIVIA, TriviaCat } from '@/data/trivia';
import PressableScale from '@/components/ui/PressableScale';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius } from '@/theme';
import { haptic } from '@/utils/haptics';

const META: Record<TriviaCat, { icon: any; label: string; color: string }> = {
  nauka:   { icon: FlaskConical, label: 'Nauka',     color: '#46B0DE' },
  ksiazka: { icon: BookOpen,     label: 'Z książki', color: '#A855F7' },
  rozwoj:  { icon: Lightbulb,    label: 'Rozwój',    color: '#2AC68F' },
  swiat:   { icon: Globe,        label: 'Świat',     color: '#E0A33A' },
};

// deterministic "trivia of the day" so it's stable across re-renders on the same day
function dayIndex(): number {
  const d = new Date();
  const doy = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
  return (doy * 7 + d.getFullYear()) % TRIVIA.length;
}

// "Ciekawostka" — one curated fact (science / book insight / self-dev / world), rotating
// daily, tap the shuffle button for another. The user asked for this; content in trivia.ts.
export default function TriviaCard({ cardBg }: { cardBg: string }) {
  const c = useColors();
  const s = makeS(c);
  const [idx, setIdx] = useState(dayIndex);
  const t = TRIVIA[idx];
  const m = META[t.cat];
  const Ic = m.icon;

  const next = () => {
    haptic.tap();
    let n = idx;
    while (n === idx && TRIVIA.length > 1) n = Math.floor(Math.random() * TRIVIA.length);
    setIdx(n);
  };

  return (
    <View style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.head}>
        <Sparkles size={13} color={m.color} />
        <Text style={s.title}>Ciekawostka</Text>
        <PressableScale onPress={next}>
          <View style={s.nextBtn}><RefreshCw size={14} color={c.text.muted} /></View>
        </PressableScale>
      </View>

      <View style={[s.catRow, { backgroundColor: m.color + '18', borderColor: m.color + '3A' }]}>
        <Ic size={13} color={m.color} />
        <Text style={[s.catTxt, { color: m.color }]}>{m.label}</Text>
      </View>

      <Text style={s.text}>{t.text}</Text>
      {t.src ? <Text style={s.src}>— {t.src}</Text> : null}
    </View>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  card: { borderRadius: radius.xl, padding: spacing[4], borderWidth: 1, borderColor: c.border.card, gap: spacing[2] },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { flex: 1, fontSize: 12, fontWeight: '800', color: c.text.primary, textTransform: 'uppercase', letterSpacing: 0.8 },
  nextBtn: { width: 30, height: 30, borderRadius: 9, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center' },
  catRow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  catTxt: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4 },
  text: { fontSize: 14, lineHeight: 20, color: c.text.primary, fontWeight: '500' },
  src: { fontSize: 12, color: c.text.muted, fontStyle: 'italic' },
}));

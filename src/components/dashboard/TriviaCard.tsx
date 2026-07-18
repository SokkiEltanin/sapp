import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FlaskConical, BookOpen, Lightbulb, Globe, Sparkles, RefreshCw } from 'lucide-react-native';
import { TRIVIA, Trivia, TriviaCat } from '@/data/trivia';
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

const KEY = 'trivia_state_v1';
const MAX_SHOWS = 4;   // each fact appears at most 4× before it's "archived"

// Stable key per fact from its text, so counts survive reordering / adding items.
function keyOf(t: Trivia): string {
  let h = 0;
  for (let i = 0; i < t.text.length; i++) h = (Math.imul(h, 31) + t.text.charCodeAt(i)) | 0;
  return String(h >>> 0);
}
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface Persist { counts: Record<string, number>; currentKey: string | null; day: string | null }

// Pick a fact that hasn't hit MAX_SHOWS yet (the "active pool"), excluding the current
// one. When everything is archived, reset the counts and start the cycle over — so you
// see variety and never the same few facts on a loop. Increments the picked fact.
function advance(counts: Record<string, number>, excludeKey: string | null): { key: string; counts: Record<string, number> } {
  let pool = TRIVIA.filter(t => (counts[keyOf(t)] ?? 0) < MAX_SHOWS && keyOf(t) !== excludeKey);
  if (pool.length === 0) {
    counts = {};                                            // all archived → new cycle
    pool = TRIVIA.filter(t => keyOf(t) !== excludeKey);
    if (pool.length === 0) pool = [...TRIVIA];
  }
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const k = keyOf(pick);
  return { key: k, counts: { ...counts, [k]: (counts[k] ?? 0) + 1 } };
}

// "Ciekawostka" — one curated fact (science / book insight / self-dev / world). One per
// day by default (counted once when first shown that day) + a shuffle button, each fact
// capped at 4 appearances then archived. Content in trivia.ts.
export default function TriviaCard({ cardBg }: { cardBg: string }) {
  const c = useColors();
  const s = makeS(c);
  const [st, setSt] = useState<Persist | null>(null);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY).then(raw => {
      let p: Persist = raw ? JSON.parse(raw) : { counts: {}, currentKey: null, day: null };
      const today = todayStr();
      const valid = p.currentKey && TRIVIA.some(t => keyOf(t) === p.currentKey);
      if (p.day !== today || !valid) {
        const r = advance(p.counts ?? {}, p.currentKey ?? null);   // new day → fresh fact
        p = { counts: r.counts, currentKey: r.key, day: today };
        AsyncStorage.setItem(KEY, JSON.stringify(p)).catch(() => {});
      }
      if (alive) setSt(p);
    }).catch(() => { if (alive) setSt({ counts: {}, currentKey: keyOf(TRIVIA[0]), day: todayStr() }); });
    return () => { alive = false; };
  }, []);

  const next = () => {
    if (!st) return;
    haptic.tap();
    const r = advance(st.counts, st.currentKey);
    const p: Persist = { counts: r.counts, currentKey: r.key, day: todayStr() };
    setSt(p);
    AsyncStorage.setItem(KEY, JSON.stringify(p)).catch(() => {});
  };

  const t = st ? (TRIVIA.find(x => keyOf(x) === st.currentKey) ?? TRIVIA[0]) : TRIVIA[0];
  const m = META[t.cat];
  const Ic = m.icon;

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

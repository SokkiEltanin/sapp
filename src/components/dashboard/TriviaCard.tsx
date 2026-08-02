import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FlaskConical, BookOpen, Lightbulb, Globe, Sparkles } from 'lucide-react-native';
import { TRIVIA, Trivia, TriviaCat } from '@/data/trivia';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';

const META: Record<TriviaCat, { icon: any; label: string; color: string }> = {
  nauka:   { icon: FlaskConical, label: 'Nauka',     color: '#46B0DE' },
  ksiazka: { icon: BookOpen,     label: 'Z książki', color: '#A855F7' },
  rozwoj:  { icon: Lightbulb,    label: 'Rozwój',    color: '#2AC68F' },
  swiat:   { icon: Globe,        label: 'Świat',     color: '#E0A33A' },
};

const KEY = 'trivia_state_v1';
const MAX_SHOWS = 2;         // każda ciekawostka pokaże się MAX 2× w całości, potem „archiwum"
const REPEAT_GAP_DAYS = 30;  // …i min. 30 dni przerwy między 1. a 2. pokazem (user: powtarzały się za szybko)

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
// dni między dwiema datami YYYY-MM-DD (b − a); Infinity gdy brak/niepoprawna data = „przerwa spełniona"
function daysBetween(a: string | undefined, b: string): number {
  if (!a) return Infinity;
  const t0 = Date.parse(a + 'T00:00:00');
  const t1 = Date.parse(b + 'T00:00:00');
  if (isNaN(t0) || isNaN(t1)) return Infinity;
  return Math.round((t1 - t0) / 86400000);
}

interface Persist {
  counts: Record<string, number>;
  lastShown?: Record<string, string>;   // key → data ostatniego pokazu (YYYY-MM-DD)
  currentKey: string | null;
  day: string | null;
}

// Wybierz ciekawostkę spełniającą OBA warunki: pokazana < MAX_SHOWS razy ORAZ ostatnio
// pokazana ≥ REPEAT_GAP_DAYS temu (albo nigdy). Gdy nic nie spełnia przerwy — bierzemy
// najdawniej widzianą z nie-wyczerpanych (relaksujemy przerwę, ale nie limit 2×). Gdy
// WSZYSTKO wyczerpane (2×) — nowy wielki cykl (reset counts), wciąż respektując świeżość.
function advance(
  counts: Record<string, number>,
  lastShown: Record<string, string>,
  excludeKey: string | null,
  today: string,
): { key: string; counts: Record<string, number>; lastShown: Record<string, string> } {
  const notMaxed = TRIVIA.filter(t => (counts[keyOf(t)] ?? 0) < MAX_SHOWS && keyOf(t) !== excludeKey);
  let pool = notMaxed.filter(t => daysBetween(lastShown[keyOf(t)], today) >= REPEAT_GAP_DAYS);
  if (pool.length === 0) {
    if (notMaxed.length > 0) {
      // wszystkie nie-wyczerpane pokazane za świeżo → weź NAJDAWNIEJ widzianą (max możliwa przerwa)
      pool = [...notMaxed].sort((a, b) =>
        (lastShown[keyOf(a)] ?? '') < (lastShown[keyOf(b)] ?? '') ? -1 : 1).slice(0, 1);
    } else {
      counts = {};                                          // wszystko po 2× → nowy cykl
      const fresh = TRIVIA.filter(t => keyOf(t) !== excludeKey);
      pool = fresh.filter(t => daysBetween(lastShown[keyOf(t)], today) >= REPEAT_GAP_DAYS);
      if (pool.length === 0) pool = fresh.length ? fresh : [...TRIVIA];
    }
  }
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const k = keyOf(pick);
  return {
    key: k,
    counts: { ...counts, [k]: (counts[k] ?? 0) + 1 },
    lastShown: { ...lastShown, [k]: today },
  };
}

// "Ciekawostka" — one curated fact (science / book insight / self-dev / world). One per
// day (counted once when first shown that day). Każdy fakt pokaże się MAX 2× w historii,
// z min. 30-dniową przerwą między pokazami. Treść w trivia.ts.
export default function TriviaCard({ cardBg }: { cardBg: string }) {
  const c = useColors();
  const s = makeS(c);
  const [st, setSt] = useState<Persist | null>(null);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY).then(raw => {
      let p: Persist = raw ? JSON.parse(raw) : { counts: {}, lastShown: {}, currentKey: null, day: null };
      const today = todayStr();
      const valid = p.currentKey && TRIVIA.some(t => keyOf(t) === p.currentKey);
      if (p.day !== today || !valid) {
        const r = advance(p.counts ?? {}, p.lastShown ?? {}, p.currentKey ?? null, today);   // new day → fresh fact
        p = { counts: r.counts, lastShown: r.lastShown, currentKey: r.key, day: today };
        AsyncStorage.setItem(KEY, JSON.stringify(p)).catch(() => {});
      }
      if (alive) setSt(p);
    }).catch(() => { if (alive) setSt({ counts: {}, lastShown: {}, currentKey: keyOf(TRIVIA[0]), day: todayStr() }); });
    return () => { alive = false; };
  }, []);

  const t = st ? (TRIVIA.find(x => keyOf(x) === st.currentKey) ?? TRIVIA[0]) : TRIVIA[0];
  const m = META[t.cat];
  const Ic = m.icon;

  return (
    <View style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.head}>
        <Sparkles size={13} color={c.text.secondary} />
        <Text style={s.title}>Ciekawostka dnia</Text>
        {/* kategoria równo w prawym górnym rogu kafelka */}
        <View style={[s.catChip, { backgroundColor: m.color + '18', borderColor: m.color + '3A' }]}>
          <Ic size={11} color={m.color} />
          <Text style={[s.catTxt, { color: m.color }]}>{m.label}</Text>
        </View>
      </View>

      <Text style={s.text}>{t.text}</Text>
      {t.src ? <Text style={s.src}>— {t.src}</Text> : null}
    </View>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  card: { borderRadius: radius.xl, padding: spacing[4], borderWidth: 1, borderColor: c.border.card, gap: spacing[2] },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { flex: 1, fontFamily: fonts.label, fontSize: 11, color: c.text.primary, textTransform: 'uppercase', letterSpacing: 0.9 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  catTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  text: { fontSize: 14, lineHeight: 20, color: c.text.primary, fontWeight: '500' },
  src: { fontSize: 12, color: c.text.muted, fontStyle: 'italic' },
}));

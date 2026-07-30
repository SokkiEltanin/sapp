import { memo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Flame, Droplets, Candy, Dumbbell, BookOpen, Moon, Cigarette, Wine, Footprints, Snowflake } from 'lucide-react-native';
import { useStreakFreezeStore } from '@/store/streakFreezeStore';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';
import { streakTier } from '@/components/counters/StreakFlame';
import { toast } from '@/store/toastStore';
import { haptic } from '@/utils/haptics';

export interface StreakItem { key: string; name: string; days: number }

const SEEN_KEY = 'streak_tiers_v1';

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

// 2-char hex alpha from 0..1
const a2 = (o: number) => Math.round(Math.max(0, Math.min(1, o)) * 255).toString(16).padStart(2, '0');

// „Twoje serie" — Duolingo-style: każda seria to KWADRAT zabarwiony na kolor swojego progu
// (bordo → czerwień → pomarańcz → róż → błękit → fiolet legenda). Im dłuższa seria, tym
// intensywniejsze tło. Gruba biała liczba + podpis + lekko widoczna ikona w tle. Po
// przekroczeniu progu — pop „gratulacje" (toast + haptik).
function StreakWallCard({ streaks, cardBg }: { streaks: StreakItem[]; cardBg: string }) {
  const c = useColors();
  const s = makeS(c);
  const freezes = useStreakFreezeStore(st => st.freezes);
  const rows = streaks.filter(x => x.days > 0).sort((a, b) => b.days - a.days).slice(0, 6);

  // Celebracja progu — porównaj bieżące progi z ostatnio widzianymi. Pierwsze uruchomienie
  // tylko zapisuje baseline (bez spamu toastów). Odpala się raz na montaż.
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current || rows.length === 0) return;
    fired.current = true;
    (async () => {
      let raw: string | null = null;
      try { raw = await AsyncStorage.getItem(SEEN_KEY); } catch {}
      const seen: Record<string, number> = raw ? JSON.parse(raw) : {};
      const isFirst = !raw;
      const nextSeen: Record<string, number> = { ...seen };
      let best: { name: string; days: number; tierName: string; ti: number } | null = null;
      for (const r of rows) {
        const t = streakTier(r.days);
        const prev = seen[r.key] ?? -1;
        // celebruj tylko realne kamienie milowe (≥7 dni = tier ≥ 1), gdy próg wzrósł
        if (!isFirst && t.i > prev && t.i >= 1 && (!best || t.i > best.ti)) {
          best = { name: r.name, days: r.days, tierName: t.name, ti: t.i };
        }
        nextSeen[r.key] = t.i;
      }
      try { await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(nextSeen)); } catch {}
      if (best) {
        haptic.success();
        const bang = best.ti >= 5 ? 'LEGENDA' : 'Nowy próg';
        toast.success(`🔥 ${best.name}: ${best.days} dni — ${bang}: ${best.tierName}!`);
      }
    })();
  }, [rows.length]);

  if (rows.length === 0) return null;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={() => { haptic.tap(); router.push('/habits' as any); }}
      style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.head}>
        <Flame size={13} color={c.text.secondary} />
        <Text style={s.title}>Twoje serie</Text>
        <View style={{ flex: 1 }} />
        {freezes > 0 && (
          <View style={s.freezePill}>
            <Snowflake size={11} color="#7DD3FC" />
            <Text style={s.freezeTxt}>{freezes}</Text>
          </View>
        )}
        <Text style={s.headCount}>{rows.length}</Text>
      </View>

      {/* SIATKA — WSZYSTKIE serie jako jednolite kwadraty, 2 na rząd (jak w Duolingo) */}
      <View style={s.grid}>
        {rows.map(r => renderTile(r))}
      </View>
    </TouchableOpacity>
  );

  function renderTile(r: StreakItem) {
    const Icon = iconFor(r.name);
    const t = streakTier(r.days);
    const frac = t.next ? Math.min(1, Math.max(0, (r.days - t.min) / (t.next - t.min))) : 1;
    const bgA = a2(0.16 + 0.20 * frac);
    const nextName = t.next ? streakTier(t.next).name : null;
    const onTile = () => {
      haptic.tap();
      if (r.key.startsWith('h:')) router.push(`/habit-year?id=${r.key.slice(2)}` as any);
      else if (r.key.startsWith('c:')) router.push(`/habit-year?counter=${r.key.slice(2)}` as any);
      else router.push('/counters' as any);
    };
    return (
      <TouchableOpacity key={r.key} activeOpacity={0.85} onPress={onTile}
        style={[s.tile, { backgroundColor: t.color + bgA, borderColor: t.color + '66' }]}>
        {/* tło = obrazek CZEGO dotyczy seria (woda/cukierek/ogień…) — BIAŁE, widać na kolorze */}
        <Icon size={78} color="#FFFFFF" strokeWidth={1.3} style={s.bgIcon} />
        {/* płomień serii — top-left */}
        <View style={s.flameChip}>
          <Flame size={13} color="#FFFFFF" fill="#FFFFFF" strokeWidth={1.5} />
        </View>
        {/* badge „ligi" — nazwa progu (BORDO → … → LEGENDA) */}
        <View style={[s.league, { borderColor: t.color + '77' }]}>
          <Text style={[s.leagueTxt, { color: '#FFFFFF' }]} numberOfLines={1}>{t.name}</Text>
        </View>
        <View style={s.numRow}>
          <Text style={s.num}>{r.days}</Text>
          <Text style={s.unit}>{r.days === 1 ? 'dzień' : 'dni'}</Text>
        </View>
        <Text style={s.label} numberOfLines={1}>{r.name}</Text>
        <View style={s.track}>
          <View style={[s.fill, { width: `${Math.round(frac * 100)}%` }]} />
        </View>
        <Text style={s.next} numberOfLines={1}>
          {t.next ? `${t.next - r.days} dni → ${nextName}` : 'MAKS 🏆'}
        </Text>
      </TouchableOpacity>
    );
  }
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  card: { borderRadius: radius.xl, padding: spacing[4], borderWidth: 1, borderColor: c.border.card, gap: spacing[3] },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { fontFamily: fonts.label, fontSize: 11, color: c.text.secondary, textTransform: 'uppercase', letterSpacing: 1 },
  headCount: { fontSize: 12, fontWeight: '800', color: c.text.muted, fontVariant: ['tabular-nums'] },
  freezePill: { flexDirection: 'row', alignItems: 'center', gap: 3, marginRight: 8, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: '#7DD3FC1E', borderWidth: 1, borderColor: '#7DD3FC44' },
  freezeTxt: { fontSize: 11, fontWeight: '800', color: '#7DD3FC', fontVariant: ['tabular-nums'] },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  // JEDNOLITE KWADRATY, 2 na rząd. BEZ flexGrow → samotny kafel zostaje pół-szerokości
  // (nie rozciąga się na cały ekran). aspectRatio ~1 = kwadrat jak w Duolingo.
  tile: {
    flexBasis: '47.5%', minWidth: 128, aspectRatio: 1.05,
    borderRadius: radius.lg, borderWidth: 1,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
    justifyContent: 'flex-end', overflow: 'hidden',
  },
  // lekko widoczna „rzecz" w tle — duża, w prawym górnym rogu (biała → widać na kolorze)
  bgIcon: { position: 'absolute', top: -10, right: -8, opacity: 0.22 },
  // płomień serii — lewy górny róg
  flameChip: { position: 'absolute', top: 8, left: 8, opacity: 0.92 },
  // badge „ligi" (nazwa progu) — prawy górny róg, collectible identity
  league: {
    position: 'absolute', top: 8, right: 8,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999,
    borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.28)',
  },
  leagueTxt: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' },
  numRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  num: { fontFamily: fonts.display, fontSize: 33, color: '#FFFFFF', letterSpacing: -0.5 },
  unit: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.75)' },
  label: { fontFamily: fonts.label, fontSize: 10.5, color: 'rgba(255,255,255,0.92)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.6 },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden', marginTop: 7 },
  fill: { height: '100%', borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.9)' },
  next: { fontSize: 9.5, fontWeight: '700', color: 'rgba(255,255,255,0.7)', marginTop: 4, letterSpacing: 0.2 },
}));

export default memo(StreakWallCard);

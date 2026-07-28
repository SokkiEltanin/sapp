import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Flame, Droplets, Candy, Dumbbell, BookOpen, Moon, Cigarette, Wine, Footprints } from 'lucide-react-native';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius } from '@/theme';
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
export default function StreakWallCard({ streaks, cardBg }: { streaks: StreakItem[]; cardBg: string }) {
  const c = useColors();
  const s = makeS(c);
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
    <View style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.head}>
        <Flame size={13} color={c.text.secondary} />
        <Text style={s.title}>Twoje serie</Text>
        <View style={{ flex: 1 }} />
        <Text style={s.headCount}>{rows.length}</Text>
      </View>

      {/* HERO — najdłuższa seria dostaje pełną szerokość + wielką liczbę + ligę */}
      {renderTile(rows[0], true)}

      {/* SIATKA — reszta serii, 2 na rząd */}
      {rows.length > 1 && (
        <View style={s.grid}>
          {rows.slice(1).map(r => renderTile(r, false))}
        </View>
      )}
    </View>
  );

  function renderTile(r: StreakItem, hero: boolean) {
    const Icon = iconFor(r.name);
    const t = streakTier(r.days);
    const frac = t.next ? Math.min(1, Math.max(0, (r.days - t.min) / (t.next - t.min))) : 1;
    const bgA = a2((hero ? 0.18 : 0.14) + 0.20 * frac);
    const nextName = t.next ? streakTier(t.next).name : null;
    return (
      <View key={r.key} style={[hero ? s.heroTile : s.tile, { backgroundColor: t.color + bgA, borderColor: t.color + '66' }]}>
        <Icon size={hero ? 128 : 78} color={t.color} strokeWidth={1.3} style={hero ? s.heroBgIcon : s.bgIcon} />
        {/* badge „ligi" — nazwa progu (BORDO → … → LEGENDA) = collectible identity */}
        <View style={[s.league, { borderColor: t.color + '77' }]}>
          <Text style={[s.leagueTxt, { color: '#FFFFFF' }]} numberOfLines={1}>{t.name}</Text>
        </View>
        <View style={s.numRow}>
          <Text style={hero ? s.heroNum : s.num}>{r.days}</Text>
          <Text style={hero ? s.heroUnit : s.unit}>{r.days === 1 ? 'dzień' : 'dni'}</Text>
        </View>
        <Text style={hero ? s.heroLabel : s.label} numberOfLines={1}>{r.name}</Text>
        <View style={s.track}>
          <View style={[s.fill, { width: `${Math.round(frac * 100)}%` }]} />
        </View>
        <Text style={s.next} numberOfLines={1}>
          {t.next ? `jeszcze ${t.next - r.days} dni → ${nextName}` : 'MAKS · legenda 🏆'}
        </Text>
      </View>
    );
  }
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  card: { borderRadius: radius.xl, padding: spacing[4], borderWidth: 1, borderColor: c.border.card, gap: spacing[3] },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { fontSize: 11.5, fontWeight: '700', color: c.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  headCount: { fontSize: 12, fontWeight: '800', color: c.text.muted, fontVariant: ['tabular-nums'] },

  // HERO — najdłuższa seria, pełna szerokość, wielka liczba
  heroTile: {
    borderRadius: radius.lg, borderWidth: 1,
    paddingHorizontal: spacing[4], paddingVertical: spacing[4],
    justifyContent: 'flex-end', overflow: 'hidden', minHeight: 128,
  },
  heroBgIcon: { position: 'absolute', top: -18, right: -10, opacity: 0.14 },
  heroNum: { fontSize: 56, fontWeight: '900', color: '#FFFFFF', letterSpacing: -2.5, fontVariant: ['tabular-nums'] },
  heroUnit: { fontSize: 15, fontWeight: '800', color: 'rgba(255,255,255,0.8)' },
  heroLabel: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.95)', marginTop: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  // 2 na rząd, lekko prostokątne — dużo miejsca na grubą liczbę + podpis + pasek.
  tile: {
    flexBasis: '47%', flexGrow: 1, minWidth: 130, aspectRatio: 1.36,
    borderRadius: radius.lg, borderWidth: 1,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
    justifyContent: 'flex-end', overflow: 'hidden',
  },
  // lekko widoczna „rzecz" w tle — duża, w prawym górnym rogu, ledwo widoczna
  bgIcon: { position: 'absolute', top: -10, right: -8, opacity: 0.16 },
  // badge „ligi" (nazwa progu) — prawy górny róg, collectible identity
  league: {
    position: 'absolute', top: 8, right: 8,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999,
    borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.28)',
  },
  leagueTxt: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' },
  numRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  num: { fontSize: 34, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.75)' },
  label: { fontSize: 11.5, fontWeight: '600', color: 'rgba(255,255,255,0.92)', marginTop: 3 },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden', marginTop: 7 },
  fill: { height: '100%', borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.9)' },
  next: { fontSize: 9.5, fontWeight: '700', color: 'rgba(255,255,255,0.7)', marginTop: 4, letterSpacing: 0.2 },
}));

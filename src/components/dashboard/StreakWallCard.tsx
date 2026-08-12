import { memo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Flame, Snowflake } from 'lucide-react-native';
import { useStreakFreezeStore } from '@/store/streakFreezeStore';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';
import StreakFlame, { streakTier } from '@/components/counters/StreakFlame';
import { toast } from '@/store/toastStore';
import { haptic } from '@/utils/haptics';

export interface StreakItem { key: string; name: string; days: number }

const SEEN_KEY = 'streak_tiers_v1';

// „Twoje serie" — Duolingo-style: kolor kafla wg progu serii (bordo → czerwień → pomarańcz
// → róż → błękit → fiolet legenda), im dłuższa seria tym "gorętszy" kolor. User (2026-08-12,
// po zobaczeniu Duolingo): kafelek ma zostać PROSTY — sama liczba + od czego jest, reszta
// (próg/pasek do następnego/historia) żyje po stuknięciu na /habit-year (kalendarz roku tej
// serii — już istniał, tylko kafel wcześniej próbował upchnąć te same info skrótowo obok
// niego). Płomień = StreakFlame (już zbudowany, animowany, ten sam schemat kolorów) zamiast
// osobnego chipa + statycznej ikony w tle. Po przekroczeniu progu — pop „gratulacje" (toast).
function StreakWallCard({ streaks, cardBg }: { streaks: StreakItem[]; cardBg: string }) {
  const c = useColors();
  const s = makeS(c);
  const freezes = useStreakFreezeStore(st => st.freezes);
  // BEZ ucinania do 6 — ucięcie chowało realne, poprawnie policzone serie (np. 18-dniowa
  // Woda spadała poniżej progu, gdy inne nawyki/liczniki miały dłuższe serie) bez ŻADNEGO
  // sygnału że coś zostało ukryte (nagłówek pokazywał już PO ucięciu). User zgłosił 2026-08-12.
  const rows = streaks.filter(x => x.days > 0).sort((a, b) => b.days - a.days);

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
    const t = streakTier(r.days);
    const onTile = () => {
      haptic.tap();
      if (r.key.startsWith('h:')) router.push(`/habit-year?id=${r.key.slice(2)}` as any);
      else if (r.key.startsWith('c:')) router.push(`/habit-year?counter=${r.key.slice(2)}` as any);
      else router.push('/counters' as any);
    };
    return (
      <TouchableOpacity key={r.key} activeOpacity={0.85} onPress={onTile}
        style={[s.tile, { backgroundColor: t.color + '20', borderColor: t.color + '55' }]}>
        <StreakFlame days={r.days} size={50} />
        <Text style={s.label} numberOfLines={1}>{r.name}</Text>
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
  // (nie rozciąga się na cały ekran). Uproszczone (2026-08-12) — sam StreakFlame (liczba +
  // animowany płomień) + etykieta, wyśrodkowane; próg/pasek/historia żyją po stuknięciu
  // (habit-year), nie tutaj.
  tile: {
    flexBasis: '47.5%', minWidth: 128, aspectRatio: 1.62,
    borderRadius: radius.lg, borderWidth: 1,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    alignItems: 'center', justifyContent: 'center', gap: 4,
    overflow: 'hidden',
  },
  label: { fontFamily: fonts.label, fontSize: 11, color: c.text.secondary, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
}));

export default memo(StreakWallCard);

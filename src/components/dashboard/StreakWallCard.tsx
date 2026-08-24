import { memo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Snowflake } from 'lucide-react-native';
import { useStreakFreezeStore } from '@/store/streakFreezeStore';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';
import { StreakFlameGlow, streakTier, streakColor } from '@/components/counters/StreakFlame';
import { toast } from '@/store/toastStore';
import { haptic } from '@/utils/haptics';

export interface StreakItem { key: string; name: string; days: number }

const SEEN_KEY = 'streak_tiers_v1';

// Second gradient stop for a tile — same hue, mixed toward black for depth.
export function darken(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - amt));
  const g = Math.round(((n >> 8) & 255) * (1 - amt));
  const b = Math.round((n & 255) * (1 - amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// „Twoje serie" — dawniej osobna, przesuwalna sekcja dashboardu (siatka WSZYSTKICH serii).
// (2026-08-24, user: "zróbmy te ilość seri jako łączny kafelek z pupilem po prostu po prawej
// stronie oke??") — WKLEJONA jako prawa kolumna kafla pupila (`index.tsx` `nodes['pet']`)
// zamiast osobnej karty: pokazuje tylko NAJDŁUŻSZĄ serię (reszta pod "+N" w rogu), stuknięcie
// dalej prowadzi do /habits po pełną listę. Nagłówek/tytuł/pełna siatka 2× N zniknęły — miejsca
// starcza tylen na jeden kafel obok kotka. Celebracja progu (toast przy przekroczeniu
// 7/14/30/60/100 dni) BEZ ZMIAN — liczy się po WSZYSTKICH seriach, nie tylko tej pokazanej.
function StreakWallCard({ streaks }: { streaks: StreakItem[] }) {
  const c = useColors();
  const s = makeS(c);
  const freezes = useStreakFreezeStore(st => st.freezes);
  const rows = [...streaks].sort((a, b) => b.days - a.days);

  // Celebracja progu — bez zmian względem poprzedniej wersji karty.
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
  const top = rows[0];
  const rest = rows.length - 1;
  const color = streakColor(top.days);
  const isZero = top.days < 1;

  const content = (
    <>
      <View style={s.flame} pointerEvents="none">
        <StreakFlameGlow days={top.days} size={44} />
      </View>
      {freezes > 0 && (
        <View style={s.freezePill}>
          <Snowflake size={9} color="#7DD3FC" />
          <Text style={s.freezeTxt}>{freezes}</Text>
        </View>
      )}
      {rest > 0 && (
        <View style={s.morePill}><Text style={s.moreTxt}>+{rest}</Text></View>
      )}
      <Text style={[s.num, { color: isZero ? c.text.muted : '#FFFFFF' }]}>{top.days}</Text>
      <Text style={[s.label, { color: isZero ? c.text.muted : 'rgba(255,255,255,0.88)' }]} numberOfLines={1}>{top.name}</Text>
    </>
  );

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={() => { haptic.tap(); router.push('/habits' as any); }} style={s.touch}>
      {isZero ? (
        <View style={[s.tile, s.tileZero]}>{content}</View>
      ) : (
        <LinearGradient colors={[color, darken(color, 0.16)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tile}>
          {content}
        </LinearGradient>
      )}
    </TouchableOpacity>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  touch: { width: 100, alignSelf: 'stretch' },
  tile: {
    flex: 1, minHeight: 76, borderRadius: radius.lg,
    paddingHorizontal: spacing[2], paddingTop: spacing[2], paddingBottom: spacing[1],
    overflow: 'hidden', position: 'relative', justifyContent: 'flex-end',
  },
  tileZero: { backgroundColor: '#23273A', borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.border.subtle },
  flame: { position: 'absolute', right: -10, bottom: -8 },
  freezePill: { position: 'absolute', top: 5, left: 5, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.3)' },
  freezeTxt: { fontSize: 9, fontWeight: '800', color: '#7DD3FC' },
  morePill: { position: 'absolute', top: 5, right: 5, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.3)' },
  moreTxt: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },
  num: { fontFamily: fonts.display, fontSize: 20, letterSpacing: -0.5, lineHeight: 22 },
  label: { fontFamily: fonts.label, fontSize: 8.5, fontWeight: '800', letterSpacing: 0.2, textTransform: 'uppercase', marginTop: 1 },
}));

export default memo(StreakWallCard);

import { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Hourglass } from 'lucide-react-native';
import { router } from 'expo-router';
import { Counter } from '@/store/countersStore';
import { streakTier, streakColor } from '@/components/counters/StreakFlame';
import RadialGlow from '@/components/ui/RadialGlow';
import DisplayText from '@/components/ui/DisplayText';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';
import { haptic } from '@/utils/haptics';
import { plPlural } from '@/utils/plural';
import { useSinceCountersTileStyleStore, SinceCountersTileStyle, SinceCounterLayoutPreset } from '@/store/sinceCountersTileStyleStore';

// Wyciągnięte 1:1 z `app/(tabs)/index.tsx` `nodes['counters-since']` (2026-08-26, kolejny
// mały krok rozbicia dashboardu — patrz NEXT_STEPS.md/ARCHITECTURE.md §4 dla wzorca i
// historii). Guard `.length > 0 &&` ZOSTAJE w `index.tsx` (edytor dashboardu czyta
// `nodes[id]`'s truthiness). Style `card`/`cardHeader`/`cardTitle`/`workToggleText`
// skopiowane verbatim (współdzielone z innymi sekcjami).
//
// Runda 3 (2026-09-25, user zrzutem: "to ma być ile dni temu coś robiłem, a to wygląda i
// pokazuje jak seria jakaś... napraw raz a dobrze") — runda 2 (2026-09-24, "przerób na
// highend") przerobiła TYLKO wiersze `since.slice(1,7)` na duża-liczba+poświata, ale
// zostawiła PIERWSZY (najdłuższy) wpis renderowany przez `<StreakCard>` (flame-chip + pasek
// dni tygodnia/miesiąca) — dokładnie komponent "Ściana serii" z osobnego widgetu. Z JEDNYM
// licznikiem na koncie (typowy przypadek na start) TEN wpis to ZAWSZE "najdłuższy", więc user
// nigdy nie widział nowego designu, tylko starą, dosłowną "serię" — to dokładnie to, czego
// user NIE chciał (ręczny licznik "ile dni temu X" nie jest habitem do "utrzymania passy").
// Fix: WSZYSTKIE wpisy (włącznie z pierwszym) renderują się TERAZ jednolicie przez ten sam
// wiersz duża-liczba+poświata — żadnego specjalnego "hero" traktowania dla najdłuższego,
// `StreakCard` (import usunięty stąd) zostaje wyłącznie w §widget "Ściana serii"
// (`nodes['streak-wall']`/`StreakWallCard`), gdzie faktyczne auto-streaki należą.
export interface SinceCounterEntry { cn: Counter; days: number }

export interface SinceCountersCardProps {
  since: SinceCounterEntry[];
  cardBg: string;
  accentColor: string;
  // Kreator dashboardu, Faza 11 (§337) — kreator przekazuje `draft`, prawdziwy dashboard
  // (app/(tabs)/index.tsx) tego propu NIE podaje, więc czyta `live` ze store'u (zero zmian w
  // istniejącym call site, patrz ten sam wzorzec w StreakWallCard/PersonalRecordsCard/CountdownsCard).
  styleOverride?: SinceCountersTileStyle;
}

function SinceCountersCard({ since, cardBg, accentColor, styleOverride }: SinceCountersCardProps) {
  const c = useColors();
  const s = makeS(c);
  const liveStyle = useSinceCountersTileStyleStore(st => st.live);
  const tileStyle = styleOverride ?? liveStyle;
  if (since.length === 0) return null;
  return (
    <View style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.cardHeader}>
        <Hourglass size={13} color={accentColor} />
        <Text style={s.cardTitle}>Liczniki</Text>
        <TouchableOpacity onPress={() => { haptic.tap(); router.navigate('/counters' as any); }} style={{ marginLeft: 'auto' }} activeOpacity={0.7}>
          <Text style={[s.workToggleText, { color: accentColor }]}>Wszystkie</Text>
        </TouchableOpacity>
      </View>
      <View style={{ gap: spacing[2] }}>
        {since.slice(0, tileStyle.maxVisible).map(({ cn, days }) => {
          // 2026-09-26, audyt dashboardu — `streakTier(days).color` dawał Bordo (czerwień) NA
          // ZERZE (streakTier() domyślnie zwraca indeks 0 gdy ŻADEN próg nie jest spełniony —
          // ten sam bug co StreakWallCard.tsx już naprawił, patrz komentarz tam), więc świeżo
          // zresetowany licznik ("Zrobione dziś") świecił się na czerwono zamiast wyglądać na
          // "zimny"/neutralny. `streakColor()` ma poprawny fallback (szary) dla days<1.
          const isZero = days < 1;
          const tier = streakTier(days);
          const tc = streakColor(days);
          // `index.tsx`'s `dashSince` filtruje TERAZ `mode !== 'auto'` (2026-09-26, audyt —
          // auto-liczniki mają być WYŁĄCZNIE w "Twoje Serie") — ten wiersz zawsze dostaje
          // ręczny licznik, `bez ${name}` byłoby tu martwą gałęzią.
          const label = cn.name;
          const metaTxt = isZero
            ? `${streakTier(1).name} · próg za 1 dzień`
            : tier.next != null
              ? `${tier.name} · próg za ${tier.next - days} ${plPlural(tier.next - days, 'dzień', 'dni', 'dni')}`
              : `${tier.name} · najwyższy próg`;
          const onPress = () => { haptic.tap(); router.push(`/counters/${cn.id}` as any); };
          const preset: SinceCounterLayoutPreset = tileStyle.layoutPreset ?? 'row';

          // 'bar' (§362) — pasek postępu DO NASTĘPNEGO PROGU serii, treść unikalna dla liczników
          // (odliczania mają postęp do daty, serie nie mają nic takiego) — próg to JEDYNA
          // "wartość docelowa" jaką licznik faktycznie ma.
          if (preset === 'bar') {
            const pct = tier.next != null ? Math.min(100, Math.max(0, Math.round(((days - tier.min) / (tier.next - tier.min)) * 100))) : 100;
            return (
              <TouchableOpacity key={cn.id} style={[s.barRow, { borderRadius: tileStyle.rowRadius }]} onPress={onPress} activeOpacity={0.75}>
                <View style={s.barHeadRow}>
                  <Text style={s.sinceName} numberOfLines={1}>{label}</Text>
                  <Text style={[s.sinceMetaStrong, { color: tc }]} numberOfLines={1}>{days} {plPlural(days, 'dzień', 'dni', 'dni')}</Text>
                </View>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${pct}%`, backgroundColor: tc }]} />
                </View>
                <Text style={s.sinceMeta} numberOfLines={1}>{metaTxt}</Text>
              </TouchableOpacity>
            );
          }

          if (preset === 'compact') {
            return (
              <TouchableOpacity key={cn.id} style={s.compactRow} onPress={onPress} activeOpacity={0.75}>
                <Text numberOfLines={1} style={s.compactTxt}>
                  <Text style={[s.compactNum, { color: tc }]}>{days}</Text>
                  <Text style={s.compactName}> {label}</Text>
                  <Text style={s.compactMeta}> — {metaTxt}</Text>
                </Text>
              </TouchableOpacity>
            );
          }

          if (preset === 'minimal') {
            return (
              <TouchableOpacity key={cn.id} style={s.minimalRow} onPress={onPress} activeOpacity={0.75}>
                <DisplayText style={[s.sinceNum, { color: tc, fontSize: 28 * tileStyle.numberScale, minWidth: 0 }]}>{days}</DisplayText>
                <Text style={s.sinceName} numberOfLines={1}>{label}</Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity key={cn.id} style={[s.sinceRow, { backgroundColor: tc + '0F', borderColor: tc + '26', borderRadius: tileStyle.rowRadius }]}
              onPress={onPress} activeOpacity={0.75}>
              {tileStyle.showGlow && (
                <View style={s.sinceGlowWrap} pointerEvents="none">
                  <RadialGlow size={110} color={tc} opacity={0.18} />
                </View>
              )}
              <DisplayText style={[s.sinceNum, { color: tc, fontSize: 30 * tileStyle.numberScale, minWidth: 46 * tileStyle.numberScale }]}>{days}</DisplayText>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.sinceName} numberOfLines={1}>{label}</Text>
                <Text style={s.sinceMeta} numberOfLines={1}>{metaTxt}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  card: {
    backgroundColor: c.bg.card,
    borderRadius: radius.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: c.border.card,
    gap: spacing[3],
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
  cardTitle: { fontFamily: fonts.label, fontSize: 11, color: c.text.secondary, textTransform: 'uppercase', letterSpacing: 0.9, flexShrink: 1 },
  workToggleText: { fontSize: 10, fontWeight: '700' },
  sinceRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3], borderRadius: radius.lg, borderWidth: 1,
    paddingVertical: spacing[3], paddingHorizontal: spacing[3], overflow: 'hidden', position: 'relative',
  },
  sinceGlowWrap: { position: 'absolute', left: -26, top: '50%', marginTop: -55 },
  sinceNum: { fontSize: 30, letterSpacing: -1, minWidth: 46 },
  sinceName: { fontSize: 14, fontWeight: '700', color: c.text.primary },
  sinceMeta: { fontSize: 11, fontWeight: '600', color: c.text.muted, marginTop: 1 },
  sinceMetaStrong: { fontSize: 13, fontWeight: '800', marginTop: 0 },

  // 'bar' (§362) — pasek postępu do następnego progu, kolumna zamiast rzędu.
  barRow: { gap: 5, paddingVertical: spacing[2], paddingHorizontal: spacing[2] },
  barHeadRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing[2] },
  barTrack: { height: 6, borderRadius: radius.full, backgroundColor: c.bg.elevated, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.full },

  // 'compact' (§362) — jedna linijka, zero grafiki.
  compactRow: { paddingVertical: 3 },
  compactTxt: { fontSize: 12.5 },
  compactNum: { fontWeight: '800' },
  compactName: { fontWeight: '800', color: c.text.primary },
  compactMeta: { color: c.text.muted, fontWeight: '600' },

  // 'minimal' (§362) — goła duża liczba + nazwa, bez poświaty/meta.
  minimalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[1] },
}));

export default memo(SinceCountersCard);

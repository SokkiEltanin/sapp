import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Flame } from 'lucide-react-native';
import { StreakTileStyle, FlameCorner } from '@/store/streakTileStyleStore';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';
import { StreakFlameGlow, streakTier, streakColor } from '@/components/counters/StreakFlame';
import RingCountdown from '@/components/counters/RingCountdown';
import DisplayText from '@/components/ui/DisplayText';
import { haptic } from '@/utils/haptics';
import { StreakItem } from './StreakWallCard';

// Dokąd prowadzi tapnięcie kafla serii — WSPÓLNA reguła, bo trafia teraz w DWA miejsca:
// `StreakWallCard`'s `onTile` (prawdziwy dashboard) i `ScreenCanvas`'s tryb podglądu (system
// kopiowania komponentów, §341 — instancja na innym ekranie, poza edycją, zachowuje się jak
// prawdziwa kopia: tapnięcie prowadzi TAM GDZIE prowadziłoby na dashboardzie, nie nigdzie).
// Wyekstrahowane tutaj (nie duplikowane po raz trzeci) — `habitCalendarOverrides` z
// `tileStyle` działa identycznie w obu miejscach, bo to ten sam typ `StreakTileStyle`
// (per-instancja na płótnie, globalny na dashboardzie — rozróżnienie nieistotne dla routingu).
export function navigateForStreakItem(item: StreakItem, tileStyle: StreakTileStyle) {
  haptic.tap();
  if (item.key.startsWith('h:')) {
    const habitId = item.key.slice(2);
    const navStyle = tileStyle.habitCalendarOverrides?.[habitId] ?? (item.kind === 'water' ? 'water' : 'year');
    router.push((navStyle === 'water' ? `/water-calendar?id=${habitId}` : `/habit-year?id=${habitId}`) as any);
  }
  else if (item.key.startsWith('c:')) router.push(`/habit-year?counter=${item.key.slice(2)}` as any);
  else if (item.key.startsWith('ex:')) router.push('/exercises-history' as any);
  else router.push('/counters' as any);
}

// Second gradient stop for a tile — same hue, mixed toward black for depth.
function darken(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - amt));
  const g = Math.round(((n >> 8) & 255) * (1 - amt));
  const b = Math.round((n & 255) * (1 - amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

const FLAME_CORNER_POS: Record<FlameCorner, { top?: number; bottom?: number; left?: number; right?: number }> = {
  br: { right: -12, bottom: -10 },
  bl: { left: -12, bottom: -10 },
  tr: { right: -12, top: -10 },
  tl: { left: -12, top: -10 },
};

// Wyekstrahowane z `StreakWallCard.tsx`'s dawnej wewnętrznej `renderTile()` (system kopiowania
// komponentów, §340+, 2026-10-16) — user wprost: "żebym mógł to jako komponent zrobić". Zero
// zmiany zachowania/wyglądu na realnym dashboardzie — `StreakWallCard` niżej importuje i woła
// TEN komponent dla każdego kafla w swojej siatce, 1:1 ta sama logika/JSX co wcześniej. Różnice
// od oryginału: `r` → `item`, `onTile` → `onPress` (teraz PROP, nie zamknięcie wewnątrz —
// `StreakWallCard` wciąż przekazuje nawigację do `/habit-year` itp., ale `ScreenCanvas` na
// innych ekranach przekazuje INNE zachowanie, np. otwarcie pickera metryki), i `sizeStyle`
// (teraz PROP — `StreakWallCard`'s siatka przekazuje `flexBasis`+`aspectRatio`, `ScreenCanvas`
// przekazuje `position:'absolute'`+`width`+`height`; sam komponent nie zakłada ŻADNEJ sztywnej
// wielkości, wnętrze (`tile`/`ringTile`/`stripeTile`/`compactTile`) ma `flex:1` i wypełnia
// dowolny box, jaki dostanie od wołającego).
export function StreakTile({ item: rawItem, tileStyle, onPress, sizeStyle }: {
  item: StreakItem;
  tileStyle: StreakTileStyle;
  onPress: () => void;
  sizeStyle?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const s = makeS(c);

  // Twarda ochrona (§408, user zrzutem: "buguje się chyba streak ćwiczeń" — pełny, poprawnie
  // ukolorowany kafelek, ale ZUPEŁNIE bez liczby/etykiety). Statyczna analiza całej ścieżki
  // danych (`exerciseStreakFrom`/`streakTier`/`streakColor`) nie znalazła KONKRETNEGO miejsca,
  // które mogłoby wyprodukować złą wartość — ale to i tak poprawny, bezkosztowy hardening:
  // `item.days` było dotąd renderowane WPROST jako `{item.days}`, ufając że to zawsze
  // skończona, nieujemna liczba. Gdyby kiedykolwiek nie było (NaN/Infinity z jakiegoś upstream
  // buga), RN potrafi po cichu NIE wyrenderować tekstu zamiast pokazać "NaN"/się wywalić —
  // dokładnie pasujący objaw. Klamrowanie TUTAJ (jedno miejsce, `item` cieniuje oryginał więc
  // reszta pliku poniżej jest nietknięta) gwarantuje że kafelek ZAWSZE pokaże poprawną,
  // skończoną liczbę (0 w najgorszym wypadku — poprawny, "wygaszony" wygląd), niezależnie od
  // tego co dostarczy wołający. `name` dostaje ten sam fallback z tego samego powodu.
  const item: StreakItem = {
    ...rawItem,
    days: Number.isFinite(rawItem.days) ? Math.max(0, Math.round(rawItem.days)) : 0,
    name: rawItem.name || '—',
  };

  // streakTier() domyślnie zwraca indeks 0 (Bordo) gdy ŻADEN próg nie jest spełniony — też przy
  // 0 dniach. streakColor() ma osobny, poprawny fallback (szary) dla days<1 — patrz oryginalny
  // komentarz w StreakWallCard.tsx (historia zachowana tam, nie powielana tu po słowie).
  // `?.` na `tierColorOverrides`/`habitCalendarOverrides` (2026-10-17, user zrzutem: crash na
  // wejściu na dashboard) — crash u realnego usera, przyczyna: stary `persist` merge w
  // streakTileStyleStore.ts PODMIENIAŁ cały `live`/`draft` z telefonu zamiast scalać pole-po-polu,
  // więc user, który otworzył dashboard ZANIM te dwa pola istniały w `StreakTileStyle`, miał je
  // trwale `undefined` mimo nowszego kodu. Fix właściwy w store'cie (merge, patrz
  // tileStyleMerge.ts) — `?.` tu to tylko druga linia obrony, gdyby coś INNEGO kiedyś dostarczyło
  // niepełny `StreakTileStyle` (np. płótno kopiowania komponentów).
  const isZero = item.days < 1;
  const color = isZero ? streakColor(item.days) : (tileStyle.tierColorOverrides?.[streakTier(item.days).i] ?? streakColor(item.days));
  const tier = streakTier(item.days);
  const tierProgress = !isZero && tier.next != null
    ? Math.min(1, Math.max(0, (item.days - tier.min) / (tier.next - tier.min)))
    : null;

  if (tileStyle.layoutPreset === 'ring') {
    const ringProgress = isZero ? 0 : (tierProgress ?? 1);
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={sizeStyle}>
        <View style={[s.ringTile, { borderRadius: tileStyle.cornerRadius }]}>
          <RingCountdown progress={ringProgress} color={isZero ? c.text.muted : color} days={item.days} size={52} strokeWidth={5} />
          <Text style={[s.ringLabel, { color: isZero ? c.text.muted : c.text.primary }]} numberOfLines={1}>{item.name}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (tileStyle.layoutPreset === 'stripe') {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={sizeStyle}>
        <View style={[s.stripeTile, {
          borderRadius: tileStyle.cornerRadius,
          borderLeftColor: isZero ? c.text.muted : color,
          alignItems: tileStyle.contentAlign === 'center' ? 'center' : 'flex-start',
        }]}>
          {tileStyle.showFlame && (
            <View style={s.stripeGhost} pointerEvents="none">
              <Flame size={74} color={isZero ? c.text.muted : color} fill={isZero ? c.text.muted : color} strokeWidth={0} />
            </View>
          )}
          <DisplayText style={[s.tileNum, { color: isZero ? c.text.muted : c.text.primary, fontSize: 24 * tileStyle.numberScale, lineHeight: 26 * tileStyle.numberScale }]}>{item.days}</DisplayText>
          <Text style={[s.stripeLabel, { color: c.text.secondary, textAlign: tileStyle.contentAlign }]} numberOfLines={1}>{item.name}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (tileStyle.layoutPreset === 'compact') {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={sizeStyle}>
        <View style={[s.compactTile, { borderRadius: tileStyle.cornerRadius }]}>
          <Flame size={15} color={isZero ? c.text.muted : color} fill={isZero ? c.text.muted : color} strokeWidth={0} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <DisplayText style={[s.compactNum, { color: isZero ? c.text.muted : c.text.primary, fontSize: 17 * tileStyle.numberScale, lineHeight: 19 * tileStyle.numberScale }]}>{item.days}</DisplayText>
            <Text style={s.compactLabel} numberOfLines={1}>{item.name}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // Klasyczny — Duolingo-porównanie: duży płomień "naklejka" w rogu + duża liczba, pełny
  // gradient koloru progu. Zero dni: płaskie, wygaszone, przerywana ramka — bez gradientu.
  const radiusStyle = { borderRadius: tileStyle.cornerRadius };
  const alignStyle = { alignItems: tileStyle.contentAlign === 'center' ? ('center' as const) : ('flex-start' as const) };
  const flame = tileStyle.showFlame && (
    <View style={[s.tileFlame, FLAME_CORNER_POS[tileStyle.flameCorner]]} pointerEvents="none">
      <StreakFlameGlow days={item.days} size={64} />
    </View>
  );
  const text = (
    <>
      <DisplayText style={[s.tileNum, { color: isZero ? c.text.muted : '#FFFFFF', fontSize: 24 * tileStyle.numberScale, lineHeight: 26 * tileStyle.numberScale }]}>{item.days}</DisplayText>
      <Text style={[s.tileLabel, { color: isZero ? c.text.muted : 'rgba(255,255,255,0.88)', textAlign: tileStyle.contentAlign }]} numberOfLines={1}>{item.name}</Text>
      {tierProgress != null && tileStyle.showProgressBar && (
        <View style={s.tierBarTrack} pointerEvents="none">
          <View style={[s.tierBarFill, { width: `${tierProgress * 100}%` }]} />
        </View>
      )}
    </>
  );
  const content = tileStyle.flameOnTop ? <>{text}{flame}</> : <>{flame}{text}</>;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={sizeStyle}>
      {isZero ? (
        <View style={[s.tile, s.tileZero, radiusStyle, alignStyle]}>{content}</View>
      ) : tileStyle.gradientMode === 'flat' ? (
        <View style={[s.tile, radiusStyle, alignStyle, { backgroundColor: color }]}>{content}</View>
      ) : (
        <LinearGradient colors={[color, darken(color, 0.16)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.tile, radiusStyle, alignStyle]}>
          {content}
        </LinearGradient>
      )}
    </TouchableOpacity>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  tile: {
    flex: 1, borderRadius: radius.lg,
    paddingHorizontal: spacing[2], paddingTop: spacing[2], paddingBottom: spacing[1],
    overflow: 'hidden', position: 'relative',
  },
  tileZero: { backgroundColor: '#23273A', borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.border.subtle },
  tileFlame: { position: 'absolute', right: -12, bottom: -10 },
  tierBarTrack: {
    position: 'absolute', left: spacing[2], right: spacing[2], bottom: 5,
    height: 3, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden',
  },
  tierBarFill: { height: '100%', borderRadius: radius.full, backgroundColor: '#FFFFFF' },
  tileNum: { fontSize: 24, letterSpacing: -0.5, lineHeight: 26 },
  tileLabel: { fontFamily: fonts.label, fontSize: 9, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase', marginTop: 1 },

  ringTile: { flex: 1, backgroundColor: c.bg.elevated, alignItems: 'center', justifyContent: 'center', gap: 4, padding: spacing[2] },
  ringLabel: { fontFamily: fonts.label, fontSize: 10, fontWeight: '700', textAlign: 'center' },

  stripeTile: {
    flex: 1, backgroundColor: c.bg.elevated, borderLeftWidth: 3, overflow: 'hidden', position: 'relative',
    paddingHorizontal: spacing[2], paddingTop: spacing[2], paddingBottom: spacing[1],
  },
  stripeGhost: { position: 'absolute', right: -14, bottom: -12, opacity: 0.14 },
  stripeLabel: { fontFamily: fonts.label, fontSize: 9, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase', marginTop: 1 },

  compactTile: {
    flex: 1, backgroundColor: c.bg.elevated, flexDirection: 'row', alignItems: 'center',
    gap: 6, paddingHorizontal: spacing[2],
  },
  compactNum: { letterSpacing: -0.5 },
  compactLabel: { fontFamily: fonts.label, fontSize: 8.5, color: c.text.muted, marginTop: 1 },
}));

import { memo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Flame, Snowflake } from 'lucide-react-native';
import { useStreakFreezeStore } from '@/store/streakFreezeStore';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';
import { StreakFlameGlow, streakTier, streakColor } from '@/components/counters/StreakFlame';
import { toast } from '@/store/toastStore';
import { haptic } from '@/utils/haptics';

export interface StreakItem { key: string; name: string; days: number }

const SEEN_KEY = 'streak_tiers_v1';

// Second gradient stop for a tile — same hue, mixed toward black for depth (matches the
// diagonal-gradient pattern MonthWrappedCard already uses for its cards).
function darken(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - amt));
  const g = Math.round(((n >> 8) & 255) * (1 - amt));
  const b = Math.round((n & 255) * (1 - amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

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
  // BEZ ucinania do 6 (2026-08-12, wcześniejszy fix) I BEZ filtrowania zerowych serii
  // (2026-08-12, ten fix) — user: "jak nie ma streaku pisze zero na dniach". Dawniej
  // `days > 0` chowało złamane serie całkowicie (np. zjadłeś słodycz dziś → licznik "bez
  // słodyczy" spadł na 0 → kafelek znikał zamiast pokazać 0 i zachęcić do zaczęcia od nowa —
  // dokładnie odwrotność motywacyjnego efektu Duolingo). Teraz pokazujemy WSZYSTKO co ma
  // nawyk/licznik, posortowane malejąco (zera lądują na końcu naturalnie).
  const rows = [...streaks].sort((a, b) => b.days - a.days);

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
    // streakTier() domyślnie zwraca indeks 0 (Bordo, ciemna czerwień) gdy ŻADEN próg nie
    // jest spełniony — czyli też przy 0 dniach, mimo że 0 nie powinno "być" żadnym tierem.
    // streakColor() ma osobny, poprawny fallback (szary) dla days<1 — tego trzeba użyć do
    // KOLORU kafla, inaczej złamana seria świeci się na czerwono zamiast wyglądać na "zimną".
    const color = streakColor(r.days);
    const isZero = r.days < 1;
    const onTile = () => {
      haptic.tap();
      if (r.key.startsWith('h:')) router.push(`/habit-year?id=${r.key.slice(2)}` as any);
      else if (r.key.startsWith('c:')) router.push(`/habit-year?counter=${r.key.slice(2)}` as any);
      else router.push('/counters' as any);
    };
    // Duolingo-porównanie (2026-08-12, artifact 91003a5a): duży płomień "naklejka" w rogu +
    // duża liczba w lewym górnym rogu, kafel to pełny gradient koloru progu (nie 20%-owy
    // tint jak wcześniej). Zero dni: płaskie, wygaszone, przerywana ramka — bez gradientu.
    const content = (
      <>
        <View style={s.tileFlame} pointerEvents="none">
          <StreakFlameGlow days={r.days} size={64} />
        </View>
        <Text style={[s.tileNum, { color: isZero ? c.text.muted : '#FFFFFF' }]}>{r.days}</Text>
        <Text style={[s.tileLabel, { color: isZero ? c.text.muted : 'rgba(255,255,255,0.88)' }]} numberOfLines={1}>{r.name}</Text>
      </>
    );
    return (
      <TouchableOpacity key={r.key} activeOpacity={0.85} onPress={onTile} style={s.tileTouch}>
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
  // (nie rozciąga się na cały ekran). tileTouch = tylko rozmiar/proporcje (żeby LinearGradient
  // i płaski zero-stan mogły dzielić dokładnie ten sam kształt); tile = wygląd.
  // Skurczone (2026-08-13, user: "kafelki są za długie") — niższy aspectRatio (szerszy
  // względem wysokości) + mniejszy minWidth, żeby cała sekcja nie zajmowała tyle miejsca
  // na dashboardzie przy kilku seriach naraz.
  tileTouch: { flexBasis: '47.5%', minWidth: 104, aspectRatio: 1.7 },
  tile: {
    flex: 1, borderRadius: radius.lg,
    paddingHorizontal: spacing[2], paddingTop: spacing[2], paddingBottom: spacing[1],
    overflow: 'hidden', position: 'relative',
  },
  tileZero: { backgroundColor: '#23273A', borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.border.subtle },
  tileFlame: { position: 'absolute', right: -12, bottom: -10 },
  // BEZ fontWeight — ArchivoBlack to already-heavy font (jedyny plik/waga zarejestrowana
  // w useFonts), a fontWeight obok custom fontFamily na Androidzie potrafi po cichu cofnąć
  // się do systemowego (cienkiego) fontu, bo RN szuka pliku "ArchivoBlack-Bold" którego nie
  // ma. Ten sam wzorzec co WSZĘDZIE indziej z fonts.display (TopPill/StreakCard/
  // PersonalRecordsCard/DailyRings) — tileNum był jedynym miejscem z dodanym fontWeight,
  // user (2026-08-13): "Twoje serie używają cienkiej czcionki dla LICZBY".
  tileNum: { fontFamily: fonts.display, fontSize: 24, letterSpacing: -0.5, lineHeight: 26 },
  tileLabel: { fontFamily: fonts.label, fontSize: 9, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase', marginTop: 1 },
}));

export default memo(StreakWallCard);

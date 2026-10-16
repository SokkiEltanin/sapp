import { memo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Flame, Snowflake } from 'lucide-react-native';
import { useStreakFreezeStore } from '@/store/streakFreezeStore';
import { useStreakTileStyleStore, StreakTileStyle } from '@/store/streakTileStyleStore';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';
import { streakTier } from '@/components/counters/StreakFlame';
import { toast } from '@/store/toastStore';
import { haptic } from '@/utils/haptics';
import { StreakTile } from './StreakTile';

// `kind` (2026-10-13, user: "woda jak wchodzę ze streaka jest inna [zakładka] niż na
// zdrowiu... ujednolicić") — jedyny powód tego pola: odróżnić nawyk "Woda" (ma WŁASNY,
// bogatszy kalendarz, `/water-calendar`) od reszty (generyczny `/habit-year`), patrz `onTile`
// niżej. Opcjonalne i nieużywane dla wpisów licznikowych (`c:`-prefiks).
export interface StreakItem { key: string; name: string; days: number; kind?: string }

const SEEN_KEY = 'streak_tiers_v1';

// „Twoje serie" — Duolingo-style: kolor kafla wg progu serii (bordo → czerwień → pomarańcz
// → róż → błękit → fiolet legenda), im dłuższa seria tym "gorętszy" kolor. User (2026-08-12,
// po zobaczeniu Duolingo): kafelek ma zostać PROSTY — sama liczba + od czego jest, reszta
// (próg/pasek do następnego/historia) żyje po stuknięciu na /habit-year (kalendarz roku tej
// serii — już istniał, tylko kafel wcześniej próbował upchnąć te same info skrótowo obok
// niego). Płomień = StreakFlame (już zbudowany, animowany, ten sam schemat kolorów) zamiast
// osobnego chipa + statycznej ikony w tle. Po przekroczeniu progu — pop „gratulacje" (toast).
// `styleOverride` (2026-10-15, Kreator dashboardu Faza 1) — normalnie NIE podawany: karta
// sama czyta `live` z `streakTileStyleStore` (ustawienia wdrożone w kreatorze). Kreator
// (`app/dashboard-tile-creator.tsx`) podaje tu `draft`, żeby renderować TEN SAM komponent co
// prawdziwy dashboard z jeszcze-niewdrożonym stylem — zero osobnej "makiety" do rozjeżdżania
// się z prawdziwym kodem.
function StreakWallCard({ streaks, cardBg, styleOverride }: { streaks: StreakItem[]; cardBg: string; styleOverride?: StreakTileStyle }) {
  const c = useColors();
  const s = makeS(c);
  const freezes = useStreakFreezeStore(st => st.freezes);
  const liveTileStyle = useStreakTileStyleStore(st => st.live);
  const tileStyle = styleOverride ?? liveTileStyle;
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

      {/* SIATKA — WSZYSTKIE serie jako jednolite kwadraty, 2 na rząd (jak w Duolingo).
          Wygląd każdego kafla wyekstrahowany do `StreakTile.tsx` (system kopiowania
          komponentów, §340+) — `onTile` (nawigacja) zostaje TUTAJ, bo to zachowanie
          specyficzne dla PRAWDZIWEGO dashboardu; `ScreenCanvas` na innych ekranach
          przekazuje `StreakTile` inny `onPress` (otwarcie pickera metryki). */}
      <View style={[s.grid, { gap: tileStyle.tileGap }]}>
        {rows.map(r => (
          <StreakTile key={r.key} item={r} tileStyle={tileStyle} onPress={() => onTile(r)}
            sizeStyle={[s.gridTileTouch, { aspectRatio: tileStyle.aspectRatio }]} />
        ))}
      </View>
    </TouchableOpacity>
  );

  function onTile(r: StreakItem) {
    haptic.tap();
    if (r.key.startsWith('h:')) {
      const habitId = r.key.slice(2);
      // Nadpisanie z kreatora (§330) wygrywa z domyślnym `kind==='water'` — brak wpisu w
      // mapie (zwykły przypadek) zachowuje się DOKŁADNIE jak przed §330.
      const style = tileStyle.habitCalendarOverrides[habitId] ?? (r.kind === 'water' ? 'water' : 'year');
      router.push((style === 'water' ? `/water-calendar?id=${habitId}` : `/habit-year?id=${habitId}`) as any);
    }
    else if (r.key.startsWith('c:')) router.push(`/habit-year?counter=${r.key.slice(2)}` as any);
    // `ex:` — wpis "Ćwiczenia" (2026-10-15, złożony tu z dawnego osobnego kafla
    // `exercise-streak`/`ExerciseStreakCard.tsx`, patrz app/(tabs)/index.tsx) — własna,
    // bogatsza historia (`/exercises-history`), nie generyczny `/habit-year`.
    else if (r.key.startsWith('ex:')) router.push('/exercises-history' as any);
    else router.push('/counters' as any);
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
  // (nie rozciąga się na cały ekran). Tylko rozmiar/proporcje — wygląd żyje w `StreakTile.tsx`
  // teraz (§340+, wcześniej `tileTouch`/`ringTileTouch` tu, dwie IDENTYCZNE kopie tego samego
  // obiektu pod różnymi nazwami bo każdy styl miał własną gałąź `renderTile` — zunifikowane
  // przy ekstrakcji, bo wszystkie 4 style i tak używały tych samych wartości).
  // Skurczone (2026-08-13, user: "kafelki są za długie") — niższy aspectRatio (szerszy
  // względem wysokości) + mniejszy minWidth, żeby cała sekcja nie zajmowała tyle miejsca
  // na dashboardzie przy kilku seriach naraz.
  gridTileTouch: { flexBasis: '47.5%', minWidth: 104, aspectRatio: 1.7 },
}));

export default memo(StreakWallCard);

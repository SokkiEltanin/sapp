import { memo, useEffect, useMemo, useState, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { GraduationCap } from 'lucide-react-native';
import { CalendarEvent } from '@/types';
import { parseClassEvent, fmtNextClassLabel, isHappeningNow, classGapMinutes, classGapLabel } from '@/utils/classSchedule';
import { haptic } from '@/utils/haptics';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';
import RadialGlow from '@/components/ui/RadialGlow';

// Diagonalny, ciemny fioletowy gradient — TEN SAM trójstopniowy przepis co `WORK_GRADIENT`
// w `index.tsx` (który z kolei był świadomie WZOROWANY na TYM kafelku, patrz komentarz
// tam) — teraz sprowadzony z powrotem tutaj (2026-09-29, user: "zrob bardziej
// profesjonalny większy trochę... wywal ten fioletowy element po lewej bo nie pasuje").
// Wystarczająco ciemny żeby biały tekst wszędzie miał kontrast, z `#A78BFA` (marka tej
// funkcji) zarezerwowanym na ikonę/odznaki/tytuł, nie na całe tło.
// Przyciemnione jeszcze bardziej (2026-10-06, user: "trochę ciemniejszy na dashboardzie
// tło") — każdy stop ~20% ciemniejszy niż poprzednio, kontrast białego tekstu i tak zostaje.
const CLASS_GRADIENT = ['#2E2050', '#47337F', '#0D091C'] as const;

// "Plan zajęć" dashboard card (2026-09-22) — TEN SAM wzorzec/rozmiar co `GCalCard.tsx`
// (dziś/jutro, kropka+godzina+tytuł), rozszerzony o odznakę typu (W/C/L/P) i salę, bo to
// dokładnie te dwie rzeczy które user chce widzieć na pierwszy rzut oka rano ("do jakiej sali
// idę"). Guard `.length > 0` zostaje w index.tsx, jak przy `nodes['gcal']`.
//
// `nextDay` (2026-09-23, user: "musi pokazywać aktualny plan... pokazywać następny dzień jaki
// będę miał z datą i za ile dni") — gdy dziś/jutro puste (weekend, przerwa
// międzysemestralna, dzień wolny z zarządzenia Rektora UR), kafelek wcześniej znikał
// CAŁKOWICIE (`return null`) zamiast pokazać najbliższy dzień z zajęciami. Teraz: fallback na
// najbliższy przyszły dzień, z etykietą "Śr 24 wrz · za 2 dni" (`fmtNextClassLabel`). Tap
// zawsze prowadzi do PEŁNEGO planu (`/class-schedule`, §167) niezależnie od tego, który
// wariant jest widoczny.
//
// Kolorystyczne wyróżnienie (2026-09-23, user: "musi być bardziej widocznym kafelkiem z
// odróżnieniem zajęć" — kafelek ginął wśród innych neutralnych kart) — fioletowy akcent
// (`#A78BFA`) już był marką tej funkcji (typ W w TYPE_COLOR, `dayColToday` w class-schedule.
// tsx), teraz też na samym kafelku: lewy pasek + delikatny wash tła + fioletowa ikonka/tytuł —
// TEN SAM przepis co kolor rodzaju na kartach zadań (§164), inny akcent koloru zamiast biało-
// szarego neutralnego chrome.
export interface ClassScheduleCardProps {
  today: CalendarEvent[];
  tomorrow: CalendarEvent[];
  nextDay?: { date: string; daysAway: number; events: CalendarEvent[] } | null;
  prefix: string;
}

function ClassScheduleCard({ today, tomorrow, nextDay, prefix }: ClassScheduleCardProps) {
  const c = useColors();
  const s = makeS(c);
  const showFallback = today.length === 0 && tomorrow.length === 0;

  // "Podświetl aktualny" (2026-10-06, user: "jak jestem to pokazuje podświetla aktualny") —
  // odświeżane co minutę, wystarczająco często żeby podświetlenie realnie zgasło/zapaliło
  // się na granicy zajęć bez zauważalnego opóźnienia, za rzadko żeby to był sensowny koszt.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  if (showFallback && !nextDay) return null;

  const renderRow = (e: CalendarEvent) => {
    const parsed = parseClassEvent(e.title, prefix);
    if (!parsed) return null;
    const live = isHappeningNow(e, now);
    return (
      <View key={e.id} style={[s.row, live && s.rowLive]}>
        {parsed.type && (
          <View style={s.typeBadge}><Text style={s.typeBadgeTxt}>{parsed.type}</Text></View>
        )}
        {/* Blok "od-do" (2026-10-06, user: "musi być czasowo... blokowo od której do której,
            potem żeby było widać czy mam 15 min przerwy pomiędzy czy ze np mam okienko") —
            dawniej sam `startTime`, teraz pełny zakres, żeby długość zajęć była widoczna bez
            otwierania pełnego planu. */}
        {e.startTime ? (
          <Text style={s.time}>{e.startTime}{e.endTime ? `–${e.endTime}` : ''}</Text>
        ) : null}
        <Text style={s.subject} numberOfLines={1}>{parsed.subject}</Text>
        {/* Sala jako wyraźny chip zamiast przygaszonego tekstu (2026-10-06, user: "żeby było
            lepiej widać sale") — ten sam przepis co `typeBadge` (jasne tło na ciemnym
            gradiencie), nie goła szarość. */}
        {parsed.room ? (
          <View style={s.roomChip}><Text style={s.roomChipTxt} numberOfLines={1}>{parsed.room}</Text></View>
        ) : null}
        {live && <View style={s.liveBadge}><Text style={s.liveBadgeTxt}>TERAZ</Text></View>}
      </View>
    );
  };

  // Renderuje jeden dzień (lista eventów, już posortowana wg startTime — patrz classToday/
  // classTomorrow/classNextDay w index.tsx) WRAZ z dzielnikami przerw między kolejnymi
  // zajęciami — liczonymi z surowych `startTime`/`endTime`, niezależnie od tego czy
  // `parseClassEvent` rozpoznał tytuł (gap dotyczy SAMEGO czasu, nie treści).
  const renderDay = (events: CalendarEvent[]) => {
    const nodes: ReactNode[] = [];
    events.forEach((e, i) => {
      nodes.push(renderRow(e));
      const next = events[i + 1];
      if (next?.startTime && e.endTime) {
        const gap = classGapMinutes(e.endTime, next.startTime);
        if (gap > 0) {
          nodes.push(
            <View key={`gap-${e.id}`} style={s.gapRow}>
              <View style={s.gapLine} />
              <Text style={s.gapTxt}>{classGapLabel(gap)}</Text>
              <View style={s.gapLine} />
            </View>,
          );
        }
      }
    });
    return nodes;
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => { haptic.tap(); router.push('/class-schedule' as any); }}
    >
      <LinearGradient colors={CLASS_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.card}>
        {/* Ziarno usunięte (2026-09-30, user o panelu Pracy z tym samym komponentem:
            "to miał być noise texture a nie kropki jakieś... wygląda jakby dziecko
            zrobiło" — kropkowy `NoiseOverlay` nie daje wrażenia realnego ziarna, tylko
            widoczne pojedyncze kropki; wycofany stąd też, nie tylko z panelu Pracy, żeby
            nie zostawiać tej samej, odrzuconej techniki w drugim miejscu). Poświata
            zostaje — gradient sam niesie akcent. */}
        <View style={s.glowWrap} pointerEvents="none">
          <RadialGlow size={200} color="#A78BFA" opacity={0.22} />
        </View>
        <View style={s.cardHeader}>
          <GraduationCap size={13} color="#A78BFA" />
          <Text style={s.cardTitle}>Plan zajęć</Text>
          {/* Dzień tygodnia + "za N dni" przeniesione w prawy górny róg (2026-10-06, user:
              "tekst dzień tygodnia i za ile dni możesz dać w prawym górnym żeby nie
              rozciągała nam tak kafelka") — dawniej pełnoszerokościowy `dayLabel` nad
              listą zajęć, teraz kompaktowy chip obok tytułu (ten sam wzorzec co `catChip`
              w TriviaCard.tsx: `cardTitle` dostało `flex:1`, żeby wypchnąć chip do
              krawędzi). Tylko w wariancie fallback — "Dziś"/"Jutro" zostają jako krótkie
              nagłówki sekcji, same w sobie nie rozciągały kafelka. */}
          {showFallback && nextDay && (
            <View style={s.dayChip}><Text style={s.dayChipTxt}>{fmtNextClassLabel(nextDay.date, nextDay.daysAway).toUpperCase()}</Text></View>
          )}
        </View>
        {today.length > 0 && (
          <>
            <Text style={s.dayLabel}>Dziś</Text>
            {renderDay(today)}
          </>
        )}
        {tomorrow.length > 0 && (
          <>
            <Text style={[s.dayLabel, { marginTop: today.length > 0 ? spacing[2] : 0 }]}>Jutro</Text>
            {renderDay(tomorrow)}
          </>
        )}
        {showFallback && nextDay && renderDay(nextDay.events)}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: '#A78BFA40',
    gap: spacing[3],
    overflow: 'hidden',
  },
  glowWrap: { position: 'absolute', left: -40, top: '50%', marginTop: -100 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
  cardTitle: { flex: 1, fontFamily: fonts.label, fontSize: 11, color: 'rgba(255,255,255,0.92)', textTransform: 'uppercase', letterSpacing: 0.9, flexShrink: 1, fontWeight: '700' },
  // Chip "dzień tygodnia + za N dni" w prawym górnym rogu (2026-10-06) — zastępuje dawny
  // pełnoszerokościowy `dayLabel` tylko w wariancie fallback, patrz komentarz przy JSX wyżej.
  dayChip: { backgroundColor: 'rgba(167,139,250,0.18)', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  dayChipTxt: { fontSize: 8.5, fontWeight: '800', color: '#D8CCFC', letterSpacing: 0.5 },
  dayLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.62)', textTransform: 'uppercase', letterSpacing: 0.8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 3 },
  rowLive: {
    backgroundColor: 'rgba(167,139,250,0.16)', borderRadius: radius.md,
    paddingHorizontal: spacing[2], marginHorizontal: -spacing[2],
  },
  liveBadge: { backgroundColor: '#A78BFA', borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  liveBadgeTxt: { fontSize: 8, fontWeight: '800', color: '#140D26', letterSpacing: 0.4 },
  typeBadge: { width: 18, height: 18, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  typeBadgeTxt: { fontSize: 10, fontWeight: '800', color: '#A78BFA' },
  // Blok "od-do" (2026-10-06) — szerszy niż dawny sam `startTime` (36px), żeby zmieścić pełny
  // zakres "08:00–09:30" bez zawijania.
  time: { fontSize: 10, color: 'rgba(255,255,255,0.72)', width: 68, fontWeight: '600' },
  subject: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.88)' },
  // Sala jako jasny chip (2026-10-06, user: "żeby było lepiej widać sale") — zastępuje dawny
  // goły, przygaszony tekst (`rgba(255,255,255,0.62)`) — ten sam jasny-tło-na-gradiencie
  // przepis co `typeBadge`/`dayChip` wyżej, żeby sala realnie rzucała się w oczy, nie ginęła.
  roomChip: { backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 3 },
  roomChipTxt: { fontSize: 11.5, color: '#fff', fontWeight: '800' },
  // Dzielnik przerwy między kolejnymi zajęciami (2026-10-06, user: "zeby bylo qidac czy mam
  // 15 min przerwy pomiędzy czy ze np mam okienko") — cienka linia po obu stronach etykiety,
  // ten sam motyw co separator w statystykach, ale minimalny (nie pełny `row`, nie ma własnej
  // interakcji/podświetlenia).
  gapRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 2 },
  gapLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  gapTxt: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.45)', letterSpacing: 0.3 },
}));

export default memo(ClassScheduleCard);

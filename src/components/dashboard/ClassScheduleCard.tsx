import { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { GraduationCap } from 'lucide-react-native';
import { CalendarEvent } from '@/types';
import { parseClassEvent, fmtNextClassLabel } from '@/utils/classSchedule';
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
const CLASS_GRADIENT = ['#3D2A66', '#5B3FA0', '#140D26'] as const;

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
  if (showFallback && !nextDay) return null;

  const renderRow = (e: CalendarEvent) => {
    const parsed = parseClassEvent(e.title, prefix);
    if (!parsed) return null;
    return (
      <View key={e.id} style={s.row}>
        {parsed.type && (
          <View style={s.typeBadge}><Text style={s.typeBadgeTxt}>{parsed.type}</Text></View>
        )}
        {e.startTime ? <Text style={s.time}>{e.startTime}</Text> : null}
        <Text style={s.subject} numberOfLines={1}>{parsed.subject}</Text>
        {parsed.room ? <Text style={s.room} numberOfLines={1}>{parsed.room}</Text> : null}
      </View>
    );
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
        </View>
        {today.length > 0 && (
          <>
            <Text style={s.dayLabel}>Dziś</Text>
            {today.map(renderRow)}
          </>
        )}
        {tomorrow.length > 0 && (
          <>
            <Text style={[s.dayLabel, { marginTop: today.length > 0 ? spacing[2] : 0 }]}>Jutro</Text>
            {tomorrow.map(renderRow)}
          </>
        )}
        {showFallback && nextDay && (
          <>
            <Text style={s.dayLabel}>{fmtNextClassLabel(nextDay.date, nextDay.daysAway)}</Text>
            {nextDay.events.map(renderRow)}
          </>
        )}
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
  cardTitle: { fontFamily: fonts.label, fontSize: 11, color: 'rgba(255,255,255,0.92)', textTransform: 'uppercase', letterSpacing: 0.9, flexShrink: 1, fontWeight: '700' },
  dayLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.62)', textTransform: 'uppercase', letterSpacing: 0.8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 3 },
  typeBadge: { width: 18, height: 18, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  typeBadgeTxt: { fontSize: 10, fontWeight: '800', color: '#A78BFA' },
  time: { fontSize: 10, color: 'rgba(255,255,255,0.62)', width: 36, fontWeight: '600' },
  subject: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.88)' },
  room: { fontSize: 11, color: 'rgba(255,255,255,0.62)', fontWeight: '700' },
}));

export default memo(ClassScheduleCard);

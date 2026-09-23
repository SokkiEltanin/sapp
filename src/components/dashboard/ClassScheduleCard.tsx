import { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { GraduationCap } from 'lucide-react-native';
import { CalendarEvent } from '@/types';
import { parseClassEvent, fmtNextClassLabel } from '@/utils/classSchedule';
import { haptic } from '@/utils/haptics';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';

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
// zawsze prowadzi do PEŁNEGO planu (`/class-schedule`, §161) niezależnie od tego, który
// wariant jest widoczny.
export interface ClassScheduleCardProps {
  today: CalendarEvent[];
  tomorrow: CalendarEvent[];
  nextDay?: { date: string; daysAway: number; events: CalendarEvent[] } | null;
  prefix: string;
  cardBg: string;
}

function ClassScheduleCard({ today, tomorrow, nextDay, prefix, cardBg }: ClassScheduleCardProps) {
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
      style={[s.card, { backgroundColor: cardBg }]}
    >
      <View style={s.cardHeader}>
        <GraduationCap size={13} color={c.text.muted} />
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
    </TouchableOpacity>
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
  dayLabel: { fontSize: 9, fontWeight: '700', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 3 },
  typeBadge: { width: 18, height: 18, borderRadius: radius.full, backgroundColor: '#A78BFA22', alignItems: 'center', justifyContent: 'center' },
  typeBadgeTxt: { fontSize: 10, fontWeight: '800', color: '#A78BFA' },
  time: { fontSize: 10, color: c.text.muted, width: 36, fontWeight: '600' },
  subject: { flex: 1, fontSize: 13, color: c.text.secondary },
  room: { fontSize: 11, color: c.text.muted, fontWeight: '700' },
}));

export default memo(ClassScheduleCard);

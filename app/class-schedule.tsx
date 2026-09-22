import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, ChevronLeft as ChevronL } from 'lucide-react-native';
import { useCalendarStore } from '@/store/calendarStore';
import { useClassScheduleStore } from '@/store/classScheduleStore';
import { isClassEvent, parseClassEvent, CLASS_TYPE_LABEL, ClassType } from '@/utils/classSchedule';
import { toYMD, mondayOf, fmtWeekRange } from '@/utils/weekGrid';
import { haptic } from '@/utils/haptics';
import { spacing, radius, fonts } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';

// "Wirtualny podgląd" całego tygodnia planu zajęć (2026-09-22, user: "żebym miał podgląd
// planu taki wirtualny... siatka jak ten co przysyłałem"). Kolumny = dni tygodnia (jak w
// oryginalnym planie z UR, który user przysłał jako zrzut — Pon-Nie, siatka), w każdej
// kolumnie chronologiczna lista TEGO dnia (nie ściśle proporcjonalna do godziny — próba
// dokładnego 1:1 pikseli-na-minutę robiłaby albo giganta na telefonie, albo nieczytelnie
// małe bloki dla 90-minutowych zajęć). Nawigacja tydzień wstecz/naprzód + szybki powrót do
// bieżącego — dane to zawsze te same `gcalEvents` co dashboardowy kafelek/TopPill (§158/160),
// ten sam `isClassEvent`/`parseClassEvent`, więc trzy miejsca ZAWSZE pokazują to samo.
const DAY_SHORT = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nie'];

const TYPE_COLOR: Record<ClassType, string> = {
  W: '#A78BFA', C: '#4DA8FF', L: '#2AC68F', P: '#FBBF24',
};

export default function ClassSchedule() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const gcalEvents = useCalendarStore(st => st.gcalEvents);
  const classPrefix = useClassScheduleStore(st => st.prefix);

  const [weekOffset, setWeekOffset] = useState(0);
  const monday = useMemo(() => {
    const base = mondayOf(new Date());
    base.setDate(base.getDate() + weekOffset * 7);
    return base;
  }, [weekOffset]);
  const todayYMD = toYMD(new Date());

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday); d.setDate(d.getDate() + i);
      const ymd = toYMD(d);
      const dayEvents = gcalEvents
        .filter(e => e.date === ymd && isClassEvent(e.title, classPrefix))
        .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
      return { ymd, date: d, dayIdx: i, events: dayEvents, isToday: ymd === todayYMD };
    });
  }, [monday, gcalEvents, classPrefix, todayYMD]);

  const totalCount = days.reduce((n, d) => n + d.events.length, 0);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><ChevronLeft size={24} color={c.text.primary} /></TouchableOpacity>
        <Text style={s.title}>Plan zajęć</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={s.weekNav}>
        <TouchableOpacity onPress={() => { haptic.tap(); setWeekOffset(w => w - 1); }} hitSlop={10} style={s.weekNavBtn}>
          <ChevronL size={18} color={c.text.secondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { haptic.tap(); setWeekOffset(0); }} style={s.weekRangeWrap}>
          <Text style={s.weekRange}>{fmtWeekRange(monday)}</Text>
          {weekOffset !== 0 && <Text style={s.weekToday}>wróć do dziś</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { haptic.tap(); setWeekOffset(w => w + 1); }} hitSlop={10} style={s.weekNavBtn}>
          <ChevronRight size={18} color={c.text.secondary} />
        </TouchableOpacity>
      </View>

      {totalCount === 0 ? (
        <View style={s.emptyWrap}>
          <Text style={s.emptyTxt}>Brak zajęć w tym tygodniu</Text>
          <Text style={s.emptySub}>Sprawdź prefiks w Ustawieniach albo czy eventy są zaimportowane do Kalendarza Google.</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.grid}>
          {days.map(day => (
            <View key={day.ymd} style={[s.dayCol, day.isToday && s.dayColToday]}>
              <View style={s.dayHead}>
                <Text style={[s.dayName, day.isToday && s.dayNameToday]}>{DAY_SHORT[day.dayIdx]}</Text>
                <Text style={[s.dayDate, day.isToday && s.dayNameToday]}>{day.date.getDate()}</Text>
              </View>
              {day.events.length === 0 ? (
                <Text style={s.dayEmpty}>—</Text>
              ) : (
                day.events.map(ev => {
                  const parsed = parseClassEvent(ev.title, classPrefix);
                  const color = parsed?.type ? TYPE_COLOR[parsed.type] : c.text.muted;
                  return (
                    <View key={ev.id} style={[s.evCard, { borderLeftColor: color }]}>
                      <Text style={[s.evTime, { color }]}>{ev.startTime ?? ''}{ev.endTime ? `–${ev.endTime}` : ''}</Text>
                      {parsed?.type && <Text style={[s.evType, { color }]}>{CLASS_TYPE_LABEL[parsed.type]}</Text>}
                      <Text style={s.evSubject} numberOfLines={3}>{parsed?.subject ?? ev.title}</Text>
                      {parsed?.room && <Text style={s.evRoom} numberOfLines={1}>{parsed.room}</Text>}
                    </View>
                  );
                })
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  title: { fontSize: 18, fontWeight: '800', color: c.text.primary },

  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingBottom: spacing[3] },
  weekNavBtn: { width: 32, height: 32, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default },
  weekRangeWrap: { alignItems: 'center', gap: 2 },
  weekRange: { fontSize: 13, fontWeight: '700', color: c.text.primary },
  weekToday: { fontSize: 10, color: c.text.muted, fontWeight: '600' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[6], gap: spacing[2] },
  emptyTxt: { fontSize: 15, fontWeight: '700', color: c.text.secondary },
  emptySub: { fontSize: 12, color: c.text.muted, textAlign: 'center' },

  grid: { paddingHorizontal: spacing[3], paddingBottom: spacing[6], gap: spacing[2] },
  dayCol: {
    width: 148, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.card,
    backgroundColor: c.bg.card, padding: spacing[2], gap: spacing[2],
  },
  dayColToday: { borderColor: '#A78BFA88', backgroundColor: '#A78BFA0F' },
  dayHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: spacing[1], borderBottomWidth: 1, borderBottomColor: c.border.subtle },
  dayName: { fontFamily: fonts.label, fontSize: 11, color: c.text.secondary, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '700' },
  dayNameToday: { color: '#A78BFA' },
  dayDate: { fontSize: 14, fontWeight: '800', color: c.text.muted },
  dayEmpty: { fontSize: 11, color: c.text.muted, textAlign: 'center', paddingVertical: spacing[3] },

  evCard: { borderLeftWidth: 3, paddingLeft: spacing[2], paddingVertical: 4, gap: 1 },
  evTime: { fontSize: 10, fontWeight: '800' },
  evType: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  evSubject: { fontSize: 11, color: c.text.primary, fontWeight: '600', lineHeight: 14 },
  evRoom: { fontSize: 10, color: c.text.muted, fontWeight: '600' },
}));

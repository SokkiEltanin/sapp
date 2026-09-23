import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, ChevronLeft as ChevronL } from 'lucide-react-native';
import { useCalendarStore } from '@/store/calendarStore';
import { useClassScheduleStore } from '@/store/classScheduleStore';
import { isClassEvent, parseClassEvent, CLASS_TYPE_LABEL, ClassType } from '@/utils/classSchedule';
import { toYMD, addDays, mondayOf, fmtWeekRange, fmtDayLabel, fmtMonthLabel, monthGrid } from '@/utils/weekGrid';
import { CalendarEvent } from '@/types';
import { haptic } from '@/utils/haptics';
import { spacing, radius, fonts } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';

// Widok planu zajęć — trzy tryby: dzień (domyślny)/tydzień/miesiąc (2026-09-23, user: "tam
// zrobiłeś przesuwaną listę, dajmy stabilną, domyślnie dzienna i można włączyć widok
// tygodniowy i miesięczny"). Poprzednia wersja (§161) miała TYLKO siatkę tygodnia z poziomym
// swipe'em po 7 kolumnach — user chciał to zastąpić: dzień jako spokojny, w pełni czytelny
// domyślny widok (jedna kolumna, cała szerokość ekranu — więcej miejsca niż 148px kolumna
// tygodnia), tydzień jako PIONOWA lista sekcji dni (bez gestu przesuwania — "stabilna"), i
// nowy widok miesiąca (siatka kalendarza, tap dnia → przeskakuje do widoku dnia).
//
// Jeden wspólny `selectedDate` jako kotwica dla WSZYSTKICH trybów (nie osobne offsety per
// tryb) — przełączenie trybu nie resetuje pozycji: oglądasz dzień X, włączasz "Tydzień",
// widzisz tydzień ZAWIERAJĄCY X, nie bieżący. Dane = te same `gcalEvents` +
// `isClassEvent`/`parseClassEvent` co dashboardowy kafelek (§158/163) i TopPill (§160) —
// zbudowane RAZ do `Map<YMD, CalendarEvent[]>` (`eventsByDate`), reużywane przez wszystkie 3
// tryby zamiast filtrować `gcalEvents` osobno w każdym.
type ViewMode = 'day' | 'week' | 'month';

const DAY_SHORT = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nie'];

const TYPE_COLOR: Record<ClassType, string> = {
  W: '#A78BFA', C: '#4DA8FF', L: '#2AC68F', P: '#FBBF24',
};

const VIEW_TABS: { key: ViewMode; label: string }[] = [
  { key: 'day', label: 'Dzień' },
  { key: 'week', label: 'Tydzień' },
  { key: 'month', label: 'Miesiąc' },
];

export default function ClassSchedule() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const gcalEvents = useCalendarStore(st => st.gcalEvents);
  const classPrefix = useClassScheduleStore(st => st.prefix);

  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const todayYMD = toYMD(new Date());
  const selectedYMD = toYMD(selectedDate);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of gcalEvents) {
      if (!isClassEvent(e.title, classPrefix)) continue;
      const arr = map.get(e.date);
      if (arr) arr.push(e); else map.set(e.date, [e]);
    }
    for (const arr of map.values()) arr.sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
    return map;
  }, [gcalEvents, classPrefix]);
  const eventsFor = (ymd: string): CalendarEvent[] => eventsByDate.get(ymd) ?? [];

  const goPrev = () => {
    haptic.tap();
    setSelectedDate(d => {
      if (viewMode === 'day') return addDays(d, -1);
      if (viewMode === 'week') return addDays(d, -7);
      return new Date(d.getFullYear(), d.getMonth() - 1, 1);
    });
  };
  const goNext = () => {
    haptic.tap();
    setSelectedDate(d => {
      if (viewMode === 'day') return addDays(d, 1);
      if (viewMode === 'week') return addDays(d, 7);
      return new Date(d.getFullYear(), d.getMonth() + 1, 1);
    });
  };
  const goToday = () => { haptic.tap(); setSelectedDate(new Date()); };

  const isOnToday = viewMode === 'day' ? selectedYMD === todayYMD
    : viewMode === 'week' ? toYMD(mondayOf(selectedDate)) === toYMD(mondayOf(new Date()))
    : selectedDate.getFullYear() === new Date().getFullYear() && selectedDate.getMonth() === new Date().getMonth();

  const headerLabel = viewMode === 'day' ? fmtDayLabel(selectedDate)
    : viewMode === 'week' ? fmtWeekRange(mondayOf(selectedDate))
    : fmtMonthLabel(selectedDate);

  const renderEventRow = (ev: CalendarEvent) => {
    const parsed = parseClassEvent(ev.title, classPrefix);
    const color = parsed?.type ? TYPE_COLOR[parsed.type] : c.text.muted;
    return (
      <View key={ev.id} style={[s.evRow, { borderLeftColor: color }]}>
        <View style={s.evTimeCol}>
          <Text style={[s.evTime, { color }]}>{ev.startTime ?? '—'}</Text>
          {ev.endTime ? <Text style={s.evTimeEnd}>{ev.endTime}</Text> : null}
        </View>
        <View style={s.evBody}>
          {parsed?.type && <Text style={[s.evType, { color }]}>{CLASS_TYPE_LABEL[parsed.type]}</Text>}
          <Text style={s.evSubject} numberOfLines={2}>{parsed?.subject ?? ev.title}</Text>
          {parsed?.room && <Text style={s.evRoom}>{parsed.room}</Text>}
        </View>
      </View>
    );
  };

  const dayEvents = viewMode === 'day' ? eventsFor(selectedYMD) : [];
  const weekDays = useMemo(() => {
    if (viewMode !== 'week') return [];
    const monday = mondayOf(selectedDate);
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [viewMode, selectedDate]);
  const monthWeeks = useMemo(() => (viewMode === 'month' ? monthGrid(selectedDate) : []), [viewMode, selectedDate]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><ChevronLeft size={24} color={c.text.primary} /></TouchableOpacity>
        <Text style={s.title}>Plan zajęć</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={s.tabRow}>
        {VIEW_TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            onPress={() => { haptic.tap(); setViewMode(t.key); }}
            style={[s.tabBtn, viewMode === t.key && s.tabBtnActive]}
          >
            <Text style={[s.tabTxt, viewMode === t.key && s.tabTxtActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.nav}>
        <TouchableOpacity onPress={goPrev} hitSlop={10} style={s.navBtn}>
          <ChevronL size={18} color={c.text.secondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={goToday} style={s.navLabelWrap}>
          <Text style={s.navLabel} numberOfLines={1}>{headerLabel}</Text>
          {!isOnToday && <Text style={s.navToday}>wróć do dziś</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={goNext} hitSlop={10} style={s.navBtn}>
          <ChevronRight size={18} color={c.text.secondary} />
        </TouchableOpacity>
      </View>

      {viewMode === 'day' && (
        dayEvents.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyTxt}>Brak zajęć tego dnia</Text>
            <Text style={s.emptySub}>Sprawdź prefiks w Ustawieniach albo czy eventy są zaimportowane do Kalendarza Google.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.dayList}>{dayEvents.map(renderEventRow)}</ScrollView>
        )
      )}

      {viewMode === 'week' && (
        <ScrollView contentContainerStyle={s.weekList}>
          {weekDays.map(d => {
            const ymd = toYMD(d);
            const evs = eventsFor(ymd);
            const isToday = ymd === todayYMD;
            return (
              <View key={ymd} style={[s.weekSection, isToday && s.weekSectionToday]}>
                <Text style={[s.weekSectionHead, isToday && s.weekSectionHeadToday]}>
                  {DAY_SHORT[(d.getDay() + 6) % 7]}, {d.getDate()}
                </Text>
                {evs.length === 0
                  ? <Text style={s.dayEmptyRow}>Brak zajęć</Text>
                  : evs.map(renderEventRow)}
              </View>
            );
          })}
        </ScrollView>
      )}

      {viewMode === 'month' && (
        <ScrollView contentContainerStyle={s.monthWrap}>
          <View style={s.monthDayNamesRow}>
            {DAY_SHORT.map(d => <Text key={d} style={s.monthDayNameHead}>{d}</Text>)}
          </View>
          {monthWeeks.map((week, wi) => (
            <View key={wi} style={s.monthWeekRow}>
              {week.map(cell => {
                const count = eventsFor(cell.ymd).length;
                const isToday = cell.ymd === todayYMD;
                const isSelected = cell.ymd === selectedYMD;
                return (
                  <TouchableOpacity
                    key={cell.ymd}
                    activeOpacity={0.7}
                    style={[s.monthCell, isSelected && s.monthCellSelected]}
                    onPress={() => { haptic.tap(); setSelectedDate(new Date(cell.ymd + 'T12:00:00')); setViewMode('day'); }}
                  >
                    <Text style={[
                      s.monthCellNum,
                      !cell.inMonth && s.monthCellNumOut,
                      isToday && s.monthCellNumToday,
                    ]}>
                      {Number(cell.ymd.split('-')[2])}
                    </Text>
                    {count > 0 && <View style={s.monthDot} />}
                  </TouchableOpacity>
                );
              })}
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

  tabRow: { flexDirection: 'row', paddingHorizontal: spacing[4], gap: spacing[2], paddingBottom: spacing[3] },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.full, alignItems: 'center', backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default },
  tabBtnActive: { backgroundColor: '#A78BFA22', borderColor: '#A78BFA88' },
  tabTxt: { fontSize: 12, fontWeight: '700', color: c.text.secondary },
  tabTxtActive: { color: '#A78BFA' },

  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingBottom: spacing[3] },
  navBtn: { width: 32, height: 32, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default },
  navLabelWrap: { alignItems: 'center', gap: 2, flex: 1 },
  navLabel: { fontSize: 14, fontWeight: '700', color: c.text.primary },
  navToday: { fontSize: 10, color: c.text.muted, fontWeight: '600' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[6], gap: spacing[2] },
  emptyTxt: { fontSize: 15, fontWeight: '700', color: c.text.secondary },
  emptySub: { fontSize: 12, color: c.text.muted, textAlign: 'center' },

  // ── Widok dnia — jedna kolumna na całą szerokość ─────────────────────────────
  dayList: { paddingHorizontal: spacing[4], paddingBottom: spacing[6], gap: spacing[2] },

  // ── Widok tygodnia — PIONOWE sekcje dni (bez poziomego swipe'a, "stabilny") ──
  weekList: { paddingHorizontal: spacing[4], paddingBottom: spacing[6], gap: spacing[3] },
  weekSection: {
    borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.card,
    backgroundColor: c.bg.card, padding: spacing[3], gap: spacing[2],
  },
  weekSectionToday: { borderColor: '#A78BFA88', backgroundColor: '#A78BFA0F' },
  weekSectionHead: {
    fontFamily: fonts.label, fontSize: 11, color: c.text.secondary, textTransform: 'uppercase',
    letterSpacing: 0.6, fontWeight: '700', paddingBottom: spacing[1],
    borderBottomWidth: 1, borderBottomColor: c.border.subtle,
  },
  weekSectionHeadToday: { color: '#A78BFA' },
  dayEmptyRow: { fontSize: 11, color: c.text.muted, paddingVertical: spacing[1] },

  // ── Wiersz eventu — reużyty przez widok dnia i tygodnia ──────────────────────
  evRow: { flexDirection: 'row', gap: spacing[3], borderLeftWidth: 3, paddingLeft: spacing[3], paddingVertical: spacing[2] },
  evTimeCol: { width: 48 },
  evTime: { fontSize: 13, fontWeight: '800' },
  evTimeEnd: { fontSize: 10, color: c.text.muted, fontWeight: '600' },
  evBody: { flex: 1, gap: 1 },
  evType: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  evSubject: { fontSize: 13, color: c.text.primary, fontWeight: '600', lineHeight: 17 },
  evRoom: { fontSize: 11, color: c.text.muted, fontWeight: '600' },

  // ── Widok miesiąca — siatka kalendarza ────────────────────────────────────────
  monthWrap: { paddingHorizontal: spacing[4], paddingBottom: spacing[6] },
  monthDayNamesRow: { flexDirection: 'row', paddingBottom: spacing[2] },
  monthDayNameHead: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '700', color: c.text.muted, textTransform: 'uppercase' },
  monthWeekRow: { flexDirection: 'row' },
  monthCell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  monthCellSelected: { backgroundColor: '#A78BFA1E', borderRadius: radius.md },
  monthCellNum: { fontSize: 13, fontWeight: '700', color: c.text.secondary },
  monthCellNumOut: { color: c.text.muted, opacity: 0.4 },
  monthCellNumToday: { color: '#A78BFA', fontWeight: '800' },
  monthDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#A78BFA' },
}));

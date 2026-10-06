import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { X, GraduationCap } from 'lucide-react-native';
import { useCalendarStore } from '@/store/calendarStore';
import { useClassScheduleStore } from '@/store/classScheduleStore';
import { isClassEvent, parseClassEvent, CLASS_TYPE_LABEL, ClassType } from '@/utils/classSchedule';
import { CalendarEvent } from '@/types';
import { colors, spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { haptic } from '@/utils/haptics';

// Modal wyboru KONKRETNEGO wystąpienia zajęć z planu (2026-10-06, user: "mogę dodać zadania
// jakby powiązane z przedmiotem w konkretnej dacie np prezentacja za tydzień u kogoś... i to
// się pokazuje na planie i przypomina przed zajęciami") — dzieli te same `gcalEvents` +
// `isClassEvent`/`classPrefix` co `app/class-schedule.tsx`, tylko płaska, pogrupowana po
// dniu lista najbliższych ~60 dni zamiast widoku dzień/tydzień/miesiąc (tu user tylko
// WYBIERA jedno konkretne wystąpienie, nie przegląda cały plan).
const TYPE_COLOR: Record<ClassType, string> = {
  W: '#A78BFA', C: '#4DA8FF', L: '#2AC68F', P: '#FBBF24',
};
const DAY_SHORT = ['Nie', 'Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob'];
const DAYS_AHEAD = 60;

function pad(n: number) { return String(n).padStart(2, '0'); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (ev: CalendarEvent) => void;
}

export default function ClassLinkPicker({ visible, onClose, onSelect }: Props) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const gcalEvents = useCalendarStore(st => st.gcalEvents);
  const classPrefix = useClassScheduleStore(st => st.prefix);

  const upcoming = useMemo(() => {
    if (!visible) return [];
    const todayYMD = ymd(new Date());
    const maxYMD = ymd(new Date(Date.now() + DAYS_AHEAD * 86400000));
    return gcalEvents
      .filter(e => isClassEvent(e.title, classPrefix) && e.date >= todayYMD && e.date <= maxYMD)
      .sort((a, b) => (a.date + (a.startTime ?? '')).localeCompare(b.date + (b.startTime ?? '')));
  }, [visible, gcalEvents, classPrefix]);

  const grouped = useMemo(() => {
    const out: { ymd: string; events: CalendarEvent[] }[] = [];
    for (const e of upcoming) {
      const last = out[out.length - 1];
      if (last && last.ymd === e.date) last.events.push(e);
      else out.push({ ymd: e.date, events: [e] });
    }
    return out;
  }, [upcoming]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <View style={s.head}>
            <GraduationCap size={16} color="#A78BFA" />
            <Text style={s.title}>Powiąż z zajęciami</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><X size={18} color={c.text.muted} /></TouchableOpacity>
          </View>
          {grouped.length === 0 ? (
            <Text style={s.empty}>Brak zajęć w planie na najbliższe {DAYS_AHEAD} dni. Sprawdź prefiks w Ustawieniach albo czy plan jest zaimportowany do Kalendarza Google.</Text>
          ) : (
            <ScrollView style={s.list} contentContainerStyle={{ gap: spacing[3] }}>
              {grouped.map(({ ymd: dateYmd, events }) => {
                const [y, m, d] = dateYmd.split('-').map(Number);
                const dow = DAY_SHORT[new Date(y, m - 1, d).getDay()];
                return (
                  <View key={dateYmd}>
                    <Text style={s.dateHead}>{dow}, {pad(d)}.{pad(m)}</Text>
                    {events.map(ev => {
                      const parsed = parseClassEvent(ev.title, classPrefix);
                      const color = parsed?.type ? TYPE_COLOR[parsed.type] : c.text.muted;
                      return (
                        <TouchableOpacity
                          key={ev.id}
                          style={[s.row, { borderLeftColor: color }]}
                          onPress={() => { haptic.tap(); onSelect(ev); }}
                          activeOpacity={0.75}
                        >
                          <Text style={[s.rowTime, { color }]}>{ev.startTime ?? '—'}</Text>
                          <View style={{ flex: 1 }}>
                            {parsed?.type && <Text style={[s.rowType, { color }]}>{CLASS_TYPE_LABEL[parsed.type]}</Text>}
                            <Text style={s.rowSubject} numberOfLines={1}>{parsed?.subject ?? ev.title}</Text>
                          </View>
                          {parsed?.room && <Text style={s.rowRoom} numberOfLines={1}>{parsed.room}</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeS = (c: any) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[5] },
  card: {
    width: '100%', maxWidth: 400, maxHeight: '75%', backgroundColor: c.bg.secondary,
    borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default, padding: spacing[4], gap: spacing[2],
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { flex: 1, fontSize: 15, fontWeight: '800', color: c.text.primary },
  empty: { fontSize: 12.5, color: c.text.muted, lineHeight: 18, paddingVertical: spacing[3] },
  list: { marginTop: spacing[1] },
  dateHead: {
    fontSize: 10.5, fontWeight: '700', color: c.text.muted, textTransform: 'uppercase',
    letterSpacing: 0.6, paddingBottom: spacing[1], borderBottomWidth: 1, borderBottomColor: c.border.subtle,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], borderLeftWidth: 3, paddingLeft: spacing[2], paddingVertical: spacing[2] },
  rowTime: { fontSize: 12, fontWeight: '800', width: 40 },
  rowType: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  rowSubject: { fontSize: 13, color: c.text.primary, fontWeight: '600' },
  rowRoom: { fontSize: 11, color: c.text.muted, fontWeight: '600' },
});

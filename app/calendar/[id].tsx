import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, Trash2, Edit3, Save, Calendar, Clock, Flag, Circle } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import { useCalendarStore } from '@/store/calendarStore';
import { calendarService } from '@/services/calendarService';
import { googleCalendarService } from '@/services/googleCalendarService';
import { notificationsService } from '@/services/notificationsService';
import { toast } from '@/store/toastStore';
import { EventPriority } from '@/types';
import { colors, spacing, radius, typography } from '@/theme';
import { haptic } from '@/utils/haptics';

const EVENT_COLORS = [
  '#60A5FA', '#34D399', '#F87171', '#FBBF24', '#C084FC', '#F472B6', '#FFFFFF',
];

const PRIORITIES: { value: EventPriority; label: string; color: string }[] = [
  { value: 'low',    label: 'Niski',     color: colors.text.secondary },
  { value: 'normal', label: 'Normalny',  color: colors.text.primary },
  { value: 'high',   label: 'Pilny',     color: colors.accent.red },
];

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <View style={rw.wrap}>
      <View style={rw.head}>
        {icon}
        <Text style={rw.label}>{label}</Text>
      </View>
      {children}
    </View>
  );
}
const rw = StyleSheet.create({
  wrap: { gap: spacing[2], paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  label: { fontSize: 10, fontWeight: '600', color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
});

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { events, gcalEvents, updateEvent, deleteEvent, setEvents } = useCalendarStore();
  const event = [...events, ...gcalEvents].find(e => e.id === id);

  useEffect(() => {
    if (events.length === 0) {
      calendarService.getAllEvents().then(setEvents).catch(() => {});
    }
  }, []);

  const [editing, setEditing]       = useState(false);
  const [title, setTitle]           = useState(event?.title ?? '');
  const [description, setDesc]      = useState(event?.description ?? '');
  const [date, setDate]             = useState(event?.date.split('T')[0] ?? '');
  const [startTime, setStartTime]   = useState(event?.startTime ?? '');
  const [endTime, setEndTime]       = useState(event?.endTime ?? '');
  const [priority, setPriority]     = useState<EventPriority>(event?.priority ?? 'normal');
  const [color, setColor]           = useState(event?.color ?? EVENT_COLORS[0]);
  const [saving, setSaving]         = useState(false);

  if (!event) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.notFound}>
          <Text style={s.notFoundText}>Wydarzenie nie istnieje</Text>
          <PressableScale onPress={() => router.back()}>
            <Text style={{ color: colors.text.primary, padding: spacing[4] }}>Wróć</Text>
          </PressableScale>
        </View>
      </SafeAreaView>
    );
  }

  const isGCal = id?.startsWith('gcal-') ?? false;

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Tytuł nie może być pusty'); return; }
    setSaving(true);
    try {
      const trimmedDate = date.trim();
      const trimmedStart = startTime.trim();
      const trimmedEnd = endTime.trim();

      const updates = {
        title: title.trim(),
        description: description.trim() || undefined,
        date: trimmedDate + 'T12:00:00.000Z',
        startTime: trimmedStart || undefined,
        endTime: trimmedEnd || undefined,
        allDay: !trimmedStart,
        priority,
        color,
      };

      if (isGCal) {
        const ok = await googleCalendarService.updateEvent(id!, {
          title: updates.title,
          description: updates.description,
          date: trimmedDate,
          startTime: trimmedStart || undefined,
          endTime: trimmedEnd || undefined,
          allDay: !trimmedStart,
        });
        if (!ok) throw new Error('Nie udało się zapisać w Google Calendar');
        updateEvent(id!, updates); // optymistyczna aktualizacja w store
      } else {
        updateEvent(id!, updates);
        await calendarService.updateEvent(id!, updates);
        notificationsService.cancelEventReminder(id!).catch(() => {});
        if (updates.startTime) {
          notificationsService.scheduleEventReminder(id!, updates.title, updates.date, updates.startTime).catch(() => {});
        }
      }

      haptic.success();
      setEditing(false);
      toast.success(isGCal ? 'Zapisano w Google Calendar' : 'Zapisano');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Usuń wydarzenie', 'Na pewno usunąć?', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń', style: 'destructive', onPress: async () => {
          haptic.medium();
          deleteEvent(id!);
          if (isGCal) {
            await googleCalendarService.deleteEvent(id!).catch(() => {});
          } else {
            await calendarService.deleteEvent(id!).catch(() => {});
            notificationsService.cancelEventReminder(id!).catch(() => {});
          }
          toast.info('Usunięto');
          router.back();
        },
      },
    ]);
  };

  const evColor = editing ? color : (event.color ?? colors.accent.blue);
  const gcalBlue = '#039BE5';

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={s.header}>
          <PressableScale onPress={() => { haptic.tap(); router.back(); }} style={s.iconBtn}>
            <ArrowLeft size={20} color={colors.text.secondary} />
          </PressableScale>
          <View style={[s.colorPill, {
            backgroundColor: isGCal ? gcalBlue + '20' : evColor + '25',
            borderColor: isGCal ? gcalBlue + '60' : evColor + '50',
          }]}>
            <Circle size={7} color={isGCal ? gcalBlue : evColor} fill={isGCal ? gcalBlue : evColor} />
            <Text style={[s.colorPillText, { color: isGCal ? gcalBlue : evColor }]}>
              {isGCal ? 'Google Calendar' : 'Wydarzenie'}
            </Text>
          </View>
          <View style={s.headerActions}>
            {editing ? (
              <PressableScale onPress={saving ? undefined : handleSave} style={[s.iconBtn, s.saveBtn]}>
                <Save size={18} color={colors.bg.primary} />
              </PressableScale>
            ) : (
              <PressableScale onPress={() => { haptic.tap(); setEditing(true); }} style={s.iconBtn}>
                <Edit3 size={18} color={colors.text.secondary} />
              </PressableScale>
            )}
            <PressableScale onPress={handleDelete} style={s.iconBtn}>
              <Trash2 size={18} color={colors.accent.red} />
            </PressableScale>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <View style={[s.titleCard, { borderLeftColor: evColor }]}>
            {editing ? (
              <TextInput
                value={title}
                onChangeText={setTitle}
                style={s.titleInput}
                autoFocus
                multiline
                placeholderTextColor={colors.text.muted}
                placeholder="Nazwa wydarzenia"
              />
            ) : (
              <Text style={s.titleText}>{event.title}</Text>
            )}
            {event.description || editing ? (
              editing ? (
                <TextInput
                  value={description}
                  onChangeText={setDesc}
                  style={s.descInput}
                  multiline
                  placeholder="Opis..."
                  placeholderTextColor={colors.text.muted}
                />
              ) : (
                <Text style={s.descText}>{event.description}</Text>
              )
            ) : null}
          </View>

          {/* Fields */}
          <View style={s.card}>

            <Row icon={<Calendar size={12} color={colors.text.muted} />} label="Data">
              {editing ? (
                <TextInput
                  value={date}
                  onChangeText={setDate}
                  style={s.fieldInput}
                  placeholder="RRRR-MM-DD"
                  placeholderTextColor={colors.text.muted}
                  keyboardType="numbers-and-punctuation"
                />
              ) : (
                <Text style={s.fieldValue}>{event.date.split('T')[0]}</Text>
              )}
            </Row>

            <Row icon={<Clock size={12} color={colors.text.muted} />} label="Godzina">
              {editing ? (
                <View style={s.timeRow}>
                  <TextInput
                    value={startTime}
                    onChangeText={setStartTime}
                    style={[s.fieldInput, { flex: 1 }]}
                    placeholder="08:00"
                    placeholderTextColor={colors.text.muted}
                    keyboardType="numbers-and-punctuation"
                  />
                  <Text style={s.timeSep}>→</Text>
                  <TextInput
                    value={endTime}
                    onChangeText={setEndTime}
                    style={[s.fieldInput, { flex: 1 }]}
                    placeholder="09:00"
                    placeholderTextColor={colors.text.muted}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              ) : (
                <Text style={s.fieldValue}>
                  {event.startTime
                    ? `${event.startTime}${event.endTime ? ` → ${event.endTime}` : ''}`
                    : 'Cały dzień'}
                </Text>
              )}
            </Row>

            <Row icon={<Flag size={12} color={colors.text.muted} />} label="Priorytet">
              <View style={s.pillRow}>
                {PRIORITIES.map(p => {
                  const active = (editing ? priority : event.priority) === p.value;
                  return (
                    <PressableScale
                      key={p.value}
                      onPress={() => { if (editing) { haptic.tap(); setPriority(p.value); } }}
                      style={[s.pill, active && { borderColor: p.color, backgroundColor: p.color + '18' }]}
                    >
                      <Text style={[s.pillText, active && { color: p.color }]}>{p.label}</Text>
                    </PressableScale>
                  );
                })}
              </View>
            </Row>

            {editing && (
              <Row icon={<Circle size={12} color={colors.text.muted} />} label="Kolor">
                <View style={s.colorRow}>
                  {EVENT_COLORS.map(c => (
                    <PressableScale key={c} onPress={() => { haptic.tap(); setColor(c); }}>
                      <View style={[
                        s.colorDot,
                        { backgroundColor: c },
                        color === c && { borderWidth: 2.5, borderColor: colors.text.primary, transform: [{ scale: 1.2 }] },
                      ]} />
                    </PressableScale>
                  ))}
                </View>
              </Row>
            )}
          </View>

          {/* Meta */}
          <Text style={s.meta}>
            Utworzono: {new Date(event.createdAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border.subtle,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtn: { backgroundColor: colors.text.primary, borderColor: colors.text.primary },
  colorPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing[3], paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1, alignSelf: 'flex-start',
  },
  colorPillText: { fontSize: 12, fontWeight: '600' },
  headerActions: { flexDirection: 'row', gap: spacing[2] },

  scroll: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[10] },

  titleCard: {
    backgroundColor: colors.bg.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border.default,
    borderLeftWidth: 3, padding: spacing[4], gap: spacing[2],
  },
  titleText: { fontSize: 22, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.3, lineHeight: 28 },
  titleInput: { fontSize: 22, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.3, lineHeight: 28, padding: 0 },
  descText: { fontSize: 14, color: colors.text.secondary, lineHeight: 20 },
  descInput: { fontSize: 14, color: colors.text.secondary, lineHeight: 20, padding: 0 },

  card: {
    backgroundColor: colors.bg.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border.default,
    paddingHorizontal: spacing[4],
  },

  fieldValue: { fontSize: 14, color: colors.text.secondary, lineHeight: 20 },
  fieldInput: {
    fontSize: 14, color: colors.text.primary,
    backgroundColor: colors.bg.elevated, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  timeSep: { color: colors.text.muted, fontSize: 14 },

  pillRow: { flexDirection: 'row', gap: spacing[2] },
  pill: {
    paddingHorizontal: spacing[3], paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border.default,
    backgroundColor: colors.bg.elevated,
  },
  pillText: { fontSize: 12, fontWeight: '600', color: colors.text.muted },

  colorRow: { flexDirection: 'row', gap: spacing[3], flexWrap: 'wrap' },
  colorDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 0, borderColor: 'transparent' },

  meta: { fontSize: 11, color: colors.text.muted, paddingHorizontal: spacing[1] },

  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { color: colors.text.secondary, fontSize: 16 },
});

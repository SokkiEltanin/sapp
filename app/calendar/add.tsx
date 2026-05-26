import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Alert, InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { X, Check, CalendarDays, ListTodo, Clock, Flag } from 'lucide-react-native';

import InputField from '@/components/ui/InputField';
import AnimatedButton from '@/components/ui/AnimatedButton';
import PressableScale from '@/components/ui/PressableScale';
import { EventPriority, TaskStatus } from '@/types';
import { calendarService, tasksService } from '@/services/calendarService';
import { notificationsService } from '@/services/notificationsService';
import { useCalendarStore } from '@/store/calendarStore';
import { colors, spacing, radius, typography } from '@/theme';

type FormType = 'task' | 'event';

const PRIORITY_OPTIONS: { value: EventPriority; label: string; color: string }[] = [
  { value: 'high',   label: 'Pilne',    color: colors.accent.danger },
  { value: 'normal', label: 'Normalne', color: colors.text.primary },
  { value: 'low',    label: 'Niskie',   color: colors.text.muted },
];

const EVENT_COLORS = ['#6C63FF', '#43D98F', '#FF6584', '#FFBE55', '#55B4FF', '#A78BFA'];

export default function AddCalendarModal() {
  const params = useLocalSearchParams<{ startTime?: string; type?: string; date?: string }>();
  const [type, setType] = useState<FormType>(params.type === 'event' ? 'event' : 'task');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState(params.date ?? '');
  const [startTime, setStartTime] = useState(params.startTime ?? '');
  const [endTime, setEndTime] = useState('');
  const [priority, setPriority] = useState<EventPriority>('normal');
  const [eventColor, setEventColor] = useState(EVENT_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const { selectedDate, addTask, addEvent } = useCalendarStore();

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Błąd', 'Wpisz tytuł');
      return;
    }

    setSaving(true);
    try {
      if (type === 'task') {
        const deadlineDate = deadline.trim() || selectedDate;
        const deadlineIso = deadlineDate ? deadlineDate + 'T23:59:00.000Z' : undefined;
        const task = await tasksService.addTask({
          title: title.trim(),
          description: description.trim() || undefined,
          deadline: deadlineIso,
          status: 'pending' as TaskStatus,
          priority,
          tags: [],
        });
        router.back();
        InteractionManager.runAfterInteractions(() => {
          addTask(task);
        });
      } else {
        const event = await calendarService.addEvent({
          title: title.trim(),
          description: description.trim() || undefined,
          date: (deadline.trim() || selectedDate) + 'T12:00:00.000Z',
          startTime: startTime.trim() || undefined,
          endTime: endTime.trim() || undefined,
          allDay: !startTime.trim(),
          priority,
          color: eventColor,
        });
        router.back();
        InteractionManager.runAfterInteractions(() => {
          addEvent(event);
          if (event.startTime) {
            notificationsService.scheduleEventReminder(event.id, event.title, event.date, event.startTime).catch(() => {});
          }
        });
      }
    } catch (e: any) {
      setSaving(false);
      Alert.alert('Błąd', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={20}
      >
        <View style={styles.header}>
          <PressableScale onPress={() => router.back()} style={styles.closeBtn}>
            <X size={20} color={colors.text.secondary} />
          </PressableScale>
          <Text style={styles.headerTitle}>
            {type === 'task' ? 'Nowe zadanie' : 'Nowe wydarzenie'}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Type toggle */}
        <View style={styles.typeToggle}>
          <PressableScale
            onPress={() => setType('task')}
            style={[styles.typeBtn, type === 'task' && styles.typeBtnActive]}
          >
            <ListTodo size={16} color={type === 'task' ? colors.bg.primary : colors.text.muted} />
            <Text style={[styles.typeBtnText, type === 'task' && styles.typeBtnTextActive]}>Zadanie</Text>
          </PressableScale>
          <PressableScale
            onPress={() => setType('event')}
            style={[styles.typeBtn, type === 'event' && styles.typeBtnActive]}
          >
            <CalendarDays size={16} color={type === 'event' ? colors.bg.primary : colors.text.muted} />
            <Text style={[styles.typeBtnText, type === 'event' && styles.typeBtnTextActive]}>Wydarzenie</Text>
          </PressableScale>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <View>
            <InputField
              label="Tytuł"
              value={title}
              onChangeText={setTitle}
              placeholder={type === 'task' ? 'Co trzeba zrobić?' : 'Nazwa wydarzenia'}
              returnKeyType="next"
            />
          </View>

          {/* Description */}
          <View>
            <InputField
              label="Opis (opcjonalnie)"
              value={description}
              onChangeText={setDescription}
              placeholder="Dodatkowe szczegóły..."
              multiline
              numberOfLines={2}
              textAlignVertical="top"
              containerStyle={{ minHeight: 72 }}
            />
          </View>

          {/* Date */}
          <View>
            <InputField
              label={type === 'task' ? 'Termin (RRRR-MM-DD)' : 'Data (RRRR-MM-DD)'}
              value={deadline}
              onChangeText={setDeadline}
              placeholder={selectedDate}
              leftSlot={<CalendarDays size={16} color={colors.text.muted} />}
              keyboardType="numbers-and-punctuation"
            />
          </View>

          {/* Time — events only */}
          {type === 'event' && (
            <View style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <InputField
                  label="Początek (GG:MM)"
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="08:00"
                  leftSlot={<Clock size={16} color={colors.text.muted} />}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={{ flex: 1 }}>
                <InputField
                  label="Koniec (GG:MM)"
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="09:00"
                  leftSlot={<Clock size={16} color={colors.text.muted} />}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
          )}

          {/* Priority */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              <Flag size={11} color={colors.text.muted} /> Priorytet
            </Text>
            <View style={styles.priorityRow}>
              {PRIORITY_OPTIONS.map(opt => {
                const active = priority === opt.value;
                const isHigh = opt.value === 'high';
                return (
                  <PressableScale
                    key={opt.value}
                    onPress={() => setPriority(opt.value)}
                    style={[
                      styles.priorityBtn,
                      active && (isHigh
                        ? { backgroundColor: colors.accent.danger + '18', borderColor: colors.accent.danger }
                        : { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.35)' }
                      ),
                    ]}
                  >
                    <Text style={[
                      styles.priorityBtnText,
                      active && { color: isHigh ? colors.accent.danger : colors.text.primary, fontWeight: '700' },
                    ]}>
                      {opt.label}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>

          {/* Color — events only */}
          {type === 'event' && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Kolor</Text>
              <View style={styles.colorRow}>
                {EVENT_COLORS.map(c => (
                  <PressableScale
                    key={c}
                    onPress={() => setEventColor(c)}
                    style={[styles.colorDot, { backgroundColor: c }, eventColor === c ? styles.colorDotSelected : undefined]}
                  >
                    <View />
                  </PressableScale>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <AnimatedButton
            onPress={handleSave}
            label={saving ? 'Zapisuję...' : (type === 'task' ? 'Dodaj zadanie' : 'Dodaj wydarzenie')}
            icon={<Check size={18} color={colors.bg.primary} />}
            size="lg"
            fullWidth
            disabled={saving}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.secondary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border.subtle,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.bg.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border.default,
  },
  headerTitle: { ...typography.h4, color: colors.text.primary },
  typeToggle: {
    flexDirection: 'row', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border.subtle,
  },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[2], paddingVertical: spacing[2], borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.bg.card,
  },
  typeBtnActive: {
    backgroundColor: colors.text.primary,
    borderColor: colors.text.primary,
  },
  typeBtnText: { ...typography.label, color: colors.text.muted, fontWeight: '600' },
  typeBtnTextActive: { color: colors.bg.primary },
  scroll: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[6] },
  timeRow: { flexDirection: 'row', gap: spacing[3] },
  section: { gap: spacing[3] },
  sectionLabel: {
    ...typography.label, color: colors.text.secondary,
    textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 11,
  },
  priorityRow: { flexDirection: 'row', gap: spacing[2] },
  priorityBtn: {
    flex: 1, alignItems: 'center', paddingVertical: spacing[2],
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border.default,
    backgroundColor: colors.bg.card,
  },
  priorityBtnText: { ...typography.label, color: colors.text.muted, fontWeight: '600' },
  colorRow: { flexDirection: 'row', gap: spacing[3], flexWrap: 'wrap' },
  colorDot: {
    width: 32, height: 32, borderRadius: radius.full,
    borderWidth: 2, borderColor: 'transparent',
  },
  colorDotSelected: { borderColor: colors.white, transform: [{ scale: 1.15 }] },
  footer: { padding: spacing[4], borderTopWidth: 1, borderTopColor: colors.border.subtle },
});


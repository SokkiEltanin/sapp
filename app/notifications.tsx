import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Bell, Smile, ListChecks, Repeat, Wrench, Wallet, Briefcase, CreditCard, ChevronLeft,
} from 'lucide-react-native';

import { notificationsService } from '@/services/notificationsService';
import { useMoodStore } from '@/store/moodStore';
import { haptic } from '@/utils/haptics';
import { useColors } from '@/theme/useColors';
import { spacing, radius } from '@/theme';

type NotifType = {
  flag: string;            // AsyncStorage key; absent or 'true' = on, 'false' = off
  label: string;
  desc: string;
  Icon: any;
  color: string;
  ids?: string[];          // exact scheduled identifiers to cancel on toggle-off
  prefixes?: string[];     // identifier prefixes to cancel on toggle-off
};

const TYPES: NotifType[] = [
  { flag: 'notif_mood_enabled',        label: 'Humor',            desc: 'Wieczorne przypomnienie o zapisaniu nastroju', Icon: Smile,      color: '#8B5CF6', ids: ['daily-mood', 'morning-mood'] },
  { flag: 'notif_todo_enabled',        label: 'Lista zadań',      desc: 'Codzienne podsumowanie zadań do zrobienia',     Icon: ListChecks, color: '#2AC68F', ids: ['daily-todo-list', 'daily-briefing'] },
  { flag: 'notif_habits_enabled',      label: 'Nawyki',           desc: 'Przypomnienie o nieodhaczonych nawykach',        Icon: Repeat,     color: '#46B0DE', ids: ['daily-habits'] },
  { flag: 'notif_maintenance_enabled', label: 'Serwis / wymiana', desc: 'Zbliżający się serwis pojazdu lub przedmiotu',   Icon: Wrench,     color: '#F59E0B', ids: ['maintenance-due'] },
  { flag: 'notif_budget_enabled',      label: 'Budżet / limity',  desc: 'Zbliżanie się i przekroczenie limitów wydatków', Icon: Wallet,     color: '#E43434', ids: ['budget-limit'] },
  { flag: 'notif_work_enabled',        label: 'Zmiany w pracy',   desc: 'Początek i koniec zmiany (+ ile zarobiono)',    Icon: Briefcase,  color: '#5B7BE3', prefixes: ['work-start-', 'work-end-'] },
  { flag: 'notif_subs_enabled',        label: 'Subskrypcje',      desc: 'Przypomnienie przed odnowieniem subskrypcji',    Icon: CreditCard, color: '#A78BFA', prefixes: ['sub-'] },
];

async function cancelType(t: NotifType) {
  for (const id of t.ids ?? []) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  if (t.prefixes?.length) {
    const all = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
    for (const n of all) {
      if (t.prefixes.some(p => n.identifier?.startsWith(p))) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
      }
    }
  }
}

export default function NotificationsScreen() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  const [master, setMaster] = useState(true);
  const [flags, setFlags] = useState<Record<string, boolean>>({});

  useEffect(() => {
    AsyncStorage.getItem('notif_enabled').then(v => setMaster(v !== 'false')).catch(() => {});
    AsyncStorage.multiGet(TYPES.map(t => t.flag)).then(pairs => {
      const next: Record<string, boolean> = {};
      for (const [k, v] of pairs) next[k] = v !== 'false'; // default ON
      setFlags(next);
    }).catch(() => {});
  }, []);

  const toggleMaster = useCallback(async (val: boolean) => {
    haptic.tap();
    setMaster(val);
    await AsyncStorage.setItem('notif_enabled', val ? 'true' : 'false').catch(() => {});
    if (!val) {
      await notificationsService.cancelAll().catch(() => {});
    } else {
      // Re-arm the state-aware ones we can without extra context.
      const moodOn = (await AsyncStorage.getItem('notif_mood_enabled')) !== 'false';
      if (moodOn) await notificationsService.refreshMoodReminder(useMoodStore.getState().todayEntry != null).catch(() => {});
    }
  }, []);

  const toggleType = useCallback(async (t: NotifType, val: boolean) => {
    haptic.tap();
    setFlags(f => ({ ...f, [t.flag]: val }));
    await AsyncStorage.setItem(t.flag, val ? 'true' : 'false').catch(() => {});
    if (!val) {
      await cancelType(t);
    } else if (t.flag === 'notif_mood_enabled' && master) {
      await notificationsService.refreshMoodReminder(useMoodStore.getState().todayEntry != null).catch(() => {});
    }
  }, [master]);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={s.backBtn}><ChevronLeft size={22} color={c.text.primary} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Powiadomienia</Text>
          <Text style={s.subtitle}>Włącz lub wyłącz każdy typ osobno</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing[4], paddingBottom: 120, gap: spacing[2] }} showsVerticalScrollIndicator={false}>
        {/* Master */}
        <View style={[s.row, s.masterRow]}>
          <View style={[s.iconWrap, { backgroundColor: c.text.primary + '18' }]}><Bell size={18} color={c.text.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.rowLabel}>Wszystkie powiadomienia</Text>
            <Text style={s.rowDesc}>Główny wyłącznik — gdy off, nic nie przychodzi</Text>
          </View>
          <Switch
            value={master}
            onValueChange={toggleMaster}
            trackColor={{ false: c.fill.medium, true: c.accent.green + 'AA' }}
            thumbColor={master ? c.text.primary : c.text.muted}
          />
        </View>

        <Text style={s.sectionLabel}>TYPY</Text>

        {TYPES.map(t => {
          const on = flags[t.flag] ?? true;
          const effective = on && master;
          return (
            <View key={t.flag} style={[s.row, !master && { opacity: 0.45 }]}>
              <View style={[s.iconWrap, { backgroundColor: t.color + '22' }]}><t.Icon size={16} color={t.color} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>{t.label}</Text>
                <Text style={s.rowDesc}>{t.desc}</Text>
              </View>
              <Switch
                value={effective}
                disabled={!master}
                onValueChange={(v) => toggleType(t, v)}
                trackColor={{ false: c.fill.medium, true: t.color + 'AA' }}
                thumbColor={effective ? '#fff' : c.text.muted}
              />
            </View>
          );
        })}

        <Text style={s.note}>
          Wypłata i przypomnienia konkretnych zadań/wydarzeń ustawisz przy nich (Ustawienia → Wypłata, edycja zadania).
          Włączenie typu zacznie działać przy następnym otwarciu lub zdarzeniu.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], paddingHorizontal: spacing[3], paddingTop: spacing[2], paddingBottom: spacing[2] },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: c.text.primary },
  subtitle: { fontSize: 11, color: c.text.muted, marginTop: 1 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: c.text.muted, letterSpacing: 0.6, marginTop: spacing[3], marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: c.bg.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: spacing[3], paddingVertical: spacing[3] },
  masterRow: { borderColor: c.border.subtle, backgroundColor: c.fill.subtle },
  iconWrap: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 14, fontWeight: '700', color: c.text.primary },
  rowDesc: { fontSize: 11, color: c.text.muted, marginTop: 2, lineHeight: 15 },
  note: { fontSize: 11, color: c.text.muted, lineHeight: 16, marginTop: spacing[3], paddingHorizontal: spacing[1] },
});

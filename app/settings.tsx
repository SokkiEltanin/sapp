import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ChevronLeft, Bell, BellOff, Moon, Sun,
  Smile, ListTodo, CalendarDays, Database, PiggyBank, Check, Footprints, Droplets,
  Zap, ClipboardList, LogIn, User,
} from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, linkWithCredential, signInWithCredential, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/services/firebase';

import PressableScale from '@/components/ui/PressableScale';
import InputField from '@/components/ui/InputField';
import AnimatedButton from '@/components/ui/AnimatedButton';
import { notificationsService } from '@/services/notificationsService';
import { useMoodStore } from '@/store/moodStore';
import { useExpensesStore } from '@/store/expensesStore';
import { useCalendarStore } from '@/store/calendarStore';
import { getBudgets, saveBudgets, MonthlyBudgets } from '@/utils/budgets';
import { getHealthGoals, saveHealthGoals } from '@/utils/healthGoals';
import { CATEGORY_META } from '@/utils/categories';
import { ExpenseCategory } from '@/types';
import { toast } from '@/store/toastStore';
import { colors, spacing, radius, typography } from '@/theme';

WebBrowser.maybeCompleteAuthSession();

const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  const { entries: moodEntries } = useMoodStore();
  const { expenses } = useExpensesStore();
  const { tasks, events } = useCalendarStore();

  const [googleUser, setGoogleUser] = useState<string | null>(null);
  const [googleLinking, setGoogleLinking] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setGoogleUser(user?.isAnonymous === false ? (user.email ?? user.displayName) : null);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (response?.type !== 'success') return;
    const { id_token } = response.params;
    const credential = GoogleAuthProvider.credential(id_token);
    setGoogleLinking(true);
    const current = auth.currentUser;
    const doLink = current?.isAnonymous
      ? linkWithCredential(current, credential)
      : signInWithCredential(auth, credential);
    doLink
      .then((result) => setGoogleUser(result.user.email ?? result.user.displayName))
      .catch((e) => Alert.alert('Błąd', e.message))
      .finally(() => setGoogleLinking(false));
  }, [response]);

  const [notifEnabled, setNotifEnabled] = useState(true);
  const [eveningHour, setEveningHour] = useState('20');
  const [eveningMin, setEveningMin]   = useState('00');
  const [morningHour, setMorningHour] = useState('8');
  const [morningMin, setMorningMin]   = useState('00');
  const [morningEnabled, setMorningEnabled] = useState(false);
  const [briefingEnabled, setBriefingEnabled] = useState(false);
  const [briefingHour, setBriefingHour]   = useState('7');
  const [briefingMin, setBriefingMin]     = useState('30');
  const [habitNotifEnabled, setHabitNotifEnabled] = useState(false);
  const [habitHour, setHabitHour]         = useState('21');
  const [habitMin, setHabitMin]           = useState('00');

  const [budgetInputs, setBudgetInputs] = useState<Partial<Record<ExpenseCategory, string>>>({});
  const [stepGoal, setStepGoal]   = useState('10000');
  const [waterGoal, setWaterGoal] = useState('8');

  useEffect(() => {
    getBudgets().then(b => {
      const inputs: Partial<Record<ExpenseCategory, string>> = {};
      for (const [k, v] of Object.entries(b)) {
        if (v) inputs[k as ExpenseCategory] = String(v);
      }
      setBudgetInputs(inputs);
    });
    getHealthGoals().then(g => {
      setStepGoal(String(g.stepGoal));
      setWaterGoal(String(g.waterGoal));
    });
  }, []);

  const handleSaveBudgets = async () => {
    const budgets: MonthlyBudgets = {};
    for (const [k, v] of Object.entries(budgetInputs)) {
      const n = parseFloat((v as string).replace(',', '.'));
      if (n > 0) budgets[k as ExpenseCategory] = n;
    }
    await saveBudgets(budgets);
    toast.success('Budżet zapisany');
  };

  const saveReminders = async () => {
    const eh = parseInt(eveningHour), em = parseInt(eveningMin);
    const mh = parseInt(morningHour), mm = parseInt(morningMin);
    const bh = parseInt(briefingHour), bm = parseInt(briefingMin);
    const hh = parseInt(habitHour), hmm = parseInt(habitMin);
    if (isNaN(eh) || eh < 0 || eh > 23 || isNaN(em) || em < 0 || em > 59) {
      Alert.alert('Błąd', 'Podaj poprawny czas wieczorny');
      return;
    }
    try {
      const granted = await notificationsService.requestPermissions();
      if (!granted) {
        Alert.alert('Brak uprawnień', 'Włącz powiadomienia w ustawieniach systemu');
        return;
      }
      await notificationsService.scheduleDailyMoodReminder(eh, em);
      if (morningEnabled) {
        await notificationsService.scheduleMorningMoodReminder(mh, mm);
      } else {
        await notificationsService.cancelMorningReminder();
      }
      if (briefingEnabled && !isNaN(bh) && !isNaN(bm)) {
        await notificationsService.scheduleDailyTaskBriefing(bh, bm);
      } else {
        await notificationsService.cancelDailyTaskBriefing();
      }
      if (habitNotifEnabled && !isNaN(hh) && !isNaN(hmm)) {
        await notificationsService.scheduleDailyHabitReminder(hh, hmm);
      } else {
        await notificationsService.cancelDailyHabitReminder();
      }
      toast.success('Przypomnienia zapisane');
    } catch {
      Alert.alert('Błąd', 'Nie udało się ustawić przypomnień');
    }
  };

  const toggleNotifications = async (val: boolean) => {
    setNotifEnabled(val);
    if (!val) {
      await notificationsService.cancelAll();
    } else {
      const h = parseInt(eveningHour) || 20;
      const m = parseInt(eveningMin) || 0;
      const granted = await notificationsService.requestPermissions();
      if (granted) await notificationsService.scheduleDailyMoodReminder(h, m);
    }
  };

  const clearNotifications = () => {
    Alert.alert(
      'Wyczyść powiadomienia',
      'Czy na pewno chcesz anulować wszystkie zaplanowane powiadomienia?',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Wyczyść',
          style: 'destructive',
          onPress: async () => {
            await notificationsService.cancelAll();
            Alert.alert('Gotowe', 'Wszystkie powiadomienia anulowane');
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={22} color={colors.text.secondary} />
        </PressableScale>
        <Text style={styles.headerTitle}>Ustawienia</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Notifications */}
        <View>
          <Text style={styles.sectionTitle}>Powiadomienia</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.iconWrap}>
                <Bell size={16} color={colors.text.secondary} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Przypomnienie nastroju</Text>
                <Text style={styles.rowSub}>Codzienne powiadomienie wieczorne</Text>
              </View>
              <Switch
                value={notifEnabled}
                onValueChange={toggleNotifications}
                trackColor={{ false: colors.bg.elevated, true: 'rgba(255,255,255,0.3)' }}
                thumbColor={notifEnabled ? colors.text.primary : colors.text.muted}
              />
            </View>

            {notifEnabled && (
              <>
                {/* Evening */}
                <View style={styles.notifLabel}>
                  <Moon size={12} color={colors.text.muted} />
                  <Text style={styles.notifLabelText}>Wieczór</Text>
                </View>
                <View style={styles.timeRow}>
                  <View style={styles.timeField}>
                    <InputField
                      value={eveningHour}
                      onChangeText={setEveningHour}
                      placeholder="20"
                      keyboardType="number-pad"
                      containerStyle={{ flex: 1 }}
                      style={styles.timeInput}
                      maxLength={2}
                    />
                    <Text style={styles.timeSep}>:</Text>
                    <InputField
                      value={eveningMin}
                      onChangeText={setEveningMin}
                      placeholder="00"
                      keyboardType="number-pad"
                      containerStyle={{ flex: 1 }}
                      style={styles.timeInput}
                      maxLength={2}
                    />
                  </View>
                </View>

                {/* Morning toggle */}
                <View style={[styles.row, { paddingTop: 0 }]}>
                  <View style={styles.iconWrap}>
                    <Sun size={14} color={colors.text.secondary} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>Poranne przypomnienie</Text>
                    <Text style={styles.rowSub}>Check-in z rana</Text>
                  </View>
                  <Switch
                    value={morningEnabled}
                    onValueChange={setMorningEnabled}
                    trackColor={{ false: colors.bg.elevated, true: 'rgba(255,255,255,0.3)' }}
                    thumbColor={morningEnabled ? colors.text.primary : colors.text.muted}
                  />
                </View>

                {morningEnabled && (
                  <View style={styles.timeRow}>
                    <View style={styles.timeField}>
                      <InputField
                        value={morningHour}
                        onChangeText={setMorningHour}
                        placeholder="8"
                        keyboardType="number-pad"
                        containerStyle={{ flex: 1 }}
                        style={styles.timeInput}
                        maxLength={2}
                      />
                      <Text style={styles.timeSep}>:</Text>
                      <InputField
                        value={morningMin}
                        onChangeText={setMorningMin}
                        placeholder="00"
                        keyboardType="number-pad"
                        containerStyle={{ flex: 1 }}
                        style={styles.timeInput}
                        maxLength={2}
                      />
                    </View>
                  </View>
                )}

                {/* Daily task briefing */}
                <View style={[styles.row, { paddingTop: 0 }]}>
                  <View style={styles.iconWrap}>
                    <ClipboardList size={14} color={colors.text.secondary} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>Poranny plan dnia</Text>
                    <Text style={styles.rowSub}>Przypomnienie o zadaniach rano</Text>
                  </View>
                  <Switch
                    value={briefingEnabled}
                    onValueChange={setBriefingEnabled}
                    trackColor={{ false: colors.bg.elevated, true: 'rgba(255,255,255,0.3)' }}
                    thumbColor={briefingEnabled ? colors.text.primary : colors.text.muted}
                  />
                </View>
                {briefingEnabled && (
                  <View style={styles.timeRow}>
                    <View style={styles.timeField}>
                      <InputField
                        value={briefingHour}
                        onChangeText={setBriefingHour}
                        placeholder="7"
                        keyboardType="number-pad"
                        containerStyle={{ flex: 1 }}
                        style={styles.timeInput}
                        maxLength={2}
                      />
                      <Text style={styles.timeSep}>:</Text>
                      <InputField
                        value={briefingMin}
                        onChangeText={setBriefingMin}
                        placeholder="30"
                        keyboardType="number-pad"
                        containerStyle={{ flex: 1 }}
                        style={styles.timeInput}
                        maxLength={2}
                      />
                    </View>
                  </View>
                )}

                {/* Habit reminder */}
                <View style={[styles.row, { paddingTop: 0 }]}>
                  <View style={styles.iconWrap}>
                    <Zap size={14} color={colors.accent.amber} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>Przypomnienie o nawykach</Text>
                    <Text style={styles.rowSub}>Wieczorne przypomnienie o nawykach</Text>
                  </View>
                  <Switch
                    value={habitNotifEnabled}
                    onValueChange={setHabitNotifEnabled}
                    trackColor={{ false: colors.bg.elevated, true: 'rgba(255,255,255,0.3)' }}
                    thumbColor={habitNotifEnabled ? colors.text.primary : colors.text.muted}
                  />
                </View>
                {habitNotifEnabled && (
                  <View style={styles.timeRow}>
                    <View style={styles.timeField}>
                      <InputField
                        value={habitHour}
                        onChangeText={setHabitHour}
                        placeholder="21"
                        keyboardType="number-pad"
                        containerStyle={{ flex: 1 }}
                        style={styles.timeInput}
                        maxLength={2}
                      />
                      <Text style={styles.timeSep}>:</Text>
                      <InputField
                        value={habitMin}
                        onChangeText={setHabitMin}
                        placeholder="00"
                        keyboardType="number-pad"
                        containerStyle={{ flex: 1 }}
                        style={styles.timeInput}
                        maxLength={2}
                      />
                    </View>
                  </View>
                )}

                <View style={styles.saveRow}>
                  <PressableScale onPress={saveReminders} style={styles.saveTimeBtn}>
                    <Text style={styles.saveTimeBtnText}>Zapisz przypomnienia</Text>
                  </PressableScale>
                </View>
              </>
            )}

            <PressableScale onPress={clearNotifications} style={styles.dangerRow}>
              <BellOff size={14} color={colors.accent.danger} />
              <Text style={[styles.dangerText, { color: colors.accent.danger }]}>Anuluj wszystkie powiadomienia</Text>
            </PressableScale>
          </View>
        </View>

        {/* Health goals */}
        <View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Cele zdrowotne</Text>
            <PressableScale
              onPress={async () => {
                const s = parseInt(stepGoal) || 10000;
                const w = parseInt(waterGoal) || 8;
                await saveHealthGoals({ stepGoal: s, waterGoal: w });
                toast.success('Cele zapisane');
              }}
              style={styles.saveBudgetBtn}
            >
              <Check size={14} color={colors.accent.success} />
              <Text style={styles.saveBudgetText}>Zapisz</Text>
            </PressableScale>
          </View>
          <View style={styles.card}>
            <View style={styles.budgetRow}>
              <View style={[styles.iconWrap, { backgroundColor: colors.accent.green + '18' }]}>
                <Footprints size={14} color={colors.accent.green} />
              </View>
              <Text style={styles.rowLabel}>Cel kroków</Text>
              <TextInput
                value={stepGoal}
                onChangeText={setStepGoal}
                placeholder="10000"
                placeholderTextColor={colors.text.muted}
                keyboardType="number-pad"
                style={styles.budgetInput}
              />
              <Text style={styles.budgetCur}>krok.</Text>
            </View>
            <View style={[styles.budgetRow, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }]}>
              <View style={[styles.iconWrap, { backgroundColor: colors.accent.blue + '18' }]}>
                <Droplets size={14} color={colors.accent.blue} />
              </View>
              <Text style={styles.rowLabel}>Cel wody</Text>
              <TextInput
                value={waterGoal}
                onChangeText={setWaterGoal}
                placeholder="8"
                placeholderTextColor={colors.text.muted}
                keyboardType="number-pad"
                style={styles.budgetInput}
              />
              <Text style={styles.budgetCur}>szkl.</Text>
            </View>
          </View>
        </View>

        {/* Monthly budgets */}
        <View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Budżet miesięczny</Text>
            <PressableScale onPress={handleSaveBudgets} style={styles.saveBudgetBtn}>
              <Check size={14} color={colors.accent.success} />
              <Text style={styles.saveBudgetText}>Zapisz</Text>
            </PressableScale>
          </View>
          <View style={styles.card}>
            {(Object.entries(CATEGORY_META) as [ExpenseCategory, typeof CATEGORY_META[ExpenseCategory]][])
              .filter(([cat]) => cat !== 'other')
              .map(([cat, meta], i) => {
                const IconComp = (LucideIcons as any)[meta.icon];
                return (
                  <View
                    key={cat}
                    style={[styles.budgetRow, i > 0 && { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }]}
                  >
                    <View style={[styles.iconWrap, { backgroundColor: meta.color + '18' }]}>
                      {IconComp && <IconComp size={14} color={meta.color} />}
                    </View>
                    <Text style={styles.rowLabel}>{meta.label}</Text>
                    <TextInput
                      value={budgetInputs[cat] ?? ''}
                      onChangeText={v => setBudgetInputs(prev => ({ ...prev, [cat]: v }))}
                      placeholder="—"
                      placeholderTextColor={colors.text.muted}
                      keyboardType="decimal-pad"
                      style={styles.budgetInput}
                    />
                    <Text style={styles.budgetCur}>zł</Text>
                  </View>
                );
              })}
          </View>
        </View>

        {/* Data overview */}
        <View>
          <Text style={styles.sectionTitle}>Dane</Text>
          <View style={styles.card}>
            {[
              { icon: <Smile size={14} color={colors.text.secondary} />, label: 'Wpisy nastroju', val: moodEntries.length },
              { icon: <Database size={14} color={colors.text.secondary} />, label: 'Transakcje', val: expenses.length },
              { icon: <ListTodo size={14} color={colors.text.secondary} />, label: 'Zadania', val: tasks.length },
              { icon: <CalendarDays size={14} color={colors.text.secondary} />, label: 'Wydarzenia', val: events.length },
            ].map((item, i) => (
              <View key={i} style={[styles.dataRow, i > 0 && { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }]}>
                <View style={styles.iconWrap}>
                  {item.icon}
                </View>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.dataVal}>{item.val}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Account */}
        <View>
          <Text style={styles.sectionTitle}>Konto</Text>
          <View style={styles.card}>
            {googleUser ? (
              <View style={styles.row}>
                <View style={[styles.iconWrap, { backgroundColor: '#4285F418' }]}>
                  <User size={16} color="#4285F4" />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>Zalogowano przez Google</Text>
                  <Text style={styles.rowSub}>{googleUser}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.row}>
                <View style={[styles.iconWrap, { backgroundColor: '#4285F418' }]}>
                  {googleLinking
                    ? <ActivityIndicator size="small" color="#4285F4" />
                    : <LogIn size={16} color="#4285F4" />}
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>Połącz z Google</Text>
                  <Text style={styles.rowSub}>Synchronizacja między urządzeniami</Text>
                </View>
                <PressableScale
                  onPress={() => promptAsync()}
                  disabled={!request || googleLinking}
                  style={styles.googleBtn}
                >
                  <Text style={styles.googleBtnText}>Połącz</Text>
                </PressableScale>
              </View>
            )}
          </View>
        </View>

        {/* About */}
        <View>
          <Text style={styles.sectionTitle}>Aplikacja</Text>
          <View style={styles.card}>
            <View style={styles.aboutHeader}>
              <View style={styles.appIcon}>
                <Text style={styles.appIconText}>S</Text>
              </View>
              <View>
                <Text style={styles.appName}>Sapp</Text>
                <Text style={styles.appVersion}>Wersja {APP_VERSION}</Text>
              </View>
            </View>
            <Text style={styles.aboutDesc}>
              Osobisty asystent: wydatki, kalendarz, nastrój, zdrowie. Zbudowany dla jednego użytkownika.
            </Text>

            {[
              { label: 'Baza danych', val: 'Firebase Firestore' },
              { label: 'Platforma', val: 'Android' },
              { label: 'Framework', val: 'Expo SDK 54' },
            ].map((item, i) => (
              <View key={i} style={[styles.dataRow, i > 0 && { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }]}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowSub}>{item.val}</Text>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border.subtle,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.bg.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border.default,
  },
  headerTitle: { ...typography.h3, color: colors.text.primary },
  scroll: { padding: spacing[4], gap: spacing[2], paddingBottom: spacing[10] },
  sectionTitle: {
    ...typography.label, color: colors.text.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 11,
    marginBottom: spacing[2], marginTop: spacing[2],
  },
  card: {
    backgroundColor: colors.bg.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    padding: spacing[4],
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  rowText: { flex: 1 },
  rowLabel: { ...typography.bodySmall, color: colors.text.primary, fontWeight: '500' },
  rowSub: { ...typography.caption, color: colors.text.muted, marginTop: 1 },
  timeRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[4], paddingBottom: spacing[3],
  },
  timeField: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.bg.elevated, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1],
  },
  timeSep: { ...typography.h4, color: colors.text.muted },
  timeInput: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  notifLabel: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingBottom: spacing[1],
  },
  notifLabelText: { ...typography.caption, color: colors.text.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
  saveRow: { paddingHorizontal: spacing[4], paddingBottom: spacing[3] },
  saveTimeBtn: {
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderRadius: radius.md, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  saveTimeBtnText: { ...typography.label, fontWeight: '700', color: colors.text.primary },
  dangerRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
  },
  dangerText: { ...typography.bodySmall, fontWeight: '500' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[2], marginTop: spacing[2] },
  saveBudgetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing[3], paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.accent.success + '18',
    borderWidth: 1, borderColor: colors.accent.success + '35',
  },
  saveBudgetText: { fontSize: 11, fontWeight: '700', color: colors.accent.success },
  budgetRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  budgetInput: {
    flex: 1, textAlign: 'right',
    fontSize: 15, fontWeight: '700', color: colors.text.primary,
    paddingHorizontal: spacing[2], paddingVertical: 4,
  },
  budgetCur: { ...typography.caption, color: colors.text.muted, fontWeight: '600', fontSize: 11 },
  dataRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  dataVal: { ...typography.h4, fontWeight: '800', color: colors.text.primary },
  googleBtn: {
    paddingHorizontal: spacing[3], paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: '#4285F418',
    borderWidth: 1, borderColor: '#4285F435',
  },
  googleBtnText: { fontSize: 12, fontWeight: '700', color: '#4285F4' },
  aboutHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    padding: spacing[4],
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  appIcon: {
    width: 52, height: 52, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  appIconText: { fontSize: 26, fontWeight: '900', color: colors.text.primary },
  appName: { ...typography.h3, color: colors.text.primary, fontWeight: '800' },
  appVersion: { ...typography.caption, color: colors.text.muted, marginTop: 2 },
  aboutDesc: {
    ...typography.bodySmall, color: colors.text.secondary, lineHeight: 20,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
});


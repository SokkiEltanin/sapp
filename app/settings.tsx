import { useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBalanceOffset, setBalanceOffset } from '@/utils/accountBalance';
import { isMine } from '@/store/statsScope';
import { shiftHours, shiftClockRange, isWorkEvent } from '@/utils/workEvents';
import { View, Text, StyleSheet, ScrollView, Switch, Alert, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ChevronLeft, Bell, BellOff, Moon, Sun,
  Smile, ListTodo, CalendarDays, Database, Check,
  Zap, ClipboardList, LogIn, User, Briefcase, Wallet, Clock,
} from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, linkWithCredential, signInWithCredential, onAuthStateChanged } from 'firebase/auth';
import * as Updates from 'expo-updates';
import { auth } from '@/services/firebase';

import PressableScale from '@/components/ui/PressableScale';
import InputField from '@/components/ui/InputField';
import AnimatedButton from '@/components/ui/AnimatedButton';
import { notificationsService } from '@/services/notificationsService';
import { useMoodStore } from '@/store/moodStore';
import { useExpensesStore } from '@/store/expensesStore';
import { useCalendarStore } from '@/store/calendarStore';
import { getBudgets, saveBudgets, MonthlyBudgets } from '@/utils/budgets';
import { getTagBudgetRules, saveTagBudgetRules, TagBudgetRule, SUGGESTED_TAGS } from '@/utils/tagBudgets';
import { CATEGORY_META } from '@/utils/categories';
import { ExpenseCategory } from '@/types';
import { toast } from '@/store/toastStore';
import { haptic } from '@/utils/haptics';
import { colors, spacing, radius, typography } from '@/theme';
import { Plus, Trash2, Tag, Vibrate } from 'lucide-react-native';
import { appSettings } from '@/utils/appSettings';
import { googleCalendarService } from '@/services/googleCalendarService';
import { useWorkStore } from '@/store/workStore';
import { workService } from '@/services/workService';

GoogleSignin.configure({
  webClientId: '1020705470960-3ki9emg74h6emun2nv1eh8cldgp2pn7a.apps.googleusercontent.com',
  offlineAccess: true,
  scopes: ['https://www.googleapis.com/auth/calendar.events'],
});

const APP_VERSION = '6.0.0';

export default function SettingsScreen() {
  const { entries: moodEntries } = useMoodStore();
  const { expenses } = useExpensesStore();
  const { tasks, events, gcalEvents } = useCalendarStore();
  const { settings: workSettings, setSettings: setWorkSettings } = useWorkStore();

  // ── Work calculation diagnostics ────────────────────────────────────────────
  // Shows EXACTLY what the rate is derived from: [JD] events → hours this month,
  // the settings salary/hours, the last [JD] paycheck, and the resulting rate.
  const workDiag = useMemo(() => {
    const wp = (workSettings.workPrefix ?? '').trim().toLowerCase();
    const wc = workSettings.workColor;
    if (!wp && !wc) return null;
    const p2 = (n: number) => String(n).padStart(2, '0');
    const allEvents = [...events, ...gcalEvents];
    const isWork = (e: any) => isWorkEvent(e, { workColor: wc, workPrefix: wp });
    // Hours read from the TITLE range ("HH:MM - HH:MM" / "(Nh)") so shifts that
    // differ from the calendar event's default time are counted correctly.
    const hoursIn = (ym: string) => allEvents
      .filter(e => isWork(e) && (e.date ?? '').slice(0, 7) === ym)
      .reduce((s, e) => s + shiftHours(e), 0);
    const now = new Date();
    const mk = `${now.getFullYear()}-${p2(now.getMonth() + 1)}`;
    const monthEvents = allEvents.filter(e => isWork(e) && (e.date ?? '').slice(0, 7) === mk);
    const monthHours = hoursIn(mk);
    // The actual detected shifts this month — shown so the user can verify the
    // count and tap to edit any of them.
    const monthShifts = monthEvents
      .map(e => {
        const r = shiftClockRange(e);
        return {
          id: e.id as string,
          title: (e.title ?? '') as string,
          date: (e.date ?? '').slice(0, 10),
          startTime: r?.start ?? (e.startTime as string) ?? '',
          endTime: r?.end ?? (e.endTime as string) ?? '',
          hours: shiftHours(e),
        };
      })
      .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
    const candidates = expenses.filter(e =>
      e.type === 'income' && (e.tags.some(t => t.toLowerCase() === wp) || (e.note ?? '').toLowerCase().includes(wp))
    ).sort((a, b) => b.date.localeCompare(a.date));
    const lastPaycheck = candidates[0] ?? null;
    const payMonth = lastPaycheck?.date.slice(0, 7) ?? null;
    // Denominator = the LAST COMPLETED month's hours (relative to today). The
    // current month is partial; only the previous month has full data.
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevDate.getFullYear()}-${p2(prevDate.getMonth() + 1)}`;
    const prevHours = hoursIn(prevMonth);
    const payHours = payMonth ? hoursIn(payMonth) : 0;
    // Hours basis: previous month → paycheck month → current month → manual.
    const basisHours = prevHours || payHours || monthHours || workSettings.hoursPerMonth;
    const rate = lastPaycheck && basisHours > 0
      ? lastPaycheck.amount / basisHours
      : (basisHours > 0 ? workSettings.monthlySalary / basisHours : 0);
    return { eventCount: monthEvents.length, monthHours, monthShifts, lastPaycheck, payMonth, payHours, prevMonth, prevHours, rate, fallbackHours: basisHours };
  }, [events, gcalEvents, expenses, workSettings]);

  const [workPrefix, setWorkPrefix] = useState(workSettings.workPrefix ?? '');
  const [salaryInput, setSalaryInput] = useState(String(workSettings.monthlySalary ?? ''));
  const [hoursInput, setHoursInput]   = useState(String(workSettings.hoursPerMonth ?? ''));

  useEffect(() => {
    workService.getSettings().then(s => {
      setWorkSettings(s);
      setWorkPrefix(s.workPrefix ?? '');
      setSalaryInput(String(s.monthlySalary ?? ''));
      setHoursInput(String(s.hoursPerMonth ?? ''));
    }).catch(() => {});
  }, []);

  const saveWorkNumber = async (field: 'monthlySalary' | 'hoursPerMonth', raw: string) => {
    const n = parseFloat(raw.replace(',', '.'));
    if (isNaN(n) || n < 0) return;
    const newS = { ...workSettings, [field]: n };
    setWorkSettings(newS);
    try { await workService.saveSettings(newS); } catch {}
  };

  const saveWorkPrefix = async (prefix: string) => {
    const trimmed = prefix.trim();
    const newS = { ...workSettings, workPrefix: trimmed || undefined };
    setWorkSettings(newS);
    try { await workService.saveSettings(newS); } catch {}
  };

  const [googleUser, setGoogleUser]   = useState<string | null>(null);
  const [googleLinking, setGoogleLinking] = useState(false);

  // ── Account balance reconciliation ──────────────────────────────────────────
  // Net of all entered transactions (income − expenses). Income without a proper
  // type is treated as an expense (same rule as the rest of the app) — the Audit
  // screen flags those.
  const accountNet = useMemo(() => {
    const unique = Array.from(new Map(expenses.map(e => [e.id, e])).values());
    let inc = 0, exp = 0;
    for (const e of unique) {
      // MUST match the Finances balance: only MY transactions count toward my
      // money. Otherwise the saved offset is computed against a different net
      // and the displayed balance drifts.
      if (!isMine(e)) continue;
      if (e.type === 'income') inc += e.amount;
      else exp += e.amount;
    }
    return inc - exp;
  }, [expenses]);
  const [balanceOffset, setBalanceOffsetState] = useState(0);
  const [balanceInput, setBalanceInput] = useState('');
  useEffect(() => { getBalanceOffset().then(setBalanceOffsetState).catch(() => {}); }, []);
  const saveAccountBalance = async () => {
    const real = parseFloat(balanceInput.replace(/\s/g, '').replace(',', '.'));
    if (isNaN(real)) return;
    const offset = real - accountNet;
    setBalanceOffsetState(offset);
    await setBalanceOffset(offset);
    setBalanceInput('');
    toast.success('Zapisano saldo konta');
  };

  const [hapticsOn, setHapticsOn]     = useState(appSettings.isHapticsEnabled());

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setGoogleUser(user?.isAnonymous === false ? (user.email ?? user.displayName) : null);
    });
    return unsub;
  }, []);

  const handleGoogleSignIn = async () => {
    setGoogleLinking(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken ?? (userInfo as any).idToken;
      if (!idToken) throw new Error('Brak id_token');
      const credential = GoogleAuthProvider.credential(idToken);
      const current = auth.currentUser;

      let result;
      if (current?.isAnonymous) {
        // Try to link the anonymous account → Google (keeps the same UID, so the
        // data created while anonymous stays attached).
        try {
          result = await linkWithCredential(current, credential);
        } catch (linkErr: any) {
          // The Google account was already used before (it owns a different UID).
          // Sign in to THAT existing account instead — its data is the source of truth.
          if (linkErr?.code === 'auth/credential-already-in-use'
              || linkErr?.code === 'auth/email-already-in-use') {
            result = await signInWithCredential(auth, credential);
          } else {
            throw linkErr;
          }
        }
      } else {
        result = await signInWithCredential(auth, credential);
      }

      // Store calendar access token for gcal sync after reload
      try {
        const tokens = await GoogleSignin.getTokens();
        await googleCalendarService.storeToken(tokens.accessToken);
      } catch {}

      setGoogleUser(result.user.email ?? result.user.displayName);

      // CRITICAL: after Google sign-in the active account may have changed, so
      // every in-memory store could hold the PREVIOUS account's data while
      // services now read the new UID's Firestore path → a half-refreshed,
      // inconsistent app (wrong finances, vanished lifebar). A full reload
      // re-initialises everything cleanly under the correct account and loads
      // the Google Calendar token in one clean pass.
      Alert.alert(
        'Zalogowano',
        'Aplikacja zostanie przeładowana, aby poprawnie wczytać Twoje dane.',
        [{ text: 'OK', onPress: () => { Updates.reloadAsync().catch(() => {}); } }],
      );
    } catch (e: any) {
      if (e.code !== statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert('Błąd logowania', `${e.message}\n\nKod: ${e.code ?? 'brak'}`);
      }
    } finally {
      setGoogleLinking(false);
    }
  };

  const [notifEnabled, setNotifEnabled] = useState(true);
  const [eveningHour, setEveningHour] = useState('20');
  const [eveningMin, setEveningMin]   = useState('00');
  const [morningHour, setMorningHour] = useState('8');
  const [morningMin, setMorningMin]   = useState('00');
  const [morningEnabled, setMorningEnabled] = useState(false);
  const [briefingEnabled, setBriefingEnabled] = useState(false);
  const [briefingHour, setBriefingHour]   = useState('8');
  const [briefingMin, setBriefingMin]     = useState('00');
  const [habitNotifEnabled, setHabitNotifEnabled] = useState(false);
  const [habitHour, setHabitHour]         = useState('21');
  const [habitMin, setHabitMin]           = useState('00');

  const [budgetInputs, setBudgetInputs] = useState<Partial<Record<ExpenseCategory, string>>>({});
  const [tagRules, setTagRules] = useState<TagBudgetRule[]>([]);
  const [newTag, setNewTag] = useState('');
  const [newTagLimit, setNewTagLimit] = useState('');
  const [newTagPeriod, setNewTagPeriod] = useState<'week' | 'month'>('month');

  useEffect(() => {
    getBudgets().then(b => {
      const inputs: Partial<Record<ExpenseCategory, string>> = {};
      for (const [k, v] of Object.entries(b)) {
        if (v) inputs[k as ExpenseCategory] = String(v);
      }
      setBudgetInputs(inputs);
    });
    getTagBudgetRules().then(setTagRules);
  }, []);

  const handleAddTagRule = async () => {
    const tag = newTag.trim().toLowerCase();
    const limit = parseFloat(newTagLimit.replace(',', '.'));
    if (!tag || !limit || limit <= 0) return;
    if (tagRules.some(r => r.tag === tag && r.period === newTagPeriod)) {
      toast.error('Reguła dla tego tagu już istnieje');
      return;
    }
    const rule: TagBudgetRule = {
      id: Date.now().toString(),
      tag,
      limit,
      period: newTagPeriod,
      createdAt: new Date().toISOString(),
    };
    const updated = [...tagRules, rule];
    setTagRules(updated);
    await saveTagBudgetRules(updated);
    setNewTag('');
    setNewTagLimit('');
    toast.success(`Reguła dla "${tag}" dodana`);
  };

  const handleDeleteTagRule = async (id: string) => {
    const updated = tagRules.filter(r => r.id !== id);
    setTagRules(updated);
    await saveTagBudgetRules(updated);
  };

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
        await AsyncStorage.setItem('notif_todo_enabled', 'true');
        await AsyncStorage.setItem('notif_todo_hour', String(bh));
        await AsyncStorage.setItem('notif_todo_min', String(bm));
        await notificationsService.scheduleDailyTodoList(bh, bm, tasks);
      } else {
        await AsyncStorage.setItem('notif_todo_enabled', 'false');
        await notificationsService.cancelDailyTodoList();
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

        {/* Haptics */}
        <View>
          <Text style={styles.sectionTitle}>Interfejs</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.iconWrap}>
                <Vibrate size={16} color={colors.text.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Wibracje</Text>
                <Text style={[styles.rowLabel, { fontSize: 11, color: colors.text.muted, fontWeight: '400', marginTop: 1 }]}>Haptyczne potwierdzenia przycisków</Text>
              </View>
              <Switch
                value={hapticsOn}
                onValueChange={(v) => { setHapticsOn(v); appSettings.setHapticsEnabled(v); }}
                trackColor={{ false: colors.bg.elevated, true: colors.accent.purple + '80' }}
                thumbColor={hapticsOn ? colors.accent.purple : colors.text.muted}
              />
            </View>
          </View>
        </View>

        {/* Work prefix */}
        <View>
          <Text style={styles.sectionTitle}>Praca</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.iconWrap, { backgroundColor: '#60A5FA18' }]}>
                <Briefcase size={16} color="#60A5FA" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Prefix eventów pracy</Text>
                <Text style={styles.rowSub}>
                  {workPrefix.trim()
                    ? `Eventy zaczynające się od "${workPrefix.trim()}" = zmiana`
                    : 'Np. [JD], [PRACA] — eventy z tym prefixem = zmiana'}
                </Text>
              </View>
              <TextInput
                value={workPrefix}
                onChangeText={setWorkPrefix}
                onBlur={() => saveWorkPrefix(workPrefix)}
                placeholder="[JD]"
                placeholderTextColor={colors.text.muted}
                autoCapitalize="none"
                style={{
                  fontSize: 14, fontWeight: '700', color: '#60A5FA',
                  minWidth: 72, textAlign: 'right',
                  paddingVertical: 4, paddingHorizontal: spacing[2],
                  backgroundColor: '#60A5FA12', borderRadius: radius.md,
                  borderWidth: 1, borderColor: '#60A5FA30',
                }}
              />
            </View>

            {/* Monthly salary — editable so the live "zł/sekundę" can be corrected */}
            <View style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.border.subtle }]}>
              <View style={[styles.iconWrap, { backgroundColor: '#2AC68F18' }]}>
                <Wallet size={16} color="#2AC68F" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Pensja miesięczna (zł)</Text>
                <Text style={styles.rowSub}>Podstawa wyliczania zarobku na żywo</Text>
              </View>
              <TextInput
                value={salaryInput}
                onChangeText={setSalaryInput}
                onBlur={() => saveWorkNumber('monthlySalary', salaryInput)}
                keyboardType="numeric"
                placeholder="5000"
                placeholderTextColor={colors.text.muted}
                style={{
                  fontSize: 14, fontWeight: '700', color: '#2AC68F',
                  minWidth: 80, textAlign: 'right',
                  paddingVertical: 4, paddingHorizontal: spacing[2],
                  backgroundColor: '#2AC68F12', borderRadius: radius.md,
                  borderWidth: 1, borderColor: '#2AC68F30',
                }}
              />
            </View>

            {/* Hours per month */}
            <View style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.border.subtle }]}>
              <View style={[styles.iconWrap, { backgroundColor: '#60A5FA18' }]}>
                <Clock size={16} color="#60A5FA" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Godzin w miesiącu</Text>
                <Text style={styles.rowSub}>
                  {(() => {
                    const sal = parseFloat(salaryInput.replace(',', '.'));
                    const manual = parseFloat(hoursInput.replace(',', '.'));
                    const cal = workDiag?.monthHours ?? 0;
                    // Calendar hours are the default basis; manual only overrides.
                    const hrs = !isNaN(manual) && manual > 0 ? manual : cal;
                    if (!isNaN(sal) && hrs > 0) {
                      const src = (!isNaN(manual) && manual > 0) ? 'ręcznie' : 'z kalendarza';
                      return `≈ ${(sal / hrs).toFixed(2)} zł/h  ·  ${hrs.toFixed(0)} h ${src}`;
                    }
                    return cal > 0 ? `Domyślnie ${cal.toFixed(0)} h z kalendarza` : 'Np. 168 — zapas gdy brak eventów';
                  })()}
                </Text>
              </View>
              <TextInput
                value={hoursInput}
                onChangeText={setHoursInput}
                onBlur={() => saveWorkNumber('hoursPerMonth', hoursInput)}
                keyboardType="numeric"
                placeholder={workDiag && workDiag.monthHours > 0 ? workDiag.monthHours.toFixed(0) : '168'}
                placeholderTextColor={colors.text.muted}
                style={{
                  fontSize: 14, fontWeight: '700', color: '#60A5FA',
                  minWidth: 64, textAlign: 'right',
                  paddingVertical: 4, paddingHorizontal: spacing[2],
                  backgroundColor: '#60A5FA12', borderRadius: radius.md,
                  borderWidth: 1, borderColor: '#60A5FA30',
                }}
              />
            </View>

            {/* Live diagnostics — stacked so nothing gets clipped */}
            {workDiag && (
              <View style={styles.diagBox}>
                <Text style={styles.diagTitle}>JAK LICZY SIĘ STAWKA (prefiks „{(workSettings.workPrefix ?? '').trim() || '—'}")</Text>

                <View style={styles.diagItem}>
                  <Text style={styles.diagItemLabel}>Godziny w kalendarzu — ten miesiąc (na żywo, z Google też)</Text>
                  <Text style={styles.diagItemVal}>{workDiag.monthHours.toFixed(1)} h · {workDiag.eventCount} zmian</Text>
                </View>

                <View style={styles.diagItem}>
                  <Text style={styles.diagItemLabel}>Ostatnia wypłata [{(workSettings.workPrefix ?? '').trim()}]</Text>
                  <Text style={[styles.diagItemVal, { color: workDiag.lastPaycheck ? '#2AC68F' : colors.accent.red }]}>
                    {workDiag.lastPaycheck
                      ? `${workDiag.lastPaycheck.amount.toFixed(0)} zł — ${workDiag.payMonth}`
                      : 'nie znaleziono'}
                  </Text>
                </View>

                <View style={styles.diagItem}>
                  <Text style={styles.diagItemLabel}>Godziny — poprzedni miesiąc ({workDiag.prevMonth}, pełne dane = podstawa stawki)</Text>
                  <Text style={styles.diagItemVal}>{workDiag.prevHours.toFixed(1)} h</Text>
                </View>

                <View style={styles.diagItem}>
                  <Text style={styles.diagItemLabel}>
                    {workDiag.lastPaycheck
                      ? 'Stawka = wypłata ÷ godziny z poprzedniego miesiąca'
                      : `Stawka = pensja ÷ ${workDiag.fallbackHours.toFixed(0)} h`}
                  </Text>
                  <Text style={[styles.diagItemVal, { color: '#FBBF24', fontWeight: '800', fontSize: 16 }]}>
                    {workDiag.rate.toFixed(2)} zł/h
                  </Text>
                </View>

                <Text style={styles.diagHint}>
                  Stawka na żywo liczy się z ostatniej wypłaty [{(workSettings.workPrefix ?? '').trim()}] i godzin z POPRZEDNIEGO (pełnego) miesiąca — bieżący miesiąc jest niepełny. Pola „pensja/godziny" wyżej to tylko zapas.
                </Text>

                {/* Detected shifts — what's actually counted; tap to edit */}
                <View style={styles.shiftList}>
                  <Text style={styles.shiftListTitle}>WYKRYTE ZMIANY — {workDiag.eventCount} ({workDiag.monthHours.toFixed(1)} h)</Text>
                  {workDiag.monthShifts.length === 0 ? (
                    <Text style={styles.shiftEmpty}>Brak zmian tego miesiąca pasujących do prefiksu.</Text>
                  ) : (
                    workDiag.monthShifts.map(s => (
                      <PressableScale
                        key={s.id}
                        onPress={() => { haptic.tap(); router.push(`/calendar/${s.id}` as any); }}
                        style={styles.shiftRow}
                      >
                        <View style={styles.shiftDot} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.shiftTitle} numberOfLines={1}>{s.title || 'Zmiana'}</Text>
                          <Text style={styles.shiftMeta}>{s.date} · {s.startTime}–{s.endTime}</Text>
                        </View>
                        <Text style={styles.shiftHours}>{s.hours.toFixed(1)} h</Text>
                        <LucideIcons.Pencil size={13} color={colors.text.muted} />
                      </PressableScale>
                    ))
                  )}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Account balance reconciliation */}
        <View>
          <Text style={styles.sectionTitle}>Saldo konta</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.iconWrap, { backgroundColor: '#5B7BE318' }]}>
                <Wallet size={16} color="#5B7BE3" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Aktualne saldo konta</Text>
                <Text style={styles.rowSub}>
                  App liczy teraz: {(balanceOffset + accountNet).toFixed(2)} zł.{'\n'}
                  Wpisz ile masz realnie — reszta policzy się sama.
                </Text>
              </View>
              <TextInput
                value={balanceInput}
                onChangeText={setBalanceInput}
                onBlur={saveAccountBalance}
                keyboardType="numeric"
                placeholder="np. 230,50"
                placeholderTextColor={colors.text.muted}
                style={{
                  fontSize: 14, fontWeight: '700', color: '#5B7BE3',
                  minWidth: 90, textAlign: 'right',
                  paddingVertical: 4, paddingHorizontal: spacing[2],
                  backgroundColor: '#5B7BE312', borderRadius: radius.md,
                  borderWidth: 1, borderColor: '#5B7BE330',
                }}
              />
            </View>
          </View>
        </View>

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

                {/* Daily todo list */}
                <View style={[styles.row, { paddingTop: 0 }]}>
                  <View style={styles.iconWrap}>
                    <ClipboardList size={14} color={colors.text.secondary} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>Lista zadań</Text>
                    <Text style={styles.rowSub}>Dziś, jutro i bezterminowe</Text>
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

        {/* Tag budgets */}
        <View>
          <Text style={styles.sectionTitle}>Limity na tagi</Text>
          <View style={styles.card}>
            {/* Existing rules */}
            {tagRules.map((rule, i) => (
              <View key={rule.id} style={[styles.budgetRow, i > 0 && { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }]}>
                <View style={[styles.iconWrap, { backgroundColor: colors.accent.purple + '18' }]}>
                  <Tag size={13} color={colors.accent.purple} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{rule.tag}</Text>
                  <Text style={styles.rowSub}>{rule.period === 'week' ? 'tygodniowo' : 'miesięcznie'}</Text>
                </View>
                <Text style={[styles.rowLabel, { color: colors.accent.amber }]}>{rule.limit} zł</Text>
                <PressableScale onPress={() => handleDeleteTagRule(rule.id)} style={{ padding: 6, marginLeft: 4 }}>
                  <Trash2 size={14} color={colors.accent.danger} />
                </PressableScale>
              </View>
            ))}

            {/* Suggested tags */}
            {tagRules.length === 0 && (
              <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[3], paddingBottom: spacing[2] }}>
                <Text style={styles.rowSub}>Sugerowane tagi z paragonów:</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {SUGGESTED_TAGS.map(t => (
                    <PressableScale key={t} onPress={() => setNewTag(t)}
                      style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full,
                        backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.default }}>
                      <Text style={{ fontSize: 11, color: colors.text.secondary }}>{t}</Text>
                    </PressableScale>
                  ))}
                </View>
              </View>
            )}

            {/* Add new rule */}
            <View style={{ padding: spacing[4], gap: spacing[3], borderTopWidth: tagRules.length > 0 ? 1 : 0, borderTopColor: 'rgba(255,255,255,0.05)' }}>
              <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                <TextInput
                  value={newTag}
                  onChangeText={setNewTag}
                  placeholder="tag (np. słodycze)"
                  placeholderTextColor={colors.text.muted}
                  style={[styles.budgetInput, { flex: 2, textAlign: 'left', paddingHorizontal: spacing[3],
                    backgroundColor: colors.bg.elevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border.default }]}
                />
                <TextInput
                  value={newTagLimit}
                  onChangeText={setNewTagLimit}
                  placeholder="limit zł"
                  placeholderTextColor={colors.text.muted}
                  keyboardType="decimal-pad"
                  style={[styles.budgetInput, { flex: 1, textAlign: 'right', paddingHorizontal: spacing[3],
                    backgroundColor: colors.bg.elevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border.default }]}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                {(['week', 'month'] as const).map(p => (
                  <PressableScale key={p} onPress={() => setNewTagPeriod(p)}
                    style={{ flex: 1, paddingVertical: 8, borderRadius: radius.md, alignItems: 'center',
                      backgroundColor: newTagPeriod === p ? colors.accent.purple + '22' : colors.bg.elevated,
                      borderWidth: 1, borderColor: newTagPeriod === p ? colors.accent.purple : colors.border.default }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: newTagPeriod === p ? colors.accent.purple : colors.text.secondary }}>
                      {p === 'week' ? 'Tygodniowo' : 'Miesięcznie'}
                    </Text>
                  </PressableScale>
                ))}
                <PressableScale onPress={handleAddTagRule}
                  style={{ paddingHorizontal: spacing[4], paddingVertical: 8, borderRadius: radius.md, alignItems: 'center',
                    backgroundColor: colors.accent.purple + '22', borderWidth: 1, borderColor: colors.accent.purple + '50' }}>
                  <Plus size={16} color={colors.accent.purple} />
                </PressableScale>
              </View>
            </View>
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
                  onPress={handleGoogleSignIn}
                  disabled={googleLinking}
                  style={styles.googleBtn}
                >
                  <Text style={styles.googleBtnText}>Połącz</Text>
                </PressableScale>
              </View>
            )}
          </View>
        </View>

        {/* Diagnostics */}
        <View>
          <Text style={styles.sectionTitle}>Diagnostyka</Text>
          <View style={styles.card}>
            <PressableScale
              onPress={() => { router.push('/expenses/audit' as any); }}
              style={styles.row}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#E4343418' }]}>
                <LucideIcons.Receipt size={16} color="#E43434" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Audyt finansów</Text>
                <Text style={styles.rowSub}>Zobacz dokładnie co składa się na sumę miesiąca</Text>
              </View>
              <ChevronLeft size={16} color={colors.text.muted} style={{ transform: [{ rotate: '180deg' }] }} />
            </PressableScale>
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
  diagBox: {
    marginTop: spacing[2], paddingTop: spacing[3],
    borderTopWidth: 1, borderTopColor: colors.border.subtle, gap: spacing[2],
  },
  diagTitle: { fontSize: 9, fontWeight: '800', color: colors.text.muted, letterSpacing: 0.8 },
  diagItem: { gap: 1 },
  diagItemLabel: { fontSize: 10.5, color: colors.text.muted, fontWeight: '500' },
  diagItemVal: { fontSize: 13, fontWeight: '700', color: colors.text.primary },
  diagHint: { fontSize: 11, color: colors.accent.amber, lineHeight: 15, marginTop: 2 },
  shiftList: {
    marginTop: spacing[2], paddingTop: spacing[3],
    borderTopWidth: 1, borderTopColor: colors.border.subtle, gap: spacing[1],
  },
  shiftListTitle: { fontSize: 9, fontWeight: '800', color: '#60A5FA', letterSpacing: 0.8, marginBottom: spacing[1] },
  shiftEmpty: { fontSize: 11, color: colors.text.muted, fontStyle: 'italic' },
  shiftRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingVertical: 7, paddingHorizontal: spacing[2],
    backgroundColor: 'rgba(96,165,250,0.07)', borderRadius: radius.md,
  },
  shiftDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#60A5FA' },
  shiftTitle: { fontSize: 12.5, fontWeight: '600', color: colors.text.primary },
  shiftMeta: { fontSize: 10.5, color: colors.text.muted, marginTop: 1 },
  shiftHours: { fontSize: 12, fontWeight: '700', color: '#60A5FA' },
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


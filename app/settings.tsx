import { useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBalanceOffset, setBalanceOffset } from '@/utils/accountBalance';
import { isMine } from '@/store/statsScope';
import { shiftHours, shiftClockRange, isWorkEvent } from '@/utils/workEvents';
import { computePayMonths } from '@/utils/workSummary';
import { View, Text, StyleSheet, ScrollView, Switch, Alert, TextInput, ActivityIndicator, Linking, Platform, LayoutAnimation, UIManager, Pressable } from 'react-native';
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
import { getTagBudgetRules, saveTagBudgetRules, TagBudgetRule, SUGGESTED_TAGS, ruleLabel } from '@/utils/tagBudgets';
import { getPayers } from '@/utils/payers';
import BackupSection from '@/components/settings/BackupSection';
import ConfirmedMonths from '@/components/settings/ConfirmedMonths';
import { useThemeStore, ThemeMode } from '@/store/themeStore';
import { CATEGORY_META } from '@/utils/categories';
import { ExpenseCategory } from '@/types';
import { toast } from '@/store/toastStore';
import { haptic } from '@/utils/haptics';
import { runSelfTest } from '@/utils/selfTest';
import { getPaydayConfig, setPaydayConfig } from '@/utils/payday';
import { colors, spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { Plus, Trash2, Tag, Vibrate } from 'lucide-react-native';
import { appSettings } from '@/utils/appSettings';
import { googleCalendarService } from '@/services/googleCalendarService';
import { useWorkStore } from '@/store/workStore';
import { useDashboardLayout } from '@/store/dashboardLayout';
import { useHeroFont, HERO_FONTS } from '@/store/heroFont';
import { useUiPrefs } from '@/store/uiPrefs';
import { runSamsungBackfill, backfillRange, isBackfillDone } from '@/utils/samsungBackfill';
import { useBankQueue } from '@/store/bankQueueStore';
import { ingestBankNotification } from '@/services/bankIngest';
import { workService } from '@/services/workService';

GoogleSignin.configure({
  webClientId: '1020705470960-3ki9emg74h6emun2nv1eh8cldgp2pn7a.apps.googleusercontent.com',
  offlineAccess: true,
  scopes: ['https://www.googleapis.com/auth/calendar.events'],
});

const APP_VERSION = 'V2';
// Build number injected from the GitHub Actions run (EXPO_PUBLIC_BUILD_NUMBER =
// github.run_number) so the in-app number MATCHES the "Build #N" GitHub release.
// Falls back to 'dev' for local runs.
const APP_BUILD: string = process.env.EXPO_PUBLIC_BUILD_NUMBER || 'dev';

function HeroStepper({ label, value, onDec, onInc }: { label: string; value: string; onDec: () => void; onInc: () => void }) {
  const colors = useColors();
  const stepStyle = {
    width: 34, height: 34, borderRadius: radius.md, alignItems: 'center' as const, justifyContent: 'center' as const,
    backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.default,
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
      <Text style={{ flex: 1, fontSize: 12, color: colors.text.secondary }}>{label}</Text>
      <PressableScale onPress={onDec}>
        <View style={stepStyle}><LucideIcons.Minus size={15} color={colors.text.primary} /></View>
      </PressableScale>
      <Text style={{ minWidth: 52, textAlign: 'center', fontSize: 12, fontWeight: '700', color: colors.text.primary }}>{value}</Text>
      <PressableScale onPress={onInc}>
        <View style={stepStyle}><LucideIcons.Plus size={15} color={colors.text.primary} /></View>
      </PressableScale>
    </View>
  );
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// A settings section that collapses. Its own header (icon + title + chevron) replaces
// the old flat sectionTitle, so the screen reads as a tidy, tappable menu.
function CollapsibleSection({ icon: Icon, title, color = '#8A93A8', defaultOpen = true, right, children }: {
  icon: any; title: string; color?: string; defaultOpen?: boolean; right?: React.ReactNode; children: React.ReactNode;
}) {
  const c = useColors();
  const [open, setOpen] = useState(defaultOpen);
  const toggle = () => { LayoutAnimation.configureNext(LayoutAnimation.create(200, 'easeInEaseOut', 'opacity')); haptic.tap(); setOpen(o => !o); };
  return (
    <View style={{ marginBottom: spacing[4] }}>
      <Pressable onPress={toggle} style={csStyles(c).head}>
        <View style={[csStyles(c).icon, { backgroundColor: color + '1A' }]}>
          <Icon size={15} color={color} />
        </View>
        <Text style={csStyles(c).title}>{title}</Text>
        {right}
        <LucideIcons.ChevronDown size={18} color={c.text.muted} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </Pressable>
      {open && <View style={{ marginTop: spacing[2] }}>{children}</View>}
    </View>
  );
}
const csStyles = (c: any) => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2], paddingHorizontal: spacing[1] },
  icon: { width: 30, height: 30, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 15, fontWeight: '800', color: c.text.primary, letterSpacing: 0.2 },
});

export default function SettingsScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { entries: moodEntries } = useMoodStore();
  const { expenses } = useExpensesStore();
  const { tasks, events, gcalEvents } = useCalendarStore();
  const { settings: workSettings, setSettings: setWorkSettings } = useWorkStore();
  const themeMode = useThemeStore(s => s.mode);
  const liteMode = useUiPrefs(s => s.liteMode);
  const setLiteMode = useUiPrefs(s => s.setLiteMode);

  const [backfillBusy, setBackfillBusy] = useState(false);
  const [selfTestBusy, setSelfTestBusy] = useState(false);
  const doSelfTest = async () => {
    if (selfTestBusy) return;
    haptic.tap(); setSelfTestBusy(true);
    try {
      const res = await runSelfTest();
      const pass = res.filter(r => r.ok).length;
      const body = res.map(r => `${r.ok ? '✓' : '✗'}  ${r.name}\n     ${r.detail}`).join('\n\n');
      if (pass === res.length) haptic.success(); else haptic.warn();
      Alert.alert(`Self-test: ${pass}/${res.length} OK`, body, [{ text: 'OK' }]);
    } catch (e: any) {
      Alert.alert('Self-test', 'Nie udało się uruchomić: ' + String(e?.message ?? e));
    } finally { setSelfTestBusy(false); }
  };
  const [backfillDone, setBackfillDone] = useState(false);
  useEffect(() => { isBackfillDone().then(setBackfillDone).catch(() => {}); }, []);
  const doBackfill = () => {
    const r = backfillRange();
    Alert.alert('Zaległe dane z Samsung Health',
      `${backfillDone ? 'Już wgrane raz. Wgrać ponownie? ' : ''}Wypełni ${r.days} dni (${r.from} → ${r.to}) — tylko PUSTE dni, nie nadpisze ręcznych ani nowszych.`,
      [
        { text: 'Anuluj', style: 'cancel' },
        { text: 'Wgraj', onPress: async () => {
          haptic.tap(); setBackfillBusy(true);
          try { const res = await runSamsungBackfill(); setBackfillDone(true); Alert.alert('Gotowe', `Uzupełniono ${res.filled} dni. Kroki/sen/waga/kalorie ze starych dni są teraz w wykresach i trendzie wagi.`); }
          catch { Alert.alert('Błąd', 'Nie udało się wgrać danych.'); }
          finally { setBackfillBusy(false); }
        } },
      ]);
  };
  const bankEnabled = useBankQueue(s => s.enabled);
  const setBankEnabled = useBankQueue(s => s.setEnabled);
  const bankAutoAll = useBankQueue(s => s.autoAll);
  const setBankAutoAll = useBankQueue(s => s.setAutoAll);
  const bankPending = useBankQueue(s => s.pending.length);
  const [bankTest, setBankTest] = useState('');
  const setThemeMode = useThemeStore(s => s.setMode);
  const heroFontId = useHeroFont(s => s.fontId);
  const setHeroFont = useHeroFont(s => s.setFont);
  const heroSize = useHeroFont(s => s.sizeScale);
  const setHeroSize = useHeroFont(s => s.setSizeScale);
  const heroOffX = useHeroFont(s => s.offsetX);
  const setHeroOffX = useHeroFont(s => s.setOffsetX);
  const heroOffY = useHeroFont(s => s.offsetY);
  const setHeroOffY = useHeroFont(s => s.setOffsetY);

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
    const monthHours = hoursIn(mk);
    const monthCount = allEvents.filter(e => isWork(e) && (e.date ?? '').slice(0, 7) === mk).length;
    // Detected shifts for a given month (sorted), so the user can verify what's
    // counted and tap to edit any of them.
    const shiftsIn = (ym: string) => allEvents
      .filter(e => isWork(e) && (e.date ?? '').slice(0, 7) === ym)
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
    // Salaries are paid in arrears: a paycheck DATED in month M is FOR the work
    // of month M-1. So the hours basis = the month BEFORE the last paycheck's
    // date (a June paycheck → May hours). No paycheck → previous calendar month.
    const monthBefore = (ym: string) => {
      const [y, m] = ym.split('-').map(Number);
      const d = new Date(y, m - 2, 1);
      return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
    };
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevDate.getFullYear()}-${p2(prevDate.getMonth() + 1)}`;
    const basisMonth = payMonth ? monthBefore(payMonth) : prevMonth;
    const basisHours = hoursIn(basisMonth);
    const basisShifts = shiftsIn(basisMonth);
    // Effective inputs the live rate uses (manual override wins, else computed).
    const hasHoursOvr = workSettings.hoursOverride != null && workSettings.hoursOverride > 0;
    const hasSalaryOvr = workSettings.salaryOverride != null && workSettings.salaryOverride > 0;
    const hoursUsed = hasHoursOvr ? workSettings.hoursOverride! : (basisHours || monthHours || workSettings.hoursPerMonth);
    const salaryUsed = hasSalaryOvr ? workSettings.salaryOverride! : (lastPaycheck?.amount ?? workSettings.monthlySalary);
    const rate = hoursUsed > 0 ? salaryUsed / hoursUsed : 0;
    // Avg shift length from the BASIS month → per-day (per-shift) earnings.
    const avgShiftH = basisShifts.length > 0 ? basisHours / basisShifts.length
                    : monthCount > 0 ? monthHours / monthCount : 0;
    const perDay = rate * avgShiftH;
    // Sanity check: does the latest paycheck's implied rate match the rate
    // averaged over the months the user has CONFIRMED? A big gap = likely a data
    // slip (wrong amount typed, or wrong hours that month).
    const confirmed = Object.values(workSettings.confirmedMonths ?? {});
    const totS = confirmed.reduce((s, m) => s + m.salary, 0);
    const totH = confirmed.reduce((s, m) => s + m.hours, 0);
    const confirmedAvgRate = totH > 0 ? totS / totH : 0;
    const latestImpliedRate = (lastPaycheck && basisHours > 0) ? lastPaycheck.amount / basisHours : 0;
    const rateWarn = (confirmed.length >= 1 && confirmedAvgRate > 0 && latestImpliedRate > 0 && !hasSalaryOvr
      && Math.abs(latestImpliedRate - confirmedAvgRate) / confirmedAvgRate > 0.25)
      ? { confirmedAvgRate, latestImpliedRate } : null;
    return {
      eventCount: monthCount, monthHours, basisShifts, lastPaycheck, payMonth,
      basisMonth, basisHours, basisFromPaycheck: !!lastPaycheck,
      hoursUsed, salaryUsed, rate, avgShiftH, perDay, hasHoursOvr, hasSalaryOvr, rateWarn,
    };
  }, [events, gcalEvents, expenses, workSettings]);

  // One row per real paycheck (its target month, actual amount, calendar hours) so
  // the user sees exactly what's counted and can toggle each in/out of the average.
  const payMonths = useMemo(
    () => computePayMonths(expenses, [...events, ...gcalEvents], workSettings),
    [events, gcalEvents, expenses, workSettings.workPrefix, workSettings.workColor, workSettings.excludedPayMonths],
  );

  // Ask (once per detected month) to confirm the auto-detected paycheck + hours.
  // "Tak" saves it as a confirmed month → it joins the averaged rate forever.
  useEffect(() => {
    if (!workDiag) return;
    const m = workDiag.basisMonth;
    const sal = workDiag.salaryUsed, hrs = workDiag.hoursUsed;
    if (!m || !(sal > 0) || !(hrs > 0)) return;
    if (workSettings.confirmedMonths?.[m]) return;
    (async () => {
      try {
        if (await AsyncStorage.getItem('work_confirm_asked') === m) return;
        await AsyncStorage.setItem('work_confirm_asked', m);
        Alert.alert(
          'Potwierdź miesiąc pracy',
          `Za ${m}: wypłata ${Math.round(sal)} zł, ${Math.round(hrs)} h = ${(sal / hrs).toFixed(2)} zł/h.\n\nZgadza się? Zapiszę go do średniej stawki.`,
          [
            { text: 'Nie', style: 'cancel' },
            { text: 'Tak, zapisz', onPress: () => {
                const s = { ...workSettings, confirmedMonths: { ...(workSettings.confirmedMonths ?? {}), [m]: { salary: Math.round(sal), hours: Math.round(hrs) } } };
                setWorkSettings(s); workService.saveSettings(s).catch(() => {});
                toast.success('Zapisano do średniej stawki');
              } },
          ],
        );
      } catch {}
    })();
  }, [workDiag, workSettings]);

  const [workPrefix, setWorkPrefix] = useState(workSettings.workPrefix ?? '');
  // Editable overrides for the two inputs the rate is built from. Empty = use the
  // value the app reads (previous-month calendar hours / last [JD] paycheck).
  const [hoursOvrField, setHoursOvrField]   = useState(workSettings.hoursOverride != null ? String(workSettings.hoursOverride) : '');
  const [salaryOvrField, setSalaryOvrField] = useState(workSettings.salaryOverride != null ? String(workSettings.salaryOverride) : '');

  useEffect(() => {
    workService.getSettings().then(s => {
      setWorkSettings(s);
      setWorkPrefix(s.workPrefix ?? '');
      setHoursOvrField(s.hoursOverride != null ? String(s.hoursOverride) : '');
      setSalaryOvrField(s.salaryOverride != null ? String(s.salaryOverride) : '');
    }).catch(() => {});
  }, []);

  // Save / clear an override for hours or salary. Empty input clears it (back to
  // the auto-read value).
  const saveOverride = async (field: 'hoursOverride' | 'salaryOverride', raw: string) => {
    const newS: typeof workSettings = { ...workSettings };
    const v = parseFloat(raw.replace(',', '.'));
    if (raw.trim() === '' || isNaN(v) || v <= 0) delete newS[field];
    else newS[field] = v;
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
    let inc = 0, exp = 0, cashInc = 0, cashExp = 0;
    for (const e of unique) {
      // MUST match the Finances balance: only MY transactions count toward my
      // money. Otherwise the saved offset is computed against a different net
      // and the displayed balance drifts.
      if (!isMine(e)) continue;
      const cash = e.paymentMethod === 'cash';
      if (e.type === 'income') { inc += e.amount; if (cash) cashInc += e.amount; }
      else { exp += e.amount; if (cash) cashExp += e.amount; }
    }
    return { net: inc - exp, cashNet: cashInc - cashExp };
  }, [expenses]);
  const [balanceOffset, setBalanceOffsetState] = useState(0);
  const [balanceInput, setBalanceInput] = useState('');
  useEffect(() => { getBalanceOffset().then(setBalanceOffsetState).catch(() => {}); }, []);
  useEffect(() => { AsyncStorage.getItem('notif_enabled').then(v => { if (v != null) setNotifEnabled(v === 'true'); }).catch(() => {}); }, []);
  const saveAccountBalance = async () => {
    const real = parseFloat(balanceInput.replace(/\s/g, '').replace(',', '.'));
    if (isNaN(real)) return;
    // One balance now → offset = real balance − all net flow.
    const offset = real - accountNet.net;
    setBalanceOffsetState(offset);
    await setBalanceOffset(offset);
    setBalanceInput('');
    toast.success('Zapisano saldo');
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
      let switchedAccount = false;     // signed into a DIFFERENT existing account
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
            switchedAccount = true;
          } else {
            throw linkErr;
          }
        }
      } else {
        result = await signInWithCredential(auth, credential);
        switchedAccount = true;
      }

      // Switched to a pre-existing account (e.g. after a reinstall) → its cloud
      // backup holds the local config/data this fresh install is missing. Flag it
      // so the app offers to restore right after the reload.
      if (switchedAccount) await AsyncStorage.setItem('restore_prompt_pending', '1');

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

  const [paydayEnabled, setPaydayEnabled] = useState(false);
  const [paydayDay, setPaydayDay] = useState('10');
  useEffect(() => { getPaydayConfig().then(c => { setPaydayEnabled(c.enabled); setPaydayDay(String(c.day)); }).catch(() => {}); }, []);
  const savePayday = (enabled: boolean, dayStr: string) => {
    const day = Math.min(28, Math.max(1, parseInt(dayStr, 10) || 10));
    setPaydayConfig({ enabled, day }).catch(() => {});
  };

  const [budgetThr, setBudgetThr] = useState(80);
  useEffect(() => { AsyncStorage.getItem('budget_alert_threshold').then(v => { if (v) setBudgetThr(parseInt(v, 10) || 80); }).catch(() => {}); }, []);
  const saveBudgetThr = (v: number) => { setBudgetThr(v); AsyncStorage.setItem('budget_alert_threshold', String(v)).catch(() => {}); };

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
  const [newTagPerson, setNewTagPerson] = useState<string | null>(null);
  const [payers, setPayers] = useState<string[]>([]);

  useEffect(() => {
    getBudgets().then(b => {
      const inputs: Partial<Record<ExpenseCategory, string>> = {};
      for (const [k, v] of Object.entries(b)) {
        if (v) inputs[k as ExpenseCategory] = String(v);
      }
      setBudgetInputs(inputs);
    });
    getTagBudgetRules().then(setTagRules);
    getPayers().then(setPayers).catch(() => {});
  }, []);

  const handleAddTagRule = async () => {
    // Allow several tags separated by "+" or "," → one combined limit.
    const tags = newTag.split(/[+,]/).map(t => t.trim().toLowerCase()).filter(Boolean);
    const limit = parseFloat(newTagLimit.replace(',', '.'));
    if (tags.length === 0 || !limit || limit <= 0) return;
    const key = tags.slice().sort().join('+');
    if (tagRules.some(r => (r.tags?.length ? r.tags.slice().sort().join('+') : r.tag) === key && r.period === newTagPeriod)) {
      toast.error('Taka reguła już istnieje');
      return;
    }
    const rule: TagBudgetRule = {
      id: Date.now().toString(),
      tag: tags[0],
      ...(tags.length > 1 ? { tags } : {}),
      ...(newTagPerson ? { person: newTagPerson } : {}),
      limit,
      period: newTagPeriod,
      createdAt: new Date().toISOString(),
    };
    const updated = [...tagRules, rule];
    setTagRules(updated);
    await saveTagBudgetRules(updated);
    setNewTag('');
    setNewTagLimit('');
    setNewTagPerson(null);
    toast.success(`Reguła dla "${tags.map(t => `#${t}`).join(' + ')}" dodana`);
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
      await AsyncStorage.setItem('notif_enabled', 'true').catch(() => {});
      await notificationsService.scheduleDailyMoodReminder(eh, em, useMoodStore.getState().todayEntry != null);
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
    await AsyncStorage.setItem('notif_enabled', val ? 'true' : 'false').catch(() => {});
    if (!val) {
      await notificationsService.cancelAll();
      await AsyncStorage.setItem('notif_mood_enabled', 'false').catch(() => {});
    } else {
      const h = parseInt(eveningHour) || 20;
      const m = parseInt(eveningMin) || 0;
      const granted = await notificationsService.requestPermissions();
      if (granted) await notificationsService.scheduleDailyMoodReminder(h, m, useMoodStore.getState().todayEntry != null);
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
        <CollapsibleSection icon={LucideIcons.Palette} title="Interfejs" color="#A78BFA">
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
                trackColor={{ false: colors.fill.strong, true: colors.accent.purple + '80' }}
                thumbColor={hapticsOn ? colors.accent.purple : colors.text.muted}
              />
            </View>
            <View style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.border.subtle }]}>
              <View style={styles.iconWrap}>
                <LucideIcons.Zap size={16} color={colors.text.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Ogranicz animacje (płynność)</Text>
                <Text style={[styles.rowLabel, { fontSize: 11, color: colors.text.muted, fontWeight: '400', marginTop: 1 }]}>Wyłącza animowane tło (chmury/gwiazdy/pogoda) — najcięższy efekt. Włącz, jeśli apka klatkuje.</Text>
              </View>
              <Switch
                value={liteMode}
                onValueChange={(v) => { haptic.tap(); setLiteMode(v); }}
                trackColor={{ false: colors.fill.strong, true: '#2AC68F99' }}
                thumbColor={liteMode ? '#2AC68F' : colors.text.muted}
              />
            </View>
          </View>
        </CollapsibleSection>

        {/* Work prefix */}
        <CollapsibleSection icon={LucideIcons.Briefcase} title="Praca" color="#60A5FA" defaultOpen={false}>
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

            {/* 2 — Hours in the PREVIOUS month (editable override; placeholder = read from calendar) */}
            <View style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.border.subtle }]}>
              <View style={[styles.iconWrap, { backgroundColor: '#60A5FA18' }]}>
                <Clock size={16} color="#60A5FA" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Godziny — miesiąc liczony{workDiag ? ` (${workDiag.basisMonth})` : ''}</Text>
                <Text style={styles.rowSub}>
                  {workDiag?.hasHoursOvr
                    ? 'Ręcznie (nadpisane) — wyczyść pole, aby wrócić do kalendarza'
                    : workDiag?.basisFromPaycheck
                      ? `Z kalendarza — miesiąc którego dotyczy wypłata (${workDiag.basisMonth}) — kliknij, aby nadpisać`
                      : `Z kalendarza — poprzedni miesiąc (${workDiag?.basisMonth ?? '—'}) — kliknij, aby nadpisać`}
                </Text>
              </View>
              <TextInput
                value={hoursOvrField}
                onChangeText={setHoursOvrField}
                onBlur={() => saveOverride('hoursOverride', hoursOvrField)}
                keyboardType="numeric"
                placeholder={workDiag ? workDiag.basisHours.toFixed(0) : '—'}
                placeholderTextColor="#60A5FA"
                style={{
                  fontSize: 14, fontWeight: '700', color: '#60A5FA',
                  minWidth: 64, textAlign: 'right',
                  paddingVertical: 4, paddingHorizontal: spacing[2],
                  backgroundColor: '#60A5FA12', borderRadius: radius.md,
                  borderWidth: 1, borderColor: '#60A5FA30',
                }}
              />
            </View>

            {/* 3 — Last paycheck (editable override; placeholder = read from [JD] income) */}
            <View style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.border.subtle }]}>
              <View style={[styles.iconWrap, { backgroundColor: '#2AC68F18' }]}>
                <Wallet size={16} color="#2AC68F" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Ostatnia wypłata (zł)</Text>
                <Text style={styles.rowSub}>
                  {workDiag?.hasSalaryOvr
                    ? 'Ręcznie (nadpisane) — wyczyść, aby wrócić do przychodu'
                    : workDiag?.lastPaycheck
                      ? `Z przychodu [${(workSettings.workPrefix ?? '').trim()}] — ${workDiag.payMonth}`
                      : `Dodaj przychód [${(workSettings.workPrefix ?? '').trim()}] lub wpisz ręcznie`}
                </Text>
              </View>
              <TextInput
                value={salaryOvrField}
                onChangeText={setSalaryOvrField}
                onBlur={() => saveOverride('salaryOverride', salaryOvrField)}
                keyboardType="numeric"
                placeholder={workDiag?.lastPaycheck ? workDiag.lastPaycheck.amount.toFixed(0) : '2104'}
                placeholderTextColor="#2AC68F"
                style={{
                  fontSize: 14, fontWeight: '700', color: '#2AC68F',
                  minWidth: 80, textAlign: 'right',
                  paddingVertical: 4, paddingHorizontal: spacing[2],
                  backgroundColor: '#2AC68F12', borderRadius: radius.md,
                  borderWidth: 1, borderColor: '#2AC68F30',
                }}
              />
            </View>

            {/* 4 — What it WILL calculate: zł/h + zł/dzień */}
            {workDiag && (
              <View style={styles.diagBox}>
                <View style={styles.rateResultRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rateResultRate}>
                      {workDiag.rate.toFixed(2)} <Text style={styles.rateResultUnit}>zł/h</Text>
                    </Text>
                    <Text style={styles.rateResultSub}>
                      = {workDiag.salaryUsed.toFixed(0)} zł ÷ {workDiag.hoursUsed.toFixed(0)} h ({workDiag.basisMonth})
                    </Text>
                  </View>
                  <View style={styles.rateResultDay}>
                    <Text style={styles.rateResultDayVal}>{workDiag.perDay.toFixed(0)} zł</Text>
                    <Text style={styles.rateResultDayKey}>śr. na dzień{workDiag.avgShiftH > 0 ? ` (${workDiag.avgShiftH.toFixed(1)} h)` : ''}</Text>
                  </View>
                </View>

                {workDiag.rateWarn && (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: spacing[2], paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: colors.border.subtle }}>
                    <LucideIcons.AlertTriangle size={13} color={colors.accent.amber} style={{ marginTop: 1 }} />
                    <Text style={{ flex: 1, fontSize: 11, color: colors.accent.amber, lineHeight: 15, fontWeight: '600' }}>
                      Ostatnia wypłata daje {workDiag.rateWarn.latestImpliedRate.toFixed(2)} zł/h, a Twoja średnia z potwierdzonych miesięcy to {workDiag.rateWarn.confirmedAvgRate.toFixed(2)} zł/h — sprawdź kwotę wypłaty lub godziny ({workDiag.basisMonth}).
                    </Text>
                  </View>
                )}

                <Text style={styles.diagHint}>
                  {workDiag.basisFromPaycheck
                    ? `Wypłata jest z dołu: ostatnia wypłata${workDiag.payMonth ? ` (${workDiag.payMonth})` : ''} ÷ godziny z miesiąca, którego dotyczy (${workDiag.basisMonth}).`
                    : `Stawka z POPRZEDNIEGO (pełnego) miesiąca (${workDiag.basisMonth}).`}
                  {' '}W tym miesiącu masz na razie {workDiag.monthHours.toFixed(1)} h — to tylko podgląd na żywo.
                </Text>

                {/* Detected shifts of the BASIS month — tap to edit */}
                <View style={styles.shiftList}>
                  <Text style={styles.shiftListTitle}>ZMIANY LICZONE — {workDiag.basisMonth} · {workDiag.basisShifts.length} · {workDiag.basisHours.toFixed(1)} h</Text>
                  {workDiag.basisShifts.length === 0 ? (
                    <Text style={styles.shiftEmpty}>Brak zmian w {workDiag.basisMonth} pasujących do prefiksu „{(workSettings.workPrefix ?? '').trim()}".</Text>
                  ) : (
                    workDiag.basisShifts.map(sh => (
                      <PressableScale
                        key={sh.id}
                        onPress={() => { haptic.tap(); router.push(`/calendar/${sh.id}` as any); }}
                        style={styles.shiftRow}
                      >
                        <View style={styles.shiftDot} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.shiftTitle} numberOfLines={1}>{sh.title || 'Zmiana'}</Text>
                          <Text style={styles.shiftMeta}>{sh.date} · {sh.startTime}–{sh.endTime}</Text>
                        </View>
                        <Text style={styles.shiftHours}>{sh.hours.toFixed(1)} h</Text>
                        <LucideIcons.Pencil size={13} color={colors.text.muted} />
                      </PressableScale>
                    ))
                  )}
                </View>
              </View>
            )}

            <ConfirmedMonths payMonths={payMonths} />
          </View>
        </CollapsibleSection>

        {/* Account balance reconciliation */}
        <CollapsibleSection icon={LucideIcons.Wallet} title="Saldo konta" color="#5B7BE3" defaultOpen={false}>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.iconWrap, { backgroundColor: '#5B7BE318' }]}>
                <Wallet size={16} color="#5B7BE3" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Ile mam na karcie</Text>
                <Text style={styles.rowSub}>
                  App liczy teraz: {(balanceOffset + accountNet.net).toFixed(2)} zł.{'\n'}
                  Wpisz ile masz realnie na karcie — reszta liczy się sama.
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
        </CollapsibleSection>

        {/* Payday prompt */}
        <CollapsibleSection icon={LucideIcons.Banknote} title="Wypłata" color="#2AC68F" defaultOpen={false}>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.iconWrap, { backgroundColor: '#2AC68F18' }]}>
                <Wallet size={16} color="#2AC68F" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Pytaj o wypłatę</Text>
                <Text style={styles.rowSub}>Dashboard zapyta, czy dostałeś wypłatę — po potwierdzeniu doda przychód i ustawi ostatnią wypłatę.</Text>
              </View>
              <Switch
                value={paydayEnabled}
                onValueChange={(v) => { haptic.tap(); setPaydayEnabled(v); savePayday(v, paydayDay); }}
                trackColor={{ false: colors.fill.strong, true: '#2AC68F' }}
                thumbColor={colors.white}
              />
            </View>
            {paydayEnabled && (
              <View style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.border.subtle, paddingTop: spacing[3], marginTop: spacing[1] }]}>
                <View style={[styles.iconWrap, { backgroundColor: '#2AC68F18' }]}>
                  <CalendarDays size={16} color="#2AC68F" />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>Którego dnia miesiąca</Text>
                  <Text style={styles.rowSub}>Dzień 1–28, od którego dashboard zaczyna pytać.</Text>
                </View>
                <TextInput
                  value={paydayDay}
                  onChangeText={setPaydayDay}
                  onBlur={() => { const d = String(Math.min(28, Math.max(1, parseInt(paydayDay, 10) || 10))); setPaydayDay(d); savePayday(paydayEnabled, d); }}
                  keyboardType="numeric"
                  placeholder="10"
                  placeholderTextColor={colors.text.muted}
                  maxLength={2}
                  style={{
                    fontSize: 14, fontWeight: '700', color: '#2AC68F',
                    minWidth: 56, textAlign: 'center',
                    paddingVertical: 4, paddingHorizontal: spacing[2],
                    backgroundColor: '#2AC68F12', borderRadius: radius.md,
                    borderWidth: 1, borderColor: '#2AC68F30',
                  }}
                />
              </View>
            )}
          </View>
        </CollapsibleSection>

        {/* Notifications */}
        <CollapsibleSection icon={LucideIcons.Bell} title="Powiadomienia" color="#A78BFA" defaultOpen={false}>
          <View style={styles.card}>
            <PressableScale
              onPress={() => { haptic.tap(); router.push('/notifications' as any); }}
              style={styles.row}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#8B5CF618' }]}>
                <Bell size={16} color="#8B5CF6" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Zarządzaj powiadomieniami</Text>
                <Text style={styles.rowSub}>Włącz/wyłącz każdy typ osobno</Text>
              </View>
              <ChevronLeft size={16} color={colors.text.muted} style={{ transform: [{ rotate: '180deg' }] }} />
            </PressableScale>

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
                trackColor={{ false: colors.fill.strong, true: colors.accent.green + '99' }}
                thumbColor={notifEnabled ? colors.text.primary : colors.text.muted}
              />
            </View>

            {notifEnabled && (
              <>
                {/* Budget alert threshold */}
                <View style={styles.notifLabel}>
                  <Wallet size={12} color={colors.text.muted} />
                  <Text style={styles.notifLabelText}>Alert limitu wydatków od</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing[2], paddingHorizontal: spacing[1], marginBottom: spacing[2] }}>
                  {[75, 80, 85, 90, 100].map(v => {
                    const active = budgetThr === v;
                    return (
                      <PressableScale key={v} onPress={() => { haptic.tap(); saveBudgetThr(v); }} style={{ flex: 1 }}>
                        <View style={{ alignItems: 'center', paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: active ? colors.accent.amber : colors.border.default, backgroundColor: active ? colors.accent.amber + '22' : colors.bg.elevated }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: active ? colors.accent.amber : colors.text.secondary }}>{v}%</Text>
                        </View>
                      </PressableScale>
                    );
                  })}
                </View>

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
                    trackColor={{ false: colors.fill.strong, true: colors.accent.green + '99' }}
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
                    trackColor={{ false: colors.fill.strong, true: colors.accent.green + '99' }}
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
                    trackColor={{ false: colors.fill.strong, true: colors.accent.green + '99' }}
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
        </CollapsibleSection>

        {/* Monthly budgets */}
        <CollapsibleSection icon={LucideIcons.PiggyBank} title="Budżet miesięczny" color="#2AC68F" defaultOpen={false} right={
          <PressableScale onPress={handleSaveBudgets} style={styles.saveBudgetBtn}>
            <Check size={14} color={colors.accent.success} />
            <Text style={styles.saveBudgetText}>Zapisz</Text>
          </PressableScale>
        }>
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
        </CollapsibleSection>

        {/* Tag budgets */}
        <CollapsibleSection icon={LucideIcons.Tag} title="Limity na tagi" color="#FBBF24" defaultOpen={false}>
          <View style={styles.card}>
            {/* Existing rules */}
            {tagRules.map((rule, i) => (
              <View key={rule.id} style={[styles.budgetRow, i > 0 && { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }]}>
                <View style={[styles.iconWrap, { backgroundColor: colors.accent.purple + '18' }]}>
                  <Tag size={13} color={colors.accent.purple} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{ruleLabel(rule)}</Text>
                  <Text style={styles.rowSub}>{rule.period === 'week' ? 'tygodniowo' : 'miesięcznie'}</Text>
                </View>
                <Text style={[styles.rowLabel, { color: colors.accent.amber }]}>{rule.limit} zł</Text>
                <PressableScale onPress={() => handleDeleteTagRule(rule.id)} style={{ padding: 6, marginLeft: 4 }}>
                  <Trash2 size={14} color={colors.accent.danger} />
                </PressableScale>
              </View>
            ))}

            {/* Suggested tags — tap to add; tap several to combine (np. słodycze + przekąski) */}
            <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[3], paddingBottom: spacing[2] }}>
              <Text style={styles.rowSub}>Dotknij tag (kilka = wspólny limit):</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                <PressableScale onPress={() => setNewTag('słodycze + przekąski')}
                  style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full,
                    backgroundColor: colors.accent.purple + '20', borderWidth: 1, borderColor: colors.accent.purple + '55' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accent.purple }}>słodycze + przekąski</Text>
                </PressableScale>
                {SUGGESTED_TAGS.map(t => (
                  <PressableScale key={t} onPress={() => setNewTag(prev => {
                    const parts = prev.split(/[+,]/).map(x => x.trim().toLowerCase()).filter(Boolean);
                    if (parts.includes(t)) return prev;
                    return parts.length ? `${prev.trim()} + ${t}` : t;
                  })}
                    style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full,
                      backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.default }}>
                    <Text style={{ fontSize: 11, color: colors.text.secondary }}>{t}</Text>
                  </PressableScale>
                ))}
              </View>
            </View>

            {/* Add new rule */}
            <View style={{ padding: spacing[4], gap: spacing[3], borderTopWidth: tagRules.length > 0 ? 1 : 0, borderTopColor: 'rgba(255,255,255,0.05)' }}>
              <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                <TextInput
                  value={newTag}
                  onChangeText={setNewTag}
                  placeholder="tag, kilka przez +"
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
              {payers.length >= 2 && (
                <View style={{ flexDirection: 'row', gap: spacing[2], alignItems: 'center', flexWrap: 'wrap' }}>
                  <Text style={{ fontSize: 11, color: colors.text.muted }}>Dla:</Text>
                  {[null, ...payers].map(p => {
                    const on = newTagPerson === p;
                    return (
                      <PressableScale key={p ?? 'all'} onPress={() => setNewTagPerson(p)}
                        style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full,
                          backgroundColor: on ? colors.accent.purple + '22' : colors.bg.elevated,
                          borderWidth: 1, borderColor: on ? colors.accent.purple : colors.border.default }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: on ? colors.accent.purple : colors.text.secondary }}>
                          {p ?? 'Wszyscy'}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>
              )}
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
        </CollapsibleSection>

        {/* Data overview */}
        <CollapsibleSection icon={LucideIcons.Database} title="Dane" color="#46B0DE" defaultOpen={false}>
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
        </CollapsibleSection>

        {/* Cloud backup */}
        <View>
          <BackupSection appBuild={Number(APP_BUILD) || undefined} googleUser={googleUser} onConnectGoogle={handleGoogleSignIn} />
        </View>

        {/* Account */}
        <CollapsibleSection icon={LucideIcons.User} title="Konto" color="#2AC68F" defaultOpen={false}>
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
        </CollapsibleSection>

        {/* Personalization */}
        <CollapsibleSection icon={LucideIcons.Sparkles} title="Personalizacja" color="#F472B6" defaultOpen={false}>
          <View style={styles.card}>
            {/* Theme mode — engine is live; screens flip as they're migrated. */}
            <View style={[styles.row, { flexDirection: 'column', alignItems: 'stretch', gap: spacing[2] }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
                <View style={[styles.iconWrap, { backgroundColor: '#FBBF2418' }]}>
                  <LucideIcons.SunMoon size={16} color="#FBBF24" />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>Motyw</Text>
                  <Text style={styles.rowSub}>Jasny/ciemny — wdrażany ekran po ekranie</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                {([['dark', 'Ciemny'], ['light', 'Jasny'], ['system', 'System']] as [ThemeMode, string][]).map(([m, lbl]) => {
                  const on = themeMode === m;
                  return (
                    <PressableScale key={m} onPress={() => { haptic.tap(); setThemeMode(m); }} style={{ flex: 1 }}>
                      <View style={{
                        paddingVertical: 9, borderRadius: radius.md, alignItems: 'center',
                        backgroundColor: on ? '#FBBF2422' : colors.bg.elevated,
                        borderWidth: 1, borderColor: on ? '#FBBF24' : colors.border.default,
                      }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: on ? '#FBBF24' : colors.text.secondary }}>{lbl}</Text>
                      </View>
                    </PressableScale>
                  );
                })}
              </View>
            </View>
            <PressableScale
              onPress={() => { useDashboardLayout.getState().requestEdit(); router.push('/(tabs)' as any); }}
              style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.border.subtle }]}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#6C9EFF18' }]}>
                <LucideIcons.LayoutDashboard size={16} color="#6C9EFF" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Edytuj dashboard</Text>
                <Text style={styles.rowSub}>Przesuwaj kafelki, ukrywaj, dodawaj widgety statystyk</Text>
              </View>
              <ChevronLeft size={16} color={colors.text.muted} style={{ transform: [{ rotate: '180deg' }] }} />
            </PressableScale>

          </View>
        </CollapsibleSection>

        {/* More */}
        <CollapsibleSection icon={LucideIcons.MoreHorizontal} title="Więcej" color="#8A93A8" defaultOpen={false}>
          <View style={styles.card}>
            <PressableScale
              onPress={() => { haptic.tap(); router.push('/achievements' as any); }}
              style={styles.row}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#FFC83D18' }]}>
                <LucideIcons.Trophy size={16} color="#FFC83D" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Gablota osiągnięć</Text>
                <Text style={styles.rowSub}>Odznaki, serie, legendy i grzeszki</Text>
              </View>
              <ChevronLeft size={16} color={colors.text.muted} style={{ transform: [{ rotate: '180deg' }] }} />
            </PressableScale>

            <PressableScale
              onPress={() => { haptic.tap(); router.push('/counters' as any); }}
              style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.border.subtle }]}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#46B0DE18' }]}>
                <LucideIcons.Hourglass size={16} color="#46B0DE" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Liczniki i odliczania</Text>
                <Text style={styles.rowSub}>Odliczanie do wydarzeń, „ile dni temu…"</Text>
              </View>
              <ChevronLeft size={16} color={colors.text.muted} style={{ transform: [{ rotate: '180deg' }] }} />
            </PressableScale>

            <PressableScale
              onPress={() => { haptic.tap(); router.push('/pet' as any); }}
              style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.border.subtle }]}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#2AC68F18' }]}>
                <LucideIcons.Sparkles size={16} color="#2AC68F" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Pupil</Text>
                <Text style={styles.rowSub}>Twój blob — nastrój zależny od tego, jak dbasz o siebie</Text>
              </View>
              <ChevronLeft size={16} color={colors.text.muted} style={{ transform: [{ rotate: '180deg' }] }} />
            </PressableScale>
          </View>
        </CollapsibleSection>

        {/* Bank auto-expenses */}
        <CollapsibleSection icon={LucideIcons.Landmark} title="Auto-wydatki z banku (PeoPay)" color="#2AC68F" defaultOpen={false}>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.iconWrap, { backgroundColor: '#2AC68F18' }]}>
                <LucideIcons.Landmark size={16} color="#2AC68F" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Czytaj powiadomienia o płatności</Text>
                <Text style={[styles.rowLabel, { fontSize: 11, color: colors.text.muted, fontWeight: '400', marginTop: 1 }]}>Powiadomienie z banku → wydatek do zatwierdzenia{bankPending > 0 ? ` · ${bankPending} czeka` : ''}</Text>
              </View>
              <Switch value={bankEnabled} onValueChange={(v) => { setBankEnabled(v); if (v) import('@/services/bankNotificationDrain').then(m => m.drainBankNotifications()).catch(() => {}); }} trackColor={{ false: colors.fill.strong, true: '#2AC68F99' }} thumbColor={bankEnabled ? '#2AC68F' : colors.text.muted} />
            </View>
            {bankEnabled && (
              <View style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.border.subtle }]}>
                <View style={[styles.iconWrap, { backgroundColor: '#2AC68F18' }]}>
                  <LucideIcons.Zap size={16} color="#2AC68F" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>Dodawaj automatycznie (bez zatwierdzania)</Text>
                  <Text style={[styles.rowLabel, { fontSize: 11, color: colors.text.muted, fontWeight: '400', marginTop: 1 }]}>Każda płatność kartą księguje się od razu. Wpłaty/wypłaty i tak sprawdzasz ręcznie.</Text>
                </View>
                <Switch value={bankAutoAll} onValueChange={(v) => { setBankAutoAll(v); haptic.tap(); if (v) { import('@/services/bankAutoProcess').then(m => m.processAutoBankQueue()).catch(() => {}); toast.success('Płatności kartą będą dodawane automatycznie'); } }} trackColor={{ false: colors.fill.strong, true: '#2AC68F99' }} thumbColor={bankAutoAll ? '#2AC68F' : colors.text.muted} />
              </View>
            )}
            {bankEnabled && Platform.OS === 'android' && (
              <View style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.border.subtle, flexDirection: 'column', alignItems: 'stretch', gap: 6 }]}>
                <Text style={[styles.rowLabel, { fontSize: 12, color: colors.text.muted, fontWeight: '400' }]}>Aby łapać płatności automatycznie, włącz Sapp w „Dostęp do powiadomień" (raz).</Text>
                <PressableScale
                  onPress={() => { Linking.sendIntent('android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS').catch(() => { toast.error('Nie udało się otworzyć ustawień — znajdź „Dostęp do powiadomień" ręcznie'); }); }}
                  style={{ backgroundColor: colors.bg.elevated, borderRadius: 10, borderWidth: 1, borderColor: '#2AC68F55', paddingVertical: 11, alignItems: 'center' }}>
                  <Text style={{ color: '#2AC68F', fontWeight: '800' }}>Otwórz dostęp do powiadomień</Text>
                </PressableScale>
                <Text style={[styles.rowLabel, { fontSize: 12, color: colors.text.muted, fontWeight: '400', marginTop: 4 }]}>Łapie tylko raz i przestaje? Samsung usypia Sappa — ustaw baterię na „Bez ograniczeń" (Bateria → Bez ograniczeń) i wyłącz „Usypianie aplikacji".</Text>
                <PressableScale
                  onPress={() => { Linking.openSettings().catch(() => { toast.error('Otwórz Ustawienia → Aplikacje → Sapp → Bateria ręcznie'); }); }}
                  style={{ backgroundColor: colors.bg.elevated, borderRadius: 10, borderWidth: 1, borderColor: '#FBBF2455', paddingVertical: 11, alignItems: 'center' }}>
                  <Text style={{ color: '#FBBF24', fontWeight: '800' }}>Ustawienia baterii Sappa</Text>
                </PressableScale>
              </View>
            )}
            {bankEnabled && (
              <View style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.border.subtle, flexDirection: 'column', alignItems: 'stretch', gap: 8 }]}>
                <Text style={[styles.rowLabel, { fontSize: 12, color: colors.text.muted, fontWeight: '400' }]}>Test odczytu — wklej treść powiadomienia z banku:</Text>
                <TextInput value={bankTest} onChangeText={setBankTest} multiline placeholder="Zapłacono kwotę 10,18 PLN karta *8743 dnia 03-07-2026 godz. 06:37:30 w LIDL…" placeholderTextColor={colors.text.muted}
                  style={{ backgroundColor: colors.bg.elevated, borderRadius: 10, borderWidth: 1, borderColor: colors.border.default, padding: 10, color: colors.text.primary, minHeight: 70, fontSize: 13 }} />
                <PressableScale onPress={async () => { const ok = await ingestBankNotification('', bankTest); if (ok) { toast.success('Rozpoznano — zobacz „Płatności z banku" na dashboardzie'); setBankTest(''); } else { toast.error('Nie rozpoznano płatności w tym tekście'); } }}
                  style={{ backgroundColor: '#2AC68F', borderRadius: 10, paddingVertical: 11, alignItems: 'center' }}>
                  <Text style={{ color: colors.bg.primary, fontWeight: '800' }}>Przetestuj odczyt</Text>
                </PressableScale>

                <Text style={[styles.rowLabel, { fontSize: 12, color: colors.text.muted, fontWeight: '400', marginTop: 4 }]}>Nic nie łapie? Sprawdź, czy powiadomienia w ogóle docierają do apki:</Text>
                <PressableScale onPress={async () => {
                    const { peekBankCapture, drainBankNotifications } = await import('@/services/bankNotificationDrain');
                    const peek = await peekBankCapture();
                    const queued = await drainBankNotifications();
                    const seenLine = peek.seen.length > 0
                      ? '\n\nApki widziane przez nasłuch:\n' + peek.seen.map(p => '• ' + p).join('\n')
                      : '';
                    if (!peek.fileExists || peek.count === 0) {
                      if (peek.seen.length === 0) {
                        Alert.alert('Nasłuch nic nie odbiera',
                          'Usługa nie dostała ŻADNEGO powiadomienia (nawet z innych apek). Nasłuch nie działa:\n1) „Dostęp do powiadomień" → wyłącz i włącz Sapp,\n2) bateria Sappa → Bez ograniczeń,\n3) zrób jedną testową płatność i sprawdź ponownie.');
                      } else {
                        Alert.alert('Nasłuch działa, ale nie złapał płatności',
                          'Usługa odbiera powiadomienia, ale żadne nie zostało uznane za płatność z banku.' + seenLine + '\n\nJeśli jest tu PeoPay/Pekao — wyślij mi tę listę, dodam ten pakiet.');
                      }
                    } else {
                      Alert.alert('Przechwycono ' + peek.count + ' powiadomień',
                        (queued > 0 ? `Dodano ${queued} do zatwierdzenia (zobacz dashboard).\n\n` : 'Żadne nie wyglądało na płatność do dodania (mogły już być dodane).\n\n') +
                        'Ostatnie:\n' + peek.samples.map(s => '• ' + s).join('\n') + seenLine);
                    }
                  }}
                  style={{ backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.default, borderRadius: 10, paddingVertical: 11, alignItems: 'center' }}>
                  <Text style={{ color: colors.text.primary, fontWeight: '800' }}>Sprawdź teraz (diagnostyka)</Text>
                </PressableScale>

                {/* Always-available door into the review screen — the dashboard tile
                    only appears when something's queued, so this is the reliable way
                    in even when nothing was captured. */}
                <PressableScale onPress={() => { haptic.tap(); router.push('/bank-review' as any); }}
                  style={{ backgroundColor: '#2AC68F18', borderWidth: 1, borderColor: '#2AC68F55', borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 2 }}>
                  <Text style={{ color: '#2AC68F', fontWeight: '800' }}>Płatności do zatwierdzenia{bankPending > 0 ? ` (${bankPending})` : ''} →</Text>
                </PressableScale>
              </View>
            )}
          </View>
        </CollapsibleSection>

        {/* Diagnostics */}
        <CollapsibleSection icon={LucideIcons.Wrench} title="Diagnostyka" color="#8A93A8" defaultOpen={false}>
          <View style={styles.card}>
            <PressableScale
              onPress={doSelfTest} disabled={selfTestBusy}
              style={styles.row}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#A78BFA18' }]}>
                {selfTestBusy ? <ActivityIndicator size="small" color="#A78BFA" /> : <LucideIcons.Stethoscope size={16} color="#A78BFA" />}
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Self-test aplikacji</Text>
                <Text style={styles.rowSub}>Sprawdza daty (bug „północ"), pamięć, chmurę/backup i wczytanie danych — ✓/✗</Text>
              </View>
              <ChevronLeft size={16} color={colors.text.muted} style={{ transform: [{ rotate: '180deg' }] }} />
            </PressableScale>
            <PressableScale
              onPress={() => { haptic.tap(); router.push('/health-test' as any); }}
              style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.border.subtle }]}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#46B0DE18' }]}>
                <LucideIcons.Activity size={16} color="#46B0DE" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Test połączeń zdrowia</Text>
                <Text style={styles.rowSub}>Sprawdza kroki (wg źródła), sen, wagę, kalorie, wodę — raport do wysłania</Text>
              </View>
              <ChevronLeft size={16} color={colors.text.muted} style={{ transform: [{ rotate: '180deg' }] }} />
            </PressableScale>
            <PressableScale
              onPress={doBackfill} disabled={backfillBusy}
              style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.border.subtle }]}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#2AC68F18' }]}>
                {backfillBusy ? <ActivityIndicator size="small" color="#2AC68F" /> : <LucideIcons.DownloadCloud size={16} color="#2AC68F" />}
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Wgraj zaległe dane z Samsung Health{backfillDone ? ' ✓' : ''}</Text>
                <Text style={styles.rowSub}>Historyczne kroki/sen/waga/kalorie ({backfillRange().days} dni) do wykresów — jednorazowo, wypełnia luki</Text>
              </View>
              <ChevronLeft size={16} color={colors.text.muted} style={{ transform: [{ rotate: '180deg' }] }} />
            </PressableScale>
            <PressableScale
              onPress={() => { router.push('/expenses/audit' as any); }}
              style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.border.subtle }]}
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
            <PressableScale
              onPress={async () => {
                const raw = await AsyncStorage.getItem('last_crash').catch(() => null);
                if (!raw) { Alert.alert('Ostatni błąd', 'Brak zapisanego crasha — świetnie.'); return; }
                try {
                  const c = JSON.parse(raw);
                  Alert.alert(`Ostatni błąd · ${new Date(c.at).toLocaleString('pl-PL')}`,
                    `${c.message}\n\n${(c.stack || c.component || '').slice(0, 1200)}`,
                    [{ text: 'Wyczyść', onPress: () => AsyncStorage.removeItem('last_crash').catch(() => {}) }, { text: 'OK' }]);
                } catch { Alert.alert('Ostatni błąd', raw.slice(0, 1400)); }
              }}
              style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.border.subtle }]}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#F59E0B18' }]}>
                <LucideIcons.Bug size={16} color="#F59E0B" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Pokaż ostatni błąd</Text>
                <Text style={styles.rowSub}>Po czarnym ekranie — pokaż i wyślij mi treść</Text>
              </View>
              <ChevronLeft size={16} color={colors.text.muted} style={{ transform: [{ rotate: '180deg' }] }} />
            </PressableScale>
          </View>
        </CollapsibleSection>

        {/* About */}
        <CollapsibleSection icon={LucideIcons.Info} title="Aplikacja" color="#8A93A8" defaultOpen={false}>
          <View style={styles.card}>
            <View style={styles.aboutHeader}>
              <View style={styles.appIcon}>
                <Text style={styles.appIconText}>S</Text>
              </View>
              <View>
                <Text style={styles.appName}>Sapp</Text>
                <Text style={styles.appVersion}>{APP_VERSION} · BUILD #{APP_BUILD}</Text>
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
        </CollapsibleSection>

      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = themedStyles((c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: c.border.subtle,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: c.bg.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: c.border.default,
  },
  headerTitle: { ...typography.h3, color: c.text.primary },
  scroll: { padding: spacing[4], gap: spacing[2], paddingBottom: spacing[10] },
  sectionTitle: {
    ...typography.label, color: c.text.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 11,
    marginBottom: spacing[2], marginTop: spacing[2],
  },
  card: {
    backgroundColor: c.bg.card, borderRadius: radius.xl,
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
  rowLabel: { ...typography.bodySmall, color: c.text.primary, fontWeight: '500' },
  rowSub: { ...typography.caption, color: c.text.muted, marginTop: 1 },
  diagBox: {
    paddingTop: spacing[3], paddingHorizontal: spacing[4], paddingBottom: spacing[4],
    borderTopWidth: 1, borderTopColor: c.border.subtle, gap: spacing[2],
  },
  diagTitle: { fontSize: 9, fontWeight: '800', color: c.text.muted, letterSpacing: 0.8 },
  diagItem: { gap: 1 },
  diagItemLabel: { fontSize: 10.5, color: c.text.muted, fontWeight: '500' },
  diagItemVal: { fontSize: 13, fontWeight: '700', color: c.text.primary },
  diagHint: { fontSize: 11, color: c.accent.amber, lineHeight: 15, marginTop: 2 },
  rateResultRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingVertical: spacing[2], paddingHorizontal: spacing[3],
    borderRadius: radius.md, backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.22)',
  },
  rateResultRate: { fontSize: 24, fontWeight: '900', color: '#FBBF24', letterSpacing: -0.5 },
  rateResultUnit: { fontSize: 14, fontWeight: '700', color: '#FBBF24' },
  rateResultSub: { fontSize: 11, color: c.text.muted, marginTop: 1 },
  rateResultDay: { alignItems: 'flex-end' },
  rateResultDayVal: { fontSize: 18, fontWeight: '800', color: c.text.primary },
  rateResultDayKey: { fontSize: 9.5, color: c.text.muted },
  workStatsRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[1] },
  workStatTile: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.md,
    paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center', gap: 2,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  workStatVal: { fontSize: 14, fontWeight: '800', color: c.text.primary },
  workStatKey: { fontSize: 8.5, color: c.text.muted, textAlign: 'center' },
  rateOvrBox: {
    marginTop: spacing[2], padding: spacing[3], borderRadius: radius.md,
    backgroundColor: 'rgba(96,165,250,0.06)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.2)', gap: spacing[2],
  },
  rateOvrLabel: { fontSize: 10.5, fontWeight: '700', color: c.text.secondary, letterSpacing: 0.3 },
  rateOvrRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  rateOvrInput: {
    width: 72, height: 34, borderRadius: radius.sm, textAlign: 'center',
    backgroundColor: c.bg.elevated, borderWidth: 1, borderColor: c.border.default,
    color: c.text.primary, fontSize: 14, fontWeight: '700',
  },
  rateOvrBtn: { flex: 1, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  rateOvrBtnText: { fontSize: 11.5, fontWeight: '700' },
  rateOvrClear: { alignSelf: 'flex-start' },
  rateOvrClearText: { fontSize: 10.5, color: c.accent.red, fontWeight: '600' },
  shiftList: {
    marginTop: spacing[2], paddingTop: spacing[3],
    borderTopWidth: 1, borderTopColor: c.border.subtle, gap: spacing[1],
  },
  shiftListTitle: { fontSize: 9, fontWeight: '800', color: '#60A5FA', letterSpacing: 0.8, marginBottom: spacing[1] },
  shiftEmpty: { fontSize: 11, color: c.text.muted, fontStyle: 'italic' },
  shiftRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingVertical: 7, paddingHorizontal: spacing[2],
    backgroundColor: 'rgba(96,165,250,0.07)', borderRadius: radius.md,
  },
  shiftDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#60A5FA' },
  shiftTitle: { fontSize: 12.5, fontWeight: '600', color: c.text.primary },
  shiftMeta: { fontSize: 10.5, color: c.text.muted, marginTop: 1 },
  shiftHours: { fontSize: 12, fontWeight: '700', color: '#60A5FA' },
  timeRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[4], paddingBottom: spacing[3],
  },
  timeField: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: c.bg.elevated, borderRadius: radius.md,
    borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1],
  },
  timeSep: { ...typography.h4, color: c.text.muted },
  timeInput: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  notifLabel: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingBottom: spacing[1],
  },
  notifLabelText: { ...typography.caption, color: c.text.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
  saveRow: { paddingHorizontal: spacing[4], paddingBottom: spacing[3] },
  saveTimeBtn: {
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderRadius: radius.md, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  saveTimeBtnText: { ...typography.label, fontWeight: '700', color: c.text.primary },
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
    backgroundColor: c.accent.success + '18',
    borderWidth: 1, borderColor: c.accent.success + '35',
  },
  saveBudgetText: { fontSize: 11, fontWeight: '700', color: c.accent.success },
  budgetRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  budgetInput: {
    flex: 1, textAlign: 'right',
    fontSize: 15, fontWeight: '700', color: c.text.primary,
    paddingHorizontal: spacing[2], paddingVertical: 4,
  },
  budgetCur: { ...typography.caption, color: c.text.muted, fontWeight: '600', fontSize: 11 },
  dataRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  dataVal: { ...typography.h4, fontWeight: '800', color: c.text.primary },
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
  appIconText: { fontSize: 26, fontWeight: '900', color: c.text.primary },
  appName: { ...typography.h3, color: c.text.primary, fontWeight: '800' },
  appVersion: { ...typography.caption, color: c.text.muted, marginTop: 2 },
  aboutDesc: {
    ...typography.bodySmall, color: c.text.secondary, lineHeight: 20,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
}));


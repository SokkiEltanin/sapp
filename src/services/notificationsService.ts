import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Subscription, Task } from '@/types';

// Next clock time for hour:minute — today if it's still ahead and we're not
// skipping today, otherwise tomorrow. Used so the mood reminder can SKIP today
// once the mood has already been logged (instead of nagging anyway).
function nextFireDate(hour: number, minute: number, skipToday: boolean): Date {
  const now = new Date();
  const d = new Date(); d.setHours(hour, minute, 0, 0);
  if (skipToday || d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

// ─── Keyword detection ────────────────────────────────────────────────────────

const KW_UNI = [
  'ur', 'uni', 'uczelnia', 'akademia', 'egzamin', 'zaliczenie', 'kolokwium',
  'wykład', 'ćwiczenia', 'laboratorium', 'studia', 'indeks', 'sprawozdanie',
  'referat', 'semestr', 'dziekanat', 'prowadzący',
];
const KW_WORK = [
  'praca', 'projekt', 'raport', 'prezentacja', 'meeting', 'spotkanie',
  'klient', 'firma', 'szef', 'mail', 'kontrakt', 'faktura', 'oferta',
];
const KW_HOME = [
  'posprzątać', 'sprzątanie', 'zmywanie', 'pranie', 'gotowanie',
  'zakupy', 'sklep', 'rachunki', 'czynsz', 'opłata',
];
const KW_HEALTH = [
  'lekarz', 'doktor', 'wizyta', 'apteka', 'lek', 'trening',
  'siłownia', 'bieganie', 'basen', 'sport',
];

type TaskCategory = 'uni' | 'work' | 'home' | 'health' | 'other';

function detectCategory(title: string): TaskCategory {
  const t = title.toLowerCase();
  if (KW_UNI.some(k => t.includes(k)))    return 'uni';
  if (KW_WORK.some(k => t.includes(k)))   return 'work';
  if (KW_HOME.some(k => t.includes(k)))   return 'home';
  if (KW_HEALTH.some(k => t.includes(k))) return 'health';
  return 'other';
}

function buildDigestMessage(titles: string[]): { title: string; body: string } {
  const n = titles.length;
  const cats = titles.map(detectCategory);

  if (n === 1) {
    const cat = cats[0];
    const prefix = cat === 'uni'    ? 'Zajęcia/oddanie'
                 : cat === 'work'   ? 'Do pracy'
                 : cat === 'home'   ? 'Domowe'
                 : cat === 'health' ? 'Zdrowie'
                 : 'Deadline';
    return {
      title: `${prefix} jutro`,
      body:  `"${titles[0]}" — ogarnij to dziś wieczorem.`,
    };
  }

  if (n === 2) {
    return {
      title: `2 zadania jutro`,
      body:  `"${titles[0]}" i "${titles[1]}" — nie zostawiaj na ostatnią chwilę.`,
    };
  }

  // n >= 3: pick the most important one (uni > work > home > health > other)
  const priority: TaskCategory[] = ['uni', 'work', 'home', 'health', 'other'];
  let topIdx = 0;
  for (const pCat of priority) {
    const idx = cats.indexOf(pCat);
    if (idx >= 0) { topIdx = idx; break; }
  }
  const topTitle = titles[topIdx];
  const topCat = cats[topIdx];
  const emoji = topCat === 'uni' ? '📚' : topCat === 'work' ? '💼' : topCat === 'home' ? '🏠' : topCat === 'health' ? '💪' : '📋';

  return {
    title: `${n} zadań jutro ${emoji}`,
    body:  `Między innymi: "${topTitle}" i ${n - 1} ${n - 1 === 1 ? 'inne' : n - 1 <= 4 ? 'inne' : 'innych'}.`,
  };
}

// ─── Notifications setup ──────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Service ──────────────────────────────────────────────────────────────────

export const notificationsService = {
  // Android needs an explicit HIGH-importance channel for heads-up + sound.
  async ensureAndroidChannel(): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Przypomnienia',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    } catch {}
  },

  async requestPermissions(): Promise<boolean> {
    await this.ensureAndroidChannel();
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return true;
    const res = await Notifications.requestPermissionsAsync();
    return res.status === 'granted';
  },

  // One-off (not a repeating DAILY) so it can be state-aware: when the mood is
  // already logged today, pass skipToday=true and it fires tomorrow instead of
  // nagging that you "didn't log" when you did. Re-armed on app foreground +
  // after logging via refreshMoodReminder().
  async scheduleDailyMoodReminder(hour = 20, minute = 0, skipToday = false): Promise<string> {
    await Notifications.cancelScheduledNotificationAsync('daily-mood').catch(() => {});
    await AsyncStorage.multiSet([
      ['notif_mood_enabled', 'true'],
      ['notif_mood_hour', String(hour)],
      ['notif_mood_min', String(minute)],
    ]).catch(() => {});
    return Notifications.scheduleNotificationAsync({
      identifier: 'daily-mood',
      content: {
        title: 'Nie zapisałeś dziś humoru',
        body: 'Zarejestruj nastrój za dziś. Jedno tapnięcie.',
        data: { screen: 'mood' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: nextFireDate(hour, minute, skipToday) },
    });
  },

  // Re-arm the mood reminder for the right next time given today's state. Safe
  // to call often (app foreground, after logging mood, after settings change).
  async refreshMoodReminder(moodLoggedToday: boolean): Promise<void> {
    try {
      const enabled = await AsyncStorage.getItem('notif_mood_enabled');
      if (enabled === 'false') return;
      const h = parseInt((await AsyncStorage.getItem('notif_mood_hour')) ?? '20') || 20;
      const m = parseInt((await AsyncStorage.getItem('notif_mood_min')) ?? '0') || 0;
      await this.scheduleDailyMoodReminder(h, m, moodLoggedToday);
    } catch {}
  },

  async scheduleMorningMoodReminder(hour = 8, minute = 0): Promise<string> {
    await Notifications.cancelScheduledNotificationAsync('morning-mood').catch(() => {});
    return Notifications.scheduleNotificationAsync({
      identifier: 'morning-mood',
      content: {
        title: 'Zarejestruj poranny nastrój',
        body: 'Zapisz energię i humor na start dnia.',
        data: { screen: 'mood' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour, minute,
      },
    });
  },

  async cancelMorningReminder(): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync('morning-mood').catch(() => {});
  },

  // Vehicle service / maintenance-item due reminder. Re-armed on app foreground
  // with the current due list (one-off DATE, next morning) so it actually nudges
  // even when the app is closed; cancelled when nothing's due.
  async refreshMaintenanceReminder(dueLabels: string[]): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync('maintenance-due').catch(() => {});
      if (await AsyncStorage.getItem('notif_enabled') === 'false') return; // respect the global toggle
      if (await AsyncStorage.getItem('notif_maintenance_enabled') === 'false') return;
      if (dueLabels.length === 0) return;
      const body = dueLabels.slice(0, 3).join(' · ') + (dueLabels.length > 3 ? ` +${dueLabels.length - 3}` : '');
      await Notifications.scheduleNotificationAsync({
        identifier: 'maintenance-due',
        content: { title: 'Serwis / wymiana', body, data: { screen: 'vehicles' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: nextFireDate(9, 0, false) },
      });
    } catch {}
  },

  // Payday reminder. Fires on the configured day-of-month (10:00) so it nudges
  // even with the app closed; re-armed on foreground and cancelled once the month
  // is confirmed (handledMonth === this month).
  async refreshPaydayReminder(enabled: boolean, day: number, handledMonth: string | null): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync('payday').catch(() => {});
      if (await AsyncStorage.getItem('notif_enabled') === 'false') return;
      if (!enabled) return;
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      if (handledMonth === thisMonth) return; // already got the paycheck this month
      // This month's payday at 10:00; if already past and still unhandled, nudge tomorrow.
      let date = new Date(now.getFullYear(), now.getMonth(), day, 10, 0, 0);
      if (date.getTime() <= now.getTime()) date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0, 0);
      await Notifications.scheduleNotificationAsync({
        identifier: 'payday',
        content: { title: 'Wypłata?', body: 'Czy dostałeś już wypłatę? Dotknij, by dodać do przychodów.', data: { screen: 'payday' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
      });
    } catch {}
  },

  // Budget / tag-limit reminder. Re-armed on app foreground with the current
  // tag-limit state (one-off DATE, this evening) so it nudges even with the app
  // closed; cancelled when nothing is near its limit. Threshold 80%.
  async refreshBudgetReminder(
    near: { label: string; pct: number; spend: number; limit: number; period: 'week' | 'month' }[],
  ): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync('budget-limit').catch(() => {});
      if (await AsyncStorage.getItem('notif_enabled') === 'false') return; // respect the global toggle
      if (await AsyncStorage.getItem('notif_budget_enabled') === 'false') return;
      const thrRaw = parseInt((await AsyncStorage.getItem('budget_alert_threshold')) ?? '80', 10);
      const threshold = (isNaN(thrRaw) ? 80 : Math.min(100, Math.max(50, thrRaw))) / 100;
      const hot = near.filter(n => n.pct >= threshold).sort((a, b) => b.pct - a.pct);
      if (hot.length === 0) return;
      const anyOver = hot.some(n => n.pct >= 1);
      const body = hot.slice(0, 3)
        .map(n => `${n.label} ${Math.round(n.pct * 100)}% (${Math.round(n.spend)}/${Math.round(n.limit)} zł)`)
        .join(' · ');
      await Notifications.scheduleNotificationAsync({
        identifier: 'budget-limit',
        content: {
          title: anyOver ? 'Przekroczono limit wydatków' : 'Zbliżasz się do limitu wydatków',
          body,
          data: { screen: 'finances' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: nextFireDate(18, 0, false) },
      });
    } catch {}
  },

  // Weekly recap — a one-off DATE for the upcoming Sunday 19:00, re-armed on app
  // open so the content reflects the latest week. Gated by its own flag.
  async refreshWeeklySummary(parts: string[]): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync('weekly-summary').catch(() => {});
      if (await AsyncStorage.getItem('notif_enabled') === 'false') return;
      if (await AsyncStorage.getItem('notif_weekly_enabled') === 'false') return;
      if (parts.length === 0) return;
      const now = new Date();
      const date = new Date(now);
      date.setDate(now.getDate() + ((7 - now.getDay()) % 7)); // upcoming Sunday (getDay 0 = today)
      date.setHours(19, 0, 0, 0);
      if (date.getTime() <= now.getTime()) date.setDate(date.getDate() + 7);
      await Notifications.scheduleNotificationAsync({
        identifier: 'weekly-summary',
        content: { title: 'Podsumowanie tygodnia', body: parts.join(' · '), data: { screen: 'index' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
      });
    } catch {}
  },

  // Nudge on the 1st of next month: a fresh "Karta miesiąca" (Wrapped) has sealed
  // and joined the collection. Deep-links to the collection screen.
  async refreshMonthCardReminder(): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync('month-card').catch(() => {});
      if (await AsyncStorage.getItem('notif_enabled') === 'false') return;
      const now = new Date();
      const date = new Date(now.getFullYear(), now.getMonth() + 1, 1, 10, 0, 0, 0); // 1st of next month, 10:00
      await Notifications.scheduleNotificationAsync({
        identifier: 'month-card',
        content: { title: '🎴 Nowa karta miesiąca!', body: 'Miniony miesiąc trafił do Twojej kolekcji — zobacz, jaki tier zdobył.', data: { screen: 'month-cards' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
      });
    } catch {}
  },

  async scheduleDailyTaskBriefing(
    hour = 8, minute = 0,
    context?: { taskCount?: number; eventCount?: number; habitCount?: number },
  ): Promise<string> {
    await Notifications.cancelScheduledNotificationAsync('daily-briefing').catch(() => {});
    const parts: string[] = [];
    if (context?.taskCount) parts.push(`${context.taskCount} zadań`);
    if (context?.eventCount) parts.push(`${context.eventCount} wydarzeń`);
    if (context?.habitCount) parts.push(`${context.habitCount} nawyków`);
    const body = parts.length > 0
      ? `Na dziś: ${parts.join(', ')}. Do dzieła!`
      : 'Zaplanuj swój dzień i sprawdź zadania.';
    return Notifications.scheduleNotificationAsync({
      identifier: 'daily-briefing',
      content: {
        title: 'Dzień dobry — plan dnia',
        body,
        data: { screen: 'tasks' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour, minute,
      },
    });
  },

  async cancelDailyTaskBriefing(): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync('daily-briefing').catch(() => {});
  },

  async scheduleDailyHabitReminder(hour = 21, minute = 0): Promise<string> {
    await Notifications.cancelScheduledNotificationAsync('daily-habits').catch(() => {});
    if (await AsyncStorage.getItem('notif_habits_enabled') === 'false') return '';
    return Notifications.scheduleNotificationAsync({
      identifier: 'daily-habits',
      content: {
        title: 'Nie odhaczyłeś dziś nawyków',
        body: 'Masz nawyki do zrobienia na dziś.',
        data: { screen: 'habits' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour, minute,
      },
    });
  },

  async cancelDailyHabitReminder(): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync('daily-habits').catch(() => {});
  },

  // ─── Daily todo list ──────────────────────────────────────────────────────────
  // Single notification showing tasks due today, tomorrow, and no-deadline count.
  // Reschedule on every app open so content stays fresh.

  async scheduleDailyTodoList(hour: number, minute: number, tasks: Task[]): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync('daily-todo-list').catch(() => {});

    function pad(n: number) { return String(n).padStart(2, '0'); }
    const now = new Date();
    const todayStr    = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    const tomorrowD   = new Date(now); tomorrowD.setDate(now.getDate() + 1);
    const tomorrowStr = `${tomorrowD.getFullYear()}-${pad(tomorrowD.getMonth()+1)}-${pad(tomorrowD.getDate())}`;

    const pending = tasks.filter(t => t.status === 'pending');
    if (pending.length === 0) return;

    const todayT     = pending.filter(t => t.deadline?.startsWith(todayStr) || t.scheduledDate === todayStr);
    const tomorrowT  = pending.filter(t => t.deadline?.startsWith(tomorrowStr) || t.scheduledDate === tomorrowStr);
    const noDeadline = pending.filter(t => !t.deadline && !t.scheduledDate);

    const shorten = (arr: Task[]) => {
      const names = arr.slice(0, 2).map(t => t.title).join(', ');
      return arr.length > 2 ? `${names} +${arr.length - 2}` : names;
    };

    const parts: string[] = [];
    if (todayT.length)     parts.push(`Dziś: ${shorten(todayT)}`);
    if (tomorrowT.length)  parts.push(`Jutro: ${shorten(tomorrowT)}`);
    if (noDeadline.length) parts.push(`Bezterminowe: ${shorten(noDeadline)}`);

    if (parts.length === 0) return;

    const n = pending.length;
    const title = `${n} ${n === 1 ? 'zadanie' : n <= 4 ? 'zadania' : 'zadań'} do zrobienia`;

    const fire = new Date(now);
    fire.setHours(hour, minute, 0, 0);
    if (fire <= now) fire.setDate(fire.getDate() + 1);

    await Notifications.scheduleNotificationAsync({
      identifier: 'daily-todo-list',
      content: { title, body: parts.join(' · '), data: { screen: 'tasks' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fire },
    }).catch(() => {});
  },

  async cancelDailyTodoList(): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync('daily-todo-list').catch(() => {});
  },

  // ─── Smart deadline digests (legacy — kept for recurring tasks) ───────────────

  async scheduleDeadlineDigests(tasks: Task[]): Promise<void> {
    const now = new Date();
    const nowDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; // LOCAL (toISOString=UTC → wrong day at night)

    // Group pending tasks by deadline date
    const byDate: Record<string, string[]> = {};
    for (const t of tasks) {
      if (t.status !== 'pending') continue;
      if (!t.deadline) continue;
      const dateStr = t.deadline.slice(0, 10);
      if (dateStr <= nowDate) continue; // skip past/today deadlines for digest
      if (!byDate[dateStr]) byDate[dateStr] = [];
      byDate[dateStr].push(t.title);
    }

    // Find which dates are within next 7 days (no point scheduling further)
    const in7Days = new Date(now);
    in7Days.setDate(in7Days.getDate() + 7);

    // Cancel all existing digests
    const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
    for (const notif of scheduled) {
      if (notif.identifier?.startsWith('digest-')) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier).catch(() => {});
      }
    }

    // Schedule one digest per date
    for (const [dateStr, titles] of Object.entries(byDate)) {
      const deadlineDate = new Date(dateStr + 'T09:00:00');
      if (deadlineDate > in7Days) continue;

      // Fire at 9 AM the day before deadline
      const fire = new Date(deadlineDate);
      fire.setDate(fire.getDate() - 1);
      fire.setHours(9, 0, 0, 0);
      if (fire <= now) continue;

      const { title, body } = buildDigestMessage(titles);
      await Notifications.scheduleNotificationAsync({
        identifier: `digest-${dateStr}`,
        content: { title, body, data: { screen: 'tasks' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fire },
      }).catch(() => {});
    }
  },

  // ─── Per-task: urgent 1h-before only (no per-task spam) ─────────────────────

  async scheduleTaskDeadlineReminder(taskId: string, title: string, deadlineIso: string): Promise<void> {
    const deadline = new Date(deadlineIso);
    const now = new Date();

    // 1h before deadline — urgent, kept per-task since it's time-sensitive
    const hourBefore = new Date(deadline);
    hourBefore.setHours(hourBefore.getHours() - 1);
    if (hourBefore <= now) return;

    const cat = detectCategory(title);
    const urgentBody = cat === 'uni'    ? `"${title}" — czas oddawać, uczelnia nie czeka!`
                     : cat === 'work'   ? `"${title}" — zostało mniej niż godzina, do pracy!`
                     : cat === 'home'   ? `"${title}" — ostatni moment, bierz się za to!`
                     : `"${title}" — mniej niż godzina!`;

    await Notifications.scheduleNotificationAsync({
      identifier: `task-${taskId}`,
      content: {
        title: 'Deadline za godzinę',
        body: urgentBody,
        data: { screen: 'tasks', taskId },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: hourBefore },
    }).catch(() => {});
  },

  async scheduleCustomTaskReminder(
    taskId: string,
    title: string,
    date: string,       // YYYY-MM-DD
    time: string,       // HH:mm
    customMessage?: string,
  ): Promise<void> {
    const [h, m] = time.split(':').map(Number);
    const fire = new Date(`${date}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`);
    if (fire <= new Date()) return;
    await Notifications.scheduleNotificationAsync({
      identifier: `task-reminder-${taskId}`,
      content: {
        title: title,
        body: customMessage || `Przypomnienie: ${title}`,
        data: { screen: 'tasks', taskId },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fire },
    }).catch(() => {});
  },

  async cancelTaskReminder(taskId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(`task-${taskId}`).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(`task-reminder-${taskId}`).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(`task-humor-${taskId}`).catch(() => {});
  },

  // ─── Subscription reminders ────────────────────────────────────────────────

  async scheduleSubscriptionReminder(sub: Subscription): Promise<void> {
    if (!sub.active || sub.reminderDaysBefore <= 0) return;
    if (await AsyncStorage.getItem('notif_enabled') === 'false') return;
    if (await AsyncStorage.getItem('notif_subs_enabled') === 'false') return;
    const fire = new Date(sub.nextBillingDate + 'T09:00:00');
    fire.setDate(fire.getDate() - sub.reminderDaysBefore);
    if (fire <= new Date()) return;

    await Notifications.scheduleNotificationAsync({
      identifier: `sub-${sub.id}`,
      content: {
        title: `Subskrypcja: ${sub.name}`,
        body: `Za ${sub.reminderDaysBefore} ${sub.reminderDaysBefore === 1 ? 'dzień' : 'dni'} — ${sub.amount.toFixed(2)} zł. Sprawdź czy chcesz przedłużyć.`,
        data: { screen: 'subscriptions', subId: sub.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fire },
    }).catch(() => {});
  },

  async cancelSubscriptionReminder(subId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(`sub-${subId}`).catch(() => {});
  },

  async scheduleEventReminder(eventId: string, title: string, dateIso: string, startTime?: string): Promise<void> {
    const [year, month, day] = dateIso.split('T')[0].split('-').map(Number);
    const [hour, minute] = startTime ? startTime.split(':').map(Number) : [9, 0];
    const fire = new Date(year, month - 1, day, hour, minute);
    fire.setMinutes(fire.getMinutes() - 30);
    if (fire <= new Date()) return;

    await Notifications.scheduleNotificationAsync({
      identifier: `event-${eventId}`,
      content: {
        title: 'Za 30 minut',
        body: `"${title}" — czas się przygotować.`,
        data: { screen: 'calendar_event', eventId },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fire },
    }).catch(() => {});
  },

  async cancelEventReminder(eventId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(`event-${eventId}`).catch(() => {});
  },

  // ─── Work shift notifications ─────────────────────────────────────────────
  // Schedule start + end notifications for all upcoming work events (next 7 days).
  // Called whenever calendar events or work settings change.

  async scheduleWorkShiftNotifications(
    workEvents: { id: string; title: string; date: string; startTime?: string; endTime?: string }[],
    perSecond: number,
  ): Promise<void> {
    // Cancel all previously scheduled work notifications
    const all = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
    for (const n of all) {
      if (n.identifier?.startsWith('work-start-') || n.identifier?.startsWith('work-end-')) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
      }
    }

    if (await AsyncStorage.getItem('notif_enabled') === 'false') return;
    if (await AsyncStorage.getItem('notif_work_enabled') === 'false') return;

    const now = new Date();
    const in7Days = new Date(now);
    in7Days.setDate(now.getDate() + 7);

    for (const ev of workEvents) {
      if (!ev.startTime) continue;
      const dateBase = ev.date.slice(0, 10);
      const [sh, sm] = ev.startTime.split(':').map(Number);

      const fireStart = new Date(`${dateBase}T00:00:00`);
      fireStart.setHours(sh, sm, 0, 0);
      if (fireStart > now && fireStart <= in7Days) {
        await Notifications.scheduleNotificationAsync({
          identifier: `work-start-${ev.id}`,
          content: {
            title: 'Zmiana pracy',
            body: `Zaczyna się: ${ev.title}. Do roboty!`,
            data: { screen: 'index' },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireStart },
        }).catch(() => {});
      }

      if (!ev.endTime) continue;
      const [eh, em] = ev.endTime.split(':').map(Number);
      const fireEnd = new Date(`${dateBase}T00:00:00`);
      fireEnd.setHours(eh, em, 0, 0);

      if (fireEnd > now && fireEnd <= in7Days) {
        const durationSecs = Math.max(0, (eh * 60 + em - sh * 60 - sm) * 60);
        const earned = (perSecond * durationSecs).toFixed(2);
        await Notifications.scheduleNotificationAsync({
          identifier: `work-end-${ev.id}`,
          content: {
            title: 'Koniec zmiany',
            body: `${ev.title} — zarobiłeś ok. ${earned} zł. Dobra robota!`,
            data: { screen: 'index' },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireEnd },
        }).catch(() => {});
      }
    }
  },

  async scheduleSnoozeReminder(taskId: string, title: string, until: Date): Promise<void> {
    if (until <= new Date()) return;
    await Notifications.scheduleNotificationAsync({
      identifier: `snooze-${taskId}`,
      content: {
        title: 'Czas wrócić do zadania',
        body: `"${title}" — drzemka skończona. Do roboty!`,
        data: { screen: 'tasks', taskId },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: until },
    }).catch(() => {});
  },

  async cancelSnoozeReminder(taskId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(`snooze-${taskId}`).catch(() => {});
  },

  async scheduleHabitReminder(habitId: string, title: string, hour: number, minute: number): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(`habit-${habitId}`).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: `habit-${habitId}`,
      content: {
        title: 'Czas na nawyk',
        body: `"${title}" — zaznacz postęp na dziś!`,
        data: { screen: 'habits' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour, minute,
      },
    }).catch(() => {});
  },

  async cancelHabitReminder(habitId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(`habit-${habitId}`).catch(() => {});
  },

  async notifyCategoryLimit(categoryLabel: string, spent: number, limit: number): Promise<void> {
    const pct = Math.round((spent / limit) * 100);
    const exceeded = pct >= 100;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: exceeded ? `Budżet przekroczony: ${categoryLabel}` : `Budżet prawie wyczerpany: ${categoryLabel}`,
        body: exceeded
          ? `Wydałeś ${spent.toFixed(0)} zł z limitu ${limit} zł (${pct}%). Uważaj!`
          : `Już ${pct}% budżetu na ${categoryLabel} — zostało ${(limit - spent).toFixed(0)} zł.`,
        data: { screen: 'finances' },
      },
      trigger: null,
    }).catch(() => {});
  },

  async cancelAll(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },
};

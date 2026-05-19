import * as Notifications from 'expo-notifications';
import { Subscription, Task } from '@/types';

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
  async requestPermissions(): Promise<boolean> {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  },

  async scheduleDailyMoodReminder(hour = 20, minute = 0): Promise<string> {
    await Notifications.cancelScheduledNotificationAsync('daily-mood').catch(() => {});
    return Notifications.scheduleNotificationAsync({
      identifier: 'daily-mood',
      content: {
        title: 'Codzienny check-in',
        body: 'Jak minął dzień? Zaloguj swój nastrój.',
        data: { screen: 'mood' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour, minute,
      },
    });
  },

  async scheduleMorningMoodReminder(hour = 8, minute = 0): Promise<string> {
    await Notifications.cancelScheduledNotificationAsync('morning-mood').catch(() => {});
    return Notifications.scheduleNotificationAsync({
      identifier: 'morning-mood',
      content: {
        title: 'Dzień dobry',
        body: 'Jak się czujesz z rana? Zaloguj energię i nastrój.',
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
    return Notifications.scheduleNotificationAsync({
      identifier: 'daily-habits',
      content: {
        title: 'Nawyki na dziś',
        body: 'Nie zapomnij o codziennych nawykach!',
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

  // ─── Smart deadline digests ──────────────────────────────────────────────────
  // One grouped notification per deadline date (day-before at 9 AM).
  // Call this with ALL pending tasks whenever the task list changes.

  async scheduleDeadlineDigests(tasks: Task[]): Promise<void> {
    const now = new Date();
    const nowDate = now.toISOString().slice(0, 10);

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

  async cancelTaskReminder(taskId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(`task-${taskId}`).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(`task-humor-${taskId}`).catch(() => {});
  },

  // ─── Subscription reminders ────────────────────────────────────────────────

  async scheduleSubscriptionReminder(sub: Subscription): Promise<void> {
    if (!sub.active || sub.reminderDaysBefore <= 0) return;
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

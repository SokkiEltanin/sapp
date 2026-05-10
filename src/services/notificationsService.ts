import * as Notifications from 'expo-notifications';
import { Subscription } from '@/types';

// ─── Humor pool for task reminders ────────────────────────────────────────────
const HUMOR: Array<(t: string) => string> = [
  (t) => `Hej, ciekawostka — "${t}" samo się nie zrobi 🤔`,
  (t) => `"${t}" nadal czeka. Wytrwale. Cierpliwie. Osądzająco.`,
  (t) => `Dzień dobry! "${t}" było wczoraj, będzie jutro... a może jednak dziś?`,
  (t) => `Naukowy fakt: unikanie "${t}" nie sprawia że znika.`,
  (t) => `Mała przypominajka: "${t}". Wiedziałeś że zapomnisz, prawda? 😅`,
  (t) => `"${t}" — ostatnia szansa przed nocną paniką 🌙`,
  (t) => `Alert: "${t}" osiągnęło stan krytycznego bycia-nieskończonym 🚨`,
  (t) => `Fun fact: "${t}" nie zrobi się magic-way. Sory.`,
  (t) => `"${t}" wysyła pozdrowienia z Twojej listy zaległości 👋`,
  (t) => `Przypomnienie od Twojego bardziej produktywnego ja: zrób "${t}" już dziś.`,
];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const notificationsService = {
  async requestPermissions(): Promise<boolean> {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  },

  async scheduleDailyMoodReminder(hour = 20, minute = 0): Promise<string> {
    await Notifications.cancelScheduledNotificationAsync('daily-mood').catch(() => {});
    const id = await Notifications.scheduleNotificationAsync({
      identifier: 'daily-mood',
      content: {
        title: 'Codzienny check-in',
        body: 'Jak minął dzień? Zaloguj swój nastrój.',
        data: { screen: 'mood' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    return id;
  },

  async scheduleMorningMoodReminder(hour = 8, minute = 0): Promise<string> {
    await Notifications.cancelScheduledNotificationAsync('morning-mood').catch(() => {});
    const id = await Notifications.scheduleNotificationAsync({
      identifier: 'morning-mood',
      content: {
        title: 'Dzień dobry',
        body: 'Jak się czujesz z rana? Zaloguj energię i nastrój.',
        data: { screen: 'mood' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    return id;
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
    if (context?.taskCount) parts.push(`${context.taskCount} ${context.taskCount === 1 ? 'zadanie' : context.taskCount <= 4 ? 'zadania' : 'zadań'} na dziś`);
    if (context?.eventCount) parts.push(`${context.eventCount} ${context.eventCount === 1 ? 'wydarzenie' : 'wydarzeń'}`);
    if (context?.habitCount) parts.push(`${context.habitCount} ${context.habitCount === 1 ? 'nawyk' : 'nawyków'} do zrobienia`);
    const body = parts.length > 0
      ? `Czeka na Ciebie: ${parts.join(', ')}. Dobrego dnia!`
      : 'Zaplanuj swój dzień i sprawdź zadania.';
    const id = await Notifications.scheduleNotificationAsync({
      identifier: 'daily-briefing',
      content: {
        title: 'Dzień dobry — plan dnia',
        body,
        data: { screen: 'tasks' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    return id;
  },

  async cancelDailyTaskBriefing(): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync('daily-briefing').catch(() => {});
  },

  async scheduleDailyHabitReminder(hour = 21, minute = 0): Promise<string> {
    await Notifications.cancelScheduledNotificationAsync('daily-habits').catch(() => {});
    const id = await Notifications.scheduleNotificationAsync({
      identifier: 'daily-habits',
      content: {
        title: 'Nawyki na dziś',
        body: 'Nie zapomnij o codziennych nawykach!',
        data: { screen: 'habits' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    return id;
  },

  async cancelDailyHabitReminder(): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync('daily-habits').catch(() => {});
  },

  async scheduleTaskDeadlineReminder(taskId: string, title: string, deadlineIso: string): Promise<void> {
    const deadline = new Date(deadlineIso);
    const now = new Date();

    // 1 day before at 9:00 — humorous reminder
    const dayBefore = new Date(deadline);
    dayBefore.setDate(dayBefore.getDate() - 1);
    dayBefore.setHours(9, 0, 0, 0);
    if (dayBefore > now) {
      const msg = HUMOR[Math.floor(Math.random() * HUMOR.length)](title);
      await Notifications.scheduleNotificationAsync({
        identifier: `task-humor-${taskId}`,
        content: {
          title: 'Jutro deadline 👀',
          body: msg,
          data: { screen: 'tasks', taskId },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: dayBefore },
      }).catch(() => {});
    }

    // 1h before deadline — urgent
    const hourBefore = new Date(deadline);
    hourBefore.setHours(hourBefore.getHours() - 1);
    if (hourBefore <= now) return;
    await Notifications.scheduleNotificationAsync({
      identifier: `task-${taskId}`,
      content: {
        title: 'Zbliża się deadline 🚨',
        body: `"${title}" — zostało mniej niż godzina!`,
        data: { screen: 'tasks', taskId },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: hourBefore },
    });
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
        body: `Za ${sub.reminderDaysBefore} ${sub.reminderDaysBefore === 1 ? 'dzień' : 'dni'} odnowi się za ${sub.amount.toFixed(2)} zł. Pamiętaj o anulowaniu jeśli nie chcesz płacić!`,
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
        title: 'Nadchodzące wydarzenie',
        body: `"${title}" za 30 minut`,
        data: { screen: 'calendar_event', eventId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fire,
      },
    });
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
        body: `"${title}" — drzemka skończona!`,
        data: { screen: 'tasks', taskId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: until,
      },
    });
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
        hour,
        minute,
      },
    });
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

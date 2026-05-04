import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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

  async scheduleDailyTaskBriefing(hour = 7, minute = 30): Promise<string> {
    await Notifications.cancelScheduledNotificationAsync('daily-briefing').catch(() => {});
    const id = await Notifications.scheduleNotificationAsync({
      identifier: 'daily-briefing',
      content: {
        title: 'Dzień dobry — plan dnia',
        body: 'Sprawdź dzisiejsze zadania i zaplanuj dzień.',
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
    const date = new Date(deadlineIso);
    date.setHours(date.getHours() - 1); // 1h before deadline
    if (date <= new Date()) return;

    await Notifications.scheduleNotificationAsync({
      identifier: `task-${taskId}`,
      content: {
        title: 'Zbliża się deadline',
        body: `"${title}" — zostało mniej niż godzina!`,
        data: { screen: 'calendar', taskId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
      },
    });
  },

  async cancelTaskReminder(taskId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(`task-${taskId}`).catch(() => {});
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
        data: { screen: 'calendar' },
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
        data: { screen: 'calendar', taskId },
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

  async cancelAll(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },
};

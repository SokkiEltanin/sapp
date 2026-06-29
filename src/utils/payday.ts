import AsyncStorage from '@react-native-async-storage/async-storage';

// Payday prompt — on a configurable day of the month the dashboard asks whether
// the paycheck arrived; confirming logs an income (tagged with the work prefix so
// it becomes the "last paycheck" the earnings rate is derived from) and marks the
// month handled so it stops asking.

const K_ENABLED = 'payday_enabled';
const K_DAY     = 'payday_day';
const K_HANDLED = 'payday_handled_month'; // YYYY-MM of the last confirmed paycheck
const K_DISMISS = 'payday_dismissed_date'; // YYYY-MM-DD the prompt was waved off "for today"

// Only ask in a short window starting on the payday day (so it doesn't nag every
// day for the rest of the month).
const PAYDAY_WINDOW_DAYS = 4;

function dayStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface PaydayConfig { enabled: boolean; day: number; }

export function currentMonth(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function getPaydayConfig(): Promise<PaydayConfig> {
  const [en, day] = await Promise.all([
    AsyncStorage.getItem(K_ENABLED),
    AsyncStorage.getItem(K_DAY),
  ]);
  const dn = parseInt(day ?? '10', 10);
  return { enabled: en === 'true', day: Math.min(28, Math.max(1, isNaN(dn) ? 10 : dn)) };
}

export async function setPaydayConfig(c: PaydayConfig): Promise<void> {
  await AsyncStorage.multiSet([
    [K_ENABLED, c.enabled ? 'true' : 'false'],
    [K_DAY, String(c.day)],
  ]);
}

export async function getPaydayHandledMonth(): Promise<string | null> {
  return AsyncStorage.getItem(K_HANDLED);
}

export async function setPaydayHandledMonth(month: string): Promise<void> {
  await AsyncStorage.setItem(K_HANDLED, month);
}

// Per-day "Jeszcze nie" dismissal so the card doesn't reappear several times the
// same day; it comes back the next day (still within the window) until confirmed.
export async function getPaydayDismissedDate(): Promise<string | null> {
  return AsyncStorage.getItem(K_DISMISS);
}
export async function setPaydayDismissedToday(): Promise<void> {
  await AsyncStorage.setItem(K_DISMISS, dayStr());
}

// Should the dashboard ask right now? Enabled, within the few-day window FROM the
// payday day, not handled this month, and not already dismissed today.
export function paydayDue(
  cfg: PaydayConfig,
  handledMonth: string | null,
  dismissedDate: string | null = null,
  now = new Date(),
): boolean {
  if (!cfg.enabled) return false;
  const date = now.getDate();
  if (date < cfg.day || date > cfg.day + PAYDAY_WINDOW_DAYS) return false; // only around payday
  if (handledMonth === currentMonth(now)) return false;                    // already got it
  if (dismissedDate === dayStr(now)) return false;                         // waved off today
  return true;
}

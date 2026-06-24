import AsyncStorage from '@react-native-async-storage/async-storage';

// Payday prompt — on a configurable day of the month the dashboard asks whether
// the paycheck arrived; confirming logs an income (tagged with the work prefix so
// it becomes the "last paycheck" the earnings rate is derived from) and marks the
// month handled so it stops asking.

const K_ENABLED = 'payday_enabled';
const K_DAY     = 'payday_day';
const K_HANDLED = 'payday_handled_month'; // YYYY-MM of the last confirmed paycheck

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

// Should the dashboard ask right now? (enabled, past the day, not yet handled this month)
export function paydayDue(cfg: PaydayConfig, handledMonth: string | null, now = new Date()): boolean {
  if (!cfg.enabled) return false;
  if (now.getDate() < cfg.day) return false;
  return handledMonth !== currentMonth(now);
}

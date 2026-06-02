import AsyncStorage from '@react-native-async-storage/async-storage';

// The app only knows the net of the transactions you entered. Your real bank
// balance also includes whatever you had BEFORE you started tracking. We store
// an "offset" so the displayed balance matches reality:
//
//   displayedBalance = offset + (allIncome - allExpenses)
//
// When the user types their current real balance, we compute:
//   offset = realBalanceNow - currentNet
// so the displayed balance equals the real one now, and tracks every change after.

const KEY = 'account_balance_offset_v1';

export async function getBalanceOffset(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const n = raw != null ? parseFloat(raw) : 0;
    return isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export async function setBalanceOffset(offset: number): Promise<void> {
  if (!isFinite(offset)) return;
  try { await AsyncStorage.setItem(KEY, String(offset)); } catch {}
}

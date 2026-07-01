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

// How much of the balance is CASH. The card balance is then (total − cash), so
// the total stays consistent. cashBalance = cashOffset + (cashIncome − cashExpense).
const CASH_KEY = 'account_cash_offset_v1';

export async function getCashOffset(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(CASH_KEY);
    const n = raw != null ? parseFloat(raw) : 0;
    return isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export async function setCashOffset(offset: number): Promise<void> {
  if (!isFinite(offset)) return;
  try { await AsyncStorage.setItem(CASH_KEY, String(offset)); } catch {}
}

// Highest card balance ever reached (for the "Gruby portfel" record). Recomputes the
// current card balance and bumps the persisted peak — returns the peak.
const PEAK_KEY = 'card_balance_peak_v1';
export async function updateCardBalancePeak(
  expenses: { type?: string; amount: number; paymentMethod?: string }[],
): Promise<number> {
  const [off, cashOff] = await Promise.all([getBalanceOffset(), getCashOffset()]);
  let allInc = 0, allExp = 0, cashInc = 0, cashExp = 0;
  for (const e of expenses) {
    const isCash = e.paymentMethod === 'cash';
    if (e.type === 'income') { allInc += e.amount; if (isCash) cashInc += e.amount; }
    else { allExp += e.amount; if (isCash) cashExp += e.amount; }
  }
  const cardBalance = (off + allInc - allExp) - (cashOff + cashInc - cashExp);
  let peak = 0;
  try { const raw = await AsyncStorage.getItem(PEAK_KEY); peak = raw ? parseFloat(raw) : 0; } catch {}
  if (cardBalance > peak) { peak = cardBalance; try { await AsyncStorage.setItem(PEAK_KEY, String(peak)); } catch {} }
  return Math.max(peak, 0);
}

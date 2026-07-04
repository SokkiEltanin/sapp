import AsyncStorage from '@react-native-async-storage/async-storage';

// Card and cash are two INDEPENDENT pots. The user types how much they have on
// the CARD and how much in CASH; the total is simply the sum. Each pot stores an
// "offset" = the money that was there before tracking started, so:
//
//   cardBalance = cardOffset + (cardIncome - cardExpense)   // non-cash transactions
//   cashBalance = cashOffset + (cashIncome - cashExpense)   // cash transactions
//   totalBalance = cardBalance + cashBalance
//
// When the user types their real card (or cash) balance, offset = real - thatNet.
// NOTE: KEY historically held the TOTAL offset; migrateBalanceModel() converts it
// to a card offset (cardOffset = oldTotalOffset - cashOffset) once, so nothing jumps.

const KEY = 'account_balance_offset_v1'; // now the CARD offset (see migrateBalanceModel)

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

// The CASH pot: cashBalance = cashOffset + (cashIncome − cashExpense).
const CASH_KEY = 'account_cash_offset_v1';

// One-time migration: the old model stored the TOTAL offset in KEY and derived the
// card balance as (total − cash). The new model stores the CARD offset directly, so
// convert once: cardOffset = oldTotalOffset − cashOffset. Keeps the shown card
// balance identical across the update.
const MIGRATION_KEY = 'balance_model_card_v2';
export async function migrateBalanceModel(): Promise<void> {
  try {
    if (await AsyncStorage.getItem(MIGRATION_KEY)) return;
    const [off, cashOff] = await Promise.all([getBalanceOffset(), getCashOffset()]);
    await setBalanceOffset(off - cashOff);
    await AsyncStorage.setItem(MIGRATION_KEY, '1');
  } catch {}
}

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
// Highest the card balance EVER reached. Previously this only sampled the *current*
// balance whenever the app happened to run it, so a peak reached between app opens
// was missed. Now it replays every card transaction in date order and tracks the
// running maximum — the true historical peak — and still keeps a persisted floor so
// it never drops (e.g. after you spend the money down again).
export async function updateCardBalancePeak(
  expenses: { type?: string; amount: number; paymentMethod?: string; date?: string }[],
): Promise<number> {
  const cardOffset = await getBalanceOffset(); // starting card balance before recorded transactions
  const card = expenses
    .filter(e => e.paymentMethod !== 'cash')
    .slice()
    .sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime());
  let running = cardOffset;
  let peakRun = running;
  for (const e of card) {
    running += e.type === 'income' ? e.amount : -e.amount;
    if (running > peakRun) peakRun = running;
  }
  let stored = 0;
  try { const raw = await AsyncStorage.getItem(PEAK_KEY); stored = raw ? parseFloat(raw) : 0; } catch {}
  const peak = Math.max(stored, peakRun, 0);
  if (peak !== stored) { try { await AsyncStorage.setItem(PEAK_KEY, String(peak)); } catch {} }
  return peak;
}
